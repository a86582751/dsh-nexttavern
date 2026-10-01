// Generated from runtime/alpha3/compat/session-format/src/index.ts; edit the TypeScript source.
import { MESSAGE_EDIT_EVENT, messageEditProjection } from './projection.js';
export const name = 'nexttavern-message-edits';
export const inject = ['sessions'];
/** Register once at profile scope, before sessions are created or restored. */
export function apply(ctx) {
    ctx.sessions.registerMessageProjection(messageEditProjection);
    ctx.provide('nexttavernMessageEdits', {
        append: appendMessageEdit, latest: latestMessageEdit, current: currentMessageEdits,
    });
}
/** Append a required edit synchronously; callers own branch locks and derived-state invalidation. */
export function appendMessageEdit(session, targetSeq, identity, text) {
    return session.append(MESSAGE_EDIT_EVENT, { schemaVersion: 1, targetSeq, ...identity, text });
}
/** Reuse an accepted edit after a later metadata write failed; never manufacture a model message. */
export function latestMessageEdit(events, targetSeq) {
    for (let index = events.length - 1; index >= 0; index--) {
        const event = events[index];
        if (event?.type === MESSAGE_EDIT_EVENT && event.data.targetSeq === targetSeq)
            return event;
    }
    return null;
}
const editIndexes = new WeakMap();
/** Latest accepted decisions, including archived nodes; unchanged polls inspect only prefix endpoints. */
export function currentMessageEdits(session, events) {
    const previous = editIndexes.get(session);
    // Accepted Session records are immutable. These pins distinguish append-only
    // growth from a replaced/shrunk observation without scanning the old history.
    const extendsPrefix = previous && events.length >= previous.length && events[0] === previous.first &&
        (previous.length === 0 || events[previous.length - 1] === previous.last);
    const index = extendsPrefix ? previous : {
        length: 0, first: undefined, last: undefined, byTarget: new Map(), snapshot: Object.freeze([]),
    };
    let changed = false;
    for (let offset = index.length; offset < events.length; offset++) {
        const event = events[offset];
        if (event.type === MESSAGE_EDIT_EVENT) {
            index.byTarget.set(event.data.targetSeq, event);
            changed = true;
        }
    }
    if (changed)
        index.snapshot = Object.freeze([...index.byTarget.values()]);
    index.length = events.length;
    index.first = events[0];
    index.last = events.at(-1);
    editIndexes.set(session, index);
    return index.snapshot;
}
