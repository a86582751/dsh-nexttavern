import type { ContextEvent, ContextSession,ContextStoryEntryReader } from './roleplay-context.js'
import type { createCharacterCluster } from './character-cluster.js'
import type { TaskAgent, TaskOptions, TaskSpec,TaskSelection,StoredTask } from './tavern-task-types.js'
import type { StatusRecord } from './roleplay-status-types.js'
import type { AuthorTables, AuthorDependency } from './roleplay-author-context-types.js'
import type {InputPreparationCurrency} from './roleplay-input-preparation.js'
import type {AuthorDialogChatAddress} from './roleplay-author-dialog.js'
import type {AuthorDialogPromptV1} from './roleplay-author-dialog.js'
import type {RubyAnalysisPromptV1} from './roleplay-ruby-task-types.js'
import type {OwnedRubyTaskOwnerV1} from 'dsh-nexttavern-native-subagent'
import type {TaskJob} from './tavern-task-types.js'
import type {CharacterPrivateView} from '../memory/character-private-memory.js'

export interface HostSession extends ContextSession {
  header?: NonNullable<ContextSession['header']> & {parentSession?: string}
}
export interface HostAgent extends TaskAgent {
  session?: HostSession
  options?: NonNullable<TaskAgent['options']> & {tavernTaskId?: string; [key: string]: unknown}
  status?: string
  steer?(message: ReturnType<typeof import('./tavern-tasks.js').taskPhaseMessage>): unknown
}
export interface HostRecord extends Record<string, unknown> {
  id?: string
  sessionId?: string
  status?: string
  kind?: string
  generation?: string
  taskStage?: string
}
export interface HostTable {
  get(key: string): HostRecord | null | undefined
  entries(): Iterable<[string, HostRecord]>
  put(key: string, value: unknown): void | PromiseLike<unknown>
}
export interface HostTables {branch: HostTable; cards: HostTable}
export interface HostSource {
  characterBackground?:{sourceKey:string}
  schemaMaintenance?:{basisSha256:string}
  authorDialog?:{binding:AuthorDialogChatAddress;operationId:string;promptPlanSha256:string}
  rubyAnalysis?:{sourceIdentitySha256:string;promptPlanSha256:string}
  inputPreparation?: InputPreparationCurrency
  preparationId?: string
  hashKind?: string
  workflowId?: string
  workflowType?: string
  generation?: string
  events?: {seq: number; hash: string}[]
  fixedHash?: string
  dependencies?: readonly AuthorDependency[]
}
export type CharacterBackgroundTaskKindV1='character-perception'|'character-offscreen'
export interface CharacterBackgroundTaskReferenceV1 {
  readonly kind:CharacterBackgroundTaskKindV1
  readonly taskId:string
  readonly generation:string
  readonly resultSha256?:string
  readonly childSessionId?:string
}
export interface CharacterBackgroundResultV1<Result=unknown> extends CharacterBackgroundTaskReferenceV1 {
  readonly resultSha256:string
  readonly result:Result
}
export interface CharacterBackgroundRequestV1<Result=unknown> {
  readonly session:HostSession
  readonly agent?:HostAgent
  readonly kind:CharacterBackgroundTaskKindV1
  readonly sourceKey:string
  readonly input:Record<string,unknown>
  readonly system:string
  readonly user:string
  readonly selection?:TaskSelection
  /** The branch/feature/member owner supplies this lifetime, independently of the parent turn. */
  readonly signal?:AbortSignal
  current():boolean
  readonly format?:'json'|'text'
  readonly timeoutMs?:number
  readonly maxTokens?:number
  /** Persist the real admitted job before its first Native request. */
  onPrepared?(reference:CharacterBackgroundTaskReferenceV1):void|PromiseLike<void>
  validate?(value:unknown):Result|PromiseLike<Result>
}
export interface CharacterPrivateTaskHostV1 {
  enabled(session:HostSession):boolean
  catalog(session:HostSession):{id:string;name:string}[]
  prepare(session:HostSession,characterId:string,signal?:AbortSignal):Promise<CharacterPrivateView>
  current(view:CharacterPrivateView):boolean
  beforeCast(session:HostSession,characterIds:readonly string[]):void|PromiseLike<void>
  taskCurrent(session:HostSession,job:StoredTask):boolean
}
export interface AuthorDialogRequestV1 {
  session:HostSession
  agent?:HostAgent
  prompt:AuthorDialogPromptV1
  signal?:AbortSignal
  /** Root's actual pending Browser/Core operation lifetime. Never deserialized. */
  current():boolean
  timeoutMs?:number
  maxTokens?:number
}
export interface RubyAnalysisRequestV1 {
  session:HostSession
  agent?:HostAgent
  prompt:RubyAnalysisPromptV1
  signal?:AbortSignal
  current():boolean
  createOwner(job:TaskJob):OwnedRubyTaskOwnerV1
  /** Explicit player retry after Core confirmed the same captured inputs. */
  retry?:true
  timeoutMs?:number
  maxTokens?:number
}
export interface MaintenanceJob {
  kind: string
  state: string
  atSeq?: number
  error?: string | null
  finishedAt?: number
}
export interface NativeTaskInput<Result = unknown> extends Omit<TaskSpec<HostSession, HostAgent>, 'source' | 'input' | 'kind' | 'validate'> {
  validate?(value: unknown): Result | PromiseLike<Result>
  kind?: string
  system: string
  user: string
  source?: HostSource
  generationKey?: unknown
  taskStage?: string
}
export interface TaskHostCompaction {
  storyEvidence?(session: HostSession): {seq: number; text: string}[]
  storyEvidenceAt?(session:HostSession,seqs:readonly number[]):readonly {seq:number;text:string}[]
  resumeTask?(agent: HostAgent, signal: AbortSignal | undefined, stage?: string): PromiseLike<unknown>
}
export interface TaskHostDependencies {
  characterPrivate?:CharacterPrivateTaskHostV1
  storyEntryReader?:ContextStoryEntryReader
  observeRecords?:TaskOptions<HostSession,HostAgent>['observeRecords']
  advancedCard?(session:HostSession):{state:string;characters:{id:string;name:unknown;content:string}[]}
  assertCardWorkflow(session:import('./roleplay-import-types.js').ImportSession,
    record:import('./roleplay-card-workflow-types.js').CardWorkflowRecord):void
  /** The actual checked Native claim; a player claim never becomes an inline task. */
  currentTaskClaim?(agent:HostAgent):{workflowId?:string}|undefined
  /** Known durable InputOwner refusal only; no task or Native authorization. */
  inputTaskRecoveryBlockCode?(session:HostSession):string|undefined
  inputCurrency?(session:HostSession):InputPreparationCurrency | undefined
  inputCurrencyCurrent?(session:HostSession,currency:InputPreparationCurrency):boolean
  inputHistoricalCurrencyCurrent?(session:HostSession,currency:InputPreparationCurrency):boolean
  T: HostTables & AuthorTables
  ctx: {
    effect(work:()=>unknown,label?:string):unknown
    logger?:{warn?(message:string):unknown}
    llm?: {resolveModelInfo?(provider: string, model: string): PromiseLike<{provider: string; id: string}>}
    agentDefaultModel: {currentSelection(): unknown}
    sessions: {get(id: string): HostSession | null | undefined}
    sessionController: {resolveAgent?(id: string): PromiseLike<{agent?: HostAgent} | null | undefined>}
    subagents: NonNullable<TaskOptions<HostSession, HostAgent>['subagents']> & Parameters<typeof createCharacterCluster<HostSession, HostAgent>>[0]['subagents']
    get(name: 'compaction'): TaskHostCompaction | null | undefined
    get(name: 'tavernConversations'): Pick<ReturnType<typeof import('./tavern-conversations.js').createConversationCatalog>,
      'rootOf'|'snapshot'|'selectionOf'> & {ready?:PromiseLike<unknown>} | null | undefined
  }
  config: {workerProvider?: string | null; workerModel?: string | null}
  taskAgents: Map<string, HostAgent>
  storyBranchIsActive(session: HostSession): boolean
  statusFixedContext(session: HostSession): unknown
  taskDependenciesCurrent(tables: AuthorTables, id: string, dependencies?: readonly AuthorDependency[]): boolean
  taskInstruction(session: HostSession): string
  getMaintenanceJob(id: string): MaintenanceJob | undefined
  runStatusObligation(session: HostSession, event: ContextEvent | undefined, reason: string, options: {agent: HostAgent}): PromiseLike<StatusRecord | null | undefined>
  STATUS_SYSTEM: string
  DECISION_SYSTEM: string
  ORGANIZE_WORKER_SYSTEM: string
}
