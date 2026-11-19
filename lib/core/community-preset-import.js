// Generated from runtime/alpha3/src/core/community-preset-import.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { extractCommunityPresetProfile } from './community-preset-profiles.js';
import { annotateCommunityIzumiPrompts } from './community-preset-plans.js';
import { COMMUNITY_PRESET_DEFAULT_SETTINGS_V1 as defaultSettings } from './community-preset-types.js';
export { communityDefaultPresetDataV1 } from './community-preset-types.js';
export const COMMUNITY_PRESET_MARKERS = [
    'worldInfoBefore', 'worldInfoAfter', 'charDescription', 'charPersonality',
    'scenario', 'personaDescription', 'dialogueExamples', 'chatHistory',
];
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value, fallback) => typeof value === 'number' ? value : fallback;
export function normalizeCommunityRegexes(value) {
    const rules = Array.isArray(value) ? value : [value];
    return rules.filter(item => item && typeof item === 'object').map((item, index) => {
        const values = record(item), raw = Object.hasOwn(values, 'raw') ? record(values.raw) : values;
        const placement = Array.isArray(values.placement) ? values.placement : String(values.placement ?? '').split(/[\s,]+/).filter(Boolean);
        const trims = Array.isArray(values.trimStrings) ? values.trimStrings : [values.trimStrings];
        return {
            id: text(values.id, `regex-${index + 1}`), scriptName: text(values.scriptName ?? values.script_name ?? values.name, `Regex ${index + 1}`),
            findRegex: text(values.findRegex ?? values.find_regex), replaceString: text(values.replaceString ?? values.replace_string),
            trimStrings: trims.filter((v) => typeof v === 'string' && v !== ''),
            placement: placement.map(Number), disabled: values.disabled === true || values.enabled === false,
            markdownOnly: values.markdownOnly === true, promptOnly: values.promptOnly === true, runOnEdit: values.runOnEdit === true,
            substituteRegex: number(values.substituteRegex, 0), minDepth: typeof values.minDepth === 'number' ? values.minDepth : null,
            maxDepth: typeof values.maxDepth === 'number' ? values.maxDepth : null, raw,
        };
    });
}
/** Fixed TavernHelper DTO projection of the original library rule, before
 * execution adds its origin-specific identity or filters active placements. */
export function communityTavernRegexDto(row) {
    return { id: row.id, script_name: row.scriptName, enabled: !row.disabled,
        find_regex: row.findRegex, trim_strings: [...row.trimStrings], replace_string: row.replaceString,
        source: { user_input: row.placement.includes(1), ai_output: row.placement.includes(2),
            slash_command: row.placement.includes(3), world_info: row.placement.includes(5), reasoning: row.placement.includes(6) },
        destination: { display: row.markdownOnly, prompt: row.promptOnly }, run_on_edit: row.runOnEdit,
        min_depth: row.minDepth, max_depth: row.maxDepth };
}
export function communityTavernRegexRawV1({ raw, ...rule }) {
    return { ...structuredClone(raw), ...structuredClone(rule) };
}
/** The management DTO has five explicit sources and two destination flags. */
export function communityRegexesFromTavernDto(value) {
    return normalizeCommunityRegexes(value.map(rule => {
        const source = record(rule.source), destination = record(rule.destination);
        return { id: rule.id, scriptName: rule.script_name, disabled: rule.enabled === false,
            findRegex: rule.find_regex, replaceString: rule.replace_string, trimStrings: rule.trim_strings,
            placement: [[1, 'user_input'], [2, 'ai_output'], [3, 'slash_command'], [5, 'world_info'], [6, 'reasoning']]
                .filter(([, name]) => source[String(name)] === true).map(([placement]) => placement),
            markdownOnly: destination.display === true, promptOnly: destination.prompt === true,
            runOnEdit: rule.run_on_edit === true, substituteRegex: 0, minDepth: rule.min_depth, maxDepth: rule.max_depth };
    }));
}
const systemPrompts = new Set(['main', 'nsfw', 'jailbreak', 'enhanceDefinitions']);
export const isCommunityPresetSystemPrompt = (prompt) => systemPrompts.has(prompt.id);
export const isCommunityPresetPlaceholderPrompt = (prompt) => COMMUNITY_PRESET_MARKERS.includes(prompt.id);
export const isCommunityPresetNormalPrompt = (prompt) => !isCommunityPresetSystemPrompt(prompt) && !isCommunityPresetPlaceholderPrompt(prompt);
const settingFields = {
    max_context: 'openai_max_context', max_completion_tokens: 'openai_max_tokens', reply_count: 'n', should_stream: 'stream_openai',
    temperature: 'temperature', frequency_penalty: 'frequency_penalty', presence_penalty: 'presence_penalty',
    repetition_penalty: 'repetition_penalty', top_p: 'top_p', min_p: 'min_p', top_k: 'top_k', top_a: 'top_a', seed: 'seed',
    squash_system_messages: 'squash_system_messages', reasoning_effort: 'reasoning_effort', request_thoughts: 'show_thoughts',
    request_images: 'request_images', enable_function_calling: 'function_calling', enable_web_search: 'enable_web_search',
    allow_sending_videos: 'video_inlining', wrap_user_messages_in_quotes: 'wrap_in_quotes',
};
const runtimeSettings = { temperature: 'temp_openai', frequency_penalty: 'freq_pen_openai',
    presence_penalty: 'pres_pen_openai', repetition_penalty: 'repetition_penalty_openai', top_p: 'top_p_openai',
    min_p: 'min_p_openai', top_k: 'top_k_openai', top_a: 'top_a_openai' };
