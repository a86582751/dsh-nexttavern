// Generated from runtime/alpha3/src/core/roleplay-phase-a-row-facts.ts; edit the TypeScript source.
/** Actual Phase-A writer provenance over inert branch DTOs. This registry has
 * no Source/Native/admission check and never recreates a hot preparation. */
import { recordSha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { types } from 'node:util';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, minimum = 0) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= minimum && !Object.is(value, -0);
function fail() { throw Error('PROGRAM_ABSENCE_PHASE_A_ROW_CHANGED'); }
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const item of Object.values(value))
            freeze(item);
        Object.freeze(value);
    }
    return value;
}
const string = (value) => typeof value === 'string' && value.length > 0;
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const tokens = (value) => typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= Number.MAX_SAFE_INTEGER && !Object.is(value, -0);
function keys(value, required, optional = []) {
    if (required.some(key => !Object.hasOwn(value, key))
        || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key)))
        fail();
}
/** SHA alone omits undefined object fields. Complete own-data comparison also
 * rejects extra keys/accessors/proxies and JSON normalization aliases. */
function sameData(actual, expected) {
    if (Object.is(actual, expected))
        return true;
    if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object'
        || types.isProxy(actual) || types.isProxy(expected) || Array.isArray(actual) !== Array.isArray(expected))
        return false;
    if (Array.isArray(actual) ? Object.getPrototypeOf(actual) !== Array.prototype
        : ![Object.prototype, null].includes(Object.getPrototypeOf(actual)))
        return false;
    const left = Object.getOwnPropertyDescriptors(actual), right = Object.getOwnPropertyDescriptors(expected), leftKeys = Reflect.ownKeys(actual), rightKeys = Reflect.ownKeys(expected);
    return leftKeys.length === rightKeys.length && leftKeys.every(key => typeof key === 'string' && rightKeys.includes(key))
        && rightKeys.every(key => {
            if (typeof key !== 'string')
                return false;
            const a = left[key], b = right[key];
            return !!a && !!b && Object.hasOwn(a, 'value') && Object.hasOwn(b, 'value') && a.enumerable === b.enumerable
                && sameData(a.value, b.value);
        });
}
function currency(value) {
    if (!object(value))
        fail();
    keys(value, ['schemaVersion', 'preparationId', 'credentialSha256', 'receiptGeneration', 'attemptGeneration', 'source'], ['snapshot']);
    if (value['schemaVersion'] !== 2 || !string(value['preparationId']) || !hash(value['credentialSha256'])
        || !integer(value['receiptGeneration'], 1) || !integer(value['attemptGeneration'], 1) || !object(value['source']))
        fail();
    const source = value['source'];
    if (!hash(source['sourceSha256']))
        fail();
    if (source['kind'] === 'legacy' || source['kind'] === 'management') {
        keys(source, ['kind', 'sourceSha256', 'reason']);
        if (!string(source['reason']))
            fail();
    }
    else {
        keys(source, ['kind', 'sourceSha256'], ['headRef', 'absenceScopeRef']);
        const head = source['headRef'], absence = source['absenceScopeRef'], ref = head ?? absence;
        if (source['kind'] !== 'story' || !!head === !!absence || !object(ref) || !hash(ref['sha256']))
            fail();
        keys(ref, ['kind', 'sha256']);
        if (head ? !['numerical-head', 'schema-head'].includes(String(ref['kind']))
            : !['plain-absence', 'prompt-template-only-domain', 'inherited-prompt-domain', 'prompt-program-domain',
                'prompt-program-inherited-domain']
                .includes(String(ref['kind'])))
            fail();
    }
    if (value['snapshot'] !== undefined) {
        const ref = value['snapshot'];
        if (!object(ref))
            fail();
        keys(ref, ['key', 'sha256']);
        if (!string(ref['key']) || !hash(ref['sha256']))
            fail();
    }
    return value;
}
function assertSnapshot(value, session) {
    keys(value, ['schemaVersion', 'sessionId', 'branchId', 'turnId', 'baseRevision', 'lastSeq', 'userMessageId', 'userText',
        'cardVersion', 'worldbookVersion', 'memoryVersion', 'contextWindow'], ['inputPreparation', 'numericalState', 'memoryProjection', 'contextMessageRefs']);
    if (!integer(value['turnId'], 1) || !integer(value['baseRevision'], -1) || value['lastSeq'] !== value['baseRevision']
        || value['userMessageId'] !== null && !string(value['userMessageId']) || typeof value['userText'] !== 'string'
        || value['cardVersion'] !== null || value['worldbookVersion'] !== null || !object(value['contextWindow']))
        fail();
    const window = value['contextWindow'];
    keys(window, ['windowNumber', 'windowId', 'previousWindowId', 'rollover']);
    if (!integer(window['windowNumber'], 1) || !string(window['windowId'])
        || window['previousWindowId'] !== null && !string(window['previousWindowId']) || typeof window['rollover'] !== 'boolean')
        fail();
    if (value['inputPreparation'] !== undefined)
        currency(value['inputPreparation']);
    if (value['memoryProjection'] !== undefined) {
        const projection = value['memoryProjection'];
        if (!object(projection))
            fail();
        keys(projection, ['schemaVersion', 'branchId', 'mode', 'notesGenerationId', 'notesSourceSeqs', 'windowId']);
        if (projection['schemaVersion'] !== 1 || projection['branchId'] !== session.id || projection['mode'] !== 'direct-notes'
            || projection['windowId'] !== window['windowId'])
            fail();
    }
    if (value['contextMessageRefs'] !== undefined) {
        const refs = value['contextMessageRefs'];
        if (!object(refs))
            fail();
        keys(refs, ['schemaVersion', 'encoding', 'sessionId', 'turn', 'refs']);
        if (refs['schemaVersion'] !== 1 || refs['encoding'] !== 'roleplay-context-produced-message-refs-v1'
            || refs['sessionId'] !== session.id || refs['turn'] !== value['turnId'] || !Array.isArray(refs['refs']))
            fail();
        for (const ref of refs['refs']) {
            if (!object(ref))
                fail();
            keys(ref, ['form', 'id', 'messageSha256', 'sourceSha256']);
            if (!string(ref['form']) || !string(ref['id']) || !hash(ref['messageSha256']) || !hash(ref['sourceSha256']))
                fail();
        }
    }
}
function assertAddress(session, key, kind, value) {
    const prefix = session.id + '__', suffix = key.slice(prefix.length);
    if (!key.startsWith(prefix) || value['branchId'] !== session.id)
        fail();
    if (kind === 'context-window') {
        keys(value, ['windowNumber', 'windowId', 'branchId', 'startSeq'], ['previousWindowId', 'throughSeq', 'storyTokens',
            'createdAt', 'updatedAt', 'rolloverCount', 'reason', 'previousStoryTokens', 'continuityTailTokens', 'checkpointSeq',
            'shadowedSeqs', 'tailSeqs', 'continuityTokens', 'inheritedFrom', 'inheritedAtSeedLength']);
        if (suffix !== 'context-window' || !integer(value['windowNumber'], 1) || typeof value['windowId'] !== 'string'
            || !value['windowId'] || !integer(value['startSeq'], -1))
            fail();
        if (value['previousWindowId'] !== undefined && value['previousWindowId'] !== null && !string(value['previousWindowId']))
            fail();
        for (const field of ['throughSeq'])
            if (value[field] !== undefined && !integer(value[field], -1))
                fail();
        for (const field of ['createdAt', 'updatedAt', 'rolloverCount', 'checkpointSeq']) {
            if (value[field] !== undefined && !integer(value[field]))
                fail();
        }
        // Existing settings accept positive fractional token budgets; provenance
        // must retain their exact values instead of adding an integer-only policy.
        for (const field of ['storyTokens', 'previousStoryTokens', 'continuityTailTokens', 'continuityTokens']) {
            if (value[field] !== undefined && !tokens(value[field]))
                fail();
        }
        for (const field of ['shadowedSeqs', 'tailSeqs'])
            if (value[field] !== undefined
                && (!Array.isArray(value[field]) || !value[field].every(item => integer(item))))
                fail();
        for (const field of ['reason', 'inheritedFrom'])
            if (value[field] !== undefined && !string(value[field]))
                fail();
        if (value['inheritedAtSeedLength'] !== undefined && value['inheritedAtSeedLength'] !== null
            && !integer(value['inheritedAtSeedLength']))
            fail();
        return;
    }
    if (value['schemaVersion'] !== 1 || value['sessionId'] !== session.id || Object.hasOwn(value, 'agent'))
        fail();
    if (kind === 'task-preparation') {
        keys(value, ['schemaVersion', 'id', 'sessionId', 'branchId', 'turn', 'messages', 'status', 'createdAt', 'sourceHash'], ['inputPreparation', 'completedAt']);
        if (suffix !== 'task-preparation' || !integer(value['turn'], 1) || typeof value['id'] !== 'string'
            || !value['id'] || !['preparing', 'completed'].includes(String(value['status'])) || !Array.isArray(value['messages'])
            || !integer(value['createdAt']) || !hash(value['sourceHash']) || !value['messages'].every(object))
            fail();
        if (value['inputPreparation'] !== undefined)
            currency(value['inputPreparation']);
        if (value['status'] === 'completed' ? !integer(value['completedAt']) : Object.hasOwn(value, 'completedAt'))
            fail();
        return;
    }
    assertSnapshot(value, session);
    if (kind === 'task-snapshot') {
        if (suffix !== `task-snapshot-${value['turnId']}`)
            fail();
    }
    else {
        const input = currency(value['inputPreparation']);
        if (!object(input)
            || suffix !== `task-input-snapshot-${input['preparationId']}-${input['attemptGeneration']}`)
            fail();
    }
}
/** Pure DTO validation also serves exact Native-bound cold row readers. It
 * registers no writer and cannot populate the private provenance registry. */
