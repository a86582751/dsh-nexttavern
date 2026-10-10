/** Public async-only factory. Core admits the actual protected package once;
 * the private partition module owns fixed byte binding and worker lifecycle. */
import {AUTHOR_BROWSER_RUNTIME_NAME,AUTHOR_BROWSER_RUNTIME_VERSION}
  from '../../../src/core/tavern-author-browser-descriptor.mjs'
import type {AuthorBrowserRuntimeFileV1} from '../../../src/core/tavern-author-browser-descriptor.mjs'
import type {OwnedAuthorBrowserRuntimeV1} from '../../../src/core/tavern-author-browser-types.mjs'

export interface AuthorBrowserRuntimeInventoryV1 {
  readonly name:string;readonly version:string
  readonly files:readonly AuthorBrowserRuntimeFileV1[]
  readonly generation:string
}
export interface OwnedAuthorBrowserRuntimeDepsV1 {
  verifyOwnedPackage(packageRootURL:URL):AuthorBrowserRuntimeInventoryV1
}
const ownRoot=new URL('../',import.meta.url)
let loadedGeneration:string|undefined
export async function createOwnedAuthorBrowserRuntimeV1(deps:OwnedAuthorBrowserRuntimeDepsV1):Promise<OwnedAuthorBrowserRuntimeV1> {
  const admitted=deps.verifyOwnedPackage(new URL(ownRoot))
  if(admitted.name!==AUTHOR_BROWSER_RUNTIME_NAME||admitted.version!==AUTHOR_BROWSER_RUNTIME_VERSION) {
    throw Error('BROWSER_RUNTIME_ASSETS_UNAVAILABLE')
  }
  // An ESM module at a cached physical URL cannot claim changed bytes. Core's
  // next protected generation needs its own module URL or a fresh process.
  if(loadedGeneration!==undefined&&loadedGeneration!==admitted.generation)throw Error('BROWSER_RUNTIME_GENERATION_CHANGED')
  loadedGeneration??=admitted.generation
  const module=await import(new URL('./partition.mjs',import.meta.url).href) as {
    createBrowserPartitionCompilerV1():OwnedAuthorBrowserRuntimeV1}
  return module.createBrowserPartitionCompilerV1()
}
