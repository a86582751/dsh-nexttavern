/** Actual Source/import/current editor provenance, with inert complete text
 * partitions. The protected renderer and numeric/opening owners live elsewhere. */
import {recordSha256,sha256} from './roleplay-data.js'
import {decodeTavernCard} from './tavern-card.js'
import {assertImportRecordIntegrity,projectStructuredImport,spanText} from './roleplay-import-record.js'
import {captureRoleplayTavernPromptSourceV1} from './roleplay-tavern-prompt-source.js'
import {tavernLoreSourceCurrentIdentityV1} from './roleplay-tavern-lore-source.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {validateTavernLoreCompilationV1,resolveTavernLoreContentTextV1} from './tavern-lore-compiler.mjs'
import {mapPromptProgramAuthorOriginsV1} from './roleplay-prompt-template-only-origins.js'
import {PROMPT_TEMPLATE_ONLY_FIELDS_V1,PromptTemplateOnlyRefusalV1,segmentPromptTemplateOnlyFieldV1}
  from './roleplay-prompt-template-only-data.js'
import type {ImportRecord} from './roleplay-import-types.js'
import type {TavernLoreSourceDataV1,TavernLoreSourceRowDataV1} from './roleplay-tavern-lore-source-types.js'
import type {PromptProgramSourceCodeV1,PromptProgramSourceDepsV1,PromptProgramTextV1,
  PromptProgramBookEntryV1,PromptProgramExcludedLeafV1,PromptProgramImportTupleV1,
  PromptProgramSourceInventoryV1,PromptProgramSourceCaptureV1}
  from './roleplay-prompt-program-source-types.js'
export type * from './roleplay-prompt-program-source-types.js'

export const PROMPT_PROGRAM_SOURCE_POLICY_V1=Object.freeze({schemaVersion:1,
  encoding:'native-author-prompt-program-source-policy-v1',authority:'consumer-data-only',
  fields:PROMPT_TEMPLATE_ONLY_FIELDS_V1,book:'actual-recomputed-entry-content-only-with-original-address-and-current-origins',
  projection:'whole-maintained-normalizer-assignment-and-current-group; no-substring-permission-or-edited-field-guess',
  tokenization:'existing-full-UTF16-delimiter-partition-only; not-AST-effect-syntax-success-or-execution-proof',
  initialization:'not-authorized; InitVar-and-schema-scripts-require-their-own-actual-owner',
  current:'actual-source-edit-compiler-and-import-readers; named-Source-current-identity-excludes-only-three-native-meta-counters',
  sourceTextBudget:'existing-tokenizer-per-text-limit; unsupported-text-keeps-complete-inert-inventory',
  proofBytes:16_777_216,leafInventory:32_768,groups:4096,entries:4096})
