/** Detached numerical prompt facts. This formatter owns no table, Agent,
 * Source lease, Native permission or reducer. Only the existing state/derived
 * readers collect its inputs after their complete authoritative fold succeeds. */
import {types as nodeTypes} from 'node:util'
import {recordSha256,sha256} from './roleplay-data.js'
import type {MvuNumericalSnapshot,MvuStateTerminalIntent,MvuStatePublisherSettlement,
  VerifiedMvuGenesis,VerifiedMvuDerivedGenesis}
  from './roleplay-mvu-state.js'
import type {MvuPlayerStatePublisherSettlement} from './roleplay-mvu-player-records.js'
import type {MvuPrefixLedgerProof,MvuPrefixLedgerStep,MvuPrefixLedgerPlayerStep}
  from './roleplay-mvu-prefix-ledger.js'
import type {MvuDerivedSourceProof} from './roleplay-mvu-lineage.js'
import type {MvuDerivedSourceProofUnion} from './roleplay-mvu-frozen-lineage.js'
import type {OpeningSource} from './roleplay-opening-selection.js'
import type {MvuInitializationEvent,MvuInitializationHead} from './roleplay-mvu-initialization.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import {validateProgramMvuGenesisFactsV1} from './roleplay-program-genesis-data.js'
import type {VerifiedMvuProgramGenesis} from './roleplay-program-genesis-types.js'
import {mvuInitializationEventKey,mvuInitializationHeadKey} from './roleplay-mvu-initialization.js'
import {programOpeningSeedKeyV1,programOpeningInputKeyV1,programOpeningPlanKeyV1,
  validateProgramOpeningSeedV1,validateProgramOpeningInputV1,validateProgramOpeningPlanRecordV1,
  validateOpeningIntentV7} from './roleplay-program-opening-records.js'
import type {ProgramOpeningIntentSeedV1,ProgramOpeningInputPacketV1,ProgramOpeningPlanRecordV1,OpeningIntentV7}
  from './roleplay-program-opening-records.js'
import {openingIntentKey} from './roleplay-opening-selection.js'

// Recursive JSON is already purpose-cloned and deeply frozen at runtime.
// Keep its type as a readonly index to avoid infinitely expanding the JSON
// union while comparing factual snapshots; outer protocol fields stay readonly.
type Immutable<T>=T extends MvuJsonObject?Readonly<T>:T extends object?{readonly [K in keyof T]:Immutable<T[K]>}:T
type Genesis=VerifiedMvuGenesis|VerifiedMvuDerivedGenesis
type Settlement=MvuStatePublisherSettlement|MvuPlayerStatePublisherSettlement
export const MVU_PROMPT_FACTS_BOUNDS=Object.freeze({bytes:16_777_216,nodes:512_000,depth:96,
  arrayLength:32_000,publications:8192,snapshots:8192,inventory:16_384,layers:32})
export class MvuPromptFactsRefusal extends Error {
  constructor(readonly code:string){super(code)}
}
function fail(code:string):never {throw new MvuPromptFactsRefusal(code)}
const equal=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
export interface MvuPromptRowRefV1 {
  readonly table:'branch'|'status'
  readonly key:string
  readonly recordSha256:string
  readonly fieldPointer?:string
}
export interface MvuPromptInventoryV1 {
  readonly scope:'complete-owned-current-status'|'closed-inherited-numerical-cut'
  readonly rows:readonly MvuPromptRowRefV1[]
  readonly membershipSha256:string
}
export interface MvuPromptStoryPublicationV1 {
  readonly kind:'story'
  readonly ownerSessionId:string
  readonly numericalSourceSha256:string
  readonly canonical:Immutable<MvuStateTerminalIntent['canonical']>
  readonly intent:Immutable<MvuStateTerminalIntent>
  readonly intentRecordSha256:string
  readonly preparationSnapshot:{readonly key:string;readonly recordSha256:string}
  readonly completedReceiptSha256:string
  readonly settlement:{readonly key:string;readonly recordSha256:string;readonly settlementSha256:string}
  readonly outcome:'updated'|'no-update'
  readonly baseSnapshotSha256:string
  readonly resultSnapshotSha256:string
  /** Present only when the existing closed prefix fold supplied these actual refs. */
  readonly ledgerStep?:Immutable<MvuPrefixLedgerStep>
}
export interface MvuPromptManualPublicationV1 {
  readonly kind:'manual'
  readonly ownerSessionId:string
  readonly numericalSourceSha256:string
  readonly operationId:string
  readonly operation:{readonly key:string;readonly recordSha256:string}
  readonly marker:{readonly seq:number;readonly eventRecordSha256:string}
  readonly intentSha256:string
  readonly intentRecordSha256:string
  readonly settlement:{readonly key:string;readonly recordSha256:string;readonly settlementSha256:string}
  readonly outcome:'updated'|'no-update'
  readonly baseSnapshotSha256:string
  readonly resultSnapshotSha256:string
  readonly ledgerStep?:Immutable<MvuPrefixLedgerPlayerStep>
}
export interface MvuPromptLocalNumericalFactsV1 {
  readonly schemaVersion:1
  readonly encoding:'native-json-prompt-numerical-facts-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  /** Current numerical input-policy identity. This is not the Lore SHA domain. */
  readonly numericalSourceSha256:string
  readonly genesis:Immutable<Genesis>
  readonly genesisSnapshotSha256:string
  readonly genesisMessageRef:{readonly ownerSessionId:string;readonly seq:number;readonly messageId:string;
    readonly nativeEventRecordSha256:string;readonly renderedTextSha256:string}|null
  readonly sourceIdentity:{readonly kind:'opening';readonly original:Immutable<OpeningSource>}
    |{readonly kind:'derived-basis';readonly basisSha256:string;readonly derivedEventSha256:string}
  readonly currentSnapshot:Immutable<MvuNumericalSnapshot>
  readonly snapshots:readonly Immutable<MvuNumericalSnapshot>[]
  readonly storyPublications:readonly MvuPromptStoryPublicationV1[]
  readonly manualPublications:readonly MvuPromptManualPublicationV1[]
  readonly inventory:MvuPromptInventoryV1
  readonly factsSha256:string
}
/** Explicit program protocol. Its full genesis retains the actual plan's
 * Source/raw calculation/basis, Native envelope, embedded opening settlement
 * and final values. This packet is readonly evidence, never a renderer token. */
