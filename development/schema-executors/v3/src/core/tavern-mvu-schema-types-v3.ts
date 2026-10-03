/** V3 keeps atomic v2 updates and adds a separately sealed published-scope
 * read view. Candidate values stay explicit event data; ordinary getters do
 * not consult a mutable host or silently substitute the candidate. */
import type {MvuJsonObject} from './tavern-mvu-json-types-v3.js'
import type {MvuUpdateOperationV2} from './roleplay-mvu-update-v2.js'
import type {MvuSchemaDiagnostic,MvuSchemaPhase,MvuSchemaProgram,MvuSchemaRunnerIdentity,
  MvuSchemaRunnerDeps,MvuSchemaRealmReadBinding} from './tavern-mvu-schema-types.js'
import type {MvuSchemaDiagnosticV2} from './tavern-mvu-schema-types-v2.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'

export type MvuSchemaDiagnosticV3=MvuSchemaDiagnosticV2
  | {code:'SCHEMA_SCOPE_READ_FAILED';scriptPointer:string;readCode:string}
export interface MvuSchemaEvaluationInputV3 {
  schemaVersion:3
  encoding:'native-mvu-author-schema-phase-input-v3'
  commandsEncoding:'native-mvu-update-operations-v2'
  errorPolicy:'atomic-refusal'
  phase:MvuSchemaPhase
  base:MvuJsonObject|null
  values:MvuJsonObject
  commands:readonly MvuUpdateOperationV2[]
  context:MvuJsonObject
  scopeReadFrame:MvuScopeReadFrameV1
  clockEpochMs:number
  randomSeed:string
}
interface PhaseOutputV3 {
  schemaVersion:3
  encoding:'native-mvu-author-schema-phase-output-v3'
  commandsEncoding:'native-mvu-update-operations-v2'
  errorPolicy:'atomic-refusal'
}
export type MvuSchemaGuestOutputV3=PhaseOutputV3 & (
  | {kind:'accepted';values:MvuJsonObject;commands:readonly MvuUpdateOperationV2[];
      context:MvuJsonObject;registrations:number}
  | {kind:'refused';diagnostics:readonly MvuSchemaDiagnosticV3[]})
export interface MvuSchemaEvaluationV3 {
  schemaVersion:3
  encoding:'native-mvu-author-schema-evaluation-v3'
  programSha256:string
  runner:MvuSchemaRunnerIdentity
  input:MvuSchemaEvaluationInputV3
  inputSha256:string
  output:MvuSchemaGuestOutputV3
  evaluationSha256:string
}
export type MvuSchemaRunResultV3={kind:'evaluated';evaluation:MvuSchemaEvaluationV3}
  | {kind:'unavailable'|'cancelled';diagnostics:readonly MvuSchemaDiagnostic[]}
export interface MvuSchemaRealmLoadFrameV3 extends MvuSchemaRealmReadBinding {
  schemaVersion:3
  values:MvuJsonObject
  context:MvuJsonObject
  scopeReadFrame:MvuScopeReadFrameV1
  clockEpochMs:number
  randomSeed:string
}
export interface MvuSchemaTraceFrameV3 extends MvuSchemaRealmReadBinding {
  input:MvuSchemaEvaluationInputV3
}
export interface MvuSchemaTraceRequestedStepV3 {
  eventId:string
  frame:MvuSchemaTraceFrameV3
}
export interface MvuSchemaTraceStepRecordV3 extends MvuSchemaTraceRequestedStepV3 {
  ordinal:number
  previousStepSha256:string
  output:MvuSchemaGuestOutputV3
  stepSha256:string
}
export interface MvuSchemaTraceInputV3 {
  schemaVersion:3
  encoding:'native-mvu-author-schema-trace-input-v3'
  realmEpoch:string
  loadFrame:MvuSchemaRealmLoadFrameV3
  prefix:readonly MvuSchemaTraceStepRecordV3[]
  requestedStep:MvuSchemaTraceRequestedStepV3
}
export type MvuSchemaTraceEvaluationStepV3=Omit<MvuSchemaTraceStepRecordV3,'frame'> & {frameSha256:string}
export interface MvuSchemaTraceEvaluationV3 {
  schemaVersion:3
  encoding:'native-mvu-author-schema-trace-evaluation-v3'
  programSha256:string
  runner:MvuSchemaRunnerIdentity
  input:MvuSchemaTraceInputV3
  inputSha256:string
  records:readonly MvuSchemaTraceEvaluationStepV3[]
  evaluationSha256:string
}
export type MvuSchemaTraceRunResultV3={kind:'evaluated-trace';evaluation:MvuSchemaTraceEvaluationV3}
  | {kind:'unavailable'|'cancelled';diagnostics:readonly MvuSchemaDiagnostic[]}
export interface MvuSchemaRunnerV3 {
  readonly identity:MvuSchemaRunnerIdentity
  evaluate(program:MvuSchemaProgram,input:MvuSchemaEvaluationInputV3,signal?:AbortSignal):Promise<MvuSchemaRunResultV3>
  verifyEvaluation(program:MvuSchemaProgram,evaluation:MvuSchemaEvaluationV3,signal?:AbortSignal):Promise<boolean>
  evaluateTrace(program:MvuSchemaProgram,input:MvuSchemaTraceInputV3,signal?:AbortSignal):Promise<MvuSchemaTraceRunResultV3>
  verifyTrace(program:MvuSchemaProgram,evaluation:MvuSchemaTraceEvaluationV3,signal?:AbortSignal):Promise<boolean>
  dispose():Promise<void>
}
export type MvuSchemaRunnerDepsV3=MvuSchemaRunnerDeps
