import type {ConnectionFetchRoute} from '@deepseek-ai/dsh-client-connection'
import type { createRoleplayWorldlines } from './roleplay-worldlines.js'
import type { BranchSession, ForkOperation, RegistrationResult } from './roleplay-worldline-types.js'
import type { createConversationCatalog } from './tavern-conversations.js'
import type {TavernSourceInheritanceOwnerV1,TavernSourceInheritancePreparationV1} from './roleplay-tavern-source-inheritance-types.js'
import type {RoleplayInputRecoveryDiagnosticV1} from './roleplay-input-preparation.js'

export interface CleanBranchModelSelection {
  provider:string
  model:string
  reasoningEffort?:string
}
export interface CleanBranchInspection {
  ok:true
  branchId:string
  operationId:string
  revision:string
  selectionRevision:number
  diagnostic:RoleplayInputRecoveryDiagnosticV1
  completedBoundary:{turn:number;turnEndSeq:number}
  model:CleanBranchModelSelection
}
export interface CleanBranchRequest {sessionId:string;operationId:string;expectedRevision:string}
export interface CleanBranchPreparation {
  ok:boolean
  kind:'prepare-clean-branch'
  operationId:string
  sourceSessionId:string
  childSessionId:string|null
  status:'prepared'|'ready'|'failed'
  requiresPlayerInput:true
  error:string|null
  conversations:ReturnType<ReturnType<typeof createConversationCatalog>['snapshot']>
}
export type CleanBranchPreparationSummary=Omit<CleanBranchPreparation,'conversations'>
export interface CleanBranchOperationV1 {
  schemaVersion:1
  expectedRevision:string
  diagnostic:RoleplayInputRecoveryDiagnosticV1
  sourceRevision:string
  selectionRevision:number
  completedTurnEndSha256:string
  nativeThroughSeq:number
  model:CleanBranchModelSelection
  bootstrapComplete?:true
  modelCopied?:true
}

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
  failure?: {schemaVersion: 1; code: string; message: string; at: number}
  promptSha256?: string
  registration?: Partial<RegistrationResult> & {truncated?: boolean; childSessionId?: string}
  clean?:CleanBranchOperationV1
}
export interface BranchRouteBody {
  action?: unknown
  sessionId?: string
  childSessionId?: string
  operationId?: string
  kind?: unknown
  messageId?: unknown
  seq?: unknown
  userSeq?: unknown
  requestId?: unknown
  promptText?: unknown
  text?: unknown
  role?: unknown
  expectedRevision?:unknown
  schemaTaskEdit?:unknown
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
  'bootstrapChildBranch' | 'registerRecoveryFork' | 'registerNativeFork' | 'locateProgrammaticOpeningTarget' |
  'forkAnchorLockKey' | 'requestUserEvent' | 'forkPendingKey' | 'reconcileNativeFork' | 'failPendingNativeFork' |
  'replaceAssistantText' | 'replaceUserText'> {
  sourceInheritance?:TavernSourceInheritanceOwnerV1
  ctx: {
    effect(work: () => unknown, label: string): unknown
    connection: {fetch: {register(route: ConnectionFetchRoute): unknown}}
    sessions: {get(id: string): BranchRouteSession | null | undefined; flush(session: BranchRouteSession): PromiseLike<boolean>}
    get(name: 'tavernConversations'): Catalog | null | undefined
    sessionController: {
      resolveAgent(id: string): PromiseLike<{agent?: {session?: BranchRouteSession; status?: string;
        generateProgrammaticAssistant?: (input: {operationId: string; messageId: string; instruction: string}) =>
          Promise<{kind: 'committed' | 'busy' | 'unknown'; turn?: number; messageId?: string; reason?: string}>};
        error?: BranchRouteError} | null | undefined>
      create(options: {sessionId: string; cwd?: string; agentPreset: string}): PromiseLike<{sessionId?: string} | null | undefined>
      // Alpha.3 host-only extension: OFFICIAL-SESSION-FORK-PREP-20260910.
      // GA adaptation must retain the reservation-before-publication contract.
      forkPrepared?(options: {sessionId: string; atSeq: number}, beforePublish: (reservation: ForkReservation) => Promise<void>): PromiseLike<{sessionId?: string} | null | undefined>
      selectModelForSession?(request:CleanBranchModelSelection & {sessionId:string}):PromiseLike<unknown>
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
  /** Coordinate Source and numerical inheritance for the actual reservation.
   * Historical replay remains outside Source's FIFO and Native forkPrepared. */
  prepareWorldlineInheritance?(operation: StoredBranchOperation, reservation: ForkReservation)
    :Promise<TavernSourceInheritancePreparationV1>
  /** Release the reservation material when its operation fails or is aborted. */
  releaseWorldlineInheritance?(childSessionId:string):void
  /** Refuse before any Native child/reservation or plain-branch fallback. */
  numericalForkBlockCode?(sessionId:string):string|undefined
  /** Clean recovery consumes these owners' DATA, never side-authored state or an execution lease. */
  readInputRecoveryDiagnostic?(sessionId:string):RoleplayInputRecoveryDiagnosticV1|null
  readMainModelSelection?(session:BranchRouteSession):CleanBranchModelSelection
  captureCleanBranchSource?(session:BranchRouteSession):{revision:string;assertCurrent():void}
  generateProgramOpening?(input:{sessionId:string;operation:StoredBranchOperation;messageId:string;instruction:string})
    :Promise<{kind:'committed'|'busy'|'unknown';turn?:number;reason?:string}|undefined>
}
