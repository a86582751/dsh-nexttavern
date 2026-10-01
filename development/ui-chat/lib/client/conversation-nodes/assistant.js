// Generated from runtime/alpha3/compat/ui-chat/src/client/conversation-nodes/assistant.ts; edit the TypeScript source.
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-session/surface';
import { CHAT_SYNTHETIC_SEQ_OFFSETS, chatNode } from "./common.js";
import { emptyAssistantBlock, isTokenDelta, toAssistantBlock, toAssistantBlocks, } from "./event-projection.js";
function initialState(turn, step) {
    return {
        turn,
        step,
        blocks: [],
        visibleBlocks: 0,
        firstVisibleSeq: undefined,
        firstVisibleTime: undefined,
        firstTokenTime: undefined,
        final: undefined,
        usage: undefined,
    };
}
function compactBlocks(blocks) {
    return blocks.filter((block) => block !== undefined);
}
function blockIsVisible(block) {
    if (block === undefined || block.kind === 'tool-call')
        return false;
    if (block.kind === 'text' || block.kind === 'reasoning')
        return block.text.trim() !== '';
    return true;
}
function countVisibleBlocks(blocks) {
    let count = 0;
    for (const block of blocks)
        if (blockIsVisible(block))
            count++;
    return count;
}
function hasVisibleContent(blocks) {
    return blocks.some(blockIsVisible);
}
function hasInterruptionEvidence(blocks) {
    return blocks.some((block) => {
        if (block.kind === 'text' || block.kind === 'reasoning')
            return block.text.trim() !== '';
        return true;
    });
}
function resetForRetry(state) {
    return {
        ...initialState(state.turn, state.step),
        firstTokenTime: state.firstTokenTime,
    };
}
function updateChunk(state, chunk, seq, time) {
    const blocks = [...state.blocks];
    let changedIndex = -1;
    let previousVisible = false;
    switch (chunk.type) {
        case 'block-start':
            changedIndex = chunk.index;
            previousVisible = blockIsVisible(blocks[chunk.index]);
            blocks[chunk.index] = emptyAssistantBlock(chunk.blockType);
            break;
        case 'text-delta': {
            const previous = blocks[chunk.index];
            changedIndex = chunk.index;
            previousVisible = blockIsVisible(previous);
            blocks[chunk.index] = { kind: 'text', text: (previous?.kind === 'text' ? previous.text : '') + chunk.text };
            break;
        }
        case 'reasoning-delta': {
            const previous = blocks[chunk.index];
            changedIndex = chunk.index;
            previousVisible = blockIsVisible(previous);
            blocks[chunk.index] = { kind: 'reasoning', text: (previous?.kind === 'reasoning' ? previous.text : '') + chunk.text };
            break;
        }
        case 'tool-call-delta': {
            const previous = blocks[chunk.index];
            changedIndex = chunk.index;
            previousVisible = blockIsVisible(previous);
            const base = previous?.kind === 'tool-call'
                ? previous
                : { kind: 'tool-call', callId: '', name: '', argsRaw: '' };
            blocks[chunk.index] = {
                kind: 'tool-call',
                callId: base.callId || String(chunk.id),
                name: chunk.name ?? base.name,
                argsRaw: base.argsRaw + chunk.argumentsDelta,
            };
            break;
        }
        case 'block-end':
            changedIndex = chunk.index;
            previousVisible = blockIsVisible(blocks[chunk.index]);
            blocks[chunk.index] = toAssistantBlock(chunk.block);
            break;
        case 'usage':
            return { ...state, usage: chunk.usage };
        default:
            return state;
    }
    const visibleBlocks = state.visibleBlocks
        - Number(previousVisible)
        + Number(blockIsVisible(blocks[changedIndex]));
    const firstToken = isTokenDelta(chunk);
    return {
        ...state,
        blocks,
        visibleBlocks,
        ...visibleBlocks > 0 && state.firstVisibleSeq === undefined
            ? { firstVisibleSeq: seq, firstVisibleTime: time }
            : {},
        ...firstToken && state.firstTokenTime === undefined
            ? { firstTokenTime: time }
            : {},
    };
}
function settleMessage(state, match, event) {
    // Model-only replacements must never change transcript identity, including cold replay.
    if (!isAppendSurfaceEvent(event))
        return state;
    const blocks = toAssistantBlocks(event.data.message.content);
    return {
        ...state,
        blocks,
        visibleBlocks: countVisibleBlocks(blocks),
        final: match,
        usage: event.data.usage,
    };
}
function closedBoundary(location) {
    if (location.kind === 'step' && location.step.status === 'closed' && location.step.end !== undefined) {
        return location.step.end;
    }
    if ((location.kind === 'step' || location.kind === 'turn')
        && location.turn.status === 'closed' && location.turn.end !== undefined) {
        return location.turn.end;
    }
    return undefined;
}
function finalNode(state, context) {
    const final = state.final;
    if (final?.event.type === 'assistant/message') {
        const event = final.event;
        return {
            kind: 'assistant',
            seq: event.seq,
            messageId: event.data.message.id,
            time: event.time,
            turn: state.turn,
            step: state.step,
            blocks: toAssistantBlocks(event.data.message.content),
            usage: event.data.usage,
            timing: {
                stepStartTime: context.start?.event.time ?? null,
                firstTokenTime: state.firstTokenTime ?? null,
                completedTime: event.time,
            },
            ...event.data.interrupted === true ? { interrupted: true } : {},
        };
    }
    const location = context.start?.location ?? context.matches.at(-1)?.location;
    const boundary = location === undefined ? undefined : closedBoundary(location);
    if (boundary === undefined)
        return undefined;
    const blocks = compactBlocks(state.blocks);
    if (!hasInterruptionEvidence(blocks))
        return undefined;
    return {
        kind: 'assistant',
        seq: boundary.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.interruptedAssistant,
        time: boundary.time,
        turn: state.turn,
        step: state.step,
        blocks,
        interrupted: true,
    };
}
function fallbackState(context) {
    let state;
    for (const match of context.matches) {
        if (match.event.type === 'assistant/live-chunk') {
            state ??= initialState(match.event.data.turn, match.event.data.step);
            state = updateChunk(state, match.event.data.chunk, match.event.seq, match.event.time);
            continue;
        }
        if (match.event.type === 'assistant/message') {
            state ??= initialState(match.event.data.turn, match.event.data.step);
            state = settleMessage(state, match, match.event);
            continue;
        }
        if (match.event.type === 'llm/retry' && state !== undefined) {
            state = resetForRetry(state);
        }
    }
    return state;
}
function projectAssistant(context) {
    const state = context.state ?? fallbackState(context);
    if (state === undefined)
        return undefined;
    const settled = finalNode(state, context);
    const blocks = settled?.blocks ?? compactBlocks(state.blocks);
    const visible = settled === undefined ? state.visibleBlocks > 0 : hasVisibleContent(blocks);
    const status = settled?.interrupted === true
        ? 'interrupted'
        : settled === undefined ? 'running' : 'settled';
    const anchorSeq = (settled?.interrupted === true ? settled.seq : state.firstVisibleSeq ?? settled?.seq)
        ?? context.matches[0]?.event.seq ?? 0;
    const time = state.firstVisibleTime ?? settled?.time ?? context.matches[0]?.event.time ?? 0;
    return {
        anchorSeq,
        visible,
        settled,
        data: {
            status,
            turn: state.turn,
            step: state.step,
            blocks,
            time,
            presentationSeq: anchorSeq,
            ...state.usage === undefined ? {} : { usage: state.usage },
            ...settled === undefined ? {} : { finalNode: settled },
        },
    };
}
function publishedAssistantData(context) {
    const location = context.start?.location ?? context.matches.at(-1)?.location;
    return location?.kind === 'step' ? location.step.data.get('assistant-step') : undefined;
}
/** Per-step Assistant lifecycle; materialized keys survive cleared stream content as hidden Nodes. */
export const assistantDefinition = {
    kind: 'assistant-step',
    target: 'chat',
    match: (event) => {
        if (event.type === 'step/start')
            return { id: `${event.data.turn}:${event.data.step}`, role: 'start' };
        if (event.type === 'assistant/live-chunk'
            || (event.type === 'assistant/message' && isAppendSurfaceEvent(event))) {
            return { id: `${event.data.turn}:${event.data.step}`, role: 'update' };
        }
        if (event.type === 'llm/retry') {
            return { id: `${event.data.turn}:${event.data.step}`, role: 'update' };
        }
        return null;
    },
    start: (_context, match) => {
        if (match.event.type !== 'step/start')
            throw new Error('assistant-step start requires step/start');
        return initialState(match.event.data.turn, match.event.data.step);
    },
    update: (context, match) => {
        if (match.event.type === 'assistant/live-chunk') {
            return updateChunk(context.state, match.event.data.chunk, match.event.seq, match.event.time);
        }
        if (match.event.type === 'assistant/message')
            return settleMessage(context.state, match, match.event);
        if (match.event.type === 'llm/retry') {
            return resetForRetry(context.state);
        }
        return context.state;
    },
    publication: (match) => {
        if (match.event.type === 'step/start')
            return 'none';
        if (match.event.type !== 'assistant/live-chunk')
            return 'immediate';
        const type = match.event.data.chunk.type;
        return type === 'usage' || type === 'finish' ? 'none' : 'animation-frame';
    },
    buildLocationData: (context, scope) => {
        if (scope !== 'step')
            return null;
        const projected = projectAssistant(context);
        if (projected === undefined)
            return null;
        return {
            kind: 'step',
            turn: projected.data.turn,
            step: projected.data.step,
            key: 'assistant-step',
            value: projected.data,
        };
    },
    buildViewNode: (context) => {
        const current = context.current.get('chat');
        const state = context.state ?? fallbackState(context);
        const data = publishedAssistantData(context);
        if (state === undefined || data === undefined) {
            return current == null ? null : { ...current, visibility: 'hidden' };
        }
        const settled = data.finalNode;
        const visible = settled === undefined ? state.visibleBlocks > 0 : hasVisibleContent(data.blocks);
        if (settled === undefined && !visible && current == null)
            return null;
        const anchorSeq = data.presentationSeq;
        return chatNode(context, 'assistant-step', anchorSeq, data, {
            visibility: settled?.interrupted === true || visible ? 'visible' : 'hidden',
        });
    },
};
/**
 * Register the Assistant lifecycle business contribution.
 * @param ctx - owning UI Conversation context.
 */
export function registerAssistantConversationNode(ctx) {
    ctx.uiConversation.events.register(assistantDefinition);
}
