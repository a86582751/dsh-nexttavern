/** Owns the read baseline and the captured data of an actual Core input.
 * Domain records are immutable until a durable put/update/delete publishes a
 * change. Hot checks use that change feed; only capture/recovery reads history.
 * These process-local reads never recreate Native admission after a restart. */
import type {DomainChanged} from '@deepseek-ai/dsh-storage-domain'
import {recordSha256} from './roleplay-data.js'

/** Source currency excludes only the three counters published by the current
 * turn's ordinary completion. Frozen audit rows retain their complete bytes. */
export function roleplaySourceMetadataValue(value:Readonly<Record<string,unknown>>):Record<string,unknown> {
  const source={...value}
  delete source.lastTurn;delete source.lastSeq;delete source.surfaceTokens
  return source
}
function sourceMetadataSha256(value:unknown):string {
  return recordSha256(value&&typeof value==='object'&&!Array.isArray(value)
    ?roleplaySourceMetadataValue(value as Record<string,unknown>):value)
}

type Slot='schema'|'source'|'observation'|'control'|'input'|'closing'
export type RoleplaySourceRead='legacy-author'|'tavern-author'|'input-source'
export interface RoleplayInputStateSession {readonly id:string}
export interface RoleplayInputStateRead<T> {
  readonly data:T
  current():boolean
  assertCurrent():void
}
export interface RoleplayInputStateScope {
  readonly session:RoleplayInputStateSession
  readonly signal:AbortSignal
  /** Original input/step/stop identity, without rebuilding Source/history. */
  assertOwnerFactsCurrent():void
}
interface ReadTable {
  get(key:string):unknown
  entries?(exactPrefix?:string):Iterable<[string,unknown]>
}
type PendingVariantFact=boolean|'unknown'
interface PendingVariantRead {
  frame:Frame
  reader:()=>PendingVariantFact
  value:PendingVariantFact
  rows:Set<string>
}
interface Frame {
  slot:Slot
  session:RoleplayInputStateSession
  agent:object|undefined
  dirty:boolean
  rows:Set<string>
  activeRows:Set<string>
  sourceMetadataRows:Map<string,string>
  pendingVariants:Set<PendingVariantRead>
  namespaces:Set<string>
  prefixes:Set<string>
  sessions:Set<string>
  children:Set<Frame>
  parents:Set<Frame>
  identity?:string
  scopeIdentity?:string
  data?:unknown
}
const address=(table:string,key:string)=>table+'\0'+key
const namespace=(table:string,sid:string)=>table+'\0'+sid
function forkSubjects(value:unknown):string[] {
  const members=(value as {members?:readonly {sessionId?:unknown}[]}|undefined)?.members
  return Array.isArray(members)?members.flatMap(member=>typeof member.sessionId==='string'?[member.sessionId]:[]):[]
}
const sessionOf=(key:string)=>{
  const split=key.indexOf('__')
  return split>0?key.slice(0,split):undefined
}

/** Current input/control outputs and lifecycle metadata are not additions to
 * consumed numerical history. A reader that consumes their content uses an
 * exact get; that row stays watched and later replacement invalidates it. */
function explanatorySuffix(suffix:string):boolean {
  return suffix==='meta'||suffix.startsWith('native-input-v2-work-')
    ||suffix==='native-input-v2-current'
    ||suffix.startsWith('native-input-v2-blocked-')
    ||suffix.startsWith('task-input-snapshot-')
    ||suffix.startsWith('task-snapshot-')
    ||suffix==='task-preparation'||suffix==='context-window'
    ||suffix.startsWith('task-steering-')||suffix.startsWith('maintenance-timing-')
    ||suffix.startsWith('tavern-prompt-v1-')
    ||suffix.startsWith('program-opening-material-')
    ||suffix.startsWith('fork-anchor-')||suffix.startsWith('fork-pending-')
    ||suffix.startsWith('phasea-')||suffix.startsWith('phaseb-')||suffix.startsWith('phasec-')
}
function membershipChange(frame:Frame,table:string,key:string):boolean {
  const sid=sessionOf(key)
  if(!sid||!frame.namespaces.has(namespace(table,sid)))return false
  const suffix=key.slice(sid.length+2)
  if(table==='branch'&&explanatorySuffix(suffix))return false
  // Staged schema work belongs to the actual closing transaction. Its new
  // journal entries do not change the published state consumed by this input.
  // Replacing an already consumed entry still invalidates its exact row read.
  if(table==='status'&&/^(mvu-schema-(epoch|dispatch|completion|unavailable)-)/.test(suffix))return false
  if(table==='status'&&(suffix==='panel'||/^turn-[0-9]+-[0-9]+$/.test(suffix)))return false
  return true
}

