import type * as ReactAPI from 'react'
import type {MvuJsonObject,MvuJsonValue} from '../core/tavern-mvu-initvar.js'
import type {MvuPlayerEditRequest,MvuPlayerEditResponse,MvuStateObservation}
  from '../core/roleplay-mvu-player-types.js'
import {mvuPlayerEditExpectedV1 as expected} from '../core/roleplay-mvu-player-expected.js'

type Ready=Extract<MvuStateObservation,{kind:'ready'|'schema-ready'}>
const isReady=(state:MvuStateObservation|undefined):state is Ready=>
  state?.kind==='ready'||state?.kind==='schema-ready'
interface Draft {
  base:Ready
  baseKey:string
  values:MvuJsonObject
  raw:Record<string,string>
  errors:Record<string,string>
  dirty:boolean
  comparison?:string
  message?:string
  operation?:{request:MvuPlayerEditRequest;state:'pending'|'unknown'|'conflict';serial:number}
}
interface PanelProps {
  sessionId:string
  sessionLabel?:string
  worldlineLabel?:string
  observation?:MvuStateObservation
  refresh():Promise<unknown>
}
interface Dependencies {
  React:typeof ReactAPI
  invalidateState(sessionId:string):void
  fetch?:typeof globalThis.fetch
}
const copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value))
const baseKey=(state:Ready)=>JSON.stringify(expected(state))
const observationKey=(state:MvuStateObservation|undefined)=>isReady(state)
  ? JSON.stringify([state.sessionId,baseKey(state),state.canEdit,state.editBlockCode])
  : JSON.stringify(state??null)
