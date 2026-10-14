// Generated from runtime/alpha3/src/core/roleplay-author-script-resources.ts; edit the TypeScript source.
const emptyData = Object.freeze({});
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
function fail(code) { throw Error(code); }
function atPointer(card, pointer) {
    let value = card;
    for (const encoded of pointer.split('/').slice(1)) {
        const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
        if (Array.isArray(value))
            value = value[Number(key)];
        else
            value = object(value)?.[key];
    }
    return value;
}
/** The Source owner supplies its valid frame and checked plan. Returning their
 * frozen values preserves complete DATA without another clone, hash or parser.
 * Core owns live attachment revocation when that Source frame ceases to apply. */
export function createAuthorScriptResourceReaderV1(frame, descriptors) {
    const card = object(frame.material.card), data = object(card.data) ?? card, helper = object(object(data.extensions)?.tavern_helper), trees = helper.scripts;
    const byId = new Map();
    function index(trees) {
        for (const value of trees) {
            const node = object(value);
            if (node.type === 'folder')
                index(node.scripts);
            else if (node.type === 'script' && typeof node.id === 'string')
                byId.set(node.id, node);
        }
    }
    index(trees);
    const callers = new Map(descriptors.map(pin => {
        const descriptor = object(atPointer(card, pin.pointer));
        if (!descriptor)
            fail('AUTHOR_SCRIPT_RESOURCE_DESCRIPTOR_UNAVAILABLE');
        // Only a descriptor without an original ID receives its existing legacy
        // identity alias. A synthetic alias must not replace a real author UUID.
        const id = typeof descriptor.id === 'string' ? descriptor.id : pin.identity;
        if (typeof descriptor.id !== 'string')
            byId.set(id, descriptor);
        return [pin.identity, { descriptor, pin, id }];
    }));
    function read(request) {
        if (request.schemaVersion !== 1 || request.encoding !== 'native-author-script-resource-request-v1') {
            fail('AUTHOR_SCRIPT_RESOURCE_REQUEST_UNSUPPORTED');
        }
        const caller = callers.get(request.scriptIdentity);
        if (request.sourceSnapshotSha256 !== frame.snapshotSha256
            || !caller || request.descriptorSha256 !== caller.pin.rawDescriptorSha256) {
            fail('AUTHOR_SCRIPT_RESOURCE_CALLER_CHANGED');
        }
        switch (request.operation.kind) {
            case 'self-script-data': return caller.descriptor.data ?? emptyData;
            case 'explicit-script-data': return byId.get(request.operation.scriptId)?.data ?? emptyData;
            case 'script-id': return caller.id;
            case 'script-trees':
                if (request.operation.scope !== 'character')
                    fail('AUTHOR_SCRIPT_RESOURCE_SCOPE_UNAVAILABLE');
                return trees;
            default: return fail('AUTHOR_SCRIPT_RESOURCE_REQUEST_UNSUPPORTED');
        }
    }
    return Object.freeze({ schemaVersion: 1, encoding: 'native-author-script-resource-reader-v1',
        sourceSnapshotSha256: frame.snapshotSha256, documentSha256: frame.snapshot.documentSha256, read });
}
