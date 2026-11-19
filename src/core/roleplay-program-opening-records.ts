/** Independent immutable opening inputs and a mutable recovery anchor. No
 * deserialized record grants Source, Native, material or publication rights. */
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {validatePromptOpeningSourceProofV1} from './roleplay-prompt-opening-source.js'
import {validateMvuSchemaOpeningPreparation,validateMvuSchemaOpeningEvent,validateMvuSchemaOpeningHead,
  mvuSchemaOpeningHead} from './roleplay-mvu-schema-opening-types.js'
import {validateNativeGeneratedOpeningReceiptV1} from 'dsh-nexttavern-native-agent-loop'
import type {OpeningSource} from './roleplay-opening-selection.js'
import type {PromptOpeningSourceProofV1} from './roleplay-prompt-opening-source-types.js'
import type {ProgramOpeningBasisProofV1} from './roleplay-program-opening-basis-types.js'
import type {MvuSchemaOpeningPreparation,SchemaOpeningRootFacts} from './roleplay-mvu-schema-opening-types.js'
import type {GeneratedOpeningInitialization} from './roleplay-mvu-schema-core.js'
import {validateSchemaJournalRecord} from './roleplay-mvu-schema-journal.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuNativeOpeningReceipt} from './roleplay-mvu-initialization.js'
import type {NativeGeneratedOpeningReceiptV1} from 'dsh-nexttavern-native-agent-loop'
import type {CompletedStoryBody} from './roleplay-mvu-story.js'

export interface ProgramOpeningDataRefV1 {readonly key:string;readonly sha256:string}
export interface ProgramOpeningIdentityV1 {
  readonly sessionId:string
  readonly operationId:string
  readonly requestedMessageId:string
  readonly production:'selected-card-copy'|'generated-opening'
  readonly instructionSha256:string|null
  readonly intentRef:ProgramOpeningDataRefV1
  readonly inputRef:ProgramOpeningDataRefV1
}

export interface ProgramOpeningIntentSeedV1 {
  readonly schemaVersion:1
  readonly encoding:'native-program-opening-intent-seed-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly source:OpeningSource
  readonly operationId:string
  readonly requestedMessageId:string
  readonly production:ProgramOpeningIdentityV1['production']
  readonly instructionSha256:string|null
  readonly sourceProofSha256:string
  readonly sourceBindingSha256:string
  readonly basisSha256:string
  readonly selected:{readonly index:number;readonly sourcePointer:string;
    readonly sourceSha256:string;readonly renderedSha256:string}
  readonly seedSha256:string
}
export interface ProgramOpeningInputPacketV1 {
  readonly schemaVersion:1
  readonly encoding:'native-program-opening-input-packet-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly seedRef:ProgramOpeningDataRefV1
  readonly source:PromptOpeningSourceProofV1
  readonly basis:ProgramOpeningBasisProofV1
  readonly instruction:string|null
  readonly initialization:'absent'|'schema'
  readonly schemaSource:Omit<MvuSchemaOpeningPreparation,'birth'|'preparationSha256'>|null
  /** Root's existing numerical observation constructor owns this SHA. */
  readonly numericalSourceSha256:string
  readonly inputSha256:string
}
export interface ProgramOpeningSchemaSection {
  readonly preparation:MvuSchemaOpeningPreparation
  readonly initialization:GeneratedOpeningInitialization
  readonly publication?:Pick<SchemaOpeningRootFacts,'plan'|'native'|'event'|'head'>
}
export type ProgramOpeningNativeFactsV1=(
  {readonly production:'selected-card-copy';readonly receipt:MvuNativeOpeningReceipt;readonly canonical:null}
  |{readonly production:'generated-opening';readonly receipt:NativeGeneratedOpeningReceiptV1;
    readonly canonical:CompletedStoryBody})&{
  readonly schemaVersion:1
  readonly encoding:'native-program-opening-native-facts-v1'
  readonly factsSha256:string
}
export type ProgramOpeningDomainReceiptV1=
  |{readonly kind:'schema-opening';readonly eventId:string;readonly eventSha256:string;readonly headSha256:string;
    readonly planSha256:string;readonly valuesSha256:string}
  |{readonly kind:'prompt-absence';readonly domainRef:ProgramOpeningDataRefV1;readonly sourceProofSha256:string;
    readonly basisSha256:string;readonly nativeFactsSha256:string}
export interface ProgramOpeningAbsentDomainV1 {
  readonly schemaVersion:1
  readonly encoding:'native-program-opening-absence-domain-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly operationId:string
  readonly requestedMessageId:string
  readonly seedRef:ProgramOpeningDataRefV1
  readonly inputRef:ProgramOpeningDataRefV1
  readonly sourceProofSha256:string
  readonly sourceBindingSha256:string
  readonly basisSha256:string
  readonly nativeFacts:ProgramOpeningNativeFactsV1
  readonly domainSha256:string
}
export interface OpeningIntentV7 {
  readonly schemaVersion:7
  readonly mode:'prompt-program'
  readonly sessionId:string
  readonly source:OpeningSource
  readonly index:number
  readonly sourcePointer:string
  readonly sourceSha256:string
  readonly renderedSha256:string
  readonly renderedText:string
  readonly textRetained:true
  readonly operationId:string
  readonly messageId:string
  readonly production:ProgramOpeningIdentityV1['production']
  readonly revision:number
  readonly status:'prepared'|'native-unknown'|'native-committed'|'domain-blocked'|'completed'
  readonly seedRef:ProgramOpeningDataRefV1
  readonly inputRef:ProgramOpeningDataRefV1
  readonly schemaOpening?:ProgramOpeningSchemaSection
  readonly nativeReceipt?:ProgramOpeningNativeFactsV1
  readonly committedTurn?:number
  readonly domainReceipt?:ProgramOpeningDomainReceiptV1
  readonly diagnosis?:string
}

