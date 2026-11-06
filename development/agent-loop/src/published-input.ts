/** Canonical user publications and their one actual inbox trigger. Bodies live
 * only in user/message; this incremental index follows the existing log owner. */
import type {Session,SessionEvent,UserMessage} from 'dsh-nexttavern-native-session'
import {readNativeAuthorPublicationV1,readNativePublishedTriggerV1} from 'dsh-nexttavern-native-session/types'
import type {NativeAuthorPublicationV1,NativePublishedTriggerV1,NativePublishedUserRefV1,
  NativePublishedInputAssociationV1,NativeInputRef} from 'dsh-nexttavern-native-session/types'
import type {NativeInputWakeResult} from './input-admission.js'

export interface NativePublishedUserInputV1 {
  readonly operationId:string
  readonly producer:string
  readonly origin:string
  readonly messages:readonly UserMessage[]
  /** The existing Source owner checks current permission; no new digest gate. */
  assertCurrent():void
}
export interface NativePublishedInputReceiptV1 {
  readonly schemaVersion:1
  readonly sessionId:string
  readonly operationId:string
  readonly producer:string
  readonly origin:string
  readonly batchSha256:string
  readonly users:readonly NativePublishedUserRefV1[]
  readonly flushed:true
}
export type NativePublishedUserInputResultV1=
  |{readonly kind:'published';readonly receipt:NativePublishedInputReceiptV1;readonly replayed:boolean}
  |{readonly kind:'blocked'|'unknown';readonly code:string}
export interface NativePublishedTriggerInputV1 {readonly operationId:string;assertCurrent():void}
export interface NativePublishedTriggerReceiptV1 {
  readonly schemaVersion:1
  readonly sessionId:string
  readonly operationId:string
  readonly insertSeq:number
  readonly users:readonly NativePublishedUserRefV1[]
  readonly refs:readonly NativeInputRef[]
  readonly flushed:true
}
export type NativePublishedTriggerResultV1=
  |{readonly kind:'triggered';readonly receipt:NativePublishedTriggerReceiptV1;
      readonly replayed:boolean;readonly wake:NativeInputWakeResult}
  |{readonly kind:'blocked'|'unknown'|'empty';readonly code:string}
export type NativePublishedInboxSpliceV1=SessionEvent<'agent/inbox/spliced'>['data']&{
  readonly publishedInput:NativePublishedTriggerV1}
type PublishedUser={readonly ref:NativePublishedUserRefV1;readonly message:UserMessage;
  readonly publication:NativeAuthorPublicationV1;readonly inherited:boolean;trigger?:TriggeredBatch}
export interface PublishedBatch {
  readonly publication:NativeAuthorPublicationV1
  readonly users:PublishedUser[]
}
export interface TriggeredBatch {
  readonly operationId:string
  readonly insertSeq:number
  readonly users:readonly PublishedUser[]
  readonly refs:readonly NativeInputRef[]
}
export function createNativePublishedInputHistory(sessionId:string,inheritedBoundary:number,hash:(value:unknown)=>string){
  const batches=new Map<string,PublishedBatch>(),bySeq=new Map<number,PublishedUser>(),byId=new Map<string,PublishedUser>()
  const triggers=new Map<string,TriggeredBatch>()
  const pendingBatches=new Map<string,PublishedBatch>(),incompleteBatches=new Set<string>()
  function append(event:SessionEvent,messageDigests?:readonly string[]):void {
    if(event.type==='user/message'){
      const publication=readNativeAuthorPublicationV1(event.data.source)
      if(!publication)return
      if(event.surfaceOp!=='append')throw Error('PUBLISHED_INPUT_REPLACEMENT_UNSUPPORTED')
      let batch=batches.get(publication.operationId)
      if(!batch){batch={publication,users:[]};batches.set(publication.operationId,batch)
        if(event.seq>=inheritedBoundary)incompleteBatches.add(publication.operationId)}
      const identity=batch.publication
      if(identity.count!==publication.count||identity.batchSha256!==publication.batchSha256
        ||identity.producer!==publication.producer||identity.origin!==publication.origin
        ||batch.users.length!==publication.index||byId.has(event.data.id))throw Error('PUBLISHED_INPUT_HISTORY_CONFLICT')
      const user:PublishedUser={ref:Object.freeze({userSeq:Number(event.seq),messageId:String(event.data.id),
        messageSha256:messageDigests?.[0]??hash(event.data)}),message:event.data,publication,inherited:event.seq<inheritedBoundary}
      batch.users.push(user);bySeq.set(event.seq,user);byId.set(event.data.id,user)
      if(batch.users.length===publication.count){
        incompleteBatches.delete(publication.operationId)
        if(!user.inherited)pendingBatches.set(publication.operationId,batch)
      }
    }else if(event.type==='agent/inbox/spliced'){
      const marker=readNativePublishedTriggerV1(event.data)
      if(!marker)return
      // Parent publications stay readable, but their original inbox trigger
      // never becomes a child publication capability.
      if(event.seq<inheritedBoundary)return
      if(event.data.target!=='next-step'||event.data.removedCount
        ||event.data.inserted.length!==marker.users.length||triggers.has(marker.operationId))
        throw Error('PUBLISHED_TRIGGER_HISTORY_CONFLICT')
      const users=marker.users.map((ref,index)=>{
        const actual=bySeq.get(ref.userSeq),message=event.data.inserted[index]
        if(!actual||actual.inherited||actual.trigger||ref.messageId!==actual.ref.messageId
          ||ref.messageSha256!==actual.ref.messageSha256||!message
          ||(messageDigests?.[index]??hash(message))!==actual.ref.messageSha256)
          throw Error('PUBLISHED_TRIGGER_USER_UNPROVEN')
        return actual
      })
      const selected=new Set(users)
      if(selected.size!==users.length)throw Error('PUBLISHED_TRIGGER_USER_UNPROVEN')
      for(const operationId of new Set(users.map(user=>user.publication.operationId))){const batch=batches.get(operationId)!
        if(batch.users.length!==batch.publication.count||batch.users.some(row=>!selected.has(row)))
          throw Error('PUBLISHED_TRIGGER_BATCH_INCOMPLETE')}
      const trigger:TriggeredBatch=Object.freeze({operationId:marker.operationId,insertSeq:Number(event.seq),users,
        refs:Object.freeze(users.map(user=>Object.freeze({sessionId,insertSeq:Number(event.seq),
          messageId:user.ref.messageId,messageSha256:user.ref.messageSha256})))})
      for(const user of users){user.trigger=trigger;pendingBatches.delete(user.publication.operationId)}
      triggers.set(marker.operationId,trigger)
    }
  }
  return {append,batch:(operationId:string)=>batches.get(operationId),trigger:(operationId:string)=>triggers.get(operationId),
    hasUser:(userSeq:number)=>bySeq.has(userSeq),
    hasIncomplete:()=>incompleteBatches.size>0,
    pending:()=>[...pendingBatches.values()].flatMap(batch=>batch.users).sort((left,right)=>left.ref.userSeq-right.ref.userSeq),
    association(ref:NativeInputRef):NativePublishedInputAssociationV1|undefined {
      const user=byId.get(ref.messageId),trigger=user?.trigger
      if(!user||!trigger||ref.sessionId!==sessionId||trigger.insertSeq!==ref.insertSeq
        ||user.ref.messageSha256!==ref.messageSha256)return
      return Object.freeze({schemaVersion:1,publicationOperationId:user.publication.operationId,
        triggerOperationId:trigger.operationId,userSeq:user.ref.userSeq,insertSeq:trigger.insertSeq})
    },isPublished(message:UserMessage,digest:string){
      const user=byId.get(message.id)
      return !!user&&!user.inherited&&user.trigger!==undefined&&user.ref.messageSha256===digest
    }}
}
export type NativePublishedInputHistory=ReturnType<typeof createNativePublishedInputHistory>

