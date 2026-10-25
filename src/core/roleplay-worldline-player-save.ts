/** Shared player choice identity is independent of Native edit completion. */
import {recordSha256} from './roleplay-data.js'
import type {PlayerVariant} from './roleplay-worldline-types.js'
import type {SchemaTaskEditOptionsV1} from './roleplay-mvu-schema-task-edit-types.js'

export interface WorldlinePlayerSaveRefV1 {key:string;sha256:string}
type SaveBaseV1={currentSaveRef:WorldlinePlayerSaveRefV1}|{
  legacy:{textSha256:string;revision:number;schemaTaskEditOperationId?:string}
}
export interface WorldlinePlayerSaveIntentV1 {
  schemaVersion:1
  encoding:'nexttavern-worldline-player-save-intent-v1'
  groupId:string
  playerVariantId:string
  operationId:string
  requestSha256:string
  base:SaveBaseV1
  targetSessionIds:readonly string[]
}
interface SaveRequest {
  senderSessionId:string
  target:{sessionId:string;seq:number;messageId:string}
  text:string
  options:SchemaTaskEditOptionsV1
}
export const worldlinePlayerSaveIntentKey=(groupId:string,playerVariantId:string,operationId:string)=>
  `fork-player-save-${recordSha256({groupId,playerVariantId,operationId})}`
const sameRef=(a:WorldlinePlayerSaveRefV1|undefined,b:WorldlinePlayerSaveRefV1)=>
  a?.key===b.key&&a.sha256===b.sha256
function baseline(variant:PlayerVariant):SaveBaseV1 {
  return variant.currentSaveRef?{currentSaveRef:variant.currentSaveRef}:{legacy:{
    textSha256:recordSha256(variant.text),revision:variant.revision,
    ...(variant.schemaTaskEdit?{schemaTaskEditOperationId:variant.schemaTaskEdit.options.operationId}:{})}}
}
function isBase(variant:PlayerVariant,base:SaveBaseV1) {
  if('currentSaveRef' in base)return sameRef(variant.currentSaveRef,base.currentSaveRef)
  return !variant.currentSaveRef&&variant.revision===base.legacy.revision
    &&variant.schemaTaskEdit?.options.operationId===base.legacy.schemaTaskEditOperationId
    &&recordSha256(variant.text)===base.legacy.textSha256
}
export function createWorldlinePlayerSaves(branch:{get(key:string):unknown;put(key:string,value:object):Promise<unknown>}) {
  // The Surface owns the fork lock and publication. This owner writes only the
  // immutable admission record; a failed group put leaves its exact base current.
  function prepare(groupId:string,playerVariantId:string,variant:PlayerVariant,request:SaveRequest) {
    const operationId=request.options.operationId,key=worldlinePlayerSaveIntentKey(groupId,playerVariantId,operationId),
      requestSha256=recordSha256(request),stored=branch.get(key) as WorldlinePlayerSaveIntentV1|undefined
    if(stored&&stored.requestSha256!==requestSha256)throw Error('SCHEMA_TASK_EDIT_OPERATION_CONFLICT')
    const storedRef=stored?{key,sha256:recordSha256(stored)}:undefined,
      current=!!storedRef&&sameRef(variant.currentSaveRef,storedRef)
    if(stored&&!current&&!isBase(variant,stored.base))throw Error('SCHEMA_TASK_EDIT_OPERATION_CONFLICT')
    return {current,targetSessionIds:stored?.targetSessionIds,async persist(targetSessionIds:readonly string[]) {
      if(storedRef)return storedRef
      // Membership is sealed only after Surface resolves every actual Native
      // target. Publication retries retain that cohort, including before group.put.
      const intent:WorldlinePlayerSaveIntentV1={schemaVersion:1,
        encoding:'nexttavern-worldline-player-save-intent-v1',groupId,playerVariantId,operationId,
        requestSha256,base:baseline(variant),targetSessionIds:[...targetSessionIds]}
      const ref={key,sha256:recordSha256(intent)}
      await branch.put(key,intent)
      return ref
    }}
  }
  return {prepare}
}
