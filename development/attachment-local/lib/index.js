// Generated from runtime/alpha3/compat/attachment-local/src/index.ts; edit the TypeScript source.
/** Local durable attachment backend rooted below `DSH_HOME`. @module @deepseek-ai/dsh-attachment-local */
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { dshCachePath, resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { CompressionLimiter, compressionFailure } from './compression-limiter.js';
import { commitPreparedImageFile, normalizedImagePath, prepareImageFile, readImageFile, validateImageFile } from './store.js';
import { readFileStreamVerbatim, saveFileStreamVerbatim, saveFileVerbatim, storedFilePath, } from './file-store.js';
import { readRequestImageFile, requestImageVariantId } from './request-image.js';
export { canPassThroughNormalization, normalizeImage } from './normalization.js';
export { commitPreparedImageFile, prepareImageFile, readImageFile, saveImageFile, validateImageFile } from './store.js';
export { readRequestImageFile, requestImageVariantId } from './request-image.js';
/** Default maximum encoded bytes for one submitted image; oversized sources are refused, not shrunk. */
export const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Default maximum images in one prompt. */
export const DEFAULT_MAX_IMAGES_PER_MESSAGE = 20;
/** Default maximum aggregate image bytes in one prompt. */
export const DEFAULT_MAX_MESSAGE_IMAGE_BYTES = 200 * 1024 * 1024;
/** Default maximum intrinsic pixels for one submitted image. */
export const DEFAULT_MAX_IMAGE_PIXELS = 64_000_000;
/** Default per-side pixel cap for one submitted image. */
export const DEFAULT_MAX_IMAGE_DIMENSION = 8192;
/**
 * Default total-pixel budget of the stored normalized image. A larger source
 * is admitted and downscaled proportionally, so admission bounds what rides
 * every later model request without refusing ordinary large sources; extreme
 * aspect ratios keep their short-edge resolution instead of collapsing under
 * a long-edge rule.
 */
export const DEFAULT_NORMALIZED_IMAGE_MAX_PIXELS = 2048 * 2048;
/** Default long-edge cap of the stored normalized image, applied after the total-pixel budget. */
export const DEFAULT_NORMALIZED_IMAGE_MAX_DIMENSION = 8192;
/** Default encoded-byte target for one stored normalized image. */
export const DEFAULT_NORMALIZED_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
/** Conservative default number of simultaneous native image transformations per store. */
export const DEFAULT_IMAGE_COMPRESSION_CONCURRENCY = 2;
/** Maximum configurable native image transformations per store. */
export const MAX_IMAGE_COMPRESSION_CONCURRENCY = 8;
function abortReason(signal) {
    const reason = signal.reason;
    return reason instanceof Error
        ? reason
        : new Error('Attachment request cancelled with a non-Error reason.', { cause: reason });
}
class SharedRequest {
    controller = new AbortController();
    promise;
    settled = false;
    waiters = 0;
    constructor(start) {
        this.promise = start(this.controller.signal).finally(() => {
            this.settled = true;
        });
    }
    wait(signal) {
        signal?.throwIfAborted();
        this.waiters += 1;
        if (signal === undefined) {
            return this.promise.finally(() => {
                this.release(false);
            });
        }
        let released = false;
        const release = (cancelled) => {
            if (released)
                return;
            released = true;
            this.release(cancelled, signal);
        };
        return new Promise((resolve, reject) => {
            const abort = () => {
                release(true);
                reject(abortReason(signal));
            };
            signal.addEventListener('abort', abort, { once: true });
            void this.promise.then((value) => {
                signal.removeEventListener('abort', abort);
                release(false);
                resolve(value);
            }, (error) => {
                signal.removeEventListener('abort', abort);
                release(false);
                reject(compressionFailure(error));
            });
        });
    }
    release(cancelled, signal) {
        this.waiters -= 1;
        if (cancelled && this.waiters === 0 && !this.settled && signal !== undefined) {
            this.controller.abort(abortReason(signal));
        }
    }
}
/** Persistent content-addressed local attachment store. */
export class LocalAttachmentStore extends AttachmentStore {
    static Config = z.object({
        dshHome: z.string(),
        maxImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_IMAGE_BYTES),
        maxImagesPerMessage: z.number().step(1).min(1).default(DEFAULT_MAX_IMAGES_PER_MESSAGE),
        maxMessageImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_MESSAGE_IMAGE_BYTES),
        maxImagePixels: z.number().step(1).min(1).default(DEFAULT_MAX_IMAGE_PIXELS),
        maxImageDimension: z.number().step(1).min(1).default(DEFAULT_MAX_IMAGE_DIMENSION),
        normalizedImageMaxPixels: z.number().step(1).min(1).default(DEFAULT_NORMALIZED_IMAGE_MAX_PIXELS),
        normalizedImageMaxDimension: z.number().step(1).min(1).default(DEFAULT_NORMALIZED_IMAGE_MAX_DIMENSION),
        normalizedImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_NORMALIZED_IMAGE_MAX_BYTES),
        imageCompressionConcurrency: z.number().step(1).min(1).max(MAX_IMAGE_COMPRESSION_CONCURRENCY)
            .default(DEFAULT_IMAGE_COMPRESSION_CONCURRENCY),
    });
    /** Absolute versioned storage root. */
    root;
    imageLimits;
    /** Resolved provider-independent normalization policy. */
    normalizationPolicy;
    /** Resolved instance-level compression limit. */
    imageCompressionConcurrency;
    cacheRoot;
    compression;
    requestInflight = new Map();
    constructor(ctx, config) {
        super(ctx);
        const dshHome = resolveDshHome(config.dshHome);
        this.root = join(dshHome, 'attachments', 'v1');
        this.cacheRoot = dshCachePath({ dshHome }, 'attachments');
        this.imageLimits = Object.freeze({
            maxImageBytes: config.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES,
            maxImagesPerMessage: config.maxImagesPerMessage ?? DEFAULT_MAX_IMAGES_PER_MESSAGE,
            maxMessageImageBytes: config.maxMessageImageBytes ?? DEFAULT_MAX_MESSAGE_IMAGE_BYTES,
            maxImagePixels: config.maxImagePixels ?? DEFAULT_MAX_IMAGE_PIXELS,
            maxImageDimension: config.maxImageDimension ?? DEFAULT_MAX_IMAGE_DIMENSION,
            mediaTypes: Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
        });
        this.normalizationPolicy = Object.freeze({
            maxPixels: config.normalizedImageMaxPixels ?? DEFAULT_NORMALIZED_IMAGE_MAX_PIXELS,
            maxDimension: config.normalizedImageMaxDimension ?? DEFAULT_NORMALIZED_IMAGE_MAX_DIMENSION,
            maxBytes: config.normalizedImageMaxBytes ?? DEFAULT_NORMALIZED_IMAGE_MAX_BYTES,
        });
        const compressionConcurrency = config.imageCompressionConcurrency ?? DEFAULT_IMAGE_COMPRESSION_CONCURRENCY;
        if (!Number.isSafeInteger(compressionConcurrency)
            || compressionConcurrency < 1
            || compressionConcurrency > MAX_IMAGE_COMPRESSION_CONCURRENCY) {
            throw new Error(`attachment-local: imageCompressionConcurrency must be an integer from 1 through ${MAX_IMAGE_COMPRESSION_CONCURRENCY}`);
        }
        this.imageCompressionConcurrency = compressionConcurrency;
        this.compression = new CompressionLimiter(compressionConcurrency);
    }
    async validateImage(input) {
        await this.compression.run(() => validateImageFile(input, this.imageLimits, this.normalizationPolicy));
    }
    async saveImages(inputs) {
        this.validateImageBatch(inputs);
        const prepared = await Promise.all(inputs.map(input => this.compression.run(() => prepareImageFile(input, this.imageLimits, this.normalizationPolicy))));
        const refs = [];
        for (const image of prepared)
            refs.push(await commitPreparedImageFile(this.root, image));
        return refs;
    }
    async saveImage(input) {
        const prepared = await this.compression.run(() => prepareImageFile(input, this.imageLimits, this.normalizationPolicy));
        return commitPreparedImageFile(this.root, prepared);
    }
    async readImage(ref, signal) {
        return readImageFile(this.root, ref, signal);
    }
    imageHostPath(ref) {
        return normalizedImagePath(this.root, ref);
    }
    async saveFile(input) {
        return saveFileVerbatim(this.root, input);
    }
    async saveFileStream(input) {
        return saveFileStreamVerbatim(this.root, input);
    }
    readFileStream(ref, signal) {
        return readFileStreamVerbatim(this.root, ref, signal);
    }
    fileHostPath(ref) {
        return storedFilePath(this.root, ref);
    }
    async readImageRequest(ref, target, signal) {
        return this.requestVersion(ref, target, undefined, signal);
    }
    requestVersion(ref, target, stored, signal) {
        signal?.throwIfAborted();
        const variantId = requestImageVariantId(ref, target);
        const key = String(variantId);
        let operation = this.requestInflight.get(key);
        if (operation?.controller.signal.aborted) {
            this.requestInflight.delete(key);
            operation = undefined;
        }
        if (operation === undefined) {
            const shared = new SharedRequest(sharedSignal => this.compression.run(async () => {
                const request = await readRequestImageFile(this.cacheRoot, stored ?? await this.readImage(ref, sharedSignal), target, sharedSignal);
                return request;
            }));
            operation = shared;
            this.requestInflight.set(key, shared);
            void shared.promise.finally(() => {
                if (this.requestInflight.get(key) === shared)
                    this.requestInflight.delete(key);
            }).catch(() => { });
        }
        return operation.wait(signal);
    }
}
export default LocalAttachmentStore;
