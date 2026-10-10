/** Host transport unions do not choose an executor. The admitted catalog binds
 * each epoch to its complete original implementation tuple before dispatch. */
import {types} from 'node:util'
import {cloneSchemaData,validateSchemaProgram} from './tavern-mvu-schema-data.js'
import {validateSchemaProgramV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaProgram,MvuSchemaRunnerIdentity,MvuSchemaCompiler,MvuSchemaImplementationIdentity,
  MvuSchemaCompilationInput,MvuSchemaCompilation,
  MvuSchemaLibraryIdentity,MvuSchemaEvaluationInput,
  MvuSchemaGuestOutput,MvuSchemaRealmLoadFrame,MvuSchemaTraceRequestedStep,
  MvuSchemaTraceStepRecord,MvuSchemaTraceEvaluationStep,MvuSchemaTraceInput,
  MvuSchemaTraceEvaluation,MvuSchemaTraceRunResult,MvuSchemaRealmReadBinding} from './tavern-mvu-schema-types.js'
import type {MvuSchemaEvaluationInputV2,MvuSchemaGuestOutputV2,MvuSchemaRealmLoadFrameV2,
  MvuSchemaTraceRequestedStepV2,MvuSchemaTraceStepRecordV2,MvuSchemaTraceEvaluationStepV2,
  MvuSchemaTraceInputV2,MvuSchemaTraceEvaluationV2,MvuSchemaTraceRunResultV2}
  from './tavern-mvu-schema-types-v2.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuSchemaEvaluationInputV3,MvuSchemaGuestOutputV3,MvuSchemaRealmLoadFrameV3,
  MvuSchemaTraceRequestedStepV3,MvuSchemaTraceStepRecordV3,MvuSchemaTraceEvaluationStepV3,
  MvuSchemaTraceInputV3,MvuSchemaTraceEvaluationV3,MvuSchemaTraceRunResultV3}
  from './tavern-mvu-schema-types-v3.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {MvuSchemaProgramV4,MvuSchemaCompilationInputV4,CompilationV4}
  from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaEvaluationInputV4,MvuSchemaGuestOutputV4,MvuSchemaRealmLoadFrameV4,
  MvuSchemaTraceRequestedStepV4,MvuSchemaTraceStepRecordV4,MvuSchemaTraceEvaluationStepV4,
  MvuSchemaTraceInputV4,MvuSchemaTraceEvaluationV4,MvuSchemaTraceRunResultV4}
  from './tavern-mvu-schema-types-v4.js'

export type SchemaExecutorVersion=1|2|3|4
export type SchemaAuthorProgram=MvuSchemaProgram|MvuSchemaProgramV4
export type SchemaAuthorCompilationInput=MvuSchemaCompilationInput|MvuSchemaCompilationInputV4
export type SchemaAuthorCompilation=MvuSchemaCompilation|CompilationV4
/** Version dispatch validates data only. The catalog and compiler still admit
 * the actual implementation and recompute the complete raw author plan. */
export function validateSchemaAuthorProgram(input:unknown):SchemaAuthorProgram {
  if(input!==null&&typeof input==='object'&&types.isProxy(input))throw Error('SCHEMA_PROXY_VALUE')
  // Inspect only an own data discriminator without invoking a getter. The
  // selected validator still clones and validates the entire bounded program.
  const version=input!==null&&typeof input==='object'?Object.getOwnPropertyDescriptor(input,'schemaVersion'):undefined
  return version&&Object.hasOwn(version,'value')&&version.value===2
    ?validateSchemaProgramV4(input):validateSchemaProgram(input)
}
export type SchemaEvaluationInput=MvuSchemaEvaluationInput|MvuSchemaEvaluationInputV2
  |MvuSchemaEvaluationInputV3|MvuSchemaEvaluationInputV4
export type SchemaGuestOutput=MvuSchemaGuestOutput|MvuSchemaGuestOutputV2|MvuSchemaGuestOutputV3|MvuSchemaGuestOutputV4
export type SchemaRealmLoadFrame=MvuSchemaRealmLoadFrame|MvuSchemaRealmLoadFrameV2
  |MvuSchemaRealmLoadFrameV3|MvuSchemaRealmLoadFrameV4
export type SchemaTraceRequestedStep=MvuSchemaTraceRequestedStep|MvuSchemaTraceRequestedStepV2
  |MvuSchemaTraceRequestedStepV3|MvuSchemaTraceRequestedStepV4
