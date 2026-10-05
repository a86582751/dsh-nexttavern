// Generated from runtime/alpha3/src/core/roleplay-tavern-lore-data.ts; edit the TypeScript source.
/** Bounded data for lore Source and retained contribution provenance. This
 * envelope includes archived line arrays, unlike MVU numerical/guest values.
 * Entry/table row limits remain with their semantic readers. No code executes. */
import { types } from 'node:util';
export const TAVERN_LORE_DATA_BOUNDS_V1 = Object.freeze({ bytes: 16_777_216, nodes: 131_072, depth: 66 });
export class TavernLoreDataFailureV1 extends Error {
    code;
    limit;
    constructor(code, limit) {
        super(code);
        this.code = code;
        this.limit = limit;
        this.name = 'TavernLoreDataFailureV1';
    }
}
function fail(code, limit) {
    throw new TavernLoreDataFailureV1(code, limit);
}
function configuredBounds(value) {
    if (value === undefined)
        return TAVERN_LORE_DATA_BOUNDS_V1;
    if (value === null || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value))
        fail('LORE_DATA_LIMIT_INVALID');
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        fail('LORE_DATA_LIMIT_INVALID');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of ['nodes', 'depth'])
        if (descriptors[key] && !Object.hasOwn(descriptors[key], 'value')) {
            fail('LORE_DATA_LIMIT_INVALID');
        }
    const nodeValue = descriptors.nodes?.value, depthValue = descriptors.depth?.value;
    const nodes = nodeValue === undefined ? TAVERN_LORE_DATA_BOUNDS_V1.nodes : nodeValue;
    const depth = depthValue === undefined ? TAVERN_LORE_DATA_BOUNDS_V1.depth : depthValue;
    if (typeof nodes !== 'number' || !Number.isSafeInteger(nodes) || nodes < 1 || nodes > TAVERN_LORE_DATA_BOUNDS_V1.nodes
        || typeof depth !== 'number' || !Number.isSafeInteger(depth) || depth < 1 || depth > TAVERN_LORE_DATA_BOUNDS_V1.depth) {
        fail('LORE_DATA_LIMIT_INVALID');
    }
    return { nodes, depth };
}
function inputBudget(value) {
    if (value === undefined)
        return { bytes: 0, nodes: 0 };
    if (value === null || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value))
        fail('LORE_DATA_LIMIT_INVALID');
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        fail('LORE_DATA_LIMIT_INVALID');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of ['bytes', 'nodes']) {
        const descriptor = descriptors[key];
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.writable || typeof descriptor.value !== 'number'
            || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0)
            fail('LORE_DATA_LIMIT_INVALID');
    }
    return value;
}
/** Fixed-purpose ceilings may be lowered, never widened. Undefined object
 * fields are omitted; undefined array values become null, preserving persisted
 * record CAS spelling. Aliases detach and negative zero has JSON's zero spelling. */
