import { keyOf, textOf } from './roleplay-data.js'
import { adaptationTurns } from '../memory/memory-provenance.js'
import { eventsOf, surfaceEntries } from './roleplay-context.js'
import { taskPhaseMessage, withTavernLock } from './tavern-tasks.js'
import { isSettingManagementCall, inlineTaskEnvelope } from './tavern-task-context.js'
import type { HostSession, HostAgent } from './roleplay-task-host-types.js'
import type { TaskToolArguments, TaskToolExecution, TaskToolsDependencies, TaskSubmitArguments } from './roleplay-task-tools-types.js'
import type { CharacterInputSource } from './character-cluster-projection.js'
import type { ClaimedMaintenanceInput } from './roleplay-input-preparation.js'
import type { ContextEvent } from './roleplay-context.js'
import { isAgentLoopRequest, type GenerateOptions } from '@deepseek-ai/dsh-llm'

export const semanticTaskSubmitDescription='提交当前维护请求的状态或决策结果。kind 使用 status 或 decision；result 为该任务指定的 JSON 或文本。任务标识由程序绑定，无需填写 id 或 generation。'
export const semanticTaskSubmitParameters={type:'object',properties:{
  kind:{type:'string',enum:['status','decision']},result:{},
},required:['kind','result'],additionalProperties:false}
export const legacyTaskSubmitDescription='提交角色卡、小说或记忆维护任务的结果。id 与 generation 使用当前真实任务提供的值，result 严格遵循该任务的结果契约。'
export const legacyTaskSubmitParameters={type:'object',properties:{id:{type:'string'},generation:{type:'string'},result:{}},
  required:['id','generation','result'],additionalProperties:false}

type TaskIdentity=Readonly<{id:string;generation:string;kind:string}>
function selectedInlineTasks(messages:readonly GenerateOptions['messages'][number][],claimedIds?:ReadonlySet<unknown>):readonly TaskIdentity[] {
  for(let index=messages.length-1;index>=0;index--) {
    const message=messages[index]!,source=message.source as unknown as
      {kind?:string;form?:string;schemaVersion?:number}
    if(source?.kind!=='roleplay-tasks'||source.form!=='phase'||source.schemaVersion!==1
      ||claimedIds&&!claimedIds.has(message.id))continue
    // This is the program's actual phase, not prose containing a task marker.
    // A missing/truncated envelope cannot borrow an older phase's identities.
    try {
      const tasks=inlineTaskEnvelope(textOf(message.content??[]))
      return Array.isArray(tasks)?Object.freeze(tasks.map(({id,generation,kind})=>
        Object.freeze({id,generation,kind}))):[]
    }catch{return []}
  }
  return []
}

/** Associates accepted Native call IDs with their own frozen request input.
 * No current-job lookup belongs here: the task engine still owns currency,
 * cancellation and publication. A cold Agent binds only a new real request. */
export function createTaskSubmissionBindings() {
  type Request={agent:HostAgent;session:HostSession;turn:number;step:number;signal:AbortSignal;
    input:ClaimedMaintenanceInput;tasks?:readonly TaskIdentity[]}
  const requests=new Map<string,Request>()
  let calls=new WeakMap<HostAgent,Map<string,Readonly<{signal:AbortSignal;tasks:readonly TaskIdentity[]}>>>()
  return {
    semanticOnly(input:ClaimedMaintenanceInput) {
      const tasks=selectedInlineTasks(input.messages)
      return tasks.length>0&&tasks.every(task=>task.kind==='status'||task.kind==='decision')
        &&new Set(tasks.map(task=>task.kind)).size===tasks.length
    },
    begin({agent,turn,step,signal}: {agent:HostAgent&{session:HostSession};turn:number;step:number;signal:AbortSignal},
      input:ClaimedMaintenanceInput|undefined) {
      requests.delete(agent.session.id)
      if(input?.turn===turn)requests.set(agent.session.id,{agent,session:agent.session,turn,step,signal,input})
    },
    capture(options:GenerateOptions) {
      if(!isAgentLoopRequest(options))return
      const request=options.sessionId?requests.get(options.sessionId):undefined
      if(!request||request.signal!==options.signal)return
      request.tasks=selectedInlineTasks(options.messages,new Set(request.input.messages.map(message=>message.id)))
    },
    observe(session:HostSession,event:ContextEvent) {
      const request=requests.get(session.id)
      if(!request||request.session!==session||event.data?.turn!==request.turn)return
      if(event.type==='turn/end') {
        requests.delete(session.id);calls.delete(request.agent)
        return
      }
      if(event.type!=='assistant/message'||event.data.step!==request.step||!request.tasks?.length)return
      let owned=calls.get(request.agent)
      if(!owned){owned=new Map();calls.set(request.agent,owned)}
      const binding=Object.freeze({signal:request.signal,tasks:request.tasks})
      // Includes run_code roots: nested tool executions retain rootCallId.
      for(const block of event.data.message?.content??[])if(block.type==='tool-call'&&block.id)owned.set(block.id,binding)
    },
    resolve(exec:TaskToolExecution,kind:'status'|'decision'):TaskIdentity {
      const callId=exec.rootCallId??exec.callId,binding=exec.agent&&callId?calls.get(exec.agent)?.get(callId):undefined
      const matches=binding?.tasks.filter(task=>task.kind===kind)
      if(!binding||binding.signal.aborted||matches?.length!==1)throw Error('维护结果缺少当前请求的唯一任务绑定')
      return matches[0]!
    },
    release(agent:HostAgent) {
      if(agent.session&&requests.get(agent.session.id)?.agent===agent)requests.delete(agent.session.id)
      calls.delete(agent)
    },
    dispose(){requests.clear();calls=new WeakMap()},
  }
}

