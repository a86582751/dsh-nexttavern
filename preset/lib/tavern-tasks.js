import { createHash, randomUUID } from 'node:crypto'

export const PURPOSES = Object.freeze([
  {id:'memory',label:'记忆与场景整理'}, {id:'card-import',label:'读卡'},
  {id:'card-export',label:'角色卡导出'}, {id:'status',label:'状态栏'},
  {id:'decision',label:'决策建议'}, {id:'novel-export',label:'小说整理'},
])
const copy = value => value == null ? value : structuredClone(value)
export class TaskValidationError extends Error {
  constructor(message, issues = [], code = 'TASK_RESULT_INVALID') {
    super(message)
    this.code = code
    this.failure = {schemaVersion:1,category:'validation',label:'任务结果校验失败',stage:'validate',code,status:null,issues:copy(issues)}
  }
}
export function taskValidationFailure(job) {
  if (job.failure?.schemaVersion===1 && job.failure.category==='validation') return copy(job.failure)
  // Legacy jobs retained this local message but had no structured failure.
  if (job.error==='状态结果没有保留作者模板') return new TaskValidationError(job.error,
    [{path:'html',rule:'author-template',expected:'author-template',actual:'mismatch'}],'STATUS_TEMPLATE_MISMATCH').failure
  return null
}
export const FAILURE_LABELS=Object.freeze({timeout:'任务超时',truncated:'输出达到上限，结果被截断','empty-response':'模型返回空结果',authentication:'认证失败',permission:'访问被拒绝',balance:'余额不足',quota:'配额不足','rate-limit':'请求限流','request-header':'请求头错误','invalid-request':'请求参数错误',overloaded:'模型服务繁忙',upstream:'服务端错误',cancelled:'请求已取消',unknown:'原因未提供'})
// Classify locally; never persist provider response bodies or request headers.
export function taskFailureDetails(raw) {
  if (raw instanceof TaskValidationError) return copy(raw.failure)
  let f=raw??{}
  const seen=new Set()
  for(let depth=0;depth<8&&f&&typeof f==='object'&&!seen.has(f);depth++) {
    seen.add(f)
    const nested=f.failure??f.error??f.cause
    if(!nested)break
    f=typeof nested==='string'?{...f,message:nested}:nested
  }
  if(typeof f==='string')f={message:f}
  const candidate=String(f?.code??'')
  const code=/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(candidate)?candidate:null
  const status=Number.isInteger(f.status??f.statusCode)?(f.status??f.statusCode):null
  const hint=`${code??''} ${f.kind??''} ${typeof f.message==='string'?f.message:''}`.toLowerCase()
  const category=/timeout|timed.out|超时/.test(hint)?'timeout':/insufficient.*(?:balance|fund)|余额不足/.test(hint)||status===402?'balance'
    :/max[-_ ]?tokens|truncat/.test(hint)?'truncated'
    :/^EMPTY_(?:TASK_RESULT|RESPONSE)$/.test(code??'')?'empty-response'
    :/insufficient.quota|quota.exceeded|配额/.test(hint)?'quota'
    :/invalid.*header|header.*invalid|请求头/.test(hint)?'request-header'
    :status===401||/auth|invalid.api.key/.test(hint)?'authentication':status===403?'permission':status===429?'rate-limit'
    :/overloaded|over.capacity|server.{0,40}busy|服务.{0,8}繁忙/.test(hint)?'overloaded'
    :status===400||status===422?'invalid-request':status>=500?'upstream':f.kind==='aborted'?'cancelled':'unknown'
  return {category,label:FAILURE_LABELS[category],code,status}
}
const tableLocks=new WeakMap()
function taskResultText(result,format) {
  const text=(result.output??[]).filter(block=>block.type==='text').map(block=>block.text??'').join('\n')
  if(format!=='workflow'&&result.structured==null&&!text.trim())throw Object.assign(new Error('模型返回空结果'),{code:'EMPTY_TASK_RESULT'})
  return text
}
export async function withTavernLock(table,key,work) {
  let locks=tableLocks.get(table)
  if(!locks){locks=new Map();tableLocks.set(table,locks)}
  const previous=locks.get(key)??Promise.resolve(), next=previous.catch(()=>{}).then(work)
  locks.set(key,next)
  try{return await next}finally{if(locks.get(key)===next)locks.delete(key)}
}
const stable = v => v && typeof v === 'object'
  ? Array.isArray(v) ? v.map(stable) : Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])) : v
export const taskHash = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const settingKey = id => `tavern_policy__${id}`
const validPurpose = id => PURPOSES.some(p=>p.id===id)
function route(value) {
  if (!value || typeof value !== 'object') throw new Error('模型路由无效')
  for (const field of ['provider','model']) {
    if (typeof value[field] !== 'string' || !value[field].trim() || value[field].length>300 || /[\x00-\x1f]/.test(value[field])) throw new Error('模型路由无效')
  }
  if(value.reasoningEffort!=null && (typeof value.reasoningEffort!=='string'||value.reasoningEffort.length>64||/[^a-zA-Z0-9_-]/.test(value.reasoningEffort)))throw new Error('推理参数无效')
  return {provider:value.provider.trim(),model:value.model.trim(),
    ...(typeof value.reasoningEffort==='string' ? {reasoningEffort:value.reasoningEffort} : {})}
}
function settings(value) {
  if (!value || typeof value.allMain !== 'boolean') throw new Error('必须指定全部使用主模型开关')
  const routes={}
  for (const [kind,raw] of Object.entries(value.routes??{})) {
    if (!validPurpose(kind)) throw new Error('未知模型用途')
    routes[kind]=raw==null ? null : route(raw)
  }
  return {allMain:value.allMain,routes}
}
export function selectedMainRoute(session,agent,fallback) {
  let pending=null,used=null
  for(const event of session?.events??session?.log??[]) {
    if(event?.type==='model/selection')pending=event.data
    if(event?.type==='request/header') {
      used=event.data?.header?.config??used
      if(pending&&used&&pending.provider===used.provider&&pending.model===used.model&&pending.reasoningEffort===used.reasoningEffort)pending=null
    }
  }
  const configured=pending??used??session?.requestHeader?.()?.config
  return configured?.provider&&configured?.model?route(configured):agent?.options?.provider&&agent?.options?.model?route(agent.options):route(fallback)
}

