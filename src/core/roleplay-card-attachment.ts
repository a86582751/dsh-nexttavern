import {createHash} from 'node:crypto'
import {realpathSync} from 'node:fs'
import {extname, isAbsolute, join, relative, sep} from 'node:path'
import type {ContextSession} from './roleplay-context.js'
import type {CardWorkflowSession} from './roleplay-card-workflow-types.js'
import type {createTavernLibrary, LibraryTable} from './tavern-library.js'
import {libraryStableId, safeLibraryName} from './tavern-library-input.js'
import {CARD_LIMITS} from './tavern-card.js'
import {sha256} from './roleplay-data.js'

export interface CardAttachmentSelector {receiptId: string}
export interface NativeFileRef {attachmentId: string; name: string; bytes: number}
export interface CardAttachmentAgent {
  session: ContextSession
  ctx: object
}
export interface CardAttachmentServices {
  fileUploads: {resolve(agent: CardAttachmentAgent, receiptId: string): NativeFileRef | undefined}
  attachments: {readFileStream(ref: NativeFileRef, signal?: AbortSignal): AsyncIterable<Uint8Array>}
}
interface Admission {
  schemaVersion: 1
  sessionId: string
  requestId: string
  workspaceRoot: string
  workspaceHash: string
  receiptId: string
  file: NativeFileRef
  authorizationSha256: string
  state: 'admitted' | 'archived'
  resourceId?: string
}
interface Dependencies extends CardAttachmentServices {
  T: {branch: LibraryTable}
  libraryFor(session: CardWorkflowSession): Pick<ReturnType<typeof createTavernLibrary>, 'archive' | 'metadata'>
}
const PREFIX = 'tavern_card_attachment__'
const TYPES: Readonly<Record<string, string>> = Object.freeze({
  '.png': 'image/png', '.json': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain',
})
// Factories sharing a Host table also share admission serialization. Separate
// processes must retain the Host's single-writer contract; this is not a lease.
const locks = new WeakMap<object, Map<string, Promise<unknown>>>()

