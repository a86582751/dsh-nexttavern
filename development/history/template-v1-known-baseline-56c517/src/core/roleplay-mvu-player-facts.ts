/** Immutable player-operation provenance shared by current readback and frozen
 * Native cuts. These readers neither reserve an Agent nor mint write authority. */
import {recordSha256} from './roleplay-data.js'
import {cloneMvuPlayerReplacement} from './roleplay-mvu-player-records.js'
import {mvuStateSettlementKey} from './roleplay-mvu-state.js'
import {assertMvuPlayerEditEvent,assertMvuPlayerMarkerBoundary,MVU_PLAYER_EDIT_EVENT}
  from 'dsh-nexttavern-session-format/mvu-player-marker'
import type {SessionEvent} from '@deepseek-ai/dsh-session'
import type {MvuPlayerEditRequest} from './roleplay-mvu-player-types.js'
import type {MvuNumericalSnapshot} from './roleplay-mvu-state.js'
import type {MvuPlayerStateIntent,MvuPlayerStateReplacement,MvuPlayerStatePublisherSettlement,
  MvuConsumedManualSettlementFactsInput} from './roleplay-mvu-player-records.js'

export interface MvuPlayerOperation {
  schemaVersion:1
  encoding:'native-mvu-player-operation-v1'
  sessionId:string
  operationId:string
  request:MvuPlayerEditRequest
  requestSha256:string
  base:MvuNumericalSnapshot
  operationSha256:string
}
export interface MvuPlayerOperationCompletion {
  schemaVersion:1
  encoding:'native-mvu-player-operation-complete-v1'
  sessionId:string
  operationId:string
  operation:{key:string;sha256:string}
  marker:{seq:number;sha256:string}
  intentSha256:string
  settlement:{key:string;sha256:string}
  outcome:'updated'|'no-update'
  completionSha256:string
}
export interface MvuPlayerOperationRefusal {
  schemaVersion:1
  encoding:'native-mvu-player-operation-refused-v1'
  sessionId:string
  operationId:string
  operationSha256:string
  code:string
  refusalSha256:string
}
export interface MvuPlayerFactTable {get(key:string):unknown;entries():Iterable<[string,unknown]>}
export const mvuPlayerOperationKey=(sid:string,operationId:string)=>`${sid}__mvu-player-operation-${operationId}`
export const mvuPlayerCompletionKey=(sid:string,operationId:string)=>`${sid}__mvu-player-complete-${operationId}`
export const mvuPlayerRefusalKey=(sid:string,operationId:string)=>`${sid}__mvu-player-refused-${operationId}`
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(v)
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const integer=(v:unknown,min=0)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&!Object.is(v,-0)
function fail(code:string):never {throw Error(code)}
function exact(value:object,keys:readonly string[]) {
  if(!same(Object.keys(value).sort(),[...keys].sort()))fail('MVU_PLAYER_DATA_INVALID')
}
/** Descriptors are examined before hashing or cloning persisted/input records.
 * This bound includes base+replacement; values retain their stricter own cap. */
