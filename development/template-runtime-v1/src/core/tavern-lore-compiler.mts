/** Compile one original character_book into provenance-preserving data.
 * This does not scan messages, evaluate templates, run regexes, draw random
 * numbers, activate entries, construct a prompt, or write persistent state. */
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneSchemaData} from './tavern-mvu-schema-data.js'
import {CARD_LIMITS,decodeTavernCard} from './tavern-card.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {validateTavernSourceInheritanceDescriptorV1} from './roleplay-tavern-source-inheritance-data.js'
import {ST_LORE_COMMIT,ST_LORE_ENTRY_DEFAULTS_V1,ST_LORE_LOGIC_V1,ST_LORE_POSITION_V1,
  ST_LORE_ROLE_V1,ST_LORE_PROFILE_SHA256} from './tavern-lore-fixed-profile.mjs'
import type {TavernLoreCompilationInputV1,TavernLoreCompilationV1,TavernLoreDiagnosticV1,TavernLoreEntryPlanV1,
  TavernLoreFieldSourceV1,TavernLoreMetadataReferenceV1,TavernLoreSemanticEntryV1,
  TavernLoreSemanticFieldV1,TavernLoreRetainedDeclarationsV1,TavernLorePlanV1,
  TavernLoreCurrentNativeOriginV1,TavernLoreAbsentSourceReferenceV1,
  TavernLoreBookAbsenceProofV1} from './tavern-lore-plan-types.mjs'

const OUTPUT_BYTES=16_777_216 // Existing cloneSchemaData absolute envelope ceiling.
const inputBounds={nodes:CARD_LIMITS.nodes,depth:CARD_LIMITS.depth}
const outputBounds={nodes:MVU_SCHEMA_BOUNDS.evaluationNodes,depth:MVU_SCHEMA_BOUNDS.evaluationDepth}
const has=(record:object,key:string)=>Object.hasOwn(record,key)
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const token=(key:string)=>key.replace(/~/g,'~0').replace(/\//g,'~1')
const append=(pointer:string,key:string)=>`${pointer}/${token(key)}`
const typeOf=(value:unknown)=>value===null?'null':Array.isArray(value)?'array':typeof value
class LoreRefusal extends Error {
  constructor(readonly code:string,readonly pointer='/',readonly limit:TavernLoreDiagnosticV1['limit']=null) {
    super(code)
  }
}
function fail(code:string,pointer='/',limit:TavernLoreDiagnosticV1['limit']=null):never {
  throw new LoreRefusal(code,pointer,limit)
}
function pointer(value:unknown):value is string {
  return typeof value==='string'&&value.startsWith('/')&&Buffer.byteLength(value,'utf8')<=4096
    &&!/[\x00-\x1f]/.test(value)&&!/~(?:[^01]|$)/.test(value)
}
function exact(value:Record<string,unknown>,keys:readonly string[],at:string):void {
  if(Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key))) {
    fail('LORE_INPUT_SHAPE_INVALID',at)
  }
}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object') {
    for(const child of Object.values(value))freeze(child)
    Object.freeze(value)
  }
  return value
}
/** Reserve individual output components before appending them. The final
 * clone also checks the exact complete envelope. A limit refuses the entire
 * compilation; no entry, archive or diagnostic list is silently truncated. */
class OutputBudget {
  bytes=0
  nodes=0
  add(value:unknown,at:string):void {
    this.bytes+=Buffer.byteLength(JSON.stringify(value),'utf8')+1
    const visit=(item:unknown)=>{
      this.nodes++
      if(this.nodes>outputBounds.nodes)fail('LORE_OUTPUT_LIMIT',at,
        {field:'output-node-reservation',observed:this.nodes,maximum:outputBounds.nodes})
      if(item&&typeof item==='object')for(const child of Object.values(item))visit(child)
    }
    if(this.bytes>OUTPUT_BYTES)fail('LORE_OUTPUT_LIMIT',at,
      {field:'output-byte-reservation',observed:this.bytes,maximum:OUTPUT_BYTES})
    visit(value)
  }
}
function validateInput(raw:unknown):TavernLoreCompilationInputV1 {
  // The envelope contains the immutable book plus explicitly edited text and
  // provenance. Keep the book's original adapter ceiling, without counting a
  // legitimate current overlay as a second raw source inside that same cap.
  const value=cloneSchemaData(raw,OUTPUT_BYTES,outputBounds)
  if(!object(value))fail('LORE_INPUT_SHAPE_INVALID')
  exact(value,['schemaVersion','encoding','source','book',
    ...(has(value,'currentNativeOverlay')?['currentNativeOverlay']:[])],'/')
  if(value.schemaVersion!==1||value.encoding!=='st-character-book-compilation-input-v1'
    ||value.book!==null&&!object(value.book)) {
    fail('LORE_INPUT_SHAPE_INVALID')
  }
  cloneSchemaData(value.book,CARD_LIMITS.jsonBytes,inputBounds)
  const source=value.source
  if(!object(source))fail('LORE_SOURCE_REFERENCE_INVALID','/source')
  exact(source,['schemaVersion','encoding','ownerSessionId','sourceRecordSessionId','importId','rawSourceSha256',
    'importRecordSha256','sourceSnapshotSha256','documentSha256','bookPointer','bookValueSha256','sourceFormat',
    ...(has(source,'bookPresence')?['bookPresence','absenceProof']:[]),
    ...(has(source,'inheritance')?['inheritance']:[])],'/source')
  if(source.schemaVersion!==1||source.encoding!=='st-character-book-source-reference-v1'
    ||typeof source.sourceFormat!=='string'||!['ccv2-character-book','ccv3-character-book'].includes(source.sourceFormat)
    ||!pointer(source.bookPointer))fail('LORE_SOURCE_REFERENCE_INVALID','/source')
  for(const key of ['ownerSessionId','sourceRecordSessionId','importId']) {
    const identifier=source[key]
    if(typeof identifier!=='string'||!identifier.length||Buffer.byteLength(identifier,'utf8')>256) {
      fail('LORE_SOURCE_REFERENCE_INVALID',`/source/${key}`)
    }
  }
  for(const key of ['rawSourceSha256','importRecordSha256','sourceSnapshotSha256','documentSha256','bookValueSha256']) {
    if(!hash(source[key]))fail('LORE_SOURCE_REFERENCE_INVALID',`/source/${key}`)
  }
  if(has(source,'inheritance')) {
    let inherited:ReturnType<typeof validateTavernSourceInheritanceDescriptorV1>
    try {inherited=validateTavernSourceInheritanceDescriptorV1(source.inheritance)}
    catch {fail('LORE_SOURCE_INHERITANCE_INVALID','/source/inheritance')}
    const original=inherited.originalBinding
    if(source.ownerSessionId!==inherited.childSessionId||source.sourceRecordSessionId!==original.sourceRecordSessionId
      ||source.importId!==original.importId||source.rawSourceSha256!==original.rawSha256
      ||source.importRecordSha256!==original.importRecordRef.sha256||source.documentSha256!==original.documentSha256)
      fail('LORE_SOURCE_INHERITANCE_INVALID','/source/inheritance')
  }
  if(source.bookValueSha256!==recordSha256(value.book))fail('LORE_SOURCE_VALUE_MISMATCH',source.bookPointer)
  if(value.book===null) {
    if(source.bookPresence!=='proven-absence')fail('LORE_BOOK_ABSENCE_PROOF_REQUIRED',source.bookPointer)
    validateBookAbsence(source.absenceProof,source)
    if(has(value,'currentNativeOverlay')) {
      const overlay=value.currentNativeOverlay
      if(!object(overlay))fail('LORE_ABSENCE_OVERLAY_INVALID','/currentNativeOverlay')
      exact(overlay,['schemaVersion','encoding','entries'],'/currentNativeOverlay')
      if(overlay.schemaVersion!==1||overlay.encoding!=='st-character-book-current-native-overlay-v1'
        ||!Array.isArray(overlay.entries)||overlay.entries.length!==0) {
        fail('LORE_ABSENCE_OVERLAY_INVALID','/currentNativeOverlay')
      }
    }
  }else {
    if(has(source,'bookPresence')||has(source,'absenceProof'))fail('LORE_BOOK_PRESENCE_CONTRADICTION',source.bookPointer)
    if(has(value,'currentNativeOverlay'))validateOverlay(value.currentNativeOverlay,value.book,source.bookPointer)
  }
  return value as unknown as TavernLoreCompilationInputV1
}

