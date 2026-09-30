// Generated from runtime/alpha3/src/core/roleplay-opening-selection.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { compileTavernOpeningCandidates, decodeTavernCard } from './tavern-card.js';
import { recordSha256 } from './roleplay-data.js';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const validHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const samePointer = (a, b) => a.importId === b.importId
    && a.sourceRecordSessionId === b.sourceRecordSessionId && a.normalizedSha256 === b.normalizedSha256
    && a.transactionId === b.transactionId && a.coverageSha256 === b.coverageSha256;
const isRejectionCode = (value) => value === 'PROGRAMMATIC_IDENTITY_CONFLICT' || value === 'PROGRAMMATIC_OPEN_TURN'
    || value === 'PROGRAMMATIC_MISSING_SYSTEM_HEAD'
    || value === 'PROGRAMMATIC_UNATTRIBUTED_FAILURE'
    || value === 'PROGRAMMATIC_INCOMPLETE_TURN';
const initializationCodes = new Set([
    'PREPARE_UNSUPPORTED', 'PREPARE_FAILED', 'INITIALIZATION_UNKNOWN', 'INITIALIZATION_RECEIPT_INVALID',
    'SOURCE_CHANGED', 'EVENT_MISSING', 'HEAD_MISSING', 'RECORD_INVALID', 'IDENTITY_CONFLICT', 'NATIVE_NOT_COMMITTED',
]);
const compilerCodes = new Set([
    'NODE_LIMIT', 'DEPTH_LIMIT', 'BYTE_LIMIT', 'NUMBER_LIMIT', 'NON_JSON_VALUE', 'OBJECT_PROTOTYPE', 'CYCLIC_VALUE',
    'ARRAY_LIMIT', 'ARRAY_PROPERTY', 'PROTOTYPE_KEY', 'DESCRIPTOR_SHAPE', 'IDENTITY', 'SOURCE_HASH', 'JSON_OBJECT_REQUIRED',
    'AUTHOR_SCHEMA_UNSUPPORTED', 'INPUT_VERSION', 'UNVERIFIED_SOURCE', 'UNKNOWN_DIALECT', 'DIALECT_PROVENANCE',
    'UNVERIFIED_LOADER', 'LOADER_SETTLEMENT', 'MESSAGE_SCOPE', 'BOOK_ORDER', 'BOOK_IDENTITY_CONFLICT',
    'ENTRY_IDENTITY_CONFLICT', 'OPENING_HASH', 'SWIPE_IDENTITY_CONFLICT', 'SELECTED_SWIPE', 'BASIS_HASH',
    'MERGE_SHAPE_UNSUPPORTED', 'MACRO_BINDING', 'MACRO_UNSUPPORTED', 'NON_STRICT_JSON', 'MACRO_CAPABILITY',
    'SCHEMA_CAPABILITY', 'CALLBACK_CAPABILITY', 'OPENING_UPDATE_CAPABILITY', 'OPENING_UPDATE_UNSUPPORTED',
    'PRIMARY_BINDING_UNKNOWN', 'OUTPUT_BYTE_LIMIT', 'INVALID_INPUT',
    'INITVAR_WRAPPER_UNSUPPORTED', 'INITVAR_FENCE_UNSUPPORTED',
]);
const operationIdentity = (intent) => ({
    sessionId: intent.sessionId, source: intent.source, operationId: intent.operationId, messageId: intent.messageId,
    index: intent.index, sourcePointer: intent.sourcePointer, sourceSha256: intent.sourceSha256,
    renderedSha256: intent.renderedSha256,
});
const sameRecord = (a, b) => recordSha256(a) === recordSha256(b);
const validTurn = (turn) => Number.isSafeInteger(turn) && Number(turn) >= 0;
function diagnosticPointer(value) {
    if (typeof value !== 'string' || value.length > 256)
        return '';
    const indexed = value.match(/^\/(?:books\/\d+\/entries\/\d+|books\/\d+|swipes\/\d+(?:\/blocks\/\d+)?)(?=\/|$)/);
    if (indexed)
        return indexed[0];
    const fixed = new Set(['', '/schemaVersion', '/source', '/source/sourceId', '/source/sourceSha256',
        '/source/dialect', '/source/dialectSha256', '/source/commit', '/source/loader', '/messageIndex', '/initializedBooks',
        '/selectedSwipeIdentity', '/bookStatData', '/bookStatDataSha256', '/merge', '/plan',
        '/capabilities/macros', '/capabilities/schema', '/capabilities/callbacks', '/capabilities/openingUpdates']);
    return fixed.has(value) ? value : '';
}
function validFrozen(plan, intent) {
    if (!plan || plan.schemaVersion !== 1 || plan.encoding !== 'mvu-programmatic-opening-plan-v1'
        || !validHash(plan.planSha256) || !sameRecord(plan.identity, operationIdentity(intent)))
        return false;
    const { planSha256, ...content } = plan;
    return recordSha256(content) === planSha256 && validHash(plan.valuesSha256)
        && recordSha256(plan.values) === plan.valuesSha256
        && plan.compilation?.schemaVersion === 1 && ['none', 'supported'].includes(plan.compilation.kind);
}
function validReady(intent, ready) {
    if (ready.kind !== 'ready' || !intent.initialization || !validTurn(intent.committedTurn))
        return false;
    const { event, head } = ready;
    const native = event?.native;
    if (!event || !head || !native || !sameRecord(event.plan, intent.initialization)
        || !validHash(event.eventId) || !validHash(event.eventSha256)
        || event.schemaVersion !== 1 || event.encoding !== 'mvu-programmatic-opening-event-v1' || event.revision !== 1
        || head.schemaVersion !== 1 || head.encoding !== 'mvu-programmatic-opening-head-v1' || head.revision !== 1
        || head.sessionId !== intent.sessionId || head.eventId !== event.eventId || head.eventSha256 !== event.eventSha256
        || head.planSha256 !== intent.initialization.planSha256 || head.valuesSha256 !== intent.initialization.valuesSha256
        || event.valuesSha256 !== intent.initialization.valuesSha256
        || native.sessionId !== intent.sessionId || native.operationId !== intent.operationId || native.messageId !== intent.messageId
        || native.renderedSha256 !== intent.renderedSha256 || native.turn !== intent.committedTurn || native.turn <= 0
        || native.flushed !== true
        || native.messageVersion?.kind !== 'original' || !validHash(native.messageVersion.eventSha256)
        || ![native.turnStartSeq, native.assistantSeq, native.turnEndSeq].every(validTurn)
        || native.turnStartSeq >= native.assistantSeq || native.assistantSeq >= native.turnEndSeq)
        return false;
    const { eventSha256, ...content } = event;
    return recordSha256(content) === eventSha256;
}
function receiptFor(ready) {
    return { eventId: ready.event.eventId, eventSha256: ready.event.eventSha256, planSha256: ready.head.planSha256,
        valuesSha256: ready.head.valuesSha256, headSha256: recordSha256(ready.head), headRevision: 1 };
}
function validateV3(intent) {
    const keys = ['schemaVersion', 'sessionId', 'source', 'index', 'sourcePointer', 'sourceSha256', 'renderedSha256',
        'renderedText', 'messageId', 'operationId', 'revision', 'status', 'committedTurn', 'rejectionCode', 'textRetained',
        'initialization', 'initializationCode', 'initializationInputHash', 'initializationDiagnostics',
        'nativeReceipt', 'initializationReceipt'];
    const source = intent.source;
    if (Object.keys(intent).some(key => !keys.includes(key))
        || !source || source.sessionId !== intent.sessionId || source.pointer?.importId !== source.importId
        || source.pointer.normalizedSha256 !== source.normalizedSha256 || source.pointer.transactionId !== source.transactionId
        || source.pointer.coverageSha256 !== source.coverageSha256
        || (source.pointer.sourceRecordSessionId ?? intent.sessionId) !== source.sourceRecordSessionId
        || ![source.rawSha256, source.normalizedSha256, source.coverageSha256,
            intent.sourceSha256, intent.renderedSha256].every(validHash)
        || !Number.isSafeInteger(intent.index) || intent.index < 0
        || !Number.isSafeInteger(intent.revision) || intent.revision < 1
        || !/^[a-zA-Z0-9_-]{1,128}$/.test(intent.operationId) || !/^[a-zA-Z0-9_-]{1,128}$/.test(intent.messageId)
        || intent.messageId !== `opening-${hash(`${intent.sessionId}\0${source.importId}\0${intent.operationId}`).slice(0, 32)}`
        || typeof intent.sourcePointer !== 'string' || !intent.sourcePointer.startsWith('/')
        || intent.sourcePointer.length > 512 || typeof intent.renderedText !== 'string'
        || typeof intent.textRetained !== 'boolean'
        || !['pending', 'busy', 'unknown', 'blocked', 'native-committed', 'completed'].includes(intent.status)
        || (intent.initializationCode !== undefined && !initializationCodes.has(intent.initializationCode))) {
        throw new Error('未知或损坏的开场选择 schema');
    }
    if (intent.rejectionCode !== undefined && !isRejectionCode(intent.rejectionCode))
        throw new Error('无效的原生开场诊断');
    if (!intent.textRetained) {
        if (intent.status !== 'blocked' || intent.renderedText !== '' || intent.initialization !== undefined
            || intent.committedTurn !== undefined || intent.nativeReceipt !== undefined || intent.initializationReceipt !== undefined
            || !['PREPARE_UNSUPPORTED', 'PREPARE_FAILED'].includes(intent.initializationCode ?? '')) {
            throw new Error('损坏的开场初始化阻断锚点');
        }
    }
    else if (intent.status === 'blocked' || hash(intent.renderedText) !== intent.renderedSha256
        || !validFrozen(intent.initialization, intent))
        throw new Error('损坏的冻结开场初始化计划');
    if (intent.initializationInputHash !== undefined && !validHash(intent.initializationInputHash)) {
        throw new Error('损坏的开场初始化诊断');
    }
    if (intent.initializationDiagnostics !== undefined && (!Array.isArray(intent.initializationDiagnostics)
        || intent.initializationDiagnostics.length > 3 || intent.initializationDiagnostics.some(item => !item
        || Object.keys(item).some(key => key !== 'code' && key !== 'pointer') || !compilerCodes.has(item.code)
        || typeof item.pointer !== 'string' || diagnosticPointer(item.pointer) !== item.pointer))) {
        throw new Error('损坏的开场初始化诊断');
    }
    if (['native-committed', 'completed'].includes(intent.status) && !validTurn(intent.committedTurn)) {
        throw new Error('原生开场缺少 durable turn');
    }
    if (intent.status === 'completed' && (!intent.nativeReceipt || !intent.initializationReceipt)) {
        throw new Error('开场缺少初始化完成引用');
    }
    if (intent.status !== 'completed' && (intent.nativeReceipt !== undefined || intent.initializationReceipt !== undefined)) {
        throw new Error('未完成开场包含不可信完成引用');
    }
}
export function openingIntentKey(sessionId, importId) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId) || !/^[a-zA-Z0-9_-]{1,64}$/.test(importId))
        throw new Error('无效的 session/import id');
    return `${sessionId}__opening-choice-${importId}`;
}
export function createRoleplayOpeningSelection(deps) {
    const initializationDeps = [deps.prepareInitialization, deps.finishInitialization, deps.readInitialization];
    const initializationEnabled = initializationDeps.every(item => typeof item === 'function');
    if (!initializationEnabled && initializationDeps.some(item => item !== undefined)) {
        throw new Error('开场初始化依赖必须完整提供');
    }
    const checkIntent = (intent, sessionId, importId) => {
        if (intent.schemaVersion === 3 && initializationEnabled) {
            if (intent.sessionId !== sessionId || intent.source?.importId !== importId)
                throw new Error('未知或损坏的开场选择 schema');
            validateV3(intent);
            return;
        }
        if (intent.schemaVersion !== 2 || intent.sessionId !== sessionId || intent.source?.importId !== importId
            || !validHash(intent.renderedSha256) || hash(intent.renderedText) !== intent.renderedSha256
            || !intent.messageId)
            throw new Error('未知或损坏的开场选择 schema');
    };
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
        if (!pointer || !samePointer(pointer, source.pointer))
            return false;
        const record = deps.table.get(deps.importRecordKey(source.sourceRecordSessionId, source.importId));
        return !!record && record.status === 'active' && record.rawSha256 === source.rawSha256
            && record.normalizedSha256 === source.normalizedSha256
            && record.activation?.transactionId === source.transactionId;
    };
    const readIntent = (source) => {
        const intent = deps.table.get(openingIntentKey(source.sessionId, source.importId));
        if (!intent || !current(source) || ![2, ...(initializationEnabled ? [3] : [])].includes(intent.schemaVersion)
            || intent.sessionId !== source.sessionId
            || intent.source.importId !== source.importId || !samePointer(intent.source.pointer, source.pointer)
            || intent.source.rawSha256 !== source.rawSha256)
            return null;
        if (intent.schemaVersion === 3) {
            validateV3(intent);
            if (intent.status === 'completed')
                return completedProjection(intent);
        }
        return intent;
    };
    const complete = async (key, intent, turn) => {
        if (!Number.isSafeInteger(turn) || turn < 0)
            throw new Error('原生开场缺少 durable turn');
        const { rejectionCode: _previousRejection, ...retained } = intent;
        const next = intent.schemaVersion === 3
            ? { ...retained, status: 'native-committed', revision: intent.revision + 1, committedTurn: turn }
            : { ...retained, status: 'completed', revision: intent.revision + 1, committedTurn: turn };
        await deps.table.put(key, next);
        return next;
    };
    const committedResult = (intent) => intent.schemaVersion === 3
        ? { finish: structuredClone(intent) } : intent;
    const append = async (key, intent) => {
        let result;
        try {
            result = await deps.appendOpening({ sessionId: intent.sessionId, operationId: intent.operationId,
                messageId: intent.messageId, source: intent.source, text: intent.renderedText });
        }
        catch {
            result = { kind: 'unknown' };
        }
        if (intent.schemaVersion === 3 && !sameRecord(deps.table.get(key), intent)) {
            throw new Error('开场原生回执与当前意图不匹配');
        }
        if (result.kind === 'committed') {
            if (result.messageId !== intent.messageId)
                throw new Error('原生开场 messageId 回执不匹配');
            return committedResult(await complete(key, intent, result.turn));
        }
        // A newer busy/uncertain receipt supersedes the previous refusal. Only the
        // native diagnosis codes may persist; arbitrary adapter text may not.
        const { rejectionCode: _previousRejection, ...retained } = intent;
        const next = { ...retained, status: result.kind, revision: intent.revision + 1,
            ...(result.kind === 'unknown' && isRejectionCode(result.code) ? { rejectionCode: result.code } : {}) };
        await deps.table.put(key, next);
        return { status: 'busy', intent: next };
    };
    const ready = (intent) => {
        try {
            const result = deps.readInitialization(intent.initialization);
            if (!result || !['ready', 'blocked'].includes(result.kind)
                || result.kind === 'blocked' && !initializationCodes.has(result.code))
                return { kind: 'blocked', code: 'RECORD_INVALID' };
            return result;
        }
        catch {
            return { kind: 'blocked', code: 'RECORD_INVALID' };
        }
    };
    const receiptMatches = (intent, observed) => {
        try {
            return validReady(intent, observed);
        }
        catch {
            return false;
        }
    };
    // Read-only response view, not a durable prepare-blocked anchor: never put or
    // validate this projection as a replacement for the retained owner/receipt.
    const blockedProjection = (intent, code) => ({ ...intent, status: 'blocked', initializationCode: code });
    const completedProjection = (intent) => {
        // A retained receipt is historical when its import source has changed, even
        // if the numerical head/native receipt still matches this frozen plan.
        if (!current(intent.source))
            return blockedProjection(intent, 'SOURCE_CHANGED');
        const observed = ready(intent);
        if (observed.kind !== 'ready')
            return blockedProjection(intent, observed.code);
        if (!receiptMatches(intent, observed) || !sameRecord(intent.nativeReceipt, observed.event.native)
            || !sameRecord(intent.initializationReceipt, receiptFor(observed))) {
            return blockedProjection(intent, 'INITIALIZATION_RECEIPT_INVALID');
        }
        return intent;
    };
    const finish = async (work) => {
        let failure = 'INITIALIZATION_UNKNOWN';
        // publish owns the same non-reentrant source lock. Finish must stay outside opening withLock.
        if (current(work.source)) {
            try {
                const result = await deps.finishInitialization(structuredClone(work));
                if (result.kind === 'blocked' && initializationCodes.has(result.code))
                    failure = result.code;
            }
            catch { /* Actual read below can repair a lost head/publish acknowledgement. */ }
        }
        return deps.withLock(`opening-choice:${work.sessionId}`, async () => {
            const key = openingIntentKey(work.sessionId, work.source.importId);
            const actual = deps.table.get(key);
            if (!current(work.source))
                return blockedProjection(work, 'SOURCE_CHANGED');
            if (!actual)
                return blockedProjection(work, 'IDENTITY_CONFLICT');
            if (actual.schemaVersion !== 3 || !sameRecord(operationIdentity(actual), operationIdentity(work))
                || !sameRecord(actual.initialization, work.initialization) || actual.committedTurn !== work.committedTurn) {
                return blockedProjection(work, 'IDENTITY_CONFLICT');
            }
            checkIntent(actual, work.sessionId, work.source.importId);
            if (actual.status === 'completed')
                return completedProjection(actual);
            if (actual.status !== 'native-committed')
                return blockedProjection(work, 'IDENTITY_CONFLICT');
            const observed = ready(actual);
            if (observed.kind !== 'ready' || !receiptMatches(actual, observed)) {
                let code = 'INITIALIZATION_RECEIPT_INVALID';
                if (observed.kind === 'blocked') {
                    code = observed.code;
                    if (failure !== 'INITIALIZATION_UNKNOWN' && ['EVENT_MISSING', 'HEAD_MISSING'].includes(code))
                        code = failure;
                }
                const next = { ...actual, initializationCode: code,
                    revision: actual.revision + (actual.initializationCode !== code ? 1 : 0) };
                if (!sameRecord(next, actual)) {
                    // Optional diagnosis is not evidence of initialization; failure to save cannot erase the durable native anchor.
                    try {
                        await deps.table.put(key, next);
                        return next;
                    }
                    catch {
                        return actual;
                    }
                }
                return actual;
            }
            if (!current(actual.source))
                return blockedProjection(actual, 'SOURCE_CHANGED');
            const { initializationCode: _failure, rejectionCode: _rejection, ...retained } = actual;
            const next = { ...retained, status: 'completed', revision: actual.revision + 1,
                nativeReceipt: structuredClone(observed.event.native), initializationReceipt: receiptFor(observed) };
            await deps.table.put(key, next);
            if (!current(next.source))
                return blockedProjection(next, 'SOURCE_CHANGED');
            if (!sameRecord(deps.table.get(key), next))
                return blockedProjection(next, 'IDENTITY_CONFLICT');
            return completedProjection(next);
        });
    };
    const diagnose = async (key, intent, found) => {
        if (found.status !== 'unknown' || !isRejectionCode(found.code)
            || intent.status === 'unknown' && intent.rejectionCode === found.code)
            return intent;
        const next = { ...intent, status: 'unknown', rejectionCode: found.code, revision: intent.revision + 1 };
        // A diagnostic refresh must not turn a successful native lookup into a
        // storage failure. Retain the last durable intent if annotation cannot save.
        try {
            await deps.table.put(key, next);
            return next;
        }
        catch {
            return intent;
        }
    };
    const select = async (sessionId, index, operationId, context = {}) => {
        const result = await deps.withLock(`opening-choice:${sessionId}`, async () => {
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
                checkIntent(previous, sessionId, catalog.source.importId);
                if (previous.operationId !== operationId || previous.index !== index
                    || previous.sourceSha256 !== candidate.sourceSha256
                    || !samePointer(previous.source.pointer, catalog.source.pointer)
                    || previous.source.rawSha256 !== catalog.source.rawSha256)
                    throw new Error('已存在不同的开场选择；需先完成或显式迁移');
                if (previous.schemaVersion === 3) {
                    if (previous.status === 'blocked')
                        return { status: 'busy', intent: previous };
                    if (previous.status === 'completed') {
                        const projected = completedProjection(previous);
                        return projected.status === 'completed' ? projected : { status: 'busy', intent: projected };
                    }
                    if (previous.status === 'native-committed')
                        return { finish: structuredClone(previous) };
                }
                else if (previous.status === 'completed')
                    return previous;
                // Reuse the exact operation after a durable negative log check. The native
                // writer also checks this id, so a partial turn remains a failure anchor.
                const found = await deps.findOpeningByOperationId(previous);
                if (previous.schemaVersion === 3 && !current(previous.source))
                    return { status: 'busy', intent: previous };
                if (found.status === 'committed')
                    return committedResult(await complete(key, previous, found.turn));
                if (found.status === 'absent' && current(previous.source))
                    return append(key, previous);
                if (!current(previous.source))
                    return { status: 'busy', intent: previous };
                return { status: 'busy', intent: await diagnose(key, previous, found) };
            }
            if (Buffer.byteLength(candidate.renderedText, 'utf8') > 65_536)
                throw new Error('开场正文超过持久选择上限');
            const identity = { sessionId, source: catalog.source, index,
                sourcePointer: candidate.sourcePointer, sourceSha256: candidate.sourceSha256,
                renderedSha256: hash(candidate.renderedText), renderedText: candidate.renderedText,
                messageId: `opening-${hash(`${sessionId}\0${catalog.source.importId}\0${operationId}`).slice(0, 32)}`,
                operationId, revision: 1 };
            let intent;
            if (!initializationEnabled)
                intent = { schemaVersion: 2, ...identity, status: 'pending' };
            else {
                let preparation;
                let code = 'PREPARE_FAILED';
                try {
                    preparation = await deps.prepareInitialization({ catalog, candidate, identity: operationIdentity(identity) });
                    if (preparation.kind === 'prepared' && !validFrozen(preparation.plan, identity))
                        preparation = undefined;
                    if (preparation?.kind === 'unsupported')
                        code = 'PREPARE_UNSUPPORTED';
                }
                catch { /* Persist only bounded diagnosis; no adapter/parser error body belongs in the intent. */ }
                if (!preparation || preparation.kind !== 'prepared') {
                    const diagnostics = preparation?.kind === 'unsupported' && Array.isArray(preparation.diagnostics)
                        ? preparation.diagnostics.slice(0, 3)
                            .filter(item => item && compilerCodes.has(item.code))
                            .map(item => ({ code: item.code, pointer: diagnosticPointer(item.pointer) })) : [];
                    const inputHash = preparation?.kind === 'unsupported' ? preparation.inputHash : undefined;
                    const blocked = { ...identity, schemaVersion: 3, status: 'blocked', textRetained: false,
                        renderedText: '', initializationCode: code,
                        ...(diagnostics.length ? { initializationDiagnostics: diagnostics } : {}),
                        ...(validHash(inputHash) ? { initializationInputHash: inputHash } : {}) };
                    await deps.table.put(key, blocked);
                    return { status: 'busy', intent: blocked };
                }
                intent = { ...identity, schemaVersion: 3, status: 'pending', textRetained: true,
                    initialization: structuredClone(preparation.plan) };
            }
            await deps.table.put(key, intent);
            if (!current(catalog.source))
                throw new Error('active import pointer 已失效；意图已保留');
            return append(key, intent);
        });
        if (!('finish' in result))
            return result;
        const completed = await finish(result.finish);
        return completed.status === 'completed' ? completed : { status: 'busy', intent: completed };
    };
    const recover = async (sessionId, importId) => {
        const result = await deps.withLock(`opening-choice:${sessionId}`, async () => {
            const key = openingIntentKey(sessionId, importId);
            const intent = deps.table.get(key);
            if (!intent)
                return null;
            checkIntent(intent, sessionId, importId);
            if (!current(intent.source))
                return null;
            if (intent.schemaVersion === 3) {
                if (intent.status === 'blocked')
                    return intent;
                if (intent.status === 'completed')
                    return completedProjection(intent);
                if (intent.status === 'native-committed')
                    return { finish: structuredClone(intent) };
            }
            else if (intent.status === 'completed')
                return intent;
            const found = await deps.findOpeningByOperationId(intent);
            if (!current(intent.source))
                return null;
            // Uncertain lookup can explain a refusal without authorizing another append.
            return found.status === 'committed' ? committedResult(await complete(key, intent, found.turn)) : diagnose(key, intent, found);
        });
        return result && 'finish' in result ? finish(result.finish) : result;
    };
    return { readCatalog, readIntent, select, recover };
}
