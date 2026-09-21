// Generated from runtime/alpha3/src/core/tavern-exchange-rates.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { readPricingBytes, asRecord, nonNegativeFinite } from './tavern-pricing-data.js';
const FX_KEY = 'tavern_exchange_rates', FX_URL = 'https://open.er-api.com/v6/latest/USD', FX_SOURCE = 'https://www.exchangerate-api.com', DAY = 86400000;
/** Daily public quotes; no account credentials, player data or arbitrary fetch URL. */
export function createExchangeRates({ table, fetcher = fetch, now = Date.now }) {
    let pending = null;
    const state = () => ({
        ...(table.get(FX_KEY) ?? {
            schemaVersion: 1, rates: {}, rateAt: null, fetchedAt: null
        }),
        syncing: Boolean(pending)
    });
    const status = () => {
        const s = state();
        return {
            source: 'ExchangeRate-API',
            sourceUrl: FX_SOURCE,
            rateAt: s.rateAt,
            fetchedAt: s.fetchedAt,
            nextUpdateAt: s.nextUpdateAt ?? null,
            stale: !s.rateAt || now() - s.rateAt >= 2 * DAY || now() >= (s.nextUpdateAt ?? 0),
            syncing: s.syncing,
            error: s.error ?? null
        };
    };
    async function sync(force = false) {
        if (pending)
            return pending;
        const previous = state(), time = now();
        // Quotes have a one-hour failure backoff and a daily expiry, unlike the model catalog.
        if (!force
            && (previous.error && time - (previous.attemptedAt ?? 0) < 3600000
                || previous.fetchedAt && time < Math.min(previous.nextUpdateAt ?? 0, previous.fetchedAt + DAY)))
            return state();
        pending = (async () => {
            try {
                const response = await fetcher(FX_URL, {
                    signal: AbortSignal.timeout(15000),
                    redirect: 'error',
                    headers: {
                        accept: 'application/json'
                    }
                });
                if (!response.ok || Number(response.headers.get('content-length')) > 1024 * 1024)
                    throw new Error('invalid response');
                const bytes = await readPricingBytes(response, 1024 * 1024, 'oversize');
                const data = asRecord(JSON.parse(bytes.toString('utf8')));
                const ratesData = asRecord(data.rates), rateAt = Number(data.time_last_update_unix) * 1000, nextUpdateAt = Number(data.time_next_update_unix) * 1000;
                if (data.result !== 'success' || data.base_code !== 'USD' || ratesData?.USD !== 1
                    || !(nonNegativeFinite(ratesData?.CNY) > 0)
                    || !Number.isFinite(rateAt)
                    || rateAt <= 0
                    || rateAt > now() + 300000
                    || !Number.isFinite(nextUpdateAt)
                    || nextUpdateAt <= rateAt)
                    throw new Error('invalid quote');
                const exchangeRates = Object.fromEntries(['USD', 'CNY', 'EUR', 'JPY', 'HKD']
                    .filter(key => nonNegativeFinite(ratesData[key]) > 0)
                    .map(key => [key, ratesData[key]]));
                await table.put(FX_KEY, {
                    schemaVersion: 1,
                    source: FX_URL,
                    sourceUrl: FX_SOURCE,
                    base: 'USD',
                    rates: exchangeRates,
                    rateAt,
                    nextUpdateAt,
                    fetchedAt: now(),
                    attemptedAt: now(),
                    sha256: createHash('sha256').update(bytes).digest('hex'),
                    error: null
                });
            }
            catch {
                const { syncing, ...prior } = previous;
                await table.put(FX_KEY, {
                    ...prior,
                    schemaVersion: 1,
                    attemptedAt: now(),
                    error: '汇率更新失败，继续使用上次成功的汇率；没有缓存时成本显示 N/A。'
                });
            }
        })();
        try {
            await pending;
        }
        finally {
            pending = null;
        }
        return state();
    }
    const refresh = () => {
        void sync().catch(() => {
        });
        return status();
    };
    return {
        state, status, sync, refresh
    };
}
/** Display conversion never mutates saved rates or the underlying usage ledger. */
export function convertUsageCurrency(stats, target, quote, now = Date.now()) {
    if (!['USD', 'CNY'].includes(target))
        throw new Error('展示币种必须为 USD 或 CNY');
    const source = stats.currency ?? 'USD', from = nonNegativeFinite(quote.rates?.[source]), to = nonNegativeFinite(quote.rates?.[target]);
    const rate = source === target ? 1 : from !== null && from > 0 && to !== null && to > 0 ? to / from : null;
    const convert = (row) => ({
        ...row,
        cost: row.cost === null || rate === null ? null : row.cost * rate,
        knownCost: rate === null || row.knownCost === null ? null : row.knownCost * rate
    });
    return {
        ...stats,
        currency: target,
        sourceCurrency: source,
        totals: convert(stats.totals),
        models: stats.models.map(convert),
        providers: (stats.providers ?? []).map(convert),
        timeline: stats.timeline.map(convert),
        fx: source === target ? null : {
            source: 'ExchangeRate-API',
            sourceUrl: FX_SOURCE,
            rate,
            rateAt: quote.rateAt ?? null,
            fetchedAt: quote.fetchedAt ?? null,
            stale: !quote.rateAt || now - quote.rateAt >= 2 * DAY || now >= (quote.nextUpdateAt ?? 0),
            syncing: Boolean(quote.syncing),
            error: quote.error ?? null
        }
    };
}
