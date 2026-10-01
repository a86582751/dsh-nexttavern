// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-player-core.ts; edit the TypeScript source.
/** Owns explicit schema replacements in the real Agent maintenance reservation.
 * Durable facts can confirm a completed operation; they never mint this lease. */
import { recordSha256 } from './roleplay-data.js';
import { mvuStateCurrentHeadKey } from './roleplay-mvu-state.js';
import { createRoleplayMvuSchemaJournal } from './roleplay-mvu-schema-journal.js';
import { createRoleplayMvuSchemaReplay } from './roleplay-mvu-schema-replay.js';
import { createRoleplayMvuSchemaPlayer } from './roleplay-mvu-schema-player.js';
import { readMvuSchemaPlayerRequest, makeMvuSchemaPlayerOperation, validateMvuSchemaPlayerOperation, verifyMvuSchemaPlayerMarker, mvuSchemaPlayerOperationKey, mvuSchemaPlayerCompletionKey, mvuSchemaPlayerPlanKey, mvuSchemaPlayerRefusalKey, mvuSchemaPlayerEventKey, mvuSchemaPlayerSettlementKey, makeMvuSchemaPlayerCompletion, makeMvuSchemaPlayerRefusal, validateMvuSchemaPlayerRefusal, validateMvuSchemaPlayerEvent, readMvuSchemaPlayerCompletedFacts, MVU_SCHEMA_PLAYER_PHASES } from './roleplay-mvu-schema-player-types.js';
import { schemaTraceRequestedStep } from './roleplay-mvu-schema-executor-types.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
const codeOf = (error) => error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
    ? error.message : 'MVU_PLAYER_WRITE_UNKNOWN';
