/** A fresh bounded guest evaluation is evidence about code and data, never a
 * Source/Native capability. Only the trusted Core supplies assets and workers. */
import {Worker} from 'node:worker_threads'
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaData,cloneSchemaEnvelopeV4,packSchemaEnvelopeV4,cloneSchemaValues,schemaTextSha256,
  splitSchemaEnvelopeV4,schemaSequenceItemsV4,schemaEnvelopeSequenceClonerV4,schemaEnvelopeWireSenderV4}
  from './tavern-mvu-schema-data.js'
import {validateMvuExecutableProgramV4,deriveOwnedStateLoaderIdentityV4,schemaPhaseErrorPolicyForProgramV4,schemaExecutionViewV4}
  from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaExecutionProgramV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuExecutableProgramV4} from './tavern-mvu-owned-state-types-v1.mjs'
import {createSchemaMaterialBudgetV4,schemaMaterialBudgetDeltaV4} from './tavern-mvu-schema-data.js'
import type {SchemaMaterialEnvelopeV4,SchemaMaterialBudgetV4,SchemaMaterialBudgetDeltaV4} from './tavern-mvu-schema-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {isKnownSchemaUpdateRejectionV2,validateSchemaUpdateCommandsV2} from './tavern-mvu-schema-update-effects-v2.js'
import {validateMvuScopeReadFrameV1} from './tavern-mvu-scope-read.js'
import type {MvuScopeReadFrameV1,MvuScopeReadViewV2,MvuScopedScriptV1} from './tavern-mvu-scope-read-types.js'
import {createMvuScopeViewResolverV2,validateMvuScopeReadRefV2} from './tavern-mvu-scope-view-v2.js'
import type {MvuScopeReadObjectV2} from './tavern-mvu-scope-view-v2.js'
import type {MvuSchemaDiagnostic,MvuSchemaLibraryBytes,MvuSchemaLibraryIdentity,
  MvuSchemaImplementationIdentity} from './tavern-mvu-schema-types.js'
import type {MvuSchemaRunnerV4,MvuSchemaRunnerDepsV4,MvuSchemaEvaluationInputV4,
  MvuSchemaGuestOutputV4,MvuSchemaRunResultV4,MvuSchemaEvaluationV4,MvuSchemaTraceInputV4,MvuSchemaTraceRunResultV4,
  MvuSchemaTraceEvaluationV4,MvuSchemaTraceFrameV4,MvuSchemaTraceEvaluationStepV4,
  MvuSchemaTraceRequestedStepV4,MvuSchemaDiagnosticV4,MvuSchemaNextRunResultV4,
  MvuSchemaManualRequestedStepV4,MvuSchemaManualRunV4,MvuSchemaOpenManualRunResultV4} from './tavern-mvu-schema-types-v4.js'
import type {MvuSchemaTraceStepRecordV4,MvuSchemaRealmLoadFrameV4,MvuSchemaOwnedPrefixReaderV4,MvuSchemaScopeReferenceReaderV2}
  from './tavern-mvu-schema-types-v4.js'

const scopeInputProtocols=Object.freeze(['full-frame-v1','scope-ref-v2'] as const)

type WorkerMaterialFrameV4<T extends {material:object}>=T extends {material:object}?Omit<T,'material'>&Partial<Pick<T,'material'>>:never
type WithoutMaterial<T>=T extends unknown?Omit<T,'material'>:never
function withoutMaterial<T extends {material:object}>(frame:T):WithoutMaterial<T> {
  const {material:_material,...rest}=frame
  return rest as WithoutMaterial<T>
}
/** Private execution metadata only. State-only workers never consume Source
 * material; public program validation and parent identities retain it fully. */
export type MvuSchemaWorkerProgramV4=MvuSchemaExecutionProgramV4
/** Private execution projection only. Parent evaluation/record hashes retain
 * the complete parsed frames; no wire projection supplies a replacement hash. */
export type MvuSchemaWorkerTraceInputV4=Omit<MvuSchemaTraceInputV4,'loadFrame'|'prefix'|'requestedStep'>&{
  loadFrame:WorkerMaterialFrameV4<MvuSchemaTraceInputV4['loadFrame']>
  prefix:readonly (Omit<MvuSchemaTraceInputV4['prefix'][number],'frame'>&{
    frame:WorkerMaterialFrameV4<MvuSchemaTraceFrameV4>
  })[]
  requestedStep:Omit<MvuSchemaTraceRequestedStepV4,'frame'>&{frame:WorkerMaterialFrameV4<MvuSchemaTraceFrameV4>}
}
type MvuSchemaWorkerInputV4={program:MvuExecutableProgramV4;input:MvuSchemaEvaluationInputV4}
  |{program:MvuExecutableProgramV4;trace:MvuSchemaTraceInputV4;response?:'next'|'manual'}
export type MvuSchemaWorkerRequestV4=({
  program:MvuSchemaWorkerProgramV4
  input:MvuSchemaEvaluationInputV4
  libraries?:readonly MvuSchemaLibraryBytes[]
}|{program:MvuSchemaWorkerProgramV4;trace:MvuSchemaWorkerTraceInputV4;
  libraries?:readonly MvuSchemaLibraryBytes[];response?:'next'|'manual'}
  |{program:MvuSchemaWorkerProgramV4;loadFrame:WorkerMaterialFrameV4<MvuSchemaRealmLoadFrameV4>;
    libraries?:readonly MvuSchemaLibraryBytes[];response:'hot'|'manual-stream'}) & {scopeObjects?:readonly MvuScopeReadObjectV2[]}
export interface MvuSchemaScopeWorkerSeedV2 {
  kind:'scope-reference-request-v2';request:SchemaMaterialEnvelopeV4<MvuSchemaWorkerRequestV4>
  scopeObjects:readonly MvuScopeReadObjectV2[]
}
export type MvuSchemaHotWorkerSeedV4={kind:'live-open';mode:'hot'|'manual-stream';
  header:SchemaMaterialEnvelopeV4<{program:MvuSchemaWorkerProgramV4;libraries?:readonly MvuSchemaLibraryBytes[]}>;
  load:SchemaMaterialEnvelopeV4<WorkerMaterialFrameV4<MvuSchemaRealmLoadFrameV4>>;scopeObjects?:readonly MvuScopeReadObjectV2[]}
export type MvuSchemaWorkerEvaluationResponseV4={kind:'output';json:string}|{kind:'trace-output';json:string}
  |{kind:'next-output';json:string}
  |{kind:'unavailable';code:string}
export type MvuSchemaManualWorkerMessageV4=({kind:'advance';step:MvuSchemaManualRequestedStepV4}
  |{kind:'hot-advance';step:SchemaMaterialEnvelopeV4<MvuSchemaWorkerTraceInputV4['requestedStep']>}
  |{kind:'hot-replay';step:SchemaMaterialEnvelopeV4<MvuSchemaWorkerTraceInputV4['prefix'][number]>}|{kind:'close'}) &
  {scopeObjects?:readonly MvuScopeReadObjectV2[]}
export type MvuSchemaManualWorkerResponseV4={kind:'manual-phase';json:string}
  |{kind:'hot-ready'}|{kind:'hot-replayed';stepSha256:string}
  |{kind:'manual-closed';cleanup:'completed';result?:Extract<MvuSchemaWorkerEvaluationResponseV4,{kind:'next-output'|'unavailable'}>}
  |{kind:'manual-closed';cleanup:'failed';code:string}
export type MvuSchemaWorkerResponseV4=MvuSchemaWorkerEvaluationResponseV4|MvuSchemaManualWorkerResponseV4
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const diagnostic=(code:string):readonly MvuSchemaDiagnostic[]=>[{code}]
type RunnerFailure=Extract<MvuSchemaRunResultV4,{kind:'unavailable'|'cancelled'}>
const unavailable=(code:string):RunnerFailure=>({kind:'unavailable',diagnostics:diagnostic(code)})
const cancelled=(cause?:RunnerFailure):RunnerFailure=>({kind:'cancelled',diagnostics:[{code:'SCHEMA_CANCELLED'},
  ...cause?.diagnostics.filter(item=>item.code!=='SCHEMA_CANCELLED')??[]]})
