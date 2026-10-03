/** Persisted schema/hash ownership for the independent append-only lore editor.
 * Historical edit SourceSHA is a CAS read basis, never current permission. */
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneSchemaData} from './tavern-mvu-schema-data.js'
import {cloneRoleplayTavernLoreDataV1,TavernLoreDataFailureV1} from './roleplay-tavern-lore-data.js'
import {compileTavernLoreBookV1,validateTavernLoreAbsentSourceReferenceV1} from './tavern-lore-compiler.mjs'
import type {TavernLoreCompilationInputV1,TavernLoreCurrentNativeOverlayV1,
  TavernLoreCurrentNativeFieldsV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernLoreEditIdentityV1,TavernLoreEditHeadV1,TavernLoreEditEventV1,
  TavernLoreEditRequestV1,TavernLoreEditRefV1,TavernLoreEditHeadRefV1,
  TavernLoreEditReceiptV1,TavernLoreEditDiagnosticV1} from './roleplay-tavern-lore-edits-types.js'

export const TAVERN_LORE_EDITS_BOUNDS_V1=Object.freeze({events:256,journalBytes:8_388_608,
  requestBytes:1_048_576,recordBytes:1_114_112,dataBytes:16_777_216,nodes:131_072,depth:66})
const ID=/^[a-zA-Z0-9_-]{1,128}$/
const HASH=/^[a-f0-9]{64}$/
export const object=(value:unknown):value is Record<string,unknown>=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)
const hash=(value:unknown):value is string=>typeof value==='string'&&HASH.test(value)
export const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
export class LoreEditFailureV1 extends Error {
  constructor(readonly diagnostic:TavernLoreEditDiagnosticV1){super(diagnostic.code);this.name='LoreEditFailureV1'}
}
export function fail(code:TavernLoreEditDiagnosticV1['code'],detail?:string):never {
  throw new LoreEditFailureV1({code,...(detail?{detail}:{})})
}
export function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
export function strictData<T>(value:T,bytes:number):T {
  try{return cloneSchemaData(value,bytes,{nodes:TAVERN_LORE_EDITS_BOUNDS_V1.nodes,depth:TAVERN_LORE_EDITS_BOUNDS_V1.depth})}
  catch(error){fail(error instanceof Error&&/LIMIT/.test(error.message)?'DATA_BUDGET':'REQUEST_DATA_INVALID')}
}
export function boundedLoreEditData<T>(value:T):T {
  try{return cloneRoleplayTavernLoreDataV1(value,TAVERN_LORE_EDITS_BOUNDS_V1.dataBytes)}
  catch(error){fail(error instanceof TavernLoreDataFailureV1&&error.code==='LORE_DATA_BUDGET'
    ?'DATA_BUDGET':'REQUEST_DATA_INVALID')}
}
export function exact(value:Record<string,unknown>,keys:readonly string[],code:TavernLoreEditDiagnosticV1['code']):void {
  if(Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key)))fail(code)
}
export function sessionId(value:unknown):asserts value is string {
  if(typeof value!=='string'||!ID.test(value))fail('REQUEST_INVALID')
}
export function requestData(raw:unknown):TavernLoreEditRequestV1 {
  const value=strictData(raw,TAVERN_LORE_EDITS_BOUNDS_V1.requestBytes)
  if(!object(value))fail('REQUEST_INVALID')
  exact(value,['sessionId','expectedSourceSha256','expectedRevision','operationId','rawEntryPointer','rawEntrySha256','fields'],
    'REQUEST_INVALID')
  sessionId(value.sessionId);sessionId(value.operationId)
  if(!hash(value.expectedSourceSha256)||!hash(value.rawEntrySha256)||typeof value.expectedRevision!=='number'
    ||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0
    ||value.expectedRevision>TAVERN_LORE_EDITS_BOUNDS_V1.events||typeof value.rawEntryPointer!=='string'
    ||Buffer.byteLength(value.rawEntryPointer,'utf8')>4096||!value.rawEntryPointer.startsWith('/')
    ||/[\x00-\x1f]/.test(value.rawEntryPointer)||!object(value.fields)||!Object.keys(value.fields).length)fail('REQUEST_INVALID')
  return value as unknown as TavernLoreEditRequestV1
}
export function identityOf(source:TavernLoreSourceDataV1):TavernLoreEditIdentityV1 {
  if(!object(source)||source.schemaVersion!==1||source.encoding!=='tavern-lore-current-source-data-v1'
    ||source.authority!=='consumer-data-only'||!hash(source.sourceSha256))fail('SOURCE_IDENTITY_INVALID')
  const {sourceSha256,...sourceBody}=source
  if(recordSha256(sourceBody)!==sourceSha256)fail('SOURCE_IDENTITY_INVALID')
  const original=source.original,primary=original.primary
  if(!hash(original.rawSha256)||!hash(original.documentSha256)||!hash(primary.bookSha256)
    ||primary.bookSha256!==recordSha256(primary.value)
    ||!['primary','proven-absence'].includes(primary.binding))fail('SOURCE_IDENTITY_INVALID')
  if(primary.binding==='proven-absence') {
    const proof=primary.absenceProof
    const ancestor=source.inheritance?.originalBinding
    validateTavernLoreAbsentSourceReferenceV1(compilerInput(source,{schemaVersion:1,
      encoding:'st-character-book-current-native-overlay-v1',entries:[]}).source)
    if(proof.dataSha256!==original.dataSha256||proof.decodedFormat!==original.decodedFormat
      ||proof.normalizedSha256!==original.normalizedSha256||proof.coverageSha256!==original.coverageSha256
      ||proof.transactionId!==original.transactionId||!same(proof.activePointer,ancestor?.originalPointer??original.activePointer)
      ||!same(proof.activePointerRef,ancestor?.originalPointerRef??original.activePointerRef)
      ||!same(proof.importRecordRef,original.importRecordRef)) {
      fail('SOURCE_IDENTITY_INVALID')
    }
  }
  const value={schemaVersion:1 as const,encoding:'tavern-lore-edit-original-identity-v1' as const,
    sessionId:source.sessionId,sourceRecordSessionId:source.sourceRecordSessionId,
    importId:original.activePointer.importId,rawSha256:original.rawSha256,transactionId:original.transactionId,
    documentSha256:original.documentSha256,bookPointer:primary.bookPointer,bookSha256:primary.bookSha256}
  sessionId(value.sessionId);sessionId(value.sourceRecordSessionId)
  if(typeof value.importId!=='string'||!ID.test(value.importId)||typeof value.transactionId!=='string'
    ||!value.transactionId.length||Buffer.byteLength(value.transactionId,'utf8')>256
    ||value.bookPointer!=='/data/character_book')fail('SOURCE_IDENTITY_INVALID')
  return freeze(value)
}
export const namespace=(identitySha256:string)=>`tavern_loreedit_v1__${identitySha256}__`
export const headKey=(identitySha256:string)=>`${namespace(identitySha256)}head`
export const eventKey=(identitySha256:string,operationId:string)=>`${namespace(identitySha256)}event__${sha256(operationId)}`
export const rowRef=(key:string,value:unknown):TavernLoreEditRefV1=>({key,sha256:recordSha256(value)})
export const headRef=(head:TavernLoreEditHeadV1,exists:boolean):TavernLoreEditHeadRefV1=>({
  key:headKey(head.identitySha256),exists,sha256:exists?recordSha256(head):'missing'})
