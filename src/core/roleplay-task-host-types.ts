import type { ContextEvent, ContextSession } from './roleplay-context.js'
import type { createCharacterCluster } from './character-cluster.js'
import type { TaskAgent, TaskOptions, TaskSpec } from './tavern-task-types.js'
import type { StatusRecord } from './roleplay-status-types.js'
import type { AuthorTables, AuthorDependency } from './roleplay-author-context-types.js'

export interface HostSession extends ContextSession {
  header?: NonNullable<ContextSession['header']> & {parentSession?: string}
}
export interface HostAgent extends TaskAgent {
  session?: HostSession
  options?: NonNullable<TaskAgent['options']> & {tavernTaskId?: string; [key: string]: unknown}
  status?: string
  steer?(message: ReturnType<typeof import('./tavern-tasks.js').taskPhaseMessage>): unknown
}
export interface HostRecord extends Record<string, unknown> {
  id?: string
  sessionId?: string
  status?: string
  kind?: string
  generation?: string
  taskStage?: string
}
export interface HostTable {
  get(key: string): HostRecord | null | undefined
  entries(): Iterable<[string, HostRecord]>
  put(key: string, value: unknown): void | PromiseLike<unknown>
}
export interface HostTables {branch: HostTable; cards: HostTable}
export interface HostSource {
  preparationId?: string
  hashKind?: string
  workflowId?: string
  workflowType?: string
  generation?: string
  events?: {seq: number; hash: string}[]
  fixedHash?: string
  dependencies?: readonly AuthorDependency[]
}
export interface MaintenanceJob {
  kind: string
  state: string
  atSeq?: number
  error?: string | null
  finishedAt?: number
}
export interface NativeTaskInput<Result = unknown> extends Omit<TaskSpec<HostSession, HostAgent>, 'source' | 'input' | 'kind' | 'validate'> {
  validate?(value: unknown): Result | PromiseLike<Result>
  kind?: string
  system: string
  user: string
  source?: HostSource
  generationKey?: unknown
  taskStage?: string
}
export interface TaskHostDependencies {
  T: HostTables & AuthorTables
  ctx: {
    llm?: {resolveModelInfo?(provider: string, model: string): PromiseLike<{provider: string; id: string}>}
    agentDefaultModel: {currentSelection(): unknown}
    sessions: {get(id: string): HostSession | null | undefined}
    sessionController: {resolveAgent?(id: string): PromiseLike<{agent?: HostAgent} | null | undefined>}
    subagents: NonNullable<TaskOptions<HostSession, HostAgent>['subagents']> & Parameters<typeof createCharacterCluster<HostSession, HostAgent>>[0]['subagents']
    get(name: 'compaction'): {
      storyEvidence?(session: HostSession): {seq: number; text: string}[]
      resumeTask?(agent: HostAgent, signal: AbortSignal | undefined, stage?: string): PromiseLike<unknown>
    } | null | undefined
    get(name: 'tavernConversations'): Pick<ReturnType<typeof import('./tavern-conversations.js').createConversationCatalog>,'rootOf'|'snapshot'> & {ready?:PromiseLike<unknown>} | null | undefined
  }
  config: {workerProvider?: string | null; workerModel?: string | null}
  taskAgents: Map<string, HostAgent>
  storyBranchIsActive(session: HostSession): boolean
  statusFixedContext(session: HostSession): unknown
  taskDependenciesCurrent(tables: AuthorTables, id: string, dependencies?: readonly AuthorDependency[]): boolean
  taskInstruction(session: HostSession): string
  getMaintenanceJob(id: string): MaintenanceJob | undefined
  runStatusObligation(session: HostSession, event: ContextEvent | undefined, reason: string, options: {agent: HostAgent}): PromiseLike<StatusRecord | null | undefined>
  STATUS_SYSTEM: string
  DECISION_SYSTEM: string
  ORGANIZE_WORKER_SYSTEM: string
}
