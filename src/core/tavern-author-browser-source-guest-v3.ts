/** One attachment owns the current Source snapshot. Carrier/page facades share
 * these actual guest closures; resource getters capture their creator's real
 * descriptor instead of taking authority from the active callback or page. */
export function browserSourceGuestBootstrapV3(config:any) {
  const global=globalThis as any,parse=JSON.parse.bind(JSON),stringify=JSON.stringify.bind(JSON)
  const ownKeys=Object.keys.bind(Object)
  const native=global.__ownedSourceRpcV3,host=global.__ownedSourceHostV3,notify=global.__ownedSourceNotifyV3
  delete global.__ownedSourceRpcV3;delete global.__ownedSourceHostV3;delete global.__ownedSourceNotifyV3
  const clone=(value:any)=>parse(stringify(value))
  const freeze=(value:any):any=>{
    if(value&&typeof value==='object'){
      for(const item of Object.values(value))freeze(item)
      Object.freeze(value)
    }
    return value
  }
  const resources=new Map<string,any>()
  const pageControllers=new Map<string,any>()
  const nativeRegistry={metadata:new WeakMap<object,any>(),proxies:new Map<string,any>(),logicalEvents:new WeakMap<object,any>(),
    eventDetails:new WeakMap<object,any>(),
    decode:(value:any)=>pageControllers.get(value.pageId)?.decodeValue(value),
    personaSelection:(pageId:string,selector:any)=>pageControllers.get(pageId)?.personaSelection?.(selector),
    dispatch:(deliveries:any[])=>{
      try {for(const delivery of deliveries)pageControllers.get(delivery.callback.pageId)?.deliverOne(delivery)}
      finally {for(const delivery of deliveries)if(delivery.event)
        pageControllers.get(delivery.callback.pageId)?.finishDelivery(delivery.event.reference)}
    }}
  const chatMetadata={tainted:false}
  let snapshot=freeze(config.snapshot),active=true,sequence=0
  const retiredPages=new Set<string>(),listeners=new Map<string,any[]>()
  let eventTail=Promise.resolve()
  const eventTypes=freeze({MESSAGE_UPDATED:'message_updated',MESSAGE_SWIPED:'message_swiped',
    MESSAGE_SENT:'message_sent',MESSAGE_RECEIVED:'message_received',MESSAGE_EDITED:'message_edited',
    MESSAGE_DELETED:'message_deleted',CHAT_CHANGED:'chat_id_changed',SETTINGS_UPDATED:'settings_updated',
    USER_MESSAGE_RENDERED:'user_message_rendered',CHARACTER_MESSAGE_RENDERED:'character_message_rendered',
    GENERATION_AFTER_COMMANDS:'GENERATION_AFTER_COMMANDS'})
  const mvuEvents=freeze({VARIABLE_INITIALIZED:'mag_variable_initialized',
    VARIABLE_UPDATE_STARTED:'mag_variable_update_started',COMMAND_PARSED:'mag_command_parsed',
    VARIABLE_UPDATE_ENDED:'mag_variable_update_ended',BEFORE_MESSAGE_UPDATE:'mag_before_message_update',
    SINGLE_VARIABLE_UPDATED:'mag_variable_updated'})
  const mvu=freeze({events:mvuEvents})
  const live=(creator:any)=>active&&!retiredPages.has(creator.pageId)
  function emit(type:string,args:any[]):void {
    const deliveries=[...(listeners.get(type)??[])]
    eventTail=eventTail.then(async()=>{
      for(const row of deliveries) {
        if(!live(row.creator)||!listeners.get(type)?.includes(row))continue
        if(row.once)row.stop()
        try {await row.callback(...args)}
        catch(error) {notify?.(stringify({type:'source-callback-error',event:type,
          pageId:row.creator.pageId,error:String(error)}))}
      }
    })
  }
  function subscribe(creator:any,type:string,callback:Function,once=false,first=false):any {
    if(!live(creator))throw Error('BROWSER_ATTACHMENT_REVOKED')
    let rows=listeners.get(type)
    if(!rows){rows=[];listeners.set(type,rows)}
    let row=rows.find(item=>item.creator===creator&&item.callback===callback)
    if(row) {
      if(first){rows.splice(rows.indexOf(row),1);rows.unshift(row)}
      return {stop:row.stop}
    }
    const stop=()=>{
      const position=rows!.indexOf(row)
      if(position>=0)rows!.splice(position,1)
    }
    row={creator,callback,once,stop}
    if(first)rows.unshift(row);else rows.push(row)
    return {stop}
  }
  function retirePage(id:string):void {
    retiredPages.add(id);pageControllers.delete(id)
    for(const rows of listeners.values())for(const row of [...rows])if(row.creator.pageId===id)row.stop()
  }
  function rpc(payload:any):any {
    if(!active)throw Error('BROWSER_ATTACHMENT_REVOKED')
    const reply=parse(native(stringify(payload)))
    if(reply.error)throw Error(reply.error)
    return reply.value
  }
  async function request(payload:any):Promise<any> {
    if(!active)throw Error('BROWSER_ATTACHMENT_REVOKED')
    const reply=parse(await host(stringify(payload)))
    if(reply.error)throw Error(reply.error)
    return reply.value
  }
  function setSnapshot(next:any):void {
    if(next.readRevision<snapshot.readRevision)return
    const previous=snapshot
    if(next.basis.sourceSnapshotSha256!==snapshot.basis.sourceSnapshotSha256)resources.clear()
    snapshot=freeze(next)
    for(const row of next.messages) {
      const prior=previous.messages.find((item:any)=>item.index===row.index)
      if(!prior&&row.role==='assistant'&&next.basis.sourceSnapshotSha256===previous.basis.sourceSnapshotSha256)
        emit(eventTypes.MESSAGE_RECEIVED,[row.index])
      if(prior&&prior.variants?.swipe_id!==row.variants?.swipe_id)emit(eventTypes.MESSAGE_SWIPED,[row.index])
      if(!prior||stringify(prior)!==stringify(row))emit(eventTypes.MESSAGE_UPDATED,[row.index])
    }
    if(stringify(previous.personas)!==stringify(next.personas)||stringify(previous.persona)!==stringify(next.persona))
      emit(eventTypes.SETTINGS_UPDATED,[])
  }
  const operationId=()=>config.operationPrefix+'-'+ ++sequence
  const variableValue=(value:any)=>value?.kind==='available'?value.variables:undefined
  function chat():any {
    const result=clone(variableValue(snapshot.scopeFrame.scopes.chat)??{})
    for(const row of snapshot.authorChats)if(row.capture.exists)result[row.capture.binding.key]=clone(row.capture.value)
    return result
  }
  function variables(option:any):any {
    if(option.type==='chat')return chat()
    if(option.type==='character'||option.type==='global') {
      const data=variableValue(snapshot.scopeFrame.scopes[option.type])
      return data===undefined?undefined:clone(data)
    }
    if(option.type==='message') {
      const id=option.message_id===undefined||option.message_id==='latest'?-1:option.message_id
      const index=id<0?snapshot.messages.length+id:id
      const data=variableValue(snapshot.messages[index]?.variables)
      return data===undefined?undefined:clone(data)
    }
    throw Error('BROWSER_VARIABLE_SCOPE_UNSUPPORTED')
  }
  function messages(range:any='0-{{lastMessageId}}',options:any={}):any {
    const rows=snapshot.messages,last=rows.length-1
    const position=(text:any)=>{
      const number=Number(String(text).replaceAll('{{lastMessageId}}',String(last)))
      return number<0?rows.length+number:number
    }
    let first:number,end:number
    if(typeof range==='number')first=end=position(range)
    else {
      const match=String(range).match(/^(-?\d+|\{\{lastMessageId\}\})(?:-(-?\d+|\{\{lastMessageId\}\}))?$/)
      if(!match)throw Error('BROWSER_MESSAGE_RANGE_UNSUPPORTED')
      first=position(match[1]);end=position(match[2]??match[1])
    }
    return rows.filter((row:any)=>row.index>=first&&row.index<=end
      &&(!options.role||options.role==='all'||row.role===options.role)).map((row:any)=>({
      message_id:row.index,name:row.role==='user'?snapshot.persona.name:'',role:row.role,
      is_hidden:false,message:row.message,data:clone(variableValue(row.variables)??{}),
      ...options.include_swipes&&row.variants?{swipes:clone(row.variants.swipes),swipe_id:row.variants.swipe_id}:{},
    }))
  }
  function ordinary(scriptIdentity:string,patch:any,option:any={type:'chat'}):void {
    if(option.type!=='chat')throw Error('BROWSER_CHAT_SCOPE_UNSUPPORTED')
    const key=Object.keys(patch)[0]!
    if(key==='stat_data') {
      const numerical=snapshot.numerical
      if(!numerical.canEdit)throw Error(numerical.editBlockCode??'MVU_PLAYER_NOT_READY')
      const reply=rpc({op:'replace-numerical',request:{requestId:++sequence,generation:config.binding.generation,
        readRevision:snapshot.readRevision,scriptIdentity,values:clone(patch[key]),expected:clone(numerical.expected)}})
      if(!reply.snapshot){active=false;listeners.clear();throw Error('BROWSER_ATTACHMENT_REVOKED')}
      setSnapshot(reply.snapshot)
      if(reply.result.operation?.outcome!=='updated'&&reply.result.operation?.outcome!=='no-update')
        throw Error(reply.result.code??'MVU_PLAYER_WRITE_UNCONFIRMED')
      // Core supplies only actual publication signals. A fresh numerical DATA
      // snapshot, by itself, never manufactures an MVU completion event.
      for(const event of reply.sourceEvents??[])emit(event.type,event.args)
      return
    }
    const row=snapshot.authorChats.find((entry:any)=>entry.capture.binding.key===key)
    if(!row)throw Error('AUTHOR_CHAT_DECLARATION_UNAVAILABLE')
    const reply=rpc({op:'mutate-author-key',request:{key,operationId:operationId(),
      expected:clone(row.capture.revision),value:clone(patch[key])}})
    // The synchronous native primitive returns only after the canonical State
    // ACK. Every realm borrowing this closure then observes the same capture.
    if(!reply.snapshot){active=false;listeners.clear();throw Error('BROWSER_ATTACHMENT_REVOKED')}
    setSnapshot(reply.snapshot)
  }
  const personaFields=['avatar_id','avatar','name','title','description','position','depth','role',
    'lorebook','connections','is_default']
  const personaValue=(value:any)=>clone(Object.fromEntries(personaFields.filter(key=>value[key]!==undefined)
    .map(key=>[key,value[key]])))
  const personaData=()=>{
    if(!snapshot.personas)throw Error('NATIVE_PERSONA_UNAVAILABLE')
    return snapshot.personas
  }
  function personaId(id:string='current'):string|null {
    const data=personaData()
    if(!id||id==='current')return data.selectedId
    if(data.profiles.some((row:any)=>row.avatar_id===id))return id
    const matched=data.profiles.filter((row:any)=>row.name.toLowerCase()===id.toLowerCase())
    return matched.length===1?matched[0].avatar_id:null
  }
  const persona=(id:string='current')=>{
    const actual=personaId(id),row=personaData().profiles.find((item:any)=>item.avatar_id===actual)
    if(!row)throw Error('NATIVE_PERSONA_NOT_FOUND')
    return personaValue(row)
  }
  const book=(name:string)=>{
    if(!snapshot.worldbook)throw Error('AUTHOR_WORLDBOOK_UNAVAILABLE')
    if(name!==snapshot.worldbook.primaryName)throw Error('AUTHOR_WORLDBOOK_NOT_FOUND')
    return snapshot.worldbook
  }
  const entries=(rows:any[]):any[]=>clone(rows).map((row:any)=>{
    const convert=(keys:string[])=>keys.map(key=>{
      const match=key.match(/^\/([\w\W]+?)\/([gimsuy]*)$/)
      if(!match||/(^|[^\\])\//.test(match[1]!))return key
      try{return new RegExp(match[1]!.replace('\\/','/'),match[2])}catch{return key}
    })
    row.strategy.keys=convert(row.strategy.keys)
    row.strategy.keys_secondary.keys=convert(row.strategy.keys_secondary.keys)
    return row
  })
  function createFacade(text:string):any {
    const creator=freeze(parse(text))
    function resource(operation:any):any {
      if(!live(creator))throw Error('BROWSER_ATTACHMENT_REVOKED')
      const key=stringify([creator.scriptIdentity,creator.descriptorSha256,operation])
      if(!resources.has(key))resources.set(key,freeze(rpc({op:'source-resource',request:{
        schemaVersion:1,encoding:'native-author-script-resource-request-v1',
        scriptIdentity:creator.scriptIdentity,descriptorSha256:creator.descriptorSha256,
        sourceSnapshotSha256:snapshot.basis.sourceSnapshotSha256,operation,
      }})))
      return clone(resources.get(key))
    }
    const getVariables=(option:any={type:'chat'})=>option.type==='script'
      ?resource({kind:'self-script-data'}):variables(option)
    const explicitVariables=(option:any={type:'chat'})=>{
      if(option.type!=='script')return getVariables(option)
      if(typeof option.script_id!=='string'||!option.script_id)throw Error('AUTHOR_SCRIPT_RESOURCE_SCRIPT_ID_REQUIRED')
      return resource({kind:'explicit-script-data',scriptId:option.script_id})
    }
    const getScriptId=()=>resource({kind:'script-id'})
    const getScriptTrees=(options:any)=>resource({kind:'script-trees',scope:options?.type})
    const getAllVariables=()=>clone(Object.assign({},variables({type:'global'}),variables({type:'character'}),
      resource({kind:'self-script-data'}),chat(),...snapshot.messages.map((row:any)=>variableValue(row.variables))))
    function mutatePersona(mutation:any):any {
      const reply=rpc({op:'persona-mutation',request:{scriptIdentity:creator.scriptIdentity,
        operationId:operationId(),expectedDataSha256:personaData().dataSha256,mutation:clone(mutation)}})
      if(reply.result.kind!=='committed')throw Error(reply.result.code??'NATIVE_PERSONA_WRITE_UNCONFIRMED')
      if(!reply.snapshot){active=false;listeners.clear();throw Error('BROWSER_ATTACHMENT_REVOKED')}
      setSnapshot(reply.snapshot);return reply.result.receipt.result
    }
    const catalogRows=new Map<string,any>()
    const catalogRow=(id:string)=>{
      if(!catalogRows.has(id))catalogRows.set(id,freeze({
        dataset:{avatarId:id},getAttribute:(key:string)=>key==='data-avatar-id'?id:null,
        click:()=>{
          if(!live(creator))throw Error('BROWSER_ATTACHMENT_REVOKED')
          if(!personaData().profiles.some((row:any)=>row.avatar_id===id))throw Error('NATIVE_PERSONA_NOT_FOUND')
          mutatePersona({kind:'select',id})
        },
      }))
      return catalogRows.get(id)
    }
    function personaSelection(selector:any,within=false):any[]|undefined {
      if(typeof selector!=='string')return undefined
      const root='#user_avatar_block'
      if(selector===root)return [personaRoot]
      const query=selector.startsWith(root+' ')?selector.slice(root.length+1):within?selector:''
      // These are captured catalog values with explicit selection operations.
      // They are never registered as Native DOM handles or Document nodes.
      if(query==='.avatar-container')return personaData().profiles.map((row:any)=>catalogRow(row.avatar_id))
      const match=query.match(/^\.avatar-container\[data-avatar-id="((?:\\.|[^"\\])*)"\]$/)
      if(!match)return selector.startsWith(root)?[]:undefined
      const id=match[1]!.replace(/\\(["\\])/g,'$1')
      return personaData().profiles.some((row:any)=>row.avatar_id===id)?[catalogRow(id)]:[]
    }
    function capturedPersonaSelection(selector:any,within=false):any[]|undefined {
      const selected=personaSelection(selector,within)
      if(selected!==undefined&&!live(creator))throw Error('BROWSER_ATTACHMENT_REVOKED')
      return selected
    }
    const personaRoot=freeze({catalog:'personas',
      querySelector:(selector:string)=>capturedPersonaSelection(selector,true)?.[0]??null,
      querySelectorAll:(selector:string)=>capturedPersonaSelection(selector,true)??[],
    })
    const pageController=pageControllers.get(creator.pageId)
    if(pageController)pageController.personaSelection=capturedPersonaSelection
    function personaJQuery(selector:any):any {
      if(!live(creator))throw Error('BROWSER_ATTACHMENT_REVOKED')
      if(typeof selector==='function') {
        pageControllers.get(creator.pageId).ready(selector,jquery)
        return undefined
      }
      const rows=personaSelection(selector,true)??[]
      const root='#user_avatar_block'
      const collection:any={length:rows.length,
        find:(value:string)=>personaJQuery(selector===root?root+' '+value:''),
        attr:(key:string)=>rows[0]?.getAttribute?.(key),
        click:()=>{for(const row of rows)row.click?.();return collection},
      }
      rows.forEach((row:any,index:number)=>{collection[index]=row})
      return Object.freeze(collection)
    }
    async function avatarFetch(url:string,options:any={}):Promise<any> {
      if(!live(creator))throw Error('BROWSER_ATTACHMENT_REVOKED')
      if(url!=='/api/avatars/get'||options.method!=='POST')throw Error('BROWSER_FETCH_UNSUPPORTED')
      const ids=clone(personaData().avatarIds)
      return freeze({ok:true,status:200,json:async()=>clone(ids)})
    }
    async function mutateWorldbook(name:string,mutation:any,basis=book(name)):Promise<any> {
      const wire=parse(stringify(mutation,(_key:string,value:any)=>value instanceof RegExp?value.toString():value))
      const reply=await request({op:'mutate-worldbook',request:{scriptIdentity:creator.scriptIdentity,name,
        operationId:operationId(),expectedDataSha256:basis.dataSha256,mutation:wire}})
      if(reply.result.kind!=='edited-data')throw Error('AUTHOR_WORLDBOOK_WRITE_UNCONFIRMED')
      if(!reply.snapshot)throw Error('BROWSER_ATTACHMENT_REVOKED')
      setSnapshot(reply.snapshot);return reply
    }
    const getCurrentCharPrimaryLorebook=()=>{
      if(!snapshot.worldbook)throw Error('AUTHOR_WORLDBOOK_UNAVAILABLE')
      return snapshot.worldbook.primaryName
    }
    const apis:any={getVariables,getAllVariables,getScriptId,getScriptTrees,getChatMessages:messages,
      event_types:eventTypes,tavern_events:eventTypes,Mvu:mvu,
      eventOn:(type:string,callback:Function)=>subscribe(creator,type,callback),
      eventOnce:(type:string,callback:Function)=>subscribe(creator,type,callback,true),
      eventMakeFirst:(type:string,callback:Function)=>subscribe(creator,type,callback,false,true),
      eventRemoveListener:(type:string,callback:Function)=>{
        for(const row of [...(listeners.get(type)??[])])if(row.creator===creator&&row.callback===callback)row.stop()
      },getButtonEvent:(name:string)=>stringify(['source-script-button',creator.scriptIdentity,creator.descriptorSha256,name]),
      insertOrAssignVariables:(patch:any,option:any)=>ordinary(creator.scriptIdentity,patch,option),
      getWorldbookNames:()=>clone(book(getCurrentCharPrimaryLorebook()).names),getCurrentCharPrimaryLorebook,
      getCharWorldbookNames:(name:string)=>{
        if(name!=='current')throw Error('AUTHOR_WORLDBOOK_CHARACTER_UNSUPPORTED')
        return {primary:getCurrentCharPrimaryLorebook(),additional:[]}
      },getWorldbook:(name:string)=>entries(book(name).entries),
      replaceWorldbook:async(name:string,rows:any[])=>{await mutateWorldbook(name,{kind:'replace-worldbook',entries:rows})},
      updateWorldbookWith:async(name:string,updater:Function)=>{
        const basis=book(name),rows=await updater(entries(basis.entries))
        return entries((await mutateWorldbook(name,{kind:'replace-worldbook',entries:rows},basis)).worldbook)
      },createWorldbookEntries:async(name:string,rows:any[])=>{
        const reply=await mutateWorldbook(name,{kind:'create-entries',entries:rows})
        return {worldbook:entries(reply.worldbook),new_entries:entries(reply.new_entries)}
      },deleteWorldbookEntries:async(name:string,predicate:Function)=>{
        const basis=book(name),uids=entries(basis.entries).filter(row=>predicate(row)).map(row=>row.uid)
        const reply=await mutateWorldbook(name,{kind:'delete-entries',uids},basis)
        return {worldbook:entries(reply.worldbook),deleted_entries:entries(reply.deleted_entries)}
      },getPersonaIds:()=>personaData().profiles.map((row:any)=>row.avatar_id),
      getPersonaNames:()=>personaData().profiles.map((row:any)=>row.name),getCurrentPersonaId:()=>personaData().selectedId,
      getCurrentPersonaName:()=>personaData().profiles.find((row:any)=>row.avatar_id===personaData().selectedId)?.name??null,
      getPersona:persona,getPersonaAvatarPath:(id:string='current')=>{
        const actual=personaId(id)
        return actual?'/api/roleplay/persona-avatar?id='+encodeURIComponent(actual):null
      },createPersona:async(name:string,value:any={})=>mutatePersona({kind:'create',name,persona:personaValue(value)}),
      replacePersona:async(id:string,value:any={})=>{
        const actual=personaId(id)
        if(!actual)throw Error('NATIVE_PERSONA_NOT_FOUND')
        mutatePersona({kind:'replace',id:actual,persona:personaValue(value)})
      },structuredClone:clone,
    }
    const tavern={getCurrentChatId:()=>config.binding.sessionId,getContext:()=>({
      name1:snapshot.persona.name,name2:snapshot.character?.name??'',chatId:config.binding.sessionId,
      characterId:snapshot.character?0:undefined,characters:clone(snapshot.character?[snapshot.character]:[]),eventTypes,
      tavern_events:eventTypes,Mvu:mvu,
      getRequestHeaders:()=>({'Content-Type':'application/json'}),
      chat:clone(snapshot.messages.map((row:any)=>({name:row.role==='user'?snapshot.persona.name:snapshot.character?.name??'',
        mes:row.message,is_user:row.role==='user',is_system:false,
        swipe_id:row.variants?.swipe_id??0,...row.variants?{swipes:row.variants.swipes}:{}}))),chatMetadata,
    })}
    const nextTavern={getNumericalState:()=>snapshot.numerical,
      replaceNumericalValues:async(values:any,expected:any)=>{
        const reply=await request({op:'save',request:{requestId:++sequence,generation:config.binding.generation,
          readRevision:snapshot.readRevision,scriptIdentity:creator.scriptIdentity,values:clone(values),expected:clone(expected)}})
        if(reply.snapshot)setSnapshot(reply.snapshot)
        return reply.result
      }}
    const guard=(fn:Function)=>(...args:any[])=>{
      if(!live(creator))throw Error('BROWSER_ATTACHMENT_REVOKED')
      return fn(...args)
    }
    const guarded=(value:any)=>Object.fromEntries(Object.entries(value).map(([key,fn])=>
      [key,typeof fn==='function'?guard(fn):fn]))
    const jquery=guard(personaJQuery) as any
    jquery.fn=freeze({})
    const exposed={...guarded(apis),$:jquery,jQuery:jquery,fetch:guard(avatarFetch)}
    return {...exposed,TavernHelper:freeze({...exposed,getVariables:guard(explicitVariables)}),
      SillyTavern:freeze(guarded(tavern)),NextTavern:freeze(guarded(nextTavern)),
      get name1(){return snapshot.persona.name},get name2(){return snapshot.character?.name??''}}
  }
  return {createFacade,facadeKeys:(facade:any)=>stringify(ownKeys(facade)),nativeRegistry,
    registerPage:(id:string,controller:any)=>{pageControllers.set(id,controller);return undefined},
    installFacade:(facade:any,target:any)=>{
      // Copy actual guest descriptors so live Source getters retain the shared
      // snapshot closure when installed on another same-runtime realm.
      Object.defineProperties(target,Object.getOwnPropertyDescriptors(facade));return undefined
    },
    snapshot:(text:string)=>{setSnapshot(parse(text));return undefined},
    event:(text:string)=>{const event=parse(text);emit(event.type,event.args);return undefined},
    retirePage:(id:string)=>{retirePage(id);return undefined},
    destroy:()=>{active=false;listeners.clear();resources.clear();pageControllers.clear();
      nativeRegistry.proxies.clear();return undefined}}
}
