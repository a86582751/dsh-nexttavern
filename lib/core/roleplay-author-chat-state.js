// Generated from runtime/alpha3/src/core/roleplay-author-chat-state.ts; edit the TypeScript source.
/** Durable author state owns compiler-declared chat namespaces.
 * MVU stat_data, Native messages and the rest of chat belong to other owners. */
import { recordSha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
const isV2 = (binding) => 'schemaVersion' in binding;
/** Compiler admission owns the single key/writer proof. Every consumer uses
 * its same declared provenance instead of rereading author AST or inventory. */
export function deriveAuthorChatBindingV1(sessionId, program) {
    if (program.ownedChatKey === null || program.ownedChatWriter === null)
        return null;
    return Object.freeze({ sessionId, key: program.ownedChatKey, sourceSha256: program.source.sourceSha256,
        sourceSnapshotSha256: program.source.sourceSnapshotSha256,
        descriptorSha256: program.ownedChatWriter.descriptorSha256 });
}
/** Core supplies a retained admitted declaration. Its live owner proves
 * membership once; this function only projects the persistent namespace. */
export function deriveAuthorChatBindingV2(sessionId, program, declaration) {
    return Object.freeze({ schemaVersion: 2, sessionId, key: declaration.key,
        sourceSha256: program.source.sourceSha256, sourceSnapshotSha256: program.source.sourceSnapshotSha256,
        descriptorSha256: declaration.writer.descriptorSha256, declarationId: declaration.declarationId });
}
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
const same = (left, right) => recordSha256(left) === recordSha256(right);
function fail(code) { throw Error(code); }
const namespace = (binding) => recordSha256({ key: binding.key,
    sourceSha256: binding.sourceSha256, sourceSnapshotSha256: binding.sourceSnapshotSha256,
    descriptorSha256: binding.descriptorSha256 });
export const authorChatHeadKeyV1 = (binding) => `${binding.sessionId}__author-chat-head-v1_${namespace(binding)}`;
export const authorChatEventKeyV1 = (binding, operationId) => `${binding.sessionId}__author-chat-event-v1_${recordSha256({ namespace: namespace(binding), operationId })}`;
const namespaceV2 = (binding) => recordSha256({ key: binding.key,
    sourceSha256: binding.sourceSha256, sourceSnapshotSha256: binding.sourceSnapshotSha256,
    descriptorSha256: binding.descriptorSha256, declarationId: binding.declarationId });
export const authorChatHeadKeyV2 = (binding) => `${binding.sessionId}__author-chat-head-v2_${namespaceV2(binding)}`;
export const authorChatEventKeyV2 = (binding, operationId) => `${binding.sessionId}__author-chat-event-v2_${recordSha256({ namespace: namespaceV2(binding), operationId })}`;
const headKey = (binding) => isV2(binding) ? authorChatHeadKeyV2(binding) : authorChatHeadKeyV1(binding);
const eventKey = (binding, operationId) => isV2(binding)
    ? authorChatEventKeyV2(binding, operationId) : authorChatEventKeyV1(binding, operationId);
const eventEncoding = (binding) => isV2(binding) ? 'native-author-chat-event-v2' : 'native-author-chat-event-v1';
const headEncoding = (binding) => isV2(binding) ? 'native-author-chat-head-v2' : 'native-author-chat-head-v1';
const version = (binding) => isV2(binding) ? 2 : 1;
const declarationRef = (declaration) => ({
    declarationId: declaration.declarationId, writerIdentitySha256: declaration.writerIdentitySha256, writer: declaration.writer
});
export function createCanonicalAuthorChatStateV1(options) {
    const { table } = options;
    const parsed = new WeakMap();
    function record(key, encoding, hashField, schemaVersion) {
        const raw = table.get(key);
        if (raw === undefined)
            return undefined;
        if (!raw || typeof raw !== 'object')
            fail('AUTHOR_CHAT_RECORD_INVALID');
        const cached = parsed.get(raw);
        if (cached)
            return cached;
        // Persistent rows may be cold-loaded. Decode once at the state boundary;
        // consumer captures reuse this owned immutable result.
        const item = cloneRoleplayTavernLoreDataV1(raw);
        const { [hashField]: claimed, ...body } = item;
        if (item.schemaVersion !== schemaVersion || item.encoding !== encoding || claimed !== recordSha256(body)) {
            fail('AUTHOR_CHAT_RECORD_INVALID');
        }
        const result = freeze(item);
        parsed.set(raw, result);
        return result;
    }
    function capture(binding) {
        const head = record(headKey(binding), headEncoding(binding), 'headSha256', version(binding));
        let value = null;
        if (head) {
            if (!same(head.binding, binding))
                fail('AUTHOR_CHAT_BINDING_CHANGED');
            const event = record(head.event.key, eventEncoding(binding), 'eventSha256', version(binding));
            if (!event || event.eventSha256 !== head.event.sha256 || event.revision !== head.revision
                || !same(event.binding, binding))
                fail('AUTHOR_CHAT_HEAD_EVENT_MISSING');
            value = event.value;
        }
        const fields = { authority: 'consumer-data-only',
            revision: { revision: head?.revision ?? 0, head: head?.event ?? null }, exists: head !== undefined, value };
        const body = isV2(binding) ? { ...fields, schemaVersion: 2, encoding: 'native-author-chat-capture-v2',
            binding: freeze({ ...binding }) } : { ...fields, schemaVersion: 1, encoding: 'native-author-chat-capture-v1',
            binding: freeze({ ...binding }) };
        return freeze({ ...body, captureSha256: recordSha256(body) });
    }
    async function writeHead(event, key) {
        const fields = { revision: event.revision, event: { key, sha256: event.eventSha256 } };
        const body = event.schemaVersion === 2 ? { ...fields, schemaVersion: 2, encoding: 'native-author-chat-head-v2',
            binding: event.binding } : { ...fields, schemaVersion: 1, encoding: 'native-author-chat-head-v1', binding: event.binding };
        const head = freeze({ ...body, headSha256: recordSha256(body) });
        await table.put(headKey(event.binding), head);
        parsed.set(head, head);
    }
    function includesEvent(revision, target, key) {
        let cursor = revision;
        // Only completed-operation replay needs to locate an older event. Normal
        // capture and writes read one head/event pair and do not rescan history.
        while (cursor.head && cursor.revision >= target.revision) {
            if (cursor.head.key === key && cursor.head.sha256 === target.eventSha256)
                return true;
            const event = record(cursor.head.key, eventEncoding(target.binding), 'eventSha256', version(target.binding));
            if (!event || event.eventSha256 !== cursor.head.sha256 || event.revision !== cursor.revision
                || event.previous.revision !== event.revision - 1)
                fail('AUTHOR_CHAT_HISTORY_MISSING');
            cursor = event.previous;
        }
        return false;
    }
    async function persist(input, current) {
        if (!await current())
            fail('AUTHOR_CHAT_OWNER_CHANGED');
        const key = eventKey(input.binding, input.operationId);
        const existing = record(key, eventEncoding(input.binding), 'eventSha256', version(input.binding));
        const before = capture(input.binding);
        if (existing) {
            if (existing.inputSha256 !== input.inputSha256)
                fail('AUTHOR_CHAT_OPERATION_CHANGED');
            // The immutable event is written before the head. A crash in between is
            // repaired only from its exact predecessor; completed replay never appends.
            if (same(before.revision, existing.previous)) {
                if (!await current())
                    fail('AUTHOR_CHAT_OWNER_CHANGED');
                await writeHead(existing, key);
            }
            else if (!includesEvent(before.revision, existing, key)) {
                fail('AUTHOR_CHAT_REVISION_CHANGED');
            }
            return { kind: 'replayed', event: { key, sha256: existing.eventSha256 }, capture: capture(input.binding) };
        }
        if (!same(before.revision, input.expected))
            fail('AUTHOR_CHAT_REVISION_CHANGED');
        const fields = { operationId: input.operationId, previous: before.revision,
            revision: before.revision.revision + 1, value: freeze(cloneRoleplayTavernLoreDataV1(input.value)),
            inputSha256: input.inputSha256 };
        const body = isV2(input.binding) ? { ...fields, schemaVersion: 2, encoding: 'native-author-chat-event-v2',
            binding: freeze({ ...input.binding }), cause: input.cause }
            : { ...fields, schemaVersion: 1, encoding: 'native-author-chat-event-v1',
                binding: freeze({ ...input.binding }), cause: input.cause };
        const event = freeze({ ...body, eventSha256: recordSha256(body) });
        if (!await current())
            fail('AUTHOR_CHAT_OWNER_CHANGED');
        await table.put(key, event);
        parsed.set(event, event);
        // Source may become stale during storage's await. Keep the immutable
        // attempt but do not advance a no-longer-current source's head.
        if (!await current())
            fail('AUTHOR_CHAT_OWNER_CHANGED');
        await writeHead(event, key);
        return { kind: 'committed', event: { key, sha256: event.eventSha256 }, capture: capture(input.binding) };
    }
    async function commit(input, owner) {
        // Root invokes this inside the real Source FIFO, shared with import,
        // edits and fork. State owns no second queue. Guest DATA cannot supply
        // the live owner closure for the pending UI operation.
        const update = freeze(cloneRoleplayTavernLoreDataV1(input));
        if (!await owner.completedTask(update.binding, update.task))
            fail('AUTHOR_CHAT_COMPLETED_TASK_MISSING');
        // A completed immutable job is proved once. Across storage awaits only
        // the live Source/operation lifetime needs another check.
        return persist({ ...update,
            cause: { kind: 'completed-author-dialog', task: update.task }, inputSha256: recordSha256(update) }, async () => await owner.isCurrent(update.binding));
    }
    async function commitOrdinary(input, owner) {
        const update = freeze(cloneRoleplayTavernLoreDataV1(input));
        // Core's retained program owns membership and writer origin once. Storage
        // awaits retain only that operation's actual Source lifetime obligation.
        if (!owner.ownsDeclaration(update.binding, update.declaration))
            fail('AUTHOR_CHAT_DECLARATION_UNAVAILABLE');
        return persist({ ...update, cause: { kind: 'ordinary-source-key', declaration: update.declaration },
            inputSha256: recordSha256(update) }, async () => await owner.isCurrent(update.binding));
    }
    function freezeForkSeedV2(input) {
        const parent = capture(input.binding);
        if (!parent.exists)
            return undefined;
        const body = { schemaVersion: 2, encoding: 'native-author-chat-fork-seed-v2',
            authority: 'consumer-data-only', operationId: input.operationId, parent, declaration: input.declaration,
            childSessionId: input.childSessionId, nativeCutSha256: input.nativeCutSha256 };
        return freeze({ ...body, seedSha256: recordSha256(body) });
    }
    async function applyForkSeedV2(seed, prepared, actualChildBinding, declaration, owner) {
        const child = freeze({ ...actualChildBinding }), { seedSha256, ...body } = seed;
        if (seedSha256 !== recordSha256(body) || !seed.parent.exists || !seed.parent.revision.head)
            fail('AUTHOR_CHAT_FORK_SEED_INVALID');
        if (child.sessionId !== seed.childSessionId || child.key !== seed.parent.binding.key
            || child.sourceSha256 !== seed.parent.binding.sourceSha256
            || child.descriptorSha256 !== seed.parent.binding.descriptorSha256
            || child.declarationId !== seed.parent.binding.declarationId
            || child.declarationId !== declaration.declarationId || !same(seed.declaration, declarationRef(declaration)))
            fail('AUTHOR_CHAT_FORK_BINDING_CHANGED');
        // Prepared Source must supply the actual admitted child declaration. The
        // frozen seed and an active fork alone do not grant an ordinary writer.
        if (!await owner.accepts(seed, prepared, child, declaration))
            fail('AUTHOR_CHAT_DECLARATION_UNAVAILABLE');
        return persist({ binding: child, operationId: seed.operationId, expected: { revision: 0, head: null }, value: seed.parent.value,
            cause: { kind: 'reserved-source-fork', prepared, seedSha256, parentHead: seed.parent.revision.head,
                declaration: seed.declaration }, inputSha256: recordSha256({ seedSha256, prepared, childBinding: child }) }, async () => await owner.isCurrent(child));
    }
    function freezeForkSeed(input) {
        // Called synchronously in Source's real parent FIFO at its reserved cut.
        const parent = capture(input.binding);
        if (!parent.exists)
            return undefined;
        const body = { schemaVersion: 1, encoding: 'native-author-chat-fork-seed-v1',
            authority: 'consumer-data-only', operationId: input.operationId, parent,
            childSessionId: input.childSessionId, nativeCutSha256: input.nativeCutSha256 };
        return freeze({ ...body, seedSha256: recordSha256(body) });
    }
    async function applyForkSeed(seed, prepared, actualChildBinding, owner) {
        // Source's prepared decoder already supplied immutable inert seed DATA.
        // State checks its own checksum and namespace join; it never reads parent
        // latest or copies a whole prepared Source envelope again.
        const frozen = seed, child = freeze({ ...actualChildBinding });
        const { seedSha256, ...body } = frozen;
        if (seedSha256 !== recordSha256(body) || !frozen.parent.exists || !frozen.parent.revision.head) {
            fail('AUTHOR_CHAT_FORK_SEED_INVALID');
        }
        if (child.sessionId !== frozen.childSessionId || child.key !== frozen.parent.binding.key
            || child.sourceSha256 !== frozen.parent.binding.sourceSha256
            || child.descriptorSha256 !== frozen.parent.binding.descriptorSha256)
            fail('AUTHOR_CHAT_FORK_BINDING_CHANGED');
        // Source calls this while its reserved child apply holds the child FIFO.
        return persist({ binding: child,
            operationId: frozen.operationId, expected: { revision: 0, head: null }, value: frozen.parent.value,
            cause: { kind: 'reserved-source-fork', prepared, seedSha256, parentHead: frozen.parent.revision.head },
            inputSha256: recordSha256({ seedSha256, prepared, childBinding: child }) }, async () => await owner.accepts(frozen, prepared, child));
    }
    function captureWithCurrencyV2(binding) {
        const data = capture(binding);
        const expected = data.revision.head ? recordSha256({ schemaVersion: 2, encoding: 'native-author-chat-head-v2',
            binding: data.binding, revision: data.revision.revision, event: data.revision.head }) : undefined;
        return { data, current: () => {
                try {
                    const head = record(headKey(binding), 'native-author-chat-head-v2', 'headSha256', 2);
                    return head?.headSha256 === expected;
                }
                catch {
                    return false;
                }
            } };
    }
    return { capture, captureWithCurrencyV2, commit, commitOrdinary, freezeForkSeed, applyForkSeed, freezeForkSeedV2, applyForkSeedV2 };
}
