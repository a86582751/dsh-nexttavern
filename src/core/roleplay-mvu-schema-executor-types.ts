/** The admitted catalog binds each V4 epoch to its actual implementation. */
import {cloneSchemaData} from './tavern-mvu-schema-data.js'
import {validateMvuExecutableProgramV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaRunnerIdentity,MvuSchemaCompilerIdentity,MvuSchemaImplementationIdentity,
  MvuSchemaLibraryIdentity,MvuSchemaPhase,MvuSchemaRealmReadBinding} from './tavern-mvu-schema-types.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuExecutableProgramV4} from './tavern-mvu-owned-state-types-v1.mjs'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {MvuScopeReadRefV2} from './tavern-mvu-scope-view-v2.js'
import type {MvuSchemaCompilationInputV4,CompilationV4}
  from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaEvaluationInputV4,MvuSchemaGuestOutputV4,MvuSchemaRealmLoadFrameV4,
  MvuSchemaTraceRequestedStepV4,MvuSchemaTraceStepRecordV4,MvuSchemaTraceEvaluationStepV4,
  MvuSchemaTraceInputV4,MvuSchemaTraceEvaluationV4,MvuSchemaTraceRunResultV4,MvuSchemaNextRunResultV4,
  MvuSchemaOpenManualRunResultV4,MvuSchemaPhaseErrorPolicyV4,MvuSchemaOwnedPrefixReaderV4}
  from './tavern-mvu-schema-types-v4.js'

export type SchemaExecutorVersion=4
export type SchemaAuthorProgram=MvuExecutableProgramV4
export type SchemaAuthorCompilationInput=MvuSchemaCompilationInputV4
export type SchemaAuthorCompilation=CompilationV4
export const validateSchemaAuthorProgram=validateMvuExecutableProgramV4
export type SchemaEvaluationInput=MvuSchemaEvaluationInputV4
export type SchemaGuestOutput=MvuSchemaGuestOutputV4
export type SchemaRealmLoadFrame=MvuSchemaRealmLoadFrameV4
export type SchemaTraceRequestedStep=MvuSchemaTraceRequestedStepV4
export type SchemaTraceStepRecord=MvuSchemaTraceStepRecordV4
export type SchemaTraceEvaluationStep=MvuSchemaTraceEvaluationStepV4
export type SchemaTraceInput=MvuSchemaTraceInputV4
export type SchemaTraceEvaluation=MvuSchemaTraceEvaluationV4
export type SchemaTraceRunResult=MvuSchemaTraceRunResultV4
export interface SchemaCompiler {
  readonly identity:MvuSchemaCompilerIdentity&{readonly version:4}
  compile(input:SchemaAuthorCompilationInput,signal?:AbortSignal):Promise<SchemaAuthorCompilation>
  verifyProgram(program:SchemaAuthorProgram,signal?:AbortSignal):Promise<boolean>
  dispose():Promise<void>
}

/** Only the catalog creates the adapter, with a version check before invoking
 * the real runner. Widening this host interface never widens either guest ABI. */
export interface SchemaTraceRunner {
  readonly identity:MvuSchemaRunnerIdentity
  readonly scopeInputProtocols?:readonly ('full-frame-v1'|'scope-ref-v2')[]
  bindScopeReferencesV2?(read:import('./tavern-mvu-schema-types-v4.js').MvuSchemaScopeReferenceReaderV2):SchemaTraceRunner
  evaluateTrace(program:SchemaAuthorProgram,input:SchemaTraceInput,signal?:AbortSignal):Promise<SchemaTraceRunResult>
  /** Current live execution needs the last receipt, while historical readers
   * retain the complete evaluation contract of their original executor. */
  /** The live owner supplies its compiler/Journal-parsed program. This entry
   * parses the next trace; historical raw replay retains evaluateTrace. */
  evaluateNext?(program:SchemaAuthorProgram,input:SchemaTraceInput,signal?:AbortSignal):Promise<MvuSchemaNextRunResultV4>
  /** Trusted Host assembly binds its own capture reader across the runtime
   * package boundary. Guest/RPC/persisted DTOs never supply this callback. */
  bindOwnedNext?(reader:MvuSchemaOwnedPrefixReaderV4):{
    evaluateNext(program:SchemaAuthorProgram,input:SchemaTraceInput,signal?:AbortSignal):Promise<MvuSchemaNextRunResultV4>
  }
  /** Only a live Replay owner retains this resource. Cold readers never
   * recover a VM from its persisted trace or a program hash. */
  openManualRun?(program:SchemaAuthorProgram,input:SchemaTraceInput,
    signal?:AbortSignal):Promise<MvuSchemaOpenManualRunResultV4>
  verifyTrace(program:SchemaAuthorProgram,evaluation:SchemaTraceEvaluation,signal?:AbortSignal):Promise<boolean>
}
export interface SchemaExecutorIdentityTuple {
  compiler:SchemaAuthorProgram['compiler']
  bridge:MvuSchemaImplementationIdentity
  libraries:readonly MvuSchemaLibraryIdentity[]
  runner:MvuSchemaRunnerIdentity
}
export interface OwnedMvuSchemaExecutor {
  readonly executorVersion:SchemaExecutorVersion
  readonly implementationKey:string
  compiler:SchemaCompiler
  runner:SchemaTraceRunner
  libraries:readonly MvuSchemaLibraryIdentity[]
  bridge:MvuSchemaImplementationIdentity
  /** V4's mapper is derived from its actual protected bridge and fixed policy.
   * It grants no independent Source, Native or publication authority. */
  stateLoader?:MvuSchemaImplementationIdentity
  dispose():Promise<void>
}

