// Generated from runtime/alpha3/src/core/roleplay-tavern-lore-source.ts; edit the TypeScript source.
/** Current structured primary worldbook Source. Core owns the import lock;
 * current rows stay own-session; inherited imports require the actual closed
 * Source/Native lineage reader. Hashes describe frozen data,
 * never template, suppression, publication or Native execution permission. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { roleplaySourceMetadataValue } from './roleplay-input-state.js';
import { cloneRoleplayTavernLoreDataV1, TavernLoreDataFailureV1, TAVERN_LORE_DATA_BOUNDS_V1 } from './roleplay-tavern-lore-data.js';
import { CARD_LIMITS, decodeTavernCard } from './tavern-card.js';
import { assertImportRecordIntegrity, assertAssignmentBudget, assertReferenceBudget, assertReviewProof, importCoverage, normalizeSourceSpans, spanText, validateAssignmentIdentities } from './roleplay-import-record.js';
export const TAVERN_LORE_SOURCE_BOUNDS_V1 = Object.freeze({ ...TAVERN_LORE_DATA_BOUNDS_V1, rows: 4096 });
const ID = /^[a-zA-Z0-9_-]{1,128}$/;
const IMPORT_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const KEY = /^[a-zA-Z0-9_-]{1,256}$/;
const HASH = /^[a-f0-9]{64}$/;
const TABLES = ['branch', 'cards', 'worldbook', 'rules', 'status', 'opening'];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isHash = (value) => typeof value === 'string' && HASH.test(value);
const isVersion = (value) => value === 'missing' || isHash(value);
const same = (left, right) => recordSha256(left) === recordSha256(right);
const pointerPart = (value) => value.replace(/~/g, '~0').replace(/\//g, '~1');
const rowId = (table, key) => `${table}:${key}`;
class SourceFailure extends Error {
    diagnostic;
    constructor(diagnostic) {
        super(diagnostic.code);
        this.diagnostic = diagnostic;
    }
}
class OutsideSource extends Error {
    code;
    pointer;
    missingEvidence;
    constructor(code, pointer, missingEvidence) {
        super(code);
        this.code = code;
        this.pointer = pointer;
        this.missingEvidence = missingEvidence;
    }
}
function fail(code, pointer, limit) {
    throw new SourceFailure({ code, pointer, ...(limit ? { limit } : {}) });
}
function outside(code, pointer, missingEvidence = []) {
    throw new OutsideSource(code, pointer, missingEvidence);
}
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
/** This bridge owns Source pointers/codes; the lore-purpose clone owns bounds. */
function cloneData(input, pointer, used) {
    try {
        return cloneRoleplayTavernLoreDataV1(input, TAVERN_LORE_DATA_BOUNDS_V1.bytes, undefined, used);
    }
    catch (error) {
        if (error instanceof TavernLoreDataFailureV1)
            fail(error.code === 'LORE_DATA_BUDGET' ? 'SOURCE_BUDGET' : 'DATA_INVALID', pointer, error.limit);
        throw error;
    }
}
/** Adapter/import limits remain unchanged and must not become a generic invalid
 * source result. These are known maintained validator bounds, not author text. */