export function cloneRoleplayTavernLoreDataV1(data, maxBytes = TAVERN_LORE_DATA_BOUNDS_V1.bytes, recordBounds, sharedBudget) {
    if (data === undefined)
        fail('LORE_DATA_INVALID');
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > TAVERN_LORE_DATA_BOUNDS_V1.bytes) {
        fail('LORE_DATA_LIMIT_INVALID');
    }
    const limits = configuredBounds(recordBounds), used = inputBudget(sharedBudget), ancestors = new Set();
    const count = (bytes) => {
        used.bytes += bytes;
        if (used.bytes > maxBytes)
            fail('LORE_DATA_BUDGET', { field: 'serializedDataBytes', maximum: maxBytes, observed: used.bytes });
    };
    const text = (value) => {
        // Reject before allocating a potentially much larger escaped spelling.
        if (Buffer.byteLength(value, 'utf8') > maxBytes - used.bytes)
            fail('LORE_DATA_BUDGET', { field: 'serializedDataBytes', maximum: maxBytes });
        count(Buffer.byteLength(JSON.stringify(value), 'utf8'));
    };
    const visit = (value, depth) => {
        if (++used.nodes > limits.nodes)
            fail('LORE_DATA_BUDGET', { field: 'dataNodes', maximum: limits.nodes, observed: used.nodes });
        if (depth > limits.depth)
            fail('LORE_DATA_BUDGET', { field: 'dataDepth', maximum: limits.depth, observed: depth });
        if (value === null || value === undefined) {
            count(4);
            return null;
        }
        if (typeof value === 'string') {
            text(value);
            return value;
        }
        if (typeof value === 'boolean') {
            count(value ? 4 : 5);
            return value;
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
                fail('LORE_DATA_INVALID');
            count(Buffer.byteLength(JSON.stringify(value), 'utf8'));
            return Object.is(value, -0) ? 0 : value;
        }
        if (typeof value !== 'object' || types.isProxy(value) || ancestors.has(value))
            fail('LORE_DATA_INVALID');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
            fail('LORE_DATA_INVALID');
        const names = Object.getOwnPropertyNames(value);
        if (names.length > limits.nodes - used.nodes + 1)
            fail('LORE_DATA_BUDGET', { field: 'dataNodes', maximum: limits.nodes });
        if (Object.getOwnPropertySymbols(value).length)
            fail('LORE_DATA_INVALID');
        const descriptors = Object.getOwnPropertyDescriptors(value);
        ancestors.add(value);
        count(2);
        let result;
        if (array) {
            const length = descriptors.length?.value;
            if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0)
                fail('LORE_DATA_INVALID');
            if (length > limits.nodes)
                fail('LORE_DATA_BUDGET', { field: 'dataNodes', maximum: limits.nodes, observed: length });
            if (names.some(key => key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)))
                fail('LORE_DATA_INVALID');
            const values = [];
            for (let index = 0; index < length; index++) {
                const descriptor = descriptors[String(index)];
                if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
                    fail('LORE_DATA_INVALID');
                if (index)
                    count(1);
                values.push(visit(descriptor.value, depth + 1));
            }
            result = values;
        }
        else {
            const values = {};
            let fields = 0;
            for (const key of names) {
                const descriptor = descriptors[key];
                if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable
                    || ['__proto__', 'prototype', 'constructor'].includes(key))
                    fail('LORE_DATA_INVALID');
                if (descriptor.value === undefined)
                    continue;
                if (fields++)
                    count(1);
                text(key);
                count(1);
                values[key] = visit(descriptor.value, depth + 1);
            }
            result = values;
        }
        ancestors.delete(value);
        return result;
    };
    return visit(data, 0);
}
/** Legacy import integrity owns the immutable original-file transport scalar.
 * Borrow only that string; all semantic fields still consume the lore budget.
 * Descriptors keep accessors/proxies out of this path without executing them. */
export function cloneRoleplayTavernLoreImportRecordV1(data, maxBytes = TAVERN_LORE_DATA_BOUNDS_V1.bytes, recordBounds, sharedBudget) {
    const plain = (value) => {
        if (value === null || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    };
    const clone = (value) => cloneRoleplayTavernLoreDataV1(value, maxBytes, recordBounds, sharedBudget);
    if (!plain(data))
        return clone(data);
    const recordDescriptors = Object.getOwnPropertyDescriptors(data);
    const version = recordDescriptors.schemaVersion?.value, envelope = recordDescriptors.sourceEnvelope?.value;
    if ((version !== 4 && version !== 5) || !plain(envelope))
        return clone(data);
    const envelopeDescriptors = Object.getOwnPropertyDescriptors(envelope), base64 = envelopeDescriptors.base64?.value;
    if (envelopeDescriptors.schemaVersion?.value !== 1 || typeof base64 !== 'string')
        return clone(data);
    envelopeDescriptors.base64 = { ...envelopeDescriptors.base64, value: '' };
    recordDescriptors.sourceEnvelope = { ...recordDescriptors.sourceEnvelope,
        value: Object.create(Object.getPrototypeOf(envelope), envelopeDescriptors) };
    const result = clone(Object.create(Object.getPrototypeOf(data), recordDescriptors));
    const clonedEnvelope = result.sourceEnvelope;
    clonedEnvelope.base64 = base64;
    return result;
}
