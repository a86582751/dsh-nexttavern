import { keyOf, sha256, recordSha256 } from './roleplay-data.js'
import { eventsOf, surfaceEvents, surfaceEntries } from './roleplay-context.js'
import { createCharacterCluster } from './character-cluster.js'
import { createModelPolicy, createTavernTasks, selectedMainRoute, isInlinePending, taskPhaseMessage, taskHash }
  from './tavern-tasks.js'
import type { ModelRoute } from './tavern-model-policy.js'
import type {StoredTask} from './tavern-task-types.js'
import type { HostSession, HostAgent, HostSource, NativeTaskInput, TaskHostDependencies,
  AuthorDialogRequestV1,RubyAnalysisRequestV1 } from './roleplay-task-host-types.js'
import type {RubyAnalysisResultV1} from './roleplay-ruby-task-types.js'
import type {TavernLoreDerivedCompletionRefV1} from './tavern-lore-derived.mjs'
import type {AuthorChatBindingV1,AuthorDialogTaskRefV1} from './roleplay-author-chat-state-types.js'
import type {AuthorDialogResultV1,AuthorDialogPromptV1} from './roleplay-author-dialog.js'
import type {ImportSession,ImportExec,OwnedCardImportWorkflow} from './roleplay-import-types.js'
import type {CardWorkflowJob} from './roleplay-card-workflow-types.js'

