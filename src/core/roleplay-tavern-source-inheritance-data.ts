/** Strict inheritance data and static row ownership. This module reads no
 * Native owner/table, publishes nothing and grants no capability. */
import {recordSha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1,TavernLoreDataFailureV1} from './roleplay-tavern-lore-data.js'
import type {TavernLoreDataBudgetV1} from './roleplay-tavern-lore-data.js'
import type {TavernSourceInheritanceCodeV1,TavernSourceInheritanceRefV1,TavernSourceStaticRowV1,
  TavernSourceStaticTableV1,TavernSourceInheritanceDescriptorV1,TavernSourceInheritanceLayerRefV1,
  TavernSourceOriginalBindingV1,TavernSourceNativeCutV1,TavernSourcePreparedV1,TavernSourceApplyIntentV1,
  TavernSourceCommitV1,TavernSourceReadyV1,TavernSourceFrozenRefV1,TavernSourceNumericalCaptureV1}
  from './roleplay-tavern-source-inheritance-types.js'
import type {TavernSourceLegacyMigrationRecordV1} from './roleplay-tavern-source-inheritance-types.js'
import type {TavernSourceFrozenPromptScopeRecordV1,TavernSourceFrozenNonNumericalOpeningV1}
  from './roleplay-tavern-source-inheritance-types.js'
import {validateProgramAbsenceOpeningClosureV1} from './roleplay-program-absence-inheritance-data.js'
import type {ProgramAbsenceOpeningClosureV1} from './roleplay-program-absence-inheritance-data.js'
import type {TavernSourceProgramAbsenceOpeningRecordV1,TavernSourceFrozenProgramAbsenceOpeningV1}
  from './roleplay-tavern-source-inheritance-types.js'

export const TAVERN_SOURCE_INHERITANCE_BOUNDS_V1=Object.freeze({bytes:16_777_216,nodes:131_072,
  depth:66,chainBytes:67_108_864,chainNodes:524_288,rows:4096,ancestors:32,events:256,publications:4096})
export class TavernSourceInheritanceFailureV1 extends Error {
  constructor(readonly code:TavernSourceInheritanceCodeV1,readonly missingEvidence:readonly string[]=[]) {
    super(code);this.name='TavernSourceInheritanceFailureV1'
  }
}
export function inheritanceFailV1(code:TavernSourceInheritanceCodeV1,detail?:string):never {
  throw new TavernSourceInheritanceFailureV1(code,detail?[detail]:[])
}
export const inheritanceObjectV1=(value:unknown):value is Record<string,unknown>=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)
export const inheritanceHashV1=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
export const inheritanceIdV1=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value)
export const inheritanceKeyV1=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,256}$/.test(value)
// Only complete successful parser returns enroll immutable data. This does not
// recognize raw rows, generic freeze/seal helpers, Native authority or a live
// owner. Each weak entry holds only the exact whole-data hash, computed lazily.
const parsedDataHashes=new WeakMap<object,{sha256?:string}>()
function rememberParsedDataV1<T>(value:T):T {
  if(value===null||typeof value!=='object')return value
  const pending:object[]=[value],seen=new Set<object>(),complete:object[]=[]
  while(pending.length) {
    const item=pending.pop()!
    if(seen.has(item)||parsedDataHashes.has(item))continue
    seen.add(item)
    // These objects came from the bounded copier and successful child parsers,
    // so their own enumerable data is inert and their descendants are frozen.
    if(!Object.isFrozen(item))return value
    complete.push(item)
    for(const child of Object.values(item))
      if(child!==null&&typeof child==='object')pending.push(child)
  }
  for(const item of complete)parsedDataHashes.set(item,{})
  return value
}
export function inheritanceDataSha256V1(value:unknown):string {
  const owned=value!==null&&typeof value==='object'?parsedDataHashes.get(value):undefined
  if(!owned)return recordSha256(value)
  return owned.sha256??(owned.sha256=recordSha256(value))
}
export const inheritanceSameV1=(left:unknown,right:unknown)=>
  inheritanceDataSha256V1(left)===inheritanceDataSha256V1(right)
export function inheritanceDataV1<T>(value:T,budget?:TavernLoreDataBudgetV1):T {
  try {return cloneRoleplayTavernLoreDataV1(value,TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.bytes,undefined,budget)}
  catch(error) {inheritanceFailV1(error instanceof TavernLoreDataFailureV1&&error.code==='LORE_DATA_BUDGET'
    ?'SOURCE_INHERITANCE_BUDGET':'SOURCE_INHERITANCE_INVALID')}
}
export function inheritanceFreezeV1<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))inheritanceFreezeV1(child);Object.freeze(value)}
  return value
}
export function inheritanceExactV1(value:unknown,fields:readonly string[]):asserts value is Record<string,unknown> {
  if(!inheritanceObjectV1(value)||Object.keys(value).length!==fields.length
    ||Object.keys(value).some(key=>!fields.includes(key)))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
}
export function inheritanceCountV1(value:unknown,maximum=Number.MAX_SAFE_INTEGER):asserts value is number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>maximum)
    inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
}
export const tavernSourcePreparedKeyV1=(sid:string)=>`${sid}__tavern-source-prepared-v1`
export const tavernSourceApplyKeyV1=(sid:string)=>`${sid}__tavern-source-apply-v1`
export const tavernSourceCommitKeyV1=(sid:string)=>`${sid}__tavern-source-commit-v1`
export const tavernSourceReadyKeyV1=(sid:string)=>`${sid}__tavern-source-ready-v1`
export const tavernSourceEditBaselineKeyV1=(sid:string)=>`${sid}__tavern-source-edit-baseline-v1`
export const tavernSourceMaterialBaselineKeyV1=(sid:string)=>`${sid}__tavern-source-material-baseline-v1`
export const tavernSourceEditSlotKeyV1=(identitySha:string)=>`tavern_loreedit_v1__${identitySha}__inherited_baseline_v1`
export const tavernSourceMigrationKeyV1=(sid:string)=>`${sid}__tavern-source-migration-v1`
export const tavernSourceFrozenPromptScopeKeyV1=(sid:string)=>`${sid}__tavern-source-frozen-prompt-scope-v1`
export const tavernSourceProgramAbsenceOpeningKeyV1=(sid:string)=>`${sid}__tavern-source-program-absence-opening-v1`
/** Parse inert migration data without entering Source or performing migration.
 * Consumers must separately join its binding to an actual closed Source. */
