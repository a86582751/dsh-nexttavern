/** Prepare immutable owned package generations and profile references, without running pnpm. */
import fs from 'node:fs'
import path from 'node:path'
import {applyTransaction, contained, digest, recoverInterruptedTransaction, type TransactionFile} from './public-transaction.mjs'

const transactionPurpose = 'prepare-protected-package-references'

export interface ProtectedFile {path: string; sha256: string}
export interface ProtectedPackageInput {
  name: string
  version: string
  source: string
  files: ProtectedFile[]
}
interface ProtectedPackageRecord {
  name: string
  version: string
  files: ProtectedFile[]
  directory: string
  reference: string
}
interface ProtectedReceipt {
  schemaVersion: 1
  state: 'references-prepared'
  profile: string
  packages: ProtectedPackageRecord[]
}
interface ProfileManifest {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  [key: string]: unknown
}

function inventory(root: string, prefix = ''): string[] {
  return fs.readdirSync(root, {withFileTypes: true}).flatMap(entry => {
    const relative = prefix + entry.name
    if (entry.isSymbolicLink()) throw Error('Protected package contains a link: ' + relative)
    if (entry.isDirectory()) return inventory(path.join(root, entry.name), relative + '/')
    if (!entry.isFile()) throw Error('Protected package contains a special file: ' + relative)
    return [relative]
  }).sort()
}

