// Generated from runtime/alpha3/src/core/roleplay-mvu-player-records.ts; edit the TypeScript source.
/** Player replacement provenance is distinct from completed story work. These
 * immutable encodings contain facts only; they cannot create a Native marker,
 * Source lock, hot lease, model result or publication permission. */
import { recordSha256 } from './roleplay-data.js';
export const MVU_PLAYER_VALUES_BOUNDS = Object.freeze({ bytes: 1048576, depth: 32, nodes: 32000,
    arrayLength: 4096, numberMagnitude: Number.MAX_SAFE_INTEGER });
export class MvuPlayerDataRefusal extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
/** Explicit replacement data has stricter limits than its enclosing record.
 * Read descriptors first and copy every occurrence; no getter or input alias
 * can affect the value after the operation's hash was checked. */
export function cloneMvuPlayerReplacement(input) {
    function fail(code) { throw new MvuPlayerDataRefusal(code); }
    if (!input || typeof input !== 'object' || Array.isArray(input))
        return fail('MANUAL_REPLACEMENT_INVALID');
    const wrapper = Object.getOwnPropertyDescriptors(input), prototype = Object.getPrototypeOf(input);
    if (![Object.prototype, null].includes(prototype) || Object.getOwnPropertySymbols(input).length
        || Object.keys(wrapper).sort().join(',') !== 'values,valuesSha256'
        || Object.values(wrapper).some(item => !Object.hasOwn(item, 'value') || !item.enumerable)) {
        return fail('MANUAL_REPLACEMENT_INVALID');
    }
    const ancestors = new Set();
    let nodes = 0, bytes = 0;
    const account = (text) => {
        bytes += Buffer.byteLength(text, 'utf8');
        if (bytes > MVU_PLAYER_VALUES_BOUNDS.bytes)
            fail('MANUAL_VALUES_LIMIT');
    };
    function visit(value, depth) {
        if (++nodes > MVU_PLAYER_VALUES_BOUNDS.nodes || depth > MVU_PLAYER_VALUES_BOUNDS.depth)
            fail('MANUAL_VALUES_LIMIT');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'string') {
            account(value);
            return value;
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || Math.abs(value) > MVU_PLAYER_VALUES_BOUNDS.numberMagnitude)
                fail('MANUAL_VALUES_INVALID');
            return Object.is(value, -0) ? 0 : value;
        }
        if (!value || typeof value !== 'object' || ancestors.has(value))
            return fail('MANUAL_VALUES_INVALID');
        const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
        if ((array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
            || Object.getOwnPropertySymbols(value).length)
            return fail('MANUAL_VALUES_INVALID');
        const descriptors = Object.getOwnPropertyDescriptors(value);
        ancestors.add(value);
        let result;
        if (array) {
            const length = descriptors.length?.value;
            if (!Number.isSafeInteger(length) || length < 0 || length > MVU_PLAYER_VALUES_BOUNDS.arrayLength
                || Object.keys(descriptors).length !== length + 1)
                return fail('MANUAL_VALUES_INVALID');
            result = [];
            for (let index = 0; index < length; index++) {
                const item = descriptors[String(index)];
                if (!item || !Object.hasOwn(item, 'value') || !item.enumerable)
                    return fail('MANUAL_VALUES_INVALID');
                result.push(visit(item.value, depth + 1));
            }
        }
        else {
            result = {};
            for (const [key, item] of Object.entries(descriptors)) {
                if (['__proto__', 'prototype', 'constructor'].includes(key) || !Object.hasOwn(item, 'value') || !item.enumerable) {
                    return fail('MANUAL_VALUES_INVALID');
                }
                account(key);
                result[key] = visit(item.value, depth + 1);
            }
        }
        ancestors.delete(value);
        return result;
    }
    const values = visit(wrapper.values.value, 0);
    if (!values || typeof values !== 'object' || Array.isArray(values))
        return fail('MANUAL_VALUES_INVALID');
    if (Buffer.byteLength(JSON.stringify(values), 'utf8') > MVU_PLAYER_VALUES_BOUNDS.bytes)
        fail('MANUAL_VALUES_LIMIT');
    const valuesSha256 = wrapper.valuesSha256.value;
    if (typeof valuesSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(valuesSha256) || recordSha256(values) !== valuesSha256) {
        return fail('MANUAL_REPLACEMENT_INVALID');
    }
    return { values, valuesSha256 };
}
/** Exact record constructors; callers must first validate/clone the intent.
 * These functions mint descriptors, never a marker or authority token. */
export function mvuPlayerEventFor(intent) {
    const descriptor = { schemaVersion: 1, encoding: 'native-mvu-player-state-update-event-v1',
        sessionId: intent.sessionId, sourceSha256: intent.sourceSha256, root: intent.base.root, eventId: intent.intentSha256,
        revision: intent.base.revision + 1, intent, replacement: intent.replacement, valuesSha256: intent.replacement.valuesSha256 };
    return { ...descriptor, eventSha256: recordSha256(descriptor) };
}
export function mvuPlayerHeadFor(event) {
    return { schemaVersion: 2, encoding: 'native-mvu-state-current-head-v2', provenance: 'player',
        sessionId: event.sessionId, sourceSha256: event.sourceSha256, root: event.root, revision: event.revision,
        eventId: event.eventId, eventSha256: event.eventSha256, valuesSha256: event.valuesSha256, intentSha256: event.intent.intentSha256 };
}
export function mvuPlayerSettlementFor(intent, head, event) {
    const result = { head, headSha256: recordSha256(head),
        revision: head.revision, valuesSha256: head.valuesSha256, ...(event ? { event } : {}) };
    const descriptor = { schemaVersion: 1, encoding: 'native-mvu-player-state-publisher-settlement-v1',
        sessionId: intent.sessionId, sourceSha256: intent.sourceSha256, intent, replacement: intent.replacement,
        outcome: event ? 'updated' : 'no-update', result };
    return { ...descriptor, settlementSha256: recordSha256(descriptor) };
}
