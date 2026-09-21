// Canonical TypeScript source for the Tavern resource archive.
// Project-owned Tavern resource archive. It never exposes a filesystem path as an API.
import { createHash, randomUUID } from 'node:crypto'
import { constants,
     closeSync,
     createReadStream,
     fsyncSync,
     fstatSync,
     lstatSync,
     mkdirSync,
     openSync,
     readFileSync,
     realpathSync,
     renameSync,
     statSync,
     unlinkSync,
     writeSync } from 'node:fs'
import { Readable } from 'node:stream'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { safeLibraryName as safeName,
     safeLibraryType as safeType,
     librarySource as sourceOf,
     createLibraryObjectName,
     libraryContentDisposition as contentDisposition,
     libraryStableId as stableId } from './tavern-library-input.js'
import { libraryRecordKey, libraryPendingKey, librarySourceKey, validatedLibraryObjectName } from './tavern-library-record.js'

export interface TavernResource {
  schemaVersion: 1
  id: string
  workspaceHash: string
  name: string
  type: string
  bytes: number
  fullSha256: string
  objectName: string
  createdAt: string
  verifiedAt: string
  source: Record<string, string>
  sources?: Record<string, string>[]
  [field: string]: unknown
}
export interface PendingResource {
  schemaVersion: 1
  id: string
  state: 'pending'
  resourceId?: string
  name: string
  type: string
  source: Record<string, unknown>
  reason?: string
  [field: string]: unknown
}
export interface LibraryTable {
  get(key: string): unknown
  entries(): Iterable<[string, unknown]>
  put(key: string, value: unknown): unknown | PromiseLike<unknown>
}
export interface CompletedMigration {
  schemaVersion: 1
  id: string
  state: 'completed'
  source: Record<string, unknown>
  resourceId: string
  fullSha256: string
}
export interface ArchiveInput { name: unknown; type: unknown; bytes: unknown; source: unknown }
type ArchiveResult = TavernResource & { deduplicated: boolean }
type MigrationResult = { ok: true; resource: ArchiveResult } | { ok: false; pending: PendingResource }

export const TAVERN_LIBRARY_LIMITS = Object.freeze({ bytes: 20_000_000, nameCodeUnits: 160 })
const RECORD_PREFIX = 'tavern_library_resource__'
const PENDING_PREFIX = 'tavern_library_pending__'
const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'application/json', 'application/ld+json', 'text/csv'])
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
const copy = <T>(value: T): T => structuredClone(value)
function fail(message: string): never { throw new Error(message) }
const within = (root: string,
     candidate: string): boolean => { const part = relative(root,
     candidate);
     return part !== '..'
    && !part.startsWith(`..${sep}`)
    && !isAbsolute(part) }
const archiveLocks = new Map<string, Promise<unknown>>()
const keyFor = (workspaceHash: string, id: string): string => libraryRecordKey(RECORD_PREFIX, workspaceHash, id)
const sourceKey = (source: Record<string, string>): string => librarySourceKey(source)
const pendingKeyFor = (workspaceHash: string, id: string): string => libraryPendingKey(PENDING_PREFIX, workspaceHash, id)
// Input/path helpers are generated from tavern-library-input.ts.
async function lockArchive<T>(key: string,
     fn: () => PromiseLike<T>): Promise<T> { const prior = archiveLocks.get(key)
    ?? Promise.resolve();
     const next = prior.catch(() => {}).then(fn);
     archiveLocks.set(key,
     next);
     try { return await next } finally { if (archiveLocks.get(key) === next) archiveLocks.delete(key) } }


