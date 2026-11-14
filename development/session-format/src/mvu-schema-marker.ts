/** Required log-only ordering for author-schema execution. Domain owns the
 * descriptors behind these hashes; Native markers never grant publication. */
import type {Session, SessionEvent} from 'dsh-nexttavern-native-session'
import type {} from './projection.js'

export const MVU_SCHEMA_DISPATCH_EVENT = 'roleplay/mvu-schema-dispatched' as const
export const MVU_SCHEMA_COMPLETION_EVENT = 'roleplay/mvu-schema-completed' as const
export const MVU_SCHEMA_REVISION_EVENT = 'roleplay/mvu-schema-revised' as const
/** Reserved execution vocabulary cannot opt into the upstream unknown-event
 * skip contract; dropping such a row could erase a pending execution anchor. */
export function assertMvuSchemaEventVocabulary(type: unknown): void {
  if (typeof type === 'string' && type.startsWith('roleplay/mvu-schema-')
    && type !== MVU_SCHEMA_DISPATCH_EVENT && type !== MVU_SCHEMA_COMPLETION_EVENT
    && type !== MVU_SCHEMA_REVISION_EVENT) {
    throw Error('MVU_SCHEMA_EVENT_UNKNOWN')
  }
}
export interface MvuSchemaDispatchMarker {
  schemaVersion: 1
  encoding: 'native-mvu-schema-dispatch-marker-v1'
  sessionId: string
  realmEpoch: string
  batchId: string
  programSha256: string
  sourceSha256: string
  previousTailSha256: string
  dispatchRecordSha256: string
  loadDescriptorSha256: string | null
  observedNativeSeq: number
}
export interface MvuSchemaCompletionMarker {
  schemaVersion: 1
  encoding: 'native-mvu-schema-completion-marker-v1'
  sessionId: string
  realmEpoch: string
  batchId: string
  dispatchSeq: number
  dispatchRecordSha256: string
  completionRecordSha256: string
  completedTailSha256: string
  observedNativeSeq: number
}
/** A revision selects an existing effective completion. Its descriptor is
 * owned by Core; this Native fact neither executes authors nor publishes values. */
export interface MvuSchemaRevisionMarker {
  schemaVersion: 1
  encoding: 'native-mvu-schema-revision-marker-v1'
  sessionId: string
  realmEpoch: string
  descriptor: {key: string; sha256: string}
  editSeq: number
  completionSeq: number
  observedNativeSeq: number
}
export type MvuSchemaMarker = MvuSchemaDispatchMarker | MvuSchemaCompletionMarker | MvuSchemaRevisionMarker
export type MvuSchemaMarkerEvent = SessionEvent<typeof MVU_SCHEMA_DISPATCH_EVENT
  | typeof MVU_SCHEMA_COMPLETION_EVENT | typeof MVU_SCHEMA_REVISION_EVENT>
export interface MvuSchemaEffectivePair {
  dispatch: SessionEvent<typeof MVU_SCHEMA_DISPATCH_EVENT>
  completion: SessionEvent<typeof MVU_SCHEMA_COMPLETION_EVENT>
}
export interface MvuSchemaEffectiveRevision {
  event: SessionEvent<typeof MVU_SCHEMA_REVISION_EVENT>
  superseded: readonly MvuSchemaEffectivePair[]
}
/** Supplied only by the actual Core history owner through a closed reader.
 * The public shape, source flag and owner field do not authenticate a DTO. */
