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
    const retained = new Map();
    const jobs = new WeakMap();
    let captures = new WeakMap();
    const actualLookup = deps.live, actualEvents = deps.events, actualHash = deps.nativePrefixSha256;
    let disposed = false;
    function valid(value) {
        return value.header?.id === value.id && Number.isSafeInteger(value.inheritedEventCount) && Number(value.inheritedEventCount) >= 0
            && (value.header.parentSession === undefined ? value.inheritedEventCount === 0 :
                typeof value.header.parentSession === 'string' && value.header.isSeeded === true);
    }
    async function capture(session, signal) {
        const chain = new Map();
        const observations = new Map();
        const edges = [];
        const capturedId = session.id, capturedBirth = session.inheritedEventCount, capturedHeaderSha256 = actualHash?.([session.header]);
        const original = deps.events?.(session);
        if (original && (original.length > 131_072 || original.some((event, index) => event.seq !== index)
            || Buffer.byteLength(JSON.stringify(original), 'utf8') > 67_108_864))
            throw Error('DERIVED_ANCESTRY_BUDGET');
        // Shared bytes are retained once. When a descendant cut lies inside its
        // parent's inherited seed, that parent's own birth needs a longer prefix
        // from the real observation, never invented from the short descendant.
        const pinned = original && deps.nativePrefixSha256 ? structuredClone(original) : undefined;
        const freeze = (value) => {
            if (value && typeof value === 'object') {
                for (const item of Object.values(value))
                    freeze(item);
                Object.freeze(value);
            }
        };
        if (pinned) {
            freeze(pinned);
        }
        let comparison = pinned, totalEvents = pinned?.length ?? 0, totalBytes = pinned ? Buffer.byteLength(JSON.stringify(pinned), 'utf8') : 0;
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
                if (pinned) {
                    const cut = current.inheritedEventCount;
                    if (!comparison || cut > comparison.length || deps.nativePrefixSha256(observation.events.slice(0, cut))
                        !== deps.nativePrefixSha256(comparison.slice(0, cut)))
                        throw Error('DERIVED_ANCESTRY_PREFIX_CHANGED');
                    edges.push(Object.freeze({ childSessionId: current.id, parentSessionId: parent,
                        inheritedEventCount: cut, prefixSha256: deps.nativePrefixSha256(comparison.slice(0, cut)) }));
                    const length = Math.max(cut, observation.inheritedEventCount), rawTail = observation.events.slice(cut, length);
                    totalEvents += rawTail.length;
                    totalBytes += Buffer.byteLength(JSON.stringify(rawTail), 'utf8');
                    if (length > 131_072 || totalEvents > 131_072 || totalBytes > 67_108_864)
                        throw Error('DERIVED_ANCESTRY_BUDGET');
                    const tail = structuredClone(rawTail);
                    freeze(tail);
                    const events = Object.freeze([...comparison.slice(0, cut), ...tail]), header = Object.freeze(structuredClone(observation.header));
                    observations.set(parent, Object.freeze({ id: observation.header.id, header,
                        inheritedEventCount: observation.inheritedEventCount, snapshotEvents: () => events }));
                    comparison = events;
                }
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
        if (pinned && deps.nativePrefixSha256(deps.events(session).slice(0, pinned.length))
            !== deps.nativePrefixSha256(pinned))
            throw Error('DERIVED_ANCESTRY_PREFIX_CHANGED');
        for (const [id, header] of chain)
            headers.set(id, Object.freeze(header));
        for (const [id, observation] of observations) {
            const previous = retained.get(id);
            if (!previous || previous.snapshotEvents().length <= observation.snapshotEvents().length)
                retained.set(id, observation);
        }
        if (pinned && actualHash && typeof capturedHeaderSha256 === 'string' && valid(session)
            && session.id === capturedId && session.inheritedEventCount === capturedBirth
            && actualHash([session.header]) === capturedHeaderSha256)
            captures.set(session, Object.freeze({ session,
                headerSha256: capturedHeaderSha256, inheritedEventCount: session.inheritedEventCount,
                inheritedPrefixSha256: actualHash(pinned.slice(0, session.inheritedEventCount)), edges: Object.freeze(edges) }));
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
    function retainedSourceOwnerCatalog(session, sourceSeqs) {
        const saved = captures.get(session), sid = session.id;
        if (!saved || !actualHash || !actualEvents || sourceSeqs.length !== 2
            || sourceSeqs.some(seq => !Number.isSafeInteger(seq) || seq < 0 || Object.is(seq, -0)))
            return Object.freeze([]);
        const selected = [], seqs = Object.freeze([...sourceSeqs]);
        const candidates = [];
        let childId = sid;
        for (const edge of saved.edges) {
            if (edge.childSessionId !== childId)
                throw Error('DERIVED_ANCESTRY_OWNER_CHANGED');
            if (seqs.some(seq => seq >= edge.inheritedEventCount))
                break;
            selected.push(edge);
            childId = edge.parentSessionId;
            candidates.push({ ownerId: childId, edges: Object.freeze([...selected]) });
        }
        const assertCurrent = () => {
            if (disposed || deps.live !== actualLookup || deps.events !== actualEvents || deps.nativePrefixSha256 !== actualHash
                || actualLookup(sid) !== session || captures.get(session) !== saved || session.id !== sid || !valid(session)
                || session.inheritedEventCount !== saved.inheritedEventCount || actualHash([session.header]) !== saved.headerSha256) {
                throw Error('DERIVED_ANCESTRY_OWNER_CHANGED');
            }
            const events = actualEvents(session);
            if (events.length < saved.inheritedEventCount || events.slice(0, saved.inheritedEventCount).some((event, index) => event.seq !== index)
                || actualHash(events.slice(0, saved.inheritedEventCount)) !== saved.inheritedPrefixSha256) {
                throw Error('DERIVED_ANCESTRY_PREFIX_CHANGED');
            }
        };
        assertCurrent();
        return Object.freeze(candidates.map(candidate => Object.freeze({ schemaVersion: 1,
            encoding: 'native-retained-source-owner-association-v1', authority: 'consumer-data-only',
            sessionId: sid, sourceOwnerSessionId: candidate.ownerId, sourceSeqs: seqs, edges: candidate.edges, assertCurrent })));
    }
    function retainedSourceOwnerFacts(session, ownerId, sourceSeqs) {
        return retainedSourceOwnerCatalog(session, sourceSeqs).find(fact => fact.sourceOwnerSessionId === ownerId);
    }
    return { ready, retainedSourceOwnerFacts, retainedSourceOwnerCatalog,
        readSession: (id) => disposed ? undefined : deps.live(id) ?? headers.get(id),
        readNativeObservation: (id) => {
            if (disposed)
                return undefined;
            const live = deps.live(id);
            if (live && valid(live) && deps.events)
                return { id: live.id, header: live.header,
                    inheritedEventCount: live.inheritedEventCount, snapshotEvents: () => deps.events(live) };
            return retained.get(id);
        },
        dispose: () => { disposed = true; headers.clear(); retained.clear(); captures = new WeakMap(); } };
}
