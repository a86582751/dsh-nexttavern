// Generated from runtime/alpha3/src/core/tavern-telemetry-time-range.ts; edit the TypeScript source.
export function timeRange(query = {}, now = Date.now()) {
    const from = query.from == null ? now - 86400000 : Number(query.from);
    const to = query.to == null ? now : Number(query.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from || to > now + 86400000)
        throw new Error('时间范围无效');
    return { from, to };
}