export interface MvuPromptLocalNumericalFactsV2 {
  readonly schemaVersion:2
  readonly encoding:'native-program-json-prompt-numerical-facts-v2'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly numericalSourceSha256:string
  readonly genesis:Immutable<VerifiedMvuProgramGenesis>
  readonly genesisSnapshotSha256:string
  readonly genesisMessageRef:{readonly ownerSessionId:string;readonly seq:number;readonly messageId:string;
    readonly nativeEventRecordSha256:string;readonly renderedTextSha256:string}
  readonly sourceIdentity:{readonly kind:'program-opening';readonly original:Immutable<OpeningSource>;
    readonly sourceProofSha256:string;readonly basisSha256:string;readonly planSha256:string}
  readonly genesisRefs:{readonly event:MvuPromptRowRefV1;readonly head:MvuPromptRowRefV1}
  readonly currentSnapshot:Immutable<MvuNumericalSnapshot>
  readonly snapshots:readonly Immutable<MvuNumericalSnapshot>[]
  readonly storyPublications:readonly MvuPromptStoryPublicationV1[]
  readonly manualPublications:readonly MvuPromptManualPublicationV1[]
  readonly inventory:MvuPromptInventoryV1
  readonly factsSha256:string
}
export interface MvuPromptPrefixNumericalFactsV1 {
  readonly schemaVersion:1
  readonly encoding:'native-json-prompt-prefix-facts-v1'
  readonly authority:'consumer-data-only'
  readonly ownerSessionId:string
  readonly ownerInheritedEventCount:number
  readonly inheritedPrefixLength:number
  readonly historyPrefixSha256:string
  readonly numericalSourceSha256:string
  readonly ledgerProofSha256:string
  readonly genesisSnapshotSha256:string
  readonly resultSnapshotSha256:string
  readonly snapshots:readonly Immutable<MvuNumericalSnapshot>[]
  readonly storyPublications:readonly MvuPromptStoryPublicationV1[]
  readonly manualPublications:readonly MvuPromptManualPublicationV1[]
  readonly inventory:MvuPromptInventoryV1
  readonly factsSha256:string
  readonly inputClosure?:MvuPromptRowRefV1&{readonly closureSha256:string}
}
export interface MvuPromptOpeningPublicationV1 {
  readonly kind:'opening'
  readonly ownerSessionId:string
  readonly canonical:Immutable<MvuStateTerminalIntent['canonical']>
  /** Explicitly separate event-record identity from canonical message identity. */
  readonly nativeEventRecordSha256:string
  readonly initializationEvent:Immutable<MvuInitializationEvent>
  readonly initializationHead:Immutable<MvuInitializationHead>
  readonly initializationIntent:MvuPromptRowRefV1
  readonly source:Immutable<OpeningSource>
  readonly selectedSwipeIdentity:string
  readonly resultSnapshotSha256:string
}
export interface MvuPromptInheritedLayerV1 {
  readonly parentSessionId:string
  readonly childSessionId:string
  readonly source:Immutable<MvuDerivedSourceProofUnion>
  readonly basis:MvuPromptRowRefV1&{readonly basisSha256:string}
  readonly prepared:MvuPromptRowRefV1&{readonly preparedSha256:string}
  readonly derivedEvent:MvuPromptRowRefV1
  readonly derivedHead:MvuPromptRowRefV1
  readonly operation:MvuPromptRowRefV1
  readonly prefixFactsSha256:string
  readonly ledgerProofSha256:string
  readonly parentInheritedEventCount:number
  readonly inheritedPrefixLength:number
  readonly historyPrefixSha256:string
}
export interface MvuPromptInheritedNumericalFactsV1 {
  readonly schemaVersion:1
  readonly encoding:'native-json-prompt-inherited-facts-v1'
  readonly authority:'consumer-data-only'
  readonly childSessionId:string
  readonly numericalSourceSha256:string
  readonly genesis:Immutable<VerifiedMvuDerivedGenesis>
  readonly source:Immutable<MvuDerivedSourceProofUnion>
  readonly originalImport:Immutable<MvuDerivedSourceProof['originalImport']>
  readonly layers:readonly MvuPromptInheritedLayerV1[]
  readonly snapshots:readonly Immutable<MvuNumericalSnapshot>[]
  readonly openingPublications:readonly MvuPromptOpeningPublicationV1[]
  readonly storyPublications:readonly MvuPromptStoryPublicationV1[]
  readonly manualPublications:readonly MvuPromptManualPublicationV1[]
  readonly inventory:MvuPromptInventoryV1
  readonly factsSha256:string
}
export type MvuPromptFactCaptureV1<T>={readonly kind:'ready';readonly data:T;readonly current:()=>boolean}
  |{readonly kind:'unavailable';readonly code:string}
export interface MvuPromptValidatedStoryInputV1 {
  readonly settlement:MvuStatePublisherSettlement
  readonly base:MvuNumericalSnapshot
  readonly result:MvuNumericalSnapshot
  readonly ledgerStep?:MvuPrefixLedgerStep
  readonly frozenCanonical?:MvuStateTerminalIntent['canonical']
}
export interface MvuPromptValidatedManualInputV1 {
  readonly settlement:MvuPlayerStatePublisherSettlement
  readonly base:MvuNumericalSnapshot
  readonly result:MvuNumericalSnapshot
  readonly ledgerStep?:MvuPrefixLedgerPlayerStep
}
export interface MvuPromptValidatedOpeningInputV1 {
  readonly genesis:VerifiedMvuGenesis
  readonly snapshot:MvuNumericalSnapshot
  readonly canonical:MvuStateTerminalIntent['canonical']
  readonly nativeEventRecordSha256:string
  readonly intent:MvuPromptRowRefV1
  readonly historical?:{readonly event:MvuPromptRowRefV1;readonly head:MvuPromptRowRefV1}
}

