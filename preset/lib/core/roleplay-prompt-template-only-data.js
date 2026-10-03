// Generated from runtime/alpha3/src/core/roleplay-prompt-template-only-data.ts; edit the TypeScript source.
/** Bounded records and exact EJS coverage. This is a tokenizer, not a JS AST
 * effect proof. Programs remain unexecuted until an actual protected owner. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { TEMPLATE_LIMITS_V1, TEMPLATE_POLICY_SHA256 } from './tavern-template-data.mjs';
export const PROMPT_TEMPLATE_ONLY_FIELDS_V1 = Object.freeze(['description', 'personality', 'scenario', 'mes_example',
    'system_prompt', 'post_history_instructions']);
export const PROMPT_TEMPLATE_ONLY_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-prompt-template-only-domain-policy-v1', rawDomain: 'own-structured-replace-CCv2-CCv3-no-character-book',
    normalizers: ['tavern-fields-v1', 'tavern-fields-v2'], fields: PROMPT_TEMPLATE_ONLY_FIELDS_V1,
    tokenizer: 'owned-EJS-literal-expression-statement-full-UTF16-offset-coverage-v1',
    program: 'unexecuted-protected-prompt-program; not-a-JS-effect-or-success-proof',
    projection: 'original-projector-complete-section-map-actual-assignment-spans-and-current-owned-field-bytes-v1',
    numerical: 'none; actual-complete-numerical-and-opaque-namespace-inventory',
    opening: 'all-alternatives-strict-plain-identity-macros; unchanged-Native-zero-model',
    runtime: 'actual-owner-preflight-and-current; no-serialized-capability',
    root: 'actual-session-parent-prefix-and-complete-known-root-meta-shape; no-unproven-inheritance',
    sourceChars: TEMPLATE_LIMITS_V1.sourceChars, fieldCount: 6, proofBytes: 16_777_216 });
export const PROMPT_TEMPLATE_ONLY_POLICY_SHA256 = recordSha256(PROMPT_TEMPLATE_ONLY_POLICY_V1);
export const PROMPT_TEMPLATE_ONLY_CODES_V1 = Object.freeze([
    'PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN', 'PROMPT_TEMPLATE_OPENING_UNSUPPORTED',
    'PROMPT_TEMPLATE_CURRENT_ORIGIN_UNPROVEN', 'PROMPT_TEMPLATE_RUNTIME_REQUIRED',
    'PROMPT_TEMPLATE_PROTOCOL_UNAVAILABLE', 'PROMPT_TEMPLATE_NUMERICAL_STATE_PRESENT', 'PROMPT_TEMPLATE_SOURCE_CHANGED',
    'PROMPT_TEMPLATE_SEGMENT_INVALID', 'PROMPT_TEMPLATE_BUDGET', 'PROMPT_TEMPLATE_RECORD_INVALID',
    'PROMPT_TEMPLATE_INHERITANCE_UNPROVEN'
]);
export class PromptTemplateOnlyRefusalV1 extends Error {
    code;
    pointer;
    constructor(code, pointer) {
        super(code);
        this.code = code;
        this.pointer = pointer;
    }
}
export function promptTemplateOnlyFail(code, pointer) {
    throw new PromptTemplateOnlyRefusalV1(code, pointer);
}
export function freezePromptTemplateOnlyDataV1(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freezePromptTemplateOnlyDataV1(child);
        Object.freeze(value);
    }
    return value;
}
export function clonePromptTemplateOnlyDataV1(value) {
    try {
        return cloneRoleplayTavernLoreDataV1(value, 16_777_216);
    }
    catch {
        return promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/record');
    }
}
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = (left, right) => recordSha256(left) === recordSha256(right);
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
function exact(value, keys) {
    if (!object(value) || Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) {
        promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/record');
    }
}
/** Complete partition, including delimiter bytes. Literal validation stays in
 * the Source producer; execution belongs to the existing hermetic component. */
