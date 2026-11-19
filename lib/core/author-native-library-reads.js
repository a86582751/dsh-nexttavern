// Generated from runtime/alpha3/src/core/author-native-library-reads.ts; edit the TypeScript source.
export function createAuthorNativeLibraryReadsV1(realmIds) {
    const realms = new Set(realmIds), presets = new Map(), characters = new Map(), resolved = new Map(), bookNames = new WeakMap();
    // These immutable packets are the actual delivered owner objects. Keep their
    // references, including old versions still held by an author's closure.
    function deliverPreset(catalog) {
        if (!presets.has(catalog.revision))
            presets.set(catalog.revision, catalog);
    }
    function deliverCharacter(packet) {
        if (!characters.has(packet.epoch))
            characters.set(packet.epoch, packet);
    }
    function acknowledgedPrefix(packets, versions, domain) {
        if (!versions.length)
            return [];
        const confirmed = new Set(versions), obsolete = [];
        for (const version of confirmed)
            if (!packets.has(version))
                throw Error('AUTHOR_NATIVE_LIBRARY_' + domain.toUpperCase() + '_ACK_UNDELIVERED');
        // Packet delivery order owns this frontier. A semantic revision or opaque
        // epoch is not a substitute for the slowest live realm's actual ACK.
        for (const version of packets.keys()) {
            if (confirmed.has(version))
                break;
            obsolete.push(version);
        }
        return obsolete;
    }
    function releaseDeliveredHistory(input) {
        const presetPrefix = acknowledgedPrefix(presets, input.presetRevisions, 'preset'), characterPrefix = acknowledgedPrefix(characters, input.characterEpochs, 'character');
        for (const revision of presetPrefix)
            presets.delete(revision);
        for (const epoch of characterPrefix)
            characters.delete(epoch);
    }
    function presetValue(read) {
        const catalog = presets.get(read.revision);
        if (!catalog)
            throw Error('AUTHOR_NATIVE_LIBRARY_PACKET_UNDELIVERED');
        if (read.operation === 'names' || read.operation === 'global-regex') {
            if (read.selector !== '')
                throw Error('AUTHOR_NATIVE_LIBRARY_READ_UNSUPPORTED');
            return read.operation === 'names' ? catalog.names : catalog.globalRegexes;
        }
        if (read.operation === 'loaded')
            return read.selector === 'in_use' ? catalog.loaded?.name ?? ''
                : catalog.presets.find(preset => preset.name === read.selector)?.name ?? null;
        if (read.operation !== 'value' && read.operation !== 'regex')
            throw Error('AUTHOR_NATIVE_LIBRARY_READ_UNSUPPORTED');
        const preset = read.selector === 'in_use' ? catalog.current.data
            : catalog.presets.find(preset => preset.name === read.selector)?.data;
        if (!preset)
            return null;
        return read.operation === 'value' ? preset : preset.extensions.regex_scripts ?? Object.freeze([]);
    }
    function bindingValue(packet, entry) {
        let names = bookNames.get(packet.catalog);
        if (!names) {
            names = new Map(packet.catalog.names.map(book => [book.bookId, book.name]));
            bookNames.set(packet.catalog, names);
        }
        // The canonical library owner supplies this registration's character capture.
        const index = names, selection = entry.binding.selection, additional = Object.freeze(selection.additional.flatMap(bookId => {
            const name = index.get(bookId);
            return name === undefined ? [] : [name];
        }));
        return Object.freeze({ target: entry.descriptor, registration: entry.registration, binding: entry.binding,
            catalogHead: packet.catalog.head, names: Object.freeze({
                primary: selection.primary === null ? null : index.get(selection.primary) ?? null, additional
            }) });
    }
    function characterValue(read) {
        const packet = characters.get(read.epoch);
        if (!packet)
            throw Error('AUTHOR_NATIVE_LIBRARY_PACKET_UNDELIVERED');
        if (read.operation !== 'regex' && read.operation !== 'bindings')
            throw Error('AUTHOR_NATIVE_LIBRARY_READ_UNSUPPORTED');
        const selector = read.selector.toLowerCase(), entry = packet.entries.find(candidate => candidate.descriptor.name.toLowerCase() === selector || candidate.descriptor.avatar?.toLowerCase() === selector);
        if (!entry)
            return null;
        return read.operation === 'regex' ? Object.freeze({ descriptor: entry.descriptor,
            registration: entry.registration, regex: entry.regex }) : bindingValue(packet, entry);
    }
    function resolve(reads) {
        return Object.freeze(reads.map(input => {
            if (!realms.has(input.realmId))
                throw Error('AUTHOR_NATIVE_LIBRARY_REALM_UNAVAILABLE');
            const read = input.read, key = JSON.stringify([input.realmId, read.kind,
                read.kind === 'preset' ? read.revision : read.epoch, read.selector, read.operation]), previous = resolved.get(key);
            if (previous)
                return previous;
            let metadata, value;
            if (read.kind === 'preset') {
                value = presetValue(read);
                metadata = Object.freeze({ kind: read.kind, revision: read.revision, selector: read.selector, operation: read.operation });
            }
            else if (read.kind === 'character') {
                value = characterValue(read);
                metadata = Object.freeze({ kind: read.kind, epoch: read.epoch, selector: read.selector, operation: read.operation });
            }
            else
                throw Error('AUTHOR_NATIVE_LIBRARY_READ_UNSUPPORTED');
            const result = Object.freeze({ realmId: input.realmId, read: metadata, value });
            resolved.set(key, result);
            return result;
        }));
    }
    return { deliverPreset, deliverCharacter, resolve, releaseDeliveredHistory };
}
