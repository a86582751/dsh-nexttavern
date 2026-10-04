// Generated from runtime/alpha3/src/core/roleplay-input-preparation.ts; edit the TypeScript source.
/** Owner of Core permissions over actual Native input work. The detached
 * row registry explains complete writer output; it grants no execution right.
 * No input queue, model classification or Source lock belongs here. */
import { createHash, randomUUID } from 'node:crypto';
import { createRoleplayInputContinuation } from './roleplay-input-continuation.js';
import { createRoleplayInputCompletion, readInputCompletion } from './roleplay-input-completion.js';
import { createRoleplayInputMaterialOwnerV1 } from './roleplay-input-material.js';
import { recordSha256 } from './roleplay-data.js';
import { readColdNonNumericalInputBranchRowFactsV1 } from './roleplay-input-cold-row-facts.js';
export const ROLEPLAY_INPUT_NAMESPACE = 'nexttavern.roleplay.input.v2';
const canonical = (value) => {
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object')
        return `{${Object.keys(value).sort()
            .filter(key => value[key] !== undefined)
            .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value) ?? 'null';
};
const digest = (value) => createHash('sha256').update(canonical(value)).digest('hex');
const equal = (a, b) => canonical(a) === canonical(b);
const clone = (value) => structuredClone(value);
const prefix = (sessionId) => `${sessionId}__native-input-v2-`;
const workKey = (sessionId, refs) => `${prefix(sessionId)}work-${digest(refs)}`;
const currentKey = (sessionId) => `${prefix(sessionId)}current`;
const blocked = (code) => ({ kind: 'blocked', code });
const allowed = { kind: 'allow' };
function fail(code) { throw new Error(code); }
const sha = (value) => /^[a-f0-9]{64}$/.test(value);
const boundedId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
// Match the import transaction's existing CAS encoding for an absent record.
const recordDigest = (value) => value === 'missing' || sha(value);
/** A complete writer-owned row includes its own keys, even keys whose values
 * do not change JSON SHA. Read descriptors so accessors are never invoked. */
function sameOwnedRowData(actual, expected) {
    if (Object.is(actual, expected))
        return true;
    if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object')
        return false;
    if (Array.isArray(actual) !== Array.isArray(expected))
        return false;
    if (!Array.isArray(actual) && ![Object.prototype, null].includes(Object.getPrototypeOf(actual)))
        return false;
    const actualKeys = Reflect.ownKeys(actual), expectedKeys = Reflect.ownKeys(expected);
    if (actualKeys.length !== expectedKeys.length || actualKeys.some(key => typeof key !== 'string' || !expectedKeys.includes(key)))
        return false;
    const actualDescriptors = Object.getOwnPropertyDescriptors(actual), expectedDescriptors = Object.getOwnPropertyDescriptors(expected);
    return expectedKeys.every(key => {
        if (typeof key !== 'string')
            return false;
        const left = actualDescriptors[key], right = expectedDescriptors[key];
        return !!left && !!right && 'value' in left && 'value' in right && left.enumerable === right.enumerable
            && sameOwnedRowData(left.value, right.value);
    });
}
function freezeOwnedRowData(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freezeOwnedRowData(child);
        Object.freeze(value);
    }
    return value;
}
/** Classification of the already captured typed observation, never a live
 * Source read or a replacement for observeExact/currency/terminal checks. */
function nonNumericalSource(source) {
    if (!sha(source.sourceSha256))
        return false;
    if (source.kind === 'legacy' || source.kind === 'management') {
        return typeof source.reason === 'string' && source.reason.length > 0
            && Object.keys(source).every(key => ['kind', 'sourceSha256', 'reason'].includes(key));
    }
    const absence = source.absenceScopeRef;
    return source.kind === 'story' && source.headRef === undefined && !!absence && sha(absence.sha256)
        && ['plain-absence', 'prompt-template-only-domain', 'inherited-prompt-domain', 'prompt-program-domain',
            'prompt-program-inherited-domain'].includes(absence.kind)
        && Object.keys(source).every(key => ['kind', 'sourceSha256', 'headRef', 'absenceScopeRef'].includes(key))
        && Object.keys(absence).length === 2 && Object.keys(absence).every(key => ['kind', 'sha256'].includes(key));
}
const identityOf = (work) => ({ schemaVersion: 2, namespace: work.namespace, sessionId: work.sessionId,
    branchId: work.branchId, preparationId: work.preparationId, receiptGeneration: work.receiptGeneration, refs: work.refs,
    ...(work.terminalRequired ? { terminalRequired: true } : {}) });
const currencyOfStored = (work) => ({ schemaVersion: 2,
    preparationId: work.preparationId, credentialSha256: work.credentialSha256, receiptGeneration: work.receiptGeneration,
    attemptGeneration: work.attemptGeneration, source: clone(work.source),
    ...(work.attempt?.snapshot ? { snapshot: clone(work.attempt.snapshot) } : {}) });
const refusalSeal = (work, proof) => digest({
    preparationId: work.preparationId, credentialSha256: work.credentialSha256, ...proof
});
const validRefusal = (work) => {
    const proof = work.unclaimedRefusal;
    if (!proof)
        return false;
    const { proofSha256, ...payload } = proof;
    return proof.schemaVersion === 1 && proof.kind === 'unclaimed-native-refusal'
        && typeof proof.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(proof.code)
        && proof.refsSha256 === digest(work.refs) && Number.isSafeInteger(proof.throughSeq) && proof.throughSeq >= 0
        && sha(proof.historyPrefixSha256) && proofSha256 === refusalSeal(work, payload);
};
const isWork = (value, sessionId) => {
    const row = value;
    return !!row && row.schemaVersion === 2 && row.namespace === ROLEPLAY_INPUT_NAMESPACE
        && row.sessionId === sessionId && row.branchId === sessionId && typeof row.preparationId === 'string'
        && Number.isSafeInteger(row.receiptGeneration) && row.receiptGeneration > 0 && Array.isArray(row.refs)
        && row.refs.length > 0 && row.refs.every(ref => ref.sessionId === sessionId && sha(ref.messageSha256))
        && (row.terminalRequired === undefined || row.terminalRequired === true)
        && (row.unclaimedRefusal === undefined || validRefusal(row))
        && row.credentialSha256 === digest(identityOf(row))
        && equal(row.preparation, { schemaVersion: 1, namespace: ROLEPLAY_INPUT_NAMESPACE,
            preparationKeySha256: digest({ sessionId, preparationId: row.preparationId }), credentialSha256: row.credentialSha256 });
};
export function createRoleplayInputPreparation({ table, observe, onError, completion, awaitMutationBarrier, mutationBlockCode, onMutationStop, preflightObservation, onClosingRelease, material, sessionForRowFacts, readColdMaterialHistory }) {
    const owners = new WeakMap();
    const closingViews = new WeakMap();
    const leases = new Map();
    const reservationLeases = new Map();
    const sessionOwners = new Map();
    const liveRevocations = new Map();
    const terminalOwners = new Map();
    let ownedRows = new WeakMap(), ownedRowsDisposed = false;
    const rowsFor = (session) => {
        let found = ownedRows.get(session);
        if (!found) {
            found = { sessionId: session.id, rows: new Map(), writtenPreimages: new Map() };
            ownedRows.set(session, found);
        }
        if (found.sessionId !== session.id)
            fail('INPUT_OWNED_ROW_SESSION_CHANGED');
        return found;
    };
    const actualOwnedRow = (row) => {
        const actual = table.get(row.key);
        return actual !== undefined && actual !== null && sameOwnedRowData(actual, row.value) && recordSha256(actual) === row.sha256;
    };
    const registerPendingRow = (session, row) => {
        const known = rowsFor(session), previous = known.rows.get(row.key);
        // An awaited put can still expose the previous confirmed bytes. Preserve
        // that DATA provenance until this exact pending write is confirmed.
        if (previous?.phase === 'written')
            known.writtenPreimages.set(row.key, previous);
        known.rows.set(row.key, row);
    };
    const registerWriting = (session, key, value, kind) => {
        if (ownedRowsDisposed)
            return;
        const detached = freezeOwnedRowData(clone(value)), row = Object.freeze({ key, value: detached,
            sha256: recordSha256(detached), kind, phase: 'writing' });
        registerPendingRow(session, row);
        return row;
    };
    const registerWritten = (session, row) => {
        if (ownedRowsDisposed || !row || !actualOwnedRow(row))
            return;
        const known = rowsFor(session), rows = known.rows, previous = rows.get(row.key);
        if (previous !== row)
            return;
        rows.set(row.key, Object.freeze({ ...row, phase: 'written' }));
        known.writtenPreimages.delete(row.key);
    };
    // A single writer orders this owner's records. It never invokes Source work
    // or waits Agent idle while holding this chain.
    let writes = Promise.resolve();
    const enqueue = (operation) => {
        const next = writes.then(operation);
        writes = next.catch(() => { });
        return next;
    };
    const report = (error) => { try {
        onError?.(error);
    }
    catch { /* Reporting cannot restore authority. */ } };
    const mutationCode = (session) => {
        try {
            return mutationBlockCode?.(session);
        }
        catch (error) {
            report(error);
            return 'INPUT_MUTATION_GATE_UNKNOWN';
        }
    };
    const waitForMutation = Symbol('owner-admission-mutation-wait');
    const records = (sid) => [...table.entries()]
        .filter(([key, value]) => key.startsWith(`${prefix(sid)}work-`) && isWork(value, sid))
        .map(([, value]) => clone(value));
    const observeExact = (session) => {
        const result = clone(observe(session));
        if (!sha(result.sourceSha256) || !['legacy', 'management', 'story'].includes(result.kind)
            || result.kind === 'story' && (!result.headRef && !result.absenceScopeRef
                || !!result.headRef && !!result.absenceScopeRef
                || !sha((result.headRef ?? result.absenceScopeRef).sha256)
                || !!result.headRef && !['numerical-head', 'schema-head'].includes(result.headRef.kind)
                || !!result.absenceScopeRef && !['plain-absence', 'prompt-template-only-domain', 'inherited-prompt-domain', 'prompt-program-domain',
                    'prompt-program-inherited-domain']
                    .includes(result.absenceScopeRef.kind))
            || result.kind !== 'story' && !result.reason)
            fail('INPUT_SOURCE_OBSERVATION_INVALID');
        return result;
    };
    /** Check actual Native facts, including canceled refs that might otherwise
     * hide a prior claim. A crash between work creation and this proof stays
     * unresolved; cold recovery cannot infer permission from missing rows. */
    const unclaimedFacts = (agent, work) => {
        if (work.checkpoint || work.attempt || work.transition || work.attemptGeneration !== 0)
            return undefined;
        const events = agent.session.snapshotEvents();
        let previous = -1;
        for (const event of events) {
            const seq = Number(event.seq);
            if (!Number.isSafeInteger(seq) || seq <= previous)
                return undefined;
            previous = seq;
            if (event.type === 'turn/start' && event.data.nativeInputLink) {
                const link = event.data.nativeInputLink;
                if (!Array.isArray(link.refs) || !link.preparation)
                    return undefined;
                if (equal(link.preparation, work.preparation)
                    || link.refs.some(ref => work.refs.some(owned => equal(ref, owned))))
                    return undefined;
            }
        }
        if (previous < Math.max(...work.refs.map(ref => ref.insertSeq)))
            return undefined;
        for (const ref of work.refs) {
            const ownership = agent.lookupInputOwnership(ref);
            if (ownership.status === 'cancelled') {
                // Native also reports a claimed, aborted old turn as canceled. Only an
                // actual inbox deletion with no closed claim reason proves no claim.
                const canceled = events.find(event => Number(event.seq) === ownership.cancelSeq);
                if (ownership.closedReason || canceled?.type !== 'agent/inbox/spliced'
                    || canceled.data.outcome !== 'canceled')
                    return undefined;
            }
            else if (ownership.status !== 'pending')
                return undefined;
        }
        return { events, throughSeq: previous };
    };
    const verifyUnclaimedRefusal = (sid, work) => {
        if (!validRefusal(work))
            return false;
        const agent = sessionOwners.get(sid);
        if (!agent)
            return false;
        const facts = unclaimedFacts(agent, work), proof = work.unclaimedRefusal;
        if (!facts || proof.throughSeq > facts.throughSeq)
            return false;
        const history = facts.events.filter(event => Number(event.seq) <= proof.throughSeq);
        return Number(history.at(-1)?.seq) === proof.throughSeq && digest(history) === proof.historyPrefixSha256;
    };
    /** Separate from physical numerical/Source observation. In particular our
     * own pending terminal must not make an in-flight snapshot self-stale. This
     * read-only gate is also available to deterministic management diagnostics. */
    const readTerminalAdmissionGate = (sid, known, verifyConsumed = true) => {
        if (!completion)
            return allowed;
        try {
            if ([...table.entries()].some(([recordKey, value]) => recordKey.startsWith(`${prefix(sid)}work-`) && !isWork(value, sid))) {
                return blocked('INPUT_STORED_WORK_UNKNOWN');
            }
            for (const work of known ?? records(sid))
                if (work.terminalRequired) {
                    if (verifyUnclaimedRefusal(sid, work))
                        continue;
                    const closed = readInputCompletion(table, sid, work.preparationId);
                    if (!closed || closed.status !== 'settled' || work.stop || work.status !== 'active'
                        || !equal(closed.scope.currency, currencyOfStored(work)) || !equal(closed.scope.receipt.checkpoint, work.checkpoint)
                        || !equal(closed.scope.transition, work.transition)
                        // Consumed facts verify their actual closed prefix themselves. A
                        // later editorial revision must not recreate old publisher rights.
                        || verifyConsumed && !completion.verifyConsumed(closed.scope, closed.plan, closed.settlement)) {
                        return blocked('INPUT_PREVIOUS_TERMINAL_UNRESOLVED');
                    }
                }
            return allowed;
        }
        catch {
            return blocked('INPUT_PREVIOUS_TERMINAL_UNKNOWN');
        }
    };
    /** Caller must obtain this exact Agent from its owning Native factory. No
     * duck-typed service wrapper or brand lookup after disposal is accepted. */
    function bind(agent) {
        const cached = owners.get(agent);
        if (cached)
            return cached;
        const actualSession = agent.session, sid = actualSession.id;
        if (sessionOwners.has(sid))
            fail('INPUT_SESSION_ALREADY_BOUND');
        sessionOwners.set(sid, agent);
        // A remounted owner cannot know whether old pending refs lost a stop ACK.
        // Only a future actual Native insertion can obtain a fresh credential.
        let boundSeq = -1;
        for (const event of agent.session.snapshotEvents())
            boundSeq = Math.max(boundSeq, Number(event.seq));
        let live = true, hot, claim;
        let revoked = false;
        let currentStep;
        let currentLease;
        const steps = new WeakMap();
        const reservations = new WeakMap();
        const lifecycle = new Map();
        const pendingRevocations = new Set();
        const ownedWorkObjects = new WeakSet();
        liveRevocations.set(sid, pendingRevocations);
        const key = (work) => workKey(sid, work.refs);
        const durable = (work) => table.get(key(work));
        const sameDurable = (work) => equal(durable(work), work);
        const checkpointAssociation = (receipt) => {
            const events = agent.session.snapshotEvents();
            // Native validates contiguous seqs on seed/read and appends frozen events.
            // Only this checkpoint's start and first-step interval establish its link.
            const start = events[receipt.startSeq], firstStep = events[receipt.firstStepStartSeq];
            const marker = (start?.type === 'turn/start' ? start.data.nativeInputLink : undefined);
            if (!Number.isSafeInteger(receipt.startSeq) || receipt.startSeq < 0
                || !Number.isSafeInteger(receipt.firstStepStartSeq) || receipt.firstStepStartSeq >= events.length
                || receipt.startSeq >= receipt.firstStepStartSeq)
                return false;
            for (let seq = receipt.startSeq + 1; seq < receipt.firstStepStartSeq; seq++) {
                if (events[seq]?.type === 'step/start' || events[seq]?.type === 'turn/end')
                    return false;
            }
            return receipt.schemaVersion === 1 && receipt.sessionId === sid && !!marker && marker.mode === 'claim'
                && receipt.workSha256 === digest({ schemaVersion: 1, encoding: 'native-input-work-v1', sessionId: sid,
                    preparation: receipt.preparation, refs: receipt.refs })
                && start?.seq === receipt.startSeq && start.type === 'turn/start' && start.data.turn === receipt.actualTurn
                && marker.workSha256 === receipt.workSha256 && equal(marker.preparation, receipt.preparation)
                && equal(marker.refs, receipt.refs)
                && firstStep?.seq === receipt.firstStepStartSeq && firstStep.type === 'step/start'
                && firstStep.data.turn === receipt.actualTurn && firstStep.data.step === 1;
        };
        const knownNonNumericalWork = (work) => {
            if (ownedRowsDisposed || work.terminalRequired !== undefined || !nonNumericalSource(work.source)
                || agent.session !== actualSession || work.sessionId !== sid || work.branchId !== sid)
                return false;
            if (Object.keys(work).some(name => !['schemaVersion', 'namespace', 'sessionId', 'branchId', 'preparationId',
                'receiptGeneration', 'refs', 'credentialSha256', 'preparation', 'status', 'source', 'attemptGeneration', 'attempt',
                'checkpoint', 'terminalRequired', 'unclaimedRefusal', 'transition', 'stop'].includes(name)))
                return false;
            if (ownedWorkObjects.has(work))
                return true;
            const previous = ownedRows.get(actualSession)?.rows.get(key(work));
            // A stop may update a detached older work. Only this writer's complete
            // preimage, not an isWork/prefix match, supplies its row provenance.
            return !!previous && previous.kind === 'input-work' && actualOwnedRow(previous)
                && equal(identityOf(work), identityOf(previous.value));
        };
        const save = async (work) => {
            const value = clone(work), fact = knownNonNumericalWork(work)
                ? registerWriting(actualSession, key(work), value, 'input-work') : undefined;
            await table.put(key(work), value);
            registerWritten(actualSession, fact);
            if (!sameDurable(work))
                fail('INPUT_WRITE_UNCONFIRMED');
        };
        const refuseUnclaimed = async (work, code) => {
            // This runs inside the live admit operation, before it can return allow.
            // Read back the owned write first; failed/ambiguous storage stays closed.
            try {
                const stored = durable(work);
                // stop revokes the hot object synchronously while its durable save is
                // queued after this admission. Permit exactly that known delta, not an
                // arbitrary replacement of the owned record or an absent first write.
                const knownStopDelta = isWork(stored, sid) && stored.status === 'created' && !stored.stop
                    && !!work.stop && pendingRevocations.has(work.preparationId)
                    && ['stopped', 'unknown'].includes(work.status)
                    && equal({ ...stored, status: undefined, stop: undefined }, { ...work, status: undefined, stop: undefined });
                if (work.terminalRequired && (sameDurable(work) || knownStopDelta)) {
                    const facts = unclaimedFacts(agent, work);
                    if (facts) {
                        const proof = { schemaVersion: 1,
                            kind: 'unclaimed-native-refusal', code, refsSha256: digest(work.refs), throughSeq: facts.throughSeq,
                            historyPrefixSha256: digest(facts.events) };
                        work.unclaimedRefusal = { ...proof, proofSha256: refusalSeal(work, proof) };
                        await save(work);
                    }
                }
            }
            catch (error) {
                report(error);
            }
            return blocked(code);
        };
        const currencyOf = (work) => ({ schemaVersion: 2,
            preparationId: work.preparationId, credentialSha256: work.credentialSha256, receiptGeneration: work.receiptGeneration,
            attemptGeneration: work.attemptGeneration, source: clone(work.source),
            ...(work.attempt?.snapshot ? { snapshot: clone(work.attempt.snapshot) } : {}) });
        const historical = (currency) => {
            const mutation = mutationCode(agent.session);
            if (mutation)
                return { code: mutation };
            const proof = lifecycle.get(currency.preparationId);
            if (!live || !proof || pendingRevocations.has(currency.preparationId))
                return { code: 'HISTORICAL_STOP_STATE_UNKNOWN' };
            const matches = records(sid).filter(work => work.preparationId === currency.preparationId);
            if (matches.length !== 1)
                return { code: 'HISTORICAL_WORK_UNKNOWN' };
            const work = matches[0];
            const base = currencyOf(work), { snapshot: ignored, ...suppliedBase } = currency;
            const { snapshot: storedSnapshot, ...storedBase } = base;
            void ignored;
            void storedSnapshot;
            if (!equal(identityOf(work), proof.identity) || !equal(suppliedBase, storedBase)
                || !equal(work.checkpoint, proof.receipt) || work.status !== 'active' || !work.attempt?.prepared
                || work.source.kind !== 'story' || work.transition || work.stop || !equal(observeExact(agent.session), work.source)) {
                return { code: 'HISTORICAL_CURRENCY_CHANGED' };
            }
            if ([...table.entries()].some(([recordKey, value]) => {
                if (!recordKey.startsWith(`${prefix(sid)}stop-`))
                    return false;
                const row = value;
                return !Array.isArray(row.refs) || row.notice?.refsCode && !row.refs.length
                    || row.refs.some(ref => work.refs.some(owned => equal(ref, owned)));
            }))
                return { code: 'HISTORICAL_STOP_STATE_UNKNOWN' };
            const receipt = proof.receipt, events = agent.session.snapshotEvents(), inherited = agent.session.inheritedEventCount;
            const startIndex = events.findIndex(event => Number(event.seq) === receipt.startSeq);
            const ends = events.filter(event => event.type === 'turn/end' && event.data.turn === receipt.actualTurn);
            if (!Number.isSafeInteger(inherited) || inherited < 0 || startIndex < inherited || !checkpointAssociation(receipt)
                || ends.length !== 1 || ends[0]?.type !== 'turn/end' || ends[0].data.reason.kind !== 'completed'
                || Number(ends[0].seq) <= receipt.firstStepStartSeq)
                return { code: 'HISTORICAL_NATIVE_ASSOCIATION_UNKNOWN' };
            let removed = 0, previous = receipt.startSeq;
            for (const seq of receipt.claimSpliceSeqs) {
                const event = events.find(row => Number(row.seq) === seq);
                if (seq <= previous || seq >= receipt.firstStepStartSeq || event?.type !== 'agent/inbox/spliced'
                    || event.data.outcome === 'canceled' || event.data.inserted.length || event.data.start !== 0
                    || !event.data.removedCount)
                    return { code: 'HISTORICAL_CLAIM_UNKNOWN' };
                removed += event.data.removedCount;
                previous = seq;
            }
            if (removed !== work.refs.length)
                return { code: 'HISTORICAL_CLAIM_UNKNOWN' };
            for (const ref of work.refs) {
                const input = agent.lookupInputOwnership(ref);
                const insertIndex = events.findIndex(event => Number(event.seq) === ref.insertSeq);
                if (insertIndex < inherited || input.status !== 'admitted' || input.turn !== receipt.actualTurn
                    || input.userSeq <= receipt.firstStepStartSeq || input.userSeq >= Number(ends[0].seq)) {
                    return { code: 'HISTORICAL_INPUT_ADMISSION_UNKNOWN' };
                }
            }
            return { work };
        };
        const baseIdentityCurrency = (work) => {
            if (!live || revoked || hot !== work || work.stop || ['stopped', 'unknown'].includes(work.status))
                return 'INPUT_PERMISSION_REVOKED';
            return undefined;
        };
        // Data readers need these original owner facts on every call. This path
        // never observes Source and does not grant admission or dispatch rights.
        const baseFactsCurrency = (work) => {
            const identityCode = baseIdentityCurrency(work);
            if (identityCode)
                return identityCode;
            const mutation = mutationCode(agent.session);
            if (mutation)
                return mutation;
            if (!sameDurable(work))
                return 'INPUT_WORK_CHANGED';
            const pointer = table.get(currentKey(sid));
            if (pointer?.preparationId !== work.preparationId || pointer.credentialSha256 !== work.credentialSha256)
                return 'INPUT_CURRENT_CHANGED';
            return undefined;
        };
        const baseCurrency = (work) => {
            const factsCode = baseFactsCurrency(work);
            if (factsCode)
                return factsCode;
            const actualSource = observeExact(agent.session);
            const legacyCompatibility = work.source.kind === 'legacy' && actualSource.kind === 'legacy';
            const boundedManagement = (work.source.kind === 'management' || work.transition?.status === 'committed')
                && actualSource.sourceSha256 === work.source.sourceSha256;
            if (!legacyCompatibility && !boundedManagement && !equal(actualSource, work.source)) {
                return 'INPUT_SOURCE_CHANGED';
            }
            return undefined;
        };
        const stepIdentityCurrency = (step) => {
            const entry = steps.get(step);
            if (!entry || currentStep !== step || entry.work !== hot || entry.generation !== hot?.attemptGeneration
                || entry.signal.aborted)
                return 'INPUT_ATTEMPT_CHANGED';
            return baseIdentityCurrency(entry.work);
        };
        const stepCurrencyUsing = (step, baseCheck) => {
            const identityCode = stepIdentityCurrency(step);
            return identityCode ?? baseCheck(steps.get(step).work);
        };
        const stepCurrency = (step) => stepCurrencyUsing(step, baseCurrency);
        const terminalStored = (scope) => {
            const mutation = mutationCode(agent.session);
            if (mutation)
                return mutation;
            const work = hot, pointer = table.get(currentKey(sid));
            if (!live || revoked || !work || work.status !== 'active' || work.stop || pendingRevocations.has(work.preparationId)
                || !work.terminalRequired || !sameDurable(work) || !equal(currencyOf(work), scope.currency)
                || !equal(work.checkpoint, scope.receipt.checkpoint) || !checkpointAssociation(scope.receipt.checkpoint)
                || pointer?.preparationId !== work.preparationId || pointer.credentialSha256 !== work.credentialSha256) {
                return 'INPUT_TERMINAL_STORED_WORK_CHANGED';
            }
            return undefined;
        };
        let closingGeneration = 0;
        const closingOwner = {
            begin(scope, signal) {
                if (!signal || signal.aborted || terminalStored(scope))
                    fail('INPUT_CLOSING_OWNER_UNPROVEN');
                const actual = agent.lookupInputCompletion(), admittedGeneration = closingGeneration;
                if (actual.status !== 'pending' || !equal(actual.receipt, scope.receipt))
                    fail('INPUT_CLOSING_OWNER_UNPROVEN');
                const lease = Object.freeze({}), session = agent.session;
                const view = { agent, session, signal, scope: clone(scope), current: () => {
                        const completionNow = agent.lookupInputCompletion();
                        return live && !revoked && !signal.aborted && closingGeneration === admittedGeneration
                            && agent.session === session && sessionOwners.get(sid) === agent && owners.get(agent) === binding
                            && !terminalStored(scope) && completionNow.status === 'pending' && equal(completionNow.receipt, scope.receipt);
                    } };
                closingViews.set(lease, view);
                return lease;
            },
            current(lease, scope) {
                const view = closingViews.get(lease);
                return !!view && equal(view.scope, scope) && view.current();
            },
            release(lease) { closingViews.delete(lease); onClosingRelease?.(lease); },
            revoke() { closingGeneration++; },
        };
        const terminal = completion ? createRoleplayInputCompletion({ sessionId: sid, table, enqueue,
            processor: completion, closing: closingOwner,
            current: () => hot?.checkpoint && hot.terminalRequired && hot.attempt?.prepared && !hot.stop && !revoked && live
                && !mutationCode(agent.session)
                ? { currency: currencyOf(hot), checkpoint: hot.checkpoint,
                    ...(hot.transition ? { transition: clone(hot.transition) } : {}) } : undefined,
            checkOriginal: () => !hot ? 'INPUT_NO_CURRENT_CLAIM' : baseCurrency(hot), checkStored: terminalStored,
            nativeCurrent: receipt => {
                const found = agent.lookupInputCompletion();
                return found.status === 'pending' && equal(found.receipt, receipt) && equal(found.checkpoint, receipt.checkpoint);
            }, }) : undefined;
        if (terminal)
            terminalOwners.set(sid, terminal);
        const continuation = createRoleplayInputContinuation({
            current: () => hot?.checkpoint && hot.attempt?.prepared && hot.attempt.snapshot && !hot.transition
                ? { currency: currencyOf(hot), checkpoint: hot.checkpoint } : undefined,
            checkCurrent: () => !hot || !currentStep || stepCurrency(currentStep) || hot.source.kind !== 'story'
                || !hot.checkpoint || !hot.attempt?.prepared || !hot.attempt.snapshot || hot.transition
                ? 'INPUT_CONTINUATION_SCOPE_INVALID' : undefined,
        });
        const stop = (notice) => {
            try {
                onMutationStop?.(agent.session, notice);
            }
            catch (error) {
                report(error);
            }
            if (notice.refsCode)
                for (const preparationId of lifecycle.keys())
                    pendingRevocations.add(preparationId);
            for (const [preparationId, proof] of lifecycle) {
                if (notice.preparation && equal(proof.receipt.preparation, notice.preparation)
                    || notice.refs.some(ref => proof.receipt.refs.some(owned => equal(ref, owned))))
                    pendingRevocations.add(preparationId);
            }
            // An unrelated idle stop has no historical selector. Do not mutate old
            // completed input based solely on the stale current pointer.
            const matchesHot = !!hot && (notice.refsCode || continuation.ownsRefs(notice.refs)
                || notice.preparation && equal(hot.preparation, notice.preparation)
                || notice.refs.some(ref => hot.refs.some(owned => equal(ref, owned))));
            if (hot && matchesHot) {
                terminal?.revoke();
                continuation.close();
                revoked = true;
                hot.stop = { status: notice.refsCode ? 'unknown' : 'terminal', notice: clone(notice), ...(notice.refsCode ? { code: notice.refsCode } : {}) };
                hot.status = notice.refsCode ? 'unknown' : 'stopped';
            }
            let readFailed = false, readError, targets = [];
            try {
                targets = records(sid).filter(work => notice.preparation ? equal(work.preparation, notice.preparation)
                    : notice.refs.some(ref => work.refs.some(owned => equal(ref, owned))));
            }
            catch (error) {
                readFailed = true;
                readError = error;
            }
            if (hot && matchesHot && !targets.some(work => work.preparationId === hot.preparationId))
                targets.push(hot);
            if (notice.refsCode || readFailed)
                for (const preparationId of lifecycle.keys())
                    pendingRevocations.add(preparationId);
            for (const target of targets)
                pendingRevocations.add(target.preparationId);
            if (readFailed)
                report(readError);
            const effectiveRefs = clone(notice.refs.length ? notice.refs : matchesHot ? hot.refs : []);
            const unknownCode = notice.refsCode ?? (readFailed ? 'INPUT_STOP_READ_UNKNOWN' : undefined);
            const materialSettled = matchesHot ? materialOwner?.stop() : undefined;
            // Resource quiescence precedes the FIFO stop record. Never wait for a
            // preparation from inside its own write queue or acknowledge it early.
            return (async () => {
                await materialSettled;
                return enqueue(async () => {
                    try {
                        if (notice.refs.length || notice.refsCode) {
                            const tombstoneKey = `${prefix(sid)}stop-${digest({ stopNonce: notice.stopNonce, stopSequence: notice.stopSequence })}`;
                            const tombstone = { schemaVersion: 2, namespace: ROLEPLAY_INPUT_NAMESPACE, sessionId: sid,
                                refs: effectiveRefs, notice: clone(notice), status: unknownCode ? 'unknown' : 'terminal' };
                            const knownTargets = targets.length > 0 && targets.every(knownNonNumericalWork)
                                && effectiveRefs.length > 0 && effectiveRefs.every(ref => targets.some(work => work.refs.some(owned => equal(ref, owned))));
                            const fact = knownTargets ? registerWriting(actualSession, tombstoneKey, tombstone, 'input-stop') : undefined;
                            await table.put(tombstoneKey, tombstone);
                            registerWritten(actualSession, fact);
                            if (!equal(table.get(tombstoneKey), tombstone))
                                fail('INPUT_STOP_WRITE_UNKNOWN');
                        }
                        for (const target of targets) {
                            const saved = table.get(key(target));
                            const work = hot?.preparationId === target.preparationId ? hot : isWork(saved, sid) ? clone(saved) : target;
                            work.stop = { status: unknownCode ? 'unknown' : 'terminal', notice: clone(notice), ...(unknownCode ? { code: unknownCode } : {}) };
                            work.status = unknownCode ? 'unknown' : 'stopped';
                            await save(work);
                        }
                        return { schemaVersion: 1, stopSequence: notice.stopSequence, stopNonce: notice.stopNonce,
                            ...(unknownCode ? { kind: 'unknown', code: unknownCode } : { kind: 'acknowledged' }) };
                    }
                    catch (error) {
                        revoked = targets.length > 0 || revoked;
                        report(error);
                        return { schemaVersion: 1, stopSequence: notice.stopSequence, stopNonce: notice.stopNonce,
                            kind: 'unknown', code: 'INPUT_STOP_WRITE_UNKNOWN' };
                    }
                });
            })();
        };
        const onBlocked = (notice) => {
            if (!hot || !continuation.ownsRefs(notice.refs) && !notice.refs.some(ref => hot.refs.some(owned => equal(ref, owned))))
                return;
            continuation.close();
            terminal?.revoke();
            revoked = true;
            pendingRevocations.add(hot.preparationId);
            hot.status = 'unknown';
            hot.stop ??= { status: 'unknown', code: notice.code };
            const target = hot;
            void enqueue(() => save(target)).catch(report);
        };
        function materialOriginal(input) {
            const work = hot, token = currentStep, entry = token && steps.get(token);
            if (!work || !token || !entry || entry.work !== work) {
                fail('INPUT_MATERIAL_ORIGINAL_OWNER_UNPROVEN');
            }
            // Reuse the original Native-input joins for both guards. These compare
            // the actual input against this binder; Native still owns its private
            // selected capability, claim/checkpoint, dispatch and closing checks.
            const assertOriginalInput = () => {
                if (!work.attempt?.prepared || !claim || input.admission.identity !== work
                    || !equal(input.admission.preparation, work.preparation) || !equal(input.admission.claim, claim)
                    || !equal(claim.refs, work.refs)
                    || input.admission.receipt !== undefined && !equal(input.admission.receipt, work.checkpoint)) {
                    fail('INPUT_MATERIAL_ORIGINAL_OWNER_UNPROVEN');
                }
                if ('turn' in input && (input.turn !== work.attempt.turn || input.step !== work.attempt.step)
                    || 'signal' in input && input.signal !== entry.signal)
                    fail('INPUT_MATERIAL_ORIGINAL_STEP_UNPROVEN');
            };
            assertOriginalInput();
            if (!work.attempt)
                fail('INPUT_MATERIAL_ORIGINAL_OWNER_UNPROVEN');
            const currency = currencyOf(work), turn = work.attempt.turn, step = work.attempt.step;
            const assertIdentity = () => {
                const code = stepIdentityCurrency(token);
                if (code)
                    fail(code);
                if (hot !== work || currentStep !== token || steps.get(token) !== entry || entry.signal.aborted
                    || agent.session !== actualSession || sessionOwners.get(sid) !== agent || owners.get(agent) !== binding
                    || !equal(currency, currencyOf(work)) || !work.attempt?.prepared
                    || work.attempt.turn !== turn || work.attempt.step !== step)
                    fail('INPUT_MATERIAL_ORIGINAL_OWNER_CHANGED');
                assertOriginalInput();
            };
            return { work, token, entry, currency, turn, step, assertIdentity };
        }
        const materialOwner = material ? createRoleplayInputMaterialOwnerV1(material, { table, enqueue,
            registerNonNumericalBranchRow(input, scope, row) {
                if (ownedRowsDisposed)
                    return;
                if (scope.session !== actualSession)
                    fail('INPUT_OWNED_ROW_SESSION_CHANGED');
                if (row.phase === 'written') {
                    const previous = ownedRows.get(actualSession)?.rows.get(row.key);
                    // Numeric or unregistered writers provide no fact. Missing data
                    // cannot be converted into ownership by a successful later write.
                    if (!previous)
                        return;
                    if (previous.phase !== 'writing' || previous.kind !== row.kind || previous.sha256 !== row.sha256) {
                        fail('INPUT_OWNED_ROW_PENDING_CHANGED');
                    }
                    // The original material writer has just checked this exact put's
                    // readback. Registering its immutable DTO is not a second hash gate.
                    const known = rowsFor(actualSession);
                    known.rows.set(row.key, Object.freeze({ ...previous, phase: 'written' }));
                    known.writtenPreimages.delete(row.key);
                    return;
                }
                const original = materialOriginal(input);
                original.assertIdentity();
                if (scope.stepToken !== original.token || !equal(scope.currency, original.currency))
                    fail('INPUT_OWNED_ROW_STEP_CHANGED');
                if (!knownNonNumericalWork(original.work))
                    return;
                registerPendingRow(actualSession, Object.freeze({ key: row.key, value: row.value,
                    sha256: row.sha256, kind: row.kind, phase: 'writing' }));
            },
            scope(input) {
                const { work, token, entry, currency, turn, step, assertIdentity } = materialOriginal(input);
                const assertCurrent = () => {
                    const code = stepCurrency(token);
                    if (code)
                        fail(code);
                    assertIdentity();
                };
                const assertOwnerFactsCurrent = () => {
                    const code = mutationCode(actualSession);
                    if (code)
                        fail(code);
                    assertIdentity();
                };
                assertOwnerFactsCurrent();
                return { session: agent.session, stepToken: token, currency: clone(currency),
                    preparation: clone(work.preparation), originalInputRefs: clone(work.refs), turn, step,
                    signal: entry.signal, assertCurrent, assertOwnerFactsCurrent,
                    outputRows: [{ table: 'branch', key: workKey(sid, work.refs) }, { table: 'branch', key: currentKey(sid) }] };
            },
        }) : undefined;
        const hook = {
            schemaVersion: 2,
            onContinuationControl: control => continuation.setControl(control),
            recognizeSupplement: input => continuation.recognize(input),
            async admit(proposal, signal, existing) {
                if (!live || signal.aborted || existing)
                    return blocked(existing ? 'INPUT_COLD_RECOVERY_DISABLED' : 'INPUT_PERMISSION_REVOKED');
                if (!proposal.refs.length || proposal.refs.some(ref => ref.sessionId !== sid))
                    return blocked('INPUT_REFS_INVALID');
                if (!Number.isSafeInteger(boundSeq) || proposal.refs.some(ref => ref.insertSeq <= boundSeq))
                    return blocked('INPUT_PREEXISTING_REFS_UNKNOWN');
                const enter = () => enqueue(async () => {
                    if (!live || signal.aborted)
                        return blocked('INPUT_PERMISSION_REVOKED');
                    const mutation = mutationCode(agent.session);
                    if (mutation)
                        return awaitMutationBarrier && mutation === 'MVU_PLAYER_BUSY'
                            ? waitForMutation : blocked(mutation);
                    // Scan owned immutable records, rather than trusting a potentially
                    // lost index/current write. The same refs never acquire a new key.
                    const previous = records(sid);
                    if ([...table.entries()].some(([recordKey, value]) => recordKey.startsWith(`${prefix(sid)}work-`)
                        && !isWork(value, sid)))
                        return blocked('INPUT_STORED_WORK_UNKNOWN');
                    const stopped = [...table.entries()].some(([recordKey, value]) => {
                        if (!recordKey.startsWith(`${prefix(sid)}stop-`))
                            return false;
                        const row = value;
                        return !Array.isArray(row?.refs) || row.notice?.refsCode && !row.refs.length
                            || row.refs.some(ref => proposal.refs.some(item => equal(ref, item)));
                    });
                    if (stopped)
                        return blocked('INPUT_STOPPED_REFS');
                    if (table.get(workKey(sid, proposal.refs)) || previous.some(work => work.refs.some(ref => proposal.refs.some(item => equal(ref, item))))) {
                        return blocked('INPUT_EXISTING_WORK_UNKNOWN');
                    }
                    const terminalGate = readTerminalAdmissionGate(sid, previous);
                    if (terminalGate.kind === 'blocked')
                        return terminalGate;
                    const actualSource = observeExact(agent.session);
                    // The fixed installed Harness may still advertise admission v2
                    // without completed-work support. Fail before acquiring numerical
                    // input authority rather than silently omitting its terminal gate.
                    if (completion && actualSource.kind === 'story' && actualSource.headRef
                        && typeof agent.lookupInputCompletion !== 'function')
                        return blocked('INPUT_COMPLETION_CAPABILITY_MISSING');
                    const inputSource = actualSource.kind !== 'legacy'
                        && !proposal.messages.some(message => message.source?.kind === 'user')
                        ? { kind: 'management', sourceSha256: actualSource.sourceSha256, reason: 'INTERNAL_NATIVE_INPUT' } : actualSource;
                    const terminalRequired = completion && inputSource.kind === 'story' && inputSource.headRef ? true : undefined;
                    const identity = { schemaVersion: 2, namespace: ROLEPLAY_INPUT_NAMESPACE, sessionId: sid,
                        branchId: sid, preparationId: randomUUID(), receiptGeneration: Math.max(0, ...previous.map(work => work.receiptGeneration)) + 1,
                        refs: clone(proposal.refs), ...(terminalRequired ? { terminalRequired: true } : {}) };
                    const credentialSha256 = digest(identity);
                    const work = { ...identity, credentialSha256, preparation: { schemaVersion: 1,
                            namespace: ROLEPLAY_INPUT_NAMESPACE, preparationKeySha256: digest({ sessionId: sid, preparationId: identity.preparationId }),
                            credentialSha256 }, status: 'created', source: inputSource, attemptGeneration: 0 };
                    ownedWorkObjects.add(work);
                    continuation.close();
                    hot = work;
                    revoked = false;
                    claim = undefined;
                    currentStep = undefined;
                    currentLease = undefined;
                    try {
                        await save(work);
                        if (signal.aborted || revoked || !live)
                            return refuseUnclaimed(work, 'INPUT_PERMISSION_REVOKED');
                        const current = { schemaVersion: 2, preparationId: work.preparationId, credentialSha256 }, fact = knownNonNumericalWork(work) ? registerWriting(actualSession, currentKey(sid), current, 'input-current') : undefined;
                        await table.put(currentKey(sid), current);
                        registerWritten(actualSession, fact);
                        if (signal.aborted || revoked || baseCurrency(work))
                            return refuseUnclaimed(work, 'INPUT_PERMISSION_REVOKED');
                        return { kind: 'allow', identity: work, preparation: clone(work.preparation),
                            ...(work.source.kind === 'story' ? { ownedContinuations: true } : {}),
                            ...(work.terminalRequired ? { completedWorkRequired: true } : {}) };
                    }
                    catch (error) {
                        revoked = true;
                        report(error);
                        return refuseUnclaimed(work, 'INPUT_CREATION_WRITE_UNKNOWN');
                    }
                });
                // Preserve the original direct FIFO path when the callbacks are absent.
                // In that case the private wait result is unreachable.
                if (!awaitMutationBarrier && !mutationBlockCode && !preflightObservation)
                    return enter();
                for (;;) {
                    if (!live || signal.aborted)
                        return blocked('INPUT_PERMISSION_REVOKED');
                    const initialMutation = mutationCode(agent.session);
                    if (initialMutation && (!awaitMutationBarrier || initialMutation !== 'MVU_PLAYER_BUSY'))
                        return blocked(initialMutation);
                    if (awaitMutationBarrier) {
                        try {
                            await awaitMutationBarrier(agent.session, signal);
                        }
                        catch (error) {
                            report(error);
                            return blocked(signal.aborted ? 'INPUT_PERMISSION_REVOKED' : 'INPUT_MUTATION_BARRIER_UNKNOWN');
                        }
                    }
                    if (!live || signal.aborted)
                        return blocked('INPUT_PERMISSION_REVOKED');
                    if (preflightObservation) {
                        try {
                            await preflightObservation(agent.session, signal);
                        }
                        catch (error) {
                            report(error);
                            return blocked(signal.aborted ? 'INPUT_PERMISSION_REVOKED' : 'INPUT_PREFLIGHT_UNPROVEN');
                        }
                    }
                    if (!live || signal.aborted)
                        return blocked('INPUT_PERMISSION_REVOKED');
                    const result = await enter();
                    if (result !== waitForMutation)
                        return result;
                    // A newer lease can appear while admission waits for the FIFO. Leave
                    // that queue completely before awaiting/re-reading the current lease.
                }
            },
            check(input) {
                if (!hot || input.identity !== hot || !equal(input.preparation, hot.preparation)
                    || !equal(input.claim.refs, hot.refs) || !equal(input.claim.proposal, input.proposal))
                    return blocked('INPUT_IDENTITY_CHANGED');
                const code = baseCurrency(hot);
                if (code) {
                    continuation.close();
                    return blocked(code);
                }
                if (input.supplement) {
                    if (!hot.checkpoint || !equal(input.supplement.parent, hot.checkpoint))
                        return blocked('INPUT_CONTINUATION_PARENT_CHANGED');
                    const result = continuation.check(input.supplement);
                    if (result.kind === 'blocked')
                        return result;
                }
                claim = input.claim;
                // Native invokes check before Core pre-step and before its first flush.
                // This is preparation authority, not provider readiness.
                if (!input.receipt)
                    return allowed;
                if (!equal(input.receipt, hot.checkpoint) || !hot.attempt?.prepared
                    || hot.attempt.turn !== input.claim.turn)
                    return blocked('INPUT_NOT_PREPARED');
                return allowed;
            },
            async checkpoint(receipt, signal) {
                const work = hot;
                if (!work || signal.aborted || !claim || !equal(receipt.preparation, work.preparation)
                    || !equal(receipt.refs, work.refs) || receipt.actualTurn !== claim.turn
                    || !equal(receipt.claimSpliceSeqs, claim.spliceSeqs))
                    return blocked('INPUT_CHECKPOINT_INVALID');
                // Native's public durable lookup intentionally requires a closed latest
                // turn. Its checkpoint callback instead supplies the flushed live
                // association; match actual events without inventing a turn or seq.
                if (!checkpointAssociation(receipt))
                    return blocked('INPUT_CHECKPOINT_UNPROVEN');
                return enqueue(async () => {
                    const code = baseCurrency(work);
                    if (signal.aborted || code || !work.attempt?.prepared)
                        return blocked(code ?? 'INPUT_NOT_PREPARED');
                    work.checkpoint = clone(receipt);
                    work.status = 'active';
                    try {
                        await save(work);
                    }
                    catch (error) {
                        revoked = true;
                        report(error);
                        return blocked('INPUT_CHECKPOINT_WRITE_UNKNOWN');
                    }
                    if (signal.aborted || revoked || baseCurrency(work))
                        return blocked('INPUT_PERMISSION_REVOKED');
                    lifecycle.set(work.preparationId, { identity: clone(identityOf(work)), receipt: clone(receipt) });
                    return allowed;
                });
            },
            onStop: stop,
            onBlocked,
            ...materialOwner ? { requestMaterial: materialOwner.requestMaterial } : {},
            ...(terminal ? { completedWork: terminal.complete } : {}),
        };
        const unregister = agent.registerInputAdmission(hook);
        const binding = {
            async beginStep({ turn, step, signal, legacyPreparationId }) {
                const work = hot;
                if (!work || !claim || claim.turn !== turn || signal.aborted || !Number.isSafeInteger(step) || step < 1)
                    fail('INPUT_NO_CURRENT_CLAIM');
                return enqueue(async () => {
                    const code = baseCurrency(work);
                    if (code || signal.aborted)
                        fail(code ?? 'INPUT_PERMISSION_REVOKED');
                    const continuesAttempt = work.attempt?.turn === turn && step > work.attempt.step && work.attempt.prepared;
                    if (continuesAttempt)
                        work.attempt = { ...work.attempt, step };
                    else {
                        work.attemptGeneration++;
                        work.attempt = { turn, step, prepared: false, ...(legacyPreparationId ? { legacyPreparationId } : {}) };
                    }
                    await save(work);
                    if (baseCurrency(work) || signal.aborted)
                        fail('INPUT_PERMISSION_REVOKED');
                    const token = Object.freeze({ kind: continuation.isMaintenance() ? 'maintenance'
                            : work.transition?.status === 'legacy-delegated' ? 'legacy'
                                : work.transition ? 'management' : work.source.kind, currency: Object.freeze({ schemaVersion: 2,
                            preparationId: work.preparationId, credentialSha256: work.credentialSha256,
                            receiptGeneration: work.receiptGeneration, attemptGeneration: work.attemptGeneration, source: clone(work.source) }) });
                    steps.set(token, { work, generation: work.attemptGeneration, signal });
                    currentStep = token;
                    return token;
                });
            },
            checkCurrency(step) { const code = stepCurrency(step); return code ? blocked(code) : allowed; },
            async prepare(step, snapshot) {
                return enqueue(async () => {
                    const code = stepCurrency(step);
                    if (code)
                        fail(code);
                    const work = steps.get(step).work;
                    const story = work.source.kind === 'story' && !work.transition;
                    if (story && (!snapshot || !sha(snapshot.sha256) || !snapshot.key))
                        fail('INPUT_STORY_SNAPSHOT_MISSING');
                    if (!story && snapshot)
                        fail('INPUT_MANAGEMENT_SNAPSHOT_FORBIDDEN');
                    work.attempt = { ...work.attempt, prepared: true, ...(snapshot ? { snapshot: clone(snapshot) } : {}) };
                    if (!story)
                        delete work.attempt.snapshot;
                    await save(work);
                    if (stepCurrency(step))
                        fail('INPUT_PERMISSION_REVOKED');
                    return { ...clone(step.currency), ...(snapshot ? { snapshot: clone(snapshot) } : {}) };
                });
            },
            checkSnapshot(currency) {
                if (!hot || baseCurrency(hot) || !hot.checkpoint || !hot.attempt?.prepared
                    || !equal(currency, { schemaVersion: 2, preparationId: hot.preparationId, credentialSha256: hot.credentialSha256,
                        receiptGeneration: hot.receiptGeneration, attemptGeneration: hot.attemptGeneration, source: hot.source,
                        ...(hot.attempt.snapshot ? { snapshot: hot.attempt.snapshot } : {}) }))
                    return blocked('INPUT_SNAPSHOT_STALE');
                return hot.source.kind === 'story' && !hot.transition ? allowed : blocked('INPUT_STORY_AUTHORITY_ABSENT');
            },
            checkAttempt(currency) {
                const current = binding.persistedCurrency();
                if (hot?.transition && currency.source.kind === 'story')
                    return blocked('INPUT_STORY_AUTHORITY_ABSENT');
                if (!hot || baseCurrency(hot) || !current || currency.schemaVersion !== 2 || currency.preparationId !== current.preparationId
                    || currency.credentialSha256 !== current.credentialSha256 || currency.receiptGeneration !== current.receiptGeneration
                    || currency.attemptGeneration !== current.attemptGeneration || !equal(currency.source, current.source)) {
                    return blocked('INPUT_ATTEMPT_CHANGED');
                }
                return allowed;
            },
            checkHistoricalTaskCurrency(currency) {
                const result = historical(currency);
                return result.code ? blocked(result.code) : allowed;
            },
            checkHistoricalSnapshot(currency) {
                const result = historical(currency);
                return result.code ? blocked(result.code) : equal(currency, currencyOf(result.work)) && !!result.work.attempt?.snapshot
                    ? allowed : blocked('HISTORICAL_SNAPSHOT_CHANGED');
            },
            historicalCurrency(currency) {
                const result = historical(currency);
                return result.work ? currencyOf(result.work) : undefined;
            },
            persistedCurrency() {
                if (!hot || !hot.attempt || baseCurrency(hot))
                    return undefined;
                return currencyOf(hot);
            },
            currentStep() { return currentStep && !stepCurrency(currentStep) ? currentStep : undefined; },
            readClaimedInputSource() {
                try {
                    const work = hot;
                    if (!live || revoked || !work || !claim || work.transition || continuation.isMaintenance()
                        || !equal(claim.refs, work.refs))
                        return undefined;
                    // check may retain its claim after closing. Only the actual latest
                    // open Native turn, already started before assembly, supplies Source.
                    const events = agent.session.snapshotEvents(), index = events.findLastIndex(event => event.type === 'turn/start'), start = events[index];
                    if (start?.type !== 'turn/start' || start.data.turn !== claim.turn
                        || events.slice(index + 1).some(event => event.type === 'turn/end') || baseCurrency(work))
                        return undefined;
                    return clone(work.source);
                }
                catch {
                    return undefined;
                }
            },
            existingTransition() {
                return hot?.transition && currentLease && !baseCurrency(hot)
                    ? { lease: currentLease, proof: clone(hot.transition.reservation.proof) } : undefined;
            },
            originalMessages(step) {
                const code = stepCurrency(step);
                if (code || !claim || !equal(claim.refs, hot?.refs))
                    fail(code ?? 'INPUT_NO_CURRENT_CLAIM');
                return claim.messages;
            },
            steerOwnedContinuation(message, turn) {
                return continuation.steer(message, turn);
            },
            /** Root supplies a verified actual open Native call before its first await. */
            beginTransition(step, actualCall) {
                const code = stepCurrency(step);
                if (code)
                    fail(code);
                if (step.kind === 'maintenance')
                    fail('INPUT_MAINTENANCE_TRANSITION_FORBIDDEN');
                continuation.close();
                const work = steps.get(step).work;
                if (work.transition || !work.refs.some(ref => equal(ref, actualCall.playerRef)) || !actualCall.callId)
                    fail('INPUT_TRANSITION_INVALID');
                const partialProof = { ...clone(actualCall), sourceProofSha256: '', channel: 'chat-attachment', requestId: '',
                    sourceSha256: work.source.sourceSha256, rawSourceSha256: '' };
                const reservation = Object.freeze({ reservationId: randomUUID(), preparationId: work.preparationId, proof: partialProof });
                work.transition = { reservation, from: clone(work.source), status: 'revoked' };
                work.attempt = { ...work.attempt, prepared: false };
                delete work.attempt.snapshot;
                reservations.set(reservation, { work, step });
                const assertLease = () => {
                    const mutation = mutationCode(agent.session);
                    if (mutation)
                        fail(mutation);
                    if (hot !== work || revoked || !live || work.stop || steps.get(step).signal.aborted)
                        fail('INPUT_PERMISSION_REVOKED');
                };
                const assertLegacyLease = () => {
                    const mutation = mutationCode(agent.session);
                    if (mutation)
                        fail(mutation);
                    if (!live || work.stop || steps.get(step).signal.aborted || observeExact(agent.session).kind !== 'legacy') {
                        fail('INPUT_LEGACY_PERMISSION_REVOKED');
                    }
                };
                const persist = async () => {
                    try {
                        await save(work);
                    }
                    catch (error) {
                        revoked = true;
                        report(error);
                        fail('INPUT_TRANSITION_WRITE_UNKNOWN');
                    }
                    assertLease();
                };
                // Persist revocation even if source resolution fails before reserve.
                const revokedWrite = enqueue(persist);
                void revokedWrite.catch(report);
                const lease = {
                    reservationId: reservation.reservationId,
                    async reserve(proof) {
                        await revokedWrite;
                        return enqueue(async () => {
                            assertLease();
                            if (work.transition.status !== 'revoked') {
                                if (!equal(work.transition.reservation.proof, proof))
                                    fail('INPUT_SECOND_TRANSITION_REJECTED');
                                return;
                            }
                            if (proof.callId !== actualCall.callId
                                || !equal(proof.playerRef, actualCall.playerRef) || !sha(proof.sourceProofSha256)
                                || !['chat-attachment', 'workspace'].includes(proof.channel)
                                || !sha(proof.rawSourceSha256) || !proof.requestId
                                || proof.sourceSha256 !== work.source.sourceSha256)
                                fail('INPUT_TRANSITION_INVALID');
                            work.transition.reservation = { ...reservation, proof: clone(proof) };
                            work.transition.status = 'reserved';
                            await persist();
                            reservationLeases.set(reservation.reservationId, lease);
                        });
                    },
                    bindJob(job) {
                        return enqueue(async () => {
                            assertLease();
                            if (work.transition.status !== 'reserved') {
                                if (!equal(work.transition.job, job))
                                    fail('INPUT_TRANSITION_JOB_INVALID');
                                return;
                            }
                            if (!job.jobId || !boundedId(job.jobGeneration)
                                || job.requestId !== work.transition.reservation.proof.requestId
                                || job.rawSourceSha256 !== work.transition.reservation.proof.rawSourceSha256)
                                fail('INPUT_TRANSITION_JOB_INVALID');
                            work.transition.job = clone(job);
                            work.transition.status = 'job-bound';
                            await persist();
                            leases.set(`${sid}:${job.jobId}:${job.jobGeneration}`, lease);
                        });
                    },
                    prepareActivation(proof) {
                        return enqueue(async () => {
                            if (work.transition.status === 'legacy-delegated') {
                                assertLegacyLease();
                                return;
                            }
                            assertLease();
                            // Copy the declared reservation fields only. A caller may pass
                            // an activation DTO that additionally carries the future Source;
                            // that mutable observation is never part of this prepared proof.
                            const preparedProof = { importId: proof.importId,
                                transactionId: proof.transactionId, oldPointerSha256: proof.oldPointerSha256,
                                writeDigests: clone(proof.writeDigests) };
                            if (['activation-prepared', 'committed'].includes(work.transition.status)) {
                                if (!equal(work.transition.activationProof, preparedProof))
                                    fail('INPUT_SECOND_TRANSITION_REJECTED');
                                return;
                            }
                            if (work.transition.status !== 'job-bound' || !proof.importId || !proof.transactionId
                                || !recordDigest(proof.oldPointerSha256) || !Object.keys(proof.writeDigests).length
                                || Object.values(proof.writeDigests).some(value => !recordDigest(value)))
                                fail('INPUT_ACTIVATION_INVALID');
                            work.transition.activationProof = preparedProof;
                            work.transition.status = 'activation-prepared';
                            await persist();
                        });
                    },
                    checkActivation() {
                        if (work.transition.status === 'legacy-delegated') {
                            assertLegacyLease();
                            return;
                        }
                        assertLease();
                        if (!['activation-prepared', 'committed'].includes(work.transition.status)
                            || !work.transition.job || !work.transition.activationProof)
                            fail('INPUT_ACTIVATION_UNPROVEN');
                    },
                    getActivationProof() { return clone(work.transition?.activationProof); },
                    isLegacy() { return work.transition?.status === 'legacy-delegated'; },
                    rejectSource(code = 'IMPORT_SOURCE_REJECTED') {
                        return enqueue(async () => {
                            assertLease();
                            const transition = work.transition;
                            if (!['revoked', 'reserved'].includes(transition.status) || transition.job || transition.activationProof
                                || !equal(observeExact(agent.session), transition.from) || !/^[A-Z][A-Z0-9_]{0,63}$/.test(code)) {
                                fail('INPUT_SOURCE_REJECTION_UNPROVEN');
                            }
                            transition.status = 'source-rejected';
                            work.source = { kind: 'management', sourceSha256: transition.from.sourceSha256, reason: code };
                            work.attempt = { ...work.attempt, prepared: true };
                            delete work.attempt.snapshot;
                            await persist();
                        });
                    },
                    delegateLegacy(proof, merge) {
                        return enqueue(async () => {
                            assertLease();
                            const transition = work.transition, actual = observeExact(agent.session);
                            if (!['reserved', 'job-bound'].includes(transition.status) || !equal(proof, transition.reservation.proof)
                                || actual.kind !== 'legacy' || actual.reason !== 'LEGACY_SEMANTIC_IMPORT')
                                fail('INPUT_LEGACY_DELEGATION_INVALID');
                            if (merge && (transition.job || merge.schemaVersion !== 1 || merge.kind !== 'semantic-merge-source'
                                || !boundedId(merge.importId) || !sha(merge.normalizedSha256)))
                                fail('INPUT_LEGACY_DELEGATION_INVALID');
                            if (!transition.job && !merge)
                                fail('INPUT_LEGACY_HANDOFF_MISSING');
                            if (merge)
                                transition.legacyRecord = clone(merge);
                            transition.status = 'legacy-delegated';
                            work.source = actual;
                            work.attempt = { ...work.attempt, prepared: true };
                            await persist();
                        });
                    },
                    commit(activation) { return binding.commitTransition(reservation, activation); },
                    fail(code) {
                        revoked = true;
                        work.status = 'unknown';
                        work.stop ??= { status: 'unknown', code };
                        return enqueue(() => save(work)).catch(report);
                    },
                };
                currentLease = lease;
                return lease;
            },
            commitTransition(reservation, activation) {
                const entry = reservations.get(reservation);
                return enqueue(async () => {
                    if (!entry || !sha(activation.sourceSha256) || !equal(entry.work.transition?.activationProof, { importId: activation.importId, transactionId: activation.transactionId,
                        oldPointerSha256: activation.oldPointerSha256, writeDigests: activation.writeDigests })) {
                        return { kind: 'unknown', code: 'INPUT_ACTIVATION_INVALID' };
                    }
                    const work = entry.work, transition = work.transition;
                    if (transition.status === 'committed') {
                        return equal(transition.activation, activation) && !work.stop && !revoked ? { kind: 'acknowledged' }
                            : { kind: 'unknown', code: 'INPUT_SECOND_TRANSITION_REJECTED' };
                    }
                    // Persist the nested transition through its owning work record.
                    // A local transition view is not the writer's durable snapshot.
                    work.transition = { ...transition, activation: clone(activation) };
                    if (hot !== work || !live || entry && steps.get(entry.step)?.signal.aborted) {
                        work.stop ??= { status: 'unknown', code: 'INPUT_PERMISSION_REVOKED' };
                        work.status = work.stop.status === 'terminal' ? 'stopped' : 'unknown';
                    }
                    let actual;
                    try {
                        actual = observeExact(agent.session);
                        if (actual.sourceSha256 !== activation.sourceSha256)
                            fail('INPUT_ACTIVATION_SOURCE_MISMATCH');
                    }
                    catch (error) {
                        revoked = true;
                        work.status = 'unknown';
                        work.transition = { ...work.transition, status: 'unknown' };
                        work.stop ??= { status: 'unknown', code: 'INPUT_ACTIVATION_SOURCE_UNKNOWN' };
                        report(error);
                        try {
                            await save(work);
                        }
                        catch (writeError) {
                            report(writeError);
                        }
                        return { kind: 'unknown', code: 'INPUT_ACTIVATION_SOURCE_UNKNOWN' };
                    }
                    work.transition = { ...work.transition, status: 'committed', to: clone(actual) };
                    work.source = { kind: 'management', sourceSha256: actual.sourceSha256, reason: 'import-transition-ack' };
                    // ACK observation must still track actual Source/head, rather than
                    // claiming the synthetic management reason is the actual observation.
                    work.attempt = { ...work.attempt, prepared: !work.stop && !revoked };
                    try {
                        await save(work);
                    }
                    catch (error) {
                        revoked = true;
                        work.status = 'unknown';
                        work.stop ??= { status: 'unknown', code: 'INPUT_TRANSITION_WRITE_UNKNOWN' };
                        report(error);
                        return { kind: 'unknown', code: 'INPUT_TRANSITION_WRITE_UNKNOWN' };
                    }
                    return work.stop || revoked ? { kind: 'unknown', code: 'INPUT_PERMISSION_REVOKED' } : { kind: 'acknowledged' };
                });
            },
            current() {
                if (!hot)
                    return undefined;
                return { preparationId: hot.preparationId, receiptGeneration: hot.receiptGeneration,
                    kind: continuation.isMaintenance() ? 'maintenance' : hot.transition?.status === 'legacy-delegated'
                        ? 'legacy' : hot.transition ? 'management' : hot.source.kind,
                    status: hot.status, checkpoint: clone(hot.checkpoint), attemptGeneration: hot.attemptGeneration,
                    prepared: hot.attempt?.prepared === true, refs: clone(hot.refs), currency: binding.persistedCurrency() };
            },
            dispose() {
                if (!live)
                    return;
                live = false;
                materialOwner?.dispose();
                terminal?.dispose();
                if (terminalOwners.get(sid) === terminal)
                    terminalOwners.delete(sid);
                revoked = true;
                continuation.close();
                currentStep = undefined;
                unregister();
                owners.delete(agent);
                if (hot?.transition)
                    reservationLeases.delete(hot.transition.reservation.reservationId);
                if (sessionOwners.get(sid) === agent)
                    sessionOwners.delete(sid);
                if (liveRevocations.get(sid) === pendingRevocations)
                    liveRevocations.delete(sid);
                for (const leaseKey of leases.keys())
                    if (leaseKey.startsWith(`${sid}:`))
                        leases.delete(leaseKey);
            },
        };
        owners.set(agent, binding);
        return binding;
    }
    const api = {
        bind,
        /** Source-free provenance only. No scope/current, ledger, Agent lookup or
         * mutation gate runs here; stopped/disposed binders never regain rights. */
        readOwnedNonNumericalBranchRowFacts(session) {
            if (ownedRowsDisposed || !session || typeof session !== 'object')
                return Object.freeze([]);
            const known = ownedRows.get(session);
            if (!known)
                return Object.freeze([]);
            if (session.id !== known.sessionId)
                fail('INPUT_OWNED_ROW_SESSION_CHANGED');
            const result = [];
            for (const row of known.rows.values()) {
                const actual = table.get(row.key);
                if (actual === undefined || actual === null)
                    continue;
                if (sameOwnedRowData(actual, row.value) && recordSha256(actual) === row.sha256) {
                    result.push(row);
                    continue;
                }
                const previous = row.phase === 'writing' ? known.writtenPreimages.get(row.key) : undefined;
                if (!previous || !sameOwnedRowData(actual, previous.value) || recordSha256(actual) !== previous.sha256) {
                    fail('INPUT_OWNED_ROW_CHANGED');
                }
                result.push(previous);
            }
            return Object.freeze(result);
        },
        /** Historical typed facts have a separate evidence type. Never register
         * them as this process's writer facts or use them to admit/recover work. */
        readColdNonNumericalBranchRowFacts(session) {
            if (ownedRowsDisposed)
                fail('INPUT_COLD_OWNER_DISPOSED');
            if (!sessionForRowFacts || !readColdMaterialHistory)
                fail('INPUT_COLD_OWNER_NOT_CONFIGURED');
            const actual = sessionForRowFacts(session.id);
            if (!actual || actual !== session)
                fail('INPUT_COLD_SESSION_INVALID');
            return readColdNonNumericalInputBranchRowFactsV1(actual, { table, namespace: ROLEPLAY_INPUT_NAMESPACE,
                prefix, workKey, currentKey, digest, isWork,
                ownedRowKeys: new Set(ownedRows.get(actual)?.rows.keys() ?? []),
                currencyOfStored: value => currencyOfStored(value),
                nonNumericalSource: value => nonNumericalSource(value),
                sessionForRowFacts, readColdMaterialHistory,
                assertNotDisposed: () => { if (ownedRowsDisposed)
                    fail('INPUT_COLD_OWNER_DISPOSED'); }, });
        },
        /** Root calls this once at Core disposal. Per-Agent disposal intentionally
         * retains only exact explanatory data for its actual Session object. */
        disposeOwnedNonNumericalBranchRowFacts() {
            ownedRowsDisposed = true;
            ownedRows = new WeakMap();
        },
        /** Select and validate the actual closing lease. A returned view is current
         * at this synchronous boundary; retained views recheck after an await. */
        readClosingView(lease, scope) {
            const view = closingViews.get(lease);
            return view && equal(view.scope, scope) && view.current() ? view : undefined;
        },
        readTerminalAdmissionGate: (sessionId) => readTerminalAdmissionGate(sessionId),
        /** Idle task recovery needs known durable refusals before it can enqueue
         * another wake. A settled ledger without a hot schema view is not a known
         * refusal, and absence of refusal grants no Source or Native permission. */
        readTaskRecoveryBlockCode(sessionId) {
            const gate = readTerminalAdmissionGate(sessionId, undefined, false);
            return gate.kind === 'blocked' ? gate.code : undefined;
        },
        /** Historical consumption still needs the exact original work ledger. A
         * late Native stop cannot be hidden by an already written settled row. */
        verifyConsumedScope(scope) {
            try {
                const sid = scope.receipt.checkpoint.sessionId, row = readInputCompletion(table, sid, scope.currency.preparationId);
                // Native's original refs select the one durable Work address. UUID
                // identity is joined below; searching every historical Work cannot
                // establish another valid address for this completed claim.
                const refs = scope.receipt.checkpoint.refs, work = table.get(workKey(sid, refs));
                if (!row || row.status !== 'settled' || !equal(row.scope, scope) || !isWork(work, sid)
                    || work.preparationId !== scope.currency.preparationId || !equal(work.refs, refs))
                    return false;
                if (liveRevocations.get(sid)?.has(work.preparationId))
                    return false;
                for (const [recordKey, value] of table.entries())
                    if (recordKey.startsWith(`${prefix(sid)}stop-`)) {
                        const tombstone = value;
                        if (!Array.isArray(tombstone.refs) || tombstone.notice?.refsCode && !tombstone.refs.length
                            || tombstone.refs.some(ref => work.refs.some(owned => equal(ref, owned))))
                            return false;
                    }
                return work.terminalRequired === true && work.status === 'active' && !work.stop
                    && equal(currencyOfStored(work), scope.currency) && equal(work.checkpoint, scope.receipt.checkpoint)
                    && equal(work.refs, scope.receipt.checkpoint.refs) && equal(work.transition, scope.transition);
            }
            catch {
                return false;
            }
        },
        checkTerminalPermission(token, intent) {
            return terminalOwners.get(intent.sessionId)?.checkPermission(token, intent) === true;
        },
        /** Stored intent is a factual association, not a cold permission token. */
        verifyTerminalIntent(intent) {
            try {
                const row = readInputCompletion(table, intent.sessionId, intent.preparationId);
                const matches = records(intent.sessionId).filter(work => work.preparationId === intent.preparationId);
                if (!row || row.plan.kind !== 'numerical' || !equal(row.plan.intent, intent) || matches.length !== 1)
                    return false;
                const work = matches[0];
                return work.terminalRequired === true && equal(work.checkpoint, row.scope.receipt.checkpoint)
                    && equal(currencyOfStored(work), row.scope.currency) && equal(work.refs, row.scope.receipt.checkpoint.refs)
                    && completion?.verifyStored(row.scope, intent) === true;
            }
            catch {
                return false;
            }
        },
        /** Driver inherits the actual chat reservation through exact job identity.
         * Cold handles can only record an already proven activation; they cannot
         * prepare a new switch, authorize ACK/story, wake or repeat the input. */
        transitionForJob(sessionId, jobId, jobGeneration) {
            const hotLease = leases.get(`${sessionId}:${jobId}:${jobGeneration}`);
            if (hotLease)
                return hotLease;
            const matches = records(sessionId).filter(work => work.transition?.job?.jobId === jobId
                && work.transition.job.jobGeneration === jobGeneration);
            if (matches.length !== 1)
                return undefined;
            const initial = matches[0], reservationId = initial.transition.reservation.reservationId;
            const unavailable = () => Promise.reject(new Error('INPUT_COLD_TRANSITION_UNKNOWN'));
            return {
                reservationId,
                reserve: unavailable,
                bindJob: unavailable,
                prepareActivation: unavailable,
                delegateLegacy: unavailable,
                checkActivation() { fail('INPUT_COLD_TRANSITION_UNKNOWN'); },
                getActivationProof() { return clone(initial.transition?.activationProof); },
                isLegacy() { return initial.transition?.status === 'legacy-delegated'; },
                rejectSource: unavailable,
                fail(code) {
                    return enqueue(async () => {
                        const value = table.get(workKey(sessionId, initial.refs));
                        if (!isWork(value, sessionId))
                            fail('INPUT_COLD_WORK_UNKNOWN');
                        const work = clone(value);
                        work.status = 'unknown';
                        work.stop ??= { status: 'unknown', code };
                        await table.put(workKey(sessionId, work.refs), work);
                    }).catch(report);
                },
                commit(activation) {
                    return enqueue(async () => {
                        const value = table.get(workKey(sessionId, initial.refs));
                        if (!isWork(value, sessionId))
                            return { kind: 'unknown', code: 'INPUT_COLD_WORK_UNKNOWN' };
                        const work = clone(value), transition = work.transition;
                        if (!transition || transition.reservation.reservationId !== reservationId
                            || !equal(transition.activationProof, { importId: activation.importId, transactionId: activation.transactionId,
                                oldPointerSha256: activation.oldPointerSha256, writeDigests: activation.writeDigests })
                            || !sha(activation.sourceSha256) || transition.activation && !equal(transition.activation, activation)) {
                            return { kind: 'unknown', code: 'INPUT_COLD_ACTIVATION_UNPROVEN' };
                        }
                        transition.activation = clone(activation);
                        transition.status = 'committed';
                        work.status = 'unknown';
                        work.stop ??= { status: 'unknown', code: 'INPUT_COLD_AUTHORITY_ABSENT' };
                        try {
                            await table.put(workKey(sessionId, work.refs), work);
                            if (!equal(table.get(workKey(sessionId, work.refs)), work))
                                fail('INPUT_WRITE_UNCONFIRMED');
                        }
                        catch (error) {
                            report(error);
                            return { kind: 'unknown', code: 'INPUT_TRANSITION_WRITE_UNKNOWN' };
                        }
                        return { kind: 'unknown', code: 'INPUT_COLD_AUTHORITY_ABSENT' };
                    });
                },
            };
        },
        transitionForRequest(sessionId, requestId, rawSourceSha256) {
            const matches = records(sessionId).filter(work => work.transition?.reservation.proof.requestId === requestId
                && work.transition.reservation.proof.rawSourceSha256 === rawSourceSha256);
            if (matches.length !== 1)
                return undefined;
            const transition = matches[0].transition;
            const hotLease = reservationLeases.get(transition.reservation.reservationId);
            if (hotLease)
                return hotLease;
            return transition.job ? api.transitionForJob(sessionId, transition.job.jobId, transition.job.jobGeneration) : undefined;
        },
    };
    return api;
}
