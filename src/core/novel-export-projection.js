// Generated from runtime/alpha3/core/novel-export-projection.ts; edit the TypeScript source.
import { taskHash } from './tavern-task-primitives.js';
function fail(message) { throw new Error(message); }
export function novelUnits(entries) {
    const units = [];
    for (const entry of entries) {
        const text = String(entry.text ?? '');
        for (const match of text.matchAll(/[^\r\n]+(?:\r?\n(?!\r?\n)[^\r\n]+)*/g)) {
            let offset = 0;
            while (offset < match[0].length) {
                const rest = match[0].slice(offset);
                const limit = rest.length > 10000 ? Math.max(5000, rest.lastIndexOf('。', 10000) + 1) : rest.length;
                const part = rest.slice(0, limit), start = (match.index ?? 0) + offset;
                units.push({ id: `seq-${entry.seq}-${start}`, seq: entry.seq, role: entry.role ?? entry.kind, start, end: start + part.length, text: part, sha256: taskHash(part) });
                offset += part.length;
            }
        }
    }
    return units;
}
const anchors = (text) => [...(text.match(/“[^”\n]+”|「[^」\n]+」|「[^』\n]+』|\b\d+(?:[.,:]\d+)*\b|[一二三四五六七八九十百千万两]+(?:只|枚|个|瓶|把|盏|天|年|月|日|点|次|步|人|两)|(?:只有|除非|如果|必须|不得|不能)[^\n。！？]{1,150}[。！？]?/g) ?? [])];
const normalized = (text) => text.replace(/[\s\p{P}\p{S}]/gu, '');
export function validateNovelChunk(units, input) {
    if (!input || typeof input !== 'object' || !('paragraphs' in input) || !Array.isArray(input.paragraphs) || !input.paragraphs.length)
        fail('小说块没有完整段落');
    const value = structuredClone(input);
    if (!Array.isArray(value.paragraphs))
        fail('小说块没有完整段落');
    const paragraphs = [];
    for (const paragraph of value.paragraphs) {
        if (!paragraph || typeof paragraph !== 'object' || !Array.isArray(paragraph.source_ids) || !paragraph.source_ids.every((id) => typeof id === 'string'))
            fail('小说段落来源无效');
        paragraphs.push(paragraph);
    }
    const expected = units.map(unit => unit.id);
    const actual = paragraphs.flatMap(paragraph => paragraph.source_ids);
    if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index]))
        fail('来源覆盖有遗漏、重复或顺序变化');
    const byId = new Map(units.map(unit => [unit.id, unit]));
    for (const paragraph of paragraphs) {
        const sourceIds = paragraph.source_ids;
        if (paragraph.text === undefined)
            paragraph.text = sourceIds.map(id => byId.get(id)?.text ?? fail('小说章节来源不存在')).join('\n\n');
        if (typeof paragraph.text !== 'string' || !paragraph.text.trim())
            fail('小说段落为空');
        for (const id of sourceIds) {
            const unit = byId.get(id) ?? fail('小说章节来源不存在');
            for (const anchor of anchors(unit.text))
                if (!paragraph.text.includes(anchor))
                    fail('小说块遗漏对白、数量或条件细节');
        }
        const output = normalized(paragraph.text);
        let cursor = 0;
        for (const id of sourceIds) {
            const unit = byId.get(id) ?? fail('小说章节来源不存在');
            for (const clause of unit.text.split(/[，,。.!?！？；;：:\n]+/)) {
                const required = normalized(clause);
                if (!required)
                    continue;
                const at = output.indexOf(required, cursor);
                if (at < 0)
                    fail('小说块遗漏或改写了来源细节，请完整保留原句');
                cursor = at + required.length;
            }
        }
    }
    // All paragraph IDs and materialized text have been validated above.
    return value;
}
