/** The actual Worker owns the shared Asyncify Actor. Native RPC replies bypass
 * its root queue so suspended FFI can resume. Main owns hard termination. */
import * as core from 'quickjs-emscripten-core'
import Variant from '@jitl/quickjs-wasmfile-release-asyncify'
import {BrowserActorV3} from './tavern-author-browser-adapter-v3.js'
import {BrowserAttachmentWorkerV3} from './tavern-author-browser-attachment-worker-v3.js'
import {BROWSER_NATIVE_METHODS_V3,BROWSER_NATIVE_PROPERTIES_V3} from './tavern-author-browser-renderer-v3.js'
import type {BrowserPageNativeSessionV3} from './tavern-author-browser-page-worker-v3.js'
import type {BrowserNativeFrameFactV3,BrowserWorkerInputV3,BrowserWorkerRequestV3}
  from './tavern-author-browser-worker-protocol-v3.js'
import type {NativeHandleV3} from './tavern-author-browser-native-types-v3.js'
import type {BrowserProgramV3} from './tavern-author-browser-types-v3.mjs'
import type {BrowserGenerationInvocationV3,BrowserGenerationOutputV3,BrowserGenerationResultV3}
  from './roleplay-author-browser-generation-types.js'

interface WorkerOwner {
  postMessage(message:unknown):void
  addEventListener(type:'message',callback:(event:MessageEvent<BrowserWorkerInputV3>)=>void):void
  close():void
}
const owner=self as unknown as WorkerOwner
const abort=new AbortController(),cleanup={}
const waits=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;release:()=>void}>()
const frames=new Map<number,BrowserNativeFrameFactV3>()
const references=new Map<string,BrowserNativeFrameFactV3>()
let actor:BrowserActorV3|undefined,attachment:BrowserAttachmentWorkerV3<BrowserNativeFrameFactV3>|undefined
let program:BrowserProgramV3
const generationInvocations=new Map<string,BrowserGenerationInvocationV3>()
let active=true,sequence=0,workSequence=0,entrySequence=0,actorEntry:number|undefined
let tail:Promise<unknown>=Promise.resolve()
const key=(reference:NativeHandleV3)=>reference.pageId+':'+reference.handle
const code=(error:unknown)=>error instanceof Error?error.message:String(error)
const send=(message:unknown)=>{if(active)owner.postMessage(message)}
// Match the host record hash without importing its Node-only storage helpers
// into this real browser Worker.
const stable=(value:any):string=>{
  if(value===null||typeof value!=='object')return JSON.stringify(value)
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']'
  return '{'+Object.keys(value).filter(key=>value[key]!==undefined).sort()
    .map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}'
}
const digest=async(value:any)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(stable(value))))).map(byte=>byte.toString(16).padStart(2,'0')).join('')
function refused(invocation:BrowserGenerationInvocationV3,error:string):BrowserGenerationResultV3 {
  return {kind:'refused',binding:invocation.binding,invocationId:invocation.invocationId,diagnostics:[{code:error}]}
}
async function generationCompleted(notice:any):Promise<void> {
  const invocation=generationInvocations.get(notice.invocationId)
  if(!invocation)return
  let result:BrowserGenerationResultV3
  if(notice.error)result=refused(invocation,notice.error)
  else {
    const output:Omit<BrowserGenerationOutputV3,'outputSha256'>={schemaVersion:3,
      encoding:'native-author-browser-generation-output-v3',authority:'consumer-data-only',
      invocationId:invocation.invocationId,programSha256:program.programSha256,
      captureSha256:invocation.capture.captureSha256,effects:notice.effects,
      cleanupRemovals:notice.cleanupRemovals,callbacksExecuted:notice.callbacksExecuted}
    result={kind:'executed',binding:invocation.binding,invocationId:invocation.invocationId,
      output:{...output,outputSha256:await digest(output)}}
  }
  if(generationInvocations.get(notice.invocationId)!==invocation)return
  generationInvocations.delete(notice.invocationId)
  send({type:'generation-result-v3',result})
}
function rpc(request:BrowserWorkerRequestV3,signal=abort.signal):Promise<any> {
  signal.throwIfAborted()
  return new Promise((resolve,reject)=>{
    const id=++sequence
    const stopped=()=>{waits.delete(id);reject(Error('BROWSER3_ATTACHMENT_CLOSED'))}
    signal.addEventListener('abort',stopped,{once:true})
    waits.set(id,{resolve,reject,release:()=>signal.removeEventListener('abort',stopped)})
    send({type:'rpc',id,request,...actorEntry===undefined?{}:{actorEntry}})
  })
}
function result(message:Extract<BrowserWorkerInputV3,{type:'result'}>):void {
  const wait=waits.get(message.id)
  if(!wait)return
  waits.delete(message.id);wait.release()
  for(const fact of message.frames??[]) {
    // A remount keeps the actual frame token stable, including references
    // borrowed across guest realms. The Main owner supplies these facts once.
    if(!frames.has(fact.frameId)) {
      frames.set(fact.frameId,fact);references.set(key(fact.reference),fact)
    }
  }
  if(message.error)wait.reject(Error(message.error));else wait.resolve(message.value)
}
function root(operation:()=>Promise<void>):void {
  const id=++workSequence
  const pending=tail.then(async()=>{
    if(!active)return
    send({type:'work-start',id})
    try {await operation()}
    finally {send({type:'work-end',id})}
  })
  tail=pending.catch(error=>send({type:'runtime-error',code:code(error)}))
}
function pageSession(pageId:string):BrowserPageNativeSessionV3 {
  return {
    applyUntil:(exclusiveEnd,signal)=>rpc({op:'page-apply',pageId,exclusiveEnd},signal),
    getDocumentHandle:signal=>rpc({op:'page-document',pageId},signal),
    getParsedNodeHandle:(nodeId,signal)=>rpc({op:'page-node',pageId,nodeId},signal),
    setDocumentState:(state,signal)=>rpc({op:'page-state',pageId,state},signal),
    request:(request,signal)=>rpc({op:'native',contextId:pageId,request},signal),
    awaitResourcesReady:signal=>rpc({op:'page-resources',pageId},signal),
  }
}
async function start(message:Extract<BrowserWorkerInputV3,{type:'start'}>):Promise<void> {
  program=message.program
  const module=await core.newQuickJSAsyncWASMModuleFromVariant(core.newVariant(Variant,{
    wasmBinary:message.wasm,locateFile:()=> 'https://browser3.invalid/emscripten-module.wasm',
  }))
  if(!active)return
  actor=new BrowserActorV3(core,module,cleanup,{
    begin(){actorEntry=++entrySequence;send({type:'actor-entry-start',id:actorEntry})},
    end(){send({type:'actor-entry-end',id:actorEntry});actorEntry=undefined},
  })
  attachment=new BrowserAttachmentWorkerV3({actor,program:message.program,snapshot:message.snapshot,
    binding:message.binding,operationPrefix:message.operationPrefix,
    methods:BROWSER_NATIVE_METHODS_V3,properties:BROWSER_NATIVE_PROPERTIES_V3,
    pages:{
      async mount(frame,pageId,plan,signal) {
        await rpc({op:'page-mount',frameId:frame.frameId,pageId,planSha256:plan.pagePlanSha256},signal)
        return pageSession(pageId)
      },dispose:(frame,pageId)=>active?rpc({op:'page-dispose',frameId:frame.frameId,pageId}):Promise.resolve(),
    },
    frameOwner:frame=>frame,
    resolveFrame:reference=>references.get(key(reference))!,frameReference:frame=>frame.reference,
    recordFrameLocation:(frame,location)=>{
      // Ordering on the one port places this owner update before page-mount.
      // It does not enter the VM or wait for the Actor from its suspended FFI.
      void rpc({op:'frame-location',frameId:frame.frameId,location}).catch(error=>
        send({type:'runtime-error',code:code(error)}))
    },
    async createCarrier(script,contextId,signal) {
      const value=await rpc({op:'carrier-create',ordinal:script.ordinal,contextId},signal)
      return {document:value.document,script:value.script,
        request:(request,requestSignal)=>rpc({op:'native',contextId,request},requestSignal),
        setDocumentState:(state,stateSignal)=>rpc({op:'carrier-state',contextId,state},stateSignal),
        dispose:()=>active?rpc({op:'carrier-dispose',contextId}):Promise.resolve()}
    },
    nativeRequest:(contextId,request,signal)=>rpc({op:'native',contextId,request},signal),
    sourceRequest:(payload,signal)=>rpc({op:'source',payload},signal),
    hostRequest:(payload,signal)=>rpc({op:'host',payload},signal),
    frameLoaded:(frame,pageId)=>rpc({op:'page-loaded',frameId:frame.frameId,pageId}),
    onNotice:notice=>{
      if((notice as any)?.type==='generation-complete-v3')void generationCompleted(notice).catch(error=>{
        const invocation=generationInvocations.get((notice as any).invocationId)
        if(invocation){generationInvocations.delete(invocation.invocationId)
          send({type:'generation-result-v3',result:refused(invocation,code(error))})}
      })
      else send({type:'notice',notice})
    },
    onPageError:(pageId,error)=>send({type:'page-error',pageId,code:code(error)}),
  })
  await attachment.start()
  send({type:'startup-complete'})
}
async function dispose():Promise<void> {
  if(!active)return
  active=false;abort.abort()
  // Hard termination remains Main-owned. If it permits graceful shutdown,
  // reject suspended RPC first and allow the Actor to leave Asyncify.
  for(const wait of waits.values()){wait.release();wait.reject(Error('BROWSER3_ATTACHMENT_CLOSED'))}
  waits.clear()
  generationInvocations.clear()
  try {await attachment?.dispose()}
  finally {
    if(!attachment&&actor?.runtime.alive)await actor.dispose()
    frames.clear();references.clear();owner.postMessage({type:'disposed',cleanup});owner.close()
  }
}
owner.addEventListener('message',event=>{
  const message=event.data
  if(message.type==='result'){result(message);return}
  if(message.type==='dispose'){void dispose();return}
  if(!active)return
  if(message.type==='start')root(()=>start(message))
  else if(message.type==='snapshot')root(()=>attachment!.snapshot(message.snapshot))
  else if(message.type==='source-event')root(()=>attachment!.deliverSourceEvent(message.event))
  else if(message.type==='generation-registrations-request')root(async()=>{
    try {send({type:'generation-registrations-result',id:message.id,registrations:await attachment!.generationCallbacks()})}
    catch(error) {send({type:'generation-registrations-result',id:message.id,error:code(error)})}
  })
  else if(message.type==='generation-invocation')root(async()=>{
    generationInvocations.set(message.invocation.invocationId,message.invocation)
    try {await attachment!.invokeGeneration(message.invocation)}
    catch(error) {generationInvocations.delete(message.invocation.invocationId)
      send({type:'generation-result-v3',result:refused(message.invocation,code(error))})}
  })
  else if(message.type==='generation-cancel')root(async()=>{
    generationInvocations.delete(message.invocationId)
    await attachment!.cancelGeneration(message.invocationId)
  })
  else if(message.type==='callback')root(()=>attachment!.deliverNative(message.delivery))
  else if(message.type==='settlement')root(()=>attachment!.settleNative(message.settlement))
  else if(message.type==='frame-closed')root(()=>attachment!.close(frames.get(message.frameId)!))
})
