import {parentPort,workerData,receiveMessageOnPort} from 'node:worker_threads'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import {createReplayableTavernEjsHost,restoreReplayableTavernEjsHost} from './tavern-template-ejs-replay.mjs'
import type {TavernEjsCompilerLibrary} from './tavern-template-ejs-compiler.mjs'
import type {EjsWorkerStart,EjsWorkerCommand,EjsWorkerReply,EjsWorkerReadReply} from './tavern-template-ejs-runtime-types.mjs'
import type {TavernEjsCapturedReadRequestV1} from './tavern-template-ejs-host-types.mjs'
import type {QuickJSWASMModule} from 'quickjs-emscripten-core'
import {evaluateCommunityProfileModuleV1} from './community-preset-profile-runtime.mjs'

// One module instance serves isolated runtimes/contexts. The actor processes
// each command synchronously, preserving every resident's live closure cells.
const root=new URL('../',import.meta.url),require=createRequire(new URL('package.json',root))
const compiler=require('./node_modules/ejs/lib/ejs.js') as TavernEjsCompilerLibrary
const core=await import(new URL('node_modules/quickjs-emscripten-core/dist/index.mjs',root).href)
const variant=await import(new URL('node_modules/@jitl/quickjs-wasmfile-release-sync/dist/index.mjs',root).href)
const quickjs:QuickJSWASMModule=await core.newQuickJSWASMModuleFromVariant(variant.default)
let currentRead:((request:TavernEjsCapturedReadRequestV1)=>import('./tavern-template-ejs-host-types.mjs').TavernEjsCapturedReadResultV1)|undefined
let parkedMs=0
const start=workerData as EjsWorkerStart,dependencies={quickjs,compiler,
  readCaptured:(request:TavernEjsCapturedReadRequestV1)=>{
    if(!currentRead)throw Error('TEMPLATE_CAPTURED_READ_UNAVAILABLE')
    return currentRead(request)
  },parkedMs:()=>parkedMs,
  // Trusted dependency bytes are read once per actor; each isolated VM loads
  // them only when an executable preset helper needs its real merge semantics.
  lodashGuestSource:readFileSync(require.resolve('nexttavern-mvu-lodash/lodash.min.js'),'utf8')}
const programs=new Map<number,ReturnType<typeof createReplayableTavernEjsHost>>()
const post=(reply:EjsWorkerReply)=>parentPort!.postMessage(reply)
parentPort!.on('message',(command:EjsWorkerCommand)=>{
  let ordinal=0
  parkedMs=0
  currentRead=request=>{
    const sequence=++ordinal,control=new Int32Array(command.readControl)
    command.readPort.postMessage({ordinal:sequence,request})
    const started=performance.now()
    for(let completed=Atomics.load(control,0);completed!==sequence;completed=Atomics.load(control,0))
      Atomics.wait(control,0,completed)
    parkedMs+=performance.now()-started
    const response=receiveMessageOnPort(command.readPort)?.message as EjsWorkerReadReply|undefined
    if(!response||response.ordinal!==sequence)throw Error('TEMPLATE_CAPTURED_READ_PROTOCOL')
    if(response.kind==='failed')throw Error(response.code)
    return response.result
  }
  let session=programs.get(command.programId)
  const response={id:command.id,programId:command.programId}
  try {
    if(command.kind==='profile-configuration') {
      post({...response,kind:'profile-configuration',output:evaluateCommunityProfileModuleV1(quickjs,command.input)})
    }else if(command.kind==='prepare'||command.kind==='restore') {
      session=command.kind==='prepare'
        ?createReplayableTavernEjsHost(dependencies,start.identity,command.input.capture,command.input.resource,command.input.consumer)
        :restoreReplayableTavernEjsHost(dependencies,start.identity,command.record)
      programs.set(command.programId,session)
      post({...response,kind:'created',creation:session.prepare(),creationReads:session.creationReads()})
    }else if(command.kind==='dispose') {
      session?.dispose();programs.delete(command.programId);post({...response,kind:'disposed'})
    }else {
      if(!session)throw Error('TEMPLATE_EJS_PROGRAM_RETIRED')
      if(command.kind==='checkpoint')post({...response,kind:'checkpoint',record:session.record()})
      else {
        const result=session.invoke(command.operationId,command.action,command.capture)
        post({...response,kind:'invoked',output:{result,delta:session.delta(command.operationId)}})
      }
    }
  }catch(error) {
    session?.dispose();programs.delete(command.programId)
    post({...response,kind:'failed',code:error instanceof Error?error.message:'TEMPLATE_EJS_WORKER_FAILED'})
  }finally{currentRead=undefined;command.readPort.close()}
})
parentPort!.on('close',()=>{for(const session of programs.values())session.dispose();programs.clear()})
post({id:0,kind:'ready'})
