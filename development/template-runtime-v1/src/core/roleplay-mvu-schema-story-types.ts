/** Versioned schema story facts. These validators prove bounded integrity,
 * never Native history, Source currency or private execution permission. */
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneSchemaValues} from './tavern-mvu-schema-data.js'
import {freezeImmutableDescriptorData,createImmutableDescriptorValidator} from './roleplay-mvu-schema-descriptor-data.js'
import {validateMvuSchemaOpeningHead} from './roleplay-mvu-schema-opening-types.js'
import {parseMvuUpdate,reduceMvuUpdateOperations} from './roleplay-mvu-update.js'
import {parseMvuUpdateV2,reduceMvuUpdateOperationsV2} from './roleplay-mvu-update-v2.js'
import {validateSchemaEvaluationInputV2,validateSchemaGuestOutputV2} from './tavern-mvu-schema-runner-v2.js'
import {validateSchemaEvaluationInputV3,validateSchemaGuestOutputV3} from './tavern-mvu-schema-runner-v3.js'
import {validateSchemaEvaluationInputV4,validateSchemaGuestOutputV4} from './tavern-mvu-schema-runner-v4.js'
import {validateMvuScopeReadFrameV1} from './tavern-mvu-scope-read.js'
import {schemaScopeReadFactsEqual} from './roleplay-mvu-schema-scope-facts.js'
import {validateSchemaSourceCut,validateSchemaAnchor} from './roleplay-mvu-schema-journal.js'
import {validateSchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import type {InputCompletionScope} from './roleplay-input-completion.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuUpdateCandidate,PreparedMvuUpdate,MvuUpdateRejection} from './roleplay-mvu-update.js'
import type {MvuUpdateCandidateV2,PreparedMvuUpdateV2,MvuUpdateRejectionV2,MvuUpdateOperationV2}
  from './roleplay-mvu-update-v2.js'
import type {MvuSchemaOpeningHeadV2} from './roleplay-mvu-schema-opening-types.js'
import type {SchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import type {SchemaExecutionAssociation,SchemaExecutionSelector,SchemaExecutionResult,SourceNativeCutFacts}
  from './roleplay-mvu-schema-replay.js'
import type {SchemaGuestOutput,SchemaEvaluationInput} from './roleplay-mvu-schema-executor-types.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'

export const MVU_SCHEMA_STORY_PHASES=Object.freeze(['command-parsed','commands-parsed','update-ended'] as const)
export type MvuSchemaStoryPhase=typeof MVU_SCHEMA_STORY_PHASES[number]
export interface MvuSchemaStoryRoot {
  openingEventId:string
  openingEventSha256:string
  openingHeadSha256:string
  openingPlanSha256:string
  realmEpoch:string
  programSha256:string
  derived?:{
    schemaVersion:1
    encoding:'native-mvu-schema-derived-root-v1'
    eventId:string
    eventSha256:string
    headSha256:string
    basisSha256:string
  }
}
export interface MvuSchemaStoryHeadV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-story-head-v2'
  sessionId:string
  sourceSha256:string
  root:MvuSchemaStoryRoot
  revision:number
  eventId:string
  eventSha256:string
  planSha256:string
  valuesSha256:string
}
export interface MvuSchemaPlayerHeadV1 extends Omit<MvuSchemaStoryHeadV2,'schemaVersion'|'encoding'> {
  schemaVersion:1
  encoding:'native-mvu-schema-player-head-v1'
}
export interface MvuSchemaDerivedHeadV1 {
  schemaVersion:1
  encoding:'native-mvu-schema-derived-head-v1'
  sessionId:string
  sourceSha256:string
  revision:1
  eventId:string
  eventSha256:string
  planSha256:string
  basisSha256:string
  valuesSha256:string
}
export type MvuSchemaNumericalHead=MvuSchemaOpeningHeadV2|MvuSchemaStoryHeadV2|MvuSchemaPlayerHeadV1|MvuSchemaDerivedHeadV1
export const isMvuSchemaGenesisHead=(head:MvuSchemaNumericalHead)=>head.encoding==='mvu-schema-opening-head-v2'
  ||head.encoding==='native-mvu-schema-derived-head-v1'
export interface MvuSchemaStoryFrontier {nativeCut:number;tailSha256:string;frontierSha256:string}
export interface MvuSchemaNumericalSnapshotV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-state-snapshot-v2'
  sessionId:string
  sourceSha256:string
  root:MvuSchemaStoryRoot
  currentHead:MvuSchemaNumericalHead
  revision:number
  headSha256:string
  values:MvuJsonObject
  valuesSha256:string
  context:MvuJsonObject
  schemaFrontier:MvuSchemaStoryFrontier
  stateSnapshotSha256:string
}
export interface MvuSchemaStoryCanonical {
  seq:number
  messageId:string
  versionSha256:string
  narrative:string
  narrativeSha256:string
}
export interface MvuSchemaStoryPlanV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-story-plan-v2'
  scope:InputCompletionScope
  canonical:MvuSchemaStoryCanonical
  base:MvuSchemaNumericalSnapshotV2
  candidate:MvuUpdateCandidate
  currentFrame:SchemaStorySourceFrame
  realmEpoch:string
  programSha256:string
  initialCut:SourceNativeCutFacts
  clockEpochMs:number
  randomSeed:string
  selectors:readonly SchemaExecutionSelector[]
  planSha256:string
}
export interface MvuSchemaStoryPlanV3 extends Omit<MvuSchemaStoryPlanV2,'schemaVersion'|'encoding'|'candidate'> {
  schemaVersion:3
  encoding:'native-mvu-schema-story-plan-v3'
  executorVersion:2
  candidate:MvuUpdateCandidateV2
}
export interface MvuSchemaStoryPlanV4 extends Omit<MvuSchemaStoryPlanV3,'schemaVersion'|'encoding'|'executorVersion'> {
  schemaVersion:4
  encoding:'native-mvu-schema-story-plan-v4'
  executorVersion:3
  scopeReadFrame:MvuScopeReadFrameV1
}
export interface MvuSchemaStoryPlanV5 extends Omit<MvuSchemaStoryPlanV4,'schemaVersion'|'encoding'|'executorVersion'> {
  schemaVersion:5
  encoding:'native-mvu-schema-story-plan-v5'
  executorVersion:4
}
export type MvuSchemaStoryPlan=MvuSchemaStoryPlanV2|MvuSchemaStoryPlanV3|MvuSchemaStoryPlanV4|MvuSchemaStoryPlanV5
export interface MvuSchemaStoryPhaseFact {
  phase:MvuSchemaStoryPhase
  input:SchemaEvaluationInput
  association:SchemaExecutionAssociation
  output:SchemaGuestOutput
}
export interface MvuSchemaStoryReducerBridgeV1 {
  schemaVersion:1
  encoding:'native-mvu-schema-story-reducer-bridge-v1'
  phaseOutputSha256:string
  result:PreparedMvuUpdate|MvuUpdateRejection
  bridgeSha256:string
}
export interface MvuSchemaStoryReducerBridgeV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-story-reducer-bridge-v2'
  phaseOutputSha256:string
  result:PreparedMvuUpdateV2|MvuUpdateRejectionV2
  bridgeSha256:string
}
export type MvuSchemaStoryReducerBridge=MvuSchemaStoryReducerBridgeV1|MvuSchemaStoryReducerBridgeV2
export interface MvuSchemaStoryEventV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-story-event-v2'
  sessionId:string
  sourceSha256:string
  eventId:string
  plan:MvuSchemaStoryPlan
  phases:readonly MvuSchemaStoryPhaseFact[]
  reducer:MvuSchemaStoryReducerBridge|null
  outcome:'accepted'|'refused'|'no-update'
  refusal:'guest'|'reducer'|null
  values:MvuJsonObject
  valuesSha256:string
  context:MvuJsonObject
  frontier:MvuSchemaStoryFrontier
  eventSha256:string
}
export interface MvuSchemaStorySettlementV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-story-settlement-v2'
  sessionId:string
  sourceSha256:string
  planSha256:string
  completedReceiptSha256:string
  outcome:MvuSchemaStoryEventV2['outcome']
  event:{key:string;sha256:string}
  result:{head:MvuSchemaNumericalHead;headSha256:string;revision:number;valuesSha256:string;
    contextSha256:string;frontier:MvuSchemaStoryFrontier}
  settlementSha256:string
}
export type MvuSchemaStoryLive=Extract<SchemaExecutionResult,{kind:'completed'}>
export interface MvuSchemaStoryPublicationBoundary {
  plan:MvuSchemaStoryPlan
  event:MvuSchemaStoryEventV2
  head:MvuSchemaNumericalHead
  settlement:MvuSchemaStorySettlementV2
  stage:'before-event'|'after-event'|'before-head'|'after-head'|'before-settlement'|'after-settlement'
}
export interface MvuSchemaStoryDeps {
  table:{get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>}
  /** DATA only; publish checks closingCurrent immediately before each read. */
  readReady(scope:InputCompletionScope,plan:MvuSchemaStoryPlan):
    {kind:'ready';snapshot:MvuSchemaNumericalSnapshotV2}|{kind:'blocked';code:string}
  closingCurrent(closing:object,scope:InputCompletionScope,plan:MvuSchemaStoryPlan):boolean
  executePhase(plan:MvuSchemaStoryPlan,phase:MvuSchemaStoryPhase,input:SchemaEvaluationInput,
    closing:object):Promise<SchemaExecutionResult>
  withPublicationBoundary<T>(closing:object,lastLive:MvuSchemaStoryLive,action:()=>Promise<T>):Promise<T>
  /** Root checks the final hot evidence, all actual journal pins, every phase
   * input/output and the reducer bridge under its real Source boundary. */
  checkPublication(closing:object,lastLive:MvuSchemaStoryLive,boundary:MvuSchemaStoryPublicationBoundary):boolean
}
export type MvuSchemaStoryPublication={kind:'acknowledged';settlement:MvuSchemaStorySettlementV2}
  |{kind:'blocked'|'unknown';code:string}

