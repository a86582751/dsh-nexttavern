// Generated from runtime/alpha3/src/memory/memory-scheduler.ts; edit the TypeScript source.
/** Own background scheduling and retry state. Durable writes remain in callers. */
export function createMemoryScheduler(options) {
    const { config, isRoleplaySession, notesDue, notesBusy, busy, requestNotes, requestCompaction, aboveThreshold } = options;
    const automaticNotes = new Map();
    const automaticCompaction = new Map();
    let disposed = false;
    const notesState = (id) => {
        let state = automaticNotes.get(id);
        if (!state) {
            state = { failures: 0, retryAt: 0, promise: null, timer: null };
            automaticNotes.set(id, state);
        }
        return state;
    };
    const backoff = (state, error) => {
        state.failures = (state.failures ?? 0) + 1;
        const base = Math.max(1000, Number(config.autoRetryBaseMs) || 30000);
        const maximum = Math.max(base, Number(config.autoRetryMaxMs) || 300000);
        state.retryAt = Date.now() + Math.min(maximum, base * 2 ** Math.min(10, state.failures - 1));
        state.error = String(error !== null && typeof error === 'object' && 'message' in error ? error.message ?? error : error);
    };
    function dispose() {
        disposed = true;
        for (const state of automaticNotes.values()) {
            if (state.timer !== null)
                clearTimeout(state.timer);
            state.controller?.abort(new Error('记忆插件已卸载'));
        }
    }
    async function organizeAutomatically(agent, { checkpoint = false } = {}) {
        const session = agent?.session;
        if (disposed || (!checkpoint && config.autoNotes === false) || !agent || !session || !isRoleplaySession(session))
            return null;
        if (!checkpoint && !notesDue(session))
            return null;
        const state = notesState(session.id);
        state.agent = agent;
        if (state.promise) {
            state.rerun = true;
            return state.promise;
        }
        if ((!checkpoint && Date.now() < state.retryAt) || notesBusy.has(session.id))
            return null;
        const controller = new AbortController();
        state.controller = controller;
        const job = requestNotes(session, agent, controller.signal)
            .then(result => {
            state.failures = 0;
            state.retryAt = 0;
            state.error = null;
            return result;
        }).catch((error) => {
            if (!disposed) {
                backoff(state, error);
                options.warn?.(`roleplay-memory: background notes failed; keeping previous notes until a new source or explicit retry: ${state.error}`);
            }
            return null;
        }).finally(() => {
            state.promise = null;
            state.controller = null;
            // Only a queued newer story schedules another check. Failure alone
            // cannot create a paid retry of an unchanged durable task generation.
            if (!disposed && state.rerun) {
                if (state.timer !== null)
                    clearTimeout(state.timer);
                state.rerun = false;
                state.timer = setTimeout(() => {
                    state.timer = null;
                    void organizeAutomatically(state.agent).catch(() => { });
                }, Math.max(1, state.retryAt - Date.now()));
                state.timer.unref?.();
            }
        });
        state.promise = job;
        return job;
    }
    function scheduleNotes(agent) {
        const session = agent?.session;
        if (!agent || !session || !isRoleplaySession(session) || disposed)
            return;
        const state = notesState(session.id);
        state.agent = agent;
        if (state.promise) {
            state.rerun = true;
            return;
        }
        if (state.timer)
            return;
        state.timer = setTimeout(() => {
            state.timer = null;
            void organizeAutomatically(state.agent).catch(() => { });
        }, Math.max(1, state.retryAt - Date.now()));
        state.timer.unref?.();
    }
    async function compactAutomatically(agent, trigger = 'pressure', signal) {
        const session = agent?.session;
        if (disposed || !agent || !session || !isRoleplaySession(session) || busy.has(session.id))
            return null;
        const state = automaticCompaction.get(session.id) ?? { failures: 0, retryAt: 0 };
        automaticCompaction.set(session.id, state);
        if (Date.now() < state.retryAt)
            return null;
        try {
            if (trigger !== 'context-overflow' && !aboveThreshold(session))
                return null;
            const result = await requestCompaction(session, agent, signal, trigger === 'context-overflow');
            state.failures = 0;
            state.retryAt = 0;
            return result;
        }
        catch (error) {
            if (!signal?.aborted)
                backoff(state, error);
            throw error;
        }
    }
    return { organizeAutomatically, scheduleNotes, compactAutomatically, dispose,
        pendingNotes: (sessionId) => automaticNotes.get(sessionId)?.promise ?? undefined };
}
