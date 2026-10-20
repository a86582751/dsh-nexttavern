// Generated from runtime/alpha3/compat/llm-deepseek/src/files-api.ts; edit the TypeScript source.
/** DeepSeek Files API transport. @module dsh-llm-deepseek/files-api */
import { attributionHeaders, LlmError } from '@deepseek-ai/dsh-llm';
import { DeepSeekFileId } from './file-id.js';
import { messagesApiRoot, MESSAGES_FILES_BETA } from './messages-api.js';
/** Minimum provider-supported file lifetime. */
export const MIN_FILE_EXPIRY_SECONDS = 3_600;
/** Maximum provider-supported file lifetime. */
export const MAX_FILE_EXPIRY_SECONDS = 2_592_000;
/** Maximum Files API upload size. */
export const MAX_FILE_UPLOAD_BYTES = 128 * 1024 * 1024;
/** Current per-key file-count quota. */
export const MAX_STORED_FILE_COUNT = 10_000;
/** Current per-key storage quota. */
export const MAX_STORED_FILE_BYTES = 25 * 1024 * 1024 * 1024;
/** Files API operation failure with its HTTP status retained for recovery policy. */
export class DeepSeekFilesError extends LlmError {
    /** Parsed provider detail used only for error classification. */
    detail;
    /**
     * @param message - user-readable provider failure.
     * @param status - HTTP status returned by the Files API.
     * @param detail - provider error fields joined for classification.
     */
    constructor(message, status, detail) {
        super(message, status === 401 || status === 403
            ? 'AUTH'
            : status === 429
                ? 'RATE_LIMIT'
                : status >= 500
                    ? 'SERVER'
                    : 'FILES_API', { status });
        this.name = 'DeepSeekFilesError';
        this.detail = detail;
    }
}
/**
 * Whether an upload failure reports a provider storage or file-count quota.
 * @param error - Files API operation failure.
 * @returns whether one bounded remote cleanup and upload retry may recover.
 */
