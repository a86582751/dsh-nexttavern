/** Canonical chat coordinates belong to the selected history owner. Request
 * windows change placement, while proven compaction sources keep this clock. */
import {deriveEventMessage,foldSurface,createSurfaceCursor} from 'dsh-nexttavern-native-session/surface'
import {createHash} from 'node:crypto'
import {nativeInputSha256} from 'dsh-nexttavern-native-agent-loop'
import type {Session,SessionEvent,SessionMessageProjection} from 'dsh-nexttavern-native-session'
import type {NativeMaterialSelectedBaseV1,NativeRequestMaterialEventV1} from 'dsh-nexttavern-native-agent-loop'
import {selectedCanonicalChatHistory,createSelectedCanonicalChatCursor} from '../memory/memory-history.js'
import type {StorySession,StoryRow,CanonicalChatEntry,CanonicalChatCut,CanonicalChatMessageFacts} from '../memory/memory-history.js'
import {recordSha256,sha256,textOf,stableJson} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {tavernMaterialNativePrefixSha256V1} from './roleplay-tavern-material-history.js'
import type {TavernMaterialHistoryDependenciesV1} from './roleplay-tavern-material-history.js'
import type {SessionHistoryCut} from './session-history.js'
import type {RoleplayStoryTextCapture} from './roleplay-story-text.js'

interface ClockRowV1 {
  readonly seq:number|null
  readonly id:string
  readonly role:'user'|'assistant'
  readonly messageSha256:string
  readonly textSha256:string
}
export interface TavernCanonicalChatClockV1 {
  readonly schemaVersion:1
  readonly encoding:'native-canonical-story-chat-clock-v1'
  readonly authority:'consumer-data-only'
  readonly policy:'canonical-completed-prose-and-selected-real-player-inputs-v1'
  readonly sessionId:string
  readonly nativeCut:number
  readonly nativePrefixSha256:string
  readonly selectedSha256:string
  readonly rows:readonly ClockRowV1[]
  readonly pendingRows:readonly ClockRowV1[]
  readonly chatIndex:number
  readonly membershipSha256:string
  readonly clockSha256:string
}
export interface TavernCanonicalChatClockCaptureV1 {
  readonly data:TavernCanonicalChatClockV1
  readonly scanRows:readonly {id:string;role:'user'|'assistant';messageSha256:string;text:string}[]
  assertCurrent():void
}
/** Compact persisted evidence still describes the exact ordered V1 membership.
 * Native's immutable cut reconstructs those rows during historical replay. */
export interface TavernCanonicalChatClockV2 extends Omit<TavernCanonicalChatClockV1,'schemaVersion'|'encoding'|'rows'> {
  readonly schemaVersion:2
  readonly encoding:'native-canonical-story-chat-clock-v2'
  readonly canonicalCount:number
}
export interface TavernCanonicalChatClockCaptureV2 {
  readonly data:TavernCanonicalChatClockV2
  readonly selectedCanonicalAssistantIds:ReadonlySet<string>
  recentScanRows(count:number):TavernCanonicalChatClockCaptureV1['scanRows']
  fullHistory():Pick<TavernCanonicalChatClockCaptureV1,'scanRows'>&{
    data:TavernCanonicalChatClockV2&{rows:TavernCanonicalChatClockV1['rows']}
  }
  assertCurrent():void
}
export interface TavernReadonlyAuthorDialogChatClockV1 extends Omit<TavernCanonicalChatClockV1,
  'schemaVersion'|'encoding'|'selectedSha256'|'policy'> {
  readonly schemaVersion:2
  readonly encoding:'native-readonly-author-dialog-chat-clock-v1'
  readonly policy:'actual-completed-canonical-prose-without-request-selection-v1'
}
export interface TavernReadonlyAuthorDialogChatClockCaptureV1 {
  readonly data:TavernReadonlyAuthorDialogChatClockV1
  readonly scanRows:TavernCanonicalChatClockCaptureV1['scanRows']
  readonly selected:{readonly messages:NativeMaterialSelectedBaseV1['messages'];readonly sha256:string}
  assertCurrent():void
}
function fail(code='INPUT_MATERIAL_CHAT_CLOCK_UNPROVEN'):never {throw Error(code)}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
function freeze<T>(v:T):T {
  if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v)}
  return v
}
function selectedRows(view:StorySession,events:readonly SessionEvent[],
  messageAt:(event:SessionEvent)=>unknown) {
  const rows=selectedCanonicalChatHistory(view)
  if(rows.length>16_384)fail('INPUT_MATERIAL_CHAT_CLOCK_BUDGET')
  const seen=new Set<string>()
  return rows.map((row:StoryRow)=>{
    const event=events[row.seq],message=event&&messageAt(event) as {id?:unknown;role?:unknown;content?:unknown}|undefined
    if(!message||typeof message.id!=='string'||message.id.length<1||message.id.length>256
      ||message.role!==row.role||seen.has(message.id)||sha256(textOf(message.content))!==sha256(row.text))fail()
    seen.add(message.id)
    return {ref:{seq:row.seq,id:message.id,role:row.role,messageSha256:nativeInputSha256(message),textSha256:sha256(row.text)},
      text:row.text,message:message as NativeMaterialSelectedBaseV1['messages'][number]['message']}
  })
}
type SelectedClockRow=ReturnType<typeof selectedRows>[number]
const ownedClockRows=new WeakMap<CanonicalChatEntry,SelectedClockRow>()
const selectedMessageFacts=new WeakMap<object,CanonicalChatMessageFacts>()
/** The Native surface retains each immutable selected message object until
 * an actual projection replaces it. Its exact record identity and raw text
 * are shared by chat, scope and display readers; accepted final text remains
 * a separate numerical publication and never changes this identity. */
