// Generated from runtime/alpha3/compat/ui-chat/src/client/conversation-nodes/message.ts; edit the TypeScript source.
import { isAppendSurfaceEvent, isReplacementSurfaceEvent } from '@deepseek-ai/dsh-session/surface';
import { chatNode } from "./common.js";
import { contextForm, contextProducer } from "./event-projection.js";
function isCompactionCheckpoint(event) {
    if (event.type !== 'user/message' || !isReplacementSurfaceEvent(event))
        return false;
    const source = event.data.source;
    return source.kind === 'compact-checkpoint';
}
/** User, steering, and injected-context message classification Definition. */
export const messageDefinition = {
    kind: 'input-message',
    target: 'chat',
    match: (event) => {
        if (event.type === 'user/message') {
            return isAppendSurfaceEvent(event) && !isCompactionCheckpoint(event)
                ? { id: String(event.data.id), role: 'start' }
                : null;
        }
        // Developer history is persisted for V4; presentation is intentionally deferred.
        if (event.type === 'developer/message')
            throw new Error('Chat developer messages are not supported yet');
        return null;
    },
    start: (_context, match, reader) => {
        if (match.event.type !== 'user/message')
            throw new Error('input-message start requires user/message');
        const event = match.event;
        if (event.data.source.kind !== 'user') {
            const nextTurn = reader.previous('inbox-next-turn')?.state;
            const nextStep = reader.previous('inbox-next-step')?.state;
            const location = match.location;
            const turnStart = location.kind === 'step' ? location.turn.start?.seq : undefined;
            // An idle steer opens Step 1 without a next-turn claim in this Turn.
            // A human in that same next-step claim owns the opening instead of its notices.
            const idleSteer = location.kind === 'step' && location.step.step === 1
                && turnStart !== undefined && (nextStep?.claimSeq ?? -1) > turnStart
                && (nextTurn?.claimSeq ?? -1) < turnStart && nextStep?.claimedHuman === false
                && nextStep.currentClaimed.has(String(event.data.id));
            return {
                kind: 'context',
                waking: nextTurn?.currentClaimed.has(String(event.data.id)) === true || idleSteer,
                seq: event.seq,
                time: event.time,
                content: event.data.content,
                source: event.data.source,
                producer: contextProducer(event.data.source),
                form: contextForm(event.data.source),
            };
        }
        const claimed = reader.previous('inbox-next-step')
            ?.state.currentClaimed.has(String(event.data.id)) === true;
        return claimed
            ? {
                kind: 'steering',
                messageId: event.data.id,
                seq: event.seq,
                time: event.time,
                content: event.data.content,
                source: event.data.source,
            }
            : {
                kind: 'user',
                messageId: event.data.id,
                seq: event.seq,
                time: event.time,
                content: event.data.content,
                source: event.data.source,
            };
    },
    update: context => context.state,
    buildViewNode: (context) => {
        if (context.state === undefined)
            return null;
        const waking = context.state.kind === 'context'
            && context.start?.event.type === 'user/message'
            && context.state.waking === true;
        return chatNode(context, waking ? 'turn-trigger' : context.state.kind, context.state.seq, context.state);
    },
};
/**
 * Register the user, steering, and injected-context message contribution.
 * @param ctx - owning UI Conversation context.
 */
export function registerMessageConversationNode(ctx) {
    ctx.uiConversation.events.register(messageDefinition);
}
