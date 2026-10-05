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
export type RoleplaySourceRead='legacy-author'|'tavern-author'|'input-source'|'program-origin'|'card-export'
  |`program-opening:${number}:${boolean}`
export interface RoleplayInputStateSession {readonly id:string}
export interface RoleplayInputStateRead<T> {
  readonly data:T
  current():boolean
  assertCurrent():void
}
export interface RoleplayInputStateScope {
  readonly session:RoleplayInputStateSession
  readonly signal:AbortSignal
  /** Producer-declared outputs of this actual capture; these are DATA roles,
   * not permission to create or resume a Native transaction. */
  readonly outputRows?:readonly {readonly table:string;readonly key:string}[]
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
interface ProgramFactFootprint {
  rows:Set<string>
  namespaces:Set<string>
  prefixes:Set<string>
}
interface ProgramFactRead extends ProgramFactFootprint {
  kind:'absence'|'opening-preparation'
  frame:Frame
  session:RoleplayInputStateSession
  agent:object|undefined
  scopeIdentity:string|undefined
  outputRows:ReadonlySet<string>
  active:boolean
  data?:unknown
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
  programFacts:Set<ProgramFactRead>
  namespaces:Set<string>
  prefixes:Set<string>
  sessions:Set<string>
  children:Set<Frame>
  parents:Set<Frame>
  identity?:string
  scopeIdentity?:string
  outputRows:ReadonlySet<string>
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
    // Reconciliation may first publish this display index while starting a
    // child input. Actual text edits use Native message-edit invalidation.
    ||suffix.startsWith('player-projection-')
    ||suffix.startsWith('fork-anchor-')||suffix.startsWith('fork-pending-')
    ||suffix.startsWith('phasea-')||suffix.startsWith('phaseb-')||suffix.startsWith('phasec-')
}
function membershipChange(frame:Frame,table:string,key:string):boolean {
  // Exact consumers still watch their row. Namespace membership alone must
  // not treat a producer's predeclared output as a new consumed input.
  if(frame.outputRows.has(address(table,key)))return false
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
  let capturingInputSession:RoleplayInputStateSession|undefined
  let capturingInputOutputRows:ReadonlySet<string>|undefined
  let readingActive=false
  let readingPendingVariant:PendingVariantRead|undefined
  let readingProgramFact:ProgramFactRead|undefined
  let programFactFootprint:ProgramFactFootprint|undefined
  let standaloneProgramAbsenceAudit=false
  let standaloneProgramAbsenceReentrant=false
  const slots=new Map<string,Frame>()
  const frames=new Set<Frame>()
  const handles=new WeakMap<object,Frame>()
  const rowReaders=new Map<string,Set<Frame>>()
  const activeRowReaders=new Map<string,Set<Frame>>()
  const namespaceReaders=new Map<string,Set<Frame>>()
  const prefixReaders=new Map<string,Set<Frame>>()
  const pendingVariantRows=new Map<string,Set<PendingVariantRead>>()
  const pendingVariantGroups=new Set<PendingVariantRead>()
  const programFactRows=new Map<string,Set<ProgramFactRead>>()
  const programFactNamespaces=new Map<string,Set<ProgramFactRead>>()
  const programFactPrefixes=new Map<string,Set<ProgramFactRead>>()
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
  function removeProgramFactSubscriptions(read:ProgramFactRead,footprint:ProgramFactFootprint):void {
    for(const [index,keys] of [[programFactRows,footprint.rows],
      [programFactNamespaces,footprint.namespaces],[programFactPrefixes,footprint.prefixes]] as const) {
      for(const key of keys) {
        const readers=index.get(key)
        readers?.delete(read)
        if(!readers?.size)index.delete(key)
      }
    }
  }
  function forgetProgramFact(read:ProgramFactRead):void {
    read.active=false
    removeProgramFactSubscriptions(read,read)
    read.rows.clear();read.namespaces.clear();read.prefixes.clear()
  }
  function programFactDependency(kind:keyof ProgramFactFootprint,key:string):void {
    const read=readingProgramFact,footprint=programFactFootprint
    if(!read||!footprint)return
    footprint[kind].add(key)
    const index=kind==='rows'?programFactRows:kind==='namespaces'?programFactNamespaces:programFactPrefixes
    // Subscribe during the initial audit so publications cannot disappear
    // between reading an address and completing the capture.
    subscribe(index,key,read)
  }
  function programFactError(kind:ProgramFactRead['kind'],reason:string):Error {
    return Error(`INPUT_STATE_PROGRAM_${kind==='absence'?'ABSENCE':'OPENING'}_${reason}`)
  }
  function synchronousProgramFact<T>(kind:ProgramFactRead['kind'],value:T):T {
    if(value!==null&&(typeof value==='object'||typeof value==='function')&&'then' in value) {
      throw programFactError(kind,'ASYNC_AUDIT')
    }
    return value
  }
  function auditProgramFact<T>(read:ProgramFactRead,audit:()=>T):T {
    if(readingProgramFact||standaloneProgramAbsenceAudit) {
      if(readingProgramFact)markDirty(readingProgramFact.frame)
      markDirty(read.frame);throw programFactError(read.kind,'REENTRANT_AUDIT')
    }
    if(!nominalCurrent(read.frame)||!programFactOwnerCurrent(read)) {
      markDirty(read.frame);throw Error('INPUT_STATE_CAPTURE_CHANGED')
    }
    const outer=capturing,active=readingActive,variant=readingPendingVariant
    capturing=undefined;readingActive=false;readingPendingVariant=undefined
    readingProgramFact=read;programFactFootprint=read
    try {
      const data=synchronousProgramFact(read.kind,audit())
      if(!nominalCurrent(read.frame)||!programFactOwnerCurrent(read)) {
        throw programFactError(read.kind,'AUDIT_CHANGED')
      }
      read.data=data
      return data
    }catch(error) {
      forgetProgramFact(read);markDirty(read.frame)
      throw error
    }finally {
      readingProgramFact=undefined;programFactFootprint=undefined
      capturing=outer;readingActive=active;readingPendingVariant=variant
    }
  }
  /** DATA is audited once. Notifications revoke its captured inputs; exact
   * outputs declared by the producer do not trigger another owner audit. */
  function readProgramAbsenceNamespaceFacts<T>(actualSession:RoleplayInputStateSession,
    initialAudit:()=>T):T {
    return readProgramFacts('absence',actualSession,initialAudit)
  }
  /** Only the actual synchronous input capture may consume this DATA fact.
   * Its initial audit belongs to the Program opening supplier; this read
   * does not recreate Native admission or ready. */
  function readProgramOpeningPreparationFacts<T>(actualSession:RoleplayInputStateSession,
    initialAudit:()=>T):T {
    return readProgramFacts('opening-preparation',actualSession,initialAudit)
  }
  function readProgramFacts<T>(kind:ProgramFactRead['kind'],actualSession:RoleplayInputStateSession,
    initialAudit:()=>T):T {
    if(disposed)throw Error('INPUT_STATE_OWNER_DISPOSED')
    if(readingProgramFact||standaloneProgramAbsenceAudit) {
      if(readingProgramFact)markDirty(readingProgramFact.frame)
      if(standaloneProgramAbsenceAudit)standaloneProgramAbsenceReentrant=true
      throw programFactError(kind,'REENTRANT_AUDIT')
    }
    const frame=capturing
    if(kind==='opening-preparation'&&(!frame||capturingInputSession!==actualSession
      ||frame.session!==actualSession)) {
      if(frame)markDirty(frame)
      throw programFactError(kind,'CAPTURE_REQUIRED')
    }
    if(deps.session(actualSession.id)!==actualSession) {
      if(capturing)markDirty(capturing)
      throw programFactError(kind,'SESSION_CHANGED')
    }
    if(!frame) {
      standaloneProgramAbsenceAudit=true;standaloneProgramAbsenceReentrant=false
      try {
        const data=synchronousProgramFact(kind,initialAudit())
        if(standaloneProgramAbsenceReentrant)throw programFactError(kind,'REENTRANT_AUDIT')
        return data
      }finally {standaloneProgramAbsenceAudit=false;standaloneProgramAbsenceReentrant=false}
    }
    if(kind==='absence') {
      // One complete namespace audit belongs to this actual Frame/Session.
      // New callback closures consume its DATA and original subscriptions;
      // they cannot reinterpret a revoked capture or enroll another footprint.
      const previous=[...frame.programFacts].find(read=>read.kind==='absence'&&read.session===actualSession)
      if(previous) {
        if(!nominalCurrent(frame)||!programFactOwnerCurrent(previous)) {
          markDirty(frame);throw Error('INPUT_STATE_CAPTURE_CHANGED')
        }
        return previous.data as T
      }
    }
    const read:ProgramFactRead={kind,frame,session:actualSession,agent:deps.agent(actualSession),
      scopeIdentity:deps.scopeIdentity?.(actualSession),outputRows:frame.outputRows,active:true,
      rows:new Set(),namespaces:new Set(),prefixes:new Set()}
    frame.programFacts.add(read);dependSession(frame,actualSession.id)
    return auditProgramFact(read,initialAudit)
  }
  function forget(frame:Frame):void {
    frames.delete(frame)
    for(const read of frame.pendingVariants)forgetPendingVariant(read)
    frame.pendingVariants.clear()
    for(const read of frame.programFacts)forgetProgramFact(read)
    frame.programFacts.clear()
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
  function nominalCurrent(frame:Frame):boolean {
    return !disposed&&!frame.dirty&&deps.session(frame.session.id)===frame.session
      &&deps.agent(frame.session)===frame.agent&&deps.scopeIdentity?.(frame.session)===frame.scopeIdentity
  }
  function programFactOwnerCurrent(read:ProgramFactRead):boolean {
    return read.active&&deps.session(read.session.id)===read.session
      &&deps.agent(read.session)===read.agent&&deps.scopeIdentity?.(read.session)===read.scopeIdentity
  }
  function current(frame:Frame,visiting=new Set<Frame>()):boolean {
    // Returning true during an audit would counterfeit a current owner. Even
    // if the callback swallows the refusal, the original frame stays dirty.
    if(readingProgramFact) {markDirty(readingProgramFact.frame);return false}
    if(standaloneProgramAbsenceAudit) {
      standaloneProgramAbsenceReentrant=true;markDirty(frame);return false
    }
    if(!nominalCurrent(frame)) {markDirty(frame);return false}
    if(visiting.has(frame)) {markDirty(frame);return false}
    visiting.add(frame)
    try {
      for(const child of frame.children)if(!current(child,visiting)) {markDirty(frame);return false}
      for(const read of frame.programFacts) {
        if(!programFactOwnerCurrent(read)) {markDirty(frame);return false}
      }
      return nominalCurrent(frame)
    }finally {visiting.delete(frame)}
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
  function read<T>(slot:Slot,id:string,key:string,compute:()=>T,cache:boolean,identity?:string,
    sourceOutputs?:RoleplayInputStateScope['outputRows'])
    :RoleplayInputStateRead<T> {
    if(disposed)throw Error('INPUT_STATE_OWNER_DISPOSED')
    const session=deps.session(id)
    if(!session)throw Error('INPUT_STATE_SESSION_INACTIVE')
    const slotKey=slot+'\0'+id+'\0'+key,previous=cache?slots.get(slotKey):undefined,
      declaredOutputs=sourceOutputs&&new Set(sourceOutputs.map(row=>address(row.table,row.key)))
    if(previous&&previous.identity===identity&&(!declaredOutputs
      ||declaredOutputs.size===previous.outputRows.size&&[...declaredOutputs].every(row=>previous.outputRows.has(row)))
      &&current(previous)) {
      metrics.reusedReads++;connect(previous)
      return handle(previous,previous.data as T)
    }
    if(previous){markDirty(previous);forget(previous);slots.delete(slotKey)}
    const frame:Frame={slot,session,agent:deps.agent(session),dirty:false,rows:new Set(),activeRows:new Set(),
      sourceMetadataRows:new Map(),pendingVariants:new Set(),programFacts:new Set(),namespaces:new Set(),
      prefixes:new Set(),sessions:new Set(),children:new Set(),parents:new Set(),identity,
      outputRows:declaredOutputs??(capturingInputSession===session?capturingInputOutputRows??new Set():new Set()),
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
        // Source captures compare installed reader identities. Reuse these
        // facade functions, while reading the active capture at call time.
        if(property==='get') {
          if(methods.has(property))return methods.get(property)
          const trackedGet=(key:string)=>{
            metrics.recordReads++
            const value=target.get(key)
            if(readingProgramFact)programFactDependency('rows',address(name,key))
            else if(readingPendingVariant&&name==='branch'
              &&(key.startsWith('fork-group-')||key.includes('__fork-anchor-'))) {
              pendingVariantRow(readingPendingVariant,name,key)
            }else if(capturing) {
              if(readingActive)dependActiveRow(capturing,name,key)
              else dependRow(capturing,name,key,value)
            }
            return value
          }
          methods.set(property,trackedGet)
          return trackedGet
        }
        if(property==='entries'&&target.entries) {
          if(methods.has(property))return methods.get(property)
          const trackedEntries=function*(exactPrefix?:string) {
            const frame=capturing,activeProjection=readingActive,
              variant=name==='branch'?readingPendingVariant:undefined,audit=readingProgramFact
            if(audit) {
              // Full subject membership has no explanatory-row exemption.
              // Additional prefixes and explicit foreign get addresses stay
              // subscribed, including missing rows later read with get.
              if(name==='branch'||name==='status') {
                programFactDependency('namespaces',namespace(name,audit.session.id))
              }
              if(exactPrefix!==undefined)programFactDependency('prefixes',address(name,exactPrefix))
            }else if(variant) {
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
              if(audit) {
                if(sessionOf(key)===audit.session.id||exactPrefix!==undefined&&key.startsWith(exactPrefix)) {
                  programFactDependency('rows',address(name,key))
                }
              }else if(variant&&key.startsWith('fork-group-'))pendingVariantRow(variant,name,key)
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
          methods.set(property,trackedEntries)
          return trackedEntries
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
    const audits=new Set(programFactRows.get(ref)),subject=sessionOf(change.key)
    if(subject)for(const read of programFactNamespaces.get(namespace(change.table,subject))??[])audits.add(read)
    for(const [prefix,readers] of programFactPrefixes)if(ref.startsWith(prefix)) {
      for(const read of readers)audits.add(read)
    }
    // Audits are synchronous/read-only. Conservatively reject a publication
    // during one, even before it has discovered that new dependency address.
    if(readingProgramFact)audits.add(readingProgramFact)
    for(const read of audits)if(read.active) {
      // An audit is read-only even at its own declared output. After capture,
      // only producer-declared exact addresses can be output publications;
      // unknown namespace members and prior material are captured inputs.
      if(read===readingProgramFact||!read.outputRows.has(ref))markDirty(read.frame)
    }
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
        if(!nominalCurrent(read.frame))continue
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
        if(!nominalCurrent(frame))continue
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
    const outputRows=new Set((scope.outputRows??[]).map(row=>address(row.table,row.key)))
    const readout=read('input',scope.session.id,'actual-input',()=>{
      // Dynamic scope follows the real compute call, including same-session
      // Source children. Cached Source data cannot enroll a fresh opening fact.
      const outer=capturingInputSession,outerOutputs=capturingInputOutputRows
      capturingInputSession=scope.session;capturingInputOutputRows=outputRows
      capturing!.outputRows=outputRows
      try{return compute()}
      finally{capturingInputSession=outer;capturingInputOutputRows=outerOutputs}
    },false)
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
    captureInput,captureClosing,readPendingVariantFacts,readProgramAbsenceNamespaceFacts,
    readProgramOpeningPreparationFacts,
    captureSchema:<T>(id:string,compute:()=>T)=>read('schema',id,'verified-history',compute,true),
    captureSource:<T>(id:string,kind:RoleplaySourceRead,compute:()=>T,
      outputs?:RoleplayInputStateScope['outputRows'])=>read('source',id,kind,compute,true,undefined,outputs),
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
