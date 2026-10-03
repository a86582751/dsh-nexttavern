// Generated from runtime/alpha3/src/core/roleplay-source-lock.ts; edit the TypeScript source.
/** One Session's actual Source/import FIFO. Cancellation changes the waiting
 * caller's outcome, never the lifetime of an already-running mutation. */
const SOURCE_LOCK_KEY = '__session__';
function sourceLockAbortReason(signal) {
    // Preserve the material owner's real timeout/cancel diagnostic. A missing
    // reason has an ordinary AbortError; no JSON value confers cancellation.
    return signal.reason === undefined ? new DOMException('ROLEPLAY_SOURCE_LOCK_ABORTED', 'AbortError') : signal.reason;
}
export function runRoleplaySourceLockedV1(pending, task, signal) {
    // A task cancelled before joining never changes an existing queue barrier.
    if (signal?.aborted)
        return Promise.reject(sourceLockAbortReason(signal));
    const previous = pending.get(SOURCE_LOCK_KEY) ?? Promise.resolve();
    let started = false, cancelledWaiting = false, listenerAttached = false;
    let resolveCaller;
    let rejectCaller;
    const caller = new Promise((resolve, reject) => {
        resolveCaller = resolve;
        rejectCaller = reject;
    });
    const detach = () => {
        if (signal && listenerAttached) {
            signal.removeEventListener('abort', onAbort);
            listenerAttached = false;
        }
    };
    const onAbort = () => {
        if (started)
            return;
        cancelledWaiting = true;
        detach();
        rejectCaller(sourceLockAbortReason(signal));
    };
    if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
        listenerAttached = true;
    }
    const tail = previous.catch(() => undefined).then(() => {
        // The rejected caller and this tail are deliberately different promises.
        // A cancelled tail still waits for the previous real mutation to settle,
        // then skips work. Deleting it on abort would let later work bypass that
        // mutation or let a non-prompt barrier finish while it was still running.
        if (cancelledWaiting || signal?.aborted) {
            cancelledWaiting = true;
            detach();
            rejectCaller(sourceLockAbortReason(signal));
            // This task never mutated Source. Non-prompt readers waiting for this
            // tail need the prior barrier to finish, not the cancelled caller's
            // error. Real started-task failures still reject their own tail below.
            return undefined;
        }
        started = true;
        detach();
        // Once started, only real task settlement advances this FIFO. The task owns
        // signal handling and must await worker termination/unknown put cleanup;
        // neither cancellation nor a Promise.race here can release it early.
        return task();
    });
    pending.set(SOURCE_LOCK_KEY, tail);
    const cleanup = () => {
        detach();
        // A successor owns the latest tail. An older completion cannot erase it.
        if (pending.get(SOURCE_LOCK_KEY) === tail)
            pending.delete(SOURCE_LOCK_KEY);
    };
    // Attach both handlers immediately: a skipped/rejected tail is internally
    // observed even when its waiting caller already received an abort reason.
    // The public caller retains normal Promise rejection semantics.
    void tail.then(value => {
        cleanup();
        if (!cancelledWaiting)
            resolveCaller(value);
    }, error => {
        cleanup();
        rejectCaller(error);
    });
    // Covers an abort between the initial check and listener registration/queue
    // publication. It still keeps the joined tail behind the previous barrier.
    if (signal?.aborted)
        onAbort();
    return caller;
}