export function readTavernSelectedMessageFactsV1(message:object&{readonly content?:unknown}):CanonicalChatMessageFacts {
  const saved=selectedMessageFacts.get(message)
  if(saved)return saved
  const text=textOf(message.content)
  let messageVersionSha256:string|undefined,textSha256:string|undefined
  const facts=Object.freeze({get messageVersionSha256(){return messageVersionSha256??=recordSha256(message)},
    text,get textSha256(){return textSha256??=sha256(text)}})
  selectedMessageFacts.set(message,facts)
  return facts
}
const canonicalReaders=new WeakMap<object,{
  sessionId:string;definitions:readonly SessionMessageProjection[];cut:SessionHistoryCut<SessionEvent>;
  cursor:ReturnType<typeof createSelectedCanonicalChatCursor>
}>()
interface CanonicalClockIndex {
  through:number
  rows:SelectedClockRow[]
  bySeq:Map<number,CanonicalChatEntry>
  positions:Map<number,number>
  byId:Map<string,Map<string,CanonicalChatEntry[]>>
  hash:ReturnType<typeof createHash>
  duplicateIds:boolean
}
const canonicalIndexes=new WeakMap<object,CanonicalClockIndex>()
interface CanonicalClockSummary {
  readonly index:CanonicalClockIndex
  readonly count:number
  readonly hash:ReturnType<typeof createHash>
  readonly duplicateIds:boolean
}
const canonicalSummaries=new WeakMap<object,Map<number,CanonicalClockSummary>>()
function summarizeCanonical(value:ReturnType<typeof canonicalAt>):CanonicalClockSummary {
  let summaries=canonicalSummaries.get(value.owner)
  const saved=summaries?.get(value.view.nativeCut)
  if(saved)return saved
  const index=indexCanonical(value),summary={index,count:value.view.length,hash:index.hash.copy(),duplicateIds:index.duplicateIds}
  if(!summaries){summaries=new Map();canonicalSummaries.set(value.owner,summaries)}
  summaries.set(value.view.nativeCut,summary)
  return summary
}
function summaryHasId(summary:CanonicalClockSummary,id:string):boolean {
  const versions=summary.index.byId.get(id)
  if(!versions)return false
  for(const entries of versions.values())for(const entry of entries)
    if(summary.index.positions.get(entry.row.seq)!<summary.count)return true
  return false
}
function indexCanonical(value:ReturnType<typeof canonicalAt>):CanonicalClockIndex {
  const {owner,view}=value,previous=canonicalIndexes.get(owner)
  if(previous?.through===view.nativeCut)return previous
  let index=previous,appended:CanonicalChatEntry[]=[]
  if(index&&index.through<view.nativeCut) {
    const changes=owner.cursor.changes(index.through,view.nativeCut)
    for(const {seq,item}of changes) {
      if(!item||index.bySeq.has(seq)||view.at(index.rows.length+appended.length)!==item){index=undefined;break}
      appended.push(item)
    }
    if(index&&view.length!==index.rows.length+appended.length)index=undefined
  }else index=undefined
  if(!index) {
    index={through:view.nativeCut,rows:[],bySeq:new Map(),positions:new Map(),byId:new Map(),
      hash:createHash('sha256').update('['),duplicateIds:false}
    appended=[...view.range()]
  }
  for(const item of appended) {
    const row=clockRow(item),id=row.ref.id,
      version=item.messageFacts!.messageVersionSha256
    let versions=index.byId.get(id)
    if(versions)index.duplicateIds=true
    if(!versions){versions=new Map();index.byId.set(id,versions)}
    const matches=versions.get(version)
    if(matches)matches.push(item);else versions.set(version,[item])
    index.bySeq.set(item.row.seq,item)
    index.positions.set(item.row.seq,index.rows.length)
    if(index.rows.length)index.hash.update(',')
    index.hash.update(stableJson(row.ref)!)
    index.rows.push(row)
  }
  index.through=view.nativeCut
  // An old immutable cut may be read after the live cursor advanced. Its
  // reconstruction must not replace the current owner's forward index.
  if(!previous||view.nativeCut>=previous.through)canonicalIndexes.set(owner,index)
  return index
}
/** Return every exact identity/version match, including real duplicate
 * publications. Selected consumers retain their original ambiguity rule. */
