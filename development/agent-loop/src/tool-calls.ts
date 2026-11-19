/** Accept committed tool results from the selected Harness executor. */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ToolCallBlock } from 'dsh-nexttavern-native-llm'
import type { UserMessage } from 'dsh-nexttavern-native-session'
import { ToolBatchExecutionError, type ResolvedToolSet } from '@deepseek-ai/dsh-tools'

export async function executeToolCalls(
  ctx: Context,
  agent: Agent,
  turn: number,
  step: number,
  calls: readonly ToolCallBlock[],
  signal: AbortSignal,
  toolSet: ResolvedToolSet,
  acceptContext: (context: UserMessage) => void,
): Promise<{concluded: boolean}> {
  const maxParallelToolCalls = ctx.agentLoop.config.maxParallelToolCalls.get()
  try {
    const result = await ctx.tools.execute({
      agent, log: {turn, step}, calls, signal, toolSet, maxParallelToolCalls,
    })
    for (const context of result.additionalContexts) acceptContext(context)
    return {concluded: result.concluded}
  } catch (error) {
    if (!(error instanceof ToolBatchExecutionError)) throw error
    for (const context of error.partial.additionalContexts) acceptContext(context)
    throw error.cause
  }
}