/** Pure consistency validation. The live Source owner still proves the actual
 * archive/record/current tables; these hashes never confer that authority. */
function validateBookAbsence(raw:unknown,source:Record<string,unknown>):void {
  const at='/source/absenceProof'
  if(!object(raw))fail('LORE_BOOK_ABSENCE_PROOF_REQUIRED',at)
  exact(raw,['schemaVersion','encoding','authority','ownerSessionId','sourceRecordSessionId','importId',
    'documentDataRootPointer','bookPointer','decodedFormat','document','documentSha256','dataSha256',
    'rawSha256','normalizedSha256','coverageSha256','transactionId','activatedAt','activePointer',
    'activePointerRef','importRecordRef','activation','absenceProofSha256'],at)
  const {absenceProofSha256,...body}=raw
  const inherited=has(source,'inheritance')
    ?validateTavernSourceInheritanceDescriptorV1(source.inheritance):undefined,
    originalOwner=inherited?.originalBinding.sourceRecordSessionId??source.ownerSessionId
  if(raw.schemaVersion!==1||raw.encoding!=='st-character-book-proven-absence-data-v1'
    ||raw.authority!=='consumer-data-only'||!hash(absenceProofSha256)
    ||recordSha256(body)!==absenceProofSha256||raw.documentDataRootPointer!=='/data'
    ||raw.bookPointer!=='/data/character_book'||source.bookPointer!==raw.bookPointer
    ||raw.ownerSessionId!==originalOwner||raw.sourceRecordSessionId!==source.sourceRecordSessionId
    ||raw.ownerSessionId!==raw.sourceRecordSessionId||raw.importId!==source.importId
    ||raw.rawSha256!==source.rawSourceSha256||raw.documentSha256!==source.documentSha256
    ||!['json-v2','json-v3','png-v2','png-v3'].includes(String(raw.decodedFormat))) {
    fail('LORE_BOOK_ABSENCE_PROOF_INVALID',at)
  }
  for(const key of ['rawSha256','normalizedSha256','coverageSha256','documentSha256','dataSha256']) {
    if(!hash(raw[key]))fail('LORE_BOOK_ABSENCE_PROOF_INVALID',`${at}/${key}`)
  }
  if(!object(raw.document)||recordSha256(raw.document)!==raw.documentSha256) {
    fail('LORE_BOOK_ABSENCE_DOCUMENT_CHANGED',`${at}/document`)
  }
  // Reencoding validates the complete document through the maintained decoder.
  // Its new byte hash is deliberately not claimed as the original JSON/PNG hash.
  let decoded:ReturnType<typeof decodeTavernCard>
  try {decoded=decodeTavernCard(Buffer.from(JSON.stringify(raw.document),'utf8'),'.json')}
  catch {fail('LORE_BOOK_ABSENCE_DOCUMENT_INVALID',`${at}/document`)}
  if(decoded.document.data!==decoded.data||Object.hasOwn(decoded.data,'character_book')
    ||recordSha256(decoded.data)!==raw.dataSha256
    ||String(raw.decodedFormat).endsWith('v3')!==decoded.format.endsWith('v3')
    ||source.sourceFormat!==(decoded.format.endsWith('v3')?'ccv3-character-book':'ccv2-character-book')) {
    fail('LORE_BOOK_ABSENCE_CONTRADICTED',`${at}/document/data/character_book`)
  }
  const active=raw.activePointer,activeRef=raw.activePointerRef,recordRef=raw.importRecordRef,activation=raw.activation
  if(!object(active)||!object(activeRef)||!object(recordRef)||!object(activation)) {
    fail('LORE_BOOK_ABSENCE_ACTIVATION_INVALID',at)
  }
  exact(activeRef,['table','key','exists','sha256'],`${at}/activePointerRef`)
  exact(recordRef,['table','key','exists','sha256'],`${at}/importRecordRef`)
  if(inherited) {
    const original=inherited.originalBinding
    if(source.ownerSessionId!==inherited.childSessionId||original.importId!==raw.importId
      ||original.rawSha256!==raw.rawSha256||original.normalizedSha256!==raw.normalizedSha256
      ||original.coverageSha256!==raw.coverageSha256||original.transactionId!==raw.transactionId
      ||original.documentSha256!==raw.documentSha256||original.dataSha256!==raw.dataSha256
      ||recordSha256(original.originalPointer)!==recordSha256(active)
      ||recordSha256(original.originalPointerRef)!==recordSha256(activeRef)
      ||original.importRecordRef.key!==recordRef.key||original.importRecordRef.sha256!==recordRef.sha256
      ||original.activationSha256!==recordSha256(activation))
      fail('LORE_SOURCE_INHERITANCE_INVALID','/source/inheritance')
  }
  if(activeRef.table!=='branch'||activeRef.key!==`${raw.ownerSessionId}__import-active`
    ||activeRef.exists!==true||!hash(activeRef.sha256)||activeRef.sha256!==recordSha256(active)
    ||recordRef.table!=='branch'||recordRef.key!==`${raw.sourceRecordSessionId}__import-${raw.importId}`
    ||recordRef.exists!==true||recordRef.sha256!==source.importRecordSha256
    ||active.importId!==raw.importId||(active.sourceRecordSessionId??raw.ownerSessionId)!==raw.sourceRecordSessionId
    ||has(active,'inheritedFrom')||active.normalizedSha256!==raw.normalizedSha256
    ||active.coverageSha256!==raw.coverageSha256||active.transactionId!==raw.transactionId
    ||typeof raw.transactionId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(raw.transactionId)
    ||activation.transactionId!==raw.transactionId||(active.activatedAt??null)!==raw.activatedAt
    ||raw.activatedAt!==null&&(typeof raw.activatedAt!=='number'||!Number.isSafeInteger(raw.activatedAt)||raw.activatedAt<0)) {
    fail('LORE_BOOK_ABSENCE_ACTIVATION_INVALID',at)
  }
  if(!Array.isArray(activation.writeDigests)||!activation.writeDigests.length||activation.writeDigests.length>4096) {
    fail('LORE_BOOK_ABSENCE_ACTIVATION_INVALID',`${at}/activation/writeDigests`)
  }
  const seen=new Set<string>()
  let rules=0
  for(const row of activation.writeDigests) {
    if(!object(row)||!['branch','cards','worldbook','rules','status','opening'].includes(String(row.tableName))
      ||typeof row.key!=='string'||!/^[a-zA-Z0-9_-]{1,256}$/.test(row.key)
      ||!row.key.startsWith(`${raw.ownerSessionId}__`)||row.sha256!=='missing'&&!hash(row.sha256)
      ||seen.has(`${row.tableName}:${row.key}`)
      ||row.tableName==='branch'&&row.key!==`${raw.ownerSessionId}__settings`
      ||row.tableName==='rules'&&row.key!==`${raw.ownerSessionId}__spec`
      ||row.tableName==='status'&&![`${raw.ownerSessionId}__spec`,`${raw.ownerSessionId}__panel`].includes(row.key)
      ||row.tableName==='opening'&&row.key!==`${raw.ownerSessionId}__scene`) {
      fail('LORE_BOOK_ABSENCE_ACTIVATION_INVALID',`${at}/activation/writeDigests`)
    }
    seen.add(`${row.tableName}:${row.key}`)
    if(row.tableName==='rules'&&hash(row.sha256))rules++
  }
  if(rules!==1)fail('LORE_BOOK_ABSENCE_ACTIVATION_INVALID',`${at}/activation/writeDigests`)
}

