// Generated from runtime/alpha3/src/core/roleplay-tavern-current-overlay.ts; edit the TypeScript source.
/** The same proven legacy field differences feed prompt compilation and the
 * structured editor. These detached origins explain data, never write rights. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { projectStructuredImport, spanText } from './roleplay-import-record.js';
import { resolveLegacyContributionDataV1 } from './roleplay-tavern-lore-contributions.js';
function fail(code) { throw Error(code); }
const same = (left, right) => recordSha256(left) === recordSha256(right);
export function produceRoleplayTavernCurrentLegacyOverlayV1(input) {
    const contributions = resolveLegacyContributionDataV1({ ...input, suppressRawEntryPointers: [], suppressAlwaysOnRowKeys: [] });
    if (contributions.kind !== 'proven-consumer-data')
        fail(contributions.code);
    const projection = projectStructuredImport(input.activeImport, input.rawDecoded), entries = [], linkedRowKeys = [];
    for (const legacy of contributions.overlays) {
        if (legacy.kind !== 'exact-current-row-data')
            continue;
        linkedRowKeys.push(legacy.row.ref.key);
        const row = legacy.row.value, projected = projection.worldbook[legacy.rawEntry.entryOrdinal];
        if (!projected || row.id !== projected.id)
            fail('INPUT_MATERIAL_ENTRY_BASELINE_UNPROVEN');
        const pieces = input.activeImport.assignments.filter(item => item.target === 'worldbook' && item.id === projected.id), fields = {};
        const originalText = spanText(input.activeImport, pieces.flatMap(item => item.sourceSpans));
        if (row.content !== originalText) {
            if (typeof row.content !== 'string')
                fail('INPUT_MATERIAL_CURRENT_CONTENT_INVALID');
            fields.content = row.content;
        }
        // Importer defaults are only baselines. An actual field change overrides
        // ST semantics; unchanged importer defaults must not enable a hidden row.
        if (typeof row.enabled === 'boolean' && row.enabled !== projected.enabled)
            fields.enabled = row.enabled;
        if (typeof row.alwaysOn === 'boolean' && row.alwaysOn !== false)
            fields.constant = row.alwaysOn;
        if (Array.isArray(row.keywords) && !same(row.keywords, projected.keys))
            fields.primaryKeys = row.keywords;
        const baselineOrder = Math.max(0, ...pieces.map(item => Number(item.priority) || 0));
        if (typeof row.priority === 'number' && row.priority !== baselineOrder)
            fields.order = row.priority;
        if (!Object.keys(fields).length)
            continue;
        const ref = cloneRoleplayTavernLoreDataV1({ schemaVersion: 1,
            encoding: 'tavern-lore-legacy-current-field-origin-v1', row: legacy.row.ref,
            baseline: { importRecordRef: input.importRecordRef, textSha256: sha256(originalText), projectedSha256: recordSha256(projected) },
            fieldsSha256: recordSha256(fields) }, 65_536, { nodes: 4096, depth: 16 });
        const origin = { kind: 'current-row', ref, refSha256: recordSha256(ref) };
        entries.push({ rawEntryPointer: legacy.rawEntry.entryPointer, rawEntrySha256: legacy.rawEntry.entrySha256, origin, fields });
    }
    const overlay = { schemaVersion: 1,
        encoding: 'st-character-book-current-native-overlay-v1', entries };
    return { contributions, overlay, linkedRowKeys };
}
/** Explicit append-only fields override the same pointer's legacy differences.
 * Preserve the original composite origin encoding and whole-field precedence. */
export function composeRoleplayTavernCurrentOverlayV1(base, journal) {
    const effective = new Map(base.entries.map(entry => [entry.rawEntryPointer, entry]));
    for (const entry of journal.entries) {
        const legacy = effective.get(entry.rawEntryPointer);
        if (!legacy) {
            effective.set(entry.rawEntryPointer, entry);
            continue;
        }
        if (legacy.rawEntrySha256 !== entry.rawEntrySha256)
            fail('INPUT_MATERIAL_OVERLAY_PREIMAGE_CHANGED');
        const ref = cloneRoleplayTavernLoreDataV1({ schemaVersion: 1, encoding: 'tavern-lore-combined-current-field-origin-v1',
            legacy: legacy.origin, journal: entry.origin,
            precedence: 'legacy-field-difference-then-explicit-append-only-field' }, 65_536, { nodes: 4096, depth: 16 });
        effective.set(entry.rawEntryPointer, { ...entry, fields: { ...legacy.fields, ...entry.fields },
            origin: { kind: 'append-only-lore-overlay', ref, refSha256: recordSha256(ref) } });
    }
    return { schemaVersion: 1, encoding: 'st-character-book-current-native-overlay-v1', entries: [...effective.values()] };
}
