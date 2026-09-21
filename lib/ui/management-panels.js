// Generated from runtime/alpha3/src/ui/management-panels.ts; edit the TypeScript source.
import { fetchRoleplayText, updatePanelDraft } from './panel-state.js';
import { buildModelSettings, buildReasoningEffortOptions, sortLibraryResources, isCardReadableResource, MODEL_PURPOSE_IDS, } from './settings-projection.js';
const errorMessage = (error) => error && typeof error === 'object' && 'message' in error ? error.message : error;
export function createManagementPanels({ React, sessionDrafts, jsonFetch, toast, confirmWithDialog, btn }) {
    function CharacterClusterPanel({ sessionId }) {
        const [globalRoute, setGlobalRoute] = React.useState(null);
        const [dataValue, setData] = React.useState(null), [modelsValue, setModels] = React.useState(null), [draftValue, setDraft] = React.useState(null), [error, setError] = React.useState(''), [saving, setSaving] = React.useState(false), [revision, setRevision] = React.useState(0);
        const data = dataValue, models = modelsValue, draft = draftValue;
        React.useEffect(() => {
            let live = true;
            setData(null);
            setDraft(null);
            setError('');
            Promise.all([
                jsonFetch('/api/roleplay/character-cluster?sessionId=' + encodeURIComponent(sessionId)),
                jsonFetch('/api/roleplay/models?sessionId=' + encodeURIComponent(sessionId))
            ])
                .then(([d, m]) => {
                if (!live)
                    return;
                setData(d);
                setModels(m);
                setDraft(d.session);
                setGlobalRoute(d.global.defaultRoute ?? null);
            })
                .catch(e => {
                if (live)
                    setError(String(errorMessage(e)));
            });
            return () => {
                live = false;
            };
        }, [sessionId, revision]);
        const save = async (scope) => {
            if (saving)
                return;
            setSaving(true);
            try {
                const d = await jsonFetch('/api/roleplay/character-cluster', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId,
                        scope,
                        settings: scope === 'global' ? {
                            defaultRoute: globalRoute
                        } : draft,
                        expectedRevision: scope === 'global' ? data.global.revision : data.settings.revision
                    })
                });
                setData(d);
                if (scope === 'session')
                    setDraft(d.session);
                else
                    setGlobalRoute(d.global.defaultRoute ?? null);
                toast(scope === 'global' ? '默认角色模型已保存，对所有对话生效' : '角色集群开关与人物设置已保存，仅对当前对话生效');
            }
            catch (e) {
                toast('保存失败：' + String(errorMessage(e)));
            }
            finally {
                setSaving(false);
            }
        };
        const h = React.createElement, catalog = models?.catalog ?? [];
        const selector = (label, route, onChange, isDefault = false) => {
            const effective = route?.main ? {
                ...models.main, ...route
            } : route ?? (isDefault ? models.main : data.settings.defaultRoute?.main ? {
                ...models.main, ...data.settings.defaultRoute
            } : data.settings.defaultRoute ?? models.main);
            const model = catalog.find(m => m.provider === effective?.provider && m.model === effective?.model);
            const value = route?.main ? 'main' : route ? `${route.provider}\u0000${route.model}` : '';
            const options = buildReasoningEffortOptions(model, route?.reasoningEffort);
            return h('div', {
                className: 'dsh-rp-item', key: label
            }, h('div', {
                className: 'dsh-rp-item-head'
            }, label), h('div', {
                style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))',
                    gap: '12px',
                    marginTop: '10px'
                }
            }, h('label', null, '模型', h('select', {
                className: 'dsh-rp-input',
                style: {
                    width: '100%', minWidth: 0
                },
                'aria-label': label + '模型',
                value,
                onChange: (e) => {
                    const v = e.target.value;
                    if (!v)
                        onChange(null);
                    else if (v === 'main')
                        onChange({
                            main: true
                        });
                    else {
                        const [provider, model] = v.split('\u0000');
                        onChange({
                            provider, model
                        });
                    }
                }
            }, h('option', {
                value: ''
            }, isDefault ? '跟随主代理模型' : '使用集群默认模型'), h('option', {
                value: 'main'
            }, '与主代理相同（独立角色代理）'), catalog.map(m => h('option', {
                key: m.provider + ':' + m.model, value: `${m.provider}\u0000${m.model}`
            }, `${m.label ?? m.model} · ${m.provider}`)))), h('label', null, '思考强度', h('select', {
                className: 'dsh-rp-input',
                style: {
                    width: '100%', minWidth: 0
                },
                'aria-label': label + '思考强度',
                value: route?.reasoningEffort ?? '',
                disabled: !model,
                onChange: (e) => onChange({
                    ...route ?? effective, reasoningEffort: e.target.value || undefined
                })
            }, options.map(o => h('option', {
                key: o.id || 'default', value: o.id
            }, o.name))))));
        };
        return h('div', {
            className: 'dsh-rp-panel', 'data-roleplay-character-cluster': true
        }, h('div', {
            className: 'dsh-rp-row'
        }, h('h4', {
            style: {
                flex: 1, margin: 0
            }
        }, '角色 agent 集群'), btn('刷新人物与设置', () => setRevision(r => r + 1), {
            disabled: saving
        })), h('p', {
            className: 'dsh-rp-muted'
        }, '让主要人物先独立推演自己的行动与台词，再由主笔协调成故事。开关与人物单独设置仅当前对话生效；默认模型对所有对话生效，剧情资料始终独立。'), error ? h('p', {
            className: 'dsh-rp-error', role: 'alert'
        }, error) : !draft ? h('p', {
            role: 'status'
        }, '正在加载角色集群…') : h('fieldset', {
            disabled: saving, style: {
                border: 0, padding: 0, margin: 0, minWidth: 0
            }
        }, h('label', {
            className: 'dsh-rp-row'
        }, h('input', {
            type: 'checkbox',
            checked: draft.enabled,
            onChange: (e) => setDraft({
                ...draft, enabled: e.target.checked
            })
        }), '开启角色 agent 集群模式'), h('p', {
            className: 'dsh-rp-muted'
        }, '读卡回合不运行。每位出场主要人物各自运行一次，可按需查阅历史；失败或超时会使用主代理模型再试一次，仍失败由主笔自由发挥。开启会增加请求用量和正文等待时间。'), h('section', {
            className: 'dsh-rp-cluster-default', 'aria-label': '角色集群默认模型（全局）'
        }, h('span', {
            className: 'dsh-rp-cluster-scope'
        }, '全局默认 · 所有对话'), selector('角色集群默认模型（全局）', globalRoute, setGlobalRoute, true), h('p', {
            className: 'dsh-rp-muted'
        }, '所有未单独指定模型的人物都使用此默认值；保存不会开启其他对话的集群。'), Number(data.global.revision) === 0 && data.session.defaultRoute ? h('p', {
            className: 'dsh-rp-muted'
        }, '当前对话暂时沿用旧版默认模型；保存一次全局选择后，所有对话统一继承全局默认。') : null, h('div', {
            className: 'dsh-rp-row'
        }, btn(saving ? '保存中…' : '保存全局默认模型', () => save('global'), {
            disabled: saving
        }))), h('section', {
            className: 'dsh-rp-cluster-characters', 'aria-label': '人物单独模型'
        }, h('h4', null, '人物单独模型'), h('p', {
            className: 'dsh-rp-muted'
        }, '仅当前对话生效。选择“使用集群默认模型”即可跟随上方已保存的全局默认设置。'), data.characters.map(character => selector(character.name, draft.characters?.[character.id], route => setDraft({
            ...draft, characters: {
                ...draft.characters, [character.id]: route
            }
        }))), !data.characters.length ? h('p', {
            className: 'dsh-rp-muted'
        }, '当前还没有独立人物设定。读卡后会在这里显示；故事中新登记的重要人物也会加入。') : null), h('div', {
            className: 'dsh-rp-row'
        }, btn(saving ? '保存中…' : '保存当前对话设置', () => save('session'), {
            disabled: saving
        }))));
    }
    function ModelPanel({ sessionId }) {
        const [data, setData] = React.useState(null), [scope, setScope] = React.useState('session'), [saving, setSaving] = React.useState(false), [allMain, setAllMain] = React.useState(false), [routes, setRoutes] = React.useState({});
        React.useEffect(() => {
            let live = true;
            jsonFetch(`/api/roleplay/models?sessionId=${encodeURIComponent(sessionId)}`).then(value => live
                && setData(value)).catch(e => live
                && setData({
                    error: String(errorMessage(e))
                }));
            return () => {
                live = false;
            };
        }, [sessionId]);
        React.useEffect(() => {
            if (!data)
                return;
            const draft = sessionDrafts.get(`${sessionId}:models-${scope}`);
            const source = draft?.dirty
                ? draft.settings
                : scope === 'global'
                    ? data.global
                    : data.session && !data.session.inherit
                        ? data.session
                        : data.effective;
            setAllMain(source?.allMain === true);
            setRoutes({
                ...(source?.routes ?? {})
            });
        }, [data, scope]);
        const rememberModel = (nextAllMain, nextRoutes) => {
            const prior = sessionDrafts.get(`${sessionId}:models-${scope}`);
            updatePanelDraft(sessionDrafts, sessionId, `models-${scope}`, {
                dirty: true,
                settings: buildModelSettings(nextAllMain, nextRoutes),
                baseRevision: prior?.dirty ? prior.baseRevision : data?.[scope]?.revision ?? 0
            });
            setAllMain(nextAllMain);
            setRoutes(nextRoutes);
        };
        const save = async () => {
            if (saving)
                return;
            setSaving(true);
            try {
                const settings = buildModelSettings(allMain, routes), draft = sessionDrafts.get(`${sessionId}:models-${scope}`);
                const updated = await jsonFetch('/api/roleplay/models', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId, scope, settings, expectedRevision: draft?.baseRevision ?? data?.[scope]?.revision ?? 0
                    })
                });
                if (sessionDrafts.get(`${sessionId}:models-${scope}`) === draft)
                    sessionDrafts.delete(`${sessionId}:models-${scope}`);
                setData(updated);
                toast('模型设置已保存');
            }
            catch (e) {
                toast('模型保存失败，草稿已保留：' + String(errorMessage(e)));
            }
            finally {
                setSaving(false);
            }
        };
        const clearSession = async () => {
            if (scope !== 'session' || saving)
                return;
            setSaving(true);
            const prior = sessionDrafts.get(`${sessionId}:models-session`);
            try {
                const updated = await jsonFetch('/api/roleplay/models', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId, scope: 'session', settings: null, expectedRevision: data?.session?.revision ?? 0
                    })
                });
                if (sessionDrafts.get(`${sessionId}:models-session`) === prior)
                    sessionDrafts.delete(`${sessionId}:models-session`);
                setData(updated);
                toast('已恢复全局模型设置');
            }
            catch (e) {
                toast('恢复全局设置失败：' + String(errorMessage(e)));
            }
            finally {
                setSaving(false);
            }
        };
        if (!data)
            return React.createElement('div', {
                className: 'dsh-rp-muted'
            }, '加载模型…');
        if (data.error)
            return React.createElement('div', {
                className: 'dsh-rp-error'
            }, data.error);
        const catalog = Array.isArray(data.catalog) ? data.catalog : [];
        const routeValue = (route) => route ? `${route.provider}\u0000${route.model}` : '';
        const parseRoute = (value) => {
            if (!value)
                return null;
            const [provider, ...modelParts] = value.split('\u0000');
            return {
                provider, model: modelParts.join('\u0000')
            };
        };
        const mainRoute = data.main ?? data.effective?.main ?? {};
        return React.createElement('fieldset', {
            className: 'dsh-rp-panel', disabled: saving, style: {
                border: 0, margin: 0, minWidth: 0
            }
        }, React.createElement('h4', null, '模型路由'), React.createElement('label', {
            className: 'dsh-rp-row'
        }, '保存范围', React.createElement('select', {
            className: 'dsh-rp-input',
            value: scope,
            onChange: (e) => setScope(e.target.value)
        }, React.createElement('option', {
            value: 'session'
        }, '当前会话'), React.createElement('option', {
            value: 'global'
        }, '全局'))), React.createElement('label', {
            className: 'dsh-rp-row'
        }, React.createElement('input', {
            type: 'checkbox',
            checked: allMain,
            onChange: (e) => rememberModel(e.target.checked, routes)
        }), '全部使用主模型（保留用途配置）'), React.createElement('div', {
            className: 'dsh-rp-muted'
        }, `当前主模型：${data.main?.model ?? data.effective?.main?.model ?? '未设置'}`), MODEL_PURPOSE_IDS.map(id => {
            const purpose = (data.purposes ?? []).find(p => p.id === id) ?? {
                id, label: id
            };
            const current = routes[id] ?? null;
            const model = catalog.find(route => route.provider === current?.provider && route.model === current?.model);
            const effortOptions = buildReasoningEffortOptions(model, current?.reasoningEffort);
            const followsMain = allMain || !current || (current.provider === mainRoute.provider && current.model === mainRoute.model);
            const updateEffort = (effort) => rememberModel(allMain, {
                ...routes, [id]: {
                    ...current, reasoningEffort: effort || undefined
                }
            });
            return React.createElement('div', {
                className: 'dsh-rp-item', key: id
            }, React.createElement('div', {
                className: 'dsh-rp-item-head'
            }, purpose.label ?? id, React.createElement('span', {
                className: 'dsh-rp-muted'
            }, current?.model ?? '跟随主模型')), React.createElement('select', {
                className: 'dsh-rp-input',
                value: routeValue(current),
                onChange: (e) => rememberModel(allMain, {
                    ...routes, [id]: parseRoute(e.target.value)
                })
            }, React.createElement('option', {
                value: ''
            }, '跟随主模型'), catalog.map(route => React.createElement('option', {
                key: `${route.provider}:${route.model}`, value: `${route.provider}\u0000${route.model}`
            }, `${route.label ?? route.model} · ${route.provider}`))), React.createElement('label', {
                className: 'dsh-rp-row'
            }, '思考等级', React.createElement('select', {
                className: 'dsh-rp-input',
                value: current?.reasoningEffort ?? '',
                disabled: followsMain || !model,
                'aria-label': `${purpose.label ?? id}思考等级`,
                onChange: (e) => updateEffort(e.target.value)
            }, effortOptions.map(option => React.createElement('option', {
                key: option.id || 'default', value: option.id
            }, option.name)))), followsMain ? React.createElement('span', {
                className: 'dsh-rp-muted'
            }, '跟随主模型思考等级（专用配置仍保留）') : !model && current?.reasoningEffort ? React.createElement('span', {
                className: 'dsh-rp-error'
            }, `当前思考等级“${current.reasoningEffort}”的模型不在目录中，已保留原设置；请选择模型后再调整。`) : current?.reasoningEffort
                && effortOptions.some(option => option.unknown) ? React.createElement('span', {
                className: 'dsh-rp-error'
            }, '当前思考等级不在该模型目录中，已保留原设置；可选回模型默认。') : null);
        }), React.createElement('div', {
            className: 'dsh-rp-row'
        }, React.createElement('button', {
            className: 'dsh-rp-btn', disabled: saving, onClick: () => save()
        }, saving ? '保存中…' : '保存模型路由'), scope === 'session' ? React.createElement('button', {
            className: 'dsh-rp-btn', disabled: saving, onClick: clearSession
        }, '清除会话覆盖') : null));
    }
    const resourceTypeLabels = {
        'image/png': '卡片 PNG',
        'application/json': '卡片 JSON',
        'text/markdown': 'Markdown',
        'text/plain': '文本',
        png: '卡片 PNG',
        json: '卡片 JSON',
        md: 'Markdown',
        markdown: 'Markdown',
        image: '图片',
        text: '文本'
    };
    const resourceTypeLabel = (type) => resourceTypeLabels[String(type ?? '').toLowerCase()] ?? String(type ?? '其他');
    function ResourcesPanel({ sessionId }) {
        const [data, setData] = React.useState(null), [query, setQuery] = React.useState(''), [type, setType] = React.useState('all'), [preview, setPreview] = React.useState(null), [order, setOrder] = React.useState('time-desc'), [loading, setLoading] = React.useState(false);
        // Tickets invalidate late list/preview responses after cleanup or a newer request.
        const listSequence = React.useRef(0), previewSequence = React.useRef(0);
        const load = React.useCallback(async () => {
            const ticket = ++listSequence.current;
            setLoading(true);
            try {
                const { response, raw, } = await fetchRoleplayText(`/api/roleplay/resources?sessionId=${encodeURIComponent(sessionId)}`);
                const value = JSON.parse(raw);
                if (!response.ok || value.ok === false)
                    throw new Error(value.error ?? '资源刷新失败');
                if (ticket === listSequence.current)
                    setData(value);
            }
            catch (e) {
                if (ticket === listSequence.current)
                    setData(previous => ({
                        ...previous, error: String(errorMessage(e))
                    }));
            }
            finally {
                if (ticket === listSequence.current)
                    setLoading(false);
            }
        }, [sessionId]);
        React.useEffect(() => {
            setData(null);
            setPreview(null);
            void load();
            return () => {
                listSequence.current++;
                previewSequence.current++;
            };
        }, [load]);
        const allResources = data?.resources ?? [];
        const types = [...new Set(allResources.map(r => String(r.type ?? '').toLowerCase()).filter(Boolean))];
        const resources = sortLibraryResources(allResources.filter(r => (type === 'all' || String(r.type ?? '').toLowerCase() === type)
            && (!query || `${r.name} ${r.type} ${r.path}`.toLowerCase().includes(query.toLowerCase()))), order);
        const view = async (resource) => {
            const ticket = ++previewSequence.current;
            setPreview(null);
            try {
                const value = await jsonFetch(`/api/roleplay/resource?sessionId=${encodeURIComponent(sessionId)}&resourceId=${encodeURIComponent(resource.id)}`);
                if (ticket === previewSequence.current)
                    setPreview(value);
            }
            catch (e) {
                if (ticket === previewSequence.current)
                    toast('资源读取失败：' + String(errorMessage(e)));
            }
        };
        const importResource = async (resource) => {
            if (!isCardReadableResource(resource)) {
                toast('该资源不是可读角色卡，不能载入当前人设');
                return;
            }
            if (!await confirmWithDialog(document, '载入会替换当前人设，确定继续？', {
                title: '载入当前人设', confirmLabel: '确认载入'
            }))
                return;
            try {
                await jsonFetch('/api/roleplay/jobs', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId, kind: 'card-import', resourceId: resource.id
                    })
                });
                toast('已创建角色卡导入任务');
            }
            catch (e) {
                toast('导入任务失败：' + String(errorMessage(e)));
            }
        };
        const pendingItems = Array.isArray(data?.pending) ? data.pending : [];
        return React.createElement('div', {
            className: 'dsh-rp-panel'
        }, React.createElement('div', {
            className: 'dsh-rp-row'
        }, React.createElement('h4', null, '资源库'), React.createElement('button', {
            className: 'dsh-rp-btn', disabled: loading, onClick: load
        }, loading ? '刷新中…' : '刷新资源库')), React.createElement('div', {
            className: 'dsh-rp-row'
        }, React.createElement('input', {
            className: 'dsh-rp-input',
            placeholder: '搜索资源',
            value: query,
            onChange: (e) => setQuery(e.target.value)
        }), React.createElement('select', {
            className: 'dsh-rp-input',
            'aria-label': '资源类型',
            value: type,
            onChange: (e) => setType(e.target.value)
        }, React.createElement('option', {
            value: 'all'
        }, '全部类型'), types.map(value => React.createElement('option', {
            key: value, value
        }, resourceTypeLabel(value)))), React.createElement('select', {
            className: 'dsh-rp-input',
            'aria-label': '资源排序',
            value: order,
            onChange: (e) => setOrder(e.target.value)
        }, [
            ['time-desc', '修改时间：最新在前'], ['time-asc', '修改时间：最早在前'], ['name-asc', '名称：升序'], ['name-desc', '名称：降序']
        ].map(([value, label]) => React.createElement('option', {
            key: value, value
        }, label)))), loading && !data ? React.createElement('p', {
            className: 'dsh-rp-muted', role: 'status'
        }, '正在加载资源…') : null, pendingItems.length ? React.createElement('div', {
            className: 'dsh-rp-item'
        }, React.createElement('div', {
            className: 'dsh-rp-item-head'
        }, '待处理资源'), pendingItems.map((item, index) => React.createElement('div', {
            className: 'dsh-rp-row', key: index
        }, React.createElement('span', null, item.name ?? '未命名资源'), React.createElement('span', {
            className: 'dsh-rp-error'
        }, item.reason))), React.createElement('button', {
            className: 'dsh-rp-btn', onClick: load, disabled: loading
        }, '重新检查')) : null, preview ? React.createElement('pre', {
            className: 'dsh-rp-item'
        }, String(preview.text ?? preview.resource?.text ?? '')) : null, data?.error ? React.createElement('div', {
            className: 'dsh-rp-error', role: 'alert'
        }, data.error) : null, !loading && data && !data.error && !resources.length ? React.createElement('p', {
            className: 'dsh-rp-muted'
        }, '没有找到资源，可调整筛选或点击刷新。') : null, resources.map(resource => {
            const timestamp = resource.modifiedAt ?? resource.updatedAt ?? resource.createdAt;
            return React.createElement('div', {
                className: 'dsh-rp-item', key: resource.id
            }, React.createElement('div', {
                className: 'dsh-rp-item-head'
            }, resource.name, React.createElement('span', {
                className: 'dsh-rp-muted'
            }, `${resourceTypeLabel(resource.type)} · ${resource.bytes} bytes`)), React.createElement('div', {
                className: 'dsh-rp-muted'
            }, '修改时间：', timestamp && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toLocaleString() : '未知'), React.createElement('div', {
                className: 'dsh-rp-row'
            }, React.createElement('button', {
                className: 'dsh-rp-btn', onClick: () => view(resource)
            }, '查看'), React.createElement('button', {
                className: 'dsh-rp-btn',
                onClick: () => navigator.clipboard?.writeText(resource.path).then(() => toast('资源路径已复制')).catch(() => toast('复制失败'))
            }, '复制路径'), React.createElement('a', {
                className: 'dsh-rp-btn',
                href: `/api/roleplay/download?sessionId=${encodeURIComponent(sessionId)}&resourceId=${encodeURIComponent(resource.id)}`
            }, '下载'), isCardReadableResource(resource) ? React.createElement('button', {
                className: 'dsh-rp-btn', onClick: () => importResource(resource)
            }, '载入当前') : null));
        }));
    }
    function ExportPanel({ sessionId }) {
        const [jobs, setJobs] = React.useState([]), [busy, setBusy] = React.useState(false);
        const refreshSequence = React.useRef(0), refreshInFlight = React.useRef(0), mutationBusy = React.useRef(false);
        const refresh = React.useCallback(() => {
            const ticket = ++refreshSequence.current;
            refreshInFlight.current++;
            return jsonFetch(`/api/roleplay/jobs?sessionId=${encodeURIComponent(sessionId)}`).then(d => {
                if (ticket === refreshSequence.current)
                    setJobs(d.jobs ?? []);
            }).catch(() => {
            }).finally(() => {
                refreshInFlight.current--;
            });
        }, [sessionId]);
        React.useEffect(() => {
            setJobs([]);
            void refresh();
            const timer = setInterval(() => {
                if (!refreshInFlight.current)
                    void refresh();
            }, 3000);
            return () => {
                clearInterval(timer);
                refreshSequence.current++;
            };
        }, [refresh]);
        const start = async (kind) => {
            if (mutationBusy.current)
                return;
            mutationBusy.current = true;
            setBusy(true);
            try {
                await jsonFetch('/api/roleplay/jobs', {
                    method: 'POST', headers: {
                        'content-type': 'application/json'
                    }, body: JSON.stringify({
                        sessionId, kind
                    })
                });
                await refresh();
                toast('已创建导出任务');
            }
            catch (e) {
                toast('导出任务失败：' + String(errorMessage(e)));
            }
            finally {
                mutationBusy.current = false;
                setBusy(false);
            }
        };
        const action = async (action, jobId) => {
            if (mutationBusy.current)
                return;
            mutationBusy.current = true;
            setBusy(true);
            try {
                await jsonFetch('/api/roleplay/jobs', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId, action, jobId
                    })
                });
                await refresh();
                toast(action === 'cancel' ? '任务已取消' : '任务已重试');
            }
            catch (e) {
                toast('任务操作失败：' + String(errorMessage(e)));
            }
            finally {
                mutationBusy.current = false;
                setBusy(false);
            }
        };
        const kindLabels = {
            memory: '记忆与场景整理',
            'card-import': '读取角色卡',
            'card-export': '导出角色卡',
            status: '状态栏更新',
            decision: '决策建议',
            'novel-export': '导出完整小说'
        };
        const statusLabels = {
            queued: '排队中',
            running: '处理中',
            'waiting-main': '等待主模型',
            failed: '失败',
            cancelled: '已取消',
            stale: '分支已变化',
            completed: '已完成'
        };
        const canCancel = (status) => ['queued', 'running', 'waiting-main'].includes(status);
        const canRetry = (status) => ['failed', 'cancelled'].includes(status);
        const routeText = (job) => {
            const route = job.actualRoute;
            const model = route?.provider
                && route?.model ? `${route.provider}/${route.model}${route.reasoningEffort ? ` · ${route.reasoningEffort}` : ''}` : '';
            return model ? `${job.execution === 'inline' ? '当前循环' : '专用模型'}：${model}` : (job.execution === 'inline' ? '当前循环' : '专用模型');
        };
        const exportKinds = new Set(['card-export', 'novel-export']);
        const topJobs = jobs.filter(job => !job.parentJobId && exportKinds.has(job.kind));
        const exportJobIds = new Set(topJobs.map(job => job.id));
        const childJobs = jobs.filter(job => job.parentJobId && exportJobIds.has(job.parentJobId)), [showSteps, setShowSteps] = React.useState(false);
        const childrenByParent = new Map();
        if (showSteps)
            for (const child of childJobs) {
                const siblings = childrenByParent.get(child.parentJobId) ?? [];
                siblings.push(child);
                childrenByParent.set(child.parentJobId, siblings);
            }
        const visibleJobs = showSteps ? topJobs.flatMap(job => [job, ...childrenByParent.get(job.id) ?? []]) : topJobs;
        const renderJob = (job) => React.createElement('div', {
            className: job.parentJobId ? 'dsh-rp-item dsh-rp-job-step' : 'dsh-rp-item', key: job.id
        }, `${job.parentJobId ? '└─ ' : ''}${kindLabels[job.kind]
            ?? '任务'} · ${statusLabels[job.status]
            ?? '处理中'} · ${job.progress?.done
            ?? 0}/${job.progress?.total
            ?? 0}`, React.createElement('div', {
            className: 'dsh-rp-muted'
        }, routeText(job)), job.error ? React.createElement('div', {
            className: 'dsh-rp-error'
        }, String(job.error).slice(0, 500)) : null, job.status === 'stale' ? React.createElement('div', {
            className: 'dsh-rp-muted'
        }, '当前分支已变化，请重新导出') : null, React.createElement('div', {
            className: 'dsh-rp-row'
        }, job.status === 'completed' && job.resourceId ? React.createElement('a', {
            className: 'dsh-rp-btn',
            href: `/api/roleplay/download?sessionId=${encodeURIComponent(sessionId)}&resourceId=${encodeURIComponent(job.resourceId)}`
        }, '下载文件') : null, canRetry(job.status) ? React.createElement('button', {
            className: 'dsh-rp-btn', disabled: busy, onClick: () => action('retry', job.id)
        }, '重试') : null, canCancel(job.status) ? React.createElement('button', {
            className: 'dsh-rp-btn', disabled: busy, onClick: () => action('cancel', job.id)
        }, '取消') : null));
        return React.createElement('div', {
            className: 'dsh-rp-panel'
        }, React.createElement('h4', null, '导出'), React.createElement('div', {
            className: 'dsh-rp-row'
        }, React.createElement('button', {
            className: 'dsh-rp-btn', disabled: busy, onClick: () => start('card-export')
        }, '导出角色卡'), React.createElement('button', {
            className: 'dsh-rp-btn', disabled: busy, onClick: () => start('novel-export')
        }, '导出完整小说'), childJobs.length ? React.createElement('button', {
            className: 'dsh-rp-btn', onClick: () => setShowSteps(value => !value)
        }, showSteps ? '隐藏处理步骤' : '显示处理步骤') : null), visibleJobs.map(renderJob));
    }
    return {
        CharacterClusterPanel, ModelPanel, ResourcesPanel, ExportPanel
    };
}
