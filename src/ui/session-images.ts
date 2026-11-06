import type * as ReactAPI from 'react'
import type {SourceImageCandidateV1, SourceImageCatalogV1} from '../core/roleplay-source-images.js'
import type {ReaderNativeImageV1} from '../core/reader-native-document-types.js'
import {createToolWindow} from './tool-window.js'

export type SessionImageCandidate = SourceImageCandidateV1
export type SessionImageCatalog = SourceImageCatalogV1
export interface SessionImageResource {id: string; name: string; type: string; url?: string}
export type SessionImageSelection =
  | {kind: 'source'; resource: SessionImageResource; name: string; url: string; sourceHash: string; candidateId: string}
  | {kind: 'browser'; owner: object; pageId: string; image: ReaderNativeImageV1; name: string; url: string; candidateId: string}
export interface SessionBrowserImage {candidateId: string; selection: Extract<SessionImageSelection, {kind: 'browser'}>}
type ImageUse = 'gallery' | 'background' | 'portrait'
type DisplayUse = Exclude<ImageUse, 'gallery'>
type ImagePreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
interface StaticImagePreference {
  candidateId: string
  resource: Pick<SessionImageResource, 'id' | 'name' | 'type'>
}
interface ImagePreferencesV1 {
  schemaVersion: 1
  sourceHash: string
  background: StaticImagePreference | null
  portrait: StaticImagePreference | null
}
type ImageLoad = 'loading' | 'ready' | 'failed'
export interface SessionImagesState {
  sessionId: string | null
  opened: boolean
  panelPosition: {left: number; top: number}
  catalog: SessionImageCatalog | null
  browserImages: readonly SessionBrowserImage[]
  refreshing: boolean
  selecting: boolean
  gallery: SessionImageSelection | null
  background: SessionImageSelection | null
  portrait: SessionImageSelection | null
  load: Record<ImageUse, ImageLoad>
  error: string
}
export interface ImagesJsonFetch {
  <T>(url: string, init?: RequestInit): Promise<T>
}
const emptyLoad = (): Record<ImageUse, ImageLoad> => ({gallery: 'loading', background: 'loading', portrait: 'loading'})
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
const preferenceKey = (sessionId: string) => 'dsh-roleplay-ui.images:v1:' + sessionId
const resourceUrl = (sessionId: string, resource: SessionImageResource) => resource.url
  ?? '/api/roleplay/download?sessionId=' + encodeURIComponent(sessionId) + '&resourceId=' + encodeURIComponent(resource.id)

