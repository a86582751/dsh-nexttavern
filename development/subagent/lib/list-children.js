// Generated from runtime/alpha3/compat/subagent/src/list-children.ts; edit the TypeScript source.
/**
 * Direct-child and recursive descendant discovery from parent-owned catalogs.
 * Each catalog read releases its Session observation before the next branch.
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
import { SubagentError } from "./error.js";
/**
 * Read one parent's durable catalog through a live-preferred Session observation.
 * @param ctx - context carrying the Session query service.
 * @param parentSessionId - parent whose direct children are requested.
 * @param signal - cancellation forwarded to the Session observation.
 * @returns direct-child rows in parent catalog event order.
 * @throws {@link SubagentError} when query or catalog projection is unavailable.
 */
export async function listChildren(ctx, parentSessionId, signal) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const query = ctx.get('sessionQuery');
        if (query === undefined) {
            throw new SubagentError('listing subagents requires the sessionQuery service (load @deepseek-ai/dsh-session-query)', 'SUBAGENT_CONTROL_QUERY_UNAVAILABLE');
        }
        const parent = __addDisposableResource(env_1, await query.observeSession(parentSessionId, {
            ...signal === undefined ? {} : { signal },
        }), false);
        const entries = parent.projections?.values.subagentCatalog;
        if (entries === undefined) {
            throw new SubagentError('listing subagents requires the registered subagentCatalog projection', 'SUBAGENT_CONTROL_PROJECTIONS_UNAVAILABLE');
        }
        return entries;
    }
    catch (e_1) {
        env_1.error = e_1;
        env_1.hasError = true;
    }
    finally {
        __disposeResources(env_1);
    }
}
/**
 * Walk reachable parent catalogs in stable pre-order without loading Agents.
 * @see SubagentRuntime.listDescendants for failure and cancellation semantics.
 * @param ctx - context carrying the Session store and query service.
 * @param rootSessionId - parent whose catalog starts the traversal.
 * @param signal - cancellation checked around each catalog read.
 * @returns children and branch diagnostics with catalog parent and depth.
 */
export async function listDescendants(ctx, rootSessionId, signal) {
    const sessions = ctx.get('sessions');
    if (sessions === undefined) {
        throw new SubagentError('listing subagents requires the session store (load @deepseek-ai/dsh-session)', 'SUBAGENT_CONTROL_SESSION_STORE_UNAVAILABLE');
    }
    const readChildren = async (id) => {
        assertListingNotCancelled(signal);
        let children;
        try {
            children = await listChildren(ctx, id, signal);
        }
        catch (error) {
            assertListingNotCancelled(signal);
            throw error;
        }
        assertListingNotCancelled(signal);
        return children;
    };
    const stack = (await readChildren(rootSessionId))
        .map(entry => ({ entry, parentId: rootSessionId, depth: 1 }))
        .reverse();
    const visited = new Set([rootSessionId]);
    const result = [];
    for (let position = stack.pop(); position !== undefined; position = stack.pop()) {
        const { entry, parentId, depth } = position;
        if (visited.has(entry.id))
            continue;
        visited.add(entry.id);
        let children;
        try {
            children = await readChildren(entry.id);
        }
        catch (error) {
            if (error instanceof SubagentError)
                throw error;
            const code = error instanceof Error && 'code' in error ? error.code : undefined;
            result.push({
                kind: 'diagnostic', id: entry.id, parentId, depth,
                reason: code === 'SESSION_QUERY_CORRUPT_SESSION' || code === 'SESSION_QUERY_SOURCE_CONFLICT'
                    ? 'corrupt' : 'unavailable',
            });
            continue;
        }
        if (entry.mode === 'unknown') {
            result.push({ kind: 'diagnostic', id: entry.id, parentId, depth, reason: 'unsupported' });
        }
        else {
            const { createdAt: _createdAt, ...identity } = entry;
            result.push({
                ...identity, kind: 'child', parentId, depth,
                activity: sessions.get(entry.id) === undefined ? 'inactive' : 'running',
                hasChildren: children.length > 0,
            });
        }
        // Catalog event order defines siblings; the stack visits the first one next.
        for (const child of [...children].reverse()) {
            stack.push({ entry: child, parentId: entry.id, depth: depth + 1 });
        }
    }
    return result;
}
/** Stop the complete traversal when its caller cancels. */
function assertListingNotCancelled(signal) {
    if (signal?.aborted) {
        throw new SubagentError('subagent listing was cancelled', 'CANCELLED');
    }
}