/** Models come from the host; no provider credentials are copied into records. */
export function createModelPolicy({table,main,session,canonicalize=value=>value,legacy}) {
  async function globalRecord() {
    return withTavernLock(table,settingKey('global'),async()=>{
    let value=table.get(settingKey('global'))
    if (!value) {
      const worker=legacy?.provider && legacy?.model ? route(legacy) : null
      value={schemaVersion:1,revision:1,allMain:!worker,routes:worker ? Object.fromEntries(['memory','status','decision'].map(id=>[id,worker])) : {},
        source:{kind:worker?'legacy-explicit-worker':'default'},updatedAt:Date.now()}
      await table.put(settingKey('global'),value)
    }
    return copy(value)
    })
  }
  async function read(target,agent) {
    const global=await globalRecord()
    let override=null, owner=target, seen=new Set()
    while (owner && !seen.has(owner.id)) {
      seen.add(owner.id)
      const stored=table.get(settingKey(owner.id))
      if (stored) { if (stored.inherit===true) break; override=copy(stored);break }
      owner=owner.header?.parentSession ? await session(owner.header.parentSession) : null
    }
    const effective=override ? {...global,...override,routes:{...global.routes,...override.routes}} : global
    return {global,session:copy(table.get(settingKey(target.id))??null),effective,main:route(await main(target,agent)),inheritedFrom:override&&owner?.id!==target.id?owner.id:null,purposes:PURPOSES}
  }
  return {
    read,
    async save(target,scope,value,expectedRevision) {
      if (!['global','session'].includes(scope)) throw new Error('配置范围无效')
      if (scope==='global' && value===null) throw new Error('全局配置不能清除')
      const key=settingKey(scope==='global'?'global':target.id)
      return withTavernLock(table,key,async()=>{
      const prior=table.get(key)
      if (expectedRevision!=null && expectedRevision!==(prior?.revision??0)) throw new Error('配置已更新，请重新载入后保存')
      const next={schemaVersion:1,revision:(prior?.revision??0)+1,
        ...(value===null ? {inherit:true} : settings(value)),source:{kind:'player-settings',sessionId:target.id},updatedAt:Date.now()}
      await table.put(key,next)
      return copy(next)
      })
    },
    async resolve(target,kind,agent) {
      if (!validPurpose(kind)) throw new Error('未知任务用途')
      const data=await read(target,agent), selected=data.effective.allMain?data.main:data.effective.routes[kind]??data.main
      const actual=route(await canonicalize(selected)), primary=route(await canonicalize(data.main))
      const inline=actual.provider===primary.provider && actual.model===primary.model
      return {execution:inline?'inline':'spawn',actualRoute:inline?primary:actual,main:primary,policyRevision:{global:data.global.revision,session:data.session?.revision??0}}
    },
  }
}