/** Exact bounded comparison data. Passing this validation does not prove an
 * owned package or a historical execution; both are checked by their owners. */
export function validateSchemaExecutorIdentityTuple(input:unknown):SchemaExecutorIdentityTuple {
  const tuple=cloneSchemaData(input,16384) as SchemaExecutorIdentityTuple
  const fail=()=>{throw Error('SCHEMA_EXECUTOR_IDENTITY_INVALID')}
  const exact=(value:object,keys:readonly string[])=>{
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length
      ||Object.keys(value).some(key=>!keys.includes(key)))fail()
  }
  exact(tuple,['compiler','bridge','libraries','runner'])
  for(const [key,id,extra] of [['compiler','native-mvu-schema-compiler','typescriptVersion'],
    ['bridge','native-mvu-schema-bridge',null],['runner','native-mvu-schema-runner','quickjsVersion']] as const) {
    const value=tuple[key]
    exact(value,['id','version','implementationSha256',...(extra?[extra]:[])])
    if(value.id!==id||value.version!==4||!/^[a-f0-9]{64}$/.test(value.implementationSha256))fail()
  }
  if(tuple.compiler.version!==tuple.runner.version||tuple.bridge.version!==tuple.runner.version
    ||tuple.compiler.typescriptVersion!=='5.9.3'||tuple.runner.quickjsVersion!=='0.32.0'
    ||!Array.isArray(tuple.libraries)||tuple.libraries.length!==2
    ||new Set(tuple.libraries.map(library=>library.kind)).size!==2)fail()
  for(const library of tuple.libraries) {
    exact(library,['kind','packageName','version','bundleSha256','globalName'])
    if(!['zod','lodash'].includes(library.kind)||library.packageName!==library.kind
      ||library.version!==(library.kind==='zod'?'4.4.3':'4.18.1')
      ||library.globalName!==(library.kind==='zod'?'z':'_')||!/^[a-f0-9]{64}$/.test(library.bundleSha256))fail()
  }
  return tuple
}

/** Initialization and editing carry no command authority. For external pack
 * adoption, use external-pack-replacement with the prior canonical base and
 * donor values/context. Acceptance records raw adoption, not schema parsing. */
export function schemaEmptyPhaseInput(version:SchemaExecutorVersion,
  phase:MvuSchemaPhase,base:MvuJsonObject|null,values:MvuJsonObject,
  context:MvuJsonObject,clockEpochMs:number,randomSeed:string,scopeReadFrame?:MvuScopeReadFrameV1,
  errorPolicy:MvuSchemaPhaseErrorPolicyV4='atomic-refusal',scopeReadRef?:MvuScopeReadRefV2):SchemaEvaluationInput {
  const body={phase,base,values,commands:[],context,clockEpochMs,randomSeed}
  if(scopeReadRef)return {schemaVersion:version,encoding:'native-mvu-author-schema-phase-input-v4-scope-ref-v2',
    commandsEncoding:'native-mvu-update-operations-v2',errorPolicy,...body,scopeReadRef}
  if(!scopeReadFrame)throw Error('SCHEMA_SCOPE_READ_REQUIRED')
  return {schemaVersion:version,encoding:'native-mvu-author-schema-phase-input-v4',
    commandsEncoding:'native-mvu-update-operations-v2',errorPolicy,...body,scopeReadFrame}
}

export function schemaRealmLoadFrame(version:SchemaExecutorVersion,binding:MvuSchemaRealmReadBinding,
  values:MvuJsonObject,context:MvuJsonObject,clockEpochMs:number,randomSeed:string,
  scopeReadFrame?:MvuScopeReadFrameV1):SchemaRealmLoadFrame {
  const body={...binding,values,context,clockEpochMs,randomSeed}
  if(!scopeReadFrame)throw Error('SCHEMA_SCOPE_READ_REQUIRED')
  return {schemaVersion:version,...body,scopeReadFrame}
}

/** Keep the actual scope input shape supplied by the owning producer. */
export function schemaTraceRequestedStep(eventId:string,binding:MvuSchemaRealmReadBinding,
  input:SchemaEvaluationInput):SchemaTraceRequestedStep {
  return {eventId,frame:{...binding,input}}
}
