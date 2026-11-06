import {createAuthorReaderSurface} from '../core/tavern-author-reader-surface.js'
import {createReaderDocumentLayoutRealm,type ReaderDocumentLayoutConfig} from '../core/tavern-author-reader-document-layout.js'
import {READER_NATIVE_RESOURCE_CSP} from '../core/reader-native-parent-realm.js'
import {createAuthorNativeMvuApi} from './author-native-mvu-sdk.js'
import {createAuthorNativeEventOwner} from './author-native-events.js'
import {createAuthorNativeMessageVariables} from '../core/author-native-message-variables.js'
import {createAuthorNativeCurrentRegex} from '../core/author-native-current-regex.js'
import {createAuthorNativeVariableWriters} from '../core/author-native-variable-writers.js'
import type {ReaderRegexDocumentSnapshotV1,ReaderRegexDocumentBindingV1,ReaderOpeningVariantReplyV1,
  ReaderNumericalReplyV1,ReaderCommandReplyV1,ReaderMessageBodyReplyV1,ReaderOrdinaryNamespaceReplyV1} from '../core/reader-regex-document-types.mjs'
import type {MvuPlayerEditRequest} from '../core/roleplay-mvu-player-types.js'
import type {ReaderNativeDocumentPlanV1,ReaderNativeLibraryV1,ReaderNativeReceiptObservationV1,ReaderNativeDocumentExecutionV1,
  ReaderNativeFrameLifecycleV1,ReaderNativeFrameOptionsV1,ReaderNativeDocumentFrameControllerV1} from '../core/reader-native-document-types.js'

export type {ReaderNativeDocumentFrameControllerV1} from '../core/reader-native-document-types.js'
export type ReaderNativeFrameFactoryV1=(outer:HTMLIFrameElement,
  binding:Omit<ReaderRegexDocumentBindingV1,'principal'>,program:{readonly programSha256:string},
  options:ReaderNativeFrameOptionsV1)=>ReaderNativeDocumentFrameControllerV1

/** Runs only inside an opaque author frame. It exposes captured reads and
 * typed asynchronous Native writers, never application DOM or credentials. */
