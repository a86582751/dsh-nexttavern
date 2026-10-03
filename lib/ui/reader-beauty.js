// Generated from runtime/alpha3/src/ui/reader-beauty.ts; edit the TypeScript source.
import { renderReaderNarrative, renderReaderNarrativeAsync, projectReaderNarrativeDisplay } from './reader-rendering.js';
import { runReaderRegex } from './reader-regex.js';
const rawText = (task) => typeof task === 'string' ? task : task.text;
const taskKey = (task) => typeof task === 'string' ? JSON.stringify([task])
    : JSON.stringify([task.text, task.seq, task.messageId, task.displayUpdate ?? null]);
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
    const start = task.text.indexOf('<UpdateVariable>'), close = task.text.indexOf('</UpdateVariable>');
    if (start < 0 || close < start || !globalThis.crypto?.subtle)
        return;
    // A state response can lag a Native edit. Bind the displayed body before
    // minting a range; absence/failure keeps the complete original visible.
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(task.text));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== canonical.narrativeSha256)
        return;
    return { role: 'assistant', protocol: update.protocol,
        acceptedRange: { start, end: close + '</UpdateVariable>'.length } };
}
/** Committed-text rendering owns its scope, cancellation fence and bounded cache together. */
export function createReaderBeautyCache({ renderAsync = renderReaderNarrativeAsync, renderSync = renderReaderNarrative, } = {}) {
    const cache = new Map();
    let currentScope = '';
    function selectScope(scope) {
        if (currentScope !== scope) {
            cache.clear();
            currentScope = scope;
        }
    }
    function run(scope, tasks, rules, changed) {
        if (!rules.length && !tasks.some(task => typeof task !== 'string' && task.displayUpdate))
            return;
        let cancelled = false;
        function runBeautyRegex(task) {
            if (cancelled)
                throw new Error('cancelled');
            return runReaderRegex(task);
        }
        void (async () => {
            for (const task of tasks) {
                if (cancelled)
                    break;
                const key = taskKey(task), raw = rawText(task);
                if (cache.has(key))
                    continue;
                let displayScope;
                if (typeof task !== 'string' && task.displayUpdate) {
                    try {
                        displayScope = await acceptedDisplayScope(task);
                    }
                    catch { }
                }
                if (cancelled || currentScope !== scope)
                    break;
                const text = projectReaderNarrativeDisplay(raw, displayScope);
                let value;
                try {
                    value = { text, html: await renderAsync(raw, rules, runBeautyRegex, displayScope) };
                }
                catch (error) {
                    value = {
                        text, html: renderSync(raw, [], displayScope),
                        error: String(error && typeof error === 'object' && 'message' in error ? error.message : error),
                    };
                }
                // Scope can change during an await before effect cleanup runs. Both fences are required.
                if (cancelled || currentScope !== scope)
                    break;
                cache.set(key, value);
                while (cache.size > 500)
                    cache.delete(cache.keys().next().value);
                changed();
            }
        })();
        return () => { cancelled = true; };
    }
    const htmlFor = (task) => cache.get(taskKey(task))?.html ?? renderSync(rawText(task), []);
    const textFor = (task) => cache.get(taskKey(task))?.text ?? rawText(task);
    const failed = (tasks) => tasks.some(task => cache.get(taskKey(task))?.error);
    return { selectScope, run, htmlFor, textFor, failed };
}
