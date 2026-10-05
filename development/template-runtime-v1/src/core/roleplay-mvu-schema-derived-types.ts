/** Frozen schema inheritance is a factual baseline. None of these versioned
 * records carries a Native input capability, live lease or publication token. */
import {recordSha256} from './roleplay-data.js'
import {createImmutableDescriptorValidator} from './roleplay-mvu-schema-descriptor-data.js'
import {freezeMvuSchemaStoryData,sealMvuSchemaStoryFact,validateMvuSchemaNumericalSnapshot}
  from './roleplay-mvu-schema-story-types.js'
import {validateMvuSchemaOpeningIntent,validateMvuSchemaOpeningEvent,validateMvuSchemaOpeningHead}
  from './roleplay-mvu-schema-opening-types.js'
import {validateMvuDerivedSourceProof} from './roleplay-mvu-lineage.js'
import {validateMvuDerivedSourceProofUnion,validateMvuPreparedSourceRefV1} from './roleplay-mvu-frozen-lineage.js'
import {freezeImmutableSchemaDescriptorDataV4} from './roleplay-mvu-schema-descriptor-data.js'
import {schemaOriginalProgramSha256,schemaOriginalSnapshot} from './roleplay-mvu-schema-source.js'
import type {OpeningIntentV5,MvuSchemaOpeningEventV2,MvuSchemaOpeningHeadV2} from './roleplay-mvu-schema-opening-types.js'
import type {SchemaFrozenOriginal} from './roleplay-mvu-schema-source.js'
import type {SchemaJournalFrozenCut} from './roleplay-mvu-schema-journal.js'
import type {MvuSchemaNumericalSnapshotV2,MvuSchemaDerivedHeadV1,MvuSchemaStoryFrontier}
  from './roleplay-mvu-schema-story-types.js'
import type {MvuDerivedSourceProof} from './roleplay-mvu-lineage.js'
import type {MvuDerivedSourceProofV2} from './roleplay-mvu-frozen-lineage.js'
import type {TavernSourceFrozenRefV1} from './roleplay-tavern-source-inheritance-types.js'
import type {ForkOperation} from './roleplay-worldline-types.js'
import type {ForkReservation} from './roleplay-branch-routes-types.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export type MvuSchemaPrefixSeed=
  | {kind:'opening';intent:OpeningIntentV5;event:MvuSchemaOpeningEventV2;head:MvuSchemaOpeningHeadV2}
  | {kind:'derived';basisKey:string;basisSha256:string}