export class InlinePending extends Error {
  constructor(id) { super('当前循环有待完成的酒馆维护任务');this.code='TAVERN_INLINE_PENDING';this.jobId=id }
}
export const isInlinePending = error => error?.code==='TAVERN_INLINE_PENDING'
// InlinePending is an admission signal, not failure of the whole batch. Let
// every sibling persist its task before the pre-step snapshots the pending
// queue, so the main loop receives all compatible obligations together.
export async function awaitTaskAdmissions(jobs) {
  const results=await Promise.allSettled(jobs)
  const failure=results.find(r=>r.status==='rejected'&&!isInlinePending(r.reason))??results.find(r=>r.status==='rejected')
  if(failure)throw failure.reason
  return results.map(r=>r.value)
}
export function taskPhaseMessage(stage, content, extra={}) {
  return {id:randomUUID(),role:'user',content:[{type:'text',text:content}],
    source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',schemaVersion:1,stage,...extra}}
}
// Small maintenance inputs are already frozen and validated by the task
// service. Deliver them whole in the existing loop instead of making the model
// spend a round trip discovering every source. Large/card/novel workflows keep
// their explicit paginated read tools; no source is shortened to fit a budget.
export function inlineTaskInstruction(jobs,{sessionId,maxChars=128000}={}) {
  let remaining=Math.max(0,Math.min(128000,Number(maxChars)||0))
  const tasks=[]
  for(const job of jobs) {
    if(job.execution!=='inline'||!['queued','running'].includes(job.status)||sessionId&&job.sessionId!==sessionId)continue
    const task={id:job.id,kind:job.kind,generation:job.generation,branchId:job.branchId,sourceHash:job.sourceHash,
      ...(taskValidationFailure(job)?{failure:taskValidationFailure(job),remainingValidationAttempts:Math.max(0,3-(job.validationFailures??0))}:{})}
    const text=JSON.stringify(job.input)
    if(['memory','status','decision'].includes(job.kind)&&typeof text==='string'&&text.length<=remaining) {
      task.input=job.input;task.completeSource=true;remaining-=text.length
    } else {task.readWith='rp_task_read';task.totalChars=text?.length??0}
    tasks.push(task)
  }
  return '当前是系统维护阶段，尚不能生成或续写剧情。下面 completeSource=true 的任务已经附带完整冻结来源与结果契约，不需要再次调用 rp_task_read，直接完成并用 rp_task_submit 分别提交结果。仅未附带 input 的任务需要 rp_task_read 分页完整读取。同一步可调用多个 rp_task_submit；每项按自己的 id、generation、system 与 format 校验。不要输出维护报告或复述任务资料，不改变模型、调用 spawn 或检查实现代码。\n待办：\n'+JSON.stringify(tasks)
}
export function inlineTaskMessages(session,stage,jobs,{force=false,maxChars}={}) {
  const content=inlineTaskInstruction(jobs,{sessionId:session.id,maxChars}),instructionHash=taskHash({stage,content})
  if(!force)for(const event of [...(session.events??session.log??[])].reverse()) {
    if(event.type==='turn/start'||event.type==='turn/end')break
    const source=event.type==='user/message'?event.data?.source:null
    if(source?.plugin==='roleplay-tasks'&&source.form==='phase') {
      if(source.stage===stage&&source.instructionHash===instructionHash)return []
      break
    }
  }
  return [taskPhaseMessage(stage,content,{instructionHash})]
}
export function taskStorySeqs(session) {
  return new Set((session.events??session.log??[]).filter(e=>e?.type==='user/message' && e.data?.source?.kind==='plugin' && e.data?.source?.plugin==='roleplay-tasks' && e.data?.source?.stage==='after-story')
    .map(e=>e.data.source.storySeq).filter(Number.isSafeInteger))
}
function completedImportSpan(nodes,lookup) {
  const callsOf=e=>e?.type==='assistant/message'?(e.data?.message?.content??[]).filter(b=>b.type==='tool-call'):[]
  const begin=nodes.findIndex(seq=>callsOf(lookup.get(seq)).some(b=>b.name==='rp_card_import_begin'))
  if(begin<0)return null
  const calls=new Map(),results=new Set(),allowed=/^(?:skill|rp_card_import_(?:begin|chunk|stage|finalize)|rp_task_(?:read|submit))$/
  for(let i=begin;i<nodes.length;i++){
    const e=lookup.get(nodes[i])
    if(e?.type==='assistant/message'){
      const blocks=callsOf(e)
      if(!blocks.length)return null
      for(const b of blocks){if(!allowed.test(b.name)||!b.id||calls.has(b.id))return null;calls.set(b.id,b.name)}
    }else if(e?.type==='tool/result'){
      const m=e.data?.message,id=m?.source?.callId
      if(!calls.has(id)||results.has(id))return null
      results.add(id)
      if(calls.get(id)==='rp_card_import_finalize'){
        const wrapped=(m.content??[]).filter(b=>b.type==='tool-result')
        if(wrapped.length&&(wrapped.length!==1||wrapped[0].toolCallId!==id))return null
        const result=wrapped[0]??m
        let proof
        try{proof=JSON.parse((result.content??[]).filter(b=>b.type==='text').map(b=>b.text).join('\n'))}catch{return null}
        // Native finalize's `status` is the presence of a status template,
        // not the import lifecycle. Activation time/hash prove the commit.
        if(m.isError||result.isError||proof?.ok!==true||!(proof.activatedAt>0)||!Number.isFinite(proof.activatedAt)
          ||!/^[a-f0-9]{64}$/.test(proof.normalizedSha256??'')||proof.coverage!==1||!proof.importId||calls.size!==results.size)return null
        return {nodes:nodes.slice(begin,i+1),importId:proof.importId}
      }
    }else if(e?.type!=='user/message'||e.data?.source?.kind!=='plugin'||e.data.source.plugin!=='roleplay-tasks'
      ||e.data.source.form!=='phase'||['story','after-story'].includes(e.data.source.stage))return null
  }
  return null
}
/** Retire completed export-only turns and proven import tool preludes once. Ordinary story/maintenance prefixes
 * stay byte-identical until hard-window eviction. The audit log is never edited. */
export function retireCompletedTaskContexts(session,currentTurn) {
  if(typeof session?.append!=='function')return 0
  const events=session.events??session.log??[],groups=[],bySeq=new Map();let group=null
  for(const e of events) {
    if(!e)continue
    if(e.type==='turn/start'){group={turn:e.data?.turn,export:false,story:false,completed:false};groups.push(group)}
    if(group)bySeq.set(e.seq,group)
    const source=e.type==='user/message'?e.data?.source:null
    if(group&&source?.kind==='plugin'&&source.plugin==='roleplay-tasks') {
      if(['card-export','novel-export'].includes(source.jobKind))group.export=true
      if(source.form==='phase'&&['story','after-story'].includes(source.stage))group.story=true
    }
    if(group&&e.type==='tool/call'&&/^(?:rp_card_export_(?:begin|chunk|finalize)|rp_novel_export)$/.test(e.data?.name??''))group.export=true
    if(group&&e.type==='turn/end'){group.completed=e.data?.reason?.kind==='completed';group=null}
  }
  const visible=[...(session.surface?.nodes??[])],lookup=new Map(events.filter(Boolean).map(e=>[e.seq,e])),nodesByGroup=new Map()
  for(const seq of visible){const owner=bySeq.get(seq);if(owner){if(!nodesByGroup.has(owner))nodesByGroup.set(owner,[]);nodesByGroup.get(owner).push(seq)}}
  let retired=0
  for(const candidate of groups) {
    if(!candidate.completed||candidate.turn===currentTurn)continue
    const groupNodes=nodesByGroup.get(candidate)??[]
    const imported=completedImportSpan(groupNodes,lookup)
    if(!imported&&(!candidate.export||candidate.story))continue
    const selected=imported?.nodes??groupNodes
    if(!selected.length)continue
    const start=selected[0],end=selected.at(-1),span=visible.slice(visible.indexOf(start),visible.indexOf(end)+1)
    // A branch-local replacement/checkpoint can interleave nodes from another
    // turn. Never consume a foreign story to retire management material.
    if(span.length!==selected.length||span.some(seq=>!lookup.has(seq)||bySeq.get(seq)!==candidate))continue
    const receipt={schemaVersion:1,kind:'plugin',plugin:'roleplay-tasks',form:'management-receipt',
      sessionId:session.id,sourceTurn:candidate.turn,sourceSha256:taskHash(selected.map(seq=>lookup.get(seq))),start,end,
      ...(imported?{jobKind:'card-import',importId:imported.importId}:{})}
    session.append('user/message',{id:randomUUID(),role:'user',source:receipt,
      content:[{type:'text',text:imported?`读卡已完整激活。设定由当前角色扮演栏目提供，原始读卡消息与工具结果保存在历史 seq ${start}–${end}。以下继续剧情。`:`导出操作已结束。原始消息与工具结果保存在历史 seq ${start}–${end}，导出文件可在资源库查看。以下继续剧情。`}]},
      {surfaceOp:{op:'replace',start,end},sourceEventSeqs:selected})
    retired+=selected.length
  }
  return retired
}
/** Durable step provenance, never keyword heuristics or a whole-turn ban. */
export function internalTaskSeqs(session) {
  const hidden=new Set(),managementTurns=new Set(),turns=new Map(); let internal=false,turn=null,authoring=false
  for(const e of session.events??session.log??[]) {
    if(e?.type==='turn/start')turn=e.data?.turn
    if(e)turns.set(e.seq,turn)
    if(e?.type==='tool/call'&&e.data?.name==='rp_card_draft_check')authoring=true
    if(e?.type==='tool/call'&&['rp_card_import_begin','rp_commit_card'].includes(e.data?.name))authoring=false
    if(e?.type==='user/message'&&e.data?.source?.plugin==='roleplay-tasks'&&e.data.source.stage==='after-story')authoring=false
    if(authoring&&e?.type==='tool/call'&&e.data?.name==='ask_user_question')managementTurns.add(e.data?.turn??turn)
    if(e?.type==='tool/call'&&(/^(?:rp_card_export_(?:begin|chunk|finalize)|rp_novel_export|rp_diagnose|rp_card_draft_check)$/.test(e.data?.name??'')))managementTurns.add(e.data?.turn??turn)
    if(e?.type==='user/message'&&e.data?.source?.plugin==='roleplay-tasks'&&['card-export','novel-export'].includes(e.data?.source?.jobKind))managementTurns.add(turn)
    if(e?.type==='turn/start'||e?.type==='turn/end')internal=false
    if(e?.type==='user/message' && e.data?.source?.kind==='plugin' && e.data?.source?.plugin==='roleplay-tasks' && e.data?.source?.form==='phase')internal=e.data.source.stage!=='story'
    if(internal&&e?.type==='assistant/message')hidden.add(e.seq)
    if(e?.type==='turn/end')turn=null
  }
  for(const e of session.events??session.log??[])if(managementTurns.has(e.data?.turn??turns.get(e.seq))&&(e.type==='assistant/message'||(e.type==='user/message'&&e.data?.source?.kind==='user')))hidden.add(e.seq)
  return hidden
}
const keyOf = id => `tavern_job__${id}`
export function tavernTaskToolBoundary(table,agent) {
  const session=agent?.session
  if(!session)return null
  if(!(Number(agent.options?.subagentDepth)>0)&&session.header?.origin!=='subagent')return null
  const descriptor=(session.events??session.log??[]).findLast(event=>event.type==='subagent/descriptor'&&Number(event.seq)>=Number(session.header?.seedLength??0))
  const match=/^Tavern:([a-f0-9]{64}):/.exec(descriptor?.data?.label??'')
  const earlyId=Number(agent.options?.subagentDepth)>0&&/^[a-f0-9]{64}$/.test(agent.options?.tavernTaskId??'')?agent.options.tavernTaskId:null
  const id=earlyId??match?.[1],job=id?table.get(keyOf(id)):null
  return job?new Set((job.allowedTools??[]).filter(name=>!['subagent','spawn','fork','send_message','list_agents','interrupt_agent'].includes(name))):null
}
const terminal = new Set(['completed','cancelled','stale','failed'])
export function nativeTaskOutputBudget(route,budget) {
  // Gemini's observed reasoning output can exhaust the small result-oriented
  // task cap before producing JSON. Preserve the selected effort and reserve
  // total output headroom; this is a ceiling, not a requested output length.
  return budget&&route?.provider==='google'&&/^gemini-/.test(route.model??'')&&!['off','minimal'].includes(route.reasoningEffort)
    ?Math.max(budget,16384):budget
}
function untilAborted(promise,signal) {
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason??new Error('任务已取消'))
    signal.addEventListener('abort',abort,{once:true})
    Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort))
    if(signal.aborted)abort()
  })
}