export function validateTavernSourceLegacyMigrationRecordV1(raw:unknown):TavernSourceLegacyMigrationRecordV1 {
  const value=sealed<TavernSourceLegacyMigrationRecordV1>(raw,'native-tavern-source-legacy-migration-v1',
    'migrationSha256',['childSessionId','evidenceSha256','priorMeta','readyBinding']),sid=value.childSessionId
  if(!inheritanceIdV1(sid)||!inheritanceHashV1(value.evidenceSha256))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  validateStaticRowV1(value.priorMeta,sid)
  if(value.priorMeta.table!=='branch'||value.priorMeta.key!==`${sid}__meta`)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  const binding=value.readyBinding
  inheritanceExactV1(binding,['schemaVersion','preparedRef','applyIntentRef','commitRef','readyRef'])
  if(binding.schemaVersion!==1)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  validateInheritanceRefV1(binding.preparedRef,tavernSourcePreparedKeyV1(sid))
  validateInheritanceRefV1(binding.applyIntentRef,tavernSourceApplyKeyV1(sid))
  validateInheritanceRefV1(binding.commitRef,tavernSourceCommitKeyV1(sid))
  validateInheritanceRefV1(binding.readyRef,tavernSourceReadyKeyV1(sid))
  return rememberParsedDataV1(value)
}
/** Exact registered family; no broad prefix exemption in fresh membership. */
export function tavernSourceOwnedRecordKeysV1(sid:string):ReadonlySet<string> {
  return new Set([tavernSourcePreparedKeyV1(sid),tavernSourceApplyKeyV1(sid),tavernSourceCommitKeyV1(sid),
    tavernSourceReadyKeyV1(sid),tavernSourceEditBaselineKeyV1(sid),tavernSourceMaterialBaselineKeyV1(sid),
    tavernSourceMigrationKeyV1(sid),tavernSourceFrozenPromptScopeKeyV1(sid),tavernSourceProgramAbsenceOpeningKeyV1(sid)])
}
export const inheritanceRefV1=(key:string,value:unknown):TavernSourceInheritanceRefV1=>
  ({key,sha256:inheritanceDataSha256V1(value)})
export function validateInheritanceRefV1(raw:unknown,key?:string):asserts raw is TavernSourceInheritanceRefV1 {
  inheritanceExactV1(raw,['key','sha256'])
  if(!inheritanceKeyV1(raw.key)||!inheritanceHashV1(raw.sha256)||key!==undefined&&raw.key!==key)
    inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
}
function sealed<T>(raw:unknown,encoding:string,hashKey:string,fields:readonly string[],optional:readonly string[]=[]):T {
  const data=inheritanceDataV1(raw)
  if(!inheritanceObjectV1(data))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  inheritanceExactV1(data,['schemaVersion','encoding',...fields,...optional.filter(key=>Object.hasOwn(data as object,key)),hashKey])
  if(data.schemaVersion!==1||data.encoding!==encoding||!inheritanceHashV1(data[hashKey]))
    inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  const body={...data};delete body[hashKey]
  if(recordSha256(body)!==data[hashKey])inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  return inheritanceFreezeV1(data as unknown as T)
}
export function sealInheritanceDataV1<T extends object>(body:T,hashKey:string) {
  return inheritanceFreezeV1(inheritanceDataV1({...body,[hashKey]:recordSha256(body)}))
}
/** Shared strict parser for the actual persisted scope envelope. The facts
 * retain their original owner; this row's child address is storage provenance. */
