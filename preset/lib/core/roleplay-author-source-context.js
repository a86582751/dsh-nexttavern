// Generated from runtime/alpha3/src/core/roleplay-author-source-context.ts; edit the TypeScript source.
/** Source registers its character and primary book once. Current consumers
 * capture the real binding/content owners, while frozen consumers keep refs. */
import { randomUUID } from 'node:crypto';
import { recordSha256 } from './roleplay-data.js';
import { withTavernLock } from './tavern-task-support.js';
import { readAuthorProfileIdentityV1 } from './roleplay-author-profile.js';
import { resolveAuthorWorldbookBindingsV1 } from './roleplay-author-worldbook-bindings.js';
import { freezeAuthorWorldbookDataV1 } from './roleplay-author-worldbook-journal.js';
import { compileAuthorWorldbookV1, composeAuthorWorldbooksV1 } from './tavern-lore-compiler.mjs';
const sourceLocator = (source) => ({
    ownerSessionId: source.sessionId, sourceRecordSessionId: source.sourceRecordSessionId,
    importId: source.original.activePointer.importId, transactionId: source.original.activePointer.transactionId,
    bookPointer: source.original.primary.bookPointer
});
const registrationKey = (profileId, locator) => 'author-source-context-v1-' + recordSha256({ profileId, locator });
const characterOrigin = (locator) => ({ sourceRecordSessionId: locator.sourceRecordSessionId,
    importId: locator.importId, transactionId: locator.transactionId });
const characterKey = (profileId, locator) => 'author-character-v1-' + recordSha256({ profileId, ...characterOrigin(locator) });
const registrationRef = (key, row) => ({ key, sha256: row.sha256 });
const materializedBooks = new WeakMap();
/** Owner DATA is already immutable. Reuse unchanged entry objects in each
 * required complete book output without a second wire-format round trip. */
