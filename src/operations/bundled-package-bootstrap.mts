/** Verify the installed product's private dependencies before preparing durable pins. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire, findPackageJSON} from 'node:module'
import {pathToFileURL} from 'node:url'
import {withFileLock} from '@deepseek-ai/dsh-atomic-write'
import {contained} from './public-transaction.mjs'
import {prepareProtectedPackages, protectedGeneration, recoverProtectedPackages, verifyProtectedPackage,
  type ProtectedFile, type VerifiedProtectedSource} from './protected-packages.mjs'

export interface BundledPackageSpec {
  name: string
  version: string
  files: ProtectedFile[]
}
/**
 * One optional activation layer the product ships, as release assembly
 * inventoried it. A bundle is not a compatibility package: it carries its own
 * `dsh.bundle.patch`, so it belongs in the profile's bundle roster and its
 * bytes travel under the same inventory gate as every other member.
 */
export interface BundledBundleSpec extends BundledPackageSpec {
  /** Package-root relative directory the shipped tree lives in. */
  path: string
}
interface BundleInventory {
  schemaVersion: 1
  productVersion: string
  packages: BundledPackageSpec[]
  bundles?: BundledBundleSpec[]
}
interface PackageMetadata {
  name: string
  version: string
  dependencies?: Record<string, string>
  bundleDependencies?: string[]
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, {optional?: boolean}>
  dsh?: {bundle?: {patch?: unknown}; client?: unknown}
}
const readJson = <T,>(file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as T
export type PeerManifestResolver = (name: string, parentURL: string) => string | undefined

/**
 * Whether a bootstrap failure was the host's own profile writer lock still
 * being held. `withFileLock` names exactly this condition, and the caller that
 * can retry later distinguishes it from a real verification or write failure
 * instead of reporting a busy profile as a broken install.
 */
export function isWriterLockBusy(error: unknown): boolean {
  return error instanceof Error && error.message.includes('timed out waiting for the writer lock')
}

function peerPackage(anchor: string, name: string, optional: boolean, resolveManifest?: PeerManifestResolver): string | null {
  try {
    // Some host peers expose only subpaths (node-addon-system/flock), or only
    // ESM conditions. Their package owner is the identity boundary; requiring
    // a nonexistent CJS root export would reject an otherwise valid graph.
    // Node's findPackageJSON ignores module hooks. A running profile must use
    // the host's package owner service, just like its actual module imports.
    // Plain on-disk graphs (offline admission) retain the physical lookup.
    const metadata = resolveManifest ? resolveManifest(name, pathToFileURL(anchor).href)
      : findPackageJSON(name, pathToFileURL(anchor))
    if (!metadata && optional) return null
    if (!metadata) throw Error('No package metadata for peer: ' + name)
    return fs.realpathSync(metadata)
  } catch (error) {
    if (optional && ['MODULE_NOT_FOUND','ERR_MODULE_NOT_FOUND'].includes((error as NodeJS.ErrnoException).code ?? '')) return null
    throw error
  }
}

function verifyPeers(metadataPath: string, metadata: PackageMetadata, hostAnchor: string,
  productAnchor: string, ownedNames: ReadonlySet<string>, resolveManifest?: PeerManifestResolver) {
  for (const peer of Object.keys(metadata.peerDependencies ?? {})) {
    const optional = metadata.peerDependenciesMeta?.[peer]?.optional === true
    // Compatibility peers share the product's private owner even before profile
    // relink; host services must still resolve to the host's exact singleton.
    const owned = peer.startsWith('dsh-nexttavern-')
    if (owned && !ownedNames.has(peer)) throw Error('Uninventoried owned peer: ' + peer)
    // Every non-owned peer is a host service, so it must come from the harness
    // namespace. A third-party library declared as a host peer resolves only
    // when the harness happens to depend on it, which ships a product that
    // cannot start on a profile the harness does not sit above.
    if (!owned && !peer.startsWith('@deepseek-ai/')) {
      throw Error('Third-party peer is not a host service; declare it as a bundle dependency: '
        + metadata.name + ' -> ' + peer)
    }
    const reference = owned ? productAnchor : hostAnchor
    if (peerPackage(metadataPath, peer, optional, resolveManifest) !== peerPackage(reference, peer, optional, resolveManifest)) {
      throw Error('Compatibility dependency uses a different host peer: ' + metadata.name + ' -> ' + peer)
    }
  }
}

/**
 * Structural identity of an installed product bundle: its manifest, the
 * inventory release assembly emitted, and the exact owned names.
 *
 * Nothing here hashes a member or resolves a peer, so a caller can decide from
 * identity alone whether durable references are already current. Byte
 * admission stays where it is charged, once per locked preparation round.
 */
export function readBundleIdentity(productRoot: string) {
  productRoot = fs.realpathSync(productRoot)
  const rootManifest = contained(productRoot, 'package.json')
  const product = readJson<PackageMetadata>(rootManifest)
  const inventory = readJson<BundleInventory>(contained(productRoot, 'nexttavern.dependencies.json'))
  if (product.name !== 'dsh-nexttavern' || typeof product.version !== 'string' || !product.version.trim()
    || inventory.schemaVersion !== 1 || typeof inventory.productVersion !== 'string'
    || inventory.productVersion !== product.version || !Array.isArray(inventory.packages)) {
    throw Error('Bundled dependency inventory does not match this NextTavern version')
  }
  const bundledNames = (product.bundleDependencies ?? []).filter(name => name.startsWith('dsh-nexttavern-')).sort()
  const declaredNames = Object.keys(product.dependencies ?? {}).filter(name => name.startsWith('dsh-nexttavern-')).sort()
  const inventoriedNames = inventory.packages.map(spec => spec.name).sort()
  if (JSON.stringify(bundledNames) !== JSON.stringify(inventoriedNames)
    || JSON.stringify(declaredNames) !== JSON.stringify(inventoriedNames)) {
    throw Error('Bundled compatibility inventory is incomplete')
  }
  const seen = new Set<string>()
  const packages = inventory.packages.map(spec => {
    if (typeof spec.name !== 'string' || !/^dsh-nexttavern-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.name)
      || seen.has(spec.name) || typeof spec.version !== 'string' || !spec.version.trim() || !Array.isArray(spec.files)) {
      throw Error('Invalid or duplicate bundled compatibility identity')
    }
    seen.add(spec.name)
    if (!Array.isArray(product.bundleDependencies) || !product.bundleDependencies.includes(spec.name)
      || product.dependencies?.[spec.name] !== spec.version) {
      throw Error('Compatibility dependency is not exactly pinned and bundled: ' + spec.name)
    }
    // Owned packages carry their own versions, so the generation - not the
    // product version - is what says whether a durable copy still describes
    // these bytes. It is derived in memory from the inventory alone.
    return {name: spec.name, version: spec.version, files: spec.files,
      generation: protectedGeneration({name: spec.name, version: spec.version, files: spec.files})}
  })
  // Bundles ship beside their consumers instead of inside `node_modules`, so
  // they carry their own package-root relative directory and reuse the same
  // inventory gate: the profile later pins these exact bytes and lists the
  // name in its own bundle roster.
  const bundles = (inventory.bundles ?? []).map(spec => {
    if (typeof spec.name !== 'string' || !/^dsh-nexttavern-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.name)
      || seen.has(spec.name) || typeof spec.version !== 'string' || !spec.version.trim()
      || typeof spec.path !== 'string' || spec.path === '' || path.isAbsolute(spec.path)
      || spec.path.includes('\\') || !Array.isArray(spec.files)) {
      throw Error('Invalid or duplicate bundled activation layer')
    }
    seen.add(spec.name)
    const source = contained(productRoot, spec.path)
    if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
      throw Error('Bundled activation layer is missing: ' + spec.name)
    }
    return {name: spec.name, version: spec.version, files: spec.files, path: spec.path, source,
      generation: protectedGeneration({name: spec.name, version: spec.version, files: spec.files}),
      bundle: true as const}
  })
  return {productRoot, rootManifest, metadata: product, version: product.version, packages, bundles}
}

