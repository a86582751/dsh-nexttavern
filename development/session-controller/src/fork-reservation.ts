import type { SessionId } from 'dsh-nexttavern-native-session'

/** Identity and exact prefix reserved before any child Agent can be published. */
export interface ForkReservation {
  readonly sourceSessionId: SessionId
  readonly childSessionId: SessionId
  readonly seedLength: number
}

/**
 * Persist caller-owned lineage before creation. Rejection must prevent creation;
 * creation or workspace attachment may still fail after this callback succeeds.
 * The caller reconciles that reservation with the actual child, retaining a
 * published child when only the later workspace attachment failed.
 */
export type BeforeForkPublish = (reservation: ForkReservation) => void | Promise<void>

/** Host-owned empty-prefix fork reservation retained across creation retries. */
export interface ForkBeforeFirstReservation extends ForkReservation {
  readonly seedLength: 0
  readonly workspaceId: string | null
}

/** Resume uses the original child and workspace, including an original absence. */
export interface ForkBeforeFirstRequest {
  readonly sessionId: SessionId
  readonly resume?: ForkBeforeFirstReservation
}

export type BeforeFirstForkPublish = (reservation: ForkBeforeFirstReservation) => void | Promise<void>
