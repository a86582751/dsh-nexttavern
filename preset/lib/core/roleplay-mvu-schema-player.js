// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-player.ts; edit the TypeScript source.
/** One schema replacement transaction. Actual Agent/Source reservation and
 * journal execution belong to Root; durable facts cannot recreate this owner. */
import { recordSha256 } from './roleplay-data.js';
import { mvuStateCurrentHeadKey } from './roleplay-mvu-state.js';
import { validateSchemaEvaluationInputV3 } from './tavern-mvu-schema-runner-v3.js';
import { validateSchemaEvaluationInputV4 } from './tavern-mvu-schema-runner-v4.js';
import { validateMvuScopeReadFrameV1 } from './tavern-mvu-scope-read.js';
import { schemaScopeReadFactsEqual } from './roleplay-mvu-schema-scope-facts.js';
import { freezeMvuSchemaPlayerData, sealMvuSchemaPlayerFact, validateMvuSchemaPlayerPlan, validateMvuSchemaPlayerEvent, validateMvuSchemaPlayerSettlement, deriveMvuSchemaPlayerSelectors, mvuSchemaPlayerPhaseInput, mvuSchemaPlayerReducerBridge, mvuSchemaPlayerEvent, mvuSchemaPlayerHead, mvuSchemaPlayerSettlement, mvuSchemaPlayerEventKey, mvuSchemaPlayerSettlementKey, MVU_SCHEMA_PLAYER_PHASES, schemaPlayerCode } from './roleplay-mvu-schema-player-types.js';
import { validateMvuSchemaNumericalSnapshot, isMvuSchemaGenesisHead } from './roleplay-mvu-schema-story-types.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
function fail(code) { throw Error(code); }
const codeOf = (error) => schemaPlayerCode(error instanceof Error ? error.message : undefined);
export function createRoleplayMvuSchemaPlayer(deps) {
    // Attempt identities survive this owner; durable operation/pair/completion
    // gates supplied by Root prohibit cold retries even when this set is gone.
    const attempted = new Set();
    function makePlan(operation, marker, currentFrame, initialCut, clockEpochMs = 0, executorVersion = 1, scopeReadFrame, hostEpoch) {
        if (executorVersion >= 3 && !scopeReadFrame)
            fail('SCHEMA_SCOPE_READ_REQUIRED');
        if (hostEpoch && executorVersion !== 4)
            fail('SCHEMA_EXECUTOR_VERSION_MISMATCH');
        // Core supplies the actual Source and operation facts. This constructor
        // binds those inputs; the raw plan reader owns their full parsing.
        const input = { operation, marker, currentFrame, initialCut, clockEpochMs };
        const version = executorVersion === 4 ? {
            ...(hostEpoch ? { schemaVersion: 5, encoding: 'native-mvu-schema-player-plan-v5',
                epoch: hostEpoch.epoch, serverProgramSha256: hostEpoch.serverProgramSha256,
                ...(hostEpoch.errorPolicy ? { errorPolicy: hostEpoch.errorPolicy } : {}) } :
                { schemaVersion: 4, encoding: 'native-mvu-schema-player-plan-v4' }),
            executorVersion: 4, scopeReadFrame: validateMvuScopeReadFrameV1(scopeReadFrame)
        } :
            executorVersion === 3 ? { schemaVersion: 3, encoding: 'native-mvu-schema-player-plan-v3',
                executorVersion: 3, scopeReadFrame: validateMvuScopeReadFrameV1(scopeReadFrame) } :
                executorVersion === 2 ? { schemaVersion: 2, encoding: 'native-mvu-schema-player-plan-v2', executorVersion: 2 } :
                    { schemaVersion: 1, encoding: 'native-mvu-schema-player-plan-v1' };
        const selectors = deriveMvuSchemaPlayerSelectors(operation, marker), sid = operation.sessionId;
        if (marker.seq !== operation.request.expected.observedNativeSeq + 1 || initialCut.nativeCut !== marker.seq + 1
            || initialCut.nativeCut < operation.base.schemaFrontier.nativeCut || initialCut.sessionId !== sid || initialCut.ownerSessionId !== sid
            || currentFrame.sessionId !== sid || initialCut.sourceSnapshotSha256 !== currentFrame.snapshotSha256
            || initialCut.materialSha256 !== currentFrame.materialSha256 || !same(initialCut.anchor, selectors[0].anchor)
            || !Number.isSafeInteger(clockEpochMs) || clockEpochMs < 0 || Object.is(clockEpochMs, -0))
            fail('SCHEMA_PLAYER_RECORD_INVALID');
        if ('scopeReadFrame' in version) {
            const read = version.scopeReadFrame, source = currentFrame.snapshot.source;
            if (read.source.sessionId !== sid || read.source.sourceRecordSessionId !== source.sourceRecordSessionId
                || read.source.importId !== source.importId || read.source.rawSha256 !== source.rawSha256
                || read.source.sourceSnapshotSha256 !== currentFrame.snapshotSha256
                || read.sourceNativeCutSha256 !== recordSha256(initialCut))
                fail('SCHEMA_PLAYER_RECORD_INVALID');
        }
        return sealMvuSchemaPlayerFact({ ...version, ...input, realmEpoch: input.operation.base.root.realmEpoch,
            programSha256: input.operation.base.root.programSha256, randomSeed: recordSha256({ operation: input.operation, marker: input.marker }),
            selectors }, 'planSha256');
    }
    function read(key) {
        const raw = deps.table.get(key);
        return raw === undefined ? undefined : freezeMvuSchemaPlayerData(raw);
    }
    function freezeConfirmedRow(value) {
        if (value && typeof value === 'object') {
            for (const child of Object.values(value))
                freezeConfirmedRow(child);
            Object.freeze(value);
        }
        return value;
    }
    async function putExact(key, next, prior) {
        // These three publication rows were produced and frozen above. Keep their
        // identity through the write so Root can track its own rows across awaits.
        // Persistent conflict and lost-ACK confirmation still use exact readback.
        const value = next, actual = read(key);
        if (!same(actual, prior) && !same(actual, value))
            fail('SCHEMA_PLAYER_IDENTITY_CONFLICT');
        if (!same(actual, value))
            try {
                await deps.table.put(key, value);
            }
            catch { /* Only exact readback can settle a lost write ACK. */ }
        const observed = deps.table.get(key);
        // This exact readback is the constructor's deeply frozen publication row.
        if (observed === value)
            return observed;
        if (!same(observed === undefined ? undefined : freezeMvuSchemaPlayerData(observed), value))
            fail('SCHEMA_PLAYER_WRITE_UNKNOWN');
        // A storage adapter may detach the row on write. Hand off its actual exact
        // readback, rather than assuming it retained the producer's reference.
        return freezeConfirmedRow(observed);
    }
    function checkOwner(owner, plan) {
        if (!deps.ownerCurrent(owner, plan))
            fail('SCHEMA_PLAYER_PERMISSION_REVOKED');
    }
    function checkBase(plan) {
        const ready = deps.readReady(plan);
        if (ready.kind !== 'ready')
            fail(schemaPlayerCode(ready.code));
        if (!same(validateMvuSchemaNumericalSnapshot(ready.snapshot), plan.operation.base))
            fail('SCHEMA_PLAYER_BASE_CHANGED');
    }
    function storedFacts(plan, settlement) {
        try {
            const supplied = freezeMvuSchemaPlayerData(settlement), sid = plan.operation.sessionId;
            const eventId = recordSha256({ encoding: 'native-mvu-schema-player-event-identity-v1', planSha256: plan.planSha256 });
            if (supplied.event.key !== mvuSchemaPlayerEventKey(sid, eventId))
                return;
            const event = validateMvuSchemaPlayerEvent(read(supplied.event.key));
            const actual = validateMvuSchemaPlayerSettlement(supplied, event);
            if (!same(event.plan, plan) || !same(read(mvuSchemaPlayerSettlementKey(sid, plan.planSha256)), actual))
                return;
            return { event, settlement: actual };
        }
        catch {
            return;
        }
    }
    function verifyConsumed(suppliedPlan, settlement) {
        try {
            return !!storedFacts(validateMvuSchemaPlayerPlan(suppliedPlan), settlement);
        }
        catch {
            return false;
        }
    }
    function verifySettlement(suppliedPlan, settlement) {
        try {
            const plan = validateMvuSchemaPlayerPlan(suppliedPlan), facts = storedFacts(plan, settlement);
            if (!facts)
                return false;
            const actualHead = read(mvuStateCurrentHeadKey(plan.operation.sessionId));
            return facts.settlement.outcome === 'accepted' ? same(actualHead, facts.settlement.result.head) :
                actualHead === undefined && isMvuSchemaGenesisHead(plan.operation.base.currentHead)
                    || same(actualHead, facts.settlement.result.head);
        }
        catch {
            return false;
        }
    }
    async function publish(suppliedPlan, owner) {
        let spent = false;
        try {
            const candidate = deps.readOwnedPlan ? deps.readOwnedPlan(owner, suppliedPlan) : validateMvuSchemaPlayerPlan(suppliedPlan);
            if (!candidate)
                fail('SCHEMA_PLAYER_PERMISSION_REVOKED');
            const plan = candidate;
            const sid = plan.operation.sessionId;
            checkOwner(owner, plan);
            checkBase(plan);
            const eventId = recordSha256({ encoding: 'native-mvu-schema-player-event-identity-v1', planSha256: plan.planSha256 });
            if (attempted.has(plan.planSha256) || read(mvuSchemaPlayerSettlementKey(sid, plan.planSha256)) !== undefined
                || read(mvuSchemaPlayerEventKey(sid, eventId)) !== undefined)
                fail('SCHEMA_PLAYER_ALREADY_ATTEMPTED');
            attempted.add(plan.planSha256);
            const phases = [];
            let lastLive;
            for (const [index, phase] of MVU_SCHEMA_PLAYER_PHASES.entries()) {
                checkOwner(owner, plan);
                checkBase(plan);
                const input = mvuSchemaPlayerPhaseInput(plan, index, phases);
                // A dispatch begins an irreversible history attempt. Missing output
                // or cancellation must remain unknown and cannot become a refusal.
                spent = true;
                const result = await deps.executePhase(plan, phase, input, owner);
                checkOwner(owner, plan);
                if (result.kind !== 'completed')
                    return { kind: 'unknown', code: schemaPlayerCode(result.code) };
                if (!result.evidence || typeof result.evidence !== 'object')
                    fail('SCHEMA_PLAYER_EXECUTION_UNPROVEN');
                let capturedInput = input;
                if (plan.schemaVersion === 3 || plan.schemaVersion === 4 || plan.schemaVersion === 5) {
                    if (!result.capturedInput)
                        fail('SCHEMA_PLAYER_EXECUTION_UNPROVEN');
                    const actual = plan.executorVersion === 4 ? validateSchemaEvaluationInputV4(result.capturedInput)
                        : validateSchemaEvaluationInputV3(result.capturedInput);
                    if (!schemaScopeReadFactsEqual(actual.scopeReadFrame, plan.scopeReadFrame)
                        || actual.scopeReadFrame.sourceNativeCutSha256 !== result.association.sourceNativeCutSha256
                        || !same(actual, mvuSchemaPlayerPhaseInput(plan, index, phases, actual.scopeReadFrame))) {
                        fail('SCHEMA_PLAYER_EXECUTION_UNPROVEN');
                    }
                    capturedInput = actual;
                }
                lastLive = result;
                phases.push(freezeMvuSchemaPlayerData({ phase, input: capturedInput, association: result.association, output: result.output }));
                if (result.output.kind === 'refused' || result.output.commands.length)
                    break;
                if (index === 1 && mvuSchemaPlayerReducerBridge(phases[1]).result.kind === 'rejected')
                    break;
            }
            if (!lastLive)
                fail('SCHEMA_PLAYER_EXECUTION_UNPROVEN');
            const producedEvent = mvuSchemaPlayerEvent(plan, phases);
            // Core owns this live plan and its actual phases; raw callers retain the parser.
            const event = deps.readOwnedPlan ? producedEvent : validateMvuSchemaPlayerEvent(producedEvent);
            const head = mvuSchemaPlayerHead(event), settlement = mvuSchemaPlayerSettlement(event);
            const eventKey = mvuSchemaPlayerEventKey(sid, event.eventId), headKey = mvuStateCurrentHeadKey(sid);
            return await deps.withPublicationBoundary(owner, lastLive, async () => {
                const confirmedRows = [];
                function check(stage) {
                    if (!deps.checkPublication(owner, lastLive, { plan, event, head, settlement, stage,
                        confirmedRows: [...confirmedRows] }))
                        fail('SCHEMA_PLAYER_PUBLICATION_UNPROVEN');
                }
                check('before-event');
                confirmedRows.push({ key: eventKey, value: await putExact(eventKey, event) });
                check('after-event');
                if (event.outcome === 'accepted') {
                    check('before-head');
                    const prior = read(headKey);
                    if (!same(prior, plan.operation.base.currentHead)
                        && !(prior === undefined && isMvuSchemaGenesisHead(plan.operation.base.currentHead)))
                        fail('SCHEMA_PLAYER_BASE_CHANGED');
                    confirmedRows.push({ key: headKey, value: await putExact(headKey, head, prior) });
                    check('after-head');
                }
                check('before-settlement');
                const settlementKey = mvuSchemaPlayerSettlementKey(sid, plan.planSha256);
                confirmedRows.push({ key: settlementKey, value: await putExact(settlementKey, settlement) });
                // The live owner consumes all exact readbacks here before ACK. Cold
                // callers still enter the independent raw settlement verifier.
                check('after-settlement');
                return { kind: 'acknowledged', settlement };
            });
        }
        catch (error) {
            return { kind: spent ? 'unknown' : 'blocked', code: codeOf(error) };
        }
    }
    return { makePlan, publish, verifySettlement, verifyConsumed };
}
