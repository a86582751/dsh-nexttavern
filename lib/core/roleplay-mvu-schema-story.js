// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-story.ts; edit the TypeScript source.
/** Owns a single schema story transaction. Root supplies the actual closing
 * lease and execution owner; no Agent, model or maintenance dispatch lives here. */
import { recordSha256 } from './roleplay-data.js';
import { parseMvuUpdate } from './roleplay-mvu-update.js';
import { parseMvuUpdateV2 } from './roleplay-mvu-update-v2.js';
import { mvuStateCurrentHeadKey } from './roleplay-mvu-state.js';
import { validateSchemaEvaluationInputV3 } from './tavern-mvu-schema-runner-v3.js';
import { validateSchemaEvaluationInputV4 } from './tavern-mvu-schema-runner-v4.js';
import { validateMvuScopeReadFrameV1 } from './tavern-mvu-scope-read.js';
import { schemaScopeReadFactsEqual } from './roleplay-mvu-schema-scope-facts.js';
import { freezeMvuSchemaStoryData, sealMvuSchemaStoryFact, validateMvuSchemaStoryPlan, validateMvuSchemaNumericalSnapshot, validateMvuSchemaStoryEvent, validateMvuSchemaStorySettlement, deriveMvuSchemaStorySelectors, mvuSchemaStoryPhaseInput, mvuSchemaStoryReducerBridge, mvuSchemaStoryEvent, mvuSchemaStoryHead, mvuSchemaStorySettlement, mvuSchemaStoryEventKey, mvuSchemaStorySettlementKey, MVU_SCHEMA_STORY_PHASES, schemaStoryCode, isMvuSchemaGenesisHead } from './roleplay-mvu-schema-story-types.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
const codeOf = (error) => schemaStoryCode(error instanceof Error ? error.message : undefined);
function fail(code) { throw Error(code); }
export function createRoleplayMvuSchemaStory(deps) {
    // A partial attempt is never retried in this owner. Remounts are gated by
    // Root's exact pending terminal ledger and journal, not this process-local set.
    const attempted = new Set();
    function makePlan(scope, canonical, base, currentFrame, realmEpoch, programSha256, initialCut, clockEpochMs = 0, executorVersion = 1, scopeReadFrame, hostEpoch) {
        const input = freezeMvuSchemaStoryData({ scope, canonical, base, currentFrame, realmEpoch, programSha256, initialCut, clockEpochMs });
        scope = input.scope;
        canonical = input.canonical;
        base = input.base;
        currentFrame = input.currentFrame;
        realmEpoch = input.realmEpoch;
        programSha256 = input.programSha256;
        initialCut = input.initialCut;
        clockEpochMs = input.clockEpochMs;
        if (![1, 2, 3, 4].includes(executorVersion))
            fail('SCHEMA_EXECUTOR_VERSION_MISMATCH');
        if (executorVersion >= 3 && !scopeReadFrame)
            fail('SCHEMA_SCOPE_READ_REQUIRED');
        if (hostEpoch && executorVersion !== 4)
            fail('SCHEMA_EXECUTOR_VERSION_MISMATCH');
        const suffix = { currentFrame, realmEpoch, programSha256, initialCut, clockEpochMs, randomSeed: recordSha256({ scope, canonical }),
            selectors: deriveMvuSchemaStorySelectors(scope, canonical, realmEpoch) };
        const body = executorVersion === 1 ? freezeMvuSchemaStoryData({ schemaVersion: 2,
            encoding: 'native-mvu-schema-story-plan-v2', scope, canonical, base: validateMvuSchemaNumericalSnapshot(base),
            candidate: parseMvuUpdate(canonical.narrative), ...suffix }) : executorVersion === 2 ? freezeMvuSchemaStoryData({ schemaVersion: 3,
            encoding: 'native-mvu-schema-story-plan-v3', executorVersion: 2, scope, canonical,
            base: validateMvuSchemaNumericalSnapshot(base), candidate: parseMvuUpdateV2(canonical.narrative), ...suffix }) : executorVersion === 4 ?
            freezeMvuSchemaStoryData({
                ...(hostEpoch ? { schemaVersion: 6, encoding: 'native-mvu-schema-story-plan-v6',
                    epoch: hostEpoch.epoch, serverProgramSha256: hostEpoch.serverProgramSha256 } :
                    { schemaVersion: 5, encoding: 'native-mvu-schema-story-plan-v5' }),
                executorVersion: 4, scope, canonical, base: validateMvuSchemaNumericalSnapshot(base),
                candidate: parseMvuUpdateV2(canonical.narrative), scopeReadFrame: validateMvuScopeReadFrameV1(scopeReadFrame), ...suffix
            }) :
            freezeMvuSchemaStoryData({ schemaVersion: 4, encoding: 'native-mvu-schema-story-plan-v4',
                executorVersion: 3, scope, canonical, base: validateMvuSchemaNumericalSnapshot(base),
                candidate: parseMvuUpdateV2(canonical.narrative), scopeReadFrame: validateMvuScopeReadFrameV1(scopeReadFrame), ...suffix });
        return validateMvuSchemaStoryPlan(sealMvuSchemaStoryFact(body, 'planSha256'));
    }
    function read(key) {
        const value = deps.table.get(key);
        return value === undefined ? undefined : freezeMvuSchemaStoryData(value);
    }
    /** Immutable event/settlement rows accept absence or the exact fact; the
     * numerical head accepts only its exact original CAS or the same next head. */
    async function putExact(key, next, prior) {
        const value = freezeMvuSchemaStoryData(next), actual = read(key);
        if (!same(actual, prior) && !same(actual, value))
            fail('SCHEMA_STORY_IDENTITY_CONFLICT');
        if (!same(actual, value))
            try {
                await deps.table.put(key, value);
            }
            catch { /* A lost ACK can only be resolved by exact readback. */ }
        if (!same(read(key), value))
            fail('SCHEMA_STORY_WRITE_UNKNOWN');
    }
    function checkClosing(closing, scope, plan) {
        if (!deps.closingCurrent(closing, scope, plan))
            fail('SCHEMA_STORY_PERMISSION_REVOKED');
    }
    function checkBase(scope, plan) {
        const ready = deps.readReady(scope, plan);
        if (ready.kind !== 'ready')
            fail(schemaStoryCode(ready.code));
        if (!same(validateMvuSchemaNumericalSnapshot(ready.snapshot), plan.base))
            fail('SCHEMA_STORY_BASE_CHANGED');
    }
    function storedFacts(plan, settlement) {
        try {
            const supplied = freezeMvuSchemaStoryData(settlement);
            const expectedEventId = recordSha256({ encoding: 'native-mvu-schema-story-event-identity-v2', planSha256: plan.planSha256 });
            if (supplied.event.key !== mvuSchemaStoryEventKey(plan.base.sessionId, expectedEventId))
                return;
            const event = validateMvuSchemaStoryEvent(read(supplied.event.key));
            const actual = validateMvuSchemaStorySettlement(supplied, event);
            if (!same(event.plan, plan) || !same(read(mvuSchemaStorySettlementKey(plan.base.sessionId, plan.planSha256)), actual))
                return;
            return { event, settlement: actual };
        }
        catch {
            return;
        }
    }
    function verifyConsumed(scope, suppliedPlan, settlement) {
        try {
            const plan = validateMvuSchemaStoryPlan(suppliedPlan);
            return same(scope, plan.scope) && !!storedFacts(plan, settlement);
        }
        catch {
            return false;
        }
    }
    function verifySettlement(scope, suppliedPlan, settlement) {
        try {
            const plan = validateMvuSchemaStoryPlan(suppliedPlan), facts = storedFacts(plan, settlement);
            if (!same(scope, plan.scope) || !facts)
                return false;
            const actualHead = read(mvuStateCurrentHeadKey(plan.base.sessionId));
            // An opening-only baseline has no current-head row. Refused/no-update
            // keep that absence; successful updates use the single shared head key.
            return facts.settlement.outcome === 'accepted' ? same(actualHead, facts.settlement.result.head) :
                actualHead === undefined && isMvuSchemaGenesisHead(plan.base.currentHead)
                    || same(actualHead, facts.settlement.result.head);
        }
        catch {
            return false;
        }
    }
    async function publish(scope, suppliedPlan, closing) {
        let spent = false, plan;
        try {
            plan = validateMvuSchemaStoryPlan(suppliedPlan);
            if (!same(scope, plan.scope))
                fail('SCHEMA_STORY_SCOPE_CHANGED');
            checkClosing(closing, scope, plan);
            if (attempted.has(plan.planSha256))
                fail('SCHEMA_STORY_ALREADY_ATTEMPTED');
            if (read(mvuSchemaStorySettlementKey(plan.base.sessionId, plan.planSha256)) !== undefined)
                fail('SCHEMA_STORY_ALREADY_ATTEMPTED');
            const eventId = recordSha256({ encoding: 'native-mvu-schema-story-event-identity-v2', planSha256: plan.planSha256 });
            if (read(mvuSchemaStoryEventKey(plan.base.sessionId, eventId)) !== undefined)
                fail('SCHEMA_STORY_ALREADY_ATTEMPTED');
            checkBase(scope, plan);
            if (plan.candidate.kind === 'rejected')
                fail('SCHEMA_STORY_CANDIDATE_REJECTED');
            attempted.add(plan.planSha256);
            const phases = [];
            let reducer = null, lastLive;
            for (const [index, phase] of MVU_SCHEMA_STORY_PHASES.entries()) {
                checkClosing(closing, scope, plan);
                checkBase(scope, plan);
                const input = mvuSchemaStoryPhaseInput(plan, index, phases, reducer);
                // Spending is recorded before await: a cancellation/throw after actual
                // dispatch must keep the original anchor and never become a refusal.
                spent = true;
                const result = await deps.executePhase(plan, phase, input, closing);
                checkClosing(closing, scope, plan);
                if (result.kind !== 'completed')
                    return { kind: 'unknown', code: schemaStoryCode(result.code) };
                if (!result.evidence || typeof result.evidence !== 'object')
                    fail('SCHEMA_STORY_EXECUTION_UNPROVEN');
                let capturedInput = input;
                if (plan.schemaVersion === 4 || plan.schemaVersion === 5 || plan.schemaVersion === 6) {
                    if (!result.capturedInput)
                        fail('SCHEMA_STORY_EXECUTION_UNPROVEN');
                    const actual = plan.executorVersion === 4 ? validateSchemaEvaluationInputV4(result.capturedInput)
                        : validateSchemaEvaluationInputV3(result.capturedInput);
                    if (!schemaScopeReadFactsEqual(actual.scopeReadFrame, plan.scopeReadFrame)
                        || actual.scopeReadFrame.sourceNativeCutSha256 !== result.association.sourceNativeCutSha256
                        || !same(actual, mvuSchemaStoryPhaseInput(plan, index, phases, reducer, actual.scopeReadFrame))) {
                        fail('SCHEMA_STORY_EXECUTION_UNPROVEN');
                    }
                    capturedInput = actual;
                }
                // The private evidence is kept only in this invocation. Durable phase
                // facts contain its association/output, never the evidence object.
                lastLive = result;
                phases.push(freezeMvuSchemaStoryData({ phase, input: capturedInput, association: result.association, output: result.output }));
                if (result.output.kind === 'refused')
                    break;
                if (index === 0) {
                    reducer = mvuSchemaStoryReducerBridge(phases[0]);
                    if (reducer.result.kind === 'rejected')
                        break;
                }
            }
            if (!lastLive)
                fail('SCHEMA_STORY_EXECUTION_UNPROVEN');
            const event = validateMvuSchemaStoryEvent(mvuSchemaStoryEvent(plan, phases, reducer));
            const head = mvuSchemaStoryHead(event), settlement = mvuSchemaStorySettlement(event);
            const eventKey = mvuSchemaStoryEventKey(event.sessionId, event.eventId);
            const headKey = mvuStateCurrentHeadKey(event.sessionId);
            const settlementKey = mvuSchemaStorySettlementKey(event.sessionId, plan.planSha256);
            return await deps.withPublicationBoundary(closing, lastLive, async () => {
                function check(stage) {
                    checkClosing(closing, scope, plan);
                    if (!deps.checkPublication(closing, lastLive, { plan, event, head, settlement, stage }))
                        fail('SCHEMA_STORY_PUBLICATION_UNPROVEN');
                }
                check('before-event');
                await putExact(eventKey, event);
                check('after-event');
                if (!same(read(eventKey), event))
                    fail('SCHEMA_STORY_WRITE_UNKNOWN');
                if (event.outcome === 'accepted') {
                    check('before-head');
                    const prior = read(headKey);
                    if (!same(prior, plan.base.currentHead)
                        && !(prior === undefined && isMvuSchemaGenesisHead(plan.base.currentHead)))
                        fail('SCHEMA_STORY_BASE_CHANGED');
                    await putExact(headKey, head, prior);
                    check('after-head');
                    if (!same(read(headKey), head) || !same(read(eventKey), event))
                        fail('SCHEMA_STORY_WRITE_UNKNOWN');
                }
                check('before-settlement');
                await putExact(settlementKey, settlement);
                check('after-settlement');
                if (!verifySettlement(scope, plan, settlement))
                    fail('SCHEMA_STORY_SETTLEMENT_UNCONFIRMED');
                return { kind: 'acknowledged', settlement };
            });
        }
        catch (error) {
            return { kind: spent ? 'unknown' : 'blocked', code: codeOf(error) };
        }
    }
    return { makePlan, publish, verifySettlement, verifyConsumed };
}
