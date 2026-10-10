// Generated from runtime/alpha3/compat/author-browser-runtime-v3-source-html-v1/src/tavern-author-browser-provider.mts; edit the TypeScript source.
/** Core admits the physical package before importing this entry. */
import { AUTHOR_BROWSER_RUNTIME_NAME_V3, AUTHOR_BROWSER_RUNTIME_VERSION_V3 } from '../../../src/core/tavern-author-browser-descriptor-v3.mjs';
import { createOwnedAuthorBrowserCompilerV3 } from '../../../src/core/tavern-author-browser-partition-v3.mjs';
const ownRoot = new URL('../', import.meta.url);
let generation;
export async function createOwnedAuthorBrowserRuntimeV3(deps) {
    const inventory = deps.verifyOwnedPackage(new URL(ownRoot));
    if (inventory.name !== AUTHOR_BROWSER_RUNTIME_NAME_V3 || inventory.version !== AUTHOR_BROWSER_RUNTIME_VERSION_V3)
        throw Error('BROWSER_RUNTIME_ASSETS_UNAVAILABLE');
    if (generation !== undefined && generation !== inventory.generation)
        throw Error('BROWSER_RUNTIME_GENERATION_CHANGED');
    generation ??= inventory.generation;
    return createOwnedAuthorBrowserCompilerV3();
}
