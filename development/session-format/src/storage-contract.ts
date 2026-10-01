/** Retain official validation for every upstream event; admit only our exact required vocabulary. */
import {adoptSessionEvent, type SessionEvent} from '@deepseek-ai/dsh-session'
import {validateStoredEvents as validateOfficialEvents} from '@deepseek-ai/dsh-session-persistence'
import {MESSAGE_EDIT_EVENT, assertMessageEdit} from './projection.js'
import {foldSurface} from '@deepseek-ai/dsh-session/surface'
import {currentSessionMessageProjections} from './catalog.js'
import {MVU_PLAYER_EDIT_EVENT, assertMvuPlayerEditEvent,assertMvuPlayerMarkerBoundary} from './mvu-player-marker.js'
import {MVU_SCHEMA_DISPATCH_EVENT, MVU_SCHEMA_COMPLETION_EVENT,
  assertMvuSchemaMarkerEvent, assertMvuSchemaHistory, assertMvuSchemaEventVocabulary} from './mvu-schema-marker.js'

export * from '@deepseek-ai/dsh-session-persistence'

/** Required edit/marker batches validate against their actual durable prefix. */
export function validateMessageEditHistory(events: readonly SessionEvent[]): void {
  foldSurface(events, currentSessionMessageProjections)
  if (events.some(event => event.type === MVU_SCHEMA_DISPATCH_EVENT || event.type === MVU_SCHEMA_COMPLETION_EVENT)) {
    assertMvuSchemaHistory(events)
  }
  for(const event of events)if(event.type===MVU_PLAYER_EDIT_EVENT) {
    assertMvuPlayerMarkerBoundary(events.slice(0,event.seq+1))
  }
}

export const validateStoredEvents: typeof validateOfficialEvents = (meta, events, location) => {
  for (const [index, event] of events.entries()) {
    assertMvuSchemaEventVocabulary(event.type)
    if (event.type === MESSAGE_EDIT_EVENT) {
      if (event.ignorable) throw Error('Message edits cannot be marked ignorable')
      assertMessageEdit(event.data)
      events[index] = adoptSessionEvent(event)
    } else if (event.type === MVU_PLAYER_EDIT_EVENT) {
      assertMvuPlayerEditEvent(event)
      events[index] = adoptSessionEvent(event)
    } else if (event.type === MVU_SCHEMA_DISPATCH_EVENT || event.type === MVU_SCHEMA_COMPLETION_EVENT) {
      assertMvuSchemaMarkerEvent(event)
      events[index] = adoptSessionEvent(event)
    } else {
      // The upstream routine validates records, not seq continuity; the backend
      // owns contiguous-batch checks. No unknown event gets a synthetic exemption.
      const checked: SessionEvent[] = [event]
      validateOfficialEvents(meta, checked, location)
      events[index] = checked[0]!
    }
  }
  return events
}
