// Generated from runtime/alpha3/src/core/tavern-template-injection-data.mts; edit the TypeScript source.
import { types as nodeTypes } from 'node:util';
import { recordSha256 } from './roleplay-data.js';
import { schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { TEMPLATE_LIMITS_V1, TEMPLATE_POLICY_SHA256, cloneTemplateEnvelopeV1, freezeTemplateData, templateExact, templateFail, templateHash, templateId, validateTemplateRequestV1, validateTemplateSnapshotV1, validateTemplateOutputV1 } from './tavern-template-data.mjs';
/** Inspect only the outer ledger container. Deep cloning the entire history
 * would silently replace the existing single-payload 8 MiB contract. Each
 * request, phase and receipt is separately copied under its own fixed bound. */
function fields(input, names) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || nodeTypes.isProxy(input))
        templateFail('TEMPLATE_INJECTION_INPUT_INVALID');
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null)
        templateFail('TEMPLATE_INJECTION_INPUT_INVALID');
    const properties = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(properties);
    if (keys.length !== names.length || keys.some(key => typeof key !== 'string' || !names.includes(key))) {
        templateFail('TEMPLATE_INJECTION_INPUT_INVALID');
    }
    const data = Object.create(null);
    for (const key of names) {
        const property = properties[key];
        if (!property || !Object.hasOwn(property, 'value') || !property.enumerable)
            templateFail('TEMPLATE_INJECTION_INPUT_INVALID');
        data[key] = property.value;
    }
    return data;
}
const ordinal = (value) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= 0 && value < TEMPLATE_LIMITS_V1.injectionHandles;
export function validateInjectionPhaseV1(raw) {
    const data = cloneTemplateEnvelopeV1(raw, { bytes: 'workerInputBytes', nodes: 'workerInputNodes', depth: 'workerInputDepth' });
    templateExact(data, ['schemaVersion', 'encoding', 'snapshot', 'schedule', 'phaseSha256']);
    if (data.schemaVersion !== 1 || data.encoding !== 'owned-template-injection-phase-v1' || !templateHash(data.phaseSha256)
        || !Array.isArray(data.schedule) || data.schedule.length > TEMPLATE_LIMITS_V1.injectionScheduleActions) {
        templateFail('TEMPLATE_INJECTION_PHASE_INVALID');
    }
    const snapshot = validateTemplateSnapshotV1(data.snapshot), seen = new Set();
    for (const action of data.schedule) {
        if (action?.kind === 'filter') {
            templateExact(action, ['kind', 'callbackOrdinal', 'consumer', 'invocationId']);
            if (!ordinal(action.callbackOrdinal) || !['scan', 'chat'].includes(String(action.consumer)))
                templateFail('TEMPLATE_INJECTION_SCHEDULE_INVALID');
        }
        else {
            templateExact(action, ['kind', 'batchOrdinal', 'consumer', 'invocationId']);
            if (action.kind !== 'dispose-batch' || !ordinal(action.batchOrdinal)
                || !['terminal', 'owner-close'].includes(String(action.consumer)))
                templateFail('TEMPLATE_INJECTION_SCHEDULE_INVALID');
        }
        if (!templateId(action.invocationId) || seen.has(action.invocationId))
            templateFail('TEMPLATE_INJECTION_SCHEDULE_INVALID');
        seen.add(action.invocationId);
    }
    const { phaseSha256, ...body } = data;
    if (recordSha256(body) !== phaseSha256)
        templateFail('TEMPLATE_INJECTION_PHASE_HASH');
    return freezeTemplateData({ ...data, snapshot });
}
/** A callback's execution root is fresh and belongs to the active read basis.
 * Historical rootEntryId is not reused as a live Source entry proof. */
