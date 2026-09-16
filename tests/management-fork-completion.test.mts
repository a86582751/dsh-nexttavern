import {registerSettingTool,savePanelSetting} from '../src/core/roleplay-panel-routes.js'
import {createTavernTasks} from '../src/core/tavern-tasks.js'
import {createRoleplayService} from '../src/core/roleplay-service.js'
import {recordSha256} from '../src/core/roleplay-data.js'
import {importActiveKey} from '../src/core/roleplay-import.js'
import {isSettingManagementCall} from '../src/core/tavern-task-context.js'
import {createConversationCatalog} from '../src/core/tavern-conversations.js'
import type {SettingToolDependencies,SettingArguments} from '../src/core/roleplay-panel-routes-types.js'
import assert from 'node:assert/strict'
import { createRoleplayCompletion } from '../src/core/roleplay-completion.js'
import { canonicalAssistantForTurn, surfaceEntries, surfaceEvents, eventsOf, isCompletedTurnEnd } from '../src/core/roleplay-context.js'
import { createRoleplayWorldlines } from '../src/core/roleplay-worldlines.js'
import { sha256, textOf } from '../src/core/roleplay-data.js'
import type { WorldlineDependencies } from '../src/core/roleplay-worldline-types.js'
import type { CompletionDependencies, CompletionState } from '../src/core/roleplay-completion-types.js'
import type { ContextEvent, ContextSession } from '../src/core/roleplay-context.js'

const flush=()=>new Promise(resolve=>setImmediate(resolve))
function fixture({via='event',tool='rp_source_search',invalid='',retry=false}={}) {
  const events:ContextEvent[]=[
    {seq:0,type:'turn/start',data:{turn:1}},
    {seq:1,type:'user/message',data:{id:'player',source:{kind:'user',rpcId:'request'},content:[{type:'text',text:'Check the card'}]}},
    {seq:2,type:'user/message',data:{id:'phase',source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:invalid==='internal'?'after-story':'story'},content:[]}},
    {seq:3,type:'tool/call',data:{turn:1,name:tool,callId:'call',arguments:'{"source_id":"book","query":"clue"}'}},
    {seq:4,type:'assistant/message',data:{turn:1,message:{id:'done',content:[{type:'text',text:invalid==='empty'?'':'Card file updated; no story was generated.'}]},interrupted:invalid==='interrupted'}},
    {seq:5,type:'turn/end',data:{turn:1,reason:{kind:invalid==='failed'?'error':'completed'}}},
  ]
  const session:ContextSession={id:'management-fork',events,surface:{nodes:invalid==='hidden'?[1,2]:[1,2,4]}}
  if(invalid==='tool')events[4]!.data!.message!.content=[{type:'tool-call',id:'pending',name:tool,arguments:{}},{type:'text',text:'Not finished'}]
  if(invalid==='subagent')session.header={origin:'subagent'}
  const snapshot={branchId:session.id,turnId:1,userText:'Check the card',userMessageId:'player'}
  const st:CompletionState={snapshots:new Map([[1,snapshot]]),snapshot,pendingTurn:1,pendingScenes:new Map(),pendingScene:null,phaseBStarted:new Set(),phaseBRetryTimers:new Map(),phaseBAttempts:new Map(),regenerateAnchor:null}
  const hooks=new Map<string,Function>(),reconciled:number[]=[],failed:string[]=[],writes:string[]=[],statuses:number[]=[]
  let attempts=0
  const table={get:()=>undefined,put:async()=>{writes.push('put')},update:async()=>{writes.push('update')}}
  const deps:CompletionDependencies={T:{branch:table,scene:table,memory:table},storyBranchIsActive:()=>true,cloneBranchRecord:structuredClone,
    reconcileNativeFork:async(_session,event)=>{attempts++;if(retry&&attempts===1)throw Error('fixture transient store failure');reconciled.push(event.seq)},
    ctx:{get:()=>({backgroundMemory:true}),sessions:{get:()=>session},logger:{warn(){}},on:(name,fn)=>{hooks.set(name,fn)}},
    resolveRoute:owner=>({session:owner}),memoryForContext:()=>undefined,publishTurnDecision:async()=>{writes.push('decision')},
    llmJson:async()=>{writes.push('model');return null},LEDGER_WORKER_SYSTEM:'',CONTINUITY_WORKER_SYSTEM:'',cfg:{},contextWindowFor:()=>undefined,contextWindowKey:id=>id,
    svc:{recordVersion:async()=>{writes.push('version')}},sessions:new Map([[session.id,st]]),failPendingNativeFork:async(_session,reason)=>{failed.push(reason)},
    isRoleplaySession:()=>true,queueStatusObligation:(_session,event)=>{statuses.push(event.seq)},statusRunStartSeq:new Map(),recoverStatusObligations:()=>{},
  }
  createRoleplayCompletion(deps)
  const dispatch=()=>via==='event'?hooks.get('session/event')!(session,events.at(-1)):hooks.get('agent/status')!({agent:{session},status:'idle'})
  return {session,st,dispatch,hooks,reconciled,failed,writes,statuses,get attempts(){return attempts}}
}

