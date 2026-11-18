import {AUTHOR_NATIVE_MVU_HOOK_EVENTS} from '../core/author-native-mvu-hook-types.js'
import {createAuthorReaderSurface} from '../core/tavern-author-reader-surface.js'
import {createReaderDocumentLayoutRealm,type ReaderDocumentLayoutConfig} from '../core/tavern-author-reader-document-layout.js'
import {READER_NATIVE_RESOURCE_CSP} from '../core/reader-native-parent-realm.js'
import type {AuthorDomScene,AuthorDomSceneChild} from './author-dom-scene.js'
import type {RoleplayExtensionFailureV1} from '../core/roleplay-extension-types.js'
import {createAuthorNativeMvuApi} from './author-native-mvu-sdk.js'
import {createAuthorNativeMvuTrialEvents,runAuthorNativeMvuTrial} from './author-native-mvu-trial.js'
import {createAuthorNativeMvuHookGraph} from '../core/author-native-mvu-hook-graph.js'
import {createAuthorNativeEventOwner} from './author-native-events.js'
import {createAuthorNativeMessageVariables} from '../core/author-native-message-variables.js'
import {createAuthorNativeCurrentRegex,createAuthorNativeFormatterV1} from '../core/author-native-current-regex.js'
import {TAVERN_PROMPT_TRANSFORM_LIMITS_V1} from '../core/tavern-prompt-transform-types.mjs'
import {createAuthorNativeVariableWriters} from '../core/author-native-variable-writers.js'
import type {CommunityAuthorPresetCatalogV1} from '../core/community-preset-types.js'
import type {AuthorCharacterLibraryPacketV1} from '../core/roleplay-author-character-library.js'
import type {ReaderRegexDocumentSnapshotV1,ReaderRegexDocumentBindingV1,ReaderOpeningVariantReplyV1,
  ReaderNumericalReplyV1,ReaderCommandReplyV1,ReaderMessageBodyReplyV1,ReaderOrdinaryNamespaceReplyV1} from '../core/reader-regex-document-types.mjs'
import type {MvuPlayerEditRequest} from '../core/roleplay-mvu-player-types.js'
import type {ReaderNativeDocumentPlanV1,ReaderNativeLibraryV1,ReaderNativeReceiptObservationV1,ReaderNativeDocumentExecutionV1,
  ReaderNativeFrameLifecycleV1,ReaderNativeFrameOptionsV1,ReaderNativeDocumentFrameControllerV1} from '../core/reader-native-document-types.js'
import {createAuthorNativeGenerationApi} from '../core/author-native-generation-api.js'
import {createAuthorNativeCommandLanguageV1} from '../core/author-native-commands.js'
import type {AuthorNativeLibraryReadV1,AuthorNativeGenerationFilterV1} from '../core/author-native-helper-types.js'
import {createAuthorNativeSessionEventRouter} from './author-native-session-events.js'

export type {ReaderNativeDocumentFrameControllerV1} from '../core/reader-native-document-types.js'
export type ReaderNativeFrameFactoryV1=(outer:HTMLIFrameElement,
  binding:Omit<ReaderRegexDocumentBindingV1,'principal'>,program:{readonly programSha256:string},
  options:ReaderNativeFrameOptionsV1&{reportExtensionFailure?(failure:RoleplayExtensionFailureV1):void})=>ReaderNativeDocumentFrameControllerV1

/** Runs only inside an opaque author frame. It exposes captured reads and
 * typed asynchronous Native writers, never application DOM or credentials. */
