/** Schema player facts preserve the original replacement request separately
 * from author outputs. Bounded hashes describe facts, never execution rights. */
import {recordSha256} from './roleplay-data.js'
import {readMvuPlayerRequest} from './roleplay-mvu-player-facts.js'
import {cloneMvuPlayerReplacement} from './roleplay-mvu-player-records.js'
import {cloneSchemaValues} from './tavern-mvu-schema-data.js'
import {reduceMvuUpdateOperations} from './roleplay-mvu-update.js'
import {reduceMvuUpdateOperationsV2} from './roleplay-mvu-update-v2.js'
import type {PreparedMvuUpdateV2,MvuUpdateRejectionV2} from './roleplay-mvu-update-v2.js'
import {schemaEmptyPhaseInput} from './roleplay-mvu-schema-executor-types.js'
import type {SchemaEvaluationInput,SchemaGuestOutput} from './roleplay-mvu-schema-executor-types.js'
import {validateSchemaGuestOutputV2} from './tavern-mvu-schema-runner-v2.js'
import {validateSchemaEvaluationInputV3,validateSchemaGuestOutputV3} from './tavern-mvu-schema-runner-v3.js'
import {validateSchemaEvaluationInputV4,validateSchemaGuestOutputV4} from './tavern-mvu-schema-runner-v4.js'
import {validateMvuScopeReadFrameV1} from './tavern-mvu-scope-read.js'
import {schemaScopeReadFactsEqual} from './roleplay-mvu-schema-scope-facts.js'
import {validateSchemaAnchor,validateSchemaSourceCut} from './roleplay-mvu-schema-journal.js'
import {validateSchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import {schemaExecutionServerTailSha256,schemaExecutionHostFrontierSha256} from './roleplay-mvu-schema-replay.js'
import {freezeMvuSchemaStoryData,sealMvuSchemaStoryFact,validateMvuSchemaNumericalSnapshot,
  validateMvuSchemaStoryHead,validateMvuSchemaStoryRoot} from './roleplay-mvu-schema-story-types.js'
import {assertMvuPlayerEditEvent,assertMvuPlayerMarkerBoundary,MVU_PLAYER_EDIT_EVENT}
  from 'dsh-nexttavern-session-format/mvu-player-marker'
import type {SessionEvent} from '@deepseek-ai/dsh-session'
import type {MvuPlayerEditRequest,MvuPlayerEditExpected} from './roleplay-mvu-player-types.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {PreparedMvuUpdate,MvuUpdateRejection} from './roleplay-mvu-update.js'
import type {SchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import type {MvuSchemaStoryRoot,MvuSchemaNumericalSnapshotV2,MvuSchemaNumericalHead,
  MvuSchemaPlayerHeadV1,MvuSchemaStoryFrontier} from './roleplay-mvu-schema-story-types.js'
import type {SchemaExecutionAssociation,SchemaExecutionSelector,SchemaExecutionResult,SourceNativeCutFacts}
  from './roleplay-mvu-schema-replay.js'
import type {SchemaNativeMarkerRef,SchemaJournalRef} from './roleplay-mvu-schema-journal.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'

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
export interface MvuSchemaPlayerPlanLegacyV1 {
  schemaVersion:1;encoding:'native-mvu-schema-player-plan-v1'
  operation:MvuSchemaPlayerOperationV1;marker:SchemaNativeMarkerRef;currentFrame:SchemaStorySourceFrame
  realmEpoch:string;programSha256:string;initialCut:SourceNativeCutFacts;clockEpochMs:number;randomSeed:string
  selectors:readonly SchemaExecutionSelector[];planSha256:string
}
export interface MvuSchemaPlayerPlanV2 extends Omit<MvuSchemaPlayerPlanLegacyV1,'schemaVersion'|'encoding'> {
  schemaVersion:2;encoding:'native-mvu-schema-player-plan-v2';executorVersion:2
}
export interface MvuSchemaPlayerPlanV3 extends Omit<MvuSchemaPlayerPlanLegacyV1,'schemaVersion'|'encoding'> {
  schemaVersion:3;encoding:'native-mvu-schema-player-plan-v3';executorVersion:3
  scopeReadFrame:MvuScopeReadFrameV1
}
export interface MvuSchemaPlayerPlanV4 extends Omit<MvuSchemaPlayerPlanV3,'schemaVersion'|'encoding'|'executorVersion'> {
  schemaVersion:4;encoding:'native-mvu-schema-player-plan-v4';executorVersion:4
  errorPolicy?:'registered-command-policy-v1'
}
/** Host5's Combined identity does not change manual phase ABI4. */
export interface MvuSchemaPlayerPlanV5 extends Omit<MvuSchemaPlayerPlanV4,'schemaVersion'|'encoding'> {
  schemaVersion:5;encoding:'native-mvu-schema-player-plan-v5'
  epoch:SchemaJournalRef;serverProgramSha256:string
}
export type MvuSchemaPlayerPlanV1=MvuSchemaPlayerPlanLegacyV1|MvuSchemaPlayerPlanV2|MvuSchemaPlayerPlanV3|MvuSchemaPlayerPlanV4
  |MvuSchemaPlayerPlanV5
export interface MvuSchemaPlayerPhaseFact {
  phase:MvuSchemaPlayerPhase;input:SchemaEvaluationInput
  association:SchemaExecutionAssociation;output:SchemaGuestOutput
}
export interface MvuSchemaPlayerReducerBridgeV1 {
  schemaVersion:1;encoding:'native-mvu-schema-player-reducer-bridge-v1'
  phaseOutputSha256:string;result:PreparedMvuUpdate|MvuUpdateRejection;bridgeSha256:string
}
export interface MvuSchemaPlayerReducerBridgeV2 {
  schemaVersion:2;encoding:'native-mvu-schema-player-reducer-bridge-v2'
  phaseOutputSha256:string;result:PreparedMvuUpdateV2|MvuUpdateRejectionV2;bridgeSha256:string
}
export type MvuSchemaPlayerReducerBridge=MvuSchemaPlayerReducerBridgeV1|MvuSchemaPlayerReducerBridgeV2
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
  stage:'before-event'|'after-event'|'before-head'|'after-head'|'before-settlement'|'after-settlement'
}
export interface MvuSchemaPlayerDeps {
  table:{get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>}
  readReady(plan:MvuSchemaPlayerPlanV1):{kind:'ready';snapshot:MvuSchemaNumericalSnapshotV2}|{kind:'blocked';code:string}
  ownerCurrent(owner:object,plan:MvuSchemaPlayerPlanV1):boolean
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
export function verifyMvuSchemaPlayerMarker(op:MvuSchemaPlayerOperationV1,event:SessionEvent,events:readonly SessionEvent[]):void {
  op=validateMvuSchemaPlayerOperation(op);assertMvuPlayerEditEvent(event)
  const expected={schemaVersion:1,encoding:'native-mvu-player-edit-marker-v1',sessionId:op.sessionId,
    operationId:op.operationId,requestSha256:op.requestSha256,operationSha256:op.operationSha256,
    sourceSha256:op.base.sourceSha256,rootSha256:recordSha256(op.base.root),baseSnapshotSha256:op.base.stateSnapshotSha256,
    replacementValuesSha256:recordSha256(op.request.values),observedNativeSeq:op.request.expected.observedNativeSeq}
  if(!same(event.data,expected)||event.seq!==op.request.expected.observedNativeSeq+1||!same(events[event.seq],event)
    ||events.filter(row=>row.type===MVU_PLAYER_EDIT_EVENT&&row.data.sessionId===op.sessionId
      &&row.data.operationId===op.operationId).length!==1)fail()
  assertMvuPlayerMarkerBoundary(events.slice(0,event.seq+1))
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
export function validateMvuSchemaPlayerPlan(input:MvuSchemaPlayerPlanV1):MvuSchemaPlayerPlanV1 {
  const plan=freezeMvuSchemaStoryData(input)
  exact(plan,['schemaVersion','encoding','operation','marker','currentFrame','realmEpoch','programSha256',
    'initialCut','clockEpochMs','randomSeed','selectors','planSha256',
    ...(plan.schemaVersion>=2?['executorVersion']:[]),
    ...(plan.schemaVersion>=3?['scopeReadFrame']:[]),
    ...(plan.schemaVersion===5?['epoch','serverProgramSha256']:[]),
    ...(plan.schemaVersion>=4&&'errorPolicy' in plan?['errorPolicy']:[])])
  if('errorPolicy' in plan&&plan.errorPolicy!=='registered-command-policy-v1')fail()
  fact(plan,'planSha256')
  const op=validateMvuSchemaPlayerOperation(plan.operation),cut=validateSchemaSourceCut(plan.initialCut)
  validateSchemaStorySourceFrame(plan.currentFrame);marker(plan.marker)
  if(plan.schemaVersion===3||plan.schemaVersion===4||plan.schemaVersion===5) {
    if(plan.encoding!==`native-mvu-schema-player-plan-v${plan.schemaVersion}`
      ||plan.executorVersion!==(plan.schemaVersion===5?4:plan.schemaVersion))fail()
    const read=validateMvuScopeReadFrameV1(plan.scopeReadFrame),source=plan.currentFrame.snapshot.source
    if(read.source.sessionId!==op.sessionId||read.source.sourceRecordSessionId!==source.sourceRecordSessionId
      ||read.source.importId!==source.importId||read.source.rawSha256!==source.rawSha256
      ||read.source.sourceSnapshotSha256!==plan.currentFrame.snapshotSha256
      ||read.sourceNativeCutSha256!==recordSha256(cut))fail()
  }
  else if(plan.schemaVersion===2) {
    if(plan.encoding!=='native-mvu-schema-player-plan-v2'||plan.executorVersion!==2)fail()
  }else if(plan.schemaVersion!==1||plan.encoding!=='native-mvu-schema-player-plan-v1')fail()
  if(plan.schemaVersion===5) {
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
const completedRefusalCodes=new Set(['SCHEMA_REGISTRATION_MISSING','SCHEMA_REGISTRATION_INVALID','SCHEMA_REGISTRATION_LIMIT',
  'SCHEMA_READY_INVALID','SCHEMA_READ_UNSUPPORTED','SCHEMA_HOST_UNAVAILABLE','SCHEMA_VALIDATION_FAILED',
  'SCHEMA_OUTPUT_DATA_INVALID','SCHEMA_ROOT_OBJECT_REQUIRED','SCHEMA_PHASE_UNSUPPORTED','SCHEMA_COMMAND_CLEANUP_FAILED'])
function output(input:SchemaGuestOutput,frame:SchemaEvaluationInput) {
  if(frame.schemaVersion===4) {
    validateSchemaGuestOutputV4(input,validateSchemaEvaluationInputV4(frame))
    return
  }
  if(frame.schemaVersion===3) {
    validateSchemaGuestOutputV3(input,validateSchemaEvaluationInputV3(frame))
    return
  }
  if('schemaVersion' in input) {
    if(frame.schemaVersion!==2)fail()
    validateSchemaGuestOutputV2(input,frame)
    return
  }
  if(frame.schemaVersion!==1)fail()
  if(input.kind==='accepted') {
    exact(input,['kind','values','commands','context','registrations'])
    cloneMvuPlayerReplacement({values:input.values,valuesSha256:recordSha256(input.values)});cloneSchemaValues(input.context)
    if(!integer(input.registrations,1)||input.registrations>64||!Array.isArray(input.commands)||input.commands.length>64
      ||Object.hasOwn(input.context,'stat_data'))fail()
    for(const command of input.commands)cloneSchemaValues(command)
  }else if(input.kind==='refused') {
    exact(input,['kind','diagnostics'])
    if(!Array.isArray(input.diagnostics)||!input.diagnostics.length||input.diagnostics.length>64)fail()
    for(const diagnostic of input.diagnostics) {
      exact(diagnostic,['code']);if(!completedRefusalCodes.has(diagnostic.code))fail()
    }
  }else fail()
}
export function mvuSchemaPlayerReducerBridge(phase:MvuSchemaPlayerPhaseFact):MvuSchemaPlayerReducerBridge {
  if(phase.phase!=='command-parsed'||phase.output.kind!=='accepted'||phase.output.commands.length)fail()
  if(phase.input.schemaVersion===3||phase.input.schemaVersion===4) {
    const input=phase.input.schemaVersion===4?validateSchemaEvaluationInputV4(phase.input):validateSchemaEvaluationInputV3(phase.input)
    if(input.phase!=='command-parsed')fail()
    const output=input.schemaVersion===4?validateSchemaGuestOutputV4(phase.output,input):validateSchemaGuestOutputV3(phase.output,input)
    if(output.kind!=='accepted')fail()
    return sealMvuSchemaStoryFact({schemaVersion:2 as const,encoding:'native-mvu-schema-player-reducer-bridge-v2' as const,
      phaseOutputSha256:recordSha256(phase.output),result:reduceMvuUpdateOperationsV2(output.values,[])},'bridgeSha256')
  }
  if('schemaVersion' in phase.output) {
    return sealMvuSchemaStoryFact({schemaVersion:2 as const,encoding:'native-mvu-schema-player-reducer-bridge-v2' as const,
      phaseOutputSha256:recordSha256(phase.output),result:reduceMvuUpdateOperationsV2(phase.output.values,[])},'bridgeSha256')
  }
  return sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-mvu-schema-player-reducer-bridge-v1' as const,
    phaseOutputSha256:recordSha256(phase.output),result:reduceMvuUpdateOperations(phase.output.values,[])},'bridgeSha256')
}
export function mvuSchemaPlayerPhaseInput(plan:MvuSchemaPlayerPlanV1,index:number,
  phases:readonly MvuSchemaPlayerPhaseFact[],scopeReadFrame?:MvuScopeReadFrameV1):SchemaEvaluationInput {
  if(!integer(index)||index>=MVU_SCHEMA_PLAYER_PHASES.length||phases.length<index)fail()
  let values=plan.operation.request.values,context=plan.operation.base.context
  if(index) {
    const previous=phases[index-1]!.output
    if(previous.kind!=='accepted'||previous.commands.length)fail()
    values=previous.values;context=previous.context
    if(index===2) {
      const bridge=mvuSchemaPlayerReducerBridge(phases[1]!)
      if(bridge.result.kind!=='prepared')fail()
      values=bridge.result.values
    }
  }
  if(plan.schemaVersion===3||plan.schemaVersion===4||plan.schemaVersion===5) {
    const read=validateMvuScopeReadFrameV1(scopeReadFrame??plan.scopeReadFrame)
    if(!schemaScopeReadFactsEqual(read,plan.scopeReadFrame))fail()
    const version=plan.schemaVersion===5?4:plan.schemaVersion
    const input=schemaEmptyPhaseInput(version,MVU_SCHEMA_PLAYER_PHASES[index]!,
      plan.operation.base.values,values,context,plan.clockEpochMs,plan.randomSeed,read,
      plan.schemaVersion===4||plan.schemaVersion===5?plan.errorPolicy:undefined)
    return freezeMvuSchemaStoryData(version===4?validateSchemaEvaluationInputV4(input):validateSchemaEvaluationInputV3(input))
  }
  return freezeMvuSchemaStoryData(schemaEmptyPhaseInput(plan.schemaVersion,MVU_SCHEMA_PLAYER_PHASES[index]!,
    plan.operation.base.values,values,context,plan.clockEpochMs,plan.randomSeed))
}
function association(input:SchemaExecutionAssociation,plan:MvuSchemaPlayerPlanV1,index:number) {
  const selector=plan.selectors[index]!
  if(plan.schemaVersion===5) {
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
  if(!phases.length)fail()
  const last=phases.at(-1)!,op=plan.operation
  const commandRefusal=last.output.kind==='accepted'&&last.output.commands.length?sealMvuSchemaStoryFact({schemaVersion:1 as const,
    encoding:'native-mvu-schema-player-command-refusal-v1' as const,phaseIndex:phases.length-1,
    phaseOutputSha256:recordSha256(last.output),code:'MANUAL_COMMANDS_UNSUPPORTED' as const},'refusalSha256'):null
  const commandPhase=phases[1]
  const reducer=commandPhase?.output.kind==='accepted'&&!commandPhase.output.commands.length
    ?mvuSchemaPlayerReducerBridge(commandPhase):null
  const refusal=last.output.kind==='refused'?'guest' as const:commandRefusal?'commands' as const:
    reducer?.result.kind==='rejected'?'reducer' as const:null
  if(!refusal&&phases.length!==4)fail()
  const values=refusal?op.base.values:last.output.kind==='accepted'?last.output.values:op.base.values
  const context=refusal?op.base.context:last.output.kind==='accepted'?last.output.context:op.base.context
  const valuesSha256=recordSha256(values),outcome=refusal?'refused' as const:
    valuesSha256===op.base.valuesSha256?'no-update' as const:'accepted' as const
  return sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-mvu-schema-player-event-v1' as const,
    sessionId:op.sessionId,sourceSha256:op.base.sourceSha256,
    eventId:recordSha256({encoding:'native-mvu-schema-player-event-identity-v1',planSha256:plan.planSha256}),
    plan,phases,reducer,commandRefusal,outcome,refusal,values,valuesSha256,context,
    frontier:{nativeCut:last.association.completionMarker.seq+1,
      tailSha256:schemaExecutionServerTailSha256(last.association),
      frontierSha256:schemaExecutionHostFrontierSha256(last.association)}},'eventSha256')
}
export function validateMvuSchemaPlayerEvent(input:MvuSchemaPlayerEventV1):MvuSchemaPlayerEventV1 {
  const event=freezeMvuSchemaStoryData(input),plan=validateMvuSchemaPlayerPlan(event.plan)
  exact(event,['schemaVersion','encoding','sessionId','sourceSha256','eventId','plan','phases','reducer','commandRefusal',
    'outcome','refusal','values','valuesSha256','context','frontier','eventSha256'])
  fact(event,'eventSha256')
  if(!Array.isArray(event.phases)||!event.phases.length||event.phases.length>4)fail()
  for(const [index,phase] of event.phases.entries()) {
    exact(phase,['phase','input','association','output']);output(phase.output,phase.input);association(phase.association,plan,index)
    let read:MvuScopeReadFrameV1|undefined
    if(plan.schemaVersion===3||plan.schemaVersion===4||plan.schemaVersion===5) {
      read=(plan.schemaVersion>=4?validateSchemaEvaluationInputV4(phase.input):validateSchemaEvaluationInputV3(phase.input)).scopeReadFrame
      if(!schemaScopeReadFactsEqual(read,plan.scopeReadFrame)
        ||read.sourceNativeCutSha256!==phase.association.sourceNativeCutSha256)fail()
    }
    if(phase.phase!==MVU_SCHEMA_PLAYER_PHASES[index]||phase.association.outputSha256!==recordSha256(phase.output)
      ||!same(phase.input,mvuSchemaPlayerPhaseInput(plan,index,event.phases,read))
      ||(phase.output.kind==='refused'||phase.output.commands.length>0)&&index!==event.phases.length-1)fail()
  }
  if(event.reducer?.result.kind==='rejected'&&event.phases.length!==2)fail()
  if(!same(event,mvuSchemaPlayerEvent(plan,event.phases)))fail()
  return event
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
  if(!same(value,mvuSchemaPlayerSettlement(validateMvuSchemaPlayerEvent(event))))fail()
  return value
}
export function makeMvuSchemaPlayerCompletion(plan:MvuSchemaPlayerPlanV1,settlement:MvuSchemaPlayerSettlementV1):MvuSchemaPlayerCompletionV1 {
  plan=validateMvuSchemaPlayerPlan(plan)
  settlement=freezeMvuSchemaStoryData(settlement)
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
  return sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-mvu-schema-player-complete-v1' as const,
    sessionId:op.sessionId,operationId:op.operationId,operation:{key:mvuSchemaPlayerOperationKey(op.sessionId,op.operationId),
      sha256:op.operationSha256},marker:plan.marker,planSha256:plan.planSha256,
    settlement:{key:mvuSchemaPlayerSettlementKey(op.sessionId,plan.planSha256),sha256:recordSha256(settlement)},
    outcome:settlement.outcome},'completionSha256')
}
export function validateMvuSchemaPlayerCompletion(input:MvuSchemaPlayerCompletionV1,plan:MvuSchemaPlayerPlanV1,
  settlement:MvuSchemaPlayerSettlementV1):MvuSchemaPlayerCompletionV1 {
  const value=freezeMvuSchemaStoryData(input)
  if(!same(value,makeMvuSchemaPlayerCompletion(plan,settlement)))fail()
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
  suppliedOperation:MvuSchemaPlayerOperationV1,actualEvents:readonly SessionEvent[]) {
  const operation=validateMvuSchemaPlayerOperation(suppliedOperation),sid=operation.sessionId,opid=operation.operationId
  const storedOperation=validateMvuSchemaPlayerOperation(branch.get(mvuSchemaPlayerOperationKey(sid,opid)) as MvuSchemaPlayerOperationV1)
  if(!same(operation,storedOperation)||branch.get(mvuSchemaPlayerRefusalKey(sid,opid))!==undefined)fail()
  if(!Array.isArray(actualEvents)||actualEvents.length>100000
    ||actualEvents.some((event,index)=>!event||typeof event!=='object'||event.seq!==index||typeof event.type!=='string'))fail()
  const actualMarker=actualEvents.find(event=>event.type===MVU_PLAYER_EDIT_EVENT&&event.data?.sessionId===sid
    &&event.data.operationId===opid)
  if(!actualMarker)fail()
  verifyMvuSchemaPlayerMarker(operation,actualMarker,actualEvents)
  const plan=validateMvuSchemaPlayerPlan(branch.get(mvuSchemaPlayerPlanKey(sid,opid)) as MvuSchemaPlayerPlanV1)
  if(!same(plan.operation,operation)||!same(plan.marker,{seq:actualMarker.seq,sha256:recordSha256(actualMarker)})
    ||plan.initialCut.nativeCut>actualEvents.length
    ||plan.initialCut.nativePrefixSha256!==recordSha256(actualEvents.slice(0,plan.initialCut.nativeCut)))fail()
  if(!same(branch.get(mvuSchemaPlayerOperationKey(sid,opid)),operation)
    ||!same(branch.get(mvuSchemaPlayerPlanKey(sid,opid)),plan)
    ||branch.get(mvuSchemaPlayerRefusalKey(sid,opid))!==undefined)fail()
  return {operation,plan,marker:actualMarker}
}

