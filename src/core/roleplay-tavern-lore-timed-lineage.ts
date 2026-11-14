/** Replays original publication owners at the actual descendant cut, then
 * maps surviving intervals into the child address space. No closure runs and
 * no inherited live injection, timer head or Native capability is restored. */
import {nativeInputSha256} from 'dsh-nexttavern-native-agent-loop'
import {createHash} from 'node:crypto'
import type {Hash} from 'node:crypto'
import type {SessionMessageProjection} from 'dsh-nexttavern-native-session'
import {recordSha256,stableJson} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {captureRoleplayTavernMaterialHistoryV1,captureRoleplayTavernInheritedMaterialHistoryV1}
  from './roleplay-tavern-material-history.js'
import {tavernMaterialProjectionIdentityV1,tavernMaterialNativePrefixSha256V1,
  isTavernHistoryTextOnlyMaterialV1} from './roleplay-tavern-material-history.js'
import type {createRoleplayInputStateOwner,RoleplayInputStateRead} from './roleplay-input-state.js'
import {readTavernTimedPublicationV1,replayTavernTimedPublicationV1,applyTavernTimedActionV1}
  from './roleplay-tavern-lore-timed-history.js'
import {readTavernCanonicalChatRowsAtCutV1,verifyTavernCanonicalChatClock} from './roleplay-tavern-chat-clock.js'
import type {TavernCanonicalChatClockCaptureV1,TavernCanonicalChatClockCaptureV2} from './roleplay-tavern-chat-clock.js'
import type {TavernReadonlyAuthorDialogChatClockCaptureV1} from './roleplay-tavern-chat-clock.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernSourceInheritanceOwnerV1} from './roleplay-tavern-source-inheritance-types.js'
import type {TavernLoreCompilationV1,TavernLoreEntryPlanV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreBranchTimedInputV1} from './tavern-lore-evaluator-types.mjs'
import type {TavernMaterialPublicationSequenceV1} from './roleplay-tavern-material-history.js'

