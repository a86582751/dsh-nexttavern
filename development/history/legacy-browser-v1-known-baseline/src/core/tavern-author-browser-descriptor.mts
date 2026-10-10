/** One component role contract. The manifest owns source/delivery mappings;
 * these fixed package-relative roles are the factory's execution protocol. */
import {createHash} from 'node:crypto'

export const AUTHOR_BROWSER_RUNTIME_NAME='dsh-nexttavern-author-browser-runtime-v1'
export const AUTHOR_BROWSER_RUNTIME_VERSION='0.1.0'
export const AUTHOR_BROWSER_RUNTIME_PINS=Object.freeze({typescript:'5.9.3' as const})
export const AUTHOR_BROWSER_RUNTIME_DESCRIPTOR='assets/runtime.json'
export const AUTHOR_BROWSER_SOURCE_INPUTS='assets/source-inputs.json'
export const AUTHOR_BROWSER_MODULES=Object.freeze({provider:'dist/index.mjs',partition:'dist/partition.mjs',
  'ast-worker':'dist/browser-ast-worker.mjs',child:'dist/browser-runtime-child.js',guard:'dist/browser-runtime-guard.js'})
export type AuthorBrowserRuntimeRoleV1=keyof typeof AUTHOR_BROWSER_MODULES
export interface AuthorBrowserRuntimeFileV1 {readonly path:string;readonly sha256:string}
export interface AuthorBrowserRuntimeDescriptorV1 {
  readonly schemaVersion:1
  readonly name:typeof AUTHOR_BROWSER_RUNTIME_NAME
  readonly version:typeof AUTHOR_BROWSER_RUNTIME_VERSION
  readonly modules:typeof AUTHOR_BROWSER_MODULES
  readonly dependencies:typeof AUTHOR_BROWSER_RUNTIME_PINS
  readonly profileSha256:string
  readonly capabilityContractSha256:string
}
export const authorBrowserAssetSha=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
export function authorBrowserImplementationV1(kind:'compiler'|'runtime',
  modules:readonly AuthorBrowserRuntimeFileV1[],typescriptArtifactSha256:string,profileSha256:string):string {
  return authorBrowserAssetSha(JSON.stringify({encoding:'native-author-browser-delivery-identity-v1',kind,
    modules,typescriptArtifactSha256,profileSha256}))
}
