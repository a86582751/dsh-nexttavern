import type { SessionId } from '@deepseek-ai/dsh-session'

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
