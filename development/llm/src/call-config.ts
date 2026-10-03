/**
 * Conversation call configuration and freeze utilities. Provider routing,
 * model, reasoning effort, and sampling values are request-header state that
 * can affect cache reuse; request waterfalls replace them and the loop logs
 * changed snapshots instead of allowing silent per-call drift.
 * @module dsh-llm/call-config
 */

import type { GenerateOptions } from './types.js'
import type { ReasoningEffortId } from './brand.js'

/** Process-local identities of request objects assembled by dsh-agent-loop. */
const AGENT_LOOP_REQUESTS = new WeakSet<GenerateOptions>()
/** A material owner's synchronous assertion, associated with exact request
 * identity. It never appears in configuration, messages, headers or JSON. */
const AGENT_LOOP_REQUEST_GUARDS=new WeakMap<GenerateOptions,()=>void>()

// TODO(call-config-shape): Revisit which fields are epoch-level for cache reuse
// and where provider-specific request options belong.
/**
 * Provider, model, reasoning effort, and sampling scalars of one conversation's
 * requests. Every field maps 1:1 onto the same-named `GenerateOptions` field;
 * the loop builds requests from the logged header rather than accepting these
 * per call.
 */
export interface LlmCallConfig {
  provider: string
  model: string
  reasoningEffort?: ReasoningEffortId
  temperature?: number
  maxTokens?: number
  stop?: string[]
}

/**
 * Effective config fields supplied by exact-model adapter resolution rather
 * than by the caller's request proposal.
 */
export interface LlmCallConfigAdapterDefaults {
  reasoningEffort?: true
  maxTokens?: true
}

/**
 * Field-wise equality over {@link LlmCallConfig} — the comparison a caller
 * runs to decide whether a proposed configuration is a real change (worth a
 * logged header snapshot) or the held one restated.
 * @param a - one configuration.
 * @param b - the other.
 * @returns whether every field (including the `stop` list, element-wise) matches.
 */
export function callConfigEquals(a: LlmCallConfig, b: LlmCallConfig): boolean {
  if (
    a.provider !== b.provider
    || a.model !== b.model
    || a.reasoningEffort !== b.reasoningEffort
    || a.temperature !== b.temperature
    || a.maxTokens !== b.maxTokens
  ) return false
  if (a.stop === undefined || b.stop === undefined) return a.stop === b.stop
  return a.stop.length === b.stop.length && a.stop.every((s, i) => s === b.stop?.[i])
}

/**
 * Mark one exact request object as assembled by dsh-agent-loop.
 * @param request - loop-owned request envelope before LLM dispatch.
 * @returns the same request object marked as created by the process-local agent loop.
 */
export function markAgentLoopRequest<T extends GenerateOptions>(request: T): T {
  AGENT_LOOP_REQUESTS.add(request)
  return request
}

/**
 * Test whether the exact request object was assembled by dsh-agent-loop.
 * @param request - request envelope observed at the LLM waterfall.
 * @returns whether {@link markAgentLoopRequest} recorded this object.
 */
export function isAgentLoopRequest(request: GenerateOptions): boolean {
  return AGENT_LOOP_REQUESTS.has(request)
}

/** Bind once after Native has frozen and branded the original request. A
 * serializable material record alone cannot create this hot association. */
export function bindAgentLoopRequestGuard(request:GenerateOptions,guard:()=>void):void {
  if(!AGENT_LOOP_REQUESTS.has(request)||!Object.isFrozen(request)||!Object.isFrozen(request.messages)
    ||typeof guard!=='function'||AGENT_LOOP_REQUEST_GUARDS.has(request)){
    throw Error('invalid Native request guard binding')
  }
  AGENT_LOOP_REQUEST_GUARDS.set(request,guard)
}

/** Adapter implementations claiming exact request material support must call
 * this again after awaited preflight and immediately before transport. */
export function assertAgentLoopRequestCurrent(request:GenerateOptions):void {
  const guard=AGENT_LOOP_REQUEST_GUARDS.get(request)
  if(guard){guard();return}
  if(request.messages.some(message=>message.source?.kind==='request-material')){
    throw Error('request material lacks a live Native request owner')
  }
}

/** Internal LLM projection carries liveness to its detached adapter envelope,
 * without marking that projected array as the durable Native request. */
export function forwardAgentLoopRequestGuard(source:GenerateOptions,target:GenerateOptions):void {
  const guard=AGENT_LOOP_REQUEST_GUARDS.get(source)
  if(guard)AGENT_LOOP_REQUEST_GUARDS.set(target,guard)
}
