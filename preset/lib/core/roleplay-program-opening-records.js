// Generated from runtime/alpha3/src/core/roleplay-program-opening-records.ts; edit the TypeScript source.
/** Independent immutable opening inputs and a mutable recovery anchor. No
 * deserialized record grants Source, Native, material or publication rights. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { validatePromptOpeningSourceProofV1 } from './roleplay-prompt-opening-source.js';
import { prepareProgramMvuOpeningPlanV3, validateFrozenProgramMvuOpeningPlanV3, validateProgramGenesisNativeEnvelopeV1, validateProgramMvuGenesisFactsV1, programGenesisEventIdV1 } from './roleplay-program-genesis-data.js';
import { validateNativeGeneratedOpeningReceiptV1 } from '@deepseek-ai/dsh-agent-loop';
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value, maximum = 128) => typeof value === 'string' && value.length > 0
    && value.length <= maximum && /^[a-zA-Z0-9_-]+$/.test(value);
const count = (value, positive = false) => typeof value === 'number'
    && Number.isSafeInteger(value) && value >= (positive ? 1 : 0) && !Object.is(value, -0);
const same = (left, right) => recordSha256(left) === recordSha256(right);
function fail() { throw Error('PROGRAM_OPENING_RECORD_INVALID'); }
const checkedSeeds = new WeakMap();
const checkedInputs = new WeakMap();
const checkedBases = new WeakMap();
const checkedPlans = new WeakMap();
const checkedNativeFacts = new WeakMap();
const checkedAbsentDomains = new WeakMap();
function seedWholeSha256(seed) {
    const digest = checkedSeeds.get(seed);
    if (digest === undefined)
        fail();
    return digest;
}
function recordBinding(seed, packet) {
    const input = checkedInputs.get(packet), seedSha256 = seedWholeSha256(seed);
    if (!input || input.seedSha256 !== seedSha256)
        fail();
    return { seedSha256, inputSha256: input.wholeSha256 };
}
function boundRecord(input, records, binding) {
    if (input === null || typeof input !== 'object')
        return undefined;
    const cached = records.get(input);
    return cached?.seedSha256 === binding.seedSha256 && cached.inputSha256 === binding.inputSha256 ? input : undefined;
}
/** Reuse independently parsed children only when the exact persisted JSON
 * spelling is unchanged. Both operands are already descriptor-checked and
 * deeply frozen; this helper never reads a raw caller's object or getters. */
function parsedChildren(data, children) {
    const result = { ...data, ...children };
    if (JSON.stringify(result) !== JSON.stringify(data))
        fail();
    return Object.freeze(result);
}
export function programOpeningRecordDataV1(input) {
    const detached = cloneRoleplayTavernLoreDataV1(input), pending = [detached];
    while (pending.length) {
        const value = pending.pop();
        if (value && typeof value === 'object') {
            pending.push(...Object.values(value));
            Object.freeze(value);
        }
    }
    return detached;
}
function exact(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
        || keys.some(key => !Object.hasOwn(value, key)))
        fail();
}
function sealed(value, key) {
    const { [key]: digest, ...body } = value;
    if (!hash(digest) || recordSha256(body) !== digest)
        fail();
}
function ref(value) {
    exact(value, ['key', 'sha256']);
    if (!id(value['key'], 512) || !hash(value['sha256']))
        fail();
}
function optionalShape(value, required, optional) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || required.some(key => !Object.hasOwn(value, key))
        || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key)))
        fail();
}
function instruction(value, production) {
    if (production === 'selected-card-copy') {
        if (value !== null)
            fail();
        return null;
    }
    if (typeof value !== 'string' || !value.trim() || !value.isWellFormed() || Buffer.byteLength(value, 'utf8') > 65_536)
        fail();
    return value;
}
/** Preserves the source-owned pointer bytes, including the actual committed
 * fresh child's registered inheritedFrom field; it grants no Source lineage. */
function sourceTuple(value, sid) {
    exact(value, ['sessionId', 'importId', 'sourceRecordSessionId', 'rawSha256', 'normalizedSha256', 'transactionId', 'coverageSha256', 'pointer']);
    if (value['sessionId'] !== sid || !id(sid, 64) || !id(value['importId'], 64) || !id(value['sourceRecordSessionId'], 64)
        || !id(value['transactionId'], 128) || !hash(value['rawSha256']) || !hash(value['normalizedSha256'])
        || !hash(value['coverageSha256']))
        fail();
    const pointer = value['pointer'];
    optionalShape(pointer, ['importId', 'normalizedSha256', 'transactionId', 'coverageSha256'], ['sourceRecordSessionId', 'activatedAt', 'inheritedFrom']);
    if (pointer['importId'] !== value['importId'] || pointer['normalizedSha256'] !== value['normalizedSha256']
        || pointer['transactionId'] !== value['transactionId'] || pointer['coverageSha256'] !== value['coverageSha256']
        || (pointer['sourceRecordSessionId'] ?? sid) !== value['sourceRecordSessionId']
        || Object.hasOwn(pointer, 'sourceRecordSessionId') && !id(pointer['sourceRecordSessionId'], 64)
        || Object.hasOwn(pointer, 'activatedAt') && !count(pointer['activatedAt'])
        || Object.hasOwn(pointer, 'inheritedFrom') && !id(pointer['inheritedFrom'], 64))
        fail();
}
/** Complete inert basis grammar and joins. Actual absence, history, metadata
 * and storage membership must still be proved by Root's private supplier. */