for(const via of ['event','idle'])for(const tool of ['rp_source_status','rp_source_library','rp_source_search','rp_card_draft_check','rp_preset']) {
  const h=fixture({via,tool})
  assert.equal(canonicalAssistantForTurn(h.session,1),null,'management remains outside story canonical')
  assert.equal(surfaceEntries(h.session).some(entry=>entry.seq===4),false,'management must never become history content')
  h.dispatch();h.dispatch();await flush()
  assert.deepEqual(h.reconciled,[4],`${via}/${tool}: completed visible management reply must finish pending fork`)
  h.hooks.get('agent/status')!({agent:{session:h.session},status:'idle'});await flush()
  assert.deepEqual(h.failed,[],'idle must not turn a successful management fork into failed')
  assert.deepEqual(h.writes,[],'no scene, memory, decisions or model calls for management completion')
  assert.deepEqual(h.statuses,[])
  assert.equal(h.st.snapshots.size,0)
  assert.equal(h.st.pendingTurn,null)
}
for(const via of ['event','idle'])for(const invalid of ['failed','empty','hidden','interrupted','internal','tool','subagent']) {
  const h=fixture({via,invalid});h.dispatch();await flush()
  assert.deepEqual(h.reconciled,[],`${via}/${invalid}: must not manufacture a completion receipt`)
  assert.equal(h.failed.length,1)
  assert.deepEqual(h.writes,[])
}
{
  const h=fixture({retry:true});h.dispatch();await flush()
  assert.equal(h.attempts,1);assert.equal(h.st.snapshots.size,1);assert.equal(h.failed.length,0)
  h.hooks.get('agent/status')!({agent:{session:h.session},status:'idle'});await flush()
  assert.deepEqual(h.reconciled,[4]);assert.equal(h.st.snapshots.size,0)
}
// Exercise the real persistent fork reconciliation, including recovery without
// a completion event supplied by the live hook. Unused services are deliberately absent.
for(const invalid of ['', 'internal', 'tool', 'hidden', 'wrong-request']) {
  const h=fixture({invalid}),records=new Map<string,any>()
  const branch={get:(key:string)=>records.get(key),entries:()=>records.entries(),put:async(key:string,value:unknown)=>{records.set(key,structuredClone(value))},delete:async(key:string)=>{records.delete(key)}}
  const api=createRoleplayWorldlines({ctx:{},T:{branch},safeId:String,keyOf:(id:string,key:string)=>`${id}__${key}`,sha256,textOf,eventsOf,surfaceEvents,isCompletedTurnEnd,cloneBranchRecord:structuredClone,canonicalAssistantForTurn} as unknown as WorldlineDependencies)
  const groupId='group',operationId='operation',requestId=invalid==='wrong-request'?'foreign-request':'request'
  const groupKey=api.forkGroupKey(groupId),pendingKey=api.forkPendingKey(h.session.id,groupId)
  records.set(groupKey,{groupId,rootSessionId:'root',anchor:{sourceSessionId:'root',sourceAssistantMessageId:'old'},members:[{sessionId:h.session.id,ordinal:2,operationId,requestId,pending:true,deleted:false,kind:'regenerate',createdAt:1}]})
  records.set(pendingKey,{groupId,ordinal:2,operationId,requestId})
  await api.reconcileNativeFork(h.session)
  const member=records.get(groupKey).members[0]
  if(invalid){assert.equal(member.pending,true,`${invalid}: recovery cannot bind an unrelated or internal result`);assert.equal(records.has(pendingKey),true)}
  else {
    assert.equal(member.pending,false);assert.equal(member.assistantMessageId,'done');assert.equal(member.assistantSeq,4)
    assert.equal(member.userMessageId,'player');assert.equal(member.userSeq,1);assert.equal(records.has(pendingKey),false)
    await api.reconcileNativeFork(h.session)
    assert.equal(records.get(groupKey).members[0].assistantMessageId,'done','recovery is idempotent')
  }
  assert.equal(canonicalAssistantForTurn(h.session,1),null)
}
console.log('management-fork-completion=ok (event/idle, story isolation, invalid replies, retry)')