export interface MvuSchemaHistoryCut {
  readonly owner:object
  readonly source:'native'|'loaded'
  readonly length:number
  at(seq:number):SessionEvent|undefined
  prefixSha256(cut:number):string|undefined
  range(start?:number,end?:number):Iterable<SessionEvent>
  materialize():readonly SessionEvent[]
}
export interface MvuSchemaHistorySequence<T> {
  readonly length:number
  at(index:number):T|undefined
  range(start?:number,end?:number):IterableIterator<T>
}
export interface MvuSchemaEffectiveEpochCut {
  readonly programSha256:string
  readonly sourceSha256:string
  readonly pending?:{readonly seq:number;readonly data:MvuSchemaDispatchMarker}
  readonly completedTail?:string
  readonly pairs:MvuSchemaHistorySequence<MvuSchemaEffectivePair>
  readonly revisions:MvuSchemaHistorySequence<MvuSchemaEffectiveRevision>
}
export interface MvuSchemaEffectiveHistoryCut {
  readonly owner:object
  readonly source:'native'|'loaded'
  readonly length:number
  readonly nativePrefixSha256:string
  readonly openTurn:number|undefined
  readonly epochs:{get(realmEpoch:string):MvuSchemaEffectiveEpochCut|undefined}
}
export interface MvuSchemaHistoryReaderDependencies {
  session(id:string):Session|undefined
  readOwnedCut(session:Session):MvuSchemaHistoryCut
}
// Use the same declaring module as SessionEvent, message edits and the inbox.
declare module 'dsh-nexttavern-native-session/types' {
  interface SessionEventMap {
    'roleplay/mvu-schema-dispatched': MvuSchemaDispatchMarker
    'roleplay/mvu-schema-completed': MvuSchemaCompletionMarker
    'roleplay/mvu-schema-revised': MvuSchemaRevisionMarker
  }
}
const commonKeys = ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'batchId',
  'dispatchRecordSha256', 'observedNativeSeq']
