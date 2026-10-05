import type * as ReactAPI from 'react'
import type {TavernLoreCurrentNativeFieldsV1} from '../core/tavern-lore-plan-types.mjs'
import type {TavernLoreEditorDataV1,TavernLoreEditorEntryV1,TavernLoreEditorReplyV1,
  TavernLoreEditorFailureDetailsV1} from '../core/roleplay-tavern-lore-editor-types.js'
import {canonicalTavernLoreEditRequestV1,createTavernLoreEditorPendingV1,readTavernLoreEditorPendingV1,
  persistTavernLoreEditorPendingV1,clearTavernLoreEditorPendingV1,tavernLoreEditPayloadSha256V1,
  tavernLoreReceiptMatchesV1,validateTavernLoreEditorFieldV1,LORE_EDITOR_BOOL_FIELDS_V1,
  LORE_EDITOR_NULL_BOOL_FIELDS_V1,LORE_EDITOR_POSITIONS_V1,
  LORE_EDITOR_LOGIC_V1,LORE_EDITOR_ROLES_V1} from './tavern-lore-editor-data.js'
import type {TavernLoreEditorPendingV1,TavernLoreEditorStorageV1} from './tavern-lore-editor-data.js'

type Values=Record<string,unknown>
interface Draft {
  readonly entryId:string
  readonly sourceSha256:string
  readonly revision:number
  readonly rawEntryPointer:string
  readonly rawEntrySha256:string
  readonly values:Values
  readonly changes:TavernLoreCurrentNativeFieldsV1
  readonly raw:Readonly<Record<string,string>>
  readonly errors:Readonly<Record<string,string>>
}
export interface TavernLoreEditorStateV1 {
  readonly sessionId:string|null
  readonly editor:TavernLoreEditorDataV1|null
  readonly draft:Draft|null
  readonly loading:boolean
  readonly saving:boolean
  readonly staleDraft:boolean
  readonly error:string|null
  readonly pending:TavernLoreEditorPendingV1|null
  readonly failureDetails:TavernLoreEditorFailureDetailsV1|null
  readonly canRecover:boolean
  readonly storageBlocked:boolean
}
interface ControllerDependencies {
  readonly jsonFetch:<T>(url:string,init?:RequestInit)=>Promise<T>
  readonly storage:()=>TavernLoreEditorStorageV1
  readonly operationId?:()=>string
  readonly toast?:(text:string)=>void
}
const URL_PATH='/api/roleplay/tavern-lore-editor'
const HASH=/^[a-f0-9]{64}$/
const empty=(sessionId:string|null):TavernLoreEditorStateV1=>({sessionId,editor:null,draft:null,loading:false,
  saving:false,staleDraft:false,error:null,pending:null,failureDetails:null,canRecover:false,storageBlocked:false})
