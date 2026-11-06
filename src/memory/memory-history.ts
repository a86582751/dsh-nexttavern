import { createHash } from 'node:crypto'
import { durableSeq, textOf, adaptationTurns, importedStoryProjection,createAdaptationActivityCursor,
  createImportedStorySelectionCursor,createImportedStorySelectionIndex } from './memory-provenance.js'
import { projectStoryEvent, messageViewGeneration, type MessageViewSession, type StorySurfaceOp } from '../core/roleplay-message-view.js'
import {sessionEvents} from '../core/session-history.js'
import type {createSurfaceCursor,SurfaceCursorTransition} from 'dsh-nexttavern-native-session/surface'
import type {SessionEvent} from 'dsh-nexttavern-native-session'
import type {SessionHistoryCut} from '../core/session-history.js'

export interface StoryBlock { type?: string; [field: string]: unknown }
export interface StoryEvent {
  seq: number
  type: string
  time?: unknown
  data?: {
    agentPreset?: unknown
    turn?: unknown
    content?: readonly StoryBlock[]
    message?: { id?: unknown; content?: readonly StoryBlock[] }
    id?: unknown
    callId?: unknown
    name?: string
    interrupted?: unknown
    reason?: { kind?: string }
    compactionId?: unknown
    error?: unknown
    shadowedSeqs?: unknown
    source?: { kind?: string; stage?: string; form?: string; jobKind?: string; storySeq?: unknown; turn?: unknown; compactionId?: unknown }
  }
  sourceEventSeqs?: unknown
  surfaceOp?: StorySurfaceOp
}
export interface StorySession extends MessageViewSession<StoryEvent> {
  id: string
  events?: readonly StoryEvent[]
  log?: readonly StoryEvent[]
  surface?: { nodes?: Iterable<unknown>; contentGeneration?: number }
}
export interface StoryRow {
  id: string
  seq: number
  turn: number | null
  role: 'user' | 'assistant'
  messageId: unknown
  text: string
  time: unknown
}
interface ToolRow { id: string; seq: number; role: 'tool'; eventType: string; text: string; time: unknown }
type HistoryRow = StoryRow | ToolRow
export interface DirectorNotes {
  text?: unknown
  sourceKeys?: readonly unknown[]
  validated?: unknown
  [field: string]: unknown
}
type ValidDirectorNotes = DirectorNotes & { text: string; sourceKeys: readonly unknown[] }
export interface NotesRecord {
  directorNotes?: DirectorNotes | null
  directorCheckpoints?: readonly (DirectorNotes | null)[]
  notesCadence?: { schemaVersion?: unknown; slots?: readonly { turn?: unknown }[] }
}
interface HistoryOptions { query?: unknown; beforeSeq?: unknown; limit?: unknown; maxChars?: unknown; scope?: string }
interface ReadOptions { seq?: unknown; offset?: unknown; maxChars?: unknown; scope?: string }

function eventsOf(session: StorySession): readonly StoryEvent[] {
  return sessionEvents(session)
}

export function surfaceSeqsOf(session: StorySession): number[] {
  const nodes = session?.surface?.nodes
  if (!nodes || typeof nodes[Symbol.iterator] !== 'function') return []
  // Do not coerce null/empty strings to seq 0. A malformed projection must
  // omit the node rather than point at an unrelated event.
  return Array.from(nodes).filter((value): value is number => durableSeq(value) !== null)
}

export function contentOfEvent(event: StoryEvent | null | undefined) {
  if (event?.type === 'user/message') return event.data?.content
  if (event?.type === 'assistant/message') return event.data?.message?.content ?? event.data?.content
  return []
}

export function importManagementInputs(session: StorySession, evidence = eventsOf(session)) {
  const inputs = new Map<number, number>(), management = new Set<number>()
  const exportTurns = new Set<number | null>()
  for(const turn of adaptationTurns(evidence))exportTurns.add(turn)
  let authoring = false
  let turn: number | null = null
  for (const event of evidence) {
    if (event.type === 'turn/start') turn = Number(event.data?.turn)
    if (event.type === 'user/message' && event.data?.source?.kind === 'user' && turn !== null) inputs.set(turn,event.seq)
    if (event.type === 'tool/call' && event.data?.name === 'rp_card_import_begin') {
      const seq = inputs.get(Number(event.data?.turn))
      if (Number.isSafeInteger(seq)) management.add(seq!)
    }
    if(event.type==='tool/call'&&event.data?.name==='rp_card_draft_check')authoring=true
    if(event.type==='tool/call'&&['rp_card_import_begin','rp_commit_card'].includes(event.data?.name ?? ''))authoring=false
    if(event.type==='user/message'&&event.data?.source?.kind==='roleplay-tasks'&&event.data.source.stage==='after-story')authoring=false
    if(authoring&&event.type==='tool/call'&&event.data?.name==='ask_user_question')exportTurns.add(Number(event.data?.turn??turn))
    if(event.type==='tool/call' && /^(?:rp_card_export_(begin|chunk|finalize)|rp_novel_export|rp_diagnose|rp_preset|rp_card_draft_check)$/.test(event.data?.name??''))exportTurns.add(Number(event.data?.turn??turn))
    if(event.type==='user/message'&&event.data?.source?.kind==='roleplay-tasks'&&['card-export','novel-export'].includes(event.data?.source?.jobKind ?? ''))exportTurns.add(turn)
    if (event.type === 'turn/end') turn = null
  }
  const resumed=importedStoryProjection(evidence,surfaceSeqsOf(session)).prose
  for(const event of evidence) {
    if(event.type==='assistant/message'&&!resumed.has(event.seq)&&exportTurns.has(Number(event.data?.turn)))management.add(event.seq)
  }
  for(const turnId of exportTurns){const seq=inputs.get(turnId!);if(Number.isSafeInteger(seq))management.add(seq!)}
  return management
}

