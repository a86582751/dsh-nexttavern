// Generated from runtime/alpha3/src/core/community-preset-types.ts; edit the TypeScript source.
export const COMMUNITY_PRESET_DEFAULT_SETTINGS_V1 = {
    max_context: 2000000, max_completion_tokens: 300, reply_count: 1, should_stream: false, temperature: 1,
    frequency_penalty: 0, presence_penalty: 0, repetition_penalty: 1, top_p: 1, min_p: 0, top_k: 0, top_a: 0, seed: -1,
    squash_system_messages: false, reasoning_effort: 'auto', request_thoughts: false, request_images: false,
    enable_function_calling: false, enable_web_search: false, allow_sending_images: 'disabled', allow_sending_videos: false,
    character_name_prefix: 'none', wrap_user_messages_in_quotes: false,
};
/** The browser and canonical importer expose the same fixed Helper defaults. */
export function communityDefaultPresetDataV1() {
    const order = ['worldInfoBefore', 'personaDescription', 'charDescription', 'charPersonality', 'scenario',
        'worldInfoAfter', 'dialogueExamples', 'chatHistory'], names = {
        worldInfoBefore: 'World Info (before) - 角色定义之前', personaDescription: 'Persona Description - 玩家描述',
        charDescription: 'Char Description - 角色描述', charPersonality: 'Char Personality - 角色性格', scenario: 'Scenario - 情景',
        worldInfoAfter: 'World Info (after) - 角色定义之后', dialogueExamples: 'Chat Examples - 对话示例', chatHistory: 'Chat History - 聊天记录'
    };
    return { settings: structuredClone(COMMUNITY_PRESET_DEFAULT_SETTINGS_V1), prompts: order.map(id => ({ id, name: names[id],
            enabled: true, position: { type: 'relative' }, role: 'system' })), prompts_unused: [],
        extensions: { tavern_helper: { scripts: [], variables: {} } } };
}
/** The state owner knows this operation has not reached acceptance. */
export class CommunityAuthorPresetRefusalV1 extends Error {
    operationId;
    code;
    constructor(operationId, code) {
        super(code);
        this.operationId = operationId;
        this.code = code;
        this.name = 'CommunityAuthorPresetRefusalV1';
    }
}
/** UI and controls consume the same Core-published range, without regex work. */
export function communityBetweenOptions(preset, option) {
    if (!option.match)
        return [];
    const ids = Array.isArray(option.raw.resolvedPromptIds) ? option.raw.resolvedPromptIds : [];
    const byId = new Map(preset.prompts.map(prompt => [prompt.identifier, prompt]));
    return ids.map(id => typeof id === 'string' ? byId.get(id) : undefined)
        .filter((prompt) => !!prompt);
}
/** Prompt identities and fallback names have the same meaning in controls and their UI. */
export function communityPresetConfiguredPromptV1(preset, declaration) {
    return preset.prompts.find(prompt => prompt.identifier === declaration.stableId)
        ?? preset.prompts.find(prompt => Array.isArray(declaration.nameFallbacks) && declaration.nameFallbacks.includes(prompt.name));
}
/** The existing parameter writer replaces one balanced setvar body without evaluating macros. */
export function communityPresetParameterSpanV1(content, key) {
    const opener = `{{setvar::${key}::`, start = content.indexOf(opener);
    if (start < 0)
        return undefined;
    const valueStart = start + opener.length;
    let end = valueStart, nesting = 1;
    while (end < content.length && nesting) {
        if (content.startsWith('{{', end)) {
            nesting++;
            end += 2;
        }
        else if (content.startsWith('}}', end)) {
            nesting--;
            end += 2;
        }
        else
            end++;
    }
    return { start, valueStart, end, valueEnd: nesting ? end : end - 2 };
}
/** Drafts stay in the panel. Committed parameter text belongs to its actual target prompt. */
export function communityPresetParameterValueV1(preset, option, variable) {
    const configuration = preset.profile.configuration[preset.profile.id], registry = configuration && typeof configuration === 'object' && !Array.isArray(configuration)
        && Array.isArray(configuration.configurablePrompts) ? configuration.configurablePrompts : [], declaration = registry.find(item => item && typeof item === 'object' && !Array.isArray(item) && item.key === option.id), prompt = communityPresetConfiguredPromptV1(preset, declaration && typeof declaration === 'object' && !Array.isArray(declaration)
        ? declaration : option.raw);
    if (prompt) {
        if (variable.wholeContent === true)
            return prompt.content;
        const key = String(variable.variable ?? variable.id ?? variable.name ?? variable.key ?? ''), span = communityPresetParameterSpanV1(prompt.content, key);
        if (span)
            return prompt.content.slice(span.valueStart, span.valueEnd);
    }
    return variable.default;
}
/** Old rows derive their first answer set from published prompts and declared defaults. */
export function communityPresetControlStateV1(preset) {
    if (preset.profile.controlAnswers)
        return preset.profile.controlAnswers;
    const answers = Object.create(null);
    for (const group of preset.profile.groups)
        for (const option of group.options) {
            if (option.type === 'parameters') {
                const variables = Array.isArray(option.raw.variables) ? option.raw.variables : [];
                for (const variable of variables)
                    if (variable && typeof variable === 'object' && !Array.isArray(variable)) {
                        const key = String(variable.name ?? variable.key ?? ''), value = communityPresetParameterValueV1(preset, option, variable);
                        if (value !== undefined)
                            answers[key] = value;
                    }
                continue;
            }
            const targets = option.type === 'between' ? communityBetweenOptions(preset, option)
                : preset.prompts.filter(prompt => option.enable.includes(prompt.identifier) || option.enable.includes(prompt.name));
            if (option.id === 'none') {
                answers[option.id] = !preset.prompts.some(prompt => group.disableGroup.includes(prompt.identifier) && prompt.enabled);
            }
            else if (!targets.length)
                answers[option.id] = option.raw.default === true;
            else if (option.type === 'between')
                answers[option.id] = targets.some(prompt => prompt.enabled);
            else
                answers[option.id] = targets.every(prompt => prompt.enabled);
        }
    return answers;
}
/** Reader's selected history page and its live projection cache share a window. */
export const COMMUNITY_READER_WINDOW_MESSAGES = 500;
