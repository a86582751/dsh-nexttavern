import type * as ReactAPI from 'react'
import type {AuthorWorldbookBindingCaptureV1,AuthorWorldbookBindingSelectionV1,
  AuthorWorldbookReceiptV1} from '../core/roleplay-author-worldbook-types.js'
import type {WorldbookLibraryDataV1,WorldbookLibraryRequestV1 as Request,
  WorldbookLibraryReplyV1 as Reply} from '../core/roleplay-worldbook-library-types.js'
import type {TavernLoreEditorStorageV1} from './tavern-lore-editor-data.js'
interface State {
  sessionId:string|null
  library:WorldbookLibraryDataV1|null
  loading:boolean
  saving:boolean
  pending:Request|null
  storageBlocked:boolean
  error:string|null
  receipt:AuthorWorldbookReceiptV1|null
  feedback:string|null
}
interface Dependencies {
  jsonFetch:<T>(url:string,init?:RequestInit)=>Promise<T>
  storage:()=>TavernLoreEditorStorageV1
  operationId?:()=>string
  onSaved?:()=>void
  onBindingsSaved?:()=>void
}
const path='/api/roleplay/worldbooks'
const storageKey=(sid:string)=>'nexttavern-worldbook-library-pending-v1:'+sid
const storedRequest=(body:string)=>'{"schemaVersion":1,"request":'+body+'}'
const empty=(sessionId:string|null):State=>({sessionId,library:null,loading:false,saving:false,
  pending:null,storageBlocked:false,error:null,receipt:null,feedback:null})
function readPending(raw:string,sid:string):Request {
  const record=JSON.parse(raw) as {schemaVersion:number;request:Request},pending=record.request
  if(record.schemaVersion!==1||pending.sessionId!==sid||!pending.operationId||!['import','bind'].includes(pending.action))
    throw Error('世界书操作恢复记录无效')
  return pending
}

/** Manual library operations use the current Workspace route and its owners.
 * Persist the exact request before sending so a lost response retains its ID. */
