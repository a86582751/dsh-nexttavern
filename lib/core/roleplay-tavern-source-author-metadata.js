// Generated from runtime/alpha3/src/core/roleplay-tavern-source-author-metadata.ts; edit the TypeScript source.
export function isAuthorMetadataRequestV1(value) {
    return !!value && typeof value === 'object'
        && value.encoding === 'tavern-author-metadata-mutation-request-v1';
}
/** Called while the existing journal/layer owner advances its accepted chain.
 * No additional event-history scan or second persistent metadata baseline. */
export function createAuthorMetadataOverlayV1(initial) {
    const extensions = new Map();
    for (const row of initial?.extensions ?? [])
        extensions.set(row.extension, new Map(row.fields.map(field => [field.field, field])));
    return {
        accept(request) {
            if (!isAuthorMetadataRequestV1(request))
                return;
            const mutation = request.mutation;
            let fields = extensions.get(mutation.extension);
            if (!fields) {
                fields = new Map();
                extensions.set(mutation.extension, fields);
            }
            // A payload may remove then set the same field; the explicit set wins.
            for (const field of mutation.remove ?? [])
                fields.set(field, Object.freeze({ field, kind: 'remove' }));
            for (const [field, value] of Object.entries(mutation.set))
                fields.set(field, Object.freeze({ field, kind: 'set', value }));
        },
        data() {
            return Object.freeze({ schemaVersion: 1, encoding: 'tavern-author-metadata-overlay-v1',
                extensions: Object.freeze([...extensions].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
                    .map(([extension, fields]) => Object.freeze({ extension, fields: Object.freeze([...fields.values()]
                        .sort((a, b) => a.field < b.field ? -1 : a.field > b.field ? 1 : 0)) }))) });
        },
    };
}
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
/** Only the touched extension and its field map are copied. Values have already
 * passed the journal's JSON admission; this does not execute author strings. */
export function materializeAuthorMetadataExtensionsV1(original, overlay) {
    if (!overlay.extensions.length)
        return object(original) ? original : undefined;
    if (original !== undefined && !object(original))
        throw Error('AUTHOR_METADATA_EXTENSIONS_NOT_OBJECT');
    const result = { ...object(original) ? original : {} };
    for (const row of overlay.extensions) {
        const prior = Object.hasOwn(result, row.extension) ? result[row.extension] : undefined;
        if (prior !== undefined && !object(prior))
            throw Error('AUTHOR_METADATA_EXTENSION_NOT_OBJECT');
        const next = { ...object(prior) ? prior : {} };
        for (const item of row.fields) {
            if (item.kind === 'remove')
                delete next[item.field];
            else
                Object.defineProperty(next, item.field, { value: item.value, enumerable: true, writable: true, configurable: true });
        }
        Object.defineProperty(result, row.extension, { value: Object.freeze(next), enumerable: true, writable: true, configurable: true });
    }
    return Object.freeze(result);
}
