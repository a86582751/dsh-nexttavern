import {parentPort,workerData} from 'node:worker_threads'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import {createReplayableTavernEjsHost,restoreReplayableTavernEjsHost} from './tavern-template-ejs-replay.mjs'
import type {TavernEjsCompilerLibrary} from './tavern-template-ejs-compiler.mjs'
import type {EjsWorkerStart,EjsWorkerCommand,EjsWorkerReply} from './tavern-template-ejs-runtime-types.mjs'
import type {QuickJSWASMModule} from 'quickjs-emscripten-core'

// One module instance serves isolated runtimes/contexts. The actor processes
// each command synchronously, preserving every resident's live closure cells.
const root=new URL('../',import.meta.url),require=createRequire(new URL('package.json',root))
const compiler=require('./node_modules/ejs/lib/ejs.js') as TavernEjsCompilerLibrary
const core=await import(new URL('node_modules/quickjs-emscripten-core/dist/index.mjs',root).href)
const variant=await import(new URL('node_modules/@jitl/quickjs-wasmfile-release-sync/dist/index.mjs',root).href)
const quickjs:QuickJSWASMModule=await core.newQuickJSWASMModuleFromVariant(variant.default)
const start=workerData as EjsWorkerStart,dependencies={quickjs,compiler,
  // Trusted dependency bytes are read once per actor; each isolated VM loads
  // them only when an executable preset helper needs its real merge semantics.
  lodashGuestSource:readFileSync(require.resolve('nexttavern-mvu-lodash/lodash.min.js'),'utf8')}
const programs=new Map<number,ReturnType<typeof createReplayableTavernEjsHost>>()
const post=(reply:EjsWorkerReply)=>parentPort!.postMessage(reply)
parentPort!.on('message',(command:EjsWorkerCommand)=>{
  let session=programs.get(command.programId)
  const response={id:command.id,programId:command.programId}
  try {
    if(command.kind==='prepare'||command.kind==='restore') {
      session=command.kind==='prepare'
        ?createReplayableTavernEjsHost(dependencies,start.identity,command.input.capture,command.input.resource,command.input.consumer)
        :restoreReplayableTavernEjsHost(dependencies,start.identity,command.record)
      programs.set(command.programId,session)
      post({...response,kind:'created',creation:session.prepare()})
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
  }
})
parentPort!.on('close',()=>{for(const session of programs.values())session.dispose();programs.clear()})
post({id:0,kind:'ready'})