export interface MvuSchemaFrozenPrefixV1 {
  schemaVersion:1
  encoding:'native-mvu-schema-frozen-prefix-v1'
  sessionId:string
  inheritedEventCount:number
  sourceSha256:string
  original:SchemaFrozenOriginal
  seed:MvuSchemaPrefixSeed
  initial:MvuSchemaNumericalSnapshotV2
  journal:SchemaJournalFrozenCut
  eventKeys:readonly string[]
  snapshot:MvuSchemaNumericalSnapshotV2
  consumed:readonly {planSha256:string;closureSha256:string}[]
  prefixSha256:string
}
export interface MvuSchemaDerivedPreparedV1 {
  schemaVersion:1
  encoding:'native-mvu-schema-derived-prepared-v1'
  operationId:string
  anchorSha256:string
  parentSessionId:string
  childSessionId:string
  seedLength:number
  parentInheritedEventCount:number
  parentSourceSha256:string
  prefix:MvuSchemaFrozenPrefixV1
  preparedSha256:string
}
export interface MvuSchemaDerivedBasisV1 {
  schemaVersion:1
  encoding:'native-mvu-schema-derived-basis-v1'
  prepared:MvuSchemaDerivedPreparedV1
  source:MvuDerivedSourceProof
  basisSha256:string
}
export interface MvuSchemaDerivedPreparedV2 extends Omit<MvuSchemaDerivedPreparedV1,'schemaVersion'|'encoding'> {
  schemaVersion:2
  encoding:'native-mvu-schema-derived-prepared-v2'
  sourcePreparedRef:TavernSourceFrozenRefV1
  parentNumericDescriptorSha256:string
  prefixClosureRef:{key:string;sha256:string;closureSha256:string}
  forkReservationBinding:{operationId:string;anchor:ForkOperation['anchor'];reservation:ForkReservation;bindingSha256:string}
}
export interface MvuSchemaDerivedBasisV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-derived-basis-v2'
  prepared:MvuSchemaDerivedPreparedV2
  source:MvuDerivedSourceProofV2
  basisSha256:string
}
export type MvuSchemaDerivedPrepared=MvuSchemaDerivedPreparedV1|MvuSchemaDerivedPreparedV2
export type MvuSchemaDerivedBasis=MvuSchemaDerivedBasisV1|MvuSchemaDerivedBasisV2
export interface MvuSchemaDerivedEventV1 {
  schemaVersion:1
  encoding:'native-mvu-schema-derived-event-v1'
  sessionId:string
  sourceSha256:string
  revision:1
  eventId:string
  basisSha256:string
  planSha256:string
  values:MvuJsonObject
  valuesSha256:string
  context:MvuJsonObject
  contextSha256:string
  frontier:MvuSchemaStoryFrontier
  eventSha256:string
}
export interface MvuSchemaDerivedGenesis {
  sessionId:string
  basisKey:string
  basisSha256:string
  original:SchemaFrozenOriginal
  inheritedCut:SchemaJournalFrozenCut
  event:MvuSchemaDerivedEventV1
  head:MvuSchemaDerivedHeadV1
  snapshot:MvuSchemaNumericalSnapshotV2
}
export const mvuSchemaDerivedPreparedKey=(sid:string)=>`${sid}__mvu-schema-derived-prepared`
export const mvuSchemaPrefixClosureKey=(sid:string,sha:string)=>`${sid}__mvu-schema-prefix-input-${sha}`
export const mvuSchemaDerivedBasisKey=(sid:string)=>`${sid}__mvu-schema-derived-basis`
export const mvuSchemaDerivedEventKey=(sid:string)=>`${sid}__mvu-state-schema-derived-event`
export const mvuSchemaDerivedHeadKey=(sid:string)=>`${sid}__mvu-state-schema-derived-head`
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const id=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)
const integer=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&!Object.is(value,-0)
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
function fail():never {throw Error('SCHEMA_DERIVED_RECORD_INVALID')}
function exact(value:object,keys:readonly string[]) {
  if(!same(Object.keys(value).sort(),[...keys].sort()))fail()
}
function checksum(value:object,key:string) {
  const {[key]:digest,...body}=value as Record<string,unknown>
  if(!hash(digest)||recordSha256(body)!==digest)fail()
}
const validateFrozenPrefixDescriptor=createImmutableDescriptorValidator(validateFrozenPrefixUncached)
export function validateMvuSchemaFrozenPrefix(input:MvuSchemaFrozenPrefixV1):MvuSchemaFrozenPrefixV1 {
  return validateFrozenPrefixDescriptor(input)
}
function validateFrozenPrefixUncached(input:MvuSchemaFrozenPrefixV1):MvuSchemaFrozenPrefixV1 {
  const prefix=freezeMvuSchemaStoryData(input)
  exact(prefix,['schemaVersion','encoding','sessionId','inheritedEventCount','sourceSha256','original',
    'seed','initial','journal','eventKeys','snapshot','consumed','prefixSha256'])
  checksum(prefix,'prefixSha256')
  const initial=validateMvuSchemaNumericalSnapshot(prefix.initial),snapshot=validateMvuSchemaNumericalSnapshot(prefix.snapshot)
  if(prefix.schemaVersion!==1||prefix.encoding!=='native-mvu-schema-frozen-prefix-v1'||!id(prefix.sessionId)
    ||!integer(prefix.inheritedEventCount)||!hash(prefix.sourceSha256)
    ||initial.sessionId!==prefix.sessionId||snapshot.sessionId!==prefix.sessionId
    ||initial.sourceSha256!==prefix.sourceSha256||snapshot.sourceSha256!==prefix.sourceSha256
    ||!same(initial.root,snapshot.root)||prefix.journal.sessionId!==prefix.sessionId
    ||prefix.journal.realmEpoch!==prefix.original.realmEpoch
    ||schemaOriginalProgramSha256(prefix.original)!==snapshot.root.programSha256
    ||prefix.original.realmEpoch!==snapshot.root.realmEpoch||prefix.inheritedEventCount>prefix.journal.nativeCut
    ||!Array.isArray(prefix.eventKeys)||new Set(prefix.eventKeys).size!==prefix.eventKeys.length
    ||prefix.eventKeys.some(key=>typeof key!=='string'||!key.startsWith(`${prefix.sessionId}__mvu-state-schema-`))
    ||!Array.isArray(prefix.consumed)||prefix.consumed.length!==prefix.eventKeys.length
    ||new Set(prefix.consumed.map(item=>item.planSha256)).size!==prefix.consumed.length)fail()
  for(const item of prefix.consumed) {
    exact(item,['planSha256','closureSha256'])
    if(!hash(item.planSha256)||!hash(item.closureSha256))fail()
  }
  if(prefix.seed.kind==='opening') {
    exact(prefix.seed,['kind','intent','event','head'])
    validateMvuSchemaOpeningIntent(prefix.seed.intent)
    validateMvuSchemaOpeningEvent(prefix.seed.event)
    validateMvuSchemaOpeningHead(prefix.seed.head)
    if(prefix.inheritedEventCount!==0||initial.root.derived)fail()
    if(prefix.original.schemaVersion===5&&(prefix.seed.intent.preparation.schemaVersion!==5
      ||prefix.seed.event.plan.schemaVersion!==7))fail()
  }else if(prefix.seed.kind==='derived') {
    exact(prefix.seed,['kind','basisKey','basisSha256'])
    if(prefix.seed.basisKey!==mvuSchemaDerivedBasisKey(prefix.sessionId)||!hash(prefix.seed.basisSha256)
      ||initial.root.derived?.basisSha256!==prefix.seed.basisSha256)fail()
  }else fail()
  return prefix
}
const validateDerivedPreparedDescriptor=createImmutableDescriptorValidator(validateDerivedPreparedUncached)
export function validateMvuSchemaDerivedPrepared(input:MvuSchemaDerivedPrepared):MvuSchemaDerivedPrepared {
  return validateDerivedPreparedDescriptor(input)
}
function validateDerivedPreparedUncached(input:MvuSchemaDerivedPrepared):MvuSchemaDerivedPrepared {
  const bounded=freezeImmutableSchemaDescriptorDataV4(input,16_777_216,{nodes:131_072,depth:96})
  const prepared=bounded.schemaVersion===2?bounded:freezeMvuSchemaStoryData(bounded)
  exact(prepared,['schemaVersion','encoding','operationId','anchorSha256','parentSessionId','childSessionId',
    'seedLength','parentInheritedEventCount','parentSourceSha256','prefix','preparedSha256',
    ...(prepared.schemaVersion===2?['sourcePreparedRef','parentNumericDescriptorSha256','prefixClosureRef','forkReservationBinding']:[])])
  checksum(prepared,'preparedSha256')
  const prefix=validateMvuSchemaFrozenPrefix(prepared.prefix)
  if((prepared.schemaVersion===1?prepared.encoding!=='native-mvu-schema-derived-prepared-v1'
      :prepared.schemaVersion!==2||prepared.encoding!=='native-mvu-schema-derived-prepared-v2')
    ||![prepared.operationId,prepared.parentSessionId,prepared.childSessionId].every(id)
    ||prepared.parentSessionId===prepared.childSessionId||!hash(prepared.anchorSha256)
    ||!integer(prepared.seedLength)||prepared.seedLength<1||!integer(prepared.parentInheritedEventCount)
    ||prepared.parentInheritedEventCount>=prepared.seedLength||!hash(prepared.parentSourceSha256)
    ||prefix.sessionId!==prepared.parentSessionId||prefix.journal.nativeCut!==prepared.seedLength
    ||prefix.inheritedEventCount!==prepared.parentInheritedEventCount||prefix.sourceSha256!==prepared.parentSourceSha256)fail()
  if(prepared.schemaVersion===2) {
    const ref=validateMvuPreparedSourceRefV1(prepared.sourcePreparedRef),binding=prepared.forkReservationBinding
    exact(prepared.prefixClosureRef,['key','sha256','closureSha256'])
    exact(binding,['operationId','anchor','reservation','bindingSha256'])
    const {bindingSha256,...body}=binding
    if(ref.childSessionId!==prepared.childSessionId||ref.parentSessionId!==prepared.parentSessionId
      ||ref.operationId!==prepared.operationId||ref.anchorSha256!==prepared.anchorSha256
      ||ref.seedLength!==prepared.seedLength||ref.prefixSha256!==prefix.journal.nativePrefixSha256
      ||prepared.parentNumericDescriptorSha256!==prepared.parentSourceSha256
      ||!hash(prepared.prefixClosureRef.sha256)||!hash(prepared.prefixClosureRef.closureSha256)
      ||prepared.prefixClosureRef.key!==mvuSchemaPrefixClosureKey(prepared.childSessionId,prepared.prefixClosureRef.closureSha256)
      ||binding.operationId!==prepared.operationId||recordSha256(binding.anchor)!==prepared.anchorSha256
      ||!same(binding.reservation,{sourceSessionId:prepared.parentSessionId,
        childSessionId:prepared.childSessionId,seedLength:prepared.seedLength})
      ||!hash(bindingSha256)||bindingSha256!==recordSha256(body))fail()
  }
  return prepared
}
const validateDerivedBasisDescriptor=createImmutableDescriptorValidator(validateDerivedBasisUncached)
export function validateMvuSchemaDerivedBasis(input:MvuSchemaDerivedBasis):MvuSchemaDerivedBasis {
  return validateDerivedBasisDescriptor(input)
}
function validateDerivedBasisUncached(input:MvuSchemaDerivedBasis):MvuSchemaDerivedBasis {
  const bounded=freezeImmutableSchemaDescriptorDataV4(input,16_777_216,{nodes:131_072,depth:96})
  const basis=bounded.schemaVersion===2?bounded:freezeMvuSchemaStoryData(bounded)
  exact(basis,['schemaVersion','encoding','prepared','source','basisSha256'])
  checksum(basis,'basisSha256')
  const prepared=validateMvuSchemaDerivedPrepared(basis.prepared),source=basis.schemaVersion===2
    ?validateMvuDerivedSourceProofUnion(basis.source):validateMvuDerivedSourceProof(basis.source)
  if((basis.schemaVersion===1?basis.encoding!=='native-mvu-schema-derived-basis-v1'
      ||prepared.schemaVersion!==1||source.schemaVersion!==1:basis.schemaVersion!==2
      ||basis.encoding!=='native-mvu-schema-derived-basis-v2'||prepared.schemaVersion!==2||source.schemaVersion!==2)
    ||source.parentSessionId!==prepared.parentSessionId||source.childSessionId!==prepared.childSessionId
    ||source.expectedSeedLength!==prepared.seedLength||source.parentSourceSha256!==prepared.parentSourceSha256)fail()
  const originalSnapshot=schemaOriginalSnapshot(prepared.prefix.original)
  const original=originalSnapshot.source,imported=source.originalImport
  if(imported.ownerSessionId!==original.sourceRecordSessionId||imported.importId!==original.importId
    ||imported.rawSha256!==original.rawSha256||imported.normalizedSha256!==original.normalizedSha256
    ||imported.coverageSha256!==original.coverageSha256||imported.transactionId!==original.transactionId
    ||imported.recordSha256!==originalSnapshot.importRecordSha256)fail()
  return basis
}
export function mvuSchemaDerivedGenesis(input:MvuSchemaDerivedBasis):MvuSchemaDerivedGenesis {
  const basis=validateMvuSchemaDerivedBasis(input),prepared=basis.prepared,sid=prepared.childSessionId
  const sourceSha256=basis.source.childSourceSha256,parent=prepared.prefix.snapshot
  const eventId=recordSha256({encoding:'native-mvu-schema-derived-event-identity-v1',sessionId:sid,basisSha256:basis.basisSha256})
  const event=sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-mvu-schema-derived-event-v1' as const,
    sessionId:sid,sourceSha256,revision:1 as const,eventId,basisSha256:basis.basisSha256,planSha256:prepared.preparedSha256,
    values:parent.values,valuesSha256:parent.valuesSha256,context:parent.context,contextSha256:recordSha256(parent.context),
    frontier:parent.schemaFrontier},'eventSha256')
  const head:MvuSchemaDerivedHeadV1={schemaVersion:1,encoding:'native-mvu-schema-derived-head-v1',sessionId:sid,
    sourceSha256,revision:1,eventId,eventSha256:event.eventSha256,planSha256:prepared.preparedSha256,
    basisSha256:basis.basisSha256,valuesSha256:parent.valuesSha256}
  // The derived root references the separately stored head, avoiding a circular
  // head/root digest while retaining the original author epoch and program.
  const {derived:_previousDerived,...originalRoot}=parent.root
  const root={...originalRoot,derived:{schemaVersion:1 as const,encoding:'native-mvu-schema-derived-root-v1' as const,
    eventId,eventSha256:event.eventSha256,headSha256:recordSha256(head),basisSha256:basis.basisSha256}}
  const snapshot=validateMvuSchemaNumericalSnapshot(sealMvuSchemaStoryFact({schemaVersion:2 as const,
    encoding:'native-mvu-schema-state-snapshot-v2' as const,sessionId:sid,sourceSha256,root,currentHead:head,
    revision:1,headSha256:recordSha256(head),values:parent.values,valuesSha256:parent.valuesSha256,
    context:parent.context,schemaFrontier:parent.schemaFrontier},'stateSnapshotSha256'))
  return freezeMvuSchemaStoryData({sessionId:sid,basisKey:mvuSchemaDerivedBasisKey(sid),basisSha256:basis.basisSha256,
    original:prepared.prefix.original,inheritedCut:prepared.prefix.journal,event,head,snapshot})
}
