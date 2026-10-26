/** Main owns actual native carrier documents and Source frames. Worker RPC
 * addresses these resources; neither a posted plan nor a caller ID owns them. */
import {createBrowserSourceFrameOwnerV3} from './tavern-author-browser-frame-native-v3.js'
import type {BrowserNativeSourceFrameV3} from './tavern-author-browser-frame-native-v3.js'
import {createBrowserPageRendererV3} from './tavern-author-browser-renderer-v3.js'
import type {BrowserNativeNodeRegistryV3} from './tavern-author-browser-renderer-v3.js'
import type {BrowserCompiledScriptV3,BrowserProgramV3,BrowserPageResourceV3}
  from './tavern-author-browser-types-v3.mjs'
import type {BrowserPageNativeSessionV3} from './tavern-author-browser-page-worker-v3.js'
import type {BrowserPageRendererV3,NativeHandleV3,NativeWireObjectV3,NativeCallbackDeliveryV3,
  NativePromiseSettlementV3,NativeReplyV3,BrowserNativeImageV3} from './tavern-author-browser-native-types-v3.js'
import type {BrowserNativeFrameFactV3,BrowserWorkerRequestV3}
  from './tavern-author-browser-worker-protocol-v3.js'
import type {ReaderRegexDocumentProgramV1,ReaderRegexDocumentPlanV1} from './reader-regex-document-types.mjs'
import type {BrowserComposerAccessV3} from './tavern-author-browser-native-types-v3.js'

export interface BrowserNativeCarrierDocumentV3 {
  readonly document:Document
  dispose():Promise<void>|void
}
interface Options {
  readonly program:BrowserProgramV3|ReaderRegexDocumentProgramV1
  readonly schedulerWindow?:Window
  /** Actual isolated Reader DOM and selected containers are Main resources,
   * never Source HTML or author-posted nodes. */
  readonly readerRootDocument?:Document
  /** A Helper attachment borrows this actual isolated surface through its
   * own parent realm; another Reader Actor keeps its independent ownership. */
  readonly helperRootDocument?:Document
  readonly composer?:BrowserComposerAccessV3
  readerDocumentContainer?(plan:ReaderRegexDocumentPlanV1):HTMLElement
  /** Frontend owns the real document/container, including its layout. This
   * callback supplies an inert carrier document, never the Main app document. */
  createCarrierDocument(script:BrowserCompiledScriptV3,contextId:string,signal:AbortSignal):
    Promise<BrowserNativeCarrierDocumentV3>
  readonly onCallback:(delivery:NativeCallbackDeliveryV3)=>void
  readonly prepareCallback?:(delivery:NativeCallbackDeliveryV3,scriptIdentity:string)=>NativeCallbackDeliveryV3
  readonly observeNativeEvent?:(event:Event,pageId:string,scriptIdentity:string)=>void
  readonly onPageClosed?:(pageId:string)=>void
  readonly onImages?:(pageId:string,images:readonly BrowserNativeImageV3[])=>void
  readonly onSettlement:(settlement:NativePromiseSettlementV3)=>void
  readonly onFrameClosed:(frameId:number)=>void
  readonly resolveResource?:(resource:BrowserPageResourceV3)=>string
}
interface Carrier {
  readonly scriptIdentity:string
  readonly source:BrowserNativeCarrierDocumentV3
  readonly renderer:BrowserPageRendererV3
}
interface Page {
  readonly carrierIdentity?:string
  readonly frame:BrowserNativeSourceFrameV3
  readonly session:BrowserPageNativeSessionV3
}
export interface BrowserNativeSceneReplyV3 {
  readonly value:unknown
  readonly frames:readonly BrowserNativeFrameFactV3[]
}

