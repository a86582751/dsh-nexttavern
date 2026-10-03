// Generated from runtime/alpha3/src/core/roleplay-tavern-prompt-render.ts; edit the TypeScript source.
/** Owns the phase chain around the independent protected template runtime.
 * Macro/regex receipts retain raw text; guest output is rendered exactly once. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { ST_LORE_ENTRY_DEFAULTS_V1 } from './tavern-lore-fixed-profile.mjs';
import { resolveTavernLoreContentTextV1 } from './tavern-lore-compiler.mjs';
import { applyTavernPromptTransformsV1, assertTavernPromptProjectionReadyV1 } from './tavern-prompt-transform.mjs';
import { validateTemplateSnapshotV1, validateTemplateRequestV1 } from './tavern-template-data.mjs';
export const TAVERN_NATIVE_RENDER_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-tavern-template-phase-policy-v1',
    normalLore: 'macro; selected-standalone-EJS; cumulative-budget; WORLD_INFO-prompt-regex',
    getwi: 'complete-primary-catalog; source-regex; macro; nested-EJS-in-same-realm',
    catalogLookup: 'fixed-template-depth-desc-order-asc-uid-desc; stable-source-ties; native-AN-in-chat-adaptation',
    selectedOnly: 'no-eager-standalone-guest-renders-for-unselected-entries',
    output: 'complete-bounded-worker-termination-before-consumption; literal-output-markers-inert',
    scope: 'explicit-frozen-owner-bindings; unavailable-default-refuses-on-read',
    cache: 'invocation-output-never-replaces-another-entry-standalone-receipt' });
export const TAVERN_NATIVE_RENDER_POLICY_SHA256 = recordSha256(TAVERN_NATIVE_RENDER_POLICY_V1);
function fail(code) { throw Error(code); }
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
export async function prepareRoleplayTavernRenderCatalogV1(deps) {
    const { source, plan, basis, signal } = deps, transforms = [], executions = [], scopeSets = [];
    const scopeSetIds = new Set();
    // Pure catalog work uses captured DATA. The owner closes real awaits and
    // callbacks; the independent runtime admits its worker at execution gates.
    const checkpoint = () => signal.throwIfAborted();
    const ownerCheckpoint = () => { checkpoint(); deps.assertCurrent(); };
    ownerCheckpoint();
    if (basis.sessionId !== source.sessionId || basis.branchId !== source.sessionId
        || basis.sourceSnapshotSha256 !== source.sourceSha256 || plan.source.sourceSnapshotSha256 !== source.sourceSha256
        || !Number.isSafeInteger(deps.authorsNoteDepth) || deps.authorsNoteDepth < 0)
        fail('INPUT_MATERIAL_RENDER_SOURCE_CHANGED');
    const semantics = new Map(plan.entries.map(entry => [entry.entryId,
        { ...ST_LORE_ENTRY_DEFAULTS_V1, displayIndex: entry.ordinal, ...entry.semanticOverrides }]));
    const top = Math.max(0, ...[...semantics.values()].filter(value => value.position === 'at-chat-depth').map(value => value.depth));
    const lookupDepth = (value) => {
        if (value.position === 'before-authors-note' || value.position === 'after-authors-note')
            return deps.authorsNoteDepth + value.depth;
        const offsets = { 'before-character': 4, 'after-character': 3, 'before-examples': 2, 'after-examples': 1 };
        const offset = offsets[value.position];
        return offset === undefined ? value.depth : top + offset;
    };
    const entries = [...plan.entries].sort((left, right) => {
        const a = semantics.get(left.entryId), b = semantics.get(right.entryId);
        const aUid = left.upstreamUid.origin === 'explicit' ? Number(left.upstreamUid.value) : Number.NaN, bUid = right.upstreamUid.origin === 'explicit' ? Number(right.upstreamUid.value) : Number.NaN;
        return lookupDepth(b) - lookupDepth(a) || a.order - b.order || bUid - aUid || left.ordinal - right.ordinal;
    });
    const raw = entries.map(entry => resolveTavernLoreContentTextV1(plan, `${entry.sourcePointer}/content`));
    const transform = async (rows, macros = deps.macros) => {
        ownerCheckpoint();
        const result = await applyTavernPromptTransformsV1({ schemaVersion: 1, encoding: 'owned-tavern-prompt-transform-v1',
            authority: 'consumer-data-only', sourceSnapshotSha256: source.sourceSha256, regexDisabled: false,
            macros, rules: deps.rules, entries: rows }, { assertCurrent: checkpoint, signal });
        ownerCheckpoint();
        if (result.kind !== 'transformed')
            fail(result.diagnostics[0]?.code ?? 'INPUT_MATERIAL_PROMPT_TRANSFORM_REFUSED');
        const { entries: fullEntries, ...metadata } = result.output;
        // Original text is in the captured Source/author fields. Keep each exact
        // consumed/output hash and one transformed text, instead of archiving the
        // entire raw/story/input strings again for every phase.
        transforms.push({ ...metadata, entries: fullEntries.map(({ rawText: _raw, storyText: _story, inputText: _input, ...entry }) => entry) });
        return result.output;
    };
    const row = (key, pointer, text, pipeline, channel, required, entryId, placement = 5, depth = null) => ({ key, bookId: entryId ? plan.bookId : null, entryId, sourcePointer: pointer, sourceSnapshotSha256: source.sourceSha256,
        rawText: text, storyText: '', inputText: text, pipeline, channel, placement, depth, isEdit: false,
        characterOverride: null, required });
    const catalogOutput = await transform(entries.map((entry, index) => row(entry.entryId, raw[index].pointer, raw[index].text, 'regex-then-macro', 'source', false, entry.entryId)));
    const world = typeof source.original.primary.value?.name === 'string' ? source.original.primary.value.name :
        `native-primary-${plan.bookId}`;
    const lore = entries.map(entry => {
        const projection = catalogOutput.entries.find(item => item.entryId === entry.entryId);
        const original = source.original.primary.entries.find(item => item.ref.entryPointer === entry.sourcePointer);
        if (!original || original.ref.entrySha256 !== entry.rawEntrySha256)
            fail('INPUT_MATERIAL_RENDER_ENTRY_UNPROVEN');
        const uid = entry.upstreamUid.origin === 'explicit' ? Number(entry.upstreamUid.value) : Number.NaN, semantic = semantics.get(entry.entryId);
        return { key: entry.entryId, bookId: plan.bookId, entryId: entry.entryId, sourcePointer: projection.sourcePointer,
            sourceSnapshotSha256: source.sourceSha256, content: projection.outputText, contentSha256: projection.outputSha256,
            activationAllowed: semantic.enabled && entry.disposition === 'eligible-semantic-data',
            lookup: { world, title: typeof original.value.comment === 'string' ? original.value.comment : '',
                uid: Number.isSafeInteger(uid) && uid >= 0 ? uid : null },
            ...projection.deferredDiagnostics.length ? { readDiagnostic: { code: projection.deferredDiagnostics[0].code,
                    projectionSha256: projection.projectionSha256 } } : {} };
    });
    const snapshotBody = { schemaVersion: 1, encoding: 'owned-template-frozen-snapshot-v1',
        authority: 'consumer-data-only', ...basis, defaultVariableScope: 'cache', scopes: deps.scopes,
        scopesSha256: recordSha256(deps.scopes), lore, loreSha256: recordSha256(lore), randomSeedSha256: sha256(basis.randomSeed) };
    let snapshot = validateTemplateSnapshotV1({ ...snapshotBody, snapshotSha256: recordSha256(snapshotBody) });
    let variablesBound = false, standaloneStarted = false;
    const render = async (pointer, text, options = {}) => {
        const projection = (await transform([row(`render-${executions.length}`, pointer, text, 'macro-only', 'source', true, options.entryId ?? null, options.placement ?? 5)], options.macros)).entries[0];
        assertTavernPromptProjectionReadyV1(projection);
        let actualSnapshot = snapshot;
        if (options.scopes) {
            const { snapshotSha256: _sha, ...body } = snapshot, changed = { ...body, scopes: options.scopes, scopesSha256: recordSha256(options.scopes) };
            actualSnapshot = validateTemplateSnapshotV1({ ...changed, snapshotSha256: recordSha256(changed) });
        }
        const sourceData = { pointer, template: projection.outputText, templateSha256: projection.outputSha256,
            sourceSnapshotSha256: source.sourceSha256, packageSha256: basis.packageSha256,
            ...options.entryId ? { rootEntryId: options.entryId } : {} };
        const requestBody = { schemaVersion: 1, encoding: 'owned-template-request-v1',
            source: sourceData, snapshot: actualSnapshot };
        const rawRequest = { ...requestBody, requestSha256: recordSha256(requestBody) };
        const { template: _text, ...requestSource } = sourceData;
        const requestRef = { schemaVersion: rawRequest.schemaVersion, encoding: rawRequest.encoding, source: requestSource,
            snapshotSha256: actualSnapshot.snapshotSha256, requestSha256: rawRequest.requestSha256 };
        const scopeSha = actualSnapshot.scopesSha256;
        if (scopeSha !== snapshot.scopesSha256 && !scopeSetIds.has(scopeSha)) {
            scopeSetIds.add(scopeSha);
            scopeSets.push({ scopes: actualSnapshot.scopes, scopesSha256: scopeSha,
                snapshotSha256: actualSnapshot.snapshotSha256 });
        }
        if (!projection.outputText.includes('<%')) {
            const literal = { renderedText: projection.outputText, renderedTextSha256: sha256(projection.outputText),
                activationProposals: [], readDependencies: [], nestedRenders: [] };
            executions.push(freeze({ kind: 'program-literal', request: requestRef,
                macroProjectionSha256: projection.projectionSha256, ...literal }));
            checkpoint();
            return literal;
        }
        const request = validateTemplateRequestV1(rawRequest);
        ownerCheckpoint();
        const result = await deps.component.runtime.render(request, signal);
        ownerCheckpoint();
        if (result.kind !== 'rendered')
            fail(result.diagnostics[0]?.code ?? 'INPUT_MATERIAL_TEMPLATE_REFUSED');
        executions.push(freeze({ kind: 'protected-template-runtime', request: requestRef, output: result.output,
            macroProjectionSha256: projection.projectionSha256 }));
        if (result.output.injectionEffects?.length) {
            if (!deps.onCreation || !deps.definitionFor)
                fail('INPUT_MATERIAL_INJECTION_OWNER_UNAVAILABLE');
            if (!options.phase)
                fail('INPUT_MATERIAL_INJECTION_PHASE_UNPROVEN');
            deps.onCreation(request, result.output, deps.definitionFor(pointer, options.entryId), options.phase);
            ownerCheckpoint();
        }
        return result.output;
    };
    const identity = `${deps.component.runtime.identity.packageName}@${deps.component.runtime.identity.packageVersion}`, implementationSha256 = recordSha256({ engine: deps.component.runtime.identity,
        policy: TAVERN_NATIVE_RENDER_POLICY_SHA256, macroPolicy: deps.macros.sourceSnapshotSha256 });
    const loreProducer = Object.freeze({ identity, implementationSha256, signal,
        assertCurrent: checkpoint, async render(request) {
            standaloneStarted = true;
            const entry = plan.entries.find(item => item.entryId === request.entryId);
            if (!entry || entry.rawEntrySha256 !== request.rawEntrySha256 || request.compilerPlanSha256 !== plan.planSha256
                || request.attemptId !== basis.attemptId || sha256(request.text) !== request.rawContentSha256)
                fail('INPUT_MATERIAL_TEMPLATE_SELECTION_CHANGED');
            const output = await render(request.pointer, request.text, { entryId: entry.entryId, phase: 'lore-selected' });
            const activationProposals = output.activationProposals.map(proposal => {
                const target = plan.entries.find(item => item.entryId === proposal.entryId);
                if (!target || proposal.sourceSnapshotSha256 !== source.sourceSha256 || proposal.branchId !== source.sessionId
                    || proposal.turnId !== basis.turnId || proposal.attemptId !== basis.attemptId)
                    fail('INPUT_MATERIAL_ACTIVATION_CHANGED');
                return { entryId: target.entryId, rawEntrySha256: target.rawEntrySha256 };
            });
            return { receipt: { pointer: request.pointer, rawContentSha256: request.rawContentSha256,
                    renderedText: output.renderedText, renderedSha256: output.renderedTextSha256, rendererIdentity: identity,
                    rendererImplementationSha256: implementationSha256, readDependencies: [
                        { kind: 'source', identity: 'actual-tavern-source', versionSha256: source.sourceSha256, valueSha256: source.sourceSha256 },
                        { kind: 'state', identity: 'actual-frozen-template-scopes', versionSha256: basis.stateSnapshotSha256,
                            valueSha256: snapshot.scopesSha256 }
                    ] }, activationProposals };
        } });
    return { get snapshot() { return snapshot; }, loreProducer, render,
        async transformInjectionContent(rows, macros = deps.macros) {
            const output = await transform(rows.map(item => row(item.key, `/native/injection/${item.key}`, item.content, 'macro-only', 'source', true, null, item.role === 'user' ? 1 : 2, item.depth)), macros);
            return output.entries.map(item => {
                assertTavernPromptProjectionReadyV1(item);
                return { key: item.key,
                    text: item.outputText, textSha256: item.outputSha256, projectionSha256: item.projectionSha256 };
            });
        },
        /** InitialVariables runs against its explicit pre-initial scopes. Only
         * its completed readonly packet can become the default for later renders. */
        bindVariableScopes(scopes) {
            checkpoint();
            if (variablesBound || standaloneStarted)
                fail('INPUT_MATERIAL_VARIABLE_PHASE_CHANGED');
            variablesBound = true;
            scopeSets.push({ scopes: snapshot.scopes, scopesSha256: snapshot.scopesSha256,
                snapshotSha256: snapshot.snapshotSha256 });
            scopeSetIds.add(snapshot.scopesSha256);
            const { snapshotSha256: _old, ...body } = snapshot;
            const changed = { ...body, scopes, scopesSha256: recordSha256(scopes) };
            snapshot = validateTemplateSnapshotV1({ ...changed, snapshotSha256: recordSha256(changed) });
            checkpoint();
        },
        async renderWithEvidence(pointer, text, options = {}) {
            const executionIndex = executions.length, transformIndex = transforms.length;
            const output = await render(pointer, text, options);
            checkpoint();
            if (executions.length !== executionIndex + 1)
                fail('INPUT_MATERIAL_RENDER_RECEIPT_AMBIGUOUS');
            return { output, evidence: freeze({ schemaVersion: 1, encoding: 'native-tavern-single-render-receipt-v1',
                    policySha256: TAVERN_NATIVE_RENDER_POLICY_SHA256, executionIndex, execution: executions[executionIndex],
                    transforms: transforms.slice(transformIndex), scopeSets: [...scopeSets] }) };
        },
        async finalLore(placements, macros = deps.macros) {
            const output = await transform(placements.map(item => row(`final-${item.entryId}`, item.sourcePointer, item.text, 'regex-only', 'prompt', true, item.entryId, 5, item.position === 'at-chat-depth' ? item.depth ?? null : null)), macros);
            return output.entries.map((projection, index) => {
                assertTavernPromptProjectionReadyV1(projection);
                return { entryId: placements[index].entryId, inputSha256: placements[index].effectiveContentSha256,
                    text: projection.outputText, outputSha256: projection.outputSha256 };
            });
        }, audit: () => freeze({ schemaVersion: 1, encoding: 'native-tavern-render-chain-audit-v1', authority: 'consumer-data-only',
            policySha256: TAVERN_NATIVE_RENDER_POLICY_SHA256, snapshot, scopeSets: [...scopeSets],
            transforms: [...transforms], executions: [...executions] }),
        assertCurrent: ownerCheckpoint };
}
