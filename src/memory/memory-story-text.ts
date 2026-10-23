import {createHash} from 'node:crypto'
import { selectedStoryHistorySnapshot, importManagementInputs, type StorySession, type StoryRow, type StoryEvent, type StoryBlock } from './memory-history.js'
import { projectStoryEvent } from '../core/roleplay-message-view.js'
import {sessionEvents} from '../core/session-history.js'

export interface SourceSpan { start: number; end: number }
export interface CleanStoryText { text: string; spans: SourceSpan[]; unresolved: boolean }
export type RetrievalRow = StoryRow & { rawText: string; spans: SourceSpan[]; unresolved: boolean }
export type RetrievalReadRow = Readonly<Omit<RetrievalRow, 'spans'>> & {readonly spans: readonly Readonly<SourceSpan>[]}

const retrievalSnapshots = new WeakMap<StorySession, {
  events: readonly StoryEvent[]; history: readonly Readonly<StoryRow>[]; id: string; rows: readonly RetrievalReadRow[]
}>()
const ownedRetrievalRows = new WeakSet<RetrievalReadRow>()
const ownedRetrievalSnapshots = new WeakSet<readonly RetrievalReadRow[]>()
const rowHashes = new WeakMap<RetrievalReadRow, string>()
const rowLowerText = new WeakMap<RetrievalReadRow, string>()
const sourceFingerprints = new WeakMap<readonly RetrievalReadRow[], string>()
const hash = (text: string) => createHash('sha256').update(text).digest('hex')

export function retrievalRowHash(row: RetrievalReadRow): string {
  const cached = rowHashes.get(row)
  if (cached !== undefined) return cached
  const value = hash(row.text)
  if (ownedRetrievalRows.has(row)) rowHashes.set(row, value)
  return value
}
export function retrievalSourceFingerprint(rows: readonly RetrievalReadRow[]): string {
  const cached = sourceFingerprints.get(rows)
  if (cached !== undefined) return cached
  const value = hash(JSON.stringify(rows.map(row => [row.id, row.text])))
  if (ownedRetrievalSnapshots.has(rows)) sourceFingerprints.set(rows, value)
  return value
}
function lowerText(row: RetrievalReadRow): string {
  const cached = rowLowerText.get(row)
  if (cached !== undefined) return cached
  const value = row.text.toLocaleLowerCase()
  if (ownedRetrievalRows.has(row)) rowLowerText.set(row, value)
  return value
}

interface RetrievalOptions { query?: unknown; beforeSeq?: unknown; limit?: unknown; maxChars?: unknown }
interface ReadOptions { seq?: unknown; offset?: unknown; maxChars?: unknown }

const knownContainers = /^(?:status|state|details|decision|rp-status|rp-state|rp-decision)(?:$|[-_:])/i
const closing = /^(\/)?\s*([a-z][\w:-]*)/i
const voidTag = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i
const inlineTag = /^(?:p|div|section|article|li|blockquote|h[1-6]|pre)$/i

function blockType(block: StoryBlock): string { return typeof block?.type === 'string' ? block.type.toLowerCase() : '' }
function blockText(block: StoryBlock): string { return typeof block?.text === 'string' ? block.text : '' }

function rawTextFor(session: StorySession, row: StoryRow, original: StoryEvent | null): { raw: string; unresolved: boolean } {
  const event = original ? projectStoryEvent(session, original) : null
  const content = event?.type === 'user/message'
    ? event.data?.content
    : event?.type === 'assistant/message' ? (event.data?.message?.content ?? event.data?.content) : undefined
  if (!Array.isArray(content)) return { raw: row.text, unresolved: false }
  let unresolved = false
  const pieces: string[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') { unresolved = true; continue }
    const type = blockType(block)
    // Native providers may keep private reasoning alongside the final prose.
    // It is neither story text nor an unresolved story attachment.
    if (['reasoning','thinking','redacted_thinking','reasoning_content'].includes(type)) continue
    if (type === 'tool-call' || type === 'tool-result' || type === 'tool_use' || type === 'tool_result' || type === 'image' || type === 'file') {
      if (row.role === 'assistant') return { raw: '', unresolved: false }
      continue
    }
    if (type === 'text' || type === 'input_text' || type === 'output_text') pieces.push(blockText(block))
    else if (blockText(block)) { unresolved = true; pieces.push(blockText(block)) }
    else unresolved = true
  }
  return { raw: pieces.join('\n'), unresolved }
}