export function createWorldbookLibraryControllerV1(deps:Dependencies) {
  let state=empty(null),epoch=0,readRun=0
  const listeners=new Set<(value:State)=>void>()
  const publish=(patch:Partial<State>)=>{state={...state,...patch};listeners.forEach(fn=>fn(state))}
  const current=(sid:string,captured:number)=>state.sessionId===sid&&epoch===captured
  function releasePending(sid:string,record:string):Pick<State,'pending'|'storageBlocked'> {
    const storage=deps.storage(),key=storageKey(sid),raw=storage.getItem(key)
    if(raw===record){storage.removeItem(key);return {pending:null,storageBlocked:false}}
    if(raw===null)return {pending:null,storageBlocked:false}
    // Another controller can have completed this operation and started a new
    // one while its response was in flight. The new request owns that record.
    try{return {pending:readPending(raw,sid),storageBlocked:false}}
    catch{return {pending:null,storageBlocked:true}}
  }
  async function reload() {
    const sid=state.sessionId,captured=epoch,run=++readRun
    if(!sid||state.saving)return
    publish({loading:true,error:null})
    try {
      const reply=await deps.jsonFetch<Reply>(path+'?sessionId='+encodeURIComponent(sid))
      if(!current(sid,captured)||run!==readRun)return
      if(!reply.ok)throw Error(reply.error)
      if(reply.library.sessionId!==sid)throw Error('世界书库与当前会话不一致')
      publish({library:reply.library})
    } catch(error) {
      if(current(sid,captured)&&run===readRun)publish({error:String(error instanceof Error?error.message:error)})
    } finally {if(current(sid,captured)&&run===readRun)publish({loading:false})}
  }
  async function selectSession(sid:string|null) {
    epoch++;readRun++;state=empty(sid);listeners.forEach(fn=>fn(state))
    const captured=epoch
    if(!sid)return
    try {
      const raw=deps.storage().getItem(storageKey(sid))
      if(raw)publish({pending:readPending(raw,sid)})
    } catch {publish({storageBlocked:true})}
    await reload()
    if(current(sid,captured)&&state.storageBlocked)
      publish({error:'世界书恢复记录无法读取，请检查并清除该记录后重新操作'})
  }
  async function send(request:Request) {
    const sid=state.sessionId,captured=epoch
    if(!sid||state.saving||state.storageBlocked||request.sessionId!==sid)return
    const body=JSON.stringify(request),record=storedRequest(body)
    readRun++
    publish({saving:true,loading:false,error:null,feedback:null})
    let sent=false
    try {
      const storage=deps.storage(),key=storageKey(sid),previous=storage.getItem(key)
      if(previous&&previous!==record) {
        try{publish({pending:readPending(previous,sid)})}catch{publish({storageBlocked:true})}
        throw Error('已有世界书恢复记录，请先处理该记录')
      }
      storage.setItem(key,record)
      publish({pending:request});sent=true
      const reply=await deps.jsonFetch<Reply>(path,{method:'POST',headers:{'content-type':'application/json'},body})
      if(!current(sid,captured))return
      if(!reply.ok) {
        throw Object.assign(Error(reply.error),{outcome:reply.outcome,receipt:reply.receipt})
      }
      if(reply.library.sessionId!==sid)throw Error('世界书操作返回的会话不一致')
      publish({...releasePending(sid,record),library:reply.library,receipt:reply.receipt??null,
        feedback:reply.historical?'原绑定操作已确认，当前世界书库已刷新':
          request.action==='import'?'世界书已导入，请选择绑定范围':'世界书绑定已保存'})
      if(request.action==='bind'&&!reply.historical)deps.onBindingsSaved?.()
      if(!reply.historical)deps.onSaved?.()
    } catch(error) {
      if(current(sid,captured)) {
        const failure=error as {outcome?:string;receipt?:AuthorWorldbookReceiptV1}
        if(sent&&failure?.outcome==='no-write') {
          try {publish(releasePending(sid,record))} catch {}
        }
        const message=error instanceof Error&&error.name==='QuotaExceededError'
          ?'浏览器恢复存储空间不足，请腾出空间后重新导入':String(error instanceof Error?error.message:error)
        publish({receipt:failure?.receipt??null,error:message
          +(state.pending?'。请恢复本次操作以确认结果。':'')})
      }
    } finally {if(current(sid,captured))publish({saving:false})}
  }
  async function importFile(file:File) {
    const sid=state.sessionId,captured=epoch,library=state.library
    if(!sid||!library||state.pending||state.storageBlocked||state.saving||state.loading)return
    try {
      publish({loading:true,error:null})
      const json=await file.text()
      if(!current(sid,captured))return
      publish({loading:false})
      await send({sessionId:sid,operationId:deps.operationId?.()??globalThis.crypto.randomUUID(),
        action:'import',expectedCatalogHead:library.catalog.head,fileName:file.name,json})
    } catch {if(current(sid,captured))publish({loading:false,error:'无法读取所选世界书文件'})}
  }
  async function bind(binding:AuthorWorldbookBindingCaptureV1,selection:AuthorWorldbookBindingSelectionV1) {
    if(!state.sessionId||state.pending||state.storageBlocked||state.saving||state.loading)return
    await send({sessionId:state.sessionId,operationId:deps.operationId?.()??globalThis.crypto.randomUUID(),
      action:'bind',target:binding.selection.kind,expectedOwner:binding.owner,expectedHead:binding.head,selection})
  }
  function clearInvalidRecovery() {
    if(!state.sessionId||!state.storageBlocked||state.saving)return
    try {
      const storage=deps.storage(),key=storageKey(state.sessionId),raw=storage.getItem(key)
      if(raw!==null) {
        let pending:Request|undefined
        try {pending=readPending(raw,state.sessionId)}catch{}
        if(pending){publish({pending,storageBlocked:false,error:null});return}
      }
      storage.removeItem(key);publish({storageBlocked:false,error:null})
    }
    catch {publish({error:'无法清除世界书恢复记录，请检查浏览器存储权限'})}
  }
  return {getState:()=>state,selectSession,reload,importFile,bind,clearInvalidRecovery,
    recover:async()=>{if(state.pending)await send(state.pending)},
    subscribe(fn:(value:State)=>void){listeners.add(fn);return ()=>{listeners.delete(fn)}}}
}

