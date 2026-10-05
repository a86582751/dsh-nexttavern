// Generated from runtime/alpha3/src/core/tavern-author-prompt-runtime.mts; edit the TypeScript source.
import { Worker } from 'node:worker_threads';
import { PROMPT_BOUNDS_V1 as bounds } from './tavern-author-prompt-profile.mjs';
import { createAuthorPromptCompilerV1 } from './tavern-author-prompt-compiler.mjs';
import { validatePromptProgramV1 } from './tavern-author-prompt-data.mjs';
/** One worker per compilation/preparation. Resolution waits for termination,
 * so a timed-out/cancelled realm cannot outlive the returned result. */
async function dispatchPromptWorkerV1(workerURL, request, signal) {
    if (signal?.aborted)
        return { kind: 'cancelled', diagnostics: [{ code: 'PROMPT_CANCELLED' }] };
    const worker = new Worker(workerURL, {
        workerData: request, resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    let timer, abort;
    try {
        return await new Promise((resolve) => {
            let settled = false;
            const finish = (result) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                if (abort)
                    signal?.removeEventListener('abort', abort);
                void worker.terminate().then(() => resolve(result), () => resolve({ kind: 'refused', diagnostics: [{ code: 'PROMPT_TERMINATION_FAILED' }] }));
            };
            abort = () => finish({ kind: 'cancelled', diagnostics: [{ code: 'PROMPT_CANCELLED' }] });
            signal?.addEventListener('abort', abort, { once: true });
            timer = setTimeout(() => finish({ kind: 'refused', diagnostics: [{ code: 'PROMPT_WORKER_TIMEOUT' }] }), bounds.parentDeadlineMs);
            worker.once('message', finish);
            worker.once('error', () => finish({ kind: 'refused', diagnostics: [{ code: 'PROMPT_WORKER_FAILED' }] }));
            worker.once('exit', () => finish({ kind: 'refused', diagnostics: [{ code: 'PROMPT_WORKER_EXIT' }] }));
            if (signal?.aborted)
                abort();
        });
    }
    finally {
        clearTimeout(timer);
        if (abort)
            signal?.removeEventListener('abort', abort);
    }
}
/** Caller supplies the captured Source/Native view. Reusing this returned DATA
 * for provider retries belongs to the caller's existing prepared-plan owner. */
export async function runAuthorPromptProgramV1(program, capture, dependencies) {
    try {
        const decoded = validatePromptProgramV1(program);
        const result = await dependencies.dispatch({ kind: 'execute', program: decoded, capture }, dependencies.signal);
        return 'rows' in result ? { kind: 'refused', diagnostics: [{ code: 'PROMPT_WORKER_RESPONSE' }] } : result;
    }
    catch (error) {
        return { kind: 'refused', diagnostics: [{ code: error instanceof Error
                        && error.message === 'PROMPT_PROGRAM_DATA_INVALID' ? error.message : 'PROMPT_WORKER_FAILED' }] };
    }
}
/** The protected provider fixes the binding once. This owner alone dispatches
 * and revokes all its compilation and execution workers. */
export function createAuthorPromptExecutionOwnerV1(binding) {
    let disposed = false, disposal;
    const running = new Map();
    const admittedPrograms = new Set();
    const checkCurrent = () => { if (disposed)
        throw Error('PROMPT_RUNTIME_DISPOSED'); };
    const dispatch = (request, signal) => {
        checkCurrent();
        const controller = new AbortController(), abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted)
            abort();
        const result = dispatchPromptWorkerV1(binding.worker, request, controller.signal)
            .finally(() => { signal?.removeEventListener('abort', abort); running.delete(controller); });
        running.set(controller, result);
        return result;
    };
    const compiler = createAuthorPromptCompilerV1({ ...binding, dispatch, accept: program => admittedPrograms.add(program.programSha256) });
    return Object.freeze({ compiler, runtime: binding.runtime, checkCurrent,
        async execute(program, capture, signal) {
            checkCurrent();
            if (!admittedPrograms.has(program.programSha256))
                return { kind: 'refused', diagnostics: [{ code: 'PROMPT_PROGRAM_NOT_COMPILED' }] };
            const result = await runAuthorPromptProgramV1(program, capture, { dispatch, signal });
            checkCurrent();
            return result;
        }, dispose() {
            if (disposal)
                return disposal;
            disposed = true;
            for (const controller of running.keys())
                controller.abort();
            return disposal = Promise.allSettled([...running.values()]).then(() => { admittedPrograms.clear(); });
        } });
}
