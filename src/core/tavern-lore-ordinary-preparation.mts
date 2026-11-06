/** Actual Source template preparation DATA. This packet belongs to one render
 * audit and never supplies an author, numerical or Ruby-completion authority. */
import {recordSha256} from './roleplay-data.js'
import {freezeLoreData,LORE_EVALUATOR_POLICY_V1} from './tavern-lore-snapshot.mjs'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {refuse} from './tavern-lore-match.mjs'
import type {TavernLoreTemplateActivationV1} from './tavern-lore-evaluator-types.mjs'
import type {TavernLorePlanV1} from './tavern-lore-plan-types.mjs'
import type {TavernEjsHostOutput,TavernEjsResource} from './tavern-template-ejs-host-types.mjs'
import type {TavernEjsRuntimeIdentity} from './tavern-template-ejs-runtime-types.mjs'
import type {TavernTemplateReadV1} from './tavern-template-types.mjs'

export const TAVERN_LORE_ORDINARY_PREPARATION_POLICY_V1=Object.freeze({schemaVersion:1,
  encoding:'owned-st-lore-ordinary-source-policy-v1',order:'actual-source-reverse-before-selection',
  programs:'actual-source-clean-body-and-private-async-IIFE',
  preprocessing:'one-content-then-each-own-primary-and-secondary-key-serial',
  sourceRegex:'getwi-captured-cut; preprocessing-actual-staged-cut; no-generate-loader-source-pass',
  force:'own-eligible-source-enable; native-budget-timed-groups-retained',
  exclusion:'condition-and-dont-activate-win; disabled-activation-refused',
  provenance:'same-material-render-audit-indices; no-derived-completion-authority'})
export const TAVERN_LORE_ORDINARY_PREPARATION_POLICY_SHA256=recordSha256(TAVERN_LORE_ORDINARY_PREPARATION_POLICY_V1)

export interface TavernLoreOrdinarySourceContentReferenceV1 {
  readonly kind:'ordinary-prepared-source-text'
  /** Stable across attempts, so unchanged effective semantics retain timers. */
  readonly pointer:string
  readonly contentSha256:string
  readonly currentNative?:never
}

export interface TavernLoreOrdinaryPreparedTextV1 {
  readonly text:string
  readonly textSha256:string
  /** Index into this material's existing render.audit().executions. */
  readonly executionIndex:number
}
export interface TavernLoreOrdinaryFormalChangeV1 {
  /** The enclosing compiler/Source identity owns the complete entry ref. */
  readonly entryId:string
  readonly ordinal:number
  readonly condition?:{readonly executionIndex:number}
  readonly admission?:'condition-excluded'|'dont-activate'|'force-enabled'
  readonly forceActivation?:true
  readonly program?:{
    readonly bodyOffset:number
    readonly contentSha256:string
    readonly private:boolean
  }
  readonly preprocessed?:{
    readonly body:TavernLoreOrdinaryPreparedTextV1
    readonly primaryKeys:readonly TavernLoreOrdinaryPreparedTextV1[]
    readonly secondaryKeys:readonly TavernLoreOrdinaryPreparedTextV1[]
  }
}
export interface TavernLoreOrdinaryPreparationV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-st-lore-ordinary-preparation-v1'
  readonly sourceSnapshotSha256:string
  readonly compilerPlanSha256:string
  readonly phaseId:string
  readonly snapshotSha256:string
  readonly changes:readonly TavernLoreOrdinaryFormalChangeV1[]
  readonly activationProposals:readonly TavernLoreTemplateActivationV1[]
  readonly preparationSha256:string
}

/** Readonly dialogue restores its frozen prompt and task result, never a VM.
 * Keep actual prepass facts without another copy of its book/history capture. */
export interface TavernLoreOrdinaryExecutionEvidenceV1 {
  readonly schemaVersion:1
  readonly encoding:'author-dialog-ordinary-preparation-evidence-v1'
  readonly policySha256:string
  readonly source:TavernLorePlanV1['source']
  readonly preparation:TavernLoreOrdinaryPreparationV1
  readonly entries:readonly {
    readonly entryId:string
    readonly ordinal:number
    readonly sourcePointer:string
    readonly rawEntrySha256:string
    readonly contentPointer:string
    readonly contentSha256:string
  }[]
  readonly executions:readonly {
    readonly executionIndex:number
    readonly kind:'program-literal'|'protected-ejs-runtime'
    readonly resource:Pick<TavernEjsResource,'id'|'sourcePointer'|'sourceSnapshotSha256'|'contentSha256'>
    readonly snapshotSha256:string
    readonly engineIndex?:number
    readonly ordinaryField?:{readonly phaseId:string;readonly entryId:string;readonly field:string}
    readonly macroProjectionSha256?:string
    readonly output:{readonly kind:'prepared-text';readonly entryId:string;
      readonly field:'body'|'primaryKeys'|'secondaryKeys';readonly index?:number}
      |{readonly kind:'condition';readonly passed:boolean;readonly outputSha256?:string}
    readonly reads?:readonly TavernTemplateReadV1[]
    readonly resourceReads?:TavernEjsHostOutput['resourceReads']
    readonly ordinaryReadFacts?:Pick<TavernEjsHostOutput,
      'ordinaryRoot'|'ordinaryReads'|'ordinaryReadAll'|'ordinaryMessageReads'>
  }[]
  readonly engines:readonly TavernEjsRuntimeIdentity[]
}

/** Only the actual prepass calls this after collecting its real output refs.
 * Consumers reuse the packet; they do not rehash its unchanged Source book. */
export function sealTavernLoreOrdinaryPreparationV1(
  body:Omit<TavernLoreOrdinaryPreparationV1,'preparationSha256'>):TavernLoreOrdinaryPreparationV1 {
  return freezeLoreData({...body,preparationSha256:recordSha256(body)})
}

/** The untyped replay boundary owns this one bounded packet parse. Hot
 * composition receives the renderer's frozen result directly. */
export function validateTavernLoreOrdinaryPreparationV1(input:unknown,plan:TavernLorePlanV1)
  :TavernLoreOrdinaryPreparationV1 {
  const packet=cloneRoleplayTavernLoreDataV1(input,LORE_EVALUATOR_POLICY_V1.bounds.snapshotBytes,
    {nodes:100000,depth:48}) as unknown as TavernLoreOrdinaryPreparationV1
  if(!packet||packet.schemaVersion!==1||packet.encoding!=='owned-st-lore-ordinary-preparation-v1'
    ||packet.compilerPlanSha256!==plan.planSha256||packet.sourceSnapshotSha256!==plan.source.sourceSnapshotSha256
    ||typeof packet.phaseId!=='string'||typeof packet.snapshotSha256!=='string'
    ||!Array.isArray(packet.changes)||!Array.isArray(packet.activationProposals))refuse('LORE_ORDINARY_PREPARATION_INVALID')
  const {preparationSha256,...body}=packet
  if(recordSha256(body)!==preparationSha256)refuse('LORE_ORDINARY_PREPARATION_HASH')
  for(const change of packet.changes)if(plan.entries[change.ordinal]?.entryId!==change.entryId)
    refuse('LORE_ORDINARY_SOURCE_CHANGED',change.entryId)
  return freezeLoreData(packet)
}
