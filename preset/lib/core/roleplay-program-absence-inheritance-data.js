// Generated from runtime/alpha3/src/core/roleplay-program-absence-inheritance-data.ts; edit the TypeScript source.
/** Complete historical opening data for an absent numerical domain. No table,
 * Native cut, Source owner, model, publication or runtime permission is read. */
import { recordSha256 } from './roleplay-data.js';
import { programOpeningRecordDataV1, validateProgramOpeningSeedV1, validateProgramOpeningInputV1, validateProgramOpeningAbsentDomainV1, validateProgramOpeningNativeFactsV1, validateOpeningIntentV7, programOpeningSeedKeyV1, programOpeningInputKeyV1, programOpeningDomainKeyV1 } from './roleplay-program-opening-records.js';
import { openingIntentKey } from './roleplay-opening-selection.js';
import { roleplayOpeningMaterialKeysV1 } from './roleplay-opening-material.js';
import { nativeInputSha256, validateNativeGeneratedOpeningReceiptV1, validateNativeOpeningClosingAckV1 } from '@deepseek-ai/dsh-agent-loop';
export class ProgramAbsenceOpeningDataFailureV1 extends Error {
    code;
    constructor(code = 'PROGRAM_ABSENCE_OPENING_INVALID') {
        super(code);
        this.code = code;
        this.name = 'ProgramAbsenceOpeningDataFailureV1';
    }
}
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value, max = 128) => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value)
    && value.length > 0 && value.length <= max;
const count = (value, positive = false) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= (positive ? 1 : 0) && !Object.is(value, -0);
const same = (left, right) => recordSha256(left) === recordSha256(right);
function fail() { throw new ProgramAbsenceOpeningDataFailureV1(); }
function exact(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
        || keys.some(key => !Object.hasOwn(value, key)))
        fail();
}
function dataRef(value, key) {
    exact(value, ['key', 'sha256']);
    if (!id(value['key'], 512) || !hash(value['sha256']) || key !== undefined && value['key'] !== key)
        fail();
}
function eventRef(value) {
    exact(value, ['seq', 'sha256']);
    if (!count(value['seq']) || !hash(value['sha256']))
        fail();
}
function boundRef(ref, value, key) {
    dataRef(ref, key);
    if (ref.sha256 !== recordSha256(value))
        fail();
}
/** The whole closure's descriptor/budget copier has already checked this
 * original transform. Only Native transform spelling is constrained here;
 * authors' raw card data and generic Source/static JSON keep their contracts. */
function nativeTransformSpelling(value) {
    const pending = [value];
    while (pending.length) {
        const item = pending.pop();
        if (item === undefined || typeof item === 'number' && Object.is(item, -0))
            fail();
        if (item !== null && typeof item === 'object')
            pending.push(...Object.values(item));
    }
}
function materialRecord(raw, ref, kind, step, receipt, packet, original) {
    exact(raw, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'identity', 'seedRef', 'inputRef', 'nativeOwner',
        'turn', 'step', 'kind', 'payload']);
    exact(raw['nativeOwner'], ['kind', 'identity', 'invocationRef']);
    eventRef(raw['nativeOwner']['invocationRef']);
    dataRef(raw['seedRef']);
    dataRef(raw['inputRef']);
    exact(raw['identity'], ['kind', 'sessionId', 'operationId', 'messageId', 'instruction', 'instructionSha256', 'intentRef']);
    const keys = roleplayOpeningMaterialKeysV1(packet.seed.sessionId, packet.refs.seed, receipt.turn, step);
    if (raw['schemaVersion'] !== 1 || raw['encoding'] !== 'core-program-opening-material-record-v1'
        || raw['authority'] !== 'consumer-data-only' || raw['sessionId'] !== packet.seed.sessionId || raw['kind'] !== kind
        || !count(raw['turn'], true) || raw['turn'] !== receipt.turn || !count(raw['step'], true) || raw['step'] !== step
        || ref.key !== keys[kind] || !same(raw['identity'], receipt.identity) || raw['nativeOwner']['kind'] !== 'programmatic-opening'
        || !same(raw['nativeOwner']['identity'], receipt.identity) || !same(raw['nativeOwner']['invocationRef'], receipt.invocationRef)
        || !same(raw['seedRef'], packet.refs.seed) || !same(raw['inputRef'], packet.refs.input)
        || !raw['payload'] || typeof raw['payload'] !== 'object' || Array.isArray(raw['payload']))
        fail();
    if (kind === 'plan') {
        // These are historical bound data. Neither the current task-preparation
        // row nor today's context-window row is part of this packet's permission.
        exact(raw['payload'], ['promptPlan', 'nativeTransform', 'nativeTransformSha256']);
        if (!raw['payload']['promptPlan'] || typeof raw['payload']['promptPlan'] !== 'object'
            || Array.isArray(raw['payload']['promptPlan']) || !raw['payload']['nativeTransform']
            || typeof raw['payload']['nativeTransform'] !== 'object' || Array.isArray(raw['payload']['nativeTransform'])
            || !hash(raw['payload']['nativeTransformSha256']))
            fail();
        const transform = original.payload['nativeTransform'];
        nativeTransformSpelling(transform);
        // The transform belongs to Native's selected-material canonical domain;
        // whole Core row/ref hashes above remain the distinct recordSHA domain.
        if (nativeInputSha256(transform) !== raw['payload']['nativeTransformSha256'])
            fail();
    }
    return raw;
}
/** Exact deduplicated receipt catalog. A checksum-bound payload remains data;
 * actual provider/header/Native material event agreement belongs to Root. */
