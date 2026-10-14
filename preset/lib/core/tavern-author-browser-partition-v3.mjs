// Generated from runtime/alpha3/src/core/tavern-author-browser-partition-v3.mts; edit the TypeScript source.
/** Owned complete asynchronous V3 compiler. The historical partition filename
 * is a delivery seam; V3 compiles the complete Source and never partitions V2.
 * Completion, cancellation and disposal wait for actual Worker termination. */
import { Worker } from 'node:worker_threads';
import { BrowserBudgetError, quantifyBrowserTransport, freezeBrowserSnapshot } from './tavern-author-browser-budget.js';
import { loadOwnedAuthorBrowserArtifactV3, ownedBrowserAstWorkerURLV3, ownedBrowserCompilerIdentityV3, ownedBrowserRuntimeIdentityV3 } from './tavern-author-browser-artifact-v3.mjs';
/** Original AST alone took about 5.6 s. A fresh Worker also loads the parser,
 * builds full HTML DATA and assembles the complete program; V2's 5 s bound
 * would reject that supported input before complete compilation can finish. */
export const AUTHOR_BROWSER_COMPILE_BUDGET_V3 = Object.freeze({ deadlineMs: 30_000,
    maxOldGenerationSizeMb: 512, stackSizeMb: 4 });
const refused = (code) => ({ kind: 'refused', diagnostics: [{ code }] });
export function createOwnedAuthorBrowserCompilerV3() {
    const artifact = loadOwnedAuthorBrowserArtifactV3(), workerUrl = ownedBrowserAstWorkerURLV3(artifact);
    const identity = ownedBrowserCompilerIdentityV3(artifact), runtime = ownedBrowserRuntimeIdentityV3(artifact);
    let disposed = false, disposal;
    const active = new Map();
    async function compile(input, signal) {
        if (disposed)
            return refused('BROWSER_AST_COMPILER_DISPOSED');
        if (signal?.aborted)
            return refused('BROWSER_AST_CANCELLED');
        if (active.size)
            return refused('BROWSER_AST_COMPILER_BUSY');
        let worker;
        try {
            // Complete V3 Source resources are required by cross-realm proof. Only
            // these input fields cross the Worker boundary; posted artifacts do not.
            const wire = { schemaVersion: input.schemaVersion, encoding: input.encoding,
                source: input.source, scripts: input.scripts, sourcePages: input.sourcePages, sourceResources: input.sourceResources };
            quantifyBrowserTransport(wire);
            worker = new Worker(workerUrl, { workerData: wire, execArgv: [], env: { TZ: 'UTC' },
                resourceLimits: { maxOldGenerationSizeMb: AUTHOR_BROWSER_COMPILE_BUDGET_V3.maxOldGenerationSizeMb,
                    stackSizeMb: AUTHOR_BROWSER_COMPILE_BUDGET_V3.stackSizeMb } });
        }
        catch (error) {
            return refused(error instanceof BrowserBudgetError ? error.code : 'BROWSER_AST_WORKER_UNAVAILABLE');
        }
        let release;
        const closed = new Promise(resolve => { release = resolve; });
        let outcome;
        try {
            outcome = await new Promise(resolve => {
                let settled = false;
                const finish = (result) => {
                    if (settled)
                        return;
                    settled = true;
                    clearTimeout(timer);
                    signal?.removeEventListener('abort', abort);
                    resolve(result);
                };
                const abort = () => finish(refused('BROWSER_AST_CANCELLED'));
                const timer = setTimeout(() => finish(refused('BROWSER_AST_HARD_TIMEOUT')), AUTHOR_BROWSER_COMPILE_BUDGET_V3.deadlineMs);
                active.set(worker, { finish, closed });
                signal?.addEventListener('abort', abort, { once: true });
                worker.once('message', (result) => finish(result));
                worker.once('error', () => finish(refused('BROWSER_AST_WORKER_UNAVAILABLE')));
                worker.once('exit', () => finish(refused('BROWSER_AST_WORKER_EXIT')));
                if (signal?.aborted)
                    abort();
                if (disposed)
                    finish(refused('BROWSER_AST_COMPILER_DISPOSED'));
            });
        }
        finally {
            // A result is tentative until the CPU/memory owner has really stopped.
            // The same termination boundary closes successful and refused work.
            try {
                await worker.terminate();
            }
            finally {
                active.delete(worker);
                release();
            }
        }
        if (signal?.aborted)
            return refused('BROWSER_AST_CANCELLED');
        if (disposed)
            return refused('BROWSER_AST_COMPILER_DISPOSED');
        return freezeBrowserSnapshot(outcome);
    }
    return { identity, runtime, artifact, compile, dispose() {
            if (disposal)
                return disposal;
            disposed = true;
            const closing = [...active.values()];
            for (const held of closing)
                held.finish(refused('BROWSER_AST_COMPILER_DISPOSED'));
            return disposal = Promise.all(closing.map(held => held.closed)).then(() => undefined);
        } };
}
