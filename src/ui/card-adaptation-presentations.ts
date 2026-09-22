import type * as ReactAPI from 'react';
import type {
CardAdaptationNote, CardAdaptationReply, CardAdaptationResearch,
    CardAdaptationResearchNote, CardAdaptationSource,
} from './card-adaptation-panel.js';

type NoteDraft = Pick<CardAdaptationNote, 'segment' | 'facts' | 'implications' | 'questions' | 'evidence' | 'seq'>;
type NoteMode = 'close-reading' | 'coarse';
interface PresentationState {
    data: CardAdaptationReply | null;
    source: CardAdaptationSource | undefined;
    hasSources: boolean;
    busy: string | null;
    confirming: boolean;
    draft: NoteDraft | null;
}
interface SourcePresentation extends PresentationState {
    modelSelection: string;
    modelDirty: boolean;
    modelSettingsRef: ReactAPI.MutableRefObject<HTMLSelectElement | null>;
    changeModelSelection(value: string): void;
    selectModel(): void;
    selectSource(sourceId: string): void;
    toggleAutoIndex(): void;
    toggleAutoRebuild(): void;
    libraryMutation(action: 'attach-source' | 'publish-source' | 'detach-source' | 'delete-original', assetId?: string): void;
    indexAction(action: 'clear-index' | 'rebuild-index' | 'resume-index'): void;
    pauseIndex(): void;
}
interface ResearchPresentation extends PresentationState {
    researchMode: CardAdaptationResearch['mode'];
    researchProtagonist: string;
    researchOpeningPoint: string;
    researchDirty: boolean;
    maxQueryBatches: string;
    maxReadPackets: string;
    noteView: NoteMode;
    queryDraft: string;
    editingSegment: number | null;
    refreshing: boolean;
    setResearchMode(mode: CardAdaptationResearch['mode']): void;
    setResearchProtagonist(value: string): void;
    setResearchOpeningPoint(value: string): void;
    setMaxQueryBatches(value: string): void;
    setMaxReadPackets(value: string): void;
    markResearchDirty(): void;
    chooseResearchMode(mode: CardAdaptationResearch['mode']): void;
    saveResearchBudget(): void;
    toggleResearchPause(): void;
    changeNoteView(mode: NoteMode): void;
    setQueryDraft(value: string): void;
    search(): void;
    refreshNotes(): void;
    clearNotes(): void;
    updateDraft(key: keyof NoteDraft, value: string): void;
    saveDraft(): void;
    cancelEdit(): void;
    startEdit(note: CardAdaptationNote): void;
    deleteNote(segment: number): void;
    loadMoreNotes(mode: NoteMode): void;
}

