// Generated from runtime/alpha3/compat/ui-chat/src/client/settings/TranscriptViewRow.tsx; edit the TypeScript source.
import { jsx as _jsx } from "react/jsx-runtime";
import { TRANSCRIPT_VIEW_MODES } from "../../chat-settings.js";
import { PreferenceRow } from "./PreferenceRow.js";
const LABELS = {
    compact: 'settings.transcript.compact',
    standard: 'settings.transcript.standard',
    detailed: 'settings.transcript.detailed',
    verbose: 'settings.transcript.verbose',
};
/**
 * Render the work-details mode selector.
 * @param props - composed Settings slot props.
 * @returns the preference row.
 */
export function TranscriptViewRow({ useTranscriptView, setTranscriptView, t }) {
    const mode = useTranscriptView(value => value);
    return (_jsx(PreferenceRow, { title: t('settings.transcript.title'), description: t('settings.transcript.description'), value: mode, selectedLabel: t(LABELS[mode]), options: TRANSCRIPT_VIEW_MODES.map(id => ({ id, label: t(LABELS[id]) })), onSelect: (value) => { setTranscriptView(value); } }));
}
