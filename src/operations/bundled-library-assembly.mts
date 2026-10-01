/** Carry a locked SDK dependency closure without installing or executing it. */
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {createTestDirectory, cleanupTestDirectory} from './test-temp.mjs'

type Versions = Record<string, string>
interface Metadata {
  name: string; version: string
  main?: string; module?: string; types?: string; typings?: string; exports?: unknown; bin?: unknown
  dependencies?: Versions; optionalDependencies?: Versions; peerDependencies?: Versions
  peerDependenciesMeta?: Record<string, {optional?: boolean}>
  os?: string[]; cpu?: string[]
}
interface LockEntry extends Partial<Metadata> {
  link?: boolean; optional?: boolean; resolved?: string; integrity?: string
}
interface PackageReceipt {
  name: string; version: string
  /** POSIX directory relative to moduleRoot, retaining nested npm placement. */
  path: string
  files: {path: string; sha256: string}[]
}
interface PlannedPackage {
  source: string; relative: string; metadata: Metadata
  files: {path: string; bytes: Buffer; sha256: string}[]
}
const NAME = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/
const LICENSE = /^(?:licen[sc]e|copying|notice)(?:[._-].*)?$/i
interface Semver {
  valid(value: string): string | null
  validRange(value: string): string | null
  satisfies(version: string, range: string): boolean
}
const slash = (value: string) => value.replaceAll('\\', '/')
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return JSON.stringify(value.map(item => JSON.parse(stable(item))))
  if (value !== null && typeof value === 'object') {
    return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, JSON.parse(stable(item))])))
  }
  return JSON.stringify(value ?? null)
}

function relativeFile(value: string): string {
  if (!value || value.includes('\\') || path.isAbsolute(value) || /^[A-Za-z]:/.test(value)
    || value.split('/').some(part => part === '..' || part === '.' || !part)) {
    throw Error('Unsafe bundled library path: ' + value)
  }
  return value
}

/** Reject child links as well as lexical traversal: npm must not resolve off-tree. */
function contained(root: string, relative: string): string {
  relativeFile(relative)
  const target = path.resolve(root, relative)
  if (!target.startsWith(root + path.sep)) throw Error('Bundled library source escape: ' + relative)
  let cursor = root
  if (fs.lstatSync(cursor, {throwIfNoEntry: false})?.isSymbolicLink()) throw Error('Linked bundled library root')
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part)
    if (fs.lstatSync(cursor, {throwIfNoEntry: false})?.isSymbolicLink()) {
      throw Error('Linked bundled library path: ' + relative)
    }
  }
  return target
}

function outputRoot(value: string): string {
  let cursor = path.resolve(value)
  const missing: string[] = []
  while (!fs.existsSync(cursor)) {
    if (fs.lstatSync(cursor, {throwIfNoEntry: false})?.isSymbolicLink()) throw Error('Linked bundled output root')
    missing.unshift(path.basename(cursor))
    cursor = path.dirname(cursor)
  }
  // An existing output or ancestor must not redirect writes into another tree.
  for (let ancestor = cursor; ; ancestor = path.dirname(ancestor)) {
    if (fs.lstatSync(ancestor).isSymbolicLink()) throw Error('Linked bundled output root')
    if (path.dirname(ancestor) === ancestor) break
  }
  return path.join(fs.realpathSync(cursor), ...missing)
}

function dependencyName(name: string) {
  if (!NAME.test(name) || name.startsWith('@deepseek-ai/')) {
    throw Error('Host or invalid bundled library dependency: ' + name)
  }
}

function npmCli(): string {
  const configured = process.env.NEXTTAVERN_NPM_CLI
  const adjacent = path.dirname(process.execPath)
  const candidates = configured ? [configured] : [
    path.join(adjacent, 'node_modules/npm/bin/npm-cli.js'),
    path.join(adjacent, '../lib/node_modules/npm/bin/npm-cli.js'),
  ]
  const selected = candidates.find(file => path.isAbsolute(file) && fs.existsSync(file))
  if (!selected) throw Error('Set NEXTTAVERN_NPM_CLI to an existing npm JavaScript CLI')
  return selected
}

