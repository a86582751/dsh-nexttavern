// Generated from runtime/alpha3/compat/session/src/request-preview.ts; edit the TypeScript source.
/** Canonical, nonpublishing request append preview. This owns candidate event
 * snapshots and delegates every surface transition to SurfaceManager. It does
 * not create a Session, run observers, or infer Native input permission. */
import { deepFreeze, snapshotJsonValue } from '@deepseek-ai/dsh-util-values';
import { SurfaceManager, validateSessionEventData } from './surface.js';
import { SessionLogOffset, SessionSeq } from './types.js';
const ALLOWED = new Set(['system/message', 'user/message', 'developer/message', 'request/header', 'request/context']);
export const SESSION_REQUEST_PREVIEW_BOUNDS = Object.freeze({ appends: 128, messages: 4096, candidateBytes: 8_388_608 });
/** The complete committed prefix is borrowed, not cloned. The additional
 * events are detached once before validation, so preview and commit read the
 * same message IDs/data/intents even if the caller later edits its inputs. */
export function previewSessionRequestAppends(committed, projections, inputs) {
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
            type: input.type, seq: SessionSeq(committed.length + candidate.length), time: Date.now(), data,
            ...surface,
        });
        validateSessionEventData(event, `request preview at seq ${event.seq}`);
        candidate.push(event);
    }
    const prefix = [...committed, ...candidate];
    if (prefix.length === 0)
        throw Error('SESSION_REQUEST_PREVIEW_BOUNDARY_EMPTY');
    const surface = new SurfaceManager(prefix, SessionLogOffset(0), projections);
    const nodes = [...surface.nodes], messageNodes = [];
    for (const seq of nodes) {
        const event = prefix[seq];
        if (!event)
            throw Error('SESSION_REQUEST_PREVIEW_SURFACE');
        const message = surface.deriveEventMessage(event);
        if (message)
            messageNodes.push({ seq, message });
    }
    if (messageNodes.length > SESSION_REQUEST_PREVIEW_BOUNDS.messages)
        throw Error('SESSION_REQUEST_PREVIEW_MESSAGE_BUDGET');
    return deepFreeze({ baseLogLength: committed.length, boundarySeq: SessionSeq(prefix.length - 1), events: candidate,
        surfaceNodes: nodes, contentGeneration: surface.contentGeneration,
        messages: messageNodes.map(row => row.message), messageNodes });
}
