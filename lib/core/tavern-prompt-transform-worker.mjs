// Generated from runtime/alpha3/src/core/tavern-prompt-transform-worker.mts; edit the TypeScript source.
import { parentPort, workerData } from 'node:worker_threads';
import { executeTavernPromptTransformsV1 } from './tavern-prompt-transform-execution.mjs';
function processBatch(data) {
    try {
        const result = executeTavernPromptTransformsV1(data);
        // Transport packing follows canonical receipt/hash construction. The three
        // originals remain owned by the bounded caller's admitted batch input.
        const message = data.projectionTransport === 'input-backed' && result.kind === 'transformed'
            ? { kind: 'transformed', output: { ...result.output, entries: result.output.entries.map(({ rawText: _rawText, storyText: _storyText, inputText: _inputText, ...projection }) => projection) },
                ...(result.displayProvenance ? { displayProvenance: result.displayProvenance } : {}) }
            : result;
        parentPort?.postMessage(message);
    }
    catch {
        const diagnostic = { schemaVersion: 1,
            code: 'PROMPT_TRANSFORM_WORKER', entryKey: null, ruleId: null, macro: null, limit: null };
        parentPort?.postMessage({ kind: 'refused', diagnostics: [diagnostic] });
    }
}
if (workerData !== undefined)
    processBatch(workerData);
else {
    // Ready workers reuse trusted imports; each executor invocation owns its
    // compiled rules, macro state and display-provenance journal independently.
    parentPort?.on('message', processBatch);
    parentPort?.postMessage({ kind: 'ready' });
}
