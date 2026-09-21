import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {testTempRoot as tmpdir, createTestDirectory,cleanupTestDirectory} from '../lib/operations/test-temp.mjs'
import {join} from 'node:path'
import { apply } from '../lib/core/roleplay-core.js'
import {ownedPackages} from './plugin-owned-packages-fixture.mts'

const formatFixture = await ownedPackages(['session-format'])
process.once('exit', () => formatFixture.close())
const {appendMessageEdit, latestMessageEdit, currentMessageEdits} = await formatFixture.load('dsh-nexttavern-session-format')
import { internalTaskSeqs, InlinePending } from '../lib/core/tavern-tasks.js'
import { inlineTaskInstruction } from '../lib/core/tavern-task-context.js'
import { recordSha256, rollLogEntries, stableImportId } from '../lib/core/roleplay-data.js'
import { registerAvatarRoute } from '../lib/core/roleplay-panel-routes.js'
import { registerMaintenanceRoute } from '../lib/core/roleplay-job-routes.js'
const scenario=process.argv[2]
if(!scenario){for(const name of ['core-contracts','request-watchdog','coarse-model-admission','maintenance-route','panel-routes','settings-routes','authoring','diagnosis','task-tools','session-actions','author-tools','loop-contract','status-special','decision-special','same-route','authoring-opening','status-fallback','status-delayed','status-delayed-fallback','status-delayed-cancel','background-memory','shared-special','shared-fallback'])execFileSync(process.execPath,[fileURLToPath(import.meta.url),name],{stdio:'inherit'});process.exit(0)}
const statusModel=['status-special','status-fallback','status-delayed','status-delayed-fallback','status-delayed-cancel','shared-special','shared-fallback'].includes(scenario)?'status-special':'main'
const decisionModel=scenario.startsWith('shared-')||scenario==='status-delayed-cancel'?'status-special':scenario==='decision-special'?'decision-special':'main'
const statusFallback=scenario==='status-fallback'
let releaseStatus; const statusGate=scenario.startsWith('status-delayed')?new Promise((resolve,reject)=>{releaseStatus=()=>scenario==='status-delayed-fallback'?reject(new Error('delayed status failure')):resolve()}):Promise.resolve()
class Table extends Map { async put(k,v){this.set(k,structuredClone(v))} async update(k,fn){await this.put(k,fn(structuredClone(this.get(k))));return this.get(k)} }
const tables=new Map(),table=name=>{if(!tables.has(name))tables.set(name,new Table());return tables.get(name)}
const hooks=new Map(),tools=new Map(),commands=new Map(),routes=new Map(),services=new Map(),sections=new Map(),variables=new Map(),cleanup=[],guards=[]
let scheduledMemory=0
if(scenario==='background-memory')services.set('compaction',{backgroundMemory:true,finishTurn(){scheduledMemory++}})
const session={id:'loop-fixture',header:{agentPreset:'roleplay'},events:[],surface:{nodes:[]},seq:0}
const text=t=>[{type:'text',text:t}], inbox=[]
const agent={session,status:'running',options:{provider:'fixture',model:'main',reasoningEffort:'high'},steer:m=>inbox.push(m)}
session.append=(type,data,options={})=>{const e={seq:session.seq++,type,data:structuredClone(data),surfaceOp:options.surfaceOp,sourceEventSeqs:options.sourceEventSeqs,time:Date.now()};session.events.push(e);if(options.surfaceOp==='append')session.surface.nodes.push(e.seq);else if(options.surfaceOp?.op==='replace'){const {startSeq,endSeq}=options.surfaceOp,a=session.surface.nodes.indexOf(startSeq),b=session.surface.nodes.indexOf(endSeq);assert.ok(a>=0&&b>=a);session.surface.nodes.splice(a,b-a+1,e.seq)}return e}
let spawns=0,direct=0
const ctx={storageDomain:{async open(){return {table,close(){}}}},sessions:{get:id=>id===session.id?session:null},sessionController:{async resolveAgent(){return {agent}}},
  nexttavernMessageEdits: {append: appendMessageEdit, latest: latestMessageEdit, current: currentMessageEdits},
  llm:{async *stream(){direct++;throw new Error('forbidden direct call')}},subagents:{async start(_name,request){spawns++;if(request.agentOptions.model==='status-special'){if(statusFallback)throw new Error('status provider failed');return {id:`status-${spawns}`,result:statusGate.then(()=>({stopReason:'completed',output:[{type:'text',text:'{"title":"庭院","fields":[{"label":"位置","value":"庭院"}],"options":[{"label":"专用状态建议"}]}'}]})),async dispose(){}}}assert.equal(request.agentOptions.model,'decision-special');return {id:`decision-${spawns}`,result:Promise.resolve({stopReason:'completed',output:[{type:'text',text:'{"options":[{"label":"专用决策"}]}'}]}),async dispose(){}}}},
  tokenMeter:{measure(){return {nodes:[]}}},agentDefaultModel:{currentSelection:()=>agent.options},
  systemPrompt:{variable:(name,value)=>{variables.set(name,value);return()=>{}},section:s=>{sections.set(s.name,s);return()=>{}}},tools:{guard:g=>{guards.push(g);return()=>{}},register:t=>{tools.set(t.name,t);return()=>{}}},commands:{register:c=>{commands.set(c.name,c);return()=>{}}},
  connection:{fetch:{register:r=>{routes.set(r.path,r);return()=>{}}}},fs:{},logger:{info(){},warn(){}},
  effect:fn=>{const c=fn();if(typeof c==='function')cleanup.push(c)},on:(name,fn)=>{if(!hooks.has(name))hooks.set(name,[]);hooks.get(name).push(fn);return()=>{}},provide:(n,v)=>services.set(n,v),get:n=>services.get(n)}
