// Generated from runtime/alpha3/src/core/tavern-lore-derived.mts; edit the TypeScript source.
/** Compose already frozen runtime outputs with the unchanged compiler plan.
 * These addresses identify derived DATA, never an imported book or a lease. */
import { recordSha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { resolveTavernLoreContentTextV1 } from './tavern-lore-compiler.mjs';
import { ST_LORE_ENTRY_DEFAULTS_V1 } from './tavern-lore-fixed-profile.mjs';
import { exact, freezeLoreData, LORE_EVALUATOR_POLICY_V1 } from './tavern-lore-snapshot.mjs';
import { refuse } from './tavern-lore-match.mjs';
export const TAVERN_LORE_DERIVED_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'owned-st-lore-derived-composition-policy-v1',
    compilation: 'original-source-compiler-and-initial-catalog-unchanged',
    evaluation: 'one-combined-semantic-sort-recursion-and-cumulative-budget',
    content: 'frozen-output-literal; no-author-macro-template-or-decorator-effects',
    authorCatalog: 'original-only; derived-output-does-not-obtain-getwi-program-authority',
    finalTransform: 'existing-world-info-scoped-prompt-regex-after-budget',
    ties: 'original-source-ordinal-then-derived-configuration-ordinal',
    originalSuppression: 'accepted-output-lookup-key; first-raw-ordinal-only; evaluation-enabled-false',
    seed: 'composition-hash-when-derived-present; original-domain-when-empty',
    layout: 'existing-position-slots-and-native-anchors' });
export const TAVERN_LORE_DERIVED_POLICY_SHA256 = recordSha256(TAVERN_LORE_DERIVED_POLICY_V1);
/** The publishing/capture owner calls this once after obtaining real refs. */
export function sealTavernLoreDerivedSnapshotV1(body) {
    return freezeLoreData({ ...body, snapshotSha256: recordSha256(body) });
}
/** Only the untyped replay boundary parses again. The owned preparation path
 * consumes its owner's frozen packet directly. Existing evaluator bounds apply. */
export function validateTavernLoreDerivedSnapshotV1(input) {
    const value = cloneRoleplayTavernLoreDataV1(input, LORE_EVALUATOR_POLICY_V1.bounds.snapshotBytes, { nodes: 100000, depth: 48 });
    exact(value, ['schemaVersion', 'encoding', 'ownerId', 'entries', 'snapshotSha256',
        ...Object.hasOwn(value, 'suppressOriginalLookupKeys') ? ['suppressOriginalLookupKeys'] : []]);
    if (value.schemaVersion !== 1 || value.encoding !== 'owned-st-lore-derived-snapshot-v1'
        || typeof value.ownerId !== 'string' || !Array.isArray(value.entries))
        refuse('LORE_DERIVED_SNAPSHOT_INVALID');
    const { snapshotSha256, ...body } = value;
    if (recordSha256(body) !== snapshotSha256)
        refuse('LORE_DERIVED_SNAPSHOT_HASH');
    return freezeLoreData(value);
}
export function isTavernLoreDerivedEntryV1(entry) {
    return 'origin' in entry && entry.origin === 'frozen-derived-output';
}
export function tavernLoreEvaluationSemanticV1(entry) {
    return 'semantic' in entry ? entry.semantic
        : { ...ST_LORE_ENTRY_DEFAULTS_V1, displayIndex: entry.ordinal, ...entry.semanticOverrides };
}
export function tavernLoreOriginalEvaluationEntryV1(entry) {
    return isTavernLoreDerivedEntryV1(entry) ? undefined : 'sourceEntry' in entry ? entry.sourceEntry : entry;
}
export function composeTavernLoreEvaluationV1(sourcePlan, derivedSnapshot) {
    if (!derivedSnapshot?.entries.length)
        return Object.freeze({ sourcePlan, entries: sourcePlan.entries, planSha256: sourcePlan.planSha256 });
    const descriptor = { schemaVersion: 1, encoding: 'owned-st-lore-evaluation-composition-ref-v1',
        compilerPlanSha256: sourcePlan.planSha256, derivedSnapshotSha256: derivedSnapshot.snapshotSha256,
        policySha256: TAVERN_LORE_DERIVED_POLICY_SHA256 };
    const ref = Object.freeze({ ...descriptor, compositionSha256: recordSha256(descriptor) });
    const suppressed = new Set();
    for (const key of derivedSnapshot.suppressOriginalLookupKeys ?? []) {
        const target = key.trim();
        if (!target)
            continue;
        // The fixed compiler projects the real imported/current worldbook keys.
        // Raw source ordinals choose one entry even when several share a key.
        const entry = sourcePlan.entries.find(row => row.semanticOverrides.primaryKeys?.some(raw => raw.trim() === target || raw.includes(',') && raw.split(',').some(part => part.trim() === target)));
        if (entry)
            suppressed.add(entry.entryId);
    }
    const originalEntries = sourcePlan.entries.map((entry) => suppressed.has(entry.entryId)
        ? Object.freeze({ origin: 'derived-suppressed-original', entryId: entry.entryId, ordinal: entry.ordinal,
            sourcePointer: entry.sourcePointer, rawEntrySha256: entry.rawEntrySha256, sourceEntry: entry,
            semantic: Object.freeze({ ...tavernLoreEvaluationSemanticV1(entry), enabled: false }) }) : entry);
    const derivedEntries = Object.freeze(derivedSnapshot.entries.map((entry) => {
        const ordinal = sourcePlan.entries.length + entry.ordinal, sourcePointer = `derived:${encodeURIComponent(entry.ref.ownerId)}:${encodeURIComponent(entry.ref.key)}`;
        return Object.freeze({ origin: 'frozen-derived-output', entryId: entry.entryId, ordinal, sourcePointer,
            rawEntrySha256: entry.ref.sha256, ref: entry.ref, completionRef: entry.completionRef, content: entry.content,
            semantic: Object.freeze({ ...entry.semantic, displayIndex: ordinal, content: Object.freeze({ kind: 'frozen-derived-text',
                    pointer: sourcePointer + '/content', contentSha256: entry.contentSha256,
                    ref: entry.ref, completionRef: entry.completionRef }) }) });
    }));
    return Object.freeze({ sourcePlan, entries: Object.freeze([...originalEntries, ...derivedEntries]), derivedEntries,
        planSha256: ref.compositionSha256, ref, derivedSnapshot });
}
export function resolveTavernLoreEvaluationContentV1(composition, pointer) {
    const entry = composition.derivedEntries?.find(row => row.semantic.content.pointer === pointer);
    if (entry)
        return { pointer, text: entry.content,
            contentSha256: entry.semantic.content.contentSha256, rawEntryPointer: entry.sourcePointer,
            rawEntrySha256: entry.rawEntrySha256, origin: 'frozen-derived-output',
            derivedRef: entry.ref, completionRef: entry.completionRef };
    return resolveTavernLoreContentTextV1(composition.sourcePlan, pointer);
}
