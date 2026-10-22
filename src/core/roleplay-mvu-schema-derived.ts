/** Actual fork reservation/commit owner for a schema numerical baseline.
 * Cold reads verify immutable facts and Native ancestry; they never complete a
 * partial reservation or recreate the parent's input/maintenance permissions. */
import {recordSha256} from './roleplay-data.js'
import {createRoleplayMvuLineage} from './roleplay-mvu-lineage.js'
import {createRoleplayMvuFrozenLineage} from './roleplay-mvu-frozen-lineage.js'
import type {MvuFrozenLineageDeps,MvuDerivedSourceProofUnion} from './roleplay-mvu-frozen-lineage.js'
import type {TavernSourceFrozenRefV1,TavernSourceInheritanceRefV1} from './roleplay-tavern-source-inheritance-types.js'
import type {MvuSchemaPrefixInputClosureV1} from './roleplay-mvu-schema-frozen-prefix-input.js'
import {validateMvuSchemaDerivedPrepared,validateMvuSchemaDerivedBasis,createMvuSchemaDerivedBasis,mvuSchemaDerivedGenesis,
  mvuSchemaDerivedPreparedKey,mvuSchemaDerivedBasisKey,mvuSchemaDerivedEventKey,mvuSchemaDerivedHeadKey,
  mvuSchemaPrefixClosureKey,sealMvuSchemaInheritanceFact}
  from './roleplay-mvu-schema-derived-types.js'
import type {Session,SessionEvent} from '@deepseek-ai/dsh-session'
import type {MvuLineageDeps,MvuDerivedSourceProof} from './roleplay-mvu-lineage.js'
import type {MvuSchemaDerivedPrepared,MvuSchemaDerivedBasis,MvuSchemaDerivedGenesis,
  MvuSchemaFrozenPrefixV1,MvuSchemaHistoryBasisRef} from './roleplay-mvu-schema-derived-types.js'
import type {ForkOperation} from './roleplay-worldline-types.js'
import type {ForkReservation} from './roleplay-branch-routes-types.js'
import type {SchemaJournalReady,SchemaJournalRef} from './roleplay-mvu-schema-journal.js'
import {isAuthorHostJournalReadyV5} from './roleplay-mvu-schema-journal.js'
import type {BrowserProgramV3} from './tavern-author-browser-types-v3.mjs'

interface Table {get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>;entries():Iterable<[string,unknown]>}
type DerivedSession=Pick<Session,'id'|'snapshotEvents'|'inheritedEventCount'>
export interface MvuSchemaForkCapture {
  readonly prefix:MvuSchemaFrozenPrefixV1
  /** The same completed fold, for a live revision reader; never serialized. */
  readonly ready?:SchemaJournalReady
  readonly closure?:MvuSchemaPrefixInputClosureV1
  readonly browserProgram?:Readonly<{program:BrowserProgramV3;epochRef:SchemaJournalReady['epochRef']}>
  readonly historical?:Readonly<{historyBasis:MvuSchemaHistoryBasisRef;parentSourceSha256:string;
    closure:MvuSchemaPrefixInputClosureV1;assertCurrent():void}>
}
export interface MvuSchemaDerivedDeps extends MvuLineageDeps {
  branch:Table
  status:Table
  session(sid:string):DerivedSession|undefined
  /** The DATA owner retains the historical result and its exact dependencies;
   * current Source checks remain in the consuming operation's capture. */
  captureRead?<T>(sid:string,compute:()=>T):{readonly data:T}
  withSourceLock<T>(sid:string,action:()=>Promise<T>):Promise<T>
  sourceInheritance?:MvuFrozenLineageDeps['sourceInheritance']
  readSourceDescriptor?:MvuFrozenLineageDeps['readSourceDescriptor']
  history:{
    captureForkPrefix(sid:string,nativeCut:number):MvuSchemaForkCapture
    captureRevisionForkPrefix?(sid:string,nativeCut:number):MvuSchemaForkCapture
    recoverForkPrefix(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
      initial?:MvuSchemaDerivedGenesis):SchemaJournalReady|undefined
    recoverFrozenForkPrefix?(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
      initial:MvuSchemaDerivedGenesis|undefined,closure:MvuSchemaPrefixInputClosureV1,
      subjectSessionId?:string):SchemaJournalReady|undefined
    verifyForkPrefix(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
      initial?:MvuSchemaDerivedGenesis):boolean
    captureFrozenForkPrefix?(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
      initial?:MvuSchemaDerivedGenesis):{closure:MvuSchemaPrefixInputClosureV1;assertCurrent():void;ready:SchemaJournalReady}
    captureAncestorForkPrefix?(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
      initial:MvuSchemaDerivedGenesis|undefined,closure:MvuSchemaPrefixInputClosureV1,subjectSessionId?:string):
      {prefix:MvuSchemaFrozenPrefixV1;ready?:SchemaJournalReady;closure:MvuSchemaPrefixInputClosureV1;assertCurrent():void;
        browserProgram?:MvuSchemaForkCapture['browserProgram']}
    verifyFrozenForkPrefix?(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
      initial:MvuSchemaDerivedGenesis|undefined,closure:MvuSchemaPrefixInputClosureV1,subjectSessionId?:string):boolean
  }
}
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
function fail(code:string):never {throw Error(code)}

