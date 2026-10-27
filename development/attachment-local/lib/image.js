// Generated from runtime/alpha3/compat/attachment-local/src/image.ts; edit the TypeScript source.
/** Raster inspection: full decode at admission, header-only probe on verified reads. */
import { AttachmentError } from '@deepseek-ai/dsh-attachment';
import { requireSharp } from './sharp.js';
/**
 * Check alpha metadata for bytes produced by this package's encoders.
 * Sharp/libvips may omit an all-opaque alpha plane from WebP output; every
 * other addition or removal indicates that the encoded result is incompatible
 * with its source facts.
 * @param sourceHasAlpha - whether the source bytes declare an alpha plane, or undefined when the source frame is unspecified.
 * @param output - decoded media type and alpha metadata from the encoded result.
 * @returns whether the output alpha metadata is compatible with the source.
 */
export function encodedAlphaIsCompatible(sourceHasAlpha, output) {
    return sourceHasAlpha === undefined
        || output.hasAlpha === sourceHasAlpha
        || (sourceHasAlpha && !output.hasAlpha && output.mediaType === 'image/webp');
}
const MEDIA_TYPES = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
};
function carriesRetainedMetadata(metadata) {
    return metadata.exif !== undefined
        || metadata.xmp !== undefined
        || metadata.iptc !== undefined
        || metadata.icc !== undefined
        || metadata.hasProfile
        || metadata.tifftagPhotoshop !== undefined
        || metadata.comments !== undefined
        || metadata.orientation !== undefined;
}
async function imageMetadata(image) {
    const metadata = await image.metadata();
    const mediaType = MEDIA_TYPES[metadata.format];
    if (mediaType === undefined) {
        throw new AttachmentError('Unsupported or malformed image data.', 'INVALID_IMAGE');
    }
    // EXIF orientations 5-8 transpose the stored raster; report the perceived
    // axes so limits, source facts, and coordinate advice all share them.
    const transposed = metadata.orientation !== undefined && metadata.orientation >= 5;
    return {
        mediaType,
        width: transposed ? metadata.height : metadata.width,
        height: transposed ? metadata.width : metadata.height,
        animated: (metadata.pages ?? 1) > 1,
        carriesMetadata: carriesRetainedMetadata(metadata),
        depth: metadata.depth,
        space: metadata.space,
        hasAlpha: metadata.hasAlpha,
    };
}
/**
 * Parse a supported raster's header and return its intrinsic metadata without
 * decoding pixels. Digest-verified reads use this: admission already proved
 * that these exact bytes decode completely, so the read path only re-derives
 * the reference fields instead of paying the full-raster decode again.
 * @param data - complete encoded image bytes.
 * @returns verified format and dimensions.
 */
export async function probeImage(data) {
    const sharp = requireSharp();
    try {
        return await imageMetadata(sharp(data, { failOn: 'error', limitInputPixels: false }));
    }
    catch (error) {
        if (error instanceof AttachmentError)
            throw error;
        throw new AttachmentError('Unsupported or malformed image data.', 'INVALID_IMAGE', { cause: error });
    }
}
/**
 * Fully decode a supported raster and return its intrinsic metadata.
 * @param data - complete encoded image bytes.
 * @param limits - intrinsic-dimension admission limits.
 * @returns verified format and dimensions.
 */
export async function detectImage(data, limits) {
    const sharp = requireSharp();
    try {
        const image = sharp(data, { failOn: 'error', limitInputPixels: false });
        const detected = await imageMetadata(image);
        if (limits?.maxPixels !== undefined && detected.width * detected.height > limits.maxPixels) {
            throw new AttachmentError('Image exceeds the configured decoded-pixel limit.', 'IMAGE_TOO_MANY_PIXELS');
        }
        if (limits?.maxDimension !== undefined && Math.max(detected.width, detected.height) > limits.maxDimension) {
            throw new AttachmentError('Image exceeds the configured per-side pixel limit.', 'IMAGE_DIMENSION_TOO_LARGE');
        }
        await image.raw().toBuffer();
        return detected;
    }
    catch (error) {
        if (error instanceof AttachmentError)
            throw error;
        throw new AttachmentError('Unsupported or malformed image data.', 'INVALID_IMAGE', { cause: error });
    }
}
