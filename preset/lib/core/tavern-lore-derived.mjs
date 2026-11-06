// Generated from runtime/alpha3/src/core/tavern-lore-derived.mts; edit the TypeScript source.
/** Compose already frozen runtime outputs with the unchanged compiler plan.
 * These addresses identify derived DATA, never an imported book or a lease. */
import { recordSha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { resolveTavernLoreContentTextV1 } from './tavern-lore-compiler.mjs';
import { ST_LORE_ENTRY_DEFAULTS_V1 } from './tavern-lore-fixed-profile.mjs';
import { exact, freezeLoreData, LORE_EVALUATOR_POLICY_V1 } from './tavern-lore-snapshot.mjs';
import { refuse } from './tavern-lore-match.mjs';
import { TAVERN_LORE_ORDINARY_PREPARATION_POLICY_SHA256 } from './tavern-lore-ordinary-preparation.mjs';
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
const ORDINARY_COMPOSITION_POLICY_SHA256 = recordSha256({ derived: TAVERN_LORE_DERIVED_POLICY_SHA256,
    ordinary: TAVERN_LORE_ORDINARY_PREPARATION_POLICY_SHA256 });
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
/** One preparation shares its actual Source eligibility facts between the
 * prepass and evaluator. Derived suppression/admission is a separate gate. */
export function createTavernLoreSourceEligibilityV1(compilation) {
    const facts = new WeakMap();
    return (entry) => {
        const original = tavernLoreOriginalEvaluationEntryV1(entry);
        if (!original)
            return true;
        const known = facts.get(original);
        if (known !== undefined)
            return known;
        const blocking = original.disposition === 'retained-ineligible'
            ? original.diagnosticIndexes.map(index => compilation.diagnostics[index]).filter(row => row.blocking) : [];
        const eligible = original.disposition !== 'retained-ineligible'
            || blocking.length > 0 && blocking.every(row => row.code === 'LORE_VECTORIZED_EVALUATOR_REQUIRED');
        facts.set(original, eligible);
        return eligible;
    };
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
        planSha256: ref.compositionSha256, ref, derivedSnapshot, suppressedOriginalEntryIds: suppressed });
}
/** Sparse formal DATA changes only actual Source entries. Model output and
 * already suppressed originals never acquire author execution authority. */
export function applyTavernLoreOrdinaryPreparationV1(base, preparation) {
    const entries = [...base.entries], preparedSourceEntries = new Map();
    for (const change of preparation.changes) {
        const entry = base.entries[change.ordinal];
        if (isTavernLoreDerivedEntryV1(entry) || 'origin' in entry && entry.origin === 'derived-suppressed-original')
            continue;
        const sourceEntry = tavernLoreOriginalEvaluationEntryV1(entry), sourceSemantic = tavernLoreEvaluationSemanticV1(entry), preprocessed = change.preprocessed, pointer = `/prepared/ordinary-source/${encodeURIComponent(entry.entryId)}/content`, contentSha256 = preprocessed?.body.textSha256 ?? change.program?.contentSha256, semantic = { ...sourceSemantic,
            ...change.admission ? { enabled: change.admission === 'force-enabled' } : {},
            ...contentSha256 ? { content: Object.freeze({ kind: 'ordinary-prepared-source-text', pointer, contentSha256 }) } : {},
            ...preprocessed ? { primaryKeys: Object.freeze(preprocessed.primaryKeys.map(key => key.text)),
                secondaryKeys: Object.freeze(preprocessed.secondaryKeys.map(key => key.text)) } : {} };
        const prepared = Object.freeze({ origin: 'ordinary-prepared-source',
            entryId: entry.entryId, ordinal: entry.ordinal, sourcePointer: entry.sourcePointer, rawEntrySha256: entry.rawEntrySha256,
            sourceEntry, ordinaryChange: change, semantic: Object.freeze(semantic) });
        entries[entry.ordinal] = prepared;
        if (contentSha256)
            preparedSourceEntries.set(pointer, prepared);
    }
    const descriptor = { schemaVersion: 1, encoding: 'owned-st-lore-evaluation-composition-ref-v1',
        compilerPlanSha256: base.sourcePlan.planSha256,
        ...base.derivedSnapshot ? { derivedSnapshotSha256: base.derivedSnapshot.snapshotSha256 } : {},
        ordinaryPreparationSha256: preparation.preparationSha256,
        policySha256: ORDINARY_COMPOSITION_POLICY_SHA256 };
    const ref = Object.freeze({ ...descriptor, compositionSha256: recordSha256(descriptor) });
    return Object.freeze({ ...base, entries: Object.freeze(entries), ordinaryPreparation: preparation, preparedSourceEntries,
        ref, planSha256: ref.compositionSha256 });
}
export function resolveTavernLoreEvaluationContentV1(composition, pointer) {
    const prepared = composition.preparedSourceEntries?.get(pointer);
    if (prepared) {
        const change = prepared.ordinaryChange;
        if (change.preprocessed)
            return { pointer, text: change.preprocessed.body.text,
                contentSha256: prepared.semantic.content.contentSha256, rawEntryPointer: prepared.sourcePointer,
                rawEntrySha256: prepared.rawEntrySha256, origin: 'ordinary-prepared-source' };
        const original = resolveTavernLoreContentTextV1(composition.sourcePlan, tavernLoreEvaluationSemanticV1(prepared.sourceEntry).content.pointer);
        return { ...original, pointer, text: original.text.slice(change.program.bodyOffset),
            contentSha256: prepared.semantic.content.contentSha256, origin: 'ordinary-prepared-source' };
    }
    const entry = composition.derivedEntries?.find(row => row.semantic.content.pointer === pointer);
    if (entry)
        return { pointer, text: entry.content,
            contentSha256: entry.semantic.content.contentSha256, rawEntryPointer: entry.sourcePointer,
            rawEntrySha256: entry.rawEntrySha256, origin: 'frozen-derived-output',
            derivedRef: entry.ref, completionRef: entry.completionRef };
    return resolveTavernLoreContentTextV1(composition.sourcePlan, pointer);
}
