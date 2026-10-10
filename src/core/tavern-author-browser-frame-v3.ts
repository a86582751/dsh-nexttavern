/** Main owns the real Worker and native scene. Author JavaScript runs only in
 * QuickJS; native wait ACKs never require another entry into that Actor. */
import {createBrowserNativeSceneV3} from './tavern-author-browser-native-scene-v3.js'
import {BROWSER_NATIVE_INERT_SHELL_V3} from './tavern-author-browser-frame-native-v3.js'
import type {BrowserBindingV1,BrowserRenderV1} from './tavern-author-browser-types.mjs'
import type {BrowserProgramV3,BrowserSnapshotV3,BrowserRuntimeArtifactV3,BrowserHostBridgeV3,BrowserSaveReplyV3}
  from './tavern-author-browser-types-v3.mjs'
import type {BrowserWorkerRpcV3,BrowserWorkerInputV3,BrowserSourceEventV3} from './tavern-author-browser-worker-protocol-v3.js'
import type {NativeCallbackDeliveryV3} from './tavern-author-browser-native-types-v3.js'

interface Options {
  current():boolean
  layout(value:{height:number;renderRevision:number}):void
  diagnostic(code:string):void
  failed?(code:string):void
  startupDeadlineMs:number
}
interface EntryClock {
  readonly id:number
  remaining:number
  since?:number
  timer?:number
  readonly waits:Set<number>
}
export interface BrowserFrameControllerV3 {
  readonly started:Promise<void>
  readonly disposed:Promise<void>
  publishSnapshot(value:BrowserSnapshotV3):void
  publishSaveConfirmation(value:BrowserSaveReplyV3):void
  /** Called only by the actual Core/UI event producer owning these facts. */
  publishSourceEvent(value:BrowserSourceEventV3):void
  render(value:BrowserRenderV1):void
  dispose():void
}

