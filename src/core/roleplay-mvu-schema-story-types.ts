/** Versioned schema story facts. These validators prove bounded integrity,
 * never Native history, Source currency or private execution permission. */
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneSchemaValues} from './tavern-mvu-schema-data.js'
import {freezeImmutableSchemaDescriptorDataV4,createImmutableDescriptorValidator} from './roleplay-mvu-schema-descriptor-data.js'
import {validateMvuSchemaOpeningHead} from './roleplay-mvu-schema-opening-types.js'
import {parseMvuUpdateV2,parseMvuUpdateRegionV2,parseMvuUpdateAnalysisAliasRegionV2,reduceMvuUpdateOperationsV2,
  mvuCommandInfos,mvuOperationsFromCommandInfos} from './roleplay-mvu-update-v2.js'
import type {MvuCommandSyntaxCaptureV1} from './roleplay-mvu-update-v2.js'
import type {AuthorNativeMvuHookRequest,AuthorNativeMvuHookResult} from './author-native-mvu-hook-types.js'
import type {SchemaJournalBrowserFacts} from './roleplay-mvu-schema-journal.js'
import {mvuSchemaMaintenanceTaskCandidate,validateMvuSchemaMaintenanceCandidateSourceV1}
  from './roleplay-mvu-schema-maintenance-types.js'
import type {MvuSchemaMaintenanceCandidateSourceV1} from './roleplay-mvu-schema-maintenance-types.js'
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
import type {MvuUpdateCandidateV2,PreparedMvuUpdateV2,MvuUpdateRejectionV2,MvuUpdateOperationV2}
  from './roleplay-mvu-update-v2.js'
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
export interface MvuSchemaStoryRevisionHeadV1 extends Omit<MvuSchemaStoryHeadV2,'schemaVersion'|'encoding'> {
  schemaVersion:1
  encoding:'native-mvu-schema-story-revision-head-v1'
}
export interface MvuSchemaStoryRevisionHeadV2 extends Omit<MvuSchemaStoryHeadV2,'encoding'> {
  encoding:'native-mvu-schema-story-revision-head-v2'
}
export type MvuSchemaStoryRevisionHead=MvuSchemaStoryRevisionHeadV1|MvuSchemaStoryRevisionHeadV2
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
export const isMvuSchemaGenesisHead=(head:MvuSchemaNumericalHead)=>head.encoding==='mvu-schema-opening-head-v2'
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
export interface MvuSchemaStoryPlanV5 {
  schemaVersion:5
  encoding:'native-mvu-schema-story-plan-v5'
  executorVersion:4
  scope:InputCompletionScope
  canonical:MvuSchemaStoryCanonical
  base:MvuSchemaNumericalSnapshotV2
  candidate:MvuUpdateCandidateV2
  currentFrame:SchemaStorySourceFrame
  realmEpoch:string
  programSha256:string
  initialCut:SourceNativeCutFacts
  clockEpochMs:number
  randomSeed:string
  selectors:readonly SchemaExecutionSelector[]
  planSha256:string
  scopeReadFrame:MvuScopeReadFrameV1
  errorPolicy?:Exclude<MvuSchemaPhaseErrorPolicyV4,'atomic-refusal'>
  commandSyntax?:MvuCommandSyntaxCaptureV1
}
/** Host5 keeps Combined as the root identity; phase execution remains ABI4. */
export type MvuSchemaStoryParserPolicy='analysis-alias-v1'|'analysis-alias-rfc6902-members-v1'
export interface MvuSchemaStoryPlanV6 extends Omit<MvuSchemaStoryPlanV5,'schemaVersion'|'encoding'> {
  schemaVersion:6
  encoding:'native-mvu-schema-story-plan-v6'
  epoch:SchemaJournalRef
  serverProgramSha256:string
  parserPolicy?:MvuSchemaStoryParserPolicy
}
/** Current Story DATA retains ABI4/Host5 and the admitted candidate source
 * while references replace the full scope frame. */
export interface MvuSchemaStoryPlanV12 extends Omit<MvuSchemaStoryPlanV6,'schemaVersion'|'encoding'|'scopeReadFrame'> {
  schemaVersion:12
  encoding:'native-mvu-schema-story-plan-v12-scope-ref-v2'
  scopeReadRef:MvuScopeReadRefV2
  maintenance?:MvuSchemaMaintenanceCandidateSourceV1
}
/** Only an explicitly newly admitted Work may use a task-result candidate.
 * The complete source fact stays readable after its hot task owner is gone. */
export interface MvuSchemaStoryPlanV10 extends Omit<MvuSchemaStoryPlanV6,'schemaVersion'|'encoding'> {
  schemaVersion:10
  encoding:'native-mvu-schema-story-plan-v10'
  maintenance:MvuSchemaMaintenanceCandidateSourceV1
}
/** The original scope is immutable completed Story DATA, never a new closing
 * lease or InputCompletion. An accepted Native edit owns this execution. */
export interface MvuSchemaStoryRevisionPlanV1 extends Omit<MvuSchemaStoryPlanV6,'schemaVersion'|'encoding'> {
  schemaVersion:7
  encoding:'native-mvu-schema-story-revision-plan-v1'
  revision:{descriptor:SchemaJournalRef;publicationRevision:number}
}
/** Original completion scope stays immutable historical DATA. Execution owns
 * the current Source and Native append; logicalNativeCut selects message DATA. */
export interface MvuSchemaStoryRevisionPlanV2 extends Omit<MvuSchemaStoryPlanV6,'schemaVersion'|'encoding'> {
  schemaVersion:8
  encoding:'native-mvu-schema-story-revision-plan-v2'
  revision:{descriptor:SchemaJournalRef;index:number;publicationRevision:number}
  execution:{sessionId:string;sourceSha256:string;root:MvuSchemaStoryRoot}
  logicalNativeCut:number
}
export interface MvuSchemaStoryRevisionPlanV3 extends Omit<MvuSchemaStoryRevisionPlanV2,'schemaVersion'|'encoding'> {
  schemaVersion:11
  encoding:'native-mvu-schema-story-revision-plan-v3'
  taskEdit:SchemaTaskRevisionSelectionV1
}
export type MvuSchemaStoryRevisionPlan=MvuSchemaStoryRevisionPlanV1|MvuSchemaStoryRevisionPlanV2|MvuSchemaStoryRevisionPlanV3
export interface MvuSchemaStoryRevisionDescriptorV1 {
  schemaVersion:1
  encoding:'native-mvu-schema-story-revision-descriptor-v1'
  sessionId:string
  edit:{seq:number;sha256:string;targetSeq:number;messageId:string;messageVersionSha256:string;narrativeSha256:string}
  original:SchemaJournalRef
  previous:SchemaJournalRef|null
  baseStateSnapshotSha256:string
  completionSeq:number
  publicationRevision:number
  sourceSha256:string
  descriptorSha256:string
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
  edits:readonly MvuSchemaStoryRevisionDescriptorV1['edit'][]
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
  edits:readonly (MvuSchemaStoryRevisionDescriptorV1['edit']&{role:'user'|'assistant'})[]
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
  edits:readonly (MvuSchemaStoryRevisionDescriptorV1['edit']&{role:'user'|'assistant'})[]
  authorizations:readonly MvuSchemaStoryUserEditAuthorization[]
}
export type MvuSchemaStoryRevisionDescriptor=MvuSchemaStoryRevisionDescriptorV1|MvuSchemaStoryRevisionDescriptorV2
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
export type MvuSchemaStoryPlan=MvuSchemaStoryPlanV5
  |MvuSchemaStoryPlanV6|MvuSchemaStoryRevisionPlan|MvuSchemaStoryPlanV10|MvuSchemaStoryPlanV12