export function segmentPromptTemplateOnlyFieldV1(text, pointer) {
    if (typeof text !== 'string' || text.length > TEMPLATE_LIMITS_V1.sourceChars) {
        promptTemplateOnlyFail('PROMPT_TEMPLATE_BUDGET', pointer);
    }
    const result = [];
    let cursor = 0;
    while (cursor < text.length) {
        const open = text.indexOf('<%', cursor);
        const literalEnd = open < 0 ? text.length : open;
        if (text.slice(cursor, literalEnd).includes('%>'))
            promptTemplateOnlyFail('PROMPT_TEMPLATE_SEGMENT_INVALID', pointer);
        if (literalEnd > cursor)
            result.push({ kind: 'literal', start: cursor, end: literalEnd,
                textSha256: sha256(text.slice(cursor, literalEnd)), sourcePointer: pointer, program: null });
        if (open < 0) {
            cursor = text.length;
            break;
        }
        const close = text.indexOf('%>', open + 2), first = text[open + 2];
        if (close < 0 || first === '%' || first === '#' || first === '_' || text[close - 1] === '-' || text[close - 1] === '_') {
            promptTemplateOnlyFail('PROMPT_TEMPLATE_SEGMENT_INVALID', pointer);
        }
        const expression = first === '=' || first === '-', bodyStart = open + (expression ? 3 : 2), body = text.slice(bodyStart, close);
        if (body.includes('<%') || expression && !body.trim())
            promptTemplateOnlyFail('PROMPT_TEMPLATE_SEGMENT_INVALID', pointer);
        result.push({ kind: expression ? 'expression' : 'statement', start: open, end: close + 2,
            textSha256: sha256(text.slice(open, close + 2)), sourcePointer: pointer,
            program: { disposition: 'protected-prompt-program', bodyStart, bodyEnd: close, bodySha256: sha256(body),
                output: expression ? first === '=' ? 'raw-expression-equals' : 'raw-expression-minus' : 'code' } });
        cursor = close + 2;
    }
    let covered = 0;
    for (const part of result) {
        if (part.start !== covered || part.end <= part.start)
            promptTemplateOnlyFail('PROMPT_TEMPLATE_SEGMENT_INVALID', pointer);
        covered = part.end;
    }
    if (covered !== text.length)
        promptTemplateOnlyFail('PROMPT_TEMPLATE_SEGMENT_INVALID', pointer);
    return freezePromptTemplateOnlyDataV1(result);
}
/** Validate stored consumer data only. current() always reconstructs the full
 * actual Source. No matching self-signed hash is an owner or Runtime proof. */
