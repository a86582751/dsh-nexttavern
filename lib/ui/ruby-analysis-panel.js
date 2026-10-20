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
export function createRubyAnalysisPanel({ React, jsonFetch }) {
    function RubyAnalysisPanel({ sessionId }) {
        const [status, setStatus] = React.useState(null);
        const [error, setError] = React.useState('');
        const [loading, setLoading] = React.useState(false);
        const [pending, setPending] = React.useState(false);
        const [refreshVersion, setRefreshVersion] = React.useState(0);
        const pendingRef = React.useRef(false);
        React.useEffect(() => {
            let live = true;
            setStatus(null);
            setError('');
            setLoading(true);
            jsonFetch(`/api/roleplay/ruby-analysis?sessionId=${encodeURIComponent(sessionId)}`)
                .then((value) => {
                if (live)
                    setStatus(value);
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
        }, [sessionId, refreshVersion]);
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
                setStatus(next);
            }
            catch (cause) {
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
        return h('section', { className: 'dsh-rp-panel' }, h('div', { className: 'dsh-rp-row' }, h('h3', { style: { margin: 0, flex: 1 } }, 'Ruby额外分析'), h('button', {
            type: 'button', className: 'dsh-rp-btn', onClick: refresh, disabled: loading || pending,
        }, loading ? '读取中…' : '刷新')), h('p', { className: 'dsh-rp-muted' }, '读取或刷新只查看当前状态，不会启动分析。每个符合触发条件的任务常规调用 1 次，自动重试与回退均为 0 次；空配置为 0 次。'), h('p', { className: 'dsh-rp-muted' }, '这里控制 RubyAnalyzer 模型任务和派生世界书注入。HTML ruby 注音与显示正则由阅读器处理，无需模型，也不受此开关影响。'), h('p', { className: 'dsh-rp-muted' }, '关闭后停止额外分析和派生世界书注入，并保留已完成记录。'), error ? h('div', { className: 'dsh-rp-error', role: 'alert' }, `操作失败：${error}`) : null, status ? h(React.Fragment, null, h('div', { className: 'dsh-rp-item' }, h('div', { className: 'dsh-rp-item-head' }, `配置状态：${configLabel}`), status.configurationStatus === 'uninitialized'
            ? h('p', { className: 'dsh-rp-muted' }, '配置尚未初始化；当前没有可显示的已调度任务。')
            : status.configurationStatus === 'empty'
                ? h('p', { className: 'dsh-rp-muted' }, '已读取配置，当前没有可调度的 RubyAnalyzer 模型分析任务。')
                : status.configurationStatus === 'supported-static'
                    ? h('p', { className: 'dsh-rp-muted' }, '已读取受支持的任务配置；符合触发条件的任务使用模型分析。')
                    : h('p', { className: 'dsh-rp-muted' }, '配置含有当前不支持的选项。'), status.configurationIssues.length
            ? h('div', null, h('div', { className: 'dsh-rp-item-head' }, '配置原因'), status.configurationIssues.map((issue, index) => h('div', {
                className: 'dsh-rp-muted', key: `${issue.sourcePath}:${issue.code}:${index}`,
            }, `${issue.code} · ${issue.sourcePath}`)))
            : null, h('div', { className: 'dsh-rp-row' }, h('label', { className: 'dsh-rp-row', style: { margin: 0 } }, h('input', {
            type: 'checkbox', checked: status.enabled, disabled: toggleDisabled,
            onChange: (event) => {
                void submit({ enabled: event.target.checked, expectedRevision: status.revision });
            },
        }), h('span', null, status.enabled ? '额外分析已开启' : '额外分析已关闭')), status.busy || pending ? h('span', { className: 'dsh-rp-muted', role: 'status' }, pending ? '正在处理…'
            : status.enabled
                ? '分析进行中；可关闭以停止当前分析。'
                : '额外分析已关闭；可刷新查看最新停止状态。') : null), h('div', { className: 'dsh-rp-muted' }, `轮次基线：${status.cycleBaseline ?? '暂无'}`), h('div', { className: 'dsh-rp-muted' }, status.affectedCapability)), h('div', { className: 'dsh-rp-item' }, h('div', { className: 'dsh-rp-item-head' }, '分析任务'), status.runs.length
            ? status.runs.map((run) => h('div', { className: 'dsh-rp-item', key: run.key }, h('div', { className: 'dsh-rp-row' }, h('strong', null, run.taskName), h('span', { className: 'dsh-rp-muted' }, `AI 回复序号 ${run.sourceOrdinal} · ${!status.enabled && run.status === 'queued' ? '未完成记录' : runStatusLabels[run.status]}`)), run.reason ? h('div', { className: 'dsh-rp-error' }, `原因：${run.reason}`) : null, typeof run.normalRequests === 'number'
                ? h('div', { className: 'dsh-rp-muted' }, `常规请求：${run.normalRequests}`)
                : null, run.status === 'failed'
                ? h('button', {
                    type: 'button', className: 'dsh-rp-btn', disabled: retryDisabled,
                    onClick: () => { void submit({ action: 'retry', runKey: run.key }); },
                }, pending ? '处理中…' : '重试此任务')
                : null))
            : h('div', { className: 'dsh-rp-muted' }, loading
                ? '正在读取任务状态…'
                : '尚无已调度任务。')))
            : h('div', { className: 'dsh-rp-muted', role: 'status' }, loading ? '正在读取当前 Ruby 状态…' : '暂无状态数据；可刷新后重试。'));
    }
    return RubyAnalysisPanel;
}
