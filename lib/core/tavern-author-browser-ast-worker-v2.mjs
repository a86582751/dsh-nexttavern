// Generated from runtime/alpha3/src/core/tavern-author-browser-ast-worker-v2.mts; edit the TypeScript source.
/** A real worker owns the complete AST operation and the constructor-private
 * batch. Only finished DATA leaves this process; author code is never run. */
import { parentPort, workerData } from 'node:worker_threads';
import { createBrowserCompilerV2 } from './tavern-author-browser-compiler-v2.mjs';
import { loadOwnedAuthorBrowserArtifactV2 } from './tavern-author-browser-artifact-v2.mjs';
const port = parentPort;
if (!port)
    throw Error('BROWSER_AST_WORKER_PORT_MISSING');
try {
    const compiler = createBrowserCompilerV2(loadOwnedAuthorBrowserArtifactV2());
    const batch = compiler.compileCandidates(workerData);
    const browserOrdinals = batch.rows.filter(row => row.kind === 'compiled' || row.kind === 'disabled').map(row => row.ordinal);
    const serverOrdinals = batch.rows.filter(row => row.kind === 'refused' && row.descriptor.enabled).map(row => row.ordinal);
    if (browserOrdinals.length) {
        const assembled = compiler.assembleAccepted(batch, browserOrdinals);
        const result = assembled.kind === 'refused' ? assembled : { kind: 'partitioned', source: batch.source,
            browserProgram: assembled.program, serverOrdinals };
        port.postMessage(result);
    }
    else
        port.postMessage({ kind: 'partitioned', source: batch.source, browserProgram: null, serverOrdinals });
}
catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const result = { kind: 'refused',
        diagnostics: [{ code: /^BROWSER_[A-Z0-9_]+$/.test(raw) ? raw : 'BROWSER_AST_WORKER_FAILED' }] };
    port.postMessage(result);
}