const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const id=(value:unknown,maximum=128):value is string=>typeof value==='string'&&value.length>0
  &&value.length<=maximum&&/^[a-zA-Z0-9_-]+$/.test(value)
const count=(value:unknown,positive=false):value is number=>typeof value==='number'
  &&Number.isSafeInteger(value)&&value>=(positive?1:0)&&!Object.is(value,-0)
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
function fail():never {throw Error('PROGRAM_OPENING_RECORD_INVALID')}
// These private tables contain only our deeply frozen successful parser
// outputs. They cache data consistency, never storage membership, Source or
// Native currency. Foreign frozen objects and deserialized clones miss them.
type RecordBinding={readonly seedSha256:string;readonly inputSha256:string}
type BasisDataHashes=Readonly<{bodySha256:string;branchSha256:string;
  sourceRelationSha256:string;expectedSourceRelationSha256:string}>
const checkedSeeds=new WeakMap<ProgramOpeningIntentSeedV1,string>()
const checkedInputs=new WeakMap<ProgramOpeningInputPacketV1,{
  readonly seedSha256:string;readonly wholeSha256:string}>()
const checkedBases=new WeakMap<ProgramOpeningBasisProofV1,{
  readonly source:PromptOpeningSourceProofV1;readonly sessionId:string
  readonly operationId:string;readonly requestedMessageId:string;readonly dataHashes:BasisDataHashes}>()
const checkedNativeFacts=new WeakMap<ProgramOpeningNativeFactsV1,RecordBinding>()
const checkedAbsentDomains=new WeakMap<ProgramOpeningAbsentDomainV1,RecordBinding>()
function seedWholeSha256(seed:ProgramOpeningIntentSeedV1):string {
  const digest=checkedSeeds.get(seed)
  if(digest===undefined)fail()
  return digest
}
function recordBinding(seed:ProgramOpeningIntentSeedV1,packet:ProgramOpeningInputPacketV1):RecordBinding {
  const input=checkedInputs.get(packet),seedSha256=seedWholeSha256(seed)
  if(!input||input.seedSha256!==seedSha256)fail()
  return {seedSha256,inputSha256:input.wholeSha256}
}
function boundRecord<T extends object>(input:unknown,records:WeakMap<T,RecordBinding>,binding:RecordBinding):T|undefined {
  if(input===null||typeof input!=='object')return undefined
  const cached=records.get(input as T)
  return cached?.seedSha256===binding.seedSha256&&cached.inputSha256===binding.inputSha256?input as T:undefined
}
/** Child parsers preserve the checked record's data while returning their
 * own frozen identities. No current permission is inherited here. */
function parsedChildren<T extends object>(data:T,children:Partial<T>):T {
  return Object.freeze({...data,...children})
}
export function programOpeningRecordDataV1<T>(input:T):T {
  const detached=cloneRoleplayTavernLoreDataV1(input),pending:unknown[]=[detached]
  while(pending.length) {
    const value=pending.pop()
    if(value&&typeof value==='object'){pending.push(...Object.values(value));Object.freeze(value)}
  }
  return detached
}
function exact(value:unknown,keys:readonly string[]):asserts value is Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length
    ||keys.some(key=>!Object.hasOwn(value,key)))fail()
}
function sealed(value:Record<string,unknown>,key:string):void {
  const {[key]:digest,...body}=value
  if(!hash(digest)||recordSha256(body)!==digest)fail()
}
function ref(value:unknown):asserts value is ProgramOpeningDataRefV1 {
  exact(value,['key','sha256']);if(!id(value['key'],512)||!hash(value['sha256']))fail()
}
function optionalShape(value:unknown,required:readonly string[],optional:readonly string[]):asserts value is Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)||required.some(key=>!Object.hasOwn(value,key))
    ||Object.keys(value).some(key=>!required.includes(key)&&!optional.includes(key)))fail()
}
function instruction(value:unknown,production:ProgramOpeningIdentityV1['production']):string|null {
  if(production==='selected-card-copy'){if(value!==null)fail();return null}
  if(typeof value!=='string'||!value.trim()||!value.isWellFormed()||Buffer.byteLength(value,'utf8')>65_536)fail()
  return value
}
/** Preserves the source-owned pointer bytes, including the actual committed
 * fresh child's registered inheritedFrom field; it grants no Source lineage. */
function sourceTuple(value:unknown,sid:string):asserts value is OpeningSource {
  exact(value,['sessionId','importId','sourceRecordSessionId','rawSha256','normalizedSha256','transactionId','coverageSha256','pointer'])
  if(value['sessionId']!==sid||!id(sid,64)||!id(value['importId'],64)||!id(value['sourceRecordSessionId'],64)
    ||!id(value['transactionId'],128)||!hash(value['rawSha256'])||!hash(value['normalizedSha256'])
    ||!hash(value['coverageSha256']))fail()
  const pointer=value['pointer']
  optionalShape(pointer,['importId','normalizedSha256','transactionId','coverageSha256'],
    ['sourceRecordSessionId','activatedAt','inheritedFrom'])
  if(pointer['importId']!==value['importId']||pointer['normalizedSha256']!==value['normalizedSha256']
    ||pointer['transactionId']!==value['transactionId']||pointer['coverageSha256']!==value['coverageSha256']
    ||(pointer['sourceRecordSessionId']??sid)!==value['sourceRecordSessionId']
    ||Object.hasOwn(pointer,'sourceRecordSessionId')&&!id(pointer['sourceRecordSessionId'],64)
    ||Object.hasOwn(pointer,'activatedAt')&&!count(pointer['activatedAt'])
    ||Object.hasOwn(pointer,'inheritedFrom')&&!id(pointer['inheritedFrom'],64))fail()
}
/** Complete inert basis grammar and joins. Actual absence, history, metadata
 * and storage membership must still be proved by Root's private supplier. */
