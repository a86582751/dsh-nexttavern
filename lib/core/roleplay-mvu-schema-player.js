// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-player.ts; edit the TypeScript source.
/** One schema replacement transaction. Actual Agent/Source reservation and
 * journal execution belong to Root; durable facts cannot recreate this owner. */
import { recordSha256 } from './roleplay-data.js';
import { mvuStateCurrentHeadKey } from './roleplay-mvu-state.js';
import { freezeMvuSchemaPlayerData, sealMvuSchemaPlayerFact, validateMvuSchemaPlayerPlan, validateMvuSchemaPlayerEvent, validateMvuSchemaPlayerSettlement, deriveMvuSchemaPlayerSelectors, mvuSchemaPlayerPhaseInput, mvuSchemaPlayerReducerBridge, mvuSchemaPlayerEvent, mvuSchemaPlayerHead, mvuSchemaPlayerSettlement, mvuSchemaPlayerEventKey, mvuSchemaPlayerSettlementKey, MVU_SCHEMA_PLAYER_PHASES, schemaPlayerCode } from './roleplay-mvu-schema-player-types.js';
import { validateMvuSchemaNumericalSnapshot, isMvuSchemaGenesisHead } from './roleplay-mvu-schema-story-types.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
function fail(code) { throw Error(code); }
const codeOf = (error) => schemaPlayerCode(error instanceof Error ? error.message : undefined);
export function createRoleplayMvuSchemaPlayer(deps) {
    // Attempt identities survive this owner; durable operation/pair/completion
    // gates supplied by Root prohibit cold retries even when this set is gone.
    const attempted = new Set();
    function makePlan(operation, marker, currentFrame, initialCut, clockEpochMs = 0, executorVersion = 1) {
        const input = freezeMvuSchemaPlayerData({ operation, marker, currentFrame, initialCut, clockEpochMs });
        const version = executorVersion === 2 ? { schemaVersion: 2, encoding: 'native-mvu-schema-player-plan-v2', executorVersion: 2 } :
            { schemaVersion: 1, encoding: 'native-mvu-schema-player-plan-v1' };
        return validateMvuSchemaPlayerPlan(sealMvuSchemaPlayerFact({ ...version, ...input, realmEpoch: input.operation.base.root.realmEpoch,
            programSha256: input.operation.base.root.programSha256, randomSeed: recordSha256({ operation: input.operation, marker: input.marker }),
            selectors: deriveMvuSchemaPlayerSelectors(input.operation, input.marker) }, 'planSha256'));
    }
    function read(key) {
        const raw = deps.table.get(key);
        return raw === undefined ? undefined : freezeMvuSchemaPlayerData(raw);
    }
    async function putExact(key, next, prior) {
        const value = freezeMvuSchemaPlayerData(next), actual = read(key);
        if (!same(actual, prior) && !same(actual, value))
            fail('SCHEMA_PLAYER_IDENTITY_CONFLICT');
        if (!same(actual, value))
            try {
                await deps.table.put(key, value);
            }
            catch { /* Only exact readback can settle a lost write ACK. */ }
        if (!same(read(key), value))
            fail('SCHEMA_PLAYER_WRITE_UNKNOWN');
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
            const plan = validateMvuSchemaPlayerPlan(suppliedPlan), sid = plan.operation.sessionId;
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
                lastLive = result;
                phases.push(freezeMvuSchemaPlayerData({ phase, input, association: result.association, output: result.output }));
                if (result.output.kind === 'refused' || result.output.commands.length)
                    break;
                if (index === 1 && mvuSchemaPlayerReducerBridge(phases[1]).result.kind === 'rejected')
                    break;
            }
            if (!lastLive)
                fail('SCHEMA_PLAYER_EXECUTION_UNPROVEN');
            const event = validateMvuSchemaPlayerEvent(mvuSchemaPlayerEvent(plan, phases));
            const head = mvuSchemaPlayerHead(event), settlement = mvuSchemaPlayerSettlement(event);
            const eventKey = mvuSchemaPlayerEventKey(sid, event.eventId), headKey = mvuStateCurrentHeadKey(sid);
            return await deps.withPublicationBoundary(owner, lastLive, async () => {
                function check(stage) {
                    checkOwner(owner, plan);
                    if (!deps.checkPublication(owner, lastLive, { plan, event, head, settlement, stage }))
                        fail('SCHEMA_PLAYER_PUBLICATION_UNPROVEN');
                }
                check('before-event');
                await putExact(eventKey, event);
                check('after-event');
                if (event.outcome === 'accepted') {
                    check('before-head');
                    const prior = read(headKey);
                    if (!same(prior, plan.operation.base.currentHead)
                        && !(prior === undefined && isMvuSchemaGenesisHead(plan.operation.base.currentHead)))
                        fail('SCHEMA_PLAYER_BASE_CHANGED');
                    await putExact(headKey, head, prior);
                    check('after-head');
                }
                check('before-settlement');
                await putExact(mvuSchemaPlayerSettlementKey(sid, plan.planSha256), settlement);
                check('after-settlement');
                if (!verifySettlement(plan, settlement))
                    fail('SCHEMA_PLAYER_SETTLEMENT_UNCONFIRMED');
                return { kind: 'acknowledged', settlement };
            });
        }
        catch (error) {
            return { kind: spent ? 'unknown' : 'blocked', code: codeOf(error) };
        }
    }
    return { makePlan, publish, verifySettlement, verifyConsumed };
}
