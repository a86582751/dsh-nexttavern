// Generated from runtime/alpha3/src/core/roleplay-mvu-opening.ts; edit the TypeScript source.
import { recordSha256, sha256 } from './roleplay-data.js';
import { eventsOf } from './roleplay-context.js';
import { createRoleplayMvuSource } from './roleplay-mvu-source.js';
import { createRoleplayMvuBasis } from './roleplay-mvu-basis.js';
import { createRoleplayMvuNative } from './roleplay-mvu-native.js';
import { createRoleplayMvuInitialization, prepareNativeMvuOpeningInitialization } from './roleplay-mvu-initialization.js';
import { openingIntentKey } from './roleplay-opening-selection.js';
import { createRoleplayMvuSchemaCore } from './roleplay-mvu-schema-core.js';
import { createRoleplayMvuSchemaOpening } from './roleplay-mvu-schema-opening.js';
import { createRoleplayMvuSchemaSource } from './roleplay-mvu-schema-source.js';
import { createRoleplayMvuSchemaStoryCore } from './roleplay-mvu-schema-story-core.js';
import { createRoleplayMvuSchemaPlayerCore } from './roleplay-mvu-schema-player-core.js';
import { mvuInitializationHeadKey } from './roleplay-mvu-initialization.js';
import { verifyProgrammaticCardCopySpanV1 } from './roleplay-program-copy-span.js';
import { describeRoleplayInputSourceV1, roleplayInputSourceSha256V1 } from './roleplay-input-source-data.js';
import { createRoleplayPromptTemplateOnlySourceV1 } from './roleplay-prompt-template-only-source.js';
import { createRoleplayPromptInheritedSourceV2, readPromptNonNumericalInventoryV2, validatePromptInheritedSourceProofV2 } from './roleplay-prompt-template-inherited-source.js';
import { PROMPT_TEMPLATE_ONLY_CODES_V1, clonePromptTemplateOnlyDataV1, freezePromptTemplateOnlyDataV1, validatePromptTemplateOnlyOpeningIntentV6, validatePromptTemplateOnlySourceProofV1 } from './roleplay-prompt-template-only-data.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
/** Binds actual source, numerical ownership and original native acknowledgement for opening selection. */
export function createRoleplayMvuOpening(deps) {
    const readIntent = (sessionId, importId) => deps.tables.branch.get(openingIntentKey(sessionId, importId));
    const native = createRoleplayMvuNative({ getSession: deps.session, getInheritedNativeObservation: deps.inheritedNativeObservation,
        readIntent, messageEdits: deps.messageEdits,
        deletedMessageIds: deps.deletedMessageIds, lookup: deps.nativeLookup });
    const basis = createRoleplayMvuBasis({ branch: deps.tables.branch, numerical: deps.tables.status,
        session: deps.session, branchReady: deps.branchReady, nativeCurrent: native.current });
    const sourceDeps = {
        readActivePointer: id => deps.tables.branch.get(deps.importActiveKey(id)),
        readImportRecord: (id, importId) => deps.tables.branch.get(deps.importRecordKey(id, importId)),
        readRow: (table, key) => deps.tables[table].get(key),
        recordVersionsFor: deps.recordVersionsFor, readOpeningContext: deps.openingContext, readFreshNativeBasis: basis.fresh,
    };
    const source = createRoleplayMvuSource(sourceDeps);
    const promptDomainDeps = { ...sourceDeps,
        session: deps.session, branchReady: deps.branchReady, entries: table => deps.tables[table].entries(),
        readInheritedPromptTemplateSource: deps.readInheritedPromptTemplateSource, readSourceInheritance: deps.readSourceInheritance };
    const promptTemplateSource = createRoleplayPromptTemplateOnlySourceV1(promptDomainDeps);
    const inheritedPromptSource = createRoleplayPromptInheritedSourceV2(promptDomainDeps, input => native.readInheritedFrozen(input).status === 'committed');
    const observedIntent = (source) => deps.readOpeningIntentForObservation
        ? deps.readOpeningIntentForObservation(source) : deps.readOpeningIntent?.(source);
    const templateCaptures = new Map();
    function captureTemplateObservation(sessionId) {
        const pointer = deps.tables.branch.get(deps.importActiveKey(sessionId)), key = pointer?.importId ? openingIntentKey(sessionId, pointer.importId) : undefined, raw = key ? deps.tables.branch.get(key) : undefined;
        if (!key || raw?.schemaVersion !== 6)
            return;
        const session = deps.session(sessionId);
        if (!session)
            throw Error('PROMPT_TEMPLATE_SOURCE_CHANGED');
        const intentSha256 = recordSha256(raw), previous = templateCaptures.get(sessionId);
        if (previous?.session === session && previous.intentKey === key && previous.intentSha256 === intentSha256) {
            previous.assertCurrent();
            return previous;
        }
        const intent = freezePromptTemplateOnlyDataV1(validatePromptTemplateOnlyOpeningIntentV6(raw));
        if (intent.status !== 'completed' || !intent.nativeReceipt)
            throw Error(intent.initializationCode ?? 'OPENING_NOT_READY');
        const initialNative = callbacks.readNativeOpening(intent);
        if (initialNative.kind !== 'ready' || !same(initialNative.receipt, intent.nativeReceipt))
            throw Error('NATIVE_NOT_COMMITTED');
        const live = promptTemplateSource.captureCurrent(intent.promptTemplateSourceProof), proof = live.proof;
        const assertCurrent = () => {
            if (deps.session(sessionId) !== session || recordSha256(deps.tables.branch.get(key)) !== intentSha256
                || deps.legacyImportPending?.(sessionId) || hasSchemaOpening(sessionId) || deps.derivedBasisRequired?.(sessionId)) {
                throw Error('PROMPT_TEMPLATE_SOURCE_CHANGED');
            }
            live.assertCurrent();
            if (!promptTemplateRuntimeObserved(proof))
                throw Error('PROMPT_TEMPLATE_RUNTIME_REQUIRED');
            // The completed intent was fully checked once and its complete actual row
            // remains pinned. Re-read original Native bytes/projections independently;
            // data equality never restores an Agent or a current input permission.
            const matched = verifyProgrammaticCardCopySpanV1({ identity: { sessionId, importId: intent.source.importId,
                    operationId: intent.operationId, requestedMessageId: intent.messageId, renderedText: intent.renderedText,
                    renderedSha256: intent.renderedSha256 }, acknowledgedTurn: intent.committedTurn,
                observation: { id: session.id, header: session.header, inheritedEventCount: Number(session.inheritedEventCount),
                    seq: session.seq, events: eventsOf(session), surfaceNodes: session.surface?.nodes,
                    deletedMessageIds: () => deps.deletedMessageIds(session),
                    ...(session.deriveEventMessage ? { deriveEventMessage: (event) => session.deriveEventMessage(event) } : {}) }, messageEdits: deps.messageEdits });
            if (matched.kind !== 'matched' || !same({ ...matched.facts, flushed: true }, intent.nativeReceipt))
                throw Error('NATIVE_NOT_COMMITTED');
        };
        assertCurrent();
        const captured = { session, intentKey: key, intentSha256, intent, proof, assertCurrent };
        templateCaptures.set(sessionId, captured);
        return captured;
    }
    const runtimeRequest = (proof) => ({ sessionId: proof.sourceSnapshot.source.sessionId,
        sourceProofSha256: proof.proofSha256, required: proof.requiredPromptRuntime });
    function promptTemplateRuntimeCurrent(proof) {
        try {
            return deps.promptTemplateRuntime?.current(runtimeRequest(validatePromptTemplateOnlySourceProofV1(proof))) === true;
        }
        catch {
            return false;
        }
    }
    function promptTemplateRuntimeObserved(proof) {
        try {
            const owner = deps.promptTemplateRuntime, request = runtimeRequest(validatePromptTemplateOnlySourceProofV1(proof));
            return (owner?.observe ? owner.observe(request) : owner?.current(request)) === true;
        }
        catch {
            return false;
        }
    }
    async function preflightPromptTemplateRuntime(proof, signal) {
        const saved = validatePromptTemplateOnlySourceProofV1(proof), id = saved.sourceSnapshot.source.sessionId;
        signal?.throwIfAborted();
        await deps.withSourceLock(id, async () => {
            if (!promptTemplateSource.current(saved))
                throw Error('PROMPT_TEMPLATE_SOURCE_CHANGED');
        });
        if (!deps.promptTemplateRuntime)
            throw Error('PROMPT_TEMPLATE_RUNTIME_REQUIRED');
        // Asset load/Agent material readiness must not hold the Source FIFO. The
        // callback is an actual owner method, not a serialized generation claim.
        await deps.promptTemplateRuntime.preflight(runtimeRequest(saved), signal);
        signal?.throwIfAborted();
        await deps.withSourceLock(id, async () => {
            if (!promptTemplateSource.current(saved))
                throw Error('PROMPT_TEMPLATE_SOURCE_CHANGED');
            if (!promptTemplateRuntimeCurrent(saved))
                throw Error('PROMPT_TEMPLATE_PROTOCOL_UNAVAILABLE');
        });
    }
    async function preflightPromptTemplateOpening(request) {
        const decision = await deps.withSourceLock(request.catalog.source.sessionId, async () => promptTemplateSource.produce(request));
        if (decision.kind !== 'prompt-template-only')
            return { kind: 'not-applicable' };
        try {
            await preflightPromptTemplateRuntime(decision.proof);
            return { kind: 'ready', proof: decision.proof };
        }
        catch (error) {
            const code = error instanceof Error ? error.message : '';
            return { kind: 'blocked', proof: decision.proof, code: PROMPT_TEMPLATE_ONLY_CODES_V1.includes(code)
                    ? code : 'PROMPT_TEMPLATE_RUNTIME_REQUIRED' };
        }
    }
    const schemaCore = deps.schema ? createRoleplayMvuSchemaCore({ ...deps.schema, branch: deps.tables.branch,
        status: deps.tables.status, source, session: id => deps.session(id),
        withSourceLock: deps.withSourceLock, projectPrefix: events => deps.messageEdits.projectPrefix(events),
        nativeRead: (identity, turn) => native.read(identity, turn) }) : undefined;
    let schemaSelection;
    let schemaStory;
    let schemaPlayer;
    function createSchemaStory(completion) {
        if (!schemaCore || !deps.schema)
            return undefined;
        const schemaSource = createRoleplayMvuSchemaSource({ ...sourceDeps, inputState: deps.inputState }, deps.schema.markers, events => deps.messageEdits.projectPrefix(events));
        const common = { ...deps.schema, branch: deps.tables.branch, status: deps.tables.status, inputState: deps.inputState,
            source: schemaSource, session: (id) => deps.session(id),
            sourceSha256: (id) => inputSource(id).sourceSha256,
            protectedRuntime: schemaCore.protectedRuntime, withSourceLock: deps.withSourceLock };
        schemaStory ??= createRoleplayMvuSchemaStoryCore({ ...completion, ...common, inputState: deps.inputState,
            manualPendingCode: (id) => schemaPlayer?.pendingCode(id),
            derivedRequired: deps.schemaDerivedRequired, readDerivedGenesis: deps.readSchemaDerivedGenesis,
            readEditInvalidation: deps.readSchemaEditInvalidation,
            projectPrefix: events => deps.messageEdits.projectPrefix(events), editProtocol: deps.messageEdits,
            activePointer: id => deps.tables.branch.get(deps.importActiveKey(id)), sourceSha256: id => inputSource(id).sourceSha256,
            protectedRuntime: schemaCore.protectedRuntime, withSourceLock: deps.withSourceLock,
            verifyOpening: intent => {
                const found = native.read(intent.initialization.identity, intent.committedTurn);
                return found.status === 'committed' && same(found.receipt, intent.nativeReceipt);
            } });
        schemaPlayer ??= createRoleplayMvuSchemaPlayerCore({ ...common, story: schemaStory,
            observe: deps.schema.observe, playerMarkers: deps.schema.playerMarkers });
        return schemaStory;
    }
    function createSchemaSelection(nativeDeps) {
        if (!schemaCore)
            return undefined;
        const transaction = createRoleplayMvuSchemaOpening({ ...schemaCore, branch: deps.tables.branch, status: deps.tables.status,
            withLock: nativeDeps.withLock,
            appendOpening: request => deps.schema.appendOpeningOnAgent(request, schemaCore.openingAgent(request)),
            lookupNativeOpening: nativeDeps.findOpeningByOperationId,
            readNativeOpening: intent => {
                const found = native.read({ sessionId: intent.sessionId, source: intent.source, operationId: intent.operationId,
                    messageId: intent.messageId, index: intent.index, sourcePointer: intent.sourcePointer, sourceSha256: intent.sourceSha256,
                    renderedSha256: intent.renderedSha256 }, intent.committedTurn);
                return found.status === 'committed' ? { kind: 'ready', receipt: found.receipt } : { kind: 'blocked', code: 'NATIVE_NOT_COMMITTED' };
            } });
        schemaSelection = { ...transaction, handles: request => {
                const author = source.readAuthorSource(request.identity.sessionId, request.identity.index);
                // Native loader-only v4 Sources take this same opening transaction. The
                // complete worker plan and real Native receipt determine publication;
                // routing never relies on registration count or loader import outcome.
                return author.kind === 'author-source' && author.source.scripts.some(script => script.enabled);
            } };
        return schemaSelection;
    }
    function hasSchemaOpening(sessionId) {
        const pointer = deps.tables.branch.get(deps.importActiveKey(sessionId));
        const intent = pointer?.importId ? readIntent(sessionId, pointer.importId) : undefined;
        const head = deps.tables.status.get(mvuInitializationHeadKey(sessionId));
        return deps.schemaDerivedRequired?.(sessionId) === true || intent?.schemaVersion === 5 || head?.encoding === 'mvu-schema-opening-head-v2';
    }
    async function readSchemaInitialization(sessionId) {
        if (!schemaSelection)
            return { kind: 'blocked', code: 'SCHEMA_RUNTIME_UNAVAILABLE' };
        try {
            return await schemaSelection.readVerified(deps.catalog(sessionId).source);
        }
        catch {
            return { kind: 'blocked', code: 'SCHEMA_OPENING_RECORD_INVALID' };
        }
    }
    function sourceCurrent(identity) {
        try {
            const actual = deps.catalog(identity.sessionId);
            const selected = actual.candidates.find(candidate => candidate.index === identity.index);
            return same(actual.source, identity.source) && selected?.sourcePointer === identity.sourcePointer
                && selected.sourceSha256 === identity.sourceSha256
                && sha256(selected.renderedText) === identity.renderedSha256;
        }
        catch {
            return false;
        }
    }
    const initialization = createRoleplayMvuInitialization({ table: deps.tables.status,
        withSourceLock: deps.withSourceLock, isCurrent: sourceCurrent, isSourceSnapshotCurrent: source.current,
        isOpeningCurrent: (plan, turn) => {
            const row = readIntent(plan.identity.sessionId, plan.identity.source.importId);
            return !!row && (row.schemaVersion === 3 && plan.schemaVersion === 1 || row.schemaVersion === 4 && plan.schemaVersion === 2)
                && (row.status === 'native-committed' || row.status === 'completed') && row.committedTurn === turn
                && row.operationId === plan.identity.operationId && row.messageId === plan.identity.messageId
                && row.index === plan.identity.index && row.sourcePointer === plan.identity.sourcePointer
                && row.sourceSha256 === plan.identity.sourceSha256 && row.renderedSha256 === plan.identity.renderedSha256
                && same(row.source, plan.identity.source) && 'initialization' in row && same(row.initialization, plan);
        },
        isBasisCurrent: basis.current, isNativeCurrent: native.current, verifyNative: native.verify,
    });
    const callbacks = {
        prepareInitialization: ({ catalog, candidate, identity }) => {
            const decision = source.produce({ catalog, candidate });
            if (decision.kind === 'legacy-v2')
                return { kind: 'legacy-v2', absenceScopeProof: decision.absenceScopeProof };
            if (decision.kind === 'unsupported') {
                // An old refusal is never converted into Plain. The independent
                // producer reopens and classifies the complete actual Source itself.
                const template = promptTemplateSource.produce({ catalog, candidate });
                if (template.kind === 'prompt-template-only')
                    return { kind: 'prompt-template-only', proof: template.proof };
                if (template.kind === 'unsupported')
                    return { schemaVersion: 2, kind: 'unsupported', diagnostics: template.diagnostics };
                return { schemaVersion: 2, kind: 'unsupported', diagnostics: decision.diagnostics.map(({ code, pointer }) => ({ code, pointer })) };
            }
            return prepareNativeMvuOpeningInitialization(identity, decision.candidate);
        },
        finishInitialization: async (intent) => intent.initialization && Number.isSafeInteger(intent.committedTurn)
            ? initialization.publish(intent.initialization, intent.committedTurn) : { kind: 'blocked', code: 'RECORD_INVALID' },
        readInitialization: initialization.read, isSourceSnapshotCurrent: source.current,
        preflightPromptTemplateOpening, preflightPromptTemplateRuntime,
        isPromptTemplateOnlySourceCurrent: promptTemplateSource.current,
        isPromptTemplateRuntimeCurrent: promptTemplateRuntimeCurrent,
        readNativeOpening: intent => {
            const found = native.read({ sessionId: intent.sessionId, source: intent.source, operationId: intent.operationId,
                messageId: intent.messageId, index: intent.index, sourcePointer: intent.sourcePointer, sourceSha256: intent.sourceSha256,
                renderedSha256: intent.renderedSha256 }, intent.committedTurn);
            return found.status === 'committed' ? { kind: 'ready', receipt: found.receipt }
                : { kind: 'blocked', code: 'NATIVE_NOT_COMMITTED' };
        },
        legacyPendingAllowed: intent => {
            try {
                const catalog = deps.catalog(intent.sessionId);
                const candidate = catalog.candidates.find(item => item.index === intent.index);
                if (!candidate || !same(catalog.source, intent.source) || candidate.sourceSha256 !== intent.sourceSha256
                    || sha256(candidate.renderedText) !== intent.renderedSha256)
                    return false;
                const decision = source.produce({ catalog, candidate });
                return decision.kind === 'legacy-v2' && source.current(decision.absenceScopeProof.sourceSnapshot);
            }
            catch {
                return false;
            }
        },
    };
    function inputSource(sessionId) {
        return deps.inputState.captureSource(sessionId, 'input-source', () => captureInputSource(sessionId)).data;
    }
    function captureInputSource(sessionId) {
        const pointer = deps.tables.branch.get(deps.importActiveKey(sessionId));
        const owner = typeof pointer?.['sourceRecordSessionId'] === 'string' ? pointer['sourceRecordSessionId'] : sessionId;
        const imported = typeof pointer?.['importId'] === 'string'
            ? deps.tables.branch.get(deps.importRecordKey(owner, pointer['importId'])) : undefined;
        // Source currency excludes input ledgers, native history, volatile jobs and
        // the numerical head. Publishing our own checkpoint/head cannot change it.
        const versions = deps.recordVersionsFor(sessionId);
        const captured = { sessionId, pointer, imported, versions,
            statusSpecSha256: recordSha256(deps.tables.status.get(`${sessionId}__spec`)),
            openingSha256: recordSha256(deps.tables.opening.get(`${sessionId}__scene`)),
            openingContextBindingSha256: pointer ? deps.openingContext(sessionId).bindingSha256 : null };
        const descriptor = describeRoleplayInputSourceV1(captured), sourceSha256 = roleplayInputSourceSha256V1(captured);
        return { pointer, imported, descriptor, sourceSha256 };
    }
    function readGenesis(sessionId) {
        try {
            const pointer = deps.tables.branch.get(deps.importActiveKey(sessionId));
            const raw = typeof pointer?.importId === 'string' ? readIntent(sessionId, pointer.importId) : undefined;
            if (raw?.schemaVersion === 6)
                return;
            const catalog = deps.catalog(sessionId), intent = deps.readOpeningIntent?.(catalog.source);
            if (intent?.schemaVersion !== 4 || intent.status !== 'completed' || intent.mode !== 'native-json' || !intent.initialization)
                return;
            const ready = initialization.read(intent.initialization);
            if (ready.kind !== 'ready')
                return;
            return { sessionId, sourceSha256: inputSource(sessionId).sourceSha256, initEvent: ready.event, initHead: ready.head };
        }
        catch {
            return undefined;
        }
    }
    function readInputObservation(sessionId) {
        const { pointer, imported, sourceSha256 } = inputSource(sessionId);
        const management = (reason) => ({ kind: 'management', sourceSha256, reason });
        const program = deps.readProgramOpeningObservation?.(sessionId, sourceSha256);
        if (program)
            return program;
        // A schema opening has its own readonly genesis. Its v5 intent cannot
        // fall through schemaVersion !== 4 into the old legacy story permission.
        if (hasSchemaOpening(sessionId))
            return schemaStory?.observation(sessionId) ?? management('SCHEMA_STORY_PREFLIGHT_REQUIRED');
        if (deps.legacyImportPending?.(sessionId))
            return { kind: 'legacy', sourceSha256, reason: 'LEGACY_SEMANTIC_IMPORT' };
        if (!pointer) {
            const hasLegacyMaterial = [...deps.tables.cards.entries(), ...deps.tables.worldbook.entries()]
                .some(([key]) => key.startsWith(`${sessionId}__`) && key !== `${sessionId}__user`);
            return hasLegacyMaterial ? { kind: 'legacy', sourceSha256, reason: 'LEGACY_MANUAL_MATERIAL' } : management('NO_ACTIVE_SOURCE');
        }
        if (!imported || imported['status'] !== 'active')
            return management('ACTIVE_SOURCE_INVALID');
        const envelope = imported['sourceEnvelope'];
        if (!envelope) {
            return Number(imported['schemaVersion']) >= 4 ? management('ACTIVE_SOURCE_INVALID')
                : { kind: 'legacy', sourceSha256, reason: 'LEGACY_TEXT_IMPORT' };
        }
        if (!['.png', '.json', '.md', '.txt', '.docx'].includes(String(envelope.extension).toLowerCase())) {
            return management('ACTIVE_SOURCE_INVALID');
        }
        if (!['.png', '.json'].includes(String(envelope.extension).toLowerCase())) {
            return { kind: 'legacy', sourceSha256, reason: 'LEGACY_TEXT_IMPORT' };
        }
        // Non-numerical inheritance has its own frozen opening domain. Its child
        // cannot request a fresh opening or borrow a numerical derived genesis.
        const inherited = deps.readInheritedPromptTemplateSource?.(sessionId);
        if (inherited?.kind === 'ready') {
            const found = inheritedPromptSource.produce(sessionId);
            if (found.kind !== 'ready')
                return management(found.code);
            const proof = found.proof;
            if (proof.mode === 'prompt-template-only' && !inheritedPromptRuntimeObserved(proof)) {
                return management('PROMPT_TEMPLATE_RUNTIME_REQUIRED');
            }
            return { kind: 'story', sourceSha256, absenceScopeRef: { kind: 'inherited-prompt-domain',
                    sha256: recordSha256({ schemaVersion: 2, encoding: 'native-prompt-inherited-domain-ref-v2',
                        sourceProofSha256: proof.proofSha256, native: proof.input.frozenOpening.nativeReceipt,
                        scopeInventorySha256: proof.childInventory.inventorySha256 }) } };
        }
        // A Native child uses its own derived root. Missing/partial/corrupt basis
        // cannot fall back to selecting another author opening or empty values.
        if (deps.derivedBasisRequired?.(sessionId)) {
            const authority = deps.readNumericalAuthority?.(sessionId);
            return authority?.kind === 'ready' ? { kind: 'story', sourceSha256,
                headRef: { kind: 'numerical-head', sha256: authority.snapshot.headSha256 } }
                : management(authority?.kind === 'blocked' ? authority.code : 'DERIVED_BASIS_NOT_READY');
        }
        try {
            const captured = captureTemplateObservation(sessionId);
            if (captured) {
                const proof = captured.proof;
                return { kind: 'story', sourceSha256, absenceScopeRef: { kind: 'prompt-template-only-domain',
                        sha256: recordSha256({ schemaVersion: 1, encoding: 'native-prompt-template-only-domain-ref-v1',
                            sourceProofSha256: proof.proofSha256, native: captured.intent.nativeReceipt,
                            scopeInventorySha256: proof.sourceSnapshot.scopeInventory.inventorySha256 }) } };
            }
            const catalog = deps.catalog(sessionId), selectedIntent = observedIntent(catalog.source);
            if (!selectedIntent)
                return management('OPENING_REQUIRED');
            if (selectedIntent.schemaVersion === 6) {
                // Selection may return a readonly blocked view retaining its Native
                // receipt. Such a projection is not a replacement durable v6 record.
                if (selectedIntent.status !== 'completed' || !selectedIntent.nativeReceipt)
                    return management(selectedIntent.initializationCode ?? 'OPENING_NOT_READY');
                validatePromptTemplateOnlyOpeningIntentV6(selectedIntent);
                const proof = selectedIntent.promptTemplateSourceProof;
                if (!promptTemplateSource.current(proof))
                    return management('PROMPT_TEMPLATE_SOURCE_CHANGED');
                if (!promptTemplateRuntimeObserved(proof))
                    return management('PROMPT_TEMPLATE_RUNTIME_REQUIRED');
                const receipt = callbacks.readNativeOpening(selectedIntent);
                if (receipt.kind !== 'ready' || !same(receipt.receipt, selectedIntent.nativeReceipt))
                    return management('NATIVE_NOT_COMMITTED');
                const inventory = promptTemplateSource.readScopeInventory(sessionId);
                if (!same(inventory, proof.sourceSnapshot.scopeInventory))
                    return management('PROMPT_TEMPLATE_NUMERICAL_STATE_PRESENT');
                return { kind: 'story', sourceSha256, absenceScopeRef: { kind: 'prompt-template-only-domain',
                        sha256: recordSha256({ schemaVersion: 1, encoding: 'native-prompt-template-only-domain-ref-v1',
                            sourceProofSha256: proof.proofSha256, native: receipt.receipt, scopeInventorySha256: inventory.inventorySha256 }) } };
            }
            if (selectedIntent.schemaVersion !== 4)
                return { kind: 'legacy', sourceSha256, reason: 'LEGACY_OPENING_SCHEMA' };
            if (selectedIntent.status !== 'completed' || !selectedIntent.nativeReceipt)
                return management('OPENING_NOT_READY');
            if (selectedIntent.mode === 'native-json' && selectedIntent.initialization) {
                if (deps.readNumericalAuthority) {
                    const authority = deps.readNumericalAuthority(sessionId);
                    return authority.kind === 'ready' ? { kind: 'story', sourceSha256,
                        headRef: { kind: 'numerical-head', sha256: authority.snapshot.headSha256 } } : management(authority.code);
                }
                const readiness = initialization.read(selectedIntent.initialization);
                return readiness.kind === 'ready' ? { kind: 'story', sourceSha256,
                    headRef: { kind: 'numerical-head', sha256: recordSha256(readiness.head) } } : management(readiness.code);
            }
            if (selectedIntent.mode === 'plain' && selectedIntent.absenceScopeProof) {
                const candidate = catalog.candidates.find(item => item.index === selectedIntent.index);
                if (!candidate)
                    return management('OPENING_SOURCE_CHANGED');
                // Re-run only the deterministic absence proof. Native-json's original
                // fresh basis is not recreated after its own committed opening.
                const actual = source.produce({ catalog, candidate });
                const receipt = callbacks.readNativeOpening(selectedIntent);
                if (actual.kind === 'legacy-v2' && same(actual.absenceScopeProof, selectedIntent.absenceScopeProof)
                    && receipt.kind === 'ready' && same(receipt.receipt, selectedIntent.nativeReceipt)) {
                    return { kind: 'story', sourceSha256, absenceScopeRef: { kind: 'plain-absence',
                            sha256: recordSha256({ absence: actual.absenceScopeProof.proofSha256, native: receipt.receipt }) } };
                }
            }
            return management('OPENING_AUTHORITY_UNPROVEN');
        }
        catch (error) {
            const code = error instanceof Error ? error.message : '';
            return management(PROMPT_TEMPLATE_ONLY_CODES_V1.includes(code) ? code : 'SOURCE_OBSERVATION_UNKNOWN');
        }
    }
    function inheritedPromptRuntimeRequest(proof) {
        if (proof.mode !== 'prompt-template-only' || !proof.requiredPromptRuntime)
            throw Error('PROMPT_TEMPLATE_PROTOCOL_UNAVAILABLE');
        return { sessionId: proof.sessionId, sourceProofSha256: proof.proofSha256, required: proof.requiredPromptRuntime };
    }
    function inheritedPromptRuntimeCurrent(proof) {
        if (proof.mode === 'plain')
            return true;
        try {
            return deps.promptTemplateRuntime?.current(inheritedPromptRuntimeRequest(proof)) === true;
        }
        catch {
            return false;
        }
    }
    function inheritedPromptRuntimeObserved(proof) {
        if (proof.mode === 'plain')
            return true;
        try {
            const owner = deps.promptTemplateRuntime, request = inheritedPromptRuntimeRequest(proof);
            return (owner?.observe ? owner.observe(request) : owner?.current(request)) === true;
        }
        catch {
            return false;
        }
    }
    async function preflightInheritedPrompt(sessionId, signal) {
        if (deps.readInheritedPromptTemplateSource?.(sessionId).kind !== 'ready')
            return;
        const initial = await deps.withSourceLock(sessionId, async () => inheritedPromptSource.produce(sessionId));
        if (initial.kind !== 'ready')
            throw Error(initial.code);
        const saved = validatePromptInheritedSourceProofV2(initial.proof);
        if (saved.mode === 'plain')
            return;
        signal?.throwIfAborted();
        if (!deps.promptTemplateRuntime)
            throw Error('PROMPT_TEMPLATE_RUNTIME_REQUIRED');
        await deps.promptTemplateRuntime.preflight(inheritedPromptRuntimeRequest(saved), signal);
        signal?.throwIfAborted();
        await deps.withSourceLock(sessionId, async () => {
            if (!inheritedPromptSource.current(saved))
                throw Error('PROMPT_TEMPLATE_SOURCE_CHANGED');
            if (!inheritedPromptRuntimeCurrent(saved))
                throw Error('PROMPT_TEMPLATE_PROTOCOL_UNAVAILABLE');
        });
    }
    function captureInheritedPromptScopeFacts(sessionId) {
        try {
            const observation = readInputObservation(sessionId), found = inheritedPromptSource.produce(sessionId);
            if (observation.kind !== 'story' || observation.absenceScopeRef?.kind !== 'inherited-prompt-domain'
                || found.kind !== 'ready' || !inheritedPromptRuntimeObserved(found.proof))
                return undefined;
            const proof = found.proof, body = { schemaVersion: 2, encoding: 'native-prompt-inherited-scope-facts-v2',
                authority: 'consumer-data-only', sessionId, sourceSha256: observation.sourceSha256, mode: proof.mode,
                domainRef: { kind: 'inherited-prompt-domain', sha256: observation.absenceScopeRef.sha256 },
                sourceProof: proof, nativeOpening: proof.input.frozenOpening.nativeReceipt, inventory: proof.childInventory,
                variables: { global: 'readonly-absent', chat: 'readonly-absent', card: 'readonly-absent',
                    script: 'unavailable-no-executing-script', messages: 'readonly-uninitialized-selected-cut' } };
            const data = freezePromptTemplateOnlyDataV1({ ...body, factsSha256: recordSha256(body) });
            const current = () => {
                try {
                    const now = readInputObservation(sessionId);
                    return inheritedPromptSource.current(proof) && inheritedPromptRuntimeObserved(proof) && now.kind === 'story'
                        && now.sourceSha256 === data.sourceSha256 && same(now.absenceScopeRef, data.domainRef);
                }
                catch {
                    return false;
                }
            };
            return current() ? { data, current } : undefined;
        }
        catch {
            return undefined;
        }
    }
    return { callbacks, sourceCurrent, readInitialization: initialization.read, nativeCurrent: native.current,
        readNative: (identity, turn) => native.read(identity, turn), readInputObservation,
        readGenesis, readSourceSha256: (sessionId) => inputSource(sessionId).sourceSha256,
        readSourceDescriptor: (sessionId) => inputSource(sessionId).descriptor,
        inheritedPromptSource, readInheritedNative: (input) => native.readInheritedFrozen(input),
        readInheritedOpeningSpan: (input) => native.readInheritedOpeningSpan(input),
        preflightInheritedPrompt, captureInheritedPromptScopeFacts,
        readNonNumericalInventory: (sid) => readPromptNonNumericalInventoryV2(promptDomainDeps, sid),
        hasPromptTemplateOpening: (sessionId) => {
            try {
                const catalog = deps.catalog(sessionId);
                return readIntent(sessionId, catalog.source.importId)?.schemaVersion === 6;
            }
            catch {
                return false;
            }
        },
        preflightPromptTemplate: async (sessionId, signal) => {
            // Import and plain MD inputs legitimately precede an activated card.
            // Only absence skips preflight; malformed active sources still fail.
            if (deps.tables.branch.get(deps.importActiveKey(sessionId)) === undefined)
                return;
            const catalog = deps.catalog(sessionId), intent = readIntent(sessionId, catalog.source.importId);
            if (intent?.schemaVersion !== 6)
                return;
            const checked = validatePromptTemplateOnlyOpeningIntentV6(intent);
            await preflightPromptTemplateRuntime(checked.promptTemplateSourceProof, signal);
        },
        capturePromptTemplateOnlyScopeFacts: (sessionId) => {
            try {
                const observation = readInputObservation(sessionId);
                if (observation.kind !== 'story' || observation.absenceScopeRef?.kind !== 'prompt-template-only-domain')
                    return undefined;
                const captured = captureTemplateObservation(sessionId);
                if (!captured)
                    return undefined;
                const { intent, proof } = captured, inventory = proof.sourceSnapshot.scopeInventory;
                const body = { schemaVersion: 1, encoding: 'native-prompt-template-only-scope-facts-v1',
                    authority: 'consumer-data-only', sessionId, sourceSha256: observation.sourceSha256, sourceIdentity: intent.source,
                    domainRef: { kind: 'prompt-template-only-domain', sha256: observation.absenceScopeRef.sha256 },
                    sourceProof: proof, nativeOpening: intent.nativeReceipt, inventory,
                    variables: { global: 'readonly-absent', chat: 'readonly-absent', card: 'readonly-absent',
                        script: 'unavailable-no-executing-script', messages: 'readonly-uninitialized-selected-cut' } };
                const data = freezePromptTemplateOnlyDataV1({ ...body, factsSha256: recordSha256(body) });
                const current = () => {
                    try {
                        const now = readInputObservation(sessionId);
                        captured.assertCurrent();
                        return now.kind === 'story'
                            && now.sourceSha256 === data.sourceSha256 && same(now.absenceScopeRef, data.domainRef);
                    }
                    catch {
                        return false;
                    }
                };
                return current() ? { data, current } : undefined;
            }
            catch {
                return undefined;
            }
        },
        readAuthorSource: source.readAuthorSource, authorSourceCurrent: source.authorSourceCurrent,
        createSchemaSelection, hasSchemaOpening, readSchemaInitialization,
        createSchemaStory, readSchemaSnapshot: (id) => schemaStory?.readSnapshot(id),
        readSchemaObservation: (id) => schemaStory?.readSchemaObservation(id),
        captureSchemaPromptScopes: (id) => schemaStory?.capturePromptScopes(id),
        capturePlainPromptScopeFacts: (id) => {
            try {
                const observation = readInputObservation(id);
                if (observation.kind !== 'story' || observation.absenceScopeRef?.kind !== 'plain-absence')
                    return undefined;
                const catalog = deps.catalog(id), intent = deps.readOpeningIntent?.(catalog.source);
                if (intent?.schemaVersion !== 4 || intent.status !== 'completed' || intent.mode !== 'plain' || !intent.absenceScopeProof)
                    return undefined;
                const proof = structuredClone(intent.absenceScopeProof), opening = callbacks.readNativeOpening(intent);
                if (opening.kind !== 'ready' || !source.current(proof.sourceSnapshot))
                    return undefined;
                const data = { schemaVersion: 1, encoding: 'native-plain-prompt-scope-facts-v1',
                    authority: 'consumer-data-only', sessionId: id, sourceSha256: observation.sourceSha256,
                    absenceScopeRef: observation.absenceScopeRef, absenceScopeProof: proof, nativeOpening: opening.receipt };
                // This is the existing completed opening's factual absence proof. The
                // prompt adapter must declare its own empty namespace policy; copying
                // this record never grants a schema guest or a Native execution cut.
                const current = () => {
                    const now = readInputObservation(id);
                    return source.current(proof.sourceSnapshot) && now.kind === 'story'
                        && now.sourceSha256 === observation.sourceSha256 && same(now.absenceScopeRef, observation.absenceScopeRef);
                };
                return current() ? { data, current } : undefined;
            }
            catch {
                return undefined;
            }
        },
        readSchemaEditBasis: (id) => schemaStory?.readEditBasis(id),
        submitSchemaPlayer: (input) => schemaPlayer?.submit(input) ?? Promise.resolve({ ok: false,
            code: 'SCHEMA_PLAYER_UNAVAILABLE', error: 'SCHEMA_PLAYER_UNAVAILABLE' }),
        schemaPlayerEditBlockCode: (id) => schemaPlayer ? schemaPlayer.editBlockCode(id) : 'SCHEMA_PLAYER_UNAVAILABLE',
        awaitSchemaPlayerBarrier: (session, signal) => schemaPlayer?.awaitMutationBarrier(session, signal) ?? Promise.resolve(),
        schemaPlayerMutationBlockCode: (session) => schemaPlayer?.mutationBlockCode(session),
        preflightSchema: (id, signal) => hasSchemaOpening(id) && schemaStory
            ? schemaStory.preflight(id, signal) : Promise.resolve(),
        releaseSchemaClosing: (lease) => schemaStory?.releaseClosing(lease),
        invalidateSchemaAgent: (agent) => {
            schemaCore?.invalidateAgent(agent);
            schemaStory?.invalidateAgent(agent);
            schemaPlayer?.invalidateAgent(agent);
        },
        invalidateSchemaSession: (id) => { schemaCore?.invalidateSession(id); schemaStory?.invalidateSession(id); schemaPlayer?.invalidateSession(id); },
        disposeSchema: () => { schemaPlayer?.dispose(); schemaStory?.dispose(); return schemaCore?.dispose(); } };
}
