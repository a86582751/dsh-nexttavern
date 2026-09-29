/** Exact operation ownership for programmatic turns, independent of live Agent memory. */
import {createHash} from 'node:crypto'
import type {ProgrammaticAssistantMessageSource} from '@deepseek-ai/dsh-llm'
import type {ProgrammaticTurnIdentity, SessionEvent} from '@deepseek-ai/dsh-session'

export interface ProgrammaticCommitInput {
  operationId: string
  messageId: string
  text: string
  source: ProgrammaticAssistantMessageSource
}
export type ProgrammaticAssistantRejectionCode = 'PROGRAMMATIC_IDENTITY_CONFLICT'
  | 'PROGRAMMATIC_OPEN_TURN' | 'PROGRAMMATIC_MISSING_SYSTEM_HEAD' | 'PROGRAMMATIC_UNATTRIBUTED_FAILURE'
  | 'PROGRAMMATIC_INCOMPLETE_TURN'
export type ProgrammaticCommitInspection = {kind:'complete';turn:number} | {kind:'absent'}
  | {kind:'unknown';reason:string;code?:ProgrammaticAssistantRejectionCode}

export function programmaticTurnIdentity(input: ProgrammaticCommitInput): ProgrammaticTurnIdentity {
  const valid = (value: unknown): value is string => typeof value === 'string'
    && value.length > 0 && value.length <= 256 && value.trim() === value
    && !/[\u0000-\u001f\u007f-\u009f]/u.test(value)
  if (!input || !valid(input.operationId) || !valid(input.messageId) || !input.source
    || input.source.kind !== 'programmatic' || input.source.schemaVersion !== 1
    || input.source.operationId !== input.operationId || !valid(input.source.producer)
    || !valid(input.source.origin) || typeof input.text !== 'string'
    || Buffer.byteLength(input.text, 'utf8') > 65_536) {
    throw new Error('invalid programmatic assistant commit identity, source, or text')
  }
  return {schemaVersion:1,operationId:input.operationId,messageId:input.messageId,
    producer:input.source.producer,origin:input.source.origin,
    textSha256:createHash('sha256').update(input.text,'utf8').digest('hex')}
}

/** A complete boundary is still not durable: the owning Agent must confirm a flush. */
export function inspectProgrammaticCommit(events: readonly SessionEvent[], input: ProgrammaticCommitInput,
  expected = programmaticTurnIdentity(input)): ProgrammaticCommitInspection {
  const starts = events.filter((event): event is SessionEvent<'turn/start'> => event.type === 'turn/start')
  const matching = starts.filter(event => event.data.programmatic?.operationId === input.operationId)
  if (matching.length > 1) return {kind:'unknown',reason:'multiple turns have this programmatic operation id'}
  const conflict = (reason: string): ProgrammaticCommitInspection =>
    ({kind:'unknown',reason,code:'PROGRAMMATIC_IDENTITY_CONFLICT'})
  const marker = matching[0]
  if (marker && Object.entries(expected).some(([key,value]) =>
    marker.data.programmatic?.[key as keyof ProgrammaticTurnIdentity] !== value)) {
    return conflict('operation id belongs to a different programmatic turn')
  }
  if (starts.some(event => event.data.programmatic?.messageId === input.messageId
    && event.data.programmatic.operationId !== input.operationId)) {
    return conflict('message id already belongs to another programmatic turn')
  }
  const assistants = events.filter((event): event is SessionEvent<'assistant/message'> =>
    event.type === 'assistant/message')
  const answers = assistants.filter(event => event.data.message.source.kind === 'programmatic'
    && event.data.message.source.operationId === input.operationId)
  if (answers.length > 1) return {kind:'unknown',reason:'multiple messages have this operation id'}
  const answer = answers[0]
  if (answer) {
    const message = answer.data.message
    if (message.source.kind !== 'programmatic') return {kind:'unknown',reason:'operation source changed'}
    if (message.id !== input.messageId || message.source.schemaVersion !== 1 || message.source.producer !== expected.producer
      || message.source.origin !== expected.origin || message.content.length !== 1
      || message.content[0]?.type !== 'text' || message.content[0].text !== input.text
      || marker && marker.data.turn !== answer.data.turn) {
      return conflict('operation id belongs to a different message')
    }
    if (starts.some(start => start.data.turn === answer.data.turn && start.data.programmatic
      && start.data.programmatic.operationId !== input.operationId)) {
      return conflict('assistant belongs to a different programmatic turn')
    }
    if (!events.some(event => event.type === 'turn/end' && event.data.turn === answer.data.turn
      && event.data.reason.kind === 'completed')) {
      return {kind:'unknown',reason:'assistant turn has no closing boundary',code:'PROGRAMMATIC_INCOMPLETE_TURN'}
    }
    // Legacy exact successes remain confirmable even though their start had no identity.
    return {kind:'complete',turn:answer.data.turn}
  }
  if (marker) return {kind:'unknown',reason:'programmatic turn started before its message boundary',
    code:'PROGRAMMATIC_INCOMPLETE_TURN'}
  if (assistants.some(event => event.data.message.id === input.messageId)) {
    return conflict('message id already belongs to another operation')
  }
  // An older closed failure with no input, request or answer cannot be assigned
  // to this operation. Absence of an assistant alone must not license replay.
  let legacyTurn: number | null = null
  let otherExecution = false
  for (const event of events) {
    if (event.type === 'turn/start') {
      legacyTurn = event.data.programmatic ? null : event.data.turn
      otherExecution = false
    } else if (legacyTurn !== null) {
      if (event.type === 'user/message' || event.type === 'assistant/message' || event.type === 'request/header'
        || event.type === 'assistant/attempt' || event.type === 'tool/call') otherExecution = true
      if (event.type === 'turn/end' && event.data.turn === legacyTurn) {
        if (!otherExecution && ['error','interrupted','forked'].includes(event.data.reason.kind)) {
          return {kind:'unknown',reason:'an older failed turn has no recoverable operation identity',
            code:'PROGRAMMATIC_UNATTRIBUTED_FAILURE'}
        }
        legacyTurn = null
      }
    }
  }
  return {kind:'absent'}
}
