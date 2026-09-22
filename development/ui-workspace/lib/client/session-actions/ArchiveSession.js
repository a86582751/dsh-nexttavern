// Generated from runtime/alpha3/compat/ui-workspace/src/client/session-actions/ArchiveSession.tsx; edit the TypeScript source.
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The archive action: a `sidebar.workspaces.session.menu.item` row and a
 * `sidebar.workspaces.session.row.action` button over one injected behavior,
 * plus the `shell.overlay` dialog that confirms stopping a Session's running
 * work before archiving it. The same entries restore an archived row; the
 * notice a successful archive raises and the diagnostics for Host rejections
 * live in the injected callbacks, not here.
 */
import { useState } from 'react';
import { Button, IconArchiveOutlineRegular, IconUnarchiveOutlineRegular, MenuItemButton, Modal, Tooltip, } from '@deepseek-ai/dsh-client-ui-primitives';
import css from '../rows/Rows.module.css';
import browserCss from '../rows/WorkspaceBrowser.module.css';
/**
 * Menu row (order 400): archive, or restore an archived row.
 * @param props - owner share, the archive share, and the menu open state.
 * @returns the row.
 */
export function ArchiveSessionMenuItem({ sessionId, useArchived, useMenuOpenState, archiveSession, unarchiveSession, t, }) {
    const [, setMenuOpen] = useMenuOpenState();
    const archived = useArchived(set => set.has(sessionId));
    return (_jsx(MenuItemButton, { icon: archived ? _jsx(IconUnarchiveOutlineRegular, { size: 14 }) : _jsx(IconArchiveOutlineRegular, { size: 14 }), onSelect: () => {
            setMenuOpen(false);
            (archived ? unarchiveSession : archiveSession)(sessionId);
        }, children: t(archived ? 'menu.unarchiveSession' : 'menu.archiveSession') }));
}
/**
 * Hover button (order 100): archive, or restore an archived row.
 * @param props - owner share and the archive share.
 * @returns the button.
 */
export function ArchiveSessionRowButton({ sessionId, useArchived, archiveSession, unarchiveSession, t, }) {
    const archived = useArchived(set => set.has(sessionId));
    return (_jsx(Tooltip, { label: t(archived ? 'actions.unarchive' : 'actions.archive'), side: "bottom", align: "end", delayMs: 500, children: _jsx("button", { type: "button", className: css.iconButton, "aria-label": t(archived ? 'menu.unarchiveSession' : 'menu.archiveSession'), onClick: () => { (archived ? unarchiveSession : archiveSession)(sessionId); }, children: archived ? _jsx(IconUnarchiveOutlineRegular, { size: 14 }) : _jsx(IconArchiveOutlineRegular, { size: 14 }) }) }));
}
/**
 * The `shell.overlay` entry: nothing while no confirmation is pending,
 * otherwise one dialog per request (keyed by the Session). Confirming asks
 * the Host to stop the listed work and archive; cancelling leaves the
 * Session running and visible.
 * @param props - the request hook, its settlement, the stop-and-archive hop, and the locale seat.
 * @returns the open dialog, or null.
 */
export function SessionArchiveConfirmDialog({ useArchiveRequest, settleSessionArchive, stopAndArchiveSession, t, }) {
    const request = useArchiveRequest(pending => pending);
    if (request === null)
        return null;
    return (_jsx(ArchiveConfirmForm, { request: request, stopAndArchiveSession: stopAndArchiveSession, onSettle: settleSessionArchive, t: t }, request.sessionId));
}
/** One request's dialog: in-flight and error state die with it. */
function ArchiveConfirmForm({ request, stopAndArchiveSession, onSettle, t }) {
    const [archiving, setArchiving] = useState(false);
    const [error, setError] = useState(null);
    const close = () => {
        if (archiving)
            return;
        onSettle();
    };
    const confirm = () => {
        setArchiving(true);
        setError(null);
        stopAndArchiveSession(request.sessionId).then(() => {
            setArchiving(false);
            onSettle();
        }).catch((reason) => {
            setArchiving(false);
            setError(reason instanceof Error ? reason.message : String(reason));
        });
    };
    return (_jsxs(Modal, { open: true, onClose: close, closeLabel: t('close'), title: t('archive.confirm.title'), description: t('archive.confirm.desc', { title: request.displayTitle }), footer: (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: archiving, onClick: close, children: t('cancel') }), _jsx(Button, { variant: "outline", className: browserCss.deleteAction, disabled: archiving, onClick: confirm, children: t('archive.confirm.action') })] })), children: [_jsx("ul", { className: browserCss.archiveActivity, "aria-label": t('archive.confirm.activity'), children: request.activity.map((entry, index) => (_jsx("li", { children: activityLine(entry, t) }, `${entry.kind}-${String(index)}`))) }), archiving && _jsx("div", { className: browserCss.deleteStatus, role: "status", children: t('archive.confirm.pending') }), error !== null && _jsx("div", { className: browserCss.renameError, role: "alert", children: error })] }));
}
/**
 * One family's line: its count and the items' labels (ids when a family
 * carries no label). A family this dictionary does not know — a provider
 * merged into the kind map — falls through to the generic line.
 */
function activityLine(entry, t) {
    const items = entry.items ?? [];
    const n = items.length;
    const names = items.map(item => item.label ?? item.id).join(t('archive.confirm.listSeparator'));
    const plural = n === 1 ? 'one' : 'other';
    switch (entry.kind) {
        case 'turn': return t('archive.confirm.turn');
        case 'subagent': return t(`archive.confirm.subagents.${plural}`, { n, names });
        case 'job': return t(`archive.confirm.jobs.${plural}`, { n, names });
        case 'schedule': return t(`archive.confirm.schedules.${plural}`, { n, names });
        default: return t(`archive.confirm.other.${plural}`, { kind: entry.kind, n });
    }
}
