// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-story-core.ts; edit the TypeScript source.
/** Actual closing-work owner and read-only history for schema story turns.
 * Source descriptors and stored terminal plans never mint this private lease. */
import { recordSha256, sha256, textOf } from './roleplay-data.js';
import { schemaPhaseErrorPolicyForProgramV4 } from './tavern-mvu-schema-program-v4.js';
import { canonicalAssistantForTurn } from './roleplay-context.js';
import { readTavernCanonicalChatChangesV1, readTavernSelectedMessageFactsV1 } from './roleplay-tavern-chat-clock.js';
import { createReaderVariablePrefix, readerVariableBase } from './roleplay-reader-variable-prefix.js';
import { sessionHistoryCut } from './session-history.js';
import { openingIntentKey } from './roleplay-opening-selection.js';
import { mvuInitializationEventKey, mvuInitializationHeadKey } from './roleplay-mvu-initialization.js';
import { mvuStateCurrentHeadKey } from './roleplay-mvu-state.js';
import { createMvuNumericalPublicationOwner, mvuNumericalPublicationLeaf, mvuNumericalPublicationMatches } from './roleplay-mvu-numerical-publication.js';
import { validateOpeningVariantReplacementEvent, validateOpeningVariantSet, openingVariantReplacementHead, openingVariantReplacementPlanKey, openingVariantReplacementEventKey, openingVariantReplacementCompletionKey, openingVariantReplacementCompletion } from './roleplay-opening-variant-types.js';
import { createOpeningVariantContinuationReader, createOpeningVariantDataReader, openingVariantActivationEventKey } from './roleplay-opening-variant-activation.js';
import { readInputCompletion } from './roleplay-input-completion.js';
import { inputSnapshotReferenceCurrent } from './roleplay-preparation.js';
import { createRoleplayMvuSchemaJournal, freezeSchemaJournalData, schemaJournalFrontierSha256, schemaEpochExecution, schemaEpochAuthorIdentity, schemaNativeCutSha256, isAuthorHostJournalReadyV5, schemaJournalServerTailSha256, schemaJournalHostFrontierSha256, sealSchemaJournalRecord, isSchemaBrowserFacts } from './roleplay-mvu-schema-journal.js';
import { createRoleplayMvuSchemaReplay, schemaExecutionHostFrontierSha256, schemaExecutionServerTailSha256 } from './roleplay-mvu-schema-replay.js';
import { schemaOriginalSnapshot, schemaOriginalCompilationInput, schemaOriginalServerScripts, schemaOriginalProgramSha256, schemaOriginalReplayCompilationInput } from './roleplay-mvu-schema-source.js';
import { schemaTraceRequestedStep } from './roleplay-mvu-schema-executor-types.js';
import { createRoleplayMvuSchemaStory } from './roleplay-mvu-schema-story.js';
import { createRoleplayMvuSchemaPrefixInputs } from './roleplay-mvu-schema-frozen-prefix-input.js';
import { validateMvuSchemaOpeningIntent, validateMvuSchemaOpeningEvent, validateMvuSchemaOpeningHead, verifyMvuSchemaOpeningFacts, mvuSchemaOpeningHead } from './roleplay-mvu-schema-opening-types.js';
import { sealMvuSchemaStoryFact, validateMvuSchemaNumericalSnapshot, validateMvuSchemaStoryEvent, validateMvuSchemaStorySettlement, mvuSchemaStoryHead, mvuSchemaStoryEventKey, mvuSchemaStorySettlementKey, MVU_SCHEMA_STORY_PHASES, isMvuSchemaGenesisHead, mvuSchemaStoryExecutionPhases, mvuSchemaStoryReconcileSelector, mvuSchemaStoryCommandInfos, mvuSchemaStoryVariableParts } from './roleplay-mvu-schema-story-types.js';
import { validateMvuSchemaStoryPlan, validateMvuSchemaStoryRevisionDescriptor, validateMvuSchemaStoryRevisionEvent, mvuSchemaStoryRevisionDescriptorKey, mvuSchemaStoryRevisionPlanKey, mvuSchemaStoryRevisionEventKey, mvuSchemaStoryRevisionEvent, mvuSchemaStoryRevisionHead, mvuSchemaStoryPhaseInput, mvuSchemaStoryReducerBridge, deriveMvuSchemaStoryRevisionSelectors, deriveMvuSchemaStoryRevisionSelectorsV2, mvuSchemaStoryRevisionCompletionKey, validateMvuSchemaStoryRevisionCompletion, validateMvuSchemaStoryRevisionBasis, mvuSchemaStoryRevisionBasisKey, parseMvuSchemaStoryCandidateV2, parseMvuSchemaStoryCandidateData, schemaStoryMaintenanceSource } from './roleplay-mvu-schema-story-types.js';
import { validateMvuSchemaPlayerEvent, joinMvuSchemaPlayerCompletedEvent, mvuSchemaPlayerEventKey, mvuSchemaPlayerHead, mvuSchemaPlayerOperationKey, mvuSchemaPlayerPlanKey, mvuSchemaPlayerRefusalKey, mvuSchemaPlayerSettlementKey, mvuSchemaPlayerCompletionKey, MVU_SCHEMA_PLAYER_PHASES, mvuSchemaPlayerPhaseInput, mvuSchemaPlayerReducerBridge, deriveMvuSchemaPlayerRevisionSelectors, validateMvuSchemaPlayerRevisionPlan, mvuSchemaPlayerRevisionEventId, mvuSchemaPlayerRevisionEvent, validateMvuSchemaPlayerRevisionEvent, mvuSchemaPlayerRevisionHead } from './roleplay-mvu-schema-player-types.js';
import { validateMvuSchemaFrozenPrefix, validateMvuSchemaDerivedBasis, sealMvuSchemaInheritanceFact } from './roleplay-mvu-schema-derived-types.js';
import { buildSchemaScopeReadFrame, schemaScopeSource, schemaScopeConfiguration, schemaScopeOwner, schemaScopePublished, schemaScopeMessageKey, schemaScopeVisibleMessages, schemaScopeCanonicalMessages, schemaScopeReadFactsEqual, schemaScopeEmpty, schemaScopeReowner, schemaScopeMessageTargetEqual } from './roleplay-mvu-schema-scope-facts.js';
import { buildSelectedSchemaPromptScopeData, schemaScopeSelectedCanonicalMessages, schemaScopeSelectedMessagePoints } from './roleplay-mvu-schema-scope-facts.js';
import { AUTHOR_NATIVE_EVENTS_V1 } from './author-native-origin.js';
import { authorOrdinaryMessageSelectionV1, authorOrdinaryMessageVariablesV1 } from './roleplay-author-prompt-capture.js';
import { captureAuthorMessageViewV1 } from './roleplay-author-message-capture.js';
import { readMvuSchemaInheritedStoryFacts, verifyMvuSchemaInheritedOpeningFacts, schemaInheritedStoryInputKeys } from './roleplay-mvu-schema-prefix-facts.js';
import { verifyMvuSchemaUnpublishedTail } from './roleplay-mvu-schema-history-tail.js';
import { validateSchemaTaskEditIntent, validateSchemaTaskEditIntentV1, validateSchemaTaskEditBindingV1, schemaTaskEditActiveKey, schemaTaskEditIntentKey, schemaTaskEditBindingKey, validateSchemaExistingUserEditRecoveryIntentV1, schemaExistingUserEditRecoveryIntentKey } from './roleplay-mvu-schema-task-edit-types.js';
import { readWorldlinePlayerSaveIntent, assertWorldlinePlayerSaveRequest } from './roleplay-worldline-player-save.js';
import { readTavernCanonicalChatAtCutV1, readTavernCanonicalChatMatchesAtCutV1 } from './roleplay-tavern-chat-clock.js';
import { acceptedMvuDisplayUpdate, formatMvuDisplayUpdates } from './roleplay-mvu-display-facts.js';
import { createMvuScopeProjectionV2 } from './roleplay-mvu-scope-projection-v2.js';
import { validateMvuScopeObjectV2, createMvuScopeViewResolverV2 } from './tavern-mvu-scope-view-v2.js';
const settledMessageKey = (target) => `${target.seq}:${target.messageId}:${target.versionSha256}`;
function settledStoryMessage(event) {
    if (!('browser' in event) || !event.browser || event.outcome === 'refused' || !('canonical' in event.plan))
        return;
    const target = { seq: event.plan.canonical.seq, messageId: event.plan.canonical.messageId, versionSha256: event.plan.canonical.versionSha256 };
    return { message_content: event.browser.finalizedMessage, target, eventSha256: event.eventSha256 };
}
const isManualRevision = (event) => event.encoding === 'native-mvu-schema-player-revision-event-v1';
const isSuffixEvent = (event) => event.encoding === 'native-mvu-schema-story-revision-event-v2' || isManualRevision(event);
const isOpeningVariantEvent = (event) => event.encoding === 'native-opening-variant-replacement-event-v1';
const isManualEvent = (event) => event.encoding === 'native-mvu-schema-player-event-v1'
    || isManualRevision(event) || isOpeningVariantEvent(event);
function suffixOriginals(descriptor) {
    return descriptor.schemaVersion !== 2 ? descriptor.originals : descriptor.originals.map(event => ({ kind: 'story', event }));
}
function readRevisionEvent(input) {
    return input.encoding === 'native-mvu-schema-player-revision-event-v1'
        ? validateMvuSchemaPlayerRevisionEvent(input) : validateMvuSchemaStoryRevisionEvent(input);
}
function suffixHead(event) {
    return isManualRevision(event) ? mvuSchemaPlayerRevisionHead(event) : mvuSchemaStoryRevisionHead(event);
}
function manualChatAtBase(chat, base) {
    return chat.kind === 'available' && chat.provenance.kind === 'published-state'
        && chat.provenance.state.kind === 'manual' && chat.provenance.state.revision === base.revision;
}
const same = (a, b) => recordSha256(a) === recordSha256(b);
const openingPhaseCount = (plan) => plan.schemaVersion === 8 ? plan.phases.length : 1;
function fail(code) { throw Error(code); }
const codeOf = (error) => error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
    ? error.message : 'SCHEMA_STORY_UNPROVEN';
const journalFull = (ready) => 'materialize' in ready ? ready.materialize() : ready;
const journalStep = (ready, index) => 'materialize' in ready ? ready.steps.at(index) : ready.steps[index];
const journalLast = (ready) => journalStep(ready, ready.steps.length - 1);
function* journalRange(ready, start = 0, end = ready.steps.length) {
    if ('materialize' in ready)
        yield* ready.steps.range(start, end);
    else
        for (let index = start; index < end; index++)
            yield ready.steps[index];
}
/** One mutable owner, immutable versioned views. Appends never copy historical
 * keys or change values observed through an older DATA view. */
function numericalIndex(initial) {
    const rows = new Map(), keys = [];
    let version = 0;
    function set(key, value) {
        let values = rows.get(key);
        if (!values) {
            rows.set(key, values = []);
            keys.push(key);
        }
        values.push({ version: ++version, value });
    }
    for (const [key, value] of initial)
        set(key, value);
    function view() {
        const through = version, count = keys.length;
        const get = (key) => {
            const values = rows.get(key);
            if (!values)
                return undefined;
            let lo = 0, hi = values.length;
            while (lo < hi) {
                const mid = (lo + hi) >>> 1;
                if (values[mid].version <= through)
                    lo = mid + 1;
                else
                    hi = mid;
            }
            return lo ? values[lo - 1].value : undefined;
        };
        function* entries() {
            for (let index = 0; index < count; index++) {
                const key = keys[index];
                yield [key, get(key)];
            }
        }
        const result = { size: count, get, has: key => get(key) !== undefined, entries,
            *keys() { for (let index = 0; index < count; index++)
                yield keys[index]; },
            *values() { for (const [, value] of entries())
                yield value; }, [Symbol.iterator]: entries,
            forEach(callback, thisArg) { for (const [key, value] of entries())
                callback.call(thisArg, value, key, result); } };
        return Object.freeze(result);
    }
    return { set, view };
}
function historyWith(prior, updates) {
    return Object.defineProperties(Object.defineProperties({}, Object.getOwnPropertyDescriptors(prior)), Object.getOwnPropertyDescriptors(updates));
}
/** Both callers have already joined these steps to settled numerical history.
 * Manual refusals retain their existing operation receipt and are not Story updates. */
