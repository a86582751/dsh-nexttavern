// Generated from runtime/alpha3/compat/ui-chat/src/client/settings/PerformanceUsageRow.tsx; edit the TypeScript source.
import { jsx as _jsx } from "react/jsx-runtime";
import { PreferenceRow } from "./PreferenceRow.js";
const OPTIONS = [
    { id: 'compact', label: 'settings.performance.compact' },
    { id: 'detailed', label: 'settings.performance.detailed' },
];
/**
 * Render the performance and usage detail selector.
 * @param props - composed Settings slot props.
 * @returns the preference row.
 */
export function PerformanceUsageRow({ usePerformanceUsage, setPerformanceUsage, t }) {
    const mode = usePerformanceUsage(value => value);
    const selectedLabel = mode === 'detailed'
        ? 'settings.performance.detailed'
        : 'settings.performance.compact';
    return (_jsx(PreferenceRow, { title: t('settings.performance.title'), description: t('settings.performance.description'), value: mode, selectedLabel: t(selectedLabel), options: OPTIONS.map(option => ({ id: option.id, label: t(option.label) })), onSelect: (value) => { setPerformanceUsage(value); } }));
}
