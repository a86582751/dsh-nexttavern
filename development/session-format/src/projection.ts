/** Browser-safe edit protocol. A model settlement and its usage are never rewritten. */
import type {Message} from '@deepseek-ai/dsh-llm/types'
import type {SessionEvent, SessionSeq} from '@deepseek-ai/dsh-session/types'
import {deriveEventMessage, type SessionMessageProjection} from '@deepseek-ai/dsh-session/surface'
import {deepFreeze} from '@deepseek-ai/dsh-util-values'

export const MESSAGE_EDIT_EVENT = 'roleplay/message-edit'

export interface MessageEdit {
  schemaVersion: 1
  targetSeq: SessionSeq
  messageId: string
  role: 'assistant' | 'user'
  text: string
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Required durable edit: preserve the original node, identity and non-text blocks. @messageProjection */
    'roleplay/message-edit': MessageEdit
  }
}

/** Reject future versions and malformed records before storage or replay can accept them. */
export function assertMessageEdit(value: unknown): asserts value is MessageEdit {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw Error('Invalid message edit payload')
  const data = value as Record<string, unknown>
  if (Object.keys(data).sort().join(',') !== 'messageId,role,schemaVersion,targetSeq,text'
    || data.schemaVersion !== 1 || !Number.isSafeInteger(data.targetSeq) || Number(data.targetSeq) < 0
    || Object.is(data.targetSeq, -0) || typeof data.messageId !== 'string' || data.messageId.length === 0
    || (data.role !== 'assistant' && data.role !== 'user') || typeof data.text !== 'string'
    || data.text.length > 1_000_000) throw Error('Unsupported or malformed message edit v1')
}

/** Replace prose only; tool calls, reasoning, attachments and source attribution remain intact. */
export function editMessageText(message: Message, edit: MessageEdit): Message {
  if (message.role !== edit.role || message.id !== edit.messageId) throw Error('Message edit identity mismatch')
  if (message.role !== 'assistant' && message.role !== 'user') throw Error('Message is not editable')
  const content: typeof message.content = []
  let inserted = false
  for (const block of message.content) {
    if (block.type !== 'text') content.push(block)
    else if (!inserted) {
      content.push({type: 'text', text: edit.text})
      inserted = true
    }
  }
  if (!inserted) content.unshift({type: 'text', text: edit.text})
  return deepFreeze({...message, content})
}

export const messageEditProjection: SessionMessageProjection<'roleplay/message-edit'> = {
  type: MESSAGE_EDIT_EVENT,
  project(event, context) {
    if (event.ignorable) throw Error('Message edits cannot be marked ignorable')
    assertMessageEdit(event.data)
    const edit = event.data
    if (edit.targetSeq >= event.seq || !context.nodes.includes(edit.targetSeq)) {
      throw Error('Message edit must target an earlier current surface node')
    }
    const original = context.events[edit.targetSeq - context.baseSeq]
    if (original?.seq !== edit.targetSeq
      || (original.type !== 'assistant/message' && original.type !== 'user/message')) {
      throw Error('Message edit target is not a user or assistant message')
    }
    const current = context.messages.get(edit.targetSeq) ?? deriveEventMessage(original)
    if (current === null) throw Error('Message edit target has no derived message')
    // Session keeps the original seq as the presentation and model-history anchor.
    return new Map([[edit.targetSeq, editMessageText(current, edit)]])
  },
}

export function isMessageEdit(event: SessionEvent): event is SessionEvent<'roleplay/message-edit'> {
  return event.type === MESSAGE_EDIT_EVENT
}
