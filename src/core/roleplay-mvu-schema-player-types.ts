/** Schema player facts preserve the original replacement request separately
 * from author outputs. Bounded hashes describe facts, never execution rights. */
import {recordSha256} from './roleplay-data.js'
import {readMvuPlayerRequest} from './roleplay-mvu-player-facts.js'
import {cloneMvuPlayerReplacement} from './roleplay-mvu-player-records.js'
import {cloneSchemaValues} from './tavern-mvu-schema-data.js'
import {reduceMvuUpdateOperationsV2} from './roleplay-mvu-update-v2.js'
import type {PreparedMvuUpdateV2,MvuUpdateRejectionV2} from './roleplay-mvu-update-v2.js'
import {schemaEmptyPhaseInput} from './roleplay-mvu-schema-executor-types.js'
import type {SchemaEvaluationInput,SchemaGuestOutput} from './roleplay-mvu-schema-executor-types.js'
import {validateSchemaEvaluationInputV4,validateSchemaGuestOutputV4} from './tavern-mvu-schema-runner-v4.js'
import {validateMvuScopeReadFrameV1} from './tavern-mvu-scope-read.js'
import {validateMvuScopeReadRefV2} from './tavern-mvu-scope-view-v2.js'
import type {MvuScopeReadRefV2} from './tavern-mvu-scope-view-v2.js'
import {schemaScopeReadFactsEqual} from './roleplay-mvu-schema-scope-facts.js'
import {validateSchemaAnchor,validateSchemaSourceCut} from './roleplay-mvu-schema-journal.js'
import {validateSchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import {schemaExecutionServerTailSha256,schemaExecutionHostFrontierSha256} from './roleplay-mvu-schema-replay.js'
import {freezeMvuSchemaStoryData,sealMvuSchemaStoryFact,validateMvuSchemaNumericalSnapshot,
  validateMvuSchemaStoryHead,validateMvuSchemaStoryRoot,schemaScopeReadRefFactsEqualV2} from './roleplay-mvu-schema-story-types.js'
import {assertMvuPlayerEditEvent,assertMvuPlayerMarkerBoundary,MVU_PLAYER_EDIT_EVENT}
  from 'dsh-nexttavern-session-format/mvu-player-marker'
import type {SessionEvent} from 'dsh-nexttavern-native-session'
import type {SessionHistoryCut} from './session-history.js'

type PlayerNativeHistory=readonly SessionEvent[]|SessionHistoryCut<SessionEvent>
interface PlayerNativeIndex {
  length:number;open:number|undefined;invalidBoundary:boolean
  markers:Map<string,{event:SessionEvent;boundary:boolean;count:number}>
}
const playerNativeIndexes=new WeakMap<object,PlayerNativeIndex>()
const markerIdentity=(sid:string,id:string)=>JSON.stringify([sid,id])
/** A bounded read shares the actual append-only Native owner. Raw histories
 * retain their complete grammar; old cuts cannot observe later duplicates. */
function nativePlayerIndex(cut:SessionHistoryCut<SessionEvent>):PlayerNativeIndex {
  let index=playerNativeIndexes.get(cut.owner)
  if(!index||index.length>cut.length)index={length:0,open:undefined,invalidBoundary:false,markers:new Map()}
  for(const event of cut.range(index.length,cut.length)) {
    if(event.type==='turn/start') {
      if(index.open!==undefined)index.invalidBoundary=true
      index.open=event.data.turn
    }else if(event.type==='turn/end') {
      if(index.open!==event.data.turn)index.invalidBoundary=true
      index.open=undefined
    }else if(event.type===MVU_PLAYER_EDIT_EVENT) {
      try {assertMvuPlayerEditEvent(event)}catch {index.invalidBoundary=true}
      const key=markerIdentity(event.data.sessionId,event.data.operationId),known=index.markers.get(key)
      if(known)known.count++
      else index.markers.set(key,{event,boundary:!index.invalidBoundary&&index.open===undefined,count:1})
    }
  }
  index.length=cut.length;playerNativeIndexes.set(cut.owner,index)
  return index
}
function playerMarker(events:PlayerNativeHistory,sid:string,id:string):SessionEvent|undefined {
  return Array.isArray(events)?events.find(event=>event.type===MVU_PLAYER_EDIT_EVENT&&event.data?.sessionId===sid
    &&event.data.operationId===id):nativePlayerIndex(events as SessionHistoryCut<SessionEvent>).markers.get(markerIdentity(sid,id))?.event
}
import type {MvuPlayerEditRequest,MvuPlayerEditExpected} from './roleplay-mvu-player-types.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {SchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import type {MvuSchemaStoryRoot,MvuSchemaNumericalSnapshotV2,MvuSchemaNumericalHead,
  MvuSchemaPlayerHeadV1,MvuSchemaPlayerRevisionHeadV1,MvuSchemaStoryFrontier} from './roleplay-mvu-schema-story-types.js'
import type {SchemaExecutionAssociation,SchemaExecutionSelector,SchemaExecutionResult,SourceNativeCutFacts}
  from './roleplay-mvu-schema-replay.js'
import type {SchemaNativeMarkerRef,SchemaJournalRef} from './roleplay-mvu-schema-journal.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {MvuSchemaPhaseErrorPolicyV4} from './tavern-mvu-schema-types-v4.js'

export type MvuSchemaPlayerRequest=Omit<MvuPlayerEditRequest,'expected'> & {
  expected:Omit<MvuPlayerEditExpected,'root'> & {root:MvuSchemaStoryRoot}
}
export interface MvuSchemaPlayerOperationV1 {
  schemaVersion:1;encoding:'native-mvu-schema-player-operation-v1'
  sessionId:string;operationId:string;request:MvuSchemaPlayerRequest;requestSha256:string
  base:MvuSchemaNumericalSnapshotV2;operationSha256:string
}
export const MVU_SCHEMA_PLAYER_PHASES=Object.freeze(
  ['manual-replacement','command-parsed','commands-parsed','update-ended'] as const)
