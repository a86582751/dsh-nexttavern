// Generated from runtime/alpha3/src/core/roleplay-ruby-input.ts; edit the TypeScript source.
/** Fixed caller: reader.js incrementalRead/extractContent/cleanText; engine.js
 * runPipeline; worldbook.js findEntry/readEntry/writeOutputEntry; jailbreak.js
 * buildMessages. Storage, ST macro resolution and publication belong to Core. */
import { RUBY_BUILTIN_REFERENCES_V1 } from './roleplay-ruby-config.js';
export const RUBY_INCREMENTAL_READ_POLICY_V1 = { schemaVersion: 1, maxAiReplies: 20, maxBodyChars: 200_000,
    defaultContentTags: ['content', 'maintext', 'text', 'body', 'message'],
    removedBlocks: ['statusblock', 'options', 'other', 'thinking'] };
// The fixed caller treats these author fields as regex source. This module
// supports literal fields; pattern-dependent configurations need the isolated
// regex owner instead of executing dynamic author patterns in the main thread.
const rubyPatternMetacharacters = /[\\^$.*+?()[\]{}|]/;
const removedBlockPatterns = [/<\s*statusblock\b[\s\S]*?<\s*\/\s*statusblock\s*>/ig,
    /<\s*options\b[\s\S]*?<\s*\/\s*options\s*>/ig,
    /<\s*other\b[\s\S]*?<\s*\/\s*other\s*>/ig,
    /<\s*thinking\b[\s\S]*?<\s*\/\s*thinking\s*>/ig];
// The caller uses non-Unicode /i matching. Fold single UTF-16 units without
// changing offsets; lowercasing a whole string can expand an author character.
function rubyCaseInsensitiveText(text) {
    let folded = '';
    for (let index = 0; index < text.length; index++) {
        const unit = text[index], upper = unit.toUpperCase();
        folded += upper.length === 1 && !(unit.charCodeAt(0) >= 128 && upper.charCodeAt(0) < 128) ? upper : unit;
    }
    return folded;
}
function readableText(text, tags) {
    let extracted = text;
    const folded = rubyCaseInsensitiveText(text);
    for (const tag of [...tags, ...RUBY_INCREMENTAL_READ_POLICY_V1.defaultContentTags]) {
        const tagKey = rubyCaseInsensitiveText(tag), opening = `<${tagKey}`, start = folded.indexOf(opening);
        if (start < 0)
            continue;
        const bodyStart = folded.indexOf('>', start + opening.length) + 1;
        if (bodyStart === 0)
            continue;
        const end = folded.indexOf(`</${tagKey}>`, bodyStart);
        if (end >= 0) {
            extracted = text.slice(bodyStart, end).trim();
            break;
        }
    }
    for (const pattern of removedBlockPatterns)
        extracted = extracted.replace(pattern, '');
    return extracted.replace(/<!--[\s\S]*?-->/g, '').trim();
}
export function readRubyIncrementalWindowV1(messages, bookmark, customTags, charName) {
    const count = messages.filter(message => message.role === 'assistant').length;
    if (count <= 0)
        return { schemaVersion: 1, encoding: 'ruby-incremental-input-data-v1',
            startOrdinal: 0, endOrdinal: 0, count: 0, messages: [], scanText: '' };
    const startOrdinal = Math.max(bookmark > 0 ? bookmark + 1 : 1, count - RUBY_INCREMENTAL_READ_POLICY_V1.maxAiReplies + 1);
    if (startOrdinal > count)
        return { schemaVersion: 1, encoding: 'ruby-incremental-input-data-v1',
            startOrdinal, endOrdinal: count, count: 0, messages: [], scanText: '' };
    if (customTags.some(tag => rubyPatternMetacharacters.test(tag)))
        throw new Error('RUBY_CONTENT_TAG_PATTERN_UNSUPPORTED');
    let start = 0, ordinal = 0;
    if (startOrdinal > 1)
        for (let index = 0; index < messages.length; index++) {
            if (messages[index].role === 'assistant' && ++ordinal === startOrdinal - 1) {
                start = index + 1;
                break;
            }
        }
    const selected = messages.slice(start), lines = selected.flatMap(message => {
        const text = readableText(message.text, customTags);
        return text ? [`【${message.role === 'user' ? '{{user}}' : message.speakerName || charName}】${text}`] : [];
    });
    return { schemaVersion: 1, encoding: 'ruby-incremental-input-data-v1', startOrdinal, endOrdinal: count,
        count: count - startOrdinal + 1, messages: selected, scanText: lines.join('\n\n') };
}
export function rubyKeywordScanV1(task, scanText) {
    const keywords = task.keywordScanKeywords;
    if (!task.keywordScanEnabled || !keywords.length)
        return { run: true, matched: [] };
    const lower = scanText.toLowerCase(), matched = keywords.filter(keyword => lower.includes(keyword.toLowerCase()));
    return { run: matched.length > 0, matched };
}
/** Array order is the captured raw-book order. Disabled rows still participate
 * in explicit RUBY lookup; the normal lore activation filter has another role. */