export function injectionPhaseRequestV1(creation, phase) {
    const { rootEntryId: _old, ...source } = creation.source;
    const body = { schemaVersion: 1, encoding: 'owned-template-request-v1',
        source: { ...source, sourceSnapshotSha256: phase.snapshot.sourceSnapshotSha256, packageSha256: phase.snapshot.packageSha256 },
        snapshot: phase.snapshot };
    return validateTemplateRequestV1({ ...body, requestSha256: recordSha256(body) });
}
export function injectionCreationHeadV1(programInstanceId, request, output) {
    return recordSha256({ encoding: 'owned-template-injection-head-v1', programInstanceId,
        requestSha256: request.requestSha256, outputSha256: output.outputSha256, engine: output.engine });
}
export function validateInjectionReceiptV1(raw, programInstanceId, previousHeadSha256, phase, creation, engine) {
    const data = cloneTemplateEnvelopeV1(raw, { bytes: 'injectionReceiptBytes', nodes: 'injectionReceiptNodes', depth: 'injectionReceiptDepth' });
    templateExact(data, ['schemaVersion', 'encoding', 'authority', 'programInstanceId', 'phaseSha256', 'previousHeadSha256',
        'engine', 'invocations', 'nextBatchOrdinal', 'nextCallbackOrdinal', 'nextEffectOrdinal', 'receiptSha256']);
    if (data.schemaVersion !== 1 || data.encoding !== 'owned-template-injection-receipt-v1' || data.authority !== 'consumer-data-only'
        || data.programInstanceId !== programInstanceId || data.phaseSha256 !== phase.phaseSha256
        || data.previousHeadSha256 !== previousHeadSha256 || recordSha256(data.engine) !== recordSha256(engine)
        || !Array.isArray(data.invocations) || data.invocations.length !== phase.schedule.length)
        templateFail('TEMPLATE_INJECTION_RECEIPT_INVALID');
    const request = injectionPhaseRequestV1(creation, phase);
    for (let index = 0; index < phase.schedule.length; index++) {
        const row = data.invocations[index], action = phase.schedule[index];
        templateExact(row, ['action', 'accepted', 'output']);
        if (recordSha256(row.action) !== recordSha256(action)
            || (action.kind === 'filter' ? typeof row.accepted !== 'boolean' : row.accepted !== null))
            templateFail('TEMPLATE_INJECTION_RECEIPT_INVALID');
        validateTemplateOutputV1(row.output, request, engine);
    }
    for (const key of ['nextBatchOrdinal', 'nextCallbackOrdinal', 'nextEffectOrdinal']) {
        const maximum = key === 'nextEffectOrdinal' ? TEMPLATE_LIMITS_V1.injectionEffects : TEMPLATE_LIMITS_V1.injectionHandles;
        if (typeof data[key] !== 'number' || !Number.isSafeInteger(data[key]) || data[key] < 0 || data[key] > maximum)
            templateFail('TEMPLATE_INJECTION_RECEIPT_INVALID');
    }
    const { receiptSha256, ...body } = data;
    if (!templateHash(receiptSha256) || recordSha256(body) !== receiptSha256)
        templateFail('TEMPLATE_INJECTION_RECEIPT_HASH');
    return freezeTemplateData(data);
}
export function validateInjectionRestoreV1(raw, engine) {
    const outer = fields(raw, ['schemaVersion', 'encoding', 'programInstanceId', 'creation', 'journal', 'expectedHeadSha256', 'current']);
    if (outer.schemaVersion !== 1 || outer.encoding !== 'owned-template-injection-restore-v1' || !templateId(outer.programInstanceId)
        || !templateHash(outer.expectedHeadSha256))
        templateFail('TEMPLATE_INJECTION_INPUT_INVALID');
    const creation = fields(outer.creation, ['request', 'expectedOutput']);
    const request = validateTemplateRequestV1(creation.request), expectedOutput = validateTemplateOutputV1(creation.expectedOutput, request, engine);
    let bytes = Buffer.byteLength(JSON.stringify({ request, expectedOutput }), 'utf8');
    const charge = (value) => {
        bytes += Buffer.byteLength(JSON.stringify(value), 'utf8');
        if (bytes > TEMPLATE_LIMITS_V1.injectionInputBytes)
            templateFail('TEMPLATE_INJECTION_RESTORE_LIMIT', null, { field: 'injectionInputBytes', observed: bytes, maximum: TEMPLATE_LIMITS_V1.injectionInputBytes });
    };
    const journalRaw = outer.journal;
    if (!Array.isArray(journalRaw) || nodeTypes.isProxy(journalRaw) || journalRaw.length > TEMPLATE_LIMITS_V1.injectionJournalPhases) {
        templateFail('TEMPLATE_INJECTION_RESTORE_LIMIT', null, { field: 'injectionJournalPhases', observed: null,
            maximum: TEMPLATE_LIMITS_V1.injectionJournalPhases });
    }
    const properties = Object.getOwnPropertyDescriptors(journalRaw);
    if (Reflect.ownKeys(properties).length !== journalRaw.length + 1)
        templateFail('TEMPLATE_INJECTION_INPUT_INVALID');
    let head = injectionCreationHeadV1(outer.programInstanceId, request, expectedOutput);
    const journal = [];
    const checkOwner = (phase) => {
        if (phase.snapshot.sessionId !== request.snapshot.sessionId || phase.snapshot.branchId !== request.snapshot.branchId
            || phase.snapshot.packageSha256 !== request.snapshot.packageSha256)
            templateFail('TEMPLATE_INJECTION_READ_BASIS_MISMATCH');
    };
    for (let index = 0; index < journalRaw.length; index++) {
        const property = properties[String(index)];
        if (!property || !Object.hasOwn(property, 'value') || !property.enumerable)
            templateFail('TEMPLATE_INJECTION_INPUT_INVALID');
        const row = fields(property.value, ['phase', 'expectedReceipt']), phase = validateInjectionPhaseV1(row.phase);
        checkOwner(phase);
        const expectedReceipt = validateInjectionReceiptV1(row.expectedReceipt, outer.programInstanceId, head, phase, request, engine);
        charge({ phase, expectedReceipt });
        journal.push({ phase, expectedReceipt });
        head = expectedReceipt.receiptSha256;
    }
    if (head !== outer.expectedHeadSha256)
        templateFail('TEMPLATE_INJECTION_HEAD_MISMATCH');
    const current = validateInjectionPhaseV1(outer.current);
    checkOwner(current);
    charge(current);
    return freezeTemplateData({ ...outer, creation: { request, expectedOutput }, journal, current });
}
/** Deterministic formatting for Root's actual terminal/owner-close fold. This
 * is not observed VM execution and cannot authorize Native cleanup. Only the
 * private bridge-owned batch disposer is derivable: it never invokes authors,
 * emits its immutable original ID list once, and marks its own deleted bit.
 * The next actual cold restore still compares this full receipt to the real
 * disposer execution, including its private deleted state and effect ordinal. */
