// Generated from runtime/alpha3/compat/llm-deepseek/src/file-store.ts; edit the TypeScript source.
/** DeepSeek Files API upload reuse, invalidation, and quota recovery. @module dsh-llm-deepseek/file-store */
import { LlmError } from '@deepseek-ai/dsh-llm';
import { DeepSeekFilesClient, isFilesQuotaError } from './files-api.js';
import { messagesApiRoot } from './messages-api.js';
import { deepSeekFileScope, DeepSeekUploadIndex } from './upload-index.js';
/** Shared Files-store limit for each request image, including file-id references. */
export const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const OWNED_FILE_PREFIX = 'dsh-';
/** The Files resource's parent URL identifies the upload namespace. */
function fileScope(connection) {
    return deepSeekFileScope(messagesApiRoot(connection.baseURL), JSON.stringify(Object.entries(connection.headers).sort(([left], [right]) => left.localeCompare(right))));
}
function abortReason(signal) {
    const reason = signal.reason;
    return reason instanceof Error
        ? reason
        : new Error('DeepSeek file upload cancelled with a non-Error reason.', { cause: reason });
}
function uploadFailure(error) {
    return error instanceof Error
        ? error
        : new Error('DeepSeek file upload failed with a non-Error reason.', { cause: error });
}
function waitForUpload(operation, signal) {
    signal?.throwIfAborted();
    operation.waiters += 1;
    let released = false;
    const release = (cancelledReason) => {
        if (released)
            return;
        released = true;
        operation.waiters -= 1;
        if (cancelledReason !== undefined && operation.waiters === 0 && !operation.settled) {
            operation.controller.abort(cancelledReason);
        }
    };
    if (signal === undefined) {
        return operation.promise.finally(() => {
            release();
        });
    }
    return new Promise((resolve, reject) => {
        const abort = () => {
            const reason = abortReason(signal);
            release(reason);
            reject(reason);
        };
        signal.addEventListener('abort', abort, { once: true });
        void operation.promise.then((value) => {
            signal.removeEventListener('abort', abort);
            release();
            resolve(value);
        }, (error) => {
            signal.removeEventListener('abort', abort);
            release();
            reject(uploadFailure(error));
        });
    });
}
function extension(mediaType) {
    switch (mediaType) {
        case 'image/png': return 'png';
        case 'image/jpeg': return 'jpeg';
        case 'image/webp': return 'webp';
        case 'image/gif': return 'gif';
    }
}
function filename(version) {
    const attachment = String(version.attachment.attachmentId).slice('sha256:'.length, 'sha256:'.length + 16);
    const variant = String(version.variantId).slice('sha256:'.length, 'sha256:'.length + 8);
    return `${OWNED_FILE_PREFIX}${attachment}-${variant}.${extension(version.mediaType)}`;
}
/** User-scoped durable file-id reuse for the DeepSeek route. */
export class DeepSeekFileStore {
    index;
    now;
    fetchImpl;
    inflight = new Map();
    /**
     * @param options - testable index, clock, and transport boundaries.
     */
    constructor(options = {}) {
        this.index = options.index ?? new DeepSeekUploadIndex();
        this.now = options.now ?? Date.now;
        this.fetchImpl = options.fetch;
    }
    client(connection) {
        return new DeepSeekFilesClient({
            baseURL: connection.baseURL,
            headers: connection.headers,
            ...this.fetchImpl === undefined ? {} : { fetch: this.fetchImpl },
        });
    }
    /**
     * Resolve or upload one deterministic request image. Concurrent calls share one upload while retaining independent waits.
     * @param version - deterministic model-request bytes and complete transformation identity.
     * @param connection - endpoint and API-key snapshot.
     * @param policy - expiry and quota-recovery policy.
     * @param signal - cancellation of this wait; shared transport stops when no waiter remains.
     * @returns a reusable file id and whether this call published a new upload.
     */
    ensureUploaded(version, connection, policy, signal) {
        signal?.throwIfAborted();
        const scope = fileScope(connection);
        const key = `${scope}\0${version.variantId}`;
        let active = this.inflight.get(key);
        if (active?.controller.signal.aborted) {
            this.inflight.delete(key);
            active = undefined;
        }
        if (active !== undefined)
            return waitForUpload(active, signal);
        const controller = new AbortController();
        const shared = {
            controller,
            settled: false,
            waiters: 0,
            promise: undefined,
        };
        shared.promise = this.ensureUploadedOnce(version, connection, policy, controller.signal).then((value) => {
            shared.settled = true;
            return value;
        }, (error) => {
            shared.settled = true;
            throw uploadFailure(error);
        });
        this.inflight.set(key, shared);
        void shared.promise.finally(() => {
            if (this.inflight.get(key) === shared)
                this.inflight.delete(key);
        }).catch(() => { });
        return waitForUpload(shared, signal);
    }
    async ensureUploadedOnce(version, connection, policy, signal) {
        if (version.bytes > MAX_IMAGE_BYTES) {
            throw new LlmError('DeepSeek image exceeds the 32 MiB per-image limit.', 'INVALID_REQUEST');
        }
        const scope = fileScope(connection);
        const now = this.now();
        const marginMs = policy.refreshMarginSeconds * 1_000;
        const cached = await this.index.get(scope, version.variantId, now, marginMs);
        if (cached !== undefined)
            return { record: cached, uploaded: false };
        const client = this.client(connection);
        const upload = async () => {
            const remote = await client.upload({
                data: version.data,
                mediaType: version.mediaType,
                filename: filename(version),
                expiresAfterSeconds: policy.expiresAfterSeconds,
                signal,
            });
            if (remote.bytes !== version.data.byteLength) {
                throw new LlmError('DeepSeek Files API upload response does not match the submitted image.', 'INVALID_RESPONSE');
            }
            return {
                scope,
                attachmentId: version.attachment.attachmentId,
                variantId: version.variantId,
                fileId: remote.id,
                bytes: remote.bytes,
                createdAt: remote.createdAt * 1_000,
                expiresAt: remote.expiresAt * 1_000,
            };
        };
        let candidate;
        try {
            candidate = await upload();
        }
        catch (error) {
            if (!isFilesQuotaError(error))
                throw error;
            const deleted = await this.reclaimOldestOwned(connection, policy.quotaCleanupBatch, signal);
            if (deleted === 0)
                throw error;
            candidate = await upload();
        }
        const committed = await this.index.commit(candidate, this.now(), marginMs);
        if (!committed.accepted) {
            try {
                await client.delete(candidate.fileId, signal);
            }
            catch {
                // The winning mapping is durable. A failed duplicate cleanup affects quota only and is retried by recovery.
            }
        }
        return { record: committed.record, uploaded: committed.accepted };
    }
    /**
     * Invalidate one exact local mapping after a model request rejects its remote id.
     * @param version - request-image version whose remote generation failed.
     * @param fileId - exact rejected file id.
     * @param connection - endpoint and API-key snapshot.
     */
    async invalidate(version, fileId, connection) {
        await this.index.remove(fileScope(connection), version.variantId, fileId);
    }
    /**
     * Delete the indexed remote file for one attachment and remove its local mapping.
     * @param version - exact request-image version to release.
     * @param connection - endpoint and API-key snapshot.
     * @param policy - expiry policy used to locate a reusable mapping.
     * @param signal - request cancellation.
     * @returns whether an indexed file existed and was deleted.
     */
    async release(version, connection, policy, signal) {
        const scope = fileScope(connection);
        const record = await this.index.get(scope, version.variantId, this.now(), policy.refreshMarginSeconds * 1_000);
        if (record === undefined)
            return false;
        await this.client(connection).delete(record.fileId, signal);
        await this.index.remove(scope, version.variantId, record.fileId);
        return true;
    }
    /**
     * Delete the oldest provider files whose names identify harness ownership.
     * @param connection - endpoint and API-key snapshot.
     * @param count - positive maximum number of files to delete.
     * @param signal - request cancellation.
     * @returns number of successfully deleted files.
     */
    async reclaimOldestOwned(connection, count, signal) {
        const client = this.client(connection);
        let after;
        const owned = [];
        while (true) {
            const page = await client.list({
                ...after === undefined ? {} : { after },
                limit: 1_000,
                ...signal === undefined ? {} : { signal },
            });
            for (const file of page.data) {
                if (!file.filename.startsWith(OWNED_FILE_PREFIX))
                    continue;
                owned.push({ id: file.id, createdAt: file.createdAt });
            }
            // The API offers no ascending-order query; retain the oldest candidates across every page.
            owned.sort((left, right) => left.createdAt - right.createdAt);
            owned.splice(count);
            if (!page.hasMore || page.lastId === undefined || page.lastId === after)
                break;
            after = page.lastId;
        }
        for (const file of owned)
            await client.delete(file.id, signal);
        return owned.length;
    }
    /**
     * Delete every remote harness-owned file in the active API-key namespace and clear its index.
     * @param connection - endpoint and API-key snapshot.
     * @param signal - request cancellation.
     * @returns number of deleted files.
     */
    async releaseAll(connection, signal) {
        let total = 0;
        for (;;) {
            const deleted = await this.reclaimOldestOwned(connection, 1_000, signal);
            total += deleted;
            if (deleted < 1_000)
                break;
        }
        await this.index.clear(fileScope(connection));
        return total;
    }
}
