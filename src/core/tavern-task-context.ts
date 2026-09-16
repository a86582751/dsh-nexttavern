import {randomUUID} from 'node:crypto'
import { adaptationTurns, importedStoryProjection } from '../memory/memory-provenance.js'
import { retireFinishedAdaptation, retireDeliveredDraft } from './card-adaptation-context.js'
import {taskHash, isInlinePending} from './tavern-task-primitives.js'
import {taskValidationFailure, taskFailureDetails, FAILURE_LABELS} from './tavern-task-support.js'
import {fenceCardContent} from './tavern-card.js'

/** Optional transport description; full frozen input remains the audit/retry source. */
export interface MaintenancePromptContext {
  schemaVersion: 1
  before: string
  context: unknown
  after: string
  domain: string
}
export function maintenancePrompt(context: unknown,before: string,after: string,domain='status') {
  const promptContext: MaintenancePromptContext={schemaVersion:1,before,context,after,domain}
  return {user:renderMaintenancePrompt(promptContext),promptContext}
}
function renderMaintenancePrompt(prompt: MaintenancePromptContext,context=prompt.context) {
  return prompt.before+fenceCardContent(JSON.stringify(context),prompt.domain,{stable:true})+prompt.after
}
function checkedPrompt(job:{input?:unknown;promptContext?:unknown}):MaintenancePromptContext|null {
  const value=job.promptContext as MaintenancePromptContext|undefined
  if(!value||value.schemaVersion!==1||typeof value.before!=='string'||typeof value.after!=='string'||typeof value.domain!=='string')return null
  try {return (job.input as {user?:unknown}|undefined)?.user===renderMaintenancePrompt(value)?value:null}catch{return null}
}
function mapPromptStrings(value:unknown,visit:(text:string)=>unknown):unknown {
  if(typeof value==='string')return visit(value)
  if(Array.isArray(value))return value.map(item=>mapPromptStrings(item,visit))
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,mapPromptStrings(item,visit)]))
  return value
}
/** Exact leaf equality only. No fuzzy merging of facts, branch IDs or instructions. */
export function maintenanceTaskInputs(jobs:readonly {input?:unknown;promptContext?:unknown}[],resident:readonly {name:string;text:string}[]=[]) {
  const prompts=jobs.map(checkedPrompt),counts=new Map<string,number>()
  for(const prompt of prompts)if(prompt)mapPromptStrings(prompt.context,text=>{if(text.length>=256)counts.set(text,(counts.get(text)??0)+1);return text})
  const references=new Map<string,unknown>(),sharedContext:{id:string;text:string}[]=[]
  for(const [text,count] of counts){
    const present=resident.find(part=>part.text.includes(text))
    if(present)references.set(text,{currentContextRef:present.name})
    else if(count>1){const id=`source-${sharedContext.length+1}`;references.set(text,{sharedContextRef:id});sharedContext.push({id,text:fenceCardContent(text,'source',{stable:true})})}
  }
  const inputs=jobs.map((job,index)=>{
    const prompt=prompts[index]
    return prompt?{...(job.input as Record<string,unknown>),user:renderMaintenancePrompt(prompt,mapPromptStrings(prompt.context,text=>references.get(text)??text))}:job.input
  })
  return {inputs,sharedContext}
}

/** Scheduling/read-only setting work can accompany prose; synchronous edits are management turns. */
export function isSettingManagementCall(data:{name?:unknown;arguments?:unknown}|undefined) {
  if(data?.name!=='rp_setting')return false
  try {
    const args:unknown=typeof data.arguments==='string'?JSON.parse(data.arguments):data.arguments
    return !!args&&typeof args==='object'&&'action' in args&&['patch','append','create'].includes(String(args.action))
  }catch{return false}
}