export function readTavernCanonicalChatMatchesAtCutV1(sessionId:string,cut:SessionHistoryCut<SessionEvent>,
  nativeCut:number,projections:readonly SessionMessageProjection[],
  queries:readonly {messageId:string;messageVersionSha256:string}[]):readonly (readonly CanonicalChatEntry[])[] {
  const index=indexCanonical(canonicalAt(sessionId,cut,nativeCut,projections))
  return queries.map(query=>index.byId.get(query.messageId)?.get(query.messageVersionSha256)?.slice()??[])
}
function canonicalAt(sessionId:string,cut:SessionHistoryCut<SessionEvent>,nativeCut:number,
  projections:readonly SessionMessageProjection[]) {
  let owner=canonicalReaders.get(cut.owner)
  if(!owner||owner.sessionId!==sessionId||owner.definitions.length!==projections.length
    ||owner.definitions.some((definition,index)=>definition!==projections[index])) {
    let state:NonNullable<typeof owner>|undefined
    const read=()=>state?.cut??cut,cursor=createSelectedCanonicalChatCursor({sessionId,read,
      surface:createSurfaceCursor({read,projections}),messageFacts:readTavernSelectedMessageFactsV1})
    state={sessionId,definitions:[...projections],cut,cursor}
    canonicalReaders.set(cut.owner,state);owner=state
  }else if(cut.length>owner.cut.length)owner.cut=cut
  return {owner,view:owner.cursor.atCut(nativeCut)}
}
/** Prompt and clock consumers share the same selected-history owner. The
 * returned cut is immutable DATA; no writer, selector or live cursor escapes. */
export function readTavernCanonicalChatAtCutV1(sessionId:string,cut:SessionHistoryCut<SessionEvent>,
  nativeCut:number,projections:readonly SessionMessageProjection[]):CanonicalChatCut {
  return canonicalAt(sessionId,cut,nativeCut,projections).view
}
/** Internal derived readers share selection changes and positions with the
 * clock owner instead of folding an independent canonical history. */
export function readTavernCanonicalChatChangesV1(sessionId:string,cut:SessionHistoryCut<SessionEvent>,
  projections:readonly SessionMessageProjection[],previous?:{owner:object;nativeCut:number}) {
  const {owner,view}=canonicalAt(sessionId,cut,cut.length,projections)
  const cold=!previous||previous.owner!==owner||previous.nativeCut>view.nativeCut
  return {owner,view,cold,changes:cold?[]:owner.cursor.changes(previous.nativeCut,view.nativeCut),
    position:(seq:number)=>owner.cursor.currentPosition(seq),nativeTurnEndSeq:view.nativeTurnEndSeq,
    current:()=>owner.cut.length===cut.length}
}
function clockRow(entry:CanonicalChatEntry):SelectedClockRow {
  const prior=ownedClockRows.get(entry)
  if(prior)return prior
  const row=entry.row,message=entry.message as {id?:unknown;role?:unknown;content?:unknown}|undefined
  if(!message||typeof message.id!=='string'||message.id.length<1||message.id.length>256
    ||message.role!==row.role)fail()
  const facts=entry.messageFacts!
  if(facts.text!==row.text)fail()
  const value={ref:Object.freeze({seq:row.seq,id:message.id,role:row.role,
    messageSha256:nativeInputSha256(message),textSha256:facts.textSha256}),text:facts.text,
    message:message as NativeMaterialSelectedBaseV1['messages'][number]['message']}
  ownedClockRows.set(entry,value)
  return value
}
function clockRows(view:CanonicalChatCut):SelectedClockRow[] {
  if(view.length>16_384)fail('INPUT_MATERIAL_CHAT_CLOCK_BUDGET')
  const rows:SelectedClockRow[]=[],ids=new Set<string>()
  for(const entry of view.range()) {
    const row=clockRow(entry)
    if(ids.has(row.ref.id))fail()
    ids.add(row.ref.id);rows.push(row)
  }
  return rows
}
function prefixAt(cut:SessionHistoryCut<SessionEvent>|undefined,events:()=>readonly SessionEvent[],length:number):string {
  const owned=cut?.nativeInputPrefixSha256(length)
  if(owned!==undefined)return owned
  const raw=events()
  return tavernMaterialNativePrefixSha256V1({nativeCut:cut},raw,length)
}
/** This is the registered Native pure projection over actual prefix bytes,
 * with no Session construction, driver, input claim or execution capability. */
