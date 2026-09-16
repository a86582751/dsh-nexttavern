import { createHash } from 'node:crypto'

export const LIBRARY_NAME_LIMIT = 160
export const safeLibraryName = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('资源名称无效')
  const name = value.normalize('NFC').trim()
  if (!name || name.length > LIBRARY_NAME_LIMIT || /[\x00-\x1f<>:"/\\|?*]/.test(name) || name === '.' || name === '..') throw new Error('资源名称包含不安全字符')
  return name
}
export const safeLibraryType = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-z]+\/[a-z0-9!#$&^_.+-]+(?:;\s*charset=(?:utf-8|us-ascii))?$/i.test(value) || value.length > 128) throw new Error('资源类型无效')
  return value.toLowerCase()
}
export const librarySource = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('资源来源无效')
  const source: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) || typeof item !== 'string' || item.length > 1024) throw new Error('资源来源字段无效')
    source[key] = item
  }
  if (!source.sessionId) throw new Error('资源来源必须包含 sessionId')
  return source
}
export const libraryObjectName = (sha256: string, name: string): string => `${sha256}--${safeLibraryName(name)}`
export const libraryContentDisposition = (name: string): string => {
  const fallback = name.normalize('NFKD').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download'
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
}
export const libraryStableId = (workspaceHash: string, fullSha256: string): string => createHash('sha256').update(`tavern-library\0${workspaceHash}\0${fullSha256}`).digest('hex')