// Native Session snapshots and accepted events are immutable. Stream chunks
// never change task/story ownership; keep their append-only audit out of these
// repeatedly computed projections. Mutable legacy/test snapshots are rebuilt.
const eventProjectionCache=new WeakMap<object,{length:number;first:TaskEvent|undefined;last:TaskEvent|undefined;events:readonly TaskEvent[]}>()
export function taskProjectionEvents(session:TaskContextSession):readonly TaskEvent[] {
  const raw=session.events??session.log??[],immutable=Object.isFrozen(raw),prior=immutable?eventProjectionCache.get(session):undefined
  const appendOnly=!!prior&&raw.length>=prior.length&&raw[0]===prior.first&&(prior.length===0||raw[prior.length-1]===prior.last)
  if(appendOnly&&raw.length===prior!.length)return prior!.events
  const tail:TaskEvent[]=[]
  for(let i=appendOnly?prior!.length:0;i<raw.length;i++){const e=raw[i];if(e&&e.type!=='assistant/chunk')tail.push(e)}
  const events=appendOnly&&!tail.length?prior!.events:Object.freeze([...(appendOnly?prior!.events:[]),...tail])
  if(immutable)eventProjectionCache.set(session,{length:raw.length,first:raw[0],last:raw.at(-1),events})
  return events
}
const internalProjectionCache=new WeakMap<object,{events:readonly TaskEvent[];surfaceKey:string;hidden:ReadonlySet<number>}>()
const storyProjectionCache=new WeakMap<object,{events:readonly TaskEvent[];story:ReadonlySet<number>}>()

export interface TaskSource {
  kind?: string
  plugin?: string
  form?: string
  stage?: string
  jobKind?: string
  storySeq?: unknown
  instructionHash?: string
  callId?: string
  provider?: string
  model?: string
  [key: string]: unknown
}
export interface TaskBlock {
  type: string
  id?: string
  name?: string
  text?: string
  toolCallId?: string
  isError?: boolean
  content?: readonly TaskBlock[]
  [key: string]: unknown
}
export interface TaskMessage {
  source?: TaskSource
  content?: readonly TaskBlock[]
  isError?: boolean
  [key: string]: unknown
}
export interface TaskEvent {
  seq: number
  type: string
  data?: {
    turn?: number
    name?: string
    label?: string
    source?: TaskSource
    message?: TaskMessage
    reason?: {kind?: string}
    [key: string]: unknown
  }
  [key: string]: unknown
}
export interface TaskContextSession {
  id: string
  events?: readonly TaskEvent[]
  log?: readonly TaskEvent[]
  surface?: {nodes?: readonly number[]}
  header?: {origin?: string; seedLength?: unknown;cwd?:string}
  append?(type: 'user/message', data: TaskMessage, options: {
    surfaceOp: {op: 'replace'; start: number; end: number}
    sourceEventSeqs: number[]
  }): unknown
}
export interface InlineContextJob {
  id: string
  kind: string
  sessionId: string
  status: string
  execution?: string
  generation?: string
  branchId?: string
  sourceHash?: string
  input?: unknown
  promptContext?: MaintenancePromptContext
  failure?: unknown
  error?: unknown
  validationFailures?: number
}
interface InlineEnvelope {
  id: string
  kind: string
  generation?: string
  branchId?: string
  sourceHash?: string
  failure?: unknown
  remainingValidationAttempts?: number
  input?: unknown
  completeSource?: boolean
  readWith?: string
  totalChars?: number
}
interface TurnGroup {turn?: number; export: boolean; story: boolean; completed: boolean}
const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined

