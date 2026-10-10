// Generated from runtime/alpha3/src/core/tavern-author-browser-source-projection-v3.mts; edit the TypeScript source.
export function projectAuthorScriptResourcesV3(reader, descriptors) {
    const read = (pin, operation) => reader.read({
        schemaVersion: 1, encoding: 'native-author-script-resource-request-v1', scriptIdentity: pin.identity,
        descriptorSha256: pin.rawDescriptorSha256, sourceSnapshotSha256: reader.sourceSnapshotSha256, operation
    });
    const characterTrees = descriptors.length ? read(descriptors[0], { kind: 'script-trees', scope: 'character' }) : [];
    const originalDescriptor = (pin) => {
        // The checked Source pointer already selects this descriptor. Index only
        // its suffix within the same original tree, without interpreting its ID.
        const segments = pin.pointer.split('/'), start = segments.indexOf('tavern_helper') + 2;
        let value = characterTrees;
        for (const encoded of segments.slice(start)) {
            const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
            value = Array.isArray(value) ? value[Number(key)] : value[key];
        }
        return value;
    };
    const callers = descriptors.map(pin => ({ originalOrdinal: pin.originalOrdinal, identity: pin.identity,
        authorId: read(pin, { kind: 'script-id' }), hasOriginalId: typeof originalDescriptor(pin).id === 'string',
        data: read(pin, { kind: 'self-script-data' }) }));
    return { schemaVersion: 3, encoding: 'native-author-script-resource-projection-v3',
        sourceSnapshotSha256: reader.sourceSnapshotSha256, callers,
        characterTrees };
}
