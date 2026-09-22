import type {ConnectionFetchRoute} from '@deepseek-ai/dsh-client-connection'
import type { createRoleplayWorldlines } from './roleplay-worldlines.js'
import type { BranchSession, ForkOperation, RegistrationResult } from './roleplay-worldline-types.js'
import type { createConversationCatalog } from './tavern-conversations.js'

export interface BranchRouteSession extends BranchSession {
  header?: NonNullable<BranchSession['header']> & {cwd?: string}
}
export interface StoredBranchOperation extends ForkOperation {
  schemaVersion?: number
  state?: string
  consumed?: boolean
  expiresAt: number
  createdAt: number
  childSessionId?: string
  reservedChildSessionId?: string
  groupId?: string
  ordinal?: number
  abortedAt?: number
  failureReason?: string
  promptSha256?: string
  registration?: Partial<RegistrationResult> & {truncated?: boolean; childSessionId?: string}
}
export interface BranchRouteBody {
  action?: unknown
  sessionId?: string
  childSessionId?: string
  operationId?: string
  kind?: unknown
  messageId?: unknown
  userSeq?: unknown
  requestId?: unknown
  promptText?: unknown
  text?: unknown
  role?: unknown
  seq?: unknown
}
export interface ForkReservation {
  sourceSessionId: string
  childSessionId: string
  seedLength: number
}
export interface BranchRouteError {message?: unknown; code?: string}
type Worldlines = ReturnType<typeof createRoleplayWorldlines>
type Catalog = ReturnType<typeof createConversationCatalog> & {ready?: PromiseLike<unknown>}
export interface BranchRoutesDependencies extends Pick<Worldlines,
  'assertStoryBranchActive' | 'withForkMutationLock' | 'forkOperationKey' |
  'reconcileCanonicalPlayerVariants' | 'buildForkLookupIndex' | 'userForkContext' |
  'locatePlayerRecoveryTarget' | 'assistantMessageId' | 'forkPointerFor' |
  'hydrateForkGroup' | 'forkGroupKey' | 'groupMemberForSession' | 'locateForkTarget' |
  'bootstrapChildBranch' | 'registerRecoveryFork' | 'registerNativeFork' |
  'forkAnchorLockKey' | 'requestUserEvent' | 'forkPendingKey' | 'reconcileNativeFork' |
  'replaceAssistantText' | 'replaceUserText'> {
  ctx: {
    effect(work: () => unknown, label: string): unknown
    connection: {fetch: {register(route: ConnectionFetchRoute): unknown}}
    sessions: {get(id: string): BranchRouteSession | null | undefined}
    get(name: 'tavernConversations'): Catalog | null | undefined
    sessionController: {
      resolveAgent(id: string): PromiseLike<{agent?: {session?: BranchRouteSession; status?: string}; error?: BranchRouteError} | null | undefined>
      create(options: {sessionId: string; cwd?: string; agentPreset: string}): PromiseLike<{sessionId?: string} | null | undefined>
      // Alpha.3 host-only extension: OFFICIAL-SESSION-FORK-PREP-20260910.
      // GA adaptation must retain the reservation-before-publication contract.
      forkPrepared?(options: {sessionId: string; atSeq: number}, beforePublish: (reservation: ForkReservation) => Promise<void>): PromiseLike<{sessionId?: string} | null | undefined>
    }
  }
  T: {branch: {
    get(key: string): unknown
    put(key: string, value: object): PromiseLike<unknown>
    update(key: string, work: (current: unknown) => object): PromiseLike<unknown>
    delete(key: string): PromiseLike<unknown>
  }}
  resolveRoleplaySession(id: string | null | undefined): Promise<BranchRouteSession | null | undefined>
  cloneBranchRecord<T>(value: T): T
}
