// Generated from runtime/alpha3/src/core/roleplay-tavern-prompt-variables.ts; edit the TypeScript source.
/** Trusted readonly initial/cache producer. The supplier owns all actual reads,
 * currentness, cancellation and protected rendering; these outputs grant none. */
import { recordSha256 } from './roleplay-data.js';
import { schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { promptExact, promptFail, promptFact, promptFreeze, promptBound, promptUnavailable, promptRef, promptRead, promptBinding, promptInitialEntryV1, validatePromptVariableSourceV1, validatePromptVariableCatalogV1, parsePromptInitialDataV1, mergePromptInitialDataV1, promptValues, TavernPromptVariableFailureV1, TAVERN_PROMPT_VARIABLE_BOUNDS_V1 } from './roleplay-tavern-prompt-variables-data.js';
import { readPromptSelectedMessageDataV1 } from './roleplay-tavern-prompt-variables-message.js';
function validateRead(read) {
    promptExact(read, ['kind', 'identity', 'valueSha256', 'provenance']);
    if (!['source', 'catalog', 'settings', 'scope', 'message', 'history', 'attempt', 'render'].includes(read.kind)) {
        promptFail('PROMPT_VARIABLE_READ_KIND');
    }
    promptRead(read.kind, read.identity, read.valueSha256, read.provenance);
}
export async function prepareRoleplayTavernPromptVariablesV1(raw, producer) {
    try {
        const input = cloneRoleplayTavernLoreDataV1(raw, TAVERN_PROMPT_VARIABLE_BOUNDS_V1.inputBytes, { nodes: 131072, depth: 66 });
        // Keep the readonly element type while Array.isArray validates the same
        // detached array; its mutable-any[] predicate otherwise erases row types.
        const scopeRows = input.scopes;
        promptExact(input, ['schemaVersion', 'encoding', 'sessionId', 'source', 'catalog', 'scopes', 'history', 'attempt']);
        if (input.schemaVersion !== 1 || input.encoding !== 'owned-prompt-variable-input-v1' || typeof input.sessionId !== 'string'
            || !input.sessionId || Buffer.byteLength(input.sessionId, 'utf8') > 128 || !Array.isArray(input.scopes) || input.scopes.length > 6) {
            promptFail('PROMPT_VARIABLE_INPUT_INVALID');
        }
        const started = performance.now();
        const checkpoint = () => {
            if (producer.signal?.aborted)
                promptFail('PROMPT_VARIABLE_CANCELLED');
            if (performance.now() - started > TAVERN_PROMPT_VARIABLE_BOUNDS_V1.deadlineMs)
                promptFail('PROMPT_VARIABLE_DEADLINE');
        };
        const ownerCheckpoint = () => { checkpoint(); producer.assertCurrent(); };
        ownerCheckpoint();
        if (input.source) {
            if (input.source.sessionId !== input.sessionId)
                promptFail('PROMPT_VARIABLE_SESSION_SOURCE_MISMATCH');
            if (!input.catalog)
                validatePromptVariableSourceV1(input.source);
        }
        if (input.attempt !== null) {
            promptExact(input.attempt, ['attemptId', 'traceCounter', 'provenance']);
            if (typeof input.attempt.attemptId !== 'string' || !input.attempt.attemptId || input.attempt.attemptId.length > 256
                || !Number.isSafeInteger(input.attempt.traceCounter) || input.attempt.traceCounter < 0) {
                promptFail('PROMPT_VARIABLE_ATTEMPT_INVALID');
            }
            promptRef(input.attempt.provenance);
        }
        const reads = [], readonlyScopes = [];
        let nativeManualCacheOverlay = false;
        const scopeFacts = new Map();
        for (const row of scopeRows) {
            promptExact(row, ['scope', 'fact']);
            if (!['global', 'chat', 'message', 'script', 'card', 'cache'].includes(row.scope) || scopeFacts.has(row.scope)) {
                promptFail('PROMPT_VARIABLE_SCOPE_DUPLICATE_OR_INVALID');
            }
            const fact = promptFact(row.fact);
            scopeFacts.set(row.scope, fact);
            if (fact.kind === 'known') {
                const read = { ...fact.read, kind: 'scope', identity: row.scope };
                reads.push(read);
                const provenance = row.fact.kind === 'unavailable' ? null : row.fact.provenance;
                if (!provenance)
                    promptFail('PROMPT_VARIABLE_FACT_INVALID');
                readonlyScopes.push({ scope: row.scope, ownerId: provenance.ownerId, versionSha256: provenance.versionSha256,
                    values: fact.values, valuesSha256: recordSha256(fact.values) });
            }
        }
        if (input.attempt)
            reads.push(promptRead('attempt', input.attempt.attemptId, recordSha256(input.attempt), input.attempt.provenance));
        const attemptId = input.attempt?.attemptId ?? 'actual-attempt-unavailable';
        const attemptTag = schemaTextSha256(attemptId);
        const initialOwner = `${input.sessionId}/initial/${attemptTag}`, cacheOwner = `${input.sessionId}/cache/${attemptTag}`;
        let initial, values = {}, renderedBytes = 0;
        const initialReads = [], merges = [];
        if (!input.source || !input.catalog) {
            initial = promptUnavailable('initial', initialOwner, [!input.source ? 'actual complete primary Source' : 'actual complete effective catalog and decorator settings proof'], initialReads);
        }
        else {
            validatePromptVariableCatalogV1(input.source, input.catalog);
            const catalog = input.catalog;
            initialReads.push(promptRead('source', 'complete-primary-source-and-current-facts', input.source.sourceSha256, catalog.completeCatalogRef), promptRead('catalog', 'complete-original-order-effective-catalog', catalog.catalogSha256, catalog.completeCatalogRef), promptRead('settings', 'prompt-template-invert-enabled', recordSha256({ invertEnabled: catalog.invertEnabled }), catalog.settingsRef));
            const selected = catalog.entries.map(entry => ({ entry, selection: promptInitialEntryV1(entry, catalog.invertEnabled) }))
                .filter(row => row.selection.selected);
            if (selected.length > TAVERN_PROMPT_VARIABLE_BOUNDS_V1.initialEntries)
                promptFail('PROMPT_INITIAL_ENTRY_LIMIT');
            if (selected.length && !input.attempt)
                initial = promptUnavailable('initial', initialOwner, ['actual attempt and trace fact for initial rendering'], initialReads);
            else {
                for (const { entry, selection } of selected) {
                    checkpoint();
                    // Serial catalog ordering is an explicit owned deterministic policy.
                    // Upstream merges Promise.all render completions into shared STATE.
                    const prior = promptBinding('initial', initialOwner, values, { sourceSha256: input.source.sourceSha256,
                        catalogSha256: catalog.catalogSha256, phase: 'reset-or-prior-catalog-merges', merges });
                    const body = { schemaVersion: 1,
                        encoding: 'owned-prompt-initial-render-request-v1', sessionId: input.sessionId, attempt: input.attempt,
                        sourceSha256: input.source.sourceSha256, catalogSha256: catalog.catalogSha256, entry,
                        body: selection.body, bodySha256: schemaTextSha256(selection.body), initialSoFar: prior,
                        readonlyScopes, unavailableScopes: ['global', 'chat', 'message', 'script', 'card', 'cache']
                            .filter(scope => !readonlyScopes.some(binding => binding.scope === scope)), defaultVariableScope: 'cache' };
                    const request = promptFreeze({ ...body, requestSha256: recordSha256(body) });
                    ownerCheckpoint();
                    const supplied = await producer.renderInitial(request, producer.signal);
                    ownerCheckpoint();
                    const output = cloneRoleplayTavernLoreDataV1(supplied, 2_097_152, { nodes: 64000, depth: 48 });
                    promptExact(output, ['schemaVersion', 'encoding', 'pipeline', 'requestSha256', 'renderedText',
                        'renderedTextSha256', 'reads', 'renderRef']);
                    if (output.schemaVersion !== 1 || output.encoding !== 'owned-prompt-initial-render-output-v1'
                        || output.pipeline !== 'actual-macro-template-regex-ejs-v1' || output.requestSha256 !== request.requestSha256
                        || typeof output.renderedText !== 'string' || schemaTextSha256(output.renderedText) !== output.renderedTextSha256
                        || !Array.isArray(output.reads) || output.reads.length > 128)
                        promptFail('PROMPT_INITIAL_RENDER_OUTPUT_INVALID');
                    promptRef(output.renderRef);
                    const identities = new Set();
                    for (const read of output.reads) {
                        validateRead(read);
                        const identity = `${read.kind}:${read.identity}`;
                        if (identities.has(identity))
                            promptFail('PROMPT_INITIAL_RENDER_READ_DUPLICATE');
                        identities.add(identity);
                    }
                    renderedBytes += Buffer.byteLength(output.renderedText, 'utf8');
                    if (renderedBytes > TAVERN_PROMPT_VARIABLE_BOUNDS_V1.renderedTotalBytes)
                        promptFail('PROMPT_INITIAL_RENDER_TOTAL_LIMIT');
                    const parsed = parsePromptInitialDataV1(output.renderedText);
                    values = mergePromptInitialDataV1(values, parsed.data);
                    const entryRead = promptRead('catalog', entry.rawEntryPointer, recordSha256(entry), entry.provenance);
                    const renderRead = promptRead('render', request.requestSha256, output.renderedTextSha256, output.renderRef);
                    initialReads.push(entryRead, ...output.reads, renderRead);
                    merges.push({ entryId: entry.entryId, rawEntryPointer: entry.rawEntryPointer, rawEntrySha256: entry.rawEntrySha256,
                        currentSemanticSha256: entry.currentSemanticSha256, contentPointer: entry.contentPointer,
                        contentSha256: entry.contentSha256, bodySha256: request.bodySha256, title: entry.title, parser: parsed.parser,
                        renderedText: output.renderedText, renderedTextSha256: output.renderedTextSha256, parsedData: parsed.data,
                        dataSha256: recordSha256(parsed.data), mergedValuesSha256: recordSha256(values), requestSha256: request.requestSha256,
                        reads: output.reads, renderRef: output.renderRef });
                    if (initialReads.length > TAVERN_PROMPT_VARIABLE_BOUNDS_V1.readDependencies)
                        promptFail('PROMPT_VARIABLE_READ_LIMIT');
                    checkpoint();
                }
                initial = promptBound('initial', initialOwner, values, initialReads, { policy: 'deterministic-original-catalog-order-v1',
                    sourceSha256: input.source.sourceSha256, catalogSha256: catalog.catalogSha256,
                    resetProof: 'complete-catalog-classification', selectedEntryIds: selected.map(row => row.entry.entryId), merges });
            }
        }
        checkpoint();
        const message = readPromptSelectedMessageDataV1(input.history, initial);
        let cache;
        const cacheReads = [...initial.reads, ...message.reads];
        if (message.emptyChat) {
            // Fixed precacheVariables returns before touching globals, initial or trace
            // for empty chat. A complete empty membership fact proves this empty cache.
            cache = promptBound('cache', cacheOwner, {}, message.reads, { policy: 'fixed-st-empty-chat-cache-v1', history: input.history });
        }
        else {
            const global = scopeFacts.get('global'), chat = scopeFacts.get('chat'), missing = [];
            if (initial.kind !== 'bound')
                missing.push(...initial.missingEvidence);
            for (const [scope, fact] of [['global', global], ['chat', chat]]) {
                if (!fact)
                    missing.push(`actual ${scope} values or absence proof`);
                else if (fact.kind === 'unavailable')
                    missing.push(...fact.missingEvidence);
                else
                    cacheReads.push({ ...fact.read, kind: 'scope', identity: scope });
            }
            if (message.values === null)
                missing.push(...message.missingEvidence);
            if (!input.attempt)
                missing.push('actual attempt/traceCounter fact');
            else
                cacheReads.push(promptRead('attempt', input.attempt.attemptId, recordSha256(input.attempt), input.attempt.provenance));
            if (missing.length)
                cache = promptUnavailable('cache', cacheOwner, missing, cacheReads);
            else {
                const globalValues = global.kind === 'known' ? global.values : {}, chatValues = chat.kind === 'known' ? chat.values : {};
                if (initial.kind !== 'bound' || message.values === null || !input.attempt)
                    promptFail('PROMPT_CACHE_DEPENDENCY_INVALID');
                let cacheValues = promptValues({ ...globalValues, ...initial.binding.values, ...chatValues, ...message.values,
                    _trace_id: input.attempt.traceCounter, _modify_id: 0 });
                const overlay = scopeFacts.get('cache');
                if (overlay?.kind === 'known'
                    && overlay.read.provenance.ref.encoding === 'native-prompt-cache-manual-current-overlay-ref-v1') {
                    const basis = overlay.read.provenance.ref;
                    if (basis.schemaVersion !== 1 || basis.encoding !== 'native-prompt-cache-manual-current-overlay-ref-v1'
                        || basis.sessionId !== input.sessionId || basis.sourceSha256 !== input.source?.sourceSha256
                        || basis.valuesSha256 !== recordSha256(overlay.values) || Object.keys(overlay.values).length !== 1
                        || !Object.hasOwn(overlay.values, 'stat_data'))
                        promptFail('PROMPT_NATIVE_MANUAL_CACHE_OVERLAY_INVALID');
                    // Current manual authority has its own versioned consumer rule. It
                    // never marks the pending message initialized or rewrites an older
                    // message's published variables merely to change the default cache.
                    cacheValues = promptValues({ ...cacheValues, ...overlay.values });
                    cacheReads.push({ ...overlay.read, kind: 'scope', identity: 'native-manual-current-cache-overlay' });
                    nativeManualCacheOverlay = true;
                }
                cache = promptBound('cache', cacheOwner, cacheValues, cacheReads, { policy: nativeManualCacheOverlay
                        ? 'readonly-native-manual-cache-overlay-v1' : 'readonly-st-cache-shallow-v1',
                    initialDerivationSha256: initial.derivationSha256, selection: message.selection, cacheReads, attempt: input.attempt });
            }
        }
        reads.push(...initialReads, ...message.reads);
        if (reads.length > TAVERN_PROMPT_VARIABLE_BOUNDS_V1.readDependencies)
            promptFail('PROMPT_VARIABLE_READ_LIMIT');
        checkpoint();
        const diagnostics = ['initial', 'cache'].flatMap(scope => {
            const available = scope === 'initial' ? initial : cache;
            return available.kind === 'unavailable' ? available.missingEvidence.map(detail => ({ code: available.diagnostic, scope, detail })) : [];
        });
        const body = { schemaVersion: 1,
            encoding: 'owned-prompt-variable-packet-v1', authority: 'consumer-data-only', policy: nativeManualCacheOverlay
                ? 'readonly-native-manual-cache-overlay-v1' : 'readonly-st-initial-catalog-order-cache-shallow-v1',
            sessionId: input.sessionId, sourceSha256: input.source?.sourceSha256 ?? null, catalogSha256: input.catalog?.catalogSha256 ?? null,
            inputSha256: recordSha256(input), defaultVariableScope: 'cache', initial, cache, initialMerges: merges,
            selection: message.selection, reads, diagnostics };
        const packet = promptFreeze(cloneRoleplayTavernLoreDataV1({ ...body, packetSha256: recordSha256(body) }, TAVERN_PROMPT_VARIABLE_BOUNDS_V1.outputBytes, { nodes: 131072, depth: 66 }));
        ownerCheckpoint();
        return promptFreeze({ kind: 'prepared', input: promptFreeze(input), packet });
    }
    catch (error) {
        const code = error instanceof TavernPromptVariableFailureV1 ? error.code
            : error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message) ? error.message : 'PROMPT_VARIABLE_PREPARATION_REFUSED';
        return promptFreeze({ kind: code === 'PROMPT_VARIABLE_CANCELLED' ? 'cancelled' : 'refused', diagnostics: [{ code,
                    detail: error instanceof TavernPromptVariableFailureV1 ? error.detail : '' }] });
    }
}
/** Getvar adapters call this at read time. Absence of a proof never becomes {}.
 * Root Template must also permit an unbound default cache until actual read. */
export function readRoleplayTavernPromptVariableBindingV1(packet, scope) {
    if (scope !== 'initial' && scope !== 'cache')
        promptFail('PROMPT_VARIABLE_SCOPE_INVALID');
    const safe = cloneRoleplayTavernLoreDataV1(packet, TAVERN_PROMPT_VARIABLE_BOUNDS_V1.outputBytes, { nodes: 131072, depth: 66 });
    const { packetSha256, ...body } = safe;
    if (safe.schemaVersion !== 1 || safe.encoding !== 'owned-prompt-variable-packet-v1' || safe.authority !== 'consumer-data-only'
        || recordSha256(body) !== packetSha256)
        promptFail('PROMPT_VARIABLE_PACKET_HASH');
    const availability = scope === 'initial' ? safe.initial : safe.cache;
    if (availability.kind !== 'bound')
        promptFail('PROMPT_VARIABLE_SCOPE_UNAVAILABLE', scope);
    if (availability.binding.scope !== scope || availability.binding.versionSha256 !== availability.derivationSha256
        || recordSha256(availability.binding.values) !== availability.binding.valuesSha256) {
        promptFail('PROMPT_VARIABLE_BINDING_HASH');
    }
    return promptFreeze(availability.binding);
}