/** An actual reader supplies original packet refs separately from the frozen
 * prepared archive ref. Neither checksum authorizes a historical lookup. */
export interface MvuPromptProgramOpeningRefsV1 {
  readonly seed:MvuPromptRowRefV1
  readonly input:MvuPromptRowRefV1
  readonly plan:MvuPromptRowRefV1
  readonly intent:MvuPromptRowRefV1
  readonly genesisEvent:MvuPromptRowRefV1
  readonly genesisHead:MvuPromptRowRefV1
}
export interface MvuPromptValidatedProgramOpeningInputV1 {
  readonly genesis:Immutable<VerifiedMvuProgramGenesis>
  readonly snapshot:MvuNumericalSnapshot
  readonly canonical:MvuStateTerminalIntent['canonical']
  readonly nativeEventRecordSha256:string
  readonly closureRef:MvuPromptRowRefV1
  readonly refs:MvuPromptProgramOpeningRefsV1
  readonly packets:{readonly seed:Immutable<ProgramOpeningIntentSeedV1>;readonly input:Immutable<ProgramOpeningInputPacketV1>;
    readonly plan:Immutable<ProgramOpeningPlanRecordV1>;readonly intent:Immutable<OpeningIntentV7>}
}
export interface MvuPromptProgramOpeningPublicationV1 {
  readonly kind:'program-opening'
  readonly ownerSessionId:string
  readonly numericalSourceSha256:string
  readonly canonical:Immutable<MvuStateTerminalIntent['canonical']>
  readonly nativeEventRecordSha256:string
  readonly genesis:Immutable<VerifiedMvuProgramGenesis>
  readonly snapshot:Immutable<MvuNumericalSnapshot>
  readonly source:Immutable<VerifiedMvuProgramGenesis['programEvent']['plan']['source']>
  readonly basis:Immutable<VerifiedMvuProgramGenesis['programEvent']['plan']['basis']>
  readonly native:Immutable<VerifiedMvuProgramGenesis['programEvent']['native']>
  readonly openingSettlement:Immutable<VerifiedMvuProgramGenesis['programEvent']['openingSettlement']>
  readonly originalPacketRefs:MvuPromptProgramOpeningRefsV1
  readonly originalPackets:Immutable<MvuPromptValidatedProgramOpeningInputV1['packets']>
  readonly archiveProvenance:MvuPromptRowRefV1
  readonly resultSnapshotSha256:string
}
/** This third domain keeps the existing initialization/copy publication
 * grammar distinct from a protected program opening and its terminal body. */
export interface MvuPromptInheritedNumericalFactsV2 extends Omit<MvuPromptInheritedNumericalFactsV1,
  'schemaVersion'|'encoding'|'factsSha256'> {
  readonly schemaVersion:2
  readonly encoding:'native-program-json-prompt-inherited-facts-v2'
  readonly programOpeningPublications:readonly MvuPromptProgramOpeningPublicationV1[]
  readonly factsSha256:string
}

/** Facts use one bounded detached pool, not a fresh values copy per no-update
 * publication. This budget is for the ephemeral whole fact view, unlike the
 * existing per-persisted-record authority budgets; it cannot truncate to absent. */
