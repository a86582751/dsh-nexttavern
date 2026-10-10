/** Shared-Actor page execution and resource lifetime owner. Source admission,
 * attachment permissions and durable writes belong to the enclosing Worker. */
import type {BrowserActorV3,BrowserPrimitiveV3,BrowserPromiseResultV3} from './tavern-author-browser-adapter-v3.js'
import type {BrowserSourcePagePlanV3} from './tavern-author-browser-types-v3.mjs'
import type {BrowserPageApplyResultV3,NativeHandleV3,NativeRequestV3,
  NativeReplyV3} from './tavern-author-browser-native-types-v3.js'

export type BrowserPageLifecycleV3='readystatechange'|'DOMContentLoaded'|'load'
/** Renderer operations finish at their actual native ACK. Resource readiness
 * includes the renderer's load-blocking requests, including failed requests. */
export interface BrowserPageNativeSessionV3 {
  applyUntil(exclusiveEnd:number,signal:AbortSignal):Promise<BrowserPageApplyResultV3>
  getDocumentHandle(signal:AbortSignal):Promise<NativeHandleV3>
  getParsedNodeHandle(nodeId:number,signal:AbortSignal):Promise<NativeHandleV3>
  setDocumentState(state:'loading'|'interactive'|'complete',signal:AbortSignal):Promise<void>
  request(request:NativeRequestV3,signal:AbortSignal):Promise<NativeReplyV3>
  awaitResourcesReady(signal:AbortSignal):Promise<void>
}
/** Frame is the actual trusted attached resource, never a posted page ID.
 * dispose also works during mount, cancels native routes/waits and ACKs native
 * detach. The transport must honor abort without waiting for the Actor. */
export interface BrowserPageTransportV3<Frame extends object> {
  mount(frame:Frame,pageId:string,plan:BrowserSourcePagePlanV3,
    signal:AbortSignal):Promise<BrowserPageNativeSessionV3>
  dispose(frame:Frame,pageId:string):Promise<void>
}
/** Hooks may use Actor methods, but return when that VM entry returns. They
 * must never await an author's callback Promise or invoke a queued Actor
 * method from inside actor.enter. Handles stay private to the trusted guest. */
export interface BrowserPageGuestControllerV3 {
  setCurrentScript(node:NativeHandleV3|null):Promise<void>|void
  dispatchLifecycle(type:BrowserPageLifecycleV3):Promise<void>|void
  /** Synchronous handle release only; called inside an idle Actor entry. */
  disposeHandles():void
}
export interface BrowserPageBootstrapV3<Frame extends object> {
  readonly pageId:string
  readonly frame:Frame
  readonly plan:BrowserSourcePagePlanV3
  readonly context:any
  readonly parentContext:any
  readonly document:NativeHandleV3
  readonly signal:AbortSignal
}
export interface BrowserPageWorkerOptionsV3<Frame extends object> {
  readonly actor:BrowserActorV3
  readonly transport:BrowserPageTransportV3<Frame>
  /** Installs bindings, window/self, actual parent and canonical snapshot in
   * the fresh realm. No mutable author-global slot in the parent is required. */
  readonly bootstrap:(page:BrowserPageBootstrapV3<Frame>)=>Promise<BrowserPageGuestControllerV3>
  /** Delivers the carrier's retained native frame load callback in the Actor,
   * after the original page scripts and actual resource readiness. */
  readonly frameLoaded:(frame:Frame,pageId:string)=>Promise<void>|void
  readonly onPageError?:(pageId:string,error:unknown)=>void
}
interface Page<Frame extends object> {
  readonly pageId:string
  readonly frame:Frame
  readonly plan:BrowserSourcePagePlanV3
  readonly parentContext:any
  readonly abort:AbortController
  readonly scripts:Map<number,BrowserSourcePagePlanV3['parsed']['scripts'][number]>
  phase:'mounting'|'queued'|'parsing'|'resources'|'ready'|'loaded'|'closed'|'failed'
  session?:BrowserPageNativeSessionV3
  context?:any
  global?:any
  controller?:BrowserPageGuestControllerV3
  nativeDisposal?:Promise<void>
}

export class BrowserPageWorkerV3<Frame extends object=object> {
  private readonly pages=new Map<string,Page<Frame>>()
  private readonly frames=new Map<Frame,Page<Frame>>()
  private readonly closingFrames=new Map<Frame,Promise<void>>()
  private readonly mountQueue:Page<Frame>[]=[]
  private readonly readyQueue:Page<Frame>[]=[]
  private nextPage=0
  private entered=0
  private active=true
  private pumping:Promise<void>|undefined
  private disposal:Promise<void>|undefined

