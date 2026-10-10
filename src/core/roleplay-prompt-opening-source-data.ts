/** Pure identity-only rendering, whole raw/current syntax coverage and the
 * existing raw InitVar calculator. No schema/VM, Native or basis is supplied. */
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {compileSchemaMvuInitData,selectNativeMvuInitializationPolicy} from './tavern-mvu-initvar.js'
import {isNativeMvuYamlSourcePolicy} from './roleplay-mvu-source-policy.js'
import {assertMvuLiteralSourceTextV1,assertMvuNonSchemaSourceExtensionsV1} from './roleplay-mvu-source.js'
import {spanText,sourceDescriptor} from './roleplay-import-record.js'
import {segmentPromptTemplateOnlyFieldV1,PromptTemplateOnlyRefusalV1} from './roleplay-prompt-template-only-data.js'
import type {DecodedTavernCard,TavernOpeningContext,TavernOpeningCandidate} from './tavern-card.js'
import type {ImportRecord} from './roleplay-import-types.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {SchemaMvuInitDataSource} from './tavern-mvu-initvar.js'
import type {PromptProgramSourceInventoryV1,PromptProgramTextV1} from './roleplay-prompt-program-source-types.js'
import type {PromptOpeningSourceCodeV1,PromptOpeningIdentityRenderingV1,PromptOpeningGreetingBlockV1,
  PromptOpeningGreetingFactsV1,PromptOpeningRawEntryBindingV1,PromptOpeningRawInitBindingV1,
  PromptOpeningInitializationV1} from './roleplay-prompt-opening-source-types.js'

