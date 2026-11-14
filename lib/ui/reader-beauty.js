// Generated from runtime/alpha3/src/ui/reader-beauty.ts; edit the TypeScript source.
import { renderReaderNarrative, renderReaderNarrativeAsync, projectReaderNarrativeDisplay, sanitizeReaderNarrativeHtml } from './reader-rendering.js';
import { runReaderRegex } from './reader-regex.js';
import { prepareStaticAuthorDocument } from './author-runtime.js';
const rawText = (task) => typeof task === 'string' ? task : task.text;
const taskKey = (task) => typeof task === 'string' ? JSON.stringify([task])
    : JSON.stringify([task.text, task.canonicalText ?? null, task.seq, task.messageId, task.displayUpdate ?? null]);
const displayRef = (task) => typeof task !== 'string' && Number.isSafeInteger(task.seq) && Number(task.seq) >= 0 && task.messageId
    ? { seq: task.seq, messageId: task.messageId } : undefined;
const pendingDisplayText = '正在读取显示内容…';
const pendingDisplayHtml = '<p role="status">' + pendingDisplayText + '</p>';
async function acceptedDisplayScope(task) {
    if (typeof task === 'string' || task.text.length > 1_048_576)
        return;
    const update = task.displayUpdate, canonical = update?.canonical;
    if (!update || update.schemaVersion !== 1 || update.encoding !== 'native-mvu-accepted-display-update-v1'
        || !canonical || !Number.isSafeInteger(canonical.seq) || canonical.seq < 0
        || canonical.seq !== task.seq || !canonical.messageId || canonical.messageId !== task.messageId
        || !/^[a-f0-9]{64}$/.test(canonical.versionSha256) || !/^[a-f0-9]{64}$/.test(canonical.narrativeSha256)
        || !['native-jsonpatch-v1', 'native-mvu-update-v2'].includes(update.protocol))
        return;
    const canonicalText = task.canonicalText ?? task.text;
    const start = canonicalText.indexOf('<UpdateVariable>'), close = canonicalText.indexOf('</UpdateVariable>');
    if (start < 0 || close < start || !globalThis.crypto?.subtle)
        return;
    // A state response can lag a Native edit. Bind the displayed body before
    // minting a range; absence/failure keeps the complete original visible.
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalText));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== canonical.narrativeSha256)
        return;
    const acceptedText = canonicalText.slice(start, close + '</UpdateVariable>'.length), displayStart = task.text.indexOf(acceptedText);
    if (displayStart < 0)
        return;
    return { role: 'assistant', protocol: update.protocol,
        acceptedRange: { start: displayStart, end: displayStart + acceptedText.length } };
}
/** Committed-text rendering owns its scope, cancellation fence and bounded cache together. */
export function createReaderBeautyCache({ renderAsync = renderReaderNarrativeAsync, renderSync = renderReaderNarrative, } = {}) {
    const cache = new Map();
    const fallbackHtml = new Map();
    let execution;
    let executionWindowKey;
    let currentScope = '';
    let cancelActive;
    let forceRead = false;
    function selectScope(scope) {
        if (currentScope !== scope) {
            cancelActive?.();
            cache.clear();
            fallbackHtml.clear();
            execution = undefined;
            executionWindowKey = undefined;
            currentScope = scope;
            forceRead = false;
        }
    }
    function run(scope, tasks, rules, changed, display) {
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
        const retry = forceRead;
        forceRead = false;
        if ((!retry && !pending.length && windowKey === executionWindowKey) || !rules.length && !messages.length
            && !pending.some(task => typeof task !== 'string' && task.displayUpdate))
            return;
        let cancelled = false;
        const controller = new AbortController();
        const cancel = () => { cancelled = true; controller.abort(); };
        cancelActive = cancel;
        const stale = () => cancelled || controller.signal.aborted || currentScope !== scope;
        function runBeautyRegex(task) {
            if (stale())
                throw new Error('cancelled');
            return runReaderRegex(task, controller.signal);
        }
        void (async () => {
            if (stale())
                return;
            let response, displayError;
            let phase;
            const completedHtml = new Map();
            try {
                if (display && messages.length) {
                    try {
                        response = await display.read(display.sessionId, messages, controller.signal);
                    }
                    catch (error) {
                        displayError = error;
                    }
                }
                phase = response?.phase;
                if (stale())
                    return;
                if (phase && response)
                    try {
                        if (!display?.renderHtml)
                            throw Error('READER_HTML_PHASE_TRANSPORT_UNAVAILABLE');
                        const rows = [];
                        for (const row of response.rows) {
                            const task = tasks.find(task => typeof task !== 'string' && task.seq === row.seq && task.messageId === row.messageId);
                            if (!task || row.rawText !== (typeof task === 'string' ? task : task.canonicalText ?? task.text)) {
                                throw Error('READER_REGEX_TARGET_CHANGED');
                            }
                            const narrative = [];
                            if (row.fragments) {
                                for (const [fragmentIndex, fragment] of row.fragments.entries())
                                    if (fragment.kind === 'text') {
                                        narrative.push({ fragmentIndex, html: await renderAsync(fragment.text, rules, runBeautyRegex) });
                                    }
                            }
                            else
                                narrative.push({ fragmentIndex: null, html: await renderAsync(row.displayText, rules, runBeautyRegex) });
                            if (stale())
                                return;
                            rows.push({ seq: row.seq, messageId: row.messageId, messageVersionSha256: row.messageVersionSha256, narrative });
                        }
                        const result = await display.renderHtml({ binding: phase, rows }, controller.signal);
                        if (stale())
                            return;
                        for (const [index, row] of response.rows.entries()) {
                            const slots = result.narrative.filter(slot => slot.row === index), fragments = [];
                            let whole;
                            for (const slot of slots) {
                                const html = sanitizeReaderNarrativeHtml(slot.html);
                                if (slot.fragmentIndex === null)
                                    whole = html;
                                else
                                    fragments.push(html);
                            }
                            completedHtml.set(row.seq + ':' + row.messageId, { whole, fragments });
                        }
                        response = result.display;
                    }
                    catch (error) {
                        displayError = error;
                        response = undefined;
                    }
                // Intern only this visible read batch, preferring an unchanged row's
                // existing sheet. Row/scope ownership still lives in the cache.
                const cssPool = new Map();
                const projections = new Map(tasks.flatMap(task => {
                    const ref = displayRef(task);
                    const row = response && response.sessionId === display?.sessionId && ref
                        ? response.rows.find(row => row.seq === ref.seq && row.messageId === ref.messageId
                            && row.rawText === (typeof task === 'string' ? task : task.canonicalText ?? task.text)) : undefined;
                    if (!row)
                        return [];
                    const key = taskKey(task), priorCss = cache.get(key)?.css;
                    if (row.css && priorCss === row.css)
                        cssPool.set(row.css, priorCss);
                    return [[key, row]];
                }));
                const acceptedExecution = projections.size === messages.length ? response?.execution : undefined;
                const compilerError = response?.compilerDiagnostics?.map(row => row.code).join(', ');
                for (const task of tasks) {
                    if (stale())
                        break;
                    const key = taskKey(task), raw = rawText(task);
                    const ref = displayRef(task);
                    const projection = projections.get(key);
                    const cached = cache.get(key);
                    if (cached && !projection)
                        continue;
                    let css = projection?.css;
                    if (css) {
                        css = cssPool.get(css) ?? css;
                        cssPool.set(css, css);
                    }
                    let displayScope;
                    // Core has already applied the accepted MVU projection before ST.
                    // Its rewritten text must never receive offsets from the raw body.
                    if (!projection && typeof task !== 'string' && task.displayUpdate) {
                        try {
                            displayScope = await acceptedDisplayScope(task);
                        }
                        catch { }
                    }
                    if (stale())
                        break;
                    const source = projection ? projection.displayText : raw;
                    const text = projection ? source : projectReaderNarrativeDisplay(raw, displayScope);
                    // A successful read after paging can replace a cached fallback.
                    // Reuse rendered output only while its display input is unchanged.
                    const previousDisplay = cached?.text === text ? cached : undefined;
                    const completed = ref ? completedHtml.get(ref.seq + ':' + ref.messageId) : undefined;
                    let value;
                    try {
                        // Executable documents already have their own admitted plans.
                        // Their residual text alone belongs to narrative rendering.
                        value = { text, html: projection?.fragments && acceptedExecution ? ''
                                : completed?.whole ?? previousDisplay?.html ?? await renderAsync(source, rules, runBeautyRegex, displayScope),
                            css };
                        if (projection?.fragments) {
                            const fragments = [];
                            const readerFragments = [];
                            const narrativeHtml = [];
                            const previousFragments = previousDisplay?.readerFragments ?? previousDisplay?.fragments;
                            let documents = 0, readerDocuments = 0;
                            let narrativeIndex = 0;
                            for (const [index, fragment] of projection.fragments.entries()) {
                                const previous = previousFragments?.[index];
                                if (fragment.kind === 'author-document' && fragment.documentPending) {
                                    const html = previous?.kind === 'pending-document' ? previous.html
                                        : prepareStaticAuthorDocument(document, fragment.parts) ?? '';
                                    readerFragments.push({ kind: 'pending-document', code: fragment.documentDiagnostics?.map(row => row.code).join(', ')
                                            ?? compilerError ?? 'READER_DOCUMENT_RUNTIME_UNAVAILABLE', html });
                                    readerDocuments++;
                                    continue;
                                }
                                if (fragment.kind === 'author-document' && fragment.documentDiagnostics?.length) {
                                    const html = previous?.kind === 'failed-document' ? previous.html
                                        : prepareStaticAuthorDocument(document, fragment.parts) ?? '';
                                    readerFragments.push({ kind: 'failed-document',
                                        code: fragment.documentDiagnostics.map(row => row.code).join(', '), html });
                                    readerDocuments++;
                                    continue;
                                }
                                if (fragment.kind === 'author-document' && fragment.documentPlanSha256 && acceptedExecution) {
                                    readerFragments.push({ kind: 'reader-document', documentPlanSha256: fragment.documentPlanSha256 });
                                    readerDocuments++;
                                    continue;
                                }
                                const html = fragment.kind === 'author-document'
                                    ? previous?.kind === 'static-document' ? previous.html
                                        : prepareStaticAuthorDocument(document, fragment.parts) : undefined;
                                if (html !== undefined) {
                                    fragments.push({ kind: 'author-document', html });
                                    documents++;
                                    readerFragments.push({ kind: 'static-document', html });
                                }
                                else {
                                    const raw = fragment.kind === 'text' ? fragment.text : fragment.parts.map(part => part.text).join('');
                                    const html = fragment.kind === 'text' && completed
                                        ? completed.fragments[narrativeIndex++] ?? ''
                                        : previous?.kind === 'text' ? previous.html : await renderAsync(raw, rules, runBeautyRegex);
                                    fragments.push({ kind: 'text', html });
                                    readerFragments.push({ kind: 'text', html });
                                    narrativeHtml.push(html);
                                }
                            }
                            if (documents)
                                value = { ...value, fragments };
                            if (readerDocuments || documents)
                                value = { ...value, readerFragments };
                            if (acceptedExecution)
                                value.html = narrativeHtml.join('\n');
                        }
                    }
                    catch (error) {
                        value = {
                            text, html: renderSync(source, [], displayScope),
                            css,
                            error: String(error && typeof error === 'object' && 'message' in error ? error.message : error),
                        };
                    }
                    if (projection?.renderDiagnostics?.length)
                        value = { ...value,
                            error: projection.renderDiagnostics.map(diagnostic => diagnostic.code).join(', ') };
                    if (displayError && ref)
                        value = { ...value,
                            error: String(displayError && typeof displayError === 'object' && 'message' in displayError
                                ? displayError.message : displayError) };
                    if (response?.documentDiagnostics?.length)
                        value = { ...value,
                            error: response.documentDiagnostics.map(row => row.code).join(', ') };
                    if (compilerError)
                        value = { ...value, compilerError };
                    // Scope can change during an await before effect cleanup runs. Both fences are required.
                    if (stale())
                        break;
                    cache.set(key, value);
                    while (cache.size > 500)
                        cache.delete(cache.keys().next().value);
                    changed();
                }
                // Publish only after every plan has its actual visible container.
                // Earlier text rendering may complete while this batch is awaiting.
                if (!stale() && response) {
                    execution = acceptedExecution;
                    executionWindowKey = compilerError && !acceptedExecution ? undefined : windowKey;
                    changed();
                }
            }
            finally {
                // Cleanup is independent of the cancelled render's signal.
                if (phase)
                    await display?.releasePhase?.(phase).catch(() => { });
            }
        })().finally(() => { if (cancelActive === cancel)
            cancelActive = undefined; });
        return cancel;
    }
    const htmlFor = (task, displayEnabled = false) => {
        const rendered = cache.get(taskKey(task))?.html;
        if (rendered !== undefined)
            return rendered;
        // The same eligibility used by run owns this asynchronous Source read.
        // Its first render cannot display raw Native text before that read settles.
        if (displayEnabled && displayRef(task))
            return pendingDisplayHtml;
        const text = rawText(task);
        // Raw HTML is keyed by its complete text, independently of Source/regex
        // completion. A fallback must never suppress the pending display task.
        // String tasks are the growing stream; retaining each prefix would evict history.
        if (typeof task === 'string')
            return renderSync(text, []);
        let html = fallbackHtml.get(text);
        if (html === undefined)
            html = renderSync(text, []);
        else
            fallbackHtml.delete(text);
        fallbackHtml.set(text, html);
        while (fallbackHtml.size > 500)
            fallbackHtml.delete(fallbackHtml.keys().next().value);
        return html;
    };
    const textFor = (task, displayEnabled = false) => cache.get(taskKey(task))?.text
        ?? (displayEnabled && displayRef(task) ? pendingDisplayText : rawText(task));
    const errors = (tasks) => Array.from(new Set(tasks
        .map(task => cache.get(taskKey(task))?.error).filter((code) => !!code))).join(', ');
    const failed = (tasks) => !!errors(tasks);
    const compilerError = (tasks) => Array.from(new Set(tasks
        .map(task => cache.get(taskKey(task))?.compilerError).filter((code) => !!code))).join(', ');
    const fragmentsFor = (task) => cache.get(taskKey(task))?.fragments;
    const readerFragmentsFor = (task) => cache.get(taskKey(task))?.readerFragments;
    const cssFor = (tasks) => {
        const sheets = new Set();
        for (const task of tasks) {
            const css = cache.get(taskKey(task))?.css;
            // Repeated HUD rows share their sheet. Keep the last occurrence's
            // order so a later row still wins over an intervening author sheet.
            if (css) {
                sheets.delete(css);
                sheets.add(css);
            }
        }
        return Array.from(sheets).join('\n');
    };
    const hasDocuments = () => Array.from(cache.values()).some(value => value.fragments?.some(fragment => fragment.kind === 'author-document'));
    function executionFor(tasks) {
        if (!tasks)
            return execution;
        const messages = tasks.flatMap(task => {
            const ref = displayRef(task);
            return ref ? [ref] : [];
        });
        return executionWindowKey === JSON.stringify(messages) ? execution : undefined;
    }
    return { selectScope, run, htmlFor, textFor, cssFor, failed, errors, compilerError, fragmentsFor, hasDocuments, readerFragmentsFor,
        retryCompilation() { forceRead = true; },
        execution: executionFor };
}
