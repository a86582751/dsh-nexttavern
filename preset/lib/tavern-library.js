// Project-owned Tavern resource archive. It never exposes a filesystem path as an API.
import { createHash, randomUUID } from 'node:crypto'
import { constants, closeSync, createReadStream, fsyncSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs'
import { Readable } from 'node:stream'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'

export const TAVERN_LIBRARY_LIMITS = Object.freeze({ bytes: 20_000_000, nameCodeUnits: 160 })
const RECORD_PREFIX = 'tavern_library_resource__'
const PENDING_PREFIX = 'tavern_library_pending__'
const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'application/json', 'application/ld+json', 'text/csv'])
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const copy = value => structuredClone(value)
const fail = message => { throw new Error(message) }
const within = (root, candidate) => { const part = relative(root, candidate); return part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part) }
const archiveLocks = new Map()
const keyFor = (workspaceHash, id) => `${RECORD_PREFIX}${workspaceHash}__${id}`
const sourceKey = source => JSON.stringify(Object.fromEntries(Object.entries(source).sort(([left], [right]) => left.localeCompare(right, 'en'))))
const pendingKeyFor = (workspaceHash, id) => `${PENDING_PREFIX}${workspaceHash}__${id}`
const stableId = (workspaceHash, fullSha256) => digest(Buffer.from(`tavern-library\u0000${workspaceHash}\u0000${fullSha256}`, 'utf8'))
async function lockArchive(key, fn) { const prior = archiveLocks.get(key) ?? Promise.resolve(); const next = prior.catch(() => {}).then(fn); archiveLocks.set(key, next); try { return await next } finally { if (archiveLocks.get(key) === next) archiveLocks.delete(key) } }

