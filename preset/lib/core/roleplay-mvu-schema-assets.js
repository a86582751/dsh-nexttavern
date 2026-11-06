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
import { createRoleplayTypeScriptAssetOwner } from './roleplay-typescript-assets.js';
import { validateSchemaExecutorIdentityTuple } from './roleplay-mvu-schema-executor-types.js';
const policyPackageName = 'dsh-nexttavern-mvu-schema-runtime-v4-update-batch-v1';
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
    const typescriptAssets = createRoleplayTypeScriptAssetOwner();
    const runtimes = new Map();
    const runtimesByIdentity = new Map();
    let product;
    async function loadProduct(name, packageVersion) {
        const root = productRoot(name, packageVersion), require = createRequire(path.join(root, 'package.json'));
        const bootstrap = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(root, 'lib/operations/bundled-package-bootstrap.mjs')).href));
        const protection = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(root, 'lib/operations/protected-packages.mjs')).href));
        const identity = bootstrap.readBundleIdentity(root);
        if (identity.productRoot !== root)
            throw Error('SCHEMA_RUNTIME_INVENTORY_OWNER_CHANGED');
        return { root, require, identity, protection };
    }
    function productAssets(name, packageVersion) {
        // Package generations share this owner's fixed installed product catalog.
        return product ??= loadProduct(name, packageVersion).catch(error => { product = undefined; throw error; });
    }
    async function load(ref) {
        const packageVersion = '0.4.0';
        const { root, require, identity, protection } = await productAssets(policyPackageName, packageVersion);
        const selected = ref ?? identity.currentRuntime?.roles.schema;
        if (closed)
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        const binding = selected ? identity.runtimeComponents.get(selected.name + '\0' + selected.generation + '\0' + (selected.context ?? '')) : undefined;
        const name = binding?.name ?? policyPackageName, historical = binding?.path !== undefined;
        const specs = selected ? binding ? [binding] : [] : identity.packages.filter(spec => spec.name === name);
        if (specs.length !== 1 || !binding && specs[0].version !== packageVersion
            || binding && binding.factory !== 'schema-v4-shared-typescript') {
            throw Error('SCHEMA_RUNTIME_INVENTORY_OWNER_CHANGED');
        }
        const spec = specs[0];
        const owned = fs.realpathSync(binding?.source ?? path.join(root, 'node_modules', name));
        const metadataPath = fs.realpathSync(historical ? path.join(owned, 'package.json') : require.resolve(name + '/package.json'));
        if (metadataPath !== path.join(owned, 'package.json'))
            throw Error('SCHEMA_RUNTIME_PACKAGE_OWNER_CHANGED');
        const entry = fs.realpathSync(historical ? path.join(owned, 'dist', 'index.mjs') : require.resolve(name));
        const relative = path.relative(owned, entry);
        if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) {
            throw Error('SCHEMA_RUNTIME_ENTRY_OWNER_CHANGED');
        }
        protection.verifyProtectedPackage(owned, spec);
        const inventory = { name, version: spec.version, files: structuredClone(spec.files), generation: spec.generation };
        if (closed)
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        const verifyOwnedPackage = (fixed) => {
            if (closed)
                throw Error('SCHEMA_RUNTIME_DISPOSED');
            if (!sameDirectory(fixed, owned))
                throw Error('SCHEMA_RUNTIME_PACKAGE_OWNER_CHANGED');
            // Admission owns the fixed inventory for this lifecycle. The immutable
            // provider still checks actual files before loading or executing workers.
            return inventory;
        };
        const module = await import(__rewriteRelativeImportExtension(pathToFileURL(entry).href));
        if (binding && !binding.dependencies.typescript)
            throw Error('SCHEMA_RUNTIME_TYPESCRIPT_UNAVAILABLE');
        const typescript = await typescriptAssets.get(binding?.dependencies.typescript);
        if (closed)
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        const loaded = await module.createMvuSchemaRuntimeV4({ verifyOwnedPackage: fixed => verifyOwnedPackage(fixed), typescript });
        if (closed) {
            await loaded.dispose();
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        }
        const tuple = { compiler: loaded.compiler.identity, bridge: loaded.bridge,
            libraries: loaded.libraries, runner: loaded.runner.identity };
        if (tuple.compiler.version !== 4 || tuple.bridge.version !== 4 || tuple.runner.version !== 4) {
            await loaded.dispose();
            throw Error('SCHEMA_RUNTIME_IMPLEMENTATION_VERSION_CHANGED');
        }
        try {
            if (recordSha256(loaded.stateLoader) !== recordSha256(deriveOwnedStateLoaderIdentityV4(loaded.bridge))) {
                throw Error('SCHEMA_RUNTIME_STATE_LOADER_CHANGED');
            }
        }
        catch {
            await loaded.dispose();
            throw Error('SCHEMA_RUNTIME_STATE_LOADER_CHANGED');
        }
        function scopeRunner(bound) {
            return { identity: bound.identity, scopeInputProtocols: bound.scopeInputProtocols,
                bindScopeReferencesV2: bound.bindScopeReferencesV2 ? read => scopeRunner(bound.bindScopeReferencesV2(read)) : undefined,
                bindOwnedNext: bound.bindOwnedNext ? reader => {
                    const owned = bound.bindOwnedNext(reader);
                    return { async evaluateNext(program, input, signal) {
                            if (closed)
                                throw Error('SCHEMA_RUNTIME_DISPOSED');
                            return owned.evaluateNext(program, input, signal);
                        } };
                } : undefined,
                async evaluateTrace(program, input, signal) {
                    if (closed)
                        throw Error('SCHEMA_RUNTIME_DISPOSED');
                    return bound.evaluateTrace(program, input, signal);
                },
                evaluateNext: bound.evaluateNext ? async (program, input, signal) => {
                    if (closed)
                        throw Error('SCHEMA_RUNTIME_DISPOSED');
                    return bound.evaluateNext(program, input, signal);
                } : undefined,
                openManualRun: bound.openManualRun ? async (program, input, signal) => {
                    if (closed)
                        throw Error('SCHEMA_RUNTIME_DISPOSED');
                    return bound.openManualRun(program, input, signal);
                } : undefined,
                async verifyTrace(program, evaluation, signal) {
                    if (closed)
                        throw Error('SCHEMA_RUNTIME_DISPOSED');
                    return bound.verifyTrace(program, evaluation, signal);
                } };
        }
        const executor = { executorVersion: 4, implementationKey: recordSha256(tuple),
            compiler: { identity: loaded.compiler.identity,
                ...'partitionCandidates' in loaded.compiler ? {
                    async partitionCandidates(input, signal) {
                        if (closed)
                            throw Error('SCHEMA_RUNTIME_DISPOSED');
                        return loaded.compiler
                            .partitionCandidates(input, signal);
                    },
                } : {},
                ...'assembleOwnedStateProgram' in loaded.compiler ? {
                    assembleOwnedStateProgram(...args) {
                        if (closed)
                            throw Error('SCHEMA_RUNTIME_DISPOSED');
                        return loaded.compiler.assembleOwnedStateProgram(...args);
                    },
                } : {},
                async compile(input, signal) {
                    if (closed)
                        throw Error('SCHEMA_RUNTIME_DISPOSED');
                    return loaded.compiler.compile(input, signal);
                },
                async verifyProgram(program, signal) {
                    if (closed)
                        throw Error('SCHEMA_RUNTIME_DISPOSED');
                    if (program.encoding === 'native-mvu-owned-state-program-v1')
                        return false;
                    return loaded.compiler.verifyProgram(program, signal);
                }, dispose: () => loaded.compiler.dispose() }, libraries: loaded.libraries, bridge: loaded.bridge,
            stateLoader: loaded.stateLoader, runner: scopeRunner(loaded.runner), dispose: () => loaded.dispose() };
        return { runtime: loaded, executor };
    }
    async function admitted(ref) {
        if (closed)
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        const selected = ref ?? (await productAssets(policyPackageName, '0.4.0')).identity.currentRuntime?.roles.schema;
        const key = selected ? selected.name + '\0' + selected.generation + '\0' + (selected.context ?? '') : 'default';
        let pending = runtimes.get(key);
        if (!pending) {
            pending = load(selected).then(actual => {
                runtimesByIdentity.set(actual.executor.implementationKey, actual.executor);
                return actual;
            }).catch(error => { runtimes.delete(key); throw error; });
            runtimes.set(key, pending);
        }
        const actual = await pending;
        if (closed)
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        return actual;
    }
    return {
        getTypeScript: (ref) => typescriptAssets.get(ref),
        async getDefaultForNewRealm(_version = 4) {
            return (await admitted()).executor;
        },
        async getForVerifiedEpoch(tuple) {
            // A persisted tuple is only lookup data. Core still proves its Source,
            // cut and actual replay before minting process-private publication evidence.
            try {
                if (closed)
                    throw Error('SCHEMA_RUNTIME_DISPOSED');
                // Snapshot bounded lookup data before package admission can yield. A
                // malformed or later-mutated tuple cannot leak a different failure ABI.
                const verified = validateSchemaExecutorIdentityTuple(tuple);
                const implementationKey = recordSha256(verified);
                const known = runtimesByIdentity.get(implementationKey);
                if (known)
                    return known;
                const { identity } = await productAssets(policyPackageName, '0.4.0');
                const entry = identity.releasedRuntime?.schemas.find(row => recordSha256({
                    compiler: row.server.compiler, bridge: row.server.bridge, libraries: row.server.libraries,
                    runner: row.server.runner
                }) === implementationKey);
                const actual = (await admitted(entry?.component)).executor;
                if (actual.implementationKey !== implementationKey)
                    throw Error('SCHEMA_HISTORY_EXECUTOR_UNAVAILABLE');
                return actual;
            }
            catch {
                if (closed)
                    throw Error('SCHEMA_RUNTIME_DISPOSED');
                throw Error('SCHEMA_HISTORY_EXECUTOR_UNAVAILABLE');
            }
        },
        async dispose() {
            closed = true;
            typescriptAssets.dispose();
            await Promise.all([...runtimes.values()].map(async (active) => {
                try {
                    await (await active).runtime.dispose();
                }
                catch { /* Loading already refused or revoked. */ }
            }));
        },
    };
}