function readerNativeBootstrap(initial:ReaderRegexDocumentSnapshotV1,channel:string,
  mounted:{seq:number;messageId:string;messageVersionSha256:string},
  layoutConfig:ReaderDocumentLayoutConfig,createLayout:typeof createReaderDocumentLayoutRealm,initialReadScope:string,
  createMvu:typeof createAuthorNativeMvuApi,createEvents:typeof createAuthorNativeEventOwner,
  createMessageVariables:typeof createAuthorNativeMessageVariables,createCurrentRegex:typeof createAuthorNativeCurrentRegex,
  createVariableWriters:typeof createAuthorNativeVariableWriters,routeEvents=false,
  createFormatter:typeof createAuthorNativeFormatterV1,formatterLimits:typeof TAVERN_PROMPT_TRANSFORM_LIMITS_V1,
  initialPresetLibrary?:CommunityAuthorPresetCatalogV1,initialCharacterLibrary?:AuthorCharacterLibraryPacketV1,
  createGeneration?:typeof createAuthorNativeGenerationApi,generationRealmId='',
  createCommands?:typeof createAuthorNativeCommandLanguageV1,
  createTrialEvents?:typeof createAuthorNativeMvuTrialEvents,createHookGraph?:typeof createAuthorNativeMvuHookGraph,
  hookEvents:typeof AUTHOR_NATIVE_MVU_HOOK_EVENTS=AUTHOR_NATIVE_MVU_HOOK_EVENTS):void {
  parent.dispatchEvent(new CustomEvent('nexttavern-author-realm-ready',{detail:window.frameElement}))
  const realm=window as any
  const actualFrame=window.frameElement as HTMLIFrameElement
  let ownFrameHeight=actualFrame?.style.height,authorPaused=false
  const frameObserver=actualFrame?new MutationObserver(records=>{
    if(!records.some(record=>record.attributeName==='height')&&actualFrame.style.height===ownFrameHeight)return
    ownFrameHeight=actualFrame.style.height;authorPaused=true;layout?.pause()
    send({op:'author-height',height:actualFrame.getBoundingClientRect().height})
  }):undefined
  frameObserver?.observe(actualFrame,{attributes:true,attributeFilter:['style','height']})
  let snapshot:any=initial,active=true,sequence=0,documentReady=false
  let presetLibrary=initialPresetLibrary,characterLibrary=initialCharacterLibrary
  const libraryReads=new Map<string,AuthorNativeLibraryReadV1>(),filters=new Map<string,Function>()
  const presetRead=(selector:string,operation:Extract<AuthorNativeLibraryReadV1,{kind:'preset'}>['operation'])=>{
    if(presetLibrary){const read={kind:'preset' as const,revision:presetLibrary.revision,selector,operation}
      libraryReads.set(JSON.stringify(read),read)}
  }
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
  // ACKs refresh display DATA, but only an explicit message read advances the
  // default write basis. Retained DTOs keep the scope that produced them.
  let snapshotReadScope=initialReadScope,lastExplicitReadScope=initialReadScope
  const readScopes=new WeakMap<object,string>()
  const messageObjects=(rows:any[])=>[rows,...rows.flatMap(row=>
    [row,row.data,row.extra,row.swipes,row.swipes_data,row.swipes_info,
      ...(row.swipes_data??[]),...(row.swipes_info??[])])]
  const pending=new Map<number,{resolve(value:unknown):void;reject(error:Error):void;operationId?:string}>()
  let layout:ReturnType<typeof createReaderDocumentLayoutRealm>|undefined,layoutRevision=0
  const layoutWrites=new Map<number,{resolve():void;reject(error:Error):void}>()
  let port:MessagePort|undefined
  const outgoing:object[]=[]
  const send=(data:object)=>{if(port)port.postMessage(data);else outgoing.push(data)}
  const clone=(value:any)=>value===undefined?undefined:structuredClone(value)
  const currentPreset=()=>{
    const value=snapshot.readonlyPreset
    if(value?.kind!=='available')throw Error('AUTHOR_NATIVE_CURRENT_PRESET_UNAVAILABLE')
    return value
  }
  realm.getPresetNames=()=>{
    presetRead('in_use','names')
    if(!presetLibrary)throw Error('AUTHOR_NATIVE_PRESET_LIBRARY_UNAVAILABLE')
    return clone(presetLibrary.names)
  }
  realm.getLoadedPresetName=()=>{presetRead('in_use','loaded');return presetLibrary?presetLibrary.loaded?.name??'':currentPreset().loadedName}
  const currentRegexes=createCurrentRegex(()=>({...snapshot,characterLibrary,
    ...presetLibrary?{tavernRegexes:{...snapshot.tavernRegexes,global:presetLibrary.globalRegexes}}:{}}))
  realm.getTavernRegexes=(options:any={})=>{
    if(options.type==='preset')presetRead(options.name??'in_use','regex')
    else if(options.type==='global')presetRead('in_use','global-regex')
    if(presetLibrary&&options.type==='preset')return clone(realm.getPreset(options.name??'in_use').extensions.regex_scripts??[])
    return currentRegexes(options)
  }
  realm.getPreset=(name='in_use')=>{
    presetRead(name,'value')
    if(presetLibrary){
      const data=name==='in_use'?presetLibrary.current.data:presetLibrary.presets.find(row=>row.name===name)?.data
      if(!data)throw Error('AUTHOR_NATIVE_PRESET_SELECTOR_UNSUPPORTED')
      return clone(data)
    }
    const value=currentPreset()
    if(name!=='in_use'&&name!==value.loadedName)throw Error('AUTHOR_NATIVE_PRESET_SELECTOR_UNSUPPORTED')
    return clone(value.preset)
  }
  realm.getWorldbookNames=()=>clone(snapshot.worldbook?.names??[])
  realm.getCurrentCharPrimaryLorebook=()=>snapshot.worldbook?.primaryName??null
  let bookReadScope=snapshotReadScope
  const loadedBooks=new Map<string,any>()
  realm.getWorldbook=async(name:string)=>{
    if(bookReadScope!==snapshotReadScope){bookReadScope=snapshotReadScope;loadedBooks.clear()}
    const catalog=snapshot.worldbook,book=loadedBooks.get(name)??catalog?.books.find((value:any)=>value.name===name)
    if(book?.entries)return clone(book.entries)
    if(!catalog?.names.includes(name))throw Error('AUTHOR_NATIVE_WORLDBOOK_UNAVAILABLE')
    const readScope=snapshotReadScope,reply:any=await request('worldbook-read',{
      name,expectedDataSha256:catalog.dataSha256,readScope})
    if(readScope!==snapshotReadScope)throw Error('READER_READ_BASIS_CHANGED')
    loadedBooks.set(name,reply)
    return clone(reply.entries)
  }
  realm.getGlobalWorldbookNames=()=>clone(snapshot.worldbook?.globalNames??[])
  realm.getCharWorldbookNames=(name='current')=>{
    if(name!=='current'){
      if(!characterLibrary)throw Error('AUTHOR_NATIVE_CHARACTER_LIBRARY_UNAVAILABLE')
      const key=name.toLowerCase(),entry=characterLibrary.entries.find(row=>
        row.descriptor.name.toLowerCase()===key||row.descriptor.avatar?.toLowerCase()===key),selection=entry?.binding.selection
      if(selection?.kind!=='character')throw Error('READER_CHARACTER_SELECTOR_UNSUPPORTED')
      const bookName=(id:string|null)=>id===null?null:characterLibrary!.catalog.names.find(book=>book.bookId===id)?.name??null
      return {primary:bookName(selection.primary),additional:selection.additional.flatMap(id=>{
        const value=bookName(id);return value===null?[]:[value]
      })}
    }
    return clone(snapshot.worldbook?.characterNames??{primary:null,additional:[]})
  }
  realm.getChatWorldbookName=(name='current')=>{
    if(name!=='current')throw Error('READER_CHAT_SELECTOR_UNSUPPORTED')
    return snapshot.worldbook?.chatName??null
  }
  const value=(scope:any)=>scope?.kind==='available'?scope.variables:undefined
  const sharedCapture=(options:any)=>{
    const scopes=snapshot.sharedScopes,extensions=scopes?.extensions,
      capture=options.type==='extension'
        ?extensions&&Object.hasOwn(extensions,options.extension_id)?extensions[options.extension_id]:undefined
        :scopes?.[options.type]
    if(!capture)throw Error('READER_VARIABLE_SCOPE_UNAVAILABLE')
    return capture
  }
  const variables=(options:any={type:'chat'})=>{
    if(!active)throw Error('READER_BINDING_REVOKED')
    const type=options.type??'chat'
    if(type==='chat'){
      const base=value(snapshot.scopeFrame.scopes.chat)??{},retained=snapshot.ordinaryChat.replaceOrdinary
        ?Object.hasOwn(base,'stat_data')?{stat_data:base.stat_data}:{}:base
      const table={...clone(retained),...clone(snapshot.ordinaryChat.values)}
      for(const key of snapshot.ordinaryChat.deletedKeys??[])delete table[key]
      return table
    }
    if(type==='global')return clone(snapshot.preparedSharedScopes?.global?.values??sharedCapture(options).values)
    if(type==='character'||type==='preset'||type==='extension')return clone(sharedCapture(options).values)
    if(type==='message'){
      return clone(messageData().resolve(options).values)
    }
    throw Error('READER_VARIABLE_SCOPE_UNAVAILABLE')
  }
  let formatter:ReturnType<typeof createAuthorNativeFormatterV1>|undefined
  realm.formatAsTavernRegexedString=(...args:Parameters<ReturnType<typeof createAuthorNativeFormatterV1>>)=>{
    if(!active)throw Error('READER_BINDING_REVOKED')
    const kernel=realm.__nextTavernPromptTextKernelV1
    if(!kernel)throw Error('AUTHOR_NATIVE_FORMATTER_UNAVAILABLE')
    formatter??=createFormatter(context=>{
      const captured=snapshot.formatter
      if(!captured)return snapshot
      const depth=context?.depth??null,rows=snapshot.messages,
        message=depth===null?rows.findLast((row:any)=>row.variables.kind==='available'
          ||messageData().forMessage(row).capture?.exists):rows[rows.length-depth-1],
        resolved=messageData().forMessage(message),values=resolved.values,
        messageScope=message?{scope:'message' as const,ownerId:message.ownerSessionId+':'+message.messageId,
          versionSha256:kernel.recordSha256({messageVersionSha256:message.messageVersionSha256,
            ordinaryRoot:resolved.capture?.root??null}),values,valuesSha256:kernel.recordSha256(values)}:null
      return {formatter:{...captured,macros:{...captured.macros,
        variableScopes:{...captured.macros.variableScopes,message:messageScope,
          ...snapshot.preparedSharedScopes?.global?{global:snapshot.preparedSharedScopes.global}:{}}}}}
    },kernel,formatterLimits,(scope,key)=>{
      const value=variables({type:scope})[key]
      return {value:value===undefined?'':typeof value==='string'?value:JSON.stringify(value)}
    })
    return formatter(...args)
  }
  const events=createEvents({create:event=>({event}),report:error=>send({op:'diagnostic',
    code:error instanceof Error?error.message:String(error)})})
  const emit=async(name:string,args:any[])=>{await events.emit(name,args)}
  const trialEvents=createTrialEvents?.(createHookGraph!,events.registrations,events.request,hookEvents)
  const request=(op:string,payload:any)=>new Promise((resolve,reject)=>{
    if(!active){reject(Error('READER_BINDING_REVOKED'));return}
    const id=++sequence;pending.set(id,{resolve,reject,operationId:payload.operationId})
    try {send({id,op,payload})}catch(error){pending.delete(id);reject(error)}
  })
  const generation=createGeneration!({realmId:generationRealmId,current:()=>active,filters,
    request:(operation,payload,operationId)=>request(operation,{...payload as object,operationId}),
    emit:(event,args)=>routeEvents?request('emit-event',{event,args}):emit(event,[...args])})
  Object.assign(realm,{generate:generation.generate,generateRaw:generation.generateRaw,
    placeholder_prompt_default_order:generation.placeholder_prompt_default_order,builtin_prompt_default_order:generation.builtin_prompt_default_order,
    stopGenerationById:generation.stopGenerationById,stopAllGeneration:generation.stopAllGeneration})
  realm.iframe_events={GENERATION_REQUESTED:'js_generation_requested',GENERATION_STARTED:'js_generation_started',
    GENERATION_BEFORE_END:'js_generation_before_end',GENERATION_ENDED:'js_generation_ended',
    STREAM_TOKEN_RECEIVED_FULLY:'js_stream_token_received_fully',STREAM_TOKEN_RECEIVED_INCREMENTALLY:'js_stream_token_received_incrementally',
    REASONING_TOKEN_RECEIVED_FULLY:'js_reasoning_token_received_fully',REASONING_TOKEN_RECEIVED_INCREMENTALLY:'js_reasoning_token_received_incrementally'}
  realm.event_types=realm.tavern_events={...snapshot.context?.eventTypes,GENERATION_STOPPED:'generation_stopped'}
  realm.getVariables=variables
  Object.assign(realm,createVariableWriters((options:any)=>{
    const type=options.type??'chat',readScope=snapshotReadScope
    if(!['chat','message','global','character','preset','extension'].includes(type))throw Error('READER_VARIABLE_SCOPE_UNAVAILABLE')
    const selector=type==='message'?{type:'message' as const,message_id:options.message_id??'latest'}
      :type==='extension'?{type:'extension' as const,extension_id:options.extension_id}:type==='chat'?undefined:{type}
    const current=type==='message'?clone(messageData().resolve({type:'message',message_id:options.message_id??'latest'},true).values)
      :['global','character','preset','extension'].includes(type)?clone(sharedCapture(options).values):variables(options)
    const replaceNumerical=type==='chat'?captureChatVariableReplacement():undefined
    return {variables:current,commit:async(nextVariables:any)=>{
      const numerical=replaceNumerical?.(nextVariables)
      if(numerical)return numerical
      const reply:any=await request('mutate-namespace',{readScope,operationId:crypto.randomUUID(),
        nextVariables,...selector?{selector}:{}})
      if(reply.snapshot){snapshot=reply.snapshot;snapshotReadScope=reply.readScope;updateAvatarStyles()}
      else if(reply.reply.kind!=='no-update'){active=false;events.dispose()}
      return reply.reply
    }}
  },()=>realm._))
  realm.getAllVariables=()=>{
    if(!active)throw Error('READER_BINDING_REVOKED')
    const prefix=snapshot.readerVariables?.find((row:any)=>row.target.nativeSeq===mounted.seq
      &&row.target.messageId===mounted.messageId&&row.target.messageVersionSha256===mounted.messageVersionSha256)
    if(!prefix)throw Error('READER_VARIABLE_TARGET_UNAVAILABLE')
    // The canonical owner maintains the selected-page prefix. This realm only
    // detaches its mounted result; latest chat state cannot overwrite old HUDs.
    return {...variables({type:'global'}),...snapshot.sharedScopes?.character?variables({type:'character'}):{},...clone(prefix.values)}
  }
  realm.getCurrentMessageId=()=>snapshot.messages.find((row:any)=>row.messageId===mounted.messageId)?.index
  realm.getLastMessageId=()=>snapshot.messages.length-1
  realm.getChatMessages=(range:any='0-{{lastMessageId}}',options:any={})=>{
    const rows=snapshot.messages,last=rows.length-1
    const position=(id:any)=>{const n=Number(String(id).replaceAll('{{lastMessageId}}',String(last)))
      return n<0?rows.length+n:n}
    const match=String(range).match(/^(-?\d+|\{\{lastMessageId\}\})(?:-(-?\d+|\{\{lastMessageId\}\}))?$/)
    if(!match)return []
    const first=position(match[1]),end=position(match[2]??match[1])
    const result=rows.filter((row:any)=>row.index>=Math.min(first,end)&&row.index<=Math.max(first,end)
      &&(options.hide_state==='hidden'?row.is_hidden===true:options.hide_state==='unhidden'?row.is_hidden!==true:true)
      &&(!options.role||options.role==='all'||row.role===options.role))
      .map((row:any)=>clone(messageData().chatMessage(row,options.include_swipes===true)))
    lastExplicitReadScope=snapshotReadScope
    for(const object of messageObjects(result))if(object&&typeof object==='object')readScopes.set(object,snapshotReadScope)
    return result
  }
  realm.setChatMessages=async(rows:any,options:any={})=>{
    const scopes=new Set(messageObjects(rows).map(object=>object&&typeof object==='object'?readScopes.get(object):undefined)
      .filter(scope=>scope!==undefined))
    if(scopes.size>1)throw Error('READER_MIXED_READ_BASIS')
    const readScope=scopes.values().next().value??lastExplicitReadScope
    const reply:any=await request('set-chat-messages',{operationId:crypto.randomUUID(),
      readScope,rows,refresh:options.refresh??'affected'})
    if(reply.result.kind!=='committed'&&reply.result.kind!=='unchanged')throw Error(reply.result.code)
    if(reply.mutationKind==='body'||reply.mutationKind==='unchanged')return reply.result
    if(reply.snapshot){snapshot=reply.snapshot;snapshotReadScope=reply.readScope;updateAvatarStyles()}
    else {active=false;events.dispose()}
  }
  realm.setChatMessage=(fields:Parameters<ReturnType<typeof createAuthorNativeMessageVariables>['legacySetChatMessage']>[0],
    messageId:number,options:Parameters<ReturnType<typeof createAuthorNativeMessageVariables>['legacySetChatMessage']>[2]={})=>{
    const update=messageData().legacySetChatMessage(fields,messageId,options,(text,index)=>(
      realm.__nextTavernPromptTextKernelV1?.hasMacroSyntax(text)??text.includes('{{'))
      ?realm.formatAsTavernRegexedString(text,snapshot.messages[index]?.role==='user'?'user_input':'ai_output','prompt',
        {depth:snapshot.messages.length-index-1,macrosOnly:true}):text)
    for(const row of update.rows)readScopes.set(row,snapshotReadScope)
    return realm.setChatMessages(update.rows,{refresh:update.refresh})
  }
  realm.triggerSlash=async(command:string)=>{
    if(createCommands) {
      const language=createCommands(),operationId=crypto.randomUUID(),pipeline=language.parse(command),
        result=await language.execute(pipeline,operationId,{
          assertCurrent(){if(!active)throw Error('READER_BINDING_REVOKED')},
          release:async()=>{await request('command-release',{operationId})},
          readVariable:(type,key)=>variables({type})[key],
          async writeVariable(type,key,value,stepId){
            const current=type==='global'?clone(sharedCapture({type}).values):variables({type}),
              reply:any=await request('mutate-namespace',{readScope:snapshotReadScope,operationId:stepId,
                nextVariables:{...current,[key]:value},...type==='global'?{selector:{type}}:{}})
            if(reply.snapshot){snapshot=reply.snapshot;snapshotReadScope=reply.readScope;updateAvatarStyles()}
            else if(reply.reply.kind!=='no-update')throw Error('READER_BINDING_REVOKED')
          },
          input:async(text,defaultValue,stepId)=>await request('command-input',{text,defaultValue,operationId:stepId}) as string,
          echo:async(text,stepId)=>{await request('command-echo',{text,operationId:stepId})},
          async remote(step,original,pipe){
            const reply:any=await request('execute-commands',{command:'',step,pipe,operationId:original,readScope:snapshotReadScope})
            if(reply.snapshot){snapshot=reply.snapshot;snapshotReadScope=reply.readScope;updateAvatarStyles()}
            return reply.result
          },
        })
      if(result.kind!=='executed')throw Object.assign(Error(result.code),{result})
      return result.pipe
    }
    const reply:any=await request('execute-commands',{command,operationId:crypto.randomUUID(),readScope:snapshotReadScope})
    if(reply.snapshot){snapshot=reply.snapshot;snapshotReadScope=reply.readScope;updateAvatarStyles()}
    if(reply.result.kind!=='executed')throw Object.assign(Error(reply.result.code),{result:reply.result})
    return reply.result.pipe
  }
  const {captureChatVariableReplacement,...mvu}=createMvu({snapshot:()=>snapshot,readScope:()=>snapshotReadScope,variables,
    parse:(message,oldData)=>request('parse-mvu-message',{message,oldData,trialId:crypto.randomUUID()}) as Promise<import('../core/tavern-mvu-initvar.js').MvuJsonObject>,
    replace:async(value,readScope)=>{
      const reply:any=await request('numerical-replace',{...value,readScope,operationId:crypto.randomUUID()})
      if(reply.snapshot){snapshot=reply.snapshot;snapshotReadScope=reply.readScope;updateAvatarStyles()}
      else if(reply.result.operation?.outcome==='updated'||reply.result.operation?.outcome==='no-update') {
        active=false;events.dispose()
      }
      for(const event of reply.sourceEvents??[])await emit(event.type,event.args)
      return reply.result
    }},hookEvents)
  realm.Mvu=mvu
  realm.waitGlobalInitialized=async(name:string)=>{
    if(!Object.hasOwn(realm,name))throw Error('READER_GLOBAL_UNAVAILABLE')
    // Library installation is separate from numerical readiness and permission.
  }
  realm.eventOn=events.on
  realm.eventOnce=events.once
  realm.eventMakeFirst=events.makeFirst
  realm.eventMakeLast=events.makeLast
  realm.eventRemoveListener=events.remove
  realm.eventClearEvent=events.clearEvent
  realm.eventClearListener=events.clearListener
  realm.eventClearAll=events.clearAll
  realm.eventEmit=async(name:string,...args:any[])=>{
    if(!active)return
    if(!routeEvents){await emit(name,args);return}
    await request('emit-event',{event:name,args})
  }
  realm.eventEmitAndWait=(name:string,...args:any[])=>{
    events.emitAndWait(name,args)
    if(!active||!routeEvents)return
    void request('emit-event',{event:name,args,excludeSelf:true}).catch(error=>send({op:'diagnostic',
      code:error instanceof Error?error.message:String(error)}))
  }
  realm.errorCatched=(fn:Function)=>(...args:any[])=>fn(...args)
  realm.SillyTavern={getContext:()=>{
    const captured=snapshotReadScope
    const draft=messageData().contextChatDraft(rows=>{
      for(const row of rows)readScopes.set(row,captured)
      return realm.setChatMessages(rows)
    })
    return {...clone(snapshot.context),...draft,Mvu:realm.Mvu,setChatMessage:realm.setChatMessage}
  }}
  const receive=(event:MessageEvent)=>{
    if(!active)return
    const data=event.data
    if(data.op==='layout-config'){
      if(data.explicit)authorPaused=false
      layoutRevision=data.revision;layoutConfig=data.payload;layout?.update(layoutConfig,data.explicit)
    }else if(data.op==='layout-pause')layout?.pause()
    else if(data.op==='layout-height-ack'){
      const write=layoutWrites.get(data.id);layoutWrites.delete(data.id)
      if(data.error)write?.reject(Error(data.error));else write?.resolve()
    }else if(data.op==='snapshot'){snapshot=data.payload;snapshotReadScope=data.readScope;updateAvatarStyles()}
    else if(data.op==='preset-library')presetLibrary=data.catalog
    else if(data.op==='character-library')characterLibrary=data.packet
    else if(data.op==='source-event')void (async()=>{
      if(data.payload.requested){
        if(data.payload.type==='js_generation_requested'){
          generation.beginRequested(data.payload.operationId);data.payload.args[2]=generation.decode(data.payload.args[2])
        }
        await events.request(data.payload.type,data.payload.args)
        if(data.payload.type==='js_generation_requested')
          data.payload.args[2]=generation.encode(data.payload.args[2],data.payload.args[0],data.payload.operationId,true)
      }else await emit(data.payload.type,data.payload.args)
    })().then(()=>{
      if(data.id)send({op:'event-ack',id:data.id,value:data.payload.args})
    },error=>{if(data.id)send({op:'event-ack',id:data.id,error:String(error)})})
    else if(data.op==='mvu-trial-interests')send({op:'event-ack',id:data.id,value:trialEvents?.interests()??[]})
    else if(data.op==='mvu-trial-hook')void trialEvents!.invoke(data.stage,data.graph)
      .then(graph=>send({op:'event-ack',id:data.id,value:graph}),error=>send({op:'event-ack',id:data.id,error:String(error)}))
    else if(data.op==='generation-cancel')generation.stopLocal(data.operationId)
    else if(data.op==='generation-release-filters')generation.releaseFilters(data.operationId,data.ids)
    else if(data.op==='generation-library-reads')send({op:'event-ack',id:data.id,value:[...libraryReads.values()]})
    else if(data.op==='generation-invoke-filter')void generation.invokeFilter(data.callbackId,data.operationId)
      .then(value=>send({op:'event-ack',id:data.id,value:[value]}),error=>send({op:'event-ack',id:data.id,error:String(error)}))
    else if(data.op==='reply'){
      const entry=pending.get(data.id);pending.delete(data.id)
      if(data.error)entry?.reject(Error(data.error))
      else if(entry){
        entry.resolve(data.payload)
        const result=data.payload?.result,ordinary=data.payload?.reply,
          operationId=ordinary&&(ordinary.kind==='committed'||ordinary.kind==='replayed')?entry.operationId
            :result?.kind==='committed'?result.operationId:result?.operation
            &&result.operation.outcome!=='unknown'?result.operation.operationId
            :result?.steps?.at(-1)?.receipt?.operationId
        if(operationId)queueMicrotask(()=>send({op:'receipt-observed',id:data.id,operationId}))
      }
    }
  }
  const connect=(event:MessageEvent)=>{
    if(!active||port||event.data?.channel!==channel||event.data.op!=='connect'||!event.ports[0])return
    port=event.ports[0];removeEventListener('message',connect)
    port.onmessage=receive;port.start()
    port.postMessage({op:'connected'})
    for(const data of outgoing)port.postMessage(data)
    outgoing.length=0
  }
  addEventListener('message',connect)
  addEventListener('error',(event:ErrorEvent)=>{
    if(active&&event.error)send({op:documentReady?'diagnostic':'document-error',code:event.message,line:event.lineno,column:event.colno})
  })
  addEventListener('pagehide',()=>{
    generation.dispose();active=false;events.dispose();removeEventListener('message',connect)
    frameObserver?.disconnect()
    if(port){port.onmessage=null;port.close()}
    outgoing.length=0
    layout?.dispose()
    for(const write of layoutWrites.values())write.reject(Error('READER_BINDING_REVOKED'))
    layoutWrites.clear()
    for(const entry of pending.values())entry.reject(Error('READER_BINDING_REVOKED'))
    pending.clear()
  },{once:true})
  addEventListener('DOMContentLoaded',()=>{
    layout=createLayout(document,layoutConfig,height=>new Promise<void>((resolve,reject)=>{
      ownFrameHeight=Math.ceil(height)+'px';actualFrame.style.height=ownFrameHeight
      const id=++sequence;layoutWrites.set(id,{resolve,reject})
      send({op:'layout-height',id,revision:layoutRevision,payload:{height}})
    }))
    if(authorPaused)layout.pause()
    documentReady=true;send({op:'ready'})
  },{once:true})
}