function frozenFacts<T>(input:T):Immutable<T> {
  let nodes=0,bytes=0
  const ancestors=new Set<object>(),copies=new WeakMap<object,unknown>()
  function copy(value:unknown,depth:number):unknown {
    if(++nodes>MVU_PROMPT_FACTS_BOUNDS.nodes||depth>MVU_PROMPT_FACTS_BOUNDS.depth)fail('PROMPT_NUMERICAL_FACTS_LIMIT')
    if(value===null||typeof value==='boolean')return value
    if(typeof value==='number') {
      if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)fail('PROMPT_NUMERICAL_FACTS_INVALID')
      return Object.is(value,-0)?0:value
    }
    if(typeof value==='string') {
      bytes+=Buffer.byteLength(value,'utf8')
      if(bytes>MVU_PROMPT_FACTS_BOUNDS.bytes)fail('PROMPT_NUMERICAL_FACTS_LIMIT')
      return value
    }
    if(!value||typeof value!=='object'||ancestors.has(value)||nodeTypes.isProxy(value))fail('PROMPT_NUMERICAL_FACTS_INVALID')
    const previous=copies.get(value)
    if(previous)return previous
    const list=Array.isArray(value),prototype=Object.getPrototypeOf(value),props=Object.getOwnPropertyDescriptors(value)
    if(list?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)fail('PROMPT_NUMERICAL_FACTS_INVALID')
    const names=Reflect.ownKeys(props)
    if(names.some(name=>typeof name!=='string'))fail('PROMPT_NUMERICAL_FACTS_INVALID')
    const result:unknown[]|Record<string,unknown>=list?[]:Object.create(null)
    copies.set(value,result);ancestors.add(value)
    if(list) {
      const length=props.length?.value as unknown
      if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0||length>MVU_PROMPT_FACTS_BOUNDS.arrayLength
        ||names.length!==length+1)fail('PROMPT_NUMERICAL_FACTS_INVALID')
      for(let i=0;i<length;i++) {
        const property=props[String(i)]
        if(!property||!Object.hasOwn(property,'value')||!property.enumerable)fail('PROMPT_NUMERICAL_FACTS_INVALID')
        ;(result as unknown[]).push(copy(property.value,depth+1))
      }
    }else for(const name of names as string[]) {
      const property=props[name]!
      if(['__proto__','constructor','prototype'].includes(name)||!Object.hasOwn(property,'value')||!property.enumerable) {
        fail('PROMPT_NUMERICAL_FACTS_INVALID')
      }
      bytes+=Buffer.byteLength(name,'utf8')
      if(bytes>MVU_PROMPT_FACTS_BOUNDS.bytes)fail('PROMPT_NUMERICAL_FACTS_LIMIT')
      ;(result as Record<string,unknown>)[name]=copy(property.value,depth+1)
    }
    ancestors.delete(value);return Object.freeze(result)
  }
  const value=copy(input,0)
  // Include repeated JSON references, escaping, keys and metadata amplification.
  if(Buffer.byteLength(JSON.stringify(value),'utf8')>MVU_PROMPT_FACTS_BOUNDS.bytes)fail('PROMPT_NUMERICAL_FACTS_LIMIT')
  return value as Immutable<T>
}
function inventory(scope:MvuPromptInventoryV1['scope'],input:readonly MvuPromptRowRefV1[]):MvuPromptInventoryV1 {
  const known=new Map<string,MvuPromptRowRefV1>()
  for(const row of input) {
    const normalized={table:row.table,key:row.key,recordSha256:row.recordSha256,
      ...(row.fieldPointer?{fieldPointer:row.fieldPointer}:{})}
    const key=`${row.table}:${row.key}${row.fieldPointer?':'+row.fieldPointer:''}`,old=known.get(key)
    if(old&&!equal(old,normalized))fail('PROMPT_NUMERICAL_FACT_CONFLICT')
    known.set(key,normalized)
  }
  if(known.size>MVU_PROMPT_FACTS_BOUNDS.inventory)fail('PROMPT_NUMERICAL_FACTS_LIMIT')
  const rows=[...known.values()].sort((a,b)=>{
    const left=`${a.table}:${a.key}${a.fieldPointer?':'+a.fieldPointer:''}`,
      right=`${b.table}:${b.key}${b.fieldPointer?':'+b.fieldPointer:''}`
    return left===right?0:left<right?-1:1
  })
  return {scope,rows,membershipSha256:recordSha256(rows)}
}
function snapshots(input:readonly Immutable<MvuNumericalSnapshot>[]):Immutable<MvuNumericalSnapshot>[] {
  const known=new Map<string,Immutable<MvuNumericalSnapshot>>()
  for(const row of input) {
    const {stateSnapshotSha256,...body}=row
    if(recordSha256(body)!==stateSnapshotSha256||recordSha256(row.values)!==row.valuesSha256
      ||recordSha256(row.currentHead)!==row.headSha256)fail('PROMPT_NUMERICAL_RESULT_INVALID')
    const old=known.get(stateSnapshotSha256)
    if(old&&!equal(old,row))fail('PROMPT_NUMERICAL_FACT_CONFLICT')
    known.set(stateSnapshotSha256,row)
  }
  if(known.size>MVU_PROMPT_FACTS_BOUNDS.snapshots)fail('PROMPT_NUMERICAL_FACTS_LIMIT')
  return [...known.values()].sort((a,b)=>a.stateSnapshotSha256<b.stateSnapshotSha256?-1:1)
}
function resultMatches(settlement:Settlement,base:MvuNumericalSnapshot,result:MvuNumericalSnapshot) {
  if(base.sessionId!==settlement.sessionId||result.sessionId!==settlement.sessionId
    ||base.sourceSha256!==settlement.sourceSha256||result.sourceSha256!==settlement.sourceSha256
    ||base.stateSnapshotSha256!==settlement.intent.base.stateSnapshotSha256
    ||!equal(result.root,base.root)||!equal(result.currentHead,settlement.result.head)
    ||result.headSha256!==settlement.result.headSha256||result.revision!==settlement.result.revision
    ||result.valuesSha256!==settlement.result.valuesSha256)fail('PROMPT_NUMERICAL_RESULT_INVALID')
}
function story(input:MvuPromptValidatedStoryInputV1):MvuPromptStoryPublicationV1 {
  const {settlement,base,result,ledgerStep}=input,intent=settlement.intent
  const canonical=input.frozenCanonical??intent.canonical
  if(!equal(canonical,intent.canonical))fail('PROMPT_NUMERICAL_CANONICAL_INVALID')
  resultMatches(settlement,base,result)
  const row:MvuPromptStoryPublicationV1={kind:'story',ownerSessionId:settlement.sessionId,
    numericalSourceSha256:settlement.sourceSha256,canonical,intent,
    intentRecordSha256:recordSha256(intent),preparationSnapshot:{key:intent.preparationSnapshot.key,
      recordSha256:intent.preparationSnapshot.sha256},completedReceiptSha256:settlement.completedReceiptSha256,
    settlement:{key:`${settlement.sessionId}__mvu-state-settlement-${intent.intentSha256}`,
      recordSha256:recordSha256(settlement),settlementSha256:settlement.settlementSha256},outcome:settlement.outcome,
    baseSnapshotSha256:base.stateSnapshotSha256,resultSnapshotSha256:result.stateSnapshotSha256,
    ...ledgerStep?{ledgerStep}:{}}
  if(ledgerStep&&(ledgerStep.intentSha256!==intent.intentSha256||ledgerStep.baseSnapshotSha256!==row.baseSnapshotSha256
    ||ledgerStep.resultSnapshotSha256!==row.resultSnapshotSha256))fail('PROMPT_NUMERICAL_RESULT_INVALID')
  return row
}
function manual(input:MvuPromptValidatedManualInputV1):MvuPromptManualPublicationV1 {
  const {settlement,base,result,ledgerStep}=input,intent=settlement.intent
  resultMatches(settlement,base,result)
  return {kind:'manual',ownerSessionId:settlement.sessionId,numericalSourceSha256:settlement.sourceSha256,
    operationId:intent.operationId,operation:{key:intent.operation.key,recordSha256:intent.operation.sha256},
    marker:{seq:intent.marker.seq,eventRecordSha256:intent.marker.sha256},intentSha256:intent.intentSha256,
    intentRecordSha256:recordSha256(intent),settlement:{key:`${settlement.sessionId}__mvu-state-settlement-${intent.intentSha256}`,
      recordSha256:recordSha256(settlement),settlementSha256:settlement.settlementSha256},outcome:settlement.outcome,
    baseSnapshotSha256:base.stateSnapshotSha256,resultSnapshotSha256:result.stateSnapshotSha256,
    ...ledgerStep?{ledgerStep}:{}}
}
const storyKey=(row:MvuPromptStoryPublicationV1)=>`${row.ownerSessionId}:${row.canonical.seq}:${row.canonical.messageId}:${row.canonical.versionSha256}`
function uniqueStories(input:readonly MvuPromptStoryPublicationV1[]) {
  const known=new Map<string,MvuPromptStoryPublicationV1>()
  for(const row of input) {
    const key=storyKey(row),old=known.get(key)
    if(old&&!equal(old,row))fail('PROMPT_NUMERICAL_FACT_CONFLICT')
    known.set(key,row)
  }
  if(known.size>MVU_PROMPT_FACTS_BOUNDS.publications)fail('PROMPT_NUMERICAL_FACTS_LIMIT')
  return [...known.values()].sort((a,b)=>a.canonical.seq-b.canonical.seq
    ||(storyKey(a)===storyKey(b)?0:storyKey(a)<storyKey(b)?-1:1))
}
function uniqueManual(input:readonly MvuPromptManualPublicationV1[]) {
  const known=new Map<string,MvuPromptManualPublicationV1>()
  for(const row of input) {
    const key=`${row.ownerSessionId}:${row.intentSha256}`,old=known.get(key)
    if(old&&!equal(old,row))fail('PROMPT_NUMERICAL_FACT_CONFLICT')
    known.set(key,row)
  }
  if(known.size>MVU_PROMPT_FACTS_BOUNDS.publications)fail('PROMPT_NUMERICAL_FACTS_LIMIT')
  return [...known.values()].sort((a,b)=>a.marker.seq-b.marker.seq
    ||(a.intentSha256===b.intentSha256?0:a.intentSha256<b.intentSha256?-1:1))
}
interface LocalFoldFacts {
  readonly state:MvuNumericalSnapshot
  readonly states:ReadonlyMap<string,MvuNumericalSnapshot>
  readonly settlements:ReadonlyMap<string,Settlement>
  readonly rows:ReadonlyMap<string,unknown>
}
/** Both packet versions consume the same already validated state fold. Keep
 * story/manual association and ordering strict rather than creating a second
 * program-only publication interpretation. */
