import { randomUUID } from 'node:crypto'
import { keyOf, cloneRecord, sha256, recordSha256 } from './roleplay-data.js'
import { readCardSource, fenceCardContent } from './tavern-card.js'
import { isInlinePending, taskPhaseMessage } from './tavern-tasks.js'
import { assertWorkspaceSession, type ContextSession } from './roleplay-context.js'
import type { CardWorkflowDependencies, CardWorkflowSession, CardWorkflowAgent, CardWorkflowRecord, CardWorkflowJob, CardWorkflowResult } from './roleplay-card-workflow-types.js'

export function createCardWorkflows(deps: CardWorkflowDependencies) {
  const { T, storyBranchIsActive, modelPolicy, statusFixedContext, nativeTask, CARD_CLASSIFICATION_GUIDE, archiveImported, libraryFor, resourceName, tavernTasks, taskAgents, ctx } = deps
  const cardWorkflowKey=(id: string)=>`tavern_cardjob__${id}`
  const cardWorkflows=(session: {id: string})=>[...T.branch.entries()].filter(([k,j])=>k.startsWith('tavern_cardjob__')&&(j as CardWorkflowJob).sessionId===session.id).map(([,j])=>cloneRecord(j as CardWorkflowJob))
  const activeCardWorkflow=(session: {id: string})=>cardWorkflows(session).find(j=>['queued','running','waiting-main'].includes(j.status))
  function assertCardWorkflow(session: CardWorkflowSession,record: CardWorkflowRecord | null | undefined) {
    if(!record?.workflowId)return
    const job=T.branch.get(cardWorkflowKey(record.workflowId)) as CardWorkflowJob | undefined
    if(!job||job.sessionId!==session.id||['cancelled','stale','failed'].includes(job.status)||record.workflowGeneration!==job.generation||!storyBranchIsActive(session))throw new Error('角色卡任务授权已取消或来源已失效')
    if(job.kind==='card-import'&&record.rawSha256!==job.source.sha256)throw new Error('角色卡任务来源哈希不匹配')
  }
  async function beginCardWorkflow(session: CardWorkflowSession,kind: string,sourceFile: unknown,agent?: CardWorkflowAgent) {
    if(!['card-import','card-export'].includes(kind))throw new Error('角色卡任务类型无效')
    const active=activeCardWorkflow(session)
    if(active&&active.kind!==kind)throw new Error('当前会话已有另一项角色卡任务，请先完成或取消')
    const source=kind==='card-import'?readCardSource(session.header.cwd,sourceFile):null
    if(active){if(source&&active.source.sha256!==sha256(source.bytes))throw new Error('当前会话正在读取另一张卡，请先完成或取消');return active}
    const id=randomUUID(),selection=await modelPolicy.resolve(session,kind,agent)
    const job={schemaVersion:1,id,kind,sessionId:session.id,branchId:session.id,generation:randomUUID(),selection,execution:selection.execution,actualRoute:selection.actualRoute,
      status:'queued',createdAt:Date.now(),progress:{done:0,total:1},source:{sourceFile:source?.sourcePath??null,sha256:source?sha256(source.bytes):recordSha256(statusFixedContext(session))}}
    await T.branch.put(cardWorkflowKey(id),job)
    return job
  }
  async function resumeCardWorkflows(session: ContextSession,agent?: CardWorkflowAgent,signal?: AbortSignal) {
    const job=activeCardWorkflow(session)
    if(!job)return
    assertWorkspaceSession(session)
    const source={workflowId:job.id,workflowType:'card',generation:job.generation,events:[]}
    try {
      await T.branch.put(cardWorkflowKey(job.id),{...job,status:'running'})
      const result=await nativeTask({session,agent,kind:job.kind,format:'workflow',selection:job.selection,source,signal,timeoutMs:600000,
        tools:job.kind==='card-import'?['rp_card_import_begin','rp_card_import_chunk','rp_card_import_stage','rp_card_import_finalize']:['rp_card_export_begin','rp_card_export_chunk','rp_card_export_finalize'],
        system:job.kind==='card-import'
          ?'使用原生读卡工具完成完整导入：rp_card_import_begin → 连续rp_card_import_chunk全文审阅 → rp_card_import_stage完整分类 → rp_card_import_finalize激活。所有设定和附加字段完整保留。只处理任务指定文件，失败不能绕过或改源文件，不续写剧情。已存在当前任务的导入记录时续做该记录，不重新开始。完成后提交任务结果。\n'+CARD_CLASSIFICATION_GUIDE
          :'使用原生逆向组卡：rp_card_export_begin冻结当前最新已编辑设定 → rp_card_export_chunk连续全文审阅 → rp_card_export_finalize组织完整MD并落盘。按创作语义重组，用户新增镜头语言归入叙事规则，不照搬来源字段。混合来源全文审阅后用chunk(source_id)取得行号，再用sections.source_parts拆分，每行完整恰好一次。深度组织章节、不精简，不用旧原卡覆盖编辑。已有本任务导出记录时从检查点续做，不重新开始。完成后提交任务结果。\n'+CARD_CLASSIFICATION_GUIDE,
        user:JSON.stringify({jobId:job.id,...job.source}),
        validate:async()=>{
          let completed: CardWorkflowRecord | undefined
          for (const [,raw] of T.branch.entries()) {
            const record = raw as CardWorkflowRecord | null | undefined
            if(record?.workflowId!==job.id)continue
            if(job.kind==='card-import'?record.status==='active'&&record.rawSha256===job.source.sha256:record.status==='completed'&&record.exportId) {
              completed=record
              break
            }
          }
          if(!completed)throw new Error('角色卡任务还没有可核验的完整结果，请继续原生工具流程')
          if(job.kind==='card-import') {
            const resource=await archiveImported(session,completed)
            return {importId:completed.importId,resourceId:resource?.id??resource?.resourceId}
          }
          const lib=libraryFor(session),resource=await lib.migrate({id:`export-${completed.exportId}`,name:resourceName(completed.title??'角色卡'),type:'text/markdown',path:completed.file,source:{sessionId:session.id,kind:'card-export',exportId:completed.exportId}})
          if(!resource.ok)throw new Error('角色卡导出入库待重试')
          return {exportId:completed.exportId,file:completed.file,resourceId:resource.resource.id}
        },
      })
      const live=T.branch.get(cardWorkflowKey(job.id)) as CardWorkflowJob | undefined
      if(live?.generation===job.generation&&live.status!=='cancelled')await T.branch.put(cardWorkflowKey(job.id),{...live,status:'completed',result,resourceId:result.resourceId,progress:{done:1,total:1},completedAt:Date.now()})
    }catch(error){
      const live=T.branch.get(cardWorkflowKey(job.id)) as CardWorkflowJob | undefined
      if(live?.generation===job.generation&&live.status!=='cancelled')await T.branch.put(cardWorkflowKey(job.id),{...live,status:isInlinePending(error)?'waiting-main':'failed',error:isInlinePending(error)?null:String((error as Error).message)})
      if(isInlinePending(error))throw error
    }
  }
  async function completeCardWorkflow(session: CardWorkflowSession,record: CardWorkflowRecord,result: CardWorkflowResult) {
    if(!record.workflowId)return
    const job=T.branch.get(cardWorkflowKey(record.workflowId)) as CardWorkflowJob | undefined
    if(!job||job.sessionId!==session.id||['cancelled','stale','failed'].includes(job.status))throw new Error('角色卡任务已失效')
    if(job.kind==='card-import'?(!record.importId||record.status!=='active'||record.rawSha256!==job.source.sha256):!record.exportId)throw new Error('角色卡任务与完成结果不匹配')
    if(!result.resourceId){await T.branch.put(cardWorkflowKey(job.id),{...job,status:'failed',error:'设定已保存，资源入库待重试'});return}
    for(const task of tavernTasks.pending(session).filter(t=>(t.source as {workflowId?: string} | undefined)?.workflowId===job.id)) {
      try {await tavernTasks.submit({session,id:task.id,generation:task.generation!,value:{finished:true}})}catch{}
    }
    await T.branch.put(cardWorkflowKey(job.id),{...job,status:'completed',result,resourceId:result.resourceId,progress:{done:1,total:1},completedAt:Date.now()})
    if(job.kind==='card-import'&&!job.openingRequested) {
      const opening=T.opening.get(keyOf(session.id,'scene'))?.text
      if(opening) {
        const main=taskAgents.get(session.id)??(await ctx.sessionController.resolveAgent?.(session.id))?.agent
        if(typeof main?.steer==='function') {
          main.steer(taskPhaseMessage('story',`角色卡已完整读入并激活。现在完整展示作者原始开场，不附导入回执、不改写、不提前续写：\n${fenceCardContent(opening,'opening')}`,{openingImportId:record.importId}))
          await T.branch.put(cardWorkflowKey(job.id),{...T.branch.get(cardWorkflowKey(job.id)) as CardWorkflowJob | undefined,openingRequested:true})
        }
      }
    }
  }
  return { cardWorkflowKey, cardWorkflows, activeCardWorkflow, assertCardWorkflow, beginCardWorkflow, resumeCardWorkflows, completeCardWorkflow }
}
