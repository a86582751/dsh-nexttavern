import type { StateSession } from './roleplay-state-types.js'
import type { createRoleplayState } from './roleplay-state.js'
import type { createRoleplayStatus } from './roleplay-status.js'
import type { createRoleplayService } from './roleplay-service.js'
import type { registerRoleplayImports } from './roleplay-import.js'
import type { HostAgent, HostSession } from './roleplay-task-host-types.js'
import type { createRoleplayTaskHost } from './roleplay-task-host.js'

export interface PanelRouteBody extends Record<string, unknown> {
  sessionId?: string
  kind: string
  card_id?: string
  id?: string
  beauty?: {regexRules?: unknown; css?: unknown; js?: unknown}
}
export interface PanelRecord extends Record<string, unknown> {
  importId?: string
  sourceRecordSessionId?: string
  sourceSessionId?: string
}
interface PanelTable {
  get(key: string): PanelRecord | null | undefined
  put(key: string, value: object): PromiseLike<unknown>
  delete(key: string): PromiseLike<unknown>
  entries(): Iterable<[string, PanelRecord]>
}
type State = ReturnType<typeof createRoleplayState>
type Status = ReturnType<typeof createRoleplayStatus>
type Imports = ReturnType<typeof registerRoleplayImports>
export interface PanelRoutesDependencies {
  ctx: {
    effect(work: () => unknown, label: string): unknown
    connection: {fetch: {register(route: {path: string; methods: string[]; fetch(request: Request): Promise<Response>}): unknown}}
    get(name: 'compaction'): {saveDirectorNotes?(session: StateSession, summary: unknown): PromiseLike<unknown>} | null | undefined
  }
  T: Record<'branch' | 'cards' | 'worldbook' | 'decision' | 'rules' | 'status', PanelTable>
  resolveRoleplaySession(id: string | null | undefined): Promise<StateSession | null | undefined>
  ensureBranch(session: StateSession): Promise<unknown>
  awaitImportBarrier: Imports['awaitImportBarrier']
  withImportLock: Imports['withImportLock']
  importRecordKey: Imports['importRecordKey']
  assertImportRecordIntegrity: Imports['assertImportRecordIntegrity']
  withDecisionMutationLock<R>(id: string, work: () => Promise<R>): Promise<R>
  normalizeDecisionRecord: Status['normalizeDecisionRecord']
  recordVersionsFor: State['recordVersionsFor']
  readRoleplayState: State['readRoleplayState']
  svc: Pick<ReturnType<typeof createRoleplayService>, 'memoryUpdate' | 'setSettings' | 'setStatusSpec' | 'setRules' | 'setOpening'>
  RULE_TEXT_FIELDS: readonly string[]
}

export interface SettingArguments extends Record<string, unknown> {
  action: 'list'|'read'|'patch'|'append'|'create'|'repair'|'jobs'|'retry'
  target?: 'core'|'plot'|'narrative'|'reply'|'style'|'character'|'worldbook'|'status'
  id?: string
  expected_branch_id?: string
  expected_revision?: string
  offset?: number
  max_chars?: number
  cursor?: number
  changes?: {find:string;replace:string}[]
  text?: string
  name?: string
  kind?: string
  keywords?: string[]
  reason?: string
  instruction?: string
  basis?: 'player'|'source'
  source_id?: string
  job_id?: string
}
export interface SettingToolDependencies extends Pick<PanelRoutesDependencies,'T'|'recordVersionsFor'|'svc'|'RULE_TEXT_FIELDS'|'withImportLock'> {
  ctx: PanelRoutesDependencies['ctx'] & {
    tools: {register(tool: unknown): unknown}
    on(name:'agent/pre-step',handler:(payload:{agent?:HostAgent},next:()=>Promise<unknown>)=>Promise<unknown>): unknown
    systemPrompt: {section(spec:{name:string;order:number;text(context:{agent?:HostAgent}):string}):unknown}
    logger?: {warn?(text:string):void}
  }
  sessionOf(execution:{agent?:HostAgent}):Promise<HostSession>
  resolveRoleplaySession(id:string):Promise<HostSession|null|undefined>
  storyBranchIsActive(session:HostSession):boolean
  selectionStamp(session:HostSession):string|null
  tavernTasks:ReturnType<typeof createRoleplayTaskHost>['tavernTasks']
  modelPolicy:ReturnType<typeof createRoleplayTaskHost>['modelPolicy']
  evidence(session:HostSession,name:string,args:Record<string,unknown>):Promise<unknown>
}
