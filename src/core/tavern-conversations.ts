import { createHash } from 'node:crypto'

export interface WorldlineRecord {
  schemaVersion: 1
  sessionId: string
  conversationId: string
  sourceSessionId: string
  operationId: string
  kind: string
  status: 'ready' | 'reserved' | 'failed'
  createdAt: number
  source: { kind: 'registered-fork-migration' | 'fork-reservation'; sha256: string }
}
export interface ConversationRecord {
  schemaVersion: 1
  conversationId: string
  activeSessionId: string
  selectionRevision?: number
  updatedAt: number
}
export interface ConversationSnapshot {
  schemaVersion: 1
  revision: number
  updatedAt?: number
  worldlines: Record<string, WorldlineRecord | undefined>
  conversations: Record<string, ConversationRecord | undefined>
}
export interface WorldlineReservation {
  sourceSessionId: string
  childSessionId: string
  operationId: string
  kind: string
  sourceHash: string
}
export interface LegacyForkOperation {
  operationId?: string
  kind?: string
  state?: string
  abortedAt?: number | null
  reservedChildSessionId?: string
  childSessionId?: string
  groupId?: string
  registration?: { truncated?: boolean }
  anchor?: { sourceSessionId?: string; [field: string]: unknown }
  consumed?: boolean
  registeredAt?: number | string | null
}
type RegisteredForkOperation = LegacyForkOperation & {
  childSessionId: string
  kind: string
  anchor: { sourceSessionId: string; [field: string]: unknown }
}
const kinds = new Set(['regenerate','player-edit','player-edit-send','edit','delete-user'])
const copy = <T>(value: T): T => structuredClone(value)
const id = (value: unknown): string => {
  if(typeof value!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(value)||['__proto__','constructor','prototype'].includes(value))throw new Error('会话或操作标识无效')
  return value
}
const hash = (value: object) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** Presentation ownership only. Execution, memory and authoritative seq stay
 * on their existing native Session. Writes commit before any snapshot changes. */
