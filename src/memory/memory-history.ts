import { createHash } from 'node:crypto'
import { durableSeq, textOf, adaptationTurns, importedStoryProjection } from './memory-provenance.js'
import { projectStoryEvent, messageViewGeneration, type MessageViewSession, type StorySurfaceOp } from '../core/roleplay-message-view.js'
import {sessionEvents} from '../core/session-history.js'

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
    source?: { kind?: string; plugin?: string; stage?: string; form?: string; jobKind?: string; storySeq?: unknown; turn?: unknown; compactionId?: unknown }
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
    if(event.type==='user/message'&&event.data?.source?.plugin==='roleplay-tasks'&&event.data.source.stage==='after-story')authoring=false
    if(authoring&&event.type==='tool/call'&&event.data?.name==='ask_user_question')exportTurns.add(Number(event.data?.turn??turn))
    if(event.type==='tool/call' && /^(?:rp_card_export_(begin|chunk|finalize)|rp_novel_export|rp_diagnose|rp_preset|rp_card_draft_check)$/.test(event.data?.name??''))exportTurns.add(Number(event.data?.turn??turn))
    if(event.type==='user/message'&&event.data?.source?.plugin==='roleplay-tasks'&&['card-export','novel-export'].includes(event.data?.source?.jobKind ?? ''))exportTurns.add(turn)
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
    if (source?.kind !== 'plugin' || source?.plugin !== 'roleplay-tasks' || source?.form !== 'phase' || source?.stage !== 'after-story') continue
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
    if(event?.type==='user/message'&&event.data?.source?.kind==='plugin'&&event.data?.source?.plugin==='roleplay-tasks'&&event.data?.source?.form==='phase')inTask=event.data.source.stage!=='story'
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
  log: readonly StoryEvent[]; id: string; surfaceKey: string; generation: number; rows: StoryRow[]
}>()
const immutableStoryValues = new WeakSet()
const storyDataTypes = new Set(['turn/start','turn/end','user/message','assistant/message','tool/call','compaction/end','compaction/summary'])
function immutableStoryValue(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true
  if (immutableStoryValues.has(value)) return true
  if (!Object.isFrozen(value) || !Object.values(value).every(immutableStoryValue)) return false
  immutableStoryValues.add(value)
  return true
}
function expandedHistorySeqs(session: StorySession, evidence = eventsOf(session)) {
  const log = eventsOf(session), surface = surfaceSeqsOf(session)
  const ended = new Set(evidence.filter((event) => event?.type === 'compaction/end' && !event.data?.error)
    .map((event) => String(event.data?.compactionId ?? '')))
  const summaries = new Map(evidence.filter((event) => event?.type === 'compaction/summary')
    .map((event) => [String(event.data?.compactionId ?? ''), event]))
  const expanded: number[] = []
  const visited = new Set<number>()
  const expand = (seq: unknown, depth = 0): void => {
    if (typeof seq !== 'number' || durableSeq(seq) === null || visited.has(seq) || depth > 256) return
    visited.add(seq)
    const event = log[seq]
    if (!event || Number(event.seq) !== seq) return
    if (isCompactedStoryEvent(event)) {
      if (event.data?.source?.plugin === 'roleplay-context-window') {
        const archived = Array.isArray(event.sourceEventSeqs) ? event.sourceEventSeqs : []
        for (const source of archived) expand(source, depth + 1)
        return
      }
      const id = String(event.data?.source?.compactionId ?? '')
      const summary = summaries.get(id)
      if (!id || !ended.has(id) || !summary || summary.seq >= seq) return
      const archived = summary.data?.shadowedSeqs
      if (!Array.isArray(archived) || archived.some((source) => durableSeq(source) === null || source >= seq)) return
      for (const source of archived) expand(source, depth + 1)
    } else expanded.push(seq)
  }
  for (const seq of surface) expand(seq)
  return expanded
}

export function selectedStoryHistory(session: StorySession): StoryRow[] {
  const log = eventsOf(session)
  const surface = surfaceSeqsOf(session), surfaceKey = surface.join(',')
  const generation = messageViewGeneration(session)
  // Native snapshots are immutable and replaced on every append. Cache only
  // that contract, never mutable legacy/mock logs; selection is a separate key.
  const cached = selectedStoryCache.get(session)
  if (generation !== null && cached?.generation === generation && cached.log === log &&
    cached.id === session.id && cached.surfaceKey === surfaceKey) return cached.rows.map(row => ({ ...row }))
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
    return turn !== null && (completed.has(turn) || afterStory.turns.has(turn))
  }).map((event) => ({
    id: `${session.id}:${event.seq}`,
    seq: event.seq,
    turn: originalTurn(event),
    role: event.type === 'user/message' ? 'user' : 'assistant',
    messageId: event.data?.message?.id ?? event.data?.id ?? null,
    text: textOf(contentOfEvent(event)),
    time: event.time ?? null,
  }))
  if (cacheable && generation !== null) selectedStoryCache.set(session, {
    log, id: session.id, surfaceKey, generation, rows: rows.map(row => ({ ...row })),
  })
  return rows
}

function queryHistoryRows(session: StorySession, scope?: string): HistoryRow[] {
  if (scope === 'story' || scope === undefined) return selectedStoryHistory(session)
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
export function queryStoryHistory(session: StorySession, { query = '', beforeSeq, limit = 12, maxChars = 12000, scope = 'story' }: HistoryOptions = {}) {
  const cap = Math.max(1, Math.min(100, Number(limit) || 12))
  const budget = Math.max(256, Math.min(60000, Number(maxChars) || 12000))
  const all = queryHistoryRows(session, scope)
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

export function readStoryHistory(session: StorySession, { seq, offset = 0, maxChars = 12000, scope = 'story' }: ReadOptions = {}) {
  const entry = queryHistoryRows(session, scope).find((entry) => entry.seq === durableSeq(seq))
  if (!entry) throw new Error('历史条目不属于当前选中分支')
  const start = Math.max(0, Math.min(entry.text.length, Number.isSafeInteger(offset) ? Number(offset) : 0))
  const budget = Math.max(256, Math.min(60000, Number(maxChars) || 12000))
  const end = Math.min(entry.text.length, start + budget)
  return { ...entry, text: entry.text.slice(start, end), textOffset: start, totalChars: entry.text.length,
    nextOffset: end < entry.text.length ? end : null }
}

export function historySourceKeys(entries: readonly Pick<StoryRow, 'seq' | 'role' | 'text'>[]) {
  return entries.map((entry) => `${entry.seq}:${createHash('sha256').update(`${entry.role}\n${entry.text}`).digest('hex')}`)
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
export function memoryNotesCadence(session: StorySession, record?: NotesRecord | null, everyTurns = 3) {
  const entries = selectedStoryHistory(session)
  const notes = directorNotesForBranch(record, session, entries)
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
export function directorNotesForBranch(value: unknown, session: StorySession, entries = selectedStoryHistory(session)): (ValidDirectorNotes & { pendingEntries: number }) | null {
  const object = (input: unknown): input is Record<string, unknown> => input !== null && typeof input === 'object'
  const record = object(value) ? value : {}
  const actual=historySourceKeys(entries)
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
    && event?.data?.source?.kind === 'plugin'
    && (event?.data?.source?.plugin === 'compact' || event?.data?.source?.plugin === 'roleplay-context-window')
}
