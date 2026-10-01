// Structural contracts for the native Session branch ledger. Host-owned data
// retains unknown extension fields so replacements preserve the original record.
import type { ContextSession, ContextEvent } from './roleplay-context.js'
import type { StorySurfaceReplacement } from './roleplay-message-view.js'
export type MessageData = NonNullable<ContextEvent['data']>
export type StoryEvent = ContextEvent
export interface ReadBranchSession extends ContextSession {
  header?: NonNullable<ContextSession['header']> & {parentSession?: string}
}
export interface BranchSession extends ReadBranchSession {
  append(type: string, data: MessageData, options: { surfaceOp: StorySurfaceReplacement; sourceEventSeqs: number[] }): StoryEvent
}
export interface ForkAnchor {
  sourceSessionId: string
  sourceAssistantMessageId?: string
  sourceAssistantSeq?: number
  sourceAssistantTurn?: number
  sourceUserMessageId: string
  sourceUserSeq: number
  sourceTurn: number
  previousTurnEndSeq: number | null
  expectedSeedLength?: number
  promptText: string
  recoveryOnly?: boolean
}
export interface PlayerTarget {
  sessionId: string
  userMessageId?: string | null
  userSeq?: number | null
  promptText?: string
  playerVariantId?: string
  playerOrdinal?: number
  playerTextRevision?: number
  playerAppliedRevision?: number
  playerEditSourceSeq?: number
  playerEditSeq?: number | null
  editedAt?: number
  projectionOnly?: boolean
}
export interface ForkMember extends PlayerTarget {
  ordinal: number
  kind: string
  playerVariantId: string
  operationId?: string
  requestId?: string
  assistantMessageId?: string | null
  assistantSeq?: number | null
  assistantEditSeq?: number
  createdAt: number
  pending: boolean
  deleted: boolean
  failed?: boolean
  failureReason?: string
  failedAt?: number
  deletedAt?: number
  deleteResult?: {nextSessionId: string; remaining: number; deletedOrdinal: number}
  completedAt?: number
  legacyAssistantMessageId?: string | null
  legacyAssistantSeq?: number | null
  legacyPointerRepairedAt?: number
}
export interface PlayerVariant {
  text: string
  revision: number
  updatedAt?: number
  updatedBySessionId?: string
}
export interface ForkGroup {
  schemaVersion: number
  groupId: string
  rootSessionId: string
  anchor: ForkAnchor
  members: ForkMember[]
  playerVariants: Record<string, PlayerVariant>
  createdAt: number
  updatedAt: number
}
export interface ForkOperation {
  operationId: string
  requestId?: string
  anchor: ForkAnchor
  kind: string
  promptText: string
}
export interface BranchRecord extends Partial<ForkGroup> {
  childSessionId?: string
  sessionId?: string
  sourceRecordSessionId?: string
  operationId?: string
  requestId?: string
  ordinal?: number
  state?: string
  abortedAt?: number
  sourceSeq?: number
  targetSeq?: number
  editSeq?: number | null
  role?: 'user' | 'assistant'
  textSha256?: string
  userMessageId?: string
  userSeq?: number
  revision?: number
}
export interface RecordTable<T> {
  get(key: string): T | undefined
  entries(): Iterable<[string, T]>
  put(key: string, value: object): Promise<unknown>
  delete(key: string): Promise<unknown>
  update(key: string, update: (current: T | undefined) => object): Promise<unknown>
}
export interface ForkLookup {
  bySessionMessage: Map<string, string>
  groups: ForkGroup[]
}
export interface BranchProjection {
  groupId: string
  currentOrdinal: number
  total: number
  members: { sessionId?: string; ordinal: number; sourceOrdinal: number; kind?: string; pending: boolean }[]
}
export interface PlayerProjection {
  userMessageId?: string
  assistantMessageId: string | null
  group: BranchProjection | null
}
export interface SurfaceEntry { seq: number; kind: string; messageId?: string }
export interface RegistrationResult { groupId: string; ordinal: number; total: number; playerOrdinal?: number; playerTotal: number }
export interface ReplacementResult { changed: number; matched: number; replayed: boolean }
/** The format plugin owns event construction and interpretation; branch code owns effects and locks. */
export interface WorldlineMessageEdits {
  append(session: BranchSession, targetSeq: number, identity: {role: 'user' | 'assistant'; messageId: string}, text: string): StoryEvent
  latest(events: readonly StoryEvent[], targetSeq: number): StoryEvent | null
  current(session: ReadBranchSession, events: readonly StoryEvent[]): readonly StoryEvent[]
}
export interface WorldlineDependencies {
  messageEdits: WorldlineMessageEdits
  flushEdits(session: BranchSession): Promise<void>
  safeId(value: unknown): string
  keyOf(sessionId: string, suffix: string): string
  sha256(value: unknown): string
  T: { branch: RecordTable<BranchRecord> } & Record<'cards' | 'worldbook' | 'rules' | 'opening' | 'status' | 'decision' | 'scene' | 'memory', RecordTable<Record<string, unknown>>>
  eventsOf(session: ReadBranchSession): readonly StoryEvent[]
  isCompletedTurnEnd(event: StoryEvent): boolean
  surfaceEvents(session: ReadBranchSession): StoryEvent[]
  textOf(content: unknown): string
  cloneBranchRecord<T>(value: T): T
  ctx: { sessions: { get(id: string): BranchSession | undefined } }
  internalTaskSeqs(session: ReadBranchSession): Set<number>
  importActiveKey(id: string): string
  resolveRoleplaySession(id: string): Promise<BranchSession | null | undefined>
  isRoleplaySession(session: BranchSession): boolean
  ensureState(id: string): { branchReady: boolean }
  ensureBranch(session: BranchSession, options: { cadenceAnchorSeq: number; cadenceTurn: number }): Promise<unknown>
  durableSeq(value: unknown): number | null
  canonicalAssistantForTurn(session: ReadBranchSession, turn: number): StoryEvent | null | undefined
  surfaceEntries(session: ReadBranchSession): SurfaceEntry[]
  withDecisionMutationLock<T>(id: string, work: () => Promise<T>): Promise<T>
  normalizeDecisionRecord(value: unknown): Record<string, unknown> | null
  cloneRecord<T>(value: T): T
  provenanceSeq(value: unknown): number | null
}