export function isFilesQuotaError(error) {
    return error instanceof DeepSeekFilesError
        && /(?:quota|storage|stored files|file count|too many files)/iu.test(error.detail);
}
function invalidResponse(operation) {
    return new LlmError(`DeepSeek Files API returned an invalid ${operation} response.`, 'INVALID_RESPONSE');
}
/** Decode successful Files JSON with operation context; body transport and abort failures retain their identity. */
async function responseJson(response, operation) {
    try {
        return await response.json();
    }
    catch (error) {
        if (!(error instanceof SyntaxError))
            throw error;
        throw new LlmError(`DeepSeek Files API returned invalid JSON for ${operation} (HTTP ${response.status}).`, 'INVALID_RESPONSE', {
            status: response.status,
            cause: error,
        });
    }
}
function parseFileObject(value, operation) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        throw invalidResponse(operation);
    const wire = value;
    const createdAt = typeof wire.created_at === 'string' ? Math.floor(Date.parse(wire.created_at) / 1_000) : NaN;
    if (typeof wire.id !== 'string' || wire.id.length === 0
        || wire.type !== 'file'
        || typeof wire.mime_type !== 'string'
        || typeof wire.size_bytes !== 'number' || !Number.isSafeInteger(wire.size_bytes) || wire.size_bytes < 0
        || !Number.isSafeInteger(createdAt) || createdAt < 0
        || typeof wire.filename !== 'string' || wire.filename.length === 0) {
        throw invalidResponse(operation);
    }
    return {
        id: DeepSeekFileId(wire.id),
        bytes: wire.size_bytes,
        createdAt,
        filename: wire.filename,
    };
}
function providerErrorDetail(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return { detail: '' };
    const error = value.error;
    if (error === null || typeof error !== 'object' || Array.isArray(error))
        return { detail: '' };
    const fields = error;
    const message = typeof fields.message === 'string' ? fields.message : undefined;
    return {
        ...message === undefined ? {} : { message },
        detail: [fields.code, fields.type, fields.message]
            .filter((field) => typeof field === 'string')
            .join(' '),
    };
}
/** Direct Files client retaining the configured URL root and refusing redirects before credentials can leave its origin. */
export class DeepSeekFilesClient {
    baseURL;
    authHeaders;
    fetchImpl;
    /**
     * @param options - endpoint, authentication headers, and optional test transport.
     */
    constructor(options) {
        this.authHeaders = options.headers;
        this.fetchImpl = options.fetch ?? globalThis.fetch;
        this.baseURL = messagesApiRoot(options.baseURL);
    }
    async request(path, init, signal) {
        let response;
        try {
            const headers = new Headers(attributionHeaders());
            for (const [name, value] of Object.entries(this.authHeaders))
                headers.set(name, value);
            headers.set('anthropic-version', '2023-06-01');
            headers.set('anthropic-beta', MESSAGES_FILES_BETA);
            response = await this.fetchImpl(`${this.baseURL}${path}`, {
                ...init,
                redirect: 'error',
                headers,
                ...signal === undefined ? {} : { signal },
            });
        }
        catch (error) {
            if (signal?.aborted)
                throw error;
            throw new LlmError(`DeepSeek Files API request to ${this.baseURL} failed`, 'TRANSPORT', { cause: error });
        }
        if (response.ok)
            return response;
        let parsed;
        try {
            parsed = await response.json();
        }
        catch {
            // A status remains sufficient to report the provider failure.
        }
        const { message, detail } = providerErrorDetail(parsed);
        throw new DeepSeekFilesError(message ?? `DeepSeek Files API error (HTTP ${response.status})`, response.status, detail);
    }
    /**
     * Upload one image with an explicit expiry.
     * @param input - deterministic request-version bytes, media type, filename, lifetime, and cancellation.
     * @returns the validated file and reuse deadline. Messages omits expiry metadata;
     *   its deadline uses upload creation plus the requested lifetime.
     */
    async upload(input) {
        if (input.data.byteLength > MAX_FILE_UPLOAD_BYTES) {
            throw new LlmError('DeepSeek Files API upload exceeds 128 MiB.', 'INVALID_REQUEST');
        }
        if (!Number.isSafeInteger(input.expiresAfterSeconds)
            || input.expiresAfterSeconds < MIN_FILE_EXPIRY_SECONDS
            || input.expiresAfterSeconds > MAX_FILE_EXPIRY_SECONDS) {
            throw new LlmError('DeepSeek file expiry must be between 3600 and 2592000 seconds.', 'INVALID_REQUEST');
        }
        const form = new FormData();
        form.set('expires_after[anchor]', 'created_at');
        form.set('expires_after[seconds]', String(input.expiresAfterSeconds));
        form.set('file', new Blob([Uint8Array.from(input.data).buffer], { type: input.mediaType }), input.filename);
        const response = await this.request('/files', { method: 'POST', body: form }, input.signal);
        const file = parseFileObject(await responseJson(response, 'upload'), 'upload');
        return { ...file, expiresAt: file.createdAt + input.expiresAfterSeconds };
    }
    /**
     * List one provider-ordered page of files.
     * @param options - pagination and cancellation.
     * @returns the validated page with null cursors omitted.
     */
    async list(options = {}) {
        const query = new URLSearchParams();
        if (options.after !== undefined)
            query.set('after_id', options.after);
        if (options.limit !== undefined)
            query.set('limit', String(options.limit));
        const response = await this.request(`/files?${query.toString()}`, { method: 'GET' }, options.signal);
        const value = await responseJson(response, 'list');
        if (value === null || typeof value !== 'object' || Array.isArray(value))
            throw invalidResponse('list');
        const wire = value;
        const firstId = wire.first_id ?? undefined;
        const lastId = wire.last_id ?? undefined;
        if (!Array.isArray(wire.data) || typeof wire.has_more !== 'boolean'
            || (firstId !== undefined && typeof firstId !== 'string')
            || (lastId !== undefined && typeof lastId !== 'string')) {
            throw invalidResponse('list');
        }
        return {
            data: wire.data.map(item => parseFileObject(item, 'list')),
            ...typeof firstId === 'string' ? { firstId: DeepSeekFileId(firstId) } : {},
            ...typeof lastId === 'string' ? { lastId: DeepSeekFileId(lastId) } : {},
            hasMore: wire.has_more,
        };
    }
    /**
     * Retrieve one file object.
     * @param fileId - provider file identifier.
     * @param signal - request cancellation.
     * @returns the validated file object.
     */
    async retrieve(fileId, signal) {
        const response = await this.request(`/files/${encodeURIComponent(fileId)}`, { method: 'GET' }, signal);
        return parseFileObject(await responseJson(response, 'retrieve'), 'retrieve');
    }
    /**
     * Delete one provider file.
     * @param fileId - provider file identifier.
     * @param signal - request cancellation.
     */
    async delete(fileId, signal) {
        const response = await this.request(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }, signal);
        const value = await responseJson(response, 'delete');
        if (value === null || typeof value !== 'object' || Array.isArray(value))
            throw invalidResponse('delete');
        const wire = value;
        if (wire.id !== fileId || wire.type !== 'file_deleted')
            throw invalidResponse('delete');
    }
}
