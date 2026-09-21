import assert from 'node:assert/strict'
import * as context from '../lib/core/tavern-task-context.js'
import type {TaskEvent,InlineContextJob} from '../lib/core/tavern-task-context.js'
import {retireDeliveredDraft,retireCoarseResearchReads} from '../lib/core/card-adaptation-context.js'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createTestDirectory,cleanupTestDirectory} from '../lib/operations/test-temp.mjs'
import {canonicalAssistantForTurn,surfaceEntries} from '../lib/core/roleplay-context.js'
import {importManagementInputs} from '../lib/memory/memory-history.js'
import {createFirstResponseWatchdog} from '../lib/core/roleplay-loop.js'
const native=process.env.DSH_NATIVE_SESSION_MODULE?await import(process.env.DSH_NATIVE_SESSION_MODULE):null
function fixture(id:string){const events:TaskEvent[]=[],surface={nodes:[] as number[]};return {id,events,surface,
 append(type:string,data:TaskEvent['data'],options?:{surfaceOp:'append'|{op:string;startSeq:number;endSeq:number};sourceEventSeqs?:number[]}){
  const e={seq:events.length,type,data,...options};events.push(e)
  if(options?.surfaceOp==='append')surface.nodes.push(e.seq)
  else if(options?.surfaceOp){const a=surface.nodes.indexOf(options.surfaceOp.startSeq),b=surface.nodes.indexOf(options.surfaceOp.endSeq);assert.ok(a>=0&&b>=a);surface.nodes.splice(a,b-a+1,e.seq)}return e
 },deriveMessages(){return surface.nodes.map(seq=>{const e=events[seq]!;return e.type==='user/message'?e.data:e.data?.message})}}}
