// Generated from runtime/alpha3/compat/session-format/src/index.ts; edit the TypeScript source.
import { foldSurface } from 'dsh-nexttavern-native-session/surface';
import { MESSAGE_EDIT_EVENT, assertMessageEdit, editMessageText, messageEditProjection } from './projection.js';
import { mvuPlayerMarkers } from './mvu-player-marker.js';
import { mvuSchemaMarkers } from './mvu-schema-marker.js';
import { authorInjectionCleanupMarkers, authorInjectionDeclarationMarkers } from './author-injection-cleanup.js';
import { authorChatRootMarkers } from './author-chat-marker.js';
export { AUTHOR_CHAT_ROOT_EVENT, appendAuthorChatRootMarker, assertAuthorChatRootMarker, authorChatRootMarkers } from './author-chat-marker.js';
export { AUTHOR_INJECTION_CLEANUP_EVENT, appendAuthorInjectionCleanup, assertAuthorInjectionCleanup, authorInjectionCleanupMarkers } from './author-injection-cleanup.js';
export { AUTHOR_INJECTION_DECLARATION_EVENT, appendAuthorInjectionDeclaration, assertAuthorInjectionDeclaration, authorInjectionDeclarationMarkers } from './author-injection-cleanup.js';
export const name = 'nexttavern-message-edits';
export const inject = ['sessions'];
/** Register once at profile scope, before sessions are created or restored. */
export function apply(ctx) {
    ctx.sessions.registerMessageProjection(messageEditProjection);
    ctx.provide('nexttavernMessageEdits', {
        append: appendMessageEdit, latest: latestMessageEdit, current: currentMessageEdits,
        lookupOperation: lookupMessageEditOperation,
        lookupTarget: lookupMessageEditTarget,
        projectPrefix: projectMessageEditPrefix,
        assertMessageEdit, editMessageText,
    });
    ctx.provide('nexttavernMvuPlayerMarkers', mvuPlayerMarkers);
    ctx.provide('nexttavernMvuSchemaMarkers', mvuSchemaMarkers);
    ctx.provide('nexttavernAuthorInjectionCleanupMarkers', authorInjectionCleanupMarkers);
    ctx.provide('nexttavernAuthorInjectionDeclarationMarkers', authorInjectionDeclarationMarkers);
    ctx.provide('nexttavernAuthorChatRootMarkers', authorChatRootMarkers);
}
/** Fold one complete original-seq prefix without borrowing a live Session surface. */
export function projectMessageEditPrefix(events) {
    for (const [index, event] of events.entries()) {
        if (event?.seq !== index) {
            throw Error(`Message edit prefix must start at seq 0 and remain contiguous; expected ${index}`);
        }
    }
    const folded = foldSurface(events, [messageEditProjection]);
    // Native Session records are immutable. Keep only the detached fold result;
    // callers can release or change their observation array after this returns.
    return {
        nodes: Object.freeze([...folded.nodes]),
        projectedMessageAt: seq => folded.projectedMessages.get(seq),
    };
}
/** Append a required edit synchronously; callers own branch locks and derived-state invalidation. */
export function appendMessageEdit(session, targetSeq, identity, text, sourceMaterial, operation) {
    const metadata = operation ? { operation } : {};
    if (sourceMaterial) {
        return session.append(MESSAGE_EDIT_EVENT, { schemaVersion: 2, targetSeq, ...identity, text, sourceMaterial, ...metadata });
    }
    return session.append(MESSAGE_EDIT_EVENT, { schemaVersion: 1, targetSeq, ...identity, text, ...metadata });
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
function advanceEditIndex(session, events) {
    const previous = editIndexes.get(session);
    // Accepted Session records are immutable. These pins distinguish append-only
    // growth from a replaced/shrunk observation without scanning the old history.
    const extendsPrefix = previous && events.length >= previous.length && events.at(0) === previous.first &&
        (previous.length === 0 || events.at(previous.length - 1) === previous.last);
    const index = extendsPrefix ? previous : {
        length: 0, first: undefined, last: undefined, byTarget: new Map(), byOperation: new Map(), snapshot: Object.freeze([]),
    };
    for (let offset = index.length; offset < events.length; offset++) {
        const event = events.at(offset);
        if (event.type === MESSAGE_EDIT_EVENT) {
            index.byTarget.set(event.data.targetSeq, event);
            const operationId = event.data.operation?.operationId;
            // The writer resolves retries before append. Keep the original accepted
            // operation fact even when later edits replace this target's prose.
            if (operationId && !index.byOperation.has(operationId))
                index.byOperation.set(operationId, event);
            index.snapshot = undefined;
        }
    }
    index.length = events.length;
    index.first = events.at(0);
    index.last = events.length ? events.at(events.length - 1) : undefined;
    editIndexes.set(session, index);
    return index;
}
export function currentMessageEdits(session, events) {
    const index = advanceEditIndex(session, events);
    return index.snapshot ??= Object.freeze([...index.byTarget.values()]);
}
/** Exact accepted operation DATA; neither a current target nor write permission. */
export function lookupMessageEditOperation(session, events, operationId) {
    return advanceEditIndex(session, events).byOperation.get(operationId);
}
export function lookupMessageEditTarget(session, events, targetSeq) {
    return advanceEditIndex(session, events).byTarget.get(targetSeq);
}
