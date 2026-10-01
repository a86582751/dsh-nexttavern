// Generated from runtime/alpha3/compat/ui-workspace/src/client/session-actions/RenameSession.tsx; edit the TypeScript source.
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The rename action: a `sidebar.workspaces.session.menu.item` row that raises
 * the rename request, and the `shell.overlay` dialog entry that answers it.
 * The dialog lives outside the row menu because the row unmounts with the
 * menu; the browser raises the same request from a title double-click.
 */
import { useRef, useState } from 'react';
import { Button, IconEditOutlineRegular, MenuItemButton, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import css from '../rows/WorkspaceBrowser.module.css';
/**
 * Menu row (order 200): ask for the rename dialog, seeded with the row's current title.
 * @param props - owner share, menu open state, and the rename share.
 * @returns the row.
 */
export function RenameSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, useShortcuts, requestSessionRename, t, }) {
    const [, setMenuOpen] = useMenuOpenState();
    const shortcut = useShortcuts(rows => rows.find(row => row.id === 'session.rename'));
    return (_jsx(MenuItemButton, { shortcut: shortcut, icon: _jsx(IconEditOutlineRegular, {}), onSelect: () => {
            setMenuOpen(false);
            requestSessionRename(sessionId, displayTitle);
        }, children: t('rename') }));
}
/**
 * The `shell.overlay` entry: nothing while no rename is requested, otherwise
 * one dialog per request (keyed by the Session, so a new request starts a
 * fresh draft). Sessions have no client-side name-conflict rule (the host
 * normalizes), and unlike Workspace rename an unchanged title is NOT
 * blocked: confirming the current automatic title is the gesture that pins it.
 * @param props - the request hook, its settlement, the rename hop, and the locale seat.
 * @returns the open dialog, or null.
 */
export function SessionRenameDialog({ useRenameRequest, settleSessionRename, renameSession, t }) {
    const request = useRenameRequest(pending => pending);
    if (request === null)
        return null;
    return (_jsx(RenameForm, { request: request, renameSession: renameSession, onSettle: settleSessionRename, t: t }, request.sessionId));
}
/** One request's dialog: the draft seeds from the request on mount; in-flight and error state die with it. */
function RenameForm({ request, renameSession, onSettle, t }) {
    const [draft, setDraft] = useState(request.currentTitle);
    const [renaming, setRenaming] = useState(false);
    const [error, setError] = useState(null);
    // IME composition: Enter that commits a composition must not submit.
    const composingRef = useRef(false);
    const trimmed = draft.trim();
    const blocked = renaming || trimmed === '';
    const close = () => {
        if (renaming)
            return;
        onSettle();
    };
    const confirm = () => {
        if (blocked)
            return;
        setRenaming(true);
        setError(null);
        renameSession(request.sessionId, trimmed).then(() => {
            setRenaming(false);
            onSettle();
        }).catch((reason) => {
            setRenaming(false);
            setError(reason instanceof Error ? reason.message : String(reason));
        });
    };
    return (_jsxs(Modal, { open: true, onClose: close, closeLabel: t('close'), title: t('rename.session.title'), footer: (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: renaming, onClick: close, children: t('cancel') }), _jsx(Button, { variant: "primary", disabled: blocked, onClick: confirm, children: t('rename') })] })), children: [_jsx("input", { className: css.renameInput, value: draft, "aria-label": t('field.sessionName'), "data-modal-autofocus": true, disabled: renaming, onFocus: (e) => { e.target.select(); }, onChange: (e) => { setDraft(e.target.value); setError(null); }, onCompositionStart: () => { composingRef.current = true; }, onCompositionEnd: () => { composingRef.current = false; }, onKeyDown: (e) => {
                    if (e.key === 'Enter' && !composingRef.current) {
                        e.preventDefault();
                        confirm();
                    }
                } }), error !== null && _jsx("div", { className: css.renameError, role: "alert", children: error })] }));
}
