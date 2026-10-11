/** Core admits the physical package before importing this entry. */
import {AUTHOR_BROWSER_RUNTIME_NAME_V3,AUTHOR_BROWSER_RUNTIME_VERSION_V3}
  from '../../../src/core/tavern-author-browser-descriptor-v3.mjs'
import {createOwnedAuthorBrowserCompilerV3} from '../../../src/core/tavern-author-browser-partition-v3.mjs'
import type {OwnedAuthorBrowserRuntimeV3} from '../../../src/core/tavern-author-browser-types-v3.mjs'

export interface AuthorBrowserRuntimeInventoryV3 {
  readonly name:string
  readonly version:string
  readonly files:readonly {path:string;sha256:string}[]
  readonly generation:string
}
export interface OwnedAuthorBrowserRuntimeDepsV3 {
  verifyOwnedPackage(packageRootURL:URL):AuthorBrowserRuntimeInventoryV3
}
const ownRoot=new URL('../',import.meta.url)
let generation:string|undefined
export async function createOwnedAuthorBrowserRuntimeV3(deps:OwnedAuthorBrowserRuntimeDepsV3):Promise<OwnedAuthorBrowserRuntimeV3> {
  const inventory=deps.verifyOwnedPackage(new URL(ownRoot))
  if(inventory.name!==AUTHOR_BROWSER_RUNTIME_NAME_V3||inventory.version!==AUTHOR_BROWSER_RUNTIME_VERSION_V3)
    throw Error('BROWSER_RUNTIME_ASSETS_UNAVAILABLE')
  if(generation!==undefined&&generation!==inventory.generation)throw Error('BROWSER_RUNTIME_GENERATION_CHANGED')
  generation??=inventory.generation
  return createOwnedAuthorBrowserCompilerV3()
}
