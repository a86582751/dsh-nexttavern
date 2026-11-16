// Generated from runtime/alpha3/src/core/roleplay-author-dialog-content.ts; edit the TypeScript source.
import { recordSha256, sha256 } from './roleplay-data.js';
import { captureRoleplayTavernPromptSourceDataV1, projectCapturedTavernCharacterDataV1 } from './roleplay-tavern-prompt-source.js';
import { captureRoleplayTavernPromptScopesV1 } from './roleplay-tavern-prompt-scopes.js';
import { captureReadonlyAuthorDialogChatClockV1 } from './roleplay-tavern-chat-clock.js';
import { captureRoleplayTavernMaterialHistoryV1 } from './roleplay-tavern-material-history.js';
import { captureRoleplayTavernTimedHistoryV2 } from './roleplay-tavern-lore-timed-lineage.js';
import { produceRoleplayTavernMacroSnapshotV1, captureRoleplayTavernScopedRegexV1 } from './roleplay-tavern-prompt-macros.js';
import { prepareRoleplayTavernContentV1, produceTavernPromptVariableRefV1, resolveCapturedTavernPromptSettingsV1 } from './roleplay-tavern-content.js';
import { ST_LORE_ENTRY_DEFAULTS_V1 } from './tavern-lore-fixed-profile.mjs';
import { freezeAuthorDialogPromptV1 } from './roleplay-author-dialog.js';
import { createRoleplayTavernEjsPreparation } from './roleplay-tavern-ejs-preparation.js';
import { createRoleplayTavernOrdinaryStage } from './roleplay-tavern-ordinary-stage.js';
import { createRoleplayTavernSharedScopeStageV1 } from './roleplay-tavern-shared-scope-stage.js';
import { authorChatContributionIdV3 } from './roleplay-author-chat-state.js';
import { readAcceptedPreparationPlanRecord } from './community-preset-settlement.js';
import { createRoleplayTavernInjectionRegistryV1, createTavernNativeInjectionConsumptionV1, releaseTavernNativeInjectionConsumptionV1, TAVERN_NATIVE_FILTER_RECAPTURE, TAVERN_NATIVE_FILTER_SOURCE_SUCCESSOR } from './roleplay-tavern-injections.js';
import { captureRoleplayTavernInjectionDefinitionsV1 } from './roleplay-tavern-injection-definitions.js';
import { communityRegexRules } from './community-regex.js';
import { createCommunityMacroEvaluator } from './community-preset-macros.js';
import { createTavernSourceRenderCatalogV1, tavernSourceTemplateActivationV1 } from './tavern-source-render-catalog.mjs';
import { createRoleplayTavernGenerateLoaderV1 } from './roleplay-tavern-generate-loader.js';
import { projectNativeMessageTextV2 } from 'dsh-nexttavern-native-agent-loop';
import { produceCommunityPresetCardMaterialV1 } from './community-preset-card-material.js';
import { createTavernPromptMacroProjectorV1 } from './tavern-prompt-transform-execution.mjs';
import { TAVERN_PROMPT_TRANSFORM_LIMITS_V1 } from './tavern-prompt-transform-types.mjs';
import { applyAuthorChatOverlayV3 } from './roleplay-author-chat-state-types.js';
export const AUTHOR_DIALOG_CONTENT_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-readonly-author-dialog-content-policy-v1', authority: 'consumer-data-only',
    fields: 'current-Source-and-Native-author-mapping; actual-persona-and-examples',
    lore: 'current-edits-initial-cache-macros-selected-EJS-and-WORLD_INFO-regex',
    scan: 'actual-completed-canonical-Native-prefix-and-explicit-scanning-injections',
    output: 'requested-ordered-role-material; only-listed-builtins',
    effects: 'accepted-ordinary-and-shared-contributions; staged-injection-and-regex-registry',
    timing: 'readonly-current-fold; no-timed-proposal-or-Native-material-publication',
    requests: { normal: 0, retry: 0, fallback: 0 } });
const policySha256 = recordSha256(AUTHOR_DIALOG_CONTENT_POLICY_V1);
function fail(code) { throw Error(code); }
export const AUTHOR_GENERATION_DEFAULT_ORDER_V1 = ['world_info_before', 'persona_description', 'char_description',
    'char_personality', 'scenario', 'world_info_after', 'dialogue_examples', 'chat_history', 'user_input'];
