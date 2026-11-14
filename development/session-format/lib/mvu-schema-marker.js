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
function accept(data, seq, epochs, eventAt, commit = true, indexes, undo) {
    const epoch = epochs.get(data.realmEpoch);
    const indexed = indexes?.get(data.realmEpoch);
    if (data.encoding === 'native-mvu-schema-revision-marker-v1') {
        const edit = eventAt(data.editSeq);
        if (!epoch || epoch.pending || edit?.type !== 'roleplay/message-edit' || edit.seq >= seq
            || (edit.data.role !== 'assistant' && edit.data.role !== 'user'))
            throw Error('MVU_SCHEMA_REVISION_EDIT_UNPROVEN');
        if (indexed ? indexed.descriptors.has(data.descriptor.key)
            : epoch.revisions.some(revision => revision.event.data.descriptor.key === data.descriptor.key)) {
            throw Error('MVU_SCHEMA_REVISION_REUSED');
        }
        const index = indexed ? indexed.completions.get(data.completionSeq) ?? -1
            : epoch.pairs.findIndex(pair => pair.completion.seq === data.completionSeq);
        if (index < 0)
            throw Error('MVU_SCHEMA_REVISION_CUT_UNPROVEN');
        if (!commit)
            return;
        // Normal appends share the pair array with bounded old views. Rewind is
        // the actual branch change: detach that branch before later append writes.
        const superseded = indexes ? epoch.pairs.slice(index + 1) : epoch.pairs.splice(index + 1);
        if (undo) {
            const pairs = epoch.pairs, revisionLength = epoch.revisions.length, tail = epoch.completedTail;
            undo.push(() => {
                epoch.pairs = pairs;
                epoch.revisions.length = revisionLength;
                if (tail === undefined)
                    delete epoch.completedTail;
                else
                    epoch.completedTail = tail;
                indexed?.descriptors.delete(data.descriptor.key);
                if (indexed)
                    for (const [offset, pair] of superseded.entries())
                        indexed.completions.set(pair.completion.seq, index + 1 + offset);
            });
        }
        if (indexes)
            epoch.pairs = epoch.pairs.slice(0, index + 1);
        if (indexed) {
            indexed.descriptors.add(data.descriptor.key);
            for (const pair of superseded)
                indexed.completions.delete(pair.completion.seq);
        }
        // Used batch identities survive the rewind; a revision never permits a
        // previously dispatched guest operation to execute under the same identity.
        epoch.completedTail = epoch.pairs[index].completion.data.completedTailSha256;
        epoch.revisions.push({ event: eventAt(seq), superseded });
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
        if (!commit)
            return;
        const next = epoch ?? { programSha256: data.programSha256, sourceSha256: data.sourceSha256,
            batches: new Set(), pairs: [], revisions: [] };
        if (undo)
            undo.push(() => {
                if (!epoch) {
                    epochs.delete(data.realmEpoch);
                    indexes?.delete(data.realmEpoch);
                }
                else {
                    epoch.batches.delete(data.batchId);
                    delete epoch.pending;
                }
            });
        next.batches.add(data.batchId);
        next.pending = { seq, data };
        epochs.set(data.realmEpoch, next);
        if (indexes && !indexed)
            indexes.set(data.realmEpoch, { completions: new Map(), descriptors: new Set() });
    }
    else {
        const pending = epoch?.pending;
        if (!epoch || !pending || pending.seq !== data.dispatchSeq || pending.data.sessionId !== data.sessionId
            || pending.data.batchId !== data.batchId || pending.data.dispatchRecordSha256 !== data.dispatchRecordSha256) {
            throw Error('MVU_SCHEMA_COMPLETION_UNPROVEN');
        }
        if (!commit)
            return;
        if (undo) {
            const pairLength = epoch.pairs.length, tail = epoch.completedTail;
            undo.push(() => {
                epoch.pairs.length = pairLength;
                epoch.pending = pending;
                if (tail === undefined)
                    delete epoch.completedTail;
                else
                    epoch.completedTail = tail;
                indexed?.completions.delete(seq);
            });
        }
        epoch.completedTail = data.completedTailSha256;
        if (indexed)
            indexed.completions.set(seq, epoch.pairs.length);
        epoch.pairs.push({ dispatch: eventAt(pending.seq),
            completion: eventAt(seq) });
        delete epoch.pending;
    }
}
function consume(event, index, state, eventAt, indexes, undo) {
    if (event?.seq !== index)
        throw Error('MVU_SCHEMA_PREFIX_INVALID');
    assertMvuSchemaEventVocabulary(event.type);
    if (event.type === 'turn/start') {
        if (state.openTurn !== undefined || !integer(event.data.turn))
            throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN');
        state.openTurn = event.data.turn;
    }
    else if (event.type === 'turn/end') {
        if (state.openTurn === undefined || state.openTurn !== event.data.turn)
            throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN');
        state.openTurn = undefined;
    }
    else if (event.type === MVU_SCHEMA_DISPATCH_EVENT || event.type === MVU_SCHEMA_COMPLETION_EVENT
        || event.type === MVU_SCHEMA_REVISION_EVENT) {
        assertMvuSchemaMarkerEvent(event);
        if (state.openTurn !== undefined)
            throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN');
        accept(event.data, event.seq, state.epochs, eventAt, true, indexes, undo);
    }
}
function history(events) {
    const state = { epochs: new Map(), openTurn: undefined };
    for (const [index, event] of events.entries())
        consume(event, index, state, seq => events[seq]);
    return state;
}
/** A pending dispatch is valid durable history. It cannot imply completion or
 * guest rollback; the Core journal/replay owner must handle that failure anchor. */
