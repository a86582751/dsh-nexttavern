/** The captured derived domain pairs rendering and evaluation. The shared
 * content helper consumes these operations without discovering their owner. */
import {composeTavernLoreEvaluationV1} from './tavern-lore-derived.mjs'
import type {TavernLoreDerivedSnapshotV1} from './tavern-lore-derived.mjs'
import type {TavernLorePlanV1} from './tavern-lore-plan-types.mjs'
import {prepareRoleplayTavernRenderCatalogV1} from './roleplay-tavern-prompt-render.js'
import {prepareOwnedTavernLoreWithOwnerV1} from './tavern-lore-evaluator.mjs'
import type {TavernContentExecutionV1} from './roleplay-tavern-content.js'

export function createRoleplayTavernDerivedContentExecutionV1(plan:TavernLorePlanV1,
  captured:{readonly snapshot:TavernLoreDerivedSnapshotV1}):TavernContentExecutionV1 {
  const composition=composeTavernLoreEvaluationV1(plan,captured.snapshot)
  // The caller's original assertCurrent covers its captured domain and is
  // passed through both operations. Pairing adds no second currency reader.
  return {
    render(input) {
      return prepareRoleplayTavernRenderCatalogV1({...input,evaluationComposition:composition})
    },
    evaluate(input,owner) {
      return prepareOwnedTavernLoreWithOwnerV1({...input,derivedSnapshot:captured.snapshot},owner,composition)
    },
  }
}