export const MVU_SCHEMA_STORY_BOUNDS=Object.freeze({bytes:16777216,depth:66,nodes:131072,narrativeBytes:1048576})
export function freezeMvuSchemaStoryData<T>(input:T):T {
  return freezeImmutableDescriptorData(input,MVU_SCHEMA_STORY_BOUNDS.bytes,
    {depth:MVU_SCHEMA_STORY_BOUNDS.depth,nodes:MVU_SCHEMA_STORY_BOUNDS.nodes})
}
// Journal inventory deliberately rejects non-journal rows in its namespace.
// Numerical publication facts therefore stay under the state namespace.
export const mvuSchemaStoryEventKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-story-event-${id}`
export const mvuSchemaStorySettlementKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-story-settlement-${id}`
export const schemaStoryCode=(value:unknown):string=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(value)
  ?value:'SCHEMA_STORY_UNKNOWN'
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const id=(value:unknown,max=128)=>typeof value==='string'&&new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`).test(value)
const integer=(value:unknown,min=0)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&!Object.is(value,-0)
function fail():never {throw Error('SCHEMA_STORY_RECORD_INVALID')}
function exact(value:object,required:readonly string[],optional:readonly string[]=[]) {
  const keys=Object.keys(value)
  if(required.some(key=>!keys.includes(key))||keys.some(key=>!required.includes(key)&&!optional.includes(key)))fail()
}
export function sealMvuSchemaStoryFact<T extends object,K extends string>(body:T,field:K):T&Record<K,string> {
  const value=freezeMvuSchemaStoryData(body)
  return freezeMvuSchemaStoryData({...value,[field]:recordSha256(value)}) as T&Record<K,string>
}
function fact(value:object,field:string) {
  const {[field]:checksum,...body}=value as Record<string,unknown>
  if(!hash(checksum)||recordSha256(body)!==checksum)fail()
}
export function validateMvuSchemaStoryRoot(input:MvuSchemaStoryRoot):MvuSchemaStoryRoot {
  const value=freezeMvuSchemaStoryData(input)
  const keys=['openingEventId','openingEventSha256','openingHeadSha256','openingPlanSha256','realmEpoch','programSha256']
  exact(value,keys,['derived'])
  if(!keys.every(key=>hash(value[key as keyof MvuSchemaStoryRoot])))fail()
  if(value.derived!==undefined) {
    const derived=value.derived
    exact(derived,['schemaVersion','encoding','eventId','eventSha256','headSha256','basisSha256'])
    if(derived.schemaVersion!==1||derived.encoding!=='native-mvu-schema-derived-root-v1'
      ||![derived.eventId,derived.eventSha256,derived.headSha256,derived.basisSha256].every(hash))fail()
  }
  return value
}
const root=validateMvuSchemaStoryRoot
function frontier(value:MvuSchemaStoryFrontier) {
  exact(value,['nativeCut','tailSha256','frontierSha256'])
  if(!integer(value.nativeCut)||!hash(value.tailSha256)||!hash(value.frontierSha256))fail()
}
export function validateMvuSchemaStoryHead(input:MvuSchemaNumericalHead):MvuSchemaNumericalHead {
  const head=freezeMvuSchemaStoryData(input)
  if(head.encoding==='mvu-schema-opening-head-v2')return validateMvuSchemaOpeningHead(head)
  if(head.encoding==='native-mvu-schema-derived-head-v1') {
    exact(head,['schemaVersion','encoding','sessionId','sourceSha256','revision','eventId','eventSha256',
      'planSha256','basisSha256','valuesSha256'])
    if(head.schemaVersion!==1||!id(head.sessionId,64)||head.revision!==1
      ||![head.sourceSha256,head.eventId,head.eventSha256,head.planSha256,head.basisSha256,head.valuesSha256].every(hash))fail()
    return head
  }
  exact(head,['schemaVersion','encoding','sessionId','sourceSha256','root','revision','eventId',
    'eventSha256','planSha256','valuesSha256'])
  root(head.root)
  if(!(head.schemaVersion===2&&head.encoding==='native-mvu-schema-story-head-v2'
    ||head.schemaVersion===1&&head.encoding==='native-mvu-schema-player-head-v1')||!id(head.sessionId,64)
    ||!integer(head.revision,2)||![head.sourceSha256,head.eventId,head.eventSha256,head.planSha256,head.valuesSha256].every(hash))fail()
  return head
}
const validateNumericalSnapshotDescriptor=createImmutableDescriptorValidator(validateNumericalSnapshotUncached)
export function validateMvuSchemaNumericalSnapshot(input:MvuSchemaNumericalSnapshotV2):MvuSchemaNumericalSnapshotV2 {
  return validateNumericalSnapshotDescriptor(input)
}
function validateNumericalSnapshotUncached(input:MvuSchemaNumericalSnapshotV2):MvuSchemaNumericalSnapshotV2 {
  const value=freezeMvuSchemaStoryData(input)
  exact(value,['schemaVersion','encoding','sessionId','sourceSha256','root','currentHead','revision','headSha256',
    'values','valuesSha256','context','schemaFrontier','stateSnapshotSha256'])
  fact(value,'stateSnapshotSha256');root(value.root);frontier(value.schemaFrontier)
  const head=validateMvuSchemaStoryHead(value.currentHead)
  if(value.schemaVersion!==2||value.encoding!=='native-mvu-schema-state-snapshot-v2'||!id(value.sessionId,64)
    ||!hash(value.sourceSha256)||head.sessionId!==value.sessionId||head.revision!==value.revision
    ||recordSha256(head)!==value.headSha256||head.valuesSha256!==value.valuesSha256
    ||recordSha256(cloneSchemaValues(value.values))!==value.valuesSha256)fail()
  cloneSchemaValues(value.context)
  if(head.encoding==='mvu-schema-opening-head-v2') {
    if(value.root.derived||head.eventId!==value.root.openingEventId||head.eventSha256!==value.root.openingEventSha256
      ||recordSha256(head)!==value.root.openingHeadSha256||head.planSha256!==value.root.openingPlanSha256)fail()
  } else if(head.encoding==='native-mvu-schema-derived-head-v1') {
    const derived=value.root.derived
    if(!derived||derived.eventId!==head.eventId||derived.eventSha256!==head.eventSha256
      ||derived.headSha256!==recordSha256(head)||derived.basisSha256!==head.basisSha256)fail()
  } else if(!same(head.root,value.root))fail()
  return value
}
export function deriveMvuSchemaStorySelectors(scope:InputCompletionScope,canonical:MvuSchemaStoryCanonical,
  realmEpoch:string):readonly SchemaExecutionSelector[] {
  const supplied=freezeMvuSchemaStoryData({scope,canonical,realmEpoch})
  scope=supplied.scope;canonical=supplied.canonical;realmEpoch=supplied.realmEpoch
  const anchor={kind:'story' as const,preparationId:scope.currency.preparationId,
    attemptGeneration:scope.currency.attemptGeneration,receiptGeneration:scope.currency.receiptGeneration,
    turn:scope.receipt.checkpoint.actualTurn,canonicalSeq:canonical.seq,messageId:canonical.messageId,
    messageVersionSha256:canonical.versionSha256}
  validateSchemaAnchor(anchor)
  const digest=recordSha256({scope,canonical,realmEpoch})
  return freezeMvuSchemaStoryData(MVU_SCHEMA_STORY_PHASES.map((phase,index)=>({
    sessionId:scope.receipt.checkpoint.sessionId,batchId:`story-${digest}-${index+1}`,anchor})))
}
export function validateMvuSchemaStoryPlan<T extends MvuSchemaStoryPlan>(input:T):T {
  const value=freezeMvuSchemaStoryData(input)
  exact(value,['schemaVersion','encoding','scope','canonical','base','candidate','currentFrame','realmEpoch',
    'programSha256','initialCut','clockEpochMs','randomSeed','selectors','planSha256',
    ...(value.schemaVersion>=3?['executorVersion']:[]),
    ...(value.schemaVersion>=4?['scopeReadFrame']:[])])
  fact(value,'planSha256');validateMvuSchemaNumericalSnapshot(value.base)
  validateSchemaStorySourceFrame(value.currentFrame)
  const scope=value.scope,currency=scope.currency,receipt=scope.receipt,canonical=value.canonical,frame=value.currentFrame
  exact(scope,['currency','receipt','stopGeneration'])
  exact(currency,['schemaVersion','preparationId','credentialSha256','receiptGeneration','attemptGeneration','source','snapshot'])
  exact(currency.snapshot!,['key','sha256'])
  if(currency.source.kind!=='story')fail()
  exact(currency.source,['kind','sourceSha256','headRef'])
  exact(currency.source.headRef!,['kind','sha256'])
  exact(canonical,['seq','messageId','versionSha256','narrative','narrativeSha256'])
  exact(frame,['schemaVersion','encoding','sessionId','material','materialSha256','snapshot','snapshotSha256'])
  const sourceSha=currency.source.sourceSha256
  if(!(value.schemaVersion===2&&value.encoding==='native-mvu-schema-story-plan-v2'
      ||value.schemaVersion===3&&value.encoding==='native-mvu-schema-story-plan-v3'&&value.executorVersion===2
      ||value.schemaVersion===4&&value.encoding==='native-mvu-schema-story-plan-v4'&&value.executorVersion===3
      ||value.schemaVersion===5&&value.encoding==='native-mvu-schema-story-plan-v5'&&value.executorVersion===4)
    ||currency.schemaVersion!==2
    ||currency.source.kind!=='story'||currency.source.headRef!.kind!=='schema-head'
    ||currency.source.headRef!.sha256!==value.base.stateSnapshotSha256
    ||!id(currency.preparationId)||!hash(currency.credentialSha256)
    ||!integer(currency.receiptGeneration,1)||!integer(currency.attemptGeneration,1)||!integer(scope.stopGeneration)
    ||!id(currency.snapshot!.key,512)||!hash(currency.snapshot!.sha256)||!hash(sourceSha)
    ||receipt.schemaVersion!==1||receipt.flushed!==true||receipt.checkpoint.sessionId!==value.base.sessionId
    ||receipt.checkpoint.preparation.credentialSha256!==currency.credentialSha256
    ||!integer(receipt.checkpoint.actualTurn,1)||!integer(receipt.turnEndSeq)||!hash(receipt.turnEndSha256)
    ||!integer(canonical.seq)||!id(canonical.messageId)||!hash(canonical.versionSha256)
    ||canonical.seq>=receipt.turnEndSeq||typeof canonical.narrative!=='string'
    ||Buffer.byteLength(canonical.narrative,'utf8')>1048576||sha256(canonical.narrative)!==canonical.narrativeSha256
    ||sourceSha!==value.base.sourceSha256||value.realmEpoch!==value.base.root.realmEpoch
    ||value.programSha256!==value.base.root.programSha256||!integer(value.clockEpochMs)
    ||value.randomSeed!==recordSha256({scope,canonical})||frame.schemaVersion!==1
    ||frame.encoding!=='native-mvu-schema-story-source-frame-v1'||frame.sessionId!==value.base.sessionId
    ||frame.snapshotSha256!==frame.snapshot.snapshotSha256)fail()
  const {snapshotSha256,...snapshotBody}=frame.snapshot
  if(snapshotSha256!==recordSha256(snapshotBody))fail()
  validateSchemaSourceCut(value.initialCut)
  if(value.initialCut.sessionId!==value.base.sessionId||value.initialCut.ownerSessionId!==value.base.sessionId
    ||value.initialCut.nativeCut<receipt.turnEndSeq+1||value.initialCut.nativeCut<value.base.schemaFrontier.nativeCut
    ||value.initialCut.stopGeneration!==scope.stopGeneration
    ||value.initialCut.sourceSnapshotSha256!==frame.snapshotSha256||value.initialCut.materialSha256!==frame.materialSha256
    ||!same(value.selectors,deriveMvuSchemaStorySelectors(scope,canonical,value.realmEpoch))
    ||!same(value.initialCut.anchor,value.selectors[0]!.anchor)
    ||!same(value.candidate,value.schemaVersion>=3
      ?parseMvuUpdateV2(canonical.narrative):parseMvuUpdate(canonical.narrative)))fail()
  if(value.schemaVersion===4||value.schemaVersion===5) {
    const read=validateMvuScopeReadFrameV1(value.scopeReadFrame),source=frame.snapshot.source
    if(read.source.sessionId!==value.base.sessionId||read.source.sourceRecordSessionId!==source.sourceRecordSessionId
      ||read.source.importId!==source.importId||read.source.rawSha256!==source.rawSha256
      ||read.source.sourceSnapshotSha256!==frame.snapshotSha256
      ||read.sourceNativeCutSha256!==recordSha256(value.initialCut))fail()
  }
  return value
}
function output(value:SchemaGuestOutput) {
  if('schemaVersion' in value)fail()
  if(value.kind==='accepted') {
    exact(value,['kind','values','commands','context','registrations'])
    cloneSchemaValues(value.values);cloneSchemaValues(value.context)
    if(!Array.isArray(value.commands)||value.commands.length>64||!integer(value.registrations)||value.registrations>64)fail()
    for(const command of value.commands)cloneSchemaValues(command)
  } else if(value.kind==='refused') {
    exact(value,['kind','diagnostics'])
    if(!Array.isArray(value.diagnostics)||value.diagnostics.length<1||value.diagnostics.length>64)fail()
    for(const diagnostic of value.diagnostics) {
      exact(diagnostic,['code'],['pointer','scriptIdentity','line','column','issuePath'])
      if(schemaStoryCode(diagnostic.code)!==diagnostic.code)fail()
    }
  } else fail()
}
/** Replay inputs use normalized values directly; never initialize/transform
 * the already accepted base again. Residual commands cross one pure reducer. */
export function mvuSchemaStoryPhaseInput(plan:MvuSchemaStoryPlan,index:number,
  phases:readonly MvuSchemaStoryPhaseFact[],bridge:MvuSchemaStoryReducerBridge|null,
  scopeReadFrame?:MvuScopeReadFrameV1):SchemaEvaluationInput {
  if(plan.schemaVersion===4||plan.schemaVersion===5) {
    if(!integer(index)||index>=MVU_SCHEMA_STORY_PHASES.length||phases.length<index)fail()
    const read=validateMvuScopeReadFrameV1(scopeReadFrame??plan.scopeReadFrame)
    if(!schemaScopeReadFactsEqual(read,plan.scopeReadFrame))fail()
    let values=plan.base.values,commands:readonly MvuUpdateOperationV2[]=[],context=plan.base.context
    if(index===0)commands=plan.candidate.kind==='parsed'?plan.candidate.operations:[]
    else {
      const previous=phases[index-1]!
      const accepted=plan.schemaVersion===5
        ?validateSchemaGuestOutputV4(previous.output,validateSchemaEvaluationInputV4(previous.input))
        :validateSchemaGuestOutputV3(previous.output,validateSchemaEvaluationInputV3(previous.input))
      if(accepted.kind!=='accepted')fail()
      context=accepted.context;commands=accepted.commands
      if(index===1) {
        if(!bridge||bridge.schemaVersion!==2||bridge.result.kind!=='prepared')fail()
        values=bridge.result.values
      } else values=accepted.values
    }
    if(plan.schemaVersion===5)return freezeMvuSchemaStoryData(validateSchemaEvaluationInputV4({schemaVersion:4,
      encoding:'native-mvu-author-schema-phase-input-v4',commandsEncoding:'native-mvu-update-operations-v2',
      errorPolicy:'atomic-refusal',phase:MVU_SCHEMA_STORY_PHASES[index]!,base:plan.base.values,
      values,commands,context,scopeReadFrame:read,clockEpochMs:plan.clockEpochMs,randomSeed:plan.randomSeed}))
    return freezeMvuSchemaStoryData(validateSchemaEvaluationInputV3({schemaVersion:3,
      encoding:'native-mvu-author-schema-phase-input-v3',commandsEncoding:'native-mvu-update-operations-v2',
      errorPolicy:'atomic-refusal',phase:MVU_SCHEMA_STORY_PHASES[index]!,base:plan.base.values,
      values,commands,context,scopeReadFrame:read,clockEpochMs:plan.clockEpochMs,randomSeed:plan.randomSeed}))
  }
  if(plan.schemaVersion===3) {
    let values=plan.base.values,commands:readonly MvuUpdateOperationV2[]=[],context=plan.base.context
    if(index===0)commands=plan.candidate.kind==='parsed'?plan.candidate.operations:[]
    else {
      const previous=phases[index-1]!
      const accepted=validateSchemaGuestOutputV2(previous.output,validateSchemaEvaluationInputV2(previous.input))
      if(accepted.kind!=='accepted')fail()
      context=accepted.context;commands=accepted.commands
      if(index===1) {
        if(!bridge||bridge.schemaVersion!==2||bridge.result.kind!=='prepared')fail()
        values=bridge.result.values
      } else values=accepted.values
    }
    return freezeMvuSchemaStoryData(validateSchemaEvaluationInputV2({schemaVersion:2,
      encoding:'native-mvu-author-schema-phase-input-v2',commandsEncoding:'native-mvu-update-operations-v2',
      errorPolicy:'atomic-refusal',phase:MVU_SCHEMA_STORY_PHASES[index]!,base:plan.base.values,
      values,commands,context,clockEpochMs:plan.clockEpochMs,randomSeed:plan.randomSeed}))
  }
  let values=plan.base.values,commands:readonly MvuJsonObject[]=[],context=plan.base.context
  if(index===0)commands=plan.candidate.kind==='parsed'?plan.candidate.operations as unknown as readonly MvuJsonObject[]:[]
  else {
    const previous=phases[index-1]!.output
    if('schemaVersion' in previous)fail()
    if(previous.kind!=='accepted')fail()
    context=previous.context
    if(index===1) {
      if(!bridge||bridge.schemaVersion!==1||bridge.result.kind!=='prepared')fail()
      values=bridge.result.values;commands=previous.commands
    } else {values=previous.values;commands=previous.commands}
  }
  return freezeMvuSchemaStoryData({schemaVersion:1,phase:MVU_SCHEMA_STORY_PHASES[index]!,base:plan.base.values,
    values,commands,context,clockEpochMs:plan.clockEpochMs,randomSeed:plan.randomSeed})
}
export function mvuSchemaStoryReducerBridge(first:MvuSchemaStoryPhaseFact):MvuSchemaStoryReducerBridge {
  if(first.phase!=='command-parsed'||first.output.kind!=='accepted')fail()
  if(first.input.schemaVersion===4) {
    const input=validateSchemaEvaluationInputV4(first.input)
    if(input.phase!=='command-parsed')fail()
    const output=validateSchemaGuestOutputV4(first.output,input)
    if(output.kind!=='accepted')fail()
    // Actual v4 plan/output correlation is proved by the execution owner and
    // Native journal. The pure bridge consumes no operation a second time.
    return sealMvuSchemaStoryFact({schemaVersion:2 as const,encoding:'native-mvu-schema-story-reducer-bridge-v2' as const,
      phaseOutputSha256:recordSha256(first.output),result:reduceMvuUpdateOperationsV2(output.values,[])},'bridgeSha256')
  }
  if(first.input.schemaVersion===3) {
    const input=validateSchemaEvaluationInputV3(first.input)
    if(input.phase!=='command-parsed')fail()
    const output=validateSchemaGuestOutputV3(first.output,input)
    if(output.kind!=='accepted')fail()
    // V3 keeps the normalized-update-v2 reducer ABI; published scope reads do
    // not reintroduce residual command or candidate-overlay authority.
    return sealMvuSchemaStoryFact({schemaVersion:2 as const,encoding:'native-mvu-schema-story-reducer-bridge-v2' as const,
      phaseOutputSha256:recordSha256(first.output),result:reduceMvuUpdateOperationsV2(output.values,[])},'bridgeSha256')
  }
  if(first.input.schemaVersion===2) {
    const input=validateSchemaEvaluationInputV2(first.input)
    if(input.phase!=='command-parsed')fail()
    const output=validateSchemaGuestOutputV2(first.output,input)
    if(output.kind!=='accepted')fail()
    // Every v2 command was consumed by a schema registration. Empty reduction
    // records its deterministic basis/hash without creating a bypass path.
    return sealMvuSchemaStoryFact({schemaVersion:2 as const,encoding:'native-mvu-schema-story-reducer-bridge-v2' as const,
      phaseOutputSha256:recordSha256(first.output),result:reduceMvuUpdateOperationsV2(output.values,[])},'bridgeSha256')
  }
  if('schemaVersion' in first.output)fail()
  return sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-mvu-schema-story-reducer-bridge-v1' as const,
    phaseOutputSha256:recordSha256(first.output),result:reduceMvuUpdateOperations(first.output.values,first.output.commands)},'bridgeSha256')
}
function association(value:SchemaExecutionAssociation,plan:MvuSchemaStoryPlan,index:number) {
  exact(value,['schemaVersion','encoding','sessionId','realmEpoch','batchId','anchor','sourceNativeCutSha256',
    'programSha256','dispatch','completion','dispatchMarker','completionMarker','tailSha256','frontierSha256','outputSha256'])
  const selector=plan.selectors[index]!
  if(value.schemaVersion!==1||value.encoding!=='native-mvu-schema-execution-association-v1'
    ||value.sessionId!==selector.sessionId||value.realmEpoch!==plan.realmEpoch||value.programSha256!==plan.programSha256
    ||value.batchId!==selector.batchId||!same(value.anchor,selector.anchor)
    ||![value.sourceNativeCutSha256,value.tailSha256,value.frontierSha256,value.outputSha256].every(hash))fail()
  for(const ref of [value.dispatch,value.completion]) {
    exact(ref,['key','sha256']);if(!id(ref.key,512)||!hash(ref.sha256))fail()
  }
  for(const marker of [value.dispatchMarker,value.completionMarker]) {
    exact(marker,['seq','sha256']);if(!integer(marker.seq)||!hash(marker.sha256))fail()
  }
  if(value.completionMarker.seq!==value.dispatchMarker.seq+1)fail()
}
export function mvuSchemaStoryEvent(plan:MvuSchemaStoryPlan,phases:readonly MvuSchemaStoryPhaseFact[],
  reducer:MvuSchemaStoryReducerBridge|null):MvuSchemaStoryEventV2 {
  if(!phases.length)fail()
  const last=phases.at(-1)!,refused=last.output.kind==='refused'||reducer?.result.kind==='rejected'
  if(!refused&&phases.length!==3)fail()
  const values=refused?plan.base.values:last.output.kind==='accepted'?last.output.values:plan.base.values
  const context=refused?plan.base.context:last.output.kind==='accepted'?last.output.context:plan.base.context
  const valuesSha256=recordSha256(values),outcome=refused?'refused':valuesSha256===plan.base.valuesSha256?'no-update':'accepted'
  return sealMvuSchemaStoryFact({schemaVersion:2 as const,encoding:'native-mvu-schema-story-event-v2' as const,
    sessionId:plan.base.sessionId,sourceSha256:plan.base.sourceSha256,
    eventId:recordSha256({encoding:'native-mvu-schema-story-event-identity-v2',planSha256:plan.planSha256}),
    plan,phases,reducer,outcome,refusal:refused?(last.output.kind==='refused'?'guest' as const:'reducer' as const):null,
    values,valuesSha256,context,frontier:{nativeCut:last.association.completionMarker.seq+1,
      tailSha256:last.association.tailSha256,frontierSha256:last.association.frontierSha256}},'eventSha256')
}
const validateStoryEventDescriptor=createImmutableDescriptorValidator(validateStoryEventUncached)
export function validateMvuSchemaStoryEvent(input:MvuSchemaStoryEventV2):MvuSchemaStoryEventV2 {
  // Settlement rechecks the exact successful immutable event from eventRows.
  // Only pure DATA parsing is reused; current Native/Source/history checks
  // remain with the consumer and settlement still checks its event argument.
  return validateStoryEventDescriptor(input)
}
function validateStoryEventUncached(input:MvuSchemaStoryEventV2):MvuSchemaStoryEventV2 {
  const event=freezeMvuSchemaStoryData(input),plan=validateMvuSchemaStoryPlan(event.plan)
  exact(event,['schemaVersion','encoding','sessionId','sourceSha256','eventId','plan','phases','reducer',
    'outcome','refusal','values','valuesSha256','context','frontier','eventSha256'])
  fact(event,'eventSha256')
  if(!Array.isArray(event.phases)||!event.phases.length||event.phases.length>3||plan.candidate.kind==='rejected')fail()
  let nextSeq=plan.initialCut.nativeCut
  for(const [index,phase] of event.phases.entries()) {
    exact(phase,['phase','input','association','output'])
    let read:MvuScopeReadFrameV1|undefined
    if(plan.schemaVersion===4||plan.schemaVersion===5) {
      const input=plan.schemaVersion===5?validateSchemaEvaluationInputV4(phase.input):validateSchemaEvaluationInputV3(phase.input)
      if(input.schemaVersion===4)validateSchemaGuestOutputV4(phase.output,input)
      else validateSchemaGuestOutputV3(phase.output,input)
      read=input.scopeReadFrame
      if(!schemaScopeReadFactsEqual(read,plan.scopeReadFrame)
        ||read.sourceNativeCutSha256!==phase.association.sourceNativeCutSha256)fail()
    }
    else if(plan.schemaVersion===3)validateSchemaGuestOutputV2(phase.output,validateSchemaEvaluationInputV2(phase.input))
    else output(phase.output)
    association(phase.association,plan,index)
    if(phase.phase!==MVU_SCHEMA_STORY_PHASES[index]||phase.association.dispatchMarker.seq!==nextSeq
      ||phase.association.outputSha256!==recordSha256(phase.output)
      ||!same(phase.input,mvuSchemaStoryPhaseInput(plan,index,event.phases,event.reducer,read))
      ||phase.output.kind==='refused'&&index!==event.phases.length-1)fail()
    if(index===0&&phase.association.sourceNativeCutSha256!==recordSha256(plan.initialCut))fail()
    nextSeq=phase.association.completionMarker.seq+1
  }
  const first=event.phases[0]!
  if(first.output.kind==='accepted') {
    if(!same(event.reducer,mvuSchemaStoryReducerBridge(first)))fail()
    if(event.reducer!.result.kind==='rejected'&&event.phases.length!==1)fail()
  } else if(event.reducer!==null||event.phases.length!==1)fail()
  if(!same(event,mvuSchemaStoryEvent(plan,event.phases,event.reducer)))fail()
  return event
}
export function mvuSchemaStoryHead(event:MvuSchemaStoryEventV2):MvuSchemaNumericalHead {
  if(event.outcome!=='accepted')return event.plan.base.currentHead
  return freezeMvuSchemaStoryData({schemaVersion:2,encoding:'native-mvu-schema-story-head-v2',
    sessionId:event.sessionId,sourceSha256:event.sourceSha256,root:event.plan.base.root,
    revision:event.plan.base.revision+1,eventId:event.eventId,eventSha256:event.eventSha256,
    planSha256:event.plan.planSha256,valuesSha256:event.valuesSha256})
}
export function mvuSchemaStorySettlement(event:MvuSchemaStoryEventV2):MvuSchemaStorySettlementV2 {
  const head=mvuSchemaStoryHead(event)
  return sealMvuSchemaStoryFact({schemaVersion:2 as const,encoding:'native-mvu-schema-story-settlement-v2' as const,
    sessionId:event.sessionId,sourceSha256:event.sourceSha256,planSha256:event.plan.planSha256,
    completedReceiptSha256:recordSha256(event.plan.scope.receipt),outcome:event.outcome,
    event:{key:mvuSchemaStoryEventKey(event.sessionId,event.eventId),sha256:event.eventSha256},
    result:{head,headSha256:recordSha256(head),revision:head.revision,valuesSha256:event.valuesSha256,
      contextSha256:recordSha256(event.context),frontier:event.frontier}},'settlementSha256')
}
export function validateMvuSchemaStorySettlement(input:MvuSchemaStorySettlementV2,event:MvuSchemaStoryEventV2):MvuSchemaStorySettlementV2 {
  const value=freezeMvuSchemaStoryData(input)
  fact(value,'settlementSha256')
  if(!same(value,mvuSchemaStorySettlement(validateMvuSchemaStoryEvent(event))))fail()
  return value
}