export function isStoryEvent(event: StoryEvent | null | undefined, canonicalAssistantSeqs: ReadonlySet<number> | null = null, management: ReadonlySet<number> = new Set()): event is StoryEvent {
  if (!event) return false
  if(management.has(event.seq))return false
  if (event.type === 'assistant/message') {
    return event.data?.interrupted !== true &&
      textOf(contentOfEvent(event)).trim().length > 0 &&
      (canonicalAssistantSeqs === null || canonicalAssistantSeqs.has(Number(event.seq)))
  }
  if (event.type !== 'user/message') return false
  return event.data?.source?.kind === 'user' && !management.has(event.seq) && textOf(contentOfEvent(event)).trim().length > 0
}

export function isCompletedTurnEnd(event: StoryEvent | null | undefined) {
  // Fail closed: aborted/error/interrupted/max-tokens output is not canonical
  // narrative. Only an explicitly completed turn may contribute its closing
  // assistant message or serve as an archive boundary.
  return event?.type === 'turn/end' && event.data?.reason?.kind === 'completed'
}

/**
 * A roleplay-tasks after-story phase is emitted only after the core has chosen
 * and appended its visible story response.  It is therefore a narrow durable
 * completion proof for that exact assistant sequence when later maintenance
 * ends the enclosing turn as aborted.  Do not infer this from text or turn
 * state: malformed, hidden, interrupted, cross-turn, or off-surface markers
 * are ignored.
 */
function afterStoryProofs(session: StorySession, visible = new Set(surfaceSeqsOf(session)), evidence = eventsOf(session)) {
  const log = eventsOf(session), committed = new Set<number>(), turns = new Set<number>()
  for (const marker of evidence) {
    const source = marker?.type === 'user/message' ? marker.data?.source : null
    if (source?.kind !== 'roleplay-tasks' || source?.form !== 'phase' || source?.stage !== 'after-story') continue
    const seq = Number(source.storySeq), turn = Number(source.turn)
    const original = Number.isSafeInteger(seq) ? log[seq] : null
    const story = original ? projectStoryEvent(session, original) : null
    if (!visible.has(Number(marker.seq)) || !visible.has(seq) || Number(marker.seq) <= seq ||
      !story || story.type !== 'assistant/message' || Number(story.seq) !== seq ||
      story.data?.interrupted === true || !textOf(contentOfEvent(story)).trim() ||
      !Number.isFinite(turn) || Number(story.data?.turn) !== turn) continue
    committed.add(seq); turns.add(turn)
  }
  return { committed, turns }
}

export function canonicalAssistantSeqsOf(session: StorySession, seqs = surfaceSeqsOf(session), evidence = eventsOf(session)) {
  const visible = new Set(seqs)
  const internal = new Set<number>()
  let inTask=false
  for(const event of evidence) {
    if(event?.type==='turn/start'||event?.type==='turn/end')inTask=false
    if(event?.type==='user/message'&&event.data?.source?.kind==='roleplay-tasks'&&event.data?.source?.form==='phase')inTask=event.data.source.stage!=='story'
    if(inTask&&event?.type==='assistant/message')internal.add(event.seq)
  }
  const completedTurns = new Set(evidence
    .filter(isCompletedTurnEnd)
    .map((event) => Number(event.data?.turn)))
  const afterStory = afterStoryProofs(session, visible, evidence)
  const lastByTurn = new Map<number, number>()
  for (const original of evidence) {
    const event = projectStoryEvent(session, original)
    if (event?.type !== 'assistant/message' ||
      !visible.has(Number(event.seq)) ||
      internal.has(event.seq) ||
      event.data?.interrupted === true ||
      !textOf(contentOfEvent(event)).trim()) continue
    const turn = Number(event.data?.turn)
    if (afterStory.committed.has(Number(event.seq))) lastByTurn.set(turn, Number(event.seq))
    // A durable after-story proof chooses the exact visible body. Never let
    // earlier tool commentary (or any other same-turn assistant output) become
    // a second canonical response merely because the enclosing turn completed.
    else if (afterStory.turns.has(turn)) continue
    else if (Number.isFinite(turn) && completedTurns.has(turn)) lastByTurn.set(turn, Number(event.seq))
  }
  return new Set(lastByTurn.values())
}

/** Restore only archived plot on the selected surface, never edited/deleted alternatives. */
const selectedStoryCache = new WeakMap<StorySession, {
  log: readonly StoryEvent[]; id: string; surfaceKey: string; generation: number; rows: readonly Readonly<StoryRow>[]
}>()
const selectedChatCache = new WeakMap<StorySession, {
  log: readonly StoryEvent[]; id: string; surfaceKey: string; generation: number; rows: readonly Readonly<StoryRow>[]
}>()
type StorySourceRow = Pick<StoryRow, 'seq' | 'role' | 'text'>
const ownedStoryRows = new WeakSet<StorySourceRow>()
const storySourceKeys = new WeakMap<StorySourceRow, string>()
const immutableStoryValues = new WeakSet()
const storyDataTypes = new Set(['turn/start','turn/end','user/message','assistant/message','tool/call','compaction/end','compaction/summary'])
function immutableStoryValue(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true
  if (immutableStoryValues.has(value)) return true
  if (!Object.isFrozen(value) || !Object.values(value).every(immutableStoryValue)) return false
  immutableStoryValues.add(value)
  return true
}
function expandSelectedHistorySeqs(surface:readonly number[],eventAt:(seq:number)=>StoryEvent|undefined,
  ended:ReadonlySet<string>,summaries:ReadonlyMap<string,StoryEvent>):number[] {
  const expanded:number[]=[],visited=new Set<number>()
  function expand(seq:unknown,depth=0):void {
    if(typeof seq!=='number'||durableSeq(seq)===null||visited.has(seq)||depth>256)return
    visited.add(seq)
    const event=eventAt(seq)
    if(!event||Number(event.seq)!==seq)return
    if(!isCompactedStoryEvent(event)){expanded.push(seq);return}
    if(event.data?.source?.kind==='roleplay-context-window') {
      for(const source of Array.isArray(event.sourceEventSeqs)?event.sourceEventSeqs:[])expand(source,depth+1)
      return
    }
    const id=String(event.data?.source?.compactionId??''),summary=summaries.get(id)
    if(!id||!ended.has(id)||!summary||summary.seq>=seq)return
    const archived=summary.data?.shadowedSeqs
    if(!Array.isArray(archived)||archived.some(source=>durableSeq(source)===null||source>=seq))return
    for(const source of archived)expand(source,depth+1)
  }
  for(const seq of surface)expand(seq)
  return expanded
}
function expandedHistorySeqs(session: StorySession, evidence = eventsOf(session)) {
  const log = eventsOf(session), surface = surfaceSeqsOf(session)
  const ended = new Set(evidence.filter((event) => event?.type === 'compaction/end' && !event.data?.error)
    .map((event) => String(event.data?.compactionId ?? '')))
  const summaries = new Map(evidence.filter((event) => event?.type === 'compaction/summary')
    .map((event) => [String(event.data?.compactionId ?? ''), event]))
  return expandSelectedHistorySeqs(surface,seq=>log[seq],ended,summaries)
}

