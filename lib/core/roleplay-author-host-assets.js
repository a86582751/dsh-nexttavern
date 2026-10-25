// Generated from runtime/alpha3/src/core/roleplay-author-host-assets.ts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** Core admits real Browser/Host5 package bytes before importing either
 * factory. The admitted generation then owns this one lazy lifecycle. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { recordSha256 } from './roleplay-data.js';
import { AUTHOR_BROWSER_RUNTIME_NAME_V3, AUTHOR_BROWSER_RUNTIME_VERSION_V3 } from './tavern-author-browser-descriptor-v3.mjs';
import { AUTHOR_PROMPT_RUNTIME_NAME, AUTHOR_PROMPT_RUNTIME_VERSION } from './tavern-author-prompt-descriptor.mjs';
import { loadAdmittedAuthorPromptRuntimeV1 } from './roleplay-author-prompt-assets.js';
const browserName = AUTHOR_BROWSER_RUNTIME_NAME_V3, browserVersion = AUTHOR_BROWSER_RUNTIME_VERSION_V3;
const hostName = 'dsh-nexttavern-author-host-runtime-v5-update-batch-v1', hostVersion = '0.6.0';
function productRoot() {
    // These are the registered root/lib/core and preset/lib/core deliveries.
    for (const relative of ['../../', '../../../']) {
        const root = fs.realpathSync(fileURLToPath(new URL(relative, import.meta.url)));
        const metadata = path.join(root, 'package.json');
        if (!fs.existsSync(metadata))
            continue;
        const product = JSON.parse(fs.readFileSync(metadata, 'utf8'));
        if (product.name === 'dsh-nexttavern' && product.dependencies?.[browserName] === browserVersion
            && product.dependencies?.[hostName] === hostVersion
            && product.dependencies?.[AUTHOR_PROMPT_RUNTIME_NAME] === AUTHOR_PROMPT_RUNTIME_VERSION)
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
    async function load(roles, selectedServer) {
        const { root, require, identity, protection } = await productAssets();
        current();
        const selectedRoles = roles ?? identity.currentRuntime?.roles;
        function admit(role, fallback) {
            const ref = selectedRoles?.[role], binding = ref ? identity.runtimeComponents.get(ref.name + '\0' + ref.generation + '\0' + (ref.context ?? '')) : undefined;
            const name = binding?.name ?? fallback, historical = binding?.path !== undefined;
            const specs = selectedRoles ? binding ? [binding] : [] : identity.packages.filter(spec => spec.name === name);
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
        const server = selectedServer ?? await deps.serverAssets.getDefaultForNewRealm(4);
        current();
        if (server.executorVersion !== 4 || !server.stateLoader)
            throw Error('AUTHOR_HOST_SERVER_ABI_UNSUPPORTED');
        async function loadBrowser(role) {
            const admittedBrowser = admit(role, browserName);
            const factory = admittedBrowser.binding?.factory ?? 'browser-v3-shared-typescript';
            if (factory === 'browser-v3-shared-typescript') {
                const browserModule = await import(__rewriteRelativeImportExtension(pathToFileURL(admittedBrowser.entry).href));
                if (admittedBrowser.binding && !admittedBrowser.binding.dependencies.typescript)
                    throw Error('AUTHOR_HOST_TYPESCRIPT_UNAVAILABLE');
                const typescript = await deps.serverAssets.getTypeScript(admittedBrowser.binding?.dependencies.typescript);
                current();
                return browserModule.createOwnedAuthorBrowserRuntimeV3({
                    verifyOwnedPackage: packageVerifier(admittedBrowser), typescript
                });
            }
            if (factory !== 'browser-v2-local-typescript')
                throw Error('AUTHOR_HOST_BROWSER_ABI_UNSUPPORTED');
            // The published Browser2 factory owns its package-local compiler.
            const browserModule = await import(__rewriteRelativeImportExtension(pathToFileURL(admittedBrowser.entry).href));
            current();
            const dependency = { verifyOwnedPackage: packageVerifier(admittedBrowser) };
            return browserModule.createOwnedAuthorBrowserRuntimeV2(dependency);
        }
        const browser = await loadBrowser('browser');
        let browserPartition;
        let host, prompt;
        try {
            current();
            if (selectedRoles?.browserPartition) {
                browserPartition = await loadBrowser('browserPartition');
            }
            current();
            const admittedPrompt = admit('prompt', AUTHOR_PROMPT_RUNTIME_NAME);
            if (admittedPrompt.binding && (admittedPrompt.binding.factory !== 'prompt-v1-shared-typescript'
                || !admittedPrompt.binding.dependencies.typescript))
                throw Error('AUTHOR_HOST_PROMPT_ABI_UNSUPPORTED');
            prompt = await loadAdmittedAuthorPromptRuntimeV1({ ...admittedPrompt, inventory: { ...admittedPrompt.inventory,
                    name: AUTHOR_PROMPT_RUNTIME_NAME, version: admittedPrompt.inventory.version } }, current, await deps.serverAssets.getTypeScript(admittedPrompt.binding?.dependencies.typescript));
            current();
            const admittedHost = admit('host', hostName);
            if (admittedHost.binding && admittedHost.binding.factory !== 'host-v5')
                throw Error('AUTHOR_HOST_ABI_UNSUPPORTED');
            const hostModule = await import(__rewriteRelativeImportExtension(pathToFileURL(admittedHost.entry).href));
            current();
            host = await hostModule.createOwnedAuthorHostRuntimeV5({
                verifyOwnedPackage: packageVerifier(admittedHost),
                server: server, browser, ...browserPartition ? { browserPartition } : {}, prompt
            });
            current();
            return Object.freeze({ executorVersion: 4, compiler: server.compiler, runner: server.runner,
                bridge: server.bridge, libraries: server.libraries, stateLoader: server.stateLoader,
                implementationKey: recordSha256(host.identity), host, browser, ...browserPartition ? { browserPartition } : {}, prompt, dispose });
        }
        catch (error) {
            host?.dispose();
            await Promise.all([browser.dispose(), browserPartition?.dispose(), prompt?.dispose()]);
            throw error;
        }
    }
    async function admitted(roles, server, key = 'default') {
        current();
        // A frozen Host package is shared by distinct injected Browser/server
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
    function dispose() {
        if (disposal)
            return disposal;
        closed = true;
        return disposal = (async () => {
            await Promise.all([...runtimes.values()].map(async (pending) => {
                try {
                    const runtime = await pending;
                    runtime.host.dispose();
                    await Promise.all([runtime.browser.dispose(), runtime.browserPartition?.dispose(), runtime.prompt.dispose()]);
                }
                catch { /* A revoked load cleans up its own created factories. */ }
            }));
            // The injected server asset owner retains its independent ABI1–4 lifetime.
        })();
    }
    return {
        getDefault: () => admitted(),
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