export function materializeAuthorWorldbookCaptureV1(book) {
    let result = materializedBooks.get(book);
    if (result)
        return result;
    const entries = [...book.membership.members].sort((left, right) => left.displayIndex - right.displayIndex)
        .map((member, index) => {
        const extensions = member.rawEntry.extensions, rawDisplay = extensions && typeof extensions === 'object' && !Array.isArray(extensions) ? extensions.display_index : undefined, displayChanged = (rawDisplay ?? index) !== member.displayIndex;
        if (Object.hasOwn(member.rawEntry, 'id') && !displayChanged)
            return member.rawEntry;
        return { ...member.rawEntry, ...Object.hasOwn(member.rawEntry, 'id') ? {} : { id: member.uid },
            ...displayChanged ? { extensions: { ...extensions, display_index: member.displayIndex } } : {} };
    });
    result = freezeAuthorWorldbookDataV1({ ...book.bookData, name: book.name, entries });
    materializedBooks.set(book, result);
    return result;
}
export function createRoleplayAuthorContextV1(deps) {
    const { profile, catalog, bindings, table } = deps, parsed = new WeakSet();
    const currentCaptures = new Map();
    const compilations = new WeakMap();
    const mvuBookData = new WeakMap();
    const extensionKey = 'author-extension-namespaces-v1-' + profile.profileId;
    const characterDirectoryKey = 'author-character-directory-v1-' + profile.profileId;
    const characterIndexes = new WeakMap();
    let characterDirectoryReady;
    const profileCurrent = () => readAuthorProfileIdentityV1(table)?.profileId === profile.profileId;
    function readRegistration(locator) {
        const key = registrationKey(profile.profileId, locator), raw = table.get(key);
        if (raw === undefined)
            return;
        const row = raw;
        if (!parsed.has(row)) {
            const { sha256, ...body } = row;
            if (row.schemaVersion !== 1 || row.encoding !== 'author-source-context-registration-v1'
                || row.profileId !== profile.profileId || recordSha256(row.locator) !== recordSha256(locator)
                || !row.characterId || row.characterBinding.characterId !== row.characterId || recordSha256(body) !== sha256)
                throw Error('AUTHOR_SOURCE_CONTEXT_INVALID');
            parsed.add(row);
        }
        return { registration: row, ref: registrationRef(key, row) };
    }
    async function putExact(key, value, current, replace = false) {
        if (!profileCurrent() || !current())
            throw Error('AUTHOR_SOURCE_CONTEXT_CHANGED');
        const previous = table.get(key), expectedSha256 = recordSha256(value);
        if (previous !== undefined) {
            if (recordSha256(previous) === expectedSha256)
                return;
            if (!replace)
                throw Error('AUTHOR_SOURCE_CONTEXT_CONFLICT');
        }
        try {
            await table.put(key, value);
        }
        catch (error) {
            if (recordSha256(table.get(key)) !== expectedSha256)
                throw error;
            return;
        }
        if (recordSha256(table.get(key)) !== expectedSha256)
            throw Error('AUTHOR_SOURCE_CONTEXT_WRITE_UNKNOWN');
    }
    function readCharacterDirectory() {
        const row = table.get(characterDirectoryKey);
        if (row === undefined)
            return;
        if (!parsed.has(row)) {
            if (row.schemaVersion !== 1 || row.encoding !== 'author-character-directory-v1' || row.profileId !== profile.profileId
                || !Array.isArray(row.entries) || !Number.isSafeInteger(row.nextOrdinal) || row.nextOrdinal < 0)
                throw Error('AUTHOR_CHARACTER_DIRECTORY_INVALID');
            freezeAuthorWorldbookDataV1(row);
            parsed.add(row);
        }
        return row;
    }
    async function readyCharacters(current) {
        if (!profileCurrent() || !current())
            throw Error('AUTHOR_SOURCE_CONTEXT_CHANGED');
        if (characterDirectoryReady)
            return characterDirectoryReady;
        const ready = withTavernLock(table, characterDirectoryKey, async () => {
            const previous = readCharacterDirectory(), byOwner = new Map(previous?.entries.map(entry => [entry.locator.ownerSessionId, entry])), registered = deps.registeredSources?.() ?? previous?.entries.flatMap(entry => {
                const stored = readRegistration(entry.locator);
                return stored ? [stored.registration] : [];
            }) ?? [], entries = [];
            let nextOrdinal = previous?.nextOrdinal ?? 0;
            for (const registration of registered) {
                const locator = registration.locator;
                if (registration.profileId !== profile.profileId || locator.ownerSessionId !== locator.sourceRecordSessionId)
                    continue;
                const saved = byOwner.get(locator.ownerSessionId), data = deps.readCharacterSource?.(locator);
                if (!data)
                    continue;
                entries.push({ characterId: registration.characterId, name: data.name,
                    ...data.avatar !== undefined ? { avatar: data.avatar } : {}, locator, origin: characterOrigin(locator),
                    ordinal: saved?.ordinal ?? nextOrdinal++ });
            }
            entries.sort((left, right) => left.ordinal - right.ordinal);
            const directory = freezeAuthorWorldbookDataV1({ schemaVersion: 1, encoding: 'author-character-directory-v1',
                profileId: profile.profileId, nextOrdinal, entries });
            // The same profile lock owns cold replacement and incremental upserts.
            deps.characterDirectoryChanging?.();
            await putExact(characterDirectoryKey, directory, current, true);
        });
        characterDirectoryReady = ready;
        try {
            await ready;
        }
        catch (error) {
            if (characterDirectoryReady === ready)
                characterDirectoryReady = undefined;
            throw error;
        }
    }
    function characters() {
        return readCharacterDirectory()?.entries ?? [];
    }
    function directoryIndex() {
        const directory = readCharacterDirectory();
        if (!directory)
            return undefined;
        let result = characterIndexes.get(directory);
        if (result)
            return result;
        const owners = new Map(), names = new Map();
        for (const entry of directory.entries) {
            owners.set(entry.locator.ownerSessionId, entry);
            for (const name of [entry.name, entry.avatar])
                if (name !== undefined && !names.has(name.toLowerCase()))
                    names.set(name.toLowerCase(), entry);
        }
        result = { owners, names };
        characterIndexes.set(directory, result);
        return result;
    }
    function hasCharacterRegistration(registration) {
        const locator = registration.locator;
        if (locator.ownerSessionId !== locator.sourceRecordSessionId)
            return true;
        const entry = directoryIndex()?.owners.get(locator.ownerSessionId), actual = entry?.locator;
        return entry?.characterId === registration.characterId && actual?.sourceRecordSessionId === locator.sourceRecordSessionId
            && actual?.importId === locator.importId && actual?.transactionId === locator.transactionId
            && actual?.bookPointer === locator.bookPointer;
    }
    function resolveCharacter(name) {
        return directoryIndex()?.names.get(name.toLowerCase());
    }
    /** The caller owns this captured Source and its registration. The directory
     * only indexes the canonical import owner; a fork keeps its own Source. */
    async function refreshCharacter(captured, registration, current) {
        const locator = registration.locator;
        if (locator.ownerSessionId !== locator.sourceRecordSessionId)
            return;
        await readyCharacters(current);
        await withTavernLock(table, characterDirectoryKey, async () => {
            const previous = readCharacterDirectory(), data = captured.contributionInput.rawDecoded.data, name = String(data.name), avatar = typeof data.avatar === 'string' ? data.avatar : undefined, index = previous.entries.findIndex(entry => entry.locator.ownerSessionId === locator.ownerSessionId), existing = previous.entries[index], before = existing?.locator;
            // Source recapture and metadata edits commonly keep these aliases. Only
            // the changed descriptor should rewrite the profile's complete index.
            if (existing && existing.characterId === registration.characterId && existing.name === name && existing.avatar === avatar
                && before.sourceRecordSessionId === locator.sourceRecordSessionId && before.importId === locator.importId
                && before.transactionId === locator.transactionId && before.bookPointer === locator.bookPointer)
                return;
            const entries = [...previous.entries], entry = { characterId: registration.characterId, name,
                ...avatar !== undefined ? { avatar } : {}, locator, origin: characterOrigin(locator),
                ordinal: existing?.ordinal ?? previous.nextOrdinal };
            if (index < 0)
                entries.push(entry);
            else
                entries[index] = entry;
            const directory = freezeAuthorWorldbookDataV1({ ...previous, entries,
                nextOrdinal: previous.nextOrdinal + (index < 0 ? 1 : 0) });
            deps.characterDirectoryChanging?.();
            await putExact(characterDirectoryKey, directory, current, true);
        });
    }
    async function characterIdentity(locator, current) {
        const key = characterKey(profile.profileId, locator);
        return withTavernLock(table, key, async () => {
            const previous = table.get(key);
            if (previous) {
                if (previous.schemaVersion !== 1 || previous.encoding !== 'author-character-identity-v1'
                    || previous.profileId !== profile.profileId || !previous.characterId
                    || recordSha256(previous.origin) !== recordSha256(characterOrigin(locator)))
                    throw Error('AUTHOR_CHARACTER_IDENTITY_INVALID');
                return previous.characterId;
            }
            const value = { schemaVersion: 1, encoding: 'author-character-identity-v1',
                profileId: profile.profileId, origin: characterOrigin(locator), characterId: randomUUID() };
            await putExact(key, value, current);
            return value.characterId;
        });
    }
    async function seedCharacterVariables(captured, locator, characterId, current) {
        const address = { schemaVersion: 1, profileId: profile.profileId, scope: 'character', characterId };
        if (deps.scopes.captureRoot(address).head)
            return;
        const extensions = captured.contributionInput.rawDecoded.data.extensions, helper = extensions?.tavern_helper, settings = Array.isArray(helper) ? Object.fromEntries(helper) : helper, raw = settings && typeof settings === 'object' ? settings.variables : undefined, values = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        // The immutable import and stable character identity keep a partial seed's
        // input unchanged across Source recapture. An empty seed still owns a head.
        await deps.scopes.replace({ expectedRoot: { address, head: null }, operationId: characterId, values,
            cause: { schemaVersion: 1, encoding: 'author-character-variables-seed-v1', origin: characterOrigin(locator),
                importRecordRef: { ...captured.source.original.importRecordRef } } }, {
            owns: target => target.profileId === address.profileId && target.scope === 'character' && target.characterId === characterId,
            isCurrent: () => profileCurrent() && current()
        });
    }
    function registeredExtensions() {
        const row = table.get(extensionKey);
        if (row === undefined)
            return [];
        if (row.schemaVersion !== 1 || row.encoding !== 'author-extension-namespaces-v1' || row.profileId !== profile.profileId)
            throw Error('AUTHOR_EXTENSION_NAMESPACES_INVALID');
        return row.ids;
    }
    async function registerExtensions(ids, current) {
        return withTavernLock(table, extensionKey, async () => {
            const previous = registeredExtensions(), known = new Set(previous), added = ids.filter(id => id.length && !known.has(id));
            if (!added.length)
                return;
            if (!profileCurrent() || !current())
                throw Error('AUTHOR_SOURCE_CONTEXT_CHANGED');
            const value = { schemaVersion: 1, encoding: 'author-extension-namespaces-v1', profileId: profile.profileId,
                ids: [...new Set([...previous, ...added])] };
            try {
                await table.put(extensionKey, value);
            }
            catch (error) {
                if (recordSha256(table.get(extensionKey)) !== recordSha256(value))
                    throw error;
            }
            if (recordSha256(table.get(extensionKey)) !== recordSha256(value))
                throw Error('AUTHOR_SOURCE_CONTEXT_WRITE_UNKNOWN');
        });
    }
    /** The metadata journal already proved publication. This derived profile
     * registration uses its live Domain owner even after that Source retired. */
    function registerMetadataExtension(event, current) {
        if (event.request.mutation.kind !== 'extension-fields')
            return;
        return registerExtensions([event.request.mutation.extension], current);
    }
    function writerFor(current) {
        return { owns: owner => owner.kind === 'book' ? owner.address.profileId === profile.profileId : owner.profileId === profile.profileId,
            isCurrent: () => profileCurrent() && current() };
    }
    async function publishRegistration(locator, characterId, characterBinding, primaryBookId, adoption, additional, operationId, current) {
        const writer = writerFor(current), selection = { kind: 'character', primary: primaryBookId, additional };
        let bound;
        try {
            bound = await bindings.retryBindings(characterBinding, operationId, writer);
        }
        catch (error) {
            if (!(error instanceof Error) || error.message !== 'AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED')
                throw error;
            bound = await bindings.bindBooks(bindings.captureBindings(characterBinding), selection, operationId, writer);
        }
        if (!bound.bindings.head)
            throw Error('AUTHOR_SOURCE_CONTEXT_BINDING_UNCONFIRMED');
        const body = { schemaVersion: 1, encoding: 'author-source-context-registration-v1',
            profileId: profile.profileId, locator, characterId, characterBinding, primaryBookId, adoption, binding: bound.bindings.head }, row = freezeAuthorWorldbookDataV1({ ...body, sha256: recordSha256(body) }), key = registrationKey(profile.profileId, locator);
        await putExact(key, row, current);
        return readRegistration(locator);
    }
    /** Core holds the real Source FIFO. An unfinished adoption must finish this
     * registration before any old editor or current material can proceed. */
    async function ensureSource(captured, current) {
        const source = captured.source, locator = sourceLocator(source), existing = readRegistration(locator);
        const live = () => current() && deps.current(source);
        if (existing) {
            await refreshCharacter(captured, existing.registration, live);
            return existing;
        }
        await registerExtensions(Object.keys(captured.contributionInput.rawDecoded.data.extensions ?? {}), live);
        const characterId = await characterIdentity(locator, live);
        await seedCharacterVariables(captured, locator, characterId, live);
        const characterBinding = { kind: 'character', characterId,
            ...source.sessionId !== source.sourceRecordSessionId || source.inheritance ? { sourceBranchId: source.sessionId } : {} }, seed = deps.captureImportSeed(captured), operationId = 'author-source-adopt-' + recordSha256(locator);
        const adopted = seed ? await catalog.adoptImportedBook({ ...seed, locator }, operationId, writerFor(live)) : undefined;
        const installed = await publishRegistration(locator, characterId, characterBinding, adopted && !adopted.deleted ? adopted.book.address.bookId : null, adopted?.registration ?? null, [], operationId, live);
        await refreshCharacter(captured, installed.registration, live);
        return installed;
    }
    function captureBindings(source) {
        const stored = readRegistration(sourceLocator(source));
        if (!stored)
            throw Error('AUTHOR_SOURCE_CONTEXT_NOT_READY');
        const { registration } = stored, profileBinding = bindings.captureBindings({ kind: 'profile', profileId: profile.profileId }), characterBinding = bindings.captureBindings(registration.characterBinding), chatBinding = bindings.captureBindings({ kind: 'chat', namespace: deps.namespace(source) }), ordered = [profileBinding, characterBinding, chatBinding];
        return { registration, registrationRef: stored.ref, bindings: ordered };
    }
    function capture(source) {
        const basis = captureBindings(source), { registration, bindings: ordered } = basis, previous = currentCaptures.get(source.sessionId), resolved = previous && previous.registration.sha256 === registration.sha256
            && ordered.every((binding, index) => binding === previous.bindings[index]) ? previous : resolveAuthorWorldbookBindingsV1(ordered), books = resolved.bookIds.flatMap(bookId => {
            try {
                return [catalog.captureBook(bookId)];
            }
            catch (error) {
                if (error instanceof Error && error.message === 'AUTHOR_WORLDBOOK_NOT_FOUND')
                    return [];
                throw error;
            }
        }), selection = ordered[1].selection;
        if (selection.kind !== 'character')
            throw Error('AUTHOR_SOURCE_CONTEXT_BINDING_INVALID');
        const primary = selection.primary === null ? undefined : books.find(book => book.address.bookId === selection.primary);
        if (previous && previous.registration.sha256 === registration.sha256
            && ordered.every((binding, index) => binding === previous.bindings[index])
            && books.length === previous.books.length && books.every((book, index) => book === previous.books[index]))
            return previous;
        const result = freezeAuthorWorldbookDataV1({ registration, registrationRef: basis.registrationRef,
            bindings: ordered, books, bookIds: resolved.bookIds, provenance: resolved.provenance, primary });
        currentCaptures.set(source.sessionId, result);
        return result;
    }
    function captureCompilation(source) {
        const context = capture(source), previous = compilations.get(context);
        if (previous?.sourceSha256 === source.sourceSha256)
            return { context, compilation: previous.compilation };
        const original = source.original, primary = original.primary, consumerSource = { schemaVersion: 1,
            encoding: 'st-character-book-source-reference-v1', ownerSessionId: source.sessionId,
            sourceRecordSessionId: source.sourceRecordSessionId, importId: original.activePointer.importId,
            rawSourceSha256: original.rawSha256, importRecordSha256: original.importRecordRef.sha256,
            sourceSnapshotSha256: source.sourceSha256, documentSha256: original.documentSha256,
            bookPointer: primary.bookPointer, bookValueSha256: primary.bookSha256,
            sourceFormat: original.decodedFormat === 'json-nexttavern-v1' ? 'nexttavern-character-book'
                : original.decodedFormat.endsWith('v3') ? 'ccv3-character-book' : 'ccv2-character-book',
            ...source.inheritance ? { inheritance: source.inheritance } : {},
            ...source.legacyInheritance ? { legacyInheritance: source.legacyInheritance } : {},
            ...primary.binding === 'proven-absence' ? { bookPresence: 'proven-absence', absenceProof: primary.absenceProof } : {} }, plans = previous?.plans ?? context.books.map(compileAuthorWorldbookV1), compilation = composeAuthorWorldbooksV1(consumerSource, context.bindings, plans);
        compilations.set(context, { sourceSha256: source.sourceSha256, plans, compilation });
        return { context, compilation };
    }
    function captureAuthorData(captured) {
        const context = capture(captured.source);
        let data = mvuBookData.get(context);
        if (data)
            return { captured, ...data };
        const primaryBookId = context.primary?.address.bookId ?? null, firstBindings = new Map(context.provenance.toReversed().map(row => [row.bookId, row.binding.owner])), books = context.books.map(book => {
            const owner = firstBindings.get(book.address.bookId);
            return { book, binding: book.address.bookId === primaryBookId ? 'primary'
                    : owner.kind === 'profile' ? 'global' : owner.kind === 'chat' ? 'chat' : 'additional' };
        }), effectiveLore = freezeAuthorWorldbookDataV1({ schemaVersion: 1,
            encoding: 'native-mvu-effective-lore-source-v1', kind: 'catalog-collection',
            originalDocumentSha256: captured.source.original.documentSha256, profileId: profile.profileId, primaryBookId,
            books: books.map(({ book, binding }) => ({ bookId: book.address.bookId, metadataRef: book.metadata, contentRef: book.content, binding })),
            bindings: context.bindings });
        data = { book: context.primary ? materializeAuthorWorldbookCaptureV1(context.primary) : undefined, books, effectiveLore };
        mvuBookData.set(context, data);
        return { captured, ...data };
    }
    function resolveFrozenBook(ref) {
        return catalog.resolveBookRefs(ref.bookId, ref.contentRef, ref.metadataRef);
    }
    function forkBookId(prepared, parentBookId) {
        const parent = prepared.authorContextForkV1?.primary;
        if (!parent || parent.bookId !== parentBookId)
            return parentBookId;
        if (parent.descriptor.origin.kind !== 'adopted-import' && parent.descriptor.origin.kind !== 'fork-copy')
            return parentBookId;
        const original = prepared.originalBinding, stored = readRegistration({ ownerSessionId: prepared.childSessionId,
            sourceRecordSessionId: original.sourceRecordSessionId, importId: original.importId,
            transactionId: original.transactionId, bookPointer: '/data/character_book' });
        if (!stored?.registration.primaryBookId)
            throw Error('AUTHOR_SOURCE_CONTEXT_FORK_BOOK_UNAVAILABLE');
        return stored.registration.primaryBookId;
    }
    function freezeFork(source) {
        const context = capture(source), character = context.bindings[1].selection, chat = context.bindings[2].selection, primary = context.primary, catalogue = catalog.captureCatalog();
        if (character.kind !== 'character' || chat.kind !== 'chat')
            throw Error('AUTHOR_SOURCE_CONTEXT_BINDING_INVALID');
        return freezeAuthorWorldbookDataV1({ schemaVersion: 1, encoding: 'author-context-fork-v1',
            characterId: context.registration.characterId, primary: primary ? { bookId: primary.address.bookId,
                metadataRef: primary.metadata, contentRef: primary.content,
                descriptor: catalogue.books.find(book => book.address.bookId === primary.address.bookId) } : null,
            additional: character.additional, chatBookId: chat.bookId });
    }
    async function installFork(input, operationId, current) {
        const locator = { ownerSessionId: input.childSessionId,
            sourceRecordSessionId: input.sourceRecordSessionId, importId: input.importId,
            transactionId: input.transactionId, bookPointer: input.bookPointer }, existing = readRegistration(locator);
        if (existing)
            return existing;
        const { frozen } = input, parent = frozen.primary, isolated = parent?.descriptor.origin.kind === 'adopted-import' || parent?.descriptor.origin.kind === 'fork-copy', adopted = parent && isolated ? await catalog.adoptImportedBook({ name: parent.descriptor.name, locator,
            seed: { kind: 'fork', parent: parent.descriptor, content: parent.contentRef } }, operationId, writerFor(current)) : undefined, primary = adopted ? adopted.deleted ? null : adopted.book.address.bookId : parent?.bookId ?? null, characterBinding = { kind: 'character',
            characterId: frozen.characterId, sourceBranchId: input.childSessionId };
        const writer = writerFor(current), chatOwner = { kind: 'chat', namespace: input.childNamespace }, chatOperation = 'author-source-chat-' + operationId;
        try {
            await bindings.retryBindings(chatOwner, chatOperation, writer);
        }
        catch (error) {
            if (!(error instanceof Error) || error.message !== 'AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED')
                throw error;
            await bindings.bindBooks(bindings.captureBindings(chatOwner), { kind: 'chat', bookId: frozen.chatBookId }, chatOperation, writer);
        }
        return publishRegistration(locator, frozen.characterId, characterBinding, primary, adopted?.registration ?? null, frozen.additional, operationId, current);
    }
    return { ensureSource, capture, captureBindings, captureCompilation, captureAuthorData, resolveFrozenBook, forkBookId, freezeFork, installFork,
        readyCharacters, characters, resolveCharacter, refreshCharacter, hasCharacterRegistration,
        registeredExtensions, registerExtensions, registerMetadataExtension,
        readRegisteredOrigin: readRegistration,
        readRegistration: (source) => readRegistration(sourceLocator(source)) };
}
