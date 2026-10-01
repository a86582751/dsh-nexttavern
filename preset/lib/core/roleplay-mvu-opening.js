// Generated from runtime/alpha3/src/core/roleplay-mvu-opening.ts; edit the TypeScript source.
import { recordSha256, sha256 } from './roleplay-data.js';
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
const same = (a, b) => recordSha256(a) === recordSha256(b);
/** Binds actual source, numerical ownership and original native acknowledgement for opening selection. */
export function createRoleplayMvuOpening(deps) {
    const readIntent = (sessionId, importId) => deps.tables.branch.get(openingIntentKey(sessionId, importId));
    const native = createRoleplayMvuNative({ getSession: deps.session, readIntent, messageEdits: deps.messageEdits,
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
    const schemaCore = deps.schema ? createRoleplayMvuSchemaCore({ ...deps.schema, branch: deps.tables.branch,
        status: deps.tables.status, source, session: id => deps.session(id),
        withSourceLock: deps.withSourceLock, nativeRead: (identity, turn) => native.read(identity, turn) }) : undefined;
    let schemaSelection;
    let schemaStory;
    let schemaPlayer;
    function createSchemaStory(completion) {
        if (!schemaCore || !deps.schema)
            return undefined;
        const schemaSource = createRoleplayMvuSchemaSource(sourceDeps, deps.schema.markers);
        const common = { ...deps.schema, branch: deps.tables.branch, status: deps.tables.status,
            source: schemaSource, session: (id) => deps.session(id),
            sourceSha256: (id) => inputSource(id).sourceSha256,
            protectedRuntime: schemaCore.protectedRuntime, withSourceLock: deps.withSourceLock };
        schemaStory ??= createRoleplayMvuSchemaStoryCore({ ...completion, ...common,
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
            if (decision.kind === 'unsupported')
                return { schemaVersion: 2, kind: 'unsupported',
                    diagnostics: decision.diagnostics.map(({ code, pointer }) => ({ code, pointer })) };
            return prepareNativeMvuOpeningInitialization(identity, decision.candidate);
        },
        finishInitialization: async (intent) => intent.initialization && Number.isSafeInteger(intent.committedTurn)
            ? initialization.publish(intent.initialization, intent.committedTurn) : { kind: 'blocked', code: 'RECORD_INVALID' },
        readInitialization: initialization.read, isSourceSnapshotCurrent: source.current,
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
        const pointer = deps.tables.branch.get(deps.importActiveKey(sessionId));
        const owner = typeof pointer?.['sourceRecordSessionId'] === 'string' ? pointer['sourceRecordSessionId'] : sessionId;
        const imported = typeof pointer?.['importId'] === 'string'
            ? deps.tables.branch.get(deps.importRecordKey(owner, pointer['importId'])) : undefined;
        // Source currency excludes input ledgers, native history, volatile jobs and
        // the numerical head. Publishing our own checkpoint/head cannot change it.
        const versions = deps.recordVersionsFor(sessionId);
        const cards = pointer ? versions.cards : Object.fromEntries(Object.entries(versions.cards).filter(([key]) => key !== 'user'));
        const sourceSha256 = recordSha256({ schemaVersion: 1, encoding: 'roleplay-input-source-observation-v1', sessionId,
            pointer: pointer ?? null, importIdentity: imported ? { importId: imported['importId'], rawSha256: imported['rawSha256'],
                normalizedSha256: imported['normalizedSha256'], coverage: imported['fieldProof'], activation: imported['activation'] } : null,
            versions: { cards, worldbook: versions.worldbook, rules: versions.rules, settings: versions.settings },
            statusSpec: recordSha256(deps.tables.status.get(`${sessionId}__spec`)),
            opening: recordSha256(deps.tables.opening.get(`${sessionId}__scene`)),
            openingContext: pointer ? deps.openingContext(sessionId).bindingSha256 : null });
        return { pointer, imported, sourceSha256 };
    }
    function readGenesis(sessionId) {
        try {
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
        // A Native child uses its own derived root. Missing/partial/corrupt basis
        // cannot fall back to selecting another author opening or empty values.
        if (deps.derivedBasisRequired?.(sessionId)) {
            const authority = deps.readNumericalAuthority?.(sessionId);
            return authority?.kind === 'ready' ? { kind: 'story', sourceSha256,
                headRef: { kind: 'numerical-head', sha256: authority.snapshot.headSha256 } }
                : management(authority?.kind === 'blocked' ? authority.code : 'DERIVED_BASIS_NOT_READY');
        }
        try {
            const catalog = deps.catalog(sessionId), selectedIntent = deps.readOpeningIntent?.(catalog.source);
            if (!selectedIntent)
                return management('OPENING_REQUIRED');
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
        catch {
            return management('SOURCE_OBSERVATION_UNKNOWN');
        }
    }
    return { callbacks, sourceCurrent, readInitialization: initialization.read, nativeCurrent: native.current,
        readNative: (identity, turn) => native.read(identity, turn), readInputObservation,
        readGenesis, readSourceSha256: (sessionId) => inputSource(sessionId).sourceSha256,
        readAuthorSource: source.readAuthorSource, authorSourceCurrent: source.authorSourceCurrent,
        createSchemaSelection, hasSchemaOpening, readSchemaInitialization,
        createSchemaStory, readSchemaSnapshot: (id) => schemaStory?.readSnapshot(id),
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
