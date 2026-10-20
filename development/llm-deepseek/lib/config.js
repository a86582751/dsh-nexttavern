// Generated from runtime/alpha3/compat/llm-deepseek/src/config.ts; edit the TypeScript source.
import z from '@deepseek-ai/schemastery';
import { isVolatile } from '@deepseek-ai/cosmokit';
import { resolveRetryPolicy, RetryPolicySchema } from '@deepseek-ai/dsh-llm';
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout';
import { DEFAULT_MODELS } from './models.js';
import { DEFAULT_STREAM_IDLE_TIMEOUT_MS, DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, DEFAULT_MAX_INLINE_REQUEST_IMAGE_BYTES, DEFAULT_IMAGE_OFFLOAD_BYTE_QUANTUM, DEFAULT_INLINE_IMAGE_OFFLOAD_BYTE_QUANTUM, DEFAULT_IMAGE_OFFLOAD_COUNT_QUANTUM, DEFAULT_FILE_EXPIRY_SECONDS, DEFAULT_FILE_REFRESH_MARGIN_SECONDS, DEFAULT_FILE_QUOTA_CLEANUP_BATCH, DEFAULT_FILES_API_TIMEOUT_MS } from './defaults.js';
import { DEFAULT_MAX_IMAGES_PER_REQUEST, DEFAULT_MAX_REQUEST_FILES_BYTES, DEFAULT_REQUEST_IMAGE_MAX_BYTES } from './request-pricing.js';
const MODEL_MODALITIES = ['text', 'image'];
/** Read the current value behind every reference of a validated Config.
 * @param config Parsed plugin Config.
 * @returns Plain options for the resolver.
 */
