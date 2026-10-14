// Generated from runtime/alpha3/src/core/tavern-prompt-transform-output.mts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { recordSha256, stableJson } from './roleplay-data.js';
/** Pure consumer-data envelope. Execution, validation, freezing and current
 * authorization remain with the caller; the hash grants no permission. */
export function createTavernPromptTransformOutputV1(data, entries, totals, canonicalEntries) {
    const output = { schemaVersion: 1, encoding: 'owned-tavern-prompt-transform-output-v1',
        authority: 'consumer-data-only', inputSha256: data.inputSha256, policySha256: data.policySha256,
        entries, totals: { inputChars: data.inputChars, ...totals } };
    let outputSha256;
    if (canonicalEntries === undefined)
        outputSha256 = recordSha256(output);
    else {
        // Worker owns these encodings in this invocation. Stream the same record
        // bytes without traversing its already encoded projection DATA again.
        // String chunks are complete JSON tokens or adjacent metadata, so a UTF-16
        // surrogate pair is never split across separate UTF-8 conversions.
        const hash = createHash('sha256'), record = output;
        hash.update('{');
        const keys = Object.keys(record).filter(key => record[key] !== undefined).sort();
        for (const [index, key] of keys.entries()) {
            hash.update((index ? ',' : '') + JSON.stringify(key) + ':', 'utf8');
            if (key === 'entries') {
                hash.update('[');
                for (const [entryIndex, encoded] of canonicalEntries.entries()) {
                    if (entryIndex)
                        hash.update(',');
                    if (typeof encoded === 'string')
                        hash.update(encoded, 'utf8');
                    else
                        for (const chunk of encoded) {
                            if (typeof chunk === 'string')
                                hash.update(chunk, 'utf8');
                            else
                                hash.update(chunk);
                        }
                }
                hash.update(']');
            }
            else
                hash.update(stableJson(record[key]), 'utf8');
        }
        outputSha256 = hash.update('}').digest('hex');
    }
    return { kind: 'transformed', output: { ...output, outputSha256 } };
}