export function createRoleplayMvuSchemaDerived(deps:MvuSchemaDerivedDeps) {
  const lineage=createRoleplayMvuLineage(deps)
  const frozenLineage=deps.sourceInheritance&&deps.readSourceDescriptor?createRoleplayMvuFrozenLineage({
    ...deps,sourceInheritance:deps.sourceInheritance,readSourceDescriptor:deps.readSourceDescriptor}):undefined
  type ReservationOwner={prepared:MvuSchemaDerivedPrepared;ready:SchemaJournalReady}
  const reservations=new Map<string,ReservationOwner>()
  let disposed=false
  function prefix(session:DerivedSession,cut:number):readonly SessionEvent[] {
    const events=session.snapshotEvents()
    if(!Number.isSafeInteger(cut)||cut<1||cut>events.length||events.some((event,index)=>event.seq!==index)) {
      fail('SCHEMA_DERIVED_PREFIX_UNPROVEN')
    }
    return events.slice(0,cut)
  }
  function operationCurrent(prepared:MvuSchemaDerivedPrepared,stage:'preparing'|'reserved'='reserved'):boolean {
    const operation=deps.branch.get(`fork-op-${prepared.operationId}`) as ForkOperation & {
      reservedChildSessionId?:string;childSessionId?:string;state?:string;abortedAt?:number}|undefined
    if(!operation||operation.operationId!==prepared.operationId||operation.state==='failed'
      ||operation.state==='aborted'||operation.abortedAt
      ||operation.anchor.sourceSessionId!==prepared.parentSessionId)return false
    if(stage==='preparing') {
      // Native's reserve callback supplies the exact cut/child before the
      // route persists its reservation. Normalize only that cut field; every
      // other anchor field and any existing child selection must still agree.
      const anchor={...operation.anchor,expectedSeedLength:prepared.seedLength},
        child=operation.reservedChildSessionId??operation.childSessionId??prepared.childSessionId
      return child===prepared.childSessionId&&recordSha256(anchor)===prepared.anchorSha256
    }
    // Commit/publication and legacy cold verification require the actual
    // durable reservation, never the callback's preparation-only normalization.
    return operation.reservedChildSessionId===prepared.childSessionId
      &&recordSha256(operation.anchor)===prepared.anchorSha256
      &&operation.anchor.expectedSeedLength===prepared.seedLength
  }
  function nativeBasisCurrent(prepared:MvuSchemaDerivedPrepared):boolean {
    return deps.readSession(prepared.parentSessionId)?.inheritedEventCount===prepared.parentInheritedEventCount
  }
  async function putExact(table:Table,key:string,value:unknown):Promise<void> {
    const existing=table.get(key)
    if(existing!==undefined&&!same(existing,value))fail('SCHEMA_DERIVED_WRITE_CONFLICT')
    // Every caller supplies the concrete seal/validator owner's immutable
    // result. Persistence owns exact conflict, lost ACK and readback only.
    if(existing===undefined)try {await table.put(key,value)}
    catch { /* Retain the original intent and confirm only exact committed bytes. */ }
    if(!same(table.get(key),value))fail('SCHEMA_DERIVED_WRITE_UNCONFIRMED')
  }
  type Successor=MvuDerivedSourceProofUnion|TavernSourceFrozenRefV1
  type FrozenLineage=ReturnType<typeof createRoleplayMvuFrozenLineage>
  type FrozenPrepared=ReturnType<FrozenLineage['prepared']>
  type HistoricalSources=NonNullable<Parameters<FrozenLineage['historicalPrepared']>[3]>
  function historicalSource(prior:MvuDerivedSourceProofUnion,next:Successor,subjectSessionId:string,
    closedSources?:HistoricalSources):boolean {
    if(next.encoding==='native-tavern-source-inheritance-frozen-ref-v1')
      return frozenLineage?.historicalPrepared(prior,next,subjectSessionId,closedSources)===true
    if(next.schemaVersion!==1)return frozenLineage?.historical(prior,next,subjectSessionId)===true
    return prior.schemaVersion===1&&lineage.historical(prior,next)
  }
  function sourceCurrent(source:MvuDerivedSourceProofUnion,current:boolean,subjectSessionId:string):boolean {
    if(source.schemaVersion!==1)return frozenLineage
      ?current?frozenLineage.current(source):frozenLineage.verifyDenialBindingFacts(source,subjectSessionId):false
    return current?lineage.current(source):lineage.verifyDenialBindingFacts(source)
  }
  function verifyPrepared(input:MvuSchemaDerivedPrepared,events:readonly SessionEvent[],
    source:Successor,seen:Set<string>,subjectSessionId:string,closedSource?:FrozenPrepared)
    :{prepared:MvuSchemaDerivedPrepared;ready:SchemaJournalReady} {
    const prepared=validateMvuSchemaDerivedPrepared(input)
    if(events.length!==prepared.seedLength||prepared.prefix.journal.nativePrefixSha256!==recordSha256(events)
      ||prepared.schemaVersion===1&&!operationCurrent(prepared)||!nativeBasisCurrent(prepared))fail('SCHEMA_DERIVED_BASIS_UNPROVEN')
    let actualSource=closedSource
    if(prepared.schemaVersion!==1) {
      actualSource??=frozenLineage?.prepared(prepared.childSessionId)
      if(!actualSource||!same(actualSource.ref,prepared.sourcePreparedRef)
        ||actualSource.parentSourceSha256!==prepared.parentSourceSha256
        ||actualSource.frozen.nativeCut.parentInheritedEventCount!==prepared.parentInheritedEventCount)
        fail('SCHEMA_DERIVED_FROZEN_SOURCE_CHANGED')
    }
    const seed=prepared.prefix.seed
    const successor=prepared.schemaVersion!==1?prepared.sourcePreparedRef:source
    let initial:MvuSchemaDerivedGenesis|undefined
    if(prepared.schemaVersion===3) {
      const container=historyContainer(prepared.historyBasis,events,subjectSessionId),prior=container.prepared.prefix,
        selected=prepared.prefix
      if(selected.sessionId!==prior.sessionId||selected.inheritedEventCount!==prior.inheritedEventCount
        ||selected.sourceSha256!==prior.sourceSha256||!same(selected.original,prior.original)
        ||!same(selected.seed,prior.seed)||!same(selected.initial,prior.initial))fail('SCHEMA_DERIVED_PARENT_UNPROVEN')
      if(seed.kind==='derived')initial=readAncestorGenesis(selected.sessionId,events,seen,subjectSessionId)
    }else if(seed.kind==='derived')initial=readHistorical(prepared.parentSessionId,events,successor,seen,
      subjectSessionId,actualSource)
    if(seed.kind==='derived'&&(!initial||initial.basisKey!==seed.basisKey||initial.basisSha256!==seed.basisSha256)) {
      fail('SCHEMA_DERIVED_PARENT_UNPROVEN')
    }
    let ready:SchemaJournalReady|undefined
    if(prepared.schemaVersion!==1) {
      const closure=deps.branch.get(prepared.prefixClosureRef.key) as MvuSchemaPrefixInputClosureV1|undefined
      if(!closure||recordSha256(closure)!==prepared.prefixClosureRef.sha256
        ||closure.closureSha256!==prepared.prefixClosureRef.closureSha256)fail('SCHEMA_DERIVED_HISTORY_UNPROVEN')
      ready=deps.history.recoverFrozenForkPrefix?.(prepared.prefix,events,initial,closure,subjectSessionId)
    }else ready=deps.history.recoverForkPrefix(prepared.prefix,events,initial)
    if(!ready)fail('SCHEMA_DERIVED_HISTORY_UNPROVEN')
    return {prepared,ready}
  }
  function verifyReservation(owner:ReservationOwner,events:readonly SessionEvent[]):
    {prepared:MvuSchemaDerivedPrepared;ready:SchemaJournalReady} {
    const {prepared,ready}=owner
    if(events.length!==prepared.seedLength||prepared.prefix.journal.nativePrefixSha256!==recordSha256(events)
      ||!nativeBasisCurrent(prepared))fail('SCHEMA_DERIVED_BASIS_UNPROVEN')
    if(prepared.schemaVersion!==1) {
      const actual=frozenLineage?.prepared(prepared.childSessionId)
      if(!actual||!same(actual.ref,prepared.sourcePreparedRef)
        ||actual.parentSourceSha256!==prepared.parentSourceSha256
        ||actual.frozen.nativeCut.parentInheritedEventCount!==prepared.parentInheritedEventCount)
        fail('SCHEMA_DERIVED_FROZEN_SOURCE_CHANGED')
    }
    // The reservation already owns this exact completed historical fold and
    // closure. Current Native/Source checks do not recreate its read scopes.
    return {prepared,ready}
  }
  function closedRows(basis:MvuSchemaDerivedBasis,ready:SchemaJournalReady,
    genesis:MvuSchemaDerivedGenesis=mvuSchemaDerivedGenesis(basis,ready)):MvuSchemaDerivedGenesis {
    const sid=genesis.sessionId
    // The committed basis owns its complete prepared DATA. Event and head
    // are the independent publication rows still requiring confirmation.
    if(!same(deps.status.get(mvuSchemaDerivedEventKey(sid)),genesis.event)
      ||!same(deps.status.get(mvuSchemaDerivedHeadKey(sid)),genesis.head))fail('SCHEMA_DERIVED_GENESIS_UNPROVEN')
    return genesis
  }
  /** Source calls this before its child commit and numerical genesis exist.
   * The checked frozen prefix supplies declaration DATA only; this read never
   * creates, spends or restores a numerical publication reservation. */
  function readPreparedInheritedBrowserProgram(childId:string,sourcePreparedRef:TavernSourceInheritanceRefV1):
    Readonly<{program:BrowserProgramV3;epochRef:SchemaJournalReady['epochRef']}>|undefined {
    if(disposed)fail('SCHEMA_DERIVED_OWNER_DISPOSED')
    const raw=deps.branch.get(mvuSchemaDerivedPreparedKey(childId))
    if(raw===undefined)return
    const owner=reservations.get(childId),prepared=owner?.prepared
      ??validateMvuSchemaDerivedPrepared(raw as MvuSchemaDerivedPrepared)
    if(prepared.schemaVersion===1)return
    const ref=prepared.sourcePreparedRef.preparedRef,child=deps.session(childId)
    if(prepared.childSessionId!==childId||ref.key!==sourcePreparedRef.key||ref.sha256!==sourcePreparedRef.sha256)
      fail('SCHEMA_DERIVED_FROZEN_SOURCE_CHANGED')
    if(!child)fail('SCHEMA_DERIVED_BASIS_UNPROVEN')
    // Source has not committed this child yet; its active parent owns the
    // historical Source admission needed by an ownerless precommit recovery.
    const events=prefix(child,prepared.seedLength),{ready}=owner
      ?verifyReservation(owner,events)
      :verifyPrepared(prepared,events,prepared.sourcePreparedRef,new Set([childId]),prepared.parentSessionId)
    if(!isAuthorHostJournalReadyV5(ready)||ready.epoch.program.browserProgram?.schemaVersion!==3)return
    return Object.freeze({program:ready.epoch.program.browserProgram,epochRef:ready.epochRef})
  }
  /** Validate an older generation against the actual descendant prefix and
   * the next frozen Source, never that ancestor's current pointer or head. */
  function readHistorical(sid:string,events:readonly SessionEvent[],successor:Successor,
    seen:Set<string>,subjectSessionId:string,closedSuccessor?:FrozenPrepared):MvuSchemaDerivedGenesis|undefined {
    try {
      if(seen.size>=32||seen.has(sid))return
      seen.add(sid)
      const basis=validateMvuSchemaDerivedBasis(deps.branch.get(mvuSchemaDerivedBasisKey(sid)) as MvuSchemaDerivedBasis)
      const closedSources:HistoricalSources={successor:closedSuccessor}
      if(basis.prepared.childSessionId!==sid||basis.prepared.seedLength>events.length
        ||!historicalSource(basis.source,successor,subjectSessionId,closedSources))return
      // The comparison already closed both Source transactions in this subject's
      // lineage. Keep that DATA for the recursive numerical joins.
      const checked=verifyPrepared(basis.prepared,events.slice(0,basis.prepared.seedLength),basis.source,seen,
        subjectSessionId,closedSources.prior)
      return closedRows(basis,checked.ready)
    }catch {return undefined}
  }
  /** Source proves that the container belongs to this real descendant. Its
   * later prefix is only frozen DATA and is never checked against a shorter log. */
  function historyContainer(ref:MvuSchemaHistoryBasisRef,events:readonly SessionEvent[],
    subjectSessionId:string):MvuSchemaDerivedBasis {
    const basis=validateMvuSchemaDerivedBasis(deps.branch.get(ref.basisKey) as MvuSchemaDerivedBasis)
    if(ref.basisKey!==mvuSchemaDerivedBasisKey(basis.prepared.childSessionId)||basis.basisSha256!==ref.basisSha256
      ||basis.source.schemaVersion===1||!frozenLineage||basis.prepared.prefix.journal.nativeCut<events.length)
      fail('SCHEMA_DERIVED_PARENT_UNPROVEN')
    frozenLineage.readHistorical(basis.source,subjectSessionId)
    return basis
  }
  function readAncestorGenesis(sid:string,events:readonly SessionEvent[],seen:Set<string>,
    subjectSessionId:string):MvuSchemaDerivedGenesis|undefined {
    const basis=validateMvuSchemaDerivedBasis(deps.branch.get(mvuSchemaDerivedBasisKey(sid)) as MvuSchemaDerivedBasis)
    if(basis.prepared.childSessionId!==sid||basis.prepared.seedLength>events.length
      ||basis.source.schemaVersion===1||!frozenLineage)return
    const source=frozenLineage.readHistorical(basis.source,subjectSessionId)
    const checked=verifyPrepared(basis.prepared,events.slice(0,basis.prepared.seedLength),basis.source,seen,
      subjectSessionId,source.prepared)
    return closedRows(basis,checked.ready)
  }
  function captureGenesis(sid:string):Readonly<{basis:MvuSchemaDerivedBasis;genesis:MvuSchemaDerivedGenesis}>|undefined {
    const session=deps.session(sid)
    if(!session)return
    const basis=validateMvuSchemaDerivedBasis(deps.branch.get(mvuSchemaDerivedBasisKey(sid)) as MvuSchemaDerivedBasis)
    if(basis.prepared.childSessionId!==sid||session.inheritedEventCount!==basis.prepared.seedLength)return
    let closedSource:FrozenPrepared|undefined
    if(basis.source.schemaVersion!==1) {
      // The former boolean Source check discarded the same verified prepared
      // DATA that numerical recovery needs immediately afterward.
      try {closedSource=frozenLineage?.readHistorical(basis.source,sid).prepared}
      catch {return}
      if(!closedSource)return
    }else if(!sourceCurrent(basis.source,false,sid))return
    const checked=verifyPrepared(basis.prepared,prefix(session,basis.prepared.seedLength),basis.source,new Set([sid]),sid,closedSource)
    return Object.freeze({basis,genesis:closedRows(basis,checked.ready)})
  }
  function readGenesis(sid:string):MvuSchemaDerivedGenesis|undefined {
    try {
      // Consume one historical DATA object. Reusing it preserves
      // inheritedReady's actual recovered-prefix association; today's Source
      // must never become a dependency of that frozen historical slot.
      const captured=deps.captureRead?deps.captureRead(sid,()=>captureGenesis(sid)).data:captureGenesis(sid)
      if(!captured)return
      return captured.genesis
    }catch {return undefined}
  }
  function readPrefix(subjectSessionId:string,nativeCut:number,revision=false):MvuSchemaForkCapture {
    const parent=deps.session(subjectSessionId)
    if(parent&&nativeCut<=parent.inheritedEventCount) {
      const events=prefix(parent,nativeCut)
      let sid:string=parent.id,container:MvuSchemaDerivedBasis,historyBasis:MvuSchemaHistoryBasisRef
      // Each hop selects the generation that actually owned the target range;
      // a descendant's future snapshot/ordinal never initializes that range.
      do {
        const candidate=validateMvuSchemaDerivedBasis(deps.branch.get(mvuSchemaDerivedBasisKey(sid)) as MvuSchemaDerivedBasis)
        historyBasis={basisKey:mvuSchemaDerivedBasisKey(sid),basisSha256:candidate.basisSha256}
        container=historyContainer(historyBasis,events,parent.id)
        sid=container.prepared.prefix.sessionId
      }while(events.length<=container.prepared.prefix.inheritedEventCount)
      const selected=container.prepared.prefix,prepared=container.prepared
      if(prepared.schemaVersion===1)fail('SCHEMA_DERIVED_FROZEN_HISTORY_UNAVAILABLE')
      const initial=selected.seed.kind==='derived'?readAncestorGenesis(selected.sessionId,events,new Set(),parent.id):undefined
      const closure=deps.branch.get(prepared.prefixClosureRef.key) as MvuSchemaPrefixInputClosureV1|undefined
      if(!closure||recordSha256(closure)!==prepared.prefixClosureRef.sha256
        ||closure.closureSha256!==prepared.prefixClosureRef.closureSha256)fail('SCHEMA_DERIVED_HISTORY_UNPROVEN')
      const captured=deps.history.captureAncestorForkPrefix?.(selected,events,initial,closure,subjectSessionId)
      if(!captured)fail('SCHEMA_DERIVED_FROZEN_HISTORY_UNAVAILABLE')
      return {prefix:captured.prefix,ready:captured.ready,closure:captured.closure,
        browserProgram:captured.browserProgram,historical:{historyBasis,
        parentSourceSha256:deps.readSourceSha256(parent.id),closure:captured.closure,assertCurrent:captured.assertCurrent}}
    }
    if(revision) {
      const captured=deps.history.captureRevisionForkPrefix?.(subjectSessionId,nativeCut)
      if(!captured)fail('SCHEMA_DERIVED_FROZEN_HISTORY_UNAVAILABLE')
      return captured
    }
    return deps.history.captureForkPrefix(subjectSessionId,nativeCut)
  }
  async function capture(operation:ForkOperation,reservation:ForkReservation):Promise<MvuSchemaForkCapture|undefined> {
    if(disposed)fail('SCHEMA_DERIVED_OWNER_DISPOSED')
    if(operation.anchor.openingOnly||reservation.seedLength===0)return
    if(deps.branch.get(mvuSchemaDerivedPreparedKey(reservation.childSessionId))!==undefined)return
    // One historical replay supplies both Source declarations and numerical
    // inheritance. The reservation coordinator captures before Source locking.
    return readPrefix(reservation.sourceSessionId,reservation.seedLength)
  }
  /** Read baseline DATA for a same-branch revision. Its Source/Native owner
   * supplies publication authority; this read creates no fork reservation. */
  function captureRevisionPrefix(sid:string,nativeCut:number):MvuSchemaForkCapture {
    if(disposed)fail('SCHEMA_DERIVED_OWNER_DISPOSED')
    return readPrefix(sid,nativeCut,true)
  }
  /** The Native owner supplies this subject's actual prefix at the saved cut.
   * Core closes any prior revision; frozen recovery restores the existing
   * ready-to-scope association without granting publication authority. */
  function recoverRevisionPrefix(input:{subjectSessionId:string;events:readonly SessionEvent[];
    prefix:MvuSchemaFrozenPrefixV1;closure:MvuSchemaPrefixInputClosureV1;
    historyBasis:MvuSchemaHistoryBasisRef|null;closedRevision:SchemaJournalRef|null}):
    {prefix:MvuSchemaFrozenPrefixV1;ready:SchemaJournalReady} {
    if(disposed)fail('SCHEMA_DERIVED_OWNER_DISPOSED')
    const {subjectSessionId,events,prefix:capturedPrefix,closure,historyBasis}=input
    if(historyBasis!==null) {
      const container=historyContainer(historyBasis,events,subjectSessionId),prior=container.prepared.prefix
      if(capturedPrefix.sessionId!==prior.sessionId||capturedPrefix.inheritedEventCount!==prior.inheritedEventCount
        ||capturedPrefix.sourceSha256!==prior.sourceSha256||!same(capturedPrefix.original,prior.original)
        ||!same(capturedPrefix.seed,prior.seed)||!same(capturedPrefix.initial,prior.initial)) {
        fail('SCHEMA_DERIVED_PARENT_UNPROVEN')
      }
    }
    // This subject's genesis already belongs to its InputState read. Preserve
    // that result and its recovered-prefix association across revision bases;
    // foreign owners still consume their own historical Source and Native cut.
    let initial:MvuSchemaDerivedGenesis|undefined
    if(capturedPrefix.seed.kind==='derived') {
      initial=capturedPrefix.sessionId===subjectSessionId?readGenesis(subjectSessionId)
        :readAncestorGenesis(capturedPrefix.sessionId,events,new Set(),subjectSessionId)
    }
    const ready=deps.history.recoverFrozenForkPrefix?.(capturedPrefix,events,initial,closure,subjectSessionId)
    if(!ready)fail('SCHEMA_DERIVED_HISTORY_UNPROVEN')
    return {prefix:capturedPrefix,ready}
  }
  async function prepare(operation:ForkOperation,reservation:ForkReservation,
    capture:MvuSchemaForkCapture|undefined):Promise<void> {
    if(disposed)fail('SCHEMA_DERIVED_OWNER_DISPOSED')
    if(operation.anchor.openingOnly||reservation.seedLength===0)return
    const existing=deps.branch.get(mvuSchemaDerivedPreparedKey(reservation.childSessionId))
    if(existing!==undefined) {
      // A retry retains only the actual live owner. A persisted row cannot
      // recreate publication authority after teardown or partial publication.
      await deps.withSourceLock(reservation.sourceSessionId,async()=>{
        const owner=reservations.get(reservation.childSessionId),parent=deps.session(reservation.sourceSessionId)
        if(disposed||!owner||!parent||owner.prepared.schemaVersion===1
          ||owner.prepared.operationId!==operation.operationId||!operationCurrent(owner.prepared,'preparing'))
          fail('SCHEMA_DERIVED_PUBLICATION_UNKNOWN')
        verifyReservation(owner,prefix(parent,owner.prepared.seedLength))
      })
      return
    }
    const frozen=capture!.prefix,historical=capture!.historical
    await deps.withSourceLock(reservation.sourceSessionId,async()=>{
      if(disposed)fail('SCHEMA_DERIVED_OWNER_DISPOSED')
      const parent=deps.session(reservation.sourceSessionId)
      if(!parent||parent.id!==operation.anchor.sourceSessionId||reservation.childSessionId===parent.id
        ||reservation.seedLength!==operation.anchor.expectedSeedLength)fail('SCHEMA_DERIVED_RESERVATION_INVALID')
      const events=prefix(parent,reservation.seedLength)
      const parentSourceSha256=historical?.parentSourceSha256??frozen.sourceSha256
      if(frozen.journal.nativePrefixSha256!==recordSha256(events)
        ||parentSourceSha256!==deps.readSourceSha256(parent.id))fail('SCHEMA_DERIVED_SOURCE_CHANGED')
      const initial=!historical&&frozen.seed.kind==='derived'?readGenesis(parent.id):undefined
      const fields={operationId:operation.operationId,
        anchorSha256:recordSha256(operation.anchor),parentSessionId:parent.id,childSessionId:reservation.childSessionId,
        seedLength:reservation.seedLength,parentInheritedEventCount:parent.inheritedEventCount,
        parentSourceSha256,prefix:frozen}
      let prepared:MvuSchemaDerivedPrepared,ready:SchemaJournalReady|undefined
      if(frozenLineage) {
        const source=frozenLineage.prepared(reservation.childSessionId)
        if(source.parentSourceSha256!==parentSourceSha256
          ||recordSha256(deps.readSourceDescriptor!(parent.id))!==source.parentSourceSha256
          ||source.frozen.operationId!==operation.operationId||source.frozen.anchorSha256!==fields.anchorSha256
          ||source.frozen.parentSessionId!==parent.id||source.frozen.nativeCut.seedLength!==reservation.seedLength
          ||source.frozen.nativeCut.parentInheritedEventCount!==parent.inheritedEventCount
          ||source.frozen.nativeCut.prefixSha256!==recordSha256(events))fail('SCHEMA_DERIVED_SOURCE_CHANGED')
        const captured=historical??deps.history.captureFrozenForkPrefix?.(frozen,events,initial)
        if(!captured)fail('SCHEMA_DERIVED_FROZEN_HISTORY_UNAVAILABLE')
        ready=historical?capture!.ready:('ready' in captured?captured.ready:undefined)
        if(!ready)fail('SCHEMA_DERIVED_HISTORY_UNPROVEN')
        const closure=captured.closure,closureKey=mvuSchemaPrefixClosureKey(reservation.childSessionId,closure.closureSha256)
        await putExact(deps.branch,closureKey,closure)
        captured.assertCurrent()
        const bindingBody={operationId:operation.operationId,
          anchor:Object.freeze({...operation.anchor}),reservation:Object.freeze({...reservation})},
          common={...fields,
            sourcePreparedRef:source.ref,parentNumericDescriptorSha256:source.parentSourceSha256,
            prefixClosureRef:Object.freeze({key:closureKey,sha256:recordSha256(closure),closureSha256:closure.closureSha256}),
            forkReservationBinding:Object.freeze({...bindingBody,bindingSha256:recordSha256(bindingBody)})}
        const body=historical?{schemaVersion:3 as const,encoding:'native-mvu-schema-derived-prepared-v3' as const,
          ...common,historyBasis:historical.historyBasis}
          :{schemaVersion:2 as const,encoding:'native-mvu-schema-derived-prepared-v2' as const,...common}
        prepared=Object.freeze({...body,preparedSha256:recordSha256(body)})
      }else {
        ready=deps.history.recoverForkPrefix(frozen,events,initial)
        if(!ready)fail('SCHEMA_DERIVED_HISTORY_UNPROVEN')
        prepared=validateMvuSchemaDerivedPrepared(sealMvuSchemaInheritanceFact({schemaVersion:1 as const,
          encoding:'native-mvu-schema-derived-prepared-v1' as const,...fields},'preparedSha256'))
      }
      if(!operationCurrent(prepared,'preparing'))fail('SCHEMA_DERIVED_OPERATION_CHANGED')
      await putExact(deps.branch,mvuSchemaDerivedPreparedKey(reservation.childSessionId),prepared)
      if(disposed)fail('SCHEMA_DERIVED_OWNER_DISPOSED')
      if(reservations.has(reservation.childSessionId))fail('SCHEMA_DERIVED_RESERVATION_CONFLICT')
      reservations.set(reservation.childSessionId,{prepared,ready})
    })
  }
  async function commit(operation:ForkOperation,child:DerivedSession):Promise<void> {
    const raw=deps.branch.get(mvuSchemaDerivedPreparedKey(child.id))
    if(raw===undefined)return
    await deps.withSourceLock(child.id,async()=>{
      if(deps.branch.get(mvuSchemaDerivedBasisKey(child.id))!==undefined) {
        if(!readGenesis(child.id))fail('SCHEMA_DERIVED_READY_INVALID')
        return
      }
      const owner=reservations.get(child.id)
      if(disposed||!owner||owner.prepared.operationId!==operation.operationId
        ||deps.status.get(mvuSchemaDerivedEventKey(child.id))!==undefined
        ||deps.status.get(mvuSchemaDerivedHeadKey(child.id))!==undefined)fail('SCHEMA_DERIVED_PUBLICATION_UNKNOWN')
      const candidate=owner.prepared
      const source=candidate.schemaVersion===3?frozenLineage?.capture(child.id,candidate.sourcePreparedRef,3)
        :candidate.schemaVersion===2?frozenLineage?.capture(child.id,candidate.sourcePreparedRef)
        :lineage.capture(candidate.parentSessionId,child.id,child.inheritedEventCount)
      if(!source)fail('SCHEMA_DERIVED_FROZEN_SOURCE_UNAVAILABLE')
      const {prepared,ready}=verifyReservation(owner,prefix(child,child.inheritedEventCount))
      if(prepared.operationId!==operation.operationId||source.parentSourceSha256!==prepared.parentSourceSha256) {
        fail('SCHEMA_DERIVED_PARENT_SOURCE_CHANGED')
      }
      if(!operationCurrent(prepared))fail('SCHEMA_DERIVED_OPERATION_CHANGED')
      let basis:MvuSchemaDerivedBasis
      if(prepared.schemaVersion===3) {
        if(source.schemaVersion!==3)fail('SCHEMA_DERIVED_FROZEN_SOURCE_UNAVAILABLE')
        basis=createMvuSchemaDerivedBasis(prepared,source)
      }else if(prepared.schemaVersion===2) {
        if(source.schemaVersion!==2)fail('SCHEMA_DERIVED_FROZEN_SOURCE_UNAVAILABLE')
        basis=createMvuSchemaDerivedBasis(prepared,source)
      }else {
        if(source.schemaVersion!==1)fail('SCHEMA_DERIVED_FROZEN_SOURCE_UNAVAILABLE')
        basis=validateMvuSchemaDerivedBasis(sealMvuSchemaInheritanceFact({schemaVersion:1 as const,
          encoding:'native-mvu-schema-derived-basis-v1' as const,prepared,source},'basisSha256'))
      }
      const genesis=mvuSchemaDerivedGenesis(basis,ready)
      // Incomplete event/head/basis publication remains an unknown reservation.
      // A GET or cold read cannot supply the missing writes.
      // Only the actual reservation callback can mint this private, single-use
      // owner. Persisted prepared/basis hashes cannot restore it after teardown.
      reservations.delete(child.id)
      await putExact(deps.status,mvuSchemaDerivedEventKey(child.id),genesis.event)
      await putExact(deps.status,mvuSchemaDerivedHeadKey(child.id),genesis.head)
      if(!operationCurrent(prepared))fail('SCHEMA_DERIVED_OPERATION_CHANGED')
      await putExact(deps.branch,mvuSchemaDerivedBasisKey(child.id),basis)
      // This reservation already verified the full prefix before publishing.
      // Only live Source/Native association and the closed rows can change
      // across these writes; cold/retry readers retain the full genesis check.
      try {
        const actualChild=deps.session(child.id)
        if(!actualChild||prepared.childSessionId!==child.id||actualChild.inheritedEventCount!==prepared.seedLength
          ||!nativeBasisCurrent(prepared)||!sourceCurrent(basis.source,true,child.id))fail('SCHEMA_DERIVED_READY_UNCONFIRMED')
        closedRows(basis,ready,genesis)
      }catch {fail('SCHEMA_DERIVED_READY_UNCONFIRMED')}
    })
  }
  return {capture,captureRevisionPrefix,recoverRevisionPrefix,prepare,commit,readGenesis,readPreparedInheritedBrowserProgram,
    required:(sid:string)=>deps.branch.get(mvuSchemaDerivedPreparedKey(sid))!==undefined
      ||deps.branch.get(mvuSchemaDerivedBasisKey(sid))!==undefined,
    releaseReservation(childId:string):void {reservations.delete(childId)},
    dispose():void {disposed=true;reservations.clear()}}
}
