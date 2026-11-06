import {READER_NATIVE_RESOURCE_CSP} from '../core/reader-native-parent-realm.js'
import {createReaderDocumentLayoutRealm,type ReaderDocumentLayoutConfig} from '../core/tavern-author-reader-document-layout.js'
import {createAuthorNativeMvuApi} from './author-native-mvu-sdk.js'
import {createAuthorNativeEventOwner} from './author-native-events.js'
import {createAuthorNativeScriptButtonCatalog,type AuthorNativeButtonScriptV1} from './author-native-script-buttons.js'
import {createAuthorNativeMessageVariables} from '../core/author-native-message-variables.js'
import {createAuthorNativeCurrentRegex} from '../core/author-native-current-regex.js'
import {createAuthorNativeVariableWriters} from '../core/author-native-variable-writers.js'
import type {AuthorNativeProgramV1} from '../core/author-native-program.mjs'
import type {AuthorNativeHelperSnapshotV1,AuthorNativeHelperRealmBindingV1,AuthorNativeHelperHostV1,
  AuthorNativeHelperFrameOptionsV1,AuthorNativeHelperFrameControllerV1,AuthorNativeHelperResourceV1,
  AuthorNativeHelperGenerationCallbackV1,AuthorNativeHelperGenerationInvocationV1,
  AuthorNativeHelperGenerationResultV1,AuthorNativeHelperMvuHookResultV1} from '../core/author-native-helper-types.js'
import type {AuthorNativeMvuHookRequest,AuthorNativeMvuHookDiagnostic} from '../core/author-native-mvu-hook-types.js'

/** Serialized into the child before unmodified Source scripts. All asynchronous
 * code in this window shares one principal; script locations are DATA only. */
