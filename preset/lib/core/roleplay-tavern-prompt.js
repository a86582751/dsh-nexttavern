// Generated from runtime/alpha3/src/core/roleplay-tavern-prompt.ts; edit the TypeScript source.
/** One actual Core step owns Source capture, variable preparation, selected
 * template evaluation and Native layout data. None of the persisted receipts
 * can recreate the original step, Source lock or Native selected capability. */
import { assertNativeRequestMaterialSelectionV1, nativeInputSha256, projectNativeMessageTextV2 } from '@deepseek-ai/dsh-agent-loop';
import { recordSha256, sha256, textOf } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { captureRoleplayTavernPromptSourceDataV1 } from './roleplay-tavern-prompt-source.js';
import { captureRoleplayTavernPromptScopesV1 } from './roleplay-tavern-prompt-scopes.js';
import { captureRoleplayTavernTimedHistoryV2 } from './roleplay-tavern-lore-timed-lineage.js';
import { captureTavernCanonicalChatClockV1 } from './roleplay-tavern-chat-clock.js';
import { captureRoleplayTavernMaterialHistoryV1 } from './roleplay-tavern-material-history.js';
import { createRoleplayTavernInjectionRegistryV1 } from './roleplay-tavern-injections.js';
import { captureRoleplayTavernInjectionDefinitionsV1 } from './roleplay-tavern-injection-definitions.js';
import { produceRoleplayTavernMacroSnapshotV1, captureRoleplayTavernScopedRegexV1 } from './roleplay-tavern-prompt-macros.js';
import { prepareRoleplayTavernContentV1, produceTavernPromptVariableRefV1 as factRef, resolveCapturedTavernPromptSettingsV1, TAVERN_NATIVE_PROMPT_SETTINGS_V1 } from './roleplay-tavern-content.js';
import { createRoleplayTavernDerivedContentExecutionV1 } from './roleplay-tavern-derived-content-execution.js';
import { ST_LORE_ENTRY_DEFAULTS_V1 } from './tavern-lore-fixed-profile.mjs';
import { produceRoleplayTavernLayoutV1, TAVERN_NATIVE_OWNED_SECTION_NAMES_V1 } from './roleplay-tavern-layout.js';
import { produceAuthorPromptCaptureV1 } from './roleplay-author-prompt-capture.js';
export { TAVERN_NATIVE_PROMPT_SETTINGS_V1 } from './roleplay-tavern-content.js';
export const TAVERN_NATIVE_PROMPT_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-tavern-actual-core-preparation-policy-v1',
    settings: TAVERN_NATIVE_PROMPT_SETTINGS_V1, bookSettings: 'fixed-importer-metadata-not-applied',
    trace: 'actual-Core-input-attempt-generation; readonly-template-counter-adaptation',
    initialRegex: 'fixed-feature-worldinfo-call-without-generate-selector; no-registry-read',
    author: 'same-field-producer; macros-then-standalone-EJS; no-rerender-of-output',
    regex: 'activated-card-scoped-rules-in-bounded-worker; explicit-native-owned-allow-policy',
    timing: 'actual-Native-material-publication; persisted-consumer-data-only',
    lateAuthor: 'scan-and-chat-cut-before-author-EJS; default-persistent-next-generation; once-current-terminal',
    lateActivation: 'typed-refusal-after-lore-seal; no-silent-drop-or-invented-next-generation-activation',
    retry: 'same-Core-step-frozen-render-and-budget-ledger; actual-Native-selected-lineage-check',
    requests: { normal: 0, retry: 0, fallback: 0 } });
/** New optional producer policy leaves existing completed v1 bodies intact. */
export const TAVERN_NATIVE_PROMPT_POLICY_V2 = Object.freeze({ ...TAVERN_NATIVE_PROMPT_POLICY_V1, schemaVersion: 2,
    encoding: 'native-tavern-actual-core-preparation-policy-v2',
    generationHook: 'complete-stateless-PromptProgram1; actual-opening-anchored-Native-history-and-variable-DATA',
    promptEffects: 'typed-Prompt-producer-in-the-one-published-injection-registry; existing-scan-and-chat-cuts',
    promptClose: 'actual-Source-definition-close-and-Native-terminal-disposal; no-worker-or-provider-retry-close',
    promptTransport: { newPreparationWorkerRoundTrips: 1, browserRoundTrips: 0, preparedProviderRetryWorkerRoundTrips: 0 } });
