// Generated from runtime/alpha3/src/core/roleplay-tavern-prompt-source.ts; edit the TypeScript source.
/** Captures the actual current import and editing journal, then removes only
 * provenance-proven legacy duplication from the ordinary author producer. */
import { recordSha256 } from './roleplay-data.js';
import { resolveLegacyContributionDataV1 } from './roleplay-tavern-lore-contributions.js';
import { produceRoleplayTavernCurrentLegacyOverlayV1, composeRoleplayTavernCurrentOverlayV1 } from './roleplay-tavern-current-overlay.js';
import { compileTavernLoreBookV1 } from './tavern-lore-compiler.mjs';
import { produceAuthorContributionDataV1 } from './roleplay-author-contributions.js';
function fail(code) { throw Error(code); }
const same = (left, right) => recordSha256(left) === recordSha256(right);
const freeze = (value) => {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
};
/** Private immutable table snapshot for the existing author field producer.
 * Every row and complete membership came from the same actual Source capture;
 * author projection cannot add another live table inventory. */
function sourceAuthorTables(source) {
    const rows = { cards: new Map(), worldbook: new Map(),
        rules: new Map(), status: new Map() };
    for (const row of source.current.rows) {
        const name = row.ref.table;
        if ((name === 'cards' || name === 'worldbook' || name === 'rules' || name === 'status') && row.ref.exists && row.value) {
            rows[name].set(row.ref.key, row.value);
        }
    }
    const snapshot = (values) => Object.freeze({
        get: (key) => values.get(key), entries: () => values.entries()
    });
    return Object.freeze({ cards: snapshot(rows.cards), worldbook: snapshot(rows.worldbook),
        rules: snapshot(rows.rules), status: snapshot(rows.status) });
}
function assemblePromptSourceData(captured, edited, sessionId, includeCardStyle, tables) {
    const { source, contributionInput } = captured;
    if (!same(source, edited.source))
        fail('INPUT_MATERIAL_EDIT_SOURCE_CHANGED');
    const legacy = produceRoleplayTavernCurrentLegacyOverlayV1(contributionInput), first = legacy.contributions, linkedRows = new Set(legacy.linkedRowKeys), overlay = composeRoleplayTavernCurrentOverlayV1(legacy.overlay, edited.overlay);
    const compilation = compileTavernLoreBookV1({ schemaVersion: 1, encoding: 'st-character-book-compilation-input-v1',
        source: { schemaVersion: 1, encoding: 'st-character-book-source-reference-v1', ownerSessionId: sessionId,
            sourceRecordSessionId: source.sourceRecordSessionId, importId: source.original.activePointer.importId,
            rawSourceSha256: source.original.rawSha256, importRecordSha256: source.original.importRecordRef.sha256,
            sourceSnapshotSha256: source.sourceSha256, documentSha256: source.original.documentSha256,
            bookPointer: source.original.primary.bookPointer, bookValueSha256: source.original.primary.bookSha256,
            sourceFormat: source.original.decodedFormat.endsWith('v3') ? 'ccv3-character-book' : 'ccv2-character-book',
            ...(source.inheritance ? { inheritance: source.inheritance } : {}),
            ...(source.original.primary.binding === 'proven-absence'
                ? { bookPresence: 'proven-absence', absenceProof: source.original.primary.absenceProof } : {}) },
        book: source.original.primary.value,
        currentNativeOverlay: overlay });
    if (compilation.kind !== 'compiled')
        fail(compilation.diagnostics[0]?.code ?? 'INPUT_MATERIAL_LORE_COMPILATION_REFUSED');
    const suppressRawEntryPointers = first.overlays.filter(item => item.kind === 'constant-current-overlay-missing')
        .map(item => item.rawEntry.entryPointer);
    // A current linked row moved to always-on is replaced by the evaluator's
    // exact constant control. Other explicitly authored rows keep their producer.
    const suppressAlwaysOnRowKeys = contributionInput.currentWorldbook.filter(item => linkedRows.has(item.ref.key)
        && item.value.enabled !== false && item.value.alwaysOn === true).map(item => item.ref.key);
    const contributions = resolveLegacyContributionDataV1({ ...contributionInput,
        suppressRawEntryPointers, suppressAlwaysOnRowKeys });
    if (contributions.kind !== 'proven-consumer-data')
        fail(contributions.code);
    const original = produceAuthorContributionDataV1(tables, sessionId, includeCardStyle);
    const residual = produceAuthorContributionDataV1(tables, sessionId, includeCardStyle, { schemaVersion: 1,
        authority: 'consumer-data-only', rulesRowSha256: contributions.rulesRow.sha256,
        beforeCoreSha256: contributions.beforeCoreSha256, residualCore: contributions.residualCore,
        worldbookMembershipSha256: contributions.worldbookMembershipSha256,
        suppressAlwaysOn: contributions.directAlwaysOn.map(item => ({ key: item.ref.key, sha256: item.ref.sha256 })),
        splitExamples: true, nativeLoreReadPolicy: 'automatic' });
    return { kind: 'captured-data', source, edits: edited, compilation, contributions, original, residual,
        cardData: freeze(contributionInput.rawDecoded.data) };
}
/** Synchronous DATA supplier for the actual input Owner under its Source lock.
 * Currency belongs to that Owner; this return value creates no live callback. */
