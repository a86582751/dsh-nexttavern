// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-story-core.ts; edit the TypeScript source.
/** Actual closing-work owner and read-only history for schema story turns.
 * Source descriptors and stored terminal plans never mint this private lease. */
import { recordSha256, sha256, textOf } from './roleplay-data.js';
import { schemaPhaseErrorPolicyForProgramV4 } from './tavern-mvu-schema-program-v4.js';
import { canonicalAssistantForTurn, surfaceEntries } from './roleplay-context.js';
import { openingIntentKey } from './roleplay-opening-selection.js';
import { mvuInitializationEventKey, mvuInitializationHeadKey } from './roleplay-mvu-initialization.js';
import { mvuStateCurrentHeadKey } from './roleplay-mvu-state.js';
import { readInputCompletion } from './roleplay-input-completion.js';
import { inputSnapshotReferenceCurrent } from './roleplay-preparation.js';
import { createRoleplayMvuSchemaJournal, freezeSchemaJournalData, schemaJournalFrontierSha256, schemaEpochExecution, schemaEpochAuthorIdentity, isAuthorHostJournalReadyV5, schemaJournalServerTailSha256, schemaJournalHostFrontierSha256 } from './roleplay-mvu-schema-journal.js';
import { createRoleplayMvuSchemaReplay, schemaExecutionHostFrontierSha256 } from './roleplay-mvu-schema-replay.js';
import { schemaOriginalSnapshot, schemaOriginalCompilationInput, schemaOriginalServerScripts, schemaOriginalProgramSha256, schemaOriginalReplayCompilationInput } from './roleplay-mvu-schema-source.js';
import { schemaTraceRequestedStep } from './roleplay-mvu-schema-executor-types.js';
import { createRoleplayMvuSchemaStory } from './roleplay-mvu-schema-story.js';
import { createRoleplayMvuSchemaPrefixInputs } from './roleplay-mvu-schema-frozen-prefix-input.js';
import { validateMvuSchemaOpeningIntent, validateMvuSchemaOpeningEvent, validateMvuSchemaOpeningHead, verifyMvuSchemaOpeningFacts, mvuSchemaOpeningHead } from './roleplay-mvu-schema-opening-types.js';
import { sealMvuSchemaStoryFact, validateMvuSchemaNumericalSnapshot, validateMvuSchemaStoryEvent, validateMvuSchemaStorySettlement, mvuSchemaStoryHead, mvuSchemaStoryEventKey, mvuSchemaStorySettlementKey, MVU_SCHEMA_STORY_PHASES, isMvuSchemaGenesisHead } from './roleplay-mvu-schema-story-types.js';
import { validateMvuSchemaPlayerEvent, joinMvuSchemaPlayerCompletedEvent, mvuSchemaPlayerEventKey, mvuSchemaPlayerHead, mvuSchemaPlayerOperationKey, mvuSchemaPlayerCompletionKey } from './roleplay-mvu-schema-player-types.js';
import { validateMvuSchemaFrozenPrefix, validateMvuSchemaDerivedBasis, sealMvuSchemaInheritanceFact } from './roleplay-mvu-schema-derived-types.js';
import { buildSchemaScopeReadFrame, schemaScopeSource, schemaScopeInitialChat, schemaScopeConfiguration, schemaScopeOwner, schemaScopePublished, schemaScopeMessageKey, schemaScopeVisibleMessages, schemaScopeReadFactsEqual, schemaScopeEmpty, schemaScopeReowner } from './roleplay-mvu-schema-scope-facts.js';
import { deriveAuthorChatBindingV1, deriveAuthorChatBindingV2 } from './roleplay-author-chat-state.js';
import { produceAuthorPromptScopeFrameV1 } from './roleplay-author-prompt-capture.js';
import { readMvuSchemaInheritedStoryFacts, verifyMvuSchemaInheritedOpeningFacts } from './roleplay-mvu-schema-prefix-facts.js';
import { verifyMvuSchemaUnpublishedTail } from './roleplay-mvu-schema-history-tail.js';
import { acceptedMvuDisplayUpdate, formatMvuDisplayUpdates } from './roleplay-mvu-display-facts.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
const openingPhaseCount = (plan) => plan.schemaVersion === 8 ? plan.phases.length : 1;
function fail(code) { throw Error(code); }
const codeOf = (error) => error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
    ? error.message : 'SCHEMA_STORY_UNPROVEN';
