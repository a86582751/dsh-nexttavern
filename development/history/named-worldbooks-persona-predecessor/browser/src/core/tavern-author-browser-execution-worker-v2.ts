/** Actual Worker owns one VM, one Actor and retained live author closures. */
import * as core from 'quickjs-emscripten-core'
import Variant from '@jitl/quickjs-wasmfile-release-asyncify'
import {BrowserActorV2,createAsyncifyRuntimeV2} from './tavern-author-browser-adapter-v2.js'
import {browserGuestBootstrapV2} from './tavern-author-browser-guest-v2.js'
import {BROWSER_DOM_METHODS_V2,BROWSER_SEMANTIC_EVENTS_V2} from './tavern-author-browser-child-v2.js'
import type {BrowserProgramV2} from './tavern-author-browser-types-v2.mjs'
import type {BrowserGenerationInvocationV2,BrowserGenerationResultV2}
  from './roleplay-author-browser-generation-types.js'

interface WorkerOwner {
  postMessage(message:unknown):void
  addEventListener(type:'message',callback:(event:MessageEvent)=>void):void
  close():void
}
const owner=self as unknown as WorkerOwner
const cleanup={},pendingDom=new Map<number,(reply:any)=>void>()
const deferred=new Map<number,{promise:any;workId:string|undefined}>()
const callbackWaiters=new Map<number,(failed:boolean)=>void>()
let actor:BrowserActorV2,controller:any,vm:any,program:BrowserProgramV2,active=true,sequence=0
let rootTail:Promise<unknown>=Promise.resolve(),activeOrigin:any=null,currentInvocation:BrowserGenerationInvocationV2|null=null
let generationResolve:((result:BrowserGenerationResultV2)=>void)|undefined
let rootWorkId:string|undefined,activeCallbackId:number|null=null
let startupPhase='module'
const send=(message:any)=>{if(active)owner.postMessage(message)}
const domRpc=(payload:any)=>new Promise<any>(resolve=>{
  const id=++sequence;pendingDom.set(id,resolve);send({type:'dom-rpc',id,payload})
})
const stable=(value:any):string=>{
  if(value===null||typeof value!=='object')return JSON.stringify(value)
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']'
  return '{'+Object.keys(value).filter(key=>value[key]!==undefined).sort()
    .map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}'
}
const digest=async(value:any)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(stable(value))))).map(byte=>byte.toString(16).padStart(2,'0')).join('')
const origin=(script:BrowserProgramV2['scripts'][number])=>({originalOrdinal:script.ordinal,
  scriptIdentity:script.descriptor.identity,descriptorSha256:script.descriptorSha256})