export function validateProgramOpeningBasisProofV1(input:unknown,rawSource:PromptOpeningSourceProofV1,
  owned:Pick<ProgramOpeningIdentityV1,'sessionId'|'operationId'|'requestedMessageId'>):ProgramOpeningBasisProofV1 {
  const source=validatePromptOpeningSourceProofV1(rawSource),cached=input!==null&&typeof input==='object'
    ?checkedBases.get(input as ProgramOpeningBasisProofV1):undefined
  if(cached?.source===source&&cached.sessionId===owned.sessionId&&cached.operationId===owned.operationId
    &&cached.requestedMessageId===owned.requestedMessageId)return input as ProgramOpeningBasisProofV1
  const data=programOpeningRecordDataV1(input)
  exact(data,['schemaVersion','encoding','authority','sessionId','ownerSessionId','origin','operationId',
    'requestedMessageId','sourceBindingSha256','sourceRelation','branch','native','basisSha256'])
  sealed(data,'basisSha256');exact(data['branch'],['metaKey','metaCurrentIdentitySha256','parentSessionId','inheritedEventCount','ready'])
  exact(data['native'],['observedThroughSeq','eventCount','historySha256'])
  if(!id(owned.sessionId,64)||!id(owned.operationId)||!id(owned.requestedMessageId)
    ||data['schemaVersion']!==1||data['encoding']!=='native-program-opening-fresh-basis-proof-v1'
    ||data['authority']!=='consumer-data-only'||data['sessionId']!==owned.sessionId
    ||data['ownerSessionId']!==owned.sessionId||source.source.sessionId!==owned.sessionId
    ||data['operationId']!==owned.operationId||data['requestedMessageId']!==owned.requestedMessageId
    ||data['sourceBindingSha256']!==source.bindingSha256)fail()
  const branch=data['branch'],native=data['native'],sid=owned.sessionId
  if(branch['metaKey']!==`${sid}__meta`||!hash(branch['metaCurrentIdentitySha256'])
    ||branch['parentSessionId']!==null||branch['inheritedEventCount']!==0||branch['ready']!==true
    ||!count(native['eventCount'])||native['observedThroughSeq']!==native['eventCount']-1||!hash(native['historySha256']))fail()
  const relation=data['sourceRelation']
  if(relation&&typeof relation==='object'&&!Array.isArray(relation)&&(relation as {kind:unknown}).kind==='own-root') {
    exact(relation,['kind','inheritance'])
    if(data['origin']!=='own-root'||relation['inheritance']!==null||source.sourceRelation.kind!=='own-root-source')fail()
  }else if(relation&&typeof relation==='object'&&!Array.isArray(relation)
    &&(relation as {kind:unknown}).kind==='legacy-fresh-child') {
    exact(relation,['kind','legacyCopy'])
    if(data['origin']!=='fresh-scene'||source.sourceRelation.kind!=='legacy-fresh-copy-source'
      ||!same(relation['legacyCopy'],source.sourceRelation.legacyCopy))fail()
  }else {
    exact(relation,['kind','inheritance','setup','setupSha256'])
    if(data['origin']!=='fresh-scene'||relation['kind']!=='reserved-fresh-child'
      ||source.sourceRelation.kind!=='committed-fresh-cut0-source'
      ||!same(relation['inheritance'],source.sourceRelation.inheritance)||!same(relation['setup'],source.sourceRelation.setup)
      ||!hash(relation['setupSha256'])||recordSha256(relation['setup'])!==relation['setupSha256'])fail()
  }
  const checked=data as unknown as ProgramOpeningBasisProofV1
  const sourceRelation=source.sourceRelation,
    expectedSourceRelation=sourceRelation.kind==='own-root-source'?{kind:'own-root',inheritance:null}:
      sourceRelation.kind==='legacy-fresh-copy-source'?{kind:'legacy-fresh-child',legacyCopy:sourceRelation.legacyCopy}:
      {kind:'reserved-fresh-child',inheritance:sourceRelation.inheritance,setup:sourceRelation.setup,
        setupSha256:recordSha256(sourceRelation.setup)},
    dataHashes=Object.freeze({bodySha256:checked.basisSha256,branchSha256:recordSha256(checked.branch),
      sourceRelationSha256:recordSha256(checked.sourceRelation),
      expectedSourceRelationSha256:recordSha256(expectedSourceRelation)})
  checkedBases.set(checked,{source,sessionId:owned.sessionId,
    operationId:owned.operationId,requestedMessageId:owned.requestedMessageId,dataHashes})
  return checked
}
/** Pure hashes of this parser's exact immutable data, bound to its original
 * parsed Source and identity. No current owner or execution permission is cached. */
export function programOpeningBasisDataHashesV1(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
  identity:Pick<ProgramOpeningIdentityV1,'sessionId'|'operationId'|'requestedMessageId'>):BasisDataHashes|undefined {
  const cached=checkedBases.get(proof)
  if(!cached||cached.source!==source||cached.sessionId!==identity.sessionId
    ||cached.operationId!==identity.operationId||cached.requestedMessageId!==identity.requestedMessageId)return undefined
  return cached.dataHashes
}
export const programOpeningSeedKeyV1=(sid:string,op:string)=>`${sid}__program-opening-seed-${sha256(op)}`
export const programOpeningInputKeyV1=(sid:string,op:string)=>`${sid}__program-opening-input-${sha256(op)}`
export const programOpeningPlanKeyV1=(sid:string,op:string)=>`${sid}__program-opening-plan-${sha256(op)}`
export const programOpeningDomainKeyV1=(sid:string,op:string)=>`${sid}__program-opening-domain-${sha256(op)}`
export function programOpeningDataSha256V1(value:object):string {
  // Only successful parser outputs enter these tables, and their complete
  // trees are frozen. The whole-row digest remains distinct from a body's
  // seedSha256/inputSha256. Actual storage reads still hash their own bytes.
  const ownedSeed=checkedSeeds.get(value as ProgramOpeningIntentSeedV1),
    ownedInput=checkedInputs.get(value as ProgramOpeningInputPacketV1)
  return ownedSeed??ownedInput?.wholeSha256??recordSha256(value)
}
export function programOpeningRefV1(key:string,value:object):ProgramOpeningDataRefV1 {
  return {key,sha256:programOpeningDataSha256V1(value)}
}

