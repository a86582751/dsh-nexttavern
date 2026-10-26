import { renderReaderNarrative, renderReaderNarrativeAsync, projectReaderNarrativeDisplay } from './reader-rendering.js';
import type { ReaderMvuDisplayScope } from './reader-rendering.js';
import type { MvuAcceptedDisplayUpdate } from '../core/roleplay-mvu-display-facts.js';
import type { ReaderDisplayMessageRef, ReaderDisplayResponse } from '../core/roleplay-reader-display.js';
import { runReaderRegex } from './reader-regex.js';
import type { ReaderRule, SourceTask, FallbackTask, SourceResult, FallbackResult } from './reader-regex.js';
import {prepareStaticAuthorDocument, type AuthorFrameFragment} from './author-runtime.js';
import type {ReaderRegexDocumentExecutionV1,ReaderRegexDocumentRenderFragmentV1}
    from '../core/reader-regex-document-types.mjs';

interface BeautyRendering {
    renderAsync?: typeof renderReaderNarrativeAsync;
    renderSync?: typeof renderReaderNarrative;
}

export type FetchReaderDisplay = (sessionId: string, messages: readonly ReaderDisplayMessageRef[],
    signal: AbortSignal) => Promise<ReaderDisplayResponse>;
interface ReaderDisplayRead {
    readonly sessionId: string;
    readonly read: FetchReaderDisplay;
}

export type ReaderBeautyTask = string | {
    readonly text: string;
    readonly canonicalText?:string;
    readonly seq?: number;
    readonly messageId?: string;
    readonly displayUpdate?: MvuAcceptedDisplayUpdate;
};
const rawText = (task: ReaderBeautyTask) => typeof task === 'string' ? task : task.text;
const taskKey = (task: ReaderBeautyTask) => typeof task === 'string' ? JSON.stringify([task])
    : JSON.stringify([task.text,task.canonicalText??null, task.seq, task.messageId, task.displayUpdate ?? null]);
const displayRef = (task: ReaderBeautyTask): ReaderDisplayMessageRef | undefined =>
    typeof task !== 'string' && Number.isSafeInteger(task.seq) && Number(task.seq) >= 0 && task.messageId
        ? {seq: task.seq!, messageId: task.messageId} : undefined;
const pendingDisplayText = '正在读取显示内容…';
const pendingDisplayHtml = '<p role="status">' + pendingDisplayText + '</p>';

async function acceptedDisplayScope(task: ReaderBeautyTask): Promise<ReaderMvuDisplayScope | undefined> {
    if (typeof task === 'string' || task.text.length > 1_048_576) return;
    const update = task.displayUpdate, canonical = update?.canonical;
    if (!update || update.schemaVersion !== 1 || update.encoding !== 'native-mvu-accepted-display-update-v1'
        || !canonical || !Number.isSafeInteger(canonical.seq) || canonical.seq < 0
        || canonical.seq !== task.seq || !canonical.messageId || canonical.messageId !== task.messageId
        || !/^[a-f0-9]{64}$/.test(canonical.versionSha256) || !/^[a-f0-9]{64}$/.test(canonical.narrativeSha256)
        || !['native-jsonpatch-v1', 'native-mvu-update-v2'].includes(update.protocol)) return;
    const canonicalText=task.canonicalText??task.text;
    const start = canonicalText.indexOf('<UpdateVariable>'), close = canonicalText.indexOf('</UpdateVariable>');
    if (start < 0 || close < start || !globalThis.crypto?.subtle) return;
    // A state response can lag a Native edit. Bind the displayed body before
    // minting a range; absence/failure keeps the complete original visible.
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalText));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== canonical.narrativeSha256) return;
    const acceptedText=canonicalText.slice(start,close+'</UpdateVariable>'.length),displayStart=task.text.indexOf(acceptedText);
    if(displayStart<0)return;
    return {role: 'assistant', protocol: update.protocol,
        acceptedRange: {start:displayStart, end:displayStart+acceptedText.length}};
}

