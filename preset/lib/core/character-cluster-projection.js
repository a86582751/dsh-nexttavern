// Generated from runtime/alpha3/src/core/character-cluster-projection.ts; edit the TypeScript source.
export function offscreenSettings(raw) {
    if (raw == null)
        return { enabled: false, maxCharacters: 2, route: null };
    const value = Object(raw);
    if (typeof value.enabled !== 'boolean')
        throw new Error('必须指定场外推理开关');
    const maxCharacters = value.maxCharacters ?? 2;
    if (typeof maxCharacters !== 'number' || !Number.isSafeInteger(maxCharacters) || maxCharacters < 1)
        throw new Error('每批最多人数必须为正整数');
    return { enabled: value.enabled, maxCharacters, route: clusterRoute(value.route) };
}
export function clusterRoute(raw) {
    if (raw == null)
        return null;
    const value = Object(raw);
    const { provider, model, reasoningEffort } = value;
    if (reasoningEffort != null && !/^[a-zA-Z0-9_-]{1,64}$/.test(String(reasoningEffort)))
        throw new Error('思考等级无效');
    const effort = reasoningEffort ? { reasoningEffort } : {};
    if (value.main === true)
        return { main: true, ...effort };
    if (typeof provider !== 'string' || typeof model !== 'string' || !provider || !model || [provider, model].some((item) => item.length > 300 || /[\x00-\x1f]/.test(item)))
        throw new Error('角色模型无效');
    return { provider, model, ...effort };
}
export function clusterSettings(raw) {
    const value = Object(raw);
    if (typeof value.enabled !== 'boolean')
        throw new Error('必须指定集群开关');
    const characters = {};
    for (const [id, route] of Object.entries(Object(value.characters ?? {}))) {
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
            throw new Error('人物 ID 无效');
        Object.defineProperty(characters, id, { value: clusterRoute(route), enumerable: true, writable: true, configurable: true });
    }
    return { enabled: value.enabled, defaultRoute: clusterRoute(value.defaultRoute), characters,
        ...(value.offscreen === undefined ? {} : { offscreen: offscreenSettings(value.offscreen) }) };
}
export function characterInput({ character, core, stories, notes, lore, userText, branchId, turn }) {
    return { schemaVersion: 1, branchId, turn, character: { id: character.id, name: character.name, content: character.content },
        core: String(core ?? ''), stories: stories.map(({ seq, kind, text }) => ({ seq, kind, text })),
        directorNotes: String(notes ?? ''), worldbook: lore.map(({ text }) => String(text)), playerInput: String(userText ?? '') };
}
