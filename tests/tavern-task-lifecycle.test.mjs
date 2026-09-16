import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import { createModelPolicy, createTavernTasks, InlinePending, taskHash, nativeTaskOutputBudget } from '../src/core/tavern-tasks.js'
import { createRoleplayTaskHost } from '../src/core/roleplay-task-host.js'
import { sha256, recordSha256 } from '../src/core/roleplay-data.js'
import { fenceCardContent } from '../src/core/tavern-card.js'

class Table extends Map {
  async put(key, value) { this.set(key, structuredClone(value)) }
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
const drain = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)) }
const session = { id: 'lifecycle-session', header: {}, events: [] }
const agent = { session, options: { provider: 'main-provider', model: 'main-model', reasoningEffort: 'high' } }
assert.equal(nativeTaskOutputBudget({provider:'google',model:'gemini-3.8-flash',reasoningEffort:'medium'},6800),16384)
assert.equal(nativeTaskOutputBudget({provider:'google',model:'gemini-3.8-flash',reasoningEffort:'minimal'},6800),6800)
assert.equal(nativeTaskOutputBudget({provider:'fixture',model:'main',reasoningEffort:'high'},6800),6800)
const source = { seq: 1, hash: 'source-a' }
const makeRequest = (requestKey, validate = value => value) => ({
  session, agent, kind: 'status', requestKey, source, input: { frozen: requestKey }, validate,
})
const nonInlinePolicy = {
  async resolve() {
    return {
      execution: 'spawn',
      actualRoute: { provider: 'special-provider', model: 'special-model', reasoningEffort: 'low' },
      main: { provider: 'main-provider', model: 'main-model', reasoningEffort: 'high' },
      policyRevision: { global: 1, session: 0 },
    }
  },
}
const childResult = value => ({ stopReason: 'completed', output: [{ type: 'text', text: JSON.stringify(value) }] })

// Real scheduler boundary: different task wrappers must not duplicate their
// common nested prose/author context in the initial shared child request.
{
  const table=new Table(),requests=[],shared='COMMON-STORY-AND-CORE '.repeat(100)
  const engine=createTavernTasks({table,policy:nonInlinePolicy,subagents:{async start(_mode,request){
    requests.push(request)
    const payload=JSON.parse(request.prompt[0].text)
    return {id:'shared-ui-child',result:Promise.resolve(childResult({results:payload.tasks.map(task=>({taskId:task.taskId,generation:task.generation,value:{ok:task.kind}}))})),dispose(){}}
  }}})
  const release=engine.holdBatch(session)
  const pending=['status','decision'].map(kind=>{
    const promptContext={schemaVersion:1,before:kind+' instructions\n',context:kind==='status'?{selectedStory:[{text:shared}],previousStatus:'ONLY-STATUS'}:{narrative:shared,limits:'ONLY-DECISION'},after:'\nfinish '+kind,domain:'status'}
    const user=promptContext.before+fenceCardContent(JSON.stringify(promptContext.context),'status',{stable:true})+promptContext.after
    return engine.request({...makeRequest('structured-'+kind),kind,promptContext,input:{system:kind,user,format:'json'}})
  })
  await drain();assert.equal(requests.length,0);release()
  await Promise.all(pending)
  assert.equal(requests.length,1,'both task contracts are delivered at child startup')
  const text=requests[0].prompt[0].text
  assert.equal(text.split(shared).length-1,1,'nested common prose must appear once in the actual child request')
  assert.ok(text.includes('ONLY-STATUS')&&text.includes('ONLY-DECISION'))
  assert.equal(engine.list(session).length,2)
  assert.ok(engine.list(session).every(job=>job.input.user.includes(shared)),'audit/retry sources remain complete')
  // Durable optional v1 transport metadata survives hydration; damaged hints
  // cannot replace the independently saved full source or hide the task.
  const saved=engine.list(session)[0],savedKey=`tavern_job__${saved.id}`
  assert.equal(saved.promptContext.schemaVersion,1)
  const restored=createTavernTasks({table,policy:nonInlinePolicy})
  assert.deepEqual(restored.list(session).find(job=>job.id===saved.id).promptContext,saved.promptContext)
  await table.put(savedKey,{...saved,promptContext:{schemaVersion:99,context:'DAMAGED-HINT'}})
  assert.deepEqual(restored.list(session).find(job=>job.id===saved.id).input,saved.input)
}

