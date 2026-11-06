// Generated from runtime/alpha3/src/ui/ruby-analysis-panel.ts; edit the TypeScript source.
const configurationLabels = {
    uninitialized: '尚未初始化',
    empty: '空配置',
    'supported-static': '已映射的模型任务配置',
    unsupported: '包含未支持选项',
};
const runStatusLabels = {
    queued: '排队中',
    skipped: '已跳过',
    failed: '失败',
    published: '已发布',
    unsupported: '不支持',
};
const errorText = (error) => String(error && typeof error === 'object' && 'message' in error ? error.message : error);
function rubyIssueExplanation(code) {
    const labels = {
        RUBY_STARTUP_EXECUTION_UNSUPPORTED: '启动任务缺少原生执行器；依赖材料不能生成，当前配置不会调度。',
        RUBY_DIRECTOR_EXECUTION_UNSUPPORTED: '导演任务缺少原生执行器，当前配置不会调度。',
        RUBY_SUMMARY_PROVIDER_UNSUPPORTED: '所选摘要供应方尚未接入，无法提供任务所需摘要。',
        RUBY_GENERATION_OPTIONS_UNSUPPORTED: '生成选项尚未映射到原生任务，当前配置不会调度。',
        RUBY_DEFAULT_MESSAGES_UNAVAILABLE: '缺少用户自有消息材料；上游默认正文尚无再发行许可，不能自动补入。',
    };
    return labels[code] ?? '任务材料或配置尚未支持；展开查看定位信息。';
}
export function createRubyAnalysisPanel({ React, jsonFetch, openModelSettings, renderModelSettings }) {
    function RubyAnalysisPanel({ sessionId }) {
        const [snapshot, setSnapshot] = React.useState(null);
        const status = snapshot?.sessionId === sessionId ? snapshot.value : null;
        const [error, setError] = React.useState('');
        const [loading, setLoading] = React.useState(false);
        const [pending, setPending] = React.useState(false);
        const [refreshVersion, setRefreshVersion] = React.useState(0);
        const [tab, setTab] = React.useState(0);
        const [pageState, setPageState] = React.useState({ sessionId, value: 0 });
        const page = pageState.sessionId === sessionId ? pageState.value : 0;
        const setPage = (value) => setPageState({ sessionId, value });
        const requestedOffset = status?.runPage ? page * 20 : 0;
        const pendingRef = React.useRef(false);
        const targetRef = React.useRef(sessionId);
        targetRef.current = sessionId;
        React.useEffect(() => {
            let live = true;
            // Refresh keeps the last successful projection visible on a failed read.
            setError('');
            setLoading(true);
            jsonFetch(`/api/roleplay/ruby-analysis?sessionId=${encodeURIComponent(sessionId)}&runOffset=${requestedOffset}&runLimit=20`)
                .then((value) => {
                if (live)
                    setSnapshot({ sessionId, value });
            })
                .catch((cause) => {
                if (live)
                    setError(errorText(cause));
            })
                .finally(() => {
                if (live)
                    setLoading(false);
            });
            return () => { live = false; };
        }, [sessionId, refreshVersion, requestedOffset]);
        const submit = async (operation) => {
            const disabling = 'enabled' in operation && !operation.enabled;
            if (!status || status.busy && !disabling || pendingRef.current)
                return;
            pendingRef.current = true;
            setPending(true);
            setError('');
            try {
                const next = await jsonFetch('/api/roleplay/ruby-analysis', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ sessionId, ...operation }),
                });
                if (targetRef.current === sessionId) {
                    if (status.runPage)
                        setRefreshVersion(value => value + 1);
                    else
                        setSnapshot({ sessionId, value: next });
                }
            }
            catch (cause) {
                if (targetRef.current === sessionId)
                    setError(errorText(cause));
            }
            finally {
                pendingRef.current = false;
                setPending(false);
            }
        };
        const h = React.createElement;
        const disabled = loading || pending || !status;
        const retryDisabled = disabled || status?.busy !== false;
        const toggleDisabled = disabled || status?.busy === true && !status.enabled;
        const refresh = () => {
            if (loading || pending)
                return;
            setRefreshVersion((value) => value + 1);
        };
        const configLabel = status
            ? configurationLabels[status.configurationStatus]
            : '读取中';
        const tabs = ['任务与配置', '模型', '运行记录'];
        const prefix = `ruby-${encodeURIComponent(sessionId)}`;
        const tabKey = (event, index) => {
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2
                : event.key === 'ArrowRight' ? (index + 1) % 3
                    : event.key === 'ArrowLeft' ? (index + 2) % 3 : undefined;
            if (next === undefined)
                return;
            event.preventDefault();
            setTab(next);
            event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next]?.focus();
        };
        const pages = Math.max(1, Math.ceil((status?.runPage?.total ?? status?.runs.length ?? 0) / 20));
        const currentPage = status?.runPage ? Math.floor(status.runPage.offset / 20) : Math.min(page, pages - 1);
        const runEnd = (status?.runs.length ?? 0) - currentPage * 20;
        const pageRuns = status?.runPage ? status.runs.slice().reverse()
            : status?.runs.slice(Math.max(0, runEnd - 20), runEnd).reverse() ?? [];
        const unavailable = () => h('div', { className: 'dsh-rp-muted', role: 'status' }, loading ? '正在读取当前 Ruby 状态…' : '暂无状态数据；可刷新后重试。');
        return h('section', { className: 'dsh-rp-panel dsh-rp-ruby-panel',
            style: { overflowWrap: 'anywhere', lineHeight: 1.6, fontSize: 14 } }, h('style', null, `
        .dsh-rp-ruby-panel .dsh-rp-muted { font-size: inherit; }
        .dsh-rp-ruby-panel .dsh-rp-btn { font-size: inherit; min-height: 32px; white-space: normal; }
        .dsh-rp-ruby-panel .dsh-rp-item-head { font-size: inherit; }
      `), h('div', { className: 'dsh-rp-row' }, h('h3', { style: { margin: 0, flex: 1 } }, 'Ruby额外分析'), h('button', {
            type: 'button', className: 'dsh-rp-btn', onClick: refresh, disabled: loading || pending,
        }, loading ? '读取中…' : '刷新')), h('p', { className: 'dsh-rp-muted' }, '查看、刷新与切换标签不会启动分析。每个符合条件的任务预计常规调用 1 次；显式重试另计，实际请求与费用以账本为准。'), h('p', { className: 'dsh-rp-muted' }, '这里控制 RubyAnalyzer 模型任务和派生世界书注入。HTML ruby 注音与显示正则由阅读器处理，无需模型，也不受此开关影响。'), h('p', { className: 'dsh-rp-muted' }, '关闭后停止额外分析和派生世界书注入，并保留已完成记录。'), error ? h('div', { className: 'dsh-rp-error', role: 'alert' }, `操作失败：${error}`) : null, h('div', { role: 'tablist', 'aria-label': 'Ruby额外分析分类', className: 'dsh-rp-row' }, tabs.map((label, index) => h('button', { key: label, type: 'button', role: 'tab',
            id: `${prefix}-tab-${index}`, 'aria-selected': tab === index,
            'aria-controls': `${prefix}-panel-${index}`, tabIndex: tab === index ? 0 : -1,
            className: `dsh-rp-btn${tab === index ? ' dsh-rp-on' : ''}`, onClick: () => setTab(index),
            onKeyDown: (event) => tabKey(event, index) }, label))), h('div', { role: 'tabpanel', tabIndex: 0, hidden: tab !== 1, id: `${prefix}-panel-1`,
            'aria-labelledby': `${prefix}-tab-1` }, tab === 1 ? h(React.Fragment, null, h('h4', null, '复用统一策略：ruby-analysis'), h('p', null, '在管理面板的“模型”页选择跟随主模型，或供应商、模型与目录支持的思考强度。'), h('p', null, '“全部使用主模型”开启时覆盖单用途选择。此页不会关闭统一跟随，也不会保存其他用途的草稿。'), h('p', null, '新设置仅影响后续新建任务。失败任务重试沿用原任务冻结的模型；跟随主模型仍为独立后台任务。'), renderModelSettings?.(sessionId), openModelSettings ? h('button', { type: 'button', className: 'dsh-rp-btn',
            onClick: () => openModelSettings(sessionId) }, '打开统一模型设置')
            : !renderModelSettings ? h('p', { className: 'dsh-rp-muted' }, '请从管理面板“模型”入口编辑；本入口待接入局部保存接口。') : null) : null), h('div', { className: 'dsh-rp-item', hidden: tab !== 0, role: 'tabpanel', tabIndex: 0,
            id: `${prefix}-panel-0`, 'aria-labelledby': `${prefix}-tab-0` }, status ? h(React.Fragment, null, h('div', { className: 'dsh-rp-item-head' }, `配置状态：${configLabel}`), status.configurationStatus === 'uninitialized'
            ? h('p', { className: 'dsh-rp-muted' }, '配置尚未初始化；当前没有可显示的已调度任务。')
            : status.configurationStatus === 'empty'
                ? h('p', { className: 'dsh-rp-muted' }, '已读取配置，当前没有可调度的 RubyAnalyzer 模型分析任务。')
                : status.configurationStatus === 'supported-static'
                    ? h('p', { className: 'dsh-rp-muted' }, '已读取受支持的任务配置；符合触发条件的任务使用模型分析。')
                    : h('p', { className: 'dsh-rp-muted' }, '配置含有当前不支持的选项。'), status.configurationIssues.length
            ? h('div', null, h('div', { className: 'dsh-rp-item-head' }, '配置原因'), status.configurationIssues.map((issue, index) => h('details', {
                className: 'dsh-rp-muted', key: `${issue.sourcePath}:${issue.code}:${index}`,
            }, h('summary', null, rubyIssueExplanation(issue.code)), h('p', null, `${issue.code} · ${issue.sourcePath}`))))
            : null, h('div', { className: 'dsh-rp-row' }, h('label', { className: 'dsh-rp-row', style: { margin: 0 } }, h('input', {
            type: 'checkbox', checked: status.enabled, disabled: toggleDisabled,
            onChange: (event) => {
                void submit({ enabled: event.target.checked, expectedRevision: status.revision });
            },
        }), h('span', null, status.enabled ? '额外分析已开启' : '额外分析已关闭')), status.busy || pending ? h('span', { className: 'dsh-rp-muted', role: 'status' }, pending ? '正在处理…'
            : status.enabled
                ? '分析进行中；可关闭以停止当前分析。'
                : '额外分析已关闭；可刷新查看最新停止状态。') : null), h('div', { className: 'dsh-rp-muted' }, `轮次基线：${status.cycleBaseline ?? '暂无'}`), h('div', { className: 'dsh-rp-muted' }, status.affectedCapability), status.tasks?.map(task => h('div', { className: 'dsh-rp-item', key: task.taskKey }, h('strong', null, task.name), h('p', null, `${task.enabled ? '配置启用' : '配置停用'} · 周期位置：${task.cyclePositions.join('、') || '无'}`), h('p', null, `参考材料：${task.useReferences.join('、') || '无'}；依赖输出：${task.useOutputs.join('、') || '无'}`), h('p', { className: 'dsh-rp-muted' }, '配置启用不等于材料就绪；实际准备结果见运行记录。')))) : unavailable()), h('div', { className: 'dsh-rp-item', hidden: tab !== 2, role: 'tabpanel', tabIndex: 0,
            id: `${prefix}-panel-2`, 'aria-labelledby': `${prefix}-tab-2` }, status ? h(React.Fragment, null, h('div', { className: 'dsh-rp-item-head' }, '分析任务'), h('p', { className: 'dsh-rp-muted' }, '发布表示结果已接受并可供派生世界书消费，不表示已进入 Main 请求。任务模型取自冻结路由；历史缺失路由、实际请求次数与费用保持未知。'), status.outputs?.map(output => h('p', { key: output.outputKey, className: 'dsh-rp-muted' }, `当前${output.inherited ? '继承' : ''}输出：${output.outputKey} · 来源回复 ${output.sourceOrdinal}`
            + ` · ${output.inherited ? `来自世界线 ${output.ownerSessionId}` : '本世界线'}`
            + ` · ${output.injectionTarget === 'owner-output' ? '仅任务输出' : '派生世界书材料'}`)), status.runs.length
            ? pageRuns
                .map((run) => h('div', { className: 'dsh-rp-item', key: run.key }, h('div', { className: 'dsh-rp-row' }, h('strong', null, run.taskName), h('span', { className: 'dsh-rp-muted' }, `AI 回复序号 ${run.sourceOrdinal} · ${!status.enabled && run.status === 'queued' ? '未完成记录'
                : run.status === 'queued' && !status.busy ? '中断待恢复／显式重试' : runStatusLabels[run.status]}`)), run.reason ? h('div', { className: 'dsh-rp-error' }, `原因：${run.reason}`) : null, h('div', { className: 'dsh-rp-muted' }, `材料：${run.materialReady ? '已保存任务输入' : '未确认'}`), run.actualRoute ? h('p', null, `任务冻结模型：${run.actualRoute.provider} / ${run.actualRoute.model}${run.actualRoute.reasoningEffort
                ? ` · 思考强度 ${String(run.actualRoute.reasoningEffort)}` : ''}`) : null, run.publication === 'accepted' ? h('p', null, run.effectiveness === 'current' ? '历史结果已接受；当前有效输出。Main 实际消费未知。'
                : run.effectiveness === 'superseded' ? '历史结果已接受；当前已被后续输出替代，不再注入。'
                    : '历史结果已接受；当前有效性尚未提供。') : null, run.publication === 'accepted' ? h('p', null, run.injectionTarget === 'owner-output'
                ? '结果已接受；仅保存在任务输出中，未发布为世界书条目。'
                : '结果已接受；发布去向：派生世界书。实际注入取决于开关与激活条件。') : null, (run.status === 'failed' || run.status === 'queued' && !status.busy) && run.materialReady
                ? h('button', {
                    type: 'button', className: 'dsh-rp-btn', disabled: retryDisabled || !status.enabled,
                    onClick: () => { void submit({ action: 'retry', runKey: run.key }); },
                }, pending ? '处理中…' : run.actualRoute
                    ? `使用原模型 ${run.actualRoute.model} 重试` : '重试已存输入（模型未知；若无原任务则按当前路由初建）')
                : (run.status === 'failed' || run.status === 'queued' && !status.busy) && !run.materialReady
                    ? h('p', { className: 'dsh-rp-muted' }, '输入尚未持久准备，当前不能按原输入重试；下次显式普通输入准备时恢复状态。') : null))
            : h('div', { className: 'dsh-rp-muted' }, loading
                ? '正在读取任务状态…'
                : '尚无已调度任务。'), h('div', { className: 'dsh-rp-row' }, h('button', { type: 'button', className: 'dsh-rp-btn', disabled: currentPage === 0,
            onClick: () => setPage(currentPage - 1) }, '上一页'), h('span', null, `${currentPage + 1} / ${pages}`), h('button', { type: 'button', className: 'dsh-rp-btn', disabled: currentPage + 1 >= pages,
            onClick: () => setPage(currentPage + 1) }, '下一页'))) : unavailable()));
    }
    return RubyAnalysisPanel;
}
