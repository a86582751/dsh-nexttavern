/** Append-only numerical invalidation facts over actual accepted message edits.
 * This owner can deny authority and repair denial receipts; it never replays a
 * patch, changes a numerical head, or creates Native completion/permission. */
import {recordSha256,sha256} from './roleplay-data.js'
import type {MvuStateRoot} from './roleplay-mvu-state.js'
import {validateMvuSchemaStoryRoot} from './roleplay-mvu-schema-story-types.js'
import type {MvuSchemaStoryRoot} from './roleplay-mvu-schema-story-types.js'
import type {ReadBranchSession,StoryEvent} from './roleplay-worldline-types.js'

export type MvuEditBasisFacts = {kind:'none'}
  | {kind:'verified';sourceSha256:string;root:MvuStateRoot|MvuSchemaStoryRoot;editFloorSeq:number}
  | {kind:'unknown';code?:string}
export type MvuEditInvalidation = {kind:'clear'}
  | {kind:'invalidated';code:'NUMERICAL_EDIT_INVALIDATED';fromSeq:number}
  | {kind:'unknown';code:string}
export interface MvuEditInvalidationRecord {
  schemaVersion:1|2
  encoding:'native-mvu-edit-invalidation-v1'|'native-mvu-schema-edit-invalidation-v2'
  sessionId:string
  /** The writer's observation hash at persistence time. Historical Source
   * descriptors only deny authority; they never prove a snapshot or grant. */
  sourceSha256:string
  root:MvuStateRoot|MvuSchemaStoryRoot
  editFloorSeq:number
  targetSeq:number
  editSeq:number
  role:'user'|'assistant'
  messageId:string
  originalEventSha256:string
  editEventSha256:string
  textSha256:string
  recordSha256:string
}
export interface MvuEditFactsDeps {
  table:{get(key:string):unknown;entries():Iterable<[string,unknown]>;
    put(key:string,value:MvuEditInvalidationRecord):Promise<unknown>}
  readSession(sessionId:string):ReadBranchSession|undefined
  /** Actual maintained history feed and edit interpreter, owned by Core. */
  eventsOf(session:ReadBranchSession):readonly StoryEvent[]
  currentEdits(session:ReadBranchSession,events:readonly StoryEvent[]):readonly StoryEvent[]
  /** Immutable root facts and first eligible edit seq: opening Native end + 1,
   * or derived child's actual inherited cut. Never infer it from wall-clock
   * time, current head or a table write. Corrupt/unavailable facts are unknown. */
  readNumericalBasisFacts(sessionId:string):MvuEditBasisFacts
  /** True means the actual shared player variant still needs local projection.
   * Unknown observations fail closed. This callback must be synchronous. */
  readPendingVariantFacts?(sessionId:string):boolean|'unknown'
  withSourceLock<T>(sessionId:string,action:()=>Promise<T>):Promise<T>
}
export type MvuEditPersistence = {kind:'invalidated';record:MvuEditInvalidationRecord}
  | {kind:'unaffected'}|{kind:'unknown';code:string}
