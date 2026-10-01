import assert from 'node:assert/strict'
import { foldSessionCalls, aggregateUsage, createTelemetry, timeRange, queryUsageRequests } from '../lib/core/tavern-telemetry.js'
class Table extends Map { async put(k,v){this.set(k,structuredClone(v))} }
class IdentityTable extends Map {
  constructor(){super();this.durable=new Map()}
  async put(k,v){this.durable.set(k,structuredClone(v));if(!this.has(k))this.set(k,v)}
}
const event=(seq,type,data,time=1000+seq*100)=>({seq,type,data,time})
const usage={inputTokens:100,outputTokens:20,cacheReadTokens:900,cacheWriteTokens:0}
{
 const table=new Table(),s={id:'mixed-jobs',header:{agentPreset:'roleplay'},events:[event(0,'step/start',{}),event(1,'assistant/message',{usage})]}
 const valid={id:'valid',sessionId:s.id,childSessionId:s.id,kind:'status',status:'completed',createdAt:1}
 const jobs=[valid,null,7,{...valid,id:'broken',childSessionIds:{}},{...valid,id:'bad-time',createdAt:'yesterday'}]
 const original=structuredClone(jobs),lookups=[]
 const api=createTelemetry({table,jobs:()=>jobs,sessions:{get:id=>{assert.equal(typeof id,'string');lookups.push(id);return id===s.id?s:null}}})
 await api.ingest(s)
 const logs=api.logs()
 assert.deepEqual(logs.filter(row=>row.source?.kind==='task').map(row=>row.source.jobId),['valid'])
 assert.equal(api.calls().length,1,'job projections do not create another charge')
 assert.deepEqual(jobs,original,'malformed durable jobs are not repaired by telemetry reads')
 const before=lookups.length
 for await(const _chunk of api.observe({},async function*(){yield {type:'finish',reason:{kind:'stop'}}})){}
 assert.equal(lookups.length,before,'an unattributed stream must not resolve an absent session ID')
}
{
 const table=new IdentityTable(),s={id:'identity-stream',header:{id:'identity-stream',agentPreset:'roleplay'},events:[]}
 const api=createTelemetry({table,sessions:{get:id=>id===s.id?s:null,list:()=>[s]}})
 for await(const _chunk of api.observe({sessionId:s.id,provider:'p',model:'m'},async function*(){yield {type:'usage',usage};yield {type:'finish',reason:{kind:'stop'}}})){}
 const row=[...table.durable.values()].find(v=>v.source?.kind==='stream')
 assert.equal(row.status,'completed','stream completion is persisted when table.get preserves object identity')
 assert.equal(row.usage.inputTokens,100,'stream usage is persisted independently of the mutable logical object')
}
{
  const events=[
    event(0,'user/message',{source:{kind:'roleplay-tasks',jobKind:'status'}}),
    event(1,'step/start',{turn:1,step:1}),
    event(2,'step/start',{turn:2,step:1}),
  ]
  let iterations=0
  const iterator=events[Symbol.iterator].bind(events)
  events[Symbol.iterator]=function(){iterations++;return iterator()}
  const session={id:'observe-find-last',header:{id:'observe-find-last',agentPreset:'roleplay'},events}
  const api=createTelemetry({table:new Table(),sessions:{get:id=>id===session.id?session:null,list:()=>[session]}})
  for await(const _chunk of api.observe({sessionId:session.id,provider:'p',model:'m'},async function*(){yield {type:'finish',reason:{kind:'stop'}}})){ }
  const call=api.calls()[0]
  assert.equal(iterations,1,'observe recent-event lookup uses indexed findLast instead of copying and iterating history')
  assert.equal(call.source.startSeq,2,'observe preserves the latest step boundary')
  assert.equal(call.kind,'status','observe preserves roleplay task attribution')
}
{
 const id='a'.repeat(64),s={id:'linked-fixture',header:{agentPreset:'roleplay'},events:[event(0,'step/start',{turn:1,step:1}),event(1,'assistant/chunk',{chunk:{type:'usage',usage}}),event(2,'tool/call',{name:'rp_task_submit',arguments:{id,generation:'g',result:{private:'DO_NOT_LOG'}}}),event(3,'step/end',{})]}
 const api=createTelemetry({table:new Table(),sessions:{get:()=>s,list:()=>[s]},jobs:()=>[{id,sessionId:s.id,kind:'status',status:'completed',actualRoute:{provider:'p',model:'m'},createdAt:1,completedAt:100}]})
 await api.sync()
 const row=api.logs().find(x=>x.id===`job-${id}`)
 assert.equal(row.usage.inputTokens,100,'task logs link actual calls instead of unconditional N/A')
 assert.equal(api.calls().length,1,'task totals must never create an extra charge')
 assert.equal(row.usageSource.callIds.length,1)
 assert.ok(!JSON.stringify(api.logs()).includes('DO_NOT_LOG'))
}
{
 const failed=foldSessionCalls({id:'failure-fixture',header:{},events:[event(0,'step/start',{}),event(1,'assistant/chunk',{chunk:{type:'finish',reason:{kind:'error',failure:{status:401,code:'invalid_api_key',message:'PRIVATE_KEY'}}}}),event(2,'assistant/message',{message:{content:[]}}),event(3,'step/end',{})]})[0]
 assert.equal(failed.status,'failed','final empty assistant record cannot erase the API failure')
 assert.match(failed.error,/认证失败/)
 assert.ok(!JSON.stringify(failed).includes('PRIVATE_KEY'))
}
const session={id:'rp-a',header:{id:'rp-a',agentPreset:'roleplay'},events:[
  event(0,'step/start',{turn:1,step:1}),
  event(1,'request/header',{header:{config:{provider:'p',model:'m'}}}),
  event(2,'assistant/chunk',{turn:1,step:1,chunk:{type:'usage',usage}}),
  event(3,'llm/retry',{turn:1,step:1,failure:{code:'RATE_LIMIT',status:429}}),
  event(4,'llm/retry-started',{turn:1,step:1,retry:1}),
  event(5,'assistant/message',{turn:1,step:1,usage,message:{source:{kind:'model',provider:'p',model:'m'}}}),
  event(6,'step/end',{turn:1,step:1}),
  // Regeneration consumes again even if the original surface is replaced.
  event(7,'step/start',{turn:2,step:1}),
  event(8,'assistant/chunk',{turn:2,step:1,chunk:{type:'usage',usage}}),
  event(9,'assistant/message',{turn:2,step:1,usage,message:{source:{kind:'model',provider:'p',model:'m'}}}),
  event(10,'step/end',{turn:2,step:1}),
]}
const calls=foldSessionCalls(session)
assert.equal(calls.length,3)
assert.equal(calls[0].status,'failed')
assert.equal(calls[2].usage.inputTokens,100)
assert.equal(foldSessionCalls({...session,id:'fork',inheritedEventCount:7}).length,1,'fork history is not a second charge')
const prices={currency:'USD',rates:[{provider:'p',model:'m',input:1,output:2,cacheRead:.1,cacheWrite:null}]}
let stats=aggregateUsage(calls,{from:0,to:10000},prices)
assert.equal(stats.totals.calls,3)
assert.equal(stats.totals.inputTokens,300)
assert.equal(stats.totals.cacheReadTokens,2700)
assert.equal(stats.providers.length,1);assert.equal(stats.providers[0].provider,'p');assert.equal(stats.providers[0].calls,3)
const providerStats=aggregateUsage([calls[0],{...calls[1],model:'second'},{...calls[2],provider:'other'}],{from:0,to:10000},prices)
assert.equal(providerStats.models.length,3);assert.equal(providerStats.providers.length,2)
assert.equal(providerStats.providers[0].calls,2);assert.equal(providerStats.providers[0].pricedCalls,1)
assert.equal(providerStats.providers.reduce((sum,r)=>sum+r.inputTokens,0),providerStats.totals.inputTokens)
assert.ok(Math.abs(stats.totals.cost-.00069)<1e-12)
assert.equal(aggregateUsage(calls,{from:0,to:10000},{rates:[]}).totals.cost,null)
assert.equal(aggregateUsage([...calls,{...calls[0],id:'unknown',usage:null}],{from:0,to:10000},prices).totals.cost,null)
const mixed=aggregateUsage([{...calls[0],durationMs:3000,firstTokenMs:1000},{...calls[0],id:'fast',durationMs:500,firstTokenMs:100,usage:{...usage,outputTokens:80}}, {...calls[0],id:'missing',usage:null}],{from:0,to:10000},prices).totals
assert.equal(mixed.pricedCalls,2);assert.equal(mixed.costComplete,false);assert.ok(mixed.knownCost>0)
assert.equal(mixed.cacheHitRate,.9);assert.equal(mixed.cacheRateIncompleteCalls,1)
assert.equal(mixed.speedCalls,2);assert.ok(Math.abs(mixed.tokensPerSecond-100/2.4)<1e-12,'throughput is weighted by generation time, not an average of per-call speeds')
const incomplete=aggregateUsage([{...calls[0],durationMs:1000,firstTokenMs:null,usage:{inputTokens:100,outputTokens:10,cacheReadTokens:50,totalTokens:160}}],{from:0,to:10000},prices).totals
assert.equal(incomplete.cacheHitRate,1/3,'exact total excludes output tokens from cache denominator')
assert.equal(incomplete.tokensPerSecond,null,'missing first-token timing must not invent generation speed')
const cacheEdge=aggregateUsage([
  {...calls[0],usage:{inputTokens:50,outputTokens:10,cacheReadTokens:50,cacheWriteTokens:100}},
  {...calls[0],usage:{inputTokens:10,outputTokens:2,cacheReadTokens:null,cacheWriteTokens:0}},
  {...calls[0],status:'running',durationMs:1000,firstTokenMs:100,usage:{inputTokens:10,outputTokens:2,cacheReadTokens:0,cacheWriteTokens:0}}
],{from:0,to:10000},prices).totals
assert.equal(cacheEdge.cacheHitRate,50/210,'cache creation counts in prompt denominator; unknown reads cannot become zero misses')
assert.equal(cacheEdge.cacheRateCalls,2);assert.equal(cacheEdge.cacheRateIncompleteCalls,1);assert.equal(cacheEdge.speedCalls,0)
const requestPage=queryUsageRequests([...calls,{...calls[0],id:'missing-price',provider:'unknown',startedAt:5000,error:'HTTP 429',prompt:'must not leak'}],{from:0,to:10000,offset:0,limit:2,currency:'CNY'},prices,[],{rates:{USD:1,CNY:7}},[{id:'rp-a',label:'测试会话'}])
assert.equal(requestPage.total,4);assert.equal(requestPage.rows.length,2);assert.equal(requestPage.rows[0].id,'missing-price');assert.equal(requestPage.rows[0].cost,null)
assert.equal(requestPage.rows[1].sessionLabel,'测试会话');assert.ok(Math.abs(requestPage.rows[1].cost-.00069/3*7)<1e-12)
assert.ok(!JSON.stringify(requestPage).includes('must not leak'));assert.equal(requestPage.currency,'CNY')
assert.equal(requestPage.rows[0].error,'HTTP 429')
assert.equal(queryUsageRequests([{...calls[0],error:'Bearer secret-cookie-content'}],{from:0,to:10000},prices).rows[0].error,'原因未提供')
assert.equal(queryUsageRequests(calls,{from:0,to:10000,provider:'missing'},prices).total,0)
assert.equal(queryUsageRequests(calls,{from:0,to:10000,offset:1,limit:1},prices).rows[0].id,calls[1].id)
assert.equal(queryUsageRequests(calls,{from:0,to:10000,currency:'CNY'},prices).rows[0].pricingStatus,'missing-exchange-rate')
assert.equal(aggregateUsage(calls,{from:1700,to:10000},prices).totals.calls,1)
assert.throws(()=>timeRange({from:200,to:100}),/时间/)
const table=new Table(), telemetry=createTelemetry({table,sessions:{get:id=>id===session.id?session:null,list:()=>[session]},jobs:()=>[]})
await telemetry.sync()
await telemetry.sync()
assert.equal(telemetry.calls().length,3,'repeated ingestion is idempotent')
const stream=telemetry.observe({sessionId:'rp-a',provider:'p',model:'m',purpose:'session-title'},async function*(){yield {type:'usage',usage};yield {type:'finish',reason:{kind:'stop'}}})
for await(const chunk of stream){}
assert.equal(telemetry.calls().length,4,'direct auxiliary stream counts too')
await telemetry.sync()
assert.equal(telemetry.calls().length,4,'event replay does not double count observed calls')
// GenerateOptions.sessionId is optional in the native API. A raw maintenance
// stream must still be recorded rather than disappearing from all-call usage.
for await(const _chunk of telemetry.observe({provider:'p',model:'m'},async function*(){yield {type:'usage',usage};yield {type:'finish',reason:{kind:'stop'}}})){}
assert.equal(telemetry.calls().length,5,'unowned native stream still counts')
for await(const chunk of telemetry.observe({sessionId:'rp-a',provider:'p',model:'m'},async function*(){yield {type:'usage',usage};yield {type:'finish',reason:{kind:'error',failure:{code:'AUTH',status:401,message:'secret'}}}})){}
assert.equal(telemetry.calls().length,6)
assert.equal(telemetry.calls().at(-1).status,'failed')
assert.ok(!JSON.stringify([...table.values()]).includes('secret'))
// Multiple durable jobs can share one native child call. The call keeps all
// linked job ids, while each task log marks the shared step and exposes one
// shared call for billing.
{
 const sharedTable=new Table(),sharedSession={id:'shared-parent',header:{id:'shared-parent',agentPreset:'roleplay'},events:[]}
 await sharedTable.put('tavern_usage__shared-call',{schemaVersion:1,id:'shared-call',sessionId:'shared-child',ownerSessionId:'shared-parent',provider:'p',model:'m',kind:'status',status:'completed',startedAt:1000,completedAt:1100,durationMs:100,firstTokenMs:10,usage,source:{kind:'stream',invocationId:'shared-call',sessionId:'shared-child',startSeq:null,purpose:null}})
 const sharedJobs=[{id:'shared-a',sessionId:'shared-parent',childSessionId:'shared-child',kind:'status',status:'completed',createdAt:1,completedAt:100},{id:'shared-b',sessionId:'shared-parent',childSessionId:'shared-child',kind:'decision',status:'completed',createdAt:2,completedAt:100}]
 const sharedApi=createTelemetry({table:sharedTable,sessions:{get:id=>id===sharedSession.id?sharedSession:null,list:()=>[sharedSession]},jobs:()=>sharedJobs})
 await sharedApi.sync()
 const sharedCall=sharedApi.calls()[0]
 assert.deepEqual(sharedCall.source.jobIds.sort(),['shared-a','shared-b'],'shared native call persists all linked job ids')
 const sharedRows=sharedApi.logs().filter(row=>row.source?.kind==='task')
 assert.equal(sharedRows.length,2)
 for(const row of sharedRows){assert.equal(row.usageSource.callIds.length,1);assert.equal(row.usageSource.sharedCalls,1);assert.match(row.label,/共享步骤/)}
}
await assert.rejects(()=>telemetry.savePrices({currency:'USD',rates:[{provider:'p',model:'m',input:-1}]},0),/单价/)
await telemetry.savePrices(prices,0)
await assert.rejects(()=>telemetry.savePrices(prices,0),/更新/)
await table.put('tavern_prices',{schemaVersion:1,revision:2,currency:'USD',rates:prices.rates})
assert.equal(telemetry.prices().schemaVersion,2)
assert.equal(telemetry.prices().defaultMode,'manual','legacy USD settings retain missing-manual behavior for unconfigured routes')
// Archived/cold children remain attributed to their owner and original charges
// survive restart and deletion from the live corpus.
const cold={id:'child',header:{id:'child',agentPreset:'roleplay',origin:'subagent',parentSession:'rp-a'},events:session.events}
const coldTable=new Table(), coldApi={listSessions:async()=>[{header:session.header},{header:cold.header}],observeSession:async id=>({header:cold.header,inheritedEventCount:0,events:cold.events,[Symbol.dispose](){}})}
const recovered=createTelemetry({table:coldTable,sessions:{get:id=>id===session.id?session:null,list:()=>[session]},query:coldApi})
await recovered.sync()
assert.equal(recovered.calls().length,6)
assert.ok(recovered.calls().filter(c=>c.sessionId==='child').every(c=>c.ownerSessionId==='rp-a'))
const restarted=createTelemetry({table:coldTable,sessions:{get:()=>null,list:()=>[]},query:{listSessions:async()=>[]}})
await restarted.sync();assert.equal(restarted.calls().length,6)
// A restarted process reconciles a stale stream snapshot with the terminal
// native attempt, retaining one charge. A live stream remains protected by
// the active set during this reconciliation.
const reconcileTable=new Table(),reconcileSession={id:'reconcile',header:{id:'reconcile',agentPreset:'roleplay'},events:[
  event(0,'step/start',{turn:1,step:1},1000),
  event(1,'assistant/message',{turn:1,step:1,usage,message:{source:{provider:'p',model:'m'}}},2000),
  event(2,'step/end',{turn:1,step:1},2100)
]}
await reconcileTable.put('tavern_usage__stale-stream',{schemaVersion:1,id:'stale-stream',sessionId:'reconcile',ownerSessionId:'reconcile',provider:'p',model:'m',kind:'narrative',status:'running',startedAt:1000,completedAt:null,durationMs:null,firstTokenMs:null,usage:null,source:{kind:'stream',invocationId:'stale-stream',sessionId:'reconcile',startSeq:0,purpose:null}})
const reconciled=createTelemetry({table:reconcileTable,sessions:{get:id=>id===reconcileSession.id?reconcileSession:null,list:()=>[reconcileSession]}})
await reconciled.sync()
assert.equal(reconciled.calls().length,1,'native reconciliation does not duplicate a stale stream charge')
assert.equal(reconciled.calls()[0].status,'completed')
assert.equal(reconciled.calls()[0].usage.inputTokens,100,'native terminal usage repairs stale stream usage after reload')
const activeSession={id:'active-reconcile',header:{id:'active-reconcile',agentPreset:'roleplay'},events:[event(0,'step/start',{turn:1,step:1},Date.now()-100)]}
const activeApi=createTelemetry({table:new Table(),sessions:{get:id=>id===activeSession.id?activeSession:null,list:()=>[activeSession]}})
let releaseActive;const activeGate=new Promise(resolve=>{releaseActive=resolve})
const activeIterator=activeApi.observe({sessionId:activeSession.id,provider:'p',model:'m'},async function*(){yield {type:'usage',usage};await activeGate;yield {type:'finish',reason:{kind:'stop'}}})[Symbol.asyncIterator]()
await activeIterator.next()
activeSession.events.push(event(1,'assistant/message',{turn:1,step:1,usage,message:{source:{provider:'p',model:'m'}}},Date.now()+1),event(2,'step/end',{turn:1,step:1},Date.now()+2))
await activeApi.sync()
assert.equal(activeApi.calls().length,1,'live native reconciliation does not add a second charge')
assert.equal(activeApi.calls()[0].status,'running','native reconciliation does not overwrite a live active stream')
releaseActive();await activeIterator.next();await activeIterator.next()
// Actual streaming plus durable usage echo is one charge, while native tool
// failure diagnostics retain name/code/timing without its arguments or result.
const live={id:'live',header:{id:'live',agentPreset:'roleplay'},events:[event(0,'step/start',{turn:1,step:1},Date.now()-100)]}
const liveApi=createTelemetry({table:new Table(),sessions:{get:()=>live,list:()=>[live]}})
for await(const c of liveApi.observe({sessionId:'live',provider:'p',model:'m'},async function*(){yield {type:'usage',usage};yield {type:'finish',reason:{kind:'stop'}}})){}
live.events.push(event(1,'assistant/message',{turn:1,step:1,usage,message:{source:{provider:'p',model:'m'}}},Date.now()+1),event(2,'step/end',{turn:1,step:1},Date.now()+2))
const toolFixtureTime=Date.now()
live.events.push(event(3,'tool/call',{turn:1,step:1,callId:'tc',name:'read_file',arguments:'SECRET'},toolFixtureTime+3),event(4,'tool/result',{turn:1,step:1,error:{name:'ToolError',code:'NOT_FOUND'},message:{source:{callId:'tc'},content:[{type:'tool-result',toolCallId:'tc',isError:true,content:'SECRET'}]}},toolFixtureTime+8))
await liveApi.sync();assert.equal(liveApi.calls().length,1)
const toolLog=liveApi.logs().find(r=>r.kind==='tool');assert.equal(toolLog.status,'failed');assert.equal(toolLog.label,'工具 · read_file');assert.equal(toolLog.durationMs,5);assert.equal(toolLog.error,'NOT_FOUND')
assert.ok(!JSON.stringify(liveApi.logs()).includes('SECRET'))
console.log('tavern-telemetry=ok (regenerate/retry/cache/fork/direct/failure/cold/restart/tool-diagnostics/prices)')
{
 const api=createTelemetry({table:new Table(),sessions:{get:()=>null,list:()=>[]},jobs:()=>[{id:'fallback',sessionId:'rp-a',kind:'status',status:'completed',actualRoute:{provider:'main',model:'main'},createdAt:1,completedAt:100,fallback:{from:{provider:'zai',model:'glm'},at:90,reason:'timeout',failure:{category:'timeout',code:'TASK_TIMEOUT',status:null,message:'SECRET'}}}]})
 const row=api.logs()[0]
 assert.equal(row.fallback.reason,'timeout')
 assert.equal(row.fallback.from.model,'glm')
 assert.equal(row.fallback.to.model,'main')
 assert.equal(row.fallback.failure.label,'任务超时')
 assert.ok(!JSON.stringify(row).includes('SECRET'))
}
let releaseHistory
const delayed=new Promise(resolve=>{releaseHistory=resolve})
const progressive=createTelemetry({table:new Table(),sessions:{get:()=>null,list:()=>[]},query:{listSessions:()=>delayed}})
assert.equal(progressive.refresh().scanning,true,'cold corpus enumeration cannot block the HTTP panel')
releaseHistory([])
await progressive.sync()
assert.equal(progressive.refresh().scanning,false)

