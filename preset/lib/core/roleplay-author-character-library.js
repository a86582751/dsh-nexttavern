// Generated from runtime/alpha3/src/core/roleplay-author-character-library.ts; edit the TypeScript source.
/** Process-local attachment DATA rebuilt from the canonical directory and its
 * actual published owners. Source, book bodies and execution state stay out. */
import { randomUUID } from 'node:crypto';
import { freezeAuthorWorldbookDataV1, sameAuthorWorldbookRefV1 } from './roleplay-author-worldbook-journal.js';
function sameDescriptor(left, right) {
    const a = left.locator, b = right.locator;
    return left.characterId === right.characterId && left.name === right.name && left.avatar === right.avatar
        && left.ordinal === right.ordinal && a.ownerSessionId === b.ownerSessionId
        && a.sourceRecordSessionId === b.sourceRecordSessionId && a.importId === b.importId
        && a.transactionId === b.transactionId && a.bookPointer === b.bookPointer;
}
function sameRegex(left, right) {
    return left === right || left.sourceSha256 === right.sourceSha256 && left.identitySha256 === right.identitySha256
        && left.revision === right.revision && left.headRef.exists === right.headRef.exists
        && sameAuthorWorldbookRefV1(left.headRef, right.headRef);
}
export function createRoleplayAuthorCharacterLibraryV1(deps) {
    const lifetime = randomUUID(), entries = new Map(), dirtySources = new Set(), dirtyBindings = new Set();
    let descriptors = [], descriptorOwners = new Map(), directoryDirty = true, catalogDirty = true, sequence = 0, packet, catalog, preparing;
    const bindingKey = (owner) => owner.characterId + '\u0000' + (owner.sourceBranchId ?? '');
    const dirty = () => directoryDirty || catalogDirty || dirtySources.size > 0 || dirtyBindings.size > 0;
    function dirtyDirectory() { directoryDirty = true; }
    function dirtySource(ownerSessionId) { dirtySources.add(ownerSessionId); }
    function dirtyWorldbooks(address) {
        const profileId = address.kind === 'book' ? address.address.profileId : address.profileId;
        if (profileId !== deps.profileId)
            return;
        if (address.kind === 'bindings') {
            if (address.owner.kind === 'character')
                dirtyBindings.add(bindingKey(address.owner));
        }
        else
            catalogDirty = true;
    }
    function current(value) {
        return value === packet && !dirty() && deps.profileCurrent();
    }
    function capture() {
        if (!packet || !current(packet))
            throw Error('AUTHOR_CHARACTER_LIBRARY_NOT_READY');
        return packet;
    }
    async function refresh() {
        while (dirty()) {
            if (!deps.profileCurrent())
                throw Error('AUTHOR_CHARACTER_LIBRARY_CHANGED');
            if (directoryDirty) {
                directoryDirty = false;
                try {
                    await deps.readyDirectory();
                }
                catch (error) {
                    directoryDirty = true;
                    throw error;
                }
                const next = deps.characters(), byOwner = new Map(next.map(row => [row.locator.ownerSessionId, row]));
                for (const [owner, entry] of entries)
                    if (!byOwner.has(owner))
                        entries.delete(owner);
                for (const descriptor of next) {
                    const owner = descriptor.locator.ownerSessionId, previous = entries.get(owner);
                    if (!previous || !sameDescriptor(previous.descriptor, descriptor))
                        dirtySources.add(owner);
                }
                descriptors = next;
                descriptorOwners = byOwner;
            }
            const sources = [...dirtySources];
            for (const owner of sources) {
                dirtySources.delete(owner);
                const descriptor = descriptorOwners.get(owner);
                if (!descriptor)
                    continue;
                const previous = entries.get(owner);
                // A failed recapture or reimport must never retain the previous identity.
                entries.delete(owner);
                try {
                    const actual = await deps.captureEntry(descriptor);
                    if (!actual)
                        continue;
                    if (!actual.current())
                        throw Error('AUTHOR_CHARACTER_LIBRARY_CHANGED');
                    const binding = deps.captureBindings(actual.registration.characterBinding), entry = freezeAuthorWorldbookDataV1({ descriptor, registration: actual.registration, regex: actual.regex, binding });
                    entries.set(owner, previous && sameDescriptor(previous.descriptor, descriptor)
                        && previous.registration.sha256 === entry.registration.sha256 && sameRegex(previous.regex, entry.regex)
                        && sameAuthorWorldbookRefV1(previous.binding.head, binding.head) ? previous : entry);
                }
                catch (error) {
                    dirtySources.add(owner);
                    throw error;
                }
            }
            for (const key of [...dirtyBindings]) {
                dirtyBindings.delete(key);
                for (const [owner, entry] of entries)
                    if (bindingKey(entry.registration.characterBinding) === key) {
                        try {
                            const binding = deps.captureBindings(entry.registration.characterBinding);
                            if (!sameAuthorWorldbookRefV1(entry.binding.head, binding.head))
                                entries.set(owner, freezeAuthorWorldbookDataV1({ ...entry, binding }));
                        }
                        catch (error) {
                            dirtyBindings.add(key);
                            throw error;
                        }
                    }
            }
            if (catalogDirty) {
                catalogDirty = false;
                try {
                    const actual = deps.captureCatalog();
                    if (!catalog || !sameAuthorWorldbookRefV1(catalog.head, actual.head))
                        catalog = freezeAuthorWorldbookDataV1({ head: actual.head, revision: actual.revision,
                            names: actual.books.map(book => ({ bookId: book.address.bookId, name: book.name })) });
                }
                catch (error) {
                    catalogDirty = true;
                    throw error;
                }
            }
        }
        if (!deps.profileCurrent())
            throw Error('AUTHOR_CHARACTER_LIBRARY_CHANGED');
        const ordered = descriptors.flatMap(row => {
            const entry = entries.get(row.locator.ownerSessionId);
            return entry ? [entry] : [];
        });
        if (packet && packet.catalog === catalog && packet.entries.length === ordered.length
            && packet.entries.every((entry, index) => entry === ordered[index]))
            return;
        packet = freezeAuthorWorldbookDataV1({ profileId: deps.profileId, epoch: lifetime + ':' + (++sequence),
            entries: ordered, catalog: catalog });
    }
    async function prepare() {
        if (preparing)
            return preparing;
        if (packet && !dirty()) {
            if (!deps.profileCurrent())
                throw Error('AUTHOR_CHARACTER_LIBRARY_CHANGED');
            return;
        }
        const work = refresh();
        preparing = work;
        try {
            await work;
        }
        finally {
            if (preparing === work)
                preparing = undefined;
        }
    }
    function resolve(name, value = capture()) {
        const key = name.toLowerCase();
        return value.entries.find(entry => entry.descriptor.name.toLowerCase() === key
            || entry.descriptor.avatar?.toLowerCase() === key);
    }
    return { ready: prepare, prepare, capture, current, resolve, dirtyDirectory, dirtySource, dirtyWorldbooks };
}
