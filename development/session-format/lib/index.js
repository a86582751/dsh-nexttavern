// Generated from runtime/alpha3/compat/session-format/src/index.ts; edit the TypeScript source.
import { MESSAGE_EDIT_EVENT, messageEditProjection } from './projection.js';
export const name = 'nexttavern-message-edits';
export const inject = ['sessions'];
/** Register once at profile scope, before sessions are created or restored. */
export function apply(ctx) {
    ctx.sessions.registerMessageProjection(messageEditProjection);
}
/** Append a required edit synchronously; callers own branch locks and derived-state invalidation. */
export function appendMessageEdit(session, targetSeq, identity, text) {
    return session.append(MESSAGE_EDIT_EVENT, { schemaVersion: 1, targetSeq, ...identity, text });
}
