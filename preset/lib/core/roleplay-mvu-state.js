// Generated from runtime/alpha3/src/core/roleplay-mvu-state.ts; edit the TypeScript source.
/** Numerical authority and Source-lock publication. This module never owns a
 * Native receipt/token, input queue, model request or the genesis writer. */
import { recordSha256 } from './roleplay-data.js';
import { prepareMvuUpdate } from './roleplay-mvu-update.js';
import { cloneMvuPlayerReplacement, mvuPlayerEventFor, mvuPlayerHeadFor, mvuPlayerSettlementFor, MvuPlayerDataRefusal } from './roleplay-mvu-player-records.js';
export const mvuStateCurrentHeadKey = (sid) => `${sid}__mvu-state-current-head`;
export const mvuStateEventKey = (sid, sha256) => `${sid}__mvu-state-event-${sha256}`;
export const mvuStateSettlementKey = (sid, sha256) => `${sid}__mvu-state-settlement-${sha256}`;
export const MVU_STATE_BOUNDS = Object.freeze({ records: 4096, recordBytes: 4 * 1048576,
    descriptorDepth: 64, descriptorNodes: 96000, arrayLength: 32000 });
const MAX_RECORDS = MVU_STATE_BOUNDS.records;
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const integer = (value, min = 0) => Number.isSafeInteger(value) && Number(value) >= min;
const same = (a, b) => recordSha256(a) === recordSha256(b);
class StateRefusal extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
function fail(code) { throw new StateRefusal(code); }
/** Inspect descriptors before reading: no getters, aliases with cycles, exotic
 * prototypes or dangerous keys may enter either a hash or a table write. */
