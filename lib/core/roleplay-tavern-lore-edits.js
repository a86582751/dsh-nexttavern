// Generated from runtime/alpha3/src/core/roleplay-tavern-lore-edits.ts; edit the TypeScript source.
/** Actual branch writer. The supplied import lock serializes cooperating Core
 * writers; get/put/entries do not pretend to provide a database transaction. */
import { recordSha256 } from './roleplay-data.js';
import { restoreTavernLoreSourceCounterWitnessV1 } from './roleplay-tavern-lore-source.js';
import { TAVERN_LORE_EDITS_BOUNDS_V1, LoreEditFailureV1, fail, freeze, same, sessionId, requestData, strictData, identityOf, eventKey, rowRef, headRef, eventFrom, nextHead, receiptOf, validateFields, mutationRequestData } from './roleplay-tavern-lore-edits-data.js';
import { readJournal, readJournalData, publishedData, publishedJournalData, plannedPublication, journalReferencesShaV1, readMutationOperationV1 } from './roleplay-tavern-lore-edits-journal.js';
import { produceRoleplayTavernCurrentLegacyOverlayV1 } from './roleplay-tavern-current-overlay.js';
export { TAVERN_LORE_EDITS_BOUNDS_V1 } from './roleplay-tavern-lore-edits-data.js';
function refusal(error, recovery) {
    const diagnostic = error instanceof LoreEditFailureV1 ? error.diagnostic : { code: 'STORAGE_READ_FAILED' };
    return freeze({ schemaVersion: 1, kind: 'refused', authority: 'none',
        diagnostics: [{ ...diagnostic, ...(recovery ? { recovery } : {}) }] });
}
function pendingFailure(event) {
    throw new LoreEditFailureV1({ code: 'PENDING_INTENT', pending: { operationId: event.request.operationId,
            payloadSha256: event.payloadSha256, eventRef: rowRef(eventKey(event.identitySha256, event.request.operationId), event) } });
}
function pendingRecovery(event) {
    return { phase: 'head-publication', identitySha256: event.identitySha256, operationId: event.request.operationId,
        payloadSha256: event.payloadSha256, eventRef: rowRef(eventKey(event.identitySha256, event.request.operationId), event),
        baseHeadRef: headRef(event.baseHead, event.baseHeadRowSha256 !== 'missing'),
        nextHeadRef: headRef(nextHead(event), true) };
}
export function createRoleplayTavernLoreEditsV1(deps) {
    function currentLegacyData(input, options = {}) {
        try {
            return produceRoleplayTavernCurrentLegacyOverlayV1(input, options);
        }
        catch (error) {
            fail('FIELDS_INVALID', error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
                ? error.message : 'current-legacy-overlay-unavailable');
        }
    }
    function captureSource(sid) {
        sessionId(sid);
        try {
            const result = deps.source.capture(sid);
            if (result.kind !== 'captured-data')
                fail('SOURCE_UNAVAILABLE', result.kind);
            const source = result.source;
            if (source.sessionId !== sid)
                fail('SOURCE_IDENTITY_INVALID');
            identityOf(source);
            if (!deps.source.current(source))
                fail('SOURCE_CHANGED');
            return { source: freeze(source), editorBaseOverlay: currentLegacyData(result.contributionInput).overlay };
        }
        catch (error) {
            if (error instanceof LoreEditFailureV1)
                throw error;
            fail('SOURCE_UNAVAILABLE');
        }
    }
    function observe(sid) {
        try {
            const { source, editorBaseOverlay } = captureSource(sid), journal = readJournal(deps, source);
            if (journal.pending)
                pendingFailure(journal.pending);
            const packet = publishedData(source, journal, editorBaseOverlay);
            // Compilation/clone is synchronous, but trusted readers can still report
            // changed records. Re-read the full namespace and Source before delivery.
            const actual = readJournal(deps, source);
            if (actual.refsSha256 !== journal.refsSha256 || !same(actual.headRef, journal.headRef))
                fail('HEAD_CHANGED');
            return freeze({ schemaVersion: 1, kind: 'captured-data', ...packet });
        }
        catch (error) {
            return refusal(error);
        }
    }
    /** The actual input Owner already captured Source under the shared lock.
     * Parse its editor namespace once; no second Source capture or live callback
     * is created for this synchronous DATA supplier. */
    function observeSourceData(captured) {
        return observeSourceDataWithLegacyData(captured).observed;
    }
    function sourceJournal(captured, options) {
        if (!captured || captured.schemaVersion !== 1 || captured.kind !== 'captured-data')
            fail('SOURCE_UNAVAILABLE');
        const source = captured.source;
        const legacy = currentLegacyData(captured.contributionInput, options), journal = readJournalData(deps, source);
        if (journal.pending)
            pendingFailure(journal.pending);
        return { source, legacy, journal };
    }
    /** Raw author JSON needs published fields and their provenance, without
     * building a semantic editor view or acquiring another Source reader. */
    function observeJournalDataWithLegacyData(captured, options = {}) {
        try {
            const { source, legacy, journal } = sourceJournal(captured, options), data = publishedJournalData(source, journal, legacy.overlay);
            return { observed: freeze({ schemaVersion: 1, kind: 'captured-data', data }), legacy };
        }
        catch (error) {
            return { observed: refusal(error), legacy: null };
        }
    }
    /** Export uses the same already-resolved legacy bindings as this editor.
     * Returning resolved DATA avoids a second Source/journal/resolver capture. */
    function observeSourceDataWithLegacyData(captured, options = {}) {
        try {
            const { source, legacy, journal } = sourceJournal(captured, options), packet = publishedData(source, journal, legacy.overlay);
            return { observed: freeze({ schemaVersion: 1, kind: 'captured-data', ...packet }), legacy };
        }
        catch (error) {
            return { observed: refusal(error), legacy: null };
        }
    }
    /** Currency of already parsed owner DATA; raw records enter through the
     * journal/Source parsers, not through this derived-output comparison. */
    function current(data) {
        try {
            if (!data || data.schemaVersion !== 1 || data.encoding !== 'tavern-lore-edits-current-data-v1'
                || data.authority !== 'consumer-data-only')
                return false;
            const { dataSha256, ...body } = data;
            if (recordSha256(body) !== dataSha256)
                return false;
            const live = deps.source.captureCurrent?.(data.sessionId), captured = live?.captured ?? deps.source.capture(data.sessionId);
            if (captured.kind !== 'captured-data')
                return false;
            const source = captured.source, journal = readJournal(deps, source, live?.assertCurrent);
            return same(data, publishedJournalData(source, journal, currentLegacyData(captured.contributionInput).overlay));
        }
        catch {
            return false;
        }
    }
    function observeCurrent(sid) {
        try {
            sessionId(sid);
            const live = deps.source.captureCurrent?.(sid), captured = live?.captured ?? deps.source.capture(sid);
            if (captured.kind !== 'captured-data')
                fail('SOURCE_UNAVAILABLE');
            const source = captured.source, sourceCurrent = () => {
                if (live)
                    live.assertCurrent();
                else if (!deps.source.current(source))
                    fail('SOURCE_CHANGED');
            };
            sourceCurrent();
            const journal = readJournal(deps, source, sourceCurrent);
            if (journal.pending)
                pendingFailure(journal.pending);
            const packet = publishedData(source, journal, currentLegacyData(captured.contributionInput).overlay);
            const assertCurrent = () => {
                sourceCurrent();
                // Full namespace replay still catches absent head, added orphan/pending
                // rows and inherited baseline changes. Overlay compilation is immutable
                // while every original journal input and Source input stays identical.
                const actual = readJournal(deps, source, sourceCurrent);
                if (actual.pending || actual.refsSha256 !== journal.refsSha256 || !same(actual.headRef, journal.headRef))
                    fail('HEAD_CHANGED');
            };
            assertCurrent();
            return { observed: freeze({ schemaVersion: 1, kind: 'captured-data', ...packet }), assertCurrent };
        }
        catch (error) {
            return { observed: refusal(error), assertCurrent: () => { fail('SOURCE_CHANGED'); } };
        }
    }
    function checkpoint(source, expected, callerCurrent) {
        if (callerCurrent && !callerCurrent())
            fail('SOURCE_CHANGED');
        const actual = readJournal(deps, source);
        if (actual.refsSha256 !== expected.refsSha256 || !same(actual.headRef, expected.headRef))
            fail('HEAD_CHANGED');
        return actual;
    }
    async function put(key, value, source, recovery) {
        try {
            await deps.branch.put(key, value);
        }
        catch {
            // A rejected/unknown put may already be durable. Never delete or rewrite
            // the intent. Attempt an actual readback but leave outcome unknown.
            let detail = 'readback-unavailable';
            try {
                const journal = readJournal(deps, source);
                detail = journal.pending ? 'prepared-intent-present' : journal.events.has(recovery.eventRef.key)
                    ? 'published-event-present' : 'intent-absent';
            }
            catch (error) {
                detail = error instanceof LoreEditFailureV1 ? error.diagnostic.code : 'readback-unavailable';
            }
            throw new LoreEditFailureV1({ code: 'WRITE_UNKNOWN', detail, recovery });
        }
    }
    async function lockedEdit(request, callerCurrent, captured) {
        let recovery;
        try {
            if (callerCurrent && !callerCurrent())
                fail('SOURCE_CHANGED');
            const { source, editorBaseOverlay } = captured ?? captureSource(request.sessionId), journal = captured?.journal ?? readJournal(deps, source);
            const key = eventKey(journal.identitySha256, request.operationId), existing = journal.events.get(key);
            const actualOperation = deps.branch.get(key);
            if ((actualOperation === undefined) !== !existing || actualOperation !== undefined
                && !same(strictData(actualOperation, TAVERN_LORE_EDITS_BOUNDS_V1.recordBytes), existing))
                fail('HEAD_CHANGED');
            if (existing && (existing.request.operationId !== request.operationId || !same(existing.request, request))) {
                fail('OPERATION_PAYLOAD_CONFLICT');
            }
            // This exact immutable intent already exists. Early Source refusals must
            // retain its manual recovery anchor rather than appear terminal to the UI.
            if (existing && journal.pending === existing)
                recovery = pendingRecovery(existing);
            if (request.expectedSourceSha256 !== source.sourceSha256)
                fail('SOURCE_CHANGED');
            if (journal.pending && journal.pending !== existing)
                pendingFailure(journal.pending);
            if (existing && journal.published.some(event => event.request.operationId === request.operationId)) {
                const packet = publishedData(source, journal, editorBaseOverlay);
                checkpoint(source, journal, callerCurrent);
                return freeze({ schemaVersion: 1, kind: 'edited-data', receipt: receiptOf(existing), ...packet });
            }
            if (request.expectedRevision !== journal.head.revision)
                fail('REVISION_MISMATCH');
            if (!('mutation' in request))
                validateFields(source, request);
            let event, prepared, publication;
            if (existing) {
                // The only unreferenced event is this exact operation/payload. A cold
                // restart can finish the original head without appending another event.
                if (journal.pending !== existing)
                    fail('JOURNAL_ORPHAN_CONFLICT');
                event = existing;
                prepared = journal;
                const next = nextHead(event), refs = journal.refs.filter(ref => ref.key !== journal.headRef.key);
                refs.push(rowRef(journal.headRef.key, next));
                refs.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
                publication = { ...journal, head: next, headRef: headRef(next, true), published: [...journal.published, event],
                    pending: null, refs, refsSha256: journalReferencesShaV1(refs, journal.inherited) };
                publishedData(source, publication, editorBaseOverlay);
            }
            else {
                if (journal.pending)
                    pendingFailure(journal.pending);
                if (journal.head.revision >= TAVERN_LORE_EDITS_BOUNDS_V1.events)
                    fail('JOURNAL_LIMIT');
                event = eventFrom(request, journal.head, journal.headRef.exists, source);
                publication = plannedPublication(source, journal, event, editorBaseOverlay);
                const refs = [...journal.refs, rowRef(key, event)].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
                prepared = { ...journal, events: new Map([...journal.events, [key, event]]), pending: event, refs,
                    refsSha256: journalReferencesShaV1(refs, journal.inherited) };
            }
            recovery = { phase: 'intent-write', identitySha256: journal.identitySha256, operationId: request.operationId,
                payloadSha256: event.payloadSha256, eventRef: rowRef(key, event), baseHeadRef: journal.headRef,
                nextHeadRef: publication.headRef };
            checkpoint(source, journal, callerCurrent);
            if (!existing) {
                if (deps.branch.get(key) !== undefined)
                    fail('HEAD_CHANGED');
                // First write is immutable intent; readers must refuse this intermediate
                // state. Await and compare exact head AND complete journal membership.
                await put(key, event, source, recovery);
                checkpoint(source, prepared, callerCurrent);
            }
            recovery = { ...recovery, phase: 'head-publication' };
            checkpoint(source, prepared, callerCurrent);
            await put(publication.headRef.key, publication.head, source, recovery);
            recovery = { ...recovery, phase: 'readback' };
            // Publication is already durable. Deliver its actual receipt even if the
            // caller was stopped during put; attachment continuation belongs to Core.
            const actual = checkpoint(source, publication);
            const packet = publishedData(source, actual, editorBaseOverlay);
            checkpoint(source, actual);
            return freeze({ schemaVersion: 1, kind: 'edited-data', receipt: receiptOf(event), ...packet });
        }
        catch (error) {
            return refusal(error, recovery);
        }
    }
    async function edit(raw) {
        try {
            const request = freeze(requestData(raw));
            return await deps.withSourceLock(request.sessionId, () => lockedEdit(request));
        }
        catch (error) {
            return refusal(error);
        }
    }
    async function mutate(raw, callerCurrent, captured) {
        try {
            const request = freeze(mutationRequestData(raw));
            return await deps.withSourceLock(request.sessionId, () => lockedEdit(request, callerCurrent, captured));
        }
        catch (error) {
            return refusal(error);
        }
    }
    async function retryMutation(sid, operationId, callerCurrent, locator) {
        let recovery;
        try {
            return await deps.withSourceLock(sid, () => {
                if (!callerCurrent())
                    fail('SOURCE_CHANGED');
                sessionId(sid);
                sessionId(operationId);
                const located = locator ? readMutationOperationV1(deps, sid, operationId, locator) : undefined;
                if (located?.kind === 'not-recorded')
                    fail('OPERATION_NOT_RECORDED');
                if (located?.kind === 'published') {
                    // This is an immutable journal fact, even after a different import
                    // became active. It grants no Source DATA, attachment or continuation.
                    return freeze({ schemaVersion: 1, kind: 'edited-data', receipt: receiptOf(located.event) });
                }
                if (located?.kind === 'pending')
                    recovery = pendingRecovery(located.event);
                const captured = captureSource(sid), journal = readJournal(deps, captured.source);
                if (located?.kind === 'pending' && journal.identitySha256 !== located.event.identitySha256)
                    fail('SOURCE_CHANGED');
                const event = journal.events.get(eventKey(journal.identitySha256, operationId));
                if (!event)
                    fail(locator ? 'OPERATION_NOT_RECORDED' : 'RETRY_LOCATOR_REQUIRED');
                if (!('mutation' in event.request))
                    fail('REQUEST_INVALID');
                if (journal.pending === event)
                    recovery = pendingRecovery(event);
                // Only Source reconstructs its projected counter rows. The old full SHA
                // must still match exactly; V2 without this witness remains exact-only.
                const source = event.schemaVersion === 3
                    ? restoreTavernLoreSourceCounterWitnessV1(captured.source, event.sourceCounters, event.request.expectedSourceSha256)
                    : captured.source;
                if (!source)
                    fail('SOURCE_CHANGED');
                return lockedEdit(event.request, callerCurrent, { ...captured, source, journal });
            });
        }
        catch (error) {
            return refusal(error, recovery);
        }
    }
    return { observe, captureCurrentData: observe, observeSourceData, observeSourceDataWithLegacyData,
        observeJournalDataWithLegacyData, current, edit, mutate, retryMutation, observeCurrent };
}
