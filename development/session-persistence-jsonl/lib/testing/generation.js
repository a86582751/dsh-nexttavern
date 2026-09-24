// Generated from runtime/alpha3/compat/session-persistence-jsonl/src/testing/generation.ts; edit the TypeScript source.
import { createJsonlGenerationRuntime, } from '../generation.js';
/**
 * Create generation operations with deterministic I/O and race seams for tests.
 * @param overrides - deterministic filesystem, platform, and race dependencies.
 * @returns bound generation operations.
 */
export function createJsonlGenerationTestRuntime(overrides = {}) {
    return createJsonlGenerationRuntime(overrides);
}
