// Generated from runtime/alpha3/compat/ui-workspace/src/client/session-actions/ForkSession.tsx; edit the TypeScript source.
import { jsx as _jsx } from "react/jsx-runtime";
/** The fork action: one `sidebar.workspaces.session.menu.item` row. */
import { IconBranchOutlineRegular, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives';
/**
 * Menu row (order 300): fork at the Session's last completed turn; the child
 * arrives through the Host list beside its source.
 * @param props - owner share, menu open state, and the fork share.
 * @returns the row.
 */
export function ForkSessionMenuItem({ sessionId, useMenuOpenState, useShortcuts, forkSession, t, }) {
    const [, setMenuOpen] = useMenuOpenState();
    const shortcut = useShortcuts(rows => rows.find(row => row.id === 'session.fork'));
    return (_jsx(MenuItemButton, { shortcut: shortcut, icon: _jsx(IconBranchOutlineRegular, {}), onSelect: () => {
            setMenuOpen(false);
            forkSession(sessionId);
        }, children: t('menu.fork') }));
}
