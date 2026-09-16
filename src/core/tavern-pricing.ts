// Independent models.dev consumer; product behavior references CC Switch (MIT).
// Sources, revisions and license attribution: docs/tavern-pricing.md.
import { createHash } from 'node:crypto'

const KEY = 'tavern_price_catalog', URL = 'https://models.dev/api.json', TTL = 6 * 60 * 60 * 1000, MAX_BYTES = 16 * 1024 * 1024
const rateFields = ['input', 'output', 'cacheRead', 'cacheWrite'] as const
type RateField = typeof rateFields[number]
type RecordLike = Record<string, unknown>
type RateValues = Record<RateField, number | null>
type CatalogTier = RateValues & { threshold: number }
type CatalogEntry = { key: string; provider: string; model: string; name: string; providerName: string; releaseDate: string | null; rates: RateValues; tiers: CatalogTier[]; unsupportedTiers: boolean }
type CatalogState = { schemaVersion: number; source: string; currency?: string; unit?: string; fetchedAt: number | null; attemptedAt?: number; sha256?: string; entries: CatalogEntry[]; error?: string | null; syncing?: boolean }
type ExchangeState = { schemaVersion: number; source?: string; sourceUrl?: string; base?: string; rates: Record<string, number>; rateAt: number | null; nextUpdateAt?: number; fetchedAt: number | null; attemptedAt?: number; sha256?: string; error?: string | null; syncing?: boolean }
type Table = { get(key: string): unknown; put(key: string, value: unknown): unknown | Promise<unknown> }
type Fetcher = typeof fetch
type Usage = { inputTokens?: unknown; outputTokens?: unknown; cacheReadTokens?: unknown; cacheWriteTokens?: unknown; totalTokens?: unknown }
export type PricingCall = { provider: string | null; model: string | null; kind?: string; usage?: Usage | null }
type RateSetting = Partial<RateValues> & { provider?: string; model?: string; mode?: string; catalogKey?: string | null; multiplier?: unknown }
export type PricingSettings = { rates?: RateSetting[]; defaultMode?: string; defaultMultiplier?: unknown; currency?: string }
type UsageRow = { cost: number | null; knownCost: number | null; [key: string]: unknown }
type UsageStats = { currency?: string; totals: UsageRow; models: UsageRow[]; providers?: UsageRow[]; timeline: UsageRow[]; [key: string]: unknown }
export type ExchangeQuote = Omit<Partial<ExchangeState>, 'rates' | 'syncing'> & { rates?: Record<string, unknown>; syncing?: unknown }
export type { CatalogEntry }

const asRecord = (value: unknown): RecordLike | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordLike : null
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
const text = (value: unknown): string | null => typeof value === 'string' ? value.replace(/[\x00-\x1f]/g, '').slice(0, 400) : null
const rates = (value: unknown): RateValues => { const record = asRecord(value); return { input: number(record?.input), output: number(record?.output), cacheRead: number(record?.cache_read), cacheWrite: number(record?.cache_write) } }

