// Generated from runtime/alpha3/src/core/roleplay-mvu-ancestry.ts; edit the TypeScript source.
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
export function createRoleplayMvuAncestry(deps) {
    const headers = new Map();
    const jobs = new WeakMap();
    let disposed = false;
    function valid(value) {
        return value.header?.id === value.id && Number.isSafeInteger(value.inheritedEventCount) && Number(value.inheritedEventCount) >= 0
            && (value.header.parentSession === undefined ? value.inheritedEventCount === 0 :
                typeof value.header.parentSession === 'string' && value.header.isSeeded === true);
    }
    async function capture(session, signal) {
        const chain = new Map();
        let current = session;
        while (true) {
            const env_1 = { stack: [], error: void 0, hasError: false };
            try {
                signal?.throwIfAborted();
                if (disposed || chain.size >= 32 || chain.has(current.id) || !valid(current))
                    throw Error('DERIVED_ANCESTRY_UNPROVEN');
                chain.set(current.id, { id: current.id, header: Object.freeze(structuredClone(current.header)),
                    inheritedEventCount: current.inheritedEventCount });
                const parent = current.header.parentSession;
                if (parent === undefined)
                    break;
                // A cold observation owns only a pinned read. It must never resolve an
                // Agent or reuse a proof's claimed seed boundary as a native fact.
                const observation = __addDisposableResource(env_1, await deps.observe(parent, { projectionMode: 'none', signal }), false);
                if (observation.header.id !== parent || observation.events.length < current.inheritedEventCount
                    || !Number.isSafeInteger(observation.inheritedEventCount)
                    || observation.inheritedEventCount < 0 || observation.inheritedEventCount > observation.events.length
                    || observation.events.some((event, index) => event.seq !== index))
                    throw Error('DERIVED_ANCESTRY_UNPROVEN');
                current = { id: observation.header.id, header: structuredClone(observation.header),
                    inheritedEventCount: observation.inheritedEventCount };
            }
            catch (e_1) {
                env_1.error = e_1;
                env_1.hasError = true;
            }
            finally {
                __disposeResources(env_1);
            }
        }
        if (disposed)
            throw Error('DERIVED_ANCESTRY_UNPROVEN');
        for (const [id, header] of chain)
            headers.set(id, Object.freeze(header));
    }
    async function ready(session, signal) {
        if (disposed)
            throw Error('DERIVED_ANCESTRY_UNPROVEN');
        let job = jobs.get(session);
        if (!job) {
            job = capture(session, signal);
            jobs.set(session, job);
            job.catch(() => { if (jobs.get(session) === job)
                jobs.delete(session); });
        }
        await job;
        if (disposed)
            throw Error('DERIVED_ANCESTRY_UNPROVEN');
        signal?.throwIfAborted();
    }
    return { ready, readSession: (id) => disposed ? undefined : deps.live(id) ?? headers.get(id),
        dispose: () => { disposed = true; headers.clear(); } };
}