/** One application owner survives Reader mounts; Source identity comes from the catalog. */
export function createSessionImages(jsonFetch: ImagesJsonFetch, storage?: ImagePreferenceStorage) {
  let state: SessionImagesState = {sessionId: null, opened: false, panelPosition: {left: 16, top: 96},
    catalog: null, browserImages: [], refreshing: false,
    selecting: false, gallery: null, background: null, portrait: null, load: emptyLoad(), error: ''}
  const listeners = new Set<() => void>()
  let sourceImport: string | undefined
  let pendingRefresh: Promise<void> | undefined
  let refreshAgain = false
  let selectionRequest: object | undefined
  let disposed = false
  let nextBrowserImage = 0
  let preferences: ImagePreferencesV1 | undefined
  const publish = (patch: Partial<SessionImagesState>) => {
    state = {...state, ...patch}
    for (const listener of listeners) listener()
  }
  const persistPreferences = () => {
    if (!state.sessionId) return
    try {
      const target = storage ?? globalThis.localStorage, key = preferenceKey(state.sessionId)
      if (preferences?.background || preferences?.portrait) target?.setItem(key, JSON.stringify(preferences))
      else target?.removeItem(key)
    } catch (error) {
      publish({error: '图片选择已应用，但无法保存浏览器偏好：' + errorText(error)})
    }
  }
  const forgetPreferences = () => {preferences = undefined; persistPreferences()}
  const rememberUse = (purpose: DisplayUse, image: SessionImageSelection | null) => {
    if (image?.kind === 'source') {
      if (preferences?.sourceHash !== image.sourceHash) preferences = {
        schemaVersion: 1, sourceHash: image.sourceHash, background: null, portrait: null,
      }
      const {id, name, type} = image.resource
      preferences[purpose] = {candidateId: image.candidateId, resource: {id, name, type}}
    } else if (preferences) preferences[purpose] = null
    persistPreferences()
  }
  const clearImages = () => {
    selectionRequest = undefined
    forgetPreferences()
    publish({gallery: null, background: null, portrait: null, selecting: false, load: emptyLoad()})
  }
  const acceptCatalog = (catalog: SessionImageCatalog) => {
    if (state.catalog?.sourceHash !== catalog.sourceHash) clearSelections(image => image.kind === 'source')
    if (preferences && preferences.sourceHash !== catalog.sourceHash) forgetPreferences()
    const restored: Partial<SessionImagesState> = {}
    for (const purpose of ['background', 'portrait'] as const) {
      const saved = preferences?.[purpose]
      if (!saved || state[purpose]) continue
      const candidate = catalog.candidates.find(value => value.candidateId === saved.candidateId)
      if (!candidate || candidate.storage === 'unresolved') continue
      // Library resource IDs survive app restarts. Remote addresses come from
      // the current Source catalog; saved preferences never retain a page URL.
      const resource = {...saved.resource, ...(candidate.storage === 'remote' ? {url: candidate.uri} : {})}
      restored[purpose] = {kind: 'source', resource, candidateId: saved.candidateId,
        sourceHash: preferences!.sourceHash, name: candidate.name, url: resourceUrl(state.sessionId!, resource)}
    }
    publish({catalog, ...restored})
  }
  function clearSelections(matches: (image: SessionImageSelection) => boolean) {
    const patch: Partial<SessionImagesState> = {}, load = {...state.load}
    for (const purpose of ['gallery', 'background', 'portrait'] as const) {
      const selected = state[purpose]
      if (selected && matches(selected)) {patch[purpose] = null; load[purpose] = 'loading'}
    }
    publish({...patch, load})
  }
  function acceptBrowserImages(browserImages: readonly SessionBrowserImage[]) {
    const retained = new Map(browserImages.map(candidate => [candidate.candidateId, candidate.selection]))
    const patch: Partial<SessionImagesState> = {browserImages}, load = {...state.load}
    for (const purpose of ['gallery', 'background', 'portrait'] as const) {
      const selected = state[purpose]
      if (selected?.kind !== 'browser') continue
      const current = retained.get(selected.candidateId)
      patch[purpose] = current ?? null
      if (!current) load[purpose] = 'loading'
    }
    publish({...patch, load})
  }
  async function refresh(): Promise<void> {
    const sid = state.sessionId
    if (!sid || disposed) return
    if (pendingRefresh) {refreshAgain = true; return pendingRefresh}
    publish({refreshing: true, error: ''})
    const request: Promise<void> = Promise.resolve().then(async () => {
      try {
        const catalog = await jsonFetch<SessionImageCatalog>(
          '/api/roleplay/source-images?sessionId=' + encodeURIComponent(sid))
        if (!disposed && pendingRefresh === request && state.sessionId === sid) acceptCatalog(catalog)
      } catch (error) {
        if (!disposed && pendingRefresh === request && state.sessionId === sid) publish({error: errorText(error)})
      }
    })
    pendingRefresh = request
    try {await request} finally {
      // The old request may finish after a session switch and a new request.
      if (pendingRefresh === request) {
        pendingRefresh = undefined
        publish({refreshing: false})
        const requested = refreshAgain
        refreshAgain = false
        if (requested && !disposed && state.sessionId === sid) void refresh()
      }
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener)}},
    setSession(sessionId: string | null) {
      if (state.sessionId === sessionId) return
      pendingRefresh = undefined; refreshAgain = false; selectionRequest = undefined; sourceImport = undefined
      preferences = undefined
      let preferenceError = ''
      if (sessionId) try {
        const saved = (storage ?? globalThis.localStorage)?.getItem(preferenceKey(sessionId))
        const value = saved ? JSON.parse(saved) as ImagePreferencesV1 : null
        if (value?.schemaVersion === 1) preferences = value
      } catch (error) {preferenceError = '无法读取浏览器中的图片选择：' + errorText(error)}
      publish({sessionId, opened: false, catalog: null, browserImages: [], refreshing: false, selecting: false,
        gallery: null, background: null, portrait: null, load: emptyLoad(), error: preferenceError})
      if (preferences?.background || preferences?.portrait) void refresh()
    },
    acceptState(value: {sessionId?: string; cardImport?: unknown}) {
      if (value.sessionId !== state.sessionId) return
      const imported = value.cardImport as {sourceRecordSessionId?: string; importId?: string} | null | undefined
      const identity = JSON.stringify([imported?.sourceRecordSessionId ?? value.sessionId, imported?.importId ?? null])
      if (sourceImport !== undefined && sourceImport !== identity) {
        pendingRefresh = undefined; refreshAgain = false
        clearImages(); publish({catalog: null, browserImages: []})
      }
      sourceImport = identity
      // State announces a refresh, but only the Source owner supplies a media hash.
      if (state.opened || state.gallery || state.background || state.portrait) void refresh()
    },
    open(opened: boolean, panelPosition = state.panelPosition) {publish({opened, panelPosition}); if (opened) void refresh()},
    refresh,
    acceptBrowserImages(sessionId: string, owner: object, pageId: string, images: readonly ReaderNativeImageV1[]) {
      if (disposed || state.sessionId !== sessionId) return
      const previous = state.browserImages.filter(candidate => candidate.selection.owner === owner
        && candidate.selection.pageId === pageId)
      const candidates = images.map(image => {
        const old = previous.find(candidate => candidate.selection.image.target.handle === image.target.handle)
        if (old && old.selection.url === image.url && old.selection.image.originalUrl === image.originalUrl) {
          if (old.selection.name === image.name) return old
          return {...old, selection: {...old.selection, image, name: image.name}}
        }
        const candidateId = 'browser-' + ++nextBrowserImage
        return {candidateId, selection: {kind: 'browser' as const, owner, pageId, image,
          name: image.name, url: image.url, candidateId}}
      })
      acceptBrowserImages([...state.browserImages.filter(candidate => candidate.selection.owner !== owner
        || candidate.selection.pageId !== pageId), ...candidates])
    },
    releaseBrowserImages(owner: object) {
      acceptBrowserImages(state.browserImages.filter(candidate => candidate.selection.owner !== owner))
    },
    selectBrowser(candidateId: string) {
      const candidate = state.browserImages.find(value => value.candidateId === candidateId)
      if (!candidate) return
      selectionRequest = undefined
      publish({gallery: candidate.selection, selecting: false, error: '', load: {...state.load, gallery: 'loading'}})
    },
    async select(candidateId: string) {
      const sid = state.sessionId, catalog = state.catalog
      if (!sid || !catalog?.sourceHash) return
      const request = {}
      selectionRequest = request
      publish({selecting: true, error: ''})
      try {
        const {resource} = await jsonFetch<{resource: SessionImageResource}>('/api/roleplay/source-images', {
          method: 'POST', headers: {'content-type': 'application/json'},
          body: JSON.stringify({sessionId: sid, sourceHash: catalog.sourceHash, candidateId}),
        })
        if (disposed || selectionRequest !== request || state.sessionId !== sid
          || state.catalog?.sourceHash !== catalog.sourceHash) return
        const image: SessionImageSelection = {kind: 'source', resource, name: catalog.candidates.find(candidate => candidate.candidateId === candidateId)!.name,
          sourceHash: catalog.sourceHash, candidateId, url: resourceUrl(sid, resource)}
        publish({gallery: image, load: {...state.load, gallery: 'loading'}})
      } catch (error) {
        if (!disposed && selectionRequest === request && state.sessionId === sid) publish({error: errorText(error)})
      } finally {
        if (selectionRequest === request) {selectionRequest = undefined; publish({selecting: false})}
      }
    },
    useAs(purpose: 'background' | 'portrait') {
      if (!state.gallery) return
      publish({[purpose]: state.gallery, load: {...state.load, [purpose]: 'loading'}})
      rememberUse(purpose, state.gallery)
    },
    clear(purpose: ImageUse) {
      publish({[purpose]: null, error: ''})
      if (purpose !== 'gallery') rememberUse(purpose, null)
    },
    imageResult(purpose: ImageUse, image: SessionImageSelection, result: ImageLoad) {
      const current = state[purpose]
      if (disposed || !current) return
      if (image.kind === 'browser') {
        if (current.kind !== 'browser' || current.candidateId !== image.candidateId) return
      } else if (current !== image) return
      publish({load: {...state.load, [purpose]: result}})
    },
    dispose() {
      disposed = true; pendingRefresh = undefined; refreshAgain = false; selectionRequest = undefined
      preferences = undefined
      publish({sessionId: null, catalog: null, browserImages: [], opened: false, refreshing: false, selecting: false,
        gallery: null, background: null, portrait: null, load: emptyLoad(), error: ''})
      listeners.clear()
    },
  }
}

