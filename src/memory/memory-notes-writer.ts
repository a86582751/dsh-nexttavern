import { randomUUID } from 'node:crypto'
import { selectedStoryHistory, directorNotesForBranch, historySourceKeys, storyCadenceSlots, type StorySession, type StoryRow, type NotesRecord, type DirectorNotes } from './memory-history.js'
import { scopedLedgerItems } from './memory-provenance.js'
import { validateDetailedSummary, type SummaryOptions, type SummaryResult, type MemoryDelta, type MemoryConflict } from './memory-summary.js'

export interface NotesSettings {
  notesBatchChars?: unknown
  maxSummaryTokens?: unknown
  autoNotesTimeoutMs?: unknown
  summaryTimeoutMs?: unknown
}
export interface NotesHead extends NotesRecord {
  lockedFacts?: unknown
  directorCheckpoints?: readonly DirectorNotes[]
  deltas?: readonly Record<string, unknown>[]
  pendingConfirmations?: readonly Record<string, unknown>[]
  version?: unknown
}
export interface DirectorCheckpoint extends DirectorNotes {
  schemaVersion: 1
  generationId: string
  branchId: string
  sessionId: string
  text: string
  sourceKeys: string[]
  sourceSeqs: number[]
  sourceEntryCount: number
  throughSeq: number
  updatedAt: number
  commandId?: unknown
  validated?: true
  manual?: true
  projectionMode?: 'append-delta' | 'full'
  updateSourceKeys?: string[]
}
export interface NotesWritePatch extends Record<string, unknown> {
  directorNotes: DirectorCheckpoint
  directorCheckpoints?: readonly DirectorNotes[]
  notesCadence: {
    schemaVersion: 1
    branchId: string
    slots: ReturnType<typeof storyCadenceSlots>
    updatedAt: number
    throughSeq: number
  }
}
export interface NotesEngine {
  memoryHead?: (sessionId: string) => NotesHead | null | undefined
  memoryUpdate: (sessionId: string, patch: NotesWritePatch) => unknown | Promise<unknown>
  awaitCommitted?: (sessionId: string) => unknown | Promise<unknown>
}
export interface NotesWriterOptions<S extends StorySession> {
  config: NotesSettings
  getEngine: () => NotesEngine | null | undefined
  branchSettings: (session: S) => NotesSettings | null | undefined
  assertBranchActive: (session: S) => void
  isRoleplaySession: (session: S) => boolean
  inspectCompactionState: (session: S) => { openTurn: number | null }
  summarizeDetailed: (options: SummaryOptions<S>) => Promise<SummaryResult>
}
interface RefreshOptions { automatic?: boolean; force?: boolean; background?: boolean }
interface EvidenceProvenance {
  schemaVersion: 1
  sessionId: string
  atSeq: number
  turnId: number | null
  batchThroughSeq: number
  sourceGeneration: string
  sourceKey: string
}
export type NotesWriteResult =
  | { kind: 'notes'; changed: false; entries: number; reason: 'no-completed-story' | 'up-to-date' }
  | { kind: 'notes'; changed: true; entries: number; batches: number; chars: number }

