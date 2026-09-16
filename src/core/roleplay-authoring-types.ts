import type { ContextSession } from './roleplay-context.js'
import type { AuthorRecord } from './roleplay-author-context-types.js'
import type { TaskToolExecution } from './roleplay-task-tools-types.js'

export interface AuthoredCard extends AuthorRecord {card_id?: string}
export interface AuthoredWorldbook extends AuthorRecord {token_budget?: number; always_on?: boolean}
export interface AuthoringInput {
  cards?: AuthoredCard[]
  worldbook?: AuthoredWorldbook[]
  statusSpec?: string | null
  rules?: Record<string, unknown> | null
  opening?: string | null
  beauty?: {regexRules?: unknown; css?: unknown; js?: unknown} | null
}
export interface DraftInput {source_path?: string; review?: {id: string; section: string; basis: string}[]}
export interface AuthoringSession extends ContextSession {header: NonNullable<ContextSession['header']> & {cwd: string}}
export interface AuthoringTable {
  get(key: string): AuthorRecord | null | undefined
  put(key: string, record: unknown): unknown | PromiseLike<unknown>
}
export interface AuthoringContext {
  effect(work: () => unknown, label: string): unknown
  tools: {register(tool: unknown): unknown}
}
export interface AuthoringDependencies {
  beforeWrite?(exec:TaskToolExecution):Promise<void>
  ctx: AuthoringContext
  T: {cards: AuthoringTable; worldbook: AuthoringTable; rules: AuthoringTable}
  RULE_TEXT_FIELDS: readonly string[]
  svc: {
    setStatusSpec(id: string, text: string, seq: number): Promise<unknown>
    setRules(id: string, record: Record<string, unknown>, seq: number): Promise<unknown>
    setOpening(id: string, text: string, seq: number): Promise<unknown>
  }
  sessionOf(exec: TaskToolExecution): Promise<ContextSession>
}
export interface DraftDependencies extends Pick<AuthoringDependencies, 'ctx'> {
  beforeWrite?(exec:TaskToolExecution):Promise<void>
  sessionOf(exec: TaskToolExecution): Promise<AuthoringSession>
}
export interface DraftRegex {match: string; replace: string; flags?: unknown}