function materialCatalog(packet, receipt, originals) {
    const expected = new Map();
    for (const step of receipt.steps)
        for (const request of step.requests) {
            for (const kind of ['snapshot', 'plan']) {
                const ref = request[kind], prior = expected.get(ref.key);
                if (prior && (prior.sha256 !== ref.sha256 || prior.kind !== kind || prior.step !== step.step))
                    fail();
                expected.set(ref.key, { sha256: ref.sha256, kind, step: step.step });
            }
        }
    if (packet.materialRows.length !== expected.size)
        fail();
    const seen = new Set(), rows = new Map();
    for (const [index, row] of packet.materialRows.entries()) {
        exact(row, ['ref', 'value']);
        dataRef(row.ref);
        const item = expected.get(row.ref.key);
        if (!item || seen.has(row.ref.key) || item.sha256 !== row.ref.sha256 || recordSha256(row.value) !== row.ref.sha256)
            fail();
        seen.add(row.ref.key);
        rows.set(row.ref.key, materialRecord(row.value, row.ref, item.kind, item.step, receipt, packet, originals[index].value));
    }
    for (const step of receipt.steps)
        for (const request of step.requests) {
            const snapshot = rows.get(request.snapshot.key), plan = rows.get(request.plan.key);
            if (!snapshot || !plan)
                fail();
            for (const key of ['sessionId', 'identity', 'seedRef', 'inputRef', 'nativeOwner', 'turn', 'step']) {
                if (!same(snapshot[key], plan[key]))
                    fail();
            }
        }
}
const checkedClosures = new WeakSet();
/** Grammar, joins and hashes only. Even a returned frozen packet cannot prove
 * numerical absence today, actual parent/child Native prefix or Source currency. */
