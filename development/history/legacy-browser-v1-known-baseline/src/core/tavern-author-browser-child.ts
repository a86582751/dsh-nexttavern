/** Actual opaque-realm implementation, bundled by the owned producer. Its
 * snapshots and numerical save results must arrive through the real parent
 * port. Missing data never becomes a fabricated ready/empty snapshot. */
import {BrowserBudgetError,BrowserBudgetV1,freezeBrowserSnapshot,
  quantifyBrowserTransport} from './tavern-author-browser-budget.js'
import type {BrowserBindingV1,BrowserProgramV1,BrowserRenderV1,BrowserRuntimeIdentityV1,
  BrowserSaveReplyV1,BrowserSnapshotV1} from './tavern-author-browser-types.mjs'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuPlayerEditExpected,MvuPlayerEditResponse} from './roleplay-mvu-player-types.js'
import type {MvuVariableReadOption} from './tavern-mvu-scope-read-types.js'

interface ChildConfig {nonce:string;binding:BrowserBindingV1;runtime:BrowserRuntimeIdentityV1}
interface ElementFacade {
  id:string;className:string;textContent:string|null;disabled?:boolean
  append(...nodes:(ElementFacade|string)[]):void
  querySelector(selector:string):ElementFacade|null
  setAttribute(name:string,value:string):void
  addEventListener(type:string,listener:(event:{preventDefault():void;stopPropagation():void})=>unknown):void
  removeEventListener(type:string,listener:(event:{preventDefault():void;stopPropagation():void})=>unknown):void
}
function runtimeError(code:string):never {throw new BrowserBudgetError(code)}
const errorCode=(error:unknown)=>error instanceof BrowserBudgetError?error.code:'BROWSER_AUTHOR_ERROR'