  constructor(private readonly options:BrowserPageWorkerOptionsV3<Frame>) {}
  private live(page:Page<Frame>):boolean {
    return this.active&&!page.abort.signal.aborted&&this.frames.get(page.frame)===page
  }
  /** Called from a suspended FFI: reserves identity and waits only for native
   * mount. Fresh context creation and author execution happen at entry seams. */
  async requestMount(frame:Frame,plan:BrowserSourcePagePlanV3,
    parentContext=this.options.actor.parent):Promise<{readonly pageId:string}> {
    if(!this.active)throw Error('BROWSER3_ATTACHMENT_CLOSED')
    const previous=this.frames.get(frame)
    const page:Page<Frame>={pageId:`source-page-${++this.nextPage}`,frame,plan,parentContext,
      abort:new AbortController(),scripts:new Map(plan.parsed.scripts.map(script=>[script.inlineOrdinal,script])),
      phase:'mounting'}
    // A repeated navigation closes its original resource before the new native
    // mount; it never transfers old handles or its realm to the fresh page.
    const priorClose=previous?this.retire(previous):this.closingFrames.get(frame)
    this.pages.set(page.pageId,page);this.frames.set(frame,page)
    try {
      if(priorClose)await priorClose
      if(!this.live(page))throw Error('BROWSER3_PAGE_CLOSED')
      const session=await this.options.transport.mount(frame,page.pageId,plan,page.abort.signal)
      if(!this.live(page))throw Error('BROWSER3_PAGE_CLOSED')
      page.session=session;page.phase='queued';this.mountQueue.push(page)
      // No Actor call here. The suspended caller must get its native ACK first.
      return {pageId:page.pageId}
    }catch(error) {
      await this.retire(page)
      throw error
    }
  }
  private retire(page:Page<Frame>):Promise<void> {
    if(page.nativeDisposal)return page.nativeDisposal
    page.phase='closed';page.abort.abort()
    if(this.frames.get(page.frame)===page)this.frames.delete(page.frame)
    page.nativeDisposal=this.options.transport.dispose(page.frame,page.pageId)
    const closing=page.nativeDisposal
    this.closingFrames.set(page.frame,closing)
    void closing.finally(()=>{
      if(this.closingFrames.get(page.frame)===closing)this.closingFrames.delete(page.frame)
    }).catch(()=>{})
    return page.nativeDisposal
  }
  close(frame:Frame):Promise<void> {
    const page=this.frames.get(frame)
    return page?this.retire(page):Promise.resolve()
  }
  /** Decoder returns the original same-runtime value, duplicating the held
   * global rather than evaluating code or writing a parent global property. */
  windowHandle(pageId:string):any {
    if(!this.active)throw Error('BROWSER3_ATTACHMENT_CLOSED')
    const page=this.pages.get(pageId)
    if(!page?.global)throw Error('BROWSER3_PAGE_WINDOW_PENDING')
    return page.global.dup()
  }
  requestNative(pageId:string,request:NativeRequestV3):Promise<NativeReplyV3> {
    const page=this.pages.get(pageId)
    if(!page||!this.live(page)||!page.session)return Promise.reject(Error('BROWSER3_PAGE_CLOSED'))
    return page.session.request(request,page.abort.signal)
  }
  /** All enclosing Worker VM entries use these seams. A pending author Promise
   * must be observed with promiseResult, rather than awaited as a root tail. */
  private async entry<T>(operation:()=>Promise<T>):Promise<T> {
    if(!this.active)throw Error('BROWSER3_ATTACHMENT_CLOSED')
    this.entered++
    try {return await operation()}
    finally {
      this.entered--
      if(this.active&&this.entered===0)await this.pump()
    }
  }
  enter<T>(operation:()=>Promise<T>|T):Promise<T> {
    return this.entry(()=>this.options.actor.enter(operation))
  }
  enterOriginal(context:any,javascript:string,filename?:string):Promise<void> {
    return this.entry(()=>this.options.actor.runSource(context,javascript,filename))
  }
  capture(context:any,expression:string,filename?:string):Promise<any> {
    return this.entry(()=>this.options.actor.capture(context,expression,filename))
  }
  call(context:any,callback:any,args:readonly any[]=[],receiver=context.undefined):Promise<BrowserPrimitiveV3> {
    return this.entry(()=>this.options.actor.call(context,callback,args,receiver))
  }
  promiseResult(context:any,promise:any):Promise<BrowserPromiseResultV3> {
    return this.entry(()=>this.options.actor.promiseResult(context,promise))
  }
  drain():Promise<void> {return this.entry(()=>this.options.actor.drain())}