export type MvuSchemaPlayerPhase=typeof MVU_SCHEMA_PLAYER_PHASES[number]
export interface MvuSchemaPlayerPlanV4 {
  schemaVersion:4;encoding:'native-mvu-schema-player-plan-v4';executorVersion:4
  operation:MvuSchemaPlayerOperationV1;marker:SchemaNativeMarkerRef;currentFrame:SchemaStorySourceFrame
  realmEpoch:string;programSha256:string;initialCut:SourceNativeCutFacts;clockEpochMs:number;randomSeed:string
  selectors:readonly SchemaExecutionSelector[];planSha256:string
  scopeReadFrame:MvuScopeReadFrameV1
  errorPolicy?:Exclude<MvuSchemaPhaseErrorPolicyV4,'atomic-refusal'>
}
/** Host5's Combined identity does not change manual phase ABI4. */
export interface MvuSchemaPlayerPlanV5 extends Omit<MvuSchemaPlayerPlanV4,'schemaVersion'|'encoding'> {
  schemaVersion:5;encoding:'native-mvu-schema-player-plan-v5'
  epoch:SchemaJournalRef;serverProgramSha256:string
}
export interface MvuSchemaPlayerPlanV10 extends Omit<MvuSchemaPlayerPlanV5,'schemaVersion'|'encoding'|'scopeReadFrame'> {
  schemaVersion:10;encoding:'native-mvu-schema-player-plan-v10-scope-ref-v2'
  scopeReadRef:MvuScopeReadRefV2
}
export type MvuSchemaPlayerPlanV1=MvuSchemaPlayerPlanV4|MvuSchemaPlayerPlanV5|MvuSchemaPlayerPlanV10
/** The historical operation remains immutable. Only the current revision owner
 * supplies the new execution base, Source and append cut. */
export interface MvuSchemaPlayerRevisionPlanV1 extends Omit<MvuSchemaPlayerPlanV5,'schemaVersion'|'encoding'> {
  schemaVersion:9;encoding:'native-mvu-schema-player-revision-plan-v1'
  original:SchemaJournalRef;base:MvuSchemaNumericalSnapshotV2
  execution:{sessionId:string;sourceSha256:string;root:MvuSchemaStoryRoot}
  revision:{descriptor:SchemaJournalRef;index:number;publicationRevision:number}
  logicalNativeCut:number
}
export interface MvuSchemaPlayerPhaseFact {
  phase:MvuSchemaPlayerPhase;input:SchemaEvaluationInput
  association:SchemaExecutionAssociation;output:SchemaGuestOutput
}
export interface MvuSchemaPlayerReducerBridgeV2 {
  schemaVersion:2;encoding:'native-mvu-schema-player-reducer-bridge-v2'
  phaseOutputSha256:string;result:PreparedMvuUpdateV2|MvuUpdateRejectionV2;bridgeSha256:string
}
export type MvuSchemaPlayerReducerBridge=MvuSchemaPlayerReducerBridgeV2
export interface MvuSchemaPlayerCommandRefusal {
  schemaVersion:1;encoding:'native-mvu-schema-player-command-refusal-v1'
  phaseIndex:number;phaseOutputSha256:string;code:'MANUAL_COMMANDS_UNSUPPORTED';refusalSha256:string
}
export interface MvuSchemaPlayerEventV1 {
  schemaVersion:1;encoding:'native-mvu-schema-player-event-v1';sessionId:string;sourceSha256:string;eventId:string
  plan:MvuSchemaPlayerPlanV1;phases:readonly MvuSchemaPlayerPhaseFact[]
  reducer:MvuSchemaPlayerReducerBridge|null;commandRefusal:MvuSchemaPlayerCommandRefusal|null
  outcome:'accepted'|'refused'|'no-update';refusal:'guest'|'reducer'|'commands'|null
  values:MvuJsonObject;valuesSha256:string;context:MvuJsonObject;frontier:MvuSchemaStoryFrontier;eventSha256:string
}
export interface MvuSchemaPlayerRevisionEventV1 extends Omit<MvuSchemaPlayerEventV1,'encoding'|'plan'> {
  encoding:'native-mvu-schema-player-revision-event-v1'
  plan:MvuSchemaPlayerRevisionPlanV1
}
export interface MvuSchemaPlayerSettlementV1 {
  schemaVersion:1;encoding:'native-mvu-schema-player-settlement-v1';sessionId:string;sourceSha256:string
  planSha256:string;operationSha256:string;marker:SchemaNativeMarkerRef;outcome:MvuSchemaPlayerEventV1['outcome']
  event:{key:string;sha256:string}
  result:{head:MvuSchemaNumericalHead;headSha256:string;revision:number;valuesSha256:string;
    contextSha256:string;frontier:MvuSchemaStoryFrontier}
  settlementSha256:string
}
export interface MvuSchemaPlayerCompletionV1 {
  schemaVersion:1;encoding:'native-mvu-schema-player-complete-v1';sessionId:string;operationId:string
  operation:{key:string;sha256:string};marker:SchemaNativeMarkerRef;planSha256:string
  settlement:{key:string;sha256:string};outcome:MvuSchemaPlayerEventV1['outcome'];completionSha256:string
}
/** A pre-marker denial is distinct from a completed author refusal event. */
export interface MvuSchemaPlayerRefusalV1 {
  schemaVersion:1;encoding:'native-mvu-schema-player-refused-v1';sessionId:string;operationId:string
  operationSha256:string;code:string;refusalSha256:string
}
export type MvuSchemaPlayerLive=Extract<SchemaExecutionResult,{kind:'completed'}>
export interface MvuSchemaPlayerPublicationBoundary {
  plan:MvuSchemaPlayerPlanV1;event:MvuSchemaPlayerEventV1;head:MvuSchemaNumericalHead
  settlement:MvuSchemaPlayerSettlementV1
  /** This publisher's exact readbacks, frozen before the live owner consumes them. */
  confirmedRows:readonly {key:string;value:unknown}[]
  stage:'before-event'|'after-event'|'before-head'|'after-head'|'before-settlement'|'after-settlement'
}
export interface MvuSchemaPlayerDeps {
  table:{get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>}
  readReady(plan:MvuSchemaPlayerPlanV1):{kind:'ready';snapshot:MvuSchemaNumericalSnapshotV2}|{kind:'blocked';code:string}
  ownerCurrent(owner:object,plan:MvuSchemaPlayerPlanV1):boolean
  /** Core returns the private owner's actual plan; a rejected owner cannot fall back to raw parsing. */
  readOwnedPlan?(owner:object,suppliedPlan:MvuSchemaPlayerPlanV1):MvuSchemaPlayerPlanV1|undefined
  executePhase(plan:MvuSchemaPlayerPlanV1,phase:MvuSchemaPlayerPhase,input:SchemaEvaluationInput,
    owner:object):Promise<SchemaExecutionResult>
  withPublicationBoundary<T>(owner:object,lastLive:MvuSchemaPlayerLive,action:()=>Promise<T>):Promise<T>
  checkPublication(owner:object,lastLive:MvuSchemaPlayerLive,boundary:MvuSchemaPlayerPublicationBoundary):boolean
}
export type MvuSchemaPlayerPublication={kind:'acknowledged';settlement:MvuSchemaPlayerSettlementV1}
  |{kind:'blocked'|'unknown';code:string}