const json=(value:unknown)=>JSON.stringify(value).replaceAll('<','\\u003c')
const script=(javascript:string)=>'<script>'+javascript.replace(/<\/script/gi,'<\\/script')+'</script>'

/** The parent enters the browser's credentialless partition before receiving
 * this HTML. Ordinary browser resource loading keeps Source URL semantics. */
export function readerNativeDocumentHtml(plan:ReaderNativeDocumentPlanV1,snapshot:ReaderRegexDocumentSnapshotV1,
  channel:string,libraries:readonly ReaderNativeLibraryV1[]=[],layoutConfig:ReaderDocumentLayoutConfig={mode:'auto',viewportHeight:600},
  readScope=channel,routeEvents=false,presetLibrary?:CommunityAuthorPresetCatalogV1,
  characterLibrary?:AuthorCharacterLibraryPacketV1):string {
  return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" '
    +'content="'+READER_NATIVE_RESOURCE_CSP+'"><meta name="referrer" content="no-referrer">'
    +script('('+readerNativeBootstrap.toString()+')('+json(snapshot)+','+json(channel)+','+json(plan.origin.message)
    +','+json(layoutConfig)+',('+createReaderDocumentLayoutRealm.toString()+'),'+json(readScope)
      +',('+createAuthorNativeMvuApi.toString()+'),('+createAuthorNativeEventOwner.toString()+'),('
      +createAuthorNativeMessageVariables.toString()+'),('+createAuthorNativeCurrentRegex.toString()+'),('
      +createAuthorNativeVariableWriters.toString()+'),'+json(routeEvents)+',('
      +createAuthorNativeFormatterV1.toString()+'),'+json(TAVERN_PROMPT_TRANSFORM_LIMITS_V1)+','
      +(presetLibrary?json(presetLibrary):'undefined')+','+(characterLibrary?json(characterLibrary):'undefined')
      +',('+createAuthorNativeGenerationApi.toString()+'),'+json('reader:'+plan.documentPlanSha256)+',('
      +createAuthorNativeCommandLanguageV1.toString()+'),('+createAuthorNativeMvuTrialEvents.toString()+'),('
      +createAuthorNativeMvuHookGraph.toString()+'),'+json(AUTHOR_NATIVE_MVU_HOOK_EVENTS)+')')
    +libraries.map(library=>script(library.javascript)).join('')+plan.html
}