export const PROMPT_OPENING_SOURCE_POLICY_V1=Object.freeze({schemaVersion:1,
  encoding:'native-prompt-opening-source-policy-v1',source:'actual-own-root-or-committed-reserved-fresh-cut0',
  prompt:'six-author-fields-and-actual-recomputed-book-content; protected-selection-and-renderer-separate',
  identityRendering:'only-actual-three-identity-macros-v1; user,char,user_gender; complete-source-bytes',
  numeric:'compileSchemaMvuInitData-raw-init-data-v1; existing-selector-strict-JSON-or-JSON-data-YAML',
  initialization:'immutable-raw-book-init-entries-and-complete-original-greetings; current-prompt-edit-is-not-new-init-data',
  calculatorBaseline:'explicit-empty-calculation-policy; not-actual-numerical-absence-or-fresh-basis',
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
  constructor(readonly code:PromptOpeningSourceCodeV1,readonly pointer:string,readonly calculatorCode?:string) {super(code)}
}
export function openingSourceFail(code:PromptOpeningSourceCodeV1,pointer:string,calculatorCode?:string):never {
  throw new PromptOpeningSourceFailureV1(code,pointer,calculatorCode)
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
export function promptOpeningInitializationInputBindingV1(program:PromptProgramSourceInventoryV1,
  data:SchemaMvuInitDataSource,grammarPolicy:PromptOpeningInitializationV1['grammarPolicy'],
  bindings:PromptOpeningRawInitBindingV1):string {
  return recordSha256({encoding:'immutable-raw-opening-init-input-binding-v1',importTuple:program.importTuple,
    data,grammarPolicy,bindings:{...bindings,
      rawEntries:bindings.rawEntries.map(({effectivePromptContentSha256:_,...entry})=>{
        if(program.book.currentNativeMembershipSha256===undefined)return entry
        // Current-member audit fields disappear when an original is deleted;
        // immutable archive initialization does not depend on that catalog.
        const {entryId:__,...original}=entry
        return original
      })}})
}
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const escape=(key:string)=>key.replace(/~/g,'~0').replace(/\//g,'~1')
const initSyntax=(text:string)=>/\[initvar\]|<\/?initvar\b/i.test(text)
/** A bound raw-data position permits the calculator's InitVar wrappers only.
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
function programText(text:PromptProgramTextV1|string,context:TavernOpeningContext,pointer:string):void {
  const body=typeof text==='string'?text:text.text
  let segments:ReturnType<typeof segmentPromptTemplateOnlyFieldV1>
  if(typeof text==='string') {
    // Deleted originals still occur in immutable import projections. Partition
    // their archive text without inventing a current compiler entry identity.
    try {segments=segmentPromptTemplateOnlyFieldV1(text,pointer)}
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
  for(const segment of segments)if(segment.kind==='literal')literal(body.slice(segment.start,segment.end),context,pointer)
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

/** Sources are actual private-owner facts supplied by the Source factory.
 * This calculator builder remains inert and never mints an opening proof. */
export function calculatePromptOpeningRawInitV1(input:{source:TavernLoreSourceDataV1;decoded:DecodedTavernCard;
  record:ImportRecord;program:PromptProgramSourceInventoryV1;candidates:readonly TavernOpeningCandidate[];
  selectedIndex:number;context:TavernOpeningContext}):PromptOpeningInitializationV1 {
  const {source,decoded,record,program,candidates,selectedIndex,context}=input,primary=source.original.primary
  const byEntry=new Map(program.bookEntries.map(entry=>[entry.originalAddress,entry] as const))
  const membership=program.book.currentNativeMembershipSha256!==undefined
  const rawEntries:PromptOpeningRawEntryBindingV1[]=[],initEntries:SchemaMvuInitDataSource['books'][number]['entries'][number][]=[]
  let macros=false
  for(const raw of primary.entries) {
    const entry=byEntry.get(raw.ref.entryPointer),value=raw.value,pointer=raw.ref.entryPointer
    if(!membership&&(!entry||!entry.original||entry.rawEntrySha256!==raw.ref.entrySha256)
      ||typeof value.content!=='string'||value.comment!==undefined&&typeof value.comment!=='string') {
      openingSourceFail('OPENING_SOURCE_IMPORT_UNPROVEN',pointer)
    }
    const comment=String(value.comment??''),isInitVar=comment.toLowerCase().includes('[initvar]')
    const enabled=value.enabled!==false&&value.disable!==true
    let rendering:ReturnType<typeof renderPromptOpeningIdentityV1>|null=null
    if(isInitVar) {
      // Only the selector marker is privileged in comments. Remaining comment
      // text keeps the ordinary literal guard, including inert EJS metadata.
      literal(comment.replace(/\[initvar\]/gi,''),context,pointer+'/comment')
      rawDataSyntax(value.content,pointer+'/content')
      rendering=renderPromptOpeningIdentityV1(value.content,context,pointer+'/content',[{start:0,end:value.content.length}])
      rawDataSyntax(rendering.text,pointer+'/content/rendered')
      macros||=rendering.facts.used
      initEntries.push({identity:`entry-${raw.ref.entryOrdinal}`,sourcePointer:pointer,comment,enabled,
        content:value.content,contentSha256:sha256(value.content),renderedContent:rendering.text,
        renderedContentSha256:sha256(rendering.text)})
    }else {
      programText(entry?.original??value.content,context,pointer+'/content')
      if(entry)programText(entry.effective,context,pointer+'/content/current')
    }
    if(isInitVar&&entry)rawDataSyntax(entry.effective.text,pointer+'/content/current')
    rawEntries.push({ordinal:raw.ref.entryOrdinal,entryId:entry?.entryId??null,sourceKey:raw.entryKey,
      sourcePointer:pointer,rawEntrySha256:raw.ref.entrySha256,original:value,isInitVar,enabled,
      renderedContent:rendering?.text??null,identityRendering:rendering?.facts??null,
      effectivePromptContentSha256:entry?.effective.textSha256??null})
  }
  // Introduced current text remains ordinary prompt data. It is never added to
  // immutable raw InitVar entries or granted their calculator syntax scope.
  for(const entry of program.bookEntries)if(entry.originalAddress===null) {
    programText(entry.effective,context,entry.contentPointer+'/current')
  }
  const greetingFacts=candidates.map(candidate=>readPromptOpeningGreetingFactsV1(candidate,context))
  macros||=greetingFacts.some(greeting=>greeting.identityRendering.used)
  const books:SchemaMvuInitDataSource['books']=primary.binding==='primary'
    ?[{identity:'embedded-primary',binding:'primary',sourcePointer:primary.bookPointer,sourceSha256:primary.bookSha256,
      entries:initEntries}]:[]
  const swipes:SchemaMvuInitDataSource['swipes']=greetingFacts.map(item=>({identity:`swipe-${item.index}`,
    sourcePointer:item.sourcePointer,sourceSha256:item.sourceSha256,rawOpening:item.rawText,renderedOpening:item.renderedText,
    renderedSha256:item.renderedSha256,statData:{},...(item.materialization?{materialization:item.materialization}:{})}))
  const policy=selectNativeMvuInitializationPolicy({books,swipes})
  if(policy.kind!=='selected')openingSourceFail('OPENING_SOURCE_INIT_DATA_UNSUPPORTED',
    policy.diagnostics[0]?.pointer??'/initialization',policy.diagnostics[0]?.code)
  const descriptor={schemaVersion:1 as const,encoding:'native-mvu-schema-opening-init-source-v1' as const,
    grammar:isNativeMvuYamlSourcePolicy(policy.policy)?'yaml-1.2-json-data-v1' as const:'strict-json-object-v1' as const,
    books,bookStatData:{},initializedBooks:[] as [],messageIndex:0 as const,selectedSwipeIdentity:`swipe-${selectedIndex}`,
    swipes,macros:macros?'verified-identity-rendering' as const:'none' as const}
  const data:SchemaMvuInitDataSource={...descriptor,initSourceSha256:recordSha256(descriptor)}
  const calculation=compileSchemaMvuInitData(data)
  if(calculation.kind!=='parsed')openingSourceFail('OPENING_SOURCE_INIT_DATA_UNSUPPORTED',
    calculation.diagnostics[0]?.pointer??'/initialization',calculation.diagnostics[0]?.code)
  const bindings:PromptOpeningRawInitBindingV1={domain:'immutable-raw-embedded-primary-and-complete-original-greetings',
    bookPresence:primary.binding==='primary'?'actual-primary-book':'actual-proven-book-absence',bookPointer:primary.bookPointer,
    rawBook:primary.value,rawBookSha256:primary.bookSha256,rawEntries,
    entryOrderSha256:recordSha256(rawEntries.map(entry=>({ordinal:entry.ordinal,pointer:entry.sourcePointer,
      rawEntrySha256:entry.rawEntrySha256,isInitVar:entry.isInitVar}))),
    bookInitEntryPointers:rawEntries.filter(entry=>entry.isInitVar).map(entry=>entry.sourcePointer),
    greetingFacts,greetingFactsSha256:recordSha256(greetingFacts),
    originalBookAbsence:primary.binding==='proven-absence'?primary.absenceProof:null,
    baselinePolicy:'empty-calculation-input-only-not-numerical-absence',otherBindings:'not-authorized-and-not-calculated',
    schemaExecution:'none'}
  const common={data,calculation,dataSha256:recordSha256(data),calculationSha256:recordSha256(calculation),
    inputBindingSha256:promptOpeningInitializationInputBindingV1(program,data,policy.policy,bindings),
    bindings,grammarPolicy:policy.policy,schemaExecution:'none' as const,calculationPolicy:'raw-init-data-v1' as const}
  const markerCount=initEntries.length+greetingFacts.reduce((count,greeting)=>count+greeting.originalInitBlocks.length,0)
  inspectPromptOpeningWholeSourceV1({source,decoded,record,program,context,bindings})
  return freezePromptOpeningSourceDataV1(clonePromptOpeningSourceDataV1(markerCount>0
    ?{...common,kind:'raw-init-data' as const,markerCount}
    :{...common,kind:'absent' as const,reason:'no-actual-initvar-markers' as const,markerCount:0 as const}))
}

function inspectPromptOpeningWholeSourceV1(input:{source:TavernLoreSourceDataV1;decoded:DecodedTavernCard;
  record:ImportRecord;program:PromptProgramSourceInventoryV1;context:TavernOpeningContext;bindings:PromptOpeningRawInitBindingV1}) {
  const {source,decoded,record,program,context,bindings}=input,
    initByPointer=new Map(bindings.rawEntries.filter(entry=>entry.isInitVar).map(entry=>[entry.sourcePointer,entry] as const))
  const native=program.importTuple.format==='json-nexttavern-v1'
  try {assertMvuNonSchemaSourceExtensionsV1(decoded.data.extensions,'/data/extensions')}
  catch {return openingSourceFail('OPENING_SOURCE_STATE_SYNTAX_UNSUPPORTED','/data/extensions')}
  const rawSpecial=new Set<string>(program.authorFields.map(field=>field.originalPointer))
  for(const entry of bindings.rawEntries)rawSpecial.add(entry.sourcePointer+'/content')
  for(const greeting of bindings.greetingFacts)rawSpecial.add(greeting.sourcePointer)
  for(const entry of bindings.rawEntries)if(entry.isInitVar)rawSpecial.add(entry.sourcePointer+'/comment')
  const walk=(value:unknown,pointer:string,skip:ReadonlySet<string>):void=>{
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
      walk(child,next,skip)
    }
  }
  // The native format enumerates all executable author fields below. Its
  // archive and open metadata are portable values, never interpreter input.
  if(!native)walk(decoded.document,'',rawSpecial)
  for(const field of program.authorFields) {
    if(field.raw)programText(field.raw,context,field.originalPointer)
    if(field.normalized)programText(field.normalized,context,field.originalPointer+'/normalized')
  }
  const currentSpecial=new Map<string,Set<string>>()
  const allow=(table:string,key:string,pointer:string)=>{
    const id=table+':'+key,set=currentSpecial.get(id)??new Set<string>();set.add(pointer);currentSpecial.set(id,set)
  }
  for(const group of program.authorGroups) {
    if(group.currentFieldOffsets==='same-as-original')for(const part of group.parts) {
      const text=group.original.text.slice(part.start,part.end)
      if(part.kind==='worldbook-content'&&part.rawEntryPointer&&initByPointer.has(part.rawEntryPointer)) {
        rawDataSyntax(text,group.groupId)
      }else {
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
        programText(owner,context,part.originalPointer)
        const originalText=typeof owner==='string'?owner:owner.text
        if(part.kind==='worldbook-content'&&text!==originalText.replace(/\r\n?/g,'\n')+'\n') {
          openingSourceFail('OPENING_SOURCE_CURRENT_ORIGIN_UNAVAILABLE',group.groupId)
        }
      }
    }else programText(group.effective,context,group.groupId)
    allow(group.row.table,group.row.key,group.fieldPointer)
  }
  for(const entry of program.bookEntries)if(entry.currentProjection) {
    const init=entry.originalAddress===null?undefined:initByPointer.get(entry.originalAddress)
    if(init)rawDataSyntax(entry.currentProjection.effective.text,entry.contentPointer+'/current-row')
    else programText(entry.currentProjection.effective,context,entry.contentPointer+'/current-row')
    allow(entry.currentProjection.row.table,entry.currentProjection.row.key,'/content')
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
  if(!native&&program.book.currentNativeMembershipSha256!==undefined) {
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
  if(!native)for(const row of source.current.rows)walk(row.value,'',currentSpecial.get(row.ref.table+':'+row.ref.key)??new Set())
  // InitVar comments in legacy tavern metadata are exact original projections.
  // Other metadata and appended overlay fields are never broadly exempted.
  if(!native)for(const entry of program.bookEntries)if(entry.currentNativeOrigin) {
    const origin=entry.currentNativeOrigin
    walk(origin,'/currentNativeOrigin',new Set())
  }
}