export function validateProgramOpeningBasisProofV1(input, rawSource, owned) {
    const source = validatePromptOpeningSourceProofV1(rawSource), cached = input !== null && typeof input === 'object'
        ? checkedBases.get(input) : undefined;
    if (cached?.source === source && cached.sessionId === owned.sessionId && cached.operationId === owned.operationId
        && cached.requestedMessageId === owned.requestedMessageId)
        return input;
    const data = programOpeningRecordDataV1(input);
    exact(data, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'ownerSessionId', 'origin', 'operationId',
        'requestedMessageId', 'sourceBindingSha256', 'sourceRelation', 'branch', 'native', 'numerical', 'basisSha256']);
    sealed(data, 'basisSha256');
    exact(data['branch'], ['metaKey', 'metaCurrentIdentitySha256', 'parentSessionId', 'inheritedEventCount', 'ready']);
    exact(data['native'], ['observedThroughSeq', 'eventCount', 'historySha256']);
    exact(data['numerical'], ['statusRows', 'branchRows', 'membershipSha256', 'ownedInitializationCount', 'opaqueStateCount']);
    if (!id(owned.sessionId, 64) || !id(owned.operationId) || !id(owned.requestedMessageId)
        || data['schemaVersion'] !== 1 || data['encoding'] !== 'native-program-opening-fresh-basis-proof-v1'
        || data['authority'] !== 'consumer-data-only' || data['sessionId'] !== owned.sessionId
        || data['ownerSessionId'] !== owned.sessionId || source.source.sessionId !== owned.sessionId
        || data['operationId'] !== owned.operationId || data['requestedMessageId'] !== owned.requestedMessageId
        || data['sourceBindingSha256'] !== source.bindingSha256)
        fail();
    const branch = data['branch'], native = data['native'], numerical = data['numerical'], sid = owned.sessionId;
    if (branch['metaKey'] !== `${sid}__meta` || !hash(branch['metaCurrentIdentitySha256'])
        || branch['parentSessionId'] !== null || branch['inheritedEventCount'] !== 0 || branch['ready'] !== true
        || !count(native['eventCount']) || native['observedThroughSeq'] !== native['eventCount'] - 1 || !hash(native['historySha256'])
        || !Array.isArray(numerical['statusRows']) || !Array.isArray(numerical['branchRows'])
        || numerical['ownedInitializationCount'] !== 0 || numerical['opaqueStateCount'] !== 0
        || !hash(numerical['membershipSha256']) || numerical['membershipSha256'] !== recordSha256({
        statusRows: numerical['statusRows'], branchRows: numerical['branchRows']
    }))
        fail();
    const seen = new Set();
    for (const [table, rows] of [['status', numerical['statusRows']], ['branch', numerical['branchRows']]]) {
        let previous = '';
        for (const row of rows) {
            exact(row, ['table', 'key', 'exists', 'sha256', 'value']);
            if (row['table'] !== table || !id(row['key'], 512) || !row['key'].startsWith(sid + '__')
                || row['key'] <= previous || typeof row['exists'] !== 'boolean' || seen.has(table + ':' + row['key']))
                fail();
            previous = row['key'];
            seen.add(table + ':' + row['key']);
            if (row['exists']) {
                if (!row['value'] || typeof row['value'] !== 'object' || Array.isArray(row['value'])
                    || !hash(row['sha256']) || recordSha256(row['value']) !== row['sha256'])
                    fail();
            }
            else if (row['value'] !== null || row['sha256'] !== 'missing')
                fail();
        }
    }
    const relation = data['sourceRelation'];
    if (relation && typeof relation === 'object' && !Array.isArray(relation) && relation.kind === 'own-root') {
        exact(relation, ['kind', 'inheritance']);
        if (data['origin'] !== 'own-root' || relation['inheritance'] !== null || source.sourceRelation.kind !== 'own-root-source')
            fail();
    }
    else {
        exact(relation, ['kind', 'inheritance', 'setup', 'setupSha256']);
        if (data['origin'] !== 'fresh-scene' || relation['kind'] !== 'reserved-fresh-child'
            || source.sourceRelation.kind !== 'committed-fresh-cut0-source'
            || !same(relation['inheritance'], source.sourceRelation.inheritance) || !same(relation['setup'], source.sourceRelation.setup)
            || !hash(relation['setupSha256']) || recordSha256(relation['setup']) !== relation['setupSha256'])
            fail();
    }
    const checked = data;
    const sourceRelation = source.sourceRelation, expectedSourceRelation = sourceRelation.kind === 'own-root-source' ? { kind: 'own-root', inheritance: null } :
        { kind: 'reserved-fresh-child', inheritance: sourceRelation.inheritance, setup: sourceRelation.setup,
            setupSha256: recordSha256(sourceRelation.setup) }, dataHashes = Object.freeze({ bodySha256: checked.basisSha256, branchSha256: recordSha256(checked.branch),
        sourceRelationSha256: recordSha256(checked.sourceRelation),
        expectedSourceRelationSha256: recordSha256(expectedSourceRelation) });
    checkedBases.set(checked, { source, sessionId: owned.sessionId,
        operationId: owned.operationId, requestedMessageId: owned.requestedMessageId, dataHashes });
    return checked;
}
/** Pure hashes of this parser's exact immutable data, bound to its original
 * parsed Source and identity. No current owner or execution permission is cached. */