const dispatchKeys = [...commonKeys, 'programSha256', 'sourceSha256', 'previousTailSha256', 'loadDescriptorSha256']
const completionKeys = [...commonKeys, 'dispatchSeq', 'completionRecordSha256', 'completedTailSha256']
const revisionKeys = ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'descriptor',
  'editSeq', 'completionSeq', 'observedNativeSeq']
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const identity = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
const integer = (value: unknown, minimum = 0): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= minimum && !Object.is(value, -0)
function exactData(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.getOwnPropertySymbols(value).length) throw Error('MVU_SCHEMA_MARKER_INVALID')
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Object.keys(descriptors).length !== keys.length || keys.some(key =>
    !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key]!, 'value'))) {
    throw Error('MVU_SCHEMA_MARKER_INVALID')
  }
}
export function assertMvuSchemaDispatchMarker(value: unknown): asserts value is MvuSchemaDispatchMarker {
  exactData(value, dispatchKeys)
  if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-dispatch-marker-v1'
    || !identity(value.sessionId) || !identity(value.batchId) || !integer(value.observedNativeSeq, -1)
    || ![value.realmEpoch, value.programSha256, value.sourceSha256, value.previousTailSha256,
      value.dispatchRecordSha256].every(hash)
    || value.loadDescriptorSha256 !== null && !hash(value.loadDescriptorSha256)) throw Error('MVU_SCHEMA_MARKER_INVALID')
}
export function assertMvuSchemaCompletionMarker(value: unknown): asserts value is MvuSchemaCompletionMarker {
  exactData(value, completionKeys)
  if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-completion-marker-v1'
    || !identity(value.sessionId) || !identity(value.batchId) || !integer(value.observedNativeSeq, -1)
    || !integer(value.dispatchSeq) || ![value.realmEpoch, value.dispatchRecordSha256,
      value.completionRecordSha256, value.completedTailSha256].every(hash)) throw Error('MVU_SCHEMA_MARKER_INVALID')
}
export function assertMvuSchemaRevisionMarker(value: unknown): asserts value is MvuSchemaRevisionMarker {
  exactData(value, revisionKeys)
  exactData(value.descriptor, ['key', 'sha256'])
  if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-revision-marker-v1'
    || !identity(value.sessionId) || !hash(value.realmEpoch) || !integer(value.editSeq)
    || !integer(value.completionSeq) || !integer(value.observedNativeSeq)
    || typeof value.descriptor.key !== 'string' || value.descriptor.key.length > 256
    || !value.descriptor.key.startsWith(`${value.sessionId}__`) || !hash(value.descriptor.sha256)) {
    throw Error('MVU_SCHEMA_MARKER_INVALID')
  }
}
export function assertMvuSchemaMarker(value: unknown): asserts value is MvuSchemaMarker {
  // Inspect the encoding descriptor without invoking an untrusted getter.
  const encoding = value && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'encoding') : undefined
  if (encoding && 'value' in encoding && encoding.value === 'native-mvu-schema-dispatch-marker-v1') {
    assertMvuSchemaDispatchMarker(value)
  } else if (encoding && 'value' in encoding && encoding.value === 'native-mvu-schema-revision-marker-v1') {
    assertMvuSchemaRevisionMarker(value)
  } else assertMvuSchemaCompletionMarker(value)
}
export function assertMvuSchemaMarkerEvent(event: SessionEvent): asserts event is MvuSchemaMarkerEvent {
  if (!event || typeof event !== 'object' || Array.isArray(event)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(event))
    || Object.getOwnPropertySymbols(event).length
    || Object.keys(Object.getOwnPropertyDescriptors(event)).some(key => !['type', 'seq', 'time', 'data'].includes(key))) {
    throw Error('MVU_SCHEMA_MARKER_ENVELOPE_INVALID')
  }
  const descriptors = Object.getOwnPropertyDescriptors(event)
  if (['type', 'seq', 'time', 'data'].some(key => !descriptors[key]?.enumerable
    || !Object.hasOwn(descriptors[key]!, 'value'))) throw Error('MVU_SCHEMA_MARKER_ENVELOPE_INVALID')
  if (event.type !== MVU_SCHEMA_DISPATCH_EVENT && event.type !== MVU_SCHEMA_COMPLETION_EVENT
    && event.type !== MVU_SCHEMA_REVISION_EVENT
    || !integer(event.seq) || !integer(event.time)) throw Error('MVU_SCHEMA_MARKER_ENVELOPE_INVALID')
  if (event.type === MVU_SCHEMA_DISPATCH_EVENT) assertMvuSchemaDispatchMarker(event.data)
  else if (event.type === MVU_SCHEMA_REVISION_EVENT) assertMvuSchemaRevisionMarker(event.data)
  else assertMvuSchemaCompletionMarker(event.data)
  if (event.seq !== event.data.observedNativeSeq + 1) throw Error('MVU_SCHEMA_MARKER_ORDER_INVALID')
}
export interface MvuSchemaEpochHistory {
  programSha256: string
  sourceSha256: string
  batches: Set<string>
  pending?: {seq: number; data: MvuSchemaDispatchMarker}
  completedTail?: string
  pairs: MvuSchemaEffectivePair[]
  revisions: MvuSchemaEffectiveRevision[]
}
interface EpochIndex {
  completions:Map<number,number>
  descriptors:Set<string>
}
function accept(data: MvuSchemaMarker, seq: number, epochs: Map<string, MvuSchemaEpochHistory>,
  eventAt:(seq:number)=>SessionEvent|undefined,commit=true,indexes?:Map<string,EpochIndex>,undo?:(()=>void)[]): void {
  const epoch = epochs.get(data.realmEpoch)
  const indexed=indexes?.get(data.realmEpoch)
  if (data.encoding === 'native-mvu-schema-revision-marker-v1') {
    const edit = eventAt(data.editSeq)
    if (!epoch || epoch.pending || edit?.type !== 'roleplay/message-edit' || edit.seq >= seq
      || (edit.data.role !== 'assistant' && edit.data.role !== 'user')) throw Error('MVU_SCHEMA_REVISION_EDIT_UNPROVEN')
    if (indexed?indexed.descriptors.has(data.descriptor.key)
      :epoch.revisions.some(revision => revision.event.data.descriptor.key === data.descriptor.key)) {
      throw Error('MVU_SCHEMA_REVISION_REUSED')
    }
    const index = indexed?indexed.completions.get(data.completionSeq)??-1
      :epoch.pairs.findIndex(pair => pair.completion.seq === data.completionSeq)
    if (index < 0) throw Error('MVU_SCHEMA_REVISION_CUT_UNPROVEN')
    if(!commit)return
    // Normal appends share the pair array with bounded old views. Rewind is
    // the actual branch change: detach that branch before later append writes.
    const superseded=indexes?epoch.pairs.slice(index+1):epoch.pairs.splice(index+1)
    if(undo) {
      const pairs=epoch.pairs,revisionLength=epoch.revisions.length,tail=epoch.completedTail
      undo.push(()=>{
        epoch.pairs=pairs;epoch.revisions.length=revisionLength
        if(tail===undefined)delete epoch.completedTail;else epoch.completedTail=tail
        indexed?.descriptors.delete(data.descriptor.key)
        if(indexed)for(const [offset,pair]of superseded.entries())indexed.completions.set(pair.completion.seq,index+1+offset)
      })
    }
    if(indexes)epoch.pairs=epoch.pairs.slice(0,index+1)
    if(indexed) {
      indexed.descriptors.add(data.descriptor.key)
      for(const pair of superseded)indexed.completions.delete(pair.completion.seq)
    }
    // Used batch identities survive the rewind; a revision never permits a
    // previously dispatched guest operation to execute under the same identity.
    epoch.completedTail = epoch.pairs[index]!.completion.data.completedTailSha256
    epoch.revisions.push({event: eventAt(seq) as SessionEvent<typeof MVU_SCHEMA_REVISION_EVENT>, superseded})
  } else if (data.encoding === 'native-mvu-schema-dispatch-marker-v1') {
    if (epoch && epoch.programSha256 !== data.programSha256) throw Error('MVU_SCHEMA_PROGRAM_MISMATCH')
    if (epoch && epoch.sourceSha256 !== data.sourceSha256) throw Error('MVU_SCHEMA_SOURCE_MISMATCH')
    if (epoch?.pending) throw Error('MVU_SCHEMA_DISPATCH_PENDING')
    if (epoch?.batches.has(data.batchId)) throw Error('MVU_SCHEMA_BATCH_REUSED')
    if (epoch ? data.loadDescriptorSha256 !== null : data.loadDescriptorSha256 === null) {
      throw Error('MVU_SCHEMA_LOAD_BOUNDARY_INVALID')
    }
    if (epoch && data.previousTailSha256 !== epoch.completedTail) throw Error('MVU_SCHEMA_TAIL_MISMATCH')
    if(!commit)return
    const next = epoch ?? {programSha256: data.programSha256, sourceSha256: data.sourceSha256,
      batches: new Set<string>(), pairs: [], revisions: []}
    if(undo)undo.push(()=>{
      if(!epoch){epochs.delete(data.realmEpoch);indexes?.delete(data.realmEpoch)}
      else {epoch.batches.delete(data.batchId);delete epoch.pending}
    })
    next.batches.add(data.batchId)
    next.pending = {seq, data}
    epochs.set(data.realmEpoch, next)
    if(indexes&&!indexed)indexes.set(data.realmEpoch,{completions:new Map(),descriptors:new Set()})
  } else {
    const pending = epoch?.pending
    if (!epoch || !pending || pending.seq !== data.dispatchSeq || pending.data.sessionId !== data.sessionId
      || pending.data.batchId !== data.batchId || pending.data.dispatchRecordSha256 !== data.dispatchRecordSha256) {
      throw Error('MVU_SCHEMA_COMPLETION_UNPROVEN')
    }
    if(!commit)return
    if(undo) {
      const pairLength=epoch.pairs.length,tail=epoch.completedTail
      undo.push(()=>{
        epoch.pairs.length=pairLength;epoch.pending=pending
        if(tail===undefined)delete epoch.completedTail;else epoch.completedTail=tail
        indexed?.completions.delete(seq)
      })
    }
    epoch.completedTail = data.completedTailSha256
    if(indexed)indexed.completions.set(seq,epoch.pairs.length)
    epoch.pairs.push({dispatch: eventAt(pending.seq) as SessionEvent<typeof MVU_SCHEMA_DISPATCH_EVENT>,
      completion: eventAt(seq) as SessionEvent<typeof MVU_SCHEMA_COMPLETION_EVENT>})
    delete epoch.pending
  }
}
interface HistoryState {
  epochs:Map<string,MvuSchemaEpochHistory>
  openTurn:number|undefined
}
function consume(event:SessionEvent|undefined,index:number,state:HistoryState,
  eventAt:(seq:number)=>SessionEvent|undefined,indexes?:Map<string,EpochIndex>,undo?:(()=>void)[]):void {
  if(event?.seq!==index)throw Error('MVU_SCHEMA_PREFIX_INVALID')
  assertMvuSchemaEventVocabulary(event.type)
  if(event.type==='turn/start') {
    if(state.openTurn!==undefined||!integer(event.data.turn))throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN')
    state.openTurn=event.data.turn
  }else if(event.type==='turn/end') {
    if(state.openTurn===undefined||state.openTurn!==event.data.turn)throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN')
    state.openTurn=undefined
  }else if(event.type===MVU_SCHEMA_DISPATCH_EVENT||event.type===MVU_SCHEMA_COMPLETION_EVENT
    ||event.type===MVU_SCHEMA_REVISION_EVENT) {
    assertMvuSchemaMarkerEvent(event)
    if(state.openTurn!==undefined)throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN')
    accept(event.data,event.seq,state.epochs,eventAt,true,indexes,undo)
  }
}
function history(events:readonly SessionEvent[]):HistoryState {
  const state:HistoryState={epochs:new Map(),openTurn:undefined}
  for(const [index,event] of events.entries())consume(event,index,state,seq=>events[seq])
  return state
}
/** A pending dispatch is valid durable history. It cannot imply completion or
 * guest rollback; the Core journal/replay owner must handle that failure anchor. */
