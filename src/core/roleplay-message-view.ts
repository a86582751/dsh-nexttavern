/** Read current prose through the host projection without rewriting audit events. */
import type { SurfaceOp } from '@deepseek-ai/dsh-session'

type NativeReplacement = Exclude<SurfaceOp, 'append'>
/** Keep host field names while accepting numeric seqs from serialized observations. */
export type StorySurfaceReplacement = {
  [Key in keyof NativeReplacement]: NativeReplacement[Key] extends number ? number : NativeReplacement[Key]
}
export type StorySurfaceOp = 'append' | StorySurfaceReplacement

interface MessageEvent {
  seq: number
  type: string
  data?: { content?: unknown; message?: unknown }
}

export interface StoryViewHeader {
  id: string
  cwd?: string
  agentPreset?: string
  origin?: string
  parentSession?: string
  createdAt?: number
}

export interface StoryObservationServices<E extends MessageEvent> {
  sessionQuery: {
    observeSession(id: string, options: {projectionMode: 'none'; signal?: AbortSignal}): Promise<Disposable & {
      header: StoryViewHeader; events: readonly E[]; inheritedEventCount: number
      source: 'live' | 'prepared'; cursor: number
    }>
  }
  sessions: {
    prepare(id: string, options: {
      seed: readonly E[]; meta: StoryViewHeader; inheritedEventCount: number; eventState: 'shared-frozen'
    }): {
      surface: {nodes: readonly number[]; contentGeneration: number}
      deriveEventMessage(event: E): unknown
    }
  }
}

/**
 * Restore a cold read through the host's registered interpreters. The temporary
 * Session is never attached or published, and the observation lease is always
 * released. The returned immutable cut owns its events and derived messages.
 */
export async function readProjectedStory<E extends MessageEvent>(ctx: StoryObservationServices<E>, id: string) {
  using observation = await ctx.sessionQuery.observeSession(id, {projectionMode: 'none'})
  const prepared = ctx.sessions.prepare(id, {
    seed: observation.events, meta: observation.header,
    inheritedEventCount: observation.inheritedEventCount, eventState: 'shared-frozen',
  })
  return {
    id, header: observation.header, events: observation.events, surface: prepared.surface,
    inheritedEventCount: observation.inheritedEventCount,
    deriveEventMessage: prepared.deriveEventMessage.bind(prepared),
  }
}

export interface MessageViewSession<E extends MessageEvent> {
  deriveEventMessage?(event: E): unknown
  surface?: { contentGeneration?: number }
}

/**
 * Story readers keep the original seq, turn, source and usage. Only content is
 * projected, using the same registered interpreters as the next model request.
 * Missing interpreters must propagate their error; falling back would expose
 * stale prose after disabling a provider that owns required history records.
 */
export function projectStoryEvent<E extends MessageEvent>(session: MessageViewSession<E>, event: E): E {
  if (!session.deriveEventMessage || (event.type !== 'user/message' && event.type !== 'assistant/message')) return event
  const message = session.deriveEventMessage(event)
  if (!message || typeof message !== 'object' || !('content' in message) || !Array.isArray(message.content)) return event
  if (event.type === 'user/message') {
    if (event.data?.content === message.content) return event
    return Object.freeze({...event, data: Object.freeze({...event.data, content: message.content})})
  }
  const original = event.data?.message
  if (!original || typeof original !== 'object') return event
  if ('content' in original && original.content === message.content) return event
  return Object.freeze({...event, data: Object.freeze({...event.data,
    message: Object.freeze({...original, content: message.content}),
  })})
}

/** A legacy immutable fixture has no projector; native projected reads need its generation. */
export function messageViewGeneration<E extends MessageEvent>(session: MessageViewSession<E>): number | null {
  if (!session.deriveEventMessage) return 0
  const generation = session.surface?.contentGeneration
  return Number.isSafeInteger(generation) && Number(generation) >= 0 ? Number(generation) : null
}