const evaluationBytes=MVU_SCHEMA_BOUNDS.inputBytes+MVU_SCHEMA_BOUNDS.outputBytes+4096
const phaseRecordBytes=MVU_SCHEMA_BOUNDS.inputBytes+MVU_SCHEMA_BOUNDS.outputBytes+4096
// Recovery is one bounded historical operation, separate from each original
// phase's VM/parent budgets and from the lifetime of a parked Story realm.
const coldReplayDeadlineMs=15000
const evaluationBounds={nodes:MVU_SCHEMA_BOUNDS.evaluationNodes,depth:MVU_SCHEMA_BOUNDS.evaluationDepth}
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const identifier=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=256
function traceRecord(step:MvuSchemaTraceRequestedStepV4,ordinal:number,previous:string,
  output:MvuSchemaGuestOutputV4):MvuSchemaTraceEvaluationStepV4 {
  const body={ordinal,eventId:step.eventId,frame:step.frame,previousStepSha256:previous,output}
  return {ordinal,eventId:step.eventId,previousStepSha256:previous,output,
    frameSha256:recordSha256(step.frame),stepSha256:recordSha256(body)}
}
function exact(value:object,keys:readonly string[]):void {
  if(!same(Object.keys(value).sort(),[...keys].sort()))throw Error('SCHEMA_DATA_INVALID')
}
function implementation(value:MvuSchemaImplementationIdentity):void {
  if(!value||typeof value.id!=='string'||!/^[A-Za-z0-9._-]{1,128}$/.test(value.id)
    ||!Number.isSafeInteger(value.version)||value.version<1
    ||typeof value.implementationSha256!=='string'||!/^[a-f0-9]{64}$/.test(value.implementationSha256)) {
    throw Error('SCHEMA_IMPLEMENTATION_UNAVAILABLE')
  }
}
export function validateSchemaEvaluationInputV4(input:unknown,program?:MvuExecutableProgramV4):MvuSchemaEvaluationInputV4 {
  return evaluationInputData(cloneSchemaData(input,MVU_SCHEMA_BOUNDS.inputBytes) as MvuSchemaEvaluationInputV4,program)
}
function evaluationInputData(value:MvuSchemaEvaluationInputV4,program?:MvuExecutableProgramV4):MvuSchemaEvaluationInputV4 {
  const references=value.encoding==='native-mvu-author-schema-phase-input-v4-scope-ref-v2'
  exact(value,['schemaVersion','encoding','commandsEncoding','errorPolicy','phase','base','values','commands',
    'context',references?'scopeReadRef':'scopeReadFrame','clockEpochMs','randomSeed'])
  const object=(v:unknown)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
  if(value.schemaVersion!==4||!references&&value.encoding!=='native-mvu-author-schema-phase-input-v4'
    ||value.commandsEncoding!=='native-mvu-update-operations-v2'
    ||!['atomic-refusal','registered-command-policy-v1','update-batch-atomic-v1'].includes(value.errorPolicy)
    ||!['initialization','command-parsed','commands-parsed','update-ended','manual-replacement',
      'external-pack-replacement','hook-reconcile'].includes(value.phase)
    ||value.base!==null&&!object(value.base)||!object(value.values)||!object(value.context)
    ||!Array.isArray(value.commands)||!Number.isSafeInteger(value.clockEpochMs)
    ||typeof value.randomSeed!=='string'||!value.randomSeed.length||value.randomSeed.length>256)throw Error('SCHEMA_INPUT_INVALID')
  value.commands=validateSchemaUpdateCommandsV2(value.commands)
  if(value.phase!=='command-parsed'&&value.commands.length)throw Error('SCHEMA_COMMANDS_UNSUPPORTED')
  value.values=cloneSchemaValues(value.values)
  if(value.base!==null)value.base=cloneSchemaValues(value.base)
  if(Object.hasOwn(value.context,'stat_data'))throw Error('SCHEMA_CONTEXT_INVALID')
  if(value.encoding==='native-mvu-author-schema-phase-input-v4-scope-ref-v2') {
    value.scopeReadRef=validateMvuScopeReadRefV2(value.scopeReadRef)
  } else value.scopeReadFrame=validateMvuScopeReadFrameV1(value.scopeReadFrame)
  if(program&&value.errorPolicy!==schemaPhaseErrorPolicyForProgramV4(program))throw Error('SCHEMA_INPUT_POLICY_MISMATCH')
  return value
}
export function schemaPhaseScopeFromLoadV4(load:Pick<MvuSchemaRealmLoadFrameV4,'encoding'|'scopeReadFrame'|'scopeReadRef'>) {
  return load.encoding==='native-mvu-author-schema-realm-load-v4-scope-ref-v2'
    ?{encoding:'native-mvu-author-schema-phase-input-v4-scope-ref-v2' as const,scopeReadRef:load.scopeReadRef!}
    :{encoding:'native-mvu-author-schema-phase-input-v4' as const,scopeReadFrame:load.scopeReadFrame!}
}
/** Correlate a decoded V2 view with its actual compiler program, never with a
 * caller's replacement frame hash. Core remains the current publication owner. */
export function validateSchemaScopeProgramViewV2(program:MvuSchemaWorkerProgramV4,view:Pick<MvuScopeReadViewV2,'source'>,
  scopedScripts:Iterable<Pick<MvuScopedScriptV1,'scriptId'|'pointer'|'sourceSha256'>>,
  binding?:{ownerSessionId:string},load=false):void {
  if(view.source.importId!==program.source.importId||view.source.rawSha256!==program.source.sourceSha256
    ||binding&&view.source.sessionId!==binding.ownerSessionId
    ||load&&view.source.sourceSnapshotSha256!==program.source.sourceSnapshotSha256)throw Error('SCHEMA_SCOPE_BINDING_MISMATCH')
  const scripts=schemaExecutionViewV4(program).scripts,byId=new Map(scripts.map(item=>[item.identity,item])),matches=new Set<string>()
  for(const scoped of scopedScripts) {
    const script=byId.get(scoped.scriptId)
    if(!script||script.pointer!==scoped.pointer||script.sourceSha256!==scoped.sourceSha256)throw Error('SCHEMA_SCOPE_SCRIPT_MISMATCH')
    matches.add(scoped.scriptId)
  }
  if(scripts.some(item=>item.enabled&&!matches.has(item.identity)))throw Error('SCHEMA_SCOPE_SCRIPT_MISMATCH')
}
/** Pure correlations only. The enclosing Core owner must still prove the cut,
 * mutable snapshot and each published-state reference against Native facts. */
export function validateSchemaScopeProgramFrameV4(program:MvuExecutableProgramV4,scope:MvuScopeReadFrameV1,
  binding?:{ownerSessionId:string;sourceNativeCutSha256:string},load=false):void {
  if(scope.source.importId!==program.source.importId||scope.source.rawSha256!==program.source.sourceSha256
    ||binding&&(scope.source.sessionId!==binding.ownerSessionId||scope.sourceNativeCutSha256!==binding.sourceNativeCutSha256)
    ||load&&scope.source.sourceSnapshotSha256!==program.source.sourceSnapshotSha256) {
    throw Error('SCHEMA_SCOPE_BINDING_MISMATCH')
  }
  const matches=new Set<string>()
  const {scripts}=schemaExecutionViewV4(program)
  for(const scoped of scope.scripts) {
    const script=scripts.find(item=>item.pointer===scoped.pointer&&item.sourceSha256===scoped.sourceSha256)
    if(!script||script.identity!==scoped.scriptId||matches.has(script.identity))throw Error('SCHEMA_SCOPE_SCRIPT_MISMATCH')
    matches.add(script.identity)
  }
  if(scripts.some(script=>script.enabled&&!matches.has(script.identity)))throw Error('SCHEMA_SCOPE_SCRIPT_MISMATCH')
}
/** Optional input correlates a stored output with its exact completed phase.
 * Journal reads accept only the explicit schema, atomic update and scope refusals. */
export function validateSchemaGuestOutputV4(raw:unknown,input?:MvuSchemaEvaluationInputV4):MvuSchemaGuestOutputV4 {
  const output=parseGuestOutputV4(raw)
  if(input)assertOutputInputBindingsV4(output,input)
  return output
}
function parseGuestOutputV4(raw:unknown):MvuSchemaGuestOutputV4 {
  const output=cloneSchemaData(raw,MVU_SCHEMA_BOUNDS.outputBytes) as MvuSchemaGuestOutputV4
  const wire=['schemaVersion','encoding','commandsEncoding','errorPolicy','executionPlanSha256']
  if(!output||output.schemaVersion!==4||output.encoding!=='native-mvu-author-schema-phase-output-v4'
    ||output.commandsEncoding!=='native-mvu-update-operations-v2'
    ||!['atomic-refusal','registered-command-policy-v1','update-batch-atomic-v1'].includes(output.errorPolicy)
    ||!hash(output.executionPlanSha256)) {
    throw Error('SCHEMA_OUTPUT_INVALID')
  }
  if(output.kind==='accepted') {
    exact(output,[...wire,'kind','values','commands','context','registrations',
      ...(output.errorPolicy==='registered-command-policy-v1'?['discarded']:[])])
    if(!output.values||typeof output.values!=='object'||Array.isArray(output.values)||!Array.isArray(output.commands)
      ||output.commands.length!==0
      ||!Number.isSafeInteger(output.registrations)||output.registrations<0||output.registrations>MVU_SCHEMA_BOUNDS.scripts) {
      throw Error('SCHEMA_OUTPUT_INVALID')
    }
    output.values=cloneSchemaValues(output.values)
    if(!output.context||typeof output.context!=='object'||Array.isArray(output.context)
      ||Object.hasOwn(output.context,'stat_data'))throw Error('SCHEMA_CONTEXT_INVALID')
    if(output.errorPolicy==='registered-command-policy-v1') {
      if(!Array.isArray(output.discarded)||output.discarded.length>64)throw Error('SCHEMA_OUTPUT_INVALID')
      parseSchemaDiagnosticListV4(output.discarded,true,true,output.registrations)
    }
  } else if(output.kind==='refused') {
    exact(output,[...wire,'kind','diagnostics'])
    if(!Array.isArray(output.diagnostics)||!output.diagnostics.length||output.diagnostics.length>64)throw Error('SCHEMA_OUTPUT_INVALID')
    parseSchemaDiagnosticListV4(output.diagnostics,output.errorPolicy==='registered-command-policy-v1',false,
      undefined,output.errorPolicy==='update-batch-atomic-v1')
  } else throw Error('SCHEMA_OUTPUT_INVALID')
  return output
}
/** Refusals and final C discards share the existing diagnostic wire. Only a
 * registered command phase may carry several stable rejected-command rows. */
