/** One captured MVU start owns macro expansion. Resumes and cold replay consume
 * the accepted projection in that start's existing journal input. */
import {produceRoleplayTavernMacroSnapshotV1} from './roleplay-tavern-prompt-macros.js'
import {createTavernPromptMacroProjectorV1} from './tavern-prompt-transform-execution.mjs'
import {TAVERN_PROMPT_TRANSFORM_LIMITS_V1 as limits} from './tavern-prompt-transform-types.mjs'
import type {TavernTemplateReadV1} from './tavern-template-types.mjs'
import type {Mvu196MacroProjectionV1} from './tavern-mvu-update-protocol-v1.js'
import type {TavernPromptMacroSnapshotV1} from './tavern-prompt-transform-types.mjs'
import {TAVERN_NATIVE_MACRO_POLICY_SHA256} from './roleplay-tavern-prompt-macros.js'

export function projectRoleplayMvuMacrosV1(message:string,
  input:Parameters<typeof produceRoleplayTavernMacroSnapshotV1>[0]):Mvu196MacroProjectionV1 {
  const macros=produceRoleplayTavernMacroSnapshotV1(input)
  return projectRoleplayMvuMacroSnapshotV1(message,macros.snapshot,macros.policySha256)
}
export function projectRoleplayMvuMacroSnapshotV1(message:string,snapshot:TavernPromptMacroSnapshotV1,
  policySha256=TAVERN_NATIVE_MACRO_POLICY_SHA256):Mvu196MacroProjectionV1 {
  const reads=new Map<string,TavernTemplateReadV1>()
  let jobs=0,workChars=0,matches=0
  const limit=(field:'jobs'|'workChars'|'matches'|'outputChars',observed:number)=>{
    if(observed>limits[field])throw Error('PROMPT_TRANSFORM_LIMIT')
  }
  const projector=createTavernPromptMacroProjectorV1(snapshot,{
    issue:code=>{throw Error(code)},recordRead:read=>{
      reads.set(JSON.stringify([read.kind,read.purpose,read.scope,read.ownerId,read.key,
        read.entryId,read.sourcePointer]),read)
    },budget:{job:()=>limit('jobs',++jobs),work:chars=>{workChars+=chars;limit('workChars',workChars)},
      match:()=>limit('matches',++matches),output:chars=>limit('outputChars',chars)},
  })
  return {schemaVersion:1,expandedMessage:projector.project(message),policySha256,
    reads:[...reads.values()]}
}
