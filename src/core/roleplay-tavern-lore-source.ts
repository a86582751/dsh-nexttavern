/** Current structured primary worldbook Source. Core owns the import lock;
 * current rows stay own-session; inherited imports require the actual closed
 * Source/Native lineage reader. Hashes describe frozen data,
 * never template, suppression, publication or Native execution permission. */
import {recordSha256, sha256} from './roleplay-data.js'
import {roleplaySourceMetadataValue} from './roleplay-input-state.js'
import {cloneRoleplayTavernLoreDataV1,cloneRoleplayTavernLoreImportRecordV1,TavernLoreDataFailureV1,TAVERN_LORE_DATA_BOUNDS_V1}
  from './roleplay-tavern-lore-data.js'
import type {TavernLoreDataBudgetV1} from './roleplay-tavern-lore-data.js'
import {CARD_LIMITS} from './tavern-card.js'
import type {DecodedTavernCard} from './tavern-card.js'
import {assertImportRecordIntegrity, assertAssignmentBudget, assertReferenceBudget,
  assertReviewProof, importCoverage, normalizeSourceSpans, spanText,
  validateAssignmentIdentities,readStructuredImportDataV1} from './roleplay-import-record.js'
import type {ImportPointer, ImportRecord} from './roleplay-import-types.js'
import type {MvuSourceTable} from './roleplay-mvu-source.js'
import type {LegacyCurrentRowDataV1, LegacyRowRefDataV1} from './roleplay-tavern-lore-contributions.js'
import type {TavernLoreBookAbsenceProofV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreSourceDepsV1, TavernLoreSourceDataV1, TavernLoreSourceRowDataV1,
  TavernLoreRawEntryDataV1, TavernLoreSourcePrimaryV1, TavernLoreContributionInputV1, TavernLoreSourceCaptureV1,
  TavernLoreSourceFailureCodeV1, TavernLoreSourceOutsideCodeV1,
  TavernLoreSourceDiagnosticV1,TavernLoreSourceCounterWitnessV1} from './roleplay-tavern-lore-source-types.js'
export type * from './roleplay-tavern-lore-source-types.js'