export function validateFrozenPromptScopeRecordV1(raw:unknown):TavernSourceFrozenPromptScopeRecordV1 {
  const record=sealed<TavernSourceFrozenPromptScopeRecordV1>(raw,'native-tavern-frozen-prompt-scope-record-v1','recordSha256',
    ['authority','childSessionId','parentSessionId','scopeFacts','scopeFactsSha256'])
  if(record.authority!=='consumer-data-only'||!inheritanceIdV1(record.childSessionId)
    ||!inheritanceIdV1(record.parentSessionId)||record.childSessionId===record.parentSessionId
    ||!inheritanceObjectV1(record.scopeFacts)||record.scopeFactsSha256!==recordSha256(record.scopeFacts))
    inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  return rememberParsedDataV1(record)
}
export function validateFrozenNonNumericalOpeningV1(raw:unknown):TavernSourceFrozenNonNumericalOpeningV1 {
  const data=inheritanceDataV1(raw)
  if(!inheritanceObjectV1(data))inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  if(data.kind==='not-inherited') {
    const value=sealed<TavernSourceFrozenNonNumericalOpeningV1>(data,'native-tavern-source-nonnumerical-opening-v1',
      'frozenSha256',['kind','reason'])
    if(value.kind!=='not-inherited'||value.reason!=='fresh-cut-zero')inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
    return rememberParsedDataV1(value)
  }
  const value=sealed<Exclude<TavernSourceFrozenNonNumericalOpeningV1,{kind:'not-inherited'}>>(data,
    'native-tavern-source-nonnumerical-opening-v1','frozenSha256',['kind','frozenOpening','openingEventSpan'])
  if(!['plain','prompt-template-only'].includes(value.kind))inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  const opening=value.frozenOpening
  inheritanceExactV1(opening,['ownerSessionId','intent','intentRef','nativeReceipt','scopeFacts','scopeFactsRef',
    'scopeFactsRecord','noNumericalInventory'])
  validateInheritanceRefV1(opening.intentRef);validateInheritanceRefV1(opening.scopeFactsRef)
  const scope=validateFrozenPromptScopeRecordV1(opening.scopeFactsRecord),intent=opening.intent,native=opening.nativeReceipt
  inheritanceExactV1(native,['sessionId','operationId','messageId','renderedSha256','turn','assistantSeq',
    'turnStartSeq','turnEndSeq','messageVersion','flushed'])
  inheritanceExactV1(native.messageVersion,['kind','eventSha256'])
  inheritanceCountV1(native.turn)
  if(!inheritanceIdV1(opening.ownerSessionId)||!inheritanceObjectV1(intent)||intent.status!=='completed'
    ||intent.sessionId!==opening.ownerSessionId||intent.textRetained!==true
    ||value.kind==='plain'&&(intent.schemaVersion!==4||intent.mode!=='plain')
    ||value.kind==='prompt-template-only'&&(intent.schemaVersion!==6||intent.mode!=='prompt-template-only')
    ||Object.hasOwn(intent,'initialization')||Object.hasOwn(intent,'initializationReceipt')
    ||opening.intentRef.sha256!==recordSha256(intent)||native.sessionId!==opening.ownerSessionId
    ||native.operationId!==intent.operationId||native.messageId!==intent.messageId
    ||native.renderedSha256!==intent.renderedSha256||native.flushed!==true
    ||native.messageVersion?.kind!=='original'||!inheritanceHashV1(native.messageVersion.eventSha256)
    ||intent.committedTurn!==undefined&&intent.committedTurn!==native.turn
    ||!inheritanceSameV1(scope.scopeFacts,opening.scopeFacts)
    ||opening.scopeFactsRef.key!==tavernSourceFrozenPromptScopeKeyV1(scope.childSessionId)
    ||opening.scopeFactsRef.sha256!==inheritanceDataSha256V1(scope))inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  const span=value.openingEventSpan
  inheritanceExactV1(span,['turnStartSeq','assistantSeq','turnEndSeq','turnStartSha256','assistantSha256','turnEndSha256'])
  for(const key of ['turnStartSeq','assistantSeq','turnEndSeq'] as const)inheritanceCountV1(span[key])
  for(const key of ['turnStartSha256','assistantSha256','turnEndSha256'] as const)
    if(!inheritanceHashV1(span[key]))inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  if(span.turnStartSeq!==native.turnStartSeq||span.assistantSeq!==native.assistantSeq||span.turnEndSeq!==native.turnEndSeq
    ||span.turnStartSeq>span.assistantSeq||span.assistantSeq>span.turnEndSeq
    ||span.assistantSha256!==native.messageVersion.eventSha256)inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  const inventory=opening.noNumericalInventory
  inheritanceExactV1(inventory,['schemaVersion','encoding','authority','sessionId','parentSessionId','inheritedEventCount',
    'numericalRows','opaqueRows','statusRows','branchMembershipSha256','statusMembershipSha256','inventorySha256'])
  const {inventorySha256,...inventoryBody}=inventory
  if(inventory.schemaVersion!==2||inventory.encoding!=='native-prompt-nonnumerical-inventory-v2'
    ||inventory.authority!=='consumer-data-only'||!inheritanceIdV1(inventory.sessionId)
    ||inventory.parentSessionId!==null&&!inheritanceIdV1(inventory.parentSessionId)
    ||!Array.isArray(inventory.numericalRows)||inventory.numericalRows.length!==0
    ||!Array.isArray(inventory.opaqueRows)||inventory.opaqueRows.length!==0||!Array.isArray(inventory.statusRows)
    ||inventory.statusRows.length>TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.rows
    ||!inheritanceHashV1(inventory.branchMembershipSha256)||!inheritanceHashV1(inventory.statusMembershipSha256)
    ||recordSha256(inventoryBody)!==inventorySha256)inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  inheritanceCountV1(inventory.inheritedEventCount)
  for(const row of inventory.statusRows) {
    inheritanceExactV1(row,['table','key','exists','sha256'])
    if(row.table!=='status'||!inheritanceKeyV1(row.key)||!row.key.startsWith(`${inventory.sessionId}__`)
      ||typeof row.exists!=='boolean'||(row.exists?!inheritanceHashV1(row.sha256):row.sha256!=='missing'))
      inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  }
  return rememberParsedDataV1(value)
}
/** Full closure archive at one exact child key. No prepared reference lives in
 * this body; closing the row before prepared prevents a self-reference. */
