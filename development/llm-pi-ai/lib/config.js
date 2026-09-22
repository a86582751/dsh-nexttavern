// Generated from runtime/alpha3/compat/llm-pi-ai/src/config.ts; edit the TypeScript source.
import z from '@deepseek-ai/schemastery';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout';
import { resolveRetryPolicy, RetryPolicySchema } from '@deepseek-ai/dsh-llm';
import { deepEqualJson } from '@deepseek-ai/dsh-util-values';
import { CACHE_CONTROL_FORMATS, CHAT_TEMPLATE_VARS, MAX_TOKENS_FIELDS, MODALITIES, PiAiCatalogError, resolveRouteModels, SUPPORTED_THINKING_FORMATS, THINKING_LEVELS, THINKING_TOKEN_BUDGET_FIELDS, } from './catalog.js';
import { buildProvider, supportedProtocols } from './provider.js';
/** Default maximum idle interval while an adapter stream read is outstanding. */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000;
/**
 * Default request-level bound on base64-encoded image payload. Every image in
 * history is re-encoded into every request body, so an unbounded conversation
 * eventually exceeds a provider or gateway request-size cap and the session
 * can never complete another request. The 20MiB default admits fifteen 1MiB
 * request versions after base64 expansion and reserves request capacity for
 * system prompts, history, tools, and JSON.
 * Deployments behind stricter gateways lower it per route.
 */
export const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
/** Default total-pixel budget preserves the complete 2048px normalized attachment. */
export const DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048;
/** Default raw encoded-byte target before inline base64 expansion; the smallest quality-ladder output is used when no quality fits. */
export const DEFAULT_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;
/** Context capacity assumed for a model neither configuration nor the catalog sizes. */
export const DEFAULT_CONTEXT_WINDOW = 262_144;
/** Output capability assumed for a model neither configuration nor the catalog sizes. */
export const DEFAULT_MAX_TOKENS = 32_768;
/**
 * Modalities assumed for a model neither configuration nor the catalog
 * declares. Text is the floor every supported protocol certainly carries, so
 * this is the absence of a declaration rather than a guess at the endpoint:
 * nothing can interrogate a gateway for its modalities, and the two wrong
 * answers do not cost the same. Under-claiming refuses the image before it is
 * attached, naming the model. Over-claiming admits one the provider then
 * rejects mid-turn, after the message is durable, leaving the session
 * repeating a request that cannot succeed.
 */
export const DEFAULT_INPUT = ['text'];
const thinkingBudgets = z.object({
    minimal: z.number(),
    low: z.number(),
    medium: z.number(),
    high: z.number(),
});
/**
 * One `chat_template_kwargs` or `chat_template_args` value. The `$var` member
 * is pi-ai's placeholder for a value dispatch fills from the request's
 * thinking state, which makes a template-driven gateway configurable without
 * restating its template.
 */
const chatTemplateKwarg = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.const(null),
    z.object({
        $var: z.union(CHAT_TEMPLATE_VARS).required(),
        omitWhenOff: z.boolean(),
    }),
]);
const compatProfile = z.object({
    supportsStore: z.boolean(),
    supportsDeveloperRole: z.boolean(),
    supportsReasoningEffort: z.boolean(),
    supportsUsageInStreaming: z.boolean(),
    supportsFinishReason: z.boolean(),
    maxTokensField: z.union(MAX_TOKENS_FIELDS),
    requiresToolResultName: z.boolean(),
    requiresAssistantAfterToolResult: z.boolean(),
    requiresThinkingAsText: z.boolean(),
    requiresReasoningContentOnAssistantMessages: z.boolean(),
    thinkingFormat: z.union(SUPPORTED_THINKING_FORMATS),
    chatTemplateKwargs: z.dict(chatTemplateKwarg),
    chatTemplateArgs: z.dict(chatTemplateKwarg),
    supportsThinkingTokenBudget: z.boolean(),
    thinkingTokenBudgetField: z.union(THINKING_TOKEN_BUDGET_FIELDS),
    vllmPriority: z.number().step(1),
    supportsMaxOutputTokens: z.boolean(),
    supportsStrictMode: z.boolean(),
    cacheControlFormat: z.union(CACHE_CONTROL_FORMATS),
    supportsLongCacheRetention: z.boolean(),
    supportsEagerToolInputStreaming: z.boolean(),
    supportsCacheControlOnTools: z.boolean(),
    supportsTemperature: z.boolean(),
    forceAdaptiveThinking: z.boolean(),
    allowEmptySignature: z.boolean(),
    supportsStrictTools: z.boolean(),
});
/**
 * Keys are the offered levels, values their wire spellings. A valueless key
 * (`off:`) survives validation because schemastery passes nullable data
 * through before any member schema runs — `z.const(null)` only controls the
 * error for non-null wrong values and what a configuration UI renders.
 * Only resolution decides which levels may leave the value empty, so the
 * diagnostic can name the route and model. The assertion narrows
 * schemastery's `Dict`, which types every literal key as required; dict
 * validation checks only present keys, so the runtime value is a partial record.
 */
