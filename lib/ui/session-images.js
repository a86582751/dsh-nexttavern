// Generated from runtime/alpha3/src/ui/session-images.ts; edit the TypeScript source.
const emptyLoad = () => ({ gallery: 'loading', background: 'loading', portrait: 'loading' });
const errorText = (error) => error instanceof Error ? error.message : String(error);
/** One application owner survives Reader mounts; Source identity comes from the catalog. */
export function createSessionImages(jsonFetch) {
    let state = { sessionId: null, opened: false, catalog: null, browserImages: [], refreshing: false,
        selecting: false, gallery: null, background: null, portrait: null, load: emptyLoad(), error: '' };
    const listeners = new Set();
    let sourceImport;
    let pendingRefresh;
    let refreshAgain = false;
    let selectionRequest;
    let disposed = false;
    let nextBrowserImage = 0;
    const publish = (patch) => {
        state = { ...state, ...patch };
        for (const listener of listeners)
            listener();
    };
    const clearImages = () => {
        selectionRequest = undefined;
        publish({ gallery: null, background: null, portrait: null, selecting: false, load: emptyLoad() });
    };
    const acceptCatalog = (catalog) => {
        if (state.catalog?.sourceHash !== catalog.sourceHash)
            clearSelections(image => image.kind === 'source');
        publish({ catalog });
    };
    function clearSelections(matches) {
        const patch = {}, load = { ...state.load };
        for (const purpose of ['gallery', 'background', 'portrait']) {
            const selected = state[purpose];
            if (selected && matches(selected)) {
                patch[purpose] = null;
                load[purpose] = 'loading';
            }
        }
        publish({ ...patch, load });
    }
    function acceptBrowserImages(browserImages) {
        const retained = new Map(browserImages.map(candidate => [candidate.candidateId, candidate.selection]));
        const patch = { browserImages }, load = { ...state.load };
        for (const purpose of ['gallery', 'background', 'portrait']) {
            const selected = state[purpose];
            if (selected?.kind !== 'browser')
                continue;
            const current = retained.get(selected.candidateId);
            patch[purpose] = current ?? null;
            if (!current)
                load[purpose] = 'loading';
        }
        publish({ ...patch, load });
    }
    async function refresh() {
        const sid = state.sessionId;
        if (!sid || disposed)
            return;
        if (pendingRefresh) {
            refreshAgain = true;
            return pendingRefresh;
        }
        publish({ refreshing: true, error: '' });
        const request = Promise.resolve().then(async () => {
            try {
                const catalog = await jsonFetch('/api/roleplay/source-images?sessionId=' + encodeURIComponent(sid));
                if (!disposed && pendingRefresh === request && state.sessionId === sid)
                    acceptCatalog(catalog);
            }
            catch (error) {
                if (!disposed && pendingRefresh === request && state.sessionId === sid)
                    publish({ error: errorText(error) });
            }
        });
        pendingRefresh = request;
        try {
            await request;
        }
        finally {
            // The old request may finish after a session switch and a new request.
            if (pendingRefresh === request) {
                pendingRefresh = undefined;
                publish({ refreshing: false });
                const requested = refreshAgain;
                refreshAgain = false;
                if (requested && !disposed && state.sessionId === sid)
                    void refresh();
            }
        }
    }
    return {
        getSnapshot: () => state,
        subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        setSession(sessionId) {
            if (state.sessionId === sessionId)
                return;
            pendingRefresh = undefined;
            refreshAgain = false;
            selectionRequest = undefined;
            sourceImport = undefined;
            publish({ sessionId, opened: false, catalog: null, browserImages: [], refreshing: false, selecting: false,
                gallery: null, background: null, portrait: null, load: emptyLoad(), error: '' });
        },
        acceptState(value) {
            if (value.sessionId !== state.sessionId)
                return;
            const imported = value.cardImport;
            const identity = JSON.stringify([imported?.sourceRecordSessionId ?? value.sessionId, imported?.importId ?? null]);
            if (sourceImport !== undefined && sourceImport !== identity) {
                pendingRefresh = undefined;
                refreshAgain = false;
                clearImages();
                publish({ catalog: null, browserImages: [] });
            }
            sourceImport = identity;
            // State announces a refresh, but only the Source owner supplies a media hash.
            if (state.opened || state.gallery || state.background || state.portrait)
                void refresh();
        },
        open(opened) { publish({ opened }); if (opened)
            void refresh(); },
        refresh,
        acceptBrowserImages(sessionId, owner, pageId, images) {
            if (disposed || state.sessionId !== sessionId)
                return;
            const previous = state.browserImages.filter(candidate => candidate.selection.owner === owner
                && candidate.selection.pageId === pageId);
            const candidates = images.map(image => {
                const old = previous.find(candidate => candidate.selection.image.target.handle === image.target.handle);
                if (old && old.selection.url === image.url && old.selection.image.originalUrl === image.originalUrl) {
                    if (old.selection.name === image.name)
                        return old;
                    return { ...old, selection: { ...old.selection, image, name: image.name } };
                }
                const candidateId = 'browser-' + ++nextBrowserImage;
                return { candidateId, selection: { kind: 'browser', owner, pageId, image,
                        name: image.name, url: image.url, candidateId } };
            });
            acceptBrowserImages([...state.browserImages.filter(candidate => candidate.selection.owner !== owner
                    || candidate.selection.pageId !== pageId), ...candidates]);
        },
        releaseBrowserImages(owner) {
            acceptBrowserImages(state.browserImages.filter(candidate => candidate.selection.owner !== owner));
        },
        selectBrowser(candidateId) {
            const candidate = state.browserImages.find(value => value.candidateId === candidateId);
            if (!candidate)
                return;
            selectionRequest = undefined;
            publish({ gallery: candidate.selection, selecting: false, error: '', load: { ...state.load, gallery: 'loading' } });
        },
        async select(candidateId) {
            const sid = state.sessionId, catalog = state.catalog;
            if (!sid || !catalog?.sourceHash)
                return;
            const request = {};
            selectionRequest = request;
            publish({ selecting: true, error: '' });
            try {
                const { resource } = await jsonFetch('/api/roleplay/source-images', {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ sessionId: sid, sourceHash: catalog.sourceHash, candidateId }),
                });
                if (disposed || selectionRequest !== request || state.sessionId !== sid
                    || state.catalog?.sourceHash !== catalog.sourceHash)
                    return;
                const image = { kind: 'source', resource, name: catalog.candidates.find(candidate => candidate.candidateId === candidateId).name,
                    sourceHash: catalog.sourceHash,
                    url: resource.url ?? '/api/roleplay/download?sessionId=' + encodeURIComponent(sid)
                        + '&resourceId=' + encodeURIComponent(resource.id) };
                publish({ gallery: image, load: { ...state.load, gallery: 'loading' } });
            }
            catch (error) {
                if (!disposed && selectionRequest === request && state.sessionId === sid)
                    publish({ error: errorText(error) });
            }
            finally {
                if (selectionRequest === request) {
                    selectionRequest = undefined;
                    publish({ selecting: false });
                }
            }
        },
        useAs(purpose) {
            if (!state.gallery)
                return;
            publish({ [purpose]: state.gallery, load: { ...state.load, [purpose]: 'loading' } });
        },
        clear(purpose) { publish({ [purpose]: null, error: '' }); },
        imageResult(purpose, image, result) {
            const current = state[purpose];
            if (disposed || !current)
                return;
            if (image.kind === 'browser') {
                if (current.kind !== 'browser' || current.candidateId !== image.candidateId)
                    return;
            }
            else if (current !== image)
                return;
            publish({ load: { ...state.load, [purpose]: result } });
        },
        dispose() {
            disposed = true;
            pendingRefresh = undefined;
            refreshAgain = false;
            selectionRequest = undefined;
            publish({ sessionId: null, catalog: null, browserImages: [], opened: false, refreshing: false, selecting: false,
                gallery: null, background: null, portrait: null, load: emptyLoad(), error: '' });
            listeners.clear();
        },
    };
}
export const SESSION_IMAGES_CSS = `
.rp-images-controls{position:fixed;left:16px;top:80px;z-index:1049;color:#514039;font:13px/1.5 sans-serif}
.rp-images-controls button{border:1px solid #b7a59c;border-radius:7px;background:#fffaf4;color:inherit;padding:5px 9px;cursor:pointer}
.rp-images-controls button:disabled{opacity:.5;cursor:default}
.rp-images-panel{width:min(340px,calc(100vw - 32px));max-height:calc(100dvh - 150px);overflow:auto;padding:12px;background:#fffaf4;border:1px solid #c8b7ab;border-radius:12px;box-shadow:0 6px 26px #36231726}
.rp-images-actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.rp-images-list{display:grid;gap:5px;max-height:180px;overflow:auto}
.rp-images-candidate{text-align:left;overflow-wrap:anywhere}
.rp-images-candidate small{display:block;color:#7d6c65;font-size:11px}
.rp-images-preview{display:block;width:100%;height:190px;object-fit:contain;background:#eee7de;border-radius:7px}
.rp-images-error{color:#a33c36;overflow-wrap:anywhere}
.rp-image-scene{position:relative;isolation:isolate;display:flex;flex-direction:column;flex:1;min-height:0;height:100%;width:100%;overflow:hidden}
.rp-image-scene>.rp-reader-view{position:relative;z-index:1}
.rp-image-background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.22;z-index:0;pointer-events:none}
.rp-image-portrait{position:absolute;right:8px;bottom:14px;width:min(22%,210px);max-height:65dvh;object-fit:contain;z-index:2;pointer-events:none}
.rp-image-with-portrait>.rp-reader-view{padding-right:calc(22% + 16px)}
.rp-image-scene-error{padding:6px 12px;color:#a33c36;font-size:12px}
`;
export function createSessionImageComponents(deps) {
    const { React, images } = deps, h = React.createElement;
    const useImages = () => React.useSyncExternalStore(images.subscribe, images.getSnapshot, images.getSnapshot);
    function image(purpose, selected, className) {
        const identity = selected.kind === 'source' ? selected.sourceHash + ':' + selected.resource.id : selected.candidateId;
        return h('img', { key: purpose + ':' + identity, className, src: selected.url,
            alt: selected.name, onLoad: () => images.imageResult(purpose, selected, 'ready'),
            onError: () => images.imageResult(purpose, selected, 'failed') });
    }
    function Controls() {
        const state = useImages();
        if (!state.sessionId)
            return null;
        return h('section', { className: 'rp-images-controls', 'aria-label': '角色卡图片' }, h('style', null, SESSION_IMAGES_CSS), h('button', { type: 'button', onClick: () => images.open(!state.opened), 'aria-expanded': state.opened }, '图片'), state.opened ? h('div', { className: 'rp-images-panel' }, h('div', { className: 'rp-images-actions' }, h('button', { type: 'button', disabled: state.refreshing, onClick: () => void images.refresh() }, state.refreshing ? '读取中…' : '刷新图片'), h('button', { type: 'button', onClick: () => images.open(false) }, '收起')), state.error ? h('p', { className: 'rp-images-error', role: 'status' }, state.error) : null, ...(state.catalog?.diagnostics ?? []).map((diagnostic, index) => h('p', { key: 'diagnostic:' + index, className: 'rp-images-error' }, diagnostic.message + ' · ' + diagnostic.position)), state.gallery && state.load.gallery !== 'failed' ? image('gallery', state.gallery, 'rp-images-preview') : null, state.gallery && state.load.gallery === 'failed' ? h('p', { className: 'rp-images-error', role: 'status' }, '图片加载失败，请重新选择或刷新。') : null, state.gallery ? h('div', { className: 'rp-images-actions' }, h('button', { type: 'button', onClick: () => images.useAs('background') }, '作为背景'), h('button', { type: 'button', onClick: () => images.useAs('portrait') }, '作为立绘'), h('button', { type: 'button', onClick: () => images.clear('gallery') }, '清除预览')) : null, h('div', { className: 'rp-images-actions' }, state.background ? h('button', { type: 'button', onClick: () => images.clear('background') }, '清除背景') : null, state.portrait ? h('button', { type: 'button', onClick: () => images.clear('portrait') }, '清除立绘') : null), h('div', { className: 'rp-images-list' }, ...(state.catalog?.candidates ?? []).map(candidate => h('button', { key: candidate.candidateId, type: 'button', className: 'rp-images-candidate',
            disabled: state.selecting || candidate.storage === 'unresolved',
            onClick: () => void images.select(candidate.candidateId) }, candidate.name, h('small', null, candidate.storage === 'unresolved' ? '原路径未绑定资源：' + candidate.uri : candidate.carrier + ' · ' + candidate.position)))), h('div', { className: 'rp-images-list' }, ...state.browserImages.map(candidate => h('button', { key: candidate.candidateId, type: 'button', className: 'rp-images-candidate',
            onClick: () => images.selectBrowser(candidate.candidateId) }, candidate.selection.name, h('small', null, '作者页面当前图片')))), state.catalog?.candidates.length === 0 && state.browserImages.length === 0
            ? h('p', null, '当前角色卡没有可发现的图片。') : null) : null);
    }
    function Scene(props) {
        const state = useImages();
        if (props.sessionId !== state.sessionId)
            return h(React.Fragment, null, props.children);
        return h('div', { className: 'rp-image-scene' + (state.portrait && state.load.portrait !== 'failed' ? ' rp-image-with-portrait' : '') }, state.background && state.load.background !== 'failed' ? image('background', state.background, 'rp-image-background') : null, state.portrait && state.load.portrait !== 'failed' ? image('portrait', state.portrait, 'rp-image-portrait') : null, state.background && state.load.background === 'failed' ? h('div', { className: 'rp-image-scene-error', role: 'status' }, '背景图片加载失败，可在图片面板重新选择。') : null, state.portrait && state.load.portrait === 'failed' ? h('div', { className: 'rp-image-scene-error', role: 'status' }, '立绘加载失败，可在图片面板重新选择。') : null, props.children);
    }
    return { Controls, Scene };
}