export function captureRoleplayTavernPromptSourceDataV1(deps, sessionId, includeCardStyle) {
    const captured = deps.source.capture(sessionId);
    if (captured.kind === 'outside-declared-domain')
        return { kind: 'outside-declared-domain', reason: captured.code };
    if (captured.kind !== 'captured-data')
        fail(captured.diagnostics[0]?.code ?? 'INPUT_MATERIAL_SOURCE_UNAVAILABLE');
    if (captured.source.sessionId !== sessionId)
        fail('INPUT_MATERIAL_SOURCE_CHANGED');
    const edited = deps.edits.observeSourceData(captured);
    if (edited.kind !== 'captured-data')
        fail(edited.diagnostics[0]?.code ?? 'INPUT_MATERIAL_EDIT_UNAVAILABLE');
    return assemblePromptSourceData(captured, edited.data, sessionId, includeCardStyle, sourceAuthorTables(captured.source));
}
/** Other callers retain their actual after-await Source/editor/author checks. */
export function captureRoleplayTavernPromptSourceV1(deps, sessionId, includeCardStyle, assertOwnerCurrent) {
    assertOwnerCurrent();
    const liveSource = deps.source.captureCurrent?.(sessionId), captured = liveSource?.captured ?? deps.source.capture(sessionId);
    if (captured.kind === 'outside-declared-domain')
        return { kind: 'outside-declared-domain', reason: captured.code };
    if (captured.kind !== 'captured-data')
        fail(captured.diagnostics[0]?.code ?? 'INPUT_MATERIAL_SOURCE_UNAVAILABLE');
    const { source } = captured, liveEdits = deps.edits.observeCurrent?.(sessionId), edited = liveEdits?.observed ?? deps.edits.observe(sessionId);
    if (edited.kind !== 'captured-data')
        fail(edited.diagnostics[0]?.code ?? 'INPUT_MATERIAL_EDIT_UNAVAILABLE');
    const data = assemblePromptSourceData(captured, edited.data, sessionId, includeCardStyle, deps.tables), original = data.original;
    const assertCurrent = () => {
        assertOwnerCurrent();
        if (liveSource)
            liveSource.assertCurrent();
        else if (!deps.source.current(source))
            fail('INPUT_MATERIAL_SOURCE_CHANGED');
        if (liveEdits)
            liveEdits.assertCurrent();
        else if (!deps.edits.current(edited.data))
            fail('INPUT_MATERIAL_SOURCE_CHANGED');
        const now = produceAuthorContributionDataV1(deps.tables, sessionId, includeCardStyle);
        if (now.dataSha256 !== original.dataSha256)
            fail('INPUT_MATERIAL_AUTHOR_CHANGED');
    };
    assertCurrent();
    return { ...data, assertCurrent };
}
