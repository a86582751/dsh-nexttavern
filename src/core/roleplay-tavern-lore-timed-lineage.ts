/** Replays original publication owners at the actual descendant cut, then
 * maps surviving intervals into the child address space. No closure runs and
 * no inherited live injection, timer head or Native capability is restored. */
import {nativeInputSha256} from '@deepseek-ai/dsh-agent-loop'
import type {SessionMessageProjection} from '@deepseek-ai/dsh-session'
import {recordSha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {captureRoleplayTavernMaterialHistoryV1,captureRoleplayTavernInheritedMaterialHistoryV1}
  from './roleplay-tavern-material-history.js'
import {readTavernTimedPublicationV1,replayTavernTimedPublicationV1,applyTavernTimedActionV1}
  from './roleplay-tavern-lore-timed-history.js'
import {readTavernCanonicalChatRowsAtCutV1,verifyTavernCanonicalChatClockV1} from './roleplay-tavern-chat-clock.js'
import type {TavernCanonicalChatClockCaptureV1} from './roleplay-tavern-chat-clock.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernSourceInheritanceOwnerV1} from './roleplay-tavern-source-inheritance-types.js'
import type {TavernLoreCompilationV1,TavernLoreEntryPlanV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreBranchTimedInputV1} from './tavern-lore-evaluator-types.mjs'

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
  mode:'legacy'|'full';publications:readonly Record<string,unknown>[];baseline:Record<string,unknown>;
  clockTransition:Record<string,unknown>|null
}
interface Dependencies {
  readonly sessionId:string
  readonly source:TavernLoreSourceDataV1
  readonly compilation:Extract<TavernLoreCompilationV1,{kind:'compiled'}>
  readonly ownHistory:ReturnType<typeof captureRoleplayTavernMaterialHistoryV1>
  readonly inheritedHistory?:ReturnType<typeof captureRoleplayTavernInheritedMaterialHistoryV1>
  readonly sourceLineage?:ReturnType<TavernSourceInheritanceOwnerV1['readCommittedSourceLineage']>
  readonly clock:TavernCanonicalChatClockCaptureV1
  readonly projections:readonly SessionMessageProjection[]
  readonly assertOwnerCurrent:()=>void
  readonly assertSourceLineageCurrent:()=>void
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const timedPolicyV2=Object.freeze({publication:'first-actual-Native-required-material-per-plan',
  retry:'same-plan-zero-actions',inheritance:'original-owner-at-actual-cut-then-unique-original-entry-address-map',
  liveInjection:'own-registration-only',clock:'native-canonical-story-chat-clock-v1'})
const timedEvidenceFieldsV2=['schemaVersion','encoding','authority','policy','sessionId','sourceEpoch','clock',
  'baseline','clockTransition','ownPublications','ownRevision','coreRefs','timedSha256','timedReadSha256'].sort()
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
  mode:state.mode,intervals:[...state.intervals.values()],origins:[...state.origins],publications:state.publications})
const copyState=(state:State):State=>({...state,intervals:new Map(state.intervals),origins:new Map(state.origins)})

