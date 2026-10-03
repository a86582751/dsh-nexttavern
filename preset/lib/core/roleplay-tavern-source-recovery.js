// Generated from runtime/alpha3/src/core/roleplay-tavern-source-recovery.ts; edit the TypeScript source.
/** A legacy copy with no frozen Source can still activate an explicitly new
 * own import. This management checkpoint preserves the old rows and numerical
 * denial anchors; it grants no Source, opening, story or numerical authority. */
import { recordSha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { tavernSourceOwnedRecordKeysV1 } from './roleplay-tavern-source-inheritance-data.js';
function fail() { throw Error('SOURCE_OWN_ACTIVATION_RECOVERY_UNPROVEN'); }
const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => recordSha256(a) === recordSha256(b);
const family = /^(?:SOURCE_INHERITANCE|DERIVED_ANCESTRY)_[A-Z_]+$/;
export function createRoleplayTavernOwnSourceRecoveryV1(deps) {
    async function ensureForOwnSourceActivation(session) {
        deps.assertActualManagementScope(session);
        try {
            await deps.ensureBranch(session);
            return;
        }
        catch (error) {
            if (!(error instanceof Error) || !family.test(error.message))
                throw error;
        }
        await deps.withSourceLock(session.id, async () => {
            deps.assertActualManagementScope(session);
            const sid = session.id, metaKey = `${sid}__meta`, pointerKey = `${sid}__import-active`, meta = cloneRoleplayTavernLoreDataV1(deps.branch.get(metaKey), 8_388_608), pointer = cloneRoleplayTavernLoreDataV1(deps.branch.get(pointerKey), 8192);
            if (!object(meta) || !object(pointer) || typeof pointer.importId !== 'string' || typeof pointer.inheritedFrom !== 'string'
                || session.header?.id !== sid || session.header.isSeeded !== true || typeof session.header.parentSession !== 'string'
                || !Number.isSafeInteger(session.inheritedEventCount) || Number(session.inheritedEventCount) < 1
                || meta.inheritanceState !== 'ready' || meta.inheritedFrom !== session.header.parentSession
                || meta.inheritedAtSeedLength !== session.inheritedEventCount)
                fail();
            // A partial new transaction keeps its own recovery path. Do not overwrite
            // its exact copy intent, frozen baseline, scope row or ready publication.
            for (const key of tavernSourceOwnedRecordKeysV1(sid))
                if (deps.branch.get(key) !== undefined)
                    fail();
            const inspection = deps.source.inspectLegacySourceInheritance(sid);
            if (inspection.kind !== 'requires-new-source-activation')
                fail();
            const existing = meta.ownSourceActivationRecoveryV1;
            if (existing !== undefined) {
                if (!object(existing) || !same(Object.keys(existing).sort(), ['schemaVersion', 'encoding', 'authority', 'sessionId',
                    'priorMeta', 'priorPointer', 'inspection', 'checkpointSha256'].sort()))
                    fail();
                const { checkpointSha256, ...body } = existing;
                if (existing.schemaVersion !== 1 || existing.encoding !== 'native-legacy-own-source-activation-checkpoint-v1'
                    || existing.authority !== 'management-data-only' || existing.sessionId !== sid
                    || checkpointSha256 !== recordSha256(body) || !same(existing.priorPointer, pointer))
                    fail();
                return;
            }
            const body = { schemaVersion: 1, encoding: 'native-legacy-own-source-activation-checkpoint-v1',
                authority: 'management-data-only', sessionId: sid, priorMeta: meta, priorPointer: pointer,
                inspection: { kind: inspection.kind, evidenceSha256: inspection.evidenceSha256, missingEvidence: inspection.missingEvidence } }, checkpoint = { ...body, checkpointSha256: recordSha256(body) }, next = { ...meta, ownSourceActivationRecoveryV1: checkpoint };
            deps.assertActualManagementScope(session);
            if (!same(deps.branch.get(metaKey), meta) || !same(deps.branch.get(pointerKey), pointer))
                fail();
            try {
                await deps.branch.put(metaKey, next);
            }
            catch { /* Only exact readback resolves a lost ACK. */ }
            if (!same(deps.branch.get(metaKey), next))
                fail();
            deps.assertActualManagementScope(session);
        });
    }
    return { ensureForOwnSourceActivation };
}
