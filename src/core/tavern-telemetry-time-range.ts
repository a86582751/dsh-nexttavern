export interface TimeRangeQuery { from?: unknown; to?: unknown }
export interface TimeRange { from: number; to: number }

export function timeRange(query: TimeRangeQuery = {}, now = Date.now()): TimeRange {
  const from = query.from == null ? now - 86400000 : Number(query.from)
  const to = query.to == null ? now : Number(query.to)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from || to > now + 86400000) throw new Error('时间范围无效')
  return { from, to }
}