/** Reversible factory for the normal Reader session seam. It deliberately
 * refuses to pretend opaque parent access or iframe removal is a hard kill. */
export function createReaderNativeDocumentFrameFactory(documents:readonly ReaderNativeDocumentPlanV1[],
  libraries:readonly ReaderNativeLibraryV1[]=[],settings:{parentOrigins:ReaderNativeDocumentExecutionV1['parentOrigins'];
    receiptObservationDeadlineMs?:number;viewportHeightPx?:number;
    commandUi?:import('../core/author-native-commands.js').AuthorNativeCommandUiV1;scene?:Promise<AuthorDomScene>}):ReaderNativeFrameFactoryV1 {
  return (outer,binding,program,options)=>{
    interface FrameRow {
      frame:HTMLElement;channel:string;connected:boolean;ready:boolean
      readScope:string;readRevision:number;snapshot:ReaderRegexDocumentSnapshotV1;
      ownHeight:string;layoutPaused:boolean;layoutRevision:number;observer?:MutationObserver;
      port:MessagePort;transferPort:MessagePort;connect():void
      eventEndpoint?:ReturnType<NonNullable<ReaderNativeFrameOptionsV1['eventRoute']>['register']>
      eventAcks:Map<number,{resolve(value:unknown):void;reject(error:Error):void}>
      sceneChild?:AuthorDomSceneChild
    }
    const view=outer.ownerDocument.defaultView!,abort=new AbortController(),frames=new Map<string,FrameRow>()
    const commandInteractions=new Map<string,Promise<unknown>>()
    const eventRoute=options.eventRoute??createAuthorNativeSessionEventRouter(),
      auxiliary=new Map<string,{documentPlanSha256:string;started:boolean;settled:boolean;
        reservation:ReturnType<typeof eventRoute.reserveGeneration>}>()
    const unmountedDocuments=new Map<string,number>()
    const renderedDocuments=new Map<string,ReaderNativeDocumentPlanV1>()
    for(const plan of documents){
      const messageId=plan.origin.message.messageId
      unmountedDocuments.set(messageId,(unmountedDocuments.get(messageId)??0)+1)
    }
    interface Receipt {
      readonly frame:HTMLElement
      readonly done:Promise<ReaderNativeReceiptObservationV1>
      finish(value:ReaderNativeReceiptObservationV1):void
      operationId?:string
      timer?:number
    }
    const writes=new Map<object,Receipt>()
    let unobservedReceipt=false,observedReceipt=false
    const surface=options.surface??createAuthorReaderSurface(outer,{current:options.current,
      sessionId:binding.sessionId,reportExtensionFailure:options.reportExtensionFailure,
      layout:options.layout,mountStaticDocument:options.mountStaticDocument,nativeDocuments:true})
    let active=true,booted=false,eventSequence=0,snapshot:ReaderRegexDocumentSnapshotV1|undefined
    let presetLibrary=options.presetLibrary,characterLibrary=options.characterLibrary
    let resolveStarted!:()=>void,rejectStarted!:(error:Error)=>void,resolveDisposed!:()=>void
    const started=new Promise<void>((yes,no)=>{resolveStarted=yes;rejectStarted=no})
    void started.catch(()=>{})
    const disposed=new Promise<void>(yes=>{resolveDisposed=yes})
    let resolveBridgeRevoked!:()=>void,resolveFramesRemoved!:()=>void
    const lifecycle:ReaderNativeFrameLifecycleV1={backend:'native-browser',hardTermination:'unavailable',
      bridgeRevoked:new Promise<void>(yes=>{resolveBridgeRevoked=yes}),
      framesRemoved:new Promise<void>(yes=>{resolveFramesRemoved=yes})}
    const current=()=>active&&options.current()
    const reportFailure=(code:string,plan:ReaderNativeDocumentPlanV1|undefined,impact:RoleplayExtensionFailureV1['impact'],
      location?:{line?:number;column?:number})=>{
      if(impact==='partial'&&['AUTHOR_GENERATION_CANCELLED','ABORTED'].includes(code))return
      if(code==='READER_BINDING_REVOKED')impact='story-paused'
      options.reportExtensionFailure?.({schemaVersion:1,sessionId:binding.sessionId,id:(plan?.documentPlanSha256??'reader')+':'+code,
        extension:'reader',code,phase:'document',sourceRevision:program.programSha256,impact,
        sourcePointer:plan?.origin.encoding==='reader-regex-document-origin-v1'?plan.origin.regex?.pointer:undefined,
        scriptIdentity:plan?.origin.encoding==='reader-regex-document-origin-v1'?plan.origin.regex?.id:undefined,
        messageId:plan?.origin.message.messageId,reason:code,...location})
    }
    function finishDocument(plan:ReaderNativeDocumentPlanV1,rendered:boolean):void {
      const messageId=plan.origin.message.messageId,remaining=unmountedDocuments.get(messageId)!-1
      unmountedDocuments.set(messageId,remaining)
      if(rendered)renderedDocuments.set(messageId,plan)
      if(remaining===0){
        const lastRendered=renderedDocuments.get(messageId)
        if(lastRendered)options.rendered?.(lastRendered)
      }
      if([...frames.values()].every(row=>row.ready)){view.clearTimeout(deadline);resolveStarted()}
    }
    const deadline=view.setTimeout(()=>{if(current()){rejectStarted(Error('READER_NATIVE_STARTUP_DEADLINE'))
      reportFailure('READER_NATIVE_STARTUP_DEADLINE',undefined,'story-paused')
      options.failed?.('READER_NATIVE_STARTUP_DEADLINE')}},options.startupDeadlineMs)
    const send=(row:FrameRow,data:object)=>row.port.postMessage(data)
    function adoptReadScope(row:FrameRow,value:ReaderRegexDocumentSnapshotV1):string {
      row.snapshot=value
      if(row.readRevision!==value.readRevision){row.readRevision=value.readRevision;row.readScope=crypto.randomUUID()}
      return row.readScope
    }
    const receiptKey=(frame:HTMLElement,id:number)=>({frame,id})
    const requestKeys=new Map<HTMLElement,Map<number,object>>()
    function finishReceipt(key:object,outcome:ReaderNativeReceiptObservationV1):void {
      const receipt=writes.get(key)
      if(!receipt)return
      view.clearTimeout(receipt.timer);writes.delete(key)
      if(outcome==='unavailable')unobservedReceipt=true
      if(outcome==='observed')observedReceipt=true
      receipt.finish(outcome)
    }
    async function waitForReceiptObservation():Promise<ReaderNativeReceiptObservationV1> {
      const outcomes=await Promise.all([...writes.values()].map(receipt=>receipt.done))
      if(unobservedReceipt||outcomes.includes('unavailable'))return 'unavailable'
      return observedReceipt||outcomes.includes('observed')?'observed':'none'
    }
    function releaseFrame(row:FrameRow):void {
      row.eventEndpoint?.dispose()
      // Retire pending deliveries as well as the port so surviving realms can still receive the event.
      for(const ack of row.eventAcks.values())ack.reject(Error('READER_BINDING_REVOKED'))
      row.eventAcks.clear()
      row.observer?.disconnect()
      row.frame.removeEventListener('load',row.connect)
      row.port.onmessage=null
      row.port.close()
      row.transferPort.close()
      row.sceneChild?.dispose()
      row.frame.remove()
    }
    const failDocument=(documentPlanSha256:string,row:FrameRow,code:string,location?:{line?:number;column?:number},
      impact:RoleplayExtensionFailureV1['impact']='partial')=>{
        reportFailure(code,documents.find(plan=>plan.documentPlanSha256===documentPlanSha256),impact,location)
        frames.delete(documentPlanSha256)
        releaseFrame(row)
        surface.failDocument(documentPlanSha256,code)
        finishDocument(documents.find(plan=>plan.documentPlanSha256===documentPlanSha256)!,false)
    }
    const receive=(documentPlanSha256:string,row:FrameRow,data:any)=>{
      if(!current()||frames.get(documentPlanSha256)!==row)return
      if(data.op==='connected')row.connected=true
      else if(data.op==='document-error')failDocument(documentPlanSha256,row,data.code,{line:data.line,column:data.column})
      else if(data.op==='parent-error'){
        reportFailure(data.code,documents.find(plan=>plan.documentPlanSha256===documentPlanSha256),'story-paused')
        rejectStarted(Error(data.code));options.failed?.(data.code)
      }else if(data.op==='parent-ready'){
        if(data.sourceDataProtocol!==1){
          const code='READER_NATIVE_SOURCE_DATA_PROTOCOL_UNAVAILABLE'
          reportFailure(code,documents.find(plan=>plan.documentPlanSha256===documentPlanSha256),'story-paused')
          rejectStarted(Error(code));options.failed?.(code);return
        }
        const plan=documents.find(plan=>plan.documentPlanSha256===documentPlanSha256)!
        if(plan.attributeData.length){
          const inert=outer.ownerDocument.implementation.createHTMLDocument('')
          for(const attribute of plan.attributeData){
            const element=inert.createElementNS(attribute.namespaceURI,attribute.tagName)
            if(attribute.name in element){failDocument(documentPlanSha256,row,attribute.failureCode);return}
          }
        }
        const html=readerNativeDocumentHtml(plan,row.snapshot,row.channel,libraries,surface.documentLayout.get(),
          row.readScope,true,presetLibrary,characterLibrary)
        const messageIndex=row.snapshot.messages.find(message=>message.messageId===plan.origin.message.messageId)?.index
        send(row,{op:'mount-reader',html,messageIndex,
          libraries:libraries.map(library=>library.javascript)})
      }else if(data.op==='ready'){
        if(row.ready)return
        row.ready=true
        send(row,{op:'snapshot',payload:row.snapshot,readScope:row.readScope})
        send(row,{op:'layout-config',payload:surface.documentLayout.get(),revision:row.layoutRevision})
        const plan=documents.find(plan=>plan.documentPlanSha256===documentPlanSha256)!
        finishDocument(plan,true)
      }else if(data.op==='diagnostic'){
        reportFailure(data.code,documents.find(plan=>plan.documentPlanSha256===documentPlanSha256),'partial',{line:data.line,column:data.column})
      }else if(data.op==='event-ack'){
        if(data.error)reportFailure(String(data.error),documents.find(plan=>plan.documentPlanSha256===documentPlanSha256),'partial')
        const ack=row.eventAcks.get(data.id);row.eventAcks.delete(data.id)
        if(data.error)ack?.reject(Error(data.error));else ack?.resolve(data.value)
      }else if(data.op==='parse-mvu-message'){
        void(async()=>{
          if(!options.host?.mvuTrial)throw Error('AUTHOR_NATIVE_MVU_TRIAL_UNAVAILABLE')
          const hooks=await eventRoute.captureMvuTrialHooks(),payload=data.payload,
            call=(request:import('../core/roleplay-author-mvu-trial.js').AuthorMvuTrialRequestV1)=>
              options.host!.mvuTrial!({...binding,principal:'reader-regex-document'},documentPlanSha256,request,
                request.action==='close'?new AbortController().signal:abort.signal),
            output=async(request:import('../core/roleplay-author-mvu-trial.js').AuthorMvuTrialRequestV1)=>{
              const reply=await call(request)
              if(reply.kind!=='output')throw Error('AUTHOR_NATIVE_MVU_TRIAL_OUTPUT_INVALID')
              return reply.output
            }
          return await runAuthorNativeMvuTrial({trialId:payload.trialId,message:payload.message,oldData:payload.oldData,
            hooks,signal:abort.signal,transport:{
              current:()=>current()&&frames.get(documentPlanSha256)===row,
              begin:input=>output({action:'start',...input}),
              advance:(trialId,input)=>output({action:'advance',trialId,...input}),
              close:async trialId=>{await call({action:'close',trialId})},
            }})
        })().then(payload=>send(row,{op:'reply',id:data.id,payload}),error=>send(row,{op:'reply',id:data.id,
          error:error instanceof Error?error.message:String(error)}))
      }else if(['generation-reserve','generation-release','generation-requested','generation-filter','invoke-author-generation-filter',
        'author-generation-filter-result','start-author-generation','author-generation-next',
        'stop-author-generation','stop-all-author-generations'].includes(data.op)){
        void(async()=>{
          const payload=data.payload,operationId=payload.operationId
          if(data.op==='generation-reserve'){
            const reservation=eventRoute.reserveGeneration({generationId:payload.generationId,operationId,silence:payload.silence,
              cancel:async()=>{
                send(row,{op:'generation-cancel',operationId})
                const job=auxiliary.get(operationId)
                if(job?.started)await options.host?.generation?.(binding as ReaderRegexDocumentBindingV1,
                  documentPlanSha256,{action:'stop',operationId},new AbortController().signal)
              }})
            auxiliary.set(operationId,{documentPlanSha256,started:false,settled:false,reservation})
            return undefined
          }
          if(data.op==='stop-all-author-generations')return eventRoute.stopAllGenerations()
          if(data.op==='generation-filter')return eventRoute.invokeGenerationFilter(payload.descriptor,operationId,'chat')
          if(data.op==='invoke-author-generation-filter'){
            const accepted=await eventRoute.invokeGenerationFilter(payload.descriptor,operationId,payload.consumer)
            return {accepted,libraryReads:await eventRoute.captureGenerationLibraryReads()}
          }
          const job=auxiliary.get(operationId)
          if(!job||job.documentPlanSha256!==documentPlanSha256)throw Error('AUTHOR_GENERATION_CANCELLED')
          if(data.op==='generation-release'){
            if(job.started&&!job.settled)job.reservation.cancel()
            job.reservation.release();auxiliary.delete(operationId);eventRoute.retireGenerationFilters(operationId,[])
            return undefined
          }
          if(data.op==='stop-author-generation')return job.reservation.cancel()
          if(!job.reservation.current())throw Error('AUTHOR_GENERATION_CANCELLED')
          if(data.op==='generation-requested')return eventRoute.transform('js_generation_requested',payload.args,operationId)
          if(!options.host?.generation)throw Error('READER_GENERATION_UNAVAILABLE')
          if(data.op==='author-generation-filter-result')return options.host.generation(binding as ReaderRegexDocumentBindingV1,
            documentPlanSha256,{action:'filter-result',operationId,invocationId:payload.invocationId,
              accepted:payload.accepted,error:payload.error,libraryReads:payload.libraryReads},abort.signal)
          if(data.op==='start-author-generation'){
            const libraryReads=await eventRoute.captureGenerationLibraryReads()
            if(!job.reservation.current())throw Error('AUTHOR_GENERATION_CANCELLED')
            job.reservation.setSilence(payload.options.should_silence===true);job.started=true
            return options.host.generation(binding as ReaderRegexDocumentBindingV1,documentPlanSha256,
              {action:'start',operationId,options:payload.options,libraryReads},abort.signal)
          }
          const reply=await options.host.generation(binding as ReaderRegexDocumentBindingV1,documentPlanSha256,
            {action:'next',operationId,cursor:payload.cursor},abort.signal)
          if(reply.kind!=='generation-update')throw Error('AUTHOR_GENERATION_UPDATE_UNAVAILABLE')
          if(reply.update.settled)job.settled=true
          return reply.update
        })().then(value=>{if(current())send(row,{op:'reply',id:data.id,payload:value})},error=>{
          if(current())send(row,{op:'reply',id:data.id,error:error instanceof Error?error.message:String(error)})
        })
      }else if(data.op==='emit-event'){
        const {event,args,excludeSelf}=data.payload
        const delivery=row.eventEndpoint?row.eventEndpoint.emit(event,args,excludeSelf)
          :excludeSelf?Promise.resolve():deliverEvent(row,event,args)
        void delivery.then(()=>{if(current())send(row,{op:'reply',id:data.id,payload:{}})},error=>{
          if(current())send(row,{op:'reply',id:data.id,error:error instanceof Error?error.message:String(error)})
        })
      }else if(data.op==='author-height'){
        row.layoutPaused=true;row.ownHeight=Math.ceil(data.height)+'px';row.frame.style.height=row.ownHeight
        surface.scheduleLayout()
      }else if(data.op==='layout-height'){
        const height=data.payload?.height
        if(row.layoutPaused||data.revision!==row.layoutRevision){
          send(row,{op:'layout-height-ack',id:data.id,error:'READER_DOCUMENT_LAYOUT_SUPERSEDED'});return
        }
        row.ownHeight=`${Math.ceil(height)}px`;row.frame.style.height=row.ownHeight
        surface.scheduleLayout()
        const applied=row.sceneChild?row.sceneChild.resize(height):new Promise<void>(resolve=>view.requestAnimationFrame(()=>resolve()))
        void applied.then(()=>{if(current()&&row.frame.isConnected)send(row,{op:'layout-height-ack',id:data.id})},error=>{
          if(current()&&frames.get(documentPlanSha256)===row)
            failDocument(documentPlanSha256,row,error instanceof Error?error.message:String(error),undefined,'story-paused')
        })
      }else if(data.op==='receipt-observed'){
        const key=requestKeys.get(row.frame)?.get(data.id),receipt=key&&writes.get(key)
        if(receipt?.operationId&&receipt.operationId===data.operationId){
          requestKeys.get(row.frame)!.delete(data.id);finishReceipt(key!,'observed')
        }
      }else if(data.op==='worldbook-read'){
        void (async()=>{
          try {
            if(!options.host?.readWorldbook)throw Error('AUTHOR_WORLDBOOK_READ_UNAVAILABLE')
            if(data.payload.readScope!==row.readScope)throw Error('READER_READ_BASIS_CHANGED')
            const book=await options.host.readWorldbook(binding as ReaderRegexDocumentBindingV1,documentPlanSha256,
              {name:data.payload.name,expectedDataSha256:data.payload.expectedDataSha256,readRevision:row.readRevision},abort.signal)
            send(row,{op:'reply',id:data.id,payload:book})
          }catch(error){send(row,{op:'reply',id:data.id,error:error instanceof Error?error.message:String(error)})}
        })()
      }else if(data.op==='command-release'){
        const prefix=documentPlanSha256+':'+data.payload.operationId+':'
        for(const key of commandInteractions.keys())if(key.startsWith(prefix))commandInteractions.delete(key)
        send(row,{op:'reply',id:data.id,payload:{}})
      }else if(data.op==='command-input'||data.op==='command-echo'){
        const key=documentPlanSha256+':'+data.payload.operationId
        let pending=commandInteractions.get(key)
        if(!pending){
          pending=Promise.resolve().then(()=>{
            if(!settings.commandUi)throw Error('AUTHOR_NATIVE_COMMAND_UI_UNAVAILABLE')
            return data.op==='command-input'?settings.commandUi.input(data.payload.text,data.payload.defaultValue)
              :settings.commandUi.echo(data.payload.text)
          })
          commandInteractions.set(key,pending)
        }
        void pending.then(value=>{
          if(current()&&frames.get(documentPlanSha256)===row)send(row,{op:'reply',id:data.id,payload:value})
        },error=>{if(current())send(row,{op:'reply',id:data.id,error:error instanceof Error?error.message:String(error)})})
      }else if(data.op==='set-chat-messages'||data.op==='mutate-namespace'
        ||data.op==='numerical-replace'||data.op==='execute-commands'){
        // Reuse the existing pending/ACK owner. The author cannot supply a
        // different document principal or promote worldbook output to writer.
        const plan=documents.find(plan=>plan.documentPlanSha256===documentPlanSha256)!
        let finish!:(outcome:ReaderNativeReceiptObservationV1)=>void
        const key=receiptKey(row.frame,data.id),receipt:Receipt={frame:row.frame,
          done:new Promise<ReaderNativeReceiptObservationV1>(yes=>{finish=yes}),finish:outcome=>finish(outcome)}
        writes.set(key,receipt)
        let keys=requestKeys.get(row.frame)
        if(!keys)requestKeys.set(row.frame,keys=new Map())
        keys.set(data.id,key)
        // Register before dispatch: the existing Host can begin navigation
        // while returning its committed result to this bridge.
        void (async()=>{
          try {
            if(!options.host||plan.writes!=='source-regex'||plan.origin.encoding!=='reader-regex-document-origin-v1')
              throw Error('READER_NATIVE_WRITE_UNAVAILABLE')
            if(data.payload.readScope!==row.readScope)throw Error('READER_READ_BASIS_CHANGED')
            const {readScope:_scope,...request}=data.payload
            const messagePlan=data.op==='set-chat-messages'
              ?createAuthorNativeMessageVariables(row.snapshot).planSetChatMessages(request.rows):undefined
            if(messagePlan?.kind==='unchanged'){
              send(row,{op:'reply',id:data.id,payload:{result:{kind:'unchanged',operationId:request.operationId},
                mutationKind:'unchanged'}})
              keys!.delete(data.id);finishReceipt(key,'none');return
            }
            let reply:ReaderOpeningVariantReplyV1|ReaderNumericalReplyV1|ReaderCommandReplyV1|ReaderMessageBodyReplyV1
              |ReaderOrdinaryNamespaceReplyV1,
              operationId:string|undefined
            if(data.op==='mutate-namespace') {
              if(!options.host.mutateNamespace)throw Error('READER_NAMESPACE_WRITE_UNAVAILABLE')
              reply=await options.host.mutateNamespace(binding as ReaderRegexDocumentBindingV1,documentPlanSha256,
                {...request,readRevision:row.readRevision},abort.signal)
              if(reply.reply.kind!=='no-update')operationId=request.operationId
            }else if(messagePlan?.kind==='body'||messagePlan?.kind==='patch') {
              if(!options.host.mutateMessageBody)throw Error('READER_MESSAGE_BODY_WRITE_UNAVAILABLE')
              const selected=messagePlan
              const message=selected.message
              reply=await options.host.mutateMessageBody(binding as ReaderRegexDocumentBindingV1,documentPlanSha256,
                {schemaVersion:1,operationId:request.operationId,readRevision:row.readRevision,
                  expected:{sessionId:binding.sessionId,seq:message.nativeSeq!,messageId:message.messageId,
                    role:message.role as 'user'|'assistant',messageVersionSha256:message.messageVersionSha256},
                  text:selected.text,refresh:request.refresh,
                  ...selected.kind==='patch'?{patch:selected.patch}:{}},abort.signal)
              if(reply.result.kind==='committed')operationId=reply.result.operationId
            }else if(data.op==='execute-commands') {
              if(!options.host.executeCommands)throw Error('READER_NATIVE_COMMANDS_UNAVAILABLE')
              const commands=await options.host.executeCommands(binding as ReaderRegexDocumentBindingV1,
                documentPlanSha256,{operationId:request.operationId,command:request.command,
                  ...request.step?{step:request.step,pipe:request.pipe}:{}},abort.signal)
              if(commands.result.steps.some(step=>step.kind==='ruby'&&step.action==='panel'))
                window.dispatchEvent(new CustomEvent('dsh-roleplay-needs-config',{
                  detail:{sessionId:binding.sessionId,action:'configure-ruby-analysis'}}))
              reply=commands;operationId=commands.result.steps.at(-1)?.receipt?.operationId
            }else if(data.op==='numerical-replace') {
              if(!options.host.replaceNumerical)throw Error('READER_NUMERICAL_WRITE_UNAVAILABLE')
              const operation:MvuPlayerEditRequest={schemaVersion:1,sessionId:binding.sessionId,
                operationId:request.operationId,expected:request.expected,
                ...request.action==='replace-envelope'?{action:'replace-envelope' as const,envelope:request.envelope}
                  :{action:'replace-values' as const,values:request.values},
                ...request.target?{target:request.target}:{}}
              const numerical=await options.host.replaceNumerical(binding as ReaderRegexDocumentBindingV1,
                documentPlanSha256,row.readRevision,operation,abort.signal)
              reply=numerical
              if(numerical.result.operation&&numerical.result.operation.outcome!=='unknown')
                operationId=numerical.result.operation.operationId
            }else if(messagePlan?.kind==='opening') {
              const opening=await options.host.mutateOpeningVariants(binding as ReaderRegexDocumentBindingV1,documentPlanSha256,
                {...request,rows:[messagePlan.row],
                  readRevision:row.readRevision},abort.signal)
              reply=opening
              if(opening.result.kind==='committed')operationId=opening.result.operationId
            }else throw Error('READER_NATIVE_WRITE_INVALID')
            if(!current()){finishReceipt(key,'unavailable');return}
            if(operationId){
              receipt.operationId=operationId
              receipt.timer=view.setTimeout(()=>{
                keys!.delete(data.id);finishReceipt(key,'unavailable')
                reportFailure('READER_NATIVE_RECEIPT_UNOBSERVED',plan,'story-paused')
                options.diagnostic('READER_NATIVE_RECEIPT_UNOBSERVED')
              },settings.receiptObservationDeadlineMs??5000)
            }
            const readScope='snapshot' in reply&&reply.snapshot?adoptReadScope(row,reply.snapshot):undefined
            send(row,{op:'reply',id:data.id,payload:{...reply,readScope,mutationKind:messagePlan?.kind}})
            if(!operationId){keys!.delete(data.id);finishReceipt(key,'none')}
          }catch(error){
            if(receipt.operationId){
              keys!.delete(data.id);finishReceipt(key,'unavailable')
              reportFailure('READER_NATIVE_RECEIPT_UNOBSERVED',plan,'story-paused')
              options.diagnostic('READER_NATIVE_RECEIPT_UNOBSERVED')
            }else{
              if(current())send(row,{op:'reply',id:data.id,error:error instanceof Error?error.message:'READER_NATIVE_WRITE_FAILED'})
              keys!.delete(data.id);finishReceipt(key,'none')
            }
          }
        })()
      }
    }
    const stopLayout=surface.documentLayout.subscribe(explicit=>{
      for(const row of frames.values()){
        if(explicit)row.layoutPaused=false
        row.layoutRevision++
        if(row.ready)send(row,{op:'layout-config',payload:surface.documentLayout.get(),explicit,revision:row.layoutRevision})
      }
    })
    function deliverEvent(row:FrameRow,event:string,args:readonly unknown[],requested=false,operationId?:string):Promise<readonly unknown[]> {
      return new Promise((resolve,reject)=>{
        const id=++eventSequence;row.eventAcks.set(id,{resolve:value=>resolve(value as readonly unknown[]),reject})
        send(row,{op:'source-event',id,payload:{type:event,args,requested,operationId}})
      })
    }
    async function mount():Promise<void> {
      if(!snapshot||booted||!current())return
      booted=true
      await surface.ready
      if(!current())return
      const scene=settings.scene?await settings.scene:undefined
      if(!current())return
      surface.setReaderProgram(program.programSha256+':native-prototype')
      for(const plan of documents){
        const container=surface.documentContainer(plan.documentPlanSha256),frame=container.ownerDocument.createElement(scene?'div':'iframe')
        const ports=new view.MessageChannel()
        const parentUrl=settings.parentOrigins[plan.writes]
        if(!parentUrl)throw Error('READER_NATIVE_PARENT_ORIGIN_UNAVAILABLE')
        const row:FrameRow={frame,channel:crypto.randomUUID(),connected:false,ready:false,
          readScope:crypto.randomUUID(),readRevision:snapshot!.readRevision,
          snapshot:snapshot!,
          ownHeight:'',layoutPaused:false,layoutRevision:0,port:ports.port1,transferPort:ports.port2,eventAcks:new Map(),
          connect(){
            if(current()&&frames.get(plan.documentPlanSha256)===row)
              (frame as HTMLIFrameElement).contentWindow?.postMessage({channel:row.channel,op:'connect-parent'},new URL(parentUrl).origin,[row.transferPort])
          }}
        frames.set(plan.documentPlanSha256,row)
        // The parent shell only accepts mount until it transfers the port to the author document.
        row.eventEndpoint=eventRoute.register((event,args,requested,operationId)=>deliverEvent(row,event,args,requested,operationId),
          ()=>current()&&row.connected&&frames.get(plan.documentPlanSha256)===row,
          {realmId:'reader:'+plan.documentPlanSha256,attachment:binding,
            trialInterests:()=>new Promise((resolve,reject)=>{
              const id=++eventSequence;row.eventAcks.set(id,{resolve:value=>resolve(value as readonly import('../core/tavern-mvu-update-protocol-v1.js').Mvu196HookStage[]),reject})
              send(row,{op:'mvu-trial-interests',id})
            }),invokeTrialHook:(stage,graph)=>new Promise((resolve,reject)=>{
              const id=++eventSequence;row.eventAcks.set(id,{resolve:value=>resolve(value as import('../core/author-native-mvu-hook-graph.js').AuthorNativeMvuHookGraphV1),reject})
              send(row,{op:'mvu-trial-hook',id,stage,graph})
            }),
            async invokeFilter(callbackId,operationId,consumer){
              const result=await new Promise<readonly unknown[]>((resolve,reject)=>{
                const id=++eventSequence;row.eventAcks.set(id,{resolve:value=>resolve(value as readonly unknown[]),reject})
                send(row,{op:'generation-invoke-filter',id,callbackId,operationId,consumer})
              })
              return result[0] as boolean
            },captureLibraryReads:()=>new Promise((resolve,reject)=>{
              const id=++eventSequence;row.eventAcks.set(id,{resolve:value=>resolve(value as readonly AuthorNativeLibraryReadV1[]),reject})
              send(row,{op:'generation-library-reads',id})
            }),retireFilters:(operationId,ids)=>send(row,{op:'generation-release-filters',operationId,ids}),
            cancel:operationId=>send(row,{op:'generation-cancel',operationId})})
        row.port.onmessage=event=>receive(plan.documentPlanSha256,row,event.data);row.port.start()
        frame.title='作者原生浏览器文档'
        frame.style.cssText='display:block;width:100%;border:0'
        row.ownHeight=(settings.viewportHeightPx??surface.documentLayout.get().viewportHeight)+'px';frame.style.height=row.ownHeight
        if(!scene){row.observer=new view.MutationObserver(records=>{
          if(records.some(record=>record.attributeName==='height')||frame.style.height!==row.ownHeight){
            row.layoutPaused=true;send(row,{op:'layout-pause'})
          }
        })
        row.observer.observe(frame,{attributes:true,attributeFilter:['style','height']})}
        const url=new URL(parentUrl);url.hash=new URLSearchParams({channel:row.channel}).toString()
        if(scene){
          row.sceneChild=scene.mount({id:plan.documentPlanSha256,kind:'reader',channel:row.channel,port:ports.port2,
            ...plan.writes==='none'?{url:parentUrl}:{}})
          frame.style.visibility='hidden'
        }else{
          const nativeFrame=frame as HTMLIFrameElement
          nativeFrame.sandbox.add('allow-scripts','allow-same-origin');nativeFrame.setAttribute('credentialless','');nativeFrame.referrerPolicy='no-referrer'
          nativeFrame.src=url.href
          frame.addEventListener('load',row.connect,{once:true})
        }
        container.replaceChildren(frame)
      }
      if(!documents.length){view.clearTimeout(deadline);resolveStarted()}
    }
    return {started,disposed,lifecycle,waitForReceiptObservation,
      publishPresetLibrary(catalog){presetLibrary=catalog
        if(current())for(const row of frames.values())send(row,{op:'preset-library',catalog})},
      publishCharacterLibrary(packet){characterLibrary=packet
        if(current())for(const row of frames.values())send(row,{op:'character-library',packet})},
      render(value){if(!options.surface)surface.render(value);void mount().catch(error=>{
        reportFailure('READER_NATIVE_MOUNT_FAILED',undefined,'story-paused')
        rejectStarted(error);options.failed?.('READER_NATIVE_MOUNT_FAILED')})},
      publishSnapshot(value){snapshot=value;for(const row of frames.values()){
        const readScope=adoptReadScope(row,value)
        if(row.ready)send(row,{op:'snapshot',payload:value,readScope})}
        void mount().catch(error=>{
          reportFailure('READER_NATIVE_MOUNT_FAILED',undefined,'story-paused')
          rejectStarted(error);options.failed?.('READER_NATIVE_MOUNT_FAILED')})},
      async waitForAdmittedSourceWrites(){
        if(await waitForReceiptObservation()==='unavailable')throw Error('READER_NATIVE_RECEIPT_UNOBSERVED')
      },
      dispose(){
        if(!active)return
        for(const job of auxiliary.values())job.reservation.cancel()
        auxiliary.clear()
        active=false;abort.abort();view.clearTimeout(deadline);stopLayout()
        if(settings.scene)void settings.scene.then(scene=>surface.releaseAuthorScene(scene)).catch(()=>{})
        resolveBridgeRevoked()
        for(const key of writes.keys())finishReceipt(key,'unavailable')
        requestKeys.clear()
        // Revokes the bridge immediately; physical CPU termination is NOT
        // promised by DOM removal. The browser probe measures that separately.
        for(const row of frames.values())releaseFrame(row)
        resolveFramesRemoved()
        frames.clear();rejectStarted(Error('READER_BINDING_REVOKED'))
        if(!options.eventRoute)eventRoute.dispose()
        const close=options.host?.closeBinding(binding as any)??Promise.resolve()
        void close.catch(error=>options.diagnostic(String(error))).finally(()=>{
          if(!options.surface)surface.dispose();resolveDisposed()
        })
      }}
  }
}
