// Generated from runtime/alpha3/compat/ui-chat/src/client/settings/LinkOpeningRow.tsx; edit the TypeScript source.
import { jsx as _jsx } from "react/jsx-runtime";
import { PreferenceRow } from "./PreferenceRow.js";
/**
 * Render the link-opening destination selector.
 * @param props - Composed Settings slot props.
 * @returns The preference row.
 */
export function LinkOpeningRow({ useLinkOpening, useBrowserAvailable, setLinkOpening, t }) {
    const destination = useLinkOpening(value => value);
    const browserAvailable = useBrowserAvailable(value => value);
    if (!browserAvailable)
        return null;
    return (_jsx(PreferenceRow, { title: t('settings.links.title'), description: t('settings.links.description'), value: destination, selectedLabel: t(destination === 'sidebar' ? 'settings.links.sidebar' : 'settings.links.newTab'), options: [
            { id: 'sidebar', label: t('settings.links.sidebar') },
            { id: 'new-tab', label: t('settings.links.newTab') },
        ], onSelect: (value) => { setLinkOpening(value); } }));
}
