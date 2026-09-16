import type { HostSession, HostAgent } from './roleplay-task-host-types.js'
import type { ContextPreparation } from './roleplay-context.js'
import type { createRoleplayTaskHost } from './roleplay-task-host.js'
import type { StoredTask } from './tavern-task-types.js'
import type { TelemetryCallRecord } from './tavern-telemetry-normalize.js'

export interface DiagnosisJob extends StoredTask {
  selection?: {execution?: string; actualRoute?: {provider?: unknown; model?: unknown; reasoningEffort?: unknown}}
}
export type DiagnosisCall = Omit<TelemetryCallRecord, 'status'> & {status: string}
type TaskHost = ReturnType<typeof createRoleplayTaskHost>
export interface DiagnosisDependencies {
  ctx: {effect(work: () => unknown, label: string): unknown; tools: {register(tool: unknown): unknown}}
  T: {
    branch: {get(key: string): ContextPreparation | null | undefined}
    status: {get(key: string): {source?: {turnId?: number; sourceSeqs?: number[]}} | null | undefined}
    memory: {get(key: string): {version?: unknown; deltas?: unknown[]; pendingConfirmations?: unknown[]} | null | undefined}
  }
  simpleTool(name: string, description: string, parameters: unknown, execute: (args: Record<string, never>, execution: {agent: HostAgent}) => Promise<unknown>): unknown
  sessionOf(execution: {agent: HostAgent}): Promise<HostSession>
  modelPolicy: TaskHost['modelPolicy']
  tavernTasks: Pick<TaskHost['tavernTasks'], 'activity'> & {list(session: HostSession): DiagnosisJob[]}
  telemetry: {calls(): DiagnosisCall[]}
  preparationRecordKey(id: string): string
  characterCluster: TaskHost['characterCluster']
  characterRoster: TaskHost['characterRoster']
  memorySettingsPolicy(id: string): {effective: Record<string, unknown>}
  enhancements?(session: HostSession): Promise<Record<string, unknown>>
}
export interface DiagnosisAttempts {
  count: number
  failed: number
  started: number
  completed: number | null
  models: Set<string>
}
