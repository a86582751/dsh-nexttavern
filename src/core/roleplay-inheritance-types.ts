import type { ContextSession, ContextEvent } from './roleplay-context.js'
import type { DirectorNotes } from '../memory/memory-history.js'
import type { StatusRecord, StatusSource, FixedStatusContext } from './roleplay-status-types.js'

export interface InheritanceSession extends ContextSession {
  header?: NonNullable<ContextSession['header']> & { parentSession?: string }
}
export interface InheritanceOptions { cadenceAnchorSeq?: number | null; cadenceTurn?: number | null }
export interface InheritanceState { branchReady: boolean; branchPreparing: Promise<void> | null }
export interface InheritanceTable<T = Record<string, unknown>> {
  get(key: string): T | undefined
  entries(): Iterable<[string, T]>
  put(key: string, value: unknown): Promise<unknown>
}
export interface CadenceSlot { turn?: unknown; anchorSeq?: unknown }
export interface InheritanceMemory extends Record<string, unknown> {
  directorNotes?: DirectorNotes | null
  directorCheckpoints?: (DirectorNotes | null)[]
  notesCadence?: { schemaVersion?: number; slots?: CadenceSlot[] }
}
export interface InheritanceTables {
  branch: InheritanceTable
  cards: InheritanceTable
  worldbook: InheritanceTable
  rules: InheritanceTable
  opening: InheritanceTable
  memory: InheritanceTable<InheritanceMemory>
  status: InheritanceTable<StatusRecord>
  scene: InheritanceTable
  rolls: InheritanceTable<unknown>
}
export interface InheritanceDependencies {
  ensureState(sessionId: string): InheritanceState
  cloneBranchRecord<T>(record: T): T
  T: InheritanceTables
  clusterLoreVisible(session: InheritanceSession, record: Record<string, unknown>, before: number): boolean
  contextWindowKey(sessionId: string): string
  cloneContextWindow<T extends object>(record: T): T | null
  ctx: {
    get(name: 'compaction'): {
      legacyCadenceSlotsFor?(session: InheritanceSession | undefined | null, memory: InheritanceMemory): CadenceSlot[]
      storyEvidence?(session: InheritanceSession): {seq: number; role?: string; kind?: string; text: string}[]
    } | undefined | null
    sessions: {get(sessionId: string): InheritanceSession | undefined | null}
    logger?: {warn?(message: string): void}
  }
  statusSource(session: InheritanceSession, event: ContextEvent | undefined): StatusSource | null
  statusFixedContext(session: InheritanceSession): FixedStatusContext
}
