/** The enclosing real Worker owns this attachment. One Actor serializes every
 * VM entry; native acknowledgements and provider waits never wait for that
 * queue. Private snapshot and creator-bound functions are actual guest values. */
import type {BrowserActorV3} from './tavern-author-browser-adapter-v3.js'
import {BrowserPageWorkerV3} from './tavern-author-browser-page-worker-v3.js'
import type {BrowserPageTransportV3,BrowserPageBootstrapV3,BrowserPageGuestControllerV3}
  from './tavern-author-browser-page-worker-v3.js'
import {browserPageGuestBootstrapV3} from './tavern-author-browser-page-guest-v3.js'
import {browserSourceGuestBootstrapV3} from './tavern-author-browser-source-guest-v3.js'
import type {BrowserProgramV3,BrowserSnapshotV3,BrowserCompiledScriptV3,BrowserSourcePagePlanV3}
  from './tavern-author-browser-types-v3.mjs'
import type {BrowserBindingV1} from './tavern-author-browser-types.mjs'
import type {NativeHandleV3,NativeRequestV3,NativeWireValueV3,
  NativeCallbackDeliveryV3,NativePromiseSettlementV3,NativeReplyV3} from './tavern-author-browser-native-types-v3.js'

export interface BrowserCarrierNativeSessionV3 {
  readonly document:NativeHandleV3
  readonly script:NativeHandleV3
  request(request:NativeRequestV3,signal:AbortSignal):Promise<NativeReplyV3>
  setDocumentState(state:'loading'|'interactive'|'complete',signal:AbortSignal):Promise<void>
  dispose():Promise<void>
}
interface GuestController extends BrowserPageGuestControllerV3 {
  readonly context:any
  readonly methods:Readonly<Record<string,any>>
}
export interface BrowserAttachmentWorkerOptionsV3<Frame extends object> {
  readonly actor:BrowserActorV3
  readonly program:BrowserProgramV3
  readonly snapshot:BrowserSnapshotV3
  readonly binding:BrowserBindingV1
  readonly operationPrefix:string
  readonly methods:Readonly<Record<string,readonly string[]>>
  readonly properties:Readonly<Record<string,readonly string[]>>
  readonly pages:BrowserPageTransportV3<Frame>
  /** Supplied by the actual native frame owner after joining its document
   * resource to the selected compiled Source page. It accepts no posted owner. */
  frameOwner(frame:Frame):{readonly carrierIdentity:string;readonly parentPageId:string}
  resolveFrame(reference:NativeHandleV3):Frame
  frameReference(frame:Frame):NativeHandleV3
  recordFrameLocation(frame:Frame,location:{readonly src?:string;readonly srcdoc?:string}):void
  createCarrier(script:BrowserCompiledScriptV3,carrierId:string,signal:AbortSignal):Promise<BrowserCarrierNativeSessionV3>
  /** This actual caller route owns native DOM/frame resources. It may suspend
   * for their ACK, but must never enter or wait for an Actor method. */
  nativeRequest?(contextId:string,request:NativeRequestV3,signal:AbortSignal):Promise<NativeReplyV3>
  /** The parent bridge resolves these waits directly, outside the Actor queue. */
  sourceRequest(payload:unknown,signal:AbortSignal):Promise<unknown>
  hostRequest(payload:unknown,signal:AbortSignal):Promise<unknown>
  frameLoaded(frame:Frame,pageId:string):Promise<void>|void
  onNotice?(notice:unknown):void
  onPageError?(pageId:string,error:unknown):void
}
const errorCode=(error:unknown)=>error instanceof Error?error.message:String(error)

export class BrowserAttachmentWorkerV3<Frame extends object=object> {
  readonly pages:BrowserPageWorkerV3<Frame>
  private readonly abort=new AbortController()
  private readonly carriers=new Map<string,{context:any;id:string;native:BrowserCarrierNativeSessionV3}>()
  private readonly controllers=new Map<string,GuestController>()
  private readonly framePages=new Map<Frame,string>()
  private readonly retiringPages=new Set<string>()
  private readonly retiredPages=new Set<string>()
  private readonly hostWaits=new Map<number,any>()
  private readonly sourceBlobs=new Map<string,{plan:BrowserSourcePagePlanV3;html:string;mime:string}>()
  private readonly sourceURLs=new Map<string,BrowserSourcePagePlanV3>()
  private sourceMethods:Readonly<Record<string,any>>|undefined
  private nativeRegistry:any
  private nextHost=0
  private nextURL=0
  private nextBlob=0
  private active=true
  private disposal:Promise<void>|undefined