export function assertSteeringAgent(agent: HostAgent | undefined): asserts agent is HostAgent & {steer: NonNullable<HostAgent['steer']>} {
  if (!agent || typeof agent.steer !== 'function') throw new Error('当前会话代理尚未就绪')
}

export const simpleTool = <A, E, R>(name: string, description: string, parameters: unknown,
  execute: (args: A, exec: E) => R, projectOutput?: (args: A, value: Awaited<R>) => unknown) => ({
    name,
    description,
    parameters,
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (args: A, value: Awaited<R>) => {
        const projected=projectOutput ? projectOutput(args,value) : value
        return [{type:'text',text:typeof projected==='string'?projected:JSON.stringify(projected,null,2)}]
      },
    },
    execute,
    timeoutMs: 120000,
  })

function taskSubmissionReceipt(args: TaskSubmitArguments, value: unknown) {
  if(!value||typeof value!=='object'||!('ok' in value)||value.ok!==true)return value
  const result='result' in value ? value.result : undefined
  const fields=result&&typeof result==='object' ? result as Record<string,unknown> : {}
  // The submitter already supplied the complete result. Program consumers read
  // job.result directly; source pagination does not pretend to read that result.
  return {ok:true,...'kind' in args?{kind:args.kind}:{id:args.id,generation:args.generation},
    status:'completed',resultStored:true,
    ...(Object.hasOwn(fields,'partial')?{partial:fields.partial}:{}),
    ...(Object.hasOwn(fields,'error')?{error:fields.error}:{}),
    ...'kind' in args?{}:{sourceReadWith:{tool:'rp_task_read',id:args.id,contains:'frozen-input-only'}},
    resultLocation:'酒馆管理日志'}
}