export function assertMvuSchemaHistory(events: readonly SessionEvent[]): void {history(events)}
/** Durable DATA validation over a single serialized writer's accepted prefix.
 * A staged suffix is private until commit; rollback touches only that suffix's
 * mutations, including a revision's actual rewind. No Session authority is granted. */
export function createMvuSchemaHistoryValidator(initial:readonly SessionEvent[]=[]) {
  const events:SessionEvent[]=[],state:HistoryState={epochs:new Map(),openTurn:undefined},indexes=new Map<string,EpochIndex>()
  let staged=false
  const stage=(tail:Iterable<SessionEvent>)=>{
    if(staged)throw Error('MVU_SCHEMA_VALIDATION_STAGED')
    staged=true
    const length=events.length,openTurn=state.openTurn,undo:(()=>void)[]=[]
    let active=true
    const rollback=()=>{
      if(!active)return
      for(let index=undo.length-1;index>=0;index--)undo[index]!()
      events.length=length;state.openTurn=openTurn;staged=false;active=false
    }
    try {
      for(const event of tail) {
        const index=events.length
        events.push(event)
        consume(event,index,state,seq=>events[seq],indexes,undo)
      }
    }catch(error){rollback();throw error}
    return {commit(){if(active){staged=false;active=false}},rollback}
  }
  stage(initial).commit()
  return {get length(){return events.length},stage}
}
/** This fold is the single owner of effective marker selection. Journal reads
 * consume its pairs and explicit revision facts, retaining the real Native log. */
