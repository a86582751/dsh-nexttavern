// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/CompactionCommandCard.tsx; edit the TypeScript source.
import { jsx as _jsx } from "react/jsx-runtime";
import { CompactionItem } from "./CompactionItem.js";
import { GenericCommandCard } from "./GenericCommandCard.js";
/** Render one manual compaction lifecycle without duplicating its checkpoint marker. */
export function CompactionCommandCard({ node, compaction, t }) {
    if (compaction !== undefined) {
        return (_jsx(CompactionItem, { node: compaction, title: t('message.compaction.commandTitle'), fallbackSummary: node.outcome?.text ?? null, t: t }));
    }
    if (node.outcome !== null)
        return _jsx(GenericCommandCard, { node: node, t: t });
    return _jsx(GenericCommandCard, { node: node, t: t, runningSummary: t('message.compaction.running') });
}
