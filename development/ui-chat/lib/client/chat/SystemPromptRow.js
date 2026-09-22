// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/SystemPromptRow.tsx; edit the TypeScript source.
import { jsx as _jsx } from "react/jsx-runtime";
import { memo, useState } from 'react';
import { DisclosureRow, IconBrowseOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { OpaqueBody } from "./ContextBody.js";
import css from './ContextInjectionRow.module.css';
/**
 * Render one complete system prompt as a collapsed disclosure whose expanded
 * body is the same opaque context chrome: 141px code-block scrollport and
 * model-facing text with its real line breaks. An in-history update uses the
 * same row under its own title.
 * @param props - Complete prompt text, whether it is an update, and the locale seat.
 * @returns The system-prompt disclosure row.
 */
export function SystemPromptRow({ text, update = false, t }) {
    const [open, setOpen] = useState(false);
    return (_jsx(DisclosureRow, { className: css.root, icon: _jsx(IconBrowseOutlineRegular, { size: 14 }), chevronClassName: css.chevron, title: t(update ? 'message.systemPromptUpdate' : 'message.systemPrompt'), open: open, expandable: true, expandOnRowClick: true, onToggle: () => { setOpen(value => !value); }, children: _jsx("div", { className: css.body, "data-system-prompt-body": true, children: _jsx(OpaqueBody, { content: [{ type: 'text', text }], source: null, t: t }) }) }));
}
/** System-prompt keyed Chat renderer. */
export const SystemPromptNodeView = memo(function SystemPromptNodeView({ node, t, }) {
    return _jsx(SystemPromptRow, { text: node.data.text, update: node.data.update === true, t: t });
});