export function plainOptions(config) {
    return Object.fromEntries(Object.entries(config).map(([key, value]) => [key, isVolatile(value) ? value.get() : value]));
}
const catalogModel = z.object({
    id: z.string().required(),
    name: z.string(),
    description: z.string(),
    contextWindow: z.number().step(1).min(1),
    maxTokens: z.number().step(1).min(1),
    inputModalities: z.array(z.union(MODEL_MODALITIES)).min(1).default(['text']),
    imagePixelBudget: z.union([z.number().step(1).min(1), 'low']),
    imageMaxBytes: z.number().step(1).min(1),
    systemPromptUpdate: z.const('in-history'),
    toolUpdate: z.union(['in-history', 'addition-only']),
});
/** Shared schema fields for Messages protocol options. */
export const deepSeekConfigFields = {
    baseURL: z.string().volatile(),
    thinking: z.union(['enabled', 'disabled']).volatile(),
    reasoningEffort: z.union(['off', 'low', 'high', 'max']).volatile(),
    maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_TOKENS).volatile(),
    defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW).volatile(),
    models: z.array(catalogModel).default(DEFAULT_MODELS).volatile(),
    streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS).volatile(),
    maxRequestFilesBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_FILES_BYTES).volatile(),
    maxInlineRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_INLINE_REQUEST_IMAGE_BYTES).volatile(),
    maxImagesPerRequest: z.number().step(1).min(1).default(DEFAULT_MAX_IMAGES_PER_REQUEST).volatile(),
    imageOffloadByteQuantum: z.number().step(1).min(1).default(DEFAULT_IMAGE_OFFLOAD_BYTE_QUANTUM).volatile(),
    inlineImageOffloadByteQuantum: z.number().step(1).min(1).default(DEFAULT_INLINE_IMAGE_OFFLOAD_BYTE_QUANTUM).volatile(),
    imageOffloadCountQuantum: z.number().step(1).min(1).default(DEFAULT_IMAGE_OFFLOAD_COUNT_QUANTUM).volatile(),
    filesApiTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_FILES_API_TIMEOUT_MS).volatile(),
    fileExpiresAfterSeconds: z.number().step(1).min(3_600).max(2_592_000).default(DEFAULT_FILE_EXPIRY_SECONDS).volatile(),
    fileRefreshMarginSeconds: z.number().step(1).min(0).default(DEFAULT_FILE_REFRESH_MARGIN_SECONDS).volatile(),
    fileQuotaCleanupBatch: z.number().step(1).min(1).max(1_000).default(DEFAULT_FILE_QUOTA_CLEANUP_BATCH).volatile(),
    retryPolicy: RetryPolicySchema.volatile(),
};
export const Config = z.object(deepSeekConfigFields);
/** Public API default; the internal endpoint comes from $DEEPSEEK_BASE_URL. */
export const PUBLIC_BASE_URL = 'https://api.deepseek.com/anthropic';
/** Environment variable naming this provider's endpoint, honored only from trusted layers. */
const BASE_URL_ENV = 'DEEPSEEK_BASE_URL';
/** Resolve, validate, and detach the advisory model catalog. */
function resolveModels(models) {
    const seen = new Set();
    return (models ?? DEFAULT_MODELS).map((model) => {
        if (Object.hasOwn(model, 'imageDetail')) {
            throw new Error('llm-deepseek: catalog model imageDetail is no longer supported; use imagePixelBudget');
        }
        if (model.id.length === 0)
            throw new Error('llm-deepseek: catalog model ids must be non-empty');
        if (model.name !== undefined && model.name.length === 0) {
            throw new Error(`llm-deepseek: catalog model "${model.id}" has an empty name`);
        }
        if (model.contextWindow !== undefined
            && (!Number.isInteger(model.contextWindow) || model.contextWindow <= 0)) {
            throw new Error(`llm-deepseek: catalog model "${model.id}" contextWindow must be a positive integer`);
        }
        if (model.maxTokens !== undefined
            && (!Number.isInteger(model.maxTokens) || model.maxTokens <= 0)) {
            throw new Error(`llm-deepseek: catalog model "${model.id}" maxTokens must be a positive integer`);
        }
        const inputModalities = model.inputModalities ?? ['text'];
        if (inputModalities.length === 0) {
            throw new Error(`llm-deepseek: catalog model "${model.id}" inputModalities must not be empty`);
        }
        if (inputModalities.some(modality => !MODEL_MODALITIES.includes(modality))) {
            throw new Error(`llm-deepseek: catalog model "${model.id}" inputModalities must contain only "text" and "image"`);
        }
        if (new Set(inputModalities).size !== inputModalities.length) {
            throw new Error(`llm-deepseek: catalog model "${model.id}" inputModalities must not contain duplicates`);
        }
        const hasImage = inputModalities.includes('image');
        if (!hasImage && (model.imagePixelBudget !== undefined || model.imageMaxBytes !== undefined)) {
            throw new Error(`llm-deepseek: text-only catalog model "${model.id}" cannot declare image request limits`);
        }
        if (model.imagePixelBudget !== undefined
            && model.imagePixelBudget !== 'low'
            && (!Number.isSafeInteger(model.imagePixelBudget) || model.imagePixelBudget <= 0)) {
            throw new Error(`llm-deepseek: catalog model "${model.id}" imagePixelBudget must be "low" or a positive safe integer`);
        }
        if (model.imageMaxBytes !== undefined
            && (!Number.isSafeInteger(model.imageMaxBytes) || model.imageMaxBytes <= 0)) {
            throw new Error(`llm-deepseek: catalog model "${model.id}" imageMaxBytes must be a positive safe integer`);
        }
        // Widened: a dynamic config update reaches this check without schema validation.
        const systemPromptUpdate = model.systemPromptUpdate;
        if (systemPromptUpdate !== undefined && systemPromptUpdate !== 'in-history') {
            throw new Error(`llm-deepseek: catalog model "${model.id}" systemPromptUpdate must be "in-history" when present`);
        }
        const toolUpdate = model.toolUpdate;
        if (toolUpdate !== undefined && toolUpdate !== 'in-history' && toolUpdate !== 'addition-only') {
            throw new Error(`llm-deepseek: catalog model "${model.id}" toolUpdate must be "in-history" or "addition-only" when present`);
        }
        if (seen.has(model.id))
            throw new Error(`llm-deepseek: duplicate catalog model "${model.id}"`);
        seen.add(model.id);
        return {
            id: model.id,
            ...model.name === undefined ? {} : { name: model.name },
            ...model.description === undefined ? {} : { description: model.description },
            ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
            ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
            ...model.systemPromptUpdate === undefined ? {} : { systemPromptUpdate: model.systemPromptUpdate },
            ...model.toolUpdate === undefined ? {} : { toolUpdate: model.toolUpdate },
            inputModalities: [...inputModalities],
            ...hasImage
                ? {
                    ...model.imagePixelBudget === undefined ? {} : { imagePixelBudget: model.imagePixelBudget },
                    imageMaxBytes: model.imageMaxBytes ?? DEFAULT_REQUEST_IMAGE_MAX_BYTES,
                }
                : {},
        };
    });
}
/**
 * The one explicit resolve step from raw config to validated protocol
 * settings. Programmatic construction may bypass Schemastery normalization, so
 * every default and bound is re-judged here — for the composition entry at
 * load (fail loud) and for each settings snapshot at its first use.
 * @param config - raw plugin config or resolved settings snapshot.
 * @param environment - this run's environment layers, or `undefined` outside
 * the product CLI. Every layer may supply an endpoint: the product trusts the
 * project it is launched in, so a checkout can point its own agent at the
 * gateway that checkout is meant to use.
 * @returns validated protocol settings.
 */
