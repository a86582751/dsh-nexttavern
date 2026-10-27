// Generated from runtime/alpha3/compat/attachment-local/src/request-image.ts; edit the TypeScript source.
/** Deterministic cached image versions for model requests. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AttachmentError, ImageVariantId } from '@deepseek-ai/dsh-attachment';
import { IMAGE_ENCODING_QUALITIES, WEBP_ENCODING_EFFORT, encodeFirstWithinLimit, encodingLadder, isExhaustedEncoding, } from './encoding.js';
import { detectImage, encodedAlphaIsCompatible, probeImage } from './image.js';
import { requireSharp } from './sharp.js';
/** Transform version included in every cache and upload-index identity. */
export const REQUEST_IMAGE_TRANSFORM_VERSION = 'request-image-v6';
function digest(value) {
    return createHash('sha256').update(value).digest('hex');
}
function checkedInteger(value, name) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new AttachmentError(`${name} must be a positive integer.`, 'INVALID_ATTACHMENT_REF');
    }
    return value;
}
function validateTarget(target) {
    checkedInteger(target.width, 'Image request width');
    checkedInteger(target.height, 'Image request height');
    checkedInteger(target.maxBytes, 'Image request maxBytes');
}
function descriptor(attachment, target) {
    return JSON.stringify({
        transformVersion: REQUEST_IMAGE_TRANSFORM_VERSION,
        attachmentId: attachment.attachmentId,
        targetWidth: target.width,
        targetHeight: target.height,
        encodedByteBudget: target.maxBytes,
        encoding: {
            webpQualities: IMAGE_ENCODING_QUALITIES,
            webpEffort: WEBP_ENCODING_EFFORT,
            jpegQualities: IMAGE_ENCODING_QUALITIES,
            order: ['alpha:webp', 'opaque:jpeg'],
            colourspace: 'srgb',
        },
    });
}
/**
 * Complete deterministic identity for one attachment and route-chosen request target.
 * @param attachment - provider-independent durable normalized attachment reference.
 * @param target - route-chosen dimensions and byte target.
 * @returns branded digest over every request transform input.
 */
export function requestImageVariantId(attachment, target) {
    return ImageVariantId(`sha256:${digest(descriptor(attachment, target))}`);
}
/** Resize by the source long edge only, so the encoder derives the short edge as the route predicts. */
function pipeline(attachment, target) {
    const byWidth = attachment.ref.width >= attachment.ref.height;
    return sourcePipeline(attachment)
        .resize({ ...byWidth ? { width: target.width } : { height: target.height }, withoutEnlargement: true });
}
function sourcePipeline(attachment) {
    const sharp = requireSharp();
    return sharp(attachment.data, { failOn: 'error', limitInputPixels: false }).toColourspace('srgb');
}
async function createRequestImage(attachment, target, hasAlpha) {
    if (target.width >= attachment.ref.width
        && target.height >= attachment.ref.height
        && attachment.data.byteLength <= target.maxBytes) {
        return {
            data: attachment.data,
            mediaType: attachment.ref.mediaType,
            width: attachment.ref.width,
            height: attachment.ref.height,
        };
    }
    const encodedVersion = await encodeFirstWithinLimit(encodingLadder(pipeline(attachment, target), hasAlpha), target.maxBytes);
    return isExhaustedEncoding(encodedVersion) ? encodedVersion.smallest : encodedVersion;
}
function cachePath(root, hash) {
    return join(root, 'request-images', hash.slice(0, 2), hash);
}
async function readCached(path, target, expectedAlpha, signal) {
    try {
        const data = new Uint8Array(await readFile(path, { signal }));
        const detected = await probeImage(data);
        if (detected.depth !== 'uchar' || detected.space !== 'srgb'
            || detected.width > target.width || detected.height > target.height
            || !encodedAlphaIsCompatible(expectedAlpha, detected))
            return undefined;
        return { data, mediaType: detected.mediaType, width: detected.width, height: detected.height, hasAlpha: detected.hasAlpha };
    }
    catch (error) {
        if (error?.code === 'ENOENT')
            return undefined;
        signal?.throwIfAborted();
        return undefined;
    }
}
async function verifyRequestImage(image, expectedAlpha) {
    const detected = await detectImage(image.data);
    if (detected.depth !== 'uchar' || detected.space !== 'srgb'
        || detected.width !== image.width || detected.height !== image.height
        || detected.mediaType !== image.mediaType || !encodedAlphaIsCompatible(expectedAlpha, detected)) {
        throw new AttachmentError('Encoded model-request image does not match its verified 8-bit sRGB metadata.', 'ATTACHMENT_WRITE_FAILED');
    }
    return { ...image, hasAlpha: detected.hasAlpha };
}
async function writeCached(path, data) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporary, data, { mode: 0o600, flag: 'wx' });
        await rename(temporary, path);
    }
    finally {
        await rm(temporary, { force: true });
    }
}
/**
 * Generate or reuse one request image below the local attachment cache root.
 * @param root - absolute attachment cache root; variants use its `request-images` child.
 * @param attachment - verified normalized attachment bytes and reference.
 * @param target - exact route-chosen dimensions and byte target; a target above the source keeps the source size.
 * @param signal - optional cancellation for cache I/O and image transformation.
 * @returns verified request bytes and deterministic variant identity.
 */
export async function readRequestImageFile(root, attachment, target, signal) {
    signal?.throwIfAborted();
    validateTarget(target);
    const source = await probeImage(attachment.data);
    const variantId = requestImageVariantId(attachment.ref, target);
    const hash = String(variantId).slice('sha256:'.length);
    const path = cachePath(root, hash);
    const cached = await readCached(path, target, source.hasAlpha, signal);
    const created = cached ?? await createRequestImage(attachment, target, source.hasAlpha);
    const version = cached ?? (created.data === attachment.data
        ? { ...created, hasAlpha: source.hasAlpha }
        : await verifyRequestImage(created, source.hasAlpha));
    signal?.throwIfAborted();
    if (cached === undefined && version.data !== attachment.data)
        await writeCached(path, version.data);
    return {
        variantId,
        attachment: attachment.ref,
        data: version.data,
        mediaType: version.mediaType,
        bytes: version.data.byteLength,
        width: version.width,
        height: version.height,
        depth: 'uchar',
        space: 'srgb',
        hasAlpha: version.hasAlpha,
    };
}