const object=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x)
function editorOf(reply:unknown,sid:string):TavernLoreEditorDataV1|null {
  if(!object(reply)||reply.schemaVersion!==1||reply.ok!==true||!object(reply.editor))return null
  const editor=reply.editor
  if(editor.authority!=='consumer-data-only'||editor.sessionId!==sid||typeof editor.sourceSha256!=='string'
    ||!HASH.test(editor.sourceSha256)||typeof editor.dataSha256!=='string'||!HASH.test(editor.dataSha256)
    ||typeof editor.revision!=='number'||!Number.isSafeInteger(editor.revision)||editor.revision<0
    ||editor.revision>256||!Array.isArray(editor.entries)||editor.entries.length>4096)return null
  const seen=new Set<string>()
  for(const row of editor.entries) {
    if(!object(row)||typeof row.entryId!=='string'||seen.has(row.entryId)||typeof row.rawEntryPointer!=='string'
      ||typeof row.rawEntrySha256!=='string'||!HASH.test(row.rawEntrySha256)||!object(row.semantic)
      ||Object.hasOwn(row.semantic,'content')||typeof row.contentText!=='string'||!Array.isArray(row.fieldSources)
      ||!Array.isArray(row.diagnosticCodes)||row.diagnosticCodes.some(code=>typeof code!=='string'))return null
    seen.add(row.entryId)
  }
  return editor as unknown as TavernLoreEditorDataV1
}
function failureOf(error:unknown):TavernLoreEditorFailureDetailsV1|null {
  if(!object(error))return null
  const descriptor=Object.getOwnPropertyDescriptor(error,'details')
  const details=descriptor&&'value' in descriptor?descriptor.value:undefined
  if(!object(details)||typeof details.phase!=='string'||!['before-store','after-store'].includes(details.phase)
    ||typeof details.outcome!=='string'||!['no-write','refused','unknown','edited-unconfirmed'].includes(details.outcome))return null
  if(details.refusal!==undefined&&(!object(details.refusal)||details.refusal.schemaVersion!==1
    ||details.refusal.kind!=='refused'||!Array.isArray(details.refusal.diagnostics)
    ||details.refusal.diagnostics.some(d=>!object(d)||typeof d.code!=='string')))return null
  return details as unknown as TavernLoreEditorFailureDetailsV1
}
function draftFor(editor:TavernLoreEditorDataV1,row:TavernLoreEditorEntryV1):Draft {
  return {entryId:row.entryId,sourceSha256:editor.sourceSha256,revision:editor.revision,
    rawEntryPointer:row.rawEntryPointer,rawEntrySha256:row.rawEntrySha256,
    values:{...row.semantic,content:row.contentText},changes:{},raw:{},errors:{}}
}
/** Client selection owns display and response lifetimes only. All mutation
 * authority remains in the actual route supplier and append-only store. */
