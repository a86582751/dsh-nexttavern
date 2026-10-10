/** Native Source iframe containers and renderer routes. Plans and VM contexts
 * belong to the Worker; this owner never parses plans or runs author scripts. */
import {createBrowserPageRendererV3} from './tavern-author-browser-renderer-v3.js'
import type {BrowserPageRendererOptionsV3} from './tavern-author-browser-renderer-v3.js'
import type {BrowserSourcePagePlanV3} from './tavern-author-browser-types-v3.mjs'
import type {BrowserPageNativeSessionV3,BrowserPageTransportV3} from './tavern-author-browser-page-worker-v3.js'
import type {BrowserNativeFrameHookV3,BrowserPageRendererV3,NativeCallbackDeliveryV3,NativeHandleV3,
  NativeRequestV3,NativeWireObjectV3,NativeWireValueV3,OwnedNativeCallbackV3} from './tavern-author-browser-native-types-v3.js'

/** In-process token returned only to trusted transport/Source selection. Its
 * carrier comes from the actual registered native document, never the caller. */
export interface BrowserNativeSourceFrameV3 {
  readonly frameId:number
  readonly carrierIdentity:string
  readonly carrierPageId:string
}
interface Carrier {
  readonly document:Document
  readonly pageId:string
  readonly carrierIdentity:string
  styleValue?:(value:string)=>string
  documentHandle?:NativeHandleV3
  exportOwnedNode?:(node:Node|null)=>NativeWireValueV3
}
interface FrameState {
  readonly frame:BrowserNativeSourceFrameV3
  readonly carrier:Carrier
  readonly element:HTMLIFrameElement
  readonly reference:NativeHandleV3
  readonly routes:Set<number>
  readonly listeners:Map<number,FrameListener>
  active:boolean
  propertyListener?:OwnedNativeCallbackV3
  styleReference?:NativeHandleV3
  location:{src:string;srcdoc:string}
  page?:{readonly pageId:string;readonly renderer:BrowserPageRendererV3}
  pending?:{readonly pageId:string;readonly cancel:()=>void}
  provisionalParent?:Node
}
interface FrameListener {
  readonly listenerId:number
  readonly callback:OwnedNativeCallbackV3
  readonly capture:boolean
  readonly once:boolean
}
type Route={readonly state:FrameState;readonly kind:'frame'}
  |{readonly state:FrameState;readonly kind:'frame-style';readonly style:CSSStyleDeclaration}
  |{readonly state:FrameState;readonly kind:'event';readonly event:Event}
export interface BrowserSourceFrameOwnerOptionsV3 {
  readonly onCallback?:(delivery:NativeCallbackDeliveryV3)=>void
  readonly onFrameClosed?:(frame:BrowserNativeSourceFrameV3,pageId:string|undefined)=>void
  readonly rendererOptions?:(frame:BrowserNativeSourceFrameV3,pageId:string,plan:BrowserSourcePagePlanV3)=>
    Pick<BrowserPageRendererOptionsV3,'onCallback'|'onPromiseSettlement'|'resolveResource'|'schedulerWindow'>
}
const undef={tag:'undefined'} as const
export const BROWSER_NATIVE_INERT_SHELL_V3='<!doctype html><html><head><meta http-equiv="Content-Security-Policy" '+
  'content="default-src \'none\'; script-src \'none\'; style-src \'unsafe-inline\' https:; '+
  'img-src data: blob: https:; media-src data: blob: https:; font-src data: https:; '+
  'frame-src about:; form-action \'none\'"></head><body></body></html>'
const fail=(code:string):never=>{throw Error(code)}
const scalar=(value:unknown):NativeWireValueV3=>value===undefined?undef:
  value===null||['string','number','boolean'].includes(typeof value)?value as NativeWireValueV3:
  fail('BROWSER3_FRAME_PROPERTY_UNSUPPORTED')

