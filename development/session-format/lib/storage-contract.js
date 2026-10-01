// Generated from runtime/alpha3/compat/session-format/src/storage-contract.ts; edit the TypeScript source.
/** Retain official validation for every upstream event; admit only our exact required vocabulary. */
import { adoptSessionEvent } from '@deepseek-ai/dsh-session';
import { validateStoredEvents as validateOfficialEvents } from '@deepseek-ai/dsh-session-persistence';
import { MESSAGE_EDIT_EVENT, assertMessageEdit } from './projection.js';
import { foldSurface } from '@deepseek-ai/dsh-session/surface';
import { currentSessionMessageProjections } from './catalog.js';
export * from '@deepseek-ai/dsh-session-persistence';
/** Only edit-containing write batches need complete-prefix target validation. */
export function validateMessageEditHistory(events) {
    foldSurface(events, currentSessionMessageProjections);
}
export const validateStoredEvents = (meta, events, location) => {
    for (const [index, event] of events.entries()) {
        if (event.type === MESSAGE_EDIT_EVENT) {
            if (event.ignorable)
                throw Error('Message edits cannot be marked ignorable');
            assertMessageEdit(event.data);
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