export function programOpeningBasisDataHashesV1(proof, source, identity) {
    const cached = checkedBases.get(proof);
    if (!cached || cached.source !== source || cached.sessionId !== identity.sessionId
        || cached.operationId !== identity.operationId || cached.requestedMessageId !== identity.requestedMessageId)
        return undefined;
    return cached.dataHashes;
}
export const programOpeningSeedKeyV1 = (sid, op) => `${sid}__program-opening-seed-${sha256(op)}`;
export const programOpeningInputKeyV1 = (sid, op) => `${sid}__program-opening-input-${sha256(op)}`;
export const programOpeningPlanKeyV1 = (sid, op) => `${sid}__program-opening-plan-${sha256(op)}`;
export const programOpeningDomainKeyV1 = (sid, op) => `${sid}__program-opening-domain-${sha256(op)}`;
export function programOpeningDataSha256V1(value) {
    // Only successful parser outputs enter these tables, and their complete
    // trees are frozen. The whole-row digest remains distinct from a body's
    // seedSha256/inputSha256. Actual storage reads still hash their own bytes.
    const ownedSeed = checkedSeeds.get(value), ownedInput = checkedInputs.get(value);
    return ownedSeed ?? ownedInput?.wholeSha256 ?? recordSha256(value);
}
export function programOpeningRefV1(key, value) {
    return { key, sha256: programOpeningDataSha256V1(value) };
}
export function createProgramOpeningSeedV1(input) {
    const source = validatePromptOpeningSourceProofV1(input.source), selected = source.selected, basis = validateProgramOpeningBasisProofV1(input.basis, source, { sessionId: source.source.sessionId,
        operationId: input.operationId, requestedMessageId: input.messageId }), text = instruction(input.instruction, input.production), body = { schemaVersion: 1, encoding: 'native-program-opening-intent-seed-v1',
        authority: 'consumer-data-only', sessionId: source.source.sessionId, source: source.source,
        operationId: input.operationId, requestedMessageId: input.messageId, production: input.production,
        instructionSha256: text === null ? null : sha256(text), sourceProofSha256: source.proofSha256,
        sourceBindingSha256: source.bindingSha256, basisSha256: basis.basisSha256,
        selected: { index: selected.index, sourcePointer: selected.sourcePointer, sourceSha256: selected.sourceSha256,
            renderedSha256: selected.renderedSha256 } };
    return validateProgramOpeningSeedV1({ ...body, seedSha256: recordSha256(body) });
}
export function validateProgramOpeningSeedV1(input) {
    if (input !== null && typeof input === 'object' && checkedSeeds.has(input)) {
        return input;
    }
    const data = programOpeningRecordDataV1(input);
    exact(data, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'source', 'operationId', 'requestedMessageId',
        'production', 'instructionSha256', 'sourceProofSha256', 'sourceBindingSha256', 'basisSha256', 'selected', 'seedSha256']);
    sealed(data, 'seedSha256');
    exact(data['selected'], ['index', 'sourcePointer', 'sourceSha256', 'renderedSha256']);
    if (data['schemaVersion'] !== 1 || data['encoding'] !== 'native-program-opening-intent-seed-v1'
        || data['authority'] !== 'consumer-data-only' || !id(data['sessionId']) || !id(data['operationId'])
        || !id(data['requestedMessageId']) || !['selected-card-copy', 'generated-opening'].includes(String(data['production']))
        || (data['production'] === 'generated-opening' ? !hash(data['instructionSha256']) : data['instructionSha256'] !== null))
        fail();
    for (const key of ['sourceProofSha256', 'sourceBindingSha256', 'basisSha256'])
        if (!hash(data[key]))
            fail();
    sourceTuple(data['source'], data['sessionId']);
    const selected = data['selected'];
    if (!count(selected['index']) || typeof selected['sourcePointer'] !== 'string' || !selected['sourcePointer'].startsWith('/')
        || selected['sourcePointer'].length > 512
        || !hash(selected['sourceSha256']) || !hash(selected['renderedSha256']))
        fail();
    const checked = data;
    checkedSeeds.set(checked, recordSha256(checked));
    return checked;
}
export function createProgramOpeningInputV1(input) {
    const body = { schemaVersion: 1, encoding: 'native-program-opening-input-packet-v1',
        authority: 'consumer-data-only', sessionId: input.seed.sessionId, seedRef: input.seedRef,
        source: input.source, basis: input.basis, instruction: input.instruction,
        initialization: input.source.initialization.kind, numericalSourceSha256: input.numericalSourceSha256 };
    return validateProgramOpeningInputV1({ ...body, inputSha256: recordSha256(body) }, input.seed);
}
export function validateProgramOpeningInputV1(input, rawSeed) {
    const seed = validateProgramOpeningSeedV1(rawSeed), seedSha256 = seedWholeSha256(seed), cached = input !== null && typeof input === 'object' ? checkedInputs.get(input) : undefined;
    if (cached?.seedSha256 === seedSha256)
        return input;
    const data = programOpeningRecordDataV1(input);
    exact(data, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'seedRef', 'source', 'basis', 'instruction',
        'initialization', 'numericalSourceSha256', 'inputSha256']);
    sealed(data, 'inputSha256');
    ref(data['seedRef']);
    const source = validatePromptOpeningSourceProofV1(data['source']), basis = validateProgramOpeningBasisProofV1(data['basis'], source, { sessionId: seed.sessionId, operationId: seed.operationId, requestedMessageId: seed.requestedMessageId });
    if (data['schemaVersion'] !== 1 || data['encoding'] !== 'native-program-opening-input-packet-v1'
        || data['authority'] !== 'consumer-data-only' || data['sessionId'] !== seed.sessionId
        || data['seedRef'].key !== programOpeningSeedKeyV1(seed.sessionId, seed.operationId)
        || data['seedRef'].sha256 !== recordSha256(seed) || source.proofSha256 !== seed.sourceProofSha256
        || source.bindingSha256 !== seed.sourceBindingSha256 || recordSha256(source.source) !== recordSha256(seed.source)
        || basis.basisSha256 !== seed.basisSha256 || basis.sessionId !== seed.sessionId || basis.operationId !== seed.operationId
        || basis.requestedMessageId !== seed.requestedMessageId || basis.sourceBindingSha256 !== source.bindingSha256
        || data['initialization'] !== source.initialization.kind || !hash(data['numericalSourceSha256']))
        fail();
    const { basisSha256, ...basisBody } = basis;
    if (recordSha256(basisBody) !== basisSha256 || recordSha256(seed.selected) !== recordSha256({
        index: source.selected.index, sourcePointer: source.selected.sourcePointer, sourceSha256: source.selected.sourceSha256,
        renderedSha256: source.selected.renderedSha256
    }))
        fail();
    const text = instruction(data['instruction'], seed.production);
    if ((text === null ? null : sha256(text)) !== seed.instructionSha256)
        fail();
    const checked = parsedChildren(data, { source, basis });
    checkedInputs.set(checked, { seedSha256, wholeSha256: recordSha256(checked) });
    return checked;
}
function boundIdentity(seed, packet) {
    return { sessionId: seed.sessionId, operationId: seed.operationId, requestedMessageId: seed.requestedMessageId,
        production: seed.production, instructionSha256: seed.instructionSha256, intentRef: packet.seedRef,
        inputRef: programOpeningRefV1(programOpeningInputKeyV1(seed.sessionId, seed.operationId), packet) };
}
export function validateProgramOpeningPlanRecordV1(input, rawSeed, rawPacket) {
    const seed = validateProgramOpeningSeedV1(rawSeed), packet = validateProgramOpeningInputV1(rawPacket, seed), binding = recordBinding(seed, packet), cached = boundRecord(input, checkedPlans, binding);
    if (cached)
        return cached;
    const data = programOpeningRecordDataV1(input);
    exact(data, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'seedRef', 'inputRef', 'plan', 'recordSha256']);
    sealed(data, 'recordSha256');
    ref(data['seedRef']);
    ref(data['inputRef']);
    const plan = validateFrozenProgramMvuOpeningPlanV3(data['plan']), identity = boundIdentity(seed, packet);
    if (packet.initialization !== 'raw-init-data' || data['schemaVersion'] !== 1
        || data['encoding'] !== 'native-program-opening-plan-record-v1' || data['authority'] !== 'consumer-data-only'
        || data['sessionId'] !== seed.sessionId || !same(data['seedRef'], identity.intentRef)
        || !same(data['inputRef'], identity.inputRef) || !same(plan.identity, identity)
        || plan.sourceSha256 !== packet.numericalSourceSha256 || !same(plan.source, packet.source) || !same(plan.basis, packet.basis))
        fail();
    const checked = parsedChildren(data, { plan });
    checkedPlans.set(checked, binding);
    return checked;
}
/** Seal a caller's already frozen plan with independent seed and input refs.
 * The checksum helper does not claim any referenced row is persisted. */
