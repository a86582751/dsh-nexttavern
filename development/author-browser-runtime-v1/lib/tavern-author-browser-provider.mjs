// Generated from runtime/alpha3/compat/author-browser-runtime-v1/src/tavern-author-browser-provider.mts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** Public async-only factory. Core admits the actual protected package once;
 * the private partition module owns fixed byte binding and worker lifecycle. */
import { AUTHOR_BROWSER_RUNTIME_NAME, AUTHOR_BROWSER_RUNTIME_VERSION } from '../../../src/core/tavern-author-browser-descriptor.mjs';
const ownRoot = new URL('../', import.meta.url);
let loadedGeneration;
export async function createOwnedAuthorBrowserRuntimeV1(deps) {
    const admitted = deps.verifyOwnedPackage(new URL(ownRoot));
    if (admitted.name !== AUTHOR_BROWSER_RUNTIME_NAME || admitted.version !== AUTHOR_BROWSER_RUNTIME_VERSION) {
        throw Error('BROWSER_RUNTIME_ASSETS_UNAVAILABLE');
    }
    // An ESM module at a cached physical URL cannot claim changed bytes. Core's
    // next protected generation needs its own module URL or a fresh process.
    if (loadedGeneration !== undefined && loadedGeneration !== admitted.generation)
        throw Error('BROWSER_RUNTIME_GENERATION_CHANGED');
    loadedGeneration ??= admitted.generation;
    const module = await import(__rewriteRelativeImportExtension(new URL('./partition.mjs', import.meta.url).href));
    return module.createBrowserPartitionCompilerV1();
}