export function normalizeCatalog(data: unknown): CatalogEntry[] {
  if (!asRecord(data)) throw new Error('目录格式无效')
  const result: CatalogEntry[] = []
  for (const [provider, rawProvider] of Object.entries(data as RecordLike)) {
    const providerRecord = asRecord(rawProvider), models = asRecord(providerRecord?.models)
    for (const [model, rawModel] of Object.entries(models ?? {})) {
      const modelRecord = asRecord(rawModel), modalities = asRecord(modelRecord?.modalities), output = modalities?.output
      if (!modelRecord) continue
      if (!provider || !model || provider.length > 200 || model.length > 400 || /[\x00-\x1f]/.test(provider + model)) continue
      if (modelRecord?.status === 'deprecated' || !Array.isArray(output) || !output.includes('text') || output.some(value => ['audio', 'image', 'video'].includes(value as string)) || !asRecord(modelRecord.cost)) continue
      const base = rates(modelRecord.cost); if (base.input === null && base.output === null) continue
      const rawTiers = asRecord(modelRecord.cost)?.tiers
      const tiers: CatalogTier[] = Array.isArray(rawTiers) ? rawTiers.filter(rawTier => { const tier = asRecord(rawTier)?.tier; return asRecord(tier)?.type === 'context' && number(asRecord(tier)?.size) !== null }).map(rawTier => { const tier = asRecord(asRecord(rawTier)?.tier)!; return { threshold: number(tier.size)!, ...rates(rawTier) } }).sort((a, b) => a.threshold - b.threshold) : []
      result.push({ key: `${provider}/${model}`, provider, model, name: text(modelRecord.name) ?? model, providerName: text(providerRecord?.name) ?? provider, releaseDate: text(modelRecord.release_date), rates: base, tiers, unsupportedTiers: Array.isArray(rawTiers) && rawTiers.some(rawTier => asRecord(asRecord(rawTier)?.tier)?.type !== 'context') })
      if (result.length > 30000) throw new Error('目录条目超过限制')
    }
  }
  if (!result.length) throw new Error('目录没有有效文本模型定价')
  return result
}

export function createPriceCatalog({ table, fetcher = fetch, now = Date.now }: { table: Table; fetcher?: Fetcher; now?: () => number }) {
  let pending: Promise<CatalogState> | null = null
  const state = (): CatalogState => ({ ...((table.get(KEY) as CatalogState | undefined) ?? { schemaVersion: 1, source: URL, entries: [], fetchedAt: null }), syncing: Boolean(pending) })
  async function sync(force = false): Promise<CatalogState> { if (pending) return pending; const previous = state(); if (!force && previous.fetchedAt && now() - previous.fetchedAt < TTL) return previous
    pending = (async () => { try {
      const response = await fetcher(URL, { signal: AbortSignal.timeout(15000), redirect: 'error', headers: { accept: 'application/json' } }); if (!response.ok) throw new Error('目录请求失败'); if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('目录过大')
      const reader = response.body!.getReader(), parts: Buffer[] = []; let size = 0
      try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) throw new Error('目录过大'); parts.push(Buffer.from(value)) } } finally { await reader.cancel().catch(() => {}) }
      const bytes = Buffer.concat(parts), entries = normalizeCatalog(JSON.parse(bytes.toString('utf8'))), record: CatalogState = { schemaVersion: 1, source: URL, currency: 'USD', unit: 'per-million-tokens', fetchedAt: now(), attemptedAt: now(), sha256: createHash('sha256').update(bytes).digest('hex'), entries, error: null }; await table.put(KEY, record)
    } catch { const { syncing, ...prior } = previous; await table.put(KEY, { ...prior, schemaVersion: 1, attemptedAt: now(), error: '同步失败（网络或目录数据异常）；已保留上次成功的价格。' }) } return state() })()
    try { return await pending } finally { pending = null }
  }
  const status = () => { const s = state(); return { source: URL, currency: 'USD', unit: 'per-million-tokens', fetchedAt: s.fetchedAt, attemptedAt: s.attemptedAt, sha256: s.sha256, stale: !s.fetchedAt || now() - s.fetchedAt >= TTL, syncing: s.syncing, count: s.entries.length, error: s.error ?? null } }
  const refresh = () => { const s = state(); if (!pending && (!s.attemptedAt || now() - s.attemptedAt >= TTL)) void sync().catch(() => {}); return status() }
  return { state, status, sync, refresh }
}

