// Generated from runtime/alpha3/compat/ui-chat/src/client/contract/chat-nodes.ts; edit the TypeScript source.
/**
 * Test whether a Tool root has settled.
 * @param block - Tool root lifecycle value.
 * @returns whether the root carries its final result.
 */
export function isSettledTool(block) {
    return 'kind' in block;
}
/**
 * Test whether a Tool root is still running.
 * @param block - Tool root lifecycle value.
 * @returns whether the root lacks a final result.
 */
export function isRunningTool(block) {
    return !isSettledTool(block);
}