export function startBrowserRuntimeV1(config:ChildConfig):void {
  if(!document.body||!config?.nonce||!config.binding?.generation||!config.runtime?.implementationSha256) {
    runtimeError('BROWSER_RUNTIME_CONFIGURATION_MISSING')
  }
  const authorRoot=document.createElement('div'),messageRoot=document.createElement('div'),sheet=document.createElement('style')
  authorRoot.className='owned-author-root';messageRoot.className='owned-trusted-message-root'
  document.body.append(sheet,messageRoot,authorRoot)
  const budget=new BrowserBudgetV1(),nativeNodes=new WeakMap<ElementFacade,HTMLElement>(),facades=new WeakMap<HTMLElement,ElementFacade>()
  const listenerDisposers=new Set<()=>void>(),pending=new Map<number,{
    resolve(value:MvuPlayerEditResponse):void;reject(reason:Error):void;readRevision:number}>()
  let port:MessagePort|null=null,snapshot:BrowserSnapshotV1|undefined,started=false,starting=false,active=true
  let sent=0,requestId=0,renderRevision=0,unknownRequest:number|undefined
  const send=(type:string,data:Record<string,unknown>={})=>{
    if(active&&port)port.postMessage({v:2,nonce:config.nonce,generation:config.binding.generation,
      browserSessionId:config.binding.browserSessionId,sequence:++sent,type,...data})
  }
  const installSnapshot=(next:BrowserSnapshotV1)=>{
    if(next.generation!==config.binding.generation||next.basis.sessionId!==config.binding.sessionId
      ||!Number.isSafeInteger(next.readRevision)||next.readRevision<1
      ||snapshot&&next.readRevision<snapshot.readRevision)runtimeError('BROWSER_SNAPSHOT_BINDING_MISMATCH')
    // Parent has quantified the complete projection before sending it. The
    // incoming clone is frozen once, with no Source revalidation in getters.
    snapshot=freezeBrowserSnapshot(next)
    if(next.numerical.kind==='ready'||next.numerical.kind==='schema-ready')budget.registerNumericalValues(next.numerical.values)
  }
  const currentSnapshot=()=>{
    if(!active||!port||!snapshot)runtimeError('BROWSER_SNAPSHOT_UNAVAILABLE')
    return snapshot
  }
  const measure=()=>send('layout',{height:Math.max(1,Math.ceil(document.body.getBoundingClientRect().height)),renderRevision})
  const facadeFor=(element:HTMLElement):ElementFacade=>{
    const known=facades.get(element)
    if(known)return known
    const bytes=new Map<string,number>(),listeners=new Map<string,Map<Function,EventListener>>()
    const textAssignment=(key:string,value:string,write:()=>void)=>{
      const next=budget.domText(value,bytes.get(key)??0)
      write();bytes.set(key,next);measure()
    }
    const facade=Object.create(null) as ElementFacade
    Object.defineProperties(facade,{
      id:{enumerable:true,get:()=>element.id,set:(value:string)=>textAssignment('id',value,()=>{element.id=value})},
      className:{enumerable:true,get:()=>element.className,set:(value:string)=>textAssignment('class',value,()=>{element.className=value})},
      textContent:{enumerable:true,get:()=>element.textContent,set:(value:string|null)=>{
        const text=value??'';textAssignment('text',text,()=>{element.textContent=text})
      }},
    })
    if(element.tagName==='BUTTON')Object.defineProperty(facade,'disabled',{enumerable:true,
      get:()=>(element as HTMLButtonElement).disabled,set:(value:boolean)=>{(element as HTMLButtonElement).disabled=value}})
    facade.append=(...nodes)=>{
      const accepted:Node[]=[]
      for(const node of nodes) {
        if(typeof node==='string') {
          budget.createNode();budget.domText(node);accepted.push(document.createTextNode(node))
        }else {
          const native=nativeNodes.get(node)
          if(!native)runtimeError('BROWSER_DOM_OWNER_MISMATCH')
          accepted.push(native)
        }
      }
      element.append(...accepted);measure()
    }
    facade.querySelector=selector=>{
      // Initial profile deliberately supports the fixture's scoped id lookup,
      // not an arbitrary CSS parser over an attacker-sized selector.
      if(!/^#[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(selector))runtimeError('BROWSER_DOM_SELECTOR_UNSUPPORTED')
      const found=element.querySelector<HTMLElement>(selector)
      return found?facadeFor(found):null
    }
    facade.setAttribute=(name,value)=>{
      if(!['id','class','title','aria-label'].includes(name)&&!/^data-[a-z0-9_-]{1,128}$/.test(name)) {
        runtimeError('BROWSER_DOM_ATTRIBUTE_UNSUPPORTED')
      }
      textAssignment(name,value,()=>element.setAttribute(name,value))
    }
    facade.addEventListener=(type,listener)=>{
      if(!['click','input','change'].includes(type))runtimeError('BROWSER_DOM_EVENT_UNSUPPORTED')
      let held=listeners.get(type)
      if(!held){held=new Map();listeners.set(type,held)}
      if(held.has(listener))return
      const wrapped:EventListener=event=>{
        if(!active||!started)return
        // Promise settlement is observed; there is no dummy resolved Promise.
        Promise.resolve().then(()=>listener(Object.freeze({preventDefault:()=>event.preventDefault(),
          stopPropagation:()=>event.stopPropagation()}))).catch(error=>send('handler-error',{code:errorCode(error)}))
      }
      held.set(listener,wrapped);element.addEventListener(type,wrapped)
      listenerDisposers.add(()=>element.removeEventListener(type,wrapped))
    }
    facade.removeEventListener=(type,listener)=>{
      const held=listeners.get(type),wrapped=held?.get(listener)
      if(wrapped){element.removeEventListener(type,wrapped);held!.delete(listener)}
    }
    Object.freeze(facade);nativeNodes.set(facade,element);facades.set(element,facade)
    return facade
  }
  const root=facadeFor(authorRoot),ownedDocument=Object.freeze({
    createElement(tag:string):ElementFacade {
      if(!['div','p','button','span','section','label'].includes(tag))runtimeError('BROWSER_DOM_TAG_UNSUPPORTED')
      budget.createNode();return facadeFor(document.createElement(tag))
    },querySelector:(selector:string)=>root.querySelector(selector),
  })
  const getVariablesFor=(scriptIdentity:string)=>(option?:MvuVariableReadOption):Readonly<MvuJsonObject>|undefined=>{
    const frame=currentSnapshot().scopeFrame,script=frame.scripts.find(row=>row.scriptId===scriptIdentity)
    if(!script)runtimeError('SCOPE_READ_SCRIPT_UNAVAILABLE')
    const selected=option??{type:'chat' as const}
    const available=(row:typeof frame.scopes.chat)=>{
      if(row.kind!=='available')runtimeError(row.code)
      return row.variables
    }
    if(selected.type==='chat'||selected.type==='character'||selected.type==='global')return available(frame.scopes[selected.type])
    if(selected.type==='script') {
      if(selected.script_id!==undefined&&selected.script_id!==scriptIdentity)runtimeError('SCOPE_READ_REQUEST_INVALID')
      return available(script.variables)
    }
    if(selected.type!=='message')runtimeError('SCOPE_READ_REQUEST_INVALID')
    const id=selected.message_id
    const row=id===undefined||id==='latest'?frame.messages.findLast(item=>!item.isSystem):
      typeof id==='number'&&Number.isSafeInteger(id)?frame.messages[id<0?frame.messages.length+id:id]:undefined
    if(!row)runtimeError(id===undefined||id==='latest'?'MESSAGE_STATE_UNAVAILABLE':'SCOPE_READ_MESSAGE_INDEX_OUT_OF_RANGE')
    return available(row.variables)
  }
  const bridgeFor=(scriptIdentity:string)=>Object.freeze({
    getNumericalState() {
      if(unknownRequest!==undefined)runtimeError('BROWSER_SAVE_ACK_UNKNOWN')
      if(pending.size)runtimeError('BROWSER_SAVE_PENDING')
      return currentSnapshot().numerical
    },
    replaceNumericalValues(values:MvuJsonObject,expected:MvuPlayerEditExpected):Promise<MvuPlayerEditResponse> {
      // Startup may read and construct DOM, but opening the realm must not write player state.
      if(!started)runtimeError('BROWSER_PLAYER_WRITE_BEFORE_STARTUP')
      const read=currentSnapshot(),numerical=read.numerical
      if(unknownRequest!==undefined)runtimeError('BROWSER_SAVE_ACK_UNKNOWN')
      if(pending.size)runtimeError('BROWSER_SAVE_PENDING')
      if(numerical.kind!=='ready'&&numerical.kind!=='schema-ready')runtimeError('BROWSER_NUMERICAL_UNAVAILABLE')
      if(!numerical.canEdit||expected!==numerical.expected)runtimeError('BROWSER_NUMERICAL_BASE_STALE')
      const id=++requestId,request={requestId:id,generation:config.binding.generation,
        readRevision:read.readRevision,scriptIdentity,values,expected}
      quantifyBrowserTransport(request)
      return new Promise<MvuPlayerEditResponse>((resolve,reject)=>{
        pending.set(id,{resolve,reject,readRevision:read.readRevision})
        send('rpc-save',{request})
      })
    },
  })
  const render=(next:BrowserRenderV1)=>{
    if(!Number.isSafeInteger(next.renderRevision)||next.renderRevision<=renderRevision)return
    renderRevision=next.renderRevision;sheet.textContent=next.css
    const fragment=document.createDocumentFragment()
    for(const part of next.parts) {
      const section=document.createElement('section')
      section.dataset.readerKey=part.key
      if(part.kind==='user')section.textContent=part.text
      else section.innerHTML=part.html
      fragment.append(section)
    }
    // Only trusted message DOM is replaced; authorRoot and its listeners persist.
    messageRoot.replaceChildren(fragment);measure()
  }
  const dispose=()=>{
    if(!active)return
    active=false;for(const stop of listenerDisposers)stop();listenerDisposers.clear()
    for(const request of pending.values())request.reject(new BrowserBudgetError('BROWSER_GENERATION_REVOKED'))
    pending.clear();port?.close();port=null;snapshot=undefined
  }
  const startup=async(program:BrowserProgramV1,read:BrowserSnapshotV1)=>{
    if(started||starting)runtimeError('BROWSER_STARTUP_ALREADY_REQUESTED')
    if(program.programSha256!==config.binding.programSha256
      ||program.runtime.implementationSha256!==config.runtime.implementationSha256
      ||program.runtime.capabilityContractSha256!==config.runtime.capabilityContractSha256) {
      runtimeError('BROWSER_RUNTIME_IMPLEMENTATION_MISMATCH')
    }
    starting=true;installSnapshot(read)
    let ordinal=-1
    try {
      for(const script of program.scripts) {
        ordinal=script.ordinal
        if(script.disposition==='disabled-source-retained')continue
        if(script.disposition!=='compiled-browser'||!active)runtimeError('BROWSER_PROGRAM_NOT_EXECUTABLE')
        const entry=new Function('root','document','getVariables','getChatMessages','NextTavern',
          '__owned_browser_budget_v1__','String','Number','JSON',script.javascript)
        await entry(root,ownedDocument,getVariablesFor(script.descriptor.identity),()=>currentSnapshot().messages,
          bridgeFor(script.descriptor.identity),budget,budget.string.bind(budget),budget.number.bind(budget),
          Object.freeze({stringify:budget.stringify.bind(budget)}))
      }
      if(!active)runtimeError('BROWSER_GENERATION_REVOKED')
      started=true;starting=false
      send('startup-complete',{readRevision:currentSnapshot().readRevision})
    }catch(error) {starting=false;send('startup-failed',{ordinal,code:errorCode(error)});dispose()}
  }
  window.addEventListener('message',event=>{
    const data=event.data
    if(event.source!==window.parent||data?.v!==2||data.type!=='bind'||data.nonce!==config.nonce
      ||data.generation!==config.binding.generation||!event.ports?.[0]||port)return
    port=event.ports[0]
    port.onmessage=event=>{
      const data=event.data
      if(!active||data?.v!==2||data.nonce!==config.nonce||data.generation!==config.binding.generation)return
      try {
        if(data.type==='initialize')void startup(data.program as BrowserProgramV1,data.snapshot as BrowserSnapshotV1)
          .catch(error=>{send('startup-failed',{code:errorCode(error)});dispose()})
        else if(data.type==='snapshot')installSnapshot(data.snapshot as BrowserSnapshotV1)
        else if(data.type==='render')render(data.render as BrowserRenderV1)
        else if(data.type==='revoke')dispose()
        else if(data.type==='rpc-result') {
          const reply=data.reply as BrowserSaveReplyV1,request=pending.get(reply.requestId)
          if(reply.generation!==config.binding.generation)return
          if(!request&&unknownRequest!==reply.requestId)return
          installSnapshot(reply.snapshot)
          if(reply.result.operation?.outcome==='unknown'||reply.result.code==='MVU_PLAYER_WRITE_UNKNOWN')unknownRequest=reply.requestId
          else if(unknownRequest===reply.requestId)unknownRequest=undefined
          if(request){pending.delete(reply.requestId);request.resolve(reply.result)}
        }else if(data.type==='rpc-error') {
          const request=pending.get(data.requestId)
          if(request){unknownRequest=data.requestId;pending.delete(data.requestId);
            request.reject(new BrowserBudgetError('BROWSER_SAVE_ACK_UNKNOWN'))}
        }else if(data.type==='rpc-denied') {
          const request=pending.get(data.requestId)
          if(request){pending.delete(data.requestId);request.reject(new BrowserBudgetError(data.code))}
        }
      }catch(error) {send('runtime-error',{code:errorCode(error)});dispose()}
    }
    port.start();send('bound')
  })
  window.parent.postMessage({v:2,type:'transport-ready',nonce:config.nonce,generation:config.binding.generation},'*')
}

export function startBrowserRuntimeFromDocumentV1():void {
  const element=document.getElementById('owned-browser-runtime-config')
  if(!element?.textContent)runtimeError('BROWSER_RUNTIME_CONFIGURATION_MISSING')
  startBrowserRuntimeV1(JSON.parse(element.textContent) as ChildConfig)
}

