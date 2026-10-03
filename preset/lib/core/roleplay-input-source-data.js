// Generated from runtime/alpha3/src/core/roleplay-input-source-data.ts; edit the TypeScript source.
/** One deterministic numerical Source encoding. Both today's reader and a
 * frozen inheritance package describe the same owner fields; lore journals,
 * Native work records and numerical publications do not enter this identity. */
import { recordSha256 } from './roleplay-data.js';
export function describeRoleplayInputSourceV1(captured) {
    const { sessionId, pointer, imported, versions } = captured, cards = pointer ? versions.cards : Object.fromEntries(Object.entries(versions.cards).filter(([key]) => key !== 'user'));
    return { schemaVersion: 1, encoding: 'roleplay-input-source-observation-v1', sessionId,
        pointer: pointer ?? null, importIdentity: imported ? { importId: imported['importId'], rawSha256: imported['rawSha256'],
            normalizedSha256: imported['normalizedSha256'], coverage: imported['fieldProof'], activation: imported['activation'] } : null,
        versions: { cards, worldbook: versions.worldbook, rules: versions.rules, settings: versions.settings },
        statusSpec: captured.statusSpecSha256, opening: captured.openingSha256,
        openingContext: pointer ? captured.openingContextBindingSha256 : null };
}
export const roleplayInputSourceSha256V1 = (captured) => recordSha256(describeRoleplayInputSourceV1(captured));