function localPublications(input:LocalFoldFacts) {
  const {states,settlements}=input
  const stories:MvuPromptStoryPublicationV1[]=[],manuals:MvuPromptManualPublicationV1[]=[]
  for(const settlement of settlements.values()) {
    const base=states.get(settlement.intent.base.headSha256),result=states.get(settlement.result.headSha256)
    if(!base||!result)fail('PROMPT_NUMERICAL_RESULT_INVALID')
    if(settlement.encoding==='native-mvu-state-publisher-settlement-v1')stories.push(story({settlement,base,result}))
    else manuals.push(manual({settlement,base,result}))
  }
  return {stories,manuals}
}
export function formatLocalMvuPromptFactsV1(input:LocalFoldFacts&{genesis:Genesis})
  :MvuPromptLocalNumericalFactsV1 {
  const {genesis,state,states,rows}=input,initial=[...states.values()].find(row=>row.revision===1)
  if(!initial)fail('PROMPT_NUMERICAL_RESULT_INVALID')
  const {stories,manuals}=localPublications(input)
  const opening='initEvent' in genesis?genesis.initEvent:undefined
  const body={schemaVersion:1 as const,encoding:'native-json-prompt-numerical-facts-v1' as const,
    authority:'consumer-data-only' as const,sessionId:state.sessionId,numericalSourceSha256:state.sourceSha256,
    genesis,genesisSnapshotSha256:initial.stateSnapshotSha256,genesisMessageRef:opening?{
      ownerSessionId:genesis.sessionId,seq:opening.native.assistantSeq,messageId:opening.native.messageId,
      nativeEventRecordSha256:opening.native.messageVersion.eventSha256,renderedTextSha256:opening.native.renderedSha256}:null,
    sourceIdentity:opening?{kind:'opening' as const,original:opening.plan.identity.source}:
      {kind:'derived-basis' as const,basisSha256:(genesis as VerifiedMvuDerivedGenesis).derivedEvent.basisSha256,
        derivedEventSha256:(genesis as VerifiedMvuDerivedGenesis).derivedEvent.eventSha256},
    currentSnapshot:state,snapshots:snapshots([...states.values()]),storyPublications:uniqueStories(stories),
    manualPublications:uniqueManual(manuals),inventory:inventory('complete-owned-current-status',
      [...rows].map(([key,value])=>({table:'status' as const,key,recordSha256:recordSha256(value)})))}
  return frozenFacts({...body,factsSha256:recordSha256(body)})
}
export function formatLocalMvuPromptFactsV2(input:LocalFoldFacts&{genesis:VerifiedMvuProgramGenesis})
  :MvuPromptLocalNumericalFactsV2 {
  const {state,states,rows}=input,
    genesis=validateProgramMvuGenesisFactsV1(input.genesis.programEvent,input.genesis.programHead),
    event=genesis.programEvent,head=genesis.programHead,plan=event.plan,
    initial=[...states.values()].find(row=>row.revision===1)
  if(!equal(genesis,input.genesis)||genesis.sessionId!==state.sessionId||genesis.sourceSha256!==state.sourceSha256
    ||!initial||initial.sessionId!==genesis.sessionId||initial.sourceSha256!==genesis.sourceSha256
    ||!equal(initial.currentHead,head)||!equal(initial.values,event.finalValues)
    ||initial.valuesSha256!==event.valuesSha256||!('encoding' in initial.root)
    ||initial.root.encoding!=='native-program-mvu-state-root-v1'
    ||initial.root.programEventId!==event.eventId||initial.root.programEventSha256!==event.eventSha256
    ||initial.root.programHeadSha256!==recordSha256(head)||initial.root.planSha256!==plan.planSha256
    ||!equal(state.root,initial.root))fail('PROMPT_NUMERICAL_PROGRAM_GENESIS_INVALID')
  const {stories,manuals}=localPublications(input),native=event.native,
    messageRef=native.production==='selected-card-copy'
      ?{ownerSessionId:genesis.sessionId,seq:native.receipt.assistantSeq,messageId:native.receipt.messageId,
        nativeEventRecordSha256:native.receipt.messageVersion.eventSha256,
        renderedTextSha256:native.receipt.renderedSha256}
      :{ownerSessionId:genesis.sessionId,seq:native.receipt.terminalOutput.eventRef.seq,
        messageId:native.receipt.terminalOutput.messageId,
        nativeEventRecordSha256:native.receipt.terminalOutput.eventRef.sha256,
        renderedTextSha256:native.receipt.terminalOutput.textSha256}
  // The actual state reader has joined these persisted status records before
  // handing us its fold. Formatting their refs creates no new table ownership.
  const genesisRefs={event:{table:'status' as const,
    key:mvuInitializationEventKey(genesis.sessionId,event.eventId),recordSha256:recordSha256(event)},
    head:{table:'status' as const,key:mvuInitializationHeadKey(genesis.sessionId),recordSha256:recordSha256(head)}}
  const body={schemaVersion:2 as const,encoding:'native-program-json-prompt-numerical-facts-v2' as const,
    authority:'consumer-data-only' as const,sessionId:state.sessionId,numericalSourceSha256:state.sourceSha256,
    genesis,genesisSnapshotSha256:initial.stateSnapshotSha256,genesisMessageRef:messageRef,
    sourceIdentity:{kind:'program-opening' as const,original:plan.source.source,
      sourceProofSha256:plan.source.proofSha256,basisSha256:plan.basis.basisSha256,planSha256:plan.planSha256},
    genesisRefs,currentSnapshot:state,snapshots:snapshots([...states.values()]),storyPublications:uniqueStories(stories),
    manualPublications:uniqueManual(manuals),inventory:inventory('complete-owned-current-status',[
      genesisRefs.event,genesisRefs.head,
      ...[...rows].map(([key,value])=>({table:'status' as const,key,recordSha256:recordSha256(value)}))])}
  return frozenFacts({...body,factsSha256:recordSha256(body)})
}
export function formatPrefixMvuPromptFactsV1(input:{proof:MvuPrefixLedgerProof;genesis:MvuNumericalSnapshot;
  stories:readonly MvuPromptValidatedStoryInputV1[];manuals:readonly MvuPromptValidatedManualInputV1[];
  rows:readonly MvuPromptRowRefV1[]}):MvuPromptPrefixNumericalFactsV1 {
  const {proof,genesis,stories,manuals,rows}=input
  const body={schemaVersion:1 as const,encoding:'native-json-prompt-prefix-facts-v1' as const,
    authority:'consumer-data-only' as const,ownerSessionId:proof.ownerSessionId,
    ownerInheritedEventCount:proof.ownerInheritedEventCount,inheritedPrefixLength:proof.inheritedPrefixLength,
    historyPrefixSha256:proof.historyPrefixSha256,numericalSourceSha256:proof.sourceSha256,
    ledgerProofSha256:proof.proofSha256,genesisSnapshotSha256:genesis.stateSnapshotSha256,
    resultSnapshotSha256:proof.numericalSnapshot.stateSnapshotSha256,
    snapshots:snapshots([genesis,proof.numericalSnapshot,...stories.flatMap(row=>[row.base,row.result]),
      ...manuals.flatMap(row=>[row.base,row.result])]),storyPublications:uniqueStories(stories.map(story)),
    manualPublications:uniqueManual(manuals.map(manual)),inventory:inventory('closed-inherited-numerical-cut',rows)}
  return frozenFacts({...body,factsSha256:recordSha256(body)})
}
export function formatInheritedMvuPromptFactsV1(input:{childSessionId:string;genesis:VerifiedMvuDerivedGenesis;
  source:MvuDerivedSourceProofUnion;layers:readonly MvuPromptInheritedLayerV1[];
  prefixes:readonly MvuPromptPrefixNumericalFactsV1[];openings:readonly MvuPromptValidatedOpeningInputV1[]})
  :MvuPromptInheritedNumericalFactsV1 {
  if(!input.layers.length||input.layers.length>MVU_PROMPT_FACTS_BOUNDS.layers
    ||input.genesis.sessionId!==input.childSessionId||input.source.childSessionId!==input.childSessionId
    ||input.genesis.sourceSha256!==input.source.childSourceSha256)fail('PROMPT_NUMERICAL_INHERITED_INVALID')
  const openings:MvuPromptOpeningPublicationV1[]=[],known=new Set<string>()
  for(const row of input.openings) {
    if(row.genesis.sessionId!==row.snapshot.sessionId||row.genesis.initEvent.native.assistantSeq!==row.canonical.seq
      ||row.genesis.initEvent.native.messageId!==row.canonical.messageId
      ||row.genesis.initEvent.native.messageVersion.eventSha256!==row.nativeEventRecordSha256
      ||row.genesis.initEvent.plan.identity.renderedSha256!==row.canonical.narrativeSha256)fail('PROMPT_NUMERICAL_OPENING_INVALID')
    const key=`${row.genesis.sessionId}:${row.canonical.seq}:${row.canonical.versionSha256}`
    if(known.has(key))fail('PROMPT_NUMERICAL_FACT_CONFLICT')
    known.add(key)
    openings.push({kind:'opening',ownerSessionId:row.genesis.sessionId,canonical:row.canonical,
      nativeEventRecordSha256:row.nativeEventRecordSha256,initializationEvent:row.genesis.initEvent,
      initializationHead:row.genesis.initHead,initializationIntent:row.intent,
      source:row.genesis.initEvent.plan.identity.source,selectedSwipeIdentity:row.genesis.initEvent.plan.selectedSwipeIdentity,
      resultSnapshotSha256:row.snapshot.stateSnapshotSha256})
  }
  const inventoryRows=[...input.prefixes.flatMap(row=>[...row.inventory.rows,...row.inputClosure?[row.inputClosure]:[]]),
    ...input.layers.flatMap(row=>[
    row.basis,row.prepared,row.derivedEvent,row.derivedHead,row.operation]),...input.openings.flatMap(row=>[
    row.intent,row.historical?.event??{table:'status' as const,key:`${row.genesis.sessionId}__mvu-init-event-${row.genesis.initEvent.eventId}`,
      recordSha256:recordSha256(row.genesis.initEvent)},
    row.historical?.head??{table:'status' as const,key:`${row.genesis.sessionId}__mvu-init-head`,
      recordSha256:recordSha256(row.genesis.initHead)}])]
  const body={schemaVersion:1 as const,encoding:'native-json-prompt-inherited-facts-v1' as const,
    authority:'consumer-data-only' as const,childSessionId:input.childSessionId,numericalSourceSha256:input.genesis.sourceSha256,
    genesis:input.genesis,source:input.source,originalImport:input.source.originalImport,layers:input.layers,
    snapshots:snapshots([...input.prefixes.flatMap(row=>row.snapshots),
      ...input.openings.map(row=>row.snapshot)]),openingPublications:openings,
    storyPublications:uniqueStories(input.prefixes.flatMap(row=>row.storyPublications)),
    manualPublications:uniqueManual(input.prefixes.flatMap(row=>row.manualPublications)),
    inventory:inventory('closed-inherited-numerical-cut',inventoryRows)}
  return frozenFacts({...body,factsSha256:recordSha256(body)})
}