export interface CanonicalChatMessageFacts {
  readonly messageVersionSha256:string
  readonly text:string
  readonly textSha256:string
}
export interface CanonicalChatEntry {
  readonly row:Readonly<StoryRow>
  readonly message:unknown
  /** Optional immutable-message facts supplied by the actual Native owner. */
  readonly messageFacts?:CanonicalChatMessageFacts
}
export interface CanonicalChatCut {
  readonly nativeCut:number
  readonly length:number
  at(index:number):CanonicalChatEntry|undefined
  range():IterableIterator<CanonicalChatEntry>
  /** Actual Native termination, independent of an early Core story proof. */
  nativeTurnEndSeq(turn:number):number|undefined
}
interface ChatTree {
  readonly item:CanonicalChatEntry;readonly priority:number;readonly size:number
  readonly left:ChatTree|undefined;readonly right:ChatTree|undefined
}
const chatSize=(tree:ChatTree|undefined)=>tree?.size??0
function chatNode(item:CanonicalChatEntry,left?:ChatTree,right?:ChatTree,priority?:number):ChatTree {
  let value=item.row.seq|0
  value=Math.imul(value^(value>>>16),0x45d9f3b);value=Math.imul(value^(value>>>16),0x45d9f3b)
  return {item,left,right,priority:priority??((value^(value>>>16))>>>0),size:1+chatSize(left)+chatSize(right)}
}
function chatSplit(tree:ChatTree|undefined,count:number):[ChatTree|undefined,ChatTree|undefined] {
  if(!tree)return [undefined,undefined]
  const left=chatSize(tree.left)
  if(count<=left) {
    const [before,after]=chatSplit(tree.left,count)
    return [before,chatNode(tree.item,after,tree.right,tree.priority)]
  }
  const [before,after]=chatSplit(tree.right,count-left-1)
  return [chatNode(tree.item,tree.left,before,tree.priority),after]
}
function chatMerge(left:ChatTree|undefined,right:ChatTree|undefined):ChatTree|undefined {
  if(!left)return right
  if(!right)return left
  return left.priority>=right.priority?chatNode(left.item,left.left,chatMerge(left.right,right),left.priority)
    :chatNode(right.item,chatMerge(left,right.left),right.right,right.priority)
}
function chatAt(tree:ChatTree|undefined,index:number):CanonicalChatEntry|undefined {
  if(!Number.isSafeInteger(index)||index<0||index>=chatSize(tree))return
  while(tree) {
    const left=chatSize(tree.left)
    if(index===left)return tree.item
    if(index<left)tree=tree.left
    else {index-=left+1;tree=tree.right}
  }
}
function *chatRange(tree:ChatTree|undefined):IterableIterator<CanonicalChatEntry> {
  if(!tree)return
  yield* chatRange(tree.left);yield tree.item;yield* chatRange(tree.right)
}
function chatSplice(tree:ChatTree|undefined,index:number,count:number,items:readonly CanonicalChatEntry[]) {
  const [before,tail]=chatSplit(tree,index),[,after]=chatSplit(tail,count)
  let middle:ChatTree|undefined
  for(const item of items)middle=chatMerge(middle,chatNode(item))
  return chatMerge(chatMerge(before,middle),after)
}

/** Canonical chat has a different policy from Schema's visible-message view.
 * Ordinary appends interpret only the new Native events. Receipt replacement
 * replays its affected turn; compaction/replacement recomputes selection.
 * Token cuts retain a root pointer, and row updates copy only tree paths. */
