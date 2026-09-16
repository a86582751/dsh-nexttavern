import type { ContextSession } from './roleplay-context.js'
import type { StatusOption } from './roleplay-status-types.js'
import type { DecisionRecord } from './roleplay-decision-types.js'

export interface ServiceSession extends ContextSession {
  header?: NonNullable<ContextSession['header']> & { parentSession?: string }
}
export interface ServiceWaitResult { completed: boolean; timedOut: boolean }
export interface VersionRecord extends Record<string, unknown> {
  anchors?: Record<string, {entries?: {turn: number; seq: number}[]; [key: string]: unknown}>
}
export interface ServiceTable {
  get(key: string): Record<string, unknown> | null | undefined
  put(key: string, value: unknown): Promise<unknown>
  update(key: string, work: (value: Record<string, unknown> | null | undefined) => Record<string, unknown>): Promise<unknown>
}
export interface ServiceTables {
  cards: {entries(): Iterable<[string, Record<string, unknown>]>}
  worldbook: {entries(): Iterable<[string, Record<string, unknown>]>}
  branch: ServiceTable
  memory: ServiceTable
  scene: ServiceTable
  status: ServiceTable
  rules: ServiceTable
  opening: ServiceTable
  decision: ServiceTable
}
export interface ServiceDecisionInput extends Record<string, unknown> { options?: unknown[] }
export interface ServiceDependencies<N> {
  nativeTask: N
  storyBranchIsActive(session: ServiceSession): boolean
  ensureState(id: string): {commitChain?: Promise<unknown>}
  ctx: {
    logger?: {warn?(message: string): void}
    sessions: {get(id: string): ServiceSession | null | undefined}
  }
  T: ServiceTables
  lockedFactsOf(tables: ServiceTables, id: string): {source: string; text: unknown}[]
  cloneBranchRecord<T>(record: T): T
  memorySettingsPolicy(id: string): {effective: Record<string, unknown>}
  normalizeDecisionRecord(record: Record<string, unknown> | null | undefined): DecisionRecord | null
  contextWindowKey(id: string): string
  cloneContextWindow<T extends object>(record: T): T | null
  normalizeStatusOption(value: unknown): StatusOption
}
