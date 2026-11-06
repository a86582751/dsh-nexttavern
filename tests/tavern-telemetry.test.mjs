import assert from 'node:assert/strict'
import { foldSessionCalls, aggregateUsage, createTelemetry, timeRange, queryUsageRequests } from '../lib/core/tavern-telemetry.js'
import {createRoleplayInputStateOwner} from '../lib/core/roleplay-input-state.js'
import {createSessionHistory,sessionHistoryCut} from '../lib/core/session-history.js'
import {ownedPackages} from './plugin-owned-packages-fixture.mts'
import {loadChatCardSource} from './chat-card-controller-fixture.mts'
import {createTestDirectory,cleanupTestDirectory} from '../src/operations/test-temp.mts'
class Table extends Map { async put(k,v){this.set(k,structuredClone(v))} }
class IdentityTable extends Map {
  constructor(){super();this.durable=new Map()}
  async put(k,v){this.durable.set(k,structuredClone(v));if(!this.has(k))this.set(k,v)}
}
// Actual Native accepted events and the official Domain/JSON implementation
// exercise the automatic consumer. The detached public parser remains the
// reference for full-history output and final turn/step attribution.
{
 const directory=createTestDirectory('telemetry-native-domain-'),native=await ownedPackages([],[],{localSession:true})
 const {Session,SessionId}=await native.load('@deepseek-ai/dsh-session')
 const {DomainFacility}=await native.load('@deepseek-ai/dsh-storage-domain')
 const {z}=await native.load('zod')
 const {JsonStorageBackend}=await loadChatCardSource('compat/storage-json/src/index.ts',directory,native.require)
 const backend=new JsonStorageBackend(directory+'/storage'),sessions=new Map(),prefixes=['tavern_job__','tavern_cardjob__','tavern_novel__']
 const input=createRoleplayInputStateOwner({domainName:'roleplay',session:id=>sessions.get(id),agent:()=>undefined,active:()=>true})
 const facility=new DomainFacility({storage:{backend:{get:()=>backend}},logger:{warn(){},error(){}},
  emit(name,change){assert.equal(name,'domain/changed');input.domainChanged(change)}},{backend:'json'})
 let domain,api,current,history,beforePut,afterPut
 const spec={name:'roleplay',version:1,layout:'per-record',tables:{branch:{valueSchema:z.unknown()}}}
 try{
  domain=await facility.open(spec)
  const durable=domain.table('branch')
  const table=input.table('branch',{get:key=>durable.get(key),entries:()=>durable.entries(),async put(key,value){
   await beforePut?.(key,value)
   await durable.put(key,value)
   await afterPut?.(key,value)
  }})
  const allJobs=()=>[...durable.entries()].filter(([key])=>prefixes.some(prefix=>key.startsWith(prefix))).map(([,value])=>value)
  const create=()=>createTelemetry({table,sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},jobs:allJobs,
   domainRecords:{observe:input.observeDomainChanges,jobPrefixes:prefixes}})
  const live=(id,events,header,inherited=0)=>{
   const branded=SessionId(id),base=Session.create(branded)
   const value=Session.create(branded,events,{...base.header,agentPreset:'roleplay',...header},inherited)
   sessions.set(id,value);return value
  }
  current=live('telemetry-native-owner')
  history=createSessionHistory({get:id=>sessions.get(id),observe:async id=>{
   const value=sessions.get(id)
   return {source:'live',header:{id},cursor:value.seq-1,inheritedEventCount:value.inheritedEventCount,
    events:value.snapshotEvents(),[Symbol.dispose]() {}}
  }})
  const append=(type,data,options)=>{const value=current.append(type,data,options);history.accept(current,value);return value}
  const route=(provider)=>append('request/header',{reason:'change',header:{config:{provider,model:'m'}}})
  const reply=(turn,step=1)=>append('assistant/message',{turn,step,usage:{inputTokens:10,outputTokens:2},stream:[],
   message:{id:`reply-${current.seq}`,role:'assistant',source:{kind:'model',provider:'actual',model:'m'},content:[{type:'text',text:'PRIVATE_BODY'}]}},
   {surfaceOp:'append'})
  const begin=(turn,step=1)=>{append('turn/start',{turn});return append('step/start',{turn,step})}
  const end=(turn,step=1)=>{append('step/end',{turn,step});append('turn/end',{turn,reason:{kind:'completed'}})}
  const usageRows=rows=>rows.filter(([,row])=>row?.source?.kind==='session-attempt'||row?.source?.kind==='stream')
   .map(([key,row])=>[key,row]).sort(([a],[b])=>a.localeCompare(b))
  const operationRows=rows=>rows.filter(([,row])=>row?.source?.kind==='session-event').sort(([a],[b])=>a.localeCompare(b))
  const check=async()=>{
   const referenceTable=new Table([...durable.entries()].map(([key,value])=>[key,structuredClone(value)]))
   const loaded={id:current.id,header:current.header,inheritedEventCount:current.inheritedEventCount,events:current.snapshotEvents()}
   const reference=createTelemetry({table:referenceTable,sessions:{get:id=>id===loaded.id?loaded:sessions.get(id)},jobs:allJobs})
   await reference.ingest(loaded);await api.ingest(current)
   assert.deepEqual(usageRows([...durable.entries()]),usageRows([...referenceTable]),'Native tail preserves the full detached charge result')
   assert.deepEqual(operationRows([...durable.entries()]),operationRows([...referenceTable]),'Native tail preserves final turn/step operation attribution')
   reference.dispose()
  }
  await history.ready(current);api=create()
  begin(1);route('first');reply(1)
  append('tool/call',{turn:1,step:1,callId:'tool',name:'read_file',arguments:'PRIVATE_ARGUMENT'})
  append('tool/result',{turn:1,step:1,message:{id:'tool-result',role:'tool',toolCallId:'tool',source:{kind:'tool',callId:'tool'},
   content:[{type:'text',text:'PRIVATE_RESULT'}]}},{surfaceOp:'append'})
  await check()
  append('llm/retry',{retryId:'retry',turn:1,step:1,provider:'first',mode:'normal',policyKey:'fixture',retry:1,maxRetries:2,
   delayMs:0,failure:{kind:'network',message:'PRIVATE_FAILURE'}})
  append('llm/retry-started',{retryId:'retry',turn:1,step:1,retry:1});route('retry');reply(1);end(1)
  await check()
  for(let turn=2;turn<=7;turn++){begin(turn);route('route-'+turn);reply(turn);end(turn);await check()}
  assert(!JSON.stringify([...durable.entries()]).includes('PRIVATE_'),'telemetry never stores Native body or tool payloads')

  // Same Native count: an actual stream can replace the native echo, and an
  // external job update must change the next stream's purpose immediately.
  const echo=foldSessionCalls({id:current.id,events:current.snapshotEvents()})[0]
  const stream={...echo,id:'external-stream',status:'running',startedAt:echo.startedAt,
   source:{kind:'stream',sessionId:current.id,startSeq:echo.source.startSeq,purpose:null}}
  await durable.put('tavern_usage__external-stream',stream);await check()
  assert.equal(durable.get('tavern_usage__external-stream').status,echo.status)
  assert.equal(durable.get('tavern_usage__'+echo.id).superseded,true)
  await durable.put('tavern_cardjob__one',{id:'one',sessionId:current.id,childSessionId:current.id,kind:'card-export',status:'running',createdAt:1})
  await api.ingest(current)
  assert(durable.get('tavern_usage__external-stream').source.jobIds.includes('one'))
  await durable.put('tavern_cardjob__one',{id:'one',sessionId:current.id,childSessionId:current.id,kind:'novel-export',status:'running',createdAt:1})
  for await(const _chunk of api.observe({sessionId:current.id,purpose:'auxiliary'},async function*(){yield {type:'finish',reason:{kind:'stop'}}})){}
  assert.equal(api.calls().find(row=>row.source.purpose==='auxiliary').kind,'novel-export')
  await durable.delete('tavern_cardjob__one')
  for await(const _chunk of api.observe({sessionId:current.id,purpose:'after-delete'},async function*(){yield {type:'finish',reason:{kind:'stop'}}})){}
  assert.equal(api.calls().find(row=>row.source.purpose==='after-delete').kind,'after-delete')
  await durable.delete('tavern_usage__external-stream');await check()
  assert.equal(durable.get('tavern_usage__'+echo.id).superseded,undefined,'deleting a matching stream restores the Native charge at the same cut')
  const damaged={...durable.get('tavern_usage__'+echo.id),provider:'external-damage'}
  await durable.put('tavern_usage__'+echo.id,damaged);await check()
  assert.equal(durable.get('tavern_usage__'+echo.id).provider,echo.provider,'external changes revoke the prior successful-write memo')
  const [operationKey,operation]=[...durable.entries()].find(([,row])=>row.source?.kind==='session-event')
  await durable.put(operationKey,{...operation,label:'external operation damage'});await api.ingest(current)
  assert.deepEqual(durable.get(operationKey),operation,'an owned operation output is restored after an external replacement')
  await durable.delete(operationKey);await api.ingest(current)
  assert.deepEqual(durable.get(operationKey),operation,'an owned operation output is restored after external deletion')
  const [labelKey,label]=[...durable.entries()].find(([,row])=>row.source?.kind==='session-header'&&row.sessionId===current.id)
  await durable.put(labelKey,{...label,label:'external label damage'});await api.ingest(current)
  assert.equal(durable.get(labelKey).label,label.label,'the owned session label is restored after an external replacement')
  await durable.delete(labelKey);await api.ingest(current)
  assert.equal(durable.get(labelKey).label,label.label,'the owned session label is restored after external deletion')

  // A rejected write and a committed write whose caller loses the ACK both
  // retain the pending output. A subsequent real write failure must surface.
  begin(8);route('write-failure');reply(8);end(8)
  const failure=Error('telemetry before durability')
  beforePut=(key)=>{if(key.startsWith('tavern_usage__')){beforePut=undefined;throw failure}}
  await assert.rejects(api.ingest(current),error=>error===failure)
  await check()
  begin(9);route('lost-ack');reply(9);end(9)
  afterPut=(key)=>{if(key.startsWith('tavern_usage__')){afterPut=undefined;throw Error('telemetry lost ACK')}}
  await assert.rejects(api.ingest(current),/telemetry lost ACK/)
  beforePut=(key)=>{if(key.startsWith('tavern_usage__')){beforePut=undefined;throw failure}}
  await assert.rejects(api.ingest(current),error=>error===failure)
  await check()

  begin(10);route('before-await')
  afterPut=(key)=>{if(key.startsWith('tavern_usage__')){afterPut=undefined;route('after-await');reply(10);end(10)}}
  await api.ingest(current)
  assert.equal(api.calls().find(row=>row.source.startSeq===current.snapshotEvents().findLast(row=>row.type==='step/start').seq).status,'completed',
   'an accepted Native tail arriving during persistence is reconciled before ingest resolves')
  await check()

  // A new row inserted during association is visible before the same ingest returns.
  const associatedStart=begin(11);route('associated');reply(11);end(11)
  const associated=foldSessionCalls({id:current.id,events:current.snapshotEvents()}).at(-1)
  await durable.put('tavern_usage__association-old',{...stream,id:'association-old',source:{...stream.source,startSeq:-1}})
  await durable.put('tavern_job__association',{id:'association',sessionId:current.id,childSessionId:current.id,
   kind:'status',status:'running',createdAt:1})
  afterPut=async(key)=>{if(key==='tavern_usage__association-old'){
   afterPut=undefined
   await durable.put('tavern_usage__association-new',{...associated,id:'association-new',status:'running',
    source:{kind:'stream',sessionId:current.id,startSeq:associatedStart.seq,purpose:null}})
  }}
  await api.ingest(current)
  assert.equal(durable.get('tavern_usage__association-new').status,'completed',
   'a stream published during job association participates in the same Native reconciliation')
  await durable.delete('tavern_job__association')

  // Existing active stream output remains owned by its invocation.
  const activeStart=begin(12);route('active')
  let release
  const gate=new Promise(resolve=>{release=resolve})
  const iterator=api.observe({sessionId:current.id},async function*(){yield {type:'usage',usage:{inputTokens:42}};await gate;
   yield {type:'finish',reason:{kind:'stop'}}})[Symbol.asyncIterator]()
  await iterator.next();reply(12);end(12);await api.ingest(current)
  const active=api.calls().find(row=>row.source.kind==='stream'&&row.source.startSeq===activeStart.seq)
  assert.equal(active.status,'running');assert.equal(active.usage.inputTokens,42)
  release();await iterator.next();await iterator.next();await api.ingest(current)
  assert.equal(api.calls().find(row=>row.id===active.id).status,'completed')

  const old=current,owner=sessionHistoryCut(old).owner,saved=old.snapshotEvents()
  history.disposeSession(old);current=live(old.id,saved,old.header);await history.ready(current)
  assert.notEqual(sessionHistoryCut(current).owner,owner);await check()
  const parent=current,seed=parent.seq
  current=live('telemetry-native-child',parent.snapshotEvents(),{origin:'subagent',parentSession:parent.id,isSeeded:true},seed)
  await history.ready(current);begin(13);route('child');reply(13);end(13);await check()
  const childCalls=api.calls().filter(row=>row.sessionId===current.id)
  assert.equal(childCalls.length,1,'seeded Native history establishes lifecycle without a second charge')
  assert.equal(childCalls[0].ownerSessionId,parent.id)
  api.dispose();api=create();await check()
  console.log('telemetry-native-domain=ok (retry/seed/external/delete/ACK/tail/active/cold)')
 }finally{api?.dispose();history?.dispose();input.dispose();await domain?.close();native.close();cleanupTestDirectory(directory)}
}
const event=(seq,type,data,time=1000+seq*100)=>({seq,type,data,time})
const usage={inputTokens:100,outputTokens:20,cacheReadTokens:900,cacheWriteTokens:0}
{
 const sessions=new Map(['inventory-a','inventory-b'].map(id=>[id,{id,header:{id,agentPreset:'roleplay'},events:[]}]))
 const owner=createRoleplayInputStateOwner({domainName:'roleplay',session:id=>sessions.get(id),agent:()=>undefined,active:()=>true})
 const rows=new Map(),table={get:key=>rows.get(key),entries:()=>rows.entries(),async put(key,value){
  rows.set(key,structuredClone(value));owner.domainChanged({domain:'roleplay',table:'branch',key,operation:'put',value:rows.get(key)})
 }}
 const tracked=owner.table('branch',table),prefixes=['tavern_job__','tavern_cardjob__','tavern_novel__']
 const read=()=>[...tracked.entries(prefixes)].filter(([key])=>prefixes.some(prefix=>key.startsWith(prefix))).map(([,value])=>value)
 const api=createTelemetry({table:tracked,sessions:{get:id=>sessions.get(id),list:()=>[...sessions.values()]},
  jobs:id=>id?owner.captureHistoricalFacts(id,'telemetry-job-inventory',read).data:read(),
  streamRows:(id,read)=>owner.captureHistoricalFacts(id,'telemetry-stream-inventory',read).data})
 const a=sessions.get('inventory-a'),b=sessions.get('inventory-b')
 await api.ingest(a)
 for await(const _chunk of api.observe({sessionId:a.id},async function*(){yield {type:'finish',reason:{kind:'stop'}}})){}
 await table.put('tavern_cardjob__new',{id:'new',sessionId:a.id,childSessionId:a.id,kind:'card-export',status:'running',createdAt:1})
 await api.ingest(a)
 const associated=api.calls().find(call=>call.sessionId===a.id)
 assert(associated.source.jobIds.includes('new'),'a new job is associated even when source event count is unchanged')
 await table.put('tavern_novel__peer',{id:'peer',sessionId:b.id,childSessionId:b.id,kind:'novel-export',status:'running',createdAt:2})
 for await(const _chunk of api.observe({sessionId:b.id},async function*(){yield {type:'finish',reason:{kind:'stop'}}})){}
 assert.equal(api.calls().find(call=>call.sessionId===b.id).kind,'novel-export','another session consumes its own live job inventory')
 owner.dispose()
}
{
 const table=new Table(),s={id:'indexed-attribution',header:{id:'indexed-attribution',agentPreset:'roleplay'},events:[
  event(0,'step/start',{turn:1,step:1},1000),
  event(1,'request/header',{header:{config:{provider:'first',model:'m'}}},1100),
  event(2,'llm/retry',{turn:1,step:1},1200),
  event(3,'llm/retry-started',{turn:1,step:1},1300),
  event(4,'request/header',{header:{config:{provider:'retry',model:'m'}}},1400),
  event(5,'assistant/message',{turn:1,step:1,usage,message:{content:[{type:'text'}]}},1500),
  event(6,'step/end',{turn:1,step:1},1600),
  event(7,'step/start',{turn:1,step:2},1700),
  event(8,'request/header',{header:{config:{provider:'second-step',model:'m'}}},1800),
  event(9,'assistant/message',{turn:1,step:2,usage,message:{content:[{type:'text'}]}},1900),
  event(10,'step/end',{turn:1,step:2},2000),
  event(11,'tool/call',{turn:1,step:1,callId:'tool',name:'read_file'},2100),
  event(12,'tool/result',{turn:1,step:1,callId:'tool'},2200),
  event(13,'turn/end',{turn:1},2300),
  event(14,'compaction/end',{},2400),
 ]}
 const native=foldSessionCalls(s)
 for(const call of native)await table.put('tavern_usage__'+call.id,call)
 for(const [id,startSeq,startedAt,purpose] of [
  ['too-early',0,999,null],['first-match',0,1100,null],['later-match',0,1150,null],
  ['purpose-call',3,1350,'maintenance'],['too-late',3,1600,null],['retry-match',3,1400,null],
  ['second-match',7,1750,null],
 ])await table.put('tavern_usage__'+id,{...native[0],id,status:'running',startedAt,source:{kind:'stream',startSeq,purpose}})
 const api=createTelemetry({table,sessions:{get:()=>s,list:()=>[s]}})
 await api.ingest(s)
 assert.equal(table.get('tavern_usage__first-match').status,'failed','the first eligible stream in table order wins its native time window')
 assert.equal(table.get('tavern_usage__later-match').status,'running','later eligible streams do not replace the first match')
 assert.equal(table.get('tavern_usage__too-early').status,'running')
 assert.equal(table.get('tavern_usage__too-late').status,'running')
 assert.equal(table.get('tavern_usage__purpose-call').status,'running','purpose streams remain independent charges')
 assert.equal(table.get('tavern_usage__retry-match').status,'completed')
 assert(native.every(call=>table.get('tavern_usage__'+call.id).superseded===true),'native echoes remain superseded by actual stream charges')
 const logs=api.logs().filter(row=>row.source?.kind==='session-event')
 assert.equal(logs.find(row=>row.source.seq===5).provider,'retry','same-step retries use the last matching attempt')
 assert.equal(logs.find(row=>row.source.seq===12).provider,'retry','tool results retain turn and step attribution')
 assert.equal(logs.find(row=>row.source.seq===13).provider,'second-step','turn/end without a step uses the last attempt of the turn')
 assert.equal(logs.find(row=>row.source.seq===14).provider,null,'missing turn identity does not borrow a different turn')
}
for(const trackedRead of [false,true]){
 const s={id:'association-write',header:{id:'association-write',agentPreset:'roleplay'},events:[
  event(0,'step/start',{turn:1,step:1},1000),event(1,'assistant/message',{turn:1,step:1,usage},2000),event(2,'step/end',{},2100),
 ]}
 const owner=trackedRead?createRoleplayInputStateOwner({domainName:'roleplay',session:()=>s,agent:()=>undefined,active:()=>true}):null
 const changed=(key,value)=>owner?.domainChanged({domain:'roleplay',table:'branch',key,operation:'put',value})
 const base={...foldSessionCalls(s)[0],id:'old-stream',status:'running',source:{kind:'stream',startSeq:99,purpose:null}}
 class AssociatingTable extends Table {
  async put(key,value){
   await super.put(key,value)
   changed(key,this.get(key))
   if(key==='tavern_usage__old-stream'&&value.source.jobIds?.length&&!this.has('tavern_usage__new-stream')){
    const current={...base,id:'new-stream',startedAt:1100,source:{kind:'stream',startSeq:0,purpose:null}}
    await super.put('tavern_usage__new-stream',current);changed('tavern_usage__new-stream',this.get('tavern_usage__new-stream'))
   }
  }
 }
 const actual=new AssociatingTable(),table=owner?owner.table('branch',actual):actual;await table.put('tavern_usage__old-stream',base)
 const api=createTelemetry({table,sessions:{get:()=>s,list:()=>[s]},streamRows:owner?(id,read)=>owner.captureHistoricalFacts(id,'telemetry-stream-inventory',read).data:undefined,jobs:()=>[
  {id:'job',sessionId:s.id,childSessionId:s.id,kind:'status',status:'completed',createdAt:1},
 ]})
 await api.ingest(s)
 assert.equal(table.get('tavern_usage__new-stream').status,'completed','an actual stream published while job association yields participates in reconciliation')
 assert(!api.calls().some(call=>call.source.kind==='session-attempt'),'the new stream prevents a duplicate native charge')
 owner?.dispose()
}
{
 const table=new Table(),s={id:'measured-stream',header:{id:'measured-stream',agentPreset:'roleplay'},events:[]}
 const api=createTelemetry({table,sessions:{get:id=>id===s.id?s:null,list:()=>[s]}})
 const measurement={schemaVersion:1,encoding:'native-final-request-measurement-v1',sourceSha256:'a'.repeat(64),
  provider:'p',model:'m',estimate:{inputTokens:10,messageTokens:[10],messageParts:[[]],systemTokens:0,toolTokens:0,
   schemaBytes:0,toolCount:0,imageCount:0,imagePricing:'none'},components:{systemFixed:0,authorEffective:0,dynamicState:0,
   storyPlayer:10,toolSchemas:0,toolCatalog:0,toolResults:0,maintenanceInput:0,receipts:0,unattributed:0},
  capacity:{status:'unknown',reason:'uncalibrated'}}
 for await(const _chunk of api.observe({sessionId:s.id,provider:'p',model:'m'},async function*(){
  yield {type:'usage',usage};yield {type:'finish',reason:{kind:'stop'}}
 },()=>measurement)){}
 const saved=[...table.values()].find(row=>row.source?.kind==='stream')
 assert.deepEqual(saved.requestMeasurement,measurement,'the existing stream row stores the owning numeric request measurement')
 assert.deepEqual(saved.usage,{...usage,totalTokens:null},'provider usage remains separate from input estimate')
 const cold=createTelemetry({table,sessions:{get:id=>id===s.id?s:null,list:()=>[s]}})
 assert.deepEqual(cold.calls()[0].requestMeasurement,measurement,'cold read preserves the versioned additive diagnostic')
 assert.equal(saved.schemaVersion,1)
}
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