type Interval=TavernLoreBranchTimedInputV1['intervals'][number]
type Publication=ReturnType<typeof captureRoleplayTavernMaterialHistoryV1>['publications'][number]
type Read=ReturnType<typeof readTavernTimedPublicationV1>
type Transaction=ReturnType<TavernSourceInheritanceOwnerV1['readCommittedSourceLineage']>['current']
interface EpochV2 {
  sourceRecordSessionId:string;importId:string;rawSha256:string;normalizedSha256:string;
  coverageSha256:string;transactionId:string;importRecordSha256:string;documentSha256:string;
  dataSha256:string;bookPointer:string;bookSha256:string
}
interface EntryAddressV1 {
  sourcePointer:string;sourceKey:string;rawEntrySha256:string;
  upstreamUid:TavernLoreEntryPlanV1['upstreamUid'];addressSha256:string
}
interface OriginV1 {
  ownerSessionId:string;nativeSeq:number;planRef:{key:string;sha256:string};actionIndex:number;
  sourceEntryId:string;address:EntryAddressV1;
  clockPolicy:'legacy-selected-window-v1'|'native-canonical-story-chat-clock-v1';
  fullClock:{nativeCut:number;prefixSha256:string;chatIndex:number;membershipSha256:string;clockSha256:string|null}
}
interface State {
  ownerSessionId:string;revision:number;intervals:Map<string,Interval>;origins:Map<string,OriginV1>;
  mode:'legacy'|'full';audit:PublicationAudit;baseline:Record<string,unknown>;
  clockTransition:Record<string,unknown>|null
}
interface StateCheckpoint {
  readonly state:Omit<State,'intervals'|'origins'|'audit'>&{
    readonly intervals:readonly Interval[];readonly origins:readonly (readonly [string,OriginV1])[]
  }
  readonly audit:PublicationAudit
}
interface ArrayLink<T> {readonly previous:ArrayLink<T>|null;readonly row:T}
interface ArrayAudit<T> {readonly count:number;readonly tail:ArrayLink<T>|null;readonly hash:Hash}
interface PublicationLink extends ArrayLink<Record<string,unknown>> {
  readonly previous:PublicationLink|null
  readonly planKey:string
  readonly attemptKey:string
}
interface PublicationMembership {
  tail:PublicationLink|null
  readonly plans:Map<string,number>
  readonly attempts:Map<string,{index:number;planKey:string}>
}
interface PublicationAudit extends ArrayAudit<Record<string,unknown>> {
  readonly tail:PublicationLink|null
  readonly membership:PublicationMembership
}
interface CoreRef {key:string;sha256:string}
interface IndexedPublication {publication:Publication;read:Read;epochSha256:string}
interface CatalogPublication {publication:Publication;timed:IndexedPublication|undefined}
interface TimedCatalog {
  readonly ownOwner:object
  readonly inheritedOwner:object|undefined
  readonly identity:string
  readonly rows:CatalogPublication[]
  readonly facts:{purpose:string;read:RoleplayInputStateRead<CatalogPublication>}[]
  readonly byEpoch:Map<string,IndexedPublication[]>
  readonly core:Map<string,{inheritedCut:number;seen:Map<string,string>;cuts:ArrayAudit<CoreRef>[]}>
}
interface TimedSessionCache {readonly folds:Map<string,FoldCheckpointRead>;catalog?:TimedCatalog}
interface Dependencies {
  readonly sessionId:string
  readonly source:TavernLoreSourceDataV1
  readonly compilation:Extract<TavernLoreCompilationV1,{kind:'compiled'}>
  readonly ownHistory:ReturnType<typeof captureRoleplayTavernMaterialHistoryV1>
  readonly inheritedHistory?:ReturnType<typeof captureRoleplayTavernInheritedMaterialHistoryV1>
  readonly sourceLineage?:ReturnType<TavernSourceInheritanceOwnerV1['readCommittedSourceLineage']>
  readonly clock:TavernCanonicalChatClockCaptureV1|TavernCanonicalChatClockCaptureV2|TavernReadonlyAuthorDialogChatClockCaptureV1
  readonly projections:readonly SessionMessageProjection[]
  readonly assertOwnerCurrent:()=>void
  readonly assertSourceLineageCurrent:()=>void
  readonly inputState?:Pick<ReturnType<typeof createRoleplayInputStateOwner>,
    'captureClosedHistoricalFacts'|'observeSessionRelease'>
  readonly table?:{get(key:string):unknown}
}
interface FoldCheckpointRead {
  readonly identity:string
  readonly index:number
  readonly publication:Publication
  readonly read:RoleplayInputStateRead<StateCheckpoint>
}
// The closed read owns every actual prior publication/lineage dependency.
// This index only locates the last valid checkpoint; it grants no live Source
// permission. All ancestral folds used by one capture belong to that capture's
// session lifetime; releasing it must drop the index even if it is never read again.
const latestFoldCheckpoints=new WeakMap<object,Map<string,TimedSessionCache>>()
function sessionFoldCheckpoints(inputState:NonNullable<Dependencies['inputState']>,sessionId:string) {
  let sessions=latestFoldCheckpoints.get(inputState)
  if(!sessions) {
    sessions=new Map()
    latestFoldCheckpoints.set(inputState,sessions)
    const owned=sessions
    inputState.observeSessionRelease(sid=>owned.delete(sid))
  }
  let checkpoints=sessions.get(sessionId)
  if(!checkpoints){checkpoints={folds:new Map()};sessions.set(sessionId,checkpoints)}
  return checkpoints
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const timedPolicyV2=Object.freeze({publication:'first-actual-Native-required-material-per-plan',
  retry:'same-plan-zero-actions',inheritance:'original-owner-at-actual-cut-then-unique-original-entry-address-map',
  liveInjection:'own-registration-only',clock:'native-canonical-story-chat-clock-v1'})
const timedPolicyV3=Object.freeze({...timedPolicyV2,clock:'native-canonical-story-chat-clock-v2',
  audit:'exact-canonical-array-sha256-and-count-v1'})
const timedEvidenceFieldsV2=['schemaVersion','encoding','authority','policy','sessionId','sourceEpoch','clock',
  'baseline','clockTransition','ownPublications','ownRevision','coreRefs','timedSha256','timedReadSha256'].sort()
const timedEvidenceFieldsV3=['schemaVersion','encoding','authority','policy','sessionId','sourceEpoch','clock',
  'baseline','clockTransition','ownPublicationCount','ownPublicationsSha256','ownRevision',
  'coreRefCount','coreRefsSha256','timedSha256','timedReadSha256'].sort()
function fail(code='INPUT_MATERIAL_TIMED_INHERITANCE_UNPROVEN'):never {throw Error(code)}
function frozen<T>(v:T):T {
  if(v&&typeof v==='object'){for(const child of Object.values(v))frozen(child);Object.freeze(v)}
  return v
}
function seal<T extends Record<string,unknown>,K extends string>(body:T,key:K):T&{[P in K]:string} {
  return frozen(cloneRoleplayTavernLoreDataV1({...body,[key]:recordSha256(body)},8_388_608)) as T&{[P in K]:string}
}
function epochOf(source:TavernLoreSourceDataV1):EpochV2 {
  // Source capture and historical publication readers own the complete DATA;
  // timing consumes only its epoch, without charging archived metadata again.
  const original=source.original
  return {sourceRecordSessionId:source.sourceRecordSessionId,importId:original.activePointer.importId,
    rawSha256:original.rawSha256,normalizedSha256:original.normalizedSha256,coverageSha256:original.coverageSha256,
    transactionId:original.transactionId,importRecordSha256:original.importRecordRef.sha256,
    documentSha256:original.documentSha256,dataSha256:original.dataSha256,
    bookPointer:original.primary.bookPointer,bookSha256:original.primary.bookSha256}
}
function publicationEpoch(read:Read):EpochV2 {
  const raw=read.publication.snapshot.payload.source
  if(!object(raw))fail('INPUT_MATERIAL_TIMED_SOURCE_EPOCH_UNPROVEN')
  const source=raw as unknown as TavernLoreSourceDataV1,epoch=epochOf(source),plan=read.compilation.plan.source
  if(source.sessionId!==read.plan.sessionId||plan.ownerSessionId!==read.plan.sessionId
    ||plan.sourceRecordSessionId!==epoch.sourceRecordSessionId||plan.importId!==epoch.importId
    ||plan.rawSourceSha256!==epoch.rawSha256||plan.importRecordSha256!==epoch.importRecordSha256
    ||plan.documentSha256!==epoch.documentSha256||plan.bookPointer!==epoch.bookPointer
    ||plan.bookValueSha256!==epoch.bookSha256||plan.sourceSnapshotSha256!==source.sourceSha256)fail()
  return epoch
}
const intervalKey=(row:Interval)=>`${row.entryId}:${row.kind}`
function address(entry:TavernLoreEntryPlanV1):EntryAddressV1 {
  const body={sourcePointer:entry.sourcePointer,sourceKey:entry.sourceKey,
    rawEntrySha256:entry.rawEntrySha256,upstreamUid:entry.upstreamUid}
  return {...body,addressSha256:recordSha256(body)}
}
function entryId(owner:string,epoch:EpochV2,entry:EntryAddressV1):string {
  const bookId=recordSha256({schemaVersion:1,encoding:'st-lore-book-source-address-v1',ownerSessionId:owner,
    sourceRecordSessionId:epoch.sourceRecordSessionId,importId:epoch.importId,bookPointer:epoch.bookPointer})
  return recordSha256({schemaVersion:1,encoding:'st-lore-entry-source-address-v1',bookId,
    sourceKey:entry.sourceKey,uid:entry.upstreamUid})
}
const stateDigest=(state:State)=>recordSha256({ownerSessionId:state.ownerSessionId,revision:state.revision,
  mode:state.mode,intervals:[...state.intervals.values()],origins:[...state.origins],publications:auditRows(state.audit)})
const copyState=(state:State):State=>({...state,intervals:new Map(state.intervals),origins:new Map(state.origins)})
const checkpointState=(state:State):StateCheckpoint=>{
  const {audit,...body}=state
  return Object.freeze({state:frozen({...body,intervals:[...state.intervals.values()],origins:[...state.origins]}),audit})
}
function auditLinks<T>(audit:ArrayAudit<T>):ArrayLink<T>[] {
  const links:ArrayLink<T>[]=[]
  for(let link=audit.tail;link;link=link.previous)links.push(link)
  return links.reverse()
}
const auditRows=<T>(audit:ArrayAudit<T>)=>auditLinks(audit).map(link=>link.row)
const auditSha256=(audit:ArrayAudit<unknown>)=>audit.hash.copy().update(']').digest('hex')
const emptyAudit=<T>():ArrayAudit<T>=>({count:0,tail:null,hash:createHash('sha256').update('[')})
function appendDigest<T>(audit:ArrayAudit<T>,row:T):Hash {
  const hash=audit.hash.copy()
  if(audit.count)hash.update(',')
  hash.update(stableJson(row)!)
  return hash
}
function appendAudit<T>(audit:ArrayAudit<T>,row:T):ArrayAudit<T> {
  return {count:audit.count+1,tail:Object.freeze({previous:audit.tail,row}),hash:appendDigest(audit,row)}
}
function emptyPublicationAudit():PublicationAudit {
  return {...emptyAudit<Record<string,unknown>>(),tail:null,
    membership:{tail:null,plans:new Map(),attempts:new Map()}}
}
function publicationMembership(audit:PublicationAudit):PublicationMembership {
  if(audit.membership.tail===audit.tail)return audit.membership
  // A genuine repair may resume an older branch of the closed facts. Rebuild
  // that prefix once; ordinary appends always extend the same actual tip.
  const membership:PublicationMembership={tail:audit.tail,plans:new Map(),attempts:new Map()}
  for(const [index,raw]of auditLinks(audit).entries()) {
    const link=raw as PublicationLink
    membership.plans.set(link.planKey,index)
    membership.attempts.set(link.attemptKey,{index,planKey:link.planKey})
  }
  return membership
}
const restoreState=(checkpoint:StateCheckpoint):State=>
  ({...checkpoint.state,audit:checkpoint.audit,
  intervals:new Map(checkpoint.state.intervals.map(interval=>[intervalKey(interval),interval])),
  origins:new Map(checkpoint.state.origins)})

export function captureRoleplayTavernTimedHistoryV2(deps:Dependencies) {
  deps.assertOwnerCurrent()
  const sessionCache=deps.inputState?sessionFoldCheckpoints(deps.inputState,deps.sessionId):undefined,
    checkpoints=sessionCache?.folds
  const prefixFacts={nativeCut:deps.ownHistory.nativeCut}
  const epoch=epochOf(deps.source),epochSha256=recordSha256(epoch),events=()=>deps.ownHistory.events,
    transactions=new Map<string,Transaction>(),memo=new Map<string,State>(),reading=new Set<string>(),
    fullClocks=new Map<number,OriginV1['fullClock']>(),
    projectionIdentity=tavernMaterialProjectionIdentityV1(deps.projections)
  const nativePrefix=(cut:number)=>prefixFacts.nativeCut?.nativeInputPrefixSha256(cut)
    ??tavernMaterialNativePrefixSha256V1(prefixFacts,events(),cut)
  function historicalRead<T>(purpose:string,publications:readonly Publication[],compute:()=>T,prepare?:()=>void)
    :RoleplayInputStateRead<T> {
    if(!deps.inputState){prepare?.();return {data:compute(),current:()=>true,assertCurrent(){}}}
    return deps.inputState.captureClosedHistoricalFacts(deps.sessionId,`tavern-timed:${projectionIdentity}:${purpose}`,()=>{
      // These are real Domain reads in this historical slot. The publication
      // object is immutable DATA; it cannot subscribe a new owner on its own.
      for(const publication of publications){
        deps.table!.get(publication.event.data.snapshot.key)
        deps.table!.get(publication.event.data.plan.key)
      }
      return compute()
    },prepare)
  }
  const historical=<T>(purpose:string,publications:readonly Publication[],compute:()=>T,prepare?:()=>void):T=>
    historicalRead(purpose,publications,compute,prepare).data
  if(deps.compilation.plan.source.ownerSessionId!==deps.sessionId
    ||deps.compilation.plan.source.sourceRecordSessionId!==epoch.sourceRecordSessionId
    ||deps.compilation.plan.source.importRecordSha256!==epoch.importRecordSha256
    ||deps.clock.data.sessionId!==deps.sessionId)fail()
  if(deps.source.inheritance) {
    const lineage=deps.sourceLineage
    if(!lineage||!deps.inheritedHistory||!same(lineage.current.inheritance,deps.source.inheritance)
      ||deps.inheritedHistory.evidence.prefixLength!==lineage.current.prepared.nativeCut.seedLength
      ||deps.inheritedHistory.evidence.prefixSha256!==lineage.current.prepared.nativeCut.prefixSha256)fail()
    for(const transaction of [lineage.current,...lineage.ancestors]) {
      const sid=transaction.prepared.childSessionId
      if(transactions.has(sid))fail()
      transactions.set(sid,transaction)
    }
  }else if(deps.sourceLineage||deps.inheritedHistory)fail()
  const allowed=new Set([deps.sessionId,...[...transactions.values()].flatMap(row=>
    [row.prepared.childSessionId,row.prepared.parentSessionId])])
  function sequence(history:Dependencies['ownHistory']|NonNullable<Dependencies['inheritedHistory']>):TavernMaterialPublicationSequenceV1 {
    if(history.publicationSequence)return history.publicationSequence
    const rows=history.publications
    return {owner:rows,length:rows.length,at:index=>rows[index],*range(start=0,end=rows.length) {
      yield* rows.slice(start,end)
    },assertCurrent:history.assertCurrent,current(){try{history.assertCurrent();return true}catch{return false}}}
  }
  const ownSequence=sequence(deps.ownHistory),inheritedSequence=deps.inheritedHistory?sequence(deps.inheritedHistory):undefined,
    inheritedLength=inheritedSequence?.length??0,totalLength=inheritedLength+ownSequence.length,
    catalogIdentity=recordSha256({projectionIdentity,sessionId:deps.sessionId,
      inheritedCuts:[...allowed].map(owner=>[owner,transactions.get(owner)?.prepared.nativeCut.seedLength??0])})
  ownSequence.assertCurrent();inheritedSequence?.assertCurrent()
  let catalog=sessionCache?.catalog
  if(!catalog||catalog.ownOwner!==ownSequence.owner||catalog.inheritedOwner!==inheritedSequence?.owner
    ||catalog.identity!==catalogIdentity) {
    catalog={ownOwner:ownSequence.owner,inheritedOwner:inheritedSequence?.owner,identity:catalogIdentity,
      rows:[],facts:[],byEpoch:new Map(),core:new Map([...allowed].map(owner=>[owner,{
        inheritedCut:transactions.get(owner)?.prepared.nativeCut.seedLength??0,
        seen:new Map(),cuts:[emptyAudit<CoreRef>()]}]))}
    if(sessionCache)sessionCache.catalog=catalog
  }
  try {
    for(let index=catalog.rows.length;index<totalLength;index++) {
      const publication=(index<inheritedLength?inheritedSequence!.at(index):ownSequence.at(index-inheritedLength))!,
        parent=catalog.facts[index-1],purpose=`catalog:${catalogIdentity}:${publication.event.seq}`,
        read=historicalRead(purpose,[publication],()=>{
          if(parent)historical(parent.purpose,[],()=>parent.read.data)
          if(publication.event.seq<=(catalog!.rows[index-1]?.publication.event.seq??-1)
            ||!allowed.has(publication.snapshot.sessionId))fail()
          const parsed=isTavernHistoryTextOnlyMaterialV1(publication)?undefined
            :readTavernTimedPublicationV1(publication,publication.snapshot.sessionId)
          return {publication,timed:parsed?{publication,read:parsed,epochSha256:recordSha256(publicationEpoch(parsed))}:undefined}
        }),row=read.data
      if(row.timed) {
        const key=JSON.stringify([publication.snapshot.sessionId,row.timed.epochSha256]),bucket=catalog.byEpoch.get(key)??[]
        bucket.push(row.timed);catalog.byEpoch.set(key,bucket)
      }
      // Each real Core reference keeps its first array position, including
      // other Source epochs. This is the same ordered union as the old audit.
      for(const [owner,context]of catalog.core) {
        let audit=context.cuts.at(-1)!
        if(publication.snapshot.sessionId===owner||publication.event.seq<context.inheritedCut) {
          for(const ref of [publication.event.data.snapshot,publication.event.data.plan]) {
            const prior=context.seen.get(ref.key)
            if(prior&&prior!==ref.sha256)fail('INPUT_MATERIAL_TIMED_CORE_REF_CONFLICT')
            if(!prior){context.seen.set(ref.key,ref.sha256);audit=appendAudit(audit,{key:ref.key,sha256:ref.sha256})}
          }
        }
        context.cuts.push(audit)
      }
      catalog.rows.push(row);catalog.facts.push({purpose,read})
    }
    const last=catalog.facts[totalLength-1]
    if(last)historical(last.purpose,[],()=>last.read.data)
  }catch(error){if(sessionCache)sessionCache.catalog=undefined;throw error}
  function before<T>(rows:readonly T[],cut:number,seq:(row:T)=>number) {
    let left=0,right=rows.length
    while(left<right){const middle=(left+right)>>>1;if(seq(rows[middle]!)<cut)left=middle+1;else right=middle}
    return left
  }
  const coreRefsAt=(owner:string,cut:number)=>catalog!.core.get(owner)!.cuts[
    before(catalog!.rows,cut,row=>row.publication.event.seq)]!
  const knownEntries=new Map(deps.compilation.plan.entries.map(entry=>[address(entry).addressSha256,address(entry)]))
  const foldIdentity=recordSha256({epochSha256,entryAddresses:[...knownEntries.values()],
    lineage:[...transactions.values()].map(transaction=>transaction.inheritance.commitRef)})
  function fullAt(read:Read):OriginV1['fullClock'] {
    const seq=Number(read.publication.event.seq),existing=fullClocks.get(seq)
    if(existing)return existing
    const full=historical(`legacy-clock:${read.plan.sessionId}:${seq}`,[read.publication],()=>{
      const rows=readTavernCanonicalChatRowsAtCutV1(read.plan.sessionId,events(),seq,deps.projections,deps.ownHistory.nativeCut)
      return {nativeCut:seq,prefixSha256:nativePrefix(seq),chatIndex:rows.length,
        membershipSha256:recordSha256(rows.map(row=>row.ref)),clockSha256:null}
    })
    fullClocks.set(seq,full)
    return full
  }
  function migrate(state:State):State {
    if(state.mode==='full')return {...copyState(state),clockTransition:null}
    const result=copyState(state),conversions:unknown[]=[],oldStateSha256=stateDigest(state)
    for(const [key,interval] of result.intervals) {
      const origin=result.origins.get(key)
      if(!origin||origin.clockPolicy!=='legacy-selected-window-v1')fail('INPUT_MATERIAL_TIMED_CLOCK_ORIGIN_MISSING')
      const duration=interval.end-interval.start,start=origin.fullClock.chatIndex,end=start+duration
      if(!Number.isSafeInteger(duration)||duration<0||!Number.isSafeInteger(end))fail()
      const after={...interval,start,end}
      result.intervals.set(key,after)
      result.origins.set(key,{...origin,clockPolicy:'native-canonical-story-chat-clock-v1'})
      conversions.push({before:interval,after,origin})
    }
    result.mode='full'
    result.clockTransition=seal({schemaVersion:1,encoding:'timed-clock-transition-v1',
      policy:'each-surviving-interval-at-its-last-actual-set; preserve-duration-and-protection',
      ownerSessionId:state.ownerSessionId,oldStateSha256,conversions,resultStateSha256:stateDigest(result)},'transitionSha256')
    return result
  }
  function mapParent(parent:State,owner:string) {
    const intervals=new Map<string,Interval>(),origins=new Map<string,OriginV1>(),mappings:unknown[]=[],
      seenSource=new Set<string>(),seenTarget=new Set<string>()
    for(const interval of parent.intervals.values()) {
      const origin=parent.origins.get(intervalKey(interval)),known=origin&&knownEntries.get(origin.address.addressSha256)
      if(!origin||!known||!same(known,origin.address)||origin.address.rawEntrySha256!==interval.rawEntrySha256
        ||entryId(parent.ownerSessionId,epoch,origin.address)!==interval.entryId)fail('INPUT_MATERIAL_TIMED_ENTRY_MAPPING_UNPROVEN')
      const targetId=entryId(owner,epoch,origin.address),after={...interval,entryId:targetId},key=intervalKey(after)
      if(intervals.has(key))fail()
      intervals.set(key,after);origins.set(key,origin)
      if(!seenSource.has(interval.entryId)) {
        if(seenTarget.has(targetId))fail()
        seenSource.add(interval.entryId);seenTarget.add(targetId)
        mappings.push({sourceEntryId:interval.entryId,targetEntryId:targetId,address:origin.address})
      }
    }
    return {intervals,origins,mappings}
  }
  function emptyBaseline(owner:string,reason:string,cut:number,transaction?:Transaction) {
    return seal({schemaVersion:1,encoding:'native-material-lore-timed-baseline-v1',kind:'root-empty',
      ownerSessionId:owner,sourceEpochSha256:epochSha256,reason,
      sourceRefs:transaction?{prepared:transaction.inheritance.preparedRef,commit:transaction.inheritance.commitRef,
        ready:transaction.inheritance.readyRef,materialBaseline:transaction.inheritance.materialBaselineRef}:null,
      inheritedCut:cut,inheritedPrefixSha256:nativePrefix(cut),
      parentFold:null,entryMappings:[],intervals:[],intervalOrigins:[],clockTransition:null},'baselineSha256')
  }
  function fold(owner:string,cut:number):State {
    const key=`${owner}:${epochSha256}:${cut}`,cached=memo.get(key)
    if(cached)return copyState(cached)
    if(reading.has(owner)||reading.size>=32||memo.size>=96)fail('INPUT_MATERIAL_TIMED_LINEAGE_BUDGET')
    reading.add(owner)
    try {
      const transaction=transactions.get(owner),own=catalog!.byEpoch.get(JSON.stringify([owner,epochSha256]))??[],
        ownLength=before(own,cut,row=>row.publication.event.seq),publicationAt=(index:number)=>own[index]!.publication,
        firstEvidence=ownLength?publicationAt(0).snapshot.payload.timed:undefined,
        historicalLegacy=object(firstEvidence)&&firstEvidence.encoding==='native-material-lore-timed-read-v1',
        inheritedCut=Math.min(cut,transaction?.prepared.nativeCut.seedLength??0),
        purpose=`${foldIdentity}:${owner}:${inheritedCut}:${historicalLegacy?'legacy':'full'}`
      function initialize():StateCheckpoint {
        // The baseline consumes the actual original Import and lineage rows.
        // Later states depend on this immutable baseline through InputState.
        deps.table?.get(deps.source.original.importRecordRef.key)
        for(const row of transactions.values())for(const ref of [row.inheritance.preparedRef,
          row.inheritance.applyIntentRef,row.inheritance.commitRef,row.inheritance.readyRef,
          row.inheritance.editBaselineRef,row.inheritance.materialBaselineRef,row.inheritance.originalBinding.importRecordRef])
          deps.table?.get(ref.key)
        let intervals=new Map<string,Interval>(),origins=new Map<string,OriginV1>(),baseline:Record<string,unknown>
        const mode:State['mode']=historicalLegacy?'legacy':'full'
        if(historicalLegacy)baseline=emptyBaseline(owner,'historical-own-v1-empty-policy',0,transaction)
        // Replay the original owner's producer baseline; descendants retain
        // the actual parent's identity and its cut rather than today's head.
        else if(!transaction)baseline=emptyBaseline(owner,'verified-own-source-epoch',0)
        else if(!same(epochOf(transaction.prepared.parentSource),epoch))
          baseline=emptyBaseline(owner,'source-epoch-changed-at-birth',inheritedCut,transaction)
        else if(transaction.prepared.nativeCut.kind==='reserved-fresh-branch')
          baseline=emptyBaseline(owner,'actual-fresh-cut-zero',0,transaction)
        else {
          const parent=migrate(fold(transaction.prepared.parentSessionId,inheritedCut)),mapped=mapParent(parent,owner)
          intervals=mapped.intervals;origins=mapped.origins
          baseline=seal({schemaVersion:1,encoding:'native-material-lore-timed-baseline-v1',kind:'frozen-inherited',
            ownerSessionId:owner,sourceEpochSha256:epochSha256,
            sourceRefs:{prepared:transaction.inheritance.preparedRef,commit:transaction.inheritance.commitRef,
              ready:transaction.inheritance.readyRef,materialBaseline:transaction.inheritance.materialBaselineRef},
            inheritedCut,inheritedPrefixSha256:nativePrefix(inheritedCut),
            parentFold:{ownerSessionId:parent.ownerSessionId,revision:parent.revision,stateSha256:stateDigest(parent),
              publicationsSha256:auditSha256(parent.audit)},entryMappings:mapped.mappings,
            intervals:[...intervals.values()],intervalOrigins:[...origins],clockTransition:parent.clockTransition},'baselineSha256')
        }
        return checkpointState({ownerSessionId:owner,revision:0,intervals,origins,mode,audit:emptyPublicationAudit(),baseline,
          clockTransition:null})
      }
      // One mutable replay cursor belongs to this fold only. Checkpoints keep
      // one immutable publication link, rather than a copy of every prefix.
      function advance(previous:StateCheckpoint,index:number):StateCheckpoint {
        const publication=publicationAt(index),read=own[index]!.read,evidence=publication.snapshot.payload.timed,
          membership=publicationMembership(previous.audit),seen=membership.plans.get(read.planKey),
          prior=membership.attempts.get(read.attemptKey)
        // The same index also serves retained old cuts. Entries accepted after
        // this real count are not members of this checkpoint's history.
        if(seen!==undefined&&seen<previous.audit.count)return previous
        if(prior&&prior.index<previous.audit.count&&prior.planKey!==read.planKey)
          fail('INPUT_MATERIAL_TIMED_ATTEMPT_PLAN_CONFLICT')
        let state=restoreState(previous)
        let fullClock:OriginV1['fullClock']
        if(object(evidence)&&(evidence.schemaVersion===2&&evidence.encoding==='native-material-lore-timed-read-v2'
          ||evidence.schemaVersion===3&&evidence.encoding==='native-material-lore-timed-read-v3')) {
          if(!same(Object.keys(evidence).sort(),evidence.schemaVersion===3?timedEvidenceFieldsV3:timedEvidenceFieldsV2)
            ||evidence.authority!=='consumer-data-only'||evidence.sessionId!==owner
            ||!object(evidence.clock)||evidence.clock.encoding!==(evidence.schemaVersion===3
              ?'native-canonical-story-chat-clock-v2':'native-canonical-story-chat-clock-v1')
            ||!same(evidence.policy,evidence.schemaVersion===3?timedPolicyV3:timedPolicyV2))fail('INPUT_MATERIAL_TIMED_EVIDENCE_SCHEMA_INVALID')
          state=migrate(state)
          const {timedReadSha256,...body}=evidence,
            clock=verifyTavernCanonicalChatClock(evidence.clock,owner,publication.event,
              evidence.schemaVersion===3&&prefixFacts.nativeCut?.nativeInputPrefixSha256(Number(evidence.clock.nativeCut))
                ?[]:events(),deps.projections,prefixFacts),core=coreRefsAt(owner,clock.nativeCut),
            audits=evidence.schemaVersion===3
              ?evidence.ownPublicationCount===state.audit.count&&evidence.ownPublicationsSha256===auditSha256(state.audit)
                &&evidence.coreRefCount===core.count&&evidence.coreRefsSha256===auditSha256(core)
              :same(evidence.ownPublications,auditRows(state.audit))&&same(evidence.coreRefs,auditRows(core))
          if(recordSha256(body)!==timedReadSha256||!same(evidence.sourceEpoch,epoch)
            ||!same(evidence.baseline,state.baseline)||!same(evidence.clockTransition,state.clockTransition)
            ||!audits||evidence.ownRevision!==state.revision
            ||evidence.timedSha256!==recordSha256(read.snapshot.timed)||clock.chatIndex!==read.snapshot.timed.chatIndex)
            fail('INPUT_MATERIAL_TIMED_EVIDENCE_CHANGED')
          fullClock={nativeCut:clock.nativeCut,prefixSha256:clock.nativePrefixSha256,chatIndex:clock.chatIndex,
            membershipSha256:clock.membershipSha256,clockSha256:clock.clockSha256}
        }else if(object(evidence)&&evidence.schemaVersion===1&&evidence.encoding==='native-material-lore-timed-read-v1') {
          if(state.mode!=='legacy')fail('INPUT_MATERIAL_TIMED_CLOCK_VERSION_REGRESSION')
          fullClock=fullAt(read)
        }else fail('INPUT_MATERIAL_TIMED_EVIDENCE_UNKNOWN_VERSION')
        const actions=replayTavernTimedPublicationV1(read,state.revision,[...state.intervals.values()])
        for(const [actionIndex,action] of actions.entries()) {
          applyTavernTimedActionV1(state.intervals,action)
          const key=`${action.entryId}:${action.effect}`
          if(action.after) {
            const entry=read.compilation.plan.entries.find(row=>row.entryId===action.entryId)
            if(!entry)fail()
            state.origins.set(key,{ownerSessionId:owner,nativeSeq:Number(publication.event.seq),
              planRef:publication.event.data.plan,actionIndex,sourceEntryId:action.entryId,address:address(entry),
              clockPolicy:state.mode==='legacy'?'legacy-selected-window-v1':'native-canonical-story-chat-clock-v1',fullClock})
          }else state.origins.delete(key)
        }
        state.revision++
        const published=frozen({seq:Number(publication.event.seq),materialSha256:nativeInputSha256(publication.event),
          snapshot:publication.event.data.snapshot,plan:publication.event.data.plan,attemptId:read.plan.attemptId,revision:state.revision})
        const hash=appendDigest(state.audit,published),tail:PublicationLink=Object.freeze({
          previous:state.audit.tail,row:published,planKey:read.planKey,attemptKey:read.attemptKey})
        membership.plans.set(read.planKey,state.audit.count)
        membership.attempts.set(read.attemptKey,{index:state.audit.count,planKey:read.planKey})
        membership.tail=tail
        state.audit={count:state.audit.count+1,hash,tail,membership}
        state.clockTransition=null
        return checkpointState(state)
      }
      const slot=(index:number)=>index<0?`baseline:${purpose}`:`state:${purpose}:${publicationAt(index).event.seq}`
      let prepared:StateCheckpoint
      // This is a latest-position index, not a catalog of old source epochs.
      // Historical facts stay in InputState; a different fold replaces only
      // this shortcut, and must match its complete identity before reuse.
      const last=ownLength-1,cacheKey=`${projectionIdentity}:${owner}`,
        checkpointRead=last<0?historicalRead(slot(-1),[],initialize)
        :historicalRead(slot(last),[publicationAt(last)],()=>{
          const parent=historical(slot(last-1),[],()=>prepared)
          return advance(parent,last)
        },()=>{
          const cached=checkpoints?.get(cacheKey),
            reusable=cached&&cached.identity===purpose&&cached.index<last
              &&publicationAt(cached.index)===cached.publication&&cached.read.current()
          let previous=reusable?cached.read.data:historical(slot(-1),[],initialize)
          for(let index=reusable?cached.index+1:0;index<last;index++) {
            const parent=previous,publication=publicationAt(index)
            previous=historical(slot(index),[publication],()=>{
              // Preparation has already built this exact parent. Read it in
              // the child capture so invalidation retains one real edge.
              const actual=historical(slot(index-1),[],()=>parent)
              return advance(actual,index)
            })
          }
          prepared=previous
        })
      const checkpoint=checkpointRead.data
      if(checkpoints&&last>=0) {
        const previous=checkpoints.get(cacheKey)
        if(!previous||previous.identity!==purpose||previous.index<=last||!previous.read.current())
          checkpoints.set(cacheKey,{identity:purpose,index:last,publication:publicationAt(last),read:checkpointRead})
      }
      const state=restoreState(checkpoint)
      memo.set(key,copyState(state))
      return state
    }finally {reading.delete(owner)}
  }
  const state=migrate(fold(deps.sessionId,deps.clock.data.nativeCut)),
    timed:TavernLoreBranchTimedInputV1=frozen({schemaVersion:1,encoding:'owned-st-branch-timed-input-v1',
      branchId:deps.sessionId,revision:state.revision,chatIndex:deps.clock.data.chatIndex,intervals:[...state.intervals.values()]}),
    compact=deps.clock.data.encoding==='native-canonical-story-chat-clock-v2',
    core=coreRefsAt(deps.sessionId,deps.clock.data.nativeCut),evidence=seal({schemaVersion:compact?3:2,
      encoding:compact?'native-material-lore-timed-read-v3':'native-material-lore-timed-read-v2',authority:'consumer-data-only',
      policy:compact?timedPolicyV3:timedPolicyV2,sessionId:deps.sessionId,
      sourceEpoch:epoch,clock:deps.clock.data,baseline:state.baseline,clockTransition:state.clockTransition,
      ...compact?{ownPublicationCount:state.audit.count,ownPublicationsSha256:auditSha256(state.audit),
        coreRefCount:core.count,coreRefsSha256:auditSha256(core)}
        :{ownPublications:auditRows(state.audit),coreRefs:auditRows(core)},ownRevision:state.revision,
      timedSha256:recordSha256(timed)},'timedReadSha256')
  const assertCurrent=()=>{
    deps.assertOwnerCurrent();deps.assertSourceLineageCurrent()
    deps.ownHistory.assertCurrent();deps.inheritedHistory?.assertCurrent();deps.clock.assertCurrent()
  }
  return {timed,evidence,assertCurrent}
}
