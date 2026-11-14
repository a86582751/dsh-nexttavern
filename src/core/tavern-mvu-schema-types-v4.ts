/** V4 binds every guest output to the actual worker-recomputed execution plan.
 * Native loader descriptors remain provenance and never enter QuickJS. */
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuUpdateOperationV2} from './roleplay-mvu-update-v2.js'
import type {MvuSchemaDiagnostic,MvuSchemaPhase,MvuSchemaRunnerIdentity,
  MvuSchemaRunnerDeps,MvuSchemaRealmReadBinding,MvuSchemaImplementationIdentity} from './tavern-mvu-schema-types.js'
import type {MvuExecutableProgramV4} from './tavern-mvu-owned-state-types-v1.mjs'
import type {MvuSchemaDiagnosticV2} from './tavern-mvu-schema-types-v2.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {MvuScopeReadRefV2,MvuScopeObjectRefV2} from './tavern-mvu-scope-view-v2.js'

export type MvuSchemaDiagnosticV4=MvuSchemaDiagnosticV2
  | {code:'SCHEMA_SCOPE_READ_FAILED';scriptPointer:string;readCode:string}
  | {code:'STATE_ONLY_UPDATE_OPERATION_REJECTED';commandIndex:number;updateCode:string;pointer?:string}
  | {code:'SCHEMA_UPDATE_BATCH_OPERATION_REJECTED';commandIndex:number;updateCode:string;pointer?:string}
  | {code:'SCHEMA_UPDATE_BATCH_VALIDATION_FAILED';registrationIndex:number}
export type MvuSchemaDiscardedDiagnosticV4=Extract<MvuSchemaDiagnosticV2,{commandIndex:number}>
export type MvuSchemaPhaseErrorPolicyV4='atomic-refusal'|'registered-command-policy-v1'|'update-batch-atomic-v1'
interface MvuSchemaEvaluationFieldsV4 {
  schemaVersion:4
  commandsEncoding:'native-mvu-update-operations-v2'
  errorPolicy:MvuSchemaPhaseErrorPolicyV4
  /** external-pack-replacement adopts the owner's exact values/context in the
   * existing realm. Acceptance of that phase does not claim schema parsing. */
  phase:MvuSchemaPhase
  base:MvuJsonObject|null
  values:MvuJsonObject
  commands:readonly MvuUpdateOperationV2[]
  context:MvuJsonObject
  clockEpochMs:number
  randomSeed:string
}
export type MvuSchemaEvaluationInputV4=MvuSchemaEvaluationFieldsV4 & (
  | {encoding:'native-mvu-author-schema-phase-input-v4';scopeReadFrame:MvuScopeReadFrameV1;scopeReadRef?:never}
  | {encoding:'native-mvu-author-schema-phase-input-v4-scope-ref-v2';scopeReadRef:MvuScopeReadRefV2;scopeReadFrame?:never})
interface PhaseOutputV4 {
  schemaVersion:4
  encoding:'native-mvu-author-schema-phase-output-v4'
  commandsEncoding:'native-mvu-update-operations-v2'
  executionPlanSha256:string
}
interface AcceptedPhaseOutputV4 {
  kind:'accepted'
  values:MvuJsonObject
  commands:readonly MvuUpdateOperationV2[]
  context:MvuJsonObject
  registrations:number
}
export type MvuSchemaGuestOutputV4=PhaseOutputV4 & (
  | ({errorPolicy:'atomic-refusal'|'update-batch-atomic-v1'} & (AcceptedPhaseOutputV4
      | {kind:'refused';diagnostics:readonly MvuSchemaDiagnosticV4[]}))
  | ({errorPolicy:'registered-command-policy-v1'} & (
      (AcceptedPhaseOutputV4 & {discarded:readonly MvuSchemaDiscardedDiagnosticV4[]})
      | {kind:'refused';diagnostics:readonly MvuSchemaDiagnosticV4[]})))