type FieldKind='boolean'|'nullable-boolean'|'number'|'nullable-number'|'string'|'strings'
  |'logic'|'role'|'recursion-delay'
interface FieldDefinition {field:TavernLoreSemanticFieldV1;raw:string;kind:FieldKind;extension?:boolean;required?:boolean}
const fields:readonly FieldDefinition[]=[
  {field:'primaryKeys',raw:'keys',kind:'strings',required:true},
  {field:'secondaryKeys',raw:'secondary_keys',kind:'strings'},
  {field:'enabled',raw:'enabled',kind:'boolean'},{field:'constant',raw:'constant',kind:'boolean'},
  {field:'selective',raw:'selective',kind:'boolean'},{field:'order',raw:'insertion_order',kind:'number',required:true},
  ...[
    ['excludeRecursion','exclude_recursion','boolean'],['preventRecursion','prevent_recursion','boolean'],
    ['delayUntilRecursion','delay_until_recursion','recursion-delay'],['displayIndex','display_index','number'],
    ['probability','probability','number'],['useProbability','useProbability','boolean'],['depth','depth','number'],
    ['selectiveLogic','selectiveLogic','logic'],['outletName','outlet_name','string'],['group','group','string'],
    ['groupOverride','group_override','boolean'],['groupWeight','group_weight','number'],
    ['scanDepth','scan_depth','nullable-number'],['caseSensitive','case_sensitive','nullable-boolean'],
    ['matchWholeWords','match_whole_words','nullable-boolean'],['useGroupScoring','use_group_scoring','nullable-boolean'],
    ['automationId','automation_id','string'],['role','role','role'],['vectorized','vectorized','boolean'],
    ['sticky','sticky','nullable-number'],['cooldown','cooldown','nullable-number'],['delay','delay','nullable-number'],
    ['matchPersonaDescription','match_persona_description','boolean'],
    ['matchCharacterDescription','match_character_description','boolean'],
    ['matchCharacterPersonality','match_character_personality','boolean'],
    ['matchCharacterDepthPrompt','match_character_depth_prompt','boolean'],['matchScenario','match_scenario','boolean'],
    ['matchCreatorNotes','match_creator_notes','boolean'],['triggers','triggers','strings'],['ignoreBudget','ignore_budget','boolean'],
  ].map(([field,raw,kind])=>({field:field as TavernLoreSemanticFieldV1,raw:raw!,kind:kind as FieldKind,extension:true})),
]
const topKnown=new Set(['content','id','name','comment','position','extensions',
  ...fields.filter(field=>!field.extension).map(field=>field.raw)])
const extensionKnown=new Set(['position',...fields.filter(field=>field.extension).map(field=>field.raw)])
const legacyControls=new Set(['key','keysecondary','disable','order','case_sensitive','use_regex','selectiveLogic',
  'match_whole_words','token_budget','priority','role','depth'])
const legacyBindings:readonly {raw:string;field:keyof TavernLoreRetainedDeclarationsV1;kind:FieldKind|'role-token'}[]=[
  {raw:'key',field:'primaryKeys',kind:'strings'},{raw:'keysecondary',field:'secondaryKeys',kind:'strings'},
  {raw:'disable',field:'disabled',kind:'boolean'},{raw:'order',field:'order',kind:'number'},
  {raw:'priority',field:'priority',kind:'number'},{raw:'case_sensitive',field:'caseSensitive',kind:'boolean'},
  {raw:'use_regex',field:'useRegex',kind:'boolean'},{raw:'selectiveLogic',field:'selectiveLogic',kind:'number'},
  {raw:'match_whole_words',field:'matchWholeWords',kind:'boolean'},{raw:'token_budget',field:'tokenBudget',kind:'number'},
  {raw:'role',field:'role',kind:'role-token'},{raw:'depth',field:'depth',kind:'number'},
]
const bookKnown=new Set(['entries','name','description','scan_depth','token_budget','recursive_scanning','extensions'])
const nonnegative=new Set(['displayIndex','depth','groupWeight','scanDepth','sticky','cooldown','delay'])
const integerFields=new Set(['displayIndex','depth','scanDepth','sticky','cooldown','delay'])
export const TAVERN_LORE_COMPILER_PROFILE_SHA256=recordSha256({schemaVersion:1,
  encoding:'owned-st-character-book-consumer-profile-v1',fixedImportProfileSha256:ST_LORE_PROFILE_SHA256,
  fields,legacyBindings,unknownPolicy:'retain-complete-source-and-make-unknown-control-data-ineligible',
  defaultsPolicy:'fixed-convertCharacterBook-not-editor-template-not-player-globals',
  bounds:{inputEnvelopeBytes:OUTPUT_BYTES,inputEnvelopeBounds:outputBounds,
    originalBookBytes:CARD_LIMITS.jsonBytes,originalBookBounds:inputBounds,
    outputBytes:OUTPUT_BYTES,outputBounds,entries:CARD_LIMITS.entries}})