export function createProgramOpeningSeedV1(input:{source:PromptOpeningSourceProofV1;basis:ProgramOpeningBasisProofV1;
  operationId:string;messageId:string;production:ProgramOpeningIdentityV1['production'];instruction:string|null}):ProgramOpeningIntentSeedV1 {
  const source=validatePromptOpeningSourceProofV1(input.source),selected=source.selected,
    basis=validateProgramOpeningBasisProofV1(input.basis,source,{sessionId:source.source.sessionId,
      operationId:input.operationId,requestedMessageId:input.messageId}),text=instruction(input.instruction,input.production),
    body={schemaVersion:1 as const,encoding:'native-program-opening-intent-seed-v1' as const,
      authority:'consumer-data-only' as const,sessionId:source.source.sessionId,source:source.source,
      operationId:input.operationId,requestedMessageId:input.messageId,production:input.production,
      instructionSha256:text===null?null:sha256(text),sourceProofSha256:source.proofSha256,
      sourceBindingSha256:source.bindingSha256,basisSha256:basis.basisSha256,
      selected:{index:selected.index,sourcePointer:selected.sourcePointer,sourceSha256:selected.sourceSha256,
        renderedSha256:selected.renderedSha256}}
  return validateProgramOpeningSeedV1({...body,seedSha256:recordSha256(body)})
}
export function validateProgramOpeningSeedV1(input:unknown):ProgramOpeningIntentSeedV1 {
  if(input!==null&&typeof input==='object'&&checkedSeeds.has(input as ProgramOpeningIntentSeedV1)) {
    return input as ProgramOpeningIntentSeedV1
  }
  const data=programOpeningRecordDataV1(input)
  exact(data,['schemaVersion','encoding','authority','sessionId','source','operationId','requestedMessageId',
    'production','instructionSha256','sourceProofSha256','sourceBindingSha256','basisSha256','selected','seedSha256'])
  sealed(data,'seedSha256');exact(data['selected'],['index','sourcePointer','sourceSha256','renderedSha256'])
  if(data['schemaVersion']!==1||data['encoding']!=='native-program-opening-intent-seed-v1'
    ||data['authority']!=='consumer-data-only'||!id(data['sessionId'])||!id(data['operationId'])
    ||!id(data['requestedMessageId'])||!['selected-card-copy','generated-opening'].includes(String(data['production']))
    ||(data['production']==='generated-opening'?!hash(data['instructionSha256']):data['instructionSha256']!==null))fail()
  for(const key of ['sourceProofSha256','sourceBindingSha256','basisSha256'])if(!hash(data[key]))fail()
  sourceTuple(data['source'],data['sessionId'])
  const selected=data['selected']
  if(!count(selected['index'])||typeof selected['sourcePointer']!=='string'||!selected['sourcePointer'].startsWith('/')
    ||selected['sourcePointer'].length>512
    ||!hash(selected['sourceSha256'])||!hash(selected['renderedSha256']))fail()
  const checked=data as unknown as ProgramOpeningIntentSeedV1
  checkedSeeds.set(checked,recordSha256(checked))
  return checked
}
export function createProgramOpeningInputV1(input:{seed:ProgramOpeningIntentSeedV1;seedRef:ProgramOpeningDataRefV1;
  source:PromptOpeningSourceProofV1;basis:ProgramOpeningBasisProofV1;instruction:string|null;
  numericalSourceSha256:string;schemaSource?:ProgramOpeningInputPacketV1['schemaSource']}):ProgramOpeningInputPacketV1 {
  const seed=validateProgramOpeningSeedV1(input.seed),source=validatePromptOpeningSourceProofV1(input.source),
    basis=validateProgramOpeningBasisProofV1(input.basis,source,{sessionId:seed.sessionId,
      operationId:seed.operationId,requestedMessageId:seed.requestedMessageId}),
    detached=programOpeningRecordDataV1({seedRef:input.seedRef,schemaSource:input.schemaSource??null})
  const body:Omit<ProgramOpeningInputPacketV1,'inputSha256'>={
    schemaVersion:1,encoding:'native-program-opening-input-packet-v1',authority:'consumer-data-only',
    sessionId:seed.sessionId,seedRef:detached.seedRef,source,basis,instruction:input.instruction,
    initialization:detached.schemaSource===null?'absent':'schema',schemaSource:detached.schemaSource,
    numericalSourceSha256:input.numericalSourceSha256}
  // The children have their own parser provenance. Validate their joins before
  // sealing this producer's row, retaining the registered Source/program tree.
  checkProgramOpeningInput(body,seed)
  const checked=Object.freeze({...body,inputSha256:recordSha256(body)})
  checkedInputs.set(checked,{seedSha256:seedWholeSha256(seed),wholeSha256:recordSha256(checked)})
  return checked
}
export function validateProgramOpeningInputV1(input:unknown,rawSeed:ProgramOpeningIntentSeedV1):ProgramOpeningInputPacketV1 {
  const seed=validateProgramOpeningSeedV1(rawSeed),seedSha256=seedWholeSha256(seed),
    cached=input!==null&&typeof input==='object'?checkedInputs.get(input as ProgramOpeningInputPacketV1):undefined
  if(cached?.seedSha256===seedSha256)return input as ProgramOpeningInputPacketV1
  const data=programOpeningRecordDataV1(input)
  exact(data,['schemaVersion','encoding','authority','sessionId','seedRef','source','basis','instruction',
    'initialization','schemaSource','numericalSourceSha256','inputSha256'])
  sealed(data,'inputSha256')
  const source=validatePromptOpeningSourceProofV1(data['source']),basis=validateProgramOpeningBasisProofV1(data['basis'],source,
    {sessionId:seed.sessionId,operationId:seed.operationId,requestedMessageId:seed.requestedMessageId})
  const checked=parsedChildren(data as unknown as ProgramOpeningInputPacketV1,{source,basis})
  checkProgramOpeningInput(checked,seed)
  checkedInputs.set(checked,{seedSha256,wholeSha256:recordSha256(checked)})
  return checked
}
function checkProgramOpeningInput(data:Omit<ProgramOpeningInputPacketV1,'inputSha256'>,
  seed:ProgramOpeningIntentSeedV1):void {
  ref(data.seedRef)
  const {source,basis}=data
  if(data['schemaVersion']!==1||data['encoding']!=='native-program-opening-input-packet-v1'
    ||data['authority']!=='consumer-data-only'||data['sessionId']!==seed.sessionId
    ||data['seedRef'].key!==programOpeningSeedKeyV1(seed.sessionId,seed.operationId)
    ||data['seedRef'].sha256!==seedWholeSha256(seed)||source.proofSha256!==seed.sourceProofSha256
    ||source.bindingSha256!==seed.sourceBindingSha256||recordSha256(source.source)!==recordSha256(seed.source)
    ||basis.basisSha256!==seed.basisSha256||basis.sessionId!==seed.sessionId||basis.operationId!==seed.operationId
    ||basis.requestedMessageId!==seed.requestedMessageId||basis.sourceBindingSha256!==source.bindingSha256
    ||data['initialization']!==(data['schemaSource']===null?'absent':'schema')||!hash(data['numericalSourceSha256']))fail()
  if(data['schemaSource']!==null) {
    const schema=data['schemaSource'] as ProgramOpeningInputPacketV1['schemaSource']
    if(!schema||schema.schemaVersion!==7||schema.encoding!=='native-author-opening-preparation-v7'
      ||schema.identity.sessionId!==seed.sessionId||schema.identity.operationId!==seed.operationId
      ||schema.identity.messageId!==seed.requestedMessageId||!same(schema.identity.source,seed.source)
      ||schema.identity.index!==seed.selected.index||schema.identity.sourceSha256!==seed.selected.sourceSha256
      ||schema.identity.renderedSha256!==seed.selected.renderedSha256)fail()
  }
  if(recordSha256(seed.selected)!==recordSha256({
    index:source.selected.index,sourcePointer:source.selected.sourcePointer,sourceSha256:source.selected.sourceSha256,
    renderedSha256:source.selected.renderedSha256}))fail()
  const text=instruction(data['instruction'],seed.production)
  if((text===null?null:sha256(text))!==seed.instructionSha256)fail()
}