export function createSelectedCanonicalChatCursor(options:{
  sessionId:string;read():SessionHistoryCut<SessionEvent>;surface:ReturnType<typeof createSurfaceCursor>
  messageFacts?(message:object&{readonly content?:unknown}):CanonicalChatMessageFacts
  /** Story evidence excludes open/failed player rows; canonical chat retains them. */
  includeOpenUsers?:boolean
  /** Distinct selected-surface policy sharing this exact Native transition. */
  onAcceptedEvent?(event:SessionEvent,transition:SurfaceCursorTransition|undefined):void
}) {
  const owner=options.read().owner
  let cut=options.read(),root:ChatTree|undefined,disposed=false,currentTurn:number|null=null,internal=false,authoring=false
  const surface=options.surface,
    eventAt=(seq:number)=>seq>=0&&seq<surface.length?cut.at(seq) as unknown as StoryEvent|undefined:undefined
  const adaptation=createAdaptationActivityCursor(),importSelection=createImportedStorySelectionIndex(eventAt)
  type Segment={events:StoryEvent[];cursor:ReturnType<typeof createImportedStorySelectionCursor>;processed:number}
  const makeSegment=():Segment=>({events:[],cursor:createImportedStorySelectionCursor(importSelection.visible,importSelection.selected),processed:-1})
  let segment=makeSegment(),expanded:number[]=[]
  const segments=new Map<number,Segment>(),resumed=new Set<number>(),turnAt=new Map<number,number|null>(),
    originalTurns=new Map<number,number|null>(),
    inputs=new Map<number,number>(),inputTurns=new Map<number,number>(),bannedUsers=new Set<number>(),exports=new Set<number|null>(),
    nativeTurnEnds=new Map<number,StoryEvent>(),provedTurns=new Set<number>(),taskInternal=new Set<number>(),starts=new Set<string>(),closes=new Set<string>(),
    endedCompactions=new Set<string>(),summaries=new Map<string,StoryEvent>(),
    markers=new Map<number,StoryEvent[]>(),byTurn=new Map<number|null,Set<number>>(),
    selected=new Set<number>(),order=new Map<number,number>(),indices=new Map<number,number>(),
    entries=new Map<number,{message:unknown;item:CanonicalChatEntry}>(),canonical=new Map<number,number>()
  const roots:(ChatTree|undefined)[]=[undefined],versions:number[]=[0],
    changes:{seq:number;item:CanonicalChatEntry|undefined}[]=[]
  function turnOf(event:StoryEvent|undefined,seen=new Set<number>()):number|null {
    if(!event||seen.has(event.seq))return null
    const cached=originalTurns.get(event.seq)
    if(cached!==undefined)return cached
    seen.add(event.seq)
    const direct=Number.isSafeInteger(event.data?.turn)?Number(event.data?.turn):turnAt.get(event.seq)
    // Repeated out-of-turn windows inherit a previous window's turn, including
    // null. Its immutable provenance must not be walked again on every append.
    const value=direct!==null&&direct!==undefined?direct:typeof event.surfaceOp==='object'&&event.surfaceOp.op==='replace'
      ?turnOf(eventAt(event.surfaceOp.startSeq),seen):null
    originalTurns.set(event.seq,value);return value
  }
  function itemAt(seq:number):CanonicalChatEntry|undefined {
    const event=eventAt(seq)
    if(!event||event.type!=='user/message'&&event.type!=='assistant/message')return
    const message=surface.deriveEventMessage(cut.at(seq)!),prior=entries.get(seq)
    if(prior?.message===message)return prior.item
    const projected=projectStoryEvent({deriveEventMessage:()=>message},event),turn=turnOf(projected),
      row=Object.freeze({id:`${options.sessionId}:${seq}`,seq,turn,role:event.type==='user/message'?'user' as const:'assistant' as const,
        messageId:projected.data?.message?.id??projected.data?.id??null,text:textOf(contentOfEvent(projected)),time:event.time??null})
    ownedStoryRows.add(row)
    const item:CanonicalChatEntry={row,message}
    // Internal task rows can be inspected while choosing canonical prose.
    // Their bodies need no digest unless an actual selected reader asks for it.
    if(options.messageFacts)Object.defineProperty(item,'messageFacts',{get:()=>options.messageFacts!(message!)})
    Object.freeze(item)
    entries.set(seq,{message,item});return item
  }
  function management(seq:number):boolean {
    const event=eventAt(seq)!
    if(event.type==='user/message') {
      const inputTurn=inputTurns.get(seq)
      return bannedUsers.has(seq)||inputTurn!==undefined
        &&(exports.has(inputTurn)||adaptation.turns.has(inputTurn))&&inputs.get(inputTurn)===seq
    }
    return !resumed.has(seq)&&(exports.has(Number(event.data?.turn))||adaptation.turns.has(Number(event.data?.turn)))
  }
  function eligible(seq:number):CanonicalChatEntry|undefined {
    if(!selected.has(seq))return
    const event=eventAt(seq),item=itemAt(seq)
    if(!event||!item||item.row.turn===null||!item.row.text.trim()||management(seq))return
    if(event.type==='user/message')return event.data?.source?.kind==='user'
      &&(options.includeOpenUsers!==false||isCompletedTurnEnd(nativeTurnEnds.get(item.row.turn))||provedTurns.has(item.row.turn))?item:undefined
    return event.data?.interrupted!==true&&canonical.get(Number(event.data?.turn))===seq?item:undefined
  }
  function setRow(seq:number,item:CanonicalChatEntry|undefined) {
    const index=indices.get(seq)
    if(index!==undefined) {
      if(chatAt(root,index)===item)return
      root=chatSplice(root,index,1,item?[item]:[])
      if(!item) {
        indices.delete(seq)
        if(index<chatSize(root))for(const [key,position]of indices)if(position>index)indices.set(key,position-1)
      }
    }else if(item) {
      let position=chatSize(root),before=(order.get(seq)??0)-1
      if(position&&((order.get(chatAt(root,position-1)!.row.seq)??-1)>before)) {
        position=0
        for(;before>=0;before--){const previous=indices.get(expanded[before]!);if(previous!==undefined){position=previous+1;break}}
      }
      if(position<chatSize(root))for(const [key,prior]of indices)if(prior>=position)indices.set(key,prior+1)
      root=chatSplice(root,position,0,[item]);indices.set(seq,position)
    }else return
    changes.push({seq,item})
  }
  function refreshTurn(turn:number|null,dirty:Set<number>) {
    if(turn===null){for(const seq of byTurn.get(null)??[])dirty.add(seq);return}
    const proofs=new Set<number>()
    for(const marker of markers.get(Number(turn))??[]) {
      const source=marker.data?.source!,seq=Number(source.storySeq),story=eventAt(seq),item=itemAt(seq)
      if(selected.has(marker.seq)&&selected.has(seq)&&marker.seq>seq&&story?.type==='assistant/message'
        &&story.data?.interrupted!==true&&item?.row.text.trim()&&Number.isFinite(Number(source.turn))
        &&Number(story.data?.turn)===Number(source.turn))proofs.add(seq)
    }
    if(proofs.size)provedTurns.add(turn);else provedTurns.delete(turn)
    let last:number|undefined
    for(const seq of byTurn.get(turn)??[]) {
      dirty.add(seq)
      const event=eventAt(seq),item=itemAt(seq)
      if(event?.type!=='assistant/message'||!selected.has(seq)||taskInternal.has(seq)
        ||event.data?.interrupted===true||!item?.row.text.trim())continue
      const nativeTurn=Number(event.data?.turn)
      if(proofs.has(seq)||!proofs.size&&Number.isFinite(nativeTurn)&&isCompletedTurnEnd(nativeTurnEnds.get(nativeTurn))) {
        if(last===undefined||seq>last)last=seq
      }
    }
    if(last===undefined)canonical.delete(Number(turn));else canonical.set(Number(turn),last)
  }
  function rebuildRows() {
    const target=expanded.flatMap(seq=>{const item=eligible(seq);return item?[item]:[]}),old=[...chatRange(root)]
    let prefix=0,suffix=0
    while(prefix<old.length&&prefix<target.length&&old[prefix]===target[prefix])prefix++
    while(suffix<old.length-prefix&&suffix<target.length-prefix
      &&old[old.length-1-suffix]===target[target.length-1-suffix])suffix++
    if(prefix===old.length&&prefix===target.length)return
    const next=new Map(target.map(item=>[item.row.seq,item]))
    for(const item of old)if(!next.has(item.row.seq))changes.push({seq:item.row.seq,item:undefined})
    const previous=new Map(old.map(item=>[item.row.seq,item]))
    for(const item of target)if(previous.get(item.row.seq)!==item)changes.push({seq:item.row.seq,item})
    root=chatSplice(root,prefix,old.length-prefix-suffix,target.slice(prefix,target.length-suffix))
    indices.clear();for(const [index,item]of target.entries())indices.set(item.row.seq,index)
  }
  function advance(event:SessionEvent,transition:SurfaceCursorTransition|undefined) {
    const row=event as unknown as StoryEvent,type=row.type,dirtyTurns=new Set<number|null>(),dirty=new Set<number>()
    if(type==='turn/start'){currentTurn=Number(row.data?.turn);internal=false;segment=makeSegment()}
    if(type!=='assistant/chunk')turnAt.set(row.seq,currentTurn)
    const callId=row.data?.callId??row.data?.id,name=row.data?.name??''
    if(type==='tool/call'&&typeof callId==='string') {
      if(['rp_source_begin','rp_source_library'].includes(name))starts.add(callId)
      if(['rp_source_close','rp_commit_card','rp_card_import_begin'].includes(name))closes.add(callId)
    }
    const resultId=(row.data?.message as {source?:{callId?:string}}|undefined)?.source?.callId,
      relevant=storyDataTypes.has(type)||type==='tool/result'&&!!resultId&&(starts.has(resultId)||closes.has(resultId))
    if(relevant) {
      segment.events.push(row);segments.set(row.seq,segment)
      for(const turn of adaptation.advance(row))dirtyTurns.add(turn)
      if(type==='user/message'&&row.data?.source?.kind==='user'&&currentTurn!==null) {
        const previous=inputs.get(currentTurn);if(previous!==undefined)dirty.add(previous)
        inputTurns.set(row.seq,currentTurn)
        inputs.set(currentTurn,row.seq);dirtyTurns.add(currentTurn)
      }
      if(type==='tool/call'&&name==='rp_card_import_begin') {
        const input=inputs.get(Number(row.data?.turn));if(input!==undefined){bannedUsers.add(input);dirty.add(input)}
      }
      if(type==='tool/call'&&name==='rp_card_draft_check')authoring=true
      if(type==='tool/call'&&['rp_card_import_begin','rp_commit_card'].includes(name))authoring=false
      if(type==='user/message'&&row.data?.source?.kind==='roleplay-tasks'&&row.data.source.stage==='after-story')authoring=false
      let exported:number|null|undefined
      if(authoring&&type==='tool/call'&&name==='ask_user_question')exported=Number(row.data?.turn??currentTurn)
      if(type==='tool/call'&&/^(?:rp_card_export_(begin|chunk|finalize)|rp_novel_export|rp_diagnose|rp_preset|rp_card_draft_check)$/.test(name))
        exported=Number(row.data?.turn??currentTurn)
      if(type==='user/message'&&row.data?.source?.kind==='roleplay-tasks'
        &&['card-export','novel-export'].includes(row.data.source.jobKind??''))exported=currentTurn
      if(exported!==undefined&&!exports.has(exported)){exports.add(exported);dirtyTurns.add(exported)}
      if(type==='turn/end'){
        nativeTurnEnds.set(Number(row.data?.turn),row)
        internal=false;dirtyTurns.add(Number(row.data?.turn))
      }
      if(type==='user/message'&&row.data?.source?.kind==='roleplay-tasks'&&row.data.source.form==='phase') {
        internal=row.data.source.stage!=='story'
        if(row.data.source.stage==='after-story') {
          const turn=Number(row.data.source.turn),bucket=markers.get(turn)??[]
          bucket.push(row);markers.set(turn,bucket);dirtyTurns.add(turn)
        }
      }
      if(type==='assistant/message'&&internal)taskInternal.add(row.seq)
    }
    if(type==='user/message'||type==='assistant/message') {
      const turn=turnOf(row),bucket=byTurn.get(turn)??new Set<number>()
      bucket.add(row.seq);byTurn.set(turn,bucket)
    }
    const removed=transition?.kind==='replace'?transition.removed:[],
      added=transition?.kind==='append'||transition?.kind==='replace'?[transition.seq]:[],
      changed=importSelection.changeVisible(removed,added),replay=new Set<Segment>()
    for(const seq of changed){const prior=segments.get(seq);if(prior&&seq<=prior.processed)replay.add(prior)}
    const updateImported=(part:Segment,again:boolean)=>{
      const previous=new Set(part.cursor.prose)
      if(again) {
        part.cursor=createImportedStorySelectionCursor(importSelection.visible,importSelection.selected)
        for(const item of part.events)part.cursor.advance(item)
      }
      else part.cursor.advance(row)
      part.processed=part.events.at(-1)?.seq??-1
      for(const seq of previous)if(!part.cursor.prose.has(seq)){resumed.delete(seq);dirtyTurns.add(turnOf(eventAt(seq)))}
      for(const seq of part.cursor.prose)if(!previous.has(seq)){resumed.add(seq);dirtyTurns.add(turnOf(eventAt(seq)))}
    }
    for(const part of replay)updateImported(part,true)
    if(relevant&&!replay.has(segment))updateImported(segment,false)
    // System prompt reconciliation changes no chat or receipt ancestry. Keep
    // system nodes out of this chat ordering index, including systems restored
    // inside an archive, so a new head cannot shift or rebuild every chat row.
    const systemOnlyReplacement=transition?.kind==='replace'&&type==='system/message'
      &&transition.removed.every(seq=>eventAt(seq)?.type==='system/message')
    let positional=transition?.kind==='replace'&&!systemOnlyReplacement
      ||transition?.kind==='append'&&isCompactedStoryEvent(row)
    if(type==='compaction/summary'){summaries.set(String(row.data?.compactionId??''),row);positional=true}
    if(type==='compaction/end'&&!row.data?.error){endedCompactions.add(String(row.data?.compactionId??''));positional=true}
    if(positional) {
      const next=expandSelectedHistorySeqs(surface.nodes,eventAt,endedCompactions,summaries)
        .filter(seq=>eventAt(seq)?.type!=='system/message')
      if(next.length!==expanded.length||next.some((seq,index)=>seq!==expanded[index])) {
        for(const seq of expanded)dirtyTurns.add(turnOf(eventAt(seq)))
        expanded=next;selected.clear();order.clear()
        for(const [index,seq]of expanded.entries()){selected.add(seq);order.set(seq,index);dirtyTurns.add(turnOf(eventAt(seq)))}
      }else positional=false
    }else if(transition?.kind==='append'&&type!=='system/message') {
      selected.add(row.seq);order.set(row.seq,expanded.length);expanded.push(row.seq);dirtyTurns.add(turnOf(row))
    }
    if(transition?.kind==='project')for(const seq of transition.changedSeqs) {
      entries.delete(seq);dirtyTurns.add(turnOf(eventAt(seq)))
    }
    for(const turn of dirtyTurns) {
      if(turn!==null){const input=inputs.get(turn);if(input!==undefined)dirty.add(input)}
      refreshTurn(turn,dirty)
    }
    if(positional)rebuildRows()
    else for(const seq of [...dirty].sort((a,b)=>(order.get(a)??-1)-(order.get(b)??-1)))setRow(seq,eligible(seq))
    if(type==='turn/end')currentTurn=null
    roots.push(root);versions.push(changes.length)
    options.onAcceptedEvent?.(event,transition)
  }
  return {
    atCut(nativeCut:number):CanonicalChatCut {
      if(disposed)throw Error('CANONICAL_CHAT_CURSOR_DISPOSED')
      const latest=options.read()
      if(latest.owner!==owner)throw Error('CANONICAL_CHAT_OWNER_CHANGED')
      if(latest.length>=cut.length)cut=latest
      if(!Number.isSafeInteger(nativeCut)||nativeCut<0||nativeCut>cut.length)throw Error('CANONICAL_CHAT_CUT_INVALID')
      let transition:SurfaceCursorTransition|undefined
      if(nativeCut>surface.length)surface.advanceTo(nativeCut,value=>{transition=value},event=>{
        advance(event,transition);transition=undefined
      })
      else surface.advanceTo(surface.length)
      const saved=roots[nativeCut],length=chatSize(saved)
      return Object.freeze({nativeCut,length,at:(index:number)=>chatAt(saved,index),range:()=>chatRange(saved),
        nativeTurnEndSeq:(turn:number)=>{
          const seq=nativeTurnEnds.get(turn)?.seq
          return seq!==undefined&&seq<nativeCut?seq:undefined
        }})
    },
    changes(from:number,through:number):readonly {seq:number;item:CanonicalChatEntry|undefined}[] {
      if(from<0||through<from||through>surface.length)throw Error('CANONICAL_CHAT_CUT_INVALID')
      const latest=new Map<number,CanonicalChatEntry|undefined>()
      for(let index=versions[from]!;index<versions[through]!;index++){const change=changes[index]!;latest.set(change.seq,change.item)}
      return [...latest].map(([seq,item])=>({seq,item}))
    },
    /** Current selected DATA after atCut; retained cut views keep their own root. */
    currentPosition(seq:number):number|undefined {return indices.get(seq)},
    currentEntries(seqs:readonly number[]):readonly CanonicalChatEntry[] {
      const positions:number[]=[]
      for(const seq of new Set(seqs)){const index=indices.get(seq);if(index!==undefined)positions.push(index)}
      return positions.sort((left,right)=>left-right).map(index=>chatAt(root,index)!)
    },
    dispose(){disposed=true;roots.length=0;versions.length=0;changes.length=0},
  }
}

