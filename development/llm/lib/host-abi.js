// Generated from runtime/alpha3/compat/llm/src/host-abi.ts; edit the TypeScript source.
/** Stable identities shared with official Host consumers. Native runtime and
 * request liveness remain owned by this private package. */
import { createRequire } from 'node:module';
// Node 24 loads the pinned official ESM graph synchronously with shared identity.
// Runtime resolution keeps its Context.llm types out of the Native compilation
// and emits identically with or without relative import extension rewriting.
const host = createRequire(import.meta.url)('@deepseek-ai/dsh-llm');
export const HarnessError = host.HarnessError;
export const LlmError = host.LlmError;
export const markAgentLoopRequest = host.markAgentLoopRequest;
export const isAgentLoopRequest = host.isAgentLoopRequest;
