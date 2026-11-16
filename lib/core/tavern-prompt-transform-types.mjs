// Generated from runtime/alpha3/src/core/tavern-prompt-transform-types.mts; edit the TypeScript source.
export const TAVERN_PROMPT_TRANSFORM_LIMITS_V1 = Object.freeze({
    entries: 4096, rules: 256, bindings: 4096, inputChars: 8_000_000, outputChars: 2_000_000,
    workChars: 16_000_000, jobs: 1_000_000, matches: 20_000, patternChars: 4096,
    receipts: 65_536, receiptChars: 8_000_000,
    replacementChars: 65_536, deadlineMs: 250, concurrentWorkers: 4,
});
export const TAVERN_PROMPT_CARD_ORDER_V1 = Object.freeze(['charPrompt', 'charJailbreak', 'charInstruction',
    'description', 'personality', 'scenario', 'persona', 'mesExamples', 'mesExamplesRaw', 'charVersion',
    'char_version', 'charDepthPrompt', 'creatorNotes']);
export const TAVERN_PROMPT_POST_ORDER_V1 = Object.freeze(['maxPrompt', 'maxPromptTokens', 'maxContext',
    'maxContextTokens', 'maxResponse', 'maxResponseTokens', 'lastMessage', 'lastMessageId', 'lastUserMessage',
    'lastCharMessage', 'firstIncludedMessageId', 'firstDisplayedMessageId', 'lastSwipeId', 'currentSwipeId',
    'allChatRange', 'time', 'date', 'weekday', 'isotime', 'isodate', 'idle_duration']);
export const TAVERN_PROMPT_INSTRUCT_ORDER_V1 = Object.freeze(['instructStoryStringPrefix', 'instructStoryStringSuffix',
    'instructInput|instructUserPrefix', 'instructUserSuffix', 'instructOutput|instructAssistantPrefix',
    'instructSeparator|instructAssistantSuffix', 'instructSystemPrefix', 'instructSystemSuffix',
    'instructFirstOutput|instructFirstAssistantPrefix', 'instructLastOutput|instructLastAssistantPrefix',
    'instructStop', 'instructUserFiller', 'instructSystemInstructionPrefix', 'instructFirstInput|instructFirstUserPrefix',
    'instructLastInput|instructLastUserPrefix', 'systemPrompt', 'defaultSystemPrompt|instructSystem|instructSystemPrompt',
    'chatSeparator', 'chatStart']);
export const TAVERN_PROMPT_HELPER_VARIABLE_SCOPES_V1 = Object.freeze([
    'message', 'chat', 'character', 'preset', 'global',
]);
export const TAVERN_PROMPT_TRANSFORM_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'owned-st-legacy-prompt-transform-policy-v1', upstreamCommit: '06bde939fb1e9c4c8d8641d810f0a916b5bce127',
    unit: 'utf16-code-units', limits: TAVERN_PROMPT_TRANSFORM_LIMITS_V1, macroEngine: 'legacy-frozen-read-only',
    random: 'captured-attempt-sha256-stream; pick-chat-content-offset; no-ambient-entropy',
    scriptOrder: Object.freeze(['global', 'preset', 'scoped']), capture: 'st-callback-full-numeric-and-named-trim-macro',
    unknown: 'selected-refusal-catalog-deferred', outlet: 'explicit-read-only-macro-consumption',
    messageHelpers: Object.freeze({ upstreamCommit: '519599bc68247d8e759cc844a983f8f5252941a8',
        scopes: TAVERN_PROMPT_HELPER_VARIABLE_SCOPES_V1,
        macros: Object.freeze(['get_message_variable', 'format_message_variable', 'get_chat_variable', 'format_chat_variable',
            'get_character_variable', 'format_character_variable', 'get_preset_variable', 'format_preset_variable',
            'get_global_variable', 'format_global_variable']),
        values: 'owned-captured-scopes; path-read; omit-private-subtree',
        format: 'literal-block-YAML; expanded-inline-prefix-indentation' }),
    pipelines: Object.freeze(['macro-only', 'regex-only', 'macro-then-regex', 'regex-then-macro']),
    authority: 'consumer-data-only', additionalModelRequests: Object.freeze({ normal: 0, retry: 0, fallback: 0 }),
});