export function readEffectiveMvuSchemaHistory(events: readonly SessionEvent[]) {
  return history(events)
}
function appendBoundary(session: Session, data: MvuSchemaMarker) {
  if (data.sessionId !== session.id) throw Error('MVU_SCHEMA_OWNER_MISMATCH')
  const events = session.snapshotEvents()
  if ((events.at(-1)?.seq ?? -1) !== data.observedNativeSeq) throw Error('MVU_SCHEMA_STALE_NATIVE')
  const state = history(events)
  if (state.openTurn !== undefined) throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN')
  // Append admission has no new event object yet. Only the pair/revision DATA
  // is needed for the check; the following actual append supplies that object.
  accept(data, data.observedNativeSeq + 1, state.epochs,seq=>events[seq],false)
}
export function appendMvuSchemaDispatchMarker(session: Session, data: MvuSchemaDispatchMarker,_cut?:MvuSchemaHistoryCut) {
  assertMvuSchemaDispatchMarker(data)
  appendBoundary(session, data)
  const event = session.append(MVU_SCHEMA_DISPATCH_EVENT, data)
  assertMvuSchemaMarkerEvent(event)
  return event
}
export function appendMvuSchemaCompletionMarker(session: Session, data: MvuSchemaCompletionMarker,_cut?:MvuSchemaHistoryCut) {
  assertMvuSchemaCompletionMarker(data)
  appendBoundary(session, data)
  const event = session.append(MVU_SCHEMA_COMPLETION_EVENT, data)
  assertMvuSchemaMarkerEvent(event)
  return event
}
export function appendMvuSchemaRevisionMarker(session: Session, data: MvuSchemaRevisionMarker,_cut?:MvuSchemaHistoryCut) {
  assertMvuSchemaRevisionMarker(data)
  appendBoundary(session, data)
  const event = session.append(MVU_SCHEMA_REVISION_EVENT, data)
  assertMvuSchemaMarkerEvent(event)
  return event
}
function sequence<T>(values:readonly T[]):MvuSchemaHistorySequence<T> {
  const length=values.length
  return Object.freeze({length,at(index:number) {
    const position=index<0?length+index:index
    return Number.isSafeInteger(position)&&position>=0&&position<length?values[position]:undefined
  },*range(start=0,end=length) {
    if(!integer(start)||!integer(end)||end<start||end>length) {
      throw new RangeError('MVU schema history range is outside this cut')
    }
    for(let index=start;index<end;index++)yield values[index]!
  }})
}
function epochView(epoch:MvuSchemaEpochHistory):MvuSchemaEffectiveEpochCut {
  return Object.freeze({programSha256:epoch.programSha256,sourceSha256:epoch.sourceSha256,
    ...(epoch.pending?{pending:epoch.pending}:{}),...(epoch.completedTail?{completedTail:epoch.completedTail}:{}),
    pairs:sequence(epoch.pairs),revisions:sequence(epoch.revisions)})
}
interface EpochVersion {seq:number;view:MvuSchemaEffectiveEpochCut}
interface HistoryCursor extends HistoryState {
  owner:object
  length:number
  indexes:Map<string,EpochIndex>
  versions:Map<string,EpochVersion[]>
  error?:unknown
}
function recordEpoch(cursor:HistoryCursor,event:MvuSchemaMarkerEvent):void {
  const epoch=cursor.epochs.get(event.data.realmEpoch)!
  if(event.type===MVU_SCHEMA_DISPATCH_EVENT)Object.freeze(epoch.pending)
  else if(event.type===MVU_SCHEMA_COMPLETION_EVENT)Object.freeze(epoch.pairs.at(-1))
  else {
    const revision=epoch.revisions.at(-1)!
    Object.freeze(revision.superseded);Object.freeze(revision)
  }
  let versions=cursor.versions.get(event.data.realmEpoch)
  if(!versions)cursor.versions.set(event.data.realmEpoch,versions=[])
  versions.push({seq:event.seq,view:epochView(epoch)})
}
function versionAt(versions:readonly EpochVersion[]|undefined,length:number):MvuSchemaEffectiveEpochCut|undefined {
  if(!versions)return
  const latest=versions.at(-1)
  if(latest&&latest.seq<length)return latest.view
  let first=0,last=versions.length
  while(first<last) {
    const middle=(first+last)>>>1
    if(versions[middle]!.seq<length)first=middle+1
    else last=middle
  }
  return versions[first-1]?.view
}
function prefixIdentity(cut:MvuSchemaHistoryCut,length:number):string {
  const digest=cut.prefixSha256(length)
  if(digest===undefined)throw Error('MVU_SCHEMA_PREFIX_INVALID')
  return digest
}
function fullCut(cut:MvuSchemaHistoryCut,length:number):MvuSchemaEffectiveHistoryCut {
  const state:HistoryState={epochs:new Map(),openTurn:undefined}
  for(let seq=0;seq<length;seq++)consume(cut.at(seq),seq,state,index=>cut.at(index))
  for(const epoch of state.epochs.values()) {
    if(epoch.pending)Object.freeze(epoch.pending)
    for(const pair of epoch.pairs)Object.freeze(pair)
    for(const revision of epoch.revisions){Object.freeze(revision.superseded);Object.freeze(revision)}
  }
  return Object.freeze({owner:cut.owner,source:cut.source,length,nativePrefixSha256:prefixIdentity(cut,length),
    openTurn:state.openTurn,epochs:Object.freeze({get(realm:string) {
      const epoch=state.epochs.get(realm)
      return epoch&&epochView(epoch)
    }})})
}
/** One plugin instance connects the actual Core Session and history owners.
 * Public raw arrays keep their complete parser; no DTO flag enrolls a cursor. */
