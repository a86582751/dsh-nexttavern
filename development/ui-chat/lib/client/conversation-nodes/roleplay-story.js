// Generated from runtime/alpha3/compat/ui-chat/src/client/conversation-nodes/roleplay-story.ts; edit the TypeScript source.
import { hasAssistantReplyContent } from "../contract/assistant-content.js";
export function roleplayPhase(event) {
    if (event.type !== 'user/message' || event.surfaceOp !== 'append')
        return undefined;
    const source = event.data.source;
    if (source.kind !== 'roleplay-tasks' || source.form !== 'phase' || source.schemaVersion !== 1
        || source.stage !== 'after-story' || typeof source.turn !== 'number' || !Number.isSafeInteger(source.turn)
        || source.turn < 1 || typeof source.storySeq !== 'number' || !Number.isSafeInteger(source.storySeq)
        || source.storySeq < 0 || source.storySeq >= event.seq)
        return undefined;
    return { turn: source.turn, storySeq: source.storySeq, markerSeq: event.seq };
}
export function phaseFromMatches(matches) {
    for (const match of matches) {
        const phase = roleplayPhase(match.event);
        if (phase !== undefined)
            return phase;
    }
    return undefined;
}
export function roleplayStory(turn, proof) {
    if (proof === undefined || proof.turn !== turn.turn
        || (turn.start !== undefined && proof.storySeq <= turn.start.seq)
        || (turn.end !== undefined && proof.markerSeq >= turn.end.seq))
        return null;
    for (const step of turn.steps) {
        const data = step.data.get('assistant-step');
        if (data?.finalNode === undefined || data.finalNode.seq !== proof.storySeq)
            continue;
        if (data.finalNode.interrupted || !hasAssistantReplyContent(data.blocks)
            || data.blocks.some(block => block.kind === 'tool-call'))
            return null;
        return data;
    }
    // The original may be outside the loaded window. Never substitute a later
    // maintenance answer; paging the original will make this proof resolvable.
    return null;
}
