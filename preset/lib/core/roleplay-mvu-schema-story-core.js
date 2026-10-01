// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-story-core.ts; edit the TypeScript source.
/** Actual closing-work owner and read-only history for schema story turns.
 * Source descriptors and stored terminal plans never mint this private lease. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { openingIntentKey } from './roleplay-opening-selection.js';
import { mvuInitializationEventKey, mvuInitializationHeadKey } from './roleplay-mvu-initialization.js';
import { mvuStateCurrentHeadKey } from './roleplay-mvu-state.js';
import { readInputCompletion } from './roleplay-input-completion.js';
import { inputSnapshotReferenceCurrent } from './roleplay-preparation.js';
import { createRoleplayMvuSchemaJournal } from './roleplay-mvu-schema-journal.js';
import { createRoleplayMvuSchemaReplay } from './roleplay-mvu-schema-replay.js';
import { createRoleplayMvuSchemaStory } from './roleplay-mvu-schema-story.js';
import { validateMvuSchemaOpeningIntent, validateMvuSchemaOpeningEvent, validateMvuSchemaOpeningHead, verifyMvuSchemaOpeningFacts } from './roleplay-mvu-schema-opening-types.js';
import { sealMvuSchemaStoryFact, validateMvuSchemaNumericalSnapshot, validateMvuSchemaStoryEvent, validateMvuSchemaStorySettlement, mvuSchemaStoryHead, mvuSchemaStoryEventKey, mvuSchemaStorySettlementKey, MVU_SCHEMA_STORY_PHASES } from './roleplay-mvu-schema-story-types.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
function fail(code) { throw Error(code); }
const codeOf = (error) => error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
    ? error.message : 'SCHEMA_STORY_UNPROVEN';
export function createRoleplayMvuSchemaStoryCore(deps) {
    const journal = createRoleplayMvuSchemaJournal({ table: deps.status, markers: deps.markers });
    const views = new Map(), owners = new Map(), scopes = new WeakMap();
    const sourceLeases = new Map();
    let disposed = false, driver;
    const all = (session) => session.snapshotEvents();
    const currentSession = (session) => !disposed && deps.session(session.id) === session && deps.active(session);
    const frontier = (ready) => ({ nativeCut: ready.steps.at(-1).completionMarker.seq + 1,
        tailSha256: ready.tailSha256, frontierSha256: ready.frontierSha256 });
    function snapshot(body) {
        const { stateSnapshotSha256: _prior, ...content } = body;
        return validateMvuSchemaNumericalSnapshot(sealMvuSchemaStoryFact(content, 'stateSnapshotSha256'));
    }
    function associationAt(session, ready, index) {
        const step = ready.steps[index];
        if (!step)
            fail('SCHEMA_STORY_JOURNAL_UNPROVEN');
        const cut = step.completionMarker.seq + 1;
        const selected = journal.captureFrozen(session.id, ready.epoch.realmEpoch, all(session).slice(0, cut), ready.frozen.records);
        if (selected.kind !== 'ready')
            fail(selected.code);
        return { schemaVersion: 1, encoding: 'native-mvu-schema-execution-association-v1', sessionId: session.id,
            realmEpoch: ready.epoch.realmEpoch, batchId: step.dispatch.batchId, anchor: step.dispatch.sourceNativeCut.anchor,
            sourceNativeCutSha256: recordSha256(step.dispatch.sourceNativeCut), programSha256: ready.epoch.program.programSha256,
            dispatch: step.dispatchRef, completion: step.completionRef, dispatchMarker: step.dispatchMarker,
            completionMarker: step.completionMarker, tailSha256: step.step.stepSha256, frontierSha256: selected.frontierSha256,
            outputSha256: recordSha256(step.step.output) };
    }
    function factual(session, nativeCut = all(session).length) {
        const sid = session.id, pointer = deps.activePointer(sid);
        if (!pointer?.importId || session.inheritedEventCount || session.header.parentSession)
            fail('SCHEMA_STORY_ROOT_REQUIRED');
        const intent = validateMvuSchemaOpeningIntent(deps.branch.get(openingIntentKey(sid, pointer.importId)));
        if (intent.status !== 'completed' || !intent.initialization)
            fail('SCHEMA_OPENING_NOT_COMPLETED');
        const storedOpeningHead = deps.status.get(mvuInitializationHeadKey(sid));
        if (storedOpeningHead === undefined)
            fail('HEAD_MISSING');
        const openingHead = validateMvuSchemaOpeningHead(storedOpeningHead);
        const opening = validateMvuSchemaOpeningEvent(deps.status.get(mvuInitializationEventKey(sid, openingHead.eventId)));
        if (!verifyMvuSchemaOpeningFacts(intent, opening, openingHead) || !deps.verifyOpening(intent))
            fail('SCHEMA_OPENING_RECORD_INVALID');
        const events = all(session).slice(0, nativeCut), ready = journal.capture(sid, intent.preparation.realmEpoch, events);
        if (ready.kind !== 'ready')
            fail(ready.code);
        const original = deps.source.readFrozenOriginal(intent.preparation, ready, events), first = ready.steps[0];
        if (first.step.output.kind !== 'accepted' || !same(first.step.output.values, opening.plan.values)
            || !same(associationAt(session, ready, 0), opening.plan.execution))
            fail('SCHEMA_OPENING_JOURNAL_UNPROVEN');
        const root = { openingEventId: opening.eventId, openingEventSha256: opening.eventSha256,
            openingHeadSha256: recordSha256(openingHead), openingPlanSha256: opening.plan.planSha256,
            realmEpoch: original.realmEpoch, programSha256: original.programSha256 };
        let state = snapshot({ schemaVersion: 2, encoding: 'native-mvu-schema-state-snapshot-v2', sessionId: sid,
            sourceSha256: deps.sourceSha256(sid), root, currentHead: openingHead, revision: 1, headSha256: recordSha256(openingHead),
            values: opening.plan.values, valuesSha256: opening.valuesSha256, context: first.step.output.context,
            schemaFrontier: { nativeCut: first.completionMarker.seq + 1, tailSha256: first.step.stepSha256,
                frontierSha256: opening.plan.execution.frontierSha256 } });
        const rows = [...deps.status.entries()].filter(([key]) => key.startsWith(`${sid}__mvu-state-schema-story-event-`))
            .map(([key, row]) => ({ key, event: validateMvuSchemaStoryEvent(row) }))
            .filter(item => item.event.frontier.nativeCut <= nativeCut)
            .sort((a, b) => a.event.phases[0].association.dispatchMarker.seq - b.event.phases[0].association.dispatchMarker.seq);
        const consumed = new Map();
        let ordinal = 1;
        for (const { key, event } of rows) {
            const plan = event.plan, scope = plan.scope;
            if (key !== mvuSchemaStoryEventKey(sid, event.eventId) || !same(plan.base.root, root)
                || !same(plan.base, snapshot({ ...state, sourceSha256: plan.base.sourceSha256 })))
                fail('SCHEMA_STORY_BASE_CHAIN_INVALID');
            const terminal = readInputCompletion(deps.branch, sid, scope.currency.preparationId);
            const settlement = validateMvuSchemaStorySettlement(deps.status.get(mvuSchemaStorySettlementKey(sid, plan.planSha256)), event);
            if (!terminal || terminal.status !== 'settled' || terminal.plan.kind !== 'schema-numerical'
                || !same(terminal.scope, scope) || !same(terminal.plan.plan, plan) || !same(terminal.settlement, settlement)
                || !deps.verifyConsumedScope(scope) || !deps.verifyNative(scope)
                || !inputSnapshotReferenceCurrent(deps.branch, sid, scope.currency))
                fail('SCHEMA_STORY_TERMINAL_UNRESOLVED');
            const canonical = deps.readConsumedCanonical(sid, plan.canonical.seq, scope.receipt.checkpoint.actualTurn, scope.receipt.turnEndSeq);
            if (!canonical || !same(plan.canonical, { ...canonical, narrativeSha256: sha256(canonical.narrative) }))
                fail('SCHEMA_STORY_CANONICAL_UNPROVEN');
            for (const phase of event.phases) {
                const actualAssociation = associationAt(session, ready, ordinal), step = ready.steps[ordinal++], association = phase.association;
                if (!step || !same(step.dispatchRef, association.dispatch) || !same(step.completionRef, association.completion)
                    || !same(actualAssociation, association)
                    || !same(step.dispatchMarker, association.dispatchMarker) || !same(step.completionMarker, association.completionMarker)
                    || step.dispatch.batchId !== association.batchId || !same(step.dispatch.sourceNativeCut.anchor, association.anchor)
                    || recordSha256(step.dispatch.sourceNativeCut) !== association.sourceNativeCutSha256
                    || !same(step.step.frame.input, phase.input) || !same(step.step.output, phase.output)
                    || !same(step.step.frame.material, plan.currentFrame.material)
                    || step.dispatch.sourceNativeCut.sourceSnapshotSha256 !== plan.currentFrame.snapshotSha256
                    || step.dispatch.sourceNativeCut.materialSha256 !== plan.currentFrame.materialSha256)
                    fail('SCHEMA_STORY_JOURNAL_UNPROVEN');
            }
            const head = mvuSchemaStoryHead(event);
            state = snapshot({ schemaVersion: 2, encoding: 'native-mvu-schema-state-snapshot-v2', sessionId: sid,
                sourceSha256: plan.base.sourceSha256, root, currentHead: head, revision: head.revision, headSha256: recordSha256(head),
                values: event.values, valuesSha256: event.valuesSha256, context: event.context, schemaFrontier: event.frontier });
            consumed.set(plan.planSha256, recordSha256({ terminal, event, settlement }));
        }
        if (ordinal !== ready.steps.length || !same(state.schemaFrontier, frontier(ready)))
            fail('SCHEMA_STORY_HISTORY_UNSETTLED');
        const actualHead = deps.status.get(mvuStateCurrentHeadKey(sid));
        if (state.currentHead.encoding === 'mvu-schema-opening-head-v2' ? actualHead !== undefined : !same(actualHead, state.currentHead)) {
            fail('SCHEMA_STORY_HEAD_UNPROVEN');
        }
        state = snapshot({ ...state, sourceSha256: deps.sourceSha256(sid) });
        return { original, ready, snapshot: state, consumed, digest: recordSha256({ original, epoch: ready.epoch,
                steps: ready.steps, frontierSha256: ready.frontierSha256, state, consumed: [...consumed] }) };
    }
    function viewCurrent(view) {
        try {
            if (!currentSession(view.session) || deps.agent(view.session) !== view.agent
                || !deps.source.frameCurrent(view.history.original, view.frame))
                return false;
            return factual(view.session).digest === view.history.digest;
        }
        catch {
            return false;
        }
    }
    async function captureHistoricalCut(selector) {
        const session = deps.session(selector.sessionId);
        if (!session || !currentSession(session))
            fail('SCHEMA_SESSION_INACTIVE');
        // Select the pinned original realm explicitly. A read-only cut must not
        // borrow today's active pointer, current numerical head or later material.
        const matches = [...deps.branch.entries()].filter(([key, row]) => key.startsWith(`${session.id}__opening-choice-`)
            && row.schemaVersion === 5
            && row.preparation?.realmEpoch === selector.realmEpoch);
        if (matches.length !== 1)
            fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN');
        const intent = validateMvuSchemaOpeningIntent(matches[0][1]);
        if (intent.status !== 'completed' || !deps.verifyOpening(intent))
            fail('SCHEMA_OPENING_RECORD_INVALID');
        const prefix = all(session).slice(0, selector.nativeCut);
        const ready = journal.captureFrozen(session.id, selector.realmEpoch, prefix, journal.inventory(session.id));
        if (ready.kind !== 'ready')
            fail(ready.code);
        const original = deps.source.readFrozenOriginal(intent.preparation, ready, prefix);
        // Re-admit protected bytes for every waiter, including a cache hit.
        await deps.protectedRuntime();
        return { authorInput: original.authorInput, frozen: ready.frozen, events: all(session) };
    }
    function rowsCurrent(owner) {
        const sid = owner.view.session.id, boundary = owner.publication, proposed = new Map();
        if (boundary) {
            proposed.set(mvuSchemaStoryEventKey(sid, boundary.event.eventId), boundary.event);
            if (boundary.event.outcome === 'accepted')
                proposed.set(mvuStateCurrentHeadKey(sid), boundary.head);
            proposed.set(mvuSchemaStorySettlementKey(sid, boundary.plan.planSha256), boundary.settlement);
        }
        const actual = new Map([...deps.status.entries()].filter(([key]) => key.startsWith(`${sid}__mvu-`)
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
        if (!view || !view.current() || disposed || owner.abort.signal.aborted || owners.get(sid) !== owner
            || view.agent !== owner.view.agent || view.session !== owner.view.session || !currentSession(owner.view.session)
            || deps.agent(owner.view.session) !== view.agent
            || deps.sourceSha256(sid) !== owner.plan.scope.currency.source.sourceSha256
            || !deps.source.frameCurrent(owner.original, owner.frame) || !rowsCurrent(owner))
            return false;
        const body = deps.readCanonical(sid, owner.plan.scope.receipt.checkpoint.actualTurn);
        return !!body && same(owner.plan.canonical, { ...body, narrativeSha256: sha256(body.narrative) });
    }
    function checkOwned(scope, boundary) {
        try {
            const owner = scopes.get(scope.owner), session = owner?.view.session;
            if (!owner || !session || !ownerCurrent(owner) || scope.incarnation !== owner.view.agent || scope.session !== session
                || scope.signal.aborted || !owner.scope || !same(scope.requestedStep, owner.scope.requestedStep))
                return false;
            const events = all(session), initial = owner.plan.initialCut, cut = scope.sourceNativeCut.nativeCut;
            if (recordSha256(events.slice(0, initial.nativeCut)) !== initial.nativePrefixSha256
                || cut !== initial.nativeCut + 2 * owner.associations.length
                || recordSha256(events.slice(0, cut)) !== scope.sourceNativeCut.nativePrefixSha256)
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
    async function engine() {
        const runtime = await deps.protectedRuntime();
        if (disposed)
            fail('SCHEMA_RUNTIME_DISPOSED');
        driver ??= createRoleplayMvuSchemaReplay({ table: deps.status, compiler: runtime.compiler, runner: runtime.runner,
            markers: deps.markers, captureHistoricalCut, flush: deps.flush, captureOwned: selector => {
                const owner = owners.get(selector.sessionId);
                if (!owner?.scope || !owner.inSource || !ownerCurrent(owner)
                    || owner.scope.requestedStep.eventId !== selector.batchId)
                    fail('SCHEMA_OWNER_UNPROVEN');
                return owner.scope;
            }, checkOwned, withSourceBoundary: (scope, action) => {
                const owner = scopes.get(scope.owner);
                if (!owner)
                    fail('SCHEMA_OWNER_UNPROVEN');
                return withLease(owner, action);
            } });
        return { runtime, driver };
    }
    async function preflight(sid, signal) {
        signal?.throwIfAborted();
        const session = deps.session(sid);
        if (!session || !currentSession(session))
            fail('SCHEMA_SESSION_INACTIVE');
        const agent = deps.agent(session), history = factual(session), frame = deps.source.captureFrame(history.original);
        const { driver: replay } = await engine();
        const verified = await replay.verifyHistorical({ sessionId: sid, realmEpoch: history.original.realmEpoch,
            nativeCut: history.ready.frozen.nativeCut }, signal);
        signal?.throwIfAborted();
        if (verified.kind !== 'verified')
            fail(verified.code);
        const view = { session, agent, history, frame };
        if (!viewCurrent(view))
            fail('SCHEMA_HISTORICAL_FACTS_CHANGED');
        views.set(sid, view);
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
    function ownerFor(closing, plan) {
        const owner = owners.get(plan.base.sessionId);
        return owner && owner.lease === closing && same(owner.plan, plan) ? owner : undefined;
    }
    const transaction = createRoleplayMvuSchemaStory({ table: deps.status,
        readReady: (_scope, plan) => {
            const owner = owners.get(plan.base.sessionId);
            return owner && same(owner.plan, plan) && ownerCurrent(owner)
                ? { kind: 'ready', snapshot: owner.base } : { kind: 'blocked', code: 'SCHEMA_STORY_BASE_CHANGED' };
        }, closingCurrent: (closing, scope, plan) => {
            const owner = ownerFor(closing, plan);
            return !!owner && same(scope, plan.scope) && ownerCurrent(owner);
        }, executePhase: async (plan, phase, input, closing) => {
            const owner = ownerFor(closing, plan);
            if (!owner || !ownerCurrent(owner))
                return { kind: 'blocked', code: 'SCHEMA_STORY_PERMISSION_REVOKED' };
            return withLease(owner, async () => {
                const index = MVU_SCHEMA_STORY_PHASES.indexOf(phase), selector = plan.selectors[index];
                if (index !== owner.associations.length)
                    fail('SCHEMA_STORY_PHASE_ORDER');
                const session = owner.view.session, events = all(session), cut = { ...plan.initialCut,
                    nativeCut: events.length, nativePrefixSha256: recordSha256(events), anchor: selector.anchor };
                const ready = journal.capture(session.id, plan.realmEpoch, events);
                if (ready.kind !== 'ready')
                    fail(ready.code);
                owner.scope = { owner: owner.token, incarnation: owner.view.agent, session,
                    signal: AbortSignal.any([owner.view.signal, owner.abort.signal]), authorInput: owner.original.authorInput,
                    realmEpoch: plan.realmEpoch, loadFrame: ready.epoch.loadFrame, inheritedCut: null, sourceNativeCut: cut,
                    requestedStep: { eventId: selector.batchId, frame: { ownerSessionId: session.id,
                            sourceNativeCutSha256: recordSha256(cut), material: owner.frame.material, input } } };
                const { driver: replay } = await engine(), result = await replay.execute(selector);
                if (result.kind === 'completed') {
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
            const ready = journal.capture(owner.view.session.id, boundary.plan.realmEpoch, all(owner.view.session));
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
                return !!driver?.checkEvidence(lastLive.evidence, { association: lastLive.association, output: lastLive.output });
            }
            finally {
                owner.associations.push(lastLive.association);
            }
        } });
    async function prepareCompletion(scope, closing) {
        if (!closing)
            fail('SCHEMA_OWNER_UNPROVEN');
        const view = deps.closingView(closing, scope), sid = scope.receipt.checkpoint.sessionId;
        if (!view || !view.current() || !deps.verifyNative(scope))
            fail('SCHEMA_OWNER_UNPROVEN');
        await deps.awaitOwnedCompletion(sid, scope.receipt.checkpoint.actualTurn);
        if (!view.current())
            fail('SCHEMA_STORY_PERMISSION_REVOKED');
        const session = view.session, body = deps.readCanonical(sid, scope.receipt.checkpoint.actualTurn);
        const row = scope.currency.snapshot && deps.branch.get(scope.currency.snapshot.key);
        const base = row?.numericalState;
        if (!body || !base || !inputSnapshotReferenceCurrent(deps.branch, sid, scope.currency))
            fail('SCHEMA_STORY_BASIS_CHANGED');
        const history = factual(session), frame = deps.source.captureFrame(history.original), canonical = { ...body, narrativeSha256: sha256(body.narrative) };
        if (!same(base, history.snapshot) || deps.sourceSha256(sid) !== scope.currency.source.sourceSha256)
            fail('SCHEMA_STORY_BASIS_CHANGED');
        const phase = deps.branch.get(`${sid}__phaseb-${scope.receipt.checkpoint.actualTurn}`);
        if (phase?.state !== 'completed' || phase.assistantSeq !== body.seq)
            fail('INPUT_TERMINAL_PHASE_BC_UNRESOLVED');
        const selectorsAnchor = { kind: 'story', preparationId: scope.currency.preparationId,
            attemptGeneration: scope.currency.attemptGeneration, receiptGeneration: scope.currency.receiptGeneration,
            turn: scope.receipt.checkpoint.actualTurn, canonicalSeq: body.seq, messageId: body.messageId, messageVersionSha256: body.versionSha256 };
        const events = all(session), initialCut = { schemaVersion: 1, sessionId: sid, ownerSessionId: sid,
            nativeCut: events.length, nativePrefixSha256: recordSha256(events), sourceSnapshotSha256: frame.snapshotSha256,
            materialSha256: frame.materialSha256, stopGeneration: scope.stopGeneration, anchor: selectorsAnchor };
        const plan = transaction.makePlan(scope, canonical, base, frame, history.original.realmEpoch, history.original.programSha256, initialCut, events[scope.receipt.turnEndSeq].time);
        if (owners.has(sid))
            fail('SCHEMA_STORY_OWNER_EXISTS');
        const baseline = new Map([...deps.status.entries()].filter(([key]) => key.startsWith(`${sid}__mvu-`)
            && !key.startsWith(`${sid}__mvu-schema-`)).map(([key, value]) => [key, recordSha256(value)]));
        // Existing complete story facts remain immutable during this publication.
        for (const [key, value] of deps.status.entries())
            if (key.startsWith(`${sid}__mvu-state-schema-story-`))
                baseline.set(key, recordSha256(value));
        const owner = { lease: closing, view, original: history.original, frame, base, plan, abort: new AbortController(),
            token: Object.freeze({}), inSource: false, baseline, associations: [] };
        owners.set(sid, owner);
        scopes.set(owner.token, owner);
        return plan;
    }
    function releaseClosing(lease) {
        for (const [sid, owner] of owners)
            if (owner.lease === lease) {
                owner.abort.abort();
                driver?.invalidateOwner(owner.token);
                owners.delete(sid);
                views.delete(sid);
            }
    }
    function verifyConsumed(scope, plan, settlement) {
        const view = views.get(plan.base.sessionId);
        if (!view || !viewCurrent(view) || !transaction.verifyConsumed(scope, plan, settlement))
            return false;
        try {
            const terminal = readInputCompletion(deps.branch, plan.base.sessionId, scope.currency.preparationId);
            const event = deps.status.get(settlement.event.key);
            return view.history.consumed.get(plan.planSha256) === recordSha256({ terminal, event, settlement });
        }
        catch {
            return false;
        }
    }
    return { preflight, observation, readSnapshot, prepareCompletion, releaseClosing, verifyConsumed,
        publishCompletion: (scope, plan, closing) => closing
            ? transaction.publish(scope, plan, closing) : Promise.resolve({ kind: 'blocked', code: 'SCHEMA_OWNER_UNPROVEN' }),
        verifySettlement: transaction.verifySettlement,
        invalidateSession(sid) {
            const owner = owners.get(sid);
            if (owner)
                releaseClosing(owner.lease);
            views.delete(sid);
        },
        invalidateAgent(agent) {
            for (const owner of owners.values())
                if (owner.view.agent === agent)
                    releaseClosing(owner.lease);
            for (const [sid, view] of views)
                if (view.agent === agent)
                    views.delete(sid);
        },
        dispose() { disposed = true; for (const owner of owners.values())
            releaseClosing(owner.lease); views.clear(); driver?.dispose(); },
    };
}
