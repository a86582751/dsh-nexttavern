// Generated from runtime/alpha3/compat/session-persistence-jsonl/src/migration-verifier.ts; edit the TypeScript source.
/** Isolated verification for a staged or competing current JSONL generation. */
import { Worker } from 'node:worker_threads';
/** Process-wide memory bound for full-generation verification isolates. */
const MAX_CONCURRENT_VERIFIERS = 2;
class VerificationScheduler {
    active = 0;
    waiting = [];
    async run(operation, signal) {
        const permit = this.acquire(signal);
        if (permit !== undefined)
            await permit;
        try {
            signal?.throwIfAborted();
            return await operation();
        }
        finally {
            this.release();
        }
    }
    acquire(signal) {
        signal?.throwIfAborted();
        if (this.active < MAX_CONCURRENT_VERIFIERS) {
            this.active += 1;
            return;
        }
        return new Promise((resolve, reject) => {
            const waiter = {
                grant: () => {
                    signal?.removeEventListener('abort', abort);
                    resolve();
                },
            };
            const abort = () => {
                const index = this.waiting.indexOf(waiter);
                this.waiting.splice(index, 1);
                reject(verifierAbortError(signal));
            };
            this.waiting.push(waiter);
            signal?.addEventListener('abort', abort, { once: true });
        });
    }
    release() {
        const next = this.waiting.shift();
        if (next === undefined) {
            this.active -= 1;
            return;
        }
        next.grant();
    }
}
const verificationScheduler = new VerificationScheduler();
function workerSpawn(request) {
    // Both src/ and lib/ resolve this to the package's registered generated
    // worker. Contributors build before execution, just like the installed
    // product; a child process must not depend on an undeclared tsx runtime or
    // infer that TypeScript sits beside its emitted JavaScript.
    return {
        entry: new URL('../lib/worker.js', import.meta.url),
        options: { workerData: request, execArgv: [] },
    };
}
/**
 * Verify one current generation in a fresh Worker Thread.
 * @param path - staged or competing current-generation path.
 * @param compression - configured physical encoding.
 * @param expectedId - Session id expected in the decoded header.
 * @param expectedEventCount - exact logical event count expected after decoding.
 * @param expectedPrefix - verified physical prefix; an append tail may be present and is not validated.
 * @param signal - optional cancellation for scheduler wait and Worker execution.
 * @returns stable physical identity and digest observed by the worker.
 */
export function verifyCurrentGenerationInWorker(path, compression, expectedId, expectedEventCount, expectedPrefix, signal) {
    return verificationScheduler.run(() => runVerificationWorker(path, compression, expectedId, expectedEventCount, expectedPrefix, signal), signal);
}
function runVerificationWorker(path, compression, expectedId, expectedEventCount, expectedPrefix, signal) {
    signal?.throwIfAborted();
    const request = {
        path, compression, expectedId, expectedEventCount,
        ...(expectedPrefix === undefined ? {} : { expectedPrefix }),
    };
    const { entry, options } = workerSpawn(request);
    const worker = new Worker(entry, options);
    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
            signal?.removeEventListener('abort', abort);
        };
        const fail = (error) => {
            /* v8 ignore next -- a late error/exit races only after another terminal callback settled. */
            if (settled)
                return;
            settled = true;
            cleanup();
            void worker.terminate().then(() => { reject(error); }, (cleanup) => {
                reject(new AggregateError([error, cleanup], 'migration verifier termination failed'));
            });
        };
        worker.once('message', (value) => {
            /* v8 ignore next -- a duplicate message races only after another terminal callback settled. */
            if (settled)
                return;
            if (typeof value !== 'object' || value === null || typeof value.ok !== 'boolean') {
                fail(new Error('migration verifier returned an invalid response'));
                return;
            }
            const response = value;
            if (!response.ok) {
                const error = new Error(response.message);
                if (response.stack !== undefined)
                    error.stack = response.stack;
                fail(error);
                return;
            }
            settled = true;
            cleanup();
            void worker.terminate().then(() => { resolve(response.result); }, (error) => { reject(error instanceof Error ? error : new Error(String(error))); });
        });
        worker.once('error', fail);
        worker.once('exit', (code) => {
            if (!settled)
                fail(new Error(`migration verifier exited before reporting a result (code ${code})`));
        });
        const abort = () => { fail(verifierAbortError(signal)); };
        signal?.addEventListener('abort', abort, { once: true });
    });
}
function verifierAbortError(signal) {
    const reason = signal?.reason;
    return reason instanceof Error
        ? reason
        : new Error('migration verifier aborted', { cause: reason });
}
