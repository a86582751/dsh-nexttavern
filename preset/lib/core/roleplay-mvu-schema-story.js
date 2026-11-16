// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-story.ts; edit the TypeScript source.
/** Owns a single schema story transaction. Root supplies the actual closing
 * lease and execution owner; no Agent, model or maintenance dispatch lives here. */
import { recordSha256 } from './roleplay-data.js';
import { mvuStateCurrentHeadKey } from './roleplay-mvu-state.js';
import { createMvuNumericalPublicationOwner, mvuNumericalPublicationMatches } from './roleplay-mvu-numerical-publication.js';
import { validateSchemaEvaluationInputV4 } from './tavern-mvu-schema-runner-v4.js';
import { validateMvuScopeReadRefV2 } from './tavern-mvu-scope-view-v2.js';
import { schemaScopeReadFactsEqual } from './roleplay-mvu-schema-scope-facts.js';
import { freezeMvuSchemaStoryData, sealMvuSchemaStoryFact, validateMvuSchemaStoryPlan, validateMvuSchemaNumericalSnapshot, validateMvuSchemaStoryEvent, validateMvuSchemaStorySettlement, deriveMvuSchemaStorySelectors, mvuSchemaStoryPhaseInput, mvuSchemaStoryEvent, mvuSchemaStoryHead, mvuSchemaStorySettlement, mvuSchemaStoryEventKey, mvuSchemaStorySettlementKey, schemaStoryCode, schemaScopeReadRefFactsEqualV2, mvuSchemaStoryVariables, mvuSchemaStoryContextWrites, mvuSchemaStorySelector, mvuSchemaStoryExecutionId } from './roleplay-mvu-schema-story-types.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
const codeOf = (error) => schemaStoryCode(error instanceof Error ? error.message : undefined);
function fail(code) { throw Error(code); }
export function createMvu196StoryExecutionState(plan) {
    return { phases: [], hooks: [], finalizedMessage: plan.canonical.narrative };
}
function executionBrowser(state) {
    return state.hooks.length ? { schemaVersion: 1, hooks: state.hooks, finalizedMessage: state.finalizedMessage } : undefined;
}
/** Live Work and closing owners use this same advancement. The caller grants
 * each dispatch and retains the actual evidence across the ownership handoff. */