export const SESSION_IMAGES_CSS = `
.rp-images-content{padding:16px;color:var(--rp-tool-ink,#49392c);font-family:inherit;font-size:14px;line-height:1.5}
.rp-images-content button{box-sizing:border-box;min-height:44px;border:1px solid var(--rp-tool-border,#dccbb3);border-radius:10px;background:var(--rp-tool-paper,#fffaf1);color:inherit;padding:9px 12px;font:inherit;cursor:pointer}
.rp-images-content button:hover:not(:disabled){border-color:var(--rp-tool-accent,#8b571c);background:var(--rp-tool-soft,#f3ead9)}
.rp-images-content button:focus-visible{outline:3px solid var(--rp-tool-accent,#8b571c);outline-offset:3px}
.rp-images-content button:disabled{opacity:.5;cursor:default}
.rp-images-toolbar,.rp-images-section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.rp-images-toolbar{margin-bottom:12px}
.rp-images-meta,.rp-images-hint{color:var(--rp-tool-muted,#766553);font-size:12px}
.rp-images-preview-frame{position:relative;display:grid;place-items:center;aspect-ratio:3/2;min-height:160px;overflow:hidden;border:1px solid var(--rp-tool-border,#dccbb3);border-radius:12px;background:var(--rp-tool-soft,#f3ead9)}
.rp-images-preview{display:block;width:100%;height:100%;min-height:0;object-fit:contain;position:absolute;inset:0}
.rp-images-placeholder{text-align:center;padding:24px;color:var(--rp-tool-muted,#766553)}
.rp-images-placeholder svg{display:block;width:36px;height:36px;margin:0 auto 10px;opacity:.7}
.rp-images-placeholder strong{display:block;font-size:14px;font-weight:600}
.rp-images-placeholder p{margin:6px 0 0;font-size:12px}
.rp-images-loading{position:absolute;left:10px;bottom:10px;padding:5px 10px;border-radius:6px;background:var(--rp-tool-paper,#fffaf1);color:var(--rp-tool-ink,#49392c);font-size:12px;box-shadow:0 1px 5px #49392c14}
.rp-images-selected-name{margin:10px 0 0;font-weight:600;overflow-wrap:anywhere}
.rp-images-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.rp-images-actions button{flex:1 1 auto}
.rp-images-actions .rp-images-primary{border-color:var(--rp-tool-accent,#8b571c);color:var(--rp-tool-accent,#8b571c);background:var(--rp-tool-soft,#f3ead9)}
.rp-images-current{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;padding-bottom:16px;border-bottom:1px solid var(--rp-tool-border,#dccbb3)}
.rp-images-current button{font-size:12px;flex:1;text-align:left}
.rp-images-current span{display:block;font-weight:600;overflow-wrap:anywhere}
.rp-images-section{margin-top:18px}
.rp-images-section-heading{margin:0 0 10px;font-size:13px}
.rp-images-section-heading span{font-weight:400;color:var(--rp-tool-muted,#766553)}
.rp-images-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.rp-images-list .rp-images-candidate{position:relative;min-width:0;padding:4px;text-align:left;overflow:hidden;border-radius:9px}
.rp-images-list .rp-images-candidate[aria-pressed=true]{border:2px solid var(--rp-tool-accent,#8b571c);padding:3px;background:var(--rp-tool-soft,#f3ead9)}
.rp-images-thumb{position:relative;display:grid;place-items:center;width:100%;aspect-ratio:1;overflow:hidden;border-radius:5px;background:var(--rp-tool-soft,#f3ead9);color:var(--rp-tool-muted,#766553)}
.rp-images-thumb svg{width:28px;height:28px;opacity:.65}
.rp-images-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.rp-images-thumb-label{position:absolute;left:3px;right:3px;bottom:4px;text-align:center;font-size:11px}
.rp-images-candidate-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.5;margin:6px 3px 3px}
.rp-images-candidate small{display:block;margin:0 3px 3px;color:var(--rp-tool-muted,#766553);font-size:11px}
.rp-images-error{margin:10px 0;padding:10px 12px;border-radius:8px;background:#f9e9e3;color:#923c2e;font-size:13px;overflow-wrap:anywhere}
.rp-images-empty{padding:16px 0;color:var(--rp-tool-muted,#766553);font-size:13px}
.rp-image-scene{position:relative;contain:size;isolation:isolate;display:flex;flex-direction:column;flex:1;min-height:0;height:100%;width:100%;overflow:hidden}
.rp-image-scene>.rp-reader-view{position:relative;z-index:1}
.rp-image-background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.22;z-index:0;pointer-events:none}
.rp-image-portrait{position:absolute;right:8px;bottom:14px;width:min(22%,210px);max-height:min(65dvh, calc(100% - 28px));object-fit:contain;z-index:2;pointer-events:none}
.rp-image-with-portrait>.rp-reader-view{padding-right:calc(22% + 16px)}
.rp-image-scene-error{padding:6px 12px;color:#a33c36;font-size:12px}
`

