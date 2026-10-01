import type { ContextEvent, ContextMessage, ContextSession } from './roleplay-context.js'
import type { StorySurfaceOp } from './roleplay-message-view.js'
import type { TaskMessage } from './tavern-task-context.js'
import type { HostAgent, HostSession } from './roleplay-task-host-types.js'
import type { createRoleplayTaskHost } from './roleplay-task-host.js'
import type { CompletionSnapshot, CompletionState } from './roleplay-completion-types.js'
import type { DecisionJob, DecisionRecord } from './roleplay-decision-types.js'
import type { PreparationTable } from './roleplay-preparation-types.js'
import type { createRoleplayStatus } from './roleplay-status.js'

export interface LoopSession extends HostSession {
  append(type: string, data: TaskMessage, options: {
    surfaceOp: StorySurfaceOp
    sourceEventSeqs?: number[]
  }): ContextEvent
}
export interface LoopAgent extends HostAgent {
  session: LoopSession
  steer: NonNullable<HostAgent['steer']>
  cancel?(cause:{kind:'hook';reason:string},options:{keepInbox:true}):void
}
export interface LoopPayload {
  agent: LoopAgent
  turn: number
  step: number
  messages: readonly ContextMessage[]
  signal?: AbortSignal
}
// Pinned alpha.3 agent PreStepDecision; keep request-series metadata intact.
export type StepDecision = {kind: 'enter'; messages: readonly ContextMessage[]; startsRequestSeries?: true; [key: string]: unknown}
  | {kind: 'reject'; [key: string]: unknown}
export interface LoopPreparation extends Record<string, unknown> {
  schemaVersion: 1
  id: string
  sessionId: string
  branchId: string
  turn: number
  messages: readonly ContextMessage[]
  status: string
  createdAt: number
  sourceHash: string
}
export interface LoopState extends CompletionState {lastPreparedTurn: number}
export interface PromptPart {name: string; [key: string]: unknown}
export interface PromptAssembly {
  contexts: PromptPart[]
  sections: PromptPart[]
  tools: PromptPart[]
  [key: string]: unknown
}
export interface LoopContext {
  on(name:'agent/request',hook:(payload:{agent:LoopAgent;turn:number;step:number;signal:AbortSignal},next:()=>Promise<unknown>)=>Promise<unknown>):unknown
  on(name:'session/event',hook:(session:ContextSession,event:ContextEvent)=>void,options:{global:true}):unknown
  on(name: 'system-prompt/assemble', hook: (assembly: PromptAssembly, context: {agent?: LoopAgent}, next: () => Promise<PromptAssembly>) => Promise<PromptAssembly>, options: {global: boolean}): unknown
  on(name: 'agent/pre-step', hook: (payload: LoopPayload, next: () => Promise<StepDecision>) => Promise<StepDecision>): unknown
  on(name: 'agent/turn-stopping', hook: (payload: {agent?: LoopAgent; turn: number; signal?: AbortSignal}) => Promise<void>): unknown
  effect(work: () => unknown, label: string): unknown
  tools: {guard?(hook: (execution: {agent?: LoopAgent; name: string; arguments?:unknown}) => string | undefined): unknown}
  logger?: {warn?(message: string): void; info?(message:string):void}
  get(name: 'compaction'): {finishTurn?(agent: LoopAgent, signal?: AbortSignal): PromiseLike<unknown>} | null | undefined
}
type TaskHost = ReturnType<typeof createRoleplayTaskHost>
export interface LoopDependencies {
  authorContext?(session:HostSession):{revision:string;parts:{section:string;name:string;text:string;renderedText:string}[]}
  adaptationScope?(session:LoopSession):string
  importPromptCheckpoint?(session:LoopSession):{importId:string;normalizedSha256:string;opening:string}|null
  ctx: LoopContext
  T: {branch: PreparationTable; decision: PreparationTable<DecisionRecord>}
  tavernTasks: TaskHost['tavernTasks']
  clusterJob: TaskHost['clusterJob']
  clusterPhase: TaskHost['clusterPhase']
  characterCluster: TaskHost['characterCluster']
  characterRoster: TaskHost['characterRoster']
  taskAgents: Map<string, HostAgent>
  isRoleplaySession(session: ContextSession | null | undefined): boolean
  activeCardWorkflow(session: LoopSession): {kind: string} | null | undefined
  ensureState(id: string): LoopState
  withDecisionMutationLock<T>(id: string, work: () => Promise<T>): Promise<T>
  normalizeDecisionRecord(value: DecisionRecord | null | undefined): DecisionRecord | null
  resumeStatusMaintenance(session: LoopSession, agent: LoopAgent): Promise<unknown>
  resumeMemoryWork(session: LoopSession, agent: LoopAgent, signal?: AbortSignal): Promise<unknown>
  resumeCardWorkflows(session: LoopSession, agent: LoopAgent, signal?: AbortSignal): Promise<unknown>
  resumeNovelExports(session: LoopSession, agent: LoopAgent, signal?: AbortSignal): Promise<unknown>
  withImportLock<T>(id: string, key: string, work: () => Promise<T>): Promise<T>
  buildPhaseA(session: LoopSession, payload: LoopPayload, state: LoopState): Promise<readonly ContextMessage[]>
  storyWindowSettings(session: LoopSession): {tail: number}
  runStatusObligation: ReturnType<typeof createRoleplayStatus>['runStatusObligation']
  publishTurnDecision(session: LoopSession, event: ContextEvent, snapshot: CompletionSnapshot, narrative: string, signal?: AbortSignal): DecisionJob
  runPhaseBC(session: LoopSession, event: ContextEvent, state: LoopState, snapshot: CompletionSnapshot, signal?: AbortSignal): Promise<unknown>
}