/** Keep the historical present-book profile bytes unchanged. The new absence
 * branch pins its own additional consistency policy. */
export const TAVERN_LORE_ABSENT_BOOK_PROFILE_SHA256=recordSha256({schemaVersion:1,
  encoding:'owned-st-character-book-proven-absence-profile-v1',
  presentBookProfileSha256:TAVERN_LORE_COMPILER_PROFILE_SHA256,
  absence:'complete-verified-document-own-field-absence-with-actual-import-and-activation-refs',
  plan:'program-owned-empty-plan-with-null-original-book',overlay:'explicit-empty-only',
  sourceAuthority:'live-owner-verifies-actual-source-no-consumer-capability'})
function fieldValue(definition:FieldDefinition,value:unknown):unknown {
  const {kind,field}=definition
  if(kind==='boolean'||kind==='nullable-boolean')return typeof value==='boolean'?value:undefined
  if(kind==='string')return typeof value==='string'?value:undefined
  if(kind==='strings')return Array.isArray(value)&&value.length<=256
    &&value.every(key=>typeof key==='string'&&key.length<=4096)?value:undefined
  if(kind==='logic')return typeof value==='number'&&Number.isInteger(value)?ST_LORE_LOGIC_V1[value]:undefined
  if(kind==='role')return typeof value==='number'&&Number.isInteger(value)?ST_LORE_ROLE_V1[value]:undefined
  if(kind==='recursion-delay')return typeof value==='boolean'||typeof value==='number'
    &&Number.isSafeInteger(value)&&value>=0?value:undefined
  if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER
    ||nonnegative.has(field)&&value<0||integerFields.has(field)&&!Number.isSafeInteger(value)
    ||field==='probability'&&(value<0||value>100)||field==='order'&&Math.abs(value)>1_000_000)return undefined
  return value
}
export const TAVERN_LORE_CURRENT_NATIVE_OVERLAY_POLICY_V1=freeze({schemaVersion:1,
  encoding:'st-character-book-current-native-overlay-policy-v1',
  semantics:'explicit-canonical-fields-only-original-entry-address-and-hashes-retained',
  origin:'consumer-data-only-live-owner-verifies-concrete-row-or-append-only-ref',
  bounds:{entries:CARD_LIMITS.entries,originBytes:65_536,originNodes:4096,originDepth:16,
    fieldStringBytes:4096,contentBytes:CARD_LIMITS.jsonBytes},
  fields:[...fields.map(row=>row.field),'content','position','keyMatcher'],
  positions:ST_LORE_POSITION_V1,roles:ST_LORE_ROLE_V1,logic:ST_LORE_LOGIC_V1})
export const TAVERN_LORE_CURRENT_NATIVE_OVERLAY_PROFILE_SHA256=
  recordSha256(TAVERN_LORE_CURRENT_NATIVE_OVERLAY_POLICY_V1)
