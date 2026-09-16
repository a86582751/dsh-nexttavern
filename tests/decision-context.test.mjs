import assert from 'node:assert/strict'
import { createRoleplayDecision } from '../src/core/roleplay-decision.js'
import {buildDecisionContext, taskDependenciesCurrent} from '../preset/lib/roleplay-core.js'
const T=Object.fromEntries(['cards','rules','worldbook'].map(k=>[k,new Map()]))
T.cards.set('a__npc',{id:'npc',name:'守门人',kind:'npc',content:'只在出示铜钥匙后开门。',source:{raw:'ARCHIVE_CSS'}})
T.cards.set('b__npc',{name:'OTHER_BRANCH',content:'不得泄漏'})
T.rules.set('a__spec',{core:'城门入夜关闭',plot:'取得许可后可以进入；不是已发生事实',style:'STYLE_SAMPLE',beautyCss:'BEAUTY_CSS'})
T.worldbook.set('a__gate',{id:'gate',name:'潮门',keywords:['潮门'],content:'开启前必须停泵，不能以铜钥匙直接开门。',version:1})
T.worldbook.set('a__far',{id:'far',name:'远城',content:'UNQUERIED_LORE'})
const narrative='本轮开头也必须保留。'+'正文。'.repeat(3000)
const result=await buildDecisionContext(T,'a',{narrative,userText:'检查门锁',scene:{place:'门厅'},directorNotes:'尚待查明潮门的开启条件',memory:{summary:'已拿到铜钥匙'}})
const serialized=JSON.stringify(result.context)
for(const value of ['开启前必须停泵','本轮开头也必须保留。','只在出示铜钥匙后开门。','城门入夜关闭'])assert.ok(serialized.includes(value),value)
for(const value of ['ARCHIVE_CSS','BEAUTY_CSS','STYLE_SAMPLE','UNQUERIED_LORE','OTHER_BRANCH'])assert.ok(!serialized.includes(value),value)
assert.equal(result.context.narrative,narrative)
assert.equal(taskDependenciesCurrent(T,'a',result.dependencies),true)
T.rules.get('a__spec').beautyCss='edited';assert.equal(taskDependenciesCurrent(T,'a',result.dependencies),true)
T.worldbook.get('a__gate').content='更改开启条件';assert.equal(taskDependenciesCurrent(T,'a',result.dependencies),false)
assert.equal(taskDependenciesCurrent(T,'b',result.dependencies),false)
assert.equal(taskDependenciesCurrent(T,'a',[{table:'memory',key:'a__head',hash:'invalid'}]),false)
{
 const frozenTables=Object.fromEntries(['cards','rules','worldbook'].map(k=>[k,new Map()]))
 frozenTables.cards.set('a__npc',{id:'npc',content:'frozen character'})
 frozenTables.rules.set('a__spec',{core:'frozen core',plot:'possible plot'})
 frozenTables.worldbook.set('a__gate',{id:'gate',content:'frozen gate',keywords:['/gate/i'],tavern:{useRegex:true}})
 const pending=buildDecisionContext(frozenTables,'a',{narrative:'gate'})
 frozenTables.cards.get('a__npc').content='changed character'
 frozenTables.rules.get('a__spec').core='changed core'
 frozenTables.worldbook.get('a__gate').content='changed gate'
 const frozen=await pending
 assert.equal(frozen.context.characters[0].content,'frozen character')
 assert.equal(frozen.context.core,'frozen core');assert.match(frozen.context.worldbook.text,/frozen gate/)
 assert.equal(taskDependenciesCurrent(frozenTables,'a',frozen.dependencies),false,'writes during regex await invalidate the frozen source')
}
console.log('decision-context=ok (full story, director-note lore query, no presentation/archive context, precise source fences)')

const decisionDeferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
const decisionTick=()=>new Promise(r=>setImmediate(r))
for(const outcome of ['publish','answered','superseded','newer','stale','cancel','update-race','reuse']) {
 const session={id:'decision-owner',events:[],surface:{nodes:[]}},event={seq:2,type:'assistant/message',data:{turn:1}},snapshot={branchId:session.id,turnId:1,userMessageId:'u1',userText:'input',baseRevision:0}
 const gate=decisionDeferred(),calls=[],writes=[],firstOwner=new AbortController(),secondOwner=new AbortController()
 let current,stale=false
 const route={provider:'fixture',model:'fixture'}
 const normalize=value=>({label:String(value?.label??''),description:String(value?.description??''),heart:value?.heart===true})
 const options=Array.from({length:5},(_,i)=>({label:`choice-${i}`+'a'.repeat(80),description:'d'.repeat(150),heart:i===0}))
 const decisionTable={get:()=>current,async put(_key,value){current=structuredClone(value);writes.push(current)},async update(_key,fn){
   if(outcome==='update-race')current={turnId:1,answered:true,options:[]}
   current=fn(current);writes.push(current)
 }}
 const deps={T:{decision:decisionTable,status:{get:()=>undefined},scene:{get:()=>undefined}},
  withDecisionMutationLock:async(_id,work)=>work(),normalizeDecisionRecord:value=>value??null,
  taskStory:()=>[{seq:1,text:'input'},{seq:2,text:'body'}],isStale:()=>stale,isLatestVisibleTurn:()=>true,
  statusSource:()=>({sourceSeqs:[1,2]}),modelPolicy:{resolve:()=>({actualRoute:route,main:route,execution:'spawn'})},
  selectedStatusRecord:()=>outcome==='reuse'?{turnId:1,atSeq:2,provenance:{actualRoute:route},panel:{options}}:null,
  sameModelRoute:(a,b)=>a?.model===b.model&&a?.provider===b.provider,
  normalizeStatusRecord:v=>v,normalizeStatusOption:normalize,buildDecisionContext:async()=>({context:{},dependencies:[]}),
  memoryForContext:()=>null,ctx:{get:()=>null},resolveRoute:()=>({session}),
  async llmJson(_ctx,_route,request){calls.push(request);request.onAdmission({id:'decision-job'});await gate.promise;request.signal.throwIfAborted();request.onResult({id:'decision-job',generation:'g1',actualRoute:route,execution:'spawn'});return {options}},
  DECISION_SYSTEM:'fixture',cfg:{},DEFAULT_CONFIG:{decisionWorkerTimeoutMs:1000}}
 const api=createRoleplayDecision(deps)
 if(outcome==='update-race')current={turnId:0,options:[]}
 const first=api.publishTurnDecision(session,event,snapshot,'body',firstOwner.signal)
 const second=api.publishTurnDecision(session,event,snapshot,'body',secondOwner.signal)
 assert.equal(first,second,'duplicate callers share the same job')
 await decisionTick()
 assert.equal(calls.length,outcome==='reuse'?0:1)
 if(outcome==='answered')current={turnId:1,answered:true,options:[]}
 if(outcome==='superseded')current={turnId:1,superseded:true,options:[]}
 if(outcome==='newer')current={turnId:2,options:[]}
 if(outcome==='stale')stale=true
 if(outcome==='cancel')secondOwner.abort(new Error('second owner cancelled'))
 gate.resolve()
 if(outcome==='cancel')await assert.rejects(first,/second owner cancelled/)
 else await first
 await first.admission
 if(['publish','reuse'].includes(outcome)) {
  assert.equal(current.options.length,3)
  assert.equal(current.options[0].label.length,60)
  assert.equal(current.options[0].description.length,120)
  assert.equal(current.options[0].heart,true)
  assert.equal(current.provenance[outcome==='reuse'?'reusedFrom':'taskId'],outcome==='reuse'?'status':'decision-job')
 } else if(outcome==='update-race')assert.equal(current.answered,true)
 else assert.equal(writes.length,0,`${outcome}: old worker cannot publish`)
}
console.log('decision-publication=ok (singleflight, owner cancellation, stale/answer/supersede fences, status reuse)')
