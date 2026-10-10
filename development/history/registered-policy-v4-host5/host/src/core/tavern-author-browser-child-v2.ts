/** Trusted DOM/resource owner. Author JavaScript never executes in this realm. */
import {cleanDisplayAttribute,sanitizeDisplayTree} from './tavern-display-html.js'
import type {DisplayHtmlPolicy} from './tavern-display-html.js'
import {BROWSER_BUDGET_V1,browserUtf8Bytes} from './tavern-author-browser-budget.js'
import type {BrowserBindingV2,BrowserPersonaSnapshotV2,BrowserRenderV2} from './tavern-author-browser-types-v2.mjs'

// This owner is also the compiler's DOM declaration source. Importing this
// module in a Node AST worker creates no DOM or browser resource.
export const BROWSER_DOM_METHODS_V2=Object.freeze([
  'createElement','createElementNS','getElementById','querySelector','querySelectorAll','append','prepend',
  'replaceChildren','replaceWith','after','setAttribute','getAttribute','removeAttribute','remove','getContext','measureText',
  'drawImage','scale','clearRect','translate','add','removeEventListener','addEventListener','setProperty',
  'getPropertyValue','getPropertyPriority','observe','disconnect','preventDefault','stopPropagation',
  'attachShadow','closest','contains','focus','blur','click','dispatchEvent','getBoundingClientRect',
  'setPointerCapture','releasePointerCapture','toggle','toDataURL','decode',
])
export const BROWSER_TAGS_V2=Object.freeze(['article','aside','button','canvas','details','div','form',
  'h3','h4','header','i','img','input','label','li','ol','option','output','p','polyline','pre',
  'section','select','small','span','strong','style','summary','svg','textarea'])
export const BROWSER_SEMANTIC_EVENTS_V2=Object.freeze([
  'CHAT_CHANGED','CHARACTER_MESSAGE_RENDERED','MESSAGE_RECEIVED','MESSAGE_UPDATED','MESSAGE_SWIPED','MESSAGE_EDITED',
  'PERSONA_CHANGED','GENERATION_AFTER_COMMANDS',
])
interface ChildConfig {
  readonly nonce:string
  readonly binding:BrowserBindingV2
  readonly baseURI:string
  readonly mediaSources:readonly string[]
}
interface CallbackRef {__callback:number;scriptIdentity:string}
interface Listener {target:EventTarget;type:string;native:EventListener;callback:CallbackRef;capture:boolean}
const nodeReads=new Set(['style','dataset','classList','parentElement','parentNode','ownerDocument','shadowRoot',
  'isConnected','clientWidth','clientHeight','offsetWidth','offsetHeight','scrollTop','scrollHeight',
  'id','className','textContent','innerHTML','innerText','src','width','height','alt','complete','naturalWidth',
  'naturalHeight','value','hidden','disabled','checked','files','type','tagName','nodeType','firstChild',
  'lastChild','childNodes','childElementCount','nextSibling','previousSibling','open','selectionStart','selectionEnd'])
const nodeWrites=new Set(['id','className','textContent','innerHTML','innerText','src','width','height','alt',
  'loading','value','hidden','disabled','checked','scrollTop','type','open','placeholder','title',
  'selectionStart','selectionEnd'])
const eventReads=new Set(['type','target','currentTarget','key','code','button','buttons','clientX','clientY',
  'pageX','pageY','pointerId','ctrlKey','shiftKey','altKey','metaKey','isTrusted','detail'])
const contextReads=new Set(['font','fillStyle','strokeStyle','lineWidth','textAlign','textBaseline','globalAlpha'])
const methodOwners:Readonly<Record<string,ReadonlySet<string>>>={
  document:new Set(['createElement','createElementNS','getElementById','querySelector','querySelectorAll',
    'addEventListener','removeEventListener']),
  node:new Set(['append','prepend','replaceChildren','replaceWith','after','setAttribute','getAttribute','removeAttribute','remove',
    'querySelector','querySelectorAll','getElementById','getContext','attachShadow','closest','contains','focus',
    'blur','click','dispatchEvent','getBoundingClientRect','setPointerCapture','releasePointerCapture',
    'addEventListener','removeEventListener','toDataURL']),
  image:new Set(['remove','setAttribute','getAttribute','removeAttribute','decode','addEventListener','removeEventListener']),
  style:new Set(['setProperty','getPropertyValue','getPropertyPriority']),
  dataset:new Set(),classList:new Set(['add','remove','toggle','contains']),
  context2d:new Set(['measureText','drawImage','scale','clearRect','translate']),
  observer:new Set(['observe','disconnect']),event:new Set(['preventDefault','stopPropagation']),
  viewport:new Set(['addEventListener','removeEventListener']),
  'media-query':new Set(['addEventListener','removeEventListener']),
}

