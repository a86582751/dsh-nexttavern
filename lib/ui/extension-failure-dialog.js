// Generated from runtime/alpha3/src/ui/extension-failure-dialog.ts; edit the TypeScript source.
const STORAGE_KEY = 'dsh.roleplay.extension-failures.v1';
const labels = { mvu: 'MVU 状态', ruby: 'Ruby 分析', ejs: 'EJS 模板',
    'author-script': '作者脚本', reader: '阅读显示' };
const failureKey = (failure) => JSON.stringify([failure.sessionId, failure.id, failure.sourceRevision, failure.code]);
export function extensionFailureDetails(failure) {
    return [labels[failure.extension], failure.reason, `错误代码 ${failure.code}`, `阶段 ${failure.phase}`,
        failure.sourcePointer && `来源 ${failure.sourcePointer}`,
        failure.scriptIdentity && `脚本 ${failure.scriptIdentity}`,
        failure.messageId && `消息 ${failure.messageId}`,
        failure.line !== undefined && `行 ${failure.line}${failure.column !== undefined ? `，列 ${failure.column}` : ''}`,
        failure.helper && `Helper ${failure.helper}`, failure.taskId && `任务 ${failure.taskId}`,
        `来源版本 ${failure.sourceRevision}`].filter(Boolean).join('\n');
}
/** One Main host owns notification identity. Child frames report DATA only. */
export function createExtensionFailureDialog(deps) {
    const { React, document } = deps;
    const h = React.createElement;
    const failures = new Map();
    const reported = new Map();
    const activityFailures = new Map();
    const seen = new Set();
    const operations = new Map();
    const listeners = new Set();
    let version = 0;
    let storage = deps.storage;
    try {
        storage ??= document.defaultView?.sessionStorage;
    }
    catch { }
    try {
        const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
        if (saved?.schemaVersion === 1) {
            for (const key of saved.seen)
                seen.add(key);
            for (const [sessionId, operation] of saved.operations)
                operations.set(sessionId, {
                    ...operation, needsStatusRefresh: operation.started,
                });
        }
    }
    catch { }
    // The server owns the recoverable draft. Small operation references retain
    // reload recovery across sessions even when failed inputs are very large.
    const persist = () => {
        try {
            storage?.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1,
                seen: [...seen], operations: [...operations].map(([sessionId, operation]) => [sessionId, {
                        preview: { ...operation.preview, draftText: '' }, started: operation.started,
                        ...operation.result ? { result: { ...operation.result, draftText: '' } } : {},
                    }]) }));
        }
        catch { }
    };
    const notify = () => { version++; for (const listener of listeners)
        listener(); };
    const subscribe = (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
    const snapshot = () => version;
    const request = deps.request ?? (async (action, input) => {
        const response = await fetch('/api/roleplay/text-only-continuation', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...input }),
        });
        const result = await response.json();
        if (!response.ok)
            throw Object.assign(new Error(result.error ?? result.code ?? `请求失败 ${response.status}`), {
                status: response.status, code: result.code, operationState: result.operationState,
            });
        return result;
    });
    const reportExtensionFailure = (failure) => {
        const key = failureKey(failure);
        const count = reported.get(key) ?? 0;
        failures.set(key, failure);
        reported.set(key, count + 1);
        if (!count)
            notify();
        let retained = true;
        return () => {
            if (!retained)
                return;
            retained = false;
            const count = reported.get(key);
            if (count > 1)
                reported.set(key, count - 1);
            else {
                reported.delete(key);
                notify();
            }
        };
    };
    const replaceActivityFailures = (sessionId, rows) => {
        const previous = activityFailures.get(sessionId), next = new Set(rows.map(failureKey));
        for (const row of rows)
            failures.set(failureKey(row), row);
        if (previous?.size === next.size && [...next].every(key => previous.has(key)))
            return;
        activityFailures.set(sessionId, next);
        notify();
    };
    const inspect = async (sessionId, refreshReady = false) => {
        let operation = operations.get(sessionId);
        if (!operation || refreshReady && operation.result?.status === 'ready') {
            const preview = await request('inspect', { sessionId });
            if (!operation || preview.revision !== operation.preview.revision) {
                operation = { preview, started: false };
                operations.set(sessionId, operation);
                persist();
            }
        }
        return operation;
    };
    const prepare = async (sessionId, operation) => {
        if (operation.result?.status === 'ready' && !operation.needsStatusRefresh)
            return operation.result;
        const { operationId, revision } = operation.preview;
        // Persist before POST. A lost response or a reload must recover the same
        // reserved child, including a partially completed deterministic import.
        if (operation.started) {
            try {
                const status = await request('status', { sessionId, operationId });
                operation.result = status;
                operation.needsStatusRefresh = false;
                persist();
                if (status.status === 'ready')
                    return status;
            }
            catch (error) {
                // No record means the original POST may never have arrived. The same
                // operation and revision still own the next preparation attempt.
                if (error.status !== 404)
                    throw error;
            }
        }
        operation.started = true;
        persist();
        try {
            operation.result = await request('prepare', {
                sessionId, operationId, expectedRevision: revision,
            });
            operation.needsStatusRefresh = false;
        }
        catch (error) {
            const refusal = error;
            if (refusal.status === 409 && refusal.code === 'TEXT_ONLY_SOURCE_CHANGED'
                && refusal.operationState === 'not-started') {
                operations.delete(sessionId);
                refusal.previewInvalidated = true;
                throw refusal;
            }
            try {
                operation.result = await request('status', { sessionId, operationId });
                operation.needsStatusRefresh = false;
            }
            catch {
                throw error;
            }
        }
        finally {
            persist();
        }
        return operation.result;
    };
    function Host({ sessionId }) {
        const revision = React.useSyncExternalStore(subscribe, snapshot, snapshot);
        const historyRows = [...failures.values()].filter(failure => failure.sessionId === sessionId);
        const currentKeys = activityFailures.get(sessionId);
        const rows = historyRows.filter(failure => reported.has(failureKey(failure)) || currentKeys?.has(failureKey(failure)));
        const [opened, setOpened] = React.useState(false);
        const [previewOperation, setPreviewOperation] = React.useState(null);
        const preview = previewOperation?.preview ?? null;
        const [busy, setBusy] = React.useState(false);
        const [error, setError] = React.useState('');
        const [copied, setCopied] = React.useState(false);
        const dialog = React.useRef(null);
        const alive = React.useRef(true);
        const current = () => alive.current && deps.currentSessionId() === sessionId;
        React.useEffect(() => {
            alive.current = true;
            return () => { alive.current = false; };
        }, []);
        React.useEffect(() => {
            if (!current())
                return;
            let changed = false;
            for (const row of rows) {
                const key = failureKey(row);
                if (seen.has(key))
                    continue;
                seen.add(key);
                changed = true;
            }
            if (changed) {
                persist();
                if (operations.get(sessionId)?.result?.status === 'ready')
                    setPreviewOperation(null);
                setOpened(true);
            }
        }, [sessionId, revision]);
        React.useEffect(() => {
            const node = dialog.current;
            if (!node || !opened)
                return;
            const opener = document.activeElement;
            if (typeof node.showModal === 'function')
                node.showModal();
            else
                node.setAttribute('open', '');
            return () => {
                if (node.open && typeof node.close === 'function')
                    node.close();
                else
                    node.removeAttribute('open');
                if (opener?.isConnected)
                    opener.focus();
            };
        }, [opened]);
        const paused = rows.some(row => row.impact === 'story-paused');
        const details = (rows.length ? rows : historyRows).map(extensionFailureDetails).join('\n\n');
        const run = async (action) => {
            if (busy)
                return;
            setBusy(true);
            setError('');
            try {
                await action();
            }
            catch (cause) {
                if (current()) {
                    if (cause.previewInvalidated)
                        setPreviewOperation(null);
                    setError(cause instanceof Error ? cause.message : String(cause));
                }
            }
            finally {
                if (current())
                    setBusy(false);
            }
        };
        const showPreview = () => run(async () => {
            const operation = await inspect(sessionId, true);
            if (current())
                setPreviewOperation(operation);
        });
        const continueText = () => run(async () => {
            if (!previewOperation)
                return;
            const operation = previewOperation;
            const result = await prepare(sessionId, operation);
            if (!current())
                return;
            if (result.status !== 'ready' || !result.childSessionId) {
                setError(result.error ?? '创建结果尚未确认。请重试同一操作，原世界线和输入仍保留。');
                return;
            }
            await deps.openContinuation(result);
            if (operations.get(sessionId) === operation) {
                operation.preview = { ...operation.preview, draftText: '' };
                operation.result = { ...result, draftText: '' };
                operation.needsStatusRefresh = true;
                persist();
            }
            if (current()) {
                setOpened(false);
                setPreviewOperation(null);
            }
        });
        const button = (label, onClick, primary = false) => h('button', {
            type: 'button', className: 'dsh-rp-btn' + (primary ? ' dsh-rp-primary' : ''),
            disabled: busy, onClick,
        }, label);
        if (!historyRows.length)
            return null;
        return h(React.Fragment, null, h('style', null, `.rp-extension-entry{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:8500;max-width:calc(100vw - 32px);min-height:44px}
        .rp-extension-dialog{max-width:min(640px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto}
        .rp-extension-dialog pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:35vh;overflow:auto;font-size:13px}
        .rp-extension-dialog .dsh-rp-confirm-actions{display:flex;flex-wrap:wrap;gap:8px}
        .rp-extension-dialog .dsh-rp-btn{min-height:44px;white-space:normal;overflow-wrap:anywhere}
        .rp-extension-dialog p{line-height:1.7;overflow-wrap:anywhere}`), h('button', { type: 'button', className: 'dsh-rp-btn rp-extension-entry',
            onClick: () => {
                if (operations.get(sessionId)?.result?.status === 'ready')
                    setPreviewOperation(null);
                setOpened(true);
            }, 'aria-label': rows.length ? '查看当前会话功能降级' : '查看扩展故障记录' }, rows.length ? '查看功能降级' : '查看故障记录'), h('dialog', { ref: dialog, className: 'dsh-rp-confirm-dialog rp-extension-dialog',
            'aria-label': '当前会话功能降级', onCancel: (event) => {
                event.preventDefault();
                setOpened(false);
            } }, h('strong', null, rows.length === 0 ? '先前扩展故障记录'
            : paused ? '当前会话高级功能已暂停' : '当前会话部分功能已降级'), h('p', null, rows.length === 0 ? '对应故障已经结束。保留诊断便于反馈与核查。'
            : paused ? '当前轮的高级状态尚未确认。你可以通过酒馆侧聊修复，或明确选择创建纯文字续玩世界线。'
                : '以下高级功能遇到故障，其余可用功能可以继续使用。'), h('p', null, '可以打开酒馆侧聊讨论修复，也可以复制具体诊断反馈给角色卡作者。'), h('pre', { tabIndex: 0 }, details), preview && paused ? h('section', { 'aria-label': '纯文字续玩预览' }, h('p', null, `将保留 ${preview.retainedCards} 张卡、${preview.retainedWorldbook} 项世界书资料，`
            + `以及 ${preview.historyMessages} 条已确认剧情。将省略 ${preview.omittedCount} 项高级内容。`), h('p', null, preview.confirmedTurn == null ? '沿用可确认的静态资料与剧情。'
            : `静态设定取自第 ${preview.confirmedTurn} 回合已生效的资料，剧情保留当前已确认的消息版本。`), h('p', null, '动态设定与高级功能将停用，之后不会自动更新。原故障世界线完整保留。'), h('p', null, preview.attachmentCount > 0
            ? `失败输入会填入新世界线草稿，请重新添加 ${preview.attachmentCount} 个附件后自行发送。`
            : '失败输入会填入新世界线草稿，由你检查后自行发送。')) : null, error ? h('p', { role: 'alert' }, error) : null, busy ? h('p', { role: 'status' }, '正在处理，请稍候…') : null, h('div', { className: 'dsh-rp-confirm-actions' }, button('关闭', () => setOpened(false)), button('打开酒馆侧聊修复', () => {
            setOpened(false);
            deps.repair(sessionId, '请协助排查当前会话的高级扩展故障，并说明可行的修复步骤。\n\n' + details);
        }), button(copied ? '已复制诊断' : '复制诊断反馈作者', () => void run(async () => {
            await document.defaultView.navigator.clipboard.writeText(details);
            if (current())
                setCopied(true);
        })), paused ? button(preview ? '确认创建纯文字续玩' : '创建纯文字续玩', () => void (preview ? continueText() : showPreview()), true) : null)));
    }
    return { Host, reportExtensionFailure, replaceActivityFailures };
}
