// Generated from runtime/alpha3/src/core/roleplay-mvu-prefix-ledger.ts; edit the TypeScript source.
/** Read-only numerical consumption evidence for an actual inherited Native cut.
 * Core supplies verified genesis and the frozen cut. This reader never borrows
 * a live Agent, current owner/head pointer, permission token or flush capability. */
import { recordSha256 } from './roleplay-data.js';
import { prepareMvuUpdate } from './roleplay-mvu-update.js';
import { verifyInheritedCompletedFact } from './roleplay-mvu-prefix-facts.js';
import { mvuStateEventKey, mvuStateSettlementKey, MVU_STATE_BOUNDS } from './roleplay-mvu-state.js';
import { readMvuPlayerOperationFacts, mvuPlayerOperationKey, mvuPlayerCompletionKey } from './roleplay-mvu-player-facts.js';
import { MVU_PLAYER_EDIT_EVENT, assertMvuPlayerEditEvent } from 'dsh-nexttavern-session-format/mvu-player-marker';
const NAMESPACE = 'nexttavern.roleplay.input.v2';
class LedgerRefusal extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
function fail(code) { throw new LedgerRefusal(code); }
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const pathKey = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,512}$/.test(value);
const integer = (value, min = 0) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= min && !Object.is(value, -0);
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const same = (left, right) => recordSha256(left) === recordSha256(right);
const ownPrefix = (sid) => `${sid}__native-input-v2-`;
const terminalKey = (sid, prep) => `${ownPrefix(sid)}terminal-${prep}`;
const workKey = (sid, refs) => `${ownPrefix(sid)}work-${recordSha256(refs)}`;
const refKey = (ref) => `${ref.insertSeq}:${ref.messageId}`;
function exact(value, required, optional = []) {
    if (!object(value) || required.some(name => !Object.hasOwn(value, name))
        || Object.keys(value).some(name => !required.includes(name) && !optional.includes(name)))
        fail('LEDGER_SCHEMA_INVALID');
}
/** Inspect persisted ledger descriptors before any hashes or field reads. Bounds
 * mirror numerical-record limits; the larger Native cut gets its own byte limit.
 * Undefined is retained for actual Native events, never converted to Core missing. */