export function createTavernLoreEditorControllerV1(deps:ControllerDependencies) {
  let state=empty(null),epoch=0,readRun=0
  let readAbort:AbortController|undefined
  const listeners=new Set<(state:TavernLoreEditorStateV1)=>void>()
  const publish=(patch:Partial<TavernLoreEditorStateV1>):void=>{
    state=Object.freeze({...state,...patch});for(const listener of listeners)listener(state)
  }
  const live=(sid:string,captured:number):boolean=>state.sessionId===sid&&epoch===captured
  const failureMessage=(details:TavernLoreEditorFailureDetailsV1|null):string=>
    details?.refusal?.diagnostics.map(d=>d.code).join(' · ')||'保存结果尚未确认，请重新确认后恢复本次保存'
  async function selectSession(sid:string|null):Promise<void> {
    epoch++;readRun++;readAbort?.abort();readAbort=undefined
    state=Object.freeze(empty(sid));for(const listener of listeners)listener(state)
    if(!sid)return
    const captured=epoch
    try {
      const pending=await readTavernLoreEditorPendingV1(deps.storage(),sid)
      if(!live(sid,captured))return
      if(pending)publish({pending,error:'已恢复上次待确认请求；正在重新读取当前会话'})
    } catch {
      if(live(sid,captured))publish({storageBlocked:true,error:'恢复记录无效或不可读取；本面板保持只读，记录未删除'})
    }
    if(live(sid,captured))await reload()
  }
  async function reload():Promise<void> {
    const sid=state.sessionId,captured=epoch,run=++readRun
    if(!sid||state.saving)return
    readAbort?.abort();readAbort=new AbortController()
    const signal=readAbort.signal
    publish({loading:true,canRecover:false})
    let storageReady=false
    try {
      const stored=await readTavernLoreEditorPendingV1(deps.storage(),sid)
      if(!live(sid,captured)||readRun!==run)return
      if(stored&&state.pending&&stored.body!==state.pending.body) {
        publish({storageBlocked:true,error:'恢复记录发生冲突；原请求与已有记录均未改写'});return
      }
      if(!stored&&state.pending)persistTavernLoreEditorPendingV1(deps.storage(),state.pending)
      publish({pending:stored??state.pending,storageBlocked:false})
      storageReady=true
      const reply=await deps.jsonFetch<TavernLoreEditorReplyV1>(URL_PATH+'?sessionId='+encodeURIComponent(sid),{signal})
      if(!live(sid,captured)||readRun!==run)return
      if(!reply.ok)throw Object.assign(Error(reply.error),{code:reply.code,details:reply.details})
      const editor=editorOf(reply,sid)
      if(!editor){publish({error:'世界书数据与当前会话不一致，请重新加载',editor:null});return}
      const pending=state.pending,original=state.draft
      const staleDraft=!!original&&(original.sourceSha256!==editor.sourceSha256||original.revision!==editor.revision
        ||!editor.entries.some(row=>row.entryId===original.entryId&&row.rawEntrySha256===original.rawEntrySha256))
      const canRecover=!!pending&&pending.request.expectedSourceSha256===editor.sourceSha256
        &&editor.revision>=pending.request.expectedRevision&&editor.entries.some(row=>
          row.rawEntryPointer===pending.request.rawEntryPointer&&row.rawEntrySha256===pending.request.rawEntrySha256)
      publish({editor,staleDraft,canRecover,error:state.storageBlocked?state.error:
        pending?(canRecover?'本次请求仍需服务端确认；可恢复原请求':'Source 或条目版本已变化；原请求已保留，请重新加载并核对'):
          staleDraft?'Source 或 revision 已变化，请重新载入条目后编辑':null,failureDetails:null})
    } catch(error) {
      if(!live(sid,captured)||readRun!==run||signal.aborted)return
      if(!storageReady) {
        publish({editor:null,storageBlocked:true,error:'恢复记录无效或无法安全读取；记录未删除，本面板保持只读'})
        return
      }
      const details=failureOf(error),pending=state.pending
      const serverPending=details?.refusal?.diagnostics.find(d=>d.code==='PENDING_INTENT')?.pending
      const canRecover=!!pending&&serverPending?.operationId===pending.operationId
        &&serverPending.payloadSha256===pending.payloadSha256
      publish({editor:null,failureDetails:details,canRecover,error:serverPending
        ?canRecover?'服务端保留本次待确认记录；可恢复原请求':'服务端存在另一待确认操作；请先核对锚点，不能创建新操作'
        :'暂时无法读取结构化世界书，请重新加载'})
    } finally {
      if(live(sid,captured)&&readRun===run)publish({loading:false})
    }
  }
  function selectEntry(entryId:string):void {
    if(state.pending||state.saving||state.storageBlocked||!state.editor)return
    const row=state.editor.entries.find(entry=>entry.entryId===entryId)
    if(row)publish({draft:draftFor(state.editor,row),staleDraft:false,error:null})
  }
  function change(field:string,value:unknown,raw?:string):void {
    const draft=state.draft
    if(!draft||state.pending||state.saving||state.staleDraft)return
    const errors={...draft.errors},rawValues={...draft.raw,...(raw!==undefined?{[field]:raw}:{})}
    try {
      validateTavernLoreEditorFieldV1(field,value);delete errors[field]
      publish({draft:{...draft,values:{...draft.values,[field]:value},changes:{...draft.changes,[field]:value},
        raw:rawValues,errors},error:null})
    } catch {errors[field]='字段格式无效；请修正后保存';publish({draft:{...draft,raw:rawValues,errors}})}
  }
  function cancelDraft():void {
    if(!state.pending&&!state.saving)publish({draft:null,staleDraft:false,error:null})
  }
  async function reloadEntry():Promise<void> {
    const sid=state.sessionId,captured=epoch,id=state.draft?.entryId
    if(!sid||!id||state.pending||state.saving)return
    await reload()
    if(live(sid,captured)&&state.editor)selectEntry(id)
  }
  async function send(pending:TavernLoreEditorPendingV1,firstAttempt:boolean,captured:number):Promise<void> {
    const sid=pending.sessionId
    if(!live(sid,captured))return
    readRun++;readAbort?.abort();publish({saving:true,loading:false,canRecover:false,error:null})
    let attemptedSend=false
    try {
      // Verify the exact durable browser bytes before every actual send. Storage
      // conflicts never generate a new operation or replace an unknown payload.
      persistTavernLoreEditorPendingV1(deps.storage(),pending)
      publish({pending})
      attemptedSend=true
      const reply=await deps.jsonFetch<TavernLoreEditorReplyV1>(URL_PATH,{method:'POST',
        headers:{'content-type':'application/json'},body:pending.body})
      if(!live(sid,captured))return
      if(!reply.ok)throw Object.assign(Error(reply.error),{code:reply.code,details:reply.details})
      const editor=editorOf(reply,sid)
      if(!editor||!reply.receipt||!tavernLoreReceiptMatchesV1(reply.receipt,pending)) {
        publish({error:'返回结果无法证明本次操作；请保留原请求并重新确认'});return
      }
      clearTavernLoreEditorPendingV1(deps.storage(),pending)
      publish({editor,pending:null,draft:null,staleDraft:false,failureDetails:null,error:null})
      deps.toast?.('结构化世界书已保存')
    } catch(error) {
      if(!live(sid,captured))return
      if(!attemptedSend) {
        let stored:TavernLoreEditorPendingV1|null=null
        try {stored=await readTavernLoreEditorPendingV1(deps.storage(),sid)} catch {}
        if(live(sid,captured))publish({pending:state.pending??stored,storageBlocked:true,
          error:'恢复记录无法安全保存；本次请求未发送，已有记录未改写'})
        return
      }
      const details=failureOf(error)
      if(firstAttempt&&details?.outcome==='no-write'&&!details.receipt
        &&!details.refusal?.diagnostics.some(d=>d.pending||d.recovery)) {
        try {clearTavernLoreEditorPendingV1(deps.storage(),pending)
          publish({pending:null,failureDetails:details,error:failureMessage(details),
            staleDraft:details.refusal?.diagnostics.some(d=>['SOURCE_CHANGED','REVISION_MISMATCH','ENTRY_LINK_INVALID'].includes(d.code))??false})
        } catch {publish({storageBlocked:true,error:'未写入，但恢复记录无法安全清理；请保留记录并重新加载'})}
      } else publish({failureDetails:details,error:failureMessage(details)})
    } finally {if(live(sid,captured))publish({saving:false})}
  }
  async function save():Promise<void> {
    const sid=state.sessionId,draft=state.draft,captured=epoch
    if(!sid||!draft||state.saving||state.pending||state.storageBlocked||state.staleDraft
      ||Object.keys(draft.errors).length||!Object.keys(draft.changes).length)return
    publish({saving:true,error:null})
    try {
      const request=canonicalTavernLoreEditRequestV1({sessionId:sid,expectedSourceSha256:draft.sourceSha256,
        expectedRevision:draft.revision,operationId:deps.operationId?.()??'lore-'+globalThis.crypto.randomUUID(),
        rawEntryPointer:draft.rawEntryPointer,rawEntrySha256:draft.rawEntrySha256,fields:draft.changes})
      const payloadSha256=await tavernLoreEditPayloadSha256V1(request)
      if(!live(sid,captured))return
      const pending=createTavernLoreEditorPendingV1(request,payloadSha256)
      // Save/confirm happens in the click handler, never in an effect or reload.
      await send(pending,true,captured)
    } catch {if(live(sid,captured))publish({error:'请求无法冻结或保存恢复记录；本次修改未发送'})}
    finally {if(live(sid,captured))publish({saving:false})}
  }
  async function recover():Promise<void> {
    const pending=state.pending
    if(!pending||!state.canRecover||state.loading||state.saving||state.storageBlocked)return
    await send(pending,false,epoch)
  }
  return {getState:()=>state,selectSession,reload,reloadEntry,selectEntry,change,cancelDraft,save,recover,
    subscribe(listener:(state:TavernLoreEditorStateV1)=>void){listeners.add(listener);return ()=>{listeners.delete(listener)}}}
}

