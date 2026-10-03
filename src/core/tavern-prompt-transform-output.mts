import {recordSha256} from './roleplay-data.js'
import type {TavernPromptProjectionV1,TavernPromptTransformOutputV1,
  TavernPromptTransformResultV1,TavernPromptTransformWorkerInputV1} from './tavern-prompt-transform-types.mjs'

/** Pure consumer-data envelope. Execution, validation, freezing and current
 * authorization remain with the caller; the hash grants no permission. */
export function createTavernPromptTransformOutputV1(
  data:Pick<TavernPromptTransformWorkerInputV1,'inputSha256'|'policySha256'|'inputChars'>,
  entries:readonly TavernPromptProjectionV1[],
  totals:Omit<TavernPromptTransformOutputV1['totals'],'inputChars'>,
):Extract<TavernPromptTransformResultV1,{kind:'transformed'}> {
  const output={schemaVersion:1 as const,encoding:'owned-tavern-prompt-transform-output-v1' as const,
    authority:'consumer-data-only' as const,inputSha256:data.inputSha256,policySha256:data.policySha256,
    entries,totals:{inputChars:data.inputChars,...totals}}
  return {kind:'transformed',output:{...output,outputSha256:recordSha256(output)}}
}
