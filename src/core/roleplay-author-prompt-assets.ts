/** Host's existing asset owner admits this independent package before import.
 * This helper consumes that fixed observation, never another product scan or
 * owner. Host alone closes the returned runtime with its Browser lifecycle. */
import fs from 'node:fs'
import {fileURLToPath,pathToFileURL} from 'node:url'
import type {AdmittedTypeScript} from 'dsh-nexttavern-typescript-runtime'
import type {AuthorPromptOwnedInventoryV1,OwnedAuthorPromptRuntimeV1} from './tavern-author-prompt-types.mjs'

export interface AdmittedAuthorPromptPackageV1 {
  readonly entry:string
  readonly owned:string
  readonly inventory:AuthorPromptOwnedInventoryV1
}
export async function loadAdmittedAuthorPromptRuntimeV1(admitted:AdmittedAuthorPromptPackageV1,
  checkOwnerCurrent:()=>void,typescript?:AdmittedTypeScript):Promise<OwnedAuthorPromptRuntimeV1> {
  const verifyOwnedPackage=(url:URL):AuthorPromptOwnedInventoryV1=>{
    checkOwnerCurrent()
    if(url.protocol!=='file:'||fs.realpathSync(fileURLToPath(url))!==admitted.owned) {
      throw Error('AUTHOR_PROMPT_PACKAGE_OWNER_CHANGED')
    }
    return admitted.inventory
  }
  checkOwnerCurrent()
  const module=await import(pathToFileURL(admitted.entry).href)
  checkOwnerCurrent()
  // The component selection already identifies the factory ABI. Historical
  // Prompt bytes consume their original compiler instead of today's owner.
  const runtime=typescript
    ?await (module as typeof import('./tavern-author-prompt-provider.mjs'))
      .createOwnedAuthorPromptRuntimeV1({verifyOwnedPackage,typescript})
    :await (module as {
      createOwnedAuthorPromptRuntimeV1(deps:{verifyOwnedPackage(url:URL):AuthorPromptOwnedInventoryV1}):
        Promise<OwnedAuthorPromptRuntimeV1>
    }).createOwnedAuthorPromptRuntimeV1({verifyOwnedPackage})
  try {checkOwnerCurrent();runtime.checkCurrent();return runtime}
  catch(error) {await runtime.dispose();throw error}
}
