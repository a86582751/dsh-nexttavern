// Generated from runtime/alpha3/src/core/roleplay-mvu-update.ts; edit the TypeScript source.
/** Deterministic native-jsonpatch-v1 data reducer. No writer, model, schema
 * interpreter or helper script lives here; publication owns Source/turn CAS. */
import { recordSha256 } from './roleplay-data.js';
export const MVU_UPDATE_BOUNDS = Object.freeze({ blockBytes: 65536, jsonBytes: 65536, operations: 64,
    pathDepth: 32, pathBytes: 4096, dataDepth: 32, dataBytes: 1048576, nodes: 32000, arrayLength: 4096,
    numberMagnitude: Number.MAX_SAFE_INTEGER });
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const escaped = (key) => key.replace(/~/g, '~0').replace(/\//g, '~1');
class UpdateRefusal extends Error {
    code;
    pointer;
    constructor(code, pointer) {
        super(code);
        this.code = code;
        this.pointer = pointer;
    }
}
function reject(code, pointer) { throw new UpdateRefusal(code, pointer); }
/** Validate descriptors before reading data; clone aliases independently, reject
 * getters, sparse arrays, exotic prototypes, symbols and ancestor cycles. */
function cloneData(input, depthLimit = MVU_UPDATE_BOUNDS.dataDepth) {
    const ancestors = new Set();
    let nodes = 0, stringBytes = 0;
    const bytes = (text) => {
        stringBytes += Buffer.byteLength(text, 'utf8');
        if (stringBytes > MVU_UPDATE_BOUNDS.dataBytes)
            reject('DATA_BYTE_LIMIT');
    };
    function visit(value, pointer, depth) {
        if (++nodes > MVU_UPDATE_BOUNDS.nodes)
            reject('DATA_NODE_LIMIT', pointer);
        if (depth > depthLimit)
            reject('DATA_DEPTH_LIMIT', pointer);
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'string') {
            bytes(value);
            return value;
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || Math.abs(value) > MVU_UPDATE_BOUNDS.numberMagnitude)
                reject('NUMBER_LIMIT', pointer);
            return Object.is(value, -0) ? 0 : value;
        }
        if (typeof value !== 'object')
            reject('NON_JSON_VALUE', pointer);
        if (ancestors.has(value))
            reject('CYCLIC_VALUE', pointer);
        const prototype = Object.getPrototypeOf(value);
        const array = Array.isArray(value);
        if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
            reject('OBJECT_PROTOTYPE', pointer);
        if (Object.getOwnPropertySymbols(value).length)
            reject('NON_JSON_VALUE', pointer);
        const descriptors = Object.getOwnPropertyDescriptors(value);
        ancestors.add(value);
        let result;
        if (array) {
            const length = descriptors.length?.value;
            if (typeof length !== 'number' || !Number.isSafeInteger(length) || length > MVU_UPDATE_BOUNDS.arrayLength)
                reject('ARRAY_LIMIT', pointer);
            if (Object.keys(descriptors).some(key => key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length))) {
                reject('ARRAY_PROPERTY', pointer);
            }
            result = [];
            for (let index = 0; index < length; index++) {
                const descriptor = descriptors[String(index)];
                if (!descriptor || !own(descriptor, 'value') || !descriptor.enumerable)
                    reject('NON_JSON_VALUE', `${pointer}/${index}`);
                result.push(visit(descriptor.value, `${pointer}/${index}`, depth + 1));
            }
        }
        else {
            result = {};
            for (const key of Object.keys(descriptors)) {
                bytes(key);
                const path = `${pointer}/${escaped(key)}`, descriptor = descriptors[key];
                if (forbidden.has(key))
                    reject('PROTOTYPE_KEY', path);
                if (!own(descriptor, 'value') || !descriptor.enumerable)
                    reject('NON_JSON_VALUE', path);
                result[key] = visit(descriptor.value, path, depth + 1);
            }
        }
        ancestors.delete(value);
        return result;
    }
    const result = visit(input, '', 0);
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') > MVU_UPDATE_BOUNDS.dataBytes)
        reject('DATA_BYTE_LIMIT');
    return result;
}
function valuesObject(value) {
    const result = cloneData(value);
    if (!object(result))
        reject('ROOT_OBJECT_REQUIRED', '');
    return result;
}
/** JSON.parse alone silently chooses the last duplicate key. This small grammar
 * accepts only bounded JSON and rejects ambiguity before descriptor reduction. */
