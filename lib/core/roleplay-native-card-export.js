// Generated from runtime/alpha3/src/core/roleplay-native-card-export.ts; edit the TypeScript source.
/** Freeze portable author DATA, never old import/job/Native execution rights. */
import { keyOf, cloneRecord, recordSha256 } from './roleplay-data.js';
import { compileTavernOpeningCandidates } from './tavern-card.js';
import { readStructuredImportDataV1, spanText } from './roleplay-import-record.js';
import { portableNextTavernAuthorFields, isNextTavernCardDocument, nextTavernCardSourceIdV1, NEXTTAVERN_ST_MACRO_FIELDS, isNativeTavernCardDocument, readNativeNextTavernAuthorExtensionV1, readTavernCardArchiveV1, mergeNativeTavernCardExportV1 } from './nexttavern-card.js';
import { materializeTavernLoreEntryFieldsV1 } from './tavern-lore-compiler.mjs';
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const authorFields = (value) => object(value) ? portableNextTavernAuthorFields(value) : {};
/** Current author DATA has one composition owner. Media discovery uses this
 * read without export transport, archive traversal or selected-opening rights. */
export function captureNextTavernAuthorDataV1(deps, id) {
    const { tables: T } = deps, prefix = id + '__', captured = deps.source.capture(id);
    if (captured.kind === 'refused')
        throw Error(captured.diagnostics[0]?.code ?? 'CARD_EXPORT_SOURCE_FAILED');
    if (captured.kind === 'outside-declared-domain'
        && !['ACTIVE_SOURCE_MISSING', 'LEGACY_SOURCE_OUTSIDE_DOMAIN', 'MERGE_PROVENANCE_UNPROVEN'].includes(captured.code))
        throw Error(captured.code);
    const pointer = T.branch.get(keyOf(id, 'import-active'));
    const original = pointer?.importId ? T.branch.get(keyOf(pointer.sourceRecordSessionId ?? id, 'import-' + pointer.importId)) : undefined;
    const decoded = captured.kind === 'captured-data' ? captured.contributionInput.rawDecoded : original?.sourceEnvelope
        ? readStructuredImportDataV1(original).decoded : undefined;
    const native = decoded && isNextTavernCardDocument(decoded.document) ? decoded.document : undefined;
    // Keep open author fields in DATA while runtime text has one canonical home.
    const extra = cloneRecord(decoded?.data ?? {});
    for (const field of ['name', 'description', 'personality', 'scenario', 'mes_example', 'system_prompt',
        'post_history_instructions', 'first_mes', 'alternate_greetings', 'character_book', 'cards', 'worldbook',
        'rules', 'status', 'opening', 'settings'])
        delete extra[field];
    const skip = new Set();
    let book = cloneRecord(decoded?.data.character_book);
    const ruleRow = T.rules.get(keyOf(id, 'spec'));
    const rules = authorFields(ruleRow);
    const editedRuleFields = ruleRow?.editedFrom?.ruleFields ?? [];
    let journalDataSha256;
    if (captured.kind === 'captured-data') {
        const { observed, legacy } = deps.edits.observeJournalDataWithLegacyData(captured, { suppressBookConstants: true });
        if (observed.kind === 'refused')
            throw Error(observed.diagnostics[0]?.detail ?? observed.diagnostics[0]?.code);
        journalDataSha256 = observed.data.dataSha256;
        rules.core = legacy.contributions.coreData.text;
        if (legacy.contributions.coreData.kind === 'legacy-edited-unsplit')
            rules.coreOrigin = 'legacy-edited-unsplit';
        if (!native && decoded && original) {
            // Legacy spans include normalized line separators. Unchanged ST fields
            // retain their physical author bytes in portable DATA; current edits keep
            // their literal text. Explicit core ownership also preserves same-value edits.
            if (legacy.contributions.coreData.kind === 'legacy-projection')
                rules.core = String(decoded.data.scenario ?? '');
            for (const [rule, field, target] of [['style', 'mes_example', 'rule-style'],
                ['narrative', 'system_prompt', 'rule-narrative'], ['reply', 'post_history_instructions', 'rule-reply']]) {
                const spans = original.assignments.filter(assignment => assignment.target === target)
                    .flatMap(assignment => assignment.sourceSpans).sort((left, right) => left.startLine - right.startLine);
                if (!editedRuleFields.includes(rule) && rules[rule] === spanText(original, spans))
                    rules[rule] = String(decoded.data[field] ?? '');
            }
        }
        for (const key of legacy.linkedRowKeys)
            skip.add(key);
        if (observed.data.currentNativeMembership) {
            // Current order/membership comes from the published journal. Original
            // object keys and removed entries remain in the complete inert archive.
            const entries = observed.data.currentNativeMembership.members.map(member => {
                const entry = materializeTavernLoreEntryFieldsV1(member.rawEntry, { displayIndex: member.displayIndex });
                // Helper's numeric UID may project a retained textual native id. The
                // Native document keeps that author metadata; only missing ids use UID.
                if (!Object.hasOwn(entry, 'id'))
                    entry.id = member.uid;
                return entry;
            });
            book = { ...book ?? {}, entries };
        }
        else if (book) {
            const edits = new Map(observed.data.overlay.entries.map(entry => [entry.rawEntryPointer, entry.fields]));
            const source = captured.source.original.primary;
            if (source.binding === 'primary')
                for (const entry of source.entries) {
                    const fields = edits.get(entry.ref.entryPointer);
                    if (fields)
                        book.entries[entry.entryKey] =
                            materializeTavernLoreEntryFieldsV1(entry.value, fields);
                }
        }
    }
    const cardId = native ? nextTavernCardSourceIdV1(native) : undefined;
    const rows = (table, target) => {
        // DATA includes empty bodies, which have no source-span assignment. User
        // cards use their one actual runtime key rather than the generated ordinal.
        const originalRows = native?.data[target === 'card' ? 'cards' : 'worldbook'] ?? [];
        const ranks = new Map(originalRows.map((row, index) => [
            keyOf(id, target === 'card' && row.kind === 'user' ? 'user' : `${cardId}-${target}-${index}`), index
        ]));
        return [...table.entries()].filter(([key, value]) => key.startsWith(prefix) && object(value) && !skip.has(key))
            .sort(([left], [right]) => {
            const a = ranks.get(left), b = ranks.get(right);
            if (a !== undefined && b !== undefined)
                return a - b;
            if (a !== undefined)
                return -1;
            if (b !== undefined)
                return 1;
            return left.localeCompare(right, 'en');
        }).map(([, value]) => authorFields(value));
    };
    const cards = rows(T.cards, 'card'), worldbook = rows(T.worldbook, 'worldbook');
    const authorOpening = T.opening.get(keyOf(id, 'scene')) ?? native?.data.opening;
    const data = { ...extra, name: native ? native.data.name
            : String(cards.find(card => card.kind !== 'user')?.name ?? decoded?.data.name ?? '角色卡'),
        ...!native && decoded ? { compatibility: { ...object(extra.compatibility) ? extra.compatibility : {}, sillytavernMacroFields: Object.fromEntries(NEXTTAVERN_ST_MACRO_FIELDS.filter(field => typeof decoded.data[field] === 'string').map(field => [field, decoded.data[field]])) } } : {},
        cards, worldbook, rules, ...book !== undefined ? { character_book: book } : {},
        ...authorOpening !== undefined ? { opening: authorFields(authorOpening) } : {},
        ...T.status.get(keyOf(id, 'spec')) !== undefined ? { status: authorFields(T.status.get(keyOf(id, 'spec'))) } : {},
        ...T.branch.get(keyOf(id, 'settings')) !== undefined
            ? { settings: authorFields(T.branch.get(keyOf(id, 'settings'))) } : {} };
    // Source and journal already seal author edits. Hash only their small identity
    // tuple; discovery must not stringify another complete embedded card.
    const sourceHash = captured.kind === 'captured-data'
        ? recordSha256([captured.currentIdentitySha256, journalDataSha256]) : undefined;
    return { captured, original, decoded, native, data, sourceHash };
}
export function captureNextTavernCardExportV1(deps, id) {
    const { tables: T } = deps, prefix = id + '__';
    const { captured, original, decoded, native, data: authorData } = captureNextTavernAuthorDataV1(deps, id);
    const transport = original?.sourceEnvelope?.schemaVersion === 2 ? deps.readTransport(original) : decoded?.document;
    const selected = deps.readOpening(captured);
    if (selected.kind === 'blocked')
        throw Error(selected.code);
    const scene = T.opening.get(keyOf(id, 'scene'));
    let catalog = native?.data.opening?.catalog !== undefined
        ? cloneRecord(native.data.opening.catalog)
        : decoded ? compileTavernOpeningCandidates(decoded).map(candidate => ({ label: candidate.label,
            rawText: candidate.rawText, sourcePointer: candidate.sourcePointer })) : undefined;
    let currentTemplate = String(object(scene)
        ? scene.text ?? native?.data.opening?.text ?? '' : native?.data.opening?.text ?? '');
    if (!native && decoded && original && object(scene) && scene.importId === original.importId) {
        const spans = original.assignments.filter(assignment => assignment.target === 'opening')
            .flatMap(assignment => assignment.sourceSpans).sort((left, right) => left.startLine - right.startLine);
        // The unselected scene is an import projection, while the portable template
        // retains author bytes. Selected prose below remains owned by its Native read.
        if (currentTemplate === spanText(original, spans))
            currentTemplate = String(decoded.data.first_mes ?? '');
    }
    // Selected prose has its own current text. Keep the author template available
    // for another player without adding it again on a fresh JSON roundtrip.
    if (native && catalog && selected.kind === 'ready' && selected.text !== currentTemplate
        && !catalog.some(candidate => candidate.rawText === currentTemplate)) {
        catalog = [{ label: '原主开场', rawText: currentTemplate, sourcePointer: '/data/opening/text' }, ...catalog];
    }
    const opening = scene === undefined && selected.kind === 'none' ? undefined : { ...authorFields(scene),
        text: selected.kind === 'ready' ? selected.text : currentTemplate,
        materialization: selected.kind === 'ready' ? 'materialized' : native?.data.opening?.materialization
            ?? (object(scene) ? scene.materialization : undefined) ?? 'template',
        ...(catalog !== undefined ? { catalog } : {}),
        ...(selected.kind === 'ready' ? { selection: { production: selected.source.production,
                authorSelection: cloneRecord(selected.source.selected) } } : {}) };
    const { opening: _authorOpening, status, settings, ...base } = authorData;
    const data = { ...base, ...status !== undefined ? { status } : {},
        ...opening ? { opening } : {}, ...settings !== undefined ? { settings } : {} };
    const archive = cloneRecord(native && transport ? readTavernCardArchiveV1(transport) : native?.archive ?? {});
    const documents = cloneRecord(archive.documents ?? []), classifiedSources = cloneRecord(archive.classifiedSources ?? []);
    const records = new Map(original ? [[original.importId, original]] : []);
    const collectSources = (value) => {
        if (Array.isArray(value)) {
            for (const item of value)
                collectSources(item);
            return;
        }
        if (!object(value))
            return;
        if (typeof value.importId === 'string' && typeof value.normalizedSourceSha256 === 'string') {
            const record = records.get(value.importId) ?? [...T.branch.entries()]
                .find(([key, record]) => key.endsWith('__import-' + value.importId)
                && record?.normalizedSha256 === value.normalizedSourceSha256)?.[1];
            if (!record)
                throw Error('CARD_EXPORT_ARCHIVE_SOURCE_MISSING');
            records.set(record.importId, record);
        }
        for (const item of Object.values(value))
            collectSources(item);
    };
    for (const table of [T.cards, T.worldbook, T.rules, T.status, T.opening])
        for (const [key, value] of table.entries())
            if (key.startsWith(prefix) && object(value))
                collectSources(value.sources);
    for (const record of records.values()) {
        if (record.sourceEnvelope) {
            const document = record === original && transport ? transport : record.sourceEnvelope.schemaVersion === 2
                ? deps.readTransport(record) : readStructuredImportDataV1(record).decoded.document;
            // Historical native sources retain one complete inert document, including
            // open archive metadata. The current native archive remains authoritative;
            // reimporting this single export therefore does not add another wrapper.
            if (record !== original || !isNextTavernCardDocument(document) && !readNativeNextTavernAuthorExtensionV1(document)) {
                documents.push({ document, source: { extension: record.sourceEnvelope.extension,
                        format: record.sourceEnvelope.schemaVersion === 2 && isNativeTavernCardDocument(document)
                            ? document.spec === 'chara_card_v2' ? 'json-v2' : 'json-v3' : record.sourceEnvelope.format,
                        sha256: record.rawSha256 } });
            }
        }
        else
            classifiedSources.push({ normalizer: record.normalizer, rawSource: record.rawSource,
                normalizedSource: record.normalizedSource, assignments: record.assignments.map(assignment => {
                    const { materializedSha256: _materialized, ...portable } = assignment;
                    return portable;
                }) });
    }
    const unique = (values) => [...new Map(values.map(value => [recordSha256(value), value])).values()];
    const result = { ...native ?? {}, spec: 'nexttavern_card', spec_version: '1.0', data,
        archive: { ...archive, ...documents.length || archive.documents !== undefined ? { documents: unique(documents) } : {},
            ...classifiedSources.length || archive.classifiedSources !== undefined ? { classifiedSources: unique(classifiedSources) } : {} } };
    if (isNativeTavernCardDocument(transport)) {
        data.name = String(data.cards.find(card => card.kind !== 'user')?.name ?? transport.data.name);
        return mergeNativeTavernCardExportV1(transport, result);
    }
    return result;
}