export function authorNativeHelperBootstrap(initial:AuthorNativeHelperSnapshotV1,initialReadScope:string,
  channel:string,realmId:string,resource:AuthorNativeHelperResourceV1,
  scripts:readonly {readonly javascript:string}[],libraries:readonly {readonly javascript:string}[],
  createLayout:typeof createReaderDocumentLayoutRealm,layoutConfig:ReaderDocumentLayoutConfig,
  importModule:(url:string)=>Promise<unknown>,createMvu:typeof createAuthorNativeMvuApi,
  createEvents:typeof createAuthorNativeEventOwner,createButtons:typeof createAuthorNativeScriptButtonCatalog,
  buttonScripts:readonly AuthorNativeButtonScriptV1[],createMessageVariables:typeof createAuthorNativeMessageVariables,
  createCurrentRegex:typeof createAuthorNativeCurrentRegex,createVariableWriters:typeof createAuthorNativeVariableWriters):void {
  const realm=window as any,clone=(value:any)=>value===undefined?undefined:structuredClone(value)
  let snapshot=initial,scope=initialReadScope,explicitScope=initialReadScope,active=true,sequence=0
  let messageSnapshot=snapshot,messageVariables=createMessageVariables(snapshot)
  const messageData=()=>{
    if(messageSnapshot!==snapshot){messageSnapshot=snapshot;messageVariables=createMessageVariables(snapshot)}
    return messageVariables
  }
  let avatarStyle:HTMLStyleElement|undefined,userAvatar:string|null|undefined,charAvatar:string|null|undefined
  const updateAvatarStyles=()=>{
    const paths=snapshot.avatarPaths
    if(paths?.user===userAvatar&&paths?.character===charAvatar)return
    userAvatar=paths?.user;charAvatar=paths?.character
    avatarStyle??=document.head.appendChild(document.createElement('style'))
    const background=(uri:string|null|undefined)=>uri?'url('+JSON.stringify(uri)+')':'none'
    avatarStyle.textContent=paths?'.user_avatar,.user-avatar{background-image:'+background(userAvatar)+'}'
      +'.char_avatar,.char-avatar{background-image:'+background(charAvatar)+'}':''
  }
  updateAvatarStyles()
  let port:MessagePort|undefined
  const sourceUrls:string[]=[]
  let layout:ReturnType<typeof createReaderDocumentLayoutRealm>|undefined,layoutRevision=0
  const layoutWrites=new Map<number,{resolve():void;reject(error:Error):void}>()
  const frame=window.frameElement as HTMLIFrameElement
  let ownHeight=frame.style.height
  const height=async(value:number)=>{
    const id=++sequence
    ownHeight=`${Math.ceil(value)}px`;frame.style.height=ownHeight
    await new Promise<void>((resolve,reject)=>{
      layoutWrites.set(id,{resolve,reject});send({op:'layout-height',id,revision:layoutRevision,height:value})
    })
  }
  const frameChanges=new MutationObserver(records=>{
    if(records.some(record=>record.attributeName==='height')||frame.style.height!==ownHeight){
      // An explicit author frame size pauses automatic sizing until an
      // explicit Auto/Fit retry, following the shared Reader layout policy.
      layout?.pause();void height(frame.getBoundingClientRect().height).catch(error=>{if(active)report(error)})
    }
  })
  frameChanges.observe(frame,{attributes:true,attributeFilter:['style','height']})
  const queued:object[]=[],pending=new Map<number,{resolve(value:any):void;reject(error:Error):void}>()
  const reads=new WeakMap<object,string>()
  let invocation:{id:string;effects:any[];callbackId:string}|undefined
  let mutableHook:{diagnostics:AuthorNativeMvuHookDiagnostic[];callbackId:string}|undefined
  const send=(message:object)=>{if(port)port.postMessage(message);else queued.push(message)}
  const request=(operation:string,payload:unknown,readScope=scope,operationId=crypto.randomUUID()):Promise<any>=>new Promise((resolve,reject)=>{
    if(!active){reject(Error('AUTHOR_NATIVE_BINDING_REVOKED'));return}
    const id=++sequence;pending.set(id,{resolve,reject})
    send({op:'request',id,request:{operationId,operation,payload,readScope}})
  })
  const filters=new Map<string,Function>()
  const retireFilters=(ids:readonly string[])=>{for(const id of ids)filters.delete(id)}
  const mutatePrompts=(mutation:unknown)=>{
    const operationId=crypto.randomUUID()
    const work=request('mutate-prompts',{resource,mutation},scope,operationId)
      .then(reply=>retireFilters(reply?.retiredFilterCallbackIds??[]))
    void work.catch(report)
    return operationId
  }
  const available=(value:any)=>value?.kind==='available'?value.variables:{}
  const variables=(options:any={type:'chat'})=>{
    const type=options.type??'chat'
    if(type==='chat'){
      const result={...clone(available(snapshot.scopeFrame.scopes.chat)),...clone(snapshot.ordinaryChat.values)}
      for(const key of snapshot.ordinaryChat.deletedKeys??[])delete result[key]
      return result
    }
    if(type==='global'||type==='character')return clone(available(snapshot.scopeFrame.scopes[type as 'global'|'character']))
    if(type==='script'){
      const address=selfScript()
      if(address.variables===undefined)throw Error('AUTHOR_NATIVE_SCRIPT_VARIABLES_UNAVAILABLE')
      return clone(address.variables)
    }
    if(type==='message'){
      return clone(messageData().resolve(options).values)
    }
    throw Error('AUTHOR_NATIVE_VARIABLE_SCOPE_UNAVAILABLE')
  }
  const messageObjects=(rows:any[])=>[rows,...rows.flatMap(row=>
    [row,row.data,row.swipes,row.swipes_data,...(row.swipes_data??[])])]
  const getChatMessages=(range:any='0-{{lastMessageId}}',options:any={})=>{
    const rows=snapshot.messages,last=rows.length-1
    const position=(id:string)=>{const n=Number(id.replaceAll('{{lastMessageId}}',String(last)))
      return n<0?rows.length+n:n}
    const match=String(range).match(/^(-?\d+|\{\{lastMessageId\}\})(?:-(-?\d+|\{\{lastMessageId\}\}))?$/)
    const start=match?position(match[1]!):0,end=match?position(match[2]??match[1]!):-1
    const result=rows.filter(row=>!!match&&row.index>=Math.min(start,end)&&row.index<=Math.max(start,end)
      &&options.hide_state!=='hidden'&&(!options.role||options.role==='all'||row.role===options.role))
      .map(row=>({message_id:row.index,role:row.role,message:row.message,is_hidden:false,
        data:clone(messageData().forMessage(row).values),...options.include_swipes&&row.variants
          ?{...clone(row.variants),swipes_data:clone(messageData().swipeData(row))}:{}}))
    explicitScope=scope
    for(const object of messageObjects(result))if(object&&typeof object==='object')reads.set(object,scope)
    return result
  }
  const setChatMessages=(rows:any[],options:any={})=>{
    const scopes=new Set(messageObjects(rows).map(object=>object&&typeof object==='object'?reads.get(object):undefined)
      .filter(value=>value!==undefined))
    if(scopes.size>1)throw Error('AUTHOR_NATIVE_MIXED_READ_BASIS')
    const body=messageData().normalizeBodyRows(rows),operation=body&&!body.message.variants?'message-body':'opening-variants',
      selected=body?[{message_id:body.message_id,message:body.text}]:rows
    const work=request(operation,{rows:selected,refresh:options.refresh??'affected'},scopes.values().next().value??explicitScope)
    return operation==='message-body'?work.then(result=>{
      if(result.kind==='refused'||result.kind==='unknown')throw Error(result.code)
      return result
    }):work
  }
  const variableWriters=createVariableWriters((options:any)=>{
    const type=options.type??'chat',readScope=scope
    if(type!=='chat'&&type!=='message'&&type!=='script')throw Error('AUTHOR_NATIVE_CHAT_SCOPE_UNSUPPORTED')
    const selector=type==='message'?{type:'message' as const,message_id:options.message_id??'latest'}
      :type==='script'?{type:'script' as const}:undefined
    const current=selector?.type==='message'?clone(messageData().resolve(selector,true).values):variables(options)
    return {variables:current,commit:(nextVariables:any)=>request('mutate-author-namespace',
      {nextVariables,...selector?{selector}:{}},readScope)}
  },()=>realm._)
  function report(error:unknown):void {
    const code=error instanceof Error?error.message:String(error)
    mutableHook?.diagnostics.push({code,realmId,callbackId:mutableHook.callbackId})
    send({op:'diagnostic',code})
  }
  const events=createEvents<AuthorNativeHelperGenerationCallbackV1>({
    create:(event,once)=>({callbackId:crypto.randomUUID(),realmId,resource,event,once,makeFirst:false,order:0}),
    positioned:(previous,position)=>{
      const registration={...previous,makeFirst:position==='first',order:++sequence}
      void request('generation-listener-add',{registration}).catch(report)
      return registration
    },
    removed:registration=>{if(active)void request('generation-listener-remove',{callbackId:registration.callbackId}).catch(report)},
    beforeInvoke:registration=>{
      if(invocation)invocation.callbackId=registration.callbackId
      if(mutableHook)mutableHook.callbackId=registration.callbackId
    },report,
  })
  const emit=async(event:string,args:readonly unknown[],callbackIds?:readonly string[])=>{
    const invoked=await events.emit(event,args,callbackIds?registration=>callbackIds.includes(registration.callbackId):undefined)
    return invoked.map(registration=>registration.callbackId)
  }
  const books=()=>snapshot.worldbook as any
  const book=(name:string)=>{
    const data=books(),value=data?.primaryName===name?data:undefined
    if(!value)throw Error('AUTHOR_NATIVE_WORLDBOOK_UNAVAILABLE')
    return value
  }
  const dataReads=new WeakMap<object,{dataSha256:string;readScope:string}>()
  const bookBasis=()=>({dataSha256:books()?.dataSha256,readScope:scope})
  const readBook=(name:string)=>{
    const entries=clone(book(name).entries),basis=bookBasis()
    dataReads.set(entries,basis)
    for(const entry of entries)dataReads.set(entry,basis)
    return entries
  }
  const mutateBook=async(name:string,mutation:any,basis=bookBasis())=>{
    const reply=await request('worldbook-mutate',{
      name,mutation,expectedDataSha256:basis.dataSha256},basis.readScope)
    if(reply.result.kind==='refused')throw Error(reply.result.diagnostics[0]?.code??'AUTHOR_WORLDBOOK_MUTATION_REFUSED')
    return reply
  }
  const retainedBookBasis=(entries:unknown[])=>{
    const captured=dataReads.get(entries)
    if(captured)return captured
    let basis:ReturnType<typeof bookBasis>|undefined
    for(const entry of entries){
      const read=entry&&typeof entry==='object'?dataReads.get(entry):undefined
      if(!read)continue
      if(basis&&(read.dataSha256!==basis.dataSha256||read.readScope!==basis.readScope))
        throw Error('AUTHOR_NATIVE_MIXED_READ_BASIS')
      basis=read
    }
    return basis??bookBasis()
  }
  const personas=()=>snapshot.personas as any
  const personaId=(id='current')=>id==='current'?personas()?.selectedId:id
  const selfScript=()=>{
    const address=snapshot.context?.script as any
    if(!address||typeof address.identity!=='string')throw Error('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE')
    return address
  }
  const buttonCatalog=createButtons(buttonScripts)
  const currentPreset=()=>{
    const value=snapshot.readonlyPreset
    if(value?.kind!=='available')throw Error('AUTHOR_NATIVE_CURRENT_PRESET_UNAVAILABLE')
    return value
  }
  const api:any={getVariables:variables,getAllVariables:()=>Object.assign({},variables({type:'global'}),
    variables({type:'character'}),variables({type:'script'}),variables()),getChatMessages,setChatMessages,
    getContext:()=>({...clone(snapshot.context),chat:getChatMessages()}),
    getLoadedPresetName:()=>currentPreset().loadedName,
    getTavernRegexes:createCurrentRegex(()=>snapshot),
    getPreset:(name:string)=>{
      const value=currentPreset()
      if(name!=='in_use'&&name!==value.loadedName)throw Error('AUTHOR_NATIVE_PRESET_SELECTOR_UNSUPPORTED')
      return clone(value.preset)
    },
    getLastMessageId:()=>snapshot.messages.length-1,
    ...variableWriters,
    eventOn:events.on,eventOnce:events.once,eventMakeFirst:events.makeFirst,eventMakeLast:events.makeLast,
    eventRemoveListener:events.remove,eventClearEvent:events.clearEvent,eventClearListener:events.clearListener,
    eventClearAll:events.clearAll,eventEmit:async(event:string,...args:any[])=>{await emit(event,args)},
    eventEmitAndWait:(event:string,...args:any[])=>events.emitAndWait(event,args),errorCatched:(fn:Function)=>(...args:any[])=>fn(...args),
    generateRaw:async(options:unknown)=>{const value=await request('generate-raw',{options});return value?.text??value},
    triggerSlash:async(command:string)=>{
      const result=await request('execute-commands',{command})
      if(result.kind!=='executed')throw Object.assign(Error(result.code),{result})
      return result.pipe
    },
    getResource:(address:string)=>request('resource-read',{resource:address}),
    getScriptId:()=>selfScript().id,
    getButtonEvent:(name:string)=>buttonCatalog.getButtonEvent(selfScript().id,name),
    getScriptButtons:()=>buttonCatalog.getScriptButtons(selfScript().id),
    getAllEnabledScriptButtons:buttonCatalog.getAllEnabledScriptButtons,
    getScriptData:(identity?:string)=>{
      const address=identity===undefined?selfScript():undefined
      const script=address&&{identity:address.identity,descriptorSha256:address.descriptorSha256,
        sourceSnapshotSha256:address.sourceSnapshotSha256,originalOrdinal:address.originalOrdinal}
      return request('resource-read',{resource:address?{kind:'self-script-data',script}:{kind:'script-data',identity}})
    },
    getWorldbookNames:()=>clone(books()?.names??[]),
    getCurrentCharPrimaryLorebook:()=>books()?.primaryName,
    getWorldbook:async(name:string)=>readBook(name),
    replaceWorldbook:async(name:string,entries:unknown[])=>{
      await mutateBook(name,{kind:'replace-worldbook',entries},retainedBookBasis(entries))
    },
    updateWorldbookWith:async(name:string,updater:Function)=>{
      const basis=bookBasis(),entries=await updater(readBook(name))
      return (await mutateBook(name,{kind:'replace-worldbook',entries},basis)).worldbook
    },createWorldbookEntries:async(name:string,entries:unknown[])=>{
      const reply=await mutateBook(name,{kind:'create-entries',entries})
      return {worldbook:reply.worldbook,new_entries:reply.new_entries}
    },
    deleteWorldbookEntries:async(name:string,predicate:Function)=>{
      const reply=await mutateBook(name,{kind:'delete-entries',
        uids:clone(book(name).entries).filter(predicate).map((row:any)=>row.uid)})
      return {worldbook:reply.worldbook,deleted_entries:reply.deleted_entries}
    },
    getPersonaIds:()=>personas()?.profiles.map((row:any)=>row.avatar_id)??[],
    getPersonaNames:()=>personas()?.profiles.map((row:any)=>row.name)??[],
    getCurrentPersonaId:()=>personaId(),getPersona:(id:string)=>{
      const persona=clone(personas()?.profiles.find((row:any)=>row.avatar_id===personaId(id)))
      if(persona)dataReads.set(persona,{dataSha256:personas().dataSha256,readScope:scope})
      return persona
    },
    createPersona:async(name:string,persona:unknown={})=>{
      const reply=await request('persona-mutate',{
        expectedDataSha256:personas()?.dataSha256,mutation:{kind:'create',name,persona}})
      if(reply.result.kind==='refused')throw Error(reply.result.code)
      return reply.result.receipt.result
    },
    replacePersona:async(id:string,persona:unknown)=>{
      const basis=persona&&typeof persona==='object'?dataReads.get(persona):undefined
      const reply=await request('persona-mutate',{
        expectedDataSha256:basis?.dataSha256??personas()?.dataSha256,
        mutation:{kind:'replace',id:personaId(id),persona}},basis?.readScope??scope)
      if(reply.result.kind==='refused')throw Error(reply.result.code)
    },
    injectPrompts:(prompts:any[],options:any={})=>{
      const rows=prompts.map(prompt=>{
        const {filter}=prompt
        if(filter!==undefined&&filter!==null&&typeof filter!=='function')throw Error('AUTHOR_NATIVE_INJECTION_FILTER_INVALID')
        const filterCallbackId=filter?crypto.randomUUID():undefined
        if(filterCallbackId)filters.set(filterCallbackId,filter)
        return {id:prompt.id??crypto.randomUUID(),position:prompt.position==='none'?'none':'in_chat',
          depth:prompt.depth??0,role:prompt.role??'system',content:prompt.content??'',should_scan:prompt.should_scan??false,
          ...filterCallbackId?{filterCallbackId}:{}}
      })
      const registrationOperationId=mutatePrompts({kind:'register',prompts:rows,once:options.once===true})
      let deleted=false
      return {uninject(){
        if(deleted)return
        deleted=true
        mutatePrompts({kind:'remove-ids',ids:rows.map(row=>row.id),registrationOperationId})
      }}
    },uninjectPrompts:(ids:string[])=>{
      mutatePrompts({kind:'remove-ids',ids:clone(ids)})
    },
  }
  api.SillyTavern={getContext:api.getContext}
  api.nextTavern={getNumericalState:()=>clone(snapshot.numerical),
    replaceNumericalValues:(values:unknown,expected:unknown)=>request('numerical-replace',{values,expected}),
    getComposer:()=>request('composer',{action:'get'}),setComposer:(value:string)=>request('composer',{action:'set',value})}
  api.Mvu=createMvu({snapshot:()=>snapshot,readScope:()=>scope,variables,
    replace:(value,readScope)=>request('numerical-replace',value,readScope)})
  api.waitGlobalInitialized=async(name:string)=>{
    if(!Object.hasOwn(realm,name))throw Error('AUTHOR_NATIVE_GLOBAL_UNAVAILABLE')
    // Product libraries and the Mvu facade are installed before Source runs.
    // Their presence does not grant numerical read/write permission.
  }
  api.event_types=api.tavern_events=clone(snapshot.context?.eventTypes??{})
  Object.assign(realm,api)
  realm.TavernHelper=api
  async function loadSource():Promise<void> {
    layout=createLayout(document,layoutConfig,height)
    // Helper Source is a module in TavernHelper. Each descriptor therefore has
    // its own lexical scope even when this permission group shares a window.
    // Blob payloads preserve raw strings and HTML closing delimiters verbatim.
    for(const library of libraries){
      const url=URL.createObjectURL(new Blob([library.javascript],{type:'text/javascript'}));sourceUrls.push(url)
      await new Promise<void>((resolve,reject)=>{
        const element=document.createElement('script');element.src=url
        element.onload=()=>resolve();element.onerror=()=>reject(Error('AUTHOR_NATIVE_LIBRARY_LOAD_FAILED'))
        document.head.appendChild(element)
      })
    }
    for(const source of scripts){
      if(!active)return
      const url=URL.createObjectURL(new Blob([source.javascript],{type:'text/javascript'}));sourceUrls.push(url)
      // import() resolves after module evaluation, including top-level await;
      // a mere bridge connection or script fetch is not Source readiness.
      await importModule(url)
    }
    if(active)send({op:'source-ready'})
  }
  const receive=async(data:any)=>{
    if(data.op==='layout-height-ack'){
      const write=layoutWrites.get(data.id);layoutWrites.delete(data.id)
      if(data.error)write?.reject(Error(data.error));else write?.resolve()
    }else if(data.op==='layout-config'){
      layoutRevision=data.revision;layoutConfig=data.config;layout?.update(layoutConfig,data.explicit)
    }else if(data.op==='reply'){
      const entry=pending.get(data.id);pending.delete(data.id)
      if(data.error)entry?.reject(Error(data.error))
      else {if(data.reply.snapshot){snapshot=data.reply.snapshot;scope=data.reply.readScope??scope;updateAvatarStyles()}
        entry?.resolve(data.reply.value);send({op:'ack-observed',id:data.id})}
    }else if(data.op==='snapshot'){snapshot=data.snapshot;scope=data.readScope;updateAvatarStyles()}
    else if(data.op==='event')await emit(data.event,data.args,data.callbackId?[data.callbackId]:undefined)
    else if(data.op==='callbacks')send({op:'control-reply',id:data.id,value:events.registrations()})
    else if(data.op==='invoke'){
      const input=data.invocation as AuthorNativeHelperGenerationInvocationV1
      if(invocation||mutableHook)throw Error('AUTHOR_NATIVE_GENERATION_BUSY')
      if(input.snapshot){snapshot=input.snapshot;scope=input.readScope??scope;updateAvatarStyles()}
      invocation={id:input.invocationId,effects:[],callbackId:''}
      try {const callbackIds=await emit(input.event,input.args,input.callbackIds)
        send({op:'control-reply',id:data.id,value:{invocationId:input.invocationId,
          callbackIds,effects:invocation.effects}})
      }finally{invocation=undefined}
    }else if(data.op==='invoke-filter'){
      const input=data.invocation,callback=filters.get(input.filterCallbackId)
      try {
        if(!callback)throw Error('AUTHOR_NATIVE_INJECTION_FILTER_RETIRED')
        const accepted=await callback()
        if(typeof accepted!=='boolean')throw Error('AUTHOR_NATIVE_INJECTION_FILTER_INVALID_RESULT')
        send({op:'control-reply',id:data.id,value:accepted})
      }catch(error){send({op:'control-reply',id:data.id,error:error instanceof Error?error.message:String(error)})}
    }else if(data.op==='retire-filters'){retireFilters(data.ids)
    }else if(data.op==='invoke-mvu-hook'){
      if(invocation||mutableHook)throw Error('AUTHOR_NATIVE_GENERATION_BUSY')
      const input=data.invocation as {invocationId:string;request:AuthorNativeMvuHookRequest;callbackIds:readonly string[]},
        payload=input.request.payload as any,stage=input.request.stage
      const event=stage==='command-parsed'?'mag_command_parsed':stage==='update-ended'
        ?'mag_variable_update_ended':'mag_before_message_update'
      const args=stage==='command-parsed'?[payload.variables,payload.commands,payload.message_content]
        :stage==='update-ended'?[payload.variables,payload.variables_before_update]:[payload.context]
      mutableHook={diagnostics:[],callbackId:''}
      try {
        const callbackIds=await emit(event,args,input.callbackIds),output=stage==='command-parsed'
          ?{variables:payload.variables,commands:payload.commands}:stage==='update-ended'
            ?{variables:payload.variables}:{context:payload.context}
        send({op:'control-reply',id:data.id,value:{invocationId:input.invocationId,callbackIds,
          result:{stage,output,diagnostics:mutableHook.diagnostics}}})
      }finally{mutableHook=undefined}
    }
  }
  const connect=(event:MessageEvent)=>{
    if(port||event.data?.op!=='connect'||event.data.channel!==channel||!event.ports[0])return
    port=event.ports[0];removeEventListener('message',connect)
    port.onmessage=event=>void receive(event.data).catch(error=>{
      if(event.data.id)send({op:'control-reply',id:event.data.id,error:error instanceof Error?error.message:String(error)})
      else report(error)
    });port.start()
    for(const message of queued)port.postMessage(message)
    queued.length=0;send({op:'bridge-ready'})
    void loadSource().catch(error=>send({op:'source-error',code:error instanceof Error?error.message:String(error)}))
  }
  addEventListener('message',connect)
  addEventListener('pagehide',()=>{active=false;port?.close();removeEventListener('message',connect)
    layout?.dispose();frameChanges.disconnect()
    for(const write of layoutWrites.values())write.reject(Error('AUTHOR_NATIVE_BINDING_REVOKED'))
    layoutWrites.clear()
    for(const entry of pending.values())entry.reject(Error('AUTHOR_NATIVE_BINDING_REVOKED'))
    pending.clear();events.dispose();filters.clear();queued.length=0
    for(const url of sourceUrls)URL.revokeObjectURL(url)
    sourceUrls.length=0},{once:true})
}

