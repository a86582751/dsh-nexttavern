// Generated from runtime/alpha3/src/ui/memory-retrieval-panel.ts; edit the TypeScript source.
const bytes = (n) => n == null ? '—' : `${(n / 1024 ** 2).toFixed(1)} MiB`;
const protocols = {
    'openai': 'OpenAI 官方 / 兼容接口', 'dashscope-text': '阿里云 DashScope 文本', 'dashscope-multimodal': '阿里云 DashScope 多模态'
};
const hostname = (baseUrl) => {
    if (!baseUrl)
        return '未填写地址';
    try {
        return new URL(baseUrl).hostname || '未填写地址';
    }
    catch {
        return '地址格式待检查';
    }
};
const geminiEmbeddingModels = new Set(['gemini-embedding-2', 'gemini-embedding-2-preview']);
export const MEMORY_RETRIEVAL_CSS = `
.dsh-rp-retrieval{display:grid;gap:14px;margin:12px 0}
.dsh-rp-retrieval-card{display:grid;gap:12px;padding:16px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff)}
.dsh-rp-retrieval-card h5,.dsh-rp-retrieval-card p{margin:0}
.dsh-rp-retrieval-grid,.dsh-rp-provider-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:10px}
.dsh-rp-retrieval-field{display:grid;gap:5px;min-width:0}
.dsh-rp-retrieval-field input,.dsh-rp-retrieval-field select{width:100%;min-width:0;box-sizing:border-box;padding:8px}
.dsh-rp-provider-choice{text-align:left;display:grid;gap:6px;padding:12px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:10px;background:transparent;color:inherit;cursor:pointer}
.dsh-rp-provider-selected{outline:2px solid var(--dsw-alias-brand-primary,#3375db);outline-offset:1px}
.dsh-rp-provider-badge{display:inline-block;font-size:11px;border-radius:99px;padding:2px 7px;background:rgba(51,117,219,.12);margin-right:5px}
.dsh-rp-model-picker{display:flex;gap:6px;align-items:center}.dsh-rp-model-picker select{flex:1;width:0}.dsh-rp-model-picker button{flex:0 0 auto}
.dsh-rp-progress{display:grid;gap:7px}.dsh-rp-progress-bar{height:7px;overflow:hidden;border-radius:99px;background:rgba(100,120,145,.18)}
.dsh-rp-progress-bar>span{display:block;height:100%;background:var(--dsw-alias-brand-primary,#3375db)}
.dsh-rp-stale-confirm{width:min(460px,calc(100vw - 32px));margin:auto;padding:18px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:14px;color:var(--dsw-alias-label-primary,#413a3d);background:var(--dsw-alias-bg-layer-1,#fffaf6);box-shadow:0 20px 70px rgba(0,0,0,.35)}
.dsh-rp-stale-confirm::backdrop{background:rgba(0,0,0,.34);backdrop-filter:blur(2px)}
.dsh-rp-stale-confirm h6,.dsh-rp-stale-confirm p{margin:0}.dsh-rp-stale-confirm h6{font-size:16px}.dsh-rp-stale-confirm .dsh-rp-row{justify-content:flex-end;margin-top:16px}
`;
export function createMemoryRetrievalPanel({ React, jsonFetch, toast }) {
    const h = React.createElement;
    const field = (label, node) => h('label', {
        className: 'dsh-rp-retrieval-field'
    }, label, node);
    const note = (value) => h('p', {
        className: 'dsh-rp-muted'
    }, value);
    const badge = (value) => h('span', {
        className: 'dsh-rp-provider-badge', key: value
    }, value);
    function RetrievalPanel({ sessionId, view }) {
        const [data, setData] = React.useState(null);
        const [draft, setDraft] = React.useState({});
        const [dirty, setDirty] = React.useState(false), [busy, setBusy] = React.useState(null);
        const [error, setError] = React.useState(null), [modeScope, setModeScope] = React.useState('session');
        const [chunkDraft, setChunkDraft] = React.useState(''), [chunkDirty, setChunkDirty] = React.useState(false);
        const [modelLists, setModelLists] = React.useState({});
        const [sessions, setSessions] = React.useState([]);
        const [progressSession, setProgressSession] = React.useState(sessionId);
        const [progressReply, setProgressReply] = React.useState(null);
        const [progressError, setProgressError] = React.useState(null);
        const [indexConfirmation, setIndexConfirmation] = React.useState(null);
        const [staleConfirmation, setStaleConfirmation] = React.useState(null);
        const staleDialogRef = React.useRef(null), stalePreviousFocusRef = React.useRef(null);
        const chunkDirtyRef = React.useRef(false);
        const requestRef = React.useRef(0), sessionRef = React.useRef(sessionId), dirtyRef = React.useRef(false), busyRef = React.useRef(false), editRef = React.useRef(0);
        // Request epochs make late replies harmless when the selected session or provider changes.
        sessionRef.current = sessionId;
        const load = React.useCallback(async () => {
            if (busyRef.current)
                return;
            const request = ++requestRef.current;
            try {
                const next = await jsonFetch(`/api/roleplay/memory-retrieval?sessionId=${encodeURIComponent(sessionId)}`);
                if (request !== requestRef.current || sessionRef.current !== sessionId)
                    return;
                if (next.ok === false)
                    throw Error(next.error ?? '读取失败');
                setData(next);
                setError(null);
                if (next.activeProviderId)
                    setModelLists(old => ({
                        ...old, [next.activeProviderId]: next.modelList
                    }));
                if (!dirtyRef.current)
                    setDraft(previous => ({
                        ...next.providers.find(p => p.id === previous.id) ?? next.providers.find(p => p.id === next.activeProviderId) ?? next.providers[0]
                    }));
                if (!chunkDirtyRef.current)
                    setChunkDraft(String(next.chunkChars ?? 480));
            }
            catch (e) {
                if (request === requestRef.current && sessionRef.current === sessionId)
                    setError(String(e));
            }
        }, [sessionId, jsonFetch]);
        React.useEffect(() => {
            setData(null);
            setDraft({});
            setDirty(false);
            setBusy(null);
            setError(null);
            setModelLists({});
            setSessions([]);
            setChunkDraft('');
            setChunkDirty(false);
            dirtyRef.current = false;
            chunkDirtyRef.current = false;
            busyRef.current = false;
            setProgressSession(sessionId);
            setProgressReply(null);
            setModeScope('session');
            setIndexConfirmation(null);
            setStaleConfirmation(null);
            void load();
            return () => {
                requestRef.current++;
            };
        }, [sessionId]);
        React.useEffect(() => {
            setIndexConfirmation(null);
        }, [sessionId, data?.revision, data?.activeProviderId, draft.id, progressSession]);
        React.useEffect(() => {
            if (!staleConfirmation)
                return;
            if (staleConfirmation.sessionId !== sessionId || staleConfirmation.providerId !== data?.activeProviderId
                || staleConfirmation.revision !== data?.revision
                || staleConfirmation.fingerprint !== (data?.progress.fingerprint ?? '')) {
                setStaleConfirmation(null);
            }
        }, [sessionId, data?.revision, data?.activeProviderId, data?.progress.fingerprint, staleConfirmation]);
        React.useLayoutEffect(() => {
            const dialog = staleDialogRef.current;
            if (!staleConfirmation || !dialog)
                return;
            stalePreviousFocusRef.current = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null;
            try {
                if (!dialog.matches?.(':modal'))
                    dialog.showModal?.();
            }
            catch {
                dialog.setAttribute('open', '');
            }
            const cancel = dialog.querySelector?.('[data-dsh-rp-stale-cancel]');
            cancel?.focus();
            return () => {
                if (dialog.open)
                    dialog.close?.();
                const previous = stalePreviousFocusRef.current;
                stalePreviousFocusRef.current = null;
                previous?.focus?.();
            };
        }, [staleConfirmation]);
        React.useEffect(() => {
            // Poll fast only while an action is in flight; an idle panel has nothing to
            // show and each attempt is a full round trip over the tunnel.
            const timer = window.setInterval(() => void load(), busy ? 3000 : 20000);
            return () => window.clearInterval(timer);
        }, [load, busy]);
        React.useEffect(() => {
            if (view !== 'embedding')
                return;
            let alive = true;
            void jsonFetch(`/api/roleplay/usage-requests?sessionId=${encodeURIComponent(sessionId)}&scope=all&limit=1`)
                .then(reply => {
                if (alive)
                    setSessions(reply.sessions ?? []);
            }).catch(() => {
            });
            return () => {
                alive = false;
            };
        }, [sessionId, view]);
        React.useEffect(() => {
            if (view !== 'embedding' || progressSession === sessionId)
                return;
            let alive = true;
            void jsonFetch(`/api/roleplay/memory-retrieval?sessionId=${encodeURIComponent(progressSession)}`)
                .then(reply => {
                if (!alive)
                    return;
                if (reply.ok === false)
                    throw Error(reply.error ?? '无法读取进度');
                setProgressReply({
                    id: progressSession, data: reply
                });
                setProgressError(null);
            })
                .catch(e => {
                if (alive) {
                    setProgressReply(null);
                    setProgressError(String(e));
                }
            });
            return () => {
                alive = false;
            };
        }, [sessionId, progressSession, data, view]);
        const update = (patch) => {
            editRef.current++;
            dirtyRef.current = true;
            setDirty(true);
            setDraft(old => ({
                ...old, ...patch
            }));
        };
        const action = async (name, extra = {}) => {
            if (!data || busyRef.current)
                return;
            const request = ++requestRef.current, edit = editRef.current;
            busyRef.current = true;
            setBusy(name);
            setError(null);
            try {
                const next = await jsonFetch('/api/roleplay/memory-retrieval', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId, expectedRevision: data.revision, action: name, ...extra
                    })
                });
                if (request !== requestRef.current || sessionRef.current !== sessionId)
                    return;
                if (next.ok === false)
                    throw Error(next.error ?? '操作失败');
                setData(next);
                if (name === 'index-chunk-size') {
                    chunkDirtyRef.current = false;
                    setChunkDirty(false);
                    setChunkDraft(String(next.chunkChars ?? extra.chunkChars ?? 480));
                }
                // Refresh may target an inactive provider; keep its list separate from polling.
                if (name === 'refresh-models')
                    setModelLists(old => ({
                        ...old, [String(extra.providerId)]: next.modelList
                    }));
                if (name === 'save-provider' && editRef.current === edit) {
                    const saved = next.providers.find(p => p.id === draft.id) ?? next.providers.find(p => !data.providers.some(old => old.id === p.id));
                    setDraft({
                        ...saved, apiKey: ''
                    });
                    dirtyRef.current = false;
                    setDirty(false);
                    if (saved)
                        setModelLists(old => {
                            const copy = {
                                ...old
                            };
                            delete copy[saved.id];
                            return copy;
                        });
                    toast('接入已保存，请测试后启用');
                }
                else if (!dirtyRef.current && editRef.current === edit) {
                    setDraft({
                        ...next.providers.find(p => p.id === draft.id) ?? next.providers.find(p => p.id === next.activeProviderId) ?? next.providers[0]
                    });
                }
            }
            catch (e) {
                if (request === requestRef.current && sessionRef.current === sessionId) {
                    setError(String(e));
                    toast(`记忆检索操作失败：${String(e)}`);
                }
            }
            finally {
                if (request === requestRef.current && sessionRef.current === sessionId) {
                    busyRef.current = false;
                    setBusy(null);
                }
            }
        };
        const button = (label, onClick, disabled = false, primary = false) => h('button', {
            type: 'button',
            className: 'dsh-rp-btn' + (primary ? ' dsh-rp-primary' : ''),
            onClick,
            disabled: !data || busy !== null || disabled
        }, label);
        const activeProvider = data?.activeProviderId ? data.providers.find(provider => provider.id === data.activeProviderId) : undefined;
        const clearStaleConfirmation = () => {
            setStaleConfirmation(null);
        };
        const requestIndex = (enabled) => {
            if (enabled && data?.progress.stale === true) {
                const providerId = data.activeProviderId, fingerprint = data.progress.fingerprint ?? '';
                if (providerId) {
                    setStaleConfirmation({
                        sessionId, providerId, revision: data.revision, fingerprint
                    });
                    return;
                }
            }
            void action('index', {
                enabled
            });
        };
        const confirmStaleRebuild = () => {
            const target = staleConfirmation;
            if (!target || !data || target.sessionId !== sessionId || target.providerId !== data.activeProviderId
                || target.revision !== data.revision
                || target.fingerprint !== (data.progress.fingerprint ?? '')) {
                clearStaleConfirmation();
                return;
            }
            setStaleConfirmation(null);
            void action('rebuild-index', {
                confirmProviderId: target.providerId
            });
        };
        const closeStaleDialog = (event) => {
            event.preventDefault();
            event.stopPropagation();
            clearStaleConfirmation();
        };
        const trapStaleDialogFocus = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                clearStaleConfirmation();
                return;
            }
            if (event.key !== 'Tab')
                return;
            const dialog = staleDialogRef.current;
            if (!dialog)
                return;
            const focusable = Array.from(dialog.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(element => !element.hasAttribute('disabled'));
            if (!focusable.length)
                return;
            const current = focusable.indexOf(document.activeElement);
            const next = (current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
            event.preventDefault();
            focusable[next]?.focus();
        };
        const staleConfirmCard = staleConfirmation ? h('dialog', {
            ref: staleDialogRef,
            className: 'dsh-rp-stale-confirm',
            'role': 'alertdialog',
            'aria-modal': 'true',
            'aria-labelledby': 'dsh-rp-stale-confirm-title',
            onCancel: closeStaleDialog,
            onKeyDown: trapStaleDialogFocus
        }, h('h6', {
            id: 'dsh-rp-stale-confirm-title'
        }, '语义索引配置已变化'), note(`目标模型：${activeProvider?.name
            ?? staleConfirmation.providerId}`), note('范围：仅当前对话及其全部世界线。旧向量会清空并按当前模型重建；剧情正文、来源和账本保留不变。'), note('在线模型可能产生 API 消耗；确认后会开启当前对话自动更新。'), note(`目标版本指纹：${staleConfirmation.fingerprint.length > 20 ? `${staleConfirmation.fingerprint.slice(0, 20)}…` : staleConfirmation.fingerprint
            || '未提供'}`), h('div', {
            className: 'dsh-rp-row'
        }, h('button', {
            type: 'button',
            className: 'dsh-rp-btn',
            onClick: clearStaleConfirmation,
            disabled: busy !== null,
            'data-dsh-rp-stale-cancel': true
        }, '取消'), h('button', {
            type: 'button', className: 'dsh-rp-btn dsh-rp-primary', onClick: confirmStaleRebuild, disabled: busy !== null
        }, '确认重建并开启'))) : null;
        const modeCard = h('div', {
            className: 'dsh-rp-retrieval-card'
        }, h('h5', null, '记忆检索方式'), note('只检索当前世界线的玩家输入和有效剧情正文，包含归档旧正文。向量模型需在「Embedding 模型设置」中手动配置启用。'), field('将所选方式应用到 / Apply to', h('select', {
            value: modeScope, onChange: (e) => setModeScope(e.target.value)
        }, h('option', {
            value: 'session'
        }, '当前会话 / Session'), h('option', {
            value: 'global'
        }, '全局默认 / Global default'))), h('div', {
            className: 'dsh-rp-row'
        }, ['keyword', 'semantic', 'hybrid'].map((mode, i) => h('button', {
            key: mode,
            type: 'button',
            className: 'dsh-rp-btn' + (data?.mode === mode ? ' dsh-rp-primary' : ''),
            'aria-pressed': data?.mode === mode,
            disabled: !data || busy !== null,
            onClick: () => void action('mode', {
                mode, scope: modeScope
            })
        }, ['A 关键词 / Keyword',
            'B 语义 / Semantic',
            'C 混合 / Hybrid'][i]))), note(`选择范围，再点击检索方式保存。当前有效设置${data?.scope === 'global' ? '沿用全局默认' : '来自本会话'}。切换检索方式不会删除已有索引。`), h('label', {
            className: 'dsh-rp-row'
        }, h('input', {
            type: 'checkbox',
            checked: data?.indexEnabled === true,
            disabled: !data || busy !== null,
            onChange: e => requestIndex(e.target.checked)
        }), '自动更新语义索引 / Auto-update semantic index'), h('label', {
            className: 'dsh-rp-row'
        }, h('input', {
            type: 'checkbox',
            checked: data?.autoIndexNewConversations === true,
            disabled: !data || busy !== null || (!data.autoIndexNewConversations && !activeProvider?.ready),
            onChange: e => void action('auto-index-new-conversations', {
                enabled: e.target.checked
            })
        }), '新对话自动开启语义索引 / Auto-enable semantic indexing for new conversations'), h('label', {
            className: 'dsh-rp-row'
        }, h('input', {
            type: 'checkbox',
            checked: data?.autoRebuildLocalOnRetrieval === true,
            disabled: !data || busy !== null,
            onChange: e => void action('auto-rebuild-local-on-retrieval', {
                enabled: e.target.checked
            })
        }), '对话活跃时，模型配置变化时自动重建（仅本地模型）'), note('自动更新仅作用于当前可见对话及其全部世界线，为历史和新增的玩家输入、有效正文建立索引，不等待导演笔记。关闭后仍可查询已有向量，但新剧情不会加入；关键词检索照常工作。'), note('新对话选项是全局默认，仅对之后新建的玩家对话生效，要求当前已启用模型可用；旧对话和后台子代理不会批量开启。关闭此默认不改变已有对话的索引开关，也不改变检索模式。'), note('仅当前对话在语义／混合检索发现模型指纹不匹配时后台重建；本轮先用关键词。不批量处理其他对话，不自动重建在线模型；关闭当前对话自动索引时不会自动恢复。'), note('使用语义／混合检索时，查询词本身仍可能调用向量模型。关闭自动更新不等于停止所有 API 消耗。'), staleConfirmCard);
        const local = draft.kind === 'local', saved = data?.providers.find(p => p.id === draft.id), models = draft.id ? modelLists[draft.id] : undefined;
        const chunkValue = chunkDraft || String(data?.chunkChars ?? 480), chunkNumber = Number(chunkValue), chunkValid = Number.isInteger(chunkNumber)
            && chunkNumber >= 128
            && chunkNumber <= 2048;
        const saveChunkSize = () => {
            if (chunkValid && !busyRef.current)
                void action('index-chunk-size', {
                    chunkChars: chunkNumber
                });
        };
        const ids = [...new Set([draft.model, ...models?.ids ?? []].filter((id) => !!id))];
        const modelSelect = local
            ? h('select', {
                'aria-label': '模型 ID',
                value: draft.model ?? '',
                onChange: (e) => update({
                    model: e.target.value, dimensions: null
                })
            }, h('option', {
                value: ''
            }, '选择已安装模型'), data?.catalog.filter(m => m.status === 'installed').map(m => h('option', {
                key: m.id, value: m.id
            }, m.name)))
            : h('div', {
                className: 'dsh-rp-model-picker'
            }, h('select', {
                'aria-label': '模型 ID 下拉选择',
                value: draft.model ?? '',
                onChange: (e) => update({
                    model: e.target.value
                })
            }, h('option', {
                value: ''
            }, '选择模型，或在下方手动输入'), ids.map(id => h('option', {
                key: id, value: id
            }, id))), h('button', {
                type: 'button',
                className: 'dsh-rp-btn',
                title: '刷新模型列表',
                'aria-label': '刷新模型列表',
                disabled: !draft.id || dirty || busy !== null,
                onClick: () => void action('refresh-models', {
                    providerId: draft.id
                })
            }, '↻'));
        const providerCard = h('div', {
            className: 'dsh-rp-retrieval-card'
        }, h('h5', null, 'Embedding 模型与供应商'), note('本地模型推荐顺序与实测限制见下方「本地模型下载」说明。'), h('div', {
            className: 'dsh-rp-provider-list'
        }, data?.providers.map(p => h('button', {
            type: 'button',
            key: p.id,
            className: 'dsh-rp-provider-choice' + (draft.id === p.id ? ' dsh-rp-provider-selected' : ''),
            'aria-pressed': draft.id === p.id,
            disabled: busy !== null,
            onClick: () => {
                editRef.current++;
                dirtyRef.current = false;
                setDirty(false);
                setDraft({
                    ...p, apiKey: ''
                });
            }
        }, h('strong', null, p.name), h('div', null, badge(p.kind === 'local' ? '本地' : '在线'), p.kind === 'online' ? badge(protocols[p.protocol]) : null, p.kind === 'online'
            && geminiEmbeddingModels.has(p.model
                ?? '') ? badge('Gemini 检索格式') : null, draft.id === p.id ? badge('正在编辑') : null, p.id === data.activeProviderId ? badge('剧情记忆使用中') : null, p.id === data.adaptationProviderId ? badge('小说研究使用中') : null), h('small', null, p.kind === 'online' ? `${p.model
            ?? '未选择模型'} · ${hostname(p.baseUrl)} · ${p.ready ? '测试通过' : '待测试'} · ${p.keySet ? '已保存 Key' : '尚未配置 Key'}` : `${p.model
            ?? '未选择模型'} · ${p.ready ? '测试通过' : '待测试'}`), p.error ? h('small', {
            className: 'dsh-rp-error'
        }, p.error) : null))), button('新增接入 / New provider', () => {
            editRef.current++;
            dirtyRef.current = true;
            setDirty(true);
            setDraft({
                kind: 'online', protocol: 'openai', dimensions: null, apiKey: ''
            });
        }), note(draft.id ? `正在编辑：${draft.name ?? '未命名'}${dirty ? '（有未保存修改）' : ''}` : '接入目录由两种用途共享；此处选择剧情记忆模型，小说研究模型在长文本转角色卡中单独选择。'), h('div', {
            className: 'dsh-rp-retrieval-grid'
        }, field('名称', h('input', {
            value: draft.name ?? '', onChange: e => update({
                name: e.target.value
            }), placeholder: 'My embedding provider'
        })), field('类型', h('select', {
            value: draft.kind ?? 'online',
            onChange: (e) => update({
                kind: e.target.value,
                model: '',
                dimensions: null,
                apiKey: '',
                baseUrl: '',
                protocol: 'openai'
            })
        }, h('option', {
            value: 'online'
        }, '在线 / Online'), h('option', {
            value: 'local'
        }, '本地 / Local'))), !local ? field('协议', h('select', {
            value: draft.protocol ?? 'openai',
            onChange: (e) => update({
                protocol: e.target.value
            })
        }, Object.entries(protocols).map(([id, label]) => h('option', {
            key: id, value: id
        }, label)))) : null, !local ? field('Base URL', h('input', {
            value: draft.baseUrl ?? '', onChange: e => update({
                baseUrl: e.target.value
            }), placeholder: 'https://…'
        })) : null, field('模型 ID', modelSelect), local ? field('本地编码预算（tokens）', h('input', {
            type: 'number',
            min: 64,
            max: data?.catalog.find(m => m.id === draft.model)?.maxInputTokens ?? 512,
            step: 1,
            value: draft.localMaxTokens ?? 512,
            onChange: e => update({
                localMaxTokens: Number(e.target.value)
            })
        })) : null, !local ? field('手动输入模型 ID', h('input', {
            value: draft.model ?? '', onChange: e => update({
                model: e.target.value
            }), placeholder: '支持自定义别名'
        })) : null, !local ? field('维度（留空使用模型默认值）', h('input', {
            type: 'number',
            min: 1,
            max: 8192,
            value: draft.dimensions ?? '',
            onChange: e => update({
                dimensions: e.target.value ? Number(e.target.value) : null
            })
        })) : null, !local ? field('模型修订版本（可选）', h('input', {
            value: draft.embeddingRevision ?? '',
            onChange: e => update({
                embeddingRevision: e.target.value
            }),
            placeholder: '例如 2026-09-14'
        })) : null, !local ? field('API Key（留空保留已保存 Key，不回显）', h('input', {
            type: 'password', autoComplete: 'off', value: draft.apiKey ?? '', onChange: e => update({
                apiKey: e.target.value
            })
        })) : null), !local ? note('服务未提供固定版本时可自行标记；模型升级后修改此值并重建索引。') : null, local ? note(`默认 512 tokens，适合 4 核 8G 的保守预算；所选模型输入上限 ${data?.catalog.find(m => m.id === draft.model)?.maxInputTokens
            ?? '—'} tokens。包含 Query／Document 前缀及特殊 token，由模型 tokenizer 实际检查。强硬件可调高；内存保护仍有效，较大预算可能失败，超长查询会回退关键词。保存并测试后，旧索引需按新指纹重建。`) : null, !local
            && draft.protocol === 'openai'
            && !geminiEmbeddingModels.has(draft.model
                ?? '') ? note('OpenAI 官方 Base URL：https://api.openai.com/v1；推荐模型：text-embedding-3-small 或 text-embedding-3-large。也支持中转站，请按供应商提供的地址填写，程序会追加 /embeddings；“OpenAI 官方 / 兼容接口”表示协议，不代表当前配置一定连接 OpenAI 官方。') : null, !local
            && draft.protocol === 'openai'
            && geminiEmbeddingModels.has(draft.model
                ?? '') ? h('div', {
            className: 'dsh-rp-retrieval-card'
        }, h('strong', null, 'Gemini 2 检索配置'), note('通过 OpenAI 兼容接口接入；程序会自动匹配查询与正文角色，无需手写 task_type。向量统一进行 L2 归一化；维度默认 3072，也可填写 768、1536 或 3072。旧原文索引需重建后才会使用新的检索格式。')) : null, saved?.actualDimensions ? note(`实际向量维度：${saved.actualDimensions}`) : null, !local
            && models?.error ? h('p', {
            className: 'dsh-rp-error'
        }, `${models.error}；仍可手动输入模型 ID。`) : null, h('div', {
            className: 'dsh-rp-row'
        }, button('保存供应商', () => void action('save-provider', {
            provider: draft
        }), !dirty, true), button('测试', () => void action('test-provider', {
            providerId: draft.id
        }), dirty || !draft.id), button('用于剧情记忆', () => void action('activate-provider', {
            providerId: draft.id
        }), dirty || !saved?.ready), button('删除接入', () => void action('delete-provider', {
            providerId: draft.id
        }), !draft.id)));
        const progressData = progressSession === sessionId ? data : progressReply?.id === progressSession ? progressReply.data : null;
        const progress = progressData?.progress, covered = progress?.sources ? Math.min(100, Math.round(progress.covered / progress.sources * 100)) : 0;
        const indexActionButton = (label, actionName) => h('button', {
            type: 'button',
            className: 'dsh-rp-btn',
            disabled: !data || busy !== null || (actionName === 'rebuild-index' && !activeProvider?.ready),
            onClick: () => setIndexConfirmation(actionName)
        }, label);
        const confirmation = indexConfirmation && data ? h('div', {
            className: 'dsh-rp-index-confirm', 'role': 'alertdialog', 'aria-label': '确认向量数据库操作'
        }, h('strong', null, indexConfirmation === 'rebuild-index' ? '确认重建向量数据库？' : '确认清空向量数据库？'), note(`目标供应商：${activeProvider?.name
            ?? '当前未启用供应商'}；范围：当前可见对话的全部模型向量索引（包含旧版遗留索引，覆盖其所有世界线）。`), note(indexConfirmation === 'rebuild-index' ? '将清空当前对话全部向量后，仅为当前启用模型重新索引；切换其他模型后需重新索引。' : '将清空当前对话全部向量并暂停自动更新；正文与关键词记录保留。旧在途模型请求无法撤回，其结果会丢弃，但可能已经产生 API 消耗；查询词仍可能产生 API 消耗。'), h('div', {
            className: 'dsh-rp-row'
        }, h('button', {
            type: 'button',
            className: 'dsh-rp-btn dsh-rp-primary',
            disabled: busy !== null,
            onClick: () => {
                void action(indexConfirmation, {
                    confirmProviderId: data.activeProviderId ?? null
                });
                setIndexConfirmation(null);
            }
        }, '确认'), h('button', {
            type: 'button', className: 'dsh-rp-btn', disabled: busy !== null, onClick: () => setIndexConfirmation(null)
        }, '取消'))) : null;
        const progressCard = h('div', {
            className: 'dsh-rp-retrieval-card'
        }, h('h5', null, '索引与进度'), note('自动索引开关位于「记忆」TAB 的记忆检索方式面板。'), field('索引块大小（字符）', h('input', {
            type: 'number',
            min: 128,
            max: 2048,
            step: 1,
            value: chunkValue,
            disabled: busy !== null,
            onChange: e => {
                chunkDirtyRef.current = true;
                setChunkDirty(true);
                setChunkDraft(e.target.value);
            }
        })), h('div', {
            className: 'dsh-rp-row'
        }, h('button', {
            type: 'button', className: 'dsh-rp-btn', disabled: busy !== null || !chunkDirty || !chunkValid, onClick: saveChunkSize
        }, '保存索引块大小')), note(`默认 480；建议 192（细线索）、480（均衡）、960（较长段落）。当前字符目标 ${data?.chunkChars
            ?? 480}，范围 128–2048；小说研究与剧情共用。字符数不等于 tokens：本地会按该模型 tokenizer 与编码预算继续分段，保证含前缀的完整输入不被截断。较大块增加开销并降低定位粒度；更改预算或分段配方需重建索引。`), note('块大小同时影响剧情与小说向量指纹；修改只标记旧索引需要重建，不会立即批量重建。此设置保存于全局配置，不随下方查看进度的会话选择改变。'), h('div', {
            className: 'dsh-rp-row'
        }, button('补齐历史 / 重试失败', () => void action('reindex')), indexActionButton('重建向量数据库', 'rebuild-index'), indexActionButton('清空向量数据库', 'clear-index')), confirmation, note('补齐会开启当前对话的自动索引，保留成功向量并补齐缺失、重试失败项。补齐、重建和清空只作用于当前可见对话及其全部世界线；查看进度下拉不改变操作目标。'), field('查看进度的会话', h('select', {
            value: progressSession,
            onChange: (e) => {
                setProgressReply(null);
                setProgressError(null);
                setProgressSession(e.target.value);
            }
        }, h('option', {
            value: sessionId
        }, '当前会话'), sessions.filter(s => s.id !== sessionId).map(s => h('option', {
            key: s.id, value: s.id
        }, s.label)))), note('来源覆盖和进度数字属于所选查看对话；查看进度下拉只改变显示，不改变上方当前对话的索引开关或向量管理目标。'), progress ? h('div', {
            className: 'dsh-rp-progress'
        }, h('div', null, `正文来源 ${progress.sources} · 已覆盖 ${progress.covered}`), h('div', {
            className: 'dsh-rp-progress-bar', 'aria-label': `正文覆盖 ${covered}%`
        }, h('span', {
            style: {
                width: `${covered}%`
            }
        })), progress.stale ? h('div', {
            className: 'dsh-rp-error'
        }, `配置不匹配，需重建索引；语义索引已停用，旧向量 ${progress.staleVectors
            ?? 0} 条不会参与查询。`) : null, progress.fingerprint ? note(`索引指纹：${progress.fingerprint.length > 20 ? `${progress.fingerprint.slice(0, 20)}…` : progress.fingerprint}`) : null, progress.embedding ? note(`嵌入元数据：${progress.embedding.embedding_model} · 修订 ${progress.embedding.embedding_revision} · 维度 ${progress.embedding.dimensions
            ?? '默认'} · task=${progress.embedding.task} · pooling=${progress.embedding.pooling}`) : null, note(`所选对话向量：${progress.vectors} · 待处理 ${progress.pending} · 运行中 ${progress.running} · 失败 ${progress.failed} · 结果未知 ${progress.unknown}`), note(`共享数据库磁盘占用：${bytes(progress.bytes)}`), progress.lastError ? h('div', {
            className: 'dsh-rp-error'
        }, progress.lastError) : null) : note(progressError ?? '正在读取所选会话进度…'));
        const catalogCard = h('div', {
            className: 'dsh-rp-retrieval-card'
        }, h('h5', null, '本地模型下载'), note('本组服务器语义 MRR 实测推荐：Jina Nano > Nomic v2 MoE > Qwen3 0.6B > BGE small > Jina Small INT8。排名仅基于 26 条正文／29 道有答案题的小样本召回结果；BGE small 适合中文、速度与内存优先；与 Small INT8 的 MRR 差距很小，在线 API 优先节省本地内存。未测 E5、BGE-M3 不列入排名。'), note('运行环境会按需安装或更新；已校验的模型文件会复用，不会重复下载。'), data?.catalog.map(model => {
            const pct = model.totalBytes ? Math.min(100, Math.round((model.downloadedBytes ?? 0) / model.totalBytes * 100)) : 0;
            return h('div', {
                className: 'dsh-rp-item', key: model.id
            }, h('strong', null, model.name), note(`${model.languages} · ${model.status
                ?? 'not-installed'}`), model.license ? note(`许可：${model.license}`) : null, model.description ? note(model.description) : null, note(`${bytes(model.downloadedBytes)} / ${bytes(model.totalBytes)}`), h('div', {
                className: 'dsh-rp-progress-bar', 'aria-label': `${model.name} ${pct}%`
            }, h('span', {
                style: {
                    width: `${pct}%`
                }
            })), model.error ? h('div', {
                className: 'dsh-rp-error'
            }, model.error) : null, h('div', {
                className: 'dsh-rp-row'
            }, button('下载／安装', () => void action('download-model', {
                modelId: model.id
            }), model.status === 'installed'), button('暂停', () => void action('pause-download', {
                modelId: model.id
            }), !['downloading', 'installing'].includes(model.status ?? '')), button('删除模型', () => void action('delete-model', {
                modelId: model.id
            }), model.status === 'not-installed')));
        }));
        return h('section', {
            className: 'dsh-rp-retrieval',
            'aria-label': view === 'memory' ? '记忆语义检索' : 'Embedding 模型设置',
            'data-dsh-rp-adaptation-model-settings': view === 'embedding' ? true : undefined,
            tabIndex: view === 'embedding' ? -1 : undefined
        }, ...(view === 'memory' ? [modeCard] : [providerCard, progressCard, catalogCard]), error ? h('div', {
            className: 'dsh-rp-error', role: 'alert'
        }, error) : null);
    }
    function MemoryPanel({ sessionId, LegacyPanel }) {
        return h(LegacyPanel, {
            scope: {
                sessionId
            }, visible: true, retrievalControls: h(RetrievalPanel, {
                sessionId, view: 'memory'
            })
        });
    }
    function EmbeddingPanel({ sessionId }) {
        return h('div', {
            className: 'dsh-rp-panel'
        }, h(RetrievalPanel, {
            sessionId, view: 'embedding'
        }));
    }
    function RebuildPrompt({ sessionId }) {
        const [pending, setPending] = React.useState(null), [busy, setBusy] = React.useState(false);
        const requestRef = React.useRef(0), sessionRef = React.useRef(sessionId), inFlightRef = React.useRef(false), busyRef = React.useRef(false), pendingRef = React.useRef(null);
        const dialogRef = React.useRef(null), previousFocusRef = React.useRef(null);
        sessionRef.current = sessionId;
        const load = React.useCallback(async () => {
            if (inFlightRef.current || busyRef.current)
                return;
            const request = ++requestRef.current;
            inFlightRef.current = true;
            try {
                const next = await jsonFetch(`/api/roleplay/retrieval-confirmations?sessionId=${encodeURIComponent(sessionId)}`);
                if (request !== requestRef.current || sessionRef.current !== sessionId)
                    return;
                if (next.ok === false)
                    throw Error(next.error ?? '读取重建确认失败');
                const candidate = next.pending?.[0] ?? null;
                setPending(previous => {
                    if (previous && candidate && previous.id === candidate.id && previous.kind === candidate.kind
                        && previous.model === candidate.model
                        && previous.target === candidate.target
                        && previous.reason === candidate.reason
                        && previous.action === candidate.action)
                        return previous;
                    pendingRef.current = candidate;
                    return candidate;
                });
            }
            catch {
                if (request === requestRef.current && sessionRef.current === sessionId) {
                    pendingRef.current = null;
                    setPending(null);
                }
            }
            finally {
                inFlightRef.current = false;
            }
        }, [jsonFetch, sessionId]);
        React.useEffect(() => {
            requestRef.current++;
            pendingRef.current = null;
            setPending(null);
            busyRef.current = false;
            setBusy(false);
        }, [sessionId]);
        React.useEffect(() => {
            // A pending rebuild confirmation is the only thing this poll discovers, so
            // ask quickly while one is waiting and otherwise back off. The cadence lives
            // in its own effect so a discovered pending never resets the panel state.
            void load();
            const timer = window.setInterval(() => void load(), pending ? 2000 : 30000);
            return () => {
                requestRef.current++;
                window.clearInterval(timer);
            };
        }, [sessionId, load, pending]);
        React.useLayoutEffect(() => {
            const dialog = dialogRef.current;
            if (!pending || !dialog)
                return;
            previousFocusRef.current = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null;
            try {
                if (!dialog.matches?.(':modal'))
                    dialog.showModal?.();
            }
            catch {
                dialog.setAttribute('open', '');
            }
            ;
            dialog.querySelector?.('[data-dsh-rp-rebuild-cancel]')?.focus?.();
            return () => {
                if (dialog.open)
                    dialog.close?.();
                const previous = previousFocusRef.current;
                previousFocusRef.current = null;
                previous?.focus?.();
            };
        }, [pending]);
        const submit = async (action) => {
            const target = pending;
            if (!target || busyRef.current || sessionRef.current !== sessionId || pendingRef.current?.id !== target.id)
                return false;
            busyRef.current = true;
            pendingRef.current = null;
            setBusy(true);
            setPending(null);
            requestRef.current++;
            try {
                const next = await jsonFetch('/api/roleplay/retrieval-confirmations', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId, id: target.id, action
                    })
                });
                if (next.ok === false)
                    throw Error(next.error ?? '重建确认操作失败');
                if (action === 'confirm')
                    toast('重建任务已在后台启动');
                return true;
            }
            catch (e) {
                toast(`重建确认操作失败：${String(e instanceof Error ? e.message : e)}`);
                return false;
            }
            finally {
                busyRef.current = false;
                setBusy(false);
            }
        };
        const close = (event) => {
            event.preventDefault();
            event.stopPropagation();
            void submit('cancel');
        };
        const trap = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                void submit('cancel');
                return;
            }
            if (event.key !== 'Tab')
                return;
            const dialog = dialogRef.current;
            if (!dialog)
                return;
            const focusable = Array.from(dialog.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(element => !element.hasAttribute('disabled'));
            if (!focusable.length)
                return;
            const current = focusable.indexOf(document.activeElement), next = (current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
            event.preventDefault();
            focusable[next]?.focus();
        };
        if (!pending)
            return null;
        const configure = pending.action === 'configure-adaptation-model';
        const purpose = pending.kind === 'novel' ? '小说原文索引与检索' : '剧情记忆索引与检索';
        return h('dialog', {
            ref: dialogRef,
            className: 'dsh-rp-stale-confirm',
            'role': 'alertdialog',
            'aria-modal': 'true',
            'aria-labelledby': 'dsh-rp-rebuild-title',
            onCancel: close,
            onKeyDown: trap
        }, h('h6', {
            id: 'dsh-rp-rebuild-title'
        }, configure ? '粗颗粒度需要小说检索模型' : '需要确认重建语义索引'), note(configure ? '粗颗粒度研究需要可用的小说专用 Embedding 模型；当前生成轮次已停止。请先配置并测试小说模型。' : `用途：${purpose}`), configure ? null : note(`模型：${pending.model}`), configure ? null : note(`目标：${pending.target}`), note(`原因：${pending.reason}`), configure ? note('确认后只关闭提示，不会启动索引重建。') : note('在线模型重建可能产生 API 费用；确认后将在后台启动。'), h('div', {
            className: 'dsh-rp-row'
        }, h('button', {
            type: 'button',
            className: 'dsh-rp-btn',
            'data-dsh-rp-rebuild-cancel': true,
            disabled: busy,
            onClick: () => void submit('cancel')
        }, configure ? '关闭' : '取消'), h('button', {
            type: 'button',
            className: 'dsh-rp-btn dsh-rp-primary',
            'data-dsh-rp-rebuild-confirm': true,
            disabled: busy,
            onClick: () => {
                if (configure) {
                    void (async () => {
                        if (await submit('cancel'))
                            window.dispatchEvent(new CustomEvent('dsh-roleplay-needs-config', {
                                detail: {
                                    sessionId, action: 'configure-adaptation-model'
                                }
                            }));
                    })();
                }
                else
                    void submit('confirm');
            }
        }, configure ? '前往配置' : '确认并重建')));
    }
    return {
        MemoryPanel, EmbeddingPanel, RebuildPrompt
    };
}