function parseSchemaDiagnosticListV4(diagnostics:readonly MvuSchemaDiagnosticV4[],
  registered:boolean,discarded:boolean,registrations?:number,batch=false) {
  const index=(value:unknown,max=64)=>Number.isSafeInteger(value)&&typeof value==='number'&&value>=0&&value<max
  let previousCommand=-1
  let failedRegistrationCount:number|undefined
  for(const item of diagnostics) {
      if(registered&&'commandIndex' in item) {
        if(item.commandIndex<=previousCommand)throw Error('SCHEMA_OUTPUT_INVALID')
        previousCommand=item.commandIndex
      }
      if(item.code==='SCHEMA_SCOPE_READ_FAILED') {
        exact(item,['code','scriptPointer','readCode'])
        if(discarded||diagnostics.length!==1||typeof item.scriptPointer!=='string'
          ||Buffer.byteLength(item.scriptPointer,'utf8')>4096||item.scriptPointer!==''&&!item.scriptPointer.startsWith('/')
          ||typeof item.readCode!=='string'||!(/^(?:SCHEMA_|SCOPE_READ_)[A-Z_]+$/.test(item.readCode)
            ||['SCOPE_SOURCE_UNAVAILABLE','MESSAGE_STATE_UNAVAILABLE'].includes(item.readCode)))throw Error('SCHEMA_OUTPUT_INVALID')
      } else if(item.code==='STATE_ONLY_UPDATE_OPERATION_REJECTED') {
        exact(item,['code','commandIndex','updateCode',...(Object.hasOwn(item,'pointer')?['pointer']:[])])
        if(!index(item.commandIndex)
          ||discarded||!isKnownSchemaUpdateRejectionV2(item.updateCode)||diagnostics.length!==1
          ||item.pointer!==undefined&&(typeof item.pointer!=='string'
            ||Buffer.byteLength(item.pointer,'utf8')>MVU_SCHEMA_BOUNDS.valuesBytes))throw Error('SCHEMA_OUTPUT_INVALID')
      } else if(item.code==='SCHEMA_UPDATE_BATCH_OPERATION_REJECTED') {
        exact(item,['code','commandIndex','updateCode',...(Object.hasOwn(item,'pointer')?['pointer']:[])])
        if(!batch||discarded||diagnostics.length!==1||!index(item.commandIndex)
          ||!isKnownSchemaUpdateRejectionV2(item.updateCode)
          ||item.pointer!==undefined&&(typeof item.pointer!=='string'
            ||Buffer.byteLength(item.pointer,'utf8')>MVU_SCHEMA_BOUNDS.valuesBytes))throw Error('SCHEMA_OUTPUT_INVALID')
      } else if(item.code==='SCHEMA_UPDATE_BATCH_VALIDATION_FAILED') {
        exact(item,['code','registrationIndex'])
        if(!batch||discarded||diagnostics.length!==1||!index(item.registrationIndex))throw Error('SCHEMA_OUTPUT_INVALID')
      } else if(item.code==='SCHEMA_UPDATE_OPERATION_REJECTED') {
        exact(item,['code','commandIndex','registrationIndex','updateCode',...(Object.hasOwn(item,'pointer')?['pointer']:[])])
        if(batch||!index(item.commandIndex)||!index(item.registrationIndex,registrations??64)
          ||!isKnownSchemaUpdateRejectionV2(item.updateCode)||!registered&&diagnostics.length!==1
          ||item.pointer!==undefined&&(typeof item.pointer!=='string'
            ||Buffer.byteLength(item.pointer,'utf8')>MVU_SCHEMA_BOUNDS.valuesBytes))throw Error('SCHEMA_OUTPUT_INVALID')
      } else if(item.code==='SCHEMA_VALIDATION_FAILED') {
        if('commandIndex' in item) {
          exact(item,['code','commandIndex','failedRegistrationIndexes'])
          if(batch||!index(item.commandIndex)||!registered&&item.commandIndex<=previousCommand
            ||!Array.isArray(item.failedRegistrationIndexes)||!item.failedRegistrationIndexes.length
            ||item.failedRegistrationIndexes.length>64)throw Error('SCHEMA_OUTPUT_INVALID')
          if(!registered)previousCommand=item.commandIndex
          // Every registration saw this still-unconsumed command in order.
          if(item.failedRegistrationIndexes.some((value:unknown,position:number)=>value!==position))throw Error('SCHEMA_OUTPUT_INVALID')
          failedRegistrationCount??=item.failedRegistrationIndexes.length
          if(item.failedRegistrationIndexes.length!==failedRegistrationCount)throw Error('SCHEMA_OUTPUT_INVALID')
        } else {
          exact(item,['code','registrationIndex'])
          if(discarded||!index(item.registrationIndex)||diagnostics.length!==1)throw Error('SCHEMA_OUTPUT_INVALID')
        }
      } else throw Error('SCHEMA_OUTPUT_INVALID')
  }
}
function assertOutputInputBindingsV4(output:MvuSchemaGuestOutputV4,input:MvuSchemaEvaluationInputV4):void {
  let diagnostics:readonly MvuSchemaDiagnosticV4[]
  if(output.kind==='accepted') {
    if(output.errorPolicy!=='registered-command-policy-v1')return
    if(input.phase!=='command-parsed'&&output.discarded.length)throw Error('SCHEMA_OUTPUT_INVALID')
    diagnostics=output.discarded
  }else diagnostics=output.diagnostics
  for(const item of diagnostics) {
    if(item.code==='SCHEMA_SCOPE_READ_FAILED') {
      if(input.encoding==='native-mvu-author-schema-phase-input-v4'
        &&!input.scopeReadFrame.scripts.some(script=>script.pointer===item.scriptPointer))throw Error('SCHEMA_OUTPUT_INVALID')
    }else if('commandIndex' in item) {
      if(input.phase!=='command-parsed'||item.commandIndex>=input.commands.length)throw Error('SCHEMA_OUTPUT_INVALID')
    }else if(item.code==='SCHEMA_UPDATE_BATCH_VALIDATION_FAILED') {
      if(input.phase!=='command-parsed'||!input.commands.length)throw Error('SCHEMA_OUTPUT_INVALID')
    }else if(item.code==='SCHEMA_VALIDATION_FAILED'
      &&!['initialization','manual-replacement'].includes(input.phase))throw Error('SCHEMA_OUTPUT_INVALID')
  }
}
/** Reading data does not authorize 0REG. Every current capture and historical
 * replay must additionally bind this envelope to its actual validated program. */
export function validateSchemaGuestOutputForProgramV4(raw:unknown,program:MvuExecutableProgramV4,
  input?:MvuSchemaEvaluationInputV4):MvuSchemaGuestOutputV4 {
  return validateSchemaGuestOutputForParsedProgramV4(raw,validateMvuExecutableProgramV4(program),input)
}
/** The runner's request parser owns the program before its private worker runs.
 * Fresh guest bytes still need the same output grammar and program joins. */
export function validateSchemaGuestOutputForParsedProgramV4(raw:unknown,actual:MvuSchemaWorkerProgramV4,
  input?:MvuSchemaEvaluationInputV4):MvuSchemaGuestOutputV4 {
  const output=parseGuestOutputV4(raw)
  assertSchemaGuestOutputBindingsV4(output,actual,input)
  return output
}
/** The record parser owns output DATA. These joins consume its typed result
 * and correlate the actual program and phase without re-reading either fact. */
