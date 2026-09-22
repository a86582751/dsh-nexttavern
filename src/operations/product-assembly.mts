/** Materialize the product's registered private packages, never installed files. */
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {assembleOwnedDependency, regularPackageFiles} from './owned-dependency.mjs'
import {contained as inside} from './public-transaction.mjs'

interface ProductRecipe {
  packageArtifact: string
  patchArtifact: string
  packages: {packageArtifact: string; assembly?: string; resources?: {artifact: string; path: string}[]}[]
}
interface Plan {
  artifacts: {id: string; source: string; public?: {path?: string}}[]
  product: ProductRecipe
  publicRelease: {packageName: string; candidateVersion: string}
}
interface Metadata {
  name: string
  version: string
  dependencies?: Record<string, string>
  bundleDependencies?: string[]
  dsh?: {bundle?: unknown}
}
const json = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T
const save = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), {recursive: true})
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

/**
 * Caller owns a fresh candidate directory. Archives are explicit pinned inputs;
 * this operation has no network, pnpm, profile, or installed-package writes.
 * A failed candidate is never returned as usable and is the caller's cleanup.
 */
export function assembleProduct(options: {
  repo: string; packageRoot: string; archives: Record<string, string>
}) {
  const repo = fs.realpathSync(options.repo)
  const plan = json<Plan>(path.join(repo, 'release/source-manifest.json'))
  if (!plan.product?.packages.length) throw Error('Missing root product recipe')
  const artifact = (id: string) => {
    const row = plan.artifacts.find(item => item.id === id)
    if (!row) throw Error('Unregistered product artifact: ' + id)
    return row
  }
  const metadata = json<Metadata>(inside(repo, artifact(plan.product.packageArtifact).source))
  if (metadata.name !== plan.publicRelease.packageName || metadata.version !== plan.publicRelease.candidateVersion) {
    throw Error('Product metadata differs from candidate identity')
  }
  const packageRoot = fs.realpathSync(options.packageRoot)
  const owned = plan.product.packages.map(row => {
    const source = artifact(row.packageArtifact).source
    const pkg = json<Metadata>(inside(repo, source))
    if (!/^dsh-nexttavern-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pkg.name) || pkg.dsh?.bundle !== undefined) {
      throw Error('Invalid private product package: ' + pkg.name)
    }
    if (row.assembly && !options.archives[row.assembly]) throw Error('Missing pinned archive: ' + row.assembly)
    const publicMetadata = artifact(row.packageArtifact).public?.path
    return {...row, source, pkg, publicMetadata}
  })
  const names = owned.map(row => row.pkg.name).sort()
  if (new Set(names).size !== names.length) throw Error('Duplicate product package')
  const declared = Object.keys(metadata.dependencies ?? {}).filter(name => name.startsWith('dsh-nexttavern-')).sort()
  if (JSON.stringify(names) !== JSON.stringify(declared)
    || JSON.stringify(names) !== JSON.stringify([...(metadata.bundleDependencies ?? [])].sort())) {
    throw Error('Root dependencies and registered private packages differ')
  }
  for (const {pkg} of owned) if (metadata.dependencies?.[pkg.name] !== pkg.version) {
    throw Error('Unpinned product dependency: ' + pkg.name)
  }
  const moduleRoot = inside(packageRoot, 'node_modules')
  if (fs.existsSync(moduleRoot)) throw Error('Candidate dependencies must be absent before assembly')
  fs.mkdirSync(moduleRoot)
  const packages = owned.map(({pkg, source, assembly, publicMetadata, resources}) => {
    const output = inside(moduleRoot, pkg.name)
    if (assembly) {
      const result = assembleOwnedDependency({repo, id: assembly, archive: options.archives[assembly]!, output})
      if (result.name !== pkg.name || result.version !== pkg.version) throw Error('Assembly identity differs from recipe')
      // The public compiler keeps the maintained SDK overlays at their source
      // package location. Complete that developer copy with the SAME admitted
      // upstream files, otherwise its emitted overlays import absent modules.
      // Existing projected sources keep their public normalization; upstream
      // maps remain with the exact private SDK, not a different source tree.
      if (!publicMetadata) throw Error('Assembled dependency has no public metadata mapping')
      const development = inside(packageRoot, path.posix.dirname(publicMetadata))
      for (const file of regularPackageFiles(output)) {
        const target = inside(development, file)
        if (file.endsWith('.map') || fs.existsSync(target)) continue
        fs.mkdirSync(path.dirname(target), {recursive: true})
        fs.copyFileSync(inside(output, file), target)
      }
    } else {
      const prefix = path.posix.dirname(source) + '/'
      const files = new Set(plan.artifacts.filter(row => row.source.startsWith(prefix)).map(row => row.source))
      for (const file of files) {
        const target = inside(output, file.slice(prefix.length))
        fs.mkdirSync(path.dirname(target), {recursive: true})
        fs.copyFileSync(inside(repo, file), target)
      }
    }
    for (const resource of resources ?? []) {
      const target = inside(output, resource.path)
      fs.mkdirSync(path.dirname(target), {recursive: true})
      fs.copyFileSync(inside(repo, artifact(resource.artifact).source), target)
    }
    const files = regularPackageFiles(output).sort().map(file => ({path: file,
      sha256: createHash('sha256').update(fs.readFileSync(inside(output, file))).digest('hex')}))
    return {name: pkg.name, version: pkg.version, files}
  })
  const inventory = {schemaVersion: 1, productVersion: metadata.version, packages}
  save(path.join(packageRoot, 'package.json'), metadata)
  save(path.join(packageRoot, 'nexttavern.dependencies.json'), inventory)
  fs.copyFileSync(inside(repo, artifact(plan.product.patchArtifact).source), path.join(packageRoot, 'cordis.patch.json'))
  return inventory
}