function selectedCanonicalHistory(session: StorySession,includeOpenUsers:boolean):readonly Readonly<StoryRow>[] {
  const log = eventsOf(session)
  const surface = surfaceSeqsOf(session), surfaceKey = surface.join(',')
  const generation = messageViewGeneration(session)
  // Native snapshots are immutable and replaced on every append. Cache only
  // that contract, never mutable legacy/mock logs; selection is a separate key.
  const cache=includeOpenUsers?selectedChatCache:selectedStoryCache
  const cached = cache.get(session)
  if (generation !== null && cached?.generation === generation && cached.log === log &&
    cached.id === session.id && cached.surfaceKey === surfaceKey) return cached.rows
  // Token chunks contribute only immutable type/seq, not their payload. Story
  // evidence payloads must also be deeply immutable, including legacy callers.
  let cacheable = generation !== null && Object.isFrozen(log)
  const evidence: StoryEvent[] = []
  const turnBySeq = new Map<number, number | null>()
  const researchClosures = new Set<string>(), researchStarts = new Set<string>()
  let turn: number | null = null
  // Scan token-heavy history once; keep full seq addressing for replacement
  // provenance while subsequent evidence passes visit only relevant events.
  for (const event of log) {
    const type = event?.type
    const nativeCallId=event?.data?.callId??event?.data?.id
    if(type==='tool/call'&&['rp_source_begin','rp_source_library'].includes(event.data?.name??'')&&typeof nativeCallId==='string')researchStarts.add(nativeCallId)
    if(type==='tool/call'&&['rp_source_close','rp_commit_card','rp_card_import_begin'].includes(event.data?.name??'')&&typeof nativeCallId==='string')researchClosures.add(nativeCallId)
    const callId=(event?.data?.message as {source?:{callId?:string}}|undefined)?.source?.callId
    const relevant = storyDataTypes.has(type)||(type==='tool/result'&&!!callId&&(researchStarts.has(callId)||researchClosures.has(callId)))
    if (relevant) evidence.push(event)
    if (cacheable && (!Object.isFrozen(event) || (relevant && !immutableStoryValue(event)))) cacheable = false
    if (type === 'turn/start') turn = Number(event.data?.turn)
    if (event) turnBySeq.set(event.seq, turn)
    if (type === 'turn/end') turn = null
  }
  const management = importManagementInputs(session, evidence)
  const expanded = expandedHistorySeqs(session, evidence)
  const canonical = canonicalAssistantSeqsOf(session, expanded, evidence)
  const completed = new Set(evidence.filter(isCompletedTurnEnd).map((event) => Number(event.data?.turn)))
  const afterStory = afterStoryProofs(session, new Set(expanded), evidence)
  const originalTurn = (event: StoryEvent | null | undefined, seen = new Set<number>()): number | null => {
    if (!event || seen.has(event.seq)) return null
    seen.add(event.seq)
    const direct = Number.isSafeInteger(event.data?.turn) ? Number(event.data?.turn) : turnBySeq.get(event.seq)
    if (direct !== null && direct !== undefined) return direct
    if (typeof event.surfaceOp === 'object' && event.surfaceOp.op === 'replace') return originalTurn(log[event.surfaceOp.startSeq], seen)
    return null
  }
  const rows: StoryRow[] = expanded.map((seq) => {
    const event = log[seq]
    return event ? projectStoryEvent(session, event) : undefined
  }).filter((event): event is StoryEvent => {
    if (!isStoryEvent(event, canonical, management)) return false
    const turn = originalTurn(event)
    return turn !== null && (completed.has(turn) || afterStory.turns.has(turn)
      ||includeOpenUsers&&event.type==='user/message')
  }).map((event) => ({
    id: `${session.id}:${event.seq}`,
    seq: event.seq,
    turn: originalTurn(event),
    role: event.type === 'user/message' ? 'user' : 'assistant',
    messageId: event.data?.message?.id ?? event.data?.id ?? null,
    text: textOf(contentOfEvent(event)),
    time: event.time ?? null,
  }))
  const snapshot = Object.freeze(rows.map(row => {
    const owned = Object.freeze(row)
    ownedStoryRows.add(owned)
    return owned
  }))
  if (cacheable && generation !== null) cache.set(session, {
    log, id: session.id, surfaceKey, generation, rows: snapshot,
  })
  return snapshot
}
export function selectedStoryHistory(session:StorySession):StoryRow[] {
  return selectedStoryHistorySnapshot(session).map(row => ({...row}))
}
/** The history owner retains this immutable view until its actual log,
 * selection or projection changes. Export readers can reuse its text index. */
