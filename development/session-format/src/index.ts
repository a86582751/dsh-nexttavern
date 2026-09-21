import type {Context} from '@deepseek-ai/cordis'
import type {Session, SessionEvent, SessionSeq} from '@deepseek-ai/dsh-session'
import {MESSAGE_EDIT_EVENT, messageEditProjection, type MessageEdit} from './projection.js'

export const name = 'nexttavern-message-edits'
export const inject = ['sessions']

/** Register once at profile scope, before sessions are created or restored. */
export function apply(ctx: Context): void {
  ctx.sessions.registerMessageProjection(messageEditProjection)
}

/** Append a required edit synchronously; callers own branch locks and derived-state invalidation. */
export function appendMessageEdit(
  session: Session,
  targetSeq: SessionSeq,
  identity: Pick<MessageEdit, 'messageId' | 'role'>,
  text: string,
): SessionEvent<'roleplay/message-edit'> {
  return session.append(MESSAGE_EDIT_EVENT, {schemaVersion: 1, targetSeq, ...identity, text})
}
