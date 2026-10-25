// Generated from runtime/alpha3/src/core/roleplay-tavern-template-assets.ts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** Own the independent template component's product admission and lazy
 * lifecycle. Source/scopes/lore/Native permission remain with the caller.
 * No profile/build-tools path or schema executor supplies this component. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { recordSha256 } from './roleplay-data.js';
const NAME = 'dsh-nexttavern-template-runtime-v2';
const VERSION = '0.1.0';
// This actual Core asset-owner module instance only. The rejection count does
// not transfer runtime frames or provide a process-wide lock/approval token.
let ownedReadScopeDepth = 0;
function owningProductRoot() {
    // Exactly the two already registered root/preset Core delivery layouts.
    for (const relative of ['../../', '../../../']) {
        const root = fs.realpathSync(fileURLToPath(new URL(relative, import.meta.url)));
        const file = path.join(root, 'package.json');
        if (!fs.existsSync(file))
            continue;
        const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (metadata.name === 'dsh-nexttavern' && metadata.dependencies?.[NAME] === VERSION)
            return root;
    }
    throw Error('TEMPLATE_RUNTIME_PRODUCT_OWNER_UNAVAILABLE');
}
export function createRoleplayTavernTemplateAssetOwnerV1() {
    let closed = false;
    const instances = new Map();
    function checkCurrentSync(checks) {
        if (closed)
            throw Error('TEMPLATE_RUNTIME_DISPOSED');
        ownedReadScopeDepth++;
        try {
            // Only internal synchronous read/assert guards use this scope. It never
            // encloses code loading, persistence, worker or provider dispatch.
            const currentRuntime = instances.get(NAME)?.runtime;
            if (currentRuntime) {
                currentRuntime.checkCurrentSync(checks);
                return;
            }
            const returned = checks();
            if (returned && typeof returned === 'object' && 'then' in returned) {
                throw Error('TEMPLATE_RUNTIME_ASYNC_VERIFICATION_SCOPE');
            }
            if (closed)
                throw Error('TEMPLATE_RUNTIME_DISPOSED');
        }
        finally {
            ownedReadScopeDepth--;
        }
    }
    async function load(name) {
        const root = owningProductRoot(), require = createRequire(path.join(root, 'package.json'));
        const metadataPath = fs.realpathSync(require.resolve(name + '/package.json'));
        const ownedDirectory = path.join(root, 'node_modules', name), ownedStat = fs.lstatSync(ownedDirectory);
        if (!ownedStat.isDirectory() || ownedStat.isSymbolicLink())
            throw Error('TEMPLATE_RUNTIME_PACKAGE_OWNER_CHANGED');
        const owned = fs.realpathSync(ownedDirectory);
        if (owned !== path.resolve(ownedDirectory))
            throw Error('TEMPLATE_RUNTIME_PACKAGE_OWNER_CHANGED');
        if (metadataPath !== path.join(owned, 'package.json'))
            throw Error('TEMPLATE_RUNTIME_PACKAGE_OWNER_CHANGED');
        const entry = fs.realpathSync(require.resolve(name));
        if (entry !== path.join(owned, 'dist', 'index.mjs'))
            throw Error('TEMPLATE_RUNTIME_ENTRY_OWNER_CHANGED');
        const bootstrap = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(root, 'lib/operations/bundled-package-bootstrap.mjs')).href));
        const protection = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(root, 'lib/operations/protected-packages.mjs')).href));
        const readInventory = () => {
            if (closed)
                throw Error('TEMPLATE_RUNTIME_DISPOSED');
            const identity = bootstrap.readBundleIdentity(root);
            const rows = identity.packages.filter(row => row.name === name);
            if (identity.productRoot !== root || rows.length !== 1 || rows[0].version !== VERSION
                || fs.realpathSync(require.resolve(name + '/package.json')) !== metadataPath
                || fs.realpathSync(path.join(root, 'node_modules', name)) !== owned
                || fs.realpathSync(require.resolve(name)) !== entry)
                throw Error('TEMPLATE_RUNTIME_INVENTORY_OWNER_CHANGED');
            const row = rows[0];
            if (protection.protectedGeneration(row) !== row.generation)
                throw Error('TEMPLATE_RUNTIME_GENERATION_CHANGED');
            return row;
        };
        const readOwnedInventory = () => {
            const row = readInventory();
            return { name, version: VERSION, files: structuredClone(row.files), generation: row.generation };
        };
        // Runtime code cannot protect its own import. Keep the original generic
        // full verification before loading it; ordinary installer APIs stay intact.
        const initial = readOwnedInventory(), initialGeneration = initial.generation;
        protection.verifyProtectedPackage(owned, { name: initial.name, version: initial.version,
            files: initial.files.map(file => ({ path: file.path, sha256: file.sha256 })) });
        const verifyOwnedPackage = (url) => {
            if (url.protocol !== 'file:' || fs.realpathSync(fileURLToPath(url)) !== owned) {
                throw Error('TEMPLATE_RUNTIME_PACKAGE_OWNER_CHANGED');
            }
            if (closed)
                throw Error('TEMPLATE_RUNTIME_DISPOSED');
            // Only factory admission calls this callback. Its full package scan
            // fixes one loaded generation for the resulting runtime's lifetime.
            const current = readOwnedInventory();
            if (current.generation !== initialGeneration)
                throw Error('TEMPLATE_RUNTIME_GENERATION_CHANGED');
            return current;
        };
        if (closed)
            throw Error('TEMPLATE_RUNTIME_DISPOSED');
        const factory = await import(__rewriteRelativeImportExtension(pathToFileURL(entry).href));
        if (closed)
            throw Error('TEMPLATE_RUNTIME_DISPOSED');
        const runtime = await factory.createOwnedTavernTemplateRuntimeV1({ verifyOwnedPackage });
        try {
            if (closed)
                throw Error('TEMPLATE_RUNTIME_DISPOSED');
            if (typeof runtime.checkCurrent !== 'function' || typeof runtime.checkCurrentSync !== 'function'
                || typeof runtime.invalidateCurrent !== 'function' || typeof runtime.assertCurrentScopeInactive !== 'function') {
                throw Error('TEMPLATE_RUNTIME_IMPLEMENTATION_CHANGED');
            }
            runtime.checkCurrent();
            if (runtime.identity.packageName !== name || runtime.identity.packageVersion !== VERSION
                || runtime.identity.protectedGeneration !== initialGeneration)
                throw Error('TEMPLATE_RUNTIME_IMPLEMENTATION_CHANGED');
            const result = Object.freeze({ runtime, inventory: initial,
                verify: () => { runtime.checkCurrent(); },
                observe: () => { runtime.checkCurrent(); }, checkCurrentSync });
            const state = instances.get(name);
            state.runtime = runtime;
            state.admitted = result;
            return result;
        }
        catch (error) {
            await runtime.dispose();
            throw error;
        }
    }
    async function loadSelected(name, signal) {
        if (closed)
            throw Error('TEMPLATE_RUNTIME_DISPOSED');
        if (name !== NAME)
            throw Error('TEMPLATE_RUNTIME_ENGINE_UNAVAILABLE');
        signal?.throwIfAborted();
        if (ownedReadScopeDepth)
            throw Error('TEMPLATE_EXECUTION_IN_VERIFICATION_SCOPE');
        const state = instances.get(name) ?? {};
        if (!instances.has(name))
            instances.set(name, state);
        state.runtime?.assertCurrentScopeInactive();
        if (!state.pending) {
            state.pending = load(name);
            void state.pending.catch(() => { if (!closed)
                state.pending = undefined; });
        }
        const result = await state.pending;
        signal?.throwIfAborted();
        if (closed)
            throw Error('TEMPLATE_RUNTIME_DISPOSED');
        result.verify();
        return result;
    }
    return {
        checkCurrentSync,
        /** Admission already captured the product/component generation. Later
         * availability checks consult only the actual runtime's lifetime. */
        observeAdmitted() {
            const admitted = instances.get(NAME)?.admitted;
            if (closed || !admitted)
                return undefined;
            admitted.observe();
            return admitted;
        },
        current() {
            const admitted = instances.get(NAME)?.admitted;
            if (closed || !admitted)
                return undefined;
            admitted.verify();
            return admitted;
        },
        async load(signal) {
            return loadSelected(NAME, signal);
        },
        async loadForEngine(engine, signal) {
            const result = await loadSelected(engine.packageName, signal);
            // An old closure must execute under its creating implementation, rather
            // than merely another component with the same wire protocol.
            if (recordSha256(result.runtime.identity) !== recordSha256(engine))
                throw Error('TEMPLATE_RUNTIME_ENGINE_UNAVAILABLE');
            return result;
        },
        async dispose() {
            if (ownedReadScopeDepth)
                throw Error('TEMPLATE_EXECUTION_IN_VERIFICATION_SCOPE');
            for (const state of instances.values())
                state.runtime?.assertCurrentScopeInactive();
            closed = true;
            for (const state of instances.values())
                state.runtime?.invalidateCurrent();
            // Await an in-flight factory: its own post-await guard disposes any late
            // runtime before rejecting; cancellation cannot leave a worker owner.
            const results = await Promise.allSettled([...instances.values()].map(async (state) => {
                const result = state.admitted ?? await state.pending?.catch(() => undefined);
                await result?.runtime.dispose();
            }));
            const failure = results.find(result => result.status === 'rejected');
            if (failure?.status === 'rejected')
                throw failure.reason;
        },
    };
}