function strictJson(text) {
    if (Buffer.byteLength(text, 'utf8') > MVU_UPDATE_BOUNDS.jsonBytes)
        reject('JSON_BYTE_LIMIT');
    let offset = 0, nodes = 0;
    const whitespace = () => { while (/[\x20\t\r\n]/.test(text[offset] ?? 'X'))
        offset++; };
    function string() {
        const start = offset++;
        while (offset < text.length) {
            const char = text[offset++];
            if (char === '"') {
                try {
                    return JSON.parse(text.slice(start, offset));
                }
                catch {
                    reject('NON_STRICT_JSON');
                }
            }
            if (char === '\\')
                offset++;
        }
        reject('NON_STRICT_JSON');
    }
    function value(depth) {
        if (++nodes > MVU_UPDATE_BOUNDS.nodes)
            reject('DATA_NODE_LIMIT');
        if (depth > MVU_UPDATE_BOUNDS.dataDepth + 2)
            reject('DATA_DEPTH_LIMIT');
        whitespace();
        const char = text[offset];
        if (char === '"')
            return string();
        if (char === '{' || char === '[') {
            const array = char === '[', end = array ? ']' : '}';
            const result = [], record = Object.create(null), keys = new Set();
            offset++;
            whitespace();
            if (text[offset] === end) {
                offset++;
                return array ? result : record;
            }
            while (true) {
                whitespace();
                let key = '';
                if (!array) {
                    if (text[offset] !== '"')
                        reject('NON_STRICT_JSON');
                    key = string();
                    if (keys.has(key))
                        reject('DUPLICATE_JSON_KEY');
                    keys.add(key);
                    whitespace();
                    if (text[offset++] !== ':')
                        reject('NON_STRICT_JSON');
                }
                const entry = value(depth + 1);
                if (array)
                    result.push(entry);
                else
                    record[key] = entry;
                whitespace();
                const separator = text[offset++];
                if (separator === end)
                    return array ? result : record;
                if (separator !== ',')
                    reject('NON_STRICT_JSON');
            }
        }
        const literal = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(offset))?.[0];
        if (!literal)
            reject('NON_STRICT_JSON');
        offset += literal.length;
        return JSON.parse(literal);
    }
    const result = value(0);
    whitespace();
    if (offset !== text.length)
        reject('NON_STRICT_JSON');
    return result;
}
const updateHint = /<\/?\s*(?:UpdateVariable|JSONPatch|json_patch|Analyze|Analysis)\b/i;
const legacyCommand = /\b_\s*\.\s*(?:set|add|assign|insert|remove|unset|delete|move)\s*\(/;
function extract(narrative) {
    if (typeof narrative !== 'string')
        reject('NARRATIVE_TYPE');
    if (!updateHint.test(narrative)) {
        if (legacyCommand.test(narrative))
            reject('LEGACY_COMMAND_UNSUPPORTED');
        return undefined;
    }
    const tags = [...narrative.matchAll(/<\/?UpdateVariable\b[^>]*>/gi)];
    if (tags.length > 2)
        reject('AMBIGUOUS_UPDATE_CONTAINER');
    if (tags.length !== 2 || tags[0][0] !== '<UpdateVariable>' || tags[1][0] !== '</UpdateVariable>') {
        reject('UPDATE_CONTAINER_FORMAT');
    }
    const start = tags[0].index, end = tags[1].index + tags[1][0].length;
    const block = narrative.slice(start, end);
    if (Buffer.byteLength(block, 'utf8') > MVU_UPDATE_BOUNDS.blockBytes)
        reject('UPDATE_BLOCK_BYTE_LIMIT');
    if (updateHint.test(narrative.slice(0, start) + narrative.slice(end)))
        reject('STRAY_UPDATE_MARKUP');
    let body = block.slice('<UpdateVariable>'.length, -'</UpdateVariable>'.length).trim();
    if (body.startsWith('<Analyze>')) {
        const close = body.indexOf('</Analyze>');
        if (close < 0)
            reject('ANALYZE_FORMAT');
        const analysis = body.slice('<Analyze>'.length, close);
        if (/<\/?[A-Za-z][^>]*>/.test(analysis))
            reject('NESTED_UPDATE_MARKUP');
        body = body.slice(close + '</Analyze>'.length).trim();
    }
    const patch = /^<JSONPatch>([\s\S]*)<\/JSONPatch>$/.exec(body);
    if (!patch) {
        if (legacyCommand.test(body))
            reject('LEGACY_COMMAND_UNSUPPORTED');
        reject('UPDATE_CONTENT_UNSUPPORTED');
    }
    if (/^\s*_\s*\./.test(patch[1]) && legacyCommand.test(patch[1]))
        reject('LEGACY_COMMAND_UNSUPPORTED');
    if (updateHint.test(patch[1]))
        reject('NESTED_UPDATE_MARKUP');
    return patch[1];
}
function pointer(path) {
    if (typeof path !== 'string' || Buffer.byteLength(path, 'utf8') > MVU_UPDATE_BOUNDS.pathBytes)
        reject('POINTER_FORMAT');
    if (path === '')
        return [];
    if (!path.startsWith('/'))
        reject('POINTER_FORMAT', path);
    const parts = path.slice(1).split('/');
    if (parts.length > MVU_UPDATE_BOUNDS.pathDepth)
        reject('POINTER_DEPTH_LIMIT', path);
    return parts.map(part => {
        if (/~(?:[^01]|$)/.test(part))
            reject('POINTER_ESCAPE', path);
        const key = part.replace(/~([01])/g, (_match, escape) => escape === '0' ? '~' : '/');
        if (forbidden.has(key))
            reject('PROTOTYPE_KEY', path);
        return key;
    });
}
function operation(raw) {
    const descriptor = cloneData(raw, MVU_UPDATE_BOUNDS.dataDepth + 1);
    if (!object(descriptor) || typeof descriptor.op !== 'string')
        reject('OPERATION_SHAPE');
    const op = descriptor.op;
    if (!['test', 'replace', 'add', 'remove', 'copy', 'move'].includes(op))
        reject('OPERATION_UNSUPPORTED');
    const fields = op === 'copy' || op === 'move' ? ['op', 'path', 'from'] : op === 'remove' ? ['op', 'path'] : ['op', 'path', 'value'];
    if (fields.some(key => !own(descriptor, key)) || Object.keys(descriptor).some(key => !fields.includes(key)))
        reject('OPERATION_SHAPE');
    if (typeof descriptor.path !== 'string')
        reject('POINTER_FORMAT');
    pointer(descriptor.path);
    if (op === 'copy' || op === 'move') {
        if (typeof descriptor.from !== 'string')
            reject('POINTER_FORMAT');
        pointer(descriptor.from);
        return { op, path: descriptor.path, from: descriptor.from };
    }
    if (op === 'remove')
        return { op, path: descriptor.path };
    return { op: op, path: descriptor.path, value: cloneData(descriptor.value) };
}
function arrayIndex(key, length, add, path) {
    if (key === '-' && add)
        return length;
    if (!/^(0|[1-9]\d*)$/.test(key))
        reject('ARRAY_INDEX', path);
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index > (add ? length : length - 1))
        reject('PATH_MISSING', path);
    return index;
}
function read(root, parts, path) {
    let value = root;
    for (const key of parts) {
        if (Array.isArray(value))
            value = value[arrayIndex(key, value.length, false, path)];
        else if (object(value) && own(value, key))
            value = value[key];
        else
            reject('PATH_MISSING', path);
    }
    return value;
}
function change(root, parts, path, mode, value) {
    if (!parts.length) {
        if (mode === 'remove')
            reject('ROOT_REMOVE_UNSUPPORTED', path);
        return value;
    }
    const parent = read(root, parts.slice(0, -1), path), key = parts.at(-1);
    if (Array.isArray(parent)) {
        const index = arrayIndex(key, parent.length, mode === 'add', path);
        if (mode === 'add')
            parent.splice(index, 0, value);
        else if (mode === 'remove')
            parent.splice(index, 1);
        else
            parent[index] = value;
    }
    else if (object(parent)) {
        if (mode !== 'add' && !own(parent, key))
            reject('PATH_MISSING', path);
        if (mode === 'remove')
            delete parent[key];
        else
            parent[key] = value;
    }
    else
        reject('PATH_MISSING', path);
    return root;
}
function apply(root, op) {
    const path = pointer(op.path);
    let result = root;
    if (op.op === 'test') {
        if (recordSha256(read(root, path, op.path)) !== recordSha256(op.value))
            reject('TEST_FAILED', op.path);
    }
    else if (op.op === 'add' || op.op === 'replace')
        result = change(root, path, op.path, op.op, cloneData(op.value));
    else if (op.op === 'remove')
        result = change(root, path, op.path, 'remove');
    else if (op.op === 'copy' || op.op === 'move') {
        const from = pointer(op.from), value = cloneData(read(root, from, op.from));
        if (op.op === 'move') {
            if (path.length > from.length && from.every((part, index) => part === path[index]))
                reject('MOVE_INTO_DESCENDANT', op.path);
            if (op.path === op.from)
                return root;
            result = change(root, from, op.from, 'remove');
        }
        result = change(result, path, op.path, 'add', value);
    }
    // Bound intermediate amplification too, before any following copy/move.
    return valuesObject(result);
}
export function prepareMvuUpdate(narrative, baseValues) {
    let operationIndex;
    try {
        const payload = extract(narrative);
        if (payload === undefined)
            return { kind: 'no-update' };
        const parsed = strictJson(payload);
        if (!Array.isArray(parsed))
            reject('PATCH_ARRAY_REQUIRED');
        if (!parsed.length)
            reject('EMPTY_PATCH');
        if (parsed.length > MVU_UPDATE_BOUNDS.operations)
            reject('OPERATION_LIMIT');
        const base = valuesObject(baseValues), baseValuesSha256 = recordSha256(base), operations = [];
        let values = base;
        for (const [index, raw] of parsed.entries()) {
            operationIndex = index;
            const op = operation(raw);
            values = apply(values, op);
            operations.push(op);
        }
        const valuesSha256 = recordSha256(values);
        const descriptor = { schemaVersion: 1, protocol: 'native-jsonpatch-v1',
            operations, baseValuesSha256, valuesSha256 };
        return { kind: 'prepared', ...descriptor, values, proposalSha256: recordSha256(descriptor) };
    }
    catch (error) {
        return { kind: 'rejected', schemaVersion: 1, code: error instanceof UpdateRefusal ? error.code : 'UPDATE_INPUT_UNKNOWN',
            ...(error instanceof UpdateRefusal && error.pointer !== undefined ? { pointer: error.pointer } : {}),
            ...(operationIndex !== undefined ? { operationIndex } : {}) };
    }
}
