// Generated from runtime/alpha3/src/core/roleplay-tavern-legacy-reading.ts; edit the TypeScript source.
/** Legacy readers keep their MD contract. Imported ST entries are owned by
 * the Native evaluator: a passive query cannot reopen hidden/unselected source,
 * execute another template or turn its importer defaults into activation. */
import { keyOf, recordSha256 } from './roleplay-data.js';
import { captureRoleplayTavernPromptSourceV1 } from './roleplay-tavern-prompt-source.js';
import { ST_LORE_ENTRY_DEFAULTS_V1 } from './tavern-lore-fixed-profile.mjs';
function fail(code) { throw Error(code); }
function table(rows) {
    const values = new Map(rows);
    return { get: (key) => values.get(key), entries: () => values.entries() };
}
/** Absent author metadata stays absent in the strict Native tool summary.
 * Only these top-level optional fields are omitted; values are not normalized. */
function passiveLegacyEntrySummary(input) {
    const summary = { ...input };
    for (const key of ['id', 'name', 'kind', 'aliases', 'keywords', 'priority', 'version', 'locked', 'sourcePointer', 'rowKey']) {
        if (summary[key] === undefined)
            delete summary[key];
    }
    return summary;
}
/** Only immutable compilation/provenance DATA is needed for one target.
 * No passive-reader filtering or another live capture belongs in this lookup. */
function classifyCapturedWriteTarget(captured, sessionId, id) {
    const entries = captured.compilation.plan.entries;
    const compiled = entries.filter(entry => entry.entryId === id);
    if (compiled.length > 1)
        fail('LEGACY_WRITE_SOURCE_ENTRY_UNPROVEN');
    let managed = compiled[0];
    if (!managed) {
        const linked = captured.contributions.overlays.filter(row => row.kind === 'exact-current-row-data'
            && row.row.ref.key === keyOf(sessionId, id));
        if (linked.length > 1)
            fail('LEGACY_WRITE_SOURCE_ENTRY_UNPROVEN');
        const row = linked[0];
        if (row?.kind === 'exact-current-row-data') {
            const matches = entries.filter(entry => entry.sourcePointer === row.rawEntry.entryPointer
                && entry.rawEntrySha256 === row.rawEntry.entrySha256);
            if (matches.length !== 1)
                fail('LEGACY_WRITE_SOURCE_ENTRY_UNPROVEN');
            managed = matches[0];
        }
    }
    return managed ? Object.freeze({ kind: 'source-managed-data', entryId: managed.entryId, sourcePointer: managed.sourcePointer })
        : Object.freeze({ kind: 'legacy-write-data' });
}
/** Writers classify the whole imported book, including disabled/constant rows.
 * Do not reuse the passive reader: authoring supplemental EJS remains permitted. */
export function classifyRoleplayTavernLegacyWriteTargetV1(deps, sessionId, id, assertOwnerCurrent) {
    const captured = captureRoleplayTavernPromptSourceV1(deps, sessionId, false, assertOwnerCurrent);
    if (captured.kind === 'outside-declared-domain') {
        if (!['ACTIVE_SOURCE_MISSING', 'LEGACY_SOURCE_OUTSIDE_DOMAIN'].includes(captured.reason))
            fail(captured.reason);
        assertOwnerCurrent();
        return Object.freeze({ kind: 'legacy-write-data' });
    }
    const target = classifyCapturedWriteTarget(captured, sessionId, id);
    captured.assertCurrent();
    return target;
}
/** Bulk preflight already owns the actual Source FIFO and performs no awaits or
 * writes while classifying. Capture once, retain target-order short circuit,
 * and verify before the first write; the caller's own puts invalidate this DATA. */
