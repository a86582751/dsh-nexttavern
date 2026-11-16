/** Owns Ruby's serial scheduling and derived DATA. The existing TaskHost and
 * Native child own requests, cancellation, completion and durable task jobs. */
import type {NativeInputAdmissionHookV2} from 'dsh-nexttavern-native-agent-loop'
import type {OwnedRubyTaskOwnerV1} from 'dsh-nexttavern-native-subagent'
import type {TaskJob} from './tavern-task-types.js'
import type {RubyAnalysisPromptV1,RubyAnalysisResultV1} from './roleplay-ruby-task-types.js'
import type {RubySourceCaptureV1} from './roleplay-ruby-capture.js'
import type {RubyOwnerStateV1,RubyRunV1,RubyEnablementV1,RubyOutputHeadV1,RubyPublishedOutputV1,
  RubyTaskInputCaptureV1,RubyOrderedMessagePlanV1}
  from './roleplay-ruby-owner-types.js'
import type {RubyManualRunRequestV1,RubyManualRunResultV1,RubyManualRunReceiptV1} from './roleplay-ruby-owner-types.js'
import type {RubyWorldbookV1,RubyInputDecisionV1,RubyAcceptedOutputValueV1,RubyTaskV1,
  RubyPreparedOutputV1} from './roleplay-ruby-types.js'
import type {TavernLoreDerivedSnapshotV1,TavernLoreDerivedEntryV1,TavernLoreDerivedCompletionRefV1}
  from './tavern-lore-derived.mjs'
import {ST_LORE_ENTRY_DEFAULTS_V1,ST_LORE_POSITION_V1} from './tavern-lore-fixed-profile.mjs'
import {keyOf,recordSha256,sha256} from './roleplay-data.js'
import {prepareRubyAnalysisInputV1,prepareRubyAnalysisOutputV1,prepareRubyAnalysisWindowV1,
  RUBY_INCREMENTAL_READ_POLICY_V1} from './roleplay-ruby-input.js'
import {initializeRubyCursorV1,scheduleRubyTasksV1,advanceRubyBookmarkAfterPublicationV1,
  reconcileRubyDeletionV1} from './roleplay-ruby-scheduler.js'

export const rubyOwnerStateKeyV1=(sid:string)=>keyOf(sid,'ruby-owner-v1')
export const rubyEnablementKeyV1=(sid:string)=>keyOf(sid,'ruby-enablement-v1')
const manualRunKey=(operationId:string,ordinal:number)=>recordSha256({
  schemaVersion:1,encoding:'native-ruby-manual-run-key-v1',operationId,ordinal})
const runKey=(run:Pick<RubyRunV1,'trigger'|'invocation'>)=>run.invocation
  ?manualRunKey(run.invocation.operationId,run.invocation.ordinal):recordSha256(run.trigger)
