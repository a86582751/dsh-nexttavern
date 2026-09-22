// Generated from runtime/alpha3/compat/session-format/src/catalog.ts; edit the TypeScript source.
/** Build a private vocabulary; never mutate the host's exported known-event set. */
import { KNOWN_SESSION_EVENT_TYPES, Session, SessionId, SessionLogOffset } from '@deepseek-ai/dsh-session';
import { createSessionFormatCatalog } from '@deepseek-ai/dsh-session-format';
import { currentSessionMessageProjections as officialProjections } from '@deepseek-ai/dsh-session-format-catalog/message-projections';
import { releasedV0SessionFormatCodec, releasedV1SessionFormatCodec, sessionFormatV0ToV1 } from '@deepseek-ai/dsh-session-format-v0-to-v1';
import { releasedV2SessionFormatCodec, sessionFormatV1ToV2 } from '@deepseek-ai/dsh-session-format-v1-to-v2';
import { releasedV3SessionFormatCodec, sessionFormatV2ToV3 } from '@deepseek-ai/dsh-session-format-v2-to-v3';
import { assertReleasedV4Header, releasedV4SessionFormatCodec, restoreReleasedV4Artifact, sessionFormatV3ToV4 } from '@deepseek-ai/dsh-session-format-v3-to-v4';
import { MESSAGE_EDIT_EVENT, assertMessageEdit, messageEditProjection } from './projection.js';
export { SessionFormatUnsupportedMigrationError } from '@deepseek-ai/dsh-session-format';
// Historical official sessions use the host's child-aware migration. Private
// alpha.6 edit logs are deliberately unsupported; new edits are V4 only.
export { createSessionFormatCatalogWithChildren } from '@deepseek-ai/dsh-session-format-catalog';
export const currentSessionMessageProjections = [...officialProjections, messageEditProjection];
export const knownSessionEventTypes = new Set([...KNOWN_SESSION_EVENT_TYPES, MESSAGE_EDIT_EVENT]);
function restore(artifact) {
    const restored = restoreReleasedV4Artifact(artifact, knownSessionEventTypes);
    for (const event of restored.events)
        if (event.type === MESSAGE_EDIT_EVENT)
            assertMessageEdit(event.data);
    // The released decoder validates JSON vocabulary; Session now validates the
    // current branded envelope, seed boundary and projection decisions at runtime.
    Session.fromRestore(SessionId(restored.header.id), restored.events, restored.header, SessionLogOffset(restored.inheritedEventCount), 'detached', currentSessionMessageProjections);
    return restored;
}
export const sessionFormatCatalog = createSessionFormatCatalog({
    currentVersion: 4,
    codecs: [releasedV0SessionFormatCodec, releasedV1SessionFormatCodec, releasedV2SessionFormatCodec,
        releasedV3SessionFormatCodec, releasedV4SessionFormatCodec],
    currentEncoder: releasedV4SessionFormatCodec,
    migrations: [sessionFormatV0ToV1, sessionFormatV1ToV2, sessionFormatV2ToV3, sessionFormatV3ToV4],
    restoreCurrent: restore,
    restoreTransformedCurrent: restore,
    restoreCurrentHeader(header) {
        assertReleasedV4Header(header);
        Session.fromRestore(SessionId(header.id), [], header, SessionLogOffset(0), 'detached');
        return header;
    },
});
