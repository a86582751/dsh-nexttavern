// Generated from runtime/alpha3/src/core/roleplay-tavern-lore-contributions.ts; edit the TypeScript source.
/** Unapplied pure consumer-data resolver. These descriptors prove only their
 * own consistency; Root must still obtain actual rows/pointer and Native owner.
 * No table reads/writes, activation, evaluator, cache or capability lives here. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { assertImportRecordIntegrity, assertAssignmentBudget, assertReferenceBudget, assertReviewProof, importCoverage, normalizeSourceSpans, projectStructuredImport, sourceDescriptor, spanText, validateAssignmentIdentities, hasIndependentAuthorCoreV1, readStructuredImportDataV1 } from './roleplay-import-record.js';
export const LEGACY_CONTRIBUTION_DATA_BOUNDS = Object.freeze({ bytes: 16_777_216, nodes: 131_072, depth: 66 });
class Unproven extends Error {
    code;
    pointer;
    constructor(code, pointer) {
        super(code);
        this.code = code;
        this.pointer = pointer;
    }
}
function fail(code, pointer) { throw new Unproven(code, pointer); }
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = (left, right) => recordSha256(left) === recordSha256(right);
const pointerPart = (key) => key.replace(/~/g, '~0').replace(/\//g, '~1');
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
function rowMatches(row, table, key) {
    return object(row) && object(row.ref) && object(row.value) && row.ref.table === table && row.ref.key === key
        && row.ref.exists === true && hash(row.ref.sha256) && row.ref.sha256 === recordSha256(row.value);
}
function sortedAssignments(record) {
    return record.assignments.map((assignment, ordinal) => ({ assignment, ordinal, descriptor: sourceDescriptor(record, assignment) }))
        .sort((left, right) => {
        const first = left.assignment.sourceSpans[0], second = right.assignment.sourceSpans[0];
        if (!first || !second)
            fail('ASSIGNMENT_SPANS_NONCANONICAL', '/activeImport/assignments');
        return first.startLine - second.startLine || Number(left.assignment.order) - Number(right.assignment.order);
    });
}
function fragmentsFor(record, assignments) {
    return assignments.flatMap((item, partIndex) => item.assignment.sourceSpans.map((span, fragmentOrdinal) => {
        const text = spanText(record, [span]);
        return { assignmentOrdinal: item.ordinal, fragmentOrdinal, span, partIndex,
            sourceDescriptorSha256: recordSha256(item.descriptor), textSha256: sha256(text), text };
    })).sort((left, right) => left.span.startLine - right.span.startLine || left.span.endLine - right.span.endLine
        || left.partIndex - right.partIndex || left.fragmentOrdinal - right.fragmentOrdinal);
}
const fragmentData = ({ text: _text, ...fragment }) => ({
    assignmentOrdinal: fragment.assignmentOrdinal, fragmentOrdinal: fragment.fragmentOrdinal, span: fragment.span,
    sourceDescriptorSha256: fragment.sourceDescriptorSha256, textSha256: fragment.textSha256,
});
function validateSource(input) {
    const record = input.activeImport;
    if (!object(record) || record.status !== 'active' || !['replace', undefined].includes(record.mode)
        || !['tavern-fields-v1', 'tavern-fields-v2', 'nexttavern-fields-v1'].includes(record.normalizer)) {
        if (record?.mode === 'merge')
            fail('MERGE_UNPROVEN', '/activeImport/mode');
        fail('IMPORT_RECORD_INVALID', '/activeImport');
    }
    if (input.normalizer !== record.normalizer)
        fail('NORMALIZER_CHANGED', '/normalizer');
    if (record.sessionId !== input.sourceRecordSessionId || input.importRecordRef.table !== 'branch'
        || input.importRecordRef.key !== `${input.sourceRecordSessionId}__import-${record.importId}`
        || input.importRecordRef.exists !== true || input.importRecordRef.sha256 !== recordSha256(record)) {
        fail('IMPORT_RECORD_REF_CHANGED', '/importRecordRef');
    }
    try {
        assertImportRecordIntegrity(record);
    }
    catch {
        fail('IMPORT_RECORD_INVALID', '/activeImport');
    }
    if (!record.sourceEnvelope || !record.activation || !hash(record.rawSha256)) {
        fail('IMPORT_RECORD_INVALID', '/activeImport/activation');
    }
    const ruleWrites = Array.isArray(record.activation.writeDigests)
        ? record.activation.writeDigests.filter(item => item.tableName === 'rules'
            && item.key === `${input.sourceRecordSessionId}__spec`) : [];
    if (ruleWrites.length !== 1 || !hash(ruleWrites[0]?.sha256)) {
        fail('IMPORT_RECORD_INVALID', '/activeImport/activation/writeDigests');
    }
    const pointer = input.activePointer, pointerRef = input.activePointerRef;
    if (pointerRef.table !== 'branch' || pointerRef.key !== `${input.sessionId}__import-active`
        || pointerRef.exists !== true || pointerRef.sha256 !== recordSha256(pointer)
        || pointer.importId !== record.importId || pointer.normalizedSha256 !== record.normalizedSha256
        || pointer.transactionId !== record.activation.transactionId
        || (pointer.sourceRecordSessionId ?? input.sessionId) !== input.sourceRecordSessionId) {
        fail('ACTIVE_POINTER_REF_CHANGED', '/activePointerRef');
    }
    try {
        assertAssignmentBudget(record.assignments);
        assertReferenceBudget(record, record.assignments);
        validateAssignmentIdentities(record.assignments);
        if (!record.assignmentProof)
            assertReviewProof(record);
    }
    catch {
        fail('IMPORT_RECORD_INVALID', '/activeImport/assignments');
    }
    for (const [ordinal, assignment] of record.assignments.entries()) {
        let normalized;
        try {
            normalized = normalizeSourceSpans(assignment.sourceSpans, record.lineCount);
        }
        catch {
            fail('ASSIGNMENT_SPANS_NONCANONICAL', `/activeImport/assignments/${ordinal}/sourceSpans`);
        }
        if (!same(normalized, assignment.sourceSpans)) {
            fail('ASSIGNMENT_SPANS_NONCANONICAL', `/activeImport/assignments/${ordinal}/sourceSpans`);
        }
        const digest = sha256(spanText(record, normalized));
        if (assignment.sourceSha256 !== digest || assignment.materializedSha256 !== digest) {
            fail('ASSIGNMENT_HASH_CHANGED', `/activeImport/assignments/${ordinal}`);
        }
    }
    const coverage = importCoverage(record);
    if (coverage.coverage !== 1 || coverage.uncovered.length || coverage.overlaps.length
        || pointer.coverageSha256 !== recordSha256(coverage)
        || record.coverage === undefined || !same(record.coverage, coverage))
        fail('COVERAGE_UNPROVEN', '/activeImport/coverage');
    const decoded = readStructuredImportDataV1(record).decoded;
    if (!same(input.rawDecoded, decoded))
        fail('RAW_DECODED_CHANGED', '/rawDecoded');
    // Use this fresh decoder result: the bounded data clone detaches aliases, but the
    // original projector uses document.data === data to distinguish its root.
    return decoded;
}
function entryBindings(input, decoded, projection) {
    const native = decoded.format === 'json-nexttavern-v1';
    const record = input.activeImport;
    const book = decoded.data.character_book;
    if (!Object.hasOwn(decoded.data, 'character_book')) {
        if (projection.worldbook.length)
            fail('RAW_ENTRY_PROJECTION_UNPROVEN', '/rawDecoded/data/character_book');
        return [];
    }
    if (!object(book))
        fail('RAW_ENTRY_PROJECTION_UNPROVEN', '/rawDecoded/data/character_book');
    const entries = book.entries ?? [];
    if (!object(entries) && !Array.isArray(entries))
        fail('RAW_ENTRY_PROJECTION_UNPROVEN', '/rawDecoded/data/character_book/entries');
    const root = decoded.document.data === decoded.data ? '/data' : '', bookPointer = `${root}/character_book`;
    // Replay the same legacy projector on an inert prefix view. Only the entry
    // list is absent from data; the original document/card id/archive stays exact.
    // Count structural assignments, never locate entry content by text search.
    const prefixDecoded = { ...decoded, data: { ...decoded.data, character_book: { ...book, entries: [] } } };
    const prefix = projectStructuredImport(record, prefixDecoded);
    // Schema 6 omits the transport archive from its execution projection. Old
    // native/schema 4 spans retain their final full-document/archive assignment.
    const trailingArchive = native ? record.schemaVersion !== 6 : record.normalizer === 'tavern-fields-v1';
    let projectionOrdinal = prefix.assignments.length - (trailingArchive ? 1 : 0);
    const bindings = [];
    for (const [entryOrdinal, [entryKey, raw]] of Object.entries(entries).entries()) {
        const projected = projection.worldbook[entryOrdinal];
        if (!object(raw) || typeof raw.content !== 'string' || !projected || projected.sourceIndex !== entryOrdinal) {
            fail('RAW_ENTRY_PROJECTION_UNPROVEN', `${bookPointer}/entries/${pointerPart(entryKey)}`);
        }
        let span = null;
        if (raw.content !== '') {
            const assignment = projection.assignments[projectionOrdinal++];
            const first = assignment?.sourceSpans[0];
            if (!assignment || assignment.sourceSpans.length !== 1 || !first
                || assignment.target !== (native ? 'archive-only' : projected.constant && projected.enabled ? 'core-setting' : 'worldbook')
                || (native || !projected.constant || !projected.enabled) && assignment.id !== projected.id) {
                fail('RAW_ENTRY_PROJECTION_UNPROVEN', `${bookPointer}/entries/${pointerPart(entryKey)}`);
            }
            span = first;
        }
        bindings.push({ projectedId: projected.id, constant: projected.constant, enabled: projected.enabled, span,
            ref: { sessionId: input.sessionId, sourceRecordSessionId: input.sourceRecordSessionId, importId: record.importId,
                activePointerSha256: input.activePointerRef.sha256, importRecordSha256: input.importRecordRef.sha256,
                rawSha256: record.rawSha256, normalizedSha256: record.normalizedSha256, coverageSha256: input.activePointer.coverageSha256,
                transactionId: record.activation.transactionId, normalizer: input.normalizer, bookPointer, bookSha256: recordSha256(book),
                entryPointer: `${bookPointer}/entries/${pointerPart(entryKey)}`, entryOrdinal, entrySha256: recordSha256(raw) } });
    }
    const expectedEnd = projection.assignments.length - (trailingArchive ? 1 : 0);
    if (projectionOrdinal !== expectedEnd)
        fail('RAW_ENTRY_PROJECTION_UNPROVEN', bookPointer);
    return bindings;
}
const overlaps = (left, right) => left.startLine <= right.endLine && right.startLine <= left.endLine;
function suppressedEntry(record, binding, fragments) {
    const span = binding.span;
    if (!binding.constant || !binding.enabled || !span)
        fail('SUPPRESSION_TARGET_UNPROVEN', binding.ref.entryPointer);
    const relevant = fragments.filter(fragment => overlaps(fragment.span, span));
    let next = span.startLine;
    for (const fragment of relevant) {
        const start = Math.max(fragment.span.startLine, span.startLine), end = Math.min(fragment.span.endLine, span.endLine);
        if (start !== next)
            fail('SUPPRESSION_TARGET_UNPROVEN', binding.ref.entryPointer);
        next = end + 1;
    }
    if (next !== span.endLine + 1)
        fail('SUPPRESSION_TARGET_UNPROVEN', binding.ref.entryPointer);
    return { rawEntry: binding.ref, wholeEntrySpan: span, wholeEntryTextSha256: sha256(spanText(record, [span])),
        fragments: relevant.map(fragmentData) };
}
function residualFragments(record, fragments, suppressed) {
    const result = [];
    for (const fragment of fragments) {
        let next = fragment.span.startLine;
        for (const item of suppressed) {
            const cut = item.wholeEntrySpan;
            if (!overlaps(fragment.span, cut))
                continue;
            if (next < cut.startLine) {
                const span = { startLine: next, endLine: cut.startLine - 1 }, text = spanText(record, [span]);
                result.push({ ...fragment, span, text, textSha256: sha256(text) });
            }
            next = Math.max(next, cut.endLine + 1);
        }
        if (next <= fragment.span.endLine) {
            const span = { startLine: next, endLine: fragment.span.endLine }, text = spanText(record, [span]);
            result.push({ ...fragment, span, text, textSha256: sha256(text) });
        }
    }
    return result;
}
function overlays(input, bindings, assignments) {
    return bindings.map(binding => {
        if (input.rawDecoded.format === 'json-nexttavern-v1')
            return { kind: 'owned-structured-entry', rawEntry: binding.ref };
        if (!binding.span)
            return { kind: 'empty-original-entry', rawEntry: binding.ref };
        if (binding.constant && binding.enabled) {
            return { kind: 'constant-current-overlay-missing', rawEntry: binding.ref, reason: 'NO_INDEPENDENT_LEGACY_CONSTANT_ROW' };
        }
        const pieces = assignments.filter(item => item.assignment.target === 'worldbook'
            && item.assignment.id === binding.projectedId);
        const key = `${input.sessionId}__${binding.projectedId}`;
        const current = input.currentWorldbook.find(row => row.ref.key === key);
        if (!current || !pieces.length || !same(pieces.flatMap(item => item.assignment.sourceSpans), [binding.span])
            || !same(current.value.sources, pieces.map(item => item.descriptor)) || current.value.id !== binding.projectedId
            || typeof current.value.content !== 'string')
            fail('CURRENT_ENTRY_LINK_UNPROVEN', binding.ref.entryPointer);
        return { kind: 'exact-current-row-data', rawEntry: binding.ref, row: current,
            currentContentSha256: sha256(current.value.content), provenanceSha256: recordSha256(current.value.sources) };
    });
}
function directRow(input) {
    const { row, sessionId } = input;
    if (!rowMatches(row, 'worldbook', row.ref.key) || !row.ref.key.startsWith(`${sessionId}__`)
        || row.value.enabled === false || row.value.alwaysOn !== true || typeof row.value.content !== 'string') {
        fail('DIRECT_ALWAYS_ON_ROW_UNPROVEN', '/row');
    }
    const body = { ref: row.ref, content: row.value.content, contentSha256: sha256(row.value.content) };
    return { ...body, contributionSha256: recordSha256(body) };
}
export function resolveDirectAlwaysOnContributionDataV1(input) {
    try {
        const captured = cloneRoleplayTavernLoreDataV1(input, LEGACY_CONTRIBUTION_DATA_BOUNDS.bytes, LEGACY_CONTRIBUTION_DATA_BOUNDS);
        return freeze({ schemaVersion: 1, kind: 'direct-row-consumer-data',
            contribution: directRow(captured), authority: 'consumer-data-only' });
    }
    catch (error) {
        return refusal(error);
    }
}
function refusal(error) {
    return freeze({ schemaVersion: 1, kind: 'unproven',
        code: error instanceof Unproven ? error.code : error instanceof Error && error.message === 'LORE_DATA_BUDGET'
            ? 'INPUT_DATA_BUDGET' : 'INPUT_DATA_UNSUPPORTED', pointer: error instanceof Unproven ? error.pointer : '', authority: 'none' });
}
export function resolveLegacyContributionDataV1(request) {
    try {
        const input = cloneRoleplayTavernLoreDataV1(request, LEGACY_CONTRIBUTION_DATA_BOUNDS.bytes, LEGACY_CONTRIBUTION_DATA_BOUNDS);
        const decoded = validateSource(input);
        if (!rowMatches(input.currentRules, 'rules', `${input.sessionId}__spec`))
            fail('CURRENT_RULES_REF_CHANGED', '/currentRules/ref');
        const keys = new Set();
        for (const row of input.currentWorldbook) {
            if (!rowMatches(row, 'worldbook', row.ref.key) || !row.ref.key.startsWith(`${input.sessionId}__`) || keys.has(row.ref.key)) {
                fail('CURRENT_WORLDBOOK_REF_CHANGED', '/currentWorldbook');
            }
            keys.add(row.ref.key);
        }
        const membership = Object.fromEntries(input.currentWorldbook.map(row => [row.ref.key, row.ref.sha256]));
        if (recordSha256(membership) !== input.currentWorldbookMembershipSha256) {
            fail('CURRENT_WORLDBOOK_MEMBERSHIP_CHANGED', '/currentWorldbookMembershipSha256');
        }
        return computeLegacyContributionData(input, decoded);
    }
    catch (error) {
        return refusal(error);
    }
}
/** Source owns the captured import, decoder and actual-row admission. Only
 * this consumer's suppression choices and contribution semantics are new.
 * The result is explanatory DATA, never a write or execution capability. */
