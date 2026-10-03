// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-history-tail.ts; edit the TypeScript source.
/** Read-only proof of completed Guest pairs that have no fully consumed
 * numerical publication. A verified tail remains unpublished: this module
 * owns no execution lease, scope state, head, reconciliation or owner ACK. */
import { recordSha256, textOf } from './roleplay-data.js';
import { canonicalAssistantForTurn } from './roleplay-context.js';
import { inputCompletionKey } from './roleplay-input-completion.js';
import { readMvuSchemaUnpublishedStoryPlanFacts } from './roleplay-mvu-schema-prefix-facts.js';
import { validateSchemaJournalRecord, validateSchemaSourceCut, schemaJournalKey } from './roleplay-mvu-schema-journal.js';
import { validateSchemaEvaluationInputV2, validateSchemaGuestOutputV2 } from './tavern-mvu-schema-runner-v2.js';
import { validateSchemaEvaluationInputV3, validateSchemaGuestOutputV3 } from './tavern-mvu-schema-runner-v3.js';
import { validateSchemaEvaluationInputV4, validateSchemaGuestOutputForProgramV4 } from './tavern-mvu-schema-runner-v4.js';
import { validateSchemaProgramV4 } from './tavern-mvu-schema-program-v4.js';
import { sealMvuSchemaStoryFact, validateMvuSchemaNumericalSnapshot, validateMvuSchemaStoryPlan, mvuSchemaStoryPhaseInput, mvuSchemaStoryReducerBridge, mvuSchemaStoryEvent, mvuSchemaStoryEventKey, mvuSchemaStorySettlement, mvuSchemaStorySettlementKey, validateMvuSchemaStoryEvent, validateMvuSchemaStorySettlement, MVU_SCHEMA_STORY_PHASES } from './roleplay-mvu-schema-story-types.js';
import { validateMvuSchemaPlayerPlan, readMvuSchemaPlayerPlanFacts, mvuSchemaPlayerPlanKey, mvuSchemaPlayerPhaseInput, mvuSchemaPlayerReducerBridge, mvuSchemaPlayerEvent, mvuSchemaPlayerEventKey, mvuSchemaPlayerSettlement, mvuSchemaPlayerSettlementKey, mvuSchemaPlayerCompletionKey, validateMvuSchemaPlayerEvent, validateMvuSchemaPlayerSettlement, validateMvuSchemaPlayerCompletion, MVU_SCHEMA_PLAYER_PHASES } from './roleplay-mvu-schema-player-types.js';
const same = (left, right) => recordSha256(left) === recordSha256(right);
const integer = (value, min = 0) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= min && !Object.is(value, -0);
function fail() { throw Error('SCHEMA_HISTORICAL_TAIL_UNPROVEN'); }
/** Candidate discovery only reads own data fields. Full bounded validators
 * run after the realm filter; unrelated valid realms are not revalidated. */