export const mvuEditInvalidationKey=(sid:string,eventSha256:string)=>`${sid}__mvu-edit-invalidation-${eventSha256}`
const prefix=(sid:string)=>`${sid}__mvu-edit-invalidation-`
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(v)
const seq=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0)
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
class EditRefusal extends Error {constructor(readonly code:string){super(code)}}
function fail(code:string):never {throw new EditRefusal(code)}
const codeOf=(e:unknown)=>e instanceof EditRefusal?e.code:'NUMERICAL_EDIT_UNKNOWN'
function exact(value:object,names:readonly string[]):void {
  if(!same(Object.keys(value).sort(),[...names].sort()))fail('NUMERICAL_EDIT_RECORD_INVALID')
}
/** Only reference descriptors are cloned/persisted, never edit or input bodies. */
function clone<T>(value:T):T {
  let nodes=0,bytes=0
  const seen=new Set<object>()
  function visit(v:unknown,depth:number):void {
    if(++nodes>4096||depth>16)fail('NUMERICAL_EDIT_RECORD_LIMIT')
    if(v===null||typeof v==='boolean')return
    if(typeof v==='string'){bytes+=Buffer.byteLength(v);if(bytes>262144)fail('NUMERICAL_EDIT_RECORD_LIMIT');return}
    if(typeof v==='number'){if(!seq(v))fail('NUMERICAL_EDIT_RECORD_INVALID');return}
    if(!v||typeof v!=='object'||seen.has(v)||Object.getOwnPropertySymbols(v).length)fail('NUMERICAL_EDIT_RECORD_INVALID')
    if(![Object.prototype,null].includes(Object.getPrototypeOf(v))||Array.isArray(v))fail('NUMERICAL_EDIT_RECORD_INVALID')
    seen.add(v)
    for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(v))) {
      if(!d.enumerable||!Object.hasOwn(d,'value')||['__proto__','constructor','prototype'].includes(key)) {
        fail('NUMERICAL_EDIT_RECORD_INVALID')
      }
      bytes+=Buffer.byteLength(key)
      if(bytes>262144)fail('NUMERICAL_EDIT_RECORD_LIMIT')
      visit(d.value,depth+1)
    }
    seen.delete(v)
  }
  visit(value,0)
  return structuredClone(value)
}
function basisValid(input:MvuEditBasisFacts):MvuEditBasisFacts {
  const basis=clone(input)
  if(basis.kind==='none'){exact(basis,['kind']);return basis}
  if(basis.kind==='unknown'){exact(basis,basis.code===undefined?['kind']:['kind','code']);return basis}
  if(basis.kind!=='verified'||!hash(basis.sourceSha256)||!seq(basis.editFloorSeq))fail('NUMERICAL_EDIT_BASIS_UNKNOWN')
  exact(basis,['kind','sourceSha256','root','editFloorSeq'])
  const root=basis.root
  if('openingEventId' in root) {
    try {validateMvuSchemaStoryRoot(root)}catch {fail('NUMERICAL_EDIT_BASIS_UNKNOWN')}
  }else if('encoding' in root&&root.encoding==='native-program-mvu-state-root-v1') {
    exact(root,['schemaVersion','encoding','programEventId','programEventSha256','programHeadSha256','planSha256'])
    if(root.schemaVersion!==1||![root.programEventId,root.programEventSha256,root.programHeadSha256,root.planSha256].every(hash)) {
      fail('NUMERICAL_EDIT_BASIS_UNKNOWN')
    }
  }else if('encoding' in root) {
    exact(root,['schemaVersion','encoding','derivedEventId','derivedEventSha256','derivedHeadSha256','basisSha256'])
    if(root.schemaVersion!==1||root.encoding!=='native-mvu-derived-state-root-v1'
      ||![root.derivedEventId,root.derivedEventSha256,root.derivedHeadSha256,root.basisSha256].every(hash)) {
      fail('NUMERICAL_EDIT_BASIS_UNKNOWN')
    }
  } else {
    exact(root,['initEventId','initEventSha256','initHeadSha256','planSha256'])
    if(!Object.values(root).every(hash))fail('NUMERICAL_EDIT_BASIS_UNKNOWN')
  }
  return basis
}

