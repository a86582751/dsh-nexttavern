/** Versioned schema opening facts. Shape/hash checks prove integrity only;
 * actual Source, Native history and private publication authority belong to Core. */
import {recordSha256,sha256} from './roleplay-data.js'
import {validateMvuEffectiveLoreSourceV1} from './roleplay-tavern-lore-edits-data.js'
import {cloneSchemaValues,cloneSchemaDescriptorEnvelopeV4} from './tavern-mvu-schema-data.js'
import type {OpeningIntentIdentity,OpeningCatalog,OpeningSource,OpeningAppendResult,OpeningLookupResult,
  OpeningInitializationReceipt} from './roleplay-opening-selection.js'
import type {MvuOpeningIdentity,MvuNativeOpeningReceipt} from './roleplay-mvu-initialization.js'
import type {MvuSchemaAuthorSource,FreshNativeBasisProof} from './roleplay-mvu-source.js'
import type {SchemaExecutionSelector,SchemaExecutionAssociation}
  from './roleplay-mvu-schema-replay.js'
import {validateSchemaExecutorIdentityTuple} from './roleplay-mvu-schema-executor-types.js'
import type {SchemaGuestOutput} from './roleplay-mvu-schema-executor-types.js'
import type {AuthorOpeningPreparationV6,AuthorHostIdentityV5,AuthorServerExecutorV4,AuthorHostAssociationV5}
  from './roleplay-author-host-types-v5.js'
import {deriveOwnedStateLoaderIdentityV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuJsonObject,SchemaMvuInitDataSource} from './tavern-mvu-initvar.js'
import type {TavernOpeningCandidate} from './tavern-card.js'
import type {ProgramOpeningBasisProofV1} from './roleplay-program-opening-basis-types.js'
import type {ProgramOpeningDataRefV1,OpeningIntentV7} from './roleplay-program-opening-records.js'
import type {NativeOpeningOwnerIdentityV1,NativeGeneratedOpeningReceiptV1} from 'dsh-nexttavern-native-agent-loop'
import type {CompletedStoryBody} from './roleplay-mvu-story.js'
import {validateNativeGeneratedOpeningReceiptV1} from 'dsh-nexttavern-native-agent-loop'
import type {MvuBrowserHookFact} from './roleplay-mvu-browser-hook.js'

/** The pre-invocation basis and the real initialization cut have different
 * owners. A generated birth joins them through the actual invocation/Phase A. */
export type SchemaOpeningBirth=
  |{readonly kind:'copy';readonly freshNativeBasisProof:FreshNativeBasisProof}
  |{readonly kind:'generated';readonly basis:ProgramOpeningBasisProofV1;
    readonly seedRef:ProgramOpeningDataRefV1;readonly inputRef:ProgramOpeningDataRefV1;
    readonly owner:NativeOpeningOwnerIdentityV1;readonly turn:number;
    readonly selectedBaseSha256:string;readonly snapshotRef:ProgramOpeningDataRefV1;
    readonly phaseARefs:readonly ProgramOpeningDataRefV1[];
    readonly initializationCut:{readonly nativeCut:number;readonly nativePrefixSha256:string}}
export type SchemaOpeningNative=
  |{readonly kind:'copy';readonly receipt:MvuNativeOpeningReceipt}
  |{readonly kind:'generated';readonly receipt:NativeGeneratedOpeningReceiptV1;readonly canonical:CompletedStoryBody}
export function openingInitializationCut(preparation:Pick<MvuSchemaOpeningPreparation,'birth'>) {
  const birth=preparation.birth
  return birth.kind==='copy'?{nativeCut:birth.freshNativeBasisProof.native.observedThroughSeq+1,
    nativePrefixSha256:birth.freshNativeBasisProof.native.historyVersionSha256}:birth.initializationCut
}
export function openingFreshBasisSha256(preparation:Pick<MvuSchemaOpeningPreparation,'birth'>):string {
  const birth=preparation.birth
  return birth.kind==='copy'?birth.freshNativeBasisProof.proofSha256:birth.basis.basisSha256
}
/** A projection of actual Native output identity, never a fabricated receipt. */
export function schemaOpeningNativeAnchor(native:SchemaOpeningNative) {
  if(native.kind==='copy')return {sessionId:native.receipt.sessionId,messageId:native.receipt.messageId,
    assistantSeq:native.receipt.assistantSeq,renderedSha256:native.receipt.renderedSha256,
    turn:native.receipt.turn,turnStartSeq:native.receipt.turnStartSeq,turnEndSeq:native.receipt.turnEndSeq}
  const {receipt,canonical}=native
  return {sessionId:receipt.identity.sessionId,messageId:canonical.messageId,assistantSeq:canonical.seq,
    renderedSha256:sha256(canonical.narrative),turn:receipt.turn,turnStartSeq:receipt.turnStartRef.seq,turnEndSeq:receipt.turnEndRef.seq}
}