export function classifyRoleplayTavernLegacyWriteTargetsV1(deps, sessionId, ids, assertOwnerCurrent) {
    if (ids.length === 0)
        return Object.freeze({ kind: 'legacy-write-data' });
    const captured = captureRoleplayTavernPromptSourceV1(deps, sessionId, false, assertOwnerCurrent);
    if (captured.kind === 'outside-declared-domain') {
        if (!['ACTIVE_SOURCE_MISSING', 'LEGACY_SOURCE_OUTSIDE_DOMAIN'].includes(captured.reason))
            fail(captured.reason);
        assertOwnerCurrent();
        return Object.freeze({ kind: 'legacy-write-data' });
    }
    let target = Object.freeze({ kind: 'legacy-write-data' });
    for (const id of ids) {
        target = classifyCapturedWriteTarget(captured, sessionId, id);
        if (target.kind === 'source-managed-data')
            break;
    }
    captured.assertCurrent();
    return target;
}
export function captureRoleplayTavernLegacyReadV1(deps, sessionId, assertOwnerCurrent) {
    const captured = captureRoleplayTavernPromptSourceV1(deps, sessionId, false, assertOwnerCurrent);
    if (captured.kind === 'outside-declared-domain') {
        if (['ACTIVE_SOURCE_MISSING', 'LEGACY_SOURCE_OUTSIDE_DOMAIN'].includes(captured.reason))
            return null;
        fail(`LEGACY_READ_${captured.reason}`);
    }
    const linked = new Set(captured.contributions.overlays.flatMap(row => row.kind === 'exact-current-row-data' ? [row.row.ref.key] : []));
    const rows = [];
    for (const [key, value] of deps.tables.worldbook.entries()) {
        if (!key.startsWith(`${sessionId}__`) || !value || linked.has(key))
            continue;
        if (typeof value.content === 'string' && value.content.includes('<%'))
            fail('LEGACY_READ_TEMPLATE_REQUIRES_NATIVE_MATERIAL');
        rows.push([key, structuredClone(value)]);
    }
    // Imported author instructions only enter the admitted Native story material.
    // Background tasks use their frozen story and their own declared task inputs.
    const tables = { cards: table([]), rules: table([]), worldbook: table(rows) };
    const { source, currentIdentitySha256, edits, compilation } = captured;
    // Audit snapshots retain complete Native counters. Dependency currency uses
    // the Source owner's admitted identity and the published edit/overlay inputs,
    // so a normal completion cannot retire its own background task.
    const body = { schemaVersion: 2, encoding: 'native-owned-legacy-source-read-policy-v2', sessionId,
        currentIdentitySha256,
        edits: { identitySha256: edits.identitySha256, revision: edits.revision, headRef: edits.headRef,
            journalSha256: edits.journalSha256, ...(edits.inheritance ? { inheritance: edits.inheritance } : {}) },
        compiler: compilation.plan.compiler, currentNativeOverlaySha256: compilation.plan.currentNativeOverlaySha256,
        policy: 'native-ST-entries-and-author-fields-excluded-from-passive-and-background-readers',
        supplementalWorldbookSha256: recordSha256(rows) };
    const sourceProjectionSha256 = recordSha256(body);
    const entries = compilation.plan.entries.map(entry => {
        const semantic = { ...ST_LORE_ENTRY_DEFAULTS_V1, ...entry.semanticOverrides };
        const raw = source.original.primary.entries.find(row => row.ref.entryPointer === entry.sourcePointer);
        if (!raw)
            fail('LEGACY_READ_SOURCE_ENTRY_UNPROVEN');
        return passiveLegacyEntrySummary({ id: entry.entryId, name: String(raw.value.name ?? raw.value.comment ?? entry.entryId),
            keywords: semantic.primaryKeys, enabled: semantic.enabled, alwaysOn: semantic.constant,
            priority: semantic.order, version: entry.entryPlanSha256,
            sourcePointer: entry.sourcePointer, nativeManaged: true });
    });
    for (const [key, value] of rows)
        entries.push(passiveLegacyEntrySummary({ id: value.id, name: value.name, kind: value.kind, aliases: value.aliases,
            keywords: value.keywords, enabled: value.enabled !== false, priority: value.priority, alwaysOn: value.alwaysOn === true,
            locked: value.locked === true, version: value.version, rowKey: key, nativeManaged: false }));
    captured.assertCurrent();
    return { tables, entries, sourceProjectionSha256, evidence: body, assertCurrent: captured.assertCurrent };
}