function safeName(value) {
  if (typeof value !== 'string') fail('资源名称无效')
  const name = value.normalize('NFC').trim()
  if (!name || name.length > TAVERN_LIBRARY_LIMITS.nameCodeUnits || /[\x00-\x1f<>:"/\\|?*]/.test(name) || name === '.' || name === '..') fail('资源名称包含不安全字符')
  return name
}
function safeType(value) {
  if (typeof value !== 'string' || !/^[a-z]+\/[a-z0-9!#$&^_.+-]+(?:;\s*charset=(?:utf-8|us-ascii))?$/i.test(value) || value.length > 128) fail('资源类型无效')
  return value.toLowerCase()
}
function sourceOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('资源来源无效')
  const source = {}
  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) || typeof item !== 'string' || item.length > 1024) fail('资源来源字段无效')
    source[key] = item
  }
  if (!source.sessionId) fail('资源来源必须包含 sessionId')
  return source
}
function fileName(hash, name) {
  // The digest makes byte identity permanent; readable Unicode is retained without ever becoming a path input.
  return `${hash}--${name}`
}
function contentDisposition(name) {
  const fallback = name.normalize('NFKD').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download'
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export function createTavernLibrary({ workspace, table }) {
  if (typeof workspace !== 'string' || !isAbsolute(workspace) || !table || typeof table.get !== 'function' || typeof table.entries !== 'function' || typeof table.put !== 'function') fail('资源库初始化参数无效')
  const requestedRoot = resolve(workspace)
  if (lstatSync(requestedRoot).isSymbolicLink()) fail('工作区不能是符号链接或目录链接')
  const root = realpathSync(requestedRoot)
  if (root !== requestedRoot || !statSync(root).isDirectory()) fail('工作区必须是实际绝对目录')
  const workspaceHash = digest(Buffer.from(root, 'utf8'))
  const recordPrefix = `${RECORD_PREFIX}${workspaceHash}__`
  const pendingPrefix = `${PENDING_PREFIX}${workspaceHash}__`
  const libraryDir = join(root, 'tavern-library')
  const objectDir = join(libraryDir, 'objects')
  const assertDirectory = path => {
    if (lstatSync(path).isSymbolicLink() || !statSync(path).isDirectory() || realpathSync(path) !== path || !within(root, path)) fail('资源库目录不能是符号链接、目录链接或工作区外路径')
  }
  mkdirSync(libraryDir, { recursive: true })
  assertDirectory(libraryDir)
  mkdirSync(objectDir, { recursive: true })
  assertDirectory(objectDir)
  const ensureDirectories = () => { assertDirectory(libraryDir); assertDirectory(objectDir) }

  const records = () => [...table.entries()]
    .filter(([key, value]) => typeof key === 'string' && key.startsWith(recordPrefix) && value?.schemaVersion === 1)
    .map(([, value]) => copy(value))
    .sort((left, right) => left.id.localeCompare(right.id, 'en'))
  const pending = () => [...table.entries()]
    .filter(([key, value]) => typeof key === 'string' && key.startsWith(pendingPrefix) && value?.schemaVersion === 1 && value.state==='pending')
    .map(([, value]) => copy(value))
    .concat(records().flatMap(record=>{try{verify(record);return []}catch(error){return [{schemaVersion:1,id:`resource-${record.id}`,resourceId:record.id,state:'pending',name:record.name,type:record.type,source:record.source,reason:String(error.message)}]}}))
    .sort((left, right) => left.id.localeCompare(right.id, 'en'))
  const recordFor = id => {
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/i.test(id)) fail('资源 ID 无效')
    const record = table.get(keyFor(workspaceHash, id))
    if (!record || record.schemaVersion !== 1 || record.id !== id) fail('资源不存在')
    return copy(record)
  }
  const objectPath = record => {
    if (!record || typeof record.fullSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.fullSha256) || typeof record.objectName !== 'string' || basename(record.objectName) !== record.objectName || record.objectName !== fileName(record.fullSha256, safeName(record.name))) fail('资源记录损坏')
    const path = join(objectDir, record.objectName)
    if (!within(objectDir, path)) fail('资源对象路径越界')
    return path
  }
  const verify = record => {
    ensureDirectories()
    const path = objectPath(record)
    const node = lstatSync(path)
    if (node.isSymbolicLink() || !node.isFile() || node.size !== record.bytes || node.size < 1 || node.size > TAVERN_LIBRARY_LIMITS.bytes || realpathSync(path) !== path || !within(objectDir, realpathSync(path))) fail('资源文件缺失或不安全')
    const bytes = readFileSync(path)
    if (bytes.length !== record.bytes || digest(bytes) !== record.fullSha256) fail('资源文件已损坏')
    return { path, bytes, modifiedAt: node.mtime.toISOString() }
  }
  const writeObject = (path, bytes, hash) => {
    ensureDirectories()
    if (bytes.length < 1 || bytes.length > TAVERN_LIBRARY_LIMITS.bytes) fail('资源大小超出限制')
    try {
      const existing = lstatSync(path)
      if (existing.isSymbolicLink() || !existing.isFile() || existing.size !== bytes.length || realpathSync(path) !== path || !within(objectDir, realpathSync(path)) || digest(readFileSync(path)) !== hash) fail('同名资源对象冲突或已损坏')
      return
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    const temporary = join(objectDir, `.${hash}.${process.pid}.${randomUUID()}.tmp`)
    let fd
    try {
      fd = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600)
      let offset = 0
      while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset)
      fsyncSync(fd); closeSync(fd); fd = undefined
      ensureDirectories()
      if (lstatSync(temporary).isSymbolicLink() || realpathSync(objectDir) !== objectDir) fail('资源暂存文件不安全')
      renameSync(temporary, path)
      const directoryFd = openSync(objectDir, constants.O_RDONLY)
      try { try { fsyncSync(directoryFd) } catch (error) { if (process.platform !== 'win32' || !['EPERM', 'EINVAL'].includes(error?.code)) throw error } } finally { closeSync(directoryFd) }
      const reread = readFileSync(path)
      if (reread.length !== bytes.length || digest(reread) !== hash) fail('资源写入复核失败')
    } finally {
      if (fd !== undefined) closeSync(fd)
      try { unlinkSync(temporary) } catch (error) { if (error?.code !== 'ENOENT') throw error }
    }
  }

  async function archive({ name, type, bytes, source }) {
    const cleanName = safeName(name), cleanType = safeType(type), cleanSource = sourceOf(source)
    if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) fail('资源内容必须是字节')
    const body = Buffer.from(bytes)
    if (!body.length || body.length > TAVERN_LIBRARY_LIMITS.bytes) fail('资源大小超出限制')
    const fullSha256 = digest(body), id = stableId(workspaceHash, fullSha256)
    return lockArchive(`${workspaceHash}:${fullSha256}`, async () => {
      const existing = table.get(keyFor(workspaceHash, id))
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
      const objectName = fileName(fullSha256, cleanName)
      writeObject(join(objectDir, objectName), body, fullSha256)
      const now = new Date().toISOString()
      const record = { schemaVersion: 1, id, workspaceHash, name: cleanName, type: cleanType, bytes: body.length, fullSha256, objectName, createdAt: now, verifiedAt: now, source: cleanSource, sources: [cleanSource] }
      await table.put(keyFor(workspaceHash, id), copy(record))
      return { ...record, deduplicated: false }
    })
  }
  function metadata(id) { const record = recordFor(id); const { path, modifiedAt } = verify(record); return { ...record, source: copy(record.source), sources: copy(record.sources ?? [record.source]), path, modifiedAt, sha256: record.fullSha256 } }
  function list() { return records().flatMap(record=>{try{return [metadata(record.id)]}catch{return []}}) }
  function read(id) {
    const record = recordFor(id)
    if (!TEXT_TYPES.has(record.type.split(';', 1)[0])) fail('该资源不是安全文本类型')
    const { bytes } = verify(record)
    let text
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { fail('资源文本不是有效 UTF-8') }
    return { ...record, text }
  }
  function openDownload(id) {
    const record = recordFor(id)
    const { path } = verify(record)
    let fd
    try {
      fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
      const node = statSync(path), opened = fstatSync(fd)
      if (!opened.isFile() || opened.size !== record.bytes || opened.dev !== node.dev || opened.ino !== node.ino || digest(readFileSync(fd)) !== record.fullSha256) fail('资源文件在下载前改变')
      const stream = Readable.toWeb(createReadStream(path, { fd, autoClose: true, start: 0 }))
      fd = undefined
      return new Response(stream, { headers: {
      'content-type': record.type, 'content-length': String(record.bytes), 'content-disposition': contentDisposition(record.name),
      'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'etag': `"${record.fullSha256}"`,
      } })
    } finally { if (fd !== undefined) closeSync(fd) }
  }
  async function migrate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('迁移记录无效')
    const id = typeof input.id === 'string' && input.id ? input.id : randomUUID()
    const source = { ...(input.source && typeof input.source === 'object' ? input.source : {}), migrationId: id }
    let bytes
    try {
      if (input.bytes !== undefined) bytes = Buffer.from(input.bytes)
      else if (typeof input.path === 'string') {
        if (!input.path || !isAbsolute(input.path)) fail('迁移路径必须是工作区内绝对路径')
        const path = resolve(input.path)
        if (!within(root, path) || lstatSync(path).isSymbolicLink() || realpathSync(path) !== path || !within(root, realpathSync(path))) fail('迁移路径不安全')
        const info = statSync(path)
        if (!info.isFile() || info.size < 1 || info.size > TAVERN_LIBRARY_LIMITS.bytes) fail('迁移文件缺失或大小超限')
        bytes = readFileSync(path)
      } else fail('迁移必须提供明确 bytes 或受约束路径')
      const result = await archive({ name: input.name, type: input.type, bytes, source: sourceOf(source) })
      await table.put(pendingKeyFor(workspaceHash, id), { schemaVersion: 1, id, state: 'completed', source, resourceId: result.id, fullSha256: result.fullSha256 })
      return { ok: true, resource: result }
    } catch (error) {
      const pendingRecord = { schemaVersion: 1, id, state: 'pending', source, name: typeof input.name === 'string' ? input.name : '', type: typeof input.type === 'string' ? input.type : '', reason: error.message }
      await table.put(pendingKeyFor(workspaceHash, id), pendingRecord)
      return { ok: false, pending: pendingRecord }
    }
  }
  return Object.freeze({ archive, list, metadata, read, openDownload, migrate, pending })
}





