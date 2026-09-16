import type { ContextSession, ContextMessage } from './roleplay-context.js'
import type { TaskAgent, TaskSelection, StoredTask } from './tavern-task-types.js'
import type { ResourceRecord } from './roleplay-resource-bridge-types.js'
import type { createTavernLibrary } from './tavern-library.js'

export interface CardWorkflowSession extends ContextSession { header: {cwd: string; seedLength?: unknown} }
export interface CardWorkflowAgent extends TaskAgent { steer?(message: ContextMessage): unknown }
export interface CardWorkflowRecord extends ResourceRecord {
  workflowId?: string
  workflowGeneration?: string
}
export interface CardWorkflowResult extends Record<string, unknown> { resourceId?: unknown }
export interface CardWorkflowJob extends Record<string, unknown> {
  id: string
  kind: string
  sessionId: string
  generation: string
  status: string
  selection: TaskSelection
  execution: TaskSelection['execution']
  source: {sourceFile: string | null; sha256: string}
  openingRequested?: boolean
}
export interface CardWorkflowDependencies {
  T: {
    branch: {
      get(key: string): unknown
      entries(): Iterable<[string, unknown]>
      put(key: string, value: unknown): Promise<unknown>
    }
    opening: {get(key: string): {text?: string} | null | undefined}
  }
  storyBranchIsActive(session: CardWorkflowSession): boolean
  modelPolicy: {resolve(session: CardWorkflowSession, kind: string, agent?: CardWorkflowAgent): TaskSelection | PromiseLike<TaskSelection>}
  statusFixedContext(session: CardWorkflowSession): unknown
  nativeTask(options: {
    session: CardWorkflowSession; agent?: CardWorkflowAgent; kind: string; format: string; selection: TaskSelection;
    source: {workflowId: string; workflowType: string; generation: string; events: {seq: number; hash: string}[]}; signal?: AbortSignal;
    timeoutMs: number; tools: string[]; system: string; user: string; validate(): Promise<CardWorkflowResult>
  }): Promise<CardWorkflowResult>
  CARD_CLASSIFICATION_GUIDE: string
  archiveImported(session: CardWorkflowSession, record: CardWorkflowRecord): Promise<{id?: string; resourceId?: unknown} | null>
  libraryFor(session: CardWorkflowSession): ReturnType<typeof createTavernLibrary>
  resourceName(name: unknown, extension?: string): string
  tavernTasks: {
    pending(session: CardWorkflowSession): Pick<StoredTask, 'id' | 'generation' | 'source'>[]
    submit(options: {session: CardWorkflowSession; id: string; generation: string; value: {finished: boolean}}): Promise<unknown>
  }
  taskAgents: Map<string, CardWorkflowAgent>
  ctx: {sessionController: {resolveAgent?(id: string): Promise<{agent?: CardWorkflowAgent} | null | undefined>}}
}