const reasoningEfforts = z.dict(z.union([z.string(), z.const(null)]), z.union(THINKING_LEVELS));
/** The fields a `models` entry and a `modelOverrides` value share; only the id's home differs. */
const modelFields = {
    name: z.string(),
    contextWindow: z.number().step(1).min(1),
    maxTokens: z.number().step(1).min(1),
    // No explicit default, unlike the route's `defaultInput`: schemastery
    // materializes `[]` for an absent array, and resolution reads that as "no
    // answer here" so the catalog entry below still applies.
    input: z.array(z.union(MODALITIES)),
    // The union, not a bare dict: schemastery materializes an absent dict as
    // `{}`, and absent must stay distinguishable — it means "inherit the
    // installed catalog's capability", while `false` disables reasoning.
    reasoningEfforts: z.union([z.const(false), reasoningEfforts]),
    compat: compatProfile,
};
const modelProfile = z.object({
    id: z.string().required(),
    ...modelFields,
});
/** A {@link modelProfile} whose id lives in the `modelOverrides` dict key. */
const modelOverride = z.object(modelFields);
const profile = z.object({
    apiKeyEnv: z.string().role('credential-ref'),
    displayName: z.string(),
    api: z.union(supportedProtocols()),
    baseURL: z.string(),
    models: z.array(modelProfile),
    modelOverrides: z.dict(modelOverride),
    compat: compatProfile,
    defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW),
    defaultMaxTokens: z.number().step(1).min(1).default(DEFAULT_MAX_TOKENS),
    defaultInput: z.array(z.union(MODALITIES)).default([...DEFAULT_INPUT]),
    headers: z.dict(z.string()),
    reasoning: z.union(THINKING_LEVELS),
    thinkingBudgets,
    cacheRetention: z.union(['none', 'short', 'long']),
    transport: z.union(['sse', 'websocket', 'websocket-cached', 'auto']),
    timeoutMs: z.natural(),
    websocketConnectTimeoutMs: z.natural(),
    streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
    maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
    requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
    requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES),
    retryPolicy: RetryPolicySchema,
});
/** Runtime schema for {@link Config}. */
export const Config = z.object({
    providers: z.dict(profile).default({}).volatile(),
});
/**
 * Reject new or changed provider profiles that cannot be served. Unchanged
 * stored profiles may need repair after a catalog upgrade and do not block
 * edits to another provider. Removed profiles require no catalog validation.
 * @param config - the resolved section to check.
 * @param previous - current resolved section; omission checks every provider.
 * @throws Error naming the route and configuration entry that cannot be served.
 */
export function assertServiceable(config, previous) {
    const changed = Object.fromEntries(Object.entries(config.providers ?? {}).filter(([provider, profile]) => !deepEqualJson(profile, previous?.providers?.[provider])));
    resolveProfiles(changed);
}
/** Reject removed pre-release profile fields and name their replacements. */
function rejectRemovedFields(provider, source) {
    const legacy = source;
    if ('provider' in legacy) {
        throw new Error(`llm-pi-ai: provider "${provider}" sets "provider", which moved to the providers dict key`);
    }
    if ('maxRetries' in legacy || 'maxRetryDelayMs' in legacy) {
        throw new Error(`llm-pi-ai: provider "${provider}" sets maxRetries or maxRetryDelayMs, which were removed;`
            + ' compose agent recovery with dsh-llm-retry');
    }
}
/** Reject a profile header that Fetch cannot put on a provider request. */
function assertValidHeaders(provider, headers) {
    for (const [name, value] of Object.entries(headers ?? {})) {
        try {
            new Headers([[name, value]]);
        }
        catch {
            throw new Error(`llm-pi-ai: provider "${provider}" header "${name}" is not valid for Fetch;`
                + ' use a valid HTTP field name and a single-line value representable as bytes');
        }
    }
}
/**
 * Resolve scalar defaults and materialize each route's serviceable models.
 * Deferred catalog validation retains diagnostics without deleting configured
 * routes. An omitted dict resolves to the empty, dormant route set.
 * @param providers - configured provider profiles keyed by route.
 * @param validation - writes require a complete catalog; stored reads retain catalog diagnostics.
 * @returns validated profiles in configuration order.
 */
