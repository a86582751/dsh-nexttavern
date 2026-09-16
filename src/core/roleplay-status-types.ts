import type { ContextEvent, ContextSession } from './roleplay-context.js'
import type { TaskAgent, TaskJob, TaskRoute, TaskSelection } from './tavern-task-types.js'
import type { ImportRecord, SourceSpan } from './roleplay-import-types.js'

export interface StatusSession extends ContextSession {
  header?: NonNullable<ContextSession['header']> & { parentSession?: string }
}
export interface StatusField extends Record<string, unknown> { emoji: string; label: string; value: string }
export interface StatusOption extends Record<string, unknown> { label: string; description: string; heart: boolean }
export interface StatusPanel extends Record<string, unknown> {
  title: string
  html: string
  fields: StatusField[]
  options: StatusOption[]
  rawText: string
}
export interface StatusSource {
  branchId: string
  turnId: number
  assistantSeq: number
  sourceSeqs: [number, number]
  sourceHash: string
}
export interface PriorStatusSource extends StatusSource { historyHash: string; validation: string }
export interface StatusInputBasis {
  selectedHistoryHash: string
  previousStatus: StatusPanel | null
  previousStatusSource: PriorStatusSource | null
}
export interface StatusProvenance {
  sourceHash?: string
  sourceSeqs?: number[]
  historyHash?: string
  specHash?: string
  fixedContextHash?: string
  actualRoute?: TaskRoute
  [key: string]: unknown
}
export interface StatusRecord extends Record<string, unknown> {
  text?: string
  templateHtml?: string
  panel?: StatusPanel
  atSeq?: number
  sessionId?: string
  state?: string
  source?: StatusSource
  result?: StatusRecord | null
  provenance?: StatusProvenance
  stale?: boolean
  inputBasis?: StatusInputBasis
  specHash?: string
  fixedContextHash?: string
  storyContextHash?: string
  selection?: TaskSelection
  turnId?: number
  userSeq?: number
  userHash?: string
  generationKey?: string | null
  startedAt?: number
  publicationState?: string
  publicationError?: string | null
}
export interface StatusTable<T = Record<string, unknown>> {
  get(key: string): T | undefined
  entries(): Iterable<[string, T]>
  put(key: string, value: unknown): Promise<unknown>
}
export interface StatusTables {
  status: StatusTable<StatusRecord>
  branch: StatusTable<unknown>
  scene: StatusTable
  cards: StatusTable
  worldbook: StatusTable
  rules: StatusTable
}
export interface StatusContext {
  effect(work: () => unknown, label?: string): unknown
  get(name: string): unknown
  logger?: { warn?(message: string): unknown }
}
export interface FixedStatusContext {
  cards: { key: string; record: Record<string, unknown> }[]
  worldbook: { key: string; record: Record<string, unknown> }[]
  rules: Record<string, unknown> | null
}
export interface StoryEvidence { seq: number; role?: string; kind?: string; text: string }
export interface StatusCancellation {
  signal: AbortSignal
  follow(signal?: AbortSignal): void
  retrySignal(): AbortSignal | undefined
  dispose(): void
}
export type StatusJob = Promise<StatusRecord | null | undefined> & { admission: Promise<unknown>; cancellation: StatusCancellation }
export interface StatusRunOptions { force?: boolean; agent?: TaskAgent; signal?: AbortSignal }
export interface StatusDependencies {
  ctx: StatusContext
  T: StatusTables
  cfg: { maxWorldTokens?: number; statusWorkerTimeoutMs?: number; statusRetryMs?: number }
  DEFAULT_CONFIG: { statusWorkerTimeoutMs: number }
  STATUS_SYSTEM: string
  cloneBranchRecord<T>(value: T): T
  storyBranchIsActive(session: StatusSession): boolean
  taskCancellation(signal?: AbortSignal): StatusCancellation
  ensureBranch(session: StatusSession): Promise<unknown>
  modelPolicy: { resolve(session: StatusSession, kind: string, agent?: TaskAgent): TaskSelection | PromiseLike<TaskSelection> }
  sameModelRoute(a: TaskRoute | undefined, b: TaskRoute): boolean
  retrieveWorldbook(tables: StatusTables, id: string, query: string, scene: null, budget: number): Promise<{ text: string }>
  resolveRoute(session: StatusSession, agent?: TaskAgent): { session: StatusSession; agent?: TaskAgent }
  llmJson(ctx: StatusContext, route: { session: StatusSession; agent?: TaskAgent }, options: {
    system: string; user: string; promptContext?: import('./tavern-task-context.js').MaintenancePromptContext; signal?: AbortSignal; selection: TaskSelection;
    onAdmission(value: unknown): void; onResult(task: TaskJob): void;
    generationKey?: string; validate(value: unknown): unknown;
    maxTokens: number; temperature: number; timeoutMs: number
  }): Promise<unknown>
  importRecordKey(sessionId: string, importId: unknown): string
  spanText(record: ImportRecord, spans: readonly SourceSpan[]): string
}
export type StatusEvent = ContextEvent
