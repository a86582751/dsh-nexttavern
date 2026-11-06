// Generated from runtime/alpha3/src/core/roleplay-opening-variant-types.ts; edit the TypeScript source.
/** Opening packs retain their author metadata independently from the actual
 * schema closure. Only a completed canonical phase advances numerical state. */
import { recordSha256 } from './roleplay-data.js';
import { freezeMvuSchemaStoryData, sealMvuSchemaStoryFact, validateMvuSchemaNumericalSnapshot } from './roleplay-mvu-schema-story-types.js';
import { createImmutableDescriptorValidator } from './roleplay-mvu-schema-descriptor-data.js';
import { validateSchemaSourceCut } from './roleplay-mvu-schema-journal.js';
import { validateSchemaStorySourceFrame } from './roleplay-mvu-schema-source.js';
import { validateSchemaEvaluationInputV4, validateSchemaGuestOutputV4 } from './tavern-mvu-schema-runner-v4.js';
import { schemaExecutionServerTailSha256, schemaExecutionHostFrontierSha256 } from './roleplay-mvu-schema-replay.js';
const same = (left, right) => left === right || recordSha256(left) === recordSha256(right);
const fail = () => { throw Error('OPENING_VARIANT_REPLACEMENT_INVALID'); };
export const openingVariantSetKey = (sid, sha256) => `${sid}__opening-variant-set-${sha256}`;
export const openingVariantReplacementPlanKey = (sid, id) => `${sid}__opening-variant-plan-${id}`;
export const openingVariantReplacementEventKey = (sid, id) => `${sid}__mvu-state-schema-opening-variant-event-${id}`;
export const openingVariantReplacementCompletionKey = (sid, id) => `${sid}__opening-variant-completion-${id}`;
export const openingVariantPendingKey = (sid) => `${sid}__opening-variant-pending`;
export const validateOpeningVariantSet = createImmutableDescriptorValidator((input) => {
    const set = freezeMvuSchemaStoryData(input), { setSha256, ...body } = set;
    if (set.schemaVersion !== 1 || set.encoding !== 'native-opening-variant-set-v1' || recordSha256(body) !== setSha256)
        fail();
    return set;
});
export function openingVariantReplacementSelector(plan) {
    return { sessionId: plan.sessionId, batchId: 'opening-pack-' + plan.planSha256, anchor: plan.initialCut.anchor };
}
const validatePlan = createImmutableDescriptorValidator((input) => {
    const plan = freezeMvuSchemaStoryData(input), { planSha256, ...body } = plan;
    const base = validateMvuSchemaNumericalSnapshot(plan.base), cut = validateSchemaSourceCut(plan.initialCut), phase = validateSchemaEvaluationInputV4(plan.input);
    validateSchemaStorySourceFrame(plan.currentFrame);
    if (plan.schemaVersion !== 1 || plan.encoding !== 'native-opening-variant-replacement-plan-v1'
        || recordSha256(body) !== planSha256 || plan.sessionId !== base.sessionId
        || plan.realmEpoch !== base.root.realmEpoch || plan.programSha256 !== base.root.programSha256
        || cut.sessionId !== plan.sessionId || cut.ownerSessionId !== plan.sessionId
        || plan.currentFrame.sessionId !== plan.sessionId || cut.nativeCut < base.schemaFrontier.nativeCut
        || cut.sourceSnapshotSha256 !== plan.currentFrame.snapshotSha256
        || cut.materialSha256 !== plan.currentFrame.materialSha256 || cut.anchor.kind !== 'manual'
        || cut.anchor.operationId !== plan.operationId || cut.anchor.requestSha256 !== plan.requestSha256
        || cut.anchor.observedNativeSeq !== cut.nativeCut - 1 || phase.phase !== 'external-pack-replacement'
        || phase.commands.length || !same(phase.base, base.values))
        fail();
    const scope = phase.scopeReadRef ?? phase.scopeReadFrame;
    if (scope.sourceNativeCutSha256 !== recordSha256(cut))
        fail();
    return plan;
});
export const validateOpeningVariantReplacementPlan = validatePlan;
export function openingVariantReplacementHead(event) {
    return { schemaVersion: 1, encoding: 'native-mvu-opening-variant-head-v1', sessionId: event.sessionId,
        sourceSha256: event.sourceSha256, root: event.plan.base.root, revision: event.revision, eventId: event.eventId,
        eventSha256: event.eventSha256, planSha256: event.plan.planSha256, valuesSha256: event.valuesSha256 };
}
export function openingVariantReplacementCompletion(event) {
    return sealMvuSchemaStoryFact({ schemaVersion: 1, encoding: 'native-opening-variant-replacement-completion-v1',
        sessionId: event.sessionId, operationId: event.plan.operationId, planSha256: event.plan.planSha256,
        event: { key: openingVariantReplacementEventKey(event.sessionId, event.eventId), sha256: recordSha256(event) },
        setRef: event.plan.setRef, activeVariantId: event.plan.activeVariantId }, 'completionSha256');
}
export function openingVariantReplacementEvent(plan, phase) {
    const output = phase.output, association = phase.association;
    return sealMvuSchemaStoryFact({ schemaVersion: 1, encoding: 'native-opening-variant-replacement-event-v1',
        sessionId: plan.sessionId, sourceSha256: plan.base.sourceSha256, revision: plan.base.revision + 1,
        eventId: recordSha256({ encoding: 'opening-variant-replacement-event-identity-v1', planSha256: plan.planSha256 }),
        plan, phases: [phase], outcome: 'accepted', values: output.values,
        valuesSha256: recordSha256(output.values), context: output.context,
        frontier: { nativeCut: association.completionMarker.seq + 1, tailSha256: schemaExecutionServerTailSha256(association),
            frontierSha256: schemaExecutionHostFrontierSha256(association) } }, 'eventSha256');
}
export const validateOpeningVariantReplacementEvent = createImmutableDescriptorValidator((input) => {
    const event = freezeMvuSchemaStoryData(input), plan = validatePlan(event.plan), phase = event.phases[0], { eventSha256, ...body } = event;
    if (event.schemaVersion !== 1 || event.encoding !== 'native-opening-variant-replacement-event-v1'
        || event.phases.length !== 1 || phase?.phase !== 'external-pack-replacement'
        || !same(phase.input, plan.input) || phase.output.kind !== 'accepted')
        fail();
    validateSchemaGuestOutputV4(phase.output, phase.input);
    const association = phase.association, selector = openingVariantReplacementSelector(plan);
    if (association.sessionId !== plan.sessionId || association.realmEpoch !== plan.realmEpoch
        || association.batchId !== selector.batchId || !same(association.anchor, selector.anchor)
        || association.sourceNativeCutSha256 !== recordSha256(plan.initialCut)
        || !same(phase.output.values, plan.input.values) || !same(phase.output.context, plan.input.context)
        || recordSha256(body) !== eventSha256 || event.sessionId !== plan.sessionId
        || event.sourceSha256 !== plan.base.sourceSha256 || event.revision !== plan.base.revision + 1
        || event.eventId !== recordSha256({ encoding: 'opening-variant-replacement-event-identity-v1', planSha256: plan.planSha256 })
        || event.outcome !== 'accepted' || !same(event.values, phase.output.values)
        || event.valuesSha256 !== recordSha256(phase.output.values) || !same(event.context, phase.output.context)
        || event.frontier.nativeCut !== association.completionMarker.seq + 1
        || event.frontier.tailSha256 !== schemaExecutionServerTailSha256(association)
        || event.frontier.frontierSha256 !== schemaExecutionHostFrontierSha256(association))
        fail();
    return event;
});