export function createProgramOpeningPlanRecordV1(input) {
    const seed = validateProgramOpeningSeedV1(input.seed), packet = validateProgramOpeningInputV1(input.input, seed), identity = boundIdentity(seed, packet), body = { schemaVersion: 1,
        encoding: 'native-program-opening-plan-record-v1', authority: 'consumer-data-only',
        sessionId: seed.sessionId, seedRef: identity.intentRef, inputRef: identity.inputRef, plan: input.plan };
    return validateProgramOpeningPlanRecordV1({ ...body, recordSha256: recordSha256(body) }, seed, packet);
}
/** Pure convenience preparation; no native callback, write, lock or retry. */
export function prepareProgramOpeningPlanRecordV1(input) {
    const seed = validateProgramOpeningSeedV1(input.seed), packet = validateProgramOpeningInputV1(input.input, seed), plan = prepareProgramMvuOpeningPlanV3({ identity: boundIdentity(seed, packet), sourceSha256: packet.numericalSourceSha256,
        source: packet.source, basis: packet.basis });
    return createProgramOpeningPlanRecordV1({ seed, input: packet, plan });
}
/** Original Native packet is checked before Core's JSON copier can normalize
 * a prohibited -0/undefined. Copy has no standalone Native packet validator,
 * so its narrow receipt grammar is checked explicitly against the input. */