function inspect(value, byteLimit = MVU_STATE_BOUNDS.recordBytes) {
    let nodes = 0, bytes = 0;
    const ancestors = new Set();
    function visit(item, depth) {
        if (++nodes > MVU_STATE_BOUNDS.descriptorNodes || depth > MVU_STATE_BOUNDS.descriptorDepth)
            fail('LEDGER_BUDGET');
        if (item === null || item === undefined || typeof item === 'boolean')
            return;
        if (typeof item === 'number') {
            if (!Number.isFinite(item) || Math.abs(item) > Number.MAX_SAFE_INTEGER)
                fail('LEDGER_DATA_INVALID');
            return;
        }
        if (typeof item === 'string') {
            bytes += Buffer.byteLength(item, 'utf8');
            if (bytes > byteLimit)
                fail('LEDGER_BUDGET');
            return;
        }
        if (!item || typeof item !== 'object' || ancestors.has(item))
            fail('LEDGER_DATA_INVALID');
        const array = Array.isArray(item), proto = Object.getPrototypeOf(item);
        if ((array ? proto !== Array.prototype : ![Object.prototype, null].includes(proto))
            || Object.getOwnPropertySymbols(item).length)
            fail('LEDGER_DATA_INVALID');
        const descriptors = Object.getOwnPropertyDescriptors(item);
        if (array && (item.length > 100_000 || Object.keys(descriptors).length !== item.length + 1))
            fail('LEDGER_BUDGET');
        ancestors.add(item);
        for (const [name, descriptor] of Object.entries(descriptors)) {
            if (array && name === 'length')
                continue;
            if (!('value' in descriptor) || !descriptor.enumerable || ['__proto__', 'constructor', 'prototype'].includes(name)) {
                fail('LEDGER_DATA_INVALID');
            }
            if (array && (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= item.length))
                fail('LEDGER_DATA_INVALID');
            bytes += Buffer.byteLength(name, 'utf8');
            if (bytes > byteLimit)
                fail('LEDGER_BUDGET');
            visit(descriptor.value, depth + 1);
        }
        ancestors.delete(item);
    }
    visit(value, 0);
}
function snapshotValid(value, sid, source) {
    inspect(value);
    exact(value, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'root', 'currentHead', 'revision',
        'headSha256', 'values', 'valuesSha256', 'stateSnapshotSha256']);
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-state-snapshot-v1'
        || value.sessionId !== sid || value.sourceSha256 !== source || !object(value.root) || !object(value.currentHead)
        || !object(value.values) || !integer(value.revision, 1) || value.currentHead.sessionId !== sid
        || value.currentHead.revision !== value.revision || value.currentHead.valuesSha256 !== value.valuesSha256
        || value.headSha256 !== recordSha256(value.currentHead) || value.valuesSha256 !== recordSha256(value.values))
        fail('NUMERICAL_SNAPSHOT_INVALID');
    const { stateSnapshotSha256, ...body } = value;
    if (!hash(stateSnapshotSha256) || stateSnapshotSha256 !== recordSha256(body))
        fail('NUMERICAL_SNAPSHOT_INVALID');
}
function validateRefs(value, sid) {
    if (!Array.isArray(value) || !value.length || value.length > 64)
        fail('WORK_REFS_INVALID');
    const ids = new Set();
    for (const ref of value) {
        exact(ref, ['sessionId', 'insertSeq', 'messageId', 'messageSha256']);
        if (ref.sessionId !== sid || !integer(ref.insertSeq) || typeof ref.messageId !== 'string' || !ref.messageId.length
            || ref.messageId.length > 1024 || /[\u0000-\u001f\u007f-\u009f]/.test(ref.messageId)
            || !hash(ref.messageSha256) || ids.has(ref.messageId))
            fail('WORK_REFS_INVALID');
        ids.add(ref.messageId);
    }
}
function validateWork(value, sid) {
    exact(value, ['schemaVersion', 'namespace', 'sessionId', 'branchId', 'preparationId', 'receiptGeneration', 'refs',
        'credentialSha256', 'preparation', 'status', 'source', 'attemptGeneration'], ['attempt', 'checkpoint', 'terminalRequired', 'stop', 'transition', 'unclaimedRefusal']);
    validateRefs(value.refs, sid);
    if (value.schemaVersion !== 2 || value.namespace !== NAMESPACE || value.sessionId !== sid || value.branchId !== sid
        || !id(value.preparationId) || !integer(value.receiptGeneration, 1) || !integer(value.attemptGeneration)
        || !['created', 'active', 'stopped', 'unknown'].includes(String(value.status))
        || (value.terminalRequired !== undefined && value.terminalRequired !== true))
        fail('WORK_IDENTITY_INVALID');
    if (!object(value.source) || !['story', 'management', 'legacy'].includes(String(value.source.kind))
        || !hash(value.source.sourceSha256))
        fail('WORK_SOURCE_INVALID');
    const identity = { schemaVersion: 2, namespace: NAMESPACE, sessionId: sid, branchId: sid,
        preparationId: value.preparationId, receiptGeneration: value.receiptGeneration, refs: value.refs,
        ...(value.terminalRequired ? { terminalRequired: true } : {}) };
    if (!hash(value.credentialSha256) || value.credentialSha256 !== recordSha256(identity)
        || !same(value.preparation, { schemaVersion: 1, namespace: NAMESPACE,
            preparationKeySha256: recordSha256({ sessionId: sid, preparationId: value.preparationId }),
            credentialSha256: value.credentialSha256 }))
        fail('WORK_CREDENTIAL_INVALID');
    if (value.attempt !== undefined) {
        exact(value.attempt, ['turn', 'step', 'prepared'], ['legacyPreparationId', 'snapshot']);
        if (!integer(value.attempt.turn) || !integer(value.attempt.step, 1) || typeof value.attempt.prepared !== 'boolean') {
            fail('WORK_ATTEMPT_INVALID');
        }
    }
    return value;
}
function numerical(work) {
    return work.terminalRequired === true || work.source?.kind === 'story' && !!work.source.headRef;
}
function currency(work) {
    return { schemaVersion: 2, preparationId: work.preparationId, credentialSha256: work.credentialSha256,
        receiptGeneration: work.receiptGeneration, attemptGeneration: work.attemptGeneration, source: structuredClone(work.source),
        ...(work.attempt?.snapshot ? { snapshot: structuredClone(work.attempt.snapshot) } : {}) };
}
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
export function createRoleplayMvuPrefixLedger(deps) {
    function capture(request) {
        try {
            inspect(request, 16_777_216);
            exact(request, ['ownerSessionId', 'ownerInheritedEventCount', 'events', 'sourceSha256', 'genesis']);
            const sid = request.ownerSessionId, cut = request.events.length;
            if (!id(sid) || !hash(request.sourceSha256) || !integer(request.ownerInheritedEventCount)
                || !Array.isArray(request.events) || cut > 100_000 || request.ownerInheritedEventCount > cut
                || request.events.some((event, index) => event.seq !== index || typeof event.type !== 'string'))
                fail('PREFIX_REQUEST_INVALID');
            snapshotValid(request.genesis, sid, request.sourceSha256);
            if (request.genesis.revision !== 1)
                fail('GENESIS_REQUIRED');
            const branchRows = new Map(), statusRows = new Map();
            const read = (table, rowKey, observed) => {
                if (!pathKey(rowKey) || !rowKey.startsWith(`${sid}__`))
                    fail('LEDGER_KEY_INVALID');
                const value = table.get(rowKey);
                inspect(value);
                if (observed !== undefined && !same(value, observed))
                    fail('LEDGER_READBACK_CHANGED');
                return value;
            };
            for (const [rowKey, row] of deps.branch.entries()) {
                if (!rowKey.startsWith(ownPrefix(sid)) && !rowKey.startsWith(`${sid}__mvu-player-operation-`)
                    && !rowKey.startsWith(`${sid}__mvu-player-complete-`))
                    continue;
                if (branchRows.size >= MVU_STATE_BOUNDS.records)
                    fail('LEDGER_BUDGET');
                branchRows.set(rowKey, read(deps.branch, rowKey, row));
            }
            for (const [rowKey, row] of deps.status.entries()) {
                if (!rowKey.startsWith(`${sid}__mvu-state-event-`) && !rowKey.startsWith(`${sid}__mvu-state-settlement-`))
                    continue;
                if (statusRows.size >= MVU_STATE_BOUNDS.records)
                    fail('LEDGER_BUDGET');
                statusRows.set(rowKey, read(deps.status, rowKey, row));
            }
            // Classification uses actual queue removals and actual Native starts.
            // Ref insertion alone is insufficient: pending target input can be inside
            // the cut although the parent's later claim/start is strictly outside it.
            const queues = { 'next-turn': [], 'next-step': [] };
            const claimed = new Set(), starts = [];
            for (const event of request.events) {
                if (event.type === 'agent/inbox/spliced') {
                    const row = event.data;
                    if (!object(row) || (row.target !== 'next-turn' && row.target !== 'next-step') || !integer(row.start)
                        || !integer(row.removedCount ?? 0) || !Array.isArray(row.inserted))
                        fail('PREFIX_QUEUE_INVALID');
                    const queue = queues[row.target], count = Number(row.removedCount ?? 0);
                    if (row.start > queue.length || row.start + count > queue.length
                        || (row.outcome !== undefined && row.outcome !== 'canceled'))
                        fail('PREFIX_QUEUE_INVALID');
                    const inserted = row.inserted.map(message => {
                        if (!object(message) || typeof message.id !== 'string' || !message.id.length)
                            fail('PREFIX_QUEUE_INVALID');
                        return { insertSeq: event.seq, messageId: message.id };
                    });
                    // Full queue replay retains inherited entries, but only a removal and
                    // insertion in this owner's actual owned interval can select its work.
                    // An ancestor claim or an inherited pending ref grants no child rights.
                    if (row.outcome !== 'canceled' && event.seq >= request.ownerInheritedEventCount) {
                        for (const ref of queue.slice(row.start, row.start + count)) {
                            if (ref.insertSeq >= request.ownerInheritedEventCount)
                                claimed.add(refKey(ref));
                        }
                    }
                    queue.splice(row.start, count, ...inserted);
                    const ids = [...queues['next-turn'], ...queues['next-step']].map(ref => ref.messageId);
                    if (new Set(ids).size !== ids.length)
                        fail('PREFIX_QUEUE_INVALID');
                }
                else if (event.type === 'turn/start' && object(event.data) && object(event.data.nativeInputLink)) {
                    const link = event.data.nativeInputLink;
                    if (event.seq >= request.ownerInheritedEventCount && object(link.preparation)
                        && link.preparation.namespace === NAMESPACE)
                        starts.push({ seq: event.seq, link });
                }
            }
            const allWorks = [];
            for (const [rowKey, raw] of branchRows) {
                if (!rowKey.startsWith(`${ownPrefix(sid)}work-`))
                    continue;
                const work = validateWork(raw, sid);
                if (rowKey !== workKey(sid, work.refs))
                    fail('WORK_KEY_INVALID');
                const inside = work.refs.some(ref => claimed.has(refKey(ref)))
                    || starts.some(start => same(start.link.preparation, work.preparation))
                    || !!work.checkpoint && integer(work.checkpoint.startSeq) && work.checkpoint.startSeq < cut;
                allWorks.push({ key: rowKey, work, inside });
            }
            for (const start of starts) {
                const matches = allWorks.filter(({ work }) => same(work.preparation, start.link.preparation) && same(work.refs, start.link.refs));
                if (matches.length !== 1)
                    fail('PREFIX_OWNER_WORK_ORPHAN');
            }
            const selected = allWorks.filter(({ work, inside }) => inside && numerical(work));
            const preparations = new Set(), selectedRefs = new Set(), seenGenerations = new Set();
            for (const { work } of allWorks.filter(item => item.inside)) {
                if (preparations.has(work.preparationId) || seenGenerations.has(work.receiptGeneration))
                    fail('PREFIX_WORK_COLLISION');
                preparations.add(work.preparationId);
                seenGenerations.add(work.receiptGeneration);
                for (const ref of work.refs) {
                    if (selectedRefs.has(refKey(ref)))
                        fail('PREFIX_WORK_COLLISION');
                    selectedRefs.add(refKey(ref));
                }
            }
            const closed = [];
            for (const { key: rowKey, work } of selected) {
                const raw = read(deps.branch, terminalKey(sid, work.preparationId));
                if (!object(raw))
                    fail('PREFIX_NUMERICAL_UNRESOLVED');
                exact(raw, ['schemaVersion', 'encoding', 'sessionId', 'scope', 'plan', 'status', 'recordSha256'], ['settlement', 'code']);
                const { recordSha256: checksum, ...body } = raw;
                if (raw.schemaVersion !== 1 || raw.encoding !== 'roleplay-input-completion-v1' || raw.sessionId !== sid
                    || raw.status !== 'settled' || raw.code !== undefined || !hash(checksum) || checksum !== recordSha256(body)
                    || !object(raw.plan) || raw.plan.kind !== 'numerical')
                    fail('PREFIX_NUMERICAL_UNRESOLVED');
                const terminal = raw;
                if (!integer(terminal.scope?.receipt?.turnEndSeq) || terminal.scope.receipt.turnEndSeq >= cut)
                    fail('PREFIX_NUMERICAL_UNRESOLVED');
                closed.push({ key: rowKey, work, terminal });
            }
            // Terminal/state records inside the cut cannot disappear from the chain
            // merely because the original owner Work row is missing or reclassified.
            for (const [rowKey, raw] of branchRows) {
                if (!rowKey.startsWith(`${ownPrefix(sid)}terminal-`) || !object(raw) || !object(raw.plan)
                    || raw.plan.kind !== 'numerical')
                    continue;
                const scope = raw.scope;
                if (!object(scope) || !object(scope.receipt) || !integer(scope.receipt.turnEndSeq))
                    fail('TERMINAL_SCOPE_INVALID');
                if (scope.receipt.turnEndSeq < cut && !closed.some(item => terminalKey(sid, item.work.preparationId) === rowKey)) {
                    fail('PREFIX_NUMERICAL_ORPHAN');
                }
            }
            const players = [];
            for (const event of request.events) {
                if (event.type !== MVU_PLAYER_EDIT_EVENT || event.seq < request.ownerInheritedEventCount)
                    continue;
                if (!deps.verifyManualSettlementFacts)
                    fail('PREFIX_MANUAL_PROTOCOL_UNPROVEN');
                const marker = event;
                let facts;
                try {
                    assertMvuPlayerEditEvent(marker);
                    facts = readMvuPlayerOperationFacts({ branch: deps.branch, status: deps.status,
                        events: request.events, sessionId: sid, sourceSha256: request.sourceSha256,
                        marker, verifySettlementFacts: deps.verifyManualSettlementFacts });
                }
                catch (error) {
                    // Preserve the maintained protocol's explicit refusal; never fall back
                    // to the current head or treat an unproved marker as a no-op.
                    fail(error instanceof Error && /^MVU_PLAYER_[A-Z_]+$/.test(error.message)
                        ? error.message : 'PREFIX_MANUAL_UNPROVEN');
                }
                const operationKey = mvuPlayerOperationKey(sid, facts.operation.operationId);
                const completionKey = mvuPlayerCompletionKey(sid, facts.operation.operationId);
                if (!branchRows.has(operationKey) || !branchRows.has(completionKey))
                    fail('PREFIX_MANUAL_ORPHAN');
                read(deps.branch, operationKey, facts.operation);
                read(deps.branch, completionKey, facts.completion);
                if (!same(branchRows.get(operationKey), facts.operation) || !same(branchRows.get(completionKey), facts.completion)) {
                    fail('LEDGER_READBACK_CHANGED');
                }
                players.push(facts);
            }
            for (const raw of statusRows.values()) {
                if (object(raw) && object(raw.intent) && raw.intent.encoding === 'native-mvu-player-state-intent-v1') {
                    if (!object(raw.intent.marker) || !integer(raw.intent.marker.seq))
                        fail('STATE_LEDGER_INVALID');
                    if (raw.intent.marker.seq < cut && !players.some(item => same(item.intent, raw.intent))) {
                        fail('PREFIX_MANUAL_ORPHAN');
                    }
                    continue;
                }
                if (!object(raw) || !object(raw.intent) || !object(raw.intent.canonical) || !integer(raw.intent.canonical.seq)) {
                    fail('STATE_LEDGER_INVALID');
                }
                if (raw.intent.canonical.seq < cut && !closed.some(item => item.terminal.plan.kind === 'numerical'
                    && same(item.terminal.plan.intent, raw.intent)))
                    fail('PREFIX_NUMERICAL_ORPHAN');
            }
            closed.sort((a, b) => a.terminal.scope.receipt.turnEndSeq - b.terminal.scope.receipt.turnEndSeq);
            let current = structuredClone(request.genesis), previousEnd = -1;
            const steps = [];
            const mixedSteps = [];
            const timeline = [
                ...closed.map(item => ({ kind: 'story', seq: item.terminal.scope.receipt.turnEndSeq, item })),
                ...players.map(item => ({ kind: 'player', seq: item.intent.marker.seq, item })),
            ].sort((a, b) => a.seq - b.seq);
            let previousSeq = -1;
            for (const entry of timeline) {
                if (entry.seq <= previousSeq)
                    fail('PREFIX_TIMELINE_COLLISION');
                previousSeq = entry.seq;
                if (entry.kind === 'player') {
                    const { operation, completion, intent, base, settlement, result } = entry.item;
                    snapshotValid(base, sid, request.sourceSha256);
                    snapshotValid(result, sid, request.sourceSha256);
                    if (!same(base, current))
                        fail('PREFIX_CHAIN_DISCONTINUOUS');
                    const settlementKey = mvuStateSettlementKey(sid, intent.intentSha256);
                    const storedSettlement = read(deps.status, settlementKey, settlement);
                    if (!statusRows.has(settlementKey) || !same(statusRows.get(settlementKey), settlement))
                        fail('PREFIX_MANUAL_ORPHAN');
                    const step = { kind: 'player', operationId: operation.operationId,
                        marker: structuredClone(intent.marker), intentSha256: intent.intentSha256,
                        operation: { key: mvuPlayerOperationKey(sid, operation.operationId), sha256: recordSha256(operation) },
                        completion: { key: mvuPlayerCompletionKey(sid, operation.operationId), sha256: recordSha256(completion) },
                        settlement: { key: settlementKey, sha256: recordSha256(storedSettlement) },
                        baseSnapshotSha256: base.stateSnapshotSha256, resultSnapshotSha256: result.stateSnapshotSha256 };
                    if (settlement.result.event) {
                        const eventKey = mvuStateEventKey(sid, intent.intentSha256), event = read(deps.status, eventKey);
                        if (!object(event) || settlement.result.event.key !== eventKey
                            || settlement.result.event.sha256 !== event.eventSha256 || !same(statusRows.get(eventKey), event)) {
                            fail('NUMERICAL_EVENT_UNPROVEN');
                        }
                        step.event = { key: eventKey, sha256: recordSha256(event) };
                    }
                    mixedSteps.push(step);
                    current = result;
                    continue;
                }
                const item = entry.item;
                const { work, terminal } = item, scope = terminal.scope;
                if (terminal.plan.kind !== 'numerical')
                    fail('TERMINAL_PLAN_INVALID');
                const { intent, base, proposal } = terminal.plan;
                exact(terminal.plan, ['kind', 'intent', 'base', 'proposal']);
                exact(scope, ['currency', 'receipt', 'stopGeneration']);
                exact(scope.currency, ['schemaVersion', 'preparationId', 'credentialSha256', 'receiptGeneration',
                    'attemptGeneration', 'source', 'snapshot']);
                if (work.status !== 'active' || work.stop !== undefined || work.transition !== undefined || work.unclaimedRefusal !== undefined
                    || work.terminalRequired !== true || work.source.kind !== 'story' || work.source.sourceSha256 !== request.sourceSha256
                    || work.source.headRef?.kind !== 'numerical-head' || !work.checkpoint || !work.attempt?.prepared
                    || !integer(work.attemptGeneration, 1) || work.attempt.turn !== scope.receipt.checkpoint.actualTurn
                    || !same(work.checkpoint, scope.receipt.checkpoint) || !same(work.refs, scope.receipt.checkpoint.refs)
                    || !same(currency(work), scope.currency) || !integer(scope.stopGeneration)
                    || scope.receipt.turnEndSeq <= previousEnd)
                    fail('TERMINAL_OWNER_MISMATCH');
                previousEnd = scope.receipt.turnEndSeq;
                for (const [rowKey, stop] of branchRows) {
                    if (!rowKey.startsWith(`${ownPrefix(sid)}stop-`))
                        continue;
                    if (!object(stop) || !Array.isArray(stop.refs))
                        fail('PREFIX_STOP_UNPROVEN');
                    if (stop.refs.some(ref => work.refs.some(owned => same(ref, owned)))
                        || object(stop.notice) && object(stop.notice.preparation) && same(stop.notice.preparation, work.preparation))
                        fail('PREFIX_STOPPED_WORK');
                }
                snapshotValid(base, sid, request.sourceSha256);
                if (!same(base, current) || work.source.headRef.sha256 !== base.headSha256)
                    fail('PREFIX_CHAIN_DISCONTINUOUS');
                const snapshotRef = scope.currency.snapshot;
                if (!snapshotRef || snapshotRef.key !== `${sid}__task-input-snapshot-${work.preparationId}-${work.attemptGeneration}`
                    || !hash(snapshotRef.sha256) || !same(snapshotRef, work.attempt.snapshot))
                    fail('PREPARATION_SNAPSHOT_INVALID');
                const storedSnapshot = read(deps.branch, snapshotRef.key);
                if (!object(storedSnapshot) || storedSnapshot.schemaVersion !== 1 || storedSnapshot.sessionId !== sid
                    || storedSnapshot.branchId !== sid || storedSnapshot.turnId !== scope.receipt.checkpoint.actualTurn
                    || recordSha256(storedSnapshot) !== snapshotRef.sha256 || !same(storedSnapshot.numericalState, base))
                    fail('PREPARATION_SNAPSHOT_INVALID');
                const { snapshot: _ref, ...inputBasis } = scope.currency;
                if (!same(storedSnapshot.inputPreparation, inputBasis))
                    fail('PREPARATION_SNAPSHOT_INVALID');
                const phaseKey = `${sid}__phaseb-${scope.receipt.checkpoint.actualTurn}`, phase = read(deps.branch, phaseKey);
                if (!object(phase) || phase.state !== 'completed' || phase.sessionId !== sid
                    || phase.turnId !== scope.receipt.checkpoint.actualTurn || phase.assistantSeq !== intent.canonical.seq)
                    fail('PHASE_BC_UNRESOLVED');
                const canonical = deps.readProjectedCanonical(request.events, scope.receipt.checkpoint.actualTurn);
                if (!canonical)
                    fail('PREFIX_CANONICAL_UNPROVEN');
                inspect(canonical);
                // One actual selection supplies both Native version validation and the
                // deterministic parser. A second callback read must not change the body
                // between the historical receipt check and candidate reconstruction.
                const frozenCanonical = structuredClone(canonical);
                if (!verifyInheritedCompletedFact({ ownerSessionId: sid, ownerInheritedEventCount: request.ownerInheritedEventCount,
                    events: request.events, receipt: scope.receipt, canonical: intent.canonical }, { readProjectedCanonical: () => frozenCanonical, editProtocol: deps.editProtocol }))
                    fail('PREFIX_NATIVE_COMPLETION_UNPROVEN');
                const expectedProposal = prepareMvuUpdate(frozenCanonical.narrative, base.values);
                const { intentSha256, ...intentBody } = intent;
                const { schemaVersion: _schema, encoding: _encoding, sessionId: _sid, sourceSha256: _source, values: _values, ...baseIdentity } = base;
                if (expectedProposal.kind === 'rejected' || !same(expectedProposal, proposal) || !hash(intentSha256)
                    || recordSha256(intentBody) !== intentSha256 || intent.sessionId !== sid || intent.sourceSha256 !== request.sourceSha256
                    || intent.preparationId !== work.preparationId || intent.credentialSha256 !== work.credentialSha256
                    || intent.receiptGeneration !== work.receiptGeneration || intent.attemptGeneration !== work.attemptGeneration
                    || intent.stopGeneration !== scope.stopGeneration || !same(intent.preparationSnapshot, snapshotRef)
                    || intent.completedReceiptSha256 !== recordSha256(scope.receipt) || intent.refsSha256 !== recordSha256(work.refs)
                    || !same(intent.base, baseIdentity) || !same(intent.candidate, { kind: proposal.kind, candidateSha256: recordSha256(proposal) })) {
                    fail('TERMINAL_INTENT_MISMATCH');
                }
                const storedSettlementKey = mvuStateSettlementKey(sid, intent.intentSha256);
                const storedSettlement = read(deps.status, storedSettlementKey);
                if (!same(storedSettlement, terminal.settlement) || !deps.verifySettlementFacts({ intent, base, proposal, settlement: storedSettlement })) {
                    fail('NUMERICAL_SETTLEMENT_UNPROVEN');
                }
                const settlement = storedSettlement;
                const resultValues = proposal.kind === 'prepared' ? proposal.values : base.values;
                const resultBody = { schemaVersion: 1, encoding: 'native-mvu-state-snapshot-v1',
                    sessionId: sid, sourceSha256: request.sourceSha256, root: base.root, currentHead: settlement.result.head,
                    revision: settlement.result.revision, headSha256: settlement.result.headSha256,
                    values: structuredClone(resultValues), valuesSha256: settlement.result.valuesSha256 };
                const result = { ...resultBody, stateSnapshotSha256: recordSha256(resultBody) };
                snapshotValid(result, sid, request.sourceSha256);
                const step = { preparationId: work.preparationId, receiptTurnEndSeq: scope.receipt.turnEndSeq,
                    scopeSha256: recordSha256(scope), intentSha256: intent.intentSha256,
                    work: { key: item.key, sha256: recordSha256(read(deps.branch, item.key, work)) },
                    terminal: { key: terminalKey(sid, work.preparationId),
                        sha256: recordSha256(read(deps.branch, terminalKey(sid, work.preparationId), terminal)) },
                    snapshot: { key: snapshotRef.key, sha256: snapshotRef.sha256 }, phaseB: { key: phaseKey, sha256: recordSha256(phase) },
                    settlement: { key: storedSettlementKey, sha256: recordSha256(storedSettlement) },
                    baseSnapshotSha256: base.stateSnapshotSha256, resultSnapshotSha256: result.stateSnapshotSha256 };
                if (proposal.kind === 'prepared') {
                    const eventKey = mvuStateEventKey(sid, intent.intentSha256), event = read(deps.status, eventKey);
                    if (!object(event) || settlement.result.event?.key !== eventKey || settlement.result.event.sha256 !== event.eventSha256) {
                        fail('NUMERICAL_EVENT_UNPROVEN');
                    }
                    step.event = { key: eventKey, sha256: recordSha256(event) };
                }
                steps.push(step);
                mixedSteps.push({ kind: 'story', ...step });
                current = result;
            }
            if (players.length) {
                const body = { schemaVersion: 2, encoding: 'native-mvu-prefix-ledger-proof-v2',
                    ownerSessionId: sid, ownerInheritedEventCount: request.ownerInheritedEventCount, inheritedPrefixLength: cut,
                    historyPrefixSha256: recordSha256(request.events), sourceSha256: request.sourceSha256,
                    genesisSnapshotSha256: request.genesis.stateSnapshotSha256, steps: mixedSteps, numericalSnapshot: current };
                return { kind: 'ready', proof: freeze(structuredClone({ ...body, proofSha256: recordSha256(body) })) };
            }
            const body = { schemaVersion: 1, encoding: 'native-mvu-prefix-ledger-proof-v1',
                ownerSessionId: sid, ownerInheritedEventCount: request.ownerInheritedEventCount, inheritedPrefixLength: cut,
                historyPrefixSha256: recordSha256(request.events), sourceSha256: request.sourceSha256,
                genesisSnapshotSha256: request.genesis.stateSnapshotSha256, steps, numericalSnapshot: current };
            return { kind: 'ready', proof: freeze(structuredClone({ ...body, proofSha256: recordSha256(body) })) };
        }
        catch (error) {
            return { kind: 'blocked', code: error instanceof LedgerRefusal ? error.code : 'PREFIX_LEDGER_UNPROVEN' };
        }
    }
    return { capture };
}
