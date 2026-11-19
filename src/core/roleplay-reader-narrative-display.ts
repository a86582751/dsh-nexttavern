import {scanUpdateMarkup,findUpdateMarkupBlocks} from './tavern-mvu-196/structured-update.js';
import type {MvuDisplayProtocol} from './roleplay-mvu-display-facts.js';

/** Read-only display qualification, supplied for this exact accepted message.
 * It cannot authorize a reducer or change the canonical message/history. */
interface ReaderMvuDisplayRange {readonly start: number;readonly end: number;}
export type ReaderMvuDisplayScope = {
    readonly role: 'assistant';
    readonly protocol: 'native-jsonpatch-v1' | 'native-mvu-update-v2';
    readonly acceptedRange: ReaderMvuDisplayRange;
} | {
    readonly role: 'assistant';
    readonly protocol: 'mvu-196-d03';
    readonly acceptedRanges: readonly ReaderMvuDisplayRange[];
};

export const MVU196_STATUS_PLACEHOLDER = '<StatusPlaceHolderImpl/>';

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
function unquotedMvuStarts(text: string, targets: readonly number[]): ReadonlySet<number> {
    const unquoted = new Set<number>();
    const htmlQuotes: string[] = [];
    let targetIndex = 0, quote = '', fence = '', fenceLength = 0, lineStart = 0, inspectedHtmlChars = 0;
    let quotedLine = false;
    const skipThrough = (end: number) => {
        while (targetIndex < targets.length && targets[targetIndex]! < end) targetIndex++;
    };
    for (let cursor = 0; cursor < text.length && targetIndex < targets.length; cursor++) {
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
                skipThrough(lineEnd);
                if (fenceLine && delimiter === fence && length >= fenceLength
                    && !text.slice(first + length, lineEnd).trim()) fence = '';
                cursor = lineEnd;
                lineStart = lineEnd + 1;
                quote = '';
                continue;
            }
            if (fenceLine) {
                skipThrough(lineEnd);
                fence = delimiter!;
                fenceLength = length;
                cursor = lineEnd;
                lineStart = lineEnd + 1;
                quote = '';
                continue;
            }
            quotedLine = text[first] === '>' || first - cursor >= 4;
        }
        if (cursor === targets[targetIndex]) {
            if (!quotedLine && !htmlQuotes.length && !quote && !escapedAt(text, cursor)) unquoted.add(cursor);
            targetIndex++;
        }
        const char = text[cursor];
        if (char === '\n') {lineStart = cursor + 1;quote = '';continue;}
        if (char === '`' && !escapedAt(text, cursor)) {
            let count = 1;
            while (text[cursor + count] === '`') count++;
            const delimiter = '`'.repeat(count), close = text.indexOf(delimiter, cursor + count);
            if (close < 0) break;
            skipThrough(close + count);
            const newline = text.slice(cursor, close + count).lastIndexOf('\n');
            if (newline >= 0) {lineStart = cursor + newline + 1;quotedLine = false;}
            cursor = close + count - 1;
            continue;
        }
        if (text.startsWith('<!--', cursor)) {
            const close = text.indexOf('-->', cursor + 4);
            if (close < 0) break;
            skipThrough(close + 3);
            const newline = text.slice(cursor, close + 3).lastIndexOf('\n');
            if (newline >= 0) {lineStart = cursor + newline + 1;quotedLine = false;}
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
            if (inspectedHtmlChars > MVU_DISPLAY_TEXT_LIMIT * 2) break;
            if (name && token[at] === '>') {
                skipThrough(cursor + at + 1);
                if (MVU_QUOTED_HTML.has(name)) {
                    if (!closing && token[at - 1] !== '/') htmlQuotes.push(name);
                    else if (closing && htmlQuotes.at(-1) === name) htmlQuotes.pop();
                }
                const newline = token.slice(0, at + 1).lastIndexOf('\n');
                if (newline >= 0) {lineStart = cursor + newline + 1;quotedLine = false;}
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
    return unquoted;
}

function mvu196DisplayRanges(text: string, mode: 'accepted' | 'stream' | 'complete' = 'accepted'): readonly ReaderMvuDisplayRange[] {
    if (text.length > MVU_DISPLAY_TEXT_LIMIT) return [];
    const placeholders = mode === 'complete' ? Array.from(text.matchAll(/<StatusPlaceHolderImpl\s*\/>/gi),
        match => ({start:match.index,end:match.index+match[0].length})) : [];
    if (!/<\s*(?:updatevariable|variableupdate|update|json_?patch)\b/i.test(text)) {
        if (!placeholders.length) return [];
        const unquoted = unquotedMvuStarts(text, placeholders.map(block => block.start));
        return placeholders.filter(block => unquoted.has(block.start));
    }
    const scanned = scanUpdateMarkup(text);
    const blocks = [
        ...findUpdateMarkupBlocks(text, 'update', scanned)
            .filter(block => mode !== 'stream' ? block.closed
                : /^(?:\s|\uFEFF)*(?:<\s*(?:analy[sz]e|analysis|json_?patch)\b|\[|_\.|$)/i
                    .test(text.slice(block.contentStart, block.contentEnd))),
        ...findUpdateMarkupBlocks(text, 'patch', scanned)
            .filter(block => !block.discarded && (mode !== 'stream' ? block.closed
                : /^\s*(?:\[|$)/.test(text.slice(block.contentStart, block.contentEnd)))),
        ...placeholders,
    ]
        .sort((left, right) => left.start - right.start || right.end - left.end);
    // The fixed scanner masks data strings without changing UTF-16 offsets.
    // Reader reference protection then visits all block starts in one pass.
    const unquoted = unquotedMvuStarts(scanned.structural, blocks.map(block => block.start));
    const ranges: ReaderMvuDisplayRange[] = [];
    let protectedThrough = 0;
    for (const block of blocks) {
        // An escaped wrapper quotes its complete payload, including nested
        // patch tags whose own opening is not individually backslash-escaped.
        if (block.start < protectedThrough) continue;
        if (!unquoted.has(block.start)) {protectedThrough = block.end;continue;}
        const previous = ranges.at(-1);
        if (previous && block.start <= previous.end) {
            if (block.end > previous.end) ranges[ranges.length - 1] = {start: previous.start, end: block.end};
        } else ranges.push({start: block.start, end: block.end});
    }
    return ranges;
}

/** Callers bind the accepted canonical body before deriving this display data.
 * Rewritten display text receives only exact original block bytes at its own
 * scanner offsets; canonical offsets never address a different string. */
export function createReaderMvuDisplayScope(canonicalText: string, protocol: MvuDisplayProtocol,
    displayText = canonicalText): ReaderMvuDisplayScope | undefined {
    if (displayText.length > MVU_DISPLAY_TEXT_LIMIT) return;
    if (protocol === 'mvu-196-d03') {
        if (canonicalText.length > MVU_DISPLAY_TEXT_LIMIT) return;
        const canonicalRanges = mvu196DisplayRanges(canonicalText);
        let acceptedRanges = canonicalRanges;
        if (displayText !== canonicalText) {
            const remaining = new Map<string, number>();
            for (const range of canonicalRanges) {
                const block = canonicalText.slice(range.start, range.end);
                remaining.set(block, (remaining.get(block) ?? 0) + 1);
            }
            acceptedRanges = mvu196DisplayRanges(displayText).filter(range => {
                const block = displayText.slice(range.start, range.end), count = remaining.get(block) ?? 0;
                if (!count) return false;
                remaining.set(block, count - 1);
                return true;
            });
        }
        if (!acceptedRanges.length) return;
        return {role: 'assistant', protocol, acceptedRanges};
    }
    if (protocol !== 'native-jsonpatch-v1' && protocol !== 'native-mvu-update-v2') return;
    const start = canonicalText.indexOf('<UpdateVariable>'), close = canonicalText.indexOf('</UpdateVariable>');
    if (start < 0 || close < start) return;
    const block = canonicalText.slice(start, close + '</UpdateVariable>'.length), displayStart = displayText.indexOf(block);
    if (displayStart < 0) return;
    return {role: 'assistant', protocol, acceptedRange: {start: displayStart, end: displayStart + block.length}};
}

/** During the schema Story handoff the Reader can separate recognizable
 * transport before the outcome arrives. Native retains the complete body. */
export function projectPendingReaderUpdates(text:string):string {
    const acceptedRanges=mvu196DisplayRanges(text,'stream');
    if (!acceptedRanges.length) return text;
    return projectReaderNarrativeDisplay(text,{role:'assistant',protocol:'mvu-196-d03',acceptedRanges});
}

/** Complete transport and UI placeholders, with offsets in the source prose. */
export function storyProseOmissions(text: string): readonly ReaderMvuDisplayRange[] {
    return mvu196DisplayRanges(text, 'complete');
}

/** An unresolved terminal exposes its authored update as inspectable text.
 * Structural markup locates the payload without accepting or executing it. */
export function projectUnsettledReaderUpdates(text:string,code:string):{narrative:string;details:string} {
    const ranges=mvu196DisplayRanges(text,'stream');
    const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
        .replaceAll('"','&quot;').replaceAll("'",'&#39;');
    const narrative:string[]=[],details:string[]=[];
    let cursor=0;
    for(const range of ranges) {
        narrative.push(text.slice(cursor,range.start));
        details.push('<details><summary>数值更新未结算 · <code>'+escape(code)+'</code></summary><pre>'
            +escape(text.slice(range.start,range.end))+'</pre></details>');
        cursor=range.end;
    }
    narrative.push(text.slice(cursor));
    return {narrative:narrative.join(''),details:details.join('')};
}

/** Project ranges from this message's accepted display data. Legacy scopes
 * retain their uniquely wrapped block contract. Semantic acceptance and all
 * state updates remain with the owning backend. */
export function projectReaderNarrativeDisplay(raw: unknown, scope?: ReaderMvuDisplayScope): string {
    const text = String(raw ?? '');
    if (!scope || scope.role !== 'assistant'
        || typeof raw !== 'string' || text.length > MVU_DISPLAY_TEXT_LIMIT) return text;
    if (scope.protocol === 'mvu-196-d03') {
        if (!Array.isArray(scope.acceptedRanges)) return text;
        const parts: string[] = [];
        let cursor = 0;
        for (const range of scope.acceptedRanges) {
            if (!range || !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end)
                || range.start < cursor || range.end <= range.start || range.end > text.length) return text;
            parts.push(text.slice(cursor, range.start));
            cursor = range.end;
        }
        parts.push(text.slice(cursor));
        return parts.join('');
    }
    if (scope.protocol !== 'native-jsonpatch-v1' && scope.protocol !== 'native-mvu-update-v2') return text;
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
        || first.start !== start || last.end !== end || !unquotedMvuStarts(text, [start]).has(start)) return text;
    const block = text.slice(start, end);
    if (new TextEncoder().encode(block).length > MVU_DISPLAY_BLOCK_LIMIT) return text;
    let body = text.slice(first.end, last.start).trim(), inner = tags.slice(1, -1);
    const analysisTag = ['Analyze', 'analysis', 'Analysis'].find(name => body.startsWith(`<${name}>`));
    if (analysisTag) {
        if (inner[0]?.text !== `<${analysisTag}>` || inner[1]?.text !== `</${analysisTag}>`) return text;
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