export function cloneMvuPlayerData<T>(input:T):T {
  let nodes=0,bytes=0
  const ancestors=new Set<object>()
  function visit(value:unknown,depth:number):unknown {
    if(++nodes>96000||depth>64)fail('MVU_PLAYER_DATA_LIMIT')
    if(value===null||typeof value==='boolean')return value
    if(typeof value==='number') {
      if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)fail('MVU_PLAYER_DATA_INVALID')
      return value
    }
    if(typeof value==='string') {
      bytes+=Buffer.byteLength(value,'utf8');if(bytes>4*1048576)fail('MVU_PLAYER_DATA_LIMIT');return value
    }
    if(!value||typeof value!=='object'||ancestors.has(value)||Object.getOwnPropertySymbols(value).length)fail('MVU_PLAYER_DATA_INVALID')
    const array=Array.isArray(value),proto=Object.getPrototypeOf(value),d=Object.getOwnPropertyDescriptors(value)
    if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)fail('MVU_PLAYER_DATA_INVALID')
    if(array&&(value.length>32000||Object.keys(d).length!==value.length+1))fail('MVU_PLAYER_DATA_LIMIT')
    ancestors.add(value)
    const result:any=array?[]:{}
    for(const [key,item] of Object.entries(d)) {
      if(array&&key==='length')continue
      if(!item.enumerable||!Object.hasOwn(item,'value')||['__proto__','constructor','prototype'].includes(key)
        ||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length))fail('MVU_PLAYER_DATA_INVALID')
      bytes+=Buffer.byteLength(key,'utf8');if(bytes>4*1048576)fail('MVU_PLAYER_DATA_LIMIT')
      result[key]=visit(item.value,depth+1)
    }
    ancestors.delete(value);return result
  }
  return visit(input,0) as T
}
export function readMvuPlayerRequest(input:unknown):MvuPlayerEditRequest {
  const request=cloneMvuPlayerData(input) as MvuPlayerEditRequest
  if(!request||typeof request!=='object'||Array.isArray(request))fail('MVU_PLAYER_DATA_INVALID')
  exact(request,['schemaVersion','sessionId','operationId','action','expected','values'])
  const e=request.expected
  if(request.schemaVersion!==1||request.action!=='replace-values'||!id(request.sessionId)||!id(request.operationId)
    ||!e||typeof e!=='object'||Array.isArray(e))fail('MVU_PLAYER_DATA_INVALID')
  exact(e,['sourceSha256','root','revision','headSha256','valuesSha256','stateSnapshotSha256','observedNativeSeq'])
  if(!integer(e.revision,1)||!integer(e.observedNativeSeq)||!e.root||typeof e.root!=='object'
    ||![e.sourceSha256,e.headSha256,e.valuesSha256,e.stateSnapshotSha256].every(hash))fail('MVU_PLAYER_DATA_INVALID')
  try {request.values=cloneMvuPlayerReplacement({values:request.values,valuesSha256:recordSha256(request.values)}).values}
  catch(error) {fail(String(error).includes('LIMIT')?'MVU_PLAYER_DATA_LIMIT':'MVU_PLAYER_DATA_INVALID')}
  return request
}
export function readMvuPlayerOperation(input:unknown):MvuPlayerOperation {
  const op=cloneMvuPlayerData(input) as MvuPlayerOperation
  exact(op,['schemaVersion','encoding','sessionId','operationId','request','requestSha256','base','operationSha256'])
  const request=readMvuPlayerRequest(op.request),base=op.base,e=request.expected
  const {operationSha256,...body}=op
  if(op.schemaVersion!==1||op.encoding!=='native-mvu-player-operation-v1'||!id(op.sessionId)||!id(op.operationId)
    ||request.sessionId!==op.sessionId||request.operationId!==op.operationId||!same(request,op.request)
    ||op.requestSha256!==recordSha256(request)||operationSha256!==recordSha256(body)
    ||base?.schemaVersion!==1||base.encoding!=='native-mvu-state-snapshot-v1'||base.sessionId!==op.sessionId
    ||base.sourceSha256!==e.sourceSha256||!same(base.root,e.root)||base.revision!==e.revision
    ||base.headSha256!==e.headSha256||base.valuesSha256!==e.valuesSha256||base.stateSnapshotSha256!==e.stateSnapshotSha256
    ||base.headSha256!==recordSha256(base.currentHead)||base.valuesSha256!==recordSha256(base.values))fail('MVU_PLAYER_OPERATION_UNPROVEN')
  const {stateSnapshotSha256,...snapshot}=base
  if(stateSnapshotSha256!==recordSha256(snapshot))fail('MVU_PLAYER_OPERATION_UNPROVEN')
  return op
}
export function mvuPlayerIntentFor(operation:MvuPlayerOperation,marker:SessionEvent):MvuPlayerStateIntent {
  assertMvuPlayerEditEvent(marker)
  const {schemaVersion:_schema,encoding:_encoding,sessionId:_sid,sourceSha256:_source,values:_values,...base}=operation.base
  const replacement={values:operation.request.values,valuesSha256:recordSha256(operation.request.values)}
  const body={schemaVersion:1 as const,encoding:'native-mvu-player-state-intent-v1' as const,
    sessionId:operation.sessionId,sourceSha256:operation.base.sourceSha256,operationId:operation.operationId,
    requestSha256:operation.requestSha256,operation:{key:mvuPlayerOperationKey(operation.sessionId,operation.operationId),
      sha256:operation.operationSha256},marker:{seq:marker.seq,sha256:recordSha256(marker)},base,replacement}
  return {...body,intentSha256:recordSha256(body)}
}
export function verifyMvuPlayerMarker(operation:MvuPlayerOperation,marker:SessionEvent,events:readonly SessionEvent[]):void {
  assertMvuPlayerEditEvent(marker)
  const expected={schemaVersion:1,encoding:'native-mvu-player-edit-marker-v1',sessionId:operation.sessionId,
    operationId:operation.operationId,requestSha256:operation.requestSha256,operationSha256:operation.operationSha256,
    sourceSha256:operation.base.sourceSha256,rootSha256:recordSha256(operation.base.root),
    baseSnapshotSha256:operation.base.stateSnapshotSha256,replacementValuesSha256:recordSha256(operation.request.values),
    observedNativeSeq:operation.request.expected.observedNativeSeq}
  if(!same(marker.data,expected)||events[marker.seq]?.seq!==marker.seq||!same(events[marker.seq],marker)
    ||events.filter(e=>e.type===MVU_PLAYER_EDIT_EVENT&&e.data.operationId===operation.operationId
      &&e.data.sessionId===operation.sessionId).length!==1)fail('MVU_PLAYER_MARKER_UNPROVEN')
  assertMvuPlayerMarkerBoundary(events.slice(0,marker.seq+1))
}
export interface MvuPlayerOperationFactsInput {
  branch:MvuPlayerFactTable
  status:MvuPlayerFactTable
  events:readonly SessionEvent[]
  sessionId:string
  sourceSha256:string
  marker:SessionEvent
  verifySettlementFacts(input:MvuConsumedManualSettlementFactsInput):boolean
}
export function readMvuPlayerOperationFacts(input:MvuPlayerOperationFactsInput) {
  assertMvuPlayerEditEvent(input.marker)
  const {sessionId:sid,operationId}=input.marker.data
  if(sid!==input.sessionId)fail('MVU_PLAYER_MARKER_OWNER_UNPROVEN')
  const operation=readMvuPlayerOperation(input.branch.get(mvuPlayerOperationKey(sid,operationId)))
  if(operation.base.sourceSha256!==input.sourceSha256)fail('MVU_PLAYER_SOURCE_CHANGED')
  verifyMvuPlayerMarker(operation,input.marker,input.events)
  const intent=mvuPlayerIntentFor(operation,input.marker),base=operation.base,replacement=intent.replacement
  const completion=cloneMvuPlayerData(input.branch.get(mvuPlayerCompletionKey(sid,operationId))) as MvuPlayerOperationCompletion
  exact(completion,['schemaVersion','encoding','sessionId','operationId','operation','marker','intentSha256','settlement','outcome','completionSha256'])
  const settlementKey=mvuStateSettlementKey(sid,intent.intentSha256)
  const settlement=cloneMvuPlayerData(input.status.get(settlementKey)) as MvuPlayerStatePublisherSettlement
  const {completionSha256,...body}=completion
  if(completion.schemaVersion!==1||completion.encoding!=='native-mvu-player-operation-complete-v1'
    ||completion.sessionId!==sid||completion.operationId!==operationId||completionSha256!==recordSha256(body)
    ||!same(completion.operation,intent.operation)||!same(completion.marker,intent.marker)
    ||completion.intentSha256!==intent.intentSha256||!same(completion.settlement,{key:settlementKey,sha256:recordSha256(settlement)})
    ||completion.outcome!==settlement.outcome||!input.verifySettlementFacts({intent,base,replacement,settlement})) {
    fail('MVU_PLAYER_COMPLETION_UNPROVEN')
  }
  const resultBody={schemaVersion:1 as const,encoding:'native-mvu-state-snapshot-v1' as const,
    sessionId:sid,sourceSha256:input.sourceSha256,root:base.root,currentHead:settlement.result.head,
    revision:settlement.result.revision,headSha256:settlement.result.headSha256,values:replacement.values,
    valuesSha256:settlement.result.valuesSha256}
  const result={...resultBody,stateSnapshotSha256:recordSha256(resultBody)}
  return {operation,completion,intent,base,replacement,settlement,result}
}