export function schemaStoryMaintenanceSource(plan:MvuSchemaStoryPlan):MvuSchemaMaintenanceCandidateSourceV1|undefined {
  return plan.schemaVersion===10||plan.schemaVersion===12?plan.maintenance:undefined
}
export interface MvuSchemaStoryPhaseFact {
  phase:MvuSchemaStoryPhase|'hook-reconcile'
  input:SchemaEvaluationInput
  association:SchemaExecutionAssociation
  output:SchemaGuestOutput
}
export interface MvuSchemaStoryBrowserHookFact {
  schemaVersion:1
  request:AuthorNativeMvuHookRequest
  result:AuthorNativeMvuHookResult
  journal:SchemaJournalBrowserFacts
  frontier:MvuSchemaStoryFrontier
}
export interface MvuSchemaStoryBrowserExecutionV1 {
  schemaVersion:1
  hooks:readonly MvuSchemaStoryBrowserHookFact[]
  reconcile?:MvuSchemaStoryPhaseFact
  finalizedMessage:string
}
export interface MvuSchemaStoryReducerBridgeV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-story-reducer-bridge-v2'
  phaseOutputSha256:string
  result:PreparedMvuUpdateV2|MvuUpdateRejectionV2
  bridgeSha256:string
}
export type MvuSchemaStoryReducerBridge=MvuSchemaStoryReducerBridgeV2
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
  browser?:MvuSchemaStoryBrowserExecutionV1
}
export interface MvuSchemaStoryRevisionEventV1 extends Omit<MvuSchemaStoryEventV2,'schemaVersion'|'encoding'|'plan'> {
  schemaVersion:1
  encoding:'native-mvu-schema-story-revision-event-v1'
  plan:MvuSchemaStoryRevisionPlanV1
}
export interface MvuSchemaStoryRevisionEventV2 extends Omit<MvuSchemaStoryEventV2,'encoding'|'plan'> {
  encoding:'native-mvu-schema-story-revision-event-v2'
  plan:MvuSchemaStoryRevisionPlanV2|MvuSchemaStoryRevisionPlanV3
}
export type MvuSchemaStoryRevisionEvent=MvuSchemaStoryRevisionEventV1|MvuSchemaStoryRevisionEventV2
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
  executeHook?(plan:MvuSchemaStoryPlan,request:AuthorNativeMvuHookRequest,closing:object):
    Promise<MvuSchemaStoryBrowserHookFact|undefined>
  executeReconcile?(plan:MvuSchemaStoryPlan,input:SchemaEvaluationInput,closing:object):Promise<SchemaExecutionResult>
  withPublicationBoundary<T>(closing:object,lastLive:MvuSchemaStoryLive,action:()=>Promise<T>):Promise<T>
  /** Root checks the final hot evidence, all actual journal pins, every phase
   * input/output and the reducer bridge under its real Source boundary. */
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
export function parseMvuSchemaStoryCandidateV2(narrative:string,parserPolicy?:MvuSchemaStoryParserPolicy):MvuUpdateCandidateV2 {
  if(parserPolicy==='analysis-alias-v1'||parserPolicy==='analysis-alias-rfc6902-members-v1')
    return parseMvuUpdateAnalysisAliasRegionV2(narrative,
      parserPolicy==='analysis-alias-rfc6902-members-v1'?{jsonPatchMembers:'rfc6902'}:undefined).candidate
  return parseMvuUpdateV2(narrative)
}
export function parseMvuSchemaStoryCandidateData(narrative:string,parserPolicy?:MvuSchemaStoryParserPolicy) {
  const parsed=parserPolicy?parseMvuUpdateAnalysisAliasRegionV2(narrative,
    parserPolicy==='analysis-alias-rfc6902-members-v1'?{jsonPatchMembers:'rfc6902'}:undefined):parseMvuUpdateRegionV2(narrative)
  return {candidate:parsed.candidate,...parsed.syntax?{commandSyntax:parsed.syntax}:{}}
}
export function mvuSchemaStoryCommandInfos(plan:MvuSchemaStoryPlan) {
  return mvuCommandInfos(plan.canonical.narrative,plan.commandSyntax,
    plan.candidate.kind==='parsed'?plan.candidate.operations:[])
}
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
export function mvuSchemaStoryExecutionPhases<T extends {phases:readonly {association:SchemaExecutionAssociation}[];
  browser?:MvuSchemaStoryBrowserExecutionV1}>(event:T):T['phases'] {
  if(!event.browser?.reconcile)return event.phases
  return [...event.phases,event.browser.reconcile].sort((a,b)=>a.association.dispatchMarker.seq-b.association.dispatchMarker.seq) as T['phases']
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
  if(head.encoding==='mvu-schema-opening-head-v2')return validateMvuSchemaOpeningHead(head)
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
       ||head.encoding==='native-mvu-schema-story-revision-head-v1'
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
  if(head.encoding==='mvu-schema-opening-head-v2') {
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
export function deriveMvuSchemaStoryRevisionSelectors(scope:InputCompletionScope,canonical:MvuSchemaStoryCanonical,
  realmEpoch:string,descriptor:SchemaJournalRef):readonly SchemaExecutionSelector[] {
  return deriveMvuSchemaStorySelectors(scope,canonical,realmEpoch).map((selector,index)=>
    ({...selector,batchId:`revision-${descriptor.sha256}-${index+1}`}))
}
export function deriveMvuSchemaStoryRevisionSelectorsV2(scope:InputCompletionScope,canonical:MvuSchemaStoryCanonical,
  realmEpoch:string,descriptor:SchemaJournalRef,index:number,sessionId:string):readonly SchemaExecutionSelector[] {
  const supplied=freezeMvuSchemaStoryData({scope,canonical,realmEpoch,descriptor,index,sessionId})
  const anchor={kind:'story' as const,preparationId:supplied.scope.currency.preparationId,
    attemptGeneration:supplied.scope.currency.attemptGeneration,receiptGeneration:supplied.scope.currency.receiptGeneration,
    turn:supplied.scope.receipt.checkpoint.actualTurn,canonicalSeq:supplied.canonical.seq,messageId:supplied.canonical.messageId,
    messageVersionSha256:supplied.canonical.versionSha256}
  validateSchemaAnchor(anchor)
  return freezeMvuSchemaStoryData(MVU_SCHEMA_STORY_PHASES.map((_phase,phaseIndex)=>({
    sessionId:supplied.sessionId,batchId:`revision2-${supplied.descriptor.sha256}-${supplied.index+1}-${phaseIndex+1}`,anchor})))
}
export function validateMvuSchemaStoryPlan<T extends MvuSchemaStoryPlan>(input:T):T {
  const value=freezeMvuSchemaStoryData(input)
  if(value.schemaVersion===8||value.schemaVersion===11)return validateStoryRevisionPlanV2(value) as T
  exact(value,['schemaVersion','encoding','scope','canonical','base','candidate','currentFrame','realmEpoch',
    'programSha256','initialCut','clockEpochMs','randomSeed','selectors','planSha256',
    'executorVersion',...(value.schemaVersion===12?['scopeReadRef']:['scopeReadFrame']),
    ...(value.schemaVersion>=6?['epoch','serverProgramSha256']:[]),
    ...(value.schemaVersion===10?['maintenance']:[]),
    ...(value.schemaVersion===7?['revision']:[])],[
      'errorPolicy','commandSyntax',...(value.schemaVersion===12?['maintenance']:[]),
      ...(value.schemaVersion===6||value.schemaVersion===7||value.schemaVersion===10||value.schemaVersion===12?['parserPolicy']:[])])
  if('errorPolicy' in value&&value.errorPolicy!=='registered-command-policy-v1'
    &&value.errorPolicy!=='update-batch-atomic-v1')fail()
  if('parserPolicy' in value&&value.parserPolicy!=='analysis-alias-v1'
    &&value.parserPolicy!=='analysis-alias-rfc6902-members-v1')fail()
  fact(value,'planSha256');validateMvuSchemaNumericalSnapshot(value.base)
  validateSchemaStorySourceFrame(value.currentFrame)
  const scope=value.scope,currency=scope.currency,receipt=scope.receipt,canonical=value.canonical,frame=value.currentFrame
  const maintenance=schemaStoryMaintenanceSource(value)
  const canonicalData=parseMvuSchemaStoryCandidateData(canonical.narrative,'parserPolicy' in value?value.parserPolicy:undefined)
  const maintenanceCanonicalCandidate=maintenance?canonicalData.candidate:undefined
  if(value.commandSyntax!==undefined&&!same(value.commandSyntax,canonicalData.commandSyntax))fail()
  exact(scope,['currency','receipt','stopGeneration'])
  exact(currency,['schemaVersion','preparationId','credentialSha256','receiptGeneration','attemptGeneration','source','snapshot'])
  exact(currency.snapshot!,['key','sha256'])
  if(currency.source.kind!=='story')fail()
  exact(currency.source,['kind','sourceSha256','headRef'])
  exact(currency.source.headRef!,['kind','sha256'])
  exact(canonical,['seq','messageId','versionSha256','narrative','narrativeSha256'])
  exact(frame,['schemaVersion','encoding','sessionId','material','materialSha256','snapshot','snapshotSha256'])
  const sourceSha=currency.source.sourceSha256
  if(!(value.schemaVersion===5&&value.encoding==='native-mvu-schema-story-plan-v5'&&value.executorVersion===4
      ||value.schemaVersion===6&&value.encoding==='native-mvu-schema-story-plan-v6'&&value.executorVersion===4
      ||value.schemaVersion===10&&value.encoding==='native-mvu-schema-story-plan-v10'&&value.executorVersion===4
      ||value.schemaVersion===12&&value.encoding==='native-mvu-schema-story-plan-v12-scope-ref-v2'&&value.executorVersion===4
      ||value.schemaVersion===7&&value.encoding==='native-mvu-schema-story-revision-plan-v1'&&value.executorVersion===4)
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
    ||value.randomSeed!==recordSha256(value.schemaVersion===7
      ?{scope,canonical,revision:value.revision.descriptor}:{scope,canonical})||frame.schemaVersion!==1
    ||frame.encoding!=='native-mvu-schema-story-source-frame-v1'||frame.sessionId!==value.base.sessionId
    ||frame.snapshotSha256!==frame.snapshot.snapshotSha256)fail()
  const {snapshotSha256,...snapshotBody}=frame.snapshot
  if(snapshotSha256!==recordSha256(snapshotBody))fail()
  validateSchemaSourceCut(value.initialCut)
  if(value.initialCut.sessionId!==value.base.sessionId||value.initialCut.ownerSessionId!==value.base.sessionId
    ||value.initialCut.nativeCut<receipt.turnEndSeq+1||value.initialCut.nativeCut<value.base.schemaFrontier.nativeCut
    ||value.initialCut.stopGeneration!==scope.stopGeneration
    ||value.initialCut.sourceSnapshotSha256!==frame.snapshotSha256||value.initialCut.materialSha256!==frame.materialSha256
    ||!same(value.selectors,value.schemaVersion===7
      ?deriveMvuSchemaStoryRevisionSelectors(scope,canonical,value.realmEpoch,value.revision.descriptor)
      :deriveMvuSchemaStorySelectors(scope,canonical,value.realmEpoch))
    ||!same(value.initialCut.anchor,value.selectors[0]!.anchor)
    ||!same(value.candidate,maintenance?.kind==='task-result'
      ?mvuSchemaMaintenanceTaskCandidate(maintenance.result):maintenance
      ?maintenanceCanonicalCandidate:canonicalData.candidate))fail()
  if(maintenance)validateMvuSchemaMaintenanceCandidateSourceV1(maintenance,
    {scope,canonical,base:value.base,canonicalCandidate:maintenanceCanonicalCandidate!})
  if(value.schemaVersion===6||value.schemaVersion===7||value.schemaVersion===10||value.schemaVersion===12) {
    exact(value.epoch,['key','sha256'])
    if(!id(value.epoch.key,512)||!hash(value.epoch.sha256)||!hash(value.serverProgramSha256))fail()
  }
  if(value.schemaVersion===7) {
    exact(value.revision,['descriptor','publicationRevision']);exact(value.revision.descriptor,['key','sha256'])
    if(!id(value.revision.descriptor.key,512)||!hash(value.revision.descriptor.sha256)
      ||!integer(value.revision.publicationRevision,value.base.revision+1))fail()
  }
  if(value.schemaVersion!==12) {
    const read=validateMvuScopeReadFrameV1(value.scopeReadFrame),source=frame.snapshot.source
    if(read.source.sessionId!==value.base.sessionId||read.source.sourceRecordSessionId!==source.sourceRecordSessionId
      ||read.source.importId!==source.importId||read.source.rawSha256!==source.rawSha256
      ||read.source.sourceSnapshotSha256!==frame.snapshotSha256
      ||read.sourceNativeCutSha256!==recordSha256(value.initialCut))fail()
  }
  if(value.schemaVersion===12&&validateMvuScopeReadRefV2(value.scopeReadRef).sourceNativeCutSha256!==recordSha256(value.initialCut))fail()
  return value
}
/** Validated reference DATA may advance its Native cut without changing the
 * frozen message/variable dependency chain selected by a transaction plan. */
export function schemaScopeReadRefFactsEqualV2(left:MvuScopeReadRefV2,right:MvuScopeReadRefV2):boolean {
  return left.baseRef.ownerSessionId===right.baseRef.ownerSessionId&&left.baseRef.key===right.baseRef.key
    &&left.baseRef.sha256===right.baseRef.sha256&&left.tailRef.ownerSessionId===right.tailRef.ownerSessionId
    &&left.tailRef.key===right.tailRef.key&&left.tailRef.sha256===right.tailRef.sha256
}
function validateStoryRevisionPlanV2<T extends MvuSchemaStoryRevisionPlanV2|MvuSchemaStoryRevisionPlanV3>(value:T):T {
  exact(value,['schemaVersion','encoding','scope','canonical','base','candidate','currentFrame','realmEpoch',
    'programSha256','initialCut','clockEpochMs','randomSeed','selectors','planSha256','executorVersion',
    'scopeReadFrame','epoch','serverProgramSha256','revision','execution','logicalNativeCut',
    ...(value.schemaVersion===11?['taskEdit']:[])],['errorPolicy','parserPolicy','commandSyntax'])
  if('errorPolicy' in value&&value.errorPolicy!=='registered-command-policy-v1'
    &&value.errorPolicy!=='update-batch-atomic-v1')fail()
  if('parserPolicy' in value&&value.parserPolicy!=='analysis-alias-v1'
    &&value.parserPolicy!=='analysis-alias-rfc6902-members-v1')fail()
  fact(value,'planSha256')
  validateMvuSchemaNumericalSnapshot(value.base)
  validateSchemaStorySourceFrame(value.currentFrame)
  const {scope,canonical,currentFrame:frame,execution,revision}=value,currency=scope.currency,receipt=scope.receipt
  if(value.commandSyntax!==undefined&&!same(value.commandSyntax,
    parseMvuSchemaStoryCandidateData(canonical.narrative,value.parserPolicy).commandSyntax))fail()
  exact(scope,['currency','receipt','stopGeneration'])
  exact(currency,['schemaVersion','preparationId','credentialSha256','receiptGeneration','attemptGeneration','source','snapshot'])
  exact(currency.snapshot!,['key','sha256'])
  if(currency.source.kind!=='story')fail()
  exact(currency.source,['kind','sourceSha256','headRef'])
  exact(currency.source.headRef!,['kind','sha256'])
  exact(canonical,['seq','messageId','versionSha256','narrative','narrativeSha256'])
  exact(execution,['sessionId','sourceSha256','root'])
  exact(revision,['descriptor','index','publicationRevision'])
  revisionReference(revision.descriptor)
  revisionReference(value.epoch)
  root(execution.root)
  if(!(value.schemaVersion===8&&value.encoding==='native-mvu-schema-story-revision-plan-v2'
      ||value.schemaVersion===11&&value.encoding==='native-mvu-schema-story-revision-plan-v3')||value.executorVersion!==4
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
    ||frame.sessionId!==execution.sessionId)fail()
  validateSchemaSourceCut(value.initialCut)
  if(value.initialCut.sessionId!==execution.sessionId||value.initialCut.ownerSessionId!==execution.sessionId
    ||value.initialCut.nativeCut<receipt.turnEndSeq+1||value.initialCut.nativeCut<value.base.schemaFrontier.nativeCut
    ||value.initialCut.sourceSnapshotSha256!==frame.snapshotSha256||value.initialCut.materialSha256!==frame.materialSha256
    ||!same(value.selectors,deriveMvuSchemaStoryRevisionSelectorsV2(scope,canonical,value.realmEpoch,
      revision.descriptor,revision.index,execution.sessionId))
    ||!same(value.initialCut.anchor,value.selectors[0]!.anchor))fail()
  if(value.schemaVersion===11) {
    const selected=value.taskEdit
    exact(selected,['canonicalSeq','originEventRef','sourceEventRef','effectiveKind','mode','intent','binding'])
    revisionReference(selected.intent);revisionReference(selected.binding)
    validateSchemaTaskArtifactV1(selected)
    if(selected.canonicalSeq!==canonical.seq)fail()
    const parsed=parseMvuSchemaStoryCandidateV2(canonical.narrative,value.parserPolicy)
    const expected=selected.mode==='retain'?value.candidate:selected.mode==='clear'
      ?parseMvuSchemaStoryCandidateV2('',value.parserPolicy):parsed
    if(!['retain','replace','clear'].includes(selected.mode)||!same(value.candidate,expected)
      ||selected.mode==='replace'&&parsed.kind!=='parsed')fail()
  }else if(!same(value.candidate,parseMvuSchemaStoryCandidateV2(canonical.narrative,value.parserPolicy)))fail()
  const read=validateMvuScopeReadFrameV1(value.scopeReadFrame),source=frame.snapshot.source
  if(read.source.sessionId!==execution.sessionId||read.source.sourceRecordSessionId!==source.sourceRecordSessionId
    ||read.source.importId!==source.importId||read.source.rawSha256!==source.rawSha256
    ||read.source.sourceSnapshotSha256!==frame.snapshotSha256
    ||read.sourceNativeCutSha256!==recordSha256(value.initialCut))fail()
  return value
}
/** Replay consumes normalized values without reapplying the accepted base. */
export function mvuSchemaStoryPhaseInput(plan:MvuSchemaStoryPlan,index:number,
  phases:readonly MvuSchemaStoryPhaseFact[],bridge:MvuSchemaStoryReducerBridge|null,
  scopeReadFrame?:MvuScopeReadFrameV1,scopeReadRef?:MvuScopeReadRefV2,
  browser?:MvuSchemaStoryBrowserExecutionV1):SchemaEvaluationInput {
  if(plan.schemaVersion!==12&&scopeReadRef!==undefined)fail()
  if(!integer(index)||index>=MVU_SCHEMA_STORY_PHASES.length||phases.length<index)fail()
  let read:MvuScopeReadFrameV1|undefined,reference:MvuScopeReadRefV2|undefined
  if(plan.schemaVersion===12) {
    if(scopeReadFrame!==undefined)fail()
    reference=validateMvuScopeReadRefV2(scopeReadRef??plan.scopeReadRef)
    if(!schemaScopeReadRefFactsEqualV2(reference,plan.scopeReadRef))fail()
  } else {
    read=validateMvuScopeReadFrameV1(scopeReadFrame??plan.scopeReadFrame)
    if(!schemaScopeReadFactsEqual(read,plan.scopeReadFrame))fail()
  }
  let values=plan.base.values,commands:readonly MvuUpdateOperationV2[]=[],context=plan.base.context
  if(index===0) {
    commands=plan.candidate.kind==='parsed'?plan.candidate.operations:[]
    const commandHook=browser?.hooks.find(hook=>hook.request.stage==='command-parsed')
    if(commandHook) {
      if(commandHook.result.stage!=='command-parsed'||commandHook.request.stage!=='command-parsed')fail()
      const parts=mvuSchemaStoryVariableParts(commandHook.result.output.variables)
      values=parts.values;context=parts.context
      if(!same(commandHook.result.output.commands,commandHook.request.payload.commands))
        commands=mvuOperationsFromCommandInfos(commandHook.result.output.commands)
    }
  }
  else {
    const previous=phases[index-1]!
    if((previous.input.encoding==='native-mvu-author-schema-phase-input-v4-scope-ref-v2')!==(plan.schemaVersion===12))fail()
    const accepted=validateSchemaGuestOutputV4(previous.output,validateSchemaEvaluationInputV4(previous.input))
    if(accepted.kind!=='accepted')fail()
    context=accepted.context;commands=accepted.commands
    if(index===1) {
      if(!bridge||bridge.result.kind!=='prepared')fail()
      values=bridge.result.values
    } else {
      values=accepted.values
      const ended=browser?.hooks.find(hook=>hook.request.stage==='update-ended')
      if(ended) {
        if(ended.result.stage!=='update-ended')fail()
        const parts=mvuSchemaStoryVariableParts(ended.result.output.variables)
        values=parts.values;context=parts.context
        if(browser?.reconcile) {
          if(browser.reconcile.output.kind!=='accepted')fail()
          values=browser.reconcile.output.values;context=browser.reconcile.output.context
        }
      }
    }
  }
  return freezeMvuSchemaStoryData(validateSchemaEvaluationInputV4({schemaVersion:4,
    ...(plan.schemaVersion===12?{encoding:'native-mvu-author-schema-phase-input-v4-scope-ref-v2' as const,scopeReadRef:reference!}:
      {encoding:'native-mvu-author-schema-phase-input-v4' as const,scopeReadFrame:read!}),
    commandsEncoding:'native-mvu-update-operations-v2',errorPolicy:plan.errorPolicy??'atomic-refusal',
    phase:MVU_SCHEMA_STORY_PHASES[index]!,base:plan.base.values,
    values,commands,context,clockEpochMs:plan.clockEpochMs,randomSeed:plan.randomSeed}))
}
export function mvuSchemaStoryReducerBridge(first:MvuSchemaStoryPhaseFact):MvuSchemaStoryReducerBridge {
  if(first.phase!=='command-parsed'||first.output.kind!=='accepted')fail()
  const input=validateSchemaEvaluationInputV4(first.input)
  if(input.phase!=='command-parsed')fail()
  const output=validateSchemaGuestOutputV4(first.output,input)
  if(output.kind!=='accepted')fail()
  // Native journal already binds this exact output to its execution plan.
  // The bridge consumes the accepted values without applying commands again.
  return sealMvuSchemaStoryFact({schemaVersion:2 as const,encoding:'native-mvu-schema-story-reducer-bridge-v2' as const,
    phaseOutputSha256:recordSha256(first.output),result:reduceMvuUpdateOperationsV2(output.values,[])},'bridgeSha256')
}
function association(value:SchemaExecutionAssociation,plan:MvuSchemaStoryPlan,index:number) {
  const selector=index===3?mvuSchemaStoryReconcileSelector(plan):plan.selectors[index]!
  if(plan.schemaVersion===6||plan.schemaVersion===7||plan.schemaVersion===8||plan.schemaVersion===10||plan.schemaVersion===11||plan.schemaVersion===12) {
    if(value.schemaVersion!==5)fail()
    exact(value,['schemaVersion','encoding','sessionId','realmEpoch','batchId','anchor','sourceNativeCutSha256',
      'combinedProgramSha256','serverProgramSha256','epoch','dispatch','completion','dispatchMarker','completionMarker',
      'serverTailSha256','hostFrontierSha256','outputSha256'])
    if(value.encoding!=='native-author-host-association-v5'||value.sessionId!==selector.sessionId
      ||value.realmEpoch!==plan.realmEpoch||value.combinedProgramSha256!==plan.programSha256
      ||value.serverProgramSha256!==plan.serverProgramSha256||!same(value.epoch,plan.epoch)
      ||value.batchId!==selector.batchId||!same(value.anchor,selector.anchor)
      ||![value.sourceNativeCutSha256,value.serverTailSha256,value.hostFrontierSha256,value.outputSha256].every(hash))fail()
    for(const ref of [value.epoch,value.dispatch,value.completion]) {
      exact(ref,['key','sha256']);if(!id(ref.key,512)||!hash(ref.sha256))fail()
    }
  }else {
    if(value.schemaVersion!==1)fail()
    exact(value,['schemaVersion','encoding','sessionId','realmEpoch','batchId','anchor','sourceNativeCutSha256',
      'programSha256','dispatch','completion','dispatchMarker','completionMarker','tailSha256','frontierSha256','outputSha256'])
    if(value.encoding!=='native-mvu-schema-execution-association-v1'
      ||value.sessionId!==selector.sessionId||value.realmEpoch!==plan.realmEpoch||value.programSha256!==plan.programSha256
      ||value.batchId!==selector.batchId||!same(value.anchor,selector.anchor)
      ||![value.sourceNativeCutSha256,value.tailSha256,value.frontierSha256,value.outputSha256].every(hash))fail()
    for(const ref of [value.dispatch,value.completion]) {
      exact(ref,['key','sha256']);if(!id(ref.key,512)||!hash(ref.sha256))fail()
    }
  }
  for(const marker of [value.dispatchMarker,value.completionMarker]) {
    exact(marker,['seq','sha256']);if(!integer(marker.seq)||!hash(marker.sha256))fail()
  }
  if(value.completionMarker.seq!==value.dispatchMarker.seq+1)fail()
}
export function mvuSchemaStoryReconcileSelector(plan:MvuSchemaStoryPlan):SchemaExecutionSelector {
  return {...plan.selectors[2]!,batchId:`story-${recordSha256({scope:plan.scope,canonical:plan.canonical,
    realmEpoch:plan.realmEpoch})}-hook-reconcile`}
}
export function mvuSchemaStoryReconcileInput(plan:MvuSchemaStoryPlan,previous:MvuSchemaStoryPhaseFact,
  hook:MvuSchemaStoryBrowserHookFact):SchemaEvaluationInput {
  if(hook.result.stage!=='update-ended')fail()
  const {values,context}=mvuSchemaStoryVariableParts(hook.result.output.variables)
  return validateSchemaEvaluationInputV4({...previous.input,
    ...plan.schemaVersion===12?{scopeReadRef:plan.scopeReadRef}:{scopeReadFrame:plan.scopeReadFrame},
    phase:'hook-reconcile',values,context,commands:[]})
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
function validateBrowserExecution(plan:MvuSchemaStoryPlan,phases:readonly MvuSchemaStoryPhaseFact[],
  browser:MvuSchemaStoryBrowserExecutionV1):void {
  exact(browser,['schemaVersion','hooks','finalizedMessage'],['reconcile'])
  if(browser.schemaVersion!==1||!Array.isArray(browser.hooks)||!browser.hooks.length||browser.hooks.length>3
    ||typeof browser.finalizedMessage!=='string'||Buffer.byteLength(browser.finalizedMessage,'utf8')>1048576)fail()
  const names=['command-parsed','update-ended','before-message-update'],seen=new Set<string>()
  let lastStage=-1
  for(const hook of browser.hooks) {
    exact(hook,['schemaVersion','request','result','journal','frontier'])
    const {request,result,journal}=hook,stage=names.indexOf(request.stage)
    if(hook.schemaVersion!==1||stage<=lastStage||seen.has(request.stage)||request.stage!==result.stage
      ||request.sessionId!==plan.base.sessionId||request.planSha256!==plan.planSha256
      ||!same(request.target,{kind:'message',ownerSessionId:plan.base.sessionId,nativeSeq:plan.canonical.seq,
        messageId:plan.canonical.messageId,messageVersionSha256:plan.canonical.versionSha256}))fail()
    lastStage=stage;seen.add(request.stage)
    validateSchemaJournalRecord(journal.dispatch);validateSchemaJournalRecord(journal.completion)
    if(!same(request,journal.dispatch.request)||!same(result,journal.completion.result)
      ||journal.dispatchRef.sha256!==journal.dispatch.recordSha256||journal.completionRef.sha256!==journal.completion.recordSha256
      ||!same(journal.completion.dispatch,journal.dispatchRef)||!same(journal.completion.dispatchMarker,journal.dispatchMarker)
      ||journal.completionMarker.seq<=journal.dispatchMarker.seq||journal.dispatch.realmEpoch!==plan.realmEpoch
      ||journal.dispatch.sourceNativeCut.sourceSnapshotSha256!==plan.currentFrame.snapshotSha256
      ||journal.dispatch.sourceNativeCut.materialSha256!==plan.currentFrame.materialSha256
      ||!same(journal.dispatch.sourceNativeCut.anchor,plan.selectors[0]!.anchor))fail()
    frontier(hook.frontier)
    if(hook.frontier.nativeCut!==journal.completionMarker.seq+1
      ||request.stage==='command-parsed'&&!same(request.payload,{variables:mvuSchemaStoryVariables(plan.base.values,plan.base.context),
        commands:mvuSchemaStoryCommandInfos(plan),message_content:plan.canonical.narrative}))fail()
    if(request.stage==='update-ended') {
      const output=phases[1]?.output
      if(output?.kind!=='accepted'||!same(request.payload,{variables:mvuSchemaStoryVariables(output.values,output.context),
        variables_before_update:mvuSchemaStoryVariables(plan.base.values,plan.base.context)}))fail()
    }
    if(request.stage==='before-message-update') {
      const output=phases[2]?.output
      if(output?.kind!=='accepted'||!same(request.payload,{context:{variables:mvuSchemaStoryVariables(output.values,output.context),
        message_content:plan.canonical.narrative}}))fail()
    }
    mvuSchemaStoryVariableParts(result.stage==='before-message-update'?result.output.context.variables:result.output.variables)
  }
  const ended=browser.hooks.find(hook=>hook.result.stage==='update-ended'),before=browser.hooks.at(-1)!
  const endedChanged=ended?.result.stage==='update-ended'&&phases[1]?.output.kind==='accepted'
    &&!same(mvuSchemaStoryVariableParts(ended.result.output.variables).values,phases[1].output.values)
  if(!!browser.reconcile!==!!endedChanged)fail()
  if(browser.reconcile) {
    const step=browser.reconcile
    association(step.association,plan,3)
    const expected=mvuSchemaStoryReconcileInput(plan,phases[1]!,ended!)
    const captured=step.input.encoding==='native-mvu-author-schema-phase-input-v4-scope-ref-v2'
      ?{...expected,scopeReadRef:step.input.scopeReadRef}:{...expected,scopeReadFrame:step.input.scopeReadFrame}
    if(step.phase!=='hook-reconcile'||!same(step.input,captured))fail()
    validateSchemaGuestOutputV4(step.output,validateSchemaEvaluationInputV4(step.input))
    if(step.output.kind==='refused'&&phases.length!==2)fail()
  }
  if(browser.finalizedMessage!==(before.result.stage==='before-message-update'
    ?before.result.output.context.message_content:plan.canonical.narrative))fail()
  const command=browser.hooks.find(hook=>hook.request.stage==='command-parsed'),
    ending=browser.hooks.find(hook=>hook.request.stage==='update-ended'),
    beforeMessage=browser.hooks.find(hook=>hook.request.stage==='before-message-update')
  const markers=[command?.journal,phases[0]?.association,phases[1]?.association,ending?.journal,
    browser.reconcile?.association,phases[2]?.association,beforeMessage?.journal].filter(item=>item!==undefined)
  let cut=plan.initialCut.nativeCut
  for(const item of markers) {
    if(item.dispatchMarker.seq!==cut||item.completionMarker.seq<=cut)fail()
    cut=item.completionMarker.seq+1
  }
}
export function mvuSchemaStoryEvent(plan:MvuSchemaStoryPlan,phases:readonly MvuSchemaStoryPhaseFact[],
  reducer:MvuSchemaStoryReducerBridge|null,browser?:MvuSchemaStoryBrowserExecutionV1):MvuSchemaStoryEventV2 {
  return storyEvent(plan,phases,reducer,false,browser) as MvuSchemaStoryEventV2
}
export function mvuSchemaStoryRevisionEvent(plan:MvuSchemaStoryRevisionPlanV1,phases:readonly MvuSchemaStoryPhaseFact[],
  reducer:MvuSchemaStoryReducerBridge|null):MvuSchemaStoryRevisionEventV1
export function mvuSchemaStoryRevisionEvent(plan:MvuSchemaStoryRevisionPlanV2|MvuSchemaStoryRevisionPlanV3,phases:readonly MvuSchemaStoryPhaseFact[],
  reducer:MvuSchemaStoryReducerBridge|null):MvuSchemaStoryRevisionEventV2
export function mvuSchemaStoryRevisionEvent(plan:MvuSchemaStoryRevisionPlan,phases:readonly MvuSchemaStoryPhaseFact[],
  reducer:MvuSchemaStoryReducerBridge|null):MvuSchemaStoryRevisionEvent
export function mvuSchemaStoryRevisionEvent(plan:MvuSchemaStoryRevisionPlan,phases:readonly MvuSchemaStoryPhaseFact[],
  reducer:MvuSchemaStoryReducerBridge|null):MvuSchemaStoryRevisionEvent {
  return storyEvent(plan,phases,reducer,true) as MvuSchemaStoryRevisionEvent
}
function storyEvent(plan:MvuSchemaStoryPlan,phases:readonly MvuSchemaStoryPhaseFact[],
  reducer:MvuSchemaStoryReducerBridge|null,revision:boolean,browser?:MvuSchemaStoryBrowserExecutionV1):MvuSchemaStoryEventV2|MvuSchemaStoryRevisionEvent {
  if(!phases.length)fail()
  const last=phases.at(-1)!,guestRefused=last.output.kind==='refused'||browser?.reconcile?.output.kind==='refused',
    refused=guestRefused||reducer?.result.kind==='rejected'
  if(!refused&&phases.length!==3)fail()
  const final=browserFinal(plan,phases,browser)
  const values=refused?plan.base.values:final.values
  const context=refused?plan.base.context:final.context
  const valuesSha256=recordSha256(values),outcome=refused?'refused':valuesSha256===plan.base.valuesSha256?'no-update':'accepted'
  const revisionV2=revision&&(plan.schemaVersion===8||plan.schemaVersion===11),execution=revisionV2?plan.execution:plan.base
  return sealMvuSchemaStoryFact({schemaVersion:revisionV2?2:revision?1:2,
    encoding:revisionV2?'native-mvu-schema-story-revision-event-v2'
      :revision?'native-mvu-schema-story-revision-event-v1':'native-mvu-schema-story-event-v2',
    sessionId:execution.sessionId,sourceSha256:execution.sourceSha256,
    eventId:recordSha256({encoding:revisionV2?'native-mvu-schema-story-revision-event-identity-v2'
      :revision?'native-mvu-schema-story-revision-event-identity-v1':
      'native-mvu-schema-story-event-identity-v2',planSha256:plan.planSha256}),
    plan,phases,reducer,...browser?{browser}:{},outcome,refusal:refused?(guestRefused?'guest' as const:'reducer' as const):null,
    values,valuesSha256,context,frontier:final.frontier},'eventSha256') as
    MvuSchemaStoryEventV2|MvuSchemaStoryRevisionEvent
}
const validateStoryEventDescriptor=createImmutableDescriptorValidator(validateStoryEventUncached)
export function validateMvuSchemaStoryEvent(input:MvuSchemaStoryEventV2):MvuSchemaStoryEventV2 {
  // Settlement rechecks the exact successful immutable event from eventRows.
  // Only pure DATA parsing is reused; current Native/Source/history checks
  // remain with the consumer and settlement still checks its event argument.
  return validateStoryEventDescriptor(input) as MvuSchemaStoryEventV2
}
export function validateMvuSchemaStoryRevisionEvent(input:MvuSchemaStoryRevisionEventV1):MvuSchemaStoryRevisionEventV1
export function validateMvuSchemaStoryRevisionEvent(input:MvuSchemaStoryRevisionEventV2):MvuSchemaStoryRevisionEventV2
export function validateMvuSchemaStoryRevisionEvent(input:MvuSchemaStoryRevisionEvent):MvuSchemaStoryRevisionEvent
export function validateMvuSchemaStoryRevisionEvent(input:MvuSchemaStoryRevisionEvent):MvuSchemaStoryRevisionEvent {
  return validateStoryEventDescriptor(input) as MvuSchemaStoryRevisionEvent
}
function validateStoryEventUncached(input:MvuSchemaStoryEventV2|MvuSchemaStoryRevisionEvent):MvuSchemaStoryEventV2|MvuSchemaStoryRevisionEvent {
  const event=freezeMvuSchemaStoryData(input),plan=validateMvuSchemaStoryPlan(event.plan)
  exact(event,['schemaVersion','encoding','sessionId','sourceSha256','eventId','plan','phases','reducer',
    'outcome','refusal','values','valuesSha256','context','frontier','eventSha256'],['browser'])
  fact(event,'eventSha256')
  if(!Array.isArray(event.phases)||!event.phases.length||event.phases.length>3||plan.candidate.kind==='rejected')fail()
  if(event.browser)validateBrowserExecution(plan,event.phases,event.browser)
  let nextSeq=plan.initialCut.nativeCut
  for(const [index,phase] of event.phases.entries()) {
    exact(phase,['phase','input','association','output'])
    let read:MvuScopeReadFrameV1|undefined
    let reference:MvuScopeReadRefV2|undefined
    if(plan.schemaVersion===12) {
      const input=validateSchemaEvaluationInputV4(phase.input)
      if(input.encoding!=='native-mvu-author-schema-phase-input-v4-scope-ref-v2')fail()
      validateSchemaGuestOutputV4(phase.output,input);reference=input.scopeReadRef
      if(!schemaScopeReadRefFactsEqualV2(reference,plan.scopeReadRef)
        ||reference.sourceNativeCutSha256!==phase.association.sourceNativeCutSha256)fail()
    } else {
      const input=validateSchemaEvaluationInputV4(phase.input)
      if(input.encoding!=='native-mvu-author-schema-phase-input-v4')fail()
      validateSchemaGuestOutputV4(phase.output,input)
      read=input.scopeReadFrame
      if(!schemaScopeReadFactsEqual(read,plan.scopeReadFrame)
        ||read.sourceNativeCutSha256!==phase.association.sourceNativeCutSha256)fail()
    }
    association(phase.association,plan,index)
    if(phase.phase!==MVU_SCHEMA_STORY_PHASES[index]
      ||!event.browser&&(plan.schemaVersion!==7&&plan.schemaVersion!==8&&plan.schemaVersion!==11||index>0)&&phase.association.dispatchMarker.seq!==nextSeq
      ||phase.association.outputSha256!==recordSha256(phase.output)
      ||!same(phase.input,mvuSchemaStoryPhaseInput(plan,index,event.phases,event.reducer,read,reference,event.browser))
      ||phase.output.kind==='refused'&&index!==event.phases.length-1)fail()
    if(index===0&&!event.browser?.hooks.some(hook=>hook.request.stage==='command-parsed')
      &&plan.schemaVersion!==7&&plan.schemaVersion!==8&&plan.schemaVersion!==11
      &&phase.association.sourceNativeCutSha256!==recordSha256(plan.initialCut))fail()
    nextSeq=phase.association.completionMarker.seq+1
  }
  const first=event.phases[0]!
  if(first.output.kind==='accepted') {
    if(!same(event.reducer,mvuSchemaStoryReducerBridge(first)))fail()
    if(event.reducer!.result.kind==='rejected'&&event.phases.length!==1)fail()
  } else if(event.reducer!==null||event.phases.length!==1)fail()
  const revisionV1=event.encoding==='native-mvu-schema-story-revision-event-v1',
    revisionV2=event.encoding==='native-mvu-schema-story-revision-event-v2',revision=revisionV1||revisionV2
  if(revisionV1&&plan.schemaVersion!==7||revisionV2&&plan.schemaVersion!==8&&plan.schemaVersion!==11
    ||!revision&&(plan.schemaVersion===7||plan.schemaVersion===8||plan.schemaVersion===11))fail()
  const last=event.phases.at(-1)!,guestRefused=last.output.kind==='refused'||event.browser?.reconcile?.output.kind==='refused',
    refused=guestRefused||event.reducer?.result.kind==='rejected'
  if(!refused&&event.phases.length!==3)fail()
  const final=browserFinal(plan,event.phases,event.browser)
  const values=refused?plan.base.values:final.values,
    context=refused?plan.base.context:final.context,
    valuesSha256=recordSha256(values)
  // The persisted seal and nested facts are already checked. Correlate only
  // the event's derived fields instead of rebuilding and sealing the full graph.
  exact(event.frontier,['nativeCut','tailSha256','frontierSha256'])
  const execution=plan.schemaVersion===8||plan.schemaVersion===11?plan.execution:plan.base
  if(event.schemaVersion!==(revisionV1?1:2)
    ||event.encoding!==(revisionV2?'native-mvu-schema-story-revision-event-v2'
      :revisionV1?'native-mvu-schema-story-revision-event-v1':'native-mvu-schema-story-event-v2')
    ||event.sessionId!==execution.sessionId||event.sourceSha256!==execution.sourceSha256
    ||event.eventId!==recordSha256({encoding:revisionV2?'native-mvu-schema-story-revision-event-identity-v2'
      :revisionV1?'native-mvu-schema-story-revision-event-identity-v1':
      'native-mvu-schema-story-event-identity-v2',planSha256:plan.planSha256})
    ||event.valuesSha256!==valuesSha256||recordSha256(event.values)!==valuesSha256||!same(event.context,context)
    ||event.outcome!==(refused?'refused':valuesSha256===plan.base.valuesSha256?'no-update':'accepted')
    ||event.refusal!==(refused?(guestRefused?'guest':'reducer'):null)
    ||!same(event.frontier,final.frontier))fail()
  return event
}
export function mvuSchemaStoryRevisionHead(event:MvuSchemaStoryRevisionEventV1):MvuSchemaStoryRevisionHeadV1
export function mvuSchemaStoryRevisionHead(event:MvuSchemaStoryRevisionEventV2):MvuSchemaStoryRevisionHeadV2
export function mvuSchemaStoryRevisionHead(event:MvuSchemaStoryRevisionEvent):MvuSchemaStoryRevisionHead
export function mvuSchemaStoryRevisionHead(event:MvuSchemaStoryRevisionEvent):MvuSchemaStoryRevisionHead {
  if(event.outcome==='refused')fail()
  if(event.schemaVersion===2) {
    return freezeMvuSchemaStoryData({schemaVersion:2,encoding:'native-mvu-schema-story-revision-head-v2',
      sessionId:event.sessionId,sourceSha256:event.sourceSha256,root:event.plan.execution.root,
      revision:event.plan.revision.publicationRevision,eventId:event.eventId,eventSha256:event.eventSha256,
      planSha256:event.plan.planSha256,valuesSha256:event.valuesSha256})
  }
  return freezeMvuSchemaStoryData({schemaVersion:1,encoding:'native-mvu-schema-story-revision-head-v1',
    sessionId:event.sessionId,sourceSha256:event.sourceSha256,root:event.plan.base.root,
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
      :value.encoding!=='native-mvu-schema-story-revision-descriptor-v5')
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
  if(value.schemaVersion===2||value.schemaVersion===3||value.schemaVersion===4||value.schemaVersion===5)
    return validateRevisionDescriptorV2(value)
  exact(value,['schemaVersion','encoding','sessionId','edit','original','previous','baseStateSnapshotSha256',
    'completionSeq','publicationRevision','sourceSha256','descriptorSha256'])
  exact(value.edit,['seq','sha256','targetSeq','messageId','messageVersionSha256','narrativeSha256'])
  exact(value.original,['key','sha256'])
  if(value.previous)exact(value.previous,['key','sha256'])
  fact(value,'descriptorSha256')
  if(value.schemaVersion!==1||value.encoding!=='native-mvu-schema-story-revision-descriptor-v1'
    ||!id(value.sessionId,64)||!integer(value.edit.seq)||!integer(value.edit.targetSeq)
    ||value.edit.targetSeq>=value.edit.seq||!id(value.edit.messageId)||!integer(value.completionSeq)
    ||!integer(value.publicationRevision,2)||!id(value.original.key,512)
    ||value.previous!==null&&(!id(value.previous.key,512)||!hash(value.previous.sha256))
    ||![value.edit.sha256,value.edit.messageVersionSha256,value.edit.narrativeSha256,value.original.sha256,
      value.baseStateSnapshotSha256,value.sourceSha256].every(hash))fail()
  return value
})
export function validateMvuSchemaStoryRevisionDescriptor(input:MvuSchemaStoryRevisionDescriptorV1):MvuSchemaStoryRevisionDescriptorV1
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