export function resolveCapturedLegacyContributionDataV1(input, selection) {
    try {
        return computeLegacyContributionData({ ...input, ...selection }, input.rawDecoded);
    }
    catch (error) {
        return refusal(error);
    }
}
function computeLegacyContributionData(input, decoded) {
    const record = input.activeImport;
    const rules = input.currentRules.value;
    if (typeof rules.core !== 'string' || !object(rules.sources) || !Array.isArray(rules.sources.core)) {
        fail('CORE_SOURCE_DESCRIPTORS_CHANGED', '/currentRules/value/sources/core');
    }
    const assignments = sortedAssignments(record), core = assignments.filter(item => item.assignment.target === 'core-setting');
    if (core.some(item => item.assignment.secondary === true))
        fail('SECONDARY_CORE_UNPROVEN', '/activeImport/assignments');
    if (!same(rules.sources.core, core.map(item => item.descriptor))) {
        fail('CORE_SOURCE_DESCRIPTORS_CHANGED', '/currentRules/value/sources/core');
    }
    const before = fragmentsFor(record, core), originalCore = before.map(fragment => fragment.text).join('');
    const independent = decoded.format === 'json-nexttavern-v1' || hasIndependentAuthorCoreV1(rules);
    const coreKind = independent ? 'independent-author' : rules.core === originalCore ? 'legacy-projection' : 'legacy-edited-unsplit';
    const projection = projectStructuredImport(record, decoded), bindings = entryBindings(input, decoded, projection), selected = new Set(), suppressed = [];
    // Only a still-identical legacy mixture has source spans in the live core.
    // Independent author text and historical unsplit edits are never cut using
    // positions from an older projection; the book/journal remains readable.
    for (const pointer of coreKind === 'legacy-projection' ? input.suppressRawEntryPointers : []) {
        const binding = bindings.find(item => item.ref.entryPointer === pointer);
        if (!binding || selected.has(pointer))
            fail('SUPPRESSION_TARGET_UNPROVEN', pointer);
        selected.add(pointer);
        suppressed.push(suppressedEntry(record, binding, before));
    }
    suppressed.sort((left, right) => left.wholeEntrySpan.startLine - right.wholeEntrySpan.startLine);
    const after = residualFragments(record, before, suppressed), residualCore = coreKind === 'legacy-projection'
        ? after.map(fragment => fragment.text).join('') : rules.core;
    const selectedRows = new Set(), directAlwaysOn = [];
    for (const key of input.suppressAlwaysOnRowKeys) {
        const row = input.currentWorldbook.find(item => item.ref.key === key);
        if (!row || selectedRows.has(key))
            fail('DIRECT_ALWAYS_ON_ROW_UNPROVEN', key);
        selectedRows.add(key);
        directAlwaysOn.push(directRow({ sessionId: input.sessionId, row }));
    }
    const orderedBefore = before.map(fragmentData), orderedAfter = after.map(fragmentData);
    let primaryBookAbsence;
    if (['json-v2', 'json-v3', 'png-v2', 'png-v3', 'json-nexttavern-v1'].includes(decoded.format)
        && decoded.document.data === decoded.data && !Object.hasOwn(decoded.data, 'character_book')) {
        const absence = { binding: 'proven-absence', bookPointer: '/data/character_book',
            documentSha256: recordSha256(decoded.document), dataSha256: recordSha256(decoded.data),
            activePointerRef: input.activePointerRef, importRecordRef: input.importRecordRef,
            activationSha256: recordSha256(record.activation) };
        primaryBookAbsence = { ...absence, absenceDataSha256: recordSha256(absence) };
    }
    return freeze({ schemaVersion: 1, kind: 'proven-consumer-data', rulesRow: input.currentRules.ref,
        beforeCoreSha256: sha256(rules.core), afterCoreSha256: sha256(residualCore), residualCore,
        coreData: { kind: coreKind, text: residualCore },
        orderedBefore, orderedAfter, orderedBeforeSha256: recordSha256(orderedBefore), orderedAfterSha256: recordSha256(orderedAfter),
        suppressed, directAlwaysOn, overlays: overlays(input, bindings, assignments), worldbookMembershipSha256: input.currentWorldbookMembershipSha256,
        projectionSha256: recordSha256(projection),
        ...(primaryBookAbsence ? { primaryBookAbsence } : {}), authority: 'consumer-data-only' });
}
