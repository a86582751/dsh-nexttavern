/** Profile-owned append-only publication. A single owner lock serializes its
 * intent/head pair. An unknown acknowledgement leaves the immutable intent
 * available by operation ID so a retry can finish or recover its receipt. */
import {recordSha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {withTavernLock} from './tavern-task-support.js'
import {readAuthorProfileIdentityV1} from './roleplay-author-profile.js'
import type {AuthorWorldbookDependenciesV1,AuthorWorldbookRefV1,AuthorWorldbookReceiptV1,
  AuthorWorldbookWriterV1,AuthorWorldbookWriteAddressV1} from './roleplay-author-worldbook-types.js'

export interface AuthorWorldbookEventV1<Payload> {
  readonly schemaVersion:1
  readonly encoding:'author-worldbook-event-v1'
  readonly owner:AuthorWorldbookWriteAddressV1
  readonly operationId:string
  readonly inputSha256:string
  readonly previous:AuthorWorldbookRefV1|null
  readonly revision:number
  readonly payload:Payload
  readonly sha256:string
}
interface Head {
  readonly schemaVersion:1
  readonly encoding:'author-worldbook-head-v1'
  readonly owner:AuthorWorldbookWriteAddressV1
  readonly event:AuthorWorldbookRefV1
}
interface AcceptedHead<Payload> {
  readonly schemaVersion:2
  readonly encoding:'author-worldbook-head-v2'
  readonly owner:AuthorWorldbookWriteAddressV1
  readonly published:AuthorWorldbookRefV1|null
  readonly pending?:AuthorWorldbookEventV1<Payload>
}
interface Publication<Payload> {
  readonly event:AuthorWorldbookEventV1<Payload>
  readonly previous:Publication<Payload>|null
}
interface Index<State,Payload> {
  readonly head:AuthorWorldbookRefV1|null
  readonly revision:number
  readonly state:State
  readonly publication:Publication<Payload>|null
}
const frozen=new WeakSet<object>()
export function freezeAuthorWorldbookDataV1<T>(value:T):T {
  if(value&&typeof value==='object'&&!frozen.has(value)) {
    for(const child of Object.values(value))freezeAuthorWorldbookDataV1(child)
    Object.freeze(value)
    frozen.add(value)
  }
  return value
}
export function sameAuthorWorldbookRefV1(left:AuthorWorldbookRefV1|null,right:AuthorWorldbookRefV1|null):boolean {
  return left===right||!!left&&!!right&&left.key===right.key&&left.sha256===right.sha256
}
export class AuthorWorldbookWriteUnknownV1 extends Error {
  constructor(readonly owner:AuthorWorldbookWriteAddressV1,readonly operationId:string,
    readonly event:AuthorWorldbookRefV1) {super('AUTHOR_WORLDBOOK_WRITE_UNKNOWN')}
}
export function createAuthorWorldbookJournalV1<State,Payload>(deps:AuthorWorldbookDependenciesV1,
  actualOwner:AuthorWorldbookWriteAddressV1,initial:()=>State,
  apply:(state:State,payload:Payload,ref:AuthorWorldbookRefV1)=>State,
  beforePublish?:()=>void|PromiseLike<void>,completionWriter?:AuthorWorldbookWriterV1) {
  const owner=freezeAuthorWorldbookDataV1(cloneRoleplayTavernLoreDataV1(actualOwner))
  const namespace=recordSha256(owner),headKey=`author-worldbook-v1-head_${namespace}`,
    operationKey=(operationId:string)=>`author-worldbook-v1-event_${recordSha256({owner,operationId})}`
  const parsed=new WeakMap<object,AuthorWorldbookEventV1<Payload>>()
  const empty:Index<State,Payload>={head:null,revision:0,state:freezeAuthorWorldbookDataV1(initial()),publication:null}
  let index=empty
  const historical=new Map<string,Index<State,Payload>>()
  const published=new Map<number,string>()
  function assertProfile() {
    if(readAuthorProfileIdentityV1(deps.table)?.profileId!==deps.profile.profileId)
      throw Error('AUTHOR_PROFILE_IDENTITY_CHANGED')
  }
  function eventAt(ref:AuthorWorldbookRefV1):AuthorWorldbookEventV1<Payload> {
    const raw=deps.table.get(ref.key)
    return parseEvent(raw,ref)
  }
  function parseEvent(raw:unknown,ref:AuthorWorldbookRefV1):AuthorWorldbookEventV1<Payload> {
    if(!raw||typeof raw!=='object')throw Error('AUTHOR_WORLDBOOK_HISTORY_MISSING')
    const cached=parsed.get(raw)
    if(cached&&cached.sha256===ref.sha256)return cached
    const event=cloneRoleplayTavernLoreDataV1(raw) as AuthorWorldbookEventV1<Payload>
    const {sha256,...body}=event
    if(event.schemaVersion!==1||event.encoding!=='author-worldbook-event-v1'
      ||recordSha256(event.owner)!==namespace||event.sha256!==ref.sha256||recordSha256(body)!==sha256
      ||operationKey(event.operationId)!==ref.key)throw Error('AUTHOR_WORLDBOOK_RECORD_INVALID')
    const result=freezeAuthorWorldbookDataV1(event)
    parsed.set(raw,result)
    return result
  }
  function head():AuthorWorldbookRefV1|null {
    if(completionWriter)return acceptedHead().published
    assertProfile()
    const raw=deps.table.get(headKey) as Head|undefined
    if(raw===undefined)return null
    if(raw.schemaVersion!==1||raw.encoding!=='author-worldbook-head-v1'
      ||recordSha256(raw.owner)!==namespace)throw Error('AUTHOR_WORLDBOOK_RECORD_INVALID')
    return raw.event
  }
  function acceptedHead():AcceptedHead<Payload> {
    assertProfile()
    const raw=deps.table.get(headKey) as AcceptedHead<Payload>|undefined
    if(raw===undefined)return {schemaVersion:2,encoding:'author-worldbook-head-v2',owner,published:null}
    if(raw.schemaVersion!==2||raw.encoding!=='author-worldbook-head-v2'||recordSha256(raw.owner)!==namespace)
      throw Error('AUTHOR_WORLDBOOK_RECORD_INVALID')
    if(raw.pending)return {...raw,pending:parseEvent(raw.pending,
      {key:operationKey(raw.pending.operationId),sha256:raw.pending.sha256})}
    return raw
  }
  function resolveAt(ref:AuthorWorldbookRefV1|null,retain:boolean):Index<State,Payload> {
    if(sameAuthorWorldbookRefV1(index.head,ref))return index
    if(ref) {
      const cached=historical.get(ref.sha256)
      if(cached)return cached
    }
    const suffix:{event:AuthorWorldbookEventV1<Payload>;ref:AuthorWorldbookRefV1}[]=[]
    let cursor=ref,base:Index<State,Payload>|undefined
    while(cursor) {
      if(sameAuthorWorldbookRefV1(cursor,index.head)) {base=index;break}
      const cached=historical.get(cursor.sha256)
      if(cached) {base=cached;break}
      const event=eventAt(cursor)
      suffix.push({event,ref:cursor})
      cursor=event.previous
    }
    base??=empty
    for(const item of suffix.reverse()) {
      if(item.event.revision!==base.revision+1)
        throw Error('AUTHOR_WORLDBOOK_HISTORY_INVALID')
      base={head:item.ref,revision:item.event.revision,
        state:freezeAuthorWorldbookDataV1(apply(base.state,item.event.payload,item.ref)),
        publication:{event:item.event,previous:base.publication}}
    }
    // Retain full DATA only for a root explicitly requested by a frozen
    // consumer. Normal advancement retains a lightweight publication chain.
    if(retain&&ref)historical.set(ref.sha256,base)
    return base
  }
  function adopt(next:Index<State,Payload>) {
    let cursor=next.publication
    while(cursor&&published.get(cursor.event.revision)!==cursor.event.sha256) {
      published.set(cursor.event.revision,cursor.event.sha256)
      cursor=cursor.previous
    }
    index=next
    return index
  }
  function capture() {return adopt(resolveAt(head(),false))}
  function resolve(ref:AuthorWorldbookRefV1|null) {return resolveAt(ref,true)}
  const isPublished=(current:Index<State,Payload>,event:AuthorWorldbookEventV1<Payload>)=>
    event.revision<=current.revision&&published.get(event.revision)===event.sha256
  function receipt(event:AuthorWorldbookEventV1<Payload>,kind:'committed'|'replayed'):AuthorWorldbookReceiptV1 {
    return freezeAuthorWorldbookDataV1({schemaVersion:1,kind,owner,operationId:event.operationId,
      event:{key:operationKey(event.operationId),sha256:event.sha256},revision:event.revision})
  }
  async function assertWriter(writer:AuthorWorldbookWriterV1) {
    assertProfile()
    if(!writer.owns(owner)||!await writer.isCurrent())throw Error('AUTHOR_WORLDBOOK_WRITER_REVOKED')
  }
  async function put(key:string,value:object,event:AuthorWorldbookEventV1<Payload>,writer:AuthorWorldbookWriterV1) {
    const release=writer.beforeWrite?.({key,value})
    try {
      deps.beforePersistentWrite?.(owner)
      await deps.table.put(key,value)
    }
    catch {throw new AuthorWorldbookWriteUnknownV1(owner,event.operationId,
      {key:operationKey(event.operationId),sha256:event.sha256})}
    finally {release?.()}
  }
  function acceptedValueMatches(key:string,value:object,event:AuthorWorldbookEventV1<Payload>):boolean {
    try {
      if(key!==headKey)return eventAt({key,sha256:event.sha256}).sha256===event.sha256
      const actual=acceptedHead(),expected=value as AcceptedHead<Payload>
      return sameAuthorWorldbookRefV1(actual.published,expected.published)
        &&actual.pending?.sha256===expected.pending?.sha256
    }catch{return false}
  }
  async function putAccepted(key:string,value:object,event:AuthorWorldbookEventV1<Payload>,writer:AuthorWorldbookWriterV1) {
    await assertWriter(writer)
    const release=writer.beforeWrite?.({key,value})
    try {
      try {
        deps.beforePersistentWrite?.(owner)
        await deps.table.put(key,value)
      }catch {
        // A lost acknowledgement can follow a durable put. The same journal
        // readers establish its event/head identity for both outcomes.
      }
      if(!acceptedValueMatches(key,value,event))throw new AuthorWorldbookWriteUnknownV1(
        owner,event.operationId,{key:operationKey(event.operationId),sha256:event.sha256})
    }finally{release?.()}
  }
  async function finishAccepted(prepared?:Index<State,Payload>) {
    const accepted=acceptedHead(),event=accepted.pending
    if(!event)return
    const writer=completionWriter!
    await assertWriter(writer)
    const current=capture()
    if(!sameAuthorWorldbookRefV1(event.previous,current.head)||event.revision!==current.revision+1)
      throw Error('AUTHOR_WORLDBOOK_HISTORY_INVALID')
    const key=operationKey(event.operationId),ref={key,sha256:event.sha256},stored=deps.table.get(key)
    if(stored===undefined)await putAccepted(key,event,event,writer)
    else if(eventAt(ref).sha256!==event.sha256)throw Error('AUTHOR_WORLDBOOK_OPERATION_CONFLICT')
    const next=prepared??resolveAt(ref,false)
    await putAccepted(headKey,{schemaVersion:2,encoding:'author-worldbook-head-v2',owner,published:ref},event,writer)
    adopt(next)
    return {receipt:receipt(event,'committed'),event,index}
  }
  async function commitAccepted(input:{expectedHead?:AuthorWorldbookRefV1|null;operationId:string;input:unknown;
    plan:(state:State)=>Payload},writer:AuthorWorldbookWriterV1) {
    return withTavernLock(deps.table,headKey,async()=>{
      await assertWriter(completionWriter!)
      await finishAccepted()
      const current=capture(),key=operationKey(input.operationId),raw=deps.table.get(key),inputSha256=recordSha256(input.input)
      if(!input.operationId)throw Error('AUTHOR_WORLDBOOK_OPERATION_ID_REQUIRED')
      if(raw!==undefined) {
        const event=eventAt({key,sha256:(raw as AuthorWorldbookEventV1<Payload>).sha256})
        if(event.inputSha256!==inputSha256)throw Error('AUTHOR_WORLDBOOK_OPERATION_CONFLICT')
        if(!isPublished(current,event))throw Error('AUTHOR_WORLDBOOK_HISTORY_INVALID')
        return {receipt:receipt(event,'replayed'),event,index:current}
      }
      await assertWriter(writer)
      if(input.expectedHead!==undefined&&!sameAuthorWorldbookRefV1(current.head,input.expectedHead))
        throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
      const body={schemaVersion:1 as const,encoding:'author-worldbook-event-v1' as const,owner,
        operationId:input.operationId,inputSha256,previous:current.head,revision:current.revision+1,
        payload:cloneRoleplayTavernLoreDataV1(input.plan(current.state))},
        event=freezeAuthorWorldbookDataV1({...body,sha256:recordSha256(body)}),ref={key,sha256:event.sha256}
      // Validate the planned payload before this head accepts it. A pending
      // event can then finish without re-running a retired Source admission.
      const next:Index<State,Payload>={head:ref,revision:event.revision,
        state:freezeAuthorWorldbookDataV1(apply(current.state,event.payload,ref)),
        publication:{event,previous:current.publication}}
      await beforePublish?.()
      await assertWriter(writer)
      await assertWriter(completionWriter!)
      await putAccepted(headKey,{schemaVersion:2,encoding:'author-worldbook-head-v2',owner,
        published:current.head,pending:event},event,writer)
      return (await finishAccepted(next))!
    })
  }
  async function commit(input:{expectedHead?:AuthorWorldbookRefV1|null;operationId:string;input:unknown;
    plan:(state:State)=>Payload},writer:AuthorWorldbookWriterV1) {
    if(completionWriter)return commitAccepted(input,writer)
    return withTavernLock(deps.table,headKey,async()=>{
      await assertWriter(writer)
      const current=capture(),key=operationKey(input.operationId),inputSha256=recordSha256(input.input)
      if(!input.operationId)throw Error('AUTHOR_WORLDBOOK_OPERATION_ID_REQUIRED')
      const raw=deps.table.get(key)
      let event:AuthorWorldbookEventV1<Payload>
      if(raw!==undefined) {
        event=eventAt({key,sha256:(raw as AuthorWorldbookEventV1<Payload>).sha256})
        if(event.inputSha256!==inputSha256)throw Error('AUTHOR_WORLDBOOK_OPERATION_CONFLICT')
        if(isPublished(current,event))return {receipt:receipt(event,'replayed'),event,index:current}
        if(!sameAuthorWorldbookRefV1(event.previous,current.head))throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
      }else {
        if(input.expectedHead!==undefined&&!sameAuthorWorldbookRefV1(current.head,input.expectedHead))
          throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
        const body={schemaVersion:1 as const,encoding:'author-worldbook-event-v1' as const,owner,
          operationId:input.operationId,inputSha256,previous:current.head,revision:current.revision+1,
          payload:cloneRoleplayTavernLoreDataV1(input.plan(current.state))}
        event=freezeAuthorWorldbookDataV1({...body,sha256:recordSha256(body)})
        await assertWriter(writer)
        if(!sameAuthorWorldbookRefV1(head(),current.head))throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
        await put(key,event,event,writer)
      }
      try {
        await assertWriter(writer)
        if(!sameAuthorWorldbookRefV1(head(),current.head))throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
        await beforePublish?.()
        const ref={key,sha256:event.sha256}
        // Validate/fold before publishing. A planner failure leaves the old head
        // authoritative and never exposes a malformed partially applied book.
        const next=resolveAt(ref,false)
        await assertWriter(writer)
        await put(headKey,{schemaVersion:1,encoding:'author-worldbook-head-v1',owner,event:ref},event,writer)
        if(!sameAuthorWorldbookRefV1(head(),ref))throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
        adopt(next)
        return {receipt:receipt(event,'committed'),event,index}
      }catch(error) {
        if(!(error instanceof Error)||error.message!=='AUTHOR_WORLDBOOK_WRITER_REVOKED')throw error
        // The immutable operation already exists. Preserve its recovery anchor
        // when the live writer is revoked before its head can publish.
        throw new AuthorWorldbookWriteUnknownV1(owner,event.operationId,{key,sha256:event.sha256})
      }
    })
  }
  async function retry(operationId:string,writer:AuthorWorldbookWriterV1) {
    if(completionWriter)return withTavernLock(deps.table,headKey,async()=>{
      await assertWriter(completionWriter)
      await finishAccepted()
      const event=operation(operationId),current=capture()
      if(!isPublished(current,event))throw Error('AUTHOR_WORLDBOOK_HISTORY_INVALID')
      return {receipt:receipt(event,'replayed'),event,index:current}
    })
    const raw=deps.table.get(operationKey(operationId)) as AuthorWorldbookEventV1<Payload>|undefined
    if(!raw)throw Error('AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED')
    const event=eventAt({key:operationKey(operationId),sha256:raw.sha256})
    // The durable input hash is reused without inventing a fresh caller input.
    return withTavernLock(deps.table,headKey,async()=>{
      await assertWriter(writer)
      const current=capture()
      if(isPublished(current,event))return {receipt:receipt(event,'replayed'),event,index:current}
      if(!sameAuthorWorldbookRefV1(current.head,event.previous))throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
      const ref={key:operationKey(operationId),sha256:event.sha256},next=resolveAt(ref,false)
      await assertWriter(writer)
      if(!sameAuthorWorldbookRefV1(head(),current.head))throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
      await beforePublish?.()
      await assertWriter(writer)
      await put(headKey,{schemaVersion:1,encoding:'author-worldbook-head-v1',owner,event:ref},event,writer)
      if(!sameAuthorWorldbookRefV1(head(),ref))throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
      adopt(next)
      return {receipt:receipt(event,'committed'),event,index}
    })
  }
  /** Core operations involving this content owner and the catalog take the
   * content lock first, then the catalog lock. No path takes the reverse order. */
  function withLock<T>(work:()=>T|PromiseLike<T>):Promise<T> {return withTavernLock(deps.table,headKey,work)}
  function operation(operationId:string) {
    if(completionWriter) {
      const pending=acceptedHead().pending
      if(pending?.operationId===operationId)return parseEvent(pending,{key:operationKey(operationId),sha256:pending.sha256})
    }
    const key=operationKey(operationId),raw=deps.table.get(key) as AuthorWorldbookEventV1<Payload>|undefined
    if(!raw)throw Error('AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED')
    return eventAt({key,sha256:raw.sha256})
  }
  const finishPending=()=>withTavernLock(deps.table,headKey,async()=>{
    if(!completionWriter)return
    await assertWriter(completionWriter)
    return finishAccepted()
  })
  function publishedReceipt(operationId:string,input?:unknown):AuthorWorldbookReceiptV1|undefined {
    const event=operation(operationId),current=capture()
    if(input!==undefined&&recordSha256(input)!==event.inputSha256)throw Error('AUTHOR_WORLDBOOK_OPERATION_CONFLICT')
    return isPublished(current,event)?receipt(event,'replayed'):undefined
  }
  return {capture,resolve,commit,retry,eventAt,withLock,operation,finishPending,publishedReceipt}
}
