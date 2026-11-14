/** Opening packs retain their author metadata independently from the actual
 * schema closure. Only a completed canonical phase advances numerical state. */
import {recordSha256} from './roleplay-data.js'
import {freezeMvuSchemaStoryData,sealMvuSchemaStoryFact,validateMvuSchemaNumericalSnapshot}
  from './roleplay-mvu-schema-story-types.js'
import {createImmutableDescriptorValidator} from './roleplay-mvu-schema-descriptor-data.js'
import {validateSchemaSourceCut} from './roleplay-mvu-schema-journal.js'
import {validateSchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import {validateSchemaEvaluationInputV4,validateSchemaGuestOutputV4} from './tavern-mvu-schema-runner-v4.js'
import {schemaExecutionServerTailSha256,schemaExecutionHostFrontierSha256}
  from './roleplay-mvu-schema-replay.js'
import type {OpeningSource} from './roleplay-opening-selection.js'
import type {AuthorNativeHelperSnapshotV1} from './author-native-helper-types.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {SchemaJournalRef,SourceNativeCutFacts} from './roleplay-mvu-schema-journal.js'
import type {SchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import type {SchemaEvaluationInput,SchemaGuestOutput} from './roleplay-mvu-schema-executor-types.js'
import type {SchemaExecutionAssociation,SchemaExecutionSelector} from './roleplay-mvu-schema-replay.js'
import type {MvuSchemaNumericalSnapshotV2,MvuSchemaOpeningVariantHeadV1,MvuSchemaStoryFrontier}
  from './roleplay-mvu-schema-story-types.js'

export interface OpeningVariantEntryV1 {
  readonly id:string
  readonly index:number
  readonly renderedSha256:string
  readonly pack:MvuJsonObject|null
  readonly continuation:SchemaJournalRef|null
}
export interface OpeningVariantMessageV1 {
  readonly ownerSessionId:string
  readonly nativeSeq:number
  readonly messageId:string
  readonly messageVersionSha256:string
}
/** A live author producer supplies the actual message read it owns. Reader
 * documents and helper realms use the same writer without inventing a regex
 * carrier or borrowing another producer's permission. */
export interface AuthorOpeningVariantCaptureV1 {
  readonly binding:{readonly sessionId:string}
  readonly snapshot:Pick<AuthorNativeHelperSnapshotV1,'readRevision'|'numerical'|'messages'>
  readonly openingMessage:{readonly seq:number;readonly messageId:string;readonly messageVersionSha256:string}
  current():boolean
  sourceCurrent():boolean
}
export interface OpeningVariantMessageMutationV1 {
  readonly message_id:number
  readonly swipes_data?:readonly (MvuJsonObject|null)[]
  readonly swipe_id?:number
}
export interface OpeningVariantMutationRequestV1 {
  readonly operationId:string
  readonly readRevision:number
  readonly rows:readonly OpeningVariantMessageMutationV1[]
  readonly refresh:'none'|'affected'|'all'
}
export interface OpeningVariantSetV1 {
  readonly schemaVersion:1
  readonly encoding:'native-opening-variant-set-v1'
  readonly source:OpeningSource
  readonly opening:OpeningVariantMessageV1
  readonly operationId:string
  readonly entries:readonly OpeningVariantEntryV1[]
  readonly setSha256:string
}
export interface OpeningVariantReplacementPlanV1 {
  readonly schemaVersion:1
  readonly encoding:'native-opening-variant-replacement-plan-v1'
  readonly sessionId:string
  readonly operationId:string
  readonly requestSha256:string
  readonly base:MvuSchemaNumericalSnapshotV2
  readonly currentFrame:SchemaStorySourceFrame
  readonly initialCut:SourceNativeCutFacts
  readonly realmEpoch:string
  readonly programSha256:string
  readonly epoch:SchemaJournalRef
  readonly serverProgramSha256:string
  readonly setRef:SchemaJournalRef
  readonly activeVariantId:string
  readonly message:OpeningVariantMessageV1
  readonly input:SchemaEvaluationInput
  readonly planSha256:string
}
export interface OpeningVariantReplacementPhaseV1 {
  readonly phase:'external-pack-replacement'
  readonly input:SchemaEvaluationInput
  readonly association:SchemaExecutionAssociation
  readonly output:Extract<SchemaGuestOutput,{kind:'accepted'}>
}
export interface OpeningVariantReplacementEventV1 {
  readonly schemaVersion:1
  readonly encoding:'native-opening-variant-replacement-event-v1'
  readonly sessionId:string
  readonly sourceSha256:string
  readonly revision:number
  readonly eventId:string
  readonly plan:OpeningVariantReplacementPlanV1
  readonly phases:readonly [OpeningVariantReplacementPhaseV1]
  readonly outcome:'accepted'
  readonly values:MvuJsonObject
  readonly valuesSha256:string
  readonly context:MvuJsonObject
  readonly frontier:MvuSchemaStoryFrontier
  readonly eventSha256:string
}
const same=(left:unknown,right:unknown)=>left===right||recordSha256(left)===recordSha256(right)
const fail=():never=>{throw Error('OPENING_VARIANT_REPLACEMENT_INVALID')}
export const openingVariantSetKey=(sid:string,sha256:string)=>`${sid}__opening-variant-set-${sha256}`
export const openingVariantReplacementPlanKey=(sid:string,id:string)=>`${sid}__opening-variant-plan-${id}`
export const openingVariantReplacementEventKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-opening-variant-event-${id}`
export const openingVariantReplacementCompletionKey=(sid:string,id:string)=>`${sid}__opening-variant-completion-${id}`
export const openingVariantPendingKey=(sid:string)=>`${sid}__opening-variant-pending`
export const validateOpeningVariantSet=createImmutableDescriptorValidator((input:OpeningVariantSetV1)=>{
  const set=freezeMvuSchemaStoryData(input),{setSha256,...body}=set
  if(set.schemaVersion!==1||set.encoding!=='native-opening-variant-set-v1'||recordSha256(body)!==setSha256)fail()
  return set
})
export function openingVariantReplacementSelector(plan:OpeningVariantReplacementPlanV1):SchemaExecutionSelector {
  return {sessionId:plan.sessionId,batchId:'opening-pack-'+plan.planSha256,anchor:plan.initialCut.anchor}
}
const validatePlan=createImmutableDescriptorValidator((input:OpeningVariantReplacementPlanV1)=>{
  const plan=freezeMvuSchemaStoryData(input),{planSha256,...body}=plan
  const base=validateMvuSchemaNumericalSnapshot(plan.base),cut=validateSchemaSourceCut(plan.initialCut),
    phase=validateSchemaEvaluationInputV4(plan.input)
  validateSchemaStorySourceFrame(plan.currentFrame)
  if(plan.schemaVersion!==1||plan.encoding!=='native-opening-variant-replacement-plan-v1'
    ||recordSha256(body)!==planSha256||plan.sessionId!==base.sessionId
    ||plan.realmEpoch!==base.root.realmEpoch||plan.programSha256!==base.root.programSha256
    ||cut.sessionId!==plan.sessionId||cut.ownerSessionId!==plan.sessionId
    ||plan.currentFrame.sessionId!==plan.sessionId||cut.nativeCut<base.schemaFrontier.nativeCut
    ||cut.sourceSnapshotSha256!==plan.currentFrame.snapshotSha256
    ||cut.materialSha256!==plan.currentFrame.materialSha256||cut.anchor.kind!=='manual'
    ||cut.anchor.operationId!==plan.operationId||cut.anchor.requestSha256!==plan.requestSha256
    ||cut.anchor.observedNativeSeq!==cut.nativeCut-1||phase.phase!=='external-pack-replacement'
    ||phase.commands.length||!same(phase.base,base.values))fail()
  const scope=phase.scopeReadRef??phase.scopeReadFrame
  if(scope.sourceNativeCutSha256!==recordSha256(cut))fail()
  return plan
})
export const validateOpeningVariantReplacementPlan=validatePlan
export function openingVariantReplacementHead(event:OpeningVariantReplacementEventV1):MvuSchemaOpeningVariantHeadV1 {
  return {schemaVersion:1,encoding:'native-mvu-opening-variant-head-v1',sessionId:event.sessionId,
    sourceSha256:event.sourceSha256,root:event.plan.base.root,revision:event.revision,eventId:event.eventId,
    eventSha256:event.eventSha256,planSha256:event.plan.planSha256,valuesSha256:event.valuesSha256}
}
export function openingVariantReplacementCompletion(event:OpeningVariantReplacementEventV1) {
  return sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-opening-variant-replacement-completion-v1' as const,
    sessionId:event.sessionId,operationId:event.plan.operationId,planSha256:event.plan.planSha256,
    event:{key:openingVariantReplacementEventKey(event.sessionId,event.eventId),sha256:recordSha256(event)},
    setRef:event.plan.setRef,activeVariantId:event.plan.activeVariantId},'completionSha256')
}
export function openingVariantReplacementEvent(plan:OpeningVariantReplacementPlanV1,
  phase:OpeningVariantReplacementPhaseV1):OpeningVariantReplacementEventV1 {
  const output=phase.output,association=phase.association
  return sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-opening-variant-replacement-event-v1' as const,
    sessionId:plan.sessionId,sourceSha256:plan.base.sourceSha256,revision:plan.base.revision+1,
    eventId:recordSha256({encoding:'opening-variant-replacement-event-identity-v1',planSha256:plan.planSha256}),
    plan,phases:[phase] as const,outcome:'accepted' as const,values:output.values,
    valuesSha256:recordSha256(output.values),context:output.context,
    frontier:{nativeCut:association.completionMarker.seq+1,tailSha256:schemaExecutionServerTailSha256(association),
      frontierSha256:schemaExecutionHostFrontierSha256(association)}},'eventSha256')
}
export const validateOpeningVariantReplacementEvent=createImmutableDescriptorValidator(
  (input:OpeningVariantReplacementEventV1)=>{
    const event=freezeMvuSchemaStoryData(input),plan=validatePlan(event.plan),phase=event.phases[0],
      {eventSha256,...body}=event
    if(event.schemaVersion!==1||event.encoding!=='native-opening-variant-replacement-event-v1'
      ||event.phases.length!==1||phase?.phase!=='external-pack-replacement'
      ||!same(phase.input,plan.input)||phase.output.kind!=='accepted')fail()
    validateSchemaGuestOutputV4(phase.output,phase.input)
    const association=phase.association,selector=openingVariantReplacementSelector(plan)
    if(association.sessionId!==plan.sessionId||association.realmEpoch!==plan.realmEpoch
      ||association.batchId!==selector.batchId||!same(association.anchor,selector.anchor)
      ||association.sourceNativeCutSha256!==recordSha256(plan.initialCut)
      ||!same(phase.output.values,plan.input.values)||!same(phase.output.context,plan.input.context)
      ||recordSha256(body)!==eventSha256||event.sessionId!==plan.sessionId
      ||event.sourceSha256!==plan.base.sourceSha256||event.revision!==plan.base.revision+1
      ||event.eventId!==recordSha256({encoding:'opening-variant-replacement-event-identity-v1',planSha256:plan.planSha256})
      ||event.outcome!=='accepted'||!same(event.values,phase.output.values)
      ||event.valuesSha256!==recordSha256(phase.output.values)||!same(event.context,phase.output.context)
      ||event.frontier.nativeCut!==association.completionMarker.seq+1
      ||event.frontier.tailSha256!==schemaExecutionServerTailSha256(association)
      ||event.frontier.frontierSha256!==schemaExecutionHostFrontierSha256(association))fail()
    return event
  })
