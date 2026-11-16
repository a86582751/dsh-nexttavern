// Generated from runtime/alpha3/src/core/roleplay-author-worldbook-bindings.ts; edit the TypeScript source.
/** Binding order belongs to its actual profile/character/chat owner. Shared
 * library content is referenced by stable ID and is never copied on bind. */
import { recordSha256 } from './roleplay-data.js';
import { createAuthorWorldbookJournalV1, freezeAuthorWorldbookDataV1, sameAuthorWorldbookRefV1 } from './roleplay-author-worldbook-journal.js';
export function authorWorldbookBindingBookIdsV1(selection) {
    if (selection.kind === 'profile')
        return selection.enabled;
    if (selection.kind === 'chat')
        return selection.bookId === null ? [] : [selection.bookId];
    const primary = selection.primary === null ? [] : [selection.primary];
    return [...primary, ...selection.additional];
}
function empty(owner) {
    if (owner.kind === 'profile')
        return { kind: 'profile', enabled: [] };
    if (owner.kind === 'character')
        return { kind: 'character', primary: null, additional: [] };
    return { kind: 'chat', bookId: null };
}
export function createRoleplayAuthorWorldbookBindingsV1(deps) {
    const profileId = deps.profile.profileId;
    function makeJournal(owner) {
        return createAuthorWorldbookJournalV1(deps, { kind: 'bindings', profileId, owner }, () => empty(owner), (_state, payload) => payload);
    }
    const journals = new Map();
    const captures = new Map();
    function selected(owner) {
        if (owner.kind === 'profile' && owner.profileId !== profileId)
            throw Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH');
        if (owner.kind === 'character' && !owner.characterId)
            throw Error('AUTHOR_WORLDBOOK_CHARACTER_REQUIRED');
        if (owner.kind === 'chat' && owner.namespace.target)
            throw Error('AUTHOR_WORLDBOOK_CHAT_OWNER_REQUIRED');
        const key = recordSha256(owner);
        let journal = journals.get(key);
        if (!journal) {
            journal = makeJournal(owner);
            journals.set(key, journal);
        }
        return { key, journal };
    }
    function captureBindings(owner) {
        const { key, journal } = selected(owner), state = journal.capture(), previous = captures.get(key);
        if (previous && sameAuthorWorldbookRefV1(previous.head, state.head))
            return previous;
        const result = freezeAuthorWorldbookDataV1({ schemaVersion: 1, authority: 'consumer-data-only',
            profileId, owner, head: state.head, revision: state.revision, selection: state.state });
        captures.set(key, result);
        return result;
    }
    async function bindBooks(basis, next, operationId, writer) {
        if (basis.profileId !== profileId)
            throw Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH');
        if (next.kind !== basis.owner.kind)
            throw Error('AUTHOR_WORLDBOOK_BINDING_KIND_MISMATCH');
        const { journal } = selected(basis.owner);
        const result = await journal.commit({ expectedHead: basis.head, operationId,
            input: { expectedHead: basis.head, selection: next }, plan: () => {
                const ids = authorWorldbookBindingBookIdsV1(next);
                for (const bookId of ids)
                    deps.captureBook(bookId);
                return next;
            } }, writer);
        return { receipt: result.receipt, bindings: captureBindings(basis.owner) };
    }
    async function retryBindings(owner, operationId, writer) {
        const result = await selected(owner).journal.retry(operationId, writer);
        return { receipt: result.receipt, bindings: captureBindings(owner) };
    }
    function resolveBindings(owner, head) {
        const state = selected(owner).journal.resolve(head);
        return freezeAuthorWorldbookDataV1({ schemaVersion: 1, authority: 'consumer-data-only',
            profileId, owner, head, revision: state.revision, selection: state.state });
    }
    function publishedReceipt(owner, operationId, input) {
        return selected(owner).journal.publishedReceipt(operationId, input);
    }
    return { captureBindings, bindBooks, retryBindings, resolveBindings, publishedReceipt };
}
/** Preparation supplies bindings in the fixed upstream precedence order.
 * Provenance keeps every role, while content participates once per stable ID. */
export function resolveAuthorWorldbookBindingsV1(bindings) {
    const bookIds = [], seen = new Set();
    const provenance = [];
    for (const binding of bindings) {
        for (const [ordinal, bookId] of authorWorldbookBindingBookIdsV1(binding.selection).entries()) {
            provenance.push({ bookId, binding, ordinal });
            if (!seen.has(bookId)) {
                seen.add(bookId);
                bookIds.push(bookId);
            }
        }
    }
    return freezeAuthorWorldbookDataV1({ bookIds, provenance });
}
