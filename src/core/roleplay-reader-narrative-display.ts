/** Read-only display qualification, supplied for this exact accepted message.
 * It cannot authorize a reducer or change the canonical message/history. */
export interface ReaderMvuDisplayScope {
    readonly role: 'assistant';
    readonly protocol: 'native-jsonpatch-v1' | 'native-mvu-update-v2';
    readonly acceptedRange: {readonly start: number;readonly end: number;};
}

const MVU_DISPLAY_TEXT_LIMIT = 1_048_576;
const MVU_DISPLAY_BLOCK_LIMIT = 65_536;
const MVU_DISPLAY_MARKERS = new Set(['updatevariable', 'jsonpatch', 'json_patch', 'analyze', 'analysis']);
const MVU_QUOTED_HTML = new Set(['code', 'pre', 'blockquote', 'q', 'script', 'style', 'textarea']);
const MVU_PAIRED_QUOTES: Readonly<Record<string, string>> = {
    '“': '”', '「': '」', '『': '』', '«': '»', '‹': '›',
    '„': '“', '‚': '‘', '〝': '〞',
};
const asciiLetter = (char: string | undefined) => char !== undefined
    && (char >= 'A' && char <= 'Z' || char >= 'a' && char <= 'z');
const space = (char: string | undefined) => char === ' ' || char === '\t' || char === '\r' || char === '\n';

function escapedAt(text: string, index: number): boolean {
    let slashes = 0;
    while (index > 0 && text[--index] === '\\') slashes++;
    return slashes % 2 === 1;
}

function markerAt(text: string, index: number) {
    if (text[index] !== '<') return null;
    let cursor = index + 1;
    while (space(text[cursor])) cursor++;
    if (text[cursor] === '/') cursor++;
    while (space(text[cursor])) cursor++;
    const start = cursor;
    while (asciiLetter(text[cursor]) || text[cursor] === '_') cursor++;
    const name = text.slice(start, cursor).toLowerCase();
    if (!MVU_DISPLAY_MARKERS.has(name)) return null;
    if (asciiLetter(text[cursor]) || text[cursor] === '_' || text[cursor] === '-') return null;
    // A missing or long tag is a diagnostic, never an eligible complete block.
    const tail = text.slice(cursor, Math.min(text.length, cursor + 512));
    const close = tail.indexOf('>');
    return close < 0 ? {text: '', start: index, end: cursor}
        : {text: text.slice(index, cursor + close + 1), start: index, end: cursor + close + 1};
}

/** References remain readable even if a backend parser accepted their tokens.
 * This scanner owns no DOM, evaluation, request or state-writing capability. */
function quotedMvuStart(text: string, target: number): boolean {
    const htmlQuotes: string[] = [];
    let quote = '', fence = '', fenceLength = 0, lineStart = 0, inspectedHtmlChars = 0;
    for (let cursor = 0; cursor <= target; cursor++) {
        if (cursor === lineStart) {
            const newline = text.indexOf('\n', cursor);
            const lineEnd = newline < 0 ? text.length : newline;
            let first = cursor;
            while (first < lineEnd && (text[first] === ' ' || text[first] === '\t')) first++;
            const delimiter = text[first];
            let length = 0;
            if (delimiter === '`' || delimiter === '~') {
                while (text[first + length] === delimiter) length++;
            }
            const fenceLine = first - cursor <= 3 && length >= 3;
            if (fence) {
                if (target < lineEnd) return true;
                if (fenceLine && delimiter === fence && length >= fenceLength
                    && !text.slice(first + length, lineEnd).trim()) fence = '';
                cursor = lineEnd;
                lineStart = lineEnd + 1;
                quote = '';
                continue;
            }
            if (fenceLine) {
                if (target < lineEnd) return true;
                fence = delimiter!;
                fenceLength = length;
                cursor = lineEnd;
                lineStart = lineEnd + 1;
                quote = '';
                continue;
            }
            if (target < lineEnd && (text[first] === '>' || first - cursor >= 4)) return true;
        }
        if (cursor === target) return htmlQuotes.length > 0 || !!quote || escapedAt(text, cursor);
        const char = text[cursor];
        if (char === '\n') {lineStart = cursor + 1;quote = '';continue;}
        if (char === '`' && !escapedAt(text, cursor)) {
            let count = 1;
            while (text[cursor + count] === '`') count++;
            const delimiter = '`'.repeat(count), close = text.indexOf(delimiter, cursor + count);
            if (close < 0 || target < close + count) return true;
            const newline = text.slice(cursor, close + count).lastIndexOf('\n');
            if (newline >= 0) lineStart = cursor + newline + 1;
            cursor = close + count - 1;
            continue;
        }
        if (text.startsWith('<!--', cursor)) {
            const close = text.indexOf('-->', cursor + 4);
            if (close < 0 || target < close + 3) return true;
            const newline = text.slice(cursor, close + 3).lastIndexOf('\n');
            if (newline >= 0) lineStart = cursor + newline + 1;
            cursor = close + 2;
            continue;
        }
        if (char === '<') {
            const initial = text[cursor + 1] === '/' ? text[cursor + 2] : text[cursor + 1];
            if (!asciiLetter(initial)) continue;
            const token = text.slice(cursor, Math.min(text.length, cursor + 512));
            let at = 1, closing = false;
            if (token[at] === '/') {closing = true;at++;}
            const start = at;
            while (asciiLetter(token[at])) at++;
            const name = token.slice(start, at).toLowerCase();
            let attributeQuote = '';
            while (at < token.length) {
                const value = token[at];
                if (attributeQuote) {
                    if (value === attributeQuote) attributeQuote = '';
                } else if (value === '"' || value === "'") attributeQuote = value;
                else if (value === '>') break;
                at++;
            }
            inspectedHtmlChars += at;
            if (inspectedHtmlChars > MVU_DISPLAY_TEXT_LIMIT * 2) return true;
            if (name && token[at] === '>') {
                if (target <= cursor + at) return true;
                if (MVU_QUOTED_HTML.has(name)) {
                    if (!closing && token[at - 1] !== '/') htmlQuotes.push(name);
                    else if (closing && htmlQuotes.at(-1) === name) htmlQuotes.pop();
                }
                const newline = token.slice(0, at + 1).lastIndexOf('\n');
                if (newline >= 0) lineStart = cursor + newline + 1;
                cursor += at;
                continue;
            }
        }
        if (quote) {
            if (char === quote && !escapedAt(text, cursor)) quote = '';
        } else {
            const closingQuote = char === '"' || char === "'" ? char
                : MVU_PAIRED_QUOTES[char ?? ''] ?? '';
            if (closingQuote && !escapedAt(text, cursor)) quote = closingQuote;
        }
    }
    return true;
}

