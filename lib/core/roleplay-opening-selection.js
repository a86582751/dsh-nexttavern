// Generated from runtime/alpha3/src/core/roleplay-opening-selection.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { compileTavernOpeningCandidates, decodeTavernCard } from './tavern-card.js';
import { recordSha256 } from './roleplay-data.js';
import { validateMvuSchemaOpeningIntent, freezeMvuSchemaOpeningData } from './roleplay-mvu-schema-opening-types.js';
import { PROMPT_TEMPLATE_ONLY_CODES_V1, validatePromptTemplateOnlyOpeningIntentV6, validatePromptTemplateOnlySourceProofV1 } from './roleplay-prompt-template-only-data.js';
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
    'BASIS_UNPROVEN', 'BASIS_CHANGED',
    ...PROMPT_TEMPLATE_ONLY_CODES_V1,
]);
const sourceDiagnosticCodes = {
    REQUEST_INVALID: true, SOURCE_INVALID: true, SOURCE_CHANGED: true, MATERIAL_INVALID: true, MEMBERSHIP_INVALID: true,
    SOURCE_BUDGET: true, FIELD_UNSUPPORTED: true, EXTENSION_UNSUPPORTED: true, STATE_SYNTAX_UNSUPPORTED: true,
    INITVAR_OUTSIDE_BINDING: true, INITVAR_INVALID: true, PRIMARY_REQUIRED: true, MACRO_UNSUPPORTED: true,
    BASIS_UNPROVEN: true, BASIS_INVALID: true, SNAPSHOT_INVALID: true,
};
const compilerCodes = new Set([
    ...Object.keys(sourceDiagnosticCodes),
    ...PROMPT_TEMPLATE_ONLY_CODES_V1,
    'NODE_LIMIT', 'DEPTH_LIMIT', 'BYTE_LIMIT', 'NUMBER_LIMIT', 'NON_JSON_VALUE', 'OBJECT_PROTOTYPE', 'CYCLIC_VALUE',
    'ARRAY_LIMIT', 'ARRAY_PROPERTY', 'PROTOTYPE_KEY', 'DESCRIPTOR_SHAPE', 'IDENTITY', 'SOURCE_HASH', 'JSON_OBJECT_REQUIRED',
    'AUTHOR_SCHEMA_UNSUPPORTED', 'INPUT_VERSION', 'UNVERIFIED_SOURCE', 'UNKNOWN_DIALECT', 'DIALECT_PROVENANCE',
    'UNVERIFIED_LOADER', 'LOADER_SETTLEMENT', 'MESSAGE_SCOPE', 'BOOK_ORDER', 'BOOK_IDENTITY_CONFLICT',
    'ENTRY_IDENTITY_CONFLICT', 'OPENING_HASH', 'SWIPE_IDENTITY_CONFLICT', 'SELECTED_SWIPE', 'BASIS_HASH',
    'MERGE_SHAPE_UNSUPPORTED', 'MACRO_BINDING', 'MACRO_UNSUPPORTED', 'NON_STRICT_JSON', 'MACRO_CAPABILITY',
    'SCHEMA_CAPABILITY', 'CALLBACK_CAPABILITY', 'OPENING_UPDATE_CAPABILITY', 'OPENING_UPDATE_UNSUPPORTED',
    'PRIMARY_BINDING_UNKNOWN', 'OUTPUT_BYTE_LIMIT', 'INVALID_INPUT',
    'INITVAR_WRAPPER_UNSUPPORTED', 'INITVAR_FENCE_UNSUPPORTED',
    'NATIVE_POLICY', 'SOURCE_SNAPSHOT_HASH', 'FRESH_BASIS',
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
        '/policy', '/sourceSnapshot', '/freshNativeBasisProof',
        '/settings', '/settings/cards', '/settings/worldbook', '/settings/extensions', '/source/coverage', '/material',
        '/basis', '/basis/swipes', '/bindings/primary', '/selected', '/macros', '/document', '/data', '/data/extensions',
        '/data/character_book', '/data/character_book/extensions',
        '/capabilities/macros', '/capabilities/schema', '/capabilities/callbacks', '/capabilities/openingUpdates']);
    return fixed.has(value) ? value : '';
}
function validFrozen(plan, intent, version = 1) {
    if (!plan || plan.schemaVersion !== version || plan.encoding !== `mvu-programmatic-opening-plan-v${version}`
        || !validHash(plan.planSha256) || !sameRecord(plan.identity, operationIdentity(intent)))
        return false;
    const { planSha256, ...content } = plan;
    return recordSha256(content) === planSha256 && validHash(plan.valuesSha256)
        && recordSha256(plan.values) === plan.valuesSha256
        && plan.compilation?.schemaVersion === version && ['none', 'supported'].includes(plan.compilation.kind)
        && (version === 1 || plan.schemaVersion === 2 && plan.compilation.kind === 'supported'
            && validSnapshot(plan.sourceSnapshot, intent) && contentHash(plan.freshNativeBasisProof, 'proofSha256'));
}
function contentHash(value, field) {
    if (!value || typeof value !== 'object')
        return false;
    const { [field]: expected, ...content } = value;
    return validHash(expected) && recordSha256(content) === expected;
}
function validSnapshot(snapshot, intent) {
    return !!snapshot && snapshot.schemaVersion === 1 && snapshot.encoding === 'native-mvu-source-snapshot-v1'
        && contentHash(snapshot, 'snapshotSha256') && sameRecord(snapshot.source, intent.source)
        && snapshot.selected.index === intent.index && snapshot.selected.pointer === intent.sourcePointer
        && snapshot.selected.sourceSha256 === intent.sourceSha256 && snapshot.selected.renderedSha256 === intent.renderedSha256;
}
function validAbsence(proof, intent) {
    return !!proof && proof.schemaVersion === 1 && proof.encoding === 'native-mvu-absence-scope-proof-v1'
        && proof.reason === 'closed-native-scope-no-initialization' && contentHash(proof, 'proofSha256')
        && Object.keys(proof).every(key => ['schemaVersion', 'encoding', 'reason', 'sourceSnapshot', 'proofSha256'].includes(key))
        && validSnapshot(proof.sourceSnapshot, intent);
}
function validPromptTemplateOnly(proof, intent) {
    try {
        const checked = validatePromptTemplateOnlySourceProofV1(proof), snapshot = checked.sourceSnapshot;
        return sameRecord(snapshot.source, intent.source) && snapshot.selected.index === intent.index
            && snapshot.selected.pointer === intent.sourcePointer && snapshot.selected.sourceSha256 === intent.sourceSha256
            && snapshot.selected.renderedSha256 === intent.renderedSha256;
    }
    catch {
        return false;
    }
}
function validNative(intent, native) {
    return !!native && Object.keys(native).every(key => ['sessionId', 'operationId', 'messageId', 'renderedSha256', 'turn',
        'assistantSeq', 'turnStartSeq', 'turnEndSeq', 'messageVersion', 'flushed'].includes(key))
        && Object.keys(native.messageVersion ?? {}).every(key => ['kind', 'eventSha256'].includes(key))
        && native.sessionId === intent.sessionId && native.operationId === intent.operationId
        && native.messageId === intent.messageId && native.renderedSha256 === intent.renderedSha256
        && native.turn === intent.committedTurn && validTurn(native.turn) && native.turn > 0 && native.flushed === true
        && native.messageVersion?.kind === 'original' && validHash(native.messageVersion.eventSha256)
        && [native.turnStartSeq, native.assistantSeq, native.turnEndSeq].every(validTurn)
        && native.turnStartSeq < native.assistantSeq && native.assistantSeq < native.turnEndSeq;
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
function validateVersioned(intent) {
    const keys = ['schemaVersion', 'sessionId', 'source', 'index', 'sourcePointer', 'sourceSha256', 'renderedSha256',
        'renderedText', 'messageId', 'operationId', 'revision', 'status', 'committedTurn', 'rejectionCode', 'textRetained',
        'initialization', 'initializationCode', 'initializationInputHash', 'initializationDiagnostics',
        'nativeReceipt', 'initializationReceipt', ...(intent.schemaVersion === 4 ? ['mode', 'absenceScopeProof'] : [])];
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
            || !['PREPARE_UNSUPPORTED', 'PREPARE_FAILED', ...(intent.schemaVersion === 4 ? ['SOURCE_CHANGED'] : [])]
                .includes(intent.initializationCode ?? '')) {
            throw new Error('损坏的开场初始化阻断锚点');
        }
        if (intent.schemaVersion === 4 && (intent.mode !== 'unsupported' || intent.absenceScopeProof !== undefined)) {
            throw new Error('损坏的开场初始化阻断锚点');
        }
    }
    else {
        if (intent.status === 'blocked' || hash(intent.renderedText) !== intent.renderedSha256) {
            throw new Error('损坏的冻结开场初始化计划');
        }
        if (intent.schemaVersion === 4 && intent.mode === 'plain') {
            if (intent.initialization !== undefined || intent.initializationReceipt !== undefined
                || !validAbsence(intent.absenceScopeProof, intent))
                throw new Error('损坏的开场来源范围证明');
        }
        else if (intent.schemaVersion === 4 && (intent.mode !== 'native-json' || intent.absenceScopeProof !== undefined)
            || !validFrozen(intent.initialization, intent, intent.schemaVersion === 4 ? 2 : 1)) {
            throw new Error('损坏的冻结开场初始化计划');
        }
    }
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
    if (intent.status === 'completed' && (!intent.nativeReceipt
        || intent.schemaVersion === 4 && !validNative(intent, intent.nativeReceipt)
        || !(intent.schemaVersion === 4 && intent.mode === 'plain') && !intent.initializationReceipt)) {
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
    if (!initializationEnabled && [...initializationDeps, deps.isSourceSnapshotCurrent, deps.readNativeOpening]
        .some(item => item !== undefined)) {
        throw new Error('开场初始化依赖必须完整提供');
    }
    const checkIntent = (intent, sessionId, importId) => {
        if (intent.schemaVersion === 6) {
            requireV6Deps();
            if (intent.sessionId !== sessionId || intent.source?.importId !== importId
                || intent.initializationCode !== undefined && !initializationCodes.has(intent.initializationCode)
                || intent.rejectionCode !== undefined && !isRejectionCode(intent.rejectionCode)) {
                throw new Error('PROMPT_TEMPLATE_RECORD_INVALID');
            }
            validatePromptTemplateOnlyOpeningIntentV6(intent);
            return;
        }
        if (intent.schemaVersion === 5) {
            if (intent.sessionId !== sessionId || intent.source?.importId !== importId)
                throw new Error('未知或损坏的开场选择 schema');
            validateMvuSchemaOpeningIntent(intent);
            return;
        }
        if ((intent.schemaVersion === 3 || intent.schemaVersion === 4) && initializationEnabled) {
            if (intent.sessionId !== sessionId || intent.source?.importId !== importId)
                throw new Error('未知或损坏的开场选择 schema');
            if (intent.schemaVersion === 4)
                requireV4Deps();
            validateVersioned(intent);
            return;
        }
        if (intent.schemaVersion !== 2 || intent.sessionId !== sessionId || intent.source?.importId !== importId
            || !validHash(intent.renderedSha256) || hash(intent.renderedText) !== intent.renderedSha256
            || !intent.messageId)
            throw new Error('未知或损坏的开场选择 schema');
    };
    const requireV4Deps = () => {
        if (typeof deps.isSourceSnapshotCurrent !== 'function' || typeof deps.readNativeOpening !== 'function') {
            throw new Error('开场来源证明与原生回执依赖必须完整提供');
        }
    };
    const requireV6Deps = () => {
        if (typeof deps.readNativeOpening !== 'function'
            || typeof deps.preflightPromptTemplateOpening !== 'function' || typeof deps.preflightPromptTemplateRuntime !== 'function'
            || typeof deps.isPromptTemplateOnlySourceCurrent !== 'function' || typeof deps.isPromptTemplateRuntimeCurrent !== 'function') {
            throw new Error('PROMPT_TEMPLATE_PROTOCOL_UNAVAILABLE');
        }
    };
    const runtimeCurrent = (intent) => {
        try {
            return deps.isPromptTemplateRuntimeCurrent?.(intent.promptTemplateSourceProof) === true;
        }
        catch {
            return false;
        }
    };
    const preflightExisting = async (intent) => {
        requireV6Deps();
        try {
            await deps.preflightPromptTemplateRuntime(structuredClone(intent.promptTemplateSourceProof));
            return null;
        }
        catch (error) {
            const code = error instanceof Error ? error.message : '';
            return PROMPT_TEMPLATE_ONLY_CODES_V1.includes(code)
                ? code : 'PROMPT_TEMPLATE_RUNTIME_REQUIRED';
        }
    };
    const sourceCurrent = (intent) => {
        if (!current(intent.source))
            return false;
        if (intent.schemaVersion === 6) {
            try {
                return deps.isPromptTemplateOnlySourceCurrent?.(intent.promptTemplateSourceProof) === true;
            }
            catch {
                return false;
            }
        }
        if (intent.schemaVersion !== 4 || intent.mode === 'unsupported')
            return true;
        const snapshot = intent.mode === 'plain' ? intent.absenceScopeProof.sourceSnapshot : intent.initialization.sourceSnapshot;
        try {
            return deps.isSourceSnapshotCurrent(snapshot) === true;
        }
        catch {
            return false;
        }
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
        if (intent?.schemaVersion === 6) {
            if (!current(source) || !sameRecord(intent.source, source))
                return null;
            checkIntent(intent, source.sessionId, source.importId);
            if (!sourceCurrent(intent))
                return blockedProjection(intent, 'PROMPT_TEMPLATE_SOURCE_CHANGED');
            if (!runtimeCurrent(intent))
                return blockedProjection(intent, 'PROMPT_TEMPLATE_RUNTIME_REQUIRED');
            return intent.status === 'completed' ? completedProjection(intent) : intent;
        }
        if (intent?.schemaVersion === 5) {
            if (!current(source) || !sameRecord(intent.source, source))
                return null;
            const checked = validateMvuSchemaOpeningIntent(intent);
            return deps.schemaOpening?.readIntent(source) ?? freezeMvuSchemaOpeningData({ ...checked, status: 'blocked',
                initializationCode: 'SCHEMA_HISTORY_UNVERIFIED' });
        }
        if (intent && current(source) && ![2, 3, 4].includes(intent.schemaVersion))
            throw new Error('未知或损坏的开场选择 schema');
        if (intent?.schemaVersion === 4 && !initializationEnabled)
            throw new Error('当前入口不能读取带来源证明的开场');
        if (!intent || !current(source) || ![2, ...(initializationEnabled ? [3, 4] : [])].includes(intent.schemaVersion)
            || intent.sessionId !== source.sessionId
            || intent.source.importId !== source.importId || !samePointer(intent.source.pointer, source.pointer)
            || intent.source.rawSha256 !== source.rawSha256)
            return null;
        if (intent.schemaVersion === 3 || intent.schemaVersion === 4) {
            checkIntent(intent, source.sessionId, source.importId);
            if (intent.status === 'completed')
                return completedProjection(intent);
            if (!sourceCurrent(intent))
                return blockedProjection(intent, 'SOURCE_CHANGED');
        }
        return intent;
    };
    /** An observation supplies original, strictly validated data. Its consumer
     * must independently join Source and Native facts; execution/completion
     * continues to use readIntent's complete protected-runtime gate. */
    const readIntentForObservation = (source) => {
        const intent = deps.table.get(openingIntentKey(source.sessionId, source.importId));
        if (intent?.schemaVersion !== 6)
            return readIntent(source);
        if (!current(source) || !sameRecord(intent.source, source))
            return null;
        return validatePromptTemplateOnlyOpeningIntentV6(intent);
    };
    const complete = async (key, intent, turn) => {
        if (!Number.isSafeInteger(turn) || turn < 0)
            throw new Error('原生开场缺少 durable turn');
        const { rejectionCode: _previousRejection, ...retained } = intent;
        const next = intent.schemaVersion !== 2
            ? { ...retained, status: 'native-committed', revision: intent.revision + 1, committedTurn: turn }
            : { ...retained, status: 'completed', revision: intent.revision + 1, committedTurn: turn };
        await deps.table.put(key, next);
        return next;
    };
    const committedResult = (intent) => intent.schemaVersion !== 2
        ? { finish: structuredClone(intent) } : intent;
    const legacyAllowed = (intent) => {
        if (!deps.legacyPendingAllowed)
            return true;
        try {
            return deps.legacyPendingAllowed(intent) === true;
        }
        catch {
            return false;
        }
    };
    const append = async (key, intent) => {
        if (intent.schemaVersion === 2 && !legacyAllowed(intent))
            return { status: 'busy', intent: { ...intent, status: 'unknown' } };
        if (intent.schemaVersion !== 2 && !sourceCurrent(intent))
            return { status: 'busy', intent: blockedProjection(intent, 'SOURCE_CHANGED') };
        if (intent.schemaVersion === 6 && !runtimeCurrent(intent)) {
            return { status: 'busy', intent: blockedProjection(intent, 'PROMPT_TEMPLATE_RUNTIME_REQUIRED') };
        }
        let result;
        try {
            result = await deps.appendOpening({ sessionId: intent.sessionId, operationId: intent.operationId,
                messageId: intent.messageId, source: intent.source, text: intent.renderedText });
        }
        catch {
            result = { kind: 'unknown' };
        }
        if (intent.schemaVersion !== 2 && !sameRecord(deps.table.get(key), intent)) {
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
    const nativeReady = (intent) => {
        try {
            const observed = deps.readNativeOpening(intent);
            if (observed.kind === 'blocked' && initializationCodes.has(observed.code))
                return observed;
            if (observed.kind === 'ready' && validNative(intent, observed.receipt))
                return observed;
        }
        catch { /* Read-only uncertain native evidence cannot authorize completion. */ }
        return { kind: 'blocked', code: 'NATIVE_NOT_COMMITTED' };
    };
    const completedProjection = (intent) => {
        // A retained receipt is historical when its import source has changed, even
        // if the numerical head/native receipt still matches this frozen plan.
        if (!sourceCurrent(intent))
            return blockedProjection(intent, 'SOURCE_CHANGED');
        if (intent.schemaVersion === 6) {
            if (!runtimeCurrent(intent))
                return blockedProjection(intent, 'PROMPT_TEMPLATE_RUNTIME_REQUIRED');
            const native = nativeReady(intent);
            if (native.kind !== 'ready')
                return blockedProjection(intent, native.code);
            return sameRecord(native.receipt, intent.nativeReceipt) ? intent : blockedProjection(intent, 'INITIALIZATION_RECEIPT_INVALID');
        }
        if (intent.schemaVersion === 4) {
            const native = nativeReady(intent);
            if (native.kind !== 'ready')
                return blockedProjection(intent, native.code);
            if (!sameRecord(native.receipt, intent.nativeReceipt))
                return blockedProjection(intent, 'INITIALIZATION_RECEIPT_INVALID');
            if (intent.mode === 'plain')
                return intent;
        }
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
        // Template runtime waits never enter the Source FIFO. A cold process must
        // load its actual owner; a persisted proof cannot stand in for readiness.
        if (work.schemaVersion === 6) {
            const refused = await preflightExisting(work);
            if (refused)
                return blockedProjection(work, refused);
            return deps.withLock(`opening-choice:${work.sessionId}`, async () => {
                const key = openingIntentKey(work.sessionId, work.source.importId);
                const actual = deps.table.get(key);
                if (!sourceCurrent(work))
                    return blockedProjection(work, 'PROMPT_TEMPLATE_SOURCE_CHANGED');
                if (!runtimeCurrent(work))
                    return blockedProjection(work, 'PROMPT_TEMPLATE_RUNTIME_REQUIRED');
                if (actual?.schemaVersion !== 6 || !sameRecord(operationIdentity(actual), operationIdentity(work))
                    || !sameRecord(actual.promptTemplateSourceProof, work.promptTemplateSourceProof)
                    || actual.committedTurn !== work.committedTurn)
                    return blockedProjection(work, 'IDENTITY_CONFLICT');
                checkIntent(actual, work.sessionId, work.source.importId);
                if (actual.status === 'completed')
                    return completedProjection(actual);
                if (actual.status !== 'native-committed')
                    return blockedProjection(work, 'IDENTITY_CONFLICT');
                const native = nativeReady(actual);
                if (native.kind !== 'ready')
                    return blockedProjection(actual, native.code);
                const { initializationCode: _code, rejectionCode: _rejection, ...retained } = actual;
                const next = { ...retained, status: 'completed', revision: actual.revision + 1,
                    nativeReceipt: structuredClone(native.receipt) };
                await deps.table.put(key, next);
                if (!sourceCurrent(next))
                    return blockedProjection(next, 'PROMPT_TEMPLATE_SOURCE_CHANGED');
                if (!runtimeCurrent(next))
                    return blockedProjection(next, 'PROMPT_TEMPLATE_RUNTIME_REQUIRED');
                if (!sameRecord(deps.table.get(key), next))
                    return blockedProjection(next, 'IDENTITY_CONFLICT');
                return completedProjection(next);
            });
        }
        const native = work.schemaVersion === 4 ? nativeReady(work) : null;
        // publish owns the same non-reentrant source lock. Finish must stay outside opening withLock.
        if (sourceCurrent(work) && native?.kind !== 'blocked' && !(work.schemaVersion === 4 && work.mode === 'plain')) {
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
            if (!sourceCurrent(work))
                return blockedProjection(work, 'SOURCE_CHANGED');
            if (!actual)
                return blockedProjection(work, 'IDENTITY_CONFLICT');
            if (actual.schemaVersion === 2 || actual.schemaVersion === 5 || actual.schemaVersion === 6
                || actual.schemaVersion !== work.schemaVersion
                || !sameRecord(operationIdentity(actual), operationIdentity(work))
                || !sameRecord(actual.initialization, work.initialization) || actual.committedTurn !== work.committedTurn
                || actual.schemaVersion === 4 && (work.schemaVersion !== 4 || actual.mode !== work.mode
                    || !sameRecord(actual.absenceScopeProof, work.absenceScopeProof))) {
                return blockedProjection(work, 'IDENTITY_CONFLICT');
            }
            checkIntent(actual, work.sessionId, work.source.importId);
            if (actual.schemaVersion === 4 && actual.mode === 'native-json'
                && (failure === 'BASIS_UNPROVEN' || failure === 'BASIS_CHANGED')) {
                // A readable owned head cannot override an explicit fresh-basis refusal
                // after publication. Only a missing/thrown acknowledgement is repairable.
                return blockedProjection(actual, failure);
            }
            if (actual.status === 'completed')
                return completedProjection(actual);
            if (actual.status !== 'native-committed')
                return blockedProjection(work, 'IDENTITY_CONFLICT');
            if (actual.schemaVersion === 4) {
                const native = nativeReady(actual);
                if (native.kind !== 'ready')
                    return blockedProjection(actual, native.code);
                if (actual.mode === 'plain') {
                    const { initializationCode: _code, rejectionCode: _rejection, ...retained } = actual;
                    const next = { ...retained, status: 'completed', revision: actual.revision + 1,
                        nativeReceipt: structuredClone(native.receipt) };
                    await deps.table.put(key, next);
                    if (!sourceCurrent(next))
                        return blockedProjection(next, 'SOURCE_CHANGED');
                    if (!sameRecord(deps.table.get(key), next))
                        return blockedProjection(next, 'IDENTITY_CONFLICT');
                    return completedProjection(next);
                }
            }
            const observed = ready(actual);
            if (observed.kind !== 'ready' || !receiptMatches(actual, observed)) {
                let code = 'INITIALIZATION_RECEIPT_INVALID';
                if (observed.kind === 'blocked') {
                    code = observed.code;
                    if (failure !== 'INITIALIZATION_UNKNOWN' && ['EVENT_MISSING', 'HEAD_MISSING'].includes(code))
                        code = failure;
                }
                if (actual.schemaVersion === 4) {
                    // Phase projection only. Source/basis/native conflicts must not mutate
                    // a retained transaction or disguise its frozen mode as a new success.
                    return ['EVENT_MISSING', 'HEAD_MISSING', 'INITIALIZATION_UNKNOWN'].includes(code)
                        ? { ...actual, initializationCode: code } : blockedProjection(actual, code);
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
            if (!sourceCurrent(actual))
                return blockedProjection(actual, 'SOURCE_CHANGED');
            const { initializationCode: _failure, rejectionCode: _rejection, ...retained } = actual;
            const next = { ...retained, status: 'completed', revision: actual.revision + 1,
                nativeReceipt: structuredClone(observed.event.native), initializationReceipt: receiptFor(observed) };
            await deps.table.put(key, next);
            if (!sourceCurrent(next))
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
        // The Source probe is synchronous. Schema maintenance/guest/Native lookup
        // awaits belong to the separate transaction outside this legacy lock.
        if (deps.schemaOpening) {
            if (!/^[a-zA-Z0-9_-]{1,128}$/.test(operationId))
                throw new Error('无效的 operationId');
            const catalog = readCatalog(sessionId, context), candidate = catalog.candidates.find(item => item.index === index);
            if (!candidate)
                throw new Error('开场候选不存在');
            const request = { catalog, candidate, renderedText: candidate.renderedText,
                identity: { sessionId, source: catalog.source, index, sourcePointer: candidate.sourcePointer,
                    sourceSha256: candidate.sourceSha256, renderedSha256: hash(candidate.renderedText), operationId,
                    messageId: `opening-${hash(`${sessionId}\0${catalog.source.importId}\0${operationId}`).slice(0, 32)}` } };
            const previous = deps.table.get(openingIntentKey(sessionId, catalog.source.importId));
            if (previous?.schemaVersion === 5 || deps.schemaOpening.handles(request))
                return deps.schemaOpening.select(request);
        }
        let templatePreflight = { kind: 'not-applicable' };
        if (deps.preflightPromptTemplateOpening) {
            if (!/^[a-zA-Z0-9_-]{1,128}$/.test(operationId))
                throw new Error('无效的 operationId');
            const catalog = readCatalog(sessionId, context), candidate = catalog.candidates.find(item => item.index === index);
            if (!candidate)
                throw new Error('开场候选不存在');
            // Actual asset/Native readiness may await. This is outside withLock,
            // which Core binds to the non-reentrant Source/import FIFO.
            templatePreflight = await deps.preflightPromptTemplateOpening({ catalog, candidate });
        }
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
                if (previous.schemaVersion === 5)
                    return { status: 'busy',
                        intent: readIntent(catalog.source) ?? freezeMvuSchemaOpeningData({ ...previous, status: 'blocked',
                            initializationCode: 'SCHEMA_HISTORY_UNVERIFIED' }) };
                if (previous.operationId !== operationId || previous.index !== index
                    || previous.sourceSha256 !== candidate.sourceSha256
                    || !samePointer(previous.source.pointer, catalog.source.pointer)
                    || previous.source.rawSha256 !== catalog.source.rawSha256)
                    throw new Error('已存在不同的开场选择；需先完成或显式迁移');
                if (previous.schemaVersion === 6) {
                    if (!sourceCurrent(previous))
                        return { status: 'busy',
                            intent: blockedProjection(previous, 'PROMPT_TEMPLATE_SOURCE_CHANGED') };
                    if (templatePreflight.kind !== 'ready'
                        || !sameRecord(templatePreflight.proof, previous.promptTemplateSourceProof) || !runtimeCurrent(previous)) {
                        return { status: 'busy', intent: blockedProjection(previous, templatePreflight.kind === 'blocked'
                                ? templatePreflight.code : 'PROMPT_TEMPLATE_RUNTIME_REQUIRED') };
                    }
                    if (previous.status === 'blocked') {
                        const found = await deps.findOpeningByOperationId(previous);
                        if (!sameRecord(deps.table.get(key), previous))
                            return { status: 'busy',
                                intent: blockedProjection(previous, 'IDENTITY_CONFLICT') };
                        if (!sourceCurrent(previous))
                            return { status: 'busy',
                                intent: blockedProjection(previous, 'PROMPT_TEMPLATE_SOURCE_CHANGED') };
                        if (!runtimeCurrent(previous))
                            return { status: 'busy',
                                intent: blockedProjection(previous, 'PROMPT_TEMPLATE_RUNTIME_REQUIRED') };
                        if (found.status === 'committed')
                            return committedResult(await complete(key, previous, found.turn));
                        if (found.status !== 'absent')
                            return { status: 'busy', intent: await diagnose(key, previous, found) };
                        const { initializationCode: _code, rejectionCode: _rejection, ...retained } = previous;
                        const pending = { ...retained, status: 'pending', revision: previous.revision + 1 };
                        await deps.table.put(key, pending);
                        return append(key, pending);
                    }
                }
                if (previous.schemaVersion !== 2) {
                    if (previous.status === 'blocked')
                        return { status: 'busy', intent: previous };
                    if (!sourceCurrent(previous))
                        return { status: 'busy', intent: blockedProjection(previous, 'SOURCE_CHANGED') };
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
                if ((previous.schemaVersion === 4 || previous.schemaVersion === 6) && !sameRecord(deps.table.get(key), previous)) {
                    return { status: 'busy', intent: blockedProjection(previous, 'IDENTITY_CONFLICT') };
                }
                if (previous.schemaVersion !== 2 && !sourceCurrent(previous)) {
                    return { status: 'busy', intent: blockedProjection(previous, 'SOURCE_CHANGED') };
                }
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
                let sourceProtocol = typeof deps.isSourceSnapshotCurrent === 'function' && typeof deps.readNativeOpening === 'function';
                try {
                    preparation = await deps.prepareInitialization({ catalog, candidate, identity: operationIdentity(identity) });
                    if (preparation.kind === 'prepared')
                        sourceProtocol = preparation.plan.schemaVersion !== 1;
                    if (preparation.kind === 'prepared' && !validFrozen(preparation.plan, identity, preparation.plan.schemaVersion)) {
                        preparation = undefined;
                    }
                    if (preparation?.kind === 'unsupported')
                        code = 'PREPARE_UNSUPPORTED';
                }
                catch { /* Persist only bounded diagnosis; no adapter/parser error body belongs in the intent. */ }
                if (preparation?.kind === 'prompt-template-only') {
                    requireV6Deps();
                    if (!validPromptTemplateOnly(preparation.proof, identity))
                        throw new Error('PROMPT_TEMPLATE_RECORD_INVALID');
                    const next = { ...identity, schemaVersion: 6, mode: 'prompt-template-only', status: 'pending',
                        textRetained: true, promptTemplateSourceProof: structuredClone(preparation.proof) };
                    const refusal = !sourceCurrent(next) ? 'PROMPT_TEMPLATE_SOURCE_CHANGED'
                        : templatePreflight.kind === 'not-applicable' || !sameRecord(templatePreflight.proof, preparation.proof)
                            ? 'PROMPT_TEMPLATE_SOURCE_CHANGED' : templatePreflight.kind === 'blocked' ? templatePreflight.code
                            : !runtimeCurrent(next) ? 'PROMPT_TEMPLATE_RUNTIME_REQUIRED' : null;
                    if (refusal) {
                        const blocked = { ...next, status: 'blocked', initializationCode: refusal };
                        await deps.table.put(key, blocked);
                        return { status: 'busy', intent: blocked };
                    }
                    intent = next;
                }
                else if (preparation?.kind === 'legacy-v2') {
                    requireV4Deps();
                    if (!validAbsence(preparation.absenceScopeProof, identity))
                        throw new Error('损坏的开场来源范围证明');
                    intent = { ...identity, schemaVersion: 4, mode: 'plain', status: 'pending', textRetained: true,
                        absenceScopeProof: structuredClone(preparation.absenceScopeProof) };
                }
                else if (!preparation || preparation.kind !== 'prepared') {
                    const diagnostics = preparation?.kind === 'unsupported' && Array.isArray(preparation.diagnostics)
                        ? preparation.diagnostics.slice(0, 3)
                            .filter(item => item && compilerCodes.has(item.code))
                            .map(item => ({ code: item.code, pointer: diagnosticPointer(item.pointer) })) : [];
                    const inputHash = preparation?.kind === 'unsupported' ? preparation.inputHash : undefined;
                    const version4 = sourceProtocol || preparation?.kind === 'unsupported' && preparation.schemaVersion === 2;
                    if (version4)
                        requireV4Deps();
                    const blocked = { ...identity,
                        ...(version4 ? { schemaVersion: 4, mode: 'unsupported' } : { schemaVersion: 3 }),
                        status: 'blocked', textRetained: false,
                        renderedText: '', initializationCode: code,
                        ...(diagnostics.length ? { initializationDiagnostics: diagnostics } : {}),
                        ...(validHash(inputHash) ? { initializationInputHash: inputHash } : {}) };
                    await deps.table.put(key, blocked);
                    return { status: 'busy', intent: blocked };
                }
                else if (preparation.plan.schemaVersion === 2) {
                    requireV4Deps();
                    intent = { ...identity, schemaVersion: 4, mode: 'native-json', status: 'pending', textRetained: true,
                        initialization: structuredClone(preparation.plan) };
                }
                else
                    intent = { ...identity, schemaVersion: 3, status: 'pending', textRetained: true,
                        initialization: structuredClone(preparation.plan) };
            }
            if (intent.schemaVersion === 6 && (!sourceCurrent(intent) || !runtimeCurrent(intent))) {
                const blocked = { ...intent, status: 'blocked', initializationCode: !sourceCurrent(intent)
                        ? 'PROMPT_TEMPLATE_SOURCE_CHANGED' : 'PROMPT_TEMPLATE_RUNTIME_REQUIRED' };
                await deps.table.put(key, blocked);
                return { status: 'busy', intent: blocked };
            }
            if (intent.schemaVersion === 4 && !sourceCurrent(intent)) {
                const blocked = { ...identity, schemaVersion: 4, mode: 'unsupported', status: 'blocked',
                    textRetained: false, renderedText: '', initializationCode: 'SOURCE_CHANGED',
                    initializationDiagnostics: [{ code: 'SOURCE_CHANGED', pointer: '/sourceSnapshot' }] };
                await deps.table.put(key, blocked);
                return { status: 'busy', intent: blocked };
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
        const saved = deps.table.get(openingIntentKey(sessionId, importId));
        if (saved?.schemaVersion === 5)
            return readIntentVerified(saved.source);
        if (saved?.schemaVersion === 6) {
            checkIntent(saved, sessionId, importId);
            const refused = await preflightExisting(saved);
            if (refused)
                return blockedProjection(saved, refused);
        }
        const result = await deps.withLock(`opening-choice:${sessionId}`, async () => {
            const key = openingIntentKey(sessionId, importId);
            const intent = deps.table.get(key);
            if (!intent)
                return null;
            checkIntent(intent, sessionId, importId);
            if (intent.schemaVersion === 5)
                return readIntent(intent.source);
            if (!current(intent.source))
                return intent.schemaVersion === 4 || intent.schemaVersion === 6
                    ? blockedProjection(intent, 'SOURCE_CHANGED') : null;
            if (intent.schemaVersion === 6 && !runtimeCurrent(intent))
                return blockedProjection(intent, 'PROMPT_TEMPLATE_RUNTIME_REQUIRED');
            if (intent.schemaVersion !== 2) {
                if (intent.status === 'blocked')
                    return intent;
                if (!sourceCurrent(intent))
                    return blockedProjection(intent, 'SOURCE_CHANGED');
                if (intent.status === 'completed')
                    return completedProjection(intent);
                if (intent.status === 'native-committed')
                    return { finish: structuredClone(intent) };
            }
            else if (intent.status === 'completed')
                return intent;
            const found = await deps.findOpeningByOperationId(intent);
            if ((intent.schemaVersion === 4 || intent.schemaVersion === 6) && !sameRecord(deps.table.get(key), intent)) {
                return blockedProjection(intent, 'IDENTITY_CONFLICT');
            }
            if (!current(intent.source))
                return null;
            if ((intent.schemaVersion === 4 || intent.schemaVersion === 6) && !sourceCurrent(intent)) {
                return blockedProjection(intent, 'SOURCE_CHANGED');
            }
            if (intent.schemaVersion === 2 && found.status !== 'committed' && !legacyAllowed(intent)) {
                return { ...intent, status: 'unknown' };
            }
            // Uncertain lookup can explain a refusal without authorizing another append.
            return found.status === 'committed' ? committedResult(await complete(key, intent, found.turn)) : diagnose(key, intent, found);
        });
        return result && 'finish' in result ? finish(result.finish) : result;
    };
    const readIntentVerified = async (source) => {
        const intent = deps.table.get(openingIntentKey(source.sessionId, source.importId));
        if (intent?.schemaVersion === 6) {
            checkIntent(intent, source.sessionId, source.importId);
            const refused = await preflightExisting(intent);
            return refused ? blockedProjection(intent, refused) : readIntent(source);
        }
        if (intent?.schemaVersion !== 5 || !deps.schemaOpening)
            return readIntent(source);
        const ready = await deps.schemaOpening.readVerified(source);
        return ready.kind === 'ready' ? ready.intent : ready.intent ?? readIntent(source);
    };
    return { readCatalog, readIntent, readIntentForObservation, readIntentVerified, select, recover };
}