export function selectedStoryHistorySnapshot(session:StorySession):readonly Readonly<StoryRow>[] {
  return selectedCanonicalHistory(session,false)
}
/** Full logical selected chat: canonical completed prose plus still selected
 * real player inputs from open/failed turns. Compaction expands proven source
 * events; tool commentary, management and alternative/deleted replies remain
 * governed by the same owner policy used for the original story history. */
export function selectedCanonicalChatHistory(session:StorySession):StoryRow[] {
  return selectedCanonicalHistory(session,true).map(row => ({...row}))
}

function queryHistoryRows(session: StorySession, scope?: string): readonly HistoryRow[] {
  if (scope === 'story' || scope === undefined) return selectedStoryHistorySnapshot(session)
  if (scope !== 'tools') throw new Error('历史查询范围无效')
  const log = eventsOf(session)
  return expandedHistorySeqs(session).map(seq => log[seq]).flatMap((event): ToolRow[] => {
    let content: readonly StoryBlock[] | undefined
    if (!event) return []
    if (event.type === 'tool/result') content = event.data?.message?.content ?? event.data?.content
    else if (event.type === 'assistant/message') content = event.data?.message?.content?.filter(block => block.type === 'tool-call')
    else return []
    if (!content?.length) return []
    return [{id:`${session.id}:${event.seq}`,seq:event.seq,role:'tool',eventType:event.type,
      text:JSON.stringify(content),time:event.time??null}]
  })
}