/**
 * The inventory is emitted by release assembly, never computed by trusting an
 * arbitrary installed package. Returned modules remain inside the root bundle:
 * pinning a future profile resolution must not switch a running process's graph.
 */
export function inspectBundledPackages(productRoot: string, hostAnchor: string, resolveManifest?: PeerManifestResolver) {
  const identity = readBundleIdentity(productRoot)
  const hostManifest = fs.realpathSync(hostAnchor)
  const ownedNames = new Set(identity.packages.map(spec => spec.name))
  verifyPeers(identity.rootManifest, identity.metadata, hostManifest, identity.rootManifest, ownedNames, resolveManifest)
  const productResolver = createRequire(identity.rootManifest)
  const packages = identity.packages.map(spec => {
    const source = fs.realpathSync(contained(identity.productRoot, 'node_modules/' + spec.name))
    const metadataPath = fs.realpathSync(productResolver.resolve(spec.name + '/package.json'))
    if (metadataPath !== path.join(source, 'package.json')) throw Error('Compatibility package escaped its product bundle')
    const metadata = readJson<PackageMetadata>(metadataPath)
    if (metadata.name !== spec.name || metadata.version !== spec.version || metadata.dsh?.bundle !== undefined) {
      throw Error('Bundled compatibility identity or activation layer differs: ' + spec.name)
    }
    // Startup may inspect the private bundle while manager holds its writer
    // lock. Verify bytes here without profile writes or waiting for that lock;
    // durable pin preparation remains a separate, explicitly locked operation.
    verifyProtectedPackage(source, spec)
    const entry = fs.realpathSync(productResolver.resolve(spec.name))
    const relativeEntry = path.relative(source, entry).replaceAll('\\', '/')
    if (contained(source, relativeEntry) !== entry) throw Error('Compatibility entry escaped its bundle')
    verifyPeers(metadataPath, metadata, hostManifest, identity.rootManifest, ownedNames, resolveManifest)
    // The generation names exactly these bytes, so the transaction that may
    // write them can reuse this verification instead of reading the tree again.
    // A package without an activation layer that declares `dsh.client` is a
    // browser half: this product's own Loader row mounts it, and no manager may
    // mount a second one. Admission is where that is knowable, because the
    // identity-only read that decides whether a round is needed must not read
    // these bytes at all - the profile receipt carries the claim instead.
    return {...spec, source, entry, ...(metadata.dsh?.client === undefined ? {} : {client: true as const})}
  })
  // The activation layers take the opposite side of the compatibility gate:
  // a compatibility package that declared `dsh.bundle` was already rejected,
  // and a shipped bundle without one could never compose a loader entry.
  const bundles = identity.bundles.map(spec => {
    const source = fs.realpathSync(spec.source)
    const metadata = readJson<PackageMetadata>(path.join(source, 'package.json'))
    if (metadata.name !== spec.name || metadata.version !== spec.version
      || typeof metadata.dsh?.bundle?.patch !== 'string' || metadata.dsh.bundle.patch === '') {
      throw Error('Bundled activation layer identity differs: ' + spec.name)
    }
    verifyProtectedPackage(source, spec)
    return {...spec, source}
  })
  return {productRoot: identity.productRoot, version: identity.version, packages, bundles}
}

