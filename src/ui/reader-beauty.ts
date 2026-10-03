import { renderReaderNarrative, renderReaderNarrativeAsync, projectReaderNarrativeDisplay } from './reader-rendering.js';
import type { ReaderMvuDisplayScope } from './reader-rendering.js';
import type { MvuAcceptedDisplayUpdate } from '../core/roleplay-mvu-display-facts.js';
import { runReaderRegex } from './reader-regex.js';
import type { ReaderRule, SourceTask, FallbackTask, SourceResult, FallbackResult } from './reader-regex.js';

interface BeautyRendering {
    renderAsync?: typeof renderReaderNarrativeAsync;
    renderSync?: typeof renderReaderNarrative;
}

export type ReaderBeautyTask = string | {
    readonly text: string;
    readonly seq?: number;
    readonly messageId?: string;
    readonly displayUpdate?: MvuAcceptedDisplayUpdate;
};
const rawText = (task: ReaderBeautyTask) => typeof task === 'string' ? task : task.text;
const taskKey = (task: ReaderBeautyTask) => typeof task === 'string' ? JSON.stringify([task])
    : JSON.stringify([task.text, task.seq, task.messageId, task.displayUpdate ?? null]);

async function acceptedDisplayScope(task: ReaderBeautyTask): Promise<ReaderMvuDisplayScope | undefined> {
    if (typeof task === 'string' || task.text.length > 1_048_576) return;
    const update = task.displayUpdate, canonical = update?.canonical;
    if (!update || update.schemaVersion !== 1 || update.encoding !== 'native-mvu-accepted-display-update-v1'
        || !canonical || !Number.isSafeInteger(canonical.seq) || canonical.seq < 0
        || canonical.seq !== task.seq || !canonical.messageId || canonical.messageId !== task.messageId
        || !/^[a-f0-9]{64}$/.test(canonical.versionSha256) || !/^[a-f0-9]{64}$/.test(canonical.narrativeSha256)
        || !['native-jsonpatch-v1', 'native-mvu-update-v2'].includes(update.protocol)) return;
    const start = task.text.indexOf('<UpdateVariable>'), close = task.text.indexOf('</UpdateVariable>');
    if (start < 0 || close < start || !globalThis.crypto?.subtle) return;
    // A state response can lag a Native edit. Bind the displayed body before
    // minting a range; absence/failure keeps the complete original visible.
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(task.text));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== canonical.narrativeSha256) return;
    return {role: 'assistant', protocol: update.protocol,
        acceptedRange: {start, end: close + '</UpdateVariable>'.length}};
}

/** Committed-text rendering owns its scope, cancellation fence and bounded cache together. */
export function createReaderBeautyCache({
renderAsync = renderReaderNarrativeAsync, renderSync = renderReaderNarrative,
}: BeautyRendering = {}) {
    const cache = new Map<string, {html: string;text: string;error?: string;}>();
    let currentScope = '';

    function selectScope(scope: string) {
        if (currentScope !== scope) {
            cache.clear();
            currentScope = scope;
        }
    }

    function run(scope: string, tasks: readonly ReaderBeautyTask[], rules: ReaderRule[], changed: () => void) {
        if (!rules.length && !tasks.some(task => typeof task !== 'string' && task.displayUpdate)) return;
        let cancelled = false;
        function runBeautyRegex(task: SourceTask): Promise<SourceResult>;
        function runBeautyRegex(task: FallbackTask): Promise<FallbackResult>;
        function runBeautyRegex(task: SourceTask | FallbackTask): Promise<SourceResult | FallbackResult>;
        function runBeautyRegex(task: SourceTask | FallbackTask): Promise<SourceResult | FallbackResult> {
            if (cancelled) throw new Error('cancelled');
            return runReaderRegex(task);
        }

        void (async () => {
            for (const task of tasks) {
                if (cancelled) break;
                const key = taskKey(task), raw = rawText(task);
                if (cache.has(key)) continue;
                let displayScope: ReaderMvuDisplayScope | undefined;
                if (typeof task !== 'string' && task.displayUpdate) {
                    try { displayScope = await acceptedDisplayScope(task); } catch { }
                }
                if (cancelled || currentScope !== scope) break;
                const text = projectReaderNarrativeDisplay(raw, displayScope);
                let value;
                try {
                    value = { text, html: await renderAsync(raw, rules, runBeautyRegex, displayScope) };
                } catch (error) {
                    value = {
                        text, html: renderSync(raw, [], displayScope),

                        error: String(error && typeof error === 'object' && 'message' in error ? error.message : error),
                    };
                }
                // Scope can change during an await before effect cleanup runs. Both fences are required.
                if (cancelled || currentScope !== scope) break;
                cache.set(key, value);
                while (cache.size > 500) cache.delete(cache.keys().next().value!);
                changed();
            }
        })();
        return () => { cancelled = true; };
    }

    const htmlFor = (task: ReaderBeautyTask) => cache.get(taskKey(task))?.html ?? renderSync(rawText(task), []);
    const textFor = (task: ReaderBeautyTask) => cache.get(taskKey(task))?.text ?? rawText(task);
    const failed = (tasks: readonly ReaderBeautyTask[]) => tasks.some(task => cache.get(taskKey(task))?.error);
    return { selectScope, run, htmlFor, textFor, failed };
}
