// Generated from runtime/alpha3/src/core/community-preset-controls.ts; edit the TypeScript source.
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === 'string' ? value : '';
const strings = (value) => list(value).filter((value) => typeof value === 'string');
function matchesBoundary(name, pattern) {
    const literal = /^\/([\s\S]*)\/([a-z]*)$/.exec(pattern);
    try {
        return new RegExp(literal?.[1] ?? pattern, (literal?.[2] ?? '').replace(/[gy]/g, '')).test(name);
    }
    catch {
        return false;
    }
}
/** One range interpretation is shared by native controls and their editor. */
export function communityBetweenOptions(preset, option) {
    if (!option.match)
        return [];
    const byId = new Map(preset.prompts.map(prompt => [prompt.identifier, prompt]));
    const prompts = preset.promptOrder.length ? preset.promptOrder.map(row => byId.get(row.identifier))
        .filter((prompt) => !!prompt) : preset.prompts;
    const below = prompts.findIndex(prompt => matchesBoundary(prompt.name, option.match.below));
    if (below < 0)
        return [];
    const above = prompts.findIndex((prompt, index) => index > below && matchesBoundary(prompt.name, option.match.above));
    return above < 0 ? [] : prompts.slice(below + 1, above).filter(prompt => !prompt.marker && !prompt.configurationOnly);
}
export function applyCommunityPresetControl(preset, request) {
    const next = structuredClone(preset), group = next.profile.groups.find(group => group.id === request.groupId);
    if (!group)
        throw Error('功能组不存在');
    const option = group.options.find(option => option.id === request.optionId);
    if (!option)
        throw Error('功能选项不存在');
    if (!next.promptOrder.length)
        next.promptOrder = next.prompts.map(prompt => ({ identifier: prompt.identifier, enabled: prompt.enabled }));
    const writes = [], unresolved = [];
    const resolve = (key) => next.prompts.filter(prompt => prompt.identifier === key || prompt.name === key);
    const toggle = (key, enabled) => {
        const prompts = resolve(key);
        if (!prompts.length) {
            unresolved.push(key);
            return;
        }
        for (const prompt of prompts) {
            prompt.enabled = enabled;
            const row = next.promptOrder.find(row => row.identifier === prompt.identifier);
            if (row)
                row.enabled = enabled;
            else if (enabled) {
                next.promptOrder.push({ identifier: prompt.identifier, enabled });
                prompt.unused = false;
            }
        }
    };
    const enable = (keys, enabled) => keys.forEach(key => toggle(key, enabled));
    const optionTargets = (item) => {
        if (item.type !== 'between')
            return item.enable;
        return communityBetweenOptions(next, item).map(prompt => prompt.identifier);
    };
    if (group.mode === 'single' && request.enabled) {
        enable(group.disableGroup, false);
        enable(group.enableGroup, true);
        for (const other of group.options)
            enable(optionTargets(other), false);
    }
    if (option.type === 'between') {
        const selected = typeof request.value === 'string' ? request.value : '';
        if (!optionTargets(option).includes(selected))
            throw Error('所选条目不在该功能组范围内');
        toggle(selected, request.enabled);
    }
    else if (option.type === 'var_input' || option.type === 'global_var_input') {
        writes.push({ scope: option.type === 'global_var_input' ? 'global' : 'chat', key: option.variableId ?? option.id,
            operation: 'set', value: request.value ?? '' });
        enable(option.enable, request.enabled);
        if (request.enabled)
            enable(option.disable, false);
    }
    else {
        enable(option.enable, request.enabled);
        if (request.enabled)
            enable(option.disable, false);
    }
    if (next.profile.id === 'kemini') {
        const config = object(next.profile.configuration.kemini), registry = list(config.configurablePrompts).map(object);
        const answers = { ...request.answers, ...object(request.value) };
        if (option.type !== 'parameters')
            answers[option.id] = request.enabled;
        const findRegistered = (key) => registry.find(item => item.key === key);
        const findPrompt = (item) => {
            let prompt = next.prompts.find(prompt => prompt.identifier === item.stableId);
            if (!prompt)
                prompt = next.prompts.find(prompt => strings(item.nameFallbacks).includes(prompt.name));
            return prompt;
        };
        const createPrompt = (item) => {
            let prompt = findPrompt(item);
            if (prompt)
                return prompt;
            const creation = object(item.createFrom), reference = findPrompt(object(creation.template));
            if (!reference)
                return undefined;
            const name = text(creation.name) || text(item.displayName) || text(item.key);
            const content = typeof creation.initialContent === 'string' ? creation.initialContent : reference.content;
            prompt = { ...structuredClone(reference), identifier: text(item.stableId) || `custom-${text(item.key)}`,
                name, content, enabled: true, unused: false };
            prompt.raw = { ...prompt.raw, identifier: prompt.identifier, name, content };
            next.prompts.push(prompt);
            const before = findPrompt(object(creation.insertBefore)), after = findPrompt(object(creation.insertAfter));
            const anchor = before ?? after ?? reference, position = next.promptOrder.findIndex(row => row.identifier === anchor.identifier);
            next.promptOrder.splice(position < 0 ? next.promptOrder.length : position + (before ? 0 : 1), 0, { identifier: prompt.identifier, enabled: true });
            return prompt;
        };
        const setRegistered = (key, enabled) => {
            const item = findRegistered(key);
            if (!item) {
                toggle(key, enabled);
                return;
            }
            const prompt = findPrompt(item) ?? (enabled ? createPrompt(item) : undefined);
            if (prompt)
                toggle(prompt.identifier, enabled);
            else
                unresolved.push(text(item.stableId) || key);
        };
        const predicate = (when) => Object.entries(when).every(([key, expected]) => {
            if (key === 'hasText')
                return String(answers[text(expected)] ?? '').trim() !== '';
            const actual = answers[key];
            return Array.isArray(expected) ? expected.includes(actual ?? null) : actual === expected;
        });
        for (const rule of list(config.configurationRules).map(object)) {
            if (!predicate(object(rule.when)))
                continue;
            for (const action of list(rule.actions).map(object)) {
                if (action.type === 'setPromptEnabled')
                    setRegistered(text(action.promptId), action.enabled === true);
                else if (action.type === 'setRegexEnabled') {
                    const item = list(config.configurableRegexes).map(object).find(item => item.key === action.regexId);
                    for (const regex of next.regexes)
                        if (regex.id === item?.stableId || strings(item?.nameFallbacks).includes(regex.scriptName))
                            regex.disabled = action.enabled !== true;
                }
            }
        }
        for (const item of registry)
            for (const variable of list(item.variables).map(object)) {
                const key = text(variable.name) || text(variable.key);
                if (!Object.hasOwn(answers, key))
                    continue;
                const prompt = findPrompt(item) ?? createPrompt(item);
                const value = String(answers[key] ?? '');
                if (!prompt)
                    throw Error(`提示词参数无法定位条目或创建模板：${text(item.displayName) || text(item.key)}`);
                if (variable.wholeContent === true) {
                    prompt.content = value;
                    continue;
                }
                const macroKey = text(variable.variable) || text(variable.id) || key;
                const opener = `{{setvar::${macroKey}::`, start = prompt.content.indexOf(opener);
                if (start >= 0) {
                    let end = start + opener.length, nesting = 1;
                    while (end < prompt.content.length && nesting) {
                        if (prompt.content.startsWith('{{', end)) {
                            nesting++;
                            end += 2;
                        }
                        else if (prompt.content.startsWith('}}', end)) {
                            nesting--;
                            end += 2;
                        }
                        else
                            end++;
                    }
                    prompt.content = prompt.content.slice(0, start) + opener + value + '}}' + prompt.content.slice(end);
                }
                else
                    prompt.content += `\n${opener}${value}}}`;
            }
    }
    return { preset: next, writes, unresolved: [...new Set(unresolved)] };
}