const indexes = new WeakMap<readonly CatalogEntry[], Map<string, CatalogEntry>>()
function index(entries: readonly CatalogEntry[]): Map<string, CatalogEntry> { if (!indexes.has(entries)) indexes.set(entries, new Map(entries.map(entry => [entry.key, entry]))); return indexes.get(entries)! }
export function automaticKey(provider: string | null, model: string | null): string { return `${provider === 'deepseek-official' ? 'deepseek' : provider}/${model}` }
function buckets(usage: Usage): RateValues { const b: RateValues = { input: number(usage.inputTokens), output: number(usage.outputTokens), cacheRead: number(usage.cacheReadTokens), cacheWrite: number(usage.cacheWriteTokens) }, total = number(usage.totalTokens), missing = rateFields.filter(key => b[key] === null); if (total !== null && missing.length) { const known = rateFields.reduce((sum, key) => sum + (b[key] ?? 0), 0), remaining = total - known; if (remaining >= 0 && (missing.length === 1 || remaining === 0)) for (const key of missing) b[key] = missing.length === 1 ? remaining : 0 } return b }
export function resolvePricing(call: PricingCall, settings: PricingSettings = {}, entries: readonly CatalogEntry[] = []) {
  const row = settings.rates?.find(rate => rate.provider === call.provider && rate.model === call.model), mode = row ? (row.mode ?? 'manual') : (settings.defaultMode ?? 'manual'), absent = (status: string) => ({ cost: null, baseCost: null, mode, status, currency: settings.currency ?? 'USD' }); let chosen: RateValues | RateSetting, entry: CatalogEntry | null = null, multiplier = 1
  if (mode === 'auto') { if (settings.currency && settings.currency !== 'USD') return absent('currency-mismatch'); entry = index(entries).get(row?.catalogKey || automaticKey(call.provider, call.model)) ?? null; if (!entry) return absent('missing-catalog'); if (entry.unsupportedTiers) return absent('unsupported-tier'); chosen = { ...entry.rates }; const configuredMultiplier = number(row?.multiplier ?? settings.defaultMultiplier ?? 1); if (configuredMultiplier === null) return absent('invalid-multiplier'); multiplier = configuredMultiplier } else { if (!row) return absent('missing-manual'); chosen = row }
  if (mode === 'auto' && multiplier === 0) return { cost: 0, baseCost: null, mode, status: 'zero-multiplier', multiplier, catalogKey: entry!.key, currency: 'USD' }; if (!call.usage) return absent('missing-usage'); const b = buckets(call.usage)
  if (entry?.tiers.length) { const exact = number(call.usage.totalTokens), output = number(call.usage.outputTokens), context = exact !== null && output !== null && exact >= output ? exact - output : null; if (context === null) return absent('unknown-context-tier'); const tier = entry.tiers.findLast(item => context >= item.threshold); if (tier) chosen = { ...chosen, ...Object.fromEntries(rateFields.map(key => [key, tier[key] ?? chosen[key]])) } }
  let baseCost = 0; const billableFields = call.kind === 'embedding' ? (['input'] as const) : rateFields
  for (const key of billableFields) { const amount = b[key], rate = number(chosen[key]); if (rate === 0 || amount === 0) continue; if (amount === null) return absent('missing-usage'); if (rate === null) return absent(`missing-${key}-rate`); baseCost += amount * rate / 1e6 }
  return { cost: baseCost * multiplier, baseCost, mode, multiplier, catalogKey: entry?.key ?? null, rates: Object.fromEntries(rateFields.map(key => [key, number(chosen[key])])), currency: settings.currency ?? 'USD', status: 'priced' }
}

