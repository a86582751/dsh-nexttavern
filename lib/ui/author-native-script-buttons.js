// Generated from runtime/alpha3/src/ui/author-native-script-buttons.ts; edit the TypeScript source.
/** The same catalog is serialized into the author realm and used by the
 * native action area. Event names locate buttons; they never grant authority. */
export function createAuthorNativeScriptButtonCatalog(scripts) {
    const enabled = scripts.filter(script => script.enabled);
    const event = (scriptId, name) => 'native-script-button:' + JSON.stringify([scriptId, name]);
    const id = (script) => script.scriptId ?? script.identity;
    const get = (scriptId) => {
        const script = enabled.find(script => id(script) === scriptId);
        if (!script)
            throw Error('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE');
        return script;
    };
    const visible = () => enabled.flatMap(script => script.button?.enabled ? script.button.buttons.filter(button => button.visible)
        .map(button => ({ scriptId: id(script), realmId: script.realmId, name: button.name, event: event(id(script), button.name) })) : []);
    return {
        getButtonEvent: (scriptId, name) => { get(scriptId); return event(scriptId, name); },
        getScriptButtons: (scriptId) => get(scriptId).button?.buttons.map(button => ({ ...button })) ?? [],
        getAllEnabledScriptButtons: () => {
            const result = {};
            for (const row of visible())
                (result[row.scriptId] ??= []).push({ button_id: row.event, button_name: row.name });
            return result;
        }, visible,
    };
}
/** A mount owns its actual DOM handlers. Source revocation cannot dispatch a
 * retained/detached button, even before its old DOM has been removed. */
export function mountAuthorNativeScriptButtons(container, scripts, options) {
    const catalog = createAuthorNativeScriptButtonCatalog(scripts), rows = catalog.visible();
    if (!rows.length)
        return { dispose() { } };
    let active = true;
    const document = container.ownerDocument, section = document.createElement('section');
    section.setAttribute('aria-label', '作者动作');
    section.className = 'rp-author-script-actions';
    section.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:8px 0';
    const cleanup = [];
    for (const row of rows) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = row.name;
        button.dataset.scriptId = row.scriptId;
        button.className = 'dsh-rp-btn rp-author-script-action';
        const click = () => { if (active && options.current())
            options.dispatch(row.realmId, row.event); };
        button.addEventListener('click', click);
        cleanup.push(() => button.removeEventListener('click', click));
        section.append(button);
    }
    container.append(section);
    return { dispose() { active = false; for (const stop of cleanup)
            stop(); section.remove(); } };
}