/** Committed-text rendering owns its scope, cancellation fence and bounded cache together. */
export function createReaderBeautyCache({
renderAsync = renderReaderNarrativeAsync, renderSync = renderReaderNarrative,
}: BeautyRendering = {}) {
    const cache = new Map<string, {html: string;text: string;css?: string;error?: string;fragments?: readonly AuthorFrameFragment[];
        readerFragments?: readonly ReaderRegexDocumentRenderFragmentV1[];}>();
    const fallbackHtml = new Map<string, string>();
    let execution: ReaderRegexDocumentExecutionV1 | undefined;
    let executionWindowKey: string | undefined;
    let currentScope = '';
    let cancelActive: (() => void) | undefined;

    function selectScope(scope: string) {
        if (currentScope !== scope) {
            cancelActive?.();
            cache.clear();
            fallbackHtml.clear();
            execution = undefined;
            executionWindowKey = undefined;
            currentScope = scope;
        }
    }

    function run(scope: string, tasks: readonly ReaderBeautyTask[], rules: ReaderRule[], changed: () => void,
        display?: ReaderDisplayRead) {
        cancelActive?.();
        const pending = tasks.filter(task => !cache.has(taskKey(task)));
        // A compiled Reader program owns this complete visible window. Paging
        // must not mix old document plans with a program for only new rows.
        const messages = display ? tasks.flatMap(task => {
            const ref = displayRef(task);
            return ref ? [ref] : [];
        }) : [];
        const windowKey = display && messages.length ? JSON.stringify(messages) : undefined;
        // Text survives history paging; the single execution owns only the
        // window that supplied its captured program and Native read facts.
        if ((!pending.length && windowKey === executionWindowKey) || !rules.length && !messages.length
            && !pending.some(task => typeof task !== 'string' && task.displayUpdate)) return;
        let cancelled = false;
        const controller = new AbortController();
        const cancel = () => { cancelled = true; controller.abort(); };
        cancelActive = cancel;
        const stale = () => cancelled || controller.signal.aborted || currentScope !== scope;
        function runBeautyRegex(task: SourceTask): Promise<SourceResult>;
        function runBeautyRegex(task: FallbackTask): Promise<FallbackResult>;
        function runBeautyRegex(task: SourceTask | FallbackTask): Promise<SourceResult | FallbackResult>;
        function runBeautyRegex(task: SourceTask | FallbackTask): Promise<SourceResult | FallbackResult> {
            if (stale()) throw new Error('cancelled');
            return runReaderRegex(task, controller.signal);
        }

        void (async () => {
            if (stale()) return;
            let response: ReaderDisplayResponse | undefined, displayError: unknown;
            if (display && messages.length) {
                try { response = await display.read(display.sessionId, messages, controller.signal); }
                catch (error) { displayError = error; }
            }
            if (stale()) return;
            // Intern only this visible read batch, preferring an unchanged row's
            // existing sheet. Row/scope ownership still lives in the cache.
            const cssPool = new Map<string, string>();
            const projections = new Map(tasks.flatMap(task => {
                const ref = displayRef(task);
                const row = response && response.sessionId === display?.sessionId && ref
                    ? response.rows.find(row => row.seq === ref.seq && row.messageId === ref.messageId
                        && row.rawText === (typeof task === 'string' ? task : task.canonicalText ?? task.text)) : undefined;
                if (!row) return [];
                const key = taskKey(task), priorCss = cache.get(key)?.css;
                if (row.css && priorCss === row.css) cssPool.set(row.css, priorCss);
                return [[key, row] as const];
            }));
            const acceptedExecution = projections.size === messages.length ? response?.execution : undefined;
            for (const task of tasks) {
                if (stale()) break;
                const key = taskKey(task), raw = rawText(task);
                const ref = displayRef(task);
                const projection = projections.get(key);
                const cached = cache.get(key);
                if (cached && !projection) continue;
                let css = projection?.css;
                if (css) {css = cssPool.get(css) ?? css;cssPool.set(css, css);}
                let displayScope: ReaderMvuDisplayScope | undefined;
                // Core has already applied the accepted MVU projection before ST.
                // Its rewritten text must never receive offsets from the raw body.
                if (!projection && typeof task !== 'string' && task.displayUpdate) {
                    try { displayScope = await acceptedDisplayScope(task); } catch { }
                }
                if (stale()) break;
                const source = projection ? projection.displayText : raw;
                const text = projection ? source : projectReaderNarrativeDisplay(raw, displayScope);
                // A successful read after paging can replace a cached fallback.
                // Reuse rendered output only while its display input is unchanged.
                const previousDisplay = cached?.text === text ? cached : undefined;
                let value;
                try {
                    value = { text, html: previousDisplay?.html ?? await renderAsync(source, rules, runBeautyRegex, displayScope),
                        css };
                    if (projection?.fragments) {
                        const fragments: AuthorFrameFragment[] = [];
                        const readerFragments: ReaderRegexDocumentRenderFragmentV1[] = [];
                        const previousFragments = previousDisplay?.readerFragments ?? previousDisplay?.fragments;
                        let documents = 0, readerDocuments = 0;
                        for (const [index, fragment] of projection.fragments.entries()) {
                            const previous = previousFragments?.[index];
                            if (fragment.kind === 'author-document' && fragment.documentPlanSha256 && acceptedExecution) {
                                readerFragments.push({kind: 'reader-document', documentPlanSha256: fragment.documentPlanSha256});
                                readerDocuments++;continue;
                            }
                            const html = fragment.kind === 'author-document'
                                ? previous?.kind === 'static-document' ? previous.html
                                    : prepareStaticAuthorDocument(document, fragment.parts) : undefined;
                            if (html !== undefined) {
                                fragments.push({kind: 'author-document', html});documents++;
                                readerFragments.push({kind: 'static-document', html});
                            } else {
                                const raw = fragment.kind === 'text' ? fragment.text : fragment.parts.map(part => part.text).join('');
                                const html = previous?.kind === 'text' ? previous.html
                                    : await renderAsync(raw, rules, runBeautyRegex);
                                fragments.push({kind: 'text', html});readerFragments.push({kind: 'text', html});
                            }
                        }
                        if (documents) value = {...value, fragments};
                        if (readerDocuments || documents) value = {...value, readerFragments};
                    }
                } catch (error) {
                    value = {
                        text, html: renderSync(source, [], displayScope),
                        css,

                        error: String(error && typeof error === 'object' && 'message' in error ? error.message : error),
                    };
                }
                if (displayError && ref) value = {...value,
                    error: String(displayError && typeof displayError === 'object' && 'message' in displayError
                        ? displayError.message : displayError)};
                if (response?.documentDiagnostics?.length) value = {...value,
                    error: response.documentDiagnostics.map(row => row.code).join(', ')};
                // Scope can change during an await before effect cleanup runs. Both fences are required.
                if (stale()) break;
                cache.set(key, value);
                while (cache.size > 500) cache.delete(cache.keys().next().value!);
                changed();
            }
            // Publish only after every plan has its actual visible container.
            // Earlier text rendering may complete while this batch is awaiting.
            if (!stale() && response) {
                execution = acceptedExecution;executionWindowKey = windowKey;changed();
            }
        })().finally(() => { if (cancelActive === cancel) cancelActive = undefined; });
        return cancel;
    }

    const htmlFor = (task: ReaderBeautyTask, displayEnabled = false) => {
        const rendered = cache.get(taskKey(task))?.html;
        if (rendered !== undefined) return rendered;
        // The same eligibility used by run owns this asynchronous Source read.
        // Its first render cannot display raw Native text before that read settles.
        if (displayEnabled && displayRef(task)) return pendingDisplayHtml;
        const text = rawText(task);
        // Raw HTML is keyed by its complete text, independently of Source/regex
        // completion. A fallback must never suppress the pending display task.
        // String tasks are the growing stream; retaining each prefix would evict history.
        if (typeof task === 'string') return renderSync(text, []);
        let html = fallbackHtml.get(text);
        if (html === undefined) html = renderSync(text, []);
        else fallbackHtml.delete(text);
        fallbackHtml.set(text, html);
        while (fallbackHtml.size > 500) fallbackHtml.delete(fallbackHtml.keys().next().value!);
        return html;
    };
    const textFor = (task: ReaderBeautyTask, displayEnabled = false) => cache.get(taskKey(task))?.text
        ?? (displayEnabled && displayRef(task) ? pendingDisplayText : rawText(task));
    const failed = (tasks: readonly ReaderBeautyTask[]) => tasks.some(task => cache.get(taskKey(task))?.error);
    const fragmentsFor = (task: ReaderBeautyTask) => cache.get(taskKey(task))?.fragments;
    const readerFragmentsFor = (task: ReaderBeautyTask) => cache.get(taskKey(task))?.readerFragments;
    const cssFor = (tasks: readonly ReaderBeautyTask[]) => {
        const sheets = new Set<string>();
        for (const task of tasks) {
            const css = cache.get(taskKey(task))?.css;
            // Repeated HUD rows share their sheet. Keep the last occurrence's
            // order so a later row still wins over an intervening author sheet.
            if (css) {sheets.delete(css);sheets.add(css);}
        }
        return Array.from(sheets).join('\n');
    };
    const hasDocuments = () => Array.from(cache.values()).some(value => value.fragments?.some(fragment => fragment.kind === 'author-document'));
    function executionFor(tasks?: readonly ReaderBeautyTask[]) {
        if (!tasks) return execution;
        const messages = tasks.flatMap(task => {
            const ref = displayRef(task);return ref ? [ref] : [];
        });
        return executionWindowKey === JSON.stringify(messages) ? execution : undefined;
    }
    return { selectScope, run, htmlFor, textFor, cssFor, failed, fragmentsFor, hasDocuments, readerFragmentsFor,
        execution: executionFor };
}
