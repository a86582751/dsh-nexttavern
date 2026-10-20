/** Freeze portable author DATA, never old import/job/Native execution rights. */
import {keyOf,cloneRecord,recordSha256} from './roleplay-data.js'
import {compileTavernOpeningCandidates} from './tavern-card.js'
import type {DecodedTavernCard} from './tavern-card.js'
import {readStructuredImportDataV1,spanText} from './roleplay-import-record.js'
import {portableNextTavernAuthorFields,isNextTavernCardDocument,nextTavernCardSourceIdV1,
  NEXTTAVERN_ST_MACRO_FIELDS,isNativeTavernCardDocument,readNativeNextTavernAuthorExtensionV1,
  readTavernCardArchiveV1,mergeNativeTavernCardExportV1,nextTavernExecutionAuthorData} from './nexttavern-card.js'
import {materializeTavernLoreEntryFieldsV1} from './tavern-lore-compiler.mjs'
import type {NextTavernCardDocument,NextTavernCardData,NextTavernAuthorRow,
  NextTavernCardExportDocument} from './nexttavern-card.js'
import type {TavernLoreSourceCaptureV1} from './roleplay-tavern-lore-source-types.js'
import {readCapturedTavernCoverV1} from './roleplay-tavern-lore-source.js'
import type {createRoleplayTavernLoreEditsV1} from './roleplay-tavern-lore-edits.js'
import type {NativeCardOpeningExportReadV1} from './roleplay-card-export-opening.js'
import type {ImportRecord,ImportPointer} from './roleplay-import-types.js'

