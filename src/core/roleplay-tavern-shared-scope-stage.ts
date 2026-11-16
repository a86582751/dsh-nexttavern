/** A preparation owns ordered in-memory effects. Native acceptance later
 * publishes this plan through the persistent scope's existing contribution. */
import {recordSha256,sha256} from './roleplay-data.js'
import {applyAuthorVariableWritesV1} from './roleplay-author-variable-effects.js'
import type {SharedScopePreparationCaptureV1,SharedScopePreparationPlanV1}
  from './community-preset-variables.js'
import type {AcceptedAuthorChatWriteV3} from './roleplay-author-chat-state-types.js'
import type {TavernTemplateScopeBindingV1} from './tavern-template-types.mjs'
import type {TavernPromptBindingV1,TavernPromptMacroSnapshotV1} from './tavern-prompt-transform-types.mjs'
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'

const text=(value:MvuJsonValue)=>value===null?'':typeof value==='object'?JSON.stringify(value):String(value)

export function createRoleplayTavernSharedScopeStageV1(capture:SharedScopePreparationCaptureV1,
  priorWrites:readonly AcceptedAuthorChatWriteV3[]=[],assertMutationAllowed?:()=>void) {
  let values:Readonly<MvuJsonObject>=capture.baseline.values
  const writes:AcceptedAuthorChatWriteV3[]=[]
  let binding:TavernTemplateScopeBindingV1|undefined
  let macros=new WeakMap<TavernPromptMacroSnapshotV1,TavernPromptMacroSnapshotV1>()
  function apply(changes:readonly AcceptedAuthorChatWriteV3[]) {
    if(!changes.length)return
    assertMutationAllowed?.()
    const next={...values}
    for(const write of changes) {
      const result=applyAuthorVariableWritesV1({exists:Object.hasOwn(next,write.key),value:next[write.key]??null},[write])
      if(result.exists)next[write.key]=result.value
      else delete next[write.key]
    }
    values=Object.freeze(next);writes.push(...changes)
    binding=undefined;macros=new WeakMap()
  }
  function scopeBinding():TavernTemplateScopeBindingV1 {
    if(binding)return binding
    const valuesSha256=recordSha256(values)
    binding={scope:'global',ownerId:capture.address.profileId,values,valuesSha256,
      versionSha256:recordSha256({root:capture.baseline.root,writes})}
    return binding
  }
  apply(priorWrites)
  return {
    get values(){return values},
    read:(key:string)=>values[key],
    apply,
    binding:scopeBinding,
    macros(base:TavernPromptMacroSnapshotV1):TavernPromptMacroSnapshotV1 {
      let result=macros.get(base)
      if(result)return result
      const scope=scopeBinding(),globalVariables:TavernPromptBindingV1[]=Object.entries(values).map(([key,value])=>{
        const rendered=text(value)
        return {key,value:rendered,valueSha256:sha256(rendered),read:{kind:'variable',purpose:'read',scope:'global',
          ownerId:scope.ownerId,key,present:true,versionSha256:scope.versionSha256,
          valueSha256:recordSha256(value),entryId:null,sourcePointer:null}}
      })
      result=Object.freeze({...base,globalVariables,
        variableScopes:{...base.variableScopes,global:scope}})
      macros.set(base,result)
      return result
    },
    plan():SharedScopePreparationPlanV1 {return {...capture,writes:[...writes]}},
  }
}

export type TavernSharedScopePreparationStageV1=ReturnType<typeof createRoleplayTavernSharedScopeStageV1>