export function validateProgramAbsenceOpeningClosureV1(input) {
    if (input !== null && typeof input === 'object' && checkedClosures.has(input)) {
        return input;
    }
    // Check all descriptors before reading original Native packets. The copier
    // normalizes JSON -0/undefined, so stronger Native parsers receive originals.
    const value = programOpeningRecordDataV1(input);
    exact(value, ['schemaVersion', 'encoding', 'authority', 'ownerSessionId', 'data', 'closureSha256']);
    const { closureSha256, ...body } = value;
    if (value['schemaVersion'] !== 1 || value['encoding'] !== 'native-program-absence-opening-closure-v1'
        || value['authority'] !== 'consumer-data-only' || !id(value['ownerSessionId'], 64)
        || !hash(closureSha256) || recordSha256(body) !== closureSha256)
        fail();
    const data = value['data'];
    exact(data, ['seed', 'input', 'intent', 'absenceDomain', 'refs', 'acknowledgement', 'materialRows']);
    exact(data['refs'], ['seed', 'input', 'intent', 'absenceDomain']);
    if (!Array.isArray(data['materialRows']) || data['materialRows'].length > 512)
        fail();
    const original = input.data, seed = validateProgramOpeningSeedV1(data['seed']), packet = validateProgramOpeningInputV1(data['input'], seed), absenceDomain = validateProgramOpeningAbsentDomainV1(original.absenceDomain, { seed, input: packet }), intent = validateOpeningIntentV7(original.intent, { seed, input: packet, planRecord: null, absenceDomain });
    if (seed.sessionId !== value['ownerSessionId'] || packet.initialization !== 'absent' || intent.status !== 'completed'
        || intent.planRef !== null || Object.hasOwn(intent, 'genesisEnvelope') || !intent.nativeReceipt
        || intent.domainReceipt?.kind !== 'prompt-absence')
        fail();
    const native = validateProgramOpeningNativeFactsV1(original.intent.nativeReceipt, seed, packet);
    if (!same(native, absenceDomain.nativeFacts) || !same(native, intent.nativeReceipt))
        fail();
    const sid = seed.sessionId, op = seed.operationId, refs = data['refs'];
    boundRef(refs['seed'], seed, programOpeningSeedKeyV1(sid, op));
    boundRef(refs['input'], packet, programOpeningInputKeyV1(sid, op));
    boundRef(refs['intent'], intent, openingIntentKey(sid, seed.source.importId));
    boundRef(refs['absenceDomain'], absenceDomain, programOpeningDomainKeyV1(sid, op));
    if (!same(intent.seedRef, refs['seed']) || !same(packet.seedRef, refs['seed']) || !same(intent.inputRef, refs['input'])
        || !same(absenceDomain.seedRef, refs['seed']) || !same(absenceDomain.inputRef, refs['input'])
        || !same(intent.domainReceipt.domainRef, refs['absenceDomain']))
        fail();
    const retained = { ...data, seed, input: packet, intent, absenceDomain };
    if (seed.production === 'selected-card-copy') {
        if (data['acknowledgement'] !== null || data['materialRows'].length !== 0)
            fail();
    }
    else {
        if (native.production !== 'generated-opening')
            fail();
        const receipt = validateNativeGeneratedOpeningReceiptV1(original.intent.nativeReceipt.receipt), ack = data['acknowledgement'];
        exact(ack, ['generatedReceiptRef', 'closingAckRef', 'closingAck']);
        eventRef(ack['generatedReceiptRef']);
        eventRef(ack['closingAckRef']);
        exact(original.acknowledgement, ['generatedReceiptRef', 'closingAckRef', 'closingAck']);
        eventRef(original.acknowledgement.generatedReceiptRef);
        eventRef(original.acknowledgement.closingAckRef);
        const checkedAck = validateNativeOpeningClosingAckV1(original.acknowledgement.closingAck);
        if (!same(checkedAck, ack['closingAck']) || !same(checkedAck.invocationRef, receipt.invocationRef)
            || !same(checkedAck.generatedReceiptRef, ack['generatedReceiptRef']) || checkedAck.receiptSha256 !== receipt.receiptSha256
            || checkedAck.ownerReceiptSha256 !== recordSha256(intent.domainReceipt)
            || ack['generatedReceiptRef'].seq <= receipt.turnEndRef.seq
            || ack['closingAckRef'].seq <= ack['generatedReceiptRef'].seq)
            fail();
        materialCatalog(retained, receipt, original.materialRows);
    }
    const checked = Object.freeze({ ...value, data: Object.freeze(retained) });
    if (JSON.stringify(checked) !== JSON.stringify(value))
        fail();
    checkedClosures.add(checked);
    return checked;
}
export function createProgramAbsenceOpeningClosureV1(input) {
    const body = { schemaVersion: 1, encoding: 'native-program-absence-opening-closure-v1',
        authority: 'consumer-data-only', ownerSessionId: input.ownerSessionId, data: input.data };
    return validateProgramAbsenceOpeningClosureV1({ ...body, closureSha256: recordSha256(body) });
}