function fail(code) { throw Error(code); }
export function createRoleplayMvuSchemaPlayerCore(deps) {
    const reservations = new Map(), tokens = new WeakMap();
    const journal = createRoleplayMvuSchemaJournal({ table: deps.status, markers: deps.markers });
    let disposed = false;
    const drivers = new Map();
    const events = (session) => session.snapshotEvents();
    const current = (session) => !disposed && deps.active(session) && deps.session(session.id) === session;
    const markerFor = (operation, session) => events(session).find(event => event.type === deps.playerMarkers.eventType && event.data.sessionId === session.id
        && event.data.operationId === operation.operationId);
    function completed(operation, session) {
        return readMvuSchemaPlayerCompletedFacts(deps.branch, deps.status, operation, events(session));
    }
    function pendingCode(sid) {
        try {
            const session = deps.session(sid);
            if (!session)
                return 'MVU_PLAYER_SESSION_INACTIVE';
            const prefix = `${sid}__mvu-schema-player-`, rows = [...deps.branch.entries()].filter(([key]) => key.startsWith(prefix));
            if (rows.length > 4096)
                return 'SCHEMA_PLAYER_HISTORY_UNPROVEN';
            const operations = rows.filter(([key]) => key.startsWith(`${prefix}operation-`));
            const publishedKeys = new Set();
            for (const [key, row] of operations) {
                const operation = validateMvuSchemaPlayerOperation(row);
                if (key !== mvuSchemaPlayerOperationKey(sid, operation.operationId) || operation.sessionId !== sid)
                    fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
                const refusal = deps.branch.get(mvuSchemaPlayerRefusalKey(sid, operation.operationId));
                if (refusal !== undefined) {
                    validateMvuSchemaPlayerRefusal(refusal, operation);
                    if (markerFor(operation, session) || deps.branch.get(mvuSchemaPlayerCompletionKey(sid, operation.operationId)) !== undefined
                        || deps.branch.get(mvuSchemaPlayerPlanKey(sid, operation.operationId)) !== undefined) {
                        fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
                    }
                }
                else {
                    const facts = completed(operation, session);
                    publishedKeys.add(mvuSchemaPlayerEventKey(sid, facts.event.eventId));
                    publishedKeys.add(mvuSchemaPlayerSettlementKey(sid, facts.plan.planSha256));
                }
            }
            for (const [key] of rows)
                if (!operations.some(([, row]) => [mvuSchemaPlayerOperationKey(sid, row.operationId), mvuSchemaPlayerCompletionKey(sid, row.operationId), mvuSchemaPlayerPlanKey(sid, row.operationId),
                    mvuSchemaPlayerRefusalKey(sid, row.operationId)].includes(key)))
                    fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
            for (const [key] of deps.status.entries())
                if (key.startsWith(`${sid}__mvu-state-schema-player-`)
                    && !publishedKeys.has(key))
                    fail('SCHEMA_PLAYER_HISTORY_UNPROVEN');
        }
        catch {
            return 'SCHEMA_PLAYER_PENDING';
        }
    }
    function busy(sid) {
        const session = deps.session(sid);
        if (!session || !current(session))
            return 'MVU_PLAYER_SESSION_INACTIVE';
        const agent = deps.agent(session);
        if (!agent || agent.session !== session || typeof agent.runMaintenance !== 'function')
            return 'READ_OR_PERMISSION_UNKNOWN';
        if (reservations.has(sid) || agent.status !== 'idle' || agent.inbox.nextTurn.length || agent.inbox.nextStep.length) {
            return 'MVU_PLAYER_BUSY';
        }
        const completion = agent.lookupInputCompletion(), stop = agent.lookupInputStop();
        if (!['none', 'settled'].includes(completion.status) || !['none', 'acknowledged'].includes(stop.status))
            return 'MVU_PLAYER_BUSY';
        return pendingCode(sid);
    }
    function stateRows(sid) {
        return [...deps.status.entries()].filter(([key]) => key.startsWith(`${sid}__mvu-`)
            && !key.startsWith(`${sid}__mvu-schema-`));
    }
    function rowsCurrent(owner) {
        const sid = owner.reservation.session.id, proposed = new Map(), boundary = owner.publication;
        if (boundary) {
            proposed.set(mvuSchemaPlayerEventKey(sid, boundary.event.eventId), boundary.event);
            if (boundary.event.outcome === 'accepted')
                proposed.set(mvuStateCurrentHeadKey(sid), boundary.head);
            proposed.set(mvuSchemaPlayerSettlementKey(sid, boundary.plan.planSha256), boundary.settlement);
        }
        const actual = new Map(stateRows(sid));
        for (const [key, hash] of owner.baseline) {
            if (proposed.has(key) && same(actual.get(key), proposed.get(key)))
                continue;
            if (recordSha256(actual.get(key)) !== hash)
                return false;
        }
        for (const [key, value] of actual)
            if (!owner.baseline.has(key) && (!proposed.has(key) || !same(value, proposed.get(key))))
                return false;
        return true;
    }
    function ownerCurrent(owner) {
        try {
            const reservation = owner.reservation, sid = reservation.session.id;
            if (reservations.get(sid) !== reservation || reservation.owner !== owner || !reservation.inSource
                || reservation.abort.signal.aborted || !reservation.signal || reservation.signal.aborted
                || !current(reservation.session) || deps.agent(reservation.session) !== reservation.agent
                || recordSha256(reservation.agent.lookupInputStop()) !== reservation.stopSha256
                || deps.sourceSha256(sid) !== owner.operation.base.sourceSha256
                || !deps.source.frameCurrent(owner.basis.original, owner.basis.frame) || !rowsCurrent(owner)
                || !same(deps.branch.get(mvuSchemaPlayerOperationKey(sid, owner.operation.operationId)), owner.operation))
                return false;
            const marker = markerFor(owner.operation, reservation.session);
            if (!marker)
                return false;
            verifyMvuSchemaPlayerMarker(owner.operation, marker, events(reservation.session));
            if (owner.publication && events(reservation.session).length !== owner.publication.event.frontier.nativeCut)
                return false;
            return same(owner.plan.marker, { seq: marker.seq, sha256: recordSha256(marker) });
        }
        catch {
            return false;
        }
    }
    function checkOwned(scope, boundary) {
        try {
            const owner = tokens.get(scope.owner), session = owner?.reservation.session;
            if (!owner || !session || !ownerCurrent(owner) || scope.session !== session || scope.incarnation !== owner.reservation.agent
                || scope.signal.aborted || !owner.scope || !same(scope.requestedStep, owner.scope.requestedStep))
                return false;
            const actual = events(session), initial = owner.plan.initialCut, cut = scope.sourceNativeCut.nativeCut;
            if (recordSha256(actual.slice(0, initial.nativeCut)) !== initial.nativePrefixSha256
                || cut !== initial.nativeCut + 2 * owner.associations.length
                || recordSha256(actual.slice(0, cut)) !== scope.sourceNativeCut.nativePrefixSha256)
                return false;
            for (const association of owner.associations)
                for (const ref of [association.dispatchMarker, association.completionMarker]) {
                    if (recordSha256(actual[ref.seq]) !== ref.sha256)
                        return false;
                }
            for (const [index, ref] of [boundary.dispatchMarker, boundary.completionMarker].entries()) {
                if (ref && (ref.seq !== cut + index || recordSha256(actual[ref.seq]) !== ref.sha256))
                    return false;
            }
            return actual.length === cut + (boundary.completionMarker ? 2 : boundary.dispatchMarker ? 1 : 0);
        }
        catch {
            return false;
        }
    }
    async function engine(basis) {
        const { program, runner } = basis.ready.epoch;
        const runtime = await deps.protectedRuntime({ compiler: program.compiler, bridge: program.bridge, libraries: program.libraries, runner });
        if (disposed)
            fail('SCHEMA_RUNTIME_DISPOSED');
        let driver = drivers.get(runtime.implementationKey);
        if (!driver) {
            driver = createRoleplayMvuSchemaReplay({ table: deps.status, compiler: runtime.compiler, runner: runtime.runner,
                executorVersion: runtime.executorVersion,
                markers: deps.markers, captureHistoricalCut: deps.story.captureHistoricalCut, flush: deps.flush,
                captureOwned: selector => {
                    const owner = reservations.get(selector.sessionId)?.owner;
                    if (!owner?.scope || !ownerCurrent(owner) || owner.scope.requestedStep.eventId !== selector.batchId)
                        fail('SCHEMA_OWNER_UNPROVEN');
                    return owner.scope;
                }, checkOwned, withSourceBoundary: (scope, action) => {
                    const owner = tokens.get(scope.owner);
                    if (!owner || !ownerCurrent(owner))
                        fail('SCHEMA_PLAYER_PERMISSION_REVOKED');
                    // The real maintenance callback already holds the one Source lock.
                    return action();
                } });
            drivers.set(runtime.implementationKey, driver);
        }
        return driver;
    }
    const transaction = createRoleplayMvuSchemaPlayer({ table: deps.status,
        readReady: plan => {
            const owner = reservations.get(plan.operation.sessionId)?.owner;
            return owner && same(owner.plan, plan) && ownerCurrent(owner)
                ? { kind: 'ready', snapshot: owner.operation.base } : { kind: 'blocked', code: 'SCHEMA_PLAYER_BASE_CHANGED' };
        }, ownerCurrent: (token, plan) => {
            const owner = tokens.get(token);
            return !!owner && same(owner.plan, plan) && ownerCurrent(owner);
        }, executePhase: async (plan, phase, input, token) => {
            const owner = tokens.get(token);
            if (!owner || !ownerCurrent(owner))
                return { kind: 'blocked', code: 'SCHEMA_PLAYER_PERMISSION_REVOKED' };
            const index = MVU_SCHEMA_PLAYER_PHASES.indexOf(phase);
            if (index !== owner.associations.length)
                fail('SCHEMA_PLAYER_PHASE_ORDER');
            const selector = plan.selectors[index], session = owner.reservation.session, actual = events(session);
            const cut = { ...plan.initialCut, nativeCut: actual.length, nativePrefixSha256: recordSha256(actual), anchor: selector.anchor };
            const ready = journal.capture(session.id, plan.realmEpoch, actual, owner.basis.inheritedCut);
            if (ready.kind !== 'ready')
                fail(ready.code);
            if (ready.epoch.schemaVersion !== plan.schemaVersion)
                fail('SCHEMA_EXECUTOR_VERSION_MISMATCH');
            owner.scope = { owner: owner.token, incarnation: owner.reservation.agent, session,
                signal: AbortSignal.any([owner.reservation.signal, owner.reservation.abort.signal]),
                authorInput: owner.basis.original.authorInput, realmEpoch: plan.realmEpoch, loadFrame: ready.epoch.loadFrame,
                inheritedCut: owner.basis.inheritedCut, sourceNativeCut: cut, requestedStep: schemaTraceRequestedStep(selector.batchId, { ownerSessionId: session.id, sourceNativeCutSha256: recordSha256(cut), material: owner.basis.frame.material }, input) };
            const replay = await engine(owner.basis);
            owner.driver = replay;
            const result = await replay.execute(selector);
            if (result.kind === 'completed') {
                owner.lastLive = result;
                owner.associations.push(result.association);
            }
            return result;
        }, withPublicationBoundary: async (token, lastLive, action) => {
            const owner = tokens.get(token);
            if (!owner || owner.lastLive !== lastLive || !ownerCurrent(owner))
                fail('SCHEMA_OWNER_UNPROVEN');
            return action();
        }, checkPublication: (token, lastLive, boundary) => {
            const owner = tokens.get(token);
            if (!owner || owner.lastLive !== lastLive || !same(owner.plan, boundary.plan))
                return false;
            owner.publication = boundary;
            if (!ownerCurrent(owner) || !same(boundary.event.phases.map(phase => phase.association), owner.associations))
                return false;
            const ready = journal.capture(owner.reservation.session.id, boundary.plan.realmEpoch, events(owner.reservation.session), owner.basis.inheritedCut);
            if (ready.kind !== 'ready' || !same(boundary.event.frontier, { nativeCut: ready.steps.at(-1).completionMarker.seq + 1,
                tailSha256: ready.tailSha256, frontierSha256: ready.frontierSha256 }))
                return false;
            for (const [index, phase] of boundary.event.phases.entries()) {
                const step = ready.steps.at(index - boundary.event.phases.length);
                if (!step || !same(step.step.output, phase.output) || !same(step.step.frame.input, phase.input)
                    || !same(step.dispatchRef, phase.association.dispatch) || !same(step.completionRef, phase.association.completion))
                    return false;
            }
            owner.associations.pop();
            try {
                return !!owner.driver?.checkEvidence(lastLive.evidence, { association: lastLive.association, output: lastLive.output });
            }
            finally {
                owner.associations.push(lastLive.association);
            }
        } });
    async function putExact(key, value) {
        const old = deps.branch.get(key);
        if (old !== undefined && !same(old, value))
            fail('SCHEMA_PLAYER_OPERATION_CONFLICT');
        if (old === undefined)
            try {
                await deps.branch.put(key, value);
            }
            catch { /* Resolve a lost ACK only through exact readback. */ }
        if (!same(deps.branch.get(key), value))
            fail('MVU_PLAYER_WRITE_UNKNOWN');
    }
    async function response(request, outcome, replayed, code, event) {
        const last = event?.phases.at(-1)?.output;
        const refusalCode = last?.kind === 'refused' ? last.diagnostics[0]?.code : event?.commandRefusal?.code
            ?? (event?.reducer?.result.kind === 'rejected' ? event.reducer.result.code : undefined);
        return { ok: !code, numericalState: await deps.observe(request.sessionId), operation: { operationId: request.operationId,
                payloadSha256: recordSha256(request), outcome, replayed, ...(refusalCode ? { refusalCode } : {}) }, ...(code ? { code, error: code } : {}) };
    }
    const outcomeFor = (event) => event.outcome === 'accepted' ? 'updated' : event.outcome;
    async function submit(input) {
        let request;
        try {
            request = readMvuSchemaPlayerRequest(input);
        }
        catch (error) {
            const original = codeOf(error), code = original === 'SCHEMA_PLAYER_RECORD_INVALID' ? 'MVU_PLAYER_DATA_INVALID' : original;
            return { ok: false, code, error: code };
        }
        const sid = request.sessionId, session = deps.session(sid), opKey = mvuSchemaPlayerOperationKey(sid, request.operationId);
        if (!session || !current(session))
            return response(request, 'unknown', false, 'MVU_PLAYER_SESSION_INACTIVE');
        const old = deps.branch.get(opKey);
        try {
            if (old !== undefined) {
                const operation = validateMvuSchemaPlayerOperation(old);
                if (!same(operation.request, request))
                    return response(request, 'unknown', false, 'MVU_PLAYER_OPERATION_CONFLICT');
                const refusal = deps.branch.get(mvuSchemaPlayerRefusalKey(sid, request.operationId));
                if (refusal !== undefined) {
                    const fact = validateMvuSchemaPlayerRefusal(refusal, operation);
                    if (markerFor(operation, session))
                        fail('SCHEMA_PLAYER_PENDING');
                    return response(request, 'unknown', true, fact.code);
                }
                // A repeated request only confirms complete durable facts. It cannot
                // resume phases or create a missing numerical head after a cold start.
                const facts = completed(operation, session);
                await deps.story.preflight(sid);
                return response(request, outcomeFor(facts.event), true, undefined, facts.event);
            }
            const block = busy(sid);
            if (block)
                return response(request, 'unknown', false, block);
            await deps.story.preflight(sid);
            // Read-only verification can await the worker. Recheck before the
            // synchronous reservation so two HTTP callers cannot replace a lease.
            const afterPreflight = busy(sid);
            if (afterPreflight)
                return response(request, 'unknown', false, afterPreflight);
            const agent = deps.agent(session), done = Promise.withResolvers();
            const reservation = { session, agent, abort: new AbortController(), inSource: false,
                stopSha256: recordSha256(agent.lookupInputStop()), released: done.promise, release: () => done.resolve() };
            reservations.set(sid, reservation);
            let operation;
            let completedEvent;
            try {
                const result = await agent.runMaintenance(async (signal) => {
                    reservation.signal = signal;
                    return deps.withSourceLock(sid, async () => {
                        reservation.inSource = true;
                        try {
                            signal.throwIfAborted();
                            if (!current(session) || deps.agent(session) !== agent || reservation.abort.signal.aborted)
                                fail('SCHEMA_PLAYER_PERMISSION_REVOKED');
                            const basis = deps.story.captureManualBasis(sid);
                            const expected = request.expected, base = basis.base;
                            if (expected.sourceSha256 !== base.sourceSha256 || !same(expected.root, base.root)
                                || expected.revision !== base.revision || expected.headSha256 !== base.headSha256
                                || expected.valuesSha256 !== base.valuesSha256 || expected.stateSnapshotSha256 !== base.stateSnapshotSha256) {
                                fail('MVU_PLAYER_STALE_BASE');
                            }
                            operation = makeMvuSchemaPlayerOperation(request, basis.base);
                            if (events(session).at(-1)?.seq !== request.expected.observedNativeSeq)
                                fail('MVU_PLAYER_STALE_NATIVE');
                            await putExact(opKey, operation);
                            signal.throwIfAborted();
                            if (deps.sourceSha256(sid) !== operation.base.sourceSha256)
                                fail('SOURCE_CHANGED');
                            const marker = deps.playerMarkers.append(session, { schemaVersion: 1, encoding: 'native-mvu-player-edit-marker-v1',
                                sessionId: sid, operationId: request.operationId, requestSha256: operation.requestSha256,
                                operationSha256: operation.operationSha256, sourceSha256: operation.base.sourceSha256,
                                rootSha256: recordSha256(operation.base.root), baseSnapshotSha256: operation.base.stateSnapshotSha256,
                                replacementValuesSha256: recordSha256(request.values), observedNativeSeq: request.expected.observedNativeSeq });
                            if (!await deps.flush(session))
                                fail('MVU_PLAYER_WRITE_UNKNOWN');
                            signal.throwIfAborted();
                            const actual = events(session), frame = basis.frame, initialCut = { schemaVersion: 1, sessionId: sid,
                                ownerSessionId: sid, nativeCut: actual.length, nativePrefixSha256: recordSha256(actual),
                                sourceSnapshotSha256: frame.snapshotSha256, materialSha256: frame.materialSha256,
                                stopGeneration: 'notice' in agent.lookupInputStop() ? agent.lookupInputStop().notice.stopSequence : 0,
                                anchor: { kind: 'manual', operationId: request.operationId, requestSha256: operation.requestSha256,
                                    observedNativeSeq: request.expected.observedNativeSeq } };
                            const plan = transaction.makePlan(operation, { seq: marker.seq, sha256: recordSha256(marker) }, frame, initialCut, marker.time, basis.ready.epoch.schemaVersion);
                            await putExact(mvuSchemaPlayerPlanKey(sid, operation.operationId), plan);
                            const owner = { reservation, basis, operation, plan, token: Object.freeze({}),
                                baseline: new Map(stateRows(sid).map(([key, row]) => [key, recordSha256(row)])), associations: [] };
                            reservation.owner = owner;
                            tokens.set(owner.token, owner);
                            const published = await transaction.publish(plan, owner.token);
                            if (published.kind !== 'acknowledged')
                                fail(published.code);
                            if (!ownerCurrent(owner))
                                fail('SCHEMA_PLAYER_PERMISSION_REVOKED');
                            const event = validateMvuSchemaPlayerEvent(deps.status.get(published.settlement.event.key));
                            await putExact(mvuSchemaPlayerCompletionKey(sid, operation.operationId), makeMvuSchemaPlayerCompletion(plan, published.settlement));
                            if (!ownerCurrent(owner))
                                fail('SCHEMA_PLAYER_PERMISSION_REVOKED');
                            completed(operation, session);
                            return { event };
                        }
                        catch (error) {
                            if (operation && !markerFor(operation, session) && same(deps.branch.get(opKey), operation)) {
                                try {
                                    await putExact(mvuSchemaPlayerRefusalKey(sid, operation.operationId), makeMvuSchemaPlayerRefusal(operation, codeOf(error)));
                                }
                                catch { /* Keep the operation pending if refusal is unconfirmed. */ }
                            }
                            throw error;
                        }
                        finally {
                            reservation.inSource = false;
                        }
                    });
                });
                completedEvent = result.event;
            }
            finally {
                reservation.abort.abort();
                if (reservation.owner)
                    reservation.owner.driver?.invalidateOwner(reservation.owner.token);
                if (reservations.get(sid) === reservation)
                    reservations.delete(sid);
                reservation.release();
            }
            deps.story.invalidateSession(sid);
            await deps.story.preflight(sid);
            return response(request, outcomeFor(completedEvent), false, undefined, completedEvent);
        }
        catch (error) {
            const stored = deps.branch.get(opKey);
            const code = stored && markerFor(stored, session) ? 'MVU_PLAYER_WRITE_UNKNOWN' : codeOf(error);
            return response(request, 'unknown', old !== undefined, code);
        }
    }
    async function awaitMutationBarrier(session, signal) {
        while (reservations.has(session.id)) {
            signal.throwIfAborted();
            const reservation = reservations.get(session.id);
            await Promise.race([reservation.released, new Promise((_resolve, reject) => {
                    const abort = () => reject(signal.reason ?? Error('SCHEMA_PLAYER_CANCELLED'));
                    signal.addEventListener('abort', abort, { once: true });
                    reservation.released.finally(() => signal.removeEventListener('abort', abort));
                    if (signal.aborted)
                        abort();
                })]);
        }
        signal.throwIfAborted();
    }
    function invalidateSession(sid) {
        const reservation = reservations.get(sid);
        reservation?.abort.abort();
        if (reservation?.owner)
            reservation.owner.driver?.invalidateOwner(reservation.owner.token);
    }
    return { submit, pendingCode, editBlockCode: busy, awaitMutationBarrier,
        mutationBlockCode: (session) => reservations.has(session.id) ? 'MVU_PLAYER_BUSY' : undefined,
        invalidateSession, invalidateAgent: (agent) => {
            for (const [sid, reservation] of reservations)
                if (reservation.agent === agent)
                    invalidateSession(sid);
        }, dispose: () => {
            disposed = true;
            for (const sid of reservations.keys())
                invalidateSession(sid);
            for (const driver of drivers.values())
                driver.dispose();
        } };
}