function emit(out: string[], spans: SourceSpan[], value: string, start: number, end: number) {
  if (!value) return
  out.push(value)
  const previous = spans.at(-1)
  if (previous && previous.end === start) previous.end = end
  else spans.push({ start, end })
}

/** Deterministic HTML/CSS projection. Spans are source UTF-16 intervals per output code unit. */
export function cleanStoryText(text: string): CleanStoryText {
  const source = String(text ?? ''), out: string[] = [], spans: SourceSpan[] = []
  let unresolved = false, i = 0, suppressed = 0
  let fence = source.indexOf('```')
  const stack: string[] = []
  while (i < source.length) {
    if (source.startsWith('```', i) && (i === 0 || source[i - 1] === '\n')) {
      const lineEnd = source.indexOf('\n', i + 3), headerEnd = lineEnd < 0 ? source.length : lineEnd
      const marker = source.slice(i + 3, headerEnd).trim().toLowerCase()
      if (marker === 'css' || marker === 'style' || marker === 'html') {
        const close = source.indexOf('```', headerEnd + (lineEnd < 0 ? 0 : 1))
        const fenceEnd = close < 0 ? source.length : close + 3
        const body = source.slice(headerEnd + (lineEnd < 0 ? 0 : 1), close < 0 ? source.length : close)
        if (marker !== 'html' || /(?:status|decision|details|state|\bst-card\b|<style|<script)/i.test(body)) {
          unresolved ||= close < 0
          i = fenceEnd
          continue
        }
      }
      // Ordinary code fences are story text. Consume their marker so the next
      // text interval cannot rediscover the same fence without advancing.
      if (suppressed === 0) emit(out, spans, '```', i, i + 3)
      i += 3
      continue
    }
    if (source[i] === '<') {
      const end = source.indexOf('>', i + 1)
      if (end < 0) { unresolved = true; emit(out, spans, source.slice(i), i, source.length); break }
      const rawTag = source.slice(i + 1, end), match = rawTag.match(closing)
      if (!match) { unresolved = true; i = end + 1; continue }
      const isClose = Boolean(match[1]), name = match[2]!.toLowerCase()
      if (isClose && stack.at(-1) === name && name !== 'style' && name !== 'script' && name !== 'noscript' && name !== 'template' && name !== 'svg' && name !== 'canvas') {
        while (stack.length && stack.pop() !== name) {}
        suppressed = stack.length
        i = end + 1; continue
      }
      if (name === 'style' || name === 'script' || name === 'noscript' || name === 'template' || name === 'svg' || name === 'canvas') {
        if (!isClose && !/\/\s*$/.test(rawTag)) { suppressed += 1; stack.push(name) }
        else if (isClose && stack.includes(name)) { while (stack.length && stack.pop() !== name) {} suppressed = stack.length }
        i = end + 1; continue
      }
      const classMatch = rawTag.match(/(?:class|id|data-[\w-]+)\s*=\s*["']([^"']*)/i)
      // The native author protocol puts state operations in this control container.
      const known = name === 'updatevariable' || knownContainers.test(name)
        || Boolean(classMatch && /(?:status|decision|details|state|\bst-card\b)/i.test(classMatch[1]!))
      if (known) {
        if (!isClose && !/\/\s*$/.test(rawTag)) { suppressed += 1; stack.push(name) }
        else if (isClose && stack.includes(name)) { while (stack.length && stack.pop() !== name) {} suppressed = stack.length }
        i = end + 1; continue
      }
      if (suppressed > 0 && !isClose && !voidTag.test(name)&&!/\/\s*$/.test(rawTag)) {stack.push(name);suppressed=stack.length}
      else if (suppressed === 0 && !isClose && !inlineTag.test(name) && !voidTag.test(name) && !/^(?:em|strong|b|i|u|span|a|code|mark)$/i.test(name)) {
        // Selected story prose remains readable inside custom markup. Unknown
        // markup still leaves semantic indexing unresolved; it does not erase text.
        unresolved = true
      }
      i = end + 1; continue
    }
    // Reuse both the next position and a failed search while consuming tags.
    if (fence >= 0 && fence < i) fence = source.indexOf('```', i)
    const next = source.indexOf('<', i), nextFence = fence >= 0 && (fence === 0 || source[fence - 1] === '\n') ? fence : -1
    const candidates = [next, nextFence].filter(value => value >= 0), end = candidates.length ? Math.min(...candidates) : source.length
    if (suppressed === 0) emit(out, spans, source.slice(i, end), i, end)
    i = end
  }
  return { text: out.join(''), spans, unresolved }
}

export function selectedRetrievalRows(session: StorySession): RetrievalRow[] {
  return selectedRetrievalRowsSnapshot(session).map(row => ({...row, spans: row.spans.map(span => ({...span}))}))
}

/** The story owner checks the actual log/selection/projection (including its
 * live getter) before this derived view can reuse cleaned text and offsets. */
export function selectedRetrievalRowsSnapshot(session: StorySession): readonly RetrievalReadRow[] {
  const history = selectedStoryHistorySnapshot(session), events = sessionEvents(session)
  const cached = retrievalSnapshots.get(session)
  if (cached?.history === history && cached.events === events && cached.id === session.id) return cached.rows
  const bySeq = new Map(events.map(event => [Number(event?.seq), event]))
  const selected = history.flatMap(row => {
    const source = rawTextFor(session, row, bySeq.get(row.seq) ?? null)
    if (!source.raw) return []
    const cleaned = cleanStoryText(source.raw)
    if (!cleaned.text) return []
    return [{ ...row, text: cleaned.text, rawText: source.raw, spans: cleaned.spans, unresolved: source.unresolved || cleaned.unresolved }]
  })
  const endedTurns = new Set(events.filter(event => event?.type === 'turn/end').map(event => Number(event.data?.turn)))
  const management = importManagementInputs(session, events)
  const visible = Array.from(session?.surface?.nodes ?? []).filter(value => Number.isSafeInteger(value)).map(Number)
  const visibleIndex = new Map(visible.map((seq, index) => [seq, index]))
  const known = new Set(selected.map(row => row.seq))
  const extra = events.filter(event => event?.type === 'user/message' && event.data?.source?.kind === 'user'
    && !known.has(event.seq) && !management.has(event.seq) && endedTurns.has(Number(event.data?.turn))
    && visibleIndex.has(event.seq)).flatMap(event => {
      const row: StoryRow = { id: `${session.id}:${event.seq}`, seq: event.seq, turn: Number(event.data?.turn), role: 'user',
        messageId: event.data?.id ?? null, text: '', time: event.time ?? null }
      const source = rawTextFor(session, row, event); if (!source.raw) return []
      const cleaned = cleanStoryText(source.raw); if (!cleaned.text) return []
      return [{ ...row, text: cleaned.text, rawText: source.raw, spans: cleaned.spans, unresolved: source.unresolved || cleaned.unresolved }]
    })
  extra.sort((left, right) => visibleIndex.get(left.seq)! - visibleIndex.get(right.seq)!)
  const merged: RetrievalRow[] = []
  let cursor = 0
  // Keep the selected story's logical order, including expanded compacted rows
  // absent from the surface. Each extra still precedes its first greater rank.
  for (const row of selected) {
    const at = visibleIndex.get(row.seq) ?? Number.POSITIVE_INFINITY
    while (cursor < extra.length && visibleIndex.get(extra[cursor]!.seq)! < at) merged.push(extra[cursor++]!)
    merged.push(row)
  }
  while (cursor < extra.length) merged.push(extra[cursor++]!)
  const rows = Object.freeze(merged.map(row => {
    const owned = Object.freeze({...row, spans: Object.freeze(row.spans.map(span => Object.freeze(span)))})
    ownedRetrievalRows.add(owned)
    return owned
  }))
  ownedRetrievalSnapshots.add(rows)
  retrievalSnapshots.set(session, {events, history, id: session.id, rows})
  return rows
}

export function projectedSourceOffset(row: Pick<RetrievalReadRow, 'spans'>, index: number): number {
  let cursor = 0
  for (const span of row.spans) {
    const length = span.end - span.start
    if (index < cursor + length) return span.start + Math.max(0, index - cursor)
    cursor += length
  }
  return row.spans.at(-1)?.end ?? 0
}

function bounds(value: unknown, fallback: number, max: number) {
  const n = Number(value); return Number.isFinite(n) ? Math.max(1, Math.min(max, Math.floor(n))) : fallback
}
function sourceOffset(row: Pick<RetrievalReadRow, 'spans'>, index: number) { return projectedSourceOffset(row, index) }

function publicRow(row: RetrievalReadRow, text: string, spans: readonly Readonly<SourceSpan>[], textOffset: number, truncated: boolean | undefined = undefined) {
  return { id: row.id, seq: row.seq, turn: row.turn, role: row.role, messageId: row.messageId, text, time: row.time, textOffset, ...(truncated === undefined ? {} : {truncated}) }
}

export function queryRetrievalRows(rows: readonly RetrievalReadRow[], sessionId: string, options: RetrievalOptions = {}) {
  const limit = bounds(options.limit, 12, 100), budget = Math.max(256, Math.min(60000, Number(options.maxChars) || 12000))
  const before = Number.isSafeInteger(options.beforeSeq) ? Number(options.beforeSeq) : null
  const end = before === null ? rows.length : rows.findIndex(row => row.seq === before)
  if (end < 0) throw new Error('历史游标不属于当前选中分支')
  const terms = String(options.query ?? '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const candidates = rows.slice(0, end).filter(row => terms.every(term => lowerText(row).includes(term)))
  const found: Array<ReturnType<typeof publicRow>> = []; let used = 0
  for (let n = candidates.length - 1; n >= 0 && found.length < limit && used < budget; n -= 1) {
    const row = candidates[n]!, first = terms.length ? Math.max(0, lowerText(row).indexOf(terms[0]!) - 240) : 0
    const count = Math.min(row.text.length - first, budget - used), last = first + count
    const item = publicRow(row, row.text.slice(first, last), row.spans, sourceOffset(row, first), first > 0 || last < row.text.length)
    found.push(item); used += count
  }
  found.reverse()
  return { sessionId, totalEntries: rows.length, matchedEntries: candidates.length, entries: found,
    nextBeforeSeq: candidates.length > found.length ? found[0]?.seq ?? null : null }
}

export function readRetrievalRows(rows: readonly RetrievalReadRow[], options: ReadOptions = {}) {
  const seq = Number.isSafeInteger(options.seq) ? Number(options.seq) : null, row = rows.find(item => item.seq === seq)
  if (!row) throw new Error('历史条目不属于当前选中分支')
  const offset = Number.isSafeInteger(options.offset) ? Math.max(0, Number(options.offset)) : 0, budget = bounds(options.maxChars, 12000, 60000)
  let start = 0, cursor = 0
  while (start < row.spans.length && row.spans[start]!.end <= offset) { cursor += row.spans[start]!.end - row.spans[start]!.start; start += 1 }
  if (start < row.spans.length && offset > row.spans[start]!.start) cursor += offset - row.spans[start]!.start
  start = cursor
  const end = Math.min(row.text.length, start + budget)
  return { ...publicRow(row, row.text.slice(start, end), row.spans, sourceOffset(row, start)), totalChars: row.text.length,
    nextOffset: end < row.text.length ? sourceOffset(row, end) : null }
}
