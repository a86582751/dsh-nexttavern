// Generated from runtime/alpha3/compat/ui-chat/src/client/contract/turn-process.ts; edit the TypeScript source.
const TURN_PROCESS_INDEPENDENT_KIND_LIST = [
    'system-prompt',
    'user',
    'steering',
    'turn-trigger',
    'turn-process',
    'turn-error',
    'turn-max-tokens',
    'turn-tail',
];
/** Chat Node kinds that remain independent of a Turn's process disclosure. */
export const TURN_PROCESS_INDEPENDENT_KINDS = new Set(TURN_PROCESS_INDEPENDENT_KIND_LIST);
/**
 * Compare immutable Turn-process specifications by their published fields.
 * @param left - previous specification.
 * @param right - next specification.
 * @returns whether both values describe the same process presentation.
 */
export function sameTurnProcessSpec(left, right) {
    return left.turn === right.turn
        && left.controlAnchorSeq === right.controlAnchorSeq
        && left.processStartSeq === right.processStartSeq
        && left.answerAnchorSeq === right.answerAnchorSeq
        && left.answerStep === right.answerStep
        && left.maintenanceStartSeq === right.maintenanceStartSeq
        && left.inlineReasoning === right.inlineReasoning
        && left.messageCount === right.messageCount
        && left.toolCallCount === right.toolCallCount
        && left.subagentCount === right.subagentCount;
}
export function turnProcessMember(node, spec) {
    if (TURN_PROCESS_INDEPENDENT_KINDS.has(node.kind)
        && !(node.kind === 'system-prompt' && spec.maintenanceStartSeq !== null))
        return false;
    return node.anchorSeq >= spec.processStartSeq && (spec.answerAnchorSeq === null
        || node.anchorSeq < spec.answerAnchorSeq
        || (spec.maintenanceStartSeq !== null && node.anchorSeq >= spec.maintenanceStartSeq));
}
/**
 * Recognize the shipped subagent delegation name and its configured variants.
 * Control tools use distinct names such as `send_message` and `list_agents`.
 * @param name - durable Tool-call name.
 * @returns whether the call creates or forks a subagent.
 */
export function isSubagentDelegationTool(name) {
    return name === 'subagent' || name.startsWith('subagent_');
}
/**
 * Keep live, stopped, and failed Turns open.
 * @param node - Node carrying the owning Turn.
 * @returns whether whole-Turn collapse is unavailable.
 */
export function turnProcessAlwaysOpen(node) {
    const location = node?.location;
    if (location?.kind !== 'turn' && location?.kind !== 'step')
        return false;
    const reason = location.turn.end?.data.reason.kind;
    return location.turn.status === 'open' || reason === 'aborted' || reason === 'error';
}