export function createTavernLibrary({ workspace, table }: { workspace: string; table: LibraryTable }) {
  if (typeof workspace !== 'string'
      || !isAbsolute(workspace)
      || !table
      || typeof table.get !== 'function'
      || typeof table.entries !== 'function'
      || typeof table.put !== 'function') fail('资源库初始化参数无效')
  const requestedRoot = resolve(workspace)
  if (lstatSync(requestedRoot).isSymbolicLink()) fail('工作区不能是符号链接或目录链接')
  const root = realpathSync(requestedRoot)
  if (root !== requestedRoot || !statSync(root).isDirectory()) fail('工作区必须是实际绝对目录')
  const workspaceHash = digest(Buffer.from(root, 'utf8'))
  const recordPrefix = `${RECORD_PREFIX}${workspaceHash}__`
  const pendingPrefix = `${PENDING_PREFIX}${workspaceHash}__`
  const libraryDir = join(root, 'tavern-library')
  const objectDir = join(libraryDir, 'objects')
  const assertDirectory = (path: string): void => {
    if (lstatSync(path).isSymbolicLink()
        || !statSync(path).isDirectory()
        || realpathSync(path) !== path
        || !within(root,
         path)) fail('资源库目录不能是符号链接、目录链接或工作区外路径')
  }
  mkdirSync(libraryDir, { recursive: true })
  assertDirectory(libraryDir)
  mkdirSync(objectDir, { recursive: true })
  assertDirectory(objectDir)
  const ensureDirectories = () => { assertDirectory(libraryDir); assertDirectory(objectDir) }

  const records = () => {
    const result: TavernResource[] = []
    for (const [key, raw] of table.entries()) {
      // Retain the legacy schema filter; file integrity is verified on access.
      const value = raw as TavernResource | null | undefined
      if (typeof key === 'string' && key.startsWith(recordPrefix) && value?.schemaVersion === 1) result.push(copy(value))
    }
    result.sort((left, right) => left.id.localeCompare(right.id, 'en'))
    return result
  }
  const pending = () => {
    const result: PendingResource[] = []
    for (const [key, raw] of table.entries()) {
      const value = raw as PendingResource | null | undefined
      if (typeof key === 'string' && key.startsWith(pendingPrefix) && value?.schemaVersion === 1 && value.state === 'pending') result.push(copy(value))
    }
    for (const record of records()) {
      try { verify(record) } catch (error) {
        result.push({ schemaVersion: 1,
             id: `resource-${record.id}`,
             resourceId: record.id,
             state: 'pending',
             name: record.name,
             type: record.type,
             source: record.source,
             reason: String((error as Error).message) })
      }
    }
    result.sort((left, right) => left.id.localeCompare(right.id, 'en'))
    return result
  }
  const recordFor = (id: unknown): TavernResource => {
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/i.test(id)) fail('资源 ID 无效')
    const record = table.get(keyFor(workspaceHash, id)) as TavernResource | null | undefined
    if (!record || record.schemaVersion !== 1 || record.id !== id) fail('资源不存在')
    return copy(record)
  }
  const objectPath = (record: TavernResource): string => {
    const objectName = validatedLibraryObjectName(record, safeName, createLibraryObjectName)
    if (basename(objectName) !== objectName) fail('资源记录损坏')
    const path = join(objectDir, objectName)
    if (!within(objectDir, path)) fail('资源对象路径越界')
    return path
  }
  const verify = (record: TavernResource) => {
    ensureDirectories()
    const path = objectPath(record)
    const node = lstatSync(path)
    if (node.isSymbolicLink()
        || !node.isFile()
        || node.size !== record.bytes
        || node.size < 1
        || node.size > TAVERN_LIBRARY_LIMITS.bytes
        || realpathSync(path) !== path
        || !within(objectDir,
         realpathSync(path))) fail('资源文件缺失或不安全')
    const bytes = readFileSync(path)
    if (bytes.length !== record.bytes || digest(bytes) !== record.fullSha256) fail('资源文件已损坏')
    return { path, bytes, modifiedAt: node.mtime.toISOString() }
  }
  const writeObject = (path: string, bytes: Uint8Array, hash: string): void => {
    ensureDirectories()
    if (bytes.length < 1 || bytes.length > TAVERN_LIBRARY_LIMITS.bytes) fail('资源大小超出限制')
    try {
      const existing = lstatSync(path)
      if (existing.isSymbolicLink()
          || !existing.isFile()
          || existing.size !== bytes.length
          || realpathSync(path) !== path
          || !within(objectDir,
           realpathSync(path))
          || digest(readFileSync(path)) !== hash) fail('同名资源对象冲突或已损坏')
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code !== 'ENOENT') throw error
    }
    const temporary = join(objectDir, `.${hash}.${process.pid}.${randomUUID()}.tmp`)
    let fd: number | undefined
    try {
      fd = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600)
      let offset = 0
      while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset)
      fsyncSync(fd); closeSync(fd); fd = undefined
      ensureDirectories()
      if (lstatSync(temporary).isSymbolicLink() || realpathSync(objectDir) !== objectDir) fail('资源暂存文件不安全')
      renameSync(temporary, path)
      const directoryFd = openSync(objectDir, constants.O_RDONLY)
      try { try { fsyncSync(directoryFd) } catch (error) { if (process.platform !== 'win32'
          || !['EPERM',
           'EINVAL'].includes((error as NodeJS.ErrnoException | null)?.code
          ?? '')) throw error } } finally { closeSync(directoryFd) }
      const reread = readFileSync(path)
      if (reread.length !== bytes.length || digest(reread) !== hash) fail('资源写入复核失败')
    } finally {
      if (fd !== undefined) closeSync(fd)
      try { unlinkSync(temporary) } catch (error) { if ((error as NodeJS.ErrnoException | null)?.code !== 'ENOENT') throw error }
    }
  }

  async function archive({ name, type, bytes, source }: ArchiveInput): Promise<ArchiveResult> {
    const cleanName = safeName(name), cleanType = safeType(type), cleanSource = sourceOf(source)
    if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) fail('资源内容必须是字节')
    const body = Buffer.from(bytes)
    if (!body.length || body.length > TAVERN_LIBRARY_LIMITS.bytes) fail('资源大小超出限制')
    const fullSha256 = digest(body), id = stableId(workspaceHash, fullSha256)
    return lockArchive(`${workspaceHash}:${fullSha256}`, async () => {
      const existing = table.get(keyFor(workspaceHash, id)) as TavernResource | null | undefined
      if (existing) {
        const verified = copy(existing); verify(verified)
        const sources = Array.isArray(verified.sources) ? verified.sources.map(sourceOf) : [sourceOf(verified.source)]
        if (!sources.some(item => sourceKey(item) === sourceKey(cleanSource))) {
          const merged = { ...verified, sources: [...sources, cleanSource] }
          await table.put(keyFor(workspaceHash, id), copy(merged))
          return { ...merged, deduplicated: true }
        }
        return { ...verified, sources, deduplicated: true }
      }
      const objectName = createLibraryObjectName(fullSha256, cleanName)
      writeObject(join(objectDir, objectName), body, fullSha256)
      const now = new Date().toISOString()
      const record: TavernResource = { schemaVersion: 1,
           id,
           workspaceHash,
           name: cleanName,
           type: cleanType,
           bytes: body.length,
           fullSha256,
           objectName,
           createdAt: now,
           verifiedAt: now,
           source: cleanSource,
           sources: [cleanSource] }
      await table.put(keyFor(workspaceHash, id), copy(record))
      return { ...record, deduplicated: false }
    })
  }
  function metadata(id: unknown) { const record = recordFor(id);
       const { path,
       modifiedAt } = verify(record);
       return { ...record,
       source: copy(record.source),
       sources: copy(record.sources
      ?? [record.source]),
       path,
       modifiedAt,
       sha256: record.fullSha256 } }
  function list() { return records().flatMap(record=>{try{return [metadata(record.id)]}catch{return []}}) }
  function read(id: unknown) {
    const record = recordFor(id)
    if (!TEXT_TYPES.has(record.type.split(';', 1)[0] ?? '')) fail('该资源不是安全文本类型')
    const { bytes } = verify(record)
    let text: string
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { fail('资源文本不是有效 UTF-8') }
    return { ...record, text }
  }
  function openDownload(id: unknown): Response {
    const record = recordFor(id)
    const { path } = verify(record)
    let fd: number | undefined
    try {
      fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
      const node = statSync(path), opened = fstatSync(fd)
      if (!opened.isFile()
          || opened.size !== record.bytes
          || opened.dev !== node.dev
          || opened.ino !== node.ino
          || digest(readFileSync(fd)) !== record.fullSha256) fail('资源文件在下载前改变')
      const stream = Readable.toWeb(createReadStream(path, { fd, autoClose: true, start: 0 }))
      fd = undefined
      // Node's web-stream declaration differs from DOM's; the runtime object is
      // the same WHATWG byte stream consumed by Response (covered by download tests).
      return new Response(stream as unknown as ReadableStream<Uint8Array>, { headers: {
      'content-type': record.type, 'content-length': String(record.bytes), 'content-disposition': contentDisposition(record.name),
      'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'etag': `"${record.fullSha256}"`,
      } })
    } finally { if (fd !== undefined) closeSync(fd) }
  }
  async function migrate(raw: unknown): Promise<MigrationResult> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('迁移记录无效')
    const input = raw as Record<string, unknown>
    const id = typeof input.id === 'string' && input.id ? input.id : randomUUID()
    const source = { ...(input.source && typeof input.source === 'object' ? input.source : {}), migrationId: id }
    let bytes: Buffer
    try {
      // Preserve Node's existing overload dispatch (string, array, buffer and
      // ArrayBuffer); invalid values must still enter the pending recovery path.
      if (input.bytes !== undefined) bytes = Buffer.from(input.bytes as Parameters<typeof Buffer.from>[0])
      else if (typeof input.path === 'string') {
        if (!input.path || !isAbsolute(input.path)) fail('迁移路径必须是工作区内绝对路径')
        const path = resolve(input.path)
        if (!within(root, path) || lstatSync(path).isSymbolicLink() || realpathSync(path) !== path || !within(root, realpathSync(path))) fail('迁移路径不安全')
        const info = statSync(path)
        if (!info.isFile() || info.size < 1 || info.size > TAVERN_LIBRARY_LIMITS.bytes) fail('迁移文件缺失或大小超限')
        bytes = readFileSync(path)
      } else fail('迁移必须提供明确 bytes 或受约束路径')
      const result = await archive({ name: input.name, type: input.type, bytes, source: sourceOf(source) })
      const completed: CompletedMigration = { schemaVersion: 1, id, state: 'completed', source, resourceId: result.id, fullSha256: result.fullSha256 }
      await table.put(pendingKeyFor(workspaceHash, id), completed)
      return { ok: true, resource: result }
    } catch (error) {
      const pendingRecord: PendingResource = { schemaVersion: 1,
           id,
           state: 'pending',
           source,
           name: typeof input.name === 'string' ? input.name : '',
           type: typeof input.type === 'string' ? input.type : '',
           reason: (error as Error).message }
      await table.put(pendingKeyFor(workspaceHash, id), pendingRecord)
      return { ok: false, pending: pendingRecord }
    }
  }
  return Object.freeze({ archive, list, metadata, read, openDownload, migrate, pending })
}