interface Dependencies {
  readonly table:{get(key:string):unknown;entries():Iterable<[string,unknown]>;
    entriesPrefix?(prefix:string):Iterable<[string,unknown]>;
    put(key:string,value:unknown):PromiseLike<unknown>}
  capture(sid:string,signal:AbortSignal,options?:{includeEmpty:true}):Promise<RubySourceCaptureV1|undefined>
  request(input:{capture:RubySourceCaptureV1;prompt:RubyAnalysisPromptV1;signal:AbortSignal;
    current():boolean;createOwner(job:TaskJob):OwnedRubyTaskOwnerV1;retry?:true}):Promise<RubyAnalysisResultV1>
  readAcceptedResult(reference:TavernLoreDerivedCompletionRefV1):RubyAnalysisResultV1|undefined
  recoverAcceptedResult?(sid:string,sourceIdentitySha256:string,promptPlanSha256:string):RubyAnalysisResultV1|undefined
  withSourceLock<T>(sid:string,work:()=>Promise<T>,signal?:AbortSignal):Promise<T>
}
const freeze=<T>(value:T):T=>{
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
function rows(messages:RubyOwnerStateV1['messages']):RubyOwnerStateV1['messages'] {
  return messages.map(({messageId,messageVersion,role})=>({messageId,messageVersion,role}))
}
function countAi(messages:readonly {readonly role:string}[]):number {
  return messages.filter(message=>message.role==='assistant').length
}
function manualMessageCut(messages:RubySourceCaptureV1['messages']) {
  let replies=0,start=0
  for(let index=messages.length-1;index>=0;index--)if(messages[index]!.role==='assistant'
    &&++replies>RUBY_INCREMENTAL_READ_POLICY_V1.maxAiReplies){start=index+1;break}
  if(!replies)start=messages.length
  return {messageCount:messages.length,windowStart:start,messages:rows(messages.slice(start))}
}
function chatBook(sid:string,state:RubyOwnerStateV1,published:(head:RubyOutputHeadV1)=>RubyPublishedOutputV1):RubyWorldbookV1 {
  const outputs=Object.values(state.outputs).map(head=>({head,data:published(head)})).filter(row=>row.data.output.entry)
  return {ref:{ownerId:sid,sourcePath:'ruby/chat-worldbook',version:recordSha256(state.outputs)},
    entries:outputs.map(row=>({ref:{ownerId:row.head.ref.ownerId,sourcePath:row.head.ref.key,version:row.head.ref.sha256},
      keys:row.data.output.entry!.keyUpdate??[row.data.output.entry!.lookupKey],resolvedContent:row.data.output.content}))}
}
function inputStillSelected(data:Pick<RubyPublishedOutputV1,'inputBasis'>,messages:RubyOwnerStateV1['messages']):boolean {
  const selected=new Map(messages.map(row=>[row.messageId,row.messageVersion]))
  return data.inputBasis.every(row=>selected.get(row.messageId)===row.messageVersion)
}
function currentOutputEntry(output:RubyPreparedOutputV1,task:RubyTaskV1|undefined) {
  if(!output.entry)return null
  // The accepted body remains immutable. Output activation is owned by the
  // currently captured author configuration, including the explicit secondary-
  // key switch that older local publications did not yet interpret.
  return {...output.entry,selective:task?.selective??false,
    secondaryKeys:task?.selective&&task.selectiveKeysEnabled?task.selectiveKeys:[]}
}
export function createRoleplayRubyOwnerV1(deps:Dependencies) {
  const disabledReason=Error('RUBY_ANALYSIS_DISABLED_BY_USER')
  const running=new Map<string,{controller:AbortController;promise:Promise<void>;operationId?:string}>()
  type SourceView={capture:RubySourceCaptureV1;users:number;owner:boolean}
  const sources=new Map<string,SourceView>(),sourceViews=new Set<SourceView>()
  const knownOutputs=new Map<string,RubyPublishedOutputV1>()
  // Owner writes replace this immutable map. Reuse its index on unchanged hot
  // status reads; cold/new durable state builds it once, without result bodies.
  const runIndexes=new WeakMap<RubyOwnerStateV1['runs'],[string,RubyRunV1][]>()
  let disposed=false
  const enabled=(sid:string)=>(deps.table.get(rubyEnablementKeyV1(sid)) as RubyEnablementV1|undefined)?.enabled!==false
  const state=(sid:string)=>deps.table.get(rubyOwnerStateKeyV1(sid)) as RubyOwnerStateV1|undefined
  const published=(head:RubyOutputHeadV1)=>{
    const value=deps.table.get(head.ref.key) as RubyPublishedOutputV1|undefined
    if(!value)throw Error('RUBY_PUBLISHED_OUTPUT_UNAVAILABLE')
    if(knownOutputs.get(head.ref.key)!==value) {
      const accepted=deps.readAcceptedResult(value.completionRef)
      if(!accepted||accepted.text.trim()!==value.output.content||recordSha256(value)!==head.ref.sha256)
        throw Error('RUBY_PUBLISHED_COMPLETION_UNAVAILABLE')
      knownOutputs.set(head.ref.key,value)
    }
    return value
  }
  const assertAlive=(sid:string,signal:AbortSignal)=>{
    signal.throwIfAborted()
    if(disposed||!enabled(sid))throw Error('RUBY_ANALYSIS_DISABLED')
  }
  function releaseSource(view:SourceView) {
    if(view.owner||view.users)return
    view.capture.release();sourceViews.delete(view)
  }
  function remember(capture:RubySourceCaptureV1) {
    const sid=capture.session.id,previous=sources.get(sid)
    if(previous?.capture===capture)return
    const next={capture,users:0,owner:true};sourceViews.add(next);sources.set(sid,next)
    // Replacing the owner's read cannot revoke another consumer's unchanged
    // frozen source. Main/dialogue release their own borrow when they finish.
    if(previous){previous.owner=false;releaseSource(previous)}
  }
  async function save(sid:string,value:RubyOwnerStateV1,assertCurrent:()=>void,signal:AbortSignal) {
    await deps.withSourceLock(sid,async()=>{
      assertCurrent()
      await deps.table.put(rubyOwnerStateKeyV1(sid),freeze({...value,revision:value.revision+1}))
    },signal)
  }
  function reconcile(capture:RubySourceCaptureV1,previous:RubyOwnerStateV1|undefined):RubyOwnerStateV1 {
    const sid=capture.session.id,messages=rows(capture.messages),count=countAi(messages)
    if(!previous||previous.sourceIdentitySha256!==capture.sourceIdentitySha256)return {
      schemaVersion:1,encoding:'native-ruby-owner-state-v1',sessionId:sid,
      sourceIdentitySha256:capture.sourceIdentitySha256,revision:previous?.revision??0,
      configuration:{status:capture.configuration.status,issues:capture.configuration.issues,
        cycleLength:capture.configuration.cycleLength},
      cursor:initializeRubyCursorV1(count),messages,outputs:{},
      // Manual operation identities are receipts of explicit actions. A new
      // Source revokes their execution rights, not the fact that they ran.
      runs:Object.fromEntries(Object.entries(previous?.runs??{}).filter(([,run])=>run.invocation))}
    const selected=new Map(messages.map(row=>[row.messageId,row])),oldAi=previous.messages.filter(row=>row.role==='assistant'),
      deleted=oldAi.flatMap((row,index)=>selected.has(row.messageId)?[]:[index+1])
    let seenAi=0,changedOrdinal:number|undefined
    for(const row of previous.messages) {
      if(row.role==='assistant')seenAi++
      if(selected.get(row.messageId)?.messageVersion!==row.messageVersion) {
        changedOrdinal=row.role==='assistant'?seenAi:seenAi+1
        break
      }
    }
    let cursor=reconcileRubyDeletionV1(previous.cursor,deleted,count,capture.configuration.cycleLength)
    if(changedOrdinal!==undefined&&!deleted.length) {
      const ordinal=changedOrdinal,round=Math.ceil(ordinal/(capture.configuration.cycleLength||1))
      cursor={...cursor,baseline:Math.min(cursor.baseline,ordinal-1),
        triggers:cursor.triggers.filter(trigger=>trigger.cycleRound<round),
        bookmarks:Object.fromEntries(Object.entries(cursor.bookmarks).map(([key,value])=>[key,value>=ordinal?0:value]))}
    }
    const kept=new Set(cursor.triggers.map(trigger=>recordSha256(trigger)))
    return {...previous,cursor,messages,outputs:Object.fromEntries(Object.entries(previous.outputs)
      .filter(([,head])=>inputStillSelected(published(head),messages))),
      runs:Object.fromEntries(Object.entries(previous.runs).filter(([key,run])=>run.invocation||kept.has(key)))}
  }
  function createChildOwner(capture:RubySourceCaptureV1,prompt:RubyAnalysisPromptV1,job:TaskJob,
    signal:AbortSignal):OwnedRubyTaskOwnerV1 {
    let active=true
    const assertCurrent=()=>{
      if(!active)throw Error('RUBY_CHILD_REVOKED')
      assertAlive(capture.session.id,signal);capture.assertCurrent()
    },preparation={schemaVersion:1 as const,namespace:'dsh-nexttavern:ruby-task-v1',
      preparationKeySha256:recordSha256({taskId:job.id,generation:job.generation}),
      credentialSha256:recordSha256({taskId:job.id,generation:job.generation,promptPlanSha256:prompt.promptPlanSha256})}
    const checkpoint:NativeInputAdmissionHookV2['checkpoint']=async(_receipt,childSignal)=>{
      childSignal.throwIfAborted();assertCurrent();return {kind:'allow'}
    },completedWork:NonNullable<NativeInputAdmissionHookV2['completedWork']>=async(receipt)=>{
      const receiptSha256=recordSha256(receipt)
      try {assertCurrent()}catch{return {kind:'blocked',receiptSha256,code:'RUBY_SOURCE_OWNER_CHANGED'}}
      // TaskHost's single job writer persists the real receipt before Native
      // sees this ACK. Core does not create a second completion ledger.
      return {kind:'settled',receiptSha256,ownerReceiptSha256:recordSha256({preparation,receiptSha256,
        snapshot:prompt.snapshot,plan:prompt.plan})}
    }
    return {preparation,snapshot:prompt.snapshot,plan:prompt.plan,captureSha256:prompt.promptPlanSha256,
      assertCurrent,checkpoint,completedWork,
      async onStop(notice){active=false;return {schemaVersion:1,stopSequence:notice.stopSequence,
        stopNonce:notice.stopNonce,kind:'acknowledged'}}}
  }
  function acceptedBatchOutputs(previous:RubyOwnerStateV1,batch:readonly RubyRunV1[]):RubyAcceptedOutputValueV1[] {
    return batch.flatMap(row=>{
      const actual=previous.runs[runKey(row)]
      if(actual?.status!=='published'||!actual.publicationRef||actual.task.outputKey)return []
      const data=published({ref:actual.publicationRef}),ref=actual.publicationRef
      return [{outputVarName:data.output.outputVarName,content:data.output.content,
        ref:{ownerId:ref.ownerId,sourcePath:ref.key,version:ref.sha256}}]
    })
  }
  async function execute(sid:string,run:RubyRunV1,signal:AbortSignal,retry?:true,borrowed?:RubySourceCaptureV1,
    batch:readonly RubyRunV1[]=[],recoveredResult?:RubyAnalysisResultV1) {
    assertAlive(sid,signal)
    const capture=borrowed??await deps.capture(sid,signal)
    if(!capture)return
    try {
      const assertCurrent=()=>{assertAlive(sid,signal);capture.assertCurrent()},previous=state(sid)!
      assertCurrent()
      if(previous.sourceIdentitySha256!==capture.sourceIdentitySha256)throw Error('RUBY_SOURCE_OWNER_CHANGED')
      if(run.invocation&&previous.runs[manualRunKey(run.invocation.operationId,0)]?.manualBatch
        ?.sourceIdentitySha256!==capture.sourceIdentitySha256)throw Error('RUBY_SOURCE_OWNER_CHANGED')
      let input:RubyTaskInputCaptureV1,plan:NonNullable<RubyRunV1['promptRef']>,
        snapshot:RubyOrderedMessagePlanV1['input'],promptPlanSha256:string
      if(retry||recoveredResult) {
        // Retry belongs to the failed job's immutable input, even when Main
        // has since accepted newer prose. Only removal/edit of that basis or
        // an actual Source change revokes it.
        if(!run.promptRef||!run.promptPlanSha256)throw Error('RUBY_RETRY_INPUT_UNAVAILABLE')
        plan=run.promptRef
        const storedPlan=deps.table.get(plan.key) as RubyOrderedMessagePlanV1|undefined
        if(!storedPlan)throw Error('RUBY_RETRY_INPUT_UNAVAILABLE')
        snapshot=storedPlan.input
        const storedInput=deps.table.get(snapshot.key) as RubyTaskInputCaptureV1|undefined
        if(!storedInput)throw Error('RUBY_RETRY_INPUT_UNAVAILABLE')
        // Editing an older message can reset the scheduling bookmark while a
        // newer capped publication remains current. Reuse that owned output as
        // the retry floor; the old failure cannot replace it after a failed rerun.
        const head=previous.outputs[run.task.outputKey||run.task.outputVarName],
          output=head?published(head).output:undefined,
          publishedOrdinal=output?.taskKey===run.task.taskKey?output.bookmark.ordinal:0
        if(Math.max(previous.cursor.bookmarks[run.task.taskKey]??0,publishedOrdinal)>storedInput.window.endOrdinal)
          throw Error('RUBY_RETRY_SUPERSEDED')
        if(!inputStillSelected({inputBasis:storedInput.window.messages},rows(capture.messages)))
          throw Error('RUBY_RETRY_INPUT_CHANGED')
        input=storedInput;promptPlanSha256=run.promptPlanSha256
      }else {
        const windowDecision=await prepareRubyAnalysisWindowV1({configuration:capture.configuration,task:run.task,
          bookmark:previous.cursor.bookmarks[run.task.taskKey]??0,messages:capture.messages,
          actualCharName:capture.actualCharName,...run.invocation?{mode:'manual' as const}:{}})
        assertCurrent()
        let decision:RubyInputDecisionV1
        if(windowDecision.kind!=='eligible')decision=windowDecision
        else {
          const books=await capture.resolveInputBooks(run.task,chatBook(sid,previous,published))
          decision=books.kind==='unsupported'?{kind:'unsupported',issues:books.issues,normalRequests:0}
            :await prepareRubyAnalysisInputV1({configuration:capture.configuration,task:run.task,trigger:run.trigger,
              bookmark:previous.cursor.bookmarks[run.task.taskKey]??0,messages:capture.messages,
              characterBook:books.characterBook,chatBook:books.chatBook,
              actualCharName:capture.actualCharName,windowDecision,
              acceptedOutputs:acceptedBatchOutputs(previous,batch)})
        }
        assertCurrent()
        if(decision.kind!=='prepared') {
          const updated={...run,status:decision.kind==='skipped'?'skipped' as const:'unsupported' as const,
            reason:decision.kind==='skipped'?decision.reason:decision.issues[0]?.code??'RUBY_INPUT_UNSUPPORTED'}
          await save(sid,{...previous,runs:{...previous.runs,[runKey(run)]:updated}},assertCurrent,signal)
          return
        }
        const prepared=decision.input
        input={schemaVersion:1,encoding:'native-ruby-task-input-capture-v1',
          configuration:prepared.configuration,taskKey:prepared.taskKey,trigger:prepared.trigger,
          window:{startOrdinal:prepared.window.startOrdinal,endOrdinal:prepared.window.endOrdinal,count:prepared.window.count,
            messages:rows(prepared.window.messages),scanTextSha256:sha256(prepared.window.scanText)},
          promptRef:prepared.promptRef,referenceRefs:prepared.referenceRefs,outputRefs:prepared.outputRefs,
          truncatedBodyChars:prepared.truncatedBodyChars,matchedKeywords:prepared.matchedKeywords,messages:prepared.messages,
          ...(capture.configuration.generation?{generation:capture.configuration.generation}:{}),
          ...(prepared.mainInputMessageIndex!==undefined?{mainInputMessageIndex:prepared.mainInputMessageIndex}:{}),
          ...run.invocation?{invocation:run.invocation}:{}}
        promptPlanSha256=recordSha256({sourceIdentitySha256:capture.sourceIdentitySha256,input})
        const prefix=keyOf(sid,`ruby-input-v1-${promptPlanSha256}`)
        snapshot={key:prefix,sha256:recordSha256(input)}
        const planData:RubyOrderedMessagePlanV1={schemaVersion:1,encoding:'native-ruby-ordered-message-plan-v1',
          sourceIdentitySha256:capture.sourceIdentitySha256,input:snapshot,messages:input.messages,
          ...(input.mainInputMessageIndex!==undefined?{mainInputMessageIndex:input.mainInputMessageIndex}:{})}
        plan={key:prefix+'-plan',sha256:recordSha256(planData)}
        await deps.withSourceLock(sid,async()=>{
          assertCurrent()
          await deps.table.put(snapshot.key,freeze(input))
          await deps.table.put(plan.key,freeze(planData))
        },signal)
      }
      assertCurrent()
      const prompt:RubyAnalysisPromptV1={schemaVersion:1,encoding:'roleplay-ruby-analysis-prompt-v1',sessionId:sid,
          sourceIdentitySha256:capture.sourceIdentitySha256,taskKey:run.task.taskKey,sourceOrdinal:run.trigger.sourceOrdinal,
          promptPlanSha256,snapshot,plan,orderedMessages:input.messages.map(message=>({role:message.role,text:message.content})),
          ...(input.generation?{generation:input.generation}:{}),
          ...(input.mainInputMessageIndex!==undefined?{mainInputMessageIndex:input.mainInputMessageIndex}:{})}
      const {reason:_previousFailure,...retainedRun}=run
      const queued:RubyRunV1={...retainedRun,status:'queued',promptRef:plan,promptPlanSha256,
        ...(run.execution?{execution:run.execution}:{}),
        ...(run.taskId?{taskId:run.taskId}:{})}
      await save(sid,{...previous,runs:{...previous.runs,[runKey(run)]:queued}},assertCurrent,signal)
      let execution=run.execution,publicationStarted=false
      try {
        const result=recoveredResult??await deps.request({capture,prompt,signal,current:()=>{
          try {assertCurrent();return true}catch{return false}
        },createOwner:job=>{
          execution={id:job.id,generation:job.generation,actualRoute:{...job.actualRoute}}
          return createChildOwner(capture,prompt,job,signal)
        },...(retry?{retry}:{})})
        assertCurrent()
        const prepared=prepareRubyAnalysisOutputV1(input,run.task,result.text)
        if(prepared.kind!=='prepared')throw Error(prepared.code)
        const previousEntry=previous.outputs[run.task.outputKey]?.ref,
          prior=previousEntry?published(previous.outputs[run.task.outputKey]!).output.entry:undefined,
          output={...prepared.output,...prepared.output.entry?{entry:{...prepared.output.entry,
            keyUpdate:prepared.output.entry.keyUpdate??prior?.keyUpdate??[prepared.output.entry.lookupKey]}}:{}},
          data:RubyPublishedOutputV1={schemaVersion:1,encoding:'native-ruby-published-output-v1',sessionId:sid,
          sourceIdentitySha256:capture.sourceIdentitySha256,inputRef:snapshot,inputBasis:rows(input.window.messages),output,
          completionRef:{schemaVersion:1,taskId:result.completion.taskId,generation:result.completion.generation,
            resultSha256:result.completion.resultSha256,
            completedWorkSha256:recordSha256(result.completion.nativeCompletedWork)}},
          sha=recordSha256(data),ref={ownerId:sid,key:keyOf(sid,`ruby-output-v1-${sha}`),sha256:sha}
        publicationStarted=true
        await deps.withSourceLock(sid,async()=>{
          assertCurrent()
          await deps.table.put(ref.key,freeze(data))
          // The hot publisher already consumed the actual Native result and
          // computed these bytes. Cold attachment performs that join once.
          knownOutputs.set(ref.key,deps.table.get(ref.key) as RubyPublishedOutputV1)
          const actual=state(sid)!
          await deps.table.put(rubyOwnerStateKeyV1(sid),freeze({...actual,revision:actual.revision+1,
            cursor:advanceRubyBookmarkAfterPublicationV1(actual.cursor,prepared.output.bookmark),
            outputs:{...actual.outputs,[run.task.outputKey||run.task.outputVarName]:{ref}},
            runs:{...actual.runs,[runKey(run)]:{...queued,status:'published',taskId:result.completion.taskId,
              execution,publicationRef:ref}}}))
        },signal)
      }catch(error) {
        // An accepted manual result is still owned by TaskHost. A lost output
        // or head ACK leaves this operation pending; replay may publish that
        // completion but must never label it a model failure and rerun it.
        if(run.invocation&&publicationStarted)throw error
        // A revoked Source/cancelled request cannot publish even a failure
        // into its successor. Ordinary failure remains an explicit retry row.
        assertCurrent()
        const actual=state(sid)!,failed:RubyRunV1={...queued,status:'failed',execution,reason:String((error as Error).message),
          ...((error as {rubyTaskId?:string}).rubyTaskId?{taskId:(error as {rubyTaskId:string}).rubyTaskId}:{})}
        await save(sid,{...actual,runs:{...actual.runs,[runKey(run)]:failed}},assertCurrent,signal)
      }
    }finally{if(!borrowed)capture.release()}
  }
  async function settle(sid:string,parentSignal:AbortSignal):Promise<void> {
    const existing=running.get(sid)
    if(existing){await existing.promise;parentSignal.throwIfAborted();return}
    if(!enabled(sid)||disposed)return
    const controller=new AbortController(),signal=AbortSignal.any([parentSignal,controller.signal])
    const promise=(async()=>{
      const capture=await deps.capture(sid,signal)
      if(!capture) {
        const previous=state(sid)
        if(previous&&Object.keys(previous.outputs).length)await deps.withSourceLock(sid,async()=>{
          assertAlive(sid,signal)
          await deps.table.put(rubyOwnerStateKeyV1(sid),freeze({...previous,revision:previous.revision+1,
            outputs:{},runs:Object.fromEntries(Object.entries(previous.runs).filter(([,run])=>run.invocation)),
            configuration:{status:'empty',issues:[],cycleLength:0},
            sourceIdentitySha256:recordSha256({producer:'none'})}))
        },signal)
        return
      }
      let due:readonly RubyRunV1[]=[]
      try {
        const assertCurrent=()=>{assertAlive(sid,signal);capture.assertCurrent()},previous=state(sid),
          reconciled=reconcile(capture,previous),scheduled=scheduleRubyTasksV1(capture.configuration,reconciled.cursor,
            countAi(capture.messages))
        due=scheduled.due.map(({task,trigger})=>({task,trigger,status:'queued' as const}))
        const runs={...reconciled.runs,...Object.fromEntries(due.map(run=>[runKey(run),run]))}
        // Interrupted queued work is visible and never starts automatically in
        // a new process. TavernTasks determines the old Native job's status.
        for(const [key,run] of Object.entries(runs))if(run.status==='queued'&&!run.invocation
          &&!due.some(row=>runKey(row)===key))runs[key]={...run,status:'failed',reason:'RUBY_INTERRUPTED_REQUIRES_MANUAL_RETRY'}
        const next={...reconciled,cursor:scheduled.cursor,runs}
        if(!previous||recordSha256(next)!==recordSha256(previous))await save(sid,next,assertCurrent,signal)
        remember(capture)
      }catch(error){capture.release();throw error}
      // The selected Source stays frozen across this serial batch. Each task
      // still reads the latest accepted owner outputs through chatBook above.
      for(let index=0;index<due.length;index++)await execute(sid,due[index]!,signal,undefined,capture,due.slice(0,index))
    })().catch(error=>{
      // All settlers share this promise. Turning off optional Ruby must let
      // their player input proceed; player Stop and disposal still propagate.
      if(error===disabledReason&&!parentSignal.aborted&&!disposed)return
      throw error
    })
    const operation={controller,promise};running.set(sid,operation)
    try{await promise}finally{if(running.get(sid)===operation)running.delete(sid)}
  }
  function confirmRun(sid:string,operationId:string):{
    kind:'completed'|'unknown';result:RubyManualRunResultV1;receipt:RubyManualRunReceiptV1
  }|undefined {
    const actual=state(sid),batch=actual?.runs[manualRunKey(operationId,0)]?.manualBatch
    if(!actual||!batch)return undefined
    const selected=batch.runKeys.map(key=>({key,run:actual.runs[key]!})),
      tasks=selected.map(({run})=>({name:run.task.displayName,ok:run.status==='published',outputKey:run.task.outputKey,
        ...run.reason?{reason:run.reason}:{}})),completed=tasks.filter(task=>task.ok).length,
      unknown=selected.some(({run})=>run.status==='queued'),
      result:RubyManualRunResultV1={ok:completed===tasks.length,completed,failed:tasks.length-completed,tasks,
        summary:`${tasks.map(task=>task.name).join(', ')} 执行${unknown?'待确认':'完毕'}（${completed}/${tasks.length} 成功）`},
      receipt:RubyManualRunReceiptV1={schemaVersion:1,encoding:'native-ruby-manual-run-receipt-v1',
        sessionId:sid,operationId,sourceIdentitySha256:batch.sourceIdentitySha256,
        runs:selected.map(({key,run})=>({key,status:run.status,
          ...run.publicationRef?{publicationRef:run.publicationRef}:{}}))}
    return {kind:unknown?'unknown':'completed',result,receipt}
  }
  function sameManualRequest(left:RubyManualRunRequestV1,right:RubyManualRunRequestV1):boolean {
    return left.operationId===right.operationId&&left.origin===right.origin&&left.kind===right.kind
      &&left.taskSpecs.length===right.taskSpecs.length&&left.taskSpecs.every((value,index)=>value===right.taskSpecs[index])
  }
  async function run(sid:string,request:RubyManualRunRequestV1,parentSignal:AbortSignal,
    callerCurrent:()=>boolean) {
    parentSignal.throwIfAborted()
    const firstKey=manualRunKey(request.operationId,0),existing=state(sid)?.runs[firstKey]?.manualBatch
    if(existing&&!sameManualRequest(existing.request,request))throw Error('RUBY_MANUAL_OPERATION_CONFLICT')
    const active=running.get(sid)
    if(active) {
      if(active.operationId!==request.operationId)throw Error('RUBY_ANALYSIS_BUSY')
      await active.promise;parentSignal.throwIfAborted()
      return confirmRun(sid,request.operationId)!
    }
    const confirmed=existing&&confirmRun(sid,request.operationId)
    if(confirmed?.kind==='completed')return confirmed
    const controller=new AbortController(),signal=AbortSignal.any([controller.signal,parentSignal]),
      assertCaller=()=>{
        assertAlive(sid,signal)
        if(!callerCurrent())throw Error('RUBY_SOURCE_OWNER_CHANGED')
      },promise=(async()=>{
        assertCaller()
        const capture=await deps.capture(sid,signal)
        if(!capture)throw Error('RUBY_CONFIGURATION_UNAVAILABLE')
        let retained=false
        try {
          const assertCurrent=()=>{assertCaller();capture.assertCurrent()}
          assertCurrent()
          let batch=state(sid)?.runs[firstKey]?.manualBatch
          if(!batch) {
            if(capture.configuration.status!=='supported-static')throw Error('RUBY_CONFIGURATION_UNSUPPORTED')
            const tasks=capture.configuration.tasks,ordinary=tasks.filter(task=>task.taskKey!=='startup'),
              find=(spec:string)=>/^\d+$/.test(spec)?ordinary.find(task=>task.id===Number(spec))
                :ordinary.find(task=>task.displayName===spec)||ordinary.find(task=>task.promptKey===spec)
                  ||ordinary.find(task=>task.outputKey===spec)
                  ||ordinary.find(task=>task.keywordScanKeywords.includes(spec))
                  ||ordinary.find(task=>task.displayName.includes(spec)),
              selected=request.kind==='all'?tasks.filter(task=>task.enabled)
                :request.kind==='startup'?tasks.filter(task=>task.taskKey==='startup'&&task.enabled)
                  :request.taskSpecs.map(spec=>spec.trim()).filter(Boolean).map(find).filter(task=>task?.enabled===true)
            if(!selected.length)throw Error('RUBY_ENABLED_TASK_UNAVAILABLE')
            const previous=reconcile(capture,state(sid)),count=countAi(capture.messages),
              due:RubyRunV1[]=selected.map((task,ordinal)=>({task:task!,status:'queued',
                trigger:{taskKey:task!.taskKey,sourceOrdinal:count,
                  cycleRound:Math.ceil(count/(capture.configuration.cycleLength||1)),
                  position:count?((count-1)%(capture.configuration.cycleLength||1))+1:0},
                invocation:{schemaVersion:1,encoding:'native-ruby-manual-invocation-v1',
                  operationId:request.operationId,origin:request.origin,ordinal}}))
            batch={schemaVersion:1,encoding:'native-ruby-manual-batch-v1',request,
              sourceIdentitySha256:capture.sourceIdentitySha256,...manualMessageCut(capture.messages),runKeys:due.map(runKey)}
            // Register the complete order and message cut before the first
            // request. A reconnect cannot turn an unregistered tail into a new
            // batch or silently pick up a later Story for its remaining tasks.
            due[0]={...due[0]!,manualBatch:batch}
            await save(sid,{...previous,runs:{...previous.runs,...Object.fromEntries(due.map(row=>[runKey(row),row]))}},
              assertCurrent,signal)
          }else {
            if(!sameManualRequest(batch.request,request))throw Error('RUBY_MANUAL_OPERATION_CONFLICT')
            if(batch.sourceIdentitySha256!==capture.sourceIdentitySha256)throw Error('RUBY_SOURCE_OWNER_CHANGED')
          }
          const cut=capture.messages.slice(0,batch.messageCount),selected=cut.slice(batch.windowStart)
          if(cut.length!==batch.messageCount||selected.length!==batch.messages.length||batch.messages.some((row,index)=>
            row.messageId!==selected[index]!.messageId||row.messageVersion!==selected[index]!.messageVersion
              ||row.role!==selected[index]!.role))throw Error('RUBY_MANUAL_INPUT_CHANGED')
          const bounded:RubySourceCaptureV1={...capture,messages:cut,
            assertCurrent,current:()=>{try{assertCurrent();return true}catch{return false}}}
          remember(capture);retained=true
          const due=batch.runKeys.map(key=>state(sid)!.runs[key]!)
          for(let index=0;index<due.length;index++) {
            const actual=state(sid)!.runs[batch.runKeys[index]!]!
            if(actual.status!=='queued')continue
            const recovered=actual.promptPlanSha256?deps.recoverAcceptedResult?.(sid,
              batch.sourceIdentitySha256,actual.promptPlanSha256):undefined
            // A durable unfinished job needs an explicit retry in the Native
            // task panel. Replaying a page command may only publish an already
            // accepted completion, never create a new paid generation.
            if(actual.promptRef&&!recovered)break
            await execute(sid,actual,signal,undefined,bounded,due.slice(0,index),recovered)
          }
        }finally{if(!retained)capture.release()}
      })(),operation={controller,promise,operationId:request.operationId}
    running.set(sid,operation)
    try{await promise;return confirmRun(sid,request.operationId)!}
    finally{if(running.get(sid)===operation)running.delete(sid)}
  }
  function snapshot(sid:string):{snapshot:TavernLoreDerivedSnapshotV1;assertCurrent():void;release():void}|undefined {
    const actual=state(sid)
    if(!enabled(sid)||!actual||!Object.keys(actual.outputs).length)return
    const view=sources.get(sid),source=view?.capture
    if(!source||!source.current()||source.sourceIdentitySha256!==actual.sourceIdentitySha256)
      throw Error('RUBY_DERIVED_SOURCE_CHANGED')
    const tasks=new Map(source.configuration.tasks.map(task=>[task.taskKey,task])),
      entries:TavernLoreDerivedEntryV1[]=Object.values(actual.outputs).flatMap((head,ordinal)=>{
      const {output,completionRef}=published(head),entry=currentOutputEntry(output,tasks.get(output.taskKey))
      if(!entry)return []
      return [{entryId:`ruby-${sha256(`${sid}:${entry.lookupKey}`)}`,ordinal,ref:head.ref,
        completionRef,
        content:output.content,contentSha256:sha256(output.content),semantic:{...ST_LORE_ENTRY_DEFAULTS_V1,
          enabled:!entry.disabled,constant:entry.constant,primaryKeys:entry.keyUpdate??[entry.lookupKey],
          secondaryKeys:entry.secondaryKeys??[],selective:entry.selective??false,
          position:ST_LORE_POSITION_V1[entry.position]??'before-character',depth:entry.depth??4,
          order:entry.order,displayIndex:ordinal,excludeRecursion:entry.excludeRecursion??false,
          preventRecursion:entry.preventRecursion??false}}]
    })
    const suppressOriginalLookupKeys=Object.values(actual.outputs).flatMap(head=>{
      const output=published(head).output
      return output.suppressCharacterKey?[output.suppressCharacterKey]:[]
    }),
      body={schemaVersion:1 as const,encoding:'owned-st-lore-derived-snapshot-v1' as const,
        ownerId:sid,entries,suppressOriginalLookupKeys},
      snapshot=freeze({...body,snapshotSha256:recordSha256(body)}),enablement=deps.table.get(rubyEnablementKeyV1(sid))
    view!.users++
    let released=false
    return {snapshot,assertCurrent(){
      if(released)throw Error('RUBY_DERIVED_CONSUMER_RELEASED')
      if(disposed||deps.table.get(rubyOwnerStateKeyV1(sid))!==actual
        ||deps.table.get(rubyEnablementKeyV1(sid))!==enablement)throw Error('RUBY_DERIVED_HEAD_CHANGED')
      source.assertCurrent()
    },release(){
      if(released)return
      released=true;view!.users--;releaseSource(view!)
    }}
  }
  /** The author's explicit read channel consumes accepted output facts without
   * scheduling or creating a chat book. Enablement only controls new analyses
   * and lore injection; it does not erase already published result bodies. */
  function readEntries(sid:string,capture:Pick<RubySourceCaptureV1,'sourceIdentitySha256'|'configuration'|'assertCurrent'>) {
    capture.assertCurrent()
    const actual=state(sid)
    if(!actual||actual.sourceIdentitySha256!==capture.sourceIdentitySha256)return []
    const tasks=new Map(capture.configuration.tasks.map(task=>[task.taskKey,task]))
    return Object.values(actual.outputs).flatMap(head=>{
      const {output}=published(head),entry=currentOutputEntry(output,tasks.get(output.taskKey))
      return entry?[{uid:`ruby-${sha256(`${sid}:${entry.lookupKey}`)}`,
        ref:{ownerId:head.ref.ownerId,sourcePath:head.ref.key,version:head.ref.sha256},
        keys:entry.keyUpdate??[entry.lookupKey],comment:'',resolvedContent:output.content,
        disabled:entry.disabled,constant:entry.constant}]:[]
    })
  }
  async function setEnabled(sid:string,value:boolean,expectedRevision:number):Promise<void> {
    await deps.withSourceLock(sid,async()=>{
      const previous=deps.table.get(rubyEnablementKeyV1(sid)) as RubyEnablementV1|undefined
      if((previous?.revision??0)!==expectedRevision)throw Error('RUBY_SETTINGS_ALREADY_UPDATED')
      await deps.table.put(rubyEnablementKeyV1(sid),{schemaVersion:1,encoding:'native-ruby-enablement-v1',
        enabled:value,revision:expectedRevision+1} satisfies RubyEnablementV1)
      if(!value)running.get(sid)?.controller.abort(disabledReason)
    })
  }
  async function rearm(sid:string,signal:AbortSignal,current:()=>boolean) {
    const active=running.get(sid)
    if(active) {
      active.controller.abort(Error('RUBY_PRESET_CHANGED'))
      try{await active.promise}catch{}
    }
    signal.throwIfAborted()
    if(!current())throw Error('RUBY_SOURCE_OWNER_CHANGED')
    const capture=await deps.capture(sid,signal,{includeEmpty:true})
    if(!capture)return
    try {
      const next=reconcile(capture,state(sid))
      // Rearming the same configuration resets scheduling, not its accepted
      // reading progress. Source changes already reset bookmarks in reconcile.
      await save(sid,{...next,cursor:{...next.cursor,baseline:countAi(capture.messages),triggers:[]}},()=>{
        signal.throwIfAborted()
        if(!current())throw Error('RUBY_SOURCE_OWNER_CHANGED')
        capture.assertCurrent()
      },signal)
      remember(capture)
    }catch(error){capture.release();throw error}
  }
  async function retry(sid:string,key:string,signal:AbortSignal):Promise<void> {
    if(running.has(sid))throw Error('RUBY_ANALYSIS_BUSY')
    const run=state(sid)?.runs[key]
    if(!run||(run.status!=='failed'&&!(run.status==='queued'&&run.promptRef)))throw Error('RUBY_FAILED_TASK_UNAVAILABLE')
    const controller=new AbortController(),combined=AbortSignal.any([signal,controller.signal]),
      promise=execute(sid,run,combined,true).catch(error=>{
        if(error===disabledReason&&!signal.aborted&&!disposed)return
        throw error
      }),operation={controller,promise}
    running.set(sid,operation)
    try{await promise}finally{if(running.get(sid)===operation)running.delete(sid)}
  }
  function effectiveness(actual:RubyOwnerStateV1,run:RubyRunV1):'current'|'superseded'|undefined {
    if(run.status!=='published')return undefined
    const head=actual.outputs[run.task.outputKey||run.task.outputVarName]?.ref
    if(!head)return 'superseded'
    if(run.publicationRef)return head.key===run.publicationRef.key&&head.sha256===run.publicationRef.sha256
      &&head.ownerId===run.publicationRef.ownerId?'current':'superseded'
    const value=deps.table.get(head.key) as RubyPublishedOutputV1|undefined
    return value?.completionRef.taskId===run.taskId?'current':'superseded'
  }
  function status(sid:string,page?:{offset:number;limit:number}) {
    const actual=state(sid),settings=deps.table.get(rubyEnablementKeyV1(sid)) as RubyEnablementV1|undefined
    let allRuns=actual?runIndexes.get(actual.runs):undefined
    if(!allRuns){allRuns=Object.entries(actual?.runs??{});if(actual)runIndexes.set(actual.runs,allRuns)}
    const total=allRuns.length,
      limit=page?Math.max(1,Math.floor(page.limit)):total,
      offset=page?Math.min(Math.max(0,Math.floor(page.offset)),Math.max(0,Math.ceil(total/limit)-1)*limit):0,
      end=total-offset,selected=page?allRuns.slice(Math.max(0,end-limit),end):allRuns
    return {enabled:settings?.enabled!==false,revision:settings?.revision??0,busy:running.has(sid),
      configurationStatus:actual?.configuration.status??'uninitialized',configurationIssues:actual?.configuration.issues??[],
      cycleBaseline:actual?.cursor.baseline??null,
      ...(page?{runPage:{offset,limit,total}}:{}),
      outputs:Object.entries(actual?.outputs??{}).map(([key,head])=>{
        const value=deps.table.get(head.ref.key) as RubyPublishedOutputV1
        return {outputKey:key,sourceOrdinal:value.output.sourceOrdinal,ownerSessionId:head.ref.ownerId,
          inherited:head.ref.ownerId!==sid,publication:'accepted' as const,effectiveness:'current' as const,
          injectionTarget:value.output.entry?'derived-worldbook' as const:'owner-output' as const}
      }),
      runs:selected.map(([key,run])=>({key,taskName:run.task.displayName,
        taskKey:run.task.taskKey,sourceOrdinal:run.trigger.sourceOrdinal,status:run.status,reason:run.reason,
        taskId:run.taskId,actualRoute:run.execution?.actualRoute,materialReady:!!run.promptRef,
        cyclePositions:run.task.cyclePositions,useReferences:run.task.useReferences,useOutputs:run.task.useOutputs,
        publication:run.status==='published'?'accepted':undefined,
        effectiveness:actual?effectiveness(actual,run):undefined,
        interrupted:run.status==='queued'&&!running.has(sid),
        injectionTarget:run.status==='published'?(run.task.outputKey?'derived-worldbook':'owner-output'):undefined})),
      affectedCapability:'Ruby动态分析与输出世界书；关闭后保留已完成记录并停止注入'}
  }
  /** Explicit detail read; status never loads every saved result body. */
  function result(sid:string,key:string) {
    const actual=state(sid),run=actual?.runs[key]
    if(!run?.publicationRef)return undefined
    const value=published({ref:run.publicationRef})
    return {taskName:run.task.displayName,sourceOrdinal:run.trigger.sourceOrdinal,
      publication:'accepted' as const,effectiveness:effectiveness(actual!,run),content:value.output.content,
      actualRoute:run.execution?.actualRoute,completionRef:value.completionRef}
  }
  async function restoreHeads(sid:string,signal:AbortSignal) {
    if(!enabled(sid)||!Object.keys(state(sid)?.outputs??{}).length)return
    const capture=await deps.capture(sid,signal)
    if(!capture||capture.sourceIdentitySha256!==state(sid)?.sourceIdentitySha256) {
      capture?.release();throw Error('RUBY_DERIVED_SOURCE_CHANGED')
    }
    remember(capture)
  }
  async function inherit(parentId:string,childId:string,nativeCut:number) {
    if(state(childId))return
    const parent=state(parentId)
    if(!parent&&!deps.table.get(rubyEnablementKeyV1(parentId)))return
    // Branch registration invokes this after its immutable Source and Native
    // seed are ready. Only outputs whose actual input versions survive the
    // child cut can be inherited; a parent's later result is never substituted.
    const controller=new AbortController(),capture=await deps.capture(childId,controller.signal)
    try {
      const settings=deps.table.get(rubyEnablementKeyV1(parentId)) as RubyEnablementV1|undefined
      if(settings)await deps.table.put(rubyEnablementKeyV1(childId),settings)
      if(!capture)return
      const messages=rows(capture.messages),count=countAi(messages),outputs:Record<string,RubyOutputHeadV1>={}
      const prefix=keyOf(parentId,'ruby-output-v1-')
      for(const [key,raw] of deps.table.entriesPrefix?.(prefix)??deps.table.entries()) {
        if(!key.startsWith(prefix))continue
        const value=raw as RubyPublishedOutputV1
        if(value.sourceIdentitySha256!==capture.sourceIdentitySha256||value.output.sourceOrdinal>count
          ||!inputStillSelected(value,messages))continue
        const head={ref:{ownerId:parentId,key,sha256:recordSha256(value)}}
        published(head)
        const outputKey=value.output.entry?.lookupKey??value.output.outputVarName,previous=outputs[outputKey]
        if(!previous||published(previous).output.sourceOrdinal<value.output.sourceOrdinal)outputs[outputKey]=head
      }
      const compatible=parent?.sourceIdentitySha256===capture.sourceIdentitySha256,
        cursor=compatible?{...parent!.cursor,baseline:count,
          triggers:parent!.cursor.triggers.filter(trigger=>trigger.sourceOrdinal<=count),
          bookmarks:Object.fromEntries(Object.values(outputs).map(head=>{
            const output=published(head).output
            return [output.taskKey,output.sourceOrdinal]
          }))}:initializeRubyCursorV1(count),
        next:RubyOwnerStateV1={schemaVersion:1,encoding:'native-ruby-owner-state-v1',sessionId:childId,
          sourceIdentitySha256:capture.sourceIdentitySha256,revision:0,
          configuration:{status:capture.configuration.status,issues:capture.configuration.issues,
            cycleLength:capture.configuration.cycleLength},cursor,messages,outputs,runs:{},
          inheritedFrom:{sessionId:parentId,stateSha256:recordSha256(parent??null),nativeCut}}
      await save(childId,next,capture.assertCurrent,controller.signal)
    }finally{capture?.release()}
  }
  function dispose(){
    disposed=true
    for(const operation of running.values())operation.controller.abort(Error('RUBY_OWNER_DISPOSED'))
    for(const view of sourceViews)view.capture.release()
    sources.clear();sourceViews.clear()
    knownOutputs.clear()
  }
  return {settle,run,confirmRun,readEntries,snapshot,setEnabled,rearm,retry,status,result,restoreHeads,inherit,dispose}
}