export interface MvuSchemaOpeningPreparationFields {
  identity:MvuOpeningIdentity
  authorSourceSha256:string
  sourceSnapshot:MvuSchemaAuthorSource['snapshot']
  initSource:SchemaMvuInitDataSource
  birth:SchemaOpeningBirth
  selector:SchemaExecutionSelector
  realmEpoch:string
  clockEpochMs:number
  randomSeed:string
  preparationSha256:string
}
export type MvuSchemaOpeningPreparation=AuthorOpeningPreparationV6
interface FrozenMvuOpeningInitializationFields {
  preparationSha256:string
  identity:MvuOpeningIdentity
  selectedSwipeIdentity:string
  authorSourceSha256:string
  sourceSnapshot:MvuSchemaAuthorSource['snapshot']
  initSource:SchemaMvuInitDataSource
  initialValuesSha256:string
  birth:SchemaOpeningBirth
  updateMessage:string
  values:MvuJsonObject
  valuesSha256:string
  planSha256:string
}
export interface FrozenMvuOpeningInitializationV8 extends FrozenMvuOpeningInitializationFields {
  schemaVersion:10
  encoding:'mvu-programmatic-opening-plan-v10'
  host:AuthorHostIdentityV5
  server:AuthorServerExecutorV4
  execution:AuthorHostAssociationV5
  phases:readonly [
    {readonly phase:'initialization';readonly execution:AuthorHostAssociationV5},
    ...{readonly phase:'update-core';readonly execution:AuthorHostAssociationV5}[],
  ]
  context:MvuJsonObject
  frontier:{readonly nativeCut:number;readonly tailSha256:string;readonly frontierSha256:string}
  browser?:{readonly schemaVersion:1;readonly hooks:readonly MvuBrowserHookFact[];readonly finalizedMessage:string}
}
export function schemaOpeningFinalizedText(plan:FrozenMvuOpeningInitializationV3):string {
  return plan.browser?.finalizedMessage??plan.updateMessage
}
export type FrozenMvuOpeningInitializationV3=FrozenMvuOpeningInitializationV8
export interface OpeningIntentV5 extends OpeningIntentIdentity {
  schemaVersion:5
  mode:'schema'
  status:'preparing'|'pending'|'native-committed'|'completed'|'blocked'|'unknown'
  textRetained:true
  preparation:MvuSchemaOpeningPreparation
  initialization?:FrozenMvuOpeningInitializationV3
  initializationCode?:string
  nativeReceipt?:MvuNativeOpeningReceipt
  initializationReceipt?:OpeningInitializationReceipt
}
export interface MvuSchemaOpeningEventV2 {
  schemaVersion:3
  encoding:'mvu-schema-opening-event-v3'
  eventId:string
  revision:1
  plan:FrozenMvuOpeningInitializationV3
  native:SchemaOpeningNative
  executionSha256:string
  valuesSha256:string
  eventSha256:string
}
export interface MvuSchemaOpeningHeadV2 {
  schemaVersion:3
  encoding:'mvu-schema-opening-head-v3'
  sessionId:string
  eventId:string
  revision:1
  eventSha256:string
  planSha256:string
  executionSha256:string
  valuesSha256:string
}
export interface SchemaOpeningRequest {
  catalog:OpeningCatalog
  candidate:TavernOpeningCandidate
  identity:MvuOpeningIdentity
  renderedText:string
}
export interface SchemaOpeningExecutionLive {
  kind:'prepared'
  plan:FrozenMvuOpeningInitializationV3
  evidence:object
  association:SchemaExecutionAssociation
  output:SchemaGuestOutput
}
export interface SchemaOpeningRootFacts {
  intent:(OpeningIntentV5|OpeningIntentV7)&{readonly status:'completed'}
  preparation:MvuSchemaOpeningPreparation
  plan:FrozenMvuOpeningInitializationV3
  native:SchemaOpeningNative
  event:MvuSchemaOpeningEventV2
  head:MvuSchemaOpeningHeadV2
}
export type SchemaOpeningReadiness=({kind:'ready'}&SchemaOpeningRootFacts)
  |{kind:'blocked';code:string;intent?:OpeningIntentV5}