  constructor(private readonly options:BrowserAttachmentWorkerOptionsV3<Frame>) {
    this.pages=new BrowserPageWorkerV3({actor:options.actor,transport:options.pages,
      bootstrap:page=>this.bootstrapPage(page),frameLoaded:options.frameLoaded,onPageError:options.onPageError})
  }
  private async primitive(context:any,method:any,value?:unknown,seam=false):Promise<void> {
    const {actor}=this.options
    let argument:any
    if(value!==undefined)await actor.enter(()=>{argument=context.newString(JSON.stringify(value))})
    try {if(seam)await this.pages.call(context,method,argument?[argument]:[])
      else await actor.call(context,method,argument?[argument]:[])}
    finally {if(argument)argument.dispose()}
  }
  private async startSource():Promise<void> {
    const {actor}=this.options,context=actor.parent
    await actor.enter(()=>{
      const rpc=context.newAsyncifiedFunction('__ownedSourceRpcV3',async(input:any)=>{
        let reply:unknown
        try {reply={value:await this.options.sourceRequest(JSON.parse(context.getString(input)),this.abort.signal)}}
        catch(error) {reply={error:errorCode(error)}}
        return context.newString(JSON.stringify(reply))
      })
      const host=context.newFunction('__ownedSourceHostV3',(input:any)=>{
        const payload=JSON.parse(context.getString(input)),id=++this.nextHost,promise=context.newPromise()
        this.hostWaits.set(id,promise)
        // A real guest Promise leaves the Actor free. Completion is queued only
        // after this FFI returns, and disposal cancels the actual parent wait.
        void this.options.hostRequest(payload,this.abort.signal).then(
          value=>this.settleHost(id,{value}),error=>this.settleHost(id,{error:errorCode(error)}))
          .catch(error=>this.options.onPageError?.('attachment',error))
        return promise.handle.dup()
      })
      context.setProp(context.global,'__ownedSourceRpcV3',rpc);context.setProp(context.global,'__ownedSourceHostV3',host)
      rpc.dispose();host.dispose()
      const notify=context.newFunction('__ownedSourceNotifyV3',(text:any)=>{
        const notice=JSON.parse(context.getString(text))
        queueMicrotask(()=>this.options.onNotice?.(notice))
      })
      context.setProp(context.global,'__ownedSourceNotifyV3',notify);notify.dispose()
    })
    const controller=await actor.capture(context,'('+browserSourceGuestBootstrapV3.toString()+')('+JSON.stringify({
      snapshot:this.options.snapshot,binding:this.options.binding,operationPrefix:this.options.operationPrefix})+')')
    const methods:Record<string,any>={}
    await actor.enter(()=>{
      for(const name of ['createFacade','installFacade','registerPage','snapshot','event','retirePage','destroy'])
        methods[name]=context.getProp(controller,name)
      this.nativeRegistry=context.getProp(controller,'nativeRegistry')
    })
    this.sourceMethods=methods
  }
  private async settleHost(id:number,reply:unknown):Promise<void> {
    if(!this.active)return
    const {actor}=this.options,context=actor.parent
    await this.pages.enter(()=>{
      const promise=this.hostWaits.get(id)
      if(!promise)return
      this.hostWaits.delete(id)
      const value=context.newString(JSON.stringify(reply))
      try {promise.resolve(value)}finally {value.dispose();promise.dispose()}
    })
    if(this.active)await this.pages.drain()
  }
  private async sourceFacade(context:any,script:BrowserCompiledScriptV3,pageId:string):Promise<void> {
    const {actor}=this.options,source=actor.parent
    let creator:any
    await actor.enter(()=>{creator=source.newString(JSON.stringify({scriptIdentity:script.descriptor.identity,
      descriptorSha256:script.descriptorSha256,pageId,originalOrdinal:script.ordinal}))})
    let facade:any
    try {facade=await actor.captureCall(source,this.sourceMethods!.createFacade,[creator])}
    finally {creator.dispose()}
    await actor.call(source,this.sourceMethods!.installFacade,[facade,context.global])
  }
  private async bootstrap(context:any,id:string,parent:any,document:NativeHandleV3,
    script:BrowserCompiledScriptV3):Promise<GuestController> {
    const {actor}=this.options
    await actor.enter(()=>{
      context.setProp(context.global,'parent',parent.global)
      context.setProp(context.global,'top',parent.global)
      context.setProp(context.global,'__ownedPageRegistryV3',this.nativeRegistry)
      const native=context.newAsyncifiedFunction('__ownedPageDomV3',async(input:any)=>{
        const request=JSON.parse(context.getString(input)) as NativeRequestV3
        let reply:unknown
        try {
          reply=await this.requestNative(id,script,request)
        }catch(error) {reply={error:errorCode(error)}}
        return context.newString(JSON.stringify(reply))
      })
      const window=context.newFunction('__ownedPageWindowV3',(pageId:any)=>{
        const name=context.getString(pageId),controller=this.controllers.get(name)
        if(controller)return controller.context.global.dup()
        return this.pages.windowHandle(name)
      })
      const notify=context.newFunction('__ownedPageNotifyV3',(text:any)=>{
        const notice=JSON.parse(context.getString(text))
        queueMicrotask(()=>this.options.onNotice?.(notice))
      })
      for(const [name,value] of [['__ownedPageDomV3',native],['__ownedPageWindowV3',window],['__ownedPageNotifyV3',notify]] as const) {
        context.setProp(context.global,name,value);value.dispose()
      }
    })
    const captured=await actor.capture(context,'('+browserPageGuestBootstrapV3.toString()+')('+JSON.stringify({
      pageId:id,document,methods:this.options.methods,properties:this.options.properties})+')')
    const methods:Record<string,any>={}
    await actor.enter(()=>{for(const name of ['setCurrentScript','dispatchLifecycle','decodeNative','deliver','settle','retire','destroy'])
      methods[name]=context.getProp(captured,name)})
    let name:any
    await actor.enter(()=>{name=actor.parent.newString(id)})
    try {await actor.call(actor.parent,this.sourceMethods!.registerPage,[name,captured])}finally {name.dispose()}
    await this.sourceFacade(context,script,id)
    const controller:GuestController={context,methods,
      setCurrentScript:node=>this.primitive(context,methods.setCurrentScript,node),
      dispatchLifecycle:type=>this.primitive(context,methods.dispatchLifecycle,{type}),
      disposeHandles:()=>{for(const method of Object.values(methods))method.dispose()},
    }
    this.controllers.set(id,controller)
    return controller
  }
  private async sourcePlan(html:string):Promise<BrowserSourcePagePlanV3|undefined> {
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(html))
    const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
    return this.options.program.sourcePages.find(plan=>plan.origin.htmlSha256===hash)
  }
  private async requestNative(id:string,script:BrowserCompiledScriptV3,request:NativeRequestV3):Promise<NativeReplyV3> {
    if(request.op==='create'&&request.creation.kind==='blob'&&request.creation.mime.toLowerCase().split(';')[0]!.trim()==='text/html'
      &&request.creation.parts.every(part=>typeof part==='string')) {
      const html=request.creation.parts.join(''),plan=await this.sourcePlan(html)
      if(!plan)throw Error('BROWSER3_SOURCE_PAGE_UNAVAILABLE')
      // Source HTML is a logical Source resource, not a navigable native Blob.
      // The native browser receives only the fixed inert iframe shell.
      const reference:NativeHandleV3={tag:'handle',pageId:'source-blobs',handle:++this.nextBlob,kind:'blob'}
      this.sourceBlobs.set(reference.pageId+':'+reference.handle,{plan,html,mime:request.creation.mime.toLowerCase()});return {value:reference}
    }
    if('target' in request&&request.target.pageId==='source-blobs') {
      const blob=this.sourceBlobs.get(request.target.pageId+':'+request.target.handle)!
      if(request.op==='get'&&request.key==='size')return {value:new TextEncoder().encode(blob.html).byteLength}
      if(request.op==='get'&&request.key==='type')return {value:blob.mime}
      if(request.op==='call'&&request.method==='text')return {value:blob.html}
    }
    if(request.op==='set'&&request.target.kind==='frame'&&['src','srcdoc'].includes(request.key)) {
      const location=String(request.value),plan=request.key==='srcdoc'?await this.sourcePlan(location):this.sourceURLs.get(location)
      if(!plan)throw Error('BROWSER3_SOURCE_PAGE_UNAVAILABLE')
      const frame=this.options.resolveFrame(request.target)
      this.options.recordFrameLocation(frame,{[request.key]:location})
      await this.requestMount(frame,plan)
      return {value:{tag:'undefined'}}
    }
    if(request.op==='object-url') {
      const blob=this.sourceBlobs.get(request.target.pageId+':'+request.target.handle)
      if(blob) {
        const url='blob:nexttavern-source-'+this.options.operationPrefix+'-'+ ++this.nextURL
        this.sourceURLs.set(url,blob.plan);return {value:url}
      }
    }
    if(request.op==='revoke-object-url'&&this.sourceURLs.delete(request.url))return {value:{tag:'undefined'}}
    return this.options.nativeRequest?await this.options.nativeRequest(id,request,this.abort.signal)
      :this.carriers.get(script.descriptor.identity)?.id===id
      ?await this.carriers.get(script.descriptor.identity)!.native.request(request,this.abort.signal)
      :await this.pages.requestNative(id,request)
  }
  private async bootstrapPage(page:BrowserPageBootstrapV3<Frame>):Promise<GuestController> {
    await this.retirePending()
    const script=this.options.program.scripts.find(row=>row.descriptor.identity===page.plan.origin.carrier.identity)!
    const controller=await this.bootstrap(page.context,page.pageId,page.parentContext,page.document,script)
    const parent=[...this.controllers.values()].find(row=>row.context===page.parentContext)!
    let reference:any
    await this.options.actor.enter(()=>{reference=parent.context.newString(JSON.stringify(this.options.frameReference(page.frame)))})
    let frame:any
    try {frame=await this.options.actor.captureCall(parent.context,parent.methods.decodeNative,[reference])}
    finally {reference.dispose()}
    await this.options.actor.enter(()=>page.context.setProp(page.context.global,'frameElement',frame))
    return controller
  }
  async start():Promise<void> {
    const {actor,program}=this.options
    await this.startSource()
    for(const script of program.scripts)if(script.disposition==='compiled-browser') {
      const id='carrier-'+script.ordinal,context=await actor.createPage(id)
      const native=await this.options.createCarrier(script,id,this.abort.signal)
      this.carriers.set(script.descriptor.identity,{context,id,native})
      const controller=await this.bootstrap(context,id,context,native.document,script)
      await native.setDocumentState('loading',this.abort.signal)
      await controller.setCurrentScript(native.script)
      try {await this.pages.enterOriginal(context,script.javascript,
        `source-carrier-${script.ordinal}.js`)}
      finally {await controller.setCurrentScript(null)}
      await this.retirePending()
      await this.pages.drain()
      await native.setDocumentState('interactive',this.abort.signal)
      await controller.dispatchLifecycle('readystatechange');await controller.dispatchLifecycle('DOMContentLoaded')
      await native.setDocumentState('complete',this.abort.signal)
      await controller.dispatchLifecycle('readystatechange');await controller.dispatchLifecycle('load')
      await this.pages.drain()
    }
  }
  /** The trusted frame resource router supplies frame identity and selected
   * plan. Neither a posted page object nor an arbitrary HTML string is used. */
  requestMount(frame:Frame,plan:BrowserSourcePagePlanV3):Promise<{readonly pageId:string}> {
    const {carrierIdentity,parentPageId}=this.options.frameOwner(frame)
    const carrier=this.carriers.get(carrierIdentity)!
    // Native document ownership is independent of the Source getter's creator.
    // The compiler supports this carrier parent, not a nested page parent.
    if(carrier.id!==parentPageId||plan.origin.carrier.identity!==carrierIdentity)
      return Promise.reject(Error('BROWSER3_SOURCE_PAGE_PARENT_UNPROVEN'))
    const previous=this.framePages.get(frame)
    if(previous)this.retiringPages.add(previous)
    return this.pages.requestMount(frame,plan,carrier.context).then(result=>{
      this.framePages.set(frame,result.pageId);return result
    })
  }
  private async retirePending():Promise<void> {
    // Navigation can arrive in suspended FFI. Retire actual guest callbacks
    // only at the next Actor seam, never by entering the Actor from that FFI.
    for(const id of [...this.retiringPages]) {
      this.retiringPages.delete(id);this.retiredPages.add(id)
      const source=this.options.actor.parent
      let name:any
      await this.options.actor.enter(()=>{name=source.newString(id)})
      try {await this.options.actor.call(source,this.sourceMethods!.retirePage,[name])}finally {name.dispose()}
      const controller=this.controllers.get(id)
      if(controller)await this.primitive(controller.context,controller.methods.retire)
    }
  }
  async close(frame:Frame):Promise<void> {
    const id=this.framePages.get(frame)
    if(id){this.framePages.delete(frame);this.retiringPages.add(id)}
    await this.pages.close(frame)
    if(this.active)await this.retirePending()
  }
  async deliverNative(delivery:NativeCallbackDeliveryV3):Promise<void> {
    if(!this.active)return
    await this.retirePending()
    if(this.retiredPages.has(delivery.callback.pageId))return
    const controller=this.controllers.get(delivery.callback.pageId)!
    await this.primitive(controller.context,controller.methods.deliver,delivery,true)
    if(this.active)await this.pages.drain()
  }
  async settleNative(settlement:NativePromiseSettlementV3):Promise<void> {
    if(!this.active)return
    await this.retirePending()
    if(this.retiredPages.has(settlement.pageId))return
    const controller=this.controllers.get(settlement.pageId)!
    await this.primitive(controller.context,controller.methods.settle,settlement,true)
    if(this.active)await this.pages.drain()
  }
  async snapshot(snapshot:BrowserSnapshotV3):Promise<void> {
    if(this.active)await this.retirePending()
    if(this.active)await this.primitive(this.options.actor.parent,this.sourceMethods!.snapshot,snapshot,true)
    if(this.active)await this.pages.drain()
  }
  async deliverSourceEvent(event:{readonly type:string;readonly args:readonly unknown[]}):Promise<void> {
    if(!this.active)return
    await this.retirePending()
    await this.primitive(this.options.actor.parent,this.sourceMethods!.event,event,true)
    if(this.active)await this.pages.drain()
  }
  dispose():Promise<void> {
    if(this.disposal)return this.disposal
    this.active=false;this.abort.abort()
    this.disposal=this.finishDisposal()
    return this.disposal
  }
  private async finishDisposal():Promise<void> {
    const native=await Promise.allSettled([...this.carriers.values()].map(carrier=>carrier.native.dispose()))
    const {actor}=this.options
    try {
      if(this.sourceMethods)await actor.call(actor.parent,this.sourceMethods.destroy)
      await actor.enter(()=>{
        for(const promise of this.hostWaits.values())promise.dispose()
        this.hostWaits.clear()
        for(const carrier of this.carriers.values())this.controllers.get(carrier.id)?.disposeHandles()
        for(const method of Object.values(this.sourceMethods??{}))method.dispose()
        this.nativeRegistry?.dispose()
      })
    }finally {
      await this.pages.dispose();this.controllers.clear();this.carriers.clear();this.sourceBlobs.clear();this.sourceURLs.clear()
      this.framePages.clear();this.retiringPages.clear();this.retiredPages.clear()
    }
    const failed=native.find(result=>result.status==='rejected')
    if(failed?.status==='rejected')throw failed.reason
  }
}