export class InlinePending extends Error {
  code: string
  jobId: string
  constructor(id: string) { super('当前循环有待完成的酒馆维护任务');this.code='TAVERN_INLINE_PENDING';this.jobId=id }
}
// InlinePending is an admission signal, not failure of the whole batch. Let
// every sibling persist its task before the pre-step snapshots the pending
// queue, so the main loop receives all compatible obligations together.
export async function awaitTaskAdmissions<T>(jobs: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>[]> {
  const results=await Promise.allSettled(jobs)
  const failure=results.find(r=>r.status==='rejected'&&!isInlinePending(r.reason))??results.find(r=>r.status==='rejected')
  if(failure?.status==='rejected')throw failure.reason
  return results.map(r=>{if(r.status==='rejected')throw r.reason;return r.value})
}
export function taskPhaseMessage(stage: string, content: string, extra: Record<string, unknown>={}) {
  return {id:randomUUID(),role:'user',content:[{type:'text',text:content}],
    source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',schemaVersion:1,stage,...extra}}
}
// Small maintenance inputs are already frozen and validated by the task
// service. Deliver them whole in the existing loop instead of making the model
// spend a round trip discovering every source. Large/card/novel workflows keep
// their explicit paginated read tools; no source is shortened to fit a budget.
const INLINE_TASK_MARKER='\n待办：\n'
const INLINE_SHARED_MARKER='\n资料引用：currentContextRef 指当前请求已有的同名上下文，不必重读；sharedContextRef 指以下公共资料，分别应用各任务规则。\n'
function inlineTaskEnvelope(text:string):unknown {
  const start=text.indexOf(INLINE_TASK_MARKER)
  if(start<0)return null
  const payload=text.slice(start+INLINE_TASK_MARKER.length),suffix=payload.indexOf(INLINE_SHARED_MARKER)
  if(suffix<0)return JSON.parse(payload)
  // Both writer values are JSON.stringify output: raw newline delimiters cannot
  // occur inside an encoded string, even when source text quotes this marker.
  // Validate the complete tail too; never retire a malformed or truncated input.
  const shared:unknown=JSON.parse(payload.slice(suffix+INLINE_SHARED_MARKER.length))
  if(!Array.isArray(shared)||shared.some(item=>{const row=object(item);return !row||typeof row.id!=='string'||typeof row.text!=='string'||Object.keys(row).some(key=>key!=='id'&&key!=='text')}))throw Error('Invalid inline shared context')
  return JSON.parse(payload.slice(0,suffix))
}
export function inlineTaskInstruction(jobs: readonly InlineContextJob[],{sessionId,maxChars=128000,resident=[]}: {sessionId?: string;maxChars?: number;resident?:readonly {name:string;text:string}[]}={}) {
  let remaining=Math.max(0,Math.min(128000,Number(maxChars)||0))
  const eligible=jobs.filter(job=>job.execution==='inline'&&['queued','running'].includes(job.status)&&(!sessionId||job.sessionId===sessionId))
  const prepared=maintenanceTaskInputs(eligible,resident)
  const compact=eligible.some(job=>['status','decision'].includes(job.kind)&&checkedPrompt(job))&&eligible.every(job=>['status','decision','memory'].includes(job.kind))
    &&JSON.stringify(prepared).length<=remaining
  const inputs=new Map(compact?eligible.map((job,index)=>[job.id,prepared.inputs[index]]):[])
  if(compact)remaining-=JSON.stringify(prepared.sharedContext).length
  const tasks: InlineEnvelope[]=[]
  for(const job of jobs) {
    if(job.execution!=='inline'||!['queued','running'].includes(job.status)||sessionId&&job.sessionId!==sessionId)continue
    const failure=taskValidationFailure(job)
    const task: InlineEnvelope={id:job.id,kind:job.kind,generation:job.generation,branchId:job.branchId,sourceHash:job.sourceHash,
      ...(failure?{failure,remainingValidationAttempts:Math.max(0,3-(job.validationFailures??0))}:{})}
    const input=inputs.get(job.id)??job.input,text=JSON.stringify(input)
    if(['memory','status','decision'].includes(job.kind)&&typeof text==='string'&&text.length<=remaining) {
      task.input=input;task.completeSource=true;remaining-=text.length
    } else {task.readWith='rp_task_read';task.totalChars=text?.length??0}
    tasks.push(task)
  }
  return '当前是系统维护阶段，尚不能生成或续写剧情。下面 completeSource=true 的任务已经附带完整冻结来源与结果契约，不需要再次调用 rp_task_read，直接完成并用 rp_task_submit 分别提交结果。仅未附带 input 的任务需要 rp_task_read 分页完整读取。同一步可调用多个 rp_task_submit；每项按自己的 id、generation、system 与 format 校验。不要输出维护报告或复述任务资料，不改变模型、调用 spawn 或检查实现代码。'+INLINE_TASK_MARKER+JSON.stringify(tasks)+(compact?INLINE_SHARED_MARKER+JSON.stringify(prepared.sharedContext):'')
}
export function inlineTaskMessages(session: TaskContextSession,stage: string,jobs: readonly InlineContextJob[],{force=false,maxChars,resident}: {force?: boolean;maxChars?: number;resident?:readonly {name:string;text:string}[]}={}) {
  const content=inlineTaskInstruction(jobs,{sessionId:session.id,maxChars,resident}),instructionHash=taskHash({stage,content})
  // alpha.3 history adapter: inspect the current tail without copying the full log.
  const events=force?[]:session.events??session.log??[]
  for(let index=events.length-1;index>=0;index--) {
    const event=events[index]!
    if(event.type==='turn/start'||event.type==='turn/end')break
    const source=event.type==='user/message'?event.data?.source:null
    if(source?.plugin==='roleplay-tasks'&&source.form==='phase') {
      if(source.stage===stage&&source.instructionHash===instructionHash)return []
      break
    }
  }
  return [taskPhaseMessage(stage,content,{instructionHash})]
}
export function taskStorySeqs(session: TaskContextSession) {
  const events=taskProjectionEvents(session),previous=storyProjectionCache.get(session)
  if(previous?.events===events)return new Set(previous.story)
  const result=new Set<number>()
  for(const event of events) {
    const source=event?.type==='user/message'?event.data?.source:undefined
    if(source?.kind==='plugin'&&source.plugin==='roleplay-tasks'&&source.stage==='after-story'&&typeof source.storySeq==='number'&&Number.isSafeInteger(source.storySeq))result.add(source.storySeq)
  }
  storyProjectionCache.set(session,{events,story:result})
  return result
}
function completedImportSpan(nodes: number[],lookup: Map<number, TaskEvent>) {
  const callsOf=(e: TaskEvent | undefined)=>e?.type==='assistant/message'?(e.data?.message?.content??[]).filter(b=>b.type==='tool-call'):[]
  const begin=nodes.findIndex(seq=>callsOf(lookup.get(seq)).some(b=>b.name==='rp_card_import_begin'))
  if(begin<0)return null
  const calls=new Map<string,string>(),results=new Set<string>(),allowed=/^(?:skill|rp_card_import_(?:begin|chunk|stage|finalize)|rp_task_(?:read|submit))$/
  for(let i=begin;i<nodes.length;i++){
    const e=lookup.get(nodes[i]!)
    if(e?.type==='assistant/message'){
      const blocks=callsOf(e)
      if(!blocks.length)return null
      for(const b of blocks){if(!allowed.test(b.name??'')||!b.id||calls.has(b.id))return null;calls.set(b.id,b.name!)}
    }else if(e?.type==='tool/result'){
      const m=e.data?.message,id=m?.source?.callId
      if(!m||!id||!calls.has(id)||results.has(id))return null
      results.add(id)
      if(calls.get(id)==='rp_card_import_finalize'){
        const wrapped=(m.content??[]).filter(b=>b.type==='tool-result')
        if(wrapped.length&&(wrapped.length!==1||wrapped[0]!.toolCallId!==id))return null
        const result=wrapped[0]??m
        let proof: Record<string, unknown> | undefined
        try{proof=object(JSON.parse((result.content??[]).filter(b=>b.type==='text').map(b=>b.text).join('\n')))}catch{return null}
        // Native finalize's `status` is the presence of a status template,
        // not the import lifecycle. Activation time/hash prove the commit.
        if(m.isError||result.isError||proof?.ok!==true||!(typeof proof.activatedAt==='number'&&proof.activatedAt>0)||!Number.isFinite(proof.activatedAt)
          ||!/^[a-f0-9]{64}$/.test(String(proof.normalizedSha256??''))||proof.coverage!==1||!proof.importId||calls.size!==results.size)return null
        return {nodes:nodes.slice(begin,i+1),importId:proof.importId,normalizedSha256:proof.normalizedSha256}
      }
    }else if(e?.type!=='user/message'||e.data?.source?.kind!=='plugin'||e.data.source.plugin!=='roleplay-tasks'
      ||e.data.source.form!=='phase'||['story','after-story'].includes(e.data.source.stage??''))return null
  }
  return null
}
/** Retire completed export-only turns and proven import tool preludes once. Ordinary story/maintenance prefixes
 * stay byte-identical until hard-window eviction. The audit log is never edited. */
export function retireCompletedTaskContexts(session: TaskContextSession,currentTurn: number,activeImport?:{importId:string;normalizedSha256:string;opening:string}) {
  if(typeof session?.append!=='function')return 0
  const retiredResearch=retireDeliveredDraft(session,currentTurn)+retireFinishedAdaptation(session,currentTurn,activeImport)
  const events=session.events??session.log??[],groups: TurnGroup[]=[],bySeq=new Map<number,TurnGroup>(),lookup=new Map<number,TaskEvent>();let group: TurnGroup|null=null
  for(const e of events) {
    if(!e)continue
    lookup.set(e.seq,e)
    if(e.type==='turn/start'){group={turn:e.data?.turn,export:false,story:false,completed:false};groups.push(group)}
    if(group)bySeq.set(e.seq,group)
    const source=e.type==='user/message'?e.data?.source:null
    if(group&&source?.kind==='plugin'&&source.plugin==='roleplay-tasks') {
      if(['card-export','novel-export'].includes(source.jobKind??''))group.export=true
      if(source.form==='phase'&&['story','after-story'].includes(source.stage??''))group.story=true
    }
    if(group&&e.type==='tool/call'&&/^(?:rp_card_export_(?:begin|chunk|finalize)|rp_novel_export)$/.test(e.data?.name??''))group.export=true
    if(group&&e.type==='turn/end'){group.completed=e.data?.reason?.kind==='completed';group=null}
  }
  const visible=[...(session.surface?.nodes??[])],nodesByGroup=new Map<TurnGroup,number[]>(),positions=new Map<number,number>()
  for(let index=0;index<visible.length;index++) {
    const seq=visible[index]!
    if(!positions.has(seq))positions.set(seq,index)
    const owner=bySeq.get(seq)
    if(owner){if(!nodesByGroup.has(owner))nodesByGroup.set(owner,[]);nodesByGroup.get(owner)!.push(seq)}
  }
  let retired=retiredResearch
  for(const candidate of groups) {
    const currentImport=!!activeImport&&candidate.turn===currentTurn
    if((!candidate.completed||candidate.turn===currentTurn)&&!currentImport)continue
    const groupNodes=nodesByGroup.get(candidate)??[]
    const imported=completedImportSpan(groupNodes,lookup)
    if(currentImport&&(!imported||imported.importId!==activeImport!.importId||imported.normalizedSha256!==activeImport!.normalizedSha256))continue
    if(!imported&&(!candidate.export||candidate.story))continue
    const selected=imported?.nodes??groupNodes
    if(!selected.length)continue
    const start=selected[0]!,end=selected.at(-1)!,first=positions.get(start)!,last=positions.get(end)!
    // A branch-local replacement/checkpoint can interleave nodes from another
    // turn. Never consume a foreign story to retire management material.
    if(last-first+1!==selected.length)continue
    let contiguous=true
    for(let index=first;index<=last;index++){const seq=visible[index]!;if(!lookup.has(seq)||bySeq.get(seq)!==candidate){contiguous=false;break}}
    if(!contiguous)continue
    const receipt={schemaVersion:1,kind:'plugin',plugin:'roleplay-tasks',form:'management-receipt',
      sessionId:session.id,sourceTurn:candidate.turn,sourceSha256:taskHash(selected.map(seq=>lookup.get(seq))),start,end,
      ...(imported?{jobKind:'card-import',importId:imported.importId}:{})}
    session.append('user/message',{id:randomUUID(),role:'user',source:receipt,
      content:[{type:'text',text:imported?`读卡已完整激活。设定由当前角色扮演栏目提供，原始读卡消息与工具结果保存在历史 seq ${start}–${end}。${currentImport?'作者原始开场（原样展示，不提前续写）：\n'+activeImport!.opening:'以下继续剧情。'}`:`导出操作已结束。原始消息与工具结果保存在历史 seq ${start}–${end}，导出文件可在资源库查看。以下继续剧情。`}]},
      {surfaceOp:{op:'replace',start,end},sourceEventSeqs:selected})
    retired+=selected.length
  }
  return retired
}
/** Program-selected prompt retention. Terminal task attempts become receipts;
 * durable source data, validation results and every raw event stay recoverable. */
export function retireSettledInlineContexts(session:TaskContextSession,currentTurn:number,jobs:readonly InlineContextJob[]) {
  if(!session.append)return 0
  const events=session.events??session.log??[],lookup=new Map(events.map(e=>[e.seq,e])),owners=new Map<number,number>(),ended=new Set<number>()
  let turn:number|undefined
  for(const e of events){if(e.type==='turn/start')turn=e.data?.turn;if(turn!==undefined)owners.set(e.seq,turn);if(e.type==='turn/end'){if(turn!==undefined)ended.add(turn);turn=undefined}}
  const internal=internalTaskSeqs(session),visible=[...(session.surface?.nodes??[])],groups:number[][]=[]
  let group:number[]=[]
  const flush=()=>{if(group.length)groups.push(group);group=[]}
  for(const seq of visible){const e=lookup.get(seq)!,source=e.type==='user/message'?e.data?.source:undefined,owner=owners.get(seq)
    if(owner===undefined||owner>=currentTurn||!ended.has(owner)||group.length&&owners.get(group[0]!)!==owner){flush();if(owner===undefined||owner>=currentTurn||!ended.has(owner))continue}
    if(e.type==='user/message'){
      if(source?.kind==='plugin'&&source.plugin==='roleplay-tasks'&&source.form==='phase'&&['after-story','prepare','management'].includes(source.stage??'')){flush();group.push(seq);continue}
      flush();continue
    }
    if(group.length&&((e.type==='assistant/message'&&internal.has(seq))||e.type==='tool/result'))group.push(seq)
    else flush()
  }
  flush()
  const jobById=new Map(jobs.map(j=>[j.id,j])),terminal=new Set(['completed','failed','cancelled','stale'])
  let retired=0
  for(const selected of groups){
    const attempts=new Map<string,{id:string;generation:string;sourceHash:string;kind:string;state:string;failure?:string}>(),calls=new Set<string>(),results=new Set<string>()
    let valid=true
    for(const seq of selected){const e=lookup.get(seq)!
      if(e.type==='user/message'){
        const source=e.data?.source
        if(source?.storySeq!==undefined){const story=lookup.get(Number(source.storySeq));if(!story||!Number.isSafeInteger(source.storySeq)||source.turn!==owners.get(seq)||story.type!=='assistant/message'||owners.get(story.seq)!==owners.get(seq)||internal.has(story.seq)||story.seq>=seq){valid=false;break}}
        const text=(e.data?.content as readonly TaskBlock[]|undefined??[]).filter(b=>b.type==='text').map(b=>b.text??'').join('\n')
        let tasks:unknown;try{tasks=inlineTaskEnvelope(text)}catch{valid=false;break}
        if(tasks===null)continue
        if(!Array.isArray(tasks)||!tasks.length){valid=false;break}
        for(const raw of tasks){const task=object(raw),job=typeof task?.id==='string'?jobById.get(task.id):undefined
          if(!task||!job||job.sessionId!==session.id||job.execution!=='inline'||!['status','decision','memory'].includes(job.kind)||job.kind!==task.kind||typeof task.generation!=='string'||!task.generation||!job.generation||!job.sourceHash||job.sourceHash!==task.sourceHash){valid=false;break}
          const same=job.generation===task.generation
          // Explicit retry changes generation. The old attempt is retired even
          // while the new one runs; the new attempt's context is preserved.
          if(same&&!terminal.has(job.status)){valid=false;break}
          const category=object(job.failure)?.category
          const failure=job.status==='failed'?(taskValidationFailure(job)?'任务结果校验失败':typeof category==='string'&&Object.hasOwn(FAILURE_LABELS,category)?FAILURE_LABELS[category as keyof typeof FAILURE_LABELS]:taskFailureDetails(job.error).label):job.status==='stale'?'来源已变化，旧结果不可使用':undefined
          attempts.set(`${job.id}:${task.generation}`,{id:job.id,generation:task.generation,sourceHash:job.sourceHash,kind:job.kind,state:same||['cancelled','stale','failed'].includes(job.status)?job.status:'superseded',...(failure?{failure}:{})})
        }
        if(!valid)break
      }else if(e.type==='assistant/message'){
        for(const b of e.data?.message?.content??[])if(b.type==='tool-call'){
          if(typeof b.id!=='string'||calls.has(b.id)||!['rp_task_read','rp_task_submit','run_code'].includes(b.name??'')){valid=false;break}calls.add(b.id)
        }
      }else if(e.type==='tool/result'){
        const id=e.data?.message?.source?.callId
        if(typeof id!=='string'||!calls.has(id)||results.has(id)){valid=false;break}results.add(id)
      }
      if(!valid)break
    }
    if(!valid||!attempts.size)continue
    // A stopped attempt can have no result. It is safe to retire the call only
    // when no still-visible result elsewhere would become orphaned.
    const selectedSet=new Set(selected)
    if(visible.some(seq=>{const e=lookup.get(seq);return !selectedSet.has(seq)&&e?.type==='tool/result'&&calls.has(e.data?.message?.source?.callId??'')}))continue
    const details=[...attempts.values()],recover=details.filter(a=>a.state==='failed'),stale=details.some(a=>a.state==='stale'),sourceTurn=owners.get(selected[0]!)!
    const text=`先前维护尝试已结束或被新尝试替代，完整参数、输出与错误记录保留在历史 seq ${selected[0]}–${selected.at(-1)}。成功结果采用最新状态及笔记；失败、取消或过期不是剧情事实。任务概况：${JSON.stringify(details.slice(0,8).map(({id,kind,state,failure})=>({id,kind,state,...(failure?{failure}:{})})))}${details.length>8?`；其余 ${details.length-8} 项见酒馆管理日志。`:''}${recover.length?'尚未解决的失败可在酒馆管理日志中重试；需要完整来源时用 rp_task_read(id)，不要依据旧尝试继续提交。':''}${stale?'过期任务须由酒馆管理按当前来源重新发起，不能重交旧快照；详情可用 rp_task_read(id) 查阅。':''}`
    session.append('user/message',{id:randomUUID(),role:'user',source:{kind:'plugin',plugin:'roleplay-tasks',form:'maintenance-receipt',schemaVersion:1,sessionId:session.id,sourceTurn,attempts:details,sourceSha256:taskHash(selected.map(seq=>lookup.get(seq)))},content:[{type:'text',text}]},
      {surfaceOp:{op:'replace',start:selected[0]!,end:selected.at(-1)!},sourceEventSeqs:selected})
    retired+=selected.length
  }
  return retired
}

/** Read evidence survives the request that needs it. At a later player turn,
 * retire pure read groups only after a committed body and completed turn. */
export function retireUsedStoryReads(session:TaskContextSession,currentTurn:number) {
  if(!session.append)return 0
  const events=session.events??session.log??[],lookup=new Map(events.map(e=>[e.seq,e])),nodes=[...(session.surface?.nodes??[])],owners=new Map<number,number>(),completed=new Set<number>(),bodies=new Map<number,number>()
  let turn:number|undefined
  for(const e of events){if(e.type==='turn/start')turn=e.data?.turn;if(turn!==undefined)owners.set(e.seq,turn)
    const source=e.type==='user/message'?e.data?.source:undefined
    if(turn!==undefined&&source?.kind==='plugin'&&source.plugin==='roleplay-tasks'&&source.form==='phase'&&source.stage==='after-story'&&source.turn===turn&&Number.isSafeInteger(source.storySeq)){
      const body=lookup.get(Number(source.storySeq));if(body?.type==='assistant/message'&&owners.get(body.seq)===turn&&body.seq<e.seq)bodies.set(turn,body.seq)
    }
    if(e.type==='turn/end'){if(turn!==undefined&&e.data?.reason?.kind==='completed')completed.add(turn);turn=undefined}
  }
  const allowed=new Set(['rp_history','rp_worldbook_list','rp_worldbook_search']),internal=internalTaskSeqs(session)
  let retired=0
  for(let i=0;i<nodes.length;i++){
    const e=lookup.get(nodes[i]!)!,owner=owners.get(e.seq),body=owner===undefined?undefined:bodies.get(owner)
    if(e.type!=='assistant/message'||owner===undefined||owner>=currentTurn||!completed.has(owner)||body===undefined||body<=e.seq||internal.has(body))continue
    const blocks=(e.data?.message?.content??[]).filter(b=>b.type!=='reasoning'&&!(b.type==='text'&&!String(b.text??'').trim()))
    if(!blocks.length||blocks.some(b=>b.type!=='tool-call'||!b.id||!allowed.has(b.name??'')))continue
    const calls=new Set(blocks.map(b=>b.id!));if(calls.size!==blocks.length)continue
    const selected=[e.seq],pending=new Set(calls);let j=i+1
    for(;j<nodes.length&&pending.size;j++){
      const result=lookup.get(nodes[j]!)!,id=result.data?.message?.source?.callId
      if(result.type!=='tool/result'||owners.get(result.seq)!==owner||result.seq>=body||!id||!pending.has(id))break
      pending.delete(id);selected.push(result.seq)
    }
    if(pending.size)continue
    const start=selected[0]!,end=selected.at(-1)!,tools=[...new Set(blocks.map(b=>b.name!))]
    session.append('user/message',{id:randomUUID(),role:'user',source:{kind:'plugin',plugin:'roleplay-tasks',form:'read-evidence-receipt',schemaVersion:1,sessionId:session.id,sourceTurn:owner,bodySeq:body,tools,sourceSha256:taskHash(selected.map(seq=>lookup.get(seq)))},
      content:[{type:'text',text:`先前 ${tools.join(' / ')} 读取已完成本轮使用；原始调用与结果保留于历史 seq ${start}–${end}。需要旧事实或世界知识时重新按当前世界线查阅，读取记录本身不是已发生剧情；失败结果不作事实依据。`}]},
      {surfaceOp:{op:'replace',start,end},sourceEventSeqs:selected})
    retired+=selected.length;i=j-1
  }
  return retired
}

/** Durable step provenance, never keyword heuristics or a whole-turn ban. */
export function internalTaskSeqs(session: TaskContextSession) {
  const events=taskProjectionEvents(session),previous=internalProjectionCache.get(session),surfaceKey=[...(session.surface?.nodes??[])].join(',')
  if(previous?.events===events&&previous.surfaceKey===surfaceKey)return new Set(previous.hidden)
  const hidden=new Set<number>(),managementTurns=new Set<number|null|undefined>(),turns=new Map<number,number|null|undefined>(); let internal=false,turn: number|null|undefined=null,authoring=false
  for(const turn of adaptationTurns(events))managementTurns.add(turn)
  for(const e of events) {
    if(e?.type==='turn/start')turn=e.data?.turn
    if(e)turns.set(e.seq,turn)
    if(e?.type==='tool/call'&&e.data?.name==='rp_card_draft_check')authoring=true
    if(e?.type==='tool/call'&&['rp_card_import_begin','rp_commit_card'].includes(e.data?.name??''))authoring=false
    if(e?.type==='user/message'&&e.data?.source?.plugin==='roleplay-tasks'&&e.data.source.stage==='after-story')authoring=false
    if(authoring&&e?.type==='tool/call'&&e.data?.name==='ask_user_question')managementTurns.add(e.data?.turn??turn)
    if(e?.type==='tool/call'&&(/^(?:rp_card_export_(?:begin|chunk|finalize)|rp_novel_export|rp_diagnose|rp_preset|rp_card_draft_check)$/.test(e.data?.name??'')||isSettingManagementCall(e.data)))managementTurns.add(e.data?.turn??turn)
    if(e?.type==='user/message'&&e.data?.source?.plugin==='roleplay-tasks'&&['card-export','novel-export'].includes(e.data?.source?.jobKind??''))managementTurns.add(turn)
    if(e?.type==='turn/start'||e?.type==='turn/end')internal=false
    if(e?.type==='user/message' && e.data?.source?.kind==='plugin' && e.data?.source?.plugin==='roleplay-tasks' && e.data?.source?.form==='phase')internal=e.data.source.stage!=='story'
    if(internal&&e?.type==='assistant/message')hidden.add(e.seq)
    if(e?.type==='turn/end')turn=null
  }
  const resumed=importedStoryProjection(events,[...(session.surface?.nodes??[])]).prose
  for(const e of events)if(!resumed.has(e.seq)&&managementTurns.has(e.data?.turn??turns.get(e.seq))&&(e.type==='assistant/message'||(e.type==='user/message'&&e.data?.source?.kind==='user')))hidden.add(e.seq)
  internalProjectionCache.set(session,{events,surfaceKey,hidden})
  return hidden
}
const keyOf = (id: string) => `tavern_job__${id}`
export function tavernTaskToolBoundary(table: {get(key: string): unknown},agent: {session?: TaskContextSession;options?: {subagentDepth?: unknown;tavernTaskId?: string}} | null | undefined) {
  const session=agent?.session
  if(!session)return null
  if(!(Number(agent.options?.subagentDepth)>0)&&session.header?.origin!=='subagent')return null
  const descriptor=(session.events??session.log??[]).findLast(event=>event.type==='subagent/descriptor'&&Number(event.seq)>=Number(session.header?.seedLength??0))
  const match=/^Tavern:([a-f0-9]{64}):/.exec(descriptor?.data?.label??'')
  const earlyId=Number(agent.options?.subagentDepth)>0&&/^[a-f0-9]{64}$/.test(agent.options?.tavernTaskId??'')?agent.options?.tavernTaskId:null
  const id=earlyId??match?.[1],job=id?object(table.get(keyOf(id))):undefined
  return job?new Set((Array.isArray(job.allowedTools)?job.allowedTools:[]).filter((name: unknown): name is string=>typeof name==='string'&&!['subagent','spawn','fork','send_message','list_agents','interrupt_agent'].includes(name))):null
}