export type SchemaTraceStepRecord=MvuSchemaTraceStepRecord|MvuSchemaTraceStepRecordV2
  |MvuSchemaTraceStepRecordV3|MvuSchemaTraceStepRecordV4
export type SchemaTraceEvaluationStep=MvuSchemaTraceEvaluationStep|MvuSchemaTraceEvaluationStepV2
  |MvuSchemaTraceEvaluationStepV3|MvuSchemaTraceEvaluationStepV4
export type SchemaTraceInput=MvuSchemaTraceInput|MvuSchemaTraceInputV2|MvuSchemaTraceInputV3|MvuSchemaTraceInputV4
export type SchemaTraceEvaluation=MvuSchemaTraceEvaluation|MvuSchemaTraceEvaluationV2
  |MvuSchemaTraceEvaluationV3|MvuSchemaTraceEvaluationV4
export type SchemaTraceRunResult=MvuSchemaTraceRunResult|MvuSchemaTraceRunResultV2
  |MvuSchemaTraceRunResultV3|MvuSchemaTraceRunResultV4
export interface SchemaCompiler {
  readonly identity:MvuSchemaCompiler['identity']
  compile(input:SchemaAuthorCompilationInput,signal?:AbortSignal):Promise<SchemaAuthorCompilation>
  verifyProgram(program:SchemaAuthorProgram,signal?:AbortSignal):Promise<boolean>
  dispose():Promise<void>
}

/** Only the catalog creates the adapter, with a version check before invoking
 * the real runner. Widening this host interface never widens either guest ABI. */
export interface SchemaTraceRunner {
  readonly identity:MvuSchemaRunnerIdentity
  evaluateTrace(program:SchemaAuthorProgram,input:SchemaTraceInput,signal?:AbortSignal):Promise<SchemaTraceRunResult>
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
    if(value.id!==id||![1,2,3,4].includes(value.version)||!/^[a-f0-9]{64}$/.test(value.implementationSha256))fail()
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
  context:MvuJsonObject,clockEpochMs:number,randomSeed:string,scopeReadFrame?:MvuScopeReadFrameV1,
  errorPolicy:'atomic-refusal'|'registered-command-policy-v1'='atomic-refusal'):SchemaEvaluationInput {
  const body={phase,base,values,commands:[],context,clockEpochMs,randomSeed}
  if(version===4) {
    if(!scopeReadFrame)throw Error('SCHEMA_SCOPE_READ_REQUIRED')
    return {schemaVersion:4,encoding:'native-mvu-author-schema-phase-input-v4',
      commandsEncoding:'native-mvu-update-operations-v2',errorPolicy,...body,scopeReadFrame}
  }
  if(version===3) {
    if(!scopeReadFrame)throw Error('SCHEMA_SCOPE_READ_REQUIRED')
    return {schemaVersion:3,encoding:'native-mvu-author-schema-phase-input-v3',
      commandsEncoding:'native-mvu-update-operations-v2',errorPolicy:'atomic-refusal',...body,scopeReadFrame}
  }
  return version===1?{schemaVersion:1,...body}:{schemaVersion:2,
    encoding:'native-mvu-author-schema-phase-input-v2',commandsEncoding:'native-mvu-update-operations-v2',
    errorPolicy:'atomic-refusal',...body}
}

export function schemaRealmLoadFrame(version:SchemaExecutorVersion,binding:MvuSchemaRealmReadBinding,
  values:MvuJsonObject,context:MvuJsonObject,clockEpochMs:number,randomSeed:string,
  scopeReadFrame?:MvuScopeReadFrameV1):SchemaRealmLoadFrame {
  const body={...binding,values,context,clockEpochMs,randomSeed}
  if(version===1)return {schemaVersion:1,...body}
  if(version===2)return {schemaVersion:2,...body}
  if(!scopeReadFrame)throw Error('SCHEMA_SCOPE_READ_REQUIRED')
  if(version===4)return {schemaVersion:4,...body,scopeReadFrame}
  return {schemaVersion:3,...body,scopeReadFrame}
}

/** Preserve the discriminated ABI when a host builds a frame from shared
 * read facts. The branch narrows the actual input without any wire coercion. */
export function schemaTraceRequestedStep(eventId:string,binding:MvuSchemaRealmReadBinding,
  input:SchemaEvaluationInput):SchemaTraceRequestedStep {
  if(input.schemaVersion===1)return {eventId,frame:{...binding,input}}
  if(input.schemaVersion===2)return {eventId,frame:{...binding,input}}
  if(input.schemaVersion===3)return {eventId,frame:{...binding,input}}
  return {eventId,frame:{...binding,input}}
}