const checkedProgramAbsenceRecords=new WeakSet<TavernSourceProgramAbsenceOpeningRecordV1>()
export function validateTavernSourceProgramAbsenceOpeningRecordV1(raw:unknown):TavernSourceProgramAbsenceOpeningRecordV1 {
  if(raw!==null&&typeof raw==='object'&&checkedProgramAbsenceRecords.has(raw as TavernSourceProgramAbsenceOpeningRecordV1))
    return raw as TavernSourceProgramAbsenceOpeningRecordV1
  const value=sealed<TavernSourceProgramAbsenceOpeningRecordV1>(raw,
    'native-tavern-source-program-absence-opening-record-v1','recordSha256',
    ['authority','childSessionId','parentSessionId','closure','closureSha256'])
  if(value.authority!=='consumer-data-only'||!inheritanceIdV1(value.childSessionId)
    ||!inheritanceIdV1(value.parentSessionId)||value.childSessionId===value.parentSessionId)
    inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  // sealed() bounded all original descriptors. Keep Native's original strict
  // packet spelling rather than its clone's normalized -0/undefined values.
  const closure=validateProgramAbsenceOpeningClosureV1((raw as TavernSourceProgramAbsenceOpeningRecordV1).closure)
  if(value.childSessionId===closure.ownerSessionId||value.closureSha256!==closure.closureSha256
    ||!inheritanceSameV1(value.closure,closure))
    inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  const checked=Object.freeze({...value,closure})
  if(JSON.stringify(checked)!==JSON.stringify(value))inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  rememberParsedDataV1(checked)
  checkedProgramAbsenceRecords.add(checked)
  return checked
}
const checkedFrozenProgramAbsenceOpenings=new WeakSet<TavernSourceFrozenProgramAbsenceOpeningV1>()
export function validateFrozenProgramAbsenceOpeningV1(raw:unknown):TavernSourceFrozenProgramAbsenceOpeningV1 {
  if(raw!==null&&typeof raw==='object'&&checkedFrozenProgramAbsenceOpenings.has(raw as TavernSourceFrozenProgramAbsenceOpeningV1))
    return raw as TavernSourceFrozenProgramAbsenceOpeningV1
  const data=inheritanceDataV1(raw)
  if(!inheritanceObjectV1(data))inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  if(data.kind==='not-inherited') {
    const value=sealed<Extract<TavernSourceFrozenProgramAbsenceOpeningV1,{kind:'not-inherited'}>>(data,
      'native-tavern-source-program-absence-opening-v1','frozenSha256',['kind','reason'])
    if(value.reason!=='fresh-cut-zero')inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
    rememberParsedDataV1(value)
    checkedFrozenProgramAbsenceOpenings.add(value)
    return value
  }
  const value=sealed<Extract<TavernSourceFrozenProgramAbsenceOpeningV1,{kind:'program-absence'}>>(data,
    'native-tavern-source-program-absence-opening-v1','frozenSha256',['kind','record','recordRef'])
  if(value.kind!=='program-absence')inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  const record=validateTavernSourceProgramAbsenceOpeningRecordV1(
    (raw as Extract<TavernSourceFrozenProgramAbsenceOpeningV1,{kind:'program-absence'}>).record)
  validateInheritanceRefV1(value.recordRef,tavernSourceProgramAbsenceOpeningKeyV1(record.childSessionId))
  if(value.recordRef.sha256!==inheritanceDataSha256V1(record)||!inheritanceSameV1(value.record,record))
    inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  const checked=Object.freeze({...value,record})
  if(JSON.stringify(checked)!==JSON.stringify(value))inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  rememberParsedDataV1(checked)
  checkedFrozenProgramAbsenceOpenings.add(checked)
  return checked
}
/** Pure cut length agreement only; actual immutable Native events, headers and
 * the complete current child namespace are separately asserted by Root. */
export function assertFrozenProgramAbsenceOpeningCutV1(packet:TavernSourceFrozenProgramAbsenceOpeningV1,
  cut:TavernSourceNativeCutV1):void {
  validateInheritanceCutV1(cut)
  if(packet.kind==='not-inherited') {
    if(cut.kind!=='reserved-fresh-branch'||cut.seedLength!==0)
      inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
    return
  }
  const closure=validateProgramAbsenceOpeningClosureV1(packet.record.closure),intent=closure.data.intent,
    facts=intent.nativeReceipt
  if(cut.kind!=='native-fork'||!facts)inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  if(facts.production==='selected-card-copy') {
    if(facts.receipt.turnEndSeq>=cut.seedLength)inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  }else {
    const ack=closure.data.acknowledgement
    if(!ack||facts.receipt.turnEndRef.seq>=cut.seedLength||ack.generatedReceiptRef.seq>=cut.seedLength
      ||ack.closingAckRef.seq>=cut.seedLength)inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  }
}
/** Original immutable import joins, independent of the ancestor's current
 * selection, numerical head, Agent, later edit layers or context-window row. */
