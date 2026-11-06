// Generated from runtime/alpha3/src/core/author-native-program.mts; edit the TypeScript source.
/** Source-owned native helper bytes and execution layout. This capture neither
 * classifies JavaScript nor grants a live realm permission to call a writer. */
import { recordSha256 } from './roleplay-data.js';
/** The complete Original owns code digests. This program's identity seals its
 * Source membership/layout using those pins, without reserializing source JS. */
export function authorNativeProgramSha256V1(program) {
    const scripts = program.scripts.map(({ javascript: _javascript, ...pin }) => pin);
    return recordSha256({ ...program, scripts });
}
/** The caller owns checked Original DATA and live Source/Session/Stop currency.
 * This synchronous projection consumes schemaOriginalCompilationInput(original)
 * directly; it does not require a Browser program or executable Host artifact. */
export function captureAuthorNativeProgramV1(input) {
    const membership = new Map();
    const realms = input.realms.map(({ realmId, groupId, originalOrdinals }) => {
        for (const ordinal of originalOrdinals) {
            membership.set(ordinal, realmId);
        }
        return { realmId, groupId };
    });
    const scripts = [];
    for (const [originalOrdinal, descriptor] of input.scripts.entries()) {
        const realmId = membership.get(originalOrdinal);
        if (realmId === undefined)
            continue;
        // Raw author metadata belongs to the same captured Source card. The code
        // descriptor intentionally carries only executable bytes/import pins.
        let raw = input.source.material.card;
        for (const encoded of descriptor.pointer.split('/').slice(1)) {
            const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
            raw = raw && typeof raw === 'object' ? raw[key] : undefined;
        }
        const data = raw && typeof raw === 'object' ? raw : undefined;
        const button = data?.button;
        const buttons = button?.buttons?.filter(row => typeof row.name === 'string')
            .map(row => ({ name: row.name, visible: row.visible === true })) ?? [];
        scripts.push({ originalOrdinal, realmId, identity: descriptor.identity, pointer: descriptor.pointer,
            enabled: descriptor.enabled, javascript: descriptor.source, sourceSha256: descriptor.sourceSha256,
            descriptorSha256: recordSha256(descriptor), scriptId: typeof data?.id === 'string' ? data.id : descriptor.identity,
            ...typeof data?.name === 'string' ? { name: data.name } : {},
            ...button ? { button: { enabled: button.enabled !== false, buttons } } : {} });
    }
    const { ownerSessionId, importId, sourceSha256, importRecordSha256, sourceSnapshotSha256, materialSha256 } = input.source;
    const source = { ownerSessionId, importId, sourceSha256, importRecordSha256, sourceSnapshotSha256, materialSha256,
        sourceRecordSessionId: input.sourceRecordSessionId };
    const body = { schemaVersion: 1, encoding: 'author-native-program-v1',
        authority: 'captured-source-data-only', source, realms, scripts };
    // Source already owns code/material digests. Hash each selected raw descriptor
    // once, then seal the layout with those pins rather than serializing JS again.
    return { ...body, programSha256: authorNativeProgramSha256V1(body) };
}