export const PROMPT_PROGRAM_SOURCE_POLICY_SHA256=recordSha256(PROMPT_PROGRAM_SOURCE_POLICY_V1)
class ProgramSourceFailure extends Error {
  constructor(readonly code:PromptProgramSourceCodeV1,readonly pointer:string) {super(code)}
}
function fail(code:PromptProgramSourceCodeV1,pointer:string):never {throw new ProgramSourceFailure(code,pointer)}
function object(value:unknown):value is Record<string,unknown> {
  return value!==null&&typeof value==='object'&&!Array.isArray(value)
}
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const escape=(key:string)=>key.replace(/~/g,'~0').replace(/\//g,'~1')
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
function clone<T>(input:T):T {
  try {return cloneRoleplayTavernLoreDataV1(input,PROMPT_PROGRAM_SOURCE_POLICY_V1.proofBytes)}
  catch {return fail('PROGRAM_SOURCE_BUDGET','/inventory')}
}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
function textInventory(text:string,pointer:string):PromptProgramTextV1 {
  const base={text,textSha256:sha256(text),utf16Length:text.length,authority:'none' as const,
    execution:'not-authorized' as const}
  try {
    const segments=segmentPromptTemplateOnlyFieldV1(text,pointer)
    return {...base,tokenization:'complete-UTF16-partition',segments,segmentsSha256:recordSha256(segments),
      tokenizerDiagnostic:null}
  }catch(error) {
    if(!(error instanceof PromptTemplateOnlyRefusalV1))throw error
    // Disabled/retained entries and unsupported fields stay fully inventoried.
    // This branch cannot be mistaken for a successful tokenizer or VM parse.
    return {...base,tokenization:'unsupported-delimiters-or-source-budget',segments:null,segmentsSha256:null,
      tokenizerDiagnostic:{code:error.code,pointer:error.pointer}}
  }
}
function deniedLeaves(value:unknown,input:{domain:PromptProgramExcludedLeafV1['domain'];
  row:TavernLoreSourceRowDataV1['ref']|null;pointer:string;authorized:ReadonlySet<string>},
  rows:PromptProgramExcludedLeafV1[]):void {
  const add=(child:unknown,pointer:string,kind:PromptProgramExcludedLeafV1['kind'])=>{
    if(rows.length>=PROMPT_PROGRAM_SOURCE_POLICY_V1.leafInventory)fail('PROGRAM_SOURCE_BUDGET',pointer)
    rows.push({domain:input.domain,row:input.row,pointer,kind,valueSha256:recordSha256(child),
      utf16Length:typeof child==='string'?child.length:null,
      ejsDelimiterPresent:typeof child==='string'&&(child.includes('<%')||child.includes('%>')),
      disposition:'not-authorized-by-program-source-inventory'})
  }
  const walk=(child:unknown,pointer:string):void=>{
    if(typeof child==='string') {
      if(!input.authorized.has(pointer))add(child,pointer,'string')
      return
    }
    if(child===null||typeof child!=='object'){add(child,pointer,'non-string');return}
    const children=Object.entries(child)
    if(!children.length){add(child,pointer,'non-string');return}
    for(const [key,nested] of children) {
      const next=pointer+'/'+escape(key)
      if(!Array.isArray(child))add(key,next,'property-key')
      walk(nested,next)
    }
  }
  walk(value,input.pointer)
}
/** Audit plan hashes retain the actual sourceSnapshotSha256. This separately
 * named binding substitutes only the actual Source current identity; it never
 * claims that the transformed value is a canonical compiler plan or proof. */
function semanticPlanBinding(compilation:ReturnType<typeof validateTavernLoreCompilationV1>,sourceIdentitySha256:string) {
  const {planSha256:_,sourceReferenceSha256:__,...plan}=compilation.plan
  const source={...plan.source,sourceSnapshotSha256:sourceIdentitySha256}
  return recordSha256({encoding:'author-program-semantic-compiler-binding-v1',
    plan:{...plan,source,sourceReferenceSha256:recordSha256(source)},diagnostics:compilation.diagnostics})
}
function bindingBody(data:Omit<PromptProgramSourceInventoryV1,'bindingSha256'|'inventorySha256'>) {
  const {audit:_,book,editing,currentRows,unauthorized,unauthorizedSha256:_____,...body}=data
  const {compilationSha256:__,planSha256:___,...boundBook}=book
  const {dataSha256:____,...boundEditing}=editing
  const metaKey=`${data.sessionId}__meta`,counters=new Set(['/lastTurn','/lastSeq','/surfaceTokens'])
  // Every serialized row ref is still the actual audited row hash. Only this
  // named semantic binding replaces the meta row's changing hash with the
  // Source owner's independently recomputed current identity. Unknown meta
  // values and keys remain bound; only its three registered counters leave.
  const boundUnauthorized=unauthorized.filter(leaf=>!(leaf.domain==='current-row'
    &&leaf.row?.table==='branch'&&leaf.row.key===metaKey&&counters.has(leaf.pointer))).map(leaf=>
    leaf.domain==='current-row'&&leaf.row?.table==='branch'&&leaf.row.key===metaKey
      ?{...leaf,row:{table:leaf.row.table,key:leaf.row.key,exists:leaf.row.exists,
        currentIdentitySha256:data.sourceCurrentIdentitySha256}}:leaf)
  return {...body,book:boundBook,editing:boundEditing,
    currentRows:currentRows.filter(row=>!(row.table==='branch'&&row.key===metaKey)),
    unauthorized:boundUnauthorized,unauthorizedSha256:recordSha256(boundUnauthorized)}
}
function validateText(text:PromptProgramTextV1,pointer:string):void {
  if(!object(text)||typeof text.text!=='string'||!same(text,textInventory(text.text,pointer))) {
    fail('PROGRAM_INVENTORY_INVALID',pointer)
  }
}
function validateInventory(input:unknown):PromptProgramSourceInventoryV1 {
  const value=clone(input)
  const keys=['schemaVersion','encoding','authority','policySha256','sessionId','includeCardStyle','importTuple',
    'sourceCurrentIdentitySha256','authorFields','authorGroups','assignments','bookEntries','book','currentRows',
    'editing','unauthorized','unauthorizedSha256','authorityLimits','bindingSha256','audit','inventorySha256']
  if(!object(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key))
    ||value.schemaVersion!==1||value.encoding!=='native-author-prompt-program-source-inventory-v1'
    ||value.authority!=='consumer-data-only'||value.policySha256!==PROMPT_PROGRAM_SOURCE_POLICY_SHA256
    ||typeof value.sessionId!=='string'||typeof value.includeCardStyle!=='boolean'
    ||!Array.isArray(value.authorFields)||value.authorFields.length!==6||!Array.isArray(value.authorGroups)
    ||!Array.isArray(value.bookEntries)||value.authorGroups.length>PROMPT_PROGRAM_SOURCE_POLICY_V1.groups
    ||value.bookEntries.length>PROMPT_PROGRAM_SOURCE_POLICY_V1.entries||!hash(value.inventorySha256)
    ||!hash(value.bindingSha256)||!Array.isArray(value.unauthorized)
    ||value.unauthorizedSha256!==recordSha256(value.unauthorized))fail('PROGRAM_INVENTORY_INVALID','/inventory')
  const data=value as unknown as PromptProgramSourceInventoryV1
  const {inventorySha256, bindingSha256,...body}=data
  if(inventorySha256!==recordSha256({bindingSha256,...body})||bindingSha256!==recordSha256(bindingBody(body))) {
    fail('PROGRAM_INVENTORY_INVALID','/inventory/hash')
  }
  if(!same(data.authorityLimits,{numericalInitialization:'not-authorized',schemaScripts:'not-authorized',
    nativeInput:'not-authorized',protectedExecution:'not-authorized',
    tokenizer:'delimiter-partition-only-not-AST-effect-or-success-proof'}))fail('PROGRAM_INVENTORY_INVALID','/authorityLimits')
  for(const [index,field] of data.authorFields.entries()) {
    if(field.field!==PROMPT_TEMPLATE_ONLY_FIELDS_V1[index]||field.originalPointer!==`/data/${field.field}`) {
      fail('PROGRAM_INVENTORY_INVALID','/authorFields')
    }
    if(field.raw)validateText(field.raw,field.originalPointer)
    if(field.normalized)validateText(field.normalized,field.originalPointer)
    if(field.presence==='absent') {
      if(field.raw!==null||field.normalized!==null||field.assignment!==null
        ||field.currentGroupId!==null||field.originalGroupSpan!==null)fail('PROGRAM_INVENTORY_INVALID','/authorFields/absence')
    }else {
      if(field.presence!=='text'||!field.raw||!field.normalized
        ||field.normalized.text!==(field.raw.text===''?'':field.raw.text.replace(/\r\n?/g,'\n')+'\n')) {
        fail('PROGRAM_INVENTORY_INVALID','/authorFields/normalization')
      }
      if(field.raw.text!=='') {
        const group=data.authorGroups.find(row=>row.groupId===field.currentGroupId),span=field.originalGroupSpan
        if(!group||!span||!field.assignment||group.original.text.slice(span.start,span.end)!==field.normalized.text) {
          fail('PROGRAM_INVENTORY_INVALID','/authorFields/original-group')
        }
      }else if(field.assignment!==null||field.currentGroupId!==null||field.originalGroupSpan!==null) {
        fail('PROGRAM_INVENTORY_INVALID','/authorFields/empty')
      }
    }
  }
  for(const assignment of data.assignments)if(recordSha256(assignment.assignment)!==assignment.assignmentSha256
    ||recordSha256(assignment.sourceDescriptor)!==assignment.sourceDescriptorSha256) {
    fail('PROGRAM_INVENTORY_INVALID','/assignments')
  }
  for(const group of data.authorGroups) {
    validateText(group.original,group.groupId);validateText(group.effective,group.groupId)
    let end=0
    for(const part of group.parts) {
      if(part.start!==end||part.end<part.start||part.end>group.original.utf16Length
        ||sha256(group.original.text.slice(part.start,part.end))!==part.assignment.normalizedSectionSha256) {
        fail('PROGRAM_INVENTORY_INVALID','/authorGroups/partition')
      }
      end=part.end
    }
    if(end!==group.original.utf16Length)fail('PROGRAM_INVENTORY_INVALID','/authorGroups/partition')
  }
  for(const entry of data.bookEntries) {
    validateText(entry.original,entry.contentPointer);validateText(entry.effective,entry.contentPointer)
    if(entry.currentProjection) {
      const pointer=entry.currentProjection.row.table+':'+entry.currentProjection.row.key+':/content'
      validateText(entry.currentProjection.original,pointer);validateText(entry.currentProjection.effective,pointer)
    }
    if(entry.numericalInitialization!=='not-authorized')fail('PROGRAM_INVENTORY_INVALID','/bookEntries')
    const eligibility=entry.disposition==='disabled'?'disabled-never-execute'
      :entry.disposition==='retained-ineligible'||data.book.bookDisposition!=='eligible-semantic-data'
        ?'ineligible-never-execute':'requires-actual-selection-and-protected-runtime'
    if(entry.promptEligibility!==eligibility||entry.fieldSourcesSha256!==recordSha256(entry.fieldSources)) {
      fail('PROGRAM_INVENTORY_INVALID','/bookEntries/eligibility')
    }
  }
  for(const leaf of data.unauthorized)if(leaf.disposition!=='not-authorized-by-program-source-inventory') {
    fail('PROGRAM_INVENTORY_INVALID','/unauthorized')
  }
  return freeze(data)
}
/** Stored data consistency only. Actual ownership/currency still comes from
 * installed private readers; a self-signed inventory hash grants no authority. */
