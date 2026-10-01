import assert from 'node:assert/strict'
import { inlineTaskInstruction, inlineTaskMessages, taskPhaseMessage, awaitTaskAdmissions, InlinePending, tavernTaskToolBoundary } from '../lib/core/tavern-tasks.js'
import {maintenancePrompt,maintenanceTaskInputs} from '../lib/core/tavern-task-context.js'
{
 const admitted=[]
 const first=Promise.resolve().then(()=>{admitted.push('first');throw new InlinePending('first')})
 const second=new Promise((_,reject)=>setTimeout(()=>{admitted.push('second');reject(new InlinePending('second'))},10))
 await assert.rejects(awaitTaskAdmissions([first,second]),error=>error.code==='TAVERN_INLINE_PENDING')
 assert.deepEqual(admitted,['first','second'],'all same-phase task records exist before yielding to the main loop')
 assert.deepEqual(await awaitTaskAdmissions([Promise.resolve(1),Promise.resolve(2)]),[1,2])
}

const job=(id,input,extra={})=>({schemaVersion:1,id,generation:`g-${id}`,kind:'memory',branchId:'s',sessionId:'s',sourceHash:'sha',execution:'inline',status:'queued',input,...extra})
{
 const body='VISIBLE-STORY '.repeat(100),core='RESIDENT-CORE '.repeat(100),old='ARCHIVED-UNSEEN '.repeat(100)
 const make=(kind,context)=>{const {user,promptContext}=maintenancePrompt(context,kind+' instructions\n','\nreturn '+kind);return job(kind,{system:kind,user,format:'json'},{kind,promptContext})}
 const jobs=[make('status',{story:{text:body},core,old,template:'STATUS-ONLY'}),make('decision',{narrative:body,core,action:'DECISION-ONLY'})]
 const before=structuredClone(jobs)
 const resident=[{name:'本轮正文 seq=9',text:body},{name:'roleplay:rules',text:core}]
 const text=inlineTaskInstruction(jobs,{sessionId:'s',resident})
 assert.ok(!text.includes(body)&&!text.includes(core),'main loop reuses verified resident text')
 assert.ok(text.includes(old),'old evidence outside the current request remains complete')
 assert.ok(text.includes('STATUS-ONLY')&&text.includes('DECISION-ONLY'))
 assert.ok(text.includes('currentContextRef')&&text.includes('seq=9'))
 const fallback=inlineTaskInstruction(jobs,{sessionId:'s'})
 assert.equal(fallback.split(body).length-1,1,'without resident proof, include full common source once')
 assert.equal(fallback.split(core).length-1,1)
 assert.deepEqual(jobs,before,'transport must not mutate durable source')
 for(const invalid of [{...jobs[0].promptContext,schemaVersion:99},{...jobs[0].promptContext,context:{fake:'WRONG'}}]){
  const restored={...jobs[0],promptContext:invalid}
  assert.deepEqual(maintenanceTaskInputs([restored],resident).inputs[0],jobs[0].input,'invalid metadata falls back to the full input')
 }
 const bounded=inlineTaskInstruction(jobs,{sessionId:'s',resident,maxChars:1})
 assert.ok(!bounded.includes(body)&&!bounded.includes(old),'oversized inputs use paginated reads, never partial sources')
}
const small=job('a',{system:'check source evidence',user:'whole source\nwith conditions',format:'json'})
const other=job('b',{system:'second independent contract',user:'another source',format:'json'})
const result=inlineTaskInstruction([small,other])
assert.ok(result.includes(small.input.user.replaceAll('\n','\\n')),'complete small source is available on the first maintenance model step')
assert.ok(result.includes('rp_task_submit'))
assert.ok(!result.includes('HIDDEN_SERVER_HASH'))
assert.equal((result.match(/"id":"[ab]"/g)||[]).length,2,'each compatible obligation appears once')
assert.ok(result.includes('不需要再次调用 rp_task_read'))
const prepared=inlineTaskInstruction([job('recall',{user:'r'.repeat(15000)}),job('scene',{user:'s'.repeat(58000)})])
assert.equal((prepared.match(/"completeSource":true/g)||[]).length,2,'representative recall and scene inputs arrive together instead of an extra read-only model step')
const huge=job('huge',{system:'contract',user:'large'.repeat(30_000),format:'text'})
const limited=inlineTaskInstruction([huge,other],{maxChars:4000})
assert.ok(!limited.includes(huge.input.user),'large source is not partially injected')
assert.ok(limited.includes('rp_task_read'))
assert.ok(limited.includes(other.input.user),'large job does not block a small independent obligation')
for(const kind of ['card-import','card-export','novel-export']) {
 assert.ok(!inlineTaskInstruction([job(kind,{system:'full workflow',user:'KEEP_EXPLICIT_REVIEW'}, {kind})]).includes('KEEP_EXPLICIT_REVIEW'),'card/novel review workflow remains explicit')
}
assert.ok(!inlineTaskInstruction([job('foreign',{user:'FOREIGN'},{sessionId:'other',branchId:'other'})],{sessionId:'s'}).includes('FOREIGN'))
assert.ok(!inlineTaskInstruction([job('done',{user:'DONE'},{status:'completed'})]).includes('DONE'))
assert.ok(!inlineTaskInstruction([job('spawn',{user:'SPAWN'},{execution:'spawn'})]).includes('SPAWN'))
const session={id:'s',events:[{seq:0,type:'turn/start',data:{turn:1}}]}
const first=inlineTaskMessages(session,'prepare',[small])
assert.equal(first.length,1)
assert.equal(first[0].source.schemaVersion,1)
session.events.push({seq:1,type:'user/message',data:first[0]},{seq:2,type:'tool/result',data:{}})
assert.deepEqual(inlineTaskMessages(session,'prepare',[small]),[],'unchanged task payload is not injected again after a read/tool step')
assert.equal(inlineTaskMessages(session,'prepare',[{...small,generation:'retry'}]).length,1,'retry generation must be delivered')
assert.equal(inlineTaskMessages(session,'after-story',[small]).length,1,'phase transitions retain their own provenance')
session.events.push({seq:3,type:'turn/end',data:{turn:1}},{seq:4,type:'turn/start',data:{turn:2}})
assert.equal(inlineTaskMessages(session,'prepare',[small]).length,1,'a new turn gets its own instruction')
assert.equal(inlineTaskMessages(session,'prepare',[small],{force:true}).length,1,'turn-stopping can steer unfinished work')
assert.equal(taskPhaseMessage('story','story').source.stage,'story')
{
 const id='a'.repeat(64),agent={session:{id:'child',events:[]},options:{subagentDepth:1,tavernTaskId:id}}
 for(const allowedTools of [null,'rp_history',false,42,{rp_history:true}]) {
   assert.deepEqual([...tavernTaskToolBoundary({get:()=>({allowedTools})},agent)],[],'malformed allowlist must grant no tools')
 }
 assert.deepEqual([...tavernTaskToolBoundary({get:()=>({allowedTools:['rp_history','spawn','fork','send_message',42]})},agent)],['rp_history'])
}
{
 const log=Array.from({length:100_000},(_,seq)=>({seq,type:'request/stream',data:{}}))
 log.push({seq:log.length,type:'user/message',data:first[0]})
 let iterations=0,indexReads=0
 const tracked=new Proxy(log,{get(target,key,receiver){
   if(key===Symbol.iterator)iterations++
   if(typeof key==='string'&&/^\d+$/.test(key))indexReads++
   return Reflect.get(target,key,receiver)
 }})
 assert.deepEqual(inlineTaskMessages({id:'s',events:tracked},'prepare',[small]),[])
 assert.equal(iterations,0,'a known current tail must not iterate or copy the entire stream log')
 assert.equal(indexReads,1,'duplicate phase detection only needs the last event')
 console.log(`task-phase-tail: events=${log.length}, indexedReads=${indexReads}, fullIterations=${iterations}`)
}
console.log('inline task delivery: PASS')
