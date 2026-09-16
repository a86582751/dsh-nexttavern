import {decodeTaskRecord} from './tavern-task-primitives.js'

export interface TaskSession {id: string}
export interface TaskAgent {session?: TaskSession; options?: {subagentDepth?: unknown; provider?: string; model?: string; reasoningEffort?: unknown}}
export interface TaskRoute {provider: string; model: string; reasoningEffort?: unknown}
export type TaskStatus = 'queued' | 'running' | 'waiting-main' | 'completed' | 'failed' | 'cancelled' | 'stale'
export interface StoredTask {
  schemaVersion: 1
  id: string
  sessionId: string
  kind: string
  status: TaskStatus
  branchId?: string
  execution?: 'inline' | 'spawn'
  generation?: string
  main?: TaskRoute
  actualRoute?: TaskRoute
  source?: unknown
  sourceHash?: string
  input?: Record<string, unknown>
  promptContext?: import('./tavern-task-context.js').MaintenancePromptContext
  allowedTools?: string[]
  generationOptions?: {maxTokens?: number}
  background?: boolean
  createdAt?: number
  updatedAt?: number
  result?: unknown
  error?: string | null
  failure?: unknown
  validationFailures?: number
  [key: string]: unknown
}
export interface TaskJob extends StoredTask {
  generation: string
  execution: 'inline' | 'spawn'
  main: TaskRoute
  actualRoute: TaskRoute
  input: Record<string, unknown>
}
export interface TaskSelection {
  execution: 'inline' | 'spawn'
  main: TaskRoute
  actualRoute: TaskRoute
  policyRevision?: unknown
}
export interface TaskSpec<S, A> {
  session: S
  agent?: A
  kind: string
  source: unknown
  input: Record<string, unknown>
  signal?: AbortSignal
  promptContext?: import('./tavern-task-context.js').MaintenancePromptContext
  tools?: string[]
  format?: string
  background?: boolean
  retryBackground?: boolean
  requestKey?: unknown
  maxTokens?: number
  timeoutMs?: number
  selection?: TaskSelection
  validate?(value: unknown): unknown | PromiseLike<unknown>
  onAdmission?(job: TaskJob): unknown | PromiseLike<unknown>
  onResult?(job: TaskJob): unknown | PromiseLike<unknown>
}
export interface TaskResult {
  stopReason: string
  output?: {type: string; text?: string}[]
  structured?: unknown
}
export interface TaskChild {
  id: string
  result: PromiseLike<TaskResult>
  dispose(): unknown
  localAgent?: {session?: {events?: {type: string; data?: {reason?: unknown}}[]}}
}
export interface TaskOptions<S, A> {
  table: {get(key: string): unknown; entries(): Iterable<[string, unknown]>; put(key: string, value: unknown): unknown | PromiseLike<unknown>}
  policy: {resolve(session: S, kind: string, agent?: A): TaskSelection | PromiseLike<TaskSelection>}
  subagents?: {start(mode: 'spawn', request: {
    parent?: A
    signal: AbortSignal
    agentOptions: TaskRoute & {tavernTaskId: string; maxTokens?: number}
    maxDepth: 1
    toolFilter: {allow: string[]}
    label: string
    persona: string
    prompt: {type: 'text'; text: string}[]
  }): TaskChild | PromiseLike<TaskChild>}
  isCurrent?(session: S, job: StoredTask): boolean | PromiseLike<boolean>
}
export interface Admission<S, A> {
  job: TaskJob
  spec: TaskSpec<S, A>
  generation: string
  ready: boolean
  promise: Promise<unknown>
  resolve(value: unknown): void
  reject(reason?: unknown): void
  readyForDispatch(): void
}
export interface Batch<S, A> {key: string; session: S; items: Map<string, Admission<S, A>>; scheduled: boolean; running: boolean}
export interface SharedBatch<S, A> {session: S; items: Admission<S, A>[]; expiry: Promise<void> | null}
export interface TaskControl<S, A> {generation: string; controller: AbortController; batch?: SharedBatch<S, A>}

export const taskObject = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const isRoute = (value: unknown): value is TaskRoute => {
  const route=taskObject(value)
  return !!route && typeof route.provider==='string' && typeof route.model==='string'
}
export function storedTask(value: unknown): StoredTask | null {
  const record=decodeTaskRecord(value)
  if(!record)return null
  for(const key of ['generation','sourceHash'])if(record[key]!==undefined&&typeof record[key]!=='string')return null
  for(const key of ['createdAt','updatedAt','validationFailures'])if(record[key]!==undefined&&typeof record[key]!=='number')return null
  if(record.error!=null&&typeof record.error!=='string')return null
  if(record.background!==undefined&&typeof record.background!=='boolean')return null
  if(record.input!==undefined&&!taskObject(record.input))return null
  for(const key of ['main','actualRoute'])if(record[key]!==undefined&&!isRoute(record[key]))return null
  if(record.allowedTools!==undefined&&(!Array.isArray(record.allowedTools)||!record.allowedTools.every(value=>typeof value==='string')))return null
  if(record.generationOptions!==undefined) {
    const options=taskObject(record.generationOptions)
    if(!options || (options.maxTokens!==undefined&&typeof options.maxTokens!=='number'))return null
  }
  if(record.execution!==undefined&&record.execution!=='inline'&&record.execution!=='spawn')return null
  return record as StoredTask
}
export function executableTask(value: unknown): TaskJob | null {
  const record=storedTask(value)
  return record && typeof record.generation==='string' && record.execution!==undefined && record.main && record.actualRoute && record.input ? record as TaskJob : null
}