function readerNativeBootstrap(initial:ReaderRegexDocumentSnapshotV1,channel:string,
  mounted:{seq:number;messageId:string;messageVersionSha256:string},
  layoutConfig:ReaderDocumentLayoutConfig,createLayout:typeof createReaderDocumentLayoutRealm,initialReadScope:string,
  createMvu:typeof createAuthorNativeMvuApi,createEvents:typeof createAuthorNativeEventOwner,
  createMessageVariables:typeof createAuthorNativeMessageVariables,createCurrentRegex:typeof createAuthorNativeCurrentRegex,
  createVariableWriters:typeof createAuthorNativeVariableWriters):void {
  const realm=window as any
  let snapshot:any=initial,active=true,sequence=0
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
    [row,row.data,row.swipes,row.swipes_data,...(row.swipes_data??[])])]
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
  realm.getLoadedPresetName=()=>currentPreset().loadedName
  realm.getTavernRegexes=createCurrentRegex(()=>snapshot)
  realm.getPreset=(name:string)=>{
    const value=currentPreset()
    if(name!=='in_use'&&name!==value.loadedName)throw Error('AUTHOR_NATIVE_PRESET_SELECTOR_UNSUPPORTED')
    return clone(value.preset)
  }
  realm.getWorldbookNames=()=>clone(snapshot.worldbook?.names??[])
  realm.getCurrentCharPrimaryLorebook=()=>snapshot.worldbook?.primaryName??null
  realm.getWorldbook=async(name:string)=>{
    const book=snapshot.worldbook
    if(!book||book.primaryName!==name)throw Error('AUTHOR_NATIVE_WORLDBOOK_UNAVAILABLE')
    return clone(book.entries)
  }
  // This runtime owns a primary book, not ST's account-level charLore
  // bindings. Do not turn external reference names into a loaded library.
  realm.getCharWorldbookNames=()=>{throw Error('AUTHOR_NATIVE_CHARACTER_WORLDBOOK_BINDINGS_UNAVAILABLE')}
  const value=(scope:any)=>scope?.kind==='available'?scope.variables:undefined
  const variables=(options:any={type:'chat'})=>{
    if(!active)throw Error('READER_BINDING_REVOKED')
    const type=options.type??'chat'
    if(type==='chat'){
      const table={...clone(value(snapshot.scopeFrame.scopes.chat)),...clone(snapshot.ordinaryChat.values)}
      for(const key of snapshot.ordinaryChat.deletedKeys??[])delete table[key]
      return table
    }
    if(type==='global'||type==='character')return clone(value(snapshot.scopeFrame.scopes[type]))
    if(type==='message'){
      return clone(messageData().resolve(options).values)
    }
    throw Error('READER_VARIABLE_SCOPE_UNAVAILABLE')
  }
  const events=createEvents({create:()=>undefined,report:error=>send({op:'diagnostic',
    code:error instanceof Error?error.message:String(error)})})
  const emit=async(name:string,args:any[])=>{await events.emit(name,args)}
  const request=(op:string,payload:any)=>new Promise((resolve,reject)=>{
    if(!active){reject(Error('READER_BINDING_REVOKED'));return}
    const id=++sequence;pending.set(id,{resolve,reject,operationId:payload.operationId})
    send({id,op,payload})
  })
  realm.getVariables=variables
  Object.assign(realm,createVariableWriters((options:any)=>{
    const type=options.type??'chat',readScope=snapshotReadScope
    if(type!=='chat'&&type!=='message')throw Error('READER_VARIABLE_SCOPE_UNAVAILABLE')
    const selector=type==='message'?{type:'message' as const,message_id:options.message_id??'latest'}:undefined
    const current=selector?clone(messageData().resolve(selector,true).values):variables(options)
    return {variables:current,commit:async(nextVariables:any)=>{
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
    return clone(prefix.values)
  }
  realm.getCurrentMessageId=()=>snapshot.messages.find((row:any)=>row.messageId===mounted.messageId)?.index
  realm.getLastMessageId=()=>snapshot.messages.length-1
  realm.getChatMessages=(range:any='0-{{lastMessageId}}',options:any={})=>{
    if(options.hide_state==='hidden')return []
    const rows=snapshot.messages,last=rows.length-1
    const position=(id:any)=>{const n=Number(String(id).replaceAll('{{lastMessageId}}',String(last)))
      return n<0?rows.length+n:n}
    const match=String(range).match(/^(-?\d+|\{\{lastMessageId\}\})(?:-(-?\d+|\{\{lastMessageId\}\}))?$/)
    if(!match)return []
    const first=position(match[1]),end=position(match[2]??match[1])
    const result=rows.filter((row:any)=>row.index>=Math.min(first,end)&&row.index<=Math.max(first,end)
      &&(!options.role||options.role==='all'||row.role===options.role)).map((row:any)=>({
      message_id:row.index,role:row.role,message:row.message,is_hidden:false,data:clone(messageData().forMessage(row).values),
      ...options.include_swipes&&row.variants
        ?{...clone(row.variants),swipes_data:clone(messageData().swipeData(row))}:{}}))
    lastExplicitReadScope=snapshotReadScope
    for(const object of messageObjects(result))if(object&&typeof object==='object')readScopes.set(object,snapshotReadScope)
    return result
  }
  realm.setChatMessages=async(rows:any,options:any={})=>{
    const scopes=new Set(messageObjects(rows).map(object=>object&&typeof object==='object'?readScopes.get(object):undefined)
      .filter(scope=>scope!==undefined))
    if(scopes.size>1)throw Error('READER_MIXED_READ_BASIS')
    const readScope=scopes.values().next().value??lastExplicitReadScope
    const body=messageData().normalizeBodyRows(rows),op=body&&!body.message.variants?'message-body':'opening-variants'
    const reply:any=await request(op,{operationId:crypto.randomUUID(),
      readScope,rows:body?[{message_id:body.message_id,message:body.text}]:rows,refresh:options.refresh??'affected'})
    if(reply.result.kind!=='committed'&&reply.result.kind!=='unchanged')throw Error(reply.result.code)
    if(op==='message-body')return reply.result
    if(reply.snapshot){snapshot=reply.snapshot;snapshotReadScope=reply.readScope;updateAvatarStyles()}
    else {active=false;events.dispose()}
  }
  realm.triggerSlash=async(command:string)=>{
    const reply:any=await request('execute-commands',{command,operationId:crypto.randomUUID(),readScope:snapshotReadScope})
    if(reply.snapshot){snapshot=reply.snapshot;snapshotReadScope=reply.readScope;updateAvatarStyles()}
    if(reply.result.kind!=='executed')throw Object.assign(Error(reply.result.code),{result:reply.result})
    return reply.result.pipe
  }
  realm.Mvu=createMvu({snapshot:()=>snapshot,readScope:()=>snapshotReadScope,variables,
    replace:async(value,readScope)=>{
      const reply:any=await request('numerical-replace',{...value,readScope,operationId:crypto.randomUUID()})
      if(reply.snapshot){snapshot=reply.snapshot;snapshotReadScope=reply.readScope;updateAvatarStyles()}
      else if(reply.result.operation?.outcome==='updated'||reply.result.operation?.outcome==='no-update') {
        active=false;events.dispose()
      }
      for(const event of reply.sourceEvents??[])await emit(event.type,event.args)
      return reply.result
    }})
  realm.waitGlobalInitialized=async(name:string)=>{
    if(!Object.hasOwn(realm,name))throw Error('READER_GLOBAL_UNAVAILABLE')
    // Library installation is separate from numerical readiness and permission.
  }
  realm.eventOn=events.on
  realm.eventOnce=events.once
  realm.eventMakeFirst=events.makeFirst
  realm.eventMakeLast=events.makeLast
  realm.eventRemoveListener=events.remove
  realm.eventEmit=(name:string,...args:any[])=>emit(name,args)
  realm.eventEmitAndWait=(name:string,...args:any[])=>events.emitAndWait(name,args)
  realm.errorCatched=(fn:Function)=>(...args:any[])=>fn(...args)
  realm.SillyTavern={getContext:()=>({chat:realm.getChatMessages(),Mvu:realm.Mvu})}
  const receive=(event:MessageEvent)=>{
    if(!active)return
    const data=event.data
    if(data.op==='layout-config'){
      layoutRevision=data.revision;layoutConfig=data.payload;layout?.update(layoutConfig,data.explicit)
    }else if(data.op==='layout-pause')layout?.pause()
    else if(data.op==='layout-height-ack'){
      const write=layoutWrites.get(data.id);layoutWrites.delete(data.id)
      if(data.error)write?.reject(Error(data.error));else write?.resolve()
    }else if(data.op==='snapshot'){snapshot=data.payload;snapshotReadScope=data.readScope;updateAvatarStyles()}
    else if(data.op==='source-event')void emit(data.payload.type,data.payload.args)
    else if(data.op==='reply'){
      const entry=pending.get(data.id);pending.delete(data.id)
      if(data.error)entry?.reject(Error(data.error))
      else if(entry){
        entry.resolve(data.payload)
        const result=data.payload?.result,ordinary=data.payload?.reply,
          operationId=ordinary&&(ordinary.kind==='committed'||ordinary.kind==='replayed')?entry.operationId
            :result?.kind==='committed'?result.operationId:result?.operation
            &&result.operation.outcome!=='unknown'?result.operation.operationId
            :result?.steps?.at(-1)?.receipt.operationId
        if(operationId)queueMicrotask(()=>send({op:'receipt-observed',id:data.id,operationId}))
      }
    }
  }
  const connect=(event:MessageEvent)=>{
    if(!active||port||event.data?.channel!==channel||event.data.op!=='connect'||!event.ports[0])return
    port=event.ports[0];removeEventListener('message',connect)
    port.onmessage=receive;port.start()
    for(const data of outgoing)port.postMessage(data)
    outgoing.length=0
  }
  addEventListener('message',connect)
  addEventListener('pagehide',()=>{
    active=false;events.dispose();removeEventListener('message',connect)
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
      const id=++sequence;layoutWrites.set(id,{resolve,reject})
      send({op:'layout-height',id,revision:layoutRevision,payload:{height}})
    }))
    send({op:'ready'})
  },{once:true})
}

