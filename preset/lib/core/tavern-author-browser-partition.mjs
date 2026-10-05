// Generated from runtime/alpha3/src/core/tavern-author-browser-partition.mts; edit the TypeScript source.
/** Fixed-loader factory. No author AST executes on this thread. Completion,
 * cancellation and disposal settle only after the actual worker terminates. */
import { Worker } from 'node:worker_threads';
import { quantifyBrowserTransport, freezeBrowserSnapshot } from './tavern-author-browser-budget.js';
import { loadOwnedAuthorBrowserArtifactV1, ownedBrowserAstWorkerURLV1, ownedBrowserCompilerIdentityV1 } from './tavern-author-browser-artifact.mjs';
const parentDeadlineMs = 5000;
const refused = (code) => ({ kind: 'refused', diagnostics: [{ code }] });
export function createBrowserPartitionCompilerV1() {
    const artifact = loadOwnedAuthorBrowserArtifactV1(), workerUrl = ownedBrowserAstWorkerURLV1(artifact);
    const identity = ownedBrowserCompilerIdentityV1(artifact);
    let disposed = false, disposal;
    const active = new Map();
    async function partition(input, signal) {
        if (disposed)
            return refused('BROWSER_AST_COMPILER_DISPOSED');
        if (signal?.aborted)
            return refused('BROWSER_AST_CANCELLED');
        if (active.size)
            return refused('BROWSER_AST_COMPILER_BUSY');
        let worker;
        try {
            // Select the code contract explicitly. A caller's extra complete Source
            // material cannot accidentally cross this worker boundary.
            const source = input.source;
            const wire = { schemaVersion: input.schemaVersion, encoding: input.encoding,
                source: { ownerSessionId: source.ownerSessionId, sourceRecordSessionId: source.sourceRecordSessionId,
                    importId: source.importId, sourceSha256: source.sourceSha256, importRecordSha256: source.importRecordSha256,
                    sourceSnapshotSha256: source.sourceSnapshotSha256, materialSha256: source.materialSha256 },
                scripts: input.scripts.map(({ ordinal, descriptor }) => ({ ordinal, descriptor: { identity: descriptor.identity,
                        pointer: descriptor.pointer, enabled: descriptor.enabled, source: descriptor.source, sourceSha256: descriptor.sourceSha256,
                        imports: descriptor.imports.map(({ specifier, kind, implementationSha256 }) => ({ specifier, kind, implementationSha256 })) } })) };
            quantifyBrowserTransport(wire);
            worker = new Worker(workerUrl, { workerData: wire, execArgv: [], env: { TZ: 'UTC' },
                resourceLimits: { maxOldGenerationSizeMb: 256, stackSizeMb: 4 } });
        }
        catch {
            return refused('BROWSER_AST_WORKER_UNAVAILABLE');
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
                const timer = setTimeout(() => finish(refused('BROWSER_AST_HARD_TIMEOUT')), parentDeadlineMs);
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
            // A message is still only tentative while the worker can consume memory
            // or execute. This finally is also shared by timeout and cancellation.
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
    return { identity, runtime: artifact.identity, artifact, partition,
        dispose() {
            if (disposal)
                return disposal;
            disposed = true;
            const closing = [...active.values()];
            for (const held of closing)
                held.finish(refused('BROWSER_AST_COMPILER_DISPOSED'));
            return disposal = Promise.all(closing.map(held => held.closed)).then(() => undefined);
        } };
}