const labels:Readonly<Record<string,string>>={enabled:'启用',constant:'常驻',selective:'次关键词筛选',ignoreBudget:'忽略预算',
  primaryKeys:'主关键词（JSON 数组）',secondaryKeys:'次关键词（JSON 数组）',selectiveLogic:'筛选逻辑',order:'插入顺序',
  position:'插入位置',role:'角色',depth:'聊天深度',sticky:'持续轮数',cooldown:'冷却轮数',delay:'延后轮数',
  useProbability:'启用概率',probability:'激活概率 %',caseSensitive:'区分大小写',matchWholeWords:'完整词匹配',
  scanDepth:'扫描深度',excludeRecursion:'不参与递归扫描',preventRecursion:'不触发递归',delayUntilRecursion:'延迟递归',
  displayIndex:'显示顺序',group:'分组',groupOverride:'覆盖分组选择',groupWeight:'分组权重',useGroupScoring:'使用分组评分',
  outletName:'Outlet 名称',vectorized:'向量化声明',automationId:'Automation ID',triggers:'触发声明（JSON 数组）',
  matchPersonaDescription:'扫描用户设定',matchCharacterDescription:'扫描角色描述',matchCharacterPersonality:'扫描角色性格',
  matchCharacterDepthPrompt:'扫描角色深度提示',matchScenario:'扫描场景',matchCreatorNotes:'扫描作者备注'}
