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
/** Context presentation shared by user-role injections and developer messages. */
function contextMessage(event, message) {
    return {
        kind: 'context',
        seq: event.seq,
        time: event.time,
        content: message.content,
        source: message.source,
        producer: contextProducer(message.source),
        form: contextForm(message.source),
    };
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
        return null;
    },
    start: (_context, match, reader) => {
        const event = match.event;
        if (event.type !== 'user/message')
            throw new Error('input-message start requires user/message');
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
                ...contextMessage(event, event.data),
                waking: nextTurn?.currentClaimed.has(String(event.data.id)) === true || idleSteer,
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
/** Developer history uses the input-message lifecycle and context presentation. */
export const developerMessageDefinition = {
    ...messageDefinition,
    kind: 'developer-message',
    match: event => event.type === 'developer/message'
        ? { id: String(event.data.message.id), role: 'start' }
        : null,
    start: (_context, match) => {
        const event = match.event;
        if (event.type !== 'developer/message')
            throw new Error('developer-message start requires developer/message');
        return contextMessage(event, event.data.message);
    },
};
/**
 * Register user, steering, injected-context, and developer message contributions.
 * @param ctx - owning UI Conversation context.
 */
export function registerMessageConversationNode(ctx) {
    ctx.uiConversation.events.register(messageDefinition);
    ctx.uiConversation.events.register(developerMessageDefinition);
}
