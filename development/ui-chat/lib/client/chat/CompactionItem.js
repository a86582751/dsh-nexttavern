// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/CompactionItem.tsx; edit the TypeScript source.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// A compaction marker does not replace shadowed transcript rows. It is
// expandable only when the current window includes its cited summary.
import { memo, useMemo, useState } from 'react';
import { IconApiOutlineRegular, IconChevronDownOutlineRegular, IconChevronRightOutlineRegular, MarkdownText, } from '@deepseek-ai/dsh-client-ui-primitives';
import { markdownLabels } from "../markdown-labels.js";
import css from './MessageItem.module.css';
/**
 * Renders the model-history compaction marker.
 * @param props - the marker node off the snapshot cache.
 * @returns the marker row, with the summary disclosure when one is available.
 */
export const CompactionItem = memo(function CompactionItem({ node, title, fallbackSummary, t, }) {
    const [expanded, setExpanded] = useState(false);
    const labels = useMemo(() => markdownLabels(t), [t]);
    const expandable = node.summary !== null;
    const open = expandable && expanded;
    const summary = node.shadowedItemCount !== null && node.shadowedTokenCount !== null
        ? t('message.compaction.completed', {
            items: node.shadowedItemCount,
            tokens: node.shadowedTokenCount,
        })
        : fallbackSummary
            ?? (expandable ? t('message.compaction.expand') : t('message.compaction.unavailable'));
    return (_jsxs("div", { className: css.compactionRow, children: [_jsxs("button", { type: "button", className: css.compactionButton, disabled: !expandable, "aria-expanded": expandable ? open : undefined, onClick: () => { setExpanded(value => !value); }, children: [_jsxs("span", { className: css.compactionLeading, "aria-hidden": true, children: [_jsx("span", { className: css.compactionContextIcon, "data-compaction-icon": "context", children: _jsx(IconApiOutlineRegular, {}) }), _jsx("span", { className: css.compactionDisclosureIcon, "data-compaction-disclosure": open ? 'expanded' : 'collapsed', children: open ? _jsx(IconChevronDownOutlineRegular, {}) : _jsx(IconChevronRightOutlineRegular, {}) })] }), _jsx("span", { className: css.compactionTitle, children: title ?? t('message.compaction') }), _jsx("span", { className: css.compactionSep, "aria-hidden": true }), _jsx("span", { className: css.compactionSummary, children: summary })] }), open && node.summary !== null
                && _jsx("div", { className: css.compactionBody, children: _jsx(MarkdownText, { text: node.summary, labels: labels }) })] }));
});