export function assertSchemaGuestOutputBindingsV4(output:MvuSchemaGuestOutputV4,actual:MvuSchemaWorkerProgramV4,
  input?:MvuSchemaEvaluationInputV4):void {
  if(input)assertOutputInputBindingsV4(output,input)
  if(output.executionPlanSha256!==actual.executionPlan.executionPlanSha256)throw Error('SCHEMA_OUTPUT_PLAN_MISMATCH')
  const policy=schemaPhaseErrorPolicyForProgramV4(actual)
  if(output.errorPolicy!==policy||input&&input.errorPolicy!==policy)throw Error('SCHEMA_OUTPUT_POLICY_MISMATCH')
  const {stateOnly,enabledServerSchema}=schemaExecutionViewV4(actual)
  if(input?.encoding==='native-mvu-author-schema-phase-input-v4-scope-ref-v2'&&output.kind==='refused') {
    for(const item of output.diagnostics)if(item.code==='SCHEMA_SCOPE_READ_FAILED'
      &&!schemaExecutionViewV4(actual).scripts.some(script=>script.pointer===item.scriptPointer))throw Error('SCHEMA_OUTPUT_INVALID')
  }
  if(output.kind==='accepted') {
    const validRegistrations=stateOnly?output.registrations===0:
      enabledServerSchema>0&&output.registrations>=enabledServerSchema
    if(!validRegistrations)throw Error('SCHEMA_REGISTRATION_MISSING')
    if(stateOnly&&output.errorPolicy==='registered-command-policy-v1'&&output.discarded.length)throw Error('SCHEMA_OUTPUT_INVALID')
  } else for(const item of output.diagnostics) {
    if(item.code==='STATE_ONLY_UPDATE_OPERATION_REJECTED'?!stateOnly:
      stateOnly&&item.code!=='SCHEMA_SCOPE_READ_FAILED')throw Error('SCHEMA_OUTPUT_INVALID')
  }
}
function outputData(json:string):MvuSchemaGuestOutputV4 {
  if(typeof json!=='string'||Buffer.byteLength(json,'utf8')>MVU_SCHEMA_BOUNDS.outputBytes)throw Error('SCHEMA_OUTPUT_LIMIT')
  // The private worker checked fresh guest semantics before emitting these
  // isolated JSON bytes. Parent decoding does not re-own that validation.
  return JSON.parse(json) as MvuSchemaGuestOutputV4
}
function workerMessageData(message:unknown):MvuSchemaWorkerResponseV4 {
  if(message&&typeof message==='object'&&Object.getOwnPropertyDescriptor(message,'json')) {
    const parts=splitSchemaEnvelopeV4(message,['json'],4096),json=parts.fields.json
    if(typeof json!=='string'||Buffer.byteLength(json,'utf8')>MVU_SCHEMA_BOUNDS.outputBytes)throw Error('SCHEMA_OUTPUT_LIMIT')
    return {...parts.header,json} as MvuSchemaWorkerResponseV4
  }
  return cloneSchemaData(message,MVU_SCHEMA_BOUNDS.outputBytes) as MvuSchemaWorkerResponseV4
}
type TracePartsV4=ReturnType<typeof splitSchemaEnvelopeV4>
function traceHeaderData(header:Record<string,unknown>):void {
  exact(header,['schemaVersion','encoding','realmEpoch','loadFrame','prefix','requestedStep'])
  if(header.schemaVersion!==4||!['native-mvu-author-schema-trace-input-v4',
    'native-mvu-author-schema-trace-input-v4-scope-ref-v2'].includes(header.encoding as string)
    ||!hash(header.realmEpoch))throw Error('SCHEMA_TRACE_INPUT_INVALID')
}
function traceFrameBindingData(frame:{ownerSessionId:string;sourceNativeCutSha256:string;material:object}):void {
  if(!identifier(frame.ownerSessionId)||!hash(frame.sourceNativeCutSha256)
    ||!frame.material||typeof frame.material!=='object'||Array.isArray(frame.material))throw Error('SCHEMA_TRACE_FRAME_INVALID')
}
function traceFrameData(program:MvuExecutableProgramV4,frame:MvuSchemaTraceFrameV4):void {
  exact(frame,['ownerSessionId','sourceNativeCutSha256','material','input']);traceFrameBindingData(frame)
  frame.input=evaluationInputData(frame.input,program)
  if(frame.input.encoding==='native-mvu-author-schema-phase-input-v4')validateSchemaScopeProgramFrameV4(program,frame.input.scopeReadFrame,frame)
  else if(frame.input.scopeReadRef.sourceNativeCutSha256!==frame.sourceNativeCutSha256)throw Error('SCHEMA_SCOPE_BINDING_MISMATCH')
}
function requestedStepData(program:MvuExecutableProgramV4,step:MvuSchemaTraceRequestedStepV4,
  hasEvent:(eventId:string)=>boolean):void {
  exact(step,['eventId','frame'])
  if(!identifier(step.eventId)||hasEvent(step.eventId))throw Error('SCHEMA_TRACE_EVENT_INVALID')
  traceFrameData(program,step.frame)
}
function traceInputData(program:MvuExecutableProgramV4,input:unknown,deadline?:number,ownedParts?:TracePartsV4,
  budget?:SchemaMaterialBudgetV4):{input:MvuSchemaTraceInputV4;loadAnchorSha256:string;budget?:SchemaMaterialBudgetV4} {
  // History is a sequence of independently bounded phase records. It is not
  // one new guest input, and must not consume a single phase's DATA budget.
  const parts=ownedParts??splitSchemaEnvelopeV4(input,['loadFrame','prefix','requestedStep'],4096)
  traceHeaderData(parts.header)
  const cloneFrame=schemaEnvelopeSequenceClonerV4(budget)
  const value={...parts.header,loadFrame:cloneFrame(parts.fields.loadFrame,MVU_SCHEMA_BOUNDS.inputBytes),
    requestedStep:cloneFrame(parts.fields.requestedStep,MVU_SCHEMA_BOUNDS.inputBytes),prefix:[]} as unknown as MvuSchemaTraceInputV4
  const load=value.loadFrame
  const references=value.encoding==='native-mvu-author-schema-trace-input-v4-scope-ref-v2'
  const referenceLoad=load.encoding==='native-mvu-author-schema-realm-load-v4-scope-ref-v2'
  exact(load,['schemaVersion','ownerSessionId','sourceNativeCutSha256','material','values','context',
    ...referenceLoad?['encoding','scopeReadRef']:['scopeReadFrame'],'clockEpochMs','randomSeed'])
  traceFrameBindingData(load)
  if(load.schemaVersion!==4||referenceLoad&&!references) {
    throw Error('SCHEMA_TRACE_FRAME_INVALID')
  }
  const initial=evaluationInputData({schemaVersion:4,...schemaPhaseScopeFromLoadV4(load),
    commandsEncoding:'native-mvu-update-operations-v2',errorPolicy:schemaPhaseErrorPolicyForProgramV4(program),
    phase:'initialization',base:null,values:load.values,commands:[],
    context:load.context,clockEpochMs:load.clockEpochMs,randomSeed:load.randomSeed},program)
  load.values=initial.values;load.context=initial.context
  if(initial.encoding==='native-mvu-author-schema-phase-input-v4') {
    load.scopeReadFrame=initial.scopeReadFrame;validateSchemaScopeProgramFrameV4(program,initial.scopeReadFrame,load,true)
  } else {
    load.scopeReadRef=initial.scopeReadRef
    if(initial.scopeReadRef.sourceNativeCutSha256!==load.sourceNativeCutSha256)throw Error('SCHEMA_SCOPE_BINDING_MISMATCH')
  }
  const ids=new Set<string>()
  const loadAnchorSha256=recordSha256({programSha256:program.programSha256,realmEpoch:value.realmEpoch,loadFrame:load})
  let previous=loadAnchorSha256
  const prefix:MvuSchemaTraceStepRecordV4[]=[]
  for(const [index,raw] of schemaSequenceItemsV4(parts.fields.prefix).entries()) {
    if(deadline!==undefined&&performance.now()>=deadline)throw Error('SCHEMA_COLD_REPLAY_TIMEOUT')
    const row=splitSchemaEnvelopeV4(raw,['frame','output'],4096)
    const step={...row.header,frame:cloneFrame(row.fields.frame,MVU_SCHEMA_BOUNDS.inputBytes),
      output:row.fields.output} as unknown as MvuSchemaTraceStepRecordV4
    exact(step,['eventId','frame','ordinal','previousStepSha256','output','stepSha256'])
    if(!identifier(step.eventId)||ids.has(step.eventId)||step.ordinal!==index+1||step.previousStepSha256!==previous
      ||!hash(step.stepSha256))throw Error('SCHEMA_TRACE_PREFIX_INVALID')
    ids.add(step.eventId);traceFrameData(program,step.frame)
    if(!references&&step.frame.input.encoding==='native-mvu-author-schema-phase-input-v4-scope-ref-v2')throw Error('SCHEMA_TRACE_INPUT_INVALID')
    step.output=validateSchemaGuestOutputForParsedProgramV4(step.output,program,step.frame.input)
    const {stepSha256,...body}=step
    if(recordSha256(body)!==stepSha256)throw Error('SCHEMA_TRACE_PREFIX_INVALID')
    previous=stepSha256
    prefix.push(step)
  }
  value.prefix=prefix
  requestedStepData(program,value.requestedStep,eventId=>ids.has(eventId))
  if(!references&&value.requestedStep.frame.input.encoding==='native-mvu-author-schema-phase-input-v4-scope-ref-v2') {
    throw Error('SCHEMA_TRACE_INPUT_INVALID')
  }
  return {input:value,loadAnchorSha256,budget}
}
export function validateSchemaTraceInputV4(program:MvuExecutableProgramV4,input:unknown):MvuSchemaTraceInputV4 {
  return traceInputData(program,input).input
}
const safeCode=(code:unknown,fallback:string)=>typeof code==='string'&&/^SCHEMA_[A-Z_]+$/.test(code)?code:fallback
interface ScopeBindingV2 {read:MvuSchemaScopeReferenceReaderV2}
function scopeTransportV2(program:MvuExecutableProgramV4,binding?:ScopeBindingV2,realmEpoch?:string) {
  let resolver:ReturnType<typeof createMvuScopeViewResolverV2>|undefined,baseKey:string|undefined
  return {
    capture(input:MvuSchemaEvaluationInputV4|MvuSchemaRealmLoadFrameV4,
      frame?:{ownerSessionId:string;sourceNativeCutSha256:string},load=false):readonly MvuScopeReadObjectV2[]|undefined {
      if(!input.scopeReadRef)return
      if(!binding)throw Error('SCHEMA_SCOPE_REFERENCE_READER_REQUIRED')
      const reference=input.scopeReadRef
      const key=JSON.stringify([reference.baseRef.ownerSessionId,reference.baseRef.key,reference.baseRef.sha256])
      if(baseKey!==key) {
        // A child Source owns a new base after its ancestor's proved prefix.
        // Keep the JS realm; only this phase's closed scope view changes.
        resolver=createMvuScopeViewResolverV2({read:binding.read});baseKey=key
      }
      if(frame&&frame.sourceNativeCutSha256!==reference.sourceNativeCutSha256)throw Error('SCHEMA_SCOPE_BINDING_MISMATCH')
      const resolved=resolver!.resolve(reference)
      if(realmEpoch!==undefined&&resolved.realmEpoch!==realmEpoch)throw Error('SCHEMA_SCOPE_BINDING_MISMATCH')
      validateSchemaScopeProgramViewV2(program,resolved.view,resolved.scripts(),frame,load)
      return resolved.readObjects
    },
    dispose(){resolver=undefined;baseKey=undefined},
  }
}

