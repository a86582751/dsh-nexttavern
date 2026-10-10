// Generated from runtime/alpha3/src/core/roleplay-tavern-lore-export.ts; edit the TypeScript source.
/** Current authoring DATA for Markdown export. Source/journal owners establish
 * bindings once; this projection never executes macros/EJS or mutates rows. */
import { recordSha256 } from './roleplay-data.js';
import { stableJson } from './card-export-projection.js';
export function captureRoleplayTavernLoreExportDataV1(deps, sessionId) {
    const captured = deps.source.capture(sessionId);
    if (captured.kind === 'outside-declared-domain') {
        // The legacy semantic export still consumes actual current author rows.
        // An unprojectable merge supplies no single-book overlay; it is not a
        // corrupt Source and must not disable that existing export workflow.
        return ['ACTIVE_SOURCE_MISSING', 'LEGACY_SOURCE_OUTSIDE_DOMAIN', 'MERGE_PROVENANCE_UNPROVEN'].includes(captured.code)
            ? { kind: 'none' } : { kind: 'blocked', code: captured.code };
    }
    if (captured.kind === 'refused')
        return { kind: 'blocked', code: captured.diagnostics[0]?.code ?? 'SOURCE_READ_FAILED' };
    const { observed, legacy } = deps.edits.observeSourceDataWithLegacyData(captured);
    if (observed.kind === 'refused')
        return { kind: 'blocked', code: observed.diagnostics[0]?.code ?? 'STORAGE_READ_FAILED' };
    // A successful observation and its legacy bindings are one supplier result.
    const bindings = legacy, source = captured.source, { data, editor } = observed;
    const provenance = { schemaVersion: 1, encoding: 'tavern-lore-current-export-source-v1', sessionId,
        sourceRecordSessionId: source.sourceRecordSessionId, importId: source.original.activePointer.importId,
        rawSha256: source.original.rawSha256, normalizedSha256: source.original.normalizedSha256,
        sourceSha256: source.sourceSha256, importRecordRef: source.original.importRecordRef,
        activePointerRef: source.original.activePointerRef, revision: editor.revision, dataSha256: data.dataSha256,
        headRef: data.headRef, journalSha256: data.journalSha256, journalRefs: data.journalRefs,
        ...(data.inheritance ? { inheritance: data.inheritance } : {}),
        ...(source.inheritance ? { sourceInheritance: source.inheritance } : {}) };
    const materials = editor.entries.flatMap(entry => {
        const entrySource = { ...provenance, rawEntryPointer: entry.rawEntryPointer, rawEntrySha256: entry.rawEntrySha256,
            ...(entry.currentNativeMember ? { currentNativeMember: entry.currentNativeMember } : {}) }, { content: _contentReference, ...fields } = entry.semantic;
        return [{ label: `当前结构化世界书正文: ${entry.entryId}`, text: entry.contentText, source: entrySource },
            { label: `当前结构化世界书字段与来源: ${entry.entryId}`,
                text: '```json\n' + stableJson({ role: 'current-structured-lore', entryId: entry.entryId, disposition: entry.disposition,
                    fields, fieldSources: entry.fieldSources, diagnosticCodes: entry.diagnosticCodes }) + '\n```', source: entrySource }];
    });
    const skipRulesCore = bindings.contributions.coreData.kind === 'legacy-projection'
        && bindings.contributions.overlays.some(entry => entry.kind === 'constant-current-overlay-missing');
    if (skipRulesCore) {
        // Import projected constant entries into one core text. The proven legacy
        // resolver has already matched that complete text to its source fragments.
        // Preserve it as original evidence rather than inventing current split text.
        materials.push({ label: '原件核心映射（含原卡常驻条目；原件来源，不作为当前条目）',
            // Export organization materializes source text, so the original/current
            // distinction must travel in that text rather than only its review label.
            text: '> 原件核心映射（含原卡常驻条目；原件来源，不作为当前条目）\n\n'
                + bindings.contributions.residualCore, source: { ...provenance,
                role: 'original-import-core-projection', rulesRow: bindings.contributions.rulesRow,
                fragments: bindings.contributions.orderedBefore, coreSha256: bindings.contributions.beforeCoreSha256 } });
    }
    if (source.original.primary.binding === 'proven-absence')
        materials.push({
            label: '结构化原件世界书缺席证明', text: '```json\n' + stableJson({ binding: 'proven-absence',
                bookPointer: source.original.primary.bookPointer, absenceProofSha256: source.original.primary.absenceProof.absenceProofSha256,
                documentSha256: source.original.documentSha256, importRecordRef: source.original.importRecordRef }) + '\n```',
            source: provenance
        });
    const skipWorldbookKeys = bindings.linkedRowKeys, currentLoreSha256 = recordSha256({ sourceSha256: source.sourceSha256, dataSha256: data.dataSha256,
        editor, skipWorldbookKeys, skipRulesCore });
    return { kind: 'ready', sessionId, sourceSha256: source.sourceSha256, currentLoreSha256,
        materials, skipWorldbookKeys, skipRulesCore };
}