// Concurrent callers for one request share one native child and one table record.
{
  const table = new Table(), pending = deferred(), children = []
  let spawns = 0, disposals = 0
  const subagents = { async start(_name, request) { spawns++; children.push({ request }); return { id: 'child-concurrent', result: pending.promise, async dispose() { disposals++ } } } }
  const engine = createTavernTasks({ table, policy: nonInlinePolicy, subagents })
  const first = engine.request(makeRequest('concurrent'))
  const second = engine.request(makeRequest('concurrent'))
  await drain()
  assert.equal(spawns, 1)
  pending.resolve(childResult({ ok: 'one-child' }))
  assert.deepEqual(await first, { ok: 'one-child' })
  assert.deepEqual(await second, { ok: 'one-child' })
  assert.equal(disposals, 1)
  assert.equal(engine.list(session)[0].status, 'completed')
}

// A cancelled native child arriving late cannot submit and cannot create a fake inline task.
{
  const table = new Table(), pending = deferred(), children = []
  let spawns = 0, disposals = 0
  const subagents = { async start(_name, request) { spawns++; children.push({ request }); return { id: 'child-late', result: pending.promise, async dispose() { disposals++ } } } }
  const engine = createTavernTasks({ table, policy: nonInlinePolicy, subagents })
  const requestPromise = engine.request(makeRequest('cancel-late'))
  await drain()
  assert.equal(spawns, 1)
  const job = engine.list(session)[0]
  await engine.cancel(session, job.id)
  pending.resolve(childResult({ should: 'not-submit' }))
  await assert.rejects(requestPromise)
  const after = engine.list(session).find(item => item.id === job.id)
  assert.equal(after.status, 'cancelled')
  assert.equal(engine.pending(session).length, 0)
  assert.equal(disposals, 1)
}

// Retry creates a new generation; the old promise cannot complete the retried job.
{
  const table = new Table(), oldChild = deferred(), newChild = deferred(), children = []
  let spawns = 0, disposals = 0
  const subagents = { async start(_name, request) { spawns++; children.push(request); const wait = spawns === 1 ? oldChild : newChild; return { id: `child-${spawns}`, result: wait.promise, async dispose() { disposals++ } } } }
  const engine = createTavernTasks({ table, policy: nonInlinePolicy, subagents })
  const oldPromise = engine.request(makeRequest('retry-generation'))
  oldPromise.catch(() => {})
  await drain()
  const oldJob = engine.list(session)[0]
  const retried = await engine.retry(session, oldJob.id)
  assert.notEqual(retried.generation, oldJob.generation)
  const newPromise = engine.request(makeRequest('retry-generation'))
  oldChild.resolve(childResult({ result: 'old' }))
  await drain()
  assert.equal(spawns, 2)
  newChild.resolve(childResult({ result: 'new' }))
  await assert.rejects(oldPromise)
  assert.deepEqual(await newPromise, { result: 'new' })
  assert.equal(engine.list(session)[0].result.result, 'new')
  assert.equal(disposals, 2)
}

// A persisted running spawn seen by a rebuilt engine falls back inline once and never respawns.
{
  const table = new Table(), restartRequest = makeRequest('restart'), restartId = taskHash({ sessionId: session.id, kind: restartRequest.kind, source: restartRequest.source, input: restartRequest.requestKey ?? restartRequest.input }), stored = {
    schemaVersion: 1, id: restartId, sessionId: session.id, branchId: session.id,
    kind: 'status', source, sourceHash: 'x', input: { frozen: 'restart' }, execution: 'spawn',
    actualRoute: { provider: 'special-provider', model: 'special-model' }, main: { provider: 'main-provider', model: 'main-model' },
    status: 'running', generation: 'persisted-generation', progress: { done: 0, total: 1 },
  }
  await table.put(`tavern_job__${restartId}`, stored)
  let spawns = 0
  const engine = createTavernTasks({ table, policy: nonInlinePolicy, subagents: { async start() { spawns++; throw new Error('must not respawn') } } })
  await assert.rejects(engine.request(restartRequest), InlinePending)
  assert.equal(spawns, 0)
  const job = engine.list(session)[0]
  assert.equal(job.execution, 'inline')
  assert.equal(job.fallback.reason, 'runtime-restart')
  assert.equal(engine.pending(session).length, 1)
}