export function createRoleplayMvuEditFacts(deps:MvuEditFactsDeps) {
  const pending=new Map<string,number>()
  let generation=0
  function history(sid:string) {
    if(!id(sid))fail('NUMERICAL_EDIT_SESSION_INVALID')
    const session=deps.readSession(sid)
    if(!session||session.id!==sid)fail('NUMERICAL_EDIT_SESSION_UNKNOWN')
    const events=deps.eventsOf(session)
    if(events.length>100000||events.some((event,index)=>event.seq!==index))fail('NUMERICAL_EDIT_HISTORY_UNKNOWN')
    const current=deps.currentEdits(session,events),targets=new Set<number>()
    for(const edit of current) {
      if(!seq(edit.seq)||!same(events[edit.seq],edit)||targets.has(Number(edit.data?.targetSeq))) {
        fail('NUMERICAL_EDIT_HISTORY_UNKNOWN')
      }
      targets.add(Number(edit.data?.targetSeq))
    }
    return {events,current}
  }
  function editIdentity(edit:StoryEvent,events:readonly StoryEvent[]) {
    const data=edit.data
    if(edit.type!=='roleplay/message-edit'||!data||data.schemaVersion!==1||!seq(edit.seq)||edit.ignorable
      ||!seq(data.targetSeq)||data.targetSeq>=edit.seq||typeof data.text!=='string'||data.text.length>1000000
      ||!['assistant','user'].includes(String(data.role))||typeof data.messageId!=='string'
      ||!data.messageId.length||data.messageId.length>1024)fail('NUMERICAL_EDIT_IDENTITY_INVALID')
    exact(data,['schemaVersion','targetSeq','messageId','role','text'])
    const target=events[data.targetSeq],role=data.role as 'assistant'|'user'
    const originalMessageId=role==='assistant'?target?.data?.message?.id:target?.data?.id
    const originalRole=role==='assistant'?target?.data?.message?.role:target?.data?.role
    if(target?.type!==`${role}/message`||originalMessageId!==data.messageId||originalRole!==role) {
      fail('NUMERICAL_EDIT_IDENTITY_INVALID')
    }
    return {targetSeq:data.targetSeq,editSeq:edit.seq,role,messageId:data.messageId,
      originalEventSha256:recordSha256(target),editEventSha256:recordSha256(edit),textSha256:sha256(data.text)}
  }
  function expected(sid:string,edit:StoryEvent,events:readonly StoryEvent[],basis:Extract<MvuEditBasisFacts,{kind:'verified'}>) {
    if(edit.seq<basis.editFloorSeq)fail('NUMERICAL_EDIT_BEFORE_BASIS')
    const schema='openingEventId' in basis.root
    const descriptor={schemaVersion:schema?2 as const:1 as const,
      encoding:schema?'native-mvu-schema-edit-invalidation-v2' as const:'native-mvu-edit-invalidation-v1' as const,
      sessionId:sid,sourceSha256:basis.sourceSha256,root:clone(basis.root),editFloorSeq:basis.editFloorSeq,
      ...editIdentity(edit,events)}
    return {...descriptor,recordSha256:recordSha256(descriptor)}
  }
  function inventory(sid:string,events:readonly StoryEvent[],basis:Extract<MvuEditBasisFacts,{kind:'verified'}>) {
    const rows=new Map<string,MvuEditInvalidationRecord>()
    for(const [key,value] of deps.table.entries())if(key.startsWith(prefix(sid))) {
      if(rows.size>=4096||rows.has(key))fail('NUMERICAL_EDIT_RECORD_LIMIT')
      const row=clone(value) as MvuEditInvalidationRecord
      const actual=clone(deps.table.get(key))
      if(!same(row,actual)||!seq(row.editSeq))fail('NUMERICAL_EDIT_READ_UNKNOWN')
      if(!hash(row.sourceSha256))fail('NUMERICAL_EDIT_RECORD_INVALID')
      const edit=events[row.editSeq]
      // Source changes cannot rewrite an accepted denial. The actual edit,
      // current verified numerical root and floor still define its scope.
      const historicalBasis={...basis,sourceSha256:row.sourceSha256}
      if(!edit||!same(row,expected(sid,edit,events,historicalBasis))
        ||key!==mvuEditInvalidationKey(sid,row.editEventSha256))fail('NUMERICAL_EDIT_RECORD_INVALID')
      rows.set(key,row)
    }
    return rows
  }
  function variantPending(sid:string):boolean {
    const result=deps.readPendingVariantFacts?deps.readPendingVariantFacts(sid):false
    if(result==='unknown'||typeof result!=='boolean')fail('NUMERICAL_EDIT_VARIANT_UNKNOWN')
    return result
  }
  function begin(sid:string):void {
    if(!id(sid))fail('NUMERICAL_EDIT_SESSION_INVALID')
    // Even an uncertain basis denies synchronously. Only a subsequent exact
    // persist/unaffected result may retire this particular in-flight denial.
    pending.set(sid,++generation)
  }
  /** Fanout may pre-deny a target whose accepted text already equals the new
   * variant. Only actual ready, edit-free history plus completed variant sync
   * can retire that transient denial; no durable invalidation is ever cleared. */
  function confirmNoEdit(sid:string):boolean {
    const started=pending.get(sid)
    try {
      const basis=basisValid(deps.readNumericalBasisFacts(sid))
      if(basis.kind==='unknown')return false
      const observed=history(sid)
      if(basis.kind==='verified'&&basis.editFloorSeq>observed.events.length)return false
      const current=observed.current.filter(edit=>basis.kind==='none'||edit.seq>=basis.editFloorSeq)
      if(variantPending(sid)||current.length
        ||[...deps.table.entries()].some(([key])=>key.startsWith(prefix(sid)))
        ||pending.get(sid)!==started)return false
      pending.delete(sid)
      return true
    } catch {return false}
  }
  function readInvalidation(sid:string):MvuEditInvalidation {
    try {
      const basis=basisValid(deps.readNumericalBasisFacts(sid))
      if(basis.kind==='unknown')fail('NUMERICAL_EDIT_BASIS_UNKNOWN')
      if(basis.kind==='none') {
        if([...deps.table.entries()].some(([key])=>key.startsWith(prefix(sid))))fail('NUMERICAL_EDIT_BASIS_UNKNOWN')
        return {kind:'clear'}
      }
      if(variantPending(sid)||pending.has(sid))return {kind:'unknown',code:'NUMERICAL_EDIT_PENDING'}
      const {events,current}=history(sid)
      if(basis.editFloorSeq>events.length)fail('NUMERICAL_EDIT_BASIS_UNKNOWN')
      const rows=inventory(sid,events,basis)
      let fromSeq:number|undefined
      for(const edit of current.filter(event=>event.seq>=basis.editFloorSeq)) {
        const key=mvuEditInvalidationKey(sid,editIdentity(edit,events).editEventSha256),row=rows.get(key)
        const actual=deps.table.get(key)
        if(!row||actual===undefined||!same(clone(actual),row))fail('NUMERICAL_EDIT_EFFECTS_MISSING')
        fromSeq=Math.min(fromSeq??row.targetSeq,row.targetSeq)
      }
      return fromSeq===undefined?{kind:'clear'}:{kind:'invalidated',code:'NUMERICAL_EDIT_INVALIDATED',fromSeq}
    } catch(error){return {kind:'unknown',code:codeOf(error)}}
  }
  async function persistEdit(input:{sessionId:string;editSeq:number}):Promise<MvuEditPersistence> {
    const sid=input.sessionId,started=pending.get(sid)
    try {
      if(!id(sid))fail('NUMERICAL_EDIT_SESSION_INVALID')
      return await deps.withSourceLock(sid,async():Promise<MvuEditPersistence>=>{
        const basis=basisValid(deps.readNumericalBasisFacts(sid))
        if(basis.kind==='unknown')fail('NUMERICAL_EDIT_BASIS_UNKNOWN')
        const {events,current}=history(sid)
        if(basis.kind==='verified'&&basis.editFloorSeq>events.length)fail('NUMERICAL_EDIT_BASIS_UNKNOWN')
        if(!seq(input.editSeq))fail('NUMERICAL_EDIT_IDENTITY_INVALID')
        const edit=current.find(event=>event.seq===input.editSeq)
        if(!edit)fail('NUMERICAL_EDIT_NOT_CURRENT')
        const identity=editIdentity(edit,events)
        if(basis.kind==='none') {
          if([...deps.table.entries()].some(([key])=>key.startsWith(prefix(sid))))fail('NUMERICAL_EDIT_BASIS_UNKNOWN')
          if(pending.get(sid)===started)pending.delete(sid)
          return {kind:'unaffected'}
        }
        const rows=inventory(sid,events,basis)
        if(edit.seq<basis.editFloorSeq) {
          if(pending.get(sid)===started)pending.delete(sid)
          return {kind:'unaffected'}
        }
        const key=mvuEditInvalidationKey(sid,identity.editEventSha256),existing=rows.get(key)
        // Reuse the exact validated historical observation. A new edit alone
        // records the current Source; neither path rewrites an older receipt.
        const row=existing??expected(sid,edit,events,basis)
        const before=deps.table.get(key)
        if(before!==undefined&&!same(clone(before),row))fail('NUMERICAL_EDIT_WRITE_CONFLICT')
        // A lost response is accepted only through exact immediate readback.
        // No retry occurs inside this invocation and no numerical write occurs.
        if(before===undefined&&!existing)try {await deps.table.put(key,clone(row))} catch { /* readback determines denial facts */ }
        if(!same(clone(deps.table.get(key)),row))fail('NUMERICAL_EDIT_WRITE_UNKNOWN')
        const afterBasis=basisValid(deps.readNumericalBasisFacts(sid)),after=history(sid)
        if(!same(afterBasis,basis)||!after.current.some(event=>event.seq===edit.seq&&same(event,edit))) {
          fail('NUMERICAL_EDIT_OBSERVATION_CHANGED')
        }
        if(pending.get(sid)===started)pending.delete(sid)
        return {kind:'invalidated',record:clone(row)}
      })
    } catch(error){return {kind:'unknown',code:codeOf(error)}}
  }
  return {begin,confirmNoEdit,persistEdit,readInvalidation}
}