export function createMvuSchemaHistoryReader(deps:MvuSchemaHistoryReaderDependencies):MvuSchemaHistoryReader {
  const cursors=new WeakMap<Session,HistoryCursor>()
  function read(session:Session,cut:MvuSchemaHistoryCut,length:number):MvuSchemaEffectiveHistoryCut {
    if(!integer(length)||length>cut.length)throw Error('MVU_SCHEMA_PREFIX_INVALID')
    if(cut.source!=='native')return fullCut(cut,length)
    let cursor=cursors.get(session)
    if(cursor&&cursor.owner!==cut.owner)throw Error('MVU_SCHEMA_PREFIX_OWNER_CHANGED')
    if(cursor&&length<cursor.length)return fullCut(cut,length)
    if(!cursor) {
      cursor={owner:cut.owner,length:0,epochs:new Map(),openTurn:undefined,indexes:new Map(),versions:new Map()}
      cursors.set(session,cursor)
    }
    if(cursor.error&&length>cursor.length)throw cursor.error
    try {
      for(const event of cut.range(cursor.length,length)) {
        consume(event,cursor.length,cursor,seq=>cut.at(seq),cursor.indexes)
        if(event.type===MVU_SCHEMA_DISPATCH_EVENT||event.type===MVU_SCHEMA_COMPLETION_EVENT
          ||event.type===MVU_SCHEMA_REVISION_EVENT)recordEpoch(cursor,event as MvuSchemaMarkerEvent)
        cursor.length++
      }
    }catch(error){cursor.error=error;throw error}
    const versions=cursor.versions
    return Object.freeze({owner:cut.owner,source:cut.source,length,nativePrefixSha256:prefixIdentity(cut,length),
      openTurn:cursor.openTurn,epochs:Object.freeze({get:(realm:string)=>versionAt(versions.get(realm),length)})})
  }
  function actual(sessionId:string):{session:Session;cut:MvuSchemaHistoryCut} {
    const session=deps.session(sessionId)
    if(!session)throw Error('MVU_SCHEMA_OWNER_UNAVAILABLE')
    return {session,cut:deps.readOwnedCut(session)}
  }
  function append(session:Session,data:MvuSchemaMarker,eventType:MvuSchemaMarkerEvent['type']):MvuSchemaMarkerEvent {
    if(data.sessionId!==session.id||deps.session(session.id)!==session)throw Error('MVU_SCHEMA_OWNER_MISMATCH')
    const cut=deps.readOwnedCut(session)
    if(cut.source!=='native') {
      appendBoundary(session,data)
      const event=session.append(eventType,data as never) as MvuSchemaMarkerEvent
      assertMvuSchemaMarkerEvent(event)
      return event
    }
    if(cut.length-1!==data.observedNativeSeq)throw Error('MVU_SCHEMA_STALE_NATIVE')
    const state=read(session,cut,cut.length)
    if(state.openTurn!==undefined)throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN')
    // Admission only checks; the cursor must not contain an operation that
    // Native failed to append. Loaded histories retain the complete path.
    const cursor=cursors.get(session)!
    accept(data,cut.length,cursor.epochs,seq=>cut.at(seq),false,cursor.indexes)
    const event=session.append(eventType,data as never) as MvuSchemaMarkerEvent
    assertMvuSchemaMarkerEvent(event)
    // This new read comes from the owner after the actual append, including
    // any synchronous Native tail publication. A thrown append never enters it.
    const appended=deps.readOwnedCut(session)
    read(session,appended,appended.length)
    return event
  }
  return Object.freeze({...mvuSchemaMarkers,
    readEffectiveCut(sessionId:string,nativeCut:number) {
      const {session,cut}=actual(sessionId)
      return read(session,cut,nativeCut)
    },
    appendDispatch(session:Session,data:MvuSchemaDispatchMarker,_cut?:MvuSchemaHistoryCut) {
      assertMvuSchemaDispatchMarker(data)
      return append(session,data,MVU_SCHEMA_DISPATCH_EVENT) as SessionEvent<typeof MVU_SCHEMA_DISPATCH_EVENT>
    },
    appendCompletion(session:Session,data:MvuSchemaCompletionMarker,_cut?:MvuSchemaHistoryCut) {
      assertMvuSchemaCompletionMarker(data)
      return append(session,data,MVU_SCHEMA_COMPLETION_EVENT) as SessionEvent<typeof MVU_SCHEMA_COMPLETION_EVENT>
    },
    appendRevision(session:Session,data:MvuSchemaRevisionMarker,_cut?:MvuSchemaHistoryCut) {
      assertMvuSchemaRevisionMarker(data)
      return append(session,data,MVU_SCHEMA_REVISION_EVENT) as SessionEvent<typeof MVU_SCHEMA_REVISION_EVENT>
    },
  })
}
export interface MvuSchemaMarkers {
  readonly dispatchEventType:typeof MVU_SCHEMA_DISPATCH_EVENT
  readonly completionEventType:typeof MVU_SCHEMA_COMPLETION_EVENT
  readonly revisionEventType:typeof MVU_SCHEMA_REVISION_EVENT
  readonly appendDispatch:typeof appendMvuSchemaDispatchMarker
  readonly appendCompletion:typeof appendMvuSchemaCompletionMarker
  readonly appendRevision:typeof appendMvuSchemaRevisionMarker
  readonly assert:typeof assertMvuSchemaMarker
  readonly assertDispatch:typeof assertMvuSchemaDispatchMarker
  readonly assertCompletion:typeof assertMvuSchemaCompletionMarker
  readonly assertEvent:typeof assertMvuSchemaMarkerEvent
  readonly assertHistory:typeof assertMvuSchemaHistory
  readonly readEffectiveHistory:typeof readEffectiveMvuSchemaHistory
  readonly createHistoryReader?:(deps:MvuSchemaHistoryReaderDependencies)=>MvuSchemaHistoryReader
  readonly readEffectiveCut?:(sessionId:string,nativeCut:number)=>MvuSchemaEffectiveHistoryCut
}
export interface MvuSchemaHistoryReader extends MvuSchemaMarkers {
  readonly readEffectiveCut:(sessionId:string,nativeCut:number)=>MvuSchemaEffectiveHistoryCut
}
export const mvuSchemaMarkers:MvuSchemaMarkers = Object.freeze({
  dispatchEventType: MVU_SCHEMA_DISPATCH_EVENT,
  completionEventType: MVU_SCHEMA_COMPLETION_EVENT,
  revisionEventType: MVU_SCHEMA_REVISION_EVENT,
  appendDispatch: appendMvuSchemaDispatchMarker,
  appendCompletion: appendMvuSchemaCompletionMarker,
  appendRevision: appendMvuSchemaRevisionMarker,
  assert: assertMvuSchemaMarker,
  assertDispatch: assertMvuSchemaDispatchMarker,
  assertCompletion: assertMvuSchemaCompletionMarker,
  assertEvent: assertMvuSchemaMarkerEvent,
  assertHistory: assertMvuSchemaHistory,
  readEffectiveHistory: readEffectiveMvuSchemaHistory,
  createHistoryReader:createMvuSchemaHistoryReader,
})
