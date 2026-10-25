// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-task-edit-types.ts; edit the TypeScript source.
/** Message edits retain settled suffix DATA; they never create a task lease. */
import { recordSha256 } from './roleplay-data.js';
export class SchemaTaskEditNotAppliedError extends Error {
    intent;
    reason;
    constructor(intent, reason) {
        super('SCHEMA_TASK_EDIT_NOT_APPLIED');
        this.intent = intent;
        this.reason = reason;
    }
}
const hash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const validOperationId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
function fail() { throw Error('SCHEMA_TASK_EDIT_INVALID'); }
function recoveryFail() { throw Error('SCHEMA_USER_EDIT_RECOVERY_INVALID'); }
function fields(value, keys, reject = fail) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || keys.some(key => !Object.hasOwn(value, key)))
        reject();
}
function ref(value, reject = fail) {
    fields(value, ['key', 'sha256'], reject);
    if (typeof value.key !== 'string' || !value.key || !hash(value.sha256))
        reject();
}
export function validateSchemaTaskEditOptionsV1(value) {
    fields(value, ['schemaVersion', 'operationId', 'suffix']);
    if (value.schemaVersion !== 1 || value.suffix !== 'retain' || !validOperationId(value.operationId))
        fail();
    if (value.target !== undefined) {
        fields(value.target, ['expectedArtifactSha256', 'mode']);
        if (!hash(value.target.expectedArtifactSha256) || !['retain', 'replace', 'clear'].includes(String(value.target.mode)))
            fail();
    }
    return { schemaVersion: 1, operationId: value.operationId, suffix: 'retain',
        ...(value.target ? { target: { expectedArtifactSha256: value.target.expectedArtifactSha256,
                mode: value.target.mode } } : {}) };
}
export function validateSchemaTaskArtifactV1(value) {
    fields(value, ['canonicalSeq', 'originEventRef', 'sourceEventRef', 'effectiveKind']);
    ref(value.originEventRef);
    ref(value.sourceEventRef);
    if (!Number.isSafeInteger(value.canonicalSeq) || value.canonicalSeq < 0
        || !['patch', 'unchanged', 'cleared'].includes(value.effectiveKind))
        fail();
    return value;
}
export function validateSchemaTaskEditIntentV1(value) {
    fields(value, ['schemaVersion', 'encoding', 'sessionId', 'operationId', 'requestSha256', 'target', 'options', 'artifacts', 'basis', 'intentSha256']);
    fields(value.target, ['role', 'seq', 'messageId', 'text', 'previousVersionSha256']);
    fields(value.basis, ['nativeCut', 'sourceSha256', 'headSha256']);
    validateSchemaTaskEditOptionsV1(value.options);
    const { intentSha256, ...body } = value;
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-task-edit-intent-v1'
        || value.operationId !== value.options.operationId || typeof value.sessionId !== 'string'
        || !hash(value.requestSha256) || !hash(value.target.previousVersionSha256)
        || !['user', 'assistant'].includes(value.target.role) || !Number.isSafeInteger(value.target.seq)
        || typeof value.target.text !== 'string' || typeof value.target.messageId !== 'string'
        || !Number.isSafeInteger(value.basis.nativeCut) || value.basis.nativeCut <= value.target.seq
        || !hash(value.basis.sourceSha256) || !hash(value.basis.headSha256)
        || !Array.isArray(value.artifacts) || !value.artifacts.length || recordSha256(body) !== intentSha256)
        fail();
    for (const row of value.artifacts) {
        fields(row, ['canonicalSeq', 'artifact', 'mode']);
        validateSchemaTaskArtifactV1(row.artifact);
        if (row.canonicalSeq !== row.artifact.canonicalSeq || row.canonicalSeq < value.target.seq
            || !['retain', 'replace', 'clear'].includes(row.mode))
            fail();
    }
    return value;
}
export function validateSchemaTaskEditIntentV2(value) {
    fields(value, ['schemaVersion', 'encoding', 'scope', 'sessionId', 'operationId', 'requestSha256', 'target', 'options',
        'artifacts', 'basis', 'intentSha256']);
    fields(value.target, ['role', 'seq', 'messageId', 'text', 'previousVersionSha256']);
    fields(value.basis, ['nativeCut', 'sourceSha256', 'headSha256']);
    validateSchemaTaskEditOptionsV1(value.options);
    const { intentSha256, ...body } = value;
    if (value.schemaVersion !== 2 || value.encoding !== 'native-mvu-schema-suffix-edit-intent-v2'
        || value.scope !== 'settled-canonical-suffix' || value.operationId !== value.options.operationId
        || typeof value.sessionId !== 'string' || !hash(value.requestSha256) || !hash(value.target.previousVersionSha256)
        || value.target.role !== 'user' || !Number.isSafeInteger(value.target.seq)
        || typeof value.target.text !== 'string' || typeof value.target.messageId !== 'string' || value.options.target !== undefined
        || !Number.isSafeInteger(value.basis.nativeCut) || value.basis.nativeCut <= value.target.seq
        || !hash(value.basis.sourceSha256) || !hash(value.basis.headSha256)
        || !Array.isArray(value.artifacts) || value.artifacts.length !== 0 || recordSha256(body) !== intentSha256)
        fail();
    return value;
}
export function validateSchemaTaskEditIntent(value) {
    return value.schemaVersion === 2 ? validateSchemaTaskEditIntentV2(value) : validateSchemaTaskEditIntentV1(value);
}
export function validateSchemaTaskEditBindingV1(value) {
    fields(value, ['schemaVersion', 'encoding', 'sessionId', 'intent', 'edit', 'bindingSha256']);
    ref(value.intent);
    fields(value.edit, ['seq', 'sha256']);
    const { bindingSha256, ...body } = value;
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-task-edit-binding-v1'
        || typeof value.sessionId !== 'string' || !Number.isSafeInteger(value.edit.seq) || !hash(value.edit.sha256)
        || recordSha256(body) !== bindingSha256)
        fail();
    return value;
}
export function validateSchemaExistingUserEditRequestOrigin(value) {
    fields(value, ['sessionId', 'seq', 'messageId'], recoveryFail);
    if (typeof value.sessionId !== 'string' || !value.sessionId || typeof value.messageId !== 'string' || !value.messageId
        || !Number.isSafeInteger(value.seq) || Number(value.seq) < 0)
        recoveryFail();
    return { sessionId: value.sessionId, seq: value.seq, messageId: value.messageId };
}
export function validateSchemaExistingUserEditRecoveryRequest(value) {
    fields(value, ['recoveryOperationId', 'oldSaveRef', 'editRef'], recoveryFail);
    ref(value.oldSaveRef, recoveryFail);
    fields(value.editRef, ['seq', 'sha256'], recoveryFail);
    if (!validOperationId(value.recoveryOperationId) || !Number.isSafeInteger(value.editRef.seq)
        || Number(value.editRef.seq) < 0 || !hash(value.editRef.sha256))
        recoveryFail();
    return { recoveryOperationId: value.recoveryOperationId, oldSaveRef: value.oldSaveRef,
        editRef: { seq: value.editRef.seq, sha256: value.editRef.sha256 },
        ...(value.requestOrigin === undefined ? {} : { requestOrigin: validateSchemaExistingUserEditRequestOrigin(value.requestOrigin) }) };
}
export function validateSchemaExistingUserEditRecoveryIntentV1(value) {
    fields(value, ['schemaVersion', 'encoding', 'operationId', 'sessionId', 'save', 'requestOrigin', 'edit', 'fence', 'intentSha256'], recoveryFail);
    ref(value.save, recoveryFail);
    validateSchemaExistingUserEditRequestOrigin(value.requestOrigin);
    fields(value.edit, ['seq', 'sha256'], recoveryFail);
    fields(value.fence, ['nativeCut', 'sourceSha256'], recoveryFail);
    const { intentSha256, ...body } = value;
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-user-edit-recovery-intent-v1'
        || !validOperationId(value.operationId) || typeof value.sessionId !== 'string' || !value.sessionId
        || !Number.isSafeInteger(value.edit.seq) || value.edit.seq < 0 || !hash(value.edit.sha256)
        || !Number.isSafeInteger(value.fence.nativeCut) || value.fence.nativeCut <= value.edit.seq
        || !hash(value.fence.sourceSha256) || recordSha256(body) !== intentSha256)
        recoveryFail();
    return value;
}
export const schemaTaskEditIntentKey = (sid, id) => `${sid}__mvu-state-schema-task-edit-intent-${id}`;
export const schemaTaskEditBindingKey = (sid, id) => `${sid}__mvu-state-schema-task-edit-binding-${id}`;
export const schemaTaskEditActiveKey = (sid) => `${sid}__mvu-state-schema-task-edit-active`;
export const schemaExistingUserEditRecoveryIntentKey = (sid, id) => `${sid}__mvu-state-schema-user-edit-recovery-intent-${id}`;
