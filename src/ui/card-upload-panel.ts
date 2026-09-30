import type * as ReactAPI from 'react';
import {CardUploadRequestError, createCardUploadRequestJournal} from './card-upload-request.js';
import type {CardUploadRequestIndex, CardUploadRequestStorage} from './card-upload-request.js';

export interface CardUploadPanelProps {
    sessionId: string;
    onImported?(): void;
}
export interface CardUploadPanelDependencies {
    React: typeof ReactAPI;
    jsonFetch<T>(url: string, init?: RequestInit): Promise<T>;
    toast(text: string): void;
    confirmWithDialog(document: Document, message: string, options?: {
        title?: string;
        confirmLabel?: string;
    }): Promise<boolean>;
    uploadFile(sessionId: string, file: Blob, name: string): Promise<{receiptId: string}>;
    storage?: CardUploadRequestStorage;
}
interface PanelState {
    sessionId: string;
    file: File | null;
    index: CardUploadRequestIndex | null;
    error: string;
    busy: boolean;
    terminal: TerminalImport | null;
}
interface TerminalImport {
    index: CardUploadRequestIndex;
    jobId: string;
    status: 'failed' | 'cancelled';
}
interface PanelOperation {
    sessionId: string;
    live: boolean;
    busy: boolean;
    receiptId: string | null;
}
interface ImportJob {id?: string; status?: string; requestId?: string}
interface ImportReply {job?: ImportJob}
const validJobId = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const sameIndex = (a: CardUploadRequestIndex | null, b: CardUploadRequestIndex) =>
    a !== null && a.schemaVersion === b.schemaVersion && a.sessionId === b.sessionId && a.receiptId === b.receiptId
    && a.requestId === b.requestId && a.createdAt === b.createdAt;
const safeFailure = (cause: unknown, fallback: string) =>
    cause instanceof CardUploadRequestError ? cause.message : fallback;
const fileFailure = (file: File) => {
    if (!/\.(png|json|md|txt)$/i.test(file.name)) return '请选择 PNG、JSON、MD 或 TXT 格式的角色卡';
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > 20_000_000) {
        return '角色卡文件须非空且不超过 20 MB';
    }
    return '';
};

