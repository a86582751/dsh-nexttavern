import type { ContextSession } from './roleplay-context.js'
import type { AuthorRecord } from './roleplay-author-context-types.js'
import type { CheckLegacyWorldbookWriteTargetV1 } from './roleplay-tavern-legacy-write-target-types.js'

export interface AuthorToolArguments extends Record<string, unknown> {
  id?: string
  card_id?: string
  name?: string
  kind?: string
  content?: string
  aliases?: string[]
  keywords?: string[]
  triggers?: string[]
  priority?: number
  token_budget?: number
  max_tokens?: number
  query?: string
  always_on?: boolean
  locked?: boolean
}
export interface AuthorToolExecution {
  agent?: {session?: ContextSession}
  signal?: AbortSignal
  rootCallId?: string
  callId?: string
}
export interface AuthorToolTable {
  get(key: string): AuthorRecord | null | undefined
  entries(): Iterable<[string, AuthorRecord]>
  put(key: string, value: unknown): unknown | PromiseLike<unknown>
  delete(key: string): unknown | PromiseLike<unknown>
}
export interface AuthorToolsDependencies {
  ctx: {effect(work: () => unknown, label: string): unknown; tools: {register(tool: unknown): unknown}}
  T: {cards: AuthorToolTable; worldbook: AuthorToolTable; branch: Pick<AuthorToolTable, 'put'>}
  simpleTool(name: string, description: string, parameters: unknown, execute: (args: AuthorToolArguments, execution: AuthorToolExecution) => Promise<unknown>): unknown
  sessionOf(execution: AuthorToolExecution): Promise<ContextSession>
  /** Core supplies the existing Source lock and rechecks this captured Session inside it. */
  mutateSource?<Result>(session: ContextSession, work: () => Promise<Result>,signal?:AbortSignal): Promise<Result>
  checkLegacyWorldbookWriteTarget?:CheckLegacyWorldbookWriteTargetV1
  storyBranchIsActive(session: ContextSession): boolean
  captureSourceRead?(session:ContextSession):{
    tables:{worldbook:Pick<AuthorToolTable,'get'|'entries'>}
    entries:readonly Record<string,unknown>[]
    sourceProjectionSha256:string
    assertCurrent():void
  }|null
}