await apply(ctx,{statusRetryMs:60000})
if(scenario==='request-watchdog'){
 const {mock}=await import('node:test'),calls=[]
 let controller=new AbortController()
 agent.cancel=(cause,options)=>{calls.push({cause,options});controller.abort(cause)}
 const request=hooks.get('agent/request')[0],config={provider:'fixture',model:'main'}
 mock.timers.enable({apis:['setTimeout']})
 try{
  assert.equal(await request({agent,turn:1,step:1,signal:controller.signal},async()=>config),config,'request config is unchanged')
  mock.timers.tick(89999);assert.equal(calls.length,0)
  mock.timers.tick(1);assert.equal(calls.length,1);assert.equal(calls[0].cause.kind,'hook');assert.deepEqual(calls[0].options,{keepInbox:true})
  controller=new AbortController()
  await request({agent,turn:2,step:1,signal:controller.signal},async()=>config)
  for(const fn of hooks.get('session/event'))await fn(session,{type:'assistant/chunk',data:{turn:2,step:1,chunk:{type:'reasoning-delta'}}})
  mock.timers.tick(90001);assert.equal(calls.length,1,'first model output disarms the silence deadline')
  await request({agent:{...agent,options:{...agent.options,subagentDepth:1}},turn:3,step:1,signal:controller.signal},async()=>config)
  mock.timers.tick(90001);assert.equal(calls.length,1,'main watchdog never cancels an independent child')
  await assert.rejects(request({agent,turn:4,step:1,signal:controller.signal},async()=>{throw Error('configuration failed')}),/configuration failed/)
  mock.timers.tick(90001);assert.equal(calls.length,1,'failed request preparation does not leave a timer')
 }finally{mock.timers.reset();cleanup.reverse().forEach(fn=>fn())}
 console.log('tavern-loop=request-watchdog=ok (registered native request hook, first output, child boundary, no retry, preserved inbox)')
 process.exit(0)
}
if(scenario==='coarse-model-admission'){
 const directory=createTestDirectory('coarse-model-admission-'),calls=[]
 session.header.cwd=directory
 let questions=0,concluded=0
 ctx.userQuestions={async ask(){questions++;return {answers:[{id:'reading-mode',selected:['粗颗粒度']}]}}}
 agent.cancel=(cause,options)=>calls.push({cause,options})
 try{
  writeFileSync(join(directory,'novel.txt'),'第一章\n林青推开旧门，灯光照见信封。\n第二章\n多年以后，林青再次回到故乡。')
  const result=await tools.get('rp_source_begin').execute({source_path:'novel.txt'},{agent,signal:new AbortController().signal,concludeTurn(){concluded++}})
  assert.equal(result.code,'ADAPTATION_COARSE_MODEL_REQUIRED');assert.equal(concluded,1,'missing model concludes the native successful tool result')
  assert.equal(questions,1,'configuration failure does not ask another protagonist questionnaire')
  const plan=[...table('branch').values()].find(value=>value.kind==='adaptation-research-plan')
  assert.equal(plan.mode,null);assert.equal(plan.status,'choice-required')
  const get=await routes.get('/api/roleplay/card-adaptation').fetch(new Request('http://localhost/api/roleplay/card-adaptation?sessionId='+session.id))
  const view=await get.json();assert.equal(view.ok,true)
  const pending=await routes.get('/api/roleplay/retrieval-confirmations').fetch(new Request('http://localhost/api/roleplay/retrieval-confirmations?sessionId='+session.id))
  assert.equal((await pending.json()).pending[0].action,'configure-adaptation-model')
  session.append('turn/start',{turn:1})
  for(const hook of hooks.get('agent/pre-step'))await hook({agent,turn:1,step:1,messages:[],signal:new AbortController().signal},async()=>({kind:'enter',messages:[]}))
  const response=await routes.get('/api/roleplay/card-adaptation').fetch(new Request('http://localhost/api/roleplay/card-adaptation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:session.id,action:'research-mode',readingMode:'coarse',protagonist:'林青',sourceId:view.selectedId,expectedRevision:view.revision,expectedResearchRevision:plan.revision})}))
  assert.equal((await response.json()).code,'ADAPTATION_COARSE_MODEL_REQUIRED')
  assert.equal(calls.length,1);assert.deepEqual(calls[0].options,{keepInbox:true})
  assert.equal(direct,0);assert.equal(spawns,0)
 }finally{cleanup.reverse().forEach(fn=>fn());cleanupTestDirectory(directory)}
 console.log('tavern-loop=coarse-model-admission=ok (actual core questionnaire, global notice, untouched plan, native conclude and route cancellation)')
 process.exit(0)
}
if(scenario==='core-contracts'){
 const branch=table('branch'),signal=new AbortController().signal
 assert.equal((await tools.get('rp_commit_card').execute({},{agent:{session}})).ok,true,'in-memory authoring does not require cwd or steer')
 await assert.rejects(tools.get('rp_history').execute({action:'search'},{}),/roleplay 工具需要/)
 await assert.rejects(tools.get('rp_card_draft_check').execute({source_path:'missing.md'},{agent:{session}}),/工作目录/)
 await assert.rejects(tools.get('rp_novel_export').execute({},{agent:{session}}),/工作目录/)
 assert.equal([...branch.values()].filter(job=>job.kind==='novel-export').length,0)
 session.header.cwd=createTestDirectory('core-contracts-')
 await assert.rejects(tools.get('rp_novel_export').execute({},{agent:{session}}),/代理尚未就绪/)
 const evidence=[{seq:0,kind:'user',text:'Open the gate'},{seq:1,kind:'assistant',text:'The gate opens.'}]
 services.set('compaction',{storyEvidence:owner=>{assert.equal(owner,session);return evidence}})
 const result=await tools.get('rp_novel_export').execute({},{agent})
 const key='tavern_novel__'+result.jobId,selection=structuredClone(branch.get(key).selection)
 const stop=()=>hooks.get('agent/turn-stopping')[0]({agent,turn:1,signal})
 const task=()=>[...branch.values()].find(job=>job.source?.workflowId===result.jobId&&job.status==='queued')
 const submit=async value=>{const pending=task();assert.ok(pending);await tools.get('rp_task_submit').execute({id:pending.id,generation:pending.generation,result:value},{agent:{session}})}
 await stop()
 assert.equal(branch.get(key).status,'waiting-main')
 assert.deepEqual(task().main,selection.main,'the native task keeps the saved main route')
 assert.deepEqual(task().actualRoute,selection.actualRoute)
 await submit({title:'The Gate',chapters:[{title:'Opening',chunk_ids:branch.get(key).chunks.map(chunk=>chunk.id)}]})
 for(const dispose of cleanup.splice(0).reverse())dispose()
 hooks.clear()
 await apply(ctx,{statusRetryMs:60000})
 await stop()
 await submit({paragraphs:branch.get(key).chunks[0].units.map(unit=>({source_ids:[unit.id]}))})
 await stop()
 assert.equal(branch.get(key).status,'completed','restored core finishes the native tool export')
 assert.ok(branch.get(key).resourceId)
 assert.deepEqual(branch.get(key).selection,selection,'restart does not rewrite the saved route')
 const before=[...branch.values()].filter(job=>job.source?.workflowId===result.jobId).length
 await stop()
 assert.equal([...branch.values()].filter(job=>job.source?.workflowId===result.jobId).length,before)
 const workflowId='restart-card',workflowKey='tavern_cardjob__'+workflowId
 branch.set(workflowKey,{schemaVersion:1,id:workflowId,kind:'card-export',sessionId:session.id,branchId:session.id,generation:'card-generation',selection,execution:selection.execution,actualRoute:selection.actualRoute,status:'queued',createdAt:1,source:{},progress:{done:0,total:1}})
 await stop()
 assert.equal(branch.get(workflowKey).status,'waiting-main')
 const cardTask=[...branch.entries()].find(([,job])=>job.source?.workflowId===workflowId)
 branch.set(cardTask[0],{...cardTask[1],status:'completed',result:{resourceId:'restored-card-resource'}})
 for(const dispose of cleanup.splice(0).reverse())dispose()
 hooks.clear()
 await apply(ctx,{statusRetryMs:60000})
 await stop()
 const completed=structuredClone(branch.get(workflowKey))
 assert.equal(completed.status,'completed');assert.equal(completed.resourceId,'restored-card-resource')
 await stop()
 assert.deepEqual(branch.get(workflowKey),completed,'completed card recovery is idempotent')
 const legacy={...structuredClone(branch.get(key)),id:'legacy-route',status:'queued',selection:{execution:'inline'},results:{},plan:undefined}
 branch.set('tavern_novel__legacy-route',legacy)
 await stop()
 assert.equal(branch.get('tavern_novel__legacy-route').status,'failed')
 assert.match(branch.get('tavern_novel__legacy-route').error,/模型路由无效/)
 assert.deepEqual(branch.get('tavern_novel__legacy-route').selection,legacy.selection,'sparse legacy selections stay readable without silently choosing a different model')
 assert.equal([...branch.values()].filter(job=>job.source?.workflowId==='legacy-route').length,0)
 const streamUsage={inputTokens:11,outputTokens:7,cacheReadTokens:0,cacheWriteTokens:0}
 session.append('step/start',{turn:2,step:1})
 const observe=hooks.get('llm/stream')[0]
 for await(const _chunk of observe({sessionId:session.id,provider:'fixture',model:'main'},async function*(){yield {type:'usage',usage:streamUsage};yield {type:'finish',reason:{kind:'stop'}}})){}
 session.append('assistant/message',{turn:2,step:1,usage:streamUsage,message:{content:text('telemetry fixture')}})
 const end=session.append('turn/end',{turn:2,reason:{kind:'completed'}})
 for(const onEvent of hooks.get('session/event'))onEvent(session,end)
 await new Promise(resolve=>setImmediate(resolve))
 const url=`https://fixture/api/roleplay/usage?sessionId=${session.id}&from=0&to=${Date.now()+10000}`
 const usageResponse=await routes.get('/api/roleplay/usage').fetch(new Request(url))
 assert.equal(usageResponse.status,200)
 const totals=(await usageResponse.json()).totals
 assert.equal(totals.calls,1,'native stream and session events describe one charge')
 assert.equal(totals.inputTokens,11)
 assert.equal(spawns+direct,0)
 for(const dispose of cleanup)dispose()
 console.log('tavern-loop=core-contracts=ok (capabilities, native export, saved routes and restart recovery)')
 process.exit(0)
}
if(scenario==='maintenance-route'){
 ctx.sessionController.resolveAgent=async id=>id===session.id?{agent}:{error:new Error('missing')}
 const route=routes.get('/api/roleplay/maintenance')
 const post=async(body,handler=route)=>{
  const response=await handler.fetch(new Request('https://fixture/api/roleplay/maintenance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:session.id,...body})}))
  return {status:response.status,...await response.json()}
 }
 const drain=()=>new Promise(resolve=>setImmediate(resolve))
 assert.equal((await post({sessionId:'missing',action:'notes'})).status,404)
 assert.equal((await post({action:'status'})).job,null)
 assert.equal((await post({action:'notes'})).status,409)
 agent.status='idle'
 const resolveAgent=ctx.sessionController.resolveAgent
 ctx.sessionController.resolveAgent=async()=>({})
 assert.equal((await post({action:'notes'})).status,404);ctx.sessionController.resolveAgent=resolveAgent
 let releaseNotes,calls=0
 const notesGate=new Promise(resolve=>{releaseNotes=resolve})
 services.set('compaction',{organizeNow:async a=>{assert.equal(a,agent);calls++;await notesGate;return {saved:true}}})
 const started=await post({action:'notes'})
 assert.equal(started.status,202)
 const repeated=await post({action:'status-rebuild'})
 assert.equal(repeated.status,200);assert.equal(repeated.job.id,started.job.id);assert.equal(calls,1)
 releaseNotes();await drain()
 const completed=await post({action:'status'})
 assert.equal(completed.job.state,'completed');assert.deepEqual(completed.job.result,{saved:true});assert.ok(completed.job.finishedAt>=completed.job.startedAt)
 agent.ctx={get:()=>({organizeNow:async()=>({source:'agent'})})}
 await post({action:'unknown-legacy-action'});await drain()
 assert.deepEqual((await post({action:'status'})).job.result,{source:'agent'});assert.equal(calls,1)
 delete agent.ctx;services.delete('compaction')
 await post({action:'notes'});await drain()
 assert.equal((await post({action:'status'})).job.state,'failed')
 services.set('compaction',{organizeNow:async()=>{throw Error('fixture notes failure')}})
 await post({action:'notes'});await drain();assert.equal((await post({action:'status'})).job.error,'fixture notes failure')
 services.set('compaction',{organizeNow:async()=>{throw new InlinePending('maintenance-fixture')}})
 await post({action:'notes'});await drain()
 const waiting=await post({action:'status'})
 assert.equal(waiting.job.state,'waiting-main');assert.equal(waiting.job.error,null)
 assert.equal((await post({action:'notes'})).job.id,waiting.job.id,'main-loop handoff retains the same maintenance job')
 let statusRoute,result,selected='trigger',event={seq:42,type:'assistant/message'},runs=0
 const maintenanceJobs=new Map()
 registerMaintenanceRoute({ctx:{effect:fn=>fn(),connection:{fetch:{register:r=>{statusRoute=r}}},sessionController:ctx.sessionController,get:()=>null},resolveRoleplaySession:async()=>session,maintenanceJobs,latestStatusEvent:()=>event,selectedStatusRecord:()=>({provenance:{triggerId:selected}}),runStatusObligation:async(s,e,reason,options)=>{runs++;assert.equal(s,session);assert.equal(e,event);assert.equal(reason,'maintenance');assert.equal(options.force,true);assert.equal(options.agent,agent);return result}})
 for(const [statusResult,selectedTrigger,expected] of [
  [{state:'waiting-main'},'trigger','waiting-main'],
  [{state:'completed',publicationState:'failed',trigger:{id:'trigger'}},'trigger','failed'],
  [{state:'completed',publicationState:'published',trigger:{id:'trigger'}},'other','failed'],
  [{state:'completed',publicationState:'published',trigger:{id:'trigger'}},'trigger','completed'],
 ]){
  maintenanceJobs.clear();result=statusResult;selected=selectedTrigger
  assert.equal((await post({action:'status-rebuild'},statusRoute)).status,202);await drain()
  const job=maintenanceJobs.get(session.id);assert.equal(job.state,expected);assert.equal(job.atSeq,42)
  if(expected==='completed')assert.deepEqual(job.result,{triggerId:'trigger',atSeq:42})
 }
 event=null;maintenanceJobs.clear();await post({action:'status-rebuild'},statusRoute);await drain()
 assert.equal(maintenanceJobs.get(session.id).state,'failed');assert.equal(runs,4)
 assert.equal(spawns+direct,0)
 for(const dispose of cleanup)dispose()
 console.log('tavern-loop=maintenance-route=ok (deduplication, host handoff, engine precedence, failure and publication fence)')
 process.exit(0)
}
if(scenario==='panel-routes'){
 ctx.sessionController.resolveAgent=async id=>id===session.id?{agent}:{error:new Error('missing')}
 const request=(path,body)=>routes.get('/api/roleplay/'+path).fetch(new Request('https://fixture/api/roleplay/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:session.id,...body})}))
 const decision=table('decision'),decisionKey=session.id+'__current',fresh=()=>({options:[{label:'One'},{label:'Two'}],answered:false,superseded:false,source:'fixture'})
 for(const path of ['set','decision'])assert.equal((await request(path,{sessionId:'missing'})).status,404)
 decision.set(decisionKey,fresh())
 for(const choiceIndex of [-1,2,1.5])assert.equal((await request('decision',{choiceIndex})).status,400)
 assert.equal((await request('decision',{choiceIndex:1})).status,200)
 assert.equal(decision.get(decisionKey).answered,true);assert.equal(decision.get(decisionKey).choiceLabel,'Two');assert.equal(decision.get(decisionKey).choiceIndex,1)
 assert.equal((await request('decision',{choiceIndex:0})).status,409)
 decision.set(decisionKey,{...fresh(),superseded:true});assert.equal((await request('decision',{choiceIndex:0})).status,409)
 decision.set(decisionKey,fresh())
 assert.equal((await request('decision',{choiceIndex:999,customText:'  '+ 'x'.repeat(510)+'  '})).status,200)
 assert.equal(decision.get(decisionKey).choiceIndex,null);assert.equal(decision.get(decisionKey).choiceLabel,'x'.repeat(500));assert.equal(decision.get(decisionKey).customText,'x'.repeat(500))
 decision.set(decisionKey,fresh())
 const putDecision=decision.put.bind(decision);let releaseWrite,writes=0
 const writeGate=new Promise(resolve=>{releaseWrite=resolve})
 decision.put=async(key,value)=>{writes++;await writeGate;return putDecision(key,value)}
 const first=request('decision',{choiceIndex:0}),second=request('decision',{choiceIndex:1})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(writes,1)
 releaseWrite();assert.deepEqual((await Promise.all([first,second])).map(r=>r.status),[200,409]);decision.put=putDecision
 assert.equal(decision.get(decisionKey).choiceLabel,'One')
 const malformed=await routes.get('/api/roleplay/set').fetch(new Request('https://fixture/api/roleplay/set',{method:'POST',body:'{' }))
 assert.equal(malformed.status,400)
 for(const body of [{kind:'unknown'},{kind:'card',card_id:'bad/id'},{kind:'worldbook',id:'bad/id'}])assert.equal((await request('set',body)).status,400)
 const loreKey=session.id+'__panel-lore'
 assert.equal((await request('set',{kind:'worldbook',id:'panel-lore',content:'original',expectedRevision:'missing'})).status,200)
 const originalLore=structuredClone(table('worldbook').get(loreKey)),revision=recordSha256(originalLore)
 assert.equal((await request('set',{kind:'worldbook',id:'panel-lore',content:'stale',expectedRevision:'missing'})).status,409)
 assert.equal((await request('set',{kind:'worldbook',id:'panel-lore',content:'new',expectedRevision:revision})).status,200)
 assert.equal((await request('set',{kind:'worldbook-delete',id:'panel-lore',expectedRevision:revision})).status,409)
 assert.equal((await request('set',{kind:'worldbook-delete',id:'panel-lore',expectedRevision:recordSha256(table('worldbook').get(loreKey))})).status,200)
 assert.equal((await request('set',{kind:'worldbook-delete',id:'panel-lore',expectedRevision:'missing'})).status,200)
 assert.equal(table('worldbook').has(loreKey),false)
 assert.equal((await request('set',{kind:'memory',summary:'ordinary summary'})).status,200)
 const headKey=session.id+'__head',savedSummary=table('memory').get(headKey).summary,notes=[]
 services.set('compaction',{saveDirectorNotes:async(s,value)=>{assert.equal(s,session);notes.push(value)}})
 assert.equal((await request('set',{kind:'memory',summary:'director only',directorNotes:true,lockedFacts:['fact']})).status,200)
 assert.deepEqual(notes,['director only']);assert.equal(table('memory').get(headKey).summary,savedSummary)
 assert.deepEqual(table('memory').get(headKey).lockedFacts,[{text:'fact'}])
 services.set('compaction',{saveDirectorNotes:async()=>{throw Error('fixture notes failure')}})
 assert.equal((await request('set',{kind:'memory',summary:'failed',directorNotes:true})).status,500)
 services.delete('compaction');assert.equal((await request('set',{kind:'memory',summary:'missing',directorNotes:true})).status,500)
 assert.equal((await request('set',{kind:'rules',core:'retained',beauty:{regexRules:[null,{match:7,replace:'invalid'},...Array.from({length:70},()=>({match:'m'.repeat(500),replace:'r'.repeat(900)}))],css:'c'.repeat(21000),js:'j'.repeat(9000)}})).status,200)
 const rules=table('rules').get(session.id+'__spec')
 assert.equal(rules.core,'retained');assert.equal(rules.beauty.regexRules.length,60)
 assert.equal(rules.beauty.regexRules[0].match.length,400);assert.equal(rules.beauty.regexRules[0].replace.length,800)
 assert.equal(rules.beauty.css.length,20000);assert.equal(rules.beauty.js.length,8000)
 let releaseImport,avatarRoute
 const barrier=new Promise(resolve=>{releaseImport=resolve}),order=[]
 registerAvatarRoute({ctx:{effect:fn=>fn(),connection:{fetch:{register:r=>{avatarRoute=r}}}},T:{branch:{get:()=>{order.push('read');return undefined}}},resolveRoleplaySession:async()=>session,ensureBranch:async()=>{order.push('ensure')},awaitImportBarrier:async()=>{order.push('barrier');await barrier},importRecordKey:()=>'',assertImportRecordIntegrity:()=>{throw Error('unexpected')}})
 const avatar=avatarRoute.fetch(new Request('https://fixture/api/roleplay/card-avatar?sessionId='+session.id))
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(order,['ensure','barrier'])
 releaseImport();assert.equal((await avatar).status,404);assert.deepEqual(order,['ensure','barrier','read'])
 assert.equal(spawns+direct,0)
 for(const dispose of cleanup)dispose()
 console.log('tavern-loop=panel-routes=ok (decision concurrency, version conflicts, memory path, beauty limits and import barrier)')
 process.exit(0)
}
if(scenario==='settings-routes'){
 ctx.sessionController.resolveAgent=async id=>id===session.id?{agent}:{error:new Error('missing session')}
 const request=(name,body,id=session.id)=>routes.get('/api/roleplay/'+name).fetch(new Request('https://fixture/api/roleplay/'+name+'?sessionId='+id,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:id,...body})}))
 for(const name of ['models','character-cluster','memory-settings']){
  const missing=await request(name,undefined,'missing');assert.equal(missing.status,404);assert.match(missing.headers.get('content-type'),/application\/json/)
 }
 ctx.llm.listProviders=()=>[{id:'broken'},{id:'fixture'}]
 ctx.llm.listModels=async id=>{if(id==='broken')throw Error('unavailable provider');return [{id:'no-metadata',name:'No Metadata'},{id:'main',name:'Main'}]}
 ctx.llm.resolveModelInfo=async(provider,model)=>{if(model==='no-metadata')throw Error('unavailable metadata');return {provider,id:model,reasoning:{efforts:[{id:'high',name:'High',description:'Detailed'}],defaultEffort:'high'}}}
 const models=await (await request('models')).json()
 assert.deepEqual(models.catalog.map(m=>m.model),['no-metadata','main']);assert.equal(models.catalog[0].reasoning,undefined)
 assert.equal(models.catalog[1].reasoning.defaultEffort,'high')
 const bad=await request('models',{scope:'global',expectedRevision:models.global.revision,settings:{allMain:false,routes:{memory:{provider:'fixture',model:'main',reasoningEffort:'unsupported'}}}})
 assert.equal(bad.status,400)
 assert.equal((await request('models',{scope:'global',expectedRevision:models.global.revision,settings:{allMain:true,routes:{}}})).status,200)
 assert.equal((await request('models',{scope:'global',expectedRevision:models.global.revision,settings:{allMain:false,routes:{}}})).status,409)
 const cluster=await (await request('character-cluster')).json()
 const settings={enabled:true,defaultRoute:{main:true,reasoningEffort:'high'}}
 assert.equal((await request('character-cluster',{settings,expectedRevision:cluster.settings.revision})).status,200)
 const saved=await (await request('character-cluster')).json()
 assert.equal(saved.settings.enabled,true)
 assert.equal((await request('character-cluster',{settings:{enabled:false},expectedRevision:cluster.settings.revision})).status,409)
 assert.deepEqual((await (await request('character-cluster')).json()).settings,saved.settings)
 let policy=await (await request('memory-settings')).json()
 const invalid=[{scope:'invalid',settings:{contextWindowTokens:2000}},{scope:'global',settings:[]},{scope:'global',settings:{unknown:1}},{scope:'global',settings:{contextWindowTokens:999}},{scope:'global',settings:{autoNotesEveryTurns:1.5}},{scope:'global',settings:{}}]
 for(const body of invalid)assert.equal((await request('memory-settings',{...body,expectedRevision:policy.global.revision})).status,400)
 const branch=table('branch'),put=branch.put.bind(branch),old=structuredClone(branch.get('memory-settings-global'))
 branch.put=async(key,value)=>{if(key==='memory-settings-global')throw Error('fixture settings write');return put(key,value)}
 const failed=await request('memory-settings',{scope:'global',settings:{contextWindowTokens:4000},expectedRevision:policy.global.revision})
 assert.equal(failed.status,400);assert.deepEqual(branch.get('memory-settings-global'),old);branch.put=put
 assert.equal((await request('memory-settings',{scope:'global',settings:{contextWindowTokens:4000},expectedRevision:policy.global.revision})).status,200)
 assert.equal((await request('memory-settings',{scope:'global',settings:{contextWindowTokens:5000},expectedRevision:policy.global.revision})).status,409)
 policy=await (await request('memory-settings')).json()
 assert.equal(policy.effective.contextWindowTokens,4000);assert.equal(typeof policy.global.revision,'string')
 const concurrent=await Promise.all([4500,5500].map(contextWindowTokens=>request('memory-settings',{scope:'session',settings:{contextWindowTokens},expectedRevision:policy.session.revision})))
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409],'same-revision saves serialize inside the lock')
 policy=await (await request('memory-settings')).json()
 assert.equal((await request('memory-settings',{scope:'session',settings:{contextWindowTokens:null},expectedRevision:policy.session.revision})).status,200)
 assert.equal((await (await request('memory-settings')).json()).effective.contextWindowTokens,4000)
 assert.equal(spawns+direct,0)
 for(const dispose of cleanup)dispose()
 console.log('tavern-loop=settings-routes=ok (catalog failure isolation, reasoning validation, revision conflicts and memory inheritance)')
 process.exit(0)
}
if(scenario==='authoring'){
 const commit=args=>tools.get('rp_commit_card').execute(args,{agent}),cardId=stableImportId('hero name'),loreId=stableImportId('gate name')
 session.append('turn/start',{turn:1})
 table('cards').set(session.id+'__'+cardId,{id:cardId,version:3,locked:true})
 table('worldbook').set(session.id+'__'+loreId,{id:loreId,version:2,aliases:['door'],keywords:['key'],triggers:['open'],priority:7,tokenBudget:700,alwaysOn:true,locked:true})
 const result=await commit({cards:[{card_id:'hero name',name:'n'.repeat(80),kind:'other',content:'complete character'},{name:'Player',kind:'user',content:'player'}],
  worldbook:[{id:'gate name',name:'Gate',content:'complete lore'}],statusSpec:'status',rules:{core:'core',style:'style',ignored:'ignored'},
  beauty:{regexRules:[{match:'one',replace:'two'},null,{match:4,replace:'invalid'}],css:'p{}',js:'return;'},opening:'opening'})
 assert.deepEqual(result.written.map(r=>r.target),['cards','cards','worldbook','status','rules','beauty','opening'])
 const card=table('cards').get(session.id+'__'+cardId),lore=table('worldbook').get(session.id+'__'+loreId)
 assert.equal(card.name.length,60);assert.equal(card.kind,'npc');assert.equal(card.version,4);assert.equal(card.locked,true)
 assert.equal(card.verified,false);assert.equal(card.source,'authored-by-agent');assert.equal(card.updatedAtSeq,0)
 assert.equal(table('cards').get(session.id+'__user').kind,'user')
 for(const field of ['aliases','keywords','triggers'])assert.ok(lore[field].length)
 assert.equal(lore.priority,7);assert.equal(lore.tokenBudget,700);assert.equal(lore.alwaysOn,true);assert.equal(lore.version,3)
 assert.equal(table('rules').get(session.id+'__spec').ignored,undefined)
 assert.deepEqual(table('rules').get(session.id+'__spec').beauty,{regexRules:[{match:'one',replace:'two'}],css:'p{}',js:'return;'})
 const savedRules=structuredClone(table('rules').get(session.id+'__spec'))
 for(const beauty of [{regexRules:Array(201).fill({match:'x',replace:'y'})},{css:'a'.repeat(200001)},{js:'a'.repeat(100001)}]){
  await assert.rejects(commit({beauty}),/拒绝静默截断/);assert.deepEqual(table('rules').get(session.id+'__spec'),savedRules)
 }
 for(const failedTable of ['cards','worldbook','status','rules','opening']){
  const before=new Map(['cards','worldbook','status','rules','opening'].map(name=>[name,structuredClone([...table(name)])]))
  const target=table(failedTable),put=target.put.bind(target)
  target.put=async()=>{throw Error('fixture commit '+failedTable)}
  try{await assert.rejects(commit({cards:[{card_id:'partial',name:'Partial',content:failedTable}],worldbook:[{id:'partial',name:'Partial',content:failedTable}],statusSpec:failedTable,rules:{core:failedTable},opening:failedTable}),new RegExp('fixture commit '+failedTable))}
  finally{target.put=put}
  const order=['cards','worldbook','status','rules','opening'],failedIndex=order.indexOf(failedTable)
  for(let i=failedIndex;i<order.length;i++)assert.deepEqual([...table(order[i])],before.get(order[i]),'failed and later targets stay unchanged')
  for(let i=0;i<failedIndex;i++)assert.notDeepEqual([...table(order[i])],before.get(order[i]),'earlier successful targets remain committed')
 }
 assert.equal(spawns+direct,0)
 for(const dispose of cleanup)dispose()
 console.log('tavern-loop=authoring=ok (structured commit compatibility, write order, partial failure and beauty limits)')
 process.exit(0)
}
if(scenario==='diagnosis'){
 const branch=table('branch'),rows=[],turnStart=1_000_000
 session.events.push({seq:0,type:'turn/start',time:turnStart,data:{turn:1}});session.seq=1
 for(let i=0;i<14;i++)branch.set('tavern_job__diag-'+i,{schemaVersion:1,id:'diag-'+i,sessionId:session.id,kind:'memory',status:'failed',createdAt:i,updatedAt:100+i,error:'SYNTHETIC_PRIVATE_ERROR',input:{system:'SYNTHETIC_PRIVATE_PROMPT'},source:{private:'SYNTHETIC_PRIVATE_SOURCE'}})
 const add=(id,startedAt,source,status='completed',extra={})=>{
  const row={schemaVersion:1,id,sessionId:session.id,ownerSessionId:session.id,provider:'fixture',model:startedAt%2?'odd':'even',kind:'memory',status,startedAt,completedAt:null,durationMs:10,firstTokenMs:null,usage:null,source:{kind:'fixture',...source},error:'SYNTHETIC_PRIVATE_ERROR',...extra}
  rows.push(row);branch.set('tavern_usage__fixture-'+rows.length,row)
 }
 for(let i=0;i<200;i++)add('call-'+i,i*10,{jobId:'diag-'+(i%14),jobIds:['diag-13','diag-13']},i%3===0?'failed':'completed')
 add('call-199',2500,{jobId:'diag-12',jobIds:['diag-12','diag-13']},'failed',{durationMs:null})
 add('excluded-current',turnStart,{jobId:'diag-13'})
 add('excluded-foreign',3000,{jobId:'diag-13'},'completed',{ownerSessionId:'foreign'})
 table('status').set(session.id+'__panel',{html:'SYNTHETIC_PRIVATE_HTML',source:{turnId:1,sourceSeqs:[1,2]}})
 const diagnose=()=>tools.get('rp_diagnose').execute({},{agent}),result=await diagnose()
 assert.equal(result.capabilities.fourLayerMemory,true)
 assert.equal(result.enhancements.presets.tool,'rp_preset')
 assert.equal(result.enhancements.research.indexProgressIncluded,false)
 assert(!JSON.stringify(result.enhancements).includes('CUSTOM_STYLE'))
 assert.deepEqual(result.jobs.map(j=>j.id),Array.from({length:12},(_,i)=>'diag-'+(13-i)))
 const history=[...new Map(rows.filter(r=>r.ownerSessionId===session.id&&r.startedAt<turnStart).map(r=>[r.id,r])).values()].sort((a,b)=>b.startedAt-a.startedAt)
 assert.deepEqual(result.calls.map(c=>c.id),history.slice(0,12).map(c=>c.id))
 for(const job of result.jobs){
  const attempts=history.filter(r=>r.source.jobId===job.id||r.source.jobIds?.includes(job.id))
  const first=Math.min(...attempts.map(r=>r.startedAt)),ends=attempts.filter(r=>Number.isFinite(r.durationMs)).map(r=>r.startedAt+r.durationMs)
  assert.equal(job.recordedCalls,attempts.length);assert.equal(job.failedCalls,attempts.filter(r=>r.status==='failed').length)
  assert.equal(job.callSpanSeconds,ends.length?Math.round((Math.max(...ends)-first)/10)/100:null)
  assert.deepEqual(job.actualModels,[...new Set(attempts.map(r=>`${r.provider}/${r.model}`))])
  assert.equal(job.errorCode,'REASON_NOT_PROVIDED');assert.equal(job.failedAt,new Date(100+Number(job.id.slice(5))).toISOString())
 }
 assert.equal(result.calls[0].durationSeconds,null);assert.equal(result.calls[0].firstTokenSeconds,null)
 assert.equal(result.timeZone,'Asia/Shanghai (UTC+08:00)')
 assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE'))
 const count=150000
 for(let i=0;i<count;i++)add('large-'+i,10000+i,{jobId:'diag-13',jobIds:['diag-13']})
 const large=await diagnose(),job=large.jobs.find(j=>j.id==='diag-13'),previous=result.jobs.find(j=>j.id==='diag-13')
 assert.equal(job.recordedCalls,count+previous.recordedCalls,'large history must not overflow Math.min/max argument limits or double-count shared IDs')
 assert.equal(job.failedCalls,previous.failedCalls);assert.equal(large.calls.length,12)
 assert.equal(spawns+direct,0)
 for(const dispose of cleanup)dispose()
 console.log('tavern-loop=diagnosis=ok (dedupe, shared attempts, whitelist, current-turn exclusion and 150000-call history)')
 process.exit(0)
}
if(scenario==='task-tools'){
 const branch=table('branch'),id='a'.repeat(64),generation='b'.repeat(36),workflowId='fixture-card',workflowKey='tavern_cardjob__'+workflowId,taskKey='tavern_job__'+id
 const child={options:{subagentDepth:1},session:{id:'card-child',header:{origin:'subagent',parentSession:session.id,seedLength:1},events:[
  {seq:0,type:'subagent/descriptor',data:{label:'ignored seeded descriptor'}},
  {seq:1,type:'subagent/descriptor',data:{label:`Tavern:${id}:${generation}`}},
 ]}}
 const task={id,generation,sessionId:session.id,status:'running',kind:'card-import',source:{workflowType:'card',workflowId,generation:'workflow-generation'}}
 const workflow={generation:'workflow-generation',status:'running'}
 branch.set(taskKey,structuredClone(task));branch.set(workflowKey,structuredClone(workflow))
 const historyCalls=[]
 services.set('compaction',{history:(owner,args)=>{historyCalls.push({owner,args});return {owner:owner.id,action:'search'}},historyRead:(owner,args)=>{historyCalls.push({owner,args});return {owner:owner.id,action:'read'}}})
 const history=(who=child,args={action:'search',scope:'tools'})=>tools.get('rp_history').execute(args,{agent:who})
 assert.deepEqual(await history(),{owner:session.id,action:'search'})
 assert.equal(historyCalls[0].args.scope,'tools','card workflow preserves explicitly requested evidence scope')
 assert.deepEqual(await history(agent,{action:'read',scope:'tools'}),{owner:session.id,action:'read'})
 for(const bad of [{generation:'old'},{status:'cancelled'},{status:'stale'},{status:'failed'},{status:'completed'},{sessionId:'foreign'},{source:{...task.source,workflowType:'novel'}},{source:{...task.source,generation:'old'}}]){
  branch.set(taskKey,{...task,...bad});const count=historyCalls.length
  await assert.rejects(history(),/授权已失效|取消或替换/);assert.equal(historyCalls.length,count)
 }
 branch.set(taskKey,structuredClone(task))
 for(const status of ['cancelled','stale','failed','completed']){
  branch.set(workflowKey,{...workflow,status});await assert.rejects(history(),/取消或替换/)
 }
 branch.delete(workflowKey);await assert.rejects(history(),/取消或替换/);branch.set(workflowKey,workflow)
 branch.delete(taskKey);await assert.rejects(history(),/授权已失效/);branch.set(taskKey,task)
 const wrongParent={...child,session:{...child.session,header:{...child.session.header,parentSession:'foreign'}}}
 await assert.rejects(history(wrongParent),/授权已失效/)
 const invalidLabel={...child,session:{...child.session,events:[{seq:1,type:'subagent/descriptor',data:{label:'invalid'}}]}}
 await assert.rejects(history(invalidLabel),/授权已失效/)
 const seeded={...agent,session:{...session,header:{agentPreset:'roleplay',seedLength:2},events:child.session.events}}
 assert.deepEqual(await history(seeded),{owner:session.id,action:'search'},'seeded descriptors do not authorize or reject a later ordinary roleplay session')
 await assert.rejects(history({session:{id:'other',header:{agentPreset:'other'},events:[]}}),/roleplay 工具需要/)
 const settings=routes.get('/api/roleplay/character-cluster')
 let clusterRevision=0
 const toggle=enabled=>settings.fetch(new Request('https://fixture/api/roleplay/character-cluster',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:session.id,settings:{enabled},expectedRevision:clusterRevision++})}))
 assert.equal((await toggle(true)).status,200)
 const roleJob={...task,kind:'character',childSessionId:'role-child'},roleChild={options:{subagentDepth:1,tavernTaskId:id},session:{id:'role-child',header:{origin:'subagent'},events:[]}}
 branch.set(taskKey,roleJob)
 assert.deepEqual(await history(roleChild,{action:'read',scope:'tools',limit:100,maxChars:99999}),{owner:session.id,action:'read'})
 assert.equal(historyCalls.at(-1).args.scope,'story');assert.equal(historyCalls.at(-1).args.limit,8);assert.equal(historyCalls.at(-1).args.maxChars,12000)
 branch.set(taskKey,{...roleJob,childSessionId:'foreign'});await assert.rejects(history(roleChild),/授权已失效/)
 branch.set(taskKey,{...roleJob,status:'completed'});await assert.rejects(history(roleChild),/授权已失效/)
 branch.set(taskKey,roleJob);assert.equal((await toggle(false)).status,200);await assert.rejects(history(roleChild),/世界线已失效/)
 branch.set(taskKey,task)
 await assert.rejects(services.get('roleplay').nativeTask({session,agent,kind:'decision',system:'fixture task',user:'source'}),{code:'TAVERN_INLINE_PENDING'})
 const pending=[...branch.values()].find(record=>record.kind==='decision'&&record.input?.system==='fixture task')
 const material=await tools.get('rp_task_read').execute({id:pending.id},{agent:child})
 assert.equal(material.branchId,session.id)
 const submitted=await tools.get('rp_task_submit').execute({id:pending.id,generation:pending.generation,result:{ok:'accepted'}},{agent:child})
 assert.deepEqual(submitted,{ok:true,result:{ok:'accepted'}})
 assert.equal(branch.get('tavern_job__'+pending.id).status,'completed')
 assert.equal(tools.get('rp_task_read').timeoutMs,120000)
 assert.deepEqual(tools.get('rp_task_read').output.render({},'plain'),[{type:'text',text:'plain'}])
 assert.equal(tools.get('rp_task_read').output.render({},{ok:true})[0].text,JSON.stringify({ok:true},null,2))
 assert.equal(spawns+direct,0)
 for(const dispose of cleanup)dispose()
 console.log('tavern-loop=task-tools=ok (seed boundaries, task/workflow generations, parent ownership and character history limits)')
 process.exit(0)
}
if(scenario==='session-actions'){
 const call=(name,args)=>tools.get(name).execute(args,{agent}),command=(name,rawInput)=>commands.get(name).handler({agent,rawInput})
 assert.deepEqual([...commands.keys()].sort(),['branch','export-novel','regenerate','roll','scene','worldbook'])
 session.append('turn/start',{turn:1})
 const rollTable=table('rolls'),rollKey=session.id+'__log',legacy=[{spec:'1d1',rolls:[1],total:1,atSeq:0}]
 rollTable.set(rollKey,legacy)
 assert.equal((await call('rp_roll',{spec:'invalid'})).ok,false)
 const rolled=await call('rp_roll',{spec:' 2d1+3 ',reason:'fixture'})
 assert.equal(rolled.total,5);assert.deepEqual(rolled.rolls,[1,1]);assert.equal(rolled.spec,' 2d1+3 ')
 assert.equal(rollTable.get(rollKey).schemaVersion,1)
 assert.deepEqual(rollLogEntries(rollTable.get(rollKey))[0],legacy[0]);assert.equal(legacy.length,1)
 const capped=await call('rp_roll',{spec:'999d1001-2'})
 assert.equal(capped.rolls.length,100);assert.ok(capped.rolls.every(n=>n>=1&&n<=1000));assert.equal(capped.total,capped.rolls.reduce((a,b)=>a+b,0)-2)
 assert.equal((await call('rp_roll',{spec:'0d0'})).total,1)
 assert.equal((await command('roll','invalid')).kind,'error')
 const slash=await command('roll',' 2d1-1 ')
 assert.equal(slash.kind,'success');assert.match(slash.text,/1 \+ 1 - 1 = \*\*1\*\*/)
 const log=structuredClone(rollTable.get(rollKey)),putRoll=rollTable.put.bind(rollTable)
 rollTable.put=async()=>{throw Error('fixture roll write')}
 await assert.rejects(call('rp_roll',{spec:'1d1'}),/fixture roll write/)
 await assert.rejects(command('roll','1d1'),/fixture roll write/)
 assert.deepEqual(rollTable.get(rollKey),log);rollTable.put=putRoll
 const scenes=table('scene'),sceneKey=session.id+'__current'
 scenes.set(sceneKey,{place:'old',positions:{alice:'door'},extension:{keep:true}})
 const oldScene=structuredClone(scenes.get(sceneKey)),putScene=scenes.put.bind(scenes)
 scenes.put=async()=>{throw Error('fixture scene write')}
 await assert.rejects(call('rp_scene_set',{place:'new',positions:{bob:'gate'}}),/fixture scene write/)
 await assert.rejects(command('scene','new'),/fixture scene write/)
 assert.deepEqual(scenes.get(sceneKey),oldScene);scenes.put=putScene
 await call('rp_scene_set',{place:'new',present:['alice',7],positions:{bob:'gate'},moods:{alice:'calm'}})
 assert.deepEqual(scenes.get(sceneKey).positions,{alice:'door',bob:'gate'})
 assert.deepEqual(scenes.get(sceneKey).present,['alice','7']);assert.equal(scenes.get(sceneKey).updatedAtSeq,0)
 assert.deepEqual(scenes.get(sceneKey).extension,{keep:true})
 assert.equal((await command('scene',' courtyard ')).kind,'success')
 assert.equal(scenes.get(sceneKey).place,'courtyard');assert.match((await command('scene','')).text,/courtyard/)
 rollTable.set(rollKey,Array.from({length:15},(_,i)=>({total:i})))
 table('memory').set(session.id+'__head',{deltas:[1,2],pendingConfirmations:[1,2,3,4,5,6],lockedFacts:['a']})
 const state=await call('rp_state',{})
 assert.deepEqual(state.rolls.map(r=>r.total),[5,6,7,8,9,10,11,12,13,14])
 assert.deepEqual(state.memory,{deltaCount:2,pendingConfirmations:[2,3,4,5,6],lockedFactCount:1,version:1})
 table('worldbook').set(session.id+'__gate',{id:'gate',name:'Gate',keywords:['KEY'],content:'OWN_LORE'})
 table('worldbook').set('foreign__gate',{id:'gate',name:'Gate',content:'FOREIGN_LORE'})
 const lore=await command('worldbook','key');assert.match(lore.text,/OWN_LORE/);assert.ok(!lore.text.includes('FOREIGN_LORE'))
 assert.match((await command('worldbook','missing')).text,/没有匹配/)
 assert.match((await command('branch')).text,new RegExp(session.id))
 assert.match((await command('regenerate')).text,/已停用/)
 assert.equal((await command('export-novel')).kind,'error','missing archived-history service is reported as a command error')
 services.set('compaction',{storyEvidence:()=>[{seq:0,kind:'user',text:'Open the gate'},{seq:1,kind:'assistant',text:'The gate opens.'}]})
 session.header.cwd=createTestDirectory('session-actions-')
 const exported=await command('export-novel')
 assert.equal(exported.kind,'success');assert.equal(inbox.at(-1).source.jobKind,'novel-export')
 const exportId=inbox.at(-1).source.jobId
 assert.ok(exported.text.includes(exportId));assert.equal(table('branch').get('tavern_novel__'+exportId).status,'queued')
 for(const c of commands.values())assert.equal((await c.handler({agent:{session:{...session,header:{agentPreset:'other'}}},rawInput:'1d1'})).kind,'error')
 assert.equal(spawns+direct,0)
 for(const dispose of cleanup)dispose()
 console.log('tavern-loop=session-actions=ok (legacy rolls, scene merges, failure isolation, state tails and six commands)')
 process.exit(0)
}
if(scenario==='author-tools'){
 const call=(name,args,extra={})=>tools.get(name).execute(args,{agent,...extra}),cards=table('cards'),worldbook=table('worldbook'),branch=table('branch')
 session.append('turn/start',{turn:7})
 await call('rp_card_set',{card_id:'hero',name:'Hero',content:'original',locked:true})
 const cardKey=session.id+'__hero'
 cards.get(cardKey).legacy={keep:true}
 const before=structuredClone(cards.get(cardKey)),cardsPut=cards.put.bind(cards)
 cards.put=async()=>{throw Error('fixture card write')}
 await assert.rejects(call('rp_card_set',{card_id:'hero',content:'edited'}),/fixture card write/)
 assert.deepEqual(cards.get(cardKey),before)
 cards.put=cardsPut
 await call('rp_card_set',{card_id:'hero',content:'edited'})
 const after=cards.get(cardKey)
 assert.equal(after.version,2);assert.equal(after.locked,false);assert.equal(after.verified,false)
 assert.deepEqual(after.legacy,{keep:true});assert.equal(after.editedFrom.sha256,recordSha256(before));assert.equal(after.editedFrom.seq,0)
 assert.equal((await call('rp_card_set',{card_id:'bad/id',content:'bad'})).ok,false)
 cards.set('other__hero',{id:'foreign',content:'foreign'})
 const listed=await call('rp_card_list',{})
 assert.equal(listed.cards.length,1);assert.equal(listed.cards[0].chars,6);assert.equal(listed.cards[0].content,undefined)
 const args={id:'gate',name:'Gate',kind:'place',content:'original gate',keywords:['gate'],locked:true}
 assert.equal((await call('rp_worldbook_add',args)).ok,true)
 assert.equal((await call('rp_worldbook_add',args)).ok,false)
 const key=session.id+'__gate',legacy=worldbook.get(key)
 legacy.extension={keep:true};const old=structuredClone(legacy),put=worldbook.put.bind(worldbook)
 worldbook.put=async()=>{throw Error('fixture lore write')}
 await assert.rejects(call('rp_worldbook_update',{id:'gate',content:'changed',keywords:['new']}),/fixture lore write/)
 assert.deepEqual(worldbook.get(key),old)
 worldbook.put=put
 await call('rp_worldbook_update',{id:'gate',content:'changed',priority:0,token_budget:0,locked:false,aliases:['door']})
 assert.equal(worldbook.get(key).version,2);assert.equal(worldbook.get(key).tokenBudget,400)
 assert.deepEqual(worldbook.get(key).keywords,['gate']);assert.deepEqual(worldbook.get(key).extension,{keep:true})
 assert.equal(worldbook.get(key).locked,false)
 worldbook.set('other__gate',{id:'foreign',name:'Foreign',content:'foreign',keywords:['gate']})
 assert.deepEqual((await call('rp_worldbook_list',{})).entries.map(e=>e.id),['gate'])
 const remove=worldbook.delete.bind(worldbook)
 worldbook.delete=async()=>{throw Error('fixture lore delete')}
 await assert.rejects(call('rp_worldbook_remove',{id:'gate'}),/fixture lore delete/)
 assert.equal(worldbook.get(key).version,2);worldbook.delete=remove
 assert.equal((await call('rp_worldbook_remove',{id:'missing'})).ok,true)
 const success=await call('rp_worldbook_search',{query:' gate ',max_tokens:6000},{rootCallId:'root-call',callId:'nested-call'})
 assert.equal(success.ok,true);assert.match(success.text,/changed/)
 const loreKey=session.id+'__cluster-lore-0'
 assert.equal(branch.get(loreKey).callId,'root-call');assert.equal(branch.get(loreKey).turn,7)
 assert.equal(branch.get(loreKey).sourceHash,success.sourceHash)
 assert.equal((await call('rp_worldbook_search',{query:' '.repeat(4)})).ok,false)
 assert.equal((await call('rp_worldbook_search',{query:'a'.repeat(2401)})).ok,false)
 // Each query yields after capturing the source digest. Change the backing
 // records in that gap without replacing the actual regex or storage APIs.
 for(const mutation of ['edit','add','delete','foreign']){
  worldbook.set(key,{...old,keywords:['/gate/i'],tavern:{useRegex:true}})
  branch.delete(loreKey)
  const entries=worldbook.entries.bind(worldbook);let reads=0
  worldbook.entries=function(){
   const iterator=entries();reads++
   if(reads===2)queueMicrotask(()=>{
    if(mutation==='edit')worldbook.get(key).content='raced'
    if(mutation==='add')worldbook.set(session.id+'__added',{id:'added',content:'raced'})
    if(mutation==='delete')worldbook.delete(key)
    if(mutation==='foreign')worldbook.get('other__gate').content='raced foreign'
   })
   return iterator
  }
  let result
  try{result=await call('rp_worldbook_search',{query:'gate'})}finally{worldbook.entries=entries}
  assert.equal(result.ok,mutation==='foreign',mutation)
  assert.equal(branch.has(loreKey),mutation==='foreign',`${mutation}: only current evidence is persisted`)
  worldbook.delete(session.id+'__added')
 }
 await call('rp_worldbook_remove',{id:'gate'});assert.equal(worldbook.has(key),false)
 assert.equal(worldbook.has('other__gate'),true);assert.equal(spawns+direct,0)
 for(const dispose of cleanup)dispose()
 console.log('tavern-loop=author-tools=ok (seven tools, provenance, write failures, branch scope and search races)')
 process.exit(0)
}
if(scenario==='loop-contract'){
 const pre=hooks.get('agent/pre-step')[0],stop=hooks.get('agent/turn-stopping')[0],branch=table('branch')
 const player={id:'contract-player',role:'user',source:{kind:'user'},content:text('Wait at the gate')}
 const payload={agent,turn:1,step:1,messages:[player],signal:new AbortController().signal}
 const skipped={kind:'reject'},before=structuredClone([...branch])
 for(const excluded of [{...agent,session:{...session,header:{agentPreset:'other'}}},{...agent,options:{...agent.options,subagentDepth:1}}]){
  let nextCalls=0
  assert.equal(await pre({...payload,agent:excluded},async()=>{nextCalls++;return skipped}),skipped)
  assert.equal(nextCalls,1);assert.deepEqual([...branch],before);assert.equal(inbox.length,0)
 }
 let nextCalls=0,prepares=0,resumes=0
 const put=branch.put.bind(branch),prepKey=session.id+'__task-preparation'
 services.set('compaction',{prepareForTurn(){prepares++;return {status:'ready'}},directorNotes:()=>({text:''})})
 branch.put=async(key,value)=>{if(key===prepKey)throw Error('fixture preparation write failed');return put(key,value)}
 await assert.rejects(pre(payload,async()=>{nextCalls++;return {kind:'enter',messages:[player]}}),/preparation write failed/)
 assert.equal(nextCalls,0);assert.equal(prepares,0);assert.equal(branch.get(prepKey),undefined)
 branch.put=put
 // A new player step 1 retires an unrelated completed inline batch even when
 // another inline job is still pending. The receipt is program-created; the
 // old phase remains append-only evidence outside the current surface.
 session.append('turn/start',{turn:0})
 const settledStory=session.append('assistant/message',{turn:0,step:2,message:{id:'settled-story',content:text('旧维护前的正文。')}},{surfaceOp:'append'})
 const settledJob={schemaVersion:1,id:'settled-inline',sessionId:session.id,branchId:session.id,kind:'status',status:'completed',execution:'inline',generation:'settled-generation',main:{provider:'fixture',model:'main'},actualRoute:{provider:'fixture',model:'main'},source:{},sourceHash:'settled-source',input:{system:'settled maintenance'},result:{title:'已保存'}}
 const pendingJob={schemaVersion:1,id:'pending-inline',sessionId:session.id,branchId:session.id,kind:'decision',status:'running',execution:'inline',generation:'pending-generation',main:{provider:'fixture',model:'main'},actualRoute:{provider:'fixture',model:'main'},source:{},sourceHash:'pending-source',input:{system:'pending maintenance'}}
 branch.set('tavern_job__settled-inline',settledJob);branch.set('tavern_job__pending-inline',pendingJob)
 session.append('user/message',{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'after-story',schemaVersion:1,turn:0,storySeq:settledStory.seq},content:text(inlineTaskInstruction([{...settledJob,status:'running'}]))},{surfaceOp:'append'})
 session.append('turn/end',{turn:0,reason:{kind:'completed'}},{surfaceOp:undefined})
 const settledPhaseSeq=session.events.at(-2).seq
 assert.equal(await pre(payload,async()=>skipped),skipped)
 assert.ok(session.events.some(e=>e.data?.source?.form==='maintenance-receipt'&&e.data.source.sourceTurn===0),'step 1 emits a recovery receipt for settled maintenance')
 assert.ok(!session.surface.nodes.includes(settledPhaseSeq),'settled maintenance phase is retired from the active surface')
 assert.equal(branch.get('tavern_job__pending-inline').status,'running','an unrelated pending job does not block settled recovery')
 branch.delete('tavern_job__settled-inline');branch.delete('tavern_job__pending-inline')
 // A delivered draft retires before import even while an independent task is pending.
 const draftDir=createTestDirectory('loop-delivered-draft-'),draftBody='# Checked role card\nComplete fixture card.'
 const previousCwd=session.header.cwd
 try{
  session.header.cwd=draftDir;writeFileSync(join(draftDir,'card.md'),draftBody)
  session.append('turn/start',{turn:0})
  const call=(id,name,proof)=>{
   const e=session.append('assistant/message',{turn:0,message:{content:[{type:'tool-call',id,name,arguments:'{}'}]}},{surfaceOp:'append'})
   session.append('tool/result',{turn:0,message:{source:{kind:'tool',callId:id},content:[{type:'tool-result',toolCallId:id,content:text(JSON.stringify(proof))}]}},{surfaceOp:'append'});return e
  }
  const research=call('draft-begin','rp_card_draft_check',{ok:true,mode:'authoring'})
  call('draft-check','rp_card_draft_check',{ok:true,schemaVersion:1,sourcePath:'card.md',sha256:createHash('sha256').update(draftBody).digest('hex'),errors:[],statusRendering:{renderable:true}})
  const delivery=session.append('assistant/message',{turn:0,message:{content:text('Delivered card.md; independent verification still pending.')}},{surfaceOp:'append'})
  session.append('turn/end',{turn:0,reason:{kind:'completed'}})
  branch.set('tavern_job__pending-inline',pendingJob)
  await pre(payload,async()=>skipped)
  assert.ok(!session.surface.nodes.includes(research.seq),'pending task must not pin a delivered draft prelude')
  assert.ok(session.surface.nodes.includes(delivery.seq),'delivery and remaining-work notice survive')
  assert.equal(branch.get('tavern_job__pending-inline').status,'running')
 }finally{
  session.header.cwd=previousCwd;branch.delete('tavern_job__pending-inline');rmSync(draftDir,{recursive:true,force:true})
 }
 assert.equal(branch.get(prepKey).status,'preparing','a stopped native decision retains resumable preparation')
 assert.equal(prepares,0)
 const resumed=await pre({...payload,step:2,messages:[]},async()=>({kind:'enter',messages:[player],startsRequestSeries:true}))
 assert.equal(resumed.startsRequestSeries,true,'native request-series metadata survives preparation')
 assert.equal(resumed.messages.filter(m=>m.id===player.id).length,1)
 assert.equal(branch.get(prepKey).status,'completed');assert.equal(prepares,1)
 // Retrieval evidence in the same player turn has no completed-turn proof and
 // must remain visible until a later step/turn can establish story usage.
 session.append('turn/start',{turn:1})
 const sameTurnRead=session.append('assistant/message',{turn:1,step:1,message:{id:'same-turn-read',content:[{type:'tool-call',id:'read-1',name:'rp_history',arguments:'{}'}]}},{surfaceOp:'append'})
 const sameTurnResult=session.append('tool/result',{turn:1,step:1,message:{source:{kind:'tool',callId:'read-1'},content:[{type:'tool-result',toolCallId:'read-1',content:[{type:'text',text:'same-turn evidence'}]}]}},{surfaceOp:'append'})
 await pre({...payload,step:1,messages:[player]},async()=>skipped)
 assert.ok(session.surface.nodes.includes(sameTurnRead.seq)&&session.surface.nodes.includes(sameTurnResult.seq),'same-turn retrieval evidence is not retired before story commit and turn completion')
 const phase={kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'character-cast'}
 session.append('user/message',{source:phase,content:text('cast pending')},{surfaceOp:'append'})
 assert.equal(await pre({...payload,step:2,messages:[]},async()=>skipped),skipped)
 const disabled=await pre({...payload,step:2,messages:[]},async()=>({kind:'enter',messages:[player]}))
 assert.equal(disabled.messages[0].source.stage,'story');assert.equal(prepares,1,'disabled cast resumes without preparing again')
 session.append('turn/start',{turn:2})
 const nativeTask=services.get('roleplay').nativeTask
 await assert.rejects(nativeTask({session,agent,kind:'memory',system:'fixture memory',user:'notes',format:'text',taskStage:'notes'}),{code:'TAVERN_INLINE_PENDING'})
 const resumeKey=session.id+'__task-memory-resume'
 services.set('compaction',{async resumeTask(){resumes++;throw new InlinePending(branch.get(resumeKey).source.taskId)}})
 const management=await pre({...payload,turn:2,step:2,messages:[]},async()=>{nextCalls++;return skipped})
 assert.equal(management.messages[0].source.stage,'management');assert.equal(nextCalls,0);assert.equal(resumes,1)
 assert.equal(branch.get(resumeKey).status,'pending')
 services.set('compaction',{async resumeTask(){resumes++}})
 assert.equal(await pre({...payload,turn:2,step:2,messages:[]},async()=>skipped),skipped)
 assert.equal(branch.get(resumeKey).status,'completed');assert.equal(resumes,2)
 const attemptKey=session.id+'__task-steering-2'
 for(const attempt of [1,2]){await stop({agent,turn:2,signal:payload.signal});assert.equal(branch.get(attemptKey).attempt,attempt)}
 await assert.rejects(nativeTask({session,agent,kind:'decision',system:'fixture decision',user:'second task'}),{code:'TAVERN_INLINE_PENDING'})
 for(const attempt of [1,2,3]){await stop({agent,turn:2,signal:payload.signal});assert.equal(branch.get(attemptKey).attempt,attempt)}
 await assert.rejects(stop({agent,turn:2,signal:payload.signal}),/酒馆维护尚未完成/)
 assert.equal(branch.get(attemptKey).attempt,4)
 assert.equal(inbox.length,5,'only the first three attempts per fingerprint steer the main loop')
 const failed=[...branch.values()].filter(record=>record.id&&record.input)
 assert.equal(failed.length,2);assert.ok(failed.every(record=>record.status==='failed'))
 assert.equal(spawns+direct,0)
 for(const dispose of cleanup)dispose()
 console.log('tavern-loop=loop-contract=ok (short circuits, preparation write barrier, inline recovery, steering limit and fingerprint reset)')
 process.exit(0)
}
if(scenario==='character-cluster'){
  const endpoint=routes.get('/api/roleplay/character-cluster')
  const request=body=>endpoint.fetch(new Request('https://fixture/api/roleplay/character-cluster'+(body?'':'?sessionId='+session.id),body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:session.id,...body})}:{}))
  assert.equal((await (await request()).json()).settings.enabled,false)
  assert.equal((await request({settings:{enabled:true},expectedRevision:0})).status,200)
  assert.equal((await request({settings:{enabled:false},expectedRevision:0})).status,409)
  await tools.get('rp_card_set').execute({card_id:'alice',name:'Alice',content:'Her private history',kind:'npc'},{agent})
  await tools.get('rp_card_set').execute({card_id:'bob',name:'Bob',content:'His private history',kind:'npc'},{agent})
  assert.equal((await (await request()).json()).characters.length,2)
  assert.match(sections.get('roleplay:character-cluster').text({agent}),/rp_character_cast/)
  const branch=table('branch'),captured=[]
  session.append('turn/start',{turn:7})
  await branch.put(session.id+'__task-snapshot-7',{schemaVersion:1,userText:'Wait at the gate'})
  await table('rules').put(session.id+'__spec',{core:'CORE',narrative:'FORBIDDEN_NARRATIVE',css:'FORBIDDEN_CSS'})
  session.append('tool/result',{message:{source:{callId:'lore-1'}}},{surfaceOp:'append'})
  await branch.put(session.id+'__cluster-lore-1',{schemaVersion:1,seq:1,turn:7,callId:'lore-1',text:'CURRENT_LORE'})
  await branch.put(session.id+'__cluster-lore-old',{schemaVersion:1,seq:0,turn:1,text:'FORBIDDEN_OLD_LORE'})
  services.set('compaction',{directorNotes:()=>({text:'DIRECTOR_NOTES'}),history:(s,args)=>({sessionId:s.id,scope:args.scope}),historyRead:(s,args)=>({sessionId:s.id,scope:args.scope})})
  ctx.subagents.start=async(_,r)=>{captured.push(r);const id='role-child-'+captured.length
    return {id,result:new Promise(resolve=>setTimeout(async()=>{
      const child={options:{...r.agentOptions,subagentDepth:1},session:{id,header:{origin:'subagent'},events:[]}}
      const assembly={sections:[{name:'roleplay:cards',text:'FORBIDDEN_OTHER_PERSON'},{name:'deployment:persona',text:'FORBIDDEN_MAIN'},{name:'sandbox:policy',text:'native policy'}],contexts:[{name:'roleplay:state',text:'FORBIDDEN_STATE'},{name:'approval:policy',text:'native approval'}],tools:[{name:'rp_history'},{name:'rp_card_set'},{name:'subagent'}],variables:{}}
      const filtered=await hooks.get('system-prompt/assemble')[0](assembly,{agent:child},async()=>assembly)
      assert.deepEqual(filtered.tools.map(t=>t.name),['rp_history'])
      assert.ok(!JSON.stringify(filtered).includes('FORBIDDEN'))
      assert.ok(filtered.sections.some(s=>s.name==='sandbox:policy'))
      assert.ok(guards.some(g=>g({agent:child,name:'rp_card_set'})))
      assert.deepEqual(await tools.get('rp_history').execute({action:'read',seq:1,scope:'tools'},{agent:child}),{sessionId:session.id,scope:'story'})
      resolve({stopReason:'completed',output:[{type:'text',text:'I wait'}]})
    },5)),dispose(){}}
  }
  const deferred=[],inboxBefore=inbox.length,cast=()=>tools.get('rp_character_cast').execute({character_ids:['alice','bob']},{agent,deferContext:message=>deferred.push(message)})
  const [result,duplicate]=await Promise.all([cast(),cast()])
  assert.deepEqual(duplicate,result);assert.equal(deferred.length,2);assert.ok(deferred.every(message=>message.source.stage==='story'))
  assert.equal(inbox.length,inboxBefore,'deferred context does not wake the agent')
  assert.equal(result.characters.length,2);assert.equal(captured.length,2)
  for(const r of captured){const input=JSON.parse(r.prompt[0].text);assert.equal(input.core,'CORE');assert.equal(input.directorNotes,'DIRECTOR_NOTES');assert.deepEqual(input.worldbook,['CURRENT_LORE']);assert.ok(!r.prompt[0].text.includes('FORBIDDEN'));assert.equal(r.agentOptions.model,'main')}
  await tools.get('rp_character_cast').execute({character_ids:['alice']},{agent})
  assert.equal(captured.length,2,'repeat cast does not generate a second batch')
  session.append('turn/start',{turn:8});await branch.put(session.id+'__task-snapshot-8',{userText:'import'})
  session.append('tool/call',{turn:8,name:'rp_card_import_begin'})
  await assert.rejects(tools.get('rp_character_cast').execute({character_ids:['alice']},{agent}),/读卡/)
  session.append('turn/start',{turn:9})
  const player={id:'cluster-player-9',role:'user',source:{kind:'user'},content:text('走进庭院')}
  const before=await hooks.get('agent/pre-step')[0]({agent,turn:9,step:1,messages:[player],signal:new AbortController().signal},async()=>({kind:'enter',messages:[player]}))
  assert.equal(before.messages[0].source.stage,'character-cast','enabled story starts with explicit cast phase')
  for(const message of before.messages)session.append('user/message',message,{surfaceOp:'append'})
  const premature=session.append('assistant/message',{turn:9,message:{content:text('premature prose')}},{surfaceOp:'append'})
  assert.ok(internalTaskSeqs(session).has(premature.seq),'prose before cast cannot become canonical story')
  await hooks.get('agent/turn-stopping')[0]({agent,turn:9,signal:new AbortController().signal})
  assert.equal(inbox.at(-1).source.castReminder,true)
  session.append('user/message',inbox.at(-1),{surfaceOp:'append'})
  await assert.rejects(hooks.get('agent/turn-stopping')[0]({agent,turn:9,signal:new AbortController().signal}),/未完成角色选角/)
  console.log('character-cluster core integration passed');for(const dispose of cleanup)dispose();process.exit(0)
}
assert.equal(tools.has('rp_status_set'),false,'retired status tool must not be registered, including dynamic tool lookup')
assert.ok(guards.some(g=>g({agent,name:'rp_status_set'})),'stale tool calls must be denied before execution')
const diagnostic=await tools.get('rp_diagnose').execute({}, {agent})
assert.equal(diagnostic.sessionId,session.id)
assert.equal(diagnostic.schemaVersion,1)
assert.equal(direct+spawns,0,'diagnostic snapshot cannot call a model')
assert.ok(diagnostic.window.contextWindowTokens>0)
assert.equal(diagnostic.capabilities.legacyStatusTool,false)
assert.deepEqual(Object.keys(diagnostic.window),['contextWindowTokens','continuityTailTokens','autoNotesEveryTurns'],'legacy compression parameters cannot be mistaken for history capacity')
{
  const cwd=mkdtempSync(join(tmpdir(),'dsh-draft-'))
  const draftAgent={...agent,session:{...session,header:{...session.header,cwd}}}
  try{
    const beginDraft=await tools.get('rp_card_draft_check').execute({},{agent:draftAgent})
    assert.equal(beginDraft.mode,'authoring');assert.equal(beginDraft.checklist.length,12)
    const review=beginDraft.checklist.map(c=>({id:c.id,section:'测试卡',basis:'default'}))
    const path=join(cwd,'card.md')
    const statusAssets='```html\n<div class="status">Ready</div>\n```\n```css\n.status { color: red; }\n```'
    const draftWith=(body)=>`# 测试卡\n${statusAssets}\n${body}`
    writeFileSync(path,draftWith('```json\n[{"match":"hello","replace":"hi"},{"match":"world","replace":"book"}]\n```\nhello world'))
    const missing=await tools.get('rp_card_draft_check').execute({source_path:path},{agent:draftAgent})
    assert.equal(missing.ok,false);assert.equal(missing.errors.length,12,'structural validity cannot replace the twelve author reviews')
    const valid=await tools.get('rp_card_draft_check').execute({source_path:path,review},{agent:draftAgent})
    assert.equal(valid.ok,true);assert.equal(valid.regexRules,2);assert.match(valid.sha256,/^[a-f0-9]{64}$/)
    assert.equal(valid.statusRendering.renderable,true);assert.equal(valid.statusRendering.cssBlocks,1)
    writeFileSync(path,`# 测试卡\n位置：庭院\n${'```json\n[{"match":"hello","replace":"hi"},{"match":"world","replace":"book"}]\n```\nhello world'}`)
    const fields=await tools.get('rp_card_draft_check').execute({source_path:path,review},{agent:draftAgent})
    assert.equal(fields.ok,true);assert.equal(fields.statusRendering.renderable,true);assert.equal(fields.statusRendering.mode,'fields');assert.equal(fields.statusRendering.cssBlocks,0)
    writeFileSync(path,draftWith('```json\n[{"match":"hello","replace":"hi"},{"match":"world","replace":"book"}]\n```\nhello world').replace(statusAssets,'```css\n.status { color: red; }\n```'))
    const missingStatus=await tools.get('rp_card_draft_check').execute({source_path:path,review},{agent:draftAgent})
    assert.equal(missingStatus.ok,false);assert.ok(missingStatus.errors.some(error=>error.includes('缺少完整 HTML 模板')))
    writeFileSync(path,draftWith('```json\n[{"match":"hello","replace":"hi"},{"match":"world","replace":"book"}]\n```\nhello world').replace(statusAssets,'```html\n<div class="status">Ready</div>\n```')+'\n```css\n.status { color: red; }')
    const unclosedCss=await tools.get('rp_card_draft_check').execute({source_path:path,review},{agent:draftAgent})
    assert.equal(unclosedCss.ok,false);assert.ok(unclosedCss.errors.some(error=>error.includes('CSS 代码块未闭合')))
    writeFileSync(path,draftWith('```json\n[{"match":"hello","replace":"hi"},{"match":"world","replace":"book"}]\n```\nhello world'))
    if(scenario==='same-route'){
      const before=structuredClone([...tables].map(([name,value])=>[name,[...value]]))
      for(const badReview of [[...review,review[0]],[...review,{id:'unknown',section:'测试卡',basis:'default'}],review.map((entry,i)=>i===0?{...entry,section:'missing'}:entry)]){
        const checked=await tools.get('rp_card_draft_check').execute({source_path:path,review:badReview},{agent:draftAgent})
        assert.equal(checked.ok,false);assert.ok(checked.errors.length>0)
      }
      writeFileSync(path,draftWith('```json\n'+JSON.stringify(Array.from({length:129},()=>({match:'hello',replace:'hi'})))+'\n```\nhello'))
      const limited=await tools.get('rp_card_draft_check').execute({source_path:path,review},{agent:draftAgent})
      assert.equal(limited.ok,false);assert.ok(limited.errors.some(error=>error.includes('limit')))
      // Match patterns themselves occur in the JSON source; use anchors to
      // require a real example line in the document.
      writeFileSync(path,draftWith('```json\n[{"match":"^MISSING_ONE$","replace":"a"},{"match":"^MISSING_TWO$","replace":"b"}]\n```'))
      const unmatched=await tools.get('rp_card_draft_check').execute({source_path:path,review},{agent:draftAgent})
      assert.equal(unmatched.ok,false);assert.equal(unmatched.errors.length,2)
      assert.deepEqual([...tables].map(([name,value])=>[name,[...value]]),before,'draft review remains read-only')
    }
    writeFileSync(path,draftWith('```json\n[broken]\n```').replace('# 测试卡','# 错误卡'))
    const invalid=await tools.get('rp_card_draft_check').execute({source_path:path},{agent:draftAgent})
    assert.equal(invalid.ok,false);assert.ok(invalid.errors.some(e=>e.includes('JSON')))
    await assert.rejects(tools.get('rp_card_draft_check').execute({source_path:join(cwd,'..','outside.md')},{agent:draftAgent}),/工作区/)
    assert.equal(direct+spawns,0,'authoring validation never calls a model')
  }finally{rmSync(cwd,{recursive:true,force:true})}
}
{
  const id='a'.repeat(64),key=`tavern_job__${id}`
  table('branch').set(key,{id,sessionId:session.id,allowedTools:['rp_history','subagent']})
  const child={options:{subagentDepth:1},session:{id:'child-tool-boundary',header:{seedLength:0},events:[{seq:1,type:'subagent/descriptor',data:{label:`Tavern:${id}:generation`}}]}}
  const assembly={sections:[
    {name:'harness:identity',text:'runtime identity'},
    {name:'deployment:persona',text:'task persona'},
    {name:'harness:source',text:'inspect implementation source'},
    {name:'app:web-surface',text:'open browser panels'},
    {name:'ui:deliverable-file-references',text:'link files in your final answer'},
    {name:'tool:subagent',text:'spawn more agents'},
    {name:'tool:bash',text:'run shell commands'},
    {name:'tool:rp_history',text:'query necessary history'},
    {name:'sandbox:policy',text:'sandbox boundary'},
  ],contexts:[{name:'approval:policy',text:'approval boundary'}],variables:{},tools:[{name:'subagent'},{name:'rp_history'},{name:'bash'}]}
  const filtered=await hooks.get('system-prompt/assemble')[0](assembly,{agent:child},async()=>assembly)
  assert.deepEqual(filtered.tools.map(tool=>tool.name),['rp_history'],'own-scope subagent tool cannot leak through native toolFilter')
  assert.deepEqual(filtered.sections.map(section=>section.name),['harness:identity','deployment:persona','tool:rp_history','sandbox:policy'],'maintenance must not inherit unavailable tool instructions or GUI/coding tasks')
  assert.equal(filtered.contexts,assembly.contexts,'sandbox, approval and other native runtime contexts remain intact')
  const unpublished={...child,options:{...child.options,tavernTaskId:id},session:{...child.session,events:[]}}
  const firstAssembly=await hooks.get('system-prompt/assemble')[0](assembly,{agent:unpublished},async()=>assembly)
  assert.deepEqual(firstAssembly.tools.map(tool=>tool.name),['rp_history'],'initial assembly precedes descriptor append and must already be fenced')
  assert.ok(guards.some(guard=>guard({agent:child,name:'subagent'})),'execution also denies recursive delegation')
  assert.ok(guards.some(guard=>guard({agent:child,name:'bash'})))
  assert.ok(guards.every(guard=>guard({agent:child,name:'rp_history'})===undefined))
  assert.equal(await hooks.get('system-prompt/assemble')[0](assembly,{agent},async()=>assembly),assembly,'main loop tool catalog remains intact')
  const legacyStatus={...assembly,tools:[...assembly.tools,{name:'rp_status_set'}],sections:[...assembly.sections,{name:'tool:rp_status_set',text:'generate status'}]}
  const storyTools=await hooks.get('system-prompt/assemble')[0](legacyStatus,{agent},async()=>legacyStatus)
  assert.ok(!storyTools.tools.some(t=>t.name==='rp_status_set'),'automatic maintenance owns status; the story agent must not generate the same panel first')
  assert.ok(!storyTools.sections.some(s=>s.name==='tool:rp_status_set'))
  const regular={...agent,session:{...session,header:{agentPreset:'default'}}}
  assert.equal(await hooks.get('system-prompt/assemble')[0](legacyStatus,{agent:regular},async()=>legacyStatus),legacyStatus,'ordinary agents retain their registered tools')
  table('branch').delete(key)
}
if(scenario.startsWith('shared-'))ctx.subagents.start=async(_name,request)=>{
  spawns++
  const batch=JSON.parse(request.prompt[0].text)
  assert.deepEqual(batch.tasks.map(task=>task.kind),['status','decision'],'ready status and decision must share one native child')
  assert.equal(request.agentOptions.model,'status-special')
  return {id:'shared-child',result:scenario==='shared-fallback'?Promise.reject(Object.assign(new Error('fixture timeout'),{code:'TASK_TIMEOUT'})):Promise.resolve({stopReason:'completed',structured:{results:batch.tasks.map(task=>({taskId:task.taskId,generation:task.generation,value:results(task.system)}))}}),async dispose(){}}
}
for(const [name,section] of sections)assert.equal(await section.text({agent:{...agent,options:{...agent.options,subagentDepth:1}}}),'',`${name}: maintenance child must not inherit main roleplay instructions`)
assert.ok((await sections.get('roleplay:card-workflows').text({agent})).length>100,'main retains full native card workflow instructions')
ctx.llm.listProviders=()=>[{id:'fixture'}]
ctx.llm.listModels=async()=>[{id:'main',name:'Main'},{id:'status-special',name:'Status'}]
ctx.llm.resolveModelInfo=async(provider,id)=>({provider,id,reasoning:{efforts:[{id:'low',name:'Low'},{id:'high',name:'High'}],defaultEffort:'high'}})
const catalogResponse=await routes.get('/api/roleplay/models').fetch(new Request(`https://fixture.test/api/roleplay/models?sessionId=${session.id}`))
assert.deepEqual((await catalogResponse.json()).catalog[0].reasoning,{efforts:[{id:'low',name:'Low'},{id:'high',name:'High'}],defaultEffort:'high'})
ctx.llm.resolveModelInfo=async(provider,id)=>({provider,id,reasoning:{}})
const partialCatalog=await routes.get('/api/roleplay/models').fetch(new Request(`https://fixture.test/api/roleplay/models?sessionId=${session.id}`))
assert.equal((await partialCatalog.json()).catalog.length,2,'incomplete reasoning metadata cannot hide provider models')
delete ctx.llm.resolveModelInfo
const invalidEffort=await routes.get('/api/roleplay/models').fetch(new Request('https://fixture.test/api/roleplay/models',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:session.id,scope:'session',settings:{allMain:false,routes:{status:{provider:'fixture',model:'special',reasoningEffort:'invented'}}}})}))
assert.equal(invalidEffort.status,400,'cannot save unverified effort without native catalog')
await routes.get('/api/roleplay/models').fetch(new Request('https://fixture.test/api/roleplay/models', {
  method:'POST', headers:{'content-type':'application/json'},
  body:JSON.stringify({sessionId:session.id,scope:'session',settings:{allMain:false,routes:{
    memory:{provider:'fixture',model:'main'}, status:{provider:'fixture',model:statusModel}, decision:{provider:'fixture',model:decisionModel},
  }}}),
}))
const emit=async(name,...args)=>{for(const fn of hooks.get(name)??[])await fn(...args)}
const input={id:'player-1',role:'user',source:{kind:'user'},content:text('走进庭院，看看门口的铜灯。')}
session.append('turn/start',{turn:1})
const signal=new AbortController().signal
const pre=hooks.get('agent/pre-step')[0]
const runPre=async(step,messages)=>{
  const decision=await pre({agent,turn:1,step,messages,signal},async()=>({kind:'enter',messages}))
  assert.equal(decision.kind,'enter')
  for(const m of decision.messages)session.append('user/message',m,{surfaceOp:'append'})
  return decision
}
const results=system=>system.includes('场景状态分析器')?{place:'庭院',present:[],unknown:false}
  :system.includes('记忆提取器')?{recall:'',boundaries:[],openPromises:[],newEvents:[]}
  :system.includes('状态栏渲染生成器')?{title:'庭院',fields:[{label:'位置',value:'庭院'}],options:[{label:'主状态建议'}]}
  :system.includes('正史记录员')?{deltas:[]}
  :system.includes('连续性检查员')?{verdict:'pass',conflicts:[]}
  :system.includes('轮末建议生成器')?{options:[{label:'查看铜灯'},{label:'敲门'},{label:'等待'}]}:assert.fail('unknown task')
