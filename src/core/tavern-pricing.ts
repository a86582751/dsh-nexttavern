import { rateFields, nonNegativeFinite, type RateValues } from './tavern-pricing-data.js';
import type { CatalogEntry } from './tavern-price-catalog.js';
// Keep the existing pricing entry available to routes, telemetry and public consumers.
export { createPriceCatalog, normalizeCatalog, type CatalogEntry } from './tavern-price-catalog.js';
export { createExchangeRates, convertUsageCurrency, type ExchangeQuote } from './tavern-exchange-rates.js';
type Usage = {
  inputTokens?: unknown;
  outputTokens?: unknown;
  cacheReadTokens?: unknown;
  cacheWriteTokens?: unknown;
  totalTokens?: unknown;
};
export type PricingCall = {
  provider: string | null;
  model: string | null;
  kind?: string;
  usage?: Usage | null;
};
type RateSetting = Partial<RateValues> & {
  provider?: string;
  model?: string;
  mode?: string;
  catalogKey?: string | null;
  multiplier?: unknown;
};
export type PricingSettings = {
  rates?: RateSetting[];
  defaultMode?: string;
  defaultMultiplier?: unknown;
  currency?: string;
};
const indexes = new WeakMap<readonly CatalogEntry[], Map<string, CatalogEntry>>();
function index(entries: readonly CatalogEntry[]): Map<string, CatalogEntry> {
  if (!indexes.has(entries))
    indexes.set(entries, new Map(entries.map(entry => [entry.key, entry])));
  return indexes.get(entries)!;
}
export function automaticKey(provider: string | null, model: string | null): string {
  return `${provider === 'deepseek-official' ? 'deepseek' : provider}/${model}`;
}
function buckets(usage: Usage): RateValues {
  // Only an exact total can prove a missing bucket is zero; absence alone is not zero usage.
  const b: RateValues = {
    input: nonNegativeFinite(usage.inputTokens),
    output: nonNegativeFinite(usage.outputTokens),
    cacheRead: nonNegativeFinite(usage.cacheReadTokens),
    cacheWrite: nonNegativeFinite(usage.cacheWriteTokens)
  },
    total = nonNegativeFinite(usage.totalTokens),
    missing = rateFields.filter(key => b[key] === null);
  if (total !== null && missing.length) {
    const known = rateFields.reduce((sum, key) => sum + (b[key] ?? 0), 0), remaining = total - known;
    if (remaining >= 0 && (missing.length === 1 || remaining === 0))
      for (const key of missing)
        b[key] = missing.length === 1 ? remaining : 0;
  }
  return b;
}
export function resolvePricing(call: PricingCall, settings: PricingSettings = {}, entries: readonly CatalogEntry[] = []) {
  const row = settings.rates?.find(rate => rate.provider === call.provider && rate.model === call.model),
    mode = row ? (row.mode ?? 'manual') : (settings.defaultMode ?? 'manual'),
    absent = (status: string) => ({
      cost: null, baseCost: null, mode, status, currency: settings.currency ?? 'USD'
    });
  let chosen: RateValues | RateSetting, entry: CatalogEntry | null = null, multiplier = 1;
  if (mode === 'auto') {
    if (settings.currency && settings.currency !== 'USD')
      return absent('currency-mismatch');
    entry = index(entries).get(row?.catalogKey || automaticKey(call.provider, call.model)) ?? null;
    if (!entry)
      return absent('missing-catalog');
    if (entry.unsupportedTiers)
      return absent('unsupported-tier');
    chosen = {
      ...entry.rates
    };
    const configuredMultiplier = nonNegativeFinite(row?.multiplier ?? settings.defaultMultiplier ?? 1);
    if (configuredMultiplier === null)
      return absent('invalid-multiplier');
    multiplier = configuredMultiplier;
  }
  else {
    if (!row)
      return absent('missing-manual');
    chosen = row;
  }
  if (mode === 'auto' && multiplier === 0)
    return {
      cost: 0,
      baseCost: null,
      mode,
      status: 'zero-multiplier',
      multiplier,
      catalogKey: entry!.key,
      currency: 'USD'
    };
  if (!call.usage)
    return absent('missing-usage');
  const b = buckets(call.usage);
  if (entry?.tiers.length) {
    // Tier selection requires provider evidence, not an estimate from incomplete input buckets.
    const exact = nonNegativeFinite(call.usage.totalTokens),
      output = nonNegativeFinite(call.usage.outputTokens),
      context = exact !== null && output !== null && exact >= output ? exact - output : null;
    if (context === null)
      return absent('unknown-context-tier');
    const tier = entry.tiers.findLast(item => context >= item.threshold);
    if (tier)
      chosen = {
        ...chosen,
        ...Object.fromEntries(rateFields.map(key => [key, tier[key] ?? chosen[key]]))
      };
  }
  let baseCost = 0;
  const billableFields = call.kind === 'embedding' ? (['input'] as const) : rateFields;
  for (const key of billableFields) {
    const amount = b[key], rate = nonNegativeFinite(chosen[key]);
    if (rate === 0 || amount === 0)
      continue;
    if (amount === null)
      return absent('missing-usage');
    if (rate === null)
      return absent(`missing-${key}-rate`);
    baseCost += amount * rate / 1e6;
  }
  return {
    cost: baseCost * multiplier,
    baseCost,
    mode,
    multiplier,
    catalogKey: entry?.key ?? null,
    rates: Object.fromEntries(rateFields.map(key => [key, nonNegativeFinite(chosen[key])])),
    currency: settings.currency ?? 'USD',
    status: 'priced'
  };
}
