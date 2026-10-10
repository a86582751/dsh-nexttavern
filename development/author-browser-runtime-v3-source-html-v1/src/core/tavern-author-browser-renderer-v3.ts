/** Trusted native DOM/resource owner for one admitted page. Original author
 * JavaScript is inert here; the Worker advances its own shared-runtime Actor. */
import {cleanDisplayAttribute,sanitizeDisplayTree} from './tavern-display-html.js'
import type {DisplayHtmlPolicy} from './tavern-display-html.js'
import type {BrowserPageResourceV3,BrowserSourcePagePlanV3} from './tavern-author-browser-types-v3.mjs'
import type {HtmlAttributeV1,HtmlNodeCreationV1,HtmlParserStepV1,HtmlParsedCandidateV1} from './tavern-author-html-types-v1.mjs'
import type {BrowserPageRendererV3,NativeCallbackDeliveryV3,NativeCreateV3,NativeHandleKindV3,
  NativeHandleV3,NativePromiseSettlementV3,NativeRequestV3,NativeWireValueV3,
  NativeWireObjectV3,OwnedNativeCallbackV3} from './tavern-author-browser-native-types-v3.js'
import type {BrowserNativeFrameHookV3,NativeReplyV3} from './tavern-author-browser-native-types-v3.js'

/** The same actual receiver-owner declarations can be used by the guest
 * proxy. A flat union of names does not confer methods on another kind. */
export const BROWSER_NATIVE_METHODS_V3:Readonly<Record<NativeHandleKindV3,readonly string[]>>=Object.freeze({
  document:['createElement','createElementNS','createTextNode','createDocumentFragment','getElementById',
    'querySelector','querySelectorAll','addEventListener','removeEventListener'],
  node:['appendChild','removeChild','insertBefore','replaceChild','append','prepend','replaceChildren','replaceWith',
    'after','before','remove','cloneNode','setAttribute','getAttribute','hasAttribute','removeAttribute','querySelector','querySelectorAll',
    'closest','contains','focus','blur','click','dispatchEvent','getBoundingClientRect','setPointerCapture',
    'releasePointerCapture','getContext','createSVGPoint','getScreenCTM','toDataURL','decode','addEventListener','removeEventListener'],
  style:['setProperty','removeProperty','getPropertyValue','getPropertyPriority','item'],
  dataset:[], 'class-list':['add','remove','toggle','contains'],
  canvas:['measureText','drawImage','scale','clearRect','translate','save','restore','beginPath','closePath','moveTo',
    'lineTo','arc','ellipse','fill','stroke','fillRect','strokeRect','rotate','transform','setTransform','resetTransform',
    'roundRect','quadraticCurveTo','bezierCurveTo','fillText','strokeText','createLinearGradient','createRadialGradient','getTransform'],
  gradient:['addColorStop'],point:['matrixTransform'],matrix:['inverse'],
  event:['preventDefault','stopPropagation','stopImmediatePropagation'],
  audio:['play','pause','load','getAttribute','addEventListener','removeEventListener'],
  file:['text'],blob:['text'],
  'file-reader':['readAsText','readAsDataURL','abort','addEventListener','removeEventListener'],
  observer:['observe','unobserve','disconnect'],
  'media-query':['addEventListener','removeEventListener'],viewport:['addEventListener','removeEventListener'],
  frame:['remove','close','addEventListener','removeEventListener','setAttribute','getAttribute','removeAttribute'], 'frame-parent':['removeChild'],
  'frame-style':['setProperty','removeProperty','getPropertyValue','getPropertyPriority','item'],
})
const htmlTags=new Set(['a','article','aside','audio','b','br','button','canvas','code','datalist','details','dialog','div',
  'em','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hr','i','img','input',
  'label','legend','li','main','meter','nav','ol','option','output','p','pre','progress','section','select','small',
  'source','span','strong','style','summary','table','tbody','td','template','textarea','th','thead','tr','ul'])
const svgTags=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs',
  'linearGradient','radialGradient','stop','clipPath','mask','use','symbol'])
const nodeReads=new Set(['id','className','textContent','innerText','src','width','height','alt','complete',
  'naturalWidth','naturalHeight','value','hidden','disabled','checked','type','tagName','nodeType','open','files',
  'isConnected','clientWidth','clientHeight','offsetWidth','offsetHeight','scrollTop','scrollHeight',
  'childElementCount','selectionStart','selectionEnd','placeholder','title'])
const nodeWrites=new Set(['id','className','textContent','innerText','src','width','height','alt','loading','value',
  'hidden','disabled','checked','scrollTop','type','open','placeholder','title','selectionStart','selectionEnd'])
const canvasProperties=new Set(['font','fillStyle','strokeStyle','lineWidth','textAlign','textBaseline','globalAlpha',
  'globalCompositeOperation','lineCap','lineJoin','miterLimit','shadowBlur','shadowColor','shadowOffsetX','shadowOffsetY',
  'imageSmoothingEnabled','imageSmoothingQuality','lineDashOffset'])
const textMetricFields=['width','actualBoundingBoxLeft','actualBoundingBoxRight','actualBoundingBoxAscent',
  'actualBoundingBoxDescent','fontBoundingBoxAscent','fontBoundingBoxDescent','emHeightAscent','emHeightDescent',
  'hangingBaseline','alphabeticBaseline','ideographicBaseline'] as const
const eventProperties=new Set(['type','target','currentTarget','key','code','keyCode','button','buttons','clientX','clientY',
  'pageX','pageY','pointerId','ctrlKey','shiftKey','altKey','metaKey','isTrusted','detail','defaultPrevented',
  'bubbles','cancelable','timeStamp','deltaX','deltaY','deltaMode','touches','changedTouches','persisted'])
const mediaProperties=new Set(['src','currentTime','duration','volume','loop','preload','paused','ended','readyState',
  'error','muted','playbackRate'])
const safeAttributes=new Set(['class','id','style','title','role','type','name','value','placeholder','disabled','checked',
  'selected','multiple','accept','maxlength','minlength','rows','cols','for','open','alt','width','height','loading',
  'src','href','download','viewbox','points','d','x','y','cx','cy','r','rx','ry','x1','x2','y1','y2','fill','stroke',
  'stroke-width','transform','opacity','xmlns','preserveaspectratio','gradientunits','offset','stop-color','stop-opacity'])
const HTML_NS='http://www.w3.org/1999/xhtml',SVG_NS='http://www.w3.org/2000/svg'
const inertScriptType='application/x-owned-browser-script'
const inertStyleType='application/x-owned-browser-stylesheet'
/** Guest expando handling consumes these same native owner fields. CSSStyle
 * and dataset are dynamic resources; their property space remains native. */