const create=(id:string)=>native?native.Session.create(id):fixture(id)
const model={kind:'model',provider:'fixture',model:'fixture'}
const toolResult=(id:string,error=false)=>({turn:1,step:2,message:{id:'result-'+id,role:'tool',source:{kind:'tool',callId:id},isError:error,content:[{type:'tool-result',toolCallId:id,content:[{type:'text',text:error?'INITIAL_VALIDATION_ERROR':'{"ok":true}'}]}]}})
for(const variant of ['saved','deferred','unproven-deferred','partial','wrong-owner','wrong-source','wrong-generation','wrong-hash','failed-note','early-note','reread','hidden-note','mixed']){
 const s=fixture('coarse-checkpoint-'+variant),owner=s.id
 const env={schemaVersion:1,owner,sourceId:'novel',textSha256:'a'.repeat(64),generation:'g1',packetIds:['p1','p2']}
 const call=(id:string,action:string,proof:unknown,failed=false,visible=true)=>{
  const message=s.append('assistant/message',{turn:1,message:{content:[{type:'tool-call',id,name:'rp_source_research',arguments:JSON.stringify({action,source_id:'novel'})},...(variant==='mixed'&&action==='query'?[{type:'text',text:'KEEP_UNRELATED_TEXT'}]:[])]}},{surfaceOp:'append'})
  const result=toolResult(id,failed);result.message.content[0]!.content[0]!.text=JSON.stringify(proof)
  const output=s.append('tool/result',result,visible?{surfaceOp:'append'}:undefined)
  return {message,output}
 }
 const note=()=>call('note','append',{sourceId:'novel',researchCheckpoint:{...env,revision:2,
  ...(variant==='partial'?{packetIds:['p1']}:{}),...(variant==='unproven-deferred'?{packetIds:['p1','p2','foreign-packet']}:{}),...(variant==='wrong-owner'?{owner:'foreign'}:{}),
  ...(variant==='wrong-source'?{sourceId:'other'}:{}),...(variant==='wrong-generation'?{generation:'g2'}:{}),
  ...(variant==='wrong-hash'?{textSha256:'b'.repeat(64)}:{})}},variant==='failed-note',variant!=='hidden-note')
 if(variant==='early-note')note()
 const read=call('read','query',{sourceId:'novel',researchDelivery:env,text:'LONG_ORIGINAL_EVIDENCE'})
 const deferred=['deferred','unproven-deferred'].includes(variant)?s.append('user/message',{source:{kind:'plugin',plugin:'roleplay-tasks',form:'coarse-research-evidence',...env,...(variant==='unproven-deferred'?{packetIds:['foreign-packet']}: {})},content:[{type:'text',text:'LARGE_DEFERRED_ORIGINAL'.repeat(3000)}]},{surfaceOp:'append'}):null
 if(variant!=='early-note')note()
 const reread=variant==='reread'?call('reread','read',{sourceId:'novel',researchDelivery:env,text:'KEEP_EXPLICIT_REREAD'}):null
 const before=JSON.stringify(s.events),count=s.events.length,retired=retireCoarseResearchReads(s,owner)
 assert.equal(retired,variant==='deferred'?3:['saved','reread','unproven-deferred'].includes(variant)?2:0,variant)
 assert.equal(JSON.stringify(s.events.slice(0,count)),before,'append-only coarse evidence')
 if(retired){assert.ok(!s.surface.nodes.includes(read.output.seq));assert.equal(retireCoarseResearchReads(s,owner),0,'idempotent')}
 if(reread)assert.ok(s.surface.nodes.includes(reread.output.seq),'earlier notes cannot retire later explicit reread')
 if(deferred)assert.equal(s.surface.nodes.includes(deferred.seq),variant==='unproven-deferred','deferred original needs matching delivered packet proof and later note')
}
for(const variant of ['silent','metadata-only','first-output','aborted','ended','superseded','disposed']){
 const signal=new AbortController(),cancelled:{cause:unknown;options:unknown}[]=[],watch=createFirstResponseWatchdog(20)
 const agent={session:{id:'watch-'+variant},cancel(cause:unknown,options:unknown){cancelled.push({cause,options});signal.abort()}}
 watch.begin(agent,1,1,signal.signal)
 if(variant==='metadata-only')watch.observe(agent.session,{type:'assistant/chunk',data:{turn:1,step:1,chunk:{type:'text-start'}}})
 if(variant==='first-output')watch.observe(agent.session,{type:'assistant/chunk',data:{turn:1,step:1,chunk:{type:'reasoning-delta'}}})
 if(variant==='aborted')signal.abort()
 if(variant==='ended')watch.observe(agent.session,{type:'step/end',data:{turn:1,step:1}})
 if(variant==='superseded'){watch.begin(agent,2,1,signal.signal);watch.observe(agent.session,{type:'assistant/chunk',data:{turn:2,step:1,chunk:{type:'tool-call-delta'}}})}
 if(variant==='disposed')watch.dispose()
 await new Promise(resolve=>setTimeout(resolve,40))
 assert.equal(cancelled.length,['silent','metadata-only'].includes(variant)?1:0,variant+': bounded silence cancels only its exact native activity')
 if(cancelled.length)assert.deepEqual(cancelled[0]!.options,{keepInbox:true},'timeout keeps queued player input')
 watch.dispose()
}
// Native questionnaires can keep authoring, import and the opening in one turn.
for(const variant of ['active','wrong-id','wrong-hash','failed','unseen-proof','early-phase','no-phase']){
 const s=fixture('authoring-opening-'+variant),add=(type:string,data:TaskEvent['data'],visible=true)=>s.append(type,data,visible?{surfaceOp:'append'}:undefined)
 add('turn/start',{turn:1},false)
 const player=add('user/message',{source:{kind:'user'},content:[{type:'text',text:'Adapt a novel.'}]})
 add('tool/call',{turn:1,name:'rp_card_draft_check',callId:'draft'},false)
 add('assistant/message',{turn:1,message:{content:[{type:'text',text:'The new card is delivered.'}]}})
 add('tool/call',{turn:1,name:'ask_user_question',callId:'choice'},false)
 const phase=()=>add('user/message',context.taskPhaseMessage('story','Show the opening.',{openingImportId:'i'}))
 if(variant==='early-phase')phase()
 for(const [name,id,proof] of [['rp_card_import_begin','begin',{ok:true,importId:'i',normalizedSha256:'a'.repeat(64)}],['rp_card_import_finalize','final',{ok:true,importId:variant==='wrong-id'?'other':'i',normalizedSha256:(variant==='wrong-hash'?'b':'a').repeat(64),activatedAt:123,coverage:1}]] as const){
  add('assistant/message',{turn:1,message:{content:[{type:'tool-call',id,name,arguments:'{}'}]}},variant!=='unseen-proof')
  const result=toolResult(id,variant==='failed'&&id==='final');result.message.content[0]!.content[0]!.text=JSON.stringify(proof);add('tool/result',result,variant!=='unseen-proof')
 }
 if(!['early-phase','no-phase'].includes(variant))phase()
 const opening=add('assistant/message',{turn:1,message:{content:[{type:'text',text:'The ship arrives.'}]}})
 add('turn/end',{turn:1,reason:{kind:'completed'}},false)
 assert.equal(context.internalTaskSeqs(s).has(opening.seq),variant!=='active',variant+': only proven post-import prose escapes authoring isolation')
 assert.equal(importManagementInputs(s).has(opening.seq),variant!=='active',variant+': memory uses the same boundary')
 assert.ok(importManagementInputs(s).has(player.seq),'authoring request never becomes story input')
 assert.equal(canonicalAssistantForTurn(s,1)?.seq,variant==='active'?opening.seq:undefined)
}
{
 const raw:TaskEvent[]=[{seq:0,type:'turn/start',data:{turn:1}},{seq:1,type:'user/message',data:{id:'player',source:{kind:'user'},content:[{type:'text',text:'Enter.'}]}}]
 for(let i=0;i<100000;i++)raw.push({seq:raw.length,type:'assistant/chunk',data:{turn:1}})
 const body=raw.length;raw.push({seq:body,type:'assistant/message',data:{turn:1,message:{id:'body',content:[{type:'text',text:'Door opens.'}]}}})
 raw.push({seq:raw.length,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}})
 const s={id:'immutable-stream',events:Object.freeze([...raw]),surface:{nodes:[1,body]}}
 const projection=context.taskProjectionEvents(s)
 assert.equal(projection.length,4)
 assert.equal(canonicalAssistantForTurn(s,1)?.seq,body);assert.equal(surfaceEntries(s).length,2)
 s.events=Object.freeze([...s.events,{seq:s.events.length,type:'assistant/chunk',data:{turn:2}}])
 assert.equal(context.taskProjectionEvents(s),projection,'stream-only appends do not invalidate ownership projection')
 assert.equal(canonicalAssistantForTurn(s,1)?.seq,body)
 s.surface.nodes=[1]
 assert.equal(canonicalAssistantForTurn(s,1),null,'surface removal invalidates canonical despite unchanged semantic events')
 s.events=Object.freeze([...s.events,{seq:s.events.length,type:'tool/call',data:{turn:1,name:'rp_setting',arguments:'{"action":"patch"}'}}])
 assert.ok(context.internalTaskSeqs(s).has(body),'new management provenance invalidates the semantic cache')
 context.internalTaskSeqs(s).clear();assert.ok(context.internalTaskSeqs(s).has(body),'callers cannot mutate cached ownership')
}
const draftDirectory=createTestDirectory('delivered-draft-')
try {
 const draftPath=path.join(draftDirectory,'checked-card.md'),draftText='# 已完成的角色卡\n完整草稿用于回收检查点。'
 const digest=createHash('sha256').update(draftText).digest('hex')
 for(const variant of ['delivered','current','not-ended','changed-file','invalid-check']){
  fs.writeFileSync(draftPath,variant==='changed-file'?draftText+'尚未检查的修改':draftText)
  const s=Object.assign(fixture('draft-'+variant),{header:{cwd:draftDirectory}}),add=(type:string,data:unknown,visible=true)=>s.append(type,data as TaskEvent['data'],visible?{surfaceOp:'append'}:undefined)
  add('turn/start',{turn:1},false)
  const player=add('user/message',{role:'user',source:{kind:'user'},content:[{type:'text',text:'KEEP_PLAYER_CHOICES'}]})
  const call=(name:string,id:string,proof:unknown)=>{
   add('assistant/message',{turn:1,message:{content:[{type:'tool-call',id,name,arguments:'{}'}]}})
   add('tool/call',{turn:1,callId:id,name},false)
   const result=toolResult(id);result.message.content[0]!.content[0]!.text=JSON.stringify(proof);return add('tool/result',result)
  }
  call('rp_card_draft_check','begin',{ok:true,mode:'authoring'})
  call('run_code','research',{text:'OLD_RESEARCH_AND_DRAFT'.repeat(10000)})
  const checked=call('rp_card_draft_check','checked',{ok:variant!=='invalid-check',schemaVersion:1,sourcePath:draftPath,sha256:digest,statusRendering:{renderable:true},errors:[]})
  const delivered=add('assistant/message',{turn:1,message:{content:[{type:'text',text:'KEEP_CARD_LINK: '+draftPath}]}})
  if(variant!=='not-ended')add('turn/end',{turn:1,reason:{kind:'completed'}},false)
  const before=JSON.stringify(s.events),count=s.events.length
  const retired=retireDeliveredDraft(s,variant==='current'?1:2)
  assert.equal(retired>0,variant==='delivered',variant)
  assert.equal(JSON.stringify(s.events.slice(0,count)),before)
  assert.ok(s.surface.nodes.includes(player.seq)&&s.surface.nodes.includes(checked.seq)&&s.surface.nodes.includes(delivered.seq))
  if(variant==='delivered'){assert.doesNotMatch(JSON.stringify(s.deriveMessages()),/OLD_RESEARCH_AND_DRAFT/);assert.equal(retireDeliveredDraft(s,3),0)}
 }
}finally{cleanupTestDirectory(draftDirectory)}

