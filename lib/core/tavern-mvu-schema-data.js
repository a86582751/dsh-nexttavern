// Generated from runtime/alpha3/src/core/tavern-mvu-schema-data.ts; edit the TypeScript source.
/** Author execution envelopes have a different budget from numerical values.
 * Descriptor validation happens before hashing, serialization or worker transfer;
 * a valid hash is data integrity and does not prove historical execution. */
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { recordSha256 } from './roleplay-data.js';
import { MVU_SCHEMA_BOUNDS } from './tavern-mvu-schema-types.js';
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
function fail(code) { throw Error(code); }
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function clone(input, maxBytes, maxDepth, maxNodes) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 16777216)
        fail('SCHEMA_DATA_LIMIT');
    const ancestors = new Set();
    let nodes = 0, bytes = 0;
    const count = (value) => {
        bytes += Buffer.byteLength(value, 'utf8');
        if (bytes > maxBytes)
            fail('SCHEMA_DATA_BYTE_LIMIT');
    };
    function visit(value, depth) {
        if (++nodes > maxNodes)
            fail('SCHEMA_DATA_NODE_LIMIT');
        if (depth > maxDepth)
            fail('SCHEMA_DATA_DEPTH_LIMIT');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'string') {
            count(value);
            return value;
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
                fail('SCHEMA_NUMBER_LIMIT');
            return Object.is(value, -0) ? 0 : value;
        }
        if (typeof value !== 'object')
            fail('SCHEMA_NON_JSON_VALUE');
        // A Proxy can execute even getPrototypeOf/ownKeys. Refuse before any trap.
        if (types.isProxy(value))
            fail('SCHEMA_PROXY_VALUE');
        if (ancestors.has(value))
            fail('SCHEMA_CYCLIC_VALUE');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
            fail('SCHEMA_OBJECT_PROTOTYPE');
        // Count keys before allocating one descriptor object per key. Proxy traps
        // have already been excluded, and a giant flat object cannot amplify here.
        if (Object.getOwnPropertyNames(value).length > maxNodes - nodes + 1)
            fail('SCHEMA_DATA_NODE_LIMIT');
        if (Object.getOwnPropertySymbols(value).length)
            fail('SCHEMA_NON_JSON_VALUE');
        const descriptors = Object.getOwnPropertyDescriptors(value), keys = Object.keys(descriptors);
        if (keys.length > maxNodes - nodes + 1)
            fail('SCHEMA_DATA_NODE_LIMIT');
        ancestors.add(value);
        let result;
        if (array) {
            const length = descriptors.length?.value;
            if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > MVU_SCHEMA_BOUNDS.arrayLength) {
                fail('SCHEMA_ARRAY_LIMIT');
            }
            if (keys.some(key => key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)))
                fail('SCHEMA_ARRAY_PROPERTY');
            result = [];
            for (let index = 0; index < length; index++) {
                const descriptor = descriptors[String(index)];
                if (!descriptor || !own(descriptor, 'value') || !descriptor.enumerable)
                    fail('SCHEMA_NON_JSON_VALUE');
                result.push(visit(descriptor.value, depth + 1));
            }
        }
        else {
            result = {};
            for (const key of keys) {
                count(key);
                if (forbidden.has(key))
                    fail('SCHEMA_PROTOTYPE_KEY');
                const descriptor = descriptors[key];
                if (!own(descriptor, 'value') || !descriptor.enumerable)
                    fail('SCHEMA_NON_JSON_VALUE');
                result[key] = visit(descriptor.value, depth + 1);
            }
        }
        ancestors.delete(value);
        return result;
    }
    const result = visit(input, 0);
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') > maxBytes)
        fail('SCHEMA_DATA_BYTE_LIMIT');
    return result;
}
/** Clones aliases independently. The generic signature retains the envelope's
 * declared type; callers must still validate its required fields and hashes. */