export function readTavernCanonicalChatRowsAtCutV1(sessionId:string,events:readonly SessionEvent[],
  nativeCut:number,projections:readonly SessionMessageProjection[],owned?:SessionHistoryCut<SessionEvent>) {
  if(!Number.isSafeInteger(nativeCut)||nativeCut<0||nativeCut>events.length
    ||nativeCut>131_072)fail()
  if(owned?.source==='native')return clockRows(canonicalAt(sessionId,owned,nativeCut,projections).view).map(({ref,text})=>({ref,text}))
  if(events.slice(0,nativeCut).some((event,index)=>event.seq!==index))fail()
  const prefix=events.slice(0,nativeCut),surface=foldSurface(prefix,projections),
    messageAt=(event:SessionEvent)=>deriveEventMessage(event,surface.projectedMessages),
    view={id:sessionId,events:prefix,surface,deriveEventMessage:messageAt} as unknown as StorySession
  return selectedRows(view,prefix,messageAt).map(({ref,text})=>({ref,text}))
}
/** A read-only dialog has a real Native prefix, with no selected Main request
 * or pending player input. Keep that distinction in its versioned clock. */
export function captureReadonlyAuthorDialogChatClockV1(input:{
  readonly session:Session;readonly projections:readonly SessionMessageProjection[];assertOwnerCurrent():void
  readonly inputState?:TavernMaterialHistoryDependenciesV1['inputState']
  readonly storyText?:RoleplayStoryTextCapture
}):TavernReadonlyAuthorDialogChatClockCaptureV1 {
  input.assertOwnerCurrent()
  const nativeCut=input.inputState?.nativeHistory?.cut?.<SessionEvent>(input.session)
  let events:readonly SessionEvent[]|undefined
  const raw=()=>events??=nativeCut?.materialize()??input.session.snapshotEvents()
  let rows:SelectedClockRow[]
  if(nativeCut?.source==='native') {
    void input.session.surface.contentGeneration
    rows=clockRows(canonicalAt(input.session.id,nativeCut,nativeCut.length,input.projections).view)
  }else {
    const surface=foldSurface(raw(),input.projections),messageAt=(event:SessionEvent)=>deriveEventMessage(event,surface.projectedMessages),
      view={id:input.session.id,events:raw(),surface,deriveEventMessage:messageAt} as unknown as StorySession
    rows=selectedRows(view,raw(),messageAt)
  }
  const refs=rows.map(row=>row.ref),length=nativeCut?.length??raw().length
  const body={schemaVersion:2 as const,encoding:'native-readonly-author-dialog-chat-clock-v1' as const,
    authority:'consumer-data-only' as const,policy:'actual-completed-canonical-prose-without-request-selection-v1' as const,
    sessionId:input.session.id,nativeCut:length,nativePrefixSha256:prefixAt(nativeCut,raw,length),
    rows:refs,pendingRows:[],chatIndex:rows.length,membershipSha256:recordSha256(refs)}
  const data=freeze({...body,clockSha256:recordSha256(body)}),
    messages=cloneRoleplayTavernLoreDataV1(rows.map(({ref,message})=>({origin:'surface' as const,eventSeq:ref.seq,id:ref.id,
      role:ref.role,messageSha256:ref.messageSha256,message})),8_388_608),
    cut={schemaVersion:1,encoding:'native-author-dialog-readonly-message-cut-v1',authority:'consumer-data-only',
      sessionId:input.session.id,nativeCut:length,nativePrefixSha256:data.nativePrefixSha256,messages}
  return {data,selected:freeze({messages,sha256:recordSha256(cut)}),
    scanRows:freeze(rows.map(({ref,text,message})=>({id:ref.id,role:ref.role,messageSha256:ref.messageSha256,
      text:ref.seq===null?text:input.storyText?.text(ref.seq,message,text,ref.messageSha256)??text}))),
    assertCurrent:()=>{input.assertOwnerCurrent()
      if(input.storyText&&!input.storyText.current())fail('INPUT_MATERIAL_STORY_TEXT_CHANGED')}}
}
export function captureTavernCanonicalChatClockV1(input:{
  readonly session:Session;readonly selected:NativeMaterialSelectedBaseV1;readonly assertOwnerCurrent:()=>void
  readonly inputState?:TavernMaterialHistoryDependenciesV1['inputState']
  readonly projections?:readonly SessionMessageProjection[]
  readonly storyText?:RoleplayStoryTextCapture
}):TavernCanonicalChatClockCaptureV1 {
  input.assertOwnerCurrent()
  const {session,selected}=input,nativeCut=input.inputState?.nativeHistory?.cut?.<SessionEvent>(session)
  let events:readonly SessionEvent[]|undefined
  const raw=()=>events??=nativeCut?.materialize()??session.snapshotEvents()
  if(nativeCut?.source==='native'&&input.projections)void session.surface.contentGeneration
  const indexed=nativeCut?.source==='native'&&input.projections
    ?canonicalAt(session.id,nativeCut,nativeCut.length,input.projections):undefined,
    rows=indexed?clockRows(indexed.view):selectedRows(session as unknown as StorySession,raw(),event=>session.deriveEventMessage(event)),
    ids=new Set(rows.map(row=>row.ref.id)),pending:{ref:ClockRowV1;text:string}[]=[]
  for(const row of selected.messages)if(row.origin==='pending-decision'&&row.role==='user') {
    const source=(row.message as {source?:{kind?:string}}).source
    if(source?.kind!=='user')continue
    if(ids.has(row.id))fail('INPUT_MATERIAL_CHAT_CLOCK_DUPLICATE')
    if(row.eventSeq!==null||nativeInputSha256(row.message)!==row.messageSha256)fail()
    ids.add(row.id)
    const text=textOf(row.message.content)
    if(text.trim())pending.push({ref:{seq:null,id:row.id,role:'user',messageSha256:row.messageSha256,textSha256:sha256(text)},text})
  }
  const length=nativeCut?.length??raw().length,
    body={schemaVersion:1 as const,encoding:'native-canonical-story-chat-clock-v1' as const,
    authority:'consumer-data-only' as const,policy:'canonical-completed-prose-and-selected-real-player-inputs-v1' as const,
    sessionId:session.id,nativeCut:length,nativePrefixSha256:prefixAt(nativeCut,raw,length),
    selectedSha256:selected.sha256,
    rows:rows.map(row=>row.ref),pendingRows:pending.map(row=>row.ref),chatIndex:rows.length+pending.length,
    membershipSha256:recordSha256([...rows.map(row=>row.ref),...pending.map(row=>row.ref)])}
  const data=freeze(cloneRoleplayTavernLoreDataV1({...body,clockSha256:recordSha256(body)},8_388_608)),
    scanRows=freeze([...rows.map(row=>({...row,text:row.ref.seq===null?row.text
      :input.storyText?.text(row.ref.seq,row.message,row.text,row.ref.messageSha256)??row.text})),...pending]
      .map(({ref,text})=>({id:ref.id,role:ref.role,messageSha256:ref.messageSha256,text})))
  let verifiedThrough=length,admitted=new Map<string,number>()
  const baseBySeq=new Map(rows.map(row=>[row.ref.seq!,row.ref])),pendingById=new Map(pending.map(row=>[row.ref.id,row.ref]))
  const assertCurrent=()=>{
    input.assertOwnerCurrent()
    if(input.storyText&&!input.storyText.current())fail('INPUT_MATERIAL_STORY_TEXT_CHANGED')
    const currentCut=input.inputState?.nativeHistory?.cut?.<SessionEvent>(session)
    let currentEvents:readonly SessionEvent[]|undefined
    const currentRaw=()=>currentEvents??=currentCut?.materialize()??session.snapshotEvents(),currentLength=currentCut?.length??currentRaw().length
    if(currentLength<length||prefixAt(currentCut,currentRaw,length)!==data.nativePrefixSha256)fail()
    if(indexed&&currentCut?.source==='native'&&input.projections) {
      if(currentCut.owner!==nativeCut!.owner)fail()
      void session.surface.contentGeneration
      const actual=canonicalAt(session.id,currentCut,currentLength,input.projections)
      if(actual.owner!==indexed.owner)fail()
      const changed=actual.owner.cursor.changes(verifiedThrough,currentLength),nextAdmitted=new Map(admitted)
      for(const {seq}of changed)for(const [id,old]of nextAdmitted)if(old===seq)nextAdmitted.delete(id)
      for(const {seq,item}of changed) {
        const original=baseBySeq.get(seq)
        if(original) {if(!item||!same(clockRow(item).ref,original))fail();continue}
        if(!item)continue
        const row=clockRow(item).ref,proposed=pendingById.get(row.id)
        if(!proposed||row.seq===null||row.seq<length||row.role!==proposed.role||row.messageSha256!==proposed.messageSha256
          ||row.textSha256!==proposed.textSha256||nextAdmitted.has(row.id))fail()
        nextAdmitted.set(row.id,seq)
      }
      admitted=nextAdmitted;verifiedThrough=currentLength;return
    }
    const current=currentRaw()
    const actual=selectedRows(session as unknown as StorySession,current,event=>session.deriveEventMessage(event)),
      remaining=new Map(pending.map(row=>[row.ref.id,row.ref])),base=new Map(rows.map(row=>[row.ref.id,row.ref]))
    for(const row of actual) {
      const original=base.get(row.ref.id)
      if(original) {if(!same(row.ref,original))fail();base.delete(row.ref.id);continue}
      const proposed=remaining.get(row.ref.id)
      if(!proposed||row.ref.role!==proposed.role||row.ref.messageSha256!==proposed.messageSha256
        ||row.ref.textSha256!==proposed.textSha256||row.ref.seq===null||row.ref.seq<length)fail()
      remaining.delete(row.ref.id)
    }
    if(base.size)fail()
    // Not-yet-admitted pending rows remain in the captured logical count.
    // Native's actual selected-lineage check separately owns their admission.
  }
  return {data,scanRows,assertCurrent}
}
/** Ordinary Main reads only the requested scan range. Full author history is
 * materialized explicitly when an admitted callback consumes it. */
