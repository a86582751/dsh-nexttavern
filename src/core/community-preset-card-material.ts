/** Field ownership before rendering. Captured Source owns import/current-row
 * validity; this producer only partitions current author material for ST slots. */
import {recordSha256,sha256} from './roleplay-data.js'
import {projectStructuredImport,sourceDescriptor} from './roleplay-import-record.js'
import {renderCards,renderCoreContributionV1} from './roleplay-author-contributions.js'
import type {AuthorContributionPartV1,AuthorContributionRowV1} from './roleplay-author-contributions.js'
import type {AuthorRecord} from './roleplay-author-context-types.js'
import type {ImportRecord,SourceSpan} from './roleplay-import-types.js'
import type {captureRoleplayTavernPromptSourceDataV1} from './roleplay-tavern-prompt-source.js'

export type CommunityCardFieldV1='description'|'personality'|'scenario'|'persona'|'residual'
export type CommunityCardMarkerV1='charDescription'|'charPersonality'|'scenario'|'personaDescription'
export interface CommunityCardSourceInputV1 {readonly key:string;readonly pointer:string;readonly text:string}
export interface CommunityCardFieldMappingV1 {
  readonly schemaVersion:1
  readonly groups:readonly {readonly identity:string;readonly originalTextSha256:string;
    readonly ranges:readonly {readonly start:number;readonly end:number;readonly field:CommunityCardFieldV1}[]}[]
}
export interface CommunityCardMappingRequiredGroupV1 {
  readonly identity:string
  readonly row:AuthorContributionRowV1
  readonly field:'content'|'core'
  readonly currentText:string
  /** Binds a saved UTF16 mapping to this complete current field, not old raw. */
  readonly originalTextSha256:string
  readonly fields:readonly CommunityCardFieldV1[]
  readonly reason:'shared-field-edited'|'current-provenance-changed'|'native-field-unmapped'|'mapping-stale'|'mapping-range-invalid'
}
type Captured=Extract<ReturnType<typeof captureRoleplayTavernPromptSourceDataV1>,{kind:'captured-data'}>
interface MappingScope {readonly sessionId:string;readonly conversationId:string}
export interface CommunityPresetCardMaterialInputV1 {
  readonly captured:Pick<Captured,'record'|'decoded'|'source'|'residual'|'contributions'>
  readonly override?:CommunityCardFieldMappingV1
  readonly mappingScope?:MappingScope
  /** Current account persona, used only when no actual native user card exists. */
  readonly persona?:readonly CommunityCardSourceInputV1[]
}
export interface CommunityNativeCardMaterialInputV1 {
  readonly parts:readonly AuthorContributionPartV1[]
  /** Actual current card values captured once beside the author parts. */
  readonly cardRows:readonly {readonly identity:string;readonly value:AuthorRecord}[]
  readonly override?:CommunityCardFieldMappingV1
  readonly mappingScope?:MappingScope
  readonly persona?:readonly CommunityCardSourceInputV1[]
}
export type CommunityPresetCardMaterialV1={readonly schemaVersion:1;readonly kind:'mapped';
  readonly markers:Readonly<Record<CommunityCardMarkerV1,readonly CommunityCardSourceInputV1[]>>;
  readonly residualCards:readonly AuthorContributionPartV1[];readonly residualRules:readonly AuthorContributionPartV1[]}
  |{readonly schemaVersion:1;readonly kind:'mapping-required';readonly groups:readonly CommunityCardMappingRequiredGroupV1[]}

type MarkerField=Exclude<CommunityCardFieldV1,'residual'>
interface Region {field:MarkerField;start:number;end:number;rawText:string;pointer:string}
interface Segment {field:CommunityCardFieldV1;text:string;start?:number;end?:number}
const markers:Record<MarkerField,CommunityCardMarkerV1>={description:'charDescription',personality:'charPersonality',
  scenario:'scenario',persona:'personaDescription'}