function nativeFactsPayload(input, seed, packet) {
    const data = programOpeningRecordDataV1(input);
    exact(data, ['production', 'receipt', 'canonical']);
    if (data['production'] !== seed.production)
        fail();
    const original = input.receipt;
    if (seed.production === 'selected-card-copy') {
        const receipt = data['receipt'];
        exact(receipt, ['sessionId', 'operationId', 'messageId', 'renderedSha256', 'turn', 'assistantSeq',
            'turnStartSeq', 'turnEndSeq', 'messageVersion', 'flushed']);
        exact(receipt['messageVersion'], ['kind', 'eventSha256']);
        const raw = original;
        if (data['canonical'] !== null || receipt['sessionId'] !== seed.sessionId || receipt['operationId'] !== seed.operationId
            || receipt['messageId'] !== seed.requestedMessageId || receipt['renderedSha256'] !== packet.source.selected.renderedSha256
            || receipt['flushed'] !== true || receipt['messageVersion']['kind'] !== 'original'
            || !hash(receipt['messageVersion']['eventSha256']) || !count(raw.turn, true) || !count(raw.turnStartSeq)
            || !count(raw.assistantSeq) || !count(raw.turnEndSeq) || raw.turnStartSeq >= raw.assistantSeq
            || raw.assistantSeq >= raw.turnEndSeq || raw.turnStartSeq !== packet.basis.native.eventCount)
            fail();
    }
    else {
        const receipt = validateNativeGeneratedOpeningReceiptV1(original), canonical = data['canonical'], owned = receipt.identity;
        exact(canonical, ['seq', 'messageId', 'versionSha256', 'narrative']);
        if (owned.sessionId !== seed.sessionId || owned.operationId !== seed.operationId || owned.messageId !== seed.requestedMessageId
            || owned.instruction !== packet.instruction || owned.instructionSha256 !== seed.instructionSha256
            || !same(owned.intentRef, packet.seedRef) || receipt.invocationRef.seq !== packet.basis.native.eventCount
            || !count(canonical['seq']) || canonical['seq'] !== receipt.terminalOutput.eventRef.seq
            || canonical['messageId'] !== receipt.terminalOutput.messageId
            || canonical['versionSha256'] !== receipt.terminalOutput.messageSha256 || typeof canonical['narrative'] !== 'string'
            || sha256(canonical['narrative']) !== receipt.terminalOutput.textSha256)
            fail();
    }
    return data;
}
export function validateProgramOpeningNativeFactsV1(input, rawSeed, rawPacket) {
    const seed = validateProgramOpeningSeedV1(rawSeed), packet = validateProgramOpeningInputV1(rawPacket, seed), binding = recordBinding(seed, packet), cached = boundRecord(input, checkedNativeFacts, binding);
    if (cached)
        return cached;
    const data = programOpeningRecordDataV1(input);
    exact(data, ['schemaVersion', 'encoding', 'production', 'receipt', 'canonical', 'factsSha256']);
    sealed(data, 'factsSha256');
    if (data['schemaVersion'] !== 1 || data['encoding'] !== 'native-program-opening-native-facts-v1')
        fail();
    // Descriptor cloning above established that reading the original receipt
    // invokes no getters; keep its stronger Native grammar at this boundary.
    nativeFactsPayload({ production: data['production'], receipt: input.receipt,
        canonical: data['canonical'] }, seed, packet);
    const checked = data;
    checkedNativeFacts.set(checked, binding);
    return checked;
}
export function createProgramOpeningNativeFactsV1(input, rawSeed, rawPacket) {
    const seed = validateProgramOpeningSeedV1(rawSeed), packet = validateProgramOpeningInputV1(rawPacket, seed), native = nativeFactsPayload(input, seed, packet), body = { schemaVersion: 1,
        encoding: 'native-program-opening-native-facts-v1', ...native };
    return validateProgramOpeningNativeFactsV1({ ...body, factsSha256: recordSha256(body) }, seed, packet);
}
export function validateProgramOpeningGenesisEnvelopeV1(input, rawNative, context) {
    const seed = validateProgramOpeningSeedV1(context.seed), packet = validateProgramOpeningInputV1(context.input, seed), native = validateProgramOpeningNativeFactsV1(rawNative, seed, packet);
    if (packet.initialization !== 'raw-init-data' || context.planRecord === null)
        fail();
    const record = validateProgramOpeningPlanRecordV1(context.planRecord, seed, packet), data = validateProgramGenesisNativeEnvelopeV1(input, record.plan);
    if (data.production !== native.production || !same(data.receipt, native.receipt) || !same(data.canonical, native.canonical))
        fail();
    return programOpeningRecordDataV1(data);
}
export function createProgramOpeningGenesisEnvelopeV1(rawNative, context) {
    const seed = validateProgramOpeningSeedV1(context.seed), packet = validateProgramOpeningInputV1(context.input, seed), native = validateProgramOpeningNativeFactsV1(rawNative, seed, packet);
    if (packet.initialization !== 'raw-init-data' || context.planRecord === null)
        fail();
    const record = validateProgramOpeningPlanRecordV1(context.planRecord, seed, packet), body = { schemaVersion: 1, encoding: 'native-program-genesis-native-envelope-v1',
        production: native.production, receipt: native.receipt, canonical: native.canonical, planSha256: record.plan.planSha256 };
    return validateProgramOpeningGenesisEnvelopeV1({ ...body, envelopeSha256: recordSha256(body) }, native, context);
}
function recordContext(context) {
    const seed = validateProgramOpeningSeedV1(context.seed), packet = validateProgramOpeningInputV1(context.input, seed);
    if (packet.initialization === 'absent' && context.planRecord !== null
        || packet.initialization === 'raw-init-data' && context.planRecord === null)
        fail();
    const planRecord = context.planRecord === null ? null : validateProgramOpeningPlanRecordV1(context.planRecord, seed, packet);
    return { seed, packet, planRecord, identity: boundIdentity(seed, packet) };
}
export function validateProgramOpeningAbsentDomainV1(input, context) {
    const seed = validateProgramOpeningSeedV1(context.seed), packet = validateProgramOpeningInputV1(context.input, seed), binding = recordBinding(seed, packet), cached = boundRecord(input, checkedAbsentDomains, binding);
    if (cached)
        return cached;
    const data = programOpeningRecordDataV1(input), identity = boundIdentity(seed, packet);
    exact(data, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'operationId', 'requestedMessageId', 'seedRef', 'inputRef',
        'sourceProofSha256', 'sourceBindingSha256', 'basisSha256', 'nativeFacts', 'domainSha256']);
    sealed(data, 'domainSha256');
    ref(data['seedRef']);
    ref(data['inputRef']);
    if (packet.initialization !== 'absent' || data['schemaVersion'] !== 1 || data['encoding'] !== 'native-program-opening-absence-domain-v1'
        || data['authority'] !== 'consumer-data-only' || data['sessionId'] !== seed.sessionId
        || data['operationId'] !== seed.operationId || data['requestedMessageId'] !== seed.requestedMessageId
        || !same(data['seedRef'], identity.intentRef) || !same(data['inputRef'], identity.inputRef)
        || data['sourceProofSha256'] !== packet.source.proofSha256 || data['sourceBindingSha256'] !== packet.source.bindingSha256
        || data['basisSha256'] !== packet.basis.basisSha256)
        fail();
    const nativeFacts = validateProgramOpeningNativeFactsV1(input.nativeFacts, seed, packet), checked = parsedChildren(data, { nativeFacts });
    checkedAbsentDomains.set(checked, binding);
    return checked;
}
/** Complete immutable absence record, containing actual-reader facts as data.
 * Root owns persistence, current membership and its independent readback. */
