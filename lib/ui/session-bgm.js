// Generated from runtime/alpha3/src/ui/session-bgm.ts; edit the TypeScript source.
import { fetchRoleplayText } from './panel-state.js';
const messageOf = (error) => String(error instanceof Error ? error.message : error);
/** The application owns playback. UI mounts and resource-list requests do not own it. */
export function createSessionBgm(createAudio = () => new Audio()) {
    let state = { sessionId: null, opened: false, panelPosition: { left: 16, top: 96 },
        resource: null, playback: 'idle', volume: 0.5, error: '' };
    let sourceIdentity;
    let audio = null;
    let removeAudioListeners = null;
    let attempt = 0;
    let selectionEpoch = 0;
    const listeners = new Set();
    const publish = (patch) => {
        state = { ...state, ...patch };
        for (const listener of listeners)
            listener();
    };
    const release = () => {
        // Invalidate pending play before pause/load can settle its old promise.
        attempt++;
        removeAudioListeners?.();
        removeAudioListeners = null;
        if (audio) {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
            audio = null;
        }
    };
    const stop = () => {
        selectionEpoch++;
        release();
        publish({ resource: null, playback: 'idle', error: '' });
    };
    const player = {
        getSnapshot: () => state,
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        setSession(sessionId) {
            if (sessionId === state.sessionId)
                return;
            selectionEpoch++;
            release();
            sourceIdentity = undefined;
            publish({ sessionId, opened: false, resource: null, playback: 'idle', error: '' });
        },
        open(opened, panelPosition = state.panelPosition) { publish({ opened, panelPosition }); },
        acceptSource(value) {
            if (value.sessionId !== state.sessionId)
                return;
            const imported = value.cardImport;
            const next = JSON.stringify([imported?.sourceRecordSessionId ?? value.sessionId, imported?.importId ?? null]);
            if (sourceIdentity !== undefined && sourceIdentity !== next)
                stop();
            sourceIdentity = next;
        },
        beginSourceSelection() {
            const ticket = ++selectionEpoch;
            // Only the playback owner can admit a reply after an import or session change.
            return (resource) => {
                if (ticket !== selectionEpoch)
                    return false;
                player.select(resource);
                return true;
            };
        },
        select(resource) {
            selectionEpoch++;
            if (resource?.id === state.resource?.id)
                return;
            release();
            if (resource && state.sessionId) {
                const selected = createAudio();
                selected.preload = 'none';
                selected.loop = true;
                selected.volume = state.volume;
                selected.src = resource.url ?? ('/api/roleplay/download?sessionId=' + encodeURIComponent(state.sessionId)
                    + '&resourceId=' + encodeURIComponent(resource.id));
                const onPause = () => {
                    if (selected.paused)
                        publish({ playback: 'paused' });
                };
                const onError = () => {
                    attempt++;
                    publish({ playback: 'paused', error: `音频播放失败（媒体错误 ${selected.error?.code ?? '未知'}），请重新选择音乐或重试。` });
                };
                selected.addEventListener('pause', onPause);
                selected.addEventListener('error', onError);
                removeAudioListeners = () => {
                    selected.removeEventListener('pause', onPause);
                    selected.removeEventListener('error', onError);
                };
                audio = selected;
            }
            publish({ resource, playback: resource ? 'paused' : 'idle', error: '' });
        },
        play() {
            if (!audio)
                return;
            const ticket = ++attempt;
            publish({ playback: 'starting', error: '' });
            try {
                // A media error persists until load(); manual Play retries the same track.
                if (audio.error)
                    audio.load();
                // Called directly from the click handler, before any await, to keep the user gesture.
                const pending = audio.play();
                void pending.then(() => {
                    if (ticket === attempt)
                        publish({ playback: 'playing' });
                }, error => {
                    if (ticket === attempt)
                        publish({ playback: 'paused', error: '无法播放音乐：' + messageOf(error) });
                });
            }
            catch (error) {
                publish({ playback: 'paused', error: '无法播放音乐：' + messageOf(error) });
            }
        },
        pause() {
            attempt++;
            audio?.pause();
            publish({ playback: state.resource ? 'paused' : 'idle' });
        },
        setVolume(volume) {
            if (audio)
                audio.volume = volume;
            publish({ volume });
        },
        dispose() {
            selectionEpoch++;
            release();
            sourceIdentity = undefined;
            publish({ sessionId: null, opened: false, resource: null, playback: 'idle', error: '' });
            listeners.clear();
        },
    };
    return player;
}
export function createSessionBgmControls({ React, player, jsonFetch, uploadFile }) {
    return function SessionBgmControls({ sessionId }) {
        const state = React.useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);
        const [choosing, setChoosing] = React.useState(false);
        const [resources, setResources] = React.useState(null);
        const [loading, setLoading] = React.useState(false);
        const [error, setError] = React.useState('');
        const [uploading, setUploading] = React.useState(false);
        const [uploadError, setUploadError] = React.useState('');
        const [uploadMessage, setUploadMessage] = React.useState('');
        const [sourceCatalog, setSourceCatalog] = React.useState(null);
        const [sourceLoading, setSourceLoading] = React.useState(false);
        const [sourceError, setSourceError] = React.useState('');
        const [sourceArchiving, setSourceArchiving] = React.useState(false);
        const sourceRequest = React.useRef(0);
        const sourceSelectionRequest = React.useRef(0);
        const request = React.useRef(0);
        const uploadRequest = React.useRef(0);
        const pendingUpload = React.useRef(null);
        React.useEffect(() => () => {
            request.current++;
            uploadRequest.current++;
            sourceRequest.current++;
            sourceSelectionRequest.current++;
        }, [sessionId]);
        const refreshSource = async () => {
            const ticket = ++sourceRequest.current;
            setSourceLoading(true);
            setSourceError('');
            try {
                const value = await jsonFetch('/api/roleplay/source-music?sessionId=' + encodeURIComponent(sessionId));
                if (ticket === sourceRequest.current)
                    setSourceCatalog(value);
            }
            catch (failure) {
                if (ticket === sourceRequest.current)
                    setSourceError('无法读取角色卡音乐：' + messageOf(failure));
            }
            finally {
                if (ticket === sourceRequest.current)
                    setSourceLoading(false);
            }
        };
        const archiveSource = async (candidateId) => {
            if (!sourceCatalog?.sourceHash)
                return;
            const ticket = ++sourceSelectionRequest.current;
            const commitSelection = player.beginSourceSelection();
            setSourceArchiving(true);
            setSourceError('');
            try {
                const value = await jsonFetch('/api/roleplay/source-music', {
                    method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
                    body: JSON.stringify({ sessionId, sourceHash: sourceCatalog.sourceHash, candidateId }),
                });
                if (ticket === sourceSelectionRequest.current && commitSelection(value.resource)) {
                    setUploadMessage(value.resource.url ? '已选择角色卡网链音乐，请点击播放。' : '角色卡音乐已入库，请点击播放。');
                    if (!value.resource.url)
                        await refresh();
                }
            }
            catch (failure) {
                if (ticket === sourceSelectionRequest.current)
                    setSourceError('角色卡音乐选择失败：' + messageOf(failure));
            }
            finally {
                if (ticket === sourceSelectionRequest.current)
                    setSourceArchiving(false);
            }
        };
        const refresh = async () => {
            const ticket = ++request.current;
            setLoading(true);
            setError('');
            try {
                const { response, raw } = await fetchRoleplayText(`/api/roleplay/resources?sessionId=${encodeURIComponent(sessionId)}`);
                const value = JSON.parse(raw);
                if (!response.ok || value.ok === false)
                    throw new Error(value.error ?? '资源刷新失败');
                if (ticket === request.current) {
                    setResources(value.resources.filter(resource => resource.type.startsWith('audio/')));
                }
            }
            catch (failure) {
                if (ticket === request.current)
                    setError('无法读取音乐资源：' + messageOf(failure));
            }
            finally {
                if (ticket === request.current)
                    setLoading(false);
            }
        };
        const upload = async (file) => {
            if (file) {
                pendingUpload.current = null;
                setUploadMessage('');
                if (!/\.(mp3|wav|ogg|m4a|flac|webm)$/i.test(file.name)) {
                    setUploadError('请选择 MP3、WAV、OGG、M4A、FLAC 或 WebM 音频。');
                    return;
                }
                if (file.size === 0 || file.size > 20_000_000) {
                    setUploadError('音乐文件须非空且不超过 20 MB。');
                    return;
                }
                pendingUpload.current = { file, requestId: crypto.randomUUID() };
            }
            const pending = pendingUpload.current;
            if (!pending)
                return;
            const ticket = ++uploadRequest.current;
            setUploading(true);
            setUploadError('');
            setUploadMessage('');
            try {
                // A lost archive response reuses this receipt and request, without uploading again.
                pending.receiptId ??= (await uploadFile(sessionId, pending.file, pending.file.name)).receiptId;
                await jsonFetch('/api/roleplay/music', {
                    method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
                    body: JSON.stringify({ sessionId, attachment: { receiptId: pending.receiptId }, requestId: pending.requestId }),
                });
                if (ticket === uploadRequest.current) {
                    pendingUpload.current = null;
                    setUploadMessage('音乐已存入资源库，请选择后播放。');
                    await refresh();
                }
            }
            catch (failure) {
                if (ticket === uploadRequest.current)
                    setUploadError('音乐入库失败：' + messageOf(failure));
            }
            finally {
                if (ticket === uploadRequest.current)
                    setUploading(false);
            }
        };
        const h = React.createElement;
        if (!state.opened)
            return null;
        return h('section', {
            id: 'dsh-rp-bgm-panel',
            'aria-label': '会话背景音乐',
            style: { position: 'fixed', ...state.panelPosition, zIndex: 1050, width: 280,
                boxSizing: 'border-box',
                maxWidth: 'calc(100vw - 32px)', maxHeight: `calc(100dvh - ${state.panelPosition.top + 72}px)`, overflowY: 'auto',
                padding: 12,
                border: '1px solid var(--dsw-alias-border-l2, #ccc)', borderRadius: 12,
                background: 'var(--dsw-alias-bg-layer-1, #fffaf6)', color: 'var(--dsw-alias-label-primary, #413a3d)',
                boxShadow: '0 3px 16px #0002' },
        }, h('strong', null, '背景音乐'), h('button', { type: 'button', className: 'dsh-rp-btn', style: { float: 'right' },
            'aria-expanded': true, onClick: () => player.open(false) }, '收起音乐'), h('div', { style: { margin: '6px 0', overflowWrap: 'anywhere' } }, state.resource?.name ?? '尚未选择音乐'), h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, h('button', { type: 'button', className: 'dsh-rp-btn', onClick: () => {
                setChoosing(!choosing);
                if (!choosing) {
                    void refresh();
                    void refreshSource();
                }
            }, 'aria-expanded': choosing }, choosing ? '收起选择' : '选择音乐'), h('button', { type: 'button', className: 'dsh-rp-btn',
            disabled: !state.resource || state.playback === 'playing' || state.playback === 'starting',
            onClick: () => player.play() }, state.playback === 'starting' ? '加载中…' : '播放'), h('button', { type: 'button', className: 'dsh-rp-btn',
            disabled: state.playback !== 'playing' && state.playback !== 'starting',
            onClick: () => player.pause() }, '暂停')), h('label', { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 } }, '音量', h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: state.volume,
            'aria-label': '背景音乐音量', onChange: (event) => {
                player.setVolume(Number(event.currentTarget.value));
            }, style: { flex: 1, minWidth: 0 } })), state.error ? h('div', { role: 'alert', style: { marginTop: 8 } }, state.error) : null, choosing ? h('div', { style: { marginTop: 8 } }, h('strong', null, '角色卡内音乐'), h('button', { type: 'button', className: 'dsh-rp-btn', disabled: sourceLoading || sourceArchiving,
            onClick: () => { void refreshSource(); } }, sourceLoading ? '读取中…' : '刷新角色卡音乐'), sourceError ? h('div', { role: 'alert' }, sourceError) : null, sourceCatalog?.candidates.length === 0 ? h('p', null, '当前角色卡没有可选择的音频。') : null, h('div', { style: { maxHeight: '35vh', overflowY: 'auto' } }, sourceCatalog?.candidates.map(candidate => h('button', { key: candidate.candidateId, type: 'button',
            className: 'dsh-rp-btn', disabled: sourceArchiving || sourceLoading,
            style: { display: 'block', width: '100%', boxSizing: 'border-box', margin: '4px 0 0' },
            onClick: () => { void archiveSource(candidate.candidateId); } }, sourceArchiving ? '音乐选择中…' : (candidate.storage === 'remote' ? '选择网链音乐 · ' : '入库并选择 · ') + candidate.name))), h('label', { style: { display: 'block', marginBottom: 8 } }, uploading ? '音乐入库中…' : '上传音乐', h('input', { type: 'file', accept: '.mp3,.wav,.ogg,.m4a,.flac,.webm,audio/*', disabled: uploading,
            'aria-label': '上传背景音乐', style: { display: 'block', width: '100%', marginTop: 4 },
            onChange: (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file)
                    void upload(file);
            } })), uploadError ? h('div', { role: 'alert' }, uploadError, pendingUpload.current ? h('button', { type: 'button', className: 'dsh-rp-btn', disabled: uploading,
            onClick: () => { void upload(); } }, '重试入库') : null) : null, uploadMessage ? h('p', { role: 'status' }, uploadMessage) : null, h('button', { type: 'button', className: 'dsh-rp-btn', disabled: loading,
            onClick: () => { void refresh(); } }, loading ? '读取中…' : '刷新资源'), error ? h('div', { role: 'alert' }, error) : null, resources?.length === 0 ? h('p', { role: 'status' }, '资源库暂无可播放的音乐。') : null, resources?.length ? h('select', { 'aria-label': '选择背景音乐资源', value: state.resource?.id ?? '',
            style: { display: 'block', width: '100%', marginTop: 8 },
            onChange: (event) => {
                player.select(resources.find(resource => resource.id === event.currentTarget.value) ?? null);
            } }, h('option', { value: '' }, '请选择音乐'), ...resources.map(resource => h('option', { key: resource.id, value: resource.id }, resource.name))) : null) : null);
    };
}