function normalizedFiles(files: ProtectedFile[]): ProtectedFile[] {
  if (!Array.isArray(files) || !files.length) throw Error('Protected package inventory is empty')
  const seen = new Set<string>()
  return files.map(file => {
    if (!file || typeof file.path !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw Error('Invalid protected package inventory member')
    }
    if (file.path.split('/').some(part => /[<>:"\\|?*\u0000-\u001f]|[. ]$/.test(part)
      || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
      throw Error('Protected path is not portable: ' + file.path)
    }
    // Windows treats these names as aliases even when the source was built on Linux.
    const identity = file.path.toLowerCase()
    if (seen.has(identity)) throw Error('Duplicate protected package path: ' + file.path)
    seen.add(identity)
    return {path: file.path, sha256: file.sha256}
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}

function recordFor(home: string, profile: string, input: Pick<ProtectedPackageInput, 'name' | 'version' | 'files'>): ProtectedPackageRecord {
  if (!/^dsh-nexttavern-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.name)) throw Error('Only independently named NextTavern child packages may be protected')
  if (typeof input.version !== 'string' || !input.version) throw Error('Protected package version is required')
  const files = normalizedFiles(input.files)
  for (const file of files) contained(home, file.path)
  if (!files.some(file => file.path === 'package.json')) throw Error('Protected inventory must include package.json')
  const generation = digest(JSON.stringify({name: input.name, version: input.version, files}))
  const directory = `maintenance/fixed-packages/${input.name}/${generation}`
  const reference = 'file:' + path.relative(contained(home, `profiles/${profile}`), contained(home, directory)).replaceAll('\\', '/')
  return {name: input.name, version: input.version, files, directory, reference}
}

/** The same inventory gate protects a runtime bundle and its later durable copy. */
export function verifyProtectedPackage(root: string, record: Pick<ProtectedPackageRecord, 'name' | 'version' | 'files'>): void {
  normalizedFiles(record.files)
  const actual = inventory(root)
  const expected = record.files.map(file => file.path).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('Protected package file inventory differs: ' + record.name)
  for (const file of record.files) {
    if (digest(fs.readFileSync(contained(root, file.path))) !== file.sha256) throw Error('Protected package hash differs: ' + record.name + '/' + file.path)
  }
  const metadata = JSON.parse(fs.readFileSync(contained(root, 'package.json'), 'utf8'))
  if (metadata.name !== record.name || metadata.version !== record.version) throw Error('Protected package identity differs from receipt')
}

function dependencyMap(value: unknown, field: string): Record<string, string> {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.values(value).some(item => typeof item !== 'string')) throw Error('Invalid profile ' + field)
  return {...value as Record<string, string>}
}

function assertNoResolutionOverride(manifest: ProfileManifest, names: Set<string>) {
  if (manifest.pnpm === undefined) return
  const pnpm = manifest.pnpm as Record<string, unknown>
  if (!pnpm || typeof pnpm !== 'object' || Array.isArray(pnpm)) throw Error('Invalid profile pnpm configuration')
  for (const field of ['overrides', 'patchedDependencies']) {
    const entries = pnpm[field]
    if (entries === undefined) continue
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw Error('Invalid profile pnpm.' + field)
    for (const selector of Object.keys(entries)) {
      for (const name of names) {
        if (new RegExp('(^|>)\\s*' + name + '(?:@|\\s*$)').test(selector)) {
          throw Error('Protected package conflicts with pnpm.' + field + ': ' + selector)
        }
      }
    }
  }
}

/**
 * Plan one metadata transaction. Source inventories come from release assembly,
 * not from a fresh trust-on-first-use hash of an installed upstream package.
 * No existing generation is edited or deleted, including on downgrade/remove.
 */
export function planProtectedPackages(options: {home: string; profile: string; packages: ProtectedPackageInput[]}) {
  const home = fs.realpathSync(options.home)
  const {profile} = options
  if (!/^[a-zA-Z0-9_-]+$/.test(profile)) throw Error('Invalid profile name')
  const manifestPath = `profiles/${profile}/package.json`
  const receiptPath = `profiles/${profile}/.nexttavern-protected-packages.json`
  const manifestBytes = fs.readFileSync(contained(home, manifestPath))
  const manifest = JSON.parse(manifestBytes.toString()) as ProfileManifest
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw Error('Invalid profile manifest')
  const dependencies = dependencyMap(manifest.dependencies, 'dependencies')
  const otherDependencies = ['devDependencies', 'optionalDependencies', 'peerDependencies'].map(field =>
    dependencyMap(manifest[field], field))
  const receiptFile = contained(home, receiptPath)
  const receiptBytes = fs.existsSync(receiptFile) ? fs.readFileSync(receiptFile) : null
  let previous: ProtectedPackageRecord[] = []
  if (receiptBytes) {
    const prior = JSON.parse(receiptBytes.toString()) as ProtectedReceipt
    if (prior.schemaVersion !== 1 || prior.profile !== profile || prior.state !== 'references-prepared' || !Array.isArray(prior.packages)) {
      throw Error('Unsupported protected package receipt')
    }
    const seen = new Set<string>()
    previous = prior.packages.map(item => {
      const canonical = recordFor(home, profile, item)
      if (seen.has(item.name) || canonical.directory !== item.directory || canonical.reference !== item.reference) {
        throw Error('Invalid protected package ownership receipt')
      }
      seen.add(item.name)
      if (dependencies[item.name] !== item.reference || otherDependencies.some(map => Object.hasOwn(map, item.name))) {
        throw Error('Protected profile reference changed: ' + item.name)
      }
      verifyProtectedPackage(contained(home, item.directory), canonical)
      return canonical
    })
  }
  const previousNames = new Set(previous.map(item => item.name))
  assertNoResolutionOverride(manifest, new Set([...previousNames, ...options.packages.map(item => item.name)]))
  const nextNames = new Set<string>()
  const changes: TransactionFile[] = []
  const reused = new Map(previous.map(record => [record.directory, record]))
  const emptyGenerations: string[] = []
  const next = options.packages.map(input => {
    const record = recordFor(home, profile, input)
    if (nextNames.has(record.name)) throw Error('Duplicate protected package: ' + record.name)
    nextNames.add(record.name)
    if (otherDependencies.some(map => Object.hasOwn(map, record.name))
      || (Object.hasOwn(dependencies, record.name) && !previousNames.has(record.name))) {
      throw Error('Existing profile dependency is not owned by this installer: ' + record.name)
    }
    const source = fs.realpathSync(input.source)
    verifyProtectedPackage(source, record)
    const target = contained(home, record.directory)
    const existing = fs.existsSync(target) ? inventory(target) : []
    if (existing.length) {
      verifyProtectedPackage(target, record)
      reused.set(record.directory, record)
    }
    else {
      emptyGenerations.push(record.directory)
      // File-level rollback deliberately retains directories. An empty failed
      // generation can be retried; any nonempty unknown generation must verify.
      for (const file of record.files) {
        const bytes = fs.readFileSync(contained(source, file.path))
        // The input can change between audit and capture. Only the exact
        // release bytes may enter the transactional write set.
        if (digest(bytes) !== file.sha256) throw Error('Protected source changed during planning')
        changes.push({path: record.directory + '/' + file.path, before: null, bytes})
      }
    }
    dependencies[record.name] = record.reference
    return record
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  for (const record of previous) if (!nextNames.has(record.name)) delete dependencies[record.name]
  manifest.dependencies = dependencies
  const receipt: ProtectedReceipt = {schemaVersion: 1, state: 'references-prepared', profile, packages: next}
  const updates = [
    {path: manifestPath, before: digest(manifestBytes), bytes: Buffer.from(JSON.stringify(manifest, null, 2) + '\n')},
    {path: receiptPath, before: receiptBytes ? digest(receiptBytes) : null, bytes: Buffer.from(JSON.stringify(receipt, null, 2) + '\n')},
  ]
  changes.push(...updates.filter(file => digest(file.bytes) !== file.before))
  const assertUnchanged = () => {
    // Reused generations are read-only dependencies, not transactional writes.
    // Verify them and both metadata preimages again after acquiring the lock.
    for (const record of reused.values()) verifyProtectedPackage(contained(home, record.directory), record)
    for (const directory of emptyGenerations) {
      const target = contained(home, directory)
      if (fs.existsSync(target) && inventory(target).length) throw Error('Protected generation changed since planning: ' + directory)
    }
    for (const update of updates) {
      const target = contained(home, update.path)
      const current = fs.existsSync(target) ? digest(fs.readFileSync(target)) : null
      if (current !== update.before) throw Error('Protected metadata changed since planning: ' + update.path)
    }
  }
  return {home, profile, changes, receipt, assertUnchanged, requiresRelink: true as const}
}

/** Explicit crash recovery before replanning; a live home owner is never stopped. */
export function recoverProtectedPackages(home: string) {
  return recoverInterruptedTransaction(home, transactionPurpose)
}

/**
 * This is the preparation boundary, not an installation-success signal.
 * The caller must relink and verify the package-manager graph before activation;
 * graph rollback after pnpm mutations is a separate caller-owned transaction.
 */
export function prepareProtectedPackages(options: {
  home: string; profile: string; packages: ProtectedPackageInput[]; backup: string
}) {
  if (fs.existsSync(contained(options.home, '.nexttavern-transaction.lock'))) {
    throw Error('Pending home transaction; run recoverProtectedPackages before preparing references')
  }
  const plan = planProtectedPackages(options)
  const transaction = plan.changes.length ? applyTransaction({root: plan.home, backup: options.backup,
    files: plan.changes, purpose: transactionPurpose, assertUnchanged: plan.assertUnchanged}) : null
  return {state: 'references-prepared' as const, requiresRelink: true as const, receipt: plan.receipt, transaction}
}