export interface MvuSchemaEvaluationV4 {
  schemaVersion:4
  encoding:'native-mvu-author-schema-evaluation-v4'
  programSha256:string
  runner:MvuSchemaRunnerIdentity
  input:MvuSchemaEvaluationInputV4
  inputSha256:string
  output:MvuSchemaGuestOutputV4
  evaluationSha256:string
}
export type MvuSchemaRunResultV4={kind:'evaluated';evaluation:MvuSchemaEvaluationV4}
  | {kind:'unavailable'|'cancelled';diagnostics:readonly MvuSchemaDiagnostic[]}
interface MvuSchemaRealmLoadFieldsV4 extends MvuSchemaRealmReadBinding {
  schemaVersion:4
  values:MvuJsonObject
  context:MvuJsonObject
  clockEpochMs:number
  randomSeed:string
}
export type MvuSchemaRealmLoadFrameV4=MvuSchemaRealmLoadFieldsV4 & (
  | {encoding?:never;scopeReadFrame:MvuScopeReadFrameV1;scopeReadRef?:never}
  | {encoding:'native-mvu-author-schema-realm-load-v4-scope-ref-v2';scopeReadRef:MvuScopeReadRefV2;scopeReadFrame?:never})
export interface MvuSchemaTraceFrameV4 extends MvuSchemaRealmReadBinding {
  input:MvuSchemaEvaluationInputV4
}
export interface MvuSchemaTraceRequestedStepV4 {
  eventId:string
  frame:MvuSchemaTraceFrameV4
}
export interface MvuSchemaTraceStepRecordV4 extends MvuSchemaTraceRequestedStepV4 {
  ordinal:number
  previousStepSha256:string
  output:MvuSchemaGuestOutputV4
  stepSha256:string
}
interface MvuSchemaTraceFieldsV4 {
  schemaVersion:4
  realmEpoch:string
  prefix:readonly MvuSchemaTraceStepRecordV4[]
  requestedStep:MvuSchemaTraceRequestedStepV4
}
export type MvuSchemaTraceInputV4=MvuSchemaTraceFieldsV4 & (
  | {encoding:'native-mvu-author-schema-trace-input-v4';loadFrame:Extract<MvuSchemaRealmLoadFrameV4,{encoding?:never}>}
  | {encoding:'native-mvu-author-schema-trace-input-v4-scope-ref-v2';
      loadFrame:MvuSchemaRealmLoadFrameV4})
/** Process-private checked history owned by the trusted Host. This interface
 * is not a wire receipt and cannot be supplied by a trace DTO or its flags. */
export interface MvuSchemaOwnedPrefixV4 {
  readonly programSha256:string
  readonly realmEpoch:string
  readonly loadAnchorSha256:string
  readonly length:number
  readonly tailSha256:string
  hasEvent(eventId:string):boolean
  materialize():readonly MvuSchemaTraceStepRecordV4[]
}
export type MvuSchemaOwnedPrefixReaderV4=(input:MvuSchemaTraceInputV4)=>MvuSchemaOwnedPrefixV4|undefined
/** Host-private closed-object access, never a field on persisted trace DATA. */
export type MvuSchemaScopeReferenceReaderV2=(ref:MvuScopeObjectRefV2)=>unknown
export type MvuSchemaTraceEvaluationStepV4=Omit<MvuSchemaTraceStepRecordV4,'frame'> & {frameSha256:string}
export type MvuSchemaTraceCompactStepRecordV4=MvuSchemaTraceEvaluationStepV4
export interface MvuSchemaTraceEvaluationV4 {
  schemaVersion:4
  encoding:'native-mvu-author-schema-trace-evaluation-v4'
  programSha256:string
  runner:MvuSchemaRunnerIdentity
  input:MvuSchemaTraceInputV4
  inputSha256:string
  records:readonly MvuSchemaTraceEvaluationStepV4[]
  evaluationSha256:string
}
export type MvuSchemaTraceRunResultV4={kind:'evaluated-trace';evaluation:MvuSchemaTraceEvaluationV4}
  | {kind:'unavailable'|'cancelled';diagnostics:readonly MvuSchemaDiagnostic[]}
