// Generated from runtime/alpha3/core/roleplay-telemetry-routes.ts; edit the TypeScript source.
import { jsonResponse } from './roleplay-state.js';
import { timeRange, aggregateUsage, queryUsageRequests } from './tavern-telemetry.js';
import { convertUsageCurrency } from './tavern-pricing.js';
export function registerTelemetryRoutes({ ctx, resolveRoleplaySession, exchangeRates, priceCatalog, telemetry }) {
    ctx.effect(() => ctx.connection.fetch.register({ path: '/api/roleplay/exchange-rate', methods: ['GET', 'POST'], fetch: async (request) => {
            try {
                const url = new URL(request.url), body = request.method === 'POST' ? await request.json() : null, session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                if (body) {
                    if (body.action !== 'sync')
                        throw new Error('未知汇率操作');
                    await exchangeRates.sync(true);
                }
                else
                    exchangeRates.refresh();
                return jsonResponse(200, { ok: true, fx: exchangeRates.status() });
            }
            catch (error) {
                return jsonResponse(400, { ok: false, error: String(error.message) });
            }
        } }), 'roleplay: daily exchange rate route');
    ctx.effect(() => ctx.connection.fetch.register({ path: '/api/roleplay/price-catalog', methods: ['GET', 'POST'], fetch: async (request) => {
            try {
                const url = new URL(request.url), body = request.method === 'POST' ? await request.json() : null, session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                if (body) {
                    if (body.action !== 'sync')
                        throw new Error('未知目录操作');
                    await priceCatalog.sync(true);
                }
                else if (telemetry.prices().autoSync)
                    priceCatalog.refresh();
                const search = (url.searchParams.get('q') ?? '').slice(0, 200).toLowerCase(), requested = JSON.parse(url.searchParams.get('keys') ?? '[]');
                if (!Array.isArray(requested) || requested.length > 500 || requested.some(v => typeof v !== 'string' || v.length > 800))
                    throw new Error('目录选择无效');
                const requestedKeys = new Set(requested), selected = new Map(), matching = [];
                for (const entry of priceCatalog.state().entries) {
                    if (requestedKeys.has(entry.key))
                        selected.set(entry.key, entry);
                    if (matching.length < 100 && `${entry.key} ${entry.name}`.toLowerCase().includes(search))
                        matching.push(entry);
                }
                for (const entry of matching)
                    selected.set(entry.key, entry);
                const entries = [...selected.values()];
                return jsonResponse(200, { ok: true, catalog: priceCatalog.status(), entries });
            }
            catch (error) {
                return jsonResponse(400, { ok: false, error: String(error.message) });
            }
        } }), 'roleplay: public price catalog route');
    for (const path of ['/api/roleplay/usage', '/api/roleplay/usage-requests', '/api/roleplay/logs', '/api/roleplay/prices'])
        ctx.effect(() => ctx.connection.fetch.register({ path, methods: path.endsWith('/prices') ? ['GET', 'POST'] : ['GET'], fetch: async (request) => {
                try {
                    const url = new URL(request.url), body = request.method === 'POST' ? await request.json() : null;
                    const session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                    if (!session)
                        return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                    if (path.endsWith('/prices')) {
                        if (body)
                            await telemetry.savePrices(body.settings, body.expectedRevision);
                        if (telemetry.prices().autoSync)
                            priceCatalog.refresh();
                        return jsonResponse(200, { ok: true, prices: telemetry.prices(), catalog: priceCatalog.status() });
                    }
                    const q = Object.fromEntries(url.searchParams), range = timeRange(q);
                    const coverage = telemetry.refresh();
                    const targetSessionId = q.scope === 'all' ? null : q.targetSessionId ?? session.id;
                    const filter = { ...range, targetSessionId, provider: q.provider, model: q.model, kind: q.kind };
                    if (path.endsWith('/usage-requests')) {
                        const prices = telemetry.prices();
                        if (prices.autoSync)
                            priceCatalog.refresh();
                        if (q.currency) {
                            if (!['USD', 'CNY'].includes(q.currency))
                                throw new Error('展示币种必须为 USD 或 CNY');
                            if (q.currency !== prices.currency)
                                exchangeRates.refresh();
                        }
                        const sessions = telemetry.sessionList();
                        return jsonResponse(200, { ok: true, ...queryUsageRequests(telemetry.calls(), { ...filter, currency: q.currency, offset: q.offset, limit: q.limit }, prices, priceCatalog.state().entries, exchangeRates.state(), sessions), sessions, coverage });
                    }
                    if (path.endsWith('/usage')) {
                        if (telemetry.prices().autoSync)
                            priceCatalog.refresh();
                        let stats = aggregateUsage(telemetry.calls().filter(r => r.ownerSessionId !== null || (r.kind === 'embedding' && !!r.source.workspaceId)), filter, telemetry.prices(), priceCatalog.state().entries);
                        if (q.currency) {
                            if (!['USD', 'CNY'].includes(q.currency))
                                throw new Error('展示币种必须为 USD 或 CNY');
                            if (q.currency !== stats.currency)
                                exchangeRates.refresh();
                            stats = convertUsageCurrency(stats, q.currency, exchangeRates.state());
                        }
                        return jsonResponse(200, { ok: true, ...stats, sessions: telemetry.sessionList(), coverage, pricingCatalog: priceCatalog.status() });
                    }
                    const rows = telemetry.logs().filter(r => (r.ownerSessionId !== null || (r.kind === 'embedding' && 'workspaceId' in r.source)) && (!targetSessionId || r.ownerSessionId === targetSessionId) && r.startedAt >= range.from && r.startedAt < range.to && (!q.kind || (q.kind === 'generation' ? r.kind !== 'embedding' : r.kind === q.kind)) && (!q.status || r.status === q.status) && (!q.model || r.model === q.model));
                    const offset = Math.max(0, Math.min(1e7, Number(q.offset) || 0)), limit = Math.max(1, Math.min(100, Number(q.limit) || 50));
                    return jsonResponse(200, { ok: true, rows: rows.slice(offset, offset + limit), total: rows.length, offset, limit, sessions: telemetry.sessionList(), coverage });
                }
                catch (error) {
                    return jsonResponse(String(error.message).includes('已更新') ? 409 : 400, { ok: false, error: String(error.message) });
                }
            } }), `roleplay: telemetry route ${path}`);
}
