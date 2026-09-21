import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createCharacterCluster,characterInput,clusterRoute,clusterSettings,CHARACTER_PERSONA} from '../lib/core/character-cluster.js'
import {registerSettingsRoutes} from '../lib/core/roleplay-settings-routes.js'
assert.equal(clusterRoute(null),null)
assert.deepEqual(clusterRoute({main:true,reasoningEffort:'high',provider:'ignored'}),{main:true,reasoningEffort:'high'})
assert.deepEqual(clusterRoute({provider:'fixture',model:'main',reasoningEffort:123}),{provider:'fixture',model:'main',reasoningEffort:123},'legacy effort coercion must retain its serialized value')
assert.throws(()=>clusterRoute({provider:'fixture',model:'bad\nmodel'}),/角色模型无效/)
assert.throws(()=>clusterRoute({main:true,reasoningEffort:'bad effort'}),/思考等级无效/)
assert.throws(()=>clusterSettings({enabled:true,characters:{'bad id':null}}),/人物 ID 无效/)
assert.throws(()=>clusterSettings(null),/必须指定集群开关/)
assert.deepEqual(clusterSettings({enabled:false}),{enabled:false,defaultRoute:null,characters:{}})
class Table extends Map {async put(k,v){this.set(k,structuredClone(v))}}
{
 const table=new Table(),routes=new Map(),primary={provider:'fixture',model:'main'}
 const cluster=createCharacterCluster({table,main:()=>primary,subagents:{start(){throw Error('settings must not generate')}}})
 registerSettingsRoutes({ctx:{effect:fn=>fn(),connection:{fetch:{register:route=>routes.set(route.path,route.fetch)}},get:()=>null,agentDefaultModel:{currentSelection:()=>primary},llm:{resolveModelInfo:async()=>({})}},
   T:{branch:table},resolveRoleplaySession:async id=>({id}),ensureBranch:async()=>{},taskAgents:new Map(),characterCluster:cluster,characterRoster:()=>[],memorySettingFields:[]})
 const post=async body=>{const response=await routes.get('/api/roleplay/character-cluster')(new Request('http://fixture/api/roleplay/character-cluster',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()}}
 const changed=await post({sessionId:'a',scope:'global',settings:{enabled:false,defaultRoute:{provider:'fixture',model:'shared'},characters:{}},expectedRevision:0})
 assert.equal(changed.status,200)
 assert.equal(cluster.read({id:'b'}).defaultRoute?.model,'shared','saving the default model must apply across conversations')
 assert.equal(cluster.read({id:'a'}).enabled,false);assert.equal(cluster.read({id:'b'}).enabled,false,'global model save cannot enable any conversation')
 assert.equal((await post({sessionId:'b',scope:'global',settings:{enabled:false,defaultRoute:null},expectedRevision:0})).status,409,'global edits share one CAS revision')
}
{
 const t=new Table(),primary={provider:'fixture',model:'primary'},global={provider:'fixture',model:'global'},override={provider:'fixture',model:'character'}
 const starts=[],spawn=async(_,request)=>{starts.push(request.agentOptions.model);return {id:'global-child-'+starts.length,result:Promise.resolve({stopReason:'completed',output:[{type:'text',text:'global route'}]}),dispose(){}}}
 const make=()=>createCharacterCluster({table:t,rootOf:s=>s.id.startsWith('branch-')?'shared-worldline':s.id,main:()=>primary,subagents:{start:spawn}})
 const first=make(),session={id:'conversation-global'},other={id:'conversation-other'}
 await first.saveGlobal({defaultRoute:global},0)
 await first.save(session,{enabled:true,defaultRoute:null,characters:{a:override}},0)
 assert.equal(first.read(other).enabled,false,'global model configuration must not enable another conversation')
 assert.equal(first.read({id:'branch-copy'}).enabled,false,'the same worldline keeps the local switch boundary')
 await first.save({id:'branch-original'},{enabled:true,defaultRoute:null,characters:{}},0)
 assert.equal(first.read({id:'branch-copy'}).enabled,true,'conversation branches share the worldline switch')
 const input={session,agent:{options:primary},turn:1,characters:[{id:'a',name:'Alice',content:'Alice'}],context:{core:'world',stories:[],notes:'',lore:[],userText:'hello'}}
 const result=await first.run(input)
 assert.equal(result.characters[0].status,'completed');assert.deepEqual(starts,['character'],'character override must win over the global model')
 const rebuilt=make()
 assert.equal(rebuilt.read(session).defaultRoute.model,'global','a reconstructed service must read the saved global route')
 assert.equal(rebuilt.read(session).enabled,true,'reconstructed service preserves the session switch')
 await assert.rejects(first.saveGlobal({defaultRoute:{provider:'fixture',model:'other'}},0),/全局角色模型已更新/,'global settings use their own CAS revision')
 const key='character-cluster-model-global',bad={schemaVersion:1,revision:'bad',enabled:false,defaultRoute:null,characters:{}}
 await t.put(key,bad)
 assert.throws(()=>rebuilt.readGlobal(),/损坏/)
 await assert.rejects(rebuilt.saveGlobal({defaultRoute:global},1),/损坏/)
 assert.deepEqual(t.get(key),bad,'corrupt global settings must not be written back')
}
const table=new Table(),session={id:'branch-a'},main={provider:'fixture',model:'main'},agent={session,options:main}
let calls=[],active=0,peak=0
const subagents={async start(kind,request){
  calls.push(request);active++;peak=Math.max(peak,active)
  assert.equal(kind,'spawn');assert.deepEqual(request.toolFilter,{allow:['rp_history']})
  const input=JSON.parse(request.prompt[0].text)
  assert.equal(input.character.content,input.character.id==='a'?'Alice secret':'Bob secret')
  assert.ok(!request.prompt[0].text.includes('FORBIDDEN_CSS'))
  return {id:'child-'+calls.length,result:new Promise(resolve=>setTimeout(()=>{active--;resolve({stopReason:'completed',output:[{type:'text',text:input.character.id+' intention'}]})},5)),dispose(){}}
}}
const cluster=createCharacterCluster({table,subagents,rootOf:s=>s.id.startsWith('branch')?'conversation-a':s.id,main:()=>main})
assert.equal(cluster.read(session).enabled,false)
const spec={session,agent,turn:2,characters:[{id:'a',name:'Alice',content:'Alice secret'},{id:'b',name:'Bob',content:'Bob secret'}],context:{core:'world',stories:[{seq:1,kind:'assistant',text:'story'}],notes:'director',lore:[{text:'lore'}],userText:'hello',css:'FORBIDDEN_CSS'}}
await assert.rejects(cluster.run(spec),/未开启/)
await cluster.save(session,{enabled:true,defaultRoute:null,characters:{}},0)
assert.equal(cluster.read({id:'branch-b'}).enabled,true)
assert.equal(cluster.read({id:'explicit-clone'}).enabled,false)
await assert.rejects(cluster.save(session,{enabled:false},0),/已更新/)
const result=await cluster.run(spec)
assert.equal(result.characters.length,2);assert.equal(peak,2);assert.equal(calls.length,2)
assert.equal(calls[0].agentOptions.model,'main','same model still uses separate native child')
assert.notEqual(calls[0].agentOptions.tavernTaskId,calls[1].agentOptions.tavernTaskId)
assert.equal(JSON.parse(calls[0].prompt[0].text).directorNotes,'director')
await cluster.run(spec);assert.equal(calls.length,2,'same frozen work is idempotent')
const input=characterInput({...spec.context,character:spec.characters[0],branchId:session.id,turn:2})
assert.equal(input.css,undefined);assert.equal(input.rules,undefined)
assert.ok(CHARACTER_PERSONA.includes('欲望、矛盾、缺陷'))
let attempts=0
const fallback=createCharacterCluster({table:new Table(),main:()=>main,subagents:{async start(_,r){attempts++;if(r.agentOptions.model==='bad')throw {status:401};return {id:'fallback',result:Promise.resolve({stopReason:'completed',output:[{type:'text',text:'fallback intention'}]}),dispose(){}}}}})
await fallback.save(session,{enabled:true,defaultRoute:{provider:'fixture',model:'bad'},characters:{}},0)
const recovered=await fallback.run({...spec,characters:[spec.characters[0]]})
assert.equal(attempts,2);assert.equal(recovered.characters[0].status,'completed')
let current=true,release
const stale=createCharacterCluster({table:new Table(),main:()=>main,isCurrent:()=>current,subagents:{async start(){return {id:'late',result:new Promise(r=>release=r),dispose(){}}}}})
await stale.save(session,{enabled:true},0)
const pending=stale.run({...spec,characters:[spec.characters[0]]})
while(!release)await new Promise(r=>setTimeout(r,1))
current=false;release({stopReason:'completed',output:[{type:'text',text:'stale'}]})
await assert.rejects(pending,/世界线/)
console.log('character cluster: isolated parallel contexts, session settings, fallback and stale-result guards passed')
{
 const t=new Table(),a={...agent},s={...session}
 const timed=createCharacterCluster({table:t,main:()=>main,timeoutMs:5,subagents:{async start(_,r){return {id:r.agentOptions.model,result:r.agentOptions.model==='hang'?new Promise(()=>{}):Promise.resolve({stopReason:'completed',output:[{type:'text',text:'recovered'}]}),dispose(){}}}}})
 await timed.save(s,{enabled:true,defaultRoute:{provider:'fixture',model:'hang'}},0)
 assert.equal((await timed.run({...spec,session:s,agent:a,characters:[spec.characters[0]]})).characters[0].status,'completed')
 const job=[...t.values()].find(v=>v.kind==='character')
 assert.equal(job.fallback.failure.category,'timeout');assert.deepEqual(job.childSessionIds,['hang','main']);assert.equal(job.error,null)
 await t.put('character-cluster-settings__'+s.id,{schemaVersion:2})
 assert.throws(()=>timed.read(s),/版本/)
}

{
 const legacy=JSON.parse(readFileSync(new URL('./fixtures/character-cluster-legacy-v1.json',import.meta.url),'utf8'))
 const t=new Table(legacy.records),before=structuredClone([...t])
 let starts=0,writes=0
 t.put=async()=>{writes++;throw Error('completed legacy record must not be rewritten')}
 const resumed=createCharacterCluster({table:t,main:()=>legacy.primary,subagents:{start(){starts++;throw Error('unexpected model request')}}})
 assert.deepEqual(await resumed.run(legacy.input),legacy.result,'old JS task hashes and completed results resume unchanged')
 assert.deepEqual([...t],before);assert.equal(starts,0);assert.equal(writes,0)
}
{
 const t=new Table(),key='character-cluster-settings__'+session.id
 const malformed={schemaVersion:1,revision:'bad',enabled:true,defaultRoute:null,characters:{}}
 await t.put(key,malformed)
 const guarded=createCharacterCluster({table:t,main:()=>main,subagents:{start(){throw Error('must not spawn')}}})
 assert.throws(()=>guarded.read(session),/损坏/)
 await assert.rejects(guarded.save(session,{enabled:false},0),/损坏/)
 assert.deepEqual(t.get(key),malformed,'invalid settings remain available for recovery')
}
{
 const t=new Table(),ac=new AbortController()
 let late,started,disposed=0
 const ready=new Promise(resolve=>started=resolve)
 const delayed=createCharacterCluster({table:t,main:()=>main,subagents:{start(){started();return new Promise(resolve=>late=resolve)}}})
 await delayed.save(session,{enabled:true},0)
 const work=delayed.run({...spec,characters:[spec.characters[0]],signal:ac.signal})
 await ready;ac.abort(new Error('cancelled test'))
 await assert.rejects(work,/cancelled test/)
 late({id:'late-child',result:Promise.resolve({stopReason:'completed',output:[{type:'text',text:'late'}]}),dispose(){disposed++;throw Error('dispose failed')}})
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(disposed,1,'late child must be released even after cancellation')
 assert.equal([...t.values()].find(value=>value.kind==='character').status,'cancelled')
}
{
 const t=new Table()
 let rejectResult,started
 const ready=new Promise(resolve=>started=resolve)
 const fenced=createCharacterCluster({table:t,main:()=>main,subagents:{start(){started();return {id:'obsolete-child',result:new Promise((_,reject)=>rejectResult=reject),dispose(){}}}}})
 await fenced.save(session,{enabled:true},0)
 const work=fenced.run({...spec,characters:[spec.characters[0]]})
 await ready;await new Promise(resolve=>setImmediate(resolve))
 const [key,old]=[...t].find(([,value])=>value.kind==='character')
 const replacement={...old,generation:'new-generation',status:'completed',result:'newer result'}
 await t.put(key,replacement)
 rejectResult(new Error('late obsolete failure'))
 await work
 assert.deepEqual(t.get(key),replacement,'late failure must not overwrite a newer generation')
}
{
 const t=new Table()
 let resolveStart,started,disposed=0
 const ready=new Promise(resolve=>started=resolve)
 const fenced=createCharacterCluster({table:t,main:()=>main,subagents:{start(){started();return new Promise(resolve=>resolveStart=resolve)}}})
 await fenced.save(session,{enabled:true},0)
 const work=fenced.run({...spec,characters:[spec.characters[0]]})
 await ready
 const [key,old]=[...t].find(([,value])=>value.kind==='character')
 const replacement={...old,generation:'new-generation',status:'completed',result:'newer result'}
 await t.put(key,replacement)
 resolveStart({id:'late-start',result:Promise.resolve({stopReason:'completed',output:[{type:'text',text:'obsolete'}]}),dispose(){disposed++}})
 await work;await new Promise(resolve=>setImmediate(resolve))
 assert.deepEqual(t.get(key),replacement,'late start must not overwrite a newer generation')
 assert.equal(disposed,1)
}
console.log('character cluster migration: legacy resume, malformed settings, late disposal and generation fences passed')
