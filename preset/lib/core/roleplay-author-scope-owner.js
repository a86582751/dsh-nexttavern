// Generated from runtime/alpha3/src/core/roleplay-author-scope-owner.ts; edit the TypeScript source.
export const isAuthorSharedScopeOperationV1 = (operation) => 'kind' in operation && operation.kind === 'shared-scope';
export const authorOrdinarySourceNamespaceV1 = (operation) => isAuthorSharedScopeOperationV1(operation) ? operation.sourceNamespace : operation.namespace;
export const authorSharedScopeRootsV1 = (snapshots) => [
    snapshots?.global?.root, snapshots?.character?.root, snapshots?.preset?.root,
    snapshots?.extensions && Object.entries(snapshots.extensions).map(([id, capture]) => [id, capture.root])
];
export function authorSharedScopeCaptureV1(snapshots, selector) {
    const extensions = snapshots?.extensions;
    const capture = selector.type === 'extension'
        ? extensions && Object.hasOwn(extensions, selector.extension_id) ? extensions[selector.extension_id] : undefined
        : snapshots?.[selector.type];
    if (!capture)
        throw Error('AUTHOR_NATIVE_VARIABLE_SCOPE_UNAVAILABLE');
    return capture;
}
export function authorSharedScopeSelectorV1(address) {
    return address.scope === 'extension' ? { type: 'extension', extension_id: address.extensionId } : { type: address.scope };
}
function updateFor(operation) {
    return { expectedRoot: operation.expectedRoot, operationId: operation.operationId, values: operation.values, cause: operation.cause };
}
const addressIdentity = (address) => JSON.stringify([
    address.schemaVersion, address.profileId, address.scope,
    address.scope === 'character' ? address.characterId : address.scope === 'preset' ? address.presetId :
        address.scope === 'extension' ? address.extensionId : null
]);
export function createRoleplayAuthorScopeOwnerV1(deps) {
    function addressFor(selector, identity) {
        const common = { schemaVersion: 1, profileId: deps.profile.profileId };
        if (selector.type === 'global')
            return { ...common, scope: 'global' };
        if (selector.type === 'character' && identity.characterId)
            return { ...common, scope: 'character', characterId: identity.characterId };
        if (selector.type === 'preset' && identity.presetId)
            return { ...common, scope: 'preset', presetId: identity.presetId };
        if (selector.type === 'extension' && identity.extensionIds.includes(selector.extension_id))
            return { ...common, scope: 'extension', extensionId: selector.extension_id };
        throw Error('AUTHOR_NATIVE_VARIABLE_SCOPE_UNAVAILABLE');
    }
    function capture(sid) {
        const identity = deps.resolveIdentity(sid), read = (selector) => deps.scopes.capture(addressFor(selector, identity)), extensions = Object.create(null);
        for (const extension_id of identity.extensionIds)
            extensions[extension_id] = read({ type: 'extension', extension_id });
        return { global: read({ type: 'global' }), ...identity.characterId ? { character: read({ type: 'character' }) } : {},
            ...identity.presetId ? { preset: read({ type: 'preset' }) } : {}, extensions };
    }
    function resolve(sid, selector, callerCurrent) {
        const identity = deps.resolveIdentity(sid), address = addressFor(selector, identity), capture = deps.scopes.capture(address);
        return { address, root: capture.root, values: capture.values, capture,
            current: () => callerCurrent() && identity.current() };
    }
    async function replace(sid, operation, callerCurrent) {
        const selector = authorSharedScopeSelectorV1(operation.expectedRoot.address);
        const publish = async () => {
            const resolved = resolve(sid, selector, callerCurrent), expectedIdentity = addressIdentity(resolved.address);
            if (expectedIdentity !== addressIdentity(operation.expectedRoot.address))
                throw Error('AUTHOR_SCOPE_BINDING_CHANGED');
            const update = { ...updateFor(operation), expectedRoot: { address: resolved.address, head: operation.expectedRoot.head } };
            return deps.scopes.replace(update, {
                owns: address => addressIdentity(address) === expectedIdentity, isCurrent: resolved.current
            });
        };
        // Preset content and its live variables share the community owner's FIFO.
        // A full content replacement retains its fixed scope continuation there.
        return selector.type === 'preset' && deps.withPresetMutation ? deps.withPresetMutation(publish) : publish();
    }
    return { capture, resolve, replace, lookup: (operation) => deps.scopes.lookup(updateFor(operation)) };
}