export function captureRoleplayTavernTimedHistoryV2(deps:Dependencies) {
  deps.assertOwnerCurrent()
  const epoch=epochOf(deps.source),epochSha256=recordSha256(epoch),events=deps.ownHistory.events,
    publications=[...(deps.inheritedHistory?.publications??[]),...deps.ownHistory.publications],
    transactions=new Map<string,Transaction>(),memo=new Map<string,State>(),reading=new Set<string>(),
    fullClocks=new Map<number,OriginV1['fullClock']>(),reads=new Map<Publication,Read>()
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
  let previous=-1
  for(const publication of publications) {
    if(publication.event.seq<=previous||!allowed.has(publication.snapshot.sessionId))fail()
    previous=publication.event.seq
    reads.set(publication,readTavernTimedPublicationV1(publication,publication.snapshot.sessionId))
  }
  // A material read captures every Core reference at the owner cut, including
  // prior Source epochs. Filtering only timer-producing rows would let a cold
  // reader accept an incomplete input catalog under a newly recomputed hash.
  function coreRefsAt(owner:string,cut:number) {
    const inheritedCut=transactions.get(owner)?.prepared.nativeCut.seedLength??0,
      refs=new Map<string,string>()
    for(const publication of publications) {
      if(publication.event.seq>=cut)break
      if(publication.snapshot.sessionId!==owner&&publication.event.seq>=inheritedCut)continue
      for(const ref of [publication.event.data.snapshot,publication.event.data.plan]) {
        const prior=refs.get(ref.key)
        if(prior&&prior!==ref.sha256)fail('INPUT_MATERIAL_TIMED_CORE_REF_CONFLICT')
        refs.set(ref.key,ref.sha256)
      }
    }
    return [...refs].map(([key,sha256])=>({key,sha256}))
  }
  const knownEntries=new Map(deps.compilation.plan.entries.map(entry=>[address(entry).addressSha256,address(entry)]))
  function fullAt(read:Read):OriginV1['fullClock'] {
    const seq=Number(read.publication.event.seq),existing=fullClocks.get(seq)
    if(existing)return existing
    const rows=readTavernCanonicalChatRowsAtCutV1(read.plan.sessionId,events,seq,deps.projections),
      full={nativeCut:seq,prefixSha256:nativeInputSha256(events.slice(0,seq)),chatIndex:rows.length,
        membershipSha256:recordSha256(rows.map(row=>row.ref)),clockSha256:null}
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
      inheritedCut:cut,inheritedPrefixSha256:nativeInputSha256(events.slice(0,cut)),
      parentFold:null,entryMappings:[],intervals:[],intervalOrigins:[],clockTransition:null},'baselineSha256')
  }
  function fold(owner:string,cut:number):State {
    const key=`${owner}:${epochSha256}:${cut}`,cached=memo.get(key)
    if(cached)return copyState(cached)
    if(reading.has(owner)||reading.size>=32||memo.size>=96)fail('INPUT_MATERIAL_TIMED_LINEAGE_BUDGET')
    reading.add(owner)
    try {
      const transaction=transactions.get(owner),own=publications.filter(pub=>pub.snapshot.sessionId===owner
        &&pub.event.seq<cut&&same(publicationEpoch(reads.get(pub)!),epoch)),
        firstEvidence=own[0]?.snapshot.payload.timed,
        historicalLegacy=object(firstEvidence)&&firstEvidence.encoding==='native-material-lore-timed-read-v1'
      let intervals=new Map<string,Interval>(),origins=new Map<string,OriginV1>(),baseline:Record<string,unknown>,
        mode:State['mode']=historicalLegacy?'legacy':'full'
      if(historicalLegacy)baseline=emptyBaseline(owner,'historical-own-v1-empty-policy',0,transaction)
      // Replay the original owner's producer baseline. The current reader may
      // be a descendant, but that cannot change a persisted parent's identity.
      else if(!transaction)baseline=emptyBaseline(owner,'verified-own-source-epoch',0)
      else if(!same(epochOf(transaction.prepared.parentSource),epoch))
        baseline=emptyBaseline(owner,'source-epoch-changed-at-birth',Math.min(cut,transaction.prepared.nativeCut.seedLength),transaction)
      else if(transaction.prepared.nativeCut.kind==='reserved-fresh-branch')
        baseline=emptyBaseline(owner,'actual-fresh-cut-zero',0,transaction)
      else {
        const inheritedCut=Math.min(cut,transaction.prepared.nativeCut.seedLength),
          parent=migrate(fold(transaction.prepared.parentSessionId,inheritedCut)),mapped=mapParent(parent,owner)
        intervals=mapped.intervals;origins=mapped.origins
        baseline=seal({schemaVersion:1,encoding:'native-material-lore-timed-baseline-v1',kind:'frozen-inherited',
          ownerSessionId:owner,sourceEpochSha256:epochSha256,
          sourceRefs:{prepared:transaction.inheritance.preparedRef,commit:transaction.inheritance.commitRef,
            ready:transaction.inheritance.readyRef,materialBaseline:transaction.inheritance.materialBaselineRef},
          inheritedCut,inheritedPrefixSha256:nativeInputSha256(events.slice(0,inheritedCut)),
          parentFold:{ownerSessionId:parent.ownerSessionId,revision:parent.revision,stateSha256:stateDigest(parent),
            publicationsSha256:recordSha256(parent.publications)},entryMappings:mapped.mappings,
          intervals:[...intervals.values()],intervalOrigins:[...origins],clockTransition:parent.clockTransition},'baselineSha256')
      }
      let state:State={ownerSessionId:owner,revision:0,intervals,origins,mode,publications:[],baseline,clockTransition:null}
      const seenPlans=new Set<string>(),seenAttempts=new Map<string,string>(),published:Record<string,unknown>[]=[]
      for(const publication of own) {
        const read=reads.get(publication)!,evidence=publication.snapshot.payload.timed
        if(seenPlans.has(read.planKey))continue
        seenPlans.add(read.planKey)
        const prior=seenAttempts.get(read.attemptKey)
        if(prior&&prior!==read.planKey)fail('INPUT_MATERIAL_TIMED_ATTEMPT_PLAN_CONFLICT')
        seenAttempts.set(read.attemptKey,read.planKey)
        let fullClock:OriginV1['fullClock']
        if(object(evidence)&&evidence.schemaVersion===2&&evidence.encoding==='native-material-lore-timed-read-v2') {
          if(!same(Object.keys(evidence).sort(),timedEvidenceFieldsV2)
            ||evidence.authority!=='consumer-data-only'||evidence.sessionId!==owner
            ||!same(evidence.policy,timedPolicyV2))fail('INPUT_MATERIAL_TIMED_EVIDENCE_SCHEMA_INVALID')
          state=migrate(state)
          const {timedReadSha256,...body}=evidence,
            clock=verifyTavernCanonicalChatClockV1(evidence.clock,owner,publication.event,events,deps.projections)
          if(recordSha256(body)!==timedReadSha256||!same(evidence.sourceEpoch,epoch)
            ||!same(evidence.baseline,baseline)||!same(evidence.clockTransition,state.clockTransition)
            ||!same(evidence.ownPublications,published)||evidence.ownRevision!==state.revision
            ||!same(evidence.coreRefs,coreRefsAt(owner,clock.nativeCut))
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
        published.push({seq:Number(publication.event.seq),materialSha256:nativeInputSha256(publication.event),
          snapshot:publication.event.data.snapshot,plan:publication.event.data.plan,attemptId:read.plan.attemptId,revision:state.revision})
        state.publications=[...published]
        state.clockTransition=null
      }
      memo.set(key,copyState(state))
      return state
    }finally {reading.delete(owner)}
  }
  const state=migrate(fold(deps.sessionId,deps.clock.data.nativeCut)),
    timed:TavernLoreBranchTimedInputV1=frozen({schemaVersion:1,encoding:'owned-st-branch-timed-input-v1',
      branchId:deps.sessionId,revision:state.revision,chatIndex:deps.clock.data.chatIndex,intervals:[...state.intervals.values()]}),
    evidence=seal({schemaVersion:2,encoding:'native-material-lore-timed-read-v2',authority:'consumer-data-only',
      policy:timedPolicyV2,sessionId:deps.sessionId,
      sourceEpoch:epoch,clock:deps.clock.data,baseline:state.baseline,clockTransition:state.clockTransition,
      ownPublications:state.publications,ownRevision:state.revision,
      coreRefs:coreRefsAt(deps.sessionId,deps.clock.data.nativeCut),
      timedSha256:recordSha256(timed)},'timedReadSha256')
  const assertCurrent=()=>{
    deps.assertOwnerCurrent();deps.assertSourceLineageCurrent()
    deps.ownHistory.assertCurrent();deps.inheritedHistory?.assertCurrent();deps.clock.assertCurrent()
  }
  assertCurrent()
  return {timed,evidence,assertCurrent}
}
