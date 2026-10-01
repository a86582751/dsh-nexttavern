// Generated from runtime/alpha3/src/core/tavern-price-catalog.ts; edit the TypeScript source.
// Independent models.dev consumer; product behavior references CC Switch (MIT).
// Sources, revisions and license attribution: docs/tavern-pricing.md.
import { createHash } from 'node:crypto';
import { asRecord, readPricingBytes, nonNegativeFinite, } from './tavern-pricing-data.js';
const KEY = 'tavern_price_catalog', URL = 'https://models.dev/api.json', TTL = 6 * 60 * 60 * 1000, MAX_BYTES = 16 * 1024 * 1024;
const text = (value) => typeof value === 'string' ? value.replace(/[\x00-\x1f]/g, '').slice(0, 400) : null;
const rates = (value) => {
    const record = asRecord(value);
    return {
        input: nonNegativeFinite(record?.input),
        output: nonNegativeFinite(record?.output),
        cacheRead: nonNegativeFinite(record?.cache_read),
        cacheWrite: nonNegativeFinite(record?.cache_write)
    };
};
export function normalizeCatalog(data) {
    if (!asRecord(data))
        throw new Error('目录格式无效');
    const result = [];
    for (const [provider, rawProvider] of Object.entries(data)) {
        const providerRecord = asRecord(rawProvider), models = asRecord(providerRecord?.models);
        for (const [model, rawModel] of Object.entries(models ?? {})) {
            const modelRecord = asRecord(rawModel), modalities = asRecord(modelRecord?.modalities), output = modalities?.output;
            if (!modelRecord)
                continue;
            if (!provider || !model || provider.length > 200 || model.length > 400 || /[\x00-\x1f]/.test(provider + model))
                continue;
            if (modelRecord?.status === 'deprecated' || !Array.isArray(output) || !output.includes('text')
                || output.some(value => ['audio', 'image', 'video'].includes(value))
                || !asRecord(modelRecord.cost))
                continue;
            const base = rates(modelRecord.cost);
            if (base.input === null && base.output === null)
                continue;
            const rawTiers = asRecord(modelRecord.cost)?.tiers;
            const tiers = Array.isArray(rawTiers) ? rawTiers.filter(rawTier => {
                const tier = asRecord(rawTier)?.tier;
                return asRecord(tier)?.type === 'context' && nonNegativeFinite(asRecord(tier)?.size) !== null;
            }).map(rawTier => {
                const tier = asRecord(asRecord(rawTier)?.tier);
                return {
                    threshold: nonNegativeFinite(tier.size), ...rates(rawTier)
                };
            }).sort((a, b) => a.threshold - b.threshold) : [];
            result.push({
                key: `${provider}/${model}`,
                provider,
                model,
                name: text(modelRecord.name) ?? model,
                providerName: text(providerRecord?.name) ?? provider,
                releaseDate: text(modelRecord.release_date),
                rates: base,
                tiers,
                unsupportedTiers: Array.isArray(rawTiers) && rawTiers.some(rawTier => asRecord(asRecord(rawTier)?.tier)?.type !== 'context')
            });
            if (result.length > 30000)
                throw new Error('目录条目超过限制');
        }
    }
    if (!result.length)
        throw new Error('目录没有有效文本模型定价');
    return result;
}
export function createPriceCatalog({ table, fetcher = fetch, now = Date.now }) {
    let pending = null;
    const state = () => ({
        ...(table.get(KEY) ?? {
            schemaVersion: 1, source: URL, entries: [], fetchedAt: null
        }),
        syncing: Boolean(pending)
    });
    async function sync(force = false) {
        // Forced refresh still joins the current request; only successful data advances fetchedAt.
        if (pending)
            return pending;
        const previous = state();
        if (!force && previous.fetchedAt && now() - previous.fetchedAt < TTL)
            return previous;
        pending = (async () => {
            try {
                const response = await fetcher(URL, {
                    signal: AbortSignal.timeout(15000),
                    redirect: 'error',
                    headers: {
                        accept: 'application/json'
                    }
                });
                if (!response.ok)
                    throw new Error('目录请求失败');
                if (Number(response.headers.get('content-length')) > MAX_BYTES)
                    throw new Error('目录过大');
                const bytes = await readPricingBytes(response, MAX_BYTES, '目录过大');
                const entries = normalizeCatalog(JSON.parse(bytes.toString('utf8'))), record = {
                    schemaVersion: 1,
                    source: URL,
                    currency: 'USD',
                    unit: 'per-million-tokens',
                    fetchedAt: now(),
                    attemptedAt: now(),
                    sha256: createHash('sha256').update(bytes).digest('hex'),
                    entries,
                    error: null
                };
                await table.put(KEY, record);
            }
            catch {
                // Failed refreshes retain the last usable catalog and throttle background retries.
                const { syncing, ...prior } = previous;
                await table.put(KEY, {
                    ...prior,
                    schemaVersion: 1,
                    attemptedAt: now(),
                    error: '同步失败（网络或目录数据异常）；已保留上次成功的价格。'
                });
            }
            return state();
        })();
        try {
            return await pending;
        }
        finally {
            pending = null;
        }
    }
    const status = () => {
        const s = state();
        return {
            source: URL,
            currency: 'USD',
            unit: 'per-million-tokens',
            fetchedAt: s.fetchedAt,
            attemptedAt: s.attemptedAt,
            sha256: s.sha256,
            stale: !s.fetchedAt || now() - s.fetchedAt >= TTL,
            syncing: s.syncing,
            count: s.entries.length,
            error: s.error ?? null
        };
    };
    const refresh = () => {
        const s = state();
        if (!pending && (!s.attemptedAt || now() - s.attemptedAt >= TTL))
            void sync().catch(() => {
            });
        return status();
    };
    return {
        state, status, sync, refresh
    };
}