const pointer=(parts:readonly string[])=>'/'+parts.map(part=>part.replace(/~/g,'~0').replace(/\//g,'~1')).join('/')
const typeName=(value:MvuJsonValue)=>value===null?'空值':Array.isArray(value)?'列表':
  typeof value==='object'?'对象':typeof value==='number'?'数字':typeof value==='boolean'?'开关':'文本'

/** Scoped panel styles are included by the owning native tool window. */
export const MVU_PANEL_CSS=`
.dsh-rp-mvu-state{color:var(--rp-tool-ink,#49392c);min-width:0;font-size:14px;line-height:1.55}
.dsh-rp-mvu-state h3,.dsh-rp-mvu-state p{margin:0}
.dsh-rp-mvu-heading,.dsh-rp-mvu-toolbar,.dsh-rp-mvu-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dsh-rp-mvu-heading{justify-content:space-between;margin-bottom:4px}
.dsh-rp-mvu-version{font-size:13px;color:var(--rp-tool-muted,#766553)}
.dsh-rp-mvu-identity{flex:1;min-width:0}
.dsh-rp-mvu-identity>summary{display:flex;align-items:center;gap:10px;min-height:36px;cursor:pointer;list-style:none}
.dsh-rp-mvu-identity>summary::before{content:'▸';font-size:11px;color:var(--rp-tool-muted,#766553)}
.dsh-rp-mvu-identity[open]>summary::before{content:'▾'}
.dsh-rp-mvu-session-label{font-weight:600;overflow-wrap:anywhere}
.dsh-rp-mvu-worldline-label{font-size:12px;color:var(--rp-tool-muted,#766553)}
.dsh-rp-mvu-context{margin:0;padding:4px 0 8px}
.dsh-rp-mvu-context dt{font-size:12px;color:var(--rp-tool-muted,#766553)}
.dsh-rp-mvu-context dd{margin:3px 0 0;overflow-wrap:anywhere;font-size:12px}
.dsh-rp-mvu-notice{padding:10px 12px;margin:10px 0!important;background:var(--rp-tool-soft,#f3ead9);border-inline-start:3px solid var(--rp-tool-accent,#8b571c);border-radius:4px}
.dsh-rp-mvu-toolbar{justify-content:space-between;margin:6px 0}
.dsh-rp-mvu-toolbar-buttons{display:flex;gap:8px;flex-wrap:wrap}
.dsh-rp-mvu-mode{color:var(--rp-tool-muted,#766553);font-size:13px}
.dsh-rp-mvu-field{padding:6px 0;border-bottom:1px solid var(--rp-tool-border,#dccbb3);min-width:0}
.dsh-rp-mvu-field-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.dsh-rp-mvu-name{font-weight:600;overflow-wrap:anywhere}
.dsh-rp-mvu-value{white-space:pre-wrap;overflow-wrap:anywhere;min-width:0;margin-top:3px}
.dsh-rp-mvu-value[data-mvu-type=number]{font-size:22px;font-variant-numeric:tabular-nums;line-height:1.3;color:var(--rp-tool-accent,#8b571c)}
.dsh-rp-mvu-value[data-mvu-type=boolean]{font-weight:600}
.dsh-rp-mvu-value[data-mvu-type=null]{color:var(--rp-tool-muted,#766553)}
.dsh-rp-mvu-group>summary{display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer;min-height:44px;font-weight:600;list-style:none}
.dsh-rp-mvu-group>summary::before{content:'▸';color:var(--rp-tool-muted,#766553)}
.dsh-rp-mvu-group[open]>summary::before{content:'▾'}
.dsh-rp-mvu-group-name{flex:1;overflow-wrap:anywhere}
.dsh-rp-mvu-count{font-size:12px;font-weight:400;color:var(--rp-tool-muted,#766553);white-space:nowrap}
.dsh-rp-mvu-children{padding-inline-start:16px;border-inline-start:2px solid var(--rp-tool-border,#dccbb3)}
.dsh-rp-mvu-children>.dsh-rp-mvu-field:last-child{border-bottom:0}
.dsh-rp-mvu-meta,.dsh-rp-mvu-advanced{margin-top:3px;font-size:12px;color:var(--rp-tool-muted,#766553)}
.dsh-rp-mvu-meta>summary,.dsh-rp-mvu-advanced>summary{cursor:pointer;min-height:30px;display:flex;align-items:center;gap:6px}
.dsh-rp-mvu-meta>summary::before,.dsh-rp-mvu-advanced>summary::before{content:'+'}
.dsh-rp-mvu-meta[open]>summary::before,.dsh-rp-mvu-advanced[open]>summary::before{content:'−'}
.dsh-rp-mvu-meta code{overflow-wrap:anywhere;white-space:pre-wrap;font-size:12px}
.dsh-rp-mvu-input{display:block;width:100%;box-sizing:border-box;border:1px solid var(--rp-tool-border,#dccbb3);border-radius:6px;background:var(--rp-tool-paper,#fffaf1);color:var(--rp-tool-ink,#49392c);padding:9px 10px;font:inherit;min-height:44px;margin-top:6px}
textarea.dsh-rp-mvu-input{resize:vertical;white-space:pre-wrap;overflow-wrap:anywhere}
.dsh-rp-mvu-input:disabled{opacity:.65}
.dsh-rp-mvu-state button{min-height:44px;border:1px solid var(--rp-tool-border,#dccbb3);border-radius:6px;padding:8px 12px;background:var(--rp-tool-paper,#fffaf1);color:var(--rp-tool-ink,#49392c);font:inherit;cursor:pointer}
.dsh-rp-mvu-state button:disabled{opacity:.5;cursor:default}
.dsh-rp-mvu-state button.dsh-rp-mvu-primary{background:var(--rp-tool-accent,#8b571c);color:#fffaf1;border-color:var(--rp-tool-accent,#8b571c)}
.dsh-rp-mvu-state :is(button,input,select,textarea,summary):focus-visible{outline:2px solid var(--rp-tool-accent,#8b571c);outline-offset:3px}
.dsh-rp-mvu-error{color:#9b3028;margin-top:6px!important}
.dsh-rp-mvu-actions{padding:12px 0 4px;margin-top:12px;border-top:1px solid var(--rp-tool-border,#dccbb3)}
.dsh-rp-mvu-json{white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto;padding:12px;background:var(--rp-tool-soft,#f3ead9);border-radius:6px}
@media(max-width:480px){.dsh-rp-mvu-actions button{flex:1 1 auto}.dsh-rp-mvu-children{padding-inline-start:10px}}
`

function reason(code?:string) {
  if(code==='GENESIS_UNPROVEN')return '尚无可确认的数值初始化。初始化可能尚未完成或不受支持，请检查角色卡与开场。'
  if(code==='NUMERICAL_EDIT_UNKNOWN')return '正文编辑的数值影响尚未确认，暂不能保存。请刷新检查，不要用旧数值继续写入。'
  if(code==='OWNED_PARTIAL_OR_ORPHAN')return '上次数值写入尚未完整确认，暂不能继续修改。请保留当前世界线并刷新检查。'
  if(code==='MVU_PLAYER_PENDING')return '上次数值保存仍在确认，请稍后刷新，或重试同一次保存。'
  if(/EDIT_INVALIDATED/.test(code??''))return '正文已修改，数值暂不可用。请从编辑影响之前重新生成，再继续剧情。'
  if(/BUSY|RUNNING|IN_FLIGHT|ACTIVE_WORK/.test(code??''))return '当前回合仍在进行，请等结束后刷新再编辑。'
  if(/SOURCE/.test(code??''))return '角色卡或设定已变化，当前数值来源无法确认。请核对来源后重新载入。'
  if(/GENESIS|INITIALIZATION|NOT_INITIALIZED|NO_NUMERICAL|ABSENT/.test(code??''))return '尚未完成数值初始化，请先选择有效的作者开场。'
  if(/CONFLICT|CHANGED|STALE|BASE_MISMATCH/.test(code??''))return '数值或剧情已在其他操作中变化。草稿已保留，请刷新后比较并合并。'
  if(/DELETED|NOT_STORY|BRANCH|SESSION_INACTIVE/.test(code??''))return '这条世界线当前不可编辑，请重新打开或切换到可用版本。'
  return '当前数值无法确认，暂不能保存。请刷新检查；程序不会用旧数值继续写入。'
}
function schemaRefusalReason(code?:string) {
  if(code==='SCHEMA_VALIDATION_FAILED')return '这次修改不符合角色卡的数值规则。'
  if(code==='SCHEMA_OUTPUT_DATA_INVALID'||code==='SCHEMA_ROOT_OBJECT_REQUIRED')return '角色卡规则产生了无效数值。'
  if(code==='SCHEMA_OUTPUT_LIMIT')return '角色卡规则产生的数值超过了保存限额。'
  if(code==='MANUAL_COMMANDS_UNSUPPORTED')return '角色卡在手动保存时产生了额外命令，这项规则暂不支持。'
  return '角色卡规则没有接受这次修改。'
}

/** Validate editor JSON as data, preserving types before serialization. The
 * server owns all schema, size, permission and persistent-write validation. */
function parseJson(text:string):MvuJsonValue {
  const value:unknown=JSON.parse(text)
  function visit(item:unknown):void {
    if(typeof item==='number'&&!Number.isFinite(item))throw Error('数字必须是有限值。')
    if(item&&typeof item==='object')for(const [key,child] of Object.entries(item)) {
      if(['__proto__','prototype','constructor'].includes(key))throw Error('这个字段名不可用于数值编辑。')
      visit(child)
    }
  }
  visit(value)
  return value as MvuJsonValue
}
function replaceValue(values:MvuJsonObject,parts:readonly string[],value:MvuJsonValue) {
  if(!parts.length) {
    if(!value||Array.isArray(value)||typeof value!=='object')throw Error('完整数值必须是 JSON 对象。')
    return value
  }
  const result=copy(values)
  let parent:MvuJsonObject|MvuJsonValue[]=result
  for(const part of parts.slice(0,-1))parent=(parent as MvuJsonObject)[part] as MvuJsonObject|MvuJsonValue[]
  Object.defineProperty(parent,parts.at(-1)!,{value,writable:true,enumerable:true,configurable:true})
  return result
}

/** Each native status surface owns isolated per-session drafts and exact retry
 * requests. No display flag or draft creates a numerical publication token. */
export function createMvuStatePanel({React,invalidateState,fetch=globalThis.fetch}:Dependencies) {
  const drafts=new Map<string,Draft>()
  const makeDraft=(state:Ready):Draft=>({base:copy(state),baseKey:baseKey(state),values:copy(state.snapshot.values),
    raw:{},errors:{},dirty:false})
  function MvuStatePanel({sessionId,sessionLabel,worldlineLabel,observation,refresh}:PanelProps) {
    const [,setVersion]=React.useState(0)
    const [editSessions,setEditSessions]=React.useState<ReadonlySet<string>>(()=>new Set())
    const [notice,setNotice]=React.useState<{sessionId:string;text:string}|undefined>(undefined)
    const [replyObservation,setReplyObservation]=React.useState<{
      sessionId:string;inputKey:string;observation:MvuStateObservation
    }|undefined>(undefined)
    const live=React.useRef<{sessionId:string;key:string}|undefined>(undefined)
    const incoming=observation?.sessionId===sessionId?observation:undefined
    const inputKey=observationKey(incoming)
    // A writer's conflict/denial observation is already an actual readback.
    // Keep it while the parent still supplies the request's old observation;
    // a new parent head, denial or session selection takes precedence.
    const state=replyObservation?.sessionId===sessionId&&replyObservation.inputKey===inputKey
      ?replyObservation.observation:incoming
    const key=observationKey(state)
    live.current={sessionId,key}
    React.useEffect(()=>()=>{live.current=undefined},[])
    React.useEffect(()=>{
      setReplyObservation(current=>current&&(current.sessionId!==sessionId||current.inputKey!==inputKey)
        ?undefined:current)
    },[sessionId,inputKey])
    const rerender=()=>setVersion(value=>value+1)
    let draft=drafts.get(sessionId)
    if(isReady(state)&&(!draft||(!draft.dirty&&!draft.operation&&draft.baseKey!==baseKey(state)))) {
      draft=makeDraft(state);drafts.set(sessionId,draft)
    }
    const ready=isReady(state)?state:undefined
    const stale=!!draft&&(!ready||draft.baseKey!==baseKey(ready))
    const pending=draft?.operation?.state==='pending'
    const uncertain=draft?.operation?.state==='unknown'
    const conflict=draft?.operation?.state==='conflict'
    const needsCompare=stale||conflict
    const editable=!!ready?.canEdit&&!needsCompare&&!pending&&!uncertain
    const editing=editSessions.has(sessionId)
    const ownsView=()=>live.current?.sessionId===sessionId&&live.current.key===key
    const edit=(parts:readonly string[],text:string,kind:'text'|'number'|'boolean'|'json')=>{
      if(!draft||!editable||!ownsView()||drafts.get(sessionId)!==draft||draft.operation)return
      const address=parts.length?pointer(parts):''
      draft.raw[address]=text;draft.dirty=true
      try {
        const value=kind==='text'?text:kind==='boolean'?text==='true':parseJson(text)
        if(kind==='number'&&typeof value!=='number')throw Error('请输入数字；不要加引号或留空。')
        draft.values=replaceValue(draft.values,parts,value)
        for(const field of Object.keys(draft.raw))if(field!==address&&(field===''||address===''
          ||field.startsWith(address+'/')||address.startsWith(field+'/'))) {
          delete draft.raw[field];delete draft.errors[field]
        }
        delete draft.errors[address]
        draft.operation=undefined
      } catch(error) {
        draft.errors[address]=error instanceof SyntaxError?'JSON 格式有误，请检查引号、逗号和括号。':
          error instanceof Error?error.message:'这个值无法读取。'
      }
      draft.message=undefined;setNotice(undefined);rerender()
    }
    const refreshSafely=async()=>{
      try {await refresh()} catch {if(ownsView()) {
        setNotice({sessionId,text:'暂时无法刷新，请稍后重试。'});rerender()
      }}
    }
    const save=async(retry=false)=>{
      if(!draft||!ownsView()||drafts.get(sessionId)!==draft||draft.operation?.state==='pending')return
      const active=draft
      if(!retry&&(!editable||active.operation||!active.dirty||Object.keys(active.errors).length))return
      if(retry&&active.operation?.state!=='unknown')return
      const request=retry?active.operation!.request:{schemaVersion:1 as const,sessionId,
        operationId:globalThis.crypto.randomUUID(),action:'replace-values' as const,
        expected:expected(active.base),values:copy(active.values)}
      const serial=(active.operation?.serial??0)+1
      active.operation={request,state:'pending',serial};active.message='正在保存数值…';rerender()
      const stillCurrent=()=>live.current?.sessionId===sessionId&&live.current.key===key
        &&drafts.get(sessionId)===active&&active.operation?.serial===serial
      try {
        // Preserve error observations/operation receipts that the general
        // jsonFetch helper discards. Retry uses the exact same request bytes.
        const response=await fetch('/api/roleplay/mvu-state',{method:'POST',
          headers:{'content-type':'application/json'},body:JSON.stringify(request)})
        const result=await response.json() as MvuPlayerEditResponse
        if(!stillCurrent()) {
          if(active.operation?.serial===serial)active.operation.state='unknown'
          return
        }
        if(result.operation&&result.operation.operationId!==request.operationId
          ||result.numericalState&&result.numericalState.sessionId!==sessionId)throw Error('保存回应不属于当前操作。')
        if(result.ok&&response.ok&&result.operation?.outcome==='refused') {
          // A completed refusal is a terminal result. Keep the editable draft,
          // release this operation ID, and do not offer an unknown-write retry.
          active.operation=undefined
          active.message=schemaRefusalReason(result.operation.refusalCode)+'已保留原数值，请调整草稿后再保存。'
          if(isReady(result.numericalState)&&result.numericalState.snapshot.valuesSha256===active.base.snapshot.valuesSha256) {
            active.base=copy(result.numericalState);active.baseKey=baseKey(active.base)
          }
          if(result.numericalState)setReplyObservation({sessionId,inputKey,observation:copy(result.numericalState)})
          invalidateState(sessionId)
          await refreshSafely()
        } else if(result.ok&&response.ok&&result.operation&&['updated','no-update'].includes(result.operation.outcome)) {
          setReplyObservation(undefined)
          setNotice({sessionId,text:result.operation.replayed?'上次保存已确认，不会重复修改。':
            result.operation.outcome==='no-update'?'数值没有变化。':'数值已保存。'})
          drafts.delete(sessionId)
          invalidateState(sessionId)
          await refreshSafely()
        } else {
          if(result.numericalState)setReplyObservation({sessionId,inputKey,observation:copy(result.numericalState)})
          if(response.status===409||/CONFLICT|CHANGED|STALE|BASE_MISMATCH/.test(result.code??'')) {
            active.operation!.state='conflict';active.message=reason(result.code??'CONFLICT')
          } else if(response.status===400||response.status===413) {
            active.operation=undefined
            active.message=response.status===413?'修改内容过大，请缩小后再保存。':'这个修改没有通过数值校验，请检查输入后再保存。'
          } else if(result.operation?.outcome==='unknown'||response.status>=500||!result.code) {
            active.operation!.state='unknown'
            active.message='上次保存是否完成暂无法确认。请刷新检查，或重试同一次保存；不会另开一次修改。'
          } else {
            active.operation=undefined
            active.message=result.code&&/INVALID|VALUE|JSON|SCHEMA|LIMIT|SIZE/.test(result.code)
              ? '这个修改没有通过数值校验，请检查输入后再保存。':reason(result.code)
          }
        }
      } catch {
        if(active.operation?.serial===serial)active.operation.state='unknown'
        if(stillCurrent()||live.current?.sessionId===sessionId) {
          active.message='保存回应未收到，草稿和原保存标识已保留。请重试同一次保存。'
        }
      } finally {
        if(live.current?.sessionId===sessionId)rerender()
      }
    }
    const discard=()=>{
      if(!ownsView()||drafts.get(sessionId)!==draft
        ||draft?.operation?.state==='pending'||draft?.operation?.state==='unknown')return
      if(ready)drafts.set(sessionId,makeDraft(ready))
      else drafts.delete(sessionId)
      setNotice(undefined)
      rerender()
    }
    const compareLatest=()=>{
      if(!ready||!draft||!ownsView()||drafts.get(sessionId)!==draft
        ||draft.operation?.state==='pending'||draft.operation?.state==='unknown')return
      const next=makeDraft(ready)
      next.comparison=JSON.stringify({数值:draft.values,输入:draft.raw},null,2)
      next.message='已载入最新数值。旧草稿保留在下方，核对后再修改保存。'
      drafts.set(sessionId,next);setNotice(undefined);rerender()
    }
    const h=React.createElement
    let remaining=200,limited=false
    const rows=(values:MvuJsonObject|MvuJsonValue[],parts:string[]=[]):ReactAPI.ReactNode=>
      Object.entries(values).map(([name,value])=>{
        if(remaining--<=0){limited=true;return null}
        const pathParts=[...parts,name],address=pointer(pathParts),label=typeName(value)
        const fieldName=Array.isArray(values)?`第 ${Number(name)+1} 项`:name
        const shown=!editing?'':editable&&draft?.raw[address]!==undefined?draft.raw[address]:
          typeof value==='string'?value:JSON.stringify(value,null,2)
        const common={'aria-label':`${fieldName}（${address}，${label}）`,'data-mvu-path':address,
          className:'dsh-rp-mvu-input',disabled:!editable}
        const error=draft?.errors[address]
        // A text edit may cross the long/multiline boundary while focused.
        // Keep one DOM control so React retains its caret and composition.
        const control=!editing?null:typeof value==='string'?
          h('textarea',{...common,rows:value.length>72||value.includes('\n')?3:1,value:shown,
            onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>edit(pathParts,event.target.value,'text')}):
          typeof value==='number'?h('input',{...common,type:'text',inputMode:'decimal',value:shown,
            onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>edit(pathParts,event.target.value,'number')}):
          typeof value==='boolean'?h('select',{...common,value:String(value),
            onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>edit(pathParts,event.target.value,'boolean')},
            h('option',{value:'true'},'开启'),h('option',{value:'false'},'关闭')):
          value===null?h(React.Fragment,null,h('span',{'data-mvu-null':address},'空值（null）'),
            h('input',{...common,type:'text',value:shown,
              onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>edit(pathParts,event.target.value,'json')})):null
        const structured=value!==null&&typeof value==='object'
        const childCount=structured?Object.keys(value).length:0
        const metadata=h('details',{className:'dsh-rp-mvu-meta'},h('summary',null,'字段信息'),
          h('div',null,label,' · ',h('code',null,address)))
        return h('div',{key:address,className:'dsh-rp-mvu-field'},structured
          ?h('details',{className:'dsh-rp-mvu-group','data-mvu-group':address},
            h('summary',null,h('span',{className:'dsh-rp-mvu-group-name'},fieldName),
              h('span',{className:'dsh-rp-mvu-count'},`${childCount} 项`)),
            h('div',{className:'dsh-rp-mvu-children'},childCount?rows(value,pathParts):
              h('p',{className:'dsh-rp-mvu-mode'},`空${label}`)),metadata,
            editing?h('details',{className:'dsh-rp-mvu-advanced'},h('summary',null,`高级：编辑此${label} JSON`),
              h('label',null,`${fieldName} JSON`,h('textarea',{...common,rows:4,value:shown,
                onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>edit(pathParts,event.target.value,'json')}))):null)
          :h(React.Fragment,null,editing?h('label',null,h('span',{className:'dsh-rp-mvu-name'},fieldName),control)
            :h(React.Fragment,null,h('div',{className:'dsh-rp-mvu-name'},fieldName),
              h('div',{className:'dsh-rp-mvu-value','data-mvu-value':address,
                'data-mvu-type':value===null?'null':typeof value},value===null?'空值':
                typeof value==='boolean'?(value?'开启':'关闭'):value===''?'（空文本）':String(value))),metadata),
          error?h('p',{role:'alert',className:'dsh-rp-mvu-error'},error):null)
      })
    const shownValues=ready?(needsCompare?ready.snapshot.values:draft?.values??ready.snapshot.values):undefined
    const table=shownValues?rows(shownValues):null
    return h('section',{className:'dsh-rp-mvu-state','aria-label':'游戏数值','data-session-id':sessionId,
      'data-mvu-mode':editing?'edit':'read'},
      h('style',null,MVU_PANEL_CSS),
      h('div',{className:'dsh-rp-mvu-heading'},
        h('details',{className:'dsh-rp-mvu-identity'},h('summary',null,
          h('span',{className:'dsh-rp-mvu-session-label'},sessionLabel||`会话 · ${sessionId.replace(/^session-/,'').slice(0,8)}`),
          h('span',{className:'dsh-rp-mvu-worldline-label'},worldlineLabel||'当前世界线')),
          h('dl',{className:'dsh-rp-mvu-context'},h('dt',null,'完整会话标识'),h('dd',null,sessionId))),
        ready?h('span',{className:'dsh-rp-mvu-version'},`第 ${ready.snapshot.revision} 版`):null),
      draft?.dirty?h('p',{role:'status',className:'dsh-rp-mvu-notice'},'有尚未保存的草稿。',
        !needsCompare?'当前修改仅保存在此会话中，保存后才会生效。':null):null,
      !state?h('p',{role:'status',className:'dsh-rp-mvu-notice'},'尚未读取到当前世界线的数值，请刷新检查。'):
        !isReady(state)?h('p',{role:'status',className:'dsh-rp-mvu-notice'},reason(state.code)):
        !state.canEdit?h('p',{role:'status',className:'dsh-rp-mvu-notice'},reason(state.editBlockCode)):null,
      state?.kind==='schema-ready'&&state.canEdit?h('p',{role:'status',className:'dsh-rp-mvu-notice'},
        '保存时会按角色卡规则校验数值。'):null,
      state?.kind==='schema-ready'&&state.commandDiagnostics?.length?h('details',{className:'dsh-rp-mvu-advanced'},
        h('summary',null,'变量更新未应用详情'),
        h('ul',null,state.commandDiagnostics.map((item,index)=>h('li',{key:`${item.nativeSeq}:${index}`},
          'kind' in item
            ?`${item.source==='opening'?'开场':'剧情'}变量更新整批未应用（${item.phase}，${item.code}`
              +`${'updateCode' in item?`，${item.updateCode}`:''}${'pointer' in item?`，${item.pointer}`:''}）。`
            :`${item.source==='opening'?'开场':'剧情'}第 ${item.commandIndex+1} 条更新：${item.code==='SCHEMA_VALIDATION_FAILED'
              ?'未通过角色卡规则':'无法执行此数值操作'}${item.pointer?`（${item.pointer}）`:''}。`)))):null,
      needsCompare&&draft?.dirty?h('p',{role:'status',className:'dsh-rp-mvu-notice'},
        '剧情或数值版本已变化。当前显示已读取的数值，旧草稿保留供比较，不能直接覆盖。'):null,
      ready?h('div',{className:'dsh-rp-mvu-toolbar'},
        h('span',{className:'dsh-rp-mvu-mode'},editing?'编辑模式':'阅读模式'),
        h('div',{className:'dsh-rp-mvu-toolbar-buttons'},h('button',{type:'button',disabled:!editing&&!editable,'aria-pressed':editing,
          onClick:()=>setEditSessions(current=>{
            const next=new Set(current)
            if(next.has(sessionId))next.delete(sessionId)
            else next.add(sessionId)
            return next
          })},editing?'返回阅读':'编辑数值'),
          h('button',{type:'button',onClick:refreshSafely},'刷新数值'))):
        h('div',{className:'dsh-rp-mvu-toolbar'},h('button',{type:'button',onClick:refreshSafely},'刷新数值')),
      table,
      shownValues&&!Object.keys(shownValues).length?h('p',{className:'dsh-rp-mvu-notice'},
        '当前数值为空。可在编辑模式的高级区添加字段。'):null,
      limited?h('p',{className:'dsh-rp-mvu-notice'},'字段较多，完整数值可在高级区查看。'):null,
      ready?h('details',{className:'dsh-rp-mvu-advanced'},h('summary',null,'高级：完整数值 JSON'),editing
        ?h('textarea',{'aria-label':'完整数值 JSON',className:'dsh-rp-mvu-input',disabled:!editable,rows:6,
          value:editable&&draft?.raw['']!==undefined?draft.raw['']:JSON.stringify(shownValues,null,2),
          onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>edit([],event.target.value,'json')})
        :h('pre',{className:'dsh-rp-mvu-json'},JSON.stringify(shownValues,null,2)),
        draft?.errors['']?h('p',{role:'alert',className:'dsh-rp-mvu-error'},draft.errors['']):null):null,
      draft?.comparison||needsCompare&&draft?.dirty?h('details',{className:'dsh-rp-mvu-advanced'},
        h('summary',null,'查看保留的旧草稿'),h('pre',{className:'dsh-rp-mvu-json'},
          draft?.comparison??JSON.stringify({数值:draft?.values,输入:draft?.raw},null,2))):null,
      draft?.message?h('p',{role:'status',className:'dsh-rp-mvu-notice'},draft.message):null,
      notice?.sessionId===sessionId&&ready&&!draft?.dirty?h('p',{role:'status',className:'dsh-rp-mvu-notice'},notice.text):null,
      editing||draft?.dirty?h('div',{className:'dsh-rp-mvu-actions'},
        h('button',{type:'button',className:'dsh-rp-mvu-primary',
          disabled:!editable||!draft?.dirty||!!Object.keys(draft?.errors??{}).length,
          onClick:()=>save()},pending?'保存中…':'保存数值'),
        uncertain?h('button',{type:'button',disabled:pending,onClick:()=>save(true)},'重试上次保存'):null,
        h('button',{type:'button',disabled:pending||uncertain||!draft?.dirty,onClick:discard},'取消草稿'),
        stale&&draft?.dirty&&ready?h('button',{type:'button',disabled:pending||uncertain,onClick:compareLatest},
          '载入最新值并比较草稿'):null):null)
  }
  return {MvuStatePanel}
}