async function control(method:string,value?:unknown) {
  const text=value===undefined?undefined:JSON.stringify(value)
  const args=await actor.enter(()=>text===undefined?[]:[vm.newString(text)])
  try{return await actor.call(controller[method],args)}
  finally{await actor.enter(()=>{for(const arg of args)arg.dispose()})}
}
async function jobs() {
  if(activeOrigin)await control('select',{...activeOrigin,callbackId:activeCallbackId})
  await actor.drain()
}
async function notified(message:any) {
  if(message.type==='callback-complete') {
    const resolve=callbackWaiters.get(message.id)
    if(resolve){callbackWaiters.delete(message.id);resolve(message.error===true)}
    return
  }
  if(message.type==='generation-complete'&&currentInvocation&&currentInvocation.invocationId===message.invocationId) {
    const invocation=currentInvocation
    let result:BrowserGenerationResultV2
    if(message.error)result={kind:'refused',binding:invocation.binding,invocationId:invocation.invocationId,
      diagnostics:[{code:'BROWSER_GENERATION_CALLBACK_FAILED'}]}
    else {
      const output={schemaVersion:2 as const,encoding:'native-author-browser-generation-output-v2' as const,
        authority:'consumer-data-only' as const,invocationId:invocation.invocationId,
        programSha256:program.programSha256,captureSha256:invocation.capture.captureSha256,
        effects:message.effects,cleanupRemovals:message.cleanupRemovals,callbacksExecuted:message.callbacksExecuted}
      result={kind:'executed',binding:invocation.binding,invocationId:invocation.invocationId,
        output:{...output,outputSha256:await digest(output)}}
    }
    generationResolve?.(result);generationResolve=undefined;currentInvocation=null
  }
}
function root(operation:()=>Promise<void>) {
  const pending=rootTail.then(operation)
  rootTail=pending.catch(()=>send({type:'runtime-error',code:'BROWSER_AUTHOR_CALLBACK_FAILED'}))
}
async function dispatch(message:any,resource:boolean) {
  const script=program.scripts.find(row=>row.descriptor.identity===message.scriptIdentity)!
  const previous=activeOrigin
  const previousWork=rootWorkId,previousCallbackId=activeCallbackId
  const completionId=++sequence
  const workId='callback:'+completionId
  if(!resource){activeOrigin=origin(script);activeCallbackId=message.callbackId;rootWorkId=workId}
  const complete=new Promise<boolean>(resolve=>callbackWaiters.set(completionId,resolve))
  send({type:'work-start',id:workId})
  try {
    await control('deliver',{id:message.callbackId,args:message.args,completionId,resource,gestureId:message.gestureId})
    await jobs()
    // Only after the Actor has returned can a pending host Promise suspend
    // this root's execution clock. A fire-and-forget author loop never gets here.
    if(!resource)send({type:'work-wait',id:workId})
    if(!resource&&await complete)send({type:'handler-error',code:'BROWSER_AUTHOR_CALLBACK_FAILED'})
    else if(resource)void complete.then(failed=>{if(failed)send({type:'handler-error',code:'BROWSER_RESOURCE_CALLBACK_FAILED'})})
  }finally {
    if(!resource){activeOrigin=previous;activeCallbackId=previousCallbackId;rootWorkId=previousWork}
    send({type:'work-end',id:workId})
  }
}
async function settle(message:any) {
  const pending=deferred.get(message.id);if(!pending)return
  const {promise,workId}=pending
  deferred.delete(message.id)
  await actor.enter(()=>{
    if(workId)send({type:'work-resume',id:workId})
    const value=message.error?vm.newError({name:'Error',message:message.error}):vm.newString(JSON.stringify(message.value))
    try{if(message.error)promise.reject(value);else promise.resolve(value)}
    finally{value.dispose();promise.dispose()}
  })
  await jobs()
  if(workId&&rootWorkId===workId)send({type:'work-wait',id:workId})
}
async function start(message:any) {
  send({type:'clock-protocol',clock:'host-wait-v1'})
  program=message.program
  // The published loader computes its WASM URI even when bytes are supplied.
  // A Blob Worker has no hierarchical import.meta base. Its supported
  // locateFile option supplies an inert URI; wasmBinary bypasses every read.
  const module=await core.newQuickJSAsyncWASMModuleFromVariant(core.newVariant(Variant,{
    wasmBinary:message.wasm,locateFile:()=> 'https://browser2.invalid/emscripten-module.wasm',
  }))
  startupPhase='runtime'
  const runtime=createAsyncifyRuntimeV2(core,module,cleanup)
  runtime.setMemoryLimit(32*1024*1024);runtime.setMaxStackSize(1024*1024)
  vm=runtime.newContext();actor=new BrowserActorV2(core,module,runtime,vm)
  await actor.enter(()=>{
    const dom=vm.newAsyncifiedFunction('__ownedDomV2',async(value:any)=>{
      const reply=await domRpc(JSON.parse(vm.getString(value)))
      return vm.newString(JSON.stringify(reply.error?{error:reply.error}:{value:reply.value}))
    })
    const async=vm.newFunction('__ownedAsyncV2',(value:any)=>{
      const payload=JSON.parse(vm.getString(value)),id=++sequence,promise=vm.newPromise()
      deferred.set(id,{promise,workId:rootWorkId});send({type:'host-rpc',id,payload,workId:rootWorkId})
      return promise.handle.dup()
    })
    const notify=vm.newFunction('__ownedNotifyV2',(value:any)=>{
      const notification=JSON.parse(vm.getString(value))
      // Completion is delivered outside the current FFI call. No nested VM
      // entry or provider await is performed by this native function.
      queueMicrotask(()=>{void notified(notification)})
    })
    for(const [key,handle] of [['__ownedDomV2',dom],['__ownedAsyncV2',async],['__ownedNotifyV2',notify]] as const) {
      vm.setProp(vm.global,key,handle);handle.dispose()
    }
  })
  startupPhase='guest-facade'
  const config={document:message.document,snapshot:message.snapshot,binding:message.binding,
    ownedChatKey:program.ownedChatKey,ownedChatWriter:program.ownedChatWriter,
    methods:BROWSER_DOM_METHODS_V2,events:BROWSER_SEMANTIC_EVENTS_V2}
  const handle=await actor.capture('('+browserGuestBootstrapV2.toString()+')('+JSON.stringify(config)+')')
  controller={}
  await actor.enter(()=>{
    for(const key of ['select','snapshot','registrations','deliver','generation','destroy']) {
      controller[key]=vm.getProp(handle,key);actor.handles.push(controller[key])
    }
  })
  startupPhase='original-script'
  for(const script of program.scripts)if(script.disposition==='compiled-browser') {
    activeOrigin=origin(script);await control('select',activeOrigin)
    await actor.runSource(script.javascript);await jobs()
  }
  activeOrigin=null
  startupPhase='live-registrations'
  const registrations=JSON.parse(String(await control('registrations')))
  send({type:'startup-complete',registrations})
}
owner.addEventListener('message',event=>{
  const message=event.data
  if(message.type==='dom-result') {
    const resolve=pendingDom.get(message.id);if(resolve){pendingDom.delete(message.id);resolve(message)}
  }else if(message.type==='host-result')void settle(message).catch(()=>send({type:'runtime-error',code:'BROWSER_HOST_RESULT_FAILED'}))
  else if(message.type==='start')void start(message).catch(()=>send({type:'startup-failed',code:'BROWSER_AUTHOR_STARTUP_FAILED',phase:startupPhase}))
  else if(message.type==='snapshot')root(async()=>{await control('snapshot',message.snapshot);await jobs()})
  else if(message.type==='callback') {
    const resource=['timer','raf','observer','resource'].includes(message.resourceKind)
    if(resource)void dispatch(message,true).catch(()=>send({type:'handler-error',code:'BROWSER_RESOURCE_CALLBACK_FAILED'}))
    else root(()=>dispatch(message,false))
  }else if(message.type==='generation')root(async()=>{
    currentInvocation=message.invocation
    const result=new Promise<BrowserGenerationResultV2>(resolve=>{generationResolve=resolve})
    rootWorkId=message.id;send({type:'work-start',id:message.id})
    try {
      await control('generation',message.invocation);await jobs()
      send({type:'work-wait',id:message.id})
      send({type:'generation-result',id:message.id,result:await result})
    }finally{rootWorkId=undefined;send({type:'work-end',id:message.id})}
  })
  else if(message.type==='dispose') {
    active=false
    // Main parent has the hard kill. This optional path owns handles only and
    // never waits for author code before the parent can revoke its realm.
    void actor?.enter(()=>{for(const {promise} of deferred.values())promise.dispose();deferred.clear()})
      .then(()=>actor.dispose(cleanup)).finally(()=>owner.close())
  }
})
