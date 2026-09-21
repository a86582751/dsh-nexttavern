/** Verify the installed product's private dependencies before preparing durable pins. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {withFileLock} from '@deepseek-ai/dsh-atomic-write'
import {contained} from './public-transaction.mjs'
import {prepareProtectedPackages, recoverProtectedPackages, type ProtectedFile} from './protected-packages.mjs'

export interface BundledPackageSpec {
  name: string
  version: string
  files: ProtectedFile[]
}
interface BundleInventory {
  schemaVersion: 1
  productVersion: string
  packages: BundledPackageSpec[]
}
interface PackageMetadata {
  name: string
  version: string
  dependencies?: Record<string, string>
  bundleDependencies?: string[]
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, {optional?: boolean}>
  dsh?: {bundle?: unknown}
}
const readJson = <T,>(file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as T

function peerEntry(resolver: NodeJS.Require, name: string, optional: boolean): string | null {
  try {return fs.realpathSync(resolver.resolve(name))} catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') return null
    throw error
  }
}

function verifyPeers(metadataPath: string, metadata: PackageMetadata, hostResolver: NodeJS.Require) {
  const resolver = createRequire(metadataPath)
  for (const peer of Object.keys(metadata.peerDependencies ?? {})) {
    const optional = metadata.peerDependenciesMeta?.[peer]?.optional === true
    if (peerEntry(resolver, peer, optional) !== peerEntry(hostResolver, peer, optional)) {
      throw Error('Compatibility dependency uses a different host peer: ' + metadata.name + ' -> ' + peer)
    }
  }
}

/**
 * The inventory is emitted by release assembly, never computed by trusting an
 * arbitrary installed package. Returned modules remain inside the root bundle:
 * pinning a future profile resolution must not switch a running process's graph.
 */
export function inspectBundledPackages(productRoot: string, hostAnchor: string) {
  productRoot = fs.realpathSync(productRoot)
  const rootManifest = contained(productRoot, 'package.json')
  const product = readJson<PackageMetadata>(rootManifest)
  const inventory = readJson<BundleInventory>(contained(productRoot, 'nexttavern.dependencies.json'))
  if (product.name !== 'dsh-nexttavern' || typeof product.version !== 'string' || !product.version.trim()
    || inventory.schemaVersion !== 1 || typeof inventory.productVersion !== 'string'
    || inventory.productVersion !== product.version || !Array.isArray(inventory.packages)) {
    throw Error('Bundled dependency inventory does not match this NextTavern version')
  }
  const productResolver = createRequire(rootManifest)
  const hostResolver = createRequire(fs.realpathSync(hostAnchor))
  verifyPeers(rootManifest, product, hostResolver)
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
    const source = fs.realpathSync(contained(productRoot, 'node_modules/' + spec.name))
    const metadataPath = fs.realpathSync(productResolver.resolve(spec.name + '/package.json'))
    if (metadataPath !== path.join(source, 'package.json')) throw Error('Compatibility package escaped its product bundle')
    const metadata = readJson<PackageMetadata>(metadataPath)
    if (metadata.name !== spec.name || metadata.version !== spec.version || metadata.dsh?.bundle !== undefined) {
      throw Error('Bundled compatibility identity or activation layer differs: ' + spec.name)
    }
    const entry = fs.realpathSync(productResolver.resolve(spec.name))
    const relativeEntry = path.relative(source, entry).replaceAll('\\', '/')
    if (contained(source, relativeEntry) !== entry) throw Error('Compatibility entry escaped its bundle')
    verifyPeers(metadataPath, metadata, hostResolver)
    return {...spec, source, entry}
  })
  return {productRoot, version: product.version, packages}
}

/**
 * Bootstrap never runs pnpm inside the loading host. Private bundled modules
 * are usable now; profile file: references take effect on a later package-manager
 * operation. That distinction is preserved in the result, not hidden as success.
 */
export async function bootstrapBundledPackages(options: {
  productRoot: string; hostAnchor: string; home: string; profile: string; backup: string
}) {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.profile)) throw Error('Invalid profile name')
  const manifest = contained(fs.realpathSync(options.home), `profiles/${options.profile}/package.json`)
  // Coordinate with supported host writers, not merely our home transaction.
  // Never remove an existing official lock: an orphan needs explicit recovery.
  return withFileLock(manifest, async () => {
    const bundle = inspectBundledPackages(options.productRoot, options.hostAnchor)
    const recovered = recoverProtectedPackages(options.home)
    const prepared = prepareProtectedPackages({...options, packages: bundle.packages})
    return {
      schemaVersion: 1 as const,
      state: 'bundled-runtime-prepared' as const,
      version: bundle.version,
      runtimeSource: 'product-bundle' as const,
      modules: bundle.packages.map(({name, version, entry}) => ({name, version, entry})),
      profileGraph: 'relink-pending' as const,
      recovered,
      prepared,
    }
  })
}
