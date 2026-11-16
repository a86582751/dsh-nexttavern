/** Versioned schema story facts. These validators prove bounded integrity,
 * never Native history, Source currency or private execution permission. */
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneSchemaValues} from './tavern-mvu-schema-data.js'
import {freezeImmutableSchemaDescriptorDataV4,createImmutableDescriptorValidator} from './roleplay-mvu-schema-descriptor-data.js'
import {validateMvuSchemaOpeningHead} from './roleplay-mvu-schema-opening-types.js'

import type {AuthorNativeMvuHookRequest,AuthorNativeMvuContextWritesV1,AuthorNativeMvuCommandInfo}
  from './author-native-mvu-hook-types.js'
import {assertMvu196CommandsV1} from './tavern-mvu-update-protocol-v1.js'
import type {Mvu196HookStage,Mvu196UpdateInputV1,Mvu196MacroProjectionV1} from './tavern-mvu-update-protocol-v1.js'
import type {NumericalOrdinaryPublicationV1} from './roleplay-mvu-ordinary-scope-bases.js'
import type {MvuBrowserHookFact} from './roleplay-mvu-browser-hook.js'
import {validateMvuSchemaMaintenanceCandidateSourceV1}
  from './roleplay-mvu-schema-maintenance-types.js'
import type {MvuSchemaMaintenanceCandidateSourceV1} from './roleplay-mvu-schema-maintenance-types.js'
import type {MvuSchemaStoryStartV1} from './roleplay-mvu-schema-story-start.js'
import {validateSchemaTaskArtifactV1} from './roleplay-mvu-schema-task-edit-types.js'
import type {SchemaTaskRevisionSelectionV1} from './roleplay-mvu-schema-task-edit-types.js'
import {validateSchemaEvaluationInputV4,validateSchemaGuestOutputV4} from './tavern-mvu-schema-runner-v4.js'
import {validateMvuScopeReadFrameV1} from './tavern-mvu-scope-read.js'
import {validateMvuScopeReadRefV2} from './tavern-mvu-scope-view-v2.js'
import type {MvuScopeReadRefV2} from './tavern-mvu-scope-view-v2.js'
import {schemaScopeReadFactsEqual} from './roleplay-mvu-schema-scope-facts.js'
import {validateSchemaSourceCut,validateSchemaAnchor,validateSchemaJournalRecord} from './roleplay-mvu-schema-journal.js'
import {validateSchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import {schemaExecutionServerTailSha256,schemaExecutionHostFrontierSha256} from './roleplay-mvu-schema-replay.js'
import type {InputCompletionScope} from './roleplay-input-completion.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'

import type {MvuSchemaOpeningHeadV2} from './roleplay-mvu-schema-opening-types.js'
import type {SchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import type {SchemaExecutionAssociation,SchemaExecutionSelector,SchemaExecutionResult,SourceNativeCutFacts}
  from './roleplay-mvu-schema-replay.js'
import type {SchemaGuestOutput,SchemaEvaluationInput} from './roleplay-mvu-schema-executor-types.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {SchemaJournalRef} from './roleplay-mvu-schema-journal.js'
import type {MvuSchemaPhaseErrorPolicyV4} from './tavern-mvu-schema-types-v4.js'
import type {MvuSchemaHistoryBasisRef,MvuSchemaFrozenPrefixV1} from './roleplay-mvu-schema-derived-types.js'
import type {MvuSchemaPrefixInputClosure} from './roleplay-mvu-schema-frozen-prefix-input.js'

export type MvuSchemaStoryPhase='update-core'
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
  activation?:{
    schemaVersion:1
    encoding:'native-opening-variant-activation-root-v1'
    sessionId:string
    eventId:string
    eventSha256:string
    headSha256:string
    packetSha256:string
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
export interface MvuSchemaOpeningVariantHeadV1 extends Omit<MvuSchemaStoryHeadV2,'schemaVersion'|'encoding'> {
  schemaVersion:1
  encoding:'native-mvu-opening-variant-head-v1'
}
export interface MvuSchemaOpeningActivationHeadV1 {
  schemaVersion:1
  encoding:'native-opening-variant-activation-head-v1'
  sessionId:string
  sourceSha256:string
  revision:1
  eventId:string
  eventSha256:string
  planSha256:string
  valuesSha256:string
}
export interface MvuSchemaPlayerRevisionHeadV1 extends Omit<MvuSchemaStoryHeadV2,'schemaVersion'|'encoding'> {
  schemaVersion:1
  encoding:'native-mvu-schema-player-revision-head-v1'
}
export interface MvuSchemaStoryRevisionHeadV2 extends Omit<MvuSchemaStoryHeadV2,'encoding'> {
  encoding:'native-mvu-schema-story-revision-head-v2'
}
export type MvuSchemaStoryRevisionHead=MvuSchemaStoryRevisionHeadV2
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
export type MvuSchemaNumericalHead=MvuSchemaOpeningHeadV2|MvuSchemaStoryHeadV2|MvuSchemaPlayerHeadV1
  |MvuSchemaDerivedHeadV1|MvuSchemaStoryRevisionHead|MvuSchemaPlayerRevisionHeadV1|MvuSchemaOpeningVariantHeadV1
  |MvuSchemaOpeningActivationHeadV1
export const isMvuSchemaGenesisHead=(head:MvuSchemaNumericalHead)=>head.encoding==='mvu-schema-opening-head-v3'
  ||head.encoding==='native-mvu-schema-derived-head-v1'||head.encoding==='native-opening-variant-activation-head-v1'
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
/** The pinned updater parses the original text inside its owned continuation. */
export interface MvuSchemaStoryPlanV13 {
  schemaVersion:13
  encoding:'native-mvu-196-story-plan-v1'
  executorVersion:4
  scope:InputCompletionScope
  canonical:MvuSchemaStoryCanonical
  base:MvuSchemaNumericalSnapshotV2
  candidate:{schemaVersion:1;kind:'mvu-196'}
  currentFrame:SchemaStorySourceFrame
  realmEpoch:string
  programSha256:string
  initialCut:SourceNativeCutFacts
  clockEpochMs:number
  randomSeed:string
  selectors:readonly SchemaExecutionSelector[]
  planSha256:string
  epoch:SchemaJournalRef
  serverProgramSha256:string
  scopeReadRef:MvuScopeReadRefV2
  scopeReadFrame?:never
  errorPolicy?:Exclude<MvuSchemaPhaseErrorPolicyV4,'atomic-refusal'>
  maintenance?:MvuSchemaMaintenanceCandidateSourceV1
  executionStart?:SchemaJournalRef
}
/** Completed input facts retain their original scope. The current accepted
 * revision owns the new Source, base and Native append position. */
export interface MvuSchemaStoryRevisionPlanV14 extends Omit<MvuSchemaStoryPlanV13,
  'schemaVersion'|'encoding'|'scopeReadRef'|'scopeReadFrame'|'maintenance'|'executionStart'> {
  schemaVersion:14
  encoding:'native-mvu-196-story-revision-plan-v1'
  scopeReadFrame:MvuScopeReadFrameV1
  scopeReadRef?:never
  revision:{descriptor:SchemaJournalRef;index:number;publicationRevision:number}
  execution:{sessionId:string;sourceSha256:string;root:MvuSchemaStoryRoot}
  logicalNativeCut:number
  ordinaryScopes?:NumericalOrdinaryPublicationV1
  taskEdit?:SchemaTaskRevisionSelectionV1
  /** Retain/clear selects saved DATA. Replace keeps this updater's parsed commands. */
  taskCommands?:readonly AuthorNativeMvuCommandInfo[]
}
export type MvuSchemaStoryRevisionPlan=MvuSchemaStoryRevisionPlanV14
export interface MvuSchemaStoryRevisionEdit {
  seq:number
  sha256:string
  targetSeq:number
  messageId:string
  messageVersionSha256:string
  narrativeSha256:string
}
export interface MvuSchemaStoryRevisionBasisV1 {
  schemaVersion:1
  encoding:'native-mvu-schema-revision-basis-v1'
  sessionId:string
  historyBasis:MvuSchemaHistoryBasisRef|null
  closedRevision:SchemaJournalRef|null
  prefix:MvuSchemaFrozenPrefixV1
  closure:MvuSchemaPrefixInputClosure
  basisSha256:string
}
export interface MvuSchemaStoryRevisionDescriptorV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-story-revision-descriptor-v2'
  sessionId:string
  edits:readonly MvuSchemaStoryRevisionEdit[]
  basis:{record:SchemaJournalRef;nativeCut:number;historyBasis:MvuSchemaHistoryBasisRef|null;closedRevision:SchemaJournalRef|null;
    prefixSha256:string;stateSnapshotSha256:string}
  originals:readonly SchemaJournalRef[]
  previous:SchemaJournalRef|null
  completionSeq:number
  publicationRevision:number
  sourceSha256:string
  descriptorSha256:string
}
export interface MvuSchemaStoryRevisionDescriptorV3 extends Omit<MvuSchemaStoryRevisionDescriptorV2,
  'schemaVersion'|'encoding'|'originals'> {
  schemaVersion:3
  encoding:'native-mvu-schema-story-revision-descriptor-v3'
  originals:readonly {kind:'story'|'manual';event:SchemaJournalRef}[]
}
export interface MvuSchemaStoryRevisionDescriptorV4 extends Omit<MvuSchemaStoryRevisionDescriptorV3,
  'schemaVersion'|'encoding'|'edits'> {
  schemaVersion:4
  encoding:'native-mvu-schema-story-revision-descriptor-v4'
  edits:readonly (MvuSchemaStoryRevisionEdit&{role:'user'|'assistant'})[]
  taskEdits:readonly {index:number;selection:SchemaTaskRevisionSelectionV1}[]
}
export interface MvuSchemaStoryUserEditAuthorization {
  edit:{seq:number;sha256:string}
  proof:{kind:'intent';intent:SchemaJournalRef;binding:SchemaJournalRef}
    |{kind:'completed-v4';descriptor:SchemaJournalRef;completion:SchemaJournalRef}
    |{kind:'post-commit-recovery';intent:SchemaJournalRef}
}
export interface MvuSchemaStoryRevisionDescriptorV5 extends Omit<MvuSchemaStoryRevisionDescriptorV3,
  'schemaVersion'|'encoding'|'edits'> {
  schemaVersion:5
  encoding:'native-mvu-schema-story-revision-descriptor-v5'
  edits:readonly (MvuSchemaStoryRevisionEdit&{role:'user'|'assistant'})[]
  authorizations:readonly MvuSchemaStoryUserEditAuthorization[]
}
export type MvuSchemaStoryRevisionDescriptor=MvuSchemaStoryRevisionDescriptorV2
  |MvuSchemaStoryRevisionDescriptorV3|MvuSchemaStoryRevisionDescriptorV4|MvuSchemaStoryRevisionDescriptorV5
export interface MvuSchemaStoryRevisionCompletionV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-story-revision-completion-v2'
  sessionId:string
  descriptor:SchemaJournalRef
  events:readonly SchemaJournalRef[]
  completionSha256:string
}
export interface MvuSchemaStoryRevisionCompletionV3 extends Omit<MvuSchemaStoryRevisionCompletionV2,
  'schemaVersion'|'encoding'> {
  schemaVersion:3
  encoding:'native-mvu-schema-story-revision-completion-v3'
}
export interface MvuSchemaStoryRevisionCompletionV4 extends Omit<MvuSchemaStoryRevisionCompletionV2,'schemaVersion'|'encoding'> {
  schemaVersion:4
  encoding:'native-mvu-schema-story-revision-completion-v4'
}
export interface MvuSchemaStoryRevisionCompletionV5 extends Omit<MvuSchemaStoryRevisionCompletionV2,'schemaVersion'|'encoding'> {
  schemaVersion:5
  encoding:'native-mvu-schema-story-revision-completion-v5'
}
export type MvuSchemaStoryRevisionCompletion=MvuSchemaStoryRevisionCompletionV2|MvuSchemaStoryRevisionCompletionV3
  |MvuSchemaStoryRevisionCompletionV4|MvuSchemaStoryRevisionCompletionV5
export type MvuSchemaStoryPlan=MvuSchemaStoryPlanV13|MvuSchemaStoryRevisionPlanV14
export function schemaStoryMaintenanceSource(plan:MvuSchemaStoryPlan):MvuSchemaMaintenanceCandidateSourceV1|undefined {
  return plan.schemaVersion===13?plan.maintenance:undefined
}
export interface MvuSchemaStoryPhaseFact {
  phase:MvuSchemaStoryPhase
  input:SchemaEvaluationInput
  association:SchemaExecutionAssociation
  output:SchemaGuestOutput
}
export type MvuSchemaStoryBrowserHookFact=MvuBrowserHookFact
export interface MvuSchemaStoryBrowserExecutionV1 {
  schemaVersion:1
  hooks:readonly MvuSchemaStoryBrowserHookFact[]
  finalizedMessage:string
}

export interface MvuSchemaStoryEventV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-story-event-v2'
  sessionId:string
  sourceSha256:string
  eventId:string
  plan:MvuSchemaStoryPlanV13
  phases:readonly MvuSchemaStoryPhaseFact[]
  outcome:'accepted'|'refused'|'no-update'
  refusal:'guest'|null
  values:MvuJsonObject
  valuesSha256:string
  context:MvuJsonObject
  frontier:MvuSchemaStoryFrontier
  eventSha256:string
  browser?:MvuSchemaStoryBrowserExecutionV1
  ordinaryScopes?:NumericalOrdinaryPublicationV1
}
export interface MvuSchemaStoryRevisionEventV2 extends Omit<MvuSchemaStoryEventV2,'encoding'|'plan'> {
  encoding:'native-mvu-schema-story-revision-event-v2'
  plan:MvuSchemaStoryRevisionPlanV14
}
export type MvuSchemaStoryRevisionEvent=MvuSchemaStoryRevisionEventV2
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
/** Process-private execution keeps the actual live evidence object. Persisted
 * phase and hook DATA never recreate this state or its execution rights. */