const completePending=async()=>{
  for(let i=0;i<30;i++)await Promise.resolve()
  const pending=[...table('branch').values()].filter(j=>j.id&&j.execution==='inline'&&j.status==='queued')
  for(const job of pending){
    const material=await tools.get('rp_task_read').execute({id:job.id},{agent,signal})
    assert.equal(material.nextOffset,null)
    await tools.get('rp_task_submit').execute({id:job.id,generation:job.generation,result:results(JSON.parse(material.text).system)},{agent,signal})
  }
  return pending.length
}
await runPre(1,[input])
assert.equal(spawns,0,'ordinary turn starts without scene or recall child calls')
assert.equal(await completePending(),0,'ordinary turn has no model preparation obligations')
assert.ok(guards.every(g=>g({agent,name:'bash'})===undefined),'normal story loop tools remain available')
assert.equal(session.events.filter(e=>e.data?.id==='player-1').length,1,'original input admitted immediately and exactly once')
const residentBody='本轮可见正文：铜灯映亮了庭院。'.repeat(60),residentCore='本轮常驻核心：庭院铜灯从不熄灭。'.repeat(60),residentCard='本轮常驻人物：守门人负责铜灯。'.repeat(60)
if(scenario==='same-route'){
  table('rules').set(`${session.id}__spec`,{core:residentCore})
  table('cards').set(`${session.id}__resident`,{id:'resident',name:'守门人',content:residentCard})
  const assembly={sections:['roleplay:cards','roleplay:rules'].map(name=>({name,text:sections.get(name).text({agent})})),contexts:[],tools:[]}
  await hooks.get('system-prompt/assemble')[0](assembly,{agent},async()=>assembly)
}
let openingPhase
if(scenario==='authoring-opening'){
 session.append('tool/call',{turn:1,name:'rp_card_draft_check',callId:'draft'})
 session.append('tool/call',{turn:1,name:'ask_user_question',callId:'question'})
 for(const [name,id,proof] of [['rp_card_import_begin','begin',{ok:true,importId:'opening-import',normalizedSha256:'a'.repeat(64)}],['rp_card_import_finalize','final',{ok:true,importId:'opening-import',normalizedSha256:'a'.repeat(64),coverage:1,activatedAt:123}]]){
  session.append('assistant/message',{turn:1,message:{content:[{type:'tool-call',id,name,arguments:'{}'}]}},{surfaceOp:'append'})
  session.append('tool/call',{turn:1,name,callId:id})
  session.append('tool/result',{turn:1,message:{source:{callId:id},content:[{type:'tool-result',toolCallId:id,content:text(JSON.stringify(proof))}]}},{surfaceOp:'append'})
 }
 openingPhase=session.append('user/message',{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'story',openingImportId:'opening-import'},content:text('Show the imported opening.')},{surfaceOp:'append'})
}
const story=session.append('assistant/message',{turn:1,step:2,message:{id:'story-1',content:text(scenario==='same-route'?residentBody:'铜灯映亮了庭院。')}},{surfaceOp:'append'})
if(scenario.startsWith('status-delayed')) {
  const stopController=new AbortController()
  const stoppingSignal=scenario==='status-delayed-cancel'?stopController.signal:signal
  let stopped=false
  const stopping=emit('agent/turn-stopping',{agent,turn:1,signal:stoppingSignal}).then(()=>{stopped=true})
  stopping.catch(()=>{})
  await new Promise(resolve=>setTimeout(resolve,30))
  assert.equal(spawns,1,'held batch must dispatch before waiting on an independent child')
  assert.equal(stopped,false,'required maintenance must retain the original native turn')
  assert.ok(session.surface.nodes.includes(story.seq),'durable story remains readable during maintenance')
  assert.ok(session.events.some(e=>e.data?.source?.stage==='after-story'&&e.data.source.storySeq===story.seq),'story provenance is available before the child finishes')
  if(scenario==='status-delayed-cancel') {
    stopController.abort(new Error('fixture cancelled'))
    await Promise.race([assert.rejects(stopping,/fixture cancelled/),new Promise((_,reject)=>setTimeout(()=>reject(new Error('cancel blocked by an older task signal')),150))])
    agent.status='idle';releaseStatus();await new Promise(resolve=>setTimeout(resolve,10))
    assert.equal(inbox.length,0,'cancelled and late child results cannot wake another management turn')
    const jobs=[...table('branch').values()].filter(job=>job.id&&job.input)
    assert.ok(jobs.filter(job=>['status','decision'].includes(job.kind)).every(job=>job.status==='cancelled'),'both checkpoints remain cancelled and retryable')
    cleanup.reverse().forEach(fn=>fn())
    console.log('tavern-loop=status-delayed-cancel=ok (different owner signals, immediate stop, preserved checkpoints)')
    process.exit(0)
  }
  releaseStatus()
  await Promise.race([stopping,new Promise((_,reject)=>setTimeout(()=>reject(new Error('maintenance did not release the original turn')),1000))])
  assert.ok(!inbox.some(m=>m.source?.stage==='management'),'fallback must not open an independent management turn')
  if(scenario==='status-delayed-fallback')assert.ok(inbox.some(m=>m.source?.stage==='after-story'),'fallback is steered inside the original story turn')
}
for(let i=0;i<8;i++){
  await emit('agent/turn-stopping',{agent,turn:1,signal})
  if(inbox.length) {
    if(scenario==='same-route'&&i===0){
      const dispatched=JSON.stringify(inbox)
      assert.ok(dispatched.includes('currentContextRef'),'actual core loop uses resident context transport')
      const message=inbox.at(-1).content[0].text
      const taskPayload=JSON.parse(message.split('\n待办：\n')[1].split('\n资料引用：')[0])
      for(const task of taskPayload.filter(task=>['status','decision'].includes(task.kind)))for(const value of [residentBody,residentCore,residentCard])assert.ok(!JSON.stringify(task.input).includes(value),'main status/decision maintenance does not re-inject already resident prose/author content')
      assert.equal(inbox.at(-1).source.turn,1)
      assert.equal(typeof inbox.at(-1).source.dispatchFingerprint,'string')
      assert.ok([...table('branch').values()].filter(job=>job.kind==='status'&&job.input).every(job=>job.input.user.includes(residentBody)),'full audit sources survive inline de-duplication')
    }
    await runPre(3+i,inbox.splice(0))
    assert.ok(guards.some(g=>g({agent,name:'bash'})),'post-story maintenance still blocks unrelated code inspection')
    assert.ok(guards.every(g=>g({agent,name:'rp_task_read'})===undefined))
    for(const action of ['list','read','repair','jobs'])assert.ok(guards.every(g=>g({agent,name:'rp_setting',arguments:{action}})===undefined),'main may queue background correction after story')
    for(const action of ['patch','append','create'])assert.ok(guards.some(g=>g({agent,name:'rp_setting',arguments:{action}})),'inline maintenance cannot directly rewrite settings')
  }
  const count=await completePending()
  if(scenario==='shared-special')await new Promise(resolve=>setTimeout(resolve,10))
  if(!count)break
  const steering=inbox.splice(0)
  await runPre(3+i,steering)
  session.append('assistant/message',{turn:1,step:3+i,message:{id:`internal-post-${i}`,content:text('维护结果')}},{surfaceOp:'append'})
}
assert.equal(spawns,['same-route','background-memory','authoring-opening'].includes(scenario)?0:1,`${scenario}: exactly the incompatible/special status or decision route runs`);assert.equal(direct,0)
assert.equal(table('status').get(`${session.id}__panel`)?.atSeq,story.seq)
assert.equal(table('branch').get(`${session.id}__phaseb-1`)?.state,'completed')
const trace=table('branch').get(`${session.id}__maintenance-timing-1`)
assert.equal(trace.schemaVersion,1);assert.ok(trace.samples.some(sample=>sample.stage==='enter'))
assert.ok(trace.samples.some(sample=>['maintenance-steered','finished'].includes(sample.stage)))
assert.ok(trace.samples.every(sample=>Number.isFinite(sample.wallAt)&&Number.isFinite(sample.elapsedMs)))
if(scenario==='authoring-opening'){
 assert.equal(table('status').get(`${session.id}__panel`).provenance.sourceSeqs[0],openingPhase.seq,'status uses the activation phase, not the authoring prompt')
 for(const job of [...table('branch').values()].filter(j=>['status','decision'].includes(j.kind)&&j.input))assert.ok(!JSON.stringify(job.input).includes(input.content[0].text),'authoring request does not become the opening player action')
}
if(scenario==='background-memory') {
 assert.equal(table('branch').get(`${session.id}__phaseb-1`).memoryMode,'background-notes')
 assert.ok(scheduledMemory>0,'durable story schedules background notes')
 const jobs=[...table('branch').values()].filter(job=>job.id&&job.input)
 assert.ok(jobs.every(job=>!/(正史记录员|连续性检查员)/.test(job.input.system)),
   'background memory must eliminate both per-turn foreground ledger and continuity model calls')
 assert.equal(table('memory').get(`${session.id}__head`)?.deltas?.length??0,0,'no fabricated empty ledger commit claims new memory')
}
const decision=table('decision').get(`${session.id}__current`)
if(scenario==='shared-special') {
  const jobs=[...table('branch').values()].filter(job=>['status','decision'].includes(job.kind)&&job.id)
  assert.equal(jobs.length,2,'coalescing preserves both durable obligations')
  assert.ok(jobs.every(job=>job.status==='completed'&&job.childSessionId==='shared-child'))
  assert.equal(new Set(jobs.map(job=>job.id)).size,2,'each result retains its own identity')
  assert.equal(decision?.provenance?.reusedFrom,undefined,'shared execution is not a status-option reuse shortcut')
}
assert.equal(decision?.provenance?.actualRoute?.model,scenario==='shared-fallback'?'main':decisionModel,`${scenario}: decision provenance records its effective configured/fallback route`)
if(scenario==='shared-fallback') {
  const jobs=[...table('branch').values()].filter(job=>job.id&&['status','decision'].includes(job.kind))
  assert.equal(jobs.length,2)
  assert.ok(jobs.every(job=>job.status==='completed'&&job.execution==='inline'&&job.fallback?.from.model==='status-special'))
  assert.equal(session.events.filter(event=>event.type==='turn/start').length,1,'shared fallback must finish both obligations inside one native turn')
  assert.ok(!session.events.some(event=>event.data?.source?.stage==='management'))
}
if(['same-route','status-fallback','background-memory'].includes(scenario))assert.equal(decision?.provenance?.reusedFrom,'status',`${scenario}: compatible status result reuses options without a second decision task`)
else assert.ok(decision?.provenance?.taskId,`${scenario}: incompatible route executes a dedicated decision task`)
const end=session.append('turn/end',{turn:1,reason:{kind:'completed'}})
await emit('session/event',session,end)
const response=await routes.get('/api/roleplay/state').fetch(new Request(`https://fixture.test/api/roleplay/state?sessionId=${session.id}`))
const state=await response.json()
assert.deepEqual(state.surfaceNodes.filter(e=>e.kind==='assistant').map(e=>e.seq),[story.seq])
assert.equal(internalTaskSeqs(session).has(story.seq),false)
assert.equal(agent.options.reasoningEffort,'high')
await emit('agent/status',{agent,status:'running'})
assert.equal(table('decision').get(`${session.id}__current`).answered,false,'background maintenance waking the main loop is not a player answer')
{
  const cards=table('cards'),put=cards.put.bind(cards)
  cards.put=async(k,v)=>{await new Promise(resolve=>setTimeout(resolve,5));return put(k,v)}
  const save=content=>routes.get('/api/roleplay/set').fetch(new Request('https://fixture.test/api/roleplay/set',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:session.id,kind:'card',card_id:'race',content,expectedRevision:'missing'})}))
  assert.deepEqual((await Promise.all([save('first'),save('second')])).map(r=>r.status).sort(),[200,409],'concurrent panel saves must compare revision after earlier commit')
}
table('cards').set(`${session.id}__cache-proof`,{id:'cache-proof',name:'缓存契约人物',content:'完整人设原文'})
table('rules').set(`${session.id}__spec`,{core:'完整世界背景',plot:'未发生的路线',style:'完整文风样本'})
table('worldbook').set(`${session.id}__constant-b`,{id:'constant-b',name:'B',content:'常驻 B',alwaysOn:true})
table('worldbook').set(`${session.id}__constant-a`,{id:'constant-a',name:'A',content:'常驻 A',alwaysOn:true})
for(const name of ['roleplay:cards','roleplay:rules']){
  const first=await sections.get(name).text({agent})
  assert.equal(await sections.get(name).text({agent}),first,`${name}: real registered system section preserves cache prefix`)
  for(const tableName of ['cards','worldbook']) {
    const entries=[...table(tableName).entries()].reverse()
    table(tableName).clear()
    for(const [key,value] of entries)table(tableName).set(key,value)
  }
  assert.equal(await sections.get(name).text({agent}),first,`${name}: disk reload insertion order must not change fixed prompt bytes`)
}
table('cards').set(`${session.id}__cache-a`,{id:'cache-a',name:'首位人物',content:'人物 A'})
table('cards').set(`${session.id}__cache-z`,{id:'cache-z',name:'末位人物',content:'人物 Z'})
const firstChar=variables.get('char')({agent})
const reversedCards=[...table('cards')].reverse()
table('cards').clear()
for(const [key,value] of reversedCards)table('cards').set(key,value)
assert.equal(variables.get('char')({agent}),firstChar,'char expansion must survive disk hydration order without changing the system prefix')
if(scenario==='same-route'){
 table('cards').set(`${session.id}__locked`,{id:'locked',name:'Locked',content:'LOCKED_CARD_FACT',locked:true})
 table('worldbook').set(`${session.id}__locked`,{id:'locked',content:'LOCKED_LORE_FACT',locked:true})
 table('worldbook').set(`${session.id}__disabled-locked`,{id:'disabled-locked',content:'DISABLED_LOCKED_FACT',locked:true,enabled:false})
 table('cards').set('other__locked',{id:'locked',content:'OTHER_BRANCH_FACT',locked:true})
 table('memory').set(`${session.id}__head`,{lockedFacts:['MEMORY_STRING',{text:'MEMORY_OBJECT'},null,{text:''}]})
 assert.deepEqual(services.get('roleplay').lockedFacts(session.id),[
  {source:'card:locked',text:'LOCKED_CARD_FACT'},{source:'worldbook:locked',text:'LOCKED_LORE_FACT'},
  {source:'memory-locked',text:'MEMORY_STRING'},{source:'memory-locked',text:'MEMORY_OBJECT'},
 ])
 for(const name of ['roleplay:cards','roleplay:rules']){
  assert.equal(sections.get(name).text({agent:{...agent,options:{subagentDepth:1}}}),'',`${name}: child tasks cannot inherit author prose`)
  assert.equal(sections.get(name).text({agent:{...agent,session:{...session,header:{agentPreset:'other'}}}}),'')
 }
 const identityResponse=await routes.get('/api/roleplay/state').fetch(new Request(`https://fixture.test/api/roleplay/state?sessionId=${session.id}`))
 const identity=(await identityResponse.json()).userinfo
 assert.equal(variables.get('user')({agent}),identity.name)
 assert.equal(variables.get('user_gender')({agent}),identity.gender)
 const cards=table('cards'),entries=cards.entries
 try{cards.entries=()=>{throw Error('fixture unavailable author table')};assert.equal(sections.get('roleplay:cards').text({agent}),'')}
 finally{cards.entries=entries}
}
cleanup.reverse().forEach(fn=>fn())
console.log(`tavern-loop=${scenario}=ok (native pre/post stages, ${spawns} native spawn(s), zero direct calls, route-compatible status/decision reuse)`)