function overlayFieldValue(field:string,value:unknown,at:string):void {
  const bounds=TAVERN_LORE_CURRENT_NATIVE_OVERLAY_POLICY_V1.bounds
  if(field==='content') {
    if(typeof value!=='string')fail('LORE_OVERLAY_FIELD_INVALID',at)
    const bytes=Buffer.byteLength(value,'utf8')
    if(bytes>bounds.contentBytes)fail('LORE_OVERLAY_CONTENT_LIMIT',at,
      {field:'contentBytes',observed:bytes,maximum:bounds.contentBytes})
    return
  }
  const enums=field==='position'?ST_LORE_POSITION_V1:field==='role'?ST_LORE_ROLE_V1
    :field==='selectiveLogic'?ST_LORE_LOGIC_V1:null
  if(enums) {
    if(typeof value!=='string'||!Object.values(enums).some(candidate=>candidate===value))fail('LORE_OVERLAY_FIELD_INVALID',at)
    return
  }
  if(field==='keyMatcher') {
    if(value!=='st-slash-regex-or-literal-v1')fail('LORE_OVERLAY_FIELD_INVALID',at)
    return
  }
  const definition=fields.find(row=>row.field===field)
  if(!definition)fail('LORE_OVERLAY_FIELD_UNKNOWN',at)
  if(value===null&&(definition.kind==='nullable-number'||definition.kind==='nullable-boolean'))return
  if(fieldValue(definition,value)===undefined)fail('LORE_OVERLAY_FIELD_INVALID',at)
  const texts=typeof value==='string'?[value]:Array.isArray(value)?value:[]
  for(const text of texts)if(typeof text==='string'&&Buffer.byteLength(text,'utf8')>bounds.fieldStringBytes) {
    fail('LORE_OVERLAY_FIELD_LIMIT',at,
      {field:'fieldStringBytes',observed:Buffer.byteLength(text,'utf8'),maximum:bounds.fieldStringBytes})
  }
}
function originalValueAt(book:Record<string,unknown>,bookPointer:string,at:string):unknown {
  if(!pointer(at)||!at.startsWith(`${bookPointer}/`))fail('LORE_OVERLAY_ENTRY_LINK_INVALID',at)
  let value:unknown=book
  for(const raw of at.slice(bookPointer.length+1).split('/')) {
    const key=raw.replaceAll('~1','/').replaceAll('~0','~')
    if(!value||typeof value!=='object'||!has(value,key))fail('LORE_OVERLAY_ENTRY_LINK_INVALID',at)
    value=(value as Record<string,unknown>)[key]
  }
  return value
}
function validateOverlay(raw:unknown,book:Record<string,unknown>,bookPointer:string):void {
  const at='/currentNativeOverlay',bounds=TAVERN_LORE_CURRENT_NATIVE_OVERLAY_POLICY_V1.bounds
  if(!object(raw))fail('LORE_OVERLAY_INVALID',at)
  exact(raw,['schemaVersion','encoding','entries'],at)
  if(raw.schemaVersion!==1||raw.encoding!=='st-character-book-current-native-overlay-v1'
    ||!Array.isArray(raw.entries))fail('LORE_OVERLAY_INVALID',at)
  if(raw.entries.length>bounds.entries)fail('LORE_OVERLAY_ENTRY_LIMIT',at,
    {field:'entries',observed:raw.entries.length,maximum:bounds.entries})
  const original=book.entries
  if(!Array.isArray(original)&&!object(original))fail('LORE_OVERLAY_ENTRY_LINK_INVALID',at)
  const addresses=new Set(Object.keys(original).map(key=>append(append(bookPointer,'entries'),key)))
  const seen=new Set<string>()
  for(const [index,row] of raw.entries.entries()) {
    const where=`${at}/entries/${index}`
    if(!object(row))fail('LORE_OVERLAY_INVALID',where)
    exact(row,['rawEntryPointer','rawEntrySha256','origin','fields'],where)
    if(!pointer(row.rawEntryPointer)||!addresses.has(row.rawEntryPointer)||!hash(row.rawEntrySha256)) {
      fail('LORE_OVERLAY_ENTRY_LINK_INVALID',where)
    }
    if(seen.has(row.rawEntryPointer))fail('LORE_OVERLAY_DUPLICATE_ENTRY',where)
    seen.add(row.rawEntryPointer)
    const entry=originalValueAt(book,bookPointer,row.rawEntryPointer)
    if(!object(entry)||recordSha256(entry)!==row.rawEntrySha256)fail('LORE_OVERLAY_ENTRY_HASH',where)
    if(!object(row.origin))fail('LORE_OVERLAY_ORIGIN_INVALID',where)
    exact(row.origin,['kind','ref','refSha256'],`${where}/origin`)
    if(typeof row.origin.kind!=='string'||!['current-row','append-only-lore-overlay'].includes(row.origin.kind)
      ||!object(row.origin.ref)||!hash(row.origin.refSha256))fail('LORE_OVERLAY_ORIGIN_INVALID',where)
    const ref=cloneSchemaData(row.origin.ref,bounds.originBytes,{nodes:bounds.originNodes,depth:bounds.originDepth})
    if(recordSha256(ref)!==row.origin.refSha256)fail('LORE_OVERLAY_ORIGIN_HASH',where)
    if(!object(row.fields)||!Object.keys(row.fields).length)fail('LORE_OVERLAY_FIELDS_INVALID',where)
    for(const [field,value] of Object.entries(row.fields))overlayFieldValue(field,value,`${where}/fields/${token(field)}`)
  }
}
function declarationValue(kind:FieldKind|'role-token',value:unknown):unknown {
  if(kind==='role-token')return typeof value==='string'||typeof value==='number'?value:undefined
  if(kind==='boolean')return typeof value==='boolean'?value:undefined
  if(kind==='strings') {
    if(!Array.isArray(value)||value.length>256||!value.every(item=>typeof item==='string'&&item.length<=4096))return undefined
    return value
  }
  return typeof value==='number'&&Number.isFinite(value)?value:undefined
}
type EntryBody=Omit<TavernLoreEntryPlanV1,'entryPlanSha256'>
function compileAbsentBook(input:TavernLoreCompilationInputV1):Extract<TavernLoreCompilationV1,{kind:'compiled'}> {
  const reference=input.source
  if(!('bookPresence' in reference)||reference.bookPresence!=='proven-absence') {
    fail('LORE_BOOK_ABSENCE_PROOF_REQUIRED','/source')
  }
  const source=reference as TavernLoreAbsentSourceReferenceV1
  const proof:TavernLoreBookAbsenceProofV1=source.absenceProof
  const overlay=input.currentNativeOverlay,diagnostics:readonly TavernLoreDiagnosticV1[]=[]
  const body={schemaVersion:1 as const,encoding:'st-character-book-semantic-plan-inputs-v1' as const,
    authority:'consumer-data-only' as const,
    compiler:{id:'owned-st-character-book-compiler' as const,version:1 as const,upstreamCommit:ST_LORE_COMMIT,
      semanticProfileSha256:TAVERN_LORE_ABSENT_BOOK_PROFILE_SHA256,
      ...(overlay?{currentNativeOverlayProfileSha256:TAVERN_LORE_CURRENT_NATIVE_OVERLAY_PROFILE_SHA256}:{})},
    source,sourceReferenceSha256:recordSha256(source),
    bookId:recordSha256({schemaVersion:1,encoding:'st-lore-book-source-address-v1',
      ownerSessionId:source.ownerSessionId,sourceRecordSessionId:source.sourceRecordSessionId,
      importId:source.importId,bookPointer:source.bookPointer}),
    rawBook:null,rawBookSha256:recordSha256(null),
    ownedEmptyPlan:{origin:'program-owned-empty-from-proven-absence' as const,
      absenceProofSha256:proof.absenceProofSha256,bookPointer:proof.bookPointer,rawBookValue:null},
    ...(overlay?{currentNativeOverlay:overlay,currentNativeOverlaySha256:recordSha256(overlay)}:{}),
    bookDisposition:'eligible-semantic-data' as const,collection:{kind:'proven-absent-book' as const,count:0},
    bookMetadata:[],declaredBookSettings:{disposition:'not-applied-by-fixed-importer' as const},
    entries:[],eligibleEntryIds:[],
    evaluatorRequirements:['actual-frozen-global-settings','source-revision-and-message-version-owner',
      'bounded-regex-and-macro-template-evaluators','deterministic-probability-and-group-selector',
      'branch-scoped-timed-effects-and-recursion-frontier','real-tokenizer-budget-and-placement-adapter'],
    diagnosticsSha256:recordSha256(diagnostics)}
  const plan={...body,planSha256:recordSha256(body)}
  return freeze(cloneSchemaData({kind:'compiled' as const,plan,diagnostics},OUTPUT_BYTES,outputBounds))
}
function compile(input:TavernLoreCompilationInputV1):Extract<TavernLoreCompilationV1,{kind:'compiled'}> {
  const {book,source}=input,budget=new OutputBudget(),diagnostics:TavernLoreDiagnosticV1[]=[]
  if(book===null)return compileAbsentBook(input)
  const overlay=input.currentNativeOverlay
  const overlayEntries=new Map(overlay?.entries.map((row,index)=>[row.rawEntryPointer,{row,index}] as const))
  const bookId=recordSha256({schemaVersion:1,encoding:'st-lore-book-source-address-v1',
    ownerSessionId:source.ownerSessionId,sourceRecordSessionId:source.sourceRecordSessionId,
    importId:source.importId,bookPointer:source.bookPointer})
  budget.add(book,source.bookPointer);budget.add(source,'/source')
  if(overlay)budget.add(overlay,'/currentNativeOverlay')
  const diagnose=(code:string,at:string,entryOrdinal:number|null,blocking:boolean,observed:unknown=null)=>{
    if(!pointer(at))fail('LORE_POINTER_LIMIT',source.bookPointer)
    const row:TavernLoreDiagnosticV1={schemaVersion:1,encoding:'st-character-book-compiler-diagnostic-v1',
      code,pointer:at,entryOrdinal,blocking,observedType:observed===null?null:typeOf(observed),limit:null}
    budget.add(row,at);diagnostics.push(row);return diagnostics.length-1
  }
  const metadata=(at:string,value:unknown,disposition:TavernLoreMetadataReferenceV1['disposition'])=>{
    if(!pointer(at))fail('LORE_POINTER_LIMIT',source.bookPointer)
    const row={pointer:at,valueSha256:recordSha256(value),disposition}
    budget.add(row,at);return row
  }
  const bookMetadata:TavernLoreMetadataReferenceV1[]=[]
  const declaredBookSettings:{disposition:'not-applied-by-fixed-importer';scanDepth?:number;tokenBudget?:number;recursiveScanning?:boolean}
    ={disposition:'not-applied-by-fixed-importer'}
  let bookBlocked=false
  for(const [key,value] of Object.entries(book)) {
    if(key==='entries')continue
    const at=append(source.bookPointer,key)
    const known=bookKnown.has(key)
    const disposition=known?'known-unapplied-by-profile':'retained-uninterpreted'
    bookMetadata.push(metadata(at,value,disposition))
    if(!known||key==='extensions'&&value!==null&&(!object(value)||Object.keys(value).length)) {
      diagnose('LORE_BOOK_METADATA_UNINTERPRETED',at,null,true,value);bookBlocked=true
    }else if(!['name','description','extensions'].includes(key)) {
      diagnose('LORE_BOOK_SETTING_NOT_APPLIED_BY_FIXED_IMPORTER',at,null,false,value)
      if(key==='recursive_scanning'&&typeof value==='boolean')declaredBookSettings.recursiveScanning=value
      else if((key==='scan_depth'||key==='token_budget')&&typeof value==='number'&&Number.isSafeInteger(value)&&value>=0) {
        if(key==='scan_depth')declaredBookSettings.scanDepth=value
        else declaredBookSettings.tokenBudget=value
      }else {
        diagnose('LORE_BOOK_DECLARATION_VALUE_UNSUPPORTED',at,null,true,value);bookBlocked=true
      }
    }
  }
  const original=book.entries
  if(!Array.isArray(original)&&!object(original))fail('LORE_ENTRY_COLLECTION_REQUIRED',append(source.bookPointer,'entries'))
  const array=Array.isArray(original),rawEntries=array?original.map((value,index)=>[String(index),value] as const):Object.entries(original)
  if(rawEntries.length>CARD_LIMITS.entries)fail('LORE_ENTRY_LIMIT',append(source.bookPointer,'entries'),
    {field:'entries',observed:rawEntries.length,maximum:CARD_LIMITS.entries})
  if(!array) {
    diagnose('LORE_OBJECT_ENTRY_COLLECTION_UNSUPPORTED',append(source.bookPointer,'entries'),null,true,original)
    bookBlocked=true
  }
  const drafts:EntryBody[]=[]
  const uidOwners=new Map<string,number[]>()
  for(const [ordinal,[sourceKey,rawEntry]] of rawEntries.entries()) {
    const at=append(append(source.bookPointer,'entries'),sourceKey),start=diagnostics.length
    const rawEntrySha256=recordSha256(rawEntry)
    const overrides:Record<string,unknown>={},fieldSources:TavernLoreFieldSourceV1[]=[],retained:TavernLoreMetadataReferenceV1[]=[]
    const declarations:Record<string,unknown>={}
    let blocked=false
    const bad=(code:string,where:string,value:unknown)=>{diagnose(code,where,ordinal,true,value);blocked=true}
    const addField=(field:string,where:string,value:unknown,disposition:TavernLoreFieldSourceV1['disposition']='interpreted-input')=>{
      if(!pointer(where))fail('LORE_POINTER_LIMIT',at)
      const row={field,pointer:where,valueSha256:recordSha256(value),disposition}
      budget.add(row,where);fieldSources.push(row)
    }
    const entry=object(rawEntry)?rawEntry:{}
    if(!object(rawEntry))bad('LORE_ENTRY_OBJECT_REQUIRED',at,rawEntry)
    const rawUid=entry.id
    const validUid=typeof rawUid==='string'||typeof rawUid==='number'&&Number.isSafeInteger(rawUid)
    const uid:TavernLoreEntryPlanV1['upstreamUid']=rawUid===undefined?{origin:'ordinal-fallback',value:ordinal}
      :validUid?{origin:'explicit',value:rawUid as string|number}:{origin:'invalid',value:null}
    const entryId=recordSha256({schemaVersion:1,encoding:'st-lore-entry-source-address-v1',bookId,sourceKey,uid})
    if(uid.origin==='invalid')bad('LORE_UID_UNSUPPORTED',append(at,'id'),rawUid)
    else {
      const collisionKey=String(uid.value),indexes=uidOwners.get(collisionKey)??[]
      indexes.push(ordinal);uidOwners.set(collisionKey,indexes)
    }
    const extension=entry.extensions===undefined||entry.extensions===null?{}:entry.extensions
    if(!object(extension))bad('LORE_EXTENSIONS_OBJECT_REQUIRED',append(at,'extensions'),extension)
    const ext=object(extension)?extension:{}
    if(typeof entry.content==='string') {
      overrides.content={kind:'unexecuted-source-text',pointer:append(at,'content'),contentSha256:sha256(entry.content)}
      addField('content',append(at,'content'),entry.content)
    }else bad('LORE_CONTENT_REQUIRED',append(at,'content'),entry.content)
    for(const definition of fields) {
      const container=definition.extension?ext:entry,where=definition.extension
        ?append(append(at,'extensions'),definition.raw):append(at,definition.raw)
      if(!has(container,definition.raw)) {
        if(definition.required)bad('LORE_REQUIRED_FIELD_UNRESOLVED',where,undefined)
        continue
      }
      const originalValue=container[definition.raw]
      addField(definition.field,where,originalValue)
      // The pinned importer uses nullish defaults for extensions. Required
      // keys/order/content have no guessed editor-template fallback.
      if(originalValue===null&&!definition.required)continue
      const normalized=fieldValue(definition,originalValue)
      if(normalized===undefined) {bad('LORE_FIELD_VALUE_UNSUPPORTED',where,originalValue);continue}
      const defaultValue=definition.field==='displayIndex'?ordinal:
        (ST_LORE_ENTRY_DEFAULTS_V1 as Record<string,unknown>)[definition.field]
      if(defaultValue===undefined||recordSha256(normalized)!==recordSha256(defaultValue))overrides[definition.field]=normalized
    }
    const extensionPosition=ext.position
    if(extensionPosition!==undefined&&extensionPosition!==null) {
      addField('position',append(append(at,'extensions'),'position'),extensionPosition)
      const mapped=typeof extensionPosition==='number'&&Number.isInteger(extensionPosition)
        ?ST_LORE_POSITION_V1[extensionPosition]:undefined
      if(mapped===undefined)bad('LORE_POSITION_ENUM_UNSUPPORTED',append(append(at,'extensions'),'position'),extensionPosition)
      else if(mapped!==ST_LORE_ENTRY_DEFAULTS_V1.position)overrides.position=mapped
      if(has(entry,'position'))retained.push(metadata(append(at,'position'),entry.position,'known-unapplied-by-profile'))
    }else {
      if(has(ext,'position'))addField('position',append(append(at,'extensions'),'position'),extensionPosition)
      if(has(entry,'position')) {
        addField('position',append(at,'position'),entry.position)
        if(entry.position==='before_char')overrides.position='before-character'
        else if(entry.position!==null&&entry.position!=='after_char')bad('LORE_POSITION_TOKEN_UNSUPPORTED',append(at,'position'),entry.position)
      }
    }
    const primary=overrides.primaryKeys as string[]|undefined
    const secondary=(overrides.secondaryKeys??ST_LORE_ENTRY_DEFAULTS_V1.secondaryKeys) as readonly string[]
    if(primary&&primary.length+secondary.length>256)bad('LORE_KEY_BUDGET',at,{primary:primary.length,secondary:secondary.length})
    for(const [key,value] of Object.entries(entry)) {
      if(topKnown.has(key))continue
      const where=append(at,key),legacy=legacyControls.has(key)
      retained.push(metadata(where,value,legacy?'known-unapplied-by-profile':'retained-uninterpreted'))
      diagnose(legacy?'LORE_LEGACY_FIELD_NOT_APPLIED_BY_FIXED_IMPORTER':'LORE_ENTRY_METADATA_UNINTERPRETED',where,ordinal,!legacy,value)
      if(!legacy)blocked=true
      else {
        const binding=legacyBindings.find(binding=>binding.raw===key)!
        const normalized=declarationValue(binding.kind,value)
        if(normalized!==undefined)declarations[binding.field]=normalized
        else diagnose('LORE_RETAINED_DECLARATION_TYPE_UNSUPPORTED',where,ordinal,false,value)
      }
    }
    for(const key of ['id','name','comment'])if(has(entry,key))retained.push(metadata(append(at,key),entry[key],'source-metadata'))
    for(const [key,value] of Object.entries(ext))if(!extensionKnown.has(key)) {
      const where=append(append(at,'extensions'),key)
      retained.push(metadata(where,value,'retained-uninterpreted'))
      bad('LORE_EXTENSION_METADATA_UNINTERPRETED',where,value)
    }
    const current=overlayEntries.get(at)
    if(current) {
      // Apply only explicitly supplied semantic fields. The immutable source,
      // UID/address and original diagnostics remain intact; an edit is not a
      // mechanism to launder unsupported original control data.
      for(const [field,value] of Object.entries(current.row.fields)) {
        if(field==='content') {
          const text=value as string,contentSha256=sha256(text)
          overrides.content={kind:'unexecuted-source-text',pointer:append(at,'content'),contentSha256,
            currentNative:{text,contentSha256,origin:current.row.origin}}
        }else overrides[field]=value
        const where=`/currentNativeOverlay/entries/${current.index}/fields/${token(field)}`
        const row:TavernLoreFieldSourceV1={field,pointer:where,valueSha256:recordSha256(value),
          disposition:'current-native-origin',currentNativeOrigin:current.row.origin}
        budget.add(row,where);fieldSources.push(row)
      }
    }
    const effective={...ST_LORE_ENTRY_DEFAULTS_V1,displayIndex:ordinal,...overrides} as unknown as TavernLoreSemanticEntryV1
    if(current&&effective.primaryKeys.length+effective.secondaryKeys.length>256)fail('LORE_OVERLAY_KEY_BUDGET',at)
    if(effective.position==='named-outlet'&&!effective.outletName)bad('LORE_OUTLET_NAME_REQUIRED',append(at,'extensions'),null)
    if(effective.vectorized)bad('LORE_VECTORIZED_EVALUATOR_REQUIRED',append(append(at,'extensions'),'vectorized'),true)
    if(effective.automationId)bad('LORE_AUTOMATION_BRIDGE_REQUIRED',append(append(at,'extensions'),'automation_id'),effective.automationId)
    if(effective.triggers.length)bad('LORE_TRIGGER_ENUM_PROFILE_REQUIRED',append(append(at,'extensions'),'triggers'),effective.triggers)
    const body:EntryBody={entryId,ordinal,sourceKey,sourcePointer:at,rawEntrySha256,upstreamUid:uid,
      disposition:blocked?'retained-ineligible':effective.enabled?'eligible-semantic-data':'disabled',
      semanticOverrides:overrides as Partial<TavernLoreSemanticEntryV1>,fieldSources,retainedMetadata:retained,
      retainedDeclarations:declarations as TavernLoreRetainedDeclarationsV1,
      diagnosticIndexes:Array.from({length:diagnostics.length-start},(_,index)=>start+index)}
    budget.add({...body,fieldSources:[],retainedMetadata:[],entryPlanSha256:'0'.repeat(64)},at)
    drafts.push(body)
  }
  for(const indexes of uidOwners.values())if(indexes.length>1)for(const index of indexes) {
    const draft=drafts[index]!,diagnostic=diagnose('LORE_DUPLICATE_UPSTREAM_UID',append(draft.sourcePointer,'id'),index,true)
    drafts[index]={...draft,disposition:'retained-ineligible',diagnosticIndexes:[...draft.diagnosticIndexes,diagnostic]}
  }
  const entries=drafts.map(body=>({...body,entryPlanSha256:recordSha256(body)}))
  const body={schemaVersion:1 as const,encoding:'st-character-book-semantic-plan-inputs-v1' as const,
    authority:'consumer-data-only' as const,compiler:{id:'owned-st-character-book-compiler' as const,version:1 as const,
      upstreamCommit:ST_LORE_COMMIT,semanticProfileSha256:TAVERN_LORE_COMPILER_PROFILE_SHA256,
      ...(overlay?{currentNativeOverlayProfileSha256:TAVERN_LORE_CURRENT_NATIVE_OVERLAY_PROFILE_SHA256}:{})},source,
    sourceReferenceSha256:recordSha256(source),bookId,rawBook:book,rawBookSha256:recordSha256(book),
    ...(overlay?{currentNativeOverlay:overlay,currentNativeOverlaySha256:recordSha256(overlay)}:{}),
    bookDisposition:bookBlocked?'retained-ineligible' as const:'eligible-semantic-data' as const,
    collection:{kind:array?'source-array' as const:'object-retained-unsupported' as const,count:entries.length},
    bookMetadata,declaredBookSettings,entries,
    eligibleEntryIds:bookBlocked?[]:entries.filter(entry=>entry.disposition==='eligible-semantic-data').map(entry=>entry.entryId),
    evaluatorRequirements:['actual-frozen-global-settings','source-revision-and-message-version-owner',
      'bounded-regex-and-macro-template-evaluators','deterministic-probability-and-group-selector',
      'branch-scoped-timed-effects-and-recursion-frontier','real-tokenizer-budget-and-placement-adapter'],
    diagnosticsSha256:recordSha256(diagnostics)}
  const plan={...body,planSha256:recordSha256(body)}
  return freeze(cloneSchemaData({kind:'compiled' as const,plan,diagnostics},OUTPUT_BYTES,outputBounds))
}
export function compileTavernLoreBookV1(input:unknown):TavernLoreCompilationV1 {
  try {return compile(validateInput(input))}
  catch(error) {
    const code=error instanceof LoreRefusal?error.code:error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
      ?error.message:'LORE_COMPILATION_REFUSED'
    return freeze({kind:'refused',diagnostics:[{schemaVersion:1,encoding:'st-character-book-compiler-diagnostic-v1',code,
      pointer:error instanceof LoreRefusal?error.pointer:'/',entryOrdinal:null,blocking:true,observedType:null,
      limit:error instanceof LoreRefusal?error.limit:null}]})
  }
}
/** Consumer validation for Root's Source/catalog nil branch. The caller must
 * construct and join this reference from its actual captured Source; a returned
 * datum is not permission to read a table or admit a Native/template owner. */