export function findRubyEntryV1(book, key) {
    const target = key.trim();
    if (!target)
        return undefined;
    return book.entries.find(entry => entry.keys.some(raw => raw.trim() === target
        || raw.includes(',') && raw.split(',').some(value => value.trim() === target)));
}
export function readRubyEntryV1(character, chat, key, preferChat) {
    const refs = [], books = preferChat ? [chat, character] : [character, chat];
    for (const book of books) {
        refs.push(book.ref);
        const entry = findRubyEntryV1(book, key);
        if (!entry)
            continue;
        refs.push(entry.ref);
        const content = entry.resolvedContent.trim();
        if (content)
            return { content, refs, entry };
    }
    return { content: '', refs, entry: undefined };
}
function rubyMessageSequence(taskType, userPrompt, items) {
    const enabled = items.filter(item => item.enabled && item.content.trim()), messages = [];
    const push = (position) => {
        for (const item of enabled.filter(item => item.position === position))
            messages.push({ role: item.role,
                content: item.content.replaceAll('{{taskType}}', taskType).replaceAll('{{TASK_TYPE}}', taskType) });
    };
    push('beforeUser');
    const mainInputMessageIndex = messages.length;
    messages.push({ role: 'user', content: userPrompt });
    push('afterUser');
    push('tail');
    return { messages, mainInputMessageIndex };
}
export function buildRubyMessagesV1(taskType, userPrompt, items) {
    return rubyMessageSequence(taskType, userPrompt, items).messages;
}
export function prepareRubyAnalysisWindowV1(input) {
    const { configuration, task } = input;
    if (configuration.status === 'unsupported')
        return { kind: 'unsupported', issues: configuration.issues, normalRequests: 0 };
    const charName = configuration.charName || input.actualCharName || '角色';
    let window;
    try {
        window = readRubyIncrementalWindowV1(input.messages, input.bookmark, configuration.customContentTags, charName);
    }
    catch {
        return { kind: 'unsupported', issues: [{ code: 'RUBY_CONTENT_TAG_PATTERN_UNSUPPORTED',
                    sourcePath: configuration.source.sourcePath + '/customContentTags' }], normalRequests: 0 };
    }
    if (window.count === 0 || !window.scanText)
        return { kind: 'skipped', reason: 'no-new-text', taskKey: task.taskKey, window, normalRequests: 0 };
    const scan = rubyKeywordScanV1(task, window.scanText);
    if (!scan.run)
        return { kind: 'skipped', reason: 'keyword-miss', taskKey: task.taskKey, window, normalRequests: 0 };
    if (!task.promptKey)
        return { kind: 'unsupported', issues: [{ code: 'RUBY_TASK_PROMPT_KEY_MISSING',
                    sourcePath: task.sourcePath + '/promptKey' }], normalRequests: 0 };
    return { kind: 'eligible', window, matchedKeywords: scan.matched };
}
export function prepareRubyAnalysisInputV1(input) {
    const { configuration, task, trigger } = input, decision = input.windowDecision ?? prepareRubyAnalysisWindowV1(input);
    if (decision.kind !== 'eligible')
        return decision;
    const { window, matchedKeywords } = decision, charName = configuration.charName || input.actualCharName || '角色';
    const prompt = readRubyEntryV1(input.characterBook, input.chatBook, task.promptKey, false);
    if (!prompt.content)
        return { kind: 'unsupported', issues: [{ code: 'RUBY_PROMPT_ENTRY_UNAVAILABLE',
                    sourcePath: task.sourcePath + '/promptKey' }], normalRequests: 0 };
    const messageItems = configuration.messageItems;
    const referenceValues = new Map();
    for (const reference of configuration.referencePool.filter(reference => task.useReferences.includes(reference.varName))) {
        const value = readRubyEntryV1(input.characterBook, input.chatBook, reference.entryKey, true);
        referenceValues.set(reference.varName, { content: value.content, refs: value.refs });
    }
    for (const reference of RUBY_BUILTIN_REFERENCES_V1)
        if (task.useReferences.includes(reference.varName)
            && !referenceValues.has(reference.varName)) {
            const value = readRubyEntryV1(input.characterBook, input.chatBook, reference.entryKey, true);
            if (!value.content)
                return { kind: 'unsupported', issues: [{ code: 'RUBY_BUILTIN_REFERENCE_UNAVAILABLE',
                            sourcePath: task.sourcePath + '/useReferences' }], normalRequests: 0 };
            referenceValues.set(reference.varName, { content: value.content, refs: value.refs });
        }
    const outputValues = new Map();
    for (const outputTask of configuration.tasks)
        if (outputTask.outputKey && task.useOutputs.includes(outputTask.outputVarName)) {
            const value = readRubyEntryV1(input.characterBook, input.chatBook, outputTask.outputKey, true);
            outputValues.set(outputTask.outputVarName, { content: value.content, refs: value.refs });
        }
    const body = window.scanText.slice(0, RUBY_INCREMENTAL_READ_POLICY_V1.maxBodyChars), truncatedBodyChars = window.scanText.length - body.length, variables = { CHAR_NAME: charName, recentMessages: body }, referenceRefs = [], outputRefs = [], sections = [];
    const add = (names, values, refs) => {
        for (const name of names) {
            const value = values.get(name);
            // The fixed caller leaves an undeclared variable's placeholder intact.
            // Empty declared content is still substituted as （未设定） below.
            if (!value)
                continue;
            variables[name] = value.content;
            refs.push(...value.refs);
        }
    };
    add(task.useReferences, referenceValues, referenceRefs);
    add(task.useOutputs, outputValues, outputRefs);
    for (const name of task.useReferences) {
        const content = variables[name];
        if (!content || content === '（未设定）')
            continue;
        const reference = configuration.referencePool.find(value => value.varName === name), builtin = RUBY_BUILTIN_REFERENCES_V1.find(value => value.varName === name);
        sections.push(`【${reference?.label || reference?.entryKey || builtin?.label || name}】\n${content}`);
    }
    for (const name of task.useOutputs) {
        const content = variables[name];
        if (!content || content === '（未设定）')
            continue;
        const match = /^task_(\d+)_Output$/.exec(name), label = match ? configuration.tasks.find(value => value.id === Number(match[1]))?.displayName
            || `任务#${match[1]}结果` : name;
        sections.push(`【${label}】\n${content}`);
    }
    const assembled = [];
    if (!prompt.content.includes('{{recentMessages}}') && body) {
        const note = truncatedBodyChars
            ? `\n\n（⚠️ 本次正文超过20万字符上限，末尾约 ${truncatedBodyChars} 字符已被截断抛弃，仅上方保留部分为有效分析素材）` : '';
        assembled.push(`【本次正文（增量，第${window.startOrdinal}楼至第${window.endOrdinal}楼，共${window.count}楼${truncatedBodyChars ? '，已截断' : ''}）】\n${body}${note}\n\n`
            + '（硬性约束：分析输出必须取材于上方正文的实际剧情；后文任务指令中的"示范/示例"仅用于说明格式与颗粒度，禁止把示例中的具体部位、项目、情节、数值当作分析结果输出）');
    }
    if (sections.length)
        assembled.push('【历史分析参考（需根据上方正文更新，勿照搬）】\n' + sections.join('\n\n'));
    let userPrompt = assembled.length ? `${assembled.join('\n\n')}\n\n[任务指令]\n${prompt.content}` : prompt.content;
    for (const [key, value] of Object.entries(variables)) {
        if (rubyPatternMetacharacters.test(key))
            return { kind: 'unsupported', issues: [{
                        code: 'RUBY_TEMPLATE_VARIABLE_PATTERN_UNSUPPORTED', sourcePath: task.sourcePath
                    }], normalRequests: 0 };
        // String replacement preserves the caller's $$/$&/$`/$' expansion. A
        // callback or split/join would silently change reference/output content.
        userPrompt = userPrompt.replaceAll(`{{${key}}}`, value || '（未设定）');
    }
    const sequence = rubyMessageSequence(task.displayName, userPrompt, messageItems);
    return { kind: 'prepared', input: { schemaVersion: 1, encoding: 'ruby-analysis-input-data-v1',
            configuration: configuration.source, taskKey: task.taskKey, trigger, window, matchedKeywords,
            promptRef: prompt.entry.ref, referenceRefs: [...prompt.refs, ...referenceRefs], outputRefs, truncatedBodyChars,
            ...sequence, normalRequests: 1 } };
}
export function prepareRubyAnalysisOutputV1(input, task, content) {
    const text = content.trim();
    if (text.length < 2)
        return { kind: 'failed', code: 'RUBY_ANALYSIS_RESULT_TOO_SHORT' };
    const extra = task.extraKeys.split(',').map(key => key.trim()).filter(Boolean);
    return { kind: 'prepared', output: { schemaVersion: 1, encoding: 'ruby-analysis-output-data-v1',
            configuration: input.configuration, taskKey: task.taskKey, outputVarName: task.outputVarName,
            sourceOrdinal: input.window.endOrdinal, content: text, target: task.outputKey ? 'chat-worldbook' : 'owner-output',
            suppressCharacterKey: task.outputKey || null,
            entry: task.outputKey ? { lookupKey: task.outputKey, keyUpdate: extra.length ? [task.outputKey, ...extra] : null,
                constant: task.outputConstant, disabled: task.outputDisable, position: task.position, order: task.order,
                ...(task.position === 4 ? { depth: task.depth } : {}),
                ...(task.noRecursion ? { excludeRecursion: true, preventRecursion: true } : {}),
                ...(task.selective ? { selective: true, selectiveLogic: 0,
                    secondaryKeys: task.selectiveKeys.length ? task.selectiveKeys : ['nsfw'] } : {}) } : null,
            bookmark: { taskKey: task.taskKey, ordinal: input.window.endOrdinal } } };
}
