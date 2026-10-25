import {verifyTemplateOwnedTreeV1,templateFactoryDeps} from './tavern-template-assets.mjs'
import {templateFail} from './tavern-template-data.mjs'
import {createOwnedTemplateControllerV1} from './tavern-template-controller.mjs'
import type {TavernTemplateOwnedInventoryV1,TavernTemplateCurrentRuntimeV1} from './tavern-template-types.mjs'

/** This module must be built to the registered component's dist/index.mjs.
 * Source-tree location is deliberately not an admitted execution component. */
const ownRoot=new URL('../',import.meta.url)
let loadedGeneration:string|undefined
// The compatibility read-only guard still excludes side effects from this
// module instance. It owns no filesystem observation or retained byte frame.
let readonlyScopeDepth=0
export async function createOwnedTavernTemplateRuntimeV1(deps:{
  verifyOwnedPackage(packageRootURL:URL):TavernTemplateOwnedInventoryV1
}):Promise<TavernTemplateCurrentRuntimeV1> {
  if(readonlyScopeDepth)templateFail('TEMPLATE_EXECUTION_IN_VERIFICATION_SCOPE')
  templateFactoryDeps(deps)
  const actual=verifyTemplateOwnedTreeV1(ownRoot,deps.verifyOwnedPackage(new URL(ownRoot)))
  if(loadedGeneration!==undefined&&loadedGeneration!==actual.inventory.generation)templateFail('TEMPLATE_GENERATION_RESTART_REQUIRED')
  loadedGeneration??=actual.inventory.generation
  let disposed=false
  const assertCurrentScopeInactive=()=>{
    if(readonlyScopeDepth)templateFail('TEMPLATE_EXECUTION_IN_VERIFICATION_SCOPE')
  }
  // Admission fixes the loaded generation. Upgrade/replacement creates a new
  // owner after disposal/restart; worker and pure checks never poll its files.
  const checkCurrent=()=>{
    if(disposed)templateFail('TEMPLATE_RUNTIME_DISPOSED')
    return actual.inventory
  }
  // Kept for the existing component API. There is no hot byte frame to clear.
  const invalidateCurrent=()=>{}
  const checkCurrentSync=(checks:()=>void):void=>{
    checkCurrent();readonlyScopeDepth++
    try {
      const returned=checks() as unknown
      if(returned&&typeof returned==='object'&&'then' in returned) {
        templateFail('TEMPLATE_RUNTIME_ASYNC_VERIFICATION_SCOPE')
      }
      checkCurrent()
    }finally {readonlyScopeDepth--}
  }
  const current=()=>{
    assertCurrentScopeInactive()
    return checkCurrent()
  }
  // The controller fixes its own sibling worker; neither factory options nor
  // a serialized template request can provide a worker URL or engine bytes.
  const runtime=createOwnedTemplateControllerV1({engine:actual.engine,inventory:actual.inventory,current,
    assertExecutionAllowed:assertCurrentScopeInactive}),dispose=runtime.dispose.bind(runtime)
  return Object.freeze(Object.assign(runtime,{checkCurrent,checkCurrentSync,invalidateCurrent,assertCurrentScopeInactive,
    dispose() {
      assertCurrentScopeInactive()
      disposed=true
      return dispose()
    }
  }))
}
export type {TavernTemplateRuntimeV1,TavernTemplateOwnedInventoryV1,TavernTemplateInjectionRestoreV1,
  TavernTemplateInjectionPhaseV1,TavernTemplateInjectionReceiptV1,TavernTemplateInjectionResultV1,
  TavernTemplateInjectionActionV1,TavernTemplateInjectionEffectV1,TavernTemplateInjectionPromptV1,
  TavernTemplateDisposalDerivationV1,TavernTemplateTrustedDisposalV1}
  from './tavern-template-types.mjs'
export {injectionCreationHeadV1,deriveTrustedInjectionDisposalReceiptV1} from './tavern-template-injection-data.mjs'