export type MvuSchemaNextRunResultV4={kind:'evaluated-next';record:MvuSchemaTraceCompactStepRecordV4}
  | {kind:'unavailable'|'cancelled';diagnostics:readonly MvuSchemaDiagnostic[]}
/** Fresh Native phase DATA for one already-owned manual operation. The live
 * resource keeps program, historical prefix and current material privately. */
export interface MvuSchemaManualRequestedStepV4 {
  eventId:string
  frame:{ownerSessionId:string;sourceNativeCutSha256:string;input:MvuSchemaEvaluationInputV4}
}
export interface MvuSchemaManualRunV4 {
  advance(step:MvuSchemaManualRequestedStepV4,signal?:AbortSignal):Promise<MvuSchemaNextRunResultV4>
  /** Resolves only after all VM cleanup and actual Worker termination. An
   * unknown cleanup/termination outcome rejects and cannot authorize publish. */
  close():Promise<void>
}
export type MvuSchemaOpenManualRunResultV4={kind:'opened-manual-run';run:MvuSchemaManualRunV4;
  record:MvuSchemaTraceCompactStepRecordV4}
  | {kind:'unavailable'|'cancelled';diagnostics:readonly MvuSchemaDiagnostic[]}
export interface MvuSchemaRunnerV4 {
  readonly identity:MvuSchemaRunnerIdentity
  readonly scopeInputProtocols?:readonly ('full-frame-v1'|'scope-ref-v2')[]
  bindScopeReferencesV2?(read:MvuSchemaScopeReferenceReaderV2):MvuSchemaRunnerV4
  evaluate(program:MvuExecutableProgramV4,input:MvuSchemaEvaluationInputV4,signal?:AbortSignal):Promise<MvuSchemaRunResultV4>
  verifyEvaluation(program:MvuExecutableProgramV4,evaluation:MvuSchemaEvaluationV4,signal?:AbortSignal):Promise<boolean>
  evaluateTrace(program:MvuExecutableProgramV4,input:MvuSchemaTraceInputV4,signal?:AbortSignal):Promise<MvuSchemaTraceRunResultV4>
  /** Program comes from the compiler or Journal's first parser; this entry owns the trace's first parsing. */
  evaluateNext?(program:MvuExecutableProgramV4,input:MvuSchemaTraceInputV4,signal?:AbortSignal):Promise<MvuSchemaNextRunResultV4>
  /** Trusted Host assembly only. Raw evaluateNext always parses full DATA;
   * this callback owns exact-trace association across component bundles. */
  bindOwnedNext?(reader:MvuSchemaOwnedPrefixReaderV4):{
    evaluateNext(program:MvuExecutableProgramV4,input:MvuSchemaTraceInputV4,signal?:AbortSignal):Promise<MvuSchemaNextRunResultV4>
  }
  /** Additive live-operation entry; previous protected factories keep their
   * exact cold ABI and do not gain a live resource through stored DATA. */
  openManualRun?(program:MvuExecutableProgramV4,input:MvuSchemaTraceInputV4,signal?:AbortSignal):Promise<MvuSchemaOpenManualRunResultV4>
  verifyTrace(program:MvuExecutableProgramV4,evaluation:MvuSchemaTraceEvaluationV4,signal?:AbortSignal):Promise<boolean>
  dispose():Promise<void>
}
export interface MvuSchemaRunnerDepsV4 extends MvuSchemaRunnerDeps {
  /** Trusted provider identity, never an author or stored-plan capability. */
  stateLoader:MvuSchemaImplementationIdentity
  /** Internal protected-provider seam, immediately before loading Worker bytes. */
  readonly beforeWorkerLoad?:()=>void
}
