// Generated from runtime/alpha3/src/ui/opening-panel.ts; edit the TypeScript source.
const rejectionMessage = (code) => {
    if (code === 'PROGRAMMATIC_IDENTITY_CONFLICT')
        return '上次提交被拒绝：这次开场的操作标识与会话中的消息不一致。重复选择无法解决，请先核对状态。';
    if (code === 'PROGRAMMATIC_MISSING_SYSTEM_HEAD')
        return '上次提交被拒绝：当前会话的旧消息结构不支持追加开场。重复选择无法解决，请先核对状态。';
    if (code === 'PROGRAMMATIC_OPEN_TURN')
        return '上次提交被拒绝：会话当时还有未结束的回合。请等待回合结束并核对状态，再重试同一次选择。';
    return null;
};
export function createOpeningPanel({ React, jsonFetch, toast }) {
    return function OpeningPanel({ sessionId, refreshToken }) {
        const [data, setData] = React.useState(null);
        const [index, setIndex] = React.useState(0);
        const [busy, setBusy] = React.useState(false);
        const [error, setError] = React.useState('');
        const ticket = React.useRef(0);
        const load = React.useCallback(async (visibleError = false) => {
            const current = ++ticket.current;
            try {
                const reply = await jsonFetch(`/api/roleplay/openings?sessionId=${encodeURIComponent(sessionId)}`);
                if (current !== ticket.current)
                    return;
                setData(reply);
                setIndex(reply.selection?.index ?? 0);
                setError('');
            }
            catch (cause) {
                if (current !== ticket.current)
                    return;
                setData(null);
                if (visibleError)
                    setError(String(cause.message ?? cause));
            }
        }, [sessionId]);
        React.useEffect(() => {
            setData(null);
            setError('');
            void load();
            return () => { ticket.current++; };
        }, [load, refreshToken]);
        if (!data)
            return error ? React.createElement('p', { className: 'dsh-rp-error', role: 'alert' }, error) : null;
        const selected = data.candidates.find(candidate => candidate.index === index);
        const fixed = data.selection;
        const diagnosis = fixed?.status === 'unknown' ? rejectionMessage(fixed.rejectionCode) : null;
        const blockedRetry = fixed?.status === 'unknown' &&
            (fixed.rejectionCode === 'PROGRAMMATIC_IDENTITY_CONFLICT'
                || fixed.rejectionCode === 'PROGRAMMATIC_MISSING_SYSTEM_HEAD');
        const choose = async () => {
            if (!selected || busy || blockedRetry || fixed && fixed.index !== selected.index)
                return;
            setBusy(true);
            try {
                const operationId = fixed?.operationId ?? crypto.randomUUID();
                const reply = await jsonFetch('/api/roleplay/openings', { method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ sessionId, action: 'select', index: selected.index,
                        expectedRenderedSha256: selected.renderedSha256, operationId }) });
                toast(reply.selection.status === 'completed' ? '开场已写入原生会话'
                    : rejectionMessage(reply.selection.rejectionCode) ?? '开场提交待确认，请核对状态');
                await load(true);
            }
            catch (cause) {
                toast('开场选择失败：' + String(cause.message ?? cause));
                await load(true);
            }
            finally {
                setBusy(false);
            }
        };
        const recover = async () => {
            if (busy)
                return;
            setBusy(true);
            try {
                await jsonFetch('/api/roleplay/openings', { method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ sessionId, action: 'recover' }) });
                await load(true);
            }
            catch (cause) {
                toast('开场核对失败：' + String(cause.message ?? cause));
            }
            finally {
                setBusy(false);
            }
        };
        return React.createElement('section', { className: 'dsh-rp-item' }, React.createElement('div', { className: 'dsh-rp-item-head' }, '选择角色卡开场', React.createElement('button', { className: 'dsh-rp-btn', onClick: () => void load(true) }, '刷新')), React.createElement('p', { className: 'dsh-rp-muted' }, fixed?.status === 'completed' ? `已写入第 ${fixed.committedTurn} 回合` :
            diagnosis ?? (fixed ? '开场提交待确认；使用同一次操作核对，不会重复生成。' :
                '开场来自已激活角色卡。选择后作为一条原生助理消息写入，不请求模型。')), !data.available ? React.createElement('p', { className: 'dsh-rp-error' }, data.priorOpening ? '当前会话已有开场消息；再次导入或创建分支不会自动写第二条。'
            : data.legacyDisplayed ? '这张卡已请求旧版开场；为避免重复消息，暂不能再次选择。'
                : '当前宿主尚未加载原生开场提交能力，暂不能选择。') : null, React.createElement('select', { className: 'dsh-rp-input', 'aria-label': '开场候选', value: index,
            disabled: busy || !!fixed,
            onChange: (event) => setIndex(Number(event.target.value)) }, data.candidates.map(candidate => React.createElement('option', { key: candidate.index, value: candidate.index }, candidate.label))), selected ? React.createElement('pre', { className: 'dsh-rp-item' }, selected.text) : null, selected?.macros.some(macro => macro.status !== 'resolved') ? React.createElement('p', { className: 'dsh-rp-muted' }, '部分占位符没有可验证的上下文，将保留原样。') : null, React.createElement('div', { className: 'dsh-rp-row' }, React.createElement('button', { className: 'dsh-rp-btn', disabled: busy || !selected || !data.available
                || blockedRetry || fixed?.status === 'completed' || !!fixed && fixed.index !== index,
            onClick: () => void choose() }, busy ? '处理中…' : fixed ? '重试同一次选择' : '使用此开场'), fixed && fixed.status !== 'completed' ? React.createElement('button', { className: 'dsh-rp-btn', disabled: busy, onClick: () => void recover() }, '核对状态') : null));
    };
}