function sealHead(body:Omit<TavernLoreEditHeadV1,'headSha256'>):TavernLoreEditHeadV1 {
  return freeze({...body,headSha256:recordSha256(body)})
}
export function genesis(identity:TavernLoreEditIdentityV1):TavernLoreEditHeadV1 {
  const identitySha256=recordSha256(identity)
  return sealHead({schemaVersion:1,encoding:'tavern-lore-edit-head-v1',identity,identitySha256,
    revision:0,lastEvent:null,chainSha256:recordSha256({schemaVersion:1,
      encoding:'tavern-lore-edit-genesis-chain-v1',identitySha256})})
}
export function parseHead(raw:unknown,identity:TavernLoreEditIdentityV1):TavernLoreEditHeadV1 {
  const identitySha256=recordSha256(identity)
  const value=strictData(raw,TAVERN_LORE_EDITS_BOUNDS_V1.recordBytes)
  if(!object(value))fail('JOURNAL_SCHEMA_INVALID')
  exact(value,['schemaVersion','encoding','identity','identitySha256','revision','lastEvent','chainSha256','headSha256'],
    'JOURNAL_SCHEMA_INVALID')
  if(value.schemaVersion!==1||value.encoding!=='tavern-lore-edit-head-v1'||typeof value.revision!=='number'
    ||!Number.isSafeInteger(value.revision)||value.revision<0||value.revision>TAVERN_LORE_EDITS_BOUNDS_V1.events
    ||!hash(value.chainSha256)||!hash(value.headSha256))fail('JOURNAL_SCHEMA_INVALID')
  if(!same(value.identity,identity)||value.identitySha256!==identitySha256)fail('JOURNAL_IDENTITY_MISMATCH')
  if(value.lastEvent!==null) {
    if(!object(value.lastEvent))fail('JOURNAL_SCHEMA_INVALID')
    exact(value.lastEvent,['key','sha256'],'JOURNAL_SCHEMA_INVALID')
    if(typeof value.lastEvent.key!=='string'||!value.lastEvent.key.startsWith(`${namespace(identitySha256)}event__`)
      ||!hash(value.lastEvent.sha256))fail('JOURNAL_SCHEMA_INVALID')
  }
  const {headSha256,...body}=value
  if(recordSha256(body)!==headSha256)fail('JOURNAL_HASH_INVALID')
  if((value.revision===0)!==(value.lastEvent===null))fail('JOURNAL_CHAIN_INVALID')
  return freeze(value as unknown as TavernLoreEditHeadV1)
}
export function eventFrom(request:TavernLoreEditRequestV1,baseHead:TavernLoreEditHeadV1,exists:boolean):TavernLoreEditEventV1 {
  const body={schemaVersion:1 as const,encoding:'tavern-lore-edit-event-v1' as const,state:'prepared' as const,
    identity:baseHead.identity,identitySha256:baseHead.identitySha256,request,payloadSha256:recordSha256(request),
    baseHead,baseHeadRowSha256:exists?recordSha256(baseHead):'missing',revision:baseHead.revision+1}
  return freeze({...body,eventSha256:recordSha256(body)})
}
export function parseEvent(raw:unknown,key:string,identity:TavernLoreEditIdentityV1):TavernLoreEditEventV1 {
  const value=strictData(raw,TAVERN_LORE_EDITS_BOUNDS_V1.recordBytes)
  if(!object(value))fail('JOURNAL_SCHEMA_INVALID')
  exact(value,['schemaVersion','encoding','state','identity','identitySha256','request','payloadSha256','baseHead',
    'baseHeadRowSha256','revision','eventSha256'],'JOURNAL_SCHEMA_INVALID')
  if(value.schemaVersion!==1||value.encoding!=='tavern-lore-edit-event-v1'||value.state!=='prepared')fail('JOURNAL_SCHEMA_INVALID')
  if(!same(value.identity,identity)||value.identitySha256!==recordSha256(identity))fail('JOURNAL_IDENTITY_MISMATCH')
  const request=requestData(value.request),baseHead=parseHead(value.baseHead,identity)
  if(key!==eventKey(baseHead.identitySha256,request.operationId)||request.sessionId!==identity.sessionId
    ||value.payloadSha256!==recordSha256(request)||!hash(value.eventSha256))fail('JOURNAL_HASH_INVALID')
  if(typeof value.revision!=='number'||!Number.isSafeInteger(value.revision)
    ||value.revision!==baseHead.revision+1||value.revision!==request.expectedRevision+1
    ||value.revision>TAVERN_LORE_EDITS_BOUNDS_V1.events
    ||value.baseHeadRowSha256!==(baseHead.revision===0?'missing':recordSha256(baseHead)))fail('JOURNAL_CHAIN_INVALID')
  const {eventSha256,...body}=value
  if(recordSha256(body)!==eventSha256)fail('JOURNAL_HASH_INVALID')
  return freeze({...value,request,baseHead} as unknown as TavernLoreEditEventV1)
}
export function nextHead(event:TavernLoreEditEventV1):TavernLoreEditHeadV1 {
  const eventRef=rowRef(eventKey(event.identitySha256,event.request.operationId),event)
  return sealHead({schemaVersion:1,encoding:'tavern-lore-edit-head-v1',identity:event.identity,
    identitySha256:event.identitySha256,revision:event.revision,lastEvent:eventRef,
    chainSha256:recordSha256({schemaVersion:1,encoding:'tavern-lore-edit-chain-link-v1',
      identitySha256:event.identitySha256,previousChainSha256:event.baseHead.chainSha256,eventRef})})
}
export function compilerInput(source:TavernLoreSourceDataV1,overlay:TavernLoreCurrentNativeOverlayV1):TavernLoreCompilationInputV1 {
  const original=source.original
  return {schemaVersion:1,encoding:'st-character-book-compilation-input-v1',book:original.primary.value as TavernLoreCompilationInputV1['book'],
    source:{schemaVersion:1,encoding:'st-character-book-source-reference-v1',ownerSessionId:source.sessionId,
      sourceRecordSessionId:source.sourceRecordSessionId,importId:original.activePointer.importId,
      rawSourceSha256:original.rawSha256,importRecordSha256:original.importRecordRef.sha256,
      sourceSnapshotSha256:source.sourceSha256,documentSha256:original.documentSha256,
      bookPointer:original.primary.bookPointer,bookValueSha256:original.primary.bookSha256,
      sourceFormat:original.decodedFormat.endsWith('v3')?'ccv3-character-book':'ccv2-character-book',
      ...(source.inheritance?{inheritance:source.inheritance}:{}),
      ...(original.primary.binding==='proven-absence'
        ?{bookPresence:'proven-absence' as const,absenceProof:original.primary.absenceProof}:{})},currentNativeOverlay:overlay}
}
export function validateFields(source:TavernLoreSourceDataV1,request:TavernLoreEditRequestV1):void {
  const matches=source.original.primary.entries.filter(entry=>entry.ref.entryPointer===request.rawEntryPointer)
  if(matches.length!==1||matches[0]!.ref.entrySha256!==request.rawEntrySha256
    ||recordSha256(matches[0]!.value)!==request.rawEntrySha256)fail('ENTRY_LINK_INVALID')
  // This temporary validation ref is consumer data, not a persisted origin.
  // Returned origins are built from the actual published head and journal.
  const ref={schemaVersion:1,encoding:'tavern-lore-edit-validation-data-v1',operationId:request.operationId}
  const result=compileTavernLoreBookV1(compilerInput(source,{schemaVersion:1,
    encoding:'st-character-book-current-native-overlay-v1',entries:[{
      rawEntryPointer:request.rawEntryPointer,rawEntrySha256:request.rawEntrySha256,fields:request.fields,
      origin:{kind:'append-only-lore-overlay',ref,refSha256:recordSha256(ref)}}]}))
  if(result.kind!=='compiled')fail('FIELDS_INVALID',result.diagnostics[0]?.code)
}
export function receiptOf(event:TavernLoreEditEventV1):TavernLoreEditReceiptV1 {
  const request=event.request,body={schemaVersion:1 as const,encoding:'tavern-lore-edit-receipt-v1' as const,
    authority:'consumer-data-only' as const,identitySha256:event.identitySha256,operationId:request.operationId,
    payloadSha256:event.payloadSha256,revision:event.revision,editSourceSha256:request.expectedSourceSha256,
    rawEntryPointer:request.rawEntryPointer,rawEntrySha256:request.rawEntrySha256,fieldsSha256:recordSha256(request.fields),
    eventRef:rowRef(eventKey(event.identitySha256,request.operationId),event),headRef:headRef(nextHead(event),true)}
  return freeze({...body,receiptSha256:recordSha256(body)})
}
export type EditAccumulationV1={fields:TavernLoreCurrentNativeFieldsV1;events:TavernLoreEditRefV1[];rawEntrySha256:string}
