// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/TurnUsagePanel.tsx; edit the TypeScript source.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** Completed-Turn token usage action and its accounting details dialog. */
import { createPortal } from 'react-dom';
import { IconDatabaseOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { formatCacheHitPercent, formatExactTokens, formatTokens } from "./token-format.js";
import { MEASURE_STYLE, useStatDialog } from "./stat-dialog.js";
import css from './TurnUsagePanel.module.css';
import dialogCss from './stat-dialog.module.css';
function formatCompactCount(value, t) {
    return t('message.turnUsage.count', { count: formatTokens(value, t) });
}
function formatExactCount(value, t) {
    return t('message.turnUsage.count', { count: formatExactTokens(value, t) });
}
/**
 * Turn-usage IconActions pill with a click-open Turn-usage details dialog.
 * @param props - Turn usage buckets and locale seat.
 * @returns The trigger and, while open, its portaled dialog anchored above the trigger.
 */
export function TurnUsagePanel({ usage, t }) {
    const { open, setOpen, rootRef, panelRef, pos } = useStatDialog();
    const cacheHit = usage.cacheReadTokens === undefined
        ? null
        : formatCacheHitPercent(usage.cacheReadTokens, usage.totalTokens - usage.outputTokens, 1);
    const total = formatCompactCount(usage.totalTokens, t);
    const routes = usage.routes?.map(route => `${route.provider}/${route.model}`).join(', ') ?? '';
    return (_jsxs("span", { ref: rootRef, className: css.root, children: [_jsxs("button", { type: "button", className: css.trigger, "aria-haspopup": "dialog", "aria-expanded": open, onClick: () => { setOpen(!open); }, children: [_jsx(IconDatabaseOutlineRegular, {}), _jsx("span", { className: css.label, children: t('message.turnUsage.consumed', { total }) })] }), open && createPortal(_jsxs("div", { ref: panelRef, className: dialogCss.panel, role: "dialog", "aria-label": t('message.turnUsage.title'), style: pos ?? MEASURE_STYLE, children: [_jsxs("div", { className: dialogCss.title, children: [_jsxs("span", { className: dialogCss.titleLabel, children: [_jsx(IconDatabaseOutlineRegular, {}), t('message.turnUsage.title')] }), _jsx("span", { className: dialogCss.titleValue, children: formatExactCount(usage.totalTokens, t) })] }), _jsx("div", { className: dialogCss.titleRule, "aria-hidden": true }), _jsxs("dl", { className: dialogCss.details, "data-turn-usage-details": true, children: [routes !== '' && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.model') }), _jsx("dd", { className: dialogCss.route, children: routes })] })), cacheHit !== null && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.cacheHit') }), _jsx("dd", { children: `${cacheHit}%` })] })), _jsx("dt", { children: t('message.turnUsage.input') }), _jsx("dd", { children: formatExactCount(usage.uncachedInputTokens, t) }), usage.cacheReadTokens !== undefined && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.cacheRead') }), _jsx("dd", { children: formatExactCount(usage.cacheReadTokens, t) })] })), usage.cacheWriteTokens !== undefined && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.cacheWrite') }), _jsx("dd", { children: formatExactCount(usage.cacheWriteTokens, t) })] })), _jsx("dt", { children: t('message.turnUsage.output') }), _jsxs("dd", { children: [formatExactCount(usage.outputTokens, t), usage.reasoningTokens !== undefined && (_jsx("span", { className: dialogCss.reasoning, children: t('message.turnUsage.reasoning', { tokens: formatExactCount(usage.reasoningTokens, t) }) }))] })] })] }), document.body)] }));
}
