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