export function resolveAdapterOptions(config, environment) {
    // Settings updates can reach this resolver without schema validation.
    if (Object.hasOwn(config, 'protocol')) {
        throw new Error('llm-deepseek: protocol is not configurable; remove it and use a Messages-compatible baseURL');
    }
    if (config.thinking === 'disabled'
        && config.reasoningEffort !== undefined
        && config.reasoningEffort !== 'off') {
        throw new Error('llm-deepseek: only reasoningEffort "off" can be configured when thinking is disabled');
    }
    if (config.defaultContextWindow !== undefined
        && (!Number.isInteger(config.defaultContextWindow) || config.defaultContextWindow <= 0)) {
        throw new Error('llm-deepseek: defaultContextWindow must be a positive integer');
    }
    if (config.maxTokens !== undefined
        && (!Number.isSafeInteger(config.maxTokens) || config.maxTokens <= 0)) {
        throw new Error('llm-deepseek: maxTokens must be a positive safe integer');
    }
    const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
    if (!Number.isFinite(streamIdleTimeoutMs)
        || streamIdleTimeoutMs <= 0
        || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) {
        throw new Error(`llm-deepseek: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
    }
    const maxRequestFilesBytes = config.maxRequestFilesBytes ?? DEFAULT_MAX_REQUEST_FILES_BYTES;
    if (!Number.isSafeInteger(maxRequestFilesBytes) || maxRequestFilesBytes <= 0) {
        throw new Error('llm-deepseek: maxRequestFilesBytes must be a positive safe integer');
    }
    const maxInlineRequestImageBytes = config.maxInlineRequestImageBytes ?? DEFAULT_MAX_INLINE_REQUEST_IMAGE_BYTES;
    if (!Number.isSafeInteger(maxInlineRequestImageBytes) || maxInlineRequestImageBytes <= 0) {
        throw new Error('llm-deepseek: maxInlineRequestImageBytes must be a positive safe integer');
    }
    const maxImagesPerRequest = config.maxImagesPerRequest ?? DEFAULT_MAX_IMAGES_PER_REQUEST;
    if (!Number.isSafeInteger(maxImagesPerRequest) || maxImagesPerRequest <= 0) {
        throw new Error('llm-deepseek: maxImagesPerRequest must be a positive safe integer');
    }
    const imageOffloadByteQuantum = config.imageOffloadByteQuantum ?? DEFAULT_IMAGE_OFFLOAD_BYTE_QUANTUM;
    if (!Number.isSafeInteger(imageOffloadByteQuantum) || imageOffloadByteQuantum <= 0) {
        throw new Error('llm-deepseek: imageOffloadByteQuantum must be a positive safe integer');
    }
    if (imageOffloadByteQuantum > maxRequestFilesBytes) {
        throw new Error('llm-deepseek: imageOffloadByteQuantum must not exceed maxRequestFilesBytes');
    }
    const inlineImageOffloadByteQuantum = config.inlineImageOffloadByteQuantum
        ?? DEFAULT_INLINE_IMAGE_OFFLOAD_BYTE_QUANTUM;
    if (!Number.isSafeInteger(inlineImageOffloadByteQuantum) || inlineImageOffloadByteQuantum <= 0) {
        throw new Error('llm-deepseek: inlineImageOffloadByteQuantum must be a positive safe integer');
    }
    if (inlineImageOffloadByteQuantum > maxInlineRequestImageBytes) {
        throw new Error('llm-deepseek: inlineImageOffloadByteQuantum must not exceed maxInlineRequestImageBytes');
    }
    const imageOffloadCountQuantum = config.imageOffloadCountQuantum ?? DEFAULT_IMAGE_OFFLOAD_COUNT_QUANTUM;
    if (!Number.isSafeInteger(imageOffloadCountQuantum) || imageOffloadCountQuantum <= 0) {
        throw new Error('llm-deepseek: imageOffloadCountQuantum must be a positive safe integer');
    }
    if (imageOffloadCountQuantum > maxImagesPerRequest) {
        throw new Error('llm-deepseek: imageOffloadCountQuantum must not exceed maxImagesPerRequest');
    }
    const filesApiTimeoutMs = config.filesApiTimeoutMs ?? DEFAULT_FILES_API_TIMEOUT_MS;
    if (!Number.isFinite(filesApiTimeoutMs)
        || filesApiTimeoutMs <= 0
        || filesApiTimeoutMs > MAX_TIMER_DELAY_MS) {
        throw new Error(`llm-deepseek: filesApiTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
    }
    const fileExpiresAfterSeconds = config.fileExpiresAfterSeconds ?? DEFAULT_FILE_EXPIRY_SECONDS;
    if (!Number.isSafeInteger(fileExpiresAfterSeconds)
        || fileExpiresAfterSeconds < 3_600
        || fileExpiresAfterSeconds > 2_592_000) {
        throw new Error('llm-deepseek: fileExpiresAfterSeconds must be an integer from 3600 through 2592000');
    }
    const fileRefreshMarginSeconds = config.fileRefreshMarginSeconds ?? DEFAULT_FILE_REFRESH_MARGIN_SECONDS;
    if (!Number.isSafeInteger(fileRefreshMarginSeconds)
        || fileRefreshMarginSeconds < 0
        || fileRefreshMarginSeconds >= fileExpiresAfterSeconds) {
        throw new Error('llm-deepseek: fileRefreshMarginSeconds must be a non-negative integer below fileExpiresAfterSeconds');
    }
    const fileQuotaCleanupBatch = config.fileQuotaCleanupBatch ?? DEFAULT_FILE_QUOTA_CLEANUP_BATCH;
    if (!Number.isSafeInteger(fileQuotaCleanupBatch)
        || fileQuotaCleanupBatch < 1
        || fileQuotaCleanupBatch > 1_000) {
        throw new Error('llm-deepseek: fileQuotaCleanupBatch must be an integer from 1 through 1000');
    }
    const baseURL = config.baseURL ?? environment?.get(BASE_URL_ENV)?.value ?? PUBLIC_BASE_URL;
    const parsed = new URL(baseURL);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
        throw new Error('llm-deepseek: Messages baseURL must be an HTTP(S) root without credentials, query, or fragment');
    }
    return {
        baseURL,
        defaults: {
            thinking: config.thinking,
            reasoningEffort: config.reasoningEffort,
        },
        maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
        defaultContextWindow: config.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW,
        models: resolveModels(config.models),
        streamIdleTimeoutMs,
        maxRequestFilesBytes,
        maxInlineRequestImageBytes,
        maxImagesPerRequest,
        imageOffloadByteQuantum,
        inlineImageOffloadByteQuantum,
        imageOffloadCountQuantum,
        filesApiTimeoutMs,
        filePolicy: {
            expiresAfterSeconds: fileExpiresAfterSeconds,
            refreshMarginSeconds: fileRefreshMarginSeconds,
            quotaCleanupBatch: fileQuotaCleanupBatch,
        },
        retryPolicy: resolveRetryPolicy(config.retryPolicy, 'llm-deepseek: retryPolicy'),
    };
}
