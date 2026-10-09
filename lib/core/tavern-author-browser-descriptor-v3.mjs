// Generated from runtime/alpha3/src/core/tavern-author-browser-descriptor-v3.mts; edit the TypeScript source.
/** Fixed Worker/compiler roles. The Source manifest owns their delivery map;
 * Main Native runs the static UI and is outside these execution asset bytes. */
import { createHash } from 'node:crypto';
import { AUTHOR_BROWSER_RUNTIME_PINS_V2, AUTHOR_BROWSER_WASM_V2, AUTHOR_BROWSER_WASM_SHA256_V2, AUTHOR_BROWSER_ASYNCIFY_INTEGRITY_V2 } from './tavern-author-browser-descriptor-v2.mjs';
export const AUTHOR_BROWSER_RUNTIME_NAME_V3 = 'dsh-nexttavern-author-browser-runtime-v3-script-resources-v1';
export const AUTHOR_BROWSER_RUNTIME_VERSION_V3 = '0.1.0';
export const AUTHOR_BROWSER_RUNTIME_PINS_V3 = AUTHOR_BROWSER_RUNTIME_PINS_V2;
export const AUTHOR_BROWSER_RUNTIME_DESCRIPTOR_V3 = 'assets/runtime.json';
export const AUTHOR_BROWSER_SOURCE_INPUTS_V3 = 'assets/source-inputs.json';
export const AUTHOR_BROWSER_MODULES_V3 = Object.freeze({ provider: 'dist/index.mjs',
    'ast-worker': 'dist/browser-ast-worker.mjs', 'execution-worker': 'dist/browser-execution-worker.js' });
export const AUTHOR_BROWSER_WASM_V3 = AUTHOR_BROWSER_WASM_V2;
export const AUTHOR_BROWSER_WASM_SHA256_V3 = AUTHOR_BROWSER_WASM_SHA256_V2;
export const AUTHOR_BROWSER_ASYNCIFY_INTEGRITY_V3 = AUTHOR_BROWSER_ASYNCIFY_INTEGRITY_V2;
export const authorBrowserAssetShaV3 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function authorBrowserImplementationV3(kind, modules, dependencies, profileSha256, capabilityContractSha256) {
    return authorBrowserAssetShaV3(JSON.stringify({ encoding: 'native-author-browser-delivery-identity-v3', kind,
        modules, dependencies, profileSha256, capabilityContractSha256 }));
}