export function createConversationCatalog({read,write}: {
  read: () => unknown
  write: (snapshot: ConversationSnapshot) => unknown | Promise<unknown>
}) {
  const loaded = read()
  if(loaded&&(typeof loaded!=='object'||!('schemaVersion' in loaded)||loaded.schemaVersion!==1||!('worldlines' in loaded)||!loaded.worldlines||!('conversations' in loaded)||!loaded.conversations))throw new Error('酒馆会话目录版本损坏，未覆盖原记录')
  let state: ConversationSnapshot = loaded ? copy(loaded as ConversationSnapshot) : {schemaVersion:1,revision:0,worldlines:{},conversations:{}}
  for(const book of Object.values(state.conversations))if(book?.selectionRevision!==undefined&&(!Number.isSafeInteger(book.selectionRevision)||book.selectionRevision<0))throw Error('世界线选择版本损坏，未覆盖原记录')
  let chain: Promise<unknown> = Promise.resolve()
  const rootOf = (sessionId: string, snapshot = state) => snapshot.worldlines[id(sessionId)]?.conversationId ?? sessionId
  const mutate = (work: (next: ConversationSnapshot) => boolean | void | Promise<boolean | void>) => {
    const job=chain.catch(()=>{}).then(async()=>{
      const next=copy(state),changed=await work(next)
      if(changed!==false){next.revision=state.revision+1;next.updatedAt=Date.now();await write(next);state=next}
      return copy(state)
    })
    chain=job;return job
  }
  function reserve(next: ConversationSnapshot,{sourceSessionId,childSessionId,operationId,kind,sourceHash}: WorldlineReservation,migration=false) {
    for(const value of [sourceSessionId,childSessionId,operationId])id(value)
    if(!kinds.has(kind)||!/^[a-f0-9]{64}$/.test(sourceHash??''))throw new Error('世界线来源证据无效')
    const conversationId=rootOf(sourceSessionId,next)
    if(childSessionId===sourceSessionId||childSessionId===conversationId)throw new Error('世界线不能指向自身')
    const previous=next.worldlines[childSessionId]
    if(previous) {
      if(previous.conversationId!==conversationId||previous.operationId!==operationId||previous.sourceSessionId!==sourceSessionId)throw new Error('世界线已绑定其他会话归属')
      return false
    }
    next.worldlines[childSessionId]={schemaVersion:1,sessionId:childSessionId,conversationId,sourceSessionId,operationId,kind,
      status:migration?'ready':'reserved',createdAt:Date.now(),source:{kind:migration?'registered-fork-migration':'fork-reservation',sha256:sourceHash}}
    next.conversations[conversationId]??={schemaVersion:1,conversationId,activeSessionId:conversationId,updatedAt:Date.now()}
    return true
  }
  return {
    snapshot:()=>copy(state),rootOf,
    reserve:(reservation: WorldlineReservation)=>mutate(next=>reserve(next,reservation)),
    markReady:(sessionId: string)=>mutate(next=>{
      const member=next.worldlines[id(sessionId)]
      if(!member)throw new Error('世界线尚未登记')
      if(member.status==='failed')throw new Error('世界线已失效，请重新发起')
      if(member.status==='ready')return false
      member.status='ready'
    }),
    fail:(sessionId: string,operationId?: string)=>mutate(next=>{
      const member=next.worldlines[id(sessionId)]
      if(!member)return false
      if(operationId&&member.operationId!==operationId)throw new Error('世界线失败操作归属不匹配')
      let changed=member.status!=='failed'
      member.status='failed'
      const book=next.conversations[member.conversationId]
      // Compare-and-swap rollback: a late failure cannot steal a newer choice.
      if(book?.activeSessionId===sessionId){
        const parent=next.worldlines[member.sourceSessionId]
        book.activeSessionId=!parent||parent.status==='ready'?member.sourceSessionId:member.conversationId
        book.updatedAt=Date.now();book.selectionRevision=(book.selectionRevision??0)+1;changed=true
      }
      return changed
    }),
    activate:(sessionId: string)=>mutate(next=>{
      id(sessionId)
      const conversationId=rootOf(sessionId,next),member=next.worldlines[sessionId]
      if(member&&member.status!=='ready')throw new Error('世界线尚未就绪或已失效')
      const previous=next.conversations[conversationId]
      if(previous?.activeSessionId===sessionId&&(!member||state.worldlines[sessionId]?.status==='ready'))return false
      next.conversations[conversationId]={schemaVersion:1,conversationId,activeSessionId:sessionId,selectionRevision:(previous?.selectionRevision??0)+1,updatedAt:Date.now()}
    }),
    migrate:(operations: readonly (LegacyForkOperation | null | undefined)[])=>mutate(next=>{
      let recovered=false
      for(const op of operations){
        if(!op||!['failed','aborted'].includes(op.state??'')&&!op.abortedAt)continue
        const childId=op.reservedChildSessionId??op.childSessionId,member=childId===undefined?undefined:next.worldlines[childId]
        if(!member||member.operationId!==op.operationId)continue
        if(member.status!=='failed'){member.status='failed';recovered=true}
        const book=next.conversations[member.conversationId]
        if(book&&book.activeSessionId===childId){book.activeSessionId=member.conversationId;book.updatedAt=Date.now();book.selectionRevision=(book.selectionRevision??0)+1;recovered=true}
      }
      const eligible=(op: LegacyForkOperation | null | undefined): op is RegisteredForkOperation => Boolean(op &&
        (op.groupId||op.registration?.truncated===true)&&op.childSessionId&&op.anchor?.sourceSessionId&&op.kind&&kinds.has(op.kind)&&!['failed','aborted'].includes(op.state??'')&&!op.abortedAt&&(op.consumed===true||op.state==='registered'||Number(op.registeredAt)>0))
      const pending=new Map(operations.filter(eligible).map(op=>[op.childSessionId,op]))
      let changed=recovered,progress=true
      while(pending.size&&progress){progress=false
        for(const [child,op] of pending){
          if(pending.has(op.anchor.sourceSessionId)&&!next.worldlines[op.anchor.sourceSessionId])continue
          changed=reserve(next,{sourceSessionId:op.anchor.sourceSessionId,childSessionId:child,operationId:id(op.operationId),kind:op.kind,sourceHash:hash(op.anchor)},true)||changed
          pending.delete(child);progress=true
        }
      }
      // Cyclic/unregistered legacy records cannot establish ownership. Leave
      // those Sessions independent instead of guessing from parentSession.
      return changed
    }),
  }
}
