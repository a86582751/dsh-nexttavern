// Generated from runtime/alpha3/src/core/tavern-author-browser-descriptor-v2.mts; edit the TypeScript source.
/** Fixed package roles; delivery paths remain the source manifest's ownership. */
import { createHash } from 'node:crypto';
export const AUTHOR_BROWSER_RUNTIME_NAME_V2 = 'dsh-nexttavern-author-browser-runtime-v2-native-personas-v1';
export const AUTHOR_BROWSER_RUNTIME_VERSION_V2 = '0.1.0';
export const AUTHOR_BROWSER_RUNTIME_PINS_V2 = Object.freeze({ typescript: '5.9.3',
    'quickjs-emscripten-core': '0.32.0', '@jitl/quickjs-ffi-types': '0.32.0',
    '@jitl/quickjs-wasmfile-release-asyncify': '0.32.0' });
export const AUTHOR_BROWSER_RUNTIME_DESCRIPTOR_V2 = 'assets/runtime.json';
export const AUTHOR_BROWSER_SOURCE_INPUTS_V2 = 'assets/source-inputs.json';
export const AUTHOR_BROWSER_MODULES_V2 = Object.freeze({ provider: 'dist/index.mjs', partition: 'dist/partition.mjs',
    'ast-worker': 'dist/browser-ast-worker.mjs', 'execution-worker': 'dist/browser-execution-worker.js',
    child: 'dist/browser-runtime-child.js', guard: 'dist/browser-runtime-guard.js' });
export const AUTHOR_BROWSER_WASM_V2 = 'assets/emscripten-module.wasm';
export const AUTHOR_BROWSER_WASM_SHA256_V2 = 'b790f3842eef48d154984cea48d35303b5c3c3696fedab4dc79f314bde005dba';
export const AUTHOR_BROWSER_ASYNCIFY_INTEGRITY_V2 = 'sha512-3oSwPfja12ICz4aIblB58cuY8JlEq5Txt8Cut4VLo+LH47QN+mzCnSgnbB03hWzg1LBcc+VyyI9UOag7a1NF+Q==';
export const authorBrowserAssetShaV2 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function authorBrowserImplementationV2(kind, modules, dependencies, profileSha256) {
    return authorBrowserAssetShaV2(JSON.stringify({ encoding: 'native-author-browser-delivery-identity-v2', kind,
        modules, dependencies, profileSha256 }));
}
