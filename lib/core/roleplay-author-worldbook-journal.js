// Generated from runtime/alpha3/src/core/roleplay-author-worldbook-journal.ts; edit the TypeScript source.
/** Profile-owned append-only publication. A single owner lock serializes its
 * intent/head pair. An unknown acknowledgement leaves the immutable intent
 * available by operation ID so a retry can finish or recover its receipt. */
import { recordSha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { withTavernLock } from './tavern-task-support.js';
import { readAuthorProfileIdentityV1 } from './roleplay-author-profile.js';
const frozen = new WeakSet();
export function freezeAuthorWorldbookDataV1(value) {
    if (value && typeof value === 'object' && !frozen.has(value)) {
        for (const child of Object.values(value))
            freezeAuthorWorldbookDataV1(child);
        Object.freeze(value);
        frozen.add(value);
    }
    return value;
}
export function sameAuthorWorldbookRefV1(left, right) {
    return left === right || !!left && !!right && left.key === right.key && left.sha256 === right.sha256;
}
export class AuthorWorldbookWriteUnknownV1 extends Error {
    owner;
    operationId;
    event;
    constructor(owner, operationId, event) {
        super('AUTHOR_WORLDBOOK_WRITE_UNKNOWN');
        this.owner = owner;
        this.operationId = operationId;
        this.event = event;
    }
}
export function createAuthorWorldbookJournalV1(deps, actualOwner, initial, apply, beforePublish, completionWriter) {
    const owner = freezeAuthorWorldbookDataV1(cloneRoleplayTavernLoreDataV1(actualOwner));
    const namespace = recordSha256(owner), headKey = `author-worldbook-v1-head_${namespace}`, operationKey = (operationId) => `author-worldbook-v1-event_${recordSha256({ owner, operationId })}`;
    const parsed = new WeakMap();
    const empty = { head: null, revision: 0, state: freezeAuthorWorldbookDataV1(initial()), publication: null };
    let index = empty;
    const historical = new Map();
    const published = new Map();
    function assertProfile() {
        if (readAuthorProfileIdentityV1(deps.table)?.profileId !== deps.profile.profileId)
            throw Error('AUTHOR_PROFILE_IDENTITY_CHANGED');
    }
    function eventAt(ref) {
        const raw = deps.table.get(ref.key);
        return parseEvent(raw, ref);
    }
    function parseEvent(raw, ref) {
        if (!raw || typeof raw !== 'object')
            throw Error('AUTHOR_WORLDBOOK_HISTORY_MISSING');
        const cached = parsed.get(raw);
        if (cached && cached.sha256 === ref.sha256)
            return cached;
        const event = cloneRoleplayTavernLoreDataV1(raw);
        const { sha256, ...body } = event;
        if (event.schemaVersion !== 1 || event.encoding !== 'author-worldbook-event-v1'
            || recordSha256(event.owner) !== namespace || event.sha256 !== ref.sha256 || recordSha256(body) !== sha256
            || operationKey(event.operationId) !== ref.key)
            throw Error('AUTHOR_WORLDBOOK_RECORD_INVALID');
        const result = freezeAuthorWorldbookDataV1(event);
        parsed.set(raw, result);
        return result;
    }
    function head() {
        if (completionWriter)
            return acceptedHead().published;
        assertProfile();
        const raw = deps.table.get(headKey);
        if (raw === undefined)
            return null;
        if (raw.schemaVersion !== 1 || raw.encoding !== 'author-worldbook-head-v1'
            || recordSha256(raw.owner) !== namespace)
            throw Error('AUTHOR_WORLDBOOK_RECORD_INVALID');
        return raw.event;
    }
    function acceptedHead() {
        assertProfile();
        const raw = deps.table.get(headKey);
        if (raw === undefined)
            return { schemaVersion: 2, encoding: 'author-worldbook-head-v2', owner, published: null };
        if (raw.schemaVersion !== 2 || raw.encoding !== 'author-worldbook-head-v2' || recordSha256(raw.owner) !== namespace)
            throw Error('AUTHOR_WORLDBOOK_RECORD_INVALID');
        if (raw.pending)
            return { ...raw, pending: parseEvent(raw.pending, { key: operationKey(raw.pending.operationId), sha256: raw.pending.sha256 }) };
        return raw;
    }
    function resolveAt(ref, retain) {
        if (sameAuthorWorldbookRefV1(index.head, ref))
            return index;
        if (ref) {
            const cached = historical.get(ref.sha256);
            if (cached)
                return cached;
        }
        const suffix = [];
        let cursor = ref, base;
        while (cursor) {
            if (sameAuthorWorldbookRefV1(cursor, index.head)) {
                base = index;
                break;
            }
            const cached = historical.get(cursor.sha256);
            if (cached) {
                base = cached;
                break;
            }
            const event = eventAt(cursor);
            suffix.push({ event, ref: cursor });
            cursor = event.previous;
        }
        base ??= empty;
        for (const item of suffix.reverse()) {
            if (item.event.revision !== base.revision + 1)
                throw Error('AUTHOR_WORLDBOOK_HISTORY_INVALID');
            base = { head: item.ref, revision: item.event.revision,
                state: freezeAuthorWorldbookDataV1(apply(base.state, item.event.payload, item.ref)),
                publication: { event: item.event, previous: base.publication } };
        }
        // Retain full DATA only for a root explicitly requested by a frozen
        // consumer. Normal advancement retains a lightweight publication chain.
        if (retain && ref)
            historical.set(ref.sha256, base);
        return base;
    }
    function adopt(next) {
        let cursor = next.publication;
        while (cursor && published.get(cursor.event.revision) !== cursor.event.sha256) {
            published.set(cursor.event.revision, cursor.event.sha256);
            cursor = cursor.previous;
        }
        index = next;
        return index;
    }
    function capture() { return adopt(resolveAt(head(), false)); }
    function resolve(ref) { return resolveAt(ref, true); }
    const isPublished = (current, event) => event.revision <= current.revision && published.get(event.revision) === event.sha256;
    function receipt(event, kind) {
        return freezeAuthorWorldbookDataV1({ schemaVersion: 1, kind, owner, operationId: event.operationId,
            event: { key: operationKey(event.operationId), sha256: event.sha256 }, revision: event.revision });
    }
    async function assertWriter(writer) {
        assertProfile();
        if (!writer.owns(owner) || !await writer.isCurrent())
            throw Error('AUTHOR_WORLDBOOK_WRITER_REVOKED');
    }
    async function put(key, value, event, writer) {
        const release = writer.beforeWrite?.({ key, value });
        try {
            deps.beforePersistentWrite?.(owner);
            await deps.table.put(key, value);
        }
        catch {
            throw new AuthorWorldbookWriteUnknownV1(owner, event.operationId, { key: operationKey(event.operationId), sha256: event.sha256 });
        }
        finally {
            release?.();
        }
    }
    function acceptedValueMatches(key, value, event) {
        try {
            if (key !== headKey)
                return eventAt({ key, sha256: event.sha256 }).sha256 === event.sha256;
            const actual = acceptedHead(), expected = value;
            return sameAuthorWorldbookRefV1(actual.published, expected.published)
                && actual.pending?.sha256 === expected.pending?.sha256;
        }
        catch {
            return false;
        }
    }
    async function putAccepted(key, value, event, writer) {
        await assertWriter(writer);
        const release = writer.beforeWrite?.({ key, value });
        try {
            try {
                deps.beforePersistentWrite?.(owner);
                await deps.table.put(key, value);
            }
            catch {
                // A lost acknowledgement can follow a durable put. The same journal
                // readers establish its event/head identity for both outcomes.
            }
            if (!acceptedValueMatches(key, value, event))
                throw new AuthorWorldbookWriteUnknownV1(owner, event.operationId, { key: operationKey(event.operationId), sha256: event.sha256 });
        }
        finally {
            release?.();
        }
    }
    async function finishAccepted(prepared) {
        const accepted = acceptedHead(), event = accepted.pending;
        if (!event)
            return;
        const writer = completionWriter;
        await assertWriter(writer);
        const current = capture();
        if (!sameAuthorWorldbookRefV1(event.previous, current.head) || event.revision !== current.revision + 1)
            throw Error('AUTHOR_WORLDBOOK_HISTORY_INVALID');
        const key = operationKey(event.operationId), ref = { key, sha256: event.sha256 }, stored = deps.table.get(key);
        if (stored === undefined)
            await putAccepted(key, event, event, writer);
        else if (eventAt(ref).sha256 !== event.sha256)
            throw Error('AUTHOR_WORLDBOOK_OPERATION_CONFLICT');
        const next = prepared ?? resolveAt(ref, false);
        await putAccepted(headKey, { schemaVersion: 2, encoding: 'author-worldbook-head-v2', owner, published: ref }, event, writer);
        adopt(next);
        return { receipt: receipt(event, 'committed'), event, index };
    }
    async function commitAccepted(input, writer) {
        return withTavernLock(deps.table, headKey, async () => {
            await assertWriter(completionWriter);
            await finishAccepted();
            const current = capture(), key = operationKey(input.operationId), raw = deps.table.get(key), inputSha256 = recordSha256(input.input);
            if (!input.operationId)
                throw Error('AUTHOR_WORLDBOOK_OPERATION_ID_REQUIRED');
            if (raw !== undefined) {
                const event = eventAt({ key, sha256: raw.sha256 });
                if (event.inputSha256 !== inputSha256)
                    throw Error('AUTHOR_WORLDBOOK_OPERATION_CONFLICT');
                if (!isPublished(current, event))
                    throw Error('AUTHOR_WORLDBOOK_HISTORY_INVALID');
                return { receipt: receipt(event, 'replayed'), event, index: current };
            }
            await assertWriter(writer);
            if (input.expectedHead !== undefined && !sameAuthorWorldbookRefV1(current.head, input.expectedHead))
                throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED');
            const body = { schemaVersion: 1, encoding: 'author-worldbook-event-v1', owner,
                operationId: input.operationId, inputSha256, previous: current.head, revision: current.revision + 1,
                payload: cloneRoleplayTavernLoreDataV1(input.plan(current.state)) }, event = freezeAuthorWorldbookDataV1({ ...body, sha256: recordSha256(body) }), ref = { key, sha256: event.sha256 };
            // Validate the planned payload before this head accepts it. A pending
            // event can then finish without re-running a retired Source admission.
            const next = { head: ref, revision: event.revision,
                state: freezeAuthorWorldbookDataV1(apply(current.state, event.payload, ref)),
                publication: { event, previous: current.publication } };
            await beforePublish?.();
            await assertWriter(writer);
            await assertWriter(completionWriter);
            await putAccepted(headKey, { schemaVersion: 2, encoding: 'author-worldbook-head-v2', owner,
                published: current.head, pending: event }, event, writer);
            return (await finishAccepted(next));
        });
    }
    async function commit(input, writer) {
        if (completionWriter)
            return commitAccepted(input, writer);
        return withTavernLock(deps.table, headKey, async () => {
            await assertWriter(writer);
            const current = capture(), key = operationKey(input.operationId), inputSha256 = recordSha256(input.input);
            if (!input.operationId)
                throw Error('AUTHOR_WORLDBOOK_OPERATION_ID_REQUIRED');
            const raw = deps.table.get(key);
            let event;
            if (raw !== undefined) {
                event = eventAt({ key, sha256: raw.sha256 });
                if (event.inputSha256 !== inputSha256)
                    throw Error('AUTHOR_WORLDBOOK_OPERATION_CONFLICT');
                if (isPublished(current, event))
                    return { receipt: receipt(event, 'replayed'), event, index: current };
                if (!sameAuthorWorldbookRefV1(event.previous, current.head))
                    throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED');
            }
            else {
                if (input.expectedHead !== undefined && !sameAuthorWorldbookRefV1(current.head, input.expectedHead))
                    throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED');
                const body = { schemaVersion: 1, encoding: 'author-worldbook-event-v1', owner,
                    operationId: input.operationId, inputSha256, previous: current.head, revision: current.revision + 1,
                    payload: cloneRoleplayTavernLoreDataV1(input.plan(current.state)) };
                event = freezeAuthorWorldbookDataV1({ ...body, sha256: recordSha256(body) });
                await assertWriter(writer);
                if (!sameAuthorWorldbookRefV1(head(), current.head))
                    throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED');
                await put(key, event, event, writer);
            }
            try {
                await assertWriter(writer);
                if (!sameAuthorWorldbookRefV1(head(), current.head))
                    throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED');
                await beforePublish?.();
                const ref = { key, sha256: event.sha256 };
                // Validate/fold before publishing. A planner failure leaves the old head
                // authoritative and never exposes a malformed partially applied book.
                const next = resolveAt(ref, false);
                await assertWriter(writer);
                await put(headKey, { schemaVersion: 1, encoding: 'author-worldbook-head-v1', owner, event: ref }, event, writer);
                if (!sameAuthorWorldbookRefV1(head(), ref))
                    throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED');
                adopt(next);
                return { receipt: receipt(event, 'committed'), event, index };
            }
            catch (error) {
                if (!(error instanceof Error) || error.message !== 'AUTHOR_WORLDBOOK_WRITER_REVOKED')
                    throw error;
                // The immutable operation already exists. Preserve its recovery anchor
                // when the live writer is revoked before its head can publish.
                throw new AuthorWorldbookWriteUnknownV1(owner, event.operationId, { key, sha256: event.sha256 });
            }
        });
    }
    async function retry(operationId, writer) {
        if (completionWriter)
            return withTavernLock(deps.table, headKey, async () => {
                await assertWriter(completionWriter);
                await finishAccepted();
                const event = operation(operationId), current = capture();
                if (!isPublished(current, event))
                    throw Error('AUTHOR_WORLDBOOK_HISTORY_INVALID');
                return { receipt: receipt(event, 'replayed'), event, index: current };
            });
        const raw = deps.table.get(operationKey(operationId));
        if (!raw)
            throw Error('AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED');
        const event = eventAt({ key: operationKey(operationId), sha256: raw.sha256 });
        // The durable input hash is reused without inventing a fresh caller input.
        return withTavernLock(deps.table, headKey, async () => {
            await assertWriter(writer);
            const current = capture();
            if (isPublished(current, event))
                return { receipt: receipt(event, 'replayed'), event, index: current };
            if (!sameAuthorWorldbookRefV1(current.head, event.previous))
                throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED');
            const ref = { key: operationKey(operationId), sha256: event.sha256 }, next = resolveAt(ref, false);
            await assertWriter(writer);
            if (!sameAuthorWorldbookRefV1(head(), current.head))
                throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED');
            await beforePublish?.();
            await assertWriter(writer);
            await put(headKey, { schemaVersion: 1, encoding: 'author-worldbook-head-v1', owner, event: ref }, event, writer);
            if (!sameAuthorWorldbookRefV1(head(), ref))
                throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED');
            adopt(next);
            return { receipt: receipt(event, 'committed'), event, index };
        });
    }
    /** Core operations involving this content owner and the catalog take the
     * content lock first, then the catalog lock. No path takes the reverse order. */
    function withLock(work) { return withTavernLock(deps.table, headKey, work); }
    function operation(operationId) {
        if (completionWriter) {
            const pending = acceptedHead().pending;
            if (pending?.operationId === operationId)
                return parseEvent(pending, { key: operationKey(operationId), sha256: pending.sha256 });
        }
        const key = operationKey(operationId), raw = deps.table.get(key);
        if (!raw)
            throw Error('AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED');
        return eventAt({ key, sha256: raw.sha256 });
    }
    const finishPending = () => withTavernLock(deps.table, headKey, async () => {
        if (!completionWriter)
            return;
        await assertWriter(completionWriter);
        return finishAccepted();
    });
    function publishedReceipt(operationId, input) {
        const event = operation(operationId), current = capture();
        if (input !== undefined && recordSha256(input) !== event.inputSha256)
            throw Error('AUTHOR_WORLDBOOK_OPERATION_CONFLICT');
        return isPublished(current, event) ? receipt(event, 'replayed') : undefined;
    }
    return { capture, resolve, commit, retry, eventAt, withLock, operation, finishPending, publishedReceipt };
}
