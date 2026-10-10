/** Evaluated only inside QuickJS. The returned controller is retained by the
 * Worker as a private handle; author code receives only the declared facade. */
export function browserGuestBootstrapV2(config:any) {
  const parse=JSON.parse.bind(JSON),stringify=JSON.stringify.bind(JSON)
  const clone=(value:any)=>parse(stringify(value))
  const freeze=(value:any):any=>{
    if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
    return value
  }
  const dom=(globalThis as any).__ownedDomV2,asyncRpc=(globalThis as any).__ownedAsyncV2
  const notify=(globalThis as any).__ownedNotifyV2
  delete (globalThis as any).__ownedDomV2;delete (globalThis as any).__ownedAsyncV2
  delete (globalThis as any).__ownedNotifyV2
  const callbacks=new Map<number,{fn:Function;origin:any}>(),callbackIds=new WeakMap<Function,number>()
  const refs=new Map<number,any>(),metadata=new WeakMap<object,any>(),methods=new Set(config.methods)
  const instances=Object.create(null),registrations:any[]=[],effects:any[]=[],cleanupRemovals:any[]=[]
  let sequence=0,origin:any=null,snapshot=freeze(config.snapshot),invocation:any=null,activeCallback:string|null=null
  let gestureId:string|undefined,generatedTask:any=null,saveSequence=0
  let executionCallback:number|null=null
  const withOrigin=(next:any,fn:()=>any)=>{const old=origin;origin=next;try{return fn()}finally{origin=old}}
  const callback=(fn:Function)=>{
    let id=callbackIds.get(fn)
    if(id===undefined){id=++sequence;callbackIds.set(fn,id);callbacks.set(id,{fn,origin})}
    return {__callback:id,scriptIdentity:callbacks.get(id)!.origin.scriptIdentity}
  }
  function encode(value:any):any {
    if(value===undefined)return {__undefined:true}
    if(typeof value==='function')return callback(value)
    if(value&&typeof value==='object') {
      const owned=metadata.get(value);if(owned)return owned
      if(Array.isArray(value))return value.map(encode)
      return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encode(item)]))
    }
    return value
  }
  const rpc=(payload:any)=>{
    const result=parse(dom(stringify(payload)))
    if(result.error)throw Error(result.error)
    return decode(result.value)
  }
  function decode(value:any):any {
    if(value&&typeof value==='object') {
      if(value.__undefined)return undefined
      if(value.__window)return facade
      if(value.__handle!==undefined) {
        const id=value.__handle
        if(refs.has(id))return refs.get(id)
        const proxy=new Proxy(Object.create(null),{
          get(_target,key:any) {
            if(typeof key==='symbol'||key==='then')return undefined
            if(methods.has(key))return (...args:any[])=>rpc({op:'call',handle:id,method:key,args:encode(args)})
            return rpc({op:'get',handle:id,key})
          },
          set(_target,key:any,next:any){rpc({op:'set',handle:id,key,value:encode(next)});return true},
        })
        refs.set(id,proxy);metadata.set(proxy,value);return proxy
      }
      if(Array.isArray(value))return value.map(decode)
      return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,decode(item)]))
    }
    return value
  }
  const request=(kind:string,payload:any)=>asyncRpc(stringify({kind,callbackId:executionCallback,
    scriptIdentity:origin?.scriptIdentity,...payload})).then(parse)
  const variableValue=(value:any)=>value?.kind==='available'?value.variables:undefined
  function getVariables(option:any={type:'chat'}) {
    const frame=snapshot.scopeFrame
    let result:any
    if(option.type==='chat') {
      result=variableValue(frame.scopes.chat)
      if(config.ownedChatKey&&snapshot.authorChat?.exists)
        result={...(result||{}),[config.ownedChatKey]:snapshot.authorChat.value}
    }else if(option.type==='character'||option.type==='global')result=variableValue(frame.scopes[option.type])
    else if(option.type==='script')result=variableValue(frame.scripts.find((row:any)=>row.scriptId===(option.script_id||origin?.scriptIdentity))?.variables)
    else if(option.type==='message') {
      const messages=snapshot.messages
      const id=option.message_id===undefined||option.message_id==='latest'?-1:option.message_id
      const position=id<0?messages.length+id:id
      result=variableValue(messages[position]?.variables)
    }
    return result===undefined?undefined:freeze(clone(result))
  }
  function getChatMessages(range:any='0-{{lastMessageId}}',options:any={}) {
    const rows=snapshot.messages,last=rows.length-1
    const resolve=(text:any)=>{
      const token=String(text).replaceAll('{{lastMessageId}}',String(last))
      const number=Number(token);return number<0?rows.length+number:number
    }
    let first=0,end=last
    if(typeof range==='number')first=end=resolve(range)
    else {
      const match=String(range).match(/^(-?\d+|\{\{lastMessageId\}\})(?:-(-?\d+|\{\{lastMessageId\}\}))?$/)
      if(!match)throw Error('BROWSER_MESSAGE_RANGE_UNSUPPORTED')
      first=resolve(match[1]);end=resolve(match[2]??match[1])
    }
    return freeze(rows.filter((row:any)=>row.index>=first&&row.index<=end&&(!options.role||options.role==='all'||row.role===options.role))
      .map((row:any)=>({message_id:row.index,name:row.role==='user'?snapshot.persona.name:'',role:row.role,
        is_hidden:false,message:row.message,data:variableValue(row.variables)||{},
        ...options.include_swipes&&row.variants?{swipes:row.variants.swipes,swipe_id:row.variants.swipe_id}:{}})))
  }
  const subscribe=(priority:'first'|'normal',type:string,fn:Function)=>{
    const reference=callback(fn)
    if(type==='GENERATION_AFTER_COMMANDS') {
      const registration={...origin,callbackId:String(reference.__callback),priority,registrationOrder:registrations.length}
      registrations.push(registration)
      return ()=>{const index=registrations.indexOf(registration);if(index>=0)registrations.splice(index,1)}
    }
    const id=rpc({op:'subscribe',type,callback:reference})
    return ()=>rpc({op:'unsubscribe',id})
  }
  const listenerIds=new Map<string,Map<Function,Map<boolean,number>>>()
  const addListener=(type:string,fn:Function,options?:boolean|{capture?:boolean;once?:boolean;passive?:boolean})=>{
    let group=listenerIds.get(type);if(!group){group=new Map();listenerIds.set(type,group)}
    let captures=group.get(fn);if(!captures){captures=new Map();group.set(fn,captures)}
    const capture=typeof options==='boolean'?options:options?.capture===true
    captures.set(capture,rpc({op:'listen',type,callback:callback(fn),options}))
  }
  const removeListener=(type:string,fn:Function,options?:boolean|{capture?:boolean})=>{
    const captures=listenerIds.get(type)?.get(fn)
    const capture=typeof options==='boolean'?options:options?.capture===true,id=captures?.get(capture)
    if(id!==undefined){rpc({op:'unlisten',id});captures!.delete(capture)}
  }
  const doc=decode(config.document)
  const timeout=(fn:Function,delay:number)=>rpc({op:'timer',callback:callback(fn),delay})
  const raf=(fn:Function)=>rpc({op:'raf',callback:callback(fn)})
  const Observer=function(this:any,kind:string,fn:Function){return rpc({op:'observer',kind,callback:callback(fn)})}
  const url=function(this:any,value:string,base?:string){
    const result=rpc({op:'url',url:value,base});Object.assign(this,result)
    this.searchParams=Object.freeze({get:(key:string)=>result.searchParams[key]??null})
  }
  Object.assign(url,{createObjectURL:(file:any)=>rpc({op:'object-url',file:encode(file)}),
    revokeObjectURL:(value:string)=>rpc({op:'revoke-object-url',url:value})})
  const storage=Object.freeze({getItem:()=>null})
  const tavern=Object.freeze({getCurrentChatId:()=>config.binding.sessionId,
    getContext:()=>freeze({name1:snapshot.persona.name,name2:'',chatId:config.binding.sessionId})})
  const globals:any={document:doc,root:doc.body,Image:function(){return rpc({op:'image'})},URL:url,
    MutationObserver:function(fn:Function){return new (Observer as any)('mutation',fn)},
    ResizeObserver:function(fn:Function){return new (Observer as any)('resize',fn)},
    localStorage:storage,SillyTavern:tavern,setTimeout:timeout,clearTimeout:(id:number)=>rpc({op:'clear-timer',id}),
    requestAnimationFrame:raf,cancelAnimationFrame:(id:number)=>rpc({op:'cancel-raf',id}),
    Event:function(type:string,options:any){return rpc({op:'event',type,options:encode(options)})},
    CustomEvent:function(type:string,options:any){return rpc({op:'event',type,options:encode(options),custom:true})},
    structuredClone:clone,getVariables,getChatMessages,
    eventOn:(type:string,fn:Function)=>subscribe('normal',type,fn),
    eventMakeFirst:(type:string,fn:Function)=>subscribe('first',type,fn),
    eventRemoveListener:(type:string,fn:Function)=>{
      const id=callbackIds.get(fn),index=registrations.findIndex(row=>row.callbackId===String(id))
      if(type==='GENERATION_AFTER_COMMANDS'&&index>=0)registrations.splice(index,1)
    },
    tavern_events:freeze(Object.fromEntries(config.events.map((name:string)=>[name,name]))),
    injectPrompts:(prompts:any[],options:any={})=>{
      if(!invocation||!activeCallback)throw Error('BROWSER_GENERATION_INVOCATION_REQUIRED')
      effects.push({...origin,callbackId:activeCallback,kind:'inject',prompts:clone(prompts),once:options.once===true})
      return prompts.map(row=>row.id)
    },
    uninjectPrompts:(ids:string[])=>{
      if(invocation&&activeCallback)effects.push({...origin,callbackId:activeCallback,kind:'remove',ids:clone(ids)})
      else cleanupRemovals.push({...origin,ids:clone(ids)})
    },
    generateRaw:(options:any)=>{
      if(!gestureId)throw Error('BROWSER_TRUSTED_FORM_REQUIRED')
      const gesture=gestureId;gestureId=undefined
      return request('generate-raw',{request:{scriptIdentity:origin.scriptIdentity,options:clone(options),gestureId:gesture}})
        .then((reply:any)=>{generatedTask=reply.task;return reply.text})
    },
    updateVariablesWith:(fn:Function,option:any={type:'chat'})=>{
      if(option.type!=='chat'||origin.originalOrdinal!==config.ownedChatWriter?.ordinal||!generatedTask)
        throw Error('BROWSER_CHAT_UPDATE_NOT_ADMITTED')
      const complete=getVariables({type:'chat'})||freeze({}),next=fn(complete)
      const key=config.ownedChatKey,task=generatedTask;generatedTask=null
      // The admitted updater is synchronous. A short Asyncify primitive waits
      // for the actual State commit before original author UI can say saved.
      // Long provider generation uses the separate deferred VM Promise above.
      const capture=rpc({op:'author-chat-update',scriptIdentity:origin.scriptIdentity,
        request:{scriptIdentity:origin.scriptIdentity,expected:snapshot.authorChat.revision,
          value:clone(next[key]),task}})
      snapshot=freeze({...snapshot,authorChat:capture});return getVariables({type:'chat'})
    },
    NextTavern:freeze({getNumericalState:()=>snapshot.numerical,
      replaceNumericalValues:(values:any,expected:any)=>request('save',{request:{requestId:++saveSequence,
        generation:config.binding.generation,readRevision:snapshot.readRevision,
        scriptIdentity:origin.scriptIdentity,values:clone(values),expected:clone(expected)}}).then((reply:any)=>{
          snapshot=freeze(reply.snapshot);return reply.result
        })}),
    console:freeze({log:()=>{},info:()=>{},warn:()=>{},error:()=>{},debug:()=>{}}),
  }
  const facade:any=new Proxy(instances,{
    get(target,key:any) {
      if(key==='parent'||key==='window')return facade
      if(key in globals)return globals[key]
      if(key==='name1')return snapshot.persona.name
      if(['devicePixelRatio','innerWidth','innerHeight','visualViewport'].includes(key))return rpc({op:'window-read',key})
      if(key==='performance')return freeze({now:()=>rpc({op:'performance-now'})})
      if(key==='getComputedStyle')return (node:any)=>rpc({op:'computed-style',node:encode(node)})
      if(key==='matchMedia')return (query:string)=>rpc({op:'match-media',query})
      if(key==='addEventListener')return addListener
      if(key==='removeEventListener')return removeListener
      return target[key]
    },set(target,key:any,value:any){target[key]=value;return true},
  })
  Object.assign(globalThis,globals,{window:facade,parent:facade})
  // Each callback has one asynchronous root. Resource continuations may enter
  // the Actor while its Promise is pending; provider waits never hold Ccall.
  const deliver=(id:number,argsText:string,completionId:number,resource:boolean,token?:string)=>{
    const owned=callbacks.get(id);if(!owned)throw Error('BROWSER_CALLBACK_UNAVAILABLE')
    origin=owned.origin
    const previousCallback=executionCallback;executionCallback=id
    if(!resource){gestureId=token;generatedTask=null}
    let result:any
    try{result=owned.fn(...decode(parse(argsText)))}catch{notify(stringify({type:'callback-complete',id:completionId,error:true}));executionCallback=previousCallback;return}
    if(resource)executionCallback=previousCallback
    Promise.resolve(result).then(()=>notify(stringify({type:'callback-complete',id:completionId})),
      ()=>notify(stringify({type:'callback-complete',id:completionId,error:true})))
  }
  return {
    select:(text:string)=>{
      const {callbackId,...selected}=parse(text);origin=selected
      if(callbackId!==undefined)executionCallback=callbackId
    },
    snapshot:(text:string)=>{snapshot=freeze(parse(text))},
    registrations:()=>stringify(registrations),
    deliver:(text:string)=>{const data=parse(text);deliver(data.id,stringify(data.args),data.completionId,data.resource,data.gestureId)},
    generation:(text:string)=>{
      const data=parse(text);invocation=data;snapshot=freeze(data.snapshot);effects.length=0
      const ordered=[...registrations].sort((a,b)=>(a.priority==='first'?0:1)-(b.priority==='first'?0:1)||a.registrationOrder-b.registrationOrder)
      let completed=0
      const run=async()=>{
        for(const row of ordered) {
          const owned=callbacks.get(Number(row.callbackId))!;origin=owned.origin;activeCallback=row.callbackId
          await owned.fn();completed++
        }
        notify(stringify({type:'generation-complete',invocationId:data.invocationId,
          effects,cleanupRemovals,callbacksExecuted:completed}))
      }
      void run().catch(()=>notify(stringify({type:'generation-complete',invocationId:data.invocationId,error:true})))
        .finally(()=>{invocation=null;activeCallback=null})
    },
    destroy:()=>{
      for(const value of Object.values(instances) as any[])if(value&&typeof value.destroy==='function')withOrigin(origin,()=>value.destroy())
      callbacks.clear();refs.clear();registrations.length=0
    },
  }
}
