// Generated from runtime/alpha3/compat/attachment-local/src/normalization.ts; edit the TypeScript source.
/** Deterministic provider-independent image normalization. */
import { AttachmentError, requestImageDimensions } from '@deepseek-ai/dsh-attachment';
import { encodeFirstWithinLimit, encodingLadder, isExhaustedEncoding } from './encoding.js';
import { detectImage, encodedAlphaIsCompatible } from './image.js';
import { requireSharp } from './sharp.js';
/**
 * Whether bytes already satisfy the normalization requirements.
 * @param detected - fully decoded source facts.
 * @param bytes - encoded source length.
 * @param policy - resolved normalization limits.
 * @returns whether the source can pass through byte-identically.
 */
export function canPassThroughNormalization(detected, bytes, policy) {
    return detected.mediaType !== 'image/gif'
        && !detected.animated
        && !detected.carriesMetadata
        && detected.depth === 'uchar'
        && detected.space === 'srgb'
        && bytes <= policy.maxBytes
        && detected.width * detected.height <= policy.maxPixels
        && Math.max(detected.width, detected.height) <= policy.maxDimension;
}
/** Assert that a normalized output is an 8-bit sRGB/sRGBA single-frame image with matching facts. */
async function verifyNormalizedImage(image, expectedAlpha) {
    const detected = await detectImage(image.data);
    if (detected.mediaType !== image.mediaType
        || detected.width !== image.width
        || detected.height !== image.height
        || detected.animated
        || detected.carriesMetadata
        || detected.depth !== 'uchar'
        || detected.space !== 'srgb'
        || !encodedAlphaIsCompatible(expectedAlpha, detected)) {
        throw new AttachmentError('Image normalization did not produce a single-frame 8-bit sRGB image with matching metadata.', 'ATTACHMENT_WRITE_FAILED');
    }
    return image;
}
/** Build one fixed-size, oriented, metadata-free sRGB pipeline from submitted bytes. */
function preparedPipeline(sharp, data, width, height) {
    return sharp(data, { failOn: 'error', limitInputPixels: false })
        .rotate()
        .toColourspace('srgb')
        .resize({ width, height, fit: 'inside', withoutEnlargement: true });
}
/** Dimensions under the total-pixel budget, then the long-edge cap, without changing aspect ratio. */
function initialDimensions(detected, policy) {
    const budgeted = requestImageDimensions(detected.width, detected.height, policy.maxPixels);
    const longEdge = Math.max(budgeted.width, budgeted.height);
    if (longEdge <= policy.maxDimension)
        return budgeted;
    const scale = policy.maxDimension / longEdge;
    return {
        width: Math.max(1, Math.floor(budgeted.width * scale)),
        height: Math.max(1, Math.floor(budgeted.height * scale)),
    };
}
/**
 * Produce the persisted provider-independent normalized version of one fully decoded source.
 * The source is passed through only when it is already clean, single-frame, 8-bit sRGB/sRGBA,
 * and inside every normalization limit. Re-encoding never removes transparency. When every
 * ladder quality exceeds the byte target, the smallest ladder output is kept; provider byte
 * caps stay enforced at the route that transmits the bytes.
 * @param data - complete admitted source bytes.
 * @param detected - fully decoded source facts.
 * @param policy - resolved independent normalization limits.
 * @returns verified provider-independent normalized bytes and metadata.
 */
export async function normalizeImage(data, detected, policy) {
    if (canPassThroughNormalization(detected, data.byteLength, policy)) {
        return { data, mediaType: detected.mediaType, width: detected.width, height: detected.height };
    }
    const sharp = requireSharp();
    try {
        const { width, height } = initialDimensions(detected, policy);
        const encoded = await encodeFirstWithinLimit(encodingLadder(preparedPipeline(sharp, data, width, height), detected.hasAlpha), policy.maxBytes);
        const chosen = isExhaustedEncoding(encoded) ? encoded.smallest : encoded;
        return await verifyNormalizedImage(chosen, detected.mediaType === 'image/gif' ? undefined : detected.hasAlpha);
    }
    catch (error) {
        if (error instanceof AttachmentError)
            throw error;
        const source = detected.mediaType === 'image/png' && detected.depth !== 'uchar'
            ? `${detected.depth === 'ushort' ? '16-bit' : detected.depth} PNG`
            : `${detected.depth} ${detected.mediaType.slice('image/'.length).toUpperCase()}`;
        throw new AttachmentError(`The ${source} could not be converted to the normalized 8-bit sRGB form.`, 'ATTACHMENT_WRITE_FAILED', { cause: error });
    }
}
