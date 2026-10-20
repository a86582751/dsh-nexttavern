/** Main owns the real Worker and native scene. Author JavaScript runs only in
 * QuickJS; native wait ACKs never require another entry into that Actor. */
import {createBrowserNativeSceneV3} from './tavern-author-browser-native-scene-v3.js'
import {BROWSER_NATIVE_INERT_SHELL_V3} from './tavern-author-browser-frame-native-v3.js'
import type {BrowserBindingV1,BrowserRenderV1} from './tavern-author-browser-types.mjs'
import type {BrowserProgramV3,BrowserSnapshotV3,BrowserRuntimeArtifactV3,BrowserHostBridgeV3,BrowserSaveReplyV3}
  from './tavern-author-browser-types-v3.mjs'
import type {BrowserWorkerRpcV3,BrowserWorkerInputV3,BrowserSourceEventV3} from './tavern-author-browser-worker-protocol-v3.js'
import type {NativeCallbackDeliveryV3,BrowserNativeImageV3} from './tavern-author-browser-native-types-v3.js'
import type {BrowserCallbackRegistrationV3,BrowserGenerationInvocationV3,BrowserGenerationResultV3}
  from './roleplay-author-browser-generation-types.js'
import type {ReaderRegexDocumentProgramV1,ReaderRegexDocumentSnapshotV1,ReaderRegexDocumentRenderV1}
  from './reader-regex-document-types.mjs'

export interface BrowserFrameHostV3 extends BrowserHostBridgeV3 {
  closeBinding(binding:BrowserBindingV1):Promise<void>
}

interface Options {
  current():boolean
  layout(value:{height:number;renderRevision:number}):void
  diagnostic(code:string):void
  failed?(code:string):void
  onImages?:(pageId:string,images:readonly BrowserNativeImageV3[])=>void
  mountStaticDocument?:(container:HTMLElement,html:string,layout:()=>void)=>{dispose():void}
  startupDeadlineMs:number
}
interface EntryClock {
  readonly id:number
  remaining:number
  since?:number
  timer?:number
  readonly waits:Set<number>
}
/** Main owns both minting and consumption. A guest's serialized Event fields
 * never enter this owner; only the Native scene passes its actual Event. */
