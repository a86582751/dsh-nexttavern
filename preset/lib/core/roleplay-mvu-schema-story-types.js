// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-story-types.ts; edit the TypeScript source.
/** Versioned schema story facts. These validators prove bounded integrity,
 * never Native history, Source currency or private execution permission. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { cloneSchemaValues } from './tavern-mvu-schema-data.js';
import { freezeImmutableSchemaDescriptorDataV4, createImmutableDescriptorValidator } from './roleplay-mvu-schema-descriptor-data.js';
import { validateMvuSchemaOpeningHead } from './roleplay-mvu-schema-opening-types.js';
import { assertMvu196CommandsV1 } from './tavern-mvu-update-protocol-v1.js';
import { validateMvuSchemaMaintenanceCandidateSourceV1 } from './roleplay-mvu-schema-maintenance-types.js';
import { validateSchemaTaskArtifactV1 } from './roleplay-mvu-schema-task-edit-types.js';
import { validateSchemaEvaluationInputV4, validateSchemaGuestOutputV4 } from './tavern-mvu-schema-runner-v4.js';
import { validateMvuScopeReadFrameV1 } from './tavern-mvu-scope-read.js';
import { validateMvuScopeReadRefV2 } from './tavern-mvu-scope-view-v2.js';
import { schemaScopeReadFactsEqual } from './roleplay-mvu-schema-scope-facts.js';
import { validateSchemaSourceCut, validateSchemaAnchor, validateSchemaJournalRecord } from './roleplay-mvu-schema-journal.js';
import { validateSchemaStorySourceFrame } from './roleplay-mvu-schema-source.js';
import { schemaExecutionServerTailSha256, schemaExecutionHostFrontierSha256 } from './roleplay-mvu-schema-replay.js';
export const isMvuSchemaGenesisHead = (head) => head.encoding === 'mvu-schema-opening-head-v3'
    || head.encoding === 'native-mvu-schema-derived-head-v1' || head.encoding === 'native-opening-variant-activation-head-v1';
export function schemaStoryMaintenanceSource(plan) {
    return plan.schemaVersion === 13 ? plan.maintenance : undefined;
}
export const MVU_SCHEMA_STORY_BOUNDS = Object.freeze({ bytes: 16777216, depth: 66, nodes: 131072, narrativeBytes: 1048576 });
export function freezeMvuSchemaStoryData(input) {
    return freezeImmutableSchemaDescriptorDataV4(input, MVU_SCHEMA_STORY_BOUNDS.bytes, { depth: MVU_SCHEMA_STORY_BOUNDS.depth, nodes: MVU_SCHEMA_STORY_BOUNDS.nodes });
}
// Journal inventory deliberately rejects non-journal rows in its namespace.
// Numerical publication facts therefore stay under the state namespace.
export const mvuSchemaStoryEventKey = (sid, id) => `${sid}__mvu-state-schema-story-event-${id}`;
export const mvuSchemaStorySettlementKey = (sid, id) => `${sid}__mvu-state-schema-story-settlement-${id}`;
export const mvuSchemaStoryRevisionDescriptorKey = (sid, id) => `${sid}__mvu-state-schema-revision-descriptor-${id}`;
export const mvuSchemaStoryRevisionBasisKey = (sid, basisSha) => `${sid}__mvu-state-schema-revision-basis-${basisSha}`;
export const mvuSchemaStoryRevisionPlanKey = (sid, id) => `${sid}__mvu-state-schema-revision-plan-${id}`;
export const mvuSchemaStoryRevisionEventKey = (sid, id) => `${sid}__mvu-state-schema-revision-event-${id}`;
export const mvuSchemaStoryRevisionCompletionKey = (sid, descriptorSha) => `${sid}__mvu-state-schema-revision-completion-${descriptorSha}`;
export const schemaStoryCode = (value) => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,95}$/.test(value)
    ? value : 'SCHEMA_STORY_UNKNOWN';
/** Browser DATA uses the upstream envelope. Native alone owns stat_data's
 * numerical writer; the remaining keys retain the existing metadata context. */
