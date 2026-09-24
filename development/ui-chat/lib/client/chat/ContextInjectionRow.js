// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/ContextInjectionRow.tsx; edit the TypeScript source.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { DisclosureRow, IconBrowseOutlineRegular, IconContextInjectionOutlineRegular, ReferenceIconRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { contextBody } from "./ContextBody.js";
import css from './ContextInjectionRow.module.css';
/**
 * Render logged context with the Tool calls disclosure chrome from Figma.
 *
 * The header names the role the context plays and, beside it, the producer the
 * durable source identifies, so a reader can tell an injected skill catalog
 * from a workspace instruction file or a recalled session without expanding.
 * The expanded body follows the producer-declared form; an absent or unknown
 * form renders the opaque body.
 * @param props - Durable content, its projected producer role/name and form, and the locale seat.
 * @returns A collapsed context row with a bounded, form-specific body.
 */
export function ContextInjectionRow({ content, source, producer, form, t }) {
    const [open, setOpen] = useState(false);
    // Resolved rather than declared: a form whose fields are unreadable renders
    // the opaque body, and the marker must say what the row actually shows.
    const { rendered, summary, body } = contextBody(form, { content, source, t });
    const toolBlocks = content.length > 0
        && content.every(block => block.type === 'tool-addition' || block.type === 'tool-removal')
        ? content : undefined;
    const added = toolBlocks?.flatMap(block => block.type === 'tool-addition' ? [block.toolName] : []) ?? [];
    const removed = toolBlocks?.flatMap(block => block.type === 'tool-removal' ? [block.toolName] : []) ?? [];
    const single = toolBlocks?.length === 1 ? toolBlocks[0] : undefined;
    const toolSummary = toolBlocks === undefined || single !== undefined ? null
        : added.length > 0 && removed.length > 0
            ? t('message.toolsChanged', { added: added.length, removed: removed.length })
            : added.length > 0
                ? t('message.toolsAddedCount', { count: added.length })
                : t('message.toolsRemovedCount', { count: removed.length });
    return (_jsx(DisclosureRow, { className: css.root, icon: toolBlocks !== undefined ? _jsx(IconBrowseOutlineRegular, { size: 14 }) : producer.role === 'recall'
            ? _jsx("span", { "data-context-recall-icon": true, children: _jsx(ReferenceIconRegular, { kind: "session" }) })
            : _jsx(IconContextInjectionOutlineRegular, { size: 14 }), chevronClassName: css.chevron, title: single !== undefined ? t(single.type === 'tool-addition' ? 'message.toolAdded' : 'message.toolRemoved', { name: single.toolName }) : t(toolBlocks !== undefined ? 'message.toolsUpdated' : producer.role === 'recall' ? 'message.contextRecall' : 'message.contextInjection'), collapsedContent: toolSummary !== null ? (_jsxs(_Fragment, { children: [_jsx("span", { className: css.sep, "aria-hidden": true }), _jsx("span", { className: css.summary, children: toolSummary })] })) : toolBlocks !== undefined || producer.label === null ? undefined : (
        /* ToolRow's separator shape: an aria-hidden dot, so the accessible name
           stays the two readable parts and the two disclosure rows expose one
           name shape. A source that names no producer drops the dot with it. */
        _jsxs(_Fragment, { children: [_jsx("span", { className: css.sep, "aria-hidden": true }), _jsx("span", { className: css.source, "data-context-source": true, children: producer.label }), summary !== null && (_jsxs(_Fragment, { children: [_jsx("span", { className: css.sep, "aria-hidden": true }), _jsx("span", { className: css.summary, "data-context-summary": true, children: summary })] }))] })), keepContentWhenOpen: true, open: open && single === undefined, expandable: single === undefined, expandOnRowClick: true, onToggle: () => { setOpen(value => !value); }, children: _jsx("div", { className: css.body, "data-context-injection-body": true, "data-context-form": rendered ?? undefined, children: toolBlocks === undefined ? body : (_jsxs("div", { className: css.toolChanges, children: [added.length > 0 && _jsx("div", { children: t('message.toolsAdded', { names: added.join(', ') }) }), removed.length > 0 && _jsx("div", { children: t('message.toolsRemoved', { names: removed.join(', ') }) })] })) }) }));
}