export function cloneSchemaData(input, maxBytes, recordBounds) {
    const depth = recordBounds?.depth ?? 64, nodes = recordBounds?.nodes ?? 64000;
    if (!Number.isSafeInteger(depth) || depth < 1 || depth > MVU_SCHEMA_BOUNDS.evaluationDepth
        || !Number.isSafeInteger(nodes) || nodes < 1 || nodes > MVU_SCHEMA_BOUNDS.evaluationNodes)
        fail('SCHEMA_DATA_LIMIT');
    return clone(input, maxBytes, depth, nodes);
}
export function cloneSchemaValues(input) {
    const value = clone(input, MVU_SCHEMA_BOUNDS.valuesBytes, MVU_SCHEMA_BOUNDS.dataDepth, MVU_SCHEMA_BOUNDS.dataNodes);
    if (!object(value))
        fail('SCHEMA_ROOT_OBJECT_REQUIRED');
    return value;
}
export function schemaTextSha256(text) {
    if (typeof text !== 'string')
        fail('SCHEMA_TEXT_REQUIRED');
    return createHash('sha256').update(text, 'utf8').digest('hex');
}
function exact(value, keys) {
    const present = Object.keys(value);
    if (present.length !== keys.length || present.some(key => !keys.includes(key)))
        fail('SCHEMA_RECORD_SHAPE');
}
function text(value, max) {
    return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= max;
}
function implementation(value, compiler = false) {
    if (!object(value))
        fail('SCHEMA_IMPLEMENTATION_INVALID');
    exact(value, compiler ? ['id', 'version', 'implementationSha256', 'typescriptVersion'] : ['id', 'version', 'implementationSha256']);
    if (typeof value.id !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(value.id)
        || typeof value.version !== 'number' || !Number.isSafeInteger(value.version) || value.version < 1
        || !hash(value.implementationSha256) || compiler && value.typescriptVersion !== '5.9.3')
        fail('SCHEMA_IMPLEMENTATION_INVALID');
}
function library(value) {
    if (!object(value))
        fail('SCHEMA_LIBRARY_INVALID');
    exact(value, ['kind', 'packageName', 'version', 'bundleSha256', 'globalName']);
    if (!['zod', 'lodash'].includes(String(value.kind)) || !text(value.packageName, 256) || !text(value.version, 128)
        || !hash(value.bundleSha256) || typeof value.globalName !== 'string' || !/^[A-Za-z_$][\w$]{0,127}$/.test(value.globalName)
        || forbidden.has(value.globalName))
        fail('SCHEMA_LIBRARY_INVALID');
}
function source(value) {
    if (!object(value))
        fail('SCHEMA_SOURCE_INVALID');
    exact(value, ['ownerSessionId', 'importId', 'sourceSha256', 'importRecordSha256', 'sourceSnapshotSha256', 'material', 'materialSha256']);
    if (!text(value.ownerSessionId, 256) || !text(value.importId, 256) || !hash(value.sourceSha256)
        || !hash(value.importRecordSha256) || !hash(value.sourceSnapshotSha256) || !hash(value.materialSha256)
        || !object(value.material) || recordSha256(value.material) !== value.materialSha256)
        fail('SCHEMA_SOURCE_INVALID');
}
function script(value, libraries, bridge, compiled) {
    if (!object(value))
        fail('SCHEMA_SCRIPT_INVALID');
    exact(value, ['identity', 'pointer', 'enabled', 'source', 'sourceSha256', 'imports',
        ...(compiled ? ['javascript', 'javascriptSha256'] : [])]);
    if (!text(value.identity, 256) || typeof value.pointer !== 'string' || Buffer.byteLength(value.pointer, 'utf8') > 4096
        || value.pointer !== '' && !value.pointer.startsWith('/') || typeof value.enabled !== 'boolean'
        || typeof value.source !== 'string' || Buffer.byteLength(value.source, 'utf8') > MVU_SCHEMA_BOUNDS.sourceBytes
        || !hash(value.sourceSha256) || schemaTextSha256(value.source) !== value.sourceSha256
        || !Array.isArray(value.imports) || value.imports.length > 128)
        fail('SCHEMA_SCRIPT_INVALID');
    const specifiers = new Set();
    for (const binding of value.imports) {
        if (!object(binding))
            fail('SCHEMA_IMPORT_INVALID');
        exact(binding, ['specifier', 'kind', 'implementationSha256']);
        if (!text(binding.specifier, 4096) || !['zod', 'lodash', 'schema-bridge'].includes(String(binding.kind))
            || !hash(binding.implementationSha256) || specifiers.has(binding.specifier))
            fail('SCHEMA_IMPORT_INVALID');
        specifiers.add(binding.specifier);
        const expected = binding.kind === 'schema-bridge' ? bridge.implementationSha256
            : libraries.find(item => item.kind === binding.kind)?.bundleSha256;
        if (!expected || binding.implementationSha256 !== expected)
            fail('SCHEMA_IMPORT_CLOSURE');
    }
    if (compiled && (typeof value.javascript !== 'string' || !hash(value.javascriptSha256)
        || schemaTextSha256(value.javascript) !== value.javascriptSha256))
        fail('SCHEMA_COMPILED_SCRIPT_INVALID');
}
/** Exact metadata validation, kept separate from the compiler's actual replay. */
export function validateSchemaProgram(input) {
    const value = cloneSchemaData(input, MVU_SCHEMA_BOUNDS.programBytes);
    if (!object(value))
        fail('SCHEMA_PROGRAM_INVALID');
    exact(value, ['schemaVersion', 'encoding', 'compiler', 'source', 'scripts', 'libraries', 'bridge', 'programSha256']);
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-author-schema-program-v1' || !hash(value.programSha256)) {
        fail('SCHEMA_PROGRAM_INVALID');
    }
    implementation(value.compiler, true);
    implementation(value.bridge);
    source(value.source);
    if (!Array.isArray(value.libraries) || value.libraries.length > 2)
        fail('SCHEMA_LIBRARY_INVALID');
    const kinds = new Set(), globals = new Set();
    const validatedLibraries = [];
    for (const item of value.libraries) {
        library(item);
        if (kinds.has(item.kind) || globals.has(item.globalName))
            fail('SCHEMA_LIBRARY_DUPLICATE');
        kinds.add(item.kind);
        globals.add(item.globalName);
        validatedLibraries.push(item);
    }
    if (!Array.isArray(value.scripts) || !value.scripts.length || value.scripts.length > MVU_SCHEMA_BOUNDS.scripts)
        fail('SCHEMA_SCRIPT_LIMIT');
    const identities = new Set();
    let sourceBytes = 0;
    for (const item of value.scripts) {
        script(item, validatedLibraries, value.bridge, true);
        if (identities.has(item.identity))
            fail('SCHEMA_SCRIPT_DUPLICATE');
        identities.add(item.identity);
        sourceBytes += Buffer.byteLength(item.source, 'utf8');
        if (sourceBytes > MVU_SCHEMA_BOUNDS.sourceBytes)
            fail('SCHEMA_SOURCE_LIMIT');
    }
    const { programSha256, ...descriptor } = value;
    if (recordSha256(descriptor) !== programSha256)
        fail('SCHEMA_PROGRAM_HASH');
    return value;
}