export function validateTavernLoreAbsentSourceReferenceV1(input:unknown):TavernLoreAbsentSourceReferenceV1 {
  const checked=validateInput({schemaVersion:1,encoding:'st-character-book-compilation-input-v1',source:input,book:null})
  const source=checked.source
  if(!('bookPresence' in source)||source.bookPresence!=='proven-absence') {
    fail('LORE_BOOK_ABSENCE_PROOF_REQUIRED','/source')
  }
  return freeze(source as TavernLoreAbsentSourceReferenceV1)
}
/** Recompute from the retained original book. Integrity does not prove that a
 * caller supplied the actual current Import/raw record; its owner must do so. */
export function validateTavernLoreCompilationV1(input:unknown):Extract<TavernLoreCompilationV1,{kind:'compiled'}> {
  const value=cloneSchemaData(input,OUTPUT_BYTES,outputBounds)
  if(!object(value)||value.kind!=='compiled'||!object(value.plan))fail('LORE_PLAN_INVALID')
  const plan=value.plan
  const rebuilt=compileTavernLoreBookV1({schemaVersion:1,encoding:'st-character-book-compilation-input-v1',
    source:plan.source,book:plan.rawBook,
    ...(has(plan,'currentNativeOverlay')?{currentNativeOverlay:plan.currentNativeOverlay}:{})})
  if(rebuilt.kind!=='compiled'||recordSha256(value)!==recordSha256(rebuilt))fail('LORE_PLAN_RECOMPUTATION_MISMATCH')
  return rebuilt
}
/** Materialize only typed data. Content remains an unexecuted source reference;
 * inherited globals remain null and no activation or prompt is produced. */