export function mvuSchemaStoryVariables(values, context) {
    return { ...context, stat_data: values };
}
export function mvuSchemaStoryVariableParts(variables) {
    const { stat_data, ...context } = cloneSchemaValues(variables);
    if (!stat_data || typeof stat_data !== 'object' || Array.isArray(stat_data))
        fail();
    return { values: cloneSchemaValues(stat_data), context };
}
export function mvuSchemaStoryExecutionPhases(event) {
    return event.phases;
}
const same = (a, b) => recordSha256(a) === recordSha256(b);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value, max = 128) => typeof value === 'string' && new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`).test(value);
const integer = (value, min = 0) => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && !Object.is(value, -0);
function fail() { throw Error('SCHEMA_STORY_RECORD_INVALID'); }
function exact(value, required, optional = []) {
    const keys = Object.keys(value);
    if (required.some(key => !keys.includes(key)) || keys.some(key => !required.includes(key) && !optional.includes(key)))
        fail();
}
export function sealMvuSchemaStoryFact(body, field) {
    const value = freezeMvuSchemaStoryData(body);
    return freezeMvuSchemaStoryData({ ...value, [field]: recordSha256(value) });
}
function fact(value, field) {
    const { [field]: checksum, ...body } = value;
    if (!hash(checksum) || recordSha256(body) !== checksum)
        fail();
}
export function validateMvuSchemaStoryRoot(input) {
    const value = freezeMvuSchemaStoryData(input);
    const keys = ['openingEventId', 'openingEventSha256', 'openingHeadSha256', 'openingPlanSha256', 'realmEpoch', 'programSha256'];
    exact(value, keys, ['derived', 'activation']);
    if (!keys.every(key => hash(value[key])))
        fail();
    if (value.derived !== undefined) {
        const derived = value.derived;
        exact(derived, ['schemaVersion', 'encoding', 'eventId', 'eventSha256', 'headSha256', 'basisSha256']);
        if (derived.schemaVersion !== 1 || derived.encoding !== 'native-mvu-schema-derived-root-v1'
            || ![derived.eventId, derived.eventSha256, derived.headSha256, derived.basisSha256].every(hash))
            fail();
    }
    if (value.activation !== undefined) {
        const activation = value.activation;
        exact(activation, ['schemaVersion', 'encoding', 'sessionId', 'eventId', 'eventSha256', 'headSha256', 'packetSha256']);
        if (activation.schemaVersion !== 1 || activation.encoding !== 'native-opening-variant-activation-root-v1'
            || !id(activation.sessionId, 64)
            || ![activation.eventId, activation.eventSha256, activation.headSha256, activation.packetSha256].every(hash))
            fail();
    }
    return value;
}
const root = validateMvuSchemaStoryRoot;
function frontier(value) {
    exact(value, ['nativeCut', 'tailSha256', 'frontierSha256']);
    if (!integer(value.nativeCut) || !hash(value.tailSha256) || !hash(value.frontierSha256))
        fail();
}
export function validateMvuSchemaStoryHead(input) {
    const head = freezeMvuSchemaStoryData(input);
    if (head.encoding === 'mvu-schema-opening-head-v3')
        return validateMvuSchemaOpeningHead(head);
    if (head.encoding === 'native-opening-variant-activation-head-v1') {
        exact(head, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'revision', 'eventId', 'eventSha256',
            'planSha256', 'valuesSha256']);
        if (head.schemaVersion !== 1 || !id(head.sessionId, 64) || head.revision !== 1
            || ![head.sourceSha256, head.eventId, head.eventSha256, head.planSha256, head.valuesSha256].every(hash))
            fail();
        return head;
    }
    if (head.encoding === 'native-mvu-schema-derived-head-v1') {
        exact(head, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'revision', 'eventId', 'eventSha256',
            'planSha256', 'basisSha256', 'valuesSha256']);
        if (head.schemaVersion !== 1 || !id(head.sessionId, 64) || head.revision !== 1
            || ![head.sourceSha256, head.eventId, head.eventSha256, head.planSha256, head.basisSha256, head.valuesSha256].every(hash))
            fail();
        return head;
    }
    exact(head, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'root', 'revision', 'eventId',
        'eventSha256', 'planSha256', 'valuesSha256']);
    root(head.root);
    if (!(head.schemaVersion === 2 && (head.encoding === 'native-mvu-schema-story-head-v2'
        || head.encoding === 'native-mvu-schema-story-revision-head-v2')
        || head.schemaVersion === 1 && (head.encoding === 'native-mvu-schema-player-head-v1'
            || head.encoding === 'native-mvu-schema-player-revision-head-v1'
            || head.encoding === 'native-mvu-opening-variant-head-v1')) || !id(head.sessionId, 64)
        || !integer(head.revision, 2) || ![head.sourceSha256, head.eventId, head.eventSha256, head.planSha256, head.valuesSha256].every(hash))
        fail();
    return head;
}
const validateNumericalSnapshotDescriptor = createImmutableDescriptorValidator(validateNumericalSnapshotUncached);
export function validateMvuSchemaNumericalSnapshot(input) {
    return validateNumericalSnapshotDescriptor(input);
}
function validateNumericalSnapshotUncached(input) {
    const value = freezeMvuSchemaStoryData(input);
    exact(value, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'root', 'currentHead', 'revision', 'headSha256',
        'values', 'valuesSha256', 'context', 'schemaFrontier', 'stateSnapshotSha256']);
    fact(value, 'stateSnapshotSha256');
    root(value.root);
    frontier(value.schemaFrontier);
    const head = validateMvuSchemaStoryHead(value.currentHead);
    if (value.schemaVersion !== 2 || value.encoding !== 'native-mvu-schema-state-snapshot-v2' || !id(value.sessionId, 64)
        || !hash(value.sourceSha256) || head.sessionId !== value.sessionId || head.revision !== value.revision
        || recordSha256(head) !== value.headSha256 || head.valuesSha256 !== value.valuesSha256
        || recordSha256(cloneSchemaValues(value.values)) !== value.valuesSha256)
        fail();
    cloneSchemaValues(value.context);
    if (head.encoding === 'mvu-schema-opening-head-v3') {
        if (value.root.derived || head.eventId !== value.root.openingEventId || head.eventSha256 !== value.root.openingEventSha256
            || recordSha256(head) !== value.root.openingHeadSha256 || head.planSha256 !== value.root.openingPlanSha256)
            fail();
    }
    else if (head.encoding === 'native-opening-variant-activation-head-v1') {
        const activation = value.root.activation;
        if (!activation || activation.eventId !== head.eventId || activation.eventSha256 !== head.eventSha256
            || activation.headSha256 !== recordSha256(head) || activation.packetSha256 !== head.planSha256)
            fail();
    }
    else if (head.encoding === 'native-mvu-schema-derived-head-v1') {
        const derived = value.root.derived;
        if (!derived || derived.eventId !== head.eventId || derived.eventSha256 !== head.eventSha256
            || derived.headSha256 !== recordSha256(head) || derived.basisSha256 !== head.basisSha256)
            fail();
    }
    else if (!same(head.root, value.root))
        fail();
    return value;
}
export function deriveMvuSchemaStorySelectors(scope, canonical, realmEpoch) {
    const anchor = { kind: 'story', preparationId: scope.currency.preparationId,
        attemptGeneration: scope.currency.attemptGeneration, receiptGeneration: scope.currency.receiptGeneration,
        turn: scope.receipt.checkpoint.actualTurn, canonicalSeq: canonical.seq, messageId: canonical.messageId,
        messageVersionSha256: canonical.versionSha256 };
    validateSchemaAnchor(anchor);
    const digest = recordSha256({ scope, canonical, realmEpoch });
    return freezeMvuSchemaStoryData([{ sessionId: scope.receipt.checkpoint.sessionId, batchId: `story-${digest}-1`, anchor }]);
}
export function deriveMvuSchemaStoryRevisionSelectorsV2(scope, canonical, realmEpoch, descriptor, index, sessionId) {
    const anchor = { kind: 'story', preparationId: scope.currency.preparationId,
        attemptGeneration: scope.currency.attemptGeneration, receiptGeneration: scope.currency.receiptGeneration,
        turn: scope.receipt.checkpoint.actualTurn, canonicalSeq: canonical.seq, messageId: canonical.messageId,
        messageVersionSha256: canonical.versionSha256 };
    validateSchemaAnchor(anchor);
    return freezeMvuSchemaStoryData([{ sessionId, batchId: `revision2-${descriptor.sha256}-${index + 1}-1`, anchor }]);
}
export function mvuSchemaStoryExecutionId(plan) {
    return 'startSha256' in plan ? plan.startSha256 : plan.schemaVersion === 13 && plan.executionStart
        ? plan.executionStart.sha256 : plan.planSha256;
}
export function mvuSchemaStorySelector(plan, stepOrdinal) {
    if (!integer(stepOrdinal))
        fail();
    const first = plan.selectors[0];
    return { ...first, batchId: first.batchId.replace(/-1$/, `-${stepOrdinal + 1}`) };
}
export function mvuSchemaStoryUpdateInput(plan, index, phases, browser, interests, acceptedHook, macros) {
    const updateId = mvuSchemaStoryExecutionId(plan);
    if (index === 0)
        return { schemaVersion: 1, encoding: 'native-mvu-196-update-start-v1', updateId,
            message: plan.canonical.narrative, interests, ...macros ? { macros } : {},
            ...'startSha256' in plan || plan.schemaVersion === 13 && plan.executionStart
                || plan.schemaVersion === 14 && plan.taskEdit !== undefined ? { maintenance: true } : {} };
    const previous = phases[index - 1]?.output;
    if (previous?.kind !== 'accepted' || !('update' in previous) || !previous.update || previous.update.kind === 'complete')
        fail();
    if (previous.update.kind === 'native-commands-ready') {
        let commands;
        if (plan.schemaVersion === 14) {
            if (!plan.taskEdit)
                fail();
            if (plan.taskEdit.mode === 'replace')
                commands = previous.update.commands;
            else {
                if (plan.taskCommands === undefined)
                    fail();
                commands = plan.taskCommands;
            }
        }
        else {
            if (plan.schemaVersion !== 13 || !plan.maintenance || !plan.executionStart)
                fail();
            const canonical = previous.update.commands, proposal = plan.maintenance.result.variableCandidate;
            commands = canonical.length ? canonical : proposal?.kind === 'commands' ? proposal.commands : [];
        }
        return { schemaVersion: 1, encoding: 'native-mvu-196-native-resume-v1', updateId,
            yieldOrdinal: previous.update.yieldOrdinal, commands, interests };
    }
    const yielded = previous.update, lastHook = acceptedHook ?? browser?.hooks.at(-1), hook = lastHook?.request.yieldOrdinal === yielded.yieldOrdinal ? lastHook : undefined;
    if (hook && (!('graph' in hook.result.output) || !hook.result.output.graph))
        fail();
    return { schemaVersion: 1, encoding: 'native-mvu-196-update-resume-v1', updateId,
        yieldOrdinal: yielded.yieldOrdinal, graph: hook && 'graph' in hook.result.output ? hook.result.output.graph : yielded.graph,
        ...hook?.result.contextWrites ? { contextWrites: hook.result.contextWrites } : {}, interests };
}
export function makeMvu196StoryRevisionPlan(input) {
    return validateMvuSchemaStoryPlan(sealMvuSchemaStoryFact({ ...input, schemaVersion: 14,
        encoding: 'native-mvu-196-story-revision-plan-v1', candidate: { schemaVersion: 1, kind: 'mvu-196' },
        selectors: deriveMvuSchemaStoryRevisionSelectorsV2(input.scope, input.canonical, input.realmEpoch, input.revision.descriptor, input.revision.index, input.execution.sessionId),
        randomSeed: recordSha256({ scope: input.scope, canonical: input.canonical, revision: input.revision.descriptor, index: input.revision.index }) }, 'planSha256'));
}
const validateStoryPlanDescriptor = createImmutableDescriptorValidator(validateStoryPlanUncached);
export function validateMvuSchemaStoryPlan(input) {
    return validateStoryPlanDescriptor(input);
}
function validateStoryPlanUncached(input) {
    const value = freezeMvuSchemaStoryData(input);
    if (value.schemaVersion === 14)
        return validateStoryRevisionPlan(value);
    exact(value, ['schemaVersion', 'encoding', 'scope', 'canonical', 'base', 'candidate', 'currentFrame', 'realmEpoch',
        'programSha256', 'initialCut', 'clockEpochMs', 'randomSeed', 'selectors', 'planSha256', 'executorVersion',
        'scopeReadRef', 'epoch', 'serverProgramSha256'], ['errorPolicy', 'maintenance', 'executionStart']);
    if (value.errorPolicy !== undefined && value.errorPolicy !== 'registered-command-policy-v1'
        && value.errorPolicy !== 'update-batch-atomic-v1')
        fail();
    fact(value, 'planSha256');
    validateMvuSchemaNumericalSnapshot(value.base);
    validateSchemaStorySourceFrame(value.currentFrame);
    const { scope, canonical, currentFrame: frame } = value, { currency, receipt } = scope;
    exact(scope, ['currency', 'receipt', 'stopGeneration']);
    exact(currency, ['schemaVersion', 'preparationId', 'credentialSha256', 'receiptGeneration', 'attemptGeneration', 'source', 'snapshot']);
    exact(currency.snapshot, ['key', 'sha256']);
    if (currency.source.kind !== 'story')
        fail();
    exact(currency.source, ['kind', 'sourceSha256', 'headRef']);
    exact(currency.source.headRef, ['kind', 'sha256']);
    exact(canonical, ['seq', 'messageId', 'versionSha256', 'narrative', 'narrativeSha256']);
    if (value.schemaVersion !== 13 || value.encoding !== 'native-mvu-196-story-plan-v1' || value.executorVersion !== 4
        || currency.schemaVersion !== 2 || currency.source.headRef.kind !== 'schema-head'
        || currency.source.headRef.sha256 !== value.base.stateSnapshotSha256
        || !id(currency.preparationId) || !hash(currency.credentialSha256)
        || !integer(currency.receiptGeneration, 1) || !integer(currency.attemptGeneration, 1) || !integer(scope.stopGeneration)
        || !id(currency.snapshot.key, 512) || !hash(currency.snapshot.sha256)
        || receipt.schemaVersion !== 1 || receipt.flushed !== true || receipt.checkpoint.sessionId !== value.base.sessionId
        || receipt.checkpoint.preparation.credentialSha256 !== currency.credentialSha256
        || !integer(receipt.checkpoint.actualTurn, 1) || !integer(receipt.turnEndSeq) || !hash(receipt.turnEndSha256)
        || !integer(canonical.seq) || !id(canonical.messageId) || !hash(canonical.versionSha256)
        || canonical.seq >= receipt.turnEndSeq || typeof canonical.narrative !== 'string'
        || Buffer.byteLength(canonical.narrative, 'utf8') > MVU_SCHEMA_STORY_BOUNDS.narrativeBytes
        || sha256(canonical.narrative) !== canonical.narrativeSha256
        || currency.source.sourceSha256 !== value.base.sourceSha256 || value.realmEpoch !== value.base.root.realmEpoch
        || value.programSha256 !== value.base.root.programSha256 || !integer(value.clockEpochMs)
        || frame.sessionId !== value.base.sessionId || !same(value.candidate, { schemaVersion: 1, kind: 'mvu-196' }))
        fail();
    const first = value.selectors[0], ordinary = deriveMvuSchemaStorySelectors(scope, canonical, value.realmEpoch);
    validateSchemaSourceCut(value.initialCut);
    // Running cuts retain Native's Stop sequence. Completion currency carries
    // its owner's independent revocation generation, including refused inputs.
    if (value.initialCut.sessionId !== value.base.sessionId || value.initialCut.ownerSessionId !== value.base.sessionId
        || value.initialCut.nativeCut <= canonical.seq || value.initialCut.nativeCut < value.base.schemaFrontier.nativeCut
        || value.initialCut.sourceSnapshotSha256 !== frame.snapshotSha256 || value.initialCut.materialSha256 !== frame.materialSha256
        || value.selectors.length !== 1 || !first || first.sessionId !== value.base.sessionId
        || !same(value.initialCut.anchor, ordinary[0].anchor) || !same(first.anchor, value.initialCut.anchor))
        fail();
    if (value.executionStart) {
        revisionReference(value.executionStart);
        if (!hash(value.randomSeed) || !id(first.batchId, 256))
            fail();
    }
    else if (value.initialCut.nativeCut < receipt.turnEndSeq + 1 || !same(value.selectors, ordinary)
        || value.randomSeed !== recordSha256({ scope, canonical }))
        fail();
    revisionReference(value.epoch);
    if (!hash(value.serverProgramSha256))
        fail();
    if (validateMvuScopeReadRefV2(value.scopeReadRef).sourceNativeCutSha256 !== recordSha256(value.initialCut))
        fail();
    if (value.maintenance)
        validateMvuSchemaMaintenanceCandidateSourceV1(value.maintenance, { scope, canonical, base: value.base });
    return value;
}
/** Validated reference DATA may advance its Native cut without changing the
 * frozen message/variable dependency chain selected by a transaction plan. */
export function schemaScopeReadRefFactsEqualV2(left, right) {
    return left.baseRef.ownerSessionId === right.baseRef.ownerSessionId && left.baseRef.key === right.baseRef.key
        && left.baseRef.sha256 === right.baseRef.sha256 && left.tailRef.ownerSessionId === right.tailRef.ownerSessionId
        && left.tailRef.key === right.tailRef.key && left.tailRef.sha256 === right.tailRef.sha256;
}
function validateStoryRevisionPlan(value) {
    exact(value, ['schemaVersion', 'encoding', 'scope', 'canonical', 'base', 'candidate', 'currentFrame', 'realmEpoch',
        'programSha256', 'initialCut', 'clockEpochMs', 'randomSeed', 'selectors', 'planSha256', 'executorVersion',
        'scopeReadFrame', 'epoch', 'serverProgramSha256', 'revision', 'execution', 'logicalNativeCut'], ['errorPolicy', 'ordinaryScopes', 'taskEdit', 'taskCommands']);
    if (value.errorPolicy !== undefined && value.errorPolicy !== 'registered-command-policy-v1'
        && value.errorPolicy !== 'update-batch-atomic-v1')
        fail();
    fact(value, 'planSha256');
    validateMvuSchemaNumericalSnapshot(value.base);
    validateSchemaStorySourceFrame(value.currentFrame);
    const { scope, canonical, currentFrame: frame, execution, revision } = value, { currency, receipt } = scope;
    exact(scope, ['currency', 'receipt', 'stopGeneration']);
    exact(currency, ['schemaVersion', 'preparationId', 'credentialSha256', 'receiptGeneration', 'attemptGeneration', 'source', 'snapshot']);
    exact(currency.snapshot, ['key', 'sha256']);
    if (currency.source.kind !== 'story')
        fail();
    exact(currency.source, ['kind', 'sourceSha256', 'headRef']);
    exact(currency.source.headRef, ['kind', 'sha256']);
    exact(canonical, ['seq', 'messageId', 'versionSha256', 'narrative', 'narrativeSha256']);
    exact(execution, ['sessionId', 'sourceSha256', 'root']);
    exact(revision, ['descriptor', 'index', 'publicationRevision']);
    revisionReference(revision.descriptor);
    revisionReference(value.epoch);
    root(execution.root);
    if (value.schemaVersion !== 14 || value.encoding !== 'native-mvu-196-story-revision-plan-v1' || value.executorVersion !== 4
        || currency.schemaVersion !== 2 || currency.source.headRef.kind !== 'schema-head' || !hash(currency.source.headRef.sha256)
        || !id(currency.preparationId) || !hash(currency.credentialSha256) || !hash(currency.source.sourceSha256)
        || !integer(currency.receiptGeneration, 1) || !integer(currency.attemptGeneration, 1) || !integer(scope.stopGeneration)
        || !id(currency.snapshot.key, 512) || !hash(currency.snapshot.sha256)
        || receipt.schemaVersion !== 1 || receipt.flushed !== true || !id(receipt.checkpoint.sessionId, 64)
        || receipt.checkpoint.preparation.credentialSha256 !== currency.credentialSha256
        || !integer(receipt.checkpoint.actualTurn, 1) || !integer(receipt.turnEndSeq) || !hash(receipt.turnEndSha256)
        || !integer(canonical.seq) || !id(canonical.messageId) || !hash(canonical.versionSha256)
        || canonical.seq >= receipt.turnEndSeq || typeof canonical.narrative !== 'string'
        || Buffer.byteLength(canonical.narrative, 'utf8') > MVU_SCHEMA_STORY_BOUNDS.narrativeBytes
        || sha256(canonical.narrative) !== canonical.narrativeSha256
        || !id(execution.sessionId, 64) || !hash(execution.sourceSha256)
        || value.realmEpoch !== value.base.root.realmEpoch || value.programSha256 !== value.base.root.programSha256
        || value.realmEpoch !== execution.root.realmEpoch || value.programSha256 !== execution.root.programSha256
        || !integer(revision.index) || !integer(revision.publicationRevision, 2) || !integer(value.logicalNativeCut)
        || !integer(value.clockEpochMs) || !hash(value.serverProgramSha256)
        || value.randomSeed !== recordSha256({ scope, canonical, revision: revision.descriptor, index: revision.index })
        || frame.sessionId !== execution.sessionId || !same(value.candidate, { schemaVersion: 1, kind: 'mvu-196' }))
        fail();
    validateSchemaSourceCut(value.initialCut);
    if (value.initialCut.sessionId !== execution.sessionId || value.initialCut.ownerSessionId !== execution.sessionId
        || value.initialCut.nativeCut < receipt.turnEndSeq + 1 || value.initialCut.nativeCut < value.base.schemaFrontier.nativeCut
        || value.initialCut.sourceSnapshotSha256 !== frame.snapshotSha256 || value.initialCut.materialSha256 !== frame.materialSha256
        || !same(value.selectors, deriveMvuSchemaStoryRevisionSelectorsV2(scope, canonical, value.realmEpoch, revision.descriptor, revision.index, execution.sessionId)) || !same(value.initialCut.anchor, value.selectors[0].anchor))
        fail();
    if (value.taskEdit) {
        const selected = value.taskEdit;
        exact(selected, ['canonicalSeq', 'originEventRef', 'sourceEventRef', 'effectiveKind', 'mode', 'intent', 'binding']);
        revisionReference(selected.intent);
        revisionReference(selected.binding);
        validateSchemaTaskArtifactV1(selected);
        if (selected.canonicalSeq !== canonical.seq || !['retain', 'replace', 'clear'].includes(selected.mode)
            || (selected.mode !== 'replace') !== Object.hasOwn(value, 'taskCommands'))
            fail();
    }
    else if (Object.hasOwn(value, 'taskCommands'))
        fail();
    if (Object.hasOwn(value, 'taskCommands')) {
        assertMvu196CommandsV1(value.taskCommands);
        if (value.taskEdit.mode === 'clear' && value.taskCommands.length)
            fail();
    }
    const read = validateMvuScopeReadFrameV1(value.scopeReadFrame), source = frame.snapshot.source;
    if (read.source.sessionId !== execution.sessionId || read.source.sourceRecordSessionId !== source.sourceRecordSessionId
        || read.source.importId !== source.importId || read.source.rawSha256 !== source.rawSha256
        || read.source.sourceSnapshotSha256 !== frame.snapshotSha256
        || read.sourceNativeCutSha256 !== recordSha256(value.initialCut))
        fail();
    return value;
}
/** Each input continues the one actual updater suspended by the preceding output. */
export function mvuSchemaStoryPhaseInput(plan, index, phases, scopeReadFrame, scopeReadRef, browser, interests = [], acceptedHook, macros) {
    const referenced = plan.schemaVersion !== 14, reference = referenced ? validateMvuScopeReadRefV2(scopeReadRef ?? plan.scopeReadRef) : undefined, read = plan.schemaVersion === 14 ? validateMvuScopeReadFrameV1(scopeReadFrame ?? plan.scopeReadFrame) : undefined;
    if (phases.length < index || referenced && (scopeReadFrame || !schemaScopeReadRefFactsEqualV2(reference, plan.scopeReadRef))
        || plan.schemaVersion === 14 && (scopeReadRef || !schemaScopeReadFactsEqual(read, plan.scopeReadFrame)))
        fail();
    const previous = phases[index - 1]?.output, accepted = previous?.kind === 'accepted' ? previous : undefined;
    return validateSchemaEvaluationInputV4({ schemaVersion: 4, ...reference
            ? { encoding: 'native-mvu-author-schema-phase-input-v4-scope-ref-v2', scopeReadRef: reference }
            : { encoding: 'native-mvu-author-schema-phase-input-v4', scopeReadFrame: read },
        errorPolicy: plan.errorPolicy ?? 'atomic-refusal', phase: 'update-core',
        base: plan.base.values, values: accepted?.values ?? plan.base.values, context: accepted?.context ?? plan.base.context,
        clockEpochMs: plan.clockEpochMs, randomSeed: plan.randomSeed,
        update: mvuSchemaStoryUpdateInput(plan, index, phases, browser, interests, acceptedHook, macros) });
}
function association(value, plan, index) {
    const selector = mvuSchemaStorySelector(plan, index);
    if (value.schemaVersion !== 5)
        fail();
    exact(value, ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'batchId', 'anchor', 'sourceNativeCutSha256',
        'combinedProgramSha256', 'serverProgramSha256', 'epoch', 'dispatch', 'completion', 'dispatchMarker', 'completionMarker',
        'serverTailSha256', 'hostFrontierSha256', 'outputSha256']);
    if (value.encoding !== 'native-author-host-association-v5' || value.sessionId !== selector.sessionId
        || value.realmEpoch !== plan.realmEpoch || value.combinedProgramSha256 !== plan.programSha256
        || value.serverProgramSha256 !== plan.serverProgramSha256 || !same(value.epoch, plan.epoch)
        || value.batchId !== selector.batchId || !same(value.anchor, selector.anchor)
        || ![value.sourceNativeCutSha256, value.serverTailSha256, value.hostFrontierSha256, value.outputSha256].every(hash))
        fail();
    for (const ref of [value.epoch, value.dispatch, value.completion])
        revisionReference(ref);
    for (const marker of [value.dispatchMarker, value.completionMarker]) {
        exact(marker, ['seq', 'sha256']);
        if (!integer(marker.seq) || !hash(marker.sha256))
            fail();
    }
    if (value.completionMarker.seq !== value.dispatchMarker.seq + 1)
        fail();
}
function browserFinal(plan, phases, browser) {
    const last = mvuSchemaStoryExecutionPhases({ phases, browser }).at(-1), before = browser?.hooks.find(hook => hook.result.stage === 'before-message-update');
    const parts = before?.result.stage === 'before-message-update'
        ? mvuSchemaStoryVariableParts(before.result.output.context.variables) : undefined;
    return { values: parts?.values ?? (last.output.kind === 'accepted' ? last.output.values : plan.base.values),
        context: parts?.context ?? (last.output.kind === 'accepted' ? last.output.context : plan.base.context),
        frontier: before?.frontier ?? { nativeCut: last.association.completionMarker.seq + 1,
            tailSha256: schemaExecutionServerTailSha256(last.association),
            frontierSha256: schemaExecutionHostFrontierSha256(last.association) } };
}
function validateMvu196StoryExecution(plan, phases, browser) {
    if (browser) {
        exact(browser, ['schemaVersion', 'hooks', 'finalizedMessage']);
        if (browser.schemaVersion !== 1 || !Array.isArray(browser.hooks) || !browser.hooks.length)
            fail();
    }
    let cut = plan.initialCut.nativeCut, hookIndex = 0, yieldOrdinal = 0, resumeHook;
    const consumeHook = (hook) => {
        exact(hook, ['schemaVersion', 'request', 'result', 'journal', 'frontier']);
        const { request, result, journal } = hook;
        if (hook.schemaVersion !== 1 || request.sessionId !== (plan.schemaVersion === 14 ? plan.execution.sessionId : plan.base.sessionId) || request.planSha256 !== mvuSchemaStoryExecutionId(plan)
            || request.stage !== result.stage || !same(request.target, { kind: 'message', ownerSessionId: plan.base.sessionId,
            nativeSeq: plan.canonical.seq, messageId: plan.canonical.messageId, messageVersionSha256: plan.canonical.versionSha256 }))
            fail();
        validateSchemaJournalRecord(journal.dispatch);
        validateSchemaJournalRecord(journal.completion);
        if (!same(request, journal.dispatch.request) || !same(result, journal.completion.result)
            || journal.dispatchRef.sha256 !== journal.dispatch.recordSha256 || journal.completionRef.sha256 !== journal.completion.recordSha256
            || !same(journal.completion.dispatch, journal.dispatchRef) || !same(journal.completion.dispatchMarker, journal.dispatchMarker)
            || journal.dispatchMarker.seq < cut || journal.completionMarker.seq <= journal.dispatchMarker.seq
            || journal.dispatch.sourceNativeCut.nativeCut !== journal.dispatchMarker.seq || journal.dispatch.realmEpoch !== plan.realmEpoch
            || journal.dispatch.sourceNativeCut.sourceSnapshotSha256 !== plan.currentFrame.snapshotSha256
            || journal.dispatch.sourceNativeCut.materialSha256 !== plan.currentFrame.materialSha256
            || !same(journal.dispatch.sourceNativeCut.anchor, plan.selectors[0].anchor))
            fail();
        frontier(hook.frontier);
        if (hook.frontier.nativeCut !== journal.completionMarker.seq + 1)
            fail();
        cut = journal.completionMarker.seq + 1;
        hookIndex++;
    };
    for (const [index, phase] of phases.entries()) {
        exact(phase, ['phase', 'input', 'association', 'output']);
        const input = validateSchemaEvaluationInputV4(phase.input);
        if (!input.update)
            fail();
        if (plan.schemaVersion === 13) {
            if (input.encoding !== 'native-mvu-author-schema-phase-input-v4-scope-ref-v2'
                || !schemaScopeReadRefFactsEqualV2(input.scopeReadRef, plan.scopeReadRef)
                || input.scopeReadRef.sourceNativeCutSha256 !== phase.association.sourceNativeCutSha256)
                fail();
        }
        else if (input.encoding !== 'native-mvu-author-schema-phase-input-v4'
            || !schemaScopeReadFactsEqual(input.scopeReadFrame, plan.scopeReadFrame)
            || input.scopeReadFrame.sourceNativeCutSha256 !== phase.association.sourceNativeCutSha256)
            fail();
        const output = validateSchemaGuestOutputV4(phase.output, input);
        association(phase.association, plan, index);
        if (phase.phase !== 'update-core' || phase.association.dispatchMarker.seq < cut
            || phase.association.outputSha256 !== recordSha256(output)
            || !same(input, mvuSchemaStoryPhaseInput(plan, index, phases, input.scopeReadFrame, input.scopeReadRef, undefined, input.update.interests, resumeHook, input.update.encoding === 'native-mvu-196-update-start-v1' ? input.update.macros : undefined)))
            fail();
        if (index === 0 && (phase.association.dispatchMarker.seq !== plan.initialCut.nativeCut
            || phase.association.sourceNativeCutSha256 !== recordSha256(plan.initialCut)))
            fail();
        cut = phase.association.completionMarker.seq + 1;
        if (output.kind === 'refused') {
            if (index !== phases.length - 1)
                fail();
            break;
        }
        if (!output.update || output.update.updateId !== mvuSchemaStoryExecutionId(plan))
            fail();
        if (output.update.kind === 'complete') {
            if (index !== phases.length - 1)
                fail();
            break;
        }
        if (index === phases.length - 1 || output.update.yieldOrdinal !== yieldOrdinal++)
            fail();
        resumeHook = undefined;
        if (output.update.kind === 'native-commands-ready')
            continue;
        const hook = browser?.hooks[hookIndex];
        if (hook?.request.yieldOrdinal === output.update.yieldOrdinal) {
            const { readVariables: _readVariables, ...payload } = hook.request.payload;
            if (hook.request.stage !== output.update.stage || !same(payload, { graph: output.update.graph })
                || !('graph' in hook.result.output) || !hook.result.output.graph)
                fail();
            consumeHook(hook);
            resumeHook = hook;
        }
    }
    const before = browser?.hooks[hookIndex], last = phases.at(-1).output;
    if (before) {
        const { readVariables: _readVariables, ...payload } = before.request.payload;
        if (last.kind !== 'accepted' || !('update' in last) || last.update?.kind !== 'complete'
            || before.request.stage !== 'before-message-update' || before.request.yieldOrdinal !== undefined
            || !same(payload, { context: { variables: mvuSchemaStoryVariables(last.values, last.context),
                    message_content: plan.canonical.narrative } }))
            fail();
        consumeHook(before);
    }
    if (hookIndex !== (browser?.hooks.length ?? 0))
        fail();
    if (browser && browser.finalizedMessage !== (before?.result.stage === 'before-message-update'
        ? before.result.output.context.message_content : plan.canonical.narrative))
        fail();
}
export function mvuSchemaStoryContextWrites(phases, browser) {
    const keys = new Set(['stat_data']);
    const writes = [...phases.map(phase => phase.output.kind === 'accepted' ? phase.output.contextWrites : undefined),
        ...browser?.hooks.map(hook => hook.result.contextWrites) ?? []];
    for (const write of writes) {
        if (write?.kind === 'replace')
            return { schemaVersion: 1, kind: 'replace' };
        for (const key of write?.keys ?? [])
            keys.add(key);
    }
    return { schemaVersion: 1, kind: 'keys', keys: [...keys] };
}
export function mvuSchemaStoryEvent(plan, phases, browser, ordinaryScopes) {
    return storyEvent(plan, phases, browser, ordinaryScopes);
}
export function mvuSchemaStoryRevisionEvent(plan, phases, browser, ordinaryScopes) {
    const writes = mvuSchemaStoryContextWrites(phases, browser), basis = plan.ordinaryScopes, publication = ordinaryScopes ?? (basis ? { schemaVersion: 1, scopes: basis.scopes.map(scope => ({ ...scope,
            kind: writes.kind, ...writes.kind === 'keys' ? { keys: writes.keys } : {} })) } : undefined);
    return storyEvent(plan, phases, browser, publication);
}
function storyEvent(plan, phases, browser, ordinaryScopes) {
    if (!phases.length)
        fail();
    const last = phases.at(-1), refused = last.output.kind === 'refused';
    if (!refused && (last.output.kind !== 'accepted' || !('update' in last.output) || last.output.update?.kind !== 'complete'))
        fail();
    const final = browserFinal(plan, phases, browser), values = refused ? plan.base.values : final.values, context = refused ? plan.base.context : final.context, valuesSha256 = recordSha256(values), revision = plan.schemaVersion === 14, ordinaryWrite = ordinaryScopes?.scopes.some(scope => scope.kind === 'replace' || scope.keys?.some(key => key !== 'stat_data')), outcome = refused ? 'refused' : valuesSha256 === plan.base.valuesSha256 && same(context, plan.base.context) && !ordinaryWrite ? 'no-update' : 'accepted', execution = revision ? plan.execution : plan.base;
    return sealMvuSchemaStoryFact({ schemaVersion: 2,
        encoding: revision ? 'native-mvu-schema-story-revision-event-v2' : 'native-mvu-schema-story-event-v2',
        sessionId: execution.sessionId, sourceSha256: execution.sourceSha256,
        eventId: recordSha256({ encoding: revision ? 'native-mvu-schema-story-revision-event-identity-v2' :
                'native-mvu-schema-story-event-identity-v2', planSha256: plan.planSha256 }), plan, phases,
        ...browser ? { browser } : {}, ...!refused && ordinaryScopes ? { ordinaryScopes } : {},
        outcome, refusal: refused ? 'guest' : null, values, valuesSha256, context, frontier: final.frontier }, 'eventSha256');
}
const validateStoryEventDescriptor = createImmutableDescriptorValidator(validateStoryEventUncached);
export function validateMvuSchemaStoryEvent(input) {
    return validateStoryEventDescriptor(input);
}
export function validateMvuSchemaStoryRevisionEvent(input) {
    return validateStoryEventDescriptor(input);
}
function validateStoryEventUncached(input) {
    const event = freezeMvuSchemaStoryData(input), plan = validateMvuSchemaStoryPlan(event.plan);
    exact(event, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'eventId', 'plan', 'phases',
        'outcome', 'refusal', 'values', 'valuesSha256', 'context', 'frontier', 'eventSha256'], ['browser', 'ordinaryScopes']);
    fact(event, 'eventSha256');
    if (!Array.isArray(event.phases) || !event.phases.length)
        fail();
    validateMvu196StoryExecution(plan, event.phases, event.browser);
    const revision = plan.schemaVersion === 14, last = event.phases.at(-1), refused = last.output.kind === 'refused';
    if (!refused && (last.output.kind !== 'accepted' || !('update' in last.output) || last.output.update?.kind !== 'complete'))
        fail();
    const final = browserFinal(plan, event.phases, event.browser), values = refused ? plan.base.values : final.values, context = refused ? plan.base.context : final.context, valuesSha256 = recordSha256(values), execution = revision ? plan.execution : plan.base, ordinaryWrite = event.ordinaryScopes?.scopes.some(scope => scope.kind === 'replace' || scope.keys?.some(key => key !== 'stat_data'));
    exact(event.frontier, ['nativeCut', 'tailSha256', 'frontierSha256']);
    if (event.schemaVersion !== 2 || event.encoding !== (revision ? 'native-mvu-schema-story-revision-event-v2' : 'native-mvu-schema-story-event-v2')
        || event.sessionId !== execution.sessionId || event.sourceSha256 !== execution.sourceSha256
        || event.eventId !== recordSha256({ encoding: revision ? 'native-mvu-schema-story-revision-event-identity-v2' :
                'native-mvu-schema-story-event-identity-v2', planSha256: plan.planSha256 })
        || event.valuesSha256 !== valuesSha256 || recordSha256(event.values) !== valuesSha256 || !same(event.context, context)
        || event.outcome !== (refused ? 'refused' : valuesSha256 === plan.base.valuesSha256 && same(context, plan.base.context) && !ordinaryWrite ? 'no-update' : 'accepted')
        || event.refusal !== (refused ? 'guest' : null) || !same(event.frontier, final.frontier))
        fail();
    return event;
}
export function mvuSchemaStoryRevisionHead(event) {
    if (event.outcome === 'refused')
        fail();
    return freezeMvuSchemaStoryData({ schemaVersion: 2, encoding: 'native-mvu-schema-story-revision-head-v2',
        sessionId: event.sessionId, sourceSha256: event.sourceSha256, root: event.plan.execution.root,
        revision: event.plan.revision.publicationRevision, eventId: event.eventId, eventSha256: event.eventSha256,
        planSha256: event.plan.planSha256, valuesSha256: event.valuesSha256 });
}
function revisionReference(value) {
    exact(value, ['key', 'sha256']);
    if (!id(value.key, 512) || !hash(value.sha256))
        fail();
}
function revisionHistoryBasis(value) {
    exact(value, ['basisKey', 'basisSha256']);
    if (!id(value.basisKey, 512) || !hash(value.basisSha256))
        fail();
}
/** Prefix and closure interpretation belongs to their existing owners. This
 * seal preserves the selected baseline DATA across a process boundary. */
export function validateMvuSchemaStoryRevisionBasis(input) {
    const value = freezeMvuSchemaStoryData(input);
    exact(value, ['schemaVersion', 'encoding', 'sessionId', 'historyBasis', 'closedRevision', 'prefix', 'closure', 'basisSha256']);
    fact(value, 'basisSha256');
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-revision-basis-v1' || !id(value.sessionId, 64))
        fail();
    if (value.historyBasis !== null)
        revisionHistoryBasis(value.historyBasis);
    if (value.closedRevision !== null)
        revisionReference(value.closedRevision);
    return value;
}
function validateRevisionDescriptorV2(value) {
    exact(value, ['schemaVersion', 'encoding', 'sessionId', 'edits', 'basis', 'originals', 'previous',
        'completionSeq', 'publicationRevision', 'sourceSha256', 'descriptorSha256',
        ...(value.schemaVersion === 4 ? ['taskEdits'] : value.schemaVersion === 5 ? ['authorizations'] : [])]);
    exact(value.basis, ['record', 'nativeCut', 'historyBasis', 'closedRevision', 'prefixSha256', 'stateSnapshotSha256']);
    revisionReference(value.basis.record);
    fact(value, 'descriptorSha256');
    if ((value.schemaVersion === 2 ? value.encoding !== 'native-mvu-schema-story-revision-descriptor-v2'
        : value.schemaVersion === 3 ? value.encoding !== 'native-mvu-schema-story-revision-descriptor-v3'
            : value.schemaVersion === 4 ? value.encoding !== 'native-mvu-schema-story-revision-descriptor-v4'
                : value.schemaVersion !== 5 || value.encoding !== 'native-mvu-schema-story-revision-descriptor-v5')
        || !id(value.sessionId, 64) || !Array.isArray(value.edits) || !Array.isArray(value.originals)
        || !integer(value.basis.nativeCut) || !integer(value.completionSeq) || !integer(value.publicationRevision, 2)
        || ![value.basis.prefixSha256, value.basis.stateSnapshotSha256, value.sourceSha256].every(hash))
        fail();
    if (value.basis.historyBasis !== null)
        revisionHistoryBasis(value.basis.historyBasis);
    if (value.basis.closedRevision !== null)
        revisionReference(value.basis.closedRevision);
    for (const edit of value.edits) {
        exact(edit, ['seq', 'sha256', 'targetSeq', 'messageId', 'messageVersionSha256', 'narrativeSha256',
            ...(value.schemaVersion === 4 || value.schemaVersion === 5 ? ['role'] : [])]);
        if (!integer(edit.seq) || !integer(edit.targetSeq) || edit.targetSeq >= edit.seq || !id(edit.messageId)
            || ![edit.sha256, edit.messageVersionSha256, edit.narrativeSha256].every(hash))
            fail();
    }
    if (value.schemaVersion !== 2)
        for (const original of value.originals) {
            exact(original, ['kind', 'event']);
            if (original.kind !== 'story' && original.kind !== 'manual')
                fail();
            revisionReference(original.event);
        }
    else
        for (const original of value.originals)
            revisionReference(original);
    if (value.schemaVersion === 4) {
        if (!Array.isArray(value.taskEdits) || !value.taskEdits.length)
            fail();
        for (const edit of value.edits)
            if (edit.role !== 'assistant' && edit.role !== 'user')
                fail();
        for (const item of value.taskEdits) {
            exact(item, ['index', 'selection']);
            exact(item.selection, ['canonicalSeq', 'originEventRef', 'sourceEventRef', 'effectiveKind', 'mode', 'intent', 'binding']);
            if (!integer(item.index) || item.index >= value.originals.length)
                fail();
            validateSchemaTaskArtifactV1(item.selection);
            revisionReference(item.selection.intent);
            revisionReference(item.selection.binding);
        }
    }
    if (value.schemaVersion === 5) {
        if (!Array.isArray(value.authorizations) || !value.authorizations.length)
            fail();
        for (const authorization of value.authorizations) {
            exact(authorization, ['edit', 'proof']);
            exact(authorization.edit, ['seq', 'sha256']);
            if (!integer(authorization.edit.seq) || !hash(authorization.edit.sha256))
                fail();
            if (authorization.proof.kind === 'intent') {
                exact(authorization.proof, ['kind', 'intent', 'binding']);
                revisionReference(authorization.proof.intent);
                revisionReference(authorization.proof.binding);
            }
            else if (authorization.proof.kind === 'completed-v4') {
                exact(authorization.proof, ['kind', 'descriptor', 'completion']);
                revisionReference(authorization.proof.descriptor);
                revisionReference(authorization.proof.completion);
            }
            else if (authorization.proof.kind === 'post-commit-recovery') {
                exact(authorization.proof, ['kind', 'intent']);
                revisionReference(authorization.proof.intent);
            }
            else
                fail();
        }
        for (const edit of value.edits)
            if (edit.role !== 'assistant' && edit.role !== 'user')
                fail();
    }
    if (value.previous !== null)
        revisionReference(value.previous);
    return value;
}
const validateRevisionDescriptor = createImmutableDescriptorValidator((input) => {
    const value = freezeMvuSchemaStoryData(input);
    return validateRevisionDescriptorV2(value);
});
export function validateMvuSchemaStoryRevisionDescriptor(input) {
    return validateRevisionDescriptor(input);
}
/** Only descriptor integrity is established here. The publishing owner joins
 * the ordered event refs to its selected originals and complete suffix. */
export function validateMvuSchemaStoryRevisionCompletion(input) {
    const value = freezeMvuSchemaStoryData(input);
    exact(value, ['schemaVersion', 'encoding', 'sessionId', 'descriptor', 'events', 'completionSha256']);
    fact(value, 'completionSha256');
    if (!(value.schemaVersion === 2 && value.encoding === 'native-mvu-schema-story-revision-completion-v2'
        || value.schemaVersion === 3 && value.encoding === 'native-mvu-schema-story-revision-completion-v3'
        || value.schemaVersion === 4 && value.encoding === 'native-mvu-schema-story-revision-completion-v4'
        || value.schemaVersion === 5 && value.encoding === 'native-mvu-schema-story-revision-completion-v5')
        || !id(value.sessionId, 64) || !Array.isArray(value.events))
        fail();
    revisionReference(value.descriptor);
    for (const event of value.events)
        revisionReference(event);
    return value;
}
export function mvuSchemaStoryHead(event) {
    if (event.outcome !== 'accepted')
        return event.plan.base.currentHead;
    return freezeMvuSchemaStoryData({ schemaVersion: 2, encoding: 'native-mvu-schema-story-head-v2',
        sessionId: event.sessionId, sourceSha256: event.sourceSha256, root: event.plan.base.root,
        revision: event.plan.base.revision + 1, eventId: event.eventId, eventSha256: event.eventSha256,
        planSha256: event.plan.planSha256, valuesSha256: event.valuesSha256 });
}
export function mvuSchemaStorySettlement(event) {
    const head = mvuSchemaStoryHead(event);
    return sealMvuSchemaStoryFact({ schemaVersion: 2, encoding: 'native-mvu-schema-story-settlement-v2',
        sessionId: event.sessionId, sourceSha256: event.sourceSha256, planSha256: event.plan.planSha256,
        completedReceiptSha256: recordSha256(event.plan.scope.receipt), outcome: event.outcome,
        event: { key: mvuSchemaStoryEventKey(event.sessionId, event.eventId), sha256: event.eventSha256 },
        result: { head, headSha256: recordSha256(head), revision: head.revision, valuesSha256: event.valuesSha256,
            contextSha256: recordSha256(event.context), frontier: event.frontier } }, 'settlementSha256');
}
export function validateMvuSchemaStorySettlement(input, event) {
    const value = freezeMvuSchemaStoryData(input);
    fact(value, 'settlementSha256');
    if (!same(value, mvuSchemaStorySettlement(validateMvuSchemaStoryEvent(event))))
        fail();
    return value;
}
