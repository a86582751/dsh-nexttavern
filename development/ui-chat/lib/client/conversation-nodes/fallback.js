// Generated from runtime/alpha3/compat/ui-chat/src/client/conversation-nodes/fallback.ts; edit the TypeScript source.
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-session/surface';
import { chatNode } from "./common.js";
/** Unclaimed append-surface fallback Definition. */
export const unknownFallbackDefinition = {
    kind: 'unknown-surface',
    target: 'chat',
    match: event => event.type !== 'assistant/live-chunk' && isAppendSurfaceEvent(event)
        ? { id: String(event.seq), role: 'start' }
        : null,
    start: (_context, match) => ({
        kind: 'unknown',
        seq: match.event.seq,
        time: match.event.time,
        type: match.event.type,
        data: match.event.data,
    }),
    update: context => context.state,
    buildViewNode: context => context.state === undefined
        ? null
        : chatNode(context, 'unknown', context.state.seq, context.state),
};
/**
 * Register the unmatched append-surface fallback contribution.
 * @param ctx - owning UI Conversation context.
 */
export function registerUnknownConversationFallback(ctx) {
    ctx.uiConversation.events.registerFallback(unknownFallbackDefinition);
}