const json=(value:unknown)=>JSON.stringify(value).replaceAll('<','\\u003c')
export function authorNativeHelperHtml(program:AuthorNativeProgramV1,binding:AuthorNativeHelperRealmBindingV1,
  snapshot:AuthorNativeHelperSnapshotV1,readScope:string,channel:string,resource:AuthorNativeHelperResourceV1,
  libraries:readonly {readonly javascript:string}[]=[],layoutConfig:ReaderDocumentLayoutConfig={mode:'auto',viewportHeight:600}):string {
  return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'
    +READER_NATIVE_RESOURCE_CSP+'"><meta name="referrer" content="no-referrer"><style>body{margin:0}</style>'
    +'<script>('+authorNativeHelperBootstrap.toString()+')('
    +[snapshot,readScope,channel,binding.realmId,resource,
      program.scripts.filter(row=>row.enabled&&row.realmId===binding.realmId).map(({javascript})=>({javascript})),libraries]
      .map(json).join(',')+',('+createReaderDocumentLayoutRealm.toString()+'),'+json(layoutConfig)
    // Keep this native JS import expression at the HTML serialization boundary.
    // TypeScript rewrites variable imports using a module-scoped helper; that
    // helper is absent from the independently serialized child bootstrap.
    +',url=>import(url),('+createAuthorNativeMvuApi.toString()+'),('+createAuthorNativeEventOwner.toString()+'),('
    +createAuthorNativeScriptButtonCatalog.toString()+'),'+json(program.scripts.map(
      ({scriptId,identity,realmId,enabled,button,name})=>({scriptId,identity,realmId,enabled,button,name})))
    +',('+createAuthorNativeMessageVariables.toString()+'),('+createAuthorNativeCurrentRegex.toString()+'),('
    +createAuthorNativeVariableWriters.toString()+'))</script>'
}