// Bounded author-setting edits and their background job lifecycle.
{

const tables=['branch','cards','worldbook','rules','status','decision'] as const
function table(){const db=new Map<string,Record<string,unknown>>();return {get:(k:string)=>db.get(k),entries:()=>db.entries(),put:async(k:string,v:Record<string,unknown>)=>{db.set(k,structuredClone(v))},delete:async(k:string)=>{db.delete(k)}}}
const T=Object.fromEntries(tables.map(k=>[k,table()])) as Record<typeof tables[number],ReturnType<typeof table>>
const s={id:'s',header:{cwd:'.'},events:[{seq:1,type:'turn/start',data:{turn:1}}]},agent={session:s},tools=new Map<string,any>(),hooks:Function[]=[],prompts:any[]=[]
let selected='s',starts=0
const catalog=createConversationCatalog({read:()=>null,write:async()=>{}})
await catalog.activate('s')
await catalog.reserve({sourceSessionId:'s',childSessionId:'fork-s',operationId:'test-op',kind:'regenerate',sourceHash:'f'.repeat(64)})
await catalog.markReady('fork-s')
const spawned:{spec:any;resolve:Function}[]=[]
const selection={execution:'inline' as const,main:{provider:'test',model:'same'},actualRoute:{provider:'test',model:'same'}}
const policy={resolve:async()=>selection}
const tasks=createTavernTasks({table:T.branch,policy,isCurrent:(session)=>selected===session.id,subagents:{start:async(_mode,spec)=>{
  starts++;let resolve!:Function
  const result=new Promise<any>(r=>{resolve=r});spawned.push({spec,resolve})
  return {id:`child-${starts}`,result,dispose(){}}
}}})
const service=createRoleplayService({T} as any)
const versions=()=>({cards:Object.fromEntries([...T.cards.entries()].filter(([k])=>k.startsWith('s__')).map(([k,v])=>[k.slice(3),recordSha256(v)])),worldbook:Object.fromEntries([...T.worldbook.entries()].filter(([k])=>k.startsWith('s__')).map(([k,v])=>[k.slice(3),recordSha256(v)])),rules:recordSha256(T.rules.get('s__spec')),status:recordSha256(T.status.get('s__spec'))})
let barrier=Promise.resolve(),releaseBarrier:(()=>void)|undefined
let evidenceBarrier=Promise.resolve()
const dep={ctx:{effect:(f:Function)=>f(),tools:{register:(t:any)=>tools.set(t.name,t)},on:(_name:string,f:Function)=>hooks.push(f),systemPrompt:{section:(s:any)=>prompts.push(s)},get(){return null}},
  T,recordVersionsFor:versions,RULE_TEXT_FIELDS:['core','plot','narrative','reply','style'],svc:service,
  withImportLock:async(_sid:string,_id:unknown,work:Function)=>{await barrier;return work()},sessionOf:async()=>s,resolveRoleplaySession:async(id:string)=>id===s.id?s:null,storyBranchIsActive:(target:{id:string})=>target.id===selected,
  selectionStamp:(target:{id:string})=>{const root=catalog.rootOf(target.id),b=catalog.snapshot().conversations[root];return b?.activeSessionId===target.id?`${root}:${b.selectionRevision??0}:${target.id}`:null},
  tavernTasks:tasks,modelPolicy:policy,evidence:async(_s:unknown,action:string,args:any)=>{
    await evidenceBarrier
    if(args.source_id!=='a'.repeat(64))throw Error('wrong original')
    if(action==='verify'&&args.quote!=='原著中的完整连续证据')throw Error('unverified quote')
    return {ok:true,text:'原著中的完整连续证据',segment:args.segment}
  }} as unknown as SettingToolDependencies
registerSettingTool(dep)
const call=async(a:SettingArguments,exec:any={agent})=>{
 const result=await tools.get('rp_setting').execute(a,exec)
 assert.deepEqual(result,JSON.parse(JSON.stringify(result)),'every setting tool receipt must be lossless JSON at the native boundary')
 return result
}
const read=(target:SettingArguments['target'],id?:string)=>call({action:'read',target,id})
const edit=async(action:SettingArguments['action'],target:SettingArguments['target'],extra:Partial<SettingArguments>={})=>{
  const v=await read(target,extra.id)
  return call({action,target,expected_branch_id:s.id,expected_revision:v.revision,reason:'玩家明确修改',...extra})
}
async function until(test:()=>boolean){for(let i=0;i<100&&!test();i++)await new Promise(r=>setTimeout(r,2));assert.ok(test(),'bounded async completion')}
const job=(id:string)=>T.branch.get(`s__setting-repair-${id}`) as any
const complete=(index:number,result:unknown)=>spawned[index]!.resolve({stopReason:'completed',structured:result})

await T.branch.put(importActiveKey('s'),{schemaVersion:1,importId:'original-import'})
await T.rules.put('s__spec',{schemaVersion:1,core:'世界中的错误称呼。其他固定约束保持。',style:'STYLE_KEEP',beauty:{css:'KEEP_CSS'},verified:true})
await T.rules.put('other__spec',{core:'OTHER_BRANCH'})
await T.cards.put('s__npc',{schemaVersion:1,id:'npc',name:'角色',kind:'npc',content:'人物旧身份。隐秘不能泄露。',locked:true,importId:'original-import',sourceSpans:[{start:0,end:4}],verified:true})
await T.worldbook.put('s__place',{schemaVersion:1,id:'place',name:'旧地名',content:'城门向东。',aliases:['别名'],priority:8,version:1})
await T.status.put('s__spec',{schemaVersion:1,text:'<div>旧字段</div>',templateHtml:'<div>旧字段</div>',importId:'original-import'})
const list=await call({action:'list'});assert.equal(list.branchId,'s');assert.ok(list.entries.some((e:any)=>e.target==='core'))
assert.ok(!JSON.stringify(list).includes('OTHER_BRANCH'))
const fragment=await call({action:'read',target:'core',max_chars:256});assert.equal(fragment.nextOffset,null)
await edit('patch','core',{changes:[{find:'错误称呼',replace:'正确称呼'}]})
assert.equal(T.rules.get('s__spec')!.core,'世界中的正确称呼。其他固定约束保持。')
assert.equal(T.rules.get('s__spec')!.style,'STYLE_KEEP');assert.deepEqual(T.rules.get('s__spec')!.beauty,{css:'KEEP_CSS'})
assert.equal(T.rules.get('s__spec')!.verified,false);assert.equal(T.rules.get('other__spec')!.core,'OTHER_BRANCH')
await assert.rejects(call({action:'patch',target:'core',expected_branch_id:'s',expected_revision:fragment.revision,reason:'old',changes:[{find:'正确',replace:'坏'}]}),/版本已变化/)
await edit('patch','character',{id:'npc',changes:[{find:'旧身份',replace:'新身份'}]})
assert.equal(T.cards.get('s__npc')!.locked,true);assert.equal(T.cards.get('s__npc')!.importId,'original-import');assert.deepEqual(T.cards.get('s__npc')!.sourceSpans,[{start:0,end:4}])
await edit('append','worldbook',{id:'place',text:'南门有新的规则。'})
assert.equal(T.worldbook.get('s__place')!.priority,8);assert.deepEqual(T.worldbook.get('s__place')!.aliases,['别名'])
await edit('create','worldbook',{id:'new',name:'新条目',kind:'item',text:'玩家新设定。'})
assert.equal(T.worldbook.get('s__new')!.schemaVersion,1)
const beforeBad=T.rules.get('s__spec')
await assert.rejects(edit('patch','core',{changes:[{find:'不存在',replace:'不可写入'}]}),/唯一匹配/)
assert.deepEqual(T.rules.get('s__spec'),beforeBad)
await edit('patch','status',{changes:[{find:'旧字段',replace:'新字段'}]})
assert.equal(T.status.get('s__spec')!.templateHtml,'<div>新字段</div>');assert.equal(T.status.get('s__spec')!.importId,'original-import')
await assert.rejects(edit('patch','status',{changes:[{find:'<div>新字段</div>',replace:'<style>unclosed'}]}),/未闭合/)
await edit('patch','status',{changes:[{find:'<div>新字段</div>',replace:'位置、时间、随身物品'}]})
assert.equal(T.status.get('s__spec')!.templateHtml,'','field-only edits clear the former HTML template')
assert.equal(T.status.get('s__spec')!.text,'位置、时间、随身物品')
await assert.rejects(call({action:'read',target:'core'},{agent:{session:s,options:{subagentDepth:1}}}),/子代理不能直接修改/)
const concurrency=await read('core')
const saves=await Promise.allSettled([1,2].map(n=>call({action:'append',target:'core',text:`并发${n}`,expected_branch_id:'s',expected_revision:concurrency.revision,reason:'concurrent'})))
assert.equal(saves.filter(x=>x.status==='fulfilled').length,1,'one CAS winner across simultaneous tool writes')
const beforeBarrier=await read('core')
barrier=new Promise(r=>{releaseBarrier=r})
const pending=call({action:'append',target:'core',text:'不应写入',expected_branch_id:'s',expected_revision:beforeBarrier.revision,reason:'switch'}).catch(e=>e)
selected='other';releaseBarrier!();assert.match((await pending).message,/世界线已切换/);selected='s';barrier=Promise.resolve()

// Scheduling never awaits the background model; this is the same native task executor as memory.
const first=await edit('repair','core',{instruction:'将正确称呼改成正式称呼，保留其他字段',basis:'player'})
assert.equal(first.queued,true);assert.equal(job(first.jobId).schemaVersion,1)
await until(()=>spawned.length===1)
assert.equal(spawned[0]!.spec.agentOptions.model,'same');assert.deepEqual(spawned[0]!.spec.toolFilter.allow,['rp_setting_evidence'])
assert.equal(job(first.jobId).status,'running');assert.match(String(T.rules.get('s__spec')!.core),/正确称呼/)
complete(0,{outcome:'patch',changes:[{find:'正确称呼',replace:'正式称呼'}],reason:'玩家明确指定'})
await until(()=>job(first.jobId).status==='completed')
assert.match(String(T.rules.get('s__spec')!.core),/正式称呼/)
assert.equal((T.rules.get('s__spec')!.editedFrom as any).repairId,first.jobId)
assert.ok(prompts[0].text({agent}).includes(first.jobId));assert.ok(!prompts[0].text({agent}).includes('STYLE_KEEP'))

// Concurrent panel edit wins; late background result cannot overwrite it.
const second=await edit('repair','worldbook',{id:'place',instruction:'修正地名方向',basis:'player'});await until(()=>spawned.length===2)
const uiRev=(await read('worldbook','place')).revision
const ui=await savePanelSetting(dep,s,{kind:'worldbook',id:'place',expectedRevision:uiRev,content:'玩家在面板保存了新版本。'})
assert.equal(ui.status,200)
complete(1,{outcome:'patch',changes:[{find:'城门向东',replace:'城门向西'}],reason:'旧版本修正'})
await until(()=>job(second.jobId).status==='failed')
assert.equal(T.worldbook.get('s__place')!.content,'玩家在面板保存了新版本。')
await assert.rejects(call({action:'retry',job_id:second.jobId}),/目标版本已变化/)

// Exact original evidence must be read by this assigned child, then checked against immutable text.
const third=await edit('repair','character',{id:'npc',instruction:'核对人物身份',basis:'source',source_id:'a'.repeat(64)});await until(()=>spawned.length===3)
const child={session:{id:'child-3',header:{parentSession:'s',origin:'subagent'}},options:spawned[2]!.spec.agentOptions}
await tools.get('rp_setting_evidence').execute({action:'read',segment:0},{agent:child})
await assert.rejects(tools.get('rp_setting_evidence').execute({action:'read',segment:0},{agent:{...child,session:{...child.session,id:'wrong-child'}}}),/授权已失效/)
complete(2,{outcome:'patch',changes:[{find:'新身份',replace:'原著身份'}],reason:'原著连续证据核对',evidence:[{segment:0,quote:'原著中的完整连续证据'}]})
await until(()=>job(third.jobId).status==='completed');assert.match(String(T.cards.get('s__npc')!.content),/原著身份/)
const fourth=await edit('repair','character',{id:'npc',instruction:'有疑问但证据不足',basis:'source',source_id:'a'.repeat(64)});await until(()=>spawned.length===4)
complete(3,{outcome:'needs-input',reason:'原著不能确定该新增关系是否属于玩家改编。'})
await until(()=>job(fourth.jobId).status==='needs-input');assert.match(String(T.cards.get('s__npc')!.content),/原著身份/)

// Restart recovery after a committed setting write but before the receipt save makes no extra call.
await T.branch.put(`s__setting-repair-${third.jobId}`,{...job(third.jobId),status:'running',reportThroughTurn:undefined})
const previousStarts=starts
await hooks[0]!({agent},async()=>{})
await until(()=>job(third.jobId).status==='completed');assert.equal(starts,previousStarts)
assert.ok(prompts[0].text({agent}).includes(third.jobId),'restart replays the newly recovered completion receipt')
for(const action of ['repair','read','list','jobs'])assert.equal(isSettingManagementCall({name:'rp_setting',arguments:JSON.stringify({action})}),false)
for(const action of ['patch','append','create'])assert.equal(isSettingManagementCall({name:'rp_setting',arguments:{action}}),true)
assert.equal(isSettingManagementCall({name:'rp_setting',arguments:'invalid'}),false)
// Real catalog switches do not tombstone either branch. Returning to A does not revive an old task.
const switched=await edit('repair','core',{instruction:'另一个延迟修补',basis:'player'});await until(()=>spawned.length===5)
const coreBeforeSwitch=T.rules.get('s__spec')
await catalog.activate('fork-s');await catalog.activate('s')
complete(4,{outcome:'patch',changes:[{find:'正式称呼',replace:'不能生效'}],reason:'晚到任务'})
await until(()=>job(switched.jobId).status==='failed')
assert.deepEqual(T.rules.get('s__spec'),coreBeforeSwitch)
await assert.rejects(call({action:'retry',job_id:switched.jobId}),/世界线已切换/)
const reading=await edit('repair','character',{id:'npc',instruction:'核对稍后返回的原著证据',basis:'source',source_id:'a'.repeat(64)})
await until(()=>spawned.length===6)
let releaseEvidence!:()=>void
evidenceBarrier=new Promise<void>(resolve=>{releaseEvidence=resolve})
const delayedChild={session:{id:'child-6',header:{parentSession:'s',origin:'subagent'}},options:spawned[5]!.spec.agentOptions}
const delayedRead=tools.get('rp_setting_evidence').execute({action:'read',segment:0},{agent:delayedChild})
await new Promise(resolve=>setTimeout(resolve,0))
await catalog.activate('fork-s');releaseEvidence()
await assert.rejects(delayedRead,/世界线已切换/)
await catalog.activate('s');complete(5,{outcome:'no-change',reason:'旧读取失效'})
await until(()=>job(reading.jobId).status==='failed')
s.events.push({seq:500,type:'turn/start',data:{turn:10}})
assert.equal(prompts[0].text({agent}),'','receipts expire from future prompts; durable jobs remain queryable')
assert.ok((await call({action:'jobs'})).jobs.some((j:any)=>j.id===first.jobId))
console.log('setting-repair=ok (shared panel CAS; single target patch; branch isolation; background admission; actual child evidence; player race; schema/restart receipts; no story blocking)')

}