export function createProgramOpeningAbsentDomainV1(input) {
    const seed = validateProgramOpeningSeedV1(input.seed), packet = validateProgramOpeningInputV1(input.input, seed), identity = boundIdentity(seed, packet), nativeFacts = validateProgramOpeningNativeFactsV1(input.nativeFacts, seed, packet), body = { schemaVersion: 1, encoding: 'native-program-opening-absence-domain-v1',
        authority: 'consumer-data-only', sessionId: seed.sessionId, operationId: seed.operationId,
        requestedMessageId: seed.requestedMessageId, seedRef: identity.intentRef, inputRef: identity.inputRef,
        sourceProofSha256: packet.source.proofSha256, sourceBindingSha256: packet.source.bindingSha256,
        basisSha256: packet.basis.basisSha256, nativeFacts };
    return validateProgramOpeningAbsentDomainV1({ ...body, domainSha256: recordSha256(body) }, { seed, input: packet });
}
/** Exact data receipts, distinct numerical/absence encodings. Storage existence
 * and original Native currency are still caller-owned checks. */
export function validateProgramOpeningDomainReceiptV1(input, rawNative, context) {
    const data = programOpeningRecordDataV1(input), { seed, packet, planRecord } = recordContext(context), native = validateProgramOpeningNativeFactsV1(rawNative, seed, packet);
    if (packet.initialization === 'raw-init-data') {
        exact(data, ['kind', 'eventId', 'eventSha256', 'headSha256', 'planSha256', 'valuesSha256']);
        if (data['kind'] !== 'program-genesis' || planRecord === null || context.genesis === undefined || context.absenceDomain !== undefined)
            fail();
        const genesis = validateProgramMvuGenesisFactsV1(context.genesis.programEvent, context.genesis.programHead), event = genesis.programEvent, head = genesis.programHead;
        if (!same(event.plan, planRecord.plan) || !same(event.native.receipt, native.receipt)
            || !same(event.native.canonical, native.canonical) || event.native.production !== native.production
            || data['eventId'] !== programGenesisEventIdV1(planRecord.plan) || data['eventId'] !== event.eventId
            || data['eventSha256'] !== event.eventSha256 || data['headSha256'] !== recordSha256(head)
            || data['planSha256'] !== planRecord.plan.planSha256 || data['valuesSha256'] !== event.valuesSha256)
            fail();
    }
    else {
        exact(data, ['kind', 'domainRef', 'sourceProofSha256', 'basisSha256', 'nativeFactsSha256']);
        ref(data['domainRef']);
        if (data['kind'] !== 'prompt-absence' || context.genesis !== undefined || context.absenceDomain === undefined)
            fail();
        const domain = validateProgramOpeningAbsentDomainV1(context.absenceDomain, { seed, input: packet });
        if (data['domainRef'].key !== programOpeningDomainKeyV1(seed.sessionId, seed.operationId)
            || data['domainRef'].sha256 !== recordSha256(domain) || !same(domain.nativeFacts, native)
            || data['sourceProofSha256'] !== packet.source.proofSha256 || data['basisSha256'] !== packet.basis.basisSha256
            || data['nativeFactsSha256'] !== native.factsSha256)
            fail();
    }
    return data;
}
export function createProgramOpeningNumericalDomainReceiptV1(rawNative, context) {
    if (context.genesis === undefined)
        fail();
    const genesis = validateProgramMvuGenesisFactsV1(context.genesis.programEvent, context.genesis.programHead), event = genesis.programEvent, data = { kind: 'program-genesis', eventId: event.eventId,
        eventSha256: event.eventSha256, headSha256: recordSha256(genesis.programHead), planSha256: event.plan.planSha256,
        valuesSha256: event.valuesSha256 };
    return validateProgramOpeningDomainReceiptV1(data, rawNative, context);
}
/** The absence writer supplies its separate versioned record reference. This
 * constructor neither manufactures a numerical plan nor writes that record. */
