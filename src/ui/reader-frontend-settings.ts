import type * as ReactAPI from 'react'
import {createToolWindow} from './tool-window.js'

const MODE_KEY = 'dsh-roleplay-reader-document-mode-v1'
type DocumentMode='auto'|'fit'
type PreferenceStorage = Pick<Storage,'getItem'|'setItem'>

/** One presentation owner for every Reader and its independent settings window. */
export function createReaderFrontendSettings(storage?:PreferenceStorage) {
  const local = ()=>storage??globalThis.localStorage
  let mode:DocumentMode='auto'
  try {
    const saved=JSON.parse(local().getItem(MODE_KEY)??'null')
    if(saved?.schemaVersion===1&&(saved.mode==='auto'||saved.mode==='fit'))mode=saved.mode
  }catch { /* Storage restrictions do not disable local presentation controls. */ }
  const listeners=new Set<()=>void>()
  let opened=false
  const openListeners=new Set<()=>void>()
  return {
    getMode:()=>mode,
    subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener)}},
    getOpen:()=>opened,
    subscribeOpen(listener:()=>void){openListeners.add(listener);return ()=>{openListeners.delete(listener)}},
    open(value:boolean){
      if(value===opened)return
      opened=value
      for(const listener of openListeners)listener()
    },
    setMode(value:DocumentMode){
      mode=value
      try {local().setItem(MODE_KEY,JSON.stringify({schemaVersion:1,mode}))}
      catch { /* The current view can still change when browser storage is unavailable. */ }
      for(const listener of listeners)listener()
    },
  }
}
export type ReaderFrontendSettings = ReturnType<typeof createReaderFrontendSettings>

export function createReaderFrontendPanel(React:typeof ReactAPI,settings:ReaderFrontendSettings) {
  const h=React.createElement,ToolWindow=createToolWindow(React)
  return function ReaderFrontendPanel() {
    const mode=React.useSyncExternalStore(settings.subscribe,settings.getMode,settings.getMode)
    const opened=React.useSyncExternalStore(settings.subscribeOpen,settings.getOpen,settings.getOpen)
    if(!opened)return null
    return h(ToolWindow,{id:'dsh-rp-frontend-panel',title:'前端设置',onClose:()=>settings.open(false),initialSize:{w:380,h:280}},
      h('style',null,FRONTEND_SETTINGS_CSS),
      h('label',{className:'rp-frontend-label',htmlFor:'rp-reader-document-mode'},'作者文档显示'),
      h('p',{id:'rp-reader-document-mode-help',className:'rp-frontend-help'},
        '自动展开作者文档，或按框内空间缩放作者内容。正文以 100% 显示，本机保存偏好。'),
      h('div',{className:'rp-frontend-scale'},
        h('select',{id:'rp-reader-document-mode','aria-label':'作者文档显示',
          'aria-describedby':'rp-reader-document-mode-help',value:mode,
          onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>settings.setMode(event.target.value as DocumentMode)},
          h('option',{value:'auto'},'自动展开'),h('option',{value:'fit'},'适合框内')),
        h('button',{type:'button',onClick:()=>settings.setMode('auto')},'重新自动展开')))
  }
}

const FRONTEND_SETTINGS_CSS=`
.rp-frontend-label{font-weight:600}
.rp-frontend-help{font-size:13px;color:var(--rp-tool-muted);margin:6px 0 16px}
.rp-frontend-scale{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.rp-frontend-scale button,.rp-frontend-scale select{min-width:44px;min-height:44px}
`