const fieldNames:readonly CommunityCardFieldV1[]=['description','personality','scenario','persona','residual']
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const escape=(value:string)=>value.replace(/~/g,'~0').replace(/\//g,'~1')
const offsets=(record:ImportRecord,span:SourceSpan)=>({start:record.lineStarts[span.startLine-1]!,
  end:span.endLine<record.lineCount?record.lineStarts[span.endLine]!:record.normalizedSource.length})

/** The maintained projector labels each raw field immediately before its
 * payload. Those exact source spans, rather than prose matching, own the slot. */
function sourceRegions(captured:CommunityPresetCardMaterialInputV1['captured']):Region[] {
  if(captured.decoded.format==='json-nexttavern-v1')return []
  const projection=projectStructuredImport(captured.record,captured.decoded),regions:Region[]=[]
  for(const field of ['description','personality','scenario'] as const){
    const raw=captured.decoded.data[field]
    if(raw===undefined||raw===null||raw==='')continue
    const label=projection.assignments.findIndex(row=>row.target==='archive-only'&&row.name===field)
    const payload=projection.assignments[label+1]!
    for(const span of payload.sourceSpans)regions.push({field,...offsets(captured.record,span),
      rawText:String(raw),pointer:`/data/${field}`})
  }
  return regions
}
function sourceSegments(record:ImportRecord,spans:readonly SourceSpan[],regions:readonly Region[]):Segment[] {
  const output:Segment[]=[]
  for(const span of [...spans].sort((a,b)=>a.startLine-b.startLine||a.endLine-b.endLine)){
    const {start,end}=offsets(record,span)
    const cuts=[start,...regions.flatMap(region=>[region.start,region.end]).filter(at=>at>start&&at<end),end]
      .sort((a,b)=>a-b)
    for(let index=1;index<cuts.length;index++){
      const from=cuts[index-1]!,to=cuts[index]!,region=regions.find(region=>from>=region.start&&to<=region.end)
      const field=region?.field??'residual',previous=output.at(-1),text=record.normalizedSource.slice(from,to)
      if(previous?.field===field&&previous.end===from){previous.text+=text;previous.end=to}
      else if(text)output.push({field,text,start:from,end:to})
    }
  }
  return output
}
function overrideSegments(text:string,mapping:CommunityCardFieldMappingV1['groups'][number]):Segment[]|null {
  const ranges=[...mapping.ranges].sort((a,b)=>a.start-b.start||a.end-b.end),segments:Segment[]=[]
  let offset=0
  for(const range of ranges){
    if(!Number.isSafeInteger(range.start)||!Number.isSafeInteger(range.end)||range.start<offset
      ||range.end<range.start||range.end>text.length||!fieldNames.includes(range.field))return null
    if(range.start>offset)segments.push({field:'residual',text:text.slice(offset,range.start)})
    if(range.end>range.start)segments.push({field:range.field,text:text.slice(range.start,range.end)})
    offset=range.end
  }
  if(offset<text.length)segments.push({field:'residual',text:text.slice(offset)})
  return segments
}
function currentSegments(part:AuthorContributionPartV1,currentText:string,baseline:readonly Segment[],
  linked:boolean,native:boolean,override:CommunityCardFieldMappingV1|undefined,
  required:CommunityCardMappingRequiredGroupV1[],mappingScope:MappingScope|undefined):Segment[]|null {
  const fields=[...new Set(baseline.filter(part=>part.field!=='residual').map(part=>part.field))]
  // Worldlines copy the same current field under their own row key. Persist
  // its attribution at conversation scope while retaining the actual row ref.
  const identity=mappingScope?`${part.row!.table}:${mappingScope.conversationId}__`+
    part.row!.key.slice(mappingScope.sessionId.length+2)+(part.kind==='core'?'/core':''):part.identity
  const mapping=override?.groups.find(group=>group.identity===identity)
  const require=(reason:CommunityCardMappingRequiredGroupV1['reason'])=>{
    required.push({identity,row:part.row!,field:part.kind==='card'?'content':'core',currentText,
      originalTextSha256:sha256(currentText),fields:fields.length?[...fields,'residual']:
        part.kind==='card'?['description','personality','residual']:['scenario','residual'],reason})
    return null
  }
  if(mapping){
    if(mapping.originalTextSha256!==sha256(currentText))return require('mapping-stale')
    const segments=overrideSegments(currentText,mapping)
    return segments??require('mapping-range-invalid')
  }
  // Clearing a current field clears all of its former marker values.
  if(!currentText)return []
  if(native)return require('native-field-unmapped')
  if(!fields.length)return [{field:'residual',text:currentText}]
  if(!linked)return require('current-provenance-changed')
  if(baseline.map(part=>part.text).join('')===currentText)return [...baseline]
  if(fields.length===1&&!baseline.some(part=>part.field==='residual'&&part.text))return [{field:fields[0]!,text:currentText}]
  return require('shared-field-edited')
}
function addInputs(output:Record<CommunityCardMarkerV1,CommunityCardSourceInputV1[]>,regions:readonly Region[],
  part:AuthorContributionPartV1,segments:readonly Segment[]) {
  for(const [index,segment] of segments.entries())if(segment.field!=='residual'&&segment.text){
    const original=regions.find(region=>region.field===segment.field&&region.start===segment.start&&region.end===segment.end)
    output[markers[segment.field]].push({key:`community-${segment.field}-${sha256(part.identity).slice(0,16)}-${index}`,
      pointer:original?.pointer??`/native/current-author/${escape(part.identity)}/${segment.field}/${index}`,
      text:original?.rawText??segment.text})
  }
}
const remaining=(segments:readonly Segment[])=>segments.filter(part=>part.field==='residual').map(part=>part.text).join('')
function residualCard(part:AuthorContributionPartV1,row:AuthorRecord,content:string):AuthorContributionPartV1 {
  if(content===part.originalText)return part
  // This private one-row table only selects the maintained text wrapper. The
  // returned part retains its actual captured row identity and original body.
  const value={...row,content},key='community__card'
  const text=renderCards({cards:{get:()=>value,entries:()=>[[key,value]]}},'community')
  return {...part,text,textSha256:sha256(text)}
}
function residualCore(part:AuthorContributionPartV1,content:string):AuthorContributionPartV1|null {
  if(!content)return null
  if(content===part.originalText)return part
  const text=renderCoreContributionV1(content)
  return {...part,text,textSha256:sha256(text)}
}

export function produceCommunityPresetCardMaterialV1(input:CommunityPresetCardMaterialInputV1):CommunityPresetCardMaterialV1 {
  const {captured}=input,{record,source,residual,contributions}=captured,regions=sourceRegions(captured)
  const output:Record<CommunityCardMarkerV1,CommunityCardSourceInputV1[]>={
    charDescription:[],charPersonality:[],scenario:[],personaDescription:[]}
  const residualCards:AuthorContributionPartV1[]=[],residualRules:AuthorContributionPartV1[]=[]
  const required:CommunityCardMappingRequiredGroupV1[]=[]
  const rows=new Map(source.current.rows.map(row=>[`${row.ref.table}:${row.ref.key}`,row]))
  let hasUserCard=false
  for(const part of residual.parts){
    if(part.kind!=='card'&&part.kind!=='core'){
      if(part.kind!=='examples')residualRules.push(part)
      continue
    }
    const row=rows.get(`${part.row!.table}:${part.row!.key}`)!
    if(part.kind==='card'&&row.value?.kind==='user'){
      hasUserCard=true
      output.personaDescription.push({key:`community-persona-${sha256(part.identity).slice(0,16)}`,
        pointer:`/native/current-author/${escape(part.identity)}/persona`,text:part.text})
      continue
    }
    if(part.kind==='card'){
      const assignments=record.assignments.filter(assignment=>assignment.target==='card'
        &&`${source.sessionId}__${assignment.kind==='user'?'user':assignment.id}`===part.row!.key)
        .sort((a,b)=>a.sourceSpans[0]!.startLine-b.sourceSpans[0]!.startLine||Number(a.order)-Number(b.order))
      const native=captured.decoded.format==='json-nexttavern-v1'&&assignments.length>0
      const baseline=sourceSegments(record,assignments.flatMap(assignment=>assignment.sourceSpans),regions)
      const linked=!!row.value&&row.value.importId===record.importId
        &&same(row.value.sources,assignments.map(assignment=>sourceDescriptor(record,assignment)))
      const segments=currentSegments(part,part.originalText,baseline,linked,native,input.override,required,input.mappingScope)
      if(!segments)continue
      addInputs(output,regions,part,segments)
      residualCards.push(residualCard(part,row.value as AuthorRecord,remaining(segments)))
    }else {
      const baseline=sourceSegments(record,contributions.orderedAfter.map(fragment=>fragment.span),regions)
      const segments=currentSegments(part,contributions.residualCore,baseline,true,
        captured.decoded.format==='json-nexttavern-v1',input.override,required,input.mappingScope)
      if(!segments)continue
      addInputs(output,regions,part,segments)
      const core=residualCore(part,remaining(segments));if(core)residualRules.push(core)
    }
  }
  if(!hasUserCard)output.personaDescription.push(...input.persona??[])
  return required.length?{schemaVersion:1,kind:'mapping-required',groups:required}:
    {schemaVersion:1,kind:'mapped',markers:output,residualCards,residualRules}
}

/** No imported field provenance exists on this path. Native card kind owns
 * persona; NPC/core attribution is an explicit current-field mapping once. */
export function produceCommunityNativeCardMaterialV1(input:CommunityNativeCardMaterialInputV1):CommunityPresetCardMaterialV1 {
  const output:Record<CommunityCardMarkerV1,CommunityCardSourceInputV1[]>={
    charDescription:[],charPersonality:[],scenario:[],personaDescription:[]}
  const residualCards:AuthorContributionPartV1[]=[],residualRules:AuthorContributionPartV1[]=[]
  const required:CommunityCardMappingRequiredGroupV1[]=[],rows=new Map(input.cardRows.map(row=>[row.identity,row.value]))
  let hasUserCard=false
  for(const part of input.parts){
    if(part.kind!=='card'&&part.kind!=='core'){
      if(part.kind!=='examples')residualRules.push(part)
      continue
    }
    const row=part.kind==='card'?rows.get(part.identity)!:null
    if(row?.kind==='user'){
      hasUserCard=true
      output.personaDescription.push({key:`community-persona-${sha256(part.identity).slice(0,16)}`,
        pointer:`/native/current-author/${escape(part.identity)}/persona`,text:part.text})
      continue
    }
    const segments=currentSegments(part,part.originalText,[],true,true,input.override,required,input.mappingScope)
    if(!segments)continue
    addInputs(output,[],part,segments)
    if(part.kind==='card')residualCards.push(residualCard(part,row!,remaining(segments)))
    else {const core=residualCore(part,remaining(segments));if(core)residualRules.push(core)}
  }
  if(!hasUserCard)output.personaDescription.push(...input.persona??[])
  return required.length?{schemaVersion:1,kind:'mapping-required',groups:required}:
    {schemaVersion:1,kind:'mapped',markers:output,residualCards,residualRules}
}
