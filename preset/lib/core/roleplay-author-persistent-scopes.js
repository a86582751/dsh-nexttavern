// Generated from runtime/alpha3/src/core/roleplay-author-persistent-scopes.ts; edit the TypeScript source.
/** Shared author scopes publish through their actual Domain head. The common
 * variable reducer also serves Native chat, whose carrier remains separate. */
import { recordSha256 } from './roleplay-data.js';
import { withTavernLock } from './tavern-task-support.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { readAuthorProfileIdentityV1 } from './roleplay-author-profile.js';
import { freezeAuthorVariableDataV1 as freeze, projectAuthorVariableWritesV1, applyAuthorVariableProjectionV1, replaceAuthorVariableEffectV1 } from './roleplay-author-variable-effects.js';
const sameRef = (left, right) => left === right
    || !!left && !!right && left.key === right.key && left.sha256 === right.sha256;
const addressOf = (input) => 'address' in input ? input.address : input.expectedRoot.address;
const isContribution = (input) => 'contributionId' in input;
export const authorPersistentScopeHeadKeyV1 = (address) => `author-scope-v1-head-${recordSha256(address)}`;
export const authorPersistentScopeEventKeyV1 = (address, operationId) => `author-scope-v1-event-${recordSha256({ address, operationId })}`;
export const authorPersistentScopeContributionIdV1 = (address, inputId) => recordSha256({ address, inputId });
export function createRoleplayAuthorPersistentScopesV1(deps) {
    const { table, profile } = deps, parsed = new WeakMap(), live = new Map(), historical = new Map(), publishing = new WeakMap();
    function assertAddress(address) {
        if (address.profileId !== profile.profileId || readAuthorProfileIdentityV1(table)?.profileId !== profile.profileId)
            throw Error('AUTHOR_SCOPE_PROFILE_CHANGED');
    }
    function read(key, encoding) {
        const raw = table.get(key);
        if (raw === undefined)
            return;
        const cached = raw && typeof raw === 'object' ? parsed.get(raw) : undefined;
        if (cached) {
            if (cached.encoding !== encoding)
                throw Error('AUTHOR_SCOPE_RECORD_INVALID');
            return cached;
        }
        const value = cloneRoleplayTavernLoreDataV1(raw), { sha256, ...body } = value;
        if (value.schemaVersion !== 1 || value.encoding !== encoding || sha256 !== recordSha256(body))
            throw Error('AUTHOR_SCOPE_RECORD_INVALID');
        freeze(value);
        parsed.set(raw, value);
        return value;
    }
    function referenced(ref, encoding) {
        const value = read(ref.key, encoding);
        if (!value || value.sha256 !== ref.sha256)
            throw Error('AUTHOR_SCOPE_HISTORY_MISSING');
        return value;
    }
    function captureRoot(address) {
        assertAddress(address);
        const stored = read(authorPersistentScopeHeadKeyV1(address), 'author-persistent-scope-head-v1');
        return freeze({ address, head: stored?.publication ?? null });
    }
    function projection(index, event, ref) {
        const mutation = event.mutation;
        return projectAuthorVariableWritesV1(index, { writes: event.writes, ...mutation.kind === 'contribution' ? {
                contribution: { id: mutation.id, attemptId: mutation.attemptId, source: mutation.source }
            } : {} }, ref);
    }
    function indexAt(root, old = false) {
        assertAddress(root.address);
        const id = recordSha256(root.address), current = live.get(id);
        if (current && sameRef(current.root.head, root.head))
            return current;
        const cache = old ? historical : live, key = id, previous = cache.get(key);
        if (previous && sameRef(previous.root.head, root.head))
            return previous;
        const pending = [];
        let cursor = root.head;
        while (cursor && !sameRef(cursor, previous?.root.head ?? null)) {
            const node = referenced(cursor, 'author-persistent-scope-publication-v1');
            if (recordSha256(node.address) !== id)
                throw Error('AUTHOR_SCOPE_HISTORY_MISSING');
            pending.push({ ref: cursor, node });
            cursor = node.previous;
        }
        const index = previous && sameRef(cursor, previous.root.head) ? previous :
            { root: { address: root.address, head: null }, revision: 0, keys: new Map(), contributions: new Map(), operations: new Map(), nextPosition: 0 };
        for (let offset = pending.length - 1; offset >= 0; offset--) {
            const { ref, node } = pending[offset], event = referenced(node.event, 'author-persistent-scope-event-v1');
            if (recordSha256(event.address) !== id || node.revision !== index.revision + 1)
                throw Error('AUTHOR_SCOPE_HISTORY_MISSING');
            applyAuthorVariableProjectionV1(index, projection(index, event, node.event));
            index.operations.set(event.operationId, { event: node.event, publication: ref, node });
            index.revision = node.revision;
            delete index.values;
        }
        index.root = root;
        cache.set(key, index);
        return index;
    }
    function captureAt(root, old = false) {
        const index = indexAt(root, old);
        if (!index.values) {
            const values = Object.create(null);
            for (const [key, state] of index.keys)
                if (state.current.exists)
                    values[key] = state.current.value;
            index.values = Object.freeze({ values: Object.freeze(values), valuesSha256: recordSha256(values) });
        }
        return Object.freeze({ schemaVersion: 1, authority: 'consumer-data-only', root, revision: index.revision, ...index.values });
    }
    function capture(address) { return captureAt(captureRoot(address)); }
    function readContribution(address, id) {
        const prior = indexAt(captureRoot(address)).contributions.get(id);
        return prior ? Object.freeze({ attemptId: prior.attemptId, firstSource: prior.firstSource, hasWrites: prior.keys.length > 0 }) : undefined;
    }
    function captureWithoutContribution(address, id) {
        const root = captureRoot(address), index = indexAt(root), prior = index.contributions.get(id);
        if (!prior)
            return { ...captureAt(root), priorAttemptId: null };
        const values = { ...captureAt(root).values };
        for (const key of prior.keys) {
            const result = replaceAuthorVariableEffectV1(index.keys.get(key), prior.position, id, []).result;
            if (result.exists)
                values[key] = result.value;
            else
                delete values[key];
        }
        return Object.freeze({ schemaVersion: 1, authority: 'consumer-data-only', root,
            revision: index.revision, values: Object.freeze(values), valuesSha256: recordSha256(values), priorAttemptId: prior.attemptId });
    }
    async function current(owner, address) {
        assertAddress(address);
        if (!owner.owns(address) || !await owner.isCurrent())
            throw Error('AUTHOR_SCOPE_OWNER_CHANGED');
    }
    async function put(key, value, owner) {
        const prior = read(key, value.encoding);
        if (prior?.sha256 === value.sha256)
            return;
        if (prior && value.encoding !== 'author-persistent-scope-head-v1')
            throw Error('AUTHOR_SCOPE_WRITE_CONFLICT');
        await current(owner, value.address);
        const release = owner.beforeWrite?.({ key, value });
        publishing.set(value, key);
        try {
            try {
                await table.put(key, value);
            }
            catch (error) {
                if (read(key, value.encoding)?.sha256 !== value.sha256)
                    throw error;
            }
            if (read(key, value.encoding)?.sha256 !== value.sha256)
                throw Error('AUTHOR_SCOPE_WRITE_UNKNOWN');
        }
        finally {
            publishing.delete(value);
            release?.();
        }
    }
    function receipt(input) {
        const address = addressOf(input), inputSha256 = recordSha256(input), event = read(authorPersistentScopeEventKeyV1(address, input.operationId), 'author-persistent-scope-event-v1');
        if (!event)
            return { kind: 'unconfirmed', inputSha256 };
        if (event.inputSha256 !== inputSha256)
            throw Error('AUTHOR_SCOPE_OPERATION_CHANGED');
        const ref = { key: authorPersistentScopeEventKeyV1(address, input.operationId), sha256: event.sha256 }, applied = indexAt(captureRoot(address)).operations.get(input.operationId);
        return applied ? { kind: 'applied', inputSha256, event: ref, publication: applied.publication,
            root: { address, head: applied.publication } } : { kind: 'pending', inputSha256, event: ref };
    }
    async function commit(input, owner) {
        const update = freeze(cloneRoleplayTavernLoreDataV1(input)), address = addressOf(update), headKey = authorPersistentScopeHeadKeyV1(address);
        return withTavernLock(table, headKey, async () => {
            await current(owner, address);
            const known = receipt(update);
            if (known.kind === 'applied')
                return { ...known, kind: 'replayed' };
            const root = captureRoot(address), index = indexAt(root), contribution = isContribution(update);
            if (contribution) {
                if ((index.contributions.get(update.contributionId)?.attemptId ?? null) !== update.replacesAttemptId)
                    throw Error('AUTHOR_SCOPE_CONTRIBUTION_CHANGED');
            }
            else if (!sameRef(root.head, update.expectedRoot.head))
                throw Error('AUTHOR_SCOPE_BASE_CHANGED');
            let event = read(authorPersistentScopeEventKeyV1(address, update.operationId), 'author-persistent-scope-event-v1');
            if (!event) {
                const writes = contribution ? [...update.writes] : [];
                if (!contribution) {
                    const before = captureAt(root).values;
                    for (const key of new Set([...Object.keys(before), ...Object.keys(update.values)])) {
                        if (!Object.hasOwn(update.values, key))
                            writes.push({ key, operation: 'delete' });
                        else if (!Object.hasOwn(before, key) || recordSha256(before[key]) !== recordSha256(update.values[key]))
                            writes.push({ key, operation: 'set', value: update.values[key] });
                    }
                }
                const mutation = contribution ? { kind: 'contribution', id: update.contributionId,
                    attemptId: update.attemptId, replacesAttemptId: update.replacesAttemptId, source: update.source }
                    : { kind: 'ordinary', expectedHead: update.expectedRoot.head }, body = { schemaVersion: 1, encoding: 'author-persistent-scope-event-v1',
                    address, operationId: update.operationId, cause: update.cause, mutation, writes, inputSha256: known.inputSha256 };
                event = freeze({ ...body, sha256: recordSha256(body) });
                await put(authorPersistentScopeEventKeyV1(address, update.operationId), event, owner);
            }
            await current(owner, address);
            if (!sameRef(captureRoot(address).head, root.head))
                throw Error('AUTHOR_SCOPE_BASE_CHANGED');
            const eventRef = { key: authorPersistentScopeEventKeyV1(address, update.operationId), sha256: event.sha256 }, body = { schemaVersion: 1, encoding: 'author-persistent-scope-publication-v1',
                address, event: eventRef, previous: root.head, revision: index.revision + 1 }, publication = freeze({ ...body, sha256: recordSha256(body) }), ref = { key: `author-scope-v1-publication-${publication.sha256}`, sha256: publication.sha256 };
            await put(ref.key, publication, owner);
            await current(owner, address);
            if (!sameRef(captureRoot(address).head, root.head))
                throw Error('AUTHOR_SCOPE_BASE_CHANGED');
            const headBody = { schemaVersion: 1, encoding: 'author-persistent-scope-head-v1', address, publication: ref };
            await put(headKey, freeze({ ...headBody, sha256: recordSha256(headBody) }), owner);
            await current(owner, address);
            // A synchronous Domain reader may already have folded this publication.
            // indexAt advances the shared owner once from its actual head.
            capture(address);
            return { kind: 'committed', inputSha256: event.inputSha256, event: eventRef, publication: ref, root: { address, head: ref } };
        });
    }
    return { capture, captureAtRoot: (root) => captureAt(root, true), captureRoot,
        captureWithoutContribution, readContribution, replace: commit, replaceContribution: commit, lookup: receipt,
        isPublishing: (key, value) => !!value && typeof value === 'object' && publishing.get(value) === key };
}
