/** Host transport unions do not choose an executor. The admitted catalog binds
 * each epoch to its complete original implementation tuple before dispatch. */
import {cloneSchemaData} from './tavern-mvu-schema-data.js'
import type {MvuSchemaProgram,MvuSchemaRunnerIdentity,MvuSchemaCompiler,MvuSchemaImplementationIdentity,
  MvuSchemaLibraryIdentity,MvuSchemaEvaluationInput,
  MvuSchemaGuestOutput,MvuSchemaRealmLoadFrame,MvuSchemaTraceRequestedStep,
  MvuSchemaTraceStepRecord,MvuSchemaTraceEvaluationStep,MvuSchemaTraceInput,
  MvuSchemaTraceEvaluation,MvuSchemaTraceRunResult,MvuSchemaRealmReadBinding} from './tavern-mvu-schema-types.js'
import type {MvuSchemaEvaluationInputV2,MvuSchemaGuestOutputV2,MvuSchemaRealmLoadFrameV2,
  MvuSchemaTraceRequestedStepV2,MvuSchemaTraceStepRecordV2,MvuSchemaTraceEvaluationStepV2,
  MvuSchemaTraceInputV2,MvuSchemaTraceEvaluationV2,MvuSchemaTraceRunResultV2}
  from './tavern-mvu-schema-types-v2.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export type SchemaExecutorVersion=1|2
export type SchemaEvaluationInput=MvuSchemaEvaluationInput|MvuSchemaEvaluationInputV2
export type SchemaGuestOutput=MvuSchemaGuestOutput|MvuSchemaGuestOutputV2
export type SchemaRealmLoadFrame=MvuSchemaRealmLoadFrame|MvuSchemaRealmLoadFrameV2
export type SchemaTraceRequestedStep=MvuSchemaTraceRequestedStep|MvuSchemaTraceRequestedStepV2
export type SchemaTraceStepRecord=MvuSchemaTraceStepRecord|MvuSchemaTraceStepRecordV2
export type SchemaTraceEvaluationStep=MvuSchemaTraceEvaluationStep|MvuSchemaTraceEvaluationStepV2
export type SchemaTraceInput=MvuSchemaTraceInput|MvuSchemaTraceInputV2
export type SchemaTraceEvaluation=MvuSchemaTraceEvaluation|MvuSchemaTraceEvaluationV2
export type SchemaTraceRunResult=MvuSchemaTraceRunResult|MvuSchemaTraceRunResultV2

/** Only the catalog creates the adapter, with a version check before invoking
 * the real runner. Widening this host interface never widens either guest ABI. */
export interface SchemaTraceRunner {
  readonly identity:MvuSchemaRunnerIdentity
  evaluateTrace(program:MvuSchemaProgram,input:SchemaTraceInput,signal?:AbortSignal):Promise<SchemaTraceRunResult>
  verifyTrace(program:MvuSchemaProgram,evaluation:SchemaTraceEvaluation,signal?:AbortSignal):Promise<boolean>
}
export interface SchemaExecutorIdentityTuple {
  compiler:MvuSchemaProgram['compiler']
  bridge:MvuSchemaImplementationIdentity
  libraries:readonly MvuSchemaLibraryIdentity[]
  runner:MvuSchemaRunnerIdentity
}
export interface OwnedMvuSchemaExecutor {
  readonly executorVersion:SchemaExecutorVersion
  readonly implementationKey:string
  compiler:MvuSchemaCompiler
  runner:SchemaTraceRunner
  libraries:readonly MvuSchemaLibraryIdentity[]
  bridge:MvuSchemaImplementationIdentity
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
    if(value.id!==id||(value.version!==1&&value.version!==2)||!/^[a-f0-9]{64}$/.test(value.implementationSha256))fail()
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

/** Initialization and editing have no command authority. Preserve the original
 * envelope for v1; v2 carries its explicit normalized-operation contract. */
export function schemaEmptyPhaseInput(version:SchemaExecutorVersion,
  phase:MvuSchemaEvaluationInput['phase'],base:MvuJsonObject|null,values:MvuJsonObject,
  context:MvuJsonObject,clockEpochMs:number,randomSeed:string):SchemaEvaluationInput {
  const body={phase,base,values,commands:[],context,clockEpochMs,randomSeed}
  return version===1?{schemaVersion:1,...body}:{schemaVersion:2,
    encoding:'native-mvu-author-schema-phase-input-v2',commandsEncoding:'native-mvu-update-operations-v2',
    errorPolicy:'atomic-refusal',...body}
}

/** Preserve the discriminated ABI when a host builds a frame from shared
 * read facts. The branch narrows the actual input without any wire coercion. */
export function schemaTraceRequestedStep(eventId:string,binding:MvuSchemaRealmReadBinding,
  input:SchemaEvaluationInput):SchemaTraceRequestedStep {
  return input.schemaVersion===1?{eventId,frame:{...binding,input}}:{eventId,frame:{...binding,input}}
}
