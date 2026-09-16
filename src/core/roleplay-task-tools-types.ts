import type { HostAgent, HostSession } from './roleplay-task-host-types.js'
import type { createRoleplayTaskHost } from './roleplay-task-host.js'
import type { CharacterInputSource } from './character-cluster-projection.js'
import type { TaskMessage } from './tavern-task-context.js'

export interface TaskToolExecution {
  agent?: HostAgent
  signal?: AbortSignal
  deferContext?(message: TaskMessage): unknown
}
export interface TaskToolArguments extends Record<string, unknown> {
  id?: string
  generation?: string
  offset?: number
  maxChars?: number
  action?: string
  scope?: string
  limit?: number
  character_ids?: string[]
}
export interface TaskToolRecord extends Record<string, unknown> {
  sessionId?: string
  status?: string
  generation?: string
  turn?: number
  childSessionId?: string
  text?: unknown
  source?: {workflowType?: string; workflowId: string; generation?: string}
}
export interface TaskToolTable {
  get(key: string): TaskToolRecord | null | undefined
  entries(): Iterable<[string, TaskToolRecord]>
  put(key: string, value: unknown): unknown | PromiseLike<unknown>
}
type TaskHost = ReturnType<typeof createRoleplayTaskHost>
export interface TaskToolsDependencies {
  ctx: {
    effect(work: () => unknown, label: string): unknown
    tools: {register(tool: unknown): unknown}
    get(name: 'compaction'): {
      history?(session: HostSession, args: TaskToolArguments): unknown
      historyRead(session: HostSession, args: TaskToolArguments): unknown
      directorNotes?(session: HostSession): {text?: string} | null | undefined
    } | null | undefined
  }
  T: {branch: TaskToolTable; rules: TaskToolTable}
  clusterJob: TaskHost['clusterJob']
  resolveRoleplaySession(id: string | undefined): Promise<HostSession | null | undefined>
  storyBranchIsActive(session: HostSession): boolean
  characterCluster: TaskHost['characterCluster']
  cardWorkflowKey(id: string): string
  isRoleplaySession(session: HostSession | null | undefined): boolean
  ensureBranch(session: HostSession): Promise<unknown>
  tavernTasks: TaskHost['tavernTasks']
  startExportJob(session: HostSession, kind: 'novel-export', agent?: HostAgent): Promise<{id: string}>
  activeCardWorkflow(session: HostSession): unknown
  characterRoster(session: HostSession): {id?: string; name?: unknown; content: unknown}[]
  contextWindowKey(id: string): string
  clusterLoreVisible(session: HostSession, record: TaskToolRecord): boolean
}
