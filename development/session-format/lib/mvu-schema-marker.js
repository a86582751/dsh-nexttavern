// Generated from runtime/alpha3/compat/session-format/src/mvu-schema-marker.ts; edit the TypeScript source.
export const MVU_SCHEMA_DISPATCH_EVENT = 'roleplay/mvu-schema-dispatched';
export const MVU_SCHEMA_COMPLETION_EVENT = 'roleplay/mvu-schema-completed';
export const MVU_SCHEMA_REVISION_EVENT = 'roleplay/mvu-schema-revised';
/** Reserved execution vocabulary cannot opt into the upstream unknown-event
 * skip contract; dropping such a row could erase a pending execution anchor. */
export function assertMvuSchemaEventVocabulary(type) {
    if (typeof type === 'string' && type.startsWith('roleplay/mvu-schema-')
        && type !== MVU_SCHEMA_DISPATCH_EVENT && type !== MVU_SCHEMA_COMPLETION_EVENT
        && type !== MVU_SCHEMA_REVISION_EVENT) {
        throw Error('MVU_SCHEMA_EVENT_UNKNOWN');
    }
}
const commonKeys = ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'batchId',
    'dispatchRecordSha256', 'observedNativeSeq'];
const dispatchKeys = [...commonKeys, 'programSha256', 'sourceSha256', 'previousTailSha256', 'loadDescriptorSha256'];
const completionKeys = [...commonKeys, 'dispatchSeq', 'completionRecordSha256', 'completedTailSha256'];
const revisionKeys = ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'descriptor',
    'editSeq', 'completionSeq', 'observedNativeSeq'];
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
export function assertMvuSchemaRevisionMarker(value) {
    exactData(value, revisionKeys);
    exactData(value.descriptor, ['key', 'sha256']);
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-revision-marker-v1'
        || !identity(value.sessionId) || !hash(value.realmEpoch) || !integer(value.editSeq)
        || !integer(value.completionSeq) || !integer(value.observedNativeSeq)
        || typeof value.descriptor.key !== 'string' || value.descriptor.key.length > 256
        || !value.descriptor.key.startsWith(`${value.sessionId}__`) || !hash(value.descriptor.sha256)) {
        throw Error('MVU_SCHEMA_MARKER_INVALID');
    }
}
export function assertMvuSchemaMarker(value) {
    // Inspect the encoding descriptor without invoking an untrusted getter.
    const encoding = value && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'encoding') : undefined;
    if (encoding && 'value' in encoding && encoding.value === 'native-mvu-schema-dispatch-marker-v1') {
        assertMvuSchemaDispatchMarker(value);
    }
    else if (encoding && 'value' in encoding && encoding.value === 'native-mvu-schema-revision-marker-v1') {
        assertMvuSchemaRevisionMarker(value);
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
        && event.type !== MVU_SCHEMA_REVISION_EVENT
        || !integer(event.seq) || !integer(event.time))
        throw Error('MVU_SCHEMA_MARKER_ENVELOPE_INVALID');
    if (event.type === MVU_SCHEMA_DISPATCH_EVENT)
        assertMvuSchemaDispatchMarker(event.data);
    else if (event.type === MVU_SCHEMA_REVISION_EVENT)
        assertMvuSchemaRevisionMarker(event.data);
    else
        assertMvuSchemaCompletionMarker(event.data);
    if (event.seq !== event.data.observedNativeSeq + 1)
        throw Error('MVU_SCHEMA_MARKER_ORDER_INVALID');
}
function accept(data, seq, epochs, events) {
    const epoch = epochs.get(data.realmEpoch);
    if (data.encoding === 'native-mvu-schema-revision-marker-v1') {
        const edit = events[data.editSeq];
        if (!epoch || epoch.pending || edit?.type !== 'roleplay/message-edit' || edit.seq >= seq
            || edit.data.role !== 'assistant')
            throw Error('MVU_SCHEMA_REVISION_EDIT_UNPROVEN');
        if (epoch.revisions.some(revision => revision.event.data.descriptor.key === data.descriptor.key)) {
            throw Error('MVU_SCHEMA_REVISION_REUSED');
        }
        const index = epoch.pairs.findIndex(pair => pair.completion.seq === data.completionSeq);
        if (index < 0)
            throw Error('MVU_SCHEMA_REVISION_CUT_UNPROVEN');
        const superseded = epoch.pairs.splice(index + 1);
        // Used batch identities survive the rewind; a revision never permits a
        // previously dispatched guest operation to execute under the same identity.
        epoch.completedTail = epoch.pairs[index].completion.data.completedTailSha256;
        epoch.revisions.push({ event: events[seq], superseded });
    }
    else if (data.encoding === 'native-mvu-schema-dispatch-marker-v1') {
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
        const next = epoch ?? { programSha256: data.programSha256, sourceSha256: data.sourceSha256,
            batches: new Set(), pairs: [], revisions: [] };
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
        epoch.pairs.push({ dispatch: events[pending.seq],
            completion: events[seq] });
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
        else if (event.type === MVU_SCHEMA_DISPATCH_EVENT || event.type === MVU_SCHEMA_COMPLETION_EVENT
            || event.type === MVU_SCHEMA_REVISION_EVENT) {
            assertMvuSchemaMarkerEvent(event);
            if (openTurn !== undefined)
                throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN');
            accept(event.data, event.seq, epochs, events);
        }
    }
    return { epochs, openTurn };
}
/** A pending dispatch is valid durable history. It cannot imply completion or
 * guest rollback; the Core journal/replay owner must handle that failure anchor. */
export function assertMvuSchemaHistory(events) { history(events); }
/** This fold is the single owner of effective marker selection. Journal reads
 * consume its pairs and explicit revision facts, retaining the real Native log. */
export function readEffectiveMvuSchemaHistory(events) {
    return history(events);
}
function appendBoundary(session, data) {
    if (data.sessionId !== session.id)
        throw Error('MVU_SCHEMA_OWNER_MISMATCH');
    const events = session.snapshotEvents();
    if ((events.at(-1)?.seq ?? -1) !== data.observedNativeSeq)
        throw Error('MVU_SCHEMA_STALE_NATIVE');
    const state = history(events);
    if (state.openTurn !== undefined)
        throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN');
    // Append admission has no new event object yet. Only the pair/revision DATA
    // is needed for the check; the following actual append supplies that object.
    accept(data, data.observedNativeSeq + 1, state.epochs, events);
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
export function appendMvuSchemaRevisionMarker(session, data) {
    assertMvuSchemaRevisionMarker(data);
    appendBoundary(session, data);
    const event = session.append(MVU_SCHEMA_REVISION_EVENT, data);
    assertMvuSchemaMarkerEvent(event);
    return event;
}
export const mvuSchemaMarkers = Object.freeze({
    dispatchEventType: MVU_SCHEMA_DISPATCH_EVENT,
    completionEventType: MVU_SCHEMA_COMPLETION_EVENT,
    revisionEventType: MVU_SCHEMA_REVISION_EVENT,
    appendDispatch: appendMvuSchemaDispatchMarker,
    appendCompletion: appendMvuSchemaCompletionMarker,
    appendRevision: appendMvuSchemaRevisionMarker,
    assert: assertMvuSchemaMarker,
    assertDispatch: assertMvuSchemaDispatchMarker,
    assertCompletion: assertMvuSchemaCompletionMarker,
    assertEvent: assertMvuSchemaMarkerEvent,
    assertHistory: assertMvuSchemaHistory,
    readEffectiveHistory: readEffectiveMvuSchemaHistory,
});
