// Generated from runtime/alpha3/ui/card-adaptation-panel.ts; edit the TypeScript source.
export const CARD_ADAPTATION_CSS = `
.dsh-rp-adaptation{display:grid;gap:14px;margin:12px 0}
.dsh-rp-adaptation-card{display:grid;gap:12px;padding:16px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff)}
.dsh-rp-adaptation-card h5,.dsh-rp-adaptation-card p{margin:0}
.dsh-rp-adaptation-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}
.dsh-rp-adaptation-field{display:grid;gap:5px;min-width:0}
.dsh-rp-adaptation-field input,.dsh-rp-adaptation-field select,.dsh-rp-adaptation-field textarea{width:100%;min-width:0;box-sizing:border-box;padding:8px}
.dsh-rp-adaptation-note{display:grid;gap:9px;padding:12px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:10px}
.dsh-rp-adaptation-note h6,.dsh-rp-adaptation-note p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.dsh-rp-adaptation-note textarea{min-height:66px;resize:vertical}
.dsh-rp-adaptation-meta{display:flex;flex-wrap:wrap;gap:6px;color:var(--dsw-alias-text-secondary,#667085);font-size:12px}
.dsh-rp-adaptation-progress{display:grid;gap:7px}.dsh-rp-adaptation-progress-bar{height:7px;overflow:hidden;border-radius:99px;background:rgba(100,120,145,.18)}
.dsh-rp-adaptation-progress-bar>span{display:block;height:100%;background:var(--dsw-alias-brand-primary,#3375db)}
.dsh-rp-adaptation-actions{display:flex;align-items:flex-end;flex-wrap:wrap;gap:8px}
.dsh-rp-adaptation-refresh-slot{min-height:18px}
`;
const bytes = (value) => value >= 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(1)} MiB` : `${Math.round(value / 1024)} KiB`;
const progress = (value, total) => typeof value === 'number' ? `${value}/${total}` : value ? `${total}/${total}` : `0/${total}`;
const statusLabel = (value) => value === 'reading' ? '阅读中' : value === 'finished' ? '研究完成' : value;
const noteDraft = (note) => ({ segment: note.segment, facts: note.facts, implications: note.implications, questions: note.questions, evidence: note.evidence, seq: note.seq });
const indexStatus = (source, index) => {
    if (source?.indexPolicy === 'completed' && index?.stale !== true)
        return '已完成';
    if (index && (index.failed > 0 || index.unknown > 0))
        return '需重试';
    if (index?.stale === true)
        return '等待重建';
    if (index?.enabled === false)
        return '暂停';
    return '运行';
};
export function createCardAdaptationPanel({ React, jsonFetch, toast, confirmWithDialog, onNeedsConfig }) {
    const h = React.createElement;
    const field = (label, node) => h('label', { className: 'dsh-rp-adaptation-field' }, label, node);
    const muted = (value) => h('p', { className: 'dsh-rp-muted' }, value);
    return function CardAdaptationPanel({ sessionId, focusModelSettings = false, focusModelSettingsNonce = 0 }) {
        const [data, setData] = React.useState(null);
        const [selectedId, setSelectedId] = React.useState('');
        const [modelSelection, setModelSelection] = React.useState('');
        const [modelDirty, setModelDirty] = React.useState(false);
        const [queryDraft, setQueryDraft] = React.useState('');
        const [query, setQuery] = React.useState('');
        const [editingSegment, setEditingSegment] = React.useState(null);
        const [draft, setDraft] = React.useState(null);
        const [busy, setBusy] = React.useState(null);
        const [refreshing, setRefreshing] = React.useState(false);
        const [error, setError] = React.useState(null);
        const requestRef = React.useRef(0);
        const pollingRef = React.useRef(false);
        const sessionRef = React.useRef(sessionId);
        const selectedRef = React.useRef('');
        const queryRef = React.useRef('');
        const busyRef = React.useRef(false);
        const draftRef = React.useRef(null);
        const modelDirtyRef = React.useRef(false);
        const modelSelectionRef = React.useRef('');
        const researchDirtyRef = React.useRef(false);
        const researchRevisionRef = React.useRef(undefined);
        const noteViewUserRef = React.useRef(false);
        const noteViewRef = React.useRef('close-reading');
        const expandedRef = React.useRef(false);
        const confirmationRef = React.useRef(null);
        const pollingTicketRef = React.useRef(0);
        const [confirming, setConfirming] = React.useState(false);
        const [researchDirty, setResearchDirty] = React.useState(false);
        const [researchMode, setResearchMode] = React.useState(null);
        const [researchProtagonist, setResearchProtagonist] = React.useState('');
        const [researchOpeningPoint, setResearchOpeningPoint] = React.useState('');
        const [maxQueryBatches, setMaxQueryBatches] = React.useState('7');
        const [maxReadPackets, setMaxReadPackets] = React.useState('40');
        const modelSettingsRef = React.useRef(null);
        const focusedModelSettingsNonceRef = React.useRef(null);
        const [noteView, setNoteView] = React.useState('close-reading');
        sessionRef.current = sessionId;
        selectedRef.current = selectedId;
        modelSelectionRef.current = modelSelection;
        researchDirtyRef.current = researchDirty;
        noteViewRef.current = noteView;
        queryRef.current = query;
        draftRef.current = draft;
        const accept = React.useCallback((next, append) => {
            if (next.ok === false)
                throw Error(next.error ?? '读取长文本资料失败');
            setData(previous => append && previous ? { ...next, notes: [...previous.notes, ...next.notes], researchNotes: next.researchNotes ? { ...next.researchNotes, entries: [...(previous.researchNotes?.entries ?? []), ...next.researchNotes.entries] } : previous.researchNotes } : next);
            if (append)
                expandedRef.current = true;
            const resolved = next.selectedId ?? selectedRef.current ?? next.sources[0]?.sourceId ?? '';
            setSelectedId(resolved);
            selectedRef.current = resolved;
            if (!modelDirtyRef.current) {
                setModelSelection(next.defaultSemanticModelId ?? '');
                modelSelectionRef.current = next.defaultSemanticModelId ?? '';
            }
            setError(null);
            if (!researchDirtyRef.current && next.research) {
                setResearchMode(next.research.mode);
                setResearchProtagonist(next.research.target.protagonist);
                setResearchOpeningPoint(next.research.target.openingPoint);
                setMaxQueryBatches(String(next.research.budget.maxQueryBatches || 7));
                setMaxReadPackets(String(next.research.budget.maxReadPackets || 40));
            }
            researchRevisionRef.current = next.research?.revision;
            if (!noteViewUserRef.current && next.research?.mode) {
                setNoteView(next.research.mode);
                noteViewRef.current = next.research.mode;
            }
        }, []);
        const cancelPolling = () => {
            if (!pollingRef.current && !pollingTicketRef.current)
                return;
            pollingRef.current = false;
            pollingTicketRef.current = 0;
            setRefreshing(false);
        };
        const load = React.useCallback(async (options = {}) => {
            const silent = options.silent === true;
            if (silent ? pollingRef.current : busyRef.current)
                return;
            if (!silent)
                cancelPolling();
            const sourceId = options.sourceId ?? selectedRef.current;
            const activeQuery = options.query ?? queryRef.current;
            const ticket = ++requestRef.current;
            if (silent)
                pollingTicketRef.current = ticket;
            const params = new URLSearchParams({ sessionId });
            if (sourceId)
                params.set('sourceId', sourceId);
            if (options.cursor != null)
                params.set('cursor', String(options.cursor));
            if (activeQuery)
                params.set('query', activeQuery);
            params.set('noteMode', options.noteMode ?? noteViewRef.current);
            if (silent) {
                pollingRef.current = true;
                setRefreshing(true);
            }
            else {
                busyRef.current = true;
                setBusy('load');
            }
            setError(null);
            try {
                const next = await jsonFetch(`/api/roleplay/card-adaptation?${params.toString()}`);
                if (ticket !== requestRef.current || sessionRef.current !== sessionId)
                    return;
                accept(next, options.append === true);
            }
            catch (e) {
                if (ticket === requestRef.current && sessionRef.current === sessionId)
                    setError(String(e instanceof Error ? e.message : e));
            }
            finally {
                if (silent && pollingTicketRef.current === ticket) {
                    pollingRef.current = false;
                    pollingTicketRef.current = 0;
                    if (ticket === requestRef.current && sessionRef.current === sessionId)
                        setRefreshing(false);
                }
                else if (ticket === requestRef.current && sessionRef.current === sessionId) {
                    busyRef.current = false;
                    setBusy(null);
                }
            }
        }, [accept, jsonFetch, sessionId]);
        React.useEffect(() => {
            requestRef.current++;
            sessionRef.current = sessionId;
            selectedRef.current = '';
            queryRef.current = '';
            busyRef.current = false;
            pollingRef.current = false;
            pollingTicketRef.current = 0;
            confirmationRef.current = null;
            draftRef.current = null;
            expandedRef.current = false;
            modelDirtyRef.current = false;
            modelSelectionRef.current = '';
            researchDirtyRef.current = false;
            researchRevisionRef.current = undefined;
            noteViewUserRef.current = false;
            noteViewRef.current = 'close-reading';
            setData(null);
            setSelectedId('');
            setModelSelection('');
            setModelDirty(false);
            setQuery('');
            setQueryDraft('');
            setDraft(null);
            setEditingSegment(null);
            setBusy(null);
            setRefreshing(false);
            setConfirming(false);
            setError(null);
            setResearchDirty(false);
            setResearchMode(null);
            setResearchProtagonist('');
            setResearchOpeningPoint('');
            setMaxQueryBatches('7');
            setMaxReadPackets('40');
            setNoteView('close-reading');
            void load();
            return () => { requestRef.current++; };
        }, [load, sessionId]);
        React.useEffect(() => {
            const timer = window.setInterval(() => {
                if (!busyRef.current && !draftRef.current && !modelDirtyRef.current && !researchDirtyRef.current && !confirmationRef.current && !expandedRef.current)
                    void load({ sourceId: selectedRef.current, query: queryRef.current, silent: true });
            }, 2500);
            return () => window.clearInterval(timer);
        }, [load]);
        React.useEffect(() => {
            if (!focusModelSettings || !data || !modelSettingsRef.current || focusedModelSettingsNonceRef.current === focusModelSettingsNonce)
                return;
            focusedModelSettingsNonceRef.current = focusModelSettingsNonce;
            modelSettingsRef.current.focus?.();
            modelSettingsRef.current.scrollIntoView?.({ block: 'center' });
        }, [data, focusModelSettings, focusModelSettingsNonce]);
        React.useEffect(() => {
            if (data?.research?.mode === 'coarse' && noteView === 'coarse' && !data.researchNotes && !noteViewUserRef.current && !busyRef.current)
                void load({ sourceId: selectedRef.current, query: queryRef.current, noteMode: 'coarse' });
        }, [data, load, noteView]);
        const mutate = React.useCallback(async (action, extra = {}, target) => {
            if (!data || (busyRef.current && !target) || sessionRef.current !== sessionId)
                return null;
            if (confirmationRef.current && !target)
                return null;
            cancelPolling();
            const targetSessionId = target?.sessionId ?? sessionId;
            const sourceIndependent = ['select-model', 'attach-source', 'delete-original', 'auto-index-new-sources', 'auto-rebuild-local-on-active'].includes(action);
            const targetSourceId = sourceIndependent ? '' : (target?.sourceId ?? (selectedRef.current || data.selectedId || ''));
            const targetRevision = target?.expectedRevision ?? data.revision;
            const needsSource = !sourceIndependent;
            if ((!targetSourceId && needsSource) || targetSessionId !== sessionRef.current)
                return null;
            const ticket = ++requestRef.current;
            busyRef.current = true;
            setBusy(action);
            setError(null);
            try {
                const body = { sessionId: targetSessionId, action, ...extra };
                if (targetSourceId)
                    body.sourceId = targetSourceId;
                if ((action !== 'select-model' && needsSource) || targetSourceId)
                    body.expectedRevision = targetRevision;
                if (['attach-source', 'publish-source', 'detach-source', 'delete-original', 'clear-index', 'rebuild-index', 'resume-index'].includes(action)) {
                    body.expectedLibraryRevision = target?.expectedLibraryRevision ?? data.library?.revision ?? 0;
                }
                if (target?.assetId)
                    body.assetId = target.assetId;
                if (action === 'rebuild-index' || action === 'resume-index')
                    body.expectedModelRevision = target?.expectedModelRevision ?? data.modelRevision;
                if (action === 'rebuild-index')
                    body.indexFingerprint = target?.indexFingerprint ?? data.index?.fingerprint;
                if (['research-mode', 'research-budget', 'research-pause', 'research-resume'].includes(action))
                    body.expectedResearchRevision = target?.expectedResearchRevision ?? data.research?.revision ?? 0;
                const next = await jsonFetch('/api/roleplay/card-adaptation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
                if (ticket !== requestRef.current || sessionRef.current !== targetSessionId)
                    return null;
                if (action === 'select-model') {
                    modelDirtyRef.current = false;
                    setModelDirty(false);
                }
                accept(next, false);
                expandedRef.current = false;
                return next;
            }
            catch (e) {
                const error = e;
                if (error?.code === 'ADAPTATION_COARSE_MODEL_REQUIRED' || error?.message?.includes('ADAPTATION_COARSE_MODEL_REQUIRED')) {
                    const detail = { sessionId: targetSessionId, code: 'ADAPTATION_COARSE_MODEL_REQUIRED', reason: error.details?.reason, adaptationRevision: error.details?.adaptationRevision, providerId: error.details?.providerId, action: error.details?.action ?? 'configure-adaptation-model' };
                    onNeedsConfig?.(detail);
                    if (ticket === requestRef.current && sessionRef.current === targetSessionId)
                        setError('粗颗粒度模式需要先配置可用的小说专用 Embedding 模型。');
                }
                else if (ticket === requestRef.current && sessionRef.current === targetSessionId) {
                    const message = String(e instanceof Error ? e.message : e);
                    setError(message);
                    toast(`长文本资料操作失败：${message}`);
                }
                return null;
            }
            finally {
                if (ticket === requestRef.current && sessionRef.current === targetSessionId) {
                    busyRef.current = false;
                    setBusy(null);
                }
            }
        }, [accept, data, jsonFetch, sessionId, toast]);
        const actionButton = (label, action, disabled = false, primary = false) => h('button', { type: 'button', className: `dsh-rp-btn${primary ? ' dsh-rp-primary' : ''}`, disabled: busy !== null || confirming || disabled, onClick: action }, label);
        const selectSource = (sourceId) => {
            if (draftRef.current || modelDirtyRef.current)
                return;
            if (confirmationRef.current) {
                confirmationRef.current = null;
                requestRef.current++;
                setConfirming(false);
                busyRef.current = false;
                setBusy(null);
            }
            if (busyRef.current)
                return;
            expandedRef.current = false;
            noteViewUserRef.current = false;
            noteViewRef.current = 'close-reading';
            setNoteView('close-reading');
            setSelectedId(sourceId);
            selectedRef.current = sourceId;
            setEditingSegment(null);
            setDraft(null);
            draftRef.current = null;
            void load({ sourceId, query: queryRef.current });
        };
        const search = () => {
            if (busyRef.current || draftRef.current || confirmationRef.current)
                return;
            expandedRef.current = false;
            const nextQuery = queryDraft.trim();
            setQuery(nextQuery);
            queryRef.current = nextQuery;
            void load({ sourceId: selectedRef.current, query: nextQuery });
        };
        const refreshNotes = () => {
            if (busyRef.current || draftRef.current || confirmationRef.current)
                return;
            expandedRef.current = false;
            void load({ sourceId: selectedRef.current, query: queryRef.current });
        };
        const semanticModels = data?.semanticModels ?? [];
        const selectModel = () => {
            if (!data || !modelDirtyRef.current || busyRef.current)
                return;
            if (modelSelectionRef.current && !semanticModels.some(item => item.id === modelSelectionRef.current && item.ready))
                return;
            void mutate('select-model', { providerId: modelSelectionRef.current, expectedModelRevision: data.modelRevision });
        };
        const toggleAutoIndex = () => {
            if (!data || busyRef.current || confirmationRef.current)
                return;
            void mutate('auto-index-new-sources', { enabled: !data.autoIndexNewSources, expectedAutoIndexSettingsRevision: data.autoIndexSettingsRevision });
        };
        const toggleAutoRebuild = () => {
            if (!data || busyRef.current || confirmationRef.current)
                return;
            void mutate('auto-rebuild-local-on-active', { enabled: !data.autoRebuildLocalOnActive, expectedAutoIndexSettingsRevision: data.autoIndexSettingsRevision });
        };
        const startEdit = (note) => {
            if (busyRef.current || confirmationRef.current)
                return;
            cancelPolling();
            requestRef.current++;
            const next = noteDraft(note);
            setEditingSegment(note.segment);
            setDraft(next);
            draftRef.current = next;
        };
        const cancelEdit = () => { setEditingSegment(null); setDraft(null); draftRef.current = null; };
        const updateDraft = (key, value) => {
            if (!draft)
                return;
            const next = { ...draft, [key]: value };
            setDraft(next);
            draftRef.current = next;
        };
        const saveDraft = () => {
            if (!draft || busyRef.current)
                return;
            void mutate('save-note', { note: { segment: draft.segment, facts: draft.facts, implications: draft.implications, questions: draft.questions, evidence: draft.evidence } }).then(next => { if (next)
                cancelEdit(); });
        };
        const deleteNote = (segment) => {
            if (busyRef.current)
                return;
            void mutate('delete-note', { segment });
        };
        const confirmAction = (action, message, title, confirmLabel, after, extra = {}) => {
            if (!data || confirmationRef.current || busyRef.current || sessionRef.current !== sessionId)
                return;
            const sourceId = selectedRef.current || data.selectedId || data.sources[0]?.sourceId || '';
            const target = { sessionId, sourceId: sourceId || undefined, expectedRevision: data.revision, expectedModelRevision: data.modelRevision, expectedLibraryRevision: data.library?.revision ?? 0, expectedResearchRevision: data.research?.revision, indexFingerprint: data.index?.fingerprint, action };
            confirmationRef.current = target;
            setConfirming(true);
            busyRef.current = true;
            setBusy('confirm');
            void (async () => {
                try {
                    const confirmed = await confirmWithDialog(document, message, { title, confirmLabel });
                    if (confirmed && confirmationRef.current === target && sessionRef.current === target.sessionId && (target.sourceId ? selectedRef.current === target.sourceId : true) && (target.expectedResearchRevision === undefined || researchRevisionRef.current === target.expectedResearchRevision)) {
                        const next = await mutate(action, extra, target);
                        if (next)
                            after?.();
                    }
                }
                catch (e) {
                    if (confirmationRef.current === target && sessionRef.current === target.sessionId)
                        setError(String(e instanceof Error ? e.message : e));
                }
                finally {
                    if (confirmationRef.current === target) {
                        confirmationRef.current = null;
                        busyRef.current = false;
                        setConfirming(false);
                        setBusy(null);
                    }
                }
            })();
        };
        const markResearchDirty = () => { researchDirtyRef.current = true; setResearchDirty(true); };
        const chooseResearchMode = (mode) => {
            if (!data?.research || !source || !mode || busyRef.current || confirmationRef.current)
                return;
            if (mode === 'coarse' && !researchProtagonist.trim()) {
                setError('粗颗粒度模式需要填写主角名。');
                return;
            }
            const openingPoint = researchOpeningPoint.trim();
            confirmAction('research-mode', mode === 'close-reading' ? '切换为精读模式？将完整通读原著，耗时和请求量较高。' : '切换为粗颗粒度模式？将定向检索证据并分层抽查，不能声称读完整本原著。', '阅读与改编模式', '确认切换', () => { researchDirtyRef.current = false; setResearchDirty(false); }, { readingMode: mode, protagonist: researchProtagonist.trim(), openingPoint });
        };
        const saveResearchBudget = () => {
            if (!data?.research || busyRef.current || confirmationRef.current)
                return;
            const queryLimit = Math.max(1, Math.min(200, Number(maxQueryBatches) || 7));
            const readLimit = Math.max(1, Math.min(500, Number(maxReadPackets) || 40));
            void mutate('research-budget', { maxQueryBatches: queryLimit, maxReadPackets: readLimit }, { sessionId, sourceId: selectedRef.current || data.selectedId || undefined, expectedRevision: data.revision, expectedModelRevision: data.modelRevision, expectedLibraryRevision: data.library?.revision ?? 0, expectedResearchRevision: data.research.revision })
                .then(next => { if (next) {
                researchDirtyRef.current = false;
                setResearchDirty(false);
            } });
        };
        const toggleResearchPause = () => {
            if (!data?.research || busyRef.current || confirmationRef.current)
                return;
            const action = data.research.status === 'paused' ? 'research-resume' : 'research-pause';
            void mutate(action, {}, { sessionId, sourceId: selectedRef.current || data.selectedId || undefined, expectedRevision: data.revision, expectedModelRevision: data.modelRevision, expectedLibraryRevision: data.library?.revision ?? 0, expectedResearchRevision: data.research.revision });
        };
        const clearNotes = () => confirmAction('clear-notes', '清空当前小说原文的全部研究笔记？清空后仍可重新阅读原文并再次整理。', '清空研究笔记', '清空', cancelEdit);
        const indexAction = (action) => {
            const references = data?.shared?.references ?? 1;
            const message = action === 'rebuild-index'
                ? `重建当前小说原文的向量索引？将重新编码原文，可能产生嵌入费用；已有阅读笔记保留。${references > 1 ? `这会影响 ${references} 个对话的共享索引。` : ''}`
                : action === 'clear-index'
                    ? `清空当前小说原文的向量索引？小说原文和研究笔记会保留。${references > 1 ? `这会影响 ${references} 个对话的共享索引。` : ''}`
                    : `补齐缺少或重试失败的向量？已有成功向量会保留，只处理缺失、失败或未知结果，可能产生嵌入费用。${references > 1 ? `这会影响 ${references} 个对话的共享索引。` : ''}`;
            const title = action === 'rebuild-index' ? '重建向量索引' : action === 'clear-index' ? '清空向量索引' : '补齐向量索引';
            const confirmLabel = action === 'rebuild-index' ? '重建' : action === 'clear-index' ? '清空' : '开始补齐';
            confirmAction(action, message, title, confirmLabel);
        };
        const libraryMutation = (action, assetId) => {
            if (!data || busyRef.current || confirmationRef.current)
                return;
            const sourceId = action === 'attach-source' || action === 'delete-original' ? '' : (selectedRef.current || data.selectedId || data.sources[0]?.sourceId || '');
            if (!sourceId && action !== 'attach-source' && action !== 'delete-original')
                return;
            const target = { sessionId, sourceId, assetId, expectedRevision: data.revision, expectedModelRevision: data.modelRevision, expectedLibraryRevision: data.library?.revision ?? 0, indexFingerprint: data.index?.fingerprint };
            if (action === 'delete-original') {
                const asset = data.library?.assets.find(item => item.assetId === assetId);
                if (!asset || asset.references > 0)
                    return;
                confirmationRef.current = { ...target, action };
                setConfirming(true);
                busyRef.current = true;
                setBusy('confirm');
                void (async () => {
                    try {
                        const confirmed = await confirmWithDialog(document, `删除共享原著“${asset.name}”？此条目没有对话引用。`, { title: '删除共享原著', confirmLabel: '删除' });
                        if (confirmed && confirmationRef.current?.action === action && sessionRef.current === sessionId)
                            await mutate(action, {}, target);
                    }
                    finally {
                        if (confirmationRef.current?.action === action) {
                            confirmationRef.current = null;
                            busyRef.current = false;
                            setConfirming(false);
                            setBusy(null);
                        }
                    }
                })();
                return;
            }
            void mutate(action, assetId ? { assetId } : {}, target);
        };
        const source = data?.sources.find(item => item.sourceId === selectedId) ?? data?.sources[0];
        const index = data?.index;
        const totalVectors = index ? index.vectors + index.pending + index.running + index.failed + index.unknown : 0;
        const vectorPercent = totalVectors ? Math.min(100, Math.round(index.vectors / totalVectors * 100)) : 0;
        const notes = data?.notes ?? [];
        const hasSources = !!data && data.sources.length > 0;
        const semanticCard = h('div', { className: 'dsh-rp-adaptation-card' }, h('h5', null, '小说研究模型（全局）'), muted('与 Embedding 设置共用同一组供应商和模型，不在这里重复配置供应商。此选择仅影响小说原文索引和检索，不改变剧情记忆模型；保留已有索引，配置不匹配时可再修复索引。'), data ? field('模型', h('select', { ref: (element) => { modelSettingsRef.current = element; }, 'data-dsh-rp-novel-model-settings': true, className: 'dsh-rp-input', value: modelSelection, disabled: busy !== null || confirming || !!draft, onChange: (e) => { const value = e.target.value; setModelSelection(value); modelSelectionRef.current = value; const dirty = value !== (data.defaultSemanticModelId ?? ''); modelDirtyRef.current = dirty; setModelDirty(dirty); } }, h('option', { value: '' }, '未选择（不继承剧情记忆模型）'), semanticModels.map(item => h('option', { key: item.id, value: item.id, disabled: !item.ready }, `${item.name} · ${item.model}${item.ready ? '' : '（未就绪）'}`)))) : muted('正在读取语义模型…'), data && h('div', { className: 'dsh-rp-adaptation-actions' }, actionButton('应用小说研究模型', selectModel, (!!modelSelection && !semanticModels.some(item => item.id === modelSelection && item.ready)) || !modelDirty, true)), data && modelDirty && muted('有未应用的小说研究模型选择。'), data && h('div', { className: 'dsh-rp-adaptation-field' }, h('label', null, h('input', { type: 'checkbox', checked: data.autoIndexNewSources, disabled: busy !== null || confirming, onChange: toggleAutoIndex }), ' 导入或关联小说时自动准备语义索引'), muted('仅对新导入或新关联的原著生效。模型可用时自动建库，已有兼容索引保留并补缺、重试失败或未知任务；在线模型可能产生费用。不恢复当前对话已暂停或清空的资料。')), data && h('div', { className: 'dsh-rp-adaptation-field' }, h('label', null, h('input', { type: 'checkbox', checked: data.autoRebuildLocalOnActive, disabled: busy !== null || confirming, onChange: toggleAutoRebuild }), ' 研究活跃时自动重建异常索引（仅本地模型）'), muted('当前原著实际检索遇到模型指纹变化或索引损坏时，自动修复当前本地索引；不批量重建，不处理网络或认证错误，不恢复已暂停资料。')));
        const libraryAssets = data?.library?.assets ?? [];
        const libraryCard = h('div', { className: 'dsh-rp-adaptation-card' }, h('h5', null, '原著资料库'), muted('同一本原著只需建库一次。多个独立对话自动复用原著研究笔记与阅读断点；当前卡的笔记修改独立保存，改编设想不自动成为剧情。'), libraryAssets.length ? field('已登记原著', h('select', { className: 'dsh-rp-input', value: '', disabled: busy !== null || confirming || !!draft, onChange: (e) => { if (e.target.value)
                libraryMutation('attach-source', e.target.value); } }, h('option', { value: '' }, '选择要复用的原著'), libraryAssets.map(asset => h('option', { key: asset.assetId, value: asset.assetId }, `${asset.name} · ${bytes(asset.bytes)} · ${asset.references} 个对话${asset.attached ? ' · 当前已引用' : ''}`)))) : muted(data ? '当前没有可选共享原著；请先在当前对话登记 TXT 后共享。' : '正在读取原著资料库…'), source && !source.assetId ? actionButton('共享这本原著', () => void libraryMutation('publish-source'), false, true) : null, data?.shared ? h('div', { className: 'dsh-rp-adaptation-meta' }, h('span', null, `自动复用原著研究笔记与阅读断点 · 当前卡修改独立保存 · 共享范围 ${data.shared.references} 个对话`), actionButton('解除本对话引用', () => void libraryMutation('detach-source'))) : null, libraryAssets.filter(asset => asset.references === 0).map(asset => h('div', { key: `delete-${asset.assetId}`, className: 'dsh-rp-adaptation-actions' }, h('span', null, `${asset.name} · 无引用`), actionButton('删除共享原著', () => void libraryMutation('delete-original', asset.assetId)))));
        const sourceCard = h('div', { className: 'dsh-rp-adaptation-card' }, h('h5', null, '小说原文'), muted('选择要整理的小说原文。多个对话自动复用原著研究笔记与阅读断点；当前卡的笔记修改独立保存，改编设想不自动成为剧情。'), hasSources ? field('小说', h('select', { className: 'dsh-rp-input', value: source?.sourceId ?? '', disabled: busy !== null || confirming || !!draft, onChange: (e) => selectSource(e.target.value) }, data.sources.map(item => h('option', { key: item.sourceId, value: item.sourceId }, item.name)))) : null, source ? h('div', { className: 'dsh-rp-adaptation-meta' }, h('span', null, `${source.name} · ${bytes(source.bytes)} · ${source.characters.toLocaleString()} 字 · ${source.segments} 段`), h('span', null, `已读：${progress(source.read, source.segments)}`), h('span', null, `已记笔记：${progress(source.reviewed, source.segments)}`), h('span', null, `状态：${statusLabel(source.status)}`)) : null, source?.requiresReregister ? h('div', { className: 'dsh-rp-error', role: 'alert' }, '旧分段可能受输出上限截断，旧已读标记不能证明全文送达。请重新登记原文件后完整重读；旧研究笔记会保留。') : null, data?.shared ? muted('自动复用原著研究笔记与阅读断点；当前卡的笔记修改独立保存，改编设想不自动成为剧情。') : null, !hasSources && h('p', { role: 'status' }, data ? '尚无小说原文。请先在资源库上传 TXT，再向 Agent 提出改编要求。' : '正在读取原文…'));
        const research = data?.research;
        const coveredBins = research?.coverage.bins.filter(bin => bin.covered).length ?? 0;
        const researchCard = research && source ? h('div', { className: 'dsh-rp-adaptation-card' }, h('h5', null, '阅读与改编模式'), muted('先选择原著阅读策略，再开始阅读笔记。原创互动写卡与这里独立；切换模式不会删除索引或原文。'), h('div', { className: 'dsh-rp-adaptation-grid' }, field('阅读模式', h('select', { className: 'dsh-rp-input', value: researchMode ?? '', disabled: busy !== null || confirming, onChange: (e) => { const value = e.target.value; setResearchMode(value || null); markResearchDirty(); } }, h('option', { value: '' }, '请选择'), h('option', { value: 'close-reading' }, '精读'), h('option', { value: 'coarse' }, '粗颗粒度'))), field('主角名（粗颗粒度必填）', h('input', { className: 'dsh-rp-input', value: researchProtagonist, disabled: busy !== null || confirming, onChange: (e) => { setResearchProtagonist(e.target.value); markResearchDirty(); } })), field('开篇位置', h('input', { className: 'dsh-rp-input', value: researchOpeningPoint, disabled: busy !== null || confirming, placeholder: '例如：第 1 章', onChange: (e) => { setResearchOpeningPoint(e.target.value); markResearchDirty(); } }))), researchMode === 'close-reading' ? muted('精读：完整通读原著，耗时较高，适合需要连续细节和完整背景的改编。') : researchMode === 'coarse' ? muted('粗颗粒度：定向证据 + 全局分层抽查；覆盖有限，不能声称读完整本原著。') : muted('请选择精读或粗颗粒度模式。'), h('div', { className: 'dsh-rp-adaptation-actions' }, actionButton('确认阅读模式', () => chooseResearchMode(researchMode), !researchMode || (researchMode === 'coarse' && !researchProtagonist.trim()) || !researchDirty, true)), h('div', { className: 'dsh-rp-adaptation-grid' }, field('最大检索批次（1–200）', h('input', { className: 'dsh-rp-input', type: 'number', min: 1, max: 200, value: maxQueryBatches, disabled: busy !== null || confirming, onChange: (e) => { setMaxQueryBatches(e.target.value); markResearchDirty(); } })), field('最大阅读包（1–500）', h('input', { className: 'dsh-rp-input', type: 'number', min: 1, max: 500, value: maxReadPackets, disabled: busy !== null || confirming, onChange: (e) => { setMaxReadPackets(e.target.value); markResearchDirty(); } }))), h('div', { className: 'dsh-rp-adaptation-actions' }, actionButton('保存研究预算', saveResearchBudget, !researchDirty, true), actionButton(research.status === 'paused' ? '恢复研究' : '暂停研究', toggleResearchPause, research.status === 'finished')), h('div', { className: 'dsh-rp-adaptation-meta' }, `状态：${research.status}`, `覆盖区间：${coveredBins}/${research.coverage.bins.length}`, `检索批次：${research.budget.queryBatches}/${research.budget.maxQueryBatches}`, `阅读包：${research.budget.readPackets}/${research.budget.maxReadPackets}`), research.coverage.caveat ? muted(research.coverage.caveat) : null, research.coverage.missing.length ? h('div', { className: 'dsh-rp-error' }, `缺项：${research.coverage.missing.join('、')}`) : muted('当前没有登记缺项；这不代表已 100% 理解原著。')) : null;
        const changeNoteView = (mode) => {
            if (mode === noteView || busyRef.current || draftRef.current || confirmationRef.current)
                return;
            cancelPolling();
            requestRef.current++;
            expandedRef.current = false;
            noteViewUserRef.current = true;
            setNoteView(mode);
            noteViewRef.current = mode;
            void load({ sourceId: selectedRef.current, query: queryRef.current, noteMode: mode });
        };
        const coarseNotes = data?.researchNotes?.entries ?? [];
        const coarseEntry = (entry) => h('article', { className: 'dsh-rp-adaptation-note', key: entry.id }, h('h6', null, `【${entry.category}】${entry.certainty}`), h('p', null, entry.statement), entry.citations?.length ? h('p', null, h('strong', null, '原著证据：'), entry.citations.map((citation, index) => h('span', { key: `${entry.id}-citation-${index}` }, `${index ? '；' : ''}片段 ${citation.segment} @${citation.start}：“${citation.quote}”`))) : null, entry.storyOccursAt || entry.readerRevealedAt || entry.characterKnowledge ? h('p', null, h('strong', null, '时间与知情：'), [entry.storyOccursAt ? `故事发生 ${entry.storyOccursAt}` : '', entry.readerRevealedAt ? `读者揭露 ${entry.readerRevealedAt}` : '', entry.characterKnowledge ? `角色知情 ${entry.characterKnowledge}` : ''].filter(Boolean).join('；')) : null, entry.chain ? h('p', null, h('strong', null, '关键因果链：'), JSON.stringify(entry.chain)) : null);
        const notesCard = h('div', { className: 'dsh-rp-adaptation-card' }, h('h5', null, '研究笔记'), h('div', { className: 'dsh-rp-adaptation-actions' }, actionButton('精读笔记', () => changeNoteView('close-reading'), noteView === 'close-reading'), actionButton('粗颗粒度笔记', () => changeNoteView('coarse'), noteView === 'coarse')), h('div', { className: 'dsh-rp-adaptation-actions' }, field('关键词', h('input', { className: 'dsh-rp-input', value: queryDraft, disabled: busy !== null || confirming || !!draft, placeholder: noteView === 'coarse' ? '搜索原著事实、人物、事件或因果链' : '搜索事实、改编、疑问或证据', onChange: (e) => setQueryDraft(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
                search(); } })), actionButton('搜索', search, !!draft, true), actionButton('刷新笔记', refreshNotes, !!draft), noteView === 'close-reading' ? actionButton('清空全部笔记', clearNotes, !hasSources || !!draft) : null), noteView === 'coarse' ? (coarseNotes.length ? h('div', { className: 'dsh-rp-adaptation-grid' }, coarseNotes.map(coarseEntry)) : muted(data ? '当前没有粗颗粒度原著知识条目。' : '正在读取粗颗粒度笔记…')) : (notes.length ? h('div', { className: 'dsh-rp-adaptation-grid' }, notes.map(note => {
            const editing = editingSegment === note.segment && !!draft;
            const current = editing ? draft : note;
            return h('article', { className: 'dsh-rp-adaptation-note', key: `${note.segment}:${note.seq}` }, h('h6', null, `片段 ${note.segment}`), editing ? h('div', { className: 'dsh-rp-adaptation-grid' }, field('事实', h('textarea', { value: current.facts, disabled: busy !== null, onChange: (e) => updateDraft('facts', e.target.value) })), field('改编', h('textarea', { value: current.implications, disabled: busy !== null, onChange: (e) => updateDraft('implications', e.target.value) })), field('疑问', h('textarea', { value: current.questions, disabled: busy !== null, onChange: (e) => updateDraft('questions', e.target.value) })), field('证据', h('textarea', { value: current.evidence, disabled: busy !== null, onChange: (e) => updateDraft('evidence', e.target.value) })), h('div', { className: 'dsh-rp-adaptation-actions' }, actionButton('保存笔记', saveDraft, false, true), actionButton('取消编辑', cancelEdit))) : h('div', null, h('p', null, h('strong', null, '原著事实：'), current.facts || '（暂无事实）'), h('p', null, h('strong', null, '改编设想：'), current.implications || '（暂无改编提示）'), h('p', null, h('strong', null, '待核实：'), current.questions || '（暂无疑问）'), h('p', null, h('strong', null, '原句证据：'), current.evidence || '（暂无证据）'), h('div', { className: 'dsh-rp-adaptation-actions' }, actionButton('编辑', () => startEdit(note), false, true), actionButton('删除', () => deleteNote(note.segment)))));
        })) : muted(data ? '当前筛选没有研究笔记。输入关键词后搜索，或从原文整理新的资料。' : '正在读取研究笔记…')), noteView === 'coarse' ? (data?.researchNotes?.nextCursor != null ? actionButton('加载更多粗颗粒度笔记', () => void load({ sourceId: selectedId, query, cursor: data.researchNotes?.nextCursor, noteMode: 'coarse', append: true }), !!draft) : null) : (data?.nextCursor != null ? actionButton('加载更多', () => void load({ sourceId: selectedId, query, cursor: data.nextCursor, noteMode: 'close-reading', append: true }), !!draft) : null), h('div', { className: 'dsh-rp-adaptation-refresh-slot', 'aria-live': 'polite' }, refreshing ? muted('后台刷新中…') : null));
        const indexCard = h('div', { className: 'dsh-rp-adaptation-card' }, h('h5', null, '向量索引'), muted('向量模型使用上方的小说研究模型（全局）设置。这里可主动管理小说索引，运行状态与剧情自动索引无关。'), index ? h('div', { className: 'dsh-rp-adaptation-progress' }, h('div', null, `当前模型：${index.model || '未配置'} · 已完成 ${index.vectors}/${totalVectors || 0}`), h('div', { className: 'dsh-rp-adaptation-progress-bar', 'aria-label': `向量索引 ${vectorPercent}%` }, h('span', { style: { width: `${vectorPercent}%` } })), h('div', { className: 'dsh-rp-adaptation-meta' }, `待处理 ${index.pending}`, `运行中 ${index.running}`, `失败 ${index.failed}`, `未知 ${index.unknown}`, `后台索引：${indexStatus(source, index)}`, index.stale ? '配置不匹配，旧向量不参与查询；可重建索引' : null), data?.indexError ? h('div', { className: 'dsh-rp-error' }, data.indexError) : null) : muted('正在读取向量进度…'), h('div', { className: 'dsh-rp-adaptation-actions' }, actionButton('补齐缺少或重试失败', () => indexAction('resume-index'), !hasSources || !!draft), actionButton('暂停索引', () => void mutate('pause-index'), !hasSources || !!draft), actionButton('清空向量', () => indexAction('clear-index'), !hasSources || !!draft), actionButton('重建向量', () => indexAction('rebuild-index'), !hasSources || !!draft)), muted('暂停只影响本对话的索引请求，其他引用继续；解除引用仍保留当前卡覆盖、共享原文和向量。'));
        return h('section', { className: 'dsh-rp-panel dsh-rp-adaptation', 'aria-label': '长文本转角色卡' }, error ? h('div', { role: 'alert', className: 'dsh-rp-error' }, error) : null, libraryCard, semanticCard, sourceCard, hasSources ? researchCard : null, hasSources ? notesCard : null, hasSources ? indexCard : null);
    };
}