export interface ProgramOpeningRecordContextV1 {
  readonly seed:ProgramOpeningIntentSeedV1
  readonly input:ProgramOpeningInputPacketV1
  readonly schemaOpening?:ProgramOpeningSchemaSection
  /** A separate versioned absence domain, never a numerical plan/head. */
  readonly absenceDomain?:ProgramOpeningAbsentDomainV1
}
function boundIdentity(seed:ProgramOpeningIntentSeedV1,packet:ProgramOpeningInputPacketV1):ProgramOpeningIdentityV1 {
  return {sessionId:seed.sessionId,operationId:seed.operationId,requestedMessageId:seed.requestedMessageId,
    production:seed.production,instructionSha256:seed.instructionSha256,intentRef:packet.seedRef,
    inputRef:programOpeningRefV1(programOpeningInputKeyV1(seed.sessionId,seed.operationId),packet)}
}
export type ProgramOpeningNativePayloadV1=
  |Omit<Extract<ProgramOpeningNativeFactsV1,{production:'selected-card-copy'}>,
    'schemaVersion'|'encoding'|'factsSha256'>
  |Omit<Extract<ProgramOpeningNativeFactsV1,{production:'generated-opening'}>,
    'schemaVersion'|'encoding'|'factsSha256'>
/** Original Native packet is checked before Core's JSON copier can normalize
 * a prohibited -0/undefined. Copy has no standalone Native packet validator,
 * so its narrow receipt grammar is checked explicitly against the input. */
