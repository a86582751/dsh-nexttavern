// Generated from runtime/alpha3/compat/llm-pi-ai/src/adapter.ts; edit the TypeScript source.
/**
 * Generic pi-ai-backed implementation of the Harness LLM seam.
 *
 * Each resolution produces one **immutable** snapshot — the profiles plus a
 * `Models` collection holding the `Provider` each route built — and an
 * operation captures a whole snapshot before its first `await`. A
 * configuration change builds a *new* collection rather than mutating the one
 * in use, because `Models.streamSimple()` is lazy: it resolves the provider
 * when the stream is first consumed, which is after the credential await, so a
 * mutated collection would let a request that started under one configuration
 * finish under another — or fail with a provider that no longer exists. This is
 * what makes the seam's per-step call freeze (`llm.prepareCall()`) hold all the
 * way down: switching models mid-reply takes effect on the next step, never
 * inside the one in flight.
 *
 * A route naming a credential reference still resolves it through the harness
 * seam and passes it as the request's `apiKey` option, which pi-ai treats as
 * the highest-priority auth override — that is what keeps the fail-loud
 * reference semantics. Everything that override does not cover reaches pi-ai
 * through the collection's own auth: the credential store holds the records a
 * login wrote and a refresh rotates, and the auth context answers the ambient
 * questions a provider asks while resolving. Both are stable across snapshots,
 * so a configuration change rebuilds the collection without forgetting who is
 * signed in.
 *
 * @module dsh-llm-pi-ai/adapter
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
import { createModels, getSupportedThinkingLevels } from 'dsh-nexttavern-pi-ai';
import { attributionHeaders, contentHasImage, LlmAdapter, LlmError, ReasoningEffortId, } from '@deepseek-ai/dsh-llm';
import { idleWatchdog, timeoutOf } from '@deepseek-ai/dsh-timeout';
import { toPiContext } from './context.js';
import { toStreamChunks } from './stream.js';
/** Copy profile stream knobs into pi-ai's common option vocabulary. */
function profileOptions(profile, reasoning, apiKey) {
    const enabledReasoning = reasoning === 'off' ? undefined : reasoning;
    return {
        ...apiKey === undefined ? {} : { apiKey },
        ...enabledReasoning === undefined ? {} : { reasoning: enabledReasoning },
        ...profile.thinkingBudgets === undefined ? {} : { thinkingBudgets: profile.thinkingBudgets },
        ...profile.cacheRetention === undefined ? {} : { cacheRetention: profile.cacheRetention },
        ...profile.transport === undefined ? {} : { transport: profile.transport },
        ...profile.timeoutMs === undefined ? {} : { timeoutMs: profile.timeoutMs },
        ...profile.websocketConnectTimeoutMs === undefined ? {} : { websocketConnectTimeoutMs: profile.websocketConnectTimeoutMs },
        // The agent recovery layer owns visible attempts; one adapter call is one SDK attempt.
        maxRetries: 0,
    };
}
/**
 * The profile default this exact model can actually take, for DESCRIBING it.
 * A configured level the model does not support yields none rather than
 * throwing: `resolveModel` builds the model catalog, and a catalog that fails
 * takes its whole provider out of every picker — so one mis-set profile field
 * would hide every model on the route, including the ones that support the
 * level. The request path still refuses, which is where a bad configuration
 * belongs: describing what a model can do must not fail because a deployment
 * asked it for something it cannot.
 * @param model - the resolved model descriptor.
 * @param effort - the profile's configured level, if any.
 * @returns the level when this model supports it, otherwise undefined.
 */
function describableReasoningLevel(model, effort) {
    if (effort === undefined)
        return undefined;
    return getSupportedThinkingLevels(model).some(level => level === effort)
        ? effort
        : undefined;
}
/** Validate an explicit Harness/profile effort without invoking pi-ai's clamp. */
function resolveReasoningLevel(model, effort) {
    if (effort === undefined)
        return undefined;
    const supported = getSupportedThinkingLevels(model);
    if (supported.some(level => level === effort))
        return effort;
    throw new LlmError(`pi-ai provider "${model.provider}" model "${model.id}" does not support reasoning effort "${effort}"`, 'UNSUPPORTED_REASONING_EFFORT');
}
/**
 * Selectable reasoning efforts for one model, or nothing at all.
 *
 * A model that carries no reasoning metadata — every hand-declared one, and
 * every catalog model pi-ai marks as non-reasoning — is reported by pi-ai as
 * supporting the single level `off`. Passing that through would offer a control
 * that cannot do what it says: `off` is translated to *omitting* the reasoning
 * option, which for such a model is byte-for-byte the same request as naming no
 * effort — so a provider whose own default is to think would keep thinking with
 * `off` selected. Omitting `reasoning` entirely is the seam's way of saying the
 * capability is unavailable, which leaves the surface offering only the
 * provider's default.
 * @param model - the resolved model descriptor.
 * @param defaultLevel - the profile's configured effort, already validated.
 * @returns the `reasoning` field, or an empty object when none can be offered.
 */
