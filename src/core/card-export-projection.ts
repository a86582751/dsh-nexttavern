import { createHash } from 'node:crypto'

export interface ExportMaterial { label: string; source: string | Record<string, unknown>; text: string }
export interface ExportUnit extends ExportMaterial { id: string; sha256: string }
export interface ExportSnapshot { schemaVersion: 1; branchId: string; units: ExportUnit[]; text: string; sourceHash: string }
export interface ExportSection { heading?: unknown; source_ids?: unknown; source_parts?: unknown }

const hash = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex')
const safeHeading = (value: unknown): string => String(value ?? '').replace(/[\r\n\x00-\x1f]/g, ' ').replace(/^#+\s*/, '').trim().slice(0, 200)
const sourceLines = (text: string): string[] => text.match(/[^\n]*\n|[^\n]+$/g) ?? ['']
export const stableJson = (value: unknown): string => JSON.stringify(value, (_key, nested) => nested && typeof nested === 'object' && !Array.isArray(nested) ? Object.fromEntries(Object.entries(nested as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b, 'en'))) : nested)

export function exportSnapshot(branchId: string, material: ExportMaterial[]): ExportSnapshot {
  const units = material.map((item, index) => ({ id: `source-${index + 1}`, label: item.label, text: item.text, source: item.source, sha256: hash(item.text) }))
  if (!units.length || units.length > 4096 || units.some(unit => typeof unit.text !== 'string')) throw new Error('没有可导出的设定或条目超限')
  const text = units.map(unit => `[${unit.id}] ${unit.label}\n${unit.text}\n`).join('\n')
  if (text.length > 10_000_000) throw new Error('导出设定超过字符上限，请分卡整理；不会静默精简')
  return { schemaVersion: 1, branchId, units, text, sourceHash: hash(stableJson(material)) }
}

export function renderOrganizedExport(snapshot: ExportSnapshot, title: unknown, sections: ExportSection[]): string {
  if (!Array.isArray(sections) || !sections.length || sections.length > 4096) throw new Error('需要 LLM 提交章节组织方案')
  const sources = new Map(snapshot.units.map(unit => [unit.id, unit])), used = new Map<string, { start: number; end: number }[]>(), lineCache = new Map<string, string[]>(), output = [`# ${safeHeading(title) || '角色扮演设定'}\n`]
  let references = 0
  for (const section of sections) {
    if (!safeHeading(section.heading) || (section.source_ids !== undefined && !Array.isArray(section.source_ids)) || (section.source_parts !== undefined && !Array.isArray(section.source_parts))) throw new Error('章节缺少标题或来源')
    const requested = [...(Array.isArray(section.source_ids) ? section.source_ids : []).map(source_id => ({ source_id })), ...(Array.isArray(section.source_parts) ? section.source_parts : [])] as { source_id?: unknown; start_line?: unknown; end_line?: unknown }[]
    if (!requested.length || (references += requested.length) > 16384) throw new Error('章节缺少来源或引用数量超限')
    const parts: string[] = []
    for (const ref of requested) {
      const id = typeof ref.source_id === 'string' ? ref.source_id : ''
      const unit = sources.get(id); if (!unit) throw new Error('导出章节来源重复或不存在')
      if (!lineCache.has(id)) { if (hash(unit.text) !== unit.sha256) throw new Error('导出来源哈希不一致'); lineCache.set(id, sourceLines(unit.text)) }
      const lines = lineCache.get(id)!; const start = ref.start_line ?? 1; const end = ref.end_line ?? lines.length
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || (start as number) < 1 || (end as number) < (start as number) || (end as number) > lines.length) throw new Error('导出来源行号跨度无效')
      const spans = used.get(id) ?? []; if (spans.some(span => (start as number) <= span.end && (end as number) >= span.start)) throw new Error('导出章节来源重复或不存在'); spans.push({ start: start as number, end: end as number }); used.set(id, spans)
      parts.push(lines.slice((start as number) - 1, end as number).join(''))
    }
    output.push(`## ${safeHeading(section.heading)}\n\n${parts.join('\n\n')}\n`)
  }
  if (used.size !== sources.size) throw new Error('导出必须覆盖全部当前设定，不能漏项或精简')
  for (const [id, spans] of used) { let next = 1; for (const span of spans.sort((a, b) => a.start - b.start)) { if (span.start !== next) throw new Error('导出来源有漏行，必须覆盖全部原文'); next = span.end + 1 } if (next !== sourceLines(sources.get(id)!.text).length + 1) throw new Error('导出来源有漏行，必须覆盖全部原文') }
  output.push(`<!-- dsh-export schemaVersion=1 sourceHash=${snapshot.sourceHash} sources=${used.size} -->\n`); return output.join('\n')
}