export function readTavernLoreSemanticDataV1(input:unknown,entryId:string):TavernLoreSemanticEntryV1 {
  const {plan}=validateTavernLoreCompilationV1(input),entry=plan.entries.find(row=>row.entryId===entryId)
  if(!entry||entry.disposition==='retained-ineligible')fail('LORE_ENTRY_SEMANTICS_UNAVAILABLE')
  return freeze({...ST_LORE_ENTRY_DEFAULTS_V1,displayIndex:entry.ordinal,...entry.semanticOverrides} as TavernLoreSemanticEntryV1)
}
export interface TavernLoreResolvedContentTextV1 {
  readonly pointer:string
  readonly text:string
  /** Hash of this call's actual inert template input, including current edits. */
  readonly contentSha256:string
  readonly rawEntryPointer:string
  readonly rawEntrySha256:string
  readonly origin:'original-character-book'|'current-native-origin'
  readonly currentNativeOrigin?:TavernLoreCurrentNativeOriginV1
}
/** Resolve content in an already recomputed plan. This helper does not confer
 * authority; external callers should prefer readTavernLoreContentTextV1. */
export function resolveTavernLoreContentTextV1(plan:TavernLorePlanV1,at:string):TavernLoreResolvedContentTextV1 {
  const matches=plan.entries.filter(row=>append(row.sourcePointer,'content')===at)
  if(matches.length!==1)fail('LORE_CONTENT_POINTER_MISSING',at)
  const entry=matches[0]!,
    semantic={...ST_LORE_ENTRY_DEFAULTS_V1,displayIndex:entry.ordinal,...entry.semanticOverrides} as TavernLoreSemanticEntryV1
  const content=semantic.content
  if(!content||content.pointer!==at)fail('LORE_CONTENT_POINTER_INVALID',at)
  if(plan.rawBook===null)fail('LORE_CONTENT_POINTER_MISSING',at)
  const original=originalValueAt(plan.rawBook,plan.source.bookPointer,entry.sourcePointer)
  if(!object(original)||recordSha256(original)!==entry.rawEntrySha256)fail('LORE_CONTENT_ENTRY_HASH',at)
  const current=content.currentNative
  const text=current?.text??original.content
  if(typeof text!=='string')fail('LORE_CONTENT_SOURCE_NOT_TEXT',at)
  const contentSha256=sha256(text)
  if(contentSha256!==content.contentSha256||current&&current.contentSha256!==contentSha256) {
    fail('LORE_CONTENT_SOURCE_HASH',at)
  }
  if(current) {
    const rows=plan.currentNativeOverlay?.entries.filter(row=>row.rawEntryPointer===entry.sourcePointer)??[]
    if(rows.length!==1||rows[0]!.rawEntrySha256!==entry.rawEntrySha256||rows[0]!.fields.content!==text
      ||recordSha256(rows[0]!.origin)!==recordSha256(current.origin))fail('LORE_CONTENT_OVERLAY_LINK',at)
  }
  return freeze({pointer:at,text,contentSha256,rawEntryPointer:entry.sourcePointer,
    rawEntrySha256:entry.rawEntrySha256,origin:current?'current-native-origin':'original-character-book',
    ...(current?{currentNativeOrigin:current.origin}:{})})
}
/** Recompute the complete book+overlay before exposing actual template input.
 * Disabled entries remain readable; no entry is activated by this operation. */
export function readTavernLoreContentTextV1(input:unknown,entryId:string):TavernLoreResolvedContentTextV1 {
  const {plan}=validateTavernLoreCompilationV1(input),entry=plan.entries.find(row=>row.entryId===entryId)
  if(!entry||entry.disposition==='retained-ineligible')fail('LORE_ENTRY_SEMANTICS_UNAVAILABLE')
  return resolveTavernLoreContentTextV1(plan,append(entry.sourcePointer,'content'))
}