/**
 * Both execution paths use these exact records. Inline request NEVER waits for
 * a future main-loop step: it persists and yields InlinePending to the stage
 * controller. Only native, independently executing children may be awaited.
 */
export function createTavernTasks({table,policy,subagents,isCurrent=()=>true}) {
  const validators=new Map(), running=new Map(), controllers=new Map(), locks=new Map(), batches=new Map(), admissions=new Map(), holds=new Map()
  const list = session => [...table.entries()].filter(([k,j])=>k.startsWith('tavern_job__') && j.sessionId===session.id).map(([,j])=>copy(j))
  async function lock(id,fn) {
    const previous=locks.get(id)??Promise.resolve()
    const next=previous.catch(()=>{}).then(fn);locks.set(id,next)
    try{return await next}finally{if(locks.get(id)===next)locks.delete(id)}
  }
  function owned(session,id) {
    const job=copy(table.get(keyOf(id)))
    if (!job || job.sessionId!==session.id) throw new Error('任务不属于当前所属会话')
    return job
  }
  const priority=kind=>kind==='status'?0:kind==='decision'?1:2
  const groupKey=(session,job,spec)=>taskHash({sessionId:session.id,branchId:job.branchId,route:job.actualRoute,
    lane:['status','decision'].includes(job.kind)?'story-ui':job.kind,
    tools:[...(spec.tools??[])].sort(),background:false})
  const holdKey=session=>session.id
  function schedule(batch) {
    if(!batch.running&&!batch.items.size) {
      if(batches.get(batch.key)===batch)batches.delete(batch.key)
      return
    }
    if(batch.scheduled||batch.running||holds.get(holdKey(batch.session))>0)return
    batch.scheduled=true
    queueMicrotask(()=>{batch.scheduled=false;if(holds.get(holdKey(batch.session))>0||batch.running)return
      const ready=[...batch.items.values()].filter(item=>item.ready)
      if(ready.length)void runBatch(batch,ready)
    })
  }
  async function inlineFallback(session,item,raw) {
    return lock(item.job.id,async()=>{
      const live=owned(session,item.job.id)
      if(live.generation!==item.job.generation||terminal.has(live.status))throw new Error('任务已取消或失效')
      const failure=taskFailureDetails(raw)
      await table.put(keyOf(live.id),{...live,generation:randomUUID(),execution:'inline',actualRoute:copy(live.main),status:'queued',
        fallback:{from:item.job.actualRoute,to:copy(live.main),at:Date.now(),reason:failure.category==='timeout'?'timeout':'failed',failure},error:`${failure.label}，已交回主循环`,updatedAt:Date.now()})
      return failure
    })
  }
  function resultValue(item,result) {
    const text=taskResultText(result,item.spec.format)
    return item.spec.format==='workflow'?{finished:true}:item.spec.format==='text'?text:result.structured??JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,''))
  }
  function batchPrompt(active) {
    if(active.length===1) {
      const {job}=active[0]
      return {taskId:job.id,generation:job.generation,branchId:job.branchId,sourceHash:job.sourceHash,...job.input}
    }
    const counts=new Map()
    for(const item of active)for(const value of Object.values(item.job.input??{}))if(typeof value==='string'&&value.length>=1024)counts.set(value,(counts.get(value)??0)+1)
    const shared=[...counts].filter(([,count])=>count>1).map(([text],index)=>({id:`shared-${index+1}`,text}))
    const refs=new Map(shared.map(value=>[value.text,value.id]))
    const tasks=active.sort((a,b)=>priority(a.job.kind)-priority(b.job.kind)||a.job.createdAt-b.job.createdAt).map(item=>{
      const input=Object.fromEntries(Object.entries(item.job.input??{}).map(([key,value])=>[key,refs.has(value)?{sharedContextRef:refs.get(value)}:value]))
      return {...input,taskId:item.job.id,generation:item.job.generation,kind:item.job.kind,branchId:item.job.branchId,sourceHash:item.job.sourceHash}
    })
    return {tasks,sharedContext:shared,outputContract:{results:[{taskId:'任务ID',generation:'任务generation',value:'该任务结果'}],failures:[{taskId:'任务ID',generation:'任务generation',failure:{code:'失败代码',message:'简短原因'}}]}}
  }
  async function runBatch(batch,items) {
    batch.running=true
    for(const item of items)batch.items.delete(item.job.id)
    const active=items.filter(item=>!terminal.has(owned(batch.session,item.job.id).status))
    if(!active.length){batch.running=false;schedule(batch);return}
    const totalTokens=nativeTaskOutputBudget(active[0].job.actualRoute,active.reduce((total,item)=>total+(item.job.generationOptions.maxTokens??0),0))
    const ac=new AbortController(), generation=taskHash(active.map(item=>[item.job.id,item.job.generation]))
    const shared={session:batch.session,items:active,expiry:null}
    for(const item of active)controllers.set(item.job.id,{generation:item.job.generation,controller:ac,batch:shared})
    const timers=active.map(item=>setTimeout(()=>void timeoutItem(batch.session,item).catch(()=>{}),Math.max(1000,item.spec.timeoutMs??120000)))
    let child
    try {
      const starting=Promise.resolve(subagents.start('spawn',{parent:active[0].spec.agent,signal:ac.signal,
        agentOptions:{...active[0].job.actualRoute,...(totalTokens?{maxTokens:totalTokens}:{}),tavernTaskId:active[0].job.id},maxDepth:1,
        toolFilter:{allow:active[0].spec.tools??[]},label:`Tavern:${active[0].job.id}:${active[0].job.generation}`,
        persona:'你是酒馆的专用维护助手。只处理收到的冻结来源和任务，不续写剧情，不创建子代理。'+(active.length>1?'必须按 outputContract 分别返回每项结果。':''),
        prompt:[{type:'text',text:JSON.stringify(batchPrompt(active))}]}))
      starting.then(late=>{if(ac.signal.aborted)Promise.resolve().then(()=>late.dispose()).catch(()=>{})},()=>{})
      child=await untilAborted(starting,ac.signal)
      await Promise.all(active.map(item=>lock(item.job.id,async()=>{const live=owned(batch.session,item.job.id);if(live.generation===item.job.generation&&!terminal.has(live.status))await table.put(keyOf(live.id),{...live,status:'running',childSessionId:child.id,childMaxTokens:totalTokens||null,startedAt:Date.now()})})))
      const result=await untilAborted(child.result,ac.signal)
      if(result.stopReason!=='completed') {
        const end=child.localAgent?.session?.events?.findLast(event=>event.type==='turn/end')
        throw Object.assign(new Error('辅助模型未完成'),{failure:end?.data?.reason?.failure??end?.data?.reason??{code:result.stopReason}})
      }
      let payload=result.structured
      if(payload==null) {
        const text=taskResultText(result).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,'')
        try {payload=JSON.parse(text)}catch(error){if(active.length>1||active[0].spec.format!=='text')throw error}
      }
      if(active.length===1&&(!payload||(!Array.isArray(payload.results)&&!Array.isArray(payload.failures)))) {
        const value=resultValue(active[0],result);active[0].resolve(await submit({session:batch.session,id:active[0].job.id,generation:active[0].job.generation,value}));return
      }
      const results=new Map((payload?.results??[]).map(value=>[`${value.taskId}:${value.generation}`,value.value]))
      const failures=new Map((payload?.failures??[]).map(value=>[`${value.taskId}:${value.generation}`,value.failure]))
      await Promise.all(active.map(async item=>{
        const key=`${item.job.id}:${item.job.generation}`
        try {
          const live=owned(batch.session,item.job.id)
          if(live.generation!==item.job.generation||live.execution!=='spawn'||terminal.has(live.status))throw new Error('任务已取消或结果已失效')
          if(results.has(key))item.resolve(await submit({session:batch.session,id:item.job.id,generation:item.job.generation,value:results.get(key)}))
          else {
            const missing=failures.get(key)??{code:'missing-result',message:'批量结果缺少该任务'}
            await inlineFallback(batch.session,item,missing)
            item.reject(new InlinePending(item.job.id))
          }
        }catch(error){
          if(!terminal.has(owned(batch.session,item.job.id).status)) {
            await inlineFallback(batch.session,item,error).catch(()=>{})
            item.reject(new InlinePending(item.job.id))
          } else item.reject(error)
        }
      }))
    }catch(error) {
      await Promise.all(active.map(async item=>{
        try {
          const live=owned(batch.session,item.job.id)
          if(terminal.has(live.status)){item.reject(error);return}
          if(live.generation!==item.job.generation||live.execution!=='spawn')return
          await inlineFallback(batch.session,item,error)
          item.reject(new InlinePending(item.job.id))
        }catch(inner){item.reject(inner)}
      }))
    }finally {
      for(const timer of timers)clearTimeout(timer)
      if(child)await untilAborted(Promise.resolve().then(()=>child.dispose()),AbortSignal.timeout(1000)).catch(()=>{})
      for(const item of active)if(controllers.get(item.job.id)?.generation===item.job.generation)controllers.delete(item.job.id)
      batch.running=false;schedule(batch)
    }
  }
  function enqueue(session,job,spec) {
    const key=groupKey(session,job,spec), existing=admissions.get(job.id)
    if(existing?.generation===job.generation)return existing
    let resolve,reject
    const entry={job,spec,generation:job.generation,ready:false,promise:new Promise((res,rej)=>{resolve=res;reject=rej}),resolve,reject}
    admissions.set(job.id,entry)
    let batch=batches.get(key)
    if(!batch||batch.running){batch={key,session,items:new Map(),scheduled:false,running:false};batches.set(key,batch)}
    batch.items.set(job.id,entry)
    entry.readyForDispatch=()=>{entry.ready=true;schedule(batch)}
    entry.promise.finally(()=>{if(admissions.get(job.id)===entry)admissions.delete(job.id)}).catch(()=>{})
    return entry
  }
  function holdBatch(session) {
    const key=holdKey(session);holds.set(key,(holds.get(key)??0)+1)
    let released=false
    return ()=>{if(released)return;released=true;const remaining=(holds.get(key)??1)-1;if(remaining>0)holds.set(key,remaining);else {holds.delete(key);for(const batch of batches.values())if(batch.session.id===session.id)schedule(batch)}}
  }
  function abortControl(session,id,control=controllers.get(id)) {
    const sibling=control?.batch?.items.some(item=>{
      if(item.job.id===id)return false
      const live=owned(session,item.job.id)
      return live.generation===item.job.generation&&live.execution==='spawn'&&!terminal.has(live.status)
    })
    if(!sibling)control?.controller.abort()
    return Boolean(sibling)
  }
  async function timeoutItem(session,item) {
    const live=owned(session,item.job.id)
    if(live.generation!==item.job.generation||terminal.has(live.status))return
    const control=controllers.get(item.job.id)
    if(control?.generation===item.job.generation&&control.batch?.items.length>1) {
      const shared=control.batch
      // The keyed result envelope is delivered at completion of one call.
      // Stop that call at its earliest member deadline and persist all still
      // missing results before waking the main loop. Cancellation stays local.
      shared.expiry??=(async()=>{
        const transferred=[]
        await Promise.all(shared.items.map(async member=>{
          const current=owned(session,member.job.id)
          if(current.generation!==member.job.generation||current.execution!=='spawn'||terminal.has(current.status))return
          try {await inlineFallback(session,member,{code:'SHARED_CALL_TIMEOUT'});transferred.push(member)}catch{}
        }))
        control.controller.abort(Object.assign(new Error('共享维护请求超时'),{code:'SHARED_CALL_TIMEOUT'}))
        for(const member of transferred)member.reject(new InlinePending(member.job.id))
      })()
      return shared.expiry
    }
    await inlineFallback(session,item,{code:'TASK_TIMEOUT',message:'任务超时'})
    if(control?.generation===item.job.generation)abortControl(session,item.job.id,control)
    item.reject(new InlinePending(item.job.id))
  }
  async function cancelJob(session,id) {
    const result=await lock(id,async()=>{const job=owned(session,id);if(job.status==='completed')return job
      const next={...job,status:'cancelled',generation:randomUUID(),updatedAt:Date.now()};await table.put(keyOf(id),next);return next})
    const control=controllers.get(id)
    const sibling=abortControl(session,id,control)
    if(!control||sibling)admissions.get(id)?.reject(Object.assign(new Error('任务已取消或结果已失效'),{code:'TASK_CANCELLED'}))
    return result
  }
  async function submit({session,id,generation,value}) {
    return lock(id,async()=>{
      const job=owned(session,id)
      if (job.generation!==generation || ['cancelled','stale'].includes(job.status)) throw new Error('任务已取消或结果已失效')
      if(job.status==='failed')throw new Error('该任务已失败，请在酒馆管理中重试')
      if (!await isCurrent(session,job)) {
        await table.put(keyOf(id),{...job,status:'stale',updatedAt:Date.now()})
        throw new Error('任务来源已变化，请按当前分支重建')
      }
      if (job.status==='completed') return copy(job.result)
      const validate=validators.get(id)
      if (!validate) throw new Error('任务尚未恢复来源校验，请先继续任务')
      let result
      try {
        result=await validate(copy(value))
        if (result===undefined || result===null) throw new Error('任务结果没有通过校验')
      }catch(error){
        const failures=(job.validationFailures??0)+1
        const rejected=error instanceof TaskValidationError?error:new TaskValidationError(String(error.message),
          [{path:'result',rule:'result-contract',expected:'valid-result',actual:'invalid-result'}])
        const now=Date.now()
        await table.put(keyOf(id),{...job,validationFailures:failures,failure:rejected.failure,status:failures>=3?'failed':job.status,
          error:rejected.message,...(failures>=3?{failedAt:now}:{}),updatedAt:now})
        throw new TaskValidationError(`${rejected.message}${failures>=3?'；已保留检查点，请在酒馆管理中重试':'；请按 rp_task_read 中的结果契约修正，不要检查实现代码'}`,
          rejected.failure.issues,rejected.code)
      }
      await table.put(keyOf(id),{...job,status:'completed',result:copy(result),resultHash:taskHash(result),progress:{done:1,total:1},completedAt:Date.now(),updatedAt:Date.now(),error:null,failure:null,failedAt:null})
      return copy(result)
    })
  }
  async function request(spec) {
    const {session,agent,kind,source,input,signal}=spec
    if(spec.background===true&&(kind!=='memory'||input?.taskStage!=='background-notes'))throw new Error('仅跨轮后台记忆允许独立同模型子代理')
    if (Number(agent?.options?.subagentDepth)>0) throw new Error('辅助子代理不能递归调度酒馆任务')
    if(spec.maxTokens!==undefined&&(!Number.isSafeInteger(spec.maxTokens)||spec.maxTokens<1))throw new Error('辅助任务输出上限必须是正整数')
    const id=taskHash({sessionId:session.id,kind,source,input:spec.requestKey??input}), key=keyOf(id)
    // A restart may be followed by newer canonical prose before idle recovery.
    // Rebuild that batch from the new snapshot instead of leaving an orphaned
    // old "running" row forever. Live in-process work is never superseded here.
    if(spec.background)for(const previous of list(session)) {
      if(previous.id===id||!previous.background||previous.status!=='running'||running.has(previous.id))continue
      await lock(previous.id,async()=>{
        const live=owned(session,previous.id)
        if(live.status==='running'&&!running.has(live.id))await table.put(keyOf(live.id),{
          ...live,status:'stale',generation:randomUUID(),supersededBy:id,
          recovery:'runtime-restart-new-snapshot',updatedAt:Date.now(),
        })
      })
    }
    const deliver=async result=>{await spec.onResult?.(copy(owned(session,id)));return result}
    validators.set(id,spec.validate??(value=>value))
    let job=await lock(id,async()=>{
      let found=copy(table.get(key))
      if(found?.background&&found.status==='failed'&&spec.retryBackground===true) {
        found={...found,generation:randomUUID(),status:'queued',validationFailures:0,error:null,failure:null,failedAt:null,updatedAt:Date.now()}
        await table.put(key,found)
      }
      if(found?.execution==='spawn'&&found.status==='running'&&!running.has(id)&&!admissions.has(id)) {
        found=found.background
          ? {...found,generation:randomUUID(),status:'queued',recoveredAt:Date.now(),updatedAt:Date.now()}
          : {...found,generation:randomUUID(),execution:'inline',actualRoute:copy(found.main),status:'queued',
            fallback:{from:found.actualRoute,reason:'runtime-restart',at:Date.now()},updatedAt:Date.now()}
        await table.put(key,found)
      }
      if (!found) {
        const selection=spec.selection??await policy.resolve(session,kind,agent)
        found={schemaVersion:1,id,sessionId:session.id,branchId:session.id,kind,source:copy(source),sourceHash:taskHash(source),input:copy(input),allowedTools:copy(spec.tools??[]),
          ...selection,...(spec.background===true?{background:true,execution:'spawn'}:{}),generationOptions:spec.maxTokens===undefined?{}:{maxTokens:spec.maxTokens},status:'queued',generation:randomUUID(),progress:{done:0,total:1},createdAt:Date.now(),updatedAt:Date.now()}
        await table.put(key,found)
      }
      if(found.allowedTools===undefined) {
        found={...found,allowedTools:copy(spec.tools??[])}
        await table.put(key,found)
      }
      return found
    })
    if (!await isCurrent(session,job)) {
      await lock(id,async()=>{await table.put(key,{...owned(session,id),status:'stale',updatedAt:Date.now()})})
      throw new Error('任务来源已变化')
    }
    if (job.status==='completed') {await spec.onAdmission?.(copy(job));return deliver(copy(job.result))}
    if (terminal.has(job.status)) throw new Error(job.status==='failed'&&job.error ? job.error : '任务已取消或失效，请重建或重试')
    if (job.execution==='inline') throw new InlinePending(id)
    // Normal non-main work is admitted for one event-loop turn.  A caller can
    // hold the session gate while it admits a dependent status/decision pair;
    // this never waits for a native result and background memory is excluded.
    if(!job.background&&spec.format!=='workflow') {
      const admission=enqueue(session,job,spec)
      await spec.onAdmission?.(copy(job))
      admission.readyForDispatch()
      const abort=()=>void cancelJob(session,id)
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
      try{return deliver(await admission.promise)}finally{signal?.removeEventListener('abort',abort)}
    }
    await spec.onAdmission?.(copy(job))
    if (running.get(id)?.generation===job.generation) return deliver(await running.get(id).promise)
    const run=(async()=>{
      const ac=new AbortController();controllers.set(id,{generation:job.generation,controller:ac})
      const abort=()=>ac.abort(signal?.reason)
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
      const timer=setTimeout(()=>ac.abort(Object.assign(new Error('任务超时'),{code:'TASK_TIMEOUT'})),Math.max(1000,spec.timeoutMs??120000))
      let child
      try {
        if (!agent) throw new Error('主代理尚未就绪')
        const live=owned(session,id)
        if(live.generation!==job.generation||terminal.has(live.status))throw new Error('任务已取消或失效')
        ac.signal.throwIfAborted()
        const starting=Promise.resolve(subagents.start('spawn',{parent:agent,signal:ac.signal,agentOptions:{...job.actualRoute,...job.generationOptions,tavernTaskId:id},maxDepth:1,toolFilter:{allow:spec.tools??[]},
          label:`Tavern:${id}:${job.generation}`,persona:'你是酒馆的专用维护助手。只处理收到的冻结来源和任务，不续写剧情，不创建子代理。',
          prompt:[{type:'text',text:JSON.stringify({taskId:id,generation:job.generation,branchId:session.id,sourceHash:job.sourceHash,...input})}]}))
        starting.then(late=>{if(ac.signal.aborted)Promise.resolve().then(()=>late.dispose()).catch(()=>{})},()=>{})
        child=await untilAborted(starting,ac.signal)
        await lock(id,async()=>{const live=owned(session,id);if(live.generation===job.generation&&!terminal.has(live.status))await table.put(key,{...live,status:'running',childSessionId:child.id,startedAt:Date.now()})})
        const result=await untilAborted(child.result,ac.signal)
        ac.signal.throwIfAborted()
        if (result.stopReason!=='completed') {
          const end=child.localAgent?.session?.events?.findLast(e=>e.type==='turn/end')
          throw Object.assign(new Error('辅助模型未完成'),{failure:end?.data?.reason?.failure??end?.data?.reason??{code:result.stopReason}})
        }
        const text=taskResultText(result,spec.format)
        const value=spec.format==='workflow'?{finished:true}:spec.format==='text'?text:result.structured??JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,''))
        return await submit({session,id,generation:job.generation,value})
      } catch(error) {
        let superseded=false
        await lock(id,async()=>{
          const live=owned(session,id)
          if (live.generation!==job.generation || terminal.has(live.status)) {superseded=true;return}
          const failure=taskFailureDetails(ac.signal.aborted?ac.signal.reason:error)
          if(live.background) {
            await table.put(key,{...live,status:'failed',failure,error:failure.label,failedAt:Date.now(),updatedAt:Date.now()})
            return
          }
          await table.put(key,{...live,execution:'inline',actualRoute:copy(live.main),status:'queued',fallback:{from:job.actualRoute,to:copy(live.main),at:Date.now(),reason:failure.category==='timeout'?'timeout':'failed',failure},error:`${failure.label}，已交回主循环`,updatedAt:Date.now()})
        })
        if (job.background || signal?.aborted || superseded) throw error
        throw new InlinePending(id)
      } finally {
        clearTimeout(timer);signal?.removeEventListener('abort',abort)
        if(controllers.get(id)?.generation===job.generation)controllers.delete(id)
        if(child) {
          const disposing=Promise.resolve().then(()=>child.dispose())
          await untilAborted(disposing,AbortSignal.any([ac.signal,AbortSignal.timeout(1000)])).catch(()=>{})
        }
      }
    })()
    running.set(id,{generation:job.generation,promise:run})
    try{return await deliver(await run)}finally{if(running.get(id)?.promise===run)running.delete(id)}
  }
  return {list,request,submit,holdBatch,
    activity:session=>[...table.entries()].filter(([k,j])=>k.startsWith('tavern_job__')&&j.sessionId===session.id&&['queued','running'].includes(j.status))
      .map(([,j])=>({sessionId:j.sessionId,kind:j.kind,status:j.status,execution:j.execution,background:j.background===true,createdAt:j.createdAt})),
    async invalidate(session) {
      for(const job of list(session).filter(j=>!terminal.has(j.status)))if(!await isCurrent(session,job)) {
        const admission=admissions.get(job.id),control=controllers.get(job.id)
        await lock(job.id,async()=>{const live=owned(session,job.id);if(!terminal.has(live.status))await table.put(keyOf(job.id),{...live,status:'stale',generation:randomUUID(),updatedAt:Date.now()})})
        if(control?.generation===job.generation)abortControl(session,job.id,control)
        if(admission?.generation===job.generation)admission.reject(new Error('任务来源已变化'))
      }
    },
    async fail(session,id,error) {
      return lock(id,async()=>{const job=owned(session,id);if(terminal.has(job.status))return job
        const next={...job,status:'failed',error:String(error),failure:taskFailureDetails(error),failedAt:Date.now(),updatedAt:Date.now()};await table.put(keyOf(id),next);return next})
    },
    read(session,id,offset=0,maxChars=64000) {
      const job=owned(session,id), text=JSON.stringify(job.input)
      const start=Number(offset), cap=Math.max(256,Math.min(128000,Number(maxChars)||64000))
      if(!Number.isSafeInteger(start)||start<0||start>text.length)throw new Error('任务读取游标无效')
      const end=Math.min(text.length,start+cap)
      return {id:job.id,generation:job.generation,kind:job.kind,branchId:job.branchId,sourceHash:job.sourceHash,offset:start,text:text.slice(start,end),nextOffset:end<text.length?end:null,totalChars:text.length,
        failure:taskValidationFailure(job),validationFailures:job.validationFailures??0,remainingValidationAttempts:Math.max(0,3-(job.validationFailures??0))}
    },
    cancel:cancelJob,
    async retry(session,id) {
      const result=await lock(id,async()=>{const job=owned(session,id)
        if(job.status==='completed')return job
        if(!await isCurrent(session,job))throw new Error('来源已变化，需要新快照')
        const next={...job,status:'queued',generation:randomUUID(),validationFailures:0,error:null,failure:null,failedAt:null,updatedAt:Date.now()};await table.put(keyOf(id),next);return next})
      if(result.status!=='completed') {
        const old=controllers.get(id)
        if(old&&old.generation!==result.generation)abortControl(session,id,old)
        if(running.get(id)?.generation!==result.generation)running.delete(id)
        admissions.get(id)?.reject(new Error('任务已重试，旧结果已失效'))
      }
      return result
    },
    pending(session) {return list(session).filter(j=>j.execution==='inline'&&!terminal.has(j.status))},
  }
}
