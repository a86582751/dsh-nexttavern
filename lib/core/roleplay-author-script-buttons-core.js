// Generated from runtime/alpha3/src/core/roleplay-author-script-buttons-core.ts; edit the TypeScript source.
function scriptPath(script) {
    const keys = script.pointer.split('/').slice(1).map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'));
    const extension = keys.indexOf('extensions');
    if (extension < 0 || keys[extension + 1] !== 'tavern_helper' || keys[extension + 2] !== 'scripts')
        throw Error('AUTHOR_SCRIPT_BUTTON_SOURCE_UNAVAILABLE');
    return keys.slice(extension + 3);
}
function descriptor(scripts, path) {
    let value = scripts;
    for (const key of path)
        value = value?.[key];
    if (!value || typeof value !== 'object')
        throw Error('AUTHOR_SCRIPT_BUTTON_SOURCE_UNAVAILABLE');
    return value;
}
export function captureAuthorNativeScriptButtons(program, metadata) {
    const scripts = metadata.extensions?.tavern_helper?.scripts;
    return { sourceSha256: metadata.source.sourceSha256, revision: metadata.revision,
        scripts: program.scripts.filter(script => script.enabled).map(script => {
            const value = descriptor(scripts, scriptPath(script));
            return { scriptId: script.scriptId ?? script.identity, enabled: value.button?.enabled !== false,
                buttons: (value.button?.buttons ?? []).map((button) => ({ name: button.name, visible: button.visible })) };
        }) };
}
export function createRoleplayAuthorScriptButtonsCoreV1(deps) {
    return {
        async mutate(sid, program, realm, request, current, signal, observePublication) {
            const prepared = await deps.withSourceLock(sid, async () => {
                signal.throwIfAborted();
                if (!current())
                    throw Error('AUTHOR_SCRIPT_BUTTON_SOURCE_CHANGED');
                const self = program.scripts.filter(script => script.enabled && script.realmId === realm.realmId);
                if (self.length !== 1)
                    throw Error('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE');
                const captured = deps.source.capture(sid);
                if (captured.kind !== 'captured-data')
                    throw Error('AUTHOR_SCRIPT_BUTTON_SOURCE_UNAVAILABLE');
                const observed = deps.edits.observeAuthorMetadataData(captured);
                if (observed.kind !== 'captured-data')
                    throw Error(observed.diagnostics[0]?.code ?? 'AUTHOR_SCRIPT_BUTTON_SOURCE_UNAVAILABLE');
                const data = observed.data;
                if (data.source.sourceSha256 !== request.expectedSourceSha256 || data.revision !== request.expectedRevision)
                    throw Error('AUTHOR_SCRIPT_BUTTON_BASIS_CHANGED');
                const extension = data.extensions?.tavern_helper;
                const path = scriptPath(self[0]), old = descriptor(extension?.scripts, path);
                if (self[0].scriptId && old.id !== self[0].scriptId)
                    throw Error('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE');
                if (!Array.isArray(request.buttons) || request.buttons.some(button => typeof button.name !== 'string' || typeof button.visible !== 'boolean'))
                    throw Error('AUTHOR_SCRIPT_BUTTONS_INVALID');
                const buttons = request.buttons.map(button => ({ name: button.name, visible: button.visible }));
                const replace = (node, index) => {
                    if (index === path.length)
                        return { ...node, button: { ...node.button, buttons } };
                    const key = path[index], copy = Array.isArray(node) ? node.slice() : { ...node };
                    copy[key] = replace(node[key], index + 1);
                    return copy;
                };
                return { source: data.source.sourceSha256, revision: data.revision, scripts: replace(extension.scripts, 0) };
            }, signal);
            // The Source writer owns its FIFO and exact revision CAS. Do not nest
            // that lock around this call or reconstruct a second publication owner.
            return deps.edits.mutateAuthorMetadata({ schemaVersion: 1, encoding: 'tavern-author-metadata-mutation-request-v1',
                sessionId: sid, operationId: request.operationId, expectedSourceSha256: prepared.source, expectedRevision: prepared.revision,
                mutation: { kind: 'extension-fields', extension: 'tavern_helper', set: { scripts: prepared.scripts } } }, current, observePublication);
        },
    };
}
