/** Protected package admission occurs once at this public factory. */
import {AUTHOR_BROWSER_RUNTIME_NAME_V2,AUTHOR_BROWSER_RUNTIME_VERSION_V2}
  from '../../../src/core/tavern-author-browser-descriptor-v2.mjs'
import type {AuthorBrowserRuntimeFileV2} from '../../../src/core/tavern-author-browser-descriptor-v2.mjs'
import type {OwnedAuthorBrowserRuntimeV2} from '../../../src/core/tavern-author-browser-types-v2.mjs'
export interface AuthorBrowserRuntimeInventoryV2 {
  readonly name:string;readonly version:string;readonly files:readonly AuthorBrowserRuntimeFileV2[];readonly generation:string
}
export interface OwnedAuthorBrowserRuntimeDepsV2 {
  verifyOwnedPackage(packageRootURL:URL):AuthorBrowserRuntimeInventoryV2
}
const ownRoot=new URL('../',import.meta.url)
let generation:string|undefined
export async function createOwnedAuthorBrowserRuntimeV2(deps:OwnedAuthorBrowserRuntimeDepsV2):Promise<OwnedAuthorBrowserRuntimeV2> {
  const inventory=deps.verifyOwnedPackage(new URL(ownRoot))
  if(inventory.name!==AUTHOR_BROWSER_RUNTIME_NAME_V2||inventory.version!==AUTHOR_BROWSER_RUNTIME_VERSION_V2)
    throw Error('BROWSER_RUNTIME_ASSETS_UNAVAILABLE')
  if(generation!==undefined&&generation!==inventory.generation)throw Error('BROWSER_RUNTIME_GENERATION_CHANGED')
  generation??=inventory.generation
  const module=await import(new URL('./partition.mjs',import.meta.url).href) as {
    createBrowserPartitionCompilerV2():OwnedAuthorBrowserRuntimeV2}
  return module.createBrowserPartitionCompilerV2()
}
