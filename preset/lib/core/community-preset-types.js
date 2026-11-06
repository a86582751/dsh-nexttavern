// Generated from runtime/alpha3/src/core/community-preset-types.ts; edit the TypeScript source.
/** UI and controls consume the same Core-published range, without regex work. */
export function communityBetweenOptions(preset, option) {
    if (!option.match)
        return [];
    const ids = Array.isArray(option.raw.resolvedPromptIds) ? option.raw.resolvedPromptIds : [];
    const byId = new Map(preset.prompts.map(prompt => [prompt.identifier, prompt]));
    return ids.map(id => typeof id === 'string' ? byId.get(id) : undefined)
        .filter((prompt) => !!prompt);
}
/** Reader's selected history page and its live projection cache share a window. */
export const COMMUNITY_READER_WINDOW_MESSAGES = 500;