/** Cold readback confirms complete facts only. Root additionally verifies
 * every actual schema pair, original Source/load and the full history order. */
export function readMvuSchemaPlayerCompletedFacts(branch:{get(key:string):unknown},status:{get(key:string):unknown},
  suppliedOperation:MvuSchemaPlayerOperationV1,actualEvents:readonly SessionEvent[]) {
  const {operation,plan,marker:actualMarker}=readMvuSchemaPlayerPlanFacts(branch,status,suppliedOperation,actualEvents)
  const sid=operation.sessionId,opid=operation.operationId
  const eventId=recordSha256({encoding:'native-mvu-schema-player-event-identity-v1',planSha256:plan.planSha256})
  const event=validateMvuSchemaPlayerEvent(status.get(mvuSchemaPlayerEventKey(sid,eventId)) as MvuSchemaPlayerEventV1)
  if(!same(event.plan,plan))fail()
  const storedSettlement=status.get(mvuSchemaPlayerSettlementKey(sid,plan.planSha256)) as MvuSchemaPlayerSettlementV1
  const settlement=validateMvuSchemaPlayerSettlement(storedSettlement,event)
  const storedCompletion=branch.get(mvuSchemaPlayerCompletionKey(sid,opid)) as MvuSchemaPlayerCompletionV1
  const completion=validateMvuSchemaPlayerCompletion(storedCompletion,plan,settlement)
  const body={schemaVersion:2 as const,encoding:'native-mvu-schema-state-snapshot-v2' as const,
    sessionId:sid,sourceSha256:operation.base.sourceSha256,root:operation.base.root,currentHead:settlement.result.head,
    revision:settlement.result.revision,headSha256:settlement.result.headSha256,values:event.values,
    valuesSha256:event.valuesSha256,context:event.context,schemaFrontier:event.frontier}
  const result=validateMvuSchemaNumericalSnapshot(sealMvuSchemaStoryFact(body,'stateSnapshotSha256'))
  return {operation,plan,event,settlement,completion,marker:actualMarker,result}
}
