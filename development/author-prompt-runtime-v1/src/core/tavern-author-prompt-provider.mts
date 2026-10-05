/** Core's preimport protected-package admission fixes this actual component
 * generation. This factory owns the package-relative worker and lifecycle. */
import {recordSha256} from './roleplay-data.js'
import {createAuthorPromptExecutionOwnerV1} from './tavern-author-prompt-runtime.mjs'
import {AUTHOR_PROMPT_RUNTIME_NAME,AUTHOR_PROMPT_RUNTIME_VERSION,AUTHOR_PROMPT_MODULES,
  AUTHOR_PROMPT_RUNTIME_PINS} from './tavern-author-prompt-descriptor.mjs'
import {PROMPT_PROFILE_SHA256_V1} from './tavern-author-prompt-profile.mjs'
import type {AuthorPromptOwnedInventoryV1,OwnedAuthorPromptRuntimeV1} from './tavern-author-prompt-types.mjs'

let loadedGeneration:string|undefined
const ownRoot=new URL('../',import.meta.url)
export function createOwnedAuthorPromptRuntimeV1(deps:{
  verifyOwnedPackage(root:URL):AuthorPromptOwnedInventoryV1
}):OwnedAuthorPromptRuntimeV1 {
  const pin=deps.verifyOwnedPackage(new URL(ownRoot))
  if(pin.name!==AUTHOR_PROMPT_RUNTIME_NAME||pin.version!==AUTHOR_PROMPT_RUNTIME_VERSION)
    throw Error('PROMPT_PACKAGE_OWNER_CHANGED')
  if(loadedGeneration!==undefined&&loadedGeneration!==pin.generation)throw Error('PROMPT_GENERATION_RESTART_REQUIRED')
  loadedGeneration??=pin.generation
  const identity=(kind:string)=>recordSha256({encoding:'native-author-prompt-delivery-identity-v1',kind,
    generation:pin.generation,profileSha256:PROMPT_PROFILE_SHA256_V1,pins:AUTHOR_PROMPT_RUNTIME_PINS})
  return createAuthorPromptExecutionOwnerV1({
    compiler:{id:'native-author-prompt-profile-compiler',version:1,typescriptVersion:'5.9.3',implementationSha256:identity('compiler')},
    runtime:{id:'native-author-prompt-quickjs-runtime',version:1,quickjsVersion:'0.32.0',implementationSha256:identity('runtime')},
    worker:new URL(AUTHOR_PROMPT_MODULES.worker,ownRoot),
  })
}