export const TAVERN_LORE_SOURCE_BOUNDS_V1 = Object.freeze({...TAVERN_LORE_DATA_BOUNDS_V1,rows:4096})
const ID = /^[a-zA-Z0-9_-]{1,128}$/
const IMPORT_ID = /^[a-zA-Z0-9_-]{1,64}$/
const KEY = /^[a-zA-Z0-9_-]{1,256}$/
const HASH = /^[a-f0-9]{64}$/
const TABLES:readonly MvuSourceTable[] = ['branch','cards','worldbook','rules','status','opening']
const isObject = (value:unknown):value is Record<string,unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const isHash = (value:unknown):value is string => typeof value === 'string' && HASH.test(value)
const isVersion = (value:unknown):value is string => value === 'missing' || isHash(value)
const same = (left:unknown,right:unknown) => recordSha256(left) === recordSha256(right)
const pointerPart = (value:string) => value.replace(/~/g,'~0').replace(/\//g,'~1')
const rowId = (table:MvuSourceTable,key:string) => `${table}:${key}`
class SourceFailure extends Error {
  constructor(readonly diagnostic:TavernLoreSourceDiagnosticV1) {super(diagnostic.code)}
}
class OutsideSource extends Error {
  constructor(readonly code:TavernLoreSourceOutsideCodeV1, readonly pointer:string,
    readonly missingEvidence:readonly string[]) {super(code)}
}
function fail(code:TavernLoreSourceFailureCodeV1,pointer:string,
  limit?:TavernLoreSourceDiagnosticV1['limit']):never {
  throw new SourceFailure({code,pointer,...(limit ? {limit} : {})})
}
function outside(code:TavernLoreSourceOutsideCodeV1,pointer:string,missingEvidence:readonly string[]=[]):never {
  throw new OutsideSource(code,pointer,missingEvidence)
}
function freeze<T>(value:T):T {
  if(value && typeof value === 'object') {
    for(const child of Object.values(value))freeze(child)
    Object.freeze(value)
  }
  return value
}
/** This bridge owns Source pointers/codes; the lore-purpose clone owns bounds. */
function cloneData<T>(input:T,pointer:string,used?:TavernLoreDataBudgetV1,
  clone:typeof cloneRoleplayTavernLoreDataV1=cloneRoleplayTavernLoreDataV1):T {
  try {return clone(input,TAVERN_LORE_DATA_BOUNDS_V1.bytes,undefined,used)}
  catch(error) {
    if(error instanceof TavernLoreDataFailureV1)fail(error.code==='LORE_DATA_BUDGET' ? 'SOURCE_BUDGET' : 'DATA_INVALID',
      pointer,error.limit)
    throw error
  }
}
/** Adapter/import limits remain unchanged and must not become a generic invalid
 * source result. These are known maintained validator bounds, not author text. */
function importFailure(error:unknown,pointer:string):never {
  if(error instanceof SourceFailure)throw error
  const message=error instanceof Error ? error.message : ''
  const known:[RegExp,string,number][]=[
    [/JSON 大小超出字节限制/,'adapterJsonBytes',CARD_LIMITS.jsonBytes],
    [/角色卡大小超出字节/,'adapterSourceBytes',CARD_LIMITS.bytes],
    [/世界书条目数量超限/,'adapterRawEntries',CARD_LIMITS.entries],
    [/JSON 嵌套过深/,'adapterJsonDepth',CARD_LIMITS.depth],
    [/JSON 字段数量过多/,'adapterJsonNodes',CARD_LIMITS.nodes],
  ]
  const match=known.find(([pattern])=>pattern.test(message))
  if(match)fail('SOURCE_BUDGET',pointer,{field:match[1],maximum:match[2]})
  if(/超过.*上限|投影字符数或行数超限|PNG.*大小超限/.test(message)) {
    fail('SOURCE_BUDGET',pointer)
  }
  fail('IMPORT_RECORD_INVALID',pointer)
}
function exactKeys(value:Record<string,unknown>,keys:readonly string[],code:TavernLoreSourceFailureCodeV1,pointer:string) {
  if(Object.keys(value).some(key=>!keys.includes(key)))fail(code,pointer)
}
function versionMap(value:unknown,pointer:string):Record<string,string> {
  if(!isObject(value))fail('MEMBERSHIP_INVALID',pointer)
  if(Object.keys(value).length>TAVERN_LORE_SOURCE_BOUNDS_V1.rows)fail('SOURCE_BUDGET',pointer,
    {field:'currentRows',maximum:TAVERN_LORE_SOURCE_BOUNDS_V1.rows,observed:Object.keys(value).length})
  const result:Record<string,string>={}
  for(const [key,version] of Object.entries(value)) {
    if(!ID.test(key)||!isHash(version))fail('MEMBERSHIP_INVALID',pointer)
    result[key]=version
  }
  return result
}
function captured(deps:TavernLoreSourceDepsV1,sessionId:string):Extract<TavernLoreSourceCaptureV1,{kind:'captured-data'}> {
  if(typeof sessionId!=='string'||!ID.test(sessionId))fail('REQUEST_INVALID','/sessionId')
  const used:TavernLoreDataBudgetV1={bytes:0,nodes:0}
  const rawPointer=deps.readActivePointer(sessionId)
  if(rawPointer===undefined)outside('ACTIVE_SOURCE_MISSING','/activePointer')
  const pointer=cloneData(rawPointer,'/activePointer',used)
  if(!isObject(pointer)||typeof pointer.importId!=='string'||!IMPORT_ID.test(pointer.importId)
    ||!isHash(pointer.normalizedSha256)||!isHash(pointer.coverageSha256)
    ||typeof pointer.transactionId!=='string'||!ID.test(pointer.transactionId)) {
    fail('ACTIVE_POINTER_INVALID','/activePointer')
  }
  if(pointer.activatedAt!==undefined&&(typeof pointer.activatedAt!=='number'
    ||!Number.isSafeInteger(pointer.activatedAt)||pointer.activatedAt<0)) {
    fail('ACTIVE_POINTER_INVALID','/activePointer/activatedAt')
  }
  exactKeys(pointer,['importId','sourceRecordSessionId','normalizedSha256','transactionId',
    'coverageSha256','activatedAt','inheritedFrom'],'ACTIVE_POINTER_INVALID','/activePointer')
  const sourceRecordSessionId=pointer.sourceRecordSessionId??sessionId
  if(typeof sourceRecordSessionId!=='string'||!ID.test(sourceRecordSessionId)) {
    fail('ACTIVE_POINTER_INVALID','/activePointer/sourceRecordSessionId')
  }
  const activePointerRef:LegacyRowRefDataV1={table:'branch',key:`${sessionId}__import-active`,
    exists:true,sha256:recordSha256(pointer)}
  const storedPointer=deps.readRow('branch',activePointerRef.key)
  if(storedPointer===undefined||!same(cloneData(storedPointer,'/activePointerRef'),pointer)) {
    fail('ACTIVE_POINTER_REF_CHANGED','/activePointerRef')
  }
  if(Object.hasOwn(pointer,'inheritedFrom')&&(typeof pointer.inheritedFrom!=='string'||!ID.test(pointer.inheritedFrom)
    ||pointer.inheritedFrom===sessionId))fail('ACTIVE_POINTER_INVALID','/activePointer/inheritedFrom')
  const isInherited=sourceRecordSessionId!==sessionId||Object.hasOwn(pointer,'inheritedFrom')
  const lineage=isInherited?deps.readSourceInheritance?.(sessionId):undefined
  if(isInherited&&lineage?.kind!=='committed-data') {
    outside('INHERITED_SOURCE_EVIDENCE_MISSING','/activePointer',[
      'actual Native branch parent and frozen cut',
      'committed inheritance/material-copy lineage and own-session current rows',
      'immutable ancestor import binding independent of later parent activation',
    ])
  }
  const inheritance=lineage?.kind==='committed-data'?lineage.data:undefined
  if(inheritance) {
    const original=inheritance.originalBinding
    if(inheritance.childSessionId!==sessionId||inheritance.parentSessionId!==pointer.inheritedFrom
      ||original.sourceRecordSessionId!==sourceRecordSessionId||original.importId!==pointer.importId
      ||original.normalizedSha256!==pointer.normalizedSha256||original.coverageSha256!==pointer.coverageSha256
      ||original.transactionId!==pointer.transactionId||original.originalPointer.activatedAt!==pointer.activatedAt)
      fail('ACTIVE_POINTER_INVALID','/activePointer/inheritance')
  }
  const rawRecord=deps.readImportRecord(sourceRecordSessionId,pointer.importId)
  if(rawRecord===undefined)fail('IMPORT_RECORD_INVALID','/activeImport')
  const record=cloneData(rawRecord,'/activeImport',used,cloneRoleplayTavernLoreImportRecordV1) as ImportRecord
  if(!isObject(record)||record.sessionId!==sourceRecordSessionId||record.importId!==pointer.importId
    ||record.status!=='active'||record.normalizedSha256!==pointer.normalizedSha256
    ||record.activation?.transactionId!==pointer.transactionId)fail('IMPORT_RECORD_INVALID','/activeImport')
  if(record.schemaVersion===3)outside('LEGACY_SOURCE_OUTSIDE_DOMAIN','/activeImport/normalizer')
  const normalizer: 'tavern-fields-v1'|'tavern-fields-v2'|'nexttavern-fields-v1'|undefined=
    record.schemaVersion===4&&record.normalizer==='tavern-fields-v1' ? 'tavern-fields-v1'
      : record.schemaVersion===5&&record.normalizer==='tavern-fields-v2' ? 'tavern-fields-v2'
      : record.schemaVersion===6&&record.normalizer==='nexttavern-fields-v1' ? 'nexttavern-fields-v1' : undefined
  if(!normalizer)outside('STRUCTURED_VERSION_OUTSIDE_DOMAIN','/activeImport/normalizer')
  if(record.mode==='merge')outside('MERGE_PROVENANCE_UNPROVEN','/activeImport/mode',[
    'complete prior import/contribution lineage for current merged fields',
  ])
  if(record.mode!==undefined&&record.mode!=='replace')fail('IMPORT_RECORD_INVALID','/activeImport/mode')
  try {assertImportRecordIntegrity(record)}catch(error) {importFailure(error,'/activeImport')}
  const importRecordRef:LegacyRowRefDataV1={table:'branch',key:`${sourceRecordSessionId}__import-${record.importId}`,
    exists:true,sha256:recordSha256(record)}
  const storedRecord=deps.readRow('branch',importRecordRef.key)
  if(storedRecord===undefined||!same(cloneData(storedRecord,'/importRecordRef',undefined,
    cloneRoleplayTavernLoreImportRecordV1),record))fail('IMPORT_RECORD_REF_CHANGED','/importRecordRef')
  if(inheritance&&!same(importRecordRef,{table:'branch',exists:true,...inheritance.originalBinding.importRecordRef}))
    fail('IMPORT_RECORD_REF_CHANGED','/importRecordRef/inheritance')
  if(!record.sourceEnvelope||!record.activation||!isHash(record.rawSha256))fail('IMPORT_RECORD_INVALID','/activeImport')
  if(pointer.activatedAt!==record.activatedAt)fail('ACTIVATION_INVALID','/activeImport/activatedAt')
  let coverage:ReturnType<typeof importCoverage>
  try {coverage=importCoverage(record)}catch(error) {importFailure(error,'/activeImport/coverage')}
  if(coverage.coverage!==1||coverage.uncovered.length||coverage.overlaps.length
    ||recordSha256(coverage)!==pointer.coverageSha256||!same(record.coverage,coverage)) {
    fail('COVERAGE_INVALID','/activeImport/coverage')
  }
  try {
    assertAssignmentBudget(record.assignments);assertReferenceBudget(record,record.assignments)
    validateAssignmentIdentities(record.assignments)
    if(!record.assignmentProof)assertReviewProof(record)
    for(const assignment of record.assignments) {
      const spans=normalizeSourceSpans(assignment.sourceSpans,record.lineCount)
      const hash=sha256(spanText(record,spans))
      if(!same(spans,assignment.sourceSpans)||assignment.sourceSha256!==hash
        ||assignment.materializedSha256!==hash)fail('ASSIGNMENT_INVALID','/activeImport/assignments')
    }
  }catch(error) {importFailure(error,'/activeImport/assignments')}
  const activation=record.activation.writeDigests
  if(!Array.isArray(activation)||!activation.length)fail('ACTIVATION_INVALID','/activeImport/activation')
  if(activation.length>TAVERN_LORE_SOURCE_BOUNDS_V1.rows)fail('SOURCE_BUDGET','/activeImport/activation',
    {field:'activationRows',maximum:TAVERN_LORE_SOURCE_BOUNDS_V1.rows,observed:activation.length})
  const writes=new Set<string>()
  for(const row of activation) {
    if(!isObject(row)||!TABLES.includes(row.tableName as MvuSourceTable)||typeof row.key!=='string'
      ||!KEY.test(row.key)||!row.key.startsWith(`${sourceRecordSessionId}__`)||!isVersion(row.sha256)
      ||writes.has(`${row.tableName}:${row.key}`))fail('ACTIVATION_INVALID','/activeImport/activation/writeDigests')
    if(row.tableName==='branch'&&row.key!==`${sourceRecordSessionId}__settings`
      ||row.tableName==='rules'&&row.key!==`${sourceRecordSessionId}__spec`
      ||row.tableName==='status'&&![`${sourceRecordSessionId}__spec`,`${sourceRecordSessionId}__panel`].includes(row.key)
      ||row.tableName==='opening'&&row.key!==`${sourceRecordSessionId}__scene`) {
      fail('ACTIVATION_INVALID','/activeImport/activation/writeDigests')
    }
    writes.add(`${row.tableName}:${row.key}`)
  }
  if(activation.filter(row=>row.tableName==='rules'&&row.key===`${sourceRecordSessionId}__spec`&&isHash(row.sha256)).length!==1) {
    fail('ACTIVATION_INVALID','/activeImport/activation/writeDigests')
  }
  let decoded:DecodedTavernCard
  try {decoded=readStructuredImportDataV1(record).decoded}
  catch(error) {importFailure(error,'/activeImport/sourceEnvelope')}
  if(!['json-v2','json-v3','png-v2','png-v3','json-nexttavern-v1'].includes(decoded.format)||decoded.document.data!==decoded.data) {
    outside('STRUCTURED_VERSION_OUTSIDE_DOMAIN','/rawDecoded')
  }
  // Freeze this decoder fact before cloning: detached aliases cannot choose a
  // different raw-book pointer. Object entry keys likewise precede any projection.
  const documentDataRootPointer='/data' as const,bookPointer='/data/character_book' as const
  const hasBook=Object.hasOwn(decoded.data,'character_book')
  const rawBook=decoded.data.character_book
  // JSON null/arrays/nonobjects are malformed presence, not proof of absence.
  if(hasBook&&!isObject(rawBook))fail('IMPORT_RECORD_INVALID',bookPointer)
  const rawEntries=hasBook ? (rawBook as Record<string,unknown>).entries??[] : []
  if(!Array.isArray(rawEntries)&&!isObject(rawEntries))fail('IMPORT_RECORD_INVALID',`${bookPointer}/entries`)
  const entries=Object.entries(rawEntries)
  if(entries.length>TAVERN_LORE_SOURCE_BOUNDS_V1.rows)fail('SOURCE_BUDGET',`${bookPointer}/entries`,
    {field:'rawEntries',maximum:TAVERN_LORE_SOURCE_BOUNDS_V1.rows,observed:entries.length})
  // A decoder owns the /data alias. Clone its document once so downstream
  // structural projectors consume that same root, without carrying PNG cover
  // bytes or duplicating the complete document under a detached data field.
  const {document:decodedDocument,data:_decodedData,avatarBase64:_avatar,...decodedMetadata}=decoded
  const document=cloneData(decodedDocument,'/rawDecoded/document')
  const rawDecoded:DecodedTavernCard={...decodedMetadata,document,data:document.data as DecodedTavernCard['data']}
  const book=hasBook ? cloneData(rawBook as Record<string,unknown>,bookPointer) : null
  const bookSha256=recordSha256(book)
  let absenceProof:TavernLoreBookAbsenceProofV1|undefined
  if(!hasBook&&inheritance) {
    if(lineage?.kind!=='committed-data'||!lineage.originalAbsenceProof
      ||lineage.originalAbsenceProof.documentSha256!==recordSha256(decoded.document)
      ||lineage.originalAbsenceProof.dataSha256!==recordSha256(decoded.data)
      ||lineage.originalAbsenceProof.rawSha256!==record.rawSha256)
      fail('IMPORT_RECORD_INVALID',bookPointer)
    absenceProof=cloneData(lineage.originalAbsenceProof,'/originalAbsenceProof')
  }else if(!hasBook) {
    // Use the exact decoder document. All import integrity, coverage, activation
    // and actual pointer/record checks above still precede this consumer datum.
    const proofBody={schemaVersion:1 as const,encoding:'st-character-book-proven-absence-data-v1' as const,
      authority:'consumer-data-only' as const,ownerSessionId:sessionId,sourceRecordSessionId,importId:record.importId,
      documentDataRootPointer,bookPointer,decodedFormat:decoded.format as TavernLoreBookAbsenceProofV1['decodedFormat'],
      document:rawDecoded.document as TavernLoreBookAbsenceProofV1['document'],
      documentSha256:recordSha256(decoded.document),dataSha256:recordSha256(decoded.data),
      rawSha256:record.rawSha256,normalizedSha256:record.normalizedSha256,
      coverageSha256:pointer.coverageSha256 as string,transactionId:pointer.transactionId as string,
      activatedAt:record.activatedAt??null,activePointer:pointer as unknown as ImportPointer,
      activePointerRef:{...activePointerRef,table:'branch' as const,exists:true as const},
      importRecordRef:{...importRecordRef,table:'branch' as const,exists:true as const},activation:record.activation}
    absenceProof={...proofBody,absenceProofSha256:recordSha256(proofBody)}
  }
  const rawEntryData:TavernLoreRawEntryDataV1[]=entries.map(([key,value],entryOrdinal)=>{
    if(!isObject(value)||typeof value.content!=='string')fail('IMPORT_RECORD_INVALID',`${bookPointer}/entries/${pointerPart(key)}`)
    const raw=cloneData(value,`${bookPointer}/entries/${pointerPart(key)}`)
    return {entryKey:key,value:raw,ref:{sessionId,sourceRecordSessionId,importId:record.importId,
      activePointerSha256:activePointerRef.sha256,importRecordSha256:importRecordRef.sha256,
      rawSha256:record.rawSha256,normalizedSha256:record.normalizedSha256,coverageSha256:pointer.coverageSha256 as string,
      transactionId:pointer.transactionId as string,normalizer,bookPointer,bookSha256,
      entryPointer:`${bookPointer}/entries/${pointerPart(key)}`,entryOrdinal,entrySha256:recordSha256(raw)}}
  })
  const versions=cloneData(deps.recordVersionsFor(sessionId),'/current/membership',used)
  if(!isObject(versions)||!isVersion(versions.rules)||!isVersion(versions.settings))fail('MEMBERSHIP_INVALID','/current/membership')
  const cards=versionMap(versions.cards,'/current/cards'),worldbook=versionMap(versions.worldbook,'/current/worldbook')
  const rows=new Map<string,TavernLoreSourceRowDataV1>()
  const read=(table:MvuSourceTable,key:string,expected?:string):TavernLoreSourceRowDataV1=>{
    if(!KEY.test(key)||!key.startsWith(`${sessionId}__`))fail('ROW_INVALID','/current/rows')
    const existing=rows.get(rowId(table,key))
    if(existing) {
      if(expected!==undefined&&existing.ref.sha256!==expected)fail('MEMBERSHIP_INVALID','/current/rows')
      return existing
    }
    if(rows.size>=TAVERN_LORE_SOURCE_BOUNDS_V1.rows)fail('SOURCE_BUDGET','/current/rows',
      {field:'currentRows',maximum:TAVERN_LORE_SOURCE_BOUNDS_V1.rows,observed:rows.size+1})
    const actual=deps.readRow(table,key),value=actual===undefined ? null : cloneData(actual,'/current/rows',used)
    if(actual!==undefined&&!isObject(value))fail('ROW_INVALID','/current/rows')
    if(isObject(value))for(const ownerKey of ['sessionId','ownerSessionId']) {
      if(value[ownerKey]!==undefined&&value[ownerKey]!==sessionId)fail('ROW_INVALID','/current/rows')
    }
    const ref={table,key,exists:actual!==undefined,sha256:actual===undefined ? 'missing' : recordSha256(value)}
    if(expected!==undefined&&ref.sha256!==expected)fail('MEMBERSHIP_INVALID','/current/rows')
    const row={ref,value:value as Readonly<Record<string,unknown>>|null}
    rows.set(rowId(table,key),row);return row
  }
  const branch=read('branch',`${sessionId}__meta`)
  if(!branch.ref.exists||!branch.value)fail('BRANCH_UNAVAILABLE','/current/branch')
  if(branch.value.inheritanceState!==undefined&&branch.value.inheritanceState!=='ready') {
    fail('BRANCH_UNAVAILABLE','/current/branch')
  }
  // Include old activation keys even when now absent, but never require their
  // old whole-row SHA. Complete today's membership remains a separate fact.
  for(const row of activation)read(row.tableName as MvuSourceTable,
    `${sessionId}__${row.key.slice(sourceRecordSessionId.length+2)}`)
  for(const [id,hash] of Object.entries(cards))read('cards',`${sessionId}__${id}`,hash)
  for(const [id,hash] of Object.entries(worldbook))read('worldbook',`${sessionId}__${id}`,hash)
  const rules=read('rules',`${sessionId}__spec`,versions.rules)
  if(!rules.ref.exists||!rules.value)fail('RULES_UNAVAILABLE','/current/rules')
  read('branch',`${sessionId}__settings`,versions.settings)
  read('status',`${sessionId}__spec`);read('opening',`${sessionId}__scene`)
  for(const row of rows.values())if((row.ref.table==='cards'||row.ref.table==='worldbook')&&row.ref.exists) {
    const id=row.ref.key.slice(sessionId.length+2),membership=row.ref.table==='cards' ? cards : worldbook
    if(membership[id]!==row.ref.sha256)fail('MEMBERSHIP_INVALID','/current/membership')
  }
  const openingContext=cloneData(deps.readOpeningContext(sessionId),'/current/openingContext',used)
  if(!isObject(openingContext)||!isObject(openingContext.context)||!isHash(openingContext.bindingSha256)) {
    fail('OPENING_CONTEXT_INVALID','/current/openingContext')
  }
  exactKeys(openingContext.context,['user','char','user_gender'],'OPENING_CONTEXT_INVALID','/current/openingContext/context')
  if(Object.values(openingContext.context).some(value=>typeof value!=='string'||value.length>512)) {
    fail('OPENING_CONTEXT_INVALID','/current/openingContext/context')
  }
  const materialRows=[...rows.values()].sort((left,right)=>{
    const a=rowId(left.ref.table,left.ref.key),b=rowId(right.ref.table,right.ref.key)
    return a<b ? -1 : a>b ? 1 : 0
  })
  const currentWorldbook:LegacyCurrentRowDataV1[]=Object.keys(worldbook).sort().map(id=>{
    const row=rows.get(rowId('worldbook',`${sessionId}__${id}`))!
    return {ref:{...row.ref,table:'worldbook'},value:row.value!}
  })
  const contributionInput:TavernLoreContributionInputV1={sessionId,sourceRecordSessionId,normalizer,rawDecoded,
    activeImport:record,importRecordRef,activePointer:pointer as unknown as ImportPointer,activePointerRef,
    currentRules:{ref:{...rules.ref,table:'rules'},value:rules.value},currentWorldbook,
    currentWorldbookMembershipSha256:recordSha256(Object.fromEntries(currentWorldbook.map(row=>[row.ref.key,row.ref.sha256])))}
  // These are the already captured record, decoder and actual rows. Consumers
  // use them directly; their combined representation is not a new input.
  const membership={cards,worldbook,rules:versions.rules,settings:versions.settings}
  const primary:TavernLoreSourcePrimaryV1=hasBook
    ? {binding:'primary',bookPointer,bookSha256,value:book!,entries:rawEntryData}
    : {binding:'proven-absence',bookPointer,bookSha256,value:null,entries:[],absenceProof:absenceProof!}
  const body:Omit<TavernLoreSourceDataV1,'sourceSha256'>={schemaVersion:1 as const,encoding:'tavern-lore-current-source-data-v1' as const,
    authority:'consumer-data-only' as const,sessionId,sourceRecordSessionId,normalizer,
    ...(inheritance?{inheritance}:{}),
    original:{activePointer:pointer as unknown as ImportPointer,activePointerRef,importRecordRef,
      rawSha256:record.rawSha256,normalizedSha256:record.normalizedSha256,coverageSha256:pointer.coverageSha256 as string,
      transactionId:pointer.transactionId as string,decodedFormat:decoded.format as TavernLoreSourceDataV1['original']['decodedFormat'],
      documentSha256:recordSha256(decoded.document),dataSha256:recordSha256(decoded.data),documentDataRootPointer,
      primary},
    current:{rows:materialRows,materialSha256:recordSha256(materialRows),...membership,membershipSha256:recordSha256(membership),
      openingContext:{context:openingContext.context,bindingSha256:openingContext.bindingSha256,
        valuesSha256:recordSha256(openingContext.context)}}}
  const source={...body,sourceSha256:recordSha256(body)}
  // Source already owns the complete admission above. Publish the same currency
  // identity for consumers without cloning or validating this DATA again.
  const currentIdentitySha256=recordSha256(sourceCurrentIdentity(body))
  return freeze({schemaVersion:1 as const,kind:'captured-data' as const,source,currentIdentitySha256,contributionInput})
}

export function createRoleplayTavernLoreSourceV1(deps:TavernLoreSourceDepsV1) {
  function capture(sessionId:string):TavernLoreSourceCaptureV1 {
    try {return captured(deps,sessionId)}catch(error) {
      if(error instanceof OutsideSource)return freeze({schemaVersion:1 as const,kind:'outside-declared-domain' as const,
        code:error.code,pointer:error.pointer,missingEvidence:[...error.missingEvidence],authority:'none' as const})
      return freeze({schemaVersion:1 as const,kind:'refused' as const,diagnostics:[error instanceof SourceFailure
        ? error.diagnostic : {code:'SOURCE_READ_FAILED' as const,pointer:'/source'}],authority:'none' as const})
    }
  }
  function current(input:TavernLoreSourceDataV1):boolean {
    try {
      // Callers pass captured Source or an actual parsed inheritance record.
      // Its assembled representation is not another raw input budget.
      const saved=input
      if(!isObject(saved)||saved.schemaVersion!==1||saved.encoding!=='tavern-lore-current-source-data-v1'
        ||saved.authority!=='consumer-data-only'||!isHash(saved.sourceSha256))return false
      const {sourceSha256,...body}=saved
      if(recordSha256(body)!==sourceSha256)return false
      // Rebuild from every actual table/reader, immutable decoder proof,
      // membership and binding. No cached digest or legacy-to-legacy exemption.
      const actual=captured(deps,saved.sessionId)
      return recordSha256(sourceCurrentIdentity(body))===actual.currentIdentitySha256
    }catch {return false}
  }
  function captureCurrent(sessionId:string) {
    const result=capture(sessionId)
    if(result.kind!=='captured-data')return {captured:result,assertCurrent:()=>{fail('DATA_INVALID','/source')}}
    const saved=result.source
    // Frozen ancestry owns more than root static inputs. Its existing full
    // reader remains the currency supplier until that footprint is reviewed.
    if(saved.inheritance||saved.sourceRecordSessionId!==sessionId) {
      return {captured:result,assertCurrent:()=>{if(!current(saved))fail('DATA_INVALID','/source')}}
    }
    const rows=saved.current.rows.map(row=>tavernLoreSourceCurrentRowIdentityV1(sessionId,row)),
      expectedContext={context:saved.current.openingContext.context,
        bindingSha256:saved.current.openingContext.bindingSha256},
      expectedCardsSha256=recordSha256(saved.current.cards),expectedWorldbookSha256=recordSha256(saved.current.worldbook),
      expectedContextSha256=recordSha256(expectedContext)
    const assertCurrent=()=>{
      const pointer=deps.readActivePointer(sessionId),record=deps.readImportRecord(saved.sourceRecordSessionId,
        saved.original.activePointer.importId)
      if(recordSha256(pointer)!==saved.original.activePointerRef.sha256
        ||recordSha256(deps.readRow('branch',saved.original.activePointerRef.key))!==saved.original.activePointerRef.sha256
        ||recordSha256(record)!==saved.original.importRecordRef.sha256
        ||recordSha256(deps.readRow('branch',saved.original.importRecordRef.key))!==saved.original.importRecordRef.sha256) {
        fail('IMPORT_RECORD_REF_CHANGED','/source/current')
      }
      const versions=deps.recordVersionsFor(sessionId)
      if(recordSha256(versionMap(versions.cards,'/current/cards'))!==expectedCardsSha256
        ||recordSha256(versionMap(versions.worldbook,'/current/worldbook'))!==expectedWorldbookSha256
        ||versions.rules!==saved.current.rules||versions.settings!==saved.current.settings
        ||recordSha256(deps.readOpeningContext(sessionId))!==expectedContextSha256)fail('MEMBERSHIP_INVALID','/source/current')
      for(const row of rows) {
        const actual=deps.readRow(row.ref.table,row.ref.key)
        if(row.ref.exists!==(actual!==undefined))fail('ROW_INVALID','/source/current')
        if(actual===undefined)continue
        let value=cloneData(actual,'/source/current/row')
        if(row.ref.table==='branch'&&row.ref.key===`${sessionId}__meta`&&isObject(value)) {
          // The canonical projection already hashed this actual meta row.
          // Reuse that digest, while every current table value is read afresh.
          const current=tavernLoreSourceCurrentRowIdentityV1(sessionId,{ref:row.ref,value})
          if(current.ref.sha256!==row.ref.sha256)fail('ROW_INVALID','/source/current')
          continue
        }
        if(recordSha256(value)!==row.ref.sha256)fail('ROW_INVALID','/source/current')
      }
    }
    assertCurrent()
    // The closure has the producer's frozen proof and exact input footprint.
    // It re-reads whole rows across every await; a serialized SHA cannot obtain it.
    return {captured:result,assertCurrent}
  }
  return {capture,current,captureCurrent}
}

const SOURCE_COUNTER_FIELDS_V1=['lastTurn','lastSeq','surfaceTokens'] as const
function sourceMetadataRow(sessionId:string,row:TavernLoreSourceRowDataV1):boolean {
  return row.ref.table==='branch'&&row.ref.key===`${sessionId}__meta`&&row.value!==null
}
/** Capture the actual rows handled by this owner's currency projection.
 * Missing counter properties stay missing; no request/session default invents them. */
export function captureTavernLoreSourceCounterWitnessV1(source:TavernLoreSourceDataV1):TavernLoreSourceCounterWitnessV1 {
  const rows=source.current.rows.filter(row=>sourceMetadataRow(source.sessionId,row)).map(row=>({
    table:'branch' as const,key:row.ref.key,
    counters:Object.fromEntries(SOURCE_COUNTER_FIELDS_V1.filter(key=>Object.hasOwn(row.value!,key))
      .map(key=>[key,row.value![key]])),
  }))
  return freeze({schemaVersion:1,encoding:'tavern-lore-source-counter-witness-v1',rows})
}
/** The journal has already admitted bounded JSON. Source owns this persisted
 * witness's shape and the precise metadata fields it may reconstruct. */
export function parseTavernLoreSourceCounterWitnessV1(raw:unknown):TavernLoreSourceCounterWitnessV1 {
  const pointer='/source/counterWitness'
  if(!isObject(raw)||raw.schemaVersion!==1||raw.encoding!=='tavern-lore-source-counter-witness-v1'
    ||!Array.isArray(raw.rows))fail('DATA_INVALID',pointer)
  exactKeys(raw,['schemaVersion','encoding','rows'],'DATA_INVALID',pointer)
  for(const row of raw.rows) {
    if(!isObject(row)||row.table!=='branch'||typeof row.key!=='string'||!isObject(row.counters)) {
      fail('DATA_INVALID',pointer)
    }
    exactKeys(row,['table','key','counters'],'DATA_INVALID',pointer)
    exactKeys(row.counters,SOURCE_COUNTER_FIELDS_V1,'DATA_INVALID',pointer)
  }
  return freeze(raw as unknown as TavernLoreSourceCounterWitnessV1)
}
/** Reconstruct only the actual projected rows, then prove the complete original
 * audit SHA. Every other fresh Source field/ref remains in that comparison. */
export function restoreTavernLoreSourceCounterWitnessV1(source:TavernLoreSourceDataV1,
  witness:TavernLoreSourceCounterWitnessV1,expectedSourceSha256:string):TavernLoreSourceDataV1|null {
  const watched=source.current.rows.filter(row=>sourceMetadataRow(source.sessionId,row))
  if(witness.rows.length!==watched.length)return null
  const counters=new Map(witness.rows.map(row=>[`${row.table}:${row.key}`,row.counters]))
  if(watched.some(row=>!counters.has(`${row.ref.table}:${row.ref.key}`)))return null
  const rows=source.current.rows.map(row=>{
    if(!sourceMetadataRow(source.sessionId,row))return row
    const value={...roleplaySourceMetadataValue(row.value!),
      ...counters.get(`${row.ref.table}:${row.ref.key}`)!}
    return {ref:{...row.ref,sha256:recordSha256(value)},value}
  })
  const {sourceSha256,...body}=source,current={...body.current,rows,materialSha256:recordSha256(rows)},
    restored={...body,current},actualSha256=recordSha256(restored)
  if(actualSha256!==expectedSourceSha256)return null
  return freeze({...restored,sourceSha256:actualSha256})
}


/** One deterministic currency projection. Frozen Source/audit bytes retain
 * the full original meta and sourceSha; only these three normal Native
 * counters do not invalidate an otherwise unchanged current Source. */
export function tavernLoreSourceCurrentIdentityV1(input:TavernLoreSourceDataV1) {
  const {sourceSha256,...body}=input
  if(recordSha256(body)!==sourceSha256)fail('DATA_INVALID','/source/currentIdentity')
  return freeze(sourceCurrentIdentity(body))
}
function sourceCurrentIdentity(body:Omit<TavernLoreSourceDataV1,'sourceSha256'>) {
  const rows=body.current.rows.map(row=>tavernLoreSourceCurrentRowIdentityV1(body.sessionId,row))
  return {...body,current:{...body.current,rows,materialSha256:recordSha256(rows)}}
}
/** The same complete-row projection is used by Source currency and the actual
 * fresh-basis metadata reader. It grants no row provenance or Source lease. */
export function tavernLoreSourceCurrentRowIdentityV1(sessionId:string,row:TavernLoreSourceRowDataV1):TavernLoreSourceRowDataV1 {
  if(row.ref.table!=='branch'||row.ref.key!==`${sessionId}__meta`||!row.value)return row
  const value=roleplaySourceMetadataValue(row.value)
  return {ref:{...row.ref,sha256:recordSha256(value)},value}
}