// A stable ingest folds once; writes may yield while native history appends.
{
 const history=Array.from({length:100000},(_,seq)=>event(seq,'test/noop',{}))
 history.push(event(100000,'step/start',{turn:1,step:1}))
 let scans=0
 const iterate=history[Symbol.iterator].bind(history)
 history[Symbol.iterator]=function(){scans++;return iterate()}
 const s={id:'single-fold',header:{id:'single-fold',agentPreset:'roleplay'},events:history}
 const api=createTelemetry({table:new Table(),sessions:{get:()=>s,list:()=>[s]}})
 await api.ingest(s)
 assert.equal(scans,3,'one preset scan, one call fold and one operation scan; no second full fold')
 assert.equal(api.calls().length,1)
 assert.equal(api.calls()[0].source.startSeq,100000)
 console.log('telemetry-ingest: 100001 events, 3 scans (previously 4)')
}
{
 const s={id:'append-during-put',header:{id:'append-during-put',agentPreset:'roleplay'},events:[event(0,'step/start',{turn:1,step:1})]}
 class AppendingTable extends Table {
  async put(key,value){
   if(key.startsWith('tavern_usage__')&&s.events.length===1)s.events.push(
    event(1,'request/header',{header:{config:{provider:'late-provider',model:'late-model'}}}),
    event(2,'assistant/message',{turn:1,step:1,usage,message:{content:[{type:'text'}]}}),
    event(3,'step/end',{turn:1,step:1}))
   await super.put(key,value)
  }
 }
 const api=createTelemetry({table:new AppendingTable(),sessions:{get:()=>s,list:()=>[s]}})
 await api.ingest(s)
 assert.equal(api.logs().find(row=>row.label==='正文生成完毕').provider,'late-provider','operation attribution refolds when history grows during a table write')
 await api.ingest(s)
 assert.equal(api.calls().length,1,'late append is reconciled without a duplicate charge')
 assert.equal(api.calls()[0].status,'completed')
 assert.equal(api.calls()[0].usage.inputTokens,100)
}
{
 const s={id:'write-retry',header:{id:'write-retry',agentPreset:'roleplay'},events:[event(0,'step/start',{}),event(1,'assistant/message',{usage})]}
 const failure=new Error('fixture write failure')
 class FailingTable extends Table {
  fail=true
  async put(key,value){if(this.fail){this.fail=false;throw failure}await super.put(key,value)}
 }
 const table=new FailingTable(),api=createTelemetry({table,sessions:{get:()=>s,list:()=>[s]}})
 await assert.rejects(api.ingest(s),error=>error===failure)
 await api.ingest(s)
 assert.equal(api.calls().length,1,'failed persistence must not advance the ingest fingerprint')
 assert.equal(api.calls()[0].usage.inputTokens,100)
 const before=structuredClone([...table])
 const restored=createTelemetry({table,sessions:{get:()=>null,list:()=>[]}})
 assert.deepEqual(restored.calls(),api.calls(),'persisted schema 1 call rows restore without reinterpretation')
 assert.deepEqual([...table],before,'read-only restoration does not rewrite durable rows')
 const controller=new AbortController()
 const stream=restored.observe({signal:controller.signal},async function*(){yield {type:'text-delta',text:'private'};controller.abort()})
 for await(const _chunk of stream){}
 assert.equal(restored.calls().at(-1).status,'cancelled')
 assert.equal(restored.calls().at(-1).ownerSessionId,null)
 const downstreamError=new Error('fixture downstream failure')
 await assert.rejects(async()=>{for await(const _chunk of restored.observe({},async function*(){throw downstreamError})){}},error=>error===downstreamError)
 assert.equal(restored.calls().at(-1).status,'failed')
 assert.ok(!JSON.stringify([...table]).includes('private'))
}
