import {estimateTokens,sha256} from './roleplay-data.js'
import type {TavernLoreTokenCountProducerV1} from './tavern-lore-evaluator-types.mjs'

const estimate=estimateTokens
/** This identity explicitly describes an estimate, never a provider tokenizer.
 * Pin the real function captured here rather than inventing a package version. */
export const TAVERN_LORE_ESTIMATE_IDENTITY_V1=Object.freeze({
  identity:'nexttavern-lore-estimated-utf16-div2_5-v1',
  method:'estimated-utf16-div2_5-v1' as const,
  implementationSha256:sha256(Function.prototype.toString.call(estimate)),
})

export function createRoleplayTavernTokenCountV1(assertCurrent:()=>void,signal:AbortSignal)
  :TavernLoreTokenCountProducerV1 {
  return Object.freeze({...TAVERN_LORE_ESTIMATE_IDENTITY_V1,signal,assertCurrent,
    count(text:string) {
      signal.throwIfAborted()
      // The evaluator checks currentness before counting and after its await.
      // Primitive text estimation only needs cancellation at this inner call.
      return estimate(text)
    }})
}
