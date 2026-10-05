// Generated from runtime/alpha3/src/ui/tavern-lore-editor-data.ts; edit the TypeScript source.
export const LORE_EDITOR_REQUEST_BYTES_V1 = 1_048_576;
export const LORE_EDITOR_PENDING_BYTES_V1 = 4_194_304;
export const LORE_EDITOR_BOOL_FIELDS_V1 = Object.freeze(['enabled', 'constant', 'selective', 'ignoreBudget',
    'excludeRecursion', 'preventRecursion', 'useProbability', 'groupOverride', 'vectorized', 'matchPersonaDescription',
    'matchCharacterDescription', 'matchCharacterPersonality', 'matchCharacterDepthPrompt', 'matchScenario', 'matchCreatorNotes']);
export const LORE_EDITOR_NULL_BOOL_FIELDS_V1 = Object.freeze(['caseSensitive', 'matchWholeWords', 'useGroupScoring']);
export const LORE_EDITOR_NUMBER_FIELDS_V1 = Object.freeze(['order', 'displayIndex', 'depth', 'probability', 'groupWeight']);
export const LORE_EDITOR_NULL_NUMBER_FIELDS_V1 = Object.freeze(['scanDepth', 'sticky', 'cooldown', 'delay']);
export const LORE_EDITOR_STRING_FIELDS_V1 = Object.freeze(['group', 'outletName', 'automationId', 'content']);
export const LORE_EDITOR_ARRAY_FIELDS_V1 = Object.freeze(['primaryKeys', 'secondaryKeys', 'triggers']);
export const LORE_EDITOR_POSITIONS_V1 = Object.freeze(['before-character', 'after-character', 'before-authors-note',
    'after-authors-note', 'at-chat-depth', 'before-examples', 'after-examples', 'named-outlet']);
export const LORE_EDITOR_LOGIC_V1 = Object.freeze(['and-any', 'not-all', 'not-any', 'and-all']);
export const LORE_EDITOR_ROLES_V1 = Object.freeze(['system', 'user', 'assistant']);
const fieldOrder = [...LORE_EDITOR_BOOL_FIELDS_V1, ...LORE_EDITOR_NULL_BOOL_FIELDS_V1,
    ...LORE_EDITOR_NUMBER_FIELDS_V1, ...LORE_EDITOR_NULL_NUMBER_FIELDS_V1, ...LORE_EDITOR_STRING_FIELDS_V1,
    ...LORE_EDITOR_ARRAY_FIELDS_V1, 'position', 'selectiveLogic', 'role', 'keyMatcher', 'delayUntilRecursion'];
const SID = /^[a-zA-Z0-9_-]{1,128}$/, HASH = /^[a-f0-9]{64}$/;
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const bytes = (text) => new TextEncoder().encode(text).byteLength;
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const member = (x, list) => typeof x === 'string' && list.includes(x);
export class TavernLoreEditorDataErrorV1 extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
        this.name = 'TavernLoreEditorDataErrorV1';
    }
}
function fail(code) { throw new TavernLoreEditorDataErrorV1(code); }
function exact(x, keys) {
    if (Object.keys(x).length !== keys.length || Object.keys(x).some(k => !keys.includes(k)))
        fail('LORE_EDITOR_DATA_SHAPE');
}
/** Only parse bounded JSON text from owned serialization/storage, never execute
 * arbitrary object coercion. JSON cannot carry getters/functions/Proxies. */