const json=(value:unknown)=>JSON.stringify(value).replaceAll('<','\\u003c')
const script=(javascript:string)=>'<script>'+javascript.replace(/<\/script/gi,'<\\/script')+'</script>'

/** The parent enters the browser's credentialless partition before receiving
 * this HTML. Ordinary browser resource loading keeps Source URL semantics. */
export function readerNativeDocumentHtml(plan:ReaderNativeDocumentPlanV1,snapshot:ReaderRegexDocumentSnapshotV1,
  channel:string,libraries:readonly ReaderNativeLibraryV1[]=[],layoutConfig:ReaderDocumentLayoutConfig={mode:'auto',viewportHeight:600},
  readScope=channel):string {
  return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" '
    +'content="'+READER_NATIVE_RESOURCE_CSP+'"><meta name="referrer" content="no-referrer">'
    +script('('+readerNativeBootstrap.toString()+')('+json(snapshot)+','+json(channel)+','+json(plan.origin.message)
    +','+json(layoutConfig)+',('+createReaderDocumentLayoutRealm.toString()+'),'+json(readScope)
      +',('+createAuthorNativeMvuApi.toString()+'),('+createAuthorNativeEventOwner.toString()+'),('
      +createAuthorNativeMessageVariables.toString()+'),('+createAuthorNativeCurrentRegex.toString()+'),('
      +createAuthorNativeVariableWriters.toString()+'))')
    +libraries.map(library=>script(library.javascript)).join('')+plan.html
}