export async function advanceMvu196StoryExecution(plan, state, callbacks, stopAtNativeCommands = false) {
    const executionId = mvuSchemaStoryExecutionId(plan), sessionId = plan.schemaVersion === 14 ? plan.execution.sessionId : plan.base.sessionId;
    for (;;) {
        callbacks.check();
        const previous = state.phases.at(-1)?.output;
        if (previous?.kind === 'refused')
            return { kind: 'refused' };
        if (previous?.kind === 'accepted' && 'update' in previous) {
            if (previous.update?.kind === 'complete')
                return { kind: 'complete' };
            if (stopAtNativeCommands && previous.update?.kind === 'native-commands-ready')
                return { kind: 'native-commands-ready', progress: previous.update };
            if (previous.update?.kind === 'yield' && state.hooks.at(-1)?.request.yieldOrdinal !== previous.update.yieldOrdinal) {
                const progress = previous.update;
                const hook = await callbacks.executeHook?.({ sessionId, planSha256: executionId,
                    target: { kind: 'message', ownerSessionId: plan.base.sessionId, nativeSeq: plan.canonical.seq,
                        messageId: plan.canonical.messageId, messageVersionSha256: plan.canonical.versionSha256 },
                    stage: progress.stage, yieldOrdinal: progress.yieldOrdinal, payload: { graph: progress.graph } });
                callbacks.check();
                if (hook)
                    state.hooks.push(hook);
            }
        }
        const index = state.phases.length, interests = callbacks.readInterests(), browser = executionBrowser(state), input = mvuSchemaStoryPhaseInput(plan, index, state.phases, undefined, undefined, browser, interests);
        const result = await callbacks.executePhase(input);
        callbacks.check();
        if (result.kind !== 'completed')
            return { kind: 'unknown', code: schemaStoryCode(result.code) };
        if (!result.evidence || !result.capturedInput)
            fail('SCHEMA_STORY_EXECUTION_UNPROVEN');
        const actual = validateSchemaEvaluationInputV4(result.capturedInput), selector = mvuSchemaStorySelector(plan, index);
        if (plan.schemaVersion === 14) {
            if (actual.encoding !== 'native-mvu-author-schema-phase-input-v4'
                || !schemaScopeReadFactsEqual(actual.scopeReadFrame, plan.scopeReadFrame)
                || actual.scopeReadFrame.sourceNativeCutSha256 !== result.association.sourceNativeCutSha256)
                fail('SCHEMA_STORY_EXECUTION_UNPROVEN');
        }
        else if (actual.encoding !== 'native-mvu-author-schema-phase-input-v4-scope-ref-v2'
            || !schemaScopeReadRefFactsEqualV2(actual.scopeReadRef, plan.scopeReadRef)
            || actual.scopeReadRef.sourceNativeCutSha256 !== result.association.sourceNativeCutSha256)
            fail('SCHEMA_STORY_EXECUTION_UNPROVEN');
        if (result.association.batchId !== selector.batchId
            || !same(actual, mvuSchemaStoryPhaseInput(plan, index, state.phases, actual.scopeReadFrame, actual.scopeReadRef, browser, interests, undefined, actual.update?.encoding === 'native-mvu-196-update-start-v1' ? actual.update.macros : undefined)))
            fail('SCHEMA_STORY_EXECUTION_UNPROVEN');
        state.lastLive = result;
        state.phases.push(freezeMvuSchemaStoryData({ phase: 'update-core', input: actual,
            association: result.association, output: result.output }));
        if (result.output.kind === 'refused')
            return { kind: 'refused' };
        const progress = 'update' in result.output ? result.output.update : undefined;
        if (!progress || progress.updateId !== executionId)
            fail('SCHEMA_STORY_EXECUTION_UNPROVEN');
        if (progress.kind === 'complete')
            return { kind: 'complete' };
        if (progress.kind === 'native-commands-ready') {
            if (stopAtNativeCommands)
                return { kind: 'native-commands-ready', progress };
            continue;
        }
    }
}
export function createRoleplayMvuSchemaStory(deps) {
    const publicationOwner = createMvuNumericalPublicationOwner(deps.table);
    // A partial attempt is never retried in this owner. Remounts are gated by
    // Root's exact pending terminal ledger and journal, not this process-local set.
    const attempted = new Set();
    function makePlan(scope, canonical, base, currentFrame, realmEpoch, programSha256, initialCut, clockEpochMs = 0, executorVersion = 4, scopeReadFrame = undefined, hostEpoch, maintenance, scopeReadRef, executionStartData) {
        if (scopeReadFrame !== undefined)
            fail('SCHEMA_SCOPE_REFERENCE_REQUIRED');
        if (!hostEpoch)
            fail('SCHEMA_SCOPE_REFERENCE_HOST_REQUIRED');
        if (!scopeReadRef)
            fail('SCHEMA_SCOPE_READ_REQUIRED');
        let execution = { executorVersion, canonical, base: validateMvuSchemaNumericalSnapshot(base), currentFrame,
            realmEpoch, programSha256, initialCut, clockEpochMs, randomSeed: recordSha256({ scope, canonical }),
            selectors: deriveMvuSchemaStorySelectors(scope, canonical, realmEpoch), epoch: hostEpoch.epoch,
            serverProgramSha256: hostEpoch.serverProgramSha256, scopeReadRef: validateMvuScopeReadRefV2(scopeReadRef),
            ...hostEpoch.errorPolicy ? { errorPolicy: hostEpoch.errorPolicy } : {} };
        if (executionStartData) {
            const { start, ref } = executionStartData;
            if (ref.sha256 !== start.startSha256 || !same(scope.currency, start.work.currency)
                || !same(scope.receipt.checkpoint, start.work.checkpoint) || !same(canonical, start.canonical) || !same(base, start.base))
                fail('SCHEMA_STORY_START_CHANGED');
            const { schemaVersion: _version, encoding: _encoding, work: _work, startSha256: _hash, ...started } = start;
            execution = started;
        }
        return validateMvuSchemaStoryPlan(sealMvuSchemaStoryFact({ ...execution, schemaVersion: 13,
            encoding: 'native-mvu-196-story-plan-v1', scope, candidate: { schemaVersion: 1, kind: 'mvu-196' },
            ...maintenance ? { maintenance } : {}, ...executionStartData ? { executionStart: executionStartData.ref } : {} }, 'planSha256'));
    }
    function read(key) {
        const value = deps.table.get(key);
        return value === undefined ? undefined : freezeMvuSchemaStoryData(value);
    }
    /** Immutable event/settlement rows accept absence or the exact fact. The
     * shared numerical publication owner retains the complete mutable row CAS. */
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
            const actualHead = publicationOwner.read(plan.base.sessionId).raw;
            // An opening-only baseline has no current-head row. Refused/no-update
            // keep that absence; successful updates use the single shared head key.
            return mvuNumericalPublicationMatches(actualHead, facts.settlement.result.head);
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
            const publication = publicationOwner.read(plan.base.sessionId);
            if (!mvuNumericalPublicationMatches(publication.raw, plan.base.currentHead))
                fail('SCHEMA_STORY_BASE_CHANGED');
            const existing = deps.existingExecution?.(plan, closing);
            if (plan.executionStart && !existing)
                fail('SCHEMA_STORY_EXECUTION_START_UNAVAILABLE');
            const execution = existing ?? createMvu196StoryExecutionState(plan);
            spent = execution.phases.length > 0 || execution.hooks.length > 0;
            attempted.add(plan.planSha256);
            const check = () => { checkClosing(closing, scope, plan); checkBase(scope, plan); };
            const executeHook = deps.executeHook ? async (request) => {
                const previousSpent = spent;
                spent = true;
                const result = await deps.executeHook(plan, request, closing);
                if (!result)
                    spent = previousSpent;
                return result;
            } : undefined;
            const advanced = await advanceMvu196StoryExecution(plan, execution, { check,
                readInterests: () => deps.readHookInterests?.(plan, closing) ?? [],
                executePhase: input => {
                    spent = true;
                    return deps.executePhase(plan, 'update-core', input, closing);
                }, executeHook });
            if (advanced.kind === 'unknown')
                return advanced;
            if (advanced.kind === 'native-commands-ready')
                fail('SCHEMA_STORY_MAINTENANCE_UNRESOLVED');
            const lastLive = execution.lastLive;
            if (!lastLive)
                fail('SCHEMA_STORY_EXECUTION_UNPROVEN');
            if (lastLive.output.kind === 'accepted') {
                check();
                const output = lastLive.output, before = await executeHook?.({ sessionId: plan.base.sessionId,
                    planSha256: mvuSchemaStoryExecutionId(plan), stage: 'before-message-update',
                    target: { kind: 'message', ownerSessionId: plan.base.sessionId, nativeSeq: plan.canonical.seq,
                        messageId: plan.canonical.messageId, messageVersionSha256: plan.canonical.versionSha256 },
                    payload: { context: { variables: mvuSchemaStoryVariables(output.values, output.context), message_content: plan.canonical.narrative } } });
                check();
                if (before) {
                    execution.hooks.push(before);
                    if (before.result.stage === 'before-message-update')
                        execution.finalizedMessage = before.result.output.context.message_content;
                }
            }
            const phases = execution.phases, browser = () => executionBrowser(execution);
            return await deps.withPublicationBoundary(closing, lastLive, async () => {
                // Hooks may have completed ordinary writes. Freeze their actual fence
                // under the same publication lease that seals and publishes this event.
                const browserExecution = browser(), ordinaryScopes = deps.captureOrdinaryPublication?.(closing, plan, mvuSchemaStoryContextWrites(phases, browserExecution)), event = validateMvuSchemaStoryEvent(mvuSchemaStoryEvent(plan, phases, browserExecution, ordinaryScopes)), head = mvuSchemaStoryHead(event), settlement = mvuSchemaStorySettlement(event), eventKey = mvuSchemaStoryEventKey(event.sessionId, event.eventId), headKey = mvuStateCurrentHeadKey(event.sessionId), settlementKey = mvuSchemaStorySettlementKey(event.sessionId, plan.planSha256);
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
                    const advanced = await publicationOwner.advanceLeaf(publication, head);
                    if (advanced.kind === 'conflict')
                        fail('SCHEMA_STORY_BASE_CHANGED');
                    if (advanced.kind !== 'acknowledged')
                        fail('SCHEMA_STORY_WRITE_UNKNOWN');
                    check('after-head');
                    if (!mvuNumericalPublicationMatches(deps.table.get(headKey), head) || !same(read(eventKey), event))
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
