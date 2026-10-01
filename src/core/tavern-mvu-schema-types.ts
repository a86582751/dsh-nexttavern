/** Author programs and execution records are data, never numerical authority.
 * Core proves their immutable Source/Native boundary; its replay owner alone
 * may mint process-private evidence after actual historical execution. */
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'

export const MVU_SCHEMA_BOUNDS=Object.freeze({sourceBytes:1048576,programBytes:4194304,scripts:64,
  syntaxTokens:64000,syntaxDepth:128,inputBytes:8388608,outputBytes:2097152,
  valuesBytes:1048576,dataNodes:32000,dataDepth:32,arrayLength:4096,
  evaluationNodes:131072,evaluationDepth:66,traceSteps:64,
  vmMemoryBytes:134217728,vmStackBytes:1048576,vmDeadlineMs:2000,parentDeadlineMs:5000})
export type MvuSchemaDependencyKind='zod'|'lodash'|'schema-bridge'
export interface MvuSchemaImplementationIdentity {
  id:string
  version:number
  implementationSha256:string
}
export interface MvuSchemaLibraryIdentity {
  kind:'zod'|'lodash'
  packageName:string
  version:string
  bundleSha256:string
  /** Only fixed identifier names owned by the trusted asset provider. */
  globalName:string
}
export interface MvuSchemaLibraryBytes extends MvuSchemaLibraryIdentity {code:string}
export interface MvuSchemaImportBinding {
  specifier:string
  kind:MvuSchemaDependencyKind
  implementationSha256:string
}
export interface MvuSchemaAuthorScript {
  identity:string
  pointer:string
  enabled:boolean
  source:string
  sourceSha256:string
  imports:readonly MvuSchemaImportBinding[]
}
export interface MvuSchemaSourceBinding {
  ownerSessionId:string
  importId:string
  sourceSha256:string
  importRecordSha256:string
  sourceSnapshotSha256:string
  /** Complete immutable values/references for every allowed source read. */
  material:MvuJsonObject
  materialSha256:string
}
export interface MvuSchemaCompilerIdentity extends MvuSchemaImplementationIdentity {typescriptVersion:'5.9.3'}
export interface MvuSchemaCompilationInput {
  schemaVersion:1
  source:MvuSchemaSourceBinding
  scripts:readonly MvuSchemaAuthorScript[]
  libraries:readonly MvuSchemaLibraryIdentity[]
  bridge:MvuSchemaImplementationIdentity
}
export interface MvuSchemaCompiledScript extends MvuSchemaAuthorScript {
  javascript:string
  javascriptSha256:string
}
export interface MvuSchemaProgram {
  schemaVersion:1
  encoding:'native-mvu-author-schema-program-v1'
  compiler:MvuSchemaCompilerIdentity
  source:MvuSchemaSourceBinding
  scripts:readonly MvuSchemaCompiledScript[]
  libraries:readonly MvuSchemaLibraryIdentity[]
  bridge:MvuSchemaImplementationIdentity
  programSha256:string
}
export interface MvuSchemaDiagnostic {
  code:string
  pointer?:string
  scriptIdentity?:string
  line?:number
  column?:number
  /** No original author code, values, stack or arbitrary guest message. */
  issuePath?:readonly (string|number)[]
}
export type MvuSchemaCompilation={kind:'compiled';program:MvuSchemaProgram}
  |{kind:'refused';diagnostics:readonly MvuSchemaDiagnostic[]}

/** The Core driver fixes the supported helper event order. A phase is not an
 * instruction to execute model text; only parsed JSON commands cross here. */
export type MvuSchemaPhase='initialization'|'command-parsed'|'commands-parsed'
  |'update-ended'|'manual-replacement'
export interface MvuSchemaEvaluationInput {
  schemaVersion:1
  phase:MvuSchemaPhase
  base:MvuJsonObject|null
  values:MvuJsonObject
  commands:readonly MvuJsonObject[]
  /** MvuData fields other than stat_data. The guest receives a private clone;
   * caller-owned Source references are never exposed as mutable host objects. */
  context:MvuJsonObject
  clockEpochMs:number
  randomSeed:string
}
export type MvuSchemaGuestOutput={kind:'accepted';values:MvuJsonObject;commands:readonly MvuJsonObject[];context:MvuJsonObject;
  registrations:number}
  |{kind:'refused';diagnostics:readonly MvuSchemaDiagnostic[]}
export interface MvuSchemaRunnerIdentity extends MvuSchemaImplementationIdentity {quickjsVersion:'0.32.0'}
export interface MvuSchemaEvaluation {
  schemaVersion:1
  encoding:'native-mvu-author-schema-evaluation-v1'
  programSha256:string
  runner:MvuSchemaRunnerIdentity
  input:MvuSchemaEvaluationInput
  inputSha256:string
  output:MvuSchemaGuestOutput
  evaluationSha256:string
}
export type MvuSchemaRunResult={kind:'evaluated';evaluation:MvuSchemaEvaluation}
  |{kind:'unavailable'|'cancelled';diagnostics:readonly MvuSchemaDiagnostic[]}

