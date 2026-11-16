/** Pure identity rendering, prompt syntax coverage and original initialization
 * declarations. The shared Host owner owns initialization parsing and values. */
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {assertMvuLiteralSourceTextV1,assertMvuNonSchemaSourceExtensionsV1} from './roleplay-mvu-source.js'
import {spanText,sourceDescriptor} from './roleplay-import-record.js'
import {partitionPromptTemplateOnlyTextV1,PromptTemplateOnlyRefusalV1} from './roleplay-prompt-template-only-data.js'
import type {DecodedTavernCard,TavernOpeningContext,TavernOpeningCandidate} from './tavern-card.js'
import type {ImportRecord} from './roleplay-import-types.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {PromptProgramSourceInventoryV2,PromptProgramTextV1} from './roleplay-prompt-program-source-types.js'
import type {PromptOpeningSourceCodeV1,PromptOpeningIdentityRenderingV1,PromptOpeningGreetingBlockV1,
  PromptOpeningGreetingFactsV1,PromptOpeningRawEntryBindingV1,PromptOpeningRawInitBindingV1,
  PromptOpeningInitializationV1} from './roleplay-prompt-opening-source-types.js'

export const PROMPT_OPENING_SOURCE_POLICY_V1=Object.freeze({schemaVersion:1,
  encoding:'native-prompt-opening-source-policy-v1',source:'actual-own-root-or-committed-reserved-fresh-cut0',
  prompt:'six-author-fields-and-actual-recomputed-book-content; protected-selection-and-renderer-separate',
  identityRendering:'only-actual-three-identity-macros-v1; user,char,user_gender; complete-source-bytes',
  numeric:'shared-Host-owner-only; original-declarations-carry-no-values',
  initialization:'immutable-original-declaration-provenance; actual-effective-initSource-owned-by-shared-Host',
  schemaExecution:'none',sourceCurrent:'sole-actual-Source-current-identity; full-audit-refs-retained',
  modelRequests:0,proofBytes:16_777_216,greetings:4096,entries:4096})
export const PROMPT_OPENING_SOURCE_POLICY_SHA256=recordSha256(PROMPT_OPENING_SOURCE_POLICY_V1)
export const NEXTTAVERN_PROMPT_OPENING_SOURCE_POLICY_V1=Object.freeze({...PROMPT_OPENING_SOURCE_POLICY_V1,
  encoding:'native-nexttavern-prompt-opening-source-policy-v1',
  prompt:'canonical-exact-author-fields-and-actual-recomputed-book-content; archive-and-open-metadata-inert',
  identityRendering:'template-three-identity-macros-or-exact-materialized-prose-copy-v1',
  initialization:'immutable-raw-book-init-entries-and-template-greetings; materialized-prose-never-initializes'})
