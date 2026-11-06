// Generated from runtime/alpha3/compat/session/src/request-preview.ts; edit the TypeScript source.
/** Canonical, nonpublishing request append preview. This owns candidate event
 * snapshots and delegates every surface transition to SurfaceManager. It does
 * not create a Session, run observers, or infer Native input permission. */
import { deepFreeze, snapshotJsonValue } from '@deepseek-ai/dsh-util-values';
import { ToolHistoryProjection } from './tool-history.js';
import { SurfaceManager, validateSessionEventData } from './surface.js';
import { SessionLogOffset, SessionSeq } from './types.js';
const ALLOWED = new Set(['system/message', 'user/message', 'developer/message', 'request/header', 'request/context', 'step/start']);
export const SESSION_REQUEST_PREVIEW_BOUNDS = Object.freeze({ appends: 128, messages: 4096, candidateBytes: 8_388_608 });
/** Detach the bounded candidates once, including their final event identity.
 * Both the Session-owned preview and the raw cold oracle use these events. */
export function createSessionRequestCandidateEvents(baseLogLength, inputs) {
    if (!Array.isArray(inputs) || inputs.length > SESSION_REQUEST_PREVIEW_BOUNDS.appends) {
        throw Error('SESSION_REQUEST_PREVIEW_APPEND_BUDGET');
    }
    const candidate = [];
    let candidateBytes = 0;
    for (const input of inputs) {
        if (!ALLOWED.has(input.type))
            throw Error('SESSION_REQUEST_PREVIEW_TYPE');
        const intent = input.intent;
        const metadata = { ...(intent?.surfaceOp === undefined ? {} : { surfaceOp: intent.surfaceOp }),
            ...(intent?.sourceEventSeqs === undefined ? {} : { sourceEventSeqs: intent.sourceEventSeqs }) };
        const data = snapshotJsonValue(input.data), surface = snapshotJsonValue(metadata);
        if (data === undefined || surface === undefined)
            throw Error('SESSION_REQUEST_PREVIEW_DATA');
        // Candidate request material is bounded; the existing log is never copied
        // into this allowance or into a second full Harness/Session instance.
        candidateBytes += new TextEncoder().encode(JSON.stringify({ data, surface })).byteLength;
        if (candidateBytes > SESSION_REQUEST_PREVIEW_BOUNDS.candidateBytes)
            throw Error('SESSION_REQUEST_PREVIEW_DATA_BUDGET');
        const event = deepFreeze({
            type: input.type, seq: SessionSeq(baseLogLength + candidate.length), time: Date.now(), data,
            ...surface,
        });
        validateSessionEventData(event, `request preview at seq ${event.seq}`);
        candidate.push(event);
    }
    return Object.freeze(candidate);
}
/** The folds own immutable messages/tool history. Only the returned request
 * containers are new; old message bodies are not traversed or frozen again. */
export function createSessionRequestPreview(baseLogLength, candidate, surface, toolHistory) {
    if (baseLogLength + candidate.length === 0)
        throw Error('SESSION_REQUEST_PREVIEW_BOUNDARY_EMPTY');
    if (surface.messages.length > SESSION_REQUEST_PREVIEW_BOUNDS.messages)
        throw Error('SESSION_REQUEST_PREVIEW_MESSAGE_BUDGET');
    return Object.freeze({ baseLogLength, boundarySeq: SessionSeq(baseLogLength + candidate.length - 1), events: candidate,
        ...surface, toolHistory });
}
/** Standalone raw-array callers have no Session-owned accepted fold. Keep
 * this cold reconstruction as the oracle, without granting commit authority. */
export function previewSessionRequestAppends(committed, projections, inputs) {
    const candidate = createSessionRequestCandidateEvents(committed.length, inputs);
    const prefix = [...committed, ...candidate];
    if (prefix.length === 0)
        throw Error('SESSION_REQUEST_PREVIEW_BOUNDARY_EMPTY');
    const surface = new SurfaceManager(prefix, SessionLogOffset(0), projections);
    const tools = new ToolHistoryProjection();
    for (const event of prefix)
        tools.apply(event);
    const nodes = [...surface.nodes], messageNodes = [];
    for (const seq of nodes) {
        const event = prefix[seq];
        if (!event)
            throw Error('SESSION_REQUEST_PREVIEW_SURFACE');
        const message = surface.deriveEventMessage(event);
        if (message)
            messageNodes.push({ seq, message });
    }
    return createSessionRequestPreview(committed.length, candidate, { surfaceNodes: Object.freeze(nodes), contentGeneration: surface.contentGeneration,
        messages: Object.freeze(messageNodes.map(row => row.message)),
        messageNodes: Object.freeze(messageNodes.map(row => Object.freeze(row))) }, tools.snapshot());
}