function object(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function rolePrompt(value) {
    if (!object(value) || !['system', 'user', 'assistant'].includes(String(value.role)) || typeof value.content !== 'string')
        fail('AUTHOR_GENERATION_PROMPT_INVALID');
    return { role: value.role, content: value.content, ...value.image !== undefined ? { image: value.image } : {} };
}
export function normalizeAuthorGenerationOptionsV1(options, preset = {}) {
    if (options.custom_api !== undefined)
        fail('AUTHOR_GENERATION_CUSTOM_API_UNSUPPORTED');
    const mode = options.mode === 'preset' ? 'preset' : 'raw', ordered = options.ordered_prompts, order = ordered === undefined ? AUTHOR_GENERATION_DEFAULT_ORDER_V1 :
        Array.isArray(ordered) ? ordered.map(value => typeof value === 'string'
            ? AUTHOR_GENERATION_DEFAULT_ORDER_V1.includes(value) ? value : fail('AUTHOR_GENERATION_BUILTIN_INVALID')
            : rolePrompt(value)) : fail('AUTHOR_GENERATION_ORDER_INVALID'), max = options.max_chat_history ?? 'all';
    if (max !== 'all' && (!Number.isSafeInteger(max) || Number(max) < 0))
        fail('AUTHOR_GENERATION_HISTORY_LIMIT_INVALID');
    if (options.injects !== undefined && !Array.isArray(options.injects))
        fail('AUTHOR_GENERATION_INJECTION_INVALID');
    const injects = (options.injects ?? []).map(value => {
        const prompt = rolePrompt(value);
        if (!object(value) || (value.position !== 'in_chat' && value.position !== 'none')
            || !Number.isSafeInteger(value.depth) || Number(value.depth) < 0)
            fail('AUTHOR_GENERATION_INJECTION_INVALID');
        const filter = value.filter;
        if (filter !== undefined && (!object(filter) || filter.kind !== 'author-generation-filter'
            || Object.keys(filter).length !== 5 || ['realmId', 'callbackId', 'generationId', 'operationId']
            .some(key => typeof filter[key] !== 'string' || !filter[key])))
            fail('AUTHOR_GENERATION_INJECTION_FILTER_INGRESS_REQUIRED');
        return { ...prompt, position: value.position, depth: Number(value.depth), shouldScan: value.should_scan === true,
            ...filter !== undefined ? { filter: filter } : {} };
    });
    const call = { ...preset };
    if (options.tools !== undefined) {
        if (!Array.isArray(options.tools) || options.json_schema !== undefined)
            fail('AUTHOR_GENERATION_TOOLS_INVALID');
        call.tools = options.tools.map(tool => {
            if (!object(tool) || tool.type !== 'function' || !object(tool.function) || typeof tool.function.name !== 'string'
                || !object(tool.function.parameters))
                fail('AUTHOR_GENERATION_TOOLS_INVALID');
            return { name: tool.function.name, description: typeof tool.function.description === 'string' ? tool.function.description : '',
                parameters: tool.function.parameters };
        });
    }
    const choice = options.tool_choice;
    if (choice !== undefined) {
        if (choice === 'auto' || choice === 'none' || choice === 'required')
            call.toolChoice = choice;
        else if (object(choice) && choice.type === 'function' && object(choice.function) && typeof choice.function.name === 'string')
            call.toolChoice = { type: 'function', function: { name: choice.function.name } };
        else
            fail('AUTHOR_GENERATION_TOOL_CHOICE_INVALID');
    }
    if (options.json_schema !== undefined) {
        const schema = options.json_schema;
        if (!object(schema) || typeof schema.name !== 'string' || !object(schema.value))
            fail('AUTHOR_GENERATION_SCHEMA_INVALID');
        call.responseFormat = { type: 'json_schema', jsonSchema: { name: schema.name, schema: schema.value,
                ...typeof schema.description === 'string' ? { description: schema.description } : {},
                ...typeof schema.strict === 'boolean' ? { strict: schema.strict } : {} } };
    }
    return { mode, order, maxChatHistory: max, injects, call,
        presentation: { stream: options.should_stream === true, silence: options.should_silence === true,
            returnReasoning: options.should_return_reasoning === true } };
}
export async function consumeAuthorGenerationInjectionsV1(injects, consumer, invokeFilter) {
    const selected = [], libraryReads = [];
    for (const row of injects) {
        if (!row.content || (consumer === 'scan' ? !row.shouldScan : row.position !== 'in_chat'))
            continue;
        if (row.filter) {
            if (!invokeFilter)
                fail('AUTHOR_GENERATION_INJECTION_FILTER_UNAVAILABLE');
            const result = await invokeFilter(row.filter, consumer);
            libraryReads.push(...result.libraryReads);
            if (!result.accepted)
                continue;
        }
        selected.push(row);
    }
    return { selected, libraryReads };
}
/** Depth addresses the original ordered request. Inserted role groups never
 * shift another entry's anchor or introduce an omitted history builtin. */
export function insertAuthorGenerationDepthMessagesV1(messages, injections) {
    const groups = new Map();
    for (const row of injections) {
        if (!row.content)
            continue;
        const group = groups.get(row.depth) ?? [];
        group.push(row);
        groups.set(row.depth, group);
    }
    const depths = [...groups.keys()].sort((a, b) => b - a), result = [];
    let nextDepth = 0;
    for (let index = 0; index <= messages.length; index++) {
        while (nextDepth < depths.length && Math.max(0, messages.length - depths[nextDepth]) === index) {
            const group = groups.get(depths[nextDepth++]);
            for (const role of ['assistant', 'user', 'system']) {
                const content = group.filter(row => row.role === role).map(row => row.content).join('\n').trim();
                if (content)
                    result.push(literal({ role, content }));
            }
        }
        if (index < messages.length)
            result.push(messages[index]);
    }
    return result;
}
function literal(prompt) {
    const content = [{ type: 'text', text: prompt.content }];
    if (prompt.image !== undefined)
        for (const image of Array.isArray(prompt.image) ? prompt.image : [prompt.image]) {
            // Ingress must have handed this image to the actual attachment owner.
            if (!object(image) || image.type !== 'image' || !object(image.attachment))
                fail('AUTHOR_GENERATION_IMAGE_INGRESS_REQUIRED');
            content.push(image);
        }
    return { role: prompt.role, content };
}
/** Expand only the caller's selected builtins. Literal role rows acquire no
 * durable Session identity and a missing user_input never adds a user phase. */
export async function assembleAuthorGenerationMessagesV1(order, builtin, render) {
    const messages = [], cache = new Map();
    for (const [index, item] of order.entries()) {
        if (typeof item !== 'string') {
            messages.push(literal({ ...item, content: await render(item.content, item.role, index) }));
            continue;
        }
        let value = cache.get(item);
        if (!value) {
            value = await builtin(item);
            cache.set(item, value);
        }
        messages.push(...value);
    }
    return messages;
}
function sampling(settings) {
    const call = {};
    for (const [source, target] of [['temperature', 'temperature'], ['max_completion_tokens', 'maxTokens'],
        ['top_p', 'topP'], ['top_k', 'topK'], ['frequency_penalty', 'frequencyPenalty'], ['presence_penalty', 'presencePenalty']]) {
        const value = settings[source];
        if (typeof value === 'number')
            call[target] = value;
    }
    return call;
}
const presetMarkers = { worldInfoBefore: 'world_info_before',
    personaDescription: 'persona_description', charDescription: 'char_description', charPersonality: 'char_personality',
    scenario: 'scenario', worldInfoAfter: 'world_info_after', dialogueExamples: 'dialogue_examples', chatHistory: 'chat_history' };
export function produceAuthorGenerationMaterialRecordsV1(input) {
    const { sessionId, operationId } = input, basis = { schemaVersion: 1, encoding: 'core-author-generation-material-record-v1',
        authority: 'consumer-data-only', sessionId, branchId: sessionId, operationId }, snapshot = { ...basis, kind: 'snapshot', payload: input.snapshot }, plan = { ...basis, kind: 'plan', payload: { promptPlan: input.plan } }, snapshotSha256 = recordSha256(snapshot), planSha256 = recordSha256(plan), prefix = `${sessionId}__author-generation-${recordSha256({ operationId })}`;
    return { snapshot, plan, material: { snapshot: { key: `${prefix}-snapshot-${snapshotSha256}`, sha256: snapshotSha256 },
            plan: { key: `${prefix}-plan-${planSha256}`, sha256: planSha256 }, captureSha256: input.captureSha256 } };
}
export function createRoleplayAuthorDialogContentV1(deps) {
    async function capturePrompt(sid, target, request, operationId, current, signal) {
        const consumption = createTavernNativeInjectionConsumptionV1(), invoke = target.invokeFilter, results = new Map();
        if (invoke)
            target = { ...target, invokeFilter(descriptor, consumer) {
                    const key = JSON.stringify([consumer, descriptor.realmId, descriptor.generationId, descriptor.callbackId]);
                    let result = results.get(key);
                    if (!result) {
                        result = invoke(descriptor, consumer);
                        results.set(key, result);
                    }
                    return result;
                } };
        const selection = await deps.prepareAuthorDialogRoute({ sessionId: sid, binding: target.binding, operationId, current, signal });
        return preparePrompt(sid, target, request, operationId, current, signal, consumption, selection);
    }
    async function preparePrompt(sid, target, request, operationId, current, signal, consumption, selection) {
        const options = request.options, attemptId = `author-dialog:${operationId}`, preparedRoute = { model: selection.actualRoute.model, configSha256: recordSha256(selection.actualRoute) };
        const assertMutationAllowed = () => {
            if (target.effects === 'readonly')
                fail('AUTHOR_GENERATION_READONLY_EFFECT');
        };
        await deps.preflight(sid, signal);
        const session = deps.session(sid);
        if (!session)
            fail('AUTHOR_DIALOG_SESSION_INACTIVE');
        const assertOwner = () => {
            signal.throwIfAborted();
            if (!current() || deps.session(sid) !== session)
                fail('BROWSER_ATTACHMENT_REVOKED');
        };
        const read = await deps.withSourceLock(sid, async () => deps.inputState.captureAuthorDialog({ session, signal,
            assertOwnerFactsCurrent: assertOwner }, operationId, () => {
            const includeCardStyle = deps.includeCardStyle(sid), captured = captureRoleplayTavernPromptSourceDataV1(deps, sid, includeCardStyle);
            if (captured.kind === 'outside-declared-domain')
                fail('AUTHOR_DIALOG_SOURCE_UNAVAILABLE');
            const schema = deps.schemaScopes(sid), binding = target.binding, browser = schema?.authorBrowserV3, plain = schema ? undefined : deps.plainScopes(sid, captured.currentIdentitySha256);
            if (!schema && !plain)
                fail('AUTHOR_DIALOG_SOURCE_CHANGED');
            // Both reads occur inside this InputState operation. Its exact State2
            // head subscription includes an absent head and survives the model wait.
            const ordinaryChat = deps.captureOrdinaryChat(binding.namespace), namespaceRootSha256 = recordSha256(ordinaryChat.root);
            const storyText = deps.captureStoryText?.(sid), messageView = schema?.ordinaryMessageView?.(), clock = captureReadonlyAuthorDialogChatClockV1({ session, inputState: deps.inputState,
                storyText,
                projections: deps.projections(), assertOwnerCurrent: assertOwner }), scopeData = captureRoleplayTavernPromptScopesV1({ source: captured.source,
                currentIdentitySha256: captured.currentIdentitySha256, schema, plain, selected: clock.selected,
                isStoryMessage: () => true, ordinaryChat,
                authorDialogScopes: browser?.scopes, assertOwnerCurrent: assertOwner }), history = captureRoleplayTavernMaterialHistoryV1({ sessionId: sid, table: deps.branch, inputState: deps.inputState, session,
                events: () => session.snapshotEvents(), projections: deps.projections, assertOwnerCurrent: assertOwner }), inherited = deps.inheritedTiming(sid, captured.source, assertOwner), timed = captureRoleplayTavernTimedHistoryV2({ sessionId: sid, source: captured.source, compilation: captured.compilation,
                inputState: deps.inputState, table: deps.branch, forkBookId: deps.forkBookId,
                ownHistory: history, clock, projections: deps.projections(), sourceLineage: inherited?.sourceLineage,
                inheritedHistory: inherited?.inheritedHistory, assertOwnerCurrent: assertOwner,
                assertSourceLineageCurrent: () => inherited?.assertCurrent() });
            const catalog = deps.presets.authorCatalog(sid), name = typeof options.preset_name === 'string' ? options.preset_name : 'in_use', preset = name === 'in_use' ? catalog.current.data : catalog.presets.find(row => row.name === name)?.data;
            if (!preset)
                fail('AUTHOR_GENERATION_PRESET_NOT_FOUND');
            const shared = deps.variables.captureSharedScopes(sid, operationId, attemptId);
            const communityPolicy = deps.presets.policy(sid), cardMaterial = produceCommunityPresetCardMaterialV1({ captured, persona: deps.persona?.(),
                mappingScope: { sessionId: sid, conversationId: communityPolicy.conversationId },
                override: communityPolicy.effective.features.nativeCardMapping });
            if (cardMaterial.kind === 'mapping-required')
                fail('COMMUNITY_CARD_MAPPING_REQUIRED');
            return { captured, scopeData, clock, timed, binding, ordinaryChat, namespaceRootSha256, includeCardStyle, history, preset, shared, communityPolicy,
                storyText, messageView, cardMaterial,
                contentExecution: deps.captureContentExecution?.(sid, captured.compilation.plan) };
        }), signal);
        let collector, accepted = false;
        try {
            read.assertCurrent();
            const { captured, scopeData, clock, timed, binding, ordinaryChat, namespaceRootSha256, includeCardStyle, contentExecution, history, preset, shared, communityPolicy, storyText, messageView, cardMaterial } = read.data, { source, compilation } = captured, assertCurrent = () => {
                assertOwner();
                if (accepted)
                    return;
                read.assertCurrent();
                contentExecution?.assertCurrent();
                clock.assertCurrent();
                if (messageView && !messageView.current())
                    fail('AUTHOR_GENERATION_MESSAGE_VIEW_CHANGED');
            }, seed = recordSha256({ policySha256, operationId,
                sourceSha256: source.sourceSha256, scopeEvidence: scopeData.evidence, namespaceRootSha256 }), clockEpochMs = Date.now(), settings = resolveCapturedTavernPromptSettingsV1(source), normalized = normalizeAuthorGenerationOptionsV1(options, sampling(preset.settings)), overrides = object(options.overrides) ? options.overrides : {}, ordinaryStage = createRoleplayTavernOrdinaryStage({ inputId: operationId,
                assertMutationAllowed,
                contributionId: authorChatContributionIdV3(binding.namespace, operationId), attemptId,
                replacesAttemptId: null, initialRoot: ordinaryChat.root, values: ordinaryChat.values,
                ...ordinaryChat.scopeRef !== undefined ? { expectedScopeRef: ordinaryChat.scopeRef } : {} }), sharedStage = createRoleplayTavernSharedScopeStageV1(shared, [], assertMutationAllowed), currentCardFields = { description: typeof overrides.char_description === 'string' ? overrides.char_description :
                    cardMaterial.markers.charDescription.map(part => part.text).join('\n\n'),
                personality: typeof overrides.char_personality === 'string' ? overrides.char_personality :
                    cardMaterial.markers.charPersonality.map(part => part.text).join('\n\n'),
                scenario: typeof overrides.scenario === 'string' ? overrides.scenario :
                    cardMaterial.markers.scenario.map(part => part.text).join('\n\n'),
                persona: typeof overrides.persona_description === 'string' ? overrides.persona_description :
                    cardMaterial.markers.personaDescription.map(part => part.text).join('\n\n') }, declaredOutlets = compilation.plan.entries.flatMap(entry => {
                const semantic = { ...ST_LORE_ENTRY_DEFAULTS_V1, ...entry.semanticOverrides };
                return semantic.position === 'named-outlet' && semantic.outletName ? [semantic.outletName] : [];
            });
            const macrosFor = (scopes, outlets = []) => produceRoleplayTavernMacroSnapshotV1({
                source, cardData: captured.cardData, includeCardStyle,
                inputText: typeof options.user_input === 'string' ? options.user_input : null, scopes, outlets, declaredOutlets,
                presetVariables: communityPolicy.helperVariables, currentCardFields,
                preparedRoute,
                messageVariables: scopeData.messageVariables, clockEpochMs, randomSeed: seed
            }).snapshot;
            const macros = macrosFor(scopeData.bindings), rules = communityRegexRules(communityPolicy, captureRoleplayTavernScopedRegexV1(captured.cardData, source.sourceSha256, true)), context = source.current.openingContext.context, visibleMessages = [...clock.scanRows].reverse()
                .filter(row => row.authorMetadata?.is_hidden !== true).map(row => {
                const speakerName = row.authorMetadata?.name ?? (row.role === 'user' ? context.user : context.char), text = row.text, scanText = settings.includeNames ? `${speakerName}: ${text}` : text;
                return { messageId: row.id, versionSha256: row.messageSha256, role: row.role, speakerName, text, textSha256: sha256(text),
                    scanPolicy: 'owner-captured-st-message-string-v1', scanText, scanTextSha256: sha256(scanText) };
            }), runtime = await deps.loadEjs(signal), ejsContext = { user: context.user, char: context.char,
                messages: clock.scanRows.map(row => ({ messageId: row.id, role: row.role, content: row.text, mes: row.text,
                    is_user: row.role === 'user', name: row.authorMetadata?.name ?? (row.role === 'user' ? context.user : context.char),
                    is_hidden: row.authorMetadata?.is_hidden ?? false, extra: row.authorMetadata?.extra ?? {} })) };
            assertCurrent();
            if (messageView)
                ordinaryStage.bindMessages({ captures: messageView.ordinaryMessages, state: deps.authorChat });
            const definitions = captureRoleplayTavernInjectionDefinitionsV1(source, compilation.plan, captured.residual);
            collector = createRoleplayTavernEjsPreparation({ identity: { preparationId: attemptId, attemptGeneration: attemptId,
                    scriptIdentity: recordSha256(definitions.definitions), sourceSnapshotSha256: source.sourceSha256 },
                programs: deps.ejsPrograms, context: ejsContext, worldInfoSettings: settings, signal, assertCurrent,
                resources: snapshot => snapshot.lore.map(row => ({ id: row.key, loreKey: row.key, sourcePointer: row.sourcePointer,
                    sourceSnapshotSha256: row.sourceSnapshotSha256, contentSha256: row.contentSha256, text: row.content })) });
            let injections;
            let currentCharacter;
            let helperMessages;
            const ejs = collector.beginPlan(ordinaryStage, { shared: sharedStage, namedQueues: () => injections.namedQueues(),
                generationModel: () => ({ model: selection.actualRoute.model, source: 'prepared-generation' }),
                readCaptured: deps.namedWorldInfo?.({ sessionId: sid, source, rules,
                    scriptOrder: communityPolicy.regexOrder, assertCurrent }),
                currentCharacter: () => {
                    const projected = currentCharacter ??= projectCapturedTavernCharacterDataV1(captured, cardMaterial);
                    return projected.kind === 'available' ? { sourcePointer: '/data',
                        sourceSnapshotSha256: projected.identity.sourceSnapshotSha256, data: projected.character }
                        : { unavailable: projected.kind === 'unavailable' ? projected.code : 'COMMUNITY_CARD_MAPPING_REQUIRED' };
                },
                helperMessages: () => helperMessages ??= ({
                    rules,
                    scriptOrder: communityPolicy.regexOrder,
                    rows: clock.scanRows.map((row, index) => ({ index, messageId: row.id, messageVersionSha256: row.messageSha256,
                        depth: clock.scanRows.length - index - 1, name: row.authorMetadata?.name ?? (row.role === 'user' ? context.user : context.char),
                        nameSource: row.authorMetadata?.name !== undefined ? 'message' :
                            row.role === 'user' ? 'user' : 'character',
                        isUser: row.role === 'user', isSystem: false, text: row.text }))
                }),
                ordinaryMessageView: () => {
                    if (!messageView)
                        return undefined;
                    const messages = messageView.messages, last = messages.at(-1);
                    return { messages, captures: ordinaryStage.captureMessages(), current: last ? { message_id: last.index,
                            swipe_id: last.ordinary?.selectedTarget.identity.variant.kind === 'opening-variant'
                                ? last.ordinary.variants.findIndex(target => target === last.ordinary.selectedTarget) : 0 } : null };
                },
                presetCatalog: () => deps.presets.ejsPreset(sid) });
            injections = createRoleplayTavernInjectionRegistryV1({ sessionId: sid, turn: 0, step: 0, attemptId, history,
                auxiliaryOperationId: operationId,
                assertMutationAllowed,
                nativeConsumption: consumption,
                currentNativeCut: deps.inputState.nativeHistory?.cut
                    ? () => deps.inputState.nativeHistory.cut(session) : undefined,
                invokeNativeFilter: input => {
                    if (!deps.executeNativeFilter)
                        fail('INPUT_MATERIAL_NATIVE_FILTER_UNAVAILABLE');
                    return deps.executeNativeFilter(input, signal);
                }, afterNativeFilter: async () => { assertOwner(); return !read.current(); },
                retireNativeFilters: deps.retireNativeFilters,
                definitions: definitions.definitions, ejs: true,
                invokeEjs: input => ejs.invoke({ ...input, macros: ejs.macros(macros) }), retireEjs: deps.ejsPrograms.retire,
                assertCurrent, signal });
            injections.advanceRegex({ boundary: 'generation-start', phaseId: attemptId });
            const libraryReads = [...target.libraryReads];
            const consumeRequestInjections = async (consumer) => {
                const result = await consumeAuthorGenerationInjectionsV1(normalized.injects, consumer, target.invokeFilter);
                assertOwner();
                if (!read.current())
                    throw TAVERN_NATIVE_FILTER_RECAPTURE;
                assertCurrent();
                libraryReads.push(...result.libraryReads);
                return result.selected;
            };
            let regexOrdinal = 0, explicitScanConsumed = false, generateLoader;
            const sourceCatalog = createTavernSourceRenderCatalogV1({ source, plan: compilation.plan });
            const ordered = normalized.mode === 'raw' ? [...normalized.order] : preset.prompts
                .filter(row => row.enabled && row.position?.type !== 'in_chat')
                .map(row => presetMarkers[row.id] ?? { role: row.role, content: row.content ?? '' });
            // The explicit input occupies the same history cut in retrieval and in
            // the actual auxiliary request assembled below.
            if (normalized.mode === 'preset') {
                const at = ordered.indexOf('chat_history');
                ordered.splice(at < 0 ? ordered.length : at + 1, 0, 'user_input');
            }
            const historyOverride = object(overrides.chat_history) ? overrides.chat_history : {}, maxHistory = normalized.maxChatHistory, selectedHistory = maxHistory === 'all' ? clock.selected.messages :
                maxHistory === 0 ? [] : clock.selected.messages.slice(-maxHistory);
            let historyPrompts;
            if (ordered.includes('chat_history') && historyOverride.prompts !== undefined) {
                if (!Array.isArray(historyOverride.prompts))
                    fail('AUTHOR_GENERATION_HISTORY_INVALID');
                const prompts = historyOverride.prompts.map(rolePrompt);
                historyPrompts = maxHistory === 'all' ? prompts : maxHistory === 0 ? [] : prompts.slice(-maxHistory);
            }
            const prepared = await prepareRoleplayTavernContentV1({ captured, scopeData, timed: timed.timed, settings, visibleMessages, macrosFor,
                currentCardFields,
                ...deps.worldbookVector ? { worldbookVector: { access: deps.worldbookVector, operationId: `${operationId}:worldbook`,
                        basisSha256: clock.selected.sha256,
                        messages: count => {
                            const messages = [], request = (row, key) => {
                                if (row.role !== 'system' && row.content.trim())
                                    messages.push({ kind: 'request',
                                        messageId: `${operationId}:${key}`, versionSha256: recordSha256(row), role: row.role, text: row.content });
                            };
                            for (let index = ordered.length - 1; index >= 0 && messages.length < count; index--) {
                                const item = ordered[index];
                                if (typeof item !== 'string')
                                    request(item, `ordered:${index}`);
                                else if (item === 'user_input')
                                    request({ role: 'user',
                                        content: typeof options.user_input === 'string' ? options.user_input : '' }, `ordered:${index}:user-input`);
                                else if (item === 'chat_history') {
                                    if (historyPrompts) {
                                        for (let at = historyPrompts.length - 1; at >= 0 && messages.length < count; at--)
                                            request(historyPrompts[at], `history:${at}`);
                                    }
                                    else
                                        for (let at = selectedHistory.length - 1; at >= 0 && messages.length < count; at--) {
                                            const row = selectedHistory[at];
                                            if (row.message.authorMetadata?.is_hidden === true || row.role !== 'user' && row.role !== 'assistant')
                                                continue;
                                            const settled = row.eventSeq === null ? undefined : storyText?.blocks(row.eventSeq, row.message, row.messageSha256), text = row.message.content.flatMap((block, blockIndex) => block.type === 'text'
                                                ? [settled?.get(blockIndex) ?? block.text] : []).join('\n');
                                            if (text.trim())
                                                messages.push({ kind: 'native', messageId: row.id,
                                                    versionSha256: row.messageSha256, role: row.role, text });
                                        }
                                }
                            }
                            return messages;
                        } } } : {},
                ...contentExecution ? { execution: contentExecution.execution } : {},
                attempt: { attemptId, traceCounter: 0, provenance: produceTavernPromptVariableRefV1(`${sid}:actual-author-dialog`, recordSha256({ operationId, binding, namespaceRootSha256 }), { schemaVersion: 1,
                        encoding: 'native-author-dialog-content-attempt-v1', policySha256, operationId, binding,
                        namespaceRootSha256, nativeClockSha256: clock.data.clockSha256 }) },
                beforeLore: async ({ render, bindings }) => {
                    const phaseMacros = macrosFor(bindings);
                    generateLoader = createRoleplayTavernGenerateLoaderV1({ catalog: sourceCatalog, lookup: render.snapshot.lore,
                        authorsNoteDepth: 0, settings, phaseId: attemptId, seed,
                        projectKey: (row, field, index, text) => render.projectGenerateKey(row, field, index, text, phaseMacros),
                        renderEntry: (row, call) => render.renderGenerateLoaderEntry(row, call, phaseMacros), assertCurrent, signal });
                    await generateLoader.startBefore();
                },
                renderInput: { source, plan: compilation.plan, sourceCatalog, macros,
                    definitionFor: (pointer, entryId) => entryId ? definitions.definitionFor(pointer, entryId) : definitions.finalMessageDefinition,
                    ejs: { identity: runtime.identity, macros: ejs.macros,
                        getInitialValues: ejs.getInitialValues, bindInitial: ejs.bindInitial, async execute(input) {
                            const record = await ejs.execute(input);
                            injections.acceptEjsCreation(ejs.creationId(record), record, input.definition, input.phase);
                            return record;
                        } },
                    dynamicRegex: { hasBasic: () => injections.hasRegex('basic'), async apply(phase, snapshot, rows) {
                            const result = await injections.applyRegexBatch({ phase, phaseId: `render:${regexOrdinal++}`, snapshot, pieces: rows });
                            if (result.activationProposals.length)
                                fail('INPUT_MATERIAL_REGEX_ACTIVATION_REQUIRES_FEEDBACK');
                            return result.pieces;
                        } },
                    rules,
                    scriptOrder: communityPolicy.regexOrder, scopes: scopeData.bindings,
                    authorsNoteDepth: 0, basis: { sessionId: sid, branchId: sid, revision: timed.timed.revision,
                        turnId: attemptId, attemptId, packageSha256: source.original.documentSha256,
                        sourceSnapshotSha256: source.sourceSha256, stateSnapshotSha256: scopeData.stateSnapshotSha256,
                        clockEpochMs, randomSeed: seed }, assertCurrent, signal },
                loreProducer: (render, bindings) => ({ ...render.loreProducer, async consumeScan() {
                        const consumed = await injections.consume('scan', render.snapshot), selected = explicitScanConsumed ? [] : await consumeRequestInjections('scan'), explicit = selected.map((row, index) => ({
                            key: `author-generation-config:${operationId}:${index}`, content: row.content, depth: row.depth, role: row.role
                        })), texts = await render.transformInjectionContent([...explicit, ...consumed.prompts.map(row => ({ key: row.registrationSha256,
                                content: row.prompt.content, depth: row.prompt.depth, role: row.prompt.role }))], macrosFor(bindings));
                        explicitScanConsumed = true;
                        return { contributions: texts.map(row => ({ identity: row.key, text: row.text, textSha256: row.textSha256 })),
                            activationProposals: consumed.activationProposals.map(proposal => {
                                const entry = compilation.plan.entries.find(row => row.entryId === proposal.entryId);
                                if (!entry || proposal.sourceSnapshotSha256 !== source.sourceSha256)
                                    fail('AUTHOR_GENERATION_ACTIVATION_CHANGED');
                                return tavernSourceTemplateActivationV1(sourceCatalog, proposal);
                            }) };
                    } }) });
            assertCurrent();
            const finalById = new Map(prepared.finalLore.map(row => [row.entryId, row])), fields = { char_description: currentCardFields.description,
                char_personality: currentCardFields.personality, scenario: currentCardFields.scenario,
                persona_description: currentCardFields.persona,
                dialogue_examples: captured.residual.parts.filter(part => part.kind === 'examples').map(part => part.text).join('\n\n'),
                user_input: typeof options.user_input === 'string' ? options.user_input : '' };
            for (const [slot, position] of [['world_info_before', 'before-character'], ['world_info_after', 'after-character']])
                fields[slot] = prepared.evaluated.plan.placements.filter(row => row.position === position)
                    .map(row => finalById.get(row.entryId)?.text ?? '').filter(Boolean).join('\n');
            const renderText = async (key, text, role) => {
                const output = await prepared.render.render(`/native/author-dialog/${key}`, ordinaryMacros.render(text), { macros: prepared.authorMacros, placement: role === 'user' ? 1 : 2, phase: 'late-author' });
                assertCurrent();
                if (output.activationProposals.length)
                    fail('AUTHOR_GENERATION_LATE_ACTIVATION_UNSUPPORTED');
                return output.renderedText;
            };
            const helperReads = [];
            let helperWork = 0;
            const helperBudget = (size) => {
                helperWork += size;
                if (helperWork > TAVERN_PROMPT_TRANSFORM_LIMITS_V1.workChars)
                    fail('PROMPT_TRANSFORM_LIMIT');
            };
            const macroAliases = Object.fromEntries([...Object.values(prepared.authorMacros.names),
                ...prepared.authorMacros.card ?? [], ...prepared.authorMacros.dynamic ?? []]
                .filter(row => row.value !== null).map(row => [row.key, row.value])), ordinaryMacros = createCommunityMacroEvaluator({ seed, pickSeed: sid, clockEpochMs, aliases: macroAliases,
                chat: {}, global: {}, ordinary: ordinaryStage, shared: sharedStage,
                outlets: Object.fromEntries(prepared.authorMacros.outlets.map(row => [row.key, row.value ?? ''])),
                resolveUnknown(body, _rawText, _offset, renderedPrefix) {
                    if (!/^(get|format)_(message|chat|character|preset|global)_variable::/i.test(body))
                        return undefined;
                    // Resolve against the real staged values now. A following setvar
                    // cannot change a helper read which already supplied earlier text.
                    let snapshot = ejs.macros(prepared.authorMacros);
                    if (body.toLowerCase().includes('_message_variable::') && messageView) {
                        const lastId = clock.selected.messages.at(-1)?.id, selected = messageView.messages.find(row => row.messageId === lastId)?.ordinary?.selectedTarget, staged = selected ? ordinaryStage.captureMessages().find(row => recordSha256(row.root.namespace.target) === recordSha256(selected)) : undefined, original = snapshot.variableScopes?.message;
                        if (staged) {
                            const values = applyAuthorChatOverlayV3(original?.values ?? {}, staged);
                            snapshot = { ...snapshot, variableScopes: { ...snapshot.variableScopes,
                                    message: { ...original, scope: 'message',
                                        ownerId: original?.ownerId ?? `${sid}:ordinary-message:${recordSha256(staged.root.namespace)}`,
                                        values, valuesSha256: recordSha256(values),
                                        versionSha256: recordSha256({ previous: original?.versionSha256, root: staged.root, values }) } } };
                        }
                    }
                    const projector = createTavernPromptMacroProjectorV1(snapshot, {
                        formatPrefix: renderedPrefix, issue: code => fail(code), recordRead: read => helperReads.push(read),
                        budget: { job: assertCurrent, work: helperBudget, output: size => {
                                if (size > TAVERN_PROMPT_TRANSFORM_LIMITS_V1.outputChars)
                                    fail('PROMPT_TRANSFORM_LIMIT');
                            }, match: assertCurrent }
                    });
                    return projector.project(`{{${body}}}`);
                } });
            const historyOriginals = new Map();
            const historyMessages = async () => {
                let rows;
                if (historyPrompts) {
                    rows = [];
                    const rendered = [];
                    for (const [index, row] of historyPrompts.entries())
                        rendered.push(literal({ ...row,
                            content: await renderText(`history-override/${index}`, row.content, row.role) }));
                    rows = rendered;
                }
                else {
                    const selected = selectedHistory, blocks = selected.flatMap((row, index) => {
                        const settled = row.eventSeq === null ? undefined : storyText?.blocks(row.eventSeq, row.message, row.messageSha256);
                        return row.message.content.flatMap((block, blockIndex) => block.type === 'text' ? [{
                                key: `${index}:${blockIndex}`, text: settled?.get(blockIndex) ?? block.text,
                                role: row.role === 'user' ? 'user' : 'assistant', depth: selected.length - index - 1
                            }] : []);
                    }), transformed = new Map((await prepared.render.transformHistoryContent(blocks, prepared.authorMacros))
                        .map(row => [row.key, row.text])), settledTexts = new Map(blocks.map(row => [row.key, row.text]));
                    rows = selected.map((row, index) => {
                        const edits = row.message.content.flatMap((block, blockIndex) => {
                            if (block.type !== 'text')
                                return [];
                            const key = `${index}:${blockIndex}`, replacementText = transformed.get(key) ?? settledTexts.get(key) ?? block.text;
                            return replacementText === block.text ? [] : [{ blockIndex, replacementText }];
                        }), projected = projectNativeMessageTextV2(row.message, edits);
                        historyOriginals.set(projected, row.message);
                        return projected;
                    });
                }
                return rows;
            };
            const orderedMessages = await assembleAuthorGenerationMessagesV1(ordered, async (item) => {
                if (item === 'chat_history')
                    return historyMessages();
                const role = item === 'user_input' ? 'user' : 'system', raw = typeof overrides[item] === 'string'
                    ? overrides[item] : fields[item] ?? '', text = (item === 'world_info_before' || item === 'world_info_after') && overrides[item] === undefined
                    ? raw : await renderText(item, raw, role);
                return text.length || item === 'user_input' && options.image !== undefined
                    ? [literal({ role, content: text, ...item === 'user_input' && options.image !== undefined ? { image: options.image } : {} })] : [];
            }, (text, role, index) => renderText(`ordered/${index}`, text, role));
            const injected = await injections.consume('chat', prepared.render.snapshot);
            if (injected.activationProposals.length)
                fail('AUTHOR_GENERATION_LATE_ACTIVATION_UNSUPPORTED');
            const insertions = [];
            if (historyOverride.with_depth_entries !== false)
                for (const row of prepared.evaluated.plan.placements) {
                    if (row.position === 'at-chat-depth')
                        insertions.push({ role: row.role, content: finalById.get(row.entryId)?.text ?? row.text,
                            depth: row.depth ?? 0 });
                }
            if (typeof historyOverride.author_note === 'string')
                insertions.push({ role: 'system', content: historyOverride.author_note, depth: 0 });
            insertions.push(...await consumeRequestInjections('chat'));
            if (normalized.mode === 'preset')
                for (const row of preset.prompts
                    .flatMap(row => row.enabled && row.position?.type === 'in_chat'
                    ? [{ role: row.role, content: row.content ?? '', depth: row.position.depth, order: row.position.order }] : [])
                    .sort((a, b) => a.depth - b.depth || a.order - b.order)) {
                    insertions.push(row);
                }
            for (const row of injected.prompts)
                insertions.push(row.prompt);
            const renderedInsertions = [];
            for (const [index, row] of insertions.entries())
                renderedInsertions.push({ ...row,
                    content: await renderText(`injection/${index}`, row.content, row.role) });
            const messages = insertAuthorGenerationDepthMessagesV1(orderedMessages, renderedInsertions);
            injections.advanceRegex({ boundary: 'prompt-start', phaseId: attemptId });
            const slots = [], surface = { slots,
                messages: messages.map((message, messageOrdinal) => ({ messageOrdinal, role: message.role,
                    textSlots: message.content.flatMap((block, blockOrdinal) => {
                        if (block.type !== 'text')
                            return [];
                        const index = slots.length;
                        slots.push({ messageOrdinal, blockOrdinal, text: block.text, role: message.role,
                            provenance: { kind: 'insertion', contributionRef: `author-generation:${operationId}:${messageOrdinal}:${blockOrdinal}`,
                                sourceSha256: source.sourceSha256 } });
                        return [index];
                    }) })) };
            const finalOutputs = await generateLoader.finish(surface, async (slot, context) => {
                let text = slot.text;
                if (injections.hasRegex('generate')) {
                    const result = await injections.applyRegexBatch({ phase: 'generate', phaseId: `final:${regexOrdinal++}`,
                        snapshot: prepared.render.snapshot, pieces: [{ id: 'text', text,
                                ...slot.role === 'system' || slot.role === 'user' || slot.role === 'assistant' ? { role: slot.role } : {}, env: context }] });
                    if (result.activationProposals.length)
                        fail('AUTHOR_GENERATION_LATE_ACTIVATION_UNSUPPORTED');
                    text = result.pieces[0].text;
                }
                if (text.includes('<%')) {
                    const pointer = `derived:author-generate/${slot.messageOrdinal}/${slot.blockOrdinal}`, record = await ejs.execute({ snapshot: prepared.render.snapshot, macros: ejs.macros(prepared.authorMacros),
                        definition: definitions.finalMessageDefinition, phase: 'generate-final', context,
                        resource: { id: pointer, sourcePointer: pointer, sourceSnapshotSha256: source.sourceSha256,
                            contentSha256: sha256(text), text } });
                    if (record.creation.kind !== 'rendered')
                        fail(record.creation.diagnostic.code);
                    if (record.creation.output.activations.length)
                        fail('AUTHOR_GENERATION_LATE_ACTIVATION_UNSUPPORTED');
                    injections.acceptEjsCreation(ejs.creationId(record), record, definitions.finalMessageDefinition, 'generate-final');
                    text = record.creation.output.renderedText;
                }
                return text;
            });
            const finalByMessage = new Map();
            for (const output of finalOutputs) {
                let edits = finalByMessage.get(output.messageOrdinal);
                if (!edits) {
                    edits = new Map();
                    finalByMessage.set(output.messageOrdinal, edits);
                }
                edits.set(output.blockOrdinal, output.text);
            }
            for (const [ordinal, edits] of finalByMessage) {
                const message = messages[ordinal], original = historyOriginals.get(message), content = message.content.map((block, index) => block.type === 'text' && edits.has(index)
                    ? { ...block, text: edits.get(index) } : block);
                messages[ordinal] = original ? projectNativeMessageTextV2(original, content.flatMap((block, blockIndex) => block.type === 'text' && block.text !== original.content[blockIndex].text
                    ? [{ blockIndex, replacementText: block.text }] : [])) : { ...message, content };
            }
            injections.advanceRegex({ boundary: 'prompt-complete', phaseId: attemptId });
            injections.advanceNamed();
            const ordinaryPreparationEvidence = prepared.render.ordinaryPreparationEvidence(), injectionTransaction = injections.transaction(), preparation = { ordinaryChat: ordinaryStage.plan(), sharedScopes: [sharedStage.plan()] }, { snapshot, plan, material } = produceAuthorGenerationMaterialRecordsV1({ sessionId: sid, operationId,
                snapshot: { source, scopes: scopeData.evidence, canonicalChatClock: clock.data, ejsPreparation: ejs.finish(),
                    tavernEvaluationInput: prepared.evaluated.input,
                    injections: injectionTransaction, render: prepared.render.audit(), helperReads, libraryReads },
                plan: { ...preparation, effects: target.effects, libraryReads, orderedMessages: messages, call: normalized.call, tavernEvaluationPlan: prepared.evaluated.plan,
                    finalLore: prepared.finalLore, injectionTransactionSha256: injectionTransaction.transactionSha256 },
                captureSha256: recordSha256({ source: source.sourceSha256, operationId, scopeEvidence: scopeData.evidence }) });
            for (const [key, row] of [[material.snapshot.key, snapshot], [material.plan.key, plan]]) {
                const done = read.expectOutput({ table: 'branch', key, value: row });
                try {
                    await deps.branch.put(key, row);
                }
                finally {
                    done();
                }
                assertCurrent();
            }
            const prompt = freezeAuthorDialogPromptV1({ binding, root: ordinaryChat.root, operationId, selection,
                generationId: typeof options.generation_id === 'string' ? options.generation_id : operationId,
                mode: normalized.mode, orderedMessages: messages, call: normalized.call, presentation: normalized.presentation, material,
                ...ordinaryPreparationEvidence ? { ordinaryPreparationEvidence } : {} });
            return { prompt, assertCurrent() { assertCurrent(); if (!accepted)
                    injections.assertCurrent(); },
                accept() { accepted = true; read.release(); },
                async onCheckpoint(checkpoint) {
                    assertCurrent();
                    if (!checkpoint.current())
                        fail('AUTHOR_GENERATION_ACCEPTANCE_CHANGED');
                    if (target.effects === 'readonly')
                        return;
                    const result = await deps.variables.commitPreparation({ ...preparation, acceptedMaterialRef: material.plan }, { current: () => checkpoint.current() && current() });
                    if (result.outcome === 'retired')
                        fail('AUTHOR_GENERATION_CONTRIBUTION_RETIRED');
                }, release() {
                    collector?.retire();
                    contentExecution?.release();
                    read.release();
                    releaseTavernNativeInjectionConsumptionV1(consumption, history);
                } };
        }
        catch (error) {
            collector?.retire();
            read.data.contentExecution?.release();
            read.release();
            if (error === TAVERN_NATIVE_FILTER_RECAPTURE || error === TAVERN_NATIVE_FILTER_SOURCE_SUCCESSOR)
                return preparePrompt(sid, target, request, operationId, current, signal, consumption, selection);
            releaseTavernNativeInjectionConsumptionV1(consumption, read.data.history);
            throw error;
        }
    }
    async function restorePrompt(sid, prompt, current, signal) {
        await deps.preflight(sid, signal);
        const session = deps.session(sid);
        if (!session)
            fail('AUTHOR_DIALOG_SESSION_INACTIVE');
        const assertOwner = () => {
            signal.throwIfAborted();
            if (!current() || deps.session(sid) !== session)
                fail('BROWSER_ATTACHMENT_REVOKED');
        };
        const read = await deps.withSourceLock(sid, async () => deps.inputState.captureAuthorDialog({ session, signal,
            assertOwnerFactsCurrent: assertOwner }, prompt.operationId, () => {
            const snapshot = deps.branch.get(prompt.material.snapshot.key), planRecord = deps.branch.get(prompt.material.plan.key), preparation = readAcceptedPreparationPlanRecord(planRecord, prompt.material.plan.sha256), captured = captureRoleplayTavernPromptSourceDataV1(deps, sid, deps.includeCardStyle(sid));
            if (recordSha256(snapshot) !== prompt.material.snapshot.sha256 || !preparation
                || captured.kind !== 'captured-data' || captured.source.sourceSha256 !== snapshot?.payload?.source?.sourceSha256)
                fail('AUTHOR_GENERATION_FROZEN_SOURCE_CHANGED');
            return { preparation, effects: planRecord?.payload?.promptPlan?.effects };
        }), signal);
        let accepted = false;
        const assertCurrent = () => { assertOwner(); if (!accepted)
            read.assertCurrent(); };
        return { prompt, assertCurrent, accept() { accepted = true; read.release(); },
            async onCheckpoint(checkpoint) {
                assertCurrent();
                if (!checkpoint.current())
                    fail('AUTHOR_GENERATION_ACCEPTANCE_CHANGED');
                if (read.data.effects === 'readonly')
                    return;
                const result = await deps.variables.commitPreparation({ ...read.data.preparation, acceptedMaterialRef: prompt.material.plan }, { current: () => checkpoint.current() && current() });
                if (result.outcome === 'retired')
                    fail('AUTHOR_GENERATION_CONTRIBUTION_RETIRED');
            }, release: read.release };
    }
    return { capturePrompt, restorePrompt };
}