interface PanelDependencies {
  readonly React:typeof ReactAPI
  readonly jsonFetch:ControllerDependencies['jsonFetch']
  readonly toast:(text:string)=>void
  readonly storage?:()=>TavernLoreEditorStorageV1
  readonly operationId?:()=>string
}
export function createTavernLoreEditorPanelV1(deps:PanelDependencies) {
  const {React}=deps
  function TavernLoreEditorPanel({scope,visible}:{scope?:{sessionId:string};visible?:boolean}) {
    const sid=scope?.sessionId??null
    const renderedSid=React.useRef(sid);renderedSid.current=sid
    const [controller]=React.useState(()=>createTavernLoreEditorControllerV1({jsonFetch:deps.jsonFetch,
      storage:deps.storage??(()=>globalThis.sessionStorage),toast:deps.toast,
      ...(deps.operationId?{operationId:deps.operationId}:{})}))
    const [state,setState]=React.useState(controller.getState)
    React.useEffect(()=>controller.subscribe(setState),[controller])
    React.useEffect(()=>{void controller.selectSession(visible===false?null:sid)
      return ()=>{void controller.selectSession(null)}
    },[controller,sid,visible])
    if(visible===false)return null
    const guarded=(action:()=>void|Promise<void>)=>()=>{
      if(renderedSid.current===sid&&controller.getState().sessionId===sid)void action()
    }
    const button=(text:string,action:()=>void|Promise<void>,disabled=false)=>React.createElement('button',{
      type:'button',className:'dsh-rp-btn',disabled,onClick:guarded(action)},text)
    if(state.sessionId!==sid)return React.createElement('div',{className:'dsh-rp-panel',role:'status'},'正在读取当前会话…')
    const draft=state.draft,pending=state.pending
    const blocked=state.saving||!!pending||state.staleDraft||state.storageBlocked
    const edit=(key:string,value:unknown,text?:string):void=>{
      if(renderedSid.current===sid&&controller.getState().sessionId===sid)controller.change(key,value,text)
    }
    const row=draft?state.editor?.entries.find(e=>e.entryId===draft.entryId):undefined
    const raw=(key:string):string=>draft?.raw[key]??(Array.isArray(draft?.values[key])?
      JSON.stringify(draft!.values[key],null,2):draft?.values[key]===null?'':String(draft?.values[key]??''))
    const error=(key:string)=>draft?.errors[key]?React.createElement('small',{role:'alert',className:'dsh-rp-error'},draft.errors[key]):null
    const field=(key:string,control:ReactAPI.ReactNode)=>React.createElement('label',{key,className:'dsh-rp-field',
      style:{display:'flex',flexDirection:'column',gap:4}},labels[key]??key,control,error(key))
    const checkbox=(key:string)=>field(key,React.createElement('input',{type:'checkbox',checked:draft?.values[key]===true,
      'data-lore-field':key,onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>edit(key,event.target.checked)}))
    const number=(key:string,nullable=false)=>field(key,React.createElement('input',{className:'dsh-rp-input',type:'number',
      value:raw(key),'data-lore-field':key,onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>{
        const text=event.target.value
        edit(key,text===''?(nullable?null:NaN):Number(text),text)
      }}))
    const select=(key:string,options:readonly string[])=>field(key,React.createElement('select',{
      className:'dsh-rp-input',value:raw(key),'data-lore-field':key,
      onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>edit(key,event.target.value)},
      options.map(value=>React.createElement('option',{key:value,value},value))))
    const nullBool=(key:string)=>field(key,React.createElement('select',{className:'dsh-rp-input',
      value:draft?.values[key]===null?'null':String(draft?.values[key]),'data-lore-field':key,
      onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>edit(key,
        event.target.value==='null'?null:event.target.value==='true')},
      React.createElement('option',{value:'null'},'继承（null）'),React.createElement('option',{value:'true'},'是'),
      React.createElement('option',{value:'false'},'否')))
    const array=(key:string)=>field(key,React.createElement('textarea',{className:'dsh-rp-textarea',value:raw(key),rows:3,
      'data-lore-field':key,onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>{
        const text=event.target.value;let value:unknown
        try {value=JSON.parse(text)} catch {value=undefined}
        edit(key,value,text)
      }}))
    const textField=(key:string)=>field(key,React.createElement('input',{className:'dsh-rp-input',value:raw(key),
      'data-lore-field':key,onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>edit(key,event.target.value)}))
    const anchor=state.failureDetails?.refusal?.diagnostics.find(d=>d.recovery||d.pending)
    return React.createElement('section',{className:'dsh-rp-panel','data-tavern-lore-editor':sid??'',
      'aria-label':'结构化世界书编辑'},React.createElement('div',{className:'dsh-rp-row'},
      React.createElement('h4',{style:{flex:1,margin:0}},'结构化世界书'),button('重新加载',controller.reload,state.loading||state.saving)),
      React.createElement('p',{className:'dsh-rp-muted'},'编辑当前会话的结构化条目；内容保持原文，模板不会在编辑器运行。'),
      state.loading?React.createElement('p',{role:'status'},'正在读取世界书…'):null,
      state.error?React.createElement('p',{role:'alert',className:'dsh-rp-error'},state.error):null,
      state.staleDraft&&!pending?button('重新载入当前条目（清除未保存修改）',controller.reloadEntry,state.loading||state.saving):null,
      pending?React.createElement('section',{'data-lore-pending':pending.operationId},
        React.createElement('p',null,'本次保存尚未确认。保留原请求，不创建另一操作。'),
        React.createElement('pre',{className:'dsh-rp-muted',style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},
          `操作 ${pending.operationId}\npayload ${pending.payloadSha256}\nSource ${pending.request.expectedSourceSha256}`
          +`\nrevision ${pending.request.expectedRevision}\n条目 ${pending.request.rawEntryPointer}`),
        React.createElement('textarea',{className:'dsh-rp-textarea',readOnly:true,value:JSON.stringify(pending.request.fields,null,2),
          'aria-label':'待确认修改内容'}),button('恢复本次保存',controller.recover,!state.canRecover||state.loading||state.saving||state.storageBlocked)):null,
      anchor?React.createElement('pre',{className:'dsh-rp-muted',style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'},
        'aria-label':'服务端恢复锚点'},JSON.stringify(anchor.recovery??anchor.pending,null,2)):null,
      state.failureDetails?.receipt?React.createElement('pre',{className:'dsh-rp-muted','aria-label':'待确认保存凭据'},
        JSON.stringify(state.failureDetails.receipt,null,2)):null,
      state.editor?React.createElement('div',{className:'dsh-rp-row'},React.createElement('select',{
        className:'dsh-rp-input','aria-label':'选择结构化世界书条目',disabled:blocked,
        value:draft?.entryId??'',onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>{
          if(renderedSid.current===sid&&controller.getState().sessionId===sid)controller.selectEntry(event.target.value)
        }},
        React.createElement('option',{value:''},'选择条目'),state.editor.entries.map((entry,index)=>React.createElement('option',{
          key:entry.entryId,value:entry.entryId},`${index+1} · ${entry.disposition} · ${entry.rawEntryPointer}`)))):null,
      draft?React.createElement(React.Fragment,null,React.createElement('fieldset',{disabled:blocked,
        style:{border:0,padding:0,margin:0},'data-lore-edit-form':draft.entryId},
        React.createElement('div',{className:'dsh-rp-row',style:{flexWrap:'wrap'}},
          ['enabled','constant','selective'].map(checkbox)),array('primaryKeys'),array('secondaryKeys'),
        select('selectiveLogic',LORE_EDITOR_LOGIC_V1),select('position',LORE_EDITOR_POSITIONS_V1),
        select('role',LORE_EDITOR_ROLES_V1),number('order'),number('depth'),checkbox('ignoreBudget'),
        React.createElement('div',{className:'dsh-rp-row',style:{flexWrap:'wrap'}},
          number('sticky',true),number('cooldown',true),number('delay',true)),
        checkbox('useProbability'),number('probability'),
        React.createElement('label',{className:'dsh-rp-field'},'完整内容（模板原文）',React.createElement('textarea',{
          className:'dsh-rp-textarea',rows:12,value:raw('content'),'data-lore-field':'content',
          onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>edit('content',event.target.value)}),error('content')),
        React.createElement('details',null,React.createElement('summary',null,'扫描、递归与其他控制'),
          LORE_EDITOR_NULL_BOOL_FIELDS_V1.map(nullBool),number('scanDepth',true),
          LORE_EDITOR_BOOL_FIELDS_V1.filter(k=>!['enabled','constant','selective','ignoreBudget','useProbability'].includes(k)).map(checkbox),
          ['displayIndex','groupWeight'].map(k=>number(k)),['group','outletName','automationId'].map(textField),array('triggers'),
          field('delayUntilRecursion',React.createElement('input',{className:'dsh-rp-input',
            value:raw('delayUntilRecursion'),'data-lore-field':'delayUntilRecursion',
            onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>{
              const text=event.target.value;edit('delayUntilRecursion',
                text==='false'?false:text==='true'?true:text.trim()===''?NaN:Number(text),text)
            }})),React.createElement('small',{className:'dsh-rp-muted'},'延迟递归可填 true、false 或非负整数；留空的可继承控制保留 null。')),
        React.createElement('div',{className:'dsh-rp-row'},button(state.saving?'保存中…':'保存结构化条目',controller.save,
          blocked||!Object.keys(draft.changes).length||!!Object.keys(draft.errors).length),button('取消编辑',controller.cancelDraft,blocked))),
        row?React.createElement('details',null,React.createElement('summary',null,'原始诊断与字段来源'),
          row.diagnosticCodes.length?React.createElement('p',{className:'dsh-rp-muted'},row.diagnosticCodes.join(' · ')):
            React.createElement('p',{className:'dsh-rp-muted'},'无原始诊断'),
          row.fieldSources.map((source,index)=>React.createElement('div',{key:index,className:'dsh-rp-item'},
            React.createElement('code',null,source.field),React.createElement('p',{className:'dsh-rp-muted'},
              `${source.pointer} · ${source.disposition}`),React.createElement('small',null,
              `${source.valueSha256}${source.originKind?' · '+source.originKind+' · '+source.originSha256:''}`)))):null):null)
  }
  return TavernLoreEditorPanel
}
