// Generated from runtime/alpha3/compat/ui-chat/src/client/settings/PreferenceRow.tsx; edit the TypeScript source.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Localized two-column selector shared by Chat preference rows. */
import { useRef, useState } from 'react';
import { IconChevronDownOutlineRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './PreferenceRow.module.css';
/**
 * Render a preference label and its menu; selection restores focus before publishing the new value.
 * @param props - localized copy, selected value, choices, and mutation callback.
 * @returns the settings row.
 */
export function PreferenceRow({ title, description, value, selectedLabel, options, onSelect }) {
    const [open, setOpen] = useState(false);
    const selectorRef = useRef(null);
    const closeMenu = () => { setOpen(false); };
    const selectMode = (id) => {
        selectorRef.current?.focus({ preventScroll: true });
        closeMenu();
        onSelect(id);
    };
    const selector = (_jsxs("button", { ref: selectorRef, type: "button", className: css.selector, "aria-haspopup": "menu", "aria-expanded": open, onClick: () => { setOpen(value => !value); }, children: [selectedLabel, _jsx(IconChevronDownOutlineRegular, { className: css.chevron })] }));
    return (_jsxs("div", { className: css.row, children: [_jsxs("div", { className: css.rowText, children: [_jsx("div", { className: css.title, children: title }), _jsx("div", { className: css.desc, children: description })] }), _jsx(Menu, { open: open, onClose: closeMenu, items: options, selectedId: value, onSelect: selectMode, align: "end", portal: true, anchor: selector })] }));
}
