// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/GenericCommandCard.tsx; edit the TypeScript source.
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useCallback, useMemo, useState } from 'react';
import { DisclosureRow, IconApiOutlineRegular, TextShimmer } from '@deepseek-ai/dsh-client-ui-primitives';
import a11yCss from './accessibility.module.css';
import css from './GenericCommandCard.module.css';
const COMMAND_ICON = _jsx(IconApiOutlineRegular, { size: 14 });
/** Node state → row state semantic (running while unsettled; outcome kind after). */
function stateOf(outcome) {
    if (outcome === null)
        return 'running';
    return outcome.kind === 'error' ? 'error' : 'ok';
}
/**
 * Render a command summary and its lazily mounted multiline output.
 * @param props - command, locale, and optional running label.
 * @returns the command disclosure.
 */
export const GenericCommandCard = memo(function GenericCommandCard({ node, t, runningSummary }) {
    const [expanded, setExpanded] = useState(false);
    const text = node.outcome?.text;
    const summary = node.outcome === null
        ? runningSummary ?? t('command.running')
        : text ?? (node.outcome.kind === 'error' ? t('command.failed') : t('command.done'));
    // The summary already carries the settlement text, so the title is the bare
    // command name.
    const title = node.name ?? t('command.title');
    const state = stateOf(node.outcome);
    const running = state === 'running';
    const body = text !== undefined && text.includes('\n') ? text : null;
    const open = expanded && body !== null;
    const toggle = useCallback(() => { setExpanded(value => !value); }, []);
    const collapsedContent = useMemo(() => (_jsxs(_Fragment, { children: [_jsx("span", { className: css.separator, "aria-hidden": true }), _jsx("span", { className: css.summary, "data-error": state === 'error' || undefined, children: _jsx(TextShimmer, { active: running, children: summary }) })] })), [running, state, summary]);
    const content = useMemo(() => open
        ? _jsx("pre", { className: css.body, "data-error": state === 'error' || undefined, children: body })
        : undefined, [body, open, state]);
    return (_jsxs("div", { className: css.root, "data-variant": "others", "data-state": state, children: [state === 'running' && _jsx("span", { className: a11yCss.visuallyHidden, children: t('row.running') }), state === 'error' && _jsx("span", { className: a11yCss.visuallyHidden, children: t('row.failed') }), _jsx(DisclosureRow, { rowClassName: css.row, leadingClassName: css.leading, titleClassName: css.title, chevronClassName: css.chevron, icon: COMMAND_ICON, title: title, running: running, open: open, expandable: body !== null, expandOnRowClick: true, keepContentWhenOpen: true, onToggle: toggle, collapsedContent: collapsedContent, children: content })] }));
});