function nativeFactsPayload(input:unknown,seed:ProgramOpeningIntentSeedV1,
  packet:ProgramOpeningInputPacketV1):ProgramOpeningNativePayloadV1 {
  const data=programOpeningRecordDataV1(input)
  exact(data,['production','receipt','canonical'])
  if(data['production']!==seed.production)fail()
  const original=(input as {receipt:unknown}).receipt
  if(seed.production==='selected-card-copy') {
    const receipt=data['receipt']
    exact(receipt,['sessionId','operationId','messageId','renderedSha256','turn','assistantSeq',
      'turnStartSeq','turnEndSeq','messageVersion','flushed'])
    exact(receipt['messageVersion'],['kind','eventSha256'])
    const raw=original as MvuNativeOpeningReceipt
    if(data['canonical']!==null||receipt['sessionId']!==seed.sessionId||receipt['operationId']!==seed.operationId
      ||receipt['messageId']!==seed.requestedMessageId||receipt['renderedSha256']!==packet.source.selected.renderedSha256
      ||receipt['flushed']!==true||receipt['messageVersion']['kind']!=='original'
      ||!hash(receipt['messageVersion']['eventSha256'])||!count(raw.turn,true)||!count(raw.turnStartSeq)
      ||!count(raw.assistantSeq)||!count(raw.turnEndSeq)||raw.turnStartSeq>=raw.assistantSeq
      ||raw.assistantSeq>=raw.turnEndSeq||raw.turnStartSeq!==packet.basis.native.eventCount)fail()
  }else {
    const receipt=validateNativeGeneratedOpeningReceiptV1(original),canonical=data['canonical'],owned=receipt.identity
    exact(canonical,['seq','messageId','versionSha256','narrative'])
    if(owned.sessionId!==seed.sessionId||owned.operationId!==seed.operationId||owned.messageId!==seed.requestedMessageId
      ||owned.instruction!==packet.instruction||owned.instructionSha256!==seed.instructionSha256
      ||!same(owned.intentRef,packet.seedRef)||receipt.invocationRef.seq!==packet.basis.native.eventCount
      ||!count(canonical['seq'])||canonical['seq']!==receipt.terminalOutput.eventRef.seq
      ||canonical['messageId']!==receipt.terminalOutput.messageId
      ||canonical['versionSha256']!==receipt.terminalOutput.messageSha256||typeof canonical['narrative']!=='string'
      ||sha256(canonical['narrative'])!==receipt.terminalOutput.textSha256)fail()
  }
  return data as unknown as ProgramOpeningNativePayloadV1
}
export function validateProgramOpeningNativeFactsV1(input:unknown,rawSeed:ProgramOpeningIntentSeedV1,
  rawPacket:ProgramOpeningInputPacketV1):ProgramOpeningNativeFactsV1 {
  const seed=validateProgramOpeningSeedV1(rawSeed),packet=validateProgramOpeningInputV1(rawPacket,seed),
    binding=recordBinding(seed,packet),cached=boundRecord(input,checkedNativeFacts,binding)
  if(cached)return cached
  const data=programOpeningRecordDataV1(input)
  exact(data,['schemaVersion','encoding','production','receipt','canonical','factsSha256']);sealed(data,'factsSha256')
  if(data['schemaVersion']!==1||data['encoding']!=='native-program-opening-native-facts-v1')fail()
  // Descriptor cloning above established that reading the original receipt
  // invokes no getters; keep its stronger Native grammar at this boundary.
  nativeFactsPayload({production:data['production'],receipt:(input as {receipt:unknown}).receipt,
    canonical:data['canonical']},seed,packet)
  const checked=data as unknown as ProgramOpeningNativeFactsV1
  checkedNativeFacts.set(checked,binding)
  return checked
}
export function createProgramOpeningNativeFactsV1(input:ProgramOpeningNativePayloadV1,rawSeed:ProgramOpeningIntentSeedV1,
  rawPacket:ProgramOpeningInputPacketV1):ProgramOpeningNativeFactsV1 {
  const seed=validateProgramOpeningSeedV1(rawSeed),packet=validateProgramOpeningInputV1(rawPacket,seed),
    native=nativeFactsPayload(input,seed,packet),body={schemaVersion:1 as const,
      encoding:'native-program-opening-native-facts-v1' as const,...native}
  return validateProgramOpeningNativeFactsV1({...body,factsSha256:recordSha256(body)},seed,packet)
}

function recordContext(context:ProgramOpeningRecordContextV1) {
  const seed=validateProgramOpeningSeedV1(context.seed),packet=validateProgramOpeningInputV1(context.input,seed)
  return {seed,packet,identity:boundIdentity(seed,packet)}
}
export function validateProgramOpeningAbsentDomainV1(input:unknown,
  context:Pick<ProgramOpeningRecordContextV1,'seed'|'input'>):ProgramOpeningAbsentDomainV1 {
  const seed=validateProgramOpeningSeedV1(context.seed),packet=validateProgramOpeningInputV1(context.input,seed),
    binding=recordBinding(seed,packet),cached=boundRecord(input,checkedAbsentDomains,binding)
  if(cached)return cached
  const data=programOpeningRecordDataV1(input),identity=boundIdentity(seed,packet)
  exact(data,['schemaVersion','encoding','authority','sessionId','operationId','requestedMessageId','seedRef','inputRef',
    'sourceProofSha256','sourceBindingSha256','basisSha256','nativeFacts','domainSha256'])
  sealed(data,'domainSha256');ref(data['seedRef']);ref(data['inputRef'])
  if(packet.initialization!=='absent'||data['schemaVersion']!==1||data['encoding']!=='native-program-opening-absence-domain-v1'
    ||data['authority']!=='consumer-data-only'||data['sessionId']!==seed.sessionId
    ||data['operationId']!==seed.operationId||data['requestedMessageId']!==seed.requestedMessageId
    ||!same(data['seedRef'],identity.intentRef)||!same(data['inputRef'],identity.inputRef)
    ||data['sourceProofSha256']!==packet.source.proofSha256||data['sourceBindingSha256']!==packet.source.bindingSha256
    ||data['basisSha256']!==packet.basis.basisSha256)fail()
  const nativeFacts=validateProgramOpeningNativeFactsV1((input as {nativeFacts:unknown}).nativeFacts,seed,packet),
    checked=parsedChildren(data as unknown as ProgramOpeningAbsentDomainV1,{nativeFacts})
  checkedAbsentDomains.set(checked,binding)
  return checked
}
/** Complete immutable absence record, containing actual-reader facts as data.
 * Root owns persistence, current membership and its independent readback. */
