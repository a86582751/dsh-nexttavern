// Generated from runtime/alpha3/src/core/roleplay-tavern-derived-content-execution.ts; edit the TypeScript source.
/** The captured derived domain pairs rendering and evaluation. The shared
 * content helper consumes these operations without discovering their owner. */
import { composeTavernLoreEvaluationV1 } from './tavern-lore-derived.mjs';
import { prepareRoleplayTavernRenderCatalogV1 } from './roleplay-tavern-prompt-render.js';
import { prepareOwnedTavernLoreWithOwnerV1 } from './tavern-lore-evaluator.mjs';
export function createRoleplayTavernDerivedContentExecutionV1(plan, captured) {
    const composition = composeTavernLoreEvaluationV1(plan, captured.snapshot);
    // The caller's original assertCurrent covers its captured domain and is
    // passed through both operations. Pairing adds no second currency reader.
    return {
        render(input) {
            return prepareRoleplayTavernRenderCatalogV1({ ...input, evaluationComposition: composition });
        },
        evaluate(input, owner) {
            return prepareOwnedTavernLoreWithOwnerV1({ ...input, derivedSnapshot: captured.snapshot }, owner, composition);
        },
    };
}