export const NEXTTAVERN_PROMPT_OPENING_SOURCE_POLICY_SHA256=recordSha256(NEXTTAVERN_PROMPT_OPENING_SOURCE_POLICY_V1)
export class PromptOpeningSourceFailureV1 extends Error {
  constructor(readonly code:PromptOpeningSourceCodeV1,readonly pointer:string) {super(code)}
}
export function openingSourceFail(code:PromptOpeningSourceCodeV1,pointer:string):never {
  throw new PromptOpeningSourceFailureV1(code,pointer)
}
export function clonePromptOpeningSourceDataV1<T>(value:T):T {
  try {return cloneRoleplayTavernLoreDataV1(value,PROMPT_OPENING_SOURCE_POLICY_V1.proofBytes)}
  catch {return openingSourceFail('OPENING_SOURCE_BUDGET','/source')}
}
export function freezePromptOpeningSourceDataV1<T>(value:T):T {
  if(value&&typeof value==='object') {
    for(const child of Object.values(value))freezePromptOpeningSourceDataV1(child)
    Object.freeze(value)
  }
  return value
}
export function openingSourceObject(value:unknown):value is Record<string,unknown> {
  return value!==null&&typeof value==='object'&&!Array.isArray(value)
}
export function promptOpeningInitializationInputBindingV1(program:PromptProgramSourceInventoryV2,
  bindings:PromptOpeningRawInitBindingV1):string {
  return recordSha256({encoding:'immutable-raw-opening-init-input-binding-v1',importTuple:program.importTuple,
    bindings:{...bindings,
      rawEntries:bindings.rawEntries.map(({effectivePromptContentSha256:_,...entry})=>{
        // Current entry identities can change when a legacy book first gains
        // journal membership. Immutable initialization follows the raw entry.
        const {entryId:__,...original}=entry
        return original
      })}})
}
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const escape=(key:string)=>key.replace(/~/g,'~0').replace(/\//g,'~1')
const initSyntax=(text:string)=>/\[initvar\]|<\/?initvar\b/i.test(text)
/** A declared opening data position permits InitVar wrappers only.
 * This separate guard does not weaken the old Source/classifier or EJS rules. */
function rawDataSyntax(text:string,pointer:string):void {
  if(/<script\b|<%|%>|\bon[a-z]+\s*=|javascript:|<iframe\b/i.test(text)
    ||/\b(?:registerMvuSchema|getAllVariables|updateVariables|replaceVariables|insertOrAssignVariables)\s*\(/i.test(text)
    ||/\b(?:eval|Function|fetch|import|require)\s*\(/i.test(text)
    ||/<\/?(?:updatevariable|variableupdate|mvu-update|updatevar|jsonpatch)\b/i.test(text)
    ||/\b_\.(?:get|set|merge|assign|unset|add|delete|remove)\s*\(/i.test(text)
    ||/\b(?:stat_data|mvu_data)\s*(?:[.\[=]|\()/i.test(text)
    ||/\{\{\s*(?:getvar|setvar|addvar|incvar|decvar|run|eval|execute|script)\b/i.test(text)
    ||/\$(?:meta|schema|template|required|default)\b|VARIABLE_(?:INIT|UPDATE)|MVU_(?:INIT|UPDATE)/.test(text)) {
    openingSourceFail('OPENING_SOURCE_STATE_SYNTAX_UNSUPPORTED',pointer)
  }
}
function literal(text:string,context:TavernOpeningContext,pointer:string):void {
  try {assertMvuLiteralSourceTextV1(text,context,pointer)}
  catch {return openingSourceFail(initSyntax(text)?'OPENING_SOURCE_INITVAR_OUTSIDE_BINDING'
    :'OPENING_SOURCE_STATE_SYNTAX_UNSUPPORTED',pointer)}
}
function programText(text:PromptProgramTextV1|string,pointer:string):void {
  const body=typeof text==='string'?text:text.text
  let segments:ReturnType<typeof partitionPromptTemplateOnlyTextV1>
  if(typeof text==='string') {
    // Deleted originals still occur in immutable import projections. Partition
    // their archive text without inventing a current compiler entry identity.
    try {segments=partitionPromptTemplateOnlyTextV1(text,pointer)}
    catch(error) {
      if(!(error instanceof PromptTemplateOnlyRefusalV1))throw error
      return openingSourceFail('OPENING_SOURCE_CURRENT_ORIGIN_UNAVAILABLE',pointer)
    }
  }else {
    if(text.tokenization!=='complete-UTF16-partition'||!text.segments) {
      openingSourceFail('OPENING_SOURCE_CURRENT_ORIGIN_UNAVAILABLE',pointer)
    }
    segments=text.segments
  }
  for(const segment of segments)if(segment.kind==='literal') {
    const part=body.slice(segment.start,segment.end)
    if(initSyntax(part))openingSourceFail('OPENING_SOURCE_INITVAR_OUTSIDE_BINDING',pointer)
    rawDataSyntax(part,pointer)
  }
  // Prompt macros belong to the actual frozen macro owner. The old literal
  // identity renderer remains responsible for greetings and unknown metadata.
  // The other spans are inventory only. Root supplies the actual protected
  // renderer and its readonly variable/helper permissions; no JS is evaluated.
}
export function readPromptOpeningGreetingBlocksV1(text:string,pointer:string):readonly PromptOpeningGreetingBlockV1[] {
  const result:PromptOpeningGreetingBlockV1[]=[],tags=/<\/?initvar>/gi
  let open:{start:number;bodyStart:number}|null=null,covered=0
  for(let match=tags.exec(text);match;match=tags.exec(text)) {
    if(/<\/?initvar\b/i.test(text.slice(covered,match.index))) {
      openingSourceFail('OPENING_SOURCE_INITVAR_WRAPPER_UNSUPPORTED',pointer)
    }
    covered=match.index+match[0].length
    if(match[0][1]!=='/') {
      if(open)openingSourceFail('OPENING_SOURCE_INITVAR_WRAPPER_UNSUPPORTED',pointer)
      open={start:match.index,bodyStart:covered}
    }else {
      if(!open)openingSourceFail('OPENING_SOURCE_INITVAR_WRAPPER_UNSUPPORTED',pointer)
      result.push({start:open.start,end:covered,bodyStart:open.bodyStart,bodyEnd:match.index,
        rawWrapperSha256:sha256(text.slice(open.start,covered)),bodySha256:sha256(text.slice(open.bodyStart,match.index))})
      open=null
    }
  }
  if(open||/<\/?initvar\b/i.test(text.slice(covered))||result.length>PROMPT_OPENING_SOURCE_POLICY_V1.greetings) {
    openingSourceFail('OPENING_SOURCE_INITVAR_WRAPPER_UNSUPPORTED',pointer)
  }
  if(/\[initvar\]/i.test(text))openingSourceFail('OPENING_SOURCE_INITVAR_OUTSIDE_BINDING',pointer)
  return result
}
/** This scanner handles only exact identity names. It is distinct from the
 * full prompt macro engine and never evaluates a program or supplies defaults. */
export function renderPromptOpeningIdentityV1(text:string,context:TavernOpeningContext,pointer:string,
  dataRanges:readonly {start:number;end:number}[]=[]) {
  let cursor=0,rendered=''
  const reads:PromptOpeningIdentityRenderingV1['reads'][number][]=[],ownedClosers=new Set<number>()
  while(cursor<text.length) {
    const start=text.indexOf('{{',cursor)
    if(start<0){rendered+=text.slice(cursor);break}
    const end=text.indexOf('}}',start+2),name=end<0?'':text.slice(start+2,end)
    if(end<0||!['user','char','user_gender'].includes(name)||text[start-1]==='{'||text[end+2]==='}') {
      openingSourceFail('OPENING_SOURCE_MACRO_UNSUPPORTED',pointer)
    }
    const value=context[name as keyof TavernOpeningContext]
    if(typeof value!=='string'||!value||value.length>512||value.includes('{{')) {
      openingSourceFail('OPENING_SOURCE_MACRO_UNSUPPORTED',pointer)
    }
    rendered+=text.slice(cursor,start)+value
    reads.push({name:name as 'user'|'char'|'user_gender',start,end:end+2,
      tokenSha256:sha256(text.slice(start,end+2)),valueSha256:sha256(value)})
    ownedClosers.add(end);cursor=end+2
  }
  for(let at=text.indexOf('}}');at>=0;at=text.indexOf('}}',at+2)) {
    if(!ownedClosers.has(at)&&!dataRanges.some(range=>at>=range.start&&at+2<=range.end)) {
      openingSourceFail('OPENING_SOURCE_MACRO_UNSUPPORTED',pointer)
    }
  }
  const facts:PromptOpeningIdentityRenderingV1={policy:'only-actual-three-identity-macros-v1',
    rawSha256:sha256(text),renderedSha256:sha256(rendered),used:reads.length>0,reads,readsSha256:recordSha256(reads)}
  return {text:rendered,facts}
}

/** A delivered opening is prose. Its syntax has no new macro or InitVar authority. */
export function readPromptOpeningGreetingFactsV1(candidate:TavernOpeningCandidate,context:TavernOpeningContext):PromptOpeningGreetingFactsV1 {
  const materialized=candidate.materialization==='materialized',text=candidate.rawText,pointer=candidate.sourcePointer
  if(!materialized)rawDataSyntax(text,pointer)
  const blocks=materialized?[]:readPromptOpeningGreetingBlocksV1(text,pointer)
  const rendered=materialized?{text,facts:{policy:'copy-materialized-opening-v1' as const,
    rawSha256:sha256(text),renderedSha256:sha256(text),used:false,reads:[],readsSha256:recordSha256([])}}
    :renderPromptOpeningIdentityV1(text,context,pointer,blocks.map(block=>({start:block.bodyStart,end:block.bodyEnd})))
  if(rendered.text!==candidate.renderedText||candidate.sourceSha256!==sha256(text)) {
    openingSourceFail('OPENING_SOURCE_MACRO_UNSUPPORTED',pointer)
  }
  if(!materialized)rawDataSyntax(rendered.text,pointer+'/rendered')
  const expanded=materialized?[]:readPromptOpeningGreetingBlocksV1(rendered.text,pointer+'/rendered')
  if(blocks.length!==expanded.length)openingSourceFail('OPENING_SOURCE_INITVAR_WRAPPER_UNSUPPORTED',pointer)
  return {index:candidate.index,sourcePointer:pointer,sourceSha256:candidate.sourceSha256,rawText:text,
    renderedText:rendered.text,renderedSha256:sha256(rendered.text),macros:candidate.macros,
    identityRendering:rendered.facts,originalInitBlocks:blocks,renderedInitBlocks:expanded,
    ...(candidate.materialization?{materialization:candidate.materialization}:{})}
}

/** Preserve original declarations independently of today's effective initSource. */
export function capturePromptOpeningDeclarationsV1(input:{source:TavernLoreSourceDataV1;
  program:PromptProgramSourceInventoryV2;candidates:readonly TavernOpeningCandidate[];
  context:TavernOpeningContext}):PromptOpeningInitializationV1 {
  const {source,program,candidates,context}=input,primary=source.original.primary
  const byEntry=new Map(program.bookEntries.map(entry=>[entry.originalAddress,entry] as const))
  const hasCurrentBooks=program.book.currentNativeMembershipSha256!==undefined||program.book.boundBooks!==undefined
  const rawEntries:PromptOpeningRawEntryBindingV1[]=[]
  let markerCount=0
  for(const raw of primary.entries) {
    const entry=byEntry.get(raw.ref.entryPointer),value=raw.value,pointer=raw.ref.entryPointer
    if(!hasCurrentBooks&&(!entry||!entry.original||entry.rawEntrySha256!==raw.ref.entrySha256)
      ||typeof value.content!=='string'||value.comment!==undefined&&typeof value.comment!=='string') {
      openingSourceFail('OPENING_SOURCE_IMPORT_UNPROVEN',pointer)
    }
    const comment=String(value.comment??''),isInitVar=comment.toLowerCase().includes('[initvar]')
    const enabled=value.enabled!==false&&value.disable!==true
    if(isInitVar)markerCount++
    else {
      programText(entry?.original??value.content,pointer+'/content')
      if(entry)programText(entry.effective,pointer+'/content/current')
    }
    rawEntries.push({ordinal:raw.ref.entryOrdinal,entryId:entry?.entryId??null,sourceKey:raw.entryKey,
      sourcePointer:pointer,rawEntrySha256:raw.ref.entrySha256,original:value,isInitVar,enabled,
      effectivePromptContentSha256:entry?.effective.textSha256??null})
  }
  // Current text keeps its own prompt origin. Original declarations remain
  // immutable provenance, while the shared Host captures effective initSource.
  for(const entry of program.bookEntries)if(entry.originalAddress===null) {
    programText(entry.effective,entry.contentPointer+'/current')
  }
  const greetingFacts=candidates.map(candidate=>readPromptOpeningGreetingFactsV1(candidate,context))
  markerCount+=greetingFacts.reduce((count,greeting)=>count+greeting.originalInitBlocks.length,0)
  const bindings:PromptOpeningRawInitBindingV1={domain:'immutable-raw-embedded-primary-and-complete-original-greetings',
    bookPresence:primary.binding==='primary'?'actual-primary-book':'actual-proven-book-absence',bookPointer:primary.bookPointer,
    rawBook:primary.value,rawBookSha256:primary.bookSha256,rawEntries,
    entryOrderSha256:recordSha256(rawEntries.map(entry=>({ordinal:entry.ordinal,pointer:entry.sourcePointer,
      rawEntrySha256:entry.rawEntrySha256,isInitVar:entry.isInitVar}))),
    bookInitEntryPointers:rawEntries.filter(entry=>entry.isInitVar).map(entry=>entry.sourcePointer),
    greetingFacts,greetingFactsSha256:recordSha256(greetingFacts),
    originalBookAbsence:primary.binding==='proven-absence'?primary.absenceProof:null,
    baselinePolicy:'original-declarations-only',otherBindings:'not-selected-for-execution',
    schemaExecution:'none'}
  const common={inputBindingSha256:promptOpeningInitializationInputBindingV1(program,bindings),bindings,
    schemaExecution:'none' as const,descriptorPolicy:'immutable-raw-initialization-declarations-v1' as const}
  return freezePromptOpeningSourceDataV1(clonePromptOpeningSourceDataV1(markerCount>0
    ?{...common,kind:'raw-init-data' as const,markerCount}
    :{...common,kind:'absent' as const,reason:'no-actual-initvar-markers' as const,markerCount:0 as const}))
}

export function inspectPromptOpeningWholeSourceV1(input:{source:TavernLoreSourceDataV1;decoded:DecodedTavernCard;
  record:ImportRecord;program:PromptProgramSourceInventoryV2;context:TavernOpeningContext;
  bindings:PromptOpeningRawInitBindingV1;schemaOpening?:boolean}) {
  const {source,decoded,record,program,context,bindings}=input,
    initByPointer=new Map(bindings.rawEntries.filter(entry=>entry.isInitVar).map(entry=>[entry.sourcePointer,entry] as const))
  const native=program.importTuple.format==='json-nexttavern-v1'
  const rawResources=new Set<string>(program.regexResources.map(resource=>resource.originalPointer))
  if(input.schemaOpening)rawResources.add('/data/extensions/tavern_helper')
  // These are the actual CC book fields read by the compiler's key owner.
  // They are matching/preprocessing input, never an InitVar declaration.
  for(const entry of bindings.rawEntries)if(!entry.isInitVar) {
    rawResources.add(entry.sourcePointer+'/keys')
    rawResources.add(entry.sourcePointer+'/secondary_keys')
  }
  const rawSpecial=new Set<string>(program.authorFields.map(field=>field.originalPointer))
  for(const entry of bindings.rawEntries)rawSpecial.add(entry.sourcePointer+'/content')
  for(const greeting of bindings.greetingFacts)rawSpecial.add(greeting.sourcePointer)
  for(const entry of bindings.rawEntries)if(entry.isInitVar)rawSpecial.add(entry.sourcePointer+'/comment')
  const walk=(value:unknown,pointer:string,skip:ReadonlySet<string>,resources?:ReadonlySet<string>):void=>{
    // Source-owned regex resources and book keys belong to their Transform,
    // Reader or matching/preprocessing consumers. Their actual consumers still
    // validate and admit them; this walk does not classify them as InitVar.
    if(resources?.has(pointer))return
    if(typeof value==='string') {if(!skip.has(pointer))literal(value,context,pointer);return}
    if(!value||typeof value!=='object')return
    for(const [key,child] of Object.entries(value)) {
      const next=pointer+'/'+escape(key)
      if(!Array.isArray(value)) {
        literal(key,context,next+'#key')
        if(/^(?:stat_data|statData|mvu_data|mvu|state|opaqueState|variables|schema|scripts?|callbacks?)$/i.test(key)
          ||/^(?:card_agent|chaoshen_jixieshi|risuai)$/.test(key)||key.startsWith('$')) {
          openingSourceFail('OPENING_SOURCE_STATE_SYNTAX_UNSUPPORTED',next)
        }
      }
      walk(child,next,skip,resources)
    }
  }
  // The native format enumerates all executable author fields below. Its
  // archive and open metadata are portable values, never interpreter input.
  if(native&&!input.schemaOpening) {
    const extensions=decoded.data.extensions,
      helper=openingSourceObject(extensions)?extensions.tavern_helper:undefined,
      scripts=openingSourceObject(helper)?helper.scripts:undefined
    // Enabled author scripts belong to the existing combined opening owner.
    // Claiming their card here would initialize a raw root without running them.
    if(Array.isArray(scripts)&&scripts.some(script=>openingSourceObject(script)&&script.enabled===true))
      openingSourceFail('OPENING_SOURCE_STATE_SYNTAX_UNSUPPORTED','/data/extensions/tavern_helper/scripts')
  }
  if(!native) {
    // Scoped regex metadata belongs to the bounded Transform owner. Keeping
    // it in the old NoBook extension check strands generated plain openings
    // without the program's absence domain for their next actual Story.
    const extensions=decoded.data.extensions,
      literalExtensions=openingSourceObject(extensions)
        ?Object.fromEntries(Object.entries(extensions).filter(([key])=>!rawResources.has('/data/extensions/'+escape(key)))):extensions
    try {assertMvuNonSchemaSourceExtensionsV1(literalExtensions,'/data/extensions')}
    catch {return openingSourceFail('OPENING_SOURCE_STATE_SYNTAX_UNSUPPORTED','/data/extensions')}
    walk(decoded.document,'',rawSpecial,rawResources)
  }
  for(const field of program.authorFields) {
    if(field.raw)programText(field.raw,field.originalPointer)
    if(field.normalized)programText(field.normalized,field.originalPointer+'/normalized')
  }
  const currentSpecial=new Map<string,Set<string>>(),currentResources=new Map<string,Set<string>>()
  const allow=(table:string,key:string,pointer:string)=>{
    const id=table+':'+key,set=currentSpecial.get(id)??new Set<string>();set.add(pointer);currentSpecial.set(id,set)
  }
  for(const group of program.authorGroups) {
    if(group.currentFieldOffsets==='same-as-original')for(const part of group.parts) {
      const text=group.original.text.slice(part.start,part.end)
      if(!(part.kind==='worldbook-content'&&part.rawEntryPointer&&initByPointer.has(part.rawEntryPointer))) {
        // Use the already-proved complete piece partition, not a matched EJS
        // substring. Each peripheral literal still receives the strict guard.
        const field=program.authorFields.find(field=>field.originalPointer===part.originalPointer)
        const archived=part.kind==='worldbook-content'
          ?bindings.rawEntries.find(entry=>entry.sourcePointer+'/content'===part.originalPointer):undefined
        const owner=part.kind==='author-field'?(native?field?.raw:field?.normalized)
          :program.bookEntries.find(entry=>entry.originalAddress!==null
            &&entry.originalAddress+'/content'===part.originalPointer)?.original
            ??(archived?.original.content as string|undefined)
        if(owner===undefined||owner===null)openingSourceFail('OPENING_SOURCE_CURRENT_ORIGIN_UNAVAILABLE',group.groupId)
        programText(owner,part.originalPointer)
        const originalText=typeof owner==='string'?owner:owner.text
        if(part.kind==='worldbook-content'&&text!==originalText.replace(/\r\n?/g,'\n')+'\n') {
          openingSourceFail('OPENING_SOURCE_CURRENT_ORIGIN_UNAVAILABLE',group.groupId)
        }
      }
    }else programText(group.effective,group.groupId)
    allow(group.row.table,group.row.key,group.fieldPointer)
  }
  for(const entry of program.bookEntries)if(entry.currentProjection) {
    const init=entry.originalAddress===null?undefined:initByPointer.get(entry.originalAddress)
    if(!init)programText(entry.currentProjection.effective,entry.contentPointer+'/current-row')
    allow(entry.currentProjection.row.table,entry.currentProjection.row.key,'/content')
    if(!init) {
      // The same compiler-linked importer row owns its actual key projections.
      // Keep unrelated row fields under the ordinary literal/state guard.
      currentResources.set(entry.currentProjection.row.table+':'+entry.currentProjection.row.key,
        new Set(['/keywords','/tavern/keys','/tavern/secondaryKeys']))
    }
    if(init) {
      const current=source.current.rows.find(row=>same(row.ref,entry.currentProjection!.row))?.value,
        original=init.original,
        assignment=entry.currentProjection.assignment.assignment
      if(current?.name===assignment.name)allow(entry.currentProjection.row.table,entry.currentProjection.row.key,'/name')
      const tavern=current?.tavern,metadata=openingSourceObject(tavern)?tavern.sourceMetadata:undefined
      if(openingSourceObject(metadata)&&metadata.comment===original.comment) {
        allow(entry.currentProjection.row.table,entry.currentProjection.row.key,'/tavern/sourceMetadata/comment')
      }
    }
  }
  if(!native&&(program.book.currentNativeMembershipSha256!==undefined||program.book.boundBooks!==undefined)) {
    // A deleted journal member can retain its original legacy projection.
    // Importer-owned sourceIndex identifies the archive row; no entry
    // classification or current prompt contribution is reconstructed here.
    const assignments=new Map(program.assignments.filter(item=>item.assignment.target==='worldbook')
      .map(item=>[source.sessionId+'__'+item.assignment.id,item.assignment] as const))
    for(const row of source.current.rows) {
      if(row.ref.table!=='worldbook'||!row.value)continue
      const assignment=assignments.get(row.ref.key),value=row.value,tavern=value.tavern
      if(!assignment||!openingSourceObject(tavern))continue
      const original=bindings.rawEntries[tavern.sourceIndex as number]
      if(!original||original.entryId!==null)continue
      if(value.content===spanText(record,assignment.sourceSpans))allow('worldbook',row.ref.key,'/content')
      if(value.name===assignment.name)allow('worldbook',row.ref.key,'/name')
      const metadata=tavern.sourceMetadata
      if(openingSourceObject(metadata)&&metadata.comment===original.original.comment) {
        allow('worldbook',row.ref.key,'/tavern/sourceMetadata/comment')
      }
    }
  }
  const openingAssignments=record.assignments.filter(assignment=>assignment.target==='opening')
  const opening=source.current.rows.find(row=>row.ref.table==='opening'&&row.ref.key===source.sessionId+'__scene')
  if(!native&&opening?.value&&openingAssignments.length&&opening.value.importId===record.importId
    &&opening.value.text===spanText(record,openingAssignments.flatMap(assignment=>assignment.sourceSpans))
    &&same(opening.value.sources,openingAssignments.map(assignment=>sourceDescriptor(record,assignment)))) {
    rawDataSyntax(String(opening.value.text),'/current/opening/text')
    allow(opening.ref.table,opening.ref.key,'/text')
  }
  if(!native)for(const row of source.current.rows) {
    const id=row.ref.table+':'+row.ref.key
    walk(row.value,'',currentSpecial.get(id)??new Set(),currentResources.get(id))
  }
  // InitVar comments in legacy tavern metadata are exact original projections.
  // Other metadata and appended overlay fields are never broadly exempted.
  if(!native)for(const entry of program.bookEntries)if(entry.currentNativeOrigin) {
    const origin=entry.currentNativeOrigin
    walk(origin,'/currentNativeOrigin',new Set())
  }
}