const parameterFields = new Set([...Object.values(settingFields), ...Object.values(runtimeSettings),
    'max_context_unlocked', 'image_inlining', 'inline_image_quality', 'names_behavior']);
export function communityPresetExtensionsV1(preset) {
    const extensions = preset.extensions ?? record(preset.source.raw.extensions), native = record(extensions.nexttavern);
    if (record(native.profileConfiguration).kind === 'module') {
        const { controlAnswers: _initial, ...declaration } = record(native.profileConfiguration);
        return { ...extensions, nexttavern: { ...native, profileConfiguration: { ...declaration,
                    ...preset.profile.controlAnswers !== undefined ? { controlAnswers: preset.profile.controlAnswers } : {} } } };
    }
    if (preset.profile.id === 'standard' && !preset.profile.groups.length && !preset.profile.actions.length
        && !Object.keys(preset.profile.configuration).length && preset.profile.transport.kind === 'standard'
        && Object.keys(preset.profile.transport).length === 1)
        return extensions;
    return { ...extensions, nexttavern: { ...native, profile: preset.profile.id, profileConfiguration: { schemaVersion: 1, kind: 'data',
                value: structuredClone(preset.profile) } } };
}
export function communityPresetHelperVariablesV1(preset) {
    return record(record((preset.extensions ?? record(preset.source.raw.extensions)).tavern_helper).variables);
}
export function communityPresetDataV1(preset) {
    const settings = { ...structuredClone(defaultSettings),
        ...Object.fromEntries(Object.entries(preset.parameters).filter(([key]) => !parameterFields.has(key))) }, prompt = (row) => ({ id: row.identifier, name: row.name,
        enabled: row.enabled, role: row.role, ...!systemPrompts.has(row.identifier) ? { position: row.injectionPosition === 1
                ? { type: 'in_chat', depth: row.injectionDepth, order: row.injectionOrder } : { type: 'relative' } } : {},
        ...!row.marker ? { content: row.content } : {}, ...row.raw.extra ? { extra: structuredClone(record(row.raw.extra)) } : {} });
    for (const [key, field] of Object.entries(settingFields)) {
        const value = preset.parameters[field] ?? preset.parameters[runtimeSettings[key] ?? ''];
        if (value !== undefined)
            settings[key] = structuredClone(value);
    }
    if (preset.parameters.image_inlining !== undefined)
        settings.allow_sending_images = preset.parameters.image_inlining === false
            ? 'disabled' : preset.parameters.inline_image_quality ?? 'auto';
    if (preset.parameters.names_behavior !== undefined)
        settings.character_name_prefix =
            { '-1': 'none', '0': 'default', '2': 'content', '1': 'completion' }[String(preset.parameters.names_behavior)] ?? 'none';
    const byId = new Map(preset.prompts.map(row => [row.identifier, row])), ordered = preset.promptOrder.length ? preset.promptOrder.flatMap(row => {
        const value = byId.get(row.identifier);
        return value ? [value] : [];
    }) : preset.prompts.filter(row => !row.unused), extensions = structuredClone(communityPresetExtensionsV1(preset));
    extensions.regex_scripts = preset.regexes.map(communityTavernRegexDto);
    return { settings, prompts: ordered.map(prompt), prompts_unused: preset.prompts.filter(row => row.unused).map(prompt), extensions };
}
export function normalizeCommunityPresetDataV1(value, assignId) {
    if (!value || !Array.isArray(value.prompts) || !Array.isArray(value.prompts_unused))
        throw Error('PRESET_PROMPTS_REQUIRED');
    const used = new Set(), prompts = (rows, collection) => rows.map((row, index) => {
        let id = text(row.id);
        if (!id || used.has(id)) {
            if (id && !isCommunityPresetNormalPrompt({ id }))
                throw Error('PRESET_DUPLICATE_SYSTEM_PROMPT');
            id = assignId(`${collection}/${index}`);
        }
        used.add(id);
        const placeholder = isCommunityPresetPlaceholderPrompt({ id }), system = isCommunityPresetSystemPrompt({ id });
        return { id, name: text(row.name, id), enabled: row.enabled !== false,
            role: row.role === 'assistant' || row.role === 'user' ? row.role : 'system',
            ...!system ? { position: row.position?.type === 'in_chat'
                    ? { type: 'in_chat', depth: row.position.depth, order: row.position.order } : { type: 'relative' } } : {},
            ...!placeholder ? { content: text(row.content) } : {}, ...row.extra ? { extra: structuredClone(record(row.extra)) } : {} };
    }), active = prompts(value.prompts, 'prompts'), unused = prompts(value.prompts_unused, 'prompts_unused');
    return { settings: { ...structuredClone(defaultSettings), ...structuredClone(record(value.settings)) },
        prompts: active, prompts_unused: unused, extensions: structuredClone(record(value.extensions)) };
}
export function communityPresetFromDataV1(value, options, assignId, provenance) {
    const data = normalizeCommunityPresetDataV1(value, assignId), parameters = { ...data.settings }, prompt = (row) => ({ identifier: row.id, name: row.name, enabled: row.enabled, role: row.role,
        system_prompt: !isCommunityPresetNormalPrompt(row), marker: isCommunityPresetPlaceholderPrompt(row),
        ...!isCommunityPresetSystemPrompt(row) && !['dialogueExamples', 'chatHistory'].includes(row.id)
            ? { injection_position: row.position?.type === 'in_chat' ? 1 : 0,
                injection_depth: row.position?.type === 'in_chat' ? row.position.depth : 4,
                injection_order: row.position?.type === 'in_chat' ? row.position.order : 100 } : {},
        ...!isCommunityPresetPlaceholderPrompt(row) ? { content: row.content ?? '' } : {}, ...row.extra ? { extra: row.extra } : {}, forbid_overrides: false });
    for (const [key, field] of Object.entries(settingFields)) {
        delete parameters[key];
        parameters[field] = data.settings[key];
    }
    delete parameters.allow_sending_images;
    delete parameters.character_name_prefix;
    parameters.max_context_unlocked = true;
    parameters.image_inlining = data.settings.allow_sending_images !== 'disabled';
    parameters.inline_image_quality = data.settings.allow_sending_images === 'disabled' ? 'auto' : data.settings.allow_sending_images;
    parameters.names_behavior = { none: -1, default: 0, content: 2, completion: 1 }[String(data.settings.character_name_prefix)] ?? -1;
    const extensions = structuredClone(data.extensions), rules = extensions.regex_scripts;
    if (Array.isArray(rules) && record(rules[0]).source)
        extensions.regex_scripts = communityRegexesFromTavernDto(rules.map(record))
            .map(({ raw: _raw, ...rule }) => rule);
    const preset = parseCommunityPreset({ ...parameters, prompts: [...data.prompts, ...data.prompts_unused].map(prompt),
        prompt_order: [{ character_id: 100001, order: data.prompts.map(row => ({ identifier: row.id, enabled: row.enabled })) }], extensions }, options);
    if (provenance)
        preset.source = provenance;
    return { preset, data: communityPresetDataV1(preset) };
}
export function exportCommunityPresetV1(preset) {
    const extensions = structuredClone(communityPresetExtensionsV1(preset)), native = record(extensions.nexttavern), extra = record(preset.profile.configuration.extraParameters);
    extensions.regex_scripts = preset.regexes.map(communityTavernRegexRawV1);
    extensions.nexttavern = { ...native, profile: preset.profile.id,
        ...typeof extra.enabled === 'boolean' ? { extraParameters: extra.enabled } : {} };
    return { ...structuredClone(preset.parameters), prompts: preset.prompts.map(row => ({ ...row.raw,
            identifier: row.identifier, name: row.name, content: row.content, role: row.role, enabled: row.enabled, marker: !!row.marker,
            injection_position: row.injectionPosition, injection_depth: row.injectionDepth, injection_order: row.injectionOrder })),
        prompt_order: [{ character_id: preset.characterId ?? 100001, order: structuredClone(preset.promptOrder) }], extensions };
}
export function parseCommunityPreset(input, options) {
    const raw = record(input);
    if (!Array.isArray(raw.prompts))
        throw Error('社区预设需要 prompts 数组');
    const orders = array(raw.prompt_order).map(record);
    const selected = orders.find(order => Number(order.character_id) === 100001) ?? orders[0];
    const promptOrder = array(selected?.order).map(item => {
        const entry = record(item);
        return { identifier: text(entry.identifier), enabled: entry.enabled !== false };
    });
    const ordered = new Map(promptOrder.map(entry => [entry.identifier, entry]));
    const prompts = raw.prompts.map((item, index) => {
        const p = record(item), identifier = text(p.identifier, `prompt-${index + 1}`), order = ordered.get(identifier);
        return {
            identifier, name: text(p.name, identifier), content: text(p.content),
            role: p.role === 'user' || p.role === 'assistant' ? p.role : 'system', enabled: order?.enabled ?? p.enabled !== false,
            marker: COMMUNITY_PRESET_MARKERS.includes(identifier) ? identifier : null,
            injectionPosition: number(p.injection_position, 0), injectionDepth: number(p.injection_depth, 4),
            injectionOrder: number(p.injection_order, 100), readOnly: p.readOnly === true, hidden: p.spreset_hidden === true,
            configurationOnly: /^spreset(?:[_\s-]|$)/i.test(identifier) || /^SPreset(?:配置|设置|$)/i.test(text(p.name)),
            unused: selected !== undefined && !order, raw: p,
        };
    });
    const extensions = record(raw.extensions), spreset = record(extensions.SPreset);
    const candidates = [
        ['native', extensions.regex_scripts], ['spreset', record(spreset.RegexBinding).regexes],
        ['legacy', raw.regex_scripts ?? extensions.regexes ?? raw.regexes],
    ];
    const chosen = candidates.find(([, value]) => Array.isArray(value));
    const parameters = Object.fromEntries(Object.entries(raw).filter(([key]) => !['prompts', 'prompt_order', 'extensions'].includes(key)));
    const rawText = options.rawText || JSON.stringify(raw);
    const profile = extractCommunityPresetProfile(raw);
    if (profile.transport.kind === 'izumi')
        annotateCommunityIzumiPrompts(prompts, promptOrder);
    return {
        schema: 'community-presets.v1', version: 1, id: options.id, name: options.name,
        source: { fileName: options.fileName ?? '', sha256: createHash('sha256').update(rawText).digest('hex'),
            version: raw.version ?? raw.preset_version ?? null, rawText, raw },
        prompts, promptOrder, characterId: selected ? Number(selected.character_id) : null,
        regexes: chosen ? normalizeCommunityRegexes(chosen[1]) : [], regexSource: chosen?.[0] ?? 'none', parameters,
        extensions: structuredClone(Object.fromEntries(Object.entries(extensions).filter(([key]) => key !== 'regex_scripts'))), profile,
    };
}