function programRowRef(ref:MvuPromptRowRefV1,table:MvuPromptRowRefV1['table'],key:string,value:unknown) {
  if(ref.table!==table||ref.key!==key||ref.recordSha256!==recordSha256(value)
    ||Object.hasOwn(ref,'fieldPointer')||!equal(Object.keys(ref).sort(),['key','recordSha256','table'])) {
    fail('PROMPT_NUMERICAL_PROGRAM_PACKET_REF_INVALID')
  }
}
/** This is a bounded data join. The actual callback has already proved the
 * frozen prepared row, original Native cut and exact current message version. */
function programOpening(input:MvuPromptValidatedProgramOpeningInputV1):MvuPromptProgramOpeningPublicationV1 {
  const row=frozenFacts(input),genesis=validateProgramMvuGenesisFactsV1(row.genesis.programEvent,row.genesis.programHead),
    event=genesis.programEvent,head=genesis.programHead,plan=event.plan,
    seed=validateProgramOpeningSeedV1(row.packets.seed),packet=validateProgramOpeningInputV1(row.packets.input,seed),
    planRecord=validateProgramOpeningPlanRecordV1(row.packets.plan,seed,packet),
    intent=validateOpeningIntentV7(row.packets.intent,{seed,input:packet,planRecord,
      genesis:{programEvent:event,programHead:head}}),snapshot=row.snapshot,canonical=row.canonical,root=snapshot.root
  snapshots([snapshot])
  if(!equal(genesis,row.genesis)||!equal(planRecord.plan,plan)||intent.status!=='completed'
    ||genesis.sessionId!==snapshot.sessionId||genesis.sourceSha256!==snapshot.sourceSha256
    ||snapshot.schemaVersion!==1||snapshot.encoding!=='native-mvu-state-snapshot-v1'
    ||snapshot.revision!==1||!equal(snapshot.currentHead,head)||!equal(snapshot.values,event.finalValues)
    ||snapshot.valuesSha256!==event.valuesSha256||!('encoding' in root)
    ||root.encoding!=='native-program-mvu-state-root-v1'||root.programEventId!==event.eventId
    ||root.programEventSha256!==event.eventSha256||root.programHeadSha256!==recordSha256(head)
    ||root.planSha256!==plan.planSha256||!Number.isSafeInteger(canonical.seq)||canonical.seq<0
    ||typeof canonical.messageId!=='string'||!canonical.messageId
    ||!['versionSha256','narrativeSha256'].every(key=>/^[a-f0-9]{64}$/.test(canonical[key as keyof typeof canonical] as string))
    ||!/^[a-f0-9]{64}$/.test(row.nativeEventRecordSha256))fail('PROMPT_NUMERICAL_PROGRAM_OPENING_INVALID')
  const native=event.native
  if(native.production==='selected-card-copy') {
    if(native.receipt.assistantSeq!==canonical.seq||native.receipt.messageId!==canonical.messageId
      ||native.receipt.messageVersion.eventSha256!==row.nativeEventRecordSha256
      ||native.receipt.renderedSha256!==canonical.narrativeSha256
      ||sha256(packet.source.selected.renderedText)!==canonical.narrativeSha256) {
      fail('PROMPT_NUMERICAL_PROGRAM_CANONICAL_INVALID')
    }
  }else {
    const terminal=native.receipt.terminalOutput,body=native.canonical
    if(terminal.eventRef.seq!==canonical.seq||terminal.messageId!==canonical.messageId
      ||terminal.eventRef.sha256!==row.nativeEventRecordSha256||terminal.textSha256!==canonical.narrativeSha256
      ||body.seq!==canonical.seq||body.messageId!==canonical.messageId||body.versionSha256!==canonical.versionSha256
      ||sha256(body.narrative)!==canonical.narrativeSha256)fail('PROMPT_NUMERICAL_PROGRAM_CANONICAL_INVALID')
  }
  const refs=row.refs,sid=genesis.sessionId,op=seed.operationId
  if(!equal(Object.keys(refs).sort(),['genesisEvent','genesisHead','input','intent','plan','seed'])
    ||!equal(Object.keys(canonical).sort(),['messageId','narrativeSha256','seq','versionSha256'])) {
    fail('PROMPT_NUMERICAL_PROGRAM_PACKET_REF_INVALID')
  }
  programRowRef(refs.seed,'branch',programOpeningSeedKeyV1(sid,op),seed)
  programRowRef(refs.input,'branch',programOpeningInputKeyV1(sid,op),packet)
  programRowRef(refs.plan,'branch',programOpeningPlanKeyV1(sid,op),planRecord)
  programRowRef(refs.intent,'branch',openingIntentKey(sid,seed.source.importId),intent)
  programRowRef(refs.genesisEvent,'status',mvuInitializationEventKey(sid,event.eventId),event)
  programRowRef(refs.genesisHead,'status',mvuInitializationHeadKey(sid),head)
  if(!equal(plan.identity.intentRef,{key:refs.seed.key,sha256:refs.seed.recordSha256})
    ||!equal(plan.identity.inputRef,{key:refs.input.key,sha256:refs.input.recordSha256})
    ||!equal(intent.planRef,{key:refs.plan.key,sha256:refs.plan.recordSha256})
    ||row.closureRef.table!=='branch'||row.closureRef.fieldPointer!=='/genesisClosure'
    ||!row.closureRef.key.endsWith('__mvu-derived-prepared')||!/^[a-f0-9]{64}$/.test(row.closureRef.recordSha256)
    ||!equal(Object.keys(row.closureRef).sort(),['fieldPointer','key','recordSha256','table'])) {
    fail('PROMPT_NUMERICAL_PROGRAM_PACKET_REF_INVALID')
  }
  return frozenFacts({kind:'program-opening' as const,ownerSessionId:sid,numericalSourceSha256:genesis.sourceSha256,
    canonical,nativeEventRecordSha256:row.nativeEventRecordSha256,genesis,snapshot,source:plan.source,basis:plan.basis,
    native,openingSettlement:event.openingSettlement,originalPacketRefs:refs,originalPackets:{seed,input:packet,plan:planRecord,intent},
    archiveProvenance:row.closureRef,resultSnapshotSha256:snapshot.stateSnapshotSha256})
}
/** Pure packet validation reused by the scope consumer. This function neither
 * reads historical rows nor treats the serialized archive ref as currency. */
