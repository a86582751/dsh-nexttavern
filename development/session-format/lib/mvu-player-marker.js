// Generated from runtime/alpha3/compat/session-format/src/mvu-player-marker.ts; edit the TypeScript source.
export const MVU_PLAYER_EDIT_EVENT = 'roleplay/mvu-manual-edit';
const keys = ['schemaVersion', 'encoding', 'sessionId', 'operationId', 'requestSha256',
    'operationSha256', 'sourceSha256', 'rootSha256', 'baseSnapshotSha256',
    'replacementValuesSha256', 'observedNativeSeq'];
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const identity = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const integer = (value) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= 0 && !Object.is(value, -0);
export function assertMvuPlayerEditMarker(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
        || Object.getOwnPropertySymbols(value).length)
        throw Error('MVU_PLAYER_MARKER_INVALID');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.keys(descriptors).length !== keys.length || keys.some(key => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) {
        throw Error('MVU_PLAYER_MARKER_INVALID');
    }
    const data = value;
    if (data.schemaVersion !== 1 || data.encoding !== 'native-mvu-player-edit-marker-v1'
        || !identity(data.sessionId) || !identity(data.operationId) || !integer(data.observedNativeSeq)
        || ![data.requestSha256, data.operationSha256, data.sourceSha256, data.rootSha256,
            data.baseSnapshotSha256, data.replacementValuesSha256].every(hash)) {
        throw Error('MVU_PLAYER_MARKER_INVALID');
    }
}
export function assertMvuPlayerEditEvent(event) {
    if (event.type !== MVU_PLAYER_EDIT_EVENT || event.ignorable !== undefined
        || !integer(event.seq) || !integer(event.time)
        || Object.keys(event).some(key => !['type', 'seq', 'time', 'data'].includes(key))) {
        throw Error('MVU_PLAYER_MARKER_ENVELOPE_INVALID');
    }
    assertMvuPlayerEditMarker(event.data);
    if (event.seq !== event.data.observedNativeSeq + 1)
        throw Error('MVU_PLAYER_MARKER_ORDER_INVALID');
}
export function appendMvuPlayerEditMarker(session, data) {
    assertMvuPlayerEditMarker(data);
    const events = session.snapshotEvents();
    if ((events.at(-1)?.seq ?? -1) !== data.observedNativeSeq)
        throw Error('MVU_PLAYER_STALE_NATIVE');
    assertMvuPlayerMarkerBoundary(events);
    const event = session.append(MVU_PLAYER_EDIT_EVENT, data);
    assertMvuPlayerEditEvent(event);
    return event;
}
export const mvuPlayerMarkers = Object.freeze({
    eventType: MVU_PLAYER_EDIT_EVENT,
    append: appendMvuPlayerEditMarker, assert: assertMvuPlayerEditMarker, assertEvent: assertMvuPlayerEditEvent,
});
/** The marker orders a completed numerical edit between Native turns. It
 * cannot supply an ordering point inside an unfinished story or opening. */
export function assertMvuPlayerMarkerBoundary(events) {
    let open;
    for (const event of events) {
        if (event.type === 'turn/start') {
            if (open !== undefined)
                throw Error('MVU_PLAYER_NATIVE_BOUNDARY_UNKNOWN');
            open = event.data.turn;
        }
        else if (event.type === 'turn/end') {
            if (open !== event.data.turn)
                throw Error('MVU_PLAYER_NATIVE_BOUNDARY_UNKNOWN');
            open = undefined;
        }
        else if (event.type === MVU_PLAYER_EDIT_EVENT) {
            assertMvuPlayerEditEvent(event);
            if (open !== undefined)
                throw Error('MVU_PLAYER_NATIVE_BOUNDARY_UNKNOWN');
        }
    }
    if (open !== undefined)
        throw Error('MVU_PLAYER_NATIVE_BOUNDARY_UNKNOWN');
}
