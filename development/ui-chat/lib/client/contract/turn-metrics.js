// Generated from runtime/alpha3/compat/ui-chat/src/client/contract/turn-metrics.ts; edit the TypeScript source.
// Assistant timing readings used by session statistics.
function usageOutputTokens(usage) {
    if (typeof usage !== 'object' || usage === null)
        return null;
    const value = usage.outputTokens;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
/**
 * Read one assistant node's TTFT, decode wall time, and output tokens.
 * @param node - A settled assistant node.
 * @returns Per-part readings with `null` for unrecorded values.
 */
export function assistantStepReading(node) {
    const timing = node.timing;
    const ttftMs = timing !== undefined && timing.stepStartTime !== null && timing.firstTokenTime !== null
        ? Math.max(0, timing.firstTokenTime - timing.stepStartTime)
        : null;
    const decodeMs = timing !== undefined && timing.firstTokenTime !== null
        ? Math.max(0, timing.completedTime - timing.firstTokenTime)
        : null;
    return { ttftMs, decodeMs, outputTokens: usageOutputTokens(node.usage) };
}