export const BROWSER_NATIVE_PROPERTIES_V3:Readonly<Record<NativeHandleKindV3,readonly string[]>>=Object.freeze({
  document:['documentElement','head','body','readyState','compatMode','baseURI','defaultView','currentScript','activeElement'],
  node:[...new Set([...nodeReads,...nodeWrites,'style','dataset','classList','ownerDocument','innerHTML',
    'children','childNodes','firstChild','lastChild','nextSibling','previousSibling','nextElementSibling','offsetParent',
    'parentNode','parentElement','content'])],
  style:[],dataset:[],'class-list':[],canvas:[...canvasProperties],gradient:[],point:['x','y','z','w'],
  matrix:['a','b','c','d','e','f'],event:[...eventProperties],audio:[...mediaProperties],
  file:['name','size','type','lastModified'],blob:['name','size','type','lastModified'],
  'file-reader':['result','error','readyState'],observer:[],
  'media-query':['matches','media'],viewport:['width','height','offsetTop','offsetLeft','scale'],
  frame:['id','style','isConnected','contentWindow','src','srcdoc','parentNode','nodeType','ownerDocument','parentElement','parent'],
  'frame-parent':['nodeType','ownerDocument','parentElement','parentNode','parent'],'frame-style':[],
})
interface HandleOwner {readonly value:any;readonly kind:NativeHandleKindV3}
interface NativeListener {
  readonly listenerId:number;readonly once:boolean;readonly property:boolean
  readonly target:EventTarget;readonly type:string;readonly callback:OwnedNativeCallbackV3
  readonly capture:boolean;readonly native:EventListener
}
interface NativeLoad {
  readonly target:HTMLImageElement|HTMLMediaElement|HTMLStyleElement|HTMLLinkElement
  readonly kind:'image'|'media'|'stylesheet'
  readonly events:readonly string[]
  readonly listener:EventListener
  pending:boolean
}
interface NativeReadinessWaiter {
  readonly signal:AbortSignal
  readonly resolve:()=>void
  readonly reject:(error:Error)=>void
  readonly abort:()=>void
  fontsPending:boolean
}
export interface BrowserNativeRenderPlanV3 {
  readonly parsed:Pick<HtmlParsedCandidateV1,'document'|'steps'|'scripts'|'styles'|'resources'>
  readonly resources:readonly BrowserPageResourceV3[]
}
export interface BrowserPageRendererOptionsV3 {
  readonly document:Document
  readonly plan:BrowserNativeRenderPlanV3
  /** Trusted enabled Main window for native resource scheduling. Standalone
   * renderers with an enabled document may retain their document's window. */
  readonly schedulerWindow?:Window
  /** Trusted carrier bootstrap, independent of parsed Source page admission.
   * Original text is inert natively and executes only in the Worker realm. */
  readonly carrierScript?:{readonly javascript:string;readonly identity:string;
    readonly captured:(reference:NativeHandleV3)=>void}
  readonly pageId:string
  readonly onCallback?:(delivery:NativeCallbackDeliveryV3)=>void
  readonly onPromiseSettlement?:(settlement:NativePromiseSettlementV3)=>void
  /** Resolves an already admitted resource to actual owned bytes/URL. */
  readonly resolveResource?:(resource:BrowserPageResourceV3)=>string
  readonly externalFrames?:BrowserNativeFrameHookV3
}

