// Generated from runtime/alpha3/src/core/tavern-pricing-data.ts; edit the TypeScript source.
// Shared numeric and feed limits for the pricing subsystem; zero is valid, unknown stays null.
export const rateFields = ['input', 'output', 'cacheRead', 'cacheWrite'];
export const asRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
export const nonNegativeFinite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
/** Content-Length can be absent or wrong; enforce the cap while reading and always release the reader. */
export async function readPricingBytes(response, limit, oversizedMessage) {
    const reader = response.body.getReader();
    const parts = [];
    let size = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > limit)
                throw new Error(oversizedMessage);
            parts.push(Buffer.from(value));
        }
    }
    finally {
        await reader.cancel().catch(() => { });
    }
    return Buffer.concat(parts);
}
