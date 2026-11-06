// Generated from runtime/alpha3/src/core/tavern-mvu-scope-view-v2.ts; edit the TypeScript source.
/** Closed immutable scope DATA. These references convey no publication authority. */
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData } from './tavern-mvu-schema-data.js';
import { validateMvuScopeVariablesV1 } from './tavern-mvu-scope-read.js';
import { MVU_SCOPE_READ_LIMITS as limits } from './tavern-mvu-scope-read-types.js';
export class MvuScopeViewError extends Error {
    code;
    ref;
    constructor(code, ref) {
        super(code);
        this.code = code;
        this.ref = ref;
        this.name = 'MvuScopeViewError';
    }
}
function fail(code, ref) { throw new MvuScopeViewError(code, ref); }
const invalid = () => fail('SCOPE_VIEW_DATA_INVALID');
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = (value, max = 256) => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= max;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function exact(value, keys) {
    if (!object(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key)))
        invalid();
}
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
function source(value) {
    exact(value, ['sessionId', 'sourceRecordSessionId', 'importId', 'rawSha256', 'sourceSnapshotSha256']);
    if (!text(value.sessionId) || !text(value.sourceRecordSessionId) || !text(value.importId)
        || !hash(value.rawSha256) || !hash(value.sourceSnapshotSha256))
        invalid();
}
function ref(value) {
    exact(value, ['ownerSessionId', 'key', 'sha256']);
    if (!text(value.ownerSessionId) || !text(value.key, 4096) || !hash(value.sha256))
        invalid();
}
const key = (value) => JSON.stringify([value.ownerSessionId, value.key, value.sha256]);
const physicalKey = (value) => JSON.stringify([value.ownerSessionId, value.key]);
const sameRef = (a, b) => a.ownerSessionId === b.ownerSessionId && a.key === b.key && a.sha256 === b.sha256;
function sameRealm(a, b) {
    return a.sessionId === b.sessionId && a.sourceRecordSessionId === b.sourceRecordSessionId
        && a.importId === b.importId && a.rawSha256 === b.rawSha256;
}
function script(value) {
    exact(value, ['scriptId', 'pointer', 'sourceSha256', 'valueRef']);
    if (!text(value.scriptId) || typeof value.pointer !== 'string' || Buffer.byteLength(value.pointer) > 4096
        || value.pointer !== '' && !value.pointer.startsWith('/') || !hash(value.sourceSha256))
        invalid();
    ref(value.valueRef);
}
function message(value) {
    exact(value, ['ownerSessionId', 'nativeSeq', 'messageId', 'messageVersionSha256', 'selectedVariant', 'isSystem', 'valueRef']);
    if (!text(value.ownerSessionId) || !Number.isSafeInteger(value.nativeSeq) || value.nativeSeq < 0
        || !text(value.messageId) || !hash(value.messageVersionSha256) || !text(value.selectedVariant)
        || typeof value.isSystem !== 'boolean')
        invalid();
    ref(value.valueRef);
}
function summary(value) {
    let nodes = 0, depth = 0;
    function visit(item, level) {
        nodes++;
        depth = Math.max(depth, level);
        if (item && typeof item === 'object')
            for (const child of Object.values(item))
                visit(child, level + 1);
    }
    visit(value, 0);
    return { bytes: Buffer.byteLength(JSON.stringify(value)), nodes, depth };
}
const decoded = new WeakMap();
function decode(input) {
    if (input && typeof input === 'object') {
        const prior = decoded.get(input);
        if (prior)
            return prior;
    }
    // Physical references add storage metadata; the unfolded logical view still
    // uses the exact existing frame budget below, including repeated slots.
    const value = cloneSchemaData(input, 16_777_216, { nodes: limits.valueNodes, depth: limits.valueDepth });
    if (!object(value) || value.schemaVersion !== 2)
        invalid();
    let slot;
    if (value.encoding === 'native-mvu-scope-value-v2') {
        exact(value, ['schemaVersion', 'encoding', 'binding', 'value']);
        const binding = value.binding;
        exact(binding, ['source', 'scope', 'identity', 'ownerSessionId', 'stateOwner']);
        source(binding.source);
        if (!['chat', 'message', 'character', 'script', 'global'].includes(binding.scope) || !text(binding.identity)
            || !text(binding.ownerSessionId) || binding.stateOwner !== null && !text(binding.stateOwner))
            invalid();
        validateMvuScopeVariablesV1(value.value, binding.source, binding.scope, binding.identity, binding.ownerSessionId, binding.stateOwner ?? undefined);
        slot = summary(value.value);
    }
    else if (value.encoding === 'native-mvu-scope-base-v2') {
        exact(value, ['schemaVersion', 'encoding', 'realmEpoch', 'source', 'scopes', 'scripts', 'messages']);
        if (!text(value.realmEpoch))
            invalid();
        source(value.source);
        exact(value.scopes, ['chat', 'character', 'global']);
        for (const item of Object.values(value.scopes))
            ref(item);
        if (!Array.isArray(value.scripts) || value.scripts.length > limits.scripts
            || !Array.isArray(value.messages) || value.messages.length > limits.messages)
            invalid();
        for (const item of value.scripts)
            script(item);
        for (const item of value.messages)
            message(item);
    }
    else if (value.encoding === 'native-mvu-scope-delta-v2') {
        exact(value, ['schemaVersion', 'encoding', 'baseRef', 'previousRef', 'sourceBinding', 'changes']);
        ref(value.baseRef);
        ref(value.previousRef);
        source(value.sourceBinding);
        if (!Array.isArray(value.changes))
            invalid();
        for (const change of value.changes) {
            if (!object(change))
                invalid();
            if (change.kind === 'scope') {
                exact(change, ['kind', 'scope', 'valueRef']);
                if (!['chat', 'character', 'global'].includes(change.scope))
                    invalid();
                ref(change.valueRef);
            }
            else if (change.kind === 'script-upsert') {
                exact(change, ['kind', 'script']);
                script(change.script);
            }
            else if (change.kind === 'script-delete') {
                exact(change, ['kind', 'scriptId']);
                if (!text(change.scriptId))
                    invalid();
            }
            else if (change.kind === 'message-splice') {
                exact(change, ['kind', 'index', 'deleteCount', 'messages']);
                if (!Number.isSafeInteger(change.index) || change.index < 0 || !Number.isSafeInteger(change.deleteCount)
                    || change.deleteCount < 0 || !Array.isArray(change.messages) || change.messages.length > limits.messages)
                    invalid();
                for (const item of change.messages)
                    message(item);
            }
            else
                invalid();
        }
    }
    else
        invalid();
    freeze(value);
    const result = { value, sha256: recordSha256(value), slot };
    decoded.set(value, result);
    return result;
}
/** Decode one complete immutable object without resolving or hydrating a view. */
export function validateMvuScopeObjectV2(input) { return decode(input).value; }
export function createMvuScopeValueV2(body) {
    return decode({ schemaVersion: 2, encoding: 'native-mvu-scope-value-v2', ...body }).value;
}
export function createMvuScopeBaseV2(body) {
    return decode({ schemaVersion: 2, encoding: 'native-mvu-scope-base-v2', ...body }).value;
}
export function createMvuScopeDeltaV2(body) {
    return decode({ schemaVersion: 2, encoding: 'native-mvu-scope-delta-v2', ...body }).value;
}
export function scopeObjectRefV2(ownerSessionId, keyValue, value) {
    const result = { ownerSessionId, key: keyValue, sha256: decode(value).sha256 };
    ref(result);
    return Object.freeze(result);
}
function viewHash(value) {
    return recordSha256({ encoding: 'native-mvu-scope-view-identity-v2', baseRef: value.baseRef, tailRef: value.tailRef,
        sourceNativeCutSha256: value.sourceNativeCutSha256 });
}
export function createMvuScopeReadRefV2(body) {
    return validateMvuScopeReadRefV2({ schemaVersion: 2, encoding: 'native-mvu-scope-read-ref-v2', ...body, viewSha256: viewHash(body) });
}
const readRefs = new WeakSet();
export function validateMvuScopeReadRefV2(input) {
    if (input && typeof input === 'object' && readRefs.has(input))
        return input;
    const value = cloneSchemaData(input, 16384);
    exact(value, ['schemaVersion', 'encoding', 'baseRef', 'tailRef', 'sourceNativeCutSha256', 'viewSha256']);
    if (value.schemaVersion !== 2 || value.encoding !== 'native-mvu-scope-read-ref-v2'
        || !hash(value.sourceNativeCutSha256) || !hash(value.viewSha256))
        invalid();
    ref(value.baseRef);
    ref(value.tailRef);
    if (viewHash(value) !== value.viewSha256)
        fail('SCOPE_VIEW_IDENTITY_MISMATCH');
    freeze(value);
    readRefs.add(value);
    return value;
}
const messageKey = (item) => JSON.stringify([item.ownerSessionId, item.nativeSeq]);
function digits(count) {
    if (!count)
        return 0;
    let total = 1;
    for (let start = 1, width = 1; start < count; start *= 10, width++)
        total += (Math.min(count, start * 10) - start) * width;
    return total;
}
/** One resolver belongs to one realm/base and advances through real phase order.
 * A caller restoring a historical tail creates another resolver. */