  /** This is a native/parser scheduler, not another VM queue. Every VM action
   * below enters the supplied Actor separately, after the prior entry returns. */
  pump():Promise<void> {
    if(!this.active||this.entered>0)return Promise.resolve()
    if(this.pumping)return this.pumping
    const running=this.pumpPages()
    this.pumping=running
    void running.finally(()=>{
      if(this.pumping===running)this.pumping=undefined
      if(this.active&&this.entered===0&&(this.mountQueue.length||this.readyQueue.length))
        void this.pump().catch(error=>this.options.onPageError?.('attachment',error))
    }).catch(()=>{})
    return running
  }
  private async pumpPages():Promise<void> {
    while(this.active&&this.entered===0) {
      const page=this.mountQueue.shift()??this.readyQueue.shift()
      if(!page)return
      if(!this.live(page))continue
      try {
        if(page.phase==='ready')await this.finishLoad(page)
        else await this.advanceParser(page)
      }catch(error) {
        if(!this.live(page))continue
        page.phase='failed'
        await this.retire(page)
        this.options.onPageError?.(page.pageId,error)
      }
    }
  }
  private async advanceParser(page:Page<Frame>):Promise<void> {
    const {actor}=this.options,session=page.session!,signal=page.abort.signal
    if(page.phase==='queued') {
      page.context=await actor.createPage(page.pageId)
      if(!this.live(page))return
      await actor.enter(()=>{if(this.live(page))page.global=page.context.global})
      const document=await session.getDocumentHandle(signal)
      if(!this.live(page))return
      page.controller=await this.options.bootstrap({pageId:page.pageId,frame:page.frame,
        plan:page.plan,context:page.context,parentContext:page.parentContext,document,signal})
      if(!this.live(page))return
      page.phase='parsing'
      await session.setDocumentState('loading',signal)
    }
    if(!this.live(page))return
    const ack=await session.applyUntil(page.plan.parsed.steps.length,signal)
    if(!this.live(page))return
    if(ack.boundary) {
      const script=page.scripts.get(ack.boundary.inlineOrdinal)!
      if(script.mode==='data'||script.inTemplate) {
        this.mountQueue.push(page)
        return
      }
      const node=await session.getParsedNodeHandle(ack.boundary.nodeId,signal)
      if(!this.live(page))return
      await page.controller!.setCurrentScript(node)
      try {
        if(this.live(page))await actor.runSource(page.context,script.javascript,
          `source-page-${page.pageId}-classic-${script.inlineOrdinal}.js`)
      }finally {
        if(this.live(page))await page.controller!.setCurrentScript(null)
      }
      if(!this.live(page))return
      await actor.drain()
      if(this.live(page))this.mountQueue.push(page)
      return
    }
    if(!ack.ended)throw Error('BROWSER3_PARSER_ACK_INCOMPLETE')
    await session.setDocumentState('interactive',signal)
    if(!this.live(page))return
    await page.controller!.dispatchLifecycle('readystatechange')
    if(!this.live(page))return
    await page.controller!.dispatchLifecycle('DOMContentLoaded')
    if(!this.live(page))return
    await actor.drain()
    if(!this.live(page))return
    page.phase='resources'
    // The readiness continuation only enqueues a live page. It holds neither
    // the shared Actor nor the parser pump while native resources are pending.
    void session.awaitResourcesReady(signal).then(()=>{
      if(!this.live(page))return
      page.phase='ready';this.readyQueue.push(page)
      return this.pump()
    },error=>{
      if(!this.live(page))return
      this.options.onPageError?.(page.pageId,error)
      return this.retire(page)
    }).catch(error=>this.options.onPageError?.(page.pageId,error))
  }
  private async finishLoad(page:Page<Frame>):Promise<void> {
    await page.session!.setDocumentState('complete',page.abort.signal)
    if(!this.live(page))return
    await page.controller!.dispatchLifecycle('readystatechange')
    if(!this.live(page))return
    await page.controller!.dispatchLifecycle('load')
    if(!this.live(page))return
    await this.options.actor.drain()
    if(!this.live(page))return
    page.phase='loaded'
    await this.options.frameLoaded(page.frame,page.pageId)
    if(this.live(page))await this.options.actor.drain()
  }
  dispose():Promise<void> {
    if(this.disposal)return this.disposal
    // Revoke first, aborting suspended transport waits before queued VM free.
    this.active=false
    this.mountQueue.length=0;this.readyQueue.length=0
    const native=[...this.pages.values()].map(page=>this.retire(page))
    this.disposal=this.finishDisposal(native)
    return this.disposal
  }
  private async finishDisposal(native:readonly Promise<void>[]):Promise<void> {
    const results=await Promise.allSettled(native)
    const {actor}=this.options
    try {
      // Aborted parser ACKs may reject the in-flight pump; they must never
      // bypass the final Actor release.
      await this.pumping?.catch(()=>{})
      await actor.enter(()=>{
        for(const page of this.pages.values())page.controller?.disposeHandles()
      })
    }finally {
      await actor.dispose()
      this.frames.clear();this.closingFrames.clear();this.pages.clear()
    }
    const failed=results.find(result=>result.status==='rejected')
    if(failed?.status==='rejected')throw failed.reason
  }
}
