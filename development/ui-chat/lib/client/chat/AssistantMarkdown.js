// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/AssistantMarkdown.tsx; edit the TypeScript source.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, memo, useMemo } from 'react';
import { JsonBlock, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives';
import { markdownLabels } from "../markdown-labels.js";
import { ReasoningRow } from "./ReasoningRow.js";
import { useSearchableHidden } from "./searchable-hidden.js";
import css from './AssistantMarkdown.module.css';
/**
 * Resolve an authored POSIX image path against the document's file API.
 * @param base - canonical `document.baseURI` at render time.
 * @param value - authored markdown destination.
 * @returns an absolute HTTP(S) file-API URL, or undefined for unsupported
 * protocols and non-local paths.
 */
export function localPathMediaUrl(base, value) {
    if (!value.startsWith('/') || value.startsWith('//'))
        return undefined;
    if (!base.startsWith('http:') && !base.startsWith('https:'))
        return undefined;
    return new URL(`api/file?path=${encodeURIComponent(value)}`, base).href;
}
/** Reasoning block as the Think variant summary row (figma 39:28304). */
export const AssistantMarkdown = memo(function AssistantMarkdown({ blocks, streaming, interrupted, renderMessageImages, groupPart, useDisclosure, reasoningHidden = false, usePresentation, revealProcess, mentions, t, }) {
    // Stable per locale revision (t identity changes on switch): a fresh object
    // per render would rebuild MarkdownText's component table every chunk.
    const labels = useMemo(() => markdownLabels(t), [t]);
    // MarkdownText memoizes its vocabulary; keep its identity stable across renders.
    const pathImages = useMemo(() => {
        return { resolve: value => localPathMediaUrl(document.baseURI, value) };
    }, []);
    const last = blocks.length - 1;
    // Tool-call heads render as tool rows in the chat view's grouping pass, so
    // a node that is only those heads (or empty) would paint an empty root
    // between tool groups — skip the shell unless something visible remains.
    const hasVisible = streaming
        || interrupted === true
        || blocks.some(block => block.kind !== 'tool-call');
    if (!hasVisible)
        return null;
    const rendered = [];
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (block === undefined)
            continue;
        if (groupPart === 'reasoning' && block.kind !== 'reasoning')
            continue;
        if (groupPart === 'response' && block.kind === 'reasoning')
            continue;
        switch (block.kind) {
            case 'text':
                rendered.push(_jsx(MarkdownText, { text: block.text, streaming: streaming, labels: labels, fileMentions: mentions, pathImages: pathImages }, i));
                break;
            case 'reasoning':
                rendered.push(_jsx(ProcessReasoning, { hidden: reasoningHidden, reveal: revealProcess, children: _jsx(ReasoningRow, { text: block.text, running: streaming && i === last, usePresentation: usePresentation, useDisclosure: useDisclosure, t: t }) }, i));
                break;
            case 'image': {
                // Consecutive image blocks share one gallery so several images tile
                // into rows instead of each opening a one-image group of its own.
                // Keyed by the group's FIRST block index: a streaming append that
                // extends the group then only grows `images` instead of remounting
                // the gallery under a shifted key.
                const start = i;
                const group = [block];
                while (i + 1 < blocks.length) {
                    const next = blocks[i + 1];
                    if (next === undefined || next.kind !== 'image')
                        break;
                    group.push(next);
                    i += 1;
                }
                rendered.push(_jsx(Fragment, { children: renderMessageImages({
                        images: group.map(({ attachment }) => ({ attachment })),
                        align: 'start',
                    }) }, start));
                break;
            }
            // Grouped into tool rows by ChatView; hasVisible above skips an empty shell.
            case 'tool-call':
                break;
            default:
                rendered.push(_jsx(JsonBlock, { label: t('message.unknownBlock'), payload: block.block, truncatedLabel: total => t('json.truncated', { total }) }, i));
        }
    }
    return (_jsx("div", { className: css.root, "data-streaming": streaming || undefined, children: _jsxs("div", { className: css.body, children: [rendered, interrupted && (groupPart === undefined || groupPart === 'response'
                    || !blocks.some(block => block.kind !== 'reasoning' && block.kind !== 'tool-call'))
                    && _jsx("span", { className: css.stopped, children: t('message.stopped') })] }) }));
});
function ProcessReasoning({ hidden, reveal, children }) {
    const ref = useSearchableHidden(hidden, reveal ?? NOOP);
    return _jsx("div", { ref: ref, "data-turn-process-inline": hidden || undefined, children: children });
}
const NOOP = () => { };
