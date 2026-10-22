/** A fresh bounded guest evaluation is evidence about code and data, never a
 * Source/Native capability. Only the trusted Core supplies assets and workers. */
import {Worker} from 'node:worker_threads'
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaData,cloneSchemaValues,schemaTextSha256,validateSchemaProgram} from './tavern-mvu-schema-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {isKnownSchemaUpdateRejectionV2,validateSchemaUpdateCommandsV2} from './tavern-mvu-schema-update-effects-v2.js'
import {validateMvuScopeReadFrameV1} from './tavern-mvu-scope-read.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {MvuSchemaProgram,MvuSchemaDiagnostic,MvuSchemaLibraryBytes,
  MvuSchemaImplementationIdentity} from './tavern-mvu-schema-types.js'
import type {MvuSchemaRunnerV3,MvuSchemaRunnerDepsV3,MvuSchemaEvaluationInputV3,
  MvuSchemaGuestOutputV3,MvuSchemaRunResultV3,MvuSchemaEvaluationV3,MvuSchemaTraceInputV3,MvuSchemaTraceRunResultV3,
  MvuSchemaTraceEvaluationV3,MvuSchemaTraceFrameV3,MvuSchemaTraceEvaluationStepV3,
  MvuSchemaTraceRequestedStepV3} from './tavern-mvu-schema-types-v3.js'

export type MvuSchemaWorkerRequestV3={
  program:MvuSchemaProgram
  input:MvuSchemaEvaluationInputV3
  libraries:readonly MvuSchemaLibraryBytes[]
}|{program:MvuSchemaProgram;trace:MvuSchemaTraceInputV3;libraries:readonly MvuSchemaLibraryBytes[]}
export type MvuSchemaWorkerResponseV3={kind:'output';json:string}|{kind:'trace-output';json:string}
  |{kind:'unavailable';code:string}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const diagnostic=(code:string):readonly MvuSchemaDiagnostic[]=>[{code}]