export const TAVERN_NATIVE_PROMPT_POLICY_V3 = Object.freeze({ ...TAVERN_NATIVE_PROMPT_POLICY_V2, schemaVersion: 3,
    encoding: 'native-tavern-actual-core-preparation-policy-v3',
    generationHook: 'actual-live-Browser2-callbacks-then-stateless-Prompt1; same-InputState-capture',
    promptTransport: { newPreparationWorkerRoundTrips: 1, browserRoundTrips: 1, preparedProviderRetryWorkerRoundTrips: 0 },
    sourceCapture: 'synchronous-Source-FIFO-read; asynchronous-consumers-release-FIFO-and-retain-read-footprint' });
export const TAVERN_NATIVE_PROMPT_POLICY_V4 = Object.freeze({ ...TAVERN_NATIVE_PROMPT_POLICY_V3, schemaVersion: 4,
    encoding: 'native-tavern-actual-core-preparation-policy-v4',
    generationHook: 'actual-live-Browser3-Source-callbacks-then-stateless-Prompt1; same-InputState-capture',
    ordinaryKeys: 'all-admitted-declarations-at-this-worldline-cut; readonly-input-to-author-callback' });
const joinHistoryBlock = (messageIndex, blockIndex) => `history-${messageIndex}-${blockIndex}`;
function fail(code) { throw Error(code); }
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
function phaseASnapshot(deps, scope) {
    const ref = scope.currency.snapshot;
    if (!ref)
        fail('INPUT_MATERIAL_PHASE_A_SNAPSHOT_MISSING');
    const snapshot = deps.branch.get(ref.key);
    if (!snapshot || recordSha256(snapshot) !== ref.sha256 || snapshot.branchId !== scope.session.id
        || snapshot.turnId !== scope.turn || recordSha256(snapshot.inputPreparation) !== recordSha256({
        ...scope.currency, snapshot: undefined
    }))
        fail('INPUT_MATERIAL_PHASE_A_SNAPSHOT_CHANGED');
    return snapshot;
}
export function createRoleplayTavernPromptMaterialV1(deps) {
    const prepare = async (native, invocation) => {
        const scope = invocation.scope;
        const assertOwnerFactsCurrent = scope.assertOwnerFactsCurrent.bind(scope);
        const assertSignal = () => scope.signal.throwIfAborted();
        const inputCapture = await deps.withSourceLock(scope.session.id, async () => {
            // Synchronous capture records the real read footprint once. Inner DATA
            // suppliers need cancellation, not another read of the input owner's
            // Work/current outputs, which Native legitimately updates after capture.
            return deps.inputState.captureInput({ session: scope.session, signal: scope.signal,
                assertOwnerFactsCurrent, outputRows: [...scope.outputRows ?? [], ...deps.pendingOutputRows(scope.session.id)] }, () => {
                const author = deps.inputState.captureSource(scope.session.id, 'tavern-author', () => {
                    const includeCardStyle = deps.includeCardStyle(scope.session.id), authorPolicy = cloneRoleplayTavernLoreDataV1(deps.authorPolicy(scope.session.id), 262_144), authorPolicySha256 = recordSha256(authorPolicy), captured = captureRoleplayTavernPromptSourceDataV1(deps, scope.session.id, includeCardStyle);
                    if (captured.kind === 'outside-declared-domain')
                        return captured;
                    return { kind: 'author-data', includeCardStyle, authorPolicy, authorPolicySha256, captured };
                }).data;
                if (author.kind === 'outside-declared-domain')
                    return author;
                const opening = invocation.kind === 'program-opening'
                    ? deps.openingPreparation?.(invocation.native, invocation.scope, {
                        sourceCurrentIdentitySha256: author.captured.currentIdentitySha256, includeCardStyle: author.includeCardStyle,
                        editorRevision: author.captured.edits.revision, editorHeadSha256: author.captured.edits.headRef?.sha256 ?? null,
                        currentNativeOverlaySha256: author.captured.compilation.plan.currentNativeOverlaySha256 ?? null
                    }) : undefined;
                if (invocation.kind === 'program-opening' && !opening)
                    fail('OPENING_MATERIAL_ACTUAL_PREPARATION_REQUIRED');
                const player = invocation.kind === 'player' ? invocation.scope : undefined, playerSnapshot = player ? phaseASnapshot(deps, player) : undefined, snapshot = playerSnapshot ?? opening.snapshot, { source, compilation } = author.captured, storyRows = deps.storyRows(scope, native.selected), storyIds = new Set(storyRows.map(row => row.id)), initialSelectedSha256 = nativeInputSha256(native.selected);
                if (storyIds.size !== storyRows.length)
                    fail('INPUT_MATERIAL_STORY_SELECTION_DUPLICATE');
                // Phase A already chose the actual numerical domain. Reading every
                // alternative would repeat complete opening and inheritance audits.
                let domain;
                if (opening)
                    domain = { opening: opening.scopes };
                else if (playerSnapshot?.numericalState?.schemaVersion === 2)
                    domain = { schema: deps.schemaScopes(scope.session.id) };
                else if (playerSnapshot?.numericalState)
                    domain = { numerical: deps.numericalScopes(scope.session.id) };
                else
                    domain = { plain: deps.plainScopes(scope.session.id, author.captured.currentIdentitySha256) };
                const scopeData = captureRoleplayTavernPromptScopesV1({ source,
                    currentIdentitySha256: author.captured.currentIdentitySha256, selected: native.selected,
                    ...domain,
                    isStoryMessage: row => storyIds.has(row.id), assertOwnerCurrent: assertSignal });
                const authorPromptFacts = domain.schema?.authorPrompt, authorBrowserFacts = domain.schema?.authorBrowserV3 ?? domain.schema?.authorBrowser;
                const materialHistory = captureRoleplayTavernMaterialHistoryV1({ sessionId: scope.session.id, table: deps.branch,
                    events: () => scope.session.snapshotEvents(), projections: deps.projections, assertOwnerCurrent: assertSignal });
                const chatClock = captureTavernCanonicalChatClockV1({ session: scope.session, selected: native.selected,
                    assertOwnerCurrent: assertSignal }), inheritedTiming = deps.inheritedTiming(scope, source, assertSignal, author.captured.sourceLineage), timed = captureRoleplayTavernTimedHistoryV2({ sessionId: scope.session.id, source, compilation, ownHistory: materialHistory,
                    inheritedHistory: inheritedTiming?.inheritedHistory, sourceLineage: inheritedTiming?.sourceLineage,
                    clock: chatClock, projections: deps.projections(), assertOwnerCurrent: assertSignal,
                    assertSourceLineageCurrent: () => inheritedTiming?.assertCurrent() });
                const { kind: _authorKind, ...authorData } = author;
                const derived = deps.derivedSnapshot?.(scope.session.id);
                return { kind: 'input-data', ...authorData, opening, player, playerSnapshot, snapshot, storyRows, derived,
                    initialSelectedSha256, scopeData, materialHistory, chatClock, timed, authorPromptFacts, authorBrowserFacts };
            });
        }, scope.signal);
        if (inputCapture.data.kind === 'outside-declared-domain') {
            const outside = inputCapture.data;
            inputCapture.release();
            if (['ACTIVE_SOURCE_MISSING', 'LEGACY_SOURCE_OUTSIDE_DOMAIN'].includes(outside.reason))
                return outside;
            fail(`INPUT_MATERIAL_${outside.reason}`);
        }
        const { captured, opening, player, playerSnapshot, snapshot, storyRows, initialSelectedSha256, scopeData, materialHistory, chatClock, timed, authorPromptFacts, authorBrowserFacts, includeCardStyle, authorPolicy, authorPolicySha256, derived } = inputCapture.data, { source, compilation, original, residual } = captured, assertCurrent = () => { inputCapture.assertCurrent(); derived?.assertCurrent(); };
        try {
            assertCurrent();
            const attemptId = opening?.attempt.attemptId ?? `${player.currency.preparationId}:${player.currency.attemptGeneration}`, turnId = String(scope.turn), seed = opening ? recordSha256(opening.attempt.seed) :
                recordSha256({ schemaVersion: 1, encoding: 'native-tavern-attempt-seed-v1',
                    currency: player.currency, sourceSha256: source.sourceSha256, selectedSha256: native.selected.sha256 }), clockEpochMs = Date.now(), packageSha256 = source.original.documentSha256, browserGeneration = authorBrowserFacts?.program.requiredCapabilities.includes('owned-generation-callbacks') === true, policy = browserGeneration ? (authorBrowserFacts?.program.schemaVersion === 3
                ? TAVERN_NATIVE_PROMPT_POLICY_V4 : TAVERN_NATIVE_PROMPT_POLICY_V3) :
                authorPromptFacts ? TAVERN_NATIVE_PROMPT_POLICY_V2 : TAVERN_NATIVE_PROMPT_POLICY_V1;
            const declaredOutlets = compilation.plan.entries.flatMap(entry => {
                const semantic = { ...ST_LORE_ENTRY_DEFAULTS_V1, ...entry.semanticOverrides };
                return semantic.position === 'named-outlet' && semantic.outletName ? [semantic.outletName] : [];
            });
            const macrosFor = (scopes, outlets = []) => produceRoleplayTavernMacroSnapshotV1({ source, cardData: captured.cardData, includeCardStyle,
                inputText: playerSnapshot ? playerSnapshot.userText : null, scopes, outlets, declaredOutlets }).snapshot;
            const macros = macrosFor(scopeData.bindings), rules = captureRoleplayTavernScopedRegexV1(captured.cardData, source.sourceSha256, true);
            const component = await deps.loadTemplate(scope.signal);
            assertCurrent();
            let authorPrompt;
            let authorBrowser;
            const hookFacts = authorPromptFacts ?? authorBrowserFacts, hookCapture = hookFacts ? produceAuthorPromptCaptureV1({ history: chatClock, scopes: hookFacts.scopes,
                opening: hookFacts.opening, attemptId, clockEpochMs, randomSeed: seed }) : undefined;
            if (authorBrowserFacts && browserGeneration) {
                if (!deps.executeAuthorBrowser)
                    fail('INPUT_MATERIAL_AUTHOR_BROWSER_UNAVAILABLE');
                const output = await deps.executeAuthorBrowser(scope.session.id, authorBrowserFacts.program, hookCapture, authorBrowserFacts, scope.signal);
                assertCurrent();
                authorBrowser = { capture: hookCapture, output };
            }
            if (authorPromptFacts) {
                const capture = hookCapture;
                const execution = await deps.executeAuthorPrompt(scope.session.id, authorPromptFacts.program, capture, scope.signal);
                assertCurrent();
                if (execution.kind !== 'executed')
                    fail(execution.diagnostics[0]?.code ?? 'INPUT_MATERIAL_AUTHOR_PROMPT_REFUSED');
                authorPrompt = { capture, output: execution.output };
            }
            const note = snapshot.contextMessageRefs?.refs.find(row => row.form === 'director-notes'), noteIndex = note ? native.selected.messages.findIndex(row => row.id === note.id && row.messageSha256 === note.messageSha256) : -1;
            const definitions = captureRoleplayTavernInjectionDefinitionsV1(source, compilation.plan, residual, authorPromptFacts?.program, authorBrowserFacts?.program), injections = createRoleplayTavernInjectionRegistryV1({ sessionId: scope.session.id, turn: scope.turn, step: scope.step,
                attemptId, history: materialHistory, definitions: definitions.definitions, promptDefinition: definitions.promptDefinition,
                browserDefinition: definitions.browserDefinition, component, assertCurrent, signal: scope.signal });
            if (authorBrowser && authorBrowserFacts && definitions.browserDefinition) {
                injections.acceptBrowserGeneration(authorBrowserFacts.program, authorBrowser.capture, authorBrowser.output, definitions.browserDefinition);
                assertCurrent();
            }
            if (authorPrompt && authorPromptFacts && definitions.promptDefinition) {
                await injections.acceptPromptGeneration(authorPromptFacts.program, authorPrompt.capture, authorPrompt.output, definitions.promptDefinition);
                assertCurrent();
            }
            const attempt = opening ? { attemptId, traceCounter: opening.attempt.traceCounter,
                provenance: opening.attempt.provenance } : { attemptId, traceCounter: player.currency.attemptGeneration,
                provenance: factRef(`${scope.session.id}:actual-input-attempt`, recordSha256(player.currency), {
                    schemaVersion: 1, encoding: 'actual-Core-prompt-variable-attempt-v1', currency: player.currency,
                    preparation: player.preparation, turn: scope.turn, step: scope.step, policySha256: recordSha256(policy)
                }) };
            const settings = resolveCapturedTavernPromptSettingsV1(source), context = source.current.openingContext.context;
            if (typeof context.user !== 'string' || typeof context.char !== 'string')
                fail('INPUT_MATERIAL_OPENING_NAMES_UNAVAILABLE');
            const visibleMessages = [...chatClock.scanRows].reverse().map(row => {
                if (row.role !== 'user' && row.role !== 'assistant')
                    fail('INPUT_MATERIAL_STORY_ROLE_CHANGED');
                const text = row.text, speakerName = row.role === 'user' ? context.user : context.char, scanText = settings.includeNames ? `${speakerName}: ${text}` : text;
                return { messageId: row.id, versionSha256: row.messageSha256, role: row.role, speakerName, text, textSha256: sha256(text),
                    scanPolicy: 'owner-captured-st-message-string-v1', scanText, scanTextSha256: sha256(scanText) };
            });
            const { render, initialCatalog, variables, evaluated, finalLore, authorMacros } = await prepareRoleplayTavernContentV1({
                captured, scopeData, attempt, timed: timed.timed, visibleMessages, settings, macrosFor,
                ...derived ? { execution: createRoleplayTavernDerivedContentExecutionV1(compilation.plan, derived) } : {},
                renderInput: { source, plan: compilation.plan, macros, rules,
                    component, scopes: scopeData.bindings, authorsNoteDepth: noteIndex < 0 ? 0 : native.selected.messages.length - noteIndex - 1,
                    basis: { sessionId: scope.session.id, branchId: scope.session.id, revision: timed.timed.revision, turnId, attemptId,
                        packageSha256, sourceSnapshotSha256: source.sourceSha256, stateSnapshotSha256: scopeData.stateSnapshotSha256,
                        clockEpochMs, randomSeed: seed }, assertCurrent, signal: scope.signal, definitionFor: definitions.definitionFor,
                    onCreation: (request, output, definition, phase) => injections.acceptCreation(request, output, definition, phase) },
                loreProducer(render, bindings) {
                    return Object.freeze({ ...render.loreProducer, async consumeScan() {
                            const consumed = await injections.consume('scan', render.snapshot);
                            const texts = await render.transformInjectionContent(consumed.prompts.map(row => ({ key: row.registrationSha256,
                                content: row.prompt.content, depth: row.prompt.depth, role: row.prompt.role })), macrosFor(bindings));
                            const activationProposals = consumed.activationProposals.map(proposal => {
                                const entry = compilation.plan.entries.find(row => row.entryId === proposal.entryId);
                                if (!entry || proposal.sourceSnapshotSha256 !== source.sourceSha256 || proposal.branchId !== scope.session.id
                                    || proposal.turnId !== turnId || proposal.attemptId !== attemptId)
                                    fail('INPUT_MATERIAL_INJECTION_ACTIVATION_CHANGED');
                                return { entryId: entry.entryId, rawEntrySha256: entry.rawEntrySha256 };
                            });
                            return { contributions: texts.map(row => ({ identity: row.key, text: row.text, textSha256: row.textSha256 })), activationProposals };
                        } });
                }
            });
            // The fixed host consumes in-chat extension prompts before its final
            // author EJS pass. Capture this cut once: late persistent registrations
            // belong to the following generation and late once still closes here.
            const injectedChat = await injections.consume('chat', render.snapshot);
            const injectedTexts = await render.transformInjectionContent(injectedChat.prompts.map(row => ({ key: row.registrationSha256,
                content: row.prompt.content, depth: row.prompt.depth, role: row.prompt.role })), authorMacros);
            if (injectedChat.activationProposals.length)
                fail('INPUT_MATERIAL_POST_LORE_INJECTION_ACTIVATION_REQUIRES_FEEDBACK');
            // These calls share an ordered execution journal; serial invocation keeps
            // each source pointer, macro receipt and standalone output unambiguous.
            const author = [];
            author.push(await render.render('/native/current-author/cards', residual.cardsText, { macros: authorMacros, placement: 1, phase: 'late-author' }));
            author.push(await render.render('/native/current-author/rules', residual.rulesText, { macros: authorMacros, placement: 1, phase: 'late-author' }));
            author.push(await render.render('/native/current-author/examples', residual.examplesText, { macros: authorMacros, placement: 1, phase: 'late-author' }));
            if (author.some(row => row.activationProposals.length))
                fail('INPUT_MATERIAL_LATE_AUTHOR_ACTIVATION_UNSUPPORTED');
            // The existing chat-clock owner has already classified canonical prose.
            // Native supplies the actual request selection; management/maintenance
            // assistants never acquire AI_OUTPUT placement through continuity rows.
            const canonicalAssistantIds = new Set(chatClock.data.rows.filter(row => row.role === 'assistant').map(row => row.id)), historyRows = invocation.kind === 'player' ? native.selected.messages.filter(row => row.role === 'user' && row.message.role === 'user' && row.message.source.kind === 'user'
                || row.role === 'assistant' && canonicalAssistantIds.has(row.id)) : [], historyBlocks = historyRows.flatMap((selected, index) => selected.message.content.flatMap((block, blockIndex) => block.type === 'text' ? [{ key: joinHistoryBlock(index, blockIndex), text: block.text,
                    role: selected.role === 'user' ? 'user' : 'assistant',
                    depth: historyRows.length - index - 1 }] : [])), historyTexts = new Map((await render.transformHistoryContent(historyBlocks, authorMacros))
                .map(row => [row.key, row.text])), messageTextProjections = [];
            for (const [index, selected] of historyRows.entries()) {
                const textEdits = selected.message.content.flatMap((block, blockIndex) => {
                    const replacementText = historyTexts.get(joinHistoryBlock(index, blockIndex));
                    return block.type === 'text' && replacementText !== undefined && replacementText !== block.text
                        ? [{ blockIndex, replacementText }] : [];
                });
                if (!textEdits.length)
                    continue;
                const projected = projectNativeMessageTextV2(selected.message, textEdits);
                messageTextProjections.push({ target: { id: selected.id,
                        role: selected.role === 'user' ? 'user' : 'assistant', messageSha256: selected.messageSha256 },
                    textEdits, projectionSha256: nativeInputSha256(projected) });
            }
            const injectionTransaction = injections.transaction();
            assertCurrent();
            const layout = produceRoleplayTavernLayoutV1({ native, original, residual, evaluation: evaluated.plan, finalLore,
                phaseASnapshot: snapshot.contextMessageRefs, renderedAuthor: { cardsText: author[0].renderedText,
                    rulesText: author[1].renderedText, examplesText: author[2].renderedText }, injected: injectedChat.prompts.map((row, index) => ({
                    contributionRef: `inject-${row.registrationSha256}`, sourceSha256: sha256(row.prompt.content),
                    requestedRole: row.prompt.role, requestedDepth: row.prompt.depth, renderedText: injectedTexts[index].text,
                    renderedSha256: injectedTexts[index].textSha256
                })) });
            const semanticStory = storyRows.map(row => ({ id: row.id, role: row.role, messageSha256: row.messageSha256 })), semanticStoryIds = new Set(semanticStory.map(row => row.id)), semanticStorySha256 = recordSha256(semanticStory);
            const { source: _editSource, ...editData } = captured.edits, { source: _variableSource, ...variableInput } = variables.input;
            const renderedAuthorMaterial = freeze({
                sourceCurrentIdentitySha256: captured.currentIdentitySha256,
                authorGroups: [
                    { id: '/native/current-author/cards', text: author[0].renderedText,
                        parts: residual.parts.filter(part => part.kind === 'card') },
                    { id: '/native/current-author/rules', text: author[1].renderedText,
                        parts: residual.parts.filter(part => part.kind !== 'card' && part.kind !== 'examples') },
                    { id: '/native/current-author/examples', text: author[2].renderedText,
                        parts: residual.parts.filter(part => part.kind === 'examples') },
                ], finalLore, compilationEntries: compilation.plan.entries.map(({ entryId, ordinal, sourceKey, sourcePointer }) => ({ entryId, ordinal, sourceKey, sourcePointer })), currentNativeMembership: !!compilation.plan.currentNativeMembership,
            });
            return { kind: 'prepared-data', ...layout,
                renderedAuthorMaterial,
                ...messageTextProjections.length ? { messageTextProjections } : {},
                snapshot: freeze({ schemaVersion: 1, encoding: 'native-tavern-prompt-capture-v1', authority: 'consumer-data-only',
                    policy, source, ...authorPrompt ? { authorPrompt } : {}, ...authorBrowser ? { authorBrowser } : {},
                    authorPolicy, authorPolicySha256,
                    edits: { ...editData, sourceRef: { sourceSha256: source.sourceSha256 } },
                    initialCatalogReceipt: initialCatalog.receipt,
                    variablesInput: { ...variableInput, sourceRef: { sourceSha256: source.sourceSha256 } }, variables: variables.packet,
                    scopes: scopeData.evidence, timed: timed.evidence, canonicalChatClock: chatClock.data,
                    originalAuthor: original, residualAuthor: residual,
                    injections: injectionTransaction, injectionAudit: injections.audit(),
                    tavernEvaluationInput: evaluated.input, render: render.audit(), initialNativeSelected: native.selected,
                    ...opening ? { openingPreparation: { snapshotRef: opening.snapshotRef, ownedBranchRefs: opening.ownedBranchRefs, scopeFacts: opening.scopes.data,
                            attempt: opening.attempt } } : { phaseASnapshotRef: player.currency.snapshot } }),
                plan: freeze({ schemaVersion: 1, encoding: 'native-tavern-prompt-plan-v1', authority: 'consumer-data-only',
                    policySha256: recordSha256(policy), tavernEvaluationPlan: evaluated.plan,
                    finalLore, layout: layout.layout, variablePacketSha256: variables.packet.packetSha256,
                    ...messageTextProjections.length ? { historyTextProjection: {
                            policy: 'selected-real-user-and-canonical-assistant-per-text-block-prompt-regex-only-v1',
                            messageTextProjections
                        } } : {},
                    ...authorPrompt ? { authorPromptOutputSha256: authorPrompt.output.outputSha256 } : {},
                    ...authorBrowser ? { authorBrowserOutputSha256: authorBrowser.output.outputSha256 } : {},
                    injectionTransactionSha256: injectionTransaction.transactionSha256 }), assertCurrent,
                release() { derived?.release(); inputCapture.release(); },
                assertSelected(selected, firstAttempt) {
                    // Only the original callback object is accepted during preparation,
                    // before Native registers its private lineage. All later objects must
                    // carry that real lineage; copied snapshots cannot pass this check.
                    if (selected === native.selected) {
                        if (!firstAttempt || nativeInputSha256(selected) !== initialSelectedSha256)
                            fail('INPUT_MATERIAL_INITIAL_SELECTION_CHANGED');
                    }
                    else
                        assertNativeRequestMaterialSelectionV1(native.selected, selected);
                    const actual = selected.messages.filter(row => semanticStoryIds.has(row.id))
                        .map(row => ({ id: row.id, role: row.role, messageSha256: row.messageSha256 }));
                    if (recordSha256(actual) !== semanticStorySha256)
                        fail('INPUT_MATERIAL_STORY_SELECTION_CHANGED');
                } };
        }
        catch (error) {
            derived?.release();
            inputCapture.release();
            throw error;
        }
    };
    return { sectionNames: TAVERN_NATIVE_OWNED_SECTION_NAMES_V1,
        prepare: (native, scope) => prepare(native, { kind: 'player', scope }),
        prepareOpening: (native, scope) => prepare(native, { kind: 'program-opening', scope, native }) };
}
