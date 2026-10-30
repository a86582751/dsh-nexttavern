// Generated from runtime/alpha3/compat/attachment-local/src/encoding.ts; edit the TypeScript source.
/** Shared quality ladder and lazy candidate execution for normalization and request-image encoders. */
/** Shared ladder for both encoders: spaced so each step buys a real size reduction. */
export const IMAGE_ENCODING_QUALITIES = [85, 75, 60];
/** Fixed lossy-WebP effort; deeper search costs 3-4x encode time for about 5% size. */
export const WEBP_ENCODING_EFFORT = 0;
async function encode(pipeline, mediaType, quality) {
    const encoded = mediaType === 'image/webp'
        ? pipeline.webp({ quality, effort: WEBP_ENCODING_EFFORT })
        : pipeline.jpeg({ quality });
    const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data), mediaType, width: info.width, height: info.height };
}
/**
 * Build the lazy quality ladder for one prepared pipeline: WebP keeps a source
 * alpha channel, everything else is JPEG.
 * @param prepared - sized sRGB pipeline; cloned per candidate.
 * @param hasAlpha - decoded source alpha fact selecting the codec.
 * @returns encoders ordered from highest to lowest ladder quality.
 */
export function encodingLadder(prepared, hasAlpha) {
    const mediaType = hasAlpha ? 'image/webp' : 'image/jpeg';
    return IMAGE_ENCODING_QUALITIES.map(quality => (() => encode(prepared.clone(), mediaType, quality)));
}
/**
 * Execute encoding candidates in preference order and stop after the first fitting output.
 * @param attempts - lazy encoders ordered from preferred to fallback representation.
 * @param maxBytes - positive encoded-byte target.
 * @returns the first fitting candidate, otherwise the smallest completed fallback.
 */
export async function encodeFirstWithinLimit(attempts, maxBytes) {
    const [first, ...remaining] = attempts;
    if (first === undefined)
        throw new Error('image encoding requires at least one candidate');
    let smallest = await first();
    if (smallest.data.byteLength <= maxBytes)
        return smallest;
    for (const attempt of remaining) {
        const candidate = await attempt();
        if (candidate.data.byteLength <= maxBytes)
            return candidate;
        if (candidate.data.byteLength < smallest.data.byteLength) {
            smallest = candidate;
        }
    }
    return { smallest };
}
/**
 * Whether a lazy encoding result exhausted every candidate at one size.
 * @param result - first fitting candidate or exhausted result.
 * @returns whether every candidate exceeded the byte target.
 */
export function isExhaustedEncoding(result) {
    return 'smallest' in result;
}
