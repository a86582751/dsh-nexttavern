import { keyOf } from './roleplay-data.js'
import { adaptationTurns } from '../memory/memory-provenance.js'
import { eventsOf, surfaceEntries } from './roleplay-context.js'
import { taskPhaseMessage, withTavernLock } from './tavern-tasks.js'
import { isSettingManagementCall } from './tavern-task-context.js'
import type { HostSession, HostAgent } from './roleplay-task-host-types.js'
import type { TaskToolArguments, TaskToolExecution, TaskToolsDependencies } from './roleplay-task-tools-types.js'
import type { CharacterInputSource } from './character-cluster-projection.js'

export function assertSteeringAgent(agent: HostAgent | undefined): asserts agent is HostAgent & {steer: NonNullable<HostAgent['steer']>} {
  if (!agent || typeof agent.steer !== 'function') throw new Error('当前会话代理尚未就绪')
}

export const simpleTool = <A, E, R>(name: string, description: string, parameters: unknown, execute: (args: A, exec: E) => R) => ({
    name,
    description,
    parameters,
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args: unknown, value: unknown) => [
        { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
      ],
    },
    execute,
    timeoutMs: 120000,
  })

export function registerTaskTools({ctx, T, clusterJob, resolveRoleplaySession, storyBranchIsActive, characterCluster, cardWorkflowKey, isRoleplaySession, ensureBranch, tavernTasks, startExportJob, activeCardWorkflow, characterRoster, contextWindowKey, clusterLoreVisible}: TaskToolsDependencies) {
  const sessionOf = async (exec: {agent?: HostAgent}) => {
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
    await ensureBranch(session)
    return session
  }

  ctx.effect(()=>ctx.tools.register(simpleTool<TaskToolArguments, TaskToolExecution, Promise<unknown>>('rp_task_read',
    '读取尚未完整内联的维护任务来源。默认每页64000字符，可用maxChars调至128000；按nextOffset连续读完，不推进剧情。已带completeSource的任务可直接提交。',
    {type:'object',properties:{id:{type:'string'},offset:{type:'integer'},maxChars:{type:'integer'}},required:['id'],additionalProperties:false},
    async(args,exec)=>tavernTasks.read(await sessionOf(exec),args.id!,args.offset,args.maxChars))), 'roleplay: task source tool')
  ctx.effect(()=>ctx.tools.register(simpleTool<TaskToolArguments, TaskToolExecution, Promise<unknown>>('rp_novel_export',
    '将当前分支完整剧情整理为一章一章的 Markdown 小说，包含压缩前历史，排除工具和管理请求。玩家说导出小说或整理完整剧情时使用；任务可恢复并在酒馆管理下载。',
    {type:'object',properties:{},additionalProperties:false},async(_args,exec)=>({ok:true,jobId:(await startExportJob(await sessionOf(exec),'novel-export',exec.agent)).id}))), 'roleplay: novel export tool')
  ctx.effect(()=>ctx.tools.register(simpleTool<TaskToolArguments, TaskToolExecution, Promise<unknown>>('rp_task_submit',
    '提交当前循环完成的维护任务结果。id和generation来自系统任务元数据（完整内联或rp_task_read）；result为任务指定JSON对象或完整文本。各任务独立校验。',
    {type:'object',properties:{id:{type:'string'},generation:{type:'string'},result:{}},required:['id','generation','result'],additionalProperties:false},
    async(args,exec)=>({ok:true,result:await tavernTasks.submit({session:await sessionOf(exec),id:args.id!,generation:args.generation!,value:args.result})}))), 'roleplay: task submit tool')

  ctx.effect(() => ctx.tools.register(simpleTool<TaskToolArguments, TaskToolExecution, Promise<unknown>>(
    'rp_history',
    '查询当前世界线的玩家输入和有效剧情正文，包含已归档旧正文。排除状态、样式、工具和其他世界线。search 按玩家设置使用关键词、语义或混合；可用自然语言描述伏笔或事件，关键词模式用空格分词。read 按 seq 与 nextOffset 连续读正文。语义相近不等于事实成立。',
    { type: 'object', properties: {
      action: { type: 'string', enum: ['search', 'read'] }, query: { type: 'string' },
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
          if(exec.deferContext)exec.deferContext(context);else agent.steer(context)
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
          context:{stories,notes,lore:lore as {text: unknown}[],core:T.rules.get(keyOf(session.id,'spec'))?.core??'',userText:snapshot.userText}})
        await T.branch.put(planKey,{schemaVersion:1,branchId:session.id,turn,characterIds:ids,result,updatedAt:Date.now()})
        return deliver(result)
      })
    }
  )),'roleplay: character cast tool')

  return {sessionOf}
}