function publishedFiles(source: string, temporary: string): string[] {
  const userconfig = path.join(temporary, 'empty.npmrc')
  const output = execFileSync(process.execPath, [npmCli(), 'pack', '--dry-run', '--json',
    '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(temporary, 'cache')], {
    cwd: source, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
    env: {...process.env, npm_config_userconfig: userconfig, npm_config_update_notifier: 'false'},
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const rows = JSON.parse(output) as {files?: {path: string}[]}[]
  if (rows.length !== 1 || !rows[0]?.files?.length) throw Error('Invalid npm published-file receipt: ' + source)
  return [...new Set(rows[0].files.map(row => relativeFile(slash(row.path))))]
    .sort()
}

function excludesPlatform(entry: LockEntry): boolean {
  const excluded = (values: string[] | undefined, current: string) => {
    if (!Array.isArray(values) || !values.length || values.some(value => typeof value !== 'string')) return false
    const positive = values.filter(value => !value.startsWith('!'))
    return values.includes('!' + current) || (positive.length > 0 && !positive.includes(current) && !positive.includes('any'))
  }
  return excluded(entry.os, process.platform) || excluded(entry.cpu, process.arch)
}

function declaredEntry(metadata: Metadata, file: string): boolean {
  const targets: string[] = []
  const collect = (value: unknown): void => {
    if (typeof value === 'string') targets.push(value.replace(/^\.\//, ''))
    else if (value !== null && typeof value === 'object') for (const child of Object.values(value)) collect(child)
  }
  for (const value of [metadata.main, metadata.module, metadata.types, metadata.typings, metadata.exports, metadata.bin]) collect(value)
  return targets.some(target => target === file || (target.includes('*')
    && new RegExp('^' + target.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(file)))
}

/**
 * All graph/file/target checks finish before copying. The caller owns candidate
 * cleanup if a filesystem write fails; source and lock are never modified.
 * No LLM calls, network requests, dependency installs or lifecycle scripts.
 */
export function materializeBundledLibraries(options: {
  libraryRoot: string; moduleRoot: string; lockFile: string; libraries: Versions
  admit: (file: string, bytes: Buffer) => boolean
}): {packages: PackageReceipt[]} {
  const libraryRoot = fs.realpathSync(options.libraryRoot)
  const moduleRoot = outputRoot(options.moduleRoot)
  if (moduleRoot === libraryRoot || moduleRoot.startsWith(libraryRoot + path.sep)
    || libraryRoot.startsWith(moduleRoot + path.sep)) throw Error('Bundled source and output must not overlap')
  const lock = read<{lockfileVersion?: number; packages?: Record<string, LockEntry>}>(options.lockFile)
  if (lock.lockfileVersion !== 3 || !lock.packages) throw Error('Bundled libraries require an npm v3 package lock')
  const locked = lock.packages
  // npm already depends on semver. Use that CLI's own resolver, matching the
  // publisher's range semantics without adding a public build-tools dependency.
  const semver = createRequire(npmCli())('semver') as Semver
  const planned = new Map<string, PlannedPackage>()
  const lockKey = (source: string) => 'node_modules/' + slash(path.relative(libraryRoot, source))

  const validateLock = (key: string, name: string, range: string): LockEntry => {
    const row = locked[key]
    if (!row || row.link || !row.version || !row.resolved || !row.integrity) {
      throw Error('Missing or non-registry bundled library lock row: ' + key)
    }
    let resolved: URL
    try { resolved = new URL(row.resolved) } catch { throw Error('Invalid bundled library lock source: ' + name) }
    if (resolved.protocol !== 'https:' || resolved.username || resolved.password
      || !/^sha(?:256|384|512)-[A-Za-z0-9+/=]+$/.test(row.integrity)) {
      throw Error('Invalid bundled library lock source: ' + name)
    }
    if (!semver.valid(row.version) || !semver.validRange(range) || !semver.satisfies(row.version, range)) {
      throw Error('Bundled library version differs from lock or requirement: ' + name)
    }
    return row
  }
  const validate = (source: string, name: string, range: string): Metadata => {
    const row = validateLock(lockKey(source), name, range)
    const metadata = read<Metadata>(contained(source, 'package.json'))
    if (metadata.name !== name || metadata.version !== row.version || !semver.valid(metadata.version)
      || !semver.validRange(range) || !semver.satisfies(metadata.version, range)) {
      throw Error('Bundled library version differs from manifest, lock or requirement: ' + name)
    }
    for (const key of ['dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta', 'os', 'cpu'] as const) {
      if (stable(metadata[key] ?? (key === 'os' || key === 'cpu' ? [] : {}))
        !== stable(row[key] ?? (key === 'os' || key === 'cpu' ? [] : {}))) {
        throw Error('Bundled library source metadata differs from lock: ' + name + '.' + key)
      }
    }
    return metadata
  }

  const locations = (owner: string, name: string): string[] => {
    const found: string[] = []
    let directory = owner
    while (directory !== libraryRoot) {
      if (path.basename(directory) !== 'node_modules') {
        found.push(slash(path.relative(libraryRoot, path.join(directory, 'node_modules', name))))
      }
      directory = path.dirname(directory)
      if (directory !== libraryRoot && !directory.startsWith(libraryRoot + path.sep)) {
        throw Error('Bundled dependency resolution escaped source root')
      }
    }
    found.push(name)
    return [...new Set(found)]
  }
  const visit = (source: string, name: string, range: string): void => {
    dependencyName(name)
    const metadata = validate(source, name, range)
    // Validate every incoming constraint even for an already-seen cycle node.
    if (planned.has(source)) return
    const relative = slash(path.relative(libraryRoot, source))
    planned.set(source, {source, relative, metadata, files: []})
    const follow = (dependency: string, requirement: string, kind: 'required' | 'optional' | 'optional-peer') => {
      dependencyName(dependency)
      if (typeof requirement !== 'string' || !semver.validRange(requirement)) {
        throw Error('Unsupported bundled library requirement: ' + name + ' -> ' + dependency)
      }
      const candidates = locations(source, dependency)
      for (const candidate of candidates) {
        const directory = contained(libraryRoot, candidate)
        if (fs.existsSync(directory)) { visit(directory, dependency, requirement); return }
      }
      if (kind === 'optional-peer') return
      const missingKey = candidates.map(candidate => 'node_modules/' + candidate).find(key => locked[key])
      const missing = missingKey ? locked[missingKey] : undefined
      if (kind === 'optional' && missing?.optional === true && excludesPlatform(missing)) {
        validateLock(missingKey!, dependency, requirement)
        return
      }
      throw Error('Missing bundled library dependency: ' + name + ' -> ' + dependency)
    }
    const optional = metadata.optionalDependencies ?? {}
    for (const [dependency, requirement] of Object.entries(metadata.dependencies ?? {})) {
      if (!Object.hasOwn(optional, dependency)) follow(dependency, requirement, 'required')
    }
    for (const [dependency, requirement] of Object.entries(optional)) follow(dependency, requirement, 'optional')
    for (const [dependency, requirement] of Object.entries(metadata.peerDependencies ?? {})) {
      follow(dependency, requirement, metadata.peerDependenciesMeta?.[dependency]?.optional === true ? 'optional-peer' : 'required')
    }
  }
  for (const [name, version] of Object.entries(options.libraries).sort(([a], [b]) => a.localeCompare(b))) {
    dependencyName(name)
    if (semver.valid(version) !== version) throw Error('Bundled root library must have an exact version: ' + name)
    visit(contained(libraryRoot, name), name, version)
  }

  const bundledChild = (owner: PlannedPackage, file: string) => {
    const parts = file.split('/')
    let cursor = owner.source
    let offset = 0
    while (parts[offset] === 'node_modules') {
      offset += 1
      const first = parts[offset++]
      if (!first) throw Error('Invalid npm bundled child path: ' + file)
      const name = first.startsWith('@') ? first + '/' + parts[offset++] : first
      dependencyName(name)
      const found = locations(cursor, name).map(candidate => contained(libraryRoot, candidate))
        .find(candidate => fs.existsSync(candidate))
      if (!found || !planned.has(found)) {
        throw Error('npm bundled child is outside the locked runtime closure: ' + owner.relative + '/' + file)
      }
      cursor = found
    }
    const childFile = relativeFile(parts.slice(offset).join('/'))
    if (!fs.lstatSync(contained(cursor, childFile), {throwIfNoEntry: false})?.isFile()) {
      throw Error('npm bundled child file differs from source placement: ' + file)
    }
    // This child's own npm file list and admission gate generate its separate
    // receipt. Never count the same nested bytes in the parent's file list.
  }

  const temporary = createTestDirectory('bundled-library-pack-')
  try {
    fs.writeFileSync(path.join(temporary, 'empty.npmrc'), '')
    for (const item of planned.values()) {
      for (const file of publishedFiles(item.source, temporary)) {
        if (file.startsWith('node_modules/')) { bundledChild(item, file); continue }
        const from = contained(item.source, file)
        if (!fs.lstatSync(from).isFile()) throw Error('Bundled published file is not regular: ' + item.relative + '/' + file)
        const bytes = fs.readFileSync(from)
        if (!options.admit(file, bytes)) {
          if (file === 'package.json' || LICENSE.test(path.posix.basename(file)) || declaredEntry(item.metadata, file)) {
            throw Error('Bundled mandatory file rejected: ' + item.relative + '/' + file)
          }
          continue
        }
        item.files.push({path: file, bytes, sha256: digest(bytes)})
      }
      if (!item.files.some(file => file.path === 'package.json')) throw Error('Bundled package metadata was not published: ' + item.relative)
      const target = contained(moduleRoot, item.relative)
      for (const file of item.files) {
        const destination = contained(target, file.path)
        if (fs.existsSync(destination) && (!fs.lstatSync(destination).isFile()
          || !fs.readFileSync(destination).equals(file.bytes))) throw Error('Bundled library output conflict: ' + item.relative + '/' + file.path)
      }
    }
    for (const item of planned.values()) {
      const target = contained(moduleRoot, item.relative)
      for (const file of item.files) {
        const destination = contained(target, file.path)
        fs.mkdirSync(path.dirname(destination), {recursive: true})
        fs.writeFileSync(destination, file.bytes)
      }
    }
    return {packages: [...planned.values()].sort((a, b) => a.relative.localeCompare(b.relative)).map(item => ({
      name: item.metadata.name, version: item.metadata.version, path: item.relative,
      files: item.files.map(({path: file, sha256}) => ({path: file, sha256})),
    }))}
  } finally { cleanupTestDirectory(temporary) }
}
