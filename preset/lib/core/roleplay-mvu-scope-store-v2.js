// Generated from runtime/alpha3/src/core/roleplay-mvu-scope-store-v2.ts; edit the TypeScript source.
/** Immutable scope objects are execution inputs, never another numerical head.
 * Source/publication owners call this store inside their existing boundary. */
import { createMvuScopeValueV2, createMvuScopeBaseV2, createMvuScopeDeltaV2, createMvuScopeReadRefV2, scopeObjectRefV2, createMvuScopeViewResolverV2, validateMvuScopeReadRefV2, validateMvuScopeObjectV2 } from './tavern-mvu-scope-view-v2.js';
import { validateSchemaScopeProgramViewV2 } from './tavern-mvu-schema-runner-v4.js';
const objectKey = (sid, sha256) => `${sid}__mvu-scope-object-v2-${sha256}`;
const refKey = (ref) => JSON.stringify([ref.ownerSessionId, ref.key, ref.sha256]);
const sameSource = (a, b) => a.sessionId === b.sessionId
    && a.sourceRecordSessionId === b.sourceRecordSessionId && a.importId === b.importId && a.rawSha256 === b.rawSha256
    && a.sourceSnapshotSha256 === b.sourceSnapshotSha256;
function fail(code) { throw Error(code); }
export function createRoleplayMvuScopeStoreV2(deps) {
    let disposed = false;
    const readers = new Set();
    const bindingsOwners = new Set();
    function readObject(ref, table = deps.table) {
        if (disposed)
            fail('SCOPE_VIEW_STORE_DISPOSED');
        if (ref.key !== objectKey(ref.ownerSessionId, ref.sha256))
            fail('SCOPE_VIEW_OBJECT_ADDRESS_MISMATCH');
        return table.get(ref.key);
    }
    async function writeObject(ownerSessionId, object, check) {
        check();
        // The codec's own immutable object retains its already-computed complete
        // DATA hash. Key derivation does not hash the same object a second time.
        const sha256 = scopeObjectRefV2(ownerSessionId, 'scope-object-key', object).sha256, key = objectKey(ownerSessionId, sha256), wanted = scopeObjectRefV2(ownerSessionId, key, object);
        const exact = (actual) => {
            return actual !== undefined && scopeObjectRefV2(ownerSessionId, key, actual).sha256 === sha256;
        };
        const prior = readObject(wanted);
        if (prior !== undefined) {
            if (!exact(prior))
                fail('SCOPE_VIEW_OBJECT_WRITE_CONFLICT');
            check();
            return wanted;
        }
        try {
            await deps.table.put(key, object);
        }
        catch { /* A lost ACK is settled by exact actual readback. */ }
        check();
        if (!exact(readObject(wanted)))
            fail('SCOPE_VIEW_OBJECT_WRITE_UNKNOWN');
        return wanted;
    }
    function reader(table = deps.table) {
        let closed = false;
        let resolver = createMvuScopeViewResolverV2({ read: ref => readObject(ref, table) }), dirty = false;
        const facts = new Map();
        let previous;
        function readScopeReferences(program, reference, binding, load) {
            if (closed || disposed)
                fail('SCOPE_VIEW_STORE_DISPOSED');
            reference = validateMvuScopeReadRefV2(reference);
            if (reference.sourceNativeCutSha256 !== binding.sourceNativeCutSha256)
                fail('SCHEMA_SCOPE_BINDING_MISMATCH');
            if (dirty) {
                for (const fact of facts.values())
                    fact.dispose();
                facts.clear();
                previous = undefined;
                resolver = createMvuScopeViewResolverV2({ read: ref => readObject(ref, table) });
                dirty = false;
            }
            const known = facts.get(reference.viewSha256);
            if (known) {
                const data = known.use();
                if (data.programSha256 !== program.programSha256 || data.realmEpoch !== binding.realmEpoch
                    || data.source.sourceSnapshotSha256 !== binding.sourceSnapshotSha256)
                    fail('SCHEMA_SCOPE_BINDING_MISMATCH');
                // This finite metadata belongs to the old exact view, rather than the
                // resolver's later mutable current position during historical reads.
                validateSchemaScopeProgramViewV2(program, { source: data.source }, data.scripts, binding, load);
                return;
            }
            const fact = deps.inputState.captureClosedData(binding.ownerSessionId, () => {
                previous?.use();
                const resolved = resolver.resolve(reference);
                if (resolved.realmEpoch !== binding.realmEpoch
                    || resolved.view.source.sourceSnapshotSha256 !== binding.sourceSnapshotSha256)
                    fail('SCHEMA_SCOPE_BINDING_MISMATCH');
                validateSchemaScopeProgramViewV2(program, resolved.view, resolved.scripts(), binding, load);
                const source = Object.freeze({ ...resolved.view.source }), scripts = Object.freeze([...resolved.scripts()].map(({ scriptId, pointer, sourceSha256 }) => Object.freeze({ scriptId, pointer, sourceSha256 })));
                return Object.freeze({ reference, programSha256: program.programSha256, source, scripts, realmEpoch: resolved.realmEpoch });
            });
            fact.onInvalidated(() => { dirty = true; });
            facts.set(reference.viewSha256, fact);
            previous = fact;
            fact.use();
        }
        const result = { readScopeReferences, readObject: (ref) => readObject(ref, table),
            dispose() {
                if (closed)
                    return;
                closed = true;
                for (const fact of facts.values())
                    fact.dispose();
                facts.clear();
                previous = undefined;
                readers.delete(result);
            } };
        readers.add(result);
        return result;
    }
    /** Frozen/export selection walks original phase order once. A fresh closed
     * resolver records every required object, even if a live reader knows it. */
    function captureScopeObjects(references, table = deps.table) {
        const objects = new Map(), pending = [];
        for (const reference of references) {
            pending.push(reference.baseRef, reference.tailRef);
        }
        while (pending.length) {
            const reference = pending.pop(), key = refKey(reference);
            if (objects.has(key))
                continue;
            const raw = readObject(reference, table);
            if (raw === undefined)
                fail('SCOPE_VIEW_OBJECT_MISSING');
            const object = validateMvuScopeObjectV2(raw);
            if (scopeObjectRefV2(reference.ownerSessionId, reference.key, object).sha256 !== reference.sha256) {
                fail('SCOPE_VIEW_OBJECT_HASH_MISMATCH');
            }
            objects.set(key, Object.freeze({ ref: reference, object }));
            if (object.encoding === 'native-mvu-scope-base-v2') {
                pending.push(...Object.values(object.scopes), ...object.scripts.map(item => item.valueRef), ...object.messages.map(item => item.valueRef));
            }
            else if (object.encoding === 'native-mvu-scope-delta-v2') {
                pending.push(object.baseRef, object.previousRef);
                for (const change of object.changes) {
                    if (change.kind === 'scope')
                        pending.push(change.valueRef);
                    else if (change.kind === 'script-upsert')
                        pending.push(change.script.valueRef);
                    else if (change.kind === 'message-splice')
                        for (const message of change.messages)
                            pending.push(message.valueRef);
                }
            }
        }
        return Object.freeze([...objects.values()]);
    }
    function bindings(table = deps.table) {
        const byBase = new Map();
        const result = { readScopeReferences(program, reference, binding, load) {
                const key = refKey(reference.baseRef);
                let entry = byBase.get(key);
                if (!entry)
                    byBase.set(key, entry = { sessionId: binding.ownerSessionId, reader: reader(table) });
                entry.reader.readScopeReferences(program, reference, binding, load);
            }, captureScopeObjects: (references) => captureScopeObjects(references, table),
            readObject: (ref) => readObject(ref, table),
            releaseSession(sessionId) {
                for (const [key, entry] of byBase)
                    if (entry.sessionId === sessionId) {
                        entry.reader.dispose();
                        byBase.delete(key);
                    }
            }, dispose() { for (const entry of byBase.values())
                entry.reader.dispose(); byBase.clear(); bindingsOwners.delete(result); } };
        bindingsOwners.add(result);
        return result;
    }
    function publisher(input) {
        let baseRef, tailRef, source, closed = false;
        const resolver = createMvuScopeViewResolverV2({ read: ref => readObject(ref) });
        const current = () => { if (closed || disposed)
            fail('SCOPE_VIEW_STORE_DISPOSED'); input.check(); };
        function resume(reference) {
            current();
            if (baseRef)
                fail('SCOPE_VIEW_BASE_ALREADY_CREATED');
            reference = validateMvuScopeReadRefV2(reference);
            const resolved = resolver.resolve(reference);
            if (resolved.realmEpoch !== input.realmEpoch || resolved.view.source.sessionId !== input.ownerSessionId) {
                fail('SCHEMA_SCOPE_BINDING_MISMATCH');
            }
            current();
            baseRef = reference.baseRef;
            tailRef = reference.tailRef;
            source = resolved.view.source;
            return resolved;
        }
        async function valueRef(nextSource, scope, identity, ownerSessionId, value) {
            return writeObject(input.ownerSessionId, createMvuScopeValueV2({ binding: { source: nextSource, scope, identity, ownerSessionId,
                    stateOwner: scope === 'message' ? ownerSessionId : null }, value }), current);
        }
        async function script(nextSource, item) {
            const { variables, ...metadata } = item;
            return { ...metadata, valueRef: await valueRef(nextSource, 'script', item.scriptId, nextSource.sessionId, variables) };
        }
        async function message(nextSource, item) {
            const { variables, ...metadata } = item;
            return { ...metadata, valueRef: await valueRef(nextSource, 'message', item.messageId, item.ownerSessionId, variables) };
        }
        async function initialize(initial, cutSha256) {
            current();
            if (baseRef)
                fail('SCOPE_VIEW_BASE_ALREADY_CREATED');
            const scopes = {};
            for (const name of ['chat', 'character', 'global']) {
                scopes[name] = await valueRef(initial.source, name, name, initial.source.sessionId, initial.scopes[name]);
            }
            const scripts = [], messages = [];
            for (const item of initial.scripts)
                scripts.push(await script(initial.source, item));
            for (const item of initial.messages)
                messages.push(await message(initial.source, item));
            const object = createMvuScopeBaseV2({ realmEpoch: input.realmEpoch, source: initial.source, scopes, scripts, messages }), reference = await writeObject(input.ownerSessionId, object, current), readRef = createMvuScopeReadRefV2({ baseRef: reference, tailRef: reference, sourceNativeCutSha256: cutSha256 });
            resolver.resolve(readRef);
            current();
            baseRef = reference;
            tailRef = reference;
            source = initial.source;
            return readRef;
        }
        async function advance(nextSource, changes, cutSha256) {
            current();
            if (!baseRef || !tailRef || !source)
                fail('SCOPE_VIEW_BASE_REQUIRED');
            if (!changes.length && sameSource(source, nextSource)) {
                return createMvuScopeReadRefV2({ baseRef, tailRef, sourceNativeCutSha256: cutSha256 });
            }
            const encoded = [];
            for (const change of changes) {
                if (change.kind === 'scope')
                    encoded.push({ kind: 'scope', scope: change.scope,
                        valueRef: await valueRef(nextSource, change.scope, change.scope, nextSource.sessionId, change.value) });
                else if (change.kind === 'script-upsert')
                    encoded.push({ kind: change.kind, script: await script(nextSource, change.script) });
                else if (change.kind === 'script-delete')
                    encoded.push(change);
                else {
                    const messages = [];
                    for (const item of change.messages)
                        messages.push(await message(nextSource, item));
                    encoded.push({ kind: change.kind, index: change.index, deleteCount: change.deleteCount, messages });
                }
            }
            const object = createMvuScopeDeltaV2({ baseRef, previousRef: tailRef, sourceBinding: nextSource, changes: encoded }), next = await writeObject(input.ownerSessionId, object, current), reference = createMvuScopeReadRefV2({ baseRef, tailRef: next, sourceNativeCutSha256: cutSha256 });
            resolver.resolve(reference);
            current();
            tailRef = next;
            source = nextSource;
            return reference;
        }
        return { initialize, resume, advance, dispose() { closed = true; source = undefined; baseRef = undefined; tailRef = undefined; } };
    }
    return { readObject, writeObject, reader, bindings, captureScopeObjects, publisher,
        releaseSession(sessionId) { for (const own of bindingsOwners)
            own.releaseSession(sessionId); },
        dispose() {
            if (disposed)
                return;
            for (const own of [...bindingsOwners])
                own.dispose();
            for (const own of [...readers])
                own.dispose();
            disposed = true;
        } };
}
