import type { ContextSession } from './roleplay-context.js'
import type { AuthorRecord, AuthorTable } from './roleplay-author-context-types.js'
import type { TaskAgent } from './tavern-task-types.js'

export interface ActionArguments extends Record<string, unknown> {
  spec?: string
  reason?: string
}
export interface ActionExecution {agent?: TaskAgent & {session?: ContextSession}; signal?: AbortSignal}
export interface ActionTable<R = Record<string, unknown>> {
  get(key: string): R | null | undefined
  put(key: string, value: unknown): unknown | PromiseLike<unknown>
}
export interface SceneRecord extends Record<string, unknown> {
  positions?: Record<string, unknown>
  outfits?: Record<string, unknown>
  items?: Record<string, unknown>
  moods?: Record<string, unknown>
  injuries?: Record<string, unknown>
}
export interface ActionMemory extends Record<string, unknown> {
  deltas?: readonly unknown[]
  pendingConfirmations?: readonly unknown[]
  lockedFacts?: readonly unknown[]
  version?: unknown
}
export interface ActionTables {
  rolls: ActionTable<unknown>
  scene: ActionTable<SceneRecord>
  memory: ActionTable<ActionMemory>
  branch: ActionTable
  worldbook: AuthorTable<AuthorRecord>
}
export interface ActionContext {
  effect(work: () => unknown, label: string): unknown
  tools: {register(tool: unknown): unknown}
  commands: {register(command: {
    name: string
    description: string
    input?: {hint: string}
    handler(invocation: ActionExecution & {rawInput?: string}): Promise<{kind: 'success' | 'error'; text: string}>
  }): unknown}
}
export interface SessionActionDependencies {
  ctx: ActionContext
  T: ActionTables
  simpleTool(name: string, description: string, parameters: unknown, execute: (args: ActionArguments, execution: ActionExecution) => Promise<unknown>): unknown
  sessionOf(execution: ActionExecution): Promise<ContextSession>
}
export interface SessionCommandDependencies {
  ctx: ActionContext
  T: ActionTables
  isRoleplaySession(session: ContextSession | null | undefined): boolean
  startExportJob(session: ContextSession, kind: 'novel-export', agent?: ActionExecution['agent']): Promise<{id: string}>
  svc: {branchLineage(session: ContextSession): {sessionId: string; seedLength: unknown}[]}
}
