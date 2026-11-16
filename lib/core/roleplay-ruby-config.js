// Generated from runtime/alpha3/src/core/roleplay-ruby-config.ts; edit the TypeScript source.
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value : {};
const text = (value) => String(value || '');
const strings = (value) => Array.isArray(value) ? value.map(String) : [];
const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const issue = (code, sourcePath) => ({ code, sourcePath });
// Only the upstream lookup metadata is known. The built-in body has no
// redistribution grant, so a real author-owned book must supply its content.
export const RUBY_BUILTIN_REFERENCES_V1 = Object.freeze([
    Object.freeze({ entryKey: '约束库', varName: 'constraintLibrary', label: '约束库' }),
]);
export function rubyCyclePositionsV1(raw) {
    const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') :
        Number.isFinite(Number(raw)) ? [Number(raw)] : [];
    return [...new Set(values.map(value => parseInt(String(value), 10))
            .filter(value => Number.isFinite(value) && value > 0))].sort((a, b) => a - b);
}
export function rubyMessageItemsV1(raw) {
    return (Array.isArray(raw) ? raw : []).map((value, index) => {
        const row = object(value), position = row.position, role = row.role;
        return { id: text(row.id) || `custom_${index}`, enabled: row.enabled !== false,
            position: position === 'afterUser' || position === 'tail' ? position : 'beforeUser',
            role: role === 'assistant' || role === 'user' ? role : 'system', content: text(row.content) };
    });
}
function taskData(raw, index, root) {
    const row = object(raw), id = Number(row.id) || 0, sourcePath = `${root}/tasks/${index}`, cyclePositions = rubyCyclePositionsV1(row.cyclePositions ?? row.cyclePosition ?? row.triggerFloor), keywords = Array.isArray(row.keywordScanKeywords) ? row.keywordScanKeywords :
        typeof row.keywordScanKeywords === 'string' ? row.keywordScanKeywords.split(',') : [];
    return { id, taskKey: `task_${id}`, sourcePath, enabled: row.enabled !== false,
        displayName: text(row.displayName) || `任务#${row.id || '?'}`, cyclePositions,
        promptKey: text(row.promptKey), outputKey: text(row.outputKey), outputVarName: text(row.outputVarName) || `task_${row.id || 0}_Output`,
        extraKeys: text(row.extraKeys), enableJailbreak: row.enableJailbreak !== false,
        outputConstant: !!row.outputConstant, outputDisable: !!row.outputDisable, selective: !!row.selective,
        selectiveKeysEnabled: !!row.selectiveKeysEnabled,
        selectiveKeys: row.selectiveKeysEnabled && Array.isArray(row.selectiveKeys)
            ? row.selectiveKeys.map(value => String(value ?? '').trim()).filter(Boolean) : [], noRecursion: !!row.noRecursion,
        position: number(row.position, 0), depth: number(row.depth, 4), order: number(row.order, 100),
        keywordScanEnabled: !!row.keywordScanEnabled,
        keywordScanKeywords: keywords.map(value => String(value).trim()).filter(Boolean),
        useReferences: strings(row.useReferences), useOutputs: strings(row.useOutputs), issues: [] };
}
function startupData(raw, root) {
    // Config merges [1,2] only when fields are absent; scheduler then falls
    // through an explicit empty cyclePositions to triggerFloors, or finally [1].
    const row = object(raw), normalized = rubyCyclePositionsV1(row.cyclePositions ?? row.triggerFloors ?? [1, 2]), cyclePositions = normalized.length ? normalized : row.triggerFloors === undefined ? [1, 2] :
        Array.isArray(row.triggerFloors) && row.triggerFloors.length ? row.triggerFloors.map(Number) : [1];
    return { ...taskData(row, 0, root), id: 0, taskKey: 'startup', sourcePath: `${root}/startupTask`,
        enabled: !!row.enabled, displayName: text(row.displayName) || '开局分析', cyclePositions,
        outputVarName: text(row.outputVarName) || 'startupOutput' };
}
const TEMPERATURE_RULE = { min: 0, max: 2 };
const MAX_TOKENS_RULE = { min: 1, max: Infinity };
const GENERATION_NUMBER_RULES = [
    ['top_p', 'topP', { min: 0, max: 1, exclusiveMin: true }],
    ['top_k', 'topK', { min: 1, max: 1000 }],
    ['presence_penalty', 'presencePenalty', { min: -2, max: 2 }],
    ['frequency_penalty', 'frequencyPenalty', { min: -2, max: 2 }],
];
function generationNumber(value, rule) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < rule.min || parsed > rule.max)
        return undefined;
    if (rule.exclusiveMin && parsed <= rule.min)
        return undefined;
    return parsed;
}
/** Normalizes upstream `gen` rules from RUBY/src/config.js sanitizeGenParams and ai.js:
 * only `enabled === true` applies. Invalid values are dropped and valid controls
 * reach Native, whose exact model/adapter owns route support. */
