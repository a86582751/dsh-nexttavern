import type {FileSystem} from '@deepseek-ai/dsh-fs'
import {formatFromExtension, toMarkdownBytes, type Format} from '@firecrawl/anydoc'
import {dshNormalizeMarkdown} from './normalize-markdown.js'

const MAX_INPUT_BYTES = 64 * 1024 * 1024
const MAX_CACHE_CHARACTERS = 4 * 1024 * 1024
const MAX_CACHE_ENTRIES = 8

interface CachedDocument {
  version: string
  format?: string
  markdown: string
}

/** One preset's bounded cache, separated again by actual filesystem provider. */
export function createDocumentReader(convert = toMarkdownBytes) {
  let caches = new WeakMap<object, Map<string, CachedDocument>>()

  async function read(fs: FileSystem, filePath: string, format: string | undefined,
    cwd: string | undefined, signal: AbortSignal) {
    signal.throwIfAborted()
    const target = await fs.resolve(filePath, {cwd, signal})
    const info = await fs.stat(target, signal)
    if (!info || info.type !== 'file') throw Error('文件不存在或不是普通文件')
    if (info.size !== undefined && info.size > MAX_INPUT_BYTES) throw Error('文件超过 64 MiB 读取上限')
    // Cordis contextual proxies vary across calls. Cache by provider identity,
    // without treating its opaque target/version keys as filesystem paths.
    const identity = Reflect.get(fs, Symbol.for('cordis.original')) ?? fs
    let cache = caches.get(identity)
    if (!cache) { cache = new Map(); caches.set(identity, cache) }
    const cached = cache.get(target.targetKey)
    if (cached?.version === info.version && cached.format === format) {
      cache.delete(target.targetKey)
      cache.set(target.targetKey, cached)
      return {target, version: info.version, markdown: cached.markdown}
    }
    const extension = /\.([^./\\]+)$/.exec(filePath)?.[1]?.toLowerCase()
    const textOnly = ['txt', 'md', 'markdown'].includes(format ?? extension ?? '')
    const bytes = await fs.readBytes(target, signal, MAX_INPUT_BYTES)
    const markdown = textOnly
      ? new TextDecoder('utf-8', {fatal: true}).decode(bytes)
      : dshNormalizeMarkdown(await convert(bytes, format as Format | undefined ?? formatFromExtension(extension ?? '')))
    signal.throwIfAborted()
    if (!markdown.trim()) throw Error('文档没有可读取的文本')
    // Do not cache a mixture of versions if the source changed during conversion.
    const after = await fs.stat(target, signal)
    if (after?.version !== info.version) throw Error('读取期间文件发生变化，请重试')
    cache.delete(target.targetKey)
    if (markdown.length <= MAX_CACHE_CHARACTERS) {
      cache.set(target.targetKey, {version: info.version, format, markdown})
      const characters = () => [...cache.values()].reduce((sum, entry) => sum + entry.markdown.length, 0)
      while (cache.size > MAX_CACHE_ENTRIES || characters() > MAX_CACHE_CHARACTERS) {
        cache.delete(cache.keys().next().value!)
      }
    }
    return {target, version: info.version, markdown}
  }

  return {read, dispose() {caches = new WeakMap()}}
}

/** Character windows include an explicit next cursor, never a misleading preview. */
export function documentPage(markdown: string, offset = 0, limit = 16000) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw Error('offset 必须是非负整数')
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 32000) throw Error('limit 必须是 1–32000 的整数')
  if (offset > markdown.length) throw Error('offset 超过文档字符总数')
  let end = Math.min(offset + limit, markdown.length)
  // Returned cursors must not cut a UTF-16 surrogate pair in two.
  if (end < markdown.length && /[\uD800-\uDBFF]/.test(markdown.charAt(end - 1))) end--
  if (end === offset && offset < markdown.length) end = Math.min(offset + 2, markdown.length)
  return {offset, endOffset: end, totalCharacters: markdown.length,
    nextOffset: end < markdown.length ? end : null, content: markdown.slice(offset, end)}
}
