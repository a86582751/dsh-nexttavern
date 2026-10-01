import type { ContextEvent } from './roleplay-context.js'
import type { BranchSession, WorldlineMessageEdits } from './roleplay-worldline-types.js'
import type { LoopSession, LoopAgent, LoopState } from './roleplay-loop-types.js'
import type { InheritanceState } from './roleplay-inheritance-types.js'
import type { createTelemetry } from './tavern-telemetry.js'
import type { createRoleplayTaskHost } from './roleplay-task-host.js'
import type { AuthorTables } from './roleplay-author-context-types.js'
import type { StoryObservationServices } from './roleplay-message-view.js'

export const CORE_TYPESCRIPT = true

type ModuleDependencies = Parameters<typeof import('./roleplay-import.js').registerRoleplayImports>[0]
  | Parameters<typeof import('./card-adaptation-tools.js').registerAdaptationTools>[0]
  | Parameters<typeof import('./roleplay-worldlines.js').createRoleplayWorldlines>[0]
  | Parameters<typeof import('./roleplay-status.js').createRoleplayStatus>[0]
  | Parameters<typeof import('./roleplay-preparation.js').createRoleplayPreparation>[0]
  | Parameters<typeof import('./roleplay-completion.js').createRoleplayCompletion>[0]
  | Parameters<typeof import('./roleplay-decision.js').createRoleplayDecision>[0]
  | Parameters<typeof import('./roleplay-inheritance.js').createRoleplayInheritance>[0]
  | Parameters<typeof import('./roleplay-resource-bridge.js').createResourceBridge>[0]
  | Parameters<typeof import('./roleplay-card-workflow.js').createCardWorkflows>[0]
  | Parameters<typeof import('./roleplay-service.js').createRoleplayService>[0]
  | Parameters<typeof import('./roleplay-task-host.js').createRoleplayTaskHost>[0]
  | Parameters<typeof import('./roleplay-loop.js').registerRoleplayLoop>[0]
  | Parameters<typeof import('./roleplay-author-context.js').registerAuthorPrompts>[0]
  | Parameters<typeof import('./roleplay-author-tools.js').registerAuthorTools>[0]
  | Parameters<typeof import('./roleplay-session-actions.js').registerSessionTools>[0]
  | Parameters<typeof import('./roleplay-session-actions.js').registerSessionCommands>[0]
  | Parameters<typeof import('./roleplay-task-tools.js').registerTaskTools>[0]
  | Parameters<typeof import('./roleplay-state.js').createRoleplayState>[0]
  | Parameters<typeof import('./roleplay-diagnosis.js').registerRoleplayDiagnosis>[0]
  | Parameters<typeof import('./roleplay-authoring.js').registerCardAuthoring>[0]
  | Parameters<typeof import('./roleplay-authoring.js').registerDraftCheck>[0]
  | Parameters<typeof import('./roleplay-settings-routes.js').registerSettingsRoutes>[0]
  | Parameters<typeof import('./roleplay-telemetry-routes.js').registerTelemetryRoutes>[0]
  | Parameters<typeof import('./roleplay-job-routes.js').registerJobRoutes>[0]
  | Parameters<typeof import('./roleplay-job-routes.js').registerMaintenanceRoute>[0]
  | Parameters<typeof import('./roleplay-branch-routes.js').registerBranchRoutes>[0]
  | Parameters<typeof import('./roleplay-panel-routes.js').registerAvatarRoute>[0]
  | Parameters<typeof import('./roleplay-panel-routes.js').registerPanelRoutes>[0]
type ContextOf<D> = D extends {ctx: infer C} ? C : never
type TablesOf<D> = D extends {T: infer T} ? T : never
type Intersection<U> = (U extends unknown ? (value: U) => void : never) extends ((value: infer I) => void) ? I : never
export type CoreTables = Intersection<TablesOf<ModuleDependencies>> & AuthorTables & {
  userinfo: import('./roleplay-service-types.js').ServiceTable
}
export type CoreSession = LoopSession & BranchSession
export type CoreAgent = LoopAgent & {session: CoreSession}
export interface CoreState extends LoopState, InheritanceState {
  sessionId: string
  branchReady: boolean
  commitChain?: Promise<unknown>
  recallGeneration: number
  branches: unknown
  importPending: Map<string, Promise<unknown>>
}
type Telemetry = ReturnType<typeof createTelemetry>
type NativeTask = ReturnType<typeof createRoleplayTaskHost>['nativeTask']
export type CoreContext = {
  nexttavernMessageEdits: WorldlineMessageEdits
  userQuestions: {ask(input:{agent:NonNullable<import('./roleplay-task-tools-types.js').TaskToolExecution['agent']>;signal?:AbortSignal;questions:{id:string;question:string;header?:string;detail?:string;options?:{label:string;description:string}[]}[]}):Promise<{answers:{id:string;selected:string[];custom?:string}[]}>}
  sessions: {get(id: string): CoreSession | undefined; flush(session: BranchSession): Promise<boolean>}
  sessionController: {resolveAgent(id: string): Promise<{agent?: CoreAgent; error?: Error} | undefined>}
  storageDomain: {open(options: unknown): Promise<{table<K extends keyof CoreTables>(name: K): CoreTables[K]; close(): unknown}>}
  sessionQuery: Parameters<typeof createTelemetry>[0]['query']
  get(name: 'roleplay'): {nativeTask: NativeTask}
  provide(name: 'roleplay', service: unknown): unknown
  on(name: 'llm/stream', hook: Telemetry['observe'], options: {global: boolean}): unknown
  on(name: 'session/event', hook: (session: CoreSession, event: ContextEvent) => void, options: {global: boolean; prepend?: boolean}): unknown
  on(name: 'session/created', hook: (session: CoreSession) => void, options: {global: boolean}): unknown
  on(name: 'session/disposed', hook: (session: CoreSession) => void, options: {global: boolean}): unknown
  on(name: 'agent/created', hook: (payload: {agent: CoreAgent; signal?: AbortSignal}) => Promise<undefined>, options: {global: boolean; prepend: boolean}): unknown
} & StoryObservationServices<ContextEvent> & Intersection<ContextOf<ModuleDependencies>>