export function assertMvuSchemaHistory(events) { history(events); }
/** Durable DATA validation over a single serialized writer's accepted prefix.
 * A staged suffix is private until commit; rollback touches only that suffix's
 * mutations, including a revision's actual rewind. No Session authority is granted. */
export function createMvuSchemaHistoryValidator(initial = []) {
    const events = [], state = { epochs: new Map(), openTurn: undefined }, indexes = new Map();
    let staged = false;
    const stage = (tail) => {
        if (staged)
            throw Error('MVU_SCHEMA_VALIDATION_STAGED');
        staged = true;
        const length = events.length, openTurn = state.openTurn, undo = [];
        let active = true;
        const rollback = () => {
            if (!active)
                return;
            for (let index = undo.length - 1; index >= 0; index--)
                undo[index]();
            events.length = length;
            state.openTurn = openTurn;
            staged = false;
            active = false;
        };
        try {
            for (const event of tail) {
                const index = events.length;
                events.push(event);
                consume(event, index, state, seq => events[seq], indexes, undo);
            }
        }
        catch (error) {
            rollback();
            throw error;
        }
        return { commit() { if (active) {
                staged = false;
                active = false;
            } }, rollback };
    };
    stage(initial).commit();
    return { get length() { return events.length; }, stage };
}
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
    accept(data, data.observedNativeSeq + 1, state.epochs, seq => events[seq], false);
}
export function appendMvuSchemaDispatchMarker(session, data, _cut) {
    assertMvuSchemaDispatchMarker(data);
    appendBoundary(session, data);
    const event = session.append(MVU_SCHEMA_DISPATCH_EVENT, data);
    assertMvuSchemaMarkerEvent(event);
    return event;
}
export function appendMvuSchemaCompletionMarker(session, data, _cut) {
    assertMvuSchemaCompletionMarker(data);
    appendBoundary(session, data);
    const event = session.append(MVU_SCHEMA_COMPLETION_EVENT, data);
    assertMvuSchemaMarkerEvent(event);
    return event;
}
export function appendMvuSchemaRevisionMarker(session, data, _cut) {
    assertMvuSchemaRevisionMarker(data);
    appendBoundary(session, data);
    const event = session.append(MVU_SCHEMA_REVISION_EVENT, data);
    assertMvuSchemaMarkerEvent(event);
    return event;
}
function sequence(values) {
    const length = values.length;
    return Object.freeze({ length, at(index) {
            const position = index < 0 ? length + index : index;
            return Number.isSafeInteger(position) && position >= 0 && position < length ? values[position] : undefined;
        }, *range(start = 0, end = length) {
            if (!integer(start) || !integer(end) || end < start || end > length) {
                throw new RangeError('MVU schema history range is outside this cut');
            }
            for (let index = start; index < end; index++)
                yield values[index];
        } });
}
function epochView(epoch) {
    return Object.freeze({ programSha256: epoch.programSha256, sourceSha256: epoch.sourceSha256,
        ...(epoch.pending ? { pending: epoch.pending } : {}), ...(epoch.completedTail ? { completedTail: epoch.completedTail } : {}),
        pairs: sequence(epoch.pairs), revisions: sequence(epoch.revisions) });
}
function recordEpoch(cursor, event) {
    const epoch = cursor.epochs.get(event.data.realmEpoch);
    if (event.type === MVU_SCHEMA_DISPATCH_EVENT)
        Object.freeze(epoch.pending);
    else if (event.type === MVU_SCHEMA_COMPLETION_EVENT)
        Object.freeze(epoch.pairs.at(-1));
    else {
        const revision = epoch.revisions.at(-1);
        Object.freeze(revision.superseded);
        Object.freeze(revision);
    }
    let versions = cursor.versions.get(event.data.realmEpoch);
    if (!versions)
        cursor.versions.set(event.data.realmEpoch, versions = []);
    versions.push({ seq: event.seq, view: epochView(epoch) });
}
function versionAt(versions, length) {
    if (!versions)
        return;
    const latest = versions.at(-1);
    if (latest && latest.seq < length)
        return latest.view;
    let first = 0, last = versions.length;
    while (first < last) {
        const middle = (first + last) >>> 1;
        if (versions[middle].seq < length)
            first = middle + 1;
        else
            last = middle;
    }
    return versions[first - 1]?.view;
}
function prefixIdentity(cut, length) {
    const digest = cut.prefixSha256(length);
    if (digest === undefined)
        throw Error('MVU_SCHEMA_PREFIX_INVALID');
    return digest;
}
function fullCut(cut, length) {
    const state = { epochs: new Map(), openTurn: undefined };
    for (let seq = 0; seq < length; seq++)
        consume(cut.at(seq), seq, state, index => cut.at(index));
    for (const epoch of state.epochs.values()) {
        if (epoch.pending)
            Object.freeze(epoch.pending);
        for (const pair of epoch.pairs)
            Object.freeze(pair);
        for (const revision of epoch.revisions) {
            Object.freeze(revision.superseded);
            Object.freeze(revision);
        }
    }
    return Object.freeze({ owner: cut.owner, source: cut.source, length, nativePrefixSha256: prefixIdentity(cut, length),
        openTurn: state.openTurn, epochs: Object.freeze({ get(realm) {
                const epoch = state.epochs.get(realm);
                return epoch && epochView(epoch);
            } }) });
}
/** One plugin instance connects the actual Core Session and history owners.
 * Public raw arrays keep their complete parser; no DTO flag enrolls a cursor. */