/** The caller already holds Native maintenance. A lost ACK retries the same
 * accepted prefix; cancellation never removes an irreversible user event. */
export async function appendNativePublishedUserInput(options:{session:Session;input:NativePublishedUserInputV1;
  history():NativePublishedInputHistory;hash(value:unknown):string;flush():Promise<boolean>;signal:AbortSignal}):Promise<NativePublishedUserInputResultV1>{
  const {session,input,hash,signal}=options
  const {operationId,producer,origin,assertCurrent}=input
  if(!operationId||!producer||!origin||!Array.isArray(input.messages)||!input.messages.length
    ||input.messages.some(message=>message.role!=='user'||message.source.kind!=='user'
      ||Object.keys(message.source).some(key=>key!=='kind')
      ||message.content.some((block:UserMessage['content'][number])=>block.type!=='text')))
    return {kind:'blocked',code:'PUBLISHED_INPUT_UNSUPPORTED'}
  if(new Set(input.messages.map(message=>message.id)).size!==input.messages.length)
    return {kind:'blocked',code:'PUBLISHED_INPUT_DUPLICATE_MESSAGE'}
  // New input is detached once. Canonical source attribution is owned here,
  // rather than accepting a user RPC id or a caller-issued publication marker.
  const messages=structuredClone(input.messages),batchSha256=hash(messages)
  const existing=options.history().batch(operationId),replayed=existing!==undefined
  if(existing&&(existing.publication.batchSha256!==batchSha256||existing.publication.producer!==producer
    ||existing.publication.origin!==origin||existing.publication.count!==messages.length
    ||existing.users.some(user=>user.inherited)))return {kind:'blocked',code:'PUBLISHED_INPUT_OPERATION_CONFLICT'}
  try {
    // A fully accepted retry has no append iteration. Its historical receipt
    // still cannot replace the caller's current Source permission or Stop.
    if(existing?.users.length===messages.length){signal.throwIfAborted();assertCurrent()}
    for(let index=existing?.users.length??0;index<messages.length;index++){
      signal.throwIfAborted();assertCurrent()
      const publication:NativeAuthorPublicationV1={schemaVersion:1,encoding:'native-author-publication-v1',
        operationId,producer,origin,index,count:messages.length,batchSha256}
      session.append('user/message',{...messages[index]!,source:{kind:'user',authorPublication:publication}} as UserMessage,
        {surfaceOp:'append'})
    }
    if(!await options.flush())return {kind:'unknown',code:'PUBLISHED_INPUT_FLUSH_UNCONFIRMED'}
    const batch=options.history().batch(operationId)
    if(!batch||batch.users.length!==messages.length)return {kind:'unknown',code:'PUBLISHED_INPUT_APPEND_UNKNOWN'}
    return {kind:'published',replayed,receipt:Object.freeze({schemaVersion:1,sessionId:String(session.id),
      operationId,producer,origin,batchSha256,
      users:Object.freeze(batch.users.map(user=>user.ref)),flushed:true})}
  }catch{return {kind:'unknown',code:'PUBLISHED_INPUT_APPEND_OR_FLUSH_FAILED'}}
}
export function nativePublishedTriggerReceipt(sessionId:string,trigger:TriggeredBatch):NativePublishedTriggerReceiptV1 {
  return Object.freeze({schemaVersion:1,sessionId,operationId:trigger.operationId,insertSeq:trigger.insertSeq,
    users:Object.freeze(trigger.users.map(user=>user.ref)),refs:trigger.refs,flushed:true})
}
