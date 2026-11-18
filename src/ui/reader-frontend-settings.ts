import type * as ReactAPI from 'react'
import {createToolWindow} from './tool-window.js'
import type {AuthorSceneControl} from './author-dom-scene.js'

export interface AuthorControlsProvider {
  getSnapshot():readonly AuthorSceneControl[]
  subscribe(listener:()=>void):()=>void
  activate(id:string):Promise<void>
}

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
  let sessionId:string|null=null
  const bindings=new Map<string,{provider:AuthorControlsProvider;unsubscribe():void}>()
  const authorListeners=new Set<()=>void>()
  const empty:readonly AuthorSceneControl[]=[]
  let authorControls=empty
  const publishAuthorControls=()=>{
    const next=sessionId?bindings.get(sessionId)?.provider.getSnapshot()??empty:empty
    if(next===authorControls)return
    authorControls=next
    for(const listener of authorListeners)listener()
  }
  const open=(value:boolean)=>{
    if(value===opened)return
    opened=value
    for(const listener of openListeners)listener()
  }
  return {
    getMode:()=>mode,
    subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener)}},
    getOpen:()=>opened,
    subscribeOpen(listener:()=>void){openListeners.add(listener);return ()=>{openListeners.delete(listener)}},
    open,
    setSession(value:string|null){sessionId=value;publishAuthorControls()},
    bindAuthorControls(sid:string,provider:AuthorControlsProvider){
      bindings.get(sid)?.unsubscribe()
      const binding={provider,unsubscribe:provider.subscribe(publishAuthorControls)}
      bindings.set(sid,binding);publishAuthorControls()
      return ()=>{
        if(bindings.get(sid)!==binding)return
        binding.unsubscribe();bindings.delete(sid);publishAuthorControls()
      }
    },
    getAuthorControls:()=>authorControls,
    subscribeAuthorControls(listener:()=>void){authorListeners.add(listener);return ()=>{authorListeners.delete(listener)}},
    async activateAuthorControl(id:string){
      const sid=sessionId,binding=sid?bindings.get(sid):undefined
      if(!binding)throw Error('当前会话的作者入口已关闭')
      await binding.provider.activate(id)
      if(sessionId===sid&&bindings.get(sid!)===binding)open(false)
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
    const controls=React.useSyncExternalStore(settings.subscribeAuthorControls,settings.getAuthorControls,settings.getAuthorControls)
    const [error,setError]=React.useState('')
    const [pending,setPending]=React.useState<string|null>(null)
    const activationEpoch=React.useRef(0)
    React.useEffect(()=>{activationEpoch.current++;setError('');setPending(null)},[controls,opened])
    React.useEffect(()=>()=>{activationEpoch.current++},[])
    if(!opened)return null
    return h(ToolWindow,{id:'dsh-rp-frontend-panel',title:'前端设置',onClose:()=>settings.open(false),initialSize:{w:380,h:280}},
      h('style',null,FRONTEND_SETTINGS_CSS),
      controls.length?h('section',{className:'rp-frontend-author-controls','aria-label':'作者悬浮窗'},
        h('h3',null,'作者悬浮窗'),
        ...controls.map(control=>h('button',{key:control.id,type:'button',disabled:control.disabled||pending!==null,
          onClick:async()=>{
            const epoch=activationEpoch.current
            setPending(control.id);setError('')
            try{await settings.activateAuthorControl(control.id)}
            catch(value){if(activationEpoch.current===epoch)setError(value instanceof Error?value.message:String(value))}
            finally{if(activationEpoch.current===epoch)setPending(null)}
          }},control.label))):null,
      error?h('p',{role:'alert'},'打开失败。'+error):null,
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
.rp-frontend-author-controls{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
.rp-frontend-author-controls h3{font-size:14px;margin:0}
.rp-frontend-author-controls button{min-height:44px;text-align:left;overflow-wrap:anywhere}
`