export function startBrowserRuntimeChildV2(config:ChildConfig):void {
  let active=true,port:MessagePort|undefined,nextHandle=0,nextResource=0,renderRevision=0
  let persona:BrowserPersonaSnapshotV2|undefined
  const handles=new Map<number,{value:any;kind:string}>(),reverse=new WeakMap<object,number>()
  const timers=new Map<number,number>(),rafs=new Map<number,number>(),observers=new Set<MutationObserver|ResizeObserver>()
  const images=new Set<HTMLImageElement>(),listeners=new Map<number,Listener>()
  const subscriptions=new Map<number,{type:string;callback:CallbackRef}>(),allocated=new Set<Node>()
  const objectURLs=new Set<string>(),generatedMedia=new Set<string>(),sourceURLs=new Set(config.mediaSources)
  const root=document.createElement('div'),styleHost=document.createElement('div'),chat=document.createElement('div')
  const sheet=document.createElement('style')
  root.className='owned-author-root';styleHost.hidden=true;chat.id='chat';chat.className='rp-reader'
  root.append(styleHost,sheet,chat);document.body.append(root)
  const trace={rpcCount:0,callbackMessages:0,callbacksAfterDispose:0,imageLoads:0,imageErrors:0,
    measureTextCalls:0,drawImageCalls:0,personaEvents:0}
  const send=(message:Record<string,unknown>)=>{if(active)port?.postMessage(message)}
  function ref(value:object,kind:string) {
    let id=reverse.get(value)
    if(id===undefined){id=++nextHandle;reverse.set(value,id);handles.set(id,{value,kind})}
    return {__handle:id,kind}
  }
  const documentRef=ref(document,'document')
  function encode(value:any):any {
    if(value===undefined)return {__undefined:true}
    if(value===null||typeof value!=='object')return value
    if(value===document)return documentRef
    if(value instanceof Node)return ref(value,value instanceof HTMLImageElement?'image':'node')
    if(value instanceof Event)return ref(value,'event')
    if(value instanceof File)return ref(value,'file')
    if(Array.isArray(value)||value instanceof NodeList||value instanceof FileList)return Array.from(value).map(encode)
    if(value instanceof CSSStyleDeclaration)return ref(value,'style')
    if(value instanceof DOMTokenList)return ref(value,'classList')
    if(value instanceof CanvasRenderingContext2D)return ref(value,'context2d')
    if(value instanceof MutationObserver||value instanceof ResizeObserver)return ref(value,'observer')
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encode(item)]))
  }
  function decode(value:any):any {
    if(value&&typeof value==='object') {
      if(value.__undefined)return undefined
      if(value.__handle!==undefined) {
        const owned=handles.get(value.__handle)
        if(!owned)throw Error('BROWSER_DOM_HANDLE_UNAVAILABLE')
        return owned.value
      }
      if(Array.isArray(value))return value.map(decode)
      return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,decode(item)]))
    }
    return value
  }
  const eventGestures=new WeakMap<Event,string>()
  let userForm:HTMLFormElement|null=null
  let interactionExpiry:number|undefined
  const interaction=(event:Event)=>{
    window.clearTimeout(interactionExpiry);interactionExpiry=undefined
    userForm=null
    if(!event.isTrusted||!navigator.userActivation.isActive
      ||event.type==='keydown'&&(event as KeyboardEvent).key!=='Enter')return
    const path=event.composedPath()
    userForm=path.find(value=>value instanceof HTMLFormElement) as HTMLFormElement|undefined??
      (path.find(value=>value instanceof HTMLButtonElement||value instanceof HTMLInputElement) as
        HTMLButtonElement|HTMLInputElement|undefined)?.form??null
    // The browser performs native default submit after its click microtask
    // checkpoint. Expire at the next task; synthetic click clears this proof
    // above, and an actual submit consumes it once in fire().
    interactionExpiry=window.setTimeout(()=>{userForm=null;interactionExpiry=undefined},0)
  }
  document.addEventListener('click',interaction,true)
  document.addEventListener('keydown',interaction,true)
  const preventNavigation=(event:Event)=>{
    if(event.type==='submit')event.preventDefault()
    else if(event.composedPath().some(value=>value instanceof HTMLAnchorElement))event.preventDefault()
  }
  document.addEventListener('submit',preventNavigation,true)
  document.addEventListener('click',preventNavigation,true)
  function fire(callback:CallbackRef,args:any[]=[],kind='resource',event?:Event) {
    if(!active){trace.callbacksAfterDispose++;return}
    let gesture:string|undefined
    if(event?.type==='submit'&&event.isTrusted&&navigator.userActivation.isActive&&event.target===userForm) {
      gesture=eventGestures.get(event)
      if(!gesture){gesture=crypto.randomUUID();eventGestures.set(event,gesture)}
      userForm=null
    }
    trace.callbackMessages++
    send({type:'callback',callbackId:callback.__callback,scriptIdentity:callback.scriptIdentity,
      args:encode(args),resourceKind:kind,...gesture?{trustedFormGesture:gesture}:{}})
  }
  function mediaSource(value:string):string {
    if(sourceURLs.has(value)||objectURLs.has(value)||generatedMedia.has(value))return value
    const absolute=new URL(value,config.baseURI).href
    if(sourceURLs.has(absolute))return absolute
    throw Error('BROWSER_MEDIA_SOURCE_UNSUPPORTED')
  }
  function safeCss(value:string):string {
    if(/@(?:import|namespace|font-face|document)\b|(?:expression|javascript|vbscript)\s*[:(]/i.test(value)
      ||/[\\]/.test(value))throw Error('BROWSER_CSS_ACTIVE_CONTENT_UNSUPPORTED')
    return value.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi,(_all,_quote,url:string)=>'url("'+mediaSource(url)+'")')
  }
  const htmlPolicy:DisplayHtmlPolicy={allowedTags:new Set(BROWSER_TAGS_V2.map(tag=>tag.toUpperCase())),
    dropTags:new Set(),safeAttributes:new Set(['class','id','style','title','role','type','name','value','placeholder',
      'disabled','checked','selected','multiple','accept','maxlength','minlength','rows','cols','for','open',
      'alt','width','height','loading','src','viewbox','points','fill','stroke','stroke-width','xmlns']),
    tagCase:'upper',rejectActiveTags:true,styleText:safeCss,
    styleAttribute:value=>safeCss(value),urlAttribute:(element,name,value)=>
      name==='src'&&element.tagName.toUpperCase()==='IMG'?mediaSource(value):null}
  function own(node:Node):void {
    if(allocated.size>=BROWSER_BUDGET_V1.authorNodes)throw Error('BROWSER_DOM_NODE_LIMIT')
    allocated.add(node)
    if(node instanceof HTMLImageElement) {
      images.add(node);node.crossOrigin='anonymous'
      node.addEventListener('load',()=>{if(active)trace.imageLoads++})
      node.addEventListener('error',()=>{if(active)trace.imageErrors++})
    }
  }
  function setHtml(target:Element|ShadowRoot,value:string) {
    browserUtf8Bytes(value,BROWSER_BUDGET_V1.outputBytes)
    const template=document.createElement('template');template.innerHTML=value
    sanitizeDisplayTree(template.content,htmlPolicy)
    for(const node of Array.from(template.content.querySelectorAll('*')))own(node)
    target.replaceChildren(template.content)
  }
  function installListener(target:EventTarget,type:string,callback:CallbackRef,
    options?:boolean|AddEventListenerOptions):number {
    const capture=typeof options==='boolean'?options:options?.capture===true
    const existing=Array.from(listeners.entries()).find(([,owned])=>owned.target===target&&owned.type===type
      &&owned.callback.__callback===callback.__callback&&owned.capture===capture)
    if(existing)return existing[0]
    const id=++nextResource,native:EventListener=event=>{
      if(typeof options==='object'&&options.once)listeners.delete(id)
      fire(callback,[event],
        target instanceof HTMLImageElement&&['load','error'].includes(event.type)?'resource':'native-event',event)
    }
    target.addEventListener(type,native,options);listeners.set(id,{target,type,native,callback,capture});return id
  }
  function removeListener(target:EventTarget,type:string,callback:CallbackRef,
    options?:boolean|EventListenerOptions):void {
    const capture=typeof options==='boolean'?options:options?.capture===true
    for(const [id,owned] of listeners)if(owned.target===target&&owned.type===type
      &&owned.callback.__callback===callback.__callback&&owned.capture===capture) {
      target.removeEventListener(type,owned.native,owned.capture);listeners.delete(id)
    }
  }
  function read(target:any,kind:string,key:string):any {
    if(kind==='document') {
      if(key==='head')return encode(styleHost)
      if(key==='body')return encode(root)
      if(key==='baseURI')return config.baseURI
      if(key==='defaultView')return {__window:true}
      throw Error('BROWSER_DOM_PROPERTY_UNSUPPORTED')
    }
    if(kind==='style'||kind==='dataset')return target[key]
    if(kind==='context2d'&&contextReads.has(key))return target[key]
    if(kind==='event'&&eventReads.has(key))return encode(target[key])
    if(kind==='file'&&['name','size','type','lastModified'].includes(key))return target[key]
    if(kind==='viewport'&&['width','height','offsetTop','offsetLeft','scale'].includes(key))return target[key]
    if(kind==='media-query'&&['matches','media'].includes(key))return target[key]
    if(!nodeReads.has(key))throw Error('BROWSER_DOM_PROPERTY_UNSUPPORTED')
    if(key==='dataset')return ref(target.dataset,'dataset')
    return encode(target[key])
  }
  function write(target:any,kind:string,key:string,value:any) {
    if(kind==='style'){target[key]=typeof value==='string'?safeCss(value):value;return}
    if(kind==='dataset'){target[key]=value;return}
    if(kind==='context2d'&&contextReads.has(key)){target[key]=value;return}
    if(key.startsWith('on')) {
      const type=key.slice(2)
      const previous=Array.from(listeners.entries()).find(([,owned])=>owned.target===target&&owned.type===type)
      if(previous){target.removeEventListener(type,previous[1].native,previous[1].capture);listeners.delete(previous[0])}
      if(value?.__callback!==undefined)installListener(target,type,value)
      else if(value!==null&&value!==undefined)throw Error('BROWSER_DOM_ACTIVE_ATTRIBUTE_UNSUPPORTED')
      return
    }
    if(!nodeWrites.has(key))throw Error('BROWSER_DOM_PROPERTY_UNSUPPORTED')
    if(key==='innerHTML'){setHtml(target,String(value));return}
    if(key==='src') {
      if(!(target instanceof HTMLImageElement))throw Error('BROWSER_MEDIA_TARGET_UNSUPPORTED')
      target.crossOrigin='anonymous';target.src=mediaSource(value);return
    }
    if(key==='textContent'&&target instanceof HTMLStyleElement)value=safeCss(String(value))
    target[key]=value
  }
  async function request(payload:any):Promise<any> {
    if(!active)throw Error('BROWSER_DOM_REALM_DISPOSED')
    trace.rpcCount++
    if(payload.op==='persona'){if(!persona)throw Error('BROWSER_SNAPSHOT_UNAVAILABLE');return persona}
    if(payload.op==='window-read') {
      if(payload.key==='devicePixelRatio')return devicePixelRatio
      if(payload.key==='innerWidth')return innerWidth
      if(payload.key==='innerHeight')return innerHeight
      if(payload.key==='visualViewport')return visualViewport?ref(visualViewport,'viewport'):null
      throw Error('BROWSER_WINDOW_PROPERTY_UNSUPPORTED')
    }
    if(payload.op==='performance-now')return performance.now()
    if(payload.op==='match-media')return ref(matchMedia(payload.query),'media-query')
    if(payload.op==='computed-style')return encode(getComputedStyle(decode(payload.node)))
    if(payload.op==='url') {
      const url=new URL(payload.url,payload.base||config.baseURI)
      return {href:url.href,origin:url.origin,pathname:url.pathname,searchParams:Object.fromEntries(url.searchParams.entries())}
    }
    if(payload.op==='object-url') {
      const file=decode(payload.file)
      if(!(file instanceof File))throw Error('BROWSER_FILE_NOT_OWNED')
      const url=URL.createObjectURL(file);objectURLs.add(url);return url
    }
    if(payload.op==='revoke-object-url'){if(objectURLs.delete(payload.url))URL.revokeObjectURL(payload.url);return}
    if(payload.op==='event')return ref(payload.custom?new CustomEvent(payload.type,decode(payload.options)):
      new Event(payload.type,decode(payload.options)),'event')
    if(payload.op==='timer') {
      const id=++nextResource,native=window.setTimeout(()=>{timers.delete(id);fire(payload.callback,[],'timer')},payload.delay)
      timers.set(id,native);return id
    }
    if(payload.op==='clear-timer'){clearTimeout(timers.get(payload.id));timers.delete(payload.id);return}
    if(payload.op==='raf') {
      const id=++nextResource,native=requestAnimationFrame(time=>{rafs.delete(id);fire(payload.callback,[time],'raf')})
      rafs.set(id,native);return id
    }
    if(payload.op==='cancel-raf'){cancelAnimationFrame(rafs.get(payload.id)??0);rafs.delete(payload.id);return}
    if(payload.op==='observer') {
      const native=payload.kind==='mutation'?new MutationObserver(()=>fire(payload.callback,[],'observer')):
        new ResizeObserver(()=>fire(payload.callback,[],'observer'))
      observers.add(native);return ref(native,'observer')
    }
    if(payload.op==='image'){const image=new Image();own(image);return ref(image,'image')}
    if(payload.op==='subscribe'){const id=++nextResource;subscriptions.set(id,{type:payload.type,callback:payload.callback});return id}
    if(payload.op==='unsubscribe'){subscriptions.delete(payload.id);return}
    if(payload.op==='listen')return installListener(window,payload.type,payload.callback,payload.options)
    if(payload.op==='unlisten') {
      const owned=listeners.get(payload.id)
      if(owned){owned.target.removeEventListener(owned.type,owned.native,owned.capture);listeners.delete(payload.id)}
      return
    }
    const owned=handles.get(payload.handle)
    if(!owned)throw Error('BROWSER_DOM_HANDLE_UNAVAILABLE')
    const {value:target,kind}=owned
    if(payload.op==='get')return read(target,kind,payload.key)
    if(payload.op==='set'){write(target,kind,payload.key,decode(payload.value));return}
    if(payload.op!=='call'||!methodOwners[kind]?.has(payload.method))throw Error('BROWSER_DOM_METHOD_UNSUPPORTED')
    const args=decode(payload.args)
    if(payload.method==='addEventListener')return installListener(target,args[0],args[1],args[2])
    if(payload.method==='removeEventListener'){removeListener(target,args[0],args[1],args[2]);return}
    if(kind==='document') {
      if(payload.method==='createElement'||payload.method==='createElementNS') {
        const tag=String(args[payload.method==='createElementNS'?1:0]).toLowerCase()
        if(!BROWSER_TAGS_V2.includes(tag as typeof BROWSER_TAGS_V2[number]))throw Error('BROWSER_DOM_TAG_UNSUPPORTED')
        if(payload.method==='createElementNS'&&args[0]!=='http://www.w3.org/2000/svg')throw Error('BROWSER_DOM_NAMESPACE_UNSUPPORTED')
        const node=payload.method==='createElementNS'?document.createElementNS(args[0],tag):document.createElement(tag)
        own(node);return encode(node)
      }
      if(payload.method==='getElementById')return encode(root.querySelector('#'+CSS.escape(args[0])))
      const selected=payload.method==='querySelector'?root.querySelector(args[0]):root.querySelectorAll(args[0])
      return encode(selected)
    }
    if(payload.method==='setAttribute') {
      const clean=cleanDisplayAttribute(target,String(args[0]),String(args[1]),htmlPolicy)
      if(clean===null)throw Error('BROWSER_DOM_ATTRIBUTE_UNSUPPORTED')
      target.setAttribute(args[0],clean);return
    }
    if(payload.method==='setProperty'){target.setProperty(args[0],safeCss(String(args[1])),args[2]);return}
    if(payload.method==='attachShadow')return encode(target.attachShadow({mode:'open'}))
    if(payload.method==='measureText'){trace.measureTextCalls++;return {width:target.measureText(...args).width}}
    if(payload.method==='drawImage')trace.drawImageCalls++
    const result=await target[payload.method](...args)
    if(payload.method==='toDataURL'){generatedMedia.add(result);return result}
    if(kind==='observer'&&payload.method==='disconnect')observers.delete(target)
    return encode(result)
  }
  function semantic(type:string) {for(const value of subscriptions.values())if(value.type===type)fire(value.callback,[],'semantic')}
  function render(value:BrowserRenderV2) {
    if(value.renderRevision<=renderRevision)return
    renderRevision=value.renderRevision;sheet.textContent=value.css
    const fragment=document.createDocumentFragment()
    for(const part of value.parts) {
      const floor=document.createElement('section');floor.className='mes rp-reader-message'
      floor.setAttribute('is_user',String(part.kind==='user'));floor.dataset.readerKey=part.key
      if(part.kind==='user')floor.textContent=part.text
      else floor.innerHTML=part.html
      fragment.append(floor)
    }
    chat.replaceChildren(fragment);semantic('MESSAGE_UPDATED');measure()
  }
  function measure() {send({type:'layout',height:Math.max(1,Math.ceil(root.getBoundingClientRect().height)),renderRevision})}
  const layoutObserver=new ResizeObserver(measure);layoutObserver.observe(root)
  function resources() {return {handles:handles.size,timers:timers.size,rafs:rafs.size,observers:observers.size,
    images:images.size,listeners:listeners.size,subscriptions:subscriptions.size,objectURLs:objectURLs.size,
    generatedMedia:generatedMedia.size,authorNodes:allocated.size,rootConnected:root.isConnected}}
  function dispose() {
    const before=resources();active=false
    for(const id of timers.values())clearTimeout(id);timers.clear()
    for(const id of rafs.values())cancelAnimationFrame(id);rafs.clear()
    for(const observer of observers)observer.disconnect();observers.clear();layoutObserver.disconnect()
    for(const listener of listeners.values())listener.target.removeEventListener(listener.type,listener.native,listener.capture)
    listeners.clear();subscriptions.clear()
    for(const image of images){image.onload=null;image.onerror=null;image.removeAttribute('src')}
    images.clear();for(const url of objectURLs)URL.revokeObjectURL(url)
    objectURLs.clear();generatedMedia.clear();handles.clear();allocated.clear();root.remove();persona=undefined
    document.removeEventListener('click',interaction,true);document.removeEventListener('keydown',interaction,true)
    document.removeEventListener('submit',preventNavigation,true);document.removeEventListener('click',preventNavigation,true)
    window.clearTimeout(interactionExpiry);interactionExpiry=undefined
    userForm=null
    return {before,after:resources(),trace}
  }
  const bind=(event:MessageEvent)=>{
    if(event.source!==window.parent||event.data?.type!=='bind'||event.data.nonce!==config.nonce||!event.ports[0]||port)return
    port=event.ports[0]
    port.onmessage=event=>{
      const message=event.data
      if(message.type==='rpc')void request(message.payload).then(value=>send({type:'rpc-result',id:message.id,value:encode(value)}))
        .catch(error=>send({type:'rpc-result',id:message.id,error:error instanceof Error?error.message:'BROWSER_DOM_ERROR'}))
      if(message.type==='snapshot') {
        const next=message.persona as BrowserPersonaSnapshotV2
        const changed=persona&&persona.name!==next.name
        persona=next;if(changed){trace.personaEvents++;semantic('PERSONA_CHANGED')}
      }
      if(message.type==='render')render(message.render)
      if(message.type==='inspect')send({type:'inspection',id:message.id,resources:resources(),trace})
      if(message.type==='dispose') {
        const result=dispose();port!.postMessage({type:'disposed',result});port!.close();port=undefined
        window.removeEventListener('message',bind)
      }
    }
    port.start();send({type:'child-ready',document:documentRef})
  }
  window.addEventListener('message',bind)
  window.parent.postMessage({v:2,nonce:config.nonce,generation:config.binding.generation,type:'transport-ready'},'*')
}
export function startBrowserRuntimeChildFromDocumentV2():void {
  const element=document.getElementById('owned-browser-runtime-config')
  if(!element?.textContent)throw Error('BROWSER_CHILD_CONFIGURATION_UNAVAILABLE')
  startBrowserRuntimeChildV2(JSON.parse(element.textContent) as ChildConfig)
}
