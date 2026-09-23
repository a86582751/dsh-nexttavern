// Generated from runtime/alpha3/src/operations/bundled-package-bootstrap.mts; edit the TypeScript source.
/** Verify the installed product's private dependencies before preparing durable pins. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, findPackageJSON } from 'node:module';
import { pathToFileURL } from 'node:url';
import { withFileLock } from '@deepseek-ai/dsh-atomic-write';
import { contained } from './public-transaction.mjs';
import { prepareProtectedPackages, recoverProtectedPackages, verifyProtectedPackage } from './protected-packages.mjs';
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
/**
 * Whether a bootstrap failure was the host's own profile writer lock still
 * being held. `withFileLock` names exactly this condition, and the caller that
 * can retry later distinguishes it from a real verification or write failure
 * instead of reporting a busy profile as a broken install.
 */
export function isWriterLockBusy(error) {
    return error instanceof Error && error.message.includes('timed out waiting for the writer lock');
}
function peerPackage(anchor, name, optional, resolveManifest) {
    try {
        // Some host peers expose only subpaths (node-addon-system/flock), or only
        // ESM conditions. Their package owner is the identity boundary; requiring
        // a nonexistent CJS root export would reject an otherwise valid graph.
        // Node's findPackageJSON ignores module hooks. A running profile must use
        // the host's package owner service, just like its actual module imports.
        // Plain on-disk graphs (offline admission) retain the physical lookup.
        const metadata = resolveManifest ? resolveManifest(name, pathToFileURL(anchor).href)
            : findPackageJSON(name, pathToFileURL(anchor));
        if (!metadata && optional)
            return null;
        if (!metadata)
            throw Error('No package metadata for peer: ' + name);
        return fs.realpathSync(metadata);
    }
    catch (error) {
        if (optional && ['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(error.code ?? ''))
            return null;
        throw error;
    }
}
function verifyPeers(metadataPath, metadata, hostAnchor, productAnchor, ownedNames, resolveManifest) {
    for (const peer of Object.keys(metadata.peerDependencies ?? {})) {
        const optional = metadata.peerDependenciesMeta?.[peer]?.optional === true;
        // Compatibility peers share the product's private owner even before profile
        // relink; host services must still resolve to the host's exact singleton.
        const owned = peer.startsWith('dsh-nexttavern-');
        if (owned && !ownedNames.has(peer))
            throw Error('Uninventoried owned peer: ' + peer);
        const reference = owned ? productAnchor : hostAnchor;
        if (peerPackage(metadataPath, peer, optional, resolveManifest) !== peerPackage(reference, peer, optional, resolveManifest)) {
            throw Error('Compatibility dependency uses a different host peer: ' + metadata.name + ' -> ' + peer);
        }
    }
}
/**
 * The inventory is emitted by release assembly, never computed by trusting an
 * arbitrary installed package. Returned modules remain inside the root bundle:
 * pinning a future profile resolution must not switch a running process's graph.
 */
export function inspectBundledPackages(productRoot, hostAnchor, resolveManifest) {
    productRoot = fs.realpathSync(productRoot);
    const rootManifest = contained(productRoot, 'package.json');
    const product = readJson(rootManifest);
    const inventory = readJson(contained(productRoot, 'nexttavern.dependencies.json'));
    if (product.name !== 'dsh-nexttavern' || typeof product.version !== 'string' || !product.version.trim()
        || inventory.schemaVersion !== 1 || typeof inventory.productVersion !== 'string'
        || inventory.productVersion !== product.version || !Array.isArray(inventory.packages)) {
        throw Error('Bundled dependency inventory does not match this NextTavern version');
    }
    const productResolver = createRequire(rootManifest);
    const hostManifest = fs.realpathSync(hostAnchor);
    const bundledNames = (product.bundleDependencies ?? []).filter(name => name.startsWith('dsh-nexttavern-')).sort();
    const declaredNames = Object.keys(product.dependencies ?? {}).filter(name => name.startsWith('dsh-nexttavern-')).sort();
    const inventoriedNames = inventory.packages.map(spec => spec.name).sort();
    if (JSON.stringify(bundledNames) !== JSON.stringify(inventoriedNames)
        || JSON.stringify(declaredNames) !== JSON.stringify(inventoriedNames)) {
        throw Error('Bundled compatibility inventory is incomplete');
    }
    const ownedNames = new Set(bundledNames);
    verifyPeers(rootManifest, product, hostManifest, rootManifest, ownedNames, resolveManifest);
    const seen = new Set();
    const packages = inventory.packages.map(spec => {
        if (typeof spec.name !== 'string' || !/^dsh-nexttavern-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.name)
            || seen.has(spec.name) || typeof spec.version !== 'string' || !spec.version.trim() || !Array.isArray(spec.files)) {
            throw Error('Invalid or duplicate bundled compatibility identity');
        }
        seen.add(spec.name);
        if (!Array.isArray(product.bundleDependencies) || !product.bundleDependencies.includes(spec.name)
            || product.dependencies?.[spec.name] !== spec.version) {
            throw Error('Compatibility dependency is not exactly pinned and bundled: ' + spec.name);
        }
        const source = fs.realpathSync(contained(productRoot, 'node_modules/' + spec.name));
        const metadataPath = fs.realpathSync(productResolver.resolve(spec.name + '/package.json'));
        if (metadataPath !== path.join(source, 'package.json'))
            throw Error('Compatibility package escaped its product bundle');
        const metadata = readJson(metadataPath);
        if (metadata.name !== spec.name || metadata.version !== spec.version || metadata.dsh?.bundle !== undefined) {
            throw Error('Bundled compatibility identity or activation layer differs: ' + spec.name);
        }
        // Startup may inspect the private bundle while manager holds its writer
        // lock. Verify bytes here without profile writes or waiting for that lock;
        // durable pin preparation remains a separate, explicitly locked operation.
        verifyProtectedPackage(source, spec);
        const entry = fs.realpathSync(productResolver.resolve(spec.name));
        const relativeEntry = path.relative(source, entry).replaceAll('\\', '/');
        if (contained(source, relativeEntry) !== entry)
            throw Error('Compatibility entry escaped its bundle');
        verifyPeers(metadataPath, metadata, hostManifest, rootManifest, ownedNames, resolveManifest);
        return { ...spec, source, entry };
    });
    return { productRoot, version: product.version, packages };
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
export async function bootstrapBundledPackages(options) {
    if (!/^[a-zA-Z0-9_-]+$/.test(options.profile))
        throw Error('Invalid profile name');
    const manifest = contained(fs.realpathSync(options.home), `profiles/${options.profile}/package.json`);
    // Coordinate with supported host writers, not merely our home transaction.
    // Never remove an existing official lock: an orphan needs explicit recovery.
    return withFileLock(manifest, async () => {
        const bundle = inspectBundledPackages(options.productRoot, options.hostAnchor, options.resolvePeerManifest);
        const recovered = recoverProtectedPackages(options.home);
        const prepared = prepareProtectedPackages({ ...options, packages: bundle.packages });
        return {
            schemaVersion: 1,
            state: 'bundled-runtime-prepared',
            version: bundle.version,
            runtimeSource: 'product-bundle',
            modules: bundle.packages.map(({ name, version, entry }) => ({ name, version, entry })),
            profileGraph: 'relink-pending',
            recovered,
            prepared,
        };
    }, options.lockWaitMs === undefined ? undefined : { waitMs: options.lockWaitMs });
}