export function captureTavernCanonicalChatClockV2(input:Parameters<typeof captureTavernCanonicalChatClockV1>[0])
  :TavernCanonicalChatClockCaptureV1|TavernCanonicalChatClockCaptureV2 {
  input.assertOwnerCurrent()
  const {session,selected}=input,cut=input.inputState?.nativeHistory?.cut?.<SessionEvent>(session)
  if(cut?.source!=='native'||!input.projections)return captureTavernCanonicalChatClockV1(input)
  void session.surface.contentGeneration
  const indexed=canonicalAt(session.id,cut,cut.length,input.projections),view=indexed.view,
    summary=summarizeCanonical(indexed),index=summary.index
  if(summary.duplicateIds)fail()
  if(view.length>16_384)fail('INPUT_MATERIAL_CHAT_CLOCK_BUDGET')
  const pending:(Omit<SelectedClockRow,'ref'>&{ref:ClockRowV1})[]=[],pendingIds=new Set<string>()
  for(const row of selected.messages)if(row.origin==='pending-decision'&&row.role==='user'&&row.message.source?.kind==='user') {
    if(index.byId.has(row.id)||pendingIds.has(row.id))fail('INPUT_MATERIAL_CHAT_CLOCK_DUPLICATE')
    if(row.eventSeq!==null||nativeInputSha256(row.message)!==row.messageSha256)fail()
    pendingIds.add(row.id)
    const text=textOf(row.message.content)
    if(text.trim())pending.push({ref:{seq:null,id:row.id,role:'user',messageSha256:row.messageSha256,textSha256:sha256(text)},
      text,message:row.message})
  }
  const membership=summary.hash.copy()
  for(const [position,row]of pending.entries()) {
    if(view.length+position)membership.update(',')
    membership.update(stableJson(row.ref)!)
  }
  const body={schemaVersion:2 as const,encoding:'native-canonical-story-chat-clock-v2' as const,
    authority:'consumer-data-only' as const,policy:'canonical-completed-prose-and-selected-real-player-inputs-v1' as const,
    sessionId:session.id,nativeCut:cut.length,nativePrefixSha256:prefixAt(cut,()=>cut.materialize(),cut.length),
    selectedSha256:selected.sha256,canonicalCount:view.length,pendingRows:pending.map(row=>row.ref),
    chatIndex:view.length+pending.length,membershipSha256:membership.update(']').digest('hex')}
  const data=freeze({...body,clockSha256:recordSha256(body)})
  const rowAt=(position:number)=>position<view.length?clockRow(view.at(position)!):pending[position-view.length]!
  const scanRange=(start:number)=>{
    const rows:TavernCanonicalChatClockCaptureV1['scanRows'][number][]=[]
    for(let position=start;position<data.chatIndex;position++) {
      const {ref,text:originalText,message}=rowAt(position),text=ref.seq===null?originalText
        :input.storyText?.text(ref.seq,message,originalText,ref.messageSha256)??originalText
      rows.push({id:ref.id,role:ref.role,messageSha256:ref.messageSha256,text})
    }
    return Object.freeze(rows)
  }
  const pendingById=new Map(pending.map(row=>[row.ref.id,row.ref]))
  let verifiedThrough=cut.length,admitted=new Map<string,number>(),baseBySeq:Map<number,ClockRowV1>|undefined
  const assertCurrent=()=>{
    input.assertOwnerCurrent()
    if(input.storyText&&!input.storyText.current())fail('INPUT_MATERIAL_STORY_TEXT_CHANGED')
    const current=input.inputState?.nativeHistory?.cut?.<SessionEvent>(session)
    if(!current||current.owner!==cut.owner||current.length<cut.length
      ||prefixAt(current,()=>current.materialize(),cut.length)!==data.nativePrefixSha256)fail()
    void session.surface.contentGeneration
    const actual=canonicalAt(session.id,current,current.length,input.projections!)
    if(actual.owner!==indexed.owner)fail()
    const changes=actual.owner.cursor.changes(verifiedThrough,current.length),nextAdmitted=new Map(admitted)
    for(const {seq}of changes)for(const [id,old]of nextAdmitted)if(old===seq)nextAdmitted.delete(id)
    for(const {seq,item}of changes) {
      // A real edit or membership replacement may touch the captured prefix.
      // Ordinary tail admission never constructs this old-prefix lookup.
      if(seq<cut.length) {
        baseBySeq??=new Map([...view.range()].map(entry=>[entry.row.seq,clockRow(entry).ref]))
        const original=baseBySeq.get(seq)
        if(original){if(!item||!same(clockRow(item).ref,original))fail();continue}
      }
      if(!item)continue
      const row=clockRow(item).ref,proposed=pendingById.get(row.id)
      if(!proposed||row.seq===null||row.seq<cut.length||row.role!==proposed.role
        ||row.messageSha256!==proposed.messageSha256||row.textSha256!==proposed.textSha256||nextAdmitted.has(row.id))fail()
      nextAdmitted.set(row.id,seq)
    }
    admitted=nextAdmitted;verifiedThrough=current.length
  }
  const selectedCanonicalAssistantIds=new Set(selected.messages.filter(row=>row.role==='assistant'
    &&[...index.byId.get(row.id)?.values()??[]].some(matches=>matches.some(item=>item.row.role==='assistant'))).map(row=>row.id))
  return {data,assertCurrent,selectedCanonicalAssistantIds,recentScanRows:count=>scanRange(Math.max(0,data.chatIndex-count)),
    fullHistory:()=>({data:{...data,rows:[...view.range()].map(entry=>clockRow(entry).ref)},scanRows:scanRange(0)})}
}
export function verifyTavernCanonicalChatClockV1(raw:unknown,sessionId:string,
  material:NativeRequestMaterialEventV1,events:readonly SessionEvent[],projections:readonly SessionMessageProjection[],
  historyFacts?:Pick<TavernMaterialHistoryDependenciesV1,'nativeCut'>)
  :TavernCanonicalChatClockV1 {
  const value=cloneRoleplayTavernLoreDataV1(raw,8_388_608) as TavernCanonicalChatClockV1
  const expected=['schemaVersion','encoding','authority','policy','sessionId','nativeCut','nativePrefixSha256','selectedSha256',
    'rows','pendingRows','chatIndex','membershipSha256','clockSha256']
  if(!value||!same(Object.keys(value).sort(),expected.sort())||value.schemaVersion!==1
    ||value.encoding!=='native-canonical-story-chat-clock-v1'||value.authority!=='consumer-data-only'
    ||value.policy!=='canonical-completed-prose-and-selected-real-player-inputs-v1'||value.sessionId!==sessionId
    ||!Number.isSafeInteger(value.nativeCut)||value.nativeCut<0||value.nativeCut>material.seq
    ||value.nativePrefixSha256!==(historyFacts?tavernMaterialNativePrefixSha256V1(historyFacts,events,value.nativeCut):
      nativeInputSha256(events.slice(0,value.nativeCut)))||!hash(value.selectedSha256)
    ||!Array.isArray(value.rows)||!Array.isArray(value.pendingRows)||value.rows.length+value.pendingRows.length>16_384
    ||value.chatIndex!==value.rows.length+value.pendingRows.length
    ||value.membershipSha256!==recordSha256([...value.rows,...value.pendingRows]))fail()
  const {clockSha256,...body}=value
  if(!hash(clockSha256)||recordSha256(body)!==clockSha256)fail()
  const actual=readTavernCanonicalChatRowsAtCutV1(sessionId,events,value.nativeCut,projections,historyFacts?.nativeCut)
  if(!same(actual.map(row=>row.ref),value.rows))fail()
  const ids=new Set(value.rows.map(row=>row.id))
  for(const pending of value.pendingRows) {
    if(!pending||!same(Object.keys(pending).sort(),['seq','id','role','messageSha256','textSha256'].sort())
      ||pending.seq!==null||pending.role!=='user'||typeof pending.id!=='string'||ids.has(pending.id)
      ||!hash(pending.messageSha256)||!hash(pending.textSha256))fail()
    ids.add(pending.id)
    const refs=material.data.base.messages.filter(row=>row.id===pending.id&&row.role==='user')
    if(refs.length!==1||refs[0]!.seq<value.nativeCut||refs[0]!.messageSha256!==pending.messageSha256)fail()
    const event=historyFacts?.nativeCut?.at(refs[0]!.seq)??events[refs[0]!.seq]
    if(event?.type!=='user/message'||event.data.source?.kind!=='user'||event.data.id!==pending.id
      ||nativeInputSha256(event.data)!==pending.messageSha256||sha256(textOf(event.data.content))!==pending.textSha256)fail()
  }
  return freeze(value)
}
export function verifyTavernCanonicalChatClock(raw:unknown,sessionId:string,
  material:NativeRequestMaterialEventV1,events:readonly SessionEvent[],projections:readonly SessionMessageProjection[],
  historyFacts?:Pick<TavernMaterialHistoryDependenciesV1,'nativeCut'>):TavernCanonicalChatClockV1|TavernCanonicalChatClockV2 {
  if((raw as {encoding?:unknown})?.encoding!=='native-canonical-story-chat-clock-v2')
    return verifyTavernCanonicalChatClockV1(raw,sessionId,material,events,projections,historyFacts)
  const value=cloneRoleplayTavernLoreDataV1(raw,8_388_608) as TavernCanonicalChatClockV2,
    fields=['schemaVersion','encoding','authority','policy','sessionId','nativeCut','nativePrefixSha256','selectedSha256',
      'canonicalCount','pendingRows','chatIndex','membershipSha256','clockSha256']
  if(!same(Object.keys(value).sort(),fields.sort())||value.schemaVersion!==2||value.authority!=='consumer-data-only'
    ||value.policy!=='canonical-completed-prose-and-selected-real-player-inputs-v1'||value.sessionId!==sessionId
    ||!Number.isSafeInteger(value.nativeCut)||value.nativeCut<0||value.nativeCut>material.seq
    ||!Number.isSafeInteger(value.canonicalCount)||value.canonicalCount<0||value.canonicalCount>16_384
    ||!Array.isArray(value.pendingRows)||value.chatIndex!==value.canonicalCount+value.pendingRows.length
    ||!hash(value.selectedSha256)||value.nativePrefixSha256!==(historyFacts
      ?tavernMaterialNativePrefixSha256V1(historyFacts,events,value.nativeCut):nativeInputSha256(events.slice(0,value.nativeCut))))fail()
  const {clockSha256,...body}=value
  if(!hash(clockSha256)||recordSha256(body)!==clockSha256)fail()
  const owned=historyFacts?.nativeCut,summary=owned?.source==='native'
    ?summarizeCanonical(canonicalAt(sessionId,owned,value.nativeCut,projections)):undefined,
    refs=summary?undefined:readTavernCanonicalChatRowsAtCutV1(sessionId,events,value.nativeCut,projections).map(row=>row.ref)
  let digest:string
  if(summary) {
    if(summary.duplicateIds)fail()
    const hash=summary.hash.copy()
    for(const [position,row]of value.pendingRows.entries()) {
      if(summary.count+position)hash.update(',')
      hash.update(stableJson(row)!)
    }
    digest=hash.update(']').digest('hex')
  }else digest=recordSha256([...refs!,...value.pendingRows])
  if((summary?.count??refs!.length)!==value.canonicalCount||digest!==value.membershipSha256)fail()
  const ids=new Set(refs?.map(row=>row.id))
  for(const pending of value.pendingRows) {
    if(!pending||!same(Object.keys(pending).sort(),['seq','id','role','messageSha256','textSha256'].sort())
      ||pending.seq!==null||pending.role!=='user'||typeof pending.id!=='string'
      ||ids.has(pending.id)||summary&&summaryHasId(summary,pending.id)
      ||!hash(pending.messageSha256)||!hash(pending.textSha256))fail()
    ids.add(pending.id)
    const selected=material.data.base.messages.filter(row=>row.id===pending.id&&row.role==='user')
    if(selected.length!==1||selected[0]!.seq<value.nativeCut||selected[0]!.messageSha256!==pending.messageSha256)fail()
    const event=historyFacts?.nativeCut?.at(selected[0]!.seq)??events[selected[0]!.seq]
    if(event?.type!=='user/message'||event.data.source?.kind!=='user'||event.data.id!==pending.id
      ||nativeInputSha256(event.data)!==pending.messageSha256||sha256(textOf(event.data.content))!==pending.textSha256)fail()
  }
  return freeze(value)
}
