/** A fresh bounded guest evaluation is evidence about code and data, never a
 * Source/Native capability. Only the trusted Core supplies assets and workers. */
import {Worker} from 'node:worker_threads'
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaData,cloneSchemaValues,schemaTextSha256,validateSchemaProgram} from './tavern-mvu-schema-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import type {MvuSchemaRunner,MvuSchemaRunnerDeps,MvuSchemaProgram,MvuSchemaEvaluationInput,
  MvuSchemaGuestOutput,MvuSchemaDiagnostic,MvuSchemaRunResult,MvuSchemaEvaluation,
  MvuSchemaLibraryBytes,MvuSchemaImplementationIdentity} from './tavern-mvu-schema-types.js'

export interface MvuSchemaWorkerRequest {
  program:MvuSchemaProgram
  input:MvuSchemaEvaluationInput
  libraries:readonly MvuSchemaLibraryBytes[]
}
export type MvuSchemaWorkerResponse={kind:'output';json:string}
  |{kind:'refused'|'unavailable';code:string}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const diagnostic=(code:string):readonly MvuSchemaDiagnostic[]=>[{code}]
type RunnerFailure=Extract<MvuSchemaRunResult,{kind:'unavailable'|'cancelled'}>
const unavailable=(code:string):RunnerFailure=>({kind:'unavailable',diagnostics:diagnostic(code)})
const cancelled=():RunnerFailure=>({kind:'cancelled',diagnostics:diagnostic('SCHEMA_CANCELLED')})
const evaluationBytes=MVU_SCHEMA_BOUNDS.inputBytes+MVU_SCHEMA_BOUNDS.outputBytes+4096
const evaluationBounds={nodes:MVU_SCHEMA_BOUNDS.evaluationNodes,depth:MVU_SCHEMA_BOUNDS.evaluationDepth}
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
function inputData(input:MvuSchemaEvaluationInput):MvuSchemaEvaluationInput {
  const value=cloneSchemaData(input,MVU_SCHEMA_BOUNDS.inputBytes)
  exact(value,['schemaVersion','phase','base','values','commands','context','clockEpochMs','randomSeed'])
  const object=(v:unknown)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
  if(value.schemaVersion!==1||!['initialization','command-parsed','commands-parsed','update-ended','manual-replacement'].includes(value.phase)
    ||value.base!==null&&!object(value.base)||!object(value.values)||!object(value.context)
    ||!Array.isArray(value.commands)||value.commands.length>MVU_SCHEMA_BOUNDS.arrayLength
    ||value.commands.some(command=>!object(command))||!Number.isSafeInteger(value.clockEpochMs)
    ||typeof value.randomSeed!=='string'||!value.randomSeed.length||value.randomSeed.length>256)throw Error('SCHEMA_INPUT_INVALID')
  value.values=cloneSchemaValues(value.values)
  if(value.base!==null)value.base=cloneSchemaValues(value.base)
  if(Object.hasOwn(value.context,'stat_data'))throw Error('SCHEMA_CONTEXT_INVALID')
  return value
}
function outputData(json:string):MvuSchemaGuestOutput {
  if(typeof json!=='string'||Buffer.byteLength(json,'utf8')>MVU_SCHEMA_BOUNDS.outputBytes)throw Error('SCHEMA_OUTPUT_LIMIT')
  const output=cloneSchemaData(JSON.parse(json),MVU_SCHEMA_BOUNDS.outputBytes) as MvuSchemaGuestOutput
  if(output.kind==='accepted') {
    exact(output,['kind','values','commands','context','registrations'])
    if(!output.values||typeof output.values!=='object'||Array.isArray(output.values)||!Array.isArray(output.commands)
      ||!Number.isSafeInteger(output.registrations)||output.registrations<1||output.registrations>MVU_SCHEMA_BOUNDS.scripts) {
      throw Error('SCHEMA_OUTPUT_INVALID')
    }
    output.values=cloneSchemaValues(output.values)
    if(!output.context||typeof output.context!=='object'||Array.isArray(output.context)
      ||Object.hasOwn(output.context,'stat_data'))throw Error('SCHEMA_CONTEXT_INVALID')
    for(const command of output.commands)if(!command||typeof command!=='object'||Array.isArray(command))throw Error('SCHEMA_OUTPUT_INVALID')
  } else if(output.kind==='refused') {
    exact(output,['kind','diagnostics'])
    if(!Array.isArray(output.diagnostics)||!output.diagnostics.length||output.diagnostics.length>64)throw Error('SCHEMA_OUTPUT_INVALID')
    for(const item of output.diagnostics) {
      exact(item,['code'])
      if(typeof item.code!=='string'||!/^SCHEMA_[A-Z_]+$/.test(item.code))throw Error('SCHEMA_OUTPUT_INVALID')
    }
  } else throw Error('SCHEMA_OUTPUT_INVALID')
  return output
}
const safeCode=(code:unknown,fallback:string)=>typeof code==='string'&&/^SCHEMA_[A-Z_]+$/.test(code)?code:fallback

