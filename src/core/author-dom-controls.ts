/** Owns Source DOM control discovery and one finite primary-press transaction.
 * Serialized into the isolated parent shell, with no Main or Core references. */
export function createAuthorDomControls(publish:(controls:{id:string;label:string;disabled:boolean}[])=>void) {
  const controls=new Map<Element,string>(),elements=new Map<string,Element>()
  const descriptions=new Map<string,{id:string;label:string;disabled:boolean}>()
  const shadowRoots=new Set<ShadowRoot>()
  let active=true
  const listenerFacts=new WeakMap<Element,{type:string;callback:EventListenerOrEventListenerObject;capture:boolean;
    effective:EventListenerOrEventListenerObject;abort?:()=>void;signal?:AbortSignal}[]>()
  // Detached child documents may disappear while the Source scene stays alive.
  // Adoption keeps its native subscription, without retaining that child signal.
  const abortSubscriptions=new Map<()=>void,WeakRef<AbortSignal>>()
  const actionTypes=new Set(['click','pointerdown','pointerup','mousedown','mouseup'])
  const interactive=(element:Element)=>{
    if(semanticControl(element)||listenerFacts.get(element)?.length)return true
    for(const type of actionTypes)if(typeof (element as any)['on'+type]==='function'||element.hasAttribute('on'+type))return true
    return false
  }
  let observer:MutationObserver
  const observation={subtree:true,childList:true,characterData:true,attributes:true}
  const composedParent=(element:Element):Element|null=>element.assignedSlot??element.parentElement
    ??(element.getRootNode() as ShadowRoot).host??null
  const owned=(element:Element)=>{
    if(!element.isConnected||element.ownerDocument!==document)return false
    let root=element.getRootNode()
    while(root.nodeType===11){
      if(!shadowRoots.has(root as ShadowRoot))return false
      root=(root as ShadowRoot).host.getRootNode()
    }
    return root===document
  }
  const semanticControl=(element:Element)=>element.getAttribute('role')==='button'
    ||element.localName==='button'&&element.namespaceURI==='http://www.w3.org/1999/xhtml'
  const flatText=(node:Node):string=>{
    if(node.nodeType===3)return node.textContent??''
    if(node.nodeType!==1)return ''
    const element=node as Element
    if(element.localName==='img')return element.getAttribute('alt')??''
    const slot=element as HTMLSlotElement,assigned=element.localName==='slot'?slot.assignedNodes({flatten:true}):[]
    const children=element.localName==='slot'&&assigned.length?assigned:element.shadowRoot?.childNodes??node.childNodes
    return [...children].map(flatText).join('')
  }
  let controlSnapshot:{id:string;label:string;disabled:boolean}[]=[]
  const describe=(element:Element)=>{
    if(!interactive(element)||!owned(element))return
    let fixed=false,disabled=false
    for(let node:Element|null=element;node;node=composedParent(node)){
      if(node.matches('dialog,[role="dialog"],[role="alertdialog"],[aria-modal="true"]'))return
      const style=getComputedStyle(node)
      if(node.hasAttribute('hidden')||node.hasAttribute('inert')||node.getAttribute('aria-hidden')==='true'
        ||style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return
      if(style.position==='fixed')fixed=true
      if(node.getAttribute('aria-disabled')==='true')disabled=true
    }
    if(!fixed||!element.getClientRects().length)return
    const scope=element.getRootNode() as Document|ShadowRoot
    const labelled=element.getAttribute('aria-labelledby')?.split(/\s+/)
      .map(id=>{const label=scope.getElementById(id);return label?flatText(label):''}).join(' ').trim()
    const label=labelled||element.getAttribute('aria-label')?.trim()||flatText(element).trim()||element.getAttribute('title')?.trim()
    if(!label)return
    return {label,disabled:disabled||element.matches(':disabled')}
  }
  const publishControls=()=>{
    const next=[...descriptions.values()].filter(row=>!preferDescendant(elements.get(row.id)!))
    if(next.length===controlSnapshot.length&&next.every((row,index)=>{
      const old=controlSnapshot[index]!
      return row.id===old.id&&row.label===old.label&&row.disabled===old.disabled
    }))return
    controlSnapshot=next;publish(next)
  }
  const changedControls=new Set<Element>()
  const ancestorControls=new Map<Element,Set<Element>>(),controlAncestors=new Map<Element,Element[]>()
  const trackAncestors=(element:Element)=>{
    const next:Element[]=[]
    if(owned(element)&&interactive(element))for(let node:Element|null=element;node;node=composedParent(node))next.push(node)
    const previous=controlAncestors.get(element)??[]
    if(next.length===previous.length&&next.every((node,index)=>node===previous[index]))return
    for(const node of previous){
      const dependents=ancestorControls.get(node)!
      dependents.delete(element);if(!dependents.size)ancestorControls.delete(node)
    }
    if(!next.length){controlAncestors.delete(element);return}
    controlAncestors.set(element,next)
    for(const node of next){
      let dependents=ancestorControls.get(node)
      if(!dependents){dependents=new Set();ancestorControls.set(node,dependents)}
      dependents.add(element)
    }
  }
  const changedDescendants=(element:Element)=>{for(const control of ancestorControls.get(element)??[])changedControls.add(control)}
  const preferDescendant=(element:Element)=>{
    if(semanticControl(element))return false
    for(const descendant of ancestorControls.get(element)??[]){
      const value=descriptions.get(controls.get(descendant)!)
      if(descendant!==element&&value&&!value.disabled)return true
    }
    return false
  }
  const labelReferences=new Map<string,Set<Element>>(),controlLabels=new Map<Element,string>()
  const trackLabels=(element:Element)=>{
    const previous=controlLabels.get(element)??'',next=owned(element)&&interactive(element)
      ?element.getAttribute('aria-labelledby')?.trim()??'':''
    if(previous===next)return
    for(const id of previous.split(/\s+/)){
      const dependents=labelReferences.get(id)
      dependents?.delete(element)
      if(!dependents?.size)labelReferences.delete(id)
    }
    controlLabels.delete(element)
    if(next){
      controlLabels.set(element,next)
      for(const id of next.split(/\s+/)){
        let dependents=labelReferences.get(id)
        if(!dependents){dependents=new Set();labelReferences.set(id,dependents)}
        dependents.add(element)
      }
    }
  }
  const labelChanged=(element:Element)=>{
    for(let node:Element|null=element;node;node=composedParent(node))
      for(const control of labelReferences.get(node.id)??[])changedControls.add(control)
  }
  const changedLabelSubtree=(node:Node)=>{
    if(node.nodeType!==1||!labelReferences.size)return
    const element=node as Element
    labelChanged(element)
    for(const label of element.querySelectorAll('[id]'))labelChanged(label)
  }
  const register=(element:Element)=>{
    if(!controls.has(element)){
      if(!owned(element)||!interactive(element))return
      const id=crypto.randomUUID();controls.set(element,id);elements.set(id,element)
    }
    changedControls.add(element)
  }
  const discover=(node:Node)=>{
    if(node.nodeType!==1&&node.nodeType!==11)return false
    const root=node as Element|ShadowRoot
    let stylesheet=false
    const visit=(element:Element)=>{
      if(element.matches('style,link'))stylesheet=true
      register(element)
      const shadow=element.shadowRoot
      if(shadow&&owned(element)&&!shadowRoots.has(shadow)){
        shadowRoots.add(shadow);observer.observe(shadow,observation);shadow.addEventListener('slotchange',slotChanged);discover(shadow)
      }else if(shadow)for(const control of controls.keys())if(control.getRootNode()===shadow)changedControls.add(control)
    }
    if(node.nodeType===1)visit(root as Element)
    for(const element of root.querySelectorAll('*'))visit(element)
    return stylesheet
  }
  const slotChanged=(event:Event)=>{
    const target=event.target as Element
    changedDescendants((target.getRootNode() as ShadowRoot).host)
    for(let node:Element|null=target;node;node=composedParent(node))if(interactive(node)){register(node);break}
    labelChanged(target);refreshControls()
  }
  const refreshControls=()=>{
    if(!active)return
    let changed=false
    for(const element of changedControls){
      trackLabels(element);trackAncestors(element)
      const id=controls.get(element)!,previous=descriptions.get(id),value=interactive(element)?describe(element):undefined
      if(!owned(element)||!interactive(element)){
        controls.delete(element);elements.delete(id)
      }
      if(value){
        if(!previous||previous.label!==value.label||previous.disabled!==value.disabled){
          descriptions.set(id,{id,...value});changed=true
        }
      }else if(descriptions.delete(id))changed=true
    }
    changedControls.clear()
    if(changed)publishControls()
  }
  observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='childList'){
        let stylesheet=false
        for(const node of record.addedNodes){stylesheet=discover(node)||stylesheet;changedLabelSubtree(node)}
        for(const node of record.removedNodes){
          changedLabelSubtree(node)
          if(node.nodeType===1&&((node as Element).matches('style,link')||(node as Element).querySelector('style,link')))stylesheet=true
        }
        if(stylesheet)
          for(const element of controls.keys())changedControls.add(element)
      }
      const target=record.target.nodeType===1?record.target as Element
        :record.target.nodeType===11?(record.target as ShadowRoot).host:record.target.parentElement
      if(!target)continue
      for(let node:Element|null=target;node;node=composedParent(node))if(interactive(node)){register(node);break}
      if(record.type==='attributes'){
        register(target)
        changedDescendants(target)
      }
      if(target.shadowRoot)changedDescendants(target)
      labelChanged(target)
      // Renaming a label can remove its former binding as well as add a new one.
      if(record.type==='attributes'&&record.attributeName==='id')
        for(const dependents of labelReferences.values())for(const element of dependents)changedControls.add(element)
      // Stylesheets can change fixed positioning outside their own subtree.
      if(target.closest('style')||target.tagName==='LINK')
        for(const element of controls.keys())changedControls.add(element)
    }
    const removedElements=records.some(record=>record.type==='childList'&&[...record.removedNodes].some(node=>node.nodeType===1))
    if(removedElements)for(const element of controls.keys())if(!owned(element))changedControls.add(element)
    const retired=removedElements?[...shadowRoots].filter(root=>!owned(root.host)):[]
    if(retired.length){
      for(const root of retired){shadowRoots.delete(root);root.removeEventListener('slotchange',slotChanged)}
      observer.disconnect();observer.observe(document.documentElement,observation)
      for(const root of shadowRoots)observer.observe(root,observation)
    }
    refreshControls()
  })
  observer.observe(document.documentElement,observation)
  discover(document.documentElement);refreshControls()
  const eventChanged=(element:Element)=>{if(active&&(controls.has(element)||owned(element))){register(element);refreshControls()}}
  type ListenerFact=NonNullable<ReturnType<typeof listenerFacts.get>>[number]
  const retire=(element:Element,fact:ListenerFact)=>{
    const facts=listenerFacts.get(element)
    if(!facts?.includes(fact))return
    facts.splice(facts.indexOf(fact),1)
    if(!facts.length)listenerFacts.delete(element)
    if(fact.abort){fact.signal!.removeEventListener('abort',fact.abort);abortSubscriptions.delete(fact.abort)}
    eventChanged(element)
  }
  let pointerSequence=-2147483648
  let press:{id:number;down:boolean;x:number;y:number;pending?:Element;capture?:Element}|undefined
  const pointerEvent=(type:string,cancelable=true)=>new PointerEvent(type,{
    bubbles:true,composed:true,cancelable,pointerId:press!.id,pointerType:'mouse',isPrimary:true,
    button:0,buttons:press!.down?1:0,clientX:press!.x,clientY:press!.y,view:window,detail:type==='click'?1:0})
  const processCapture=()=>{
    const current=press!
    const previous=current.capture,next=current.pending
    if(previous===next)return
    current.capture=next
    if(previous)previous.dispatchEvent(pointerEvent('lostpointercapture',false))
    if(next)next.dispatchEvent(pointerEvent('gotpointercapture',false))
  }
  const activate=(id:string)=>{
    const element=elements.get(id),value=element&&describe(element)
    if(!value||preferDescendant(element!))return 'AUTHOR_CONTROL_UNAVAILABLE'
    if(value.disabled)return 'AUTHOR_CONTROL_DISABLED'
    const rect=element!.getBoundingClientRect()
    press={id:pointerSequence++,down:true,x:rect.left+rect.width/2,y:rect.top+rect.height/2}
    const mouse=(type:string,target:Element)=>target.dispatchEvent(new MouseEvent(type,{
      bubbles:true,composed:true,cancelable:true,button:0,buttons:press!.down?1:0,
      clientX:press!.x,clientY:press!.y,view:window,detail:1}))
    try{
      const compatibility=element!.dispatchEvent(pointerEvent('pointerdown'))
      if(compatibility)mouse('mousedown',element!)
      processCapture()
      const released=press.capture??element!
      press.down=false
      released.dispatchEvent(pointerEvent('pointerup'))
      if(compatibility)mouse('mouseup',released)
      // Capture at pointerup determines click even after implicit release.
      let clicked:Element|null=released
      if(!press.capture)while(clicked&&!clicked.contains(element!))clicked=composedParent(clicked)
      press.pending=undefined;processCapture()
      if(clicked?.isConnected)clicked.dispatchEvent(pointerEvent('click'))
      return undefined
    }finally{
      press.pending=undefined;processCapture();press=undefined
    }
  }
  const realmHooks=new Map<object,()=>void>()
  const hookRealm=(view:Window)=>{
    const realm=view as Window&typeof globalThis,restores:(()=>void)[]=[]
    if(realmHooks.has(realm.Element.prototype))return
    const patch=(prototype:object,name:string,value:unknown)=>{
      const descriptor=Object.getOwnPropertyDescriptor(prototype,name)!
      Object.defineProperty(prototype,name,{...descriptor,value})
      restores.push(()=>{
        if(Object.getOwnPropertyDescriptor(prototype,name)?.value===value)Object.defineProperty(prototype,name,descriptor)
      })
      return descriptor.value
    }
    const eventPrototype=realm.EventTarget.prototype
    const nativeAdd=eventPrototype.addEventListener,nativeRemove=eventPrototype.removeEventListener
    patch(eventPrototype,'addEventListener',function(this:EventTarget,type:string,callback:EventListenerOrEventListenerObject|null,
      options?:boolean|AddEventListenerOptions){
      'use strict'
      // A bare global addEventListener call must retain this child Window.
      // A non-strict wrapper created in the parent would default to the parent.
      const target=this===undefined?view:this
      if(!callback||(target as Node).nodeType!==1||!actionTypes.has(type))return nativeAdd.call(target,type,callback,options)
      const element=target as Element
      // Read WebIDL option getters once. Browser registration remains authoritative.
      const config=options!==null&&(typeof options==='object'||typeof options==='function')?{
        capture:!!options.capture,once:!!options.once,
        passive:options.passive,signal:options.signal}:!!options
      const capture=typeof config==='boolean'?config:!!config?.capture
      const previous=listenerFacts.get(element)?.find(fact=>fact.type===type&&fact.callback===callback&&fact.capture===capture)
      if(previous)return nativeAdd.call(target,type,previous.effective,config)
      const fact:ListenerFact={type,callback,capture,effective:callback}
      if(typeof config==='object'&&config.once)fact.effective=function(this:EventTarget,event:Event){
        retire(element,fact)
        if(typeof callback==='function')callback.call(this,event)
        else callback.handleEvent(event)
      }
      nativeAdd.call(target,type,fact.effective,config)
      if(typeof config==='object'&&config.signal?.aborted)return
      const facts=listenerFacts.get(element)??[]
      facts.push(fact);listenerFacts.set(element,facts)
      if(typeof config==='object'&&config.signal){
        // Native abort propagation survives a child realm's navigation. A JS
        // listener on that retired child's signal no longer receives events.
        fact.signal=AbortSignal.any([config.signal])
        const target=new WeakRef(element),registration=new WeakRef(fact)
        fact.abort=()=>{const node=target.deref(),record=registration.deref();if(node&&record)retire(node,record)}
        fact.signal.addEventListener('abort',fact.abort,{once:true});abortSubscriptions.set(fact.abort,new WeakRef(fact.signal))
      }
      eventChanged(element)
    })
    patch(eventPrototype,'removeEventListener',function(this:EventTarget,type:string,callback:EventListenerOrEventListenerObject|null,
      options?:boolean|EventListenerOptions){
      'use strict'
      const target=this===undefined?view:this
      if((target as Node).nodeType!==1||!actionTypes.has(type))return nativeRemove.call(target,type,callback,options)
      const capture=typeof options==='object'||typeof options==='function'?!!options?.capture:!!options,element=target as Element
      const fact=listenerFacts.get(element)?.find(value=>value.type===type&&value.callback===callback&&value.capture===capture)
      nativeRemove.call(target,type,fact?.effective??callback,capture)
      if(fact)retire(element,fact)
    })
    for(const prototype of [realm.HTMLElement.prototype,realm.SVGElement.prototype])for(const type of actionTypes){
      const name='on'+type,descriptor=Object.getOwnPropertyDescriptor(prototype,name)
      if(!descriptor?.set)continue
      const setter=function(this:Element,value:unknown){descriptor.set!.call(this,value);eventChanged(this)}
      Object.defineProperty(prototype,name,{...descriptor,set:setter})
      restores.push(()=>{
        if(Object.getOwnPropertyDescriptor(prototype,name)?.set===setter)Object.defineProperty(prototype,name,descriptor)
      })
    }
    const elementPrototype=realm.Element.prototype,nativeAttach=elementPrototype.attachShadow
    patch(elementPrototype,'attachShadow',function(this:Element,options:ShadowRootInit){
      const root=nativeAttach.call(this,options)
      if(owned(this)){
        changedDescendants(this)
        if(root.mode==='open'){
          shadowRoots.add(root);observer.observe(root,observation);root.addEventListener('slotchange',slotChanged)
          discover(root)
        }
        register(this);labelChanged(this);refreshControls()
      }
      return root
    })
    const nativeSet=elementPrototype.setPointerCapture,nativeRelease=elementPrototype.releasePointerCapture,
      nativeHas=elementPrototype.hasPointerCapture
    patch(elementPrototype,'setPointerCapture',function(this:Element,id:number){
      if(!press||press.id!==id)return nativeSet.call(this,id)
      if(!this.isConnected)throw new DOMException('The capture target is disconnected','InvalidStateError')
      if(press.down)press.pending=this
    })
    patch(elementPrototype,'releasePointerCapture',function(this:Element,id:number){
      if(!press||press.id!==id)return nativeRelease.call(this,id)
      if(press.pending===this)press.pending=undefined
    })
    patch(elementPrototype,'hasPointerCapture',function(this:Element,id:number){
      return press?.id===id?press.pending===this:nativeHas.call(this,id)
    })
    realmHooks.set(elementPrototype,()=>{for(const restore of restores.reverse())restore()})
  }
  hookRealm(window)
  const frames=new Map<string,()=>void>(),frameSync=new Map<HTMLIFrameElement,()=>void>()
  const releaseFrame=(id:string)=>{frames.get(id)?.();frames.delete(id)}
  const watchFrame=(id:string,frame:HTMLIFrameElement)=>{
    releaseFrame(id)
    let prototype:object|undefined
    const sync=()=>{
      const view=frame.contentDocument?.defaultView
      const next=view?(view as Window&typeof globalThis).Element.prototype:undefined
      if(next===prototype)return
      if(prototype){realmHooks.get(prototype)?.();realmHooks.delete(prototype)}
      prototype=next
      if(view)hookRealm(view)
    }
    frameSync.set(frame,sync);frame.addEventListener('load',sync)
    frames.set(id,()=>{
      frameSync.delete(frame);frame.removeEventListener('load',sync)
      if(prototype){realmHooks.get(prototype)?.();realmHooks.delete(prototype)}
    })
  }
  // Native bootstrap sends this synchronously before any inline author Source.
  const earlyRealm=(event:Event)=>frameSync.get((event as CustomEvent).detail)?.()
  addEventListener('nexttavern-author-realm-ready',earlyRealm)
  const dispose=()=>{
    active=false;observer.disconnect();removeEventListener('nexttavern-author-realm-ready',earlyRealm)
    if(press){press.pending=undefined;processCapture();press=undefined}
    for(const [listener,signal] of abortSubscriptions)signal.deref()?.removeEventListener('abort',listener)
    abortSubscriptions.clear();controls.clear();elements.clear();descriptions.clear();changedControls.clear()
    labelReferences.clear();controlLabels.clear();ancestorControls.clear();controlAncestors.clear()
    for(const root of shadowRoots)root.removeEventListener('slotchange',slotChanged)
    shadowRoots.clear();controlSnapshot=[]
    for(const release of frames.values())release();frames.clear()
    for(const restore of realmHooks.values())restore();realmHooks.clear()
  }
  return {activate,watchFrame,releaseFrame,dispose}
}
