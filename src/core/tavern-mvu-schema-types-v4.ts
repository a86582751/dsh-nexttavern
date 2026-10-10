/** V4 binds every guest output to the actual worker-recomputed execution plan.
 * Native loader descriptors remain provenance and never enter QuickJS. */
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuUpdateOperationV2} from './roleplay-mvu-update-v2.js'
import type {MvuSchemaDiagnostic,MvuSchemaPhase,MvuSchemaRunnerIdentity,
  MvuSchemaRunnerDeps,MvuSchemaRealmReadBinding,MvuSchemaImplementationIdentity} from './tavern-mvu-schema-types.js'
import type {MvuSchemaProgramV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaDiagnosticV2} from './tavern-mvu-schema-types-v2.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'

export type MvuSchemaDiagnosticV4=MvuSchemaDiagnosticV2
  | {code:'SCHEMA_SCOPE_READ_FAILED';scriptPointer:string;readCode:string}
  | {code:'STATE_ONLY_UPDATE_OPERATION_REJECTED';commandIndex:number;updateCode:string;pointer?:string}
export type MvuSchemaDiscardedDiagnosticV4=Extract<MvuSchemaDiagnosticV2,{commandIndex:number}>
export type MvuSchemaPhaseErrorPolicyV4='atomic-refusal'|'registered-command-policy-v1'
export interface MvuSchemaEvaluationInputV4 {
  schemaVersion:4
  encoding:'native-mvu-author-schema-phase-input-v4'
  commandsEncoding:'native-mvu-update-operations-v2'
  errorPolicy:MvuSchemaPhaseErrorPolicyV4
  phase:MvuSchemaPhase
  base:MvuJsonObject|null
  values:MvuJsonObject
  commands:readonly MvuUpdateOperationV2[]
  context:MvuJsonObject
  scopeReadFrame:MvuScopeReadFrameV1
  clockEpochMs:number
  randomSeed:string
}
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
  | ({errorPolicy:'atomic-refusal'} & (AcceptedPhaseOutputV4
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
export interface MvuSchemaRealmLoadFrameV4 extends MvuSchemaRealmReadBinding {
  schemaVersion:4
  values:MvuJsonObject
  context:MvuJsonObject
  scopeReadFrame:MvuScopeReadFrameV1
  clockEpochMs:number
  randomSeed:string
}
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
export interface MvuSchemaTraceInputV4 {
  schemaVersion:4
  encoding:'native-mvu-author-schema-trace-input-v4'
  realmEpoch:string
  loadFrame:MvuSchemaRealmLoadFrameV4
  prefix:readonly MvuSchemaTraceStepRecordV4[]
  requestedStep:MvuSchemaTraceRequestedStepV4
}
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
  evaluate(program:MvuSchemaProgramV4,input:MvuSchemaEvaluationInputV4,signal?:AbortSignal):Promise<MvuSchemaRunResultV4>
  verifyEvaluation(program:MvuSchemaProgramV4,evaluation:MvuSchemaEvaluationV4,signal?:AbortSignal):Promise<boolean>
  evaluateTrace(program:MvuSchemaProgramV4,input:MvuSchemaTraceInputV4,signal?:AbortSignal):Promise<MvuSchemaTraceRunResultV4>
  /** Program comes from the compiler or Journal's first parser; this entry owns the trace's first parsing. */
  evaluateNext?(program:MvuSchemaProgramV4,input:MvuSchemaTraceInputV4,signal?:AbortSignal):Promise<MvuSchemaNextRunResultV4>
  /** Additive live-operation entry; previous protected factories keep their
   * exact cold ABI and do not gain a live resource through stored DATA. */
  openManualRun?(program:MvuSchemaProgramV4,input:MvuSchemaTraceInputV4,signal?:AbortSignal):Promise<MvuSchemaOpenManualRunResultV4>
  verifyTrace(program:MvuSchemaProgramV4,evaluation:MvuSchemaTraceEvaluationV4,signal?:AbortSignal):Promise<boolean>
  dispose():Promise<void>
}
export interface MvuSchemaRunnerDepsV4 extends MvuSchemaRunnerDeps {
  /** Trusted provider identity, never an author or stored-plan capability. */
  stateLoader:MvuSchemaImplementationIdentity
}
