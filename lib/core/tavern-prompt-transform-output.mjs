// Generated from runtime/alpha3/src/core/tavern-prompt-transform-output.mts; edit the TypeScript source.
import { recordSha256 } from './roleplay-data.js';
/** Pure consumer-data envelope. Execution, validation, freezing and current
 * authorization remain with the caller; the hash grants no permission. */
export function createTavernPromptTransformOutputV1(data, entries, totals) {
    const output = { schemaVersion: 1, encoding: 'owned-tavern-prompt-transform-output-v1',
        authority: 'consumer-data-only', inputSha256: data.inputSha256, policySha256: data.policySha256,
        entries, totals: { inputChars: data.inputChars, ...totals } };
    return { kind: 'transformed', output: { ...output, outputSha256: recordSha256(output) } };
}
