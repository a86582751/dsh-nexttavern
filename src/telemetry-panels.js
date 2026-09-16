// Generated from runtime/alpha3/ui/telemetry-panels.ts; edit the TypeScript source.
import { normalizePricingSettings, formatFallbackText, usageCostPresentation } from './settings-projection.js';
const errorMessage = (error) => String(error && typeof error === 'object' && 'message' in error ? error.message : error);
export function createTelemetryPanels({ React, sessionDrafts, jsonFetch, toast }) {
    const telemetryStatus = { completed: '成功', failed: '失败', cancelled: '已取消', truncated: '输出截断', unknown: '结果未知', interrupted: '运行中断', running: '运行中', queued: '排队中', 'waiting-main': '等待主模型', stale: '来源已变化' };
    const telemetryKind = { character: '角色推演', model: '模型调用', narrative: '正文生成', subagent: '子代理', tool: '工具调用', turn: '轮次结束', memory: '记忆整理', status: '状态栏', decision: '决策建议', embedding: '向量嵌入', 'card-import': '读卡', 'card-export': '角色卡导出', 'novel-export': '小说导出', 'session-title': '会话标题', compaction: '记忆压缩', management: '管理任务', 'after-story': '轮末维护', 'before-story': '正文准备' };
    const numberFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 6 });
    const statNumber = (value) => value == null ? 'N/A' : numberFormatter.format(value);
    const statTime = (value) => value == null ? 'N/A' : new Date(value).toLocaleString('zh-CN', { hour12: false });
    function panelRange(preset, custom) {
        const now = new Date(), to = now.getTime();
        let from;
        if (preset === 'custom')
            return { from: new Date(custom.from).getTime(), to: new Date(custom.to).getTime() };
        if (preset === 'all')
            from = 0;
        else if (preset === 'week') {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
            from = start.getTime();
        }
        else if (preset === 'month')
            from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        else if (preset === 'year')
            from = new Date(now.getFullYear(), 0, 1).getTime();
        else
            from = to - ({ '1h': 3600000, '24h': 86400000, '3d': 259200000 }[preset] ?? 86400000);
        return { from, to };
    }
    function UsageChart({ data }) {
        const points = data?.timeline ?? [], series = [['inputTokens', '输入', '#4085f4'], ['outputTokens', '输出', '#14a87b'], ['cacheReadTokens', '缓存命中', '#9b66e8']];
        if (!points.length)
            return React.createElement('div', { className: 'dsh-rp-empty' }, '这个时间段还没有调用记录');
        const max = Math.max(1, ...points.flatMap(p => series.map(([key]) => p[key]))), left = 46, right = 714, top = 18, bottom = 175, first = points[0].at, last = points.at(-1).at;
        const x = (p) => left + (p.at - first) / Math.max(1, last - first) * (right - left), y = (value) => bottom - value / max * (bottom - top);
        return React.createElement('section', { className: 'dsh-rp-stat-chart' }, React.createElement('div', { className: 'dsh-rp-section-title' }, '用量趋势'), React.createElement('svg', { viewBox: '0 0 740 218', role: 'img', 'aria-label': '模型输入、输出与缓存命中 tokens 趋势' }, [0, .5, 1].map(r => React.createElement('g', { key: r }, React.createElement('line', { x1: left, x2: right, y1: y(max * r), y2: y(max * r), stroke: 'currentColor', opacity: .1 }), React.createElement('text', { x: 40, y: y(max * r) + 4, textAnchor: 'end', fill: 'currentColor', fontSize: 10 }, Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(max * r)))), series.map(([key, label, color]) => React.createElement('g', { key }, React.createElement('polyline', { points: points.map(p => `${x(p)},${y(p[key])}`).join(' '), fill: 'none', stroke: color, strokeWidth: 2.5 }), points.map(p => React.createElement('circle', { key: p.at, cx: x(p), cy: y(p[key]), r: 3, fill: color }, React.createElement('title', null, `${statTime(p.at)} · ${label} ${statNumber(p[key])}`))))), React.createElement('text', { x: left, y: 204, fill: 'currentColor', fontSize: 10 }, statTime(first)), React.createElement('text', { x: right, y: 204, textAnchor: 'end', fill: 'currentColor', fontSize: 10 }, statTime(last))), React.createElement('div', { className: 'dsh-rp-chart-legend' }, series.map(([key, label, color]) => React.createElement('span', { key, style: { color } }, `● ${label}`))));
    }
    function PricePanel({ sessionId, models, onSaved }) {
        const draftKey = `${sessionId}:prices`, [data, setData] = React.useState(null), [busy, setBusy] = React.useState(false), [nativeCatalog, setNativeCatalog] = React.useState([]), [catalog, setCatalog] = React.useState({}), [entries, setEntries] = React.useState([]), [query, setQuery] = React.useState(''), [selected, setSelected] = React.useState(''), catalogRequest = React.useRef(0);
        const normalize = (raw) => normalizePricingSettings(raw);
        const change = (next) => { const normalized = normalize(next); setData(normalized); sessionDrafts.set(draftKey, normalized); };
        const loadCatalog = React.useCallback(async (search = '', keys = []) => { const request = ++catalogRequest.current, q = new URLSearchParams({ sessionId, q: search }); if (keys.length)
            q.set('keys', JSON.stringify(keys)); const result = await jsonFetch(`/api/roleplay/price-catalog?${q}`); if (request !== catalogRequest.current)
            return result; setCatalog(result.catalog ?? {}); setEntries(result.entries ?? []); return result; }, [sessionId]);
        React.useEffect(() => { let live = true; Promise.all([jsonFetch(`/api/roleplay/prices?sessionId=${encodeURIComponent(sessionId)}`), jsonFetch(`/api/roleplay/models?sessionId=${encodeURIComponent(sessionId)}`)]).then(([p, m]) => { if (!live)
            return; const saved = sessionDrafts.get(`${sessionId}:prices`); setData(normalize(saved ?? p.prices)); setNativeCatalog(m.catalog ?? []); }).catch(e => toast(errorMessage(e))); return () => { live = false; }; }, [sessionId]);
        const routes = [...new Map([...(models ?? []), ...(data?.rates ?? [])].filter(r => r?.provider && r?.model).map(r => [JSON.stringify([r.provider, r.model]), { provider: r.provider, model: r.model }])).values()];
        const rows = [...new Map([...(data?.rates ?? []), ...routes.filter(route => !(data?.rates ?? []).some(rate => rate.provider === route.provider && rate.model === route.model)).map(route => ({ ...route, mode: data?.defaultMode ?? 'manual', multiplier: null, catalogKey: null, input: null, output: null, cacheRead: null, cacheWrite: null }))].map(rate => [JSON.stringify([rate.provider, rate.model]), rate])).values()];
        const catalogKeys = [...new Set(rows.map(route => route.catalogKey ?? `${route.provider === 'deepseek-official' ? 'deepseek' : route.provider}/${route.model}`))], catalogKeyToken = JSON.stringify(catalogKeys);
        React.useEffect(() => { const timer = setTimeout(() => loadCatalog(query, catalogKeys).catch(e => setCatalog({ error: errorMessage(e) })), 250); return () => clearTimeout(timer); }, [query, loadCatalog, catalogKeyToken]);
        const updateRate = (route, patch) => { if (!data)
            return; const index = data.rates.findIndex(rate => rate.provider === route.provider && rate.model === route.model); change({ ...data, rates: index < 0 ? [...data.rates, { ...route, mode: data.defaultMode, multiplier: null, catalogKey: null, input: null, output: null, cacheRead: null, cacheWrite: null, ...patch }] : data.rates.map((rate, i) => i === index ? { ...rate, ...patch } : rate) }); };
        const add = (raw) => { if (!raw || !data)
            return; const route = JSON.parse(raw); if (data.rates.some(r => r.provider === route.provider && r.model === route.model))
            return; change({ ...data, rates: [...data.rates, { ...route, mode: data.defaultMode, multiplier: null, catalogKey: null, input: null, output: null, cacheRead: null, cacheWrite: null }] }); setSelected(''); };
        const sync = async () => { setBusy(true); try {
            const result = await jsonFetch('/api/roleplay/price-catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, action: 'sync' }) });
            setCatalog(result.catalog ?? {});
            setEntries(result.entries ?? []);
            if (result.catalog?.error)
                toast('目录同步失败：' + result.catalog.error);
            else
                toast('目录已同步');
        }
        catch (e) {
            toast(errorMessage(e));
        }
        finally {
            setBusy(false);
        } };
        const save = async () => { if (!data)
            return; const hasAuto = data.defaultMode === 'auto' || data.rates.some(r => r.mode === 'auto'); if (hasAuto && data.currency !== 'USD') {
            toast('自动定价只支持 USD：请先切换为 USD，或将全部模型改为手动；不会自动修改币种或清除手动价格。');
            return;
        } setBusy(true); try {
            const result = await jsonFetch('/api/roleplay/prices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, settings: data, expectedRevision: data.revision }) });
            const next = normalize(result.prices);
            setData(next);
            sessionDrafts.delete(draftKey);
            toast('定价已保存');
            onSaved?.();
        }
        catch (e) {
            toast(errorMessage(e));
        }
        finally {
            setBusy(false);
        } };
        const exact = (r) => ({ provider: r.provider === 'deepseek-official' ? 'deepseek' : r.provider, model: r.model });
        const sourceLabel = (r) => { const match = entries.find(e => e.key === r.catalogKey) || entries.find(e => e.provider === exact(r).provider && e.model === exact(r).model); return match ? `${match.provider} / ${match.model}` : `${exact(r).provider} / ${exact(r).model}（未在目录中确认）`; };
        if (!data)
            return React.createElement('p', { className: 'dsh-rp-muted' }, '正在读取定价设置…');
        return React.createElement('fieldset', { className: 'dsh-rp-pricing', disabled: busy }, React.createElement('p', { className: 'dsh-rp-muted' }, '自动价格来自目录的精确供应商/模型匹配，金额单位为 USD/百万 tokens。中转站不会推断模型厂商；无目录匹配时显示 N/A。手动价格始终保留。'), React.createElement('div', { className: 'dsh-rp-pricing-grid' }, React.createElement('section', { className: 'dsh-rp-pricing-card' }, React.createElement('h5', null, '默认规则'), React.createElement('label', null, '币种 ', React.createElement('select', { value: data.currency ?? 'USD', onChange: (e) => change({ ...data, currency: e.target.value }) }, ['USD', 'CNY', 'EUR', 'JPY', 'HKD'].map(v => React.createElement('option', { key: v, value: v }, v)))), React.createElement('label', null, '默认模式 ', React.createElement('select', { value: data.defaultMode, onChange: (e) => change({ ...data, defaultMode: e.target.value }) }, React.createElement('option', { value: 'auto' }, '自动目录'), React.createElement('option', { value: 'manual' }, '手动单价'))), React.createElement('label', null, '默认倍率 ', React.createElement('input', { type: 'number', min: 0, step: 'any', value: data.defaultMultiplier ?? 1, onChange: (e) => change({ ...data, defaultMultiplier: e.target.value === '' ? 1 : Number(e.target.value) }) })), React.createElement('label', { className: 'dsh-rp-row' }, React.createElement('input', { type: 'checkbox', checked: data.autoSync === true, onChange: (e) => change({ ...data, autoSync: e.target.checked }) }), '自动同步目录')), React.createElement('section', { className: 'dsh-rp-pricing-card' }, React.createElement('h5', null, '自动目录'), React.createElement('div', { className: 'dsh-rp-muted' }, `来源：${catalog.source ?? '未同步'} · ${catalog.fetchedAt ? statTime(catalog.fetchedAt) : '尚无更新时间'} · ${catalog.count ?? entries.length ?? 0} 项`), catalog.stale ? React.createElement('div', { className: 'dsh-rp-error' }, '目录缓存已过期；可继续使用旧缓存或立即同步。') : null, catalog.error ? React.createElement('div', { className: 'dsh-rp-error' }, catalog.error) : null, React.createElement('div', { className: 'dsh-rp-row' }, React.createElement('input', { placeholder: '搜索目录模型', value: query, onChange: (e) => setQuery(e.target.value) }), React.createElement('button', { className: 'dsh-rp-btn', onClick: sync }, catalog.syncing ? '同步中…' : '立即同步')))), data.currency !== 'USD' && (data.defaultMode === 'auto' || data.rates.some(r => r.mode === 'auto')) ? React.createElement('div', { className: 'dsh-rp-error', role: 'alert' }, '自动定价只支持 USD。请切换为 USD，或把全部模型设为手动；保存不会隐式修改币种或清除手动价格。') : null, React.createElement('div', { className: 'dsh-rp-row' }, React.createElement('select', { 'aria-label': '添加定价模型', value: selected, onChange: (e) => setSelected(e.target.value) }, React.createElement('option', { value: '' }, '从当前模型或原生目录添加…'), [...new Map([...routes, ...nativeCatalog].filter(r => r?.provider && r?.model).map(r => [JSON.stringify([r.provider, r.model]), r])).values()].map(r => React.createElement('option', { key: JSON.stringify(r), value: JSON.stringify({ provider: r.provider, model: r.model }) }, `${r.provider} / ${r.model}`))), React.createElement('button', { className: 'dsh-rp-btn', disabled: !selected, onClick: () => add(selected) }, '添加模型')), React.createElement('div', { className: 'dsh-rp-pricing-list' }, rows.map(r => React.createElement('section', { className: 'dsh-rp-pricing-card', key: JSON.stringify([r.provider, r.model]) }, React.createElement('div', { className: 'dsh-rp-item-head' }, React.createElement('div', null, React.createElement('strong', null, r.model), React.createElement('div', { className: 'dsh-rp-muted' }, r.provider)), React.createElement('select', { 'aria-label': `${r.model} 定价模式`, value: r.mode, onChange: (e) => updateRate(r, { mode: e.target.value }) }, React.createElement('option', { value: 'auto' }, '自动'), React.createElement('option', { value: 'manual' }, '手动'))), r.mode === 'auto' ? React.createElement('div', { className: 'dsh-rp-pricing-auto' }, React.createElement('label', null, '目录来源 ', React.createElement('select', { value: r.catalogKey ?? '', onChange: (e) => updateRate(r, { catalogKey: e.target.value || null }) }, React.createElement('option', { value: '' }, sourceLabel(r)), entries.map(entry => React.createElement('option', { key: entry.key, value: entry.key }, `${entry.provider} / ${entry.model}`)))), React.createElement('label', null, '倍率 ', React.createElement('input', { type: 'number', min: 0, step: 'any', placeholder: `默认 ${data.defaultMultiplier ?? 1}`, value: r.multiplier ?? '', onChange: (e) => updateRate(r, { multiplier: e.target.value === '' ? null : Number(e.target.value) }) })), React.createElement('div', { className: 'dsh-rp-muted' }, r.catalogKey ? '使用指定目录项；空值按精确 provider/model 查找。' : '空目录项会按精确 provider/model 匹配；deepseek-official 仅映射为 deepseek。')) :
            React.createElement('div', { className: 'dsh-rp-pricing-manual' }, ['input', 'output', 'cacheRead', 'cacheWrite'].map(field => React.createElement('label', { key: field }, ({ input: '输入', output: '输出', cacheRead: '缓存命中', cacheWrite: '缓存写入' })[field], React.createElement('input', { type: 'number', min: 0, step: 'any', placeholder: 'N/A', value: r[field] ?? '', onChange: (e) => updateRate(r, { [field]: e.target.value === '' ? null : Number(e.target.value) }) }))))))), React.createElement('div', { className: 'dsh-rp-row' }, React.createElement('button', { className: 'dsh-rp-btn dsh-rp-primary', onClick: save }, busy ? '保存中…' : '保存定价设置')));
    }
    function TelemetryPanel({ sessionId, mode }) {
        const [preset, setPreset] = React.useState('24h'), [scope, setScope] = React.useState('current'), [custom, setCustom] = React.useState({ from: '', to: '' }), [model, setModel] = React.useState(''), [kind, setKind] = React.useState(''), [usageKind, setUsageKind] = React.useState('all'), [status, setStatus] = React.useState(''), [offset, setOffset] = React.useState(0), [data, setData] = React.useState(null), [error, setError] = React.useState(''), [busy, setBusy] = React.useState(false), [revision, setRevision] = React.useState(0), [customApplied, setCustomApplied] = React.useState(null), [usageCurrency, setUsageCurrency] = React.useState(() => { try {
            return localStorage.getItem('dsh-roleplay-usage-currency') === 'CNY' ? 'CNY' : 'USD';
        }
        catch {
            return 'USD';
        } }), [fxBusy, setFxBusy] = React.useState(false), [usageTab, setUsageTab] = React.useState('models'), [requests, setRequests] = React.useState(null), [requestBusy, setRequestBusy] = React.useState(false);
        React.useEffect(() => {
            let live = true;
            const controller = new AbortController();
            setBusy(true);
            setError('');
            const range = preset === 'custom' ? customApplied : panelRange(preset, custom);
            if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to) || range.from >= range.to) {
                setBusy(false);
                return () => controller.abort();
            }
            const q = new URLSearchParams({ sessionId, scope: scope === 'all' ? 'all' : 'session', from: String(range.from), to: String(range.to), offset: String(offset), limit: String(50) });
            if (scope !== 'all' && scope !== 'current')
                q.set('targetSessionId', scope);
            if (mode === 'usage' && usageKind !== 'all')
                q.set('kind', usageKind);
            if (mode === 'usage')
                q.set('currency', usageCurrency);
            if (model) {
                const r = JSON.parse(model);
                q.set('provider', r.provider);
                q.set('model', r.model);
            }
            if (kind)
                q.set('kind', kind);
            if (status)
                q.set('status', status);
            jsonFetch(`/api/roleplay/${mode === 'usage' ? 'usage' : 'logs'}?${q}`, { signal: controller.signal }).then(value => { if (live)
                setData(value); }).catch(e => { if (live)
                setError(errorMessage(e)); }).finally(() => { if (live)
                setBusy(false); });
            return () => { live = false; controller.abort(); };
        }, [sessionId, mode, preset, scope, model, kind, usageKind, status, offset, revision, customApplied, usageCurrency]);
        React.useEffect(() => {
            if (mode !== 'usage' || usageTab !== 'requests')
                return;
            let live = true;
            const controller = new AbortController(), range = preset === 'custom' ? customApplied : panelRange(preset, custom);
            if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to) || range.from >= range.to)
                return () => controller.abort();
            const q = new URLSearchParams({ sessionId, scope: scope === 'all' ? 'all' : 'session', from: String(range.from), to: String(range.to), offset: String(offset), limit: String(50), currency: usageCurrency });
            if (scope !== 'all' && scope !== 'current')
                q.set('targetSessionId', scope);
            if (model) {
                const route = JSON.parse(model);
                q.set('provider', route.provider);
                q.set('model', route.model);
            }
            if (usageKind !== 'all')
                q.set('kind', usageKind);
            setRequestBusy(true);
            jsonFetch(`/api/roleplay/usage-requests?${q}`, { signal: controller.signal }).then(value => { if (live)
                setRequests(value); }).catch(e => { if (live)
                setRequests({ error: errorMessage(e), rows: [] }); }).finally(() => { if (live)
                setRequestBusy(false); });
            return () => { live = false; controller.abort(); };
        }, [sessionId, mode, usageTab, preset, scope, model, usageKind, offset, revision, customApplied, usageCurrency]);
        React.useEffect(() => { if (mode === 'usage')
            setOffset(0); }, [sessionId, mode, preset, scope, model, usageKind, customApplied, usageCurrency]);
        React.useEffect(() => { if (mode !== 'logs')
            return; const timer = setInterval(() => setRevision(v => v + 1), 10000); return () => clearInterval(timer); }, [mode]);
        React.useEffect(() => { if (!data?.coverage?.scanning && !data?.fx?.syncing)
            return; const timer = setInterval(() => setRevision(v => v + 1), 3000); return () => clearInterval(timer); }, [data?.coverage?.scanning, data?.fx?.syncing]);
        const setDisplayCurrency = (next) => { setUsageCurrency(next); try {
            localStorage.setItem('dsh-roleplay-usage-currency', next);
        }
        catch { } };
        const syncFx = async () => { setFxBusy(true); try {
            const result = await jsonFetch('/api/roleplay/exchange-rate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, action: 'sync' }) });
            setRevision(v => v + 1);
            if (result.fx?.error)
                toast('汇率更新失败：' + result.fx.error);
            else
                toast('汇率已更新');
        }
        catch (e) {
            toast(errorMessage(e));
        }
        finally {
            setFxBusy(false);
        } };
        const select = (label, value, handler, options) => React.createElement('label', { className: 'dsh-rp-filter' }, React.createElement('span', null, label), React.createElement('select', { 'aria-label': label, value, onChange: (e) => { handler(e.target.value); setOffset(0); } }, options.map(([v, t]) => React.createElement('option', { key: v, value: v }, t))));
        const total = data?.totals;
        const metric = (label, value, caption, note) => React.createElement('div', { className: 'dsh-rp-metric', key: label }, React.createElement('span', null, label), React.createElement('strong', null, value), caption ? React.createElement('small', null, caption) : null, note ? React.createElement('small', { className: 'dsh-rp-muted' }, note) : null);
        const tokenValue = (scope, field) => statNumber(scope?.[field] ?? 0);
        const tokenNote = (scope, field) => { const missing = Number(scope?.unknownFields?.[field] ?? 0); return missing > 0 ? `${missing} 次请求缺少${({ inputTokens: '输入', outputTokens: '输出', cacheReadTokens: '缓存读取', cacheWriteTokens: '缓存写入', totalTokens: '总' }[field] ?? field)}用量` : null; };
        const rateValue = (rate) => rate == null ? '—' : `${(rate * 100).toFixed(1)}%`;
        const rateNote = (scope) => { const incomplete = Number(scope?.cacheRateIncompleteCalls ?? 0); return incomplete > 0 ? `缓存命中率排除 ${incomplete} 次缺少完整输入或缓存数据的请求` : scope?.cacheHitRate == null || !((scope?.cacheRateCalls ?? 0) > 0) ? '暂无数据' : null; };
        const costView = (scope) => usageCostPresentation(scope, data?.currency, data?.fx);
        const aggregateUsageRow = (r, providerOnly = false) => {
            const cost = costView(r);
            const embeddingView = usageKind === 'embedding';
            return React.createElement('tr', { key: JSON.stringify([r.provider, r.model]) }, React.createElement('td', null, providerOnly
                ? React.createElement('strong', null, r.provider ?? '未知供应商')
                : React.createElement(React.Fragment, null, React.createElement('strong', null, r.model ?? '未知模型'), React.createElement('div', { className: 'dsh-rp-muted' }, r.provider ?? '未知供应商'))), React.createElement('td', null, r.calls), React.createElement('td', null, tokenValue(r, 'inputTokens'), tokenNote(r, 'inputTokens') ? React.createElement('small', { className: 'dsh-rp-muted' }, tokenNote(r, 'inputTokens')) : null), React.createElement('td', null, embeddingView ? '不适用' : tokenValue(r, 'outputTokens'), !embeddingView && tokenNote(r, 'outputTokens') ? React.createElement('small', { className: 'dsh-rp-muted' }, tokenNote(r, 'outputTokens')) : null), React.createElement('td', null, embeddingView ? '不适用' : rateValue(r.cacheHitRate), embeddingView ? null : React.createElement('small', { className: 'dsh-rp-muted' }, `命中 ${tokenValue(r, 'cacheReadTokens')} tokens${rateNote(r) ? ' · ' + rateNote(r) : ''}`)), React.createElement('td', null, cost.value === null ? 'N/A' : `${data?.currency} ${statNumber(cost.value)}`, React.createElement('small', { className: 'dsh-rp-muted' }, cost.caption)), React.createElement('td', null, `${Math.round(r.successes / Math.max(1, r.calls) * 100)}%`), React.createElement('td', null, r.timedCalls ? `${(r.durationMs / r.timedCalls / 1000).toFixed(2)}s` : '—'), React.createElement('td', null, embeddingView ? '不适用' : r.tokensPerSecond == null ? '—' : `${Number(r.tokensPerSecond).toFixed(1)} tok/s`, embeddingView ? null : r.speedCalls ? React.createElement('small', { className: 'dsh-rp-muted' }, `${r.speedCalls} 次有效生成`) : React.createElement('small', { className: 'dsh-rp-muted' }, '缺少数据')));
        };
        const modelUsageRow = (r) => aggregateUsageRow(r);
        const providerUsageRow = (r) => aggregateUsageRow(r, true);
        const pricingNote = (status) => ({ 'missing-catalog': '缺少目录价格', 'missing-manual': '尚未设置单价', 'missing-usage': '缺少用量数据', 'missing-exchange-rate': '缺少汇率', 'unknown-context-tier': '缺少分档计价所需用量', 'unsupported-tier': '暂不支持此价格分档', 'missing-cacheRead-rate': '缺少缓存命中单价', 'missing-cacheWrite-rate': '缺少缓存创建单价', 'missing-input-rate': '缺少输入单价', 'missing-output-rate': '缺少输出单价' }[status] ?? '缺少单价或用量');
        const requestUsageRow = (r) => {
            const embedding = r.kind === 'embedding' || usageKind === 'embedding';
            const purposeLabel = { index: '向量索引', query: '向量查询', test: '接入测试' }[r.purpose ?? ''] ?? '向量嵌入';
            const providerUsage = r.providerUsage ? Object.entries(r.providerUsage).map(([key, value]) => `${key}=${String(value)}`).join(' · ') : '';
            return React.createElement('tr', { key: r.id }, React.createElement('td', null, statTime(r.startedAt)), React.createElement('td', null, React.createElement('strong', null, r.model ?? '未知模型'), React.createElement('div', { className: 'dsh-rp-muted' }, r.provider ?? '未知供应商'), embedding ? React.createElement('small', { className: 'dsh-rp-muted' }, purposeLabel) : null), React.createElement('td', null, r.usage ? `${statNumber(r.usage.inputTokens)} / ${statNumber(r.usage.cacheReadTokens)}` : 'N/A'), React.createElement('td', null, embedding ? '不适用' : r.usage ? statNumber(r.usage.outputTokens) : 'N/A'), React.createElement('td', null, r.cost == null ? 'N/A' : `${requests?.currency ?? data?.currency ?? ''} ${statNumber(r.cost)}`, r.cost == null ? React.createElement('small', { className: 'dsh-rp-muted' }, pricingNote(r.pricingStatus)) : null), React.createElement('td', null, `${r.durationMs == null ? '—' : (r.durationMs / 1000).toFixed(2) + 's'} / ${embedding ? '不适用' : r.firstTokenMs == null ? '—' : (r.firstTokenMs / 1000).toFixed(2) + 's'}`), React.createElement('td', null, React.createElement('span', { className: `dsh-rp-status-badge dsh-rp-state-${r.status}` }, telemetryStatus[r.status] ?? r.status ?? '未知'), r.error ? React.createElement('small', { className: 'dsh-rp-muted' }, r.error) : null), React.createElement('td', null, r.sessionLabel ?? r.ownerSessionId ?? '—', providerUsage ? React.createElement('small', { className: 'dsh-rp-muted' }, `providerUsage: ${providerUsage}`) : null));
        };
        return React.createElement('div', { className: 'dsh-rp-panel dsh-rp-telemetry' }, React.createElement('div', { className: 'dsh-rp-section-title' }, mode === 'usage' ? '使用统计' : '运行日志'), React.createElement('p', { className: 'dsh-rp-muted' }, mode === 'usage' ? '按真实请求统计，包含重新生成、重试、失败调用及辅助子代理。输入与缓存分开计算。' : '查看运行状态与诊断信息。这里不展示正文、思考、工具参数或密钥。'), React.createElement('div', { className: 'dsh-rp-filters' }, select('范围', scope, setScope, [['current', '当前会话（含子代理）'], ['all', '全部角色扮演会话'], ...(data?.sessions ?? []).filter(s => s.id !== sessionId).map(s => [s.id, s.label])]), select('时间', preset, setPreset, [['1h', '1小时'], ['24h', '24小时'], ['3d', '三天'], ['week', '本周'], ['month', '本月'], ['year', '今年'], ['all', '全部'], ['custom', '自定义']]), mode === 'usage' ? React.createElement(React.Fragment, null, select('请求类型', usageKind, value => setUsageKind(value), [['all', '全部'], ['generation', '文本生成'], ['embedding', '向量嵌入']]), select('展示币种', usageCurrency, setDisplayCurrency, [['USD', 'USD'], ['CNY', '人民币 CNY']]), select('模型', model, setModel, [['', '全部模型'], ...(data?.models ?? []).map(r => [JSON.stringify({ provider: r.provider, model: r.model }), `${r.provider ?? '未知'} / ${r.model ?? '未知'}`])])) : React.createElement(React.Fragment, null, select('类型', kind, setKind, [['', '全部类型'], ...Object.entries(telemetryKind).map(([k, v]) => [k, v])]), select('状态', status, setStatus, [['', '全部状态'], ...Object.entries(telemetryStatus).map(([k, v]) => [k, v])])), React.createElement('button', { className: 'dsh-rp-btn', disabled: busy, onClick: () => setRevision(v => v + 1) }, busy ? '读取中…' : '刷新')), preset === 'custom' ? React.createElement('div', { className: 'dsh-rp-row' }, React.createElement('input', { type: 'datetime-local', 'aria-label': '开始时间', value: custom.from, onChange: (e) => setCustom({ ...custom, from: e.target.value }) }), React.createElement('span', null, '至'), React.createElement('input', { type: 'datetime-local', 'aria-label': '结束时间', value: custom.to, onChange: (e) => setCustom({ ...custom, to: e.target.value }) }), React.createElement('button', { className: 'dsh-rp-btn', onClick: () => { const r = panelRange('custom', custom); if (!Number.isFinite(r.from) || !Number.isFinite(r.to) || r.from >= r.to) {
                toast('请选择有效时间范围');
                return;
            } setCustomApplied(r); setOffset(0); } }, '应用')) : null, error ? React.createElement('div', { className: 'dsh-rp-error', role: 'alert' }, error) : null, data?.coverage?.scanning ? React.createElement('div', { className: 'dsh-rp-scan-progress', role: 'status' }, `正在回填历史记录 · ${data.coverage.scannedSessions ?? 0}/${data.coverage.totalSessions ?? 0} 个会话。当前数字尚不完整，完成后自动更新。`) : null, data?.fx && mode === 'usage' ? React.createElement('div', { className: 'dsh-rp-row dsh-rp-muted' }, React.createElement('span', null, `汇率来源：${data.fx.source ?? '未知'} · 更新时间：${data.fx.rateAt ? statTime(data.fx.rateAt) : data.fx.fetchedAt ? statTime(data.fx.fetchedAt) : '未知'}${data.fx.stale ? ' · 缓存已过期，继续显示上次成功结果' : ''}${data.fx.syncing ? ' · 正在更新…' : ''} · `), React.createElement('a', { href: 'https://www.exchangerate-api.com', target: '_blank', rel: 'noreferrer' }, 'Rates By Exchange Rate API'), React.createElement('button', { className: 'dsh-rp-btn', disabled: fxBusy || data.fx.syncing, onClick: syncFx }, fxBusy || data.fx.syncing ? '更新中…' : '更新汇率')) : null, data?.fx?.error ? React.createElement('div', { className: 'dsh-rp-error' }, data.fx.error) : null, data?.fx && data.fx.rate == null && data.currency === 'CNY' ? React.createElement('div', { className: 'dsh-rp-error' }, '缺少 USD/CNY 汇率，成本显示 N/A；已保留上次成功结果。') : null, data?.coverage?.failedSessions ? React.createElement('div', { className: 'dsh-rp-error' }, `${data.coverage.failedSessions} 个历史来源读取失败，当前统计不完整；可刷新重试。`) : null, data?.coverage?.persistenceFailures ? React.createElement('div', { className: 'dsh-rp-error' }, '部分调用记录写入失败，统计可能不完整，请检查服务器存储。') : null, data?.coverage?.unattributedCalls ? React.createElement('p', { className: 'dsh-rp-muted' }, `${data.coverage.unattributedCalls} 次原生调用未提供会话身份，已保留诊断记录，尚未归入角色扮演合计。`) : null, mode === 'usage' && total ? React.createElement(React.Fragment, null, React.createElement('div', { className: 'dsh-rp-metrics' }, metric('请求次数', statNumber(total.calls), `成功 ${total.successes} · 失败/取消/截断 ${total.failures}`), metric('输入 · 未缓存', tokenValue(total, 'inputTokens'), 'tokens', tokenNote(total, 'inputTokens')), metric('输出', tokenValue(total, 'outputTokens'), 'tokens', tokenNote(total, 'outputTokens')), metric('缓存命中率', rateValue(total.cacheHitRate), `命中 ${tokenValue(total, 'cacheReadTokens')} tokens`, rateNote(total)), metric('估算成本', costView(total).value === null ? 'N/A' : `${data?.currency} ${statNumber(costView(total).value)}`, costView(total).caption === '全部请求均有单价和用量' ? '按当前定价配置估算' : costView(total).caption)), React.createElement('nav', { className: 'dsh-rp-usage-tabs', role: 'tablist' }, [['requests', '请求日志'], ['providers', '供应商统计'], ['models', '模型统计']].map(([id, label]) => React.createElement('button', { className: 'dsh-rp-btn', key: id, role: 'tab', 'aria-selected': usageTab === id, onClick: () => { setUsageTab(id); setOffset(0); } }, label))), usageTab === 'models' ? React.createElement(React.Fragment, null, React.createElement(UsageChart, { data }), React.createElement('div', { className: 'dsh-rp-section-title' }, '模型统计'), React.createElement('div', { className: 'dsh-rp-table-wrap' }, React.createElement('table', { className: 'dsh-rp-table' }, React.createElement('thead', null, React.createElement('tr', null, ['模型 / 供应商', '请求', '输入', '输出', '缓存命中率', '估算成本', '成功率', '平均耗时', '生成速度'].map(h => React.createElement('th', { key: h }, h)))), React.createElement('tbody', null, (data.models ?? []).map(modelUsageRow)))), React.createElement('p', { className: 'dsh-rp-muted' }, '生成速度不含首 token 等待，仅统计数据完整的请求。'), React.createElement('details', { className: 'dsh-rp-price-details' }, React.createElement('summary', null, '模型定价'), React.createElement(PricePanel, { sessionId, models: data.models, onSaved: () => setRevision(v => v + 1) }))) : null, usageTab === 'providers' ? React.createElement(React.Fragment, null, React.createElement('div', { className: 'dsh-rp-section-title' }, '供应商统计'), React.createElement('div', { className: 'dsh-rp-table-wrap' }, React.createElement('table', { className: 'dsh-rp-table' }, React.createElement('thead', null, React.createElement('tr', null, ['供应商', '请求', '输入', '输出', '缓存命中率', '估算成本', '成功率', '平均耗时', '生成速度'].map(h => React.createElement('th', { key: h }, h)))), React.createElement('tbody', null, (data.providers ?? []).map(providerUsageRow)))), React.createElement('p', { className: 'dsh-rp-muted' }, '生成速度不含首 token 等待，仅统计数据完整的请求。')) : null, usageTab === 'requests' ? React.createElement(React.Fragment, null, React.createElement('div', { className: 'dsh-rp-section-title' }, '请求日志'), requestBusy ? React.createElement('div', { className: 'dsh-rp-muted', role: 'status' }, '正在读取请求记录…') : null, requests?.error ? React.createElement('div', { className: 'dsh-rp-error', role: 'alert' }, requests.error) : null, React.createElement('div', { className: 'dsh-rp-table-wrap' }, React.createElement('table', { className: 'dsh-rp-table' }, React.createElement('thead', null, React.createElement('tr', null, ['时间', '供应商 / 模型', '输入 / 缓存', '输出', '成本', '耗时 / 首 token', '状态', '所属会话'].map(h => React.createElement('th', { key: h }, h)))), React.createElement('tbody', null, (requests?.rows ?? []).map(requestUsageRow)))), !requests?.rows?.length && !requestBusy ? React.createElement('div', { className: 'dsh-rp-empty' }, '没有符合条件的请求记录') : null, React.createElement('div', { className: 'dsh-rp-row' }, React.createElement('span', { className: 'dsh-rp-muted' }, `共 ${requests?.total ?? 0} 条`), React.createElement('button', { className: 'dsh-rp-btn', disabled: offset === 0 || requestBusy, onClick: () => setOffset(Math.max(0, offset - 50)) }, '上一页'), React.createElement('button', { className: 'dsh-rp-btn', disabled: offset + 50 >= (requests?.total ?? 0) || requestBusy, onClick: () => setOffset(offset + 50) }, '下一页'))) : null)
            : null, mode === 'logs' ? React.createElement(React.Fragment, null, React.createElement('div', { className: 'dsh-rp-table-wrap' }, React.createElement('table', { className: 'dsh-rp-table' }, React.createElement('thead', null, React.createElement('tr', null, ['运行时间', '任务 / 模型', '状态', '耗时 / 首 token', '输入 / 输出 / 缓存', '详情'].map(h => React.createElement('th', { key: h }, h)))), React.createElement('tbody', null, (data?.rows ?? []).map(r => React.createElement('tr', { key: r.id }, React.createElement('td', null, statTime(r.startedAt)), React.createElement('td', null, React.createElement('strong', null, r.label ?? telemetryKind[r.kind] ?? r.kind), React.createElement('div', { className: 'dsh-rp-muted' }, `${r.provider ?? '—'} / ${r.model ?? '—'}`)), React.createElement('td', null, React.createElement('span', { className: `dsh-rp-status-badge dsh-rp-state-${r.status}` }, telemetryStatus[r.status] ?? r.status)), React.createElement('td', null, `${r.durationMs == null ? 'N/A' : (r.durationMs / 1000).toFixed(2) + 's'} / ${r.firstTokenMs == null ? 'N/A' : (r.firstTokenMs / 1000).toFixed(2) + 's'}`), React.createElement('td', null, r.usage ? `${statNumber(r.usage.inputTokens)} / ${statNumber(r.usage.outputTokens)} / ${statNumber(r.usage.cacheReadTokens)}` : 'N/A', r.usageNote ? React.createElement('small', { className: 'dsh-rp-muted' }, r.usageNote) : null), React.createElement('td', null, r.fallback ? formatFallbackText(r.fallback) : r.error ?? (r.progress ? `${r.progress.done ?? 0}/${r.progress.total ?? 0}` : '—'))))))), !data?.rows?.length && !busy ? React.createElement('div', { className: 'dsh-rp-empty' }, '没有符合条件的运行记录') : null, React.createElement('div', { className: 'dsh-rp-row' }, React.createElement('span', { className: 'dsh-rp-muted' }, `共 ${data?.total ?? 0} 条`), React.createElement('button', { className: 'dsh-rp-btn', disabled: offset === 0 || busy, onClick: () => setOffset(Math.max(0, offset - 50)) }, '上一页'), React.createElement('button', { className: 'dsh-rp-btn', disabled: offset + 50 >= (data?.total ?? 0) || busy, onClick: () => setOffset(offset + 50) }, '下一页'))) : null, React.createElement('p', { className: 'dsh-rp-muted' }, '历史数据来自保存的调用事件；未留存的历史用量无法补算。新调用通过 DSH 原生接口实时记录。'), total?.unknownUsage ? React.createElement('p', { className: 'dsh-rp-muted' }, '部分用量可能不准确或缺少数据') : null);
    }
    return { TelemetryPanel, PricePanel, UsageChart };
}
