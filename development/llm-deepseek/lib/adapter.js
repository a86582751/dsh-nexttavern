// Generated from runtime/alpha3/compat/llm-deepseek/src/adapter.ts; edit the TypeScript source.
/** Direct Messages transport with one cancellable lifecycle per model request. */
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
import { assertAgentLoopRequestCurrent, attributionHeaders, LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm';
import { idleWatchdog, timeoutOf } from '@deepseek-ai/dsh-timeout';
import { modelInfo } from './model-info.js';
import { DeepSeekFileStore } from './file-store.js';
import { MESSAGES_FILES_BETA, MESSAGES_TOOL_CHANGES_BETA, messagesApiRoot } from './messages-api.js';
import { FileResolutionFailure, RequestFiles } from './request-files.js';
import { prepareRequestExtensions } from './request-extensions.js';
import { imagePricing, inlineImages, prepareFileIds, prepareImages } from './images.js';
import { serialize } from './serialize.js';
import { parseSse } from './sse.js';
import { translate } from './translate.js';
import { providerError, providerErrorDetail } from './transport.js';
/** DeepSeek provider using Messages content and native thinking replay. */
export class DeepSeekAdapter extends LlmAdapter {
    dependencies;
    files;
    imageAccess = (ref) => {
        const attachments = this.dependencies.resolveAttachments?.();
        return attachments === undefined ? undefined : this.dependencies.resolveImageAccess?.(attachments, ref);
    };
    constructor(dependencies) {
        super();
        this.dependencies = dependencies;
        this.files = dependencies.resolveFiles?.() ?? new DeepSeekFileStore();
    }
    providerInfo(provider) { return { id: provider, name: this.dependencies.providerName ?? 'DeepSeek' }; }
    providerRetryPolicy(_provider) { return this.dependencies.options().retryPolicy; }
    async listModels(provider) {
        return this.dependencies.discoverModels?.(provider) ?? [];
    }
    resolveModel(provider, model, _signal) {
        return Promise.resolve(modelInfo(this.dependencies.options(), provider, model));
    }
    imageRequestPricing(_provider, model) {
        return imagePricing(this.dependencies.options(), model, this.imageAccess);
    }
    prepareCall(provider, model, _signal) {
        const connection = this.dependencies.options();
        return Promise.resolve({ model: modelInfo(connection, provider, model), stream: options => this.generate(options, connection) });
    }
    stream(options) {
        return this.generate(options, this.dependencies.options());
    }
    async *generate(options, connection) {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const consumer = new AbortController();
            const signal = options.signal === undefined ? consumer.signal : AbortSignal.any([consumer.signal, options.signal]);
            const watchdog = __addDisposableResource(env_1, idleWatchdog(signal, connection.streamIdleTimeoutMs, 'MESSAGES_IDLE'), false);
            const iterator = this.request(options, connection, watchdog.signal, () => { watchdog.pulse(); });
            try {
                while (true) {
                    const next = await watchdog.next(iterator);
                    if (next.done)
                        return;
                    yield next.value;
                }
            }
            catch (error) {
                if (timeoutOf(watchdog.signal, 'MESSAGES_IDLE') !== undefined)
                    throw new LlmError('DeepSeek Messages stream idle timeout', 'TIMEOUT', { cause: error });
                if (options.signal?.aborted)
                    throw new LlmError('DeepSeek Messages request aborted', 'ABORTED', { cause: error });
                if (error instanceof LlmError)
                    throw error;
                throw new LlmError('DeepSeek Messages transport failed', 'TRANSPORT', { cause: error });
            }
            finally {
                consumer.abort();
                try {
                    await iterator.return(undefined);
                }
                catch (_abortedRequestCleanup) {
                    // The request already settled; aborting its reader cannot replace that outcome.
                }
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
    async *request(options, connection, signal, activity) {
        signal.throwIfAborted();
        const { messages, versions } = await prepareImages(options.messages, connection, options.model, this.dependencies.resolveAttachments?.(), this.imageAccess, signal);
        const auth = await this.dependencies.resolveAuth(connection);
        try {
            const files = new RequestFiles(this.files, {
                baseURL: connection.baseURL, headers: auth.headers,
            }, connection.filePolicy, connection.filesApiTimeoutMs, signal, activity);
            let inline = false;
            while (true) {
                signal.throwIfAborted();
                files.beginAttempt();
                let fileIds;
                if (!inline) {
                    try {
                        fileIds = await prepareFileIds(messages, versions, files);
                    }
                    catch (error) {
                        if (!(error instanceof FileResolutionFailure))
                            throw error;
                        inline = true;
                        continue;
                    }
                }
                const history = inline ? inlineImages(messages, versions, connection) : messages;
                const body = serialize(options, connection, history, versions, this.imageAccess, (reason) => {
                    this.dependencies.onReplayDegrade?.({ provider: options.provider, model: options.model, reason });
                }, fileIds);
                const extensions = await prepareRequestExtensions(body, {
                    signal,
                    ...options.sessionId === undefined ? {} : { sessionId: String(options.sessionId) },
                    ...options.purpose === undefined ? {} : { purpose: options.purpose },
                }, this.dependencies.prepareExtensions, (fields, error) => {
                    this.dependencies.onExtensionsOmitted?.({ provider: options.provider, model: options.model, fields, error });
                });
                signal.throwIfAborted();
                const betas = [
                    ...fileIds !== undefined && fileIds.size > 0 ? [MESSAGES_FILES_BETA] : [],
                    ...body.messages.some(message => message.content.some(block => block.type === 'tool_addition' || block.type === 'tool_removal'))
                        ? [MESSAGES_TOOL_CHANGES_BETA]
                        : [],
                ];
                // Credential, file and extension preparation may await. The original
                // Native owner must still be current at each actual Messages delegation.
                assertAgentLoopRequestCurrent(options);
                const response = await fetch(`${messagesApiRoot(connection.baseURL)}/messages`, {
                    method: 'POST', signal, body: extensions.payload, redirect: 'error',
                    headers: {
                        ...attributionHeaders(),
                        'content-type': 'application/json', 'accept': 'text/event-stream',
                        ...auth.headers,
                        'anthropic-version': '2023-06-01',
                        ...betas.length === 0 ? {} : { 'anthropic-beta': betas.join(',') },
                        'x-deepseek-harness-user-id': this.dependencies.resolveUserId(),
                        ...options.sessionId === undefined ? {} : { 'x-deepseek-harness-session-id': String(options.sessionId) },
                        ...options.purpose === 'compaction' ? { 'x-deepseek-harness-compact': '1' } : {},
                    },
                });
                if (!response.ok) {
                    const text = await response.text();
                    let raw;
                    try {
                        raw = JSON.parse(text);
                    }
                    catch (_nonJsonGatewayError) {
                        // HTTP status is authoritative when a gateway does not return JSON.
                    }
                    const detail = providerErrorDetail(raw);
                    if (await files.retry(detail))
                        continue;
                    const failure = providerError(raw, response.status, response.headers);
                    const message = files.errorMessage(response.status, failure.message, detail);
                    throw new LlmError(message, failure.code, { ...failure.failure, cause: new Error(text) });
                }
                await extensions.accept();
                if (response.body === null)
                    throw new LlmError('DeepSeek Messages returned no response body', 'EMPTY_RESPONSE');
                yield* translate(parseSse(response.body, activity), options.model);
                return;
            }
        }
        catch (error) {
            if (auth.onRequestError !== undefined) {
                let mapped;
                try {
                    mapped = await auth.onRequestError(error);
                }
                catch (_credentialUpdateFailed) {
                    throw error;
                }
                throw mapped;
            }
            throw error;
        }
    }
}
