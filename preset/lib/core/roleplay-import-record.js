// Generated from runtime/alpha3/src/core/roleplay-import-record.ts; edit the TypeScript source.
// Frozen import evidence and source-span validation. No table writes, workflow
// state or import locks live here; validation remains usable by export/readback.
import { sha256, cloneRecord } from './roleplay-data.js';
import { readCardSource, decodeTavernCard, projectTavernCard } from './tavern-card.js';
export const IMPORT_NORMALIZER = 'utf8-lf+anydoc-deescape-v2';
const IMPORT_SOURCE_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.png', '.json']);
// Hard limits protect the storage domain and the synchronous line/span
// coverage pass from a malformed or adversarial tool payload.  These are
// deliberately generous for long-form RP cards and reject rather than
// silently truncate author material.
export const IMPORT_LIMITS = Object.freeze({
    maxBytes: 20000000,
    maxChars: 5000000,
    maxLines: 1000000,
    maxAssignments: 4096,
    maxSpansPerAssignment: 256,
    maxTotalSpans: 16384,
    maxNameChars: 512,
    maxMetadataChars: 16384,
    maxListItems: 256,
    maxListItemChars: 512,
    maxTotalMetadataChars: 2000000,
    maxTotalListItems: 16384,
    maxReferencedChars: 40000000,
});
export const resolveImportSource = (session, requestedPath) => {
    const cwd = String(session?.header?.cwd ?? '').trim();
    if (!cwd)
        throw new Error('当前会话缺少 cwd，无法验证角色卡来源路径');
    const source = readCardSource(cwd, requestedPath);
    if (!IMPORT_SOURCE_EXTENSIONS.has(source.extension))
        throw new Error('source_file 必须是 .md/.markdown/.txt 或酒馆 .png/.json 文件');
    return source;
};
const computeLineStarts = (normalizedSource) => {
    const starts = [0];
    for (let index = 0; index < normalizedSource.length; index++) {
        if (normalizedSource.charCodeAt(index) === 10 && index + 1 < normalizedSource.length)
            starts.push(index + 1);
    }
    return starts;
};
const lineStartsOf = (record) => {
    if (Array.isArray(record.lineStarts) && record.lineStarts.length === record.lineCount)
        return record.lineStarts;
    return computeLineStarts(String(record.normalizedSource ?? ''));
};
export const assertImportRecordIntegrity = (record) => {
    if (!record || typeof record !== 'object')
        throw new Error('导入记录损坏或不存在');
    const structured = record.schemaVersion === 4 && record.normalizer === 'tavern-fields-v1';
    if (!structured && (record.schemaVersion !== 3 || record.normalizer !== IMPORT_NORMALIZER)) {
        throw new Error('导入记录版本或规范化器不匹配；请从不可变 raw source 重新 begin');
    }
    const normalizedSource = record.normalizedSource;
    if (typeof normalizedSource !== 'string' || !normalizedSource.length)
        throw new Error('导入记录缺少规范化原文');
    if (normalizedSource.length > IMPORT_LIMITS.maxChars)
        throw new Error('导入原文超过字符上限');
    const expectedLines = normalizedSource.split('\n');
    if (normalizedSource.endsWith('\n'))
        expectedLines.pop();
    const expectedLineCount = expectedLines.length;
    if (!Number.isSafeInteger(record.lineCount) || record.lineCount !== expectedLineCount || record.lineCount < 1
        || record.lineCount > IMPORT_LIMITS.maxLines) {
        throw new Error('导入记录行数元数据不一致');
    }
    if (sha256(normalizedSource) !== String(record.normalizedSha256 ?? ''))
        throw new Error('归档原文 SHA-256 校验失败');
    if (!structured && record.rawSource !== undefined && typeof record.rawSource === 'string' && record.rawSha256 !== undefined
        && sha256(record.rawSource) !== String(record.rawSha256))
        throw new Error('原始来源 SHA-256 校验失败');
    if (typeof record.rawSource !== 'string'
        || Number(record.rawChars) !== record.rawSource.length
        || (!structured && Number(record.sourceBytes) !== Buffer.byteLength(record.rawSource, 'utf8'))
        || Number(record.normalizedChars) !== normalizedSource.length) {
        throw new Error('导入记录字符数或字节数元数据不一致');
    }
    if (structured) {
        const envelope = record.sourceEnvelope;
        if (envelope?.schemaVersion !== 1 || typeof envelope.base64 !== 'string' || envelope.base64.length > 27000000)
            throw new Error('结构化原件归档无效');
        const bytes = Buffer.from(envelope.base64, 'base64');
        if (bytes.toString('base64') !== envelope.base64 || bytes.length !== record.sourceBytes || sha256(bytes) !== record.rawSha256)
            throw new Error('结构化原件哈希或大小校验失败');
        const decoded = decodeTavernCard(bytes, envelope.extension);
        if (decoded.format !== envelope.format || decoded.sourceSha256 !== envelope.sourceSha256 || record.rawSha256 !== envelope.sourceSha256)
            throw new Error('结构化原件格式或来源证据不一致');
        if (JSON.stringify(decoded.document, null, 2) !== record.rawSource || projectTavernCard(decoded).text !== normalizedSource)
            throw new Error('结构化原件与投影不一致');
    }
    const expectedStarts = computeLineStarts(normalizedSource);
    if (!Array.isArray(record.lineStarts) || record.lineStarts.length !== expectedStarts.length
        || record.lineStarts.some((value, index) => Number(value) !== expectedStarts[index])) {
        throw new Error('导入记录行起始偏移元数据不一致');
    }
    if (!Array.isArray(record.lines) || record.lines.length !== expectedLineCount)
        throw new Error('导入记录行内容元数据不一致');
    if (record.lines.some((line, index) => line !== expectedLines[index]))
        throw new Error('导入记录行内容与规范化原文不一致');
    return true;
};
export const assertAssignmentBudget = (assignments) => {
    if (!Array.isArray(assignments) || assignments.length > IMPORT_LIMITS.maxAssignments) {
        throw new Error(`assignment 数量超过上限 ${IMPORT_LIMITS.maxAssignments}`);
    }
    let totalSpans = 0;
    let totalMetadataChars = 0;
    let totalListItems = 0;
    for (const [index, assignment] of assignments.entries()) {
        if (!assignment || typeof assignment !== 'object')
            throw new Error(`assignment ${index + 1} 不是对象`);
        const spans = assignment.sourceSpans;
        if (!Array.isArray(spans) || spans.length === 0 || spans.length > IMPORT_LIMITS.maxSpansPerAssignment) {
            throw new Error(`assignment ${index + 1} 的 sourceSpans 数量无效（上限 ${IMPORT_LIMITS.maxSpansPerAssignment}）`);
        }
        totalSpans += spans.length;
        if (totalSpans > IMPORT_LIMITS.maxTotalSpans)
            throw new Error(`sourceSpans 总数超过上限 ${IMPORT_LIMITS.maxTotalSpans}`);
        for (const field of ['id', 'name', 'kind', 'merge_group', 'reuse_reason']) {
            const limit = field === 'name' || field === 'id' || field === 'kind'
                ? IMPORT_LIMITS.maxNameChars
                : IMPORT_LIMITS.maxMetadataChars;
            if (assignment[field] !== undefined && String(assignment[field]).length > limit) {
                throw new Error(`assignment ${index + 1} 的 ${field} 过长`);
            }
            totalMetadataChars += assignment[field] === undefined ? 0 : String(assignment[field]).length;
        }
        for (const field of ['aliases', 'keywords', 'triggers']) {
            if (assignment[field] !== undefined) {
                if (!Array.isArray(assignment[field]) || assignment[field].length > IMPORT_LIMITS.maxListItems) {
                    throw new Error(`assignment ${index + 1} 的 ${field} 数量超过上限`);
                }
                if (assignment[field].some((value) => String(value).length > IMPORT_LIMITS.maxListItemChars)) {
                    throw new Error(`assignment ${index + 1} 的 ${field} 项过长`);
                }
                totalListItems += assignment[field].length;
                totalMetadataChars += assignment[field].reduce((sum, value) => sum + String(value).length, 0);
            }
        }
        if (totalListItems > IMPORT_LIMITS.maxTotalListItems) {
            throw new Error(`assignment 列表项总数超过上限 ${IMPORT_LIMITS.maxTotalListItems}`);
        }
        if (totalMetadataChars > IMPORT_LIMITS.maxTotalMetadataChars) {
            throw new Error(`assignment 元数据总字符数超过上限 ${IMPORT_LIMITS.maxTotalMetadataChars}`);
        }
    }
    return true;
};
export const assertReviewProof = (record) => {
    if (record.reviewComplete !== true || record.nextReadCursor !== null) {
        throw new Error(`全文尚未连续审阅完成；下一块 cursor=${record.nextReadCursor}`);
    }
    const ranges = Array.isArray(record.readRanges) ? record.readRanges : [];
    if (!ranges.length)
        throw new Error('全文审阅证明缺失');
    if (ranges.length > Math.ceil(record.lineCount / 20))
        throw new Error('全文审阅证明范围数量异常');
    let next = 1;
    for (const range of ranges) {
        const start = Number(range?.startLine);
        const end = Number(range?.endLine);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
            || start !== next || end < start || end > record.lineCount
            || String(range?.sourceSha256 ?? '') !== String(record.normalizedSha256)) {
            throw new Error('全文审阅证明不连续或来源哈希不一致');
        }
        next = end + 1;
    }
    if (next !== record.lineCount + 1)
        throw new Error('全文审阅证明未覆盖至文件末尾');
    return true;
};
const normalizeSourceSpan = (span, lineCount) => {
    const startLine = Number(span?.startLine);
    const endLine = Number(span?.endLine);
    if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || startLine < 1 || endLine < startLine || endLine > lineCount) {
        throw new Error(`非法 sourceSpan: ${String(span?.startLine)}-${String(span?.endLine)}（有效行号 1-${lineCount}）`);
    }
    return {
        startLine, endLine
    };
};
export const normalizeSourceSpans = (spans, lineCount) => {
    const normalized = (spans ?? [])
        .map((span) => normalizeSourceSpan(span, lineCount))
        .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine);
    for (let index = 1; index < normalized.length; index++) {
        if (normalized[index].startLine <= normalized[index - 1].endLine) {
            throw new Error(`同一 assignment 内 sourceSpans 重叠：${normalized[index - 1].startLine}-${normalized[index - 1].endLine} 与 ${normalized[index].startLine}-${normalized[index].endLine}`);
        }
    }
    return normalized;
};
const spanFragments = (record, spans) => {
    const starts = lineStartsOf(record);
    return spans.map((span) => {
        const startOffset = starts[span.startLine - 1];
        const endOffset = span.endLine < record.lineCount ? starts[span.endLine] : record.normalizedSource.length;
        const text = record.normalizedSource.slice(startOffset, endOffset);
        return {
            startLine: span.startLine,
            endLine: span.endLine,
            startOffset,
            endOffset,
            chars: text.length,
            sha256: sha256(text),
            text,
        };
    });
};
// Concatenate exact source fragments without inventing separator text. Each
// non-final line fragment already owns its terminating LF.
export const spanText = (record, spans) => spanFragments(record, spans).map((fragment) => fragment.text).join('');
export const assertReferenceBudget = (record, assignments) => {
    const starts = lineStartsOf(record);
    let referencedChars = 0;
    for (const assignment of assignments) {
        for (const rawSpan of assignment.sourceSpans ?? []) {
            const span = normalizeSourceSpan(rawSpan, record.lineCount);
            const startOffset = starts[span.startLine - 1];
            const endOffset = span.endLine < record.lineCount ? starts[span.endLine] : record.normalizedSource.length;
            referencedChars += endOffset - startOffset;
            if (referencedChars > IMPORT_LIMITS.maxReferencedChars) {
                throw new Error(`sourceSpans 引用正文总量超过上限 ${IMPORT_LIMITS.maxReferencedChars} 字符（含 secondary 复用）`);
            }
        }
    }
    return referencedChars;
};
export const sourceDescriptor = (record, assignment) => ({
    schemaVersion: 1,
    importId: record.importId,
    target: assignment.target,
    sourceSpans: cloneRecord(assignment.sourceSpans),
    fragments: spanFragments(record, assignment.sourceSpans).map(({ text: _text, ...fragment }) => fragment),
    sourceSha256: assignment.sourceSha256,
    normalizedSourceSha256: record.normalizedSha256,
    ...(record.sourceEnvelope ? {
        originalSourceSha256: record.rawSha256, format: record.sourceEnvelope.format
    } : {}),
    exactCopy: true,
    secondary: assignment.secondary === true,
    ...(assignment.reuse_reason ? {
        reuseReason: assignment.reuse_reason
    } : {}),
});
const rangesOf = (lines) => {
    const ranges = [];
    for (const line of lines) {
        const last = ranges.at(-1);
        if (last && last.endLine + 1 === line)
            last.endLine = line;
        else
            ranges.push({
                startLine: line, endLine: line
            });
    }
    return ranges;
};
export const importCoverage = (record, assignments = record.assignments ?? []) => {
    if (!record || typeof record.normalizedSource !== 'string'
        || !Number.isSafeInteger(record.lineCount)
        || record.lineCount < 1 || record.lineCount > IMPORT_LIMITS.maxLines
        || record.normalizedSource.length > IMPORT_LIMITS.maxChars) {
        throw new Error('导入记录超出覆盖率计算边界');
    }
    assertAssignmentBudget(assignments);
    // A Map<line, Set<assignment>> made deliberately overlapping spans
    // O(assignments * lines) and could freeze the single Node event loop.  A
    // difference array preserves the exact same ownership semantics in
    // O(lines + spans), with bounded memory from maxLines.
    const ownershipDelta = new Int32Array(record.lineCount + 2);
    for (const assignment of assignments) {
        if (assignment.secondary === true)
            continue;
        for (const rawSpan of assignment.sourceSpans ?? []) {
            const span = normalizeSourceSpan(rawSpan, record.lineCount);
            ownershipDelta[span.startLine] += 1;
            ownershipDelta[span.endLine + 1] -= 1;
        }
    }
    const starts = lineStartsOf(record);
    const lineChars = (line) => {
        const startOffset = starts[line - 1];
        const endOffset = line < record.lineCount ? starts[line] : record.normalizedSource.length;
        return endOffset - startOffset;
    };
    const uncovered = [];
    const overlaps = [];
    const totalChars = record.normalizedSource.length;
    let coveredChars = 0;
    let ownership = 0;
    for (let line = 1; line <= record.lineCount; line++) {
        ownership += ownershipDelta[line];
        if (ownership === 0)
            uncovered.push(line);
        else if (ownership > 1)
            overlaps.push(line);
        else
            coveredChars += lineChars(line);
    }
    return {
        sourceLines: record.lineCount,
        coveredLines: record.lineCount - uncovered.length - overlaps.length,
        sourceChars: totalChars,
        coveredChars,
        coverage: totalChars === 0 ? 1 : coveredChars / totalChars,
        uncovered,
        overlaps,
        uncoveredRanges: rangesOf(uncovered),
        overlapRanges: rangesOf(overlaps),
    };
};
const assignmentIdentity = (assignment) => {
    if (assignment.target === 'card')
        return `card:${assignment.kind === 'user' ? 'user' : assignment.id}`;
    if (assignment.target === 'worldbook')
        return `worldbook:${assignment.id}`;
    return null;
};
export const validateAssignmentIdentities = (assignments) => {
    const seen = new Map();
    for (const assignment of assignments) {
        const identity = assignmentIdentity(assignment);
        if (!identity)
            continue;
        const previous = seen.get(identity);
        if (!previous) {
            seen.set(identity, assignment);
            continue;
        }
        const mergeGroup = String(assignment.merge_group ?? '');
        if (!mergeGroup || mergeGroup !== String(previous.merge_group ?? '')) {
            throw new Error(`重复导入目标 ${identity}；请把离散范围合并到同一 assignment.sourceSpans，或为确需合并的条目设置相同 merge_group`);
        }
    }
};
export const importSummary = (record) => {
    assertImportRecordIntegrity(record);
    const coverage = importCoverage(record);
    return {
        importId: record.importId,
        sourceFile: record.sourceFile,
        mode: record.mode ?? 'replace',
        status: record.status,
        rawSha256: record.rawSha256,
        normalizedSha256: record.normalizedSha256,
        rawChars: record.rawChars,
        normalizedChars: record.normalizedChars,
        lineCount: record.lineCount,
        reviewComplete: record.reviewComplete === true,
        nextReadCursor: record.nextReadCursor ?? null,
        assignmentCount: (record.assignments ?? []).length,
        coverage: coverage.coverage,
        coveredLines: coverage.coveredLines,
        sourceLines: coverage.sourceLines,
        coveredChars: coverage.coveredChars,
        sourceChars: coverage.sourceChars,
        createdAt: record.createdAt,
        activatedAt: record.activatedAt ?? null,
        ...(record.sourceEnvelope
            ? {
                format: record.sourceEnvelope.format, suggestedMapping: true,
                warnings: record.sourceEnvelope.warnings
            } : {}),
    };
};