export function createDirectorNotesWriter<S extends StorySession>(options: NotesWriterOptions<S>) {
  const {config: cfg, getEngine, branchSettings, assertBranchActive, isRoleplaySession, inspectCompactionState, summarizeDetailed} = options
  const notesBusy = new Set<string>()
  const activeNotes = new Map<string, Promise<NotesWriteResult>>()
  const notesGeneration = new Map<string, number>()
  const noteWrites = new Map<string, Promise<unknown>>()
  async function writeNotes<T>(sessionId: string, action: () => T | Promise<T>): Promise<T> {
    const previous = noteWrites.get(sessionId) ?? Promise.resolve()
    const current = previous.catch(() => {}).then(action)
    noteWrites.set(sessionId, current)
    try { return await current }
    finally { if (noteWrites.get(sessionId) === current) noteWrites.delete(sessionId) }
  }

  function refreshDirectorNotes(session: S, ...args: [agent?: unknown, signal?: AbortSignal, commandId?: unknown, options?: RefreshOptions]): Promise<NotesWriteResult> {
    if (activeNotes.has(session.id)) return Promise.reject(new Error('导演笔记整理正在进行中，请稍后再试'))
    const job = performDirectorNotes(session, ...args).finally(() => {
      if (activeNotes.get(session.id) === job) activeNotes.delete(session.id)
    })
    activeNotes.set(session.id, job)
    return job
  }

  async function performDirectorNotes(session: S, _agent?: unknown, signal?: AbortSignal, commandId?: unknown, { automatic = false, force = false, background = false }: RefreshOptions = {}): Promise<NotesWriteResult> {
    if (notesBusy.has(session.id)) throw new Error('导演笔记整理正在进行中，请稍后再试')
    notesBusy.add(session.id)
    const generation = notesGeneration.get(session.id) ?? 0
    try {
      const engine = getEngine()
      if (typeof engine?.memoryUpdate !== 'function') throw new Error('roleplay 核心未就绪')
      if (typeof engine.awaitCommitted === 'function') await engine.awaitCommitted(session.id)
      signal?.throwIfAborted?.()
      if (!automatic && inspectCompactionState(session).openTurn !== null) throw new Error('导演笔记整理只能在 agent 空闲时执行')
      const entries = selectedStoryHistory(session)
      assertBranchActive(session)
      if (entries.length === 0) return { kind: 'notes', changed: false, entries: 0, reason: 'no-completed-story' }
      const originalKeys = historySourceKeys(entries)
      const indexBySeq = new Map<number, number>()
      entries.forEach((entry, index) => { if (!indexBySeq.has(entry.seq)) indexBySeq.set(entry.seq, index) })
      const stored = engine.memoryHead?.(session.id) ?? {}
      const existing = directorNotesForBranch(stored, session, entries)
      let processed = force ? 0 : (existing?.sourceKeys.length ?? 0)
      if (!force && processed === entries.length) return { kind: 'notes', changed: false, entries: processed, reason: 'up-to-date' }
      let previous = force ? '' : (existing?.text ?? '')
      const settings = branchSettings(session)
      const batchChars = Math.max(10000, Number(settings?.notesBatchChars ?? cfg.notesBatchChars) || 100000)
      const maxTokens = Math.max(1024, Number(settings?.maxSummaryTokens ?? cfg.maxSummaryTokens) || 16384)
      const timeoutMs = automatic
        ? Math.max(1000, Number(settings?.autoNotesTimeoutMs ?? cfg.autoNotesTimeoutMs) || 300000)
        : Math.max(30000, Number(settings?.summaryTimeoutMs ?? cfg.summaryTimeoutMs) || 300000)
      const locked = Array.isArray(stored.lockedFacts) ? scopedLedgerItems(stored.lockedFacts, session) : []
      const lockedText = locked.map((fact) => typeof fact === 'string' ? fact : String(fact?.text ?? '')).filter(Boolean).join('\n')
      let batches = 0
      while (processed < entries.length) {
        signal?.throwIfAborted?.()
        const batch: StoryRow[] = []
        let chars = 0
        while (processed + batch.length < entries.length) {
          const entry = entries[processed + batch.length]!
          if (batch.length && batch.at(-1)!.turn !== entry.turn && chars + entry.text.length > batchChars) break
          batch.push(entry)
          chars += entry.text.length
        }
        const sourceText = batch.map((entry) => `[${entry.role === 'user' ? '用户' : '叙事者'} · turn:${entry.turn} · seq:${entry.seq}]\n${entry.text}`).join('\n\n')
        const appendDelta = Boolean(previous) && !force
        const updateStart = processed
        const result = await summarizeDetailed({ session, previousSummary: previous, sourceText, lockedText, maxTokens, timeoutMs, signal, appendDelta,
          background, sourceSeqs:batch.map(entry=>entry.seq),taskStage:background?'background-notes':'notes' })
        validateDetailedSummary(result.text, sourceText, appendDelta ? [] : locked)
        signal?.throwIfAborted?.()
        if ((notesGeneration.get(session.id) ?? 0) !== generation) throw new Error('导演笔记已由用户修改，后台结果未覆盖用户编辑')
        processed += batch.length
        // The model handles new evidence and explicit corrections only. Preserve
        // the verified prefix verbatim; never pay for a complete rewrite on each
        // story turn. Full consolidation remains the compaction path.
        previous = appendDelta
          ? `${previous}\n\n## 剧情更新 · seq:${batch[0]!.seq}–${batch.at(-1)!.seq}\n最新有证据的更正与状态变化优先于旧快照；未被更正的旧事实继续有效。\n\n${result.text}`
          : result.text
        for (const fact of locked) {
          const value = typeof fact === 'string' ? fact : String(fact?.text ?? '')
          if (value && !previous.includes(value)) previous += `\n\n用户锁定事实：\n${value}`
        }
        batches += 1
        const checkpoint: DirectorCheckpoint = {
            schemaVersion: 1, generationId: randomUUID(), branchId: session.id,
            projectionMode: appendDelta ? 'append-delta' : 'full', updateSourceKeys: originalKeys.slice(updateStart, processed),
            text: previous, sourceKeys: originalKeys.slice(0, processed), sourceSeqs: entries.slice(0, processed).map((entry) => entry.seq),
            sessionId: session.id, sourceEntryCount: processed, throughSeq: entries[processed - 1]!.seq,
            updatedAt: Date.now(), commandId: commandId ?? null, validated: true,
        }
        await writeNotes(session.id, async () => {
          signal?.throwIfAborted?.()
          assertBranchActive(session)
          if ((notesGeneration.get(session.id) ?? 0) !== generation) throw new Error('导演笔记已由用户修改，后台结果未覆盖用户编辑')
          const currentKeys = historySourceKeys(selectedStoryHistory(session))
          if (originalKeys.some((key,index)=>currentKeys[index]!==key))throw new Error('整理期间当前分支剧情已变更；未保存过期笔记')
          const head = engine.memoryHead?.(session.id) ?? {}
          const previousCheckpoints = Array.isArray(head.directorCheckpoints) ? head.directorCheckpoints : []
          const decorate=(item: MemoryDelta | MemoryConflict): (MemoryDelta | MemoryConflict) & EvidenceProvenance => {
            const index = indexBySeq.get(item.evidenceSeq)
            if (index === undefined) throw new Error('后台记忆缺少当前分支来源，未保存结果')
            return {...item,schemaVersion:1,sessionId:session.id,atSeq:item.evidenceSeq,
              turnId:entries[index]!.turn,batchThroughSeq:checkpoint.throughSeq,
              sourceGeneration:checkpoint.generationId,sourceKey:originalKeys[index]!}
          }
          const merge=(prior: readonly Record<string, unknown>[] | undefined, incoming: readonly (MemoryDelta | MemoryConflict)[])=>{
            const values=Array.isArray(prior)?prior:[]
            return [...values,...incoming.map(decorate).filter(item=>!values.some(old=>old.sourceKey===item.sourceKey&&
              old.summary===item.summary&&old.claim===item.claim&&old.canon===item.canon))]
          }
          await engine.memoryUpdate(session.id, {
            directorNotes: checkpoint,
            directorCheckpoints: [...previousCheckpoints.filter((item) => item.throughSeq !== checkpoint.throughSeq), checkpoint].slice(-32),
            notesCadence: { schemaVersion: 1, branchId: session.id, slots: storyCadenceSlots(entries),
              updatedAt: Date.now(), throughSeq: checkpoint.throughSeq },
            ...(background?{
              deltas:merge(head.deltas,result.deltas??[]),
              pendingConfirmations:merge(head.pendingConfirmations,result.conflicts??[]),
              version:(Number(head.version)||1)+1,updatedAtSeq:checkpoint.throughSeq,
            }:{}),
          })
        })
      }
      return { kind: 'notes', changed: true, entries: processed, batches, chars: previous.length }
    } finally {
      notesBusy.delete(session.id)
    }
  }

  async function saveDirectorNotes(session: S, text: unknown): Promise<void> {
      if (!session || !isRoleplaySession(session)) throw new Error('当前会话不是角色扮演会话')
      const entries = selectedStoryHistory(session)
      notesGeneration.set(session.id, (notesGeneration.get(session.id) ?? 0) + 1)
      await writeNotes(session.id, () => getEngine()!.memoryUpdate(session.id, { directorNotes: {
        schemaVersion: 1, generationId: randomUUID(), branchId: session.id,
        text: String(text), sourceKeys: historySourceKeys(entries), sourceSeqs: entries.map((entry) => entry.seq),
        sessionId: session.id, sourceEntryCount: entries.length, throughSeq: entries.at(-1)?.seq ?? -1,
        updatedAt: Date.now(), manual: true,
      }, notesCadence: { schemaVersion: 1, branchId: session.id, slots: storyCadenceSlots(entries),
        updatedAt: Date.now(), throughSeq: entries.at(-1)?.seq ?? -1 } }))
    }

  const busy: ReadonlySet<string> = notesBusy
  return {
    refreshDirectorNotes, saveDirectorNotes, busy,
    pending: (sessionId: string): Promise<NotesWriteResult> | undefined => activeNotes.get(sessionId),
  }
}