export function createBrowserPageRendererV3(options:BrowserPageRendererOptionsV3):BrowserPageRendererV3 {
  const {document:doc,plan,pageId}=options,view=doc.defaultView!
  // Source windows intentionally disable native script execution. Their
  // setTimeout tasks abort before delivery, even for a Main-owned callback.
  const scheduler=options.schedulerWindow??view
  const shellHtml=doc.documentElement,shellHead=doc.head,shellBody=doc.body
  const trustedHead=doc.createDocumentFragment(),trustedBody=doc.createDocumentFragment()
  // Transport has already entered this trusted bootstrap and handed over its
  // document. Detached nodes cannot affect author selectors/:nth-child/CSS;
  // removing the CSP META does not revoke the already applied native policy.
  for(const node of Array.from(shellHead.childNodes))trustedHead.appendChild(node)
  for(const node of Array.from(shellBody.childNodes))trustedBody.appendChild(node)
  shellHead.remove();shellBody.remove()
  const handles=new Map<number,HandleOwner>(),reverse=new WeakMap<object,number>()
  const nodes=new Map<number,Node>(),ownedNodes=new Set<Node>([doc])
  const payloads=new Map(plan.parsed.document.nodes.map(node=>[node.nodeId,node]))
  const scriptAttributes=new WeakMap<Element,Map<string,string>>()
  const styleAttributes=new WeakMap<Element,Map<string,string>>()
  const assemblingStyles=new Map<HTMLStyleElement,string>()
  const importedStyles=new WeakSet<HTMLStyleElement>()
  const sourceStyles=new Map(plan.parsed.styles.filter(style=>style.kind==='stylesheet').map(style=>[style.nodeId,style]))
  const sourceImportNodes=new Set(plan.parsed.resources.filter(resource=>resource.kind==='css-import').map(resource=>resource.nodeId))
  const listeners=new Set<NativeListener>(),propertyListeners=new WeakMap<object,Map<string,NativeListener>>()
  const callbackReferences=new Map<number,OwnedNativeCallbackV3>(),callbackObjects=new WeakSet<object>()
  const timers=new Map<number,{native:number;mode:'timeout'|'interval'|'raf'}>()
  const observers=new Set<MutationObserver|ResizeObserver>(),media=new Set<HTMLImageElement|HTMLMediaElement>()
  const mutationBindings=new Map<MutationObserver,{readonly callback:OwnedNativeCallbackV3;readonly pending:MutationRecord[]}>()
  const fileReaders=new Set<FileReader>(),objectURLs=new Set<string>(),generatedMedia=new Set<string>()
  const pendingPromises=new Set<number>(),resolvedResources=new Map<string,string>()
  const parsedStyleText=new WeakMap<Text,string>()
  const nativeLoads=new Map<Element,NativeLoad>(),readinessWaiters=new Set<NativeReadinessWaiter>()
  let resourceVersion=0
  let nextHandle=0,nextResource=0,nextPromise=0,nextStep=0,active=true,ended=false
  let logicalHtml:Element|null=null,logicalHead:Element|null=null,logicalBody:Element|null=null
  let readyState:'loading'|'interactive'|'complete'='loading'
  let disposal:Promise<ReturnType<typeof resources>>|undefined
  let callbackBatch:NativeCallbackDeliveryV3[]|undefined

  function ref(value:object,kind:NativeHandleKindV3):NativeHandleV3 {
    let handle=reverse.get(value)
    if(handle===undefined){handle=++nextHandle;reverse.set(value,handle);handles.set(handle,{value,kind})}
    return {tag:'handle',pageId,handle,kind}
  }
  const documentHandle=ref(doc,'document')
  const visibleNode=(node:Node)=>ownedNodes.has(node)||!!options.externalFrames?.encode(node)
  function owned(reference:NativeHandleV3):HandleOwner {
    const result=reference.pageId===pageId?handles.get(reference.handle):undefined
    if(!result)throw Error('BROWSER3_DOM_HANDLE_UNAVAILABLE')
    return result
  }
  function own(node:Node,deep=true):Node {
    if(options.externalFrames?.encode(node))return node
    ownedNodes.add(node)
    if(node instanceof view.Element&&node.tagName.toLowerCase()==='script') {
      if(!scriptAttributes.has(node))scriptAttributes.set(node,new Map(Array.from(node.attributes).map(attr=>[attr.name,attr.value])))
      node.removeAttribute('src');node.removeAttribute('nonce');node.setAttribute('type',inertScriptType)
    }
    if(node instanceof view.HTMLImageElement||node instanceof view.HTMLMediaElement)media.add(node)
    observeLoad(node)
    if(deep)for(const child of Array.from(node.childNodes))own(child)
    if(deep&&node instanceof view.HTMLTemplateElement)own(node.content)
    return node
  }
  function observeLoad(node:Node):void {
    if(!(node instanceof view.HTMLImageElement||node instanceof view.HTMLMediaElement
      ||node instanceof view.HTMLStyleElement||node instanceof view.HTMLLinkElement)||nativeLoads.has(node))return
    const kind=node instanceof view.HTMLImageElement?'image':node instanceof view.HTMLMediaElement?'media':'stylesheet'
    const events=kind==='media'?['loadeddata','error','abort','suspend','emptied']:['load','error']
    const load:NativeLoad={target:node,kind,events,pending:false,listener:()=>{
      if(!active||!load.pending)return
      load.pending=false;resourceVersion++;advanceReadiness()
    }}
    nativeLoads.set(node,load)
    for(const type of events)node.addEventListener(type,load.listener)
    if((kind==='image'||kind==='media')&&node.hasAttribute('src'))beginLoad(node)
  }
  function beginLoad(target:Element):void {
    const load=nativeLoads.get(target)
    if(!load)return
    load.pending=true;resourceVersion++
  }
  function reconcileLoad(load:NativeLoad):void {
    if(!load.pending)return
    const target=load.target
    if(load.kind==='image') {
      const image=target as HTMLImageElement
      // complete includes completed failures. Lazy images do not delay load.
      if(image.complete||image.loading==='lazy')load.pending=false
    }else if(load.kind==='media') {
      const media=target as HTMLMediaElement
      if(media.readyState>=view.HTMLMediaElement.HAVE_CURRENT_DATA||media.error
        ||media.networkState===view.HTMLMediaElement.NETWORK_NO_SOURCE
        ||media.preload==='none'&&!media.autoplay)load.pending=false
    }else if(!target.isConnected)load.pending=false
    if(!load.pending)resourceVersion++
  }
  function finishReadiness(waiter:NativeReadinessWaiter,error?:Error):void {
    if(!readinessWaiters.delete(waiter))return
    waiter.signal.removeEventListener('abort',waiter.abort)
    if(error)waiter.reject(error);else waiter.resolve()
  }
  function advanceReadiness():void {
    if(!active||!ended)return
    for(const load of nativeLoads.values())reconcileLoad(load)
    if([...nativeLoads.values()].some(load=>load.pending))return
    for(const waiter of readinessWaiters) {
      if(waiter.fontsPending)continue
      // Layout discovers used @font-face requests. Waiting only declared URLs
      // would eagerly load unused fonts and give different native semantics.
      logicalBody?.getBoundingClientRect()
      const fonts=doc.fonts
      if(!fonts) {
        const usesFonts=plan.resources.some(resource=>['font','font-stylesheet','stylesheet'].includes(resource.kind))
        finishReadiness(waiter,usesFonts?Error('BROWSER3_FONT_READINESS_UNAVAILABLE'):undefined)
        continue
      }
      waiter.fontsPending=true
      const version=resourceVersion
      void fonts.ready.then(()=>{
        if(!readinessWaiters.has(waiter)||!active)return
        waiter.fontsPending=false
        if(version===resourceVersion)finishReadiness(waiter)
        else advanceReadiness()
      },error=>finishReadiness(waiter,error instanceof Error?error:Error(String(error))))
    }
  }
  function awaitResourcesReady(signal:AbortSignal):Promise<void> {
    if(!active||signal.aborted)return Promise.reject(Error('BROWSER3_PAGE_CLOSED'))
    return new Promise<void>((resolve,reject)=>{
      const waiter:NativeReadinessWaiter={signal,resolve,reject,fontsPending:false,
        abort:()=>finishReadiness(waiter,Error('BROWSER3_PAGE_CLOSED'))}
      readinessWaiters.add(waiter);signal.addEventListener('abort',waiter.abort,{once:true})
      advanceReadiness()
    })
  }
  function mutationDelivery(callback:OwnedNativeCallbackV3,records:readonly MutationRecord[],observer:MutationObserver):void {
    if(!records.length)return
    fire(callback,[records.map(record=>({
      type:record.type,target:record.target,addedNodes:Array.from(record.addedNodes),removedNodes:Array.from(record.removedNodes),
      previousSibling:record.previousSibling,nextSibling:record.nextSibling,attributeName:record.attributeName,
      attributeNamespace:record.attributeNamespace,oldValue:record.oldValue,
    })),observer],'observer',undefined,observer)
  }
  function activateStyle(style:HTMLStyleElement):void {
    const expected=assemblingStyles.get(style)
    if(expected===undefined)return
    const actual=Array.from(style.childNodes).map(node=>parsedStyleText.get(node as Text)??node.textContent??'').join('')
    if(actual!==expected)return
    assemblingStyles.delete(style)
    const type=styleAttributes.get(style)!.get('type')
    if(importedStyles.has(style)&&(!type||type.toLowerCase()==='text/css'))beginLoad(style)
    // Native STYLE updates queue load tasks even for the empty sheet. Its
    // initial parser assembly stays inert, then installs exactly one sheet.
    // This qualifies initial Source assembly, not arbitrary sheet replacement.
    // Preserve existing observer records, and remove only records produced by
    // this synchronous trusted type mutation, never author's type changes.
    for(const [observer,binding] of mutationBindings)binding.pending.push(...observer.takeRecords())
    if(type===undefined)style.removeAttribute('type');else style.setAttribute('type',type)
    for(const [observer,binding] of mutationBindings) {
      binding.pending.push(...observer.takeRecords().filter(record=>record.target!==style
        ||record.type!=='attributes'||record.attributeName!=='type'))
      if(binding.pending.length)view.queueMicrotask(()=>{
        if(active)mutationDelivery(binding.callback,binding.pending.splice(0),observer)
      })
    }
    resourceVersion++
  }
  function activatePrefixStyles():void {
    for(const style of assemblingStyles.keys())if(style.isConnected)activateStyle(style)
  }
  function prepareInsertion(node:Node):void {
    if(node instanceof view.HTMLLinkElement&&node.relList.contains('stylesheet')&&node.hasAttribute('href'))beginLoad(node)
    if(node instanceof view.HTMLStyleElement&&!assemblingStyles.has(node)&&importedStyles.has(node))beginLoad(node)
    for(const child of node.childNodes)prepareInsertion(child)
  }
  function selected(target:ParentNode,selector:string,all:boolean):Node|null|Node[] {
    const result=Array.from(target.querySelectorAll(selector)).filter(visibleNode)
    return all?result:result[0]??null
  }
  function encode(value:any):NativeWireValueV3 {
    if(value===undefined)return {tag:'undefined'}
    if(value===null||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return value
    if(value===view)return {tag:'page-window',pageId}
    if(value===doc)return documentHandle
    if(value instanceof view.Node)return options.externalFrames?.encode(value)
      ??(ownedNodes.has(value)?ref(value,value instanceof view.HTMLMediaElement?'audio':'node'):null)
    if(value instanceof view.Event)return ref(value,'event')
    if(value instanceof view.File)return ref(value,'file')
    if(value instanceof view.Blob)return ref(value,'blob')
    if(value instanceof view.CSSStyleDeclaration)return ref(value,'style')
    if(value instanceof view.DOMTokenList)return ref(value,'class-list')
    if(view.CanvasRenderingContext2D&&value instanceof view.CanvasRenderingContext2D)return ref(value,'canvas')
    if(view.CanvasGradient&&value instanceof view.CanvasGradient)return ref(value,'gradient')
    if(view.DOMPoint&&value instanceof view.DOMPoint)return ref(value,'point')
    if(view.DOMMatrix&&value instanceof view.DOMMatrix)return ref(value,'matrix')
    // SVGPoint/SVGMatrix are browser-specific older interfaces. The owner
    // gives these returned values their kind at the method dispatch below.
    if(value instanceof view.FileReader)return ref(value,'file-reader')
    if(observers.has(value))return ref(value,'observer')
    if(Array.isArray(value)||value instanceof view.NodeList||value instanceof view.HTMLCollection
      ||value instanceof view.FileList)return Array.from(value).filter(item=>!(item instanceof view.Node)
        ||visibleNode(item)).map(encode)
    return {tag:'record',entries:Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encode(item)]))}
  }
  function decode(value:NativeWireValueV3):any {
    if(value&&typeof value==='object') {
      if(Array.isArray(value))return value.map(decode)
      const wire=value as NativeWireObjectV3
      if(wire.tag==='undefined')return undefined
      if(wire.tag==='page-window'&&wire.pageId===pageId)return view
      if(wire.tag==='handle') {
        if(wire.handle<0){const node=options.externalFrames?.resolve(wire);if(node)return node;throw Error('BROWSER3_FRAME_UNAVAILABLE')}
        const target=owned(wire)
        return target.kind==='event'?target.value.event??target.value:target.value
      }
      if(wire.tag==='callback')return retainCallback(wire)
      if(wire.tag==='record')return Object.fromEntries(Object.entries(wire.entries).map(([key,item])=>[key,decode(item)]))
      throw Error('BROWSER3_NATIVE_ARGUMENT_UNSUPPORTED')
    }
    return value
  }
  function resourceUrl(value:string,inlineImage=false):string {
    // Source may construct an encoded SVG placeholder from its current DATA.
    // An image sink displays that inline DATA without a fetched resource; it
    // does not grant the same URL to navigation or executable resource sinks.
    if(inlineImage&&/^data:image\//i.test(value))return value
    if(objectURLs.has(value)||generatedMedia.has(value))return value
    const existing=resolvedResources.get(value);if(existing)return existing
    const resource=plan.resources.find(row=>row.value===value)
    if(!resource)throw Error('BROWSER3_RESOURCE_UNAVAILABLE')
    const resolved=options.resolveResource?.(resource)??resource.value
    resolvedResources.set(value,resolved);resolvedResources.set(resolved,resolved)
    return resolved
  }
  function css(value:string,parsed=false):string {
    if(!parsed&&(/[\\]/.test(value)||/@(?:namespace|document)\b|(?:expression|javascript|vbscript)\s*[:(]/i.test(value)))
      throw Error('BROWSER3_DYNAMIC_CSS_UNSUPPORTED')
    return value.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi,
      (_all,a:string,b:string,c:string)=>'url("'+resourceUrl(a??b??c,true).replaceAll('"','%22')+'")')
      .replace(/(@import\s+)(["'])(.*?)\2/gi,(_all,prefix:string,_quote:string,url:string)=>
        prefix+'"'+resourceUrl(url).replaceAll('"','%22')+'"')
  }
  const displayPolicy:DisplayHtmlPolicy={allowedTags:new Set([...htmlTags,...svgTags].map(tag=>tag.toUpperCase())),
    dropTags:new Set(),safeAttributes,tagCase:'upper',rejectActiveTags:true,styleText:value=>css(value),
    styleAttribute:value=>css(value),urlAttribute:(element,name,value)=>
      resourceUrl(value,name==='src'&&element instanceof view.HTMLImageElement)}
  function setHtml(target:Element,value:string):void {
    const template=doc.createElement('template');template.innerHTML=value
    sanitizeFragment(template.content)
    for(const child of Array.from(template.content.childNodes))own(child)
    replaceOwnedChildren(target,Array.from(template.content.childNodes))
  }
  function sanitizeFragment(fragment:DocumentFragment):void {
    sanitizeDisplayTree(fragment,displayPolicy)
    for(const template of Array.from(fragment.querySelectorAll('template')))sanitizeFragment(template.content)
  }
  function replaceOwnedChildren(target:Node,children:readonly Node[]):void {
    for(const child of Array.from(target.childNodes))if(visibleNode(child)) {
      target.removeChild(child);options.externalFrames?.removed(child)
    }
    for(const child of children){prepareInsertion(child);target.appendChild(child)}
    resourceVersion++;advanceReadiness()
  }
  function cloneOwned(node:Node,deep:boolean,register=true):Node {
    const clone=node.cloneNode(false)
    if(deep)for(const child of Array.from(node.childNodes))if(ownedNodes.has(child))clone.appendChild(cloneOwned(child,true,register))
    if(node instanceof view.HTMLTemplateElement&&clone instanceof view.HTMLTemplateElement&&deep)
      for(const child of Array.from(node.content.childNodes))clone.content.appendChild(cloneOwned(child,true,register))
    const attrs=node instanceof view.Element?scriptAttributes.get(node):undefined
    if(attrs&&clone instanceof view.Element){scriptAttributes.set(clone,new Map(attrs));clone.setAttribute('type',inertScriptType)}
    const styleAttrs=node instanceof view.Element?styleAttributes.get(node):undefined
    if(styleAttrs&&clone instanceof view.HTMLStyleElement) {
      const type=styleAttrs.get('type')
      if(type===undefined)clone.removeAttribute('type');else clone.setAttribute('type',type)
      styleAttributes.set(clone,new Map(styleAttrs))
      if(importedStyles.has(node as HTMLStyleElement))importedStyles.add(clone)
    }
    if(register&&clone instanceof view.HTMLTemplateElement)own(clone.content,false)
    return register?own(clone,false):clone
  }
  function ownedHtml(target:Element):string {
    const holder=doc.createElement('div')
    for(const child of Array.from(target.childNodes))if(ownedNodes.has(child))holder.appendChild(cloneOwned(child,true,false))
    return holder.innerHTML
  }
  function ownedText(node:Node):string {
    if(node.nodeType===view.Node.TEXT_NODE||node.nodeType===view.Node.CDATA_SECTION_NODE
      ||node.nodeType===view.Node.COMMENT_NODE)return node.textContent??''
    return Array.from(node.childNodes).filter(child=>ownedNodes.has(child)&&child.nodeType!==view.Node.COMMENT_NODE)
      .map(ownedText).join('')
  }
  function promise(value:Promise<unknown>):NativeWireValueV3 {
    const promiseId=++nextPromise;pendingPromises.add(promiseId)
    void value.then(result=>{
      if(pendingPromises.has(promiseId))settlePromise(promiseId,{kind:'fulfilled',value:encode(result)})
    }).catch(error=>settlePromise(promiseId,{kind:'rejected',error:error instanceof Error?error.message:String(error)}))
    return {tag:'promise',pageId,promiseId}
  }
  function settlePromise(promiseId:number,result:{kind:'fulfilled';value:NativeWireValueV3}|{kind:'rejected';error:string}):void {
    if(pendingPromises.delete(promiseId))options.onPromiseSettlement?.({pageId,promiseId,...result})
  }
  function fire(callback:OwnedNativeCallbackV3,args:unknown[],resourceKind:NativeCallbackDeliveryV3['resourceKind'],
    nativeEvent?:Event,receiver?:unknown,registration?:NativeListener):void {
    if(!active)return
    const actualReceiver=nativeEvent?nativeEvent.currentTarget:receiver
    const delivery:NativeCallbackDeliveryV3={callback,args:args.map(encode),resourceKind,
      ...registration?{registration:{listenerId:registration.listenerId,type:registration.type,
        capture:registration.capture,once:registration.once,...registration.property?{property:'on'+registration.type}:{}}}:{},
      ...actualReceiver===undefined?{}:{receiver:encode(actualReceiver)},...nativeEvent?{
        nativeEvent,event:{reference:ref(nativeEvent,'event'),target:encode(nativeEvent.target),
          currentTarget:encode(nativeEvent.currentTarget),eventPhase:nativeEvent.eventPhase,
          cancelable:nativeEvent.cancelable,defaultPrevented:nativeEvent.defaultPrevented}}:{}}
    if(callbackBatch)callbackBatch.push(delivery)
    else options.onCallback?.(delivery)
  }
  function retainCallback(reference:OwnedNativeCallbackV3):OwnedNativeCallbackV3 {
    if(reference.pageId!==pageId)throw Error('BROWSER3_CALLBACK_PAGE_UNAVAILABLE')
    let callback=callbackReferences.get(reference.callbackId)
    if(!callback){callback={...reference};callbackReferences.set(reference.callbackId,callback);callbackObjects.add(callback)}
    return callback
  }
  function installListener(target:EventTarget,type:string,callback:OwnedNativeCallbackV3,
    options?:boolean|AddEventListenerOptions,property=false):NativeListener {
    if(!callbackObjects.has(callback))throw Error('BROWSER3_CALLBACK_REQUIRED')
    if((target===doc||target===view)&&['DOMContentLoaded','load','readystatechange'].includes(type))
      throw Error('BROWSER3_LOGICAL_LIFECYCLE_EVENT')
    const capture=typeof options==='boolean'?options:options?.capture===true
    const existing=Array.from(listeners).find(row=>row.target===target&&row.type===type
      &&row.callback.callbackId===callback.callbackId&&row.capture===capture&&row.property===property)
    if(existing)return existing
    const native:EventListener=event=>{
      fire(callback,[event],target instanceof view.HTMLImageElement||target instanceof view.HTMLMediaElement
        ||target instanceof view.HTMLStyleElement||target instanceof view.HTMLLinkElement
        ||target instanceof view.FileReader?'resource':'native-event',event,undefined,listener)
    }
    const listener={target,type,callback,capture,native,listenerId:++nextResource,
      once:typeof options==='object'&&options.once===true,property}
    // A once listener is consumed at actual guest invocation. Native
    // once would remove a later listener even when stopImmediate suppresses it.
    const nativeOptions=typeof options==='object'?{...options,once:false}:options
    if(property)(target as any)['on'+type]=native
    else target.addEventListener(type,native,nativeOptions)
    listeners.add(listener);return listener
  }
  function consumeListener(listenerId:number):boolean {
    for(const row of listeners)if(row.listenerId===listenerId) {
      if(row.property)(row.target as any)['on'+row.type]=null
      else row.target.removeEventListener(row.type,row.native,row.capture)
      listeners.delete(row);return true
    }
    return false
  }
  function removeListener(target:EventTarget,type:string,callback:OwnedNativeCallbackV3,
    options?:boolean|EventListenerOptions):void {
    if(!callbackObjects.has(callback))throw Error('BROWSER3_CALLBACK_REQUIRED')
    const capture=typeof options==='boolean'?options:options?.capture===true
    for(const row of listeners)if(row.target===target&&row.type===type
      &&row.callback.callbackId===callback.callbackId&&row.capture===capture&&!row.property) {
      target.removeEventListener(type,row.native,capture);listeners.delete(row)
    }
  }
  function attribute(target:Element,name:string,value:string,parsed=false,namespace?:string):void {
    const script=scriptAttributes.get(target)
    if(script) {
      if(name==='src'||name==='nonce')throw Error('BROWSER3_SCRIPT_RESOURCE_UNSUPPORTED')
      script.set(name,value)
      if(name==='type'||name==='language')return
    }
    if(target instanceof view.HTMLStyleElement&&name==='type'&&styleAttributes.has(target)) {
      styleAttributes.get(target)!.set(name,value)
      if(assemblingStyles.has(target))return
    }
    if(name==='style')value=css(value,parsed)
    else if(['src','href','xlink:href','poster','action','formaction','data'].includes(name))
      value=resourceUrl(value,name==='src'&&target instanceof view.HTMLImageElement)
    if(name==='src'&&(target instanceof view.HTMLImageElement||target instanceof view.HTMLMediaElement))target.crossOrigin='anonymous'
    if(!parsed) {
      const clean=cleanDisplayAttribute(target,name,value,displayPolicy)
      if(clean===null)throw Error('BROWSER3_DOM_ATTRIBUTE_UNSUPPORTED')
      value=clean
    }
    if(name==='src'&&(target instanceof view.HTMLImageElement||target instanceof view.HTMLMediaElement))beginLoad(target)
    if(name==='href'&&target instanceof view.HTMLLinkElement&&target.isConnected&&target.relList.contains('stylesheet'))beginLoad(target)
    if(namespace)target.setAttributeNS(namespace,name,value);else target.setAttribute(name,value)
  }
  function attributes(target:Element,values:readonly HtmlAttributeV1[]):void {
    for(const value of values) {
      // A parsed SCRIPT preserves its logical attributes while its native
      // execution MIME is fixed before any insertion or body text append.
      if(scriptAttributes.has(target)&&['src','nonce','type','language'].includes(value.name)) {
        scriptAttributes.get(target)!.set(value.name,value.value);continue
      }
      attribute(target,value.prefix?value.prefix+':'+value.name:value.name,value.value,true,value.namespace)
    }
  }
  function text(nodeId:number,start:number,end:number):string {
    const node=payloads.get(nodeId)!
    if(node.kind!=='text')throw Error('BROWSER3_TEXT_NODE_REQUIRED')
    const value=node.text.kind==='literal'?node.text.value:node.text.kind==='script'?
      plan.parsed.scripts.find(row=>row.inlineOrdinal===(node.text as {inlineOrdinal:number}).inlineOrdinal)!.javascript:
      plan.parsed.styles.find(row=>row.styleOrdinal===(node.text as {styleOrdinal:number}).styleOrdinal)!.css
    return value.slice(start,end)
  }
  function createNode(value:HtmlNodeCreationV1):Node {
    if(value.kind==='document')return doc
    if(value.kind==='fragment')return doc.createDocumentFragment()
    if(value.kind==='text') {
      const content=text(value.nodeId,value.textSpan.start,value.textSpan.end),payload=payloads.get(value.nodeId)!
      const node=doc.createTextNode(content)
      if(payload.kind==='text'&&payload.text.kind==='style'){parsedStyleText.set(node,content);node.data=css(content,true)}
      return node
    }
    if(value.kind==='comment')return doc.createComment(value.data)
    if(value.kind==='doctype')return doc.implementation.createDocumentType(value.name,value.publicId,value.systemId)
    let node:Element
    if(value.namespaceURI===HTML_NS&&value.tagName==='html'){node=shellHtml;logicalHtml=node}
    else if(value.namespaceURI===HTML_NS&&value.tagName==='head'){node=shellHead;logicalHead=node}
    else if(value.namespaceURI===HTML_NS&&value.tagName==='body'){node=shellBody;logicalBody=node}
    else node=doc.createElementNS(value.namespaceURI,value.tagName)
    if(value.tagName.toLowerCase()==='script') {
      scriptAttributes.set(node,new Map());node.setAttribute('type',inertScriptType)
    }
    if(node instanceof view.HTMLStyleElement) {
      const attrs=new Map(value.attributes.map(attribute=>[attribute.name,attribute.value]))
      styleAttributes.set(node,attrs);node.setAttribute('type',inertStyleType)
      assemblingStyles.set(node,sourceStyles.get(value.nodeId)?.css??'')
      if(sourceImportNodes.has(value.nodeId))importedStyles.add(node)
    }
    // Subscribe before assigning src/href or connecting a resource node.
    own(node,false)
    attributes(node,value.attributes);return node
  }
  function append(parent:Node,node:Node,reference:Node|null=null):void {
    if(node instanceof view.DocumentType)return
    // Shell html/head/body already exist. Reuse their exact nodes and leave
    // trusted bootstrap/CSP siblings private instead of resetting final trees.
    if(node.parentNode===parent&&[logicalHtml,logicalHead,logicalBody].includes(node as Element))return
    prepareInsertion(node);parent.insertBefore(node,reference)
    if(node instanceof view.HTMLStyleElement)activateStyle(node)
    if(parent instanceof view.HTMLStyleElement)activateStyle(parent)
    if(parent instanceof view.HTMLMediaElement&&node instanceof view.HTMLSourceElement)beginLoad(parent)
  }
  function apply(step:HtmlParserStepV1):void {
    if(step.kind==='create-node'){const node=createNode(step.node);nodes.set(step.node.nodeId,own(node,false));return}
    if(step.kind==='append-child'){append(nodes.get(step.parentId)!,nodes.get(step.nodeId)!);return}
    if(step.kind==='insert-before'){append(nodes.get(step.parentId)!,nodes.get(step.nodeId)!,nodes.get(step.referenceId)!);return}
    if(step.kind==='detach-node'){nodes.get(step.nodeId)!.parentNode?.removeChild(nodes.get(step.nodeId)!);return}
    if(step.kind==='append-text') {
      const node=nodes.get(step.nodeId)!,chunk=text(step.nodeId,step.textSpan.start,step.textSpan.end)
      const styleText=parsedStyleText.get(node as Text)
      if(styleText===undefined)(node as Text).appendData(chunk)
      else {
        const content=styleText+chunk;parsedStyleText.set(node as Text,content);(node as Text).data=css(content,true)
        if(node.parentNode instanceof view.HTMLStyleElement)activateStyle(node.parentNode)
      }
      return
    }
    if(step.kind==='adopt-attributes'){attributes(nodes.get(step.nodeId)! as Element,step.attributes);return}
    if(step.kind==='set-template-content') {
      const template=nodes.get(step.nodeId)! as HTMLTemplateElement,fragment=nodes.get(step.contentId)!
      for(const child of Array.from(fragment.childNodes))template.content.appendChild(child)
      ownedNodes.delete(fragment);nodes.set(step.contentId,template.content);ownedNodes.add(template.content);return
    }
    // Native document mode was selected by the trusted shell before bootstrap.
    // Doctype/mode replay is logical DATA and never replaces its CSP/head.
    if(step.kind==='set-doctype'||step.kind==='set-document-mode')return
    if(step.kind==='end-document'){ended=true;activatePrefixStyles();advanceReadiness()}
  }
  function read(target:any,kind:NativeHandleKindV3,key:string):NativeWireValueV3 {
    if(key.startsWith('on'))return propertyListeners.get(target)?.get(key.slice(2))?.callback??null
    if(kind==='document') {
      if(key==='documentElement')return encode(doc.documentElement)
      if(key==='head')return encode(doc.head)
      if(key==='body')return encode(doc.body)
      if(key==='readyState')return readyState
      if(key==='compatMode')return plan.parsed.document.mode==='quirks'?'BackCompat':'CSS1Compat'
      if(key==='baseURI')return doc.baseURI
      if(key==='defaultView')return {tag:'page-window',pageId}
      if(key==='activeElement')return encode(doc.activeElement)
      throw Error('BROWSER3_DOM_PROPERTY_UNSUPPORTED')
    }
    if(kind==='dataset')return encode(target[key])
    if(kind==='style') {
      const value=target[key]
      if(value!==null&&value!==undefined&&!['string','number','boolean'].includes(typeof value))
        throw Error('BROWSER3_DOM_PROPERTY_UNSUPPORTED')
      return encode(value)
    }
    if(kind==='canvas'&&canvasProperties.has(key))return encode(target[key])
    if(kind==='point'&&['x','y','z','w'].includes(key)||kind==='matrix'&&['a','b','c','d','e','f'].includes(key))return target[key]
    if(kind==='event'&&eventProperties.has(key)) {
      const value=target.snapshot?target.snapshot[key]:target[key]
      if((key==='touches'||key==='changedTouches')&&value!==undefined) {
        // TouchList/Touch fields live on native prototypes. Read their actual
        // finite interface, including the already owned target identity.
        return Array.from(value as TouchList).map(touch=>({tag:'record' as const,entries:{
          identifier:touch.identifier,target:encode(touch.target),clientX:touch.clientX,clientY:touch.clientY,
          pageX:touch.pageX,pageY:touch.pageY,screenX:touch.screenX,screenY:touch.screenY,
          radiusX:touch.radiusX,radiusY:touch.radiusY,rotationAngle:touch.rotationAngle,force:touch.force,
        }}))
      }
      return encode(value)
    }
    if(kind==='audio'&&mediaProperties.has(key))return encode(target[key])
    if(kind==='file'||kind==='blob') {
      if(['name','size','type','lastModified'].includes(key))return encode(target[key])
    }
    if(kind==='file-reader'&&['result','error','readyState'].includes(key))return encode(target[key])
    if(kind==='media-query'&&['matches','media'].includes(key))return target[key]
    if(kind==='viewport'&&['width','height','offsetTop','offsetLeft','scale'].includes(key))return target[key]
    if(kind!=='node')throw Error('BROWSER3_DOM_PROPERTY_UNSUPPORTED')
    if(key==='type'&&scriptAttributes.has(target))return scriptAttributes.get(target)!.get('type')??''
    if(key==='type'&&styleAttributes.has(target))return styleAttributes.get(target)!.get('type')??''
    if(key==='textContent')return ownedText(target)
    if(key==='style')return ref(target.style,'style')
    if(key==='dataset')return ref(target.dataset,'dataset')
    if(key==='classList')return ref(target.classList,'class-list')
    if(key==='ownerDocument')return documentHandle
    if(key==='innerHTML')return ownedHtml(target)
    if(key==='children'||key==='childNodes')return encode(Array.from(target[key]).filter(node=>visibleNode(node as Node)))
    if(key==='childElementCount')return Array.from(target.children).filter(node=>visibleNode(node as Node)).length
    if(key==='offsetParent')return encode(target.offsetParent)
    if(['firstChild','lastChild','nextSibling','previousSibling','nextElementSibling','parentNode','parentElement'].includes(key)) {
      let node=target[key]
      const skip=key==='firstChild'||key==='nextSibling'?'nextSibling'
        :key==='nextElementSibling'?'nextElementSibling':key==='lastChild'||key==='previousSibling'?'previousSibling':null
      while(node&&!visibleNode(node)&&skip)node=node[skip]
      return encode(node)
    }
    if(key==='content'&&target instanceof view.HTMLTemplateElement)return encode(target.content)
    if(nodeReads.has(key))return encode(target[key])
    throw Error('BROWSER3_DOM_PROPERTY_UNSUPPORTED')
  }
  function write(target:any,kind:NativeHandleKindV3,key:string,value:any):void {
    if(key.startsWith('on')) {
      const type=key.slice(2),group=propertyListeners.get(target)??new Map<string,NativeListener>()
      propertyListeners.set(target,group)
      const previous=group.get(type)
      if(previous){listeners.delete(previous);group.delete(type)}
      if(value&&callbackObjects.has(value))group.set(type,installListener(target,type,value,undefined,true))
      else {
        target[key]=null
        if(value!==null&&value!==undefined)throw Error('BROWSER3_DOM_HANDLER_REQUIRED')
      }
      return
    }
    if(kind==='style') {
      target[key]=typeof value==='string'?css(value):value
      resourceVersion++;advanceReadiness();return
    }
    if(kind==='dataset'){target[key]=value;return}
    if(kind==='canvas'&&canvasProperties.has(key)){target[key]=value;return}
    if(kind==='point'&&['x','y','z','w'].includes(key)){target[key]=value;return}
    if(kind==='audio'&&['src','currentTime','volume','loop','preload','muted','playbackRate'].includes(key)) {
      if(key==='src'&&String(value)==='') {
        target.removeAttribute('src')
        nativeLoads.get(target)!.pending=false
        resourceVersion++;advanceReadiness();return
      }
      const actual=key==='src'?resourceUrl(String(value)):value
      if(key==='src')beginLoad(target)
      target[key]=actual;return
    }
    if(kind!=='node')throw Error('BROWSER3_DOM_PROPERTY_UNSUPPORTED')
    if(key==='innerHTML'){setHtml(target,String(value));return}
    if(!nodeWrites.has(key))throw Error('BROWSER3_DOM_PROPERTY_UNSUPPORTED')
    if(scriptAttributes.has(target)&&key==='type'){scriptAttributes.get(target)!.set('type',String(value));return}
    if(styleAttributes.has(target)&&key==='type'){attribute(target,'type',String(value));return}
    if(key==='src') {
      if(!(target instanceof view.HTMLImageElement))throw Error('BROWSER3_MEDIA_TARGET_UNSUPPORTED')
      const url=resourceUrl(String(value),true)
      target.crossOrigin='anonymous';beginLoad(target);target.src=url;return
    }
    if(key==='textContent'&&target instanceof view.HTMLStyleElement)value=css(String(value))
    if(key==='textContent'&&target instanceof view.Element){replaceOwnedChildren(target,[own(doc.createTextNode(String(value)))]);return}
    target[key]=value
  }
  function call(target:any,kind:NativeHandleKindV3,method:string,args:any[]):NativeWireValueV3 {
    if(!BROWSER_NATIVE_METHODS_V3[kind].includes(method))throw Error('BROWSER3_DOM_METHOD_UNSUPPORTED')
    if(kind==='event')target=target.event??target
    if(method==='addEventListener')return installListener(target,args[0],args[1],args[2]).listenerId
    if(method==='removeEventListener'){removeListener(target,args[0],args[1],args[2]);return {tag:'undefined'}}
    if(kind==='document') {
      if(method==='createElement'||method==='createElementNS') {
        const namespace=method==='createElementNS'?String(args[0]):HTML_NS,tag=String(args[method==='createElementNS'?1:0])
        if(namespace===HTML_NS&&tag.toLowerCase()==='iframe'&&options.externalFrames)
          return options.externalFrames.create(doc,pageId,css)
        if(!(namespace===HTML_NS&&htmlTags.has(tag.toLowerCase())||namespace===SVG_NS&&svgTags.has(tag)))
          throw Error('BROWSER3_DOM_TAG_UNSUPPORTED')
        return encode(own(doc.createElementNS(namespace,tag)))
      }
      if(method==='createTextNode')return encode(own(doc.createTextNode(String(args[0]))))
      if(method==='createDocumentFragment')return encode(own(doc.createDocumentFragment()))
      if(method==='getElementById')return encode(Array.from(doc.querySelectorAll('[id]'))
        .find(node=>visibleNode(node)&&node.id===String(args[0]))??null)
      return encode(selected(doc,args[0],method==='querySelectorAll'))
    }
    if(method==='querySelector'||method==='querySelectorAll')return encode(selected(target,args[0],method==='querySelectorAll'))
    if(method==='getAttribute'&&scriptAttributes.has(target))return scriptAttributes.get(target)!.get(String(args[0]))??null
    if(method==='getAttribute'&&styleAttributes.has(target)&&args[0]==='type')return styleAttributes.get(target)!.get('type')??null
    if(method==='setAttribute'){attribute(target,String(args[0]),String(args[1]));return {tag:'undefined'}}
    if(method==='removeAttribute'&&scriptAttributes.has(target)) {
      scriptAttributes.get(target)!.delete(String(args[0]));if(args[0]!=='type')target.removeAttribute(args[0]);return {tag:'undefined'}
    }
    if(method==='removeAttribute'&&styleAttributes.has(target)&&args[0]==='type') {
      styleAttributes.get(target)!.delete('type')
      if(!assemblingStyles.has(target))target.removeAttribute('type')
      return {tag:'undefined'}
    }
    if(method==='setProperty') {
      target.setProperty(args[0],css(String(args[1])),args[2])
      resourceVersion++;advanceReadiness();return {tag:'undefined'}
    }
    if(method==='cloneNode')return encode(cloneOwned(target,args[0]===true))
    if(method==='replaceChildren') {
      replaceOwnedChildren(target,args.map(value=>typeof value==='string'?own(doc.createTextNode(value)):value))
      return {tag:'undefined'}
    }
    if(kind==='canvas'&&method==='measureText') {
      const measured:TextMetrics=target.measureText(...args),entries:Record<string,NativeWireValueV3>={}
      // Native TextMetrics exposes these fields through prototype getters.
      // Read the finite API fields, retaining only this browser's support.
      for(const key of textMetricFields)if(key in measured)entries[key]=measured[key]
      return {tag:'record',entries}
    }
    if(method==='getBoundingClientRect') {
      const rect=target.getBoundingClientRect()
      return encode({x:rect.x,y:rect.y,width:rect.width,height:rect.height,top:rect.top,right:rect.right,bottom:rect.bottom,left:rect.left})
    }
    if(method==='getContext'&&args[0]!=='2d')throw Error('BROWSER3_CANVAS_CONTEXT_UNSUPPORTED')
    if(['append','prepend','after','before','replaceWith'].includes(method))
      args=args.map(value=>value instanceof view.Node?value:own(doc.createTextNode(String(value))))
    if(['appendChild','insertBefore','replaceChild','append','prepend','after','before','replaceWith'].includes(method))
      for(const value of args)if(value instanceof view.Node)prepareInsertion(value)
    const result=target[method](...args)
    if(method==='removeChild'||method==='replaceChild')options.externalFrames?.removed(result)
    if(kind==='observer'&&method==='disconnect')mutationBindings.get(target)?.pending.splice(0)
    if(kind==='style'&&method==='removeProperty'
      ||['appendChild','insertBefore','replaceChild','append','prepend','after','before','replaceWith','remove','removeChild'].includes(method)) {
      resourceVersion++;advanceReadiness()
    }
    // These actual method owners return native Promises even when the value
    // belongs to another realm. Promise instanceof/ordinary .then fields do
    // not decide whether arbitrary author DATA is a native pending operation.
    if((kind==='file'||kind==='blob')&&method==='text'||kind==='audio'&&method==='play'
      ||kind==='node'&&method==='decode')return promise(result)
    if(method==='toDataURL'){generatedMedia.add(result);return result}
    if(method==='getContext')return result?ref(result,'canvas'):null
    if(method==='createLinearGradient'||method==='createRadialGradient')return ref(result,'gradient')
    if(method==='createSVGPoint'||method==='matrixTransform')return ref(result,'point')
    if(method==='getScreenCTM'||method==='getTransform'||method==='inverse')return result?ref(result,'matrix'):null
    return encode(result)
  }
  function create(creation:NativeCreateV3):NativeWireValueV3 {
    if(creation.kind==='image')return encode(own(new view.Image()))
    if(creation.kind==='audio') {
      const audio=new view.Audio();audio.crossOrigin='anonymous';own(audio)
      if(creation.source!==undefined){const url=resourceUrl(creation.source);beginLoad(audio);audio.src=url}
      return ref(audio,'audio')
    }
    if(creation.kind==='event'||creation.kind==='custom-event'||creation.kind==='mouse-event') {
      const options=decode(creation.options??{tag:'record',entries:{}})
      const event=creation.kind==='event'?new view.Event(creation.type,options)
        :creation.kind==='custom-event'?new view.CustomEvent(creation.type,options):new view.MouseEvent(creation.type,options)
      return ref(event,'event')
    }
    if(creation.kind==='file-reader'){const reader=new view.FileReader();fileReaders.add(reader);return ref(reader,'file-reader')}
    if(creation.kind==='blob') {
      if(!['application/json','text/plain','text/plain;charset=utf-8','image/png'].includes(creation.mime))
        throw Error('BROWSER3_BLOB_MIME_UNSUPPORTED')
      return ref(new view.Blob(creation.parts.map(decode),{type:creation.mime}),'blob')
    }
    const callback=retainCallback(creation.callback)
    const observer:MutationObserver|ResizeObserver=creation.kind==='mutation-observer'?new view.MutationObserver((records,nativeObserver)=>{
      const pending=mutationBindings.get(observer as MutationObserver)!.pending.splice(0)
      mutationDelivery(callback,[...pending,...records],nativeObserver)
    }):new view.ResizeObserver((records,nativeObserver)=>fire(callback,[records.map(record=>({
      target:record.target,contentRect:{x:record.contentRect.x,y:record.contentRect.y,width:record.contentRect.width,
        height:record.contentRect.height,top:record.contentRect.top,right:record.contentRect.right,
        bottom:record.contentRect.bottom,left:record.contentRect.left},
      borderBoxSize:Array.from(record.borderBoxSize).map(size=>({inlineSize:size.inlineSize,blockSize:size.blockSize})),
      contentBoxSize:Array.from(record.contentBoxSize).map(size=>({inlineSize:size.inlineSize,blockSize:size.blockSize})),
    })),nativeObserver],'observer',undefined,nativeObserver))
    observers.add(observer)
    if(creation.kind==='mutation-observer')mutationBindings.set(observer as MutationObserver,{callback,pending:[]})
    return ref(observer,'observer')
  }
  function resources() {
    return {handles:handles.size,nodes:ownedNodes.size,listeners:listeners.size,timers:timers.size,observers:observers.size,
      media:media.size,fileReaders:fileReaders.size,objectURLs:objectURLs.size,pendingPromises:pendingPromises.size,
      pendingLoads:[...nativeLoads.values()].filter(load=>load.pending).length,readinessWaiters:readinessWaiters.size}
  }
  const preventNavigation=(event:Event)=>{
    if(event.type==='submit'||event.composedPath().some(node=>node instanceof view.HTMLAnchorElement))event.preventDefault()
  }
  options.externalFrames?.registerDocument?.(documentHandle,node=>encode(node))
  doc.addEventListener('submit',preventNavigation,true);doc.addEventListener('click',preventNavigation,true)
  if(options.carrierScript) {
    logicalHtml=own(shellHtml,false) as Element
    logicalHead=own(doc.createElement('head')) as Element
    logicalBody=own(doc.createElement('body')) as Element
    shellHtml.append(logicalHead,logicalBody)
    const script=doc.createElement('script')
    script.setAttribute('type','text/javascript');script.dataset.authorIdentity=options.carrierScript.identity
    script.textContent=options.carrierScript.javascript
    own(script);logicalHead.appendChild(script)
    options.carrierScript.captured(ref(script,'node'));ended=true
  }
  const renderer:BrowserPageRendererV3={
    getDocumentHandle:()=>documentHandle,
    getParsedNodeHandle(nodeId){
      const node=nodes.get(nodeId)
      if(!node)throw Error('BROWSER3_PARSED_NODE_UNAVAILABLE')
      return encode(node) as NativeHandleV3
    },
    applyUntil(exclusiveEnd) {
      if(!active)throw Error('BROWSER3_PAGE_CLOSED')
      while(nextStep<exclusiveEnd&&nextStep<plan.parsed.steps.length) {
        const step=plan.parsed.steps[nextStep++]!
        if(step.kind==='script-boundary') {
          activatePrefixStyles()
          return {nextStep,boundary:{nodeId:step.nodeId,inlineOrdinal:step.inlineOrdinal},ended}
        }
        apply(step)
      }
      return {nextStep,boundary:null,ended}
    },
    setDocumentState(state){readyState=state},awaitResourcesReady,resources,
    requestReply(request):NativeReplyV3 {
      const previous=callbackBatch,callbacks:NativeCallbackDeliveryV3[]=[]
      callbackBatch=callbacks
      try {
        const value=renderer.request(request)
        return {value,...callbacks.length?{callbacks}:{}}
      }finally {callbackBatch=previous}
    },
    request(request:NativeRequestV3):NativeWireValueV3 {
      if(!active)throw Error('BROWSER3_PAGE_CLOSED')
      if('target' in request&&request.target.handle<0&&options.externalFrames)
        return options.externalFrames.request(request,css)
      if(request.op==='get'){const target=owned(request.target);return read(target.value,target.kind,request.key)}
      if(request.op==='set'){const target=owned(request.target);write(target.value,target.kind,request.key,decode(request.value));return {tag:'undefined'}}
      if(request.op==='call'){const target=owned(request.target);return call(target.value,target.kind,request.method,request.args.map(decode))}
      if(request.op==='create')return create(request.creation)
      if(request.op==='timer') {
        const timerId=++nextResource,callback=retainCallback(request.callback)
        const fireTimer=(time?:number)=>{
          if(request.mode!=='interval')timers.delete(timerId)
          fire(callback,time===undefined?[]:[time],request.mode==='raf'?'raf':'timer',undefined,view)
        }
        const native=request.mode==='raf'?scheduler.requestAnimationFrame(fireTimer):request.mode==='interval'?
          scheduler.setInterval(fireTimer,request.delay):scheduler.setTimeout(fireTimer,request.delay)
        timers.set(timerId,{native,mode:request.mode});return timerId
      }
      if(request.op==='clear-timer') {
        const timer=timers.get(request.timerId)
        if(timer) {
          if(timer.mode==='raf')scheduler.cancelAnimationFrame(timer.native)
          else scheduler.clearInterval(timer.native)
          timers.delete(request.timerId)
        }
        return {tag:'undefined'}
      }
      if(request.op==='consume-listener')return request.listenerId<0
        ?options.externalFrames?.consumeListener?.(request.listenerId)??false:consumeListener(request.listenerId)
      if(request.op==='window-listen') {
        return installListener(view,request.type,retainCallback(request.callback),decode(request.options??{tag:'undefined'})).listenerId
      }
      if(request.op==='window-unlisten') {
        removeListener(view,request.type,retainCallback(request.callback),decode(request.options??{tag:'undefined'}))
        return {tag:'undefined'}
      }
      if(request.op==='window-dispatch')return view.dispatchEvent(owned(request.event).value)
      if(request.op==='window-read') {
        if(request.key==='visualViewport')return view.visualViewport?ref(view.visualViewport,'viewport'):null
        if(request.key==='navigator')return {tag:'record',entries:{userAgent:encode(view.navigator.userAgent),
          platform:encode(view.navigator.platform),maxTouchPoints:encode(view.navigator.maxTouchPoints)}}
        return request.key==='performance-now'?view.performance.now():view[request.key]
      }
      if(request.op==='computed-style')return ref(view.getComputedStyle(owned(request.target).value),'style')
      if(request.op==='match-media')return ref(view.matchMedia(request.query),'media-query')
      if(request.op==='object-url') {
        const target=owned(request.target)
        if(target.kind!=='file'&&target.kind!=='blob')throw Error('BROWSER3_BLOB_HANDLE_REQUIRED')
        const url=view.URL.createObjectURL(target.value);objectURLs.add(url);return url
      }
      if(objectURLs.delete(request.url))view.URL.revokeObjectURL(request.url)
      return {tag:'undefined'}
    },
    dispose() {
      if(disposal)return disposal
      active=false
      for(const waiter of [...readinessWaiters])finishReadiness(waiter,Error('BROWSER3_PAGE_CLOSED'))
      for(const load of nativeLoads.values())for(const type of load.events)load.target.removeEventListener(type,load.listener)
      nativeLoads.clear();assemblingStyles.clear()
      for(const {native,mode} of timers.values()) {
        if(mode==='raf')scheduler.cancelAnimationFrame(native)
        else scheduler.clearInterval(native)
      }
      timers.clear()
      for(const observer of observers)observer.disconnect();observers.clear()
      mutationBindings.clear()
      options.externalFrames?.disposeDocument(doc)
      for(const listener of listeners) {
        if(listener.property)(listener.target as any)['on'+listener.type]=null
        else listener.target.removeEventListener(listener.type,listener.native,listener.capture)
      }
      listeners.clear()
      for(const value of media) {
        if(value instanceof view.HTMLMediaElement)value.pause()
        value.removeAttribute('src')
      }
      media.clear()
      for(const reader of fileReaders)if(reader.readyState===view.FileReader.LOADING)reader.abort()
      fileReaders.clear()
      for(const url of objectURLs)view.URL.revokeObjectURL(url);objectURLs.clear();generatedMedia.clear();resolvedResources.clear()
      for(const id of [...pendingPromises])settlePromise(id,{kind:'rejected',error:'BROWSER3_PAGE_CLOSED'})
      for(const node of ownedNodes)if(node!==doc&&node!==logicalHtml&&node!==logicalHead&&node!==logicalBody)node.parentNode?.removeChild(node)
      ownedNodes.clear();nodes.clear();handles.clear();callbackReferences.clear()
      if(shellHtml.parentNode!==doc)doc.appendChild(shellHtml)
      shellHtml.append(shellHead,shellBody);shellHead.appendChild(trustedHead);shellBody.appendChild(trustedBody)
      doc.removeEventListener('submit',preventNavigation,true);doc.removeEventListener('click',preventNavigation,true)
      disposal=Promise.resolve(resources());return disposal
    },
  }
  return renderer
}