function commandDiagnosticsForStep(step) {
    const source = step.dispatch.sourceNativeCut.anchor.kind, output = step.step.output;
    if (source === 'manual')
        return [];
    const basis = { source, nativeSeq: step.completionMarker.seq };
    if (output.kind === 'refused' && output.errorPolicy === 'update-batch-atomic-v1') {
        return output.diagnostics.map(diagnostic => ({ ...basis, kind: 'batch-refusal',
            phase: step.step.frame.input.phase, ...diagnostic }));
    }
    if (output.kind === 'accepted' && output.errorPolicy === 'registered-command-policy-v1') {
        return output.discarded.map(row => ({ ...basis, commandIndex: row.commandIndex, code: row.code,
            ...'pointer' in row ? { pointer: row.pointer } : {} }));
    }
    return [];
}
export function createRoleplayMvuSchemaStoryCore(deps) {
    const prefixInputs = createRoleplayMvuSchemaPrefixInputs({ branch: deps.branch, status: deps.status });
    const openingVariantData = createOpeningVariantDataReader(key => deps.branch.get(key), deps.readInheritedOpeningVariantFact);
    const subjectArchives = new Map();
    function openingArchivesFor(sid) {
        let reader = subjectArchives.get(sid);
        if (!reader) {
            reader = createOpeningVariantContinuationReader(key => prefixInputs.readBranchFact(key, () => openingVariantData(sid, key)));
            subjectArchives.set(sid, reader);
        }
        return reader;
    }
    const numericalHeads = createMvuNumericalPublicationOwner(prefixInputs.status);
    const historyRecords = deps.inputState.schemaHistoryReader({ story: validateMvuSchemaStoryEvent,
        player: validateMvuSchemaPlayerEvent, revision: readRevisionEvent });
    const scopeBindings = deps.scopeStore?.bindings(prefixInputs.status);
    const journal = createRoleplayMvuSchemaJournal({ table: prefixInputs.status, markers: deps.markers,
        recordOwner: deps.inputState.schemaJournal, nativeHistory: deps.inputState.nativeHistory,
        readScopeReferences: scopeBindings?.readScopeReferences, captureScopeObjects: scopeBindings?.captureScopeObjects,
        resolveExecutionBaseline: (ref, sid) => openingArchivesFor(sid).resolve(ref),
        live: { session: deps.session, observeDomainChanges: deps.inputState.observeDomainChanges,
            captureClosedData: deps.inputState.captureClosedData, readDataInventory: deps.inputState.readDataInventory } });
    const views = new Map(), owners = new Map(), scopes = new WeakMap();
    const sourceLeases = new Map();
    const revisionOwners = new Map(), revisionScopes = new WeakMap();
    const editReconciliations = new Map();
    let disposed = false;
    // Only the synchronous capture's edit-invalidation reader may see this
    // already verified opening basis. It is DATA, never a live execution lease.
    let capturingEditBasis;
    const drivers = new Map();
    // Source alone returns the branded Original5. Retain that object across
    // immutable derived/history DATA reads; a DTO is never promoted in place.
    const sourceOriginals = new Map();
    // A genuine recovery result carries its already checked prefix projections.
    // Retained genesis DATA must outlive eviction from the bounded lookup tables;
    // a copied ready DTO cannot acquire this process-local association.
    const recoveredPrefixes = new WeakMap();
    // This cache contains results of the same fully verified frozen-prefix fold.
    // Derivation revalidates its immutable rows before looking up the result; a
    // cache entry cannot bypass Native lineage, Source checks or mint a lease.
    const scopePrefixes = new Map();
    // Primitive accepted-display facts only; a cache miss cannot affect state,
    // fork or recovery. Registration follows the original complete prefix fold.
    const displayPrefixes = new Map();
    const all = (session) => deps.inputState.nativeHistory?.events(session) ?? session.snapshotEvents();
    const actualNative = (session) => deps.inputState.nativeHistory?.cut?.(session) ?? all(session);
    const actualNativeSha = (events, cut = events.length) => 'prefixSha256' in events
        ? events.prefixSha256(cut) : schemaNativeCutSha256(events, cut, deps.inputState.nativeHistory?.prefixes);
    const scopePublishers = new Map();
    const readerPrefixes = new Map();
    const authorReadMessages = new Map();
    const scopeResumeAnchors = new Map();
    function retainScopeResume(sid, owner, realm, anchor, proof) {
        if (!anchor || anchor.cut.sessionId !== sid || anchor.cut.ownerSessionId !== sid
            || schemaScopeSource(anchor.frame.snapshot).sessionId !== sid)
            return;
        scopeResumeAnchors.set(sid, { owner, realm, anchor, proof });
    }
    const coldNumericalReads = new WeakMap();
    const numericalCursors = new Map();
    const textCanonicalPointers = new WeakMap();
    const numericalChanges = deps.inputState.observeDomainChanges(change => {
        if (change.table !== 'status')
            return;
        const split = change.key.indexOf('__');
        if (split < 0)
            return;
        const cursor = numericalCursors.get(change.key.slice(0, split));
        if (cursor && /__(?:mvu-state-schema-(?:story|player|revision|opening-variant)-event-)/.test(change.key)) {
            cursor.dirty.add(change.key);
            deps.inputState.invalidateSession(cursor.session.id);
        }
    });
    function releaseNumerical(sid) {
        readerPrefixes.delete(sid);
        authorReadMessages.delete(sid);
        const cursor = numericalCursors.get(sid);
        if (cursor) {
            for (const fact of cursor.ownedFacts)
                fact.dispose();
            cursor.semantic.dispose();
            numericalCursors.delete(sid);
        }
        const scope = scopePublishers.get(sid);
        if (scope) {
            scope.publisher.dispose();
            scope.projection.dispose();
            scopePublishers.delete(sid);
        }
        scopeResumeAnchors.delete(sid);
    }
    function invalidateSession(sid) {
        const revision = revisionOwners.get(sid);
        if (revision)
            revision.driver.invalidateOwner(revision.token);
        const owner = owners.get(sid);
        if (owner)
            releaseClosing(owner.lease);
        views.delete(sid);
        deps.inputState.invalidateSession(sid);
        clearDisplayPrefixes(sid);
    }
    function releaseSession(sid) {
        invalidateSession(sid);
        subjectArchives.delete(sid);
        releaseNumerical(sid);
        scopeBindings?.releaseSession(sid);
        journal.releaseSession(sid);
    }
    // An edited/invalidated view may already be absent when its Agent closes.
    // Release by the actual Session lifetime, rather than discovering it in views.
    const releaseLifetime = deps.inputState.observeSessionRelease(releaseSession);
    const currentSession = (session) => !disposed && deps.session(session.id) === session && deps.active(session);
    const frontier = (ready, emptyNativeCut = 'materialize' in ready ? ready.nativeCut : ready.frozen.nativeCut) => ({
        nativeCut: (ready.entries ?? ready.steps).at(-1)?.completionMarker.seq !== undefined
            ? (ready.entries ?? ready.steps).at(-1).completionMarker.seq + 1 : emptyNativeCut,
        tailSha256: schemaJournalServerTailSha256(ready), frontierSha256: schemaJournalHostFrontierSha256(ready)
    });
    function snapshot(body) {
        const { stateSnapshotSha256: _prior, ...content } = body;
        return validateMvuSchemaNumericalSnapshot(sealMvuSchemaStoryFact(content, 'stateSnapshotSha256'));
    }
    function scopeOwnerForSeq(facts, seq) {
        for (let index = facts.owners.length - 1; index >= 0; index--) {
            const range = facts.owners[index];
            if (seq >= range.fromSeq && (range.throughSeq === null || seq < range.throughSeq))
                return range.sessionId;
        }
        fail('SCHEMA_SCOPE_MESSAGE_OWNER_UNPROVEN');
    }
    function publishedMessageTarget(facts, event) {
        if (isOpeningVariantEvent(event)) {
            return { kind: 'message', ...event.plan.message };
        }
        if (isManualRevision(event)) {
            const target = event.plan.operation.request.target;
            if (!target)
                return null;
            // The operation keeps its original address. This revision's proved
            // scope already applies its canonical edit projection at the logical
            // cut; reuse that message version for both live and recovered output.
            const message = event.plan.scopeReadFrame.messages.find(row => row.nativeSeq === target.nativeSeq
                && row.messageId === target.messageId);
            if (!message)
                fail('SCHEMA_MESSAGE_TARGET_UNPROVEN');
            return { ...target, messageVersionSha256: message.messageVersionSha256 };
        }
        if (isManualEvent(event))
            return event.plan.operation.request.target ?? null;
        const canonical = event.plan.canonical;
        return { kind: 'message', ownerSessionId: scopeOwnerForSeq(facts, canonical.seq), nativeSeq: canonical.seq,
            messageId: canonical.messageId, messageVersionSha256: canonical.versionSha256 };
    }
    function scopeFrameAt(facts, original, current, cut, events, logicalCut = cut.nativeCut, projection) {
        if (cut.nativeCut > events.length || cut.sessionId !== current.sessionId
            || cut.sourceSnapshotSha256 !== current.snapshotSha256 || cut.materialSha256 !== current.materialSha256) {
            fail('SCHEMA_SCOPE_CUT_UNPROVEN');
        }
        // Live callers construct this cut from their actual Native snapshot;
        // historical callers consume Journal's proved prefix (or proveCut).
        // Scope projection consumes that same prefix without hashing it again.
        const source = schemaScopeSource(current.snapshot), prefix = events.slice(0, logicalCut);
        const project = projection ? () => ({ ...projection, nodes: projection.nodes.filter(seq => seq < logicalCut) }) : deps.projectPrefix;
        const snapshot = schemaOriginalSnapshot(original);
        if (source.importId !== snapshot.source.importId || source.rawSha256 !== snapshot.source.rawSha256
            || source.sourceRecordSessionId !== snapshot.source.sourceRecordSessionId)
            fail('SCHEMA_SCOPE_SOURCE_UNPROVEN');
        return buildSchemaScopeReadFrame(source, recordSha256(cut), schemaOriginalServerScripts(original), facts.chat, schemaScopeVisibleMessages(prefix, project, source, seq => scopeOwnerForSeq(facts, seq), facts.messages));
    }
    function scopeRefAvailable(ready) {
        return ready.epoch.encoding === 'native-mvu-schema-epoch-v5-scope-ref-v2'
            && !!deps.scopeStore && !!deps.projections && !!deps.inputState.nativeHistory?.cut;
    }
    function scopeSemantic(session, loaded) {
        let facts, priorFacts, prior, count = 0;
        let anchor;
        // Journal owns program/cut bindings and the closed pair's scope dependency.
        // This chronological DATA resolver only compares actual numerical values;
        // its new object reads attach directly to the enclosing numerical collector.
        const read = (ref) => deps.scopeStore.readObject(ref, prefixInputs.status);
        let resolver = createMvuScopeViewResolverV2({ read });
        const loadedCut = loaded ? {
            owner: Object.freeze({}), source: 'loaded', length: loaded.length, at: seq => loaded[seq],
            prefixSha256: cut => schemaNativeCutSha256(loaded, cut, deps.inputState.nativeHistory?.prefixes),
            nativeInputPrefixSha256: () => undefined,
            forEachRange(start, end, visit) { for (let seq = start; seq < end; seq++)
                visit(loaded[seq], seq); },
            *range(start = 0, end = loaded.length) { for (let seq = start; seq < end; seq++)
                yield loaded[seq]; }, materialize: () => loaded
        } : undefined;
        const history = loadedCut ? { events: () => loaded, prefixes: () => undefined,
            cut: () => loadedCut } : deps.inputState.nativeHistory;
        const projection = createMvuScopeProjectionV2({ history, projections: deps.projections(),
            ownerForSeq: (_session, seq) => scopeOwnerForSeq(facts, seq) });
        function verify(reference, next, original, frame, cut, logicalCut = cut.nativeCut) {
            facts = next;
            const projected = projection.read(session, logicalCut), source = schemaScopeSource(frame.snapshot);
            if (prior && (prior.baseRef.key !== reference.baseRef.key || prior.baseRef.ownerSessionId !== reference.baseRef.ownerSessionId))
                resolver = createMvuScopeViewResolverV2({ read });
            {
                const resolved = resolver.resolve(reference), view = resolved.view, scripts = resolved.scripts();
                const expectedMessage = (index) => {
                    const item = projected.messages.at(index);
                    if (!item)
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                    const { nativeOwnerSessionId, ...metadata } = item, publication = facts.messages.get(schemaScopeMessageKey(nativeOwnerSessionId, item.nativeSeq, item.messageId, item.messageVersionSha256)), ownerSessionId = publication?.kind === 'available' ? publication.provenance.owner.sessionId : nativeOwnerSessionId, owner = schemaScopeOwner(source, 'message', item.messageId, ownerSessionId);
                    return { ...metadata, ownerSessionId, variables: schemaScopeReowner(publication ?? schemaScopeEmpty(owner), owner) };
                };
                const checkMessage = (index) => {
                    if (index < view.messageCount && !same(view.messageAt(index), expectedMessage(index)))
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                };
                if (view.messageCount !== projected.messages.length
                    || !same(view.scopes.chat, schemaScopeReowner(facts.chat, schemaScopeOwner(source, 'chat')))
                    || !same(view.scopes.character, schemaScopeEmpty(schemaScopeOwner(source, 'character')))
                    || !same(view.scopes.global, schemaScopeEmpty(schemaScopeOwner(source, 'global'))))
                    fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                const expectedScripts = schemaOriginalServerScripts(original);
                let scriptCount = 0;
                for (const script of scripts) {
                    const expected = expectedScripts.find(row => row.identity === script.scriptId);
                    if (!expected || !same(script, { scriptId: expected.identity, pointer: expected.pointer, sourceSha256: expected.sourceSha256,
                        variables: schemaScopeEmpty(schemaScopeOwner(source, 'script', expected.identity)) }))
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                    scriptCount++;
                }
                if (scriptCount !== expectedScripts.length)
                    fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                const sameRef = (left, right) => left.key === right.key
                    && left.sha256 === right.sha256 && left.ownerSessionId === right.ownerSessionId;
                const cold = !prior || !sameRef(prior.baseRef, reference.baseRef) || projected.cold
                    || projected.changes.some(change => change.deleteCount !== change.messages.length && change.index < count);
                if (cold) {
                    for (let index = 0; index < view.messageCount; index++)
                        checkMessage(index);
                }
                else {
                    const deltas = [];
                    let tail = reference.tailRef;
                    while (!sameRef(tail, prior.tailRef)) {
                        const object = validateMvuScopeObjectV2(read(tail));
                        if (object.encoding !== 'native-mvu-scope-delta-v2')
                            fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                        deltas.push(object);
                        tail = object.previousRef;
                    }
                    let length = count;
                    for (const delta of deltas.reverse())
                        for (const change of delta.changes)
                            if (change.kind === 'message-splice') {
                                if (change.deleteCount !== change.messages.length && (change.index !== length || change.deleteCount !== 0)) {
                                    fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                                }
                                for (let offset = 0; offset < change.messages.length; offset++)
                                    checkMessage(change.index + offset);
                                length += change.messages.length - change.deleteCount;
                            }
                    if (length !== view.messageCount)
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                    let changed = facts;
                    while (changed && changed !== priorFacts) {
                        for (const seq of changed.publishedMessages ?? []) {
                            const index = projected.messages.indexOfNativeSeq(seq);
                            if (index !== undefined)
                                checkMessage(index);
                        }
                        changed = changed.previous;
                    }
                    if (changed !== priorFacts)
                        for (let index = 0; index < view.messageCount; index++)
                            checkMessage(index);
                    for (const change of projected.changes)
                        for (let offset = 0; offset < change.messages.length; offset++)
                            checkMessage(change.index + offset);
                }
            }
            prior = reference;
            priorFacts = facts;
            count = projected.messages.length;
            anchor = { reference, cut, frame, facts };
        }
        return { verify(_ready, ...args) {
                try {
                    verify(...args);
                }
                catch (error) {
                    projection.dispose();
                    throw error;
                }
            },
            anchor: () => anchor,
            dispose() { projection.dispose(); } };
    }
    async function scopeReferenceAt(session, facts, original, frame, cut, check) {
        const sid = session.id, realm = original.realmEpoch;
        let entry = scopePublishers.get(sid);
        if (entry && (entry.session !== session || entry.realm !== realm)) {
            entry.publisher.dispose();
            entry.projection.dispose();
            scopePublishers.delete(sid);
            entry = undefined;
        }
        if (!entry) {
            const state = { session, realm, facts, check, initialized: false,
                tail: Promise.resolve(),
                projection: createMvuScopeProjectionV2({ history: deps.inputState.nativeHistory, projections: deps.projections(),
                    ownerForSeq: (_session, seq) => scopeOwnerForSeq(state.facts, seq) }),
                publisher: deps.scopeStore.publisher({ ownerSessionId: sid, realmEpoch: realm, check: () => state.check() }) };
            const anchor = scopeResumeAnchors.get(sid), native = deps.inputState.nativeHistory.cut(session);
            if (anchor?.owner === native.owner && anchor.realm === realm && anchor.proof.current()) {
                anchor.proof.use();
                state.view = state.publisher.resume(anchor.anchor.reference).view;
                state.facts = anchor.anchor.facts;
                state.projected = state.projection.read(session, anchor.anchor.cut.nativeCut);
                state.reference = anchor.anchor.reference;
                state.initialized = true;
            }
            scopePublishers.set(sid, state);
            entry = state;
        }
        const owner = entry;
        const action = async () => {
            owner.check = check;
            check();
            if (cut.sessionId !== sid || cut.sourceSnapshotSha256 !== frame.snapshotSha256
                || cut.materialSha256 !== frame.materialSha256)
                fail('SCHEMA_SCOPE_CUT_UNPROVEN');
            const prior = owner.facts;
            owner.facts = facts;
            const projected = owner.projection.read(session, cut.nativeCut), source = schemaScopeSource(frame.snapshot);
            function message(item) {
                const { nativeOwnerSessionId, ...metadata } = item;
                const publication = facts.messages.get(schemaScopeMessageKey(nativeOwnerSessionId, item.nativeSeq, item.messageId, item.messageVersionSha256));
                const ownerSessionId = publication?.kind === 'available' ? publication.provenance.owner.sessionId : nativeOwnerSessionId;
                const messageOwner = schemaScopeOwner(source, 'message', item.messageId, ownerSessionId);
                return { ...metadata, ownerSessionId, variables: schemaScopeReowner(publication ?? schemaScopeEmpty(messageOwner), messageOwner) };
            }
            const chat = schemaScopeReowner(facts.chat, schemaScopeOwner(source, 'chat'));
            if (!owner.initialized) {
                const result = await owner.publisher.initialize({ source,
                    scopes: { chat, character: schemaScopeEmpty(schemaScopeOwner(source, 'character')),
                        global: schemaScopeEmpty(schemaScopeOwner(source, 'global')) },
                    scripts: schemaOriginalServerScripts(original).map(script => ({ scriptId: script.identity, pointer: script.pointer,
                        sourceSha256: script.sourceSha256, variables: schemaScopeEmpty(schemaScopeOwner(source, 'script', script.identity)) })),
                    messages: [...projected.messages.range()].map(message) }, recordSha256(cut));
                owner.initialized = true;
                owner.projected = projected;
                owner.reference = result;
                return result;
            }
            const changes = [];
            if (prior.chat !== facts.chat)
                changes.push({ kind: 'scope', scope: 'chat', value: chat });
            if (owner.projected !== projected)
                for (const splice of projected.changes) {
                    changes.push({ ...splice, messages: splice.messages.map(message) });
                }
            const changed = new Set();
            let cursor = facts;
            while (cursor && cursor !== prior) {
                for (const seq of cursor.publishedMessages ?? [])
                    changed.add(seq);
                cursor = cursor.previous;
            }
            if (cursor !== prior) {
                // A restored DATA view can predate the current fold's local lineage.
                // Compare that closed view once and keep its existing base/tail chain.
                const previous = owner.view ?? createMvuScopeViewResolverV2({ read: deps.scopeStore.readObject }).resolve(owner.reference).view;
                changes.length = 0;
                if (!same(previous.scopes.chat, chat))
                    changes.push({ kind: 'scope', scope: 'chat', value: chat });
                const current = Array.from({ length: previous.messageCount }, (_, index) => previous.messageAt(index)), target = [...projected.messages.range()].map(message);
                const identity = (item) => JSON.stringify([item.nativeSeq, item.messageId,
                    item.messageVersionSha256, item.selectedVariant]);
                let prefix = 0, suffix = 0;
                while (prefix < current.length && prefix < target.length && identity(current[prefix]) === identity(target[prefix]))
                    prefix++;
                while (suffix < current.length - prefix && suffix < target.length - prefix
                    && identity(current[current.length - 1 - suffix]) === identity(target[target.length - 1 - suffix]))
                    suffix++;
                const point = (index, old) => {
                    const next = target[index];
                    if (!same(old, next))
                        changes.push({ kind: 'message-splice', index, deleteCount: 1, messages: [next] });
                };
                for (let index = 0; index < prefix; index++)
                    point(index, current[index]);
                if (current.length - prefix - suffix || target.length - prefix - suffix)
                    changes.push({ kind: 'message-splice', index: prefix,
                        deleteCount: current.length - prefix - suffix, messages: target.slice(prefix, target.length - suffix) });
                for (let offset = 0; offset < suffix; offset++)
                    point(target.length - suffix + offset, current[current.length - suffix + offset]);
                changed.clear();
            }
            for (const seq of changed) {
                const index = projected.messages.indexOfNativeSeq(seq);
                if (index === undefined)
                    continue;
                const item = projected.messages.at(index);
                changes.push({ kind: 'message-splice', index, deleteCount: 1, messages: [message(item)] });
            }
            const result = await owner.publisher.advance(source, changes, recordSha256(cut));
            owner.projected = projected;
            owner.reference = result;
            return result;
        };
        const result = owner.tail.then(action).catch(error => {
            if (scopePublishers.get(sid) === owner) {
                owner.publisher.dispose();
                owner.projection.dispose();
                scopePublishers.delete(sid);
            }
            throw error;
        });
        owner.tail = result.catch(() => { });
        return result;
    }
    function openingProjectionsForOpening(seed, original, ready, events, includeDisplay = false) {
        const snapshot = schemaOriginalSnapshot(original), material = schemaOriginalCompilationInput(original).source.material;
        const source = schemaScopeSource(snapshot), opening = seed.event, seq = opening.native.assistantSeq;
        const raw = events[seq];
        if (raw?.type !== 'assistant/message' || raw.data.message.id !== opening.native.messageId)
            fail('SCHEMA_SCOPE_OPENING_UNPROVEN');
        const versionSha256 = recordSha256(raw.data.message), owner = schemaScopeOwner(source, 'message', opening.native.messageId, seed.intent.sessionId);
        const final = ready.steps[openingPhaseCount(opening.plan) - 1], output = final.step.output;
        if (output.kind !== 'accepted')
            fail('SCHEMA_SCOPE_OPENING_UNPROVEN');
        const stateRef = { kind: 'opening', ownerSessionId: seed.intent.sessionId,
            recordKey: mvuInitializationEventKey(seed.intent.sessionId, opening.eventId), recordSha256: recordSha256(opening),
            valuesSha256: opening.valuesSha256, revision: 1 };
        const values = schemaScopePublished(owner, stateRef, opening.plan.values, output.context);
        const messages = new Map([[schemaScopeMessageKey(seed.intent.sessionId, seq, opening.native.messageId, versionSha256), values]]);
        // Original recovery already bound this checked epoch to the preparation.
        // Reuse its executed baseline while retaining the pending display projection.
        const load = schemaEpochExecution(ready.epoch).loadFrame;
        const scopes = { chat: load.scopeReadFrame.scopes.chat, messages,
            currentMessageCarrier: { kind: 'message', ownerSessionId: seed.intent.sessionId, nativeSeq: seq,
                messageId: opening.native.messageId, messageVersionSha256: versionSha256 },
            owners: [{ sessionId: seed.intent.sessionId, fromSeq: 0, throughSeq: null }],
            updateChat: schemaScopeConfiguration(snapshot, material).updateChat };
        // V8's accepted four-phase opening already owns the parsed v2 commands and
        // exact Native text. Share the scope's message hash and receipt's text hash.
        const display = includeDisplay && opening.plan.schemaVersion === 8
            ? acceptedMvuDisplayUpdate(seed.intent.sessionId, { seq, messageId: opening.native.messageId,
                versionSha256, narrativeSha256: opening.native.renderedSha256 }, 'native-mvu-update-v2') : undefined;
        return { scopes, displayUpdates: display ? [display] : [] };
    }
    function activationFor(sid, events, selected, subjectSid = sid) {
        const found = openingArchivesFor(subjectSid).readSeed(sid, selected);
        if (!found)
            return;
        const native = found.seed.event.native, message = events[native.assistantSeq], end = events[native.turnEndSeq];
        if (message?.type !== 'assistant/message' || message.data.message.id !== native.messageId
            || recordSha256(message) !== native.messageVersion.eventSha256 || end?.type !== 'turn/end'
            || end.data.turn !== native.turn || end.data.reason.kind !== 'completed')
            fail('OPENING_VARIANT_NATIVE_UNPROVEN');
        return { ...found, original: deps.source.readOpeningVariantOriginal(found.donor) };
    }
    function scopesForActivation(found, events) {
        const { seed, original, baseline, continuation } = found, native = seed.event.native, raw = events[native.assistantSeq], snapshot = schemaOriginalSnapshot(original), source = schemaScopeSource(snapshot, seed.sessionId);
        if (raw.type !== 'assistant/message')
            fail('OPENING_VARIANT_NATIVE_UNPROVEN');
        const versionSha256 = recordSha256(raw.data.message), stateRef = {
            kind: 'opening', ownerSessionId: seed.sessionId, recordKey: openingVariantActivationEventKey(seed.sessionId),
            recordSha256: recordSha256(seed.event), valuesSha256: seed.event.valuesSha256, revision: 1
        }, values = schemaScopePublished(schemaScopeOwner(source, 'message', native.messageId), stateRef, seed.event.values, seed.event.context), updateChat = schemaScopeConfiguration(snapshot, schemaEpochExecution(baseline.epoch).loadFrame.material).updateChat;
        let chat;
        if (updateChat)
            chat = schemaScopePublished(schemaScopeOwner(source, 'chat'), stateRef, seed.event.values, seed.event.context);
        else {
            const input = continuation.requested.frame.input, objects = new Map(baseline.scopeObjects.map(row => [
                JSON.stringify([row.ref.ownerSessionId, row.ref.key, row.ref.sha256]), row.object
            ])), historicalChat = input.scopeReadRef ? createMvuScopeViewResolverV2({ read: ref => objects.get(JSON.stringify([ref.ownerSessionId, ref.key, ref.sha256])) }).resolve(input.scopeReadRef).view.scopes.chat
                : input.scopeReadFrame.scopes.chat;
            chat = schemaScopeReowner(historicalChat, schemaScopeOwner(source, 'chat'));
        }
        return { chat, currentMessageCarrier: { kind: 'message', ownerSessionId: seed.sessionId, nativeSeq: native.assistantSeq,
                messageId: native.messageId, messageVersionSha256: versionSha256 },
            messages: new Map([[schemaScopeMessageKey(seed.sessionId, native.assistantSeq, native.messageId, versionSha256), values]]),
            owners: [{ sessionId: seed.sessionId, fromSeq: 0, throughSeq: null }],
            updateChat };
    }
    function scopesForDerived(genesis, events) {
        const recovered = genesis.inheritedReady && recoveredPrefixes.get(genesis.inheritedReady);
        let facts;
        if (recovered) {
            if (!recovered.scopes)
                fail('SCHEMA_SCOPE_PREFIX_UNPROVEN');
            facts = recovered.scopes;
        }
        else {
            const basis = validateMvuSchemaDerivedBasis(prefixInputs.branch.get(genesis.basisKey));
            if (basis.basisSha256 !== genesis.basisSha256 || basis.prepared.childSessionId !== genesis.sessionId) {
                fail('SCHEMA_SCOPE_PREFIX_UNPROVEN');
            }
            const prefix = basis.prepared.prefix, cached = scopePrefixes.get(prefix.prefixSha256);
            if (!cached || cached.nativePrefixSha256 !== prefix.journal.nativePrefixSha256
                || schemaNativeCutSha256(events, genesis.inheritedCut.nativeCut, deps.inputState.nativeHistory?.prefixes)
                    !== cached.nativePrefixSha256) {
                fail('SCHEMA_SCOPE_PREFIX_UNPROVEN');
            }
            facts = cached.facts;
        }
        const cut = genesis.inheritedCut.nativeCut;
        // Normal Native input claims extend the child's own log without changing
        // its published state identity. Parent tails cannot extend into that child.
        const ancestors = facts.owners.filter(range => range.fromSeq < cut).map(range => ({ ...range,
            throughSeq: range.throughSeq === null ? cut : Math.min(range.throughSeq, cut) }));
        return { ...facts, messages: new Map(facts.messages), currentMessageCarrier: null, owners: [...ancestors,
                { sessionId: genesis.sessionId, fromSeq: cut, throughSeq: null }] };
    }
    function displayForDerived(genesis, events) {
        try {
            const recovered = genesis.inheritedReady && recoveredPrefixes.get(genesis.inheritedReady);
            if (recovered)
                return recovered.displayUpdates.filter(item => item.canonical.seq < genesis.inheritedCut.nativeCut);
            const basis = validateMvuSchemaDerivedBasis(prefixInputs.branch.get(genesis.basisKey));
            if (basis.basisSha256 !== genesis.basisSha256 || basis.prepared.childSessionId !== genesis.sessionId)
                return [];
            const prefix = basis.prepared.prefix, cached = displayPrefixes.get(prefix.prefixSha256);
            const cut = genesis.inheritedCut.nativeCut;
            if (!cached || prefix.journal.nativeCut !== cut || cached.ownerSessionId !== prefix.sessionId
                || cached.nativePrefixSha256 !== prefix.journal.nativePrefixSha256
                || cached.nativePrefixSha256 !== genesis.inheritedCut.nativePrefixSha256
                || schemaNativeCutSha256(events, cut, deps.inputState.nativeHistory?.prefixes) !== cached.nativePrefixSha256)
                return [];
            return cached.updates.filter(item => item.canonical.seq < cut);
        }
        catch {
            return [];
        }
    }
    function clearDisplayPrefixes(sid) {
        for (const [key, entry] of displayPrefixes)
            if (entry.ownerSessionId === sid)
                displayPrefixes.delete(key);
    }
    function associationAt(sid, events, ready, index) {
        const step = journalStep(ready, index);
        if (!step)
            fail('SCHEMA_STORY_JOURNAL_UNPROVEN');
        const cut = step.completionMarker.seq + 1;
        if (('materialize' in ready ? ready.nativeCut !== events.length :
            ready.frozen.sessionId !== sid || ready.frozen.nativeCut !== events.length) || cut > events.length) {
            fail('SCHEMA_STORY_JOURNAL_UNPROVEN');
        }
        // The enclosing factual read already verified every journal row against
        // this actual Native prefix. Derive its earlier phase frontier from those
        // immutable steps; re-cloning all frames per phase adds no authority.
        const frontierSha256 = 'materialize' in ready ? ready.frontierAt(index + 1)
            : ready.frontierAt?.(index + 1) ?? schemaJournalFrontierSha256(ready.epochRef, ready.steps.slice(0, index + 1), ready.executionBaseline?.ref);
        if (isAuthorHostJournalReadyV5(ready))
            return { schemaVersion: 5, encoding: 'native-author-host-association-v5',
                sessionId: step.dispatch.sessionId, realmEpoch: ready.epoch.realmEpoch, batchId: step.dispatch.batchId,
                anchor: step.dispatch.sourceNativeCut.anchor, sourceNativeCutSha256: recordSha256(step.dispatch.sourceNativeCut),
                combinedProgramSha256: ready.epoch.program.combinedProgramSha256,
                serverProgramSha256: ready.epoch.program.serverProgram.programSha256, epoch: ready.epochRef,
                dispatch: step.dispatchRef, completion: step.completionRef, dispatchMarker: step.dispatchMarker,
                completionMarker: step.completionMarker, serverTailSha256: step.step.stepSha256,
                hostFrontierSha256: frontierSha256, outputSha256: recordSha256(step.step.output) };
        return { schemaVersion: 1, encoding: 'native-mvu-schema-execution-association-v1', sessionId: step.dispatch.sessionId,
            realmEpoch: ready.epoch.realmEpoch, batchId: step.dispatch.batchId, anchor: step.dispatch.sourceNativeCut.anchor,
            sourceNativeCutSha256: recordSha256(step.dispatch.sourceNativeCut), programSha256: schemaEpochAuthorIdentity(ready.epoch).programSha256,
            dispatch: step.dispatchRef, completion: step.completionRef, dispatchMarker: step.dispatchMarker,
            completionMarker: step.completionMarker, tailSha256: step.step.stepSha256, frontierSha256,
            outputSha256: recordSha256(step.step.output) };
    }
    function verifyStoryBrowserJournal(event, ready) {
        if (!('browser' in event) || !event.browser)
            return;
        const entries = ready.entries ?? ready.steps;
        for (const hook of event.browser.hooks) {
            let low = 0, high = entries.length;
            while (low < high) {
                const middle = (low + high) >>> 1;
                if (entries.at(middle).dispatchMarker.seq < hook.journal.dispatchMarker.seq)
                    low = middle + 1;
                else
                    high = middle;
            }
            const actual = entries.at(low);
            if (!actual || !isSchemaBrowserFacts(actual) || !same(actual.dispatchRef, hook.journal.dispatchRef)
                || !same(actual.completionRef, hook.journal.completionRef) || !same(actual.dispatchMarker, hook.journal.dispatchMarker)
                || !same(actual.completionMarker, hook.journal.completionMarker)
                || actual.dispatch.recordSha256 !== hook.journal.dispatch.recordSha256
                || actual.completion.recordSha256 !== hook.journal.completion.recordSha256
                || hook.frontier.tailSha256 !== actual.dispatch.previousTailSha256
                || hook.frontier.frontierSha256 !== ready.entryFrontierAt?.(low + 1))
                fail('SCHEMA_BROWSER_HISTORY_UNPROVEN');
            if ('materialize' in ready)
                ready.entryFact?.(low)?.use();
        }
    }
    function eventRows(sid, nativeCut, ledger, afterNativeCut) {
        const prefix = `${sid}__mvu-state-schema-`;
        const include = (key, row) => {
            if (!key.startsWith(`${prefix}story-event-`) && !key.startsWith(`${prefix}player-event-`)
                && !key.startsWith(`${prefix}revision-event-`) && !key.startsWith(`${prefix}opening-variant-event-`))
                return false;
            const cut = row?.frontier?.nativeCut;
            // Select the existing Native interval before frozen recording detaches
            // a row. Malformed selected DATA still reaches its original parser.
            return cut === undefined || !Number.isSafeInteger(cut) || cut < 0
                || cut <= nativeCut && (afterNativeCut === undefined || cut > afterNativeCut);
        };
        const rows = [...prefixInputs.status.entries(prefix, include)]
            .filter(([key]) => key.startsWith(`${sid}__mvu-state-schema-story-event-`)
            || key.startsWith(`${sid}__mvu-state-schema-player-event-`)
            || key.startsWith(`${sid}__mvu-state-schema-revision-event-`)
            || key.startsWith(`${sid}__mvu-state-schema-opening-variant-event-`))
            .map(([key, row]) => {
            if (key.startsWith(`${sid}__mvu-state-schema-opening-variant-event-`))
                return { key, event: validateOpeningVariantReplacementEvent(row) };
            if (key.startsWith(`${sid}__mvu-state-schema-revision-event-`))
                return { key, event: historyRecords.revision(key, row) };
            if (!key.startsWith(`${sid}__mvu-state-schema-player-event-`))
                return { key, event: historyRecords.story(key, row) };
            if (!ledger)
                return { key, event: historyRecords.player(key, row) };
            // The nested InputState ledger read owns these exact Domain rows and
            // their completion join. This synchronous fold consumes its result.
            const playerFacts = ledger.completedByEventKey.get(key);
            if (!playerFacts)
                fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
            return { key, event: playerFacts.event, playerFacts };
        })
            .filter(item => item.event.frontier.nativeCut <= nativeCut
            && (afterNativeCut === undefined || item.event.frontier.nativeCut > afterNativeCut))
            .sort((a, b) => a.event.phases[0].association.dispatchMarker.seq - b.event.phases[0].association.dispatchMarker.seq);
        return rows;
    }
    function openingVariantClosure(event) {
        const plan = prefixInputs.branch.get(openingVariantReplacementPlanKey(event.sessionId, event.plan.operationId)), set = validateOpeningVariantSet(prefixInputs.branch.get(event.plan.setRef.key)), completion = prefixInputs.branch.get(openingVariantReplacementCompletionKey(event.sessionId, event.plan.operationId));
        if (!same(plan, event.plan) || recordSha256(set) !== event.plan.setRef.sha256
            || !same(completion, openingVariantReplacementCompletion(event)))
            fail('OPENING_VARIANT_HISTORY_UNPROVEN');
        return { plan, setRef: event.plan.setRef, event, completion };
    }
    function closedStoryFacts(sid, inheritedEventCount, events, event, frozen) {
        if (frozen) {
            const facts = readMvuSchemaInheritedStoryFacts({ ownerSessionId: sid, ownerInheritedEventCount: inheritedEventCount,
                events, event }, { branch: prefixInputs.branch, status: prefixInputs.status, editProtocol: deps.editProtocol,
                readProjectedCanonical: (prefix, turn) => {
                    const surface = deps.projectPrefix(prefix);
                    const body = canonicalAssistantForTurn({ id: 'schema-inherited-prefix', events: prefix,
                        surface: { nodes: surface.nodes }, deriveEventMessage: entry => surface.projectedMessageAt(entry.seq) }, turn);
                    const message = body?.data?.message;
                    return body && message && typeof message.id === 'string' ? { seq: body.seq, messageId: message.id,
                        versionSha256: recordSha256(message), narrative: textOf(message.content) } : undefined;
                } });
            return { terminal: facts.terminal, event, settlement: facts.settlement };
        }
        const plan = event.plan, scope = plan.scope;
        const terminal = readInputCompletion(prefixInputs.branch, sid, scope.currency.preparationId);
        const settlement = validateMvuSchemaStorySettlement(prefixInputs.status.get(mvuSchemaStorySettlementKey(sid, plan.planSha256)), event);
        if (!terminal || terminal.status !== 'settled' || terminal.plan.kind !== 'schema-numerical'
            || !same(terminal.scope, scope) || !same(terminal.plan.plan, plan) || !same(terminal.settlement, settlement)
            || !deps.verifyConsumedScope(scope) || !deps.verifyNative(scope)
            || !inputSnapshotReferenceCurrent(prefixInputs.branch, sid, scope.currency))
            fail('SCHEMA_STORY_TERMINAL_UNRESOLVED');
        const canonical = deps.readConsumedCanonical(sid, plan.canonical.seq, scope.receipt.checkpoint.actualTurn, scope.receipt.turnEndSeq);
        if (!canonical || !same(plan.canonical, { ...canonical, narrativeSha256: sha256(canonical.narrative) }))
            fail('SCHEMA_STORY_CANONICAL_UNPROVEN');
        return { terminal, event, settlement };
    }
    function prepareRevisionBases(ownerSid, events, table = prefixInputs.status, subjectSid = ownerSid, readContext = prefixInputs.createReadContext(subjectSid)) {
        const bases = new Map();
        // Native rewind leaves one suffix at this level. Its baseline already
        // folds any retained earlier revision, so recovering older bases here
        // would reconstruct the same history again.
        for (let index = events.length - 1; index >= 0; index--) {
            const marker = events[index];
            if (marker.type !== deps.markers.revisionEventType || marker.data.sessionId !== ownerSid)
                continue;
            const descriptor = validateMvuSchemaStoryRevisionDescriptor(table.get(marker.data.descriptor.key));
            if (descriptor.schemaVersion === 1 || descriptor.sessionId !== ownerSid)
                continue;
            const basis = validateMvuSchemaStoryRevisionBasis(table.get(descriptor.basis.record.key));
            if (recordSha256(descriptor) !== marker.data.descriptor.sha256
                || recordSha256(basis) !== descriptor.basis.record.sha256 || basis.sessionId !== descriptor.sessionId
                || basis.prefix.prefixSha256 !== descriptor.basis.prefixSha256
                || basis.prefix.snapshot.stateSnapshotSha256 !== descriptor.basis.stateSnapshotSha256
                || basis.prefix.journal.nativeCut !== descriptor.basis.nativeCut
                || !same(basis.historyBasis, descriptor.basis.historyBasis)
                || !same(basis.closedRevision, descriptor.basis.closedRevision))
                fail('SCHEMA_REVISION_BASE_UNPROVEN');
            const recovered = deps.recoverRevisionPrefix?.({ subjectSessionId: subjectSid,
                events: events.slice(0, basis.prefix.journal.nativeCut), ...basis, readContext });
            if (!recovered)
                fail('SCHEMA_REVISION_BASE_UNPROVEN');
            bases.set(marker.data.descriptor.sha256, { descriptor, ...recovered });
            break;
        }
        return bases;
    }
    function suffixAuthorization(authorization, sessionId, events, beforeMarkerSeq, completedV4) {
        const edit = events[authorization.edit.seq], { proof } = authorization;
        if (edit?.type !== 'roleplay/message-edit' || edit.data.role !== 'user')
            fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
        if (proof.kind === 'intent') {
            const intent = validateSchemaTaskEditIntent(prefixInputs.status.get(proof.intent.key)), binding = validateSchemaTaskEditBindingV1(prefixInputs.status.get(proof.binding.key));
            if (intent.sessionId !== sessionId || binding.sessionId !== sessionId || intent.target.role !== 'user'
                || proof.intent.key !== schemaTaskEditIntentKey(sessionId, intent.operationId)
                || proof.binding.key !== schemaTaskEditBindingKey(sessionId, intent.operationId)
                || recordSha256(intent) !== proof.intent.sha256 || recordSha256(binding) !== proof.binding.sha256
                || !same(binding.intent, proof.intent) || binding.edit.seq !== intent.basis.nativeCut
                || !same(binding.edit, authorization.edit) || binding.edit.seq >= beforeMarkerSeq
                || edit.data.targetSeq !== intent.target.seq || edit.data.messageId !== intent.target.messageId
                || edit.data.text !== intent.target.text)
                fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
        }
        else if (proof.kind === 'post-commit-recovery') {
            const intent = validateSchemaExistingUserEditRecoveryIntentV1(prefixInputs.status.get(proof.intent.key));
            if (intent.sessionId !== sessionId || proof.intent.key !== schemaExistingUserEditRecoveryIntentKey(sessionId, intent.operationId)
                || recordSha256(intent) !== proof.intent.sha256 || !same(intent.edit, authorization.edit)
                || recordSha256(edit) !== intent.edit.sha256 || intent.edit.seq >= intent.fence.nativeCut
                || intent.fence.nativeCut > beforeMarkerSeq)
                fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
            // Source is fenced by the live recovery publisher. The retained proof
            // authorizes this exact Native edit across later completed revisions.
            const save = readWorldlinePlayerSaveIntent(prefixInputs.branch, intent.save);
            assertWorldlinePlayerSaveRequest(save, sessionId, intent.requestOrigin, edit.data.text);
        }
        else {
            const receipt = completedV4(proof), prior = receipt.userEdits.get(authorization.edit.seq);
            if (receipt.descriptor.sessionId !== sessionId || receipt.markerSeq >= beforeMarkerSeq || receipt.lastCompletionSeq >= beforeMarkerSeq
                || !prior || prior.role !== 'user' || prior.sha256 !== authorization.edit.sha256
                || prior.targetSeq !== edit.data.targetSeq || prior.messageId !== edit.data.messageId)
                fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
        }
    }
    function revisionClosureV2(event, events, ready, bases, owners, completedV4) {
        const ref = event.plan.revision.descriptor, selected = bases.get(ref.sha256);
        if (!selected)
            fail('SCHEMA_REVISION_BASE_UNPROVEN');
        const descriptor = validateMvuSchemaStoryRevisionDescriptor(prefixInputs.status.get(ref.key));
        const completion = validateMvuSchemaStoryRevisionCompletion(prefixInputs.status.get(mvuSchemaStoryRevisionCompletionKey(event.sessionId, ref.sha256)));
        const marker = ready.frozen.schemaVersion !== 1 && ready.frozen.revisions.find(row => row.descriptor.key === ref.key && row.descriptor.sha256 === ref.sha256);
        if (completion.schemaVersion !== descriptor.schemaVersion || !same(descriptor, selected.descriptor) || !same(completion.descriptor, ref)
            || completion.sessionId !== event.sessionId || completion.events.length !== descriptor.originals.length
            || !marker || marker.editSeq !== descriptor.edits.at(-1).seq
            || marker.completionSeq !== descriptor.completionSeq)
            fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
        const projection = deps.projectPrefix(events.slice(0, descriptor.edits.at(-1).seq + 1));
        for (const edit of descriptor.edits) {
            const raw = events[edit.seq], target = events[edit.targetSeq];
            const expectedRole = 'role' in edit ? edit.role : 'assistant';
            if (raw?.type !== 'roleplay/message-edit' || recordSha256(raw) !== edit.sha256 || raw.data.targetSeq !== edit.targetSeq
                || raw.data.role !== expectedRole || (expectedRole === 'assistant'
                ? target?.type !== 'assistant/message' || target.data.message.id !== edit.messageId
                : target?.type !== 'user/message' || target.data.id !== edit.messageId))
                fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
        }
        if (descriptor.schemaVersion === 5) {
            const users = new Map(descriptor.edits.filter(edit => edit.role === 'user').map(edit => [edit.seq, edit.sha256]));
            if (users.size !== descriptor.authorizations.length)
                fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
            for (const authorization of descriptor.authorizations) {
                if (users.get(authorization.edit.seq) !== authorization.edit.sha256)
                    fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
                suffixAuthorization(authorization, descriptor.sessionId, events, marker.marker.seq, completedV4);
                users.delete(authorization.edit.seq);
            }
        }
        const originalEntries = suffixOriginals(descriptor);
        const originals = originalEntries.map(entry => {
            const originalRef = entry.event, raw = prefixInputs.status.get(originalRef.key);
            const originalEvent = entry.kind === 'manual' ? validateMvuSchemaPlayerEvent(raw)
                : validateMvuSchemaStoryEvent(raw);
            if (recordSha256(originalEvent) !== originalRef.sha256)
                fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
            const owner = originalEvent.sessionId, range = owners.find(row => row.sessionId === owner);
            if (!range)
                fail('SCHEMA_SCOPE_MESSAGE_OWNER_UNPROVEN');
            if (originalEvent.encoding === 'native-mvu-schema-player-event-v1') {
                return joinMvuSchemaPlayerCompletedEvent(prefixInputs.branch, prefixInputs.status, originalEvent, events.slice(0, originalEvent.frontier.nativeCut));
            }
            return closedStoryFacts(owner, range.fromSeq, events.slice(0, originalEvent.frontier.nativeCut), originalEvent, true);
        });
        let base = selected.prefix.snapshot;
        const revised = completion.events.map((eventRef, index) => {
            const item = readRevisionEvent(prefixInputs.status.get(eventRef.key));
            const original = originals[index].event;
            if (!isSuffixEvent(item) || recordSha256(item) !== eventRef.sha256
                || eventRef.key !== mvuSchemaStoryRevisionEventKey(item.sessionId, item.eventId)
                || !same(item.plan.revision.descriptor, ref) || item.plan.revision.index !== index
                || item.plan.revision.publicationRevision !== descriptor.publicationRevision + index
                || item.plan.logicalNativeCut !== original.plan.initialCut.nativeCut
                || !same(item.plan.base, base) || item.sessionId !== descriptor.sessionId
                || item.sourceSha256 !== descriptor.sourceSha256)
                fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
            if (isManualRevision(item)) {
                if (original.encoding !== 'native-mvu-schema-player-event-v1'
                    || !same(item.plan.original, originalEntries[index].event)
                    || !same(item.plan.operation, original.plan.operation) || !same(item.plan.marker, original.plan.marker)
                    || item.plan.clockEpochMs !== original.plan.clockEpochMs)
                    fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
            }
            else {
                if (original.encoding === 'native-mvu-schema-player-event-v1' || item.outcome === 'refused')
                    fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
                const target = events[original.plan.canonical.seq];
                if (target?.type !== 'assistant/message')
                    fail('SCHEMA_REVISION_CANONICAL_UNPROVEN');
                const message = projection.projectedMessageAt(target.seq) ?? target.data.message;
                const canonical = { seq: target.seq, messageId: original.plan.canonical.messageId, versionSha256: recordSha256(message),
                    narrative: textOf(message.content), narrativeSha256: sha256(textOf(message.content)) };
                if (!same(item.plan.scope, original.plan.scope) || !same(item.plan.canonical, canonical))
                    fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
                if (item.plan.schemaVersion === 11) {
                    if (descriptor.schemaVersion !== 4)
                        fail('SCHEMA_TASK_EDIT_INTENT_UNPROVEN');
                    const selected = descriptor.taskEdits.find(row => row.index === index)?.selection;
                    if (!selected || !same(selected, item.plan.taskEdit))
                        fail('SCHEMA_TASK_EDIT_INTENT_UNPROVEN');
                    const intent = validateSchemaTaskEditIntentV1(prefixInputs.status.get(selected.intent.key)), binding = validateSchemaTaskEditBindingV1(prefixInputs.status.get(selected.binding.key)), operation = intent.artifacts.find(row => row.canonicalSeq === canonical.seq), edit = events[binding.edit.seq];
                    if (recordSha256(intent) !== selected.intent.sha256 || recordSha256(binding) !== selected.binding.sha256
                        || !same(binding.intent, selected.intent) || binding.sessionId !== descriptor.sessionId
                        || !operation || !same(operation.artifact, { canonicalSeq: selected.canonicalSeq,
                        originEventRef: selected.originEventRef, sourceEventRef: selected.sourceEventRef, effectiveKind: selected.effectiveKind })
                        || operation.mode !== selected.mode
                        || binding.edit.seq !== intent.basis.nativeCut || edit?.type !== 'roleplay/message-edit'
                        || recordSha256(edit) !== binding.edit.sha256 || edit.data.text !== intent.target.text
                        || edit.data.targetSeq !== intent.target.seq || edit.data.role !== intent.target.role
                        || !descriptor.edits.some(row => row.seq === edit.seq && row.sha256 === binding.edit.sha256)
                        || !same(selected.originEventRef, originalEntries[index].event))
                        fail('SCHEMA_TASK_EDIT_INTENT_UNPROVEN');
                    const sourceRaw = prefixInputs.status.get(selected.sourceEventRef.key);
                    const sourceEvent = sourceRaw?.encoding === 'native-mvu-schema-story-event-v2'
                        ? validateMvuSchemaStoryEvent(sourceRaw) : validateMvuSchemaStoryRevisionEvent(sourceRaw);
                    if (recordSha256(sourceEvent) !== selected.sourceEventRef.sha256 || sourceEvent.frontier.nativeCut > intent.basis.nativeCut
                        || sourceEvent.outcome === 'refused' || sourceEvent.plan.canonical.seq !== selected.canonicalSeq
                        || selected.mode === 'retain' && !same(item.plan.candidate, sourceEvent.plan.candidate)
                        || (sourceEvent.plan.schemaVersion === 10 || sourceEvent.plan.schemaVersion === 12 ? !same(selected.originEventRef, selected.sourceEventRef)
                            || schemaStoryMaintenanceSource(sourceEvent.plan)?.kind !== 'task-result'
                            : sourceEvent.plan.schemaVersion !== 11 || !same(sourceEvent.plan.taskEdit.originEventRef, selected.originEventRef)))
                        fail('SCHEMA_TASK_EDIT_ARTIFACT_UNPROVEN');
                    const sourcePlan = sourceEvent.plan, kind = sourcePlan.schemaVersion === 11 && sourcePlan.taskEdit.mode === 'clear' ? 'cleared'
                        : sourcePlan.schemaVersion === 11 && sourcePlan.taskEdit.mode === 'retain' ? sourcePlan.taskEdit.effectiveKind
                            : sourcePlan.candidate.kind === 'parsed' ? 'patch' : 'unchanged';
                    if (selected.effectiveKind !== kind)
                        fail('SCHEMA_TASK_EDIT_ARTIFACT_UNPROVEN');
                    const pins = [...mvuSchemaStoryExecutionPhases(sourceEvent).map(phase => phase.association),
                        ...sourceEvent.browser?.hooks.map(hook => hook.journal) ?? []];
                    for (const pin of pins)
                        if (recordSha256(events[pin.dispatchMarker.seq]) !== pin.dispatchMarker.sha256
                            || recordSha256(events[pin.completionMarker.seq]) !== pin.completionMarker.sha256)
                            fail('SCHEMA_TASK_EDIT_ARTIFACT_UNPROVEN');
                }
                else if (original.outcome !== 'refused' && schemaStoryMaintenanceSource(original.plan)?.kind === 'task-result') {
                    fail('SCHEMA_MAINTENANCE_REVISION_REQUIRED');
                }
            }
            const head = suffixHead(item);
            base = snapshot({ schemaVersion: 2, encoding: 'native-mvu-schema-state-snapshot-v2', sessionId: item.sessionId,
                sourceSha256: item.sourceSha256, root: item.plan.execution.root, currentHead: head, revision: head.revision,
                headSha256: recordSha256(head), values: item.values, valuesSha256: item.valuesSha256,
                context: item.context, schemaFrontier: item.frontier });
            return item;
        });
        if (!same(revised[event.plan.revision.index], event))
            fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
        return { descriptor, completion, originals, events: revised, projection };
    }
    function consume(sid, inheritedEventCount, events, ready, initial, ordinal, frozen = false, scopeSeed, original, readOnlyTail = false, includeDisplay = false, displaySeed, ledger, reconcileOriginalPlanSha256, revisionBases = new Map(), resolvedSeed, lastTaskResultSeed, artifactSeed, lastSettledStorySeed, authorizationSeed, authorizationCandidates, inventoryOverride, settledMessageSeed, closedStorySeed) {
        const reset = [...revisionBases.values()].at(-1);
        const restored = reset && recoveredPrefixes.get(reset.ready);
        if (reset && !restored)
            fail('SCHEMA_REVISION_BASE_UNPROVEN');
        if (reset) {
            // Keep the frozen prefix's original seed/initial intact. Only this
            // numerical fold moves to the explicit revision baseline.
            prefixInputs.status.get(reset.descriptor.basis.record.key);
            ordinal = reset.ready.steps.length;
            if (restored.scopes)
                scopeSeed = { ...restored.scopes, owners: scopeSeed?.owners ?? restored.scopes.owners };
        }
        const inventory = inventoryOverride ?? eventRows(sid, events.length, ledger, reset?.prefix.journal.nativeCut);
        let root = reset?.prefix.snapshot.root ?? initial.root;
        const consumed = new Map(reset?.prefix.consumed.map(row => [row.planSha256, row.closureSha256]));
        // A frozen prefix indexes every consumed closure, including an original
        // Story whose immutable terminal remains required after revision rewind.
        const eventKeys = [...reset?.prefix.eventKeys ?? []];
        const settledMessages = new Map(restored?.settledMessages ?? settledMessageSeed);
        let lastTaskResultCanonicalSeq = restored?.lastTaskResultCanonicalSeq ?? lastTaskResultSeed;
        let lastSettledStoryCanonicalSeq = restored?.lastSettledStoryCanonicalSeq ?? lastSettledStorySeed;
        let lastClosedStoryCanonicalSeq = restored?.lastClosedStoryCanonicalSeq ?? closedStorySeed;
        const userEditAuthorizations = new Map(restored?.userEditAuthorizations ?? authorizationSeed);
        const taskArtifacts = new Map(restored?.taskArtifacts ?? artifactSeed);
        const effectiveBatches = new Set(ready.steps.map(step => step.dispatch.batchId));
        const resolvedEdits = new Set(reset ? restored?.resolvedEdits : resolvedSeed);
        const supersededBatches = frozen && ready.frozen.schemaVersion !== 1
            ? new Set(ready.frozen.revisions.flatMap(revision => revision.superseded.map(pair => pair.batchId))) : undefined;
        const closedStories = new Map();
        const revisionClosures = new Map();
        let receiptIndexes;
        const receiptInputs = () => {
            if (receiptIndexes)
                return receiptIndexes;
            const revisions = ready.frozen.schemaVersion !== 1 ? ready.frozen.revisions : [], markers = new Map(revisions.map(row => [row.descriptor.key, row])), pairs = new Map();
            for (const active of ready.steps)
                pairs.set(active.dispatchRef.key, { batchId: active.dispatch.batchId,
                    dispatch: active.dispatchRef, completion: active.completionRef, dispatchMarker: active.dispatchMarker,
                    completionMarker: active.completionMarker, active });
            for (const revision of revisions)
                for (const pair of revision.superseded)
                    if (!pairs.has(pair.dispatch.key))
                        pairs.set(pair.dispatch.key, pair);
            return receiptIndexes = { markers, pairs, records: new Map(ready.frozen.records.map(row => [row.key, row.record])) };
        };
        const completedV4 = (proof) => {
            const existing = revisionClosures.get(proof.descriptor.sha256);
            if (existing?.receipt) {
                if (!same(existing.receipt.descriptorRef, proof.descriptor) || !same(existing.receipt.completionRef, proof.completion))
                    fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
                return existing.receipt;
            }
            const index = receiptInputs(), marker = index.markers.get(proof.descriptor.key);
            if (!marker || marker.descriptor.sha256 !== proof.descriptor.sha256)
                fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
            const descriptor = validateMvuSchemaStoryRevisionDescriptor(marker.descriptor.value), completion = validateMvuSchemaStoryRevisionCompletion(prefixInputs.status.get(proof.completion.key));
            if (descriptor.schemaVersion !== 4 || completion.schemaVersion !== 4
                || proof.descriptor.key !== mvuSchemaStoryRevisionDescriptorKey(descriptor.sessionId, recordSha256({
                    encoding: 'native-mvu-schema-story-revision-request-v2', edits: descriptor.edits
                }))
                || proof.completion.key !== mvuSchemaStoryRevisionCompletionKey(descriptor.sessionId, proof.descriptor.sha256)
                || recordSha256(completion) !== proof.completion.sha256 || !same(completion.descriptor, proof.descriptor)
                || completion.sessionId !== descriptor.sessionId || completion.events.length !== descriptor.originals.length
                || !completion.events.length || marker.editSeq !== descriptor.edits.at(-1).seq
                || marker.completionSeq !== descriptor.completionSeq)
                fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
            let lastCompletionSeq = marker.marker.seq;
            for (const [eventIndex, ref] of completion.events.entries()) {
                const item = readRevisionEvent(prefixInputs.status.get(ref.key));
                if (!isSuffixEvent(item) || recordSha256(item) !== ref.sha256
                    || ref.key !== mvuSchemaStoryRevisionEventKey(item.sessionId, item.eventId)
                    || !same(item.plan.revision.descriptor, proof.descriptor) || item.plan.revision.index !== eventIndex
                    || item.plan.revision.publicationRevision !== descriptor.publicationRevision + eventIndex
                    || item.sessionId !== descriptor.sessionId || item.sourceSha256 !== descriptor.sourceSha256
                    || !isManualRevision(item) && item.outcome === 'refused')
                    fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
                for (const phase of item.phases) {
                    const association = phase.association, pair = index.pairs.get(association.dispatch.key);
                    if (!pair || pair.batchId !== association.batchId || !same(pair.dispatch, association.dispatch)
                        || !same(pair.completion, association.completion) || !same(pair.dispatchMarker, association.dispatchMarker)
                        || !same(pair.completionMarker, association.completionMarker)
                        || pair.dispatchMarker.seq <= marker.marker.seq)
                        fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
                    if (pair.active) {
                        if (!same(pair.active.step.frame.input, phase.input) || !same(pair.active.step.output, phase.output)
                            || !same(pair.active.dispatch.sourceNativeCut.anchor, association.anchor)
                            || recordSha256(pair.active.dispatch.sourceNativeCut) !== association.sourceNativeCutSha256)
                            fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
                    }
                    else {
                        // These rows were parsed by Journal. A superseded pair still needs
                        // its finite receipt cross-bindings, not an old Source/VM replay.
                        const dispatch = index.records.get(pair.dispatch.key), completion = index.records.get(pair.completion.key), native = events[pair.completionMarker.seq];
                        if (!dispatch || !('requestedStep' in dispatch) || !completion || !('step' in completion)
                            || dispatch.recordSha256 !== pair.dispatch.sha256 || completion.recordSha256 !== pair.completion.sha256
                            || dispatch.sessionId !== descriptor.sessionId || completion.sessionId !== descriptor.sessionId
                            || dispatch.realmEpoch !== association.realmEpoch || completion.realmEpoch !== association.realmEpoch
                            || dispatch.batchId !== pair.batchId || completion.batchId !== pair.batchId
                            || !same(completion.dispatch, pair.dispatch) || !same(completion.dispatchMarker, pair.dispatchMarker)
                            || dispatch.sourceNativeCut.nativeCut !== pair.dispatchMarker.seq
                            || !same(dispatch.sourceNativeCut.anchor, association.anchor)
                            || recordSha256(dispatch.sourceNativeCut) !== association.sourceNativeCutSha256
                            || !same(dispatch.requestedStep.frame.input, phase.input) || !same(completion.step.output, phase.output)
                            || completion.step.eventId !== dispatch.requestedStep.eventId
                            || completion.step.stepSha256 !== schemaExecutionServerTailSha256(association)
                            || native?.type !== deps.markers.completionEventType
                            || native.data.completedTailSha256 !== completion.step.stepSha256)
                            fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
                    }
                    lastCompletionSeq = Math.max(lastCompletionSeq, pair.completionMarker.seq);
                }
            }
            const userEdits = new Map();
            for (const edit of descriptor.edits)
                if (edit.role === 'user')
                    userEdits.set(edit.seq, edit);
            const receipt = { descriptor, completion, descriptorRef: proof.descriptor, completionRef: proof.completion,
                markerSeq: marker.marker.seq, lastCompletionSeq, userEdits };
            revisionClosures.set(proof.descriptor.sha256, { ...existing, receipt, joinedEvents: existing?.joinedEvents ?? 0 });
            return receipt;
        };
        const revisionClosure = (event) => {
            const id = event.plan.revision.descriptor.sha256;
            let entry = revisionClosures.get(id);
            if (!entry?.closure) {
                if (!scopeSeed)
                    fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                const closure = revisionClosureV2(event, events, ready, revisionBases, scopeSeed.owners, completedV4);
                entry = { ...entry, closure, joinedEvents: entry?.joinedEvents ?? 0 };
                revisionClosures.set(id, entry);
            }
            return entry.closure;
        };
        const closedStory = (event) => {
            let facts = closedStories.get(event.plan.planSha256);
            if (!facts) {
                // A revised Story retains its immutable completion closure. Prove that
                // closure at its own completed prefix; the revision's edited canonical
                // remains bound to the full current prefix below.
                // Only the last-Story edit owner may recover its original closure
                // before a malformed saved edit has produced any revision marker.
                // Ordinary historical/fork readers still consume the full prefix.
                const closureEvents = supersededBatches?.has(event.phases[0].association.batchId)
                    || event.plan.planSha256 === reconcileOriginalPlanSha256
                    || typeof reconcileOriginalPlanSha256 !== 'string' && reconcileOriginalPlanSha256?.has(event.plan.planSha256)
                    ? events.slice(0, event.frontier.nativeCut) : events;
                facts = closedStoryFacts(sid, inheritedEventCount, closureEvents, event, frozen);
                closedStories.set(event.plan.planSha256, facts);
            }
            return facts;
        };
        const rows = [], partial = [];
        for (const row of inventory) {
            const event = row.event;
            if (event.encoding === 'native-mvu-schema-story-event-v2'
                && event.outcome !== 'refused' && schemaStoryMaintenanceSource(event.plan)?.kind === 'task-result') {
                lastTaskResultCanonicalSeq = Math.max(lastTaskResultCanonicalSeq ?? -1, event.plan.canonical.seq);
            }
            if (!effectiveBatches.has(event.phases[0].association.batchId)) {
                if (event.encoding === 'native-mvu-schema-story-event-v2') {
                    consumed.set(event.plan.planSha256, recordSha256(closedStory(event)));
                    eventKeys.push(row.key);
                }
                continue;
            }
            if (readOnlyTail) {
                const closed = event.encoding === 'native-mvu-schema-story-revision-event-v1' || isSuffixEvent(event) ? true :
                    isOpeningVariantEvent(event)
                        ? prefixInputs.branch.get(openingVariantReplacementCompletionKey(sid, event.plan.operationId)) !== undefined :
                        event.encoding === 'native-mvu-schema-player-event-v1'
                            ? prefixInputs.branch.get(mvuSchemaPlayerCompletionKey(sid, event.plan.operation.operationId)) !== undefined
                            : readInputCompletion(prefixInputs.branch, sid, event.plan.scope.currency.preparationId)?.status === 'settled';
                if (!closed) {
                    partial.push(row);
                    continue;
                }
            }
            if (partial.length)
                fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
            rows.push(row);
        }
        let state = reset?.prefix.snapshot ?? initial;
        let chat = scopeSeed?.chat;
        const messageStates = scopeSeed ? new Map(scopeSeed.messages) : undefined;
        const messageIndex = scopeSeed ? numericalIndex(scopeSeed.messages) : undefined;
        let scopeCursor = scopeSeed && messageIndex ? { ...scopeSeed, messages: messageIndex.view() } : undefined;
        const semantic = scopeRefAvailable(ready) ? scopeSemantic({ id: sid }, events) : undefined;
        const displayUpdates = includeDisplay ? [] : undefined;
        const playerFacts = (row) => {
            if (row.event.encoding !== 'native-mvu-schema-player-event-v1')
                fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
            // Keep the parsed event and its closure only in this synchronous fold.
            // Future cuts and partial tails were filtered before any closure join.
            return row.playerFacts ??= joinMvuSchemaPlayerCompletedEvent(prefixInputs.branch, prefixInputs.status, row.event, events);
        };
        for (const event of events)
            if (event.type === 'roleplay/mvu-manual-edit'
                && event.seq >= Math.max(inheritedEventCount, reset?.prefix.journal.nativeCut ?? 0) && event.data.sessionId === sid) {
                const operation = prefixInputs.branch.get(mvuSchemaPlayerOperationKey(sid, event.data.operationId));
                if (operation === undefined)
                    fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
                if (frozen && !readOnlyTail) {
                    const row = inventory.find(row => row.event.encoding === 'native-mvu-schema-player-event-v1'
                        && row.event.plan.operation.operationId === event.data.operationId);
                    if (!row)
                        fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
                    playerFacts(row);
                }
            }
        for (const row of rows) {
            const { key, event } = row;
            const plan = event.plan, base = 'operation' in plan && plan.schemaVersion !== 9 ? plan.operation.base : plan.base;
            // Accepted plans retain their parsed frame DATA and journal/closure bindings.
            // Current Source belongs to captureFrame; do not rebuild each historical Source.
            const eventKey = isOpeningVariantEvent(event) ? openingVariantReplacementEventKey(sid, event.eventId) :
                event.encoding === 'native-mvu-schema-player-event-v1'
                    ? mvuSchemaPlayerEventKey(sid, event.eventId) : event.encoding === 'native-mvu-schema-story-revision-event-v1' || isSuffixEvent(event)
                    ? mvuSchemaStoryRevisionEventKey(sid, event.eventId) : mvuSchemaStoryEventKey(sid, event.eventId);
            if (key !== eventKey || !same(base.root, root)
                || !same(base, snapshot({ ...state, sourceSha256: base.sourceSha256 })))
                fail('SCHEMA_STORY_BASE_CHAIN_INVALID');
            if (event.encoding === 'native-mvu-schema-player-event-v1' && event.plan.operation.request.target
                && !schemaScopeMessageTargetEqual(event.plan.operation.request.target, scopeCursor?.currentMessageCarrier)) {
                fail('SCHEMA_MESSAGE_TARGET_UNPROVEN');
            }
            let closure;
            if (isOpeningVariantEvent(event)) {
                closure = openingVariantClosure(event);
            }
            else if (event.encoding === 'native-mvu-schema-player-event-v1') {
                const facts = playerFacts(row);
                closure = { operation: facts.operation, plan: facts.plan, event, settlement: facts.settlement, completion: facts.completion };
            }
            else if (isSuffixEvent(event)) {
                closure = revisionClosure(event);
                for (const edit of closure.descriptor.edits)
                    if (isManualRevision(event) ? edit.targetSeq < event.plan.logicalNativeCut : edit.targetSeq <= event.plan.canonical.seq)
                        resolvedEdits.add(edit.seq);
            }
            else if (event.encoding === 'native-mvu-schema-story-revision-event-v1') {
                const ref = event.plan.revision.descriptor;
                const descriptor = validateMvuSchemaStoryRevisionDescriptor(prefixInputs.status.get(ref.key));
                const marker = ready.frozen.schemaVersion !== 1 && ready.frozen.revisions.find(revision => revision.descriptor.key === ref.key && revision.descriptor.sha256 === ref.sha256);
                const edit = events[descriptor.edit.seq], target = events[descriptor.edit.targetSeq];
                const originalEvent = validateMvuSchemaStoryEvent(prefixInputs.status.get(descriptor.original.key));
                if (!marker || recordSha256(descriptor) !== ref.sha256 || recordSha256(originalEvent) !== descriptor.original.sha256
                    || marker.editSeq !== descriptor.edit.seq || marker.completionSeq !== descriptor.completionSeq
                    || edit?.type !== 'roleplay/message-edit' || recordSha256(edit) !== descriptor.edit.sha256
                    || edit.data.targetSeq !== descriptor.edit.targetSeq || target?.type !== 'assistant/message'
                    || originalEvent.plan.canonical.seq !== descriptor.edit.targetSeq
                    || !same(event.plan.scope, originalEvent.plan.scope) || !same(event.plan.base, originalEvent.plan.base)
                    || descriptor.baseStateSnapshotSha256 !== base.stateSnapshotSha256
                    || descriptor.sourceSha256 !== base.sourceSha256
                    || descriptor.publicationRevision !== event.plan.revision.publicationRevision
                    || event.plan.initialCut.nativeCut !== marker.marker.seq + 1)
                    fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
                const message = deps.editProtocol.editMessageText(target.data.message, edit.data);
                const canonical = { seq: target.seq, messageId: message.id, versionSha256: recordSha256(message),
                    narrative: textOf(message.content), narrativeSha256: sha256(textOf(message.content)) };
                if (!same(event.plan.canonical, canonical))
                    fail('SCHEMA_REVISION_CANONICAL_UNPROVEN');
                closure = { original: closedStory(originalEvent), descriptor, event };
                if (event.outcome !== 'refused')
                    resolvedEdits.add(descriptor.edit.seq);
            }
            else {
                closure = closedStory(event);
            }
            verifyStoryBrowserJournal(event, ready);
            for (const phase of mvuSchemaStoryExecutionPhases(event)) {
                const actualAssociation = associationAt(sid, events, ready, ordinal), step = ready.steps[ordinal++], association = phase.association;
                if (!step || !same(step.dispatchRef, association.dispatch) || !same(step.completionRef, association.completion)
                    || !same(actualAssociation, association)
                    || !same(step.dispatchMarker, association.dispatchMarker) || !same(step.completionMarker, association.completionMarker)
                    || step.dispatch.batchId !== association.batchId || !same(step.dispatch.sourceNativeCut.anchor, association.anchor)
                    || recordSha256(step.dispatch.sourceNativeCut) !== association.sourceNativeCutSha256
                    || !same(step.step.frame.input, phase.input) || !same(step.step.output, phase.output)
                    // Plan parsing checks the frozen frame; Journal's dispatch parser
                    // joins its exact material and snapshot hashes to this Native cut.
                    || step.dispatch.sourceNativeCut.sourceSnapshotSha256 !== plan.currentFrame.snapshotSha256
                    || step.dispatch.sourceNativeCut.materialSha256 !== plan.currentFrame.materialSha256)
                    fail('SCHEMA_STORY_JOURNAL_UNPROVEN');
                if (step.step.frame.input.schemaVersion === 4 && step.step.frame.input.scopeReadRef) {
                    if (!semantic || !scopeCursor || !original)
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                    semantic.verify(ready, step.step.frame.input.scopeReadRef, scopeCursor, original, plan.currentFrame, step.dispatch.sourceNativeCut, 'logicalNativeCut' in plan ? plan.logicalNativeCut : undefined);
                }
                else {
                    if (!scopeSeed || !chat || !messageStates || !original)
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                    const revised = isSuffixEvent(event) ? revisionClosure(event) : undefined;
                    const expected = scopeFrameAt({ ...scopeSeed, chat, messages: messageStates }, original, plan.currentFrame, step.dispatch.sourceNativeCut, events, plan.schemaVersion === 8 || plan.schemaVersion === 9 || plan.schemaVersion === 11 ? plan.logicalNativeCut : undefined, revised?.projection);
                    if (!same(step.step.frame.input.scopeReadFrame, expected))
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                }
            }
            let head;
            if (isOpeningVariantEvent(event))
                head = openingVariantReplacementHead(event);
            else if (isManualRevision(event))
                head = mvuSchemaPlayerRevisionHead(event);
            else if (event.encoding === 'native-mvu-schema-player-event-v1')
                head = mvuSchemaPlayerHead(event);
            else if (event.encoding === 'native-mvu-schema-story-revision-event-v1'
                || event.encoding === 'native-mvu-schema-story-revision-event-v2') {
                head = event.outcome === 'refused' ? event.plan.base.currentHead : mvuSchemaStoryRevisionHead(event);
            }
            else
                head = mvuSchemaStoryHead(event);
            if (isSuffixEvent(event))
                root = event.plan.execution.root;
            state = snapshot({ schemaVersion: 2, encoding: 'native-mvu-schema-state-snapshot-v2', sessionId: sid,
                sourceSha256: base.sourceSha256, root, currentHead: head, revision: head.revision, headSha256: recordSha256(head),
                values: event.values, valuesSha256: event.valuesSha256, context: event.context, schemaFrontier: event.frontier });
            if (scopeSeed && messageStates && (event.outcome !== 'refused'
                || isManualRevision(event) && manualChatAtBase(chat, event.plan.base))) {
                const source = schemaScopeSource(plan.currentFrame.snapshot);
                const manual = isManualEvent(event);
                const stateRef = { kind: manual ? 'manual' : 'story', ownerSessionId: sid,
                    recordKey: key, recordSha256: recordSha256(event), valuesSha256: event.valuesSha256, revision: state.revision };
                if (manual || scopeSeed.updateChat)
                    chat = schemaScopePublished(schemaScopeOwner(source, 'chat'), stateRef, event.values, event.context);
                const target = publishedMessageTarget(scopeSeed, event);
                if (target && event.outcome !== 'refused') {
                    const variables = schemaScopePublished(schemaScopeOwner(source, 'message', target.messageId, sid), stateRef, event.values, event.context), key = schemaScopeMessageKey(target.ownerSessionId, target.nativeSeq, target.messageId, target.messageVersionSha256);
                    messageStates.set(key, variables);
                    messageIndex.set(key, variables);
                }
                scopeCursor = { ...scopeSeed, chat: chat, messages: messageIndex.view(), previous: scopeCursor,
                    currentMessageCarrier: event.outcome === 'refused' ? scopeCursor?.currentMessageCarrier ?? null : target,
                    publishedMessages: target && event.outcome !== 'refused' ? [target.nativeSeq] : [] };
            }
            if (scopeCursor && (isSuffixEvent(event) || event.encoding === 'native-mvu-schema-story-revision-event-v1')) {
                // Revised scopes keep their exact historical targets without granting
                // a fresh message writer on a carrier this fold has not established.
                scopeCursor = { ...scopeCursor, currentMessageCarrier: null };
            }
            if (isSuffixEvent(event)) {
                const entry = revisionClosures.get(event.plan.revision.descriptor.sha256), facts = entry.closure;
                entry.joinedEvents++;
                if (facts.descriptor.schemaVersion === 4 && facts.completion.schemaVersion === 4
                    && entry.joinedEvents === facts.events.length) {
                    const descriptorRef = event.plan.revision.descriptor, completionRef = { key: mvuSchemaStoryRevisionCompletionKey(event.sessionId, descriptorRef.sha256),
                        sha256: recordSha256(facts.completion) }, marker = ready.frozen.schemaVersion !== 1 ? ready.frozen.revisions.find(row => row.descriptor.key === descriptorRef.key && row.descriptor.sha256 === descriptorRef.sha256) : undefined;
                    // The last member reached this point only after every phase joined
                    // its actual Journal pair. A parsed closure alone is not a receipt.
                    const userEdits = new Map();
                    entry.receipt = { descriptor: facts.descriptor, completion: facts.completion, descriptorRef, completionRef,
                        markerSeq: marker.marker.seq, lastCompletionSeq: event.frontier.nativeCut - 1, userEdits };
                    for (const edit of facts.descriptor.edits)
                        if (edit.role === 'user') {
                            userEdits.set(edit.seq, edit);
                            if (userEditAuthorizations.get(edit.seq)?.edit.sha256 !== edit.sha256)
                                userEditAuthorizations.set(edit.seq, {
                                    edit: { seq: edit.seq, sha256: edit.sha256 }, proof: { kind: 'completed-v4', descriptor: descriptorRef, completion: completionRef }
                                });
                        }
                }
                else if (facts.descriptor.schemaVersion === 5 && entry.joinedEvents === 1) {
                    for (const authorization of facts.descriptor.authorizations)
                        userEditAuthorizations.set(authorization.edit.seq, authorization);
                }
            }
            consumed.set(plan.planSha256, recordSha256(closure));
            const body = settledStoryMessage(event);
            if (body)
                settledMessages.set(settledMessageKey(body.target), body);
            if (!isManualEvent(event))
                lastClosedStoryCanonicalSeq = Math.max(lastClosedStoryCanonicalSeq ?? -1, event.plan.canonical.seq);
            eventKeys.push(key);
            if (!isManualEvent(event) && event.outcome !== 'refused') {
                const p = event.plan, ref = { key, sha256: recordSha256(event) };
                lastSettledStoryCanonicalSeq = Math.max(lastSettledStoryCanonicalSeq ?? -1, p.canonical.seq);
                if (schemaStoryMaintenanceSource(p)?.kind === 'task-result') {
                    taskArtifacts.set(p.canonical.seq, { canonicalSeq: p.canonical.seq, originEventRef: ref, sourceEventRef: ref,
                        effectiveKind: p.candidate.kind === 'parsed' ? 'patch' : 'unchanged' });
                }
                else if (p.schemaVersion === 11) {
                    taskArtifacts.set(p.canonical.seq, { canonicalSeq: p.canonical.seq, originEventRef: p.taskEdit.originEventRef, sourceEventRef: ref,
                        effectiveKind: p.taskEdit.mode === 'clear' ? 'cleared' : p.taskEdit.mode === 'retain'
                            ? p.taskEdit.effectiveKind : p.candidate.kind === 'parsed' ? 'patch' : 'unchanged' });
                }
            }
            if (displayUpdates && !isManualEvent(event)
                && event.outcome !== 'refused' && event.plan.candidate.kind === 'parsed') {
                const item = acceptedMvuDisplayUpdate(sid, event.plan.canonical, event.plan.candidate.protocol);
                if (item)
                    displayUpdates.push(item);
            }
        }
        if (authorizationCandidates)
            for (const [seq, candidate] of authorizationCandidates) {
                if (userEditAuthorizations.get(seq)?.edit.sha256 === candidate.edit.sha256)
                    continue;
                // The edit identity came from this owner's current Native edit list.
                // Only its already-published V4 receipt can fill missing legacy metadata.
                suffixAuthorization(candidate, sid, events, events.length, completedV4);
                userEditAuthorizations.set(seq, candidate);
            }
        if (!readOnlyTail && (ordinal !== ready.steps.length || !same(state.schemaFrontier, frontier(ready, initial.schemaFrontier.nativeCut)))) {
            fail('SCHEMA_STORY_HISTORY_UNSETTLED');
        }
        if (readOnlyTail && partial.length && ordinal === ready.steps.length)
            fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
        const scopeResumeAnchor = semantic?.anchor();
        semantic?.dispose();
        const readScopes = scopeCursor;
        return { state, consumed, eventKeys, settledMessages, readScopes, ordinal, resolvedEdits, lastTaskResultCanonicalSeq,
            lastSettledStoryCanonicalSeq, lastClosedStoryCanonicalSeq, userEditAuthorizations, taskArtifacts,
            displayUpdates: displayUpdates ? formatMvuDisplayUpdates([...(restored?.displayUpdates ?? displaySeed ?? []), ...displayUpdates]) : undefined,
            scopeResumeAnchor };
    }
    function readyFor(sid, realmEpoch, events, inherited, historical = false, executionBaseline) {
        // Derived recovery already owns inherited DATA. Journal reads the actual
        // local rows and joins both sets to this current/historical Native cut.
        const ready = journal.captureChecked(sid, realmEpoch, events, inherited, historical, executionBaseline);
        if (ready.kind !== 'ready')
            fail(ready.code);
        return ready;
    }
    function derivedOriginal(original, ready, events) {
        if (original.schemaVersion !== 5)
            return original;
        const recovered = recoveredPrefixes.get(ready);
        if (recovered)
            return recovered.original;
        const retained = sourceOriginals.get(original.originalSha256);
        if (retained)
            return retained;
        if (ready.executionBaseline) {
            const donor = openingArchivesFor(ready.frozen.sessionId).capture(ready.executionBaseline.ref).donor, captured = deps.source.readOpeningVariantOriginal(donor);
            if (!same(captured, original))
                fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN');
            sourceOriginals.set(captured.originalSha256, captured);
            return captured;
        }
        const initialization = ready.steps.find(step => step.dispatch.sessionId === original.sessionId
            && step.dispatch.batchId === original.preparation.selector.batchId);
        if (!initialization)
            fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN');
        const cut = events.slice(0, initialization.completionMarker.seq + 1);
        const opening = journal.recutChecked(original.sessionId, original.realmEpoch, cut, ready);
        if (opening.kind !== 'ready')
            fail(opening.code);
        const captured = deps.source.readFrozenOriginal(original.preparation, opening, cut);
        if (!same(captured, original))
            fail('SCHEMA_ORIGINAL_PROGRAM_UNPROVEN');
        sourceOriginals.set(original.originalSha256, captured);
        return captured;
    }
    function initialForOpening(seed, sourceSha256, original, ready, events) {
        const { event: opening, head: head, intent } = seed, sid = intent.sessionId, index = openingPhaseCount(opening.plan) - 1;
        const final = ready.steps[index];
        if (!verifyMvuSchemaOpeningFacts(intent, opening, head) || final.step.output.kind !== 'accepted'
            || !same(final.step.output.values, opening.plan.values)
            || !same(associationAt(sid, events, ready, index), opening.plan.execution))
            fail('SCHEMA_OPENING_JOURNAL_UNPROVEN');
        const root = { openingEventId: opening.eventId, openingEventSha256: opening.eventSha256, openingHeadSha256: recordSha256(head),
            openingPlanSha256: opening.plan.planSha256, realmEpoch: original.realmEpoch, programSha256: schemaOriginalProgramSha256(original) };
        return snapshot({ schemaVersion: 2, encoding: 'native-mvu-schema-state-snapshot-v2', sessionId: sid, sourceSha256,
            root, currentHead: head, revision: 1, headSha256: recordSha256(head), values: opening.plan.values, valuesSha256: opening.valuesSha256,
            context: final.step.output.context, schemaFrontier: { nativeCut: final.completionMarker.seq + 1,
                tailSha256: final.step.stepSha256, frontierSha256: schemaExecutionHostFrontierSha256(opening.plan.execution) } });
    }
    function factual(session, nativeCut, historical = false, includeDisplay = false, captureBasis = false, reconcileOriginalPlanSha256, revisionBases, readContext, authorizationCandidates) {
        const cut = deps.inputState.nativeHistory?.cut?.(session);
        if (!historical && cut?.source === 'native' && (nativeCut === undefined || nativeCut === cut.length)
            && !reconcileOriginalPlanSha256 && !revisionBases && !readContext && !authorizationCandidates) {
            const history = warmNumerical(session, cut, includeDisplay, captureBasis);
            if (history)
                return history;
        }
        return factualCold(session, nativeCut, historical, includeDisplay, captureBasis, reconcileOriginalPlanSha256, revisionBases, readContext, authorizationCandidates);
    }
    function seedClosed(history, live, sid) {
        return deps.inputState.captureClosedData(sid, () => {
            const seed = history.seed;
            if (seed.kind === 'opening') {
                const intent = prefixInputs.branch.get(openingIntentKey(sid, seed.intent.preparation.identity.source.importId)), head = prefixInputs.status.get(mvuInitializationHeadKey(sid)), event = prefixInputs.status.get(mvuInitializationEventKey(sid, seed.event.eventId));
                if (!same(intent, seed.intent) || !same(head, seed.head) || !same(event, seed.event))
                    fail('SCHEMA_OPENING_RECORD_INVALID');
            }
            else if (seed.kind === 'activation') {
                const activation = openingArchivesFor(sid).readSeed(sid, seed.activationRef);
                if (!activation || !same(prefixInputs.status.get(openingVariantActivationEventKey(sid)), activation.seed.event))
                    fail('OPENING_VARIANT_ACTIVATION_UNPROVEN');
            }
            else {
                const basis = prefixInputs.branch.get(seed.basisKey);
                if (basis?.basisSha256 !== seed.basisSha256)
                    fail('SCHEMA_DERIVED_GENESIS_UNPROVEN');
            }
            const count = seed.kind === 'opening' ? openingPhaseCount(seed.event.plan) : seed.kind === 'activation' ? 0 : history.inheritedReady.steps.length;
            for (let index = 0; index < count; index++)
                live.pairFact(index).use();
            live.selectionFact()?.use();
            return history.initial;
        });
    }
    function startNumerical(session, cut, includeDisplay) {
        const history = factualCold(session, cut.length, false, includeDisplay, false, undefined, undefined, undefined, undefined, true), captured = coldNumericalReads.get(history);
        if (!captured)
            return history;
        coldNumericalReads.delete(history);
        const { ready, initial, proof: prefixProof, rows, result } = captured, ownedFacts = new Set([initial, prefixProof]), facts = new Map();
        try {
            for (const row of rows) {
                if (row.event.encoding !== 'native-mvu-schema-story-event-v2' && row.event.encoding !== 'native-mvu-schema-player-event-v1'
                    && !isOpeningVariantEvent(row.event)) {
                    continue;
                }
                const closureSha256 = result.consumed.get(row.event.plan.planSha256);
                if (closureSha256 !== undefined)
                    facts.set(row.event.plan.planSha256, { fact: prefixProof, closureSha256 });
            }
            const cursor = { session, owner: cut.owner, history: historyWith(history, { ready }), nativeCut: cut.length,
                ordinal: ready.steps.length, proof: prefixProof, inventory: new Map(rows.map(row => [row.key, row])), dirty: new Set(), pending: new Set(),
                consumed: numericalIndex(history.consumed), messages: numericalIndex(history.readScopes?.messages ?? new Map()),
                settledMessages: numericalIndex(history.settledMessages ?? new Map()),
                semantic: scopeSemantic(session),
                keys: [...history.eventKeys], diagnostics: [...history.commandDiagnostics], display: [...history.displayUpdates ?? []], facts, ownedFacts };
            numericalCursors.set(session.id, cursor);
            retainScopeResume(session.id, cut.owner, history.original.realmEpoch, result.scopeResumeAnchor, prefixProof);
            return cursor;
        }
        catch (error) {
            for (const fact of ownedFacts)
                fact.dispose();
            throw error;
        }
    }
    function restartNumerical(session, cut, includeDisplay) {
        const next = startNumerical(session, cut, includeDisplay);
        return 'proof' in next ? next.history : next;
    }
    function warmNumerical(session, cut, includeDisplay, captureBasis) {
        const sid = session.id;
        const ledger = deps.captureManualLedger?.(sid), manualBlock = ledger ? ledger.code : deps.manualPendingCode?.(sid);
        if (manualBlock)
            fail(manualBlock);
        let cursor = numericalCursors.get(sid);
        if (cursor && (cursor.session !== session || cursor.owner !== cut.owner || cut.length < cursor.nativeCut || !cursor.proof.current())) {
            releaseNumerical(sid);
            cursor = undefined;
        }
        if (!cursor)
            return restartNumerical(session, cut, includeDisplay);
        for (const event of cut.range(cursor.nativeCut))
            if (event.type === 'roleplay/message-edit'
                || event.type === deps.markers.revisionEventType || event.type === 'roleplay/author-injection-cleanup') {
                releaseNumerical(sid);
                return restartNumerical(session, cut, includeDisplay);
            }
        const ready = journal.captureLive(sid, cursor.history.original.realmEpoch, { inherited: cursor.history.inheritedReady ?? null,
            executionBaseline: cursor.history.ready.executionBaseline });
        if (ready.kind !== 'ready')
            fail(ready.code);
        if (!cursor.proof.current()) {
            releaseNumerical(sid);
            return restartNumerical(session, cut, includeDisplay);
        }
        const pending = [];
        for (const key of cursor.dirty) {
            const raw = prefixInputs.status.get(key);
            if (raw === undefined) {
                cursor.inventory.delete(key);
                cursor.pending.delete(key);
                continue;
            }
            const event = key.includes('__mvu-state-schema-story-event-') ? historyRecords.story(key, raw)
                : key.includes('__mvu-state-schema-player-event-') ? historyRecords.player(key, raw)
                    : key.includes('__mvu-state-schema-opening-variant-event-')
                        ? validateOpeningVariantReplacementEvent(raw) : historyRecords.revision(key, raw);
            cursor.inventory.set(key, { key, event });
            if (event.frontier.nativeCut > cursor.history.snapshot.schemaFrontier.nativeCut)
                cursor.pending.add(key);
        }
        for (const key of cursor.pending) {
            const row = cursor.inventory.get(key);
            if (row.event.frontier.nativeCut <= cursor.history.snapshot.schemaFrontier.nativeCut) {
                cursor.pending.delete(key);
                continue;
            }
            if (row.event.frontier.nativeCut <= cut.length)
                pending.push(row);
        }
        pending.sort((a, b) => a.event.phases[0].association.dispatchMarker.seq - b.event.phases[0].association.dispatchMarker.seq);
        try {
            for (const row of pending) {
                advanceNumerical(cursor, cut, ready, row, includeDisplay);
                cursor.pending.delete(row.key);
            }
        }
        catch (error) {
            cursor.semantic.dispose();
            cursor.semantic = scopeSemantic(session);
            throw error;
        }
        if (cursor.ordinal !== ready.steps.length || !same(cursor.history.snapshot.schemaFrontier, frontier(ready, cursor.history.initial.schemaFrontier.nativeCut))) {
            fail('SCHEMA_STORY_HISTORY_UNSETTLED');
        }
        cursor.dirty.clear();
        cursor.nativeCut = cut.length;
        const priorBasis = capturingEditBasis;
        let edited;
        try {
            if (captureBasis)
                capturingEditBasis = { sid, basis: cursor.history.editBasis };
            edited = deps.readEditInvalidation?.(sid);
        }
        finally {
            capturingEditBasis = priorBasis;
        }
        if (edited && edited.kind === 'unknown')
            fail(edited.code);
        if (edited && edited.kind === 'invalidated' && deps.currentEdits(session)
            .some(edit => edit.seq >= cursor.history.editBasis.editFloorSeq && !cursor.history.resolvedEdits.has(edit.seq)))
            fail(edited.code);
        cursor.proof.use();
        ready.selectionFact()?.use();
        const state = cursor.history.snapshot, actualHead = prefixInputs.status.get(mvuStateCurrentHeadKey(sid));
        if (!mvuNumericalPublicationMatches(actualHead, state.currentHead))
            fail('SCHEMA_STORY_HEAD_UNPROVEN');
        const sourceSha256 = deps.sourceSha256(sid);
        cursor.history = historyWith(cursor.history, { ready, snapshot: sourceSha256 === state.sourceSha256 ? state : snapshot({ ...state, sourceSha256 }) });
        return cursor.history;
    }
    function advanceNumerical(cursor, cut, ready, row, includeDisplay) {
        const prior = cursor.history, event = row.event, sid = cursor.session.id;
        if (event.encoding !== 'native-mvu-schema-story-event-v2' && event.encoding !== 'native-mvu-schema-player-event-v1'
            && !isOpeningVariantEvent(event)) {
            fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
        }
        const plan = event.plan, base = 'operation' in plan ? plan.operation.base : plan.base, ordinal = cursor.ordinal, previous = cursor.proof;
        const fact = deps.inputState.captureClosedData(sid, () => {
            previous.use();
            ready.selectionFact()?.use();
            if (!same(prefixInputs.status.get(row.key), event))
                fail('SCHEMA_STORY_HISTORY_UNPROVEN');
            if (!same(base, snapshot({ ...prior.snapshot, sourceSha256: base.sourceSha256 })))
                fail('SCHEMA_STORY_BASE_CHAIN_INVALID');
            if (event.encoding === 'native-mvu-schema-player-event-v1' && event.plan.operation.request.target
                && !schemaScopeMessageTargetEqual(event.plan.operation.request.target, prior.readScopes?.currentMessageCarrier)) {
                fail('SCHEMA_MESSAGE_TARGET_UNPROVEN');
            }
            let closure;
            if (isOpeningVariantEvent(event)) {
                if (row.key !== openingVariantReplacementEventKey(sid, event.eventId))
                    fail('OPENING_VARIANT_HISTORY_UNPROVEN');
                closure = openingVariantClosure(event);
            }
            else if (event.encoding === 'native-mvu-schema-story-event-v2') {
                if (row.key !== mvuSchemaStoryEventKey(sid, event.eventId))
                    fail('SCHEMA_STORY_HISTORY_UNPROVEN');
                closure = closedStoryFacts(sid, cursor.session.inheritedEventCount, [], event, false);
            }
            else {
                if (row.key !== mvuSchemaPlayerEventKey(sid, event.eventId))
                    fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
                const joined = joinMvuSchemaPlayerCompletedEvent(prefixInputs.branch, prefixInputs.status, event, cut);
                closure = { operation: joined.operation, plan: joined.plan, event, settlement: joined.settlement, completion: joined.completion };
            }
            verifyStoryBrowserJournal(event, ready);
            for (const [offset, phase] of mvuSchemaStoryExecutionPhases(event).entries()) {
                const index = ordinal + offset, step = ready.steps.at(index), actual = associationAt(sid, cut, ready, index);
                if (!step || !same(actual, phase.association) || !same(step.step.frame.input, phase.input) || !same(step.step.output, phase.output)
                    || step.dispatch.sourceNativeCut.sourceSnapshotSha256 !== plan.currentFrame.snapshotSha256
                    || step.dispatch.sourceNativeCut.materialSha256 !== plan.currentFrame.materialSha256)
                    fail('SCHEMA_STORY_JOURNAL_UNPROVEN');
                ready.pairFact(index).use();
                if (step.step.frame.input.schemaVersion === 4 && step.step.frame.input.scopeReadRef) {
                    if (!prior.readScopes)
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                    cursor.semantic.verify(ready, step.step.frame.input.scopeReadRef, prior.readScopes, prior.original, plan.currentFrame, step.dispatch.sourceNativeCut);
                }
                else {
                    // Maintenance remains an explicit finite full-frame operation under
                    // the new epoch; ordinary new plans use the reference protocol.
                    if (!prior.readScopes)
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                    const expected = scopeFrameAt(prior.readScopes, prior.original, plan.currentFrame, step.dispatch.sourceNativeCut, cut.materialize());
                    if (!same(step.step.frame.input.scopeReadFrame, expected))
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                }
            }
            const head = isOpeningVariantEvent(event) ? openingVariantReplacementHead(event) :
                event.encoding === 'native-mvu-schema-player-event-v1' ? mvuSchemaPlayerHead(event) : mvuSchemaStoryHead(event), state = snapshot({ schemaVersion: 2, encoding: 'native-mvu-schema-state-snapshot-v2', sessionId: sid,
                sourceSha256: base.sourceSha256, root: base.root, currentHead: head, revision: head.revision, headSha256: recordSha256(head),
                values: event.values, valuesSha256: event.valuesSha256, context: event.context, schemaFrontier: event.frontier });
            return { state, closureSha256: recordSha256(closure) };
        });
        const { state, closureSha256 } = fact.data;
        let readScopes = prior.readScopes;
        if (readScopes && event.outcome !== 'refused') {
            const source = schemaScopeSource(plan.currentFrame.snapshot), manual = isManualEvent(event), stateRef = { kind: manual ? 'manual' : 'story', ownerSessionId: sid, recordKey: row.key,
                recordSha256: recordSha256(event), valuesSha256: event.valuesSha256, revision: state.revision }, chat = manual || readScopes.updateChat ? schemaScopePublished(schemaScopeOwner(source, 'chat'), stateRef, event.values, event.context) : readScopes.chat;
            const changed = [];
            const target = publishedMessageTarget(readScopes, event);
            if (target) {
                const value = schemaScopePublished(schemaScopeOwner(source, 'message', target.messageId, sid), stateRef, event.values, event.context);
                cursor.messages.set(schemaScopeMessageKey(target.ownerSessionId, target.nativeSeq, target.messageId, target.messageVersionSha256), value);
                changed.push(target.nativeSeq);
            }
            readScopes = { ...readScopes, chat, messages: cursor.messages.view(), currentMessageCarrier: target,
                previous: readScopes, publishedMessages: changed };
        }
        cursor.consumed.set(plan.planSha256, closureSha256);
        cursor.keys.push(row.key);
        const through = cursor.keys.length;
        let keys;
        const display = includeDisplay && event.encoding === 'native-mvu-schema-story-event-v2' && event.outcome !== 'refused'
            && event.plan.candidate.kind === 'parsed' ? acceptedMvuDisplayUpdate(sid, event.plan.canonical, event.plan.candidate.protocol) : undefined;
        for (const step of ready.steps.range(ordinal, ordinal + mvuSchemaStoryExecutionPhases(event).length)) {
            cursor.diagnostics.push(...commandDiagnosticsForStep(step));
        }
        if (display)
            cursor.display.push(display);
        const diagnosticCount = cursor.diagnostics.length, displayCount = cursor.display.length;
        let diagnostics, displays;
        const taskResult = event.encoding === 'native-mvu-schema-story-event-v2'
            && schemaStoryMaintenanceSource(event.plan)?.kind === 'task-result' && event.outcome !== 'refused' ? event : undefined;
        let artifacts = prior.taskArtifacts;
        if (taskResult) {
            const ref = { key: row.key, sha256: recordSha256(taskResult) }, copy = new Map(artifacts);
            copy.set(taskResult.plan.canonical.seq, { canonicalSeq: taskResult.plan.canonical.seq, originEventRef: ref, sourceEventRef: ref,
                effectiveKind: taskResult.plan.candidate.kind === 'parsed' ? 'patch' : 'unchanged' });
            artifacts = copy;
        }
        const body = settledStoryMessage(event);
        if (body)
            cursor.settledMessages.set(settledMessageKey(body.target), body);
        cursor.history = historyWith(prior, { ready, snapshot: state, consumed: cursor.consumed.view(), readScopes, taskArtifacts: artifacts,
            settledMessages: cursor.settledMessages.view(),
            lastClosedStoryCanonicalSeq: event.encoding === 'native-mvu-schema-story-event-v2'
                ? Math.max(prior.lastClosedStoryCanonicalSeq ?? -1, event.plan.canonical.seq) : prior.lastClosedStoryCanonicalSeq,
            get eventKeys() { return keys ??= cursor.keys.slice(0, through); },
            get commandDiagnostics() { return diagnostics ??= cursor.diagnostics.slice(0, diagnosticCount); },
            get displayUpdates() { return displays ??= cursor.display.slice(0, displayCount); },
            lastTaskResultCanonicalSeq: taskResult ? Math.max(prior.lastTaskResultCanonicalSeq ?? -1, taskResult.plan.canonical.seq)
                : prior.lastTaskResultCanonicalSeq,
            lastSettledStoryCanonicalSeq: event.encoding === 'native-mvu-schema-story-event-v2' && event.outcome !== 'refused'
                ? Math.max(prior.lastSettledStoryCanonicalSeq ?? -1, event.plan.canonical.seq) : prior.lastSettledStoryCanonicalSeq });
        cursor.ordinal += mvuSchemaStoryExecutionPhases(event).length;
        cursor.proof = fact;
        cursor.ownedFacts.add(fact);
        cursor.facts.set(plan.planSha256, { fact, closureSha256 });
        retainScopeResume(sid, cut.owner, prior.original.realmEpoch, cursor.semantic.anchor(), fact);
    }
    function factualCold(session, nativeCut = all(session).length, historical = false, includeDisplay = false, captureBasis = false, reconcileOriginalPlanSha256, revisionBases, readContext, authorizationCandidates, captureClosed = false) {
        const sid = session.id, currentEvents = all(session), events = nativeCut === currentEvents.length
            ? currentEvents : currentEvents.slice(0, nativeCut), sourceSha256 = deps.sourceSha256(sid);
        // An inherited revision base verifies its frozen Source lineage. Like the
        // derived genesis, that Source read belongs to this live consumer; a closed
        // numerical collector cannot retain a Source frame.
        revisionBases ??= prepareRevisionBases(sid, events, undefined, sid, readContext);
        const ledger = historical ? undefined : deps.captureManualLedger?.(sid);
        const manualBlock = historical ? undefined : ledger ? ledger.code : deps.manualPendingCode?.(sid);
        if (manualBlock && !historical)
            fail(manualBlock);
        let original, initial, seed;
        let scopeSeed;
        let displaySeed;
        let ready, inheritedCut = null, ordinal = 1;
        let inheritedReady;
        const activation = activationFor(sid, events);
        if (activation) {
            if (session.inheritedEventCount !== 0 || session.header.parentSession !== activation.seed.parentSessionId)
                fail('OPENING_VARIANT_NATIVE_UNPROVEN');
            original = activation.original;
            ready = readyFor(sid, original.realmEpoch, events, null, historical, activation.baseline);
            initial = snapshot({ ...activation.seed.snapshot, sourceSha256 });
            ordinal = 0;
            seed = { kind: 'activation', activationRef: activation.ref };
            scopeSeed = scopesForActivation(activation, events);
            if (includeDisplay)
                displaySeed = [];
        }
        else if (deps.derivedRequired?.(sid) || session.inheritedEventCount || session.header.parentSession) {
            const genesis = deps.readDerivedGenesis?.(sid);
            if (!genesis || genesis.inheritedCut.nativeCut !== session.inheritedEventCount)
                fail('SCHEMA_DERIVED_GENESIS_UNPROVEN');
            original = genesis.original;
            const inherited = genesis.inheritedReady ?? journal.validateFrozenReady(genesis.inheritedCut, events.slice(0, genesis.inheritedCut.nativeCut));
            inheritedReady = inherited;
            inheritedCut = genesis.inheritedCut;
            ready = readyFor(sid, original.realmEpoch, events, inherited, historical);
            original = derivedOriginal(original, inherited, events.slice(0, inheritedCut.nativeCut));
            ordinal = inherited.steps.length;
            initial = snapshot({ ...genesis.snapshot, sourceSha256 });
            seed = { kind: 'derived', basisKey: genesis.basisKey, basisSha256: genesis.basisSha256 };
            scopeSeed = scopesForDerived(genesis, events);
            if (includeDisplay)
                displaySeed = displayForDerived(genesis, events);
        }
        else {
            const pointer = deps.activePointer(sid);
            if (!pointer?.importId)
                fail('SCHEMA_STORY_ROOT_REQUIRED');
            const intent = validateMvuSchemaOpeningIntent(prefixInputs.branch.get(openingIntentKey(sid, pointer.importId)));
            if (intent.status !== 'completed' || !intent.initialization)
                fail('SCHEMA_OPENING_NOT_COMPLETED');
            const storedHead = prefixInputs.status.get(mvuInitializationHeadKey(sid));
            if (storedHead === undefined)
                fail('HEAD_MISSING');
            const head = validateMvuSchemaOpeningHead(storedHead);
            const opening = validateMvuSchemaOpeningEvent(prefixInputs.status.get(mvuInitializationEventKey(sid, head.eventId)));
            if (!verifyMvuSchemaInheritedOpeningFacts({ intent, event: opening, head, events }, { projectPrefix: deps.projectPrefix }))
                fail('SCHEMA_OPENING_RECORD_INVALID');
            // This factual read owns the active parent. Historical ancestors in
            // derivedOriginal still consume frozen DATA without a live parent owner.
            const selected = readyFor(sid, intent.preparation.realmEpoch, events, null, historical);
            const captured = deps.source.captureCurrentOriginal(intent.preparation, { sessionId: sid, table: prefixInputs.status, events, ready: selected }, historical);
            ready = captured.ready;
            original = captured.original;
            if (original.schemaVersion === 5)
                sourceOriginals.set(original.originalSha256, original);
            seed = { kind: 'opening', intent, event: opening, head };
            ordinal = openingPhaseCount(opening.plan);
            initial = initialForOpening(seed, sourceSha256, original, ready, events);
            const projections = openingProjectionsForOpening(seed, original, ready, events, includeDisplay);
            scopeSeed = projections.scopes;
            displaySeed = projections.displayUpdates;
        }
        const editBasis = { root: initial.root, editFloorSeq: seed.kind === 'opening'
                ? seed.event.native.turnEndSeq + 1 : seed.kind === 'activation' ? activation.seed.event.native.turnEndSeq + 1 : inheritedCut.nativeCut };
        const priorBasis = capturingEditBasis;
        let edited;
        try {
            if (captureBasis)
                capturingEditBasis = { sid, basis: editBasis };
            edited = !historical && deps.readEditInvalidation?.(sid);
        }
        finally {
            capturingEditBasis = priorBasis;
        }
        if (edited && edited.kind === 'unknown')
            fail(edited.code);
        const live = captureClosed && scopeRefAvailable(ready)
            ? journal.captureLive(sid, original.realmEpoch, { inherited: inheritedReady ?? null, executionBaseline: ready.executionBaseline }) : undefined;
        if (live && live.kind !== 'ready')
            fail(live.code);
        const closedReady = live?.kind === 'ready' ? live : undefined;
        if (closedReady && !closedReady.steps.length && !closedReady.executionBaseline
            || closedReady && closedReady.steps.length > 0 && !closedReady.pairFact(0))
            fail('SCHEMA_LIVE_OWNER_UNAVAILABLE');
        const rows = closedReady ? deps.inputState.readDataInventory(() => eventRows(sid, events.length)) : undefined;
        const fold = () => {
            const reset = [...revisionBases.values()].at(-1), inventory = rows?.filter(row => !reset || row.event.frontier.nativeCut > reset.prefix.journal.nativeCut);
            return consume(sid, session.inheritedEventCount, events, ready, initial, ordinal, historical, scopeSeed, original, false, includeDisplay, displaySeed, closedReady ? undefined : ledger, reconcileOriginalPlanSha256, revisionBases, inheritedReady ? recoveredPrefixes.get(inheritedReady)?.resolvedEdits : undefined, inheritedReady ? recoveredPrefixes.get(inheritedReady)?.lastTaskResultCanonicalSeq : undefined, inheritedReady ? recoveredPrefixes.get(inheritedReady)?.taskArtifacts : undefined, inheritedReady ? recoveredPrefixes.get(inheritedReady)?.lastSettledStoryCanonicalSeq : undefined, inheritedReady ? recoveredPrefixes.get(inheritedReady)?.userEditAuthorizations : undefined, authorizationCandidates, inventory, inheritedReady ? recoveredPrefixes.get(inheritedReady)?.settledMessages : undefined, inheritedReady ? recoveredPrefixes.get(inheritedReady)?.lastClosedStoryCanonicalSeq : undefined);
        };
        let initialFact, proof;
        try {
            let result;
            if (closedReady) {
                const baseline = seedClosed({ seed, initial, inheritedReady }, closedReady, sid);
                initialFact = baseline;
                const captured = deps.inputState.captureClosedData(sid, () => {
                    baseline.use();
                    closedReady.selectionFact()?.use();
                    for (let index = 0; index < closedReady.steps.length; index++)
                        closedReady.pairFact(index).use();
                    // Parsed immutable rows were selected synchronously by this owner.
                    // Enroll their exact addresses without a second parse/hash/closure join.
                    for (const row of rows)
                        prefixInputs.status.get(row.key);
                    return fold();
                });
                proof = captured;
                result = captured.use();
            }
            else
                result = fold();
            if (edited && edited.kind === 'invalidated' && deps.currentEdits(session)
                .some(edit => edit.seq >= editBasis.editFloorSeq && !result.resolvedEdits.has(edit.seq)))
                fail(edited.code);
            let state = result.state;
            if (!historical) {
                const actualHead = prefixInputs.status.get(mvuStateCurrentHeadKey(sid));
                if (!mvuNumericalPublicationMatches(actualHead, state.currentHead)) {
                    fail('SCHEMA_STORY_HEAD_UNPROVEN');
                }
            }
            state = snapshot({ ...state, sourceSha256 });
            const commandDiagnostics = ready.steps.flatMap(commandDiagnosticsForStep);
            const history = { original, ready, snapshot: state, consumed: result.consumed, initial, seed, inheritedCut, eventKeys: result.eventKeys,
                readScopes: result.readScopes, settledMessages: result.settledMessages,
                lastTaskResultCanonicalSeq: result.lastTaskResultCanonicalSeq,
                lastSettledStoryCanonicalSeq: result.lastSettledStoryCanonicalSeq,
                lastClosedStoryCanonicalSeq: result.lastClosedStoryCanonicalSeq,
                userEditAuthorizations: result.userEditAuthorizations,
                taskArtifacts: result.taskArtifacts,
                displayUpdates: result.displayUpdates, commandDiagnostics, resolvedEdits: result.resolvedEdits, editBasis };
            if (inheritedReady)
                Object.defineProperty(history, 'inheritedReady', { value: inheritedReady });
            if (closedReady && proof && initialFact)
                coldNumericalReads.set(history, { ready: closedReady, initial: initialFact, proof, rows: rows, result });
            return history;
        }
        catch (error) {
            proof?.dispose();
            initialFact?.dispose();
            throw error;
        }
    }
    function foldForkPrefix(input, events, genesis, recut = false, revisionBases = new Map()) {
        try {
            let prefix = validateMvuSchemaFrozenPrefix(input);
            const sid = prefix.sessionId;
            if (recut ? events.length > prefix.journal.nativeCut || events.length <= prefix.inheritedEventCount
                : events.length !== prefix.journal.nativeCut)
                return undefined;
            // The old journal is a DATA container, not a claim that the descendant
            // retains its later Native cut. Fold its rows against the actual cut.
            const revisions = recut && prefix.seed.kind === 'opening' && prefix.journal.schemaVersion !== 1
                ? new Map(prefix.journal.revisions.map(revision => [revision.descriptor.key, revision.descriptor.value])) : undefined;
            const selected = recut && prefix.seed.kind === 'opening'
                ? journal.captureFrozen(sid, prefix.original.realmEpoch, events, prefix.journal.records, ref => revisions?.get(ref.key), prefix.journal.schemaVersion === 3 ? prefix.journal.scopeObjects : undefined) : undefined;
            if (selected && selected.kind !== 'ready')
                return undefined;
            let ready, checkedOriginal;
            let initial, ordinal = 1;
            let scopeSeed;
            let displaySeed;
            let resolvedSeed;
            let lastTaskResultSeed;
            let lastSettledStorySeed;
            let authorizationSeed;
            if (prefix.seed.kind === 'opening') {
                const seed = prefix.seed;
                if (!same(prefixInputs.branch.get(openingIntentKey(sid, seed.intent.source.importId)), seed.intent)
                    || !same(prefixInputs.status.get(mvuInitializationEventKey(sid, seed.event.eventId)), seed.event)
                    || !same(prefixInputs.status.get(mvuInitializationHeadKey(sid)), seed.head)
                    || !verifyMvuSchemaInheritedOpeningFacts({ intent: seed.intent, event: seed.event, head: seed.head, events }, { projectPrefix: deps.projectPrefix }))
                    return undefined;
                const recovered = selected?.kind === 'ready'
                    ? { ready: selected, original: deps.source.readFrozenOriginal(seed.intent.preparation, selected, events) }
                    : deps.source.recoverFrozenOriginal(seed.intent.preparation, prefix.journal, events);
                ready = recovered.ready;
                const original = recovered.original;
                checkedOriginal = original;
                if (ready.frozen.sessionId !== sid || ready.frozen.realmEpoch !== prefix.original.realmEpoch)
                    return undefined;
                if (!same(original, prefix.original))
                    return undefined;
                ordinal = openingPhaseCount(seed.event.plan);
                initial = initialForOpening(seed, prefix.sourceSha256, original, ready, events);
                const projections = openingProjectionsForOpening(seed, original, ready, events, true);
                scopeSeed = projections.scopes;
                displaySeed = projections.displayUpdates;
            }
            else if (prefix.seed.kind === 'activation') {
                const activation = activationFor(sid, events, prefix.seed.activationRef);
                if (!activation)
                    return undefined;
                checkedOriginal = activation.original;
                if (!same(checkedOriginal, prefix.original))
                    return undefined;
                if (recut) {
                    const revisions = prefix.journal.schemaVersion === 1 ? undefined : new Map(prefix.journal.revisions.map(row => [row.descriptor.key, row.descriptor.value])), selected = journal.captureFrozen(sid, checkedOriginal.realmEpoch, events, prefix.journal.records, ref => revisions?.get(ref.key), 'scopeObjects' in prefix.journal ? prefix.journal.scopeObjects : undefined, activation.baseline);
                    if (selected.kind !== 'ready')
                        return undefined;
                    ready = selected;
                }
                else
                    ready = journal.validateFrozenReady(prefix.journal, events);
                ordinal = 0;
                initial = snapshot({ ...activation.seed.snapshot, sourceSha256: prefix.sourceSha256 });
                scopeSeed = scopesForActivation(activation, events);
                displaySeed = [];
            }
            else {
                if (!genesis || genesis.sessionId !== sid || genesis.basisKey !== prefix.seed.basisKey
                    || genesis.basisSha256 !== prefix.seed.basisSha256 || !same(genesis.original, prefix.original)
                    || genesis.inheritedCut.nativeCut !== prefix.inheritedEventCount)
                    return undefined;
                const prior = genesis.inheritedReady ?? journal.validateFrozenReady(genesis.inheritedCut, events.slice(0, prefix.inheritedEventCount));
                ready = journal.recoverFrozenReady(prefix.journal, events, prior, recut);
                if (ready.frozen.sessionId !== sid || ready.frozen.realmEpoch !== prefix.original.realmEpoch)
                    return undefined;
                resolvedSeed = recoveredPrefixes.get(prior)?.resolvedEdits;
                lastTaskResultSeed = recoveredPrefixes.get(prior)?.lastTaskResultCanonicalSeq;
                lastSettledStorySeed = recoveredPrefixes.get(prior)?.lastSettledStoryCanonicalSeq;
                authorizationSeed = recoveredPrefixes.get(prior)?.userEditAuthorizations;
                checkedOriginal = derivedOriginal(genesis.original, prior, events.slice(0, prefix.inheritedEventCount));
                ordinal = prior.steps.length;
                initial = snapshot({ ...genesis.snapshot, sourceSha256: prefix.sourceSha256 });
                scopeSeed = scopesForDerived(genesis, events);
                displaySeed = displayForDerived(genesis, events);
                if (!deps.source.originalFactsCurrent(checkedOriginal))
                    return undefined;
            }
            if (!same(initial, prefix.initial))
                return undefined;
            const result = consume(sid, prefix.inheritedEventCount, events, ready, initial, ordinal, true, scopeSeed, checkedOriginal, false, true, displaySeed, undefined, undefined, revisionBases, resolvedSeed, lastTaskResultSeed, prefix.seed.kind === 'derived' && genesis?.inheritedReady ? recoveredPrefixes.get(genesis.inheritedReady)?.taskArtifacts : undefined, lastSettledStorySeed, authorizationSeed, undefined, undefined, prefix.seed.kind === 'derived' && genesis?.inheritedReady ? recoveredPrefixes.get(genesis.inheritedReady)?.settledMessages : undefined, prefix.seed.kind === 'derived' && genesis?.inheritedReady ? recoveredPrefixes.get(genesis.inheritedReady)?.lastClosedStoryCanonicalSeq : undefined);
            const state = snapshot({ ...result.state, sourceSha256: prefix.sourceSha256 });
            if (recut) {
                const { prefixSha256: _oldHash, ...body } = prefix;
                prefix = sealMvuSchemaInheritanceFact({ ...body, original: checkedOriginal, journal: ready.frozen, snapshot: state,
                    eventKeys: result.eventKeys,
                    consumed: [...result.consumed].map(([planSha256, closureSha256]) => ({ planSha256, closureSha256 })) }, 'prefixSha256');
            }
            else if (!same(state, prefix.snapshot) || !same(result.eventKeys, prefix.eventKeys)
                || !same([...result.consumed].map(([planSha256, closureSha256]) => ({ planSha256, closureSha256 })), prefix.consumed))
                return undefined;
            // A completed Native story without its settled numerical result is not a
            // forkable baseline, even when author dispatch has not started yet.
            const workPrefix = `${sid}__native-input-v2-work-`;
            const completedTurns = new Set();
            for (const event of events)
                if (event.type === 'turn/end' && event.data.reason.kind === 'completed'
                    && event.seq >= prefix.inheritedEventCount)
                    completedTurns.add(event.data.turn);
            const includeWork = (key, row) => {
                if (!key.startsWith(workPrefix))
                    return false;
                const work = row;
                const turn = work.checkpoint?.actualTurn;
                return work.source?.kind === 'story' && work.source.headRef?.kind === 'schema-head'
                    && turn !== undefined && completedTurns.has(turn);
            };
            for (const [key, row] of prefixInputs.branch.entries(undefined, includeWork)) {
                if (!includeWork(key, row))
                    continue;
                const work = row;
                const terminal = work.preparationId && readInputCompletion(prefixInputs.branch, sid, work.preparationId);
                if (work.terminalRequired !== true || !terminal || terminal.status !== 'settled' || terminal.plan.kind !== 'schema-numerical'
                    || !result.consumed.has(terminal.plan.plan.planSha256))
                    return undefined;
            }
            if (result.readScopes) {
                scopePrefixes.delete(prefix.prefixSha256);
                scopePrefixes.set(prefix.prefixSha256, { nativePrefixSha256: prefix.journal.nativePrefixSha256, facts: result.readScopes });
                if (scopePrefixes.size > 64)
                    scopePrefixes.delete(scopePrefixes.keys().next().value);
            }
            // All Native, frozen Source, journal, terminal and closure checks above
            // must finish before a prefix becomes a source of inherited display data.
            displayPrefixes.delete(prefix.prefixSha256);
            displayPrefixes.set(prefix.prefixSha256, { ownerSessionId: sid,
                nativePrefixSha256: prefix.journal.nativePrefixSha256, updates: result.displayUpdates ?? [] });
            if (displayPrefixes.size > 64)
                displayPrefixes.delete(displayPrefixes.keys().next().value);
            if (checkedOriginal.schemaVersion === 5)
                sourceOriginals.set(checkedOriginal.originalSha256, checkedOriginal);
            recoveredPrefixes.set(ready, { original: checkedOriginal, scopes: result.readScopes,
                displayUpdates: result.displayUpdates ?? [], resolvedEdits: result.resolvedEdits,
                lastTaskResultCanonicalSeq: result.lastTaskResultCanonicalSeq,
                lastSettledStoryCanonicalSeq: result.lastSettledStoryCanonicalSeq,
                lastClosedStoryCanonicalSeq: result.lastClosedStoryCanonicalSeq,
                userEditAuthorizations: result.userEditAuthorizations, taskArtifacts: result.taskArtifacts, settledMessages: result.settledMessages });
            return { prefix, ready };
        }
        catch {
            return undefined;
        }
    }
    function recoverForkPrefix(input, events, genesis, revisionBases = prepareRevisionBases(input.sessionId, events)) {
        return foldForkPrefix(input, events, genesis, false, revisionBases)?.ready;
    }
    function verifyForkPrefix(prefix, events, genesis) {
        return recoverForkPrefix(prefix, events, genesis) !== undefined;
    }
    const prefixInputBinding = (prefix) => ({ sessionId: prefix.sessionId,
        inheritedEventCount: prefix.inheritedEventCount, nativeCut: prefix.journal.nativeCut,
        nativePrefixSha256: prefix.journal.nativePrefixSha256, sourceSha256: prefix.sourceSha256,
        prefixSha256: prefix.prefixSha256 });
    function retainOpeningVariants(prefix) {
        // The capture owns only this reachable bank. Closed recuts consume the
        // same declared logical facts from their retained physical child scope.
        if (prefix.openingVariants)
            openingArchivesFor(prefix.sessionId).captureSet(prefix.openingVariants.setRef);
    }
    function retainDeclaredRevisionInputs(prefix, capture) {
        if (prefix.journal.schemaVersion === 3)
            for (const row of prefix.journal.scopeObjects) {
                capture.read('status', row.ref.key);
                capture.declareMember('status', row.ref.key);
            }
        if (prefix.journal.schemaVersion === 1)
            return;
        const seen = new Set();
        const read = (table, key, member = false) => {
            const value = capture.read(table, key);
            if (member)
                capture.declareMember(table, key);
            return value;
        };
        const original = (ref) => {
            const event = read('status', ref.key, true), id = 'original:' + ref.key + ':' + ref.sha256;
            if (!event || seen.has(id))
                return;
            seen.add(id);
            if (event.encoding === 'native-mvu-schema-player-event-v1') {
                const { operation } = event.plan, sid = event.sessionId, opid = operation.operationId;
                read('branch', mvuSchemaPlayerOperationKey(sid, opid));
                read('branch', mvuSchemaPlayerPlanKey(sid, opid));
                read('branch', mvuSchemaPlayerRefusalKey(sid, opid));
                read('branch', mvuSchemaPlayerCompletionKey(sid, opid));
                read('status', mvuSchemaPlayerSettlementKey(sid, event.plan.planSha256));
            }
            else {
                const keys = schemaInheritedStoryInputKeys(event.plan);
                read('branch', keys.terminal);
                read('branch', keys.work, true);
                read('branch', keys.snapshot);
                read('branch', keys.phaseB);
                read('status', mvuSchemaStorySettlementKey(event.sessionId, event.plan.planSha256));
            }
        };
        const completion = (key) => {
            const value = read('status', key), id = 'completion:' + key;
            if (!value || seen.has(id))
                return;
            seen.add(id);
            for (const ref of value.events)
                read('status', ref.key, true);
        };
        // Two revisions of the earliest message can share an opening basis. The
        // foreign fork therefore retains each declared revision's own facts; a
        // basis is a recomputation input, not a predecessor in Native chronology.
        // Journal already owns marker/pair evidence. This only records typed DATA
        // edges, without rerunning historical Source, Native joins or author VMs.
        for (const marker of prefix.journal.revisions) {
            const descriptor = marker.descriptor.value;
            if (descriptor.sessionId !== prefix.sessionId)
                continue;
            read('status', marker.descriptor.key);
            if (descriptor.schemaVersion === 1) {
                original(descriptor.original);
                const plan = read('status', mvuSchemaStoryRevisionPlanKey(prefix.sessionId, marker.descriptor.sha256));
                if (plan)
                    read('status', mvuSchemaStoryRevisionEventKey(prefix.sessionId, revisionPlanEventId(plan)), true);
                continue;
            }
            read('status', descriptor.basis.record.key);
            completion(mvuSchemaStoryRevisionCompletionKey(prefix.sessionId, marker.descriptor.sha256));
            for (const entry of suffixOriginals(descriptor))
                original(entry.event);
            if (descriptor.schemaVersion === 4)
                for (const { selection } of descriptor.taskEdits) {
                    read('status', selection.intent.key);
                    read('status', selection.binding.key);
                    original(selection.originEventRef);
                    read('status', selection.sourceEventRef.key);
                }
            if (descriptor.schemaVersion === 5)
                for (const { proof } of descriptor.authorizations) {
                    if (proof.kind === 'intent') {
                        read('status', proof.intent.key);
                        read('status', proof.binding.key);
                    }
                    else if (proof.kind === 'post-commit-recovery') {
                        const intent = read('status', proof.intent.key);
                        read('branch', intent.save.key);
                    }
                    else {
                        read('status', proof.descriptor.key);
                        completion(proof.completion.key);
                    }
                }
        }
    }
    function captureFrozenForkPrefix(prefix, events, genesis) {
        const readContext = prefixInputs.createReadContext(prefix.sessionId), revisionBases = prepareRevisionBases(prefix.sessionId, events, undefined, prefix.sessionId, readContext);
        const captured = prefixInputs.capture(prefixInputBinding(prefix), capture => {
            const selection = numericalHeads.read(prefix.sessionId).openingVariants ?? undefined;
            if (!same(selection, prefix.openingVariants))
                fail('OPENING_VARIANT_SELECTION_CHANGED');
            retainOpeningVariants(prefix);
            const ready = recoverForkPrefix(prefix, events, genesis, revisionBases);
            if (ready)
                retainDeclaredRevisionInputs({ ...prefix, journal: ready.frozen }, capture);
            return ready;
        });
        if (!captured.result)
            fail('SCHEMA_DERIVED_HISTORY_UNPROVEN');
        return { closure: captured.closure, assertCurrent: captured.assertCurrent, ready: captured.result,
            retainInputs: captured.retainInputs };
    }
    function captureAncestorForkPrefix(prefix, events, genesis, closure, subjectSessionId = prefix.sessionId, storageScope = subjectSessionId) {
        const readContext = prefixInputs.createReadContext(storageScope), inputs = prefixInputs.prepareClosed(closure, prefixInputBinding(prefix), readContext);
        const revisionBases = prepareRevisionBases(prefix.sessionId, events, inputs.status, subjectSessionId, readContext);
        const captured = prefixInputs.derive(closure, prefixInputBinding(prefix), capture => {
            retainOpeningVariants(prefix);
            const selected = foldForkPrefix(prefix, events, genesis, true, revisionBases);
            if (!selected)
                fail('SCHEMA_DERIVED_HISTORY_UNPROVEN');
            retainDeclaredRevisionInputs(selected.prefix, capture);
            return selected;
        }, selected => prefixInputBinding(selected.prefix), readContext);
        const ready = captured.result.ready;
        const nativeProgram = isAuthorHostJournalReadyV5(ready) && ready.epoch.program.nativeProgram
            ? { program: ready.epoch.program.nativeProgram, epochRef: ready.epochRef } : undefined;
        return { prefix: captured.result.prefix, ready, closure: captured.closure, assertCurrent: captured.assertCurrent,
            retainInputs: captured.retainInputs, nativeProgram };
    }
    function recoverFrozenForkPrefix(prefix, events, genesis, closure, subjectSessionId = prefix.sessionId, readContext, storageScope = subjectSessionId) {
        try {
            readContext ??= prefixInputs.createReadContext(storageScope);
            const inputs = prefixInputs.prepareClosed(closure, prefixInputBinding(prefix), readContext);
            const revisionBases = prepareRevisionBases(prefix.sessionId, events, inputs.status, subjectSessionId, readContext);
            return inputs.read(() => recoverForkPrefix(prefix, events, genesis, revisionBases));
        }
        catch {
            return undefined;
        }
    }
    function verifyFrozenForkPrefix(prefix, events, genesis, closure, subjectSessionId = prefix.sessionId, readContext) {
        return recoverFrozenForkPrefix(prefix, events, genesis, closure, subjectSessionId, readContext) !== undefined;
    }
    function captureForkPrefix(sid, nativeCut, revisionBases) {
        const session = deps.session(sid);
        if (!session || !currentSession(session) || !Number.isSafeInteger(nativeCut) || nativeCut < 1
            || nativeCut > all(session).length)
            fail('SCHEMA_DERIVED_PARENT_UNPROVEN');
        // The durable closure is validated once by derived.prepare under its Source lock.
        const history = factual(session, nativeCut, true, false, false, undefined, revisionBases);
        const openingVariants = numericalHeads.read(sid).openingVariants;
        const body = { schemaVersion: 1, encoding: 'native-mvu-schema-frozen-prefix-v1', sessionId: sid,
            inheritedEventCount: session.inheritedEventCount, sourceSha256: history.snapshot.sourceSha256,
            original: history.original, seed: history.seed, initial: history.initial, journal: history.ready.frozen,
            eventKeys: history.eventKeys, snapshot: history.snapshot,
            consumed: [...history.consumed].map(([planSha256, closureSha256]) => ({ planSha256, closureSha256 })),
            ...openingVariants ? { openingVariants } : {} };
        const prefix = sealMvuSchemaInheritanceFact(body, 'prefixSha256');
        const ready = history.ready;
        recoveredPrefixes.set(ready, { original: history.original, scopes: history.readScopes,
            displayUpdates: history.displayUpdates ?? [], resolvedEdits: history.resolvedEdits,
            lastTaskResultCanonicalSeq: history.lastTaskResultCanonicalSeq,
            lastSettledStoryCanonicalSeq: history.lastSettledStoryCanonicalSeq,
            lastClosedStoryCanonicalSeq: history.lastClosedStoryCanonicalSeq,
            userEditAuthorizations: history.userEditAuthorizations, taskArtifacts: history.taskArtifacts, settledMessages: history.settledMessages });
        if (isAuthorHostJournalReadyV5(ready) && ready.epoch.program.nativeProgram) {
            return { prefix, ready, nativeProgram: { program: ready.epoch.program.nativeProgram, epochRef: ready.epochRef } };
        }
        return { prefix, ready };
    }
    function captureRevisionForkPrefix(sid, nativeCut) {
        const session = deps.session(sid);
        if (!session)
            fail('SCHEMA_SESSION_INACTIVE');
        const readContext = prefixInputs.createReadContext(sid), revisionBases = prepareRevisionBases(sid, all(session).slice(0, nativeCut), undefined, sid, readContext);
        const captured = prefixInputs.captureComputed(sid, () => {
            const selected = captureForkPrefix(sid, nativeCut, revisionBases);
            retainOpeningVariants(selected.prefix);
            return selected;
        }, result => prefixInputBinding(result.prefix));
        return { ...captured.result, closure: captured.closure, retainInputs: captured.retainInputs };
    }
    function readDataCurrent(view) {
        return !disposed && deps.session(view.session.id) === view.session && deps.agent(view.session) === view.agent;
    }
    function viewCurrent(view) { return view.read.current() && readDataCurrent(view); }
    function historicalSourceSha256(sid, ready, ordinal) {
        const first = ready.steps[ordinal];
        if (!first)
            fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
        if (ready.frozen.schemaVersion !== 1)
            for (const revision of ready.frozen.revisions) {
                const descriptor = validateMvuSchemaStoryRevisionDescriptor(revision.descriptor.value);
                if (descriptor.schemaVersion !== 1) {
                    const plan = prefixInputs.status.get(mvuSchemaStoryRevisionPlanKey(sid, recordSha256({ descriptor: { key: revision.descriptor.key, sha256: revision.descriptor.sha256 }, index: 0 })));
                    if (plan?.selectors[0]?.batchId === first.dispatch.batchId)
                        return plan.execution.sourceSha256;
                    continue;
                }
                const plan = prefixInputs.status.get(mvuSchemaStoryRevisionPlanKey(sid, revision.descriptor.sha256));
                if (plan?.selectors[0]?.batchId === first.dispatch.batchId)
                    return plan.base.sourceSha256;
            }
        const matches = [];
        const includeSource = (key, row) => {
            if (!key.startsWith(`${sid}__native-input-v2-terminal-`) && !key.startsWith(`${sid}__mvu-schema-player-plan-`))
                return false;
            const plan = (key.startsWith(`${sid}__native-input-v2-terminal-`)
                ? row?.plan?.plan : row);
            return plan?.realmEpoch === ready.epoch.realmEpoch && plan.selectors?.[0]?.batchId === first.dispatch.batchId;
        };
        for (const [key, row] of prefixInputs.branch.entries(undefined, includeSource)) {
            if (!includeSource(key, row))
                continue;
            const plan = (key.startsWith(`${sid}__native-input-v2-terminal-`)
                ? row?.plan?.plan : row);
            const base = 'operation' in plan ? plan.operation.base : plan.base;
            if (!base || base.sessionId !== sid || !/^[a-f0-9]{64}$/.test(base.sourceSha256))
                fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
            matches.push(base.sourceSha256);
        }
        if (matches.length !== 1)
            fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
        return matches[0];
    }
    function historicalCutData(selector, session = deps.session(selector.sessionId)) {
        if (!session || !currentSession(session) || !Number.isSafeInteger(selector.nativeCut)
            || selector.nativeCut < 1 || selector.nativeCut > all(session).length)
            fail('SCHEMA_SESSION_INACTIVE');
        // Select the pinned original realm explicitly. A read-only cut must not
        // borrow today's active pointer, current numerical head or later material.
        const prefix = all(session).slice(0, selector.nativeCut);
        const revisionBases = prepareRevisionBases(session.id, prefix);
        const sid = session.id, activation = activationFor(sid, prefix), derivedRequired = !activation && (deps.derivedRequired?.(sid) || session.inheritedEventCount || session.header.parentSession);
        const derived = derivedRequired ? deps.readDerivedGenesis?.(sid) : undefined;
        let original, ready, ordinal = 1, initial;
        let scopeSeed;
        if (activation) {
            original = activation.original;
            if (original.realmEpoch !== selector.realmEpoch)
                fail('OPENING_VARIANT_CONTINUATION_UNPROVEN');
            ready = readyFor(sid, selector.realmEpoch, prefix, null, true, activation.baseline);
            ordinal = 0;
            initial = activation.seed.snapshot;
            scopeSeed = scopesForActivation(activation, prefix);
        }
        else if (derivedRequired) {
            if (!derived || derived.original.realmEpoch !== selector.realmEpoch)
                fail('SCHEMA_DERIVED_GENESIS_UNPROVEN');
            if (derived.inheritedCut.nativeCut !== session.inheritedEventCount)
                fail('SCHEMA_DERIVED_GENESIS_UNPROVEN');
            const inherited = derived.inheritedReady ?? journal.validateFrozenReady(derived.inheritedCut, prefix.slice(0, derived.inheritedCut.nativeCut));
            original = derivedOriginal(derived.original, inherited, prefix.slice(0, derived.inheritedCut.nativeCut));
            if (!deps.source.originalFactsCurrent(original))
                fail('SCHEMA_DERIVED_GENESIS_UNPROVEN');
            ready = readyFor(sid, selector.realmEpoch, prefix, inherited, true);
            ordinal = inherited.steps.length;
            initial = derived.snapshot;
            scopeSeed = scopesForDerived(derived, prefix);
        }
        else {
            const includeOpening = (key, row) => key.startsWith(`${sid}__opening-choice-`)
                && row.schemaVersion === 5
                && row.preparation?.realmEpoch === selector.realmEpoch;
            const matches = [...prefixInputs.branch.entries(undefined, includeOpening)].filter(([key, row]) => includeOpening(key, row));
            if (matches.length !== 1)
                fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN');
            const intent = validateMvuSchemaOpeningIntent(matches[0][1]);
            if (intent.status !== 'completed' || !intent.initializationReceipt)
                fail('SCHEMA_OPENING_RECORD_INVALID');
            const selected = readyFor(sid, selector.realmEpoch, prefix, null, true);
            const captured = deps.source.captureCurrentOriginal(intent.preparation, { sessionId: sid, table: prefixInputs.status, events: prefix, ready: selected }, true);
            ready = captured.ready;
            original = captured.original;
            if (original.schemaVersion === 5)
                sourceOriginals.set(original.originalSha256, original);
            const opening = validateMvuSchemaOpeningEvent(prefixInputs.status.get(mvuInitializationEventKey(sid, intent.initializationReceipt.eventId)));
            const head = mvuSchemaOpeningHead(opening), seed = { kind: 'opening', intent, event: opening, head };
            if (!verifyMvuSchemaInheritedOpeningFacts({ intent, event: opening, head, events: prefix }, { projectPrefix: deps.projectPrefix }))
                fail('SCHEMA_OPENING_RECORD_INVALID');
            ordinal = openingPhaseCount(opening.plan);
            scopeSeed = openingProjectionsForOpening(seed, original, ready, prefix).scopes;
            // There is no numerical currency to borrow when no later author phase
            // exists. Otherwise its immutable durable plan supplies that wrapper;
            // the full base and Native work are independently proved below.
            if (ready.steps.length > ordinal)
                initial = initialForOpening(seed, historicalSourceSha256(sid, ready, ordinal), original, ready, prefix);
            else if (eventRows(sid, prefix.length).length)
                fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
        }
        if (initial) {
            const folded = consume(sid, session.inheritedEventCount, prefix, ready, initial, ordinal, true, scopeSeed, original, true, false, undefined, undefined, undefined, revisionBases, derived?.inheritedReady ? recoveredPrefixes.get(derived.inheritedReady)?.resolvedEdits : undefined, derived?.inheritedReady ? recoveredPrefixes.get(derived.inheritedReady)?.lastTaskResultCanonicalSeq : undefined, derived?.inheritedReady ? recoveredPrefixes.get(derived.inheritedReady)?.taskArtifacts : undefined, derived?.inheritedReady ? recoveredPrefixes.get(derived.inheritedReady)?.lastSettledStoryCanonicalSeq : undefined, derived?.inheritedReady ? recoveredPrefixes.get(derived.inheritedReady)?.userEditAuthorizations : undefined, undefined, undefined, derived?.inheritedReady ? recoveredPrefixes.get(derived.inheritedReady)?.settledMessages : undefined, derived?.inheritedReady ? recoveredPrefixes.get(derived.inheritedReady)?.lastClosedStoryCanonicalSeq : undefined);
            let semantic;
            try {
                verifyMvuSchemaUnpublishedTail({ sessionId: sid, inheritedEventCount: session.inheritedEventCount,
                    events: prefix, ready, ordinal: folded.ordinal, snapshot: folded.state, original }, {
                    branch: prefixInputs.branch, status: prefixInputs.status, projectPrefix: deps.projectPrefix, editProtocol: deps.editProtocol,
                    verifyFrozenFrame: deps.source.verifyFrozenFrame, associationAt: index => associationAt(sid, prefix, ready, index),
                    scopeFrameAt: (frame, cut) => {
                        if (!folded.readScopes)
                            fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                        return scopeFrameAt(folded.readScopes, original, frame, cut, prefix);
                    },
                    verifyScopeRef: (reference, frame, cut, logicalCut) => {
                        if (!folded.readScopes || !scopeRefAvailable(ready))
                            fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                        semantic ??= scopeSemantic({ id: sid }, prefix);
                        semantic.verify(ready, reference, folded.readScopes, original, frame, cut, logicalCut);
                    },
                });
            }
            finally {
                semantic?.dispose();
            }
        }
        return historicalCutFacts(original, ready, session);
    }
    function historicalCutFacts(original, ready, session) {
        return Object.freeze({ facts: Object.freeze({ authorInput: schemaOriginalReplayCompilationInput(original),
                ready, frozen: ready.frozen, events: all(session) }), originalSha256: original.originalSha256 });
    }
    async function captureHistoricalCut(selector) {
        const session = deps.session(selector.sessionId), { facts } = historicalCutData(selector, session);
        // Re-admit protected bytes for every waiter, including a cache hit.
        await protectedFor(facts.ready);
        return { ...facts, events: all(session) };
    }
    async function borrowHistoricalCut(selector, signal) {
        signal?.throwIfAborted();
        const read = deps.inputState.borrowHistorical(selector.sessionId, () => {
            const captured = deps.inputState.reuseSchema(selector.sessionId, ({ history }) => history.original.realmEpoch === selector.realmEpoch && ('materialize' in history.ready
                ? history.ready.nativeCut : history.ready.frozen.nativeCut) === selector.nativeCut);
            // preflight has already folded this exact cut into its owned History.
            // Replay still verifies it; rebuilding the same Source and numerical fold
            // here only repeats that owner's work before the replay cache is consulted.
            return captured ? historicalCutFacts(captured.data.history.original, journalFull(captured.data.history.ready), captured.data.session) : historicalCutData(selector);
        });
        try {
            await protectedFor(read.data.facts.ready);
            signal?.throwIfAborted();
            const current = () => !disposed && !signal?.aborted && read.current();
            if (!current())
                fail('SCHEMA_HISTORICAL_FACTS_CHANGED');
            return Object.freeze({ ...read.data.facts, originalSha256: read.data.originalSha256, current, release: read.release });
        }
        catch (error) {
            read.release();
            throw error;
        }
    }
    function ownerCurrent(owner) {
        // Publication writers hold the Source lease; edits and stops revoke this
        // closing owner. Earlier publication events remain immutable.
        const sid = owner.view.session.id, view = deps.closingView(owner.lease, owner.plan.scope);
        if (!view || disposed || owner.abort.signal.aborted || owners.get(sid) !== owner
            || view.agent !== owner.view.agent || view.session !== owner.view.session || !currentSession(owner.view.session)
            || deps.agent(owner.view.session) !== view.agent
            || deps.sourceSha256(sid) !== owner.plan.scope.currency.source.sourceSha256
            || !deps.source.frameCurrent(owner.original, owner.frame))
            return false;
        const body = deps.readCanonical(sid, owner.plan.scope.receipt.checkpoint.actualTurn);
        return !!body && same(owner.plan.canonical, { ...body, narrativeSha256: sha256(body.narrative) });
    }
    function checkOwned(scope, boundary) {
        try {
            const revision = revisionScopes.get(scope.owner);
            if (revision)
                return checkRevisionOwned(revision, scope, boundary);
            const owner = scopes.get(scope.owner), session = owner?.view.session;
            if (!owner || !session || !ownerCurrent(owner) || scope.incarnation !== owner.view.agent || scope.session !== session
                || scope.signal.aborted || !owner.scope
                || (scope.requestedStep !== owner.scope.requestedStep && !same(scope.requestedStep, owner.scope.requestedStep)))
                return false;
            const events = actualNative(session), initial = owner.plan.initialCut, cut = scope.sourceNativeCut.nativeCut;
            // Replay proves each new full cut once. This same Native incarnation has
            // an immutable prefix, so later callbacks bind the cut and check its tail.
            const owned = [...owner.associations, ...owner.hooks.map(hook => hook.journal)]
                .filter(item => item.completionMarker.seq < cut).sort((a, b) => a.completionMarker.seq - b.completionMarker.seq);
            if (!same(scope.sourceNativeCut, owner.scope.sourceNativeCut)
                || cut !== (owned.at(-1)?.completionMarker.seq ?? initial.nativeCut - 1) + 1)
                return false;
            for (const association of owner.associations)
                for (const ref of [association.dispatchMarker, association.completionMarker]) {
                    if (recordSha256(events.at(ref.seq)) !== ref.sha256)
                        return false;
                }
            for (const hook of owner.hooks)
                for (const ref of [hook.journal.dispatchMarker, hook.journal.completionMarker]) {
                    if (recordSha256(events.at(ref.seq)) !== ref.sha256)
                        return false;
                }
            for (const [index, ref] of [boundary.dispatchMarker, boundary.completionMarker].entries()) {
                if (ref && (ref.seq !== cut + index || recordSha256(events.at(ref.seq)) !== ref.sha256))
                    return false;
            }
            const count = boundary.completionMarker ? 2 : boundary.dispatchMarker ? 1 : 0;
            if (events.length !== cut + count)
                return false;
            return boundary.stage === 'returned' || owner.inSource && sourceLeases.get(session.id) === owner;
        }
        catch {
            return false;
        }
    }
    async function withLease(owner, action) {
        if (!ownerCurrent(owner))
            fail('SCHEMA_STORY_PERMISSION_REVOKED');
        const sid = owner.view.session.id;
        if (owner.inSource && sourceLeases.get(sid) === owner)
            return action();
        return deps.withSourceLock(sid, async () => {
            if (!ownerCurrent(owner))
                fail('SCHEMA_STORY_PERMISSION_REVOKED');
            owner.inSource = true;
            sourceLeases.set(sid, owner);
            try {
                return await action();
            }
            finally {
                owner.inSource = false;
                if (sourceLeases.get(sid) === owner)
                    sourceLeases.delete(sid);
            }
        });
    }
    function identityTuple(ready) {
        if (isAuthorHostJournalReadyV5(ready))
            return ready.epoch.server.executor;
        const { program, runner } = schemaEpochExecution(ready.epoch);
        return { compiler: program.compiler, bridge: program.bridge, libraries: program.libraries, runner };
    }
    async function protectedFor(ready) {
        const tuple = identityTuple(ready), host = isAuthorHostJournalReadyV5(ready) ? ready.epoch.host : undefined;
        const runtime = await deps.protectedRuntime(tuple, host);
        if (disposed)
            fail('SCHEMA_RUNTIME_DISPOSED');
        if (runtime.executorVersion !== (host ? 4 : ready.epoch.schemaVersion)
            || (host ? !('host' in runtime) || !same(runtime.host.identity, host)
                || runtime.implementationKey !== recordSha256(host) : runtime.implementationKey !== recordSha256(tuple))
            || !same(tuple, { compiler: runtime.compiler.identity, bridge: runtime.bridge, libraries: runtime.libraries,
                runner: runtime.runner.identity, ...(host ? { stateLoader: runtime.stateLoader } : {}) })) {
            fail('SCHEMA_IMPLEMENTATION_CHANGED');
        }
        return runtime;
    }
    async function engine(ready) {
        const runtime = await protectedFor(ready);
        let driver = drivers.get(runtime.implementationKey);
        if (!driver) {
            const bindings = { table: prefixInputs.status,
                recordOwner: deps.inputState.schemaJournal, nativeHistory: deps.inputState.nativeHistory,
                scopeReferences: scopeBindings, resolveExecutionBaseline: (ref, sid) => openingArchivesFor(sid).resolve(ref),
                markers: deps.markers, captureHistoricalCut, borrowHistoricalCut, flush: deps.flush, captureOwned: selector => {
                    const revision = revisionOwners.get(selector.sessionId);
                    if (revision) {
                        if (!revision.scope || revision.driver !== driver || !revision.inSource || !revisionCurrent(revision)
                            || revision.scope.requestedStep.eventId !== selector.batchId)
                            fail('SCHEMA_REVISION_OWNER_UNPROVEN');
                        return revision.scope;
                    }
                    const owner = owners.get(selector.sessionId);
                    if (!owner?.scope || owner.driver !== driver || !owner.inSource || !ownerCurrent(owner)
                        || owner.scope.requestedStep.eventId !== selector.batchId)
                        fail('SCHEMA_OWNER_UNPROVEN');
                    return owner.scope;
                }, checkOwned, withSourceBoundary: (scope, action) => {
                    const revision = revisionScopes.get(scope.owner);
                    if (revision) {
                        if (!revision.inSource || !revisionCurrent(revision))
                            fail('SCHEMA_REVISION_PERMISSION_REVOKED');
                        return action();
                    }
                    const owner = scopes.get(scope.owner);
                    if (!owner)
                        fail('SCHEMA_OWNER_UNPROVEN');
                    return withLease(owner, action);
                } };
            driver = 'host' in runtime ? runtime.host.createReplay(bindings) : createRoleplayMvuSchemaReplay({ ...bindings,
                executorVersion: runtime.executorVersion, compiler: runtime.compiler, runner: runtime.runner });
            drivers.set(runtime.implementationKey, driver);
        }
        return { runtime, driver };
    }
    function revisionCurrent(owner) {
        return !disposed && !owner.signal.aborted && revisionOwners.get(owner.session.id) === owner
            && currentSession(owner.session) && deps.agent(owner.session) === owner.agent
            && deps.source.frameCurrent(owner.original, owner.frame);
    }
    function checkRevisionOwned(owner, scope, boundary) {
        if (!revisionCurrent(owner) || !owner.inSource || scope.signal.aborted || scope.session !== owner.session
            || scope.incarnation !== owner.agent || !owner.scope
            || scope.requestedStep !== owner.scope.requestedStep && !same(scope.requestedStep, owner.scope.requestedStep))
            return false;
        const events = all(owner.session), cut = scope.sourceNativeCut.nativeCut;
        for (const [index, ref] of [boundary.dispatchMarker, boundary.completionMarker].entries()) {
            if (ref && (ref.seq !== cut + index || recordSha256(events[ref.seq]) !== ref.sha256))
                return false;
        }
        return events.length === cut + (boundary.completionMarker ? 2 : boundary.dispatchMarker ? 1 : 0);
    }
    async function putRevisionFact(key, value, prior) {
        const actual = prefixInputs.status.get(key);
        if (same(actual, value))
            return;
        if (!same(actual, prior))
            fail('SCHEMA_REVISION_WRITE_CONFLICT');
        try {
            await prefixInputs.status.put(key, value);
        }
        catch { /* Exact readback owns a lost acknowledgement. */ }
        if (!same(prefixInputs.status.get(key), value))
            fail('SCHEMA_REVISION_WRITE_UNKNOWN');
    }
    function beforeStoryRevision(session, history, event) {
        const events = all(session).slice(0, event.plan.initialCut.nativeCut);
        const ready = journal.recutChecked(session.id, event.plan.realmEpoch, events, journalFull(history.ready));
        if (ready.kind !== 'ready')
            fail(ready.code);
        let ordinal, projections;
        if (history.seed.kind === 'opening') {
            ordinal = openingPhaseCount(history.seed.event.plan);
            projections = openingProjectionsForOpening(history.seed, history.original, ready, events, true);
        }
        else if (history.seed.kind === 'activation') {
            const activation = activationFor(session.id, events, history.seed.activationRef);
            if (!activation)
                fail('OPENING_VARIANT_ACTIVATION_UNPROVEN');
            ordinal = 0;
            projections = { scopes: scopesForActivation(activation, events), displayUpdates: [] };
        }
        else {
            const genesis = deps.readDerivedGenesis?.(session.id);
            if (!genesis || !history.inheritedReady || genesis.inheritedCut.schemaVersion !== 1)
                fail('SCHEMA_REVISION_DERIVED_UNSUPPORTED');
            ordinal = history.inheritedReady.steps.length;
            projections = { scopes: scopesForDerived(genesis, events), displayUpdates: displayForDerived(genesis, events) };
        }
        const folded = consume(session.id, session.inheritedEventCount, events, ready, history.initial, ordinal, true, projections.scopes, history.original, false, true, projections.displayUpdates, undefined, undefined, undefined, undefined, undefined, undefined, history.inheritedReady ? recoveredPrefixes.get(history.inheritedReady)?.lastSettledStoryCanonicalSeq : undefined, history.inheritedReady ? recoveredPrefixes.get(history.inheritedReady)?.userEditAuthorizations : undefined, undefined, undefined, history.inheritedReady ? recoveredPrefixes.get(history.inheritedReady)?.settledMessages : undefined, history.inheritedReady ? recoveredPrefixes.get(history.inheritedReady)?.lastClosedStoryCanonicalSeq : undefined);
        const state = snapshot({ ...folded.state, sourceSha256: event.plan.base.sourceSha256 });
        if (!same(state, event.plan.base))
            fail('SCHEMA_REVISION_BASE_UNPROVEN');
        const basis = { ...history, ready, snapshot: state, consumed: folded.consumed, eventKeys: folded.eventKeys,
            readScopes: folded.readScopes, displayUpdates: folded.displayUpdates, resolvedEdits: folded.resolvedEdits, settledMessages: folded.settledMessages,
            lastTaskResultCanonicalSeq: folded.lastTaskResultCanonicalSeq,
            lastSettledStoryCanonicalSeq: folded.lastSettledStoryCanonicalSeq,
            lastClosedStoryCanonicalSeq: folded.lastClosedStoryCanonicalSeq,
            userEditAuthorizations: folded.userEditAuthorizations, taskArtifacts: folded.taskArtifacts };
        if (history.inheritedReady)
            Object.defineProperty(basis, 'inheritedReady', { value: history.inheritedReady });
        return basis;
    }
    function revisionPlanEventId(plan) {
        if (plan.schemaVersion === 9)
            return mvuSchemaPlayerRevisionEventId(plan);
        return recordSha256({ encoding: plan.schemaVersion === 8 || plan.schemaVersion === 11 ? 'native-mvu-schema-story-revision-event-identity-v2'
                : 'native-mvu-schema-story-revision-event-identity-v1', planSha256: plan.planSha256 });
    }
    function recoverRevision(owner) {
        const plan = owner.plan, events = all(owner.session);
        const ready = journal.captureChecked(owner.session.id, plan.realmEpoch, events, owner.basis.inheritedReady ?? null, false, owner.basis.ready.executionBaseline);
        if (ready.kind !== 'ready')
            fail('SCHEMA_REVISION_EXECUTION_UNKNOWN');
        const phases = [];
        const phaseNames = plan.schemaVersion === 9 ? MVU_SCHEMA_PLAYER_PHASES : MVU_SCHEMA_STORY_PHASES;
        let reducer = null;
        for (const [index, selector] of plan.selectors.entries()) {
            const ordinal = ready.steps.findIndex(step => step.dispatch.batchId === selector.batchId), step = ready.steps[ordinal];
            // An incomplete attempt retains its original anchor. Recovery consumes
            // completed Journal output; it never executes the remaining selectors.
            if (!step)
                fail('SCHEMA_REVISION_EXECUTION_UNKNOWN');
            phases.push(freezeSchemaJournalData({ phase: phaseNames[index], input: step.step.frame.input,
                association: associationAt(owner.session.id, events, ready, ordinal), output: step.step.output }));
            if (step.step.output.kind === 'refused')
                break;
            if (plan.schemaVersion === 9) {
                if (step.step.output.commands.length)
                    break;
                if (index === 1 && mvuSchemaPlayerReducerBridge(phases[1]).result.kind === 'rejected')
                    break;
            }
            else if (index === 0) {
                reducer = mvuSchemaStoryReducerBridge(phases[0]);
                if (reducer.result.kind === 'rejected')
                    break;
            }
        }
        return plan.schemaVersion === 9
            ? validateMvuSchemaPlayerRevisionEvent(mvuSchemaPlayerRevisionEvent(plan, phases))
            : validateMvuSchemaStoryRevisionEvent(mvuSchemaStoryRevisionEvent(plan, phases, reducer));
    }
    async function executeRevision(owner) {
        const phases = [], plan = owner.plan;
        const phaseNames = plan.schemaVersion === 9 ? MVU_SCHEMA_PLAYER_PHASES : MVU_SCHEMA_STORY_PHASES;
        let reducer = null;
        for (const [index, phase] of phaseNames.entries()) {
            const selector = plan.selectors[index], events = all(owner.session);
            const captureJournal = () => journal.captureChecked(owner.session.id, plan.realmEpoch, all(owner.session), owner.basis.inheritedReady ?? null, false, owner.basis.ready.executionBaseline);
            const ready = captureJournal();
            if (ready.kind !== 'ready')
                fail(ready.code);
            // Journal owns the exact Native cut captured synchronously above.
            const cut = { ...plan.initialCut, nativeCut: ready.frozen.nativeCut,
                nativePrefixSha256: ready.frozen.nativePrefixSha256, anchor: selector.anchor };
            const frame = scopeFrameAt(owner.basis.readScopes, owner.original, owner.frame, cut, events, plan.schemaVersion === 8 || plan.schemaVersion === 9 || plan.schemaVersion === 11 ? plan.logicalNativeCut : undefined, owner.projection);
            const input = plan.schemaVersion === 9 ? mvuSchemaPlayerPhaseInput(plan, index, phases, frame)
                : mvuSchemaStoryPhaseInput(plan, index, phases, reducer, frame);
            const requestedStep = schemaTraceRequestedStep(selector.batchId, { ownerSessionId: owner.session.id, sourceNativeCutSha256: recordSha256(cut), material: owner.frame.material }, input);
            owner.scope = { owner: owner.token, incarnation: owner.agent, session: owner.session, signal: owner.signal,
                authorInput: schemaOriginalReplayCompilationInput(owner.original), realmEpoch: plan.realmEpoch,
                loadFrame: schemaEpochExecution(ready.epoch).loadFrame, inheritedCut: owner.basis.inheritedCut, journalCut: ready,
                sourceNativeCut: freezeSchemaJournalData(cut), requestedStep,
                compiledProgram: owner.compiledProgram };
            Object.defineProperty(owner.scope, 'captureJournal', { value: captureJournal });
            if (owner.basis.inheritedReady)
                Object.defineProperty(owner.scope, 'inheritedReady', { value: owner.basis.inheritedReady });
            const result = await owner.driver.execute(selector);
            if (result.kind !== 'completed')
                fail(result.code);
            owner.lastLive = result;
            owner.compiledProgram = result.compiledProgram;
            owner.associations.push(result.association);
            phases.push(freezeSchemaJournalData({ phase, input, association: result.association, output: result.output }));
            if (result.output.kind === 'refused')
                break;
            if (plan.schemaVersion === 9) {
                if (result.output.commands.length)
                    break;
                if (index === 1 && mvuSchemaPlayerReducerBridge(phases[1]).result.kind === 'rejected')
                    break;
            }
            else if (index === 0) {
                reducer = mvuSchemaStoryReducerBridge(phases[0]);
                if (reducer.result.kind === 'rejected')
                    break;
            }
        }
        const last = owner.lastLive;
        owner.associations.pop();
        let verified;
        try {
            verified = owner.driver.checkEvidence(last.evidence, { association: last.association, output: last.output });
        }
        finally {
            owner.associations.push(last.association);
        }
        if (!verified)
            fail('SCHEMA_REVISION_EXECUTION_UNPROVEN');
        return plan.schemaVersion === 9
            ? validateMvuSchemaPlayerRevisionEvent(mvuSchemaPlayerRevisionEvent(plan, phases))
            : validateMvuSchemaStoryRevisionEvent(mvuSchemaStoryRevisionEvent(plan, phases, reducer));
    }
    /** Only this owner interprets durable edit resolution. Native owns its
     * maintenance reservation and marker rewind; old completion facts stay intact. */
    async function reconcileAcceptedEdit(sid, requestedSeq, recovery) {
        const session = deps.session(sid);
        if (!session || !currentSession(session))
            return;
        const agent = deps.agent(session), prior = editReconciliations.get(sid);
        if (prior?.session === session && prior.agent === agent) {
            await prior.work;
            // A read can consume this live publication. A different accepted edit,
            // or a write following a read-only no-op, still owns its requested seq.
            if (requestedSeq !== undefined && (prior.requestedSeq !== requestedSeq || prior.recoveryKey !== recovery?.ref.key))
                await reconcileAcceptedEdit(sid, requestedSeq, recovery);
            else if (recovery)
                recovery.replayed = true;
            return;
        }
        const settled = Promise.withResolvers(), pending = { session, agent, requestedSeq, recoveryKey: recovery?.ref.key, work: settled.promise };
        // Register before entering Native: the Source lock lives inside its
        // maintenance reservation, so a second caller must join before reserving.
        editReconciliations.set(sid, pending);
        void (async () => {
            try {
                if (await reconcileStorySuffix(sid, requestedSeq, recovery))
                    return;
                if (recovery)
                    fail('SCHEMA_SUFFIX_EDIT_UNAVAILABLE');
                if (!currentSession(session) || deps.agent(session) !== agent)
                    fail('SCHEMA_REVISION_PERMISSION_REVOKED');
                await reconcileAcceptedEditV1(sid, requestedSeq);
            }
            finally {
                if (editReconciliations.get(sid) === pending)
                    editReconciliations.delete(sid);
            }
        })().then(settled.resolve, settled.reject);
        await pending.work;
    }
    async function reconcileExistingUserEditRecovery(sid, prepared) {
        const recovery = { ...prepared };
        await reconcileAcceptedEdit(sid, prepared.intent.edit.seq, recovery);
        if (!taskEditResolved(sid, prepared.intent.edit.seq))
            fail('SCHEMA_SUFFIX_EDIT_UNRESOLVED');
        return { replayed: recovery.replayed === true };
    }
    function revisionResultBasis(history, event) {
        const head = suffixHead(event), state = snapshot({ schemaVersion: 2,
            encoding: 'native-mvu-schema-state-snapshot-v2', sessionId: event.sessionId, sourceSha256: event.sourceSha256,
            root: event.plan.execution.root, currentHead: head, revision: head.revision, headSha256: recordSha256(head),
            values: event.values, valuesSha256: event.valuesSha256, context: event.context, schemaFrontier: event.frontier });
        const facts = history.readScopes;
        if (isManualRevision(event)) {
            const stateRef = { kind: 'manual', ownerSessionId: event.sessionId,
                recordKey: mvuSchemaStoryRevisionEventKey(event.sessionId, event.eventId), recordSha256: recordSha256(event),
                valuesSha256: event.valuesSha256, revision: state.revision };
            // A completed refusal preserves DATA. Rebind only a current manual chat;
            // an older chat must not shadow a later Story's message state in Browser.
            const source = schemaScopeSource(event.plan.currentFrame.snapshot), target = publishedMessageTarget(facts, event);
            let messages = facts.messages;
            if (target && event.outcome !== 'refused') {
                const published = new Map(messages);
                published.set(schemaScopeMessageKey(target.ownerSessionId, target.nativeSeq, target.messageId, target.messageVersionSha256), schemaScopePublished(schemaScopeOwner(source, 'message', target.messageId, event.sessionId), stateRef, event.values, event.context));
                messages = published;
            }
            const readScopes = { ...facts, messages, currentMessageCarrier: null,
                chat: event.outcome === 'refused' && !manualChatAtBase(facts.chat, event.plan.base) ? facts.chat
                    : schemaScopePublished(schemaScopeOwner(source, 'chat'), stateRef, event.values, event.context) };
            const next = { ...history, snapshot: state, readScopes };
            if (history.inheritedReady)
                Object.defineProperty(next, 'inheritedReady', { value: history.inheritedReady });
            return next;
        }
        const source = schemaScopeSource(event.plan.currentFrame.snapshot), canonical = event.plan.canonical;
        const messageOwner = scopeOwnerForSeq(facts, canonical.seq);
        const stateRef = { kind: 'story', ownerSessionId: event.sessionId,
            recordKey: mvuSchemaStoryRevisionEventKey(event.sessionId, event.eventId), recordSha256: recordSha256(event),
            valuesSha256: event.valuesSha256, revision: state.revision };
        const messages = new Map(facts.messages);
        messages.set(schemaScopeMessageKey(messageOwner, canonical.seq, canonical.messageId, canonical.versionSha256), schemaScopePublished(schemaScopeOwner(source, 'message', canonical.messageId, event.sessionId), stateRef, event.values, event.context));
        const next = { ...history, snapshot: state, readScopes: { ...facts, messages, currentMessageCarrier: null, chat: facts.updateChat
                    ? schemaScopePublished(schemaScopeOwner(source, 'chat'), stateRef, event.values, event.context) : facts.chat } };
        if (history.inheritedReady)
            Object.defineProperty(next, 'inheritedReady', { value: history.inheritedReady });
        return next;
    }
    /** One maintenance reservation owns the whole deterministic Story suffix.
     * Original scopes describe history; only this current Native owner executes. */
    function savedSuffixRefusal(descriptor, ref) {
        for (let index = 0; index < descriptor.originals.length; index++) {
            const raw = prefixInputs.status.get(mvuSchemaStoryRevisionPlanKey(descriptor.sessionId, recordSha256({ descriptor: ref, index })));
            if (raw === undefined)
                continue;
            const supplied = raw;
            const plan = supplied.schemaVersion === 9 ? validateMvuSchemaPlayerRevisionPlan(supplied) : validateMvuSchemaStoryPlan(supplied);
            const key = mvuSchemaStoryRevisionEventKey(descriptor.sessionId, revisionPlanEventId(plan));
            const saved = prefixInputs.status.get(key);
            if (saved === undefined)
                continue;
            const event = readRevisionEvent(saved);
            if (event.encoding === 'native-mvu-schema-story-revision-event-v2' && event.outcome === 'refused')
                return { key, event };
        }
        return undefined;
    }
    function readSuffixRevisionOutcome(sid, row) {
        const descriptor = validateMvuSchemaStoryRevisionDescriptor(prefixInputs.status.get(row.data.descriptor.key));
        if (descriptor.schemaVersion === 1)
            return undefined;
        const raw = prefixInputs.status.get(mvuSchemaStoryRevisionCompletionKey(sid, row.data.descriptor.sha256));
        return { descriptor, completion: raw === undefined ? undefined : validateMvuSchemaStoryRevisionCompletion(raw),
            refusal: raw === undefined && descriptor.sessionId === sid ? savedSuffixRefusal(descriptor, { key: row.data.descriptor.key, sha256: row.data.descriptor.sha256 }) : undefined };
    }
    async function reconcileStorySuffix(sid, requestedSeq, recovery) {
        const session = deps.session(sid);
        if (!session || !currentSession(session))
            return false;
        // Ancestor edits are already closed by the inherited seed. A new child
        // edit remains local even when its target belongs to that inherited prefix.
        const currentUserHashes = new Map(), current = deps.currentEdits(session).filter(edit => {
            if (edit.seq < session.inheritedEventCount)
                return false;
            if (edit.type === 'roleplay/message-edit' && edit.data.role === 'user')
                currentUserHashes.set(edit.seq, recordSha256(edit));
            return true;
        }), requested = requestedSeq === undefined ? undefined : current.find(row => row.seq === requestedSeq);
        if (requestedSeq !== undefined && !requested)
            return false;
        const invalidation = deps.readEditInvalidation?.(sid);
        if (invalidation?.kind !== 'invalidated' && !recovery)
            return false;
        const events = all(session);
        const denialCode = invalidation?.kind === 'invalidated' ? invalidation.code : 'SCHEMA_SUFFIX_EDIT_UNRESOLVED';
        const taskPointer = prefixInputs.branch.get(schemaTaskEditActiveKey(sid));
        const taskIntent = taskPointer ? validateSchemaTaskEditIntent(prefixInputs.status.get(taskPointer.key)) : undefined;
        if (recovery && taskIntent)
            fail('SCHEMA_TASK_EDIT_PENDING');
        if (taskIntent && recordSha256(taskIntent) !== taskPointer.sha256)
            fail('SCHEMA_TASK_EDIT_INTENT_UNPROVEN');
        const taskBinding = taskIntent ? validateSchemaTaskEditBindingV1(prefixInputs.status.get(schemaTaskEditBindingKey(sid, taskIntent.operationId))) : undefined;
        const taskBindingRef = taskBinding && { key: schemaTaskEditBindingKey(sid, taskIntent.operationId), sha256: recordSha256(taskBinding) };
        const markers = events.filter((row) => row.type === deps.markers.revisionEventType);
        const completedUsers = new Map(), legacyAuthorizations = new Map();
        let closedEdits = [];
        let refused;
        for (const row of markers) {
            const outcome = readSuffixRevisionOutcome(sid, row);
            if (!outcome)
                continue;
            const { descriptor, completion } = outcome;
            if (completion !== undefined) {
                refused = undefined;
                closedEdits = descriptor.edits;
                let completedProof;
                for (const edit of descriptor.edits)
                    if ('role' in edit && edit.role === 'user') {
                        completedUsers.set(edit.seq, edit.sha256);
                        if (taskIntent?.schemaVersion === 2 && descriptor.schemaVersion === 4 && completion.schemaVersion === 4
                            && currentUserHashes.get(edit.seq) === edit.sha256 && !legacyAuthorizations.has(edit.seq)) {
                            completedProof ??= { kind: 'completed-v4', descriptor: row.data.descriptor,
                                completion: { key: mvuSchemaStoryRevisionCompletionKey(sid, row.data.descriptor.sha256), sha256: recordSha256(completion) } };
                            legacyAuthorizations.set(edit.seq, { edit: { seq: edit.seq, sha256: edit.sha256 }, proof: completedProof });
                        }
                    }
            }
            else if (descriptor.sessionId === sid) {
                const result = outcome.refusal;
                refused = result ? { priorCut: refused?.priorCut ?? row.seq, descriptor, result } : undefined;
            }
        }
        const boundEdit = taskBinding && events[taskBinding.edit.seq], boundUser = taskIntent?.target.role === 'user' && taskBinding && boundEdit?.type === 'roleplay/message-edit'
            && taskBinding.edit.seq === taskIntent.basis.nativeCut && currentUserHashes.get(boundEdit.seq) === taskBinding.edit.sha256
            && boundEdit.data.role === 'user' && boundEdit.data.targetSeq === taskIntent.target.seq
            && boundEdit.data.messageId === taskIntent.target.messageId && boundEdit.data.text === taskIntent.target.text
            && taskBinding.intent.key === taskPointer.key && taskBinding.intent.sha256 === taskPointer.sha256
            ? taskBinding.edit : undefined, recoveredUser = recovery && currentUserHashes.get(recovery.intent.edit.seq) === recovery.intent.edit.sha256
            ? recovery.intent.edit : undefined, authorizedUser = boundUser ?? recoveredUser, suffixRevision = taskIntent?.schemaVersion === 2 || !!recovery, includeClosedUsers = !!taskIntent || !!recovery || requested?.type === 'roleplay/message-edit' && requested.data.role === 'user';
        if (suffixRevision && !authorizedUser)
            fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
        const selectedEdits = current.flatMap(row => {
            if (row.type !== 'roleplay/message-edit')
                return [];
            const hash = row.data.role === 'user' ? currentUserHashes.get(row.seq) : recordSha256(row);
            if (row.data.role === 'user' && !(authorizedUser && row.seq === authorizedUser.seq)
                && (!includeClosedUsers || completedUsers.get(row.seq) !== hash))
                return [];
            const target = events[row.data.targetSeq];
            if (target?.type !== 'assistant/message' && target?.type !== 'user/message')
                fail('SCHEMA_REVISION_TARGET_UNPROVEN');
            const originalMessage = target.type === 'assistant/message' ? target.data.message : target.data;
            const message = deps.editProtocol.editMessageText(originalMessage, row.data), narrative = textOf(message.content);
            return [{ seq: row.seq, sha256: hash, targetSeq: target.seq, messageId: message.id,
                    messageVersionSha256: recordSha256(message), narrativeSha256: sha256(narrative),
                    role: row.data.role }];
        }).sort((a, b) => a.seq - b.seq);
        const roleEdits = !!taskIntent || selectedEdits.some(edit => edit.role === 'user'), edits = roleEdits ? selectedEdits : selectedEdits.map(({ role: _role, ...edit }) => edit);
        if (!edits.length) {
            if (suffixRevision)
                fail('SCHEMA_SUFFIX_EDIT_UNRESOLVED');
            return false;
        }
        const descriptorKey = mvuSchemaStoryRevisionDescriptorKey(sid, recordSha256({
            encoding: 'native-mvu-schema-story-revision-request-v2', edits
        }));
        const saved = prefixInputs.status.get(descriptorKey);
        const stored = saved === undefined ? undefined : validateMvuSchemaStoryRevisionDescriptor(saved);
        if (recovery && stored && (stored.schemaVersion !== 5 || !stored.authorizations.some(authorization => authorization.edit.seq === recovery.intent.edit.seq && authorization.proof.kind === 'post-commit-recovery'
            && same(authorization.proof.intent, recovery.ref))))
            fail('SCHEMA_USER_EDIT_RECOVERY_OPERATION_CONFLICT');
        if (stored) {
            if (savedSuffixRefusal(stored, { key: descriptorKey, sha256: recordSha256(stored) })) {
                if (requestedSeq === undefined || stored.schemaVersion === 5)
                    fail(denialCode);
                return true;
            }
            const completed = prefixInputs.status.get(mvuSchemaStoryRevisionCompletionKey(sid, recordSha256(stored)));
            if (completed !== undefined) {
                const closure = validateMvuSchemaStoryRevisionCompletion(completed);
                const last = closure.events.at(-1), event = readRevisionEvent(prefixInputs.status.get(last.key));
                if (!isSuffixEvent(event) || recordSha256(event) !== last.sha256)
                    fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
                const head = mvuNumericalPublicationLeaf(prefixInputs.status.get(mvuStateCurrentHeadKey(sid)));
                if (same(head, suffixHead(event)) || Number(head?.revision) > event.plan.revision.publicationRevision) {
                    if (stored.schemaVersion === 5)
                        publishSchemaRead(captureSchemaRead(sid));
                    if (recovery)
                        recovery.replayed = true;
                    return true;
                }
            }
        }
        const marker = stored && markers.find(row => row.data.descriptor.key === descriptorKey);
        const currentEditHashes = new Map(edits.map(edit => [edit.seq, edit.sha256])), resolved = new Set(closedEdits.filter(edit => currentEditHashes.get(edit.seq) === edit.sha256).map(edit => edit.seq));
        // A legacy assistant descriptor retains earlier user edits in its closed
        // basis rather than its edit list. Keep their exact completed identities
        // when selecting the rewind cut, so their receipts remain inside it.
        for (const [seq, sha256] of completedUsers)
            if (currentEditHashes.get(seq) === sha256)
                resolved.add(seq);
        // A newer malformed save has no descriptor, but a prior known refusal
        // still owns the denial. A GET may repair saved work, never start it.
        if (saved === undefined && requestedSeq === undefined) {
            if (refused)
                fail(denialCode);
            return false;
        }
        let unresolved = edits.filter(edit => !resolved.has(edit.seq));
        if (!stored && !unresolved.length) {
            if (suffixRevision)
                fail('SCHEMA_SUFFIX_EDIT_UNRESOLVED');
            return true;
        }
        // A known refusal never publishes its partial suffix. A corrected save
        // starts from the complete chain that preceded that failed rewind.
        const priorCut = marker?.seq ?? refused?.priorCut ?? Math.min(...unresolved.map(edit => edit.seq));
        const priorEvents = events.slice(0, priorCut), native = deps.markers.readEffectiveHistory(priorEvents);
        const ownerIds = new Set([sid]);
        for (const row of priorEvents)
            if (row.type === deps.markers.dispatchEventType)
                ownerIds.add(row.data.sessionId);
        const allRows = [...ownerIds].flatMap(owner => eventRows(owner, priorCut));
        const originalPlans = new Set(allRows.filter(row => row.event.encoding === 'native-mvu-schema-story-event-v2')
            .map(row => row.event.plan.planSha256));
        const authorizationCandidates = suffixRevision && !stored
            ? new Map(selectedEdits.filter(edit => edit.role === 'user' && legacyAuthorizations.has(edit.seq))
                .map(edit => [edit.seq, legacyAuthorizations.get(edit.seq)])) : undefined, readContext = prefixInputs.createReadContext(sid), prior = factual(session, priorCut, true, true, false, originalPlans, undefined, readContext, authorizationCandidates);
        if (!isAuthorHostJournalReadyV5(prior.ready)) {
            if (suffixRevision)
                fail('SCHEMA_SUFFIX_EDIT_UNAVAILABLE');
            return false;
        }
        const priorReady = prior.ready;
        unresolved = edits.filter(edit => !prior.resolvedEdits.has(edit.seq));
        const batches = new Set([...native.epochs.values()].flatMap(epoch => epoch.pairs.map(pair => pair.dispatch.data.batchId)));
        const activeRows = allRows.filter(row => batches.has(row.event.phases[0].association.batchId))
            .sort((a, b) => a.event.phases[0].association.dispatchMarker.seq - b.event.phases[0].association.dispatchMarker.seq);
        const earliest = Math.min(...unresolved.map(edit => edit.targetSeq));
        const first = activeRows.findIndex(row => !isManualEvent(row.event)
            && row.event.plan.canonical.seq >= earliest);
        if (!stored && first < 0) {
            if (suffixRevision)
                fail('SCHEMA_SUFFIX_EDIT_UNAVAILABLE');
            return true;
        }
        const originalFor = (row) => {
            const item = row.event;
            if (isOpeningVariantEvent(item))
                fail('OPENING_VARIANT_REVISION_UNAVAILABLE');
            if (item.encoding === 'native-mvu-schema-player-event-v1' || item.encoding === 'native-mvu-schema-story-event-v2')
                return { kind: item.encoding === 'native-mvu-schema-player-event-v1' ? 'manual' : 'story',
                    event: { key: row.key, sha256: recordSha256(item) } };
            const descriptor = validateMvuSchemaStoryRevisionDescriptor(prefixInputs.status.get(item.plan.revision.descriptor.key));
            return descriptor.schemaVersion === 1 ? { kind: 'story', event: descriptor.original }
                : suffixOriginals(descriptor)[item.plan.schemaVersion === 8 || item.plan.schemaVersion === 9 || item.plan.schemaVersion === 11 ? item.plan.revision.index : 0];
        };
        const entries = stored ? suffixOriginals(stored) : activeRows.slice(first).map(originalFor);
        const originals = entries.map(entry => {
            const ref = entry.event, raw = prefixInputs.status.get(ref.key);
            const event = entry.kind === 'manual' ? validateMvuSchemaPlayerEvent(raw)
                : validateMvuSchemaStoryEvent(raw);
            if (recordSha256(event) !== ref.sha256)
                fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
            if (event.encoding === 'native-mvu-schema-player-event-v1') {
                joinMvuSchemaPlayerCompletedEvent(prefixInputs.branch, prefixInputs.status, event, events.slice(0, event.frontier.nativeCut));
            }
            return event;
        });
        const firstOriginal = originals[0];
        const taskEdits = stored?.schemaVersion === 4 ? stored.taskEdits :
            originals.flatMap((event, index) => {
                if (event.encoding !== 'native-mvu-schema-story-event-v2'
                    || event.outcome === 'refused' || schemaStoryMaintenanceSource(event.plan)?.kind !== 'task-result')
                    return [];
                const selected = taskIntent?.schemaVersion === 1
                    ? taskIntent.artifacts.find(row => row.canonicalSeq === event.plan.canonical.seq) : undefined;
                if (!selected || !taskBinding)
                    fail('SCHEMA_MAINTENANCE_REVISION_REQUIRED');
                if (taskBinding.edit.seq !== taskIntent.basis.nativeCut || taskBinding.edit.sha256 !== recordSha256(events[taskBinding.edit.seq])
                    || taskBinding.intent.key !== taskPointer.key || taskBinding.intent.sha256 !== taskPointer.sha256)
                    fail('SCHEMA_TASK_EDIT_BINDING_UNPROVEN');
                return [{ index, selection: { ...selected.artifact, mode: selected.mode,
                            intent: { key: taskPointer.key, sha256: taskPointer.sha256 },
                            binding: taskBindingRef } }];
            });
        if (!firstOriginal || firstOriginal.encoding === 'native-mvu-schema-player-event-v1'
            || !stored && !suffixRevision && !taskEdits.length
                && !unresolved.some(edit => edit.targetSeq === firstOriginal.plan.canonical.seq)) {
            if (suffixRevision || stored?.schemaVersion === 5)
                fail('SCHEMA_SUFFIX_EDIT_UNAVAILABLE');
            return true;
        }
        const authorizations = stored?.schemaVersion === 5 ? stored.authorizations :
            taskEdits.length ? [] : selectedEdits.filter(edit => edit.role === 'user').map(edit => {
                if (recovery && recoveredUser && recoveredUser.seq === edit.seq && recoveredUser.sha256 === edit.sha256)
                    return {
                        edit: { seq: edit.seq, sha256: edit.sha256 }, proof: { kind: 'post-commit-recovery', intent: recovery.ref }
                    };
                if (suffixRevision && boundUser && boundUser.seq === edit.seq && boundUser.sha256 === edit.sha256)
                    return {
                        edit: { seq: edit.seq, sha256: edit.sha256 }, proof: { kind: 'intent',
                            intent: { key: taskPointer.key, sha256: taskPointer.sha256 }, binding: taskBindingRef }
                    };
                const priorAuthorization = prior.userEditAuthorizations.get(edit.seq);
                if (!priorAuthorization || priorAuthorization.edit.sha256 !== edit.sha256)
                    fail('SCHEMA_SUFFIX_EDIT_AUTHORIZATION_UNPROVEN');
                return priorAuthorization;
            });
        const projection = deps.projectPrefix(events.slice(0, edits.at(-1).seq + 1));
        const canonical = originals.map(original => {
            if (original.encoding === 'native-mvu-schema-player-event-v1')
                return null;
            const target = events[original.plan.canonical.seq];
            if (target?.type !== 'assistant/message')
                fail('SCHEMA_REVISION_TARGET_UNPROVEN');
            const message = projection.projectedMessageAt(target.seq) ?? target.data.message, narrative = textOf(message.content);
            return { seq: target.seq, messageId: original.plan.canonical.messageId, versionSha256: recordSha256(message), narrative, narrativeSha256: sha256(narrative) };
        });
        // Recovery consumes the saved candidate before preflight, including its
        // historical parser policy. A new edit inherits its original Story policy.
        const storedRef = stored ? { key: descriptorKey, sha256: recordSha256(stored) } : undefined;
        const savedPlans = originals.map((_original, index) => {
            const raw = storedRef && prefixInputs.status.get(mvuSchemaStoryRevisionPlanKey(sid, recordSha256({ descriptor: storedRef, index })));
            if (!raw)
                return;
            const plan = raw;
            return plan.schemaVersion === 9 ? validateMvuSchemaPlayerRevisionPlan(plan) : validateMvuSchemaStoryPlan(plan);
        });
        const candidates = canonical.map((body, index) => {
            if (!body)
                return null;
            const saved = savedPlans[index], original = originals[index].plan;
            if (saved?.schemaVersion === 8 || saved?.schemaVersion === 11)
                return saved.candidate;
            const selected = taskEdits.find(row => row.index === index)?.selection;
            const policy = 'parserPolicy' in original ? original.parserPolicy : undefined;
            return selected?.mode === 'retain' ? prefixInputs.status.get(selected.sourceEventRef.key).plan.candidate : selected?.mode === 'clear'
                ? parseMvuSchemaStoryCandidateV2('', policy) : parseMvuSchemaStoryCandidateV2(body.narrative, policy);
        });
        if (candidates.some(candidate => candidate?.kind === 'rejected')) {
            if (suffixRevision || stored?.schemaVersion === 5)
                fail('SCHEMA_SUFFIX_EDIT_REJECTED');
            return true;
        }
        let captured, basisRecord;
        if (stored) {
            basisRecord = validateMvuSchemaStoryRevisionBasis(prefixInputs.status.get(stored.basis.record.key));
            const recovered = deps.recoverRevisionPrefix?.({ subjectSessionId: sid,
                events: events.slice(0, basisRecord.prefix.journal.nativeCut), ...basisRecord, readContext });
            if (!recovered)
                fail('SCHEMA_REVISION_BASE_UNPROVEN');
            captured = recovered;
        }
        else {
            const previous = activeRows[first - 1]?.event;
            const previousRevision = previous && isSuffixEvent(previous) ? previous : undefined;
            const firstBase = firstOriginal.plan.base, head = firstBase.currentHead;
            // Opening values finish before its visible Native message is appended.
            // That publication is part of a readable baseline, unlike later Story
            // work whose numerical result we are about to replace.
            const opening = head.encoding === 'mvu-schema-opening-head-v2'
                ? prior.seed.kind === 'opening' && same(prior.seed.head, head) ? prior.seed.event :
                    validateMvuSchemaOpeningEvent(prefixInputs.status.get(mvuInitializationEventKey(firstBase.sessionId, head.eventId)))
                : undefined;
            const cut = previousRevision?.frontier.nativeCut ?? Math.max(firstBase.schemaFrontier.nativeCut, opening ? opening.native.turnEndSeq + 1 : 0);
            const selected = deps.captureRevisionPrefix?.(sid, cut);
            if (!selected?.ready || !selected.closure)
                fail('SCHEMA_REVISION_BASE_UNPROVEN');
            captured = selected;
            const previousCompletionKey = previousRevision ? mvuSchemaStoryRevisionCompletionKey(previousRevision.sessionId, previousRevision.plan.revision.descriptor.sha256) : undefined;
            basisRecord = validateMvuSchemaStoryRevisionBasis(sealMvuSchemaStoryFact({ schemaVersion: 1,
                encoding: 'native-mvu-schema-revision-basis-v1', sessionId: sid,
                historyBasis: selected.historical?.historyBasis ?? null,
                closedRevision: previousCompletionKey ? { key: previousCompletionKey,
                    sha256: recordSha256(prefixInputs.status.get(previousCompletionKey)) } : null,
                prefix: selected.prefix, closure: selected.closure }, 'basisSha256'));
        }
        const basisRef = { key: mvuSchemaStoryRevisionBasisKey(sid, basisRecord.basisSha256), sha256: recordSha256(basisRecord) };
        const tail = activeRows.at(-1), lastRevision = tail && isSuffixEvent(tail.event)
            || tail?.event.encoding === 'native-mvu-schema-story-revision-event-v1' ? tail : undefined;
        const mixed = stored?.schemaVersion === 3 || entries.some(entry => entry.kind === 'manual');
        const descriptorBase = { sessionId: sid, edits,
            basis: { record: basisRef, nativeCut: captured.prefix.journal.nativeCut, historyBasis: basisRecord.historyBasis,
                closedRevision: basisRecord.closedRevision, prefixSha256: captured.prefix.prefixSha256,
                stateSnapshotSha256: captured.prefix.snapshot.stateSnapshotSha256 } };
        const descriptorTail = {
            previous: refused ? { key: refused.result.key, sha256: recordSha256(refused.result.event) }
                : lastRevision ? { key: lastRevision.key, sha256: recordSha256(lastRevision.event) } : null,
            completionSeq: captured.prefix.snapshot.schemaFrontier.nativeCut - 1,
            publicationRevision: Math.max(prior.snapshot.revision, refused
                ? refused.descriptor.publicationRevision + refused.descriptor.originals.length - 1 : 0) + 1,
            sourceSha256: deps.sourceSha256(sid)
        };
        const next = stored ?? (taskEdits.length
            ? validateMvuSchemaStoryRevisionDescriptor(sealMvuSchemaStoryFact({ schemaVersion: 4,
                encoding: 'native-mvu-schema-story-revision-descriptor-v4', ...descriptorBase,
                edits: selectedEdits, originals: entries, taskEdits, ...descriptorTail }, 'descriptorSha256'))
            : authorizations.length ? validateMvuSchemaStoryRevisionDescriptor(sealMvuSchemaStoryFact({ schemaVersion: 5,
                encoding: 'native-mvu-schema-story-revision-descriptor-v5', ...descriptorBase,
                edits: selectedEdits, originals: entries, authorizations, ...descriptorTail }, 'descriptorSha256')) : mixed
                ? validateMvuSchemaStoryRevisionDescriptor(sealMvuSchemaStoryFact({ schemaVersion: 3,
                    encoding: 'native-mvu-schema-story-revision-descriptor-v3', ...descriptorBase,
                    originals: entries, ...descriptorTail }, 'descriptorSha256'))
                : validateMvuSchemaStoryRevisionDescriptor(sealMvuSchemaStoryFact({ schemaVersion: 2,
                    encoding: 'native-mvu-schema-story-revision-descriptor-v2', ...descriptorBase,
                    originals: entries.map(entry => entry.event), ...descriptorTail }, 'descriptorSha256')));
        const ref = { key: descriptorKey, sha256: recordSha256(next) }, agent = deps.agent(session);
        const restored = captured.ready && recoveredPrefixes.get(captured.ready);
        if (!agent || !captured.ready || !restored?.scopes || !prior.readScopes)
            fail('SCHEMA_REVISION_OWNER_UNPROVEN');
        const basis = { ...prior, ready: captured.ready, snapshot: captured.prefix.snapshot,
            consumed: new Map(captured.prefix.consumed.map(row => [row.planSha256, row.closureSha256])),
            eventKeys: [...captured.prefix.eventKeys], readScopes: { ...restored.scopes, owners: prior.readScopes.owners },
            resolvedEdits: restored.resolvedEdits, settledMessages: restored.settledMessages, lastClosedStoryCanonicalSeq: restored.lastClosedStoryCanonicalSeq };
        if (prior.inheritedReady)
            Object.defineProperty(basis, 'inheritedReady', { value: prior.inheritedReady });
        await agent.runMaintenance(async (signal) => deps.withSourceLock(sid, async () => {
            signal.throwIfAborted();
            if (!currentSession(session) || deps.agent(session) !== agent)
                fail('SCHEMA_REVISION_PERMISSION_REVOKED');
            if (recovery) {
                if (deps.sourceSha256(sid) !== recovery.intent.fence.sourceSha256)
                    fail('SCHEMA_USER_EDIT_RECOVERY_FENCE_CHANGED');
                const ownBatches = new Set(savedPlans.flatMap(plan => plan?.selectors.map(selector => selector.batchId) ?? [])), currentEvents = all(session), liveBoundary = currentEvents[session.firstLiveSeq];
                for (const row of currentEvents.slice(recovery.intent.fence.nativeCut)) {
                    if (row.type === 'session/end-seed' && row === liveBoundary && Object.keys(row.data).length === 0)
                        continue;
                    if (row.type === deps.markers.revisionEventType && same(row.data.descriptor, ref))
                        continue;
                    if ((row.type === deps.markers.dispatchEventType || row.type === deps.markers.completionEventType)
                        && row.data.sessionId === sid && ownBatches.has(row.data.batchId))
                        continue;
                    fail('SCHEMA_USER_EDIT_RECOVERY_FENCE_CHANGED');
                }
            }
            const publication = numericalHeads.read(sid);
            await captured.retainInputs?.(sid);
            await putRevisionFact(basisRef.key, basisRecord);
            await putRevisionFact(descriptorKey, next);
            let actualMarker = all(session).find(row => row.type === deps.markers.revisionEventType && row.data.descriptor.key === ref.key);
            if (!actualMarker) {
                actualMarker = deps.markers.appendRevision(session, { schemaVersion: 1, encoding: 'native-mvu-schema-revision-marker-v1',
                    sessionId: sid, realmEpoch: prior.original.realmEpoch, descriptor: ref, editSeq: edits.at(-1).seq,
                    completionSeq: next.completionSeq, observedNativeSeq: all(session).length - 1 });
                if (!await deps.flush(session))
                    fail('SCHEMA_REVISION_FLUSH_UNKNOWN');
            }
            const frame = deps.source.captureFrame(prior.original, sid), { driver } = await engine(basis.ready);
            const priorDispatches = new Set();
            for (const row of all(session)) {
                if (row.type === deps.markers.dispatchEventType && row.seq > actualMarker.seq && row.data.sessionId === sid) {
                    priorDispatches.add(row.data.batchId);
                }
            }
            let owner;
            const completedRefs = [];
            try {
                for (const [index, original] of originals.entries()) {
                    const planKey = mvuSchemaStoryRevisionPlanKey(sid, recordSha256({ descriptor: ref, index }));
                    let plan;
                    if (savedPlans[index])
                        plan = savedPlans[index];
                    else {
                        const selectors = original.encoding === 'native-mvu-schema-player-event-v1'
                            ? deriveMvuSchemaPlayerRevisionSelectors(original.plan.operation, entries[index].event, ref, index, sid)
                            : deriveMvuSchemaStoryRevisionSelectorsV2(original.plan.scope, canonical[index], prior.original.realmEpoch, ref, index, sid);
                        const nativeEvents = all(session);
                        if (selectors.some(selector => priorDispatches.has(selector.batchId)))
                            fail('SCHEMA_REVISION_EXECUTION_UNKNOWN');
                        const cut = { ...original.plan.initialCut, sessionId: sid, ownerSessionId: sid,
                            nativeCut: nativeEvents.length, nativePrefixSha256: recordSha256(nativeEvents),
                            sourceSnapshotSha256: frame.snapshotSha256, materialSha256: frame.materialSha256, anchor: selectors[0].anchor };
                        const base = owner?.basis.snapshot ?? basis.snapshot, execution = { sessionId: sid, sourceSha256: next.sourceSha256, root: prior.initial.root };
                        const revision = { descriptor: ref, index, publicationRevision: next.publicationRevision + index };
                        const scopeReadFrame = scopeFrameAt(owner?.basis.readScopes ?? basis.readScopes, prior.original, frame, cut, nativeEvents, original.plan.initialCut.nativeCut, projection);
                        if (original.encoding === 'native-mvu-schema-player-event-v1') {
                            const { planSha256: _oldPlayer, scopeReadRef: _scopeReadRef, ...originalPlayerPlan } = original.plan;
                            plan = validateMvuSchemaPlayerRevisionPlan(sealMvuSchemaStoryFact({ ...originalPlayerPlan,
                                schemaVersion: 9, encoding: 'native-mvu-schema-player-revision-plan-v1',
                                original: entries[index].event, base, currentFrame: frame, initialCut: cut, selectors, executorVersion: 4,
                                randomSeed: recordSha256({ operation: original.plan.operation, original: entries[index].event, revision: ref, index }),
                                epoch: priorReady.epochRef, serverProgramSha256: priorReady.epoch.program.serverProgram.programSha256,
                                scopeReadFrame, logicalNativeCut: original.plan.initialCut.nativeCut, execution, revision }, 'planSha256'));
                        }
                        else {
                            const { planSha256: _old, maintenance: _maintenance, scopeReadRef: _scopeReadRef, commandSyntax: _commandSyntax, ...originalPlan } = original.plan;
                            const taskEdit = next.schemaVersion === 4 ? next.taskEdits.find(item => item.index === index)?.selection : undefined;
                            plan = validateMvuSchemaStoryPlan(sealMvuSchemaStoryFact({ ...originalPlan,
                                ...(taskEdit ? { schemaVersion: 11, encoding: 'native-mvu-schema-story-revision-plan-v3', taskEdit }
                                    : { schemaVersion: 8, encoding: 'native-mvu-schema-story-revision-plan-v2' }), canonical: canonical[index],
                                ...parseMvuSchemaStoryCandidateData(canonical[index].narrative, 'parserPolicy' in originalPlan ? originalPlan.parserPolicy : undefined),
                                candidate: candidates[index], executorVersion: 4,
                                base, currentFrame: frame, initialCut: cut, selectors,
                                randomSeed: recordSha256({ scope: original.plan.scope, canonical: canonical[index], revision: ref, index }),
                                epoch: priorReady.epochRef, serverProgramSha256: priorReady.epoch.program.serverProgram.programSha256,
                                logicalNativeCut: original.plan.initialCut.nativeCut,
                                scopeReadFrame, execution, revision }, 'planSha256'));
                        }
                        await putRevisionFact(planKey, plan);
                    }
                    if (!owner) {
                        owner = { session, agent, signal, inSource: true, original: prior.original, frame, basis,
                            descriptor: next, plan, driver, token: Object.freeze({}), associations: [], projection };
                        revisionOwners.set(sid, owner);
                        revisionScopes.set(owner.token, owner);
                    }
                    else {
                        // Manual phases share a live run within one item. A later item
                        // must restore from its own accumulated Journal, including Story
                        // phases that did not advance that earlier manual run.
                        driver.invalidateOwner(owner.token);
                        revisionScopes.delete(owner.token);
                        owner.token = Object.freeze({});
                        owner.plan = plan;
                        owner.scope = undefined;
                        owner.associations = [];
                        owner.lastLive = undefined;
                        revisionScopes.set(owner.token, owner);
                    }
                    const eventKey = mvuSchemaStoryRevisionEventKey(sid, revisionPlanEventId(plan)), savedEvent = prefixInputs.status.get(eventKey);
                    // A completed predecessor does not make this Story's undispatched work unknown.
                    const recoverOnly = plan.selectors.some(selector => priorDispatches.has(selector.batchId));
                    const event = savedEvent ? readRevisionEvent(savedEvent)
                        : recoverOnly ? recoverRevision(owner) : await executeRevision(owner);
                    if (!isSuffixEvent(event))
                        fail('SCHEMA_REVISION_HISTORY_UNPROVEN');
                    // As with the original Player publisher, evidence survives closing
                    // the parked manual VM; its cleanup precedes durable publication.
                    if (plan.schemaVersion === 9)
                        await driver.closeOwner(owner.token);
                    await putRevisionFact(eventKey, event);
                    if (!isManualRevision(event) && event.outcome === 'refused') {
                        deps.inputState.invalidateSession(sid);
                        if (next.schemaVersion === 5)
                            fail('SCHEMA_SUFFIX_EDIT_REFUSED');
                        return;
                    }
                    completedRefs.push({ key: eventKey, sha256: recordSha256(event) });
                    owner.basis = revisionResultBasis(owner.basis, event);
                }
                const completion = validateMvuSchemaStoryRevisionCompletion(sealMvuSchemaStoryFact({
                    ...(next.schemaVersion === 5 ? { schemaVersion: 5, encoding: 'native-mvu-schema-story-revision-completion-v5' }
                        : next.schemaVersion === 4 ? { schemaVersion: 4, encoding: 'native-mvu-schema-story-revision-completion-v4' }
                            : next.schemaVersion === 3 ? { schemaVersion: 3, encoding: 'native-mvu-schema-story-revision-completion-v3' }
                                : { schemaVersion: 2, encoding: 'native-mvu-schema-story-revision-completion-v2' }), sessionId: sid, descriptor: ref,
                    events: completedRefs
                }, 'completionSha256'));
                await putRevisionFact(mvuSchemaStoryRevisionCompletionKey(sid, ref.sha256), completion);
                const head = owner.basis.snapshot.currentHead;
                if (priorDispatches.size) {
                    const verified = await driver.verifyHistorical({ sessionId: sid, realmEpoch: prior.original.realmEpoch,
                        nativeCut: owner.basis.snapshot.schemaFrontier.nativeCut }, signal);
                    if (verified.kind !== 'verified')
                        fail(verified.code);
                    const history = factual(session, undefined, true, true);
                    if (!same(history.snapshot.currentHead, head))
                        fail('SCHEMA_REVISION_PUBLICATION_UNPROVEN');
                }
                const published = await numericalHeads.advanceLeaf(publication, head);
                if (published.kind !== 'acknowledged')
                    fail(published.kind === 'conflict'
                        ? 'SCHEMA_REVISION_WRITE_CONFLICT' : 'SCHEMA_REVISION_WRITE_UNKNOWN');
                deps.inputState.invalidateSession(sid);
                const read = captureSchemaRead(sid);
                if (!same(read.data.history.snapshot.currentHead, head))
                    fail('SCHEMA_REVISION_PUBLICATION_UNPROVEN');
                publishSchemaRead(read);
            }
            finally {
                if (owner) {
                    owner.inSource = false;
                    revisionOwners.delete(sid);
                    revisionScopes.delete(owner.token);
                    driver.invalidateOwner(owner.token);
                    await driver.closeOwner(owner.token);
                }
            }
        }));
        return true;
    }
    async function reconcileAcceptedEditV1(sid, requestedSeq) {
        const session = deps.session(sid);
        if (!session || !currentSession(session))
            return;
        const current = deps.currentEdits(session);
        const edit = requestedSeq === undefined ? current.reduce((latest, event) => !latest || event.seq > latest.seq ? event : latest, undefined) : current.find(event => event.seq === requestedSeq);
        if (edit?.type !== 'roleplay/message-edit' || edit.data.role !== 'assistant')
            return;
        // Existing V1 derived roots retain their already checked parent prefix.
        // Creating children across a revision requires a separate inheritance
        // contract; this edit owner does not extend that persisted wire.
        if (session.inheritedEventCount || session.header.parentSession) {
            const genesis = deps.readDerivedGenesis?.(sid);
            if (!genesis || genesis.inheritedCut.schemaVersion !== 1)
                return;
        }
        // The existing edit owner owns denial durability. An unresolved write must
        // remain blocked and cannot start a different author execution on a GET.
        const invalidation = deps.readEditInvalidation?.(sid);
        // The edit owner already located the earliest edited target. An opening
        // or inherited-prefix edit keeps its denial; replaying a later Story
        // cannot repair the numerical seed that precedes the Story edit floor.
        if (invalidation?.kind !== 'invalidated' || invalidation.fromSeq < invalidation.editFloorSeq)
            return;
        const descriptorKey = mvuSchemaStoryRevisionDescriptorKey(sid, recordSha256(edit));
        const stored = prefixInputs.status.get(descriptorKey);
        const descriptor = stored === undefined ? undefined : validateMvuSchemaStoryRevisionDescriptor(stored);
        // Only an accepted mutation may start work; GET recovers durable revision artifacts.
        if (!descriptor && requestedSeq === undefined)
            return;
        let savedPlan;
        if (descriptor) {
            const planKey = mvuSchemaStoryRevisionPlanKey(sid, recordSha256(descriptor));
            const planRaw = prefixInputs.status.get(planKey);
            if (planRaw) {
                const plan = validateMvuSchemaStoryPlan(planRaw);
                savedPlan = plan;
                const eventRaw = prefixInputs.status.get(mvuSchemaStoryRevisionEventKey(sid, revisionPlanEventId(plan)));
                if (eventRaw) {
                    const event = validateMvuSchemaStoryRevisionEvent(eventRaw), head = mvuNumericalPublicationLeaf(prefixInputs.status.get(mvuStateCurrentHeadKey(sid)));
                    if (event.outcome === 'refused')
                        return;
                    if (same(head, mvuSchemaStoryRevisionHead(event))
                        || Number(head?.revision) > descriptor.publicationRevision)
                        return;
                }
            }
        }
        const rows = eventRows(sid, edit.seq), last = rows.at(-1)?.event;
        const originalEvent = descriptor ? validateMvuSchemaStoryEvent(prefixInputs.status.get(descriptor.original.key)) :
            last?.encoding === 'native-mvu-schema-story-revision-event-v1'
                ? validateMvuSchemaStoryEvent(prefixInputs.status.get(validateMvuSchemaStoryRevisionDescriptor(prefixInputs.status.get(last.plan.revision.descriptor.key)).original.key)) : last;
        // Earlier Story suffixes and subsequent manual operations have no local
        // rewind contract. Their accepted edits retain the existing durable denial.
        if (!originalEvent || originalEvent.encoding !== 'native-mvu-schema-story-event-v2'
            || originalEvent.plan.canonical.seq !== edit.data.targetSeq || originalEvent.outcome === 'refused'
            || last?.encoding === 'native-mvu-schema-player-event-v1')
            return;
        const target = all(session)[edit.data.targetSeq];
        if (schemaStoryMaintenanceSource(originalEvent.plan)?.kind === 'task-result')
            fail('SCHEMA_MAINTENANCE_REVISION_REQUIRED');
        if (target?.type !== 'assistant/message')
            fail('SCHEMA_REVISION_TARGET_UNPROVEN');
        const message = deps.editProtocol.editMessageText(target.data.message, edit.data);
        const canonical = { seq: target.seq, messageId: message.id, versionSha256: recordSha256(message),
            narrative: textOf(message.content), narrativeSha256: sha256(textOf(message.content)) };
        const parserPolicy = savedPlan ? savedPlan.parserPolicy :
            'parserPolicy' in originalEvent.plan ? originalEvent.plan.parserPolicy : undefined;
        const candidate = savedPlan?.candidate ?? parseMvuSchemaStoryCandidateV2(canonical.narrative, parserPolicy);
        // A rejected text remains saved and denied. It cannot produce an event,
        // so do not spend a Native rewind or any author phase on it.
        if (candidate.kind === 'rejected')
            return;
        const priorHistory = factual(session, edit.seq, true, true, false, originalEvent.plan.planSha256);
        if (current.some(event => event.seq !== edit.seq && event.seq >= priorHistory.editBasis.editFloorSeq
            && !priorHistory.resolvedEdits.has(event.seq)))
            return;
        const priorReady = priorHistory.ready;
        if (!isAuthorHostJournalReadyV5(priorReady))
            return;
        const originalRef = { key: mvuSchemaStoryEventKey(sid, originalEvent.eventId), sha256: recordSha256(originalEvent) };
        closedStoryFacts(sid, session.inheritedEventCount, all(session), originalEvent, false);
        const basis = beforeStoryRevision(session, priorHistory, originalEvent);
        const sourceSha256 = deps.sourceSha256(sid);
        if (sourceSha256 !== originalEvent.sourceSha256)
            fail('SCHEMA_REVISION_SOURCE_CHANGED');
        const previous = last?.encoding === 'native-mvu-schema-story-revision-event-v1'
            ? { key: mvuSchemaStoryRevisionEventKey(sid, last.eventId), sha256: recordSha256(last) } : null;
        const next = descriptor ?? validateMvuSchemaStoryRevisionDescriptor(sealMvuSchemaStoryFact({ schemaVersion: 1,
            encoding: 'native-mvu-schema-story-revision-descriptor-v1', sessionId: sid,
            edit: { seq: edit.seq, sha256: recordSha256(edit), targetSeq: target.seq, messageId: message.id,
                messageVersionSha256: canonical.versionSha256, narrativeSha256: canonical.narrativeSha256 },
            original: originalRef, previous, baseStateSnapshotSha256: basis.snapshot.stateSnapshotSha256,
            completionSeq: basis.snapshot.schemaFrontier.nativeCut - 1,
            publicationRevision: Math.max(priorHistory.snapshot.revision, last?.encoding === 'native-mvu-schema-story-revision-event-v1' ? last.plan.revision.publicationRevision : 0) + 1,
            sourceSha256 }, 'descriptorSha256'));
        const ref = { key: descriptorKey, sha256: recordSha256(next) }, agent = deps.agent(session);
        if (!agent)
            fail('SCHEMA_REVISION_OWNER_UNPROVEN');
        await agent.runMaintenance(async (signal) => deps.withSourceLock(sid, async () => {
            signal.throwIfAborted();
            if (!currentSession(session) || deps.agent(session) !== agent)
                fail('SCHEMA_REVISION_PERMISSION_REVOKED');
            // A completed predecessor may not have published its logical head.
            // This Source/Native owner replaces the actual materialized row by CAS.
            const publication = numericalHeads.read(sid);
            await putRevisionFact(descriptorKey, next);
            let marker = all(session).find(event => event.type === deps.markers.revisionEventType && event.data.descriptor.key === ref.key);
            if (!marker) {
                marker = deps.markers.appendRevision(session, { schemaVersion: 1, encoding: 'native-mvu-schema-revision-marker-v1',
                    sessionId: sid, realmEpoch: originalEvent.plan.realmEpoch, descriptor: ref, editSeq: edit.seq,
                    completionSeq: next.completionSeq, observedNativeSeq: all(session).length - 1 });
                if (!await deps.flush(session))
                    fail('SCHEMA_REVISION_FLUSH_UNKNOWN');
            }
            const frame = deps.source.captureFrame(basis.original, sid), planKey = mvuSchemaStoryRevisionPlanKey(sid, ref.sha256);
            const planRaw = prefixInputs.status.get(planKey);
            let plan;
            if (planRaw)
                plan = validateMvuSchemaStoryPlan(planRaw);
            else {
                const events = all(session), selectors = deriveMvuSchemaStoryRevisionSelectors(originalEvent.plan.scope, canonical, originalEvent.plan.realmEpoch, ref);
                const initialCut = { ...originalEvent.plan.initialCut, nativeCut: events.length,
                    nativePrefixSha256: schemaNativeCutSha256(events, events.length, deps.inputState.nativeHistory?.prefixes),
                    sourceSnapshotSha256: frame.snapshotSha256,
                    materialSha256: frame.materialSha256, anchor: selectors[0].anchor };
                const { planSha256: _oldPlanHash, maintenance: _maintenance, commandSyntax: _commandSyntax, ...originalPlan } = originalEvent.plan;
                plan = validateMvuSchemaStoryPlan(sealMvuSchemaStoryFact({ ...originalPlan,
                    schemaVersion: 7, encoding: 'native-mvu-schema-story-revision-plan-v1',
                    ...parseMvuSchemaStoryCandidateData(canonical.narrative, 'parserPolicy' in originalPlan ? originalPlan.parserPolicy : undefined),
                    canonical, candidate, base: basis.snapshot, currentFrame: frame, initialCut, selectors,
                    randomSeed: recordSha256({ scope: originalEvent.plan.scope, canonical, revision: ref }),
                    executorVersion: 4, epoch: priorHistory.ready.epochRef,
                    serverProgramSha256: priorReady.epoch.program.serverProgram.programSha256,
                    scopeReadFrame: scopeFrameAt(basis.readScopes, basis.original, frame, initialCut, events),
                    revision: { descriptor: ref, publicationRevision: next.publicationRevision } }, 'planSha256'));
                await putRevisionFact(planKey, plan);
            }
            const eventKey = mvuSchemaStoryRevisionEventKey(sid, revisionPlanEventId(plan)), completed = prefixInputs.status.get(eventKey);
            const { driver } = await engine(basis.ready);
            const owner = { session, agent, signal, inSource: true, original: basis.original, frame, basis,
                descriptor: next, plan, driver, token: Object.freeze({}), associations: [] };
            revisionOwners.set(sid, owner);
            revisionScopes.set(owner.token, owner);
            try {
                let event, recovered = false;
                if (completed) {
                    event = validateMvuSchemaStoryRevisionEvent(completed);
                    recovered = true;
                }
                else {
                    recovered = all(session).some(entry => entry.type === deps.markers.dispatchEventType
                        && plan.selectors.some(selector => selector.batchId === entry.data.batchId));
                    event = (recovered ? recoverRevision(owner) : await executeRevision(owner));
                    await putRevisionFact(eventKey, event);
                }
                if (recovered) {
                    // Persisted DATA carries no live execution evidence. Its actual
                    // historical tail must be verified before this owner repairs a head.
                    const verified = await driver.verifyHistorical({ sessionId: sid, realmEpoch: plan.realmEpoch,
                        nativeCut: event.frontier.nativeCut }, owner.signal);
                    if (verified.kind !== 'verified')
                        fail(verified.code);
                    if (event.outcome !== 'refused') {
                        const history = factual(session, undefined, true, true);
                        if (!same(history.snapshot.currentHead, mvuSchemaStoryRevisionHead(event)))
                            fail('SCHEMA_REVISION_PUBLICATION_UNPROVEN');
                    }
                }
                // A completed refusal settles its real journal tail, while its edit
                // stays denied. It publishes neither numerical values nor a new head.
                if (event.outcome === 'refused') {
                    deps.inputState.invalidateSession(sid);
                    return;
                }
                const head = mvuSchemaStoryRevisionHead(event);
                const published = await numericalHeads.advanceLeaf(publication, head);
                if (published.kind !== 'acknowledged')
                    fail(published.kind === 'conflict'
                        ? 'SCHEMA_REVISION_WRITE_CONFLICT' : 'SCHEMA_REVISION_WRITE_UNKNOWN');
                deps.inputState.invalidateSession(sid);
                const read = captureSchemaRead(sid);
                if (!same(read.data.history.snapshot.currentHead, head))
                    fail('SCHEMA_REVISION_PUBLICATION_UNPROVEN');
                publishSchemaRead(read);
            }
            finally {
                owner.inSource = false;
                revisionOwners.delete(sid);
                driver.invalidateOwner(owner.token);
            }
        }));
    }
    function captureSchemaRead(sid) {
        // captureSchema replaces its own stale read. Refreshing this consumer
        // cannot revoke another current operation, such as Ruby's Source capture.
        const session = deps.session(sid);
        if (!session || !currentSession(session))
            fail('SCHEMA_SESSION_INACTIVE');
        const capture = () => deps.inputState.captureSchema(sid, () => {
            const history = factual(session, undefined, false, true, true);
            return { session, agent: deps.agent(session), history, frame: deps.source.captureFrame(history.original, sid) };
        });
        let read = capture();
        if (!readDataCurrent(read.data)) {
            deps.inputState.invalidateSession(sid);
            read = capture();
        }
        return read;
    }
    function publishSchemaRead(read) {
        const view = { ...read.data, read }, sid = view.session.id;
        if (!viewCurrent(view))
            fail('SCHEMA_HISTORICAL_FACTS_CHANGED');
        views.set(sid, view);
        deps.inputState.schemaPublished(sid);
    }
    /** The numerical read already joins this original opening to its accepted
     * Journal and Native span. Opening UI consumes that same seed; a cold read
     * captures facts only, never edit recovery, initialization or guest replay. */
    function readCompletedOpening(source) {
        try {
            let view = views.get(source.sessionId);
            if (!view || !viewCurrent(view)) {
                const read = captureSchemaRead(source.sessionId);
                publishSchemaRead(read);
                view = views.get(source.sessionId);
            }
            const seed = view.history.seed;
            if (seed.kind !== 'opening')
                fail('SCHEMA_OPENING_RECORD_INVALID');
            if (!same(seed.intent.source, source))
                fail('SOURCE_CHANGED');
            return { kind: 'ready', intent: seed.intent, event: seed.event, head: seed.head };
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    /** Called synchronously by Player inside its live Source publication. The
     * callback joins this actual Store/Native read to its existing Replay proof;
     * no posted snapshot or completed terminal alone can publish a view. */
    function adoptPublishedPlayer(sid, accepts) {
        const read = captureSchemaRead(sid);
        if (!accepts(read.data.history.ready))
            fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
        publishSchemaRead(read);
    }
    /** Only the live DATA writer calls this across its own publication. Source
     * contributes to the snapshot digest, so compare the actual numerical and
     * execution facts before publishing its Source-only successor. */
    function captureAuthorDataPublicationBasis(sid) {
        const before = views.get(sid);
        if (!before || !viewCurrent(before))
            return undefined;
        const basis = (value) => {
            const state = value.history.snapshot;
            return { root: state.root, currentHead: state.currentHead, revision: state.revision, headSha256: state.headSha256,
                valuesSha256: state.valuesSha256, context: state.context, schemaFrontier: state.schemaFrontier,
                originalSha256: value.history.original.originalSha256, epoch: value.history.ready.epochRef,
                programSha256: schemaOriginalProgramSha256(value.history.original) };
        };
        const original = basis(before);
        let adopted = false;
        return () => {
            if (adopted || !readDataCurrent(before))
                return undefined;
            adopted = true;
            const read = captureSchemaRead(sid);
            if (!same(original, basis(read.data)))
                return undefined;
            publishSchemaRead(read);
            return observation(sid);
        };
    }
    async function preflight(sid, signal) {
        signal?.throwIfAborted();
        const session = deps.session(sid), recoveredEdit = session ? await deps.recoverTaskEdit?.(session) : undefined;
        const existing = views.get(sid);
        if (existing && viewCurrent(existing))
            return;
        await reconcileAcceptedEdit(sid, recoveredEdit);
        signal?.throwIfAborted();
        const revised = views.get(sid);
        if (revised && viewCurrent(revised))
            return;
        const read = captureSchemaRead(sid);
        // Capture consumes the accepted Store/Native history; publication checks
        // that its dependencies still belong to this owner without executing it again.
        publishSchemaRead(read);
    }
    function observation(sid) {
        const view = views.get(sid);
        return view && viewCurrent(view) ? { kind: 'story', sourceSha256: view.history.snapshot.sourceSha256,
            headRef: { kind: 'schema-head', sha256: view.history.snapshot.stateSnapshotSha256 } } : undefined;
    }
    function readSnapshot(sid) {
        const view = views.get(sid);
        return view && viewCurrent(view) ? structuredClone(view.history.snapshot) : undefined;
    }
    function supportsMaintenance(sid) {
        const view = views.get(sid);
        return !!view && viewCurrent(view) && isAuthorHostJournalReadyV5(view.history.ready);
    }
    async function checkTextEdit(sid, targetSeq) {
        let last;
        try {
            await preflight(sid);
            last = views.get(sid)?.history.lastTaskResultCanonicalSeq;
        }
        catch (error) {
            if (codeOf(error) !== 'NUMERICAL_EDIT_INVALIDATED')
                throw error;
            const session = deps.session(sid);
            if (!session || !currentSession(session))
                throw error;
            // A malformed saved patch blocks numerical reads, but must not block
            // correcting the text. Read the actual completed history as DATA solely
            // for the task-result boundary; publication still waits for reconciliation.
            last = readTextEditBoundary(session);
        }
        if (last !== undefined && targetSeq <= last)
            fail('SCHEMA_MAINTENANCE_REVISION_REQUIRED');
    }
    function readTextEditBoundary(session) {
        const sid = session.id, events = all(session);
        let refusedCut;
        for (const row of events)
            if (row.type === deps.markers.revisionEventType) {
                const outcome = readSuffixRevisionOutcome(sid, row);
                if (!outcome)
                    continue;
                if (outcome.completion !== undefined)
                    refusedCut = undefined;
                else if (outcome.descriptor.sessionId === sid)
                    refusedCut = outcome.refusal ? refusedCut ?? row.seq : undefined;
            }
        const cut = refusedCut ?? events.length, originalPlans = new Set(eventRows(sid, cut)
            .filter(row => row.event.encoding === 'native-mvu-schema-story-event-v2').map(row => row.event.plan.planSha256));
        return factual(session, cut, true, false, false, originalPlans).lastTaskResultCanonicalSeq;
    }
    async function taskEditFacts(sid, targetSeq) {
        await preflight(sid);
        const view = views.get(sid);
        if (!view || !viewCurrent(view))
            fail('SCHEMA_TASK_EDIT_BASIS_UNAVAILABLE');
        return { artifacts: [...view.history.taskArtifacts].filter(([seq]) => seq >= targetSeq).map(([, artifact]) => artifact),
            canReviseSettledCanonicalSuffix: isAuthorHostJournalReadyV5(view.history.ready) && view.history.lastSettledStoryCanonicalSeq !== undefined
                && view.history.lastSettledStoryCanonicalSeq >= targetSeq,
            sourceSha256: view.history.snapshot.sourceSha256, headSha256: view.history.snapshot.headSha256, nativeCut: view.session.seq };
    }
    function taskArtifact(sid, canonicalSeq) {
        const artifact = views.get(sid)?.history.taskArtifacts.get(canonicalSeq);
        if (!artifact)
            return;
        const candidate = prefixInputs.status.get(artifact.sourceEventRef.key).plan.candidate;
        return { sha256: artifact.sourceEventRef.sha256, kind: artifact.effectiveKind,
            operationCount: candidate.kind === 'parsed' ? candidate.operations.length : 0 };
    }
    const taskEditResolved = (sid, editSeq) => views.get(sid)?.history.resolvedEdits.has(editSeq) === true;
    /** Phase A already validated and sealed this complete numerical snapshot.
     * Proposal context reuses it; the closing owner still proves current history
     * before granting any numerical publication permission. */
    function captureMaintenanceBase(sid, currency) {
        if (currency.source.kind !== 'story' || currency.source.headRef?.kind !== 'schema-head'
            || !currency.snapshot || !inputSnapshotReferenceCurrent(prefixInputs.branch, sid, currency))
            return undefined;
        const row = prefixInputs.branch.get(currency.snapshot.key);
        return { base: row.numericalState, parserPolicy: 'analysis-alias-rfc6902-members-v1' };
    }
    function readSchemaObservation(sid) {
        const view = views.get(sid), history = view && viewCurrent(view) ? view.history : undefined;
        if (!history)
            return undefined;
        const epoch = history.ready.epoch, program = epoch.schemaVersion === 5 ? epoch.program : undefined;
        const unavailableExternalAddons = program?.executionPlan.scripts.filter(row => row.disposition === 'external-addon-unavailable');
        return { snapshot: structuredClone(history.snapshot), displayUpdates: history.displayUpdates ?? [],
            hasFinalizedMessages: (history.settledMessages?.size ?? 0) > 0,
            ...history.lastTaskResultCanonicalSeq !== undefined ? { lastTaskResultCanonicalSeq: history.lastTaskResultCanonicalSeq } : {},
            ...history.commandDiagnostics.length ? { commandDiagnostics: history.commandDiagnostics } : {},
            ...unavailableExternalAddons?.length ? { unavailableExternalAddons } : {} };
    }
    /** Read existing completed scope facts for a frozen prompt. This creates no
     * schema execution cut, selector, closing lease, write or Native permission.
     * The caller separately owns Source and the actual in-flight Native step. */
    function captureAuthorOpening(view, frame, eventAt) {
        const activationRoot = view.history.snapshot.root.activation;
        if (activationRoot) {
            const activation = openingArchivesFor(view.session.id).readSeed(activationRoot.sessionId);
            if (!activation || activation.seed.event.eventSha256 !== activationRoot.eventSha256)
                fail('OPENING_VARIANT_ACTIVATION_UNPROVEN');
            const native = activation.seed.event.native, anchor = frame.messages.find(row => row.messageId === native.messageId), event = anchor ? eventAt(anchor.nativeSeq) : undefined;
            if (event?.type !== 'assistant/message' || recordSha256(event) !== native.messageVersion.eventSha256)
                fail('PROMPT_PROGRAM_OPENING_ANCHOR_UNAVAILABLE');
            const candidates = deps.source.readOriginalOpeningCandidates(view.history.original), message = readTavernSelectedMessageFactsV1(event.data.message);
            return { messageId: native.messageId, originalMessageVersionSha256: message.messageVersionSha256,
                ordinaryVariants: deps.readOpeningVariantAddresses ? deps.readOpeningVariantAddresses(view.session.id, { ownerSessionId: activation.seed.sessionId, nativeSeq: native.assistantSeq, messageId: native.messageId,
                    messageVersionSha256: message.messageVersionSha256 }, activation.packet.candidateIndex) : null,
                copiedCandidates: { source: 'native-author-copy-opening-candidates-v1', swipes: candidates.map(row => row.renderedText),
                    swipe_id: activation.packet.candidateIndex } };
        }
        const identity = view.history.original.preparation.identity, anchor = frame.messages.find(row => row.messageId === identity.messageId), event = anchor ? eventAt(anchor.nativeSeq) : undefined;
        if (event?.type !== 'assistant/message' || event.data.message.id !== identity.messageId)
            fail('PROMPT_PROGRAM_OPENING_ANCHOR_UNAVAILABLE');
        const message = readTavernSelectedMessageFactsV1(event.data.message), originalMessageVersionSha256 = message.messageVersionSha256, candidates = deps.source.readOriginalOpeningCandidates(view.history.original), selected = candidates.findIndex(row => row.index === identity.index);
        const copiedCandidates = selected >= 0 && message.textSha256 === identity.renderedSha256
            ? { source: 'native-author-copy-opening-candidates-v1',
                swipes: candidates.map(row => row.renderedText), swipe_id: selected } : null;
        return { messageId: identity.messageId, originalMessageVersionSha256, copiedCandidates,
            ...selected >= 0 ? { ordinaryVariants: deps.readOpeningVariantAddresses ? deps.readOpeningVariantAddresses(view.session.id, { ownerSessionId: scopeOwnerForSeq(view.history.readScopes, anchor.nativeSeq), nativeSeq: anchor.nativeSeq, messageId: identity.messageId,
                    messageVersionSha256: originalMessageVersionSha256 }, identity.index) : null } : {} };
    }
    /** Reader needs two current variable scopes, not a reconstructed prompt or
     * a second history admission. The existing read owns every consumed row. */
    function captureReaderDisplayScopes(sid) {
        const view = views.get(sid);
        if (!view)
            return;
        if (disposed || !view.read.current() || deps.session(sid) !== view.session
            || deps.agent(view.session) !== view.agent)
            return;
        const source = schemaScopeSource(view.frame.snapshot), facts = view.history.readScopes, bindings = [];
        const available = (scope, variables) => {
            if (variables.kind !== 'available')
                return;
            const values = variables.variables, versionSha256 = recordSha256(variables.provenance);
            bindings.push({ scope, ownerId: `${sid}:prompt-scope:${scope}`, versionSha256,
                values, valuesSha256: recordSha256(values) });
        };
        if (facts) {
            available('chat', schemaScopeReowner(facts.chat, schemaScopeOwner(source, 'chat')));
            available('global', schemaScopeEmpty(schemaScopeOwner(source, 'global')));
        }
        return { source, bindings, versionSha256: recordSha256({ source, state: view.history.snapshot.stateSnapshotSha256,
                scopes: bindings.map(({ scope, ownerId, versionSha256, valuesSha256 }) => ({ scope, ownerId, versionSha256, valuesSha256 })) }),
            displayUpdates: view.history.displayUpdates ?? [] };
    }
    function capturePromptScopes(sid, selection) {
        const view = views.get(sid), facts = view?.history.readScopes;
        if (!view || !facts || !viewCurrent(view))
            return undefined;
        const ready = view.history.ready, combined = isAuthorHostJournalReadyV5(ready) ? ready.epoch.program : undefined, native = combined?.nativeProgram, hasHelper = native?.scripts.some(script => script.enabled) === true;
        if (selection && (!hasHelper || selection.purpose === 'prompt-variable-selection-v3')) {
            const cut = deps.inputState.nativeHistory?.cut?.(view.session), projections = deps.projections?.();
            if (cut?.source === 'native' && projections) {
                const source = schemaScopeSource(view.frame.snapshot), basis = Object.freeze({ schemaVersion: 1,
                    encoding: 'native-mvu-prompt-scope-read-basis-v1', authority: 'consumer-data-only',
                    sessionId: sid, sourceSnapshotSha256: view.frame.snapshotSha256, materialSha256: view.frame.materialSha256,
                    numericalSnapshotSha256: view.history.snapshot.stateSnapshotSha256, nativeCut: cut.length,
                    nativePrefixSha256: cut.prefixSha256(cut.length) }), matches = readTavernCanonicalChatMatchesAtCutV1(sid, cut, cut.length, projections, selection.messages.map(row => ({ messageId: row.id, messageVersionSha256: recordSha256(row.message) }))), point = selection.purpose === 'prompt-variable-selection-v3'
                    ? schemaScopeSelectedMessagePoints(matches, source, seq => scopeOwnerForSeq(facts, seq), facts.messages) : undefined, messages = point ? [] : schemaScopeSelectedCanonicalMessages(matches, source, seq => scopeOwnerForSeq(facts, seq), facts.messages), selectedData = buildSelectedSchemaPromptScopeData(basis, source, schemaOriginalServerScripts(view.history.original), facts.chat, messages, selection.sha256), current = () => viewCurrent(view);
                if (!current())
                    return;
                if (point) {
                    // Full author callbacks retain their explicit complete history API;
                    // the separate variable consumer still requests only point facts.
                    const full = hasHelper ? captureFullPromptScopes(view, true, selection.ordinaryChat) : undefined;
                    if (hasHelper && !full)
                        return;
                    const { messages: _messages, readDataSha256: _sha, ...body } = selectedData, small = { ...body, schemaVersion: 3, encoding: 'native-mvu-prompt-variable-scope-data-v3' }, data = Object.freeze({ ...small, readDataSha256: recordSha256(small) });
                    return { ...full, data, messageAt: point, current: () => current() && (!full || full.current()),
                        ordinaryMessageView: full?.ordinaryMessageView ?? lazyOrdinaryMessageView(view, facts, source, cut, basis.nativePrefixSha256, selection.ordinaryChat) };
                }
                return { data: selectedData, current, ordinaryMessageView: lazyOrdinaryMessageView(view, facts, source, cut, basis.nativePrefixSha256, selection.ordinaryChat) };
            }
        }
        return captureFullPromptScopes(view, selection !== undefined, selection?.ordinaryChat);
    }
    function captureFullPromptScopes(view, selected = false, ordinaryChat) {
        const sid = view.session.id, facts = view.history.readScopes;
        const cut = deps.inputState.nativeHistory?.cut?.(view.session), source = schemaScopeSource(view.frame.snapshot), projections = deps.projections?.();
        let events;
        const raw = () => events ??= all(view.session), length = cut?.length ?? raw().length;
        const canonical = cut?.source === 'native' && projections
            ? readTavernCanonicalChatAtCutV1(sid, cut, length, projections) : undefined;
        const basis = Object.freeze({ schemaVersion: 1, encoding: 'native-mvu-prompt-scope-read-basis-v1',
            authority: 'consumer-data-only', sessionId: sid, sourceSnapshotSha256: view.frame.snapshotSha256,
            materialSha256: view.frame.materialSha256, numericalSnapshotSha256: view.history.snapshot.stateSnapshotSha256,
            nativeCut: length,
            nativePrefixSha256: cut?.prefixSha256(length)
                ?? schemaNativeCutSha256(raw(), length, deps.inputState.nativeHistory?.prefixes) });
        const frame = buildSchemaScopeReadFrame(source, recordSha256(basis), schemaOriginalCompilationInput(view.history.original).scripts, facts.chat, canonical ? schemaScopeCanonicalMessages(canonical, source, seq => scopeOwnerForSeq(facts, seq), facts.messages)
            : schemaScopeVisibleMessages(raw(), deps.projectPrefix, source, seq => scopeOwnerForSeq(facts, seq), facts.messages, 'canonical-chat'));
        const data = Object.freeze({ schemaVersion: 1, encoding: 'native-mvu-prompt-scope-read-data-v1',
            authority: 'consumer-data-only', basis, frame, readDataSha256: recordSha256({ basis, frame }) });
        // A later own pending input or interrupted provider attempt does not change
        // these already captured variable reads. Native's material owner validates
        // their selected message versions and its evolving request cut separately.
        let ordinary;
        const current = () => viewCurrent(view) && ordinary?.current?.() !== false;
        if (!current())
            return undefined;
        const ready = view.history.ready, combined = isAuthorHostJournalReadyV5(ready) ? ready.epoch.program : undefined, native = combined?.nativeProgram;
        const ordinaryMessageView = lazyOrdinaryMessageView(view, facts, source, cut ?? sessionHistoryCut(view.session), frame.frameSha256, ordinaryChat);
        if (!native?.scripts.some(script => script.enabled))
            return { data, current, ordinaryMessageView };
        // Every helper callback consumes the same actual opening and ordinary
        // namespace cut. Its browser registry decides which events are registered.
        const opening = captureAuthorOpening(view, frame, seq => cut ? cut.at(seq) : raw()[seq]);
        ordinary = captureOrdinaryChat(sid, ordinaryChat, frame.messages, opening, seq => scopeOwnerForSeq(facts, seq), frame.frameSha256);
        const context = view.frame.material.openingContext, authorBrowserV3 = { program: native, opening, scopes: frame,
            basis: { materialSha256: view.frame.materialSha256, numericalSnapshotSha256: view.history.snapshot.stateSnapshotSha256 },
            numerical: browserNumericalSnapshot(view, length),
            persona: { name: context.user, ...context.user_gender !== undefined ? { gender: context.user_gender } : {}, avatar: null },
            ordinaryChat: ordinary.data.ordinaryChat, ordinaryMessages: ordinary.data.ordinaryMessages };
        if (!current())
            return undefined;
        return { data, current, authorBrowserV3, ordinaryMessageView };
    }
    function lazyOrdinaryMessageView(view, facts, source, cut, targetSetIdentity, ordinaryChat) {
        let captured;
        return () => {
            if (captured) {
                if (!captured.current())
                    fail('AUTHOR_MESSAGE_FACTS_CHANGED');
                return captured;
            }
            if (!viewCurrent(view))
                fail('AUTHOR_MESSAGE_FACTS_CHANGED');
            const { projection } = captureAuthorMessages(view, facts, source, cut), opening = captureAuthorOpening(view, { messages: projection.scoped }, seq => cut.at(seq)), start = projection.messages.findIndex(message => message.messageId === opening.messageId);
            if (start < 0)
                fail('PROMPT_PROGRAM_OPENING_INDEX_UNAVAILABLE');
            const messages = projection.messages.slice(start).map((message, index) => {
                const variables = projection.scoped[start + index].variables, packs = message.messageId === opening.messageId && opening.copiedCandidates && variables.kind === 'available'
                    ? deps.readOpeningVariantPacks?.(view.session.id, opening.copiedCandidates, variables.variables) : undefined;
                return { index, messageId: message.messageId, ownerSessionId: message.ownerSessionId, nativeSeq: message.nativeSeq,
                    messageVersionSha256: message.messageVersionSha256, role: message.role, variables,
                    ...packs ? { variantVariables: packs.swipes_data } : {} };
            }), ordinary = captureOrdinaryChat(view.session.id, ordinaryChat, messages, opening, seq => scopeOwnerForSeq(facts, seq), targetSetIdentity), ordinaryFor = authorOrdinaryMessageSelectionV1(ordinary.data.ordinaryMessages, opening);
            captured = Object.freeze({ opening, ordinaryMessages: ordinary.data.ordinaryMessages,
                messages: Object.freeze(messages.map(row => {
                    const selected = ordinaryFor(row);
                    return Object.freeze({ ...row, ...selected ? { ordinary: selected } : {} });
                })),
                // Main's selected-material/clock owner already checks message changes
                // and admits its own pending input. A shared reader cursor advancing
                // past unrelated Native events does not invalidate these frozen facts.
                current: () => viewCurrent(view) && ordinary.current?.() !== false });
            if (!captured.current())
                fail('AUTHOR_MESSAGE_FACTS_CHANGED');
            return captured;
        };
    }
    function captureOrdinaryChat(sid, ordinaryChat, messages, opening, nativeOwnerForSeq, targetSetIdentity) {
        const state = deps.authorChat;
        if (!state)
            fail('AUTHOR_CHAT_STATE_UNAVAILABLE');
        const captureMessages = (namespace, current) => captureAuthorMessageViewV1({
            sessionId: sid, namespace, state, inputState: deps.inputState, messages, opening, nativeOwnerForSeq, targetSetIdentity, current
        });
        if (ordinaryChat) {
            // Main owns the changing root and exact own-publication adoption. Reading
            // its immutable key revisions must not subscribe this schema view to a
            // mutable root that Main is about to advance legitimately.
            const captured = captureMessages(ordinaryChat.root.namespace, () => true);
            return { data: { ordinaryChat, ordinaryMessages: captured.ordinaryMessages }, current: captured.current };
        }
        const source = deps.captureOrdinaryChatNamespace?.(sid);
        if (!source)
            fail('AUTHOR_CHAT_STATE_UNAVAILABLE');
        // Source is read before entering the closed State frame. Every declaration
        // then consumes the same actual namespace/root currency, while its id only
        // identifies permission in the already admitted Browser program.
        const captured = deps.inputState.captureClosedHistoricalFacts(sid, `schema-ordinary-chat:${recordSha256(source.namespace)}`, () => ({
            ordinaryChat: state.captureNamespaceV3(source.namespace),
        }));
        const capturedMessages = captureMessages(source.namespace, () => source.current() && captured.current());
        return { data: { ...captured.data, ordinaryMessages: capturedMessages.ordinaryMessages }, current: capturedMessages.current };
    }
    function browserNumericalSnapshot(view, nativeCut) {
        const snapshot = view.history.snapshot, sid = view.session.id, editBlockCode = (deps.manualEditBlockCode ?? deps.manualPendingCode)?.(sid), currentMessageCarrier = view.history.readScopes?.currentMessageCarrier;
        return { kind: 'schema-ready', values: snapshot.values, expected: { sourceSha256: snapshot.sourceSha256,
                root: snapshot.root, revision: snapshot.revision, headSha256: snapshot.headSha256,
                valuesSha256: snapshot.valuesSha256, stateSnapshotSha256: snapshot.stateSnapshotSha256, observedNativeSeq: nativeCut - 1 },
            canEdit: !editBlockCode, ...editBlockCode ? { editBlockCode } : {}, ...currentMessageCarrier ? { currentMessageCarrier } : {} };
    }
    function captureManualBasis(sid) {
        const view = views.get(sid);
        if (!view || !viewCurrent(view))
            fail('SCHEMA_PLAYER_BASE_UNPROVEN');
        const check = () => {
            if (!view.history.readScopes || !currentSession(view.session) || deps.agent(view.session) !== view.agent
                || !deps.source.frameCurrent(view.history.original, view.frame))
                fail('SCHEMA_SCOPE_BASIS_UNPROVEN');
        };
        const basis = { session: view.session, agent: view.agent, original: view.history.original,
            ready: view.history.ready, base: view.history.snapshot, publication: numericalHeads.read(sid),
            currentMessageCarrier: view.history.readScopes?.currentMessageCarrier ?? null,
            frame: view.frame, inheritedCut: view.history.inheritedCut,
            scopeReadFrame: (cut) => {
                check();
                // The actual maintenance owner holds the Source lease while consuming
                // these immutable publication facts.
                return scopeFrameAt(view.history.readScopes, view.history.original, view.frame, cut, all(view.session));
            }, ...scopeRefAvailable(view.history.ready) ? { scopeReadRef: (cut) => {
                    check();
                    return scopeReferenceAt(view.session, view.history.readScopes, view.history.original, view.frame, cut, check);
                } } : {} };
        const closed = numericalCursors.get(sid);
        if (closed && closed.history.snapshot.stateSnapshotSha256 === view.history.snapshot.stateSnapshotSha256 && closed.proof.current()) {
            Object.defineProperty(basis, 'closedHistoryProof', { value: closed.proof });
        }
        if (view.history.inheritedReady)
            Object.defineProperty(basis, 'inheritedReady', { value: view.history.inheritedReady });
        return basis;
    }
    /** A retry reads the exact pre-dispatch Native cut. The active maintenance
     * owner separately proves current Source and the complete publication row. */
    function captureOpeningVariantBasis(sid, nativeCut) {
        const session = deps.session(sid), view = views.get(sid);
        if (!session || !currentSession(session) || !deps.agent(session))
            fail('OPENING_VARIANT_SESSION_INACTIVE');
        const history = nativeCut === undefined ? view && viewCurrent(view) ? view.history : undefined
            : factual(session, nativeCut, true, true);
        if (!history?.readScopes)
            fail('OPENING_VARIANT_BASIS_UNAVAILABLE');
        const frame = deps.source.captureFrame(history.original, sid), agent = deps.agent(session), check = () => {
            if (!currentSession(session) || deps.agent(session) !== agent || !deps.source.frameCurrent(history.original, frame))
                fail('OPENING_VARIANT_SOURCE_CHANGED');
        };
        check();
        let openingMessage;
        const activationRoot = history.snapshot.root.activation;
        if (activationRoot) {
            const activation = activationFor(activationRoot.sessionId, all(session), undefined, sid);
            if (!activation || activation.seed.event.eventSha256 !== activationRoot.eventSha256)
                fail('OPENING_VARIANT_ACTIVATION_UNPROVEN');
            const native = activation.seed.event.native, message = all(session)[native.assistantSeq];
            if (message.type !== 'assistant/message')
                fail('OPENING_VARIANT_NATIVE_UNPROVEN');
            openingMessage = { ownerSessionId: activation.seed.sessionId, nativeSeq: native.assistantSeq,
                messageId: native.messageId, messageVersionSha256: recordSha256(message.data.message) };
        }
        else {
            const seed = history.seed.kind === 'opening' ? history.seed : openingArchivesFor(sid).readSeed(history.original.preparation.identity.sessionId)?.seed;
            if (seed) {
                const native = seed.event.native, message = all(session)[native.assistantSeq];
                if (message?.type !== 'assistant/message' || message.data.message.id !== native.messageId)
                    fail('OPENING_VARIANT_NATIVE_UNPROVEN');
                openingMessage = { ownerSessionId: 'sessionId' in seed ? seed.sessionId : seed.intent.sessionId,
                    nativeSeq: native.assistantSeq, messageId: native.messageId,
                    messageVersionSha256: recordSha256(message.data.message) };
            }
        }
        const result = { session, agent, original: history.original, ready: history.ready, base: history.snapshot, frame,
            ...openingMessage ? { openingMessage } : {},
            nativeCut: nativeCut ?? all(session).length, publication: numericalHeads.read(sid), inheritedCut: history.inheritedCut,
            current: check, scopeReadFrame: (cut) => {
                check();
                return scopeFrameAt(history.readScopes, history.original, frame, cut, all(session));
            }, ...scopeRefAvailable(history.ready) ? { scopeReadRef: (cut) => {
                    check();
                    return scopeReferenceAt(session, history.readScopes, history.original, frame, cut, check);
                } } : {} };
        if (history.inheritedReady)
            Object.defineProperty(result, 'inheritedReady', { value: history.inheritedReady });
        return result;
    }
    function captureAuthorMessages(view, facts, source, capturedCut) {
        const sid = view.session.id, previous = authorReadMessages.get(sid), cut = capturedCut ?? deps.inputState.nativeHistory?.cut?.(view.session) ?? sessionHistoryCut(view.session), canonical = readTavernCanonicalChatChangesV1(sid, cut, deps.projections(), previous?.canonical);
        let cold = !previous || previous.session !== view.session || previous.realm !== view.history.original.realmEpoch
            || previous.sourceRecordSessionId !== source.sourceRecordSessionId || previous.importId !== source.importId || canonical.cold;
        const published = new Set();
        if (!cold) {
            let current = facts;
            while (current && current !== previous.facts) {
                for (const seq of current.publishedMessages ?? [])
                    published.add(seq);
                current = current.previous;
            }
            if (current !== previous.facts)
                cold = true;
        }
        const project = (entry, position) => {
            const saved = !cold ? previous.rows.get(entry.row.seq) : undefined;
            if (saved?.entry === entry && !published.has(entry.row.seq))
                return saved.scoped.position === position ? saved :
                    { ...saved, scoped: { ...saved.scoped, position }, message: { ...saved.message, position } };
            const message = entry.message;
            if (!message || message.id !== entry.row.messageId)
                fail('SCHEMA_SCOPE_MESSAGE_UNPROVEN');
            const messageId = entry.row.messageId, raw = entry.messageFacts, messageVersionSha256 = raw.messageVersionSha256, nativeOwner = scopeOwnerForSeq(facts, entry.row.seq), key = schemaScopeMessageKey(nativeOwner, entry.row.seq, messageId, messageVersionSha256), publication = facts.messages.get(key), ownerSessionId = publication?.kind === 'available' ? publication.provenance.owner.sessionId : nativeOwner, owner = schemaScopeOwner(source, 'message', messageId, ownerSessionId), variables = schemaScopeReowner(publication ?? schemaScopeEmpty(owner), owner), identity = { position, ownerSessionId, nativeSeq: entry.row.seq, messageId, messageVersionSha256,
                selectedVariant: messageVersionSha256 }, finalized = view.history.settledMessages?.get(settledMessageKey({ seq: entry.row.seq, messageId, versionSha256: messageVersionSha256 }));
            return { entry, scoped: { ...identity, isSystem: false, variables },
                message: { ...identity, role: entry.row.role, text: finalized?.message_content ?? raw.text } };
        };
        let rows, messages, scoped;
        if (cold || canonical.changes.length) {
            // Selected-message changes own ordering. Reassemble the required output
            // coordinates, retaining every unchanged message/variable fact.
            const ordered = [...canonical.view.range()].map(project);
            rows = new Map(ordered.map(row => [row.entry.row.seq, row]));
            messages = ordered.map(row => row.message);
            scoped = ordered.map(row => row.scoped);
        }
        else if (published.size) {
            const updated = new Map(previous.rows), nextMessages = previous.messages.slice(), nextScoped = previous.scoped.slice();
            for (const seq of published) {
                const position = canonical.position(seq), entry = previous.rows.get(seq)?.entry;
                if (position === undefined || !entry)
                    continue;
                const row = project(entry, position);
                updated.set(seq, row);
                nextMessages[position] = row.message;
                nextScoped[position] = row.scoped;
            }
            rows = updated;
            messages = nextMessages;
            scoped = nextScoped;
        }
        else {
            rows = previous.rows;
            messages = previous.messages;
            scoped = previous.scoped;
        }
        const original = view.history.original, activation = view.history.snapshot.root.activation?.eventSha256, projection = { session: view.session, realm: original.realmEpoch, original, activation,
            sourceRecordSessionId: source.sourceRecordSessionId, importId: source.importId, facts,
            canonical: { owner: canonical.owner, nativeCut: canonical.view.nativeCut }, rows, messages, scoped,
            ...!cold && !canonical.changes.length && previous?.original === original && previous.activation === activation
                ? { opening: previous.opening } : {} };
        authorReadMessages.set(sid, projection);
        return { canonical, projection, previousCanonical: previous?.canonical };
    }
    async function captureAuthorReadFacts(sid, readerDocument = false) {
        await preflight(sid);
        const view = views.get(sid);
        if (!view || !viewCurrent(view))
            fail('SCHEMA_BROWSER_FACTS_UNPROVEN');
        const ready = view.history.ready;
        if (!isAuthorHostJournalReadyV5(ready))
            return undefined;
        const program = ready.epoch.program.nativeProgram;
        if (!readerDocument && !program?.scripts.some(script => script.enabled))
            return undefined;
        const facts = view.history.readScopes;
        if (!facts || !view.agent)
            fail('SCHEMA_BROWSER_FACTS_UNPROVEN');
        const session = view.session, agent = view.agent, original = view.history.original, frame = view.frame;
        const stopSha256 = recordSha256(agent.lookupInputStop()), events = all(session), snapshot = view.history.snapshot;
        const source = schemaScopeSource(frame.snapshot);
        const basis = { sessionId: sid, sourceSnapshotSha256: frame.snapshotSha256, materialSha256: frame.materialSha256,
            numericalSnapshotSha256: snapshot.stateSnapshotSha256, nativeCut: events.length,
            nativePrefixSha256: schemaNativeCutSha256(events, events.length, deps.inputState.nativeHistory?.prefixes) };
        // Author chat coordinates retain archived stories. The canonical history
        // owner expands proven window checkpoints and applies selected message
        // versions; a model-window cut does not retire the completed opening.
        const priorPrefix = readerDocument ? readerPrefixes.get(sid) : undefined, { canonical, projection, previousCanonical } = captureAuthorMessages(view, facts, source), { messages, scoped } = projection;
        const descriptors = schemaOriginalCompilationInput(original).scripts;
        const scopeFrame = buildSchemaScopeReadFrame(source, recordSha256(basis), descriptors, facts.chat, scoped);
        const data = { basis, scopeFrame, messages, numerical: browserNumericalSnapshot(view, events.length) };
        // Attachment stability outlives this DATA's numerical/Native cut. Each
        // subsequent capture refreshes the view; writes keep their actual owner.
        const ownerCurrent = () => {
            try {
                return currentSession(session) && deps.agent(session) === agent && agent.session === session
                    && recordSha256(agent.lookupInputStop()) === stopSha256;
            }
            catch {
                return false;
            }
        };
        const current = () => ownerCurrent() && deps.source.frameCurrent(original, frame);
        if (!current())
            fail('SCHEMA_BROWSER_FACTS_CHANGED');
        const opening = projection.opening ??= captureAuthorOpening(view, scopeFrame, seq => events[seq]);
        // Match the generation capture's opening-zero author history. Native
        // import dialogue remains in its own scope frame, outside this projection.
        const start = messages.findIndex(message => message.messageId === opening.messageId);
        const sameCanonicalStart = priorPrefix?.canonical.owner === previousCanonical?.owner
            && priorPrefix?.canonical.nativeCut === previousCanonical?.nativeCut, readerCanonical = readerDocument && priorPrefix && !sameCanonicalStart ? readTavernCanonicalChatChangesV1(sid, deps.inputState.nativeHistory?.cut?.(session) ?? sessionHistoryCut(session), deps.projections(), priorPrefix.canonical) : canonical;
        let cold = !priorPrefix || readerCanonical.cold || priorPrefix.realm !== original.realmEpoch || priorPrefix.opening !== opening.messageId;
        const changed = new Set(readerCanonical.changes.map(change => change.seq));
        if (readerDocument && !cold) {
            let previous = facts;
            while (previous && previous !== priorPrefix.facts) {
                for (const seq of previous.publishedMessages ?? [])
                    changed.add(seq);
                previous = previous.previous;
            }
            if (previous !== priorPrefix.facts)
                cold = true;
        }
        const contributions = [], bySeq = new Map();
        const capturedMessages = messages.slice(start).map((message, index) => {
            const variables = scoped[start + index].variables, copied = message.messageId === opening.messageId && message.messageVersionSha256 === opening.originalMessageVersionSha256
                ? opening.copiedCandidates : null, packs = copied && variables.kind === 'available' ? deps.readOpeningVariantPacks?.(sid, copied, variables.variables) : undefined;
            const row = { index, messageId: message.messageId, ownerSessionId: message.ownerSessionId, nativeSeq: message.nativeSeq,
                messageVersionSha256: message.messageVersionSha256, role: message.role, message: message.text, variables,
                variants: copied ? { ...copied, ...packs } : null };
            if (readerDocument) {
                bySeq.set(message.nativeSeq, row);
            }
            return row;
        });
        const context = frame.material.openingContext, ordinary = captureOrdinaryChat(sid, undefined, capturedMessages, opening, seq => scopeOwnerForSeq(facts, seq), scopeFrame.frameSha256), ordinaryFor = authorOrdinaryMessageSelectionV1(ordinary.data.ordinaryMessages, opening), ordinaryCapturedMessages = capturedMessages.map(row => { const own = ordinaryFor(row); return own ? { ...row, ordinary: own } : row; });
        // This is the currently selected import's decoded Native DATA, already
        // captured in the Source frame. An unrelated author table row cannot
        // become getContext().characters[characterId] by lexical sort order.
        const card = frame.material.card, native = card.data;
        const character = { sourceId: frame.snapshot.source.importId,
            name: String(native.name), ...typeof native.avatar === 'string' ? { avatar: native.avatar } : {} };
        if (readerDocument) {
            const ordinaryRows = new Map(), byTarget = new Map(ordinary.data.ordinaryMessages.map(capture => [capture.root.namespace.target, capture]));
            for (const row of ordinaryCapturedMessages) {
                const capture = row.ordinary ? byTarget.get(row.ordinary.selectedTarget) : undefined, previous = priorPrefix?.ordinary.get(row.nativeSeq), before = previous?.root, after = capture?.root, beforeVariant = before?.namespace.target?.identity.variant, afterVariant = after?.namespace.target?.identity.variant;
                ordinaryRows.set(row.nativeSeq, capture);
                if (before?.head?.key !== after?.head?.key || before?.head?.sha256 !== after?.head?.sha256
                    || before?.base?.key !== after?.base?.key || before?.base?.sha256 !== after?.base?.sha256
                    || beforeVariant?.kind !== afterVariant?.kind
                    || (beforeVariant?.kind === 'opening-variant' ? beforeVariant.id : null) !== (afterVariant?.kind === 'opening-variant' ? afterVariant.id : null)) {
                    changed.add(row.nativeSeq);
                }
                if (!cold && !changed.has(row.nativeSeq))
                    continue;
                // Ordinary deletion masks this row's fallback only. The prefix owner
                // then merges actual row DATA, allowing an earlier row to supply a key.
                contributions.push({ target: scoped[start + row.index], variables: authorOrdinaryMessageVariablesV1(row.variables, capture) });
            }
            const prefix = cold ? createReaderVariablePrefix() : priorPrefix.prefix;
            if (cold)
                prefix.reset(contributions, canonical.position);
            else {
                const updates = new Map(contributions.map(row => [row.target.nativeSeq, row]));
                prefix.apply([...changed].map(seq => ({ seq, row: updates.get(seq) })), canonical.position);
            }
            const prefixState = { realm: original.realmEpoch, opening: opening.messageId, facts, ordinary: ordinaryRows,
                stamp: cold || changed.size ? {} : priorPrefix.stamp, prefix,
                canonical: { owner: canonical.owner, nativeCut: canonical.view.nativeCut } };
            readerPrefixes.set(sid, prefixState);
            const base = readerVariableBase(scopeFrame.scopes, ordinary.data.ordinaryChat);
            const readerData = { ...data,
                schemaVersion: 1, encoding: 'reader-regex-document-snapshot-v1', messages: ordinaryCapturedMessages,
                persona: { name: context.user, ...context.user_gender !== undefined ? { gender: context.user_gender } : {}, avatar: null },
                character, ordinaryChat: ordinary.data.ordinaryChat, ...{ ordinaryMessages: ordinary.data.ordinaryMessages } };
            return { kind: 'reader-regex-document-facts', data: readerData,
                readMessagePrefix: target => {
                    if (readerPrefixes.get(sid)?.stamp !== prefixState.stamp || !canonical.current())
                        fail('READER_VARIABLE_PREFIX_CHANGED');
                    const row = bySeq.get(target.seq);
                    if (!row || row.messageId !== target.messageId || row.messageVersionSha256 !== target.messageVersionSha256)
                        fail('READER_VARIABLE_TARGET_UNAVAILABLE');
                    const identity = { ownerSessionId: row.ownerSessionId, nativeSeq: target.seq, messageId: row.messageId,
                        messageVersionSha256: row.messageVersionSha256, selectedVariant: scopeFrame.messages[start + row.index].selectedVariant };
                    return { target: identity, values: prefix.read(identity, base) };
                },
                current: () => current() && ordinary.current?.() !== false && canonical.current(),
                sourceCurrent: () => ownerCurrent() && deps.source.frameIdentityCurrent(frame) };
        }
        if (!program)
            return undefined;
        {
            const nativeData = { ...data,
                schemaVersion: 1, encoding: 'author-native-helper-snapshot-v1', messages: ordinaryCapturedMessages,
                persona: { name: context.user, ...context.user_gender !== undefined ? { gender: context.user_gender } : {}, avatar: null }, character,
                ordinaryChat: ordinary.data.ordinaryChat, ordinaryMessages: ordinary.data.ordinaryMessages,
                context: { chatId: sid, name1: context.user, name2: character.name, characterId: 0, characters: [character],
                    eventTypes: AUTHOR_NATIVE_EVENTS_V1 } };
            const resources = deps.source.captureScriptResources(frame);
            const capture = (read) => ({
                program, data: { ...nativeData, ordinaryChat: read.data.ordinaryChat, ordinaryMessages: read.data.ordinaryMessages }, resources,
                sourceCurrent: () => ownerCurrent() && deps.source.frameIdentityCurrent(frame),
                current: () => current() && read.current?.() !== false,
                captureOrdinarySuccessor: () => {
                    if (!current())
                        return undefined;
                    // This independent writer has a real ACK while the numerical hook's
                    // journal pair is still open. Refresh only its current namespace DATA;
                    // the accepted numerical state and message cut above remain exact.
                    const next = captureOrdinaryChat(sid, undefined, capturedMessages, opening, seq => scopeOwnerForSeq(facts, seq), scopeFrame.frameSha256);
                    return next.current?.() !== false ? capture(next) : undefined;
                },
            });
            return capture(ordinary);
        }
    }
    async function captureBrowserFacts(sid) {
        return captureAuthorReadFacts(sid);
    }
    async function captureReaderDocumentFacts(sid) {
        return captureAuthorReadFacts(sid, true);
    }
    /** A denial basis survives later projection/head changes. This selects only
     * immutable original Native/author facts and never exposes numerical values. */
    function readEditBasis(sid) {
        try {
            if (capturingEditBasis?.sid === sid)
                return capturingEditBasis.basis;
            const view = views.get(sid);
            if (view && viewCurrent(view))
                return view.history.editBasis;
            const session = deps.session(sid);
            if (!session)
                return undefined;
            const cursor = numericalCursors.get(sid), nativeCut = deps.inputState.nativeHistory?.cut?.(session);
            if (cursor?.session === session && nativeCut?.source === 'native' && cursor.owner === nativeCut.owner && cursor.proof.current()) {
                // Denial DATA retains the original opening root, not today's numerical
                // head or publication rights. Its proof enrolls the actual seed rows.
                cursor.proof.use();
                return cursor.history.editBasis;
            }
            const activation = activationFor(sid, all(session));
            if (activation) {
                if (session.inheritedEventCount !== 0 || session.header.parentSession !== activation.seed.parentSessionId)
                    return undefined;
                return { root: activation.seed.snapshot.root, editFloorSeq: activation.seed.event.native.turnEndSeq + 1 };
            }
            if (deps.derivedRequired?.(sid)) {
                const genesis = deps.readDerivedGenesis?.(sid);
                return genesis ? { root: genesis.snapshot.root, editFloorSeq: genesis.inheritedCut.nativeCut } : undefined;
            }
            const raw = prefixInputs.status.get(mvuInitializationHeadKey(sid));
            if (!raw)
                return undefined;
            const head = validateMvuSchemaOpeningHead(raw);
            const event = validateMvuSchemaOpeningEvent(prefixInputs.status.get(mvuInitializationEventKey(sid, head.eventId)));
            const intent = validateMvuSchemaOpeningIntent(prefixInputs.branch.get(openingIntentKey(sid, event.plan.identity.source.importId)));
            const events = all(session), native = event.native;
            if (native.turnEndSeq >= events.length || !verifyMvuSchemaInheritedOpeningFacts({ intent, event, head,
                events: events.slice(0, native.turnEndSeq + 1) }, { projectPrefix: deps.projectPrefix }))
                return undefined;
            const cut = intent.initialization.execution.completionMarker.seq + 1;
            const { original } = deps.source.captureCurrentOriginal(intent.preparation, { sessionId: sid, table: prefixInputs.status,
                events: events.slice(0, cut) }, true);
            return { root: { openingEventId: event.eventId, openingEventSha256: event.eventSha256,
                    openingHeadSha256: recordSha256(head), openingPlanSha256: event.plan.planSha256,
                    realmEpoch: original.realmEpoch, programSha256: schemaOriginalProgramSha256(original) }, editFloorSeq: native.turnEndSeq + 1 };
        }
        catch {
            return undefined;
        }
    }
    function ownerFor(closing, plan) {
        const owner = owners.get(plan.base.sessionId);
        return owner && owner.lease === closing && same(owner.plan, plan) ? owner : undefined;
    }
    async function executeOwnedHook(plan, supplied, closing) {
        if (!deps.prepareHook || plan.schemaVersion === 5)
            return;
        const owner = ownerFor(closing, plan);
        if (!owner || !ownerCurrent(owner))
            fail('SCHEMA_STORY_PERMISSION_REVOKED');
        let request = supplied, commandError;
        if (request.stage === 'command-parsed')
            try {
                request = { ...request, payload: { ...request.payload, commands: mvuSchemaStoryCommandInfos(plan) } };
            }
            catch (error) {
                commandError = error;
            }
        const signal = AbortSignal.any([owner.view.signal, owner.abort.signal]), prepared = await deps.prepareHook(request, signal);
        if (!prepared)
            return;
        const session = owner.view.session;
        let dispatch;
        let dispatchRef, dispatchMarker;
        try {
            if (commandError)
                throw commandError;
            await withLease(owner, async () => {
                signal.throwIfAborted();
                if (request.stage === 'before-message-update') {
                    const live = owner.lastLive;
                    if (!live)
                        fail('SCHEMA_STORY_EXECUTION_UNPROVEN');
                    owner.associations.pop();
                    try {
                        if (!owner.driver.checkEvidence(live.evidence, { association: live.association, output: live.output }))
                            fail('SCHEMA_STORY_PUBLICATION_UNPROVEN');
                        owner.workerPublicationProven = live;
                    }
                    finally {
                        owner.associations.push(live.association);
                    }
                }
                const events = actualNative(session), ready = journal.captureLive(session.id, plan.realmEpoch, { inherited: owner.inheritedReady ?? null, executionBaseline: owner.executionBaseline });
                if (ready.kind !== 'ready' || !isAuthorHostJournalReadyV5(ready))
                    fail('SCHEMA_BROWSER_HOST_REQUIRED');
                const sourceNativeCut = { ...plan.initialCut, nativeCut: events.length, nativePrefixSha256: actualNativeSha(events) };
                dispatch = sealSchemaJournalRecord({ schemaVersion: 5, encoding: 'native-author-browser-hook-dispatch-v5',
                    sessionId: session.id, realmEpoch: plan.realmEpoch, batchId: prepared.identity.invocationId, epoch: ready.epochRef,
                    previousTailSha256: schemaJournalServerTailSha256(ready), sourceNativeCut, request, identity: prepared.identity });
                dispatchRef = await journal.putProduced(dispatch);
                if (!ownerCurrent(owner) || actualNative(session).length !== events.length)
                    fail('SCHEMA_BROWSER_DISPATCH_CHANGED');
                const marker = deps.markers.appendDispatch(session, { schemaVersion: 1, encoding: 'native-mvu-schema-dispatch-marker-v1',
                    sessionId: session.id, realmEpoch: plan.realmEpoch, batchId: dispatch.batchId,
                    programSha256: plan.programSha256, sourceSha256: schemaEpochAuthorIdentity(ready.epoch).sourceSha256,
                    previousTailSha256: dispatch.previousTailSha256, dispatchRecordSha256: dispatch.recordSha256,
                    loadDescriptorSha256: null, observedNativeSeq: session.seq - 1 });
                dispatchMarker = { seq: marker.seq, sha256: recordSha256(marker) };
                if (!await deps.flush(session))
                    fail('SCHEMA_BROWSER_DISPATCH_FLUSH_UNKNOWN');
                if (!ownerCurrent(owner) || actualNative(session).length !== dispatchMarker.seq + 1)
                    fail('SCHEMA_BROWSER_DISPATCH_CHANGED');
            });
            // Browser callbacks may commit independently owned namespace/worldbook
            // writes. Keep Source unlocked while waiting, then rejoin the exact
            // dispatch under the original closing lease before accepting its DATA.
            const result = await prepared.execute();
            return await withLease(owner, async () => {
                signal.throwIfAborted();
                const events = actualNative(session);
                if (result.stage !== request.stage || events.length < dispatchMarker.seq + 1
                    || recordSha256(events.at(dispatchMarker.seq)) !== dispatchMarker.sha256)
                    fail('SCHEMA_BROWSER_COMPLETION_CHANGED');
                mvuSchemaStoryVariableParts(result.stage === 'before-message-update' ? result.output.context.variables : result.output.variables);
                const completion = sealSchemaJournalRecord({ schemaVersion: 5, encoding: 'native-author-browser-hook-completion-v5',
                    sessionId: session.id, realmEpoch: plan.realmEpoch, batchId: dispatch.batchId, dispatch: dispatchRef,
                    dispatchMarker, result });
                await journal.putProduced(completion);
                if (!ownerCurrent(owner) || actualNative(session).length !== events.length)
                    fail('SCHEMA_BROWSER_COMPLETION_CHANGED');
                const completed = deps.markers.appendCompletion(session, { schemaVersion: 1, encoding: 'native-mvu-schema-completion-marker-v1',
                    sessionId: session.id, realmEpoch: plan.realmEpoch, batchId: dispatch.batchId, dispatchSeq: dispatchMarker.seq,
                    dispatchRecordSha256: dispatch.recordSha256, completionRecordSha256: completion.recordSha256,
                    completedTailSha256: dispatch.previousTailSha256, observedNativeSeq: session.seq - 1 });
                if (!await deps.flush(session))
                    fail('SCHEMA_BROWSER_COMPLETION_FLUSH_UNKNOWN');
                if (!ownerCurrent(owner) || actualNative(session).length !== completed.seq + 1)
                    fail('SCHEMA_BROWSER_COMPLETION_CHANGED');
                const ready = journal.captureLive(session.id, plan.realmEpoch, { inherited: owner.inheritedReady ?? null, executionBaseline: owner.executionBaseline });
                if (ready.kind !== 'ready')
                    fail(ready.code);
                const pair = ready.entries?.at(-1);
                if (!pair || !isSchemaBrowserFacts(pair) || pair.dispatch.recordSha256 !== dispatch.recordSha256
                    || pair.completion.recordSha256 !== completion.recordSha256)
                    fail('SCHEMA_BROWSER_COMPLETION_UNPROVEN');
                const fact = freezeSchemaJournalData({ schemaVersion: 1, request, result: pair.completion.result,
                    journal: pair, frontier: frontier(ready) });
                owner.hooks.push(fact);
                return fact;
            });
        }
        finally {
            prepared.dispose();
        }
    }
    async function executeOwnedPhase(plan, phase, input, closing) {
        const owner = ownerFor(closing, plan);
        if (!owner)
            return { kind: 'blocked', code: 'SCHEMA_STORY_PERMISSION_REVOKED' };
        return withLease(owner, async () => {
            const index = phase === 'hook-reconcile' ? 3 : MVU_SCHEMA_STORY_PHASES.indexOf(phase), selector = index === 3 ? mvuSchemaStoryReconcileSelector(plan) : plan.selectors[index];
            const expected = phase === 'hook-reconcile' ? 2 : index + (owner.associations.some(value => value.batchId === mvuSchemaStoryReconcileSelector(plan).batchId) ? 1 : 0);
            if (expected !== owner.associations.length)
                fail('SCHEMA_STORY_PHASE_ORDER');
            const session = owner.view.session, events = actualNative(session), cut = { ...plan.initialCut,
                nativeCut: events.length,
                nativePrefixSha256: actualNativeSha(events), anchor: selector.anchor };
            const captureJournal = () => journal.captureLive(session.id, plan.realmEpoch, { inherited: owner.inheritedReady ?? null,
                executionBaseline: owner.executionBaseline });
            const ready = captureJournal();
            if (ready.kind !== 'ready')
                fail(ready.code);
            let capturedInput = input;
            if (input.encoding === 'native-mvu-author-schema-phase-input-v4-scope-ref-v2') {
                if (plan.schemaVersion !== 12 || !owner.readScopes || !same(input.scopeReadRef, plan.scopeReadRef))
                    fail('SCHEMA_SCOPE_BASIS_UNPROVEN');
                const reference = await scopeReferenceAt(session, owner.readScopes, owner.original, owner.frame, cut, () => {
                    if (!ownerCurrent(owner))
                        fail('SCHEMA_STORY_PERMISSION_REVOKED');
                });
                capturedInput = Object.freeze({ ...input, scopeReadRef: reference });
            }
            else {
                if ((plan.schemaVersion !== 5 && plan.schemaVersion !== 6 && plan.schemaVersion !== 10) || input.schemaVersion !== plan.executorVersion
                    || !owner.readScopes || !schemaScopeReadFactsEqual(input.scopeReadFrame, plan.scopeReadFrame)) {
                    fail('SCHEMA_SCOPE_BASIS_UNPROVEN');
                }
                const expected = scopeFrameAt(owner.readScopes, owner.original, owner.frame, cut, 'materialize' in events ? events.materialize() : events);
                if (!schemaScopeReadFactsEqual(expected, plan.scopeReadFrame))
                    fail('SCHEMA_SCOPE_BASIS_UNPROVEN');
                capturedInput = Object.freeze({ ...input, scopeReadFrame: freezeSchemaJournalData(expected) });
            }
            const requestedStep = schemaTraceRequestedStep(selector.batchId, { ownerSessionId: session.id, sourceNativeCutSha256: recordSha256(cut), material: owner.frame.material }, capturedInput);
            Object.freeze(requestedStep.frame);
            Object.freeze(requestedStep);
            owner.scope = { owner: owner.token, incarnation: owner.view.agent, session,
                signal: AbortSignal.any([owner.view.signal, owner.abort.signal]), authorInput: schemaOriginalReplayCompilationInput(owner.original),
                realmEpoch: plan.realmEpoch, loadFrame: schemaEpochExecution(ready.epoch).loadFrame, inheritedCut: owner.inheritedCut,
                sourceNativeCut: freezeSchemaJournalData(cut), requestedStep, journalCut: ready, compiledProgram: owner.compiledProgram };
            // Replay may be a separate Host5 bundle. The actual Node producer owns
            // this capture; its checked DATA never becomes a cross-bundle token.
            if (owner.inheritedReady)
                Object.defineProperty(owner.scope, 'inheritedReady', { value: owner.inheritedReady });
            Object.defineProperty(owner.scope, 'captureJournal', { value: captureJournal });
            const { driver: replay } = await engine(ready);
            if (owner.driver !== replay)
                fail('SCHEMA_IMPLEMENTATION_CHANGED');
            const result = await replay.execute(selector);
            if (result.kind === 'completed') {
                owner.compiledProgram = result.compiledProgram;
                result.capturedInput = capturedInput;
                owner.lastLive = result;
                owner.associations.push(result.association);
            }
            return result;
        });
    }
    const transaction = createRoleplayMvuSchemaStory({ table: prefixInputs.status,
        readReady: (_scope, plan) => {
            const owner = owners.get(plan.base.sessionId);
            return owner && same(owner.plan, plan)
                ? { kind: 'ready', snapshot: owner.base } : { kind: 'blocked', code: 'SCHEMA_STORY_BASE_CHANGED' };
        }, closingCurrent: (closing, scope, plan) => {
            const owner = ownerFor(closing, plan);
            return !!owner && same(scope, plan.scope) && ownerCurrent(owner);
        }, executePhase: executeOwnedPhase,
        executeReconcile: (plan, input, closing) => executeOwnedPhase(plan, 'hook-reconcile', input, closing),
        executeHook: executeOwnedHook,
        withPublicationBoundary: async (closing, lastLive, action) => {
            const owner = [...owners.values()].find(value => value.lease === closing && value.lastLive === lastLive);
            if (!owner)
                fail('SCHEMA_OWNER_UNPROVEN');
            return withLease(owner, action);
        }, checkPublication: (closing, lastLive, boundary) => {
            const owner = ownerFor(closing, boundary.plan);
            if (!owner || owner.lastLive !== lastLive || !owner.inSource || sourceLeases.get(owner.view.session.id) !== owner)
                return false;
            const phases = mvuSchemaStoryExecutionPhases(boundary.event);
            if (!ownerCurrent(owner) || !same(phases.map(phase => phase.association), owner.associations)
                || !same(boundary.event.browser?.hooks ?? [], owner.hooks))
                return false;
            const ready = journal.captureLive(owner.view.session.id, boundary.plan.realmEpoch, { inherited: owner.inheritedReady ?? null,
                executionBaseline: owner.executionBaseline });
            if (ready.kind !== 'ready' || !same(frontier(ready), boundary.event.frontier))
                return false;
            for (const [index, phase] of phases.entries()) {
                const step = ready.steps.at(ready.steps.length + index - phases.length);
                if (!step || !same(step.step.output, phase.output) || !same(step.step.frame.input, phase.input)
                    || !same(step.dispatchRef, phase.association.dispatch) || !same(step.completionRef, phase.association.completion))
                    return false;
            }
            // Only the final token still represents the current frontier. Earlier
            // tokens are intentionally stale and are covered by the full pinned chain.
            if (owner.hooks.some(hook => hook.request.stage === 'before-message-update'))
                return owner.workerPublicationProven === lastLive;
            owner.associations.pop();
            try {
                return owner.driver.checkEvidence(lastLive.evidence, { association: lastLive.association, output: lastLive.output });
            }
            finally {
                owner.associations.push(lastLive.association);
            }
        } });
    async function prepareCompletion(scope, closing) {
        if (!closing)
            fail('SCHEMA_OWNER_UNPROVEN');
        const view = deps.closingView(closing, scope), sid = scope.receipt.checkpoint.sessionId;
        if (!view || !deps.verifyNative(scope))
            fail('SCHEMA_OWNER_UNPROVEN');
        await deps.awaitOwnedCompletion(sid, scope.receipt.checkpoint.actualTurn);
        const completedBody = deps.readCanonical(sid, scope.receipt.checkpoint.actualTurn);
        const maintenance = completedBody && await deps.maintenanceCompletion?.(scope, { ...completedBody, narrativeSha256: sha256(completedBody.narrative) }, view.signal);
        if (!view.current())
            fail('SCHEMA_STORY_PERMISSION_REVOKED');
        const session = view.session, basis = deps.inputState.captureClosing(sid, () => {
            const body = deps.readCanonical(sid, scope.receipt.checkpoint.actualTurn);
            const row = scope.currency.snapshot && prefixInputs.branch.get(scope.currency.snapshot.key);
            const base = row?.numericalState;
            if (!body || !base || !inputSnapshotReferenceCurrent(prefixInputs.branch, sid, scope.currency)) {
                fail('SCHEMA_STORY_BASIS_CHANGED');
            }
            const history = factual(session), frame = deps.source.captureFrame(history.original, sid);
            const canonical = { ...body, narrativeSha256: sha256(body.narrative) };
            if (!same(base, history.snapshot) || deps.sourceSha256(sid) !== scope.currency.source.sourceSha256) {
                fail('SCHEMA_STORY_BASIS_CHANGED');
            }
            const phase = prefixInputs.branch.get(`${sid}__phaseb-${scope.receipt.checkpoint.actualTurn}`);
            if (phase?.state !== 'completed' || phase.assistantSeq !== body.seq)
                fail('INPUT_TERMINAL_PHASE_BC_UNRESOLVED');
            const selectorsAnchor = { kind: 'story', preparationId: scope.currency.preparationId,
                attemptGeneration: scope.currency.attemptGeneration, receiptGeneration: scope.currency.receiptGeneration,
                turn: scope.receipt.checkpoint.actualTurn, canonicalSeq: body.seq, messageId: body.messageId,
                messageVersionSha256: body.versionSha256 };
            const events = actualNative(session), initialCut = { schemaVersion: 1, sessionId: sid, ownerSessionId: sid,
                nativeCut: events.length,
                nativePrefixSha256: actualNativeSha(events),
                sourceSnapshotSha256: frame.snapshotSha256,
                materialSha256: frame.materialSha256, stopGeneration: scope.stopGeneration, anchor: selectorsAnchor };
            const useReference = scopeRefAvailable(history.ready), scopeReadFrame = !useReference && history.readScopes
                ? scopeFrameAt(history.readScopes, history.original, frame, initialCut, 'materialize' in events ? events.materialize() : events) : undefined;
            const ready = history.ready, executorVersion = ready.epoch.schemaVersion === 5 ? 4 : ready.epoch.schemaVersion;
            const errorPolicy = isAuthorHostJournalReadyV5(ready)
                ? schemaPhaseErrorPolicyForProgramV4(ready.epoch.program.serverProgram) : undefined;
            const makePlan = (reference) => transaction.makePlan(scope, canonical, base, frame, history.original.realmEpoch, schemaOriginalProgramSha256(history.original), initialCut, events.at(scope.receipt.turnEndSeq).time, executorVersion, scopeReadFrame, isAuthorHostJournalReadyV5(ready) ? { epoch: ready.epochRef,
                serverProgramSha256: ready.epoch.program.serverProgram.programSha256,
                ...(errorPolicy && errorPolicy !== 'atomic-refusal' ? { errorPolicy } : {}) } : undefined, maintenance, reference);
            if (owners.has(sid))
                fail('SCHEMA_STORY_OWNER_EXISTS');
            return { history, frame, base, makePlan, useReference, initialCut, events };
        });
        try {
            const { history, frame, base, makePlan, useReference, initialCut, events } = basis.data;
            const check = () => { if (!view.current() || !basis.current())
                fail('SCHEMA_STORY_BASIS_CHANGED'); };
            const reference = useReference && history.readScopes
                ? await scopeReferenceAt(session, history.readScopes, history.original, frame, initialCut, check) : undefined;
            const plan = makePlan(reference);
            const { driver } = await engine(history.ready);
            const currentEvents = actualNative(session);
            // Native snapshots contain deeply frozen events and only grow by append.
            // The same cut and tail retain this prefix; edits append a new event.
            // Domain/Source changes are checked by the captured dependencies, so an
            // await boundary does not need to fold and hash all historical facts again.
            if (!view.current() || !basis.current() || currentEvents.length !== events.length
                || currentEvents.at(currentEvents.length - 1) !== events.at(events.length - 1))
                fail('SCHEMA_STORY_BASIS_CHANGED');
            if (owners.has(sid))
                fail('SCHEMA_STORY_OWNER_EXISTS');
            const owner = { lease: closing, view, original: history.original, frame, base, plan, driver,
                readScopes: history.readScopes, inheritedCut: history.inheritedCut, inheritedReady: history.inheritedReady,
                executionBaseline: history.ready.executionBaseline,
                abort: new AbortController(),
                token: Object.freeze({}), inSource: false, associations: [], hooks: [] };
            owners.set(sid, owner);
            scopes.set(owner.token, owner);
            return plan;
        }
        finally {
            basis.release();
        }
    }
    function releaseClosing(lease) {
        for (const [sid, owner] of owners)
            if (owner.lease === lease) {
                owner.abort.abort();
                for (const driver of drivers.values())
                    driver.invalidateOwner(owner.token);
                owners.delete(sid);
                views.delete(sid);
                deps.inputState.invalidateSession(sid);
            }
    }
    function latestCompletedStory(session, nativeCut) {
        const cut = deps.inputState.nativeHistory?.cut?.(session), projections = deps.projections?.();
        if (!cut || cut.source !== 'native' || !projections)
            fail('SCHEMA_STORY_CANONICAL_OWNER_REQUIRED');
        if (nativeCut !== undefined && nativeCut !== cut.length) {
            const view = readTavernCanonicalChatAtCutV1(session.id, cut, nativeCut, projections);
            let last;
            for (const item of view.range())
                if (item.row.role === 'assistant' && item.row.turn !== null
                    && view.nativeTurnEndSeq(item.row.turn) !== undefined)
                    last = item;
            return last;
        }
        const previous = textCanonicalPointers.get(session), captured = readTavernCanonicalChatChangesV1(session.id, cut, projections, previous);
        let last = previous?.last, provisional = previous?.provisional;
        const terminal = (item) => item.row.turn !== null && captured.nativeTurnEndSeq(item.row.turn) !== undefined, after = (item, prior) => !prior
            || (captured.position(item.row.seq) ?? -1) >= (captured.position(prior.row.seq) ?? -1);
        if (captured.cold || last && captured.position(last.row.seq) === undefined
            || provisional && captured.position(provisional.row.seq) === undefined) {
            last = undefined;
            provisional = undefined;
            for (const item of captured.view.range())
                if (item.row.role === 'assistant') {
                    if (terminal(item))
                        last = item;
                    else
                        provisional = item;
                }
        }
        else
            for (const { item } of captured.changes)
                if (item?.row.role === 'assistant') {
                    if (terminal(item)) {
                        if (after(item, last))
                            last = item;
                    }
                    else if (after(item, provisional))
                        provisional = item;
                }
        // Core can prove the selected body before inline maintenance and Native
        // turn/end. Keep that tail separate: its end may not change chat selection,
        // and it must not hide an earlier terminated but unresolved Story.
        if (provisional && terminal(provisional)) {
            if (after(provisional, last))
                last = provisional;
            provisional = undefined;
        }
        textCanonicalPointers.set(session, { owner: captured.owner, nativeCut: cut.length, last, provisional });
        return last;
    }
    function assertSettledStoryTextReady(session, history, last) {
        if (!last)
            return;
        const seed = history.seed, baseline = seed.kind === 'opening' ? seed.event.native.assistantSeq
            : seed.kind === 'derived' ? history.inheritedCut.nativeCut - 1
                : openingArchivesFor(session.id).readSeed(session.id, seed.activationRef).seed.event.native.assistantSeq;
        if (last.row.seq <= Math.max(baseline, history.lastClosedStoryCanonicalSeq ?? -1))
            return;
        const completion = deps.agent(session)?.lookupInputCompletion();
        if (completion && completion.status !== 'none' && completion.checkpoint.actualTurn === last.row.turn
            && completion.status !== 'settled')
            fail(completion.code ?? (completion.status === 'pending'
                ? 'SCHEMA_STORY_TERMINAL_PENDING' : 'SCHEMA_STORY_TERMINAL_UNRESOLVED'));
        // Cold Native lookup has no hot receipt. The selected completed canonical
        // still must belong to this owner's already consumed settled prefix.
        fail('SCHEMA_STORY_TERMINAL_UNRESOLVED');
    }
    function captureSettledStoryMessages(sessionId, selection) {
        const session = deps.session(sessionId);
        if (!session || !currentSession(session))
            return;
        const known = views.get(sessionId), head = prefixInputs.status.get(mvuInitializationHeadKey(sessionId));
        if (!known && head?.encoding !== 'mvu-schema-opening-head-v2' && !deps.readDerivedGenesis?.(sessionId)
            && prefixInputs.status.get(openingVariantActivationEventKey(sessionId)) === undefined)
            return;
        if (selection && selection.nativeCut !== actualNative(session).length) {
            if (!Number.isSafeInteger(selection.nativeCut) || selection.nativeCut < 0 || selection.nativeCut > actualNative(session).length)
                fail('SCHEMA_NATIVE_CUT_INVALID');
            const read = deps.inputState.captureHistoricalFacts(sessionId, `settled-story-messages:${selection.nativeCut}`, () => ({ history: factual(session, selection.nativeCut, true), last: latestCompletedStory(session, selection.nativeCut) })), index = read.data.history.settledMessages;
            assertSettledStoryTextReady(session, read.data.history, read.data.last);
            return { read: target => index?.get(settledMessageKey(target)), hasValues: (index?.size ?? 0) > 0,
                current: () => read.current() && currentSession(session), stamp: index ?? read.data };
        }
        let view = known;
        if (!view || !viewCurrent(view)) {
            const read = captureSchemaRead(sessionId);
            publishSchemaRead(read);
            view = views.get(sessionId);
        }
        const selected = view, index = view.history.settledMessages;
        assertSettledStoryTextReady(session, selected.history, latestCompletedStory(session));
        return { read: target => index?.get(settledMessageKey(target)), hasValues: (index?.size ?? 0) > 0,
            current: () => {
                if (!viewCurrent(selected))
                    return false;
                try {
                    assertSettledStoryTextReady(session, selected.history, latestCompletedStory(session));
                    return true;
                }
                catch {
                    return false;
                }
            }, stamp: index ?? view.history };
    }
    function readSettledStoryMessage(sessionId, target) {
        return captureSettledStoryMessages(sessionId)?.read(target);
    }
    function verifyConsumed(scope, plan, settlement) {
        const view = views.get(plan.base.sessionId);
        if (!view || !viewCurrent(view) || !transaction.verifyConsumed(scope, plan, settlement))
            return false;
        try {
            const terminal = readInputCompletion(prefixInputs.branch, plan.base.sessionId, scope.currency.preparationId);
            const event = prefixInputs.status.get(settlement.event.key);
            return view.history.consumed.get(plan.planSha256) === recordSha256({ terminal, event, settlement });
        }
        catch {
            return false;
        }
    }
    const captureConsumedProof = (scope, plan, settlement, onInvalidate) => {
        if (plan.kind !== 'schema-numerical')
            return undefined;
        const sid = scope.receipt.checkpoint.sessionId, session = deps.session(sid);
        if (!session)
            return undefined;
        try {
            let cursor = numericalCursors.get(sid), entry = cursor?.facts.get(plan.plan.planSha256);
            if (!entry || !entry.fact.current()) {
                factual(session);
                cursor = numericalCursors.get(sid);
                entry = cursor?.facts.get(plan.plan.planSha256);
            }
            if (!entry || !entry.fact.current() || !transaction.verifyConsumed(scope, plan.plan, settlement))
                return undefined;
            const terminal = readInputCompletion(prefixInputs.branch, sid, scope.currency.preparationId), event = prefixInputs.status.get(settlement.event.key);
            if (entry.closureSha256 !== recordSha256({ terminal, event, settlement }))
                return undefined;
            const fact = entry.fact, unsubscribe = fact.onInvalidated(onInvalidate);
            let released = false;
            return { current: () => !released && fact.current(), dispose() { released = true; unsubscribe(); } };
        }
        catch {
            return undefined;
        }
    };
    return { preflight, readCompletedOpening, adoptPublishedPlayer, captureAuthorDataPublicationBasis,
        observation, readSnapshot, readSchemaObservation, supportsMaintenance, captureMaintenanceBase, checkTextEdit,
        taskEditFacts, taskArtifact, taskEditResolved,
        captureReaderDisplayScopes, capturePromptScopes, captureBrowserFacts, captureReaderDocumentFacts,
        readEditBasis, captureManualBasis, captureOpeningVariantBasis, captureHistoricalCut, borrowHistoricalCut,
        captureForkPrefix, captureRevisionForkPrefix, recoverForkPrefix, verifyForkPrefix, captureFrozenForkPrefix, captureAncestorForkPrefix,
        recoverFrozenForkPrefix, verifyFrozenForkPrefix,
        prepareCompletion, releaseClosing, verifyConsumed, captureConsumedProof, readSettledStoryMessage, captureSettledStoryMessages,
        reconcileAcceptedEdit,
        reconcileExistingUserEditRecovery,
        publishCompletion: (scope, plan, closing) => closing
            ? transaction.publish(scope, plan, closing) : Promise.resolve({ kind: 'blocked', code: 'SCHEMA_OWNER_UNPROVEN' }),
        verifySettlement: transaction.verifySettlement,
        invalidateSession,
        invalidateAgent(agent) {
            const affected = new Set();
            for (const [sid, owner] of owners)
                if (owner.view.agent === agent)
                    affected.add(sid);
            for (const [sid, view] of views)
                if (view.agent === agent)
                    affected.add(sid);
            for (const owner of owners.values())
                if (owner.view.agent === agent)
                    releaseClosing(owner.lease);
            for (const [sid, view] of views)
                if (view.agent === agent)
                    views.delete(sid);
            for (const sid of affected)
                releaseSession(sid);
        },
        dispose() {
            disposed = true;
            releaseLifetime();
            numericalChanges();
            for (const sid of numericalCursors.keys())
                releaseNumerical(sid);
            for (const sid of scopePublishers.keys())
                releaseNumerical(sid);
            authorReadMessages.clear();
            for (const owner of owners.values())
                releaseClosing(owner.lease);
            views.clear();
            editReconciliations.clear();
            scopePrefixes.clear();
            displayPrefixes.clear();
            for (const driver of drivers.values())
                driver.dispose();
            drivers.clear();
            sourceOriginals.clear();
            subjectArchives.clear();
            scopeBindings?.dispose();
            journal.dispose();
        },
    };
}
