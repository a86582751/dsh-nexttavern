// Generated from runtime/alpha3/compat/session-format/src/mvu-schema-marker.ts; edit the TypeScript source.
export const MVU_SCHEMA_DISPATCH_EVENT = 'roleplay/mvu-schema-dispatched';
export const MVU_SCHEMA_COMPLETION_EVENT = 'roleplay/mvu-schema-completed';
/** Reserved execution vocabulary cannot opt into the upstream unknown-event
 * skip contract; dropping such a row could erase a pending execution anchor. */
export function assertMvuSchemaEventVocabulary(type) {
    if (typeof type === 'string' && type.startsWith('roleplay/mvu-schema-')
        && type !== MVU_SCHEMA_DISPATCH_EVENT && type !== MVU_SCHEMA_COMPLETION_EVENT) {
        throw Error('MVU_SCHEMA_EVENT_UNKNOWN');
    }
}
const commonKeys = ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'batchId',
    'dispatchRecordSha256', 'observedNativeSeq'];
const dispatchKeys = [...commonKeys, 'programSha256', 'sourceSha256', 'previousTailSha256', 'loadDescriptorSha256'];
const completionKeys = [...commonKeys, 'dispatchSeq', 'completionRecordSha256', 'completedTailSha256'];
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const identity = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const integer = (value, minimum = 0) => typeof value === 'number'
    && Number.isSafeInteger(value) && value >= minimum && !Object.is(value, -0);
function exactData(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
        || Object.getOwnPropertySymbols(value).length)
        throw Error('MVU_SCHEMA_MARKER_INVALID');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.keys(descriptors).length !== keys.length || keys.some(key => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) {
        throw Error('MVU_SCHEMA_MARKER_INVALID');
    }
}
export function assertMvuSchemaDispatchMarker(value) {
    exactData(value, dispatchKeys);
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-dispatch-marker-v1'
        || !identity(value.sessionId) || !identity(value.batchId) || !integer(value.observedNativeSeq, -1)
        || ![value.realmEpoch, value.programSha256, value.sourceSha256, value.previousTailSha256,
            value.dispatchRecordSha256].every(hash)
        || value.loadDescriptorSha256 !== null && !hash(value.loadDescriptorSha256))
        throw Error('MVU_SCHEMA_MARKER_INVALID');
}
export function assertMvuSchemaCompletionMarker(value) {
    exactData(value, completionKeys);
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-completion-marker-v1'
        || !identity(value.sessionId) || !identity(value.batchId) || !integer(value.observedNativeSeq, -1)
        || !integer(value.dispatchSeq) || ![value.realmEpoch, value.dispatchRecordSha256,
        value.completionRecordSha256, value.completedTailSha256].every(hash))
        throw Error('MVU_SCHEMA_MARKER_INVALID');
}
export function assertMvuSchemaMarker(value) {
    // Inspect the encoding descriptor without invoking an untrusted getter.
    const encoding = value && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'encoding') : undefined;
    if (encoding && 'value' in encoding && encoding.value === 'native-mvu-schema-dispatch-marker-v1') {
        assertMvuSchemaDispatchMarker(value);
    }
    else
        assertMvuSchemaCompletionMarker(value);
}
export function assertMvuSchemaMarkerEvent(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(event))
        || Object.getOwnPropertySymbols(event).length
        || Object.keys(Object.getOwnPropertyDescriptors(event)).some(key => !['type', 'seq', 'time', 'data'].includes(key))) {
        throw Error('MVU_SCHEMA_MARKER_ENVELOPE_INVALID');
    }
    const descriptors = Object.getOwnPropertyDescriptors(event);
    if (['type', 'seq', 'time', 'data'].some(key => !descriptors[key]?.enumerable
        || !Object.hasOwn(descriptors[key], 'value')))
        throw Error('MVU_SCHEMA_MARKER_ENVELOPE_INVALID');
    if (event.type !== MVU_SCHEMA_DISPATCH_EVENT && event.type !== MVU_SCHEMA_COMPLETION_EVENT
        || !integer(event.seq) || !integer(event.time))
        throw Error('MVU_SCHEMA_MARKER_ENVELOPE_INVALID');
    if (event.type === MVU_SCHEMA_DISPATCH_EVENT)
        assertMvuSchemaDispatchMarker(event.data);
    else
        assertMvuSchemaCompletionMarker(event.data);
    if (event.seq !== event.data.observedNativeSeq + 1)
        throw Error('MVU_SCHEMA_MARKER_ORDER_INVALID');
}
function accept(data, seq, epochs) {
    const epoch = epochs.get(data.realmEpoch);
    if (data.encoding === 'native-mvu-schema-dispatch-marker-v1') {
        if (epoch && epoch.programSha256 !== data.programSha256)
            throw Error('MVU_SCHEMA_PROGRAM_MISMATCH');
        if (epoch && epoch.sourceSha256 !== data.sourceSha256)
            throw Error('MVU_SCHEMA_SOURCE_MISMATCH');
        if (epoch?.pending)
            throw Error('MVU_SCHEMA_DISPATCH_PENDING');
        if (epoch?.batches.has(data.batchId))
            throw Error('MVU_SCHEMA_BATCH_REUSED');
        if (epoch ? data.loadDescriptorSha256 !== null : data.loadDescriptorSha256 === null) {
            throw Error('MVU_SCHEMA_LOAD_BOUNDARY_INVALID');
        }
        if (epoch && data.previousTailSha256 !== epoch.completedTail)
            throw Error('MVU_SCHEMA_TAIL_MISMATCH');
        const next = epoch ?? { programSha256: data.programSha256, sourceSha256: data.sourceSha256, batches: new Set() };
        next.batches.add(data.batchId);
        next.pending = { seq, data };
        epochs.set(data.realmEpoch, next);
    }
    else {
        const pending = epoch?.pending;
        if (!epoch || !pending || pending.seq !== data.dispatchSeq || pending.data.sessionId !== data.sessionId
            || pending.data.batchId !== data.batchId || pending.data.dispatchRecordSha256 !== data.dispatchRecordSha256) {
            throw Error('MVU_SCHEMA_COMPLETION_UNPROVEN');
        }
        epoch.completedTail = data.completedTailSha256;
        delete epoch.pending;
    }
}
function history(events) {
    const epochs = new Map();
    let openTurn;
    for (const [index, event] of events.entries()) {
        if (event?.seq !== index)
            throw Error('MVU_SCHEMA_PREFIX_INVALID');
        assertMvuSchemaEventVocabulary(event.type);
        if (event.type === 'turn/start') {
            if (openTurn !== undefined || !integer(event.data.turn))
                throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN');
            openTurn = event.data.turn;
        }
        else if (event.type === 'turn/end') {
            if (openTurn === undefined || openTurn !== event.data.turn)
                throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN');
            openTurn = undefined;
        }
        else if (event.type === MVU_SCHEMA_DISPATCH_EVENT || event.type === MVU_SCHEMA_COMPLETION_EVENT) {
            assertMvuSchemaMarkerEvent(event);
            if (openTurn !== undefined)
                throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN');
            accept(event.data, event.seq, epochs);
        }
    }
    return { epochs, openTurn };
}
/** A pending dispatch is valid durable history. It cannot imply completion or
 * guest rollback; the Core journal/replay owner must handle that failure anchor. */
