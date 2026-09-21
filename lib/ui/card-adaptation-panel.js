// Generated from runtime/alpha3/src/ui/card-adaptation-panel.ts; edit the TypeScript source.
import { createCardAdaptationPresentations } from './card-adaptation-presentations.js';
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
const noteDraft = (note) => ({
    segment: note.segment,
    facts: note.facts,
    implications: note.implications,
    questions: note.questions,
    evidence: note.evidence,
    seq: note.seq
});
export function createCardAdaptationPanel({ React, jsonFetch, toast, confirmWithDialog, onNeedsConfig }) {
    const h = React.createElement;
    const { renderSourceCards, renderResearchCards } = createCardAdaptationPresentations(React);
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
            setData(previous => append && previous ? {
                ...next,
                notes: [...previous.notes, ...next.notes],
                researchNotes: next.researchNotes ? { ...next.researchNotes,
                    entries: [...(previous.researchNotes?.entries
                            ?? []),
                        ...next.researchNotes.entries] } : previous.researchNotes
            } : next);
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
                if (silent
                    && pollingTicketRef.current === ticket) {
                    pollingRef.current = false;
                    pollingTicketRef.current = 0;
                    if (ticket === requestRef.current
                        && sessionRef.current === sessionId)
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
                if (!busyRef.current && !draftRef.current && !modelDirtyRef.current && !researchDirtyRef.current
                    && !confirmationRef.current
                    && !expandedRef.current)
                    void load({ sourceId: selectedRef.current, query: queryRef.current, silent: true });
            }, 2500);
            return () => window.clearInterval(timer);
        }, [load]);
        React.useEffect(() => {
            if (!focusModelSettings || !data || !modelSettingsRef.current
                || focusedModelSettingsNonceRef.current === focusModelSettingsNonce)
                return;
            focusedModelSettingsNonceRef.current = focusModelSettingsNonce;
            modelSettingsRef.current.focus?.();
            modelSettingsRef.current.scrollIntoView?.({ block: 'center' });
        }, [data, focusModelSettings, focusModelSettingsNonce]);
        React.useEffect(() => {
            if (data?.research?.mode === 'coarse' && noteView === 'coarse' && !data.researchNotes && !noteViewUserRef.current
                && !busyRef.current)
                void load({ sourceId: selectedRef.current, query: queryRef.current, noteMode: 'coarse' });
        }, [data, load, noteView]);
        const mutate = React.useCallback(async (action, extra = {}, target) => {
            if (!data || (busyRef.current && !target) || sessionRef.current !== sessionId)
                return null;
            if (confirmationRef.current && !target)
                return null;
            cancelPolling();
            const targetSessionId = target?.sessionId ?? sessionId;
            const sourceIndependent = ['select-model',
                'attach-source',
                'delete-original',
                'auto-index-new-sources',
                'auto-rebuild-local-on-active'].includes(action);
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
                if ([
                    'attach-source',
                    'publish-source',
                    'detach-source',
                    'delete-original',
                    'clear-index',
                    'rebuild-index',
                    'resume-index'
                ].includes(action)) {
                    body.expectedLibraryRevision = target?.expectedLibraryRevision ?? data.library?.revision ?? 0;
                }
                if (target?.assetId)
                    body.assetId = target.assetId;
                if (action === 'rebuild-index' || action === 'resume-index')
                    body.expectedModelRevision = target?.expectedModelRevision ?? data.modelRevision;
                if (action === 'rebuild-index')
                    body.indexFingerprint = target?.indexFingerprint ?? data.index?.fingerprint;
                if (['research-mode',
                    'research-budget',
                    'research-pause',
                    'research-resume'].includes(action))
                    body.expectedResearchRevision = target?.expectedResearchRevision
                        ?? data.research?.revision
                        ?? 0;
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
                if (error?.code === 'ADAPTATION_COARSE_MODEL_REQUIRED'
                    || error?.message?.includes('ADAPTATION_COARSE_MODEL_REQUIRED')) {
                    const detail = {
                        sessionId: targetSessionId,
                        code: 'ADAPTATION_COARSE_MODEL_REQUIRED',
                        reason: error.details?.reason,
                        adaptationRevision: error.details?.adaptationRevision,
                        providerId: error.details?.providerId,
                        action: error.details?.action ?? 'configure-adaptation-model'
                    };
                    onNeedsConfig?.(detail);
                    if (ticket === requestRef.current && sessionRef.current === targetSessionId)
                        setError('粗颗粒度模式需要先配置可用的小说专用 Embedding 模型。');
                }
                else if (ticket === requestRef.current
                    && sessionRef.current === targetSessionId) {
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
            void mutate('save-note', {
                note: {
                    segment: draft.segment,
                    facts: draft.facts,
                    implications: draft.implications,
                    questions: draft.questions,
                    evidence: draft.evidence
                }
            }).then(next => { if (next)
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
            const target = {
                sessionId,
                sourceId: sourceId || undefined,
                expectedRevision: data.revision,
                expectedModelRevision: data.modelRevision,
                expectedLibraryRevision: data.library?.revision ?? 0,
                expectedResearchRevision: data.research?.revision,
                indexFingerprint: data.index?.fingerprint,
                action
            };
            confirmationRef.current = target;
            setConfirming(true);
            busyRef.current = true;
            setBusy('confirm');
            void (async () => {
                try {
                    const confirmed = await confirmWithDialog(document, message, { title, confirmLabel });
                    if (confirmed && confirmationRef.current === target && sessionRef.current === target.sessionId
                        && (target.sourceId ? selectedRef.current === target.sourceId : true)
                        && (target.expectedResearchRevision === undefined
                            || researchRevisionRef.current === target.expectedResearchRevision)) {
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
            void mutate('research-budget', { maxQueryBatches: queryLimit, maxReadPackets: readLimit }, {
                sessionId,
                sourceId: selectedRef.current || data.selectedId || undefined,
                expectedRevision: data.revision,
                expectedModelRevision: data.modelRevision,
                expectedLibraryRevision: data.library?.revision ?? 0,
                expectedResearchRevision: data.research.revision
            })
                .then(next => { if (next) {
                researchDirtyRef.current = false;
                setResearchDirty(false);
            } });
        };
        const toggleResearchPause = () => {
            if (!data?.research || busyRef.current || confirmationRef.current)
                return;
            const action = data.research.status === 'paused' ? 'research-resume' : 'research-pause';
            void mutate(action, {}, {
                sessionId,
                sourceId: selectedRef.current || data.selectedId || undefined,
                expectedRevision: data.revision,
                expectedModelRevision: data.modelRevision,
                expectedLibraryRevision: data.library?.revision ?? 0,
                expectedResearchRevision: data.research.revision
            });
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
            const sourceId = action === 'attach-source'
                || action === 'delete-original' ? '' : (selectedRef.current
                || data.selectedId
                || data.sources[0]?.sourceId
                || '');
            if (!sourceId && action !== 'attach-source' && action !== 'delete-original')
                return;
            const target = {
                sessionId,
                sourceId,
                assetId,
                expectedRevision: data.revision,
                expectedModelRevision: data.modelRevision,
                expectedLibraryRevision: data.library?.revision ?? 0,
                indexFingerprint: data.index?.fingerprint
            };
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
        const hasSources = !!data && data.sources.length > 0;
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
        // Mutations retain the current session, request ticket and revision in this owner.
        const changeModelSelection = (value) => {
            setModelSelection(value);
            modelSelectionRef.current = value;
            const dirty = value !== (data?.defaultSemanticModelId ?? '');
            modelDirtyRef.current = dirty;
            setModelDirty(dirty);
        };
        const loadMoreNotes = (noteMode) => {
            const cursor = noteMode === 'coarse' ? data?.researchNotes?.nextCursor : data?.nextCursor;
            void load({ sourceId: selectedId, query, cursor, noteMode, append: true });
        };
        const { libraryCard, semanticCard, sourceCard, indexCard } = renderSourceCards({
            data,
            source,
            hasSources,
            busy,
            confirming,
            draft,
            modelSelection,
            modelDirty,
            modelSettingsRef,
            changeModelSelection,
            selectModel,
            selectSource,
            toggleAutoIndex,
            toggleAutoRebuild,
            libraryMutation,
            indexAction,
            pauseIndex: () => void mutate('pause-index'),
        });
        const { researchCard, notesCard } = renderResearchCards({
            data,
            source,
            hasSources,
            busy,
            confirming,
            draft,
            researchMode,
            researchProtagonist,
            researchOpeningPoint,
            researchDirty,
            maxQueryBatches,
            maxReadPackets,
            noteView,
            queryDraft,
            editingSegment,
            refreshing,
            setResearchMode,
            setResearchProtagonist,
            setResearchOpeningPoint,
            setMaxQueryBatches,
            setMaxReadPackets,
            markResearchDirty,
            chooseResearchMode,
            saveResearchBudget,
            toggleResearchPause,
            changeNoteView,
            setQueryDraft,
            search,
            refreshNotes,
            clearNotes,
            updateDraft,
            saveDraft,
            cancelEdit,
            startEdit,
            deleteNote,
            loadMoreNotes,
        });
        return h('section', { className: 'dsh-rp-panel dsh-rp-adaptation', 'aria-label': '长文本转角色卡' }, error ? h('div', { role: 'alert', className: 'dsh-rp-error' }, error) : null, libraryCard, semanticCard, sourceCard, hasSources ? researchCard : null, hasSources ? notesCard : null, hasSources ? indexCard : null);
    };
}
