/** Prepare immutable owned package generations and profile references, without running pnpm. */
import fs from 'node:fs'
import path from 'node:path'
import {applyTransaction, contained, digest, recoverInterruptedTransaction, type TransactionFile} from './public-transaction.mjs'

const transactionPurpose = 'prepare-protected-package-references'
const receiptName = '.nexttavern-protected-packages.json'

export interface ProtectedFile {path: string; sha256: string}
export interface ProtectedPackageInput {
  name: string
  version: string
  source: string
  files: ProtectedFile[]
  /**
   * An owned bundle is the product's optional activation layer: its own
   * `dsh.bundle.patch` contributes a loader entry, so the profile must also
   * list it in `dsh.profile.bundles` or that patch layer never composes.
   * Compatibility packages have no activation layer and never appear there.
   */
  bundle?: true
}
/**
 * One source tree a caller already admitted with this module's own gate.
 *
 * `generation` is the identity of the exact record a transaction would write,
 * so a stale or different inventory cannot be paired with a verified tree: any
 * other record falls back to verifying here, inside the same writer lock.
 */
export interface VerifiedProtectedSource {source: string; generation: string}
export interface ProtectedPackageRecord {
  name: string
  version: string
  files: ProtectedFile[]
  directory: string
  reference: string
  bundle?: true
}
/**
 * One durable reference as a receipt records it, with the generation its bytes
 * name. The receipt is the only place that records an owned package's own
 * version, because the shipped product versions its children independently.
 */
export type PreparedReference = ProtectedPackageRecord & {generation: string}
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

/**
 * Identity of one protected generation. Every byte that reaches a durable
 * directory is named by this digest, so equal generations are interchangeable
 * and a verification of one cannot stand in for another.
 */
export function protectedGeneration(input: Pick<ProtectedPackageInput, 'name' | 'version' | 'files'>): string {
  return generationOf(input, normalizedFiles(input.files))
}

const generationOf = (input: Pick<ProtectedPackageInput, 'name' | 'version'>, files: ProtectedFile[]) =>
  digest(JSON.stringify({name: input.name, version: input.version, files}))

function recordFor(home: string, profile: string,
  input: Pick<ProtectedPackageInput, 'name' | 'version' | 'files' | 'bundle'>, source?: string): ProtectedPackageRecord {
  if (!/^dsh-nexttavern-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.name)) throw Error('Only independently named NextTavern child packages may be protected')
  if (typeof input.version !== 'string' || !input.version) throw Error('Protected package version is required')
  const files = normalizedFiles(input.files)
  for (const file of files) contained(home, file.path)
  if (!files.some(file => file.path === 'package.json')) throw Error('Protected inventory must include package.json')
  if (input.bundle === true && source !== undefined) assertBundleActivationLayer(source, input.name)
  const generation = generationOf(input, files)
  const directory = `maintenance/fixed-packages/${input.name}/${generation}`
  const reference = 'file:' + path.relative(contained(home, `profiles/${profile}`), contained(home, directory)).replaceAll('\\', '/')
  return input.bundle === true
    ? {name: input.name, version: input.version, files, directory, reference, bundle: true}
    : {name: input.name, version: input.version, files, directory, reference}
}

/**
 * An owned bundle is only useful with its activation layer, so a record that
 * claims to be one must carry a patch file this tree actually contains. The
 * compatibility packages take the opposite gate in the bundle admission, which
 * rejects any `dsh.bundle` declaration.
 */
