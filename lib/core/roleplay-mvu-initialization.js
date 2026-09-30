// Generated from runtime/alpha3/src/core/roleplay-mvu-initialization.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { recordSha256 } from './roleplay-data.js';
import { compileMvuInitSources } from './tavern-mvu-initvar.js';
const hash = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isId = (value, max = 128) => typeof value === 'string'
    && value.length > 0 && value.length <= max && /^[a-zA-Z0-9_-]+$/.test(value);
const same = (a, b) => recordSha256(a) === recordSha256(b);
function validateIdentity(identity) {
    const source = identity.source;
    if (!isId(identity.sessionId, 64) || source?.sessionId !== identity.sessionId
        || !isId(source.importId, 64) || !isId(source.sourceRecordSessionId, 64)
        || !isId(identity.operationId) || !isId(identity.messageId)
        || !Number.isSafeInteger(identity.index) || identity.index < 0
        || typeof identity.sourcePointer !== 'string' || !identity.sourcePointer.startsWith('/')
        || identity.sourcePointer.length > 512
        || ![source.rawSha256, source.normalizedSha256, source.coverageSha256,
            identity.sourceSha256, identity.renderedSha256].every(isHash)
        || !source.transactionId || source.pointer?.importId !== source.importId
        || (source.pointer.sourceRecordSessionId ?? identity.sessionId) !== source.sourceRecordSessionId
        || source.pointer.normalizedSha256 !== source.normalizedSha256
        || source.pointer.transactionId !== source.transactionId
        || source.pointer.coverageSha256 !== source.coverageSha256)
        throw new Error('MVU_INIT_IDENTITY_INVALID');
}
/** Compile once before native append; persist this exact plan in the opening intent before spending side effects. */
export function prepareMvuOpeningInitialization(identity, input) {
    validateIdentity(identity);
    const compilation = compileMvuInitSources(input);
    if (compilation.kind === 'unsupported')
        return compilation;
    const selectedSwipeIdentity = compilation.kind === 'supported'
        ? compilation.plan.selectedSwipeIdentity : compilation.basis.selectedSwipeIdentity;
    const selected = (compilation.kind === 'supported' ? compilation.plan.swipes : compilation.basis.swipes)
        .find(swipe => swipe.identity === selectedSwipeIdentity);
    if (!selected || selected.sourceSha256 !== identity.sourceSha256)
        throw new Error('MVU_INIT_OPENING_MISMATCH');
    const values = structuredClone(selected.statData);
    const content = { schemaVersion: 1, encoding: 'mvu-programmatic-opening-plan-v1',
        identity: structuredClone(identity), compilation, selectedSwipeIdentity, values, valuesSha256: recordSha256(values) };
    return { kind: 'prepared', plan: { ...content, planSha256: recordSha256(content) } };
}
export function mvuInitializationEventKey(sessionId, eventId) {
    if (!isId(sessionId, 64) || !isHash(eventId))
        throw new Error('MVU_INIT_KEY_INVALID');
    return `${sessionId}__mvu-init-event-${eventId}`;
}
export function mvuInitializationHeadKey(sessionId) {
    if (!isId(sessionId, 64))
        throw new Error('MVU_INIT_KEY_INVALID');
    return `${sessionId}__mvu-init-head`;
}
function validatePlan(plan) {
    validateIdentity(plan.identity);
    const { planSha256, ...content } = plan;
    if (plan.schemaVersion !== 1 || plan.encoding !== 'mvu-programmatic-opening-plan-v1'
        || !isHash(planSha256) || recordSha256(content) !== planSha256
        || recordSha256(plan.values) !== plan.valuesSha256
        || plan.compilation.schemaVersion !== 1
        || !['none', 'supported'].includes(plan.compilation.kind))
        throw new Error('MVU_INIT_PLAN_INVALID');
    const compiled = plan.compilation;
    const swipes = compiled.kind === 'supported' ? compiled.plan.swipes : compiled.basis.swipes;
    const identity = compiled.kind === 'supported' ? compiled.plan.selectedSwipeIdentity : compiled.basis.selectedSwipeIdentity;
    const selected = swipes.filter(swipe => swipe.identity === identity);
    if (selected.length !== 1 || identity !== plan.selectedSwipeIdentity
        || selected[0].sourceSha256 !== plan.identity.sourceSha256
        || !same(selected[0].statData, plan.values))
        throw new Error('MVU_INIT_PLAN_INVALID');
    if (compiled.kind === 'supported') {
        const { planHash, ...compiledContent } = compiled.plan;
        if (compiled.plan.policy !== 'strict-json-object-v1' || compiled.plan.assurance !== 'supported-static'
            || compiled.plan.capability !== 'native-json-data-only' || recordSha256(compiledContent) !== planHash) {
            throw new Error('MVU_INIT_PLAN_INVALID');
        }
    }
}
function validNative(receipt, identity) {
    return receipt?.sessionId === identity.sessionId && receipt.operationId === identity.operationId
        && receipt.messageId === identity.messageId && receipt.renderedSha256 === identity.renderedSha256
        && receipt.flushed === true && receipt.messageVersion?.kind === 'original'
        && isHash(receipt.messageVersion.eventSha256)
        && [receipt.turn, receipt.assistantSeq, receipt.turnStartSeq, receipt.turnEndSeq]
            .every(value => Number.isSafeInteger(value) && value >= 0)
        && receipt.turn > 0
        && receipt.turnStartSeq < receipt.assistantSeq && receipt.assistantSeq < receipt.turnEndSeq;
}
function eventFor(plan, native) {
    const eventId = hash(`${plan.identity.sessionId}\0${plan.identity.operationId}\0${plan.planSha256}`);
    const content = { schemaVersion: 1, encoding: 'mvu-programmatic-opening-event-v1',
        eventId, revision: 1, plan: structuredClone(plan), native: structuredClone(native), valuesSha256: plan.valuesSha256 };
    return { ...content, eventSha256: recordSha256(content) };
}
function headFor(event) {
    return { schemaVersion: 1, encoding: 'mvu-programmatic-opening-head-v1', sessionId: event.plan.identity.sessionId,
        eventId: event.eventId, revision: 1, eventSha256: event.eventSha256,
        planSha256: event.plan.planSha256, valuesSha256: event.valuesSha256 };
}
/** Numerical initialization authority; unrelated narrative panel/spec/task records are never read or overwritten. */
export function createRoleplayMvuInitialization(deps) {
    if (typeof deps.isOpeningCurrent !== 'function')
        throw new Error('MVU_INIT_OPENING_GUARD_REQUIRED');
    const current = (plan, nativeTurn) => deps.isCurrent(plan.identity) && deps.isOpeningCurrent(plan, nativeTurn);
    const read = (plan) => {
        try {
            validatePlan(plan);
        }
        catch {
            return { kind: 'blocked', code: 'RECORD_INVALID' };
        }
        if (!deps.isCurrent(plan.identity))
            return { kind: 'blocked', code: 'SOURCE_CHANGED' };
        const id = hash(`${plan.identity.sessionId}\0${plan.identity.operationId}\0${plan.planSha256}`);
        const stored = deps.table.get(mvuInitializationEventKey(plan.identity.sessionId, id));
        if (stored === undefined)
            return { kind: 'blocked', code: 'EVENT_MISSING' };
        try {
            validatePlan(stored.plan);
            if (!validNative(stored.native, plan.identity) || !same(stored, eventFor(plan, stored.native))) {
                return { kind: 'blocked', code: 'RECORD_INVALID' };
            }
            if (!current(plan, stored.native.turn) || !deps.isNativeCurrent(stored.native)) {
                return { kind: 'blocked', code: 'SOURCE_CHANGED' };
            }
        }
        catch {
            return { kind: 'blocked', code: 'RECORD_INVALID' };
        }
        const head = deps.table.get(mvuInitializationHeadKey(plan.identity.sessionId));
        if (head === undefined)
            return { kind: 'blocked', code: 'HEAD_MISSING' };
        // A newer authority is never rolled back by initialization replay. Update-chain integration is a later owner contract.
        if (!same(head, headFor(stored)))
            return { kind: 'blocked', code: 'IDENTITY_CONFLICT' };
        return { kind: 'ready', event: structuredClone(stored), head: structuredClone(head) };
    };
    const publish = (suppliedPlan, acknowledgedNativeTurn) => {
        // Own the frozen value across native lookup awaits; a caller cannot mutate the admitted snapshot mid-publication.
        const plan = structuredClone(suppliedPlan);
        return deps.withSourceLock(plan.identity.sessionId, async () => {
            validatePlan(plan);
            if (!Number.isSafeInteger(acknowledgedNativeTurn) || acknowledgedNativeTurn <= 0) {
                return { kind: 'blocked', code: 'NATIVE_NOT_COMMITTED' };
            }
            if (!current(plan, acknowledgedNativeTurn))
                return { kind: 'blocked', code: 'SOURCE_CHANGED' };
            const found = await deps.verifyNative(plan.identity);
            if (!current(plan, acknowledgedNativeTurn))
                return { kind: 'blocked', code: 'SOURCE_CHANGED' };
            if (found.status !== 'committed' || !validNative(found.receipt, plan.identity)
                || found.receipt.turn !== acknowledgedNativeTurn) {
                return { kind: 'blocked', code: 'NATIVE_NOT_COMMITTED' };
            }
            if (!deps.isNativeCurrent(found.receipt))
                return { kind: 'blocked', code: 'SOURCE_CHANGED' };
            const proposed = eventFor(plan, found.receipt);
            const key = mvuInitializationEventKey(plan.identity.sessionId, proposed.eventId);
            const previous = deps.table.get(key);
            // Event is append-only. Lost put acknowledgements are recovered from the exact retained result, never recompiled.
            if (previous !== undefined && !same(previous, proposed))
                return { kind: 'blocked', code: 'IDENTITY_CONFLICT' };
            const headKey = mvuInitializationHeadKey(plan.identity.sessionId);
            const expected = headFor(proposed);
            const priorHead = deps.table.get(headKey);
            if (priorHead !== undefined && !same(priorHead, expected))
                return { kind: 'blocked', code: 'IDENTITY_CONFLICT' };
            if (previous === undefined)
                await deps.table.put(key, proposed);
            if (!current(plan, acknowledgedNativeTurn) || !deps.isNativeCurrent(found.receipt)) {
                return { kind: 'blocked', code: 'SOURCE_CHANGED' };
            }
            // Re-read after the event put: no late authority may be overwritten even if a foreign writer bypassed the owner lock.
            const observedHead = deps.table.get(headKey);
            if (observedHead !== undefined && !same(observedHead, expected))
                return { kind: 'blocked', code: 'IDENTITY_CONFLICT' };
            if (observedHead === undefined)
                await deps.table.put(headKey, expected);
            if (!current(plan, acknowledgedNativeTurn) || !deps.isNativeCurrent(found.receipt)) {
                return { kind: 'blocked', code: 'SOURCE_CHANGED' };
            }
            return read(plan);
        });
    };
    return { read, publish };
}
