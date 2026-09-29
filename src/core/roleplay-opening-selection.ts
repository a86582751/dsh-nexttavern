import {createHash} from 'node:crypto'
import {compileTavernOpeningCandidates, decodeTavernCard} from './tavern-card.js'
import type {TavernOpeningCandidate, TavernOpeningContext} from './tavern-card.js'
import type {ImportPointer, ImportRecord} from './roleplay-import-types.js'

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const validHash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const samePointer = (a: ImportPointer, b: ImportPointer) => a.importId === b.importId
  && a.sourceRecordSessionId === b.sourceRecordSessionId && a.normalizedSha256 === b.normalizedSha256
  && a.transactionId === b.transactionId && a.coverageSha256 === b.coverageSha256

export interface OpeningSource {
  readonly sessionId: string
  readonly importId: string
  readonly sourceRecordSessionId: string
  readonly rawSha256: string
  readonly normalizedSha256: string
  readonly transactionId: string
  readonly coverageSha256: string
  readonly pointer: ImportPointer
}
export interface OpeningCatalog { readonly source: OpeningSource; readonly candidates: readonly TavernOpeningCandidate[] }
export type OpeningRejectionCode = 'PROGRAMMATIC_IDENTITY_CONFLICT' | 'PROGRAMMATIC_OPEN_TURN'
  | 'PROGRAMMATIC_MISSING_SYSTEM_HEAD'
const isRejectionCode = (value: unknown): value is OpeningRejectionCode =>
  value === 'PROGRAMMATIC_IDENTITY_CONFLICT' || value === 'PROGRAMMATIC_OPEN_TURN'
  || value === 'PROGRAMMATIC_MISSING_SYSTEM_HEAD'
export interface OpeningIntent {
  readonly schemaVersion: 2
  readonly sessionId: string
  readonly source: OpeningSource
  readonly index: number
  readonly sourcePointer: string
  readonly sourceSha256: string
  readonly renderedSha256: string
  readonly renderedText: string
  readonly messageId: string
  readonly operationId: string
  readonly revision: number
  readonly status: 'pending' | 'busy' | 'unknown' | 'completed'
  readonly committedTurn?: number
  /** Optional in schema v2: the last no-write refusal, never a durability or retry proof. */
  readonly rejectionCode?: OpeningRejectionCode
}
export interface OpeningTable {
  get(key: string): unknown
  put(key: string, value: OpeningIntent): Promise<unknown>
}
export interface OpeningAppendResult {
  readonly kind: 'committed' | 'busy' | 'unknown'
  /** committed means the native Agent acknowledged a durable flush. */
  readonly turn?: number
  readonly messageId?: string
  readonly code?: OpeningRejectionCode
}
export interface OpeningLookupResult {
  /** absent requires a durable log/flush check; unknown must not start another append. */
  readonly status: 'committed' | 'absent' | 'unknown'
  readonly turn?: number
}
export interface OpeningSelectionDeps {
  readonly table: OpeningTable
  readonly importActiveKey: (sessionId: string) => string
  readonly importRecordKey: (sessionId: string, importId: string) => string
  readonly withLock: <T>(key: string, action: () => Promise<T>) => Promise<T>
  readonly appendOpening: (request: {sessionId: string; operationId: string; messageId: string;
    source: OpeningSource; text: string}) => Promise<OpeningAppendResult>
  /** Only an exact operationId and durable log/flush proof may return committed. */
  /** The adapter must verify the exact messageId, source, text, turn end and durable flush. */
  readonly findOpeningByOperationId: (intent: OpeningIntent) => Promise<OpeningLookupResult>
}

export function openingIntentKey(sessionId: string, importId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId) || !/^[a-zA-Z0-9_-]{1,64}$/.test(importId))
    throw new Error('无效的 session/import id')
  return `${sessionId}__opening-choice-${importId}`
}