export function createSessionImageComponents(deps: {React: typeof ReactAPI; images: ReturnType<typeof createSessionImages>}) {
  const {React, images} = deps, h = React.createElement
  const ToolWindow = createToolWindow(React)
  const useImages = () => React.useSyncExternalStore(images.subscribe, images.getSnapshot, images.getSnapshot)
  const imageIcon = () => h('svg', {viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.5, 'aria-hidden': true}, h('rect', {x: 3, y: 3, width: 18, height: 18, rx: 3}),
    h('circle', {cx: 8.5, cy: 8.5, r: 1.5}), h('path', {d: 'm3 17 5-5 4 4 4-6 5 7'}))
  function Thumbnail({src, unavailable}: {src?: string; unavailable?: boolean}) {
    const [failed, setFailed] = React.useState(false)
    React.useEffect(() => setFailed(false), [src])
    return h('span', {className: 'rp-images-thumb'}, imageIcon(),
      src && !failed ? h('img', {src, alt: '', loading: 'lazy', onError: () => setFailed(true)}) : null,
      !src || failed ? h('span', {className: 'rp-images-thumb-label'},
        unavailable ? '路径未绑定' : failed ? '无法预览' : '点击读取') : null)
  }
  function image(purpose: ImageUse, selected: SessionImageSelection, className: string) {
    const identity = selected.kind === 'source' ? selected.sourceHash + ':' + selected.resource.id : selected.candidateId
    return h('img', {key: purpose + ':' + identity, className, src: selected.url,
      alt: selected.name, onLoad: () => images.imageResult(purpose, selected, 'ready'),
      onError: () => images.imageResult(purpose, selected, 'failed')})
  }
  function Controls() {
    const state = useImages()
    if (!state.sessionId) return null
    const candidates = state.catalog?.candidates ?? []
    const count = candidates.length + state.browserImages.length
    const sourceThumbnail = (candidate: SessionImageCandidate) => candidate.storage === 'remote' ? candidate.uri
      : [state.gallery, state.background, state.portrait].find(selected => selected?.kind === 'source'
        && selected.sourceHash === state.catalog?.sourceHash && selected.candidateId === candidate.candidateId)?.url
    // Scene keeps its background/portrait styles after the controls close.
    return h(React.Fragment, null,
      h('style', null, SESSION_IMAGES_CSS),
      state.opened ? h(ToolWindow, {id: 'dsh-rp-images-panel', title: '图片', icon: 'images',
        onClose: () => images.open(false), initialPosition: state.panelPosition, initialSize: {w: 380, h: 600}},
      h('div', {className: 'rp-images-content'},
        h('div', {className: 'rp-images-toolbar'},
          h('span', {className: 'rp-images-meta', role: 'status'}, state.refreshing ? '正在读取图片…' : count + ' 张可发现的图片'),
          h('button', {type: 'button', disabled: state.refreshing, onClick: () => void images.refresh()}, '刷新图片')),
        state.error ? h('p', {className: 'rp-images-error', role: 'status'}, state.error) : null,
        ...(state.catalog?.diagnostics ?? []).map((diagnostic, index) =>
          h('p', {key: 'diagnostic:' + index, className: 'rp-images-error'}, diagnostic.message + ' · ' + diagnostic.position)),
        h('div', {className: 'rp-images-preview-frame', 'aria-busy': state.selecting || !!state.gallery && state.load.gallery === 'loading'},
          state.gallery && state.load.gallery !== 'failed' ? image('gallery', state.gallery, 'rp-images-preview') : null,
          !state.gallery || state.load.gallery === 'failed' ? h('div', {className: 'rp-images-placeholder'}, imageIcon(),
            h('strong', null, state.gallery ? '图片加载失败' : '选择一张图片'),
            h('p', null, state.gallery ? '请重新选择图片，或刷新后重试。' : '在下方预览，也可设为背景或立绘。')) : null,
          state.selecting || state.gallery && state.load.gallery === 'loading'
            ? h('span', {className: 'rp-images-loading', role: 'status'}, '正在加载图片…') : null),
        state.gallery ? h('p', {className: 'rp-images-selected-name'}, state.gallery.name) : null,
        state.gallery ? h('div', {className: 'rp-images-actions'},
          h('button', {type: 'button', className: 'rp-images-primary', onClick: () => images.useAs('background')}, '作为背景'),
          h('button', {type: 'button', className: 'rp-images-primary', onClick: () => images.useAs('portrait')}, '作为立绘'),
          h('button', {type: 'button', onClick: () => images.clear('gallery')}, '清除预览')) : null,
        state.background || state.portrait ? h('div', {className: 'rp-images-current'},
          state.background ? h('button', {type: 'button', onClick: () => images.clear('background')},
            '清除背景', h('span', null, state.background.name)) : null,
          state.portrait ? h('button', {type: 'button', onClick: () => images.clear('portrait')},
            '清除立绘', h('span', null, state.portrait.name)) : null) : null,
        candidates.length ? h('div', {className: 'rp-images-section'},
          h('h3', {className: 'rp-images-section-heading'}, '角色卡图片', h('span', null, candidates.length + ' 张')),
          h('div', {className: 'rp-images-list'}, ...candidates.map(candidate =>
            h('button', {key: candidate.candidateId, type: 'button', className: 'rp-images-candidate',
              'aria-pressed': state.gallery?.kind === 'source' && state.gallery.candidateId === candidate.candidateId,
              title: candidate.name + '\n' + (candidate.storage === 'unresolved'
                ? '原路径未绑定资源：' + candidate.uri : candidate.carrier + ' · ' + candidate.position),
              disabled: state.selecting || candidate.storage === 'unresolved',
              onClick: () => void images.select(candidate.candidateId)},
              h(Thumbnail, {src: sourceThumbnail(candidate), unavailable: candidate.storage === 'unresolved'}),
              h('span', {className: 'rp-images-candidate-name'}, candidate.name),
              h('small', null, candidate.storage === 'remote' ? '远程图片' : candidate.storage === 'embedded' ? '内嵌图片' : '路径未绑定'))))) : null,
        state.browserImages.length ? h('div', {className: 'rp-images-section'},
          h('h3', {className: 'rp-images-section-heading'}, '作者页面图片', h('span', null, state.browserImages.length + ' 张')),
          h('div', {className: 'rp-images-list'}, ...state.browserImages.map(candidate =>
            h('button', {key: candidate.candidateId, type: 'button', className: 'rp-images-candidate',
              'aria-pressed': state.gallery?.kind === 'browser' && state.gallery.candidateId === candidate.candidateId,
              title: candidate.selection.name, onClick: () => images.selectBrowser(candidate.candidateId)},
              h(Thumbnail, {src: candidate.selection.url}),
              h('span', {className: 'rp-images-candidate-name'}, candidate.selection.name))))) : null,
        !state.refreshing && state.catalog && count === 0
          ? h('p', {className: 'rp-images-empty', role: 'status'}, '当前角色卡没有可发现的图片。角色卡更新后可点击刷新。') : null)) : null)
  }
  function Scene(props: {sessionId?: string; children?: ReactAPI.ReactNode}) {
    const state = useImages()
    if (props.sessionId !== state.sessionId) return h(React.Fragment, null, props.children)
    return h('div', {className: 'rp-image-scene' + (state.portrait && state.load.portrait !== 'failed' ? ' rp-image-with-portrait' : '')},
      state.background && state.load.background !== 'failed' ? image('background', state.background, 'rp-image-background') : null,
      state.portrait && state.load.portrait !== 'failed' ? image('portrait', state.portrait, 'rp-image-portrait') : null,
      state.background && state.load.background === 'failed' ? h('div', {className: 'rp-image-scene-error', role: 'status'}, '背景图片加载失败，可在图片面板重新选择。') : null,
      state.portrait && state.load.portrait === 'failed' ? h('div', {className: 'rp-image-scene-error', role: 'status'}, '立绘加载失败，可在图片面板重新选择。') : null,
      props.children)
  }
  return {Controls, Scene}
}
