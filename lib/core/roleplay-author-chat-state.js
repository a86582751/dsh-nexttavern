// Generated from runtime/alpha3/src/core/roleplay-author-chat-state.ts; edit the TypeScript source.
/** Canonical ordinary chat namespace owner. Core retains Source's FIFO. */
import { recordSha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
const isContribution = (event) => 'kind' in event && event.kind === 'accepted-contribution';
const isBatch = (event) => 'kind' in event && event.kind === 'ordinary-batch';
const appendText = (value) => value === null ? '' :
    typeof value === 'object' ? JSON.stringify(value) : String(value);
function fail(code) { throw Error(code); }
const frozen = new WeakSet();
function freeze(value) {
    if (value && typeof value === 'object') {
        if (frozen.has(value))
            return value;
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
        frozen.add(value);
    }
    return value;
}
const same = (left, right) => recordSha256(left) === recordSha256(right);
const address = (namespace) => recordSha256(namespace);
const forkBaseKey = (namespace, namespaceSha256) => `${namespace.sessionId}__author-chat-fork-base-v3_${namespaceSha256}`;
export const authorChatEventKeyV3 = (namespace, operationId) => `${namespace.sessionId}__author-chat-key-event-v3_${recordSha256({ namespace, operationId })}`;
export const authorChatContributionIdV3 = (namespace, inputId) => recordSha256({ namespace, inputId });
export function createCanonicalAuthorChatStateV1(options) {
    const { table, roots } = options;
    const parsed = new WeakMap();
    // Each namespace has one mutable current index. Historical roots build their
    // own lazy index, so later parent commits cannot mutate a frozen child view.
    const liveIndexes = new Map();
    const historicalIndexes = new Map();
    const publicationClosures = new Map();
    const certifiedRoots = new Set();
    const rowFacts = new WeakMap();
    function read(key, encoding) {
        const raw = table.get(key);
        if (raw === undefined)
            return undefined;
        if (!raw || typeof raw !== 'object')
            fail('AUTHOR_CHAT_RECORD_INVALID');
        const cached = parsed.get(raw);
        if (cached) {
            if (cached.encoding !== encoding)
                fail('AUTHOR_CHAT_RECORD_INVALID');
            return cached;
        }
        const value = cloneRoleplayTavernLoreDataV1(raw);
        const { sha256, ...body } = value;
        if (value.schemaVersion !== 3 || value.encoding !== encoding || sha256 !== recordSha256(body))
            fail('AUTHOR_CHAT_RECORD_INVALID');
        const result = freeze(value);
        parsed.set(raw, result);
        return result;
    }
    function referenced(ref, encoding) {
        const value = read(ref.key, encoding);
        if (!value || value.sha256 !== ref.sha256)
            fail('AUTHOR_CHAT_HISTORY_MISSING');
        return value;
    }
    async function put(key, value, beforeWrite) {
        const release = beforeWrite?.({ key, value });
        try {
            await table.put(key, value);
        }
        finally {
            release?.();
        }
        parsed.set(value, value);
    }
    function captureNamespaceRootV3(namespace) {
        const namespaceSha256 = address(namespace), current = roots.currentRoot(namespace, namespaceSha256);
        if (current)
            return freeze(current);
        const key = forkBaseKey(namespace, namespaceSha256), base = read(key, 'native-author-chat-fork-base-record-v3');
        return freeze({ namespace: cloneRoleplayTavernLoreDataV1(namespace), head: null,
            base: base ? { key, sha256: base.sha256 } : null });
    }
    function captureNamespaceRootAtNativeCut(namespace, cut) {
        const empty = () => freeze({ namespace: cloneRoleplayTavernLoreDataV1(namespace), head: null, base: null });
        if (cut.length === 0)
            return empty();
        let current = namespace;
        for (;;) {
            const namespaceSha256 = address(current), root = roots.cutRoot(current, namespaceSha256, cut);
            if (root)
                return freeze(root);
            const base = read(forkBaseKey(current, namespaceSha256), 'native-author-chat-fork-base-record-v3');
            if (!base)
                return empty();
            // The marker must belong to this actual carrier prefix. The fixed base
            // supplies ancestry identity only, never its possibly later frozen head.
            current = base.seed.parentRoot.namespace;
        }
    }
    function captureForkNamespaceRootAtCut(namespace, cut) {
        const namespaceSha256 = address(namespace), local = roots.cutRoot(namespace, namespaceSha256, cut);
        if (local)
            return freeze(local);
        const key = forkBaseKey(namespace, namespaceSha256), base = read(key, 'native-author-chat-fork-base-record-v3');
        if (!base)
            return freeze({ namespace, head: null, base: null });
        const parent = captureForkNamespaceRootAtCut(base.seed.parentRoot.namespace, cut);
        // A base-only child still owns its committed frozen inheritance. Preserve
        // that relation only when the selected carrier cut contains the exact
        // frozen parent root; an earlier fork cut must resolve its earlier facts.
        return same(parent, base.seed.parentRoot)
            ? freeze({ namespace, head: null, base: { key, sha256: base.sha256 } }) : parent;
    }
    function captureNamespaceRootsAtNativeCut(input) {
        const { namespaceOwner, cut } = input;
        if (cut.length === 0)
            return Object.freeze([]);
        const candidates = new Map();
        const belongs = (namespace) => namespace.sessionId === namespaceOwner.sessionId
            && same(namespace.importIncarnation, namespaceOwner.importIncarnation);
        // Only committed Source packets supply base-only addresses. The stored
        // base relation resolves ancestor marker identity at the selected cut;
        // merely appearing in inherited Native history never grants an address.
        for (const seed of input.inheritedBases)
            if (belongs(seed.childNamespace))
                candidates.set(address(seed.childNamespace), seed.childNamespace);
        for (const marker of roots.markerHeadsAtCut(cut)) {
            const publication = referenced(marker.publication, 'native-author-chat-publication-v3');
            if (address(publication.namespace) !== marker.namespaceSha256 || !same(publication.base, marker.base))
                fail('AUTHOR_CHAT_NATIVE_BINDING_CHANGED');
            if (belongs(publication.namespace))
                candidates.set(marker.namespaceSha256, publication.namespace);
        }
        return Object.freeze([...candidates.values()].map(namespace => captureForkNamespaceRootAtCut(namespace, cut))
            .filter(root => root.head !== null || root.base !== null));
    }
    function applyWrites(before, writes) {
        let { exists, value } = before;
        for (const write of writes) {
            if (write.operation === 'delete') {
                exists = false;
                value = null;
                continue;
            }
            if (write.operation === 'set')
                value = write.value;
            else if (write.operation === 'append')
                value = appendText(value) + appendText(write.value);
            else
                value = (Number(value) || 0) + (Number(write.value) || 0);
            exists = true;
        }
        return { exists, value };
    }
    function replaceEffect(state, position, contributionId, writes) {
        const effects = state?.effects ?? [];
        let start = effects.length;
        // New ordinary writes append immediately. A replacement visits only the
        // suffix after its fixed position, including keys introduced by a regen.
        while (start > 0 && effects[start - 1].position >= position)
            start--;
        const remove = effects[start]?.contributionId === contributionId && effects[start]?.position === position ? 1 : 0;
        let value = start ? effects[start - 1].result : { exists: false, value: null };
        const insert = writes.length ? { position, contributionId, writes, result: applyWrites(value, writes) } : null, updates = [];
        if (insert)
            value = insert.result;
        let result = start + remove < effects.length ? effects.at(-1).result : value;
        for (let i = start + remove; i < effects.length; i++) {
            const effect = effects[i];
            // An unchanged absolute write owns the remaining value. Earlier changes
            // cannot flow through it, including a Browser updater's computed set.
            if (effect.writes.some(write => write.operation === 'set' || write.operation === 'delete'))
                break;
            value = applyWrites(value, effect.writes);
            updates.push({ index: i, effect: { ...effect, result: value } });
            if (i === effects.length - 1)
                result = value;
        }
        return { start, remove, insert, updates, result };
    }
    function project(event, eventRef, current) {
        const prior = isContribution(event) ? current.contributions.get(event.contributionId) : undefined, position = prior?.position ?? current.nextPosition, writes = isContribution(event) || isBatch(event) ? event.writes : [{ key: event.key, operation: 'set', value: event.value }], grouped = new Map();
        for (const write of writes) {
            const group = grouped.get(write.key) ?? [];
            group.push(write);
            grouped.set(write.key, group);
        }
        const affected = new Set([...(prior?.keys ?? []), ...grouped.keys()]), keys = new Map();
        for (const key of affected) {
            const before = current.keys.get(key), change = replaceEffect(before, position, isContribution(event) ? event.contributionId : null, grouped.get(key) ?? []), revision = { revision: (before?.current.revision.revision ?? 0) + 1, head: eventRef };
            keys.set(key, { ...change, current: { key, revision, ...change.result } });
        }
        return { keys, contribution: isContribution(event) ? { id: event.contributionId,
                value: { position, attemptId: event.attemptId, keys: [...grouped.keys()], firstSource: prior?.firstSource ?? event.source } } : null,
            nextPosition: prior ? current.nextPosition : current.nextPosition + 1 };
    }
    function applyProjection(current, change, receipt, eventRef) {
        for (const [key, value] of change.keys) {
            const state = current.keys.get(key) ?? { effects: [], current: value.current }, shift = (value.insert ? 1 : 0) - value.remove;
            if (value.insert && value.start === state.effects.length)
                state.effects.push(value.insert);
            else
                state.effects.splice(value.start, value.remove, ...(value.insert ? [value.insert] : []));
            for (const update of value.updates)
                state.effects[update.index + shift] = update.effect;
            state.current = value.current;
            current.keys.set(key, state);
        }
        if (change.contribution)
            current.contributions.set(change.contribution.id, change.contribution.value);
        current.nextPosition = change.nextPosition;
        if (!current.operations.has(eventRef.key))
            current.operations.set(eventRef.key, receipt);
    }
    function index(root, historical = false) {
        if (historical) {
            const live = liveIndexes.get(address(root.namespace));
            if (live && same(live.root, root))
                return live;
        }
        const id = historical ? recordSha256(root) : address(root.namespace);
        const cache = historical ? historicalIndexes : liveIndexes;
        const previous = cache.get(id);
        if (previous && same(previous.root, root))
            return previous;
        const pending = [];
        let cursor = root.head;
        while (cursor && (!previous || !same(cursor, previous.root.head))) {
            const node = referenced(cursor, 'native-author-chat-publication-v3');
            if (!same(node.namespace, root.namespace) || !same(node.base, root.base))
                fail('AUTHOR_CHAT_HISTORY_MISSING');
            pending.push({ ref: cursor, publication: node });
            cursor = node.previous;
        }
        // A historical/backward root must not reuse a later mutable index.
        const reusable = previous && same(cursor, previous.root.head) && same(root.base, previous.root.base);
        let result;
        if (reusable)
            result = previous;
        else {
            const base = root.base ? index(referenced(root.base, 'native-author-chat-fork-base-record-v3').seed.parentRoot, true) : undefined;
            result = { root, keys: new Map(base ? [...base.keys].map(([key, state]) => [key, { effects: state.effects.slice(), current: state.current }]) : []),
                operations: new Map(base?.operations),
                contributions: new Map(base?.contributions), nextPosition: base?.nextPosition ?? 0 };
        }
        for (let i = pending.length - 1; i >= 0; i--) {
            const receipt = pending[i], node = receipt.publication, event = referenced(node.event, 'native-author-chat-key-event-v3');
            if (!same(event.namespace, root.namespace))
                fail('AUTHOR_CHAT_HISTORY_MISSING');
            const change = project(event, node.event, result);
            for (const value of node.results)
                change.keys.get(value.key).current = value;
            applyProjection(result, change, receipt, node.event);
        }
        result.root = root;
        cache.set(id, result);
        return result;
    }
    function keyAt(root, key, historical) {
        const value = index(root, historical).keys.get(key)?.current;
        if (value) {
            return freeze({ schemaVersion: 3, authority: 'consumer-data-only', namespace: root.namespace, key, root,
                revision: value.revision, exists: value.exists, value: value.value });
        }
        return freeze({ schemaVersion: 3, authority: 'consumer-data-only', namespace: root.namespace, key, root,
            revision: { revision: 0, head: null }, exists: false, value: null });
    }
    const captureKeyAtRootV3 = (root, key) => keyAt(root, key, true);
    const captureKeyV3 = (namespace, key) => keyAt(captureNamespaceRootV3(namespace), key, false);
    function overlayAt(current, changes) {
        const values = Object.create(null);
        const deletedKeys = [];
        for (const [key, state] of current.keys) {
            const change = changes?.get(key), value = (change ?? state).current;
            if (value.exists)
                values[key] = value.value;
            else if (change ? change.active : state.effects.length > 0)
                deletedKeys.push(key);
        }
        return { values, ...deletedKeys.length ? { deletedKeys } : {} };
    }
    function captureNamespaceV3(namespace) {
        const root = captureNamespaceRootV3(namespace), current = index(root);
        // An accepted empty or deleted message container still exists. A frozen
        // fork of an untouched namespace does not create one merely by having base.
        return freeze({ schemaVersion: 3, authority: 'consumer-data-only', root,
            exists: current.nextPosition > 0, ...overlayAt(current) });
    }
    async function commitOrdinaryV3(input, owner) {
        const update = freeze(cloneRoleplayTavernLoreDataV1(input));
        if (!owner.ownsNamespace(update.namespace, update.cause))
            fail('AUTHOR_CHAT_NAMESPACE_UNAVAILABLE');
        const current = async () => { if (!await owner.isCurrent(update.namespace))
            fail('AUTHOR_CHAT_OWNER_CHANGED'); };
        await current();
        const inputSha256 = recordSha256(update), key = authorChatEventKeyV3(update.namespace, update.operationId);
        let event = read(key, 'native-author-chat-key-event-v3');
        const replayed = event !== undefined;
        if (event && event.inputSha256 !== inputSha256)
            fail('AUTHOR_CHAT_OPERATION_CHANGED');
        let root = captureNamespaceRootV3(update.namespace);
        if (event && index(root).operations.has(key)) {
            const eventRef = { key, sha256: event.sha256 };
            await roots.flush(update.namespace);
            return { kind: 'replayed', event: eventRef, committedRevision: { revision: event.revision, head: eventRef },
                capture: keyAt(root, update.key, false) };
        }
        const before = keyAt(root, update.key, false);
        if (!same(before.revision, update.expected))
            fail('AUTHOR_CHAT_REVISION_CHANGED');
        if (!event) {
            const body = { ...update, schemaVersion: 3, encoding: 'native-author-chat-key-event-v3',
                revision: before.revision.revision + 1, inputSha256 };
            event = freeze({ ...body, sha256: recordSha256(body) });
            await current();
            await put(key, event, owner.beforeWrite);
        }
        await current();
        // Re-read after the immutable event await. A pending event has no namespace
        // predecessor yet and may safely join a newer root when its key CAS holds.
        root = captureNamespaceRootV3(update.namespace);
        if (!same(keyAt(root, update.key, false).revision, update.expected))
            fail('AUTHOR_CHAT_REVISION_CHANGED');
        const eventRef = { key, sha256: event.sha256 }, currentIndex = index(root), change = project(event, eventRef, currentIndex);
        const body = { schemaVersion: 3, encoding: 'native-author-chat-publication-v3',
            namespace: update.namespace, event: eventRef, previous: root.head, base: root.base,
            results: [...change.keys.values()].map(value => value.current) };
        const node = freeze({ ...body, sha256: recordSha256(body) });
        const nodeKey = `${update.namespace.sessionId}__author-chat-publication-v3_${node.sha256}`;
        if (!read(nodeKey, 'native-author-chat-publication-v3'))
            await put(nodeKey, node, owner.beforeWrite);
        await current();
        // Domain outputs are durable before the synchronous Native marker append.
        // The marker's actual carrier position is the publication authority.
        const ref = { key: nodeKey, sha256: node.sha256 }, next = freeze({ ...root, head: ref });
        roots.publish(next, address(update.namespace), root.head);
        // A synchronous Native observer may already have consumed this marker.
        if (!same(currentIndex.root, next)) {
            applyProjection(currentIndex, change, { ref, publication: node }, eventRef);
            currentIndex.root = next;
        }
        await roots.flush(update.namespace);
        return { kind: replayed ? 'replayed' : 'committed', event: eventRef,
            committedRevision: { revision: event.revision, head: eventRef }, capture: captureKeyV3(update.namespace, update.key) };
    }
    function lookupOrdinaryV3(input) {
        const inputSha256 = recordSha256(input), key = authorChatEventKeyV3(input.namespace, input.operationId);
        const existing = read(key, 'native-author-chat-key-event-v3');
        if (!existing)
            return { kind: 'unconfirmed', inputSha256 };
        if (existing.inputSha256 !== inputSha256)
            fail('AUTHOR_CHAT_OPERATION_CHANGED');
        const event = { key, sha256: existing.sha256 }, root = captureNamespaceRootV3(input.namespace);
        return index(root).operations.has(key) ? { kind: 'applied', inputSha256, event,
            committedRevision: { revision: existing.revision, head: event }, capture: keyAt(root, input.key, false) }
            : { kind: 'pending', inputSha256, event };
    }
    async function confirmOrdinary(input) {
        const receipt = lookupOrdinaryV3(input);
        if (receipt.kind === 'applied')
            await roots.flush(input.namespace);
        return receipt;
    }
    function readAcceptedContribution(namespace, contributionId) {
        const contribution = index(captureNamespaceRootV3(namespace)).contributions.get(contributionId);
        return contribution ? freeze({ attemptId: contribution.attemptId, firstSource: contribution.firstSource,
            hasWrites: contribution.keys.length > 0 }) : undefined;
    }
    function captureNamespaceWithoutContribution(namespace, contributionId) {
        const root = captureNamespaceRootV3(namespace), current = index(root), prior = current.contributions.get(contributionId), changes = new Map();
        if (prior)
            for (const key of prior.keys) {
                const state = current.keys.get(key), change = replaceEffect(state, prior.position, contributionId, []);
                changes.set(key, { current: { ...state.current, ...change.result },
                    active: state.effects.length - change.remove + (change.insert ? 1 : 0) > 0 });
            }
        return freeze({ root, exists: current.nextPosition > 0, ...overlayAt(current, changes), priorAttemptId: prior?.attemptId ?? null,
            priorHasWrites: (prior?.keys.length ?? 0) > 0 });
    }
    function acceptedReceipt(receipt, event) {
        const node = receipt.publication, root = freeze({ namespace: node.namespace, head: receipt.ref, base: node.base });
        return { event, publication: receipt.ref, root };
    }
    function lookupOrdinaryBatchV3(input) {
        const inputSha256 = recordSha256(input), key = authorChatEventKeyV3(input.namespace, input.operationId), event = read(key, 'native-author-chat-key-event-v3');
        if (!event)
            return { kind: 'unconfirmed', inputSha256 };
        if (!isBatch(event) || event.inputSha256 !== inputSha256)
            fail('AUTHOR_CHAT_OPERATION_CHANGED');
        const eventRef = { key, sha256: event.sha256 }, receipt = index(captureNamespaceRootV3(input.namespace)).operations.get(key);
        return receipt ? { kind: 'applied', inputSha256, ...acceptedReceipt(receipt, eventRef) }
            : { kind: 'pending', inputSha256, event: eventRef };
    }
    async function confirmOrdinaryBatchV3(input) {
        const receipt = lookupOrdinaryBatchV3(input);
        if (receipt.kind === 'applied')
            await roots.flush(input.namespace);
        return receipt;
    }
    async function commitOrdinaryBatchV3(input, owner) {
        const update = freeze(cloneRoleplayTavernLoreDataV1(input));
        if (!owner.ownsNamespace(update.namespace, update.cause))
            fail('AUTHOR_CHAT_NAMESPACE_UNAVAILABLE');
        const current = async () => { if (!await owner.isCurrent(update.namespace))
            fail('AUTHOR_CHAT_OWNER_CHANGED'); };
        await current();
        const key = authorChatEventKeyV3(update.namespace, update.operationId);
        let event = read(key, 'native-author-chat-key-event-v3');
        const replayed = event !== undefined;
        if (event && (!isBatch(event) || event.inputSha256 !== recordSha256(update)))
            fail('AUTHOR_CHAT_OPERATION_CHANGED');
        const root = captureNamespaceRootV3(update.namespace), currentIndex = index(root), prior = currentIndex.operations.get(key);
        if (prior) {
            await roots.flush(update.namespace);
            return { kind: 'replayed', ...acceptedReceipt(prior, { key, sha256: event.sha256 }) };
        }
        const assertRoot = () => {
            if (!same(captureNamespaceRootV3(update.namespace), update.expectedRoot))
                fail('AUTHOR_CHAT_REVISION_CHANGED');
        };
        assertRoot();
        if (!event) {
            const basisValues = owner.basisValues;
            if (!basisValues)
                fail('AUTHOR_CHAT_READ_BASIS_UNAVAILABLE');
            const writes = [];
            for (const key of new Set([...Object.keys(basisValues), ...Object.keys(update.values)])) {
                if (!Object.hasOwn(update.values, key))
                    writes.push({ key, operation: 'delete' });
                else if (!Object.hasOwn(basisValues, key) || !same(basisValues[key], update.values[key]))
                    writes.push({ key, operation: 'set', value: update.values[key] });
            }
            if (!writes.length && (update.namespace.target?.kind !== 'message' || currentIndex.nextPosition > 0))
                return { kind: 'no-update', root };
            const body = { ...update, schemaVersion: 3, encoding: 'native-author-chat-key-event-v3',
                kind: 'ordinary-batch', writes, inputSha256: recordSha256(update) };
            event = freeze({ ...body, sha256: recordSha256(body) });
            await current();
            assertRoot();
            await put(key, event, owner.beforeWrite);
        }
        await current();
        assertRoot();
        const eventRef = { key, sha256: event.sha256 }, change = project(event, eventRef, currentIndex), body = { schemaVersion: 3, encoding: 'native-author-chat-publication-v3',
            namespace: update.namespace, event: eventRef, previous: root.head, base: root.base,
            results: [...change.keys.values()].map(value => value.current) }, node = freeze({ ...body, sha256: recordSha256(body) }), ref = { key: `${update.namespace.sessionId}__author-chat-publication-v3_${node.sha256}`, sha256: node.sha256 };
        if (!read(ref.key, 'native-author-chat-publication-v3'))
            await put(ref.key, node, owner.beforeWrite);
        await current();
        // Every awaited persistence boundary precedes this final full-root CAS.
        // A pending updater never attaches its old snapshot result to a newer cut.
        assertRoot();
        const next = freeze({ ...root, head: ref });
        roots.publish(next, address(update.namespace), root.head);
        if (!same(currentIndex.root, next)) {
            applyProjection(currentIndex, change, { ref, publication: node }, eventRef);
            currentIndex.root = next;
        }
        await roots.flush(update.namespace);
        return { kind: replayed ? 'replayed' : 'committed', event: eventRef, publication: ref, root: next };
    }
    function lookupAcceptedContribution(input) {
        const inputSha256 = recordSha256(input), key = authorChatEventKeyV3(input.namespace, input.operationId), event = read(key, 'native-author-chat-key-event-v3');
        if (!event)
            return { kind: 'unconfirmed', inputSha256 };
        if (event.inputSha256 !== inputSha256)
            fail('AUTHOR_CHAT_OPERATION_CHANGED');
        const eventRef = { key, sha256: event.sha256 }, receipt = index(captureNamespaceRootV3(input.namespace)).operations.get(key);
        return receipt ? { kind: 'applied', inputSha256, ...acceptedReceipt(receipt, eventRef) }
            : { kind: 'pending', inputSha256, event: eventRef };
    }
    async function confirmAcceptedContribution(input) {
        const receipt = lookupAcceptedContribution(input);
        if (receipt.kind === 'applied')
            await roots.flush(input.namespace);
        return receipt;
    }
    async function replaceAcceptedContribution(input, owner) {
        const update = freeze(cloneRoleplayTavernLoreDataV1(input));
        if (!owner.ownsNamespace(update.namespace, update.cause))
            fail('AUTHOR_CHAT_NAMESPACE_UNAVAILABLE');
        const current = async () => { if (!await owner.isCurrent(update.namespace))
            fail('AUTHOR_CHAT_OWNER_CHANGED'); };
        await current();
        const inputSha256 = recordSha256(update), key = authorChatEventKeyV3(update.namespace, update.operationId);
        let event = read(key, 'native-author-chat-key-event-v3');
        const replayed = event !== undefined;
        if (event && event.inputSha256 !== inputSha256)
            fail('AUTHOR_CHAT_OPERATION_CHANGED');
        let root = captureNamespaceRootV3(update.namespace), currentIndex = index(root);
        const priorReceipt = currentIndex.operations.get(key);
        if (priorReceipt) {
            await roots.flush(update.namespace);
            return { kind: 'replayed', ...acceptedReceipt(priorReceipt, { key, sha256: event.sha256 }) };
        }
        const assertAttempt = () => {
            if ((currentIndex.contributions.get(update.contributionId)?.attemptId ?? null) !== update.replacesAttemptId)
                fail('AUTHOR_CHAT_CONTRIBUTION_CHANGED');
        };
        assertAttempt();
        if (!event) {
            const body = { ...update, schemaVersion: 3, encoding: 'native-author-chat-key-event-v3',
                kind: 'accepted-contribution', inputSha256 };
            event = freeze({ ...body, sha256: recordSha256(body) });
            await current();
            await put(key, event, owner.beforeWrite);
        }
        await current();
        // The intent is fixed before I/O. Retry attaches it to the latest actual
        // publication predecessor while retaining the contribution's first place.
        root = captureNamespaceRootV3(update.namespace);
        currentIndex = index(root);
        assertAttempt();
        const eventRef = { key, sha256: event.sha256 }, change = project(event, eventRef, currentIndex), body = { schemaVersion: 3, encoding: 'native-author-chat-publication-v3',
            namespace: update.namespace, event: eventRef, previous: root.head, base: root.base,
            results: [...change.keys.values()].map(value => value.current) }, node = freeze({ ...body, sha256: recordSha256(body) }), ref = { key: `${update.namespace.sessionId}__author-chat-publication-v3_${node.sha256}`, sha256: node.sha256 };
        if (!read(ref.key, 'native-author-chat-publication-v3'))
            await put(ref.key, node, owner.beforeWrite);
        await current();
        const next = freeze({ ...root, head: ref });
        roots.publish(next, address(update.namespace), root.head);
        if (!same(currentIndex.root, next)) {
            applyProjection(currentIndex, change, { ref, publication: node }, eventRef);
            currentIndex.root = next;
        }
        await roots.flush(update.namespace);
        return { kind: replayed ? 'replayed' : 'committed', event: eventRef, publication: ref, root: next };
    }
    /** Core supplies actual material/live-capture and prepared-Source anchors.
     * These facts explain persisted DATA; they cannot admit a Source writer. */
    function readOwnedRowFactsV3(input) {
        const facts = new Map(), visited = new Set(), collectedPublications = new Set();
        function include(key, value) {
            let fact = rowFacts.get(value);
            if (!fact) {
                fact = Object.freeze({ table: 'branch', key, value: value,
                    sha256: recordSha256(value), family: 'ordinary-chat' });
                rowFacts.set(value, fact);
            }
            facts.set(key, fact);
            return fact;
        }
        function exact(ref, encoding) {
            const existing = facts.get(ref.key);
            if (existing) {
                if (existing.value['sha256'] !== ref.sha256 || existing.value['encoding'] !== encoding)
                    fail('AUTHOR_CHAT_HISTORY_MISSING');
                return existing.value;
            }
            const value = referenced(ref, encoding);
            include(ref.key, value);
            return value;
        }
        function closure(root) {
            const pending = [];
            let cursor = root.head, previous = null;
            while (cursor) {
                const cached = publicationClosures.get(cursor.key);
                if (cached && cached.ref.sha256 === cursor.sha256) {
                    previous = cached;
                    break;
                }
                const publication = exact(cursor, 'native-author-chat-publication-v3');
                if (cursor.key !== `${root.namespace.sessionId}__author-chat-publication-v3_${publication.sha256}`
                    || !same(publication.namespace, root.namespace) || !same(publication.base, root.base))
                    fail('AUTHOR_CHAT_HISTORY_MISSING');
                const event = exact(publication.event, 'native-author-chat-key-event-v3');
                if (!same(event.namespace, root.namespace)
                    || publication.event.key !== authorChatEventKeyV3(event.namespace, event.operationId))
                    fail('AUTHOR_CHAT_HISTORY_MISSING');
                pending.push({ ref: cursor, publication });
                cursor = publication.previous;
            }
            if (previous && (!same(previous.publication.namespace, root.namespace) || !same(previous.publication.base, root.base))) {
                fail('AUTHOR_CHAT_HISTORY_MISSING');
            }
            for (let i = pending.length - 1; i >= 0; i--) {
                const row = pending[i];
                previous = Object.freeze({ ref: Object.freeze({ ...row.ref }), publication: row.publication, previous });
                publicationClosures.set(row.ref.key, previous);
            }
            return previous;
        }
        function visitFork(ref, namespace) {
            const record = exact(ref, 'native-author-chat-fork-base-record-v3'), { sha256, ...body } = record.seed;
            if (ref.key !== forkBaseKey(namespace, address(namespace))
                || sha256 !== recordSha256(body) || !same(record.seed.childNamespace, namespace)
                || !same(namespace.importIncarnation, record.seed.parentRoot.namespace.importIncarnation)
                || !same(namespace.target ?? null, record.seed.parentRoot.namespace.target ?? null)) {
                fail('AUTHOR_CHAT_FORK_BINDING_CHANGED');
            }
            visitRoot(record.seed.parentRoot);
        }
        function visitRoot(root) {
            const digest = recordSha256(root);
            if (visited.has(digest))
                return;
            visited.add(digest);
            // Foreign ancestry is append-only owner DATA. Its first cold traversal
            // certifies the pinned cut; a later parent head does not change that cut.
            if (root.namespace.sessionId !== input.sessionId && certifiedRoots.has(digest))
                return;
            if (root.base)
                visitFork(root.base, root.namespace);
            // Cached closure links avoid replaying old prefixes for every historical
            // root. Complete facts still read each required actual row once per call.
            for (let node = closure(root); node; node = node.previous) {
                if (collectedPublications.has(node.ref.key))
                    break;
                collectedPublications.add(node.ref.key);
                const publication = exact(node.ref, 'native-author-chat-publication-v3');
                exact(publication.event, 'native-author-chat-key-event-v3');
            }
            certifiedRoots.add(digest);
        }
        for (const root of input.roots)
            visitRoot(root);
        for (const marker of input.nativePublications ?? []) {
            const publication = referenced(marker.publication, 'native-author-chat-publication-v3');
            if (address(publication.namespace) !== marker.namespaceSha256 || !same(publication.base, marker.base))
                fail('AUTHOR_CHAT_NATIVE_BINDING_CHANGED');
            visitRoot({ namespace: publication.namespace, head: marker.publication, base: marker.base });
        }
        for (const { seed, prepared } of input.forks) {
            const body = { schemaVersion: 3, encoding: 'native-author-chat-fork-base-record-v3', seed, prepared }, sha256 = recordSha256(body), ref = { key: forkBaseKey(seed.childNamespace, address(seed.childNamespace)), sha256 }, existing = read(ref.key, 'native-author-chat-fork-base-record-v3');
            if (existing?.sha256 === sha256) {
                visitFork(ref, seed.childNamespace);
                visitRoot({ namespace: seed.childNamespace, head: null, base: ref });
            }
        }
        for (const { request, root } of input.pending) {
            if (!same(request.namespace, root.namespace))
                fail('AUTHOR_CHAT_BINDING_CHANGED');
            visitRoot(root);
            const key = authorChatEventKeyV3(request.namespace, request.operationId), event = read(key, 'native-author-chat-key-event-v3');
            if (!event)
                continue;
            const { schemaVersion: _version, encoding: _encoding, inputSha256, sha256, ...stored } = event, expectedSha256 = recordSha256(request);
            let update;
            if (isContribution(event)) {
                const { kind: _kind, ...contribution } = stored;
                update = contribution;
            }
            else if (isBatch(event)) {
                const { kind: _kind, writes: _writes, ...batch } = stored;
                update = batch;
                if (!same(batch.expectedRoot, root))
                    fail('AUTHOR_CHAT_REVISION_CHANGED');
            }
            else {
                const { revision, ...ordinary } = stored;
                update = ordinary;
                if (!('expected' in request) || revision !== request.expected.revision + 1)
                    fail('AUTHOR_CHAT_OPERATION_CHANGED');
            }
            if (inputSha256 !== expectedSha256 || recordSha256(update) !== expectedSha256) {
                fail('AUTHOR_CHAT_OPERATION_CHANGED');
            }
            include(key, event);
            const body = { schemaVersion: 3, encoding: 'native-author-chat-publication-v3',
                namespace: request.namespace, event: { key, sha256 }, previous: root.head, base: root.base }, change = project(event, { key, sha256 }, index(root, true)), currentBody = { ...body, results: [...change.keys.values()].map(value => value.current) };
            const publicationSha256 = recordSha256(currentBody), ref = { key: `${request.namespace.sessionId}__author-chat-publication-v3_${publicationSha256}`, sha256: publicationSha256 };
            if (read(ref.key, 'native-author-chat-publication-v3'))
                visitRoot({ ...root, head: ref });
        }
        return Object.freeze([...facts.values()].filter(fact => fact.key.startsWith(input.sessionId + '__')));
    }
    function freezeForkBaseV3(input) {
        const body = { ...cloneRoleplayTavernLoreDataV1(input), schemaVersion: 3,
            encoding: 'native-author-chat-fork-base-v3' };
        return freeze({ ...body, sha256: recordSha256(body) });
    }
    async function applyForkBaseV3(seed, prepared, child, owner) {
        const { sha256, ...body } = seed;
        if (sha256 !== recordSha256(body) || !same(child, seed.childNamespace)
            || !same(child.importIncarnation, seed.parentRoot.namespace.importIncarnation)
            || !same(child.target ?? null, seed.parentRoot.namespace.target ?? null))
            fail('AUTHOR_CHAT_FORK_BINDING_CHANGED');
        if (!await owner.accepts(seed, prepared, child))
            fail('AUTHOR_CHAT_NAMESPACE_UNAVAILABLE');
        const current = async () => { if (!await owner.isCurrent(child))
            fail('AUTHOR_CHAT_OWNER_CHANGED'); };
        await current();
        // The prepared ref is retained in the immutable base envelope association.
        const baseBody = { schemaVersion: 3, encoding: 'native-author-chat-fork-base-record-v3', seed, prepared };
        const record = freeze({ ...baseBody, sha256: recordSha256(baseBody) });
        const baseKey = forkBaseKey(child, address(child));
        const base = { key: baseKey, sha256: record.sha256 };
        const existing = captureNamespaceRootV3(child);
        if (existing.base) {
            if (!same(existing.base, base))
                fail('AUTHOR_CHAT_REVISION_CHANGED');
            return existing;
        }
        if (existing.head)
            fail('AUTHOR_CHAT_REVISION_CHANGED');
        const existingRecord = read(baseKey, 'native-author-chat-fork-base-record-v3');
        if (existingRecord && existingRecord.sha256 !== record.sha256)
            fail('AUTHOR_CHAT_REVISION_CHANGED');
        if (!existingRecord)
            await put(baseKey, record);
        await current();
        const root = freeze({ namespace: cloneRoleplayTavernLoreDataV1(child), head: null, base });
        return root;
    }
    return { captureNamespaceRootV3, captureNamespaceRootAtNativeCut, captureNamespaceRootsAtNativeCut,
        captureKeyV3, captureNamespaceV3, captureKeyAtRootV3,
        commitOrdinaryBatchV3, lookupOrdinaryBatchV3, confirmOrdinaryBatchV3,
        commitOrdinaryV3, lookupOrdinaryV3, confirmOrdinary, replaceAcceptedContribution, lookupAcceptedContribution, confirmAcceptedContribution,
        captureNamespaceWithoutContribution, readAcceptedContribution, readOwnedRowFactsV3,
        freezeForkBaseV3, applyForkBaseV3 };
}