export function registerTaskTools({
  ctx,T,clusterJob,resolveRoleplaySession,storyBranchIsActive,characterCluster,cardWorkflowKey,isRoleplaySession,
  ensureBranch,ensureSourceActivationBranch,tavernTasks,startExportJob,activeCardWorkflow,characterRoster,
  contextWindowKey,clusterLoreVisible,assertClusterSource,clusterCore,submissionBindings,inputBinding,
}: TaskToolsDependencies) {
  const sessionOf = async (exec: {agent?: HostAgent},purpose:'ordinary'|'source-activation-management'='ordinary') => {
    let session: HostSession | null | undefined = exec?.agent?.session
    const roleJob=clusterJob(exec?.agent)
    if(roleJob){
      if(roleJob.status!=='running'||roleJob.childSessionId!==session?.id)throw new Error('角色推演授权已失效')
      const owner=await resolveRoleplaySession(roleJob.sessionId)
      if(!owner||!storyBranchIsActive(owner)||!characterCluster.read(owner).enabled)throw new Error('角色所属世界线已失效')
      return owner
    }
    const descriptor=eventsOf(session).find(e=>e?.type==='subagent/descriptor'&&e.seq>=Number(session?.inheritedEventCount??0))
    if(descriptor) {
      const match=String(descriptor.data?.label??'').match(/^Tavern:([a-f0-9]{64}):([a-f0-9-]{36})$/)
      const task=match?T.branch.get(`tavern_job__${match[1]}`):null
      if(!task||task.generation!==match![2]||task.source?.workflowType!=='card'||['cancelled','stale','failed','completed'].includes(task.status!)||task.sessionId!==session!.header?.parentSession)throw new Error('辅助任务授权已失效')
      const workflow=T.branch.get(cardWorkflowKey(task.source.workflowId))
      if(!workflow||workflow.generation!==task.source.generation||['cancelled','stale','failed','completed'].includes(workflow.status!))throw new Error('角色卡任务已取消或替换')
      session=await resolveRoleplaySession(task.sessionId)
    }
    if (!session || !isRoleplaySession(session)) throw new Error('roleplay 工具需要在 roleplay 会话内使用')
    if(purpose==='source-activation-management'&&ensureSourceActivationBranch)await ensureSourceActivationBranch(session)
    else await ensureBranch(session)
    return session
  }

  ctx.effect(()=>ctx.tools.register(simpleTool<TaskToolArguments, TaskToolExecution, Promise<unknown>>('rp_task_read',
    '读取尚未完整内联的维护任务来源。默认每页64000字符，可用maxChars调至128000；按nextOffset连续读完，不推进剧情。已带completeSource的任务可直接提交。',
    {type:'object',properties:{id:{type:'string'},offset:{type:'integer'},maxChars:{type:'integer'}},required:['id'],additionalProperties:false},
    async(args,exec)=>tavernTasks.read(await sessionOf(exec),args.id!,args.offset,args.maxChars))), 'roleplay: task source tool')
  ctx.effect(()=>ctx.tools.register(simpleTool<TaskToolArguments, TaskToolExecution, Promise<unknown>>('rp_novel_export',
    '导出当前世界线的完整剧情原文为 Markdown，包含压缩前历史，排除工具、管理消息和思考。默认 original 由程序完成。只有玩家明确要求重新按语义编排时才使用 organized；任务可恢复并在酒馆管理下载。',
    {type:'object',properties:{mode:{type:'string',enum:['original','organized']}},additionalProperties:false},
    async(args,exec)=>({ok:true,jobId:(await startExportJob(await sessionOf(exec),'novel-export',exec.agent,undefined,undefined,args.mode)).id}))), 'roleplay: novel export tool')
  ctx.effect(()=>ctx.tools.register(simpleTool<TaskToolArguments,TaskToolExecution,Promise<unknown>>('rp_card_export',
    '将当前有效人物、世界书、规则、模板和开场完整保存为 NextTavern 原生 JSON。默认 original 复用手动转换：原生卡由程序导出；社区卡需要时由模型标注原文分类，程序完整拷贝。仅明确要求重新编排 Markdown 时用 organized。原始上传文件请使用界面的源文件导出。任务进度及文件在酒馆管理查看。',
    {type:'object',properties:{mode:{type:'string',enum:['original','organized']}},additionalProperties:false},
    async(args,exec)=>({ok:true,jobId:(await startExportJob(await sessionOf(exec),'card-export',exec.agent,undefined,undefined,args.mode)).id}))),
    'roleplay: deterministic card export tool')
  ctx.effect(()=>ctx.tools.register(simpleTool<TaskSubmitArguments, TaskToolExecution, Promise<unknown>>('rp_task_submit',
    semanticTaskSubmitDescription+' 其他任务继续使用来源中的 id、generation 和 result，各任务独立校验。',
    {type:'object',properties:{...legacyTaskSubmitParameters.properties,...semanticTaskSubmitParameters.properties},
      required:['result'],additionalProperties:false},
    async(args,exec)=>{
      // Capture before sessionOf's first await; a later request/registration
      // must never retarget an already dispatched result to a newer task.
      const identity='kind' in args?submissionBindings.resolve(exec,args.kind):args
      return {ok:true,result:await tavernTasks.submit({session:await sessionOf(exec),
        id:identity.id,generation:identity.generation,value:args.result})}
    },
    taskSubmissionReceipt)), 'roleplay: task submit tool')

  ctx.effect(() => ctx.tools.register(simpleTool<TaskToolArguments, TaskToolExecution, Promise<unknown>>(
    'rp_history',
    '查询当前世界线的玩家输入和有效剧情正文，包含已归档旧正文。排除状态、样式、工具和其他世界线。search 按玩家设置使用关键词、语义或混合；可用自然语言描述伏笔或事件，关键词模式用空格分词。search 可选 kind=agreements，按关键词召回导演笔记中已有的人物约定要素及来源；未提取的旧记录仍用普通检索。read 按 seq 与 nextOffset 连续读正文，约定结果可用 evidenceSeq 回读原文。语义相近不等于事实成立。',
    { type: 'object', properties: {
      action: { type: 'string', enum: ['search', 'read'] }, query: { type: 'string' },
      kind: { type: 'string', enum: ['agreements'], description: '仅 search 使用：查询已有的结构化人物约定；不补写旧记录。' },
      scope: { type: 'string', enum: ['story'] },
      seq: { type: 'integer' }, beforeSeq: { type: 'integer' }, offset: { type: 'integer' },
      limit: { type: 'integer' }, maxChars: { type: 'integer' },
    }, required: ['action'], additionalProperties: false },
    async (args, exec) => {
      const session = await sessionOf(exec)
      const engine = ctx.get('compaction')
      if (!engine?.history) throw new Error('剧情历史服务尚未就绪')
      if(clusterJob(exec.agent))args={...args,scope:'story',maxChars:Math.min(12000,Math.max(1000,Number(args.maxChars)||6000)),limit:Math.min(8,Math.max(1,Number(args.limit)||5))}
      const result=await (args.action === 'read' ? engine.historyRead(session, args) : engine.history(session, args))
      const current=await sessionOf(exec)
      if(current.id!==session.id||!storyBranchIsActive(current))throw new Error('历史查询授权已失效')
      return result
    }
  )), 'roleplay: history query tool')

  ctx.effect(()=>ctx.tools.register(simpleTool<TaskToolArguments, TaskToolExecution, Promise<unknown>>('rp_character_cast',
    '正式剧情动笔前选定本回合主要人物 ID，程序并行推演人物意向。无需传剧情、人设或笔记；新重要人物先保存独立人设。每轮只调用一次，结果仅供主笔参考。',
    {type:'object',properties:{character_ids:{type:'array',items:{type:'string'},uniqueItems:true,maxItems:24}},required:['character_ids'],additionalProperties:false},
    async(args,exec)=>{
      const session=await sessionOf(exec),agent=exec.agent
      assertClusterSource?.(session)
      assertSteeringAgent(agent)
      if(Number(agent.options?.subagentDepth)>0)throw new Error('角色不能递归创建集群')
      const turn=Number(eventsOf(session).findLast(e=>e.type==='turn/start')?.data?.turn)
      const snapshot=T.branch.get(keyOf(session.id,`task-snapshot-${turn}`))
      if(!snapshot||activeCardWorkflow(session))throw new Error('集群只用于正式剧情回合')
      const imported=eventsOf(session).some(e=>e.type==='tool/call'&&e.data?.turn===turn&&(/^rp_source_/.test(e.data?.name??'')||['rp_card_import_begin','rp_card_import_finalize','rp_commit_card','rp_card_draft_check','rp_diagnose','rp_preset'].includes(e.data?.name??'')||isSettingManagementCall(e.data)))
      if(imported||adaptationTurns(eventsOf(session)).has(turn))throw new Error('读卡、创作或管理回合不执行角色推演')
      const roster=characterRoster(session),ids=[...new Set(args.character_ids??[])]
      if(ids.length>24||ids.some(id=>!roster.some(c=>c.id===id)))throw new Error('选角含未知人物，请刷新人物列表或先登记新重要人物')
      const planKey=keyOf(session.id,`cluster-plan-${turn}`)
      return withTavernLock(T.branch,planKey,async()=>{
        const deliver=(result: unknown)=>{
          const context=taskPhaseMessage('story','角色推演已返回，现在进入正式正文。把人物意向作为参考，协调冲突后创作；不要复述后台准备过程。',{turn,characterCast:true})
          const input=inputBinding?.(agent)
          if(!input)throw new Error('INPUT_CONTINUATION_SCOPE_INVALID')
          const delivered=input.steerOwnedContinuation(context,turn)
          if(delivered.kind==='blocked')throw new Error(delivered.code)
          return result
        }
        const previous=T.branch.get(planKey)
        if(previous?.result)return deliver(previous.result)
        const all=surfaceEntries(session),window=T.branch.get(contextWindowKey(session.id))
        const stories=all.filter(e=>e.seq>Number(window?.startSeq??-1))
        const recentTurns=new Set([turn,...all.filter(e=>e.kind==='assistant').slice(-3).map(e=>e.turn)])
        const lore=[...T.branch.entries()].filter(([key,v])=>key.startsWith(`${session.id}__cluster-lore-`)&&recentTurns.has(v.turn)&&clusterLoreVisible(session,v)).map(([,v])=>v)
        const notes=ctx.get('compaction')?.directorNotes?.(session)?.text??''
        const result=await characterCluster.run({session,agent,turn,characters:ids.map(id=>roster.find(c=>c.id===id)! as CharacterInputSource['character']),signal:exec.signal,
          context:{stories,notes,lore:lore as {text: unknown}[],core:clusterCore?clusterCore(session):T.rules.get(keyOf(session.id,'spec'))?.core??'',userText:snapshot.userText}})
        await T.branch.put(planKey,{schemaVersion:1,branchId:session.id,turn,characterIds:ids,result,updatedAt:Date.now()})
        return deliver(result)
      })
    }
  )),'roleplay: character cast tool')

  return {sessionOf}
}
