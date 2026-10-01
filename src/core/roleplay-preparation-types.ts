import type { ContextEvent, ContextMessage, ContextSession } from './roleplay-context.js'
import type { StorySurfaceReplacement } from './roleplay-message-view.js'
import type { TaskAgent } from './tavern-task-types.js'
import type { StatusRecord } from './roleplay-status-types.js'
import type { ForkLookup } from './roleplay-worldline-types.js'
import type { DirectorNotes } from '../memory/memory-history.js'
import type { MemoryRecordProjection } from '../memory/memory-provenance.js'

export interface PreparationSession extends ContextSession {
  header?: NonNullable<ContextSession['header']> & { parentSession?: string }
  append?(type: string, data: Record<string, unknown>, options: {
    surfaceOp: StorySurfaceReplacement
    sourceEventSeqs: number[]
  }): ContextEvent
}
export interface ContextWindow extends Record<string, unknown> {
  windowNumber: number
  windowId: string
  previousWindowId?: string | null
  startSeq: number
  rolloverCount?: number
}
export interface WindowMetadata extends Record<string, unknown> {
  startSeq?: number
}
export type PreparationMemory = Partial<Pick<MemoryRecordProjection, 'summary' | 'archives' | 'archiveDigests' | 'deltas' | 'pendingConfirmations' | 'styleNotes' | 'userPrefs'>> & Record<string, unknown> & {
  lockedFacts?: readonly (string | Record<string, unknown>)[]
}
export interface PreparationTable<T = Record<string, unknown>> {
  get(key: string): T | null | undefined
  put(key: string, value: unknown): Promise<unknown>
}
export interface PreparationTables {
  branch: PreparationTable
  memory: PreparationTable<PreparationMemory>
  opening: PreparationTable<{ text?: string }>
}
export interface MemoryPreparation {
  status: string
  branchId?: string
  reason?: string
}
export interface WindowProof extends MemoryPreparation {
  sourceKeys?: readonly unknown[]
  sourceSeqs?: readonly number[]
  generationId?: unknown
}
export interface PreparationCompaction {
  memoryProjection?(session: PreparationSession): PreparationMemory | null
  settingsDefaults?(): Record<string, unknown>
  prepareForTurn?(agent: TaskAgent, signal?: AbortSignal): Promise<MemoryPreparation | null>
  directorNotes?(session: PreparationSession): DirectorNotes | null
  prefetchWindowCheckpoint?(agent: TaskAgent): unknown
  ensureWindowCheckpoint?(agent: TaskAgent, signal?: AbortSignal): Promise<WindowProof | null>
}
export interface PreparationContext {
  get(name: 'compaction'): PreparationCompaction | null | undefined
  logger?: { warn?(message: string): void; info?(message: string): void }
}
export interface PreparationPayload {
  agent: TaskAgent
  turn: number
  messages: readonly ContextMessage[]
  signal?: AbortSignal
}
export interface PreparationSnapshot {
  branchId: string
  agent: TaskAgent
  turnId: number
  baseRevision: number
  lastSeq: number
  userMessageId: string | null
  userText: string
  cardVersion: null
  worldbookVersion: null
  memoryVersion: unknown
  contextWindow: {
    windowNumber: number
    windowId: string
    previousWindowId: string | null
    rollover: boolean
  }
  memoryProjection?: {
    schemaVersion: number
    branchId: string
    mode: string
    notesGenerationId: unknown
    notesSourceSeqs: unknown
    windowId: string
  }
}
export interface PreparationState {
  snapshots: Map<number, PreparationSnapshot>
  pendingScenes: Map<number, unknown>
  snapshot: PreparationSnapshot | null
  pendingTurn: number | null
  pendingScene: unknown
}
// Phase A writes a complete new snapshot without reading legacy snapshot fields.
export interface PreparationWriteState {
  snapshots: {set(turn: number, snapshot: PreparationSnapshot): unknown}
  pendingScenes: {set(turn: number, scene: null): unknown; get(turn: number): unknown}
  snapshot: unknown
  pendingTurn: number | null
  pendingScene: unknown
}
export interface PreparationDependencies {
  T: PreparationTables
  ctx: PreparationContext
  cfg: { contextWindowTokens?: number; continuityTailTokens?: number; contextWindowEnabled?: boolean }
  svc: {
    awaitCommitted(branchId: string): Promise<unknown>
    settings(branchId: string): Record<string, unknown> | null | undefined
  }
  assertStoryBranchActive(session: PreparationSession): void
  ensureBranch(session: PreparationSession): Promise<unknown>
  reconcileCanonicalPlayerVariants(session: PreparationSession, index: ForkLookup): Promise<unknown>
  buildForkLookupIndex(session: PreparationSession): ForkLookup
  userValues(branchId: string): { name: string; gender: string }
  selectedStatusRecord(session: PreparationSession): StatusRecord | null | undefined
}
