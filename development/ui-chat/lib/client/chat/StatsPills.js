// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/StatsPills.tsx; edit the TypeScript source.
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// Composer statistics: Compact exposes speed and cache hit as plain readings;
// Detailed exposes counts and totals with time and token-usage dialogs.
// Settled-node identity prevents stream-delta updates from rerendering the row.
// Mounted on 'conversation.composer.dock' so it sticks with the composer in the
// active conversation scrollport (see ConversationRoot data-conversation-scroll).
import { memo, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconDatabaseOutlineRegular, IconGaugeOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { formatTokensPerSecond } from "./message-chrome.js";
import { assistantStepReading } from "../contract/turn-metrics.js";
import { formatCacheHitPercent, formatExactTokens, formatTokens } from "./token-format.js";
import { MEASURE_STYLE, useStatDialog } from "./stat-dialog.js";
import css from './StatsPills.module.css';
import dialogCss from './stat-dialog.module.css';
/**
 * Fold assistant and tool-result nodes into window-scoped display totals —
 * the FALLBACK for assemblies without the `sessionStats` projection.
 *
 * Every displayed figure rides that durable whole-log projection (and token
 * accounting rides `tokenUsage`) because the window is paged and compaction
 * rewrites it; this fold answers "what is on screen" only when no projection
 * value is served. Its field names deliberately mirror the projection's so
 * the two swap wholesale.
 * @param nodes - snapshot nodes.
 * @returns fallback counts and summed wall times.
 */
export function deriveStats(nodes) {
    const turns = new Set();
    let steps = 0;
    let llmMs = 0;
    let toolMs = 0;
    let ttftMs = 0;
    let ttftSteps = 0;
    let decodeMs = 0;
    let decodeTokens = 0;
    for (const node of nodes) {
        if (node.kind === 'tool-result') {
            if (node.callTime !== null)
                toolMs += Math.max(0, node.time - node.callTime);
            continue;
        }
        if (node.kind !== 'assistant')
            continue;
        turns.add(node.turn);
        steps += 1;
        if (node.timing !== undefined && node.timing.stepStartTime !== null) {
            llmMs += Math.max(0, node.timing.completedTime - node.timing.stepStartTime);
        }
        const reading = assistantStepReading(node);
        if (reading.ttftMs !== null) {
            ttftMs += reading.ttftMs;
            ttftSteps += 1;
        }
        if (reading.decodeMs !== null && reading.outputTokens !== null) {
            decodeMs += reading.decodeMs;
            decodeTokens += reading.outputTokens;
        }
    }
    return { turns: turns.size, steps, llmMs, toolMs, ttftMs, ttftSteps, decodeMs, decodeTokens };
}
/**
 * Compact duration: 45.2s under a minute, 2m42s from there on.
 * @param ms - duration in milliseconds.
 * @returns display string.
 */
export function formatDuration(ms, t) {
    const s = ms / 1_000;
    if (s < 60)
        return t('duration.compactSeconds', { seconds: Math.round(s * 10) / 10 });
    const whole = Math.round(s);
    return t('duration.compactMinutes', {
        minutes: Math.floor(whole / 60),
        seconds: whole % 60,
    });
}
/**
 * Display-ready cache-hit share of prompt-side input over the whole durable log.
 * @param usage - the session's token-usage projection value.
 * @returns integer text when integer rounding stays below 100, otherwise the
 * minimum decimal precision that still rounds below 100; a full hit returns
 * 100, and no billed input returns null.
 */
export function cacheHitPercent(usage) {
    const denominator = billedInputTokens(usage);
    return formatCacheHitPercent(usage.cacheReadTokens, denominator);
}
/**
 * Sum the three disjoint prompt-side billing buckets.
 * @param usage - the session's token-usage projection value.
 * @returns billed input tokens.
 */
export function billedInputTokens(usage) {
    return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}
function exactCount(value, t) {
    return t('message.turnUsage.count', { count: formatExactTokens(value, t) });
}
function TimePill({ stats, t, dialog }) {
    const { open, setOpen, rootRef, panelRef, pos } = useStatDialog(dialog);
    const counts = t('stats.counts', { turns: stats.turns, steps: stats.steps });
    const tps = stats.decodeMs > 0
        ? t('message.tokensPerSecond', {
            tps: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1_000)),
        })
        : null;
    const label = (_jsxs("span", { className: css.label, children: [counts, tps !== null && (_jsxs(_Fragment, { children: [_jsx("span", { className: css.sep, "aria-hidden": true, children: "\u00B7" }), tps] }))] }));
    // A window without one timed figure has no dialog rows to show, so the pill
    // stays a plain reading instead of a button opening an empty dialog.
    if (stats.llmMs <= 0 && stats.toolMs <= 0 && stats.ttftSteps <= 0 && stats.decodeMs <= 0) {
        return (_jsx("span", { className: css.anchor, children: _jsxs("span", { className: css.pill, children: [_jsx(IconGaugeOutlineRegular, {}), label] }) }));
    }
    return (_jsxs("span", { ref: rootRef, className: css.anchor, children: [_jsxs("button", { type: "button", className: css.pill, "aria-haspopup": "dialog", "aria-expanded": open, "aria-label": tps === null ? counts : `${counts} · ${tps}`, onClick: () => { setOpen(!open); }, children: [_jsx(IconGaugeOutlineRegular, {}), label] }), open && createPortal(_jsxs("div", { ref: panelRef, className: dialogCss.panel, role: "dialog", "aria-label": t('stats.dialog.title'), style: pos ?? MEASURE_STYLE, children: [_jsx("div", { className: dialogCss.title, children: _jsxs("span", { className: dialogCss.titleLabel, children: [_jsx(IconGaugeOutlineRegular, {}), t('stats.dialog.title')] }) }), _jsx("div", { className: dialogCss.titleRule, "aria-hidden": true }), _jsxs("dl", { className: dialogCss.details, "data-session-stats-details": true, children: [stats.llmMs > 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('stats.dialog.llmTime') }), _jsx("dd", { children: formatDuration(stats.llmMs, t) })] })), stats.toolMs > 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('stats.dialog.toolTime') }), _jsx("dd", { children: formatDuration(stats.toolMs, t) })] })), stats.ttftSteps > 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('stats.dialog.ttft') }), _jsx("dd", { children: formatDuration(stats.ttftMs / stats.ttftSteps, t) })] })), stats.decodeMs > 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('stats.dialog.speed') }), _jsx("dd", { children: t('message.tokensPerSecond', {
                                            tps: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1_000)),
                                        }) })] }))] })] }), document.body)] }));
}
function UsagePill({ usage, t, dialog }) {
    const { open, setOpen, rootRef, panelRef, pos } = useStatDialog(dialog);
    // Same aggregate as the Turn pill's totalTokens: every prompt-side billing bucket plus output.
    const total = billedInputTokens(usage) + usage.outputTokens;
    const totalText = t('message.turnUsage.count', { count: formatTokens(total, t) });
    const cacheHit = cacheHitPercent(usage);
    const cacheHitText = cacheHit !== null ? t('stats.cacheHit', { percent: cacheHit }) : null;
    return (_jsxs("span", { ref: rootRef, className: css.anchor, children: [_jsxs("button", { type: "button", className: css.pill, "aria-haspopup": "dialog", "aria-expanded": open, "aria-label": cacheHitText === null ? totalText : `${totalText} · ${cacheHitText}`, onClick: () => { setOpen(!open); }, children: [_jsx(IconDatabaseOutlineRegular, {}), _jsxs("span", { className: css.label, children: [totalText, cacheHitText !== null && (_jsxs(_Fragment, { children: [_jsx("span", { className: css.sep, "aria-hidden": true, children: "\u00B7" }), cacheHitText] }))] })] }), open && createPortal(_jsxs("div", { ref: panelRef, className: dialogCss.panel, role: "dialog", "aria-label": t('stats.dialog.usageTitle'), style: pos ?? MEASURE_STYLE, children: [_jsxs("div", { className: dialogCss.title, children: [_jsxs("span", { className: dialogCss.titleLabel, children: [_jsx(IconDatabaseOutlineRegular, {}), t('stats.dialog.usageTitle')] }), _jsx("span", { className: dialogCss.titleValue, children: exactCount(total, t) })] }), _jsx("div", { className: dialogCss.titleRule, "aria-hidden": true }), _jsxs("dl", { className: dialogCss.details, "data-session-stats-usage": true, children: [cacheHit !== null && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.cacheHit') }), _jsx("dd", { children: `${cacheHit}%` })] })), _jsx("dt", { children: t('message.turnUsage.input') }), _jsx("dd", { children: exactCount(usage.uncachedInputTokens, t) }), _jsx("dt", { children: t('message.turnUsage.cacheRead') }), _jsx("dd", { children: exactCount(usage.cacheReadTokens, t) }), usage.cacheWriteTokens !== 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.cacheWrite') }), _jsx("dd", { children: exactCount(usage.cacheWriteTokens, t) })] })), _jsx("dt", { children: t('message.turnUsage.output') }), _jsx("dd", { children: exactCount(usage.outputTokens, t) })] })] }), document.body)] }));
}
export const StatsPills = memo(function StatsPills({ useChat, useProjection, usePerformanceUsage, t }) {
    const mode = usePerformanceUsage(value => value);
    const settledNodes = useChat(s => s.legacy.nodes);
    const usage = useProjection('tokenUsage');
    // One exclusive slot for both dialogs: opening either pill closes the other.
    const [openPill, setOpenPill] = useState(null);
    // Every figure rides the durable sessionStats projection, so paging and
    // compaction cannot change any of them; an assembly without the unit falls
    // back to the window-scoped fold wholesale (same field names), paid only
    // while no projection value is served.
    const projected = useProjection('sessionStats');
    const stats = useMemo(() => projected ?? deriveStats(settledNodes), [projected, settledNodes]);
    // Gated on actual token activity: a session whose steps all settled without
    // billing (e.g. every request failed) shows its counts without a usage pill.
    const hasTokens = usage !== undefined
        && (billedInputTokens(usage) > 0 || usage.outputTokens > 0);
    if (mode === 'compact') {
        const speed = stats.decodeMs > 0
            ? t('message.tokensPerSecond', { tps: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1_000)) })
            : null;
        const cacheHit = hasTokens ? cacheHitPercent(usage) : null;
        if (speed === null && cacheHit === null)
            return null;
        return (_jsxs("div", { className: css.root, "data-composer-stats": true, children: [speed !== null && _jsxs("span", { className: css.pill, children: [_jsx(IconGaugeOutlineRegular, {}), speed] }), cacheHit !== null && (_jsxs("span", { className: css.pill, children: [_jsx(IconDatabaseOutlineRegular, {}), t('stats.cacheHit', { percent: cacheHit })] }))] }));
    }
    if (stats.steps === 0 && !hasTokens)
        return null;
    return (_jsxs("div", { className: css.root, "data-composer-stats": true, children: [stats.steps > 0 && (_jsx(TimePill, { stats: stats, t: t, dialog: {
                    open: openPill === 'time',
                    setOpen: (open) => { setOpenPill(open ? 'time' : null); },
                } })), hasTokens && (_jsx(UsagePill, { usage: usage, t: t, dialog: {
                    open: openPill === 'usage',
                    setOpen: (open) => { setOpenPill(open ? 'usage' : null); },
                } }))] }));
});