type RunnerFailure=Extract<MvuSchemaRunResultV3,{kind:'unavailable'|'cancelled'}>
const unavailable=(code:string):RunnerFailure=>({kind:'unavailable',diagnostics:diagnostic(code)})
const cancelled=():RunnerFailure=>({kind:'cancelled',diagnostics:diagnostic('SCHEMA_CANCELLED')})
const evaluationBytes=MVU_SCHEMA_BOUNDS.inputBytes+MVU_SCHEMA_BOUNDS.outputBytes+4096
// Trace frames live exactly once in input. Compact headers need at most 128KiB
// for 64 escaped event identifiers, hashes and fixed keys; guest limits stay put.
const traceEvaluationBytes=MVU_SCHEMA_BOUNDS.inputBytes+MVU_SCHEMA_BOUNDS.outputBytes+131072
const evaluationBounds={nodes:MVU_SCHEMA_BOUNDS.evaluationNodes,depth:MVU_SCHEMA_BOUNDS.evaluationDepth}
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const identifier=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=256
function traceRecord(step:MvuSchemaTraceRequestedStepV3,ordinal:number,previous:string,
  output:MvuSchemaGuestOutputV3):MvuSchemaTraceEvaluationStepV3 {
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
export function validateSchemaEvaluationInputV3(input:unknown):MvuSchemaEvaluationInputV3 {
  const value=cloneSchemaData(input,MVU_SCHEMA_BOUNDS.inputBytes) as MvuSchemaEvaluationInputV3
  exact(value,['schemaVersion','encoding','commandsEncoding','errorPolicy','phase','base','values','commands',
    'context','scopeReadFrame','clockEpochMs','randomSeed'])
  const object=(v:unknown)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
  if(value.schemaVersion!==3||value.encoding!=='native-mvu-author-schema-phase-input-v3'
    ||value.commandsEncoding!=='native-mvu-update-operations-v2'||value.errorPolicy!=='atomic-refusal'
    ||!['initialization','command-parsed','commands-parsed','update-ended','manual-replacement'].includes(value.phase)
    ||value.base!==null&&!object(value.base)||!object(value.values)||!object(value.context)
    ||!Array.isArray(value.commands)||!Number.isSafeInteger(value.clockEpochMs)
    ||typeof value.randomSeed!=='string'||!value.randomSeed.length||value.randomSeed.length>256)throw Error('SCHEMA_INPUT_INVALID')
  value.commands=validateSchemaUpdateCommandsV2(value.commands)
  if(value.phase!=='command-parsed'&&value.commands.length)throw Error('SCHEMA_COMMANDS_UNSUPPORTED')
  value.values=cloneSchemaValues(value.values)
  if(value.base!==null)value.base=cloneSchemaValues(value.base)
  if(Object.hasOwn(value.context,'stat_data'))throw Error('SCHEMA_CONTEXT_INVALID')
  value.scopeReadFrame=validateMvuScopeReadFrameV1(value.scopeReadFrame)
  return value
}
/** Pure correlations only. The enclosing Core owner must still prove the cut,
 * mutable snapshot and each published-state reference against Native facts. */
export function validateSchemaScopeProgramFrameV3(program:MvuSchemaProgram,scope:MvuScopeReadFrameV1,
  binding?:{ownerSessionId:string;sourceNativeCutSha256:string},load=false):void {
  if(scope.source.importId!==program.source.importId||scope.source.rawSha256!==program.source.sourceSha256
    ||binding&&(scope.source.sessionId!==binding.ownerSessionId||scope.sourceNativeCutSha256!==binding.sourceNativeCutSha256)
    ||load&&scope.source.sourceSnapshotSha256!==program.source.sourceSnapshotSha256) {
    throw Error('SCHEMA_SCOPE_BINDING_MISMATCH')
  }
  const matches=new Set<string>()
  for(const scoped of scope.scripts) {
    const script=program.scripts.find(item=>item.pointer===scoped.pointer&&item.sourceSha256===scoped.sourceSha256)
    if(!script||script.identity!==scoped.scriptId||matches.has(script.identity))throw Error('SCHEMA_SCOPE_SCRIPT_MISMATCH')
    matches.add(script.identity)
  }
  if(program.scripts.some(script=>script.enabled&&!matches.has(script.identity)))throw Error('SCHEMA_SCOPE_SCRIPT_MISMATCH')
}
/** Optional input correlates a stored output with its exact completed phase.
 * Journal reads accept only the explicit schema, atomic update and scope refusals. */
export function validateSchemaGuestOutputV3(raw:unknown,input?:MvuSchemaEvaluationInputV3):MvuSchemaGuestOutputV3 {
  const output=cloneSchemaData(raw,MVU_SCHEMA_BOUNDS.outputBytes) as MvuSchemaGuestOutputV3
  const wire=['schemaVersion','encoding','commandsEncoding','errorPolicy']
  if(!output||output.schemaVersion!==3||output.encoding!=='native-mvu-author-schema-phase-output-v3'
    ||output.commandsEncoding!=='native-mvu-update-operations-v2'||output.errorPolicy!=='atomic-refusal') {
    throw Error('SCHEMA_OUTPUT_INVALID')
  }
  if(output.kind==='accepted') {
    exact(output,[...wire,'kind','values','commands','context','registrations'])
    if(!output.values||typeof output.values!=='object'||Array.isArray(output.values)||!Array.isArray(output.commands)
      ||output.commands.length!==0
      ||!Number.isSafeInteger(output.registrations)||output.registrations<1||output.registrations>MVU_SCHEMA_BOUNDS.scripts) {
      throw Error('SCHEMA_OUTPUT_INVALID')
    }
    output.values=cloneSchemaValues(output.values)
    if(!output.context||typeof output.context!=='object'||Array.isArray(output.context)
      ||Object.hasOwn(output.context,'stat_data'))throw Error('SCHEMA_CONTEXT_INVALID')
  } else if(output.kind==='refused') {
    exact(output,[...wire,'kind','diagnostics'])
    if(!Array.isArray(output.diagnostics)||!output.diagnostics.length||output.diagnostics.length>64)throw Error('SCHEMA_OUTPUT_INVALID')
    const index=(value:unknown,max=64)=>Number.isSafeInteger(value)&&typeof value==='number'&&value>=0&&value<max
    let previousCommand=-1
    let failedRegistrationCount:number|undefined
    for(const item of output.diagnostics) {
      if(item.code==='SCHEMA_SCOPE_READ_FAILED') {
        exact(item,['code','scriptPointer','readCode'])
        if(output.diagnostics.length!==1||typeof item.scriptPointer!=='string'
          ||Buffer.byteLength(item.scriptPointer,'utf8')>4096||item.scriptPointer!==''&&!item.scriptPointer.startsWith('/')
          ||typeof item.readCode!=='string'||!(/^(?:SCHEMA_|SCOPE_READ_)[A-Z_]+$/.test(item.readCode)
            ||['SCOPE_SOURCE_UNAVAILABLE','MESSAGE_STATE_UNAVAILABLE'].includes(item.readCode))
          ||input&&!input.scopeReadFrame.scripts.some(script=>script.pointer===item.scriptPointer))throw Error('SCHEMA_OUTPUT_INVALID')
      } else if(item.code==='SCHEMA_UPDATE_OPERATION_REJECTED') {
        exact(item,['code','commandIndex','registrationIndex','updateCode',...(Object.hasOwn(item,'pointer')?['pointer']:[])])
        if(!index(item.commandIndex,input?.commands.length??64)||!index(item.registrationIndex)
          ||!isKnownSchemaUpdateRejectionV2(item.updateCode)||output.diagnostics.length!==1
          ||item.pointer!==undefined&&(typeof item.pointer!=='string'
            ||Buffer.byteLength(item.pointer,'utf8')>MVU_SCHEMA_BOUNDS.valuesBytes)
          ||input&&input.phase!=='command-parsed')throw Error('SCHEMA_OUTPUT_INVALID')
      } else if(item.code==='SCHEMA_VALIDATION_FAILED') {
        if('commandIndex' in item) {
          exact(item,['code','commandIndex','failedRegistrationIndexes'])
          if(!index(item.commandIndex,input?.commands.length??64)||item.commandIndex<=previousCommand
            ||!Array.isArray(item.failedRegistrationIndexes)||!item.failedRegistrationIndexes.length
            ||item.failedRegistrationIndexes.length>64||input&&input.phase!=='command-parsed')throw Error('SCHEMA_OUTPUT_INVALID')
          previousCommand=item.commandIndex
          // Every registration saw this still-unconsumed command in order.
          if(item.failedRegistrationIndexes.some((value:unknown,position:number)=>value!==position))throw Error('SCHEMA_OUTPUT_INVALID')
          failedRegistrationCount??=item.failedRegistrationIndexes.length
          if(item.failedRegistrationIndexes.length!==failedRegistrationCount)throw Error('SCHEMA_OUTPUT_INVALID')
        } else {
          exact(item,['code','registrationIndex'])
          if(!index(item.registrationIndex)||output.diagnostics.length!==1
            ||input&&!['initialization','manual-replacement'].includes(input.phase))throw Error('SCHEMA_OUTPUT_INVALID')
        }
      } else throw Error('SCHEMA_OUTPUT_INVALID')
    }
  } else throw Error('SCHEMA_OUTPUT_INVALID')
  return output
}
function outputData(json:string,input:MvuSchemaEvaluationInputV3):MvuSchemaGuestOutputV3 {
  if(typeof json!=='string'||Buffer.byteLength(json,'utf8')>MVU_SCHEMA_BOUNDS.outputBytes)throw Error('SCHEMA_OUTPUT_LIMIT')
  return validateSchemaGuestOutputV3(JSON.parse(json),input)
}
export function validateSchemaTraceInputV3(program:MvuSchemaProgram,input:unknown):MvuSchemaTraceInputV3 {
  // One aggregate bound covers all load/prefix/requested data, including old
  // outputs. Per-frame validation never grants 64 multiplied envelopes.
  const value=cloneSchemaData(input,MVU_SCHEMA_BOUNDS.inputBytes) as MvuSchemaTraceInputV3
  exact(value,['schemaVersion','encoding','realmEpoch','loadFrame','prefix','requestedStep'])
  if(value.schemaVersion!==3||value.encoding!=='native-mvu-author-schema-trace-input-v3'
    ||!hash(value.realmEpoch)||!Array.isArray(value.prefix)||value.prefix.length>=MVU_SCHEMA_BOUNDS.traceSteps) {
    throw Error('SCHEMA_TRACE_INPUT_INVALID')
  }
  const binding=(frame:{ownerSessionId:string;sourceNativeCutSha256:string;material:object})=>{
    if(!identifier(frame.ownerSessionId)||!hash(frame.sourceNativeCutSha256)
      ||!frame.material||typeof frame.material!=='object'||Array.isArray(frame.material))throw Error('SCHEMA_TRACE_FRAME_INVALID')
  }
  const load=value.loadFrame
  exact(load,['schemaVersion','ownerSessionId','sourceNativeCutSha256','material','values','context',
    'scopeReadFrame','clockEpochMs','randomSeed'])
  binding(load)
  if(load.schemaVersion!==3)throw Error('SCHEMA_TRACE_FRAME_INVALID')
  const initial=validateSchemaEvaluationInputV3({schemaVersion:3,encoding:'native-mvu-author-schema-phase-input-v3',
    commandsEncoding:'native-mvu-update-operations-v2',errorPolicy:'atomic-refusal',
    phase:'initialization',base:null,values:load.values,commands:[],
    context:load.context,scopeReadFrame:load.scopeReadFrame,clockEpochMs:load.clockEpochMs,randomSeed:load.randomSeed})
  load.values=initial.values;load.context=initial.context
  load.scopeReadFrame=initial.scopeReadFrame
  validateSchemaScopeProgramFrameV3(program,load.scopeReadFrame,load,true)
  const frame=(item:MvuSchemaTraceFrameV3)=>{
    exact(item,['ownerSessionId','sourceNativeCutSha256','material','input']);binding(item)
    item.input=validateSchemaEvaluationInputV3(item.input)
    validateSchemaScopeProgramFrameV3(program,item.input.scopeReadFrame,item)
  }
  const ids=new Set<string>()
  let previous=recordSha256({programSha256:program.programSha256,realmEpoch:value.realmEpoch,loadFrame:load})
  for(const [index,step] of value.prefix.entries()) {
    exact(step,['eventId','frame','ordinal','previousStepSha256','output','stepSha256'])
    if(!identifier(step.eventId)||ids.has(step.eventId)||step.ordinal!==index+1||step.previousStepSha256!==previous
      ||!hash(step.stepSha256))throw Error('SCHEMA_TRACE_PREFIX_INVALID')
    ids.add(step.eventId);frame(step.frame)
    step.output=validateSchemaGuestOutputV3(step.output,step.frame.input)
    const {stepSha256,...body}=step
    if(recordSha256(body)!==stepSha256)throw Error('SCHEMA_TRACE_PREFIX_INVALID')
    previous=stepSha256
  }
  exact(value.requestedStep,['eventId','frame'])
  if(!identifier(value.requestedStep.eventId)||ids.has(value.requestedStep.eventId))throw Error('SCHEMA_TRACE_EVENT_INVALID')
  frame(value.requestedStep.frame)
  return value
}
const safeCode=(code:unknown,fallback:string)=>typeof code==='string'&&/^SCHEMA_[A-Z_]+$/.test(code)?code:fallback

export function createMvuSchemaRunnerV3(deps:MvuSchemaRunnerDepsV3):MvuSchemaRunnerV3 {
  // No guest or persisted program can choose the worker path or library bytes.
  const workerUrl=new URL(deps.workerUrl??new URL('./tavern-mvu-schema-worker-v3.mjs',import.meta.url))
  const identity=Object.freeze(cloneSchemaData(deps.identity,4096))
  const bridge=Object.freeze(cloneSchemaData(deps.bridge,4096))
  const libraries=cloneSchemaData(deps.libraries,MVU_SCHEMA_BOUNDS.programBytes)
  let availability:string|undefined
  try {
    implementation(identity);implementation(bridge)
    if(workerUrl.protocol!=='file:')throw Error('SCHEMA_WORKER_UNAVAILABLE')
    exact(identity,['id','version','implementationSha256','quickjsVersion'])
    exact(bridge,['id','version','implementationSha256'])
    if(identity.quickjsVersion!=='0.32.0'||identity.version!==3||bridge.version!==3)throw Error('SCHEMA_IMPLEMENTATION_UNAVAILABLE')
    if(libraries.length!==2||new Set(libraries.map(library=>library.kind)).size!==2)throw Error('SCHEMA_LIBRARY_UNAVAILABLE')
    for(const library of libraries) {
      exact(library,['kind','packageName','version','bundleSha256','globalName','code'])
      if(library.packageName!==library.kind||library.version!==(library.kind==='zod'?'4.4.3':'4.18.1')
        ||!['zod','lodash'].includes(library.kind)||!/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(library.globalName)
        ||schemaTextSha256(library.code)!==library.bundleSha256)throw Error('SCHEMA_LIBRARY_UNAVAILABLE')
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
  function programData(program:MvuSchemaProgram):MvuSchemaProgram {
    const frozenProgram=cloneSchemaData(program,MVU_SCHEMA_BOUNDS.programBytes)
    validateSchemaProgram(frozenProgram)
    if(frozenProgram.compiler.version!==3)throw Error('SCHEMA_IMPLEMENTATION_UNAVAILABLE')
    if(!same(frozenProgram.bridge,bridge))throw Error('SCHEMA_BRIDGE_UNAVAILABLE')
    const supplied=libraries.map(({code:_code,...library})=>library)
    if(!same(frozenProgram.libraries,supplied))throw Error('SCHEMA_LIBRARY_UNAVAILABLE')
    for(const script of frozenProgram.scripts)for(const binding of script.imports) {
      const expected=binding.kind==='schema-bridge'?bridge.implementationSha256:
        supplied.find(library=>library.kind===binding.kind)?.bundleSha256
      if(!expected||binding.implementationSha256!==expected)throw Error('SCHEMA_IMPORT_UNAVAILABLE')
    }
    return frozenProgram
  }
  async function executeWorker(request:MvuSchemaWorkerRequestV3,signal?:AbortSignal):Promise<MvuSchemaWorkerResponseV3|RunnerFailure> {
    const blocked=preflight(signal)
    if(blocked)return blocked
    let worker:Worker
    try {
      worker=new Worker(workerUrl,{workerData:request,env:{TZ:'UTC'},resourceLimits:{maxOldGenerationSizeMb:256,stackSizeMb:4}})
    } catch {return unavailable('SCHEMA_WORKER_UNAVAILABLE')}
    const closed=Promise.withResolvers<void>()
    const execute=async():Promise<MvuSchemaWorkerResponseV3|RunnerFailure>=>{try {
      const result=await new Promise<MvuSchemaWorkerResponseV3|RunnerFailure>(resolve=>{
        let settled=false
        const finish=(value:MvuSchemaWorkerResponseV3|RunnerFailure)=>{
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
            const value=cloneSchemaData(message,MVU_SCHEMA_BOUNDS.outputBytes) as MvuSchemaWorkerResponseV3
            if(value.kind==='output'||value.kind==='trace-output')exact(value,['kind','json'])
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
  async function evaluate(program:MvuSchemaProgram,input:MvuSchemaEvaluationInputV3,signal?:AbortSignal):Promise<MvuSchemaRunResultV3> {
    const blocked=preflight(signal)
    if(blocked)return blocked
    let frozenProgram:MvuSchemaProgram,frozenInput:MvuSchemaEvaluationInputV3
    try {
      frozenProgram=programData(program);frozenInput=validateSchemaEvaluationInputV3(input)
      validateSchemaScopeProgramFrameV3(frozenProgram,frozenInput.scopeReadFrame)
    }catch(error) {
      return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_INPUT_INVALID'))
    }
    const result=await executeWorker({program:frozenProgram,input:frozenInput,libraries},signal)
    if(signal?.aborted)return cancelled()
    if(disposed)return unavailable('SCHEMA_RUNNER_DISPOSED')
    if('diagnostics' in result)return result
    let output:MvuSchemaGuestOutputV3
    if(result.kind==='output') {
      try {output=outputData(result.json,frozenInput)} catch(error) {
        return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_OUTPUT_INVALID'))
      }
    } else if(result.kind==='unavailable')return unavailable(result.code)
    else return unavailable('SCHEMA_WORKER_OUTPUT_INVALID')
    const body={schemaVersion:3 as const,encoding:'native-mvu-author-schema-evaluation-v3' as const,
      programSha256:frozenProgram.programSha256,runner:identity,input:frozenInput,inputSha256:recordSha256(frozenInput),output}
    try {
      return {kind:'evaluated',evaluation:cloneSchemaData({...body,evaluationSha256:recordSha256(body)},evaluationBytes,evaluationBounds)}
    } catch {return unavailable('SCHEMA_EVALUATION_LIMIT')}
  }
  async function evaluateTrace(program:MvuSchemaProgram,input:MvuSchemaTraceInputV3,signal?:AbortSignal):Promise<MvuSchemaTraceRunResultV3> {
    const blocked=preflight(signal)
    if(blocked)return blocked
    let frozenProgram:MvuSchemaProgram,frozenInput:MvuSchemaTraceInputV3
    try {frozenProgram=programData(program);frozenInput=validateSchemaTraceInputV3(frozenProgram,input)}catch(error) {
      return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_TRACE_INPUT_INVALID'))
    }
    const result=await executeWorker({program:frozenProgram,trace:frozenInput,libraries},signal)
    if(signal?.aborted)return cancelled()
    if(disposed)return unavailable('SCHEMA_RUNNER_DISPOSED')
    if('diagnostics' in result)return result
    if(result.kind==='unavailable')return unavailable(result.code)
    if(result.kind!=='trace-output')return unavailable('SCHEMA_WORKER_OUTPUT_INVALID')
    try {
      if(Buffer.byteLength(result.json,'utf8')>MVU_SCHEMA_BOUNDS.outputBytes)throw Error('SCHEMA_OUTPUT_LIMIT')
      const outputs=cloneSchemaData(JSON.parse(result.json),MVU_SCHEMA_BOUNDS.outputBytes) as MvuSchemaGuestOutputV3[]
      if(!Array.isArray(outputs)||outputs.length!==frozenInput.prefix.length+1)throw Error('SCHEMA_TRACE_OUTPUT_INVALID')
      let previous=recordSha256({programSha256:frozenProgram.programSha256,realmEpoch:frozenInput.realmEpoch,
        loadFrame:frozenInput.loadFrame})
      const records:MvuSchemaTraceEvaluationStepV3[]=[]
      const steps=[...frozenInput.prefix,frozenInput.requestedStep]
      for(const [index,step] of steps.entries()) {
        const output=validateSchemaGuestOutputV3(outputs[index],step.frame.input)
        if(index<frozenInput.prefix.length&&!same(output,frozenInput.prefix[index]!.output))throw Error('SCHEMA_TRACE_PREFIX_MISMATCH')
        const record=traceRecord(step,index+1,previous,output)
        records.push(record);previous=record.stepSha256
      }
      const body={schemaVersion:3 as const,encoding:'native-mvu-author-schema-trace-evaluation-v3' as const,
        programSha256:frozenProgram.programSha256,runner:identity,input:frozenInput,inputSha256:recordSha256(frozenInput),records}
      return {kind:'evaluated-trace',evaluation:cloneSchemaData({...body,evaluationSha256:recordSha256(body)},
        traceEvaluationBytes,evaluationBounds)}
    } catch(error) {return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_TRACE_OUTPUT_INVALID'))}
  }
  return {identity,evaluate,evaluateTrace,
    async verifyEvaluation(program:MvuSchemaProgram,evaluation:MvuSchemaEvaluationV3,signal?:AbortSignal) {
      try {
        const stored=cloneSchemaData(evaluation,evaluationBytes,evaluationBounds)
        exact(stored,['schemaVersion','encoding','programSha256','runner','input','inputSha256','output','evaluationSha256'])
        const {evaluationSha256,...body}=stored
        if(stored.schemaVersion!==3||stored.encoding!=='native-mvu-author-schema-evaluation-v3'
          ||stored.programSha256!==program.programSha256||!same(stored.runner,identity)
          ||stored.inputSha256!==recordSha256(stored.input)||evaluationSha256!==recordSha256(body))return false
        validateSchemaGuestOutputV3(stored.output,validateSchemaEvaluationInputV3(stored.input))
        const actual=await evaluate(program,stored.input,signal)
        return actual.kind==='evaluated'&&same(actual.evaluation,stored)
      } catch {return false}
    },
    async verifyTrace(program:MvuSchemaProgram,evaluation:MvuSchemaTraceEvaluationV3,signal?:AbortSignal) {
      try {
        const stored=cloneSchemaData(evaluation,traceEvaluationBytes,evaluationBounds)
        exact(stored,['schemaVersion','encoding','programSha256','runner','input','inputSha256','records','evaluationSha256'])
        const {evaluationSha256,...body}=stored
        if(stored.schemaVersion!==3||stored.encoding!=='native-mvu-author-schema-trace-evaluation-v3'
          ||stored.programSha256!==program.programSha256||!same(stored.runner,identity)
          ||stored.inputSha256!==recordSha256(stored.input)||evaluationSha256!==recordSha256(body))return false
        const input=validateSchemaTraceInputV3(program,stored.input),steps=[...input.prefix,input.requestedStep]
        if(!Array.isArray(stored.records)||stored.records.length!==steps.length)return false
        let previous=recordSha256({programSha256:program.programSha256,realmEpoch:input.realmEpoch,loadFrame:input.loadFrame})
        for(const [index,step] of steps.entries()) {
          const row=stored.records[index]!
          exact(row,['ordinal','eventId','previousStepSha256','output','frameSha256','stepSha256'])
          const expected=traceRecord(step,index+1,previous,validateSchemaGuestOutputV3(row.output,step.frame.input))
          if(!same(row,expected))return false
          previous=row.stepSha256
        }
        const actual=await evaluateTrace(program,stored.input,signal)
        return !signal?.aborted&&!disposed&&actual.kind==='evaluated-trace'&&same(actual.evaluation,stored)
      } catch {return false}
    },
    async dispose() {
      disposed=true
      disposal??=(async()=>{
        const workers=[...active]
        for(const [,job] of workers)job.finish()
        await Promise.all(workers.map(([,job])=>job.closed))
      })()
      await disposal
    },
  }
}