/** Bounded history results use source seq cursors, not the full transcript as prompt. */
export function queryStoryHistory(session: StorySession,
  { query = '', beforeSeq, limit = 12, maxChars = 12000, scope = 'story' }: HistoryOptions = {},
  storyRows?:readonly Readonly<StoryRow>[]) {
  const cap = Math.max(1, Math.min(100, Number(limit) || 12))
  const budget = Math.max(256, Math.min(60000, Number(maxChars) || 12000))
  const all = scope==='story'&&storyRows?storyRows:queryHistoryRows(session, scope)
  const before = durableSeq(beforeSeq)
  const end = before === null ? all.length : all.findIndex((entry) => entry.seq === before)
  if (end < 0) throw new Error('历史游标不属于当前选中分支')
  const terms = String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const candidates = all.slice(0, end).filter((entry) => {
    if (!terms.length) return true
    const normalized = entry.text.toLocaleLowerCase()
    return terms.every((term) => normalized.includes(term))
  })
  const results: (HistoryRow & { textOffset: number; truncated: boolean })[] = []
  let used = 0
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (results.length >= cap || used >= budget) break
    const entry = candidates[index]!
    const remaining = budget - used
    const position = terms.length ? Math.max(0, entry.text.toLocaleLowerCase().indexOf(terms[0]!) - 240) : 0
    const available = entry.text.slice(position, position + remaining)
    results.push({ ...entry, text: available, textOffset: position, truncated: position > 0 || available.length < entry.text.length })
    used += available.length
  }
  results.reverse()
  return { sessionId: session.id, totalEntries: all.length, matchedEntries: candidates.length, entries: results,
    nextBeforeSeq: candidates.length > results.length ? results[0]?.seq ?? null : null }
}

