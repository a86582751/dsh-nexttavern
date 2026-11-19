// Generated from runtime/alpha3/src/core/roleplay-author-worldbook-data.ts; edit the TypeScript source.
/** Catalog and bound-book DATA captured by the actual Core read owner. */
import { recordSha256 } from './roleplay-data.js';
import { freezeAuthorWorldbookDataV1 } from './roleplay-author-worldbook-journal.js';
import { nativeNamedWorldbookEntryToWireV1 } from './tavern-named-worldbook-data.js';
const wireEntries = new WeakMap();
const helperCaptures = new WeakMap();
export function authorWorldbookHelperEntryV1(member, prepared) {
    let entry = wireEntries.get(member);
    if (!entry) {
        entry = prepared ?? nativeNamedWorldbookEntryToWireV1(member.rawEntry, { uid: member.uid });
        wireEntries.set(member, entry);
    }
    return entry;
}
export function authorWorldbookHelperEntriesV1(membership, preparedEntries) {
    return [...membership.members].sort((a, b) => a.displayIndex - b.displayIndex)
        .map(member => authorWorldbookHelperEntryV1(member, preparedEntries?.get(member.uid)));
}
export function authorWorldbookHelperCaptureV1(book, preparedEntries) {
    let helper = helperCaptures.get(book);
    if (!helper) {
        if (preparedEntries) {
            // The publisher supplies prepared DTOs only for this exact captured membership.
            const members = [...book.membership.members].sort((a, b) => a.displayIndex - b.displayIndex);
            members.forEach((member, index) => wireEntries.set(member, preparedEntries[index]));
        }
        helper = freezeAuthorWorldbookDataV1({ ...book, entries: preparedEntries ?? authorWorldbookHelperEntriesV1(book.membership) });
        helperCaptures.set(book, helper);
    }
    return helper;
}
const catalogNames = new WeakMap();
function namesForCatalog(catalog) {
    let named = catalogNames.get(catalog);
    if (!named) {
        named = { index: new Map(catalog.books.map(book => [book.address.bookId, book.name])),
            names: catalog.books.map(book => book.name) };
        catalogNames.set(catalog, named);
    }
    return named;
}
export function authorNamedCharacterWorldbookNamesV1(binding, catalog) {
    const selection = binding.selection;
    if (selection.kind !== 'character')
        throw Error('AUTHOR_WORLDBOOK_BINDING_KIND_MISMATCH');
    const { index } = namesForCatalog(catalog);
    return freezeAuthorWorldbookDataV1({ primary: selection.primary === null ? null : index.get(selection.primary) ?? null,
        additional: selection.additional.flatMap(bookId => {
            const name = index.get(bookId);
            return name === undefined ? [] : [name];
        }) });
}
export function captureAuthorNamedWorldbookDataV3(sessionId, sourceSha256, context, catalog) {
    const named = namesForCatalog(catalog);
    const { index, names } = named, character = context.bindings.find(binding => binding.owner.kind === 'character')?.selection, global = context.bindings.find(binding => binding.owner.kind === 'profile')?.selection, chat = context.bindings.find(binding => binding.owner.kind === 'chat')?.selection;
    if (character?.kind !== 'character')
        throw Error('AUTHOR_SOURCE_CONTEXT_BINDING_INVALID');
    const primaryBookId = context.primary?.address.bookId ?? null, primaryName = primaryBookId === null ? null : index.get(primaryBookId) ?? null, characterNames = { primary: primaryName, additional: character.additional.flatMap(bookId => {
            const name = index.get(bookId);
            return name === undefined ? [] : [name];
        }) }, globalNames = global?.kind === 'profile' ? global.enabled.flatMap(bookId => {
        const name = index.get(bookId);
        return name === undefined ? [] : [name];
    }) : [], chatName = chat?.kind === 'chat' && chat.bookId !== null ? index.get(chat.bookId) ?? null : null, refs = context.books.map(book => ({ bookId: book.address.bookId, content: book.content, metadata: book.metadata })), bindingRefs = context.bindings.map(binding => ({ owner: binding.owner, head: binding.head }));
    const dataSha256 = recordSha256({ sessionId, sourceSha256, profileId: catalog.profileId,
        catalog: catalog.head, bindings: bindingRefs, books: refs, primaryBookId });
    return freezeAuthorWorldbookDataV1({ schemaVersion: 3, encoding: 'author-worldbook-catalog-data-v3',
        authority: 'consumer-data-only', sessionId, sourceSha256, profileId: catalog.profileId, catalog,
        books: context.books, bindings: context.bindings, primaryBookId, primaryName, characterNames, globalNames, chatName, names, dataSha256 });
}
export function authorWorldbookReadTargetV1(book) {
    return { bookId: book.address.bookId, contentRef: book.content, metadataRef: book.metadata };
}
/** The fixed Helper resolves collisions over the whole result, with quadratic
 * probing modulo one million. A default candidate here derives from the real
 * operation, so a lost reply never reallocates IDs when that operation retries.
 * Evidence: JS-Slash-Runner 519599bc... src/function/worldbook.ts 306–331. */
export function allocateAuthorWorldbookUidV1(desired, used, operationId, ordinal) {
    let candidate = desired ?? Number.parseInt(recordSha256({ operationId, ordinal }).slice(0, 12), 16) % 1_000_000;
    let probe = 1;
    while (used.has(candidate)) {
        candidate = (candidate + probe * probe) % 1_000_000;
        probe++;
    }
    used.add(candidate);
    return candidate;
}
export function authorWorldbookMutationReplyV1(result) {
    if (result.readError)
        return { readError: result.readError };
    try {
        const entries = authorWorldbookHelperCaptureV1(result.book).entries;
        return { worldbook: entries, new_entries: result.createdEntries,
            deleted_entries: result.deletedEntries, target: authorWorldbookReadTargetV1(result.book) };
    }
    catch (error) {
        return { readError: { code: error instanceof Error ? error.message : 'AUTHOR_WORLDBOOK_READ_UNKNOWN' } };
    }
}
