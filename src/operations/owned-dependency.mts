/** Assemble an owned dependency from a pinned archive and registered source outputs. */
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {resolveTar} from './tool-resolution.mjs'
import {createTestDirectory, cleanupTestDirectory} from './test-temp.mjs'

interface Assembly {
  upstreamPackage: string
  upstreamVersion: string
  lockArtifact: string
  packageArtifact: string
  ownedRoot: string
  upstreamTree: string
  targetTree: string
  overlays: string[]
}
interface Manifest {
  artifacts: {id: string; source: string}[]
  dependencyAssemblies: Record<string, Assembly>
}

function child(root: string, relative: string): string {
  if (!relative || relative.includes('\\') || relative.includes(':') || path.posix.isAbsolute(relative)
    || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw Error('Unsafe owned dependency path: ' + relative)
  }
  return path.join(root, relative)
}

/** Reject links/devices even inside a hash-verified archive; copying never follows them. */
export function regularPackageFiles(root: string): string[] {
  const result: string[] = []
  const visit = (directory: string) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name)
      const stat = fs.lstatSync(file)
      if (stat.isSymbolicLink()) throw Error('Dependency archive contains a symbolic link')
      if (stat.isDirectory()) visit(file)
      else if (stat.isFile()) result.push(path.relative(root, file).replaceAll('\\', '/'))
      else throw Error('Dependency archive contains a non-regular member')
    }
  }
  visit(root)
  return result
}

/**
 * The output must be absent. All extraction and overlay work happens in a fresh
 * owned staging directory before claiming and filling a fresh output directory.
 * This never opens an installed upstream file for writing or runs a replay.
 */
export function assembleOwnedDependency(options: {
  repo: string; id: string; archive: string; output: string
}) {
  const repo = fs.realpathSync(options.repo)
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'release/source-manifest.json'), 'utf8')) as Manifest
  const assembly = manifest.dependencyAssemblies?.[options.id]
  if (!assembly) throw Error('Unknown owned dependency: ' + options.id)
  const artifact = (id: string) => {
    const found = manifest.artifacts.find(item => item.id === id)
    if (!found) throw Error('Unregistered dependency artifact: ' + id)
    return child(repo, found.source)
  }
  const output = path.resolve(options.output)
  if (fs.existsSync(output)) throw Error('Owned dependency output already exists')
  if (!fs.statSync(path.dirname(output)).isDirectory()) throw Error('Output parent is not a directory')
  const lock = JSON.parse(fs.readFileSync(artifact(assembly.lockArtifact), 'utf8'))
  const pin = lock.packages?.['node_modules/' + assembly.upstreamPackage]
  if (pin?.version !== assembly.upstreamVersion || !pin.integrity?.startsWith('sha512-')) {
    throw Error('Owned dependency upstream differs from lock')
  }
  const archiveBytes = fs.readFileSync(options.archive)
  const integrity = 'sha512-' + createHash('sha512').update(archiveBytes).digest('base64')
  if (integrity !== pin.integrity) throw Error('Owned dependency archive integrity mismatch')
  const metadata = JSON.parse(fs.readFileSync(artifact(assembly.packageArtifact), 'utf8'))
  if (!metadata.name?.startsWith('dsh-nexttavern-') || metadata.name === assembly.upstreamPackage) {
    throw Error('Owned dependency must have an explicit owned package identity')
  }
  const ownedRoot = child(repo, assembly.ownedRoot)
  // Validate all overlay identities and destinations before creating output.
  const overlays = assembly.overlays.map(id => {
    const source = artifact(id)
    const relative = path.relative(ownedRoot, source).replaceAll('\\', '/')
    child(ownedRoot, relative)
    if (!fs.lstatSync(source).isFile()) throw Error('Overlay must be a regular file: ' + id)
    return {id, source, relative}
  })
  if (!overlays.some(item => item.id === assembly.packageArtifact)) throw Error('Missing owned package metadata overlay')
  if (new Set(overlays.map(item => item.relative)).size !== overlays.length) throw Error('Duplicate owned dependency output')

  const staging = createTestDirectory('owned-dependency-')
  try {
    // Extract the exact bytes we verified, not a path that could be replaced
    // between hashing and tar. The temporary tree is owned by this invocation.
    const archive = path.join(staging, 'upstream.tgz')
    fs.writeFileSync(archive, archiveBytes)
    const tar = resolveTar()
    const members = execFileSync(tar, ['-tzf', archive], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024})
      .trim().split(/\r?\n/)
    for (const member of members) {
      const relative = member.replace(/\/$/, '')
      if (relative !== 'package' && !relative.startsWith('package/')) throw Error('Unexpected archive root')
      child(staging, relative)
    }
    const listing = execFileSync(tar, ['-tvzf', archive], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024})
      .trim().split(/\r?\n/)
    if (listing.length !== members.length || listing.some(line => !/^[-d]/.test(line))) {
      throw Error('Dependency archive must contain only regular files and directories')
    }
    const unpacked = path.join(staging, 'unpacked')
    fs.mkdirSync(unpacked)
    execFileSync(tar, ['-xzf', archive, '-C', unpacked], {stdio: 'pipe'})
    const upstream = path.join(unpacked, 'package')
    regularPackageFiles(upstream)
    const upstreamMetadata = JSON.parse(fs.readFileSync(path.join(upstream, 'package.json'), 'utf8'))
    if (upstreamMetadata.name !== assembly.upstreamPackage || upstreamMetadata.version !== assembly.upstreamVersion) {
      throw Error('Archive package identity differs from lock')
    }
    const prepared = path.join(staging, 'owned')
    fs.mkdirSync(prepared)
    fs.cpSync(child(upstream, assembly.upstreamTree), child(prepared, assembly.targetTree), {recursive: true})
    for (const overlay of overlays) {
      const target = child(prepared, overlay.relative)
      fs.mkdirSync(path.dirname(target), {recursive: true})
      fs.copyFileSync(overlay.source, target)
      // The old map would falsely attribute our implementation to unmodified
      // upstream sources. Generated overlays do not advertise a source map.
      if (/\.[cm]?js$/.test(target)) fs.rmSync(target + '.map', {force: true})
    }
    const files = regularPackageFiles(prepared).map(file => ({
      path: file,
      sha256: createHash('sha256').update(fs.readFileSync(child(prepared, file))).digest('hex'),
    }))
    // mkdir is the exclusive claim; copy/rollback touches only our fresh output.
    fs.mkdirSync(output)
    const outputIdentity = fs.realpathSync(output)
    try {
      fs.cpSync(prepared, output, {recursive: true})
    } catch (error) {
      if (!fs.lstatSync(output).isSymbolicLink() && fs.realpathSync(output) === outputIdentity) {
        fs.rmSync(output, {recursive: true, force: true})
      }
      throw error
    }
    return {name: metadata.name as string, version: metadata.version as string, upstreamIntegrity: integrity, files}
  } finally { cleanupTestDirectory(staging) }
}
