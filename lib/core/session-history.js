// Generated from runtime/alpha3/src/core/session-history.ts; edit the TypeScript source.
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
import { untilAborted } from './tavern-task-primitives.js';
// Weak instance keys prevent an ID reused after detach from inheriting old data.
// Owners are removed by plugin disposal; no fields are attached to native Session.
const ledgers = new WeakMap();
const owners = new Set();
function failure(message) {
    return Object.assign(new Error(`会话历史未就绪：${message}`), { code: 'SESSION_HISTORY_NOT_READY' });
}
function nativeSession(value) {
    const candidate = value;
    if (typeof candidate.id !== 'string' || !Number.isSafeInteger(candidate.seq) || Number(candidate.seq) < 0 ||
        !Number.isSafeInteger(candidate.inheritedEventCount) || Number(candidate.inheritedEventCount) < 0) {
        throw failure('缺少原生会话游标或继承边界');
    }
    return candidate;
}
function loadedEvents(value) {
    if (!value)
        return [];
    const source = value;
    const events = source.events;
    if (Array.isArray(events))
        return events;
    // Plain loaded views may call their array log. Never read native TS-private log.
    if (typeof source.isOwnSeq !== 'function') {
        const log = source.log;
        if (Array.isArray(log))
            return log;
    }
    return null;
}
/** Immutable loaded cut for synchronous algorithms; live callers must await readiness first. */
export function sessionEvents(session) {
    const loaded = loadedEvents(session);
    if (loaded)
        return loaded;
    const ledger = ledgers.get(session);
    if (!ledger || !ledger.ready || ledger.error || ![...ledger.holders].some(owner => owner.get(ledger.session.id) === session) ||
        ledger.events.length !== ledger.session.seq) {
        throw ledger?.error ?? failure('请先等待公开历史观察完成');
    }
    // The feed never copies history. Multiple readers at one cursor share one
    // frozen array; a previous cut remains stable when later events arrive.
    return (ledger.snapshot ??= Object.freeze(ledger.events.slice()));
}
/** Readiness is also required for HTTP activation and children outside the roleplay preset. */
export async function ensureSessionHistory(session, signal) {
    signal?.throwIfAborted();
    if (loadedEvents(session))
        return;
    const native = nativeSession(session);
    const prior = ledgers.get(native);
    const owner = [...(prior?.holders ?? owners)].find(candidate => candidate.get(native.id) === native);
    if (!owner)
        throw failure('当前实例没有活动的历史所有者');
    await owner.ready(native, signal);
}
/**
 * One observation establishes the baseline, then the synchronous session feed
 * supplies the tail. Register accept before starting any asynchronous read.
 */
export function createSessionHistory(deps) {
    const owned = new Set();
    const lifetime = new AbortController();
    let disposed = false;
    const owner = { get: deps.get, ready };
    owners.add(owner);
    function assertLive(session) {
        if (disposed || deps.get(session.id) !== session)
            throw failure('会话已退出或已被另一实例替换');
    }
    function append(ledger, event) {
        if (event.seq < ledger.events.length && ledger.events[event.seq] === event)
            return;
        if (event.seq !== ledger.events.length)
            throw failure('增量事件存在缺口或冲突');
        ledger.events.push(event);
        ledger.snapshot = null;
    }
    function accept(session, event) {
        const ledger = ledgers.get(session);
        if (!ledger?.holders.has(owner))
            return;
        if (!ledger.ready) {
            const prior = ledger.pending.get(event.seq);
            if (prior && prior !== event)
                ledger.error = failure('初始化期间收到冲突事件');
            else
                ledger.pending.set(event.seq, event);
            return;
        }
        try {
            append(ledger, event);
        }
        catch (error) {
            ledger.error = error instanceof Error ? error : failure(String(error));
        }
    }
    async function initialize(ledger) {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const session = ledger.session;
            const assertObservedInstance = () => {
                if (![...ledger.holders].some(holder => holder.get(session.id) === session)) {
                    throw failure('会话已退出或已被另一实例替换');
                }
            };
            assertObservedInstance();
            const observation = __addDisposableResource(env_1, await deps.observe(session.id, {
                projectionMode: 'none', signal: ledger.cancellation.signal,
            }), false);
            assertObservedInstance();
            if (ledgers.get(session) !== ledger || ledger.error)
                throw ledger.error ?? failure('初始化已失效');
            if (observation.source !== 'live' || observation.header.id !== session.id ||
                observation.inheritedEventCount !== session.inheritedEventCount)
                throw failure('观察来源与当前实例不一致');
            const events = observation.events;
            if (events.length !== observation.cursor + 1)
                throw failure('观察水位与事件数不一致');
            ledger.events = [];
            for (const event of events)
                append(ledger, event);
            for (const event of [...ledger.pending.values()].sort((a, b) => a.seq - b.seq))
                append(ledger, event);
            if (ledger.events.length !== session.seq)
                throw failure('观察之后存在未收到的增量事件');
            ledger.pending.clear();
            ledger.ready = true;
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    }
    async function ready(session, signal) {
        signal?.throwIfAborted();
        if (loadedEvents(session))
            return;
        const native = nativeSession(session);
        assertLive(native);
        let ledger = ledgers.get(session);
        if (ledger) {
            ledger.holders.add(owner);
            owned.add(session);
        }
        if (ledger?.ready && !ledger.error && ledger.events.length === native.seq)
            return;
        if (!ledger?.loading) {
            ledger = { holders: ledger?.holders ?? new Set([owner]), cancellation: new AbortController(), session: native, events: [], pending: new Map(),
                snapshot: null, loading: null, ready: false, error: null };
            ledgers.set(session, ledger);
            owned.add(session);
            const current = ledger;
            current.loading = initialize(current).catch(error => {
                current.error = error instanceof Error ? error : failure(String(error));
                throw error;
            }).finally(() => { current.loading = null; });
        }
        const loading = ledger.loading;
        const signals = [lifetime.signal, ledger.cancellation.signal, ...(signal ? [signal] : [])];
        await untilAborted(loading, AbortSignal.any(signals));
    }
    function disposeSession(session) {
        const ledger = ledgers.get(session);
        owned.delete(session);
        if (!ledger?.holders.delete(owner) || ledger.holders.size)
            return;
        // A standing mount releases only its share. Other live mounts keep the
        // baseline and feed, including an observation currently in flight.
        ledger.cancellation.abort(failure('会话历史已释放'));
        ledgers.delete(session);
    }
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        lifetime.abort(failure('历史插件已停止'));
        owners.delete(owner);
        for (const session of owned)
            disposeSession(session);
    }
    return { ready, accept, disposeSession, dispose };
}