function assertBundleActivationLayer(source: string, name: string): void {
  const metadata = JSON.parse(fs.readFileSync(contained(source, 'package.json'), 'utf8')) as
    {dsh?: {bundle?: {patch?: unknown}}}
  const patch = metadata.dsh?.bundle?.patch
  if (typeof patch !== 'string' || patch === '') throw Error('Owned bundle has no activation layer: ' + name)
  // The manifest names the patch the way DSH reads it (`./cordis.patch.yml`),
  // and the containment gate rejects a leading `./`, so normalise first.
  const relative = patch.replace(/^\.\//, '')
  if (!fs.existsSync(contained(source, relative))) throw Error('Owned bundle patch file is missing: ' + name)
}

/**
 * The profile's own bundle roster, in its existing order. Only entries this
 * installer owns are edited: the product's compatibility packages have no
 * activation layer, and a third-party bundle a person installed is never
 * reordered or removed.
 */
function profileBundles(manifest: ProfileManifest): string[] {
  const dsh = manifest.dsh
  if (dsh === undefined) return []
  if (!dsh || typeof dsh !== 'object' || Array.isArray(dsh)) throw Error('Invalid profile dsh section')
  const profile = (dsh as Record<string, unknown>).profile
  if (profile === undefined) return []
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw Error('Invalid profile dsh.profile section')
  const bundles = (profile as Record<string, unknown>).bundles
  if (bundles === undefined) return []
  if (!Array.isArray(bundles) || bundles.some(name => typeof name !== 'string' || name === '')) {
    throw Error('Invalid profile dsh.profile.bundles')
  }
  return [...bundles as string[]]
}

function setProfileBundles(manifest: ProfileManifest, bundles: string[]): void {
  const dsh = manifest.dsh === undefined || manifest.dsh === null || typeof manifest.dsh !== 'object'
    || Array.isArray(manifest.dsh) ? {} : {...manifest.dsh as Record<string, unknown>}
  const profile = dsh.profile === undefined || dsh.profile === null || typeof dsh.profile !== 'object'
    || Array.isArray(dsh.profile) ? {} : {...dsh.profile as Record<string, unknown>}
  profile.bundles = bundles
  dsh.profile = profile
  manifest.dsh = dsh
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

/**
 * The durable references one profile's own receipt records, canonicalised, or
 * null when no usable receipt exists.
 *
 * This is the cheap read a caller uses to decide whether the locked
 * transaction is needed at all, so it never reads a member's bytes: the name,
 * the version, the generation those bytes must name and the reference that
 * follows from them are all pure functions of the receipt. A receipt that is
 * missing, foreign or not canonical returns null, which leaves the decision to
 * the locked transaction instead of to this read.
 */
export function readPreparedReferences(home: string, profile: string): Map<string, PreparedReference> | null {
  try {
    const root = fs.realpathSync(home)
    const receipt = JSON.parse(fs.readFileSync(
      contained(root, `profiles/${profile}/${receiptName}`), 'utf8')) as ProtectedReceipt
    if (receipt?.schemaVersion !== 1 || receipt.profile !== profile
      || receipt.state !== 'references-prepared' || !Array.isArray(receipt.packages)) return null
    const recorded = new Map<string, PreparedReference>()
    for (const item of receipt.packages) {
      const record = recordFor(root, profile, item)
      if (recorded.has(record.name)) return null
      recorded.set(record.name, {...record, generation: generationOf(record, record.files)})
    }
    return recorded
  } catch {
    return null
  }
}

/**
 * Whether one profile still carries exactly these durable references.
 *
 * The structural half of the locked transaction's own admission, for a caller
 * that must decide whether that transaction is needed: the profile's own
 * `dependencies` name every recorded reference and no other dependency map
 * claims one of those names, no pnpm override shadows them, and each generation
 * directory still holds the identity and the file set its name promises. No
 * member's bytes are read here - only the locked transaction verifies those and
 * only it may write - so a mismatch means "run the round", never "repair".
 */
export function durableReferencesIntact(home: string, profile: string, references: Iterable<PreparedReference>): boolean {
  try {
    const root = fs.realpathSync(home)
    const manifest = JSON.parse(fs.readFileSync(
      contained(root, `profiles/${profile}/package.json`), 'utf8')) as ProfileManifest
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return false
    const dependencies = dependencyMap(manifest.dependencies, 'dependencies')
    const others = ['devDependencies', 'optionalDependencies', 'peerDependencies']
      .map(field => dependencyMap(manifest[field], field))
    const roster = new Set(profileBundles(manifest))
    const names = new Set<string>()
    for (const reference of references) {
      if (dependencies[reference.name] !== reference.reference) return false
      if (others.some(map => Object.hasOwn(map, reference.name))) return false
      names.add(reference.name)
      // An owned bundle is only composed when the roster still lists it, so a
      // profile that dropped the name needs the locked transaction, not a
      // fast path that would leave its activation layer silently missing.
      if (reference.bundle === true && !roster.has(reference.name)) return false
      const directory = contained(root, reference.directory)
      const metadata = JSON.parse(fs.readFileSync(
        contained(directory, 'package.json'), 'utf8')) as
        {name?: unknown; version?: unknown; dsh?: {bundle?: {patch?: unknown}}}
      if (metadata?.name !== reference.name || metadata.version !== reference.version) return false
      if (reference.bundle === true
        && (typeof metadata.dsh?.bundle?.patch !== 'string' || metadata.dsh.bundle.patch === '')) return false
      if (JSON.stringify(inventory(directory)) !== JSON.stringify(reference.files.map(file => file.path).sort())) {
        return false
      }
    }
    assertNoResolutionOverride(manifest, names)
    return true
  } catch {
    return false
  }
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
export function planProtectedPackages(options: {home: string; profile: string; packages: ProtectedPackageInput[]
  verifiedSources?: readonly VerifiedProtectedSource[]}) {
  const home = fs.realpathSync(options.home)
  const {profile} = options
  if (!/^[a-zA-Z0-9_-]+$/.test(profile)) throw Error('Invalid profile name')
  // A caller that admitted these exact generations against these exact trees
  // while holding the same writer lock has already paid for the read; asking
  // for it twice per preparation is what a product-sized bundle cannot afford.
  const admitted = new Map((options.verifiedSources ?? []).map(entry => [entry.generation, entry.source]))
  const manifestPath = `profiles/${profile}/package.json`
  const receiptPath = `profiles/${profile}/${receiptName}`
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
      if (canonical.bundle === true) assertBundleActivationLayer(contained(home, item.directory), item.name)
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
    const record = recordFor(home, profile, input, input.source)
    if (nextNames.has(record.name)) throw Error('Duplicate protected package: ' + record.name)
    nextNames.add(record.name)
    if (otherDependencies.some(map => Object.hasOwn(map, record.name))
      || (Object.hasOwn(dependencies, record.name) && !previousNames.has(record.name))) {
      throw Error('Existing profile dependency is not owned by this installer: ' + record.name)
    }
    const source = fs.realpathSync(input.source)
    if (admitted.get(generationOf(record, record.files)) !== source) verifyProtectedPackage(source, record)
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
  // The installer owns the activation layer of the bundles it ships: a name
  // the profile lost is restored, and a name it no longer ships is dropped.
  // Every entry a person or another installer added keeps its own position.
  const ownedBundles = next.filter(record => record.bundle === true).map(record => record.name)
  const previouslyOwned = new Set(previous.filter(record => record.bundle === true).map(record => record.name))
  const roster = profileBundles(manifest)
  const merged = roster.filter(name => !previouslyOwned.has(name) || ownedBundles.includes(name))
  for (const name of ownedBundles) if (!merged.includes(name)) merged.push(name)
  if (JSON.stringify(merged) !== JSON.stringify(roster)) setProfileBundles(manifest, merged)
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
  verifiedSources?: readonly VerifiedProtectedSource[]
}) {
  if (fs.existsSync(contained(options.home, '.nexttavern-transaction.lock'))) {
    throw Error('Pending home transaction; run recoverProtectedPackages before preparing references')
  }
  const plan = planProtectedPackages(options)
  const transaction = plan.changes.length ? applyTransaction({root: plan.home, backup: options.backup,
    files: plan.changes, purpose: transactionPurpose, assertUnchanged: plan.assertUnchanged}) : null
  return {state: 'references-prepared' as const, requiresRelink: true as const, receipt: plan.receipt, transaction}
}