function fail(message: string): never {throw new Error(`角色卡附件：${message}`)}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('记录或参数无效')
  return value as Record<string, unknown>
}
function identifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail(`${field} 无效`)
  return value
}
function selectorOf(value: unknown): CardAttachmentSelector {
  const source = object(value)
  if (Object.keys(source).length !== 1 || !Object.hasOwn(source, 'receiptId')) fail('selector 仅接受 receiptId')
  return {receiptId: identifier(source.receiptId, 'receiptId')}
}
function fileOf(value: unknown): NativeFileRef {
  const source = object(value)
  if (Object.keys(source).length !== 3 || !['attachmentId', 'name', 'bytes'].every(key => Object.hasOwn(source, key))) {
    fail('原生文件引用字段无效')
  }
  const {attachmentId, name, bytes} = source
  if (typeof attachmentId !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(attachmentId)) fail('原件 SHA-256 无效')
  if (typeof name !== 'string' || !name || name.trim() !== name || /[\x00-\x1f\x7f<>:"/\\|?*]/.test(name)
    || /[. ]$/.test(name) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)
    || Buffer.byteLength(name, 'utf8') > 255 || !TYPES[extname(name).toLowerCase()]) {
    fail('原件名称或扩展名无效')
  }
  if (!Number.isSafeInteger(bytes) || Number(bytes) < 1 || Number(bytes) > CARD_LIMITS.bytes) fail('原件大小超出限制')
  return Object.freeze({attachmentId, name, bytes: Number(bytes)})
}
function agentOf(value: unknown, session: CardWorkflowSession): CardAttachmentAgent {
  const agent = object(value)
  const owned = object(agent.session)
  if (owned.id !== session.id || (owned.header && object(owned.header).origin === 'subagent')) {
    fail('附件 Agent 与会话不一致')
  }
  object(agent.ctx)
  // Preserve the actual Agent object: FileUploads checks scopeOf(agent.ctx).
  return value as CardAttachmentAgent
}
function authorizationOf(row: Omit<Admission, 'authorizationSha256' | 'state' | 'resourceId'>): string {
  return sha256(JSON.stringify([row.schemaVersion, row.sessionId, row.requestId, row.workspaceRoot,
    row.workspaceHash, row.receiptId, row.file.attachmentId, row.file.name, row.file.bytes]))
}
function sourceOf(row: Admission): Record<string, string> {
  return {sessionId: row.sessionId, kind: 'native-attachment-import', requestId: row.requestId,
    receiptId: row.receiptId, attachmentId: row.file.attachmentId}
}
function archiveName(file: NativeFileRef): string {
  const extension = extname(file.name).toLowerCase()
  const stem = file.name.slice(0, -extension.length).normalize('NFC').slice(0, 150).trim().replace(/[. ]+$/, '')
  return safeLibraryName(`${stem || '角色卡'}${extension}`)
}
function admissionOf(value: unknown, expected: {
  sessionId: string; requestId: string; workspaceRoot: string; workspaceHash: string; receiptId: string
}): Admission {
  const record = object(value)
  const fields = ['schemaVersion', 'sessionId', 'requestId', 'workspaceRoot', 'workspaceHash',
    'receiptId', 'file', 'authorizationSha256', 'state', 'resourceId']
  if (Object.keys(record).some(key => !fields.includes(key)) || record.schemaVersion !== 1
    || !['admitted', 'archived'].includes(String(record.state))) fail('准入记录版本或状态损坏')
  for (const [field, value] of Object.entries(expected)) {
    if (record[field] !== value) fail('requestId 已绑定不同会话、工作区或 receipt')
  }
  const file = fileOf(record.file)
  const row = {...record, file} as unknown as Admission
  if (typeof row.authorizationSha256 !== 'string' || row.authorizationSha256 !== authorizationOf(row)) {
    fail('不可变附件授权记录损坏')
  }
  const resourceId = libraryStableId(row.workspaceHash, file.attachmentId.slice(7))
  if (row.state === 'archived' ? row.resourceId !== resourceId : Object.hasOwn(row, 'resourceId')) {
    fail('归档资源身份损坏')
  }
  return row
}
async function serialized<Result>(table: object, key: string, work: () => Promise<Result>): Promise<Result> {
  let running = locks.get(table)
  if (!running) {running = new Map(); locks.set(table, running)}
  const prior = running.get(key) ?? Promise.resolve()
  const next = prior.catch(() => {}).then(work)
  running.set(key, next)
  try {return await next} finally {if (running.get(key) === next) running.delete(key)}
}