function cloneJson(input) {
    const ancestors = new Set();
    let nodes = 0, bytes = 0;
    function visit(value, depth) {
        if (++nodes > MVU_STATE_BOUNDS.descriptorNodes || depth > MVU_STATE_BOUNDS.descriptorDepth)
            fail('RECORD_LIMIT');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'string') {
            bytes += Buffer.byteLength(value, 'utf8');
            if (bytes > MVU_STATE_BOUNDS.recordBytes)
                fail('RECORD_LIMIT');
            return value;
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
                fail('RECORD_INVALID');
            return Object.is(value, -0) ? 0 : value;
        }
        if (!value || typeof value !== 'object' || ancestors.has(value))
            fail('RECORD_INVALID');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        if ((array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
            || Object.getOwnPropertySymbols(value).length)
            fail('RECORD_INVALID');
        const descriptors = Object.getOwnPropertyDescriptors(value);
        ancestors.add(value);
        const result = array ? [] : {};
        if (array) {
            const length = descriptors.length?.value;
            if (!integer(length) || length > MVU_STATE_BOUNDS.arrayLength
                || Object.keys(descriptors).length !== length + 1)
                fail('RECORD_INVALID');
            for (let i = 0; i < length; i++) {
                const descriptor = descriptors[String(i)];
                if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
                    fail('RECORD_INVALID');
                result.push(visit(descriptor.value, depth + 1));
            }
        }
        else
            for (const [key, descriptor] of Object.entries(descriptors)) {
                if (['__proto__', 'prototype', 'constructor'].includes(key) || !Object.hasOwn(descriptor, 'value')
                    || !descriptor.enumerable)
                    fail('RECORD_INVALID');
                bytes += Buffer.byteLength(key, 'utf8');
                if (bytes > MVU_STATE_BOUNDS.recordBytes)
                    fail('RECORD_LIMIT');
                result[key] = visit(descriptor.value, depth + 1);
            }
        ancestors.delete(value);
        return result;
    }
    return visit(input, 0);
}
function keys(value, expected) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || !same(Object.keys(value).sort(), [...expected].sort()))
        fail('RECORD_INVALID');
}
function rootValid(root) {
    if ('encoding' in root) {
        keys(root, ['schemaVersion', 'encoding', 'derivedEventId', 'derivedEventSha256', 'derivedHeadSha256', 'basisSha256']);
        if (root.schemaVersion !== 1 || root.encoding !== 'native-mvu-derived-state-root-v1'
            || ![root.derivedEventId, root.derivedEventSha256, root.derivedHeadSha256, root.basisSha256].every(hash))
            fail('ROOT_INVALID');
    }
    else {
        keys(root, ['initEventId', 'initEventSha256', 'initHeadSha256', 'planSha256']);
        if (!Object.values(root).every(hash))
            fail('ROOT_INVALID');
    }
}
function headValid(head, sid, source, root) {
    if (head.encoding === 'mvu-programmatic-opening-head-v1') {
        if ('encoding' in root)
            fail('HEAD_INVALID');
        keys(head, ['schemaVersion', 'encoding', 'sessionId', 'eventId', 'revision', 'eventSha256', 'planSha256', 'valuesSha256']);
        if (head.schemaVersion !== 1 || head.revision !== 1 || head.sessionId !== sid
            || head.eventId !== root.initEventId || head.eventSha256 !== root.initEventSha256
            || head.planSha256 !== root.planSha256 || !hash(head.valuesSha256)
            || recordSha256(head) !== root.initHeadSha256)
            fail('HEAD_INVALID');
    }
    else if (head.encoding === 'native-mvu-derived-genesis-head-v1') {
        if (!('encoding' in root))
            fail('HEAD_INVALID');
        keys(head, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'revision',
            'eventId', 'eventSha256', 'basisSha256', 'valuesSha256']);
        if (head.schemaVersion !== 1 || head.revision !== 1 || head.sessionId !== sid || head.sourceSha256 !== source
            || head.eventId !== root.derivedEventId || head.eventSha256 !== root.derivedEventSha256
            || head.basisSha256 !== root.basisSha256 || !hash(head.valuesSha256)
            || recordSha256(head) !== root.derivedHeadSha256)
            fail('HEAD_INVALID');
    }
    else {
        const player = head.encoding === 'native-mvu-state-current-head-v2';
        keys(head, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'root', 'revision',
            'eventId', 'eventSha256', 'valuesSha256', 'intentSha256', ...(player ? ['provenance'] : [])]);
        if (!(player ? head.schemaVersion === 2 && head.provenance === 'player'
            : head.encoding === 'native-mvu-state-current-head-v1' && head.schemaVersion === 1)
            || head.sessionId !== sid || head.sourceSha256 !== source || !same(head.root, root)
            || !integer(head.revision, 2) || head.revision > MAX_RECORDS + 1
            || head.eventId !== head.intentSha256 || ![head.eventId, head.eventSha256, head.valuesSha256].every(hash))
            fail('HEAD_INVALID');
    }
}
function baseValid(base, sid, source) {
    keys(base, ['root', 'currentHead', 'revision', 'headSha256', 'valuesSha256', 'stateSnapshotSha256']);
    rootValid(base.root);
    headValid(base.currentHead, sid, source, base.root);
    if (base.revision !== base.currentHead.revision || base.valuesSha256 !== base.currentHead.valuesSha256
        || base.headSha256 !== recordSha256(base.currentHead) || !hash(base.stateSnapshotSha256))
        fail('BASE_INVALID');
}
function intentValid(intent) {
    keys(intent, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'preparationId', 'credentialSha256',
        'refsSha256', 'receiptGeneration', 'attemptGeneration', 'stopGeneration', 'preparationSnapshot',
        'completedReceiptSha256', 'canonical', 'base', 'candidate', 'intentSha256']);
    keys(intent.preparationSnapshot, ['key', 'sha256']);
    keys(intent.canonical, ['seq', 'messageId', 'versionSha256', 'narrativeSha256']);
    keys(intent.candidate, ['kind', 'candidateSha256']);
    if (intent.schemaVersion !== 1 || intent.encoding !== 'native-mvu-state-terminal-intent-v1'
        || !id(intent.sessionId) || !id(intent.preparationId) || !id(intent.canonical.messageId)
        || typeof intent.preparationSnapshot.key !== 'string' || !/^[a-zA-Z0-9_-]{1,512}$/.test(intent.preparationSnapshot.key)
        || ![intent.sourceSha256, intent.credentialSha256, intent.refsSha256, intent.preparationSnapshot.sha256,
            intent.completedReceiptSha256, intent.canonical.versionSha256, intent.canonical.narrativeSha256,
            intent.candidate.candidateSha256, intent.intentSha256].every(hash)
        || !integer(intent.receiptGeneration, 1) || !integer(intent.attemptGeneration, 1)
        || !integer(intent.stopGeneration) || !integer(intent.canonical.seq)
        || !['prepared', 'no-update'].includes(intent.candidate.kind))
        fail('INTENT_INVALID');
    baseValid(intent.base, intent.sessionId, intent.sourceSha256);
    const { intentSha256, ...descriptor } = intent;
    if (recordSha256(descriptor) !== intentSha256)
        fail('INTENT_INVALID');
}
function manualIntentValid(intent) {
    keys(intent, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'operationId', 'requestSha256',
        'operation', 'marker', 'base', 'replacement', 'intentSha256']);
    keys(intent.operation, ['key', 'sha256']);
    keys(intent.marker, ['seq', 'sha256']);
    if (intent.schemaVersion !== 1 || intent.encoding !== 'native-mvu-player-state-intent-v1'
        || !id(intent.sessionId) || !id(intent.operationId) || typeof intent.operation.key !== 'string'
        || !/^[a-zA-Z0-9_-]{1,512}$/.test(intent.operation.key) || !integer(intent.marker.seq)
        || ![intent.sourceSha256, intent.requestSha256, intent.operation.sha256, intent.marker.sha256, intent.intentSha256].every(hash)) {
        fail('MANUAL_INTENT_INVALID');
    }
    baseValid(intent.base, intent.sessionId, intent.sourceSha256);
    const replacement = cloneMvuPlayerReplacement(intent.replacement);
    if (!same(replacement, intent.replacement))
        fail('MANUAL_REPLACEMENT_INVALID');
    const { intentSha256, ...descriptor } = intent;
    if (recordSha256(descriptor) !== intentSha256)
        fail('MANUAL_INTENT_INVALID');
}
function snapshot(head, values, sid, sourceSha256, root) {
    const descriptor = { schemaVersion: 1, encoding: 'native-mvu-state-snapshot-v1',
        sessionId: sid, sourceSha256, root, currentHead: head, revision: head.revision,
        headSha256: recordSha256(head), values, valuesSha256: recordSha256(values) };
    return { ...descriptor, stateSnapshotSha256: recordSha256(descriptor) };
}
function baseOf(state) {
    return { root: state.root, currentHead: state.currentHead, revision: state.revision,
        headSha256: state.headSha256, valuesSha256: state.valuesSha256, stateSnapshotSha256: state.stateSnapshotSha256 };
}
function candidateValid(candidate, state, intent) {
    if (candidate.kind === 'no-update')
        keys(candidate, ['kind']);
    else {
        keys(candidate, ['kind', 'schemaVersion', 'protocol', 'operations', 'baseValuesSha256',
            'values', 'valuesSha256', 'proposalSha256']);
        // Re-encoding data must not turn a decoded JSON string into protocol markup.
        const json = JSON.stringify(candidate.operations)?.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
        const result = prepareMvuUpdate(`<UpdateVariable><JSONPatch>${json}</JSONPatch></UpdateVariable>`, state.values);
        if (result.kind !== 'prepared' || !same(candidate, result))
            fail('CANDIDATE_INVALID');
    }
    if (candidate.kind !== intent.candidate.kind || recordSha256(candidate) !== intent.candidate.candidateSha256)
        fail('CANDIDATE_INVALID');
}
function eventFor(intent, proposal) {
    const descriptor = { schemaVersion: 1, encoding: 'native-mvu-state-update-event-v1',
        sessionId: intent.sessionId, sourceSha256: intent.sourceSha256, root: intent.base.root,
        eventId: intent.intentSha256, revision: intent.base.revision + 1, intent, proposal, valuesSha256: proposal.valuesSha256 };
    return { ...descriptor, eventSha256: recordSha256(descriptor) };
}
function headFor(event) {
    return { schemaVersion: 1, encoding: 'native-mvu-state-current-head-v1', sessionId: event.sessionId,
        sourceSha256: event.sourceSha256, root: event.root, revision: event.revision,
        eventId: event.eventId, eventSha256: event.eventSha256, valuesSha256: event.valuesSha256,
        intentSha256: event.intent.intentSha256 };
}
function settlementFor(intent, candidate, head, event) {
    const result = { head, headSha256: recordSha256(head),
        revision: head.revision, valuesSha256: head.valuesSha256 };
    if (event)
        result.event = { key: mvuStateEventKey(intent.sessionId, event.eventId), sha256: event.eventSha256 };
    const descriptor = { schemaVersion: 1, encoding: 'native-mvu-state-publisher-settlement-v1',
        sessionId: intent.sessionId, sourceSha256: intent.sourceSha256, intent, candidate,
        outcome: event ? 'updated' : 'no-update', result,
        completedReceiptSha256: intent.completedReceiptSha256 };
    return { ...descriptor, settlementSha256: recordSha256(descriptor) };
}
export function createRoleplayMvuState(deps) {
    function unedited(sid) {
        if (!deps.readEditInvalidation)
            return;
        const gate = deps.readEditInvalidation(sid);
        if (!gate || !['clear', 'invalidated', 'unknown'].includes(gate.kind))
            fail('NUMERICAL_EDIT_UNKNOWN');
        if (gate.kind !== 'clear')
            fail(typeof gate.code === 'string' ? gate.code : 'NUMERICAL_EDIT_UNKNOWN');
    }
    function verified(intent) {
        if (!deps.verifyStoredIntent(cloneJson(intent)))
            fail('STORED_INTENT_UNPROVEN');
    }
    function verifiedManual(intent) {
        if (!deps.verifyStoredManualIntent?.(cloneJson(intent)))
            fail('MANUAL_STORED_INTENT_UNPROVEN');
    }
    function manualGate(sid, allowedIntent) {
        const code = deps.manualGate?.(sid, allowedIntent && cloneJson(allowedIntent));
        if (code !== undefined)
            fail(typeof code === 'string' && code ? code : 'MANUAL_GATE_UNKNOWN');
    }
    function genesis(sid) {
        if (!id(sid))
            fail('SESSION_INVALID');
        const supplied = deps.readGenesis(sid);
        if (!supplied)
            fail('GENESIS_UNPROVEN');
        const g = cloneJson(supplied);
        if ('derivedEvent' in g) {
            keys(g, ['sessionId', 'sourceSha256', 'derivedEvent', 'derivedHead']);
            const event = g.derivedEvent, head = g.derivedHead;
            keys(event, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'revision',
                'eventId', 'eventSha256', 'basisSha256', 'values', 'valuesSha256']);
            const { eventSha256, ...descriptor } = event;
            if (g.sessionId !== sid || !hash(g.sourceSha256) || event.schemaVersion !== 1
                || event.encoding !== 'native-mvu-derived-genesis-event-v1' || event.revision !== 1
                || event.sessionId !== sid || event.sourceSha256 !== g.sourceSha256
                || ![event.eventId, eventSha256, event.basisSha256, event.valuesSha256].every(hash)
                || !event.values || typeof event.values !== 'object' || Array.isArray(event.values)
                || event.valuesSha256 !== recordSha256(event.values) || eventSha256 !== recordSha256(descriptor))
                fail('GENESIS_INVALID');
            const root = { schemaVersion: 1, encoding: 'native-mvu-derived-state-root-v1',
                derivedEventId: event.eventId, derivedEventSha256: eventSha256,
                derivedHeadSha256: recordSha256(head), basisSha256: event.basisSha256 };
            rootValid(root);
            headValid(head, sid, g.sourceSha256, root);
            if (head.valuesSha256 !== event.valuesSha256)
                fail('GENESIS_INVALID');
            return { genesis: g, state: snapshot(head, event.values, sid, g.sourceSha256, root) };
        }
        const event = g.initEvent, head = g.initHead;
        const { eventSha256, ...eventDescriptor } = event;
        const { planSha256, ...planDescriptor } = event.plan;
        if (g.sessionId !== sid || !hash(g.sourceSha256) || event.schemaVersion !== 1
            || event.encoding !== 'mvu-programmatic-opening-event-v1' || event.revision !== 1
            || event.plan.identity.sessionId !== sid || recordSha256(eventDescriptor) !== eventSha256
            || recordSha256(planDescriptor) !== planSha256 || event.valuesSha256 !== recordSha256(event.plan.values)
            || event.plan.valuesSha256 !== event.valuesSha256)
            fail('GENESIS_INVALID');
        const root = { initEventId: event.eventId, initEventSha256: eventSha256,
            initHeadSha256: recordSha256(head), planSha256 };
        rootValid(root);
        headValid(head, sid, g.sourceSha256, root);
        if (head.valuesSha256 !== event.valuesSha256)
            fail('GENESIS_INVALID');
        return { genesis: g, state: snapshot(head, event.plan.values, sid, g.sourceSha256, root) };
    }
    function scan(sid) {
        const rows = new Map(), prefix = `${sid}__mvu-state-`;
        for (const [key, value] of deps.table.entries())
            if (key.startsWith(prefix)) {
                if (rows.size >= MAX_RECORDS || rows.has(key))
                    fail('RECORD_LIMIT');
                if (value === undefined)
                    fail('RECORD_INVALID');
                const actual = deps.table.get(key);
                if (actual === undefined || !same(cloneJson(value), cloneJson(actual)))
                    fail('READ_UNCERTAIN');
                rows.set(key, cloneJson(actual));
            }
        // Require enumerated ownership: a missing enumeration cannot hide a pointer.
        const current = deps.table.get(mvuStateCurrentHeadKey(sid));
        if ((current !== undefined) !== rows.has(mvuStateCurrentHeadKey(sid)))
            fail('READ_UNCERTAIN');
        return rows;
    }
    function inspect(sid, allowedIntent) {
        unedited(sid);
        manualGate(sid, allowedIntent);
        const initial = genesis(sid).state, rows = scan(sid), consumed = new Set();
        const settlements = new Map();
        const chain = [], seen = new Set();
        const currentKey = mvuStateCurrentHeadKey(sid);
        let head = rows.get(currentKey);
        if (head)
            consumed.add(currentKey);
        else
            head = initial.currentHead;
        const target = head;
        while (head.revision !== 1) {
            headValid(head, sid, initial.sourceSha256, initial.root);
            if ((head.encoding !== 'native-mvu-state-current-head-v1' && head.encoding !== 'native-mvu-state-current-head-v2')
                || seen.has(head.eventId))
                fail('CHAIN_INVALID');
            seen.add(head.eventId);
            const eventKey = mvuStateEventKey(sid, head.eventId);
            const event = rows.get(eventKey);
            if (!event)
                fail('EVENT_MISSING');
            if (event.encoding === 'native-mvu-player-state-update-event-v1') {
                manualIntentValid(event.intent);
                verifiedManual(event.intent);
                if (!same(event, mvuPlayerEventFor(event.intent)) || !same(head, mvuPlayerHeadFor(event)))
                    fail('EVENT_INVALID');
            }
            else {
                if (event.encoding !== 'native-mvu-state-update-event-v1')
                    fail('EVENT_INVALID');
                intentValid(event.intent);
                verified(event.intent);
                if (!same(event, eventFor(event.intent, event.proposal)) || !same(head, headFor(event)))
                    fail('EVENT_INVALID');
            }
            if (event.intent.sessionId !== sid || event.intent.sourceSha256 !== initial.sourceSha256
                || !same(event.root, initial.root))
                fail('EVENT_INVALID');
            consumed.add(eventKey);
            chain.push(event);
            head = event.intent.base.currentHead;
            if (chain.length > MAX_RECORDS)
                fail('CHAIN_INVALID');
        }
        if (!same(head, initial.currentHead))
            fail('ROOT_INVALID');
        let state = initial;
        const states = new Map([[state.headSha256, state]]);
        for (const event of chain.reverse()) {
            if (!same(event.intent.base, baseOf(state)))
                fail('BASE_INVALID');
            let expected, next;
            if (event.encoding === 'native-mvu-player-state-update-event-v1') {
                if (same(event.replacement.values, state.values))
                    fail('MANUAL_EVENT_NO_CHANGE');
                const head = mvuPlayerHeadFor(event);
                expected = mvuPlayerSettlementFor(event.intent, head, { key: mvuStateEventKey(sid, event.eventId), sha256: event.eventSha256 });
                next = snapshot(head, event.replacement.values, sid, initial.sourceSha256, initial.root);
            }
            else {
                candidateValid(event.proposal, state, event.intent);
                expected = settlementFor(event.intent, event.proposal, headFor(event), event);
                next = snapshot(headFor(event), event.proposal.values, sid, initial.sourceSha256, initial.root);
            }
            const key = mvuStateSettlementKey(sid, event.eventId), actual = rows.get(key);
            if (!actual || !same(actual, expected))
                fail('SETTLEMENT_MISSING_OR_INVALID');
            consumed.add(key);
            settlements.set(event.eventId, expected);
            state = next;
            states.set(state.headSha256, state);
        }
        if (!same(state.currentHead, target))
            fail('HEAD_INVALID');
        for (const [key, raw] of rows)
            if (!consumed.has(key)) {
                const item = raw;
                if (!key.startsWith(`${sid}__mvu-state-settlement-`))
                    fail('OWNED_PARTIAL_OR_ORPHAN');
                const player = item.encoding === 'native-mvu-player-state-publisher-settlement-v1';
                if (player) {
                    if (item.outcome !== 'no-update')
                        fail('OWNED_PARTIAL_OR_ORPHAN');
                    manualIntentValid(item.intent);
                    verifiedManual(item.intent);
                }
                else {
                    if (item.encoding !== 'native-mvu-state-publisher-settlement-v1' || item.candidate?.kind !== 'no-update') {
                        fail('OWNED_PARTIAL_OR_ORPHAN');
                    }
                    intentValid(item.intent);
                    verified(item.intent);
                }
                const base = states.get(item.intent.base.headSha256);
                if (!base || !same(item.intent.base, baseOf(base)) || item.intent.sessionId !== sid
                    || item.intent.sourceSha256 !== initial.sourceSha256)
                    fail('BASE_INVALID');
                let expected;
                if (player) {
                    if (!same(item.replacement.values, base.values))
                        fail('MANUAL_NO_UPDATE_INVALID');
                    expected = mvuPlayerSettlementFor(item.intent, base.currentHead);
                }
                else {
                    candidateValid(item.candidate, base, item.intent);
                    expected = settlementFor(item.intent, item.candidate, base.currentHead);
                }
                if (key !== mvuStateSettlementKey(sid, item.intent.intentSha256) || !same(item, expected))
                    fail('SETTLEMENT_INVALID');
                consumed.add(key);
                settlements.set(item.intent.intentSha256, expected);
            }
        return { state, settlements };
    }
    const codeOf = (error) => error instanceof StateRefusal || error instanceof MvuPlayerDataRefusal
        ? error.code : 'READ_OR_PERMISSION_UNKNOWN';
    function readNumericalAuthority(sid) {
        try {
            return { kind: 'ready', snapshot: cloneJson(inspect(sid).state) };
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    function reconcileFacts(input) {
        try {
            const intent = cloneJson(input);
            intentValid(intent);
            unedited(intent.sessionId);
            verified(intent);
            const { state, settlements } = inspect(intent.sessionId);
            if (state.sourceSha256 !== intent.sourceSha256 || !same(state.root, intent.base.root))
                fail('SOURCE_CHANGED');
            const settlement = settlements.get(intent.intentSha256);
            if (!settlement)
                return { kind: 'absent', code: 'SETTLEMENT_ABSENT' };
            if (settlement.encoding !== 'native-mvu-state-publisher-settlement-v1' || !same(settlement.intent, intent))
                fail('INTENT_CONFLICT');
            return { kind: 'committed', settlement: cloneJson(settlement) };
        }
        catch (error) {
            return { kind: 'unknown', code: codeOf(error) };
        }
    }
    function permitted(token, intent, phase) {
        unedited(intent.sessionId);
        manualGate(intent.sessionId);
        verified(intent);
        const current = genesis(intent.sessionId).state;
        if (current.sourceSha256 !== intent.sourceSha256 || !same(current.root, intent.base.root))
            fail('SOURCE_CHANGED');
        if (!deps.checkPermission(token, cloneJson(intent), phase))
            fail('PERMISSION_REVOKED');
    }
    /** A terminal owner's already-confirmed immutable result is a historical
     * consumption fact. A later import must not force it through the current
     * genesis/Source reader, nor can this method mint permission or continue a
     * partial publication. The current authority reader remains strict. */
    /** Immutable numerical facts only. The prefix consumer separately verifies
     * Native/owner lineage; this method creates no token or continuation rights. */
    function verifyConsumedSettlementFacts(input) {
        try {
            const intent = cloneJson(input.intent), base = cloneJson(input.base), proposal = cloneJson(input.proposal);
            intentValid(intent);
            if (proposal.kind === 'rejected' || !same(base, snapshot(base.currentHead, base.values, base.sessionId, base.sourceSha256, base.root))
                || !same(intent.base, baseOf(base)) || base.sessionId !== intent.sessionId || base.sourceSha256 !== intent.sourceSha256)
                return false;
            candidateValid(proposal, base, intent);
            const event = proposal.kind === 'prepared' ? eventFor(intent, proposal) : undefined;
            const expected = settlementFor(intent, proposal, event ? headFor(event) : base.currentHead, event);
            return same(cloneJson(input.settlement), expected)
                && same(cloneJson(deps.table.get(mvuStateSettlementKey(intent.sessionId, intent.intentSha256))), expected)
                && (!event || same(cloneJson(deps.table.get(mvuStateEventKey(intent.sessionId, event.eventId))), event));
        }
        catch {
            return false;
        }
    }
    function verifyConsumedSettlement(input) {
        try {
            const intent = cloneJson(input.intent);
            intentValid(intent);
            verified(intent);
            return verifyConsumedSettlementFacts(input);
        }
        catch {
            return false;
        }
    }
    function manualFacts(input, allowedIntent) {
        try {
            const intent = cloneJson(input);
            manualIntentValid(intent);
            verifiedManual(intent);
            const { state, settlements } = inspect(intent.sessionId, allowedIntent);
            if (state.sourceSha256 !== intent.sourceSha256 || !same(state.root, intent.base.root))
                fail('SOURCE_CHANGED');
            const settlement = settlements.get(intent.intentSha256);
            if (!settlement)
                return { kind: 'absent', code: 'SETTLEMENT_ABSENT' };
            if (settlement.encoding !== 'native-mvu-player-state-publisher-settlement-v1' || !same(settlement.intent, intent)) {
                fail('MANUAL_INTENT_CONFLICT');
            }
            return { kind: 'committed', settlement: cloneJson(settlement) };
        }
        catch (error) {
            return { kind: 'unknown', code: codeOf(error) };
        }
    }
    function reconcileManualFacts(intent) { return manualFacts(intent); }
    /** Historical exact numerical descriptors only. The prefix/coordinator owns
     * independent validation of the original operation and actual Native marker.
     * Today's Source/head/gate and hot publication rights are never consulted. */
    function verifyConsumedManualSettlementFacts(input) {
        try {
            const intent = cloneJson(input.intent), base = cloneJson(input.base);
            const replacement = cloneMvuPlayerReplacement(input.replacement);
            manualIntentValid(intent);
            if (!same(base, snapshot(base.currentHead, base.values, base.sessionId, base.sourceSha256, base.root))
                || !same(intent.base, baseOf(base)) || !same(intent.replacement, replacement)
                || base.sessionId !== intent.sessionId || base.sourceSha256 !== intent.sourceSha256)
                return false;
            const event = same(replacement.values, base.values) ? undefined : mvuPlayerEventFor(intent);
            const expected = mvuPlayerSettlementFor(intent, event ? mvuPlayerHeadFor(event) : base.currentHead, event ? { key: mvuStateEventKey(intent.sessionId, event.eventId), sha256: event.eventSha256 } : undefined);
            return same(cloneJson(input.settlement), expected)
                && same(cloneJson(deps.table.get(mvuStateSettlementKey(intent.sessionId, intent.intentSha256))), expected)
                && (event ? same(cloneJson(deps.table.get(mvuStateEventKey(intent.sessionId, event.eventId))), event)
                    : deps.table.get(mvuStateEventKey(intent.sessionId, intent.intentSha256)) === undefined);
        }
        catch {
            return false;
        }
    }
    function permittedManual(token, intent, phase) {
        unedited(intent.sessionId);
        verifiedManual(intent);
        const current = genesis(intent.sessionId).state;
        if (current.sourceSha256 !== intent.sourceSha256 || !same(current.root, intent.base.root))
            fail('SOURCE_CHANGED');
        if (!deps.checkManualPermission?.(token, cloneJson(intent), phase))
            fail('MANUAL_PERMISSION_REVOKED');
        manualGate(intent.sessionId, intent);
    }
    /** Exact verified revision-one basis, independent of later state rows. */
    function readGenesisAuthority(sid) {
        try {
            return { kind: 'ready', snapshot: cloneJson(genesis(sid).state) };
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    /** A lost put response is classified by exact immediate readback. Never retry
     * inside this invocation; a durable partial also blocks every later invocation.
     * An entirely absent write leaves the terminal owner responsible for revoking
     * the one-shot hot permission, independently of this numerical reader. */
    async function putExact(key, value) {
        let failed = false;
        try {
            await deps.table.put(key, cloneJson(value));
        }
        catch {
            failed = true;
        }
        const actual = deps.table.get(key);
        if (actual === undefined)
            fail(failed ? 'WRITE_ABSENT' : 'WRITE_UNCONFIRMED');
        if (!same(cloneJson(actual), value))
            fail('WRITE_CONFLICT');
    }
    async function publish(input) {
        const token = input.token;
        let intent, base, candidate;
        try {
            intent = cloneJson(input.intent);
            base = cloneJson(input.base);
            intentValid(intent);
            const proposal = cloneJson(input.proposal);
            if (!proposal || proposal.kind === 'rejected')
                fail('CANDIDATE_REJECTED');
            candidate = proposal;
            if (!same(base, snapshot(base.currentHead, base.values, base.sessionId, base.sourceSha256, base.root))
                || base.sessionId !== intent.sessionId || base.sourceSha256 !== intent.sourceSha256
                || !same(baseOf(base), intent.base))
                fail('BASE_INVALID');
            if (!token || typeof token !== 'object')
                fail('PERMISSION_REVOKED');
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
        let wrote = false;
        try {
            return await deps.withSourceLock(intent.sessionId, async () => {
                permitted(token, intent, 'before-write');
                const facts = reconcileFacts(intent);
                if (facts.kind === 'committed') {
                    if (!same(facts.settlement.candidate, candidate))
                        fail('CANDIDATE_INVALID');
                    permitted(token, intent, 'after-settlement');
                    return { kind: 'acknowledged', settlement: facts.settlement };
                }
                // A partial event/head cannot be promoted by hot retry or cold readback.
                if (facts.kind === 'unknown')
                    return { kind: 'unknown', code: facts.code };
                const actual = inspect(intent.sessionId).state;
                if (!same(actual, base))
                    fail('BASE_CHANGED');
                candidateValid(candidate, actual, intent);
                const event = candidate.kind === 'prepared' ? eventFor(intent, candidate) : undefined;
                const head = event ? headFor(event) : actual.currentHead;
                const settlement = settlementFor(intent, candidate, head, event);
                if (event) {
                    permitted(token, intent, 'before-write');
                    wrote = true;
                    await putExact(mvuStateEventKey(intent.sessionId, event.eventId), event);
                    permitted(token, intent, 'before-head');
                    // Recheck the original pointer only; inspect would rightly block our
                    // incomplete event until settlement. No broad partial exemption exists.
                    const pointer = deps.table.get(mvuStateCurrentHeadKey(intent.sessionId));
                    if (!same(pointer ?? genesis(intent.sessionId).state.currentHead, actual.currentHead))
                        fail('BASE_CHANGED');
                    await putExact(mvuStateCurrentHeadKey(intent.sessionId), head);
                    permitted(token, intent, 'after-head');
                }
                permitted(token, intent, 'after-head');
                wrote = true;
                await putExact(mvuStateSettlementKey(intent.sessionId, intent.intentSha256), settlement);
                permitted(token, intent, 'after-settlement');
                const completed = reconcileFacts(intent);
                if (completed.kind !== 'committed' || !same(completed.settlement, settlement))
                    fail('SETTLEMENT_UNCONFIRMED');
                return { kind: 'acknowledged', settlement: completed.settlement };
            });
        }
        catch (error) {
            // Retain complete facts when a late cancellation follows an already
            // issued settlement, but never turn those facts back into hot authority.
            const facts = reconcileFacts(intent);
            if (facts.kind === 'committed')
                return { kind: 'unknown', code: codeOf(error), settlement: facts.settlement };
            return { kind: wrote ? 'unknown' : 'blocked', code: codeOf(error) };
        }
    }
    /** The actual coordinator must already hold this session's Source lock. Its
     * private lease affirms that fact in checkManualPermission at every boundary.
     * Do not re-enter withSourceLock or accept an HTTP-supplied exemption/token. */
    async function publishManual(input) {
        let intent, base, replacement;
        const token = input.token;
        try {
            intent = cloneJson(input.intent);
            base = cloneJson(input.base);
            replacement = cloneMvuPlayerReplacement(input.replacement);
            manualIntentValid(intent);
            if (!same(base, snapshot(base.currentHead, base.values, base.sessionId, base.sourceSha256, base.root))
                || base.sessionId !== intent.sessionId || base.sourceSha256 !== intent.sourceSha256
                || !same(intent.base, baseOf(base)) || !same(intent.replacement, replacement))
                fail('BASE_INVALID');
            if (!token || typeof token !== 'object')
                fail('MANUAL_PERMISSION_REVOKED');
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
        let wrote = false, settlement;
        try {
            permittedManual(token, intent, 'before-write');
            const facts = manualFacts(intent, intent);
            if (facts.kind === 'committed') {
                permittedManual(token, intent, 'after-settlement');
                return { kind: 'acknowledged', settlement: facts.settlement };
            }
            if (facts.kind === 'unknown')
                return { kind: 'unknown', code: facts.code };
            const actual = inspect(intent.sessionId, intent).state;
            if (!same(actual, base))
                fail('BASE_CHANGED');
            const event = same(replacement.values, actual.values) ? undefined : mvuPlayerEventFor(intent);
            const head = event ? mvuPlayerHeadFor(event) : actual.currentHead;
            settlement = mvuPlayerSettlementFor(intent, head, event ? { key: mvuStateEventKey(intent.sessionId, event.eventId), sha256: event.eventSha256 } : undefined);
            if (event) {
                permittedManual(token, intent, 'before-write');
                wrote = true;
                await putExact(mvuStateEventKey(intent.sessionId, event.eventId), event);
                permittedManual(token, intent, 'before-head');
                const pointer = deps.table.get(mvuStateCurrentHeadKey(intent.sessionId));
                if (!same(pointer ?? genesis(intent.sessionId).state.currentHead, actual.currentHead))
                    fail('BASE_CHANGED');
                await putExact(mvuStateCurrentHeadKey(intent.sessionId), head);
                permittedManual(token, intent, 'after-head');
            }
            permittedManual(token, intent, 'after-head');
            wrote = true;
            await putExact(mvuStateSettlementKey(intent.sessionId, intent.intentSha256), settlement);
            permittedManual(token, intent, 'after-settlement');
            const completed = manualFacts(intent, intent);
            if (completed.kind !== 'committed' || !same(completed.settlement, settlement))
                fail('SETTLEMENT_UNCONFIRMED');
            return { kind: 'acknowledged', settlement: completed.settlement };
        }
        catch (error) {
            if (settlement && verifyConsumedManualSettlementFacts({ intent, base, replacement, settlement })) {
                return { kind: 'unknown', code: codeOf(error), settlement: cloneJson(settlement) };
            }
            return { kind: wrote ? 'unknown' : 'blocked', code: codeOf(error) };
        }
    }
    return { readNumericalAuthority, readGenesisAuthority, publish, reconcileFacts,
        verifyConsumedSettlement, verifyConsumedSettlementFacts, publishManual, reconcileManualFacts, verifyConsumedManualSettlementFacts };
}