export function readStoryHistory(session: StorySession,
  { seq, offset = 0, maxChars = 12000, scope = 'story' }: ReadOptions = {},
  storyRows?:readonly Readonly<StoryRow>[]) {
  const rows=scope==='story'&&storyRows?storyRows:queryHistoryRows(session,scope)
  const entry = rows.find((entry) => entry.seq === durableSeq(seq))
  if (!entry) throw new Error('历史条目不属于当前选中分支')
  const start = Math.max(0, Math.min(entry.text.length, Number.isSafeInteger(offset) ? Number(offset) : 0))
  const budget = Math.max(256, Math.min(60000, Number(maxChars) || 12000))
  const end = Math.min(entry.text.length, start + budget)
  return { ...entry, text: entry.text.slice(start, end), textOffset: start, totalChars: entry.text.length,
    nextOffset: end < entry.text.length ? end : null }
}

export function historySourceKeys(entries: readonly StorySourceRow[]) {
  return entries.map(entry => {
    const cached = storySourceKeys.get(entry)
    if (cached !== undefined) return cached
    const key = `${entry.seq}:${createHash('sha256').update(`${entry.role}\n${entry.text}`).digest('hex')}`
    // Only rows created and frozen by this history owner can retain a key.
    // Public mutable entries continue to reflect their current text and role.
    if (ownedStoryRows.has(entry)) storySourceKeys.set(entry, key)
    return key
  })
}

export function storyCadenceSlots(entries: readonly StoryRow[]) {
  const anchors = new Map<number | null, number>()
  for (const entry of entries) {
    if (entry.role !== 'user' || !Number.isFinite(entry.turn) || anchors.has(entry.turn)) continue
    anchors.set(entry.turn, entry.seq)
  }
  const seen = new Set<number | null>(), slots: { turn: number | null; anchorSeq: number }[] = []
  for (const entry of entries) {
    if (entry.role !== 'assistant' || !Number.isFinite(entry.turn) || seen.has(entry.turn)) continue
    seen.add(entry.turn)
    slots.push({ turn: entry.turn, anchorSeq: anchors.get(entry.turn) ?? entry.seq })
  }
  return slots
}

export function legacyCadenceSlots(entries: readonly StoryRow[], record?: NotesRecord | null) {
  let coveredEntries = Array.isArray(record?.directorNotes?.sourceKeys) ? record.directorNotes.sourceKeys.length : 0
  for (const note of Array.isArray(record?.directorCheckpoints) ? record.directorCheckpoints : []) {
    if (Array.isArray(note?.sourceKeys)) coveredEntries = Math.max(coveredEntries, note.sourceKeys.length)
  }
  coveredEntries = Math.min(entries.length, coveredEntries)
  return storyCadenceSlots(entries.slice(0, coveredEntries))
}

/** Count canonical story slots, not physical agent turns or regenerated versions. */
export function memoryNotesCadence(session: StorySession, record?: NotesRecord | null, everyTurns = 3,
  entries=selectedStoryHistorySnapshot(session),sourceKeys:readonly string[]=historySourceKeys(entries)) {
  const notes = directorNotesForBranch(record, session, entries,sourceKeys)
  const slots = storyCadenceSlots(entries)
  const storedSlots = record?.notesCadence?.schemaVersion === 1 && Array.isArray(record.notesCadence.slots)
    ? record.notesCadence.slots
    : legacyCadenceSlots(entries, record)
  let coveredTurns = 0
  while (coveredTurns < slots.length && coveredTurns < storedSlots.length
    && Number(slots[coveredTurns]!.turn) === Number(storedSlots[coveredTurns]?.turn)) coveredTurns += 1
  const validCoveredTurns = storyCadenceSlots(entries.slice(0, notes?.sourceKeys.length ?? 0)).length
  const completedTurns = slots.length
  const pendingTurns = Math.max(0, completedTurns - coveredTurns)
  const previous = record?.directorNotes
  const rebuildRequired = Boolean(previous?.sourceKeys?.length && previous !== undefined &&
    (!notes || notes.sourceKeys.length < previous.sourceKeys.length))
  const interval = Number.isSafeInteger(everyTurns) && everyTurns > 0 ? everyTurns : 3
  return {schemaVersion:1, branchId:session.id, completedTurns, coveredTurns, pendingTurns,
    validCoveredTurns, rebuildRequired, due:pendingTurns >= interval}
}

/** Exact content provenance rejects stale notes after edits or sibling switches. */
export function directorNotesForBranch(value: unknown, session: StorySession, entries = selectedStoryHistorySnapshot(session),
  sourceKeys:readonly string[]=historySourceKeys(entries)): (ValidDirectorNotes & { pendingEntries: number }) | null {
  const object = (input: unknown): input is Record<string, unknown> => input !== null && typeof input === 'object'
  const record = object(value) ? value : {}
  const actual=sourceKeys
  const matches=(notes: unknown): notes is ValidDirectorNotes => Boolean(object(notes)&&typeof notes.text==='string'&&notes.text.trim()&&Array.isArray(notes.sourceKeys)
    &&notes.sourceKeys.length>0&&notes.sourceKeys.length<=actual.length
    &&notes.sourceKeys.every((key,index)=>key===actual[index]))
  // User-edited/current notes remain authoritative when their exact prefix is
  // valid. A fork may discard only their tail: recover a validated saved prefix
  // rather than paying to rewrite all prior notes. No sibling content is used.
  let notes: ValidDirectorNotes | null | undefined = matches(record?.directorNotes)?record.directorNotes:null
  if (!notes) {
    for (const candidate of Array.isArray(record?.directorCheckpoints) ? record.directorCheckpoints : []) {
      if (candidate?.validated === true && matches(candidate) && (!notes || candidate.sourceKeys.length > notes.sourceKeys.length)) notes = candidate
    }
  }
  return notes?{...notes,pendingEntries:entries.length-notes.sourceKeys.length}:null
}

export function isCompactedStoryEvent(event: StoryEvent | null | undefined) {
  return event?.type === 'user/message'
    && (event?.data?.source?.kind === 'compact-checkpoint' || event?.data?.source?.kind === 'roleplay-context-window')
}
