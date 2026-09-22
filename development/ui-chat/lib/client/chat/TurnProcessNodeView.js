// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/TurnProcessNodeView.tsx; edit the TypeScript source.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { memo, useEffect, useState } from 'react';
import { IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { turnProcessAlwaysOpen } from "../contract/turn-process.js";
import { formatLiveRunDuration, formatRunDuration, LIVE_RUN_CLOCK_INTERVAL_MS } from "./message-chrome.js";
import a11yCss from './accessibility.module.css';
import css from './TurnProcessNodeView.module.css';
/** Turn-level process disclosure controller. */
export const TurnProcessNodeView = memo(function TurnProcessNodeView({ node, turnProcess, t, }) {
    if (turnProcess === undefined)
        throw new Error('turn-process node requires Turn process owner state');
    const open = turnProcess.open;
    const turn = node.location.kind === 'turn' || node.location.kind === 'step'
        ? node.location.turn
        : undefined;
    const [now, setNow] = useState(Date.now);
    const ticking = turnProcess.foldable && turn?.status === 'open';
    useEffect(() => {
        if (!ticking)
            return;
        setNow(Date.now());
        const timer = setInterval(() => { setNow(Date.now()); }, LIVE_RUN_CLOCK_INTERVAL_MS);
        return () => { clearInterval(timer); };
    }, [ticking]);
    if (!turnProcess.foldable)
        return null;
    const canCollapse = turnProcess.hasContent && !turnProcessAlwaysOpen(node);
    const running = turn?.status === 'open';
    const reason = turn?.end?.data.reason.kind;
    const elapsedMs = turn?.start === undefined ? undefined
        : Math.max(1000, (turn.end?.time ?? now) - turn.start.time);
    const duration = elapsedMs === undefined ? undefined
        : running ? formatLiveRunDuration(elapsedMs, t) : formatRunDuration(elapsedMs, t);
    // Other end reasons retain elapsed time; only cancellation and failure replace it.
    const label = running
        ? duration === undefined ? t('chat.deepDiving') : t('message.turnProcess.deepDivingFor', { duration })
        : reason === 'aborted' ? t('message.stopped')
            : reason === 'error' ? t('message.turnProcess.failed')
                : duration === undefined ? t('message.turnProcess.worked')
                    : t('message.turnProcess.took', { duration });
    const announcement = running ? t('chat.deepDiving')
        : reason === 'aborted' ? t('message.stopped')
            : reason === 'error' ? t('message.turnProcess.failed')
                : t('message.turnProcess.worked');
    return (_jsxs(_Fragment, { children: [_jsx("span", { className: a11yCss.visuallyHidden, role: "status", "aria-live": "polite", "aria-atomic": "true", children: announcement }), _jsxs("button", { type: "button", className: css.root, "data-open": open || undefined, "data-turn-process": node.data.turn, "data-turn-process-messages": node.data.messageCount, "data-turn-process-tool-calls": node.data.toolCallCount, "data-turn-process-subagents": node.data.subagentCount, disabled: !canCollapse, "aria-expanded": turnProcess.hasContent ? open : undefined, onClick: (event) => {
                    event.currentTarget.focus();
                    turnProcess.setOpen(!open);
                }, children: [_jsx("span", { className: css.label, children: label }), canCollapse && _jsx(IconChevronDownOutlineRegular, { className: css.chevron })] })] }));
});
