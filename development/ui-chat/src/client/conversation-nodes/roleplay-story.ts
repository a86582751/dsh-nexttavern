/** Durable phase evidence identifies prose without mistaking a maintenance reply for it. */
import type {
  ConversationMatch, ConversationNodeDefinition, TurnLocation,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { FinalAssistantChatData } from '../contract/chat-nodes.ts'
import { hasAssistantReplyContent } from '../contract/assistant-content.ts'

export interface RoleplayPhase {
  readonly turn: number
  readonly storySeq: number
  readonly markerSeq: number
}

export function roleplayPhase(event: Parameters<ConversationNodeDefinition['match']>[0]): RoleplayPhase | undefined {
  if (event.type !== 'user/message' || event.surfaceOp !== 'append') return undefined
  const source = event.data.source as unknown as Record<string, unknown>
  if (source.kind !== 'roleplay-tasks' || source.form !== 'phase' || source.schemaVersion !== 1
    || source.stage !== 'after-story' || typeof source.turn !== 'number' || !Number.isSafeInteger(source.turn)
    || source.turn < 1 || typeof source.storySeq !== 'number' || !Number.isSafeInteger(source.storySeq)
    || source.storySeq < 0 || source.storySeq >= event.seq) return undefined
  return {turn: source.turn, storySeq: source.storySeq, markerSeq: event.seq}
}

export function phaseFromMatches(matches: readonly ConversationMatch[]): RoleplayPhase | undefined {
  for (const match of matches) {
    const phase = roleplayPhase(match.event)
    if (phase !== undefined) return phase
  }
  return undefined
}

export function roleplayStory(turn: TurnLocation, proof: RoleplayPhase | undefined): Readonly<FinalAssistantChatData> | null {
  if (proof === undefined || proof.turn !== turn.turn
    || (turn.start !== undefined && proof.storySeq <= turn.start.seq)
    || (turn.end !== undefined && proof.markerSeq >= turn.end.seq)) return null
  for (const step of turn.steps) {
    const data = step.data.get('assistant-step')
    if (data?.finalNode === undefined || data.finalNode.seq !== proof.storySeq) continue
    if (data.finalNode.interrupted || !hasAssistantReplyContent(data.blocks)
      || data.blocks.some(block => block.kind === 'tool-call')) return null
    return data as Readonly<FinalAssistantChatData>
  }
  // The original may be outside the loaded window. Never substitute a later
  // maintenance answer; paging the original will make this proof resolvable.
  return null
}