// A proven active import may release its complete tool prelude before the same-turn opening request.
for(const variant of ['active','wrong-hash','pending']){
 const s=fixture('same-turn-import-'+variant),add=(type:string,data:unknown,visible=true)=>s.append(type,data as TaskEvent['data'],visible?{surfaceOp:'append'}:undefined)
 add('turn/start',{turn:1},false)
 const player=add('user/message',{source:{kind:'user'},content:[{type:'text',text:'Import the delivered file.'}]})
 for(const [name,id,proof] of [['rp_card_import_begin','begin',{ok:true,importId:'i'}],['rp_card_import_chunk','chunk',{text:'IMPORT_PAYLOAD_ONLY'.repeat(2000)}],['rp_card_import_finalize','final',{ok:true,importId:'i',activatedAt:123,coverage:1,normalizedSha256:'a'.repeat(64)}]] as const){
  add('assistant/message',{turn:1,message:{content:[{type:'tool-call',id,name,arguments:'{}'}]}})
  if(variant==='pending'&&id==='final')break
  const result=toolResult(id);result.message.content[0]!.content[0]!.text=JSON.stringify(proof);add('tool/result',result)
 }
 const raw=JSON.stringify(s.events),length=s.events.length
 const retired=context.retireCompletedTaskContexts(s,1,{importId:'i',normalizedSha256:(variant==='wrong-hash'?'b':'a').repeat(64),opening:'EXACT_AUTHOR_OPENING'})
 assert.equal(retired>0,variant==='active');assert.equal(JSON.stringify(s.events.slice(0,length)),raw);assert.ok(s.surface.nodes.includes(player.seq))
 if(variant==='active'){assert.match(JSON.stringify(s.deriveMessages()),/EXACT_AUTHOR_OPENING/);assert.doesNotMatch(JSON.stringify(s.deriveMessages()),/IMPORT_PAYLOAD_ONLY/)}
}
for(const variant of ['activated','active-current','coarse-current','wrong-current','failed-finalize','unproven-finalize','current-turn','not-ended','unstarted','closed','unfinished','wrong-source','wrong-import']){
 const s=create('research-retire-'+variant),add=(type:string,data:unknown,visible=true)=>s.append(type,data,visible?{surfaceOp:'append'}:undefined)
 const call=(name:string,id:string,proof:unknown,error=false)=>{
  add('assistant/message',{turn:1,message:{role:'assistant',content:[{type:'reasoning',text:'private reasoning'},{type:'tool-call',id,name,arguments:'{}'}]}})
  add('tool/call',{turn:1,name,callId:id},false)
  const result=toolResult(id,error);result.message.content[0]!.content[0]!.text=JSON.stringify(proof);return add('tool/result',result)
 }
 add('turn/start',{turn:1},false)
 const player=add('user/message',{role:'user',source:{kind:'user'},content:[{type:'text',text:'Keep the player preferences.'}]})
 call('rp_source_begin','begin',variant==='unstarted'?{error:'missing file'}:{sourceId:'novel'},variant==='unstarted')
 call('rp_source_read','read',{text:'NOVEL_RESEARCH_ONLY '.repeat(7000)})
 call('bash','fallback',{text:'OLD_RESEARCH_ERROR'},true)
 if(variant!=='unfinished')call('rp_source_finish','finish',{ok:true,sourceId:variant==='wrong-source'?'another-novel':'novel',status:'finished',segments:1,read:variant==='coarse-current'?0:1,reviewed:variant==='coarse-current'?0:1,...(variant==='coarse-current'?{readingMode:'coarse',research:{schemaVersion:2,mode:'coarse',status:'finished',coverage:{ready:true}}}:{})})
 if(variant==='closed')call('rp_source_close','close',{ok:true,mode:'authoring'})
 call('rp_card_import_begin','import',{ok:true,importId:variant==='wrong-import'?'other-import':'import',normalizedSha256:'a'.repeat(64)})
 call('read','rejected',{error:'read denied'},true)
 call('rp_card_import_finalize','finalize',{ok:true,coverage:1,importId:'import',activatedAt:123,normalizedSha256:variant==='unproven-finalize'?'invalid':'a'.repeat(64)},variant==='failed-finalize')
 add('user/message',context.taskPhaseMessage('story','Show the opening.',{openingImportId:'import'}))
 const scene=add('assistant/message',{turn:1,message:{role:'assistant',content:[{type:'text',text:'KEEP_FIRST_SCENE'}]}})
 add('user/message',context.taskPhaseMessage('after-story','Story committed.',{storySeq:scene.seq,turn:1}))
 if(!['not-ended','active-current','coarse-current','wrong-current'].includes(variant))add('turn/end',{turn:1,reason:{kind:'completed'}},false)
 const before=JSON.stringify(s.events),length=s.events.length
 context.retireCompletedTaskContexts(s,['current-turn','active-current','coarse-current','wrong-current'].includes(variant)?1:2,['active-current','coarse-current','wrong-current'].includes(variant)?{importId:variant==='wrong-current'?'other':'import',normalizedSha256:'a'.repeat(64),opening:'KEEP_FIRST_SCENE'}:undefined)
 const after=JSON.stringify(s.deriveMessages())
 if(['activated','active-current','coarse-current'].includes(variant)){
  assert.doesNotMatch(after,/NOVEL_RESEARCH_ONLY|OLD_RESEARCH_ERROR/,'completed novel adaptation must release research, including failed/mixed tool attempts')
  assert(s.surface.nodes.includes(player.seq)&&s.surface.nodes.includes(scene.seq),'player preferences and first scene survive')
  assert.equal(canonicalAssistantForTurn(s,1)?.seq,scene.seq,variant+': import proof remains traceable through research retirement receipts')
  assert.ok(!importManagementInputs(s).has(scene.seq),'retired research does not hide the proven opening from memory')
  assert.equal(context.retireCompletedTaskContexts(s,3),0,'completed research retirement is idempotent')
 }else assert.match(after,/NOVEL_RESEARCH_ONLY/,variant+': retain research without a completed matching workflow')
 assert.equal(JSON.stringify(s.events.slice(0,length)),before,'research audit is append-only')
}
const settles=new Set(['completed','failed','cancelled','cancel-generation','stale','error-then-success','retry-generation','retry-same-ended-turn','unrelated-pending','missing-result'])
for(const variant of [...settles,'pending','current','not-ended','external-late-result','wrong-source-hash']){
 const s=create('inline-retire-'+variant),add=(type:string,data:unknown,visible=true)=>s.append(type,data,visible?{surfaceOp:'append'}:undefined)
 add('turn/start',{turn:1},false)
 const player=add('user/message',{id:'player',role:'user',source:{kind:'user'},content:[{type:'text',text:'Open the door.'}]})
 const body=add('assistant/message',{turn:1,step:1,message:{id:'body',role:'assistant',source:model,content:[{type:'text',text:'The door opens.'}]}})
 const proof=add('user/message',context.taskPhaseMessage('after-story','Story committed.',{storySeq:body.seq,turn:1}))
 const jobs:InlineContextJob[]=['status','decision'].map(kind=>({id:kind,sessionId:s.id,kind,execution:'inline',status:'running',generation:'generation',sourceHash:'hash',input:{material:'MAINTENANCE_ONLY'.repeat(3500)}}))
 let freshInstruction:number|undefined
 const instruction=add('user/message',context.taskPhaseMessage('after-story',context.inlineTaskInstruction(jobs)))
 add('assistant/message',{turn:1,step:2,message:{id:'calls',role:'assistant',source:model,content:jobs.map(j=>({type:'tool-call',id:j.id,name:'rp_task_submit',arguments:'{}'}))}})
 for(const j of jobs){
  add('tool/call',{turn:1,step:2,callId:j.id,name:'rp_task_submit',arguments:'{}'},false)
  if(!(['missing-result','external-late-result'].includes(variant)&&j.kind==='decision'))add('tool/result',toolResult(j.id,variant==='error-then-success'&&j.kind==='decision'))
 }
 if(variant==='error-then-success'){
  add('assistant/message',{turn:1,step:3,message:{id:'retry-call',role:'assistant',source:model,content:[{type:'tool-call',id:'decision-corrected',name:'rp_task_submit',arguments:'{}'}]}})
  add('tool/call',{turn:1,step:3,callId:'decision-corrected',name:'rp_task_submit',arguments:'{}'},false);add('tool/result',toolResult('decision-corrected'))
 }
 if(variant==='external-late-result'){
  add('user/message',{id:'foreign',role:'user',source:{kind:'user'},content:[{type:'text',text:'Keep this player correction.'}]})
  add('tool/result',toolResult('decision'))
 }
 add('assistant/message',{turn:1,step:4,message:{id:'ack',role:'assistant',source:model,content:[{type:'text',text:'Maintenance finished.'}]}})
 if(variant==='retry-same-ended-turn'){
  const nextJob={...jobs[1]!,generation:'new-generation',input:{material:'NEW_RUNNING_CONTEXT'.repeat(1500)}}
  freshInstruction=add('user/message',context.taskPhaseMessage('after-story',context.inlineTaskInstruction([nextJob]))).seq
  add('assistant/message',{turn:1,step:5,message:{id:'new-attempt',role:'assistant',source:model,content:[{type:'tool-call',id:'new-read',name:'rp_task_read',arguments:'{}'}]}})
  add('tool/call',{turn:1,step:5,callId:'new-read',name:'rp_task_read',arguments:'{}'},false)
 }
 if(variant!=='not-ended')add('turn/end',{turn:1,reason:{kind:'completed'}},false)
 const baseline=JSON.stringify(s.deriveMessages())
 assert.equal(context.retireCompletedTaskContexts(s,2),0,'legacy retirement keeps the maintenance batch');assert.equal(JSON.stringify(s.deriveMessages()),baseline)
 jobs.forEach(j=>j.status='completed')
 if(['failed','cancelled','stale','pending'].includes(variant))jobs[1]!.status=variant==='pending'?'running':variant
 if(variant==='missing-result')jobs[1]!.status='cancelled'
 if(variant==='cancel-generation')Object.assign(jobs[1]!,{status:'cancelled',generation:'cancelled-generation'})
 if(variant==='failed')jobs[1]!.error='timeout STACK_PRIVATE '.repeat(12000)
 if(variant==='wrong-source-hash')jobs[1]!.sourceHash='unrelated-source'
 if(variant==='unrelated-pending')jobs.push({id:'unrelated',sessionId:s.id,kind:'memory',execution:'inline',status:'running',generation:'other-generation',sourceHash:'other-source'})
 if(variant==='retry-same-ended-turn')Object.assign(jobs[1]!,{generation:'new-generation',status:'running'})
 if(variant==='retry-generation'){
  Object.assign(jobs[1]!,{generation:'new-generation',status:'running'});add('turn/start',{turn:2},false)
  freshInstruction=add('user/message',context.taskPhaseMessage('prepare',context.inlineTaskInstruction([jobs[1]!]))).seq
 }
 const raw=JSON.stringify(s.events),before=JSON.stringify(s.deriveMessages()),count=s.events.length
 const retired=context.retireSettledInlineContexts(s,variant==='current'?1:2,jobs),after=JSON.stringify(s.deriveMessages())
 assert.equal(retired>0,settles.has(variant),variant);assert.equal(JSON.stringify(s.events.slice(0,count)),raw,variant+': append-only audit')
 assert.ok(s.surface.nodes.includes(body.seq)&&s.surface.nodes.includes(player.seq),variant+': story/player preserved')
 assert.ok(s.surface.nodes.includes(proof.seq),variant+': small after-story proof marker stays available')
 if(settles.has(variant)){
  assert.ok(!s.surface.nodes.includes(instruction.seq),variant+': large settled instructions retired independently of the proof marker')
  const receipt=s.events.at(-1)
  assert.equal(receipt.data.source.schemaVersion,1);assert.equal(receipt.data.source.form,'maintenance-receipt');assert.ok(receipt.sourceEventSeqs.includes(instruction.seq))
  assert.ok(!receipt.sourceEventSeqs.includes(proof.seq),'proof marker does not become part of the maintenance receipt')
  if(variant==='retry-generation'||variant==='retry-same-ended-turn'){
   assert.ok(s.surface.nodes.includes(freshInstruction),'new running attempt remains visible')
   assert.ok(receipt.data.source.attempts.some(a=>a.id==='decision'&&a.generation==='generation'&&a.state==='superseded'));assert.match(after,/new-generation/)
   if(variant==='retry-same-ended-turn'){
    assert.match(after,/NEW_RUNNING_CONTEXT/);assert.doesNotMatch(after,/MAINTENANCE_ONLY/)
    assert.ok(!receipt.sourceEventSeqs.includes(freshInstruction),'adjacent retry phase in the same ended turn is excluded from old receipt')
   }
  }else{assert.ok(after.length<before.length-100000,'prompt loses the large settled payload');assert.doesNotMatch(after,/MAINTENANCE_ONLY/)}
  if(variant==='failed'){
   const summary=JSON.stringify(receipt.data)
   assert.ok(summary.length<4000);assert.doesNotMatch(summary,/STACK_PRIVATE|MAINTENANCE_ONLY/)
   assert.match(summary,/decision/);assert.match(summary,/failed/);assert.match(summary,/rp_task_read\(id\)/);assert.match(summary,/重试/)
   assert.ok(receipt.data.source.attempts.some(a=>a.id==='decision'&&a.failure==='任务超时'),'safe failure category retained')
  }
  if(variant==='cancel-generation'){
   assert.ok(receipt.data.source.attempts.some(a=>a.id==='decision'&&a.generation==='generation'&&a.state==='cancelled'),'generation change must not relabel cancellation as superseded')
   assert.ok(!receipt.data.source.attempts.some(a=>a.id==='decision'&&a.state==='superseded'))
  }
  if(variant==='stale'){
   const summary=JSON.stringify(receipt.data)
   assert.match(summary,/decision/);assert.match(summary,/来源已变化/);assert.match(summary,/按当前来源重新发起/)
   assert.match(summary,/不能重交旧快照/);assert.match(summary,/rp_task_read\(id\)/)
  }
  if(variant==='error-then-success')assert.doesNotMatch(after,/INITIAL_VALIDATION_ERROR/,'corrected validation failure no longer pins the batch')
  assert.equal(context.retireSettledInlineContexts(s,3,jobs),0,'receipt idempotent; new running context remains pending');assert.equal(JSON.stringify(s.deriveMessages()),after)
 }else assert.equal(after,before,variant+': uncertain/pending/current evidence stays exact')
}

