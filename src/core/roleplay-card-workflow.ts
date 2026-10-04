import { randomUUID } from 'node:crypto'
import { keyOf, cloneRecord, sha256, recordSha256 } from './roleplay-data.js'
import { readCardSource, fenceCardContent } from './tavern-card.js'
import { isInlinePending, taskPhaseMessage } from './tavern-tasks.js'
import { assertWorkspaceSession, type ContextSession } from './roleplay-context.js'
import type { CardWorkflowDependencies, CardWorkflowSession, CardWorkflowAgent, CardWorkflowRecord, CardWorkflowJob, CardWorkflowResult } from './roleplay-card-workflow-types.js'

export function createCardWorkflows(deps: CardWorkflowDependencies) {
  const { T, storyBranchIsActive, modelPolicy, statusFixedContext, nativeTask, driveStructuredImport,
    CARD_CLASSIFICATION_GUIDE, archiveImported, libraryFor, resourceName, tavernTasks, taskAgents, ctx } = deps
  const cardWorkflowKey=(id: string)=>`tavern_cardjob__${id}`
  // UI requests and the main loop can resume the same durable job at once.
  // Keep one in-process driver per generation; a restart still resumes from storage.
  const running=new Map<string,Promise<void>>()
  const starting=new Map<string,Promise<void>>()
  // Failed terminal publication keeps its queued storage anchor. This local
  // fence prevents dispatch of only that generation; it is not restart proof.
  const failedStartGenerations=new Set<string>()
  const generationKey=(job:CardWorkflowJob)=>`${job.id}:${job.generation}`
  const assertStartPublished=(job:CardWorkflowJob)=>{
    if(failedStartGenerations.has(generationKey(job)))throw Error('CARD_EXPORT_START_FAILURE_UNPUBLISHED')
  }
  const withToolCallIdentity=(job:CardWorkflowJob,toolCallId?:string):string[]|undefined=>{
    if(!toolCallId)return job.toolCallIds
    if(job.toolCallIds?.includes(toolCallId))return job.toolCallIds
    if((job.toolCallIds?.length??0)>=16)throw new Error('当前导入已关联过多工具调用，请等待原调用完成后重试')
    return [...(job.toolCallIds??[]),toolCallId]
  }
  async function withStartLock<T>(sessionId:string,work:()=>Promise<T>):Promise<T> {
    const previous=starting.get(sessionId)??Promise.resolve()
    let release!:()=>void
    const gate=new Promise<void>(resolve=>{release=resolve})
    const queued=previous.catch(()=>{}).then(()=>gate)
    starting.set(sessionId,queued)
    await previous.catch(()=>{})
    try{return await work()}finally{
      release()
      if(starting.get(sessionId)===queued)starting.delete(sessionId)
    }
  }
  const cardWorkflows=(session: {id: string})=>[...T.branch.entries()].filter(([k,j])=>k.startsWith('tavern_cardjob__')&&(j as CardWorkflowJob).sessionId===session.id).map(([,j])=>cloneRecord(j as CardWorkflowJob))
  const activeCardWorkflow=(session: {id: string})=>cardWorkflows(session).find(j=>['queued','running','waiting-main'].includes(j.status))
  function assertCardWorkflow(session: CardWorkflowSession,record: CardWorkflowRecord | null | undefined) {
    if(!record?.workflowId)return
    const job=T.branch.get(cardWorkflowKey(record.workflowId)) as CardWorkflowJob | undefined
    if(!job||job.sessionId!==session.id||['cancelled','stale','failed'].includes(job.status)||record.workflowGeneration!==job.generation||!storyBranchIsActive(session))throw new Error('角色卡任务授权已取消或来源已失效')
    assertStartPublished(job)
    if(job.kind==='card-import'&&record.rawSha256!==job.source.sha256)throw new Error('角色卡任务来源哈希不匹配')
  }
  async function beginCardWorkflow(session: CardWorkflowSession,kind: string,sourceFile: unknown,
    agent?: CardWorkflowAgent,clientRequestId?: string,toolCallId?: string) {
    return withStartLock(session.id,async()=>{
    if(!['card-import','card-export'].includes(kind))throw new Error('角色卡任务类型无效')
    if(clientRequestId!==undefined && (typeof clientRequestId!=='string' || kind!=='card-import'
      || !/^[A-Za-z0-9_-]{1,128}$/.test(clientRequestId)))throw new Error('角色卡请求 requestId 无效')
    if(toolCallId!==undefined&&(typeof toolCallId!=='string'||kind!=='card-import'
      ||toolCallId.length<1||toolCallId.length>256))throw new Error('角色卡工具调用身份无效')
    const source=kind==='card-import'?readCardSource(session.header.cwd,sourceFile):null
    const exportSource=kind==='card-export'&&deps.captureExportStartSource
      ?deps.captureExportStartSource(session):undefined
    if(kind==='card-export'&&deps.captureExportStartSource) {
      if(!exportSource||typeof exportSource.sha256!=='string'||!/^[a-f0-9]{64}$/.test(exportSource.sha256)
        ||typeof exportSource.assertCurrent!=='function')throw new Error('角色卡导出启动来源无效')
      exportSource.assertCurrent()
    }
    const sourceHash=source?sha256(source.bytes):exportSource?.sha256??recordSha256(statusFixedContext(session))
    if(clientRequestId||toolCallId){
      const jobs=cardWorkflows(session)
      const byRequest=clientRequestId?jobs.filter(job=>job.clientRequestId===clientRequestId):[]
      const byCall=toolCallId?jobs.filter(job=>job.toolCallIds?.includes(toolCallId)):[]
      const matches=[...new Map([...byRequest,...byCall].map(job=>[job.id,job])).values()]
      if(matches.length>1)throw new Error('角色卡请求身份重复，拒绝选择不确定任务')
      const previous=matches[0]
      if(previous){
        if(previous.kind!==kind || previous.source.sourceFile!==source?.sourcePath
          || previous.source.sha256!==sourceHash)throw new Error('角色卡 requestId 已绑定不同来源')
        if(clientRequestId&&previous.clientRequestId&&previous.clientRequestId!==clientRequestId)
          throw new Error('角色卡 requestId 与工具调用身份指向不同任务')
        const toolCallIds=withToolCallIdentity(previous,toolCallId)
        const next={...previous,
          ...(clientRequestId?{clientRequestId}:{}),
          ...(toolCallIds?{toolCallIds}:{})}
        if((toolCallIds?.length??0)!==(previous.toolCallIds?.length??0)
          ||(!previous.clientRequestId&&Boolean(clientRequestId))) {
          await T.branch.put(cardWorkflowKey(previous.id),next)
        }
        return next
      }
    }
    const active=activeCardWorkflow(session)
    if(active&&active.kind!==kind)throw new Error('当前会话已有另一项角色卡任务，请先完成或取消')
    if(active){
      if(source&&(active.source.sha256!==sourceHash
        || active.source.sourceFile!==source.sourcePath))throw new Error('当前会话正在读取另一张卡，请先完成或取消')
      if(clientRequestId&&active.clientRequestId&&active.clientRequestId!==clientRequestId)
        throw new Error('当前会话已有不同 requestId 的导入任务，请查看现有 job')
      const next={...active,
        ...(clientRequestId?{clientRequestId}:{}),
        ...(toolCallId?{toolCallIds:withToolCallIdentity(active,toolCallId)}:{})}
      if((next.toolCallIds?.length??0)!==(active.toolCallIds?.length??0)
        ||(!active.clientRequestId&&Boolean(clientRequestId))) {
        await T.branch.put(cardWorkflowKey(active.id),next)
      }
      return next
    }
    const deterministic = kind === 'card-import' && source !== null && ['.png', '.json'].includes(source.extension)
    const selection=deterministic?undefined:await modelPolicy.resolve(session,kind,agent)
    exportSource?.assertCurrent()
    const id=randomUUID()
    const job={schemaVersion:1,id,kind,sessionId:session.id,branchId:session.id,generation:randomUUID(),
      ...(selection?{selection,actualRoute:selection.actualRoute}:{}),execution:deterministic?'deterministic':selection!.execution,
      status:'queued',createdAt:Date.now(),progress:{done:0,total:1},
      ...(clientRequestId?{clientRequestId}:{}),
      ...(toolCallId?{toolCallIds:[toolCallId]}:{}),
      source:{sourceFile:source?.sourcePath??null,sha256:sourceHash}}
    exportSource?.assertCurrent()
    await T.branch.put(cardWorkflowKey(id),job)
    try {exportSource?.assertCurrent()}catch(error) {
      // An awaited write may commit after startup DATA/scope changes. Retain
      // that exact job as a terminal anchor before any driver can see it ready.
      const live=T.branch.get(cardWorkflowKey(id)) as CardWorkflowJob | undefined
      if(live?.generation===job.generation&&live.status==='queued') {
        try {
          await T.branch.put(cardWorkflowKey(id),{...live,status:'stale',updatedAt:Date.now(),
            error:error instanceof Error?error.message:String(error)})
        }catch(writeError) {
          failedStartGenerations.add(generationKey(live))
          throw writeError
        }
      }
      throw error
    }
    return job
    })
  }
  async function resumeCardWorkflows(session: ContextSession,agent?: CardWorkflowAgent,signal?: AbortSignal) {
    // A visible queued row is not dispatchable until its starter's post-write
    // scope check settles and publishes any necessary terminal failure anchor.
    const start=starting.get(session.id)
    if(start)await start
    const job=activeCardWorkflow(session)
    if(!job)return
    assertStartPublished(job)
    const runKey=generationKey(job)
    const existing=running.get(runKey)
    if(existing)return existing
    const work=runCardWorkflow(session,job,agent,signal)
    running.set(runKey,work)
    try {await work} finally {if(running.get(runKey)===work)running.delete(runKey)}
  }
  async function runCardWorkflow(session: ContextSession,job: CardWorkflowJob,agent?: CardWorkflowAgent,signal?: AbortSignal) {
    assertWorkspaceSession(session)
    const source={workflowId:job.id,workflowType:'card',generation:job.generation,events:[]}
    try {
      await T.branch.put(cardWorkflowKey(job.id),{...job,status:'running'})
      const result=job.execution==='deterministic'
        ? await driveStructuredImport(session as CardWorkflowSession,job,agent,signal)
        : await nativeTask({session,agent,kind:job.kind,format:'workflow',selection:job.selection!,source,signal,timeoutMs:600000,
        tools:job.kind==='card-import'?['rp_card_import_begin','rp_card_import_chunk','rp_card_import_stage','rp_card_import_finalize']:['rp_card_export_begin','rp_card_export_chunk','rp_card_export_finalize'],
        system:job.kind==='card-import'
          ?'使用原生读卡工具处理需要语义分类的 Markdown/TXT：rp_card_import_begin → 连续rp_card_import_chunk全文审阅 → rp_card_import_stage完整分类 → rp_card_import_finalize激活。只处理任务指定文件，失败不能绕过或改源文件，不续写剧情。已存在当前任务的导入记录时续做该记录，不重新开始。完成后提交任务结果。\n'+CARD_CLASSIFICATION_GUIDE
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
      if(live?.generation===job.generation&&!['cancelled','failed'].includes(live.status))
        await T.branch.put(cardWorkflowKey(job.id),{...live,status:'completed',result,resourceId:result.resourceId,
          progress:{done:1,total:1},completedAt:Date.now()})
    }catch(error){
      const live=T.branch.get(cardWorkflowKey(job.id)) as CardWorkflowJob | undefined
      if(live?.generation===job.generation&&live.status!=='cancelled')await T.branch.put(cardWorkflowKey(job.id),{
        ...live,status:isInlinePending(error)?'waiting-main':'failed',
        error:isInlinePending(error)?null:String((error as Error).message),
        ...(isInlinePending(error)?{}:{failedAt:Date.now()}),
      })
      if(isInlinePending(error))throw error
    }
  }
  async function completeCardWorkflow(session: CardWorkflowSession,record: CardWorkflowRecord,result: CardWorkflowResult) {
    if(!record.workflowId)return
    const job=T.branch.get(cardWorkflowKey(record.workflowId)) as CardWorkflowJob | undefined
    if(!job||job.sessionId!==session.id||['cancelled','stale','failed'].includes(job.status))throw new Error('角色卡任务已失效')
    assertStartPublished(job)
    if(job.kind==='card-import'?(!record.importId||record.status!=='active'||record.rawSha256!==job.source.sha256):!record.exportId)throw new Error('角色卡任务与完成结果不匹配')
    if(!result.resourceId){await T.branch.put(cardWorkflowKey(job.id),{...job,status:'failed',error:'设定已保存，资源入库待重试'});return}
    for(const task of tavernTasks.pending(session).filter(t=>(t.source as {workflowId?: string} | undefined)?.workflowId===job.id)) {
      try {await tavernTasks.submit({session,id:task.id,generation:task.generation!,value:{finished:true}})}catch{}
    }
    await T.branch.put(cardWorkflowKey(job.id),{...job,status:'completed',result,resourceId:result.resourceId,progress:{done:1,total:1},completedAt:Date.now()})
    // Structured cards wait for an explicit, durable native opening choice.
    // Markdown keeps its established model-led opening until that path migrates.
    if(job.kind==='card-import'&&job.execution!=='deterministic'&&!job.openingRequested) {
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