export function createMvuScopeViewResolverV2(deps) {
    const cache = new Map(), physical = new Map(), applied = new Set();
    let baseRef, tailRef, currentSource, realmEpoch;
    const scopes = {};
    const scripts = new Map(), pointers = new Map(), messages = [];
    const messageKeys = new Set();
    const nonSystemPositions = [];
    let bytes = 0, nodes = 0;
    const view = Object.freeze({
        get source() { return currentSource; },
        get scopes() { return { chat: scopes.chat.item, character: scopes.character.item, global: scopes.global.item }; },
        script: (id) => scripts.get(id)?.item,
        get messageCount() { return messages.length; }, messageAt: (index) => messages[index]?.item,
        get latestMessage() { return messages[nonSystemPositions.at(-1) ?? -1]?.item; },
    });
    function load(reference, reads) {
        const id = key(reference), existing = cache.get(id);
        if (existing)
            return existing;
        const physicalId = physicalKey(reference), prior = physical.get(physicalId);
        if (prior !== undefined && prior !== reference.sha256)
            fail('SCOPE_VIEW_REF_CONFLICT', reference);
        const raw = deps.read(reference);
        if (raw === undefined || raw === null)
            fail('SCOPE_VIEW_OBJECT_MISSING', reference);
        let result;
        try {
            result = decode(raw);
        }
        catch (error) {
            throw new MvuScopeViewError(error instanceof MvuScopeViewError ? error.code :
                error instanceof Error ? error.message : 'SCOPE_VIEW_DATA_INVALID', reference);
        }
        if (result.sha256 !== reference.sha256)
            fail('SCOPE_VIEW_OBJECT_HASH_MISMATCH', reference);
        physical.set(physicalId, reference.sha256);
        cache.set(id, result);
        reads.push(reference);
        return result;
    }
    function value(reference, sourceValue, scope, identity, ownerSessionId, reads) {
        const result = load(reference, reads), record = result.value;
        if (record.encoding !== 'native-mvu-scope-value-v2')
            fail('SCOPE_VIEW_VALUE_REQUIRED', reference);
        const binding = record.binding;
        if (!sameRealm(binding.source, sourceValue) || binding.scope !== scope || binding.identity !== identity
            || binding.ownerSessionId !== ownerSessionId
            || scope === 'message' && binding.stateOwner !== ownerSessionId)
            fail('SCOPE_VIEW_BINDING_MISMATCH', reference);
        const stats = result.slot;
        if (stats.depth + (scope === 'message' || scope === 'script' ? 3 : 2) > limits.valueDepth)
            fail('SCHEMA_DATA_DEPTH_LIMIT', reference);
        return { item: record.value, summary: stats };
    }
    function scriptSlot(item, sourceValue, reads) {
        const slot = value(item.valueRef, sourceValue, 'script', item.scriptId, sourceValue.sessionId, reads);
        const { valueRef: _, ...metadata } = item;
        const metadataStats = summary({ ...metadata, variables: null });
        return { item: Object.freeze({ ...metadata, variables: slot.item }), summary: { bytes: metadataStats.bytes - 4 + slot.summary.bytes,
                nodes: metadataStats.nodes - 1 + slot.summary.nodes, depth: 0 } };
    }
    function messageSlot(item, sourceValue, reads) {
        const slot = value(item.valueRef, sourceValue, 'message', item.messageId, item.ownerSessionId, reads);
        const { valueRef: _, ...metadata } = item;
        const metadataStats = summary({ ...metadata, variables: null });
        return { item: Object.freeze({ ...metadata, variables: slot.item }), summary: { bytes: metadataStats.bytes - 4 + slot.summary.bytes + 12,
                nodes: metadataStats.nodes + slot.summary.nodes, depth: 0 } };
    }
    function add(stats, direction) { bytes += stats.bytes * direction; nodes += stats.nodes * direction; }
    function budget(sourceValue, cut) {
        const fixed = summary({ schemaVersion: 1, encoding: 'native-mvu-scope-read-frame-v1', source: sourceValue,
            sourceNativeCutSha256: cut, viewKind: 'script', scopes: { chat: null, character: null, global: null }, scripts: [], messages: [], frameSha256: '0'.repeat(64) });
        const total = bytes + fixed.bytes - 12 + Math.max(0, scripts.size - 1) + Math.max(0, messages.length - 1) + digits(messages.length);
        if (scripts.size > limits.scripts || messages.length > limits.messages)
            fail('SCOPE_VIEW_COUNT_LIMIT');
        if (total > limits.frameBytes)
            fail('SCHEMA_DATA_BYTE_LIMIT');
        if (nodes + fixed.nodes - 3 > limits.valueNodes)
            fail('SCHEMA_DATA_NODE_LIMIT');
        return total;
    }
    function putScript(id, slot) {
        const prior = scripts.get(id);
        if (prior) {
            scripts.delete(id);
            pointers.delete(prior.item.pointer);
            add(prior.summary, -1);
        }
        if (slot) {
            scripts.set(id, slot);
            pointers.set(slot.item.pointer, id);
            add(slot.summary, 1);
        }
    }
    function splice(index, remove, insert) {
        function lowerBound(position) {
            let low = 0, high = nonSystemPositions.length;
            while (low < high) {
                const middle = (low + high) >>> 1;
                if (nonSystemPositions[middle] < position)
                    low = middle + 1;
                else
                    high = middle;
            }
            return low;
        }
        const first = index === messages.length ? nonSystemPositions.length : lowerBound(index);
        const end = remove ? lowerBound(index + remove) : first, insertedPositions = [];
        for (let offset = 0; offset < insert.length; offset++)
            if (!insert[offset].item.isSystem)
                insertedPositions.push(index + offset);
        nonSystemPositions.splice(first, end - first, ...insertedPositions);
        const shift = insert.length - remove;
        if (shift)
            for (let offset = first + insertedPositions.length; offset < nonSystemPositions.length; offset++) {
                nonSystemPositions[offset] += shift;
            }
        const removed = messages.splice(index, remove, ...insert);
        for (const slot of removed) {
            messageKeys.delete(messageKey(slot.item));
            add(slot.summary, -1);
        }
        for (const slot of insert) {
            messageKeys.add(messageKey(slot.item));
            add(slot.summary, 1);
        }
        return removed;
    }
    function result(reads, logicalBytes) {
        return { view, realmEpoch, *scripts() { for (const slot of scripts.values())
                yield slot.item; },
            readRefs: Object.freeze(reads), readObjects: Object.freeze(reads.map(reference => Object.freeze({
                ref: reference, object: cache.get(key(reference)).value
            }))), logicalBytes };
    }
    function resolveAttempt(input, reads) {
        const requested = validateMvuScopeReadRefV2(input), undo = [];
        if (baseRef && !sameRef(baseRef, requested.baseRef))
            fail('SCOPE_VIEW_REALM_REBIND', requested.baseRef);
        if (tailRef && sameRef(tailRef, requested.tailRef)) {
            return result(reads, budget(currentSource, requested.sourceNativeCutSha256));
        }
        if (applied.has(key(requested.tailRef)))
            fail('SCOPE_VIEW_TAIL_REGRESSION', requested.tailRef);
        const chain = [];
        let cursor = requested.tailRef;
        while (!sameRef(cursor, tailRef ?? requested.baseRef)) {
            const row = load(cursor, reads).value;
            if (row.encoding !== 'native-mvu-scope-delta-v2')
                fail('SCOPE_VIEW_DELTA_REQUIRED', cursor);
            if (!sameRef(row.baseRef, requested.baseRef) || applied.has(key(cursor)))
                fail('SCOPE_VIEW_CHAIN_MISMATCH', cursor);
            chain.push({ reference: cursor, delta: row });
            cursor = row.previousRef;
        }
        const initial = !baseRef, priorSource = currentSource;
        let logicalBytes = 0;
        try {
            if (initial) {
                const row = load(requested.baseRef, reads).value;
                if (row.encoding !== 'native-mvu-scope-base-v2')
                    fail('SCOPE_VIEW_BASE_REQUIRED', requested.baseRef);
                currentSource = row.source;
                realmEpoch = row.realmEpoch;
                for (const scope of ['chat', 'character', 'global']) {
                    scopes[scope] = value(row.scopes[scope], row.source, scope, scope, row.source.sessionId, reads);
                    add(scopes[scope].summary, 1);
                }
                for (const item of row.scripts) {
                    if (scripts.has(item.scriptId) || pointers.has(item.pointer))
                        fail('SCOPE_VIEW_SCRIPT_CONFLICT', requested.baseRef);
                    putScript(item.scriptId, scriptSlot(item, row.source, reads));
                }
                for (const item of row.messages) {
                    if (messageKeys.has(messageKey(item)))
                        fail('SCOPE_VIEW_MESSAGE_CONFLICT', requested.baseRef);
                    splice(messages.length, 0, [messageSlot(item, row.source, reads)]);
                }
                logicalBytes = budget(currentSource, requested.sourceNativeCutSha256);
            }
            for (const { delta, reference } of chain.reverse()) {
                if (!sameRealm(currentSource, delta.sourceBinding))
                    fail('SCOPE_VIEW_REALM_REBIND', reference);
                for (const change of delta.changes) {
                    if (change.kind === 'scope') {
                        const prior = scopes[change.scope], next = value(change.valueRef, delta.sourceBinding, change.scope, change.scope, currentSource.sessionId, reads);
                        add(prior.summary, -1);
                        scopes[change.scope] = next;
                        add(next.summary, 1);
                        undo.push(() => { add(next.summary, -1); scopes[change.scope] = prior; add(prior.summary, 1); });
                    }
                    else if (change.kind === 'script-upsert') {
                        const item = change.script, prior = scripts.get(item.scriptId), pointer = pointers.get(item.pointer);
                        if (pointer !== undefined && pointer !== item.scriptId)
                            fail('SCOPE_VIEW_SCRIPT_CONFLICT', reference);
                        const next = scriptSlot(item, delta.sourceBinding, reads);
                        putScript(item.scriptId, next);
                        undo.push(() => putScript(item.scriptId, prior));
                    }
                    else if (change.kind === 'script-delete') {
                        const prior = scripts.get(change.scriptId);
                        if (!prior)
                            fail('SCOPE_VIEW_SCRIPT_MISSING', reference);
                        putScript(change.scriptId, undefined);
                        undo.push(() => putScript(change.scriptId, prior));
                    }
                    else {
                        if (change.index > messages.length || change.deleteCount > messages.length - change.index)
                            fail('SCOPE_VIEW_SPLICE_RANGE', reference);
                        const removedKeys = new Set(messages.slice(change.index, change.index + change.deleteCount).map(slot => messageKey(slot.item)));
                        const insertedKeys = new Set(), insert = change.messages.map(item => {
                            const id = messageKey(item);
                            if (insertedKeys.has(id) || messageKeys.has(id) && !removedKeys.has(id))
                                fail('SCOPE_VIEW_MESSAGE_CONFLICT', reference);
                            insertedKeys.add(id);
                            return messageSlot(item, delta.sourceBinding, reads);
                        });
                        const removed = splice(change.index, change.deleteCount, insert);
                        undo.push(() => { splice(change.index, insert.length, removed); });
                    }
                }
                currentSource = delta.sourceBinding;
                logicalBytes = budget(currentSource, requested.sourceNativeCutSha256);
            }
            baseRef = requested.baseRef;
            tailRef = requested.tailRef;
            applied.add(key(baseRef));
            for (const { reference } of chain)
                applied.add(key(reference));
            return result(reads, logicalBytes);
        }
        catch (error) {
            if (initial) {
                scripts.clear();
                pointers.clear();
                messages.length = 0;
                messageKeys.clear();
                nonSystemPositions.length = 0;
                bytes = 0;
                nodes = 0;
            }
            else {
                for (const reverse of undo.reverse())
                    reverse();
                currentSource = priorSource;
            }
            throw error;
        }
    }
    function resolve(input) {
        const reads = [];
        try {
            return resolveAttempt(input, reads);
        }
        catch (error) {
            // Failed resolution never publishes a dependency list. Do not retain
            // newly read cache entries that a successful retry could omit from it.
            for (const reference of reads) {
                cache.delete(key(reference));
                physical.delete(physicalKey(reference));
            }
            throw error;
        }
    }
    return Object.freeze({ resolve });
}