export function createRoleplayTaskHost({
  T,ctx,config,taskAgents,storyBranchIsActive,statusFixedContext,taskDependenciesCurrent,
  taskInstruction,getMaintenanceJob,runStatusObligation,STATUS_SYSTEM,DECISION_SYSTEM,ORGANIZE_WORKER_SYSTEM,
  inputCurrency,inputCurrencyCurrent,inputHistoricalCurrencyCurrent,inputTaskRecoveryBlockCode,currentTaskClaim,assertCardWorkflow,advancedCard,
}:TaskHostDependencies) {
  const continuationTimers=new Set<ReturnType<typeof setTimeout>>()
  const authorDialogOwners=new Map<string,{session:HostSession;agent:HostAgent;
    prompt:AuthorDialogRequestV1['prompt'];current:()=>boolean}>()
  let disposed=false
  const rubyOwners=new Map<string,{session:HostSession;agent:HostAgent;
    prompt:RubyAnalysisRequestV1['prompt'];current:()=>boolean}>()
  ctx.effect(()=>()=>{
    disposed=true
    for(const timer of continuationTimers)clearTimeout(timer)
    continuationTimers.clear()
    authorDialogOwners.clear()
    rubyOwners.clear()
  },'roleplay: task host continuation lifetime')
  const sameModelRoute=(a: Partial<Pick<ModelRoute, 'provider' | 'model'>> | null | undefined,b: Partial<Pick<ModelRoute, 'provider' | 'model'>> | null | undefined)=>Boolean(a?.provider&&a?.model&&a.provider===b?.provider&&a.model===b?.model)
  const canonicalModelRoute=async (selection: ModelRoute)=>{if(!ctx.llm?.resolveModelInfo)return selection
    const info=await ctx.llm.resolveModelInfo(selection.provider,selection.model)
    return {...selection,provider:info.provider,model:info.id}
  }
  const executedMainRoute=(session: HostSession,agent?: HostAgent)=>canonicalModelRoute(selectedMainRoute({id:session.id,events:eventsOf(session).filter(e=>e.type==='request/header')},agent,ctx.agentDefaultModel.currentSelection()))
  const modelPolicy = createModelPolicy<HostSession, HostAgent>({table:T.branch,
    session:id=>ctx.sessions.get(id),
    legacy:config.workerProvider && config.workerModel ? {provider:config.workerProvider,model:config.workerModel} : undefined,
    main:(session,agent)=>selectedMainRoute(session,agent??taskAgents.get(session.id),ctx.agentDefaultModel.currentSelection()),
    canonicalize:canonicalModelRoute,
  })
  const taskStory = (session: HostSession) => {
    const entries=ctx.get('compaction')?.storyEvidence?.(session)??[]
    const bySeq=new Map<number, {seq: number; text: string}>()
    for(const entry of entries)bySeq.set(entry.seq,entry)
    for(const entry of surfaceEntries(session))bySeq.set(entry.seq,entry)
    return [...bySeq.values()]
  }
  const cluster=createCharacterCluster<HostSession, HostAgent>({table:T.branch,subagents:ctx.subagents,
    rootOf:session=>ctx.get('tavernConversations')?.rootOf(session.id)??session.id,
    main:(session,agent)=>selectedMainRoute(session,agent,ctx.agentDefaultModel.currentSelection()),
    isCurrent:(session,job)=>storyBranchIsActive(session)
      && Number(eventsOf(session).findLast(e=>e.type==='turn/start')?.data?.turn)===Number(job.source.turn)
      && (!job.input?.character || characterRoster(session).some(character=>character.id===job.input!.character!.id
        &&character.content===job.input!.character!.content)),
  })
  const characterCluster={...cluster,read:(session:HostSession)=>{
    const settings=cluster.read(session)
    return {...settings,enabled:settings.enabled&&(!advancedCard||advancedCard(session).state==='ready')}
  }}
  const characterRoster=(session: HostSession)=>advancedCard?advancedCard(session).characters
    :[...T.cards.entries()].filter(([key,c])=>key.startsWith(`${session.id}__`)&&c?.kind!=='user'&&c?.id!=='user'&&c?.enabled!==false)
    .map(([,c])=>({id:c.id,name:c.name??c.id,content:c.content??''}))
  const clusterLoreVisible=(session: HostSession,record: {schemaVersion?: unknown; callId?: unknown},before=Infinity)=>record.schemaVersion===1&&surfaceEvents(session).some(e=>e.type==='tool/result'&&e.seq<before&&!e.data?.error
    && record.callId&&(e.data?.message?.source?.callId??e.data?.callId)===record.callId)
  const clusterPhase=(session: HostSession)=>{
    const events=eventsOf(session)
    for(let index=events.length-1;index>=0;index--){
      const e=events[index]!
      if(e.type==='turn/start'||e.type==='turn/end')return null
      if(e.type==='user/message'&&e.data?.source?.kind==='roleplay-tasks'&&e.data.source.form==='phase')return e.data.source
    }
    return null
  }
  const clusterJob=(agent: HostAgent | null | undefined)=>{
    if(!(Number(agent?.options?.subagentDepth)>0)&&agent?.session?.header?.origin!=='subagent')return null
    const descriptor=eventsOf(agent!.session).findLast(e=>e.type==='subagent/descriptor'&&e.seq>=Number(agent!.session!.inheritedEventCount??0))
    const id=agent!.options?.tavernTaskId??/^Tavern:([a-f0-9]{64}):/.exec((descriptor?.data?.label as string | undefined)??'')?.[1]
    const job=id?T.branch.get(`tavern_job__${id}`):null
    return job?.kind==='character'?job:null
  }
  function taskSourceCurrent(session:HostSession,job:StoredTask,historical=false) {
      if(disposed||ctx.sessions.get(session.id)!==session)return false
      const source=job.source as HostSource
      if(job.kind==='author-dialog') {
        const owner=authorDialogOwners.get(job.id),declared=source.authorDialog
        return !!owner&&owner.session===session&&taskAgents.get(session.id)===owner.agent
          &&declared?.operationId===owner.prompt.operationId
          &&declared.promptPlanSha256===owner.prompt.promptSha256
          &&recordSha256(declared.binding)===recordSha256(owner.prompt.binding)&&owner.current()
      }
      if(job.kind==='ruby-analysis') {
        const owner=rubyOwners.get(job.id),declared=source.rubyAnalysis
        return !!owner&&owner.session===session&&taskAgents.get(session.id)===owner.agent
          &&declared?.sourceIdentitySha256===owner.prompt.sourceIdentitySha256
          &&declared.promptPlanSha256===owner.prompt.promptPlanSha256&&owner.current()
      }
      const currencyCurrent=historical ? inputHistoricalCurrencyCurrent : inputCurrencyCurrent
      // Reject stale prepared work before projecting the active branch's
      // history; cold task polling must not spend that scan on expired currency.
      if(source.inputPreparation && currencyCurrent?.(session,source.inputPreparation)!==true)return false
      if(!storyBranchIsActive(session))return false
      if (historical && (!source.inputPreparation || source.preparationId
        && source.preparationId!==source.inputPreparation.preparationId)) return false
      if(!historical && source.preparationId && T.branch.get(keyOf(session.id,'task-preparation'))?.id!==source.preparationId)return false
      const hash=source.hashKind==='taskHash'?(value: string)=>recordSha256(value):sha256
      const live=source.events?.length?new Map(taskStory(session).map(e=>[e.seq,hash(e.text)])):undefined
      if(source.workflowId) {
        const workflow=T.branch.get(`${source.workflowType==='card'?'tavern_cardjob__':'tavern_novel__'}${source.workflowId}`)
        if(!workflow||workflow.generation!==source.generation||['cancelled','stale'].includes(workflow.status!))return false
        if(job.executionPolicy==='independent'&&(workflow.executionPolicy!=='independent'||workflow.status==='failed'))return false
      }
      return (source.events??[]).every(e=>live!.get(e.seq)===e.hash)
        && (!source.fixedHash || source.fixedHash===recordSha256(statusFixedContext(session)))
        && taskDependenciesCurrent(T,session.id,source.dependencies)
  }
  const tavernTasks = createTavernTasks<HostSession, HostAgent>({table:T.branch,policy:modelPolicy,subagents:ctx.subagents,
    isCurrent:(session,job) => taskSourceCurrent(session,job),
    isHistoricalResultCurrent:(session,job) => taskSourceCurrent(session,job,true),
    canPublishResult:(session,job,fromNativeResult) => {
      const source=job.source as HostSource
      if(job.executionPolicy==='independent')return taskSourceCurrent(session,job)
      if(job.kind==='author-dialog'||job.kind==='ruby-analysis')return taskSourceCurrent(session,job)
      if (!source.inputPreparation) return true
      return taskSourceCurrent(session,job) || (job.status==='completed' || fromNativeResult && job.background===true
        && job.kind==='memory' && job.input?.taskStage==='background-notes') && taskSourceCurrent(session,job,true)
    },
  })
  async function requestRubyAnalysis(input:RubyAnalysisRequestV1):Promise<RubyAnalysisResultV1> {
    const {session,prompt,signal}=input
    signal?.throwIfAborted()
    if(disposed||ctx.sessions.get(session.id)!==session||prompt.sessionId!==session.id||!input.current())
      throw Error('RUBY_SOURCE_OWNER_CHANGED')
    let main=input.agent??taskAgents.get(session.id)
    if(!main)main=(await ctx.sessionController.resolveAgent?.(session.id))?.agent
    signal?.throwIfAborted()
    if(!main||disposed||ctx.sessions.get(session.id)!==session||!input.current())throw Error('RUBY_SOURCE_OWNER_CHANGED')
    taskAgents.set(session.id,main)
    const source:HostSource={rubyAnalysis:{sourceIdentitySha256:prompt.sourceIdentitySha256,
      promptPlanSha256:prompt.promptPlanSha256}},requestKey={promptPlanSha256:prompt.promptPlanSha256},
      id=taskHash({sessionId:session.id,kind:'ruby-analysis',source,input:requestKey}),
      owner={session,agent:main,prompt,current:input.current}
    rubyOwners.set(id,owner)
    let completed:StoredTask|undefined
    try {
      if(input.retry)await tavernTasks.retry(session,id)
      const text=await tavernTasks.request({session,agent:main,kind:'ruby-analysis',source,requestKey,
        input:{taskStage:'ruby-analysis',rubyTask:prompt},background:true,format:'text',tools:[],signal,
        timeoutMs:input.timeoutMs,maxTokens:input.maxTokens,
        rubyTask:{promptPlanSha256:prompt.promptPlanSha256,orderedMessages:prompt.orderedMessages,
          ...(prompt.mainInputMessageIndex===undefined?{}:{mainInputMessageIndex:prompt.mainInputMessageIndex}),
          createOwner:input.createOwner},
        validate:value=>{
          if(typeof value!=='string'||value.trim().length<2)throw Error('RUBY_ANALYSIS_RESULT_TOO_SHORT')
          return value
        },onResult:job=>{completed=job},
      })
      signal?.throwIfAborted()
      // The task owner produced this proof after actual Native completion and
      // its durable ACK. Current/cached tasks use the same producer contract.
      if(typeof text!=='string'||!completed?.rubyTaskCompletion)throw Error('RUBY_NATIVE_COMPLETED_TASK_MISSING')
      return {schemaVersion:1,encoding:'native-ruby-analysis-result-v1',authority:'consumer-data-only',
        promptPlanSha256:prompt.promptPlanSha256,text,completion:completed.rubyTaskCompletion}
    }catch(error){
      if(error instanceof Error)Object.assign(error,{rubyTaskId:id})
      throw error
    }finally{if(rubyOwners.get(id)===owner)rubyOwners.delete(id)}
  }
  async function requestAuthorDialog(input:AuthorDialogRequestV1):Promise<AuthorDialogResultV1> {
    const {session,prompt,signal}=input
    signal?.throwIfAborted()
    if(disposed||ctx.sessions.get(session.id)!==session||prompt.binding.sessionId!==session.id||!input.current())
      throw Error('AUTHOR_DIALOG_OWNER_CHANGED')
    let main=input.agent??taskAgents.get(session.id)
    if(!main)main=(await ctx.sessionController.resolveAgent?.(session.id))?.agent
    signal?.throwIfAborted()
    if(!main||disposed||ctx.sessions.get(session.id)!==session||!input.current())throw Error('AUTHOR_DIALOG_OWNER_CHANGED')
    taskAgents.set(session.id,main)
    const source:HostSource={authorDialog:{binding:prompt.binding,operationId:prompt.operationId,
      promptPlanSha256:prompt.promptSha256}},requestKey={operationId:prompt.operationId,promptPlanSha256:prompt.promptSha256},
      id=taskHash({sessionId:session.id,kind:'author-dialog',source,input:requestKey}),
      owner={session,agent:main,prompt,current:input.current}
    authorDialogOwners.set(id,owner)
    let completed:StoredTask|undefined
    try {
      const text=await tavernTasks.request({session,agent:main,kind:'author-dialog',source,
        input:{taskStage:'author-dialog-submit',authorDialog:prompt},authorDialog:prompt,requestKey,
        background:true,format:'text',tools:[],signal,timeoutMs:input.timeoutMs,maxTokens:input.maxTokens,
        validate:value=>{
          if(typeof value!=='string'||!value.trim())throw Error('AUTHOR_DIALOG_RESULT_EMPTY')
          return value
        },onResult:job=>{completed=job},
      })
      signal?.throwIfAborted()
      if(typeof text!=='string'||!completed?.generation||typeof completed.resultHash!=='string')
        throw Error('AUTHOR_DIALOG_COMPLETED_TASK_MISSING')
      const result=readCompletedAuthorDialog(session,prompt.binding,{taskId:completed.id,
        generation:completed.generation,resultSha256:completed.resultHash})
      if(!result)throw Error('AUTHOR_DIALOG_COMPLETED_TASK_MISSING')
      return result
    }finally{if(authorDialogOwners.get(id)===owner)authorDialogOwners.delete(id)}
  }
  function readCompletedRubyAnalysis(reference:TavernLoreDerivedCompletionRefV1):RubyAnalysisResultV1|undefined {
    const job=T.branch.get('tavern_job__'+reference.taskId) as StoredTask|undefined,completion=job?.rubyTaskCompletion
    if(!job||job.kind!=='ruby-analysis'||job.status!=='completed'||job.generation!==reference.generation
      ||typeof job.result!=='string'||job.resultHash!==reference.resultSha256||!completion
      ||completion.generation!==job.generation||completion.taskId!==job.id
      ||completion.childSessionId!==job.childSessionId||completion.resultSha256!==job.resultHash
      ||recordSha256(completion.nativeCompletedWork)!==reference.completedWorkSha256)return undefined
    return {schemaVersion:1,encoding:'native-ruby-analysis-result-v1',authority:'consumer-data-only',
      promptPlanSha256:completion.promptPlanSha256,text:job.result,completion}
  }
  function readCompletedAuthorDialog(session:HostSession,binding:AuthorChatBindingV1,
    reference:AuthorDialogTaskRefV1):AuthorDialogResultV1|undefined {
    if(disposed||ctx.sessions.get(session.id)!==session||binding.sessionId!==session.id)return undefined
    const job=T.branch.get('tavern_job__'+reference.taskId) as StoredTask|undefined,
      completion=job?.authorDialogCompletion,source=(job?.source as HostSource|undefined)?.authorDialog,
      frozenPrompt=job?.input?.authorDialog as AuthorDialogPromptV1|undefined
    if(job?.sessionId!==session.id||job.id!==reference.taskId||job.kind!=='author-dialog'
      ||job.status!=='completed'||job.generation!==reference.generation||job.resultHash!==reference.resultSha256
      ||typeof job.result!=='string'||!completion||completion.schemaVersion!==1
      ||completion.encoding!=='native-author-dialog-completion-v1'||completion.taskId!==job.id
      ||completion.generation!==job.generation||completion.childSessionId!==job.childSessionId
      ||completion.resultSha256!==job.resultHash||completion.promptPlanSha256!==source?.promptPlanSha256
      ||!source||recordSha256(source.binding)!==recordSha256(binding)
      ||!frozenPrompt||frozenPrompt.promptSha256!==completion.promptPlanSha256)return undefined
    return {schemaVersion:1,encoding:'native-author-dialog-result-v1',authority:'consumer-data-only',
      binding,revision:frozenPrompt.revision,operationId:source.operationId,
      promptSha256:source.promptPlanSha256,task:reference,text:job.result}
  }
  function resolveCurrentCardImport(session:ImportSession,exec:ImportExec):OwnedCardImportWorkflow|undefined {
    const actual=exec.agent as HostAgent|undefined
    if(!actual?.session)return undefined
    exec.signal?.throwIfAborted()
    const child=Number(actual.options?.subagentDepth)>0||actual.session.header?.origin==='subagent'
    let reference:{taskId?:string;generation?:string;workflowId?:string;childSessionId?:string}
    if(child) {
      const descriptor=eventsOf(actual.session).findLast(event=>event.type==='subagent/descriptor'
        &&event.seq>=Number(actual.session!.inheritedEventCount??0)),
        match=/^Tavern:([a-f0-9]{64}):([a-f0-9-]{36})$/.exec(String(descriptor?.data?.label??''))
      if(!match)return undefined
      reference={taskId:match[1]!,generation:match[2]!,childSessionId:actual.session.id}
    }else {
      const claim=currentTaskClaim?.(actual)
      if(!claim)return undefined
      reference=claim
    }
    const main=taskAgents.get(session.id)
    if(disposed||ctx.sessions.get(session.id)!==session||ctx.sessions.get(actual.session.id)!==actual.session
      ||!main||!child&&main!==actual)throw Error('CARD_IMPORT_TASK_SESSION_CHANGED')
    const registered=tavernTasks.resolveRegisteredCardImport(session,main,reference),
      source=registered.task.source as HostSource,
      job=T.branch.get('tavern_cardjob__'+source.workflowId) as CardWorkflowJob|undefined
    if(!job||job.kind!=='card-import')throw Error('CARD_IMPORT_WORKFLOW_OWNER_CHANGED')
    assertCardWorkflow(session,{workflowId:source.workflowId,workflowGeneration:source.generation,
      rawSha256:job.source.sha256})
    const assertCurrent=()=>{
      exec.signal?.throwIfAborted()
      if(disposed||ctx.sessions.get(session.id)!==session||ctx.sessions.get(actual.session!.id)!==actual.session
        ||taskAgents.get(session.id)!==main)throw Error('CARD_IMPORT_TASK_SESSION_CHANGED')
      registered.assertCurrent()
    }
    return {session,job,assertCurrent}
  }
  async function nativeTask<Result = unknown>({session,agent,system,user,promptContext,format='json',kind,signal,timeoutMs,maxTokens,validate,source:providedSource,selection,generationKey,tools:allowedTools,taskStage,background=false,executionPolicy,onResult,onAdmission}: NativeTaskInput<Result>): Promise<Result> {
    if(!session)throw new Error('酒馆任务缺少所属会话')
    const independent=executionPolicy==='independent'
    if(independent) {
      const workflow=providedSource?.workflowType==='card'&&providedSource.workflowId
        ?T.branch.get(`tavern_cardjob__${providedSource.workflowId}`):undefined
      if(!workflow||workflow.schemaVersion!==3||workflow.executionPolicy!=='independent'
        ||workflow.sessionId!==session.id||workflow.generation!==providedSource?.generation
        ||!['card-export','card-convert'].includes(String(workflow.kind))
        ||!['queued','running'].includes(String(workflow.status))||kind!=='card-export')
        throw Error('INDEPENDENT_CARD_WORKFLOW_REQUIRED')
      const owner=taskAgents.get(session.id)??(await ctx.sessionController.resolveAgent?.(session.id))?.agent
      if(!owner||owner.session!==session||agent&&agent!==owner)throw Error('INDEPENDENT_CARD_MAIN_OWNER_REQUIRED')
      agent=owner
    }
    if(!agent&&!taskAgents.has(session.id)) {
      const found=await ctx.sessionController.resolveAgent?.(session.id)
      if(found?.agent)agent=found.agent
    }
    if(agent)taskAgents.set(session.id,agent)
    const main=agent??taskAgents.get(session.id)
    const assertIdleRecovery=()=>{
      // Running Phase B owns its still-pending terminal. Only a new idle
      // recovery must respect the predecessor's durable refusal before writes.
      const code=main?.status==='idle'?inputTaskRecoveryBlockCode?.(session):undefined
      if(code)throw Error(code)
    }
    if(!independent)assertIdleRecovery()
    kind=kind??(system===STATUS_SYSTEM?'status':system===DECISION_SYSTEM?'decision':system===ORGANIZE_WORKER_SYSTEM?'novel-export':'memory')
    const compaction=kind==='memory'&&taskStage==='compaction'
    // Nonces protect prompt boundaries, but are not a changing task input.
    const requestKey={system,user:String(user).replace(/(<\/?rp-content:)[0-9a-f]{36}(>)/g,'$1NONCE$2'),generationKey}
    // A Status obligation can resume after the next input has replaced hot
    // Work. Reuse its completed task's original association; request still
    // checks the real historical result and publication contracts below.
    const completed=kind==='status'&&!providedSource?tavernTasks.list(session)
      .filter(job=>job.kind===kind&&job.status==='completed'
        &&taskHash({sessionId:session.id,kind,source:job.source,input:requestKey})===job.id)
      .sort((a,b)=>Number(a.createdAt??0)-Number(b.createdAt??0)||a.id.localeCompare(b.id))[0]:undefined
    const source=completed?completed.source:(()=>{
      // Explicit rebuilding owns its durable generation, not the completed
      // Story's hot input, which the actual management wake must replace.
      const preparation=independent?undefined:T.branch.get(keyOf(session.id,'task-preparation')),
        currency=independent||compaction||kind==='status'&&generationKey!==undefined||taskStage==='native-card-conversion'
          ?undefined:inputCurrency?.(session)
      return {...(providedSource??{events:taskStory(session).map(e=>({seq:e.seq,hash:sha256(e.text)})),
        ...(kind==='status'?{fixedHash:recordSha256(statusFixedContext(session))}:{}),
        ...(!background&&!compaction&&preparation?.sessionId===session.id&&preparation.status==='preparing'
          ?{preparationId:preparation.id}:{})}),...(currency?{inputPreparation:currency}:{})}
    })()
    // Frozen compaction input survives a new hot preparation. Its later
    // checkpoint transaction, not a completed summary alone, closes recovery.
    const consumeResult:typeof onResult=async job=>{
      if(compaction) {
        const key=keyOf(session.id,'task-memory-resume'),record=T.branch.get(key)
        if(record?.status==='pending'&&record.taskStage==='compaction')
          await T.branch.put(key,{...record,source:{taskId:job.id},updatedAt:Date.now()})
      }
      await onResult?.(job)
    }
    try {return await tavernTasks.request({session,agent:main,kind,source,input:{system,user,format,taskStage},promptContext,requestKey,format,signal,timeoutMs,maxTokens,selection,background,executionPolicy,tools:allowedTools,onResult:consumeResult,onAdmission,
      validate:validate??(value=>{
        if(format==='text'){if(typeof value!=='string'||!value.trim())throw new Error('任务文本为空');return value}
        if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('任务需要 JSON 对象')
        return value
      }),
    }) as Result}catch(error){
      if(independent)throw error
      if(isInlinePending(error))assertIdleRecovery()
      if(isInlinePending(error)&&kind==='memory'&&format==='text')await T.branch.put(keyOf(session.id,'task-memory-resume'),{schemaVersion:1,sessionId:session.id,status:'pending',taskStage:taskStage??'notes',source:{taskId:(error as {jobId?: string}).jobId},updatedAt:Date.now()})
      if(isInlinePending(error)&&!disposed&&!signal?.aborted&&main?.status==='idle'&&typeof main.steer==='function') {
        const timer=setTimeout(()=>{
          continuationTimers.delete(timer)
          try {
            const current=()=>!disposed&&!signal?.aborted&&ctx.sessions.get(session.id)===session
              &&main.session===session&&taskAgents.get(session.id)===main&&main.status==='idle'
            // A timer can outlive Native idle and Session replacement. Keep
            // old instances out of each reader and the final steer boundary.
            if(!current()||!tavernTasks.pending(session).length)return
            if(!current())return
            const message=taskPhaseMessage('management',taskInstruction(session))
            if(!current())return
            // A stopped or unresolved predecessor can become known after this
            // timer was queued. Preserve the pending job and end this wake.
            if(inputTaskRecoveryBlockCode?.(session))return
            main.steer!(message)
          }catch(steeringError) {
            try {ctx.logger?.warn?.(`roleplay: task continuation steering failed: ${String(steeringError)}`)}
            catch { /* A reporting failure must not escape an owned timer. */ }
          }
        },0)
        continuationTimers.add(timer)
        timer.unref?.()
      }
      throw error
    }
  }
  async function resumeMemoryWork(session: HostSession,agent: HostAgent,signal?: AbortSignal) {
    const key=keyOf(session.id,'task-memory-resume'),record=T.branch.get(key)
    if(record?.sessionId!==session.id||record.status!=='pending')return
    const engine=ctx.get('compaction')
    if(typeof engine?.resumeTask!=='function')return
    const taskId=(record.source as {taskId?:string}|undefined)?.taskId
    const events=eventsOf(session)
    const summary=record.taskStage==='compaction'&&taskId
      ?events.findLast(event=>event.type==='compaction/summary'
        &&event.data?.taskReceipt?.schemaVersion===1&&event.data.taskReceipt.taskId===taskId)
      :undefined
    const committed=summary&&events.some(event=>event.type==='compaction/end'
      &&event.data?.compactionId===summary.data?.compactionId&&!event.data?.error)
    if(!committed)await engine.resumeTask(agent,signal,record.taskStage)
    await T.branch.put(key,{...T.branch.get(key),status:'completed',completedAt:Date.now()})
    const maintenance=getMaintenanceJob(session.id)
    if(maintenance?.kind==='notes'&&maintenance.state!=='completed'){maintenance.state='completed';maintenance.error=null;maintenance.finishedAt=Date.now()}
  }
  async function resumeStatusMaintenance(session: HostSession,agent: HostAgent) {
    const job=getMaintenanceJob(session.id)
    if(job?.kind!=='status-rebuild'||job.state!=='waiting-main')return
    const event=eventsOf(session).find(e=>e.seq===job.atSeq)
    const result=await runStatusObligation(session,event,'maintenance-resume',{agent})
    if(result?.state==='waiting-main')throw Object.assign(new Error('状态生成等待主循环'),{code:'TAVERN_INLINE_PENDING'})
    if(result?.state==='completed'&&result.publicationState==='published'){job.state='completed';job.error=null;job.finishedAt=Date.now()}
    else {job.state='failed';job.error='状态结果尚未发布，可重试'}
  }
  return {sameModelRoute, canonicalModelRoute, executedMainRoute, modelPolicy, taskStory, characterCluster, characterRoster,
    clusterLoreVisible, clusterPhase, clusterJob, tavernTasks, resolveCurrentCardImport, nativeTask,
    requestAuthorDialog,readCompletedAuthorDialog,requestRubyAnalysis,readCompletedRubyAnalysis,resumeMemoryWork,resumeStatusMaintenance}
}