export function createRoleplayMvuSchemaStoryCore(deps) {
    const prefixInputs = createRoleplayMvuSchemaPrefixInputs({ branch: deps.branch, status: deps.status });
    const journal = createRoleplayMvuSchemaJournal({ table: prefixInputs.status, markers: deps.markers,
        recordOwner: deps.inputState.schemaJournal });
    const views = new Map(), owners = new Map(), scopes = new WeakMap();
    const sourceLeases = new Map();
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
    const all = (session) => session.snapshotEvents();
    const currentSession = (session) => !disposed && deps.session(session.id) === session && deps.active(session);
    const frontier = (ready) => ({ nativeCut: ready.steps.at(-1).completionMarker.seq + 1,
        tailSha256: schemaJournalServerTailSha256(ready), frontierSha256: schemaJournalHostFrontierSha256(ready) });
    function snapshot(body) {
        const { stateSnapshotSha256: _prior, ...content } = body;
        return validateMvuSchemaNumericalSnapshot(sealMvuSchemaStoryFact(content, 'stateSnapshotSha256'));
    }
    function scopeOwnerForSeq(facts, seq) {
        const owner = [...facts.owners].reverse().find(range => seq >= range.fromSeq
            && (range.throughSeq === null || seq < range.throughSeq));
        if (!owner)
            fail('SCHEMA_SCOPE_MESSAGE_OWNER_UNPROVEN');
        return owner.sessionId;
    }
    function scopeFactsCurrent(facts) {
        for (const variables of [facts.chat, ...facts.messages.values()])
            if (variables.kind === 'available'
                && variables.provenance.kind === 'published-state') {
                const ref = variables.provenance.state;
                if (recordSha256(prefixInputs.status.get(ref.recordKey)) !== ref.recordSha256)
                    return false;
            }
        return true;
    }
    function scopeFrameAt(facts, original, current, cut, events) {
        if (cut.nativeCut > events.length || cut.sessionId !== current.sessionId
            || cut.sourceSnapshotSha256 !== current.snapshotSha256 || cut.materialSha256 !== current.materialSha256) {
            fail('SCHEMA_SCOPE_CUT_UNPROVEN');
        }
        // Live callers construct this cut from their actual Native snapshot;
        // historical callers consume Journal's proved prefix (or proveCut).
        // Scope projection consumes that same prefix without hashing it again.
        const source = schemaScopeSource(current.snapshot), prefix = events.slice(0, cut.nativeCut);
        const snapshot = schemaOriginalSnapshot(original);
        if (source.importId !== snapshot.source.importId || source.rawSha256 !== snapshot.source.rawSha256
            || source.sourceRecordSessionId !== snapshot.source.sourceRecordSessionId)
            fail('SCHEMA_SCOPE_SOURCE_UNPROVEN');
        return buildSchemaScopeReadFrame(source, recordSha256(cut), schemaOriginalServerScripts(original), facts.chat, schemaScopeVisibleMessages(prefix, deps.projectPrefix, source, seq => scopeOwnerForSeq(facts, seq), facts.messages));
    }
    function scopesForOpening(seed, original, ready, events) {
        if (original.preparation.schemaVersion < 3)
            return undefined;
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
        return { chat: schemaScopeInitialChat(original.preparation, material, ready.steps[0].dispatch.sourceNativeCut), messages,
            owners: [{ sessionId: seed.intent.sessionId, fromSeq: 0, throughSeq: null }],
            updateChat: schemaScopeConfiguration(snapshot, material).updateChat };
    }
    function scopesForDerived(genesis, events) {
        if (genesis.original.preparation.schemaVersion < 3)
            return undefined;
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
                || recordSha256(events.slice(0, genesis.inheritedCut.nativeCut)) !== cached.nativePrefixSha256) {
                fail('SCHEMA_SCOPE_PREFIX_UNPROVEN');
            }
            facts = cached.facts;
        }
        const cut = genesis.inheritedCut.nativeCut;
        // Normal Native input claims extend the child's own log without changing
        // its published state identity. Parent tails cannot extend into that child.
        const ancestors = facts.owners.filter(range => range.fromSeq < cut).map(range => ({ ...range,
            throughSeq: range.throughSeq === null ? cut : Math.min(range.throughSeq, cut) }));
        return { ...facts, messages: new Map(facts.messages), owners: [...ancestors,
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
                || recordSha256(events.slice(0, cut)) !== cached.nativePrefixSha256)
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
        const step = ready.steps[index];
        if (!step)
            fail('SCHEMA_STORY_JOURNAL_UNPROVEN');
        const cut = step.completionMarker.seq + 1;
        if (ready.frozen.sessionId !== sid || ready.frozen.nativeCut !== events.length || cut > events.length) {
            fail('SCHEMA_STORY_JOURNAL_UNPROVEN');
        }
        // The enclosing factual read already verified every journal row against
        // this actual Native prefix. Derive its earlier phase frontier from those
        // immutable steps; re-cloning all frames per phase adds no authority.
        const frontierSha256 = schemaJournalFrontierSha256(ready.epochRef, ready.steps.slice(0, index + 1));
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
    function eventRows(sid, nativeCut, ledger) {
        const rows = [...prefixInputs.status.entries()].filter(([key]) => key.startsWith(`${sid}__mvu-state-schema-story-event-`)
            || key.startsWith(`${sid}__mvu-state-schema-player-event-`))
            .map(([key, row]) => {
            if (!key.startsWith(`${sid}__mvu-state-schema-player-event-`))
                return { key, event: validateMvuSchemaStoryEvent(row) };
            if (!ledger)
                return { key, event: validateMvuSchemaPlayerEvent(row) };
            // The nested InputState ledger read owns these exact Domain rows and
            // their completion join. This synchronous fold consumes its result.
            const playerFacts = ledger.completedByEventKey.get(key);
            if (!playerFacts)
                fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
            return { key, event: playerFacts.event, playerFacts };
        })
            .filter(item => item.event.frontier.nativeCut <= nativeCut)
            .sort((a, b) => a.event.phases[0].association.dispatchMarker.seq - b.event.phases[0].association.dispatchMarker.seq);
        return rows;
    }
    function consume(sid, inheritedEventCount, events, ready, initial, ordinal, frozen = false, scopeSeed, original, readOnlyTail = false, includeDisplay = false, displaySeed, ledger) {
        const inventory = eventRows(sid, events.length, ledger), root = initial.root, consumed = new Map();
        const rows = [], partial = [];
        for (const row of inventory) {
            const event = row.event, closed = event.encoding === 'native-mvu-schema-player-event-v1'
                ? prefixInputs.branch.get(mvuSchemaPlayerCompletionKey(sid, event.plan.operation.operationId)) !== undefined
                : readInputCompletion(prefixInputs.branch, sid, event.plan.scope.currency.preparationId)?.status === 'settled';
            if (readOnlyTail && !closed)
                partial.push(row);
            else {
                if (partial.length)
                    fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
                rows.push(row);
            }
        }
        let state = initial;
        let chat = scopeSeed?.chat;
        const messageStates = scopeSeed ? new Map(scopeSeed.messages) : undefined;
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
                && event.seq >= inheritedEventCount && event.data.sessionId === sid) {
                const operation = prefixInputs.branch.get(mvuSchemaPlayerOperationKey(sid, event.data.operationId));
                if (operation === undefined)
                    fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
                if (frozen && !readOnlyTail) {
                    const row = rows.find(row => row.event.encoding === 'native-mvu-schema-player-event-v1'
                        && row.event.plan.operation.operationId === event.data.operationId);
                    if (!row)
                        fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
                    playerFacts(row);
                }
            }
        for (const row of rows) {
            const { key, event } = row;
            const plan = event.plan, base = 'operation' in plan ? plan.operation.base : plan.base;
            if (original && !deps.source.verifyFrozenFrame(original, plan.currentFrame))
                fail('SCHEMA_HISTORICAL_SOURCE_UNPROVEN');
            const eventKey = event.encoding === 'native-mvu-schema-player-event-v1'
                ? mvuSchemaPlayerEventKey(sid, event.eventId) : mvuSchemaStoryEventKey(sid, event.eventId);
            if (key !== eventKey || !same(base.root, root)
                || !same(base, snapshot({ ...state, sourceSha256: base.sourceSha256 })))
                fail('SCHEMA_STORY_BASE_CHAIN_INVALID');
            let closure;
            if (event.encoding === 'native-mvu-schema-player-event-v1') {
                const facts = playerFacts(row);
                closure = { operation: facts.operation, plan: facts.plan, event, settlement: facts.settlement, completion: facts.completion };
            }
            else if (frozen) {
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
                closure = { terminal: facts.terminal, event, settlement: facts.settlement };
            }
            else {
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
                closure = { terminal, event, settlement };
            }
            for (const phase of event.phases) {
                const actualAssociation = associationAt(sid, events, ready, ordinal), step = ready.steps[ordinal++], association = phase.association;
                if (!step || !same(step.dispatchRef, association.dispatch) || !same(step.completionRef, association.completion)
                    || !same(actualAssociation, association)
                    || !same(step.dispatchMarker, association.dispatchMarker) || !same(step.completionMarker, association.completionMarker)
                    || step.dispatch.batchId !== association.batchId || !same(step.dispatch.sourceNativeCut.anchor, association.anchor)
                    || recordSha256(step.dispatch.sourceNativeCut) !== association.sourceNativeCutSha256
                    || !same(step.step.frame.input, phase.input) || !same(step.step.output, phase.output)
                    // Journal's dispatch parser already joins this exact material to
                    // its cut hash; Source proved the plan frame before the phase loop.
                    || step.dispatch.sourceNativeCut.sourceSnapshotSha256 !== plan.currentFrame.snapshotSha256
                    || step.dispatch.sourceNativeCut.materialSha256 !== plan.currentFrame.materialSha256)
                    fail('SCHEMA_STORY_JOURNAL_UNPROVEN');
                if (step.step.frame.input.schemaVersion === 3 || step.step.frame.input.schemaVersion === 4) {
                    if (!scopeSeed || !chat || !messageStates || !original)
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                    const expected = scopeFrameAt({ ...scopeSeed, chat, messages: messageStates }, original, plan.currentFrame, step.dispatch.sourceNativeCut, events);
                    if (!same(step.step.frame.input.scopeReadFrame, expected))
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                }
            }
            const head = event.encoding === 'native-mvu-schema-player-event-v1' ? mvuSchemaPlayerHead(event) : mvuSchemaStoryHead(event);
            state = snapshot({ schemaVersion: 2, encoding: 'native-mvu-schema-state-snapshot-v2', sessionId: sid,
                sourceSha256: base.sourceSha256, root, currentHead: head, revision: head.revision, headSha256: recordSha256(head),
                values: event.values, valuesSha256: event.valuesSha256, context: event.context, schemaFrontier: event.frontier });
            if (scopeSeed && messageStates && event.outcome !== 'refused') {
                const source = schemaScopeSource(plan.currentFrame.snapshot);
                const manual = event.encoding === 'native-mvu-schema-player-event-v1';
                const stateRef = { kind: manual ? 'manual' : 'story', ownerSessionId: sid,
                    recordKey: key, recordSha256: recordSha256(event), valuesSha256: event.valuesSha256, revision: state.revision };
                if (manual || scopeSeed.updateChat)
                    chat = schemaScopePublished(schemaScopeOwner(source, 'chat'), stateRef, event.values, event.context);
                if (event.encoding === 'native-mvu-schema-story-event-v2') {
                    const canonical = event.plan.canonical;
                    const variables = schemaScopePublished(schemaScopeOwner(source, 'message', canonical.messageId, sid), stateRef, event.values, event.context);
                    messageStates.set(schemaScopeMessageKey(sid, canonical.seq, canonical.messageId, canonical.versionSha256), variables);
                }
            }
            consumed.set(plan.planSha256, recordSha256(closure));
            if (displayUpdates && event.encoding === 'native-mvu-schema-story-event-v2'
                && event.outcome === 'accepted' && event.plan.candidate.kind === 'parsed') {
                const item = acceptedMvuDisplayUpdate(sid, event.plan.canonical, event.plan.candidate.protocol);
                if (item)
                    displayUpdates.push(item);
            }
        }
        if (!readOnlyTail && (ordinal !== ready.steps.length || !same(state.schemaFrontier, frontier(ready)))) {
            fail('SCHEMA_STORY_HISTORY_UNSETTLED');
        }
        if (readOnlyTail && partial.length && ordinal === ready.steps.length)
            fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
        const readScopes = scopeSeed && chat && messageStates ? { ...scopeSeed, chat, messages: messageStates } : undefined;
        return { state, consumed, eventKeys: rows.map(row => row.key), readScopes, ordinal,
            displayUpdates: displayUpdates ? formatMvuDisplayUpdates([...(displaySeed ?? []), ...displayUpdates]) : undefined };
    }
    function readyFor(sid, realmEpoch, events, inherited, historical = false) {
        // Derived recovery already owns inherited DATA. Journal reads the actual
        // local rows and joins both sets to this current/historical Native cut.
        const ready = journal.captureChecked(sid, realmEpoch, events, inherited, historical);
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
    function factual(session, nativeCut = all(session).length, historical = false, includeDisplay = false, captureBasis = false) {
        const sid = session.id, events = all(session).slice(0, nativeCut), sourceSha256 = deps.sourceSha256(sid);
        const ledger = historical ? undefined : deps.captureManualLedger?.(sid);
        const manualBlock = historical ? undefined : ledger ? ledger.code : deps.manualPendingCode?.(sid);
        if (manualBlock && !historical)
            fail(manualBlock);
        let original, initial, seed;
        let scopeSeed;
        let displaySeed;
        let ready, inheritedCut = null, ordinal = 1;
        let inheritedReady;
        if (deps.derivedRequired?.(sid) || session.inheritedEventCount || session.header.parentSession) {
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
            if (!deps.verifyOpening(intent))
                fail('SCHEMA_OPENING_RECORD_INVALID');
            if (historical) {
                // Frozen caller/history selection retains its existing merge, full
                // validation and failure contract; it is not owned current capture.
                ready = readyFor(sid, intent.preparation.realmEpoch, events, null, true);
                original = deps.source.readFrozenOriginal(intent.preparation, ready, events);
            }
            else {
                const captured = deps.source.captureCurrentOriginal(intent.preparation, { sessionId: sid, table: prefixInputs.status, events });
                ready = captured.ready;
                original = captured.original;
            }
            if (original.schemaVersion === 5)
                sourceOriginals.set(original.originalSha256, original);
            seed = { kind: 'opening', intent, event: opening, head };
            ordinal = openingPhaseCount(opening.plan);
            initial = initialForOpening(seed, sourceSha256, original, ready, events);
            scopeSeed = scopesForOpening(seed, original, ready, events);
        }
        const editBasis = { root: initial.root, editFloorSeq: seed.kind === 'opening'
                ? seed.event.native.turnEndSeq + 1 : inheritedCut.nativeCut };
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
        if (edited && edited.kind !== 'clear')
            fail(edited.code);
        const result = consume(sid, session.inheritedEventCount, events, ready, initial, ordinal, historical, scopeSeed, original, false, includeDisplay, displaySeed, ledger);
        let state = result.state;
        const actualHead = prefixInputs.status.get(mvuStateCurrentHeadKey(sid));
        if (!historical && (isMvuSchemaGenesisHead(state.currentHead) ? actualHead !== undefined : !same(actualHead, state.currentHead))) {
            fail('SCHEMA_STORY_HEAD_UNPROVEN');
        }
        state = snapshot({ ...state, sourceSha256 });
        const commandDiagnostics = ready.steps.flatMap(step => {
            const output = step.step.output;
            if (!('schemaVersion' in output) || output.schemaVersion !== 4 || output.kind !== 'accepted'
                || output.errorPolicy !== 'registered-command-policy-v1')
                return [];
            return output.discarded.map(row => ({ source: step.dispatch.sourceNativeCut.anchor.kind === 'opening'
                    ? 'opening' : 'story', nativeSeq: step.completionMarker.seq,
                commandIndex: row.commandIndex, code: row.code, ...'pointer' in row ? { pointer: row.pointer } : {} }));
        });
        const history = { original, ready, snapshot: state, consumed: result.consumed, initial, seed, inheritedCut, eventKeys: result.eventKeys,
            readScopes: result.readScopes,
            displayUpdates: result.displayUpdates, commandDiagnostics, editBasis };
        if (inheritedReady)
            Object.defineProperty(history, 'inheritedReady', { value: inheritedReady });
        return history;
    }
    // Only fork's await compares complete captured histories. Ordinary reads
    // already use InputState's dependencies and do not consume this digest.
    function historyDigest(history) {
        const scopeDigest = history.readScopes ? {
            readScopes: { ...history.readScopes, messages: [...history.readScopes.messages] },
        } : {};
        return recordSha256({ original: history.original, epoch: history.ready.epoch, steps: history.ready.steps,
            frontierSha256: schemaJournalHostFrontierSha256(history.ready), state: history.snapshot,
            consumed: [...history.consumed], ...scopeDigest });
    }
    function recoverForkPrefix(input, events, genesis) {
        try {
            const prefix = validateMvuSchemaFrozenPrefix(input), sid = prefix.sessionId;
            if (events.length !== prefix.journal.nativeCut)
                return undefined;
            let ready, checkedOriginal;
            let initial, ordinal = 1;
            let scopeSeed;
            let displaySeed;
            if (prefix.seed.kind === 'opening') {
                const seed = prefix.seed;
                if (!same(prefixInputs.branch.get(openingIntentKey(sid, seed.intent.source.importId)), seed.intent)
                    || !same(prefixInputs.status.get(mvuInitializationEventKey(sid, seed.event.eventId)), seed.event)
                    || !same(prefixInputs.status.get(mvuInitializationHeadKey(sid)), seed.head)
                    || !verifyMvuSchemaInheritedOpeningFacts({ intent: seed.intent, event: seed.event, head: seed.head, events }, { projectPrefix: deps.projectPrefix }))
                    return undefined;
                const recovered = deps.source.recoverFrozenOriginal(seed.intent.preparation, prefix.journal, events);
                ready = recovered.ready;
                const original = recovered.original;
                checkedOriginal = original;
                if (ready.frozen.sessionId !== sid || ready.frozen.realmEpoch !== prefix.original.realmEpoch)
                    return undefined;
                if (!same(original, prefix.original))
                    return undefined;
                ordinal = openingPhaseCount(seed.event.plan);
                initial = initialForOpening(seed, prefix.sourceSha256, original, ready, events);
                scopeSeed = scopesForOpening(seed, original, ready, events);
            }
            else {
                ready = journal.validateFrozenReady(prefix.journal, events);
                if (ready.frozen.sessionId !== sid || ready.frozen.realmEpoch !== prefix.original.realmEpoch)
                    return undefined;
                if (!genesis || genesis.sessionId !== sid || genesis.basisKey !== prefix.seed.basisKey
                    || genesis.basisSha256 !== prefix.seed.basisSha256 || !same(genesis.original, prefix.original)
                    || genesis.inheritedCut.nativeCut !== prefix.inheritedEventCount)
                    return undefined;
                const prior = genesis.inheritedReady ?? journal.validateFrozenReady(genesis.inheritedCut, events.slice(0, prefix.inheritedEventCount));
                checkedOriginal = derivedOriginal(genesis.original, prior, events.slice(0, prefix.inheritedEventCount));
                ordinal = prior.steps.length;
                initial = snapshot({ ...genesis.snapshot, sourceSha256: prefix.sourceSha256 });
                scopeSeed = scopesForDerived(genesis, events);
                displaySeed = displayForDerived(genesis, events);
            }
            if (!deps.source.originalFactsCurrent(checkedOriginal) || !same(initial, prefix.initial))
                return undefined;
            const result = consume(sid, prefix.inheritedEventCount, events, ready, initial, ordinal, true, scopeSeed, checkedOriginal, false, true, displaySeed);
            const state = snapshot({ ...result.state, sourceSha256: prefix.sourceSha256 });
            if (!same(state, prefix.snapshot) || !same(result.eventKeys, prefix.eventKeys)
                || !same([...result.consumed].map(([planSha256, closureSha256]) => ({ planSha256, closureSha256 })), prefix.consumed))
                return undefined;
            // A completed Native story without its settled numerical result is not a
            // forkable baseline, even when author dispatch has not started yet.
            for (const [key, row] of prefixInputs.branch.entries())
                if (key.startsWith(`${sid}__native-input-v2-work-`)) {
                    const work = row;
                    if (work.source?.kind !== 'story' || work.source.headRef?.kind !== 'schema-head' || !work.checkpoint)
                        continue;
                    const completed = events.find(event => event.type === 'turn/end' && event.data.turn === work.checkpoint.actualTurn
                        && event.data.reason.kind === 'completed');
                    if (!completed || completed.seq < prefix.inheritedEventCount)
                        continue;
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
                displayUpdates: result.displayUpdates ?? [] });
            return ready;
        }
        catch {
            return undefined;
        }
    }
    function verifyForkPrefix(prefix, events, genesis) {
        return recoverForkPrefix(prefix, events, genesis) !== undefined;
    }
    const prefixInputBinding = (prefix) => ({ sessionId: prefix.sessionId,
        inheritedEventCount: prefix.inheritedEventCount, nativeCut: prefix.journal.nativeCut,
        nativePrefixSha256: prefix.journal.nativePrefixSha256, sourceSha256: prefix.sourceSha256,
        prefixSha256: prefix.prefixSha256 });
    function captureFrozenForkPrefix(prefix, events, genesis) {
        const captured = prefixInputs.capture(prefixInputBinding(prefix), () => recoverForkPrefix(prefix, events, genesis));
        if (!captured.result)
            fail('SCHEMA_DERIVED_HISTORY_UNPROVEN');
        return { closure: captured.closure, assertCurrent: captured.assertCurrent, ready: captured.result };
    }
    function recoverFrozenForkPrefix(prefix, events, genesis, closure) {
        try {
            return prefixInputs.verify(closure, prefixInputBinding(prefix), () => recoverForkPrefix(prefix, events, genesis));
        }
        catch {
            return undefined;
        }
    }
    function verifyFrozenForkPrefix(prefix, events, genesis, closure) {
        return recoverFrozenForkPrefix(prefix, events, genesis, closure) !== undefined;
    }
    async function captureForkPrefix(sid, nativeCut) {
        const session = deps.session(sid);
        if (!session || !currentSession(session) || !Number.isSafeInteger(nativeCut) || nativeCut < 1
            || nativeCut > all(session).length)
            fail('SCHEMA_DERIVED_PARENT_UNPROVEN');
        const history = factual(session, nativeCut, true), digest = historyDigest(history);
        const { driver: replay } = await engine(history.ready);
        const verified = await replay.verifyHistorical({ sessionId: sid, realmEpoch: history.original.realmEpoch, nativeCut });
        if (verified.kind !== 'verified')
            fail(verified.code);
        if (!currentSession(session) || historyDigest(factual(session, nativeCut, true)) !== digest) {
            fail('SCHEMA_DERIVED_HISTORY_UNPROVEN');
        }
        const body = { schemaVersion: 1, encoding: 'native-mvu-schema-frozen-prefix-v1', sessionId: sid,
            inheritedEventCount: session.inheritedEventCount, sourceSha256: history.snapshot.sourceSha256,
            original: history.original, seed: history.seed, initial: history.initial, journal: history.ready.frozen,
            eventKeys: history.eventKeys, snapshot: history.snapshot,
            consumed: [...history.consumed].map(([planSha256, closureSha256]) => ({ planSha256, closureSha256 })) };
        const prefix = validateMvuSchemaFrozenPrefix(sealMvuSchemaInheritanceFact(body, 'prefixSha256'));
        const initial = history.seed.kind === 'derived' ? deps.readDerivedGenesis?.(sid) : undefined;
        if (!verifyForkPrefix(prefix, all(session).slice(0, nativeCut), initial)) {
            fail('SCHEMA_DERIVED_HISTORY_UNPROVEN');
        }
        return prefix;
    }
    function readDataCurrent(view) {
        return !disposed && deps.session(view.session.id) === view.session && deps.agent(view.session) === view.agent;
    }
    function viewCurrent(view) { return view.read.current() && readDataCurrent(view); }
    function historicalSourceSha256(sid, ready, ordinal) {
        const first = ready.steps[ordinal];
        if (!first)
            fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
        const matches = [];
        for (const [key, row] of prefixInputs.branch.entries()) {
            if (!key.startsWith(`${sid}__native-input-v2-terminal-`) && !key.startsWith(`${sid}__mvu-schema-player-plan-`))
                continue;
            const plan = (key.startsWith(`${sid}__native-input-v2-terminal-`)
                ? row?.plan?.plan : row);
            if (plan?.realmEpoch !== ready.epoch.realmEpoch || plan.selectors?.[0]?.batchId !== first.dispatch.batchId)
                continue;
            const base = 'operation' in plan ? plan.operation.base : plan.base;
            if (!base || base.sessionId !== sid || !/^[a-f0-9]{64}$/.test(base.sourceSha256))
                fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
            matches.push(base.sourceSha256);
        }
        if (matches.length !== 1)
            fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
        return matches[0];
    }
    function historicalCutData(selector, cacheOriginal = true, session = deps.session(selector.sessionId)) {
        if (!session || !currentSession(session) || !Number.isSafeInteger(selector.nativeCut)
            || selector.nativeCut < 1 || selector.nativeCut > all(session).length)
            fail('SCHEMA_SESSION_INACTIVE');
        // Select the pinned original realm explicitly. A read-only cut must not
        // borrow today's active pointer, current numerical head or later material.
        const prefix = all(session).slice(0, selector.nativeCut);
        const sid = session.id, derivedRequired = deps.derivedRequired?.(sid) || session.inheritedEventCount || session.header.parentSession;
        const derived = derivedRequired ? deps.readDerivedGenesis?.(sid, false) : undefined;
        let original, ready, ordinal = 1, initial;
        let scopeSeed;
        if (derivedRequired) {
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
            const matches = [...prefixInputs.branch.entries()].filter(([key, row]) => key.startsWith(`${sid}__opening-choice-`)
                && row.schemaVersion === 5
                && row.preparation?.realmEpoch === selector.realmEpoch);
            if (matches.length !== 1)
                fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN');
            const intent = validateMvuSchemaOpeningIntent(matches[0][1]);
            if (intent.status !== 'completed' || !intent.initializationReceipt)
                fail('SCHEMA_OPENING_RECORD_INVALID');
            const captured = deps.source.captureCurrentOriginal(intent.preparation, { sessionId: sid, table: prefixInputs.status, events: prefix }, true, cacheOriginal);
            ready = captured.ready;
            original = captured.original;
            if (original.schemaVersion === 5)
                sourceOriginals.set(original.originalSha256, original);
            const opening = validateMvuSchemaOpeningEvent(prefixInputs.status.get(mvuInitializationEventKey(sid, intent.initializationReceipt.eventId)));
            const head = mvuSchemaOpeningHead(opening), seed = { kind: 'opening', intent, event: opening, head };
            if (!verifyMvuSchemaInheritedOpeningFacts({ intent, event: opening, head, events: prefix }, { projectPrefix: deps.projectPrefix }))
                fail('SCHEMA_OPENING_RECORD_INVALID');
            ordinal = openingPhaseCount(opening.plan);
            scopeSeed = scopesForOpening(seed, original, ready, prefix);
            // There is no numerical currency to borrow when no later author phase
            // exists. Otherwise its immutable durable plan supplies that wrapper;
            // the full base and Native work are independently proved below.
            if (ready.steps.length > ordinal)
                initial = initialForOpening(seed, historicalSourceSha256(sid, ready, ordinal), original, ready, prefix);
            else if (eventRows(sid, prefix.length).length)
                fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN');
        }
        if (initial) {
            const folded = consume(sid, session.inheritedEventCount, prefix, ready, initial, ordinal, true, scopeSeed, original, true);
            verifyMvuSchemaUnpublishedTail({ sessionId: sid, inheritedEventCount: session.inheritedEventCount,
                events: prefix, ready, ordinal: folded.ordinal, snapshot: folded.state, original }, {
                branch: prefixInputs.branch, status: prefixInputs.status, projectPrefix: deps.projectPrefix, editProtocol: deps.editProtocol,
                verifyFrozenFrame: deps.source.verifyFrozenFrame, associationAt: index => associationAt(sid, prefix, ready, index),
                scopeFrameAt: (frame, cut) => {
                    if (!folded.readScopes)
                        fail('SCHEMA_SCOPE_HISTORY_UNPROVEN');
                    return scopeFrameAt(folded.readScopes, original, frame, cut, prefix);
                },
            });
        }
        return Object.freeze({ facts: Object.freeze({ authorInput: schemaOriginalReplayCompilationInput(original),
                ...original.schemaVersion === 5 && original.preparation.compilation.schemaVersion === 6
                    ? { compilationResources: deps.source.captureOriginalCompilationResources(original) } : {},
                ready, frozen: ready.frozen, events: all(session) }), originalSha256: original.originalSha256 });
    }
    async function captureHistoricalCut(selector) {
        const session = deps.session(selector.sessionId), { facts } = historicalCutData(selector, true, session);
        // Re-admit protected bytes for every waiter, including a cache hit.
        await protectedFor(facts.ready);
        return { ...facts, events: all(session) };
    }
    async function borrowHistoricalCut(selector, signal) {
        signal?.throwIfAborted();
        const read = deps.inputState.borrowHistorical(selector.sessionId, () => historicalCutData(selector, false));
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
    function rowsCurrent(owner) {
        const sid = owner.view.session.id, boundary = owner.publication, proposed = new Map();
        if (boundary) {
            proposed.set(mvuSchemaStoryEventKey(sid, boundary.event.eventId), boundary.event);
            if (boundary.event.outcome === 'accepted')
                proposed.set(mvuStateCurrentHeadKey(sid), boundary.head);
            proposed.set(mvuSchemaStorySettlementKey(sid, boundary.plan.planSha256), boundary.settlement);
        }
        const actual = new Map([...prefixInputs.status.entries()].filter(([key]) => key.startsWith(`${sid}__mvu-`)
            && !key.startsWith(`${sid}__mvu-schema-epoch-`) && !key.startsWith(`${sid}__mvu-schema-dispatch-`)
            && !key.startsWith(`${sid}__mvu-schema-completion-`) && !key.startsWith(`${sid}__mvu-schema-unavailable-`)));
        for (const [key, hash] of owner.baseline) {
            if (proposed.has(key) && same(actual.get(key), proposed.get(key)))
                continue;
            if (recordSha256(actual.get(key)) !== hash)
                return false;
        }
        for (const [key, row] of actual)
            if (!owner.baseline.has(key) && (!proposed.has(key) || !same(row, proposed.get(key))))
                return false;
        return true;
    }
    function ownerCurrent(owner) {
        const sid = owner.view.session.id, view = deps.closingView(owner.lease, owner.plan.scope);
        if (!view || disposed || owner.abort.signal.aborted || owners.get(sid) !== owner
            || view.agent !== owner.view.agent || view.session !== owner.view.session || !currentSession(owner.view.session)
            || deps.agent(owner.view.session) !== view.agent
            || deps.sourceSha256(sid) !== owner.plan.scope.currency.source.sourceSha256
            || !deps.source.frameCurrent(owner.original, owner.frame) || !rowsCurrent(owner)
            || owner.readScopes && !scopeFactsCurrent(owner.readScopes))
            return false;
        const body = deps.readCanonical(sid, owner.plan.scope.receipt.checkpoint.actualTurn);
        return !!body && same(owner.plan.canonical, { ...body, narrativeSha256: sha256(body.narrative) });
    }
    function checkOwned(scope, boundary) {
        try {
            const owner = scopes.get(scope.owner), session = owner?.view.session;
            if (!owner || !session || !ownerCurrent(owner) || scope.incarnation !== owner.view.agent || scope.session !== session
                || scope.signal.aborted || !owner.scope
                || (scope.requestedStep !== owner.scope.requestedStep && !same(scope.requestedStep, owner.scope.requestedStep)))
                return false;
            const events = all(session), initial = owner.plan.initialCut, cut = scope.sourceNativeCut.nativeCut;
            // Replay proves each new full cut once. This same Native incarnation has
            // an immutable prefix, so later callbacks bind the cut and check its tail.
            if (!same(scope.sourceNativeCut, owner.scope.sourceNativeCut)
                || cut !== initial.nativeCut + 2 * owner.associations.length)
                return false;
            for (const association of owner.associations)
                for (const ref of [association.dispatchMarker, association.completionMarker]) {
                    if (recordSha256(events[ref.seq]) !== ref.sha256)
                        return false;
                }
            for (const [index, ref] of [boundary.dispatchMarker, boundary.completionMarker].entries()) {
                if (ref && (ref.seq !== cut + index || recordSha256(events[ref.seq]) !== ref.sha256))
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
                recordOwner: deps.inputState.schemaJournal,
                markers: deps.markers, captureHistoricalCut, borrowHistoricalCut, flush: deps.flush, captureOwned: selector => {
                    const owner = owners.get(selector.sessionId);
                    if (!owner?.scope || owner.driver !== driver || !owner.inSource || !ownerCurrent(owner)
                        || owner.scope.requestedStep.eventId !== selector.batchId)
                        fail('SCHEMA_OWNER_UNPROVEN');
                    return owner.scope;
                }, checkOwned, withSourceBoundary: (scope, action) => {
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
    /** Called synchronously by Player inside its live Source publication. The
     * callback joins this actual Store/Native read to its existing Replay proof;
     * no posted snapshot or completed terminal alone can publish a view. */
    function adoptPublishedPlayer(sid, accepts) {
        const read = captureSchemaRead(sid);
        if (!accepts(read.data.history.ready))
            fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
        publishSchemaRead(read);
    }
    async function preflight(sid, signal) {
        signal?.throwIfAborted();
        const existing = views.get(sid);
        if (existing && viewCurrent(existing))
            return;
        const read = captureSchemaRead(sid), { history } = read.data;
        const { driver: replay } = await engine(history.ready);
        const verified = await replay.verifyHistorical({ sessionId: sid, realmEpoch: history.original.realmEpoch,
            nativeCut: history.ready.frozen.nativeCut }, signal);
        signal?.throwIfAborted();
        if (verified.kind !== 'verified')
            fail(verified.code);
        // A captured DATA slot becomes readable only after actual historical
        // replay succeeds and all captured dependencies still belong to this owner.
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
    /** The admitted current realm owns one immutable epoch Program. Legal
     * earlier Story cuts in that realm retain this same Program; cross-Source
     * reactivation/old-realm selection is not supplied by this reader. It only
     * consumes the existing preflight view, without replay or a new lease. */
    function readAdmittedBrowserProgram(sid) {
        const view = views.get(sid);
        if (!view || !viewCurrent(view))
            fail('SCHEMA_BROWSER_FACTS_UNPROVEN');
        const ready = view.history.ready;
        if (!isAuthorHostJournalReadyV5(ready))
            return undefined;
        const program = ready.epoch.program.browserProgram;
        if (program?.schemaVersion !== 3)
            return undefined;
        return Object.freeze({ program, epochRef: ready.epochRef });
    }
    function readSchemaObservation(sid) {
        const view = views.get(sid), history = view && viewCurrent(view) ? view.history : undefined;
        return history ? { snapshot: structuredClone(history.snapshot), displayUpdates: history.displayUpdates ?? [],
            ...history.commandDiagnostics.length ? { commandDiagnostics: history.commandDiagnostics } : {} } : undefined;
    }
    /** Read existing completed scope facts for a frozen prompt. This creates no
     * schema execution cut, selector, closing lease, write or Native permission.
     * The caller separately owns Source and the actual in-flight Native step. */
    function captureAuthorOpening(view, frame, events) {
        const identity = view.history.original.preparation.identity, anchor = frame.messages.find(row => row.messageId === identity.messageId), event = anchor ? events[anchor.nativeSeq] : undefined;
        if (event?.type !== 'assistant/message' || event.data.message.id !== identity.messageId)
            fail('PROMPT_PROGRAM_OPENING_ANCHOR_UNAVAILABLE');
        const originalMessageVersionSha256 = recordSha256(event.data.message), candidates = deps.source.readOriginalOpeningCandidates(view.history.original), selected = candidates.findIndex(row => row.index === identity.index);
        const copiedCandidates = selected >= 0 && sha256(textOf(event.data.message.content)) === identity.renderedSha256
            ? { source: 'native-author-copy-opening-candidates-v1',
                swipes: candidates.map(row => row.renderedText), swipe_id: selected } : null;
        return { messageId: identity.messageId, originalMessageVersionSha256, copiedCandidates };
    }
    function capturePromptScopes(sid) {
        const view = views.get(sid), facts = view?.history.readScopes;
        if (!view || !facts || !viewCurrent(view))
            return undefined;
        const events = all(view.session), source = schemaScopeSource(view.frame.snapshot);
        const basis = Object.freeze({ schemaVersion: 1, encoding: 'native-mvu-prompt-scope-read-basis-v1',
            authority: 'consumer-data-only', sessionId: sid, sourceSnapshotSha256: view.frame.snapshotSha256,
            materialSha256: view.frame.materialSha256, numericalSnapshotSha256: view.history.snapshot.stateSnapshotSha256,
            nativeCut: events.length, nativePrefixSha256: recordSha256(events) });
        const frame = buildSchemaScopeReadFrame(source, recordSha256(basis), schemaOriginalServerScripts(view.history.original), facts.chat, schemaScopeVisibleMessages(events, deps.projectPrefix, source, seq => scopeOwnerForSeq(facts, seq), facts.messages));
        const data = Object.freeze({ schemaVersion: 1, encoding: 'native-mvu-prompt-scope-read-data-v1',
            authority: 'consumer-data-only', basis, frame, readDataSha256: recordSha256({ basis, frame }) });
        // A later own pending input or interrupted provider attempt does not change
        // these already captured variable reads. Native's material owner validates
        // their selected message versions and its evolving request cut separately.
        const current = () => viewCurrent(view);
        if (!current())
            return undefined;
        let authorPrompt, authorBrowser;
        const ready = view.history.ready;
        if (isAuthorHostJournalReadyV5(ready) && (ready.epoch.program.schemaVersion === 4 || ready.epoch.program.schemaVersion === 5)) {
            const browser = ready.epoch.program.browserProgram, binding = browser?.schemaVersion === 2 ? deriveAuthorChatBindingV1(sid, browser) : null, authorChat = binding && deps.authorChat ? deps.authorChat.capture(binding) : null, opening = captureAuthorOpening(view, frame, events);
            // The completed schema opening already proves its original Native copy.
            // An edited projected version is excluded by the consumer's version join.
            const program = ready.epoch.program.promptProgram;
            if (program)
                authorPrompt = { program, opening,
                    scopes: produceAuthorPromptScopeFrameV1(frame, program), ...authorChat ? { authorChat } : {} };
            if (browser?.schemaVersion === 2) {
                const context = view.frame.material.openingContext;
                authorBrowser = { program: browser, opening, scopes: produceAuthorPromptScopeFrameV1(frame, browser),
                    basis: { materialSha256: view.frame.materialSha256, numericalSnapshotSha256: view.history.snapshot.stateSnapshotSha256 },
                    numerical: browserNumericalSnapshot(view, events.length),
                    persona: { name: context.user, ...context.user_gender !== undefined ? { gender: context.user_gender } : {}, avatar: null }, authorChat };
            }
        }
        return { data, current, ...authorPrompt ? { authorPrompt } : {}, ...authorBrowser ? { authorBrowser } : {} };
    }
    function browserNumericalSnapshot(view, nativeCut) {
        const snapshot = view.history.snapshot, sid = view.session.id, editBlockCode = (deps.manualEditBlockCode ?? deps.manualPendingCode)?.(sid);
        return { kind: 'schema-ready', values: snapshot.values, expected: { sourceSha256: snapshot.sourceSha256,
                root: snapshot.root, revision: snapshot.revision, headSha256: snapshot.headSha256,
                valuesSha256: snapshot.valuesSha256, stateSnapshotSha256: snapshot.stateSnapshotSha256, observedNativeSeq: nativeCut - 1 },
            canEdit: !editBlockCode, ...editBlockCode ? { editBlockCode } : {} };
    }
    /** The completed history already admitted this exact Host generation.
     * The material owner holds Source/currentness and validates the await. */
    async function executePrompt(sid, program, capture, signal) {
        const view = views.get(sid);
        if (!view)
            fail('AUTHOR_PROMPT_HISTORY_UNAVAILABLE');
        const { runtime } = await engine(view.history.ready);
        if (!('host' in runtime))
            fail('AUTHOR_PROMPT_RUNTIME_UNAVAILABLE');
        return runtime.prompt.execute(program, capture, signal);
    }
    function captureManualBasis(sid) {
        const view = views.get(sid);
        if (!view || !viewCurrent(view))
            fail('SCHEMA_PLAYER_BASE_UNPROVEN');
        const basis = { session: view.session, agent: view.agent, original: view.history.original,
            ready: view.history.ready, base: view.history.snapshot, frame: view.frame, inheritedCut: view.history.inheritedCut,
            scopeReadFrame: (cut) => {
                if (!view.history.readScopes || !scopeFactsCurrent(view.history.readScopes)
                    || !currentSession(view.session) || deps.agent(view.session) !== view.agent
                    || !deps.source.frameCurrent(view.history.original, view.frame))
                    fail('SCHEMA_SCOPE_BASIS_UNPROVEN');
                // The maintenance owner invokes this synchronous reader under its
                // Source lease after verifying its exact numerical row baseline.
                return scopeFrameAt(view.history.readScopes, view.history.original, view.frame, cut, all(view.session));
            } };
        if (view.history.inheritedReady)
            Object.defineProperty(basis, 'inheritedReady', { value: view.history.inheritedReady });
        return basis;
    }
    async function captureBrowserFacts(sid) {
        await preflight(sid);
        const view = views.get(sid);
        if (!view || !viewCurrent(view))
            fail('SCHEMA_BROWSER_FACTS_UNPROVEN');
        const ready = view.history.ready;
        if (!isAuthorHostJournalReadyV5(ready) || !ready.epoch.program.browserProgram)
            return undefined;
        const program = ready.epoch.program.browserProgram, { runtime } = await engine(ready);
        if (!('host' in runtime) || !viewCurrent(view))
            fail('SCHEMA_BROWSER_FACTS_CHANGED');
        const facts = view.history.readScopes;
        if (!facts || !view.agent)
            fail('SCHEMA_BROWSER_FACTS_UNPROVEN');
        const session = view.session, agent = view.agent, original = view.history.original, frame = view.frame;
        const stopSha256 = recordSha256(agent.lookupInputStop()), events = all(session), snapshot = view.history.snapshot;
        const source = schemaScopeSource(frame.snapshot);
        const basis = { sessionId: sid, sourceSnapshotSha256: frame.snapshotSha256, materialSha256: frame.materialSha256,
            numericalSnapshotSha256: snapshot.stateSnapshotSha256, nativeCut: events.length, nativePrefixSha256: recordSha256(events) };
        // Project the selected complete Native prefix once for both Browser text
        // and scope messages. Reader pagination and maintenance prose do not enter.
        const projected = deps.projectPrefix(events);
        const selected = { id: sid, events, surface: { nodes: projected.nodes },
            deriveEventMessage: (entry) => projected.projectedMessageAt(entry.seq) };
        const messages = [];
        const scoped = surfaceEntries(selected).map((entry, position) => {
            const event = events[entry.seq];
            const raw = event?.type === 'assistant/message' ? event.data.message : event?.type === 'user/message' ? event.data : undefined;
            const message = projected.projectedMessageAt(entry.seq) ?? raw, ownerSessionId = scopeOwnerForSeq(facts, entry.seq);
            if (!message || message.id !== entry.messageId)
                fail('SCHEMA_SCOPE_MESSAGE_UNPROVEN');
            const messageVersionSha256 = recordSha256(message), owner = schemaScopeOwner(source, 'message', entry.messageId, ownerSessionId);
            const key = schemaScopeMessageKey(ownerSessionId, entry.seq, entry.messageId, messageVersionSha256);
            const variables = schemaScopeReowner(facts.messages.get(key) ?? schemaScopeEmpty(owner), owner);
            const identity = { position, ownerSessionId, nativeSeq: entry.seq, messageId: entry.messageId, messageVersionSha256,
                selectedVariant: messageVersionSha256 };
            messages.push({ ...identity, role: entry.kind, text: textOf(message.content) });
            return { ...identity, isSystem: false, variables };
        });
        const scopeFrame = buildSchemaScopeReadFrame(source, recordSha256(basis), program.scripts.map(row => row.descriptor), facts.chat, scoped);
        const data = { schemaVersion: 1, encoding: 'native-author-browser-snapshot-v1',
            basis, scopeFrame, messages, numerical: browserNumericalSnapshot(view, events.length) };
        // Attachment stability outlives this DATA's numerical/Native cut. Each
        // subsequent capture refreshes the view; writes keep their actual owner.
        const ownerCurrent = () => {
            try {
                runtime.host.checkCurrent();
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
        if (program.schemaVersion === 1)
            return { program, artifact: runtime.browser.artifact,
                data, current };
        const opening = captureAuthorOpening(view, scopeFrame, events);
        // Match the generation capture's opening-zero author history. Native
        // import dialogue remains in its own scope frame, outside this projection.
        const start = messages.findIndex(message => message.messageId === opening.messageId);
        const capturedMessages = messages.slice(start).map((message, index) => ({ index,
            messageId: message.messageId, ownerSessionId: message.ownerSessionId, nativeSeq: message.nativeSeq,
            messageVersionSha256: message.messageVersionSha256, role: message.role, message: message.text,
            variables: scoped[start + index].variables,
            variants: message.messageId === opening.messageId && message.messageVersionSha256 === opening.originalMessageVersionSha256
                ? opening.copiedCandidates : null }));
        const context = frame.material.openingContext;
        // This is the currently selected import's decoded Native DATA, already
        // captured in the Source frame. An unrelated author table row cannot
        // become getContext().characters[characterId] by lexical sort order.
        const card = frame.material.card, native = card.data;
        const character = { sourceId: frame.snapshot.source.importId,
            name: String(native.name), ...typeof native.avatar === 'string' ? { avatar: native.avatar } : {} };
        if (program.schemaVersion === 3) {
            const owned = program.declarations.map(declaration => {
                if (!deps.authorChat)
                    fail('AUTHOR_CHAT_STATE_UNAVAILABLE');
                return { declarationId: declaration.declarationId,
                    capture: deps.authorChat.captureWithCurrencyV2(deriveAuthorChatBindingV2(sid, program, declaration)) };
            });
            const dataV3 = { ...data,
                schemaVersion: 3, encoding: 'native-author-browser-snapshot-v3', messages: capturedMessages,
                persona: { name: context.user, ...context.user_gender !== undefined ? { gender: context.user_gender } : {}, avatar: null }, character,
                authorChats: owned.map(row => ({ declarationId: row.declarationId, capture: row.capture.data })) };
            return { program, artifact: runtime.browser.artifact, data: dataV3,
                sourceCurrent: () => ownerCurrent() && deps.source.frameIdentityCurrent(frame),
                current: () => current() && owned.every(row => row.capture.current()),
                ...(program.requiredCapabilities.includes('owned-script-source-resources')
                    ? { resources: deps.source.captureScriptResources(frame) } : {}) };
        }
        const authorBinding = deriveAuthorChatBindingV1(sid, program);
        const dataV2 = { ...data,
            schemaVersion: 2, encoding: 'native-author-browser-snapshot-v2', messages: capturedMessages,
            persona: { name: context.user, ...context.user_gender !== undefined ? { gender: context.user_gender } : {}, avatar: null },
            authorChat: authorBinding && deps.authorChat ? deps.authorChat.capture(authorBinding) : null, character };
        return { program, artifact: runtime.browser.artifact, data: dataV2, current,
            ...(program.requiredCapabilities.includes('owned-script-source-resources')
                ? { resources: deps.source.captureScriptResources(frame) } : {}) };
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
            if (deps.derivedRequired?.(sid)) {
                const genesis = deps.readDerivedGenesis?.(sid, false);
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
    const transaction = createRoleplayMvuSchemaStory({ table: prefixInputs.status,
        readReady: (_scope, plan) => {
            const owner = owners.get(plan.base.sessionId);
            return owner && same(owner.plan, plan)
                ? { kind: 'ready', snapshot: owner.base } : { kind: 'blocked', code: 'SCHEMA_STORY_BASE_CHANGED' };
        }, closingCurrent: (closing, scope, plan) => {
            const owner = ownerFor(closing, plan);
            return !!owner && same(scope, plan.scope) && ownerCurrent(owner);
        }, executePhase: async (plan, phase, input, closing) => {
            const owner = ownerFor(closing, plan);
            if (!owner)
                return { kind: 'blocked', code: 'SCHEMA_STORY_PERMISSION_REVOKED' };
            return withLease(owner, async () => {
                const index = MVU_SCHEMA_STORY_PHASES.indexOf(phase), selector = plan.selectors[index];
                if (index !== owner.associations.length)
                    fail('SCHEMA_STORY_PHASE_ORDER');
                const session = owner.view.session, events = all(session), cut = { ...plan.initialCut,
                    nativeCut: events.length, nativePrefixSha256: recordSha256(events), anchor: selector.anchor };
                const captureJournal = () => owner.inheritedReady
                    ? journal.captureChecked(session.id, plan.realmEpoch, all(session), owner.inheritedReady)
                    : journal.capture(session.id, plan.realmEpoch, all(session), owner.inheritedCut);
                const ready = captureJournal();
                if (ready.kind !== 'ready')
                    fail(ready.code);
                let capturedInput = input;
                if (input.schemaVersion === 3 || input.schemaVersion === 4) {
                    if ((plan.schemaVersion !== 4 && plan.schemaVersion !== 5 && plan.schemaVersion !== 6) || input.schemaVersion !== plan.executorVersion
                        || !owner.readScopes || !schemaScopeReadFactsEqual(input.scopeReadFrame, plan.scopeReadFrame)) {
                        fail('SCHEMA_SCOPE_BASIS_UNPROVEN');
                    }
                    const expected = scopeFrameAt(owner.readScopes, owner.original, owner.frame, cut, events);
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
                    sourceNativeCut: freezeSchemaJournalData(cut), requestedStep, journalCut: ready, compiledProgram: owner.compiledProgram,
                    ...owner.original.schemaVersion === 5 && owner.original.preparation.compilation.schemaVersion === 6 && !owner.compiledProgram
                        ? { compilationResources: deps.source.captureOriginalCompilationResources(owner.original) } : {} };
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
                    if (input.schemaVersion === 3 || input.schemaVersion === 4)
                        result.capturedInput = capturedInput;
                    owner.lastLive = result;
                    owner.associations.push(result.association);
                }
                return result;
            });
        }, withPublicationBoundary: async (closing, lastLive, action) => {
            const owner = [...owners.values()].find(value => value.lease === closing && value.lastLive === lastLive);
            if (!owner)
                fail('SCHEMA_OWNER_UNPROVEN');
            return withLease(owner, action);
        }, checkPublication: (closing, lastLive, boundary) => {
            const owner = ownerFor(closing, boundary.plan);
            if (!owner || owner.lastLive !== lastLive || !owner.inSource || sourceLeases.get(owner.view.session.id) !== owner)
                return false;
            owner.publication = boundary;
            if (!ownerCurrent(owner) || !same(boundary.event.phases.map(phase => phase.association), owner.associations))
                return false;
            const ready = owner.inheritedReady
                ? journal.captureChecked(owner.view.session.id, boundary.plan.realmEpoch, all(owner.view.session), owner.inheritedReady)
                : journal.capture(owner.view.session.id, boundary.plan.realmEpoch, all(owner.view.session), owner.inheritedCut);
            if (ready.kind !== 'ready' || !same(frontier(ready), boundary.event.frontier))
                return false;
            for (const [index, phase] of boundary.event.phases.entries()) {
                const step = ready.steps.at(index - boundary.event.phases.length);
                if (!step || !same(step.step.output, phase.output) || !same(step.step.frame.input, phase.input)
                    || !same(step.dispatchRef, phase.association.dispatch) || !same(step.completionRef, phase.association.completion))
                    return false;
            }
            // Only the final token still represents the current frontier. Earlier
            // tokens are intentionally stale and are covered by the full pinned chain.
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
            const events = all(session), initialCut = { schemaVersion: 1, sessionId: sid, ownerSessionId: sid,
                nativeCut: events.length, nativePrefixSha256: recordSha256(events), sourceSnapshotSha256: frame.snapshotSha256,
                materialSha256: frame.materialSha256, stopGeneration: scope.stopGeneration, anchor: selectorsAnchor };
            const scopeReadFrame = history.ready.epoch.schemaVersion >= 3 && history.readScopes
                ? scopeFrameAt(history.readScopes, history.original, frame, initialCut, events) : undefined;
            const ready = history.ready, executorVersion = isAuthorHostJournalReadyV5(ready) ? 4 : ready.epoch.schemaVersion;
            const plan = transaction.makePlan(scope, canonical, base, frame, history.original.realmEpoch, schemaOriginalProgramSha256(history.original), initialCut, events[scope.receipt.turnEndSeq].time, executorVersion, scopeReadFrame, isAuthorHostJournalReadyV5(ready) ? { epoch: ready.epochRef,
                serverProgramSha256: ready.epoch.program.serverProgram.programSha256,
                ...(schemaPhaseErrorPolicyForProgramV4(ready.epoch.program.serverProgram) === 'registered-command-policy-v1'
                    ? { errorPolicy: 'registered-command-policy-v1' } : {}) } : undefined);
            if (owners.has(sid))
                fail('SCHEMA_STORY_OWNER_EXISTS');
            const baseline = new Map([...prefixInputs.status.entries()].filter(([key]) => key.startsWith(`${sid}__mvu-`)
                && !key.startsWith(`${sid}__mvu-schema-`)).map(([key, value]) => [key, recordSha256(value)]));
            return { history, frame, base, plan, baseline, events };
        });
        try {
            const { history, frame, base, plan, baseline, events } = basis.data;
            const { driver } = await engine(history.ready);
            const currentEvents = all(session);
            // Native snapshots contain deeply frozen events and only grow by append.
            // The same cut and tail retain this prefix; edits append a new event.
            // Domain/Source changes are checked by the captured dependencies, so an
            // await boundary does not need to fold and hash all historical facts again.
            if (!view.current() || !basis.current() || currentEvents.length !== events.length
                || currentEvents.at(-1) !== events.at(-1))
                fail('SCHEMA_STORY_BASIS_CHANGED');
            if (owners.has(sid))
                fail('SCHEMA_STORY_OWNER_EXISTS');
            const owner = { lease: closing, view, original: history.original, frame, base, plan, driver,
                readScopes: history.readScopes, inheritedCut: history.inheritedCut, inheritedReady: history.inheritedReady,
                abort: new AbortController(),
                token: Object.freeze({}), inSource: false, baseline, associations: [] };
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
    return { preflight, adoptPublishedPlayer, observation, readSnapshot, readAdmittedBrowserProgram, readSchemaObservation, capturePromptScopes, executePrompt, captureBrowserFacts,
        readEditBasis, captureManualBasis, captureHistoricalCut, borrowHistoricalCut,
        captureForkPrefix, recoverForkPrefix, verifyForkPrefix, captureFrozenForkPrefix, recoverFrozenForkPrefix, verifyFrozenForkPrefix,
        prepareCompletion, releaseClosing, verifyConsumed,
        publishCompletion: (scope, plan, closing) => closing
            ? transaction.publish(scope, plan, closing) : Promise.resolve({ kind: 'blocked', code: 'SCHEMA_OWNER_UNPROVEN' }),
        verifySettlement: transaction.verifySettlement,
        invalidateSession(sid) {
            const owner = owners.get(sid);
            if (owner)
                releaseClosing(owner.lease);
            views.delete(sid);
            deps.inputState.invalidateSession(sid);
            clearDisplayPrefixes(sid);
        },
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
            for (const sid of affected) {
                deps.inputState.invalidateSession(sid);
                clearDisplayPrefixes(sid);
            }
        },
        dispose() {
            disposed = true;
            for (const owner of owners.values())
                releaseClosing(owner.lease);
            views.clear();
            scopePrefixes.clear();
            displayPrefixes.clear();
            for (const driver of drivers.values())
                driver.dispose();
            drivers.clear();
            sourceOriginals.clear();
        },
    };
}