export function createBrowserSourceFrameOwnerV3(options:BrowserSourceFrameOwnerOptionsV3={}) {
  const carriers=new Map<Document,Carrier>(),states=new WeakMap<BrowserNativeSourceFrameV3,FrameState>()
  const references=new WeakMap<Node,NativeHandleV3>(),routes=new Map<number,Route>(),active=new Set<FrameState>()
  const listenerOwners=new Map<number,FrameState>()
  let nextHandle=0
  function allocate(state:FrameState,route:Route,kind:NativeHandleV3['kind']):NativeHandleV3 {
    const handle=--nextHandle
    routes.set(handle,route);state.routes.add(handle)
    return {tag:'handle',pageId:state.carrier.pageId,handle,kind}
  }
  function stateOf(frame:BrowserNativeSourceFrameV3):FrameState {
    const state=states.get(frame)
    if(!state?.active)return fail('BROWSER3_FRAME_UNAVAILABLE')
    return state
  }
  function routeOf(reference:NativeHandleV3):Route {
    const route=routes.get(reference.handle)
    if(!route?.state.active||reference.pageId!==route.state.carrier.pageId||reference.kind!==route.kind)
      return fail('BROWSER3_FRAME_UNAVAILABLE')
    return route
  }
  async function disposePage(state:FrameState,pageId:string):Promise<void> {
    if(state.pending?.pageId===pageId){state.pending.cancel();state.pending=undefined}
    if(state.page?.pageId!==pageId)return
    delete state.provisionalParent
    const {renderer}=state.page;state.page=undefined
    await renderer.dispose()
  }
  function close(state:FrameState):void {
    if(!state.active)return
    state.active=false;active.delete(state)
    delete state.provisionalParent
    const pageId=state.page?.pageId??state.pending?.pageId
    state.pending?.cancel();state.pending=undefined
    const page=state.page;state.page=undefined
    // Renderer dispose revokes synchronously before its Promise resolves. VM
    // contexts remain with PageWorker, including contexts of removed frames.
    if(page)void page.renderer.dispose()
    state.element.remove();for(const id of state.listeners.keys())listenerOwners.delete(id)
    state.listeners.clear();state.propertyListener=undefined
    for(const handle of state.routes)routes.delete(handle)
    state.routes.clear();options.onFrameClosed?.(state.frame,pageId)
  }
  function create(carrier:Carrier):NativeHandleV3 {
    const element=carrier.document.createElement('iframe')
    element.setAttribute('sandbox','allow-same-origin')
    const frame=Object.freeze({frameId:-nextHandle+1,carrierIdentity:carrier.carrierIdentity,carrierPageId:carrier.pageId})
    const state:FrameState={frame,carrier,element,reference:undefined as unknown as NativeHandleV3,
      routes:new Set(),listeners:new Map(),location:{src:'',srcdoc:''},active:true}
    const reference=allocate(state,{state,kind:'frame'},'frame')
    Object.defineProperty(state,'reference',{value:reference})
    states.set(frame,state);references.set(element,reference);active.add(state)
    return reference
  }
  function callback(state:FrameState,value:NativeWireValueV3):OwnedNativeCallbackV3|undefined {
    if(value===null)return undefined
    if(typeof value==='object'&&!Array.isArray(value)) {
      const wire=value as NativeWireObjectV3
      if(wire.tag==='undefined')return undefined
      if(wire.tag==='callback'&&wire.pageId===state.carrier.pageId)return wire
    }
    return fail('BROWSER3_DOM_HANDLER_REQUIRED')
  }
  function request(request:Extract<NativeRequestV3,{target:NativeHandleV3}>,styleValue:(value:string)=>string):NativeWireValueV3 {
    const route=routeOf(request.target),state=route.state
    // Borrowed references still consume the actual container's Source resource
    // resolver. A caller's page must not select another document's CSS URLs.
    styleValue=state.carrier.styleValue??styleValue
    if(route.kind==='frame') {
      if(request.op==='get') {
        if(request.key==='contentWindow')return state.page?{tag:'page-window',pageId:state.page.pageId}:null
        if(request.key==='style')return state.styleReference??=allocate(state,{state,kind:'frame-style',style:state.element.style},'frame-style')
        const actual=carriers.get(state.element.ownerDocument)!
        if(request.key==='nodeType')return state.element.nodeType
        if(request.key==='ownerDocument')return actual.documentHandle!
        if(request.key==='parentNode'||request.key==='parentElement')
          return actual.exportOwnedNode!(state.element[request.key])
        if(request.key==='id'||request.key==='isConnected')return scalar(state.element[request.key])
        if(request.key==='src'||request.key==='srcdoc')return state.location[request.key]
        if(request.key==='onload')return state.propertyListener??null
        // Only this registered document's owned nodes cross the DOM boundary.
        return undef
      }
      if(request.op==='set'&&request.key==='onload'){state.propertyListener=callback(state,request.value);return undef}
      if(request.op==='set'&&request.key==='id'){state.element.id=String(request.value);return undef}
      if(request.op==='call') {
        if(request.method==='remove'||request.method==='close'){close(state);return undef}
        if(['setAttribute','getAttribute','removeAttribute'].includes(request.method)) {
          const name=String(request.args[0]).toLowerCase()
          if(!['id','style','title','width','height','allow'].includes(name)&&!name.startsWith('data-'))
            return fail('BROWSER3_FRAME_ATTRIBUTE_UNSUPPORTED')
          if(request.method==='getAttribute')return state.element.getAttribute(name)
          if(request.method==='removeAttribute')state.element.removeAttribute(name)
          else state.element.setAttribute(name,name==='style'?styleValue(String(request.args[1])):String(request.args[1]))
          return undef
        }
        if(request.method==='addEventListener'||request.method==='removeEventListener') {
          if(request.args[0]!=='load')return fail('BROWSER3_FRAME_EVENT_UNSUPPORTED')
          const listener=callback(state,request.args[1]!)
          const option=request.args[2] as any
          const capture=typeof option==='boolean'?option:option?.tag==='record'&&option.entries.capture===true
          if(listener) {
            const prior=[...state.listeners.values()].find(row=>row.callback.callbackId===listener.callbackId&&row.capture===capture)
            if(request.method==='addEventListener') {
              if(prior)return prior.listenerId
              const listenerId=--nextHandle
              state.listeners.set(listenerId,{listenerId,callback:listener,capture,
                once:option?.tag==='record'&&option.entries.once===true})
              listenerOwners.set(listenerId,state);return listenerId
            }
            if(prior){state.listeners.delete(prior.listenerId);listenerOwners.delete(prior.listenerId)}
          }
          return undef
        }
      }
    }else if(route.kind==='frame-style') {
      const style=route.style as any
      if(request.op==='get')return scalar(style[request.key])
      if(request.op==='set') {
        if(!['string','number','boolean'].includes(typeof request.value))return fail('BROWSER3_FRAME_PROPERTY_UNSUPPORTED')
        style[request.key]=styleValue(String(request.value));return undef
      }
      if(request.op==='call') {
        const args=request.args
        if(request.method==='setProperty'){style.setProperty(String(args[0]),styleValue(String(args[1])),String(args[2]??''));return undef}
        if(['removeProperty','getPropertyValue','getPropertyPriority','item'].includes(request.method))
          return scalar(style[request.method](args[0]))
      }
    }else if(route.kind==='event') {
      if(request.op==='get') {
        if(request.key==='target'||request.key==='currentTarget')return state.reference
        if(['type','isTrusted','bubbles','cancelable','defaultPrevented','timeStamp'].includes(request.key))
          return scalar((route.event as any)[request.key])
        return undef
      }
      if(request.op==='call'&&['preventDefault','stopPropagation','stopImmediatePropagation'].includes(request.method)) {
        (route.event as any)[request.method]();return undef
      }
    }
    return fail('BROWSER3_FRAME_OPERATION_UNSUPPORTED')
  }
  function forCarrier(carrier:Carrier):BrowserNativeFrameHookV3 {
    carriers.set(carrier.document,carrier)
    return {create:(document,pageId,styleValue)=>{
      const actual=carriers.get(document)
      if(actual!==carrier||actual.pageId!==pageId)return fail('BROWSER3_FRAME_DOCUMENT_UNAVAILABLE')
      actual.styleValue=styleValue
      return create(actual)
    },registerDocument:(documentHandle,exportOwnedNode)=>{
      carrier.documentHandle=documentHandle;carrier.exportOwnedNode=exportOwnedNode
    },encode:node=>references.get(node),acceptPlacement:(parent,node)=>{
      const reference=references.get(node)
      if(!reference)return
      const state=routeOf(reference).state,placed=state.provisionalParent
      delete state.provisionalParent
      // Source srcdoc waits for a real mount ACK before its following append.
      // Repeating that exact initial placement would destroy the document the
      // mount just handed to the page renderer. Later moves remain native DOM.
      if(placed===parent&&node.parentNode===parent&&node.nextSibling===null)return reference
    },resolve:reference=>{
      const route=routeOf(reference);return route.kind==='frame'?route.state.element:undefined
    },request,consumeListener:id=>{
      const state=listenerOwners.get(id)
      if(!state)return false
      listenerOwners.delete(id);return state.listeners.delete(id)
    },removed:node=>{
      const ref=references.get(node);if(ref){const route=routes.get(ref.handle);if(route)close(route.state)}
      for(const state of [...active])if(node.contains(state.element))close(state)
    },disposeDocument:document=>{
      for(const state of [...active])if(state.carrier.document===document)close(state)
      carriers.delete(document)
    }}
  }
  async function mount(frame:BrowserNativeSourceFrameV3,pageId:string,plan:BrowserSourcePagePlanV3,
    signal:AbortSignal):Promise<BrowserPageNativeSessionV3> {
    signal.throwIfAborted()
    const state=stateOf(frame)
    if(state.page)await disposePage(state,state.page.pageId)
    delete state.provisionalParent
    const document=await new Promise<Document>((resolve,reject)=>{
      const iframe=state.element
      const finish=(error?:Error)=>{
        iframe.removeEventListener('load',loaded);signal.removeEventListener('abort',cancel)
        if(state.pending?.pageId===pageId)state.pending=undefined
        if(error)reject(error);else resolve(iframe.contentDocument!)
      }
      const cancel=()=>finish(Error('BROWSER3_PAGE_CLOSED'))
      const loaded=()=>finish()
      state.pending={pageId,cancel};signal.addEventListener('abort',cancel,{once:true})
      iframe.addEventListener('load',loaded,{once:true})
      // Only the fixed inert shell enters the native browser. Source markup
      // arrives later through the existing renderer's actual parser steps.
      iframe.src='about:blank'
      if(!iframe.isConnected) {
        const parent=carrierBody(state)
        parent.appendChild(iframe);state.provisionalParent=parent
      }
    })
    signal.throwIfAborted();stateOf(frame)
    document.open();document.write(BROWSER_NATIVE_INERT_SHELL_V3);document.close()
    const renderer=createBrowserPageRendererV3({document,plan,pageId,
      ...options.rendererOptions?.(frame,pageId,plan),
      externalFrames:forCarrier({document,pageId,carrierIdentity:frame.carrierIdentity})})
    state.page={pageId,renderer}
    const live=()=>{signal.throwIfAborted();if(!state.active||state.page?.renderer!==renderer)fail('BROWSER3_PAGE_CLOSED')}
    return {applyUntil:async end=>{live();return renderer.applyUntil(end)},
      getDocumentHandle:async()=>{live();return renderer.getDocumentHandle()},
      getParsedNodeHandle:async nodeId=>{live();return renderer.getParsedNodeHandle(nodeId)},
      setDocumentState:async value=>{live();renderer.setDocumentState(value)},
      request:async value=>{live();return renderer.requestReply(value)},
      awaitResourcesReady:async signal=>{live();await renderer.awaitResourcesReady(signal)}}
  }
  function carrierBody(state:FrameState):HTMLElement {
    return state.carrier.document.body??fail('BROWSER3_FRAME_PARENT_UNAVAILABLE')
  }
  const transport:BrowserPageTransportV3<BrowserNativeSourceFrameV3>={mount,
    dispose:async(frame,pageId)=>{const state=states.get(frame);if(state)await disposePage(state,pageId)}}
  function frameLoaded(frame:BrowserNativeSourceFrameV3,pageId:string):void {
    const state=stateOf(frame)
    if(state.page?.pageId!==pageId)return fail('BROWSER3_PAGE_CLOSED')
    const event=new state.carrier.document.defaultView!.Event('load')
    const eventRef=allocate(state,{state,kind:'event',event},'event')
    const eventState={reference:eventRef,target:state.reference,currentTarget:state.reference,
      eventPhase:2,cancelable:false,defaultPrevented:false}
    for(const listener of state.listeners.values())options.onCallback?.({callback:listener.callback,args:[eventRef],
      receiver:state.reference,resourceKind:'resource',event:eventState,
      registration:{listenerId:listener.listenerId,type:'load',capture:listener.capture,once:listener.once}})
    if(state.propertyListener)options.onCallback?.({callback:state.propertyListener,args:[eventRef],
      receiver:state.reference,resourceKind:'resource',event:eventState})
  }
  return {forCarrier,transport,frameLoaded,getFrame:(reference:NativeHandleV3)=>{
    const route=routeOf(reference);return route.kind==='frame'?route.state.frame:fail('BROWSER3_FRAME_HANDLE_REQUIRED')
  },reference:(frame:BrowserNativeSourceFrameV3)=>stateOf(frame).reference,
  owner:(frame:BrowserNativeSourceFrameV3)=>{
    const actual=carriers.get(stateOf(frame).element.ownerDocument)!
    return {carrierIdentity:actual.carrierIdentity,parentPageId:actual.pageId}
  },
  recordLocation:(frame:BrowserNativeSourceFrameV3,location:{readonly src?:string;readonly srcdoc?:string})=>{
    const state=stateOf(frame);state.location={...state.location,...location}
  },resources:()=>({frames:active.size,routes:routes.size,pages:[...active].filter(state=>state.page).length,
    pendingShells:[...active].filter(state=>state.pending).length}),dispose:()=>{
      for(const state of [...active])close(state);carriers.clear()
    }}
}
