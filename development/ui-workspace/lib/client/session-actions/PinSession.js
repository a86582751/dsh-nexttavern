// Generated from runtime/alpha3/compat/ui-workspace/src/client/session-actions/PinSession.tsx; edit the TypeScript source.
import { jsx as _jsx } from "react/jsx-runtime";
/**
 * The pin action: a `sidebar.workspaces.session.menu.item` row and a
 * `sidebar.workspaces.session.row.action` button over one injected behavior.
 * Pin and archive are mutually exclusive on the Host, so the action reads both
 * sets and does not offer itself on an archived row; what a pin does beyond
 * the Host call (fronting the Session in its saved orders, the failure
 * notice) lives in the injected callbacks, not here.
 */
import { IconPinFillRegular, IconPinOutlineRegular, MenuItemButton, Tooltip, } from '@deepseek-ai/dsh-client-ui-primitives';
import css from '../rows/Rows.module.css';
/** The row's pin and archive membership, one Set lookup each. */
function usePinState({ sessionId, usePinned, useArchived }) {
    return {
        pinned: usePinned(pinned => pinned.has(sessionId)),
        archived: useArchived(archived => archived.has(sessionId)),
    };
}
/**
 * Menu row (order 100): pin or unpin by the row's current state; absent on archived rows.
 * @param props - owner share, the pin share, and the menu open state.
 * @returns the row, or null for an archived Session.
 */
export function PinSessionMenuItem(props) {
    const { sessionId, useMenuOpenState, pinSession, unpinSession, t } = props;
    const [, setMenuOpen] = useMenuOpenState();
    const { pinned, archived } = usePinState(props);
    if (archived)
        return null;
    return (_jsx(MenuItemButton, { icon: pinned ? _jsx(IconPinFillRegular, {}) : _jsx(IconPinOutlineRegular, {}), onSelect: () => {
            setMenuOpen(false);
            (pinned ? unpinSession : pinSession)(sessionId);
        }, children: t(pinned ? 'menu.unpinSession' : 'menu.pinSession') }));
}
/**
 * Hover button (order 200, rightmost: it lands where the rest-state pin marker sits); absent on archived rows.
 * @param props - owner share and the pin share.
 * @returns the button, or null for an archived Session.
 */
export function PinSessionRowButton(props) {
    const { sessionId, pinSession, unpinSession, t } = props;
    const { pinned, archived } = usePinState(props);
    if (archived)
        return null;
    return (_jsx(Tooltip, { label: t(pinned ? 'actions.unpin' : 'actions.pin'), side: "bottom", align: "end", delayMs: 500, children: _jsx("button", { type: "button", className: css.iconButton, "aria-label": t(pinned ? 'menu.unpinSession' : 'menu.pinSession'), onClick: () => { (pinned ? unpinSession : pinSession)(sessionId); }, children: pinned ? _jsx(IconPinFillRegular, { size: 14 }) : _jsx(IconPinOutlineRegular, { size: 14 }) }) }));
}
