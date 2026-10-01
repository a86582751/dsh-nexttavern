import type * as ReactAPI from 'react'
import type {MvuJsonObject,MvuJsonValue} from '../core/tavern-mvu-initvar.js'
import type {MvuPlayerEditExpected,MvuPlayerEditRequest,MvuPlayerEditResponse,MvuStateObservation}
  from '../core/roleplay-mvu-player-types.js'

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
  observation?:MvuStateObservation
  refresh():Promise<unknown>
}
interface Dependencies {
  React:typeof ReactAPI
  invalidateState(sessionId:string):void
  fetch?:typeof globalThis.fetch
}
const copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value))
const expected=(state:Ready):MvuPlayerEditExpected=>({
  sourceSha256:state.snapshot.sourceSha256,root:copy(state.snapshot.root),revision:state.snapshot.revision,
  headSha256:state.snapshot.headSha256,valuesSha256:state.snapshot.valuesSha256,
  stateSnapshotSha256:state.snapshot.stateSnapshotSha256,observedNativeSeq:state.observedNativeSeq,
})
const baseKey=(state:Ready)=>JSON.stringify(expected(state))
const observationKey=(state:MvuStateObservation|undefined)=>isReady(state)
  ? JSON.stringify([state.sessionId,baseKey(state),state.canEdit,state.editBlockCode])
  : JSON.stringify(state??null)
const pointer=(parts:readonly string[])=>'/'+parts.map(part=>part.replace(/~/g,'~0').replace(/\//g,'~1')).join('/')
const typeName=(value:MvuJsonValue)=>value===null?'空值':Array.isArray(value)?'列表':
  typeof value==='object'?'对象':typeof value==='number'?'数字':typeof value==='boolean'?'开关':'文本'

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
  function MvuStatePanel({sessionId,observation,refresh}:PanelProps) {
    const [,setVersion]=React.useState(0)
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
        const shown=editable&&draft?.raw[address]!==undefined?draft.raw[address]:
          typeof value==='string'?value:JSON.stringify(value,null,2)
        const common={'aria-label':`${address}（${label}）`,'data-mvu-path':address,disabled:!editable,
          style:{width:'100%',boxSizing:'border-box' as const}}
        const error=draft?.errors[address]
        const control=typeof value==='string'?h('input',{...common,type:'text',value:shown,
          onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>edit(pathParts,event.target.value,'text')}):
          typeof value==='number'?h('input',{...common,type:'text',inputMode:'decimal',value:shown,
            onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>edit(pathParts,event.target.value,'number')}):
          typeof value==='boolean'?h('select',{...common,value:String(value),
            onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>edit(pathParts,event.target.value,'boolean')},
            h('option',{value:'true'},'开启'),h('option',{value:'false'},'关闭')):
          value===null?h(React.Fragment,null,h('span',{'data-mvu-null':address},'空值（null）'),
            h('input',{...common,type:'text',value:shown,
              onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>edit(pathParts,event.target.value,'json')})):null
        const structured=value!==null&&typeof value==='object'
        return h('div',{key:address,className:'dsh-rp-mvu-field'},
          h('label',null,h('span',null,`${address} · ${label}`),control),
          error?h('p',{role:'alert'},error):null,
          structured?h('details',null,h('summary',null,`${address}：展开${label}`),
            rows(value,pathParts),h('label',null,`${address}：编辑${label} JSON`,h('textarea',{...common,
              rows:4,value:shown,onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>edit(pathParts,event.target.value,'json')}))):null)
      })
    const shownValues=ready?(needsCompare?ready.snapshot.values:draft?.values??ready.snapshot.values):undefined
    const table=shownValues?rows(shownValues):null
    return h('section',{className:'dsh-rp-mvu-state','aria-label':'游戏数值','data-session-id':sessionId,
      style:{padding:'8px'}},
      h('h3',null,'游戏数值'),
      ready?h('p',null,`当前数值 · 第 ${ready.snapshot.revision} 版`):null,
      draft?.dirty&&!needsCompare?h('p',{role:'status'},'下方修改是尚未保存的草稿。'):null,
      !state?h('p',{role:'status'},'尚未读取到当前世界线的数值，请刷新检查。'):
        !isReady(state)?h('p',{role:'status'},reason(state.code)):
        !state.canEdit?h('p',{role:'status'},reason(state.editBlockCode)):null,
      state?.kind==='schema-ready'&&state.canEdit?h('p',{role:'status'},'保存时会按角色卡规则校验数值。'):null,
      needsCompare&&draft?.dirty?h('p',{role:'status'},'剧情或数值版本已变化。当前显示已读取的数值，旧草稿保留供比较，不能直接覆盖。'):null,
      table,
      limited?h('p',null,'字段较多，部分内容请在对象或列表的 JSON 编辑区查看；完整数值在高级区。'):null,
      ready?h('details',null,h('summary',null,'高级：完整数值 JSON'),
        h('textarea',{'aria-label':'完整数值 JSON',disabled:!editable,rows:6,
          style:{width:'100%',boxSizing:'border-box'},
          value:editable&&draft?.raw['']!==undefined?draft.raw['']:JSON.stringify(shownValues,null,2),
          onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>edit([],event.target.value,'json')}),
        draft?.errors['']?h('p',{role:'alert'},draft.errors['']):null):null,
      draft?.comparison||needsCompare&&draft?.dirty?h('details',null,h('summary',null,'查看保留的旧草稿'),
        h('pre',{style:{overflow:'auto',maxHeight:'180px'}},
          draft?.comparison??JSON.stringify({数值:draft?.values,输入:draft?.raw},null,2))):null,
      draft?.message?h('p',{role:'status'},draft.message):null,
      notice?.sessionId===sessionId&&ready&&!draft?.dirty?h('p',{role:'status'},notice.text):null,
      h('div',{className:'dsh-rp-row'},
        h('button',{type:'button',disabled:!editable||!draft?.dirty||!!Object.keys(draft?.errors??{}).length,
          onClick:()=>save()},pending?'保存中…':'保存数值'),
        uncertain?h('button',{type:'button',disabled:pending,onClick:()=>save(true)},'重试上次保存'):null,
        h('button',{type:'button',disabled:pending||uncertain||!draft?.dirty,onClick:discard},'取消草稿'),
        h('button',{type:'button',onClick:refreshSafely},'刷新数值'),
        stale&&draft?.dirty&&ready?h('button',{type:'button',disabled:pending||uncertain,onClick:compareLatest},
          '载入最新值并比较草稿'):null))
  }
  return {MvuStatePanel}
}
