// Generated from runtime/alpha3/compat/agent-loop/src/request-material.ts; edit the TypeScript source.
/** Native-owned pure request-material planning and historical reconstruction.
 * Data descriptors do not grant live Session/Agent or Source authority. */
import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import { brandString } from '@deepseek-ai/dsh-brand';
import { deriveEventMessage, foldSurface } from '@deepseek-ai/dsh-session/surface';
export const NATIVE_REQUEST_MATERIAL_LIMITS_V1 = Object.freeze({
    baseMessages: 4096, insertions: 128, textChars: 65536, renderedBytes: 1048576,
    depth: 4096, dataBytes: 16777216, dataNodes: 131072, dataDepth: 64,
    prefixEvents: 65536, reconstructionFoldEvents: 131072,
});
export class NativeRequestMaterialFailure extends Error {
    code;
    location;
    constructor(code, location) {
        super(`native request material ${code} at ${location}`);
        this.code = code;
        this.location = location;
        this.name = 'NativeRequestMaterialFailure';
    }
}
const limits = NATIVE_REQUEST_MATERIAL_LIMITS_V1;
function fail(code, location) {
    throw new NativeRequestMaterialFailure(code, location);
}
const safeInt = (value, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    && value <= max && !Object.is(value, -0);
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const identity = (value) => typeof value === 'string'
    && value.length > 0 && value.length <= 256 && value === value.trim()
    && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
/** Descriptor traversal precedes all reads. isProxy runs before reflection, so
 * neither proxy traps nor getters run. Prefix mode validates without copying
 * history; its recursively frozen data may be borrowed by canonical fold. */
function ownedData(value, location, copy = true, requireFrozen = false) {
    let nodes = 0;
    let bytes = 0;
    const ancestors = new Set();
    const visit = (item, depth, where) => {
        if (++nodes > limits.dataNodes || depth > limits.dataDepth)
            fail('DATA_LIMIT', where);
        if (item === null || typeof item === 'boolean')
            return item;
        if (typeof item === 'string') {
            bytes += Buffer.byteLength(item, 'utf8');
            if (bytes > limits.dataBytes)
                fail('DATA_LIMIT', where);
            return item;
        }
        if (typeof item === 'number' && Number.isFinite(item) && !Object.is(item, -0))
            return item;
        if (typeof item !== 'object' || item === null || utilTypes.isProxy(item))
            fail('DATA_UNSAFE', where);
        if (ancestors.has(item))
            fail('DATA_UNSAFE', where);
        const proto = Object.getPrototypeOf(item);
        const array = Array.isArray(item);
        if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
            fail('DATA_UNSAFE', where);
        if (requireFrozen && !Object.isFrozen(item))
            fail('DATA_UNSAFE', where);
        if (array && !safeInt(Object.getOwnPropertyDescriptor(item, 'length')?.value, limits.prefixEvents)) {
            fail('DATA_LIMIT', where);
        }
        const descriptors = Object.getOwnPropertyDescriptors(item);
        const keys = Reflect.ownKeys(descriptors);
        if (keys.some(key => typeof key !== 'string'))
            fail('DATA_UNSAFE', where);
        ancestors.add(item);
        if (array) {
            const length = descriptors['length']?.value;
            if (!safeInt(length, limits.prefixEvents) || keys.length !== length + 1)
                fail('DATA_LIMIT', where);
            const result = [];
            for (let index = 0; index < length; index++) {
                const descriptor = descriptors[String(index)];
                if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
                    fail('DATA_UNSAFE', where);
                const entry = visit(descriptor.value, depth + 1, `${where}[${index}]`);
                if (copy)
                    result.push(entry);
            }
            ancestors.delete(item);
            return copy ? Object.freeze(result) : item;
        }
        const result = Object.create(null);
        for (const key of keys) {
            const descriptor = descriptors[key];
            if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
                fail('DATA_UNSAFE', where);
            bytes += Buffer.byteLength(key, 'utf8');
            if (bytes > limits.dataBytes)
                fail('DATA_LIMIT', where);
            const entry = visit(descriptor.value, depth + 1, `${where}.${key}`);
            if (copy)
                result[key] = entry;
        }
        ancestors.delete(item);
        return copy ? Object.freeze(result) : item;
    };
    return visit(value, 0, location);
}
function object(value, fields, location) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        fail('MALFORMED', location);
    const keys = Object.keys(value);
    if (keys.length !== fields.length || keys.some(key => !fields.includes(key)))
        fail('MALFORMED', location);
    return value;
}
function list(value, max, location) {
    if (!Array.isArray(value) || value.length > max)
        fail('DATA_LIMIT', location);
    return value;
}
function ref(value, location) {
    const item = object(value, ['key', 'sha256'], location);
    if (!identity(item['key']) || !sha(item['sha256']))
        fail('MALFORMED', location);
}
function canonical(value) {
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object')
        return `{${Object.keys(value).sort()
            .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value) ?? fail('MALFORMED', 'canonical');
}
/** Data digest only. It neither creates a Native receipt nor proves ownership. */
export function nativeRequestMaterialSha256V1(value) {
    return digest(ownedData(value, 'hash'));
}
function digest(value) {
    return createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}
function same(left, right) {
    return canonical(left) === canonical(right);
}
function validateMessage(value, location) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        fail('MALFORMED', location);
    if (!identity(value['id']) || !['system', 'developer', 'user', 'assistant', 'tool'].includes(value['role'])
        || !Array.isArray(value['content']) || value['source'] === null
        || typeof value['source'] !== 'object' || Array.isArray(value['source']))
        fail('MALFORMED', location);
    const source = value['source'];
    if (!identity(source['kind']) || source['kind'] === 'request-material')
        fail('BASE_MISMATCH', location);
    for (const block of value['content']) {
        if (block === null || typeof block !== 'object' || Array.isArray(block) || !identity(block['type'])) {
            fail('MALFORMED', `${location}.content`);
        }
    }
    if (value['role'] === 'tool' && (source['kind'] !== 'tool' || !identity(source['callId'])
        || value['toolCallId'] !== source['callId']))
        fail('MALFORMED', location);
    return value;
}
function validateBase(input) {
    if (!safeInt(input.turn) || input.turn < 1 || !safeInt(input.step) || input.step < 1 || !safeInt(input.boundarySeq)
        || !safeInt(input.contentGeneration) || !safeInt(input.protectedPrefixLength, input.baseMessages.length)
        || !safeInt(input.header.seq, input.boundarySeq) || !sha(input.header.sha256))
        fail('MALFORMED', 'base.metadata');
    ref(input.snapshot, 'snapshot');
    ref(input.plan, 'plan');
    if (input.baseMessages.length > limits.baseMessages || input.surfaceNodes.length > limits.baseMessages
        || input.baseRefs.length !== input.baseMessages.length)
        fail('DATA_LIMIT', 'base.messages');
    const nodes = new Set();
    for (const seq of input.surfaceNodes) {
        if (!safeInt(seq, input.boundarySeq) || nodes.has(seq))
            fail('BASE_MISMATCH', 'base.surfaceNodes');
        nodes.add(seq);
    }
    const ids = new Set();
    let nodeIndex = 0;
    for (const [index, message] of input.baseMessages.entries()) {
        validateMessage(message, `base.messages[${index}]`);
        const item = input.baseRefs[index];
        if (!item)
            fail('BASE_MISMATCH', `base.refs[${index}]`);
        object(item, ['seq', 'id', 'role', 'messageSha256'], `base.refs[${index}]`);
        while (nodeIndex < input.surfaceNodes.length && input.surfaceNodes[nodeIndex] !== item.seq)
            nodeIndex++;
        if (nodeIndex >= input.surfaceNodes.length || ids.has(message.id) || item.id !== message.id
            || item.role !== message.role || !sha(item.messageSha256)
            || item.messageSha256 !== digest(message))
            fail('BASE_MISMATCH', `base.refs[${index}]`);
        ids.add(message.id);
        nodeIndex++;
    }
}
function canonicalInsertions(raw) {
    if (raw.length > limits.insertions)
        fail('DATA_LIMIT', 'insertions');
    let totalBytes = 0;
    const identities = new Set();
    const orders = new Set();
    for (const [index, item] of raw.entries()) {
        object(item, ['contributionRef', 'sourceSha256', 'renderedText', 'renderedSha256',
            'requestedRole', 'requestedDepth', 'stableOrder'], `insertions[${index}]`);
        if (!identity(item.contributionRef) || !sha(item.sourceSha256) || !sha(item.renderedSha256)
            || typeof item.renderedText !== 'string' || !item.renderedText.trim() || !item.renderedText.isWellFormed()
            || item.renderedText.length > limits.textChars || !['system', 'user', 'assistant'].includes(item.requestedRole)
            || !safeInt(item.requestedDepth, limits.depth) || !safeInt(item.stableOrder)
            || identities.has(item.contributionRef) || orders.has(item.stableOrder))
            fail('INSERTION_MISMATCH', `insertions[${index}]`);
        const textSha = createHash('sha256').update(item.renderedText, 'utf8').digest('hex');
        if (item.renderedSha256 !== textSha)
            fail('INSERTION_MISMATCH', `insertions[${index}].renderedSha256`);
        totalBytes += Buffer.byteLength(item.renderedText, 'utf8');
        if (totalBytes > limits.renderedBytes)
            fail('DATA_LIMIT', 'insertions.renderedBytes');
        identities.add(item.contributionRef);
        orders.add(item.stableOrder);
    }
    // Locale independent, including historical readers on another OS.
    return [...raw].sort((a, b) => a.stableOrder - b.stableOrder
        || (a.contributionRef < b.contributionRef ? -1 : a.contributionRef > b.contributionRef ? 1 : 0));
}
/** Only the canonical adjacent tool-result group is supported. An orphan,
 * duplicate, missing result or intervening message is not guessed into a group. */
function forbiddenToolBoundaries(base) {
    const forbidden = new Set();
    const globallySeen = new Set();
    for (let index = 0; index < base.length; index++) {
        const message = base[index];
        if (!message)
            fail('MALFORMED', 'base.toolGroup');
        if (message.role === 'tool')
            fail('TOOL_GROUP_UNSUPPORTED', `base[${index}]`);
        const calls = message.content.filter(block => block.type === 'tool-call');
        if (calls.length === 0)
            continue;
        if (message.role !== 'assistant')
            fail('TOOL_GROUP_UNSUPPORTED', `base[${index}]`);
        const pending = new Set();
        for (const call of calls) {
            if (call.type !== 'tool-call' || !identity(call.id) || pending.has(call.id) || globallySeen.has(call.id)) {
                fail('TOOL_GROUP_UNSUPPORTED', `base[${index}].toolCalls`);
            }
            pending.add(call.id);
            globallySeen.add(call.id);
        }
        const callIndex = index;
        while (pending.size > 0) {
            index++;
            const result = base[index];
            if (!result || result.role !== 'tool' || !pending.delete(result.toolCallId)) {
                fail('TOOL_GROUP_UNSUPPORTED', `base[${callIndex}].results`);
            }
            forbidden.add(index);
        }
    }
    return forbidden;
}
function materialize(input) {
    validateBase(input);
    const insertions = canonicalInsertions(input.insertions);
    const base = {
        boundarySeq: input.boundarySeq, contentGeneration: input.contentGeneration,
        surfaceNodes: input.surfaceNodes, messages: input.baseRefs,
        sha256: digest(input.baseMessages),
    };
    const seed = {
        schemaVersion: 1, encoding: 'native-request-material-v1', turn: input.turn, step: input.step,
        header: input.header, snapshot: input.snapshot, plan: input.plan, base,
        delta: { insertions, protectedPrefixLength: input.protectedPrefixLength },
    };
    const inputSha = digest(seed);
    const forbidden = insertions.length > 0 ? forbiddenToolBoundaries(input.baseMessages) : new Set();
    const located = insertions.map((item, insertionOrdinal) => {
        const baseIndex = Math.max(input.protectedPrefixLength, input.baseMessages.length - item.requestedDepth);
        if (forbidden.has(baseIndex))
            fail('TOOL_GROUP_SPLIT', `insertions[${insertionOrdinal}]`);
        // Every input identity/hash participates; output position never introduces randomness.
        const messageId = brandString(`native-material-${inputSha}-${insertionOrdinal}`);
        const payload = {
            id: messageId, content: [{ type: 'text', text: item.renderedText }],
            source: { kind: 'request-material', schemaVersion: 1, encoding: 'native-request-material-message-v1',
                materialInputSha256: inputSha, contributionRef: item.contributionRef,
                sourceSha256: item.sourceSha256, renderedSha256: item.renderedSha256 },
        };
        const message = item.requestedRole === 'system'
            ? { ...payload, role: 'system' } : item.requestedRole === 'user'
            ? { ...payload, role: 'user' } : { ...payload, role: 'assistant' };
        return { item, message, placement: {
                contributionRef: item.contributionRef, baseIndex, protectedPrefixLength: input.protectedPrefixLength,
                effectiveDepth: input.baseMessages.length - baseIndex, messageId,
            } };
    }).sort((a, b) => a.placement.baseIndex - b.placement.baseIndex || a.item.stableOrder - b.item.stableOrder
        || (a.item.contributionRef < b.item.contributionRef ? -1 : a.item.contributionRef > b.item.contributionRef ? 1 : 0));
    const messages = [];
    let insertion = 0;
    for (let index = 0; index <= input.baseMessages.length; index++) {
        while (located[insertion]?.placement.baseIndex === index) {
            const item = located[insertion++];
            if (!item)
                fail('MATERIAL_MISMATCH', 'placements');
            messages.push(item.message);
        }
        const item = input.baseMessages[index];
        if (item)
            messages.push(item);
    }
    const record = { ...seed, placements: located.map(item => item.placement),
        outputSha256: digest(messages) };
    return ownedData({ record, messages }, 'result');
}
/** Plan against the exact final canonical Native base. Hash consistency is not
 * admission, Source currency, provider dispatch or authority. */
export function planNativeRequestMaterialV1(input) {
    // Messages from Session are deeply frozen; the fresh containing array need not be.
    if (input === null || typeof input !== 'object' || utilTypes.isProxy(input))
        fail('DATA_UNSAFE', 'input');
    const descriptor = Object.getOwnPropertyDescriptor(input, 'baseMessages');
    if (!descriptor || !Object.hasOwn(descriptor, 'value'))
        fail('DATA_UNSAFE', 'input.baseMessages');
    const rawBase = descriptor.value;
    if (!Array.isArray(rawBase) || utilTypes.isProxy(rawBase))
        fail('DATA_UNSAFE', 'input.baseMessages');
    const baseLength = Object.getOwnPropertyDescriptor(rawBase, 'length')?.value;
    if (!safeInt(baseLength, limits.baseMessages))
        fail('DATA_LIMIT', 'input.baseMessages');
    const baseDescriptors = Object.getOwnPropertyDescriptors(rawBase);
    for (let index = 0; index < baseLength; index++) {
        const item = baseDescriptors[String(index)];
        if (!item || !Object.hasOwn(item, 'value'))
            fail('DATA_UNSAFE', 'input.baseMessages');
        ownedData(item.value, `input.baseMessages[${index}]`, false, true);
    }
    const data = ownedData(input, 'input');
    object(data, ['turn', 'step', 'header', 'snapshot', 'plan', 'boundarySeq', 'contentGeneration',
        'surfaceNodes', 'baseMessages', 'baseRefs', 'protectedPrefixLength', 'insertions'], 'input');
    const owned = data;
    object(owned.header, ['seq', 'sha256'], 'header');
    list(owned.surfaceNodes, limits.baseMessages, 'surfaceNodes');
    list(owned.baseRefs, limits.baseMessages, 'baseRefs');
    list(owned.baseMessages, limits.baseMessages, 'baseMessages');
    list(owned.insertions, limits.insertions, 'insertions');
    return materialize(owned);
}
function recordData(value) {
    const data = ownedData(value, 'record');
    if (data === null || typeof data !== 'object' || Array.isArray(data))
        fail('MALFORMED', 'record');
    if (data['schemaVersion'] !== 1 || data['encoding'] !== 'native-request-material-v1')
        fail('UNKNOWN_VERSION', 'record');
    const record = object(data, ['schemaVersion', 'encoding', 'turn', 'step', 'header', 'snapshot', 'plan',
        'base', 'delta', 'placements', 'outputSha256'], 'record');
    object(record['base'], ['boundarySeq', 'contentGeneration', 'surfaceNodes', 'messages', 'sha256'], 'record.base');
    object(record['delta'], ['insertions', 'protectedPrefixLength'], 'record.delta');
    object(record['header'], ['seq', 'sha256'], 'record.header');
    list(record['placements'], limits.insertions, 'record.placements');
    return record;
}
/** Historical reconstruction uses only this record's own exact prefix. It does
 * not query Source/Core or interpret any prior material as a surface overlay. */
export function reconstructNativeRequestMaterialV1(input) {
    if (input === null || typeof input !== 'object' || utilTypes.isProxy(input))
        fail('DATA_UNSAFE', 'reconstruction');
    const desc = Object.getOwnPropertyDescriptors(input);
    const names = ['materialEvent', 'events', 'projections', 'expectedHeaderSha256'];
    if (Reflect.ownKeys(desc).length !== names.length || names.some(name => !desc[name]
        || !Object.hasOwn(desc[name], 'value')))
        fail('DATA_UNSAFE', 'reconstruction');
    const envelope = ownedData(desc['materialEvent']?.value, 'materialEvent');
    const event = object(envelope, ['type', 'seq', 'time', 'data'], 'materialEvent');
    if (event['type'] !== 'request/material' || !safeInt(event['seq']) || !safeInt(event['time'])) {
        fail('MALFORMED', 'materialEvent');
    }
    const record = recordData(event['data']);
    validateStoredShape(record);
    if (!safeInt(record.base.boundarySeq, limits.prefixEvents - 1)
        || event['seq'] !== record.base.boundarySeq + 1)
        fail('BOUNDARY_MISMATCH', 'materialEvent.seq');
    const expectedHeader = desc['expectedHeaderSha256']?.value;
    if (!sha(expectedHeader) || expectedHeader !== record.header.sha256)
        fail('HEADER_MISMATCH', 'expectedHeaderSha256');
    const rawEvents = desc['events']?.value;
    if (!Array.isArray(rawEvents) || utilTypes.isProxy(rawEvents))
        fail('DATA_UNSAFE', 'events');
    const eventLength = Object.getOwnPropertyDescriptor(rawEvents, 'length')?.value;
    const prefixLength = record.base.boundarySeq + 1;
    if (!safeInt(eventLength) || eventLength < prefixLength)
        fail('BOUNDARY_MISMATCH', 'events.length');
    if (eventLength > prefixLength) {
        const logged = Object.getOwnPropertyDescriptor(rawEvents, String(event['seq']));
        if (!logged || !Object.hasOwn(logged, 'value')
            || !same(ownedData(logged.value, 'events.material'), envelope))
            fail('BOUNDARY_MISMATCH', 'events.material');
    }
    // Only a shallow reference array is allocated. Validate/fold the actual immutable
    // prefix, never structuredClone the history or read arbitrary later tail.
    const prefix = [];
    for (let seq = 0; seq < prefixLength; seq++) {
        const item = Object.getOwnPropertyDescriptor(rawEvents, String(seq));
        if (!item || !Object.hasOwn(item, 'value'))
            fail('DATA_UNSAFE', `events[${seq}]`);
        prefix.push(item.value);
    }
    ownedData(prefix, 'events.prefix', false);
    const priorMaterials = [];
    for (const [seq, item] of prefix.entries()) {
        ownedData(item, `events[${seq}]`, false, true);
        if (item.seq !== seq)
            fail('BOUNDARY_MISMATCH', `events[${seq}].seq`);
        if (item.type === 'request/material') {
            const prior = object(item, ['type', 'seq', 'time', 'data'], `events[${seq}]`);
            const priorRecord = recordData(prior['data']);
            if (priorRecord.base.boundarySeq !== seq - 1)
                fail('BOUNDARY_MISMATCH', `events[${seq}].data.base`);
            // Required record validated separately but never projected. An unknown or
            // malformed prior material cannot be quietly skipped as ordinary history.
            validateStoredShape(priorRecord);
            priorMaterials.push({ seq, record: priorRecord });
            if (priorMaterials.length > limits.insertions)
                fail('DATA_LIMIT', 'events.priorMaterials');
        }
    }
    const projections = projectionDefinitions(desc['projections']?.value);
    let foldedEvents = prefix.length;
    for (const prior of priorMaterials) {
        foldedEvents += prior.seq;
        if (foldedEvents > limits.reconstructionFoldEvents)
            fail('DATA_LIMIT', 'events.reconstructionFoldEvents');
        // Verify each required prior material against its own base, but never apply
        // that overlay to another base. Bounded shallow prefixes share frozen data.
        reconstructAgainstPrefix(prior.record, prefix.slice(0, prior.seq), projections);
    }
    return reconstructAgainstPrefix(record, prefix, projections);
}
function reconstructAgainstPrefix(record, prefix, projections) {
    // Canonical fold ignores log-only material; no ignorable marker is invented.
    // Catalog/SessionEventMap registration of this built-in remains Root-owned.
    // Root will expose the existing fold state's exact generation in the canonical
    // SurfaceFoldResult. No locally counted/approximated generation is accepted.
    let folded;
    let baseMessages;
    let baseRefs;
    try {
        folded = foldSurface(prefix, projections);
        if (!safeInt(folded.contentGeneration))
            fail('SURFACE_RECONSTRUCTION_FAILED', 'canonicalFold.contentGeneration');
        baseMessages = [];
        baseRefs = [];
        for (const seq of folded.nodes) {
            const actual = prefix[seq];
            if (!actual)
                fail('BOUNDARY_MISMATCH', 'fold.nodes');
            const projected = deriveEventMessage(actual, folded.projectedMessages);
            if (projected !== null) {
                const message = ownedData(projected, `projection.message[${seq}]`);
                validateMessage(message, `projection.message[${seq}]`);
                baseMessages.push(message);
                baseRefs.push({ seq, id: message.id, role: message.role, messageSha256: digest(message) });
            }
        }
    }
    catch (error) {
        if (error instanceof NativeRequestMaterialFailure)
            throw error;
        fail('SURFACE_RECONSTRUCTION_FAILED', 'canonicalFold');
    }
    const contentGeneration = folded.contentGeneration;
    if (contentGeneration !== record.base.contentGeneration || !same(folded.nodes, record.base.surfaceNodes)
        || !same(baseRefs, record.base.messages) || digest(baseMessages) !== record.base.sha256) {
        fail('BASE_MISMATCH', 'record.base');
    }
    let headerEvent;
    for (const item of prefix)
        if (item.type === 'request/header')
            headerEvent = item;
    if (!headerEvent || headerEvent.type !== 'request/header' || headerEvent.seq !== record.header.seq
        || digest(headerEvent.data.header) !== record.header.sha256)
        fail('HEADER_MISMATCH', 'record.header');
    // Exact turn/step identity is supplied by the historical Native step bracket.
    let stepEvent;
    for (const item of prefix)
        if (item.type === 'step/start')
            stepEvent = item;
    if (!stepEvent || stepEvent.type !== 'step/start' || stepEvent.data.turn !== record.turn
        || stepEvent.data.step !== record.step)
        fail('BOUNDARY_MISMATCH', 'record.turnStep');
    const rebuilt = materialize({ turn: record.turn, step: record.step, header: record.header,
        snapshot: record.snapshot, plan: record.plan, boundarySeq: record.base.boundarySeq,
        contentGeneration, surfaceNodes: folded.nodes, baseMessages, baseRefs,
        protectedPrefixLength: record.delta.protectedPrefixLength, insertions: record.delta.insertions });
    if (!same(rebuilt.record, record))
        fail('MATERIAL_MISMATCH', 'record.rebuilt');
    return rebuilt;
}
function validateStoredShape(record) {
    if (!safeInt(record.turn) || !safeInt(record.step) || !safeInt(record.base.boundarySeq)
        || !safeInt(record.base.contentGeneration) || !sha(record.base.sha256) || !sha(record.outputSha256)
        || !safeInt(record.header.seq, record.base.boundarySeq) || !sha(record.header.sha256))
        fail('MALFORMED', 'priorMaterial');
    ref(record.snapshot, 'priorMaterial.snapshot');
    ref(record.plan, 'priorMaterial.plan');
    const nodes = list(record.base.surfaceNodes, limits.baseMessages, 'priorMaterial.nodes');
    const refs = list(record.base.messages, limits.baseMessages, 'priorMaterial.refs');
    if (!safeInt(record.delta.protectedPrefixLength, refs.length) || new Set(nodes).size !== nodes.length
        || nodes.some(seq => !safeInt(seq, record.base.boundarySeq)))
        fail('MALFORMED', 'priorMaterial.base');
    let position = 0;
    const ids = new Set();
    for (const raw of refs) {
        const item = object(raw, ['seq', 'id', 'role', 'messageSha256'], 'priorMaterial.ref');
        while (position < nodes.length && nodes[position] !== item['seq'])
            position++;
        if (position >= nodes.length || !identity(item['id']) || ids.has(item['id']) || !sha(item['messageSha256'])
            || !['system', 'developer', 'user', 'assistant', 'tool'].includes(item['role']))
            fail('MALFORMED', 'priorMaterial.ref');
        ids.add(item['id']);
        position++;
    }
    const inserts = list(record.delta.insertions, limits.insertions, 'priorMaterial.insertions');
    const canonicalItems = canonicalInsertions(inserts);
    if (!same(canonicalItems, inserts) || record.placements.length !== inserts.length)
        fail('MALFORMED', 'priorMaterial.placements');
    for (const placement of record.placements) {
        object(placement, ['contributionRef', 'baseIndex', 'protectedPrefixLength',
            'effectiveDepth', 'messageId'], 'priorMaterial.placement');
        if (!identity(placement.contributionRef) || !identity(placement.messageId)
            || !safeInt(placement.baseIndex, refs.length) || placement.protectedPrefixLength !== record.delta.protectedPrefixLength
            || placement.baseIndex < placement.protectedPrefixLength || placement.effectiveDepth !== refs.length - placement.baseIndex) {
            fail('MALFORMED', 'priorMaterial.placement');
        }
    }
}
/** Definitions are trusted code, not JSON. Reject proxy/getter registries and
 * duplicate types before canonical fold chooses its single interpreter. */
function projectionDefinitions(raw) {
    if (!Array.isArray(raw) || utilTypes.isProxy(raw))
        fail('DATA_UNSAFE', 'projections');
    const length = Object.getOwnPropertyDescriptor(raw, 'length')?.value;
    if (!safeInt(length, limits.insertions))
        fail('DATA_LIMIT', 'projections');
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if (!safeInt(length, limits.insertions) || Reflect.ownKeys(descriptors).length !== length + 1)
        fail('DATA_LIMIT', 'projections');
    const types = new Set();
    const result = [];
    for (let index = 0; index < length; index++) {
        const descriptor = descriptors[String(index)];
        const item = descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
        if (!item || typeof item !== 'object' || utilTypes.isProxy(item))
            fail('DATA_UNSAFE', `projections[${index}]`);
        const definitions = Object.getOwnPropertyDescriptors(item);
        const type = definitions['type']?.value;
        const project = definitions['project']?.value;
        if (!identity(type) || types.has(type) || typeof project !== 'function' || utilTypes.isProxy(project)
            || type === 'request/material')
            fail('MALFORMED', `projections[${index}]`);
        types.add(type);
        const callable = project;
        result.push(Object.freeze({ type,
            project(event, context) {
                return Reflect.apply(callable, item, [event, context]);
            },
        }));
    }
    return result;
}
