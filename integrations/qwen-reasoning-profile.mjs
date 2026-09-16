// Generated from runtime/alpha3/operations/qwen-reasoning-profile.mts; edit the TypeScript source.
// Explicit deployment profile recipe, not an automatic provider/model detector.
// https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions
// Qwen 3.8: off via enable_thinking=false; low / medium / xhigh via reasoning_effort.
// Do not also send thinking_budget, or apply these capabilities to Kimi.
export function withQwenReasoning(settings) {
    const next = structuredClone(settings);
    const profile = next['llm-pi-ai']?.providers?.qwen;
    if (!profile || profile.api !== 'openai-completions' || !Array.isArray(profile.models))
        throw new Error('Qwen compatible profile missing');
    let count = 0;
    for (const model of profile.models) {
        if (!['qwen3.8-flash', 'qwen3.8-max'].includes(model.id))
            continue;
        const efforts = { off: null, low: 'low', medium: 'medium', xhigh: 'xhigh' };
        if (model.reasoningEfforts !== undefined && JSON.stringify(model.reasoningEfforts) !== JSON.stringify(efforts))
            throw new Error(`${model.id} reasoning already configured; review before replacing`);
        const compat = { ...profile.compat, ...model.compat };
        if (compat.thinkingFormat !== undefined && compat.thinkingFormat !== 'qwen')
            throw new Error(`${model.id} dialect already configured`);
        if (compat.supportsReasoningEffort === false || compat.supportsThinkingTokenBudget === true || profile.thinkingBudgets !== undefined)
            throw new Error(`${model.id} budget already configured`);
        model.reasoningEfforts = efforts;
        model.compat = { ...model.compat, thinkingFormat: 'qwen', supportsReasoningEffort: true, supportsDeveloperRole: false };
        count++;
    }
    if (!count)
        throw new Error('Qwen 3.8 models missing');
    return next;
}