export type SchemaOpeningSelectResult=OpeningIntentV5|{status:'busy';intent:OpeningIntentV5}
export interface SchemaOpeningTable {get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>}
export interface SchemaOpeningPublicationBoundary {
  intent:OpeningIntentV5
  event?:MvuSchemaOpeningEventV2
  head?:MvuSchemaOpeningHeadV2
  stage:'before-event'|'after-event'|'before-head'|'after-head'|'completed'
}
export interface SchemaOpeningDeps {
  branch:SchemaOpeningTable
  status:SchemaOpeningTable
  withLock<T>(key:string,action:()=>Promise<T>):Promise<T>
  prepare(request:SchemaOpeningRequest):Promise<{kind:'prepared';preparation:MvuSchemaOpeningPreparation}|{kind:'blocked';code:string}>
  executeInitialization(preparation:MvuSchemaOpeningPreparation):Promise<SchemaOpeningExecutionLive
    |{kind:'blocked'|'unavailable';code:string}>
  releaseExecution(live:SchemaOpeningExecutionLive):Promise<void>
  withPublicationBoundary<T>(live:SchemaOpeningExecutionLive,action:()=>Promise<T>):Promise<T>
  checkBeforeOpening(live:SchemaOpeningExecutionLive,intent:OpeningIntentV5):boolean
  checkPublication(live:SchemaOpeningExecutionLive,boundary:SchemaOpeningPublicationBoundary):boolean
  sourceCurrent(preparation:MvuSchemaOpeningPreparation):boolean
  lookupNativeOpening(intent:OpeningIntentV5):Promise<OpeningLookupResult>
  readNativeOpening(intent:OpeningIntentV5):{kind:'ready';receipt:MvuNativeOpeningReceipt}|{kind:'blocked';code:string}
  verifyHistorical(intent:OpeningIntentV5,event:MvuSchemaOpeningEventV2,head:MvuSchemaOpeningHeadV2):
    Promise<{kind:'verified'}|{kind:'blocked';code:string}>
  appendOpening(request:{sessionId:string;operationId:string;messageId:string;source:OpeningSource;text:string}):Promise<OpeningAppendResult>
}
/** Synchronous handles is an actual Source probe only. Guest/Native awaits are
 * delegated outside the old opening selection lock. */
export interface SchemaOpeningSelectionAdapter {
  handles(request:SchemaOpeningRequest):boolean
  select(request:SchemaOpeningRequest):Promise<SchemaOpeningSelectResult>
  readIntent(source:OpeningSource):OpeningIntentV5|null
  readVerified(source:OpeningSource,purpose?:'historical'):Promise<SchemaOpeningReadiness>
}
export const MVU_SCHEMA_OPENING_BOUNDS=Object.freeze({bytes:4_194_304,depth:72,nodes:131072})
export const schemaOpeningCode=(value:unknown):string=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(value)
  ?value:'SCHEMA_OPENING_UNKNOWN'
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const id=(value:unknown,max=128):value is string=>typeof value==='string'&&value.length<=max&&/^[A-Za-z0-9_-]+$/.test(value)
const integer=(value:unknown,min=0):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&!Object.is(value,-0)
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
function fail():never {throw Error('SCHEMA_OPENING_RECORD_INVALID')}
function exact(value:object,required:readonly string[],optional:readonly string[]=[]) {
  const keys=Object.keys(value)
  if(required.some(key=>!keys.includes(key))||keys.some(key=>!required.includes(key)&&!optional.includes(key)))fail()
}
/** This envelope permits depth 72; shared execution envelopes deliberately cap
 * at 66. Values retain their original independent 1 MiB/depth bounds. */
