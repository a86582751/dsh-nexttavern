// Generated from runtime/alpha3/compat/subagent/src/archive-admission.ts; edit the TypeScript source.
/**
 * The `subagent` family of the Workspace registry's archive admission: which
 * subagent descendants of a Session are still inside a turn, and how they
 * stop when the Session is archived with its work.
 *
 * @module @deepseek-ai/dsh-subagent
 */
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
import { foldSubagentDescriptor } from "./descriptor.js";
/**
 * Answer `workspace/session-activity` with the running subagent descendants of
 * the asked Session, and `workspace/session-stop` by cancelling each of them
 * as their parent would. Both listeners live as long as `ctx`'s fiber.
 * @param ctx - context carrying the Agent registry; the Session query service is optional and only supplies labels.
 */
export function installSubagentArchiveAdmission(ctx) {
    ctx.on('workspace/session-activity', async ({ sessionId }, next) => {
        const running = runningDescendants(ctx, sessionId);
        const rest = await next();
        if (running.length === 0)
            return rest;
        const own = { kind: 'subagent', items: await Promise.all(running.map(child => describe(ctx, child))) };
        return [own, ...rest];
    });
    ctx.on('workspace/session-stop', ({ sessionId }) => {
        for (const child of runningDescendants(ctx, sessionId)) {
            try {
                child.cancel({ kind: 'parent' });
            }
            catch (error) {
                // One child refusing its cancel must not keep its siblings running for an archived parent.
                ctx.logger.warn(`subagent: cancelling "${child.id}" for an archived Session failed: ${String(error)}`);
            }
        }
    });
}
/**
 * Live subagent descendants inside a turn, by durable lineage: a child whose
 * header names its parent and carries the subagent origin this package
 * records, at any depth. A fork shares the lineage field without the origin
 * and is an independent conversation, so it never holds its source. Lineage
 * is read as data, so a damaged header chain that loops is visited once.
 */
function runningDescendants(ctx, rootId) {
    const childrenOf = new Map();
    for (const agent of ctx.agents.list()) {
        const { parentSession, origin } = agent.session.header;
        if (parentSession === undefined || origin !== 'subagent')
            continue;
        const siblings = childrenOf.get(parentSession) ?? [];
        siblings.push(agent);
        childrenOf.set(parentSession, siblings);
    }
    const running = [];
    const pending = [rootId];
    const visited = new Set();
    while (pending.length > 0) {
        const parentId = pending.shift();
        if (visited.has(parentId))
            continue;
        visited.add(parentId);
        for (const child of childrenOf.get(parentId) ?? []) {
            if (child.status === 'running')
                running.push(child);
            pending.push(child.id);
        }
    }
    return running;
}
/**
 * The child's activity item: its id, plus the durable creation label its
 * descriptor carries, read through a live Session observation. Without the
 * Session query service, or with a descriptor that is absent or unreadable,
 * the item names the child by id alone.
 */
async function describe(ctx, child) {
    const query = ctx.get('sessionQuery');
    if (query === undefined)
        return { id: child.id };
    try {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const observation = __addDisposableResource(env_1, await query.observeSession(child.id, { projectionMode: 'none' }), false);
            const label = foldSubagentDescriptor(observation.events.slice(observation.inheritedEventCount))?.label;
            return label === undefined ? { id: child.id } : { id: child.id, label };
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    }
    catch {
        // A damaged descriptor is data damage in the child; the report still names the child.
        return { id: child.id };
    }
}