export function createMvuSchemaRunner(deps:MvuSchemaRunnerDeps):MvuSchemaRunner {
  // No guest or persisted program can choose the worker path or library bytes.
  const workerUrl=new URL(deps.workerUrl??new URL('./tavern-mvu-schema-worker.mjs',import.meta.url))
  const identity=Object.freeze(cloneSchemaData(deps.identity,4096))
  const bridge=Object.freeze(cloneSchemaData(deps.bridge,4096))
  const libraries=cloneSchemaData(deps.libraries,MVU_SCHEMA_BOUNDS.programBytes)
  let availability:string|undefined
  try {
    implementation(identity);implementation(bridge)
    if(workerUrl.protocol!=='file:')throw Error('SCHEMA_WORKER_UNAVAILABLE')
    exact(identity,['id','version','implementationSha256','quickjsVersion'])
    exact(bridge,['id','version','implementationSha256'])
    if(identity.quickjsVersion!=='0.32.0')throw Error('SCHEMA_IMPLEMENTATION_UNAVAILABLE')
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
  async function evaluate(program:MvuSchemaProgram,input:MvuSchemaEvaluationInput,signal?:AbortSignal):Promise<MvuSchemaRunResult> {
    if(disposed)return unavailable('SCHEMA_RUNNER_DISPOSED')
    if(signal?.aborted)return cancelled()
    if(availability)return unavailable(availability)
    if(active.size>=4)return unavailable('SCHEMA_RUNNER_BUSY')
    let frozenProgram:MvuSchemaProgram,frozenInput:MvuSchemaEvaluationInput
    try {
      frozenProgram=cloneSchemaData(program,MVU_SCHEMA_BOUNDS.programBytes)
      validateSchemaProgram(frozenProgram)
      frozenInput=inputData(input)
      if(!same(frozenProgram.bridge,bridge))return unavailable('SCHEMA_BRIDGE_UNAVAILABLE')
      const supplied=libraries.map(({code:_code,...library})=>library)
      if(!same(frozenProgram.libraries,supplied))return unavailable('SCHEMA_LIBRARY_UNAVAILABLE')
      for(const script of frozenProgram.scripts)for(const binding of script.imports) {
        const expected=binding.kind==='schema-bridge'?bridge.implementationSha256:
          supplied.find(library=>library.kind===binding.kind)?.bundleSha256
        if(!expected||binding.implementationSha256!==expected)return unavailable('SCHEMA_IMPORT_UNAVAILABLE')
      }
    } catch(error) {return unavailable(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_INPUT_INVALID'))}
    let worker:Worker
    try {
      const workerData:MvuSchemaWorkerRequest={program:frozenProgram,input:frozenInput,libraries}
      worker=new Worker(workerUrl,{workerData,env:{TZ:'UTC'},resourceLimits:{maxOldGenerationSizeMb:256,stackSizeMb:4}})
    } catch {return unavailable('SCHEMA_WORKER_UNAVAILABLE')}
    const closed=Promise.withResolvers<void>()
    const execute=async():Promise<MvuSchemaRunResult>=>{try {
      const result=await new Promise<MvuSchemaWorkerResponse|RunnerFailure>(resolve=>{
        let settled=false
        const finish=(value:MvuSchemaWorkerResponse|RunnerFailure)=>{
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
            const value=cloneSchemaData(message,MVU_SCHEMA_BOUNDS.outputBytes) as MvuSchemaWorkerResponse
            if(value.kind==='output')exact(value,['kind','json'])
            else {
              exact(value,['kind','code'])
              if(!['refused','unavailable'].includes(value.kind)||!/^SCHEMA_[A-Z_]+$/.test(value.code))throw Error()
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
      if('diagnostics' in result)return result
      let output:MvuSchemaGuestOutput
      if(result.kind==='output') {
        try {output=outputData(result.json)} catch(error) {
          output={kind:'refused',diagnostics:diagnostic(safeCode(error instanceof Error?error.message:undefined,'SCHEMA_OUTPUT_INVALID'))}
        }
      } else if(result.kind==='unavailable')return unavailable(result.code)
      else output={kind:'refused',diagnostics:diagnostic(result.code)}
      const body={schemaVersion:1 as const,encoding:'native-mvu-author-schema-evaluation-v1' as const,
        programSha256:frozenProgram.programSha256,runner:identity,input:frozenInput,inputSha256:recordSha256(frozenInput),output}
      return {kind:'evaluated',evaluation:cloneSchemaData({...body,evaluationSha256:recordSha256(body)},
        evaluationBytes,evaluationBounds)}
    } finally {try {await worker.terminate()}finally {active.delete(worker);closed.resolve()}}}
    const outcome=await execute().catch(()=>unavailable('SCHEMA_WORKER_CLEANUP'))
    // The VM must actually terminate before its output can be used. Stop or
    // disposal during cleanup invalidates an already received guest message.
    return signal?.aborted?cancelled():disposed?unavailable('SCHEMA_RUNNER_DISPOSED'):outcome
  }
  return {identity,evaluate,
    async verifyEvaluation(program:MvuSchemaProgram,evaluation:MvuSchemaEvaluation,signal?:AbortSignal) {
      try {
        const stored=cloneSchemaData(evaluation,evaluationBytes,evaluationBounds)
        exact(stored,['schemaVersion','encoding','programSha256','runner','input','inputSha256','output','evaluationSha256'])
        const {evaluationSha256,...body}=stored
        if(stored.schemaVersion!==1||stored.encoding!=='native-mvu-author-schema-evaluation-v1'
          ||stored.programSha256!==program.programSha256||!same(stored.runner,identity)
          ||stored.inputSha256!==recordSha256(stored.input)||evaluationSha256!==recordSha256(body))return false
        const actual=await evaluate(program,stored.input,signal)
        return actual.kind==='evaluated'&&same(actual.evaluation,stored)
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
