import type { ContextEvent, ContextSession } from './roleplay-context.js'
import type { CompletionSnapshot } from './roleplay-completion-types.js'
import type { PreparationMemory } from './roleplay-preparation-types.js'
import type { StatusRecord, StatusSource, StatusOption, StatusCancellation } from './roleplay-status-types.js'
import type { TaskAgent, TaskSelection, TaskRoute, TaskJob } from './tavern-task-types.js'
import type { AuthorTables, AuthorDependency } from './roleplay-author-context-types.js'

export type DecisionSession = ContextSession
export type DecisionEvent = ContextEvent
export type DecisionSnapshot = CompletionSnapshot
export interface DecisionOption { label: string; description?: string; heart: boolean }
export interface DecisionRecord extends Record<string, unknown> { options?: readonly unknown[] }
export type DecisionJob = Promise<unknown> & { admission: Promise<unknown>; cancellation: StatusCancellation }
interface DecisionTable<T = Record<string, unknown>> {
  get(key: string): T | undefined
  put(key: string, value: unknown): Promise<unknown>
  update?(key: string, work: (record: T) => T): Promise<unknown>
}
export interface DecisionTables extends AuthorTables {
  decision: DecisionTable<DecisionRecord>
  status: DecisionTable<StatusRecord>
  scene: DecisionTable
}
export interface DecisionContext {
  get(name: 'compaction'): { directorNotes?(session: DecisionSession): {text?: unknown} | null } | null | undefined
}
export interface DecisionDependencies {
  T: DecisionTables
  withDecisionMutationLock<T>(branchId: string, work: () => Promise<T>): Promise<T>
  normalizeDecisionRecord(record: DecisionRecord | undefined): DecisionRecord | null
  taskStory(session: DecisionSession): {seq: number; text: string}[]
  isStale(session: DecisionSession, snapshot: DecisionSnapshot, seq: number): boolean
  isLatestVisibleTurn(session: DecisionSession, turn: number, seq: number): boolean
  statusSource(session: DecisionSession, event: DecisionEvent): StatusSource | null
  modelPolicy: {resolve(session: DecisionSession, kind: string, agent?: TaskAgent): TaskSelection | PromiseLike<TaskSelection>}
  selectedStatusRecord(session: DecisionSession): StatusRecord | null | undefined
  sameModelRoute(a: TaskRoute | undefined, b: TaskRoute): boolean
  normalizeStatusRecord(value: StatusRecord | undefined): StatusRecord | null
  normalizeStatusOption(value: unknown): StatusOption
  buildDecisionContext(tables: DecisionTables, branchId: string, options: {
    narrative: string; userText: string; scene: Record<string, unknown> | undefined; memory: PreparationMemory | null | undefined; directorNotes: unknown
  }): Promise<{ context: unknown; dependencies: readonly AuthorDependency[] }>
  memoryForContext(session: DecisionSession): PreparationMemory | null | undefined
  ctx: DecisionContext
  resolveRoute(session: DecisionSession, agent?: TaskAgent): {session: DecisionSession; agent?: TaskAgent}
  llmJson(ctx: DecisionContext, route: {session: DecisionSession; agent?: TaskAgent}, options: {
    system: string; signal?: AbortSignal; onAdmission(value: unknown): void; selection: TaskSelection;
    source: {events: {seq: number; hash: string}[]; dependencies: readonly AuthorDependency[]}; onResult(job: TaskJob): void;
    user: string; promptContext?: import('./tavern-task-context.js').MaintenancePromptContext; maxTokens: number; temperature: number; timeoutMs: number
  }): Promise<{options?: unknown[]} | null>
  DECISION_SYSTEM: string
  cfg: {decisionWorkerTimeoutMs?: number}
  DEFAULT_CONFIG: {decisionWorkerTimeoutMs: number}
}