export interface Mvu196StoryExecutionState {
  phases:MvuSchemaStoryPhaseFact[]
  hooks:MvuSchemaStoryBrowserHookFact[]
  lastLive?:MvuSchemaStoryLive
  finalizedMessage:string
}
export interface MvuSchemaStoryPublicationBoundary {
  plan:MvuSchemaStoryPlanV13
  event:MvuSchemaStoryEventV2
  head:MvuSchemaNumericalHead
  settlement:MvuSchemaStorySettlementV2
  stage:'before-event'|'after-event'|'before-head'|'after-head'|'before-settlement'|'after-settlement'
}
export interface MvuSchemaStoryDeps {
  table:{get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>}
  /** DATA only; publish checks closingCurrent immediately before each read. */
  readReady(scope:InputCompletionScope,plan:MvuSchemaStoryPlanV13):
    {kind:'ready';snapshot:MvuSchemaNumericalSnapshotV2}|{kind:'blocked';code:string}
  closingCurrent(closing:object,scope:InputCompletionScope,plan:MvuSchemaStoryPlanV13):boolean
  executePhase(plan:MvuSchemaStoryPlanV13,phase:MvuSchemaStoryPhase,input:SchemaEvaluationInput,
    closing:object):Promise<SchemaExecutionResult>
  readHookInterests?(plan:MvuSchemaStoryPlanV13,closing:object):readonly Mvu196HookStage[]
  executeHook?(plan:MvuSchemaStoryPlanV13,request:AuthorNativeMvuHookRequest,closing:object):
    Promise<MvuSchemaStoryBrowserHookFact|undefined>
  existingExecution?(plan:MvuSchemaStoryPlanV13,closing:object):Mvu196StoryExecutionState|undefined
  withPublicationBoundary<T>(closing:object,lastLive:MvuSchemaStoryLive,action:()=>Promise<T>):Promise<T>
  captureOrdinaryPublication?(closing:object,plan:MvuSchemaStoryPlanV13,writes:AuthorNativeMvuContextWritesV1):
    NumericalOrdinaryPublicationV1|undefined
  /** Root checks the final hot evidence, all actual journal pins, every phase
   * input/output under its real Source boundary. */
  checkPublication(closing:object,lastLive:MvuSchemaStoryLive,boundary:MvuSchemaStoryPublicationBoundary):boolean
}
export type MvuSchemaStoryPublication={kind:'acknowledged';settlement:MvuSchemaStorySettlementV2}
  |{kind:'blocked'|'unknown';code:string}

