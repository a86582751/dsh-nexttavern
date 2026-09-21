// Generated from runtime/alpha3/src/core/tavern-telemetry-aggregate.ts; edit the TypeScript source.
import { resolvePricing } from './tavern-pricing.js';
import { timeRange } from './tavern-telemetry-time-range.js';
import { nonNegativeFinite as n } from './tavern-telemetry-normalize.js';
const fields = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'];
const empty = () => ({ calls: 0, successes: 0, failures: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, unknownUsage: 0, unknownFields: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, knownCost: 0, pricedCalls: 0, unpricedCalls: 0, cost: null, costComplete: true, durationMs: 0, timedCalls: 0, cacheRateCalls: 0, cacheRateIncompleteCalls: 0, cacheRateInputTokens: 0, cacheRateHitTokens: 0, cacheHitRate: null, speedCalls: 0, speedOutputTokens: 0, generationMs: 0, tokensPerSecond: null });
const add = (total, call, cost) => {
    total.calls++;
    if (call.status === 'completed')
        total.successes++;
    if (['failed', 'cancelled', 'truncated'].includes(call.status))
        total.failures++;
    if (!call.usage)
        total.unknownUsage++;
    const usageFields = call.kind === 'embedding' ? ['inputTokens'] : fields;
    for (const field of usageFields) {
        const value = n(call.usage?.[field]);
        if (value === null)
            total.unknownFields[field]++;
        else
            total[field] += value;
    }
    if (cost === null)
        total.unpricedCalls++;
    else
        total.knownCost += cost;
    total.pricedCalls = total.calls - total.unpricedCalls;
    total.costComplete = total.unpricedCalls === 0;
    total.cost = total.unpricedCalls ? null : total.knownCost;
    const timing = n(call.durationMs);
    if (timing !== null) {
        total.durationMs += timing;
        total.timedCalls++;
    }
    const usage = call.usage, read = n(usage?.cacheReadTokens), fresh = n(usage?.inputTokens), write = n(usage?.cacheWriteTokens), output = n(usage?.outputTokens), exact = n(usage?.totalTokens);
    if (call.kind !== 'embedding') {
        const prompt = exact !== null && output !== null && exact >= output ? exact - output : fresh !== null && read !== null && write !== null ? fresh + read + write : null;
        if (read !== null && prompt !== null && read <= prompt) {
            total.cacheRateCalls++;
            total.cacheRateHitTokens += read;
            total.cacheRateInputTokens += prompt;
        }
        else
            total.cacheRateIncompleteCalls++;
    }
    total.cacheHitRate = total.cacheRateInputTokens > 0 ? total.cacheRateHitTokens / total.cacheRateInputTokens : null;
    const duration = n(call.durationMs), first = n(call.firstTokenMs);
    if (call.kind !== 'embedding' && call.status !== 'running' && output !== null && duration !== null && first !== null && duration > first) {
        total.speedCalls++;
        total.speedOutputTokens += output;
        total.generationMs += duration - first;
    }
    total.tokensPerSecond = total.generationMs > 0 ? total.speedOutputTokens / (total.generationMs / 1000) : null;
};
export function aggregateUsage(calls, query, prices = { rates: [], currency: 'USD' }, catalog = []) {
    const range = timeRange(query), to = range.to, from = range.from === 0 ? calls.reduce((first, call) => Number.isFinite(call.startedAt) && call.startedAt >= 0 ? Math.min(first, call.startedAt) : first, to - 1) : range.from, totals = empty(), models = new Map(), providers = new Map(), timeline = new Map();
    const bucketMs = Math.max(60000, Math.ceil((to - from) / 72 / 60000) * 60000);
    for (const call of calls) {
        if (call.startedAt < from || call.startedAt >= to || query.targetSessionId && call.ownerSessionId !== query.targetSessionId || query.provider && call.provider !== query.provider || query.model && call.model !== query.model || query.kind && (query.kind === 'generation' ? call.kind === 'embedding' : call.kind !== query.kind))
            continue;
        const cost = resolvePricing(call, prices, catalog).cost;
        add(totals, call, cost);
        const key = JSON.stringify([call.provider, call.model]);
        if (!models.has(key))
            models.set(key, { provider: call.provider, model: call.model, ...empty() });
        add(models.get(key), call, cost);
        if (!providers.has(call.provider))
            providers.set(call.provider, { provider: call.provider, ...empty() });
        add(providers.get(call.provider), call, cost);
        const at = from + Math.floor((call.startedAt - from) / bucketMs) * bucketMs;
        if (!timeline.has(at))
            timeline.set(at, { at, ...empty() });
        add(timeline.get(at), call, cost);
    }
    return { schemaVersion: 1, from, to, currency: prices.currency ?? 'USD', unit: 'per-million-tokens', totals, models: [...models.values()].sort((a, b) => b.calls - a.calls), providers: [...providers.values()].sort((a, b) => b.calls - a.calls), timeline: [...timeline.values()].sort((a, b) => a.at - b.at) };
}