/** Authorize native bytes once, archive them, and leave activation to the existing workflow. */
export function createCardAttachmentSources({T, libraryFor, fileUploads, attachments}: Dependencies) {
  async function materialize(session: CardWorkflowSession, actualAgent: unknown,
    selector: unknown, requestedId: unknown): Promise<{sourceFile: string; resourceId: string}> {
    const {receiptId} = selectorOf(selector)
    const requestId = identifier(requestedId, 'requestId')
    if (typeof session.id !== 'string' || !session.id || session.id.length > 1024 || /[\x00-\x1f\x7f]/.test(session.id)) {
      fail('会话身份无效')
    }
    const agent = agentOf(actualAgent, session)
    // The owning plugin declares these services in inject, so Cordis owns their
    // lifecycle. Only attachment requests need these capabilities; AgentLoop
    // ctx is used solely by the provider to verify the actual Agent's scope.
    if (typeof object(fileUploads).resolve !== 'function' || typeof object(attachments).readFileStream !== 'function') {
      fail('当前插件缺少原生文件服务')
    }
    const workspaceRoot = realpathSync(session.header.cwd)
    const workspaceHash = sha256(workspaceRoot)
    const expected = {sessionId: session.id, requestId, workspaceRoot, workspaceHash, receiptId}
    // The key deliberately excludes cwd: a changed workspace must conflict with
    // the existing authorization instead of silently creating another source.
    const key = `${PREFIX}${sha256(JSON.stringify([session.id, requestId]))}`
    return serialized(T.branch, key, async () => {
      const assertContext = () => {
        const ownedCwd = agent.session.header?.cwd
        if (agent.session.id !== expected.sessionId || session.id !== expected.sessionId
          || realpathSync(session.header.cwd) !== workspaceRoot || typeof ownedCwd !== 'string'
          || realpathSync(ownedCwd) !== workspaceRoot) fail('读取期间会话或工作区已变化')
      }
      assertContext()
      let row: Admission
      const previous = T.branch.get(key)
      if (previous !== undefined && previous !== null) row = admissionOf(previous, expected)
      else {
        const resolved = fileUploads.resolve(agent, receiptId)
        if (resolved === undefined) fail('文件未上传到当前会话或 receipt 已失效')
        const file = fileOf(resolved)
        const identity = {schemaVersion: 1 as const, ...expected, file}
        row = {...identity, authorizationSha256: authorizationOf(identity), state: 'admitted'}
        // Persist exact server-authorized ref before the volatile receipt can die.
        // No archive or activation is allowed if this write fails.
        await T.branch.put(key, structuredClone(row))
        assertContext()
      }
      const library = libraryFor(session)
      const verifiedResult = (resourceId: string) => {
        assertContext()
        const metadata = library.metadata(resourceId)
        const extension = extname(row.file.name).toLowerCase()
        const pathPart = relative(join(workspaceRoot, 'tavern-library', 'objects'), metadata.path)
        const source = sourceOf(row)
        const sources = metadata.sources ?? [metadata.source]
        if (metadata.id !== libraryStableId(workspaceHash, row.file.attachmentId.slice(7))
          || metadata.workspaceHash !== workspaceHash || metadata.fullSha256 !== row.file.attachmentId.slice(7)
          || metadata.bytes !== row.file.bytes || metadata.type !== TYPES[extension]
          || extname(metadata.path).toLowerCase() !== extension || isAbsolute(pathPart)
          || pathPart === '..' || pathPart.startsWith(`..${sep}`)
          || !sources.some(item => Object.entries(source).every(([key, value]) => item[key] === value))) {
          fail('资源库原件或来源身份不匹配')
        }
        return {sourceFile: metadata.path, resourceId}
      }
      if (row.state === 'archived') return verifiedResult(row.resourceId!)
      const chunks: Buffer[] = []
      const digest = createHash('sha256')
      let count = 0
      // Native provider verifies only after its final yield. A thrown EOF check
      // must reject this entire source, even when every byte was already seen.
      for await (const chunk of attachments.readFileStream(row.file)) {
        if (!(chunk instanceof Uint8Array)) fail('原件读取流不是字节')
        count += chunk.byteLength
        if (count > CARD_LIMITS.bytes || count > row.file.bytes) fail('原件读取大小超出限制或授权值')
        const copy = Buffer.from(chunk)
        chunks.push(copy)
        digest.update(copy)
      }
      assertContext()
      if (count !== row.file.bytes || digest.digest('hex') !== row.file.attachmentId.slice(7)) {
        fail('原件完整 SHA-256 或大小不匹配')
      }
      const reread = admissionOf(T.branch.get(key), expected)
      if (reread.authorizationSha256 !== row.authorizationSha256 || reread.state !== 'admitted') fail('准入记录在读取期间变化')
      const resource = await library.archive({name: archiveName(row.file), type: TYPES[extname(row.file.name).toLowerCase()],
        bytes: Buffer.concat(chunks, count), source: sourceOf(row)})
      // If this final write fails, the same source is safely re-archived and
      // deduplicated on retry; an archive receipt is never card activation.
      const result = verifiedResult(resource.id)
      await T.branch.put(key, {...row, state: 'archived', resourceId: resource.id})
      assertContext()
      return result
    })
  }
  return {materialize}
}
