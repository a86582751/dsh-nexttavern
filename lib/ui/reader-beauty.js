// Generated from runtime/alpha3/src/ui/reader-beauty.ts; edit the TypeScript source.
import { renderReaderNarrative, renderReaderNarrativeAsync } from './reader-rendering.js';
import { runReaderRegex } from './reader-regex.js';
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
        if (!rules.length)
            return;
        let cancelled = false;
        function runBeautyRegex(task) {
            if (cancelled)
                throw new Error('cancelled');
            return runReaderRegex(task);
        }
        void (async () => {
            for (const raw of tasks) {
                if (cancelled)
                    break;
                if (cache.has(raw))
                    continue;
                let value;
                try {
                    value = { html: await renderAsync(raw, rules, runBeautyRegex) };
                }
                catch (error) {
                    value = {
                        html: renderSync(raw, []),
                        error: String(error && typeof error === 'object' && 'message' in error ? error.message : error),
                    };
                }
                // Scope can change during an await before effect cleanup runs. Both fences are required.
                if (cancelled || currentScope !== scope)
                    break;
                cache.set(raw, value);
                while (cache.size > 500)
                    cache.delete(cache.keys().next().value);
                changed();
            }
        })();
        return () => { cancelled = true; };
    }
    const htmlFor = (raw) => cache.get(raw)?.html ?? renderSync(raw, []);
    const failed = (tasks) => tasks.some(raw => cache.get(raw)?.error);
    return { selectScope, run, htmlFor, failed };
}
