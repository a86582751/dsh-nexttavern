// Generated from runtime/alpha3/compat/attachment-local/src/sharp.ts; edit the TypeScript source.
/** Process-realm lazy access to Sharp's CommonJS-compatible entry. */
import { createLazyRequire } from '@deepseek-ai/dsh-lazy-require';
/** Load Sharp on the first raster operation and retain its callable export. */
export const requireSharp = createLazyRequire('sharp', import.meta.url);
