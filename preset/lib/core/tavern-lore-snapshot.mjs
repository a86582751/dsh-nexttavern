// Generated from runtime/alpha3/src/core/tavern-lore-snapshot.mts; edit the TypeScript source.
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData, schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { refuse } from './tavern-lore-match.mjs';
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
export const isSha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function exact(value, keys) {
    if (!object(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) {
        refuse('LORE_SNAPSHOT_SHAPE');
    }
}
const text = (value, max = 256) => typeof value === 'string' && value.length > 0
    && Buffer.byteLength(value, 'utf8') <= max;
const integer = (value, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number'
    && Number.isSafeInteger(value) && value >= 0 && value <= max;
export function freezeLoreData(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freezeLoreData(child);
        Object.freeze(value);
    }
    return value;
}
export const LORE_EVALUATOR_POLICY_V1 = freezeLoreData({ schemaVersion: 1,
    id: 'owned-st-single-book-scan-feedback-v1', upstreamCommit: '06bde939fb1e9c4c8d8641d810f0a916b5bce127',
    domain: 'single-embedded-character-book; bounded-declared-template-activation-feedback; no-author-callback',
    scan: 'ascending-depth; owner-captured-scan-string; trim; U+0001-newline-boundaries; recursion-and-min-depth-skew',
    ordering: 'order-desc-then-source-ordinal; placement-reverse-except-outlet',
    randomness: 'sha256-counter-domain-separated-v1; replaces-ST-Math.random',
    budget: 'frozen-cumulative-token-ledger-st-gte-v1; empty-scan-token-base; keeps-overflow-candidate; ignore-budget-can-follow',
    template: 'key-group-probability-selected-before-real-budget; trusted-standalone-producer-once; frozen-replay',
    timed: 'start-inclusive-protected; end-exclusive; sticky-before-cooldown; raw-and-effective-semantic-pins',
    feedback: 'declared-entry-activation-only; duplicates-dedupe; nested-frame-audit-owned-by-Root',
    injectedScan: 'owned-registry-captured-phase; serial-actual-filters; scan-text-excluded-from-WI-token-budget; frozen-replay',
    unsupported: ['multi-group-membership', 'decorators', 'world-info-content-regex', 'key-macros', 'automation', 'trigger-filter'],
    bounds: { inputBytes: 16_777_216, snapshotBytes: 4_194_304, outputBytes: 8_388_608,
        messages: 1000, scanChars: 32768, renderedTexts: 4096, tokenCounts: 4096, contentBytes: 2_000_000,
        regexWorkerDispatches: 128, scanSteps: 2048, feedbackProposals: 8192 },
});
export const LORE_EVALUATOR_POLICY_SHA256 = recordSha256(LORE_EVALUATOR_POLICY_V1);
/** Hashes bind the supplied input, never prove the actual branch/currentness. */
export function validateTavernLoreSnapshotV1(input) {
    const value = cloneSchemaData(input, LORE_EVALUATOR_POLICY_V1.bounds.snapshotBytes, { nodes: 100000, depth: 48 });
    const hasFeedback = object(value) && Object.hasOwn(value, 'activationFeedback');
    const hasInjections = object(value) && Object.hasOwn(value, 'injectionFeedback');
    exact(value, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'branchId', 'revision', 'turnId', 'attemptId',
        'sourceSnapshotSha256', 'stateSnapshotSha256', 'sourceReferenceSha256', 'packageSha256', 'compilerPlanSha256',
        'visibleMessages', 'messagesSha256', 'settings', 'settingsSha256', 'seed', 'seedSha256', 'globalScanData',
        'globalScanDataSha256', 'timed', 'timedSha256', 'tokenizer', 'tokenizerSha256', 'renderedTexts',
        'renderedTextsSha256', 'snapshotSha256',
        ...(hasFeedback ? ['activationFeedback', 'activationFeedbackSha256'] : []),
        ...(hasInjections ? ['injectionFeedback', 'injectionFeedbackSha256'] : [])]);
    if (value.schemaVersion !== 1 || value.encoding !== 'owned-st-lore-frozen-snapshot-v1'
        || value.authority !== 'consumer-data-only' || !integer(value.revision))
        refuse('LORE_SNAPSHOT_IDENTITY');
    for (const key of ['sessionId', 'branchId', 'turnId', 'attemptId'])
        if (!text(value[key]))
            refuse('LORE_SNAPSHOT_IDENTITY');
    for (const key of ['sourceSnapshotSha256', 'stateSnapshotSha256', 'sourceReferenceSha256', 'packageSha256',
        'compilerPlanSha256', 'messagesSha256', 'settingsSha256', 'seedSha256', 'globalScanDataSha256', 'timedSha256',
        'tokenizerSha256', 'renderedTextsSha256', 'snapshotSha256'])
        if (!isSha(value[key]))
            refuse('LORE_SNAPSHOT_HASH');
    const settings = value.settings;
    exact(settings, ['policy', 'provenance', 'caseSensitive', 'matchWholeWords', 'scanDepth', 'useGroupScoring',
        'recursiveScanning', 'minimumActivations', 'minimumActivationDepthMax', 'maxRecursionSteps', 'includeNames',
        'characterStrategy', 'budgetTokens', 'contentTransformPolicy', 'macroPolicy', 'seedPolicy', 'budgetPolicy']);
    if (!['owned-st-single-book-initial-scan-v1', 'owned-st-single-book-scan-feedback-v1'].includes(String(settings.policy))
        || !['actual-runtime-settings', 'explicit-native-fallback-v1'].includes(String(settings.provenance))
        || settings.characterStrategy !== 'single-character-book-v1'
        || settings.contentTransformPolicy !== 'no-world-info-output-regex-v1'
        || settings.macroPolicy !== 'frozen-rendered-receipt-or-marker-free-v1'
        || settings.seedPolicy !== 'sha256-counter-domain-separated-v1'
        || settings.budgetPolicy !== 'frozen-cumulative-token-ledger-st-gte-v1')
        refuse('LORE_SETTINGS_POLICY_UNSUPPORTED');
    for (const key of ['caseSensitive', 'matchWholeWords', 'useGroupScoring', 'recursiveScanning', 'includeNames']) {
        if (typeof settings[key] !== 'boolean')
            refuse('LORE_SETTINGS_VALUE');
    }
    for (const key of ['scanDepth', 'minimumActivations', 'minimumActivationDepthMax', 'maxRecursionSteps']) {
        if (!integer(settings[key], 1000))
            refuse('LORE_SETTINGS_VALUE');
    }
    if (!integer(settings.budgetTokens, 10_000_000))
        refuse('LORE_SETTINGS_VALUE');
    if (!Array.isArray(value.visibleMessages) || value.visibleMessages.length > 1000)
        refuse('LORE_MESSAGES_LIMIT');
    const messages = new Set();
    for (const row of value.visibleMessages) {
        exact(row, ['messageId', 'versionSha256', 'role', 'speakerName', 'text', 'textSha256',
            'scanPolicy', 'scanText', 'scanTextSha256']);
        if (!text(row.messageId) || messages.has(row.messageId) || !isSha(row.versionSha256)
            || !['system', 'user', 'assistant'].includes(String(row.role)) || typeof row.speakerName !== 'string'
            || Buffer.byteLength(row.speakerName, 'utf8') > 256 || typeof row.text !== 'string'
            || !isSha(row.textSha256) || schemaTextSha256(row.text) !== row.textSha256
            || row.scanPolicy !== 'owner-captured-st-message-string-v1' || typeof row.scanText !== 'string'
            || !isSha(row.scanTextSha256) || schemaTextSha256(row.scanText) !== row.scanTextSha256)
            refuse('LORE_MESSAGE_INVALID');
        messages.add(row.messageId);
    }
    exact(value.globalScanData, ['personaDescription', 'characterDescription', 'characterPersonality',
        'characterDepthPrompt', 'scenario', 'creatorNotes']);
    if (Object.values(value.globalScanData).some(item => typeof item !== 'string'))
        refuse('LORE_SCAN_DATA_INVALID');
    const timed = value.timed;
    exact(timed, ['schemaVersion', 'encoding', 'branchId', 'revision', 'chatIndex', 'intervals']);
    if (timed.schemaVersion !== 1 || timed.encoding !== 'owned-st-branch-timed-input-v1' || timed.branchId !== value.branchId
        || timed.revision !== value.revision || !integer(timed.chatIndex) || !Array.isArray(timed.intervals)
        || timed.intervals.length > 4096)
        refuse('LORE_TIMED_INPUT_INVALID');
    const intervals = new Set();
    for (const row of timed.intervals) {
        exact(row, ['entryId', 'rawEntrySha256', 'entrySemanticSha256', 'kind', 'start', 'end', 'protected']);
        if (!isSha(row.entryId) || !isSha(row.rawEntrySha256) || !isSha(row.entrySemanticSha256) || !['sticky', 'cooldown'].includes(String(row.kind))
            || !integer(row.start) || !integer(row.end) || row.end <= row.start || typeof row.protected !== 'boolean') {
            refuse('LORE_TIMED_INPUT_INVALID');
        }
        const identity = `${row.entryId}:${row.kind}`;
        if (intervals.has(identity))
            refuse('LORE_TIMED_INPUT_DUPLICATE');
        intervals.add(identity);
    }
    if (Object.hasOwn(value, 'activationFeedback')) {
        if (!Array.isArray(value.activationFeedback) || value.activationFeedback.length > 4096
            || !isSha(value.activationFeedbackSha256)
            || recordSha256(value.activationFeedback) !== value.activationFeedbackSha256)
            refuse('LORE_FEEDBACK_INVALID');
        const feedbackEntries = new Set();
        let proposals = 0;
        for (const row of value.activationFeedback) {
            exact(row, ['request', 'renderedSha256', 'activationProposals', 'feedbackSha256']);
            const request = row.request;
            exact(request, ['schemaVersion', 'encoding', 'entryId', 'rawEntrySha256', 'entrySemanticSha256', 'pointer',
                'rawContentSha256', 'text', 'attemptId', 'compilerPlanSha256', 'loop', 'state', 'selectionSha256']);
            if (request.schemaVersion !== 1 || request.encoding !== 'owned-st-lore-selected-template-request-v1'
                || !isSha(request.entryId) || feedbackEntries.has(request.entryId) || !isSha(request.rawEntrySha256)
                || !isSha(request.entrySemanticSha256) || !text(request.pointer, 4096) || !request.pointer.startsWith('/')
                || typeof request.text !== 'string' || schemaTextSha256(request.text) !== request.rawContentSha256
                || request.attemptId !== value.attemptId || request.compilerPlanSha256 !== value.compilerPlanSha256
                || !integer(request.loop, LORE_EVALUATOR_POLICY_V1.bounds.scanSteps) || request.loop < 1
                || !['initial', 'recursion', 'minimum-activations'].includes(String(request.state)) || !isSha(request.selectionSha256)
                || !isSha(row.renderedSha256) || !Array.isArray(row.activationProposals))
                refuse('LORE_FEEDBACK_INVALID');
            feedbackEntries.add(request.entryId);
            for (const proposal of row.activationProposals) {
                exact(proposal, ['entryId', 'rawEntrySha256']);
                if (!isSha(proposal.entryId) || !isSha(proposal.rawEntrySha256))
                    refuse('LORE_FEEDBACK_INVALID');
                if (++proposals > LORE_EVALUATOR_POLICY_V1.bounds.feedbackProposals)
                    refuse('LORE_FEEDBACK_LIMIT');
            }
            const { feedbackSha256, ...body } = row;
            if (recordSha256(body) !== feedbackSha256)
                refuse('LORE_FEEDBACK_HASH');
        }
    }
    const tokenizer = value.tokenizer;
    exact(tokenizer, ['schemaVersion', 'encoding', 'identity', 'implementationSha256', 'method', 'counts']);
    if (tokenizer.schemaVersion !== 1 || tokenizer.encoding !== 'owned-frozen-token-count-ledger-v1'
        || !text(tokenizer.identity) || !isSha(tokenizer.implementationSha256)
        || !['actual-local-tokenizer', 'estimated-utf16-div2_5-v1'].includes(String(tokenizer.method)) || !Array.isArray(tokenizer.counts)
        || tokenizer.counts.length > 4096)
        refuse('LORE_TOKENIZER_INVALID');
    const tokenTexts = new Set();
    for (const row of tokenizer.counts) {
        exact(row, ['textSha256', 'tokens']);
        if (!isSha(row.textSha256) || !integer(row.tokens, 10_000_000) || tokenTexts.has(row.textSha256)) {
            refuse('LORE_TOKENIZER_INVALID');
        }
        tokenTexts.add(row.textSha256);
    }
    if (!Array.isArray(value.renderedTexts) || value.renderedTexts.length > 4096)
        refuse('LORE_RENDERED_TEXT_LIMIT');
    const renderedPointers = new Set();
    for (const row of value.renderedTexts) {
        exact(row, ['pointer', 'rawContentSha256', 'renderedText', 'renderedSha256', 'rendererIdentity',
            'rendererImplementationSha256', 'readDependencies']);
        if (!text(row.pointer, 4096) || !row.pointer.startsWith('/') || renderedPointers.has(row.pointer)
            || !isSha(row.rawContentSha256) || typeof row.renderedText !== 'string' || !isSha(row.renderedSha256)
            || schemaTextSha256(row.renderedText) !== row.renderedSha256 || !text(row.rendererIdentity)
            || !isSha(row.rendererImplementationSha256) || !Array.isArray(row.readDependencies)
            || row.readDependencies.length > 128)
            refuse('LORE_RENDERED_TEXT_INVALID');
        renderedPointers.add(row.pointer);
        const deps = new Set();
        for (const dep of row.readDependencies) {
            exact(dep, ['kind', 'identity', 'versionSha256', 'valueSha256']);
            if (!['state', 'source', 'message', 'settings'].includes(String(dep.kind)) || !text(dep.identity)
                || !isSha(dep.versionSha256) || !isSha(dep.valueSha256))
                refuse('LORE_TEMPLATE_DEPENDENCY_INVALID');
            const identity = `${dep.kind}:${dep.identity}`;
            if (deps.has(identity))
                refuse('LORE_TEMPLATE_DEPENDENCY_DUPLICATE');
            deps.add(identity);
            if (dep.kind === 'state' && dep.versionSha256 !== value.stateSnapshotSha256
                || dep.kind === 'source' && dep.versionSha256 !== value.sourceSnapshotSha256
                || dep.kind === 'settings' && (dep.versionSha256 !== value.settingsSha256 || dep.valueSha256 !== value.settingsSha256)) {
                refuse('LORE_TEMPLATE_DEPENDENCY_MISMATCH');
            }
            if (dep.kind === 'message') {
                const message = value.visibleMessages.find(item => object(item) && item.messageId === dep.identity);
                if (!message || dep.versionSha256 !== message.versionSha256 || dep.valueSha256 !== message.textSha256) {
                    refuse('LORE_TEMPLATE_DEPENDENCY_MISMATCH');
                }
            }
        }
    }
    if (hasInjections) {
        if (!Array.isArray(value.injectionFeedback) || value.injectionFeedback.length > 33
            || !isSha(value.injectionFeedbackSha256) || recordSha256(value.injectionFeedback) !== value.injectionFeedbackSha256)
            refuse('LORE_INJECTION_FEEDBACK_INVALID');
        const seen = new Set();
        let bytes = 0;
        for (const row of value.injectionFeedback) {
            exact(row, ['loop', 'state', 'stage', 'contributions', 'activationProposals', 'producerIdentity',
                'producerImplementationSha256', 'feedbackSha256']);
            const key = `${row.loop}:${row.stage}`;
            if (!integer(row.loop) || row.loop > 2048 || typeof row.state !== 'string' || typeof row.stage !== 'string'
                || !['initial', 'recursion', 'minimum-activations'].includes(row.state)
                || !['before-initial', 'after-selected'].includes(row.stage) || seen.has(key)
                || row.stage === 'before-initial' && (row.loop !== 0 || row.state !== 'initial')
                || !text(row.producerIdentity) || !isSha(row.producerImplementationSha256)
                || !Array.isArray(row.contributions) || row.contributions.length > 512
                || !Array.isArray(row.activationProposals) || row.activationProposals.length > 4096)
                refuse('LORE_INJECTION_FEEDBACK_INVALID');
            seen.add(key);
            const identities = new Set();
            for (const contribution of row.contributions) {
                exact(contribution, ['identity', 'text', 'textSha256']);
                if (!text(contribution.identity) || identities.has(contribution.identity) || typeof contribution.text !== 'string'
                    || !isSha(contribution.textSha256) || schemaTextSha256(contribution.text) !== contribution.textSha256)
                    refuse('LORE_INJECTION_FEEDBACK_INVALID');
                identities.add(contribution.identity);
                bytes += Buffer.byteLength(contribution.text, 'utf8');
                if (bytes > 2_000_000)
                    refuse('LORE_INJECTED_SCAN_TEXT_LIMIT');
            }
            for (const proposal of row.activationProposals) {
                exact(proposal, ['entryId', 'rawEntrySha256']);
                if (!text(proposal.entryId) || !isSha(proposal.rawEntrySha256))
                    refuse('LORE_INJECTION_FEEDBACK_INVALID');
            }
            const { feedbackSha256, ...body } = row;
            if (!isSha(feedbackSha256) || recordSha256(body) !== feedbackSha256)
                refuse('LORE_INJECTION_FEEDBACK_INVALID');
        }
    }
    if (!text(value.seed, 4096) || schemaTextSha256(value.seed) !== value.seedSha256)
        refuse('LORE_SEED_INVALID');
    for (const [field, sha] of [['visibleMessages', 'messagesSha256'], ['settings', 'settingsSha256'],
        ['globalScanData', 'globalScanDataSha256'], ['timed', 'timedSha256'], ['tokenizer', 'tokenizerSha256'],
        ['renderedTexts', 'renderedTextsSha256']]) {
        if (recordSha256(value[field]) !== value[sha])
            refuse('LORE_SNAPSHOT_COMPONENT_HASH');
    }
    const { snapshotSha256, ...body } = value;
    if (recordSha256(body) !== snapshotSha256)
        refuse('LORE_SNAPSHOT_HASH');
    return freezeLoreData(value);
}
export function sealTavernLoreSnapshotV1(input) {
    const { snapshotSha256: _old, ...basis } = input;
    const body = { ...basis, tokenizerSha256: recordSha256(input.tokenizer), renderedTextsSha256: recordSha256(input.renderedTexts),
        ...(input.activationFeedback ? { activationFeedbackSha256: recordSha256(input.activationFeedback) } : {}),
        ...(input.injectionFeedback ? { injectionFeedbackSha256: recordSha256(input.injectionFeedback) } : {}) };
    return validateTavernLoreSnapshotV1({ ...body, snapshotSha256: recordSha256(body) });
}
