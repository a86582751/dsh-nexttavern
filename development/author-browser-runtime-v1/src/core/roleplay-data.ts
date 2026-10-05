import { createHash, randomUUID } from 'node:crypto'
import { relative, sep, isAbsolute } from 'node:path'
import { writeUserInfo as writeUserInfoFile } from './roleplay-userinfo.js'

export { userInfoPath, readUserInfo } from './roleplay-userinfo.js'


// ── 小工具 ──────────────────────────────────────────────────────────────────

// storage-json 的 per-record 布局要求键 path-safe（/^[a-zA-Z0-9_-]+$/），
// 冒号不可用：以双下划线分隔 branchId 与子键（session id 只含 [a-z0-9-]）。
export const keyOf = (branchId: string, sub: string) => `${branchId}__${sub}`

export function writeUserInfo(record: unknown) {
  // Preserve the preset's best-effort contract; the Host HTTP route reports write failures.
  try {
    writeUserInfoFile(record)
  } catch {}
}

export function textOf(content: unknown) {
  if (!Array.isArray(content)) return ''
  return (content as { type?: unknown; text?: unknown }[])
    .filter((b): b is { type: 'text'; text: string } => !!b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
}

export function durableSeq(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null
}

export function provenanceSeq(value: unknown) {
  const item = value as (Record<string, unknown> & { range?: { end?: unknown } }) | null
  if (!item || typeof item !== 'object') return null
  const candidates = [
    item.atSeq, item.evidenceSeq, item.updatedAtSeq, item.checkpointSeq,
    item.sourceSeq, item.seq, item.range?.end,
  ]
  for (const candidate of candidates) {
    const seq = durableSeq(candidate)
    if (seq !== null) return seq
  }
  return null
}

export function estimateTokens(text: unknown) {
  // 中文约 1 token/字，英文约 4 字符/token；取一个偏保守的近似。
  return Math.ceil(String(text ?? '').length / 2.5)
}

export function sha256(text: unknown) {
  const hash = createHash('sha256')
  return (Buffer.isBuffer(text) ? hash.update(text) : hash.update(String(text ?? ''), 'utf8')).digest('hex')
}

export function safeId(raw: unknown) {
  const value = String(raw ?? '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64)
  return value || `generated-${randomUUID().slice(0, 8)}`
}

/** Stable path-safe id for imported entries; CJK labels retain identity via hash. */
export function stableImportId(raw: unknown) {
  const label = String(raw ?? '').normalize('NFKC').trim()
  if (!label) throw new Error('card/worldbook assignment 必须提供非空 id 或 name')
  if (/^[a-zA-Z0-9_-]{1,64}$/.test(label)) return label
  const stem = label
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44)
  const digest = sha256(label).slice(0, 16)
  return `${stem || 'entry'}-${digest}`
}

export function cloneRecord<T>(value: T): T {
  return value === undefined ? value : structuredClone(value)
}

// Persisted record hashes use UTF-16 key order, omit undefined object fields and
// encode undefined array values as null. Do not replace this with export JSON's
// locale-aware ordering: that would invalidate existing record CAS hashes.
export function stableJson(value: unknown): string | undefined {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
}

export function recordSha256(value: unknown) {
  return value === undefined ? 'missing' : sha256(stableJson(value))
}

export function isPathWithin(root: string, candidate: string) {
  const rel = relative(root, candidate)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/** Mirror scripts/deescape-md.mjs without modifying the converter artefact. */
export function deescapeMarkdown(text: unknown) {
  return String(text ?? '')
    // Keep BOM in rawSource, but do not let it hide the first Markdown marker
    // from the normalized classifier view.
    .replace(/^\uFEFF/, '')
    .replace(/^([ \t]*)\\(#{1,6})(?=\s)/gm, '$1$2')
    .replace(/^([ \t]*)\\(>+)/gm, '$1$2')
    .replace(/^([ \t]*)\\([-*+])(?=\s)/gm, '$1$2')
    .replace(/^([ \t]*)\\(\d+[.)])(?=\s)/gm, '$1$2')
    .replace(/^([ \t]*)\\([-*_])\2{2,}\s*$/gm, (match, indent) => `${indent}${match.slice(indent.length + 1)}`)
    .replace(/^([ \t]*)\\(`{3,}|~{3,})/gm, '$1$2')
    // Standard HTML tags are structurally unambiguous and may occur inline.
    // Keep unknown/custom `\<not-a-tag\>` text escaped rather than guessing.
    .replace(/\\(<\/?(?:a|abbr|article|aside|audio|b|blockquote|body|br|button|canvas|caption|circle|code|col|colgroup|data|datalist|dd|defs|del|details|dialog|div|dl|dt|em|fieldset|figcaption|figure|footer|form|g|h[1-6]|head|header|hr|html|i|iframe|img|input|ins|kbd|label|legend|li|line|linearGradient|link|main|map|mark|menu|meta|meter|nav|noscript|object|ol|optgroup|option|output|p|path|picture|polygon|polyline|pre|progress|q|rect|rp|rt|ruby|s|samp|script|section|select|slot|small|source|span|stop|strong|style|sub|summary|sup|svg|symbol|table|tbody|td|template|text|textarea|tfoot|th|thead|time|title|tr|track|u|ul|use|var|video|wbr)(?=[\s/>]|\\>)[^>\r\n]*?(?:\\)?>)/gi,
      (_match, tag) => tag.replace(/\\>$/, '>'))
    // Complete Markdown links/images and table rows are safe to restore;
    // isolated `\[`/`\|` in prose, LaTeX and regexes remain byte-identical.
    .replace(/^([ \t]*)(\\!)?\\(\[[^\r\n\]]*(?:\\)?\]\([^\r\n]*\))/gm,
      (_match, indent, image, link) => `${indent}${image ? '!' : ''}${link.replace(/\\\]/, ']')}`)
    .replace(/^([ \t]*)(\\\|[^\r\n]*\\\|[^\r\n]*)$/gm,
      (_match, indent, row) => `${indent}${row.replace(/\\\|/g, '|')}`)
    // Roleplay status templates rely on these tokens being executable after
    // import. Restore only a complete pair; ordinary JS/CSS braces are kept.
    // Do not expose a literal double-brace example to the system-prompt
    // templater; normalized card text keeps the placeholder escaped until the
    // status renderer intentionally expands it.
    .replace(/\\\{\\\{([^{}\r\n]{1,200})\\\}\\\}/g, '{{$1}}')
}

export function passthroughSchema() {
  return {
    parse(v: unknown) {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) {
        throw new Error('roleplay domain record must be a JSON object')
      }
      return v
    },
    safeParse(v: unknown) {
      try {
        return { success: true as const, data: this.parse(v) }
      } catch (error) {
        return { success: false as const, error }
      }
    },
  }
}

export function rollsSchema() {
  const normalize = (value: unknown) => {
    // alpha.3 roleplay builds before this repair wrote the log as a bare
    // Array even though the shared passthrough schema rejected arrays. Accept
    // and normalize that durable legacy shape while opening the domain.
    if (Array.isArray(value)) {
      return { schemaVersion: 1, entries: value.slice(-200), updatedAt: 0 }
    }
    if (value === null || typeof value !== 'object') {
      throw new Error('roleplay rolls record must be a JSON object or legacy array')
    }
    return value
  }
  return {
    parse: normalize,
    safeParse(value: unknown) {
      try { return { success: true as const, data: normalize(value) } }
      catch (error) { return { success: false as const, error } }
    },
  }
}

export function rollLogEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const record = value as { entries?: unknown } | null
  return Array.isArray(record?.entries) ? record.entries : []
}

export function rollLogRecord(entries: Iterable<unknown>) {
  return { schemaVersion: 1, entries: [...entries].slice(-200), updatedAt: Date.now() }
}

export function extractJson(raw: unknown): unknown {
  let text = String(raw ?? '').trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1]!.trim()
  try {
    return JSON.parse(text)
  } catch {}
  // 回退：取第一个平衡花括号块
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {}
        return null
      }
    }
  }
  return null
}