export function validateMvuPromptProgramOpeningPublicationV1(value:unknown):MvuPromptProgramOpeningPublicationV1 {
  const row=frozenFacts(value) as MvuPromptProgramOpeningPublicationV1,
    checked=programOpening({genesis:row.genesis,snapshot:row.snapshot,canonical:row.canonical,
      nativeEventRecordSha256:row.nativeEventRecordSha256,closureRef:row.archiveProvenance,
      refs:row.originalPacketRefs,packets:row.originalPackets})
  if(!equal(row,checked))fail('PROMPT_NUMERICAL_PROGRAM_OPENING_INVALID')
  return checked
}
export interface MvuPromptInheritedFormatInputV2 {
  readonly childSessionId:string
  readonly genesis:VerifiedMvuDerivedGenesis
  readonly source:MvuDerivedSourceProofUnion
  readonly layers:readonly MvuPromptInheritedLayerV1[]
  readonly prefixes:readonly MvuPromptPrefixNumericalFactsV1[]
  readonly openings:readonly MvuPromptValidatedOpeningInputV1[]
  readonly programOpenings:readonly MvuPromptValidatedProgramOpeningInputV1[]
}
export function formatInheritedMvuPromptFactsV2(input:MvuPromptInheritedFormatInputV2):MvuPromptInheritedNumericalFactsV2 {
  if(!input.programOpenings.length||input.programOpenings.length>MVU_PROMPT_FACTS_BOUNDS.publications) {
    fail('PROMPT_NUMERICAL_PROGRAM_INHERITED_INVALID')
  }
  // Reuse the old detached fold without changing its grammar or hash body.
  const previous=formatInheritedMvuPromptFactsV1(input),programs=input.programOpenings.map(programOpening),
    known=new Set(previous.openingPublications.map(row=>
      `${row.ownerSessionId}:${row.canonical.seq}:${row.canonical.versionSha256}`)),original=input.source.originalImport
  for(const row of programs) {
    const identity=row.source.program.importTuple,key=`${row.ownerSessionId}:${row.canonical.seq}:${row.canonical.versionSha256}`,
      layer=input.layers.find(item=>item.prepared.table===row.archiveProvenance.table
        &&item.prepared.key===row.archiveProvenance.key&&item.prepared.recordSha256===row.archiveProvenance.recordSha256),
      prefix=input.prefixes.find(item=>item.ownerSessionId===row.ownerSessionId
        &&item.numericalSourceSha256===row.numericalSourceSha256
        &&item.genesisSnapshotSha256===row.resultSnapshotSha256&&row.canonical.seq<item.inheritedPrefixLength)
    if(known.has(key)||previous.storyPublications.some(item=>item.ownerSessionId===row.ownerSessionId
      &&item.canonical.seq===row.canonical.seq&&item.canonical.versionSha256===row.canonical.versionSha256)) {
      fail('PROMPT_NUMERICAL_FACT_CONFLICT')
    }
    known.add(key)
    if(!layer||layer.parentSessionId!==row.ownerSessionId||!prefix
      ||!prefix.snapshots.some(item=>equal(item,row.snapshot))
      ||identity.sourceRecordSessionId!==original.ownerSessionId||identity.importId!==original.importId
      ||identity.rawSha256!==original.rawSha256||identity.normalizedSha256!==original.normalizedSha256
      ||identity.transactionId!==original.transactionId||identity.coverageSha256!==original.coverageSha256
      ||identity.importRecordRef.sha256!==original.recordSha256
      ||recordSha256(identity.originalActivation)!==original.activationSha256) {
      fail('PROMPT_NUMERICAL_PROGRAM_INHERITED_INVALID')
    }
  }
  if(previous.openingPublications.length+previous.storyPublications.length+programs.length>
    MVU_PROMPT_FACTS_BOUNDS.publications)fail('PROMPT_NUMERICAL_FACTS_LIMIT')
  const {schemaVersion:_version,encoding:_encoding,factsSha256:_hash,...body}=previous,
    output={...body,schemaVersion:2 as const,encoding:'native-program-json-prompt-inherited-facts-v2' as const,
      snapshots:snapshots([...body.snapshots,...programs.map(row=>row.snapshot)]),
      programOpeningPublications:programs.sort((left,right)=>left.canonical.seq-right.canonical.seq
        ||(left.ownerSessionId===right.ownerSessionId?0:left.ownerSessionId<right.ownerSessionId?-1:1)),
      inventory:inventory('closed-inherited-numerical-cut',[...body.inventory.rows,
        ...programs.flatMap(row=>[...Object.values(row.originalPacketRefs),row.archiveProvenance])])}
  return frozenFacts<unknown>({...output,factsSha256:recordSha256(output)}) as MvuPromptInheritedNumericalFactsV2
}