function parse(text, maxBytes) {
    if (typeof text !== 'string' || bytes(text) > maxBytes)
        fail('LORE_EDITOR_DATA_LIMIT');
    let root;
    try {
        root = JSON.parse(text);
    }
    catch {
        fail('LORE_EDITOR_DATA_JSON');
    }
    let nodes = 0;
    const visit = (x, depth) => {
        if (++nodes > 131_072 || depth > 66)
            fail('LORE_EDITOR_DATA_LIMIT');
        if (x === null || typeof x === 'string' || typeof x === 'boolean')
            return;
        if (typeof x === 'number') {
            if (!Number.isFinite(x) || Math.abs(x) > Number.MAX_SAFE_INTEGER)
                fail('LORE_EDITOR_DATA_NUMBER');
            return;
        }
        if (Array.isArray(x)) {
            if (x.length > 4096)
                fail('LORE_EDITOR_DATA_LIMIT');
            for (const child of x)
                visit(child, depth + 1);
            return;
        }
        if (!object(x))
            fail('LORE_EDITOR_DATA_VALUE');
        for (const [key, child] of Object.entries(x)) {
            if (forbidden.has(key))
                fail('LORE_EDITOR_DATA_KEY');
            visit(child, depth + 1);
        }
    };
    visit(root, 0);
    return root;
}
function freeze(x) {
    if (x && typeof x === 'object') {
        for (const value of Object.values(x))
            freeze(value);
        Object.freeze(x);
    }
    return x;
}
export function validateTavernLoreEditorFieldV1(field, value) {
    if (!member(field, fieldOrder))
        fail('LORE_EDITOR_FIELD_UNKNOWN');
    if (member(field, LORE_EDITOR_BOOL_FIELDS_V1)) {
        if (typeof value !== 'boolean')
            fail('LORE_EDITOR_FIELD_BOOLEAN');
        return;
    }
    if (member(field, LORE_EDITOR_NULL_BOOL_FIELDS_V1)) {
        if (value !== null && typeof value !== 'boolean')
            fail('LORE_EDITOR_FIELD_BOOLEAN');
        return;
    }
    if (member(field, [...LORE_EDITOR_NUMBER_FIELDS_V1, ...LORE_EDITOR_NULL_NUMBER_FIELDS_V1])) {
        if (value === null && member(field, LORE_EDITOR_NULL_NUMBER_FIELDS_V1))
            return;
        if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
            fail('LORE_EDITOR_FIELD_NUMBER');
        if (member(field, ['depth', 'displayIndex', 'scanDepth', 'sticky', 'cooldown', 'delay'])
            && (!Number.isSafeInteger(value) || value < 0))
            fail('LORE_EDITOR_FIELD_NUMBER');
        if (field === 'groupWeight' && value < 0 || field === 'probability' && (value < 0 || value > 100)
            || field === 'order' && Math.abs(value) > 1_000_000)
            fail('LORE_EDITOR_FIELD_NUMBER');
        return;
    }
    if (member(field, LORE_EDITOR_STRING_FIELDS_V1)) {
        if (typeof value !== 'string' || bytes(value) > (field === 'content' ? LORE_EDITOR_REQUEST_BYTES_V1 : 4096))
            fail('LORE_EDITOR_FIELD_TEXT');
        return;
    }
    if (member(field, LORE_EDITOR_ARRAY_FIELDS_V1)) {
        if (!Array.isArray(value) || value.length > 256 || value.some(v => typeof v !== 'string' || v.length > 4096 || bytes(v) > 4096))
            fail('LORE_EDITOR_FIELD_KEYS');
        return;
    }
    if (field === 'delayUntilRecursion') {
        if (typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0))
            fail('LORE_EDITOR_FIELD_NUMBER');
        return;
    }
    if (field === 'keyMatcher') {
        if (value !== 'st-slash-regex-or-literal-v1')
            fail('LORE_EDITOR_FIELD_ENUM');
        return;
    }
    if (!member(value, field === 'position' ? LORE_EDITOR_POSITIONS_V1 :
        field === 'role' ? LORE_EDITOR_ROLES_V1 : LORE_EDITOR_LOGIC_V1))
        fail('LORE_EDITOR_FIELD_ENUM');
}
function canonicalRequest(raw) {
    if (!object(raw))
        fail('LORE_EDITOR_REQUEST_INVALID');
    exact(raw, ['sessionId', 'expectedSourceSha256', 'expectedRevision', 'operationId', 'rawEntryPointer', 'rawEntrySha256', 'fields']);
    if (typeof raw.sessionId !== 'string' || !SID.test(raw.sessionId) || typeof raw.operationId !== 'string' || !SID.test(raw.operationId)
        || typeof raw.expectedSourceSha256 !== 'string' || !HASH.test(raw.expectedSourceSha256)
        || typeof raw.rawEntrySha256 !== 'string' || !HASH.test(raw.rawEntrySha256)
        || typeof raw.expectedRevision !== 'number' || !Number.isSafeInteger(raw.expectedRevision)
        || raw.expectedRevision < 0 || raw.expectedRevision > 256 || typeof raw.rawEntryPointer !== 'string'
        || !raw.rawEntryPointer.startsWith('/') || bytes(raw.rawEntryPointer) > 4096 || /[\x00-\x1f]/.test(raw.rawEntryPointer)
        || !object(raw.fields) || !Object.keys(raw.fields).length)
        fail('LORE_EDITOR_REQUEST_INVALID');
    for (const [key, value] of Object.entries(raw.fields))
        validateTavernLoreEditorFieldV1(key, value);
    const fields = {};
    for (const key of fieldOrder)
        if (Object.hasOwn(raw.fields, key))
            fields[key] = raw.fields[key];
    return freeze({ sessionId: raw.sessionId, expectedSourceSha256: raw.expectedSourceSha256, expectedRevision: raw.expectedRevision,
        operationId: raw.operationId, rawEntryPointer: raw.rawEntryPointer, rawEntrySha256: raw.rawEntrySha256,
        fields: fields });
}
export function canonicalTavernLoreEditRequestV1(request) {
    return canonicalRequest(parse(JSON.stringify(request), LORE_EDITOR_REQUEST_BYTES_V1));
}
/** Same existing record-hash semantics for the strict JSON HTTP domain: UTF-16
 * key order and literal JSON primitives. This is comparison data, not authority. */
