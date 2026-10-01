interface LibraryResource { id?: unknown; name?: unknown; modifiedAt?: string | null; updatedAt?: string | null; createdAt?: string | null }
interface Route { provider?: unknown; model?: unknown; reasoningEffort?: unknown }
interface ReasoningOption { id: string; name?: unknown; description?: unknown; unknown?: boolean }
interface ReasoningModel { reasoning?: { efforts?: ReasoningOption[] | null; defaultEffort?: unknown } | null }
interface Fallback { from?: Route | null; to?: Route | null; reason?: string; failure?: {category?: unknown; label?: unknown; code?: unknown; status?: unknown} | null }
interface CardResource { type?: unknown; sources?: Array<{kind?: unknown} | null> | null; source?: {kind?: unknown} | null }
interface PricingRate extends Record<string, unknown> { mode?: unknown; multiplier?: unknown; catalogKey?: unknown }
interface PricingSettings extends Record<string, unknown> { defaultMode?: unknown; defaultMultiplier?: unknown; autoSync?: unknown; rates?: PricingRate[] | null }
interface UsageScope { calls?: unknown; pricedCalls?: unknown; knownCost?: unknown; costComplete?: unknown }

export function sortLibraryResources<R extends LibraryResource>(resources: readonly R[], order = 'time-desc'): R[] {
  const time = (r: R) => Date.parse(r.modifiedAt ?? r.updatedAt ?? r.createdAt ?? '') || 0
  const name = (a: R,b: R) => String(a.name??'').localeCompare(String(b.name??''),'zh-Hans-CN',{numeric:true}) || String(a.id).localeCompare(String(b.id))
  return [...resources].sort((a,b) => order==='name-asc'?name(a,b):order==='name-desc'?-name(a,b):
    (order==='time-asc'?time(a)-time(b):time(b)-time(a)) || name(a,b))
}

export const MODEL_PURPOSE_IDS = Object.freeze(['memory', 'card-import', 'card-export', 'status', 'decision', 'novel-export'])

export function buildModelSettings(allMain: unknown, routes?: Record<string, Route | null> | null) {
  const normalized: Record<string, Route | null> = {}
  for (const id of MODEL_PURPOSE_IDS) {
    const route = routes?.[id]
    normalized[id] = route && typeof route.provider === 'string' && typeof route.model === 'string'
      ? { provider: route.provider, model: route.model, ...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}) }
      : null
  }
  return { allMain: allMain === true, routes: normalized }
}

export function buildReasoningEffortOptions(model?: ReasoningModel | null, current?: string | null) {
  const efforts = Array.isArray(model?.reasoning?.efforts) ? model.reasoning.efforts : []
  const options: ReasoningOption[] = [{ id: '', name: model?.reasoning?.defaultEffort ? `模型默认（${model.reasoning.defaultEffort}）` : '模型默认' }]
  for (const effort of efforts) if (effort && typeof effort.id === 'string') options.push({ id: effort.id, name: effort.name ?? effort.id, description: effort.description })
  if (current && !options.some(option => option.id === current)) options.push({ id: current, name: `${current}（未知，保留）`, unknown: true })
  return options
}

export function formatFallbackText(fallback?: Fallback | null) {
  if (!fallback?.from || !fallback?.to) return ''
  const label = (route: Route) => `${route.provider ?? '未知供应商'} ${route.model ?? '未知模型'}${route.reasoningEffort ? `（${route.reasoningEffort}）` : ''}`
  const reasons: Record<string, string> = { timeout: '超时', failed: '失败（原因未提供）', 'runtime-restart': '运行时重启', unknown: '回退（原因未提供）' }
  const reason = fallback.failure?.category && fallback.failure.category !== 'unknown' ? fallback.failure.label : reasons[fallback.reason!] ?? '回退（原因未提供）'
  const details=[fallback.failure?.code,fallback.failure?.status?`HTTP ${fallback.failure.status}`:null].filter(Boolean).join(' · ')
  return `${label(fallback.from)} ${reason}${details?` [${details}]`:''} → ${label(fallback.to)} 接手`
}

export function isCardReadableResource(resource?: CardResource | null) {
  const sources=Array.isArray(resource?.sources)?resource.sources:[resource?.source]
  if(sources.some(source=>source?.kind==='novel-export'))return false
  return ['image/png','application/json','text/markdown','text/plain'].includes(String(resource?.type??'').split(';')[0]!)
}

export function normalizePricingSettings(raw?: PricingSettings | null) {
  return { ...(raw ?? {}), defaultMode: raw?.defaultMode === 'manual' ? 'manual' : 'auto', defaultMultiplier: raw?.defaultMultiplier ?? 1, autoSync: raw?.autoSync === true,
    rates: Array.isArray(raw?.rates) ? raw.rates.map(rate => ({ ...rate, mode: rate.mode === 'auto' ? 'auto' : 'manual', multiplier: rate.multiplier ?? null, catalogKey: rate.catalogKey ?? null })) : [] }
}

export function usageCostPresentation(scope: UsageScope | null | undefined, currency: unknown, fx?: {rate?: unknown} | null) {
  const calls = Number(scope?.calls ?? 0)
  const pricedCalls = Number(scope?.pricedCalls ?? 0)
  const hasQuote = fx == null || Number.isFinite(fx.rate)
  const knownCost = typeof scope?.knownCost === 'number' && Number.isFinite(scope.knownCost) ? scope.knownCost : null
  const value = hasQuote && pricedCalls > 0 && knownCost !== null ? knownCost : (hasQuote && calls === 0 ? 0 : null)
  const missing = Math.max(0, calls - pricedCalls)
  const caption = !hasQuote ? '缺少汇率' : calls === 0 ? '零请求' : scope?.costComplete ? '全部请求均有单价和用量' : (pricedCalls > 0 ? `已知部分 · ${missing} 次请求缺少单价或用量` : `${missing} 次请求缺少单价或用量`)
  return { value, caption }
}
