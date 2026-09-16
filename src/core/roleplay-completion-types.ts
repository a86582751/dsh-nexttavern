import type { ContextEvent, ContextSession } from './roleplay-context.js'
import type { ContextWindow, PreparationMemory, PreparationSnapshot, PreparationTable } from './roleplay-preparation-types.js'
import type { TaskAgent } from './tavern-task-types.js'

export interface CompletionAgent extends TaskAgent {
  id?: string
  session?: ContextSession
}
// Older durable turn snapshots can lack the newer Phase A projection fields.
export type CompletionSnapshot = Pick<PreparationSnapshot, 'branchId' | 'turnId' | 'userText'> & Partial<Omit<PreparationSnapshot, 'branchId' | 'turnId' | 'userText'>>
export interface PendingScene { scene?: Record<string, unknown> & { place?: unknown } }
export interface CompletionState {
  snapshots: Map<number, CompletionSnapshot>
  snapshot: CompletionSnapshot | null
  pendingTurn: number | null
  pendingScenes: Map<number, PendingScene | null>
  pendingScene: PendingScene | null
  phaseBStarted: Set<number>
  phaseBRetryTimers: Map<number, ReturnType<typeof setTimeout>>
  phaseBAttempts: Map<number, number>
  commitChain?: Promise<unknown>
  regenerateAnchor: unknown | null
}
export interface CompletionTables {
  branch: PreparationTable
  scene: PreparationTable
  memory: PreparationTable<PreparationMemory> & {
    update(key: string, mutate: (value: PreparationMemory | undefined) => PreparationMemory): Promise<unknown>
  }
}
export interface CompletionCompaction {
  backgroundMemory?: boolean
  rebuildDirectorNotes?(agent: { session: ContextSession }): unknown
}
export interface CompletionContext {
  get(name: 'compaction'): CompletionCompaction | undefined | null
  sessions: { get(id: string | undefined): ContextSession | undefined | null }
  logger?: { warn?(message: string): void }
  on(name: 'session/event', callback: (session: ContextSession, event: ContextEvent) => void, options?: { global: boolean }): unknown
  on(name: 'agent/status', callback: (payload: { agent?: CompletionAgent; status?: string }) => void): unknown
}
export interface CompletionWorkerResult extends Record<string, unknown> {
  deltas?: Record<string, unknown>[]
  conflicts?: Record<string, unknown>[]
}
export interface CompletionDependencies {
  storyBranchIsActive(session: ContextSession): boolean
  T: CompletionTables
  cloneBranchRecord<T>(value: T): T
  reconcileNativeFork(session: ContextSession, event: ContextEvent): Promise<unknown>
  ctx: CompletionContext
  resolveRoute(session: ContextSession, agent?: TaskAgent): { session: ContextSession; agent?: TaskAgent }
  memoryForContext(session: ContextSession): PreparationMemory | null | undefined
  publishTurnDecision(session: ContextSession, event: ContextEvent, snapshot: CompletionSnapshot, narrative: string, signal?: AbortSignal): Promise<unknown>
  llmJson(ctx: CompletionContext, route: { session: ContextSession; agent?: TaskAgent }, options: {
    system: string; signal?: AbortSignal; user: string; maxTokens: number; temperature: number; timeoutMs: number
  }): Promise<CompletionWorkerResult | null>
  LEDGER_WORKER_SYSTEM: string
  CONTINUITY_WORKER_SYSTEM: string
  cfg: { workerMaxTokens?: number; workerTemperature?: number; phaseBTimeoutMs?: number }
  contextWindowFor(session: ContextSession): ContextWindow | null | undefined
  contextWindowKey(branchId: string): string
  svc: { recordVersion(branchId: string, anchor: unknown, turn: number | undefined, seq: number): Promise<unknown> }
  sessions: Map<string, CompletionState>
  failPendingNativeFork(session: ContextSession, reason: string): Promise<unknown>
  isRoleplaySession(session: ContextSession | null | undefined): boolean
  queueStatusObligation(session: ContextSession, event: ContextEvent, via: string): void
  statusRunStartSeq: Map<string, number>
  recoverStatusObligations(session: ContextSession, via: string, agent?: CompletionAgent): void
}