// Same provider/model with a different reasoning effort stays inline and keeps the main route.
{
  const table = new Table(), sessions = new Map([[session.id, session]])
  const main = { provider: 'provider', model: 'model', reasoningEffort: 'high' }
  const policy = createModelPolicy({ table, main: async () => main, session: async id => sessions.get(id) })
  await policy.save(session, 'global', { allMain: false, routes: { status: { provider: 'provider', model: 'model', reasoningEffort: 'low' } } })
  const selection = await policy.resolve(session, 'status')
  assert.equal(selection.execution, 'inline')
  assert.deepEqual(selection.actualRoute, main)
  let spawns = 0
  const engine = createTavernTasks({ table, policy, subagents: { async start() { spawns++; throw new Error('inline must not spawn') } } })
  await assert.rejects(engine.request({ ...makeRequest('inline-reasoning'), agent: { session, options: main } }), InlinePending)
  assert.equal(spawns, 0)
  assert.deepEqual(engine.list(session)[0].actualRoute, main)
}

// A provider ignoring cancellation must not hold the parent loop indefinitely.
{
  const table=new Table(), never=new Promise(()=>{})
  const engine=createTavernTasks({table,policy:nonInlinePolicy,subagents:{async start(){return {id:'stuck',result:never,dispose:()=>never}}}})
  const work=engine.request(makeRequest('stuck-provider'));work.catch(()=>{})
  await drain();await engine.cancel(session,engine.list(session)[0].id)
  let timer
  const outcome=await Promise.race([work.then(()=> 'completed',()=> 'cancelled'),new Promise(resolve=>{timer=setTimeout(()=>resolve('hung'),80)})])
  clearTimeout(timer)
  assert.equal(outcome,'cancelled','cancel must release parent even when child/result/dispose never settles')
}
// Adjacent compatible non-main jobs share one child. Status and decision are
// sent first, and one failed member does not discard a sibling's result.
{
  const table=new Table(), children=[]
  const engine=createTavernTasks({table,policy:nonInlinePolicy,subagents:{async start(_name,request){
    children.push(request)
    const tasks=JSON.parse(request.prompt[0].text).tasks
    assert.deepEqual(tasks.map(task=>task.kind),['status','status','decision'])
    return {id:'batched-child',result:Promise.resolve({stopReason:'completed',structured:{results:tasks.filter(task=>task.marker!=='failed').map(task=>({taskId:task.taskId,generation:task.generation,value:{ok:task.kind}})),failures:tasks.filter(task=>task.marker==='failed').map(task=>({taskId:task.taskId,generation:task.generation,failure:{code:'TASK_TIMEOUT'}}))}}),async dispose(){}}
  }}})
  const asks=['failed','decision','status'].map(marker=>engine.request({session,agent,kind:marker==='failed'?'status':marker,source:{seq:marker},input:{marker},requestKey:marker,validate:value=>value}))
  const settled=await Promise.allSettled(asks)
  assert.equal(children.length,1,'one adjacent compatible batch gets one native child')
  assert.deepEqual(settled.filter(item=>item.status==='fulfilled').map(item=>item.value).sort((a,b)=>a.ok.localeCompare(b.ok)),[{ok:'decision'},{ok:'status'}])
  assert.equal(settled.filter(item=>item.status==='rejected').length,1)
  const failed=engine.list(session).find(job=>job.input.marker==='failed')
  assert.equal(failed.status,'queued')
  assert.equal(failed.execution,'inline')
  assert.equal(failed.fallback.failure.category,'timeout')
}
// A later ready task never queues behind an unresolved older native batch.
{
  const table=new Table(), first=deferred()
  let spawns=0
  const engine=createTavernTasks({table,policy:nonInlinePolicy,subagents:{async start(){
    spawns++
    return {id:`overlap-${spawns}`,result:spawns===1?first.promise:Promise.resolve(childResult({ok:'later'})),async dispose(){}}
  }}})
  const older=engine.request(makeRequest('older'))
  await drain()
  const later=engine.request(makeRequest('later'))
  await drain()
  assert.equal(spawns,2,'later admission dispatches while an older child remains unresolved')
  first.resolve(childResult({ok:'older'}))
  assert.deepEqual(await older,{ok:'older'})
  assert.deepEqual(await later,{ok:'later'})
}
// A single batched task can obey the envelope contract through ordinary text
// output; structured output is not guaranteed by the native provider.
{
  const engine=createTavernTasks({table:new Table(),policy:nonInlinePolicy,subagents:{async start(_name,request){
    const prompt=JSON.parse(request.prompt[0].text),task=prompt.tasks?.[0]??prompt
    return {id:'text-envelope',result:Promise.resolve(childResult({results:[{taskId:task.taskId,generation:task.generation,value:{ok:true}}]})),async dispose(){}}
  }}})
  assert.deepEqual(await engine.request(makeRequest('text-envelope')), {ok:true})
}
// Re-reading a running task is attachment, not evidence of a process restart.
{
  const table=new Table(),wait=deferred();let starts=0
  const engine=createTavernTasks({table,policy:nonInlinePolicy,subagents:{async start(){starts++;return {id:'attached',result:wait.promise,async dispose(){}}}}})
  const spec=makeRequest('attach-running'),first=engine.request(spec)
  await drain()
  const second=engine.request(spec)
  await drain()
  assert.equal(engine.list(session)[0].execution,'spawn')
  wait.resolve(childResult({ok:true}))
  assert.deepEqual(await Promise.all([first,second]),[{ok:true},{ok:true}])
  assert.equal(starts,1)
}
// One shared model response cannot deliver its JSON envelope in two pieces.
// Its first deadline transfers every unfinished member together, once.
{
  const table=new Table(),wait=deferred();let request
  const engine=createTavernTasks({table,policy:nonInlinePolicy,subagents:{async start(_name,value){request=value;return {id:'timeout-shared',result:wait.promise,async dispose(){}}}}})
  const first=engine.request({...makeRequest('timeout-status'),timeoutMs:1000}).catch(error=>error)
  const second=engine.request({...makeRequest('timeout-decision'),kind:'decision',timeoutMs:10000}).catch(error=>error)
  await drain()
  const tasks=JSON.parse(request.prompt[0].text).tasks
  assert.equal(tasks.length,2)
  assert.ok(await first instanceof InlinePending)
  assert.equal(request.signal.aborted,true,'expired shared response is stopped instead of waiting for a second deadline')
  const timedOut=engine.list(session).find(job=>job.kind==='status')
  assert.equal(timedOut.status,'queued')
  assert.equal(timedOut.execution,'inline')
  assert.equal(timedOut.fallback.failure.category,'timeout')
  assert.equal(timedOut.fallback.failure.code,'SHARED_CALL_TIMEOUT')
  assert.notEqual(timedOut.generation,tasks[0].generation)
  wait.resolve(childResult({results:tasks.map(task=>({taskId:task.taskId,generation:task.generation,value:{kind:task.kind}}))}))
  assert.ok(await second instanceof InlinePending)
  await drain()
  assert.equal(engine.list(session).find(job=>job.kind==='status').status,'queued','late child cannot settle a timed-out member')
  assert.equal(engine.list(session).find(job=>job.kind==='decision').status,'queued','both missing results enter the same main-loop admission')
}
for(const action of ['cancel','retry','invalidate']) {
  const waits=[],requests=[],table=new Table();let stale=false
  const engine=createTavernTasks({table,policy:nonInlinePolicy,isCurrent:(_session,job)=>!(stale&&job.kind==='status'),subagents:{async start(_name,request){
    requests.push(request);const wait=deferred();waits.push(wait);return {id:`isolation-${waits.length}`,result:wait.promise,async dispose(){}}
  }}})
  const spec=makeRequest(`shared-${action}`),old=engine.request(spec).catch(error=>error)
  const sibling=engine.request({...makeRequest(`sibling-${action}`),kind:'decision'})
  await drain()
  assert.equal(requests.length,1)
  const job=engine.list(session).find(item=>item.kind==='status')
  if(action==='invalidate'){stale=true;await engine.invalidate(session)}else await engine[action](session,job.id)
  assert.equal(requests[0].signal.aborted,false,`${action} cannot stop a valid sibling`)
  let renewed
  if(action==='retry'){renewed=engine.request(spec);await drain();assert.equal(requests.length,2)}
  const complete=index=>{const prompt=JSON.parse(requests[index].prompt[0].text);waits[index].resolve(childResult({results:(prompt.tasks??[{...prompt,kind:'status'}]).map(task=>({taskId:task.taskId,generation:task.generation,value:{kind:task.kind}}))}))}
  complete(0)
  assert.deepEqual(await sibling,{kind:'decision'})
  assert.ok(await old instanceof Error)
  if(renewed){complete(1);assert.deepEqual(await renewed,{kind:'status'})}
  assert.equal(engine.list(session).find(item=>item.kind==='decision').fallback,undefined)
}
// Some providers declare STOP and usage while their only text block is empty.
// This must be a classified result failure, not a JSON parse error or success.
for(const background of [false,true]) {
  const engine=createTavernTasks({table:new Table(),policy:nonInlinePolicy,subagents:{async start(){
    return {id:'empty-child',result:Promise.resolve({stopReason:'completed',output:[{type:'text',text:'  '}]}),async dispose(){}}
  }}})
  const result=await engine.request({...makeRequest(`empty-${background}`),background,...(background?{kind:'memory',input:{taskStage:'background-notes'}}:{})}).catch(error=>error)
  assert.ok(result instanceof Error)
  const job=engine.list(session)[0]
  assert.equal((job.fallback?.failure??job.failure)?.category,'empty-response')
  assert.equal(job.status,background?'failed':'queued')
}
{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/task-scheduler-legacy-v1.json',import.meta.url),'utf8'))
 const table=new Table(fixture.records),before=structuredClone([...table])
 let writes=0,spawns=0
 table.put=async()=>{writes++;throw Error('legacy restore must not write')}
 const engine=createTavernTasks({table,policy:{resolve(){throw Error('existing task must preserve policy snapshot')}},subagents:{start(){spawns++;throw Error('existing task must not respawn')}}})
 for(const outcome of fixture.outcomes) {
   if(outcome.pending)await assert.rejects(engine.request(fixture.specs[outcome.index]),InlinePending)
   else assert.deepEqual(await engine.request(fixture.specs[outcome.index]),outcome.result)
 }
 assert.equal(writes,0);assert.equal(spawns,0);assert.deepEqual([...table],before)
 const [key,record]=fixture.records[0],spec=fixture.specs[0]
 for(const replacement of [{...record,id:'mismatched-id'},{...record,sessionId:'other-session'}]) {
   const isolated=new Table([[key,replacement]])
   const guarded=createTavernTasks({table:isolated,policy:nonInlinePolicy})
   await assert.rejects(guarded.request(spec),/损坏|归属/)
   assert.deepEqual(isolated.get(key),replacement)
 }
}
{
 const table=new Table(),request=makeRequest('corrupt-before-dispatch')
 let spawns=0
 const engine=createTavernTasks({table,policy:nonInlinePolicy,subagents:{start(){spawns++;throw Error('must not spawn')}}})
 const release=engine.holdBatch(session)
 const work=engine.request(request)
 await drain()
 const job=engine.list(session)[0],key=`tavern_job__${job.id}`
 const damaged={...job,input:null}
 await table.put(key,damaged);release()
 let timer
 try {
   const outcome=await Promise.race([work.then(()=> 'resolved',()=> 'rejected'),new Promise(resolve=>{timer=setTimeout(()=>resolve('hung'),100)})])
   assert.equal(outcome,'rejected','malformed queue records must reject their waiting request')
 } finally {clearTimeout(timer)}
 assert.equal(spawns,0);assert.deepEqual(table.get(key),damaged)
}
{
 for(const damaged of [null,false,0,'',{schemaVersion:99}]) {
   const request=makeRequest('damaged-existing'),id=taskHash({sessionId:session.id,kind:request.kind,source:request.source,input:request.requestKey})
   const table=new Table([[`tavern_job__${id}`,damaged]])
   const engine=createTavernTasks({table,policy:nonInlinePolicy})
   await assert.rejects(engine.request(request),/损坏/)
   assert.deepEqual(table.get(`tavern_job__${id}`),damaged)
 }
}
{
 const sparse={schemaVersion:1,id:'legacy-diagnostic',sessionId:session.id,kind:'status',status:'failed',execution:'inline',error:'diagnostic anchor'}
 const table=new Table([[`tavern_job__${sparse.id}`,sparse]])
 const engine=createTavernTasks({table,policy:nonInlinePolicy})
 assert.deepEqual(engine.list(session),[sparse])
 const cancelled=await engine.cancel(session,sparse.id)
 assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.error,'diagnostic anchor')
 assert.equal(cancelled.branchId,undefined)
}
// Exercise the core host adapter with the real task store and inline scheduler.
{
 const branch=new Table(),cards=new Table(),taskAgents=new Map(),maintenance=new Map(),inbox=[],children=[]
 const session={id:'host-adapter',events:[],surface:{nodes:[]}},route={provider:'fixture',model:'main'}
 const agent={session,options:route,status:'idle',steer:message=>inbox.push(message)}
 let resolves=0,active=true,fixed={setting:'one'},instruction='first',resumeFailure=true,statusResult
 const engine={storyEvidence:()=>[{seq:0,text:'old'},{seq:4,text:'archived'}],async resumeTask(a,signal,stage){assert.equal(a,agent);assert.equal(stage,'notes');if(resumeFailure)throw Error('resume failed')}}
 const host=createRoleplayTaskHost({T:{branch,cards},ctx:{
  sessions:{get:()=>session},sessionController:{async resolveAgent(){resolves++;return {agent}}},
  agentDefaultModel:{currentSelection:()=>route},subagents:{start(mode,request){assert.equal(mode,'spawn');children.push(request);return {id:'host-child',result:Promise.resolve({stopReason:'completed',output:[{type:'text',text:'background notes'}]}),dispose(){}}}},
  get:name=>name==='compaction'?engine:undefined,
 },config:{},taskAgents,storyBranchIsActive:()=>active,statusFixedContext:()=>fixed,
 taskDependenciesCurrent:()=>true,taskInstruction:()=>instruction,getMaintenanceJob:id=>maintenance.get(id),
 async runStatusObligation(s,event,reason,options){assert.equal(s,session);assert.equal(event,session.events[0]);assert.equal(reason,'maintenance-resume');assert.equal(options.agent,agent);return statusResult},
 STATUS_SYSTEM:'status-system',DECISION_SYSTEM:'decision-system',ORGANIZE_WORKER_SYSTEM:'novel-system'})
 const add=(type,data)=>{const event={seq:session.events.length,type,data};session.events.push(event);session.surface.nodes.push(event.seq);return event}
 add('user/message',{source:{kind:'user'},content:[{type:'text',text:'visible'}]})
 assert.deepEqual(host.taskStory(session).map(({seq,text})=>({seq,text})),[{seq:0,text:'visible'},{seq:4,text:'archived'}],'visible projection wins without changing evidence order')
 const source={plugin:'roleplay-tasks',form:'phase',stage:'character-cast'}
 add('user/message',{source});assert.deepEqual(host.clusterPhase(session),source)
 add('turn/start',{turn:2});assert.equal(host.clusterPhase(session),null)
 let iterations=0,indexReads=0
 const longHistory=new Proxy([...Array.from({length:100000},(_,seq)=>({seq,type:'stream/chunk'})),{seq:100000,type:'turn/end'}],{
  get(target,key,receiver){if(key===Symbol.iterator)iterations++;if(typeof key==='string'&&/^\d+$/.test(key))indexReads++;return Reflect.get(target,key,receiver)},
 })
 assert.equal(host.clusterPhase({...session,events:longHistory}),null)
 assert.equal(iterations,0,'phase lookup must not copy the full stream history');assert.equal(indexReads,1)
 await branch.put(session.id+'__task-preparation',{id:'prep-one',sessionId:session.id,status:'preparing'})
 const make=nonce=>({session,system:'memory-system',user:`<rp-content:${nonce}>notes</rp-content:${nonce}>`,format:'text',taskStage:'notes'})
 const first=make('a'.repeat(36)),admitted=[]
 await assert.rejects(host.nativeTask({...first,onAdmission:job=>admitted.push(job)}),{code:'TAVERN_INLINE_PENDING'})
 const job=host.tavernTasks.list(session)[0]
 assert.equal(admitted.length,0,'inline work has not entered the child admission queue');assert.equal(resolves,1);assert.equal(taskAgents.get(session.id),agent)
 assert.equal(job.source.preparationId,'prep-one');assert.equal(job.source.events[0].hash,sha256('visible'))
 assert.equal(branch.get(session.id+'__task-memory-resume').source.taskId,job.id)
 instruction='current instruction'
 await new Promise(resolve=>setTimeout(resolve,10))
 assert.equal(inbox.length,1);assert.match(JSON.stringify(inbox[0]),/current instruction/)
 await assert.rejects(host.nativeTask(make('b'.repeat(36))),{code:'TAVERN_INLINE_PENDING'})
 assert.equal(resolves,1);assert.equal(host.tavernTasks.list(session).length,1,'prompt nonce does not change durable identity')
 agent.status='running'
 await branch.put(session.id+'__task-preparation',{id:'prep-two',sessionId:session.id,status:'preparing'})
 await assert.rejects(host.tavernTasks.submit({session,id:job.id,generation:job.generation,value:'notes'}),/过期|失效|stale|来源/)
 const resumeKey=session.id+'__task-memory-resume',saved=structuredClone(branch.get(resumeKey))
 maintenance.set(session.id,{kind:'notes',state:'waiting-main'})
 await assert.rejects(host.resumeMemoryWork(session,agent),/resume failed/)
 assert.deepEqual(branch.get(resumeKey),saved);assert.equal(maintenance.get(session.id).state,'waiting-main')
 resumeFailure=false;await host.resumeMemoryWork(session,agent)
 assert.equal(branch.get(resumeKey).status,'completed');assert.equal(maintenance.get(session.id).state,'completed')
 const memoryRecord=structuredClone(branch.get(resumeKey))
 const delivered=[]
 const backgroundResult=await host.nativeTask({session,system:'memory-system',user:'background',format:'text',taskStage:'background-notes',background:true,
  selection:{execution:'inline',main:route,actualRoute:route},maxTokens:321,tools:['rp_history'],timeoutMs:1000,
  onAdmission:job=>admitted.push(job),onResult:job=>delivered.push(job)})
 assert.equal(backgroundResult,'background notes');assert.equal(children.length,1)
 assert.equal(children[0].parent,agent);assert.equal(children[0].agentOptions.maxTokens,321);assert.deepEqual(children[0].toolFilter.allow,['rp_history'])
 assert.equal(admitted[0].id,delivered[0].id);assert.equal(delivered[0].status,'completed')
 assert.equal(delivered[0].source.preparationId,undefined,'background memory is not fenced to foreground preparation')
 assert.equal(delivered[0].input.taskStage,'background-notes')
 active=false
 await assert.rejects(host.nativeTask({session,system:'decision-system',user:'inactive'}),/来源已变化/)
 assert.equal(children.length,1,'inactive branches never start native children');active=true
 await branch.put(session.id+'__task-preparation',{id:'prep-two',sessionId:session.id,status:'completed'})
 await assert.rejects(host.nativeTask({session,system:'status-system',user:'status'}),{code:'TAVERN_INLINE_PENDING'})
 const statusJob=host.tavernTasks.list(session).find(j=>j.kind==='status')
 assert.equal(statusJob.source.preparationId,undefined);assert.equal(statusJob.source.fixedHash,recordSha256(fixed))
 assert.deepEqual(branch.get(resumeKey),memoryRecord,'status pending must not create memory recovery work')
 await assert.rejects(host.tavernTasks.submit({session,id:statusJob.id,generation:statusJob.generation,value:[]}),/JSON 对象/)
 fixed={setting:'changed'}
 await assert.rejects(host.tavernTasks.submit({session,id:statusJob.id,generation:statusJob.generation,value:{ok:true}}),/过期|失效|stale|来源/)
 for(const result of [{state:'waiting-main'},{state:'completed',publicationState:'published'},{state:'completed',publicationState:'pending'}]){
  maintenance.set(session.id,{kind:'status-rebuild',state:'waiting-main',atSeq:0})
  statusResult=result
  if(result.state==='waiting-main')await assert.rejects(host.resumeStatusMaintenance(session,agent),{code:'TAVERN_INLINE_PENDING'})
  else await host.resumeStatusMaintenance(session,agent)
  assert.equal(maintenance.get(session.id).state,result.state==='waiting-main'?'waiting-main':result.publicationState==='published'?'completed':'failed')
 }
 await new Promise(resolve=>setTimeout(resolve,10))
 assert.equal(inbox.length,1,'scheduled idle steer rechecks current agent state')
}
console.log('tavern-task-lifecycle=ok (batch lifecycle, native host adapter, recovery and source fences)')