export function createRoleplayInputStateOwner(deps:{
  readonly domainName:string
  session(id:string):RoleplayInputStateSession|undefined
  agent(session:RoleplayInputStateSession):object|undefined
  active(session:RoleplayInputStateSession):boolean
  /** Cheap current worldline selection/cwd stamp, with no history projection. */
  scopeIdentity?(session:RoleplayInputStateSession):string
}) {
  let disposed=false
  let capturing:Frame|undefined
  let readingActive=false
  let readingPendingVariant:PendingVariantRead|undefined
  const slots=new Map<string,Frame>()
  const frames=new Set<Frame>()
  const handles=new WeakMap<object,Frame>()
  const rowReaders=new Map<string,Set<Frame>>()
  const activeRowReaders=new Map<string,Set<Frame>>()
  const namespaceReaders=new Map<string,Set<Frame>>()
  const prefixReaders=new Map<string,Set<Frame>>()
  const pendingVariantRows=new Map<string,Set<PendingVariantRead>>()
  const pendingVariantGroups=new Set<PendingVariantRead>()
  const sessionReaders=new Map<string,Set<Frame>>()
  const metrics={schemaCaptures:0,sourceCaptures:0,observationCaptures:0,controlCaptures:0,inputCaptures:0,closingCaptures:0,
    reusedReads:0,checkpoints:0,recordReads:0,inventoryRows:0,invalidations:0}

  function subscribe<T>(index:Map<string,Set<T>>,key:string,frame:T):void {
    let readers=index.get(key)
    if(!readers)index.set(key,readers=new Set())
    readers.add(frame)
  }
  function dependSession(frame:Frame,sid:string):void {
    if(frame.sessions.has(sid))return
    frame.sessions.add(sid);subscribe(sessionReaders,sid,frame)
  }
  function dependRow(frame:Frame,table:string,key:string,value?:unknown):void {
    const ref=address(table,key)
    if(!frame.rows.has(ref)){frame.rows.add(ref);subscribe(rowReaders,ref,frame)}
    const sid=sessionOf(key)
    // Input/history/Source/closing consumers read this row for origin and
    // inheritance facts, including the schema reader's direct lineage checks.
    // A ledger that consumes the mutable counters retains full row currency.
    if(frame.slot!=='control'&&table==='branch'&&sid&&key===`${sid}__meta`) {
      frame.sourceMetadataRows.set(ref,sourceMetadataSha256(value))
    }
    if(sid)dependSession(frame,sid)
  }
  function dependActiveRow(frame:Frame,table:string,key:string):void {
    const ref=address(table,key)
    if(!frame.activeRows.has(ref)) {
      frame.activeRows.add(ref);subscribe(activeRowReaders,ref,frame)
    }
    const sid=sessionOf(key)
    if(sid) {
      dependSession(frame,sid)
      // Missing ancestor pointers also consult that ancestor's fork groups.
      // A later group can introduce a tombstone without changing this key.
      const ref=namespace('active-'+table,sid)
      if(!frame.namespaces.has(ref)) {
        frame.namespaces.add(ref);subscribe(namespaceReaders,ref,frame)
      }
    }
  }
  function markDirty(frame:Frame):void {
    if(frame.dirty)return
    frame.dirty=true;metrics.invalidations++
    for(const parent of frame.parents)markDirty(parent)
  }
  function forgetPendingVariant(read:PendingVariantRead):void {
    for(const row of read.rows) {
      const readers=pendingVariantRows.get(row)
      readers?.delete(read)
      if(!readers?.size)pendingVariantRows.delete(row)
    }
    read.rows.clear();pendingVariantGroups.delete(read)
  }
  function pendingVariantRow(read:PendingVariantRead,table:string,key:string):void {
    const ref=address(table,key)
    read.rows.add(ref);subscribe(pendingVariantRows,ref,read)
    const sid=sessionOf(key)
    if(sid)dependSession(read.frame,sid)
  }
  function evaluatePendingVariant(read:PendingVariantRead):PendingVariantFact {
    const outer=readingPendingVariant
    readingPendingVariant=read
    try {return read.reader()}
    finally {readingPendingVariant=outer}
  }
  function readPendingVariantFacts(id:string,reader:()=>PendingVariantFact):PendingVariantFact {
    const frame=capturing
    if(!frame)return reader()
    // The actual edit gate consumes a three-state fact, not all navigation
    // timestamps/receipt IDs. Keep its real parser and all fallback lookups.
    const read:PendingVariantRead={frame,reader,value:'unknown',rows:new Set()}
    frame.pendingVariants.add(read);dependSession(frame,id)
    read.value=evaluatePendingVariant(read)
    return read.value
  }
  function forget(frame:Frame):void {
    frames.delete(frame)
    for(const read of frame.pendingVariants)forgetPendingVariant(read)
    frame.pendingVariants.clear()
    for(const [index,keys] of [[rowReaders,frame.rows],[activeRowReaders,frame.activeRows],
      [namespaceReaders,frame.namespaces],[prefixReaders,frame.prefixes],
      [sessionReaders,frame.sessions]] as const) {
      for(const key of keys) {
        const readers=index.get(key)
        readers?.delete(frame)
        if(!readers?.size)index.delete(key)
      }
    }
    for(const child of frame.children)child.parents.delete(frame)
    for(const parent of frame.parents)parent.children.delete(frame)
  }
  function current(frame:Frame):boolean {
    return !disposed&&!frame.dirty&&deps.session(frame.session.id)===frame.session
      &&deps.agent(frame.session)===frame.agent&&deps.scopeIdentity?.(frame.session)===frame.scopeIdentity
  }
  function check(frame:Frame):void {
    metrics.checkpoints++
    if(!current(frame))throw Error('INPUT_STATE_CAPTURE_CHANGED')
  }
  function connect(frame:Frame):void {
    if(capturing&&capturing!==frame) {
      capturing.children.add(frame);frame.parents.add(capturing)
    }
  }
  function handle<T>(frame:Frame,data:T):RoleplayInputStateRead<T> {
    const result={data,current:()=>{
      const valid=current(frame)
      if(valid)connect(frame)
      return valid
    },assertCurrent:()=>{check(frame);connect(frame)}}
    handles.set(result,frame)
    return result
  }
  function read<T>(slot:Slot,id:string,key:string,compute:()=>T,cache:boolean,identity?:string)
    :RoleplayInputStateRead<T> {
    if(disposed)throw Error('INPUT_STATE_OWNER_DISPOSED')
    const session=deps.session(id)
    if(!session)throw Error('INPUT_STATE_SESSION_INACTIVE')
    const slotKey=slot+'\0'+id+'\0'+key,previous=cache?slots.get(slotKey):undefined
    if(previous&&previous.identity===identity&&current(previous)) {
      metrics.reusedReads++;connect(previous)
      return handle(previous,previous.data as T)
    }
    if(previous){markDirty(previous);forget(previous);slots.delete(slotKey)}
    const frame:Frame={slot,session,agent:deps.agent(session),dirty:false,rows:new Set(),activeRows:new Set(),
      sourceMetadataRows:new Map(),pendingVariants:new Set(),namespaces:new Set(),
      prefixes:new Set(),sessions:new Set(),children:new Set(),parents:new Set(),identity,
      scopeIdentity:deps.scopeIdentity?.(session)}
    frames.add(frame);dependSession(frame,id)
    const outer=capturing
    capturing=frame
    try {
      // This is the sole projection of active/deleted branch facts for a read
      // baseline. Its Domain dependencies are collected with the data below.
      readingActive=true
      try {if(!deps.active(session))throw Error('INPUT_STATE_SESSION_INACTIVE')}
      finally {readingActive=false}
      const data=compute()
      if(data&&typeof data==='object'&&'then' in data)throw Error('INPUT_STATE_ASYNC_CAPTURE')
      frame.data=data;check(frame)
      if(cache)slots.set(slotKey,frame)
      metrics[slot==='schema'?'schemaCaptures':slot==='source'?'sourceCaptures':
        slot==='observation'?'observationCaptures':slot==='control'?'controlCaptures':
        slot==='closing'?'closingCaptures':'inputCaptures']++
      return handle(frame,data)
    }catch(error){markDirty(frame);forget(frame);throw error}
    finally {capturing=outer;if(current(frame))connect(frame)}
  }

  /** Core keeps these read views for all consumers. Only reads during a
   * capture register dependencies; put/update/delete remain the Domain's own
   * ordered methods, and its change event is the single invalidation source. */
  function table<T extends ReadTable>(name:string,actual:T):T&Pick<ReadTable,'entries'> {
    const methods=new Map<PropertyKey,unknown>()
    return new Proxy(actual,{
      get(target,property) {
        if(property==='get')return (key:string)=>{
          metrics.recordReads++
          const value=target.get(key)
          if(readingPendingVariant&&name==='branch'
            &&(key.startsWith('fork-group-')||key.includes('__fork-anchor-'))) {
            pendingVariantRow(readingPendingVariant,name,key)
          }else if(capturing) {
            if(readingActive)dependActiveRow(capturing,name,key)
            else dependRow(capturing,name,key,value)
          }
          return value
        }
        if(property==='entries'&&target.entries)return function*(exactPrefix?:string) {
          const frame=capturing,activeProjection=readingActive,
            variant= name==='branch'?readingPendingVariant:undefined
          if(variant) {
            // Pointer recovery and ancestor lookup can discover a new group
            // before an anchor exists. Watch the complete navigation namespace.
            pendingVariantGroups.add(variant)
          }else if(frame) {
            // The active-branch projection enumerates the Domain only to find
            // fork tombstones. Its iterator must not make staged numerical
            // work a dependency of frozen author data or a maintenance lease.
            if(exactPrefix!==undefined) {
              // Identity-addressed journals declare their complete namespace,
              // including an absent head and newly appended pending intents.
              const ref=address(name,exactPrefix)
              frame.prefixes.add(ref);subscribe(prefixReaders,ref,frame)
            }else {
              const ref=namespace(activeProjection?'active-'+name:name,frame.session.id)
              frame.namespaces.add(ref);subscribe(namespaceReaders,ref,frame)
            }
          }
          for(const [key,value] of target.entries!()) {
            metrics.inventoryRows++
            // A table-wide iterator may also include other worldlines. The
            // actual parser still sees them; only this subject's membership
            // and exact records it consumes belong to the capture's lifetime.
            // Global fork groups are navigation, outside numerical/author
            // namespaces. Consumers of a group's data use its exact get.
            const suffix=frame?key.slice(frame.session.id.length+2):''
            if(variant&&key.startsWith('fork-group-'))pendingVariantRow(variant,name,key)
            else if(!variant&&frame&&exactPrefix!==undefined&&key.startsWith(exactPrefix))dependRow(frame,name,key,value)
            else if(!variant&&frame&&exactPrefix===undefined&&!activeProjection&&sessionOf(key)===frame.session.id
              &&!(name==='branch'&&explanatorySuffix(suffix))
              &&!(name==='status'&&(suffix==='panel'||/^turn-[0-9]+-[0-9]+$/.test(suffix)))) {
              dependRow(frame,name,key)
            }
            if(frame&&activeProjection&&name==='branch'&&key.startsWith('fork-group-')
              &&forkSubjects(value).includes(frame.session.id)) {
              dependActiveRow(frame,name,key)
            }
            yield [key,value] as [string,unknown]
          }
        }
        const value=Reflect.get(target,property,target)
        if(typeof value!=='function')return value
        if(!methods.has(property))methods.set(property,value.bind(target))
        return methods.get(property)
      },
    }) as T&Pick<ReadTable,'entries'>
  }
  function domainChanged(change:DomainChanged):void {
    if(disposed||change.domain!==deps.domainName)return
    const ref=address(change.table,change.key)
    for(const [prefix,readers] of prefixReaders)if(ref.startsWith(prefix)) {
      for(const frame of readers)markDirty(frame)
    }
    let sourceMetadata:string|undefined
    for(const frame of rowReaders.get(ref)??[]) {
      const expected=frame.sourceMetadataRows.get(ref)
      if(expected!==undefined) {
        sourceMetadata??=sourceMetadataSha256(change.operation==='put'?change.value:undefined)
        if(sourceMetadata===expected)continue
      }
      markDirty(frame)
    }
    const sid=sessionOf(change.key)
    if(sid)for(const frame of namespaceReaders.get(namespace(change.table,sid))??[]) {
      if(membershipChange(frame,change.table,change.key))markDirty(frame)
    }
    const variantReads=new Set(pendingVariantRows.get(ref))
    if(change.table==='branch'&&change.key.startsWith('fork-group-')) {
      for(const read of pendingVariantGroups)variantReads.add(read)
    }
    const outer=capturing
    capturing=undefined
    try {
      for(const read of variantReads) {
        if(!current(read.frame))continue
        // Refresh the footprint even for false -> false: a new pointer may
        // move the next real edit to a different group. Never revive a dirty read.
        forgetPendingVariant(read)
        try {if(evaluatePendingVariant(read)!==read.value)markDirty(read.frame)}
        catch {markDirty(read.frame)}
      }
    }finally {capturing=outer}
    const activeReaders=new Set(activeRowReaders.get(address(change.table,change.key)))
    if(!sid&&change.table==='branch'&&change.key.startsWith('fork-group-')&&change.operation==='put') {
      for(const subject of forkSubjects(change.value)) {
        for(const frame of namespaceReaders.get(namespace('active-branch',subject))??[])activeReaders.add(frame)
      }
    }
    // Completing a pending fork publishes navigation IDs and timestamps, while
    // the consumed branch remains active. Re-evaluate the actual tombstone
    // predicate once per affected Session only on its durable navigation write;
    // checkpoints still use the captured result without projecting history.
    // Exact group/pointer reads outside this predicate retain full row currency.
    const active=new Map<RoleplayInputStateSession,boolean>()
    capturing=undefined
    try {
      for(const frame of activeReaders) {
        if(!current(frame))continue
        if(!active.has(frame.session)) {
          try {active.set(frame.session,deps.active(frame.session))}
          catch {active.set(frame.session,false)}
        }
        if(!active.get(frame.session))markDirty(frame)
      }
    }finally {capturing=outer}
  }
  function invalidateSession(id:string):void {
    // Control/Native changes revoke state and input captures. Frozen author
    // data has its own exact Domain dependencies and survives a plot edit.
    for(const frame of sessionReaders.get(id)??[])if(frame.slot!=='source')markDirty(frame)
  }
  function nativeChanged(session:RoleplayInputStateSession,event:{readonly type:string}):void {
    if(event.type==='roleplay/message-edit')invalidateSession(session.id)
    if(event.type==='compaction/end')for(const frame of sessionReaders.get(session.id)??[]) {
      if(frame.slot==='input')markDirty(frame)
    }
  }
  function releaseSession(id:string):void {
    invalidateSession(id)
    for(const [key,frame] of slots)if(frame.session.id===id){markDirty(frame);forget(frame);slots.delete(key)}
    for(const frame of [...frames])if(frame.session.id===id){markDirty(frame);forget(frame)}
  }
  function configurationChanged():void {
    for(const frame of frames)markDirty(frame)
  }
  function schemaPublished(id:string):void {
    // Historical verification can make a formerly unavailable in-memory view
    // readable without a Domain write. Revoke that negative observation once;
    // warm reads of the already published view do not repeat this transition.
    for(const frame of sessionReaders.get(id)??[]) {
      if(frame.session.id===id&&frame.slot==='observation')markDirty(frame)
    }
  }
  function captureInput<T>(scope:RoleplayInputStateScope,compute:()=>T):RoleplayInputStateRead<T>&{release():void} {
    scope.signal.throwIfAborted();scope.assertOwnerFactsCurrent()
    const readout=read('input',scope.session.id,'actual-input',compute,false)
    const own=handles.get(readout)
    const assertCurrent=()=>{
      scope.signal.throwIfAborted();scope.assertOwnerFactsCurrent();readout.assertCurrent()
    }
    return {data:readout.data,current:()=>{
      try{assertCurrent();return true}catch{return false}
    },assertCurrent,release(){if(own){markDirty(own);forget(own)}}}
  }
  function captureClosing<T>(id:string,compute:()=>T):RoleplayInputStateRead<T>&{release():void} {
    // This fresh basis includes the just-completed Native body. It expires
    // before the transaction writes its own rows; it never grants permission
    // or shares the cached published-state slot with an unfinished commit.
    const readout=read('closing',id,'completion-basis',compute,false),own=handles.get(readout)
    return {...readout,release(){if(own){markDirty(own);forget(own)}}}
  }
  return {
    table,domainChanged,nativeChanged,configurationChanged,schemaPublished,invalidateSession,releaseSession,
    captureInput,captureClosing,readPendingVariantFacts,
    captureSchema:<T>(id:string,compute:()=>T)=>read('schema',id,'verified-history',compute,true),
    captureSource:<T>(id:string,kind:RoleplaySourceRead,compute:()=>T)=>read('source',id,kind,compute,true),
    captureOriginal:<T>(id:string,identity:string,compute:()=>T)=>read('source',id,'schema-original',compute,true,identity),
    captureSourceFrame:<T>(id:string,identity:string,compute:()=>T)=>read('source',id,'schema-frame',compute,true,identity),
    captureObservation:<T>(id:string,compute:()=>T)=>read('observation',id,'input-observation',compute,true),
    capturePlayerLedger:<T>(id:string,compute:()=>T)=>read('control',id,'schema-player-ledger',compute,true),
    currentSession:(id:string)=>[...(sessionReaders.get(id)??[])].some(frame=>frame.session.id===id&&current(frame)),
    diagnostics:()=>({...metrics}),
    dispose(){disposed=true;for(const frame of [...frames]){markDirty(frame);forget(frame)}slots.clear()},
  }
}
export type RoleplayInputStateOwner=ReturnType<typeof createRoleplayInputStateOwner>