/**
 * Reclaim one writer lock whose recorded owner is gone.
 *
 * `withFileLock` never removes a lock, because file age cannot prove that its
 * owner stopped. A host killed mid-transaction leaves exactly such a lock, and
 * without this the profile stays permanently busy for every later product
 * start. Only a lock naming a process that no longer exists is reclaimed, and
 * only after a normal acquisition already failed, so a live writer is never
 * interrupted. `recoverProtectedPackages` then rolls back that owner's
 * interrupted transaction under the writer lock this reclaim just took.
 */
function reclaimOrphanedLock(lockPath: string): boolean {
  let owner: number
  try {
    owner = Number.parseInt(fs.readFileSync(lockPath, 'utf8').trim(), 10)
  } catch {
    return false
  }
  if (!Number.isSafeInteger(owner) || owner <= 0 || owner === process.pid) return false
  try {
    // Signal 0 asks whether the process exists without touching it.
    process.kill(owner, 0)
    return false
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return false
  }
  fs.rmSync(lockPath, {force: true})
  return true
}

/**
 * Bootstrap never runs pnpm inside the loading host. Private bundled modules
 * are usable now; profile file: references take effect on a later package-manager
 * operation. That distinction is preserved in the result, not hidden as success.
 *
 * `lockWaitMs` must exceed the host lock hold this caller can overlap. The
 * default suits an uncontended hand-off; a scheduler that runs beside the
 * official manager's own pnpm transaction states its own bound instead of
 * failing on the manager's lock window.
 */
export async function bootstrapBundledPackages(options: {
  productRoot: string; hostAnchor: string; home: string; profile: string; backup: string
  resolvePeerManifest?: PeerManifestResolver
  lockWaitMs?: number
}) {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.profile)) throw Error('Invalid profile name')
  const manifest = contained(fs.realpathSync(options.home), `profiles/${options.profile}/package.json`)
  const run = () => withFileLock(manifest, async () => {
    const bundle = inspectBundledPackages(options.productRoot, options.hostAnchor, options.resolvePeerManifest)
    const recovered = recoverProtectedPackages(options.home)
    // This round's own admission is the verification the write plan reuses:
    // both run inside the same writer lock, so the plan never re-reads a tree
    // this call just hashed.
    const members = [...bundle.packages, ...bundle.bundles]
    const verifiedSources: VerifiedProtectedSource[] = members.map(({source, generation}) => ({source, generation}))
    const prepared = prepareProtectedPackages({...options, packages: members, verifiedSources})
    return {
      schemaVersion: 1 as const,
      state: 'bundled-runtime-prepared' as const,
      version: bundle.version,
      runtimeSource: 'product-bundle' as const,
      modules: bundle.packages.map(({name, version, entry}) => ({name, version, entry})),
      bundles: bundle.bundles.map(({name, version, source}) => ({name, version, source})),
      profileGraph: 'relink-pending' as const,
      recovered,
      prepared,
      clientClaims: prepared.clientClaims,
    }
  }, options.lockWaitMs === undefined ? undefined : {waitMs: options.lockWaitMs})
  // Coordinate with supported host writers, not merely our home transaction.
  // A lock left by a process that no longer exists is reclaimed before the
  // wait, so a crashed host does not keep the profile busy for the whole bound.
  reclaimOrphanedLock(manifest + '.lock')
  try {
    return await run()
  } catch (error) {
    // A live writer that released the lock during this very wait is retried
    // once; a live writer that still holds it keeps its lock and its failure.
    if (!isWriterLockBusy(error) || !reclaimOrphanedLock(manifest + '.lock')) throw error
    return await run()
  }
}
