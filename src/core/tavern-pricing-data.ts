// Shared numeric and feed limits for the pricing subsystem; zero is valid, unknown stays null.
export const rateFields = ['input', 'output', 'cacheRead', 'cacheWrite'] as const;
export type RateField = typeof rateFields[number];
export type RecordLike = Record<string, unknown>;
export type RateValues = Record<RateField, number | null>;
export type Table = {
  get(key: string): unknown;
  put(key: string, value: unknown): unknown | Promise<unknown>;
};
export type Fetcher = typeof fetch;
export const asRecord = (value: unknown): RecordLike | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordLike : null;
export const nonNegativeFinite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Content-Length can be absent or wrong; enforce the cap while reading and always release the reader. */
export async function readPricingBytes(response: Response, limit: number, oversizedMessage: string): Promise<Buffer> {
  const reader = response.body!.getReader();
  const parts: Buffer[] = [];
  let size = 0;
  try {
    for (; ;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error(oversizedMessage);
      parts.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => { });
  }
  return Buffer.concat(parts);
}