export const MVU_SCHEMA_STORY_BOUNDS=Object.freeze({bytes:16777216,depth:66,nodes:131072,narrativeBytes:1048576})
export function freezeMvuSchemaStoryData<T>(input:T):T {
  return freezeImmutableSchemaDescriptorDataV4(input,MVU_SCHEMA_STORY_BOUNDS.bytes,
    {depth:MVU_SCHEMA_STORY_BOUNDS.depth,nodes:MVU_SCHEMA_STORY_BOUNDS.nodes})
}
// Journal inventory deliberately rejects non-journal rows in its namespace.
// Numerical publication facts therefore stay under the state namespace.
export const mvuSchemaStoryEventKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-story-event-${id}`
export const mvuSchemaStorySettlementKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-story-settlement-${id}`
export const mvuSchemaStoryRevisionDescriptorKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-revision-descriptor-${id}`
export const mvuSchemaStoryRevisionBasisKey=(sid:string,basisSha:string)=>`${sid}__mvu-state-schema-revision-basis-${basisSha}`
export const mvuSchemaStoryRevisionPlanKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-revision-plan-${id}`
export const mvuSchemaStoryRevisionEventKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-revision-event-${id}`
export const mvuSchemaStoryRevisionCompletionKey=(sid:string,descriptorSha:string)=>
  `${sid}__mvu-state-schema-revision-completion-${descriptorSha}`
export const schemaStoryCode=(value:unknown):string=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(value)
  ?value:'SCHEMA_STORY_UNKNOWN'

/** Browser DATA uses the upstream envelope. Native alone owns stat_data's
 * numerical writer; the remaining keys retain the existing metadata context. */
export function mvuSchemaStoryVariables(values:MvuJsonObject,context:MvuJsonObject):MvuJsonObject {
  return {...context,stat_data:values}
}
export function mvuSchemaStoryVariableParts(variables:MvuJsonObject) {
  const {stat_data,...context}=cloneSchemaValues(variables)
  if(!stat_data||typeof stat_data!=='object'||Array.isArray(stat_data))fail()
  return {values:cloneSchemaValues(stat_data),context}
}
export function mvuSchemaStoryExecutionPhases<T extends {phases:readonly {association:SchemaExecutionAssociation}[]}>(event:T):T['phases'] {
  return event.phases
}
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
  exact(value,keys,['derived','activation'])
  if(!keys.every(key=>hash(value[key as keyof MvuSchemaStoryRoot])))fail()
  if(value.derived!==undefined) {
    const derived=value.derived
    exact(derived,['schemaVersion','encoding','eventId','eventSha256','headSha256','basisSha256'])
    if(derived.schemaVersion!==1||derived.encoding!=='native-mvu-schema-derived-root-v1'
      ||![derived.eventId,derived.eventSha256,derived.headSha256,derived.basisSha256].every(hash))fail()
  }
  if(value.activation!==undefined) {
    const activation=value.activation
    exact(activation,['schemaVersion','encoding','sessionId','eventId','eventSha256','headSha256','packetSha256'])
    if(activation.schemaVersion!==1||activation.encoding!=='native-opening-variant-activation-root-v1'
      ||!id(activation.sessionId,64)
      ||![activation.eventId,activation.eventSha256,activation.headSha256,activation.packetSha256].every(hash))fail()
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
  if(head.encoding==='mvu-schema-opening-head-v3')return validateMvuSchemaOpeningHead(head)
  if(head.encoding==='native-opening-variant-activation-head-v1') {
    exact(head,['schemaVersion','encoding','sessionId','sourceSha256','revision','eventId','eventSha256',
      'planSha256','valuesSha256'])
    if(head.schemaVersion!==1||!id(head.sessionId,64)||head.revision!==1
      ||![head.sourceSha256,head.eventId,head.eventSha256,head.planSha256,head.valuesSha256].every(hash))fail()
    return head
  }
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
  if(!(head.schemaVersion===2&&(head.encoding==='native-mvu-schema-story-head-v2'
      ||head.encoding==='native-mvu-schema-story-revision-head-v2')
    ||head.schemaVersion===1&&(head.encoding==='native-mvu-schema-player-head-v1'
       ||head.encoding==='native-mvu-schema-player-revision-head-v1'
       ||head.encoding==='native-mvu-opening-variant-head-v1'))||!id(head.sessionId,64)
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
  if(head.encoding==='mvu-schema-opening-head-v3') {
    if(value.root.derived||head.eventId!==value.root.openingEventId||head.eventSha256!==value.root.openingEventSha256
      ||recordSha256(head)!==value.root.openingHeadSha256||head.planSha256!==value.root.openingPlanSha256)fail()
  } else if(head.encoding==='native-opening-variant-activation-head-v1') {
    const activation=value.root.activation
    if(!activation||activation.eventId!==head.eventId||activation.eventSha256!==head.eventSha256
      ||activation.headSha256!==recordSha256(head)||activation.packetSha256!==head.planSha256)fail()
  } else if(head.encoding==='native-mvu-schema-derived-head-v1') {
    const derived=value.root.derived
    if(!derived||derived.eventId!==head.eventId||derived.eventSha256!==head.eventSha256
      ||derived.headSha256!==recordSha256(head)||derived.basisSha256!==head.basisSha256)fail()
  } else if(!same(head.root,value.root))fail()
  return value
}
export function deriveMvuSchemaStorySelectors(scope:InputCompletionScope,canonical:MvuSchemaStoryCanonical,
  realmEpoch:string):readonly SchemaExecutionSelector[] {
  const anchor={kind:'story' as const,preparationId:scope.currency.preparationId,
    attemptGeneration:scope.currency.attemptGeneration,receiptGeneration:scope.currency.receiptGeneration,
    turn:scope.receipt.checkpoint.actualTurn,canonicalSeq:canonical.seq,messageId:canonical.messageId,
    messageVersionSha256:canonical.versionSha256}
  validateSchemaAnchor(anchor)
  const digest=recordSha256({scope,canonical,realmEpoch})
  return freezeMvuSchemaStoryData([{sessionId:scope.receipt.checkpoint.sessionId,batchId:`story-${digest}-1`,anchor}])
}
export function deriveMvuSchemaStoryRevisionSelectorsV2(scope:InputCompletionScope,canonical:MvuSchemaStoryCanonical,
  realmEpoch:string,descriptor:SchemaJournalRef,index:number,sessionId:string):readonly SchemaExecutionSelector[] {
  const anchor={kind:'story' as const,preparationId:scope.currency.preparationId,
    attemptGeneration:scope.currency.attemptGeneration,receiptGeneration:scope.currency.receiptGeneration,
    turn:scope.receipt.checkpoint.actualTurn,canonicalSeq:canonical.seq,messageId:canonical.messageId,
    messageVersionSha256:canonical.versionSha256}
  validateSchemaAnchor(anchor)
  return freezeMvuSchemaStoryData([{sessionId,batchId:`revision2-${descriptor.sha256}-${index+1}-1`,anchor}])
}
export function mvuSchemaStoryExecutionId(plan:MvuSchemaStoryPlan|MvuSchemaStoryStartV1):string {
  return 'startSha256' in plan?plan.startSha256:plan.schemaVersion===13&&plan.executionStart
    ?plan.executionStart.sha256:plan.planSha256
}
export function mvuSchemaStorySelector(plan:MvuSchemaStoryPlan|MvuSchemaStoryStartV1,stepOrdinal:number):SchemaExecutionSelector {
  if(!integer(stepOrdinal))fail()
  const first=plan.selectors[0]!
  return {...first,batchId:first.batchId.replace(/-1$/,`-${stepOrdinal+1}`)}
}
export function mvuSchemaStoryUpdateInput(plan:MvuSchemaStoryPlanV13|MvuSchemaStoryRevisionPlanV14|MvuSchemaStoryStartV1,index:number,
  phases:readonly MvuSchemaStoryPhaseFact[],browser:MvuSchemaStoryBrowserExecutionV1|undefined,
  interests:readonly Mvu196HookStage[],acceptedHook?:MvuSchemaStoryBrowserHookFact,
  macros?:Mvu196MacroProjectionV1):Mvu196UpdateInputV1 {
  const updateId=mvuSchemaStoryExecutionId(plan)
  if(index===0)return {schemaVersion:1,encoding:'native-mvu-196-update-start-v1',updateId,
    message:plan.canonical.narrative,interests,...macros?{macros}:{},
    ...'startSha256' in plan||plan.schemaVersion===13&&plan.executionStart
      ||plan.schemaVersion===14&&plan.taskEdit!==undefined?{maintenance:true as const}:{}}
  const previous=phases[index-1]?.output
  if(previous?.kind!=='accepted'||!('update' in previous)||!previous.update||previous.update.kind==='complete')fail()
  if(previous.update.kind==='native-commands-ready') {
    let commands:readonly AuthorNativeMvuCommandInfo[]
    if(plan.schemaVersion===14) {
      if(!plan.taskEdit)fail()
      if(plan.taskEdit.mode==='replace')commands=previous.update.commands
      else {
        if(plan.taskCommands===undefined)fail()
        commands=plan.taskCommands
      }
    }else {
      if(plan.schemaVersion!==13||!plan.maintenance||!plan.executionStart)fail()
      const canonical=previous.update.commands,proposal=plan.maintenance.result.variableCandidate
      commands=canonical.length?canonical:proposal?.kind==='commands'?proposal.commands:[]
    }
    return {schemaVersion:1,encoding:'native-mvu-196-native-resume-v1',updateId,
      yieldOrdinal:previous.update.yieldOrdinal,commands,interests}
  }
  const yielded=previous.update,lastHook=acceptedHook??browser?.hooks.at(-1),
    hook=lastHook?.request.yieldOrdinal===yielded.yieldOrdinal?lastHook:undefined
  if(hook&&(!('graph' in hook.result.output)||!hook.result.output.graph))fail()
  return {schemaVersion:1,encoding:'native-mvu-196-update-resume-v1',updateId,
    yieldOrdinal:yielded.yieldOrdinal,graph:hook&&'graph' in hook.result.output?hook.result.output.graph!:yielded.graph,
    ...hook?.result.contextWrites?{contextWrites:hook.result.contextWrites}:{},interests}
}
export function makeMvu196StoryRevisionPlan(input:Omit<MvuSchemaStoryRevisionPlanV14,
  'schemaVersion'|'encoding'|'candidate'|'selectors'|'planSha256'|'randomSeed'>):MvuSchemaStoryRevisionPlanV14 {
  return validateMvuSchemaStoryPlan(sealMvuSchemaStoryFact({...input,schemaVersion:14 as const,
    encoding:'native-mvu-196-story-revision-plan-v1' as const,candidate:{schemaVersion:1 as const,kind:'mvu-196' as const},
    selectors:deriveMvuSchemaStoryRevisionSelectorsV2(input.scope,input.canonical,input.realmEpoch,
      input.revision.descriptor,input.revision.index,input.execution.sessionId),
    randomSeed:recordSha256({scope:input.scope,canonical:input.canonical,revision:input.revision.descriptor,index:input.revision.index})},'planSha256'))
}
const validateStoryPlanDescriptor=createImmutableDescriptorValidator(validateStoryPlanUncached)
export function validateMvuSchemaStoryPlan<T extends MvuSchemaStoryPlan>(input:T):T {
  return validateStoryPlanDescriptor(input) as T
}
function validateStoryPlanUncached<T extends MvuSchemaStoryPlan>(input:T):T {
  const value=freezeMvuSchemaStoryData(input)
  if(value.schemaVersion===14)return validateStoryRevisionPlan(value) as T
  exact(value,['schemaVersion','encoding','scope','canonical','base','candidate','currentFrame','realmEpoch',
    'programSha256','initialCut','clockEpochMs','randomSeed','selectors','planSha256','executorVersion',
    'scopeReadRef','epoch','serverProgramSha256'],['errorPolicy','maintenance','executionStart'])
  if(value.errorPolicy!==undefined&&value.errorPolicy!=='registered-command-policy-v1'
    &&value.errorPolicy!=='update-batch-atomic-v1')fail()
  fact(value,'planSha256');validateMvuSchemaNumericalSnapshot(value.base)
  validateSchemaStorySourceFrame(value.currentFrame)
  const {scope,canonical,currentFrame:frame}=value,{currency,receipt}=scope
  exact(scope,['currency','receipt','stopGeneration'])
  exact(currency,['schemaVersion','preparationId','credentialSha256','receiptGeneration','attemptGeneration','source','snapshot'])
  exact(currency.snapshot!,['key','sha256'])
  if(currency.source.kind!=='story')fail()
  exact(currency.source,['kind','sourceSha256','headRef']);exact(currency.source.headRef!,['kind','sha256'])
  exact(canonical,['seq','messageId','versionSha256','narrative','narrativeSha256'])
  if(value.schemaVersion!==13||value.encoding!=='native-mvu-196-story-plan-v1'||value.executorVersion!==4
    ||currency.schemaVersion!==2||currency.source.headRef!.kind!=='schema-head'
    ||currency.source.headRef!.sha256!==value.base.stateSnapshotSha256
    ||!id(currency.preparationId)||!hash(currency.credentialSha256)
    ||!integer(currency.receiptGeneration,1)||!integer(currency.attemptGeneration,1)||!integer(scope.stopGeneration)
    ||!id(currency.snapshot!.key,512)||!hash(currency.snapshot!.sha256)
    ||receipt.schemaVersion!==1||receipt.flushed!==true||receipt.checkpoint.sessionId!==value.base.sessionId
    ||receipt.checkpoint.preparation.credentialSha256!==currency.credentialSha256
    ||!integer(receipt.checkpoint.actualTurn,1)||!integer(receipt.turnEndSeq)||!hash(receipt.turnEndSha256)
    ||!integer(canonical.seq)||!id(canonical.messageId)||!hash(canonical.versionSha256)
    ||canonical.seq>=receipt.turnEndSeq||typeof canonical.narrative!=='string'
    ||Buffer.byteLength(canonical.narrative,'utf8')>MVU_SCHEMA_STORY_BOUNDS.narrativeBytes
    ||sha256(canonical.narrative)!==canonical.narrativeSha256
    ||currency.source.sourceSha256!==value.base.sourceSha256||value.realmEpoch!==value.base.root.realmEpoch
    ||value.programSha256!==value.base.root.programSha256||!integer(value.clockEpochMs)
    ||frame.sessionId!==value.base.sessionId||!same(value.candidate,{schemaVersion:1,kind:'mvu-196'}))fail()
  const first=value.selectors[0],ordinary=deriveMvuSchemaStorySelectors(scope,canonical,value.realmEpoch)
  validateSchemaSourceCut(value.initialCut)
  // Running cuts retain Native's Stop sequence. Completion currency carries
  // its owner's independent revocation generation, including refused inputs.
  if(value.initialCut.sessionId!==value.base.sessionId||value.initialCut.ownerSessionId!==value.base.sessionId
    ||value.initialCut.nativeCut<=canonical.seq||value.initialCut.nativeCut<value.base.schemaFrontier.nativeCut
    ||value.initialCut.sourceSnapshotSha256!==frame.snapshotSha256||value.initialCut.materialSha256!==frame.materialSha256
    ||value.selectors.length!==1||!first||first.sessionId!==value.base.sessionId
    ||!same(value.initialCut.anchor,ordinary[0]!.anchor)||!same(first.anchor,value.initialCut.anchor))fail()
  if(value.executionStart) {
    revisionReference(value.executionStart)
    if(!hash(value.randomSeed)||!id(first.batchId,256))fail()
  }else if(value.initialCut.nativeCut<receipt.turnEndSeq+1||!same(value.selectors,ordinary)
    ||value.randomSeed!==recordSha256({scope,canonical}))fail()
  revisionReference(value.epoch)
  if(!hash(value.serverProgramSha256))fail()
  if(validateMvuScopeReadRefV2(value.scopeReadRef).sourceNativeCutSha256!==recordSha256(value.initialCut))fail()
  if(value.maintenance)validateMvuSchemaMaintenanceCandidateSourceV1(value.maintenance,{scope,canonical,base:value.base})
  return value
}
/** Validated reference DATA may advance its Native cut without changing the
 * frozen message/variable dependency chain selected by a transaction plan. */
export function schemaScopeReadRefFactsEqualV2(left:MvuScopeReadRefV2,right:MvuScopeReadRefV2):boolean {
  return left.baseRef.ownerSessionId===right.baseRef.ownerSessionId&&left.baseRef.key===right.baseRef.key
    &&left.baseRef.sha256===right.baseRef.sha256&&left.tailRef.ownerSessionId===right.tailRef.ownerSessionId
    &&left.tailRef.key===right.tailRef.key&&left.tailRef.sha256===right.tailRef.sha256
}
function validateStoryRevisionPlan(value:MvuSchemaStoryRevisionPlanV14):MvuSchemaStoryRevisionPlanV14 {
  exact(value,['schemaVersion','encoding','scope','canonical','base','candidate','currentFrame','realmEpoch',
    'programSha256','initialCut','clockEpochMs','randomSeed','selectors','planSha256','executorVersion',
    'scopeReadFrame','epoch','serverProgramSha256','revision','execution','logicalNativeCut'],
    ['errorPolicy','ordinaryScopes','taskEdit','taskCommands'])
  if(value.errorPolicy!==undefined&&value.errorPolicy!=='registered-command-policy-v1'
    &&value.errorPolicy!=='update-batch-atomic-v1')fail()
  fact(value,'planSha256');validateMvuSchemaNumericalSnapshot(value.base);validateSchemaStorySourceFrame(value.currentFrame)
  const {scope,canonical,currentFrame:frame,execution,revision}=value,{currency,receipt}=scope
  exact(scope,['currency','receipt','stopGeneration'])
  exact(currency,['schemaVersion','preparationId','credentialSha256','receiptGeneration','attemptGeneration','source','snapshot'])
  exact(currency.snapshot!,['key','sha256'])
  if(currency.source.kind!=='story')fail()
  exact(currency.source,['kind','sourceSha256','headRef']);exact(currency.source.headRef!,['kind','sha256'])
  exact(canonical,['seq','messageId','versionSha256','narrative','narrativeSha256'])
  exact(execution,['sessionId','sourceSha256','root']);exact(revision,['descriptor','index','publicationRevision'])
  revisionReference(revision.descriptor);revisionReference(value.epoch);root(execution.root)
  if(value.schemaVersion!==14||value.encoding!=='native-mvu-196-story-revision-plan-v1'||value.executorVersion!==4
    ||currency.schemaVersion!==2||currency.source.headRef!.kind!=='schema-head'||!hash(currency.source.headRef!.sha256)
    ||!id(currency.preparationId)||!hash(currency.credentialSha256)||!hash(currency.source.sourceSha256)
    ||!integer(currency.receiptGeneration,1)||!integer(currency.attemptGeneration,1)||!integer(scope.stopGeneration)
    ||!id(currency.snapshot!.key,512)||!hash(currency.snapshot!.sha256)
    ||receipt.schemaVersion!==1||receipt.flushed!==true||!id(receipt.checkpoint.sessionId,64)
    ||receipt.checkpoint.preparation.credentialSha256!==currency.credentialSha256
    ||!integer(receipt.checkpoint.actualTurn,1)||!integer(receipt.turnEndSeq)||!hash(receipt.turnEndSha256)
    ||!integer(canonical.seq)||!id(canonical.messageId)||!hash(canonical.versionSha256)
    ||canonical.seq>=receipt.turnEndSeq||typeof canonical.narrative!=='string'
    ||Buffer.byteLength(canonical.narrative,'utf8')>MVU_SCHEMA_STORY_BOUNDS.narrativeBytes
    ||sha256(canonical.narrative)!==canonical.narrativeSha256
    ||!id(execution.sessionId,64)||!hash(execution.sourceSha256)
    ||value.realmEpoch!==value.base.root.realmEpoch||value.programSha256!==value.base.root.programSha256
    ||value.realmEpoch!==execution.root.realmEpoch||value.programSha256!==execution.root.programSha256
    ||!integer(revision.index)||!integer(revision.publicationRevision,2)||!integer(value.logicalNativeCut)
    ||!integer(value.clockEpochMs)||!hash(value.serverProgramSha256)
    ||value.randomSeed!==recordSha256({scope,canonical,revision:revision.descriptor,index:revision.index})
    ||frame.sessionId!==execution.sessionId||!same(value.candidate,{schemaVersion:1,kind:'mvu-196'}))fail()
  validateSchemaSourceCut(value.initialCut)
  if(value.initialCut.sessionId!==execution.sessionId||value.initialCut.ownerSessionId!==execution.sessionId
    ||value.initialCut.nativeCut<receipt.turnEndSeq+1||value.initialCut.nativeCut<value.base.schemaFrontier.nativeCut
    ||value.initialCut.sourceSnapshotSha256!==frame.snapshotSha256||value.initialCut.materialSha256!==frame.materialSha256
    ||!same(value.selectors,deriveMvuSchemaStoryRevisionSelectorsV2(scope,canonical,value.realmEpoch,
      revision.descriptor,revision.index,execution.sessionId))||!same(value.initialCut.anchor,value.selectors[0]!.anchor))fail()
  if(value.taskEdit) {
    const selected=value.taskEdit
    exact(selected,['canonicalSeq','originEventRef','sourceEventRef','effectiveKind','mode','intent','binding'])
    revisionReference(selected.intent);revisionReference(selected.binding);validateSchemaTaskArtifactV1(selected)
    if(selected.canonicalSeq!==canonical.seq||!['retain','replace','clear'].includes(selected.mode)
      ||(selected.mode!=='replace')!==Object.hasOwn(value,'taskCommands'))fail()
  }else if(Object.hasOwn(value,'taskCommands'))fail()
  if(Object.hasOwn(value,'taskCommands')) {
    assertMvu196CommandsV1(value.taskCommands)
    if(value.taskEdit!.mode==='clear'&&value.taskCommands.length)fail()
  }
  const read=validateMvuScopeReadFrameV1(value.scopeReadFrame),source=frame.snapshot.source
  if(read.source.sessionId!==execution.sessionId||read.source.sourceRecordSessionId!==source.sourceRecordSessionId
    ||read.source.importId!==source.importId||read.source.rawSha256!==source.rawSha256
    ||read.source.sourceSnapshotSha256!==frame.snapshotSha256
    ||read.sourceNativeCutSha256!==recordSha256(value.initialCut))fail()
  return value
}
/** Each input continues the one actual updater suspended by the preceding output. */
export function mvuSchemaStoryPhaseInput(plan:MvuSchemaStoryPlan|MvuSchemaStoryStartV1,index:number,
  phases:readonly MvuSchemaStoryPhaseFact[],scopeReadFrame?:MvuScopeReadFrameV1,scopeReadRef?:MvuScopeReadRefV2,
  browser?:MvuSchemaStoryBrowserExecutionV1,interests:readonly Mvu196HookStage[]=[],
  acceptedHook?:MvuSchemaStoryBrowserHookFact,macros?:Mvu196MacroProjectionV1):SchemaEvaluationInput {
  const referenced=plan.schemaVersion!==14,
    reference=referenced?validateMvuScopeReadRefV2(scopeReadRef??plan.scopeReadRef):undefined,
    read=plan.schemaVersion===14?validateMvuScopeReadFrameV1(scopeReadFrame??plan.scopeReadFrame):undefined
  if(phases.length<index||referenced&&(scopeReadFrame||!schemaScopeReadRefFactsEqualV2(reference!,plan.scopeReadRef))
    ||plan.schemaVersion===14&&(scopeReadRef||!schemaScopeReadFactsEqual(read!,plan.scopeReadFrame)))fail()
  const previous=phases[index-1]?.output,accepted=previous?.kind==='accepted'?previous:undefined
  return validateSchemaEvaluationInputV4({schemaVersion:4,...reference
    ?{encoding:'native-mvu-author-schema-phase-input-v4-scope-ref-v2' as const,scopeReadRef:reference}
    :{encoding:'native-mvu-author-schema-phase-input-v4' as const,scopeReadFrame:read!},
    errorPolicy:plan.errorPolicy??'atomic-refusal',phase:'update-core',
    base:plan.base.values,values:accepted?.values??plan.base.values,context:accepted?.context??plan.base.context,
    clockEpochMs:plan.clockEpochMs,randomSeed:plan.randomSeed,
    update:mvuSchemaStoryUpdateInput(plan,index,phases,browser,interests,acceptedHook,macros)})
}
function association(value:SchemaExecutionAssociation,plan:MvuSchemaStoryPlan,index:number) {
  const selector=mvuSchemaStorySelector(plan,index)
  if(value.schemaVersion!==5)fail()
  exact(value,['schemaVersion','encoding','sessionId','realmEpoch','batchId','anchor','sourceNativeCutSha256',
    'combinedProgramSha256','serverProgramSha256','epoch','dispatch','completion','dispatchMarker','completionMarker',
    'serverTailSha256','hostFrontierSha256','outputSha256'])
  if(value.encoding!=='native-author-host-association-v5'||value.sessionId!==selector.sessionId
    ||value.realmEpoch!==plan.realmEpoch||value.combinedProgramSha256!==plan.programSha256
    ||value.serverProgramSha256!==plan.serverProgramSha256||!same(value.epoch,plan.epoch)
    ||value.batchId!==selector.batchId||!same(value.anchor,selector.anchor)
    ||![value.sourceNativeCutSha256,value.serverTailSha256,value.hostFrontierSha256,value.outputSha256].every(hash))fail()
  for(const ref of [value.epoch,value.dispatch,value.completion])revisionReference(ref)
  for(const marker of [value.dispatchMarker,value.completionMarker]) {
    exact(marker,['seq','sha256']);if(!integer(marker.seq)||!hash(marker.sha256))fail()
  }
  if(value.completionMarker.seq!==value.dispatchMarker.seq+1)fail()
}
function browserFinal(plan:MvuSchemaStoryPlan,phases:readonly MvuSchemaStoryPhaseFact[],browser?:MvuSchemaStoryBrowserExecutionV1) {
  const last=mvuSchemaStoryExecutionPhases({phases,browser}).at(-1)!,
    before=browser?.hooks.find(hook=>hook.result.stage==='before-message-update')
  const parts=before?.result.stage==='before-message-update'
    ?mvuSchemaStoryVariableParts(before.result.output.context.variables):undefined
  return {values:parts?.values??(last.output.kind==='accepted'?last.output.values:plan.base.values),
    context:parts?.context??(last.output.kind==='accepted'?last.output.context:plan.base.context),
    frontier:before?.frontier??{nativeCut:last.association.completionMarker.seq+1,
      tailSha256:schemaExecutionServerTailSha256(last.association),
      frontierSha256:schemaExecutionHostFrontierSha256(last.association)}}
}
function validateMvu196StoryExecution(plan:MvuSchemaStoryPlanV13|MvuSchemaStoryRevisionPlanV14,phases:readonly MvuSchemaStoryPhaseFact[],
  browser:MvuSchemaStoryBrowserExecutionV1|undefined):void {
  if(browser){
    exact(browser,['schemaVersion','hooks','finalizedMessage'])
    if(browser.schemaVersion!==1||!Array.isArray(browser.hooks)||!browser.hooks.length)fail()
  }
  let cut=plan.initialCut.nativeCut,hookIndex=0,yieldOrdinal=0,resumeHook:MvuSchemaStoryBrowserHookFact|undefined
  const consumeHook=(hook:MvuSchemaStoryBrowserHookFact)=>{
    exact(hook,['schemaVersion','request','result','journal','frontier'])
    const {request,result,journal}=hook
    if(hook.schemaVersion!==1||request.sessionId!==(plan.schemaVersion===14?plan.execution.sessionId:plan.base.sessionId)||request.planSha256!==mvuSchemaStoryExecutionId(plan)
      ||request.stage!==result.stage||!same(request.target,{kind:'message',ownerSessionId:plan.base.sessionId,
        nativeSeq:plan.canonical.seq,messageId:plan.canonical.messageId,messageVersionSha256:plan.canonical.versionSha256}))fail()
    validateSchemaJournalRecord(journal.dispatch);validateSchemaJournalRecord(journal.completion)
    if(!same(request,journal.dispatch.request)||!same(result,journal.completion.result)
      ||journal.dispatchRef.sha256!==journal.dispatch.recordSha256||journal.completionRef.sha256!==journal.completion.recordSha256
      ||!same(journal.completion.dispatch,journal.dispatchRef)||!same(journal.completion.dispatchMarker,journal.dispatchMarker)
      ||journal.dispatchMarker.seq<cut||journal.completionMarker.seq<=journal.dispatchMarker.seq
      ||journal.dispatch.sourceNativeCut.nativeCut!==journal.dispatchMarker.seq||journal.dispatch.realmEpoch!==plan.realmEpoch
      ||journal.dispatch.sourceNativeCut.sourceSnapshotSha256!==plan.currentFrame.snapshotSha256
      ||journal.dispatch.sourceNativeCut.materialSha256!==plan.currentFrame.materialSha256
      ||!same(journal.dispatch.sourceNativeCut.anchor,plan.selectors[0]!.anchor))fail()
    frontier(hook.frontier)
    if(hook.frontier.nativeCut!==journal.completionMarker.seq+1)fail()
    cut=journal.completionMarker.seq+1;hookIndex++
  }
  for(const [index,phase] of phases.entries()){
    exact(phase,['phase','input','association','output'])
    const input=validateSchemaEvaluationInputV4(phase.input)
    if(!input.update)fail()
    if(plan.schemaVersion===13){
      if(input.encoding!=='native-mvu-author-schema-phase-input-v4-scope-ref-v2'
        ||!schemaScopeReadRefFactsEqualV2(input.scopeReadRef,plan.scopeReadRef)
        ||input.scopeReadRef.sourceNativeCutSha256!==phase.association.sourceNativeCutSha256)fail()
    }else if(input.encoding!=='native-mvu-author-schema-phase-input-v4'
      ||!schemaScopeReadFactsEqual(input.scopeReadFrame,plan.scopeReadFrame)
      ||input.scopeReadFrame.sourceNativeCutSha256!==phase.association.sourceNativeCutSha256)fail()
    const output=validateSchemaGuestOutputV4(phase.output,input)
    association(phase.association,plan,index)
    if(phase.phase!=='update-core'||phase.association.dispatchMarker.seq<cut
      ||phase.association.outputSha256!==recordSha256(output)
      ||!same(input,mvuSchemaStoryPhaseInput(plan,index,phases,input.scopeReadFrame,input.scopeReadRef,undefined,
        input.update.interests,resumeHook,input.update.encoding==='native-mvu-196-update-start-v1'?input.update.macros:undefined)))fail()
    if(index===0&&(phase.association.dispatchMarker.seq!==plan.initialCut.nativeCut
      ||phase.association.sourceNativeCutSha256!==recordSha256(plan.initialCut)))fail()
    cut=phase.association.completionMarker.seq+1
    if(output.kind==='refused'){if(index!==phases.length-1)fail();break}
    if(!output.update||output.update.updateId!==mvuSchemaStoryExecutionId(plan))fail()
    if(output.update.kind==='complete'){if(index!==phases.length-1)fail();break}
    if(index===phases.length-1||output.update.yieldOrdinal!==yieldOrdinal++)fail()
    resumeHook=undefined
    if(output.update.kind==='native-commands-ready')continue
    const hook=browser?.hooks[hookIndex]
    if(hook?.request.yieldOrdinal===output.update.yieldOrdinal){
      const {readVariables:_readVariables,...payload}=hook.request.payload
      if(hook.request.stage!==output.update.stage||!same(payload,{graph:output.update.graph})
        ||!('graph' in hook.result.output)||!hook.result.output.graph)fail()
      consumeHook(hook);resumeHook=hook
    }
  }
  const before=browser?.hooks[hookIndex],last=phases.at(-1)!.output
  if(before){
    const {readVariables:_readVariables,...payload}=before.request.payload
    if(last.kind!=='accepted'||!('update' in last)||last.update?.kind!=='complete'
      ||before.request.stage!=='before-message-update'||before.request.yieldOrdinal!==undefined
      ||!same(payload,{context:{variables:mvuSchemaStoryVariables(last.values,last.context),
        message_content:plan.canonical.narrative}}))fail()
    consumeHook(before)
  }
  if(hookIndex!==(browser?.hooks.length??0))fail()
  if(browser&&browser.finalizedMessage!==(before?.result.stage==='before-message-update'
    ?before.result.output.context.message_content:plan.canonical.narrative))fail()
}

export function mvuSchemaStoryContextWrites(phases:readonly MvuSchemaStoryPhaseFact[],
  browser?:MvuSchemaStoryBrowserExecutionV1):AuthorNativeMvuContextWritesV1 {
  const keys=new Set<string>(['stat_data'])
  const writes=[...phases.map(phase=>phase.output.kind==='accepted'?phase.output.contextWrites:undefined),
    ...browser?.hooks.map(hook=>hook.result.contextWrites)??[]]
  for(const write of writes) {
    if(write?.kind==='replace')return {schemaVersion:1,kind:'replace'}
    for(const key of write?.keys??[])keys.add(key)
  }
  return {schemaVersion:1,kind:'keys',keys:[...keys]}
}
export function mvuSchemaStoryEvent(plan:MvuSchemaStoryPlanV13,phases:readonly MvuSchemaStoryPhaseFact[],
  browser?:MvuSchemaStoryBrowserExecutionV1,ordinaryScopes?:NumericalOrdinaryPublicationV1):MvuSchemaStoryEventV2 {
  return storyEvent(plan,phases,browser,ordinaryScopes) as MvuSchemaStoryEventV2
}
export function mvuSchemaStoryRevisionEvent(plan:MvuSchemaStoryRevisionPlanV14,phases:readonly MvuSchemaStoryPhaseFact[],
  browser?:MvuSchemaStoryBrowserExecutionV1,ordinaryScopes?:NumericalOrdinaryPublicationV1):MvuSchemaStoryRevisionEventV2 {
  const writes=mvuSchemaStoryContextWrites(phases,browser),basis=plan.ordinaryScopes,
    publication=ordinaryScopes??(basis?{schemaVersion:1 as const,scopes:basis.scopes.map(scope=>({...scope,
      kind:writes.kind,...writes.kind==='keys'?{keys:writes.keys}:{}}))}:undefined)
  return storyEvent(plan,phases,browser,publication) as MvuSchemaStoryRevisionEventV2
}
function storyEvent(plan:MvuSchemaStoryPlan,phases:readonly MvuSchemaStoryPhaseFact[],
  browser?:MvuSchemaStoryBrowserExecutionV1,ordinaryScopes?:NumericalOrdinaryPublicationV1):MvuSchemaStoryEventV2|MvuSchemaStoryRevisionEventV2 {
  if(!phases.length)fail()
  const last=phases.at(-1)!,refused=last.output.kind==='refused'
  if(!refused&&(last.output.kind!=='accepted'||!('update' in last.output)||last.output.update?.kind!=='complete'))fail()
  const final=browserFinal(plan,phases,browser),values=refused?plan.base.values:final.values,
    context=refused?plan.base.context:final.context,valuesSha256=recordSha256(values),revision=plan.schemaVersion===14,
    ordinaryWrite=ordinaryScopes?.scopes.some(scope=>scope.kind==='replace'||scope.keys?.some(key=>key!=='stat_data')),
    outcome=refused?'refused':valuesSha256===plan.base.valuesSha256&&same(context,plan.base.context)&&!ordinaryWrite?'no-update':'accepted',
    execution=revision?plan.execution:plan.base
  return sealMvuSchemaStoryFact({schemaVersion:2 as const,
    encoding:revision?'native-mvu-schema-story-revision-event-v2':'native-mvu-schema-story-event-v2',
    sessionId:execution.sessionId,sourceSha256:execution.sourceSha256,
    eventId:recordSha256({encoding:revision?'native-mvu-schema-story-revision-event-identity-v2':
      'native-mvu-schema-story-event-identity-v2',planSha256:plan.planSha256}),plan,phases,
    ...browser?{browser}:{},...!refused&&ordinaryScopes?{ordinaryScopes}:{},
    outcome,refusal:refused?'guest' as const:null,values,valuesSha256,context,frontier:final.frontier},'eventSha256') as
    MvuSchemaStoryEventV2|MvuSchemaStoryRevisionEventV2
}
const validateStoryEventDescriptor=createImmutableDescriptorValidator(validateStoryEventUncached)
export function validateMvuSchemaStoryEvent(input:MvuSchemaStoryEventV2):MvuSchemaStoryEventV2 {
  return validateStoryEventDescriptor(input) as MvuSchemaStoryEventV2
}
export function validateMvuSchemaStoryRevisionEvent(input:MvuSchemaStoryRevisionEventV2):MvuSchemaStoryRevisionEventV2 {
  return validateStoryEventDescriptor(input) as MvuSchemaStoryRevisionEventV2
}
function validateStoryEventUncached(input:MvuSchemaStoryEventV2|MvuSchemaStoryRevisionEventV2):MvuSchemaStoryEventV2|MvuSchemaStoryRevisionEventV2 {
  const event=freezeMvuSchemaStoryData(input),plan=validateMvuSchemaStoryPlan(event.plan)
  exact(event,['schemaVersion','encoding','sessionId','sourceSha256','eventId','plan','phases',
    'outcome','refusal','values','valuesSha256','context','frontier','eventSha256'],['browser','ordinaryScopes'])
  fact(event,'eventSha256')
  if(!Array.isArray(event.phases)||!event.phases.length)fail()
  validateMvu196StoryExecution(plan,event.phases,event.browser)
  const revision=plan.schemaVersion===14,last=event.phases.at(-1)!,refused=last.output.kind==='refused'
  if(!refused&&(last.output.kind!=='accepted'||!('update' in last.output)||last.output.update?.kind!=='complete'))fail()
  const final=browserFinal(plan,event.phases,event.browser),values=refused?plan.base.values:final.values,
    context=refused?plan.base.context:final.context,valuesSha256=recordSha256(values),execution=revision?plan.execution:plan.base,
    ordinaryWrite=event.ordinaryScopes?.scopes.some(scope=>scope.kind==='replace'||scope.keys?.some(key=>key!=='stat_data'))
  exact(event.frontier,['nativeCut','tailSha256','frontierSha256'])
  if(event.schemaVersion!==2||event.encoding!==(revision?'native-mvu-schema-story-revision-event-v2':'native-mvu-schema-story-event-v2')
    ||event.sessionId!==execution.sessionId||event.sourceSha256!==execution.sourceSha256
    ||event.eventId!==recordSha256({encoding:revision?'native-mvu-schema-story-revision-event-identity-v2':
      'native-mvu-schema-story-event-identity-v2',planSha256:plan.planSha256})
    ||event.valuesSha256!==valuesSha256||recordSha256(event.values)!==valuesSha256||!same(event.context,context)
    ||event.outcome!==(refused?'refused':valuesSha256===plan.base.valuesSha256&&same(context,plan.base.context)&&!ordinaryWrite?'no-update':'accepted')
    ||event.refusal!==(refused?'guest':null)||!same(event.frontier,final.frontier))fail()
  return event
}
export function mvuSchemaStoryRevisionHead(event:MvuSchemaStoryRevisionEventV2):MvuSchemaStoryRevisionHeadV2 {
  if(event.outcome==='refused')fail()
  return freezeMvuSchemaStoryData({schemaVersion:2,encoding:'native-mvu-schema-story-revision-head-v2',
    sessionId:event.sessionId,sourceSha256:event.sourceSha256,root:event.plan.execution.root,
    revision:event.plan.revision.publicationRevision,eventId:event.eventId,eventSha256:event.eventSha256,
    planSha256:event.plan.planSha256,valuesSha256:event.valuesSha256})
}
function revisionReference(value:SchemaJournalRef):void {
  exact(value,['key','sha256'])
  if(!id(value.key,512)||!hash(value.sha256))fail()
}
function revisionHistoryBasis(value:MvuSchemaHistoryBasisRef):void {
  exact(value,['basisKey','basisSha256'])
  if(!id(value.basisKey,512)||!hash(value.basisSha256))fail()
}
/** Prefix and closure interpretation belongs to their existing owners. This
 * seal preserves the selected baseline DATA across a process boundary. */
export function validateMvuSchemaStoryRevisionBasis(input:MvuSchemaStoryRevisionBasisV1):MvuSchemaStoryRevisionBasisV1 {
  const value=freezeMvuSchemaStoryData(input)
  exact(value,['schemaVersion','encoding','sessionId','historyBasis','closedRevision','prefix','closure','basisSha256'])
  fact(value,'basisSha256')
  if(value.schemaVersion!==1||value.encoding!=='native-mvu-schema-revision-basis-v1'||!id(value.sessionId,64))fail()
  if(value.historyBasis!==null)revisionHistoryBasis(value.historyBasis)
  if(value.closedRevision!==null)revisionReference(value.closedRevision)
  return value
}
function validateRevisionDescriptorV2<T extends MvuSchemaStoryRevisionDescriptorV2|MvuSchemaStoryRevisionDescriptorV3
  |MvuSchemaStoryRevisionDescriptorV4|MvuSchemaStoryRevisionDescriptorV5>(value:T):T {
  exact(value,['schemaVersion','encoding','sessionId','edits','basis','originals','previous',
    'completionSeq','publicationRevision','sourceSha256','descriptorSha256',
    ...(value.schemaVersion===4?['taskEdits']:value.schemaVersion===5?['authorizations']:[])])
  exact(value.basis,['record','nativeCut','historyBasis','closedRevision','prefixSha256','stateSnapshotSha256'])
  revisionReference(value.basis.record)
  fact(value,'descriptorSha256')
  if((value.schemaVersion===2?value.encoding!=='native-mvu-schema-story-revision-descriptor-v2'
      :value.schemaVersion===3?value.encoding!=='native-mvu-schema-story-revision-descriptor-v3'
      :value.schemaVersion===4?value.encoding!=='native-mvu-schema-story-revision-descriptor-v4'
      :value.schemaVersion!==5||value.encoding!=='native-mvu-schema-story-revision-descriptor-v5')
    ||!id(value.sessionId,64)||!Array.isArray(value.edits)||!Array.isArray(value.originals)
    ||!integer(value.basis.nativeCut)||!integer(value.completionSeq)||!integer(value.publicationRevision,2)
    ||![value.basis.prefixSha256,value.basis.stateSnapshotSha256,value.sourceSha256].every(hash))fail()
  if(value.basis.historyBasis!==null)revisionHistoryBasis(value.basis.historyBasis)
  if(value.basis.closedRevision!==null)revisionReference(value.basis.closedRevision)
  for(const edit of value.edits) {
    exact(edit,['seq','sha256','targetSeq','messageId','messageVersionSha256','narrativeSha256',
      ...(value.schemaVersion===4||value.schemaVersion===5?['role']:[])])
    if(!integer(edit.seq)||!integer(edit.targetSeq)||edit.targetSeq>=edit.seq||!id(edit.messageId)
      ||![edit.sha256,edit.messageVersionSha256,edit.narrativeSha256].every(hash))fail()
  }
  if(value.schemaVersion!==2)for(const original of value.originals) {
    exact(original,['kind','event'])
    if(original.kind!=='story'&&original.kind!=='manual')fail()
    revisionReference(original.event)
  }
  else for(const original of value.originals)revisionReference(original)
  if(value.schemaVersion===4) {
    if(!Array.isArray(value.taskEdits)||!value.taskEdits.length)fail()
    for(const edit of value.edits)if(edit.role!=='assistant'&&edit.role!=='user')fail()
    for(const item of value.taskEdits) {
      exact(item,['index','selection']);exact(item.selection,['canonicalSeq','originEventRef','sourceEventRef','effectiveKind','mode','intent','binding'])
      if(!integer(item.index)||item.index>=value.originals.length)fail()
      validateSchemaTaskArtifactV1(item.selection)
      revisionReference(item.selection.intent);revisionReference(item.selection.binding)
    }
  }
  if(value.schemaVersion===5) {
    if(!Array.isArray(value.authorizations)||!value.authorizations.length)fail()
    for(const authorization of value.authorizations) {
      exact(authorization,['edit','proof']);exact(authorization.edit,['seq','sha256'])
      if(!integer(authorization.edit.seq)||!hash(authorization.edit.sha256))fail()
      if(authorization.proof.kind==='intent') {
        exact(authorization.proof,['kind','intent','binding'])
        revisionReference(authorization.proof.intent);revisionReference(authorization.proof.binding)
      }else if(authorization.proof.kind==='completed-v4') {
        exact(authorization.proof,['kind','descriptor','completion'])
        revisionReference(authorization.proof.descriptor);revisionReference(authorization.proof.completion)
      }else if(authorization.proof.kind==='post-commit-recovery') {
        exact(authorization.proof,['kind','intent']);revisionReference(authorization.proof.intent)
      }else fail()
    }
    for(const edit of value.edits)if(edit.role!=='assistant'&&edit.role!=='user')fail()
  }
  if(value.previous!==null)revisionReference(value.previous)
  return value
}
const validateRevisionDescriptor=createImmutableDescriptorValidator((input:MvuSchemaStoryRevisionDescriptor)=>{
  const value=freezeMvuSchemaStoryData(input)
  return validateRevisionDescriptorV2(value)
})
export function validateMvuSchemaStoryRevisionDescriptor(input:MvuSchemaStoryRevisionDescriptorV2):MvuSchemaStoryRevisionDescriptorV2
export function validateMvuSchemaStoryRevisionDescriptor(input:MvuSchemaStoryRevisionDescriptorV3):MvuSchemaStoryRevisionDescriptorV3
export function validateMvuSchemaStoryRevisionDescriptor(input:MvuSchemaStoryRevisionDescriptorV4):MvuSchemaStoryRevisionDescriptorV4
export function validateMvuSchemaStoryRevisionDescriptor(input:MvuSchemaStoryRevisionDescriptorV5):MvuSchemaStoryRevisionDescriptorV5
export function validateMvuSchemaStoryRevisionDescriptor(input:MvuSchemaStoryRevisionDescriptorV2|MvuSchemaStoryRevisionDescriptorV3
  |MvuSchemaStoryRevisionDescriptorV4|MvuSchemaStoryRevisionDescriptorV5)
  :MvuSchemaStoryRevisionDescriptorV2|MvuSchemaStoryRevisionDescriptorV3|MvuSchemaStoryRevisionDescriptorV4|MvuSchemaStoryRevisionDescriptorV5
export function validateMvuSchemaStoryRevisionDescriptor(input:MvuSchemaStoryRevisionDescriptor):MvuSchemaStoryRevisionDescriptor
export function validateMvuSchemaStoryRevisionDescriptor(input:MvuSchemaStoryRevisionDescriptor):MvuSchemaStoryRevisionDescriptor {
  return validateRevisionDescriptor(input)
}
/** Only descriptor integrity is established here. The publishing owner joins
 * the ordered event refs to its selected originals and complete suffix. */
export function validateMvuSchemaStoryRevisionCompletion<T extends MvuSchemaStoryRevisionCompletion>(input:T):T {
  const value=freezeMvuSchemaStoryData(input)
  exact(value,['schemaVersion','encoding','sessionId','descriptor','events','completionSha256'])
  fact(value,'completionSha256')
  if(!(value.schemaVersion===2&&value.encoding==='native-mvu-schema-story-revision-completion-v2'
      ||value.schemaVersion===3&&value.encoding==='native-mvu-schema-story-revision-completion-v3'
      ||value.schemaVersion===4&&value.encoding==='native-mvu-schema-story-revision-completion-v4'
      ||value.schemaVersion===5&&value.encoding==='native-mvu-schema-story-revision-completion-v5')
    ||!id(value.sessionId,64)||!Array.isArray(value.events))fail()
  revisionReference(value.descriptor)
  for(const event of value.events)revisionReference(event)
  return value
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