/** Realm/cut fields are comparison data supplied by Core, never capabilities.
 * Core must prove the load boundary and complete execution journal, including
 * attempts that changed closures without a successful numerical commit. */
export interface MvuSchemaRealmReadBinding {
  ownerSessionId:string
  sourceNativeCutSha256:string
  /** Allowed read material at this frame; original author-source identity
   * remains program.source and does not change when this material changes. */
  material:MvuJsonObject
}
export interface MvuSchemaRealmLoadFrame extends MvuSchemaRealmReadBinding {
  schemaVersion:1
  values:MvuJsonObject
  context:MvuJsonObject
  clockEpochMs:number
  randomSeed:string
}
export interface MvuSchemaTraceFrame extends MvuSchemaRealmReadBinding {
  input:MvuSchemaEvaluationInput
}
export interface MvuSchemaTraceRequestedStep {
  eventId:string
  frame:MvuSchemaTraceFrame
}
/** A deterministic completed event can be refused and still mutate a closure.
 * Unknown partial execution (timeout/cancellation) never produces this record.
 * Ordinals are one-based; the first previousStepSha256 is the load anchor. */
export interface MvuSchemaTraceStepRecord extends MvuSchemaTraceRequestedStep {
  ordinal:number
  previousStepSha256:string
  output:MvuSchemaGuestOutput
  stepSha256:string
}
export interface MvuSchemaTraceInput {
  schemaVersion:1
  encoding:'native-mvu-author-schema-trace-input-v1'
  realmEpoch:string
  loadFrame:MvuSchemaRealmLoadFrame
  prefix:readonly MvuSchemaTraceStepRecord[]
  requestedStep:MvuSchemaTraceRequestedStep
}
/** Compact execution receipt. Full frames already live in input; duplicating
 * them would consume the record budget after a legal execution completed.
 * stepSha256 still hashes the full canonical MvuSchemaTraceStepRecord body. */
export type MvuSchemaTraceEvaluationStep=Omit<MvuSchemaTraceStepRecord,'frame'> & {frameSha256:string}
export interface MvuSchemaTraceEvaluation {
  schemaVersion:1
  encoding:'native-mvu-author-schema-trace-evaluation-v1'
  programSha256:string
  runner:MvuSchemaRunnerIdentity
  input:MvuSchemaTraceInput
  inputSha256:string
  /** Load exactly once, then reproduce every prefix output in order before
   * executing requestedStep. These are facts about execution, not authority. */
  records:readonly MvuSchemaTraceEvaluationStep[]
  evaluationSha256:string
}
export type MvuSchemaTraceRunResult={kind:'evaluated-trace';evaluation:MvuSchemaTraceEvaluation}
  |{kind:'unavailable'|'cancelled';diagnostics:readonly MvuSchemaDiagnostic[]}
export interface MvuSchemaCompiler {
  readonly identity:MvuSchemaCompilerIdentity
  compile(input:MvuSchemaCompilationInput,signal?:AbortSignal):Promise<MvuSchemaCompilation>
  /** Recompile the stored original input with this exact implementation. A
   * matching ordinary descriptor hash alone cannot prove compilation. */
  verifyProgram(program:MvuSchemaProgram,signal?:AbortSignal):Promise<boolean>
  dispose():Promise<void>
}
export interface MvuSchemaRunner {
  readonly identity:MvuSchemaRunnerIdentity
  evaluate(program:MvuSchemaProgram,input:MvuSchemaEvaluationInput,signal?:AbortSignal):Promise<MvuSchemaRunResult>
  /** Executes original pre-transform input. Saved normalized values are not
   * passed through a non-idempotent author transformation a second time. */
  verifyEvaluation(program:MvuSchemaProgram,evaluation:MvuSchemaEvaluation,signal?:AbortSignal):Promise<boolean>
  /** Full trace shares a realm and closures. Complete trace input/output use
   * existing aggregate byte/node bounds, not per-step multiplied allowances.
   * Clock/seed switch per frame under the owned deterministic contract. */
  evaluateTrace(program:MvuSchemaProgram,input:MvuSchemaTraceInput,signal?:AbortSignal):Promise<MvuSchemaTraceRunResult>
  verifyTrace(program:MvuSchemaProgram,evaluation:MvuSchemaTraceEvaluation,signal?:AbortSignal):Promise<boolean>
  dispose():Promise<void>
}
export interface MvuSchemaCompilerDeps {
  identity:MvuSchemaCompilerIdentity
  /** The actual trusted package worker URL; never a card/client path. */
  workerUrl?:URL
}
export interface MvuSchemaRunnerDeps {
  identity:MvuSchemaRunnerIdentity
  bridge:MvuSchemaImplementationIdentity
  libraries:readonly MvuSchemaLibraryBytes[]
  workerUrl?:URL
}
export type MvuSchemaJsonValue=MvuJsonValue
