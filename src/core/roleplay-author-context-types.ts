import type { ContextSession } from './roleplay-context.js'
import type { TaskAgent } from './tavern-task-types.js'

export interface AuthorRecord extends Record<string, unknown> {
  id?: string
  name?: string
  kind?: string
  content?: string
  enabled?: boolean
  aliases?: string[]
  keywords?: string[]
  triggers?: string[]
  locked?: boolean
  alwaysOn?: boolean
  priority?: unknown
  tokenBudget?: unknown
  version?: unknown
  tavern?: {useRegex?: boolean; caseSensitive?: boolean; secondaryKeys?: string[]; selective?: boolean}
}
export interface AuthorTable<R = AuthorRecord> {
  get(key: string): R | null | undefined
  entries(): Iterable<[string, R]>
}
export interface AuthorTables {
  cards: AuthorTable
  worldbook: AuthorTable
  rules: AuthorTable
}
export interface AuthorMemory extends Record<string, unknown> {
  lockedFacts?: readonly (string | {text?: unknown} | null)[]
  summary?: unknown
}
export interface AuthorScene extends Record<string, unknown> {place?: unknown; present?: unknown[]}
export interface AuthorDependency {table: keyof AuthorTables; key: string; fields?: string[]; hash: string}
export interface DecisionContextInput {
  narrative: string
  userText?: string
  scene?: AuthorScene | null
  directorNotes?: unknown
  memory?: AuthorMemory | null
  budgetTokens?: number
}
export interface AuthorPromptDependencies {
  T: AuthorTables & {status: AuthorTable}
  ctx: {
    effect(work: () => unknown, label: string): unknown
    systemPrompt: {
      variable(name: string, read: (context: {agent?: TaskAgent & {session?: ContextSession}}) => string): unknown
      section(spec: {name: string; order: number; text(context: {agent?: TaskAgent & {session?: ContextSession}}): string}): unknown
    }
  }
  isRoleplaySession(session: ContextSession | null | undefined): boolean
  userValues(id?: string): {name: string; gender: string}
  characterCluster: {read(session: ContextSession): {enabled: boolean}}
  characterRoster(session: ContextSession): {id?: unknown; name?: unknown}[]
  CARD_CLASSIFICATION_GUIDE: string
  narrativePresets: ReturnType<typeof import('./narrative-presets.js').createNarrativePresets>
}