export function deriveTrustedInjectionDisposalReceiptV1(programInstanceId, request, expectedOutput, acceptedJournal, expectedHeadSha256, current, engine) {
    if (engine.policySha256 !== TEMPLATE_POLICY_SHA256)
        templateFail('TEMPLATE_ENGINE_IDENTITY');
    const input = validateInjectionRestoreV1({ schemaVersion: 1, encoding: 'owned-template-injection-restore-v1',
        programInstanceId, creation: { request, expectedOutput }, journal: acceptedJournal, expectedHeadSha256, current }, engine);
    if (input.current.schedule.some(action => action.kind !== 'dispose-batch'))
        templateFail('TEMPLATE_INJECTION_DISPOSAL_SCHEDULE');
    const batches = new Map();
    let nextBatchOrdinal = 0, nextCallbackOrdinal = 0, nextEffectOrdinal = 0;
    const fold = (output) => {
        for (const effect of output.injectionEffects ?? []) {
            if (effect.ordinal !== nextEffectOrdinal++)
                templateFail('TEMPLATE_INJECTION_EFFECT_ORDER');
            if (effect.kind === 'batch-created') {
                if (effect.batchOrdinal !== nextBatchOrdinal++)
                    templateFail('TEMPLATE_INJECTION_EFFECT_ORDER');
                batches.set(effect.batchOrdinal, { ids: effect.ids, deleted: false });
            }
            else if (effect.kind === 'register') {
                const batch = batches.get(effect.prompt.batchOrdinal);
                if (!batch || !batch.ids.includes(effect.prompt.id))
                    templateFail('TEMPLATE_INJECTION_EFFECT_ORDER');
                if (effect.prompt.callbackOrdinal !== null && effect.prompt.callbackOrdinal !== nextCallbackOrdinal++) {
                    templateFail('TEMPLATE_INJECTION_EFFECT_ORDER');
                }
            }
            else if (effect.batchOrdinal !== null) {
                const batch = batches.get(effect.batchOrdinal);
                if (!batch || batch.deleted || recordSha256(batch.ids) !== recordSha256(effect.ids)) {
                    templateFail('TEMPLATE_INJECTION_EFFECT_ORDER');
                }
                batch.deleted = true;
            }
        }
    };
    fold(input.creation.expectedOutput);
    for (const row of input.journal) {
        for (const invocation of row.expectedReceipt.invocations) {
            if (invocation.action.kind === 'dispose-batch') {
                const batch = batches.get(invocation.action.batchOrdinal), output = invocation.output;
                if (!batch || output.renderedText !== '' || output.readDependencies.length || output.activationProposals.length
                    || output.nestedRenders.length || (output.injectionEffects?.length ?? 0) !== (batch.deleted ? 0 : 1)) {
                    templateFail('TEMPLATE_INJECTION_DISPOSAL_TRACE');
                }
                if (!batch.deleted) {
                    const effect = output.injectionEffects[0];
                    if (effect.kind !== 'remove-ids' || effect.batchOrdinal !== invocation.action.batchOrdinal) {
                        templateFail('TEMPLATE_INJECTION_DISPOSAL_TRACE');
                    }
                }
            }
            fold(invocation.output);
        }
        if (row.expectedReceipt.nextBatchOrdinal !== nextBatchOrdinal
            || row.expectedReceipt.nextCallbackOrdinal !== nextCallbackOrdinal
            || row.expectedReceipt.nextEffectOrdinal !== nextEffectOrdinal)
            templateFail('TEMPLATE_INJECTION_EFFECT_ORDER');
    }
    const phaseRequest = injectionPhaseRequestV1(input.creation.request, input.current);
    const invocations = [];
    for (const action of input.current.schedule) {
        if (action.kind !== 'dispose-batch')
            templateFail('TEMPLATE_INJECTION_DISPOSAL_SCHEDULE');
        const batch = batches.get(action.batchOrdinal);
        if (!batch)
            templateFail('TEMPLATE_INJECTION_HANDLE_MISSING');
        let injectionEffects;
        if (!batch.deleted) {
            if (nextEffectOrdinal >= TEMPLATE_LIMITS_V1.injectionEffects)
                templateFail('TEMPLATE_INJECTION_RESTORE_LIMIT', null, { field: 'injectionEffects', observed: nextEffectOrdinal + 1, maximum: TEMPLATE_LIMITS_V1.injectionEffects });
            injectionEffects = [{ ordinal: nextEffectOrdinal++, kind: 'remove-ids', ids: batch.ids, batchOrdinal: action.batchOrdinal }];
            batch.deleted = true;
        }
        const body = { schemaVersion: 1, encoding: 'owned-template-output-v1',
            authority: 'consumer-data-only', requestSha256: phaseRequest.requestSha256,
            sourceSha256: phaseRequest.source.templateSha256, sourcePointer: phaseRequest.source.pointer,
            snapshotSha256: phaseRequest.snapshot.snapshotSha256, engine, renderedText: '', renderedTextSha256: schemaTextSha256(''),
            readDependencies: [], activationProposals: [], nestedRenders: [], ...injectionEffects ? { injectionEffects } : {} };
        const output = validateTemplateOutputV1({ ...body, outputSha256: recordSha256(body) }, phaseRequest, engine);
        invocations.push({ action, accepted: null, output });
    }
    const body = { schemaVersion: 1,
        encoding: 'owned-template-injection-receipt-v1', authority: 'consumer-data-only', programInstanceId,
        phaseSha256: input.current.phaseSha256, previousHeadSha256: input.expectedHeadSha256, engine, invocations,
        nextBatchOrdinal, nextCallbackOrdinal, nextEffectOrdinal };
    const receipt = validateInjectionReceiptV1({ ...body, receiptSha256: recordSha256(body) }, programInstanceId, input.expectedHeadSha256, input.current, input.creation.request, engine);
    const derivationBody = { schemaVersion: 1,
        encoding: 'owned-template-disposal-derived-v1', authority: 'consumer-data-only',
        origin: 'derived-trusted-disposal', policySha: TEMPLATE_POLICY_SHA256, programInstanceId,
        creationRequestSha256: input.creation.request.requestSha256, creationOutputSha256: input.creation.expectedOutput.outputSha256,
        previousHeadSha256: input.expectedHeadSha256, phaseSha256: input.current.phaseSha256, receiptSha256: receipt.receiptSha256,
        observedGuestExecution: false };
    return freezeTemplateData({ receipt, derivation: { ...derivationBody, derivationSha256: recordSha256(derivationBody) } });
}