function own(input, key) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        return undefined;
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (!field)
        return undefined;
    if (!('value' in field) || !field.enumerable)
        fail();
    return field.value;
}
function baseOf(candidate) {
    return candidate.kind === 'story' ? candidate.plan.base : candidate.plan.operation.base;
}
function versionOf(candidate) {
    return candidate.kind === 'story' ? candidate.plan.schemaVersion === 2 ? 1 : candidate.plan.executorVersion
        : candidate.plan.schemaVersion === 1 ? 1 : candidate.plan.executorVersion;
}
function candidatePlans(request, deps, first) {
    const sid = request.sessionId, realm = request.ready.epoch.realmEpoch, result = [];
    const terminalPrefix = `${sid}__native-input-v2-terminal-`, playerPrefix = `${sid}__mvu-schema-player-plan-`;
    for (const [key, row] of deps.branch.entries()) {
        let kind, raw;
        if (key.startsWith(terminalPrefix)) {
            const wrapper = own(row, 'plan');
            if (own(wrapper, 'kind') !== 'schema-numerical')
                continue;
            kind = 'story';
            raw = own(wrapper, 'plan');
        }
        else if (key.startsWith(playerPrefix)) {
            kind = 'player';
            raw = row;
        }
        else
            continue;
        const rowRealm = own(raw, 'realmEpoch');
        if (typeof rowRealm !== 'string')
            fail();
        if (rowRealm !== realm)
            continue;
        const initialCut = own(raw, 'initialCut'), nativeCut = own(initialCut, 'nativeCut');
        // A later durable plan cannot contaminate an earlier frozen Native view.
        // Its bytes are intentionally not validated using this selected prefix.
        if (integer(nativeCut) && nativeCut > request.events.length)
            continue;
        const plan = kind === 'story' ? validateMvuSchemaStoryPlan(raw)
            : validateMvuSchemaPlayerPlan(raw);
        const candidate = kind === 'story' ? { kind, plan: plan, key }
            : { kind, plan: plan, key };
        const expected = kind === 'story' ? inputCompletionKey(sid, plan.scope.currency.preparationId)
            : mvuSchemaPlayerPlanKey(sid, plan.operation.operationId);
        if (key !== expected || baseOf(candidate).sessionId !== sid)
            fail();
        // Earlier completed plans are Root's responsibility. Any same-realm plan
        // touching or following this Native tail competes for its single owner.
        if (plan.initialCut.nativeCut >= first.dispatchMarker.seq
            || plan.selectors.some(selector => selector.batchId === first.dispatch.batchId))
            result.push(candidate);
    }
    return result;
}
function proveCut(request, cutInput, initial, frame, selector, seq) {
    const cut = validateSchemaSourceCut(cutInput);
    if (cut.sessionId !== request.sessionId || cut.ownerSessionId !== request.sessionId || cut.nativeCut !== seq
        || seq < request.inheritedEventCount || seq > request.events.length
        || cut.nativePrefixSha256 !== recordSha256(request.events.slice(0, seq))
        || cut.sourceSnapshotSha256 !== frame.snapshotSha256 || cut.materialSha256 !== frame.materialSha256
        || cut.stopGeneration !== initial.stopGeneration || !same(cut.anchor, selector.anchor))
        fail();
}
function provePair(request, deps, candidate, index, step) {
    const plan = candidate.plan, selector = plan.selectors[index], seq = plan.initialCut.nativeCut + index * 2;
    if (!selector || selector.sessionId !== request.sessionId
        || step.dispatch.sessionId !== request.sessionId || step.completion.sessionId !== request.sessionId
        || step.dispatch.realmEpoch !== plan.realmEpoch || step.completion.realmEpoch !== plan.realmEpoch
        || step.dispatch.batchId !== selector.batchId || step.completion.batchId !== selector.batchId
        || step.dispatchMarker.seq !== seq || step.completionMarker.seq !== seq + 1)
        fail();
    validateSchemaJournalRecord(step.dispatch);
    validateSchemaJournalRecord(step.completion);
    const version = versionOf(candidate);
    if (step.dispatch.schemaVersion !== version || step.completion.schemaVersion !== version
        || step.step.frame.input.schemaVersion !== version || !same(step.completion.runner, request.ready.epoch.runner)
        || !same(step.dispatchRef, { key: schemaJournalKey(step.dispatch), sha256: step.dispatch.recordSha256 })
        || !same(step.completion.dispatch, step.dispatchRef) || !same(step.dispatch.epoch, request.ready.epochRef)
        || !same(step.completionRef, { key: schemaJournalKey(step.completion), sha256: step.completion.recordSha256 })
        || !same(step.completion.dispatchMarker, step.dispatchMarker)
        || step.dispatch.ordinal !== request.ordinal + index + 1 || step.step.ordinal !== request.ordinal + index + 1
        || step.completion.step.frameSha256 !== recordSha256(step.step.frame)
        || !same(step.step.frame, step.dispatch.requestedStep.frame)
        || step.step.eventId !== selector.batchId || step.step.eventId !== step.dispatch.requestedStep.eventId
        || !same(step.step.output, step.completion.step.output))
        fail();
    const previous = index === 0 ? request.snapshot.schemaFrontier.tailSha256
        : request.ready.steps[request.ordinal + index - 1].step.stepSha256;
    const { stepSha256, ...stepBody } = step.step;
    if (step.step.previousStepSha256 !== previous || step.dispatch.previousTailSha256 !== previous
        || stepSha256 !== recordSha256(stepBody))
        fail();
    const { frame, ...receipt } = step.step;
    if (!same({ ...receipt, frameSha256: recordSha256(frame) }, step.completion.step))
        fail();
    for (const marker of [step.dispatchMarker, step.completionMarker]) {
        const native = request.events[marker.seq];
        if (!native || native.seq !== marker.seq || recordSha256(native) !== marker.sha256)
            fail();
    }
    if (request.events[seq]?.type !== 'roleplay/mvu-schema-dispatched'
        || request.events[seq + 1]?.type !== 'roleplay/mvu-schema-completed')
        fail();
    proveCut(request, step.dispatch.sourceNativeCut, plan.initialCut, plan.currentFrame, selector, seq);
    if (index === 0 && !same(step.dispatch.sourceNativeCut, plan.initialCut)
        || step.step.frame.ownerSessionId !== request.sessionId
        || step.step.frame.sourceNativeCutSha256 !== recordSha256(step.dispatch.sourceNativeCut)
        || !same(step.step.frame.material, plan.currentFrame.material))
        fail();
    const association = deps.associationAt(request.ordinal + index);
    if (association.sessionId !== request.sessionId || association.realmEpoch !== plan.realmEpoch
        || association.batchId !== selector.batchId || association.programSha256 !== plan.programSha256
        || !same(association.anchor, selector.anchor) || !same(association.dispatch, step.dispatchRef)
        || !same(association.completion, step.completionRef) || !same(association.dispatchMarker, step.dispatchMarker)
        || !same(association.completionMarker, step.completionMarker)
        || association.sourceNativeCutSha256 !== recordSha256(step.dispatch.sourceNativeCut)
        || association.tailSha256 !== step.step.stepSha256 || association.outputSha256 !== recordSha256(step.step.output))
        fail();
    return association;
}
function proveOutput(input, output, program) {
    if (input.schemaVersion === 4)
        validateSchemaGuestOutputForProgramV4(output, validateSchemaProgramV4(program), validateSchemaEvaluationInputV4(input));
    else if (input.schemaVersion === 3)
        validateSchemaGuestOutputV3(output, validateSchemaEvaluationInputV3(input));
    else if (input.schemaVersion === 2)
        validateSchemaGuestOutputV2(output, validateSchemaEvaluationInputV2(input));
    // V1's closed output shape was checked by validateSchemaJournalRecord.
}
function storyPublication(candidate, facts, phases, reducer, deps, selectedCut) {
    const plan = candidate.plan, sid = plan.base.sessionId;
    const eventId = recordSha256({ encoding: 'native-mvu-schema-story-event-identity-v2', planSha256: plan.planSha256 });
    const rawEvent = deps.status.get(mvuSchemaStoryEventKey(sid, eventId));
    const rawSettlement = deps.status.get(mvuSchemaStorySettlementKey(sid, plan.planSha256));
    const embedded = facts.terminal.settlement;
    if (rawEvent === undefined && rawSettlement === undefined && embedded === undefined)
        return;
    if (rawEvent === undefined)
        fail();
    const event = validateMvuSchemaStoryEvent(rawEvent);
    if (!same(event.plan, plan))
        fail();
    const settlement = mvuSchemaStorySettlement(event);
    if (rawSettlement !== undefined && !same(validateMvuSchemaStorySettlement(rawSettlement, event), settlement))
        fail();
    if (embedded !== undefined && !same(validateMvuSchemaStorySettlement(embedded, event), settlement))
        fail();
    // A later legal closure does not change what was completed at this Native
    // selector. Never compare its additional phases to this earlier tail.
    if (event.frontier.nativeCut > selectedCut)
        return;
    // A partial accepted prefix is not a final event. Existing descriptors may
    // be absent, but a settlement/ACK cannot float without its actual event.
    const expected = validateMvuSchemaStoryEvent(mvuSchemaStoryEvent(plan, phases, reducer));
    if (!same(event, expected))
        fail();
    if (embedded !== undefined) {
        if (rawSettlement === undefined)
            fail();
    }
}
function playerPublication(candidate, phases, deps, selectedCut) {
    const plan = candidate.plan, sid = plan.operation.sessionId, opid = plan.operation.operationId;
    const eventId = recordSha256({ encoding: 'native-mvu-schema-player-event-identity-v1', planSha256: plan.planSha256 });
    const rawEvent = deps.status.get(mvuSchemaPlayerEventKey(sid, eventId));
    const rawSettlement = deps.status.get(mvuSchemaPlayerSettlementKey(sid, plan.planSha256));
    const rawCompletion = deps.branch.get(mvuSchemaPlayerCompletionKey(sid, opid));
    if (rawEvent === undefined && rawSettlement === undefined && rawCompletion === undefined)
        return;
    if (rawEvent === undefined)
        fail();
    const event = validateMvuSchemaPlayerEvent(rawEvent);
    if (!same(event.plan, plan))
        fail();
    const settlement = mvuSchemaPlayerSettlement(event);
    if (rawSettlement !== undefined && !same(validateMvuSchemaPlayerSettlement(rawSettlement, event), settlement))
        fail();
    if (rawCompletion !== undefined) {
        if (rawSettlement === undefined)
            fail();
        validateMvuSchemaPlayerCompletion(rawCompletion, plan, settlement);
    }
    if (event.frontier.nativeCut > selectedCut)
        return;
    const expected = validateMvuSchemaPlayerEvent(mvuSchemaPlayerEvent(plan, phases));
    if (!same(event, expected))
        fail();
}
export function verifyMvuSchemaUnpublishedTail(request, deps) {
    try {
        const { sessionId: sid, events, ready, ordinal, original } = request;
        if (typeof sid !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(sid) || !integer(request.inheritedEventCount)
            || !Array.isArray(events) || events.length > 100000 || request.inheritedEventCount > events.length
            || events.some((event, index) => !event || event.seq !== index || typeof event.type !== 'string')
            || ready.kind !== 'ready' || !integer(ordinal) || ordinal > ready.steps.length)
            fail();
        const snapshot = validateMvuSchemaNumericalSnapshot(request.snapshot);
        if (snapshot.sessionId !== sid)
            fail();
        if (ordinal === ready.steps.length)
            return;
        const first = ready.steps[ordinal], candidates = candidatePlans(request, deps, first);
        if (candidates.length !== 1)
            fail();
        const candidate = candidates[0], plan = candidate.plan, base = baseOf(candidate), version = versionOf(candidate);
        const { stateSnapshotSha256: _old, ...basis } = snapshot;
        const comparable = validateMvuSchemaNumericalSnapshot(sealMvuSchemaStoryFact({ ...basis, sourceSha256: base.sourceSha256 }, 'stateSnapshotSha256'));
        if (!same(base, comparable) || plan.initialCut.nativeCut !== first.dispatchMarker.seq
            || plan.realmEpoch !== original.realmEpoch || plan.programSha256 !== original.programSha256
            || plan.realmEpoch !== ready.epoch.realmEpoch || plan.programSha256 !== ready.epoch.program.programSha256
            || ready.epoch.schemaVersion !== version || ready.epoch.program.compiler.version !== version
            || ready.epoch.program.bridge.version !== version || ready.epoch.runner.version !== version
            || !deps.verifyFrozenFrame(original, plan.currentFrame))
            fail();
        if (original.preparation.schemaVersion !== 1 && !same(original.preparation.executor, { compiler: ready.epoch.program.compiler, bridge: ready.epoch.program.bridge,
            libraries: ready.epoch.program.libraries, runner: ready.epoch.runner }))
            fail();
        proveCut(request, plan.initialCut, plan.initialCut, plan.currentFrame, plan.selectors[0], first.dispatchMarker.seq);
        if (version >= 3 && (!('scopeReadFrame' in plan)
            || !same(plan.scopeReadFrame, deps.scopeFrameAt(plan.currentFrame, plan.initialCut))))
            fail();
        let storyFacts;
        if (candidate.kind === 'story') {
            storyFacts = readMvuSchemaUnpublishedStoryPlanFacts({ ownerSessionId: sid,
                ownerInheritedEventCount: request.inheritedEventCount, events, plan: candidate.plan }, { branch: deps.branch, status: deps.status, editProtocol: deps.editProtocol,
                readProjectedCanonical: (prefix, turn) => {
                    const surface = deps.projectPrefix(prefix);
                    const body = canonicalAssistantForTurn({ id: sid, events: prefix, surface: { nodes: surface.nodes },
                        deriveEventMessage: entry => surface.projectedMessageAt(entry.seq) }, turn);
                    const message = body?.data?.message;
                    return body && message && typeof message.id === 'string' ? { seq: body.seq, messageId: message.id,
                        versionSha256: recordSha256(message), narrative: textOf(message.content) } : undefined;
                } });
            if (candidate.plan.candidate.kind === 'rejected')
                fail();
        }
        else {
            const facts = readMvuSchemaPlayerPlanFacts(deps.branch, deps.status, candidate.plan.operation, events);
            if (!same(facts.plan, candidate.plan) || facts.marker.seq < request.inheritedEventCount)
                fail();
        }
        const remaining = ready.steps.slice(ordinal);
        if (remaining.length > plan.selectors.length)
            fail();
        const storyPhases = [], playerPhases = [];
        let reducer = null, terminated = false;
        for (const [index, step] of remaining.entries()) {
            if (terminated)
                fail();
            const association = provePair(request, deps, candidate, index, step);
            const read = version >= 3 ? deps.scopeFrameAt(plan.currentFrame, step.dispatch.sourceNativeCut) : undefined;
            const input = candidate.kind === 'story' ? mvuSchemaStoryPhaseInput(candidate.plan, index, storyPhases, reducer, read)
                : mvuSchemaPlayerPhaseInput(candidate.plan, index, playerPhases, read);
            if (!same(input, step.step.frame.input))
                fail();
            proveOutput(input, step.step.output, ready.epoch.program);
            if (candidate.kind === 'story') {
                const phase = { phase: MVU_SCHEMA_STORY_PHASES[index], input,
                    association, output: step.step.output };
                storyPhases.push(phase);
                terminated = phase.output.kind === 'refused';
                if (index === 0 && !terminated) {
                    reducer = mvuSchemaStoryReducerBridge(phase);
                    terminated = reducer.result.kind === 'rejected';
                }
            }
            else {
                const phase = { phase: MVU_SCHEMA_PLAYER_PHASES[index], input,
                    association, output: step.step.output };
                playerPhases.push(phase);
                terminated = phase.output.kind === 'refused' || phase.output.commands.length > 0;
                if (index === 1 && !terminated)
                    terminated = mvuSchemaPlayerReducerBridge(phase).result.kind === 'rejected';
            }
        }
        if (candidate.kind === 'story')
            storyPublication(candidate, storyFacts, storyPhases, reducer, deps, events.length);
        else
            playerPublication(candidate, playerPhases, deps, events.length);
        // Success deliberately returns no snapshot, head, scopes or writable
        // evidence. The caller retains the previously published numerical state.
    }
    catch {
        return fail();
    }
}