function reasoningInfo(model, defaultLevel) {
    if (!model.reasoning)
        return {};
    const levels = getSupportedThinkingLevels(model);
    return {
        reasoning: {
            efforts: levels.map(level => ({
                id: ReasoningEffortId(level),
                name: `${level.charAt(0).toUpperCase()}${level.slice(1)}`,
            })),
            ...defaultLevel === undefined ? {} : { defaultEffort: ReasoningEffortId(defaultLevel) },
        },
    };
}
/** Merge deployment headers while removing case-insensitive attribution collisions. */
function requestHeaders(headers) {
    const attribution = attributionHeaders();
    const reserved = new Set(Object.keys(attribution).map(name => name.toLowerCase()));
    return {
        ...Object.fromEntries(Object.entries(headers ?? {}).filter(([name]) => !reserved.has(name.toLowerCase()))),
        ...attribution,
    };
}
/**
 * pi-ai-backed multi-provider adapter. Each operation reads the current
 * profiles, so a configuration change reaches the next request without a
 * restart; model descriptors come from the collection those profiles built.
 */
export class PiAiAdapter extends LlmAdapter {
    config;
    snapshot;
    constructor(config) {
        super();
        this.config = config;
    }
    /**
     * The snapshot for the current profiles. Resolution memoizes its result, so
     * an unchanged configuration is recognized by identity; a changed one gets a
     * brand-new collection, leaving any snapshot an operation already captured
     * untouched for as long as that operation holds it.
     */
    current() {
        const profiles = this.config.profiles();
        if (this.snapshot?.profiles === profiles)
            return this.snapshot;
        const models = createModels(this.config.auth);
        for (const profile of profiles.values()) {
            models.setProvider(profile.piProvider);
        }
        this.snapshot = { profiles, models };
        return this.snapshot;
    }
    /** The profile for one route within one snapshot, or the not-owned failure. */
    profileOf(snapshot, provider) {
        const profile = snapshot.profiles.get(provider);
        if (profile === undefined) {
            throw new LlmError(`pi-ai adapter does not own provider "${provider}"`, 'NO_ADAPTER');
        }
        return profile;
    }
    /** The configured descriptor for one exact route/model pair within one snapshot. */
    modelOf(snapshot, provider, model) {
        this.profileOf(snapshot, provider);
        const resolved = snapshot.models.getModel(provider, model);
        if (resolved === undefined) {
            throw new LlmError(`pi-ai provider "${provider}" has no configured model "${model}"`, 'UNKNOWN_MODEL');
        }
        return resolved;
    }
    providerInfo(provider) {
        // The configured name, not the route key: `displayName` exists so a
        // deployment can label a route, and a label only the configuration surface
        // reads would leave every selector showing the raw key.
        return { id: provider, name: this.current().profiles.get(provider)?.displayName ?? provider };
    }
    providerRetryPolicy(provider) {
        return this.current().profiles.get(provider)?.retryPolicy;
    }
    listModels(provider) {
        return Promise.resolve().then(() => {
            const snapshot = this.current();
            this.profileOf(snapshot, provider);
            return snapshot.models.getModels(provider).map(model => ({
                provider,
                id: model.id,
                name: model.name,
                inputModalities: [...model.input],
            }));
        });
    }
    resolveModel(provider, model, _signal) {
        return Promise.resolve().then(() => {
            const snapshot = this.current();
            return this.modelInfo(snapshot, provider, model);
        });
    }
    modelInfo(snapshot, provider, model) {
        const profile = this.profileOf(snapshot, provider);
        const resolvedModel = this.modelOf(snapshot, provider, model);
        const defaultLevel = describableReasoningLevel(resolvedModel, profile.reasoning);
        // Only a cap the deployment configured is a request default; the
        // catalog's `maxTokens` sizes the model and stops there.
        const configuredMaxTokens = profile.configuredMaxTokens.get(model);
        return {
            provider,
            id: model,
            name: resolvedModel.name,
            inputModalities: [...resolvedModel.input],
            context: { contextWindow: resolvedModel.contextWindow },
            ...configuredMaxTokens === undefined ? {} : { defaultMaxTokens: configuredMaxTokens },
            ...reasoningInfo(resolvedModel, defaultLevel),
        };
    }
    prepareCall(provider, model, _signal) {
        const snapshot = this.current();
        return Promise.resolve({
            model: this.modelInfo(snapshot, provider, model),
            stream: options => this.streamWithSnapshot(options, snapshot),
        });
    }
    stream(options) {
        return this.streamWithSnapshot(options, this.current());
    }
    async *streamWithSnapshot(options, snapshot) {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            if (options.stop !== undefined) {
                throw new LlmError('llm-pi-ai does not support GenerateOptions.stop', 'UNSUPPORTED_OPTION');
            }
            // One capture per stream call, taken before any await: the profile, the
            // model descriptor, and the collection all come from the same immutable
            // snapshot, and the credential freezes with them. A configuration change
            // mid-request builds a separate snapshot, so this request finishes under
            // the one it started with and the next call picks up the new one.
            const profile = this.profileOf(snapshot, options.provider);
            const model = this.modelOf(snapshot, options.provider, options.model);
            const reasoning = resolveReasoningLevel(model, options.reasoningEffort ?? profile.reasoning);
            const apiKey = await this.config.resolveApiKey(options.provider, profile);
            const consumer = new AbortController();
            const upstream = options.signal === undefined
                ? consumer.signal
                : AbortSignal.any([options.signal, consumer.signal]);
            const streamIdleTimeoutMs = profile.streamIdleTimeoutMs;
            const watchdog = __addDisposableResource(env_1, idleWatchdog(upstream, streamIdleTimeoutMs, 'LLM_STREAM_IDLE_TIMEOUT'), false);
            try {
                const containsImage = options.messages.some(message => contentHasImage(message.content));
                if (containsImage && !model.input.includes('image')) {
                    throw new LlmError(`pi-ai model "${model.id}" does not support image input`, 'UNSUPPORTED_CONTENT');
                }
                const attachments = containsImage ? this.config.resolveAttachments?.() : undefined;
                if (containsImage && attachments === undefined) {
                    throw new LlmError('pi-ai image input requires the durable attachment service', 'UNSUPPORTED_CONTENT');
                }
                const onReplayDegrade = (reason) => {
                    this.config.onReplayDegrade?.({ provider: options.provider, model: options.model, reason });
                };
                const context = attachments === undefined
                    ? toPiContext(options, undefined, onReplayDegrade)
                    : await toPiContext({ ...options, signal: watchdog.signal }, {
                        attachments,
                        resolveImageAccess: ref => this.config.resolveImageAccess?.(attachments, ref),
                        maxRequestImageBytes: profile.maxRequestImageBytes,
                        requestImagePolicy: {
                            maxPixels: profile.requestImagePixelBudget,
                            maxBytes: profile.requestImageMaxBytes,
                        },
                    }, onReplayDegrade);
                const events = snapshot.models.streamSimple(model, context, {
                    ...profileOptions(profile, reasoning, apiKey),
                    ...options.temperature === undefined ? {} : { temperature: options.temperature },
                    ...options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens },
                    ...options.sessionId === undefined ? {} : { sessionId: String(options.sessionId) },
                    signal: watchdog.signal,
                    // Profile headers are deployment-owned; attribution names are
                    // Harness-owned and therefore win collisions.
                    headers: requestHeaders(profile.headers),
                });
                const iterator = toStreamChunks(events, model.contextWindow, options.signal)[Symbol.asyncIterator]();
                let exhausted = false;
                try {
                    while (true) {
                        const result = await watchdog.next(iterator);
                        const timeout = timeoutOf(watchdog.signal, 'LLM_STREAM_IDLE_TIMEOUT');
                        if (timeout !== undefined)
                            throw timeout;
                        if (result.done) {
                            exhausted = true;
                            return;
                        }
                        yield result.value;
                    }
                }
                finally {
                    if (!exhausted) {
                        consumer.abort('pi-ai stream consumer stopped');
                        try {
                            await iterator.return(undefined);
                        }
                        catch (_abortedSdkTeardown) {
                            // The stable signal already owns SDK termination; return-time abort cannot add an outcome.
                        }
                    }
                }
            }
            catch (error) {
                if (timeoutOf(watchdog.signal, 'LLM_STREAM_IDLE_TIMEOUT') !== undefined) {
                    throw new LlmError(`pi-ai stream idle timeout after ${streamIdleTimeoutMs}ms`, 'TIMEOUT', { cause: error });
                }
                if (options.signal?.aborted) {
                    throw new LlmError('pi-ai request aborted by caller', 'ABORTED', { cause: error });
                }
                throw error;
            }
            finally {
                consumer.abort('pi-ai stream consumer stopped');
            }
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    }
}