export function createAuthorNativeHelperFrame(outer:HTMLElement,program:AuthorNativeProgramV1,
  binding:AuthorNativeHelperRealmBindingV1,initial:{snapshot:AuthorNativeHelperSnapshotV1;readScope:string},
  host:AuthorNativeHelperHostV1,options:AuthorNativeHelperFrameOptionsV1):AuthorNativeHelperFrameControllerV1 {
  const view=outer.ownerDocument.defaultView!,frame=outer.ownerDocument.createElement('iframe')
  const channel=crypto.randomUUID(),ports=new view.MessageChannel(),abort=new AbortController()
  let active=true,ready=false,sequence=0,lostAcknowledgement=false
  let resolveStarted!:()=>void,rejectStarted!:(error:Error)=>void,resolveDisposed!:()=>void
  let snapshot=initial.snapshot,readScope=initial.readScope,layoutRevision=0
  const layoutConfig=()=>options.documentLayout?.get()??{mode:'auto' as const,viewportHeight:view.innerHeight}
  const started=new Promise<void>((yes,no)=>{resolveStarted=yes;rejectStarted=no});void started.catch(()=>{})
  const disposed=new Promise<void>(yes=>{resolveDisposed=yes})
  const controls=new Map<number,{resolve(value:any):void;reject(error:Error):void}>()
  const writes=new Map<number,{done:Promise<void>;finish():void}>()
  const send=(message:object)=>ports.port1.postMessage(message)
  const current=()=>active&&options.current()
  ports.port1.onmessage=event=>{
    if(!current())return
    const data=event.data
    if(data.op==='parent-ready')send({op:'mount',html:authorNativeHelperHtml(program,binding,snapshot,readScope,channel,
      options.resource,options.libraries,layoutConfig()),libraries:options.libraries?.map(row=>row.javascript)??[],messageIndex:0,
      sdkGlobals:['getVariables','getAllVariables','getContext','getLastMessageId','getChatMessages','setChatMessages','updateVariablesWith','triggerSlash',
        'replaceVariables','insertOrAssignVariables','insertVariables','deleteVariable','eventOn','eventOnce','eventMakeFirst','eventMakeLast','eventRemoveListener',
        'eventEmit','eventEmitAndWait','eventClearEvent','eventClearListener','eventClearAll',
        'generateRaw','getResource','getScriptId','getScriptData','getButtonEvent','getScriptButtons','getAllEnabledScriptButtons',
        'getWorldbookNames','getWorldbook','replaceWorldbook','updateWorldbookWith','getTavernRegexes',
        'createWorldbookEntries','deleteWorldbookEntries','getCurrentCharPrimaryLorebook','getPersonaIds','getPersonaNames',
        'getCurrentPersonaId','getPersona','createPersona','replacePersona','injectPrompts','uninjectPrompts','SillyTavern',
        'nextTavern','Mvu','waitGlobalInitialized','event_types','tavern_events','errorCatched','TavernHelper']})
    else if(data.op==='parent-error'){rejectStarted(Error(data.code));options.failed?.(data.code)}
    else if(data.op==='source-ready'){ready=true;resolveStarted();send({op:'snapshot',snapshot,readScope})
      send({op:'layout-config',revision:layoutRevision,config:layoutConfig()})}
    else if(data.op==='source-error'){rejectStarted(Error(data.code));options.failed?.(data.code)}
    else if(data.op==='layout-height'){
      if(data.revision!==layoutRevision){send({op:'layout-height-ack',id:data.id,error:'AUTHOR_NATIVE_LAYOUT_SUPERSEDED'});return}
      frame.style.height=`${Math.ceil(data.height)}px`
      view.requestAnimationFrame(()=>{if(current())send({op:'layout-height-ack',id:data.id})})
    }else if(data.op==='control-reply'){
      const entry=controls.get(data.id);controls.delete(data.id)
      if(data.error)entry?.reject(Error(data.error));else entry?.resolve(data.value)
    }else if(data.op==='ack-observed'){writes.get(data.id)?.finish();writes.delete(data.id)}
    else if(data.op==='request'){
      let finish!:()=>void
      writes.set(data.id,{done:new Promise<void>(yes=>{finish=yes}),finish:()=>finish()})
      // The binding is captured by Main; no child realm or group field is used.
      void host.request(binding,data.request,abort.signal).then(reply=>{
        if(current())send({op:'reply',id:data.id,reply})
      },error=>{if(current())send({op:'reply',id:data.id,error:error instanceof Error?error.message:String(error)})
        if(data.request.operation==='mutate-prompts')lostAcknowledgement=true
        writes.get(data.id)?.finish();writes.delete(data.id)})
    }else if(data.op==='diagnostic')options.failed?.(data.code)
  }
  ports.port1.start()
  frame.setAttribute('credentialless','');frame.sandbox.add('allow-scripts','allow-same-origin')
  const unsubscribeLayout=options.documentLayout?.subscribe(explicit=>{
    layoutRevision++;if(current())send({op:'layout-config',revision:layoutRevision,config:layoutConfig(),explicit})
  })
  frame.title='作者原生助手';frame.style.cssText='display:block;width:100%;height:1px;border:0'
  const parent=new URL(options.parentOrigin);parent.hash=new URLSearchParams({channel}).toString()
  frame.addEventListener('load',()=>{if(current())frame.contentWindow!.postMessage({op:'connect-parent',channel},
    parent.origin,[ports.port2])},{once:true})
  frame.src=parent.href;outer.appendChild(frame)
  const control=async(op:string,payload:object,signal?:AbortSignal):Promise<any>=>{
    await started
    if(!current()||signal?.aborted)throw Error('AUTHOR_NATIVE_BINDING_REVOKED')
    return new Promise((resolve,reject)=>{
      const id=++sequence
      const cancelled=()=>{controls.delete(id);reject(Error('AUTHOR_NATIVE_INVOCATION_ABORTED'))}
      controls.set(id,{resolve:value=>{signal?.removeEventListener('abort',cancelled);resolve(value)},
        reject:error=>{signal?.removeEventListener('abort',cancelled);reject(error)}})
      signal?.addEventListener('abort',cancelled,{once:true});send({op,id,...payload})
    })
  }
  return {started,disposed,hardTermination:'unavailable',
    updateSnapshot(value,scope){snapshot=value;readScope=scope;if(current()&&ready)send({op:'snapshot',snapshot,readScope})},
    dispatchEvent(event,args,_resource,callbackId){if(current())send({op:'event',event,args,callbackId})},
    async waitForAdmittedSourceWrites(){await Promise.all([...writes.values()].map(row=>row.done))
      if(lostAcknowledgement)throw Error('AUTHOR_NATIVE_ACK_UNOBSERVED')},
    generationCallbacks:()=>control('callbacks',{}) as Promise<readonly AuthorNativeHelperGenerationCallbackV1[]>,
    invokeGeneration:(invocation,signal)=>control('invoke',{invocation},signal) as Promise<AuthorNativeHelperGenerationResultV1>,
    invokeFilter:(invocation,signal)=>control('invoke-filter',{invocation},signal) as Promise<boolean>,
    retireFilterCallbacks:ids=>{if(current())send({op:'retire-filters',ids})},
    invokeMvuHook:(invocation,signal)=>control('invoke-mvu-hook',{invocation},signal) as Promise<AuthorNativeHelperMvuHookResultV1>,
    dispose(){if(!active)return;active=false;abort.abort();unsubscribeLayout?.();ports.port1.close();ports.port2.close();frame.remove()
      rejectStarted(Error('AUTHOR_NATIVE_BINDING_REVOKED'))
      for(const entry of controls.values())entry.reject(Error('AUTHOR_NATIVE_BINDING_REVOKED'))
      controls.clear();lostAcknowledgement=writes.size>0
      for(const row of writes.values())row.finish();writes.clear();resolveDisposed()}}
}
