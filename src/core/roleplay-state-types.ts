import type { ContextSession, ContextPreparation } from './roleplay-context.js'
import type { BranchSession } from './roleplay-worldline-types.js'
import type { createRoleplayWorldlines } from './roleplay-worldlines.js'
import type { createRoleplayTaskHost } from './roleplay-task-host.js'
import type { createRoleplayStatus } from './roleplay-status.js'
import type { ImportRecord } from './roleplay-import-types.js'

export type StateSession = ContextSession & BranchSession
export interface StateRecord extends Record<string, unknown> {
  sourceRecordSessionId?: string
  importId?: string
  anchors?: Record<string, {entries?: {turn?: number; seq?: number}[]}>
  modules?: Record<string, unknown>
}
export interface StateTable {
  get(key: string): StateRecord | null | undefined
  entries(): Iterable<[string, StateRecord]>
}
export interface StateContext {
  effect(work: () => unknown, label: string): unknown
  connection: {fetch: {register(route: {path: string; methods: string[]; fetch(request: Request): Promise<Response>}): unknown}}
  get(name: 'compaction'): {directorNotes?(session: StateSession): unknown} | null | undefined
}
type Worldlines = ReturnType<typeof createRoleplayWorldlines>
type Status = ReturnType<typeof createRoleplayStatus>
type StateWorldlines = Pick<Worldlines, 'repairLegacyUserReplacementIdentities' | 'buildForkLookupIndex' | 'reconcileCanonicalPlayerVariants' | 'nativeBranchGroupsFor' | 'nativePlayerGroupsFor' | 'assistantMessageId' | 'userForkContext' | 'locatePlayerRecoveryTarget' | 'failedForkMembership' | 'isRecoverySourceMember' | 'backfillRecoverySourceMember' | 'deletedBranchMessageIdsFor' | 'inheritedAssistantMessageIdsFor'>
export interface StateDependencies extends StateWorldlines {
  ctx: StateContext
  T: Record<'cards' | 'worldbook' | 'memory' | 'branch' | 'status' | 'rules' | 'opening' | 'scene' | 'drafts' | 'decision', StateTable>
  awaitImportBarrier(id: string): Promise<unknown>
  ensureBranch(session: StateSession): Promise<unknown>
  statusRecoveredSessions: Set<string>
  recoverStatusObligations: Status['recoverStatusObligations']
  selectedStatusRecord: Status['selectedStatusRecord']
  selectedStatusGeneration: Status['selectedStatusGeneration']
  normalizeDecisionRecord: Status['normalizeDecisionRecord']
  importRecordKey(id: string, importId: unknown): string
  importSummary(record: ImportRecord): Record<string, unknown>
  preparationRecordKey(id: string): string
  tavernTasks: ReturnType<typeof createRoleplayTaskHost>['tavernTasks']
  memoryForContext(session: StateSession): unknown
  contextWindowFor(session: StateSession): Record<string, unknown> | null | undefined
  cloneContextWindow<T extends object>(record: T | null | undefined): T | null
  userValues(id: string): {name: string; gender: string}
  svc: {branchLineage(session: StateSession): unknown}
  resolveRoleplaySession(id: string | null): Promise<StateSession | null | undefined>
}
export type StatePreparation = ContextPreparation | null | undefined
export interface FailedTurnGroup {
  groupId: string
  currentOrdinal: number
  total: number
  members: {sessionId: string; ordinal: number; sourceOrdinal: number; kind: string; pending: boolean; failed: boolean}[]
}