export function createBrowserNativeSceneV3(options:Options) {
  const abort=new AbortController(),carriers=new Map<string,Carrier>(),pages=new Map<string,Page>()
  const frameTokens=new Map<number,BrowserNativeSourceFrameV3>()
  const publishedFrameReferences=new Set<string>()
  const program=options.program,reader=program.encoding==='reader-regex-document-program-v1'
  const pagePlans=new Map((program.encoding==='reader-regex-document-program-v1'?program.documents:program.sourcePages)
    .map(plan=>[plan.pagePlanSha256,plan] as const))
  const readerPlans=new Map<BrowserNativeSourceFrameV3,string>()
  let readerRoot:BrowserPageRendererV3|undefined
  let helperRoot:BrowserPageRendererV3|undefined
  let active=true,disposal:Promise<void>|undefined
  const nodeReferences=new WeakMap<object,NativeHandleV3>()
  const registeredNodes=new Map<string,{node:Node;reference:NativeHandleV3}>()
  const pageNodes=new Map<string,Set<string>>()
  const referenceKey=(reference:NativeHandleV3)=>reference.pageId+':'+reference.handle
  const sharedNodes:BrowserNativeNodeRegistryV3={
    reference:node=>nodeReferences.get(node),
    resolve:reference=>{
      const row=registeredNodes.get(referenceKey(reference))
      return row?.reference.kind===reference.kind?row.node:undefined
    },
    register(node,reference){
      const key=referenceKey(reference),keys=pageNodes.get(reference.pageId)??new Set<string>()
      keys.add(key);pageNodes.set(reference.pageId,keys)
      nodeReferences.set(node,reference);registeredNodes.set(key,{node,reference})
    },
    release(pageId){
      for(const key of pageNodes.get(pageId)??[]){const row=registeredNodes.get(key)!
        nodeReferences.delete(row.node);registeredNodes.delete(key)}
      pageNodes.delete(pageId)
    },
  }
  const prepareCallback=(delivery:NativeCallbackDeliveryV3)=>{
    const pageId=delivery.callback.pageId,identity=carriers.get(pageId)?.scriptIdentity??pages.get(pageId)?.carrierIdentity
    return identity&&options.prepareCallback?options.prepareCallback(delivery,identity):delivery
  }
  const emitCallback=(delivery:NativeCallbackDeliveryV3)=>options.onCallback(prepareCallback(delivery))
  const frames=createBrowserSourceFrameOwnerV3({onCallback:emitCallback,
    onFrameClosed:(frame,pageId)=>{
      frameTokens.delete(frame.frameId)
      if(pageId){pages.delete(pageId);options.onPageClosed?.(pageId)}
      if(active)options.onFrameClosed(frame.frameId)
    },rendererOptions:(frame,pageId)=>({schedulerWindow:options.schedulerWindow,
      onNativeEvent:options.observeNativeEvent&&frame.principal.kind==='helper'
        ?event=>options.observeNativeEvent!(event,pageId,frame.principal.kind==='helper'
          ?frame.principal.carrierIdentity:''):undefined,
      onCallback:emitCallback,onPromiseSettlement:options.onSettlement,onImages:options.onImages,
      resolveResource:options.resolveResource,sharedNodes})})
  function remember(value:unknown,facts:BrowserNativeFrameFactV3[]):void {
    if(!value||typeof value!=='object')return
    if(Array.isArray(value)){for(const item of value)remember(item,facts);return}
    const wire=value as NativeWireObjectV3
    if('tag' in wire&&wire.tag==='handle'&&wire.kind==='frame') {
      const referenceKey=wire.pageId+':'+wire.handle
      // removeChild legitimately returns its now-closed resource. Publication
      // already supplied that identity; the echo must not register it again.
      if(publishedFrameReferences.has(referenceKey))return
      const frame=frames.getFrame(wire)
      if(!frameTokens.has(frame.frameId)) {
        frameTokens.set(frame.frameId,frame)
        publishedFrameReferences.add(referenceKey)
        const owner=frames.owner(frame)
        if('kind' in owner)
          facts.push({frameId:frame.frameId,reference:wire,...owner,documentPlanSha256:readerPlans.get(frame)!})
        else facts.push({frameId:frame.frameId,reference:wire,...owner})
      }
    }else if('tag' in wire&&wire.tag==='record') {
      for(const item of Object.values(wire.entries))remember(item,facts)
    }
  }
  async function createCarrier(ordinal:number,contextId:string) {
    if(program.encoding==='reader-regex-document-program-v1')throw Error('READER_REGEX_DOCUMENT_HELPER_UNAVAILABLE')
    const script=program.scripts.find(row=>row.ordinal===ordinal)!
    const source=await options.createCarrierDocument(script,contextId,abort.signal)
    try {
      abort.signal.throwIfAborted()
      let scriptReference!:NativeHandleV3
      // A trusted empty carrier shell is Native bootstrap DATA. It is not a
      // fabricated parsed Source candidate and carries no admission hashes.
      const renderer=createBrowserPageRendererV3({document:source.document,pageId:contextId,
        sharedNodes,
        schedulerWindow:options.schedulerWindow,
        onNativeEvent:options.observeNativeEvent
          ?event=>options.observeNativeEvent!(event,contextId,script.descriptor.identity):undefined,
        plan:{parsed:{document:{documentNodeId:0,mode:'no-quirks',nodes:[]},
          steps:[],scripts:[],styles:[],resources:[]},resources:program.sourcePages.flatMap(plan=>plan.resources)},
        carrierScript:{javascript:script.javascript,identity:script.descriptor.identity,mediaSources:script.mediaSources,
          captured:reference=>{scriptReference=reference}},
        externalFrames:frames.forCarrier({document:source.document,pageId:contextId,
          carrierIdentity:script.descriptor.identity}),onCallback:emitCallback,
        onPromiseSettlement:options.onSettlement,onImages:options.onImages,resolveResource:options.resolveResource})
      carriers.set(contextId,{source,renderer,scriptIdentity:script.descriptor.identity})
      return {document:renderer.getDocumentHandle(),script:scriptReference}
    }catch(error) {await source.dispose();throw error}
  }
  function createReaderRoot(facts:BrowserNativeFrameFactV3[]) {
    if(program.encoding!=='reader-regex-document-program-v1')throw Error('READER_REGEX_DOCUMENT_UNAVAILABLE')
    const document=options.readerRootDocument!
    readerRoot=createBrowserPageRendererV3({document,pageId:'reader-root',readerRootDocument:true,sharedNodes,
      plan:{parsed:{document:{documentNodeId:0,mode:'no-quirks',nodes:[]},
        steps:[],scripts:[],styles:[],resources:[]},resources:[]},schedulerWindow:options.schedulerWindow,
      externalFrames:frames.forDocument({document,pageId:'reader-root',principal:{kind:'reader-regex-document',
        programSha256:program.programSha256}}),onCallback:emitCallback,onPromiseSettlement:options.onSettlement})
    readerRoot.setDocumentState('complete')
    for(const plan of program.documents) {
      const reference=frames.createFrame(document,options.readerDocumentContainer!(plan)),frame=frames.getFrame(reference)
      readerPlans.set(frame,plan.pagePlanSha256);remember(reference,facts)
    }
    return {document:readerRoot.getDocumentHandle(),frames:facts}
  }
  function createHelperRoot() {
    if(program.encoding!=='native-author-browser-program-v3'||program.profile.version!==5||!options.helperRootDocument)
      throw Error('BROWSER3_HELPER_ROOT_UNAVAILABLE')
    helperRoot=createBrowserPageRendererV3({document:options.helperRootDocument,pageId:'helper-root',readerRootDocument:true,
      sharedNodes,composer:options.composer,schedulerWindow:options.schedulerWindow,
      plan:{parsed:{document:{documentNodeId:0,mode:'no-quirks',nodes:[]},steps:[],scripts:[],styles:[],resources:[]},resources:[]},
      onCallback:emitCallback,onPromiseSettlement:options.onSettlement})
    helperRoot.setDocumentState('complete')
    return {document:helperRoot.getDocumentHandle()}
  }
  async function disposeCarrier(contextId:string):Promise<void> {
    const carrier=carriers.get(contextId)
    if(!carrier)return
    carriers.delete(contextId)
    options.onPageClosed?.(contextId)
    try {await carrier.renderer.dispose()}
    finally {await carrier.source.dispose()}
  }
  async function request(input:BrowserWorkerRequestV3):Promise<BrowserNativeSceneReplyV3> {
    abort.signal.throwIfAborted()
    let value:unknown
    const facts:BrowserNativeFrameFactV3[]=[]
    if(input.op==='carrier-create')value=await createCarrier(input.ordinal,input.contextId)
    else if(input.op==='reader-root-create')value=createReaderRoot(facts)
    else if(input.op==='helper-root-create')value=createHelperRoot()
    else if(input.op==='carrier-state')carriers.get(input.contextId)!.renderer.setDocumentState(input.state)
    else if(input.op==='carrier-dispose')await disposeCarrier(input.contextId)
    else if(input.op==='native') {
      const target='target' in input.request?input.request.target:undefined
      const contextId=target?.pageId??input.contextId,carrier=carriers.get(contextId)
      value=contextId==='helper-root'&&helperRoot?helperRoot.requestReply(input.request)
        :contextId==='reader-root'&&readerRoot?readerRoot.requestReply(input.request)
        :carrier?carrier.renderer.requestReply(input.request)
        :await pages.get(contextId)!.session.request(input.request,abort.signal)
    }else if(input.op==='page-mount') {
      const frame=frameTokens.get(input.frameId)!,plan=pagePlans.get(input.planSha256)!
      const owner=frames.owner(frame)
      if(reader) {
        if(!('kind' in owner)||owner.kind!=='reader-regex-document'
          ||owner.programSha256!==program.programSha256||owner.parentPageId!=='reader-root'
          ||readerPlans.get(frame)!==plan.pagePlanSha256||!readerRoot)
          throw Error('READER_REGEX_DOCUMENT_PARENT_UNPROVEN')
      }else if(!('carrierIdentity' in owner)||plan.encoding!=='native-author-browser-source-page-plan-v3'
        ||owner.carrierIdentity!==plan.origin.carrier.identity||!carriers.has(owner.parentPageId))
          throw Error('BROWSER3_SOURCE_PAGE_PARENT_UNPROVEN')
      const session=await frames.transport.mount(frame,input.pageId,plan,abort.signal)
      pages.set(input.pageId,{frame,session,...'carrierIdentity' in owner?{carrierIdentity:owner.carrierIdentity}:{}})
    }else if(input.op==='page-dispose') {
      const page=pages.get(input.pageId)
      if(page) {pages.delete(input.pageId);options.onPageClosed?.(input.pageId);await frames.transport.dispose(page.frame,input.pageId)}
    }else if(input.op==='frame-location')frames.recordLocation(frameTokens.get(input.frameId)!,input.location)
    else if(input.op==='page-loaded')frames.frameLoaded(frameTokens.get(input.frameId)!,input.pageId)
    else {
      const pageId='pageId' in input?input.pageId:undefined,session=pageId?pages.get(pageId)!.session:undefined
      if(input.op==='page-apply')value=await session!.applyUntil(input.exclusiveEnd,abort.signal)
      else if(input.op==='page-document')value=await session!.getDocumentHandle(abort.signal)
      else if(input.op==='page-node')value=await session!.getParsedNodeHandle(input.nodeId,abort.signal)
      else if(input.op==='page-state')await session!.setDocumentState(input.state,abort.signal)
      else if(input.op==='page-resources')await session!.awaitResourcesReady(abort.signal)
      else throw Error('BROWSER3_NATIVE_SCENE_OPERATION_UNSUPPORTED')
    }
    // DOM Events themselves stay in their Main owner. Only callback snapshots
    // cross the Worker port; nativeEvent is an in-process gesture hook.
    if(input.op==='native') {
      const reply=value as NativeReplyV3
      value={...reply,...reply.callbacks?{callbacks:reply.callbacks.map(delivery=>{
        const {nativeEvent:_,...callback}=prepareCallback(delivery)
        return callback
      })}:{}}
    }
    if(input.op==='native')remember((value as NativeReplyV3).value,facts)
    return {value,frames:facts}
  }
  function dispose():Promise<void> {
    if(disposal)return disposal
    active=false;abort.abort()
    disposal=(async()=>{
      const results=await Promise.allSettled([...carriers.keys()].map(disposeCarrier))
      await readerRoot?.dispose();readerRoot=undefined;readerPlans.clear()
      await helperRoot?.dispose();helperRoot=undefined
      frames.dispose();pages.clear();frameTokens.clear();publishedFrameReferences.clear()
      const failed=results.find(result=>result.status==='rejected')
      if(failed?.status==='rejected')throw failed.reason
    })()
    return disposal
  }
  return {request,dispose,resources:()=>({carriers:carriers.size,pageRoutes:pages.size,...frames.resources()})}
}