export function createProgramOpeningAbsentDomainV1(input:{seed:ProgramOpeningIntentSeedV1;
  input:ProgramOpeningInputPacketV1;nativeFacts:ProgramOpeningNativeFactsV1}):ProgramOpeningAbsentDomainV1 {
  const seed=validateProgramOpeningSeedV1(input.seed),packet=validateProgramOpeningInputV1(input.input,seed),
    identity=boundIdentity(seed,packet),nativeFacts=validateProgramOpeningNativeFactsV1(input.nativeFacts,seed,packet),
    body={schemaVersion:1 as const,encoding:'native-program-opening-absence-domain-v1' as const,
      authority:'consumer-data-only' as const,sessionId:seed.sessionId,operationId:seed.operationId,
      requestedMessageId:seed.requestedMessageId,seedRef:identity.intentRef,inputRef:identity.inputRef,
      sourceProofSha256:packet.source.proofSha256,sourceBindingSha256:packet.source.bindingSha256,
      basisSha256:packet.basis.basisSha256,nativeFacts}
  return validateProgramOpeningAbsentDomainV1({...body,domainSha256:recordSha256(body)},{seed,input:packet})
}
/** Exact data receipts, distinct numerical/absence encodings. Storage existence
 * and original Native currency are still caller-owned checks. */