function recordJson(value) {
    if (value === null || typeof value !== 'object') {
        const text = JSON.stringify(value);
        if (typeof text !== 'string')
            fail('LORE_EDITOR_DATA_VALUE');
        return text;
    }
    if (Array.isArray(value))
        return '[' + value.map(recordJson).join(',') + ']';
    const x = value;
    return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + recordJson(x[k])).join(',') + '}';
}
export async function tavernLoreEditPayloadSha256V1(request) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(recordJson(request)));
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}
const storageKey = (sid) => {
    if (!SID.test(sid))
        fail('LORE_EDITOR_SESSION_INVALID');
    return 'nexttavern-lore-pending-v1:' + sid;
};
export function createTavernLoreEditorPendingV1(request, payloadSha256) {
    if (!HASH.test(payloadSha256))
        fail('LORE_EDITOR_PENDING_HASH');
    const canonical = canonicalTavernLoreEditRequestV1(request);
    return freeze({ schemaVersion: 1, encoding: 'tavern-lore-editor-pending-v1', sessionId: canonical.sessionId,
        operationId: canonical.operationId, request: canonical, body: JSON.stringify(canonical), payloadSha256 });
}
export async function readTavernLoreEditorPendingV1(storage, sid) {
    const raw = storage.getItem(storageKey(sid));
    if (raw === null)
        return null;
    const x = parse(raw, LORE_EDITOR_PENDING_BYTES_V1);
    if (!object(x))
        fail('LORE_EDITOR_PENDING_INVALID');
    exact(x, ['schemaVersion', 'encoding', 'sessionId', 'operationId', 'request', 'body', 'payloadSha256']);
    if (x.schemaVersion !== 1 || x.encoding !== 'tavern-lore-editor-pending-v1' || x.sessionId !== sid
        || typeof x.body !== 'string' || typeof x.payloadSha256 !== 'string' || !HASH.test(x.payloadSha256))
        fail('LORE_EDITOR_PENDING_INVALID');
    const request = canonicalRequest(x.request);
    if (request.sessionId !== sid || x.operationId !== request.operationId || JSON.stringify(request) !== x.body
        || bytes(x.body) > LORE_EDITOR_REQUEST_BYTES_V1 || await tavernLoreEditPayloadSha256V1(request) !== x.payloadSha256)
        fail('LORE_EDITOR_PENDING_INVALID');
    return createTavernLoreEditorPendingV1(request, x.payloadSha256);
}
export function persistTavernLoreEditorPendingV1(storage, pending) {
    const text = JSON.stringify(pending);
    if (bytes(text) > LORE_EDITOR_PENDING_BYTES_V1)
        fail('LORE_EDITOR_DATA_LIMIT');
    const key = storageKey(pending.sessionId), prior = storage.getItem(key);
    if (prior !== null && prior !== text)
        fail('LORE_EDITOR_PENDING_CONFLICT');
    storage.setItem(key, text);
    if (storage.getItem(key) !== text)
        fail('LORE_EDITOR_PENDING_READBACK');
}
export function clearTavernLoreEditorPendingV1(storage, pending) {
    const key = storageKey(pending.sessionId);
    if (storage.getItem(key) !== JSON.stringify(pending))
        fail('LORE_EDITOR_PENDING_CONFLICT');
    storage.removeItem(key);
    if (storage.getItem(key) !== null)
        fail('LORE_EDITOR_PENDING_READBACK');
}
export function tavernLoreReceiptMatchesV1(receipt, pending) {
    return receipt.schemaVersion === 1 && receipt.encoding === 'tavern-lore-edit-receipt-v1'
        && receipt.authority === 'consumer-data-only' && receipt.operationId === pending.operationId
        && receipt.payloadSha256 === pending.payloadSha256 && receipt.editSourceSha256 === pending.request.expectedSourceSha256
        && receipt.rawEntryPointer === pending.request.rawEntryPointer && receipt.rawEntrySha256 === pending.request.rawEntrySha256
        && receipt.revision === pending.request.expectedRevision + 1;
}