export function validateRoleplayPhaseABranchRowDataV1(session, key, kind, raw) {
    if (!['task-snapshot', 'task-input-snapshot', 'task-preparation', 'context-window'].includes(kind))
        fail();
    const value = freeze(cloneRoleplayTavernLoreDataV1(raw, 16_777_216, { nodes: 131072, depth: 66 }));
    if (!object(value) || !sameData(raw, value))
        fail();
    assertAddress(session, key, kind, value);
    return value;
}
export function createRoleplayPhaseABranchRowFactsV1(deps) {
    let rows = new WeakMap(), closed = false;
    function actual(session) {
        if (closed || deps.session(session.id) !== session)
            fail();
    }
    function beforeWrite(session, key, kind, raw) {
        actual(session);
        const value = validateRoleplayPhaseABranchRowDataV1(session, key, kind, raw);
        let owned = rows.get(session);
        if (!owned) {
            owned = new Map();
            rows.set(session, owned);
        }
        if (owned.size >= 16_384 && !owned.has(key))
            fail();
        const previous = owned.get(key) ?? {}, fact = Object.freeze({ key, kind, value,
            sha256: recordSha256(value), phase: 'writing' });
        // Preserve the previous written datum while put is in flight. Queries
        // describe whichever complete bytes actually exist, never a pending flag.
        owned.set(key, { ...previous, writing: fact });
        return { readback() {
                actual(session);
                const stored = deps.branch.get(key);
                // Full actual-data equality implies the SHA already recorded for our
                // validated frozen value; reserializing stored adds no further proof.
                if (owned.get(key)?.writing !== fact || !sameData(stored, fact.value))
                    fail();
                owned.set(key, { written: Object.freeze({ ...fact, phase: 'written' }) });
            } };
    }
    function readOwnedRowFacts(session) {
        actual(session);
        const found = [];
        for (const [key, entry] of rows.get(session) ?? []) {
            const value = deps.branch.get(key);
            if (value === undefined || value === null)
                continue;
            // Keep the actual read and full comparison. Only a privately frozen
            // writer value can supply its previously computed equal-data digest.
            const fact = [entry.writing, entry.written].find(item => item && sameData(value, item.value));
            if (!fact)
                fail();
            found.push(fact);
        }
        return Object.freeze(found);
    }
    return { beforeWrite, readOwnedRowFacts, dispose() { closed = true; rows = new WeakMap(); } };
}