export function freezeMvuSchemaOpeningData<T>(input:T):T {
  const limit=MVU_SCHEMA_OPENING_BOUNDS
  let value:T
  try {
    // One DATA owner separates full Source material from opening metadata.
    // Host5 retains its complete input without charging it as a 4 MiB string.
    value=cloneSchemaDescriptorEnvelopeV4(input,limit.bytes,{nodes:limit.nodes,depth:limit.depth})
  }catch {fail()}
  function freeze(item:unknown):void {
    if(!item||typeof item!=='object'||Object.isFrozen(item))return
    for(const child of Object.values(item))freeze(child)
    Object.freeze(item)
  }
  freeze(value)
  return value
}
export function sealMvuSchemaOpeningFact<T extends object,K extends string>(body:T,field:K):T&Record<K,string> {
  const value=freezeMvuSchemaOpeningData(body)
  return freezeMvuSchemaOpeningData({...value,[field]:recordSha256(value)}) as T&Record<K,string>
}
function fact(value:object,field:string) {
  const {[field]:checksum,...body}=value as Record<string,unknown>
  if(!hash(checksum)||recordSha256(body)!==checksum)fail()
}
export function mvuSchemaOpeningIdentity(intent:OpeningIntentIdentity):MvuOpeningIdentity {
  return {sessionId:intent.sessionId,source:intent.source,operationId:intent.operationId,messageId:intent.messageId,
    index:intent.index,sourcePointer:intent.sourcePointer,sourceSha256:intent.sourceSha256,renderedSha256:intent.renderedSha256}
}
function identity(value:MvuOpeningIdentity) {
  exact(value,['sessionId','source','operationId','messageId','index','sourcePointer','sourceSha256','renderedSha256'])
  const source=value.source,pointer=source.pointer
  exact(source,['sessionId','importId','sourceRecordSessionId','rawSha256','normalizedSha256','transactionId','coverageSha256','pointer'])
  exact(pointer,['importId','normalizedSha256','transactionId','coverageSha256'],['sourceRecordSessionId','activatedAt','inheritedFrom'])
  if(!id(value.sessionId,64)||!id(value.operationId)||!id(value.messageId)||!integer(value.index)
    ||source.sessionId!==value.sessionId||!id(source.importId,64)||!id(source.sourceRecordSessionId,64)
    ||!id(source.transactionId)||pointer.importId!==source.importId||pointer.normalizedSha256!==source.normalizedSha256
    ||pointer.transactionId!==source.transactionId||pointer.coverageSha256!==source.coverageSha256
    ||Object.hasOwn(pointer,'activatedAt')&&!integer(pointer.activatedAt)
    ||(pointer.sourceRecordSessionId??value.sessionId)!==source.sourceRecordSessionId
    ||typeof value.sourcePointer!=='string'||!value.sourcePointer.startsWith('/')||value.sourcePointer.length>512
    ||![source.rawSha256,source.normalizedSha256,source.coverageSha256,value.sourceSha256,value.renderedSha256].every(hash))fail()
}
function hostIdentity(value:AuthorHostIdentityV5):void {
  exact(value,['id','version','implementationSha256'])
  if(value.id!=='native-author-host'||value.version!==5||!hash(value.implementationSha256))fail()
}
export function deriveAuthorHostOpeningExecutionV6(input:MvuOpeningIdentity,host:AuthorHostIdentityV5):
  {realmEpoch:string;selector:SchemaExecutionSelector;phaseSelectors:AuthorOpeningPreparationV6['phaseSelectors']} {
  const value=freezeMvuSchemaOpeningData(input);identity(value);hostIdentity(host)
  const realmEpoch=recordSha256({schemaVersion:6,encoding:'native-author-opening-execution-identity-v6',identity:value,host})
  const selector=(index:number):SchemaExecutionSelector=>({sessionId:value.sessionId,batchId:`opening-${realmEpoch}-${index}`,
    anchor:{kind:'opening',operationId:value.operationId,messageId:value.messageId,importId:value.source.importId,selectedIndex:value.index}})
  const phaseSelectors:AuthorOpeningPreparationV6['phaseSelectors']=[
    {phase:'initialization',selector:selector(0)},
    {phase:'update-core',selector:selector(1)},
  ]
  return freezeMvuSchemaOpeningData({realmEpoch,selector:phaseSelectors[0].selector,phaseSelectors})
}
export function mvuSchemaOpeningPhaseSelector(preparation:Pick<MvuSchemaOpeningPreparation,'selector'>,index:number):SchemaExecutionSelector {
  return {...preparation.selector,batchId:preparation.selector.batchId.replace(/-0$/,`-${index}`)}
}
function serverExecutorV4(value:AuthorServerExecutorV4):void {
  exact(value,['compiler','bridge','libraries','stateLoader','runner'])
  const {stateLoader,...tuple}=value
  const actual=validateSchemaExecutorIdentityTuple(tuple)
  if(actual.runner.version!==4||!same(stateLoader,deriveOwnedStateLoaderIdentityV4(actual.bridge)))fail()
}
function inputFacts(value:Pick<MvuSchemaOpeningPreparation,'identity'|'authorSourceSha256'|'sourceSnapshot'|'initSource'|'birth'>) {
  identity(value.identity)
  const snapshot=value.sourceSnapshot,init=value.initSource,selected=snapshot.selected
  exact(snapshot,['schemaVersion','encoding','source','pointerSha256','importRecordSha256','coverageSha256','materialRows',
    'settings','bindings','selected','swipes','macroContext','documentSha256','snapshotSha256'],['sourceProvenance','effectiveLore'])
  if(snapshot.effectiveLore)validateMvuEffectiveLoreSourceV1(snapshot.effectiveLore)
  exact(selected,['index','pointer','sourceSha256','renderedSha256'])
  exact(init,['schemaVersion','encoding','grammar','books','bookStatData','initializedBooks','messageIndex',
    'selectedSwipeIdentity','swipes','macros','initSourceSha256'])
  fact(snapshot,'snapshotSha256');fact(init,'initSourceSha256')
  if(!hash(value.authorSourceSha256)||snapshot.schemaVersion!==1||snapshot.encoding!=='native-mvu-author-source-snapshot-v1'
    ||![snapshot.documentSha256,snapshot.pointerSha256,snapshot.importRecordSha256,snapshot.coverageSha256].every(hash)
    ||!same(snapshot.source,value.identity.source)||selected.index!==value.identity.index
    ||selected.pointer!==value.identity.sourcePointer||selected.sourceSha256!==value.identity.sourceSha256
    ||selected.renderedSha256!==value.identity.renderedSha256||init.schemaVersion!==1
    ||init.encoding!=='native-mvu-schema-opening-init-source-v1'
    ||!['strict-json-object-v1','yaml-1.2-json-data-v1'].includes(init.grammar)
    ||init.messageIndex!==0||!Array.isArray(init.initializedBooks)||init.initializedBooks.length!==0
    ||!['none','verified-identity-rendering'].includes(init.macros)||!Array.isArray(init.books)||!Array.isArray(init.swipes))fail()
  cloneSchemaValues(init.bookStatData)
  for(const swipe of init.swipes) {
    exact(swipe,['identity','sourcePointer','sourceSha256','rawOpening','renderedOpening','renderedSha256','statData'],['materialization'])
    cloneSchemaValues(swipe.statData)
    if(typeof swipe.identity!=='string'||!swipe.identity.length||typeof swipe.rawOpening!=='string'
      ||typeof swipe.renderedOpening!=='string'||swipe.sourceSha256!==sha256(swipe.rawOpening)
      ||swipe.renderedSha256!==sha256(swipe.renderedOpening))fail()
  }
  for(const book of init.books) {
    exact(book,['identity','binding','sourcePointer','sourceSha256','entries'])
    if(book.binding!=='primary'||!hash(book.sourceSha256)||!Array.isArray(book.entries))fail()
    for(const entry of book.entries) {
      exact(entry,['identity','sourcePointer','comment','enabled','content','contentSha256','renderedContent','renderedContentSha256'])
      if(typeof entry.enabled!=='boolean'||typeof entry.content!=='string'||typeof entry.renderedContent!=='string'
        ||entry.contentSha256!==sha256(entry.content)||entry.renderedContentSha256!==sha256(entry.renderedContent))fail()
    }
  }
  const birth=value.birth
  if(birth.kind==='copy') {
    exact(birth,['kind','freshNativeBasisProof'])
    const proof=birth.freshNativeBasisProof
    exact(proof,['schemaVersion','encoding','sessionId','ownerSessionId','branch','numerical','native',
      'bookStatDataSha256','swipes','factsSha256','proofSha256'])
    exact(proof.branch,['metaKey','metaSha256','inheritance','parentSessionId','inheritedPrefixLength','ready'])
    exact(proof.numerical,['headKey','headExists','eventMembershipSha256','eventCount','opaqueStateExists'])
    exact(proof.native,['observedThroughSeq','historyVersionSha256','committedOpeningCount','inheritedMessageCount'])
    fact(proof,'proofSha256')
    if(proof.schemaVersion!==1||proof.encoding!=='native-mvu-fresh-basis-proof-v1'
      ||proof.sessionId!==value.identity.sessionId||proof.ownerSessionId!==value.identity.sessionId
      ||!integer(proof.native.observedThroughSeq,-1)||!hash(proof.native.historyVersionSha256)
      ||proof.native.committedOpeningCount!==0||proof.native.inheritedMessageCount!==0
      ||proof.branch.inheritance!=='root'||proof.branch.parentSessionId!==null||proof.branch.inheritedPrefixLength!==0||proof.branch.ready!==true
      ||proof.numerical.headExists!==false||proof.numerical.eventCount!==0||proof.numerical.opaqueStateExists!==false
      ||proof.numerical.eventMembershipSha256!==recordSha256([])||proof.branch.metaKey!==`${value.identity.sessionId}__meta`
      ||proof.numerical.headKey!==`${value.identity.sessionId}__mvu-init-head`||!hash(proof.branch.metaSha256)
      ||!hash(proof.factsSha256)||proof.bookStatDataSha256!==recordSha256({})||!Array.isArray(proof.swipes)
      ||proof.swipes.length!==snapshot.swipes.length)fail()
    for(const [index,swipe] of proof.swipes.entries()) {
      exact(swipe,['identity','sourceSha256','statDataSha256'])
      if(swipe.identity!==snapshot.swipes[index]!.identity||swipe.sourceSha256!==snapshot.swipes[index]!.sourceSha256
        ||swipe.statDataSha256!==recordSha256({}))fail()
    }
  }else {
    exact(birth,['kind','basis','seedRef','inputRef','owner','turn','selectedBaseSha256','snapshotRef','phaseARefs','initializationCut'])
    if(birth.kind!=='generated'||birth.basis.sessionId!==value.identity.sessionId
      ||birth.basis.operationId!==value.identity.operationId||birth.basis.requestedMessageId!==value.identity.messageId
      ||birth.owner.identity.sessionId!==value.identity.sessionId||birth.owner.identity.operationId!==value.identity.operationId
      ||birth.owner.identity.messageId!==value.identity.messageId||!integer(birth.turn,1)
      ||!hash(birth.selectedBaseSha256)||!Array.isArray(birth.phaseARefs)
      ||birth.initializationCut.nativeCut<=birth.owner.invocationRef.seq
      ||!hash(birth.initializationCut.nativePrefixSha256))fail()
    for(const ref of [birth.seedRef,birth.inputRef,birth.snapshotRef,...birth.phaseARefs]) {
      exact(ref,['key','sha256']);if(!id(ref.key,512)||!hash(ref.sha256))fail()
    }
  }
  const swipe=init.swipes.filter(item=>item.identity===init.selectedSwipeIdentity)
  if(swipe.length!==1||swipe[0]!.sourceSha256!==value.identity.sourceSha256
    ||swipe[0]!.sourcePointer!==value.identity.sourcePointer||swipe[0]!.renderedSha256!==value.identity.renderedSha256)fail()
}
export function validateMvuSchemaOpeningPreparation(input:MvuSchemaOpeningPreparation):MvuSchemaOpeningPreparation {
  const value=freezeMvuSchemaOpeningData(input)
  exact(value,['schemaVersion','encoding','identity','authorSourceSha256','sourceSnapshot','initSource','birth',
    'selector','realmEpoch','clockEpochMs','randomSeed','preparationSha256','host','compilation','phaseSelectors'])
  fact(value,'preparationSha256');inputFacts(value)
  hostIdentity(value.host)
  exact(value.compilation,['schemaVersion','encoding','original','sourceRecordSessionId','nativeLayout'])
  if(value.schemaVersion!==7||value.encoding!=='native-author-opening-preparation-v7'
    ||value.compilation.schemaVersion!==8||value.compilation.encoding!=='native-author-combined-compilation-input-v8'
    ||value.compilation.sourceRecordSessionId!==value.sourceSnapshot.source.sourceRecordSessionId
    ||!integer(value.clockEpochMs)||typeof value.randomSeed!=='string'||!value.randomSeed.length||value.randomSeed.length>256)fail()
  if(!same({realmEpoch:value.realmEpoch,selector:value.selector,phaseSelectors:value.phaseSelectors},
    deriveAuthorHostOpeningExecutionV6(value.identity,value.host)))fail()
  return value
}
function executionPhasesV8(plan:FrozenMvuOpeningInitializationV8):void {
  const derived=deriveAuthorHostOpeningExecutionV6(plan.identity,plan.host)
  if(!Array.isArray(plan.phases)||plan.phases.length<2)fail()
  let previousMarkerSeq=openingInitializationCut(plan).nativeCut-1
  const first=plan.phases[0].execution
  for(const [index,item] of plan.phases.entries()) {
    exact(item,['phase','execution'])
    const expected=mvuSchemaOpeningPhaseSelector(derived,index),value=item.execution
    exact(value,['schemaVersion','encoding','sessionId','realmEpoch','batchId','anchor','sourceNativeCutSha256',
      'combinedProgramSha256','serverProgramSha256','epoch','dispatch','completion','dispatchMarker','completionMarker',
      'serverTailSha256','hostFrontierSha256','outputSha256'])
    if(item.phase!==(index===0?'initialization':'update-core')||value.schemaVersion!==5||value.encoding!=='native-author-host-association-v5'
      ||value.sessionId!==expected.sessionId||value.realmEpoch!==derived.realmEpoch
      ||value.batchId!==expected.batchId||!same(value.anchor,expected.anchor)
      ||![value.sourceNativeCutSha256,value.combinedProgramSha256,value.serverProgramSha256,
        value.serverTailSha256,value.hostFrontierSha256,value.outputSha256].every(hash)
      ||value.combinedProgramSha256!==first.combinedProgramSha256||value.serverProgramSha256!==first.serverProgramSha256
      ||!same(value.epoch,first.epoch))fail()
    for(const ref of [value.epoch,value.dispatch,value.completion]) {
      exact(ref,['key','sha256']);if(!id(ref.key,512)||!hash(ref.sha256))fail()
    }
    for(const ref of [value.dispatchMarker,value.completionMarker]) {
      exact(ref,['seq','sha256']);if(!integer(ref.seq)||!hash(ref.sha256))fail()
    }
    // Each phase appends its own pair in the same opening Native chain.
    if(index===0&&value.dispatchMarker.seq!==previousMarkerSeq+1
      ||value.dispatchMarker.seq<=previousMarkerSeq||value.completionMarker.seq!==value.dispatchMarker.seq+1)fail()
    previousMarkerSeq=value.completionMarker.seq
  }
  if(!same(plan.execution,plan.phases.at(-1)!.execution))fail()
}
export function validateMvuSchemaOpeningPlan(input:unknown):FrozenMvuOpeningInitializationV3 {
  const value=freezeMvuSchemaOpeningData(input) as FrozenMvuOpeningInitializationV3
  exact(value,['schemaVersion','encoding','identity','selectedSwipeIdentity','authorSourceSha256','sourceSnapshot','initSource',
    'initialValuesSha256','birth','updateMessage','execution','values','valuesSha256','planSha256','host','server','phases','preparationSha256',
    'context','frontier'],['browser'])
  fact(value,'planSha256');inputFacts(value)
  if(value.schemaVersion!==10||value.encoding!=='mvu-programmatic-opening-plan-v10'||typeof value.updateMessage!=='string')fail()
  executionPhasesV8(value)
  hostIdentity(value.host);serverExecutorV4(value.server)
  if(value.selectedSwipeIdentity!==value.initSource.selectedSwipeIdentity||!hash(value.preparationSha256)||!hash(value.initialValuesSha256)
    ||value.valuesSha256!==recordSha256(cloneSchemaValues(value.values)))fail()
  if(!value.context||typeof value.context!=='object'||Array.isArray(value.context))fail()
  exact(value.frontier,['nativeCut','tailSha256','frontierSha256'])
  if(!integer(value.frontier.nativeCut)||!hash(value.frontier.tailSha256)||!hash(value.frontier.frontierSha256)
    ||value.frontier.nativeCut<value.execution.completionMarker.seq+1)fail()
  if(value.browser) {
    exact(value.browser,['schemaVersion','hooks','finalizedMessage'])
    if(value.browser.schemaVersion!==1||!Array.isArray(value.browser.hooks)||!value.browser.hooks.length
      ||typeof value.browser.finalizedMessage!=='string')fail()
  }
  return value
}
export function validateMvuSchemaNativeOpening(suppliedReceipt:MvuNativeOpeningReceipt,suppliedIntent:OpeningIntentV5):void {
  const receipt=freezeMvuSchemaOpeningData(suppliedReceipt),intent=freezeMvuSchemaOpeningData(suppliedIntent)
  exact(receipt,['sessionId','operationId','messageId','renderedSha256','turn','assistantSeq','turnStartSeq','turnEndSeq','messageVersion','flushed'])
  exact(receipt.messageVersion,['kind','eventSha256'])
  if(receipt.sessionId!==intent.sessionId||receipt.operationId!==intent.operationId||receipt.messageId!==intent.messageId
    ||receipt.renderedSha256!==intent.renderedSha256||receipt.turn!==intent.committedTurn||!integer(receipt.turn,1)
    ||receipt.flushed!==true||receipt.messageVersion.kind!=='original'||!hash(receipt.messageVersion.eventSha256)
    ||![receipt.assistantSeq,receipt.turnStartSeq,receipt.turnEndSeq].every(item=>integer(item))
    ||receipt.turnStartSeq>=receipt.assistantSeq||receipt.assistantSeq>=receipt.turnEndSeq
    ||!intent.initialization||receipt.turnStartSeq!==intent.initialization.frontier.nativeCut)fail()
}
export function validateMvuSchemaOpeningIntent(input:OpeningIntentV5):OpeningIntentV5 {
  const value=freezeMvuSchemaOpeningData(input)
  exact(value,['schemaVersion','sessionId','source','index','sourcePointer','sourceSha256','renderedSha256','renderedText','messageId',
    'operationId','revision','mode','status','textRetained','preparation'],
  ['committedTurn','rejectionCode','initialization','initializationCode','nativeReceipt','initializationReceipt'])
  identity(mvuSchemaOpeningIdentity(value));validateMvuSchemaOpeningPreparation(value.preparation)
  if(value.schemaVersion!==5||value.mode!=='schema'||value.textRetained!==true||!integer(value.revision,1)
    ||!['preparing','pending','native-committed','completed','blocked','unknown'].includes(value.status)
    ||typeof value.renderedText!=='string'||Buffer.byteLength(value.renderedText,'utf8')>65536||sha256(value.renderedText)!==value.renderedSha256
    ||!same(mvuSchemaOpeningIdentity(value),value.preparation.identity)
    ||value.initializationCode!==undefined&&schemaOpeningCode(value.initializationCode)!==value.initializationCode
    ||value.rejectionCode!==undefined&&!['PROGRAMMATIC_IDENTITY_CONFLICT','PROGRAMMATIC_OPEN_TURN','PROGRAMMATIC_MISSING_SYSTEM_HEAD',
      'PROGRAMMATIC_UNATTRIBUTED_FAILURE','PROGRAMMATIC_INCOMPLETE_TURN'].includes(value.rejectionCode))fail()
  if(value.initialization) {
    const plan=validateMvuSchemaOpeningPlan(value.initialization)
    if(!same(plan.host,value.preparation.host)||plan.preparationSha256!==value.preparation.preparationSha256)fail()
    for(const key of ['identity','authorSourceSha256','sourceSnapshot','initSource','birth'] as const) {
      if(!same(plan[key],value.preparation[key]))fail()
    }
  }
  if(value.status==='preparing'&&(value.initialization!==undefined||value.committedTurn!==undefined||value.nativeReceipt!==undefined)
    ||value.status==='pending'&&(value.committedTurn!==undefined||value.nativeReceipt!==undefined)
    ||['pending','native-committed','completed'].includes(value.status)&&!value.initialization
    ||value.committedTurn!==undefined&&!integer(value.committedTurn,1)
    ||['native-committed','completed'].includes(value.status)&&value.committedTurn===undefined)fail()
  if(value.nativeReceipt)validateMvuSchemaNativeOpening(value.nativeReceipt,value)
  if(value.status==='completed'&&(!value.nativeReceipt||!value.initializationReceipt))fail()
  if(value.initializationReceipt) {
    exact(value.initializationReceipt,['eventId','eventSha256','planSha256','valuesSha256','headSha256','headRevision'])
    if(value.initializationReceipt.headRevision!==1||!Object.entries(value.initializationReceipt)
      .filter(([key])=>key!=='headRevision').every(([,checksum])=>hash(checksum)))fail()
    if(!value.initialization||value.status!=='completed'||value.initializationReceipt.planSha256!==value.initialization.planSha256
      ||value.initializationReceipt.valuesSha256!==value.initialization.valuesSha256)fail()
  }
  return value
}
export function mvuSchemaOpeningEvent(plan:FrozenMvuOpeningInitializationV3,supplied:SchemaOpeningNative|MvuNativeOpeningReceipt):MvuSchemaOpeningEventV2 {
  const native:SchemaOpeningNative='kind' in supplied?supplied:{kind:'copy',receipt:supplied}
  return sealMvuSchemaOpeningFact({schemaVersion:3 as const,encoding:'mvu-schema-opening-event-v3' as const,
    eventId:sha256(`${plan.identity.sessionId}\0${plan.identity.operationId}\0${plan.planSha256}`),revision:1 as const,
    plan,native,executionSha256:recordSha256(plan.execution),valuesSha256:plan.valuesSha256},'eventSha256')
}
export function mvuSchemaOpeningHead(event:MvuSchemaOpeningEventV2):MvuSchemaOpeningHeadV2 {
  return freezeMvuSchemaOpeningData({schemaVersion:3,encoding:'mvu-schema-opening-head-v3',sessionId:event.plan.identity.sessionId,
    eventId:event.eventId,revision:1,eventSha256:event.eventSha256,planSha256:event.plan.planSha256,
    executionSha256:event.executionSha256,valuesSha256:event.valuesSha256})
}
export function validateMvuSchemaOpeningEvent(input:MvuSchemaOpeningEventV2):MvuSchemaOpeningEventV2 {
  const event=freezeMvuSchemaOpeningData(input),plan=validateMvuSchemaOpeningPlan(event.plan)
  if(event.native.kind==='copy') {
    if(plan.birth.kind!=='copy')fail()
    validateMvuSchemaNativeOpening(event.native.receipt,{...plan.identity,initialization:plan,
      committedTurn:event.native.receipt.turn} as OpeningIntentV5)
  }else {
    if(plan.birth.kind!=='generated')fail()
    const receipt=validateNativeGeneratedOpeningReceiptV1(event.native.receipt),canonical=event.native.canonical,birth=plan.birth,
      initialization=plan.phases[0].execution,firstRequest=receipt.steps[0]!.requests[0]!
    if(!same(receipt.invocationRef,birth.owner.invocationRef)||!same(receipt.identity,birth.owner.identity)
      ||receipt.turn!==birth.turn||canonical.seq!==receipt.terminalOutput.eventRef.seq
      ||canonical.messageId!==receipt.terminalOutput.messageId||canonical.versionSha256!==receipt.terminalOutput.messageSha256
      ||sha256(canonical.narrative)!==receipt.terminalOutput.textSha256||plan.updateMessage!==canonical.narrative
      ||initialization.dispatchMarker.seq<=receipt.turnStartRef.seq
      ||initialization.completionMarker.seq>=firstRequest.materialRef.seq
      ||plan.execution.dispatchMarker.seq<=receipt.turnEndRef.seq)fail()
  }
  if(!same(event,mvuSchemaOpeningEvent(plan,event.native)))fail()
  return event
}
export function validateMvuSchemaOpeningHead(input:MvuSchemaOpeningHeadV2):MvuSchemaOpeningHeadV2 {
  const head=freezeMvuSchemaOpeningData(input)
  exact(head,['schemaVersion','encoding','sessionId','eventId','revision','eventSha256','planSha256','executionSha256','valuesSha256'])
  if(head.schemaVersion!==3||head.encoding!=='mvu-schema-opening-head-v3'||!id(head.sessionId,64)||head.revision!==1
    ||![head.eventId,head.eventSha256,head.planSha256,head.executionSha256,head.valuesSha256].every(hash))fail()
  return head
}
export function validateSchemaOpeningRootFacts(input:SchemaOpeningRootFacts):SchemaOpeningRootFacts {
  // Each leaf owns its bounded DATA. Cloning this join would charge the same
  // Source again for every correlated view of the completed opening.
  const root=input,preparation=validateMvuSchemaOpeningPreparation(root.preparation),
    event=validateMvuSchemaOpeningEvent(root.event),head=validateMvuSchemaOpeningHead(root.head)
  if(root.intent.status!=='completed'||!same(root.plan,event.plan)||!same(root.native,event.native)||!same(head,mvuSchemaOpeningHead(event))
    ||!same(mvuSchemaOpeningIdentity(root.intent),preparation.identity))fail()
  for(const key of ['identity','authorSourceSha256','sourceSnapshot','initSource','birth'] as const) {
    if(!same(root.plan[key],preparation[key]))fail()
  }
  if(root.plan.preparationSha256!==preparation.preparationSha256)fail()
  return root
}
export function verifyMvuSchemaOpeningFacts(intent:OpeningIntentV5,event:MvuSchemaOpeningEventV2,head:MvuSchemaOpeningHeadV2):boolean {
  try {
    const actual=validateMvuSchemaOpeningIntent(intent)
    if(actual.status!=='completed'||!actual.initialization||!actual.nativeReceipt)return false
    const stored=validateMvuSchemaOpeningEvent(event),storedHead=validateMvuSchemaOpeningHead(head)
    const proposed=mvuSchemaOpeningEvent(actual.initialization,actual.nativeReceipt)
    return same(stored,proposed)&&same(storedHead,mvuSchemaOpeningHead(proposed))&&same(actual.initializationReceipt,{
      eventId:stored.eventId,eventSha256:stored.eventSha256,planSha256:storedHead.planSha256,
      valuesSha256:storedHead.valuesSha256,headSha256:recordSha256(storedHead),headRevision:1})
  } catch {return false}
}
