import type { CardWorkflowSession, CardWorkflowAgent } from './roleplay-card-workflow-types.js'
import type { createCardWorkflows } from './roleplay-card-workflow.js'
import type { createNovelExports } from './novel-export.js'
import type { createRoleplayTaskHost } from './roleplay-task-host.js'
import type { createResourceBridge } from './roleplay-resource-bridge.js'
import type { taskPhaseMessage } from './tavern-tasks.js'
import type { HostSession, HostAgent, MaintenanceJob } from './roleplay-task-host-types.js'
import type { ContextEvent } from './roleplay-context.js'
import type { StatusRecord } from './roleplay-status-types.js'

export interface JobRouteAgent extends CardWorkflowAgent {
  session?: HostSession
  steer(message: ReturnType<typeof taskPhaseMessage>): unknown
}
export interface JobRouteBody {
  sessionId?: string
  action?: string
  jobId?: string
  kind: string
  resourceId?: string
  sourceFile?: unknown
}
// Shared storage contains task, workflow and import/export records.
export interface JobRouteRecord {
  id: string
  kind: string
  status: string
  source?: {workflowId?: string}
  workflowId?: string
  progress?: unknown
  execution?: unknown
  actualRoute?: unknown
  error?: unknown
  failure?: unknown
  validationFailures?: number
  resourceId?: unknown
  result?: {resourceId?: unknown}
  createdAt?: number
  completedAt?: number
  failedAt?: number
  updatedAt?: number
}
type CardWorkflows = ReturnType<typeof createCardWorkflows>
type TaskHost = ReturnType<typeof createRoleplayTaskHost>
type Resources = ReturnType<typeof createResourceBridge>
export interface JobRoutesDependencies {
  ctx: {
    effect(work: () => unknown, label: string): unknown
    connection: {fetch: {register(route: {path: string; methods: string[]; fetch(request: Request): Promise<Response>}): unknown}}
    sessionController: {resolveAgent(id: string): PromiseLike<{agent?: JobRouteAgent} | null | undefined>}
  }
  T: {branch: {entries(): Iterable<[string, unknown]>; put(key: string, value: unknown): unknown | PromiseLike<unknown>}}
  resolveRoleplaySession(id: string | null | undefined): Promise<HostSession | null | undefined>
  novelExports: ReturnType<typeof createNovelExports<HostSession, HostAgent | undefined>>
  modelPolicy: TaskHost['modelPolicy']
  tavernTasks: TaskHost['tavernTasks']
  taskAgents: Map<string, JobRouteAgent>
  beginCardWorkflow: CardWorkflows['beginCardWorkflow']
  cardWorkflows: CardWorkflows['cardWorkflows']
  cardWorkflowKey: CardWorkflows['cardWorkflowKey']
  libraryFor: Resources['libraryFor']
  migrateResources: Resources['migrateResources']
}

export interface MaintenanceAgent extends HostAgent {
  ctx?: {get?(name: 'compaction'): MaintenanceEngine | null | undefined}
}
export interface MaintenanceEngine {
  organizeNow?(agent: MaintenanceAgent): unknown | PromiseLike<unknown>
}
export interface MaintenanceRouteJob extends MaintenanceJob {
  id: string
  startedAt: number
  result?: unknown
}
export interface MaintenanceRoutesDependencies {
  ctx: Pick<JobRoutesDependencies['ctx'], 'effect' | 'connection'> & {
    get(name: 'compaction'): MaintenanceEngine | null | undefined
    sessionController: {resolveAgent(id: string): PromiseLike<{agent?: MaintenanceAgent; error?: unknown} | null | undefined>}
  }
  resolveRoleplaySession(id: string | null | undefined): Promise<HostSession | null | undefined>
  maintenanceJobs: Map<string, MaintenanceRouteJob>
  latestStatusEvent(session: HostSession): ContextEvent | null | undefined
  runStatusObligation(session: HostSession, event: ContextEvent, reason: string, options: {force: boolean; agent: MaintenanceAgent}): PromiseLike<StatusRecord | null | undefined>
  selectedStatusRecord(session: HostSession): StatusRecord | null | undefined
}