export function assertMvuSchemaHistory(events) { history(events); }
function appendBoundary(session, data) {
    if (data.sessionId !== session.id)
        throw Error('MVU_SCHEMA_OWNER_MISMATCH');
    const events = session.snapshotEvents();
    if ((events.at(-1)?.seq ?? -1) !== data.observedNativeSeq)
        throw Error('MVU_SCHEMA_STALE_NATIVE');
    const state = history(events);
    if (state.openTurn !== undefined)
        throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN');
    accept(data, data.observedNativeSeq + 1, state.epochs);
}
export function appendMvuSchemaDispatchMarker(session, data) {
    assertMvuSchemaDispatchMarker(data);
    appendBoundary(session, data);
    const event = session.append(MVU_SCHEMA_DISPATCH_EVENT, data);
    assertMvuSchemaMarkerEvent(event);
    return event;
}
export function appendMvuSchemaCompletionMarker(session, data) {
    assertMvuSchemaCompletionMarker(data);
    appendBoundary(session, data);
    const event = session.append(MVU_SCHEMA_COMPLETION_EVENT, data);
    assertMvuSchemaMarkerEvent(event);
    return event;
}
export const mvuSchemaMarkers = Object.freeze({
    dispatchEventType: MVU_SCHEMA_DISPATCH_EVENT,
    completionEventType: MVU_SCHEMA_COMPLETION_EVENT,
    appendDispatch: appendMvuSchemaDispatchMarker,
    appendCompletion: appendMvuSchemaCompletionMarker,
    assert: assertMvuSchemaMarker,
    assertDispatch: assertMvuSchemaDispatchMarker,
    assertCompletion: assertMvuSchemaCompletionMarker,
    assertEvent: assertMvuSchemaMarkerEvent,
    assertHistory: assertMvuSchemaHistory,
});
