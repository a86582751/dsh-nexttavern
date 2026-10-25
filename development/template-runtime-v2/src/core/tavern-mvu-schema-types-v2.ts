/** V2 phase receipts describe deterministic execution, never Source authority.
 * Programs/compiler identities stay on their original ABI; every execution
 * envelope explicitly names the atomic v2 command protocol. */
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuUpdateOperationV2} from './roleplay-mvu-update-v2.js'
import type {MvuSchemaDiagnostic,MvuSchemaPhase,MvuSchemaProgram,MvuSchemaRunnerIdentity,
  MvuSchemaRunnerDeps,MvuSchemaRealmReadBinding} from './tavern-mvu-schema-types.js'

export type MvuSchemaDiagnosticV2=
  | {code:'SCHEMA_VALIDATION_FAILED';registrationIndex:number}
  | {code:'SCHEMA_VALIDATION_FAILED';commandIndex:number;failedRegistrationIndexes:readonly number[]}
  | {code:'SCHEMA_UPDATE_OPERATION_REJECTED';commandIndex:number;registrationIndex:number;
      updateCode:string;pointer?:string}

export interface MvuSchemaEvaluationInputV2 {
  schemaVersion:2
  encoding:'native-mvu-author-schema-phase-input-v2'
  commandsEncoding:'native-mvu-update-operations-v2'
  errorPolicy:'atomic-refusal'
  phase:MvuSchemaPhase
  base:MvuJsonObject|null
  values:MvuJsonObject
  commands:readonly MvuUpdateOperationV2[]
  context:MvuJsonObject
  clockEpochMs:number
  randomSeed:string
}
interface PhaseOutputV2 {
  schemaVersion:2
  encoding:'native-mvu-author-schema-phase-output-v2'
  commandsEncoding:'native-mvu-update-operations-v2'
  errorPolicy:'atomic-refusal'
}
export type MvuSchemaGuestOutputV2=PhaseOutputV2 & (
  | {kind:'accepted';values:MvuJsonObject;commands:readonly MvuUpdateOperationV2[];
      context:MvuJsonObject;registrations:number}
  | {kind:'refused';diagnostics:readonly MvuSchemaDiagnosticV2[]})

export interface MvuSchemaEvaluationV2 {
  schemaVersion:2
  encoding:'native-mvu-author-schema-evaluation-v2'
  programSha256:string
  runner:MvuSchemaRunnerIdentity
  input:MvuSchemaEvaluationInputV2
  inputSha256:string
  output:MvuSchemaGuestOutputV2
  evaluationSha256:string
}
export type MvuSchemaRunResultV2={kind:'evaluated';evaluation:MvuSchemaEvaluationV2}
  | {kind:'unavailable'|'cancelled';diagnostics:readonly MvuSchemaDiagnostic[]}

export interface MvuSchemaRealmLoadFrameV2 extends MvuSchemaRealmReadBinding {
  schemaVersion:2
  values:MvuJsonObject
  context:MvuJsonObject
  clockEpochMs:number
  randomSeed:string
}
export interface MvuSchemaTraceFrameV2 extends MvuSchemaRealmReadBinding {
  input:MvuSchemaEvaluationInputV2
}
export interface MvuSchemaTraceRequestedStepV2 {
  eventId:string
  frame:MvuSchemaTraceFrameV2
}
export interface MvuSchemaTraceStepRecordV2 extends MvuSchemaTraceRequestedStepV2 {
  ordinal:number
  previousStepSha256:string
  output:MvuSchemaGuestOutputV2
  stepSha256:string
}
export interface MvuSchemaTraceInputV2 {
  schemaVersion:2
  encoding:'native-mvu-author-schema-trace-input-v2'
  realmEpoch:string
  loadFrame:MvuSchemaRealmLoadFrameV2
  prefix:readonly MvuSchemaTraceStepRecordV2[]
  requestedStep:MvuSchemaTraceRequestedStepV2
}
export type MvuSchemaTraceEvaluationStepV2=Omit<MvuSchemaTraceStepRecordV2,'frame'> & {frameSha256:string}
export interface MvuSchemaTraceEvaluationV2 {
  schemaVersion:2
  encoding:'native-mvu-author-schema-trace-evaluation-v2'
  programSha256:string
  runner:MvuSchemaRunnerIdentity
  input:MvuSchemaTraceInputV2
  inputSha256:string
  records:readonly MvuSchemaTraceEvaluationStepV2[]
  evaluationSha256:string
}
export type MvuSchemaTraceRunResultV2={kind:'evaluated-trace';evaluation:MvuSchemaTraceEvaluationV2}
  | {kind:'unavailable'|'cancelled';diagnostics:readonly MvuSchemaDiagnostic[]}
export interface MvuSchemaRunnerV2 {
  readonly identity:MvuSchemaRunnerIdentity
  evaluate(program:MvuSchemaProgram,input:MvuSchemaEvaluationInputV2,signal?:AbortSignal):Promise<MvuSchemaRunResultV2>
  verifyEvaluation(program:MvuSchemaProgram,evaluation:MvuSchemaEvaluationV2,signal?:AbortSignal):Promise<boolean>
  evaluateTrace(program:MvuSchemaProgram,input:MvuSchemaTraceInputV2,signal?:AbortSignal):Promise<MvuSchemaTraceRunResultV2>
  verifyTrace(program:MvuSchemaProgram,evaluation:MvuSchemaTraceEvaluationV2,signal?:AbortSignal):Promise<boolean>
  dispose():Promise<void>
}
export type MvuSchemaRunnerDepsV2=MvuSchemaRunnerDeps
