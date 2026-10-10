/** Fixed package roles; delivery paths remain the source manifest's ownership. */
import {createHash} from 'node:crypto'
export const AUTHOR_BROWSER_RUNTIME_NAME_V2='dsh-nexttavern-author-browser-runtime-v2'
export const AUTHOR_BROWSER_RUNTIME_VERSION_V2='0.1.0'
export const AUTHOR_BROWSER_RUNTIME_PINS_V2=Object.freeze({typescript:'5.9.3' as const,
  'quickjs-emscripten-core':'0.32.0' as const,'@jitl/quickjs-ffi-types':'0.32.0' as const,
  '@jitl/quickjs-wasmfile-release-asyncify':'0.32.0' as const})
export const AUTHOR_BROWSER_RUNTIME_DESCRIPTOR_V2='assets/runtime.json'
export const AUTHOR_BROWSER_SOURCE_INPUTS_V2='assets/source-inputs.json'
export const AUTHOR_BROWSER_MODULES_V2=Object.freeze({provider:'dist/index.mjs',partition:'dist/partition.mjs',
  'ast-worker':'dist/browser-ast-worker.mjs','execution-worker':'dist/browser-execution-worker.js',
  child:'dist/browser-runtime-child.js',guard:'dist/browser-runtime-guard.js'})
export const AUTHOR_BROWSER_WASM_V2='assets/emscripten-module.wasm'
export const AUTHOR_BROWSER_WASM_SHA256_V2='b790f3842eef48d154984cea48d35303b5c3c3696fedab4dc79f314bde005dba'
export const AUTHOR_BROWSER_ASYNCIFY_INTEGRITY_V2='sha512-3oSwPfja12ICz4aIblB58cuY8JlEq5Txt8Cut4VLo+LH47QN+mzCnSgnbB03hWzg1LBcc+VyyI9UOag7a1NF+Q=='
export type AuthorBrowserRuntimeRoleV2=keyof typeof AUTHOR_BROWSER_MODULES_V2
export interface AuthorBrowserRuntimeFileV2 {readonly path:string;readonly sha256:string}
export interface AuthorBrowserRuntimeDescriptorV2 {
  readonly schemaVersion:2
  readonly name:typeof AUTHOR_BROWSER_RUNTIME_NAME_V2
  readonly version:typeof AUTHOR_BROWSER_RUNTIME_VERSION_V2
  readonly modules:typeof AUTHOR_BROWSER_MODULES_V2
  readonly dependencies:typeof AUTHOR_BROWSER_RUNTIME_PINS_V2
  readonly wasm:{readonly path:typeof AUTHOR_BROWSER_WASM_V2;readonly sha256:typeof AUTHOR_BROWSER_WASM_SHA256_V2}
  readonly profileSha256:string
  readonly capabilityContractSha256:string
}
export const authorBrowserAssetShaV2=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
export function authorBrowserImplementationV2(kind:'compiler'|'runtime',
  modules:readonly AuthorBrowserRuntimeFileV2[],dependencies:readonly AuthorBrowserRuntimeFileV2[],profileSha256:string):string {
  return authorBrowserAssetShaV2(JSON.stringify({encoding:'native-author-browser-delivery-identity-v2',kind,
    modules,dependencies,profileSha256}))
}