const bytes = (value: number) => value >= 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(1)} MiB` : `${Math.round(value / 1024)} KiB`;
const progress = (value: boolean | number, total: number) => typeof value === 'number' ? `${value}/${total}` : value ? `${total}/${total}` : `0/${total}`;
const statusLabel = (value: string) => value === 'reading' ? '阅读中' : value === 'finished' ? '研究完成' : value;
const indexStatus = (source: CardAdaptationSource | undefined, index: CardAdaptationReply['index']) => {
    if (source?.indexPolicy === 'completed' && index?.stale !== true) return '已完成';
    if (index && (index.failed > 0 || index.unknown > 0)) return '需重试';
    if (index?.stale === true) return '等待重建';
    if (index?.enabled === false) return '暂停';
    return '运行';
};


/** Presentation owns the card trees; the parent alone owns requests, drafts and CAS targets. */
export function createCardAdaptationPresentations(React: typeof ReactAPI) {
    const h = React.createElement;
    const field = (label: string, node: ReactAPI.ReactNode) => h('label', { className: 'dsh-rp-adaptation-field' }, label, node);
    const muted = (value: ReactAPI.ReactNode) => h('p', { className: 'dsh-rp-muted' }, value);
    const buttons = (busy: string | null, confirming: boolean) => (label: string, action: () => void, disabled = false, primary = false) => h(
    'button',
        {
            type: 'button',
            className: `dsh-rp-btn${primary ? ' dsh-rp-primary' : ''}`,
            disabled: busy !== null || confirming || disabled,
            onClick: action
        },
        label
    );

    function renderSourceCards({

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
         pauseIndex,


    }: SourcePresentation) {
        const actionButton = buttons(busy, confirming);
        const semanticModels = data?.semanticModels ?? [];
        const index = data?.index;
        const totalVectors = index ? index.vectors + index.pending + index.running + index.failed + index.unknown : 0;
        const vectorPercent = totalVectors ? Math.min(100, Math.round(index!.vectors / totalVectors * 100)) : 0;
        const semanticCard = h(
        'div',
            { className: 'dsh-rp-adaptation-card' },
            h('h5', null, '小说研究模型（全局）'),

            muted('与 Embedding 设置共用同一组供应商和模型，不在这里重复配置供应商。此选择仅影响小说原文索引和检索，不改变剧情记忆模型；保留已有索引，配置不匹配时可再修复索引。'),

            data ? field(
            '模型',
                h(
                'select',
                    {
                        ref: (element: HTMLSelectElement | null): void => { modelSettingsRef.current = element; },
                        'data-dsh-rp-novel-model-settings': true,
                        className: 'dsh-rp-input',
                        value: modelSelection,
                        disabled: busy !== null || confirming || !!draft,
                        onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => changeModelSelection(e.target.value)
                    },
                    h('option', { value: '' }, '未选择（不继承剧情记忆模型）'),
                    semanticModels.map(item => h(
                    'option',
                        { key: item.id, value: item.id, disabled: !item.ready },
                        `${item.name} · ${item.model}${item.ready ? '' : '（未就绪）'}`
                    ))
                )
            ) : muted('正在读取语义模型…'),

            data
                && h(
                'div',
                    { className: 'dsh-rp-adaptation-actions' },
                    actionButton(
                    '应用小说研究模型',
                        selectModel,
                        (!!modelSelection && !semanticModels.some(item => item.id === modelSelection && item.ready)) || !modelDirty,
                        true
                    )
                ),

            data && modelDirty && muted('有未应用的小说研究模型选择。'),

            data
                && h(
                'div',
                    { className: 'dsh-rp-adaptation-field' },
                    h(
                    'label',
                        null,
                        h(
                        'input',
                            {
                                type: 'checkbox',
                                checked: data.autoIndexNewSources,
                                disabled: busy !== null || confirming,
                                onChange: toggleAutoIndex
                            }
                        ),
                        ' 导入或关联小说时自动准备语义索引'
                    ),
                    muted('仅对新导入或新关联的原著生效。模型可用时自动建库，已有兼容索引保留并补缺、重试失败或未知任务；在线模型可能产生费用。不恢复当前对话已暂停或清空的资料。')
                ),

            data
                && h(
                'div',
                    { className: 'dsh-rp-adaptation-field' },
                    h(
                    'label',
                        null,
                        h(
                        'input',
                            {
                                type: 'checkbox',
                                checked: data.autoRebuildLocalOnActive,
                                disabled: busy !== null || confirming,
                                onChange: toggleAutoRebuild
                            }
                        ),
                        ' 研究活跃时自动重建异常索引（仅本地模型）'
                    ),
                    muted('当前原著实际检索遇到模型指纹变化或索引损坏时，自动修复当前本地索引；不批量重建，不处理网络或认证错误，不恢复已暂停资料。')
                )
        );
        const libraryAssets = data?.library?.assets ?? [];
        const libraryCard = h(
        'div',
            { className: 'dsh-rp-adaptation-card' },
            h('h5', null, '原著资料库'),

            muted('同一本原著只需建库一次。多个独立对话自动复用原著研究笔记与阅读断点；当前卡的笔记修改独立保存，改编设想不自动成为剧情。'),

            libraryAssets.length ? field(
            '已登记原著',
                h(
                'select',
                    {
                        className: 'dsh-rp-input',
                        value: '',
                        disabled: busy !== null || confirming || !!draft,
                        onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => { if (e.target.value) libraryMutation('attach-source', e.target.value); }
                    },
                    h('option', { value: '' }, '选择要复用的原著'),
                    libraryAssets.map(asset => h(
                    'option',
                        { key: asset.assetId, value: asset.assetId },
                        `${asset.name} · ${bytes(asset.bytes)} · ${asset.references} 个对话${asset.attached ? ' · 当前已引用' : ''}`
                    ))
                )
            ) : muted(data ? '当前没有可选共享原著；请先在当前对话登记 TXT 后共享。' : '正在读取原著资料库…'),

            source && !source.assetId ? actionButton('共享这本原著', () => void libraryMutation('publish-source'), false, true) : null,

            data?.shared ? h(
            'div',
                { className: 'dsh-rp-adaptation-meta' },
                h('span', null, `自动复用原著研究笔记与阅读断点 · 当前卡修改独立保存 · 共享范围 ${data.shared.references} 个对话`),
                actionButton('解除本对话引用', () => void libraryMutation('detach-source'))
            ) : null,

            libraryAssets.filter(asset => asset.references === 0).map(asset => h(
            'div',
                { key: `delete-${asset.assetId}`, className: 'dsh-rp-adaptation-actions' },
                h('span', null, `${asset.name} · 无引用`),
                actionButton('删除共享原著', () => void libraryMutation('delete-original', asset.assetId))
            ))

        );
        const sourceCard = h(
        'div',
            { className: 'dsh-rp-adaptation-card' },
            h('h5', null, '小说原文'),

            muted('选择要整理的小说原文。多个对话自动复用原著研究笔记与阅读断点；当前卡的笔记修改独立保存，改编设想不自动成为剧情。'),

            hasSources ? field(
            '小说',
                h(
                'select',
                    {
                        className: 'dsh-rp-input',
                        value: source?.sourceId ?? '',
                        disabled: busy !== null || confirming || !!draft,
                        onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => selectSource(e.target.value)
                    },
                    data!.sources.map(item => h('option', { key: item.sourceId, value: item.sourceId }, item.name))
                )
            ) : null,

            source ? h(
            'div',
                { className: 'dsh-rp-adaptation-meta' },
                h(
                'span',
                    null,
                    `${source.name} · ${bytes(source.bytes)} · ${source.characters.toLocaleString()} 字 · ${source.segments} 段`
                ),
                h('span', null, `已读：${progress(source.read, source.segments)}`),
                h('span', null, `已记笔记：${progress(source.reviewed, source.segments)}`),
                h('span', null, `状态：${statusLabel(source.status)}`)
            ) : null,

            source?.requiresReregister ? h('div', { className: 'dsh-rp-error', role: 'alert' }, '旧分段可能受输出上限截断，旧已读标记不能证明全文送达。请重新登记原文件后完整重读；旧研究笔记会保留。') : null,

            data?.shared ? muted('自动复用原著研究笔记与阅读断点；当前卡的笔记修改独立保存，改编设想不自动成为剧情。') : null,

            !hasSources && h('p', { role: 'status' }, data ? '尚无小说原文。请先在资源库上传 TXT，再向 Agent 提出改编要求。' : '正在读取原文…')
        );
        const indexCard = h(
        'div',
            { className: 'dsh-rp-adaptation-card' },
            h('h5', null, '向量索引'),

            muted('向量模型使用上方的小说研究模型（全局）设置。这里可主动管理小说索引，运行状态与剧情自动索引无关。'),

            index ? h(
            'div',
                { className: 'dsh-rp-adaptation-progress' },
                h('div', null, `当前模型：${index.model || '未配置'} · 已完成 ${index.vectors}/${totalVectors || 0}`),
                h(
                'div',
                    { className: 'dsh-rp-adaptation-progress-bar', 'aria-label': `向量索引 ${vectorPercent}%` },
                    h('span', { style: { width: `${vectorPercent}%` } })
                ),
                h(
                'div',
                    { className: 'dsh-rp-adaptation-meta' },
                    `待处理 ${index.pending}`,
                    `运行中 ${index.running}`,
                    `失败 ${index.failed}`,
                    `未知 ${index.unknown}`,
                    `后台索引：${indexStatus(source, index)}`,
                    index.stale ? '配置不匹配，旧向量不参与查询；可重建索引' : null
                ),
                data?.indexError ? h('div', { className: 'dsh-rp-error' }, data.indexError) : null
            ) : muted('正在读取向量进度…'),

            h(
            'div',
                { className: 'dsh-rp-adaptation-actions' },
                actionButton('补齐缺少或重试失败', () => indexAction('resume-index'), !hasSources || !!draft),
                actionButton('暂停索引', pauseIndex, !hasSources || !!draft),
                actionButton('清空向量', () => indexAction('clear-index'), !hasSources || !!draft),
                actionButton('重建向量', () => indexAction('rebuild-index'), !hasSources || !!draft)
            ),

            muted('暂停只影响本对话的索引请求，其他引用继续；解除引用仍保留当前卡覆盖、共享原文和向量。')
        );

        return { libraryCard, semanticCard, sourceCard, indexCard };
    }

    function renderResearchCards({

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


    }: ResearchPresentation) {
        const actionButton = buttons(busy, confirming);
        const notes = data?.notes ?? [];
        const research = data?.research;
        const coveredBins = research?.coverage.bins.filter(bin => bin.covered).length ?? 0;
        const researchCard = research && source ? h(
        'div',
            { className: 'dsh-rp-adaptation-card' },

            h('h5', null, '阅读与改编模式'),

            muted('先选择原著阅读策略，再开始阅读笔记。原创互动写卡与这里独立；切换模式不会删除索引或原文。'),

            h(
            'div',
                { className: 'dsh-rp-adaptation-grid' },

                field(
                '阅读模式',
                    h(
                    'select',
                        {
                            className: 'dsh-rp-input',
                            value: researchMode ?? '',
                            disabled: busy !== null || confirming,
                            onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => {
                                const value = e.target.value as CardAdaptationResearch['mode'];
                                setResearchMode(value || null);
                                markResearchDirty();
                            }
                        },
                        h('option', { value: '' }, '请选择'),
                        h('option', { value: 'close-reading' }, '精读'),
                        h('option', { value: 'coarse' }, '粗颗粒度')
                    )
                ),

                field(
                '主角名（粗颗粒度必填）',
                    h(
                    'input',
                        {
                            className: 'dsh-rp-input',
                            value: researchProtagonist,
                            disabled: busy !== null || confirming,
                            onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => { setResearchProtagonist(e.target.value); markResearchDirty(); }
                        }
                    )
                ),

                field(
                '开篇位置',
                    h(
                    'input',
                        {
                            className: 'dsh-rp-input',
                            value: researchOpeningPoint,
                            disabled: busy !== null || confirming,
                            placeholder: '例如：第 1 章',
                            onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => { setResearchOpeningPoint(e.target.value); markResearchDirty(); }
                        }
                    )
                )

            ),

            researchMode === 'close-reading'
                ? muted('精读：完整通读原著，耗时较高，适合需要连续细节和完整背景的改编。')
                : researchMode === 'coarse'
                    ? muted('粗颗粒度：定向证据 + 全局分层抽查；覆盖有限，不能声称读完整本原著。')
                    : muted('请选择精读或粗颗粒度模式。'),


            h(
            'div',
                { className: 'dsh-rp-adaptation-actions' },
                actionButton(
                '确认阅读模式',
                    () => chooseResearchMode(researchMode),
                    !researchMode || (researchMode === 'coarse' && !researchProtagonist.trim()) || !researchDirty,
                    true
                )
            ),

            h(
            'div',
                { className: 'dsh-rp-adaptation-grid' },

                field(
                '最大检索批次（1–200）',
                    h(
                    'input',
                        {
                            className: 'dsh-rp-input',
                            type: 'number',
                            min: 1,
                            max: 200,
                            value: maxQueryBatches,
                            disabled: busy !== null || confirming,
                            onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => { setMaxQueryBatches(e.target.value); markResearchDirty(); }
                        }
                    )
                ),

                field(
                '最大阅读包（1–500）',
                    h(
                    'input',
                        {
                            className: 'dsh-rp-input',
                            type: 'number',
                            min: 1,
                            max: 500,
                            value: maxReadPackets,
                            disabled: busy !== null || confirming,
                            onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => { setMaxReadPackets(e.target.value); markResearchDirty(); }
                        }
                    )
                )

            ),

            h(
            'div',
                { className: 'dsh-rp-adaptation-actions' },
                actionButton('保存研究预算', saveResearchBudget, !researchDirty, true),
                actionButton(
                research.status === 'paused' ? '恢复研究' : '暂停研究',
                    toggleResearchPause,
                    research.status === 'finished'
                )
            ),

            h(
            'div',
                { className: 'dsh-rp-adaptation-meta' },
                `状态：${research.status}`,
                `覆盖区间：${coveredBins}/${research.coverage.bins.length}`,
                `检索批次：${research.budget.queryBatches}/${research.budget.maxQueryBatches}`,
                `阅读包：${research.budget.readPackets}/${research.budget.maxReadPackets}`
            ),

            research.coverage.caveat ? muted(research.coverage.caveat) : null,

            research.coverage.missing.length ? h('div',
                 { className: 'dsh-rp-error' },
                 `缺项：${research.coverage.missing.join('、')}`) : muted('当前没有登记缺项；这不代表已 100% 理解原著。')

        ) : null;
        const coarseNotes = data?.researchNotes?.entries ?? [];
        const coarseEntry = (entry: CardAdaptationResearchNote) => h(
        'article',
            { className: 'dsh-rp-adaptation-note', key: entry.id },

            h('h6', null, `【${entry.category}】${entry.certainty}`),
            h('p', null, entry.statement),

            entry.citations?.length ? h(
            'p',
                null,
                h('strong', null, '原著证据：'),
                entry.citations.map((citation, index) => h(
                'span',
                    { key: `${entry.id}-citation-${index}` },
                    `${index ? '；' : ''}片段 ${citation.segment} @${citation.start}：“${citation.quote}”`
                ))
            ) : null,

            entry.storyOccursAt || entry.readerRevealedAt || entry.characterKnowledge ? h(
            'p',
                null,
                h('strong', null, '时间与知情：'),
                [
                    entry.storyOccursAt ? `故事发生 ${entry.storyOccursAt}` : '',
                    entry.readerRevealedAt ? `读者揭露 ${entry.readerRevealedAt}` : '',
                    entry.characterKnowledge ? `角色知情 ${entry.characterKnowledge}` : ''
                ].filter(Boolean).join('；')
            ) : null,

            entry.chain ? h('p', null, h('strong', null, '关键因果链：'), JSON.stringify(entry.chain)) : null
        );
        const notesCard = h(
        'div',
            { className: 'dsh-rp-adaptation-card' },
            h('h5', null, '研究笔记'),

            h(
            'div',
                { className: 'dsh-rp-adaptation-actions' },
                actionButton('精读笔记', () => changeNoteView('close-reading'), noteView === 'close-reading'),
                actionButton('粗颗粒度笔记', () => changeNoteView('coarse'), noteView === 'coarse')
            ),

            h(
            'div',
                { className: 'dsh-rp-adaptation-actions' },
                field(
                '关键词',
                    h(
                    'input',
                        {
                            className: 'dsh-rp-input',
                            value: queryDraft,
                            disabled: busy !== null || confirming || !!draft,
                            placeholder: noteView === 'coarse' ? '搜索原著事实、人物、事件或因果链' : '搜索事实、改编、疑问或证据',
                            onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => setQueryDraft(e.target.value),
                            onKeyDown: (e: ReactAPI.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') search(); }
                        }
                    )
                ),
                actionButton('搜索', search, !!draft, true),
                actionButton('刷新笔记', refreshNotes, !!draft),
                noteView === 'close-reading' ? actionButton('清空全部笔记', clearNotes, !hasSources || !!draft) : null
            ),

            noteView === 'coarse' ? (coarseNotes.length ? h('div',
                 { className: 'dsh-rp-adaptation-grid' },
                 coarseNotes.map(coarseEntry)) : muted(data ? '当前没有粗颗粒度原著知识条目。' : '正在读取粗颗粒度笔记…')) : (notes.length ? h(
            'div',
                { className: 'dsh-rp-adaptation-grid' },
                notes.map(note => {
                    const editing = editingSegment === note.segment && !!draft;
                    const current = editing ? draft! : note;
                    return h(
                    'article',
                        { className: 'dsh-rp-adaptation-note', key: `${note.segment}:${note.seq}` },
                        h('h6', null, `片段 ${note.segment}`),

                        editing ? h(
                        'div',
                            { className: 'dsh-rp-adaptation-grid' },

                            field(
                            '事实',
                                h(
                                'textarea',
                                    {
                                        value: current.facts,
                                        disabled: busy !== null,
                                        onChange: (e: ReactAPI.ChangeEvent<HTMLTextAreaElement>) => updateDraft('facts', e.target.value)
                                    }
                                )
                            ),

                            field(
                            '改编',
                                h(
                                'textarea',
                                    {
                                        value: current.implications,
                                        disabled: busy !== null,
                                        onChange: (e: ReactAPI.ChangeEvent<HTMLTextAreaElement>) => updateDraft('implications', e.target.value)
                                    }
                                )
                            ),

                            field(
                            '疑问',
                                h(
                                'textarea',
                                    {
                                        value: current.questions,
                                        disabled: busy !== null,
                                        onChange: (e: ReactAPI.ChangeEvent<HTMLTextAreaElement>) => updateDraft('questions', e.target.value)
                                    }
                                )
                            ),

                            field(
                            '证据',
                                h(
                                'textarea',
                                    {
                                        value: current.evidence,
                                        disabled: busy !== null,
                                        onChange: (e: ReactAPI.ChangeEvent<HTMLTextAreaElement>) => updateDraft('evidence', e.target.value)
                                    }
                                )
                            ),

                            h(
                            'div',
                                { className: 'dsh-rp-adaptation-actions' },
                                actionButton('保存笔记', saveDraft, false, true),
                                actionButton('取消编辑', cancelEdit)
                            )
                        ) : h(
                        'div',
                            null,
                            h('p', null, h('strong', null, '原著事实：'), current.facts || '（暂无事实）'),
                            h('p', null, h('strong', null, '改编设想：'), current.implications || '（暂无改编提示）'),
                            h('p', null, h('strong', null, '待核实：'), current.questions || '（暂无疑问）'),
                            h('p', null, h('strong', null, '原句证据：'), current.evidence || '（暂无证据）'),
                            h(
                            'div',
                                { className: 'dsh-rp-adaptation-actions' },
                                actionButton('编辑', () => startEdit(note), false, true),
                                actionButton('删除', () => deleteNote(note.segment))
                            )
                        )

                    );
                })
            ) : muted(data ? '当前筛选没有研究笔记。输入关键词后搜索，或从原文整理新的资料。' : '正在读取研究笔记…')),

            noteView === 'coarse' ? (data?.researchNotes?.nextCursor != null ? actionButton('加载更多粗颗粒度笔记',
                 () => loadMoreNotes('coarse'),
                 !!draft) : null) : (data?.nextCursor != null ? actionButton('加载更多',
                 () => loadMoreNotes('close-reading'),
                 !!draft) : null),

            h(
            'div',
                { className: 'dsh-rp-adaptation-refresh-slot', 'aria-live': 'polite' },
                refreshing ? muted('后台刷新中…') : null
            )
        );

        return { researchCard, notesCard };
    }
    return { renderSourceCards, renderResearchCards };
}
