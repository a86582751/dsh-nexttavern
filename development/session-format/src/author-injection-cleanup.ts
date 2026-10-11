/** Required Native DATA for author cleanup across successor Main turns.
 * Private Core attachments own admission; restored rows grant no live rights. */
import type {Session, SessionEvent} from '@deepseek-ai/dsh-session'

export const AUTHOR_INJECTION_CLEANUP_EVENT = 'roleplay/author-injection-cleanup' as const
export interface AuthorInjectionResourceV1 {
  readonly browserSessionId: string
  readonly generation: string
  /** Omitted only for a whole attachment's resource-closed record. */
  readonly pageId?: string
}
export type AuthorInjectionCleanupV1 = {
  readonly schemaVersion: 1
  readonly encoding: 'native-author-injection-cleanup-v1'
  readonly sessionId: string
  readonly programSha256: string
  readonly resource: AuthorInjectionResourceV1
} & (
  | {readonly kind: 'remove-ids'; readonly ids: readonly string[]}
  | {readonly kind: 'resource-closed'}
)

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'roleplay/author-injection-cleanup': AuthorInjectionCleanupV1
  }
}

/** Decode this durable version only; Core owns Source and resource authority. */
export function assertAuthorInjectionCleanup(value: unknown): asserts value is AuthorInjectionCleanupV1 {
  if (!value || typeof value !== 'object') throw Error('AUTHOR_INJECTION_CLEANUP_INVALID')
  const data = value as AuthorInjectionCleanupV1
  if (data.schemaVersion !== 1 || data.encoding !== 'native-author-injection-cleanup-v1'
    || typeof data.sessionId !== 'string' || typeof data.programSha256 !== 'string'
    || !data.resource || typeof data.resource !== 'object'
    || typeof data.resource.browserSessionId !== 'string' || typeof data.resource.generation !== 'string'
    || data.resource.pageId !== undefined && typeof data.resource.pageId !== 'string'
    || data.kind !== 'remove-ids' && data.kind !== 'resource-closed'
    || data.kind === 'remove-ids' && (!Array.isArray(data.ids) || !data.ids.every(id => typeof id === 'string'))) {
    throw Error('AUTHOR_INJECTION_CLEANUP_INVALID')
  }
}

/** Synchronous required append. The Core owner invalidates its captured input. */
export function appendAuthorInjectionCleanup(
  session: Session,
  data: AuthorInjectionCleanupV1,
): SessionEvent<typeof AUTHOR_INJECTION_CLEANUP_EVENT> {
  return session.append(AUTHOR_INJECTION_CLEANUP_EVENT, data)
}

export const authorInjectionCleanupMarkers = Object.freeze({
  eventType: AUTHOR_INJECTION_CLEANUP_EVENT,
  append: appendAuthorInjectionCleanup,
  assert: assertAuthorInjectionCleanup,
})
