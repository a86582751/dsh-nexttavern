// Generated from runtime/alpha3/src/core/roleplay-opening-selection.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { compileTavernOpeningCandidates, decodeTavernCard } from './tavern-card.js';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const validHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const samePointer = (a, b) => a.importId === b.importId
    && a.sourceRecordSessionId === b.sourceRecordSessionId && a.normalizedSha256 === b.normalizedSha256
    && a.transactionId === b.transactionId && a.coverageSha256 === b.coverageSha256;
export function openingIntentKey(sessionId, importId) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId) || !/^[a-zA-Z0-9_-]{1,64}$/.test(importId))
        throw new Error('无效的 session/import id');
    return `${sessionId}__opening-choice-${importId}`;
}
export function createRoleplayOpeningSelection(deps) {
    const readCatalog = (sessionId, context = {}) => {
        const pointer = deps.table.get(deps.importActiveKey(sessionId));
        if (!pointer?.importId || !validHash(pointer.normalizedSha256) || !validHash(pointer.coverageSha256)
            || !pointer.transactionId)
            throw new Error('没有完整的 active import pointer');
        const sourceRecordSessionId = pointer.sourceRecordSessionId ?? sessionId;
        const record = deps.table.get(deps.importRecordKey(sourceRecordSessionId, pointer.importId));
        if (!record || record.status !== 'active' || record.importId !== pointer.importId
            || record.normalizedSha256 !== pointer.normalizedSha256 || !record.activation
            || record.activation.transactionId !== pointer.transactionId || !validHash(record.rawSha256)
            || !record.sourceEnvelope || record.sourceEnvelope.sourceSha256 !== record.rawSha256)
            throw new Error('active import record 与 pointer 不匹配');
        const envelope = record.sourceEnvelope;
        const bytes = Buffer.from(envelope.base64, 'base64');
        if (bytes.toString('base64') !== envelope.base64 || hash(bytes) !== record.rawSha256)
            throw new Error('sourceEnvelope 原件校验失败');
        const decoded = decodeTavernCard(bytes, envelope.extension);
        const source = { sessionId, importId: pointer.importId, sourceRecordSessionId,
            rawSha256: record.rawSha256, normalizedSha256: record.normalizedSha256,
            transactionId: pointer.transactionId, coverageSha256: pointer.coverageSha256, pointer: { ...pointer } };
        return { source, candidates: compileTavernOpeningCandidates(decoded, context) };
    };
    const current = (source) => {
        const pointer = deps.table.get(deps.importActiveKey(source.sessionId));
        return !!pointer && samePointer(pointer, source.pointer);
    };
    const complete = async (key, intent, turn) => {
        if (!Number.isSafeInteger(turn) || turn < 0)
            throw new Error('原生开场缺少 durable turn');
        const next = { ...intent, status: 'completed', revision: intent.revision + 1, committedTurn: turn };
        await deps.table.put(key, next);
        return next;
    };
    const append = async (key, intent) => {
        let result;
        try {
            result = await deps.appendOpening({ sessionId: intent.sessionId, operationId: intent.operationId,
                messageId: intent.messageId, source: intent.source, text: intent.renderedText });
        }
        catch {
            result = { kind: 'unknown' };
        }
        if (result.kind === 'committed') {
            if (result.messageId !== intent.messageId)
                throw new Error('原生开场 messageId 回执不匹配');
            return complete(key, intent, result.turn);
        }
        const next = { ...intent, status: result.kind, revision: intent.revision + 1 };
        await deps.table.put(key, next);
        return { status: 'busy', intent: next };
    };
    const select = (sessionId, index, operationId, context = {}) => deps.withLock(`opening-choice:${sessionId}`, async () => {
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(operationId))
            throw new Error('无效的 operationId');
        const catalog = readCatalog(sessionId, context);
        if (!current(catalog.source))
            throw new Error('active import pointer 已失效');
        const candidate = catalog.candidates.find(item => item.index === index);
        if (!candidate)
            throw new Error('开场候选不存在');
        const key = openingIntentKey(sessionId, catalog.source.importId);
        const previous = deps.table.get(key);
        if (previous) {
            if (previous.schemaVersion !== 2 || previous.sessionId !== sessionId
                || !validHash(previous.renderedSha256) || hash(previous.renderedText) !== previous.renderedSha256
                || !previous.messageId)
                throw new Error('未知或损坏的开场选择 schema');
            if (previous.operationId !== operationId || previous.index !== index
                || previous.sourceSha256 !== candidate.sourceSha256
                || !samePointer(previous.source.pointer, catalog.source.pointer)
                || previous.source.rawSha256 !== catalog.source.rawSha256)
                throw new Error('已存在不同的开场选择；需先完成或显式迁移');
            if (previous.status === 'completed')
                return previous;
            // Reuse the exact operation after a durable negative log check. The native
            // writer also checks this id, so a partial turn remains a failure anchor.
            const found = await deps.findOpeningByOperationId(previous);
            if (found.status === 'committed')
                return complete(key, previous, found.turn);
            if (found.status === 'absent' && current(previous.source))
                return append(key, previous);
            return { status: 'busy', intent: previous };
        }
        if (Buffer.byteLength(candidate.renderedText, 'utf8') > 65_536)
            throw new Error('开场正文超过持久选择上限');
        const intent = { schemaVersion: 2, sessionId, source: catalog.source, index,
            sourcePointer: candidate.sourcePointer, sourceSha256: candidate.sourceSha256,
            renderedSha256: hash(candidate.renderedText), renderedText: candidate.renderedText,
            messageId: `opening-${hash(`${sessionId}\0${catalog.source.importId}\0${operationId}`).slice(0, 32)}`,
            operationId, revision: 1, status: 'pending' };
        await deps.table.put(key, intent);
        if (!current(catalog.source))
            throw new Error('active import pointer 已失效；意图已保留');
        return append(key, intent);
    });
    const recover = (sessionId, importId) => deps.withLock(`opening-choice:${sessionId}`, async () => {
        const key = openingIntentKey(sessionId, importId);
        const intent = deps.table.get(key);
        if (!intent)
            return null;
        if (intent.schemaVersion !== 2 || intent.sessionId !== sessionId || intent.source.importId !== importId
            || !validHash(intent.renderedSha256) || hash(intent.renderedText) !== intent.renderedSha256
            || !intent.messageId)
            throw new Error('未知或损坏的开场选择 schema');
        if (intent.status === 'completed')
            return intent;
        const found = await deps.findOpeningByOperationId(intent);
        return found.status === 'committed' ? complete(key, intent, found.turn) : intent;
    });
    return { readCatalog, select, recover };
}