function importFailure(error, pointer) {
    if (error instanceof SourceFailure)
        throw error;
    const message = error instanceof Error ? error.message : '';
    const known = [
        [/JSON 大小超出字节限制/, 'adapterJsonBytes', CARD_LIMITS.jsonBytes],
        [/角色卡大小超出字节/, 'adapterSourceBytes', CARD_LIMITS.bytes],
        [/世界书条目数量超限/, 'adapterRawEntries', CARD_LIMITS.entries],
        [/JSON 嵌套过深/, 'adapterJsonDepth', CARD_LIMITS.depth],
        [/JSON 字段数量过多/, 'adapterJsonNodes', CARD_LIMITS.nodes],
    ];
    const match = known.find(([pattern]) => pattern.test(message));
    if (match)
        fail('SOURCE_BUDGET', pointer, { field: match[1], maximum: match[2] });
    if (/超过.*上限|投影字符数或行数超限|PNG.*大小超限/.test(message)) {
        fail('SOURCE_BUDGET', pointer);
    }
    fail('IMPORT_RECORD_INVALID', pointer);
}
function exactKeys(value, keys, code, pointer) {
    if (Object.keys(value).some(key => !keys.includes(key)))
        fail(code, pointer);
}
function versionMap(value, pointer) {
    if (!isObject(value))
        fail('MEMBERSHIP_INVALID', pointer);
    if (Object.keys(value).length > TAVERN_LORE_SOURCE_BOUNDS_V1.rows)
        fail('SOURCE_BUDGET', pointer, { field: 'currentRows', maximum: TAVERN_LORE_SOURCE_BOUNDS_V1.rows, observed: Object.keys(value).length });
    const result = {};
    for (const [key, version] of Object.entries(value)) {
        if (!ID.test(key) || !isHash(version))
            fail('MEMBERSHIP_INVALID', pointer);
        result[key] = version;
    }
    return result;
}
function captured(deps, sessionId) {
    if (typeof sessionId !== 'string' || !ID.test(sessionId))
        fail('REQUEST_INVALID', '/sessionId');
    const used = { bytes: 0, nodes: 0 };
    const rawPointer = deps.readActivePointer(sessionId);
    if (rawPointer === undefined)
        outside('ACTIVE_SOURCE_MISSING', '/activePointer');
    const pointer = cloneData(rawPointer, '/activePointer', used);
    if (!isObject(pointer) || typeof pointer.importId !== 'string' || !IMPORT_ID.test(pointer.importId)
        || !isHash(pointer.normalizedSha256) || !isHash(pointer.coverageSha256)
        || typeof pointer.transactionId !== 'string' || !ID.test(pointer.transactionId)) {
        fail('ACTIVE_POINTER_INVALID', '/activePointer');
    }
    if (pointer.activatedAt !== undefined && (typeof pointer.activatedAt !== 'number'
        || !Number.isSafeInteger(pointer.activatedAt) || pointer.activatedAt < 0)) {
        fail('ACTIVE_POINTER_INVALID', '/activePointer/activatedAt');
    }
    exactKeys(pointer, ['importId', 'sourceRecordSessionId', 'normalizedSha256', 'transactionId',
        'coverageSha256', 'activatedAt', 'inheritedFrom'], 'ACTIVE_POINTER_INVALID', '/activePointer');
    const sourceRecordSessionId = pointer.sourceRecordSessionId ?? sessionId;
    if (typeof sourceRecordSessionId !== 'string' || !ID.test(sourceRecordSessionId)) {
        fail('ACTIVE_POINTER_INVALID', '/activePointer/sourceRecordSessionId');
    }
    const activePointerRef = { table: 'branch', key: `${sessionId}__import-active`,
        exists: true, sha256: recordSha256(pointer) };
    const storedPointer = deps.readRow('branch', activePointerRef.key);
    if (storedPointer === undefined || !same(cloneData(storedPointer, '/activePointerRef'), pointer)) {
        fail('ACTIVE_POINTER_REF_CHANGED', '/activePointerRef');
    }
    if (Object.hasOwn(pointer, 'inheritedFrom') && (typeof pointer.inheritedFrom !== 'string' || !ID.test(pointer.inheritedFrom)
        || pointer.inheritedFrom === sessionId))
        fail('ACTIVE_POINTER_INVALID', '/activePointer/inheritedFrom');
    const isInherited = sourceRecordSessionId !== sessionId || Object.hasOwn(pointer, 'inheritedFrom');
    const lineage = isInherited ? deps.readSourceInheritance?.(sessionId) : undefined;
    if (isInherited && lineage?.kind !== 'committed-data') {
        outside('INHERITED_SOURCE_EVIDENCE_MISSING', '/activePointer', [
            'actual Native branch parent and frozen cut',
            'committed inheritance/material-copy lineage and own-session current rows',
            'immutable ancestor import binding independent of later parent activation',
        ]);
    }
    const inheritance = lineage?.kind === 'committed-data' ? lineage.data : undefined;
    if (inheritance) {
        const original = inheritance.originalBinding;
        if (inheritance.childSessionId !== sessionId || inheritance.parentSessionId !== pointer.inheritedFrom
            || original.sourceRecordSessionId !== sourceRecordSessionId || original.importId !== pointer.importId
            || original.normalizedSha256 !== pointer.normalizedSha256 || original.coverageSha256 !== pointer.coverageSha256
            || original.transactionId !== pointer.transactionId || original.originalPointer.activatedAt !== pointer.activatedAt)
            fail('ACTIVE_POINTER_INVALID', '/activePointer/inheritance');
    }
    const rawRecord = deps.readImportRecord(sourceRecordSessionId, pointer.importId);
    if (rawRecord === undefined)
        fail('IMPORT_RECORD_INVALID', '/activeImport');
    const record = cloneData(rawRecord, '/activeImport', used);
    if (!isObject(record) || record.sessionId !== sourceRecordSessionId || record.importId !== pointer.importId
        || record.status !== 'active' || record.normalizedSha256 !== pointer.normalizedSha256
        || record.activation?.transactionId !== pointer.transactionId)
        fail('IMPORT_RECORD_INVALID', '/activeImport');
    const importRecordRef = { table: 'branch', key: `${sourceRecordSessionId}__import-${record.importId}`,
        exists: true, sha256: recordSha256(record) };
    const storedRecord = deps.readRow('branch', importRecordRef.key);
    if (storedRecord === undefined || !same(cloneData(storedRecord, '/importRecordRef'), record)) {
        fail('IMPORT_RECORD_REF_CHANGED', '/importRecordRef');
    }
    if (inheritance && !same(importRecordRef, { table: 'branch', exists: true, ...inheritance.originalBinding.importRecordRef }))
        fail('IMPORT_RECORD_REF_CHANGED', '/importRecordRef/inheritance');
    if (record.schemaVersion === 3)
        outside('LEGACY_SOURCE_OUTSIDE_DOMAIN', '/activeImport/normalizer');
    const normalizer = record.schemaVersion === 4 && record.normalizer === 'tavern-fields-v1' ? 'tavern-fields-v1'
        : record.schemaVersion === 5 && record.normalizer === 'tavern-fields-v2' ? 'tavern-fields-v2' : undefined;
    if (!normalizer)
        outside('STRUCTURED_VERSION_OUTSIDE_DOMAIN', '/activeImport/normalizer');
    if (record.mode === 'merge')
        outside('MERGE_PROVENANCE_UNPROVEN', '/activeImport/mode', [
            'complete prior import/contribution lineage for current merged fields',
        ]);
    if (record.mode !== undefined && record.mode !== 'replace')
        fail('IMPORT_RECORD_INVALID', '/activeImport/mode');
    try {
        assertImportRecordIntegrity(record);
    }
    catch (error) {
        importFailure(error, '/activeImport');
    }
    if (!record.sourceEnvelope || !record.activation || !isHash(record.rawSha256))
        fail('IMPORT_RECORD_INVALID', '/activeImport');
    if (pointer.activatedAt !== record.activatedAt)
        fail('ACTIVATION_INVALID', '/activeImport/activatedAt');
    let coverage;
    try {
        coverage = importCoverage(record);
    }
    catch (error) {
        importFailure(error, '/activeImport/coverage');
    }
    if (coverage.coverage !== 1 || coverage.uncovered.length || coverage.overlaps.length
        || recordSha256(coverage) !== pointer.coverageSha256 || !same(record.coverage, coverage)) {
        fail('COVERAGE_INVALID', '/activeImport/coverage');
    }
    try {
        assertAssignmentBudget(record.assignments);
        assertReferenceBudget(record, record.assignments);
        validateAssignmentIdentities(record.assignments);
        if (!record.assignmentProof)
            assertReviewProof(record);
        for (const assignment of record.assignments) {
            const spans = normalizeSourceSpans(assignment.sourceSpans, record.lineCount);
            const hash = sha256(spanText(record, spans));
            if (!same(spans, assignment.sourceSpans) || assignment.sourceSha256 !== hash
                || assignment.materializedSha256 !== hash)
                fail('ASSIGNMENT_INVALID', '/activeImport/assignments');
        }
    }
    catch (error) {
        importFailure(error, '/activeImport/assignments');
    }
    const activation = record.activation.writeDigests;
    if (!Array.isArray(activation) || !activation.length)
        fail('ACTIVATION_INVALID', '/activeImport/activation');
    if (activation.length > TAVERN_LORE_SOURCE_BOUNDS_V1.rows)
        fail('SOURCE_BUDGET', '/activeImport/activation', { field: 'activationRows', maximum: TAVERN_LORE_SOURCE_BOUNDS_V1.rows, observed: activation.length });
    const writes = new Set();
    for (const row of activation) {
        if (!isObject(row) || !TABLES.includes(row.tableName) || typeof row.key !== 'string'
            || !KEY.test(row.key) || !row.key.startsWith(`${sourceRecordSessionId}__`) || !isVersion(row.sha256)
            || writes.has(`${row.tableName}:${row.key}`))
            fail('ACTIVATION_INVALID', '/activeImport/activation/writeDigests');
        if (row.tableName === 'branch' && row.key !== `${sourceRecordSessionId}__settings`
            || row.tableName === 'rules' && row.key !== `${sourceRecordSessionId}__spec`
            || row.tableName === 'status' && ![`${sourceRecordSessionId}__spec`, `${sourceRecordSessionId}__panel`].includes(row.key)
            || row.tableName === 'opening' && row.key !== `${sourceRecordSessionId}__scene`) {
            fail('ACTIVATION_INVALID', '/activeImport/activation/writeDigests');
        }
        writes.add(`${row.tableName}:${row.key}`);
    }
    if (activation.filter(row => row.tableName === 'rules' && row.key === `${sourceRecordSessionId}__spec` && isHash(row.sha256)).length !== 1) {
        fail('ACTIVATION_INVALID', '/activeImport/activation/writeDigests');
    }
    let decoded;
    try {
        decoded = decodeTavernCard(Buffer.from(record.sourceEnvelope.base64, 'base64'), record.sourceEnvelope.extension);
    }
    catch (error) {
        importFailure(error, '/activeImport/sourceEnvelope');
    }
    if (!['json-v2', 'json-v3', 'png-v2', 'png-v3'].includes(decoded.format) || decoded.document.data !== decoded.data) {
        outside('STRUCTURED_VERSION_OUTSIDE_DOMAIN', '/rawDecoded');
    }
    // Freeze this decoder fact before cloning: detached aliases cannot choose a
    // different raw-book pointer. Object entry keys likewise precede any projection.
    const documentDataRootPointer = '/data', bookPointer = '/data/character_book';
    const hasBook = Object.hasOwn(decoded.data, 'character_book');
    const rawBook = decoded.data.character_book;
    // JSON null/arrays/nonobjects are malformed presence, not proof of absence.
    if (hasBook && !isObject(rawBook))
        fail('IMPORT_RECORD_INVALID', bookPointer);
    const rawEntries = hasBook ? rawBook.entries ?? [] : [];
    if (!Array.isArray(rawEntries) && !isObject(rawEntries))
        fail('IMPORT_RECORD_INVALID', `${bookPointer}/entries`);
    const entries = Object.entries(rawEntries);
    if (entries.length > TAVERN_LORE_SOURCE_BOUNDS_V1.rows)
        fail('SOURCE_BUDGET', `${bookPointer}/entries`, { field: 'rawEntries', maximum: TAVERN_LORE_SOURCE_BOUNDS_V1.rows, observed: entries.length });
    const rawDecoded = cloneData(decoded, '/rawDecoded');
    const book = hasBook ? cloneData(rawBook, bookPointer) : null;
    const bookSha256 = recordSha256(book);
    let absenceProof;
    if (!hasBook && inheritance) {
        if (lineage?.kind !== 'committed-data' || !lineage.originalAbsenceProof
            || lineage.originalAbsenceProof.documentSha256 !== recordSha256(decoded.document)
            || lineage.originalAbsenceProof.dataSha256 !== recordSha256(decoded.data)
            || lineage.originalAbsenceProof.rawSha256 !== record.rawSha256)
            fail('IMPORT_RECORD_INVALID', bookPointer);
        absenceProof = cloneData(lineage.originalAbsenceProof, '/originalAbsenceProof');
    }
    else if (!hasBook) {
        // Use the exact decoder document. All import integrity, coverage, activation
        // and actual pointer/record checks above still precede this consumer datum.
        const proofBody = { schemaVersion: 1, encoding: 'st-character-book-proven-absence-data-v1',
            authority: 'consumer-data-only', ownerSessionId: sessionId, sourceRecordSessionId, importId: record.importId,
            documentDataRootPointer, bookPointer, decodedFormat: decoded.format,
            document: rawDecoded.document,
            documentSha256: recordSha256(decoded.document), dataSha256: recordSha256(decoded.data),
            rawSha256: record.rawSha256, normalizedSha256: record.normalizedSha256,
            coverageSha256: pointer.coverageSha256, transactionId: pointer.transactionId,
            activatedAt: record.activatedAt ?? null, activePointer: pointer,
            activePointerRef: { ...activePointerRef, table: 'branch', exists: true },
            importRecordRef: { ...importRecordRef, table: 'branch', exists: true }, activation: record.activation };
        absenceProof = { ...proofBody, absenceProofSha256: recordSha256(proofBody) };
    }
    const rawEntryData = entries.map(([key, value], entryOrdinal) => {
        if (!isObject(value) || typeof value.content !== 'string')
            fail('IMPORT_RECORD_INVALID', `${bookPointer}/entries/${pointerPart(key)}`);
        const raw = cloneData(value, `${bookPointer}/entries/${pointerPart(key)}`);
        return { entryKey: key, value: raw, ref: { sessionId, sourceRecordSessionId, importId: record.importId,
                activePointerSha256: activePointerRef.sha256, importRecordSha256: importRecordRef.sha256,
                rawSha256: record.rawSha256, normalizedSha256: record.normalizedSha256, coverageSha256: pointer.coverageSha256,
                transactionId: pointer.transactionId, normalizer, bookPointer, bookSha256,
                entryPointer: `${bookPointer}/entries/${pointerPart(key)}`, entryOrdinal, entrySha256: recordSha256(raw) } };
    });
    const versions = cloneData(deps.recordVersionsFor(sessionId), '/current/membership', used);
    if (!isObject(versions) || !isVersion(versions.rules) || !isVersion(versions.settings))
        fail('MEMBERSHIP_INVALID', '/current/membership');
    const cards = versionMap(versions.cards, '/current/cards'), worldbook = versionMap(versions.worldbook, '/current/worldbook');
    const rows = new Map();
    const read = (table, key, expected) => {
        if (!KEY.test(key) || !key.startsWith(`${sessionId}__`))
            fail('ROW_INVALID', '/current/rows');
        const existing = rows.get(rowId(table, key));
        if (existing) {
            if (expected !== undefined && existing.ref.sha256 !== expected)
                fail('MEMBERSHIP_INVALID', '/current/rows');
            return existing;
        }
        if (rows.size >= TAVERN_LORE_SOURCE_BOUNDS_V1.rows)
            fail('SOURCE_BUDGET', '/current/rows', { field: 'currentRows', maximum: TAVERN_LORE_SOURCE_BOUNDS_V1.rows, observed: rows.size + 1 });
        const actual = deps.readRow(table, key), value = actual === undefined ? null : cloneData(actual, '/current/rows', used);
        if (actual !== undefined && !isObject(value))
            fail('ROW_INVALID', '/current/rows');
        if (isObject(value))
            for (const ownerKey of ['sessionId', 'ownerSessionId']) {
                if (value[ownerKey] !== undefined && value[ownerKey] !== sessionId)
                    fail('ROW_INVALID', '/current/rows');
            }
        const ref = { table, key, exists: actual !== undefined, sha256: actual === undefined ? 'missing' : recordSha256(value) };
        if (expected !== undefined && ref.sha256 !== expected)
            fail('MEMBERSHIP_INVALID', '/current/rows');
        const row = { ref, value: value };
        rows.set(rowId(table, key), row);
        return row;
    };
    const branch = read('branch', `${sessionId}__meta`);
    if (!branch.ref.exists || !branch.value)
        fail('BRANCH_UNAVAILABLE', '/current/branch');
    if (branch.value.inheritanceState !== undefined && branch.value.inheritanceState !== 'ready') {
        fail('BRANCH_UNAVAILABLE', '/current/branch');
    }
    // Include old activation keys even when now absent, but never require their
    // old whole-row SHA. Complete today's membership remains a separate fact.
    for (const row of activation)
        read(row.tableName, `${sessionId}__${row.key.slice(sourceRecordSessionId.length + 2)}`);
    for (const [id, hash] of Object.entries(cards))
        read('cards', `${sessionId}__${id}`, hash);
    for (const [id, hash] of Object.entries(worldbook))
        read('worldbook', `${sessionId}__${id}`, hash);
    const rules = read('rules', `${sessionId}__spec`, versions.rules);
    if (!rules.ref.exists || !rules.value)
        fail('RULES_UNAVAILABLE', '/current/rules');
    read('branch', `${sessionId}__settings`, versions.settings);
    read('status', `${sessionId}__spec`);
    read('opening', `${sessionId}__scene`);
    for (const row of rows.values())
        if ((row.ref.table === 'cards' || row.ref.table === 'worldbook') && row.ref.exists) {
            const id = row.ref.key.slice(sessionId.length + 2), membership = row.ref.table === 'cards' ? cards : worldbook;
            if (membership[id] !== row.ref.sha256)
                fail('MEMBERSHIP_INVALID', '/current/membership');
        }
    const openingContext = cloneData(deps.readOpeningContext(sessionId), '/current/openingContext', used);
    if (!isObject(openingContext) || !isObject(openingContext.context) || !isHash(openingContext.bindingSha256)) {
        fail('OPENING_CONTEXT_INVALID', '/current/openingContext');
    }
    exactKeys(openingContext.context, ['user', 'char', 'user_gender'], 'OPENING_CONTEXT_INVALID', '/current/openingContext/context');
    if (Object.values(openingContext.context).some(value => typeof value !== 'string' || value.length > 512)) {
        fail('OPENING_CONTEXT_INVALID', '/current/openingContext/context');
    }
    const materialRows = [...rows.values()].sort((left, right) => {
        const a = rowId(left.ref.table, left.ref.key), b = rowId(right.ref.table, right.ref.key);
        return a < b ? -1 : a > b ? 1 : 0;
    });
    const currentWorldbook = Object.keys(worldbook).sort().map(id => {
        const row = rows.get(rowId('worldbook', `${sessionId}__${id}`));
        return { ref: { ...row.ref, table: 'worldbook' }, value: row.value };
    });
    const contributionInput = { sessionId, sourceRecordSessionId, normalizer, rawDecoded,
        activeImport: record, importRecordRef, activePointer: pointer, activePointerRef,
        currentRules: { ref: { ...rules.ref, table: 'rules' }, value: rules.value }, currentWorldbook,
        currentWorldbookMembershipSha256: recordSha256(Object.fromEntries(currentWorldbook.map(row => [row.ref.key, row.ref.sha256]))) };
    // Bound this complete data packet separately. The contribution consumer owns
    // its further proof/refusal policy and explicit suppression selections.
    cloneData(contributionInput, '/contributionInput');
    const membership = { cards, worldbook, rules: versions.rules, settings: versions.settings };
    const primary = hasBook
        ? { binding: 'primary', bookPointer, bookSha256, value: book, entries: rawEntryData }
        : { binding: 'proven-absence', bookPointer, bookSha256, value: null, entries: [], absenceProof: absenceProof };
    const body = { schemaVersion: 1, encoding: 'tavern-lore-current-source-data-v1',
        authority: 'consumer-data-only', sessionId, sourceRecordSessionId, normalizer,
        ...(inheritance ? { inheritance } : {}),
        original: { activePointer: pointer, activePointerRef, importRecordRef,
            rawSha256: record.rawSha256, normalizedSha256: record.normalizedSha256, coverageSha256: pointer.coverageSha256,
            transactionId: pointer.transactionId, decodedFormat: decoded.format,
            documentSha256: recordSha256(decoded.document), dataSha256: recordSha256(decoded.data), documentDataRootPointer,
            primary },
        current: { rows: materialRows, materialSha256: recordSha256(materialRows), ...membership, membershipSha256: recordSha256(membership),
            openingContext: { context: openingContext.context, bindingSha256: openingContext.bindingSha256,
                valuesSha256: recordSha256(openingContext.context) } } };
    const source = { ...body, sourceSha256: recordSha256(body) };
    cloneData(source, '/source');
    return freeze({ schemaVersion: 1, kind: 'captured-data', source, contributionInput });
}
export function createRoleplayTavernLoreSourceV1(deps) {
    function capture(sessionId) {
        try {
            return captured(deps, sessionId);
        }
        catch (error) {
            if (error instanceof OutsideSource)
                return freeze({ schemaVersion: 1, kind: 'outside-declared-domain',
                    code: error.code, pointer: error.pointer, missingEvidence: [...error.missingEvidence], authority: 'none' });
            return freeze({ schemaVersion: 1, kind: 'refused', diagnostics: [error instanceof SourceFailure
                        ? error.diagnostic : { code: 'SOURCE_READ_FAILED', pointer: '/source' }], authority: 'none' });
        }
    }
    function current(input) {
        try {
            const saved = cloneData(input, '/source');
            if (!isObject(saved) || saved.schemaVersion !== 1 || saved.encoding !== 'tavern-lore-current-source-data-v1'
                || saved.authority !== 'consumer-data-only' || !isHash(saved.sourceSha256))
                return false;
            const { sourceSha256, ...body } = saved;
            if (recordSha256(body) !== sourceSha256)
                return false;
            // Rebuild from every actual table/reader, immutable decoder proof,
            // membership and binding. No cached digest or legacy-to-legacy exemption.
            const actual = captured(deps, saved.sessionId);
            return same(tavernLoreSourceCurrentIdentityV1(saved), tavernLoreSourceCurrentIdentityV1(actual.source));
        }
        catch {
            return false;
        }
    }
    function captureCurrent(sessionId) {
        const result = capture(sessionId);
        if (result.kind !== 'captured-data')
            return { captured: result, assertCurrent: () => { fail('DATA_INVALID', '/source'); } };
        const saved = result.source;
        // Frozen ancestry owns more than root static inputs. Its existing full
        // reader remains the currency supplier until that footprint is reviewed.
        if (saved.inheritance || saved.sourceRecordSessionId !== sessionId) {
            return { captured: result, assertCurrent: () => { if (!current(saved))
                    fail('DATA_INVALID', '/source'); } };
        }
        const identity = tavernLoreSourceCurrentIdentityV1(saved), rows = identity.current.rows, expectedContext = { context: saved.current.openingContext.context,
            bindingSha256: saved.current.openingContext.bindingSha256 }, expectedCardsSha256 = recordSha256(saved.current.cards), expectedWorldbookSha256 = recordSha256(saved.current.worldbook), expectedContextSha256 = recordSha256(expectedContext);
        const assertCurrent = () => {
            const pointer = deps.readActivePointer(sessionId), record = deps.readImportRecord(saved.sourceRecordSessionId, saved.original.activePointer.importId);
            if (recordSha256(pointer) !== saved.original.activePointerRef.sha256
                || recordSha256(deps.readRow('branch', saved.original.activePointerRef.key)) !== saved.original.activePointerRef.sha256
                || recordSha256(record) !== saved.original.importRecordRef.sha256
                || recordSha256(deps.readRow('branch', saved.original.importRecordRef.key)) !== saved.original.importRecordRef.sha256) {
                fail('IMPORT_RECORD_REF_CHANGED', '/source/current');
            }
            const versions = deps.recordVersionsFor(sessionId);
            if (recordSha256(versionMap(versions.cards, '/current/cards')) !== expectedCardsSha256
                || recordSha256(versionMap(versions.worldbook, '/current/worldbook')) !== expectedWorldbookSha256
                || versions.rules !== saved.current.rules || versions.settings !== saved.current.settings
                || recordSha256(deps.readOpeningContext(sessionId)) !== expectedContextSha256)
                fail('MEMBERSHIP_INVALID', '/source/current');
            for (const row of rows) {
                const actual = deps.readRow(row.ref.table, row.ref.key);
                if (row.ref.exists !== (actual !== undefined))
                    fail('ROW_INVALID', '/source/current');
                if (actual === undefined)
                    continue;
                let value = cloneData(actual, '/source/current/row');
                if (row.ref.table === 'branch' && row.ref.key === `${sessionId}__meta` && isObject(value)) {
                    // The canonical projection already hashed this actual meta row.
                    // Reuse that digest, while every current table value is read afresh.
                    const current = tavernLoreSourceCurrentRowIdentityV1(sessionId, { ref: row.ref, value });
                    if (current.ref.sha256 !== row.ref.sha256)
                        fail('ROW_INVALID', '/source/current');
                    continue;
                }
                if (recordSha256(value) !== row.ref.sha256)
                    fail('ROW_INVALID', '/source/current');
            }
        };
        assertCurrent();
        // The closure has the producer's frozen proof and exact input footprint.
        // It re-reads whole rows across every await; a serialized SHA cannot obtain it.
        return { captured: result, assertCurrent };
    }
    return { capture, current, captureCurrent };
}
/** One deterministic currency projection. Frozen Source/audit bytes retain
 * the full original meta and sourceSha; only these three normal Native
 * counters do not invalidate an otherwise unchanged current Source. */
export function tavernLoreSourceCurrentIdentityV1(input) {
    const source = cloneData(input, '/source/currentIdentity'), { sourceSha256, ...body } = source;
    if (recordSha256(body) !== sourceSha256)
        fail('DATA_INVALID', '/source/currentIdentity');
    const rows = source.current.rows.map(row => tavernLoreSourceCurrentRowIdentityV1(source.sessionId, row));
    return freeze({ ...body, current: { ...source.current, rows, materialSha256: recordSha256(rows) } });
}
/** The same complete-row projection is used by Source currency and the actual
 * fresh-basis metadata reader. It grants no row provenance or Source lease. */
export function tavernLoreSourceCurrentRowIdentityV1(sessionId, row) {
    if (row.ref.table !== 'branch' || row.ref.key !== `${sessionId}__meta` || !row.value)
        return row;
    const value = roleplaySourceMetadataValue(row.value);
    return { ref: { ...row.ref, sha256: recordSha256(value) }, value };
}