export function createMvuSchemaRunnerV4(deps:MvuSchemaRunnerDepsV4):MvuSchemaRunnerV4 {
  // No guest or persisted program can choose the worker path or library bytes.
  const workerUrl=new URL(deps.workerUrl??new URL('./tavern-mvu-schema-worker-v4.mjs',import.meta.url))
  const identity=Object.freeze(cloneSchemaData(deps.identity,4096))
  const bridge=Object.freeze(cloneSchemaData(deps.bridge,4096))
  const stateLoader=Object.freeze(cloneSchemaData(deps.stateLoader,4096))
  const libraries=cloneSchemaData(deps.libraries,MVU_SCHEMA_BOUNDS.programBytes)
  const libraryIdentities:MvuSchemaLibraryIdentity[]=[]
  let availability:string|undefined
  try {
    implementation(identity);implementation(bridge);implementation(stateLoader)
    if(workerUrl.protocol!=='file:')throw Error('SCHEMA_WORKER_UNAVAILABLE')
    exact(identity,['id','version','implementationSha256','quickjsVersion'])
    exact(bridge,['id','version','implementationSha256'])
    exact(stateLoader,['id','version','implementationSha256'])
    if(!same(stateLoader,deriveOwnedStateLoaderIdentityV4(bridge)))throw Error('SCHEMA_STATE_LOADER_UNAVAILABLE')
    if(identity.quickjsVersion!=='0.32.0'||identity.version!==4||bridge.version!==4)throw Error('SCHEMA_IMPLEMENTATION_UNAVAILABLE')
    if(libraries.length!==2||new Set(libraries.map(library=>library.kind)).size!==2)throw Error('SCHEMA_LIBRARY_UNAVAILABLE')
    for(const library of libraries) {
      exact(library,['kind','packageName','version','bundleSha256','globalName','code'])
      if(library.packageName!==library.kind||library.version!==(library.kind==='zod'?'4.4.3':'4.18.1')
        ||!['zod','lodash'].includes(library.kind)||!/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(library.globalName)
        ||schemaTextSha256(library.code)!==library.bundleSha256)throw Error('SCHEMA_LIBRARY_UNAVAILABLE')
      const {code:_code,...libraryIdentity}=library
      libraryIdentities.push(libraryIdentity)
    }
  } catch(error) {availability=safeCode(error instanceof Error?error.message:undefined,'SCHEMA_IMPLEMENTATION_UNAVAILABLE')}
  let disposed=false
  let disposal:Promise<void>|undefined
  const active=new Map<Worker,{finish():void;closed:Promise<void>}>()
  function preflight(signal?:AbortSignal):RunnerFailure|undefined {
    if(disposed)return unavailable('SCHEMA_RUNNER_DISPOSED')
    if(signal?.aborted)return cancelled()
    if(availability)return unavailable(availability)
    if(active.size>=4)return unavailable('SCHEMA_RUNNER_BUSY')
  }
  function programData(program:MvuExecutableProgramV4):MvuExecutableProgramV4 {
    const frozenProgram=validateMvuExecutableProgramV4(program)
    programBindings(frozenProgram)
    return frozenProgram
  }
  function programBindings(program:MvuExecutableProgramV4):void {
    if(program.compiler.version!==4)throw Error('SCHEMA_IMPLEMENTATION_UNAVAILABLE')
    if(!same(program.bridge,bridge))throw Error('SCHEMA_BRIDGE_UNAVAILABLE')
    if(!same(program.stateLoader,stateLoader))throw Error('SCHEMA_STATE_LOADER_UNAVAILABLE')
    if(!same(program.libraries,libraryIdentities))throw Error('SCHEMA_LIBRARY_UNAVAILABLE')
  }
  function packWorkerRequest(request:MvuSchemaWorkerInputV4) {
    const stateOnly=schemaExecutionViewV4(request.program).stateOnly
    const program=stateOnly?{...request.program,source:withoutMaterial(request.program.source)}:request.program
    let payload:MvuSchemaWorkerRequestV4=stateOnly?{...request,program}:{...request,program,libraries}
    if(stateOnly&&'trace' in request) {
      const trace=request.trace
      payload={...request,program,trace:{...trace,loadFrame:withoutMaterial(trace.loadFrame),
        prefix:trace.prefix.map(step=>({...step,frame:withoutMaterial(step.frame)})),
        requestedStep:{...trace.requestedStep,frame:withoutMaterial(trace.requestedStep.frame)}}}
    }
    return packSchemaEnvelopeV4(payload,2*MVU_SCHEMA_BOUNDS.programBytes+MVU_SCHEMA_BOUNDS.inputBytes,evaluationBounds)
  }
  async function executeWorker(request:MvuSchemaWorkerInputV4,signal?:AbortSignal,
    scopeObjects?:readonly MvuScopeReadObjectV2[]):Promise<MvuSchemaWorkerEvaluationResponseV4|RunnerFailure> {
    // The caller preflights before synchronous parsing, then reaches this
    // worker start without yielding. It owns admission for the same state.
    let wire:MvuSchemaScopeWorkerSeedV2|ReturnType<typeof packWorkerRequest>
    try {
      const packed=packWorkerRequest(request)
      wire=scopeObjects?{kind:'scope-reference-request-v2',request:packed,scopeObjects} satisfies MvuSchemaScopeWorkerSeedV2:packed
    } catch {return unavailable('SCHEMA_WORKER_UNAVAILABLE')}
    let worker:Worker
    deps.beforeWorkerLoad?.()
    try {
      worker=new Worker(workerUrl,{workerData:wire,env:{TZ:'UTC'},resourceLimits:{maxOldGenerationSizeMb:256,stackSizeMb:4}})
    } catch {return unavailable('SCHEMA_WORKER_UNAVAILABLE')}
    const closed=Promise.withResolvers<void>()
    const execute=async():Promise<MvuSchemaWorkerEvaluationResponseV4|RunnerFailure>=>{try {
      const result=await new Promise<MvuSchemaWorkerEvaluationResponseV4|RunnerFailure>(resolve=>{
        let settled=false
        const finish=(value:MvuSchemaWorkerEvaluationResponseV4|RunnerFailure)=>{
          if(settled)return
          settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort)
          resolve(value)
        }
        const abort=()=>finish(cancelled())
        const timer=setTimeout(()=>finish(unavailable('SCHEMA_HARD_TIMEOUT')),MVU_SCHEMA_BOUNDS.parentDeadlineMs)
        active.set(worker,{finish:()=>finish(unavailable('SCHEMA_RUNNER_DISPOSED')),closed:closed.promise})
        signal?.addEventListener('abort',abort,{once:true})
        worker.once('message',(message:unknown)=>{
          try {
            const value=workerMessageData(message) as MvuSchemaWorkerEvaluationResponseV4
            if(value.kind==='output'||value.kind==='trace-output'||value.kind==='next-output')exact(value,['kind','json'])
            else {
              exact(value,['kind','code'])
              if(value.kind!=='unavailable'||!/^SCHEMA_[A-Z_]+$/.test(value.code))throw Error()
            }
            finish(value)
          } catch {finish(unavailable('SCHEMA_WORKER_OUTPUT_INVALID'))}
        })
        worker.once('error',()=>finish(unavailable('SCHEMA_WORKER_UNAVAILABLE')))
        worker.once('exit',()=>finish(unavailable('SCHEMA_WORKER_EXIT')))
        if(signal?.aborted)abort()
        if(disposed)finish(unavailable('SCHEMA_RUNNER_DISPOSED'))
      })
      if(signal?.aborted)return cancelled()
      if(disposed)return unavailable('SCHEMA_RUNNER_DISPOSED')
      return result
    } finally {try {await worker.terminate()}finally {active.delete(worker);closed.resolve()}}}
    const outcome=await execute().catch(()=>unavailable('SCHEMA_WORKER_CLEANUP'))
    // The VM must actually terminate before its output can be used. Stop or
    // disposal during cleanup invalidates an already received guest message.
    return signal?.aborted?cancelled():disposed?unavailable('SCHEMA_RUNNER_DISPOSED'):outcome
  }
  async function evaluate(program:MvuExecutableProgramV4,input:MvuSchemaEvaluationInputV4,signal?:AbortSignal,
    scopeBinding?:ScopeBindingV2):Promise<MvuSchemaRunResultV4> {
    const blocked=preflight(signal)
    if(blocked)return blocked
    let frozenProgram:MvuExecutableProgramV4,frozenInput:MvuSchemaEvaluationInputV4
    let scopeObjects:readonly MvuScopeReadObjectV2[]|undefined
    try {
      frozenProgram=programData(program);frozenInput=validateSchemaEvaluationInputV4(input,frozenProgram)
      if(frozenInput.encoding==='native-mvu-author-schema-phase-input-v4')validateSchemaScopeProgramFrameV4(frozenProgram,frozenInput.scopeReadFrame)
      else {
        const transport=scopeTransportV2(frozenProgram,scopeBinding)
        try {scopeObjects=transport.capture(frozenInput)}finally{transport.dispose()}
      }
    }catch(error) {
      return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_INPUT_INVALID'))
    }
    const result=await executeWorker({program:frozenProgram,input:frozenInput},signal,scopeObjects)
    if(signal?.aborted)return cancelled()
    if(disposed)return unavailable('SCHEMA_RUNNER_DISPOSED')
    if('diagnostics' in result)return result
    let output:MvuSchemaGuestOutputV4
    if(result.kind==='output') {
      try {output=outputData(result.json)} catch(error) {
        return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_OUTPUT_INVALID'))
      }
    } else if(result.kind==='unavailable')return unavailable(result.code)
    else return unavailable('SCHEMA_WORKER_OUTPUT_INVALID')
    const body={schemaVersion:4 as const,encoding:'native-mvu-author-schema-evaluation-v4' as const,
      programSha256:frozenProgram.programSha256,runner:identity,input:frozenInput,inputSha256:recordSha256(frozenInput),output}
    try {
      return {kind:'evaluated',evaluation:cloneSchemaData({...body,evaluationSha256:recordSha256(body)},evaluationBytes,evaluationBounds)}
    } catch {return unavailable('SCHEMA_EVALUATION_LIMIT')}
  }
  async function evaluateTrace(program:MvuExecutableProgramV4,input:MvuSchemaTraceInputV4,signal?:AbortSignal,
    scopeBinding?:ScopeBindingV2):Promise<MvuSchemaTraceRunResultV4> {
    const deadline=performance.now()+coldReplayDeadlineMs
    const blocked=preflight(signal)
    if(blocked)return blocked
    let frozenProgram:MvuExecutableProgramV4,frozenInput:MvuSchemaTraceInputV4,parsed:ReturnType<typeof traceInputData>
    try {
      frozenProgram=programData(program)
      parsed=traceInputData(frozenProgram,input,deadline)
      frozenInput=parsed.input
    }catch(error) {
      return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_TRACE_INPUT_INVALID'))
    }
    const result=await openLiveRun(frozenProgram,frozenInput,signal,true,parsed,deadline,true,scopeBinding)
    if(result.kind!=='opened-manual-run')return result
    try {
      await result.run.close()
      if(signal?.aborted)return cancelled()
      if(disposed)return unavailable('SCHEMA_RUNNER_DISPOSED')
      // Every historical output was just checked in the actual realm. Reuse
      // those owned records rather than returning and reparsing all guest JSON.
      const records=frozenInput.prefix.map(({frame,...record})=>({...record,frameSha256:recordSha256(frame)}))
      records.push(result.record)
      const body={schemaVersion:4 as const,encoding:'native-mvu-author-schema-trace-evaluation-v4' as const,
        programSha256:frozenProgram.programSha256,runner:identity,input:frozenInput,inputSha256:recordSha256(frozenInput),records}
      const evaluation={...body,evaluationSha256:recordSha256(body)}
      if(performance.now()>=deadline)return unavailable('SCHEMA_COLD_REPLAY_TIMEOUT')
      return {kind:'evaluated-trace',evaluation}
    } catch(error) {return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_TRACE_OUTPUT_INVALID'))}
  }
  type HotRun={key:string;programSha256:string;realmEpoch:string;ordinal:number;stepSha256:string;
    budget:SchemaMaterialBudgetV4;run:MvuSchemaManualRunV4;scopeBinding?:ScopeBindingV2}
  let hotRun:HotRun|undefined,hotBusy=false
  // One parked realm per runner. Only the exact checked continuation may use
  // its closures; a fork, retry or changed Source/load identity starts cold.
  function evaluateNext(program:MvuExecutableProgramV4,input:MvuSchemaTraceInputV4,signal?:AbortSignal):Promise<MvuSchemaNextRunResultV4> {
    return evaluateNextInput(program,input,signal)
  }
  async function evaluateNextInput(program:MvuExecutableProgramV4,input:MvuSchemaTraceInputV4,signal?:AbortSignal,
    reader?:MvuSchemaOwnedPrefixReaderV4,scopeBinding?:ScopeBindingV2):Promise<MvuSchemaNextRunResultV4> {
    const deadline=performance.now()+coldReplayDeadlineMs
    const blocked=preflight(signal)
    if(blocked)return blocked
    if(hotBusy)return unavailable('SCHEMA_RUNNER_BUSY')
    let parsed:ReturnType<typeof traceInputData>|undefined,requested:MvuSchemaTraceRequestedStepV4
    let reuse=false,delta:SchemaMaterialBudgetDeltaV4|undefined
    try {
      programBindings(program)
      // Only a factory-bound Host reader can supply checked history. Raw DTO
      // properties, symbols and freeze markers are never consulted here.
      const owned=reader?.(input),current=hotRun
      if(owned) {
        const parts=splitSchemaEnvelopeV4(input,['loadFrame','prefix','requestedStep'],4096)
        traceHeaderData(parts.header)
        reuse=!!current&&owned.programSha256===program.programSha256&&current.programSha256===program.programSha256
          &&owned.realmEpoch===parts.header.realmEpoch&&current.realmEpoch===owned.realmEpoch
          &&current.key===owned.loadAnchorSha256&&current.ordinal===owned.length&&current.stepSha256===owned.tailSha256
          &&current.scopeBinding===scopeBinding
        if(reuse) {
          requested=cloneSchemaEnvelopeV4(parts.fields.requestedStep,MVU_SCHEMA_BOUNDS.inputBytes) as MvuSchemaTraceRequestedStepV4
          requestedStepData(program,requested,eventId=>owned.hasEvent(eventId))
          const references=parts.header.encoding==='native-mvu-author-schema-trace-input-v4-scope-ref-v2'
          if(!references&&requested.frame.input.encoding==='native-mvu-author-schema-phase-input-v4-scope-ref-v2') {
            throw Error('SCHEMA_TRACE_INPUT_INVALID')
          }
          delta=schemaMaterialBudgetDeltaV4(current!.budget,requested.frame.material)
        }else {
          // A cold/changed realm must execute every genuine historical frame;
          // the caller's [] placeholder can never become an empty replay.
          parsed=traceInputData(program,input,deadline,{header:parts.header,
            fields:{...parts.fields,prefix:owned.materialize()}},createSchemaMaterialBudgetV4())
          requested=parsed.input.requestedStep
        }
      }else {
        parsed=traceInputData(program,input,deadline,undefined,createSchemaMaterialBudgetV4())
        requested=parsed.input.requestedStep
      }
      if(parsed) {
        const prefix=parsed.input.prefix,last=prefix.at(-1)
        reuse=!owned&&!!current&&current.programSha256===program.programSha256&&current.realmEpoch===parsed.input.realmEpoch
          &&current.key===parsed.loadAnchorSha256&&prefix.length===current.ordinal&&last?.stepSha256===current.stepSha256
          &&current.scopeBinding===scopeBinding
      }
    }catch(error) {
      return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_TRACE_INPUT_INVALID'))
    }
    hotBusy=true
    try {
      const current=hotRun
      if(current&&!reuse) {
        hotRun=undefined
        await current.run.close()
      }
      if(signal?.aborted)return cancelled()
      if(disposed)return unavailable('SCHEMA_RUNNER_DISPOSED')
      let result:MvuSchemaNextRunResultV4
      if(hotRun) {
        result=await hotRun.run.advance(requested,signal)
      }else {
        const cold=parsed!
        const opened=await openLiveRun(program,cold.input,signal,true,cold,deadline,false,scopeBinding)
        if(opened.kind!=='opened-manual-run')return signal?.aborted?cancelled(opened):opened
        hotRun={key:cold.loadAnchorSha256,programSha256:program.programSha256,realmEpoch:cold.input.realmEpoch,
          ordinal:opened.record.ordinal,stepSha256:opened.record.stepSha256,budget:cold.budget!,run:opened.run,scopeBinding}
        result={kind:'evaluated-next',record:opened.record}
      }
      if(result.kind==='evaluated-next'&&result.record.output.kind==='accepted'&&!signal?.aborted&&!disposed) {
        hotRun!.ordinal=result.record.ordinal;hotRun!.stepSha256=result.record.stepSha256
        if(parsed)hotRun!.budget=parsed.budget!
        else if(delta) {
          hotRun!.budget.hashes.add(delta.sha256)
          hotRun!.budget.bytes+=delta.bytes;hotRun!.budget.nodes+=delta.nodes
        }
      }
      else {
        const failed=hotRun;hotRun=undefined
        try {await failed?.run.close()}catch(error) {
          if(result.kind==='evaluated-next')throw error
          const code=safeCode(error instanceof Error?error.message:undefined,'SCHEMA_WORKER_CLEANUP')
          if(!result.diagnostics.some(item=>item.code===code))result={...result,diagnostics:[...result.diagnostics,{code}]}
        }
      }
      return signal?.aborted?cancelled('diagnostics' in result?result:undefined):disposed?unavailable('SCHEMA_RUNNER_DISPOSED'):result
    }catch(error) {
      const failed=hotRun;hotRun=undefined
      await failed?.run.close().catch(()=>undefined)
      const failure=unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_WORKER_CLEANUP'))
      return signal?.aborted?cancelled(failure):failure
    }finally {hotBusy=false}
  }
  async function openManualRun(program:MvuExecutableProgramV4,input:MvuSchemaTraceInputV4,
    signal?:AbortSignal,scopeBinding?:ScopeBindingV2):Promise<MvuSchemaOpenManualRunResultV4> {
    return openLiveRun(program,input,signal,false,undefined,performance.now()+coldReplayDeadlineMs,false,scopeBinding)
  }
  async function openLiveRun(program:MvuExecutableProgramV4,input:MvuSchemaTraceInputV4,
    signal?:AbortSignal,hot=false,owned?:ReturnType<typeof traceInputData>,
    deadline=performance.now()+coldReplayDeadlineMs,closeAfterFirst=false,scopeBinding?:ScopeBindingV2):Promise<MvuSchemaOpenManualRunResultV4> {
    const blocked=preflight(signal)
    if(blocked)return blocked
    let parsed:ReturnType<typeof traceInputData>
    try {programBindings(program);parsed=owned??traceInputData(program,input,deadline)}catch(error) {
      return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_TRACE_INPUT_INVALID'))
    }
    return startLiveRun(program,{realmEpoch:parsed.input.realmEpoch,loadFrame:parsed.input.loadFrame,prefix:parsed.input.prefix,
      requestedStep:parsed.input.requestedStep,loadAnchorSha256:parsed.loadAnchorSha256},signal,hot,deadline,closeAfterFirst,scopeBinding)
  }
  async function startLiveRun(program:MvuExecutableProgramV4,
    {realmEpoch,loadFrame,prefix:replayPrefix,requestedStep:requested,loadAnchorSha256}:{
      realmEpoch:string;
      loadFrame:MvuSchemaRealmLoadFrameV4;prefix:readonly MvuSchemaTraceStepRecordV4[];
      requestedStep:MvuSchemaTraceRequestedStepV4;loadAnchorSha256:string},
    signal:AbortSignal|undefined,hot:boolean,deadline:number,closeAfterFirst:boolean,
    scopeBinding?:ScopeBindingV2):Promise<MvuSchemaOpenManualRunResultV4> {
    const stateOnly=schemaExecutionViewV4(program).stateOnly
    const manualProgram=hot?null:program
    const sendEnvelope=schemaEnvelopeWireSenderV4()
    const scopes=scopeTransportV2(program,scopeBinding,realmEpoch)
    let wire:MvuSchemaHotWorkerSeedV4
    try {
      wire={kind:'live-open',mode:hot?'hot':'manual-stream',
        header:sendEnvelope({program:stateOnly?{...program,source:withoutMaterial(program.source)}:program,
          ...stateOnly?{}:{libraries}},
          2*MVU_SCHEMA_BOUNDS.programBytes,evaluationBounds),
        load:sendEnvelope(stateOnly?withoutMaterial(loadFrame):loadFrame,MVU_SCHEMA_BOUNDS.inputBytes),
        ...loadFrame.scopeReadRef?{scopeObjects:scopes.capture(loadFrame,loadFrame,true)}:{}}
    }catch(error) {scopes.dispose();return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_DATA_INVALID'))}
    let worker:Worker
    try {deps.beforeWorkerLoad?.()}catch(error) {scopes.dispose();throw error}
    try {
      worker=new Worker(workerUrl,{workerData:wire,env:{TZ:'UTC'},
        resourceLimits:{maxOldGenerationSizeMb:256,stackSizeMb:4}})
    }catch {scopes.dispose();return unavailable('SCHEMA_WORKER_UNAVAILABLE')}

    const material=hot?undefined:requested.frame.material
    let ordinal=replayPrefix.length+1
    let previous=replayPrefix.at(-1)?.stepSha256??loadAnchorSha256
    let state:'processing'|'parked'|'closing'|'closed'='processing'
    let ownerSignal:AbortSignal|undefined,stopResult:RunnerFailure|undefined,closeFault:Error|undefined
    let pending=Promise.withResolvers<MvuSchemaNextRunResultV4>()
    const first=pending.promise,done=Promise.withResolvers<void>()
    type CloseReceipt=Extract<MvuSchemaManualWorkerResponseV4,{kind:'manual-closed'}>
    const receipt=Promise.withResolvers<CloseReceipt|undefined>()
    let receivedClose=false,closePromise:Promise<void>|undefined
    let activeMs=0,processingStarted:number|undefined,timer:ReturnType<typeof setTimeout>|undefined
    let coldTimer:ReturnType<typeof setTimeout>|undefined
    let replayIndex=0,expectedReplaySha256:string|undefined
    const coldExpired=()=>coldTimer!==undefined&&performance.now()>=deadline
    function finishColdRecovery():void {
      if(coldTimer!==undefined)clearTimeout(coldTimer)
      coldTimer=undefined
    }
    function sendStreamStep():void {
      if(coldExpired()){forceClose(unavailable('SCHEMA_COLD_REPLAY_TIMEOUT'));return}
      pauseProcessing();activeMs=0;startProcessing()
      const historical=replayPrefix[replayIndex]
      expectedReplaySha256=historical?.stepSha256
      let message:MvuSchemaManualWorkerMessageV4
      try {
        if(historical)message={kind:'hot-replay',step:sendEnvelope(stateOnly?
          {...historical,frame:withoutMaterial(historical.frame)}:historical,phaseRecordBytes,evaluationBounds)}
        else {
          // Replay metadata is no longer needed after its final ACK. Only the
          // current requested frame and scalar continuation identity remain;
          // evaluateTrace's outer owner retains its own evaluation input.
          replayPrefix=[]
          message={kind:'hot-advance',step:sendEnvelope(stateOnly?
            {...requested,frame:withoutMaterial(requested.frame)}:requested,MVU_SCHEMA_BOUNDS.inputBytes)}
        }
        const target=historical??requested
        if(target.frame.input.scopeReadRef)message.scopeObjects=scopes.capture(target.frame.input,target.frame)
      }catch(error) {
        forceClose(unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_DATA_INVALID')));return
      }
      postMessage(message)
    }
    function postMessage(message:MvuSchemaManualWorkerMessageV4):void {
      try {worker.postMessage(message)}catch {forceClose(unavailable('SCHEMA_WORKER_UNAVAILABLE'))}
    }
    function pauseProcessing():void {
      if(processingStarted!==undefined){activeMs+=performance.now()-processingStarted;processingStarted=undefined}
      if(timer!==undefined)clearTimeout(timer)
      timer=undefined
    }
    function processingExpired():boolean {
      return activeMs+(processingStarted===undefined?0:performance.now()-processingStarted)>=MVU_SCHEMA_BOUNDS.parentDeadlineMs
    }
    function startProcessing():void {
      worker.ref()
      processingStarted=performance.now()
      timer=setTimeout(()=>forceClose(unavailable('SCHEMA_HARD_TIMEOUT')),
        Math.max(0,MVU_SCHEMA_BOUNDS.parentDeadlineMs-activeMs))
    }
    // Terminal, explicit close, abort and dispose all observe this one promise.
    // A forced kill has no all-disposer receipt and can only reject as unknown.
    function finishClose():Promise<void> {
      if(closePromise)return closePromise
      closePromise=(async()=>{
        const closed=await receipt.promise
        try {
          // Node's terminate promise settles on actual exit. It is the single
          // termination owner; the exit listener below only detects failure.
          await worker.terminate()
          if(closed?.cleanup!=='completed')throw Error(closed?.cleanup==='failed'?closed.code:'SCHEMA_WORKER_CLEANUP')
          if(processingExpired())throw Error('SCHEMA_HARD_TIMEOUT')
          if(coldExpired())throw Error('SCHEMA_COLD_REPLAY_TIMEOUT')
          if(closeFault)throw closeFault
        }catch(error) {
          closeFault=error instanceof Error?error:Error('SCHEMA_WORKER_CLEANUP')
          throw closeFault
        }finally {
          pauseProcessing();finishColdRecovery();ownerSignal?.removeEventListener('abort',abort)
          state='closed';active.delete(worker);done.resolve()
          scopes.dispose()
          if(hotRun?.run===run)hotRun=undefined
        }
      })()
      // A parked cancellation can settle before its owner next calls close.
      // Keep its rejection for that owner without an unhandled Node rejection.
      void closePromise.catch(()=>undefined)
      return closePromise
    }
    function settleTerminal(result?:MvuSchemaWorkerEvaluationResponseV4):void {
      const waiting=pending
      void finishClose().then(()=>{
        if(stopResult){waiting.resolve(stopResult);return}
        if(result?.kind==='next-output') {
          try {
            const record=traceRecord(requested,ordinal,previous,outputData(result.json))
            waiting.resolve({kind:'evaluated-next',record})
          }catch(error) {waiting.resolve(unavailable(safeCode(error instanceof Error?error.message:undefined,
            'SCHEMA_TRACE_OUTPUT_INVALID')))}
        }else waiting.resolve(unavailable(result?.kind==='unavailable'?result.code:'SCHEMA_MANUAL_RUN_CLOSED'))
      },error=>{
        const code=safeCode(error instanceof Error?error.message:undefined,'SCHEMA_WORKER_CLEANUP')
        waiting.resolve(stopResult?{...stopResult,diagnostics:[...stopResult.diagnostics,
          ...stopResult.diagnostics.some(item=>item.code===code)?[]:[{code}]]}:unavailable(code))
      })
    }
    function forceClose(result:RunnerFailure):void {
      if(state==='closed')return
      stopResult??=result;closeFault??=Error('SCHEMA_WORKER_CLEANUP')
      state='closing';receipt.resolve(undefined);settleTerminal()
    }
    function requestClose(result?:RunnerFailure):Promise<void> {
      if(result)stopResult??=result
      if(state==='parked') {
        // Cleanup owns a separate bounded interval. A successful foreground
        // edit must not spend its remaining cumulative budget on VM disposal.
        activeMs=0;state='closing';startProcessing()
        postMessage({kind:'close'})
      }else if(state==='processing')forceClose(result??unavailable('SCHEMA_MANUAL_RUN_CLOSED'))
      return finishClose()
    }
    function abort():void {void requestClose(cancelled()).catch(()=>undefined)}
    function bindSignal(next?:AbortSignal):void {
      ownerSignal?.removeEventListener('abort',abort);ownerSignal=next
      next?.addEventListener('abort',abort,{once:true})
      if(next?.aborted)abort()
    }
    worker.on('message',(message:unknown)=>{
      if(state==='closed'||state==='closing'&&!receivedClose&&closeFault)return
      try {
        const value=workerMessageData(message) as MvuSchemaManualWorkerResponseV4
        if(value.kind==='hot-ready') {
          exact(value,['kind'])
          sendStreamStep()
        }else if(value.kind==='hot-replayed') {
          exact(value,['kind','stepSha256'])
          if(value.stepSha256!==expectedReplaySha256)throw Error('SCHEMA_TRACE_PREFIX_MISMATCH')
          replayIndex++;sendStreamStep()
        }else if(value.kind==='manual-phase') {
          exact(value,['kind','json'])
          const output=outputData(value.json),record=traceRecord(requested,ordinal,previous,output)
          if(coldExpired()){forceClose(unavailable('SCHEMA_COLD_REPLAY_TIMEOUT'));return}
          if(processingExpired()){forceClose(unavailable('SCHEMA_HARD_TIMEOUT'));return}
          pauseProcessing();state='parked';previous=record.stepSha256
          if(!closeAfterFirst)finishColdRecovery()
          if(hot) {
            worker.unref()
            // The runner owns a parked Story realm. A completed request's
            // cancellation signal must not own a later, unrelated phase.
            ownerSignal?.removeEventListener('abort',abort);ownerSignal=undefined
          }
          pending.resolve({kind:'evaluated-next',record})
        }else if(value.kind==='manual-closed') {
          if(value.cleanup==='completed')exact(value,['kind','cleanup',...(value.result?['result']:[])])
          else if(value.cleanup==='failed')exact(value,['kind','cleanup','code'])
          else throw Error('SCHEMA_WORKER_OUTPUT_INVALID')
          if(state==='processing') {
            // A terminal phase already completed guest cleanup. Preserve its
            // foreground deadline outcome before assigning Node termination
            // a fresh cleanup interval, just as explicit parked close does.
            pauseProcessing()
            if(processingExpired())stopResult??=unavailable('SCHEMA_HARD_TIMEOUT')
            activeMs=0;startProcessing()
          }
          receivedClose=true;state='closing';receipt.resolve(value)
          settleTerminal(value.cleanup==='completed'?value.result:undefined)
        }else throw Error('SCHEMA_WORKER_OUTPUT_INVALID')
      }catch {forceClose(unavailable('SCHEMA_WORKER_OUTPUT_INVALID'))}
    })
    worker.once('error',()=>forceClose(unavailable('SCHEMA_WORKER_UNAVAILABLE')))
    worker.once('exit',()=>{if(!receivedClose)forceClose(unavailable('SCHEMA_WORKER_EXIT'))})
    const run:MvuSchemaManualRunV4={
      async advance(step,nextSignal) {
        if(state!=='parked')return closeFault?unavailable(safeCode(closeFault.message,'SCHEMA_WORKER_CLEANUP')):
          stopResult??unavailable('SCHEMA_MANUAL_RUN_CLOSED')
        let fresh:MvuSchemaManualRequestedStepV4|MvuSchemaTraceRequestedStepV4
        try {
          // A hot run is private to evaluateNext, whose parser already owns
          // this complete frame. The public manual entry still owns its DATA.
          fresh=hot?step:cloneSchemaData(step,MVU_SCHEMA_BOUNDS.inputBytes) as MvuSchemaManualRequestedStepV4
          if(!hot) {
            exact(fresh,['eventId','frame']);exact(fresh.frame,['ownerSessionId','sourceNativeCutSha256','input'])
            if(!identifier(fresh.eventId)||!identifier(fresh.frame.ownerSessionId)||!hash(fresh.frame.sourceNativeCutSha256)) {
              throw Error('SCHEMA_TRACE_FRAME_INVALID')
            }
            fresh.frame.input=evaluationInputData(fresh.frame.input,manualProgram!)
            if(fresh.frame.input.encoding==='native-mvu-author-schema-phase-input-v4') {
              validateSchemaScopeProgramFrameV4(manualProgram!,fresh.frame.input.scopeReadFrame,fresh.frame)
            }
          }
        }catch(error) {return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_TRACE_INPUT_INVALID'))}
        pending=Promise.withResolvers<MvuSchemaNextRunResultV4>()
        const result=pending.promise
        bindSignal(nextSignal)
        if(state==='parked') {
          requested={eventId:fresh.eventId,frame:{...fresh.frame,material:hot?
            (fresh as MvuSchemaTraceRequestedStepV4).frame.material:material!}};ordinal++
          if(hot)activeMs=0
          state='processing';startProcessing()
          let message:MvuSchemaManualWorkerMessageV4
          try {message=hot?{kind:'hot-advance',step:sendEnvelope(stateOnly?
            {...requested,frame:withoutMaterial(requested.frame)}:requested,MVU_SCHEMA_BOUNDS.inputBytes)}:
            {kind:'advance',step:fresh}
            if(requested.frame.input.scopeReadRef)message.scopeObjects=scopes.capture(requested.frame.input,requested.frame)
          }
          catch(error) {
            forceClose(unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_DATA_INVALID')))
            return result
          }
          postMessage(message)
        }
        return result
      },
      close:()=>requestClose(),
    }
    active.set(worker,{finish:()=>{void requestClose(unavailable('SCHEMA_RUNNER_DISPOSED')).catch(()=>undefined)},closed:done.promise})
    coldTimer=setTimeout(()=>forceClose(unavailable('SCHEMA_COLD_REPLAY_TIMEOUT')),Math.max(0,deadline-performance.now()))
    startProcessing();bindSignal(signal)
    const result=await first
    return result.kind==='evaluated-next'?{kind:'opened-manual-run',run,record:result.record}:result
  }
  async function verifyEvaluation(program:MvuExecutableProgramV4,evaluation:MvuSchemaEvaluationV4,signal?:AbortSignal,
    scopeBinding?:ScopeBindingV2) {
      try {
        const stored=cloneSchemaData(evaluation,evaluationBytes,evaluationBounds)
        exact(stored,['schemaVersion','encoding','programSha256','runner','input','inputSha256','output','evaluationSha256'])
        const {evaluationSha256,...body}=stored
        if(stored.schemaVersion!==4||stored.encoding!=='native-mvu-author-schema-evaluation-v4'
          ||stored.programSha256!==program.programSha256||!same(stored.runner,identity)
          ||stored.inputSha256!==recordSha256(stored.input)||evaluationSha256!==recordSha256(body))return false
        validateSchemaGuestOutputForProgramV4(stored.output,program,validateSchemaEvaluationInputV4(stored.input))
        const actual=await evaluate(program,stored.input,signal,scopeBinding)
        // Both hashes cover the complete bodies already validated above and
        // produced by evaluate; no stored hash is trusted without its body.
        return actual.kind==='evaluated'&&actual.evaluation.evaluationSha256===stored.evaluationSha256
      } catch {return false}
  }
  async function verifyTrace(program:MvuExecutableProgramV4,evaluation:MvuSchemaTraceEvaluationV4,signal?:AbortSignal,
    scopeBinding?:ScopeBindingV2) {
      const deadline=performance.now()+coldReplayDeadlineMs
      try {
        program=programData(program)
        const parts=splitSchemaEnvelopeV4(evaluation,['input','records'],4096)
        const parsed=traceInputData(program,parts.fields.input,deadline),input=parsed.input
        const records=schemaSequenceItemsV4(parts.fields.records).map(record=>{
          if(performance.now()>=deadline)throw Error('SCHEMA_COLD_REPLAY_TIMEOUT')
          const row=splitSchemaEnvelopeV4(record,['output'],4096)
          return {...row.header,output:validateSchemaGuestOutputForParsedProgramV4(row.fields.output,program)}
        }) as MvuSchemaTraceEvaluationStepV4[]
        const stored={...parts.header,input,records} as unknown as MvuSchemaTraceEvaluationV4
        exact(stored,['schemaVersion','encoding','programSha256','runner','input','inputSha256','records','evaluationSha256'])
        const {evaluationSha256,...body}=stored
        if(stored.schemaVersion!==4||stored.encoding!=='native-mvu-author-schema-trace-evaluation-v4'
          ||stored.programSha256!==program.programSha256||!same(stored.runner,identity)
          ||stored.inputSha256!==recordSha256(stored.input)||evaluationSha256!==recordSha256(body))return false
        const steps=[...input.prefix,input.requestedStep]
        if(!Array.isArray(stored.records)||stored.records.length!==steps.length)return false
        let previous=recordSha256({programSha256:program.programSha256,realmEpoch:input.realmEpoch,loadFrame:input.loadFrame})
        for(const [index,step] of steps.entries()) {
          const row=stored.records[index]!
          exact(row,['ordinal','eventId','previousStepSha256','output','frameSha256','stepSha256'])
          assertSchemaGuestOutputBindingsV4(row.output,program,step.frame.input)
          const expected=traceRecord(step,index+1,previous,row.output)
          if(!same(row,expected))return false
          previous=row.stepSha256
        }
        const actual=await openLiveRun(program,input,signal,true,parsed,deadline,true,scopeBinding)
        if(actual.kind!=='opened-manual-run')return false
        await actual.run.close()
        // Stored compact headers were bound to each complete input frame.
        // traceRecord minted this actual hash over that frame and every field.
        return !signal?.aborted&&!disposed&&actual.record.stepSha256===records.at(-1)!.stepSha256
      } catch {return false}
  }
  const runner:MvuSchemaRunnerV4={identity,scopeInputProtocols,
    evaluate,evaluateTrace,evaluateNext,openManualRun,verifyEvaluation,verifyTrace,
    bindOwnedNext(reader) {
      return {evaluateNext:(program,input,signal)=>evaluateNextInput(program,input,signal,reader)}
    },
    bindScopeReferencesV2(read) {
      const binding:ScopeBindingV2={read}
      return {...runner,
        evaluate:(program,input,signal)=>evaluate(program,input,signal,binding),
        evaluateTrace:(program,input,signal)=>evaluateTrace(program,input,signal,binding),
        evaluateNext:(program,input,signal)=>evaluateNextInput(program,input,signal,undefined,binding),
        openManualRun:(program,input,signal)=>openManualRun(program,input,signal,binding),
        verifyEvaluation:(program,evaluation,signal)=>verifyEvaluation(program,evaluation,signal,binding),
        verifyTrace:(program,evaluation,signal)=>verifyTrace(program,evaluation,signal,binding),
        bindOwnedNext:reader=>({evaluateNext:(program,input,signal)=>evaluateNextInput(program,input,signal,reader,binding)}),
      }
    },
    async dispose() {
      disposed=true
      hotRun=undefined
      disposal??=(async()=>{
        const workers=[...active]
        for(const [,job] of workers)job.finish()
        await Promise.all(workers.map(([,job])=>job.closed))
      })()
      await disposal
    },
  }
  return runner
}

