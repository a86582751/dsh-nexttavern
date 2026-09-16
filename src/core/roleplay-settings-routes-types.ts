import type { HostSession, HostAgent } from './roleplay-task-host-types.js'
import type { createRoleplayTaskHost } from './roleplay-task-host.js'
import type { createRoleplayPreparation } from './roleplay-preparation.js'

export interface ReasoningInfo {
  efforts?: {id: string; name?: string; description?: string}[]
  defaultEffort?: string
}
export interface SettingsRouteBody<Revision = number | null> {
  sessionId?: string
  scope: string
  settings?: Record<string, unknown> & {routes?: Record<string, {provider: string; model: string; reasoningEffort?: unknown} | null>}
  expectedRevision?: Revision
  [key: string]: unknown
}
type TaskHost = ReturnType<typeof createRoleplayTaskHost>
export interface SettingsRoutesDependencies {
  ctx: {
    effect(work: () => unknown, label: string): unknown
    connection: {fetch: {register(route: {path: string; methods: string[]; fetch(request: Request): Promise<Response>}): unknown}}
    llm: {
      resolveModelInfo?(provider: string, model: string): PromiseLike<{reasoning?: ReasoningInfo}>
      listProviders?(): {id: string}[]
      listModels(provider: string): PromiseLike<{id: string; name?: string}[]>
    }
    get(name: 'tavernConversations'): {ready?: PromiseLike<unknown>} | null | undefined
    agentDefaultModel: {currentSelection(): unknown}
  }
  T: {branch: {put(key: string, value: unknown): unknown | PromiseLike<unknown>}}
  resolveRoleplaySession(id: string | null | undefined): Promise<HostSession | null | undefined>
  modelPolicy: TaskHost['modelPolicy']
  ensureBranch(session: HostSession): Promise<unknown>
  taskAgents: Map<string, HostAgent>
  characterCluster: TaskHost['characterCluster']
  characterRoster: TaskHost['characterRoster']
  memorySettingFields: readonly string[]
  memorySettingsPolicy: ReturnType<typeof createRoleplayPreparation>['memorySettingsPolicy']
  svc: {setSettings(id: string, patch: Record<string, number | null>): Promise<unknown>}
  narrativePresets: ReturnType<typeof import('./narrative-presets.js').createNarrativePresets>
}
