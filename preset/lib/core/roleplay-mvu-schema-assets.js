// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-assets.ts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** Resolve the schema engine from this admitted product, never a profile,
 * build-tools, card path or optional dependency discovered on the host. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deriveOwnedStateLoaderIdentityV4 } from './tavern-mvu-schema-program-v4.js';
import { recordSha256 } from './roleplay-data.js';
import { validateSchemaExecutorIdentityTuple } from './roleplay-mvu-schema-executor-types.js';
const packageName = 'dsh-nexttavern-mvu-schema-runtime';
const sameDirectory = (left, right) => left.protocol === 'file:'
    && fs.realpathSync(fileURLToPath(left)) === right;
function productRoot(name, packageVersion) {
    // Root lib/core and preset/lib/core are the two registered delivery layouts.
    // Standalone historical presets and maintenance build-tools are unsupported.
    for (const relative of ['../../', '../../../']) {
        const root = fs.realpathSync(fileURLToPath(new URL(relative, import.meta.url)));
        const metadata = path.join(root, 'package.json');
        if (!fs.existsSync(metadata))
            continue;
        const value = JSON.parse(fs.readFileSync(metadata, 'utf8'));
        if (value.name === 'dsh-nexttavern' && value.dependencies?.[name] === packageVersion)
            return root;
    }
    throw Error('SCHEMA_RUNTIME_PRODUCT_OWNER_UNAVAILABLE');
}
/** Core owns this lazy lifecycle. Revocation during loading disposes the
 * actual factory instead of allowing a delayed import to recreate it. */