export function createBrowserGenerationGesturesV3(program:BrowserProgramV3,current:()=>boolean,
  userActivation:()=>boolean) {
  const gestures=new Map<string,{pageId:string;callbackId:number;scriptIdentity:string}>()
  let approvedEvents=new WeakMap<Event,{pageId:string;scriptIdentity:string}>()
  const submitOrigins=new Map<string,HTMLFormElement>()
  function observe(event:Event,pageId:string,scriptIdentity:string):void {
    if(!program.generationDeclarationId||!current())return
    const trusted=event.isTrusted&&userActivation()
    if(event.type==='submit') {
      // A browser-created submit can also follow Source's button.click(). Only
      // an actual captured user click/Enter on this form supplies its origin.
      const form=submitOrigins.get(pageId)
      submitOrigins.delete(pageId)
      if(trusted&&form===event.target)approvedEvents.set(event,{pageId,scriptIdentity})
      return
    }
    if(event.type==='click'||event.type==='keydown') {
      submitOrigins.delete(pageId)
      if(trusted) {
        const target=event.composedPath().find(node=>(node as Node).nodeType===1) as Element|undefined
        const control=target?.closest('button,input') as HTMLButtonElement|HTMLInputElement|null|undefined
        if(control?.form&&(event.type==='click'&&control.type==='submit'
          ||event.type==='keydown'&&(event as KeyboardEvent).key==='Enter'))submitOrigins.set(pageId,control.form)
      }
    }
    if(trusted)approvedEvents.set(event,{pageId,scriptIdentity})
  }
  function prepare(delivery:NativeCallbackDeliveryV3,scriptIdentity:string):NativeCallbackDeliveryV3 {
    const event=delivery.nativeEvent
    const approved=event&&approvedEvents.get(event)
    if(!current()||delivery.resourceKind!=='native-event'
      ||approved?.pageId!==delivery.callback.pageId||approved.scriptIdentity!==scriptIdentity)return delivery
    const gestureId=crypto.randomUUID()
    gestures.set(gestureId,{pageId:delivery.callback.pageId,callbackId:delivery.callback.callbackId,scriptIdentity})
    return {...delivery,generation:{gestureId,scriptIdentity}}
  }
  function consume(request:{gestureId:string;scriptIdentity:string},invocation:{pageId:string;callbackId:number}):void {
    const gesture=gestures.get(request.gestureId)
    if(!current()||!gesture||gesture.pageId!==invocation.pageId||gesture.callbackId!==invocation.callbackId
      ||gesture.scriptIdentity!==request.scriptIdentity)throw Error('BROWSER_TRUSTED_FORM_REQUIRED')
    gestures.delete(request.gestureId)
  }
  return {observe,prepare,consume,finish:(gestureId:string)=>{gestures.delete(gestureId)},
    closePage:(pageId:string)=>{
      submitOrigins.delete(pageId)
      for(const [id,gesture] of gestures)if(gesture.pageId===pageId)gestures.delete(id)
    },dispose:()=>{gestures.clear();submitOrigins.clear();approvedEvents=new WeakMap()}}
}
export interface BrowserFrameControllerV3 {
  readonly started:Promise<void>
  readonly disposed:Promise<void>
  publishSnapshot(value:BrowserSnapshotV3):void
  publishSaveConfirmation(value:BrowserSaveReplyV3):void
  /** Called only by the actual Core/UI event producer owning these facts. */
  publishSourceEvent(value:BrowserSourceEventV3):void
  generationCallbacks():Promise<readonly BrowserCallbackRegistrationV3[]>
  invokeGenerationV3(invocation:BrowserGenerationInvocationV3,signal:AbortSignal):Promise<BrowserGenerationResultV3>
  render(value:BrowserRenderV1):void
  dispose():void
}
export interface ReaderRegexDocumentFrameControllerV1 {
  readonly started:Promise<void>
  readonly disposed:Promise<void>
  publishSnapshot(value:ReaderRegexDocumentSnapshotV1):void
  render(value:ReaderRegexDocumentRenderV1):void
  dispose():void
}
type FrameSnapshot=BrowserSnapshotV3|ReaderRegexDocumentSnapshotV1
type FrameRender=BrowserRenderV1|ReaderRegexDocumentRenderV1
interface OwnedFrameController extends Omit<BrowserFrameControllerV3,'publishSnapshot'|'render'> {
  publishSnapshot(value:FrameSnapshot):void
  render(value:FrameRender):void
}

export function createBrowserRuntimeFrameV3(outer:HTMLIFrameElement,artifact:BrowserRuntimeArtifactV3,
  binding:BrowserBindingV1,program:BrowserProgramV3,host:BrowserFrameHostV3,options:Options):BrowserFrameControllerV3 {
  return createOwnedPageRuntimeFrame(outer,artifact,binding,program,host,options)
}
/** Same Worker/Actor/native renderer kernel, with an independent Reader
 * program and a read-only principal. No Browser3 program is manufactured. */
