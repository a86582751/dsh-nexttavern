// Generated from runtime/alpha3/compat/session-format/src/storage-contract.ts; edit the TypeScript source.
/** Validate current records with their Native owner and retain shared storage failures. */
import { adoptSessionEvent, KNOWN_SESSION_EVENT_TYPES } from 'dsh-nexttavern-native-session';
import { validateStoredEvents as validateOfficialEvents, SessionPersistenceCorruptionError } from '@deepseek-ai/dsh-session-persistence';
import { MESSAGE_EDIT_EVENT, assertMessageEdit } from './projection.js';
import { foldSurface } from 'dsh-nexttavern-native-session/surface';
import { currentSessionMessageProjections } from './catalog.js';
import { MVU_PLAYER_EDIT_EVENT, assertMvuPlayerEditEvent, assertMvuPlayerMarkerBoundary } from './mvu-player-marker.js';
import { MVU_SCHEMA_DISPATCH_EVENT, MVU_SCHEMA_COMPLETION_EVENT, MVU_SCHEMA_REVISION_EVENT, assertMvuSchemaMarkerEvent, assertMvuSchemaHistory, assertMvuSchemaEventVocabulary } from './mvu-schema-marker.js';
import { AUTHOR_INJECTION_CLEANUP_EVENT, assertAuthorInjectionCleanup, AUTHOR_INJECTION_DECLARATION_EVENT, assertAuthorInjectionDeclaration } from './author-injection-cleanup.js';
import { AUTHOR_CHAT_ROOT_EVENT, assertAuthorChatRootMarker } from './author-chat-marker.js';
import { readNativeAuthorPublicationV1, readNativePublishedTriggerV1 } from 'dsh-nexttavern-native-session/types';
export * from '@deepseek-ai/dsh-session-persistence';
export { createNativeV4RelationshipValidator, assertNativeV4Relationships } from './native-v4/validation.js';
/** Required edit/marker batches validate against their actual durable prefix. */
export function validateMessageEditHistory(events) {
    foldSurface(events, currentSessionMessageProjections);
    if (events.some(event => event.type === MVU_SCHEMA_DISPATCH_EVENT || event.type === MVU_SCHEMA_COMPLETION_EVENT
        || event.type === MVU_SCHEMA_REVISION_EVENT)) {
        assertMvuSchemaHistory(events);
    }
    for (const event of events)
        if (event.type === MVU_PLAYER_EDIT_EVENT) {
            assertMvuPlayerMarkerBoundary(events.slice(0, event.seq + 1));
        }
}
export const validateStoredEvents = (meta, events, location) => {
    for (const [index, event] of events.entries()) {
        if (event.type === 'user/message')
            readNativeAuthorPublicationV1(event.data.source);
        else if (event.type === 'agent/inbox/spliced') {
            readNativePublishedTriggerV1(event.data);
            for (const message of event.data.inserted)
                readNativeAuthorPublicationV1(message.source);
        }
        assertMvuSchemaEventVocabulary(event.type);
        if (event.type === MESSAGE_EDIT_EVENT) {
            if (event.ignorable)
                throw Error('Message edits cannot be marked ignorable');
            assertMessageEdit(event.data);
            events[index] = adoptSessionEvent(event);
        }
        else if (event.type === AUTHOR_CHAT_ROOT_EVENT) {
            if (event.ignorable)
                throw Error('AUTHOR_CHAT_ROOT_NOT_IGNORABLE');
            assertAuthorChatRootMarker(event.data);
            events[index] = adoptSessionEvent(event);
        }
        else if (event.type === MVU_PLAYER_EDIT_EVENT) {
            assertMvuPlayerEditEvent(event);
            events[index] = adoptSessionEvent(event);
        }
        else if (event.type === MVU_SCHEMA_DISPATCH_EVENT || event.type === MVU_SCHEMA_COMPLETION_EVENT
            || event.type === MVU_SCHEMA_REVISION_EVENT) {
            assertMvuSchemaMarkerEvent(event);
            events[index] = adoptSessionEvent(event);
        }
        else if (event.type === AUTHOR_INJECTION_DECLARATION_EVENT) {
            if (event.ignorable)
                throw Error('AUTHOR_INJECTION_DECLARATION_NOT_IGNORABLE');
            assertAuthorInjectionDeclaration(event.data);
            events[index] = adoptSessionEvent(event);
        }
        else if (event.type === AUTHOR_INJECTION_CLEANUP_EVENT) {
            if (event.ignorable)
                throw Error('AUTHOR_INJECTION_CLEANUP_NOT_IGNORABLE');
            assertAuthorInjectionCleanup(event.data);
            events[index] = adoptSessionEvent(event);
        }
        else {
            // The official helper closes over the official Session vocabulary. Reuse
            // its format-refusal contract only where the current owner also refuses.
            // Ordinary current records are adopted once by the same Native Session
            // that publishes them; the backend still owns batch continuity.
            if (!KNOWN_SESSION_EVENT_TYPES.has(event.type) && event.ignorable !== true
                || event.type === 'request/header' && event.data?.reason === 'fallback') {
                validateOfficialEvents(meta, [event], location);
            }
            try {
                events[index] = adoptSessionEvent(event);
            }
            catch (error) {
                throw new SessionPersistenceCorruptionError(`stored session "${meta.id}" failed validation: ${String(error)}`, { cause: error });
            }
        }
    }
    return events;
};
