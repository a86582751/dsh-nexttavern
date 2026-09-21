// Generated from runtime/alpha3/compat/session-persistence-jsonl/src/zstd-public-decoder.ts; edit the TypeScript source.
/**
 * Public-API synchronous Zstandard frame decoder fallback.
 * @module dsh-session-persistence-jsonl/zstd-public-decoder
 */
import { zstdDecompressSync } from 'node:zlib';
/** Multi-frame adapter built exclusively from Node's supported one-shot API. */
export class PublicZstdFrameDecoder {
    started = false;
    closed = false;
    /** @inheritdoc */
    *decode(source, frames) {
        if (this.started)
            throw new Error('Zstandard frame decoder was already started');
        if (this.closed)
            throw new Error('cannot start a closed Zstandard frame decoder');
        this.started = true;
        try {
            for (const { start, end } of frames) {
                let decoded;
                try {
                    decoded = zstdDecompressSync(source.subarray(start, end));
                }
                catch (error) {
                    throw new Error(`corrupt Zstandard session log: frame at byte ${start} failed validation`, {
                        cause: error,
                    });
                }
                yield decoded;
            }
        }
        finally {
            this.close();
        }
    }
    /** @inheritdoc */
    close() {
        this.closed = true;
    }
}
