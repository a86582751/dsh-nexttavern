import type {} from '@deepseek-ai/dsh-api-session-controller/client'
/** Client Session object layer, Agent scopes, and Remote lifecycle wiring. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent/types'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-file-upload/client'
import { typertOwnedValue } from '@deepseek-ai/dsh-typert-protocol'
import { createSessionControlStream } from './transport.js'
import { ClientSessions } from './sessions/service.js'
import type { SessionRemotes } from './sessions/remotes.js'
import type {} from '@deepseek-ai/dsh-api-session-controller/remote-events'

export {
  createSessionControlStream,
  SessionEventStream,
  SESSION_SEARCH_RESULT_LIMIT,
  SESSION_SEARCH_SNIPPET_MAX_CODE_POINTS,
} from './transport.js'
export type {
  ClientSessionPageRequest,
  SessionControlStream,
  SessionControlStreamOptions,
  SessionEventStreamOptions,
  SessionJournalChange,
  SessionRemote,
} from './transport.js'
export { createScope, scopeOf } from './scope.js'
export type { AgentContext, AgentScopeHandle } from './scope.js'
export { SessionCreateError, SessionForkError } from './sessions/service.js'
export type { SessionBinding, SessionListState, SessionSummary } from './sessions/service.js'
export type {
  SessionListPhase,
  SessionListSnapshot,
  SessionSearchResultItem,
  SubagentCatalogSnapshot,
} from './sessions/manager.js'
export type { Session } from './sessions/session.js'
export type {
  ProjectionsBaseline,
  ProjectionValueStore,
  SessionProjectionMap,
  UseProjection,
} from './sessions/projection-store.js'
export type {
  BeginSubmissionInput,
  ISession,
  PendingSubmissionRetirement,
  ProjectionsFace,
  SessionFace,
  SubmissionHandle,
} from './contract/session.js'
export type {
  ISessions, SessionReference, SessionRetainInfo, SessionRetainOptions, SessionTarget,
} from './contract/sessions.js'
export { MutableSessionEventSource } from './contract/events.js'
export type {
  AssistantLiveChunkEvent,
  SessionAssistantSettlementEntry,
  SessionEventChange,
  SessionEventLike,
  SessionEventLikeEntry,
  SessionEventSource,
  SessionEventWindow,
  SessionLiveEventEntry,
  SessionTransientEventEntry,
} from './contract/events.js'
export type {
  OpenState,
  PendingSubmission,
  PendingSubmissionAttachment,
  PendingSubmissionFileAttachment,
  PendingSubmissionImage,
  PendingSubmissionImageAttachment,
  PendingSubmissionPlacement,
  PromptError,
  SessionSnapshot,
} from './contract/snapshot.js'

/** Consumer-owned reference labels; extend this map through the package's canonical /client entry. */
export interface SessionReferenceSourceMap {
  /** Temporary Client Controller work, including fork-title preparation. */
  controllerOperation: unknown
  /** A Client Gateway invocation's synchronous Context ownership. */
  gateway: unknown
}

/** Declaration-merge-extensible labels carried by independent Client references. */
export type SessionReferenceSource = Extract<keyof SessionReferenceSourceMap, string>

// Keep the official shared Context contract; the owned implementation must satisfy it.

/** Required Remote and Context projection services. */
export const inject = [
  'connection',
  'fileUpload',
  'typert',
  'remote',
  'remote.commands',
  'remote.session',
  'remote.subagents',
]

/**
 * Install Client Session state and its reconnecting control stream.
 * @param ctx - Client Cordis context.
 */
export function apply(ctx: Context): void {
  const remotes = ctx.remote as unknown as SessionRemotes
  const connection = ctx.get('connection') as ConnectionHandle
  const sessions = new ClientSessions(ctx, remotes)
  sessions satisfies Context['sessions']
  ctx.remote.$on('api-session/added', (summary) => { sessions.handleSessionAdded(summary) })
  ctx.remote.$on('api-session/removed', (sessionId) => { sessions.handleSessionRemoved(sessionId) })
  ctx.remote.$on('api-session/status', (sessionId, running) => {
    sessions.handleSessionStatus(sessionId, running)
  })
  ctx.remote.$on('api-session/activity', (sessionId, updatedAt) => {
    sessions.handleSessionActivity(sessionId, updatedAt)
  })
  ctx.remote.$on('api-session/error', (sessionId, message) => {
    sessions.handleSessionError(sessionId, message)
  })

  const control = createSessionControlStream(remotes, {
    accept: (frame) => { sessions.handleControlFrame(frame) },
    failed: (error) => { console.error('[session-controller] control stream failed:', error) },
  })
  const connected = (): void => {
    if (connection.generation.getSnapshot() === undefined) return
    // A ready control baseline may arrive before Cordis delivers connection/reset.
    sessions.handleConnected()
    control.restart()
    control.start()
  }
  ctx.effect(() => connection.generation.subscribe(connected), 'session-controller.client.generation')
  connected()
  ctx.typert.contexts.registerClient('agent', {
    identity: candidate => sessions.sessionOf(candidate)?.sessionId,
    resolve: (sessionId) => {
      const reference = sessions.retainAgentScope(sessionId)
      return typertOwnedValue(reference.binding.ctx, () => { reference.release() })
    },
  })
  ctx.effect(() => async () => { await control.dispose() }, 'session-controller.client.control')
}
