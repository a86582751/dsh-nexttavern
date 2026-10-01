// Generated from runtime/alpha3/compat/ui-chat/src/client/conversation-nodes/turn-tail.ts; edit the TypeScript source.
import { deriveTurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client';
import { CHAT_SYNTHETIC_SEQ_OFFSETS, chatNode } from "./common.js";
import { phaseFromMatches, roleplayPhase, roleplayStory } from "./roleplay-story.js";
function isSessionEvent(event) {
    return event.type !== 'assistant/live-chunk';
}
function turnCoordinates(event) {
    if (event.type === 'assistant/message'
        || event.type === 'assistant/attempt'
        || event.type === 'assistant/live-chunk'
        || event.type === 'step/start'
        || event.type === 'step/end') {
        return { turn: event.data.turn, step: event.data.step };
    }
    if (event.type === 'llm/retry' || event.type === 'llm/retry-started') {
        return { turn: event.data.turn, step: event.data.step };
    }
    return undefined;
}
function turnLocation(context) {
    // A tail page can begin with a phase marker before the first loaded step.
    // That marker has no turn location yet; later matched boundaries still do.
    const ownTurn = context.state?.turn ?? Number(context.id);
    const location = context.start?.location ?? context.matches.find(match => (match.location.kind === 'turn' || match.location.kind === 'step')
        && match.location.turn.turn === ownTurn)?.location;
    return location?.kind === 'turn' || location?.kind === 'step' ? location.turn : undefined;
}
function hasText(data) {
    return data.finalNode !== undefined
        && data.blocks.some(block => block.kind === 'text' && block.text.trim() !== '');
}
function tailData(context) {
    const end = context.state === undefined
        ? context.matches.find(match => match.event.type === 'turn/end')
        : context.state.end;
    if (end?.event.type !== 'turn/end')
        return null;
    const turn = turnLocation(context);
    if (turn === undefined)
        return null;
    const assistants = turn.steps
        .map(step => step.data.get('assistant-step'))
        .filter((candidate) => candidate !== undefined);
    const finalized = assistants
        .filter((candidate) => candidate.finalNode !== undefined)
        .sort((left, right) => left.presentationSeq - right.presentationSeq);
    const proof = phaseFromMatches(context.matches);
    const story = roleplayStory(turn, proof);
    const closing = proof === undefined ? finalized.findLast(hasText) ?? null : story;
    let latestTranscriptSeq = finalized.at(-1)?.presentationSeq;
    for (const match of context.matches) {
        const event = match.event;
        const candidate = event.type === 'tool/call'
            || (event.type === 'tool/result' && event.surfaceOp === 'append')
            || (event.type === 'turn/end' && event.data.reason.kind === 'error')
            || event.type === 'llm/retry'
            ? event.seq
            : undefined;
        if (candidate !== undefined && (latestTranscriptSeq === undefined || candidate > latestTranscriptSeq)) {
            latestTranscriptSeq = candidate;
        }
    }
    if (story !== null)
        latestTranscriptSeq = story.presentationSeq;
    const tokenUsage = context.start?.event.type === 'turn/start'
        ? deriveTurnTokenUsage(context.matches.map(match => match.event).filter(isSessionEvent))
        : undefined;
    return {
        turn: end.event.data.turn,
        seq: end.event.seq,
        time: end.event.time,
        closing,
        branchUnavailable: closing === null || latestTranscriptSeq !== closing.presentationSeq,
        ...tokenUsage === undefined ? {} : { tokenUsage },
    };
}
/** Completed-turn footer Definition independent of any Assistant row. */
export const turnTailDefinition = {
    kind: 'turn-tail',
    target: 'chat',
    match: (event) => {
        if (event.type === 'turn/start')
            return { id: String(event.data.turn), role: 'start' };
        if (event.type === 'turn/end')
            return { id: String(event.data.turn), role: 'update' };
        const phase = roleplayPhase(event);
        if (phase !== undefined)
            return { id: String(phase.turn), role: 'update' };
        if (event.type === 'tool/call' || event.type === 'tool/result') {
            return { id: String(event.data.turn), role: 'update' };
        }
        const coordinates = turnCoordinates(event);
        if (coordinates !== undefined)
            return { id: String(coordinates.turn), role: 'update' };
        return null;
    },
    start: (_context, match) => {
        if (match.event.type !== 'turn/start')
            throw new Error('turn-tail start requires turn/start');
        return { turn: match.event.data.turn };
    },
    update: (context, match) => match.event.type === 'turn/end'
        ? { ...context.state, end: match }
        : context.state,
    publication: match => match.event.type === 'turn/end' ? 'immediate' : 'none',
    buildLocationData: (context, scope) => {
        if (scope !== 'turn')
            return null;
        const value = tailData(context);
        return value === null ? null : {
            kind: 'turn',
            turn: value.turn,
            key: 'turn-tail',
            value,
        };
    },
    buildViewNode: (context) => {
        const turn = turnLocation(context);
        const data = turn?.data.get('turn-tail');
        return data === undefined ? null : chatNode(context, 'turn-tail', data.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.finalizedFollowup, data);
    },
};
/**
 * Register completed-Turn footer data and its Chat node contribution.
 * @param ctx - owning UI Conversation context.
 */
export function registerTurnTailConversationNode(ctx) {
    ctx.uiConversation.events.register(turnTailDefinition);
}