export function createRoleplayOpeningSelection(deps: OpeningSelectionDeps) {
  const readCatalog = (sessionId: string, context: TavernOpeningContext = {}): OpeningCatalog => {
    const pointer = deps.table.get(deps.importActiveKey(sessionId)) as ImportPointer | undefined
    if (!pointer?.importId || !validHash(pointer.normalizedSha256) || !validHash(pointer.coverageSha256)
      || !pointer.transactionId) throw new Error('没有完整的 active import pointer')
    const sourceRecordSessionId = pointer.sourceRecordSessionId ?? sessionId
    const record = deps.table.get(deps.importRecordKey(sourceRecordSessionId, pointer.importId)) as ImportRecord | undefined
    if (!record || record.status !== 'active' || record.importId !== pointer.importId
      || record.normalizedSha256 !== pointer.normalizedSha256 || !record.activation
      || record.activation.transactionId !== pointer.transactionId || !validHash(record.rawSha256)
      || !record.sourceEnvelope || record.sourceEnvelope.sourceSha256 !== record.rawSha256)
      throw new Error('active import record 与 pointer 不匹配')
    const envelope = record.sourceEnvelope
    const bytes = Buffer.from(envelope.base64, 'base64')
    if (bytes.toString('base64') !== envelope.base64 || hash(bytes) !== record.rawSha256)
      throw new Error('sourceEnvelope 原件校验失败')
    const decoded = decodeTavernCard(bytes, envelope.extension)
    const source: OpeningSource = {sessionId, importId:pointer.importId, sourceRecordSessionId,
      rawSha256:record.rawSha256, normalizedSha256:record.normalizedSha256,
      transactionId:pointer.transactionId, coverageSha256:pointer.coverageSha256, pointer:{...pointer}}
    return {source, candidates:compileTavernOpeningCandidates(decoded, context)}
  }
  const current = (source: OpeningSource) => {
    const pointer = deps.table.get(deps.importActiveKey(source.sessionId)) as ImportPointer | undefined
    if (!pointer || !samePointer(pointer, source.pointer)) return false
    const record = deps.table.get(deps.importRecordKey(source.sourceRecordSessionId, source.importId)) as ImportRecord | undefined
    return !!record && record.status === 'active' && record.rawSha256 === source.rawSha256
      && record.normalizedSha256 === source.normalizedSha256
      && record.activation?.transactionId === source.transactionId
  }
  const readIntent = (source: OpeningSource): OpeningIntent | null => {
    const intent = deps.table.get(openingIntentKey(source.sessionId, source.importId)) as OpeningIntent | undefined
    if (!intent || !current(source) || intent.schemaVersion !== 2 || intent.sessionId !== source.sessionId
      || intent.source.importId !== source.importId || !samePointer(intent.source.pointer, source.pointer)
      || intent.source.rawSha256 !== source.rawSha256) return null
    return intent
  }
  const complete = async (key: string, intent: OpeningIntent, turn: number): Promise<OpeningIntent> => {
    if (!Number.isSafeInteger(turn) || turn < 0) throw new Error('原生开场缺少 durable turn')
    const {rejectionCode: _previousRejection, ...retained} = intent
    const next: OpeningIntent = {...retained, status:'completed', revision:intent.revision + 1, committedTurn:turn}
    await deps.table.put(key, next)
    return next
  }
  const append = async (key: string, intent: OpeningIntent): Promise<OpeningIntent | {status:'busy'; intent:OpeningIntent}> => {
    let result: OpeningAppendResult
    try { result = await deps.appendOpening({sessionId:intent.sessionId, operationId:intent.operationId,
      messageId:intent.messageId, source:intent.source, text:intent.renderedText}) }
    catch { result = {kind:'unknown'} }
    if (result.kind === 'committed') {
      if (result.messageId !== intent.messageId) throw new Error('原生开场 messageId 回执不匹配')
      return complete(key, intent, result.turn!)
    }
    // A newer busy/uncertain receipt supersedes the previous refusal. Only the
    // three native no-write codes may persist; arbitrary adapter text may not.
    const {rejectionCode: _previousRejection, ...retained} = intent
    const next: OpeningIntent = {...retained, status:result.kind, revision:intent.revision + 1,
      ...(result.kind === 'unknown' && isRejectionCode(result.code) ? {rejectionCode:result.code} : {})}
    await deps.table.put(key, next)
    return {status:'busy', intent:next}
  }
  const select = (sessionId: string, index: number, operationId: string,
    context: TavernOpeningContext = {}): Promise<OpeningIntent | {status:'busy'; intent: OpeningIntent}> =>
    deps.withLock(`opening-choice:${sessionId}`, async () => {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(operationId)) throw new Error('无效的 operationId')
      const catalog = readCatalog(sessionId, context)
      if (!current(catalog.source)) throw new Error('active import pointer 已失效')
      const candidate = catalog.candidates.find(item => item.index === index)
      if (!candidate) throw new Error('开场候选不存在')
      const key = openingIntentKey(sessionId, catalog.source.importId)
      const previous = deps.table.get(key) as OpeningIntent | undefined
      if (previous) {
        if (previous.schemaVersion !== 2 || previous.sessionId !== sessionId
          || !validHash(previous.renderedSha256) || hash(previous.renderedText) !== previous.renderedSha256
          || !previous.messageId) throw new Error('未知或损坏的开场选择 schema')
        if (previous.operationId !== operationId || previous.index !== index
          || previous.sourceSha256 !== candidate.sourceSha256
          || !samePointer(previous.source.pointer, catalog.source.pointer)
          || previous.source.rawSha256 !== catalog.source.rawSha256)
          throw new Error('已存在不同的开场选择；需先完成或显式迁移')
        if (previous.status === 'completed') return previous
        // Reuse the exact operation after a durable negative log check. The native
        // writer also checks this id, so a partial turn remains a failure anchor.
        const found = await deps.findOpeningByOperationId(previous)
        if (found.status === 'committed') return complete(key, previous, found.turn!)
        if (found.status === 'absent' && current(previous.source))
          return append(key, previous)
        return {status:'busy', intent:previous}
      }
      if (Buffer.byteLength(candidate.renderedText, 'utf8') > 65_536)
        throw new Error('开场正文超过持久选择上限')
      const intent: OpeningIntent = {schemaVersion:2, sessionId, source:catalog.source, index,
        sourcePointer:candidate.sourcePointer, sourceSha256:candidate.sourceSha256,
        renderedSha256:hash(candidate.renderedText), renderedText:candidate.renderedText,
        messageId:`opening-${hash(`${sessionId}\0${catalog.source.importId}\0${operationId}`).slice(0,32)}`,
        operationId, revision:1, status:'pending'}
      await deps.table.put(key, intent)
      if (!current(catalog.source)) throw new Error('active import pointer 已失效；意图已保留')
      return append(key, intent)
    })
  const recover = (sessionId: string, importId: string): Promise<OpeningIntent | null> =>
    deps.withLock(`opening-choice:${sessionId}`, async () => {
      const key = openingIntentKey(sessionId, importId)
      const intent = deps.table.get(key) as OpeningIntent | undefined
      if (!intent) return null
      if (intent.schemaVersion !== 2 || intent.sessionId !== sessionId || intent.source.importId !== importId
        || !validHash(intent.renderedSha256) || hash(intent.renderedText) !== intent.renderedSha256
        || !intent.messageId) throw new Error('未知或损坏的开场选择 schema')
      if (!current(intent.source)) return null
      if (intent.status === 'completed') return intent
      const found = await deps.findOpeningByOperationId(intent)
      if (!current(intent.source)) return null
      // A log lookup confirms durability only. Keep the latest refusal as
      // historical diagnosis; it must not stand in for a fresh admission check.
      return found.status === 'committed' ? complete(key, intent, found.turn!) : intent
    })
  return {readCatalog, readIntent, select, recover}
}
