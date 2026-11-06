/** Stable identities shared with official Host consumers. Native runtime and
 * request liveness remain owned by this private package. */
import { createRequire } from 'node:module'
import type { GenerateOptions, LlmFailure } from './types.js'
import type { ProviderRequestId } from './brand.js'

export interface HarnessError extends Error {
  readonly code: string
}

/** Provider facts accepted by the official LLM error constructor. */
export interface LlmErrorOptions extends ErrorOptions {
  status?: number
  providerRetryAfterMs?: number
  requestId?: ProviderRequestId
  offloadImages?: number
}

export interface LlmError extends HarnessError {
  readonly failure: LlmFailure
}

interface HostLlmAbi {
  HarnessError: new (message: string, code: string, options?: ErrorOptions) => HarnessError
  LlmError: new (message: string, code: string, options?: LlmErrorOptions) => LlmError
  markAgentLoopRequest<T extends GenerateOptions>(request: T): T
  isAgentLoopRequest(request: GenerateOptions): boolean
}

// Node 24 loads the pinned official ESM graph synchronously with shared identity.
// Runtime resolution keeps its Context.llm types out of the Native compilation
// and emits identically with or without relative import extension rewriting.
const host: HostLlmAbi = createRequire(import.meta.url)('@deepseek-ai/dsh-llm')

export const HarnessError = host.HarnessError
export const LlmError = host.LlmError
export const markAgentLoopRequest = host.markAgentLoopRequest
export const isAgentLoopRequest = host.isAgentLoopRequest