export function validateProgramOpeningSchemaSection(input:ProgramOpeningSchemaSection,
  context:Pick<ProgramOpeningRecordContextV1,'seed'|'input'>):ProgramOpeningSchemaSection {
  const data=programOpeningRecordDataV1(input),{seed,packet}=recordContext(context),
    preparation=validateMvuSchemaOpeningPreparation(data.preparation),birth=preparation.birth
  if(packet.initialization!=='schema'||!packet.schemaSource||birth.kind!=='generated'
    ||!same(birth.seedRef,packet.seedRef)||!same(birth.inputRef,boundIdentity(seed,packet).inputRef)
    ||!same(birth.basis,packet.basis))fail()
  const {birth:_birth,preparationSha256:_sha256,...captured}=preparation
  if(!same(captured,packet.schemaSource)||data.initialization.execution.batchId!==preparation.selector.batchId
    ||data.initialization.execution.realmEpoch!==preparation.realmEpoch
    ||data.initialization.execution.sessionId!==seed.sessionId)fail()
  const initialization=data.initialization,frontier=initialization.frontier
  if(!frontier||!count(frontier.nativeCut)||!hash(frontier.tailSha256)||!hash(frontier.frontierSha256))fail()
  if(initialization.browser) {
    const browser=initialization.browser
    if(browser.schemaVersion!==1||!Array.isArray(browser.hooks)||browser.finalizedMessage!=='')fail()
    for(const hook of browser.hooks) {
      validateSchemaJournalRecord(hook.journal.dispatch)
      validateSchemaJournalRecord(hook.journal.completion)
    }
  }
  if(data.publication) {
    const event=validateMvuSchemaOpeningEvent(data.publication.event),head=validateMvuSchemaOpeningHead(data.publication.head)
    if(!same(event.plan,data.publication.plan)||!same(event.native,data.publication.native)
      ||!same(head,mvuSchemaOpeningHead(event))||!same(event.plan.birth,birth)
      ||!same(event.plan.phases[0].execution,data.initialization.execution))fail()
  }
  return data
}
export function validateProgramOpeningDomainReceiptV1(input:unknown,rawNative:ProgramOpeningNativeFactsV1,
  context:ProgramOpeningRecordContextV1):ProgramOpeningDomainReceiptV1 {
  const data=programOpeningRecordDataV1(input),{seed,packet}=recordContext(context),
    native=validateProgramOpeningNativeFactsV1(rawNative,seed,packet)
  if(packet.initialization==='schema') {
    exact(data,['kind','eventId','eventSha256','headSha256','planSha256','valuesSha256'])
    if(data['kind']!=='schema-opening'||!context.schemaOpening||context.absenceDomain!==undefined)fail()
    const schema=validateProgramOpeningSchemaSection(context.schemaOpening,context),publication=schema.publication
    if(!publication)fail()
    const {event,head}=publication
    if(event.native.kind!=='generated'||native.production!=='generated-opening'
      ||!same(event.native.receipt,native.receipt)||!same(event.native.canonical,native.canonical)
      ||data['eventId']!==event.eventId||data['eventSha256']!==event.eventSha256||data['headSha256']!==recordSha256(head)
      ||data['planSha256']!==event.plan.planSha256||data['valuesSha256']!==event.valuesSha256)fail()
  }else {
    exact(data,['kind','domainRef','sourceProofSha256','basisSha256','nativeFactsSha256']);ref(data['domainRef'])
    if(data['kind']!=='prompt-absence'||context.schemaOpening!==undefined||context.absenceDomain===undefined)fail()
    const domain=validateProgramOpeningAbsentDomainV1(context.absenceDomain,{seed,input:packet})
    if(data['domainRef'].key!==programOpeningDomainKeyV1(seed.sessionId,seed.operationId)
      ||data['domainRef'].sha256!==recordSha256(domain)||!same(domain.nativeFacts,native)
      ||data['sourceProofSha256']!==packet.source.proofSha256||data['basisSha256']!==packet.basis.basisSha256
      ||data['nativeFactsSha256']!==native.factsSha256)fail()
  }
  return data as unknown as ProgramOpeningDomainReceiptV1
}
export function createProgramOpeningNumericalDomainReceiptV1(rawNative:ProgramOpeningNativeFactsV1,
  context:ProgramOpeningRecordContextV1):Extract<ProgramOpeningDomainReceiptV1,{kind:'schema-opening'}> {
  const publication=context.schemaOpening?.publication
  if(!publication)fail()
  const {event,head}=publication,data={kind:'schema-opening' as const,eventId:event.eventId,
    eventSha256:event.eventSha256,headSha256:recordSha256(head),planSha256:event.plan.planSha256,valuesSha256:event.valuesSha256}
  return validateProgramOpeningDomainReceiptV1(data,rawNative,context) as typeof data
}
export function createProgramOpeningAbsenceDomainReceiptV1(domainRef:ProgramOpeningDataRefV1,
  rawNative:ProgramOpeningNativeFactsV1,context:ProgramOpeningRecordContextV1)
  :Extract<ProgramOpeningDomainReceiptV1,{kind:'prompt-absence'}> {
  const {seed,packet}=recordContext(context),native=validateProgramOpeningNativeFactsV1(rawNative,seed,packet),
    data={kind:'prompt-absence' as const,domainRef,sourceProofSha256:packet.source.proofSha256,
      basisSha256:packet.basis.basisSha256,nativeFactsSha256:native.factsSha256}
  return validateProgramOpeningDomainReceiptV1(data,native,context) as typeof data
}
export function validateOpeningIntentV7(input:unknown,context:ProgramOpeningRecordContextV1):OpeningIntentV7 {
  const data=programOpeningRecordDataV1(input),{seed,packet,identity}=recordContext(context)
  optionalShape(data,['schemaVersion','mode','sessionId','source','index','sourcePointer','sourceSha256','renderedSha256',
    'renderedText','textRetained','operationId','messageId','production','revision','status','seedRef','inputRef'],
    ['nativeReceipt','schemaOpening','committedTurn','domainReceipt','diagnosis'])
  ref(data['seedRef']);ref(data['inputRef'])
  const selected=packet.source.selected
  if(data['schemaVersion']!==7||data['mode']!=='prompt-program'||data['sessionId']!==seed.sessionId
    ||!same(data['source'],seed.source)||data['index']!==selected.index||data['sourcePointer']!==selected.sourcePointer
    ||data['sourceSha256']!==selected.sourceSha256||data['renderedSha256']!==selected.renderedSha256
    ||data['renderedText']!==selected.renderedText||data['textRetained']!==true
    ||data['operationId']!==seed.operationId||data['messageId']!==seed.requestedMessageId||data['production']!==seed.production
    ||!same(data['seedRef'],identity.intentRef)||!same(data['inputRef'],identity.inputRef)||!count(data['revision'],true)
    ||!['prepared','native-unknown','native-committed','domain-blocked','completed'].includes(String(data['status']))
    ||data['diagnosis']!==undefined&&(typeof data['diagnosis']!=='string'||!/^[A-Z][A-Z0-9_]{0,95}$/.test(data['diagnosis'])))fail()
  if(data['schemaOpening']!==undefined) {
    const schema=validateProgramOpeningSchemaSection(data['schemaOpening'] as ProgramOpeningSchemaSection,context)
    if(context.schemaOpening&&!same(schema,context.schemaOpening))fail()
  }
  const hasNative=Object.hasOwn(data,'nativeReceipt'),hasTurn=Object.hasOwn(data,'committedTurn'),
    hasDomain=Object.hasOwn(data,'domainReceipt'),status=data['status']
  if(status==='prepared'||status==='native-unknown') {
    if(hasNative||hasTurn||hasDomain)fail()
    return data as unknown as OpeningIntentV7
  }
  if(!hasNative||!hasTurn||!count(data['committedTurn'],true))fail()
  const native=validateProgramOpeningNativeFactsV1((input as {nativeReceipt:unknown}).nativeReceipt,seed,packet)
  if(data['committedTurn']!==native.receipt.turn)fail()
  if(status==='domain-blocked') {
    if(hasDomain||!Object.hasOwn(data,'diagnosis'))fail()
  }else if(status==='native-committed') {
    if(hasDomain)fail()
  }else {
    if(!hasDomain)fail()
    validateProgramOpeningDomainReceiptV1(data['domainReceipt'],native,
      {...context,...data['schemaOpening']?{schemaOpening:data['schemaOpening'] as ProgramOpeningSchemaSection}:{}})
  }
  return data as unknown as OpeningIntentV7
}
export interface CreateOpeningIntentV7Input {
  readonly context:ProgramOpeningRecordContextV1
  readonly revision:number
  readonly status:OpeningIntentV7['status']
  readonly nativeReceipt?:ProgramOpeningNativeFactsV1
  readonly committedTurn?:number
  readonly domainReceipt?:ProgramOpeningDomainReceiptV1
  readonly diagnosis?:string
}
export function createOpeningIntentV7(input:CreateOpeningIntentV7Input):OpeningIntentV7 {
  const {seed,packet,identity}=recordContext(input.context),selected=packet.source.selected,
    extras:Record<string,unknown>={}
  for(const key of ['nativeReceipt','committedTurn','domainReceipt','diagnosis'] as const) {
    if(Object.hasOwn(input,key))extras[key]=input[key]
  }
  const body={schemaVersion:7,mode:'prompt-program',sessionId:seed.sessionId,source:seed.source,
    index:selected.index,sourcePointer:selected.sourcePointer,sourceSha256:selected.sourceSha256,
    renderedSha256:selected.renderedSha256,renderedText:selected.renderedText,textRetained:true,
    operationId:seed.operationId,messageId:seed.requestedMessageId,production:seed.production,
    revision:input.revision,status:input.status,seedRef:identity.intentRef,inputRef:identity.inputRef,
    ...input.context.schemaOpening?{schemaOpening:input.context.schemaOpening}:{},...extras}
  return validateOpeningIntentV7(body,input.context)
}
export function createPreparedOpeningIntentV7(context:ProgramOpeningRecordContextV1):OpeningIntentV7 {
  return createOpeningIntentV7({context,revision:1,status:'prepared'})
}
