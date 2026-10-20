// Generated from runtime/alpha3/src/core/community-preset-profiles.ts; edit the TypeScript source.
import { extractCommunityStatic } from './community-preset-static.js';
const obj = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value) => Array.isArray(value) ? value : [];
const str = (value, fallback = '') => typeof value === 'string' ? value : fallback;
const strings = (value) => list(value).filter((v) => typeof v === 'string');
function controlGroups(value) {
    return list(value).map(item => {
        const raw = obj(item);
        const options = list(raw.options).map((item, index) => {
            const raw = obj(item), match = obj(raw.match);
            return {
                id: str(raw.id, `option-${index + 1}`), label: str(raw.label), type: str(raw.type, 'toggle'),
                enable: strings(raw.enable), disable: strings(raw.disable),
                ...(raw.variable_id ? { variableId: str(raw.variable_id) } : {}),
                ...(raw.match ? { match: { below: str(match.below), above: str(match.above) } } : {}), raw,
            };
        });
        return { id: str(raw.id), label: str(raw.label), mode: raw.mode === 'multiple' ? 'multiple' : 'single', options,
            enableGroup: strings(raw.enable_group), disableGroup: strings(raw.disable_group), raw };
    });
}
function inertConfiguration(value) {
    if (Array.isArray(value))
        return value.map(inertConfiguration);
    if (!value || typeof value !== 'object')
        return value;
    const codeKeys = new Set(['code', 'script', 'squashed_post_script', 'actionBody', 'formatMessageBody']);
    return Object.fromEntries(Object.entries(value).filter(([key]) => !codeKeys.has(key)).map(([key, item]) => [key, inertConfiguration(item)]));
}
function keminiConfiguration(source) {
    const extracted = extractCommunityStatic(source, [
        'STYLE_STRONG_SUBJECTIVE', 'DATA_BLOCK_END', 'SUMMARY', 'configurablePrompts', 'configurableRegexes',
        'extraToggleKeys', 'transportControlAnchor', 'identity',
    ]);
    const extras = strings(extracted.extraToggleKeys);
    // These two author table generators have a fixed, declarative meaning. Translate
    // only those exact forms; arbitrary map callbacks remain unrecognized source.
    const prepared = source.replace(/\.\.\.extraToggleKeys\.map\(\s*\(key\)\s*=>\s*\(\{\s*type:\s*"setPromptEnabled",\s*promptId:\s*key,\s*enabled:\s*false\s*\}\)\s*\)/g, extras.map(key => JSON.stringify({ type: 'setPromptEnabled', promptId: key, enabled: false })).join(',')).replace(/\.\.\.extraToggleKeys\.map\(\s*\(key\)\s*=>\s*\(\{\s*id:\s*`extra-\$\{key\}`,\s*when:\s*\{\s*extras:\s*key\s*\},\s*actions:\s*\[\{\s*type:\s*"setPromptEnabled",\s*promptId:\s*key,\s*enabled:\s*true\s*\}\]\s*\}\)\s*\)/g, extras.map(key => JSON.stringify({ id: `extra-${key}`, when: { extras: key }, actions: [{ type: 'setPromptEnabled', promptId: key, enabled: true }] })).join(',')).replace(/\(answers\)\s*=>\s*hasText\(answers(?:\["([\w]+)"\]|\.([\w]+))\)/g, (_match, bracket, dot) => JSON.stringify({ hasText: bracket ?? dot }));
    const rules = extractCommunityStatic(prepared, ['configurationRules'], extracted).configurationRules ?? [];
    return {
        configurablePrompts: extracted.configurablePrompts ?? [], configurableRegexes: extracted.configurableRegexes ?? [],
        configurationRules: rules, extraToggleKeys: extracted.extraToggleKeys ?? [],
        transportControlAnchor: extracted.transportControlAnchor ?? '<format>', identity: extracted.identity ?? {},
    };
}
function keminiGroups(configuration, prompts) {
    const registered = list(configuration.configurablePrompts).map(obj);
    const registeredByKey = new Map(registered.map(item => [str(item.key), item]));
    const targetId = (item) => prompts.find(prompt => prompt.identifier === item.stableId)?.identifier
        ?? prompts.find(prompt => strings(item.nameFallbacks).includes(prompt.name))?.identifier ?? str(item.stableId);
    const option = (key) => {
        const item = registeredByKey.get(key);
        if (!item)
            return undefined;
        if (item.pending && !prompts.some(prompt => prompt.identifier === item.stableId || strings(item.nameFallbacks).includes(prompt.name)))
            return undefined;
        return { id: key, label: str(item.displayName), type: 'toggle', enable: [targetId(item)], disable: [], raw: item };
    };
    const groups = [];
    for (const [id, label, keys] of [
        ['tradeoff', '思维链模式', ['icotThreePart', 'cotFormatFriendly']],
        ['defense', '空回防护', ['defenseNormal', 'defenseStrong', 'defenseNew']],
        ['style', '文风', ['styleVisualNovel', 'styleLightNovel', 'styleStrongSubjective', 'styleCustom']],
    ]) {
        const options = keys.map(option).filter((value) => value !== undefined);
        const disableGroup = options.flatMap(option => option.enable);
        if (id === 'defense')
            options.unshift({ id: 'none', label: '关闭', type: 'toggle', enable: [], disable: [], raw: {} });
        groups.push({ id, label, mode: 'single', options, enableGroup: [], disableGroup, raw: { required: id !== 'defense' } });
    }
    const extras = strings(configuration.extraToggleKeys);
    const otherKeys = ['nsfwBoost', 'actionOptions', 'bilingualDialogue', 'innerMonologue', 'customStitch', 'customFormatStitch'];
    groups.push({ id: 'extras', label: '独立选项', mode: 'multiple', options: [...extras, ...otherKeys].map(option)
            .filter((value) => value !== undefined), enableGroup: [], disableGroup: [], raw: {} });
    groups.push({ id: 'parameters', label: '提示词参数', mode: 'multiple', options: registered.filter(item => list(item.variables).length > 0)
            .map(item => ({ id: str(item.key), label: str(item.displayName), type: 'parameters', enable: [], disable: [], raw: item })),
        enableGroup: [], disableGroup: [], raw: {} });
    return groups;
}
export function extractCommunityPresetProfile(raw, prompts) {
    const extensions = obj(raw.extensions), helper = obj(extensions.tavern_helper);
    const scripts = list(helper.scripts).map(obj);
    const source = scripts.map(script => str(script.content)).join('\n');
    const spreset = obj(extensions.SPreset);
    const profile = { id: 'standard', version: 1, groups: [], configuration: {}, transport: { kind: 'standard' }, actions: [] };
    if (Object.keys(spreset).length)
        profile.configuration.spreset = inertConfiguration(spreset);
    const dream = scripts.find(script => obj(script.data).chat_history && obj(script.data).entry_processing);
    const dreamControls = scripts.find(script => Array.isArray(obj(script.data).groups));
    if (dream && dreamControls) {
        profile.id = 'dream';
        profile.groups = controlGroups(obj(dreamControls.data).groups);
        profile.configuration.dream = { messageProcessing: obj(dream.data), emptyPlotRecovery: true,
            reasoningExtraction: obj(scripts.find(script => obj(script.data).start_regex)?.data),
            formatCompletion: obj(scripts.find(script => Object.hasOwn(obj(script.data), 'sleep_var_format_append'))?.data) };
        profile.transport = { kind: 'dream', historyRole: 'user', historyMode: 'squash_into_one', entryMode: 'worldbook', emptyPlotRecovery: true };
        for (const id of ['format-completion', 'dream-self-repair', 'extra-summary']) {
            profile.actions.push({ id, status: 'deferred', reason: '额外模型动作保留配置，后续接入；本轮不发起请求' });
        }
    }
    else if (source.includes('configurablePrompts') && source.includes('emit_complete_response_') && source.includes('nameFallbacks')) {
        profile.id = 'kemini';
        const config = keminiConfiguration(source);
        profile.configuration.kemini = config;
        profile.groups = keminiGroups(config, prompts);
        profile.transport = { kind: 'kemini', toolNamePrefix: 'emit_complete_response_', contentType: 'string',
            controlAnchor: config.transportControlAnchor ?? '<format>', preserveClientTools: true, toolChoice: 'auto',
            bypassCallerToolChoices: ['none', 'required', 'forced'], enabled: true };
    }
    else if (source.includes('ZHUYIN_MAP') && source.includes('SENSITIVE_WORDS') && source.includes('izumi_layer')) {
        profile.id = 'izumi';
        const extracted = extractCommunityStatic(source, ['ZHUYIN_MAP', 'SENSITIVE_WORDS', 'DEFAULT_SANITIZER_CONFIG',
            'DIRECT_CONFLICT_GROUPS', 'ADVICE_CONTINUE_TEXT', 'SANITIZER_ZERO_WIDTH_CHAR']);
        profile.configuration.izumi = {
            advice: { enabled: true, continueText: extracted.ADVICE_CONTINUE_TEXT ?? '按照advice继续吧。' },
            sanitizer: { ...obj(extracted.DEFAULT_SANITIZER_CONFIG), enabled: true, replacements: extracted.ZHUYIN_MAP ?? {},
                words: extracted.SENSITIVE_WORDS ?? [], zeroWidthChar: extracted.SANITIZER_ZERO_WIDTH_CHAR ?? '\u200b',
                protectedPattern: '<%[\\s\\S]*%>|\\{\\{[\\s\\S]*?\\}\\}|<(?:UpdateVariable|JSONPatch|mvu|stat_data|delta_data|variables?)\\b[^>]*>[\\s\\S]*?<\\/(?:UpdateVariable|JSONPatch|mvu|stat_data|delta_data|variables?)\\s*>',
                protectedFlags: 'gi', exemptNames: ['小此'] },
            conflictGroups: extracted.DIRECT_CONFLICT_GROUPS ?? [],
            sections: { structure: ['plain', 'tail', 'armor'], function: ['plain', 'tucao', 'thinking'], style: ['plain'] },
            tucaoRequired: true,
        };
        profile.transport = { kind: 'izumi', advice: true, sanitizer: true };
        profile.actions.push({ id: 'wordflow', status: 'deferred', reason: '词库推进属于显式用户动作，后续接入' });
    }
    else if (str(obj(spreset.ChatSquash).squashed_post_script).includes('openSoliumbraMessage')
        && Object.values(obj(spreset.ToolBindings)).some(value => str(obj(value).resolvedName) === 'game_content')) {
        profile.id = 'reborn';
        profile.configuration.reborn = { postscript: { enabled: obj(spreset.ChatSquash).squashed_post_script_enable === true,
                independentOfChatSquash: true, noConvertMarker: '<|no-convert|>', prefillThinkingTag: 'prefill_thinking',
                userRoleMarker: '|用户|', assistantRoleMarker: '|小猫之神|', fakeAssistantRole: 'soliumbra', modelRole: 'model' },
            outputPreprocessing: { enabled: obj(spreset.OutputPreprocessing).enabled === true, headerLabels: ['finishReason:', 'finishMessage:'] } };
        const toolBindings = obj(spreset.ToolBindings);
        const binding = Object.entries(toolBindings).find(([, value]) => str(obj(value).resolvedName) === 'game_content');
        const prompt = binding ? prompts.find(prompt => prompt.identifier === binding[0]) : undefined;
        profile.transport = { kind: 'reborn', toolName: 'game_content', contentType: 'string',
            promptIdentifier: binding?.[0] ?? '', enabled: prompt?.enabled ?? false, modelCondition: '!防截断',
            postscriptIndependent: true, consumeToolCalls: obj(spreset.OutputPreprocessing).consumeToolCalls === true };
    }
    else {
        const extra = extractCommunityStatic(source, ['EXTRA_PARAMS', 'TARGET_MODEL']);
        if (extra.EXTRA_PARAMS)
            profile.configuration.extraParameters = { value: extra.EXTRA_PARAMS,
                enabled: scripts.some(script => script.enabled === true && str(script.content).includes('EXTRA_PARAMS')),
                targetModel: extra.TARGET_MODEL ?? '' };
    }
    return profile;
}
