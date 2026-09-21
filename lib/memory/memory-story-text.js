// Generated from runtime/alpha3/src/memory/memory-story-text.ts; edit the TypeScript source.
import { selectedStoryHistory, importManagementInputs } from './memory-history.js';
const knownContainers = /^(?:status|state|details|decision|rp-status|rp-state|rp-decision)(?:$|[-_:])/i;
const closing = /^(\/)?\s*([a-z][\w:-]*)/i;
const voidTag = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
const inlineTag = /^(?:p|div|section|article|li|blockquote|h[1-6]|pre)$/i;
function eventFor(session, seq) {
    const events = Array.isArray(session?.events) ? session.events : Array.isArray(session?.log) ? session.log : [];
    return events.find(event => Number(event?.seq) === seq) ?? null;
}
function blockType(block) { return typeof block?.type === 'string' ? block.type.toLowerCase() : ''; }
function blockText(block) { return typeof block?.text === 'string' ? block.text : ''; }
function rawTextFor(row, event) {
    const content = event?.type === 'user/message'
        ? event.data?.content
        : event?.type === 'assistant/message' ? (event.data?.message?.content ?? event.data?.content) : undefined;
    if (!Array.isArray(content))
        return { raw: row.text, unresolved: false };
    let unresolved = false;
    const pieces = [];
    for (const block of content) {
        if (!block || typeof block !== 'object') {
            unresolved = true;
            continue;
        }
        const type = blockType(block);
        // Native providers may keep private reasoning alongside the final prose.
        // It is neither story text nor an unresolved story attachment.
        if (['reasoning', 'thinking', 'redacted_thinking', 'reasoning_content'].includes(type))
            continue;
        if (type === 'tool-call' || type === 'tool-result' || type === 'tool_use' || type === 'tool_result' || type === 'image' || type === 'file') {
            if (row.role === 'assistant')
                return { raw: '', unresolved: false };
            continue;
        }
        if (type === 'text' || type === 'input_text' || type === 'output_text')
            pieces.push(blockText(block));
        else if (blockText(block)) {
            unresolved = true;
            pieces.push(blockText(block));
        }
        else
            unresolved = true;
    }
    return { raw: pieces.join('\n'), unresolved };
}
function emit(out, spans, value, start, end) {
    if (!value)
        return;
    out.push(value);
    const previous = spans.at(-1);
    if (previous && previous.end === start)
        previous.end = end;
    else
        spans.push({ start, end });
}
/** Deterministic HTML/CSS projection. Spans are source UTF-16 intervals per output code unit. */
export function cleanStoryText(text) {
    const source = String(text ?? ''), out = [], spans = [];
    let unresolved = false, i = 0, suppressed = 0;
    const stack = [];
    while (i < source.length) {
        if (source.startsWith('```', i) && (i === 0 || source[i - 1] === '\n')) {
            const lineEnd = source.indexOf('\n', i + 3), headerEnd = lineEnd < 0 ? source.length : lineEnd;
            const marker = source.slice(i + 3, headerEnd).trim().toLowerCase();
            if (marker === 'css' || marker === 'style' || marker === 'html') {
                const close = source.indexOf('```', headerEnd + (lineEnd < 0 ? 0 : 1));
                const fenceEnd = close < 0 ? source.length : close + 3;
                const body = source.slice(headerEnd + (lineEnd < 0 ? 0 : 1), close < 0 ? source.length : close);
                if (marker !== 'html' || /(?:status|decision|details|state|\bst-card\b|<style|<script)/i.test(body)) {
                    unresolved ||= close < 0;
                    i = fenceEnd;
                    continue;
                }
            }
        }
        if (source[i] === '<') {
            const end = source.indexOf('>', i + 1);
            if (end < 0) {
                unresolved = true;
                emit(out, spans, source.slice(i), i, source.length);
                break;
            }
            const rawTag = source.slice(i + 1, end), match = rawTag.match(closing);
            if (!match) {
                unresolved = true;
                i = end + 1;
                continue;
            }
            const isClose = Boolean(match[1]), name = match[2].toLowerCase();
            if (isClose && stack.at(-1) === name && name !== 'style' && name !== 'script' && name !== 'noscript' && name !== 'template' && name !== 'svg' && name !== 'canvas') {
                while (stack.length && stack.pop() !== name) { }
                suppressed = stack.length;
                i = end + 1;
                continue;
            }
            if (name === 'style' || name === 'script' || name === 'noscript' || name === 'template' || name === 'svg' || name === 'canvas') {
                if (!isClose && !/\/\s*$/.test(rawTag)) {
                    suppressed += 1;
                    stack.push(name);
                }
                else if (isClose && stack.includes(name)) {
                    while (stack.length && stack.pop() !== name) { }
                    suppressed = stack.length;
                }
                i = end + 1;
                continue;
            }
            const classMatch = rawTag.match(/(?:class|id|data-[\w-]+)\s*=\s*["']([^"']*)/i);
            const known = knownContainers.test(name) || Boolean(classMatch && /(?:status|decision|details|state|\bst-card\b)/i.test(classMatch[1]));
            if (known) {
                if (!isClose && !/\/\s*$/.test(rawTag)) {
                    suppressed += 1;
                    stack.push(name);
                }
                else if (isClose && stack.includes(name)) {
                    while (stack.length && stack.pop() !== name) { }
                    suppressed = stack.length;
                }
                i = end + 1;
                continue;
            }
            if (suppressed > 0 && !isClose && !voidTag.test(name) && !/\/\s*$/.test(rawTag)) {
                stack.push(name);
                suppressed = stack.length;
            }
            else if (suppressed === 0 && !isClose && !inlineTag.test(name) && !voidTag.test(name) && !/^(?:em|strong|b|i|u|span|a|code|mark)$/i.test(name)) {
                unresolved = true;
                suppressed = 1;
                stack.push(name);
            }
            i = end + 1;
            continue;
        }
        const next = source.indexOf('<', i), fence = source.indexOf('```', i), nextFence = fence >= 0 && (fence === 0 || source[fence - 1] === '\n') ? fence : -1;
        const candidates = [next, nextFence].filter(value => value >= 0), end = candidates.length ? Math.min(...candidates) : source.length;
        if (suppressed === 0)
            emit(out, spans, source.slice(i, end), i, end);
        i = end;
    }
    return { text: out.join(''), spans, unresolved };
}
export function selectedRetrievalRows(session) {
    const events = Array.isArray(session?.events) ? session.events : Array.isArray(session?.log) ? session.log : [];
    const bySeq = new Map(events.map(event => [Number(event?.seq), event]));
    const selected = selectedStoryHistory(session).flatMap(row => {
        const source = rawTextFor(row, bySeq.get(row.seq) ?? null);
        if (!source.raw)
            return [];
        const cleaned = cleanStoryText(source.raw);
        if (!cleaned.text)
            return [];
        return [{ ...row, text: cleaned.text, rawText: source.raw, spans: cleaned.spans, unresolved: source.unresolved || cleaned.unresolved }];
    });
    const endedTurns = new Set(events.filter(event => event?.type === 'turn/end').map(event => Number(event.data?.turn)));
    const management = importManagementInputs(session, events);
    const visible = Array.from(session?.surface?.nodes ?? []).filter(value => Number.isSafeInteger(value)).map(Number);
    const visibleIndex = new Map(visible.map((seq, index) => [seq, index]));
    const known = new Set(selected.map(row => row.seq));
    const extra = events.filter(event => event?.type === 'user/message' && event.data?.source?.kind === 'user'
        && !known.has(event.seq) && !management.has(event.seq) && endedTurns.has(Number(event.data?.turn))
        && visibleIndex.has(event.seq)).flatMap(event => {
        const row = { id: `${session.id}:${event.seq}`, seq: event.seq, turn: Number(event.data?.turn), role: 'user',
            messageId: event.data?.id ?? null, text: '', time: event.time ?? null };
        const source = rawTextFor(row, event);
        if (!source.raw)
            return [];
        const cleaned = cleanStoryText(source.raw);
        if (!cleaned.text)
            return [];
        return [{ ...row, text: cleaned.text, rawText: source.raw, spans: cleaned.spans, unresolved: source.unresolved || cleaned.unresolved }];
    });
    for (const row of extra) {
        const at = visibleIndex.get(row.seq);
        const index = selected.findIndex(existing => (visibleIndex.get(existing.seq) ?? Number.POSITIVE_INFINITY) > at);
        if (index < 0)
            selected.push(row);
        else
            selected.splice(index, 0, row);
    }
    return selected;
}
export function projectedSourceOffset(row, index) {
    let cursor = 0;
    for (const span of row.spans) {
        const length = span.end - span.start;
        if (index < cursor + length)
            return span.start + Math.max(0, index - cursor);
        cursor += length;
    }
    return row.spans.at(-1)?.end ?? 0;
}
function bounds(value, fallback, max) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(1, Math.min(max, Math.floor(n))) : fallback;
}
function sourceOffset(row, index) { return projectedSourceOffset(row, index); }
function publicRow(row, text, spans, textOffset, truncated = undefined) {
    return { id: row.id, seq: row.seq, turn: row.turn, role: row.role, messageId: row.messageId, text, time: row.time, textOffset, ...(truncated === undefined ? {} : { truncated }) };
}
export function queryRetrievalRows(rows, sessionId, options = {}) {
    const limit = bounds(options.limit, 12, 100), budget = Math.max(256, Math.min(60000, Number(options.maxChars) || 12000));
    const before = Number.isSafeInteger(options.beforeSeq) ? Number(options.beforeSeq) : null;
    const end = before === null ? rows.length : rows.findIndex(row => row.seq === before);
    if (end < 0)
        throw new Error('历史游标不属于当前选中分支');
    const terms = String(options.query ?? '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const candidates = rows.slice(0, end).filter(row => terms.every(term => row.text.toLocaleLowerCase().includes(term)));
    const found = [];
    let used = 0;
    for (let n = candidates.length - 1; n >= 0 && found.length < limit && used < budget; n -= 1) {
        const row = candidates[n], first = terms.length ? Math.max(0, row.text.toLocaleLowerCase().indexOf(terms[0]) - 240) : 0;
        const count = Math.min(row.text.length - first, budget - used), last = first + count;
        const item = publicRow(row, row.text.slice(first, last), row.spans, sourceOffset(row, first), first > 0 || last < row.text.length);
        found.push(item);
        used += count;
    }
    found.reverse();
    return { sessionId, totalEntries: rows.length, matchedEntries: candidates.length, entries: found,
        nextBeforeSeq: candidates.length > found.length ? found[0]?.seq ?? null : null };
}
export function readRetrievalRows(rows, options = {}) {
    const seq = Number.isSafeInteger(options.seq) ? Number(options.seq) : null, row = rows.find(item => item.seq === seq);
    if (!row)
        throw new Error('历史条目不属于当前选中分支');
    const offset = Number.isSafeInteger(options.offset) ? Math.max(0, Number(options.offset)) : 0, budget = bounds(options.maxChars, 12000, 60000);
    let start = 0, cursor = 0;
    while (start < row.spans.length && row.spans[start].end <= offset) {
        cursor += row.spans[start].end - row.spans[start].start;
        start += 1;
    }
    if (start < row.spans.length && offset > row.spans[start].start)
        cursor += offset - row.spans[start].start;
    start = cursor;
    const end = Math.min(row.text.length, start + budget);
    return { ...publicRow(row, row.text.slice(start, end), row.spans, sourceOffset(row, start)), totalChars: row.text.length,
        nextOffset: end < row.text.length ? sourceOffset(row, end) : null };
}
