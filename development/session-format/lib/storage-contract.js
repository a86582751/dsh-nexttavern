// Generated from runtime/alpha3/compat/session-format/src/storage-contract.ts; edit the TypeScript source.
/** Retain official validation for every upstream event; admit only our exact required vocabulary. */
import { adoptSessionEvent } from '@deepseek-ai/dsh-session';
import { validateStoredEvents as validateOfficialEvents } from '@deepseek-ai/dsh-session-persistence';
import { MESSAGE_EDIT_EVENT, assertMessageEdit } from './projection.js';
import { foldSurface } from '@deepseek-ai/dsh-session/surface';
import { currentSessionMessageProjections } from './catalog.js';
import { MVU_PLAYER_EDIT_EVENT, assertMvuPlayerEditEvent, assertMvuPlayerMarkerBoundary } from './mvu-player-marker.js';
export * from '@deepseek-ai/dsh-session-persistence';
/** Required edit/marker batches validate against their actual durable prefix. */
export function validateMessageEditHistory(events) {
    foldSurface(events, currentSessionMessageProjections);
    for (const event of events)
        if (event.type === MVU_PLAYER_EDIT_EVENT) {
            assertMvuPlayerMarkerBoundary(events.slice(0, event.seq + 1));
        }
}
export const validateStoredEvents = (meta, events, location) => {
    for (const [index, event] of events.entries()) {
        if (event.type === MESSAGE_EDIT_EVENT) {
            if (event.ignorable)
                throw Error('Message edits cannot be marked ignorable');
            assertMessageEdit(event.data);
            events[index] = adoptSessionEvent(event);
        }
        else if (event.type === MVU_PLAYER_EDIT_EVENT) {
            assertMvuPlayerEditEvent(event);
            events[index] = adoptSessionEvent(event);
        }
        else {
            // The upstream routine validates records, not seq continuity; the backend
            // owns contiguous-batch checks. No unknown event gets a synthetic exemption.
            const checked = [event];
            validateOfficialEvents(meta, checked, location);
            events[index] = checked[0];
        }
    }
    return events;
};
