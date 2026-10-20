// Generated from runtime/alpha3/src/ui/native-card-conversion-panel.ts; edit the TypeScript source.
const pending = (status) => ['queued', 'running', 'waiting-main'].includes(status);
/** One visible owner polls its job. Closing the panel never cancels a durable task. */
export function createNativeCardConversionPanel({ React, jsonFetch, toast }) {
    const h = React.createElement;
    return function NativeCardConversionPanel({ sessionId, resourceId, onApplied }) {
        const [job, setJob] = React.useState(null);
        const [busy, setBusy] = React.useState(false), [error, setError] = React.useState('');
        const [now, setNow] = React.useState(Date.now);
        const ticket = React.useRef(0), mutation = React.useRef(false);
        React.useEffect(() => { ticket.current++; setJob(null); setError(''); setBusy(false); }, [sessionId, resourceId]);
        React.useEffect(() => {
            if (!job || !pending(job.status))
                return;
            let live = true, inFlight = false;
            const poll = async () => {
                if (inFlight)
                    return;
                inFlight = true;
                try {
                    const reply = await jsonFetch(`/api/roleplay/jobs?sessionId=${encodeURIComponent(sessionId)}`);
                    if (live) {
                        const current = reply.jobs.find(value => value.id === job.id);
                        if (current)
                            setJob(current);
                        setNow(Date.now());
                        setError('');
                    }
                }
                catch {
                    if (live)
                        setError('暂时无法刷新进度；任务仍会保留，可稍后重试查看。');
                }
                finally {
                    inFlight = false;
                }
            };
            const timer = setInterval(() => void poll(), 1500);
            return () => { live = false; clearInterval(timer); };
        }, [sessionId, job?.id, job?.status]);
        const act = async (action) => {
            if (mutation.current)
                return;
            mutation.current = true;
            setBusy(true);
            setError('');
            const current = ++ticket.current;
            try {
                const reply = await jsonFetch('/api/roleplay/jobs', { method: 'POST',
                    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId,
                        ...(action ? { action, jobId: job?.id } : { kind: 'card-convert', ...(resourceId ? { resourceId } : {}) }) }) });
                if (current === ticket.current) {
                    setJob(reply.job);
                    setNow(Date.now());
                }
            }
            catch (value) {
                if (current === ticket.current)
                    setError(value instanceof Error ? value.message : String(value));
            }
            finally {
                mutation.current = false;
                if (current === ticket.current)
                    setBusy(false);
            }
        };
        const apply = async () => {
            if (mutation.current || !job)
                return;
            mutation.current = true;
            setBusy(true);
            setError('');
            const current = ++ticket.current;
            try {
                await jsonFetch('/api/roleplay/card-conversion', { method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ sessionId, jobId: job.id }) });
                if (current === ticket.current) {
                    toast('人物与规则分类已用于当前世界线');
                    onApplied?.();
                }
            }
            catch (value) {
                if (current === ticket.current)
                    setError(value instanceof Error ? value.message : String(value));
            }
            finally {
                mutation.current = false;
                if (current === ticket.current)
                    setBusy(false);
            }
        };
        const endedAt = job && pending(job.status) ? now : job?.completedAt ?? job?.updatedAt ?? job?.createdAt;
        const seconds = job?.createdAt ? Math.max(0, Math.floor(((endedAt ?? now) - job.createdAt) / 1000)) : 0;
        return h('section', { className: 'dsh-rp-card-import-section', 'aria-label': '转化为 NextTavern 原生卡' }, h('h4', null, 'NextTavern 原生卡'), h('p', { className: 'dsh-rp-muted' }, '保留完整原文，由程序整理原生结构。需要识别人物与规则时才调用模型。'), h('button', { type: 'button', className: 'dsh-rp-btn', disabled: busy || !!job && pending(job.status),
            onClick: () => void act() }, busy ? '正在启动…' : '转化为 NextTavern 原生卡'), job ? h('div', { className: 'dsh-rp-item', role: 'status', 'aria-live': 'polite' }, h('strong', null, job.status === 'completed' ? '原生卡已保存' : job.status === 'failed' ? '转化失败' : job.status === 'cancelled' ? '已取消' :
            job.status === 'waiting-main' ? '等待当前模型处理' : job.progress?.message ?? '等待处理'), pending(job.status) ? h('progress', { 'aria-label': '转换处理中' }) : null, h('p', { className: 'dsh-rp-muted' }, `已用时 ${seconds} 秒`), job.error ? h('p', { className: 'dsh-rp-error' }, job.error) : null, job.status === 'completed' && job.resourceId ? h('a', { className: 'dsh-rp-btn',
            href: `/api/roleplay/download?sessionId=${encodeURIComponent(sessionId)}&resourceId=${encodeURIComponent(job.resourceId)}` }, '下载原生 JSON') : null, job.status === 'completed' && !resourceId ? h('button', { type: 'button', className: 'dsh-rp-btn', disabled: busy,
            onClick: () => void apply() }, '用于当前世界线') : null, pending(job.status) ? h('button', { type: 'button', className: 'dsh-rp-btn', disabled: busy, onClick: () => void act('cancel') }, '取消') : null, ['failed', 'cancelled'].includes(job.status) ? h('button', { type: 'button', className: 'dsh-rp-btn', disabled: busy,
            onClick: () => void act('retry') }, '重试') : null) : null, error ? h('p', { className: 'dsh-rp-error', role: 'alert' }, error) : null);
    };
}
