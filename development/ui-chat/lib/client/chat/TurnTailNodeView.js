// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/TurnTailNodeView.tsx; edit the TypeScript source.
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { memo } from 'react';
import { MessageIconActions } from "./MessageIconActions.js";
import { TurnUsagePanel } from "./TurnUsagePanel.js";
import { assistantText } from "./turn-assistant.js";
import { hasAssistantReplyContent } from "../contract/assistant-content.js";
import css from './TurnTailNodeView.module.css';
function lastContent(snapshot, turn, skipWarning) {
    const keys = snapshot.locations.getTurn(turn);
    for (let index = keys.length - 1; index >= 0; index--) {
        const node = snapshot.nodes.get(keys[index]);
        if (node === undefined || node.kind === 'turn-tail' || node.kind === 'turn-process'
            || (skipWarning && node.kind === 'turn-max-tokens'))
            continue;
        return node;
    }
    return undefined;
}
/** Turn-local actions and feature tail over the Location index, independent of Assistant placement. */
export const TurnTailNodeView = memo(function TurnTailNodeView({ node, openFile, forkAt, renderSlot, t, useChat, usePerformanceUsage, }) {
    const detailed = usePerformanceUsage(mode => mode) === 'detailed';
    const data = node.data;
    const hasLaterChatNode = useChat(snapshot => (lastContent(snapshot, data.turn, true)?.anchorSeq ?? -1) > data.seq);
    const endsWithResponse = useChat((snapshot) => {
        if (snapshot.timeline.turnOrder.at(-1) !== data.turn)
            return false;
        const last = lastContent(snapshot, data.turn, false);
        const block = last?.kind === 'assistant-step' ? last.data.blocks.findLast(candidate => (candidate.kind !== 'text' && candidate.kind !== 'reasoning') || candidate.text.trim() !== '') : undefined;
        return block !== undefined && hasAssistantReplyContent([block]);
    });
    const turn = node.location.kind === 'turn' || node.location.kind === 'step'
        ? node.location.turn
        : undefined;
    if (turn === undefined)
        return null;
    const closing = data.closing;
    const owner = { turn, seq: closing?.presentationSeq ?? data.seq, openFile };
    const tail = renderSlot('conversation.chat.turnTail', owner);
    if (closing === null) {
        const failed = renderSlot('conversation.chat.roleplay-failure-actions', { turn: data.turn, text: '' });
        return tail === null && failed === null ? null
            : _jsxs("div", { className: css.root, "data-turn-tail": data.turn, children: [tail, failed] });
    }
    // Interruption-frozen partials carry no messageId, so they address no
    // durable message and contribute no per-message actions.
    const messageId = closing.finalNode.messageId;
    const assistantActions = messageId === undefined
        ? renderSlot('conversation.chat.roleplay-failure-actions', { turn: data.turn, text: assistantText(closing.blocks) })
        : renderSlot('conversation.chat.assistant-actions', { messageId, turn: data.turn, text: assistantText(closing.blocks) });
    return (_jsxs("div", { className: css.root, "data-turn-tail": data.turn, "data-actions-reveal": endsWithResponse ? 'always' : 'hover', children: [tail, _jsx(MessageIconActions, { text: assistantText(closing.blocks), time: closing.time, clock: "end", 
                // The branch action owns boundary resolution: it sends the real
                // turn/end seq it already has, and the Host cuts exactly there.
                onBranch: () => { forkAt(data.seq); }, branchUnavailable: data.branchUnavailable || hasLaterChatNode, className: css.actions, extraActions: assistantActions, usageAction: detailed && data.tokenUsage !== undefined
                    ? _jsx(TurnUsagePanel, { usage: data.tokenUsage, t: t })
                    : null, t: t })] }));
});