export function createReaderRegexDocumentFrameV1(outer:HTMLIFrameElement,artifact:BrowserRuntimeArtifactV3,
  binding:BrowserBindingV1,program:ReaderRegexDocumentProgramV1,
  options:Options&{mountStaticDocument(container:HTMLElement,html:string,layout:()=>void):{dispose():void}}):ReaderRegexDocumentFrameControllerV1 {
  return createOwnedPageRuntimeFrame(outer,artifact,binding,program,undefined,options)
}
function createOwnedPageRuntimeFrame(outer:HTMLIFrameElement,artifact:BrowserRuntimeArtifactV3,
  binding:BrowserBindingV1,program:BrowserProgramV3|ReaderRegexDocumentProgramV1,host:BrowserFrameHostV3|undefined,
  options:Options):OwnedFrameController {
  const view=outer.ownerDocument.defaultView!,abort=new AbortController(),operationPrefix=crypto.randomUUID()
  const workerURL=URL.createObjectURL(new Blob([artifact.executionWorkerJavascript],{type:'text/javascript'}))
  const worker=new Worker(workerURL,{type:'module'})
  let active=true,latest:FrameSnapshot|undefined,initialized=false,entry:EntryClock|undefined
  let scene:ReturnType<typeof createBrowserNativeSceneV3>|undefined
  let readerRoot:HTMLElement|undefined,readerStyle:HTMLStyleElement|undefined
  let pendingRender:FrameRender|undefined,renderRevision=0,layoutFrame:number|undefined
  let readerResize:ResizeObserver|undefined,readerMutation:MutationObserver|undefined
  const readerRows=new Map<string,{node:HTMLElement;kind:'user'|'narrator';content:string;staticDocuments:{dispose():void}[]}>()
  const documentContainers=new Map<string,HTMLElement>()
  let generationSequence=0
  const registrationRequests=new Map<number,{resolve:(rows:readonly BrowserCallbackRegistrationV3[])=>void;reject:(error:Error)=>void}>()
  const generationRequests=new Map<string,{invocation:BrowserGenerationInvocationV3;
    resolve:(result:BrowserGenerationResultV3)=>void;reject:(error:Error)=>void;cleanup():void}>()
  let resolveStarted!:()=>void,rejectStarted!:(error:Error)=>void,resolveDisposed!:()=>void
  const started=new Promise<void>((yes,no)=>{resolveStarted=yes;rejectStarted=no})
  const disposed=new Promise<void>(yes=>{resolveDisposed=yes})
  const current=()=>active&&options.current()
  function scheduleLayout():void {
    if(!current()||layoutFrame!==undefined)return
    layoutFrame=view.requestAnimationFrame(()=>{
      layoutFrame=undefined
      if(!current()||!readerRoot)return
      const body=readerRoot.ownerDocument.body,top=body.getBoundingClientRect().top
      // Content bounds can shrink; body.scrollHeight includes the current
      // iframe viewport and would retain a previous, taller history page.
      const height=Math.ceil(Array.from(body.children).reduce((height,element)=>
        Math.max(height,element.getBoundingClientRect().bottom-top),0))
      outer.style.height=height+'px'
      options.layout({height,renderRevision})
    })
  }
  function renderReader(value:FrameRender):void {
    if(!current())return
    if(!readerRoot||!readerStyle){pendingRender=value;return}
    renderRevision=value.renderRevision
    const css=value.css+'\nhtml,body{margin:0;overflow:hidden}'+
      '.rp-reader-view{min-height:0;overflow:visible;display:block}'
    if(readerStyle.textContent!==css)readerStyle.textContent=css
    const document=readerRoot.ownerDocument,next=new Set(value.parts.map(part=>part.key))
    // Remove rows leaving the selected history before ordering retained rows,
    // so clipping an older prefix does not reattach unchanged media nodes.
    for(const [key,row] of readerRows)if(!next.has(key)) {
      for(const document of row.staticDocuments)document.dispose()
      row.node.remove();readerRows.delete(key)
    }
    let cursor=readerRoot.firstChild
    for(const part of value.parts) {
      const fragments=part.kind==='narrator'&&'fragments' in part?part.fragments:undefined
      const content=part.kind==='user'?part.text:fragments?JSON.stringify(fragments):part.html
      let row=readerRows.get(part.key)
      if(!row) {
        const node=document.createElement('section')
        node.className='rp-reader-message';node.dataset.readerKey=part.key
        row={node,kind:part.kind,content:'',staticDocuments:[]};readerRows.set(part.key,row)
      }
      if(!row.node.firstChild||row.kind!==part.kind||row.content!==content) {
        for(const document of row.staticDocuments)document.dispose()
        row.staticDocuments=[]
        const body=document.createElement(part.kind==='user'?'p':'div')
        body.className=part.kind==='user'?'rp-user-line':'rp-reader-narrative'
        if(part.kind==='user')body.textContent='◈ 你：'+part.text
        else if(fragments)for(const fragment of fragments) {
          const node=document.createElement('div')
          if(fragment.kind==='text')node.innerHTML=fragment.html // Trusted Reader's existing sanitizer.
          else if(fragment.kind==='static-document')
            row.staticDocuments.push(options.mountStaticDocument!(node,fragment.html,scheduleLayout))
          else {
            node.dataset.readerRegexDocument=fragment.documentPlanSha256
            documentContainers.set(fragment.documentPlanSha256,node)
          }
          body.appendChild(node)
        }
        else body.innerHTML=part.html // The trusted Reader owns HTML sanitization.
        row.node.replaceChildren(body);row.node.dataset.kind=part.kind==='user'?'user':'assistant'
        row.kind=part.kind;row.content=content
      }
      // Moving an unchanged subtree can reload media. Only insert when its
      // actual position differs, including a history prepend or branch change.
      if(row.node!==cursor)readerRoot.insertBefore(row.node,cursor)
      cursor=row.node.nextSibling
    }
    scheduleLayout()
  }
  const gestures=program.encoding==='native-author-browser-program-v3'
    ?createBrowserGenerationGesturesV3(program,current,()=>view.navigator.userActivation.isActive):undefined
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
    readerResize?.disconnect();readerMutation?.disconnect()
    if(layoutFrame!==undefined)view.cancelAnimationFrame(layoutFrame)
    for(const row of readerRows.values())for(const document of row.staticDocuments)document.dispose()
    layoutFrame=undefined;pendingRender=undefined;readerRows.clear();documentContainers.clear();readerRoot=undefined;readerStyle=undefined
    // Main termination remains independent of a busy or suspended guest. It
    // does not imply graceful VM disposal; Main still frees its own resources.
    gestures?.dispose()
    const error=Error('BROWSER_GENERATION_REVOKED')
    for(const pending of registrationRequests.values())pending.reject(error)
    registrationRequests.clear()
    for(const pending of generationRequests.values()){pending.cleanup();pending.reject(error)}
    generationRequests.clear()
    outer.removeEventListener('load',loaded)
    rejectStarted(Error('BROWSER_GENERATION_REVOKED'))
    // Core closes the attachment's prompt resources before removing its private
    // owner. This confirmation must survive termination of the guest Worker.
    void (host?host.closeBinding(binding):Promise.resolve()).catch(error=>options.diagnostic(String(error)))
      .finally(async()=>{
        worker.terminate();URL.revokeObjectURL(workerURL)
        try {await scene?.dispose()}
        catch(error){options.diagnostic(String(error))}
        finally {outer.removeAttribute('src');outer.removeAttribute('srcdoc');resolveDisposed()}
      })
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
    if(!host)throw Error('READER_REGEX_DOCUMENT_HOST_OPERATION_UNAVAILABLE')
    if(payload.op==='cleanup-prompts') {
      await host.cleanupPrompts!(binding,payload.request,abort.signal)
      if(payload.request.kind==='resource-closed') {
        const pageId=payload.request.resource.pageId
        for(const [id,pending] of generationRequests)if(pending.invocation.registrations
          .some(row=>row.resource.pageId===pageId)) {
          generationRequests.delete(id);pending.cleanup()
          send({type:'generation-cancel',invocationId:id})
          pending.resolve({kind:'cancelled',binding,invocationId:id,
            diagnostics:[{code:'BROWSER_GENERATION_RESOURCE_RETIRED'}]})
        }
      }
      return undefined
    }
    if(payload.op==='generate-raw') {
      gestures!.consume(payload.request,payload.invocation)
      if(!host.generateRaw)throw Error('BROWSER_GENERATION_UNAVAILABLE')
      return host.generateRaw(binding,payload.request,abort.signal)
    }
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
    if(message.type==='generation-registrations-result') {
      const pending=registrationRequests.get(message.id)
      if(pending){registrationRequests.delete(message.id)
        if(message.error)pending.reject(Error(message.error))
        else pending.resolve(message.registrations)}
    }else if(message.type==='generation-result-v3') {
      const pending=generationRequests.get(message.result.invocationId)
      if(pending){generationRequests.delete(message.result.invocationId);pending.cleanup();pending.resolve(message.result)}
    }else if(message.type==='rpc')void request(message)
    else if(message.type==='actor-entry-start') {
      view.clearTimeout(bootTimer);view.clearTimeout(entry?.timer)
      entry={id:message.id,remaining:options.startupDeadlineMs,waits:new Set()};clock()
    }else if(message.type==='actor-entry-end') {
      if(entry&&entry.id===message.id){view.clearTimeout(entry.timer);entry=undefined}
    }else if(message.type==='startup-complete')resolveStarted()
    else if(message.type==='runtime-error'||message.type==='page-error')fail(message.code)
    else if(message.type==='notice'&&message.notice?.type==='generation-invocation-ended')
      gestures?.finish(message.notice.gestureId)
    else if(message.type==='notice'&&['page-callback-error','source-callback-error'].includes(message.notice?.type))
      options.diagnostic(message.notice.error)
  })
  function initialize():void {
    if(!current()||initialized||!scene||!latest)return
    initialized=true
    const bytes=Uint8Array.from(atob(artifact.wasm.data),character=>character.charCodeAt(0))
    if(program.encoding==='reader-regex-document-program-v1')
      send({type:'reader-start',binding,program,snapshot:latest as ReaderRegexDocumentSnapshotV1,wasm:bytes.buffer,operationPrefix})
    else send({type:'start',binding,program,snapshot:latest as BrowserSnapshotV3,wasm:bytes.buffer,operationPrefix})
  }
  function loaded():void {
    if(!current()||scene)return
    const document=outer.contentDocument!
    document.open();document.write(BROWSER_NATIVE_INERT_SHELL_V3);document.close()
    readerStyle=document.createElement('style');document.head.append(readerStyle)
    const viewport=document.createElement('div');viewport.className='rp-reader-view'
    readerRoot=document.createElement('div');readerRoot.className='rp-reader'
    viewport.append(readerRoot);document.body.append(viewport)
    readerResize=new ResizeObserver(scheduleLayout);readerResize.observe(document.body)
    readerMutation=new MutationObserver(scheduleLayout)
    readerMutation.observe(document.body,{childList:true,subtree:true,attributes:true,characterData:true})
    if(pendingRender){const value=pendingRender;pendingRender=undefined;renderReader(value)}
    scene=createBrowserNativeSceneV3({program,schedulerWindow:view,onCallback:deliver,
      ...program.encoding==='reader-regex-document-program-v1'?{readerRootDocument:document,
        readerDocumentContainer:plan=>documentContainers.get(plan.pagePlanSha256)!}:{},
      onImages:options.onImages,
      prepareCallback:gestures?.prepare,onPageClosed:gestures?.closePage,
      observeNativeEvent:program.encoding==='native-author-browser-program-v3'&&program.generationDeclarationId?gestures?.observe:undefined,
      onSettlement:settlement=>send({type:'settlement',settlement}),
      onFrameClosed:frameId=>send({type:'frame-closed',frameId}),
      async createCarrierDocument(script,contextId,signal) {
        const iframe=document.createElement('iframe')
        iframe.title='作者脚本 '+script.ordinal;iframe.dataset.browserCarrier=contextId
        // A viewport-relative carrier height would grow with the outer chat
        // height. Keep the existing 600px carrier viewport independent of it.
        iframe.style.cssText='display:block;width:100%;height:600px;border:0'
        iframe.setAttribute('sandbox','allow-same-origin allow-forms')
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
  outer.setAttribute('sandbox','allow-same-origin allow-forms')
  outer.style.cssText='display:block;width:100%;height:620px;border:0'
  outer.addEventListener('load',loaded);outer.src='about:blank'
  return {started,disposed,dispose,
    async generationCallbacks(){
      // Startup owns readiness. A later empty registry is valid after the
      // author's last eventOnce callback, and must not wait for another event.
      await started
      if(!current())throw Error('BROWSER_GENERATION_REVOKED')
      const id=++generationSequence
      return new Promise<readonly BrowserCallbackRegistrationV3[]>((resolve,reject)=>{
        registrationRequests.set(id,{resolve,reject});send({type:'generation-registrations-request',id})
      })
    },
    invokeGenerationV3(invocation,signal){
      const cancelled=():BrowserGenerationResultV3=>({kind:'cancelled',binding,invocationId:invocation.invocationId,
        diagnostics:[{code:'BROWSER_GENERATION_REVOKED'}]})
      if(!current()||signal.aborted)return Promise.resolve(cancelled())
      return new Promise<BrowserGenerationResultV3>((resolve,reject)=>{
        const stopped=()=>{
          generationRequests.delete(invocation.invocationId);signal.removeEventListener('abort',stopped)
          send({type:'generation-cancel',invocationId:invocation.invocationId});resolve(cancelled())
        }
        generationRequests.set(invocation.invocationId,{invocation,resolve,reject,
          cleanup:()=>signal.removeEventListener('abort',stopped)})
        signal.addEventListener('abort',stopped,{once:true})
        send({type:'generation-invocation',invocation})
      })
    },
    publishSnapshot(value){
      if(!current())return
      latest=value
      if(!initialized)initialize()
      else if(value.encoding==='reader-regex-document-snapshot-v1')send({type:'reader-snapshot',snapshot:value})
      else send({type:'snapshot',snapshot:value})
    },
    publishSaveConfirmation(value){if(value.snapshot)this.publishSnapshot(value.snapshot)},
    publishSourceEvent(event){send({type:'source-event',event})},
    render:renderReader,
  }
}