export function assertProgramAbsenceOriginalBindingV1(closure:ProgramAbsenceOpeningClosureV1,
  binding:TavernSourceOriginalBindingV1):void {
  const source=closure.data.input.source,tuple=source.program.importTuple,seed=closure.data.seed
  if(tuple.sourceRecordSessionId!==binding.sourceRecordSessionId||tuple.importId!==binding.importId
    ||tuple.rawSha256!==binding.rawSha256||tuple.normalizedSha256!==binding.normalizedSha256
    ||tuple.documentSha256!==binding.documentSha256||tuple.dataSha256!==binding.dataSha256
    ||tuple.normalizer!==binding.normalizer||tuple.coverageSha256!==binding.coverageSha256
    ||tuple.transactionId!==binding.transactionId||tuple.activationSha256!==binding.activationSha256
    ||tuple.importRecordRef.key!==binding.importRecordRef.key||tuple.importRecordRef.sha256!==binding.importRecordRef.sha256
    ||seed.source.sessionId!==closure.ownerSessionId||seed.source.sourceRecordSessionId!==binding.sourceRecordSessionId
    ||seed.source.importId!==binding.importId||seed.source.rawSha256!==binding.rawSha256
    ||seed.source.normalizedSha256!==binding.normalizedSha256||seed.source.coverageSha256!==binding.coverageSha256
    ||seed.source.transactionId!==binding.transactionId)inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
}
export function validateInheritanceCutV1(raw:unknown):asserts raw is TavernSourceNativeCutV1 {
  inheritanceExactV1(raw,['kind','seedLength','parentInheritedEventCount','prefixEncoding','prefixSha256'])
  inheritanceCountV1(raw.seedLength);inheritanceCountV1(raw.parentInheritedEventCount)
  if(!['native-fork','reserved-fresh-branch'].includes(String(raw.kind))
    ||raw.kind==='reserved-fresh-branch'&&raw.seedLength!==0
    ||raw.prefixEncoding!=='record-sha256-native-events-prefix-v1'||!inheritanceHashV1(raw.prefixSha256))
    inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
}
export function validateOriginalInheritanceBindingV1(raw:unknown):asserts raw is TavernSourceOriginalBindingV1 {
  inheritanceExactV1(raw,['sourceRecordSessionId','importId','rawSha256','normalizedSha256','coverageSha256',
    'transactionId','normalizer','documentSha256','dataSha256','importRecordRef','activationSha256',
    'originalPointer','originalPointerRef'])
  for(const field of ['sourceRecordSessionId','importId','transactionId'])
    if(!inheritanceIdV1(raw[field]))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  for(const field of ['rawSha256','normalizedSha256','coverageSha256','documentSha256','dataSha256','activationSha256'])
    if(!inheritanceHashV1(raw[field]))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  if(!['tavern-fields-v1','tavern-fields-v2','nexttavern-fields-v1'].includes(String(raw.normalizer)))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  validateInheritanceRefV1(raw.importRecordRef,`${raw.sourceRecordSessionId}__import-${raw.importId}`)
  const pointer=raw.originalPointer
  if(!inheritanceObjectV1(pointer)||Object.keys(pointer).some(key=>!['importId','sourceRecordSessionId',
    'normalizedSha256','transactionId','coverageSha256','activatedAt'].includes(key))
    ||pointer.importId!==raw.importId||(pointer.sourceRecordSessionId??raw.sourceRecordSessionId)!==raw.sourceRecordSessionId
    ||pointer.normalizedSha256!==raw.normalizedSha256||pointer.transactionId!==raw.transactionId
    ||pointer.coverageSha256!==raw.coverageSha256)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  if(pointer.activatedAt!==undefined)inheritanceCountV1(pointer.activatedAt)
  const ref=raw.originalPointerRef
  inheritanceExactV1(ref,['table','key','exists','sha256'])
  if(ref.table!=='branch'||ref.key!==`${raw.sourceRecordSessionId}__import-active`||ref.exists!==true
    ||ref.sha256!==inheritanceDataSha256V1(pointer))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
}
function validateLayer(raw:unknown):asserts raw is TavernSourceInheritanceLayerRefV1 {
  inheritanceExactV1(raw,['childSessionId','parentSessionId','operationId','nativeCut','preparedRef','applyIntentRef','commitRef','readyRef'])
  if(!inheritanceIdV1(raw.childSessionId)||!inheritanceIdV1(raw.parentSessionId)||raw.childSessionId===raw.parentSessionId
    ||!inheritanceIdV1(raw.operationId))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  validateInheritanceCutV1(raw.nativeCut)
  validateInheritanceRefV1(raw.preparedRef,tavernSourcePreparedKeyV1(raw.childSessionId))
  validateInheritanceRefV1(raw.applyIntentRef,tavernSourceApplyKeyV1(raw.childSessionId))
  validateInheritanceRefV1(raw.commitRef,tavernSourceCommitKeyV1(raw.childSessionId))
  validateInheritanceRefV1(raw.readyRef,tavernSourceReadyKeyV1(raw.childSessionId))
}
/** Compiler-facing pure parser. Data agreement is never current permission. */
export function validateTavernSourceInheritanceDescriptorV1(raw:unknown):TavernSourceInheritanceDescriptorV1 {
  const value=sealed<TavernSourceInheritanceDescriptorV1>(raw,'native-tavern-source-inheritance-data-v1','inheritanceSha256',
    ['authority','childSessionId','parentSessionId','operationId','nativeCut','preparedRef','applyIntentRef','commitRef','readyRef',
      'anchorSha256','parentSourceSha256','parentInventorySha256','originalBinding','childPointerAtCommitSha256',
      'editBaselineRef','editBaselineSlotRef','materialBaselineRef','ancestors'])
  if(value.authority!=='consumer-data-only')inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  const {childSessionId,parentSessionId,operationId,nativeCut,preparedRef,applyIntentRef,commitRef,readyRef}=value
  validateLayer({childSessionId,parentSessionId,operationId,nativeCut,preparedRef,applyIntentRef,commitRef,readyRef})
  for(const field of ['anchorSha256','parentSourceSha256','parentInventorySha256','childPointerAtCommitSha256'] as const)
    if(!inheritanceHashV1(value[field]))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  validateOriginalInheritanceBindingV1(value.originalBinding)
  validateInheritanceRefV1(value.editBaselineRef,tavernSourceEditBaselineKeyV1(childSessionId))
  validateInheritanceRefV1(value.editBaselineSlotRef)
  validateInheritanceRefV1(value.materialBaselineRef,tavernSourceMaterialBaselineKeyV1(childSessionId))
  if(!Array.isArray(value.ancestors)||value.ancestors.length>=TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.ancestors)
    inheritanceFailV1('SOURCE_INHERITANCE_BUDGET')
  const seen=new Set([childSessionId])
  for(const ancestor of value.ancestors) {
    validateLayer(ancestor)
    if(seen.has(ancestor.childSessionId))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    seen.add(ancestor.childSessionId)
  }
  for(let index=1;index<value.ancestors.length;index++)
    if(value.ancestors[index]!.parentSessionId!==value.ancestors[index-1]!.childSessionId)
      inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  if(value.ancestors.length&&value.ancestors.at(-1)!.childSessionId!==parentSessionId)
    inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  return rememberParsedDataV1(value)
}
export function validateStaticRowV1(raw:unknown,owner:string):asserts raw is TavernSourceStaticRowV1 {
  inheritanceExactV1(raw,['table','key','exists','sha256','value'])
  if(!['cards','worldbook','rules','opening','status','branch'].includes(String(raw.table))
    ||!inheritanceKeyV1(raw.key)||!raw.key.startsWith(`${owner}__`)||typeof raw.exists!=='boolean'
    ||(raw.exists?!inheritanceObjectV1(raw.value)||raw.sha256!==inheritanceDataSha256V1(raw.value):raw.value!==null||raw.sha256!=='missing'))
    inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
}
export function validateStaticInventoryV1(raw:unknown,owner:string):asserts raw is readonly TavernSourceStaticRowV1[] {
  if(!Array.isArray(raw)||raw.length>TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.rows)inheritanceFailV1('SOURCE_INHERITANCE_BUDGET')
  const seen=new Set<string>()
  let previous=''
  for(const row of raw) {
    validateStaticRowV1(row,owner)
    const key=`${row.table}:${row.key}`
    if(seen.has(key)||previous&&key<previous)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    seen.add(key);previous=key
    if(row.table==='branch'&&row.key!==`${owner}__settings`
      ||row.table==='status'&&row.key!==`${owner}__spec`)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  }
  for(const [table,suffix] of [['branch','settings'],['rules','spec'],['opening','scene'],['status','spec']] as const)
    if(!seen.has(`${table}:${owner}__${suffix}`))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
}
export function validateNumericalCaptureV1(raw:unknown):TavernSourceNumericalCaptureV1 {
  const value=sealed<TavernSourceNumericalCaptureV1>(raw,'native-tavern-numerical-source-capture-v1','captureSha256',
    ['inputSource','sessionId','pointer','importIdentity','recordVersions','statusSpec','openingScene','openingContext','staticRows'])
  if(!inheritanceIdV1(value.sessionId))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  validateStaticInventoryV1(value.staticRows,value.sessionId)
  validateStaticRowV1(value.statusSpec,value.sessionId);validateStaticRowV1(value.openingScene,value.sessionId)
  if(value.statusSpec.key!==`${value.sessionId}__spec`||value.statusSpec.table!=='status'
    ||value.openingScene.key!==`${value.sessionId}__scene`||value.openingScene.table!=='opening')
    inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  const input=value.inputSource
  inheritanceExactV1(input,['sessionId','pointer','imported','versions','statusSpecSha256','openingSha256','openingContextBindingSha256'])
  if(input.sessionId!==value.sessionId||!inheritanceSameV1(input.pointer,value.pointer)
    ||!inheritanceSameV1(input.versions,value.recordVersions)||!inheritanceObjectV1(input.imported)
    ||input.statusSpecSha256!==value.statusSpec.sha256||input.openingSha256!==value.openingScene.sha256
    ||input.openingContextBindingSha256!==value.openingContext.bindingSha256)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  inheritanceExactV1(value.recordVersions,['cards','worldbook','rules','settings'])
  for(const table of ['cards','worldbook'] as const) {
    const versions=value.recordVersions[table]
    if(!inheritanceObjectV1(versions))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    const actual=Object.fromEntries(value.staticRows.filter(row=>row.table===table&&row.exists)
      .map(row=>[row.key.slice(value.sessionId.length+2),row.sha256]))
    if(!inheritanceSameV1(actual,versions))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  }
  for(const [table,suffix,key] of [['rules','spec','rules'],['branch','settings','settings']] as const)
    if(value.staticRows.find(row=>row.table===table&&row.key===`${value.sessionId}__${suffix}`)?.sha256
      !==value.recordVersions[key])inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  const imported=input.imported,identity=value.importIdentity
  if(identity.importId!==imported.importId||identity.rawSha256!==imported.rawSha256
    ||identity.normalizedSha256!==imported.normalizedSha256||!inheritanceSameV1(identity.fieldProof,imported.fieldProof)
    ||!inheritanceSameV1(identity.activation,imported.activation))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  inheritanceExactV1(value.openingContext,['context','bindingSha256'])
  if(!inheritanceHashV1(value.openingContext.bindingSha256)||!inheritanceObjectV1(value.openingContext.context)
    ||Object.values(value.openingContext.context).some(item=>typeof item!=='string'||item.length>512))
    inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  return rememberParsedDataV1(value)
}
// Pure grammar reuse recognizes only this parser's fully successful, deeply
// frozen returned objects. Raw rows and caller freezing never enter this set;
// no Source/Native owner, currentness check or storage observation is retained.
const checkedPreparedInheritance=new WeakSet<TavernSourcePreparedV1>()
export function validatePreparedInheritanceV1(raw:unknown):TavernSourcePreparedV1 {
  if(raw!==null&&typeof raw==='object'&&checkedPreparedInheritance.has(raw as TavernSourcePreparedV1)) {
    return raw as TavernSourcePreparedV1
  }
  const value=sealed<TavernSourcePreparedV1>(raw,'native-tavern-source-inheritance-prepared-v1','preparedSha256',
    ['origin','operationId','operationKey','anchorSha256','parentSessionId','childSessionId','nativeCut','parentSource',
      'parentNumericalSource','originalBinding','originalAbsenceProof','parentInventory','parentInventorySha256','childPointer',
      'editLayers','materialPublications','ancestors'],[
        'frozenNonNumericalOpeningV1','frozenProgramAbsenceOpeningV1','frozenAuthorChatSeedV1',
        'frozenAuthorChatSeedsV2'])
  if(value.origin!=='core-reservation'||!inheritanceIdV1(value.operationId)||value.operationKey!==`fork-op-${value.operationId}`
    ||!inheritanceIdV1(value.parentSessionId)||!inheritanceIdV1(value.childSessionId)||value.parentSessionId===value.childSessionId
    ||!inheritanceHashV1(value.anchorSha256))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  validateInheritanceCutV1(value.nativeCut);validateOriginalInheritanceBindingV1(value.originalBinding)
  validateStaticInventoryV1(value.parentInventory,value.parentSessionId)
  if(recordSha256(value.parentInventory)!==value.parentInventorySha256)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  const source=value.parentSource,{sourceSha256,...sourceBody}=source
  if(source.schemaVersion!==1||source.encoding!=='tavern-lore-current-source-data-v1'
    ||source.authority!=='consumer-data-only'||source.sessionId!==value.parentSessionId
    ||recordSha256(sourceBody)!==sourceSha256||source.sourceRecordSessionId!==value.originalBinding.sourceRecordSessionId
    ||source.original.importRecordRef.key!==value.originalBinding.importRecordRef.key
    ||source.original.importRecordRef.sha256!==value.originalBinding.importRecordRef.sha256)
    inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  const expected={...source.original.activePointer,inheritedFrom:value.parentSessionId,
    sourceRecordSessionId:value.originalBinding.sourceRecordSessionId}
  if(!inheritanceSameV1(value.childPointer,expected))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  const numeric=validateNumericalCaptureV1(value.parentNumericalSource)
  if(numeric.sessionId!==value.parentSessionId||!inheritanceSameV1(numeric.staticRows,value.parentInventory)
    ||!inheritanceSameV1(numeric.pointer,source.original.activePointer))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  if(!Array.isArray(value.editLayers)||value.editLayers.length>TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.ancestors
    ||!Array.isArray(value.materialPublications)||value.materialPublications.length>TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.publications
    ||!Array.isArray(value.ancestors)||value.ancestors.length>=TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.ancestors)
    inheritanceFailV1('SOURCE_INHERITANCE_BUDGET')
  for(const ancestor of value.ancestors)validateLayer(ancestor)
  if(value.frozenAuthorChatSeedV1!==undefined) {
    const seed=value.frozenAuthorChatSeedV1
    // The prepared record already covers the complete immutable seed. These
    // joins bind that retained State1 fact to this Source reservation's cut.
    if(seed.schemaVersion!==1||seed.encoding!=='native-author-chat-fork-seed-v1'
      ||seed.operationId!==value.operationId||seed.parent.binding.sessionId!==value.parentSessionId
      ||seed.childSessionId!==value.childSessionId
      ||seed.nativeCutSha256!==recordSha256(value.nativeCut))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  }
  if(value.frozenAuthorChatSeedsV2!==undefined) {
    const set=value.frozenAuthorChatSeedsV2
    inheritanceExactV1(set,['schemaVersion','encoding','programRef','seeds'])
    inheritanceExactV1(set.programRef,['epochRef','programSha256'])
    validateInheritanceRefV1(set.programRef.epochRef)
    if(set.schemaVersion!==2||set.encoding!=='native-author-chat-fork-seed-set-v2'
      ||!inheritanceHashV1(set.programRef.programSha256)||!Array.isArray(set.seeds))
      inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    // The prepared seal already covers every seed's bytes. State owns seed
    // checksums and declaration joins; this decoder binds their Source cut.
    const cutSha256=recordSha256(value.nativeCut)
    for(const seed of set.seeds) {
      if(seed.schemaVersion!==2||seed.encoding!=='native-author-chat-fork-seed-v2'
        ||seed.operationId!==value.operationId||seed.parent.binding.sessionId!==value.parentSessionId
        ||seed.childSessionId!==value.childSessionId||seed.nativeCutSha256!==cutSha256)
        inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    }
  }
  if(Object.hasOwn(value,'frozenNonNumericalOpeningV1')&&Object.hasOwn(value,'frozenProgramAbsenceOpeningV1'))
    inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  if(Object.hasOwn(value,'frozenNonNumericalOpeningV1'))validateFrozenNonNumericalOpeningV1(value.frozenNonNumericalOpeningV1)
  if(Object.hasOwn(value,'frozenProgramAbsenceOpeningV1')) {
    const frozen=validateFrozenProgramAbsenceOpeningV1((raw as TavernSourcePreparedV1).frozenProgramAbsenceOpeningV1)
    assertFrozenProgramAbsenceOpeningCutV1(frozen,value.nativeCut)
    if(frozen.kind==='program-absence'&&(frozen.record.childSessionId!==value.childSessionId
      ||frozen.record.parentSessionId!==value.parentSessionId))inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
    const checked=Object.freeze({...value,frozenProgramAbsenceOpeningV1:frozen})
    if(JSON.stringify(checked)!==JSON.stringify(value))inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
    rememberParsedDataV1(checked)
    checkedPreparedInheritance.add(checked)
    return checked
  }
  rememberParsedDataV1(value)
  checkedPreparedInheritance.add(value)
  return value
}
export function validateApplyInheritanceV1(raw:unknown):TavernSourceApplyIntentV1 {
  const value=sealed<TavernSourceApplyIntentV1>(raw,'native-tavern-source-inheritance-apply-intent-v1','applyIntentSha256',
    ['childSessionId','preparedRef','createdAt','nativeSetup','priorMeta','priorPointer','writes','childInventorySha256'])
  if(!inheritanceIdV1(value.childSessionId)||!inheritanceHashV1(value.childInventorySha256))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  validateInheritanceRefV1(value.preparedRef,tavernSourcePreparedKeyV1(value.childSessionId));inheritanceCountV1(value.createdAt)
  validateStaticRowV1(value.priorMeta,value.childSessionId);validateStaticRowV1(value.priorPointer,value.childSessionId)
  if(value.priorMeta.table!=='branch'||value.priorMeta.key!==`${value.childSessionId}__meta`
    ||value.priorPointer.table!=='branch'||value.priorPointer.key!==`${value.childSessionId}__import-active`)
    inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  if(value.nativeSetup!==null){inheritanceExactV1(value.nativeSetup,['eventCount','prefixSha256'])
    inheritanceCountV1(value.nativeSetup.eventCount);if(!inheritanceHashV1(value.nativeSetup.prefixSha256))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')}
  if(!Array.isArray(value.writes)||value.writes.length>TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.rows)inheritanceFailV1('SOURCE_INHERITANCE_BUDGET')
  for(const write of value.writes) {
    inheritanceExactV1(write,['table','parentKey','childKey','prior','next','policy'])
    validateStaticRowV1(write.prior,value.childSessionId);validateStaticRowV1(write.next,value.childSessionId)
    if(write.prior.key!==write.childKey||write.next.key!==write.childKey||write.prior.table!==write.table
      ||write.next.table!==write.table||typeof write.policy!=='string'
      ||!['exact-static-copy','parent-settings-then-explicit-child-fields'].includes(write.policy))
      inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  }
  validateStaticInventoryV1(value.writes.map(write=>write.next),value.childSessionId)
  if(recordSha256(value.writes.map(write=>write.next))!==value.childInventorySha256)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  return rememberParsedDataV1(value)
}
export function validateCommitInheritanceV1(raw:unknown):TavernSourceCommitV1 {
  const value=sealed<TavernSourceCommitV1>(raw,'native-tavern-source-inheritance-commit-v1','commitSha256',
    ['childSessionId','preparedRef','applyIntentRef','editBaselineRef','editBaselineSlotRef','materialBaselineRef',
      'childInventorySha256','childPointerSha256','childNumericalSource'])
  if(!inheritanceIdV1(value.childSessionId)||!inheritanceHashV1(value.childInventorySha256)
    ||!inheritanceHashV1(value.childPointerSha256))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  validateInheritanceRefV1(value.preparedRef,tavernSourcePreparedKeyV1(value.childSessionId))
  validateInheritanceRefV1(value.applyIntentRef,tavernSourceApplyKeyV1(value.childSessionId))
  validateInheritanceRefV1(value.editBaselineRef,tavernSourceEditBaselineKeyV1(value.childSessionId))
  validateInheritanceRefV1(value.editBaselineSlotRef)
  validateInheritanceRefV1(value.materialBaselineRef,tavernSourceMaterialBaselineKeyV1(value.childSessionId))
  const numeric=validateNumericalCaptureV1(value.childNumericalSource)
  if(numeric.sessionId!==value.childSessionId||inheritanceDataSha256V1(numeric.staticRows)!==value.childInventorySha256
    ||inheritanceDataSha256V1(numeric.pointer)!==value.childPointerSha256)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  return rememberParsedDataV1(value)
}
export function validateReadyInheritanceV1(raw:unknown):TavernSourceReadyV1 {
  const value=sealed<TavernSourceReadyV1>(raw,'native-tavern-source-inheritance-ready-v1','readySha256',
    ['childSessionId','binding','priorMeta','metadata'])
  if(!inheritanceIdV1(value.childSessionId))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  inheritanceExactV1(value.binding,['schemaVersion','preparedRef','applyIntentRef','commitRef'])
  if(value.binding.schemaVersion!==1)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  validateInheritanceRefV1(value.binding.preparedRef,tavernSourcePreparedKeyV1(value.childSessionId))
  validateInheritanceRefV1(value.binding.applyIntentRef,tavernSourceApplyKeyV1(value.childSessionId))
  validateInheritanceRefV1(value.binding.commitRef,tavernSourceCommitKeyV1(value.childSessionId))
  validateStaticRowV1(value.priorMeta,value.childSessionId)
  if(!inheritanceObjectV1(value.metadata))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  return rememberParsedDataV1(value)
}
export function frozenInheritanceRefV1(prepared:TavernSourcePreparedV1):TavernSourceFrozenRefV1 {
  return sealInheritanceDataV1({schemaVersion:1 as const,encoding:'native-tavern-source-inheritance-frozen-ref-v1' as const,
    childSessionId:prepared.childSessionId,parentSessionId:prepared.parentSessionId,operationId:prepared.operationId,
    anchorSha256:prepared.anchorSha256,seedLength:prepared.nativeCut.seedLength,prefixSha256:prepared.nativeCut.prefixSha256,
    parentSourceSha256:prepared.parentSource.sourceSha256,parentInventorySha256:prepared.parentInventorySha256,
    originalIdentitySha256:inheritanceDataSha256V1(prepared.originalBinding),
    preparedRef:inheritanceRefV1(tavernSourcePreparedKeyV1(prepared.childSessionId),prepared)},
  'frozenRefSha256') as unknown as TavernSourceFrozenRefV1
}