export function createProgramOpeningAbsenceDomainReceiptV1(domainRef, rawNative, context) {
    const { seed, packet } = recordContext(context), native = validateProgramOpeningNativeFactsV1(rawNative, seed, packet), data = { kind: 'prompt-absence', domainRef, sourceProofSha256: packet.source.proofSha256,
        basisSha256: packet.basis.basisSha256, nativeFactsSha256: native.factsSha256 };
    return validateProgramOpeningDomainReceiptV1(data, native, context);
}
export function validateOpeningIntentV7(input, context) {
    const data = programOpeningRecordDataV1(input), { seed, packet, planRecord, identity } = recordContext(context);
    optionalShape(data, ['schemaVersion', 'mode', 'sessionId', 'source', 'index', 'sourcePointer', 'sourceSha256', 'renderedSha256',
        'renderedText', 'textRetained', 'operationId', 'messageId', 'production', 'revision', 'status', 'seedRef', 'inputRef', 'planRef'], ['nativeReceipt', 'genesisEnvelope', 'committedTurn', 'domainReceipt', 'diagnosis']);
    ref(data['seedRef']);
    ref(data['inputRef']);
    if (data['planRef'] !== null)
        ref(data['planRef']);
    const selected = packet.source.selected, expectedPlanRef = planRecord === null ? null :
        programOpeningRefV1(programOpeningPlanKeyV1(seed.sessionId, seed.operationId), planRecord);
    if (data['schemaVersion'] !== 7 || data['mode'] !== 'prompt-program' || data['sessionId'] !== seed.sessionId
        || !same(data['source'], seed.source) || data['index'] !== selected.index || data['sourcePointer'] !== selected.sourcePointer
        || data['sourceSha256'] !== selected.sourceSha256 || data['renderedSha256'] !== selected.renderedSha256
        || data['renderedText'] !== selected.renderedText || data['textRetained'] !== true
        || data['operationId'] !== seed.operationId || data['messageId'] !== seed.requestedMessageId || data['production'] !== seed.production
        || !count(data['revision'], true) || !same(data['seedRef'], identity.intentRef) || !same(data['inputRef'], identity.inputRef)
        || !same(data['planRef'], expectedPlanRef) || !['prepared', 'native-unknown', 'native-committed', 'domain-blocked', 'completed']
        .includes(String(data['status'])))
        fail();
    if (Object.hasOwn(data, 'diagnosis') && (typeof data['diagnosis'] !== 'string' || !data['diagnosis'].trim()
        || !data['diagnosis'].isWellFormed() || Buffer.byteLength(data['diagnosis'], 'utf8') > 4096))
        fail();
    const hasNative = Object.hasOwn(data, 'nativeReceipt'), hasTurn = Object.hasOwn(data, 'committedTurn'), hasEnvelope = Object.hasOwn(data, 'genesisEnvelope'), hasDomain = Object.hasOwn(data, 'domainReceipt'), status = data['status'];
    if (status === 'prepared' || status === 'native-unknown') {
        if (hasNative || hasTurn || hasEnvelope || hasDomain)
            fail();
        // Unknown is a recovery anchor. This pure parser never retries generation.
        return data;
    }
    if (!hasNative || !hasTurn || !count(data['committedTurn'], true))
        fail();
    const native = validateProgramOpeningNativeFactsV1(input.nativeReceipt, seed, packet);
    if (data['committedTurn'] !== native.receipt.turn)
        fail();
    if (packet.initialization === 'absent' && hasEnvelope
        || packet.initialization === 'raw-init-data' && (status === 'native-committed' || status === 'completed') && !hasEnvelope)
        fail();
    if (hasEnvelope) {
        validateProgramOpeningGenesisEnvelopeV1(input.genesisEnvelope, native, context);
    }
    if (status === 'domain-blocked') {
        if (hasDomain || !Object.hasOwn(data, 'diagnosis'))
            fail();
    }
    else if (status === 'native-committed') {
        if (hasDomain)
            fail();
    }
    else {
        if (!hasDomain)
            fail();
        const domain = validateProgramOpeningDomainReceiptV1(data['domainReceipt'], native, context);
        if (domain.kind === 'program-genesis' && hasEnvelope
            && !same(data['genesisEnvelope'], context.genesis.programEvent.native))
            fail();
    }
    return data;
}
/** Source selection is always copied from the independent immutable input,
 * never from the generated terminal body or mutable recovery anchor. */
export function createOpeningIntentV7(input) {
    const { seed, packet, planRecord, identity } = recordContext(input.context), selected = packet.source.selected, extras = {};
    for (const key of ['nativeReceipt', 'genesisEnvelope', 'committedTurn', 'domainReceipt', 'diagnosis']) {
        if (Object.hasOwn(input, key))
            extras[key] = input[key];
    }
    const body = { schemaVersion: 7, mode: 'prompt-program', sessionId: seed.sessionId, source: seed.source,
        index: selected.index, sourcePointer: selected.sourcePointer, sourceSha256: selected.sourceSha256,
        renderedSha256: selected.renderedSha256, renderedText: selected.renderedText, textRetained: true,
        operationId: seed.operationId, messageId: seed.requestedMessageId, production: seed.production,
        revision: input.revision, status: input.status, seedRef: identity.intentRef, inputRef: identity.inputRef,
        planRef: planRecord === null ? null : programOpeningRefV1(programOpeningPlanKeyV1(seed.sessionId, seed.operationId), planRecord), ...extras };
    return validateOpeningIntentV7(body, input.context);
}
export function createPreparedOpeningIntentV7(context) {
    return createOpeningIntentV7({ context, revision: 1, status: 'prepared' });
}
