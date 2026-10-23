// Generated from runtime/alpha3/src/core/community-preset-execution.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { nativeInputSha256 } from '@deepseek-ai/dsh-agent-loop';
import { createCommunityMacroEvaluator } from './community-preset-macros.js';
import { createCommunitySanitizer, communityResponseHooks } from './community-preset-response.js';
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === 'string' ? value : '';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const rowRef = (row) => ({ id: row.id, messageSha256: row.messageSha256 });
const rowText = (row) => row.message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
const replayOwned = (row) => Object.hasOwn(object(row.message.source), 'replayState');
const plain = (row) => ['user', 'assistant'].includes(row.role) && row.message.content.every(block => block.type === 'text' && Object.keys(block).every(key => key === 'type' || key === 'text'));
const clone = (value) => structuredClone(value);
/** Every history target comes from Native. A projection may not cross a real
 * tool/media/opaque row or an insertion boundary already owned by the layout. */
function historyRuns(rows, selected, insertions, anchoredInsertions) {
    const positions = new Map(selected.messages.map((row, index) => [row.id, index]));
    const cuts = new Set(insertions.map(row => selected.messages.length - row.requestedDepth));
    for (const row of anchoredInsertions)
        cuts.add(positions.get(row.anchor.target.id) + (row.anchor.side === 'after' ? 1 : 0));
    const runs = [];
    let current = [];
    for (const row of rows) {
        const index = positions.get(row.id), previous = current.at(-1);
        if (!plain(row)) {
            if (current.length)
                runs.push(current);
            current = [];
            continue;
        }
        if (previous && (index !== positions.get(previous.id) + 1 || cuts.has(index))) {
            runs.push(current);
            current = [];
        }
        current.push(row);
    }
    if (current.length)
        runs.push(current);
    return runs;
}
function adviceText(assistant, user, configuration) {
    const advice = /<advice\b[^>]*>(?:(?!<advice\b|<\/(?:konatan_planning(?:~[^>]*)?|details|script|think(?:ing)?)\s*>)[\s\S])*?<\/advice\s*>/gi;
    const head = configuration.position === 'head';
    const source = head || configuration.stripModelAdvice !== false ? assistant.replace(advice, '') : assistant;
    if (!head)
        return `${source.trimEnd()}${source.trimEnd() ? '\n\n' : ''}<advice>${user}</advice>`;
    const ending = [...source.matchAll(/<\/konatan_planning(?:~[^>]*)?\s*>/gi)].at(-1);
    if (!ending)
        return `<advice>${user}</advice>${source.trim() ? '\n\n' + source.trim() : ''}`;
    const split = ending.index + ending[0].length;
    return `${source.slice(0, split).trimEnd()}\n\n<advice>${user}</advice>${source.slice(split).trim() ? '\n\n' + source.slice(split).trim() : ''}`;
}
function rebornFragments(role, content) {
    const fragments = [];
    const source = content.replace(/\|用户：(.*?)\|/, '');
    let cursor = 0, current = role;
    for (const match of source.matchAll(/\|(用户|小猫之神)\|/g)) {
        const before = source.slice(cursor, match.index).trim();
        if (before)
            fragments.push({ role: current, text: before });
        current = match[1] === '用户' ? 'user' : 'assistant';
        cursor = match.index + match[0].length;
    }
    const tail = source.slice(cursor).trim();
    if (tail)
        fragments.push({ role: current, text: tail });
    return fragments;
}
const fake = (role, content) => `{"role":${JSON.stringify(role)},"content":"${content}"}`;
const modelOpen = '{"role":"model","content":"Pass';
const soliumbraOpen = (key = 'content') => `{"role":"soliumbra","${key}":"`;
export function createCommunityPresetExecution(input) {
    const preset = input.policy.preset;
    if (!preset)
        throw Error('社区预设执行需要已选择的预设');
    const features = object(input.policy.effective.features[preset.profile.id]);
    const configuration = { ...object(preset.profile.configuration[preset.profile.id]), ...features };
    const outlets = {};
    const initialChat = clone(input.variableAttempt.chat), initialGlobal = clone(input.variableAttempt.global);
    const macros = createCommunityMacroEvaluator({ seed: input.seed, clockEpochMs: input.clockEpochMs,
        aliases: { ...input.aliases, lastUserMessage: input.inputText, input: input.inputText }, chat: initialChat, global: initialGlobal, outlets });
    const byId = new Map(preset.prompts.map(prompt => [prompt.identifier, prompt]));
    const prompts = (preset.promptOrder.length ? preset.promptOrder.map(row => byId.get(row.identifier)).filter((p) => !!p) : preset.prompts)
        .filter(prompt => prompt.enabled && !prompt.unused && !prompt.configurationOnly);
    // An outlet reader moved ahead of WI is also a chronology boundary: later
    // writes must wait beside it until finish has bound the actual outlet text.
    const prefixStop = prompts.findIndex(prompt => prompt.marker === 'worldInfoBefore' || prompt.marker === 'worldInfoAfter'
        || !prompt.marker && /\{\{\s*(?:outlet|压缩相邻消息)\s*::/i.test(prompt.content));
    const rendered = new Map();
    let prefixed = false;
    const bindings = () => ({ chat: clone(macros.chat), global: clone(macros.global) });
    const prefix = () => {
        if (!prefixed) {
            for (const prompt of prompts.slice(0, prefixStop < 0 ? prompts.length : prefixStop)) {
                if (!prompt.marker)
                    rendered.set(prompt.identifier, macros.render(prompt.content));
            }
            prefixed = true;
        }
        return bindings();
    };
    return { prefix, renderPlainAuthor: (value) => macros.render(value), get bindings() { return bindings(); }, finish(finish) {
            prefix();
            const { layout, native } = finish;
            const adaptations = [], consumedMarkers = [];
            const results = [];
            const sections = layout.sections.map(section => ({ ...section }));
            const requiredSections = [...layout.requiredSections];
            let insertions = [...layout.insertions];
            let anchoredInsertions = [...layout.anchoredInsertions];
            const sectionByName = new Map(sections.map(section => [section.name, section]));
            const consumed = new Set();
            const consumeSection = (name) => {
                const section = sectionByName.get(name);
                if (!section || consumed.has(name))
                    return '';
                consumed.add(name);
                const value = section.replacementText;
                section.replacementText = '';
                return value;
            };
            for (const outlet of layout.layout.outlets)
                outlets[outlet.name] = outlet.text;
            const processingBase = object(object(preset.profile.configuration.dream).messageProcessing);
            const processingOverrides = object(features.messageProcessing);
            const processing = { ...processingBase, ...processingOverrides,
                chat_history: { ...object(processingBase.chat_history), ...object(processingOverrides.chat_history) },
                entry_processing: { ...object(processingBase.entry_processing), ...object(processingOverrides.entry_processing) },
                delimiter: { ...object(processingBase.delimiter), ...object(processingOverrides.delimiter) } };
            const dream = preset.profile.id === 'dream' && processing.enabled !== false;
            if (dream && object(processing.entry_processing).mode === 'worldbook') {
                const metadata = new Map((input.loreEntries ?? []).map(entry => [entry.entryId, entry]));
                const placementById = new Map();
                for (const placement of finish.evaluation.placements) {
                    // Evaluation order owns the first placement, just as the former find.
                    if (!placementById.has(placement.entryId))
                        placementById.set(placement.entryId, placement);
                }
                const staticTexts = [], dynamicTexts = [];
                const movedIds = new Set();
                for (const row of finish.finalLore) {
                    const placement = placementById.get(row.entryId);
                    if (!placement || placement.position === 'named-outlet')
                        continue;
                    const entry = metadata.get(row.entryId);
                    (entry?.constant && !entry.dynamic ? staticTexts : dynamicTexts).push(row.text);
                    movedIds.add(row.entryId);
                }
                outlets.lora_constant = staticTexts.filter(Boolean).join('\n\n');
                outlets.lora_key = dynamicTexts.filter(Boolean).join('\n\n');
                for (const name of ['roleplay:lore-before-character', 'roleplay:lore-after-character',
                    'roleplay:lore-before-examples', 'roleplay:lore-after-examples'])
                    consumeSection(name);
                const movedRefs = new Set([...movedIds].map(id => `lore-${id}`));
                insertions = insertions.filter(row => !movedRefs.has(row.contributionRef));
                anchoredInsertions = anchoredInsertions.filter(row => !movedRefs.has(row.contributionRef));
                if (movedIds.size && !metadata.size)
                    adaptations.push({ code: 'dream-lore-without-static-metadata', identifiers: [...movedIds] });
            }
            const transport = { ...preset.profile.transport, ...object(configuration.transport) };
            const toolEnabled = transport.enabled !== false
                && !(preset.profile.id === 'reborn' && /防截断/i.test(input.modelName ?? ''));
            const toolName = toolEnabled && preset.profile.id === 'kemini' ? `emit_complete_response_${sha(input.seed).slice(0, 24)}`
                : toolEnabled && preset.profile.id === 'reborn' ? 'game_content' : '';
            const controlPrompt = toolName && preset.profile.id === 'kemini'
                ? `Call the \`${toolName}\` function exactly once and put your complete final reply in its \`content\` argument. Do not write any of the final reply outside that call. Use any other available tools normally when they are needed.` : '';
            let controlPlaced = false, examplesConsumed = false, afterHistory = false;
            const head = [], tail = [], chat = [];
            const cardMarkers = new Set(['charDescription', 'charPersonality', 'scenario']);
            for (const [rank, prompt] of prompts.entries()) {
                if (!toolEnabled && preset.profile.id === 'reborn' && prompt.identifier === transport.promptIdentifier)
                    continue;
                let value = '';
                if (prompt.marker) {
                    consumedMarkers.push(prompt.marker);
                    if (prompt.marker === 'chatHistory') {
                        afterHistory = true;
                        continue;
                    }
                    if (cardMarkers.has(prompt.marker) || prompt.marker === 'personaDescription') {
                        if (!finish.renderedMarkers)
                            throw Error('COMMUNITY_RENDERED_CARD_MARKERS_REQUIRED');
                        value = finish.renderedMarkers[prompt.marker] ?? '';
                    }
                    else if (prompt.marker === 'worldInfoBefore')
                        value = consumeSection('roleplay:lore-before-character');
                    else if (prompt.marker === 'worldInfoAfter')
                        value = consumeSection('roleplay:lore-after-character');
                    else if (prompt.marker === 'dialogueExamples' && !examplesConsumed) {
                        value = [consumeSection('roleplay:lore-before-examples'), finish.renderedAuthor.examplesText,
                            consumeSection('roleplay:lore-after-examples')].filter(Boolean).join('\n');
                        consumeSection('roleplay:examples');
                        examplesConsumed = true;
                    }
                }
                else
                    value = rendered.get(prompt.identifier) ?? macros.render(prompt.content);
                if (controlPrompt && !controlPlaced && value.includes(String(transport.controlAnchor ?? '<format>'))) {
                    const anchor = String(transport.controlAnchor ?? '<format>'), index = value.indexOf(anchor);
                    value = value.slice(0, index) + controlPrompt + '\n' + value.slice(index);
                    controlPlaced = true;
                }
                results.push({ identifier: prompt.identifier, role: prompt.role, chars: value.length, sha256: sha(value),
                    disposition: prompt.marker ? 'marker' : prompt.injectionPosition === 1 ? 'in-chat' : afterHistory ? 'tail' : 'head' });
                if (!value)
                    continue;
                const part = { role: prompt.role, text: value, prompt, rank };
                if (prompt.injectionPosition === 1)
                    chat.push(part);
                else
                    (afterHistory ? tail : head).push(part);
            }
            // Disabled/absent markers must not leave their original slot injected.
            for (const name of ['roleplay:lore-before-character', 'roleplay:lore-after-character',
                'roleplay:lore-before-examples', 'roleplay:lore-after-examples', 'roleplay:examples'])
                consumeSection(name);
            if (controlPrompt && !controlPlaced)
                tail.push({ role: 'system', text: controlPrompt, rank: prompts.length });
            let systemText = head.filter(part => part.role === 'system').map(part => part.text).join('\n\n');
            const normal = [...head.filter(part => part.role !== 'system'), ...tail, ...chat];
            const systemTail = normal.filter(part => part.role === 'system');
            if (systemTail.length) {
                systemText += [systemText ? '\n\n' : '', systemTail.map(part => part.text).join('\n\n')].join('');
                adaptations.push({ code: 'native-system-material-owned-section', identifiers: systemTail.flatMap(part => part.prompt ? [part.prompt.identifier] : []) });
            }
            if (head.some(part => part.role !== 'system') && head.some(part => part.role === 'system'))
                adaptations.push({ code: 'native-system-head-precedes-role-material' });
            const communitySection = native.finalAssembly.sections.find(section => section.name === 'roleplay:community-preset');
            if (!communitySection)
                throw Error('社区预设缺少原生系统材料插槽');
            const expected = nativeInputSha256(communitySection);
            requiredSections.push({ name: 'roleplay:community-preset', sha256: expected });
            const community = { name: 'roleplay:community-preset', expectedSectionSha256: expected, replacementText: systemText, interpolate: false };
            sections.push(community);
            let nextOrder = Math.max(-1, ...insertions.map(row => row.stableOrder), ...anchoredInsertions.map(row => row.stableOrder)) + 1;
            const add = (ref, value, role, depth, source = value) => {
                if (!value)
                    return;
                insertions.push({ contributionRef: ref, sourceSha256: sha(source), renderedText: value, renderedSha256: sha(value),
                    requestedRole: role, requestedDepth: depth, stableOrder: nextOrder++ });
            };
            const markerIndex = prompts.findIndex(prompt => prompt.marker === 'chatHistory');
            for (const part of normal.filter(part => part.role !== 'system').sort((a, b) => {
                if (a.prompt?.injectionPosition === 1 && b.prompt?.injectionPosition === 1)
                    return a.prompt.injectionOrder - b.prompt.injectionOrder || a.rank - b.rank;
                return a.rank - b.rank;
            })) {
                const depth = part.prompt?.injectionPosition === 1 ? part.prompt.injectionDepth :
                    markerIndex < 0 || part.rank < markerIndex ? input.selected.messages.length : 0;
                add(`community-${part.prompt?.identifier ?? part.rank}`, part.text, part.role, depth, part.prompt?.content ?? part.text);
            }
            const projection = { schemaVersion: 1, encoding: 'native-request-message-projection-v1', groups: [], textEdits: [] };
            const groups = [];
            const textEdits = [];
            const edited = new Map((input.promptHistoryTextEdits ?? [])
                .map(edit => [edit.target.id, new Map(edit.blocks.map(block => [block.index, block.text]))]));
            const editText = (row, transform) => {
                const changes = edited.get(row.id) ?? new Map();
                row.message.content.forEach((block, index) => {
                    if (block.type === 'text') {
                        const before = changes.get(index) ?? block.text, after = transform(before, index);
                        if (after !== block.text)
                            changes.set(index, after);
                    }
                });
                if (changes.size)
                    edited.set(row.id, changes);
            };
            const effectiveText = (row) => row.message.content.flatMap((block, index) => block.type === 'text' ? [edited.get(row.id)?.get(index) ?? block.text] : []).join('\n');
            const sanitizer = createCommunitySanitizer(preset.profile, features);
            const strategy = sanitizer.strategy(Number(input.aliases.chatMessageCount ?? input.historyRows.length));
            let adviceRow;
            if (preset.profile.id === 'izumi') {
                const advice = { ...object(object(preset.profile.configuration.izumi).advice), ...object(features.advice) };
                const lastUser = input.historyRows.findLastIndex(row => row.role === 'user');
                const user = input.historyRows[lastUser], assistant = input.historyRows.slice(0, lastUser).findLast(row => row.role === 'assistant');
                if (advice.enabled !== false && user && assistant && rowText(user)) {
                    // Advice moves the model-facing user text after regex projection;
                    // scanner/macros keep the independently captured original input.
                    const userText = edited.has(user.id) ? effectiveText(user) : input.inputText || rowText(user), lastText = assistant.message.content.findLastIndex(block => block.type === 'text');
                    const opaqueText = assistant.message.content.some(block => block.type === 'text'
                        && Object.keys(block).some(key => key !== 'type' && key !== 'text'));
                    if (lastText >= 0 || replayOwned(assistant) || !rowText(assistant)) {
                        if (replayOwned(assistant) || opaqueText || !rowText(assistant)) {
                            const value = adviceText('', strategy === 'input_only' ? sanitizer.forward(userText) : userText, advice);
                            anchoredInsertions.push({ contributionRef: `community-advice-${user.id}`, sourceSha256: sha(input.inputText),
                                renderedText: value, renderedSha256: sha(value), requestedRole: 'assistant', stableOrder: nextOrder++,
                                anchor: { schemaVersion: 1, encoding: 'native-selected-message-anchor-v1', side: 'before',
                                    target: { ...rowRef(user), role: 'user' } } });
                            adaptations.push({ code: 'native-independent-advice', identifiers: [assistant.id, user.id] });
                        }
                        else {
                            editText(assistant, (value, index) => index === lastText ? adviceText(value, userText, advice) : value);
                            adviceRow = assistant;
                        }
                        const firstText = user.message.content.findIndex(block => block.type === 'text');
                        const replacement = text(advice.replacementText) || text(advice.continueText) || '按照advice继续吧。';
                        editText(user, (_value, index) => index === firstText ? replacement : '');
                    }
                }
                if (strategy === 'all') {
                    for (const section of sections)
                        section.replacementText = sanitizer.forward(section.replacementText);
                    for (const row of input.historyRows)
                        editText(row, value => sanitizer.forward(value));
                    for (let index = 0; index < insertions.length; index++) {
                        const row = insertions[index], renderedText = sanitizer.forward(row.renderedText);
                        insertions[index] = { ...row, renderedText, renderedSha256: sha(renderedText) };
                    }
                    for (let index = 0; index < anchoredInsertions.length; index++) {
                        const row = anchoredInsertions[index], renderedText = sanitizer.forward(row.renderedText);
                        anchoredInsertions[index] = { ...row, renderedText, renderedSha256: sha(renderedText) };
                    }
                }
                else if (strategy === 'input_only') {
                    if (adviceRow)
                        editText(adviceRow, value => value.replace(/<advice\b[^>]*>([\s\S]*?)<\/advice\s*>/gi, (_match, inner) => `<advice>${sanitizer.forward(inner)}</advice>`));
                    else {
                        const user = input.historyRows.findLast(row => row.role === 'user');
                        if (user)
                            editText(user, value => sanitizer.forward(value));
                    }
                }
            }
            if (dream) {
                const history = object(processing.chat_history), delimiter = text(object(processing.delimiter).value) || '\n\n';
                const positions = new Map(input.historyRows.map((row, index) => [row.id, index]));
                for (const run of historyRuns(input.historyRows, input.selected, insertions, anchoredInsertions)) {
                    if (history.type === 'squash_nearby') {
                        let adjacent = [];
                        const flush = () => {
                            if (adjacent.length)
                                groups.push({ targets: adjacent.map(rowRef), role: adjacent[0].role,
                                    renderedText: adjacent.map(effectiveText).join(delimiter) });
                            adjacent = [];
                        };
                        for (const row of run) {
                            if (adjacent.length && adjacent[0].role !== row.role)
                                flush();
                            adjacent.push(row);
                        }
                        flush();
                    }
                    else {
                        const wrapped = run.map(row => {
                            const role = row.role === 'assistant' ? 'assistant' : row.role === 'system' ? 'system' : 'user', floor = positions.get(row.id);
                            const prefix = text(history[`${role}_prefix`]).replaceAll('${floor}', String(floor));
                            return prefix + effectiveText(row) + text(history[`${role}_suffix`]).replaceAll('${floor}', String(floor));
                        }).join(delimiter);
                        const role = history.squash_role === 'assistant' || history.squash_role === 'system' ? history.squash_role : 'user';
                        groups.push({ targets: run.map(rowRef), role, renderedText: wrapped });
                    }
                }
            }
            if (preset.profile.id === 'reborn') {
                const postscript = { ...object(object(preset.profile.configuration.reborn).postscript), ...object(features.postscript) };
                if (postscript.enabled !== false) {
                    const thoughts = [];
                    const clean = (value) => value.replace(/<prefill_thinking\b[^>]*>([\s\S]*?)<\/prefill_thinking>/gi, (_tag, thinking) => { thoughts.push(thinking.trim()); return ''; }).replaceAll('<|no-convert|>', '');
                    const hasBoundary = systemText.includes('<|no-convert|>');
                    // Reborn tail rules participate in its pseudo conversation even when
                    // ChatSquash is off; they must not also survive in the system section.
                    const tailSystem = tail.filter(part => part.role === 'system');
                    const headOnly = head.filter(part => part.role === 'system').map(part => part.text).join('\n\n');
                    community.replacementText = hasBoundary ? clean(headOnly) : `<clear>\n[${fake('system', clean(headOnly))},{"role":"fake_system","content":"`;
                    let open = 'fake_system';
                    for (const run of historyRuns(input.historyRows, input.selected, insertions, anchoredInsertions)) {
                        let pending = [];
                        const flush = (ending) => {
                            if (!pending.length)
                                return;
                            const parts = pending.flatMap(row => rebornFragments(row.role, clean(effectiveText(row))));
                            const fragments = [];
                            if (open) {
                                if (open === 'soliumbra' && parts[0]?.role === 'assistant')
                                    fragments.push(parts.shift().text + '"}');
                                else
                                    fragments.push('"}');
                            }
                            fragments.push(...parts.map(part => fake(part.role === 'assistant' ? 'soliumbra' : part.role, part.text)));
                            groups.push({ targets: pending.map(rowRef), role: 'assistant', renderedText: fragments.map((part, index) => index === 0 && open ? part : ',' + part).join('') + ',' + modelOpen });
                            const last = pending.at(-1), position = input.selected.messages.findIndex(row => row.id === last.id);
                            const depth = input.selected.messages.length - position - 1;
                            const guide = `"},${soliumbraOpen(ending && !tailSystem.length ? 'reasoning' : 'content')}`;
                            if (last.role === 'user') {
                                // Native may add its runtime-context row after this captured cut.
                                // The original player anchor keeps the guide beside that user.
                                anchoredInsertions.push({ contributionRef: `community-reborn-guide-${last.id}`, sourceSha256: sha(guide),
                                    renderedText: guide, renderedSha256: sha(guide), requestedRole: 'user', stableOrder: nextOrder++,
                                    anchor: { schemaVersion: 1, encoding: 'native-selected-message-anchor-v1', side: 'after',
                                        target: { ...rowRef(last), role: 'user' } } });
                            }
                            else
                                add(`community-reborn-guide-${last.id}`, guide, 'user', depth);
                            open = 'soliumbra';
                            pending = [];
                        };
                        for (const row of run) {
                            pending.push(row);
                            if (row.role === 'user')
                                flush(false);
                        }
                        flush(true);
                    }
                    if (tailSystem.length) {
                        const tails = tailSystem.map(part => fake('system', clean(part.text))).join(',');
                        add('community-reborn-tail', `"},${tails},${modelOpen}`, 'assistant', 0);
                        add('community-reborn-final-guide', `"},${soliumbraOpen('reasoning')}${thoughts.length ? thoughts.join('\n') + '","content":"' : ''}`, 'user', 0);
                    }
                    else {
                        const guides = [...insertions, ...anchoredInsertions].filter(row => row.contributionRef.startsWith('community-reborn-guide-'));
                        const lastGuide = guides.sort((a, b) => a.stableOrder - b.stableOrder).at(-1);
                        if (lastGuide) {
                            const renderedText = `"},${soliumbraOpen('reasoning')}${thoughts.length ? thoughts.join('\n') + '","content":"' : ''}`;
                            const index = insertions.findIndex(row => row.contributionRef === lastGuide.contributionRef);
                            if (index >= 0)
                                insertions[index] = { ...insertions[index], renderedText, renderedSha256: sha(renderedText) };
                            else {
                                const index = anchoredInsertions.findIndex(row => row.contributionRef === lastGuide.contributionRef);
                                anchoredInsertions[index] = { ...anchoredInsertions[index], renderedText, renderedSha256: sha(renderedText) };
                            }
                        }
                    }
                    adaptations.push({ code: 'reborn-request-only-pseudo-conversation' });
                }
            }
            const grouped = new Set(groups.flatMap(group => group.targets.map(target => target.id)));
            for (const [id, blocks] of edited) {
                if (grouped.has(id))
                    continue;
                const row = input.selected.messages.find(row => row.id === id);
                textEdits.push({ target: rowRef(row), blocks: [...blocks].map(([index, text]) => ({ index, text })) });
            }
            const opaque = input.historyRows.filter(row => !plain(row));
            if ((dream || preset.profile.id === 'reborn') && opaque.length)
                adaptations.push({ code: 'opaque-history-kept-native', identifiers: opaque.map(row => row.id) });
            if (input.policy.effective.applySampling && preset.parameters.stop !== undefined)
                adaptations.push({ code: 'unsupported-sampling-stop' });
            const story = { schemaVersion: 1,
                ...toolName ? { response: { transport: toolName } } : {},
                ...input.policy.effective.applySampling ? { sampling: {
                        ...typeof preset.parameters.temperature === 'number' ? { temperature: preset.parameters.temperature } : {},
                        ...typeof preset.parameters.openai_max_tokens === 'number' ? { maxTokens: preset.parameters.openai_max_tokens } : {},
                    } } : {} };
            const responseHooks = communityResponseHooks(preset.profile, features);
            const record = { schemaVersion: 1, presetId: preset.id, fingerprint: input.policy.fingerprint,
                attempt: clone(input.variableAttempt), writes: clone(macros.writes), randomDraws: macros.randomDraws,
                adaptations, consumedMarkers, prompts: results };
            return { ...layout, requiredSections, sections, insertions, anchoredInsertions,
                ...(groups.length || textEdits.length ? { messageProjection: { ...projection, groups, ...textEdits.length ? { textEdits } : {} } } : {}),
                story, responseHooks, record };
        } };
}
