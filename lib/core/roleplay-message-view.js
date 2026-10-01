// Generated from runtime/alpha3/src/core/roleplay-message-view.ts; edit the TypeScript source.
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
/**
 * Restore a cold read through the host's registered interpreters. The temporary
 * Session is never attached or published, and the observation lease is always
 * released. The returned immutable cut owns its events and derived messages.
 */
export async function readProjectedStory(ctx, id) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const observation = __addDisposableResource(env_1, await ctx.sessionQuery.observeSession(id, { projectionMode: 'none' }), false);
        const prepared = ctx.sessions.prepare(id, {
            seed: observation.events, meta: observation.header,
            inheritedEventCount: observation.inheritedEventCount, eventState: 'shared-frozen',
        });
        return {
            id, header: observation.header, events: observation.events, surface: prepared.surface,
            inheritedEventCount: observation.inheritedEventCount,
            deriveEventMessage: prepared.deriveEventMessage.bind(prepared),
        };
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
 * Story readers keep the original seq, turn, source and usage. Only content is
 * projected, using the same registered interpreters as the next model request.
 * Missing interpreters must propagate their error; falling back would expose
 * stale prose after disabling a provider that owns required history records.
 */
export function projectStoryEvent(session, event) {
    if (!session.deriveEventMessage || (event.type !== 'user/message' && event.type !== 'assistant/message'))
        return event;
    const message = session.deriveEventMessage(event);
    if (!message || typeof message !== 'object' || !('content' in message) || !Array.isArray(message.content))
        return event;
    if (event.type === 'user/message') {
        if (event.data?.content === message.content)
            return event;
        return Object.freeze({ ...event, data: Object.freeze({ ...event.data, content: message.content }) });
    }
    const original = event.data?.message;
    if (!original || typeof original !== 'object')
        return event;
    if ('content' in original && original.content === message.content)
        return event;
    return Object.freeze({ ...event, data: Object.freeze({ ...event.data,
            message: Object.freeze({ ...original, content: message.content }),
        }) });
}
/** A legacy immutable fixture has no projector; native projected reads need its generation. */
export function messageViewGeneration(session) {
    if (!session.deriveEventMessage)
        return 0;
    const generation = session.surface?.contentGeneration;
    return Number.isSafeInteger(generation) && Number(generation) >= 0 ? Number(generation) : null;
}