export function createCardUploadPanel({React, jsonFetch, toast, confirmWithDialog, uploadFile, storage}: CardUploadPanelDependencies) {
    const journal = createCardUploadRequestJournal({storage});
    const load = (sessionId: string): PanelState => {
        try {
            return {sessionId, file: null, index: journal.read(sessionId) ?? journal.volatilePending(sessionId),
                error: '', busy: false, terminal: null};
        } catch (cause) {
            return {sessionId, file: null, index: null, busy: false, terminal: null,
                error: safeFailure(cause, '无法核对角色卡上传恢复标识；已停止提交')};
        }
    };
    return function CardUploadPanel({sessionId, onImported}: CardUploadPanelProps) {
        const [state, setState] = React.useState<PanelState>(() => load(sessionId));
        const operation = React.useRef<PanelOperation>({sessionId, live: true, busy: false,
            receiptId: state.index?.receiptId ?? null});
        if (operation.current.sessionId !== sessionId) {
            operation.current.live = false;
            operation.current = {sessionId, live: true, busy: false, receiptId: null};
        }
        React.useEffect(() => {
            const owner = operation.current;
            owner.live = true;
            const loaded = load(sessionId);
            owner.receiptId = loaded.index?.receiptId ?? null;
            setState(loaded);
            return () => {owner.live = false;};
        }, [sessionId]);
        const current = state.sessionId === sessionId ? state : {
            sessionId, file: null, index: null, error: '', busy: true, terminal: null,
        };
        const showError = (message: string) => {
            setState(value => ({...value, error: message}));
            toast(message);
        };
        const selectFile = (event: ReactAPI.ChangeEvent<HTMLInputElement>) => {
            const owner = operation.current;
            if (!owner.live || owner.busy) return;
            try {
                const index = journal.read(sessionId);
                if (index || owner.receiptId) {
                    setState(value => ({...value, index}));
                    showError('当前对话还有待确认的原导入任务；请先确认同一次导入');
                    return;
                }
                const file = event.currentTarget.files?.[0] ?? null;
                const error = file ? fileFailure(file) : '';
                setState({sessionId, file: error ? null : file, index: null, error, busy: false, terminal: null});
            } catch (cause) {
                showError(safeFailure(cause, '无法核对角色卡上传恢复标识；已停止提交'));
            }
        };
        const submit = async () => {
            const owner = operation.current;
            if (!owner.live || owner.busy || current.busy) return;
            owner.busy = true;
            setState(value => ({...value, busy: true, error: '', terminal: null}));
            const live = () => owner.live && operation.current === owner;
            let stage: 'preflight' | 'upload' | 'post' = 'preflight';
            try {
                let index = journal.read(sessionId);
                const recovered = Boolean(index || owner.receiptId);
                const file = current.file;
                if (!index && !owner.receiptId) {
                    if (!file) throw new CardUploadRequestError('请先选择角色卡文件');
                    const error = fileFailure(file);
                    if (error) throw new CardUploadRequestError(error);
                }
                const confirmed = await confirmWithDialog(document,
                    recovered ? '确认原导入任务会继续同一次导入，并可能替换当前人设。确定继续？'
                        : '导入会替换当前人设，确定上传并导入这张角色卡？',
                    {title: recovered ? '确认原导入任务' : '导入角色卡', confirmLabel: recovered ? '确认原导入任务' : '上传并导入'});
                if (!confirmed || !live()) return;
                // Re-read after confirmation: another view may have admitted an import.
                const pending = journal.read(sessionId);
                if (index && !sameIndex(pending, index)) {
                    throw new CardUploadRequestError('当前恢复标识已变化；请重新核对原导入任务');
                }
                if (!index && pending) {
                    setState(value => ({...value, index: pending, file: null}));
                    throw new CardUploadRequestError('当前对话已有待确认的原导入任务；请重新确认同一次导入');
                }
                index = pending ?? index;
                if (!index) {
                    if (!owner.receiptId) {
                        stage = 'upload';
                        const receipt = await uploadFile(sessionId, file!, file!.name);
                        if (!live()) return;
                        owner.receiptId = receipt.receiptId;
                    }
                    stage = 'preflight';
                    index = journal.prepare(sessionId, owner.receiptId!).index;
                }
                if (!live()) return;
                setState(value => ({...value, index, file: null}));
                stage = 'post';
                const reply = await jsonFetch<ImportReply>('/api/roleplay/jobs', {
                    method: 'POST', headers: {'content-type': 'application/json'},
                    body: JSON.stringify({sessionId, kind: 'card-import',
                        attachment: {receiptId: index.receiptId}, requestId: index.requestId}),
                });
                if (!live()) return;
                if (reply?.job?.status === 'completed') {
                    if (reply.job.requestId !== index.requestId) {
                        throw new CardUploadRequestError('完成回执与原请求标识不一致；请保留恢复标识并核对原导入任务');
                    }
                    if (!journal.clear(index)) {
                        throw new CardUploadRequestError('当前恢复标识已变化；请保留标识并核对原导入任务');
                    }
                    owner.receiptId = null;
                    setState({sessionId, file: null, index: null, error: '', busy: true, terminal: null});
                    toast(recovered ? '原导入任务已完成，请核对当前角色卡和开场' : '角色卡已导入，请选择开场');
                    onImported?.();
                } else if (reply?.job?.status === 'failed' || reply?.job?.status === 'cancelled') {
                    if (reply.job.requestId === index.requestId && validJobId(reply.job.id)) {
                        const terminal: TerminalImport = {index, jobId: reply.job.id, status: reply.job.status};
                        setState(value => ({...value, terminal}));
                        showError('原导入任务失败或已取消，恢复标识已保留；可在任务列表重试，或显式结束这次导入');
                    } else {
                        showError('失败或取消回执的任务身份无法确认；恢复标识已保留，请核对原导入任务');
                    }
                } else if (['queued', 'running', 'waiting-main', 'pending'].includes(reply?.job?.status ?? '')) {
                    toast('导入任务已提交，恢复标识已保留；请在任务列表查看进度');
                } else {
                    showError('原导入任务状态无法确认；恢复标识已保留，请核对任务列表后确认同一任务');
                }
            } catch (cause) {
                if (!live()) return;
                const fallback = stage === 'upload' ? '角色卡上传未取得可用回执；尚未提交导入，可重新选择同一文件后重试'
                    : stage === 'post' ? '导入回执未能确认；恢复标识已保留。若宿主重启导致上传回执失效，请人工核对原导入任务'
                        : '无法准备角色卡导入；尚未提交导入，请核对浏览器站点存储';
                showError(safeFailure(cause, fallback));
            } finally {
                owner.busy = false;
                if (live()) setState(value => ({...value, busy: false}));
            }
        };
        const discard = async () => {
            const owner = operation.current, terminal = current.terminal;
            if (!owner.live || owner.busy || current.busy || !terminal) return;
            owner.busy = true;
            setState(value => ({...value, busy: true, error: ''}));
            const live = () => owner.live && operation.current === owner;
            try {
                const confirmed = await confirmWithDialog(document,
                    '结束这次失败或取消的导入尝试，保留原任务与来源记录，然后可选择其他文件。只清除本地恢复标识，不回滚当前角色卡。',
                    {title: '结束这次导入', confirmLabel: '结束这次导入'});
                if (!confirmed || !live()) return;
                if (!sameIndex(journal.read(sessionId), terminal.index)) {
                    throw new CardUploadRequestError('当前恢复标识已变化；不能结束原导入尝试，请重新核对');
                }
                const reply = await jsonFetch<{jobs?: ImportJob[]}>(
                    `/api/roleplay/jobs?sessionId=${encodeURIComponent(sessionId)}`);
                if (!live()) return;
                const jobs = reply?.jobs?.filter(job => job.id === terminal.jobId) ?? [];
                const job = jobs.length === 1 ? jobs[0] : null;
                if (!job || job.requestId !== terminal.index.requestId
                    || job.status !== 'failed' && job.status !== 'cancelled') {
                    throw new CardUploadRequestError('原任务的失败或取消状态无法确认；恢复标识已保留，请重新确认原导入任务');
                }
                if (!sameIndex(journal.read(sessionId), terminal.index) || !journal.clear(terminal.index)) {
                    throw new CardUploadRequestError('当前恢复标识已变化；恢复标识已保留，请重新核对原导入任务');
                }
                owner.receiptId = null;
                setState({sessionId, file: null, index: null, error: '', busy: true, terminal: null});
                toast('这次导入尝试已结束，可选择其他文件；原任务与来源记录已保留');
            } catch (cause) {
                if (live()) showError(safeFailure(cause, '未能核对原任务状态；恢复标识已保留，请稍后重试结束这次导入'));
            } finally {
                owner.busy = false;
                if (live()) setState(value => ({...value, busy: false}));
            }
        };
        const recovering = Boolean(current.index || operation.current.receiptId);
        const h = React.createElement;
        return h('fieldset', {className: 'dsh-rp-card-upload', disabled: current.busy},
            h('legend', null, '上传角色卡'),
            h('p', null, '支持 PNG、JSON、MD、TXT，最大 20 MB。确认导入后会替换当前人设。'),
            h('label', null, '选择角色卡文件', h('input', {type: 'file', accept: '.png,.json,.md,.txt',
                disabled: recovering || Boolean(current.error), onChange: selectFile})),
            current.file ? h('p', null, '角色卡文件已选择，等待确认导入') : null,
            recovering ? h('p', null, '已保留原导入任务的恢复标识；确认会使用同一任务，不需要重新选择文件。') : null,
            current.error ? h('p', {className: 'dsh-rp-error', role: 'alert'}, current.error) : null,
            h('button', {type: 'button', disabled: !recovering && !current.file, onClick: submit},
                current.busy ? '正在处理…' : recovering ? '确认原导入任务' : '上传并导入'),
            current.terminal ? h('button', {type: 'button', onClick: discard}, '结束这次导入') : null,
            current.error ? h('button', {type: 'button', onClick: () => {
                if (!operation.current.busy) {
                    const loaded = load(sessionId);
                    if (!loaded.error) operation.current.receiptId = loaded.index?.receiptId ?? null;
                    setState(loaded);
                }
            }}, '重新核对恢复标识') : null);
    };
}