export function validatePromptProgramSourceInventoryV1(input:unknown):PromptProgramSourceInventoryV1 {
  try {return validateInventory(input)}
  catch(error) {
    if(error instanceof ProgramSourceFailure)throw error
    return fail('PROGRAM_INVENTORY_INVALID','/inventory')
  }
}

export function createRoleplayPromptProgramSourceV1(deps:PromptProgramSourceDepsV1) {
  let closed=false
  type LiveCapture={readonly source:TavernLoreSourceDataV1;readonly wholeSha256:string;
    readonly inventorySha256:string;assertCurrent():void}
  let captures=new WeakMap<PromptProgramSourceInventoryV1,LiveCapture>()
  function read(sessionId:string,includeCardStyle:boolean,assertOwnerCurrent:()=>void,
    saveCapture?:(data:PromptProgramSourceInventoryV1,live:LiveCapture)=>void):PromptProgramSourceInventoryV1 {
    if(closed)fail('PROGRAM_SOURCE_CHANGED','/owner/disposed')
    const tables=deps.tables,sourceOwner=deps.source,editOwner=deps.edits,importReader=deps.readImportRecord,
      tableOwners=[tables.cards,tables.worldbook,tables.rules,tables.status],
      tableMethods=tableOwners.map(table=>({get:table.get,entries:table.entries})),
      sourceMethods={capture:sourceOwner.capture,current:sourceOwner.current,captureCurrent:sourceOwner.captureCurrent},
      editMethods={observe:editOwner.observe,current:editOwner.current,observeCurrent:editOwner.observeCurrent}
    const assertReaderOwners=()=>{
      const actual=[deps.tables.cards,deps.tables.worldbook,deps.tables.rules,deps.tables.status]
      if(closed||deps.tables!==tables||deps.source!==sourceOwner||deps.edits!==editOwner||deps.readImportRecord!==importReader
        ||actual.some((table,index)=>table!==tableOwners[index]||table.get!==tableMethods[index]!.get
          ||table.entries!==tableMethods[index]!.entries)
        ||sourceOwner.capture!==sourceMethods.capture||sourceOwner.current!==sourceMethods.current
        ||sourceOwner.captureCurrent!==sourceMethods.captureCurrent||editOwner.observe!==editMethods.observe
        ||editOwner.current!==editMethods.current||editOwner.observeCurrent!==editMethods.observeCurrent) {
        fail('PROGRAM_SOURCE_CHANGED','/owner/readers')
      }
    }
    assertOwnerCurrent()
    const captured=captureRoleplayTavernPromptSourceV1(deps,sessionId,includeCardStyle,assertOwnerCurrent)
    if(captured.kind!=='captured-data')fail('PROGRAM_SOURCE_UNAVAILABLE','/source/'+captured.reason)
    const {source}=captured
    const supplied=deps.readImportRecord(source.sourceRecordSessionId,source.original.activePointer.importId)
    if(!object(supplied))fail('PROGRAM_IMPORT_UNPROVEN','/importRecord')
    const record=clone(supplied) as ImportRecord
    assertImportRecordIntegrity(record)
    if(!record.sourceEnvelope||!record.activation||record.status!=='active'
      ||record.sessionId!==source.sourceRecordSessionId||record.importId!==source.original.activePointer.importId
      ||recordSha256(record)!==source.original.importRecordRef.sha256||record.rawSha256!==source.original.rawSha256
      ||record.normalizedSha256!==source.original.normalizedSha256)fail('PROGRAM_IMPORT_UNPROVEN','/importRecord/ref')
    const decoded=decodeTavernCard(Buffer.from(record.sourceEnvelope.base64,'base64'),record.sourceEnvelope.extension)
    if(decoded.data!==decoded.document.data||decoded.format!==source.original.decodedFormat
      ||recordSha256(decoded.document)!==source.original.documentSha256||recordSha256(decoded.data)!==source.original.dataSha256
      ||projectStructuredImport(record,decoded).text!==record.normalizedSource)fail('PROGRAM_IMPORT_UNPROVEN','/decoded')
    const mapping=mapPromptProgramAuthorOriginsV1({decoded,record,source})
    const compilation=validateTavernLoreCompilationV1(captured.compilation),plan=compilation.plan
    if(plan.source.sourceSnapshotSha256!==source.sourceSha256||plan.rawBookSha256!==source.original.primary.bookSha256
      ||!same(plan.rawBook,source.original.primary.value)||plan.entries.length!==source.original.primary.entries.length) {
      fail('PROGRAM_COMPILATION_UNPROVEN','/compilation')
    }
    const sourceIdentity=tavernLoreSourceCurrentIdentityV1(source),sourceIdentitySha256=recordSha256(sourceIdentity)
    const authorFields=mapping.fields.map(field=>{
      const {rawText,normalizedText,...origin}=field
      return {...origin,raw:rawText===null?null:textInventory(rawText,field.originalPointer),
        normalized:normalizedText===null?null:textInventory(normalizedText,field.originalPointer)}
    })
    const authorGroups=mapping.groups.map(group=>{
      const {originalProjection,effectiveText,...origin}=group
      return {...origin,original:textInventory(originalProjection,group.groupId),effective:textInventory(effectiveText,group.groupId)}
    })
    const bookAssignments=new Map(mapping.bookAssignments.map(row=>[row.rawEntryPointer,row.assignment] as const))
    if(bookAssignments.size!==mapping.bookAssignments.length)fail('PROGRAM_IMPORT_UNPROVEN','/bookAssignments')
    const rawEntries=new Map(source.original.primary.entries.map(row=>[row.ref.entryPointer,row] as const))
    const linkedBookRows=new Map<string,TavernLoreSourceRowDataV1>()
    for(const overlay of captured.contributions.overlays)if(overlay.kind==='exact-current-row-data') {
      if(linkedBookRows.has(overlay.rawEntry.entryPointer))fail('PROGRAM_COMPILATION_UNPROVEN','/current/entry-duplicate')
      linkedBookRows.set(overlay.rawEntry.entryPointer,overlay.row)
    }
    const bookEntries:PromptProgramBookEntryV1[]=plan.entries.map(entry=>{
      const original=rawEntries.get(entry.sourcePointer)
      if(!original||original.ref.entrySha256!==entry.rawEntrySha256||original.ref.entryOrdinal!==entry.ordinal
        ||typeof original.value.content!=='string')fail('PROGRAM_COMPILATION_UNPROVEN',entry.sourcePointer)
      const pointer=entry.sourcePointer+'/content',effective=resolveTavernLoreContentTextV1(plan,pointer)
      const assignment=bookAssignments.get(entry.sourcePointer),originalAssignments=assignment?[assignment]:[]
      const linked=linkedBookRows.get(entry.sourcePointer)
      let currentProjection:PromptProgramBookEntryV1['currentProjection']=null
      if(assignment?.assignment.target==='worldbook') {
        if(!linked?.value||typeof linked.value.content!=='string'
          ||linked.ref.key!==`${sessionId}__${assignment.assignment.id}`
          ||recordSha256(linked.value)!==linked.ref.sha256)fail('PROGRAM_CURRENT_ORIGIN_UNAVAILABLE',entry.sourcePointer)
        const at=linked.ref.table+':'+linked.ref.key+':/content'
        currentProjection={row:linked.ref,fieldPointer:'/content',
          original:textInventory(spanText(record,assignment.assignment.sourceSpans),at),
          effective:textInventory(linked.value.content,at),assignment,provenance:'actual-compiler-linked-current-row'}
      }
      return {entryId:entry.entryId,ordinal:entry.ordinal,sourceKey:entry.sourceKey,originalAddress:entry.sourcePointer,
        rawEntrySha256:entry.rawEntrySha256,contentPointer:pointer,disposition:entry.disposition,
        promptEligibility:entry.disposition==='disabled'?'disabled-never-execute'
          :entry.disposition==='retained-ineligible'||plan.bookDisposition!=='eligible-semantic-data'
            ?'ineligible-never-execute':'requires-actual-selection-and-protected-runtime',
        numericalInitialization:'not-authorized',original:textInventory(original.value.content,pointer),
        effective:textInventory(effective.text,pointer),origin:effective.origin,
        currentNativeOrigin:effective.currentNativeOrigin??null,currentProjection,entryPlanSha256:entry.entryPlanSha256,
        fieldSources:entry.fieldSources,fieldSourcesSha256:recordSha256(entry.fieldSources),
        originalProjectionAssignments:originalAssignments}
    })
    const rawAuthorized=new Set(authorFields.filter(field=>field.raw!==null).map(field=>field.originalPointer))
    for(const entry of bookEntries)rawAuthorized.add(entry.contentPointer)
    const unauthorized:PromptProgramExcludedLeafV1[]=[]
    deniedLeaves(decoded.document,{domain:'original-document',row:null,pointer:'',authorized:rawAuthorized},unauthorized)
    const authorizedRows=new Map<string,{ref:TavernLoreSourceRowDataV1['ref'];fields:Set<string>}>()
    const allowCurrentField=(ref:TavernLoreSourceRowDataV1['ref'],field:string)=>{
      const key=ref.table+':'+ref.key,existing=authorizedRows.get(key)
      if(existing&&!same(existing.ref,ref))fail('PROGRAM_CURRENT_ORIGIN_UNAVAILABLE','/current/row-ref')
      if(existing)existing.fields.add(field)
      else authorizedRows.set(key,{ref,fields:new Set([field])})
    }
    for(const group of mapping.groups)allowCurrentField(group.row,group.fieldPointer)
    for(const entry of bookEntries)if(entry.currentProjection)allowCurrentField(entry.currentProjection.row,'/content')
    for(const row of source.current.rows) {
      const selected=authorizedRows.get(row.ref.table+':'+row.ref.key)
      if(selected&&!same(selected.ref,row.ref))fail('PROGRAM_CURRENT_ORIGIN_UNAVAILABLE','/current/row-ref')
      const authorized=selected?.fields??new Set<string>()
      // Entry content in legacy rows is represented independently by the actual
      // compiler's current-native origin. Other row strings stay unauthorized.
      deniedLeaves(row.value,{domain:'current-row',row:row.ref,pointer:'',authorized},unauthorized)
    }
    const overlay=plan.currentNativeOverlay
    if(overlay) {
      const authorized=new Set(overlay.entries.flatMap((entry,index)=>Object.hasOwn(entry.fields,'content')
        ?[`/entries/${index}/fields/content`]:[]))
      deniedLeaves(overlay,{domain:'current-overlay',row:null,pointer:'',authorized},unauthorized)
    }
    const original=source.original
    const importTuple:PromptProgramImportTupleV1={ownerSessionId:sessionId,sourceRecordSessionId:source.sourceRecordSessionId,
      importId:record.importId,rawSha256:original.rawSha256,normalizedSha256:original.normalizedSha256,
      documentSha256:original.documentSha256,dataSha256:original.dataSha256,normalizer:source.normalizer,
      format:original.decodedFormat,coverageSha256:original.coverageSha256,transactionId:original.transactionId,
      activatedAt:record.activatedAt??null,activationSha256:recordSha256(record.activation),
      activePointer:original.activePointer,activePointerRef:original.activePointerRef,importRecordRef:original.importRecordRef,
      originalActivation:record.activation,sourceInheritance:source.inheritance??null}
    const body={schemaVersion:1 as const,encoding:'native-author-prompt-program-source-inventory-v1' as const,
      authority:'consumer-data-only' as const,policySha256:PROMPT_PROGRAM_SOURCE_POLICY_SHA256,sessionId,includeCardStyle,
      importTuple,sourceCurrentIdentitySha256:sourceIdentitySha256,authorFields,authorGroups,
      assignments:mapping.assignmentInventory,bookEntries,
      book:{pointer:plan.source.bookPointer,rawBookSha256:plan.rawBookSha256,bookDisposition:plan.bookDisposition,
        compilationSha256:recordSha256(compilation),planSha256:plan.planSha256,
        semanticPlanBindingSha256:semanticPlanBinding(compilation,sourceIdentitySha256),
        currentNativeOverlaySha256:plan.currentNativeOverlaySha256??null},
      currentRows:source.current.rows.map(row=>row.ref),editing:{dataSha256:captured.edits.dataSha256,
        revision:captured.edits.revision,headRef:captured.edits.headRef,journalRefs:captured.edits.journalRefs,
        effectiveOverlaySha256:recordSha256(plan.currentNativeOverlay??null)},unauthorized,
      unauthorizedSha256:recordSha256(unauthorized),authorityLimits:{numericalInitialization:'not-authorized' as const,
        schemaScripts:'not-authorized' as const,nativeInput:'not-authorized' as const,protectedExecution:'not-authorized' as const,
        tokenizer:'delimiter-partition-only-not-AST-effect-or-success-proof' as const},
      audit:{wholeSourceSha256:source.sourceSha256,currentRowsSha256:recordSha256(source.current.rows.map(row=>row.ref))}}
    const bound={...body,bindingSha256:recordSha256(bindingBody(body))}
    assertOwnerCurrent()
    captured.assertCurrent()
    if(!same(deps.readImportRecord(source.sourceRecordSessionId,record.importId),record))fail('PROGRAM_SOURCE_CHANGED','/importRecord')
    const data=validatePromptProgramSourceInventoryV1({...bound,inventorySha256:recordSha256(bound)}),
      importRecordSha256=source.original.importRecordRef.sha256
    const assertCurrent=()=>{
      assertReaderOwners();assertOwnerCurrent()
      // The producer's closure re-reads complete current rows, membership,
      // bindings and the edit namespace. Frozen ancestry keeps its full path.
      // Only the already validated deterministic text/compile result is reused.
      captured.assertCurrent()
      if(recordSha256(deps.readImportRecord(source.sourceRecordSessionId,record.importId))!==importRecordSha256) {
        fail('PROGRAM_SOURCE_CHANGED','/importRecord')
      }
      assertReaderOwners();assertOwnerCurrent()
    }
    assertCurrent()
    saveCapture?.(data,{source,wholeSha256:recordSha256(data),inventorySha256:data.inventorySha256,assertCurrent})
    return data
  }
  function capture(sessionId:string,includeCardStyle:boolean,assertOwnerCurrent:()=>void):PromptProgramSourceCaptureV1 {
    try {
      const data=read(sessionId,includeCardStyle,assertOwnerCurrent,(owned,currency)=>captures.set(owned,currency)),
        live=captures.get(data)
      if(!live)fail('PROGRAM_SOURCE_UNAVAILABLE','/capture')
      return {kind:'captured-program-source',data,assertCurrent:live.assertCurrent}
    }catch(error) {
      const diagnostic=error instanceof ProgramSourceFailure?{code:error.code,pointer:error.pointer}
        :error instanceof PromptTemplateOnlyRefusalV1?{code:'PROGRAM_CURRENT_ORIGIN_UNAVAILABLE' as const,pointer:error.pointer}
          :{code:'PROGRAM_SOURCE_UNAVAILABLE' as const,pointer:'/source'}
      return freeze({kind:'refused',authority:'none',diagnostics:[diagnostic]})
    }
  }
  function current(input:unknown,assertOwnerCurrent:()=>void):boolean {
    try {
      const saved=validatePromptProgramSourceInventoryV1(input)
      return read(saved.sessionId,saved.includeCardStyle,assertOwnerCurrent).bindingSha256===saved.bindingSha256
    }catch{return false}
  }
  /** Same actual capture supplies Opening's Source without a second capture or
   * detached JSON reconstruction. The extra Source remains consumer data. */
  function captureWithCurrentSource(sessionId:string,includeCardStyle:boolean,assertOwnerCurrent:()=>void) {
    const captured=capture(sessionId,includeCardStyle,assertOwnerCurrent)
    if(captured.kind!=='captured-program-source')return captured
    const live=captures.get(captured.data)
    if(!live)fail('PROGRAM_SOURCE_UNAVAILABLE','/capture')
    return {...captured,source:live.source}
  }
  function currentCaptured(input:unknown,assertActualOwnerCurrent:()=>void):boolean {
    try {
      assertActualOwnerCurrent()
      const live=input&&typeof input==='object'?captures.get(input as PromptProgramSourceInventoryV1):undefined
      if(!live)return current(input,assertActualOwnerCurrent)
      // Exact producer-created deep-frozen identity proves which complete
      // initial validation this closure belongs to. Clones cannot hit this map.
      // Rehashing this immutable large output would add no live input evidence.
      if(closed||!Object.isFrozen(input)
        ||(input as PromptProgramSourceInventoryV1).inventorySha256!==live.inventorySha256) {
        fail('PROGRAM_SOURCE_CHANGED','/capture')
      }
      live.assertCurrent();assertActualOwnerCurrent();return true
    }catch{return false}
  }
  function dispose():void {closed=true;captures=new WeakMap()}
  return {capture,current,captureWithCurrentSource,currentCaptured,dispose}
}
