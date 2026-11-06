// Generated from runtime/alpha3/src/core/tavern-lore-ordinary-preparation.mts; edit the TypeScript source.
/** Actual Source template preparation DATA. This packet belongs to one render
 * audit and never supplies an author, numerical or Ruby-completion authority. */
import { recordSha256 } from './roleplay-data.js';
import { freezeLoreData, LORE_EVALUATOR_POLICY_V1 } from './tavern-lore-snapshot.mjs';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { refuse } from './tavern-lore-match.mjs';
export const TAVERN_LORE_ORDINARY_PREPARATION_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'owned-st-lore-ordinary-source-policy-v1', order: 'actual-source-reverse-before-selection',
    programs: 'actual-source-clean-body-and-private-async-IIFE',
    preprocessing: 'one-content-then-each-own-primary-and-secondary-key-serial',
    sourceRegex: 'getwi-captured-cut; preprocessing-actual-staged-cut; no-generate-loader-source-pass',
    force: 'own-eligible-source-enable; native-budget-timed-groups-retained',
    exclusion: 'condition-and-dont-activate-win; disabled-activation-refused',
    provenance: 'same-material-render-audit-indices; no-derived-completion-authority' });
export const TAVERN_LORE_ORDINARY_PREPARATION_POLICY_SHA256 = recordSha256(TAVERN_LORE_ORDINARY_PREPARATION_POLICY_V1);
/** Only the actual prepass calls this after collecting its real output refs.
 * Consumers reuse the packet; they do not rehash its unchanged Source book. */
export function sealTavernLoreOrdinaryPreparationV1(body) {
    return freezeLoreData({ ...body, preparationSha256: recordSha256(body) });
}
/** The untyped replay boundary owns this one bounded packet parse. Hot
 * composition receives the renderer's frozen result directly. */
export function validateTavernLoreOrdinaryPreparationV1(input, plan) {
    const packet = cloneRoleplayTavernLoreDataV1(input, LORE_EVALUATOR_POLICY_V1.bounds.snapshotBytes, { nodes: 100000, depth: 48 });
    if (!packet || packet.schemaVersion !== 1 || packet.encoding !== 'owned-st-lore-ordinary-preparation-v1'
        || packet.compilerPlanSha256 !== plan.planSha256 || packet.sourceSnapshotSha256 !== plan.source.sourceSnapshotSha256
        || typeof packet.phaseId !== 'string' || typeof packet.snapshotSha256 !== 'string'
        || !Array.isArray(packet.changes) || !Array.isArray(packet.activationProposals))
        refuse('LORE_ORDINARY_PREPARATION_INVALID');
    const { preparationSha256, ...body } = packet;
    if (recordSha256(body) !== preparationSha256)
        refuse('LORE_ORDINARY_PREPARATION_HASH');
    for (const change of packet.changes)
        if (plan.entries[change.ordinal]?.entryId !== change.entryId)
            refuse('LORE_ORDINARY_SOURCE_CHANGED', change.entryId);
    return freezeLoreData(packet);
}
