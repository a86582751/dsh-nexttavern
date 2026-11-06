// Generated from runtime/alpha3/src/core/roleplay-author-host-assets.ts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** Core admits real Host5 package bytes before importing its
 * factory. The admitted generation then owns this one lazy lifecycle. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { recordSha256 } from './roleplay-data.js';
import { EJS_RUNTIME_PACKAGE } from './tavern-template-ejs-runtime-types.mjs';
const hostName = 'dsh-nexttavern-author-host-runtime-v5-update-batch-v1';
function productRoot() {
    // These are the registered root/lib/core and preset/lib/core deliveries.
    for (const relative of ['../../', '../../../']) {
        const root = fs.realpathSync(fileURLToPath(new URL(relative, import.meta.url)));
        const metadata = path.join(root, 'package.json');
        if (!fs.existsSync(metadata))
            continue;
        const product = JSON.parse(fs.readFileSync(metadata, 'utf8'));
        if (product.name === 'dsh-nexttavern')
            return root;
    }
    throw Error('AUTHOR_HOST_PRODUCT_OWNER_UNAVAILABLE');
}
function packageVerifier(admitted) {
    return (root) => {
        if (root.protocol !== 'file:' || fs.realpathSync(fileURLToPath(root)) !== admitted.owned) {
            throw Error('AUTHOR_HOST_PACKAGE_OWNER_CHANGED');
        }
        // The factory consumes this exact preimport admission. It does not scan
        // the installed tree again or treat bundle metadata as byte verification.
        return admitted.inventory;
    };
}
export function createRoleplayAuthorHostAssetOwner(deps) {
    let closed = false, disposal;
    const runtimes = new Map();
    const ejsRuntimes = new Map();
    let defaultEjsKey;
    const runtimesByIdentity = new Map();
    let product;
    const current = () => { if (closed)
        throw Error('AUTHOR_HOST_RUNTIME_DISPOSED'); };
    async function loadProduct() {
        const root = productRoot(), require = createRequire(path.join(root, 'package.json'));
        const bootstrap = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(root, 'lib/operations/bundled-package-bootstrap.mjs')).href));
        const protection = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(root, 'lib/operations/protected-packages.mjs')).href));
        current();
        const identity = bootstrap.readBundleIdentity(root);
        if (identity.productRoot !== root)
            throw Error('AUTHOR_HOST_INVENTORY_OWNER_CHANGED');
        return { root, require, identity, protection };
    }
    function productAssets() {
        // Installed product identity is fixed until this owner is disposed.
        return product ??= loadProduct().catch(error => { product = undefined; throw error; });
    }
    function admit(assets, roles, role, fallback) {
        const { root, require, identity, protection } = assets;
        const ref = roles?.[role], binding = ref ? identity.runtimeComponents.get(ref.name + '\0' + ref.generation + '\0' + (ref.context ?? '')) : undefined;
        const name = binding?.name ?? fallback, historical = binding?.path !== undefined;
        const specs = roles ? binding ? [binding] : [] : identity.packages.filter(spec => spec.name === name);
        if (specs.length !== 1)
            throw Error('AUTHOR_HOST_PACKAGE_OWNER_CHANGED');
        const spec = specs[0];
        const owned = fs.realpathSync(binding?.source ?? path.join(root, 'node_modules', name));
        const metadata = fs.realpathSync(historical ? path.join(owned, 'package.json') : require.resolve(name + '/package.json'));
        const entry = fs.realpathSync(historical ? path.join(owned, 'dist', 'index.mjs') : require.resolve(name));
        if (metadata !== path.join(owned, 'package.json')
            || entry !== path.join(owned, 'dist', 'index.mjs'))
            throw Error('AUTHOR_HOST_PACKAGE_OWNER_CHANGED');
        protection.verifyProtectedPackage(owned, spec);
        return { entry, owned, binding, inventory: { name, version: spec.version, files: structuredClone(spec.files), generation: spec.generation } };
    }
    async function load(roles, selectedServer) {
        const assets = await productAssets(), { identity } = assets;
        current();
        const selectedRoles = roles ?? identity.currentRuntime?.roles;
        const server = selectedServer ?? await deps.serverAssets.getDefaultForNewRealm(4);
        current();
        if (server.executorVersion !== 4 || !server.stateLoader)
            throw Error('AUTHOR_HOST_SERVER_ABI_UNSUPPORTED');
        let host;
        try {
            current();
            const admittedHost = admit(assets, selectedRoles, 'host', hostName);
            if (admittedHost.binding && admittedHost.binding.factory !== 'host-v5')
                throw Error('AUTHOR_HOST_ABI_UNSUPPORTED');
            const hostModule = await import(__rewriteRelativeImportExtension(pathToFileURL(admittedHost.entry).href));
            current();
            host = await hostModule.createOwnedAuthorHostRuntimeV5({
                verifyOwnedPackage: packageVerifier(admittedHost),
                server: server
            });
            current();
            return Object.freeze({ executorVersion: 4, compiler: server.compiler, runner: server.runner,
                bridge: server.bridge, libraries: server.libraries, stateLoader: server.stateLoader,
                implementationKey: recordSha256(host.identity), host, dispose });
        }
        catch (error) {
            host?.dispose();
            throw error;
        }
    }
    async function admitted(roles, server, key = 'default') {
        current();
        // A frozen Host package is shared by distinct injected server
        // tuples. Historical identity, rather than its package name, owns reuse.
        let pending = runtimes.get(key);
        if (!pending) {
            pending = load(roles, server)
                .then(runtime => {
                runtimesByIdentity.set(runtime.implementationKey + ':' + recordSha256(runtime.host.server), runtime);
                return runtime;
            })
                .catch(error => { runtimes.delete(key); throw error; });
            runtimes.set(key, pending);
        }
        const runtime = await pending;
        current();
        runtime.host.checkCurrent();
        return runtime;
    }
    async function getEjs(engine, signal) {
        current();
        signal?.throwIfAborted();
        const assets = await productAssets(), identity = assets.identity;
        current();
        const selected = engine ? identity.releasedRuntime?.templateEjs?.find(row => recordSha256(row.engine) === recordSha256(engine))?.component : undefined;
        const ref = selected ?? identity.currentRuntime?.roles.templateEjs;
        if (!ref)
            throw Error('TEMPLATE_EJS_ENGINE_UNAVAILABLE');
        const key = ref.name + '\0' + ref.generation + '\0' + (ref.context ?? '');
        const defaultRef = identity.currentRuntime?.roles.templateEjs;
        // A historical replay may admit another generation without making that
        // instance available to a fresh opening under today's current role.
        if (defaultRef && ref.name === defaultRef.name && ref.generation === defaultRef.generation
            && ref.context === defaultRef.context)
            defaultEjsKey = key;
        let state = ejsRuntimes.get(key);
        if (!state) {
            const pending = (async () => {
                const owned = admit(assets, { templateEjs: ref }, 'templateEjs', EJS_RUNTIME_PACKAGE);
                if (owned.binding?.factory !== 'template-ejs-v1')
                    throw Error('TEMPLATE_EJS_ENGINE_UNAVAILABLE');
                const module = await import(__rewriteRelativeImportExtension(pathToFileURL(owned.entry).href));
                current();
                const runtime = await module.createOwnedTavernEjsRuntimeV1({ verifyOwnedPackage: root => {
                        current();
                        return packageVerifier(owned)(root);
                    } });
                try {
                    current();
                    runtime.current();
                    return runtime;
                }
                catch (error) {
                    await runtime.dispose();
                    throw error;
                }
            })().then(runtime => { ejsRuntimes.get(key).runtime = runtime; return runtime; })
                .catch(error => { ejsRuntimes.delete(key); throw error; });
            state = { pending };
            ejsRuntimes.set(key, state);
        }
        const runtime = await state.pending;
        current();
        signal?.throwIfAborted();
        runtime.current();
        if (engine && recordSha256(runtime.identity) !== recordSha256(engine))
            throw Error('TEMPLATE_EJS_ENGINE_UNAVAILABLE');
        return runtime;
    }
    function currentEjs() {
        if (closed || defaultEjsKey === undefined)
            return undefined;
        const runtime = ejsRuntimes.get(defaultEjsKey)?.runtime;
        runtime?.current();
        return runtime;
    }
    function checkEjsCurrentSync(checks) {
        current();
        const runtime = defaultEjsKey === undefined ? undefined : ejsRuntimes.get(defaultEjsKey)?.runtime;
        if (!runtime)
            throw Error('TEMPLATE_EJS_ENGINE_UNAVAILABLE');
        runtime.checkCurrentSync(checks);
        current();
    }
    function dispose() {
        if (disposal)
            return disposal;
        closed = true;
        return disposal = (async () => {
            await Promise.all([...runtimes.values()].map(async (pending) => {
                try {
                    const runtime = await pending;
                    runtime.host.dispose();
                }
                catch { /* A revoked load cleans up its own created factories. */ }
            }));
            await Promise.all([...ejsRuntimes.values()].map(async (state) => {
                const runtime = await state.pending.catch(() => undefined);
                await runtime?.dispose();
            }));
            // The injected server asset owner retains its independent ABI1–4 lifetime.
        })();
    }
    return {
        getDefault: () => admitted(), getEjs, currentEjs, checkEjsCurrentSync,
        async getForVerifiedHost(identity, server) {
            current();
            try {
                // Compute both lookup identities before admission yields. A persisted
                // tuple is DATA only, including the real stateLoader member.
                const hostKey = recordSha256(identity), serverKey = recordSha256(server);
                const known = runtimesByIdentity.get(hostKey + ':' + serverKey);
                if (known) {
                    known.host.checkCurrent();
                    return known;
                }
                const { identity: catalog } = await productAssets();
                current();
                const entry = catalog.releasedRuntime?.authors.find(row => recordSha256(row.host) === hostKey && recordSha256(row.server) === serverKey);
                const selectedServer = entry ? await deps.serverAssets.getForVerifiedEpoch({ compiler: server.compiler,
                    bridge: server.bridge, libraries: server.libraries, runner: server.runner }) : undefined;
                const runtime = await admitted(entry?.roles, selectedServer, entry ? hostKey + ':' + serverKey : 'default');
                if (runtime.implementationKey !== hostKey || recordSha256(runtime.host.server) !== serverKey) {
                    throw Error('AUTHOR_HOST_HISTORY_UNAVAILABLE');
                }
                return runtime;
            }
            catch {
                current();
                throw Error('AUTHOR_HOST_HISTORY_UNAVAILABLE');
            }
        }, dispose,
    };
}