export function createBrowserRuntimeFrameV3(outer:HTMLIFrameElement,artifact:BrowserRuntimeArtifactV3,
  binding:BrowserBindingV1,program:BrowserProgramV3,host:BrowserHostBridgeV3,options:Options):BrowserFrameControllerV3 {
  const view=outer.ownerDocument.defaultView!,abort=new AbortController(),operationPrefix=crypto.randomUUID()
  const workerURL=URL.createObjectURL(new Blob([artifact.executionWorkerJavascript],{type:'text/javascript'}))
  const worker=new Worker(workerURL,{type:'module'})
  let active=true,latest:BrowserSnapshotV3|undefined,initialized=false,entry:EntryClock|undefined
  let scene:ReturnType<typeof createBrowserNativeSceneV3>|undefined
  let resolveStarted!:()=>void,rejectStarted!:(error:Error)=>void,resolveDisposed!:()=>void
  const started=new Promise<void>((yes,no)=>{resolveStarted=yes;rejectStarted=no})
  const disposed=new Promise<void>(yes=>{resolveDisposed=yes})
  const current=()=>active&&options.current()
  const send=(message:BrowserWorkerInputV3)=>{if(current())worker.postMessage(message)}
  let bootTimer=view.setTimeout(()=>fail('BROWSER3_WORKER_DEADLINE'),options.startupDeadlineMs)
  function clock():void {
    if(!entry)return
    view.clearTimeout(entry.timer)
    if(entry.since!==undefined){entry.remaining-=performance.now()-entry.since;entry.since=undefined}
    if(!entry.waits.size) {
      entry.since=performance.now()
      entry.timer=view.setTimeout(()=>fail('BROWSER3_WORKER_DEADLINE'),Math.max(0,entry.remaining))
    }
  }
  function dispose():void {
    if(!active)return
    active=false;abort.abort();view.clearTimeout(bootTimer);view.clearTimeout(entry?.timer)
    // Main termination remains independent of a busy or suspended guest. It
    // does not imply graceful VM disposal; Main still frees its own resources.
    worker.terminate();URL.revokeObjectURL(workerURL)
    outer.removeEventListener('load',loaded)
    rejectStarted(Error('BROWSER_GENERATION_REVOKED'))
    void (scene?.dispose()??Promise.resolve()).catch(error=>options.diagnostic(String(error)))
      .finally(()=>{outer.removeAttribute('src');outer.removeAttribute('srcdoc');resolveDisposed()})
  }
  function fail(code:string):void {
    if(!active)return
    options.diagnostic(code);rejectStarted(Error(code));dispose();options.failed?.(code)
  }
  function deliver(delivery:NativeCallbackDeliveryV3):void {
    const {nativeEvent:_,...wire}=delivery
    send({type:'callback',delivery:wire})
  }
  async function source(payload:any):Promise<unknown> {
    if(payload.op==='source-resource')return host.readSourceResource!(binding,payload.request,abort.signal)
    if(payload.op==='replace-numerical'||payload.op==='save')return host.save(binding,payload.request,abort.signal)
    if(payload.op==='mutate-author-key') {
      const reply=await host.mutateAuthorKey(binding,payload.request,abort.signal)
      if(!reply.snapshot)throw Error('BROWSER_ATTACHMENT_REVOKED')
      latest=reply.snapshot
      return reply
    }
    if(payload.op==='persona-mutation') {
      const reply=await host.mutatePersona!(binding,payload.request,abort.signal)
      if(reply.result.kind==='committed'&&!reply.snapshot)throw Error('BROWSER_ATTACHMENT_REVOKED')
      if(reply.snapshot)latest=reply.snapshot
      return reply
    }
    if(payload.op==='mutate-worldbook') {
      const reply=await host.mutateWorldbook!(binding,payload.request,abort.signal)
      if(reply.result.kind==='edited-data'&&!reply.snapshot)throw Error('BROWSER_ATTACHMENT_REVOKED')
      if(reply.snapshot)latest=reply.snapshot
      return reply
    }
    throw Error('BROWSER3_HOST_OPERATION_UNSUPPORTED')
  }
  async function request(message:BrowserWorkerRpcV3):Promise<void> {
    const observed=entry?.id===message.actorEntry&&message.request.op!=='host'?entry:undefined
    // Only actual synchronous Asyncify/native waits suspend this entry clock.
    // An author-returned provider Promise leaves the VM free and cannot hide
    // a fire-and-forget busy loop behind its pending parent request.
    if(observed){observed.waits.add(message.id);clock()}
    try {
      const result=message.request.op==='source'||message.request.op==='host'
        ?{value:await source(message.request.payload),frames:[]}
        :await scene!.request(message.request)
      send({type:'result',id:message.id,...result})
    }catch(error) {
      const code=error instanceof Error?error.message:String(error)
      send({type:'result',id:message.id,error:code})
      if(code==='BROWSER_ATTACHMENT_REVOKED')fail(code)
    }finally {
      if(observed&&entry===observed){observed.waits.delete(message.id);clock()}
    }
  }
  worker.addEventListener('error',event=>fail(event.message||'BROWSER3_WORKER_FAILED'))
  worker.addEventListener('message',event=>{
    const message=event.data
    if(!current())return
    if(message.type==='rpc')void request(message)
    else if(message.type==='actor-entry-start') {
      view.clearTimeout(bootTimer);view.clearTimeout(entry?.timer)
      entry={id:message.id,remaining:options.startupDeadlineMs,waits:new Set()};clock()
    }else if(message.type==='actor-entry-end') {
      if(entry&&entry.id===message.id){view.clearTimeout(entry.timer);entry=undefined}
    }else if(message.type==='startup-complete')resolveStarted()
    else if(message.type==='runtime-error'||message.type==='page-error')fail(message.code)
    else if(message.type==='notice'&&['page-callback-error','source-callback-error'].includes(message.notice?.type))
      options.diagnostic(message.notice.error)
  })
  function initialize():void {
    if(!current()||initialized||!scene||!latest)return
    initialized=true
    const bytes=Uint8Array.from(atob(artifact.wasm.data),character=>character.charCodeAt(0))
    send({type:'start',binding,program,snapshot:latest,wasm:bytes.buffer,operationPrefix})
  }
  function loaded():void {
    if(!current()||scene)return
    const document=outer.contentDocument!
    document.open();document.write(BROWSER_NATIVE_INERT_SHELL_V3);document.close()
    scene=createBrowserNativeSceneV3({program,schedulerWindow:view,onCallback:deliver,
      onSettlement:settlement=>send({type:'settlement',settlement}),
      onFrameClosed:frameId=>send({type:'frame-closed',frameId}),
      async createCarrierDocument(script,contextId,signal) {
        const iframe=document.createElement('iframe')
        iframe.title='作者脚本 '+script.ordinal;iframe.dataset.browserCarrier=contextId
        iframe.style.cssText='display:block;width:100%;height:100%;min-height:600px;border:0'
        iframe.setAttribute('sandbox','allow-same-origin')
        const carrierDocument=await new Promise<Document>((resolve,reject)=>{
          const finish=()=>{iframe.removeEventListener('load',done);signal.removeEventListener('abort',cancel)}
          const done=()=>{finish();resolve(iframe.contentDocument!)}
          const cancel=()=>{finish();iframe.remove();reject(Error('BROWSER3_ATTACHMENT_CLOSED'))}
          iframe.addEventListener('load',done,{once:true});signal.addEventListener('abort',cancel,{once:true})
          iframe.src='about:blank';document.body.appendChild(iframe)
        })
        carrierDocument.open();carrierDocument.write(BROWSER_NATIVE_INERT_SHELL_V3);carrierDocument.close()
        return {document:carrierDocument,dispose:()=>iframe.remove()}
      }})
    initialize()
  }
  outer.setAttribute('sandbox','allow-same-origin')
  outer.style.cssText='display:block;width:100%;height:620px;border:0'
  outer.addEventListener('load',loaded);outer.src='about:blank'
  return {started,disposed,dispose,
    publishSnapshot(value){if(!current())return;latest=value;if(initialized)send({type:'snapshot',snapshot:value});else initialize()},
    publishSaveConfirmation(value){if(value.snapshot)this.publishSnapshot(value.snapshot)},
    publishSourceEvent(event){send({type:'source-event',event})},
    render(value){options.layout({height:outer.clientHeight,renderRevision:value.renderRevision})},
  }
}
