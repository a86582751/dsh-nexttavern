// Generated from runtime/alpha3/core/tavern-telemetry-query.ts; edit the TypeScript source.
import { convertUsageCurrency, resolvePricing } from './tavern-pricing.js';
import { timeRange } from './tavern-telemetry-time-range.js';
import { nonNegativeFinite as n, normalizeUsage as usageOf, publicTelemetryError as publicError } from './tavern-telemetry-normalize.js';
/** A paged projection of real calls, not workflow/task completion records. */
export function queryUsageRequests(calls, query = {}, prices = { rates: [], currency: 'USD' }, catalog = [], quote = {}, sessionList = []) {
    const { from, to } = timeRange(query), offset = Math.max(0, Math.min(1e7, Math.floor(Number(query.offset) || 0))), limit = Math.max(1, Math.min(100, Math.floor(Number(query.limit) || 50)));
    const selected = calls.filter(r => (r.ownerSessionId !== null || (r.kind === 'embedding' && !!r.source?.workspaceId)) && r.startedAt >= from && r.startedAt < to && (!query.targetSessionId || r.ownerSessionId === query.targetSessionId) && (!query.provider || r.provider === query.provider) && (!query.model || r.model === query.model) && (!query.kind || (query.kind === 'generation' ? r.kind !== 'embedding' : r.kind === query.kind))).sort((a, b) => b.startedAt - a.startedAt || String(a.id).localeCompare(String(b.id)));
    let display = { currency: prices.currency ?? 'USD', totals: { cost: 0, knownCost: 0 }, models: [], timeline: [], fx: null };
    if (query.currency)
        display = convertUsageCurrency(display, query.currency, quote);
    const rate = display.fx ? display.fx.rate : 1, labels = new Map(sessionList.map(s => [s.id, s.label]));
    const rows = selected.slice(offset, offset + limit).map(r => {
        const pricing = resolvePricing(r, prices, catalog), duration = n(r.durationMs), first = n(r.firstTokenMs), output = n(r.usage?.outputTokens);
        return { id: r.id, sessionId: r.sessionId, ownerSessionId: r.ownerSessionId, sessionLabel: labels.get(r.ownerSessionId) ?? `会话 ${String(r.ownerSessionId ?? r.sessionId).slice(-8)}`, kind: r.kind, provider: r.provider, model: r.model, status: r.status, startedAt: r.startedAt, durationMs: duration, firstTokenMs: first,
            tokensPerSecond: r.status !== 'running' && output !== null && duration !== null && first !== null && duration > first ? output / ((duration - first) / 1000) : null,
            source: r.source, purpose: r.source?.purpose, providerUsage: r.providerUsage, usage: usageOf(r.usage), cost: pricing.cost === null || rate === null ? null : pricing.cost * rate, pricingStatus: rate === null ? 'missing-exchange-rate' : pricing.status, error: publicError(r.error) };
    });
    return { schemaVersion: 1, rows, total: selected.length, offset, limit, currency: display.currency, fx: display.fx };
}