/** Hide only an exact, uniquely wrapped block already accepted by the owning
 * backend for this message. Semantic acceptance is not recreated in the UI:
 * JSONPatch/legacy values, schema and reducer facts remain backend-owned. */
export function projectReaderNarrativeDisplay(raw: unknown, scope?: ReaderMvuDisplayScope): string {
    const text = String(raw ?? '');
    if (!scope || scope.role !== 'assistant' || !['native-jsonpatch-v1', 'native-mvu-update-v2'].includes(scope.protocol)
        || typeof raw !== 'string' || text.length > MVU_DISPLAY_TEXT_LIMIT) return text;
    if (!scope.acceptedRange) return text;
    const {start, end} = scope.acceptedRange;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > text.length
        || end - start > MVU_DISPLAY_BLOCK_LIMIT) return text;
    const tags = [];
    for (let cursor = text.indexOf('<'); cursor >= 0; cursor = text.indexOf('<', cursor + 1)) {
        const tag = markerAt(text, cursor);
        if (tag) tags.push(tag);
        if (tags.length > 6) return text;
    }
    const first = tags[0], last = tags.at(-1);
    if (!first || !last || first.text !== '<UpdateVariable>' || last.text !== '</UpdateVariable>'
        || first.start !== start || last.end !== end || quotedMvuStart(text, start)) return text;
    const block = text.slice(start, end);
    if (new TextEncoder().encode(block).length > MVU_DISPLAY_BLOCK_LIMIT) return text;
    let body = text.slice(first.end, last.start).trim(), inner = tags.slice(1, -1);
    if (body.startsWith('<Analyze>')) {
        if (inner[0]?.text !== '<Analyze>' || inner[1]?.text !== '</Analyze>') return text;
        const analysis = text.slice(inner[0].end, inner[1].start);
        for (let at = analysis.indexOf('<'); at >= 0; at = analysis.indexOf('<', at + 1)) {
            if (asciiLetter(analysis[at + 1]) || analysis[at + 1] === '/' && asciiLetter(analysis[at + 2])) return text;
        }
        body = text.slice(inner[1].end, last.start).trim();
        inner = inner.slice(2);
    }
    if (body.startsWith('<JSONPatch>')) {
        if (inner.length !== 2 || inner[0]?.text !== '<JSONPatch>' || inner[1]?.text !== '</JSONPatch>'
            || body !== text.slice(inner[0].start, inner[1].end)) return text;
        const payload = text.slice(inner[0].end, inner[1].start).trim();
        if (!payload.startsWith('[') || !payload.endsWith(']')) return text;
    } else {
        if (scope.protocol !== 'native-mvu-update-v2' || inner.length) return text;
        while (body.startsWith('//')) {
            const newline = body.indexOf('\n');
            if (newline < 0) return text;
            body = body.slice(newline + 1).trimStart();
        }
        const commands = ['set', 'add', 'assign', 'insert', 'remove', 'unset', 'delete'];
        if (!commands.some(name => body.startsWith(`_.${name}(`)) || !body.endsWith(';')) return text;
    }
    return text.slice(0, start) + text.slice(end);
}