export function createRoleplayMvuSchemaAssetOwner() {
    let closed = false;
    const runtimes = new Map();
    async function load(version) {
        const name = version === 1 ? packageName : packageName + '-v' + version;
        const packageVersion = version === 4 ? '0.4.0' : '0.3.0';
        const root = productRoot(name, packageVersion), require = createRequire(path.join(root, 'package.json'));
        const metadataPath = fs.realpathSync(require.resolve(name + '/package.json'));
        const owned = fs.realpathSync(path.join(root, 'node_modules', name));
        if (metadataPath !== path.join(owned, 'package.json'))
            throw Error('SCHEMA_RUNTIME_PACKAGE_OWNER_CHANGED');
        const entry = fs.realpathSync(require.resolve(name));
        const relative = path.relative(owned, entry);
        if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) {
            throw Error('SCHEMA_RUNTIME_ENTRY_OWNER_CHANGED');
        }
        const bootstrap = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(root, 'lib/operations/bundled-package-bootstrap.mjs')).href));
        const protection = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(root, 'lib/operations/protected-packages.mjs')).href));
        const verify = () => {
            const identity = bootstrap.readBundleIdentity(root);
            const specs = identity.packages.filter(spec => spec.name === name);
            if (identity.productRoot !== root || specs.length !== 1 || specs[0].version !== packageVersion
                || fs.realpathSync(require.resolve(name + '/package.json')) !== metadataPath
                || fs.realpathSync(path.join(root, 'node_modules', name)) !== owned) {
                throw Error('SCHEMA_RUNTIME_INVENTORY_OWNER_CHANGED');
            }
            const spec = specs[0];
            protection.verifyProtectedPackage(owned, spec);
            return { name, version: packageVersion, files: structuredClone(spec.files), generation: spec.generation };
        };
        verify();
        if (closed)
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        const verifyOwnedPackage = (fixed) => {
            if (!sameDirectory(fixed, owned))
                throw Error('SCHEMA_RUNTIME_PACKAGE_OWNER_CHANGED');
            return verify();
        };
        let loaded;
        if (version === 1) {
            const module = await import(__rewriteRelativeImportExtension(pathToFileURL(entry).href));
            if (closed)
                throw Error('SCHEMA_RUNTIME_DISPOSED');
            loaded = await module.createMvuSchemaRuntime({ verifyOwnedPackage: fixed => verifyOwnedPackage(fixed) });
        }
        else if (version === 2) {
            const module = await import(__rewriteRelativeImportExtension(pathToFileURL(entry).href));
            if (closed)
                throw Error('SCHEMA_RUNTIME_DISPOSED');
            loaded = await module.createMvuSchemaRuntimeV2({ verifyOwnedPackage: fixed => verifyOwnedPackage(fixed) });
        }
        else if (version === 3) {
            const module = await import(__rewriteRelativeImportExtension(pathToFileURL(entry).href));
            if (closed)
                throw Error('SCHEMA_RUNTIME_DISPOSED');
            loaded = await module.createMvuSchemaRuntimeV3({ verifyOwnedPackage: fixed => verifyOwnedPackage(fixed) });
        }
        else {
            const module = await import(__rewriteRelativeImportExtension(pathToFileURL(entry).href));
            if (closed)
                throw Error('SCHEMA_RUNTIME_DISPOSED');
            loaded = await module.createMvuSchemaRuntimeV4({ verifyOwnedPackage: fixed => verifyOwnedPackage(fixed) });
        }
        if (closed) {
            await loaded.dispose();
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        }
        const tuple = { compiler: loaded.compiler.identity, bridge: loaded.bridge,
            libraries: loaded.libraries, runner: loaded.runner.identity };
        if (tuple.compiler.version !== version || tuple.bridge.version !== version || tuple.runner.version !== version) {
            await loaded.dispose();
            throw Error('SCHEMA_RUNTIME_IMPLEMENTATION_VERSION_CHANGED');
        }
        if (version === 4) {
            try {
                if (!('stateLoader' in loaded)
                    || recordSha256(loaded.stateLoader) !== recordSha256(deriveOwnedStateLoaderIdentityV4(loaded.bridge))) {
                    throw Error('SCHEMA_RUNTIME_STATE_LOADER_CHANGED');
                }
            }
            catch {
                await loaded.dispose();
                throw Error('SCHEMA_RUNTIME_STATE_LOADER_CHANGED');
            }
        }
        // Each guest ABI remains narrow. The private adapter checks the envelope
        // before selecting a runner; a union never enables implicit wire upgrade.
        const executor = { executorVersion: version, implementationKey: recordSha256(tuple),
            compiler: { identity: loaded.compiler.identity,
                async compile(input, signal) {
                    if (closed)
                        throw Error('SCHEMA_RUNTIME_DISPOSED');
                    if (version === 4 && input.schemaVersion === 2)
                        return loaded.compiler.compile(input, signal);
                    if (input.schemaVersion !== 1)
                        return { kind: 'refused', diagnostics: [{ code: 'SCHEMA_EXECUTOR_VERSION_MISMATCH' }] };
                    if (version === 1)
                        return loaded.compiler.compile(input, signal);
                    if (version === 2)
                        return loaded.compiler.compile(input, signal);
                    if (version === 3)
                        return loaded.compiler.compile(input, signal);
                    return { kind: 'refused', diagnostics: [{ code: 'SCHEMA_EXECUTOR_VERSION_MISMATCH' }] };
                },
                async verifyProgram(program, signal) {
                    if (closed)
                        throw Error('SCHEMA_RUNTIME_DISPOSED');
                    if (version === 4 && program.schemaVersion === 2)
                        return loaded.compiler.verifyProgram(program, signal);
                    if (program.schemaVersion !== 1)
                        return false;
                    if (version === 1)
                        return loaded.compiler.verifyProgram(program, signal);
                    if (version === 2)
                        return loaded.compiler.verifyProgram(program, signal);
                    if (version === 3)
                        return loaded.compiler.verifyProgram(program, signal);
                    return false;
                }, dispose: () => loaded.compiler.dispose() }, libraries: loaded.libraries, bridge: loaded.bridge,
            ...(version === 4 ? { stateLoader: loaded.stateLoader } : {}),
            runner: { identity: loaded.runner.identity,
                async evaluateTrace(program, input, signal) {
                    if (closed)
                        throw Error('SCHEMA_RUNTIME_DISPOSED');
                    if (input.schemaVersion !== version)
                        return { kind: 'unavailable', diagnostics: [{ code: 'SCHEMA_EXECUTOR_VERSION_MISMATCH' }] };
                    // The admitted provider verifies the full owned package before and
                    // after each call; the adapter only owns lifecycle and ABI selection.
                    if (input.schemaVersion === 1 && version === 1 && program.schemaVersion === 1)
                        return loaded.runner.evaluateTrace(program, input, signal);
                    if (input.schemaVersion === 2 && version === 2 && program.schemaVersion === 1)
                        return loaded.runner.evaluateTrace(program, input, signal);
                    if (input.schemaVersion === 3 && version === 3 && program.schemaVersion === 1)
                        return loaded.runner.evaluateTrace(program, input, signal);
                    if (input.schemaVersion === 4 && version === 4 && program.schemaVersion === 2)
                        return loaded.runner.evaluateTrace(program, input, signal);
                    return { kind: 'unavailable', diagnostics: [{ code: 'SCHEMA_EXECUTOR_VERSION_MISMATCH' }] };
                },
                async verifyTrace(program, evaluation, signal) {
                    if (closed)
                        throw Error('SCHEMA_RUNTIME_DISPOSED');
                    if (evaluation.schemaVersion === 1 && version === 1 && program.schemaVersion === 1)
                        return loaded.runner.verifyTrace(program, evaluation, signal);
                    if (evaluation.schemaVersion === 2 && version === 2 && program.schemaVersion === 1)
                        return loaded.runner.verifyTrace(program, evaluation, signal);
                    if (evaluation.schemaVersion === 3 && version === 3 && program.schemaVersion === 1)
                        return loaded.runner.verifyTrace(program, evaluation, signal);
                    if (evaluation.schemaVersion === 4 && version === 4 && program.schemaVersion === 2)
                        return loaded.runner.verifyTrace(program, evaluation, signal);
                    return false;
                } }, dispose: () => loaded.dispose() };
        return { version, runtime: loaded, executor, verify: () => { verify(); } };
    }
    async function admitted(version) {
        if (closed)
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        let pending = runtimes.get(version);
        if (!pending) {
            pending = load(version).catch(error => { runtimes.delete(version); throw error; });
            runtimes.set(version, pending);
        }
        const actual = await pending;
        if (closed)
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        actual.verify();
        return actual;
    }
    return {
        /** Existing v1 callers remain explicit during migration. New preparation
         * uses getDefaultForNewRealm; historical lookup never consults that default. */
        async get() {
            return (await admitted(1)).runtime;
        },
        async getDefaultForNewRealm(version = 3) {
            return (await admitted(version)).executor;
        },
        async getHistoricalV1() {
            return (await admitted(1)).executor;
        },
        async getForVerifiedEpoch(tuple) {
            // A persisted tuple is only lookup data. Core still proves its Source,
            // cut and actual replay before minting process-private publication evidence.
            try {
                // Snapshot bounded lookup data before package admission can yield. A
                // malformed or later-mutated tuple cannot leak a different failure ABI.
                const verified = validateSchemaExecutorIdentityTuple(tuple);
                const version = verified.runner.version;
                const implementationKey = recordSha256(verified);
                const actual = (await admitted(version)).executor;
                if (actual.implementationKey !== implementationKey)
                    throw Error('SCHEMA_HISTORY_EXECUTOR_UNAVAILABLE');
                return actual;
            }
            catch {
                throw Error('SCHEMA_HISTORY_EXECUTOR_UNAVAILABLE');
            }
        },
        async dispose() {
            closed = true;
            await Promise.all([...runtimes.values()].map(async (active) => {
                try {
                    await (await active).runtime.dispose();
                }
                catch { /* Loading already refused or revoked. */ }
            }));
        },
    };
}