interface Table {get(key:string):unknown;entries():Iterable<[string,unknown]>}
interface AuthorDataDependencies {
  readonly tables:Record<'cards'|'worldbook'|'rules'|'status'|'opening'|'branch',Table>
  readonly source:{capture(id:string):TavernLoreSourceCaptureV1}
  readonly edits:Pick<ReturnType<typeof createRoleplayTavernLoreEditsV1>,'observeJournalDataWithLegacyData'>
}
interface Dependencies extends AuthorDataDependencies {
  readonly readOpening:(capture:TavernLoreSourceCaptureV1)=>NativeCardOpeningExportReadV1
  readonly readTransport:(record:ImportRecord)=>NextTavernCardExportDocument
}
export interface NativeCardAuthorCoordinateV1 {
  table:'cards'|'worldbook'|'rules'
  key:string
  field:string
  pointer:string
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const authorFields=(value:unknown)=>object(value)?portableNextTavernAuthorFields(value):{}
/** Import adds runtime defaults around portable fields. Equal implicit defaults
 * are not new author input; explicit fields and real edits stay in the export. */
function preserveNativeAuthorPresence(fields:Record<string,unknown>,original:Record<string,unknown>,
  defaults:Record<string,unknown>) {
  for(const [field,value] of Object.entries(defaults))if(!Object.hasOwn(original,field)
    &&Object.hasOwn(fields,field)&&recordSha256(fields[field])===recordSha256(value))delete fields[field]
  return fields
}
const stRuleFields=[['core','scenario','core-setting'],['style','mes_example','rule-style'],
  ['narrative','system_prompt','rule-narrative'],['reply','post_history_instructions','rule-reply']] as const
function extraAuthorData(data:Readonly<Record<string,unknown>>,avatarBase64?:string) {
  const extra=cloneRecord(data) as Record<string,unknown>
  for(const field of ['name','description','personality','scenario','mes_example','system_prompt',
    'post_history_instructions','first_mes','alternate_greetings','character_book','cards','worldbook',
    'rules','status','opening','settings'])delete extra[field]
  // The PNG container is no longer present after portable JSON conversion.
  // Its metadata-free cover joins the same asset list used by media owners.
  if(avatarBase64)extra.assets=[...((extra.assets as unknown[]|undefined)??[]),
    {type:'icon',name:'avatar',purpose:'card-cover',uri:'data:image/png;base64,'+avatarBase64,ext:'png'}]
  return extra
}
const stMacroFields=(data:Readonly<Record<string,unknown>>)=>Object.fromEntries(
  NEXTTAVERN_ST_MACRO_FIELDS.filter(field=>typeof data[field]==='string').map(field=>[field,data[field] as string]))

/** Pristine community-source projection uses the same field ownership as
 * current export. Each author field keeps its physical bytes and grouping;
 * the runtime's edit/journal composition remains with the capture below. */
export function projectTavernCardAuthorDataV1(decoded:DecodedTavernCard):NextTavernCardData {
  const source=decoded.data,extra=extraAuthorData(source,decoded.avatarBase64),rules:NextTavernCardData['rules']={}
  for(const [rule,field] of stRuleFields)if(typeof source[field]==='string')rules[rule]=source[field]
  const cards:NextTavernAuthorRow[]=[]
  for(const field of ['description','personality'] as const)if(typeof source[field]==='string') {
    cards.push({name:source.name,kind:'npc',sourceField:field,content:source[field]})
  }
  // Native text owns opening zero; catalog contains only alternate openings.
  const catalog=compileTavernOpeningCandidates(decoded).filter(candidate=>candidate.index>0).map(candidate=>({label:candidate.label,
    rawText:candidate.rawText,sourcePointer:candidate.sourcePointer}))
  return {...extra,name:source.name,cards,worldbook:[],rules,
    compatibility:{...object(extra.compatibility)?extra.compatibility:{},sillytavernMacroFields:stMacroFields(source)},
    ...source.character_book!==undefined?{character_book:cloneRecord(source.character_book) as NextTavernCardData['character_book']}:{},
    ...source.first_mes!==undefined||catalog.length?{opening:{text:String(source.first_mes??''),
      materialization:'template',catalog}}:{}}
}

/** Current author DATA has one composition owner. Media discovery uses this
 * read without export transport, archive traversal or selected-opening rights. */
export function captureNextTavernAuthorDataV1(deps:AuthorDataDependencies,id:string) {
  const {tables:T}=deps,prefix=id+'__',captured=deps.source.capture(id)
  if(captured.kind==='refused')throw Error(captured.diagnostics[0]?.code??'CARD_EXPORT_SOURCE_FAILED')
  if(captured.kind==='outside-declared-domain'
    &&!['ACTIVE_SOURCE_MISSING','LEGACY_SOURCE_OUTSIDE_DOMAIN','MERGE_PROVENANCE_UNPROVEN'].includes(captured.code))throw Error(captured.code)
  const pointer=T.branch.get(keyOf(id,'import-active')) as ImportPointer|undefined
  const original=pointer?.importId?T.branch.get(keyOf(pointer.sourceRecordSessionId??id,'import-'+pointer.importId)) as ImportRecord:undefined
  const decoded=captured.kind==='captured-data'?captured.contributionInput.rawDecoded:original?.sourceEnvelope
    ?readStructuredImportDataV1(original).decoded:undefined
  const native=decoded&&isNextTavernCardDocument(decoded.document)?decoded.document:undefined
  const preserved=native?.data.compatibility?.authorExecution
  // Keep open author fields in DATA while runtime text has one canonical home.
  const extra=extraAuthorData(decoded?.data??{},readCapturedTavernCoverV1(captured)?.base64??decoded?.avatarBase64)
  const authorCoordinates:NativeCardAuthorCoordinateV1[]=[]
  const skip=new Set<string>()
  let book=cloneRecord(decoded?.data.character_book) as NextTavernCardData['character_book']
  const ruleRow=T.rules.get(keyOf(id,'spec')) as Record<string,unknown>|undefined
  let rules=authorFields(ruleRow)
  const editedRuleFields=(ruleRow?.editedFrom as {ruleFields?:string[]}|undefined)?.ruleFields??[]
  let journalDataSha256:string|undefined
  if(captured.kind==='captured-data') {
    const {observed,legacy}=deps.edits.observeJournalDataWithLegacyData(captured,{suppressBookConstants:true})
    if(observed.kind==='refused')throw Error(observed.diagnostics[0]?.detail??observed.diagnostics[0]?.code)
    journalDataSha256=observed.data.dataSha256
    rules.core=legacy!.contributions.coreData.text
    if(legacy!.contributions.coreData.kind==='legacy-edited-unsplit')rules.coreOrigin='legacy-edited-unsplit'
    if(!native&&decoded&&original) {
      // Legacy spans include normalized line separators. Unchanged ST fields
      // retain their physical author bytes in portable DATA; current edits keep
      // their literal text. Explicit core ownership also preserves same-value edits.
      if(legacy!.contributions.coreData.kind==='legacy-projection')rules.core=String(decoded.data.scenario??'')
      for(const [rule,field,target] of stRuleFields) {
        if(rule==='core')continue // Core's independent/legacy ownership was settled above.
        const spans=original.assignments.filter(assignment=>assignment.target===target)
          .flatMap(assignment=>assignment.sourceSpans).sort((left,right)=>left.startLine-right.startLine)
        if(!editedRuleFields.includes(rule)&&rules[rule]===spanText(original,spans))rules[rule]=String(decoded.data[field]??'')
      }
    }
    for(const key of legacy!.linkedRowKeys)skip.add(key)
    if(observed.data.currentNativeMembership) {
      // Current order/membership comes from the published journal. Original
      // object keys and removed entries remain in the complete inert archive.
      const entries=observed.data.currentNativeMembership.members.map(member=>{
        const entry=materializeTavernLoreEntryFieldsV1(member.rawEntry,{displayIndex:member.displayIndex})
        // Helper's numeric UID may project a retained textual native id. The
        // Native document keeps that author metadata; only missing ids use UID.
        if(!Object.hasOwn(entry,'id'))entry.id=member.uid
        return entry
      })
      book={...book??{},entries}
    }else if(book) {
      const edits=new Map(observed.data.overlay.entries.map(entry=>[entry.rawEntryPointer,entry.fields]))
      const source=captured.source.original.primary
      if(source.binding==='primary')for(const entry of source.entries) {
        const fields=edits.get(entry.ref.entryPointer)
        if(fields)(book.entries as Record<string,unknown>)[entry.entryKey]=
          materializeTavernLoreEntryFieldsV1(entry.value as Record<string,unknown>,fields)
      }
    }
  }
  const cardId=native?nextTavernCardSourceIdV1(native):undefined
  const rows=(table:Table,target:'card'|'worldbook')=>{
    // DATA includes empty bodies, which have no source-span assignment. User
    // cards use their one actual runtime key rather than the generated ordinal.
    const originalRows=native?nextTavernExecutionAuthorData(native.data)[target==='card'?'cards':'worldbook']:[]
    const ranks=new Map(originalRows.map((row,index)=>[
      keyOf(id,target==='card'&&row.kind==='user'?'user':`${cardId}-${target}-${index}`),index]))
    return [...table.entries()].filter(([key,value])=>key.startsWith(prefix)&&object(value)&&!skip.has(key))
      .sort(([left],[right])=>{
        const a=ranks.get(left),b=ranks.get(right)
        if(a!==undefined&&b!==undefined)return a-b
        if(a!==undefined)return -1
        if(b!==undefined)return 1
        return left.localeCompare(right,'en')
      }).map(([key,value],index)=>{
        authorCoordinates.push({table:target==='card'?'cards':'worldbook',key,field:'content',
          pointer:target==='card'?`/data/compatibility/authorExecution/cards/${index}/content`
            :`/data/worldbook/${index}/content`})
        const fields=authorFields(value),rank=ranks.get(key),original=rank===undefined?undefined:originalRows[rank]
        if(original)preserveNativeAuthorPresence(fields,original,{
          name:original.content?native!.data.name:key.slice(prefix.length),
          kind:target==='card'?'npc':'term',locked:false,
          ...target==='worldbook'?{aliases:[],keywords:[],triggers:[],priority:0,tokenBudget:400,alwaysOn:false}:{},
        })
        return fields as NextTavernAuthorRow
      })
  }
  const cards=rows(T.cards,'card'),worldbook=rows(T.worldbook,'worldbook')
  if(native)rules=preserveNativeAuthorPresence(rules,nextTavernExecutionAuthorData(native.data).rules,{
    core:'',plot:'',narrative:'',reply:'',style:'',beauty:{regexRules:[],css:'',js:''},
  })
  for(const field of ['core','plot','narrative','reply','style'] as const)if(rules[field]!==undefined) {
    authorCoordinates.push({table:'rules',key:keyOf(id,'spec'),field,
      pointer:`/data/compatibility/authorExecution/rules/${field}`})
  }
  const currentOpening=T.opening.get(keyOf(id,'scene'))??native?.data.opening
  // Community imports materialize only the active scene into the table. The
  // other authored greetings still belong to the live Source media catalog.
  const authorOpening=!native&&decoded?{...authorFields(currentOpening),
    text:object(currentOpening)?String(currentOpening.text??''):String(decoded.data.first_mes??''),
    catalog:compileTavernOpeningCandidates(decoded).filter(candidate=>candidate.index>0)
      .map(candidate=>({label:candidate.label,rawText:candidate.rawText,sourcePointer:candidate.sourcePointer}))}
    :currentOpening
  const data:NextTavernCardData={...extra,name:native?native.data.name
    :String(cards.find(card=>card.kind!=='user')?.name??decoded?.data.name??'角色卡'),
    ...!native&&decoded?{compatibility:{...object(extra.compatibility)?extra.compatibility:{},
      sillytavernMacroFields:stMacroFields(decoded.data)}}:{},
    cards,worldbook,rules,...book!==undefined?{character_book:book}:{},
    ...authorOpening!==undefined?{opening:authorFields(authorOpening) as {text:string}}:{},
    ...T.status.get(keyOf(id,'spec'))!==undefined?{status:authorFields(T.status.get(keyOf(id,'spec'))) as {text:string}}:{},
    ...T.branch.get(keyOf(id,'settings'))!==undefined
      ?{settings:authorFields(T.branch.get(keyOf(id,'settings')))}:{}}
  if(preserved) {
    // Runtime tables and their editors own execution prose. Classification is a
    // separate view: an edit invalidates its source hash instead of silently
    // replacing a character's classified text with the combined author body.
    data.compatibility={...data.compatibility,authorExecution:{...cloneRecord(preserved),cards,rules}}
    data.cards=cloneRecord(native!.data.cards)
    data.rules=cloneRecord(native!.data.rules)
  }
  // Source and journal already seal author edits, so reuse their small identity
  // tuple. Legacy 1.1 captures lack that seal; their current author DATA supplies
  // the identity needed to expire a classification after execution edits.
  const sourceHash=captured.kind==='captured-data'
    ?recordSha256([captured.currentIdentitySha256,journalDataSha256])
    :preserved?recordSha256(data):undefined
  return {captured,original,decoded,native,data,sourceHash,authorCoordinates}
}

function captureCurrentDocument(deps:Dependencies,id:string) {
  const {tables:T}=deps,prefix=id+'__'
  const {captured,original,decoded,native,data:authorData}=captureNextTavernAuthorDataV1(deps,id)
  const transport=original?.sourceEnvelope?.schemaVersion===2?deps.readTransport(original):decoded?.document
  const selected=deps.readOpening(captured)
  if(selected.kind==='blocked')throw Error(selected.code)
  const scene=T.opening.get(keyOf(id,'scene'))
  const candidates=decoded?compileTavernOpeningCandidates(decoded):undefined
  const nativeCatalog=native?.data.opening?.catalog as {rawText:string;label?:string;[key:string]:unknown}[]|undefined
  let catalog=nativeCatalog!==undefined
    ?cloneRecord(nativeCatalog)
    :candidates?candidates.filter(candidate=>candidate.index>0).map(candidate=>({label:candidate.label,
      rawText:candidate.rawText,sourcePointer:candidate.sourcePointer})):undefined
  let selectedAuthorOpening:ReturnType<typeof compileTavernOpeningCandidates>[number]|undefined
  let currentTemplate=String(object(scene)
    ?scene.text??native?.data.opening?.text??'':native?.data.opening?.text??'')
  if(!native&&decoded&&original&&object(scene)&&scene.importId===original.importId) {
    const spans=original.assignments.filter(assignment=>assignment.target==='opening')
      .flatMap(assignment=>assignment.sourceSpans).sort((left,right)=>left.startLine-right.startLine)
    // The unselected scene is an import projection; portable templates retain
    // their author bytes rather than normalized assignment separators.
    if(currentTemplate===spanText(original,spans))currentTemplate=String(decoded.data.first_mes??'')
  }
  // Retain all other author choices by identity:
  // two deliberately identical options are still two different choices. A
  // later author edit must not be removed as though it were the old selection.
  if(selected.kind==='ready'&&candidates) {
    const choice=selected.source.selected as {index:number;sourcePointer:string;sourceSha256:string}
    const chosen=candidates.find(candidate=>candidate.index===choice.index
      &&candidate.sourcePointer===choice.sourcePointer&&candidate.sourceSha256===choice.sourceSha256)
    catalog=candidates.filter(candidate=>candidate!==chosen)
      .map(candidate=>native&&candidate.index>0?cloneRecord(nativeCatalog![candidate.index-1]!)
        :{label:candidate.label,rawText:candidate.rawText,sourcePointer:candidate.sourcePointer})
    // An unchanged author copy still owns its template and initialization.
    // Edited or generated prose owns only its displayed bytes. The opening
    // read already supplies both hashes from the actual Native message.
    if(selected.source.production==='selected-card-copy'
      &&selected.source.currentTextSha256===selected.source.originalTextSha256)selectedAuthorOpening=chosen
  }
  const openingText=selected.kind==='ready'?selectedAuthorOpening?.rawText??selected.text:currentTemplate
  const materialization=selectedAuthorOpening?selectedAuthorOpening.materialization??'template'
    :selected.kind==='ready'?'materialized':native?.data.opening?.materialization
      ??(object(scene)?scene.materialization:undefined)??'template'
  const opening=scene===undefined&&selected.kind==='none'?undefined:{...authorFields(scene),
    text:openingText,materialization,
    ...(catalog!==undefined?{catalog}:{}),
    ...(selected.kind==='ready'?{selection:{production:selected.source.production,
      authorSelection:cloneRecord(selected.source.selected)}}:{})}
  const {opening:_authorOpening,status,settings,...base}=authorData
  const data:NextTavernCardData={...base,...status!==undefined?{status}:{},
    ...opening?{opening}:{},...settings!==undefined?{settings}:{}}
  const archive=cloneRecord(native&&transport?readTavernCardArchiveV1(transport):native?.archive??{})
  const documents:unknown[]=cloneRecord(archive.documents??[]),classifiedSources:unknown[]=cloneRecord(archive.classifiedSources??[])
  const records=new Map<string,ImportRecord>(original?[[original.importId,original]]:[])
  const collectSources=(value:unknown):void=>{
    if(Array.isArray(value)){for(const item of value)collectSources(item);return}
    if(!object(value))return
    if(typeof value.importId==='string'&&typeof value.normalizedSourceSha256==='string') {
      const record=records.get(value.importId)??[...T.branch.entries()]
        .find(([key,record])=>key.endsWith('__import-'+value.importId)
          &&(record as ImportRecord)?.normalizedSha256===value.normalizedSourceSha256)?.[1] as ImportRecord|undefined
      if(!record)throw Error('CARD_EXPORT_ARCHIVE_SOURCE_MISSING')
      records.set(record.importId,record)
    }
    for(const item of Object.values(value))collectSources(item)
  }
  for(const table of [T.cards,T.worldbook,T.rules,T.status,T.opening])for(const [key,value] of table.entries())
    if(key.startsWith(prefix)&&object(value))collectSources(value.sources)
  for(const record of records.values()) {
    if(record.sourceEnvelope) {
      const document=record===original&&transport?transport:record.sourceEnvelope.schemaVersion===2
        ?deps.readTransport(record):readStructuredImportDataV1(record).decoded.document
      // Historical native sources retain one complete inert document, including
      // open archive metadata. The current native archive remains authoritative;
      // reimporting this single export therefore does not add another wrapper.
      if(record!==original||!isNextTavernCardDocument(document)&&!readNativeNextTavernAuthorExtensionV1(document)) {
        documents.push({document,source:{extension:record.sourceEnvelope.extension,
          format:record.sourceEnvelope.schemaVersion===2&&isNativeTavernCardDocument(document)
            ?document.spec==='chara_card_v2'?'json-v2':'json-v3':record.sourceEnvelope.format,
          sha256:record.rawSha256}})
      }
    }else classifiedSources.push({normalizer:record.normalizer,rawSource:record.rawSource,
      normalizedSource:record.normalizedSource,assignments:record.assignments.map(assignment=>{
        const {materializedSha256:_materialized,...portable}=assignment
        return portable
      })})
  }
  const unique=(values:unknown[])=>[...new Map(values.map(value=>[recordSha256(value),value])).values()]
  const document:NextTavernCardDocument={...native??{},spec:'nexttavern_card',spec_version:native?.spec_version??'1.0',data,
    archive:{...archive,...documents.length||archive.documents!==undefined?{documents:unique(documents)}:{},
      ...classifiedSources.length||archive.classifiedSources!==undefined?{classifiedSources:unique(classifiedSources)}:{}}}
  return {document,transport}
}

/** Shared current-author document capture for manual conversion and export.
 * It reads only: it does not classify, activate, create jobs or write tables. */
export function captureNextTavernCardDocumentV1(deps:Dependencies,id:string):NextTavernCardDocument {
  return captureCurrentDocument(deps,id).document
}

/** Preserve the existing transport-format wrapper for established exporters. */
export function captureNextTavernCardExportV1(deps:Dependencies,id:string):NextTavernCardExportDocument {
  const {document,transport}=captureCurrentDocument(deps,id)
  return isNativeTavernCardDocument(transport)?mergeNativeTavernCardExportV1(transport,document):document
}
