// Generated from runtime/alpha3/src/core/roleplay-mvu-initialization.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { recordSha256 } from './roleplay-data.js';
import { compileMvuInitSources, compileNativeMvuInitSources } from './tavern-mvu-initvar.js';
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
/** Freeze actual source and numerical-owner proofs with the native policy compilation. */
export function prepareNativeMvuOpeningInitialization(identity, input) {
    validateIdentity(identity);
    const compilation = compileNativeMvuInitSources(input);
    if (compilation.kind === 'unsupported')
        return compilation;
    const snapshot = input.sourceSnapshot;
    if (!same(snapshot.source, identity.source) || snapshot.selected.index !== identity.index
        || snapshot.selected.pointer !== identity.sourcePointer || snapshot.selected.sourceSha256 !== identity.sourceSha256
        || snapshot.selected.renderedSha256 !== identity.renderedSha256)
        throw new Error('MVU_INIT_OPENING_MISMATCH');
    const selected = compilation.plan.swipes.find(swipe => swipe.identity === compilation.plan.selectedSwipeIdentity);
    if (!selected || selected.sourceSha256 !== identity.sourceSha256)
        throw new Error('MVU_INIT_OPENING_MISMATCH');
    const values = structuredClone(selected.statData);
    const content = { schemaVersion: 2, encoding: 'mvu-programmatic-opening-plan-v2',
        identity: structuredClone(identity), compilation, selectedSwipeIdentity: compilation.plan.selectedSwipeIdentity,
        values, valuesSha256: recordSha256(values), sourceSnapshot: structuredClone(snapshot),
        freshNativeBasisProof: structuredClone(input.freshNativeBasisProof) };
    // Compiler and source descriptors each have a 1 MiB cap; the selected value is already within the compiler cap.
    if (Buffer.byteLength(JSON.stringify(content), 'utf8') > 3_145_728) {
        return { schemaVersion: 2, kind: 'unsupported', diagnostics: [{ code: 'OUTPUT_BYTE_LIMIT', pointer: '/plan' }] };
    }
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
    const versioned = plan.schemaVersion === 1 && plan.encoding === 'mvu-programmatic-opening-plan-v1'
        || plan.schemaVersion === 2 && plan.encoding === 'mvu-programmatic-opening-plan-v2';
    if (!versioned
        || !isHash(planSha256) || recordSha256(content) !== planSha256
        || recordSha256(plan.values) !== plan.valuesSha256
        || plan.compilation.schemaVersion !== plan.schemaVersion
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
    if (plan.schemaVersion === 2) {
        const snapshot = plan.sourceSnapshot;
        const proof = plan.freshNativeBasisProof;
        const { snapshotSha256, ...snapshotContent } = snapshot;
        const { proofSha256, ...proofContent } = proof;
        if (snapshot.schemaVersion !== 1 || snapshot.encoding !== 'native-mvu-source-snapshot-v1'
            || proof.schemaVersion !== 1 || proof.encoding !== 'native-mvu-fresh-basis-proof-v1'
            || recordSha256(snapshotContent) !== snapshotSha256 || recordSha256(proofContent) !== proofSha256
            || !same(snapshot.source, plan.identity.source) || proof.sessionId !== plan.identity.sessionId
            || proof.ownerSessionId !== plan.identity.sessionId
            || snapshot.selected.index !== plan.identity.index || snapshot.selected.pointer !== plan.identity.sourcePointer
            || snapshot.selected.sourceSha256 !== plan.identity.sourceSha256
            || snapshot.selected.renderedSha256 !== plan.identity.renderedSha256
            || plan.compilation.plan.schemaVersion !== 2 || plan.compilation.plan.source.authority !== 'core-native-policy'
            || !same(snapshot.policy, plan.compilation.plan.source.policy))
            throw new Error('MVU_INIT_PLAN_INVALID');
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
    const current = (plan, nativeTurn) => deps.isCurrent(plan.identity) && deps.isOpeningCurrent(plan, nativeTurn)
        && (plan.schemaVersion === 1 || typeof deps.isSourceSnapshotCurrent === 'function'
            && deps.isSourceSnapshotCurrent(plan.sourceSnapshot));
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
    const publish = async (suppliedPlan, acknowledgedNativeTurn) => {
        // Own the frozen value across native lookup awaits; a caller cannot mutate the admitted snapshot mid-publication.
        const plan = structuredClone(suppliedPlan);
        validatePlan(plan);
        if (!Number.isSafeInteger(acknowledgedNativeTurn) || acknowledgedNativeTurn <= 0) {
            return { kind: 'blocked', code: 'NATIVE_NOT_COMMITTED' };
        }
        if (!current(plan, acknowledgedNativeTurn))
            return { kind: 'blocked', code: 'SOURCE_CHANGED' };
        // Owned lookup waits for native idle/flush. Holding the import lock here
        // could deadlock a live Phase-A that needs that lock before becoming idle.
        // All actual owner/source/native facts are checked again after acquisition.
        const found = await deps.verifyNative(plan.identity);
        return deps.withSourceLock(plan.identity.sessionId, async () => {
            validatePlan(plan);
            if (!Number.isSafeInteger(acknowledgedNativeTurn) || acknowledgedNativeTurn <= 0) {
                return { kind: 'blocked', code: 'NATIVE_NOT_COMMITTED' };
            }
            if (!current(plan, acknowledgedNativeTurn))
                return { kind: 'blocked', code: 'SOURCE_CHANGED' };
            if (!current(plan, acknowledgedNativeTurn))
                return { kind: 'blocked', code: 'SOURCE_CHANGED' };
            if (found.status !== 'committed' || !validNative(found.receipt, plan.identity)
                || found.receipt.turn !== acknowledgedNativeTurn) {
                return { kind: 'blocked', code: 'NATIVE_NOT_COMMITTED' };
            }
            if (!deps.isNativeCurrent(found.receipt))
                return { kind: 'blocked', code: 'SOURCE_CHANGED' };
            const proposed = eventFor(plan, found.receipt);
            const basisCurrent = () => plan.schemaVersion === 1 || typeof deps.isBasisCurrent === 'function'
                && deps.isBasisCurrent(plan, found.receipt, proposed);
            if (plan.schemaVersion === 2 && typeof deps.isBasisCurrent !== 'function') {
                return { kind: 'blocked', code: 'BASIS_UNPROVEN' };
            }
            if (!basisCurrent())
                return { kind: 'blocked', code: 'BASIS_CHANGED' };
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
            if (!basisCurrent())
                return { kind: 'blocked', code: 'BASIS_CHANGED' };
            // Re-read after the event put: no late authority may be overwritten even if a foreign writer bypassed the owner lock.
            const observedHead = deps.table.get(headKey);
            if (observedHead !== undefined && !same(observedHead, expected))
                return { kind: 'blocked', code: 'IDENTITY_CONFLICT' };
            if (observedHead === undefined)
                await deps.table.put(headKey, expected);
            if (!current(plan, acknowledgedNativeTurn) || !deps.isNativeCurrent(found.receipt)) {
                return { kind: 'blocked', code: 'SOURCE_CHANGED' };
            }
            if (!basisCurrent())
                return { kind: 'blocked', code: 'BASIS_CHANGED' };
            return read(plan);
        });
    };
    return { read, publish };
}
