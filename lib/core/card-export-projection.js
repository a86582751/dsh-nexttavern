// Generated from runtime/alpha3/src/core/card-export-projection.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
const hash = (value) => createHash('sha256').update(value).digest('hex');
export const safeHeading = (value) => String(value ?? '').replace(/[\r\n\x00-\x1f]/g, ' ').replace(/^#+\s*/, '').trim().slice(0, 200);
// Pagination and export coverage must agree about trailing newlines and the empty source.
export const sourceLines = (text) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [''];
// Export sourceHash uses English collation and JSON.stringify semantics (including
// toJSON and undefined). It is a separate compatibility contract from record CAS.
export const stableJson = (value) => JSON.stringify(value, (_key, nested) => nested
    && typeof nested === 'object'
    && !Array.isArray(nested) ? Object.fromEntries(Object.entries(nested).sort(([a], [b]) => a.localeCompare(b, 'en'))) : nested);
export function exportSnapshot(branchId, material) {
    const units = material.map((item, index) => ({ id: `source-${index + 1}`, label: item.label, text: item.text, source: item.source, sha256: hash(item.text) }));
    if (!units.length || units.length > 4096 || units.some(unit => typeof unit.text !== 'string'))
        throw new Error('没有可导出的设定或条目超限');
    const text = units.map(unit => `[${unit.id}] ${unit.label}\n${unit.text}\n`).join('\n');
    if (text.length > 10_000_000)
        throw new Error('导出设定超过字符上限，请分卡整理；不会静默精简');
    return { schemaVersion: 1, branchId, units, text, sourceHash: hash(stableJson(material)) };
}
export function renderOrganizedExport(snapshot, title, sections) {
    if (!Array.isArray(sections) || !sections.length || sections.length > 4096)
        throw new Error('需要 LLM 提交章节组织方案');
    const sources = new Map(snapshot.units.map(unit => [unit.id,
        unit])), used = new Map(), lineCache = new Map(), output = [`# ${safeHeading(title)
            || '角色扮演设定'}\n`];
    let references = 0;
    for (const section of sections) {
        if (!safeHeading(section.heading)
            || (section.source_ids !== undefined
                && !Array.isArray(section.source_ids))
            || (section.source_parts !== undefined
                && !Array.isArray(section.source_parts)))
            throw new Error('章节缺少标题或来源');
        const requested = [...(Array.isArray(section.source_ids) ? section.source_ids : []).map(source_id => ({ source_id })),
            ...(Array.isArray(section.source_parts) ? section.source_parts : [])];
        if (!requested.length || (references += requested.length) > 16384)
            throw new Error('章节缺少来源或引用数量超限');
        const parts = [];
        for (const ref of requested) {
            const id = typeof ref.source_id === 'string' ? ref.source_id : '';
            const unit = sources.get(id);
            if (!unit)
                throw new Error('导出章节来源重复或不存在');
            if (!lineCache.has(id)) {
                if (hash(unit.text) !== unit.sha256)
                    throw new Error('导出来源哈希不一致');
                lineCache.set(id, sourceLines(unit.text));
            }
            const lines = lineCache.get(id);
            const start = ref.start_line ?? 1;
            const end = ref.end_line ?? lines.length;
            if (!Number.isSafeInteger(start)
                || !Number.isSafeInteger(end)
                || start < 1
                || end < start
                || end > lines.length)
                throw new Error('导出来源行号跨度无效');
            const spans = used.get(id)
                ?? [];
            if (spans.some(span => start <= span.end
                && end >= span.start))
                throw new Error('导出章节来源重复或不存在');
            spans.push({ start: start,
                end: end });
            used.set(id, spans);
            parts.push(lines.slice(start - 1, end).join(''));
        }
        output.push(`## ${safeHeading(section.heading)}\n\n${parts.join('\n\n')}\n`);
    }
    if (used.size !== sources.size)
        throw new Error('导出必须覆盖全部当前设定，不能漏项或精简');
    for (const [id, spans] of used) {
        let next = 1;
        for (const span of spans.sort((a, b) => a.start - b.start)) {
            if (span.start !== next)
                throw new Error('导出来源有漏行，必须覆盖全部原文');
            next = span.end + 1;
        }
        if (next !== sourceLines(sources.get(id).text).length + 1)
            throw new Error('导出来源有漏行，必须覆盖全部原文');
    }
    output.push(`<!-- dsh-export schemaVersion=1 sourceHash=${snapshot.sourceHash} sources=${used.size} -->\n`);
    return output.join('\n');
}
