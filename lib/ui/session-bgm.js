// Generated from runtime/alpha3/src/ui/session-bgm.ts; edit the TypeScript source.
import { fetchRoleplayText } from './panel-state.js';
import { createToolWindow } from './tool-window.js';
const messageOf = (error) => String(error instanceof Error ? error.message : error);
/** The application owns playback. UI mounts and resource-list requests do not own it. */
export function createSessionBgm(createAudio = () => new Audio()) {
    let state = { sessionId: null, opened: false, panelPosition: { left: 16, top: 96 },
        resource: null, playback: 'idle', volume: 0.5, error: '' };
    let sourceIdentity;
    let sourceCatalogHash;
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
        sourceCatalogHash = undefined;
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
            sourceCatalogHash = undefined;
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
        acceptSourceCatalog(sessionId, sourceHash) {
            // Main selection changes before the old Controls effect is cleaned up.
            if (sessionId !== state.sessionId)
                return false;
            if (sourceCatalogHash !== undefined && sourceCatalogHash !== sourceHash)
                selectionEpoch++;
            sourceCatalogHash = sourceHash;
            return true;
        },
        beginSourceSelection() {
            const ticket = ++selectionEpoch;
            // Only the playback owner can admit a reply after a Source or session change.
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
            sourceCatalogHash = undefined;
            publish({ sessionId: null, opened: false, resource: null, playback: 'idle', error: '' });
            listeners.clear();
        },
    };
    return player;
}
export const SESSION_BGM_CSS = `
.rp-bgm-content{padding:16px;color:var(--rp-tool-ink,#49392c);font-family:inherit;font-size:14px;line-height:1.5}
.rp-bgm-content button,.rp-bgm-content select{box-sizing:border-box;min-height:44px;border:1px solid var(--rp-tool-border,#dccbb3);border-radius:10px;background:var(--rp-tool-paper,#fffaf1);color:inherit;padding:9px 12px;font:inherit;cursor:pointer}
.rp-bgm-content button:hover:not(:disabled),.rp-bgm-upload:hover{border-color:var(--rp-tool-accent,#8b571c);background:var(--rp-tool-soft,#f3ead9)}
.rp-bgm-content button:focus-visible,.rp-bgm-content select:focus-visible,.rp-bgm-content input:focus-visible{outline:3px solid var(--rp-tool-accent,#8b571c);outline-offset:3px}
.rp-bgm-content button:disabled{opacity:.5;cursor:default}
.rp-bgm-now{display:flex;gap:14px;align-items:center;padding:16px;border:1px solid var(--rp-tool-border,#dccbb3);border-radius:12px;background:var(--rp-tool-soft,#f3ead9)}
.rp-bgm-art{display:grid;place-items:center;flex:none;width:52px;height:60px;border:1px solid var(--rp-tool-border,#dccbb3);border-radius:8px;color:var(--rp-tool-accent,#8b571c);background:var(--rp-tool-paper,#fffaf1)}
.rp-bgm-art svg{width:28px;height:28px}
.rp-bgm-track{min-width:0;flex:1}
.rp-bgm-track-name{margin:0;font-size:15px;font-weight:600;overflow-wrap:anywhere}
.rp-bgm-track-state{margin:5px 0 0;color:var(--rp-tool-muted,#766553);font-size:12px}
.rp-bgm-transport{display:flex;gap:10px;margin:16px 0}
.rp-bgm-transport button{display:flex;align-items:center;justify-content:center;gap:8px;flex:1}
.rp-bgm-transport svg,.rp-bgm-upload svg{width:18px;height:18px;flex:none}
.rp-bgm-transport .rp-bgm-play{border-color:var(--rp-tool-accent,#8b571c);background:var(--rp-tool-accent,#8b571c);color:#fffaf1}
.rp-bgm-transport .rp-bgm-play:hover:not(:disabled){background:#734616;color:#fffaf1}
.rp-bgm-volume{display:grid;grid-template-columns:auto minmax(0,1fr) 3.5em;gap:12px;align-items:center;margin:6px 0 20px;font-size:13px}
.rp-bgm-volume input{width:100%;min-width:0;height:44px;margin:0;accent-color:var(--rp-tool-accent,#8b571c);cursor:pointer}
.rp-bgm-volume output{text-align:right;color:var(--rp-tool-muted,#766553);font-variant-numeric:tabular-nums}
.rp-bgm-picker{border-top:1px solid var(--rp-tool-border,#dccbb3);padding-top:16px}
.rp-bgm-section+.rp-bgm-section{margin-top:20px;padding-top:18px;border-top:1px solid var(--rp-tool-border,#dccbb3)}
.rp-bgm-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.rp-bgm-heading h3{margin:0;font-size:13px;font-weight:600}
.rp-bgm-heading button{font-size:12px;padding:8px 10px}
.rp-bgm-source-list{display:grid;gap:8px;max-height:240px;overflow-y:auto;padding:3px;margin:-3px}
.rp-bgm-source-list button{text-align:left;min-width:0;overflow-wrap:anywhere}
.rp-bgm-source-list small{display:block;margin-top:3px;font-size:12px;color:var(--rp-tool-muted,#766553)}
.rp-bgm-select{display:block;width:100%;margin-top:8px}
.rp-bgm-help,.rp-bgm-empty{margin:8px 0 0;font-size:12px;color:var(--rp-tool-muted,#766553)}
.rp-bgm-upload{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;box-sizing:border-box;border:1px dashed var(--rp-tool-border,#dccbb3);border-radius:10px;cursor:pointer;padding:10px 12px}
.rp-bgm-upload:focus-within{outline:3px solid var(--rp-tool-accent,#8b571c);outline-offset:3px}
.rp-bgm-upload input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.rp-bgm-upload[aria-disabled=true]{opacity:.5;cursor:default}
.rp-bgm-message,.rp-bgm-error{margin:12px 0 0;padding:10px 12px;border-radius:8px;overflow-wrap:anywhere;font-size:13px}
.rp-bgm-message{background:var(--rp-tool-soft,#f3ead9);color:var(--rp-tool-ink,#49392c)}
.rp-bgm-error{background:#f9e9e3;color:#923c2e}
.rp-bgm-error button{display:block;margin-top:8px}
`;
export function createSessionBgmControls({ React, player, jsonFetch, uploadFile }) {
    const ToolWindow = createToolWindow(React);
    const h = React.createElement;
    function icon(kind) {
        const paths = { music: 'M9 18V5l11-2v13M9 8l11-2', play: 'm9 5 11 7-11 7V5Z',
            pause: 'M8 5v14M16 5v14', upload: 'M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5' };
        return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
            strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: paths[kind] }), kind === 'music' ? h(React.Fragment, null, h('ellipse', { cx: 6, cy: 18, rx: 3, ry: 2 }), h('ellipse', { cx: 17, cy: 16, rx: 3, ry: 2 })) : null);
    }
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
                if (ticket === sourceRequest.current && player.acceptSourceCatalog(sessionId, value.sourceHash)) {
                    setSourceCatalog(value);
                }
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
                    setUploadMessage(value.resource.url ? '已选择角色卡网链音乐。' : '角色卡音乐已加入资源库。');
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
                    setUploadMessage('音乐已加入资源库。');
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
        if (!state.opened)
            return null;
        const active = state.playback === 'playing' || state.playback === 'starting';
        const playbackText = state.playback === 'playing' ? '正在循环播放' : state.playback === 'starting'
            ? '正在加载音频…' : state.resource ? '已暂停，点击播放继续' : '选择一首音乐，为故事配上声音';
        return h(React.Fragment, null, h('style', null, SESSION_BGM_CSS), h(ToolWindow, { id: 'dsh-rp-bgm-panel', title: '背景音乐', icon: 'music',
            onClose: () => player.open(false), initialPosition: state.panelPosition, initialSize: { w: 360, h: 560 } }, h('div', { className: 'rp-bgm-content' }, h('div', { className: 'rp-bgm-now' }, h('span', { className: 'rp-bgm-art' }, icon('music')), h('div', { className: 'rp-bgm-track' }, h('p', { className: 'rp-bgm-track-name' }, state.resource?.name ?? '尚未选择音乐'), h('p', { className: 'rp-bgm-track-state', role: 'status' }, playbackText))), h('div', { className: 'rp-bgm-transport' }, h('button', { type: 'button', className: 'rp-bgm-play', disabled: !state.resource,
            onClick: () => active ? player.pause() : player.play(),
            'aria-label': active ? '暂停背景音乐' : '播放背景音乐' }, icon(active ? 'pause' : 'play'), active ? '暂停' : '播放'), h('button', { type: 'button', onClick: () => {
                setChoosing(!choosing);
                if (!choosing) {
                    void refresh();
                    void refreshSource();
                }
            }, 'aria-expanded': choosing, 'aria-controls': 'dsh-rp-bgm-picker' }, choosing ? '收起选择' : '选择音乐')), h('label', { className: 'rp-bgm-volume' }, '音量', h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: state.volume,
            'aria-label': '背景音乐音量', 'aria-valuetext': Math.round(state.volume * 100) + '%',
            onChange: (event) => {
                player.setVolume(Number(event.currentTarget.value));
            } }), h('output', null, Math.round(state.volume * 100) + '%')), state.error ? h('div', { role: 'alert', className: 'rp-bgm-error' }, state.error) : null, choosing ? h('div', { id: 'dsh-rp-bgm-picker', className: 'rp-bgm-picker' }, h('section', { className: 'rp-bgm-section', 'aria-label': '角色卡内音乐' }, h('div', { className: 'rp-bgm-heading' }, h('h3', null, '角色卡内音乐'), h('button', { type: 'button', disabled: sourceLoading || sourceArchiving, 'aria-label': '刷新角色卡音乐',
            onClick: () => { void refreshSource(); } }, sourceLoading ? '读取中…' : '刷新')), sourceError ? h('div', { role: 'alert', className: 'rp-bgm-error' }, sourceError) : null, sourceArchiving ? h('p', { role: 'status', className: 'rp-bgm-help' }, '正在选择音乐…') : null, sourceCatalog?.candidates.length === 0 ? h('p', { className: 'rp-bgm-empty' }, '当前角色卡没有可选择的音频。') : null, h('div', { className: 'rp-bgm-source-list', 'aria-busy': sourceLoading || sourceArchiving }, sourceCatalog?.candidates.map(candidate => {
            const action = candidate.storage === 'unresolved' ? '资源待补全'
                : candidate.storage === 'remote' ? '选择网链音乐' : '入库并选择';
            return h('button', { key: candidate.candidateId, type: 'button',
                disabled: sourceArchiving || sourceLoading || candidate.storage === 'unresolved',
                title: candidate.reason, 'aria-label': action + ' · ' + candidate.name,
                onClick: () => { void archiveSource(candidate.candidateId); } }, candidate.name, h('small', null, candidate.storage === 'unresolved' ? candidate.reason : action));
        }))), h('section', { className: 'rp-bgm-section', 'aria-label': '资源库音乐' }, h('div', { className: 'rp-bgm-heading' }, h('h3', null, '资源库'), h('button', { type: 'button', disabled: loading, 'aria-label': '刷新音乐资源库',
            onClick: () => { void refresh(); } }, loading ? '读取中…' : '刷新')), error ? h('div', { role: 'alert', className: 'rp-bgm-error' }, error) : null, resources?.length === 0 ? h('p', { role: 'status', className: 'rp-bgm-empty' }, '资源库暂无音乐，可在下方上传。') : null, resources?.length ? h('select', { 'aria-label': '选择背景音乐资源', value: state.resource?.id ?? '',
            className: 'rp-bgm-select',
            onChange: (event) => {
                player.select(resources.find(resource => resource.id === event.currentTarget.value) ?? null);
            } }, h('option', { value: '' }, '请选择音乐'), ...resources.map(resource => h('option', { key: resource.id, value: resource.id }, resource.name))) : null), h('section', { className: 'rp-bgm-section', 'aria-label': '上传音乐' }, h('div', { className: 'rp-bgm-heading' }, h('h3', null, '添加音乐')), h('label', { className: 'rp-bgm-upload', 'aria-disabled': uploading }, icon('upload'), uploading ? '音乐入库中…' : '上传音乐文件', h('input', { type: 'file', accept: '.mp3,.wav,.ogg,.m4a,.flac,.webm,audio/*', disabled: uploading,
            'aria-label': '上传背景音乐',
            onChange: (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file)
                    void upload(file);
            } })), h('p', { className: 'rp-bgm-help' }, 'MP3、WAV、OGG、M4A、FLAC 或 WebM，最大 20 MB。'), uploadError ? h('div', { role: 'alert', className: 'rp-bgm-error' }, uploadError, pendingUpload.current ? h('button', { type: 'button', disabled: uploading,
            onClick: () => { void upload(); } }, '重试入库') : null) : null, uploadMessage ? h('p', { role: 'status', className: 'rp-bgm-message' }, uploadMessage) : null)) : null)));
    };
}
