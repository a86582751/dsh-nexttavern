/**
 * Heuristic composition of the current retained surface, independent of route
 * image pricing and provider usage. Positional entries preserve system-prompt
 * classification across replacements without retaining historical messages.
 */

import { z } from 'zod'
import { canonicalHeader } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { estimateToolsTokens } from './estimate.js'
import { commitSurfaceTokens, planRetainedSurface, retainedPriceSchema } from './surface-fold.js'
// Import for the `contextBreakdown` SessionProjectionStateMap key merge.
import type {} from './projection.js'

// Reuse the pinned official public service and projection vocabulary.
import type {} from '@deepseek-ai/dsh-token-meter'

const tokenCount = z.number().int().nonnegative()

const breakdownSchema = z.object({
  systemTokens: tokenCount,
  toolsTokens: tokenCount,
  messageTokens: tokenCount,
}).strict()

/** Plain-JSON checkpoint: one compact entry per retained surface position. */
const contextBreakdownStateSchema = z.object({
  nodes: z.array(retainedPriceSchema),
  breakdown: breakdownSchema,
}).strict()
type ContextBreakdownState = z.infer<typeof contextBreakdownStateSchema>

/**
 * Context composition with the last nonempty surviving system in surface
 * order classified as system tokens; all other visible prices are messages.
 * Replacements use the measurement planner, not shadow-price claims. State
 * and surface transitions cost O(current retained surface), not O(log length).
 * Tools are priced from the latest request header. No route pricing applies.
 */
export const contextBreakdownProjectionDefinition = {
  key: 'contextBreakdown',
  stateVersion: 6,
  stateSchema: contextBreakdownStateSchema,
  init: (): ContextBreakdownState => ({
    nodes: [],
    breakdown: { systemTokens: 0, toolsTokens: 0, messageTokens: 0 },
  }),
  apply: (state, event) => {
    if (event.type === 'request/header') {
      const toolsTokens = estimateToolsTokens(canonicalHeader(event.data.header))
      return toolsTokens === state.breakdown.toolsTokens
        ? state
        : { ...state, breakdown: { ...state.breakdown, toolsTokens } }
    }
    const plan = planRetainedSurface(state.nodes, event)
    if (plan === undefined) return state
    const nodes = [...state.nodes]
    commitSurfaceTokens(nodes, plan)
    const systemTokens = nodes.findLast(node => node.system && node.heuristicTokens > 0)?.heuristicTokens ?? 0
    const messageTokens = state.breakdown.systemTokens + state.breakdown.messageTokens + plan.deltaTokens - systemTokens
    const breakdown = systemTokens === state.breakdown.systemTokens && messageTokens === state.breakdown.messageTokens
      ? state.breakdown
      : { systemTokens, toolsTokens: state.breakdown.toolsTokens, messageTokens }
    return { nodes, breakdown }
  },
  wire: {
    viewSchema: breakdownSchema,
    view: state => state.breakdown,
  },
} satisfies ProjectionDefinition<'contextBreakdown', ContextBreakdownState>
