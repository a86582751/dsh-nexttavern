// Generated from runtime/alpha3/src/core/roleplay-author-host-assets.ts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** Core admits real Browser1/Host5 package bytes before importing either
 * factory. The admitted generation then owns this one lazy lifecycle. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { recordSha256 } from './roleplay-data.js';
import { AUTHOR_PROMPT_RUNTIME_NAME, AUTHOR_PROMPT_RUNTIME_VERSION } from './tavern-author-prompt-descriptor.mjs';
import { loadAdmittedAuthorPromptRuntimeV1 } from './roleplay-author-prompt-assets.js';
const browserName = 'dsh-nexttavern-author-browser-runtime-v1', browserVersion = '0.1.0';
const hostName = 'dsh-nexttavern-author-host-runtime-v5', hostVersion = '0.5.1';
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
    let closed = false, pending, disposal;
    const current = () => { if (closed)
        throw Error('AUTHOR_HOST_RUNTIME_DISPOSED'); };
    async function load() {
        const root = productRoot(), require = createRequire(path.join(root, 'package.json'));
        const bootstrap = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(root, 'lib/operations/bundled-package-bootstrap.mjs')).href));
        const protection = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(root, 'lib/operations/protected-packages.mjs')).href));
        current();
        const identity = bootstrap.readBundleIdentity(root);
        if (identity.productRoot !== root)
            throw Error('AUTHOR_HOST_INVENTORY_OWNER_CHANGED');
        function admit(name, version) {
            const specs = identity.packages.filter(spec => spec.name === name);
            const owned = fs.realpathSync(path.join(root, 'node_modules', name));
            const metadata = fs.realpathSync(require.resolve(name + '/package.json'));
            const entry = fs.realpathSync(require.resolve(name));
            if (specs.length !== 1 || specs[0].version !== version || metadata !== path.join(owned, 'package.json')
                || entry !== path.join(owned, 'dist', 'index.mjs'))
                throw Error('AUTHOR_HOST_PACKAGE_OWNER_CHANGED');
            const spec = specs[0];
            protection.verifyProtectedPackage(owned, spec);
            return { entry, owned, inventory: { name, version, files: structuredClone(spec.files), generation: spec.generation } };
        }
        const server = await deps.serverAssets.getDefaultForNewRealm(4);
        current();
        if (server.executorVersion !== 4 || !server.stateLoader)
            throw Error('AUTHOR_HOST_SERVER_ABI_UNSUPPORTED');
        const admittedBrowser = admit(browserName, browserVersion);
        const browserModule = await import(__rewriteRelativeImportExtension(pathToFileURL(admittedBrowser.entry).href));
        current();
        const browser = await browserModule.createOwnedAuthorBrowserRuntimeV1({ verifyOwnedPackage: packageVerifier(admittedBrowser) });
        let host, prompt;
        try {
            current();
            const admittedPrompt = admit(AUTHOR_PROMPT_RUNTIME_NAME, AUTHOR_PROMPT_RUNTIME_VERSION);
            prompt = await loadAdmittedAuthorPromptRuntimeV1({ ...admittedPrompt, inventory: { ...admittedPrompt.inventory,
                    name: AUTHOR_PROMPT_RUNTIME_NAME, version: AUTHOR_PROMPT_RUNTIME_VERSION } }, current);
            current();
            const admittedHost = admit(hostName, hostVersion);
            const hostModule = await import(__rewriteRelativeImportExtension(pathToFileURL(admittedHost.entry).href));
            current();
            host = await hostModule.createOwnedAuthorHostRuntimeV5({
                verifyOwnedPackage: fixed => packageVerifier(admittedHost)(fixed),
                server: server, browser, prompt
            });
            current();
            return Object.freeze({ executorVersion: 4, compiler: server.compiler, runner: server.runner,
                bridge: server.bridge, libraries: server.libraries, stateLoader: server.stateLoader,
                implementationKey: recordSha256(host.identity), host, browser, prompt, dispose });
        }
        catch (error) {
            host?.dispose();
            await Promise.all([browser.dispose(), prompt?.dispose()]);
            throw error;
        }
    }
    async function admitted() {
        current();
        if (!pending)
            pending = load().catch(error => { pending = undefined; throw error; });
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
            if (!pending)
                return;
            try {
                const runtime = await pending;
                runtime.host.dispose();
                await Promise.all([runtime.browser.dispose(), runtime.prompt.dispose()]);
            }
            catch { /* A revoked load cleans up its own created factories. */ }
            // The injected server asset owner retains its independent ABI1–4 lifetime.
        })();
    }
    return {
        getDefault: admitted,
        async getForVerifiedHost(identity, server) {
            try {
                // Compute both lookup identities before admission yields. A persisted
                // tuple is DATA only, including the real stateLoader member.
                const hostKey = recordSha256(identity), serverKey = recordSha256(server);
                const runtime = await admitted();
                if (runtime.implementationKey !== hostKey || recordSha256(runtime.host.server) !== serverKey) {
                    throw Error('AUTHOR_HOST_HISTORY_UNAVAILABLE');
                }
                return runtime;
            }
            catch {
                throw Error('AUTHOR_HOST_HISTORY_UNAVAILABLE');
            }
        }, dispose,
    };
}