function readGenerationOptions(rawGen, genPath, issues) {
    const gen = object(rawGen);
    if (gen.enabled !== true)
        return undefined;
    const temperature = generationNumber(gen.temperature, TEMPERATURE_RULE);
    const rawMaxTokens = generationNumber(gen.max_tokens, MAX_TOKENS_RULE);
    let maxTokens;
    if (rawMaxTokens !== undefined) {
        if (Number.isSafeInteger(rawMaxTokens))
            maxTokens = rawMaxTokens;
        else
            issues.push(issue('RUBY_GENERATION_OPTION_UNSUPPORTED', `${genPath}/max_tokens`));
    }
    const options = {
        ...(temperature !== undefined ? { temperature } : {}),
        ...(maxTokens !== undefined ? { maxTokens } : {}),
    };
    for (const [field, target, rule] of GENERATION_NUMBER_RULES) {
        const value = generationNumber(gen[field], rule);
        if (value !== undefined)
            options[target] = value;
    }
    const effort = String(gen.reasoning_effort);
    if (effort === 'low' || effort === 'medium' || effort === 'high')
        options.reasoningEffort = effort;
    return Object.keys(options).length ? options : undefined;
}
export function readRubyConfigurationV1(raw, source) {
    const data = object(raw), presets = Array.isArray(data.presets) ? data.presets : [], requested = text(data.activePresetId), selected = presets.findIndex(value => text(object(value).id) === requested), index = selected >= 0 ? selected : 0, preset = object(presets[index]), root = `${source.sourcePath}/presets/${index}`, tasks = [startupData(preset.startupTask, root),
        ...(Array.isArray(preset.tasks) ? preset.tasks : []).map((value, ordinal) => taskData(value, ordinal, root))], enabled = tasks.filter(task => task.enabled), issues = [], summaryProvider = text(data.summaryProvider);
    const hasProducer = enabled.length > 0 || !!object(preset.director).enabled;
    let generation;
    if (hasProducer) {
        if (object(preset.director).enabled)
            issues.push(issue('RUBY_DIRECTOR_EXECUTION_UNSUPPORTED', root + '/director'));
        generation = readGenerationOptions(data.gen, source.sourcePath + '/gen', issues);
    }
    const messageRows = object(data.jailbreak).items, messageItems = Array.isArray(messageRows) && messageRows.length ? rubyMessageItemsV1(messageRows) : null;
    if (hasProducer && !messageItems)
        issues.push(issue('RUBY_DEFAULT_MESSAGES_UNAVAILABLE', source.sourcePath + '/jailbreak'));
    const referencePool = (Array.isArray(preset.referencePool) ? preset.referencePool : []).map(value => {
        const row = object(value);
        return { entryKey: text(row.entryKey), varName: text(row.varName), label: text(row.label || row.entryKey || row.varName) };
    }).filter(row => row.entryKey && row.varName);
    const cycleLength = enabled.reduce((maximum, task) => Math.max(maximum, ...task.cyclePositions), 0);
    return { schemaVersion: 1, encoding: 'ruby-static-configuration-data-v1', source,
        status: issues.length ? 'unsupported' : !hasProducer ? 'empty' : 'supported-static', activePresetId: text(preset.id),
        charName: text(data.charName), summaryProvider,
        summaryProviderStatus: ['littlewhitebox', 'shujuku', 'yuzuki', 'baibaibook'].includes(summaryProvider)
            ? 'unavailable-raw-text' : 'disabled', customContentTags: Array.isArray(data.customContentTags)
            ? data.customContentTags.filter((value) => typeof value === 'string' && !!value.trim()) : [],
        referencePool, tasks, messageItems, cycleLength, ...(generation ? { generation } : {}), issues, requestsPerEligibleTask: 1 };
}