export const mvuSchemaPlayerOperationKey=(sid:string,id:string)=>`${sid}__mvu-schema-player-operation-${id}`
export const mvuSchemaPlayerPlanKey=(sid:string,id:string)=>`${sid}__mvu-schema-player-plan-${id}`
export const mvuSchemaPlayerCompletionKey=(sid:string,id:string)=>`${sid}__mvu-schema-player-complete-${id}`
export const mvuSchemaPlayerRefusalKey=(sid:string,id:string)=>`${sid}__mvu-schema-player-refused-${id}`
export const mvuSchemaPlayerEventKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-player-event-${id}`
export const mvuSchemaPlayerSettlementKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-player-settlement-${id}`
export const schemaPlayerCode=(input:unknown):string=>typeof input==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(input)
  ?input:'SCHEMA_PLAYER_UNKNOWN'
export {freezeMvuSchemaStoryData as freezeMvuSchemaPlayerData,sealMvuSchemaStoryFact as sealMvuSchemaPlayerFact}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const hash=(input:unknown)=>typeof input==='string'&&/^[a-f0-9]{64}$/.test(input)
const id=(input:unknown,max=128)=>typeof input==='string'&&new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`).test(input)
const integer=(input:unknown,min=0)=>typeof input==='number'&&Number.isSafeInteger(input)&&input>=min&&!Object.is(input,-0)
function fail():never {throw Error('SCHEMA_PLAYER_RECORD_INVALID')}
function exact(input:object,keys:readonly string[]) {
  if(!same(Object.keys(input).sort(),[...keys].sort()))fail()
}
function fact(input:object,key:string) {
  const {[key]:checksum,...body}=input as Record<string,unknown>
  if(!hash(checksum)||checksum!==recordSha256(body))fail()
}
function root(input:MvuSchemaStoryRoot) {
  try {validateMvuSchemaStoryRoot(input)}catch {fail()}
}
function marker(input:SchemaNativeMarkerRef) {
  exact(input,['seq','sha256']);if(!integer(input.seq)||!hash(input.sha256))fail()
}
export function readMvuSchemaPlayerRequest(input:unknown):MvuSchemaPlayerRequest {
  const request=readMvuPlayerRequest(input) as unknown as MvuSchemaPlayerRequest
  root(request.expected.root)
  return freezeMvuSchemaStoryData(request)
}
export function makeMvuSchemaPlayerOperation(input:unknown,base:MvuSchemaNumericalSnapshotV2):MvuSchemaPlayerOperationV1 {
  const request=readMvuSchemaPlayerRequest(input)
  return validateMvuSchemaPlayerOperation(sealMvuSchemaStoryFact({schemaVersion:1 as const,
    encoding:'native-mvu-schema-player-operation-v1' as const,sessionId:request.sessionId,operationId:request.operationId,
    request,requestSha256:recordSha256(request),base:validateMvuSchemaNumericalSnapshot(base)},'operationSha256'))
}
export function validateMvuSchemaPlayerOperation(input:MvuSchemaPlayerOperationV1):MvuSchemaPlayerOperationV1 {
  const op=freezeMvuSchemaStoryData(input)
  exact(op,['schemaVersion','encoding','sessionId','operationId','request','requestSha256','base','operationSha256'])
  fact(op,'operationSha256')
  const request=readMvuSchemaPlayerRequest(op.request),base=validateMvuSchemaNumericalSnapshot(op.base),e=request.expected
  if(op.schemaVersion!==1||op.encoding!=='native-mvu-schema-player-operation-v1'||!id(op.sessionId,64)||!id(op.operationId)
    ||request.sessionId!==op.sessionId||request.operationId!==op.operationId||base.sessionId!==op.sessionId
    ||!same(request,op.request)||op.requestSha256!==recordSha256(request)||base.sourceSha256!==e.sourceSha256
    ||!same(base.root,e.root)||base.revision!==e.revision||base.headSha256!==e.headSha256
    ||base.valuesSha256!==e.valuesSha256||base.stateSnapshotSha256!==e.stateSnapshotSha256)fail()
  return op
}
export function verifyMvuSchemaPlayerMarker(op:MvuSchemaPlayerOperationV1,event:SessionEvent,events:PlayerNativeHistory):void {
  op=validateMvuSchemaPlayerOperation(op);assertMvuPlayerEditEvent(event)
  const expected={schemaVersion:1,encoding:'native-mvu-player-edit-marker-v1',sessionId:op.sessionId,
    operationId:op.operationId,requestSha256:op.requestSha256,operationSha256:op.operationSha256,
    sourceSha256:op.base.sourceSha256,rootSha256:recordSha256(op.base.root),baseSnapshotSha256:op.base.stateSnapshotSha256,
    replacementValuesSha256:recordSha256(op.request.values),observedNativeSeq:op.request.expected.observedNativeSeq}
  if(!same(event.data,expected)||event.seq!==op.request.expected.observedNativeSeq+1)fail()
  if(Array.isArray(events)) {
    if(!same(events[event.seq],event)||events.filter(row=>row.type===MVU_PLAYER_EDIT_EVENT&&row.data.sessionId===op.sessionId
      &&row.data.operationId===op.operationId).length!==1)fail()
    assertMvuPlayerMarkerBoundary(events.slice(0,event.seq+1))
  }else {
    const cut=events as SessionHistoryCut<SessionEvent>,fact=nativePlayerIndex(cut).markers.get(markerIdentity(op.sessionId,op.operationId))
    if(!fact||fact.count!==1||!same(cut.at(event.seq),event))fail()
    if(!fact.boundary)throw Error('MVU_PLAYER_NATIVE_BOUNDARY_UNKNOWN')
  }
}
export function deriveMvuSchemaPlayerSelectors(op:MvuSchemaPlayerOperationV1,ref:SchemaNativeMarkerRef):readonly SchemaExecutionSelector[] {
  op=validateMvuSchemaPlayerOperation(op);marker(ref)
  const anchor={kind:'manual' as const,operationId:op.operationId,requestSha256:op.requestSha256,
    observedNativeSeq:op.request.expected.observedNativeSeq}
  validateSchemaAnchor(anchor)
  const digest=recordSha256({operation:op,marker:ref,realmEpoch:op.base.root.realmEpoch})
  return freezeMvuSchemaStoryData(MVU_SCHEMA_PLAYER_PHASES.map((_phase,index)=>({sessionId:op.sessionId,
    batchId:`player-${digest}-${index+1}`,anchor})))
}
export function deriveMvuSchemaPlayerRevisionSelectors(operation:MvuSchemaPlayerOperationV1,original:SchemaJournalRef,
  descriptor:SchemaJournalRef,index:number,sessionId:string):readonly SchemaExecutionSelector[] {
  const anchor={kind:'manual' as const,operationId:operation.operationId,requestSha256:operation.requestSha256,
    observedNativeSeq:operation.request.expected.observedNativeSeq}
  const digest=recordSha256({original,descriptor,index,sessionId})
  return freezeMvuSchemaStoryData(MVU_SCHEMA_PLAYER_PHASES.map((_phase,ordinal)=>({sessionId,
    batchId:`player-revision-${digest}-${ordinal+1}`,anchor})))
}
export function validateMvuSchemaPlayerRevisionPlan(input:MvuSchemaPlayerRevisionPlanV1):MvuSchemaPlayerRevisionPlanV1 {
  const plan=freezeMvuSchemaStoryData(input)
  exact(plan,['schemaVersion','encoding','operation','marker','currentFrame','realmEpoch','programSha256',
    'initialCut','clockEpochMs','randomSeed','selectors','planSha256','executorVersion','scopeReadFrame',
    'epoch','serverProgramSha256','original','base','execution','revision','logicalNativeCut',
    ...('errorPolicy' in plan?['errorPolicy']:[])])
  fact(plan,'planSha256')
  validateMvuSchemaPlayerOperation(plan.operation)
  validateMvuSchemaNumericalSnapshot(plan.base)
  validateSchemaStorySourceFrame(plan.currentFrame)
  const cut=validateSchemaSourceCut(plan.initialCut),read=validateMvuScopeReadFrameV1(plan.scopeReadFrame)
  const {execution,revision}=plan,source=plan.currentFrame.snapshot.source
  exact(execution,['sessionId','sourceSha256','root'])
  exact(revision,['descriptor','index','publicationRevision'])
  validateMvuSchemaStoryRoot(execution.root)
  for(const ref of [plan.original,revision.descriptor,plan.epoch]) {
    exact(ref,['key','sha256'])
    if(!id(ref.key,512)||!hash(ref.sha256))fail()
  }
  marker(plan.marker)
  if(plan.schemaVersion!==9||plan.encoding!=='native-mvu-schema-player-revision-plan-v1'||plan.executorVersion!==4
    ||!id(execution.sessionId,64)||!hash(execution.sourceSha256)||!hash(plan.serverProgramSha256)
    ||!integer(revision.index)||!integer(revision.publicationRevision,2)||!integer(plan.logicalNativeCut)
    ||!integer(plan.clockEpochMs)||plan.realmEpoch!==plan.base.root.realmEpoch
    ||plan.programSha256!==plan.base.root.programSha256||plan.realmEpoch!==execution.root.realmEpoch
    ||plan.programSha256!==execution.root.programSha256||plan.currentFrame.sessionId!==execution.sessionId
    ||plan.randomSeed!==recordSha256({operation:plan.operation,original:plan.original,
      revision:revision.descriptor,index:revision.index})
    ||cut.sessionId!==execution.sessionId||cut.ownerSessionId!==execution.sessionId
    ||cut.nativeCut<plan.base.schemaFrontier.nativeCut||cut.sourceSnapshotSha256!==plan.currentFrame.snapshotSha256
    ||cut.materialSha256!==plan.currentFrame.materialSha256
    ||!same(plan.selectors,deriveMvuSchemaPlayerRevisionSelectors(plan.operation,plan.original,
      revision.descriptor,revision.index,execution.sessionId))||!same(cut.anchor,plan.selectors[0]!.anchor)
    ||read.source.sessionId!==execution.sessionId||read.source.sourceRecordSessionId!==source.sourceRecordSessionId
    ||read.source.importId!==source.importId||read.source.rawSha256!==source.rawSha256
    ||read.source.sourceSnapshotSha256!==plan.currentFrame.snapshotSha256
    ||read.sourceNativeCutSha256!==recordSha256(cut)
    ||'errorPolicy' in plan&&plan.errorPolicy!=='registered-command-policy-v1'
      &&plan.errorPolicy!=='update-batch-atomic-v1')fail()
  return plan
}
export function validateMvuSchemaPlayerPlan(input:MvuSchemaPlayerPlanV1):MvuSchemaPlayerPlanV1 {
  const plan=freezeMvuSchemaStoryData(input)
  exact(plan,['schemaVersion','encoding','operation','marker','currentFrame','realmEpoch','programSha256',
    'initialCut','clockEpochMs','randomSeed','selectors','planSha256',
    'executorVersion',...(plan.schemaVersion===10?['scopeReadRef']:['scopeReadFrame']),
    ...(plan.schemaVersion===5||plan.schemaVersion===10?['epoch','serverProgramSha256']:[]),
    ...('errorPolicy' in plan?['errorPolicy']:[])])
  if('errorPolicy' in plan&&plan.errorPolicy!=='registered-command-policy-v1'
    &&plan.errorPolicy!=='update-batch-atomic-v1')fail()
  fact(plan,'planSha256')
  const op=validateMvuSchemaPlayerOperation(plan.operation),cut=validateSchemaSourceCut(plan.initialCut)
  validateSchemaStorySourceFrame(plan.currentFrame);marker(plan.marker)
  if(plan.schemaVersion===10) {
    if(plan.encoding!=='native-mvu-schema-player-plan-v10-scope-ref-v2'||plan.executorVersion!==4
      ||validateMvuScopeReadRefV2(plan.scopeReadRef).sourceNativeCutSha256!==recordSha256(cut))fail()
  } else if(plan.schemaVersion===4||plan.schemaVersion===5) {
    if(plan.encoding!==`native-mvu-schema-player-plan-v${plan.schemaVersion}`
      ||plan.executorVersion!==4)fail()
    const read=validateMvuScopeReadFrameV1(plan.scopeReadFrame),source=plan.currentFrame.snapshot.source
    if(read.source.sessionId!==op.sessionId||read.source.sourceRecordSessionId!==source.sourceRecordSessionId
      ||read.source.importId!==source.importId||read.source.rawSha256!==source.rawSha256
      ||read.source.sourceSnapshotSha256!==plan.currentFrame.snapshotSha256
      ||read.sourceNativeCutSha256!==recordSha256(cut))fail()
  }else fail()
  if(plan.schemaVersion===5||plan.schemaVersion===10) {
    exact(plan.epoch,['key','sha256'])
    if(!id(plan.epoch.key,512)||!hash(plan.epoch.sha256)||!hash(plan.serverProgramSha256))fail()
  }
  if(plan.marker.seq!==op.request.expected.observedNativeSeq+1||cut.nativeCut!==plan.marker.seq+1
    ||cut.nativeCut<op.base.schemaFrontier.nativeCut||cut.sessionId!==op.sessionId||cut.ownerSessionId!==op.sessionId
    ||plan.realmEpoch!==op.base.root.realmEpoch||plan.programSha256!==op.base.root.programSha256
    ||plan.currentFrame.sessionId!==op.sessionId||cut.sourceSnapshotSha256!==plan.currentFrame.snapshotSha256
    ||cut.materialSha256!==plan.currentFrame.materialSha256||!integer(plan.clockEpochMs)
    ||plan.randomSeed!==recordSha256({operation:op,marker:plan.marker})
    ||!same(plan.selectors,deriveMvuSchemaPlayerSelectors(op,plan.marker))||!same(cut.anchor,plan.selectors[0]!.anchor))fail()
  return plan
}
function output(input:SchemaGuestOutput,frame:SchemaEvaluationInput) {
  validateSchemaGuestOutputV4(input,validateSchemaEvaluationInputV4(frame))
}
export function mvuSchemaPlayerReducerBridge(phase:MvuSchemaPlayerPhaseFact):MvuSchemaPlayerReducerBridge {
  if(phase.phase!=='command-parsed'||phase.output.kind!=='accepted'||phase.output.commands.length)fail()
  const input=validateSchemaEvaluationInputV4(phase.input)
  if(input.phase!=='command-parsed')fail()
  const output=validateSchemaGuestOutputV4(phase.output,input)
  if(output.kind!=='accepted')fail()
  return sealMvuSchemaStoryFact({schemaVersion:2 as const,encoding:'native-mvu-schema-player-reducer-bridge-v2' as const,
    phaseOutputSha256:recordSha256(phase.output),result:reduceMvuUpdateOperationsV2(output.values,[])},'bridgeSha256')
}
export function mvuSchemaPlayerPhaseInput(plan:MvuSchemaPlayerPlanV1|MvuSchemaPlayerRevisionPlanV1,index:number,
  phases:readonly MvuSchemaPlayerPhaseFact[],scopeReadFrame?:MvuScopeReadFrameV1,
  scopeReadRef?:MvuScopeReadRefV2):SchemaEvaluationInput {
  if(!integer(index)||index>=MVU_SCHEMA_PLAYER_PHASES.length||phases.length<index)fail()
  if(plan.schemaVersion!==10&&scopeReadRef!==undefined)fail()
  const base=plan.schemaVersion===9?plan.base:plan.operation.base
  let values=plan.operation.request.values,context=base.context
  if(index) {
    const previousInput=phases[index-1]!.input
    if(previousInput.schemaVersion===4
      &&(previousInput.encoding==='native-mvu-author-schema-phase-input-v4-scope-ref-v2')!==(plan.schemaVersion===10))fail()
    const previous=phases[index-1]!.output
    if(previous.kind!=='accepted'||previous.commands.length)fail()
    values=previous.values;context=previous.context
    if(index===2) {
      const bridge=mvuSchemaPlayerReducerBridge(phases[1]!)
      if(bridge.result.kind!=='prepared')fail()
      values=bridge.result.values
    }
  }
  if(plan.schemaVersion===10) {
    if(scopeReadFrame!==undefined)fail()
    const reference=validateMvuScopeReadRefV2(scopeReadRef??plan.scopeReadRef)
    if(!schemaScopeReadRefFactsEqualV2(reference,plan.scopeReadRef))fail()
    return freezeMvuSchemaStoryData(validateSchemaEvaluationInputV4(schemaEmptyPhaseInput(4,MVU_SCHEMA_PLAYER_PHASES[index]!,
      base.values,values,context,plan.clockEpochMs,plan.randomSeed,undefined,plan.errorPolicy,reference)))
  }
  const read=validateMvuScopeReadFrameV1(scopeReadFrame??plan.scopeReadFrame)
  if(!schemaScopeReadFactsEqual(read,plan.scopeReadFrame))fail()
  const input=schemaEmptyPhaseInput(4,MVU_SCHEMA_PLAYER_PHASES[index]!,
    base.values,values,context,plan.clockEpochMs,plan.randomSeed,read,plan.errorPolicy)
  return freezeMvuSchemaStoryData(validateSchemaEvaluationInputV4(input))
}
function association(input:SchemaExecutionAssociation,plan:MvuSchemaPlayerPlanV1|MvuSchemaPlayerRevisionPlanV1,index:number) {
  const selector=plan.selectors[index]!
  if(plan.schemaVersion===5||plan.schemaVersion===9||plan.schemaVersion===10) {
    if(input.schemaVersion!==5)fail()
    exact(input,['schemaVersion','encoding','sessionId','realmEpoch','batchId','anchor','sourceNativeCutSha256',
      'combinedProgramSha256','serverProgramSha256','epoch','dispatch','completion','dispatchMarker','completionMarker',
      'serverTailSha256','hostFrontierSha256','outputSha256'])
    if(input.encoding!=='native-author-host-association-v5'||input.sessionId!==selector.sessionId
      ||input.realmEpoch!==plan.realmEpoch||input.combinedProgramSha256!==plan.programSha256
      ||input.serverProgramSha256!==plan.serverProgramSha256||!same(input.epoch,plan.epoch)
      ||input.batchId!==selector.batchId||!same(input.anchor,selector.anchor)
      ||![input.sourceNativeCutSha256,input.serverTailSha256,input.hostFrontierSha256,input.outputSha256].every(hash))fail()
    for(const ref of [input.epoch,input.dispatch,input.completion]) {
      exact(ref,['key','sha256']);if(!id(ref.key,512)||!hash(ref.sha256))fail()
    }
  }else {
    if(input.schemaVersion!==1)fail()
    exact(input,['schemaVersion','encoding','sessionId','realmEpoch','batchId','anchor','sourceNativeCutSha256',
      'programSha256','dispatch','completion','dispatchMarker','completionMarker','tailSha256','frontierSha256','outputSha256'])
    if(input.encoding!=='native-mvu-schema-execution-association-v1'
      ||input.sessionId!==selector.sessionId||input.realmEpoch!==plan.realmEpoch||input.programSha256!==plan.programSha256
      ||input.batchId!==selector.batchId||!same(input.anchor,selector.anchor)
      ||![input.sourceNativeCutSha256,input.tailSha256,input.frontierSha256,input.outputSha256].every(hash))fail()
    for(const ref of [input.dispatch,input.completion]) {
      exact(ref,['key','sha256']);if(!id(ref.key,512)||!hash(ref.sha256))fail()
    }
  }
  marker(input.dispatchMarker);marker(input.completionMarker)
  if(input.dispatchMarker.seq!==plan.initialCut.nativeCut+index*2||input.completionMarker.seq!==input.dispatchMarker.seq+1
    ||index===0&&input.sourceNativeCutSha256!==recordSha256(plan.initialCut))fail()
}
export function mvuSchemaPlayerEvent(plan:MvuSchemaPlayerPlanV1,phases:readonly MvuSchemaPlayerPhaseFact[]):MvuSchemaPlayerEventV1 {
  const result=mvuSchemaPlayerResult(plan.operation.base,phases),op=plan.operation
  return sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-mvu-schema-player-event-v1' as const,
    sessionId:op.sessionId,sourceSha256:op.base.sourceSha256,
    eventId:recordSha256({encoding:'native-mvu-schema-player-event-identity-v1',planSha256:plan.planSha256}),
    plan,phases,...result},'eventSha256')
}
function mvuSchemaPlayerResult(base:MvuSchemaNumericalSnapshotV2,phases:readonly MvuSchemaPlayerPhaseFact[]) {
  if(!phases.length)fail()
  const last=phases.at(-1)!
  const commandRefusal=last.output.kind==='accepted'&&last.output.commands.length?sealMvuSchemaStoryFact({schemaVersion:1 as const,
    encoding:'native-mvu-schema-player-command-refusal-v1' as const,phaseIndex:phases.length-1,
    phaseOutputSha256:recordSha256(last.output),code:'MANUAL_COMMANDS_UNSUPPORTED' as const},'refusalSha256'):null
  const commandPhase=phases[1]
  const reducer=commandPhase?.output.kind==='accepted'&&!commandPhase.output.commands.length
    ?mvuSchemaPlayerReducerBridge(commandPhase):null
  const refusal=last.output.kind==='refused'?'guest' as const:commandRefusal?'commands' as const:
    reducer?.result.kind==='rejected'?'reducer' as const:null
  if(!refusal&&phases.length!==4)fail()
  const values=refusal?base.values:last.output.kind==='accepted'?last.output.values:base.values
  const context=refusal?base.context:last.output.kind==='accepted'?last.output.context:base.context
  const valuesSha256=recordSha256(values),outcome=refusal?'refused' as const:
    valuesSha256===base.valuesSha256?'no-update' as const:'accepted' as const
  return {reducer,commandRefusal,outcome,refusal,values,valuesSha256,context,
    frontier:{nativeCut:last.association.completionMarker.seq+1,
      tailSha256:schemaExecutionServerTailSha256(last.association),
      frontierSha256:schemaExecutionHostFrontierSha256(last.association)}}
}
export function mvuSchemaPlayerRevisionEventId(plan:MvuSchemaPlayerRevisionPlanV1):string {
  return recordSha256({encoding:'native-mvu-schema-player-revision-event-identity-v1',planSha256:plan.planSha256})
}
export function mvuSchemaPlayerRevisionEvent(plan:MvuSchemaPlayerRevisionPlanV1,
  phases:readonly MvuSchemaPlayerPhaseFact[]):MvuSchemaPlayerRevisionEventV1 {
  return sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-mvu-schema-player-revision-event-v1' as const,
    sessionId:plan.execution.sessionId,sourceSha256:plan.execution.sourceSha256,
    eventId:mvuSchemaPlayerRevisionEventId(plan),plan,phases,...mvuSchemaPlayerResult(plan.base,phases)},'eventSha256')
}
export function validateMvuSchemaPlayerRevisionEvent(input:MvuSchemaPlayerRevisionEventV1):MvuSchemaPlayerRevisionEventV1 {
  const event=freezeMvuSchemaStoryData(input),plan=validateMvuSchemaPlayerRevisionPlan(event.plan)
  exact(event,['schemaVersion','encoding','sessionId','sourceSha256','eventId','plan','phases','reducer','commandRefusal',
    'outcome','refusal','values','valuesSha256','context','frontier','eventSha256'])
  fact(event,'eventSha256')
  validatePlayerPhases(plan,event.phases,event.reducer)
  if(event.eventSha256!==mvuSchemaPlayerRevisionEvent(plan,event.phases).eventSha256)fail()
  return event
}
export function mvuSchemaPlayerRevisionHead(event:MvuSchemaPlayerRevisionEventV1):MvuSchemaPlayerRevisionHeadV1 {
  return freezeMvuSchemaStoryData({schemaVersion:1,encoding:'native-mvu-schema-player-revision-head-v1',
    sessionId:event.sessionId,sourceSha256:event.sourceSha256,root:event.plan.execution.root,
    revision:event.plan.revision.publicationRevision,eventId:event.eventId,eventSha256:event.eventSha256,
    planSha256:event.plan.planSha256,valuesSha256:event.valuesSha256})
}
export function validateMvuSchemaPlayerEvent(input:MvuSchemaPlayerEventV1):MvuSchemaPlayerEventV1 {
  const event=freezeMvuSchemaStoryData(input),plan=validateMvuSchemaPlayerPlan(event.plan)
  return playerEventForParsedPlan(event,plan)
}
function playerEventForParsedPlan(event:MvuSchemaPlayerEventV1,plan:MvuSchemaPlayerPlanV1):MvuSchemaPlayerEventV1 {
  exact(event,['schemaVersion','encoding','sessionId','sourceSha256','eventId','plan','phases','reducer','commandRefusal',
    'outcome','refusal','values','valuesSha256','context','frontier','eventSha256'])
  fact(event,'eventSha256')
  validatePlayerPhases(plan,event.phases,event.reducer)
  // fact() checked the stored body; the constructor seals the canonical body
  // with this parsed plan. Consume those hashes without hashing both again.
  if(event.eventSha256!==mvuSchemaPlayerEvent(plan,event.phases).eventSha256)fail()
  return event
}
function validatePlayerPhases(plan:MvuSchemaPlayerPlanV1|MvuSchemaPlayerRevisionPlanV1,
  phases:readonly MvuSchemaPlayerPhaseFact[],reducer:MvuSchemaPlayerReducerBridge|null):void {
  if(!Array.isArray(phases)||!phases.length||phases.length>4)fail()
  for(const [index,phase] of phases.entries()) {
    exact(phase,['phase','input','association','output']);output(phase.output,phase.input);association(phase.association,plan,index)
    let read:MvuScopeReadFrameV1|undefined
    let reference:MvuScopeReadRefV2|undefined
    if(plan.schemaVersion===10) {
      const input=validateSchemaEvaluationInputV4(phase.input)
      if(input.encoding!=='native-mvu-author-schema-phase-input-v4-scope-ref-v2')fail()
      reference=input.scopeReadRef
      if(!schemaScopeReadRefFactsEqualV2(reference,plan.scopeReadRef)
        ||reference.sourceNativeCutSha256!==phase.association.sourceNativeCutSha256)fail()
    } else {
      const input=validateSchemaEvaluationInputV4(phase.input)
      if(input.encoding!=='native-mvu-author-schema-phase-input-v4')fail()
      read=input.scopeReadFrame
      if(!schemaScopeReadFactsEqual(read,plan.scopeReadFrame)
        ||read.sourceNativeCutSha256!==phase.association.sourceNativeCutSha256)fail()
    }
    if(phase.phase!==MVU_SCHEMA_PLAYER_PHASES[index]||phase.association.outputSha256!==recordSha256(phase.output)
      ||!same(phase.input,mvuSchemaPlayerPhaseInput(plan,index,phases,read,reference))
      ||(phase.output.kind==='refused'||phase.output.commands.length>0)&&index!==phases.length-1)fail()
  }
  if(reducer?.result.kind==='rejected'&&phases.length!==2)fail()
}
export function mvuSchemaPlayerHead(event:MvuSchemaPlayerEventV1):MvuSchemaNumericalHead {
  if(event.outcome!=='accepted')return event.plan.operation.base.currentHead
  const base=event.plan.operation.base
  const head:MvuSchemaPlayerHeadV1={schemaVersion:1,encoding:'native-mvu-schema-player-head-v1',sessionId:event.sessionId,
    sourceSha256:event.sourceSha256,root:base.root,revision:base.revision+1,eventId:event.eventId,
    eventSha256:event.eventSha256,planSha256:event.plan.planSha256,valuesSha256:event.valuesSha256}
  return freezeMvuSchemaStoryData(head)
}
export function mvuSchemaPlayerSettlement(event:MvuSchemaPlayerEventV1):MvuSchemaPlayerSettlementV1 {
  const head=mvuSchemaPlayerHead(event),op=event.plan.operation
  return sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-mvu-schema-player-settlement-v1' as const,
    sessionId:event.sessionId,sourceSha256:event.sourceSha256,planSha256:event.plan.planSha256,
    operationSha256:op.operationSha256,marker:event.plan.marker,outcome:event.outcome,
    event:{key:mvuSchemaPlayerEventKey(event.sessionId,event.eventId),sha256:event.eventSha256},
    result:{head,headSha256:recordSha256(head),revision:head.revision,valuesSha256:event.valuesSha256,
      contextSha256:recordSha256(event.context),frontier:event.frontier}},'settlementSha256')
}
export function validateMvuSchemaPlayerSettlement(input:MvuSchemaPlayerSettlementV1,event:MvuSchemaPlayerEventV1):MvuSchemaPlayerSettlementV1 {
  const value=freezeMvuSchemaStoryData(input)
  return playerSettlementForParsedEvent(value,validateMvuSchemaPlayerEvent(event))
}
function playerSettlementForParsedEvent(value:MvuSchemaPlayerSettlementV1,event:MvuSchemaPlayerEventV1):MvuSchemaPlayerSettlementV1 {
  if(!same(value,mvuSchemaPlayerSettlement(event)))fail()
  return value
}
export function makeMvuSchemaPlayerCompletion(plan:MvuSchemaPlayerPlanV1,settlement:MvuSchemaPlayerSettlementV1):MvuSchemaPlayerCompletionV1 {
  settlement=playerSettlementForParsedPlan(settlement,plan)
  return playerCompletionFromParsedFacts(plan,settlement)
}
function playerSettlementForParsedPlan(input:MvuSchemaPlayerSettlementV1,plan:MvuSchemaPlayerPlanV1):MvuSchemaPlayerSettlementV1 {
  const settlement=freezeMvuSchemaStoryData(input)
  exact(settlement,['schemaVersion','encoding','sessionId','sourceSha256','planSha256','operationSha256','marker',
    'outcome','event','result','settlementSha256']);fact(settlement,'settlementSha256')
  exact(settlement.event,['key','sha256'])
  exact(settlement.result,['head','headSha256','revision','valuesSha256','contextSha256','frontier'])
  exact(settlement.result.frontier,['nativeCut','tailSha256','frontierSha256'])
  marker(settlement.marker)
  const head=validateMvuSchemaStoryHead(settlement.result.head)
  const op=plan.operation
  const eventId=recordSha256({encoding:'native-mvu-schema-player-event-identity-v1',planSha256:plan.planSha256})
  if(settlement.schemaVersion!==1||settlement.encoding!=='native-mvu-schema-player-settlement-v1'
    ||settlement.planSha256!==plan.planSha256||settlement.operationSha256!==op.operationSha256
    ||settlement.sessionId!==op.sessionId||settlement.sourceSha256!==op.base.sourceSha256
    ||!same(settlement.marker,plan.marker)||!['accepted','refused','no-update'].includes(settlement.outcome)
    ||settlement.event.key!==mvuSchemaPlayerEventKey(op.sessionId,eventId)||!hash(settlement.event.sha256)
    ||head.sessionId!==op.sessionId||head.revision!==settlement.result.revision
    ||recordSha256(head)!==settlement.result.headSha256||head.valuesSha256!==settlement.result.valuesSha256
    ||!hash(settlement.result.contextSha256)||!integer(settlement.result.frontier.nativeCut)
    ||![settlement.result.frontier.tailSha256,settlement.result.frontier.frontierSha256].every(hash))fail()
  const phaseCount=(settlement.result.frontier.nativeCut-plan.initialCut.nativeCut)/2
  if(!integer(phaseCount,1)||phaseCount>4||settlement.outcome!=='refused'&&phaseCount!==4)fail()
  if(settlement.outcome==='accepted') {
    if(head.encoding!=='native-mvu-schema-player-head-v1'||head.sourceSha256!==op.base.sourceSha256
      ||!same(head.root,op.base.root)||head.revision!==op.base.revision+1||head.eventId!==eventId
      ||head.eventSha256!==settlement.event.sha256||head.planSha256!==plan.planSha256
      ||head.valuesSha256===op.base.valuesSha256)fail()
  }else if(!same(head,op.base.currentHead)||settlement.result.valuesSha256!==op.base.valuesSha256
    ||settlement.outcome==='refused'&&settlement.result.contextSha256!==recordSha256(op.base.context))fail()
  return settlement
}
function playerCompletionFromParsedFacts(plan:MvuSchemaPlayerPlanV1,settlement:MvuSchemaPlayerSettlementV1):MvuSchemaPlayerCompletionV1 {
  const op=plan.operation
  return sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-mvu-schema-player-complete-v1' as const,
    sessionId:op.sessionId,operationId:op.operationId,operation:{key:mvuSchemaPlayerOperationKey(op.sessionId,op.operationId),
      sha256:op.operationSha256},marker:plan.marker,planSha256:plan.planSha256,
    settlement:{key:mvuSchemaPlayerSettlementKey(op.sessionId,plan.planSha256),sha256:recordSha256(settlement)},
    outcome:settlement.outcome},'completionSha256')
}
export function validateMvuSchemaPlayerCompletion(input:MvuSchemaPlayerCompletionV1,plan:MvuSchemaPlayerPlanV1,
  settlement:MvuSchemaPlayerSettlementV1):MvuSchemaPlayerCompletionV1 {
  const value=freezeMvuSchemaStoryData(input)
  plan=validateMvuSchemaPlayerPlan(plan)
  settlement=playerSettlementForParsedPlan(settlement,plan)
  return playerCompletionForParsedFacts(value,plan,settlement)
}
function playerCompletionForParsedFacts(value:MvuSchemaPlayerCompletionV1,plan:MvuSchemaPlayerPlanV1,
  settlement:MvuSchemaPlayerSettlementV1):MvuSchemaPlayerCompletionV1 {
  if(!same(value,playerCompletionFromParsedFacts(plan,settlement)))fail()
  return value
}
export function makeMvuSchemaPlayerRefusal(op:MvuSchemaPlayerOperationV1,code:string):MvuSchemaPlayerRefusalV1 {
  op=validateMvuSchemaPlayerOperation(op);if(schemaPlayerCode(code)!==code)fail()
  return sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-mvu-schema-player-refused-v1' as const,
    sessionId:op.sessionId,operationId:op.operationId,operationSha256:op.operationSha256,code},'refusalSha256')
}
export function validateMvuSchemaPlayerRefusal(input:MvuSchemaPlayerRefusalV1,op:MvuSchemaPlayerOperationV1):MvuSchemaPlayerRefusalV1 {
  const value=freezeMvuSchemaStoryData(input)
  if(!same(value,makeMvuSchemaPlayerRefusal(op,value.code)))fail()
  return value
}

/** A durable operation/plan and its unique actual Native marker prove only
 * recorded inputs. Missing publication or owner ACK is never resumed here. */
export function readMvuSchemaPlayerPlanFacts(branch:{get(key:string):unknown},_status:{get(key:string):unknown},
  suppliedOperation:MvuSchemaPlayerOperationV1,actualEvents:PlayerNativeHistory) {
  const operation=validateMvuSchemaPlayerOperation(suppliedOperation),sid=operation.sessionId,opid=operation.operationId
  const storedOperation=validateMvuSchemaPlayerOperation(branch.get(mvuSchemaPlayerOperationKey(sid,opid)) as MvuSchemaPlayerOperationV1)
  if(!same(operation,storedOperation)||branch.get(mvuSchemaPlayerRefusalKey(sid,opid))!==undefined)fail()
  if(Array.isArray(actualEvents)&&(actualEvents.length>100000
    ||actualEvents.some((event,index)=>!event||typeof event!=='object'||event.seq!==index||typeof event.type!=='string')))fail()
  const actualMarker=playerMarker(actualEvents,sid,opid)
  if(!actualMarker)fail()
  verifyMvuSchemaPlayerMarker(operation,actualMarker,actualEvents)
  const plan=validateMvuSchemaPlayerPlan(branch.get(mvuSchemaPlayerPlanKey(sid,opid)) as MvuSchemaPlayerPlanV1)
  if(!same(plan.operation,operation)||!same(plan.marker,{seq:actualMarker.seq,sha256:recordSha256(actualMarker)})
    ||plan.initialCut.nativeCut>actualEvents.length
    ||plan.initialCut.nativePrefixSha256!==(Array.isArray(actualEvents)?recordSha256(actualEvents.slice(0,plan.initialCut.nativeCut))
      :(actualEvents as SessionHistoryCut<SessionEvent>).prefixSha256(plan.initialCut.nativeCut)))fail()
  // This entire Domain read is synchronous. Reuse its parsed operation and
  // plan after the Native join; no writer has run between these facts.
  return {operation,plan,marker:actualMarker}
}

/** Cold readback confirms complete facts only. Root additionally verifies
 * every actual schema pair, original Source/load and the full history order. */
export function readMvuSchemaPlayerCompletedFacts(branch:{get(key:string):unknown},status:{get(key:string):unknown},
  suppliedOperation:MvuSchemaPlayerOperationV1,actualEvents:PlayerNativeHistory) {
  const {operation,plan,marker:actualMarker}=readMvuSchemaPlayerPlanFacts(branch,status,suppliedOperation,actualEvents)
  const sid=operation.sessionId
  const eventId=recordSha256({encoding:'native-mvu-schema-player-event-identity-v1',planSha256:plan.planSha256})
  const storedEvent=freezeMvuSchemaStoryData(status.get(mvuSchemaPlayerEventKey(sid,eventId)) as MvuSchemaPlayerEventV1)
  const event=playerEventForParsedPlan(storedEvent,plan)
  return completedPlayerFacts({operation,plan,marker:actualMarker},event,branch,status)
}
/** InputState retains this actual persistent read for both the pending-state
 * projection and current Story fold. It grants no execution/publication lease. */
export interface MvuSchemaPlayerLedger {
  readonly code?:string
  readonly completedByEventKey:ReadonlyMap<string,ReturnType<typeof readMvuSchemaPlayerCompletedFacts>>
}
/** Core's synchronous history inventory already parsed this actual status
 * event. Join it to the independently read branch plan and durable closure;
 * these DATA facts do not grant execution or publication permission. */
export function joinMvuSchemaPlayerCompletedEvent(branch:{get(key:string):unknown},status:{get(key:string):unknown},
  event:MvuSchemaPlayerEventV1,actualEvents:PlayerNativeHistory) {
  const facts=readMvuSchemaPlayerPlanFacts(branch,status,event.plan.operation,actualEvents)
  // Both complete parsers established their plan checksum in this read.
  if(event.plan.planSha256!==facts.plan.planSha256)fail()
  return completedPlayerFacts(facts,event,branch,status)
}
function completedPlayerFacts(facts:ReturnType<typeof readMvuSchemaPlayerPlanFacts>,event:MvuSchemaPlayerEventV1,
  branch:{get(key:string):unknown},status:{get(key:string):unknown}) {
  const {operation,plan,marker:actualMarker}=facts,sid=operation.sessionId,opid=operation.operationId
  const storedSettlement=status.get(mvuSchemaPlayerSettlementKey(sid,plan.planSha256)) as MvuSchemaPlayerSettlementV1
  // The event's parser and actual-plan join already ran in this same read.
  // The settlement's canonical link supplies the completion's event facts.
  const settlement=playerSettlementForParsedEvent(freezeMvuSchemaStoryData(storedSettlement),event)
  const storedCompletion=branch.get(mvuSchemaPlayerCompletionKey(sid,opid)) as MvuSchemaPlayerCompletionV1
  const completion=playerCompletionForParsedFacts(freezeMvuSchemaStoryData(storedCompletion),plan,settlement)
  const body={schemaVersion:2 as const,encoding:'native-mvu-schema-state-snapshot-v2' as const,
    sessionId:sid,sourceSha256:operation.base.sourceSha256,root:operation.base.root,currentHead:settlement.result.head,
    revision:settlement.result.revision,headSha256:settlement.result.headSha256,values:event.values,
    valuesSha256:event.valuesSha256,context:event.context,schemaFrontier:event.frontier}
  const result=validateMvuSchemaNumericalSnapshot(sealMvuSchemaStoryFact(body,'stateSnapshotSha256'))
  return {operation,plan,event,settlement,completion,marker:actualMarker,result}
}