for(const variant of ['used','just-returned','same-turn','body-not-completed','no-proof','proof-before-read','missing-result','novel-read']){
 const s=create('read-retire-'+variant),add=(type:string,data:unknown,visible=true)=>s.append(type,data,visible?{surfaceOp:'append'}:undefined)
 const story=()=>add('assistant/message',{turn:1,step:3,message:{id:'body',role:'assistant',source:model,content:[{type:'text',text:'The key from the earlier clue opens the door.'}]}})
 const prove=(body:TaskEvent)=>add('user/message',context.taskPhaseMessage('after-story','Story committed.',{storySeq:body.seq,turn:1}))
 add('turn/start',{turn:1},false)
 const player=add('user/message',{id:'player',role:'user',source:{kind:'user'},content:[{type:'text',text:'Use the earlier clue.'}]})
 let body:TaskEvent|undefined
 if(variant==='proof-before-read'){body=story();prove(body)}
 const tools=variant==='novel-read'?['rp_source_read']:['rp_history','rp_worldbook_list','rp_worldbook_search']
 const calls=add('assistant/message',{turn:1,step:2,message:{id:'reads',role:'assistant',source:model,content:tools.map((name,i)=>({type:'tool-call',id:'read-'+i,name,arguments:'{}'}))}})
 for(const [i,name] of tools.entries()){
  add('tool/call',{turn:1,step:2,callId:'read-'+i,name,arguments:'{}'},false)
  if(variant==='missing-result'&&i===tools.length-1)continue
  const result=toolResult('read-'+i);result.message.content[0]!.content[0]!.text='READ_EVIDENCE_ONLY '.repeat(2500);add('tool/result',result)
 }
 if(!['just-returned','proof-before-read'].includes(variant)){body=story();if(variant!=='no-proof')prove(body)}
 if(variant!=='just-returned')add('turn/end',{turn:1,reason:{kind:variant==='body-not-completed'?'failed':'completed'}},false)
 const raw=JSON.stringify(s.events),before=JSON.stringify(s.deriveMessages()),count=s.events.length
 const retired=context.retireUsedStoryReads(s,variant==='same-turn'?1:2),after=JSON.stringify(s.deriveMessages())
 assert.equal(retired>0,variant==='used',variant);assert.equal(JSON.stringify(s.events.slice(0,count)),raw,variant+': append-only read audit')
 assert.ok(s.surface.nodes.includes(player.seq));if(body)assert.ok(s.surface.nodes.includes(body.seq),'story preserved')
 if(variant==='used'){
  assert.ok(!s.surface.nodes.includes(calls.seq));assert.doesNotMatch(after,/READ_EVIDENCE_ONLY/);assert.ok(after.length<before.length-100000)
  const receipt=s.events.at(-1)
  assert.equal(receipt.data.source.form,'read-evidence-receipt');assert.equal(receipt.data.source.schemaVersion,1)
  assert.equal(receipt.data.source.bodySeq,body!.seq);assert.deepEqual(receipt.data.source.tools,tools);assert.ok(receipt.sourceEventSeqs.includes(calls.seq))
  assert.equal(context.retireUsedStoryReads(s,3),0);assert.equal(JSON.stringify(s.deriveMessages()),after)
 }else assert.equal(after,before,variant+': read evidence remains until later committed/completed story proof')
}
for(const variant of ['shared','resident','suffix-garbage','suffix-shape','pending','failed']){
 const s=create('compact-retire-'+variant),add=(type:string,data:unknown,visible=true)=>s.append(type,data,visible?{surfaceOp:'append'}:undefined)
 const common='SHARED_MAINTENANCE_MATERIAL '.repeat(200),resident='CURRENT_STORY '.repeat(100)
 add('turn/start',{turn:1},false)
 const body=add('assistant/message',{turn:1,step:1,message:{id:'body',role:'assistant',source:model,content:[{type:'text',text:resident}]}})
 add('user/message',context.taskPhaseMessage('after-story','Committed.',{storySeq:body.seq,turn:1}))
 const jobs:InlineContextJob[]=['status','decision'].map(kind=>{
  const {user,promptContext}=context.maintenancePrompt({material:variant==='resident'?resident:common,note:'quoted bracket ] and escaped newline\n资料引用：not a suffix'},kind+'\n','\nReturn JSON')
  return {id:kind,sessionId:s.id,kind,execution:'inline',status:'running',generation:'g',sourceHash:'h',input:{user,system:kind},promptContext}
 })
 let instruction=context.inlineTaskInstruction(jobs,{resident:[{name:'current-story',text:resident}]})
 assert.match(instruction,/资料引用：/,'exercise actual compact writer with its shared-context suffix')
 if(variant==='suffix-garbage')instruction+=' INVALID_TRAILING_BYTES'
 if(variant==='suffix-shape')instruction=instruction.slice(0,instruction.lastIndexOf('\n')+1)+'{"not":"a shared array"}'
 const phase=add('user/message',context.taskPhaseMessage('after-story',instruction))
 add('assistant/message',{turn:1,step:2,message:{id:'submit',role:'assistant',source:model,content:jobs.map(j=>({type:'tool-call',id:j.id,name:'rp_task_submit',arguments:'{}'}))}})
 for(const job of jobs)add('tool/result',toolResult(job.id))
 add('turn/end',{turn:1,reason:{kind:'completed'}},false)
 jobs.forEach(j=>j.status='completed');if(variant==='pending')jobs[1]!.status='running';if(variant==='failed')jobs[1]!.status='failed'
 const before=JSON.stringify(s.events),count=s.events.length,requestBefore=JSON.stringify(s.deriveMessages())
 const retired=context.retireSettledInlineContexts(s,2,jobs),requestAfter=JSON.stringify(s.deriveMessages())
 const expected=['shared','resident','failed'].includes(variant)
 assert.equal(retired>0,expected,'compact '+variant)
 assert.equal(JSON.stringify(s.events.slice(0,count)),before,'original audit bytes preserved')
 if(expected){assert.ok(!s.surface.nodes.includes(phase.seq));assert.doesNotMatch(requestAfter,/SHARED_MAINTENANCE_MATERIAL|资料引用：/);assert.ok(s.surface.nodes.includes(body.seq));assert.ok(requestAfter.length<requestBefore.length);assert.equal(context.retireSettledInlineContexts(s,3,jobs),0)}
 else assert.equal(requestAfter,requestBefore,'malformed or pending compact inputs remain exact')
}
console.log('inline maintenance retirement: '+(native?'native':'fixture')+' terminal/retry/failure receipts, compact suffixes, source pairing and completed-story read retention PASS')
