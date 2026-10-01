import { renderReaderNarrative, renderReaderNarrativeAsync } from './reader-rendering.js';
import { runReaderRegex } from './reader-regex.js';
import type { ReaderRule, SourceTask, FallbackTask, SourceResult, FallbackResult } from './reader-regex.js';

interface BeautyRendering {
    renderAsync?: typeof renderReaderNarrativeAsync;
    renderSync?: typeof renderReaderNarrative;
}

/** Committed-text rendering owns its scope, cancellation fence and bounded cache together. */
export function createReaderBeautyCache({
renderAsync = renderReaderNarrativeAsync, renderSync = renderReaderNarrative,
}: BeautyRendering = {}) {
    const cache = new Map<string, {html: string;error?: string;}>();
    let currentScope = '';

    function selectScope(scope: string) {
        if (currentScope !== scope) {
            cache.clear();
            currentScope = scope;
        }
    }

    function run(scope: string, tasks: readonly string[], rules: ReaderRule[], changed: () => void) {
        if (!rules.length) return;
        let cancelled = false;
        function runBeautyRegex(task: SourceTask): Promise<SourceResult>;
        function runBeautyRegex(task: FallbackTask): Promise<FallbackResult>;
        function runBeautyRegex(task: SourceTask | FallbackTask): Promise<SourceResult | FallbackResult>;
        function runBeautyRegex(task: SourceTask | FallbackTask): Promise<SourceResult | FallbackResult> {
            if (cancelled) throw new Error('cancelled');
            return runReaderRegex(task);
        }

        void (async () => {
            for (const raw of tasks) {
                if (cancelled) break;
                if (cache.has(raw)) continue;
                let value;
                try {
                    value = { html: await renderAsync(raw, rules, runBeautyRegex) };
                } catch (error) {
                    value = {
                        html: renderSync(raw, []),

                        error: String(error && typeof error === 'object' && 'message' in error ? error.message : error),
                    };
                }
                // Scope can change during an await before effect cleanup runs. Both fences are required.
                if (cancelled || currentScope !== scope) break;
                cache.set(raw, value);
                while (cache.size > 500) cache.delete(cache.keys().next().value!);
                changed();
            }
        })();
        return () => { cancelled = true; };
    }

    const htmlFor = (raw: string) => cache.get(raw)?.html ?? renderSync(raw, []);
    const failed = (tasks: readonly string[]) => tasks.some(raw => cache.get(raw)?.error);
    return { selectScope, run, htmlFor, failed };
}
