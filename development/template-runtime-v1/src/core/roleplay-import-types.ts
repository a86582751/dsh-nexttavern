import type { ContextSession } from './roleplay-context.js'
import type {ChatCardSelector, ChatCardSourceResult} from './roleplay-chat-card-source.js'
import type { TavernCapabilityReport, TavernExtensionInventory, TavernExtensionInventoryV3,
  TavernFieldCoverage } from './tavern-card.js'
import type { CardAssignment } from './tavern-card.js'
import type {NativeCardOpeningExportReadV1} from './roleplay-card-export-opening.js'

export interface SourceSpan { startLine: number; endLine: number }
export interface ImportAssignment extends SourceSpanMetadata {
  target: string
  id?: string
  name?: string
  kind?: string
  sourceSpans: SourceSpan[]
  sourceSha256?: string
  secondary?: boolean
  locked?: boolean
  merge_group?: string
  reuse_reason?: string
  aliases?: string[]
  keywords?: string[]
  triggers?: string[]
  priority?: number
  token_budget?: number
  always_on?: boolean
  order?: number
  stagedAt?: number
}
interface SourceSpanMetadata { [key: string]: unknown }
export interface SourceDescriptor extends Record<string, unknown> {
  importId: string
  sourceSpans: SourceSpan[]
  sourceSha256?: string
  normalizedSourceSha256: string
}
export interface MaterialRecord extends Record<string, unknown> {
  id?: string
  name?: string
  kind?: string
  content?: string
  aliases?: unknown[]
  keywords?: unknown[]
  triggers?: unknown[]
  locked?: boolean
  verified?: boolean
  version?: number
  priority?: number
  tokenBudget?: number
  alwaysOn?: boolean
  sources?: SourceDescriptor[]
}
export interface TextRecord extends Record<string, unknown> {
  text?: string
  templateHtml?: string
  verified?: boolean
  sources?: SourceDescriptor[]
}
export interface RulesRecord extends Record<string, unknown> {
  verified?: boolean
  beauty?: { css?: string; js?: string; regexRules?: unknown[]; sources?: unknown[] }
  sources?: Record<string, SourceDescriptor[]>
}
export interface ImportPointer {
  importId: string
  /** Actual activation transaction stamp, retained in source hashes. */
  activatedAt?: number
  sourceRecordSessionId?: string
  normalizedSha256?: string
  transactionId?: string
  coverageSha256?: string
}
export interface ImportRecord extends Record<string, unknown> {
  schemaVersion: number
  importId: string
  workflowId?: string
  workflowGeneration?: string
  sessionId: string
  sourceFile: string
  workspaceRoot: string
  sourceBytes: number
  sourceMtimeMs: number
  normalizer: string
  sourceEnvelope?: { schemaVersion: number; extension: string; format: string; base64: string; sourceSha256: string; warnings?: string[] }
  fieldProof?: TavernFieldCoverage
  extensionInventory?: TavernExtensionInventory
  extensionDeclarations?: TavernExtensionInventoryV3
  capabilityReport?: TavernCapabilityReport
  assignmentProof?: { schemaVersion: 1; kind: 'deterministic-suggested';
    sourceSha256: string; normalizedSha256: string; suggestedSha256: string; stagedSha256: string }
  mode?: string
  rawSource: string
  normalizedSource: string
  rawSha256: string
  normalizedSha256: string
  rawChars: number
  normalizedChars: number
  lineCount: number
  lines: string[]
  lineStarts: number[]
  assignments: ImportAssignment[]
  readRanges?: (SourceSpan & { sourceSha256: string; readAt?: number })[]
  nextReadCursor: number | null
  reviewComplete: boolean
  status: string
  resourceTitle?: string
  createdAt: number
  activatedAt?: number
  transaction?: ImportTransaction
  activation?: { transactionId: string; writeDigests: { tableName: string; key: string; sha256: string }[]; summary?: Record<string, unknown> }
}
export interface ImportTransaction {
  transactionId: string
  preparedAt: number
  activePointerPrevExists: boolean
  activePointerPrev?: unknown
  writes: { tableName: string; key: string; prevExists: boolean; prev?: unknown; nextSha256: string }[]
}
export interface ImportTable<T = unknown> {
  get(key: string): T | undefined
  entries(exactPrefix?:string): Iterable<[string, T]>
  put(key: string, value: unknown): unknown | PromiseLike<unknown>
  delete(key: string): unknown | PromiseLike<unknown>
}
export interface ImportSession extends ContextSession {
  header: { cwd: string; origin?: string; seedLength?: unknown }
}
export interface ImportExec {
  callId?: string
  agent?: { session?: ImportSession; options?: { subagentDepth?: number } }
  signal?: AbortSignal
}
export interface ImportArguments extends Record<string, unknown> {
  assignments?: (ImportAssignment | CardAssignment)[]
}
export interface ImportWrite {
  tableName: string
  table: ImportTable
  key: string
  prev?: unknown
  next?: unknown
}
export interface MaterialPiece extends ImportAssignment { content: string; source: SourceDescriptor }
export interface CardWorkflow {
  id: string
  kind: string
  generation: string
  execution: string
  status: string
  source: { sourceFile: string | null; sha256?: string }
  clientRequestId?: string
  toolCallIds?: string[]
}
export interface WorkspaceImportSourceProof {
  sourceFile: string
  sourceBytes: number
  sourceMtimeMs: number
  extension: string
  rawSha256: string
}
export interface ImportInputTransition {
  begin(session: ImportSession, exec: ImportExec, args: ImportArguments): {
    reserve(source: ChatCardSourceResult): Promise<void>
    reserveWorkspace?(source: WorkspaceImportSourceProof): Promise<string>
  } | undefined
  bindJob(session: ImportSession, exec: ImportExec, job: CardWorkflow): Promise<void>
  bindLegacyRecord?(session: ImportSession, exec: ImportExec, record: ImportRecord): Promise<void>
  prepareActivation(session: ImportSession, record: ImportRecord, transaction: ImportTransaction): Promise<void>
  checkActivation?(session: ImportSession, record: ImportRecord): void
  sourceRejected?(session: ImportSession, exec: ImportExec, code?: string): Promise<void>
  commitActivation(session: ImportSession, record: ImportRecord, pointer: ImportPointer,
    transaction?: ImportTransaction): Promise<{kind: 'acknowledged'} | {kind: 'unknown'; code: string}>
}
export interface ImportResource { id?: string; resourceId?: string; name?: string }
export interface CardImportDependencies {
  inputTransition?: ImportInputTransition
  /** Read-only Native prose and provenance; never a story execution grant. */
  readNativeOpeningExport?(session:ImportSession):NativeCardOpeningExportReadV1
  /** Core resolves only actual own visible native files; the model supplies no ref/path proof. */
  resolveChatCardSource?(session: ImportSession, exec: ImportExec, selector: ChatCardSelector): Promise<ChatCardSourceResult>
  beforeWrite?(exec:ImportExec):Promise<void>
  ctx: { effect(work: () => unknown, label?: string): unknown; tools: { register(tool: unknown): unknown } }
  T: { branch: ImportTable; cards: ImportTable<MaterialRecord>; worldbook: ImportTable<MaterialRecord>; rules: ImportTable<RulesRecord>; status: ImportTable<TextRecord>; opening: ImportTable<TextRecord> }
  CARD_CLASSIFICATION_GUIDE: string
  RULE_TEXT_FIELDS: string[]
  RULE_IMPORT_FIELDS: Record<string, string>
  activeCardWorkflow(session: ImportSession): CardWorkflow | undefined
  assertCardWorkflow(session: ImportSession, record: unknown): void
  beginCardWorkflow(session: ImportSession, kind: string, sourceFile: string | null,
    agent?: ImportExec['agent'], clientRequestId?: string, toolCallId?: string): Promise<CardWorkflow>
  resumeCardWorkflows(session: ImportSession, agent?: ImportExec['agent'], signal?: AbortSignal): Promise<unknown>
  cardWorkflowKey(id: string): string
  libraryFor(session: ImportSession): { archive(input: { name: string; type: string; bytes: Buffer; source: Record<string, unknown> }): Promise<ImportResource> }
  resourceName(name: unknown): string
  completeCardWorkflow(session: ImportSession, record: unknown, result: Record<string, unknown>): Promise<unknown>
  ensureBranch(session: ImportSession): Promise<unknown>
  ensureState(id: string): { importPending: Map<string, Promise<unknown>> }
  simpleTool(name: string, description: string, parameters: unknown, execute: (args: ImportArguments, exec: ImportExec) => unknown): unknown
  sessionOf(exec: ImportExec): Promise<ImportSession>
  archiveImported(session: ImportSession, record: ImportRecord): Promise<ImportResource | null>
}