/** Reversible factory for the normal Reader session seam. It deliberately
 * refuses to pretend opaque parent access or iframe removal is a hard kill. */
export function createReaderNativeDocumentFrameFactory(documents:readonly ReaderNativeDocumentPlanV1[],
  libraries:readonly ReaderNativeLibraryV1[]=[],settings:{parentOrigins:ReaderNativeDocumentExecutionV1['parentOrigins'];
    receiptObservationDeadlineMs?:number;viewportHeightPx?:number}):ReaderNativeFrameFactoryV1 {
  return (outer,binding,program,options)=>{
    interface FrameRow {
      frame:HTMLIFrameElement;channel:string;ready:boolean;readScope:string;readRevision:number;snapshot:ReaderRegexDocumentSnapshotV1;
      ownHeight:string;layoutPaused:boolean;layoutRevision:number;observer?:MutationObserver;
      port:MessagePort;transferPort:MessagePort;connect():void
    }
    const view=outer.ownerDocument.defaultView!,abort=new AbortController(),frames=new Map<string,FrameRow>()
    interface Receipt {
      readonly frame:HTMLIFrameElement
      readonly done:Promise<ReaderNativeReceiptObservationV1>
      finish(value:ReaderNativeReceiptObservationV1):void
      operationId?:string
      timer?:number
    }
    const writes=new Map<object,Receipt>()
    let unobservedReceipt=false,observedReceipt=false
    const surface=options.surface??createAuthorReaderSurface(outer,{current:options.current,
      layout:options.layout,mountStaticDocument:options.mountStaticDocument,nativeDocuments:true})
    let active=true,booted=false,snapshot:ReaderRegexDocumentSnapshotV1|undefined
    let resolveStarted!:()=>void,rejectStarted!:(error:Error)=>void,resolveDisposed!:()=>void
    const started=new Promise<void>((yes,no)=>{resolveStarted=yes;rejectStarted=no})
    void started.catch(()=>{})
    const disposed=new Promise<void>(yes=>{resolveDisposed=yes})
    let resolveBridgeRevoked!:()=>void,resolveFramesRemoved!:()=>void
    const lifecycle:ReaderNativeFrameLifecycleV1={backend:'native-browser',hardTermination:'unavailable',
      bridgeRevoked:new Promise<void>(yes=>{resolveBridgeRevoked=yes}),
      framesRemoved:new Promise<void>(yes=>{resolveFramesRemoved=yes})}
    const current=()=>active&&options.current()
    const deadline=view.setTimeout(()=>{if(current()){rejectStarted(Error('READER_NATIVE_STARTUP_DEADLINE'))
      options.failed?.('READER_NATIVE_STARTUP_DEADLINE')}},options.startupDeadlineMs)
    const send=(row:FrameRow,data:object)=>row.port.postMessage(data)
    function adoptReadScope(row:FrameRow,value:ReaderRegexDocumentSnapshotV1):string {
      row.snapshot=value
      if(row.readRevision!==value.readRevision){row.readRevision=value.readRevision;row.readScope=crypto.randomUUID()}
      return row.readScope
    }
    const receiptKey=(frame:HTMLIFrameElement,id:number)=>({frame,id})
    const requestKeys=new Map<HTMLIFrameElement,Map<number,object>>()
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
    const receive=(documentPlanSha256:string,row:FrameRow,data:any)=>{
      if(!current()||frames.get(documentPlanSha256)!==row)return
      if(data.op==='parent-error'){
        rejectStarted(Error(data.code));options.failed?.(data.code)
      }else if(data.op==='parent-ready'){
        const plan=documents.find(plan=>plan.documentPlanSha256===documentPlanSha256)!
        const html=readerNativeDocumentHtml(plan,row.snapshot,row.channel,libraries,surface.documentLayout.get(),row.readScope)
        const messageIndex=row.snapshot.messages.find(message=>message.messageId===plan.origin.message.messageId)?.index
        send(row,{op:'mount',html,messageIndex,libraries:libraries.map(library=>library.javascript)})
      }else if(data.op==='ready'){
        row.ready=true
        send(row,{op:'snapshot',payload:row.snapshot,readScope:row.readScope})
        send(row,{op:'layout-config',payload:surface.documentLayout.get(),revision:row.layoutRevision})
        if([...frames.values()].every(row=>row.ready)){view.clearTimeout(deadline);resolveStarted()}
      }else if(data.op==='layout-height'){
        const height=data.payload?.height
        if(row.layoutPaused||data.revision!==row.layoutRevision){
          send(row,{op:'layout-height-ack',id:data.id,error:'READER_DOCUMENT_LAYOUT_SUPERSEDED'});return
        }
        row.ownHeight=`${Math.ceil(height)}px`;row.frame.style.height=row.ownHeight
        surface.scheduleLayout()
        view.requestAnimationFrame(()=>{if(current()&&row.frame.isConnected)
          send(row,{op:'layout-height-ack',id:data.id})})
      }else if(data.op==='receipt-observed'){
        const key=requestKeys.get(row.frame)?.get(data.id),receipt=key&&writes.get(key)
        if(receipt?.operationId&&receipt.operationId===data.operationId){
          requestKeys.get(row.frame)!.delete(data.id);finishReceipt(key!,'observed')
        }
      }else if(data.op==='opening-variants'||data.op==='message-body'||data.op==='mutate-namespace'
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
            let reply:ReaderOpeningVariantReplyV1|ReaderNumericalReplyV1|ReaderCommandReplyV1|ReaderMessageBodyReplyV1
              |ReaderOrdinaryNamespaceReplyV1,
              operationId:string|undefined
            if(data.op==='mutate-namespace') {
              if(!options.host.mutateNamespace)throw Error('READER_NAMESPACE_WRITE_UNAVAILABLE')
              reply=await options.host.mutateNamespace(binding as ReaderRegexDocumentBindingV1,documentPlanSha256,
                {...request,readRevision:row.readRevision},abort.signal)
              if(reply.reply.kind!=='no-update')operationId=request.operationId
            }else if(data.op==='message-body') {
              if(!options.host.mutateMessageBody)throw Error('READER_MESSAGE_BODY_WRITE_UNAVAILABLE')
              const selected=createAuthorNativeMessageVariables(row.snapshot).normalizeBodyRows(request.rows)
              if(!selected||selected.message.variants)throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE')
              const message=selected.message
              reply=await options.host.mutateMessageBody(binding as ReaderRegexDocumentBindingV1,documentPlanSha256,
                {schemaVersion:1,operationId:request.operationId,readRevision:row.readRevision,
                  expected:{sessionId:binding.sessionId,seq:message.nativeSeq!,messageId:message.messageId,
                    role:message.role as 'user'|'assistant',messageVersionSha256:message.messageVersionSha256},
                  text:selected.text,refresh:request.refresh},abort.signal)
              if(reply.result.kind==='committed')operationId=reply.result.operationId
            }else if(data.op==='execute-commands') {
              if(!options.host.executeCommands)throw Error('READER_NATIVE_COMMANDS_UNAVAILABLE')
              const commands=await options.host.executeCommands(binding as ReaderRegexDocumentBindingV1,
                documentPlanSha256,{operationId:request.operationId,command:request.command},abort.signal)
              reply=commands;operationId=commands.result.steps.at(-1)?.receipt.operationId
            }else if(data.op==='numerical-replace') {
              if(!options.host.replaceNumerical)throw Error('READER_NUMERICAL_WRITE_UNAVAILABLE')
              const operation:MvuPlayerEditRequest={schemaVersion:1,sessionId:binding.sessionId,
                operationId:request.operationId,action:'replace-values',expected:request.expected,values:request.values,
                ...request.target?{target:request.target}:{}}
              const numerical=await options.host.replaceNumerical(binding as ReaderRegexDocumentBindingV1,
                documentPlanSha256,row.readRevision,operation,abort.signal)
              reply=numerical
              if(numerical.result.operation&&numerical.result.operation.outcome!=='unknown')
                operationId=numerical.result.operation.operationId
            }else {
              const opening=await options.host.mutateOpeningVariants(binding as ReaderRegexDocumentBindingV1,documentPlanSha256,
                {...request,readRevision:row.readRevision},abort.signal)
              reply=opening
              if(opening.result.kind==='committed')operationId=opening.result.operationId
            }
            if(!current()){finishReceipt(key,'unavailable');return}
            if(operationId){
              receipt.operationId=operationId
              receipt.timer=view.setTimeout(()=>{
                keys!.delete(data.id);finishReceipt(key,'unavailable')
                options.diagnostic('READER_NATIVE_RECEIPT_UNOBSERVED')
              },settings.receiptObservationDeadlineMs??5000)
            }
            const readScope='snapshot' in reply&&reply.snapshot?adoptReadScope(row,reply.snapshot):undefined
            send(row,{op:'reply',id:data.id,payload:{...reply,readScope}})
            if(!operationId){keys!.delete(data.id);finishReceipt(key,'none')}
          }catch(error){
            if(receipt.operationId){
              keys!.delete(data.id);finishReceipt(key,'unavailable')
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
    async function mount():Promise<void> {
      if(!snapshot||booted||!current())return
      booted=true
      await surface.ready
      if(!current())return
      surface.setReaderProgram(program.programSha256+':native-prototype')
      for(const plan of documents){
        const container=surface.documentContainer(plan.documentPlanSha256),frame=container.ownerDocument.createElement('iframe')
        const ports=new view.MessageChannel()
        const parentUrl=settings.parentOrigins[plan.writes]
        if(!parentUrl)throw Error('READER_NATIVE_PARENT_ORIGIN_UNAVAILABLE')
        const row:FrameRow={frame,channel:crypto.randomUUID(),ready:false,readScope:crypto.randomUUID(),readRevision:snapshot!.readRevision,
          snapshot:snapshot!,
          ownHeight:'',layoutPaused:false,layoutRevision:0,port:ports.port1,transferPort:ports.port2,
          connect(){
            if(current()&&frames.get(plan.documentPlanSha256)===row)
              frame.contentWindow?.postMessage({channel:row.channel,op:'connect-parent'},new URL(parentUrl).origin,[row.transferPort])
          }}
        frames.set(plan.documentPlanSha256,row)
        row.port.onmessage=event=>receive(plan.documentPlanSha256,row,event.data);row.port.start()
        frame.title='作者原生浏览器文档';frame.sandbox.add('allow-scripts','allow-same-origin')
        frame.setAttribute('credentialless','');frame.referrerPolicy='no-referrer'
        frame.style.cssText='display:block;width:100%;border:0'
        row.ownHeight=(settings.viewportHeightPx??surface.documentLayout.get().viewportHeight)+'px';frame.style.height=row.ownHeight
        row.observer=new view.MutationObserver(records=>{
          if(records.some(record=>record.attributeName==='height')||frame.style.height!==row.ownHeight){
            row.layoutPaused=true;send(row,{op:'layout-pause'})
          }
        })
        row.observer.observe(frame,{attributes:true,attributeFilter:['style','height']})
        const url=new URL(parentUrl);url.hash=new URLSearchParams({channel:row.channel}).toString()
        frame.src=url.href
        frame.addEventListener('load',row.connect,{once:true})
        container.replaceChildren(frame)
      }
      if(!documents.length){view.clearTimeout(deadline);resolveStarted()}
    }
    return {started,disposed,lifecycle,waitForReceiptObservation,
      render(value){if(!options.surface)surface.render(value);void mount().catch(error=>{
        rejectStarted(error);options.failed?.('READER_NATIVE_MOUNT_FAILED')})},
      publishSnapshot(value){snapshot=value;for(const row of frames.values()){
        const readScope=adoptReadScope(row,value)
        if(row.ready)send(row,{op:'snapshot',payload:value,readScope})}
        void mount().catch(error=>{
          rejectStarted(error);options.failed?.('READER_NATIVE_MOUNT_FAILED')})},
      async waitForAdmittedSourceWrites(){
        if(await waitForReceiptObservation()==='unavailable')throw Error('READER_NATIVE_RECEIPT_UNOBSERVED')
      },
      dispose(){
        if(!active)return
        active=false;abort.abort();view.clearTimeout(deadline);stopLayout()
        resolveBridgeRevoked()
        for(const key of writes.keys())finishReceipt(key,'unavailable')
        requestKeys.clear()
        // Revokes the bridge immediately; physical CPU termination is NOT
        // promised by DOM removal. The browser probe measures that separately.
        for(const row of frames.values()){
          row.observer?.disconnect();row.frame.removeEventListener('load',row.connect)
          row.port.onmessage=null;row.port.close();row.transferPort.close();row.frame.remove()
        }
        resolveFramesRemoved()
        frames.clear();rejectStarted(Error('READER_BINDING_REVOKED'))
        const close=options.host?.closeBinding(binding as any)??Promise.resolve()
        void close.catch(error=>options.diagnostic(String(error))).finally(()=>{
          if(!options.surface)surface.dispose();resolveDisposed()
        })
      }}
  }
}
