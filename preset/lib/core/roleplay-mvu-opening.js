// Generated from runtime/alpha3/src/core/roleplay-mvu-opening.ts; edit the TypeScript source.
import { recordSha256, sha256 } from './roleplay-data.js';
import { createRoleplayMvuSource } from './roleplay-mvu-source.js';
import { createRoleplayMvuBasis } from './roleplay-mvu-basis.js';
import { createRoleplayMvuNative } from './roleplay-mvu-native.js';
import { createRoleplayMvuInitialization, prepareNativeMvuOpeningInitialization } from './roleplay-mvu-initialization.js';
import { openingIntentKey } from './roleplay-opening-selection.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
/** Binds actual source, numerical ownership and original native acknowledgement for opening selection. */
export function createRoleplayMvuOpening(deps) {
    const readIntent = (sessionId, importId) => deps.tables.branch.get(openingIntentKey(sessionId, importId));
    const native = createRoleplayMvuNative({ getSession: deps.session, readIntent, messageEdits: deps.messageEdits,
        deletedMessageIds: deps.deletedMessageIds, lookup: deps.nativeLookup });
    const basis = createRoleplayMvuBasis({ branch: deps.tables.branch, numerical: deps.tables.status,
        session: deps.session, branchReady: deps.branchReady, nativeCurrent: native.current });
    const source = createRoleplayMvuSource({
        readActivePointer: id => deps.tables.branch.get(deps.importActiveKey(id)),
        readImportRecord: (id, importId) => deps.tables.branch.get(deps.importRecordKey(id, importId)),
        readRow: (table, key) => deps.tables[table].get(key),
        recordVersionsFor: deps.recordVersionsFor, readOpeningContext: deps.openingContext, readFreshNativeBasis: basis.fresh,
    });
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
    function readInputObservation(sessionId) {
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
        const management = (reason) => ({ kind: 'management', sourceSha256, reason });
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
        try {
            const catalog = deps.catalog(sessionId), selectedIntent = deps.readOpeningIntent?.(catalog.source);
            if (!selectedIntent)
                return management('OPENING_REQUIRED');
            if (selectedIntent.schemaVersion !== 4)
                return { kind: 'legacy', sourceSha256, reason: 'LEGACY_OPENING_SCHEMA' };
            if (selectedIntent.status !== 'completed' || !selectedIntent.nativeReceipt)
                return management('OPENING_NOT_READY');
            if (selectedIntent.mode === 'native-json' && selectedIntent.initialization) {
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
        readNative: (identity, turn) => native.read(identity, turn), readInputObservation };
}
