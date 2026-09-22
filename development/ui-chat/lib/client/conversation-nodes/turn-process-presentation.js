// Generated from runtime/alpha3/compat/ui-chat/src/client/conversation-nodes/turn-process-presentation.ts; edit the TypeScript source.
import { isVisibleChatNode } from "../contract/chat-visibility.js";
import { turnProcessMember } from "../contract/turn-process.js";
function nodeTurn(node) {
    const location = node?.location;
    return location?.kind === 'turn' || location?.kind === 'step' ? location.turn.turn : undefined;
}
function samePresentation(left, right) {
    return left === right || (left !== undefined && right !== undefined
        && left.spec === right.spec
        && left.turn === right.turn
        && left.turnStarted === right.turnStarted
        && left.turnClosed === right.turnClosed
        && left.hasExternalProcess === right.hasExternalProcess
        && left.hasInterleavedInput === right.hasInterleavedInput
        && left.compactAnswer === right.compactAnswer);
}
function derivePresentation(turn, locations, nodes) {
    const keys = locations.getTurn(turn);
    const control = keys
        .map(key => nodes.get(key))
        .find((node) => node?.kind === 'turn-process');
    if (control === undefined)
        return undefined;
    const spec = control.data;
    const location = control.location;
    if (location.kind !== 'turn' && location.kind !== 'step')
        return undefined;
    let openingHumanAnchor;
    for (const key of keys) {
        const node = nodes.get(key);
        if ((node?.kind === 'user' || node?.kind === 'steering' || node?.kind === 'turn-trigger')
            && (spec.controlAnchorSeq === location.turn.start?.seq || node.anchorSeq < spec.controlAnchorSeq)) {
            openingHumanAnchor = Math.max(openingHumanAnchor ?? node.anchorSeq, node.anchorSeq);
        }
    }
    let hasExternalProcess = false;
    let hasInterleavedInput = false;
    let compactAnswer = true;
    for (const key of keys) {
        const node = nodes.get(key);
        if (node === undefined || !isVisibleChatNode(node) || node.kind === 'turn-process')
            continue;
        if ((node.kind === 'user' || node.kind === 'steering' || node.kind === 'turn-trigger')
            && (openingHumanAnchor === undefined || node.anchorSeq > openingHumanAnchor)) {
            hasInterleavedInput = true;
            if (spec.answerAnchorSeq === null || node.anchorSeq < spec.answerAnchorSeq)
                compactAnswer = false;
        }
        if (!turnProcessMember(node, spec))
            continue;
        if (node.kind !== 'assistant-step' || spec.answerStep === null || node.data.step !== spec.answerStep) {
            hasExternalProcess = true;
        }
    }
    return {
        turn,
        spec,
        turnStarted: location.turn.start !== undefined,
        turnClosed: location.turn.status === 'closed',
        hasExternalProcess,
        hasInterleavedInput,
        compactAnswer,
    };
}
/** Mutable projection of cross-Node process layout facts by Turn. */
export class ChatTurnProcessProjector {
    presentations = new Map();
    /**
     * Read the retained process presentation for a Node's Turn.
     * @param node - Current Chat Node.
     * @returns The Turn's process presentation, when present.
     */
    get(node) {
        const turn = nodeTurn(node);
        return turn === undefined ? undefined : this.presentations.get(turn);
    }
    /**
     * Replace every projected Turn.
     * @param order - visible Chat Node order.
     * @param locations - current Chat Location index.
     * @param nodes - current Chat Node store.
     * @returns Turns whose process presentation changed.
     */
    replace(order, locations, nodes) {
        const turns = new Set();
        for (const key of order) {
            const turn = nodeTurn(nodes.get(key));
            if (turn !== undefined)
                turns.add(turn);
        }
        const changed = new Set();
        for (const turn of new Set([...this.presentations.keys(), ...turns])) {
            if (this.set(turn, turns.has(turn) ? derivePresentation(turn, locations, nodes) : undefined)) {
                changed.add(turn);
            }
        }
        return changed;
    }
    /**
     * Recompute selected Turns after incremental Node changes.
     * @param turns - affected Turn numbers.
     * @param locations - current Chat Location index.
     * @param nodes - current Chat Node store.
     * @returns Turns whose process presentation changed.
     */
    update(turns, locations, nodes) {
        const changed = new Set();
        for (const turn of turns) {
            if (this.set(turn, derivePresentation(turn, locations, nodes)))
                changed.add(turn);
        }
        return changed;
    }
    set(turn, next) {
        const current = this.presentations.get(turn);
        if (samePresentation(current, next))
            return false;
        if (next === undefined)
            this.presentations.delete(turn);
        else
            this.presentations.set(turn, next);
        return true;
    }
}