const FX_KEY = 'tavern_exchange_rates', FX_URL = 'https://open.er-api.com/v6/latest/USD', FX_SOURCE = 'https://www.exchangerate-api.com', DAY = 86400000
/** Daily public quotes; no account credentials, player data or arbitrary fetch URL. */
export function createExchangeRates({ table, fetcher = fetch, now = Date.now }: { table: Table; fetcher?: Fetcher; now?: () => number }) {
  let pending: Promise<void> | null = null; const state = (): ExchangeState => ({ ...((table.get(FX_KEY) as ExchangeState | undefined) ?? { schemaVersion: 1, rates: {}, rateAt: null, fetchedAt: null }), syncing: Boolean(pending) }); const status = () => { const s = state(); return { source: 'ExchangeRate-API', sourceUrl: FX_SOURCE, rateAt: s.rateAt, fetchedAt: s.fetchedAt, nextUpdateAt: s.nextUpdateAt ?? null, stale: !s.rateAt || now() - s.rateAt >= 2 * DAY || now() >= (s.nextUpdateAt ?? 0), syncing: s.syncing, error: s.error ?? null } }
  async function sync(force = false): Promise<ExchangeState | void> { if (pending) return pending; const previous = state(), time = now(); if (!force && (previous.error && time - (previous.attemptedAt ?? 0) < 3600000 || previous.fetchedAt && time < Math.min(previous.nextUpdateAt ?? 0, previous.fetchedAt + DAY))) return state()
    pending = (async () => { try { const response = await fetcher(FX_URL, { signal: AbortSignal.timeout(15000), redirect: 'error', headers: { accept: 'application/json' } }); if (!response.ok || Number(response.headers.get('content-length')) > 1024 * 1024) throw new Error('invalid response'); const reader = response.body!.getReader(), parts: Buffer[] = []; let size = 0; try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1024 * 1024) throw new Error('oversize'); parts.push(Buffer.from(value)) } } finally { await reader.cancel().catch(() => {}) }; const bytes = Buffer.concat(parts), data = asRecord(JSON.parse(bytes.toString('utf8')))!; const ratesData = asRecord(data.rates), rateAt = Number(data.time_last_update_unix) * 1000, nextUpdateAt = Number(data.time_next_update_unix) * 1000; if (data.result !== 'success' || data.base_code !== 'USD' || ratesData?.USD !== 1 || !(number(ratesData?.CNY)! > 0) || !Number.isFinite(rateAt) || rateAt <= 0 || rateAt > now() + 300000 || !Number.isFinite(nextUpdateAt) || nextUpdateAt <= rateAt) throw new Error('invalid quote'); const exchangeRates = Object.fromEntries(['USD', 'CNY', 'EUR', 'JPY', 'HKD'].filter(key => number(ratesData[key])! > 0).map(key => [key, ratesData[key] as number])); await table.put(FX_KEY, { schemaVersion: 1, source: FX_URL, sourceUrl: FX_SOURCE, base: 'USD', rates: exchangeRates, rateAt, nextUpdateAt, fetchedAt: now(), attemptedAt: now(), sha256: createHash('sha256').update(bytes).digest('hex'), error: null }) } catch { const { syncing, ...prior } = previous; await table.put(FX_KEY, { ...prior, schemaVersion: 1, attemptedAt: now(), error: '汇率更新失败，继续使用上次成功的汇率；没有缓存时成本显示 N/A。' }) } })(); try { await pending } finally { pending = null }; return state() }
  const refresh = () => { void sync().catch(() => {}); return status() }; return { state, status, sync, refresh }
}

/** Display conversion never mutates saved rates or the underlying usage ledger. */
export function convertUsageCurrency(stats: UsageStats, target: string, quote: ExchangeQuote, now = Date.now()) {
  if (!['USD', 'CNY'].includes(target)) throw new Error('展示币种必须为 USD 或 CNY')
  const source = stats.currency ?? 'USD', from = number(quote.rates?.[source]), to = number(quote.rates?.[target])
  const rate = source === target ? 1 : from !== null && from > 0 && to !== null && to > 0 ? to / from : null
  const convert = (row: UsageRow) => ({ ...row, cost: row.cost === null || rate === null ? null : row.cost * rate, knownCost: rate === null || row.knownCost === null ? null : row.knownCost * rate })
  return { ...stats, currency: target, sourceCurrency: source, totals: convert(stats.totals), models: stats.models.map(convert), providers: (stats.providers ?? []).map(convert), timeline: stats.timeline.map(convert), fx: source === target ? null : { source: 'ExchangeRate-API', sourceUrl: FX_SOURCE, rate, rateAt: quote.rateAt ?? null, fetchedAt: quote.fetchedAt ?? null, stale: !quote.rateAt || now - quote.rateAt >= 2 * DAY || now >= (quote.nextUpdateAt ?? 0), syncing: Boolean(quote.syncing), error: quote.error ?? null } }
}