export function validatePromptTemplateOnlySourceProofV1(input) {
    const value = clonePromptTemplateOnlyDataV1(input);
    exact(value, ['schemaVersion', 'encoding', 'authority', 'policySha256', 'sourceSnapshot', 'primaryBookAbsence',
        'templateFields', 'fieldInventorySha256', 'exclusionInventorySha256', 'initialization', 'requiredPromptRuntime', 'proofSha256']);
    if (value.schemaVersion !== 1 || value.encoding !== 'native-prompt-template-only-source-proof-v1'
        || value.authority !== 'consumer-data-only' || value.policySha256 !== PROMPT_TEMPLATE_ONLY_POLICY_SHA256
        || !hash(value.proofSha256) || !Array.isArray(value.templateFields) || value.templateFields.length !== 6) {
        promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/proof');
    }
    const { proofSha256, ...body } = value;
    if (recordSha256(body) !== proofSha256)
        promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/proof');
    exact(value.requiredPromptRuntime, ['protocol', 'policySha256']);
    exact(value.initialization, ['kind', 'scopeInventorySha256']);
    if (value.requiredPromptRuntime.protocol !== 'owned-template-v1' || value.requiredPromptRuntime.policySha256 !== TEMPLATE_POLICY_SHA256
        || value.initialization.kind !== 'none' || !object(value.sourceSnapshot)
        || value.initialization.scopeInventorySha256 !== value.sourceSnapshot.scopeInventory?.inventorySha256
        || !hash(value.fieldInventorySha256) || recordSha256(value.templateFields) !== value.fieldInventorySha256
        || !hash(value.exclusionInventorySha256))
        promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/proof');
    const snapshot = value.sourceSnapshot;
    if (snapshot.schemaVersion !== 1 || snapshot.encoding !== 'native-prompt-template-only-source-snapshot-v1'
        || !hash(snapshot.snapshotSha256))
        promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/snapshot');
    const { snapshotSha256, ...snapshotBody } = snapshot;
    if (recordSha256(snapshotBody) !== snapshotSha256)
        promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/snapshot');
    for (const [index, raw] of value.templateFields.entries()) {
        exact(raw, ['field', 'sourcePointer', 'presence', 'rawText', 'rawTextSha256', 'rawLength', 'segments', 'segmentsSha256',
            'normalizedText', 'normalizedSegments', 'normalizedSegmentsSha256', 'projection']);
        const pointer = `/data/${PROMPT_TEMPLATE_ONLY_FIELDS_V1[index]}`;
        if (raw.field !== PROMPT_TEMPLATE_ONLY_FIELDS_V1[index] || raw.sourcePointer !== pointer || !hash(raw.segmentsSha256)
            || recordSha256(raw.segments) !== raw.segmentsSha256 || !hash(raw.normalizedSegmentsSha256)
            || recordSha256(raw.normalizedSegments) !== raw.normalizedSegmentsSha256)
            promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', pointer);
        if (raw.presence === 'absent') {
            if (raw.rawText !== null || raw.rawTextSha256 !== null || raw.rawLength !== 0 || !same(raw.segments, []) || raw.projection !== null
                || raw.normalizedText !== null || !same(raw.normalizedSegments, [])) {
                promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', pointer);
            }
        }
        else if (raw.presence !== 'text' || typeof raw.rawText !== 'string' || sha256(raw.rawText) !== raw.rawTextSha256
            || raw.rawLength !== raw.rawText.length || !same(segmentPromptTemplateOnlyFieldV1(raw.rawText, pointer), raw.segments)) {
            promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', pointer);
        }
        if (raw.presence === 'text') {
            const normalized = raw.rawText === '' ? '' : String(raw.rawText).replace(/\r\n?/g, '\n') + '\n';
            if (raw.normalizedText !== normalized || !same(segmentPromptTemplateOnlyFieldV1(normalized, pointer), raw.normalizedSegments)
                || object(raw.projection) && raw.projection.normalizedTextSha256 !== sha256(normalized)) {
                promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', pointer);
            }
        }
    }
    const proof = value;
    const absence = proof.primaryBookAbsence;
    if (absence?.encoding !== 'st-character-book-proven-absence-data-v1' || absence.authority !== 'consumer-data-only'
        || absence.ownerSessionId !== proof.sourceSnapshot.source.sessionId
        || absence.sourceRecordSessionId !== absence.ownerSessionId
        || absence.rawSha256 !== proof.sourceSnapshot.source.rawSha256
        || absence.importId !== proof.sourceSnapshot.source.importId
        || absence.documentSha256 !== proof.sourceSnapshot.documentSha256) {
        promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/primaryBookAbsence');
    }
    return freezePromptTemplateOnlyDataV1(proof);
}
export function validatePromptTemplateOnlyOpeningIntentV6(input) {
    const row = clonePromptTemplateOnlyDataV1(input);
    if (!object(row) || Object.keys(row).some(key => !['schemaVersion', 'sessionId', 'source', 'index', 'sourcePointer',
        'sourceSha256', 'renderedSha256', 'renderedText', 'messageId', 'operationId', 'revision', 'committedTurn',
        'rejectionCode', 'mode', 'status', 'textRetained', 'promptTemplateSourceProof', 'nativeReceipt', 'initializationCode'].includes(key))) {
        promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/intent');
    }
    const proof = validatePromptTemplateOnlySourceProofV1(row.promptTemplateSourceProof), source = proof.sourceSnapshot.source;
    if (row.schemaVersion !== 6 || row.mode !== 'prompt-template-only' || row.textRetained !== true
        || !same(row.source, source) || row.sessionId !== source.sessionId || !Number.isSafeInteger(row.revision) || Number(row.revision) < 1
        || typeof row.operationId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(row.operationId)
        || row.messageId !== `opening-${sha256(`${row.sessionId}\0${source.importId}\0${row.operationId}`).slice(0, 32)}`
        || row.index !== proof.sourceSnapshot.selected.index || row.sourcePointer !== proof.sourceSnapshot.selected.pointer
        || row.sourceSha256 !== proof.sourceSnapshot.selected.sourceSha256
        || row.renderedSha256 !== proof.sourceSnapshot.selected.renderedSha256 || typeof row.renderedText !== 'string'
        || sha256(row.renderedText) !== row.renderedSha256 || Buffer.byteLength(row.renderedText, 'utf8') > 65_536
        || !['pending', 'busy', 'unknown', 'blocked', 'native-committed', 'completed'].includes(String(row.status))) {
        promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/intent');
    }
    const initializationCodes = [...PROMPT_TEMPLATE_ONLY_CODES_V1, 'PREPARE_UNSUPPORTED', 'PREPARE_FAILED',
        'INITIALIZATION_UNKNOWN', 'INITIALIZATION_RECEIPT_INVALID', 'SOURCE_CHANGED', 'EVENT_MISSING', 'HEAD_MISSING',
        'RECORD_INVALID', 'IDENTITY_CONFLICT', 'NATIVE_NOT_COMMITTED', 'BASIS_UNPROVEN', 'BASIS_CHANGED'];
    const rejectionCodes = ['PROGRAMMATIC_IDENTITY_CONFLICT', 'PROGRAMMATIC_OPEN_TURN', 'PROGRAMMATIC_MISSING_SYSTEM_HEAD',
        'PROGRAMMATIC_UNATTRIBUTED_FAILURE', 'PROGRAMMATIC_INCOMPLETE_TURN'];
    if (row.initializationCode !== undefined && !initializationCodes.includes(String(row.initializationCode))
        || row.rejectionCode !== undefined && !rejectionCodes.includes(String(row.rejectionCode))) {
        promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/intent/code');
    }
    const committed = row.status === 'native-committed' || row.status === 'completed';
    if (committed && (!Number.isSafeInteger(row.committedTurn) || Number(row.committedTurn) <= 0)
        || !committed && row.committedTurn !== undefined || row.status !== 'completed' && row.nativeReceipt !== undefined) {
        promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/intent');
    }
    if (row.status === 'completed') {
        const native = row.nativeReceipt;
        if (!object(native) || Object.keys(native).some(key => !['sessionId', 'operationId', 'messageId', 'renderedSha256',
            'turn', 'assistantSeq', 'turnStartSeq', 'turnEndSeq', 'messageVersion', 'flushed'].includes(key))
            || native.sessionId !== row.sessionId || native.operationId !== row.operationId || native.messageId !== row.messageId
            || native.renderedSha256 !== row.renderedSha256 || native.turn !== row.committedTurn || native.flushed !== true
            || !object(native.messageVersion) || !same(Object.keys(native.messageVersion).sort(), ['eventSha256', 'kind'])
            || native.messageVersion.kind !== 'original' || !hash(native.messageVersion.eventSha256)
            || ![native.turnStartSeq, native.assistantSeq, native.turnEndSeq].every(value => Number.isSafeInteger(value) && Number(value) >= 0)
            || Number(native.turnStartSeq) >= Number(native.assistantSeq) || Number(native.assistantSeq) >= Number(native.turnEndSeq)) {
            promptTemplateOnlyFail('PROMPT_TEMPLATE_RECORD_INVALID', '/nativeReceipt');
        }
    }
    return freezePromptTemplateOnlyDataV1(row);
}