export function createMvuSchemaHistoryReader(deps) {
    const cursors = new WeakMap();
    function read(session, cut, length) {
        if (!integer(length) || length > cut.length)
            throw Error('MVU_SCHEMA_PREFIX_INVALID');
        if (cut.source !== 'native')
            return fullCut(cut, length);
        let cursor = cursors.get(session);
        if (cursor && cursor.owner !== cut.owner)
            throw Error('MVU_SCHEMA_PREFIX_OWNER_CHANGED');
        if (cursor && length < cursor.length)
            return fullCut(cut, length);
        if (!cursor) {
            cursor = { owner: cut.owner, length: 0, epochs: new Map(), openTurn: undefined, indexes: new Map(), versions: new Map() };
            cursors.set(session, cursor);
        }
        if (cursor.error && length > cursor.length)
            throw cursor.error;
        try {
            for (const event of cut.range(cursor.length, length)) {
                consume(event, cursor.length, cursor, seq => cut.at(seq), cursor.indexes);
                if (event.type === MVU_SCHEMA_DISPATCH_EVENT || event.type === MVU_SCHEMA_COMPLETION_EVENT
                    || event.type === MVU_SCHEMA_REVISION_EVENT)
                    recordEpoch(cursor, event);
                cursor.length++;
            }
        }
        catch (error) {
            cursor.error = error;
            throw error;
        }
        const versions = cursor.versions;
        return Object.freeze({ owner: cut.owner, source: cut.source, length, nativePrefixSha256: prefixIdentity(cut, length),
            openTurn: cursor.openTurn, epochs: Object.freeze({ get: (realm) => versionAt(versions.get(realm), length) }) });
    }
    function actual(sessionId) {
        const session = deps.session(sessionId);
        if (!session)
            throw Error('MVU_SCHEMA_OWNER_UNAVAILABLE');
        return { session, cut: deps.readOwnedCut(session) };
    }
    function append(session, data, eventType) {
        if (data.sessionId !== session.id || deps.session(session.id) !== session)
            throw Error('MVU_SCHEMA_OWNER_MISMATCH');
        const cut = deps.readOwnedCut(session);
        if (cut.source !== 'native') {
            appendBoundary(session, data);
            const event = session.append(eventType, data);
            assertMvuSchemaMarkerEvent(event);
            return event;
        }
        if (cut.length - 1 !== data.observedNativeSeq)
            throw Error('MVU_SCHEMA_STALE_NATIVE');
        const state = read(session, cut, cut.length);
        if (state.openTurn !== undefined)
            throw Error('MVU_SCHEMA_NATIVE_BOUNDARY_UNKNOWN');
        // Admission only checks; the cursor must not contain an operation that
        // Native failed to append. Loaded histories retain the complete path.
        const cursor = cursors.get(session);
        accept(data, cut.length, cursor.epochs, seq => cut.at(seq), false, cursor.indexes);
        const event = session.append(eventType, data);
        assertMvuSchemaMarkerEvent(event);
        // This new read comes from the owner after the actual append, including
        // any synchronous Native tail publication. A thrown append never enters it.
        const appended = deps.readOwnedCut(session);
        read(session, appended, appended.length);
        return event;
    }
    return Object.freeze({ ...mvuSchemaMarkers,
        readEffectiveCut(sessionId, nativeCut) {
            const { session, cut } = actual(sessionId);
            return read(session, cut, nativeCut);
        },
        appendDispatch(session, data, _cut) {
            assertMvuSchemaDispatchMarker(data);
            return append(session, data, MVU_SCHEMA_DISPATCH_EVENT);
        },
        appendCompletion(session, data, _cut) {
            assertMvuSchemaCompletionMarker(data);
            return append(session, data, MVU_SCHEMA_COMPLETION_EVENT);
        },
        appendRevision(session, data, _cut) {
            assertMvuSchemaRevisionMarker(data);
            return append(session, data, MVU_SCHEMA_REVISION_EVENT);
        },
    });
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
    createHistoryReader: createMvuSchemaHistoryReader,
});