export function resolveProfiles(providers, validation = 'strict') {
    if (Array.isArray(providers)) {
        throw new Error('llm-pi-ai: providers is now a dict keyed by provider route, not an array of profiles');
    }
    const entries = Object.entries(providers ?? {});
    const resolved = new Map();
    for (const [provider, source] of entries) {
        rejectRemovedFields(provider, source);
        if (provider.length === 0)
            throw new Error('llm-pi-ai: provider names must be non-empty');
        if (source.baseURL !== undefined && source.baseURL.length === 0) {
            throw new Error(`llm-pi-ai: provider "${provider}" has an empty baseURL`);
        }
        if (source.displayName !== undefined && source.displayName.length === 0) {
            throw new Error(`llm-pi-ai: provider "${provider}" has an empty displayName`);
        }
        assertValidHeaders(provider, source.headers);
        const streamIdleTimeoutMs = source.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
        if (!Number.isFinite(streamIdleTimeoutMs)
            || streamIdleTimeoutMs <= 0
            || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) {
            throw new Error(`llm-pi-ai: provider "${provider}" streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
        }
        const maxRequestImageBytes = source.maxRequestImageBytes ?? DEFAULT_MAX_REQUEST_IMAGE_BYTES;
        if (!Number.isInteger(maxRequestImageBytes) || maxRequestImageBytes <= 0) {
            throw new Error(`llm-pi-ai: provider "${provider}" maxRequestImageBytes must be a positive integer`);
        }
        const requestImagePixelBudget = source.requestImagePixelBudget ?? DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET;
        if (!Number.isSafeInteger(requestImagePixelBudget) || requestImagePixelBudget <= 0) {
            throw new Error(`llm-pi-ai: provider "${provider}" requestImagePixelBudget must be a positive safe integer`);
        }
        const requestImageMaxBytes = source.requestImageMaxBytes ?? DEFAULT_REQUEST_IMAGE_MAX_BYTES;
        if (!Number.isSafeInteger(requestImageMaxBytes) || requestImageMaxBytes <= 0) {
            throw new Error(`llm-pi-ai: provider "${provider}" requestImageMaxBytes must be a positive safe integer`);
        }
        // Detached from the configuration object because pi-ai types `Model.input`
        // mutable. The schema's explicit default covers an absent key, so an empty
        // list here is always one someone typed — and unlike an entry's, nothing
        // below it can answer instead — so it is refused rather than read as "no
        // answer".
        const defaultInput = [...source.defaultInput ?? DEFAULT_INPUT];
        if (defaultInput.length === 0) {
            throw new Error(`llm-pi-ai: provider "${provider}" defaultInput must name at least one modality`);
        }
        // The route key, not the installed provider's own name: the directory has
        // always shown route keys, and a catalog route must not silently rename
        // itself on every configuration surface just because it gained a profile.
        const displayName = source.displayName ?? provider;
        let catalog;
        let piProvider;
        let catalogError;
        try {
            catalog = resolveRouteModels({
                provider,
                ...source.api === undefined ? {} : { api: source.api },
                ...source.baseURL === undefined ? {} : { baseURL: source.baseURL },
                ...source.models === undefined ? {} : { models: source.models },
                ...source.modelOverrides === undefined ? {} : { modelOverrides: source.modelOverrides },
                ...source.compat === undefined ? {} : { compat: source.compat },
                defaultInput,
                defaultContextWindow: source.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW,
                defaultMaxTokens: source.defaultMaxTokens ?? DEFAULT_MAX_TOKENS,
            }, validation);
            catalogError = catalog.modelErrors.values().next().value;
            piProvider = buildProvider({
                provider,
                displayName,
                ...source.api === undefined ? {} : { api: source.api },
                ...source.baseURL === undefined ? {} : { baseURL: source.baseURL },
                models: catalog.models,
                namesCredential: source.apiKeyEnv !== undefined,
            });
        }
        catch (error) {
            if (validation === 'strict' || !(error instanceof PiAiCatalogError))
                throw error;
            catalogError ??= error.message;
        }
        const { apiKeyEnv, retryPolicy, models: _models, displayName: _displayName, ...rest } = source;
        resolved.set(provider, {
            ...rest,
            provider,
            displayName,
            ...apiKeyEnv === undefined ? {} : { apiKeyEnv: credentialRef(apiKeyEnv) },
            streamIdleTimeoutMs,
            maxRequestImageBytes,
            requestImagePixelBudget,
            requestImageMaxBytes,
            retryPolicy: resolveRetryPolicy(retryPolicy, `llm-pi-ai: provider "${provider}" retryPolicy`),
            ...rest.headers === undefined ? {} : { headers: { ...rest.headers } },
            ...rest.thinkingBudgets === undefined ? {} : { thinkingBudgets: { ...rest.thinkingBudgets } },
            configuredMaxTokens: catalog?.configuredMaxTokens ?? new Map(),
            modelErrors: catalog?.modelErrors ?? new Map(),
            ...piProvider === undefined ? {} : { piProvider },
            ...catalogError === undefined ? {} : { catalogError },
        });
    }
    return resolved;
}
