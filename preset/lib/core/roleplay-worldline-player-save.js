// Generated from runtime/alpha3/src/core/roleplay-worldline-player-save.ts; edit the TypeScript source.
/** Shared player choice identity is independent of Native edit completion. */
import { recordSha256 } from './roleplay-data.js';
export const worldlinePlayerSaveIntentKey = (groupId, playerVariantId, operationId) => `fork-player-save-${recordSha256({ groupId, playerVariantId, operationId })}`;
export function readWorldlinePlayerSaveIntent(branch, ref) {
    const save = branch.get(ref.key);
    if (save?.schemaVersion !== 1 || save.encoding !== 'nexttavern-worldline-player-save-intent-v1'
        || typeof save.groupId !== 'string' || typeof save.playerVariantId !== 'string' || typeof save.operationId !== 'string'
        || !Array.isArray(save.targetSessionIds) || save.targetSessionIds.some(id => typeof id !== 'string')
        || ref.key !== worldlinePlayerSaveIntentKey(save.groupId, save.playerVariantId, save.operationId)
        || recordSha256(save) !== ref.sha256)
        throw Error('SCHEMA_USER_EDIT_RECOVERY_SAVE_UNPROVEN');
    return save;
}
export function assertWorldlinePlayerSaveRequest(save, sessionId, origin, text) {
    const request = { senderSessionId: origin.sessionId, target: origin, text,
        options: { schemaVersion: 1, operationId: save.operationId, suffix: 'retain' } };
    if (!save.targetSessionIds.includes(sessionId) || !save.targetSessionIds.includes(origin.sessionId)
        || recordSha256(request) !== save.requestSha256)
        throw Error('SCHEMA_USER_EDIT_RECOVERY_REQUEST_UNPROVEN');
}
const sameRef = (a, b) => a?.key === b.key && a.sha256 === b.sha256;
function baseline(variant) {
    return variant.currentSaveRef ? { currentSaveRef: variant.currentSaveRef } : { legacy: {
            textSha256: recordSha256(variant.text), revision: variant.revision,
            ...(variant.schemaTaskEdit ? { schemaTaskEditOperationId: variant.schemaTaskEdit.options.operationId } : {})
        } };
}
function isBase(variant, base) {
    if ('currentSaveRef' in base)
        return sameRef(variant.currentSaveRef, base.currentSaveRef);
    return !variant.currentSaveRef && variant.revision === base.legacy.revision
        && variant.schemaTaskEdit?.options.operationId === base.legacy.schemaTaskEditOperationId
        && recordSha256(variant.text) === base.legacy.textSha256;
}
export function createWorldlinePlayerSaves(branch) {
    // The Surface owns the fork lock and publication. This owner writes only the
    // immutable admission record; a failed group put leaves its exact base current.
    function prepare(groupId, playerVariantId, variant, request) {
        const operationId = request.options.operationId, key = worldlinePlayerSaveIntentKey(groupId, playerVariantId, operationId), requestSha256 = recordSha256(request), stored = branch.get(key);
        if (stored && stored.requestSha256 !== requestSha256)
            throw Error('SCHEMA_TASK_EDIT_OPERATION_CONFLICT');
        const storedRef = stored ? { key, sha256: recordSha256(stored) } : undefined, current = !!storedRef && sameRef(variant.currentSaveRef, storedRef);
        if (stored && !current && !isBase(variant, stored.base))
            throw Error('SCHEMA_TASK_EDIT_OPERATION_CONFLICT');
        return { current, targetSessionIds: stored?.targetSessionIds, async persist(targetSessionIds) {
                if (storedRef)
                    return storedRef;
                // Membership is sealed only after Surface resolves every actual Native
                // target. Publication retries retain that cohort, including before group.put.
                const intent = { schemaVersion: 1,
                    encoding: 'nexttavern-worldline-player-save-intent-v1', groupId, playerVariantId, operationId,
                    requestSha256, base: baseline(variant), targetSessionIds: [...targetSessionIds] };
                const ref = { key, sha256: recordSha256(intent) };
                await branch.put(key, intent);
                return ref;
            } };
    }
    return { prepare };
}