export function createWorldbookLibraryPanelV1(deps:Dependencies & {React:typeof ReactAPI}) {
  const {React}=deps,h=React.createElement
  return function WorldbookLibraryPanel({sessionId,onSaved,onBindingsSaved}:{
    sessionId:string;onSaved?:()=>void;onBindingsSaved?:()=>void
  }) {
    const changed=React.useRef(onSaved);changed.current=onSaved
    const saved=React.useRef(onBindingsSaved);saved.current=onBindingsSaved
    const [controller]=React.useState(()=>createWorldbookLibraryControllerV1({...deps,
      onSaved:()=>changed.current?.(),onBindingsSaved:()=>saved.current?.()}))
    const [state,setState]=React.useState(controller.getState)
    const renderedSid=React.useRef(sessionId);renderedSid.current=sessionId
    React.useEffect(()=>controller.subscribe(setState),[controller])
    React.useEffect(()=>{void controller.selectSession(sessionId);return ()=>{void controller.selectSession(null)}},[controller,sessionId])
    if(state.sessionId!==sessionId)return h('p',{role:'status'},'正在读取当前会话世界书库…')
    const guarded=(action:()=>void|Promise<void>)=>()=>{
      if(renderedSid.current===sessionId&&controller.getState().sessionId===sessionId)void action()
    }
    const busy=state.saving||state.loading||!!state.pending||state.storageBlocked
    const books=state.library?.catalog.books??[]
    const catalogIds=new Set(books.map(book=>book.address.bookId))
    const options=(none:string,selected:string|null)=>[h('option',{key:'',value:''},none),
      selected&&!catalogIds.has(selected)?h('option',{key:selected,value:selected},`当前绑定已删除（${selected}）`):null,
      ...books.map(book=>
      h('option',{key:book.address.bookId,value:book.address.bookId},book.name))]
    const toggle=(ids:readonly string[],id:string,checked:boolean)=>checked?[...ids,id]:ids.filter(value=>value!==id)
    const bindings=state.library?Object.values(state.library.bindings):[]
    const renderBinding=(binding:AuthorWorldbookBindingCaptureV1)=>{
      const selection=binding.selection
      const update=(next:AuthorWorldbookBindingSelectionV1)=>{
        if(renderedSid.current===sessionId&&controller.getState().sessionId===sessionId)void controller.bind(binding,next)
      }
      const checks=(selected:readonly string[],change:(ids:readonly string[])=>void)=>books.map(book=>{
        const id=book.address.bookId
        return h('label',{key:id,className:'dsh-rp-row'},h('input',{type:'checkbox',checked:selected.includes(id),disabled:busy,
          onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>change(toggle(selected,id,event.target.checked))}),book.name)
      })
      const missingBindings=(missing:readonly string[],selection:AuthorWorldbookBindingSelectionV1)=>missing.length?
        h('div',{className:'dsh-rp-item'},h('p',{role:'status'},`有 ${missing.length} 个已删除的世界书绑定`),
          h('button',{type:'button',className:'dsh-rp-btn',disabled:busy,
            onClick:()=>update(selection)},'解除失效绑定')):null
      let controls:ReactAPI.ReactNode
      if(selection.kind==='character') {
        const selected=selection.primary?[selection.primary,...selection.additional]:selection.additional
        const missing=selected.filter(id=>!catalogIds.has(id))
        controls=h(React.Fragment,null,
          h('label',{className:'dsh-rp-field'},'主世界书',h('select',{
            className:'dsh-rp-input',value:selection.primary??'',
            onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>
              update({...selection,primary:event.target.value||null})},...options('无主世界书',selection.primary))),
          h('p',{className:'dsh-rp-muted'},'额外世界书'),
          ...checks(selection.additional,additional=>update({...selection,additional})),
          missingBindings(missing,{...selection,
            primary:selection.primary&&catalogIds.has(selection.primary)?selection.primary:null,
            additional:selection.additional.filter(id=>catalogIds.has(id))}))
      } else if(selection.kind==='profile') {
        const missing=selection.enabled.filter(id=>!catalogIds.has(id))
        controls=h(React.Fragment,null,...checks(selection.enabled,enabled=>update({...selection,enabled})),
          missingBindings(missing,{...selection,enabled:selection.enabled.filter(id=>catalogIds.has(id))}))
      } else {
        controls=h('label',{className:'dsh-rp-field'},'聊天世界书',h('select',{
          className:'dsh-rp-input',value:selection.bookId??'',
          onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>
            update({...selection,bookId:event.target.value||null})},...options('无聊天世界书',selection.bookId)))
      }
      return h('fieldset',{key:selection.kind,disabled:busy,style:{minWidth:0},'data-worldbook-binding':selection.kind},
        h('legend',null,selection.kind==='profile'?'全局世界书':selection.kind==='character'?'当前角色世界书':'当前聊天世界书'),
        controls)
    }
    return h('section',{'aria-label':'世界书库','data-worldbook-library':sessionId},h('h4',null,'世界书库'),
      h('label',{className:'dsh-rp-field'},'导入 SillyTavern 世界书 JSON',h('input',{
        type:'file',accept:'.json,application/json',disabled:busy||!state.library,
        onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>{
          const file=event.target.files?.[0];event.target.value=''
          if(file)guarded(()=>controller.importFile(file))()
        }})),
      h('p',{className:'dsh-rp-muted'},'导入后在下方选择绑定范围。全局设置用于当前 profile，聊天设置用于当前会话。'),
      state.loading||state.saving?h('p',{role:'status'},state.saving?'正在保存世界书操作…':'正在读取世界书库…'):null,
      state.error?h('p',{role:'alert',className:'dsh-rp-error'},state.error):null,
      state.storageBlocked?h('button',{type:'button',className:'dsh-rp-btn',disabled:state.saving,
        onClick:guarded(controller.clearInvalidRecovery)},'清除无效恢复记录'):null,
      state.feedback?h('p',{role:'status'},state.feedback):null,
      state.pending?h('div',{className:'dsh-rp-item'},h('p',null,'世界书操作待确认 · '+state.pending.operationId),
        h('button',{type:'button',className:'dsh-rp-btn',disabled:state.saving,onClick:guarded(controller.recover)},'恢复本次世界书操作')):null,
      state.pending&&state.receipt?h('pre',{className:'dsh-rp-muted','aria-label':'世界书操作持久凭据',
        style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},JSON.stringify(state.receipt,null,2)):null,
      h('button',{type:'button',className:'dsh-rp-btn',disabled:state.loading||state.saving,onClick:guarded(controller.reload)},'刷新世界书库'),
      state.library?h(React.Fragment,null,h('p',{className:'dsh-rp-muted'},books.length?`已收录 ${books.length} 本世界书`:'尚未导入世界书'),
        ...books.map(book=>h('div',{className:'dsh-rp-item',key:book.address.bookId},book.name)),...bindings.map(renderBinding)):null)
  }
}
