// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/MessageIconActions.tsx; edit the TypeScript source.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Shared IconActions chrome for user and assistant messages: copy
// live, optional branch wiring, and an optional date-aware clock.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { IconBranchOutlineRegular, IconCheckOutlineRegular, IconCopyOutlineRegular, Tooltip, writeClipboard, } from '@deepseek-ai/dsh-client-ui-primitives';
import { formatMessageClock } from "./message-chrome.js";
import { useCalendarDay } from "./use-calendar-day.js";
import css from './MessageIconActions.module.css';
/**
 * Copy / branch (/ clock) IconActions row shared by user and assistant chrome.
 * @param props - Copy text, event time, clock side, branch callback, className.
 * @returns The actions row element.
 */
export function MessageIconActions({ text, time, clock, onBranch, branchUnavailable = false, className, extraActions, usageAction, t, }) {
    const day = useCalendarDay();
    const reasonId = useId();
    // Same success chrome as CodeBlock: a short check swap after the write,
    // gated so re-clicks during the window neither re-copy nor stack timers.
    const [copied, setCopied] = useState(false);
    const copyPending = useRef(false);
    const copyTimer = useRef(null);
    const copyEpoch = useRef(0);
    useEffect(() => () => {
        copyEpoch.current += 1;
        copyPending.current = false;
        if (copyTimer.current !== null)
            clearTimeout(copyTimer.current);
    }, []);
    const onCopy = useCallback(() => {
        if (copied || copyPending.current)
            return;
        const epoch = copyEpoch.current;
        copyPending.current = true;
        void writeClipboard(text).then((ok) => {
            if (epoch !== copyEpoch.current)
                return;
            copyPending.current = false;
            if (!ok)
                return;
            setCopied(true);
            copyTimer.current = window.setTimeout(() => {
                copyTimer.current = null;
                setCopied(false);
            }, 1000);
        });
    }, [copied, text]);
    const clockEl = time === undefined ? null : (_jsx("span", { className: clock === 'start' ? css.timeStart : css.timeEnd, children: formatMessageClock(time, t, day) }));
    return (_jsxs("div", { className: className === undefined ? css.actions : `${css.actions} ${className}`, "data-clock": clock, children: [clock === 'start' ? clockEl : null, _jsx(Tooltip, { label: copied ? t('copied') : t('copy'), side: "bottom", children: _jsx("button", { type: "button", className: css.action, "aria-label": copied ? t('copied') : t('copy'), onClick: onCopy, children: copied ? _jsx(IconCheckOutlineRegular, {}) : _jsx(IconCopyOutlineRegular, {}) }) }), extraActions, onBranch !== undefined && (_jsx(Tooltip, { label: branchUnavailable ? t('message.branchUnavailable') : t('message.branch'), side: "bottom", children: _jsx("button", { type: "button", className: css.action, "aria-label": t('message.branch'), "aria-disabled": branchUnavailable || undefined, "aria-describedby": branchUnavailable ? reasonId : undefined, "data-unavailable": branchUnavailable || undefined, onClick: branchUnavailable ? undefined : onBranch, children: _jsx(IconBranchOutlineRegular, {}) }) })), onBranch !== undefined && branchUnavailable && (_jsx("span", { id: reasonId, className: css.visuallyHidden, children: t('message.branchUnavailable') })), clock === 'end'
                ? _jsxs("span", { className: css.endInfo, children: [usageAction, clockEl] })
                : usageAction] }));
}
