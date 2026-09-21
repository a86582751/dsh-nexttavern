import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import { retireCompletedTaskContexts, internalTaskSeqs, taskStorySeqs, inlineTaskInstruction } from '../lib/core/tavern-tasks.js'
import { selectedStoryHistory } from '../lib/memory/roleplay-memory-engine.js'
{
 const legacy=JSON.parse(readFileSync(new URL('./fixtures/task-context-legacy-v1.json',import.meta.url),'utf8'))
 assert.equal(inlineTaskInstruction(legacy.jobs),legacy.instruction,'frozen task prompt bytes stay compatible')
 for(const scenario of legacy.scenarios) {
   const session=structuredClone(scenario.input),raw=JSON.stringify(session.events),receipts=[]
   session.append=(type,data,options)=>{const {id,...stableData}=data;receipts.push({type,data:stableData,options})}
   assert.deepEqual([...taskStorySeqs(session)],scenario.storySeqs)
   assert.deepEqual([...internalTaskSeqs(session)],scenario.internalSeqs)
   assert.equal(retireCompletedTaskContexts(session,scenario.currentTurn),scenario.retired)
   assert.deepEqual(receipts,scenario.receipts,'legacy receipt provenance, spans and hashes remain identical')
   assert.equal(JSON.stringify(session.events),raw)
 }
 let reads=0
 const source=legacy.scenarios[0].input
 const stable={id:source.id,get events(){reads++;return source.events}}
 assert.deepEqual([...internalTaskSeqs(stable)],legacy.scenarios[0].internalSeqs)
 assert.equal(reads,1,'classification shares one history snapshot across both passes')
}
const s={id:'selected',events:[],surface:{nodes:[]}}
s.append=(type,data,options={})=>{
 const e={seq:s.events.length,type,data:structuredClone(data),...options};s.events.push(e)
 if(options.surfaceOp==='append')s.surface.nodes.push(e.seq)
 if(options.surfaceOp?.op==='replace'){
  assert.equal(options.surfaceOp.start,options.surfaceOp.end)
  const i=s.surface.nodes.indexOf(options.surfaceOp.start);assert.ok(i>=0);s.surface.nodes.splice(i,1,e.seq)
 }
 return e
}
const add=(type,data,visible=true)=>s.append(type,data,visible?{surfaceOp:'append'}:{})
const phase=(stage,extras={})=>add('user/message',{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage,...extras},content:[{type:'text',text:'full maintenance source'}]})
add('turn/start',{turn:1},false)
const input=add('user/message',{id:'u',source:{kind:'user'},content:[{type:'text',text:'my action'}]})
phase('prepare')
const call=add('assistant/message',{turn:1,message:{id:'tool-msg',content:[{type:'tool-call',id:'call',name:'rp_task_submit',arguments:{result:'LARGE_RESULT'}}]}})
add('tool/call',{turn:1,name:'rp_task_submit',id:'call'},false)
const result=add('tool/result',{turn:1,step:1,message:{role:'tool',source:{kind:'tool',callId:'call'},content:[{type:'text',text:'LARGE_RESULT'}]}})
phase('story')
const body=add('assistant/message',{turn:1,message:{id:'body',content:[{type:'text',text:'story prose'}]}})
const proof=phase('after-story',{turn:1,storySeq:body.seq})
phase('after-story')
add('assistant/message',{turn:1,message:{id:'internal',content:[{type:'text',text:'maintenance report'}]}})
add('turn/end',{turn:1,reason:{kind:'completed'}},false)
add('turn/start',{turn:2},false);phase('prepare')
const failed=add('assistant/message',{turn:2,message:{content:[{type:'text',text:'failure checkpoint'}]}})
add('turn/end',{turn:2,reason:{kind:'error'}},false)
add('turn/start',{turn:3},false);const current=phase('prepare')
const before=structuredClone(s.events),storyBefore=selectedStoryHistory(s)
const surfaceBefore=[...s.surface.nodes]
assert.equal(retireCompletedTaskContexts(s,3),0)
assert.deepEqual(s.surface.nodes,surfaceBefore,'next-turn preparation preserves the complete cached message prefix')
assert.deepEqual(s.events.slice(0,before.length),before,'raw session audit remains append-only')
assert.ok(s.surface.nodes.includes(input.seq)&&s.surface.nodes.includes(body.seq)&&s.surface.nodes.includes(proof.seq))
assert.ok(s.surface.nodes.includes(failed.seq)&&s.surface.nodes.includes(current.seq),'failed/current task checkpoints stay available')
assert.ok(s.surface.nodes.includes(call.seq)&&s.surface.nodes.includes(result.seq),'native tool call and result stay byte-identical until window eviction')
assert.ok(internalTaskSeqs(s).has(call.seq)&&!internalTaskSeqs(s).has(body.seq),'source provenance still separates maintenance from narrative')
assert.doesNotMatch(JSON.stringify(selectedStoryHistory(s)),/LARGE_RESULT|maintenance report/,'retaining model context does not publish maintenance as story')
assert.deepEqual(selectedStoryHistory(s),storyBefore,'director notes, recall and exports retain identical selected story evidence')
assert.equal(retireCompletedTaskContexts(s,3),0,'retirement is idempotent')
for(const e of s.events.slice(before.length)){assert.equal(e.data.source.schemaVersion,1);assert.match(e.data.source.sourceSha256,/^[a-f0-9]{64}$/)}
for(const scenario of [
 {name:'multiple',ids:['a','b'],results:['a','b'],retire:true},
 {name:'missing',ids:['a','b'],results:['a'],retire:false},
 {name:'duplicate-result',ids:['a'],results:['a','a'],retire:false},
 {name:'duplicate-call',ids:['a','a'],results:['a'],retire:false},
 {name:'cross-phase',ids:['a'],results:['a'],resultPhase:'story',retire:false},
 {name:'reverse-phase',ids:['a'],results:['a'],callPhase:'story',resultPhase:'after-story',retire:false},
 {name:'current-result',ids:['a'],results:['a'],currentResult:true,retire:false},
]){
 const t={id:scenario.name,events:[],surface:{nodes:[]},append(type,data,options={}){
  const e={seq:this.events.length,type,data,...options};this.events.push(e)
  if(options.surfaceOp==='append')this.surface.nodes.push(e.seq)
  if(options.surfaceOp?.op==='replace')this.surface.nodes.splice(this.surface.nodes.indexOf(options.surfaceOp.start),1,e.seq)
  return e
 }}
 const put=(type,data,visible=true)=>t.append(type,data,visible?{surfaceOp:'append'}:{})
 const mark=stage=>put('user/message',{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage},content:[]})
 put('turn/start',{turn:1},false);mark(scenario.callPhase??'prepare')
 const a=put('assistant/message',{turn:1,message:{role:'assistant',content:scenario.ids.map(id=>({type:'tool-call',id,name:'rp_task_submit',arguments:'{}'}))}})
 if(scenario.resultPhase)mark(scenario.resultPhase)
 if(scenario.currentResult){put('turn/end',{turn:1,reason:{kind:'completed'}},false);put('turn/start',{turn:2},false);mark('prepare')}
 const rs=scenario.results.map(callId=>put('tool/result',{message:{role:'tool',source:{kind:'tool',callId},content:[]}}))
 if(!scenario.currentResult){put('turn/end',{turn:1,reason:{kind:'completed'}},false);put('turn/start',{turn:2},false)}
 retireCompletedTaskContexts(t,2)
 assert.ok(t.surface.nodes.includes(a.seq),scenario.name+' call stays in its original context')
 for(const r of rs)assert.ok(t.surface.nodes.includes(r.seq),scenario.name+' result cannot be orphaned')
}
// Pure completed exports must not occupy every subsequent story request.
for(const variant of ['export','mixed-story','failed','unfinished','other-branch']) {
 const t={id:variant,events:[],surface:{nodes:[]},append(type,data,options={}){
  const e={seq:this.events.length,type,data:structuredClone(data),...options};this.events.push(e)
  if(options.surfaceOp==='append')this.surface.nodes.push(e.seq)
  if(options.surfaceOp?.op==='replace'){
   const a=this.surface.nodes.indexOf(options.surfaceOp.start),b=this.surface.nodes.indexOf(options.surfaceOp.end)
   assert.ok(a>=0&&b>=a);this.surface.nodes.splice(a,b-a+1,e.seq)
  }return e
 }}
 const put=(type,data,visible=true)=>t.append(type,data,visible?{surfaceOp:'append'}:{})
 put('turn/start',{turn:1},false)
 const story=put('assistant/message',{turn:1,message:{content:[{type:'text',text:'PRESERVE STORY'}]}})
 put('turn/end',{turn:1,reason:{kind:'completed'}},false)
 put('turn/start',{turn:2},false)
 const phase=put('user/message',{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'management',jobKind:'card-export'},content:[{type:'text',text:'EXPORT SOURCE'.repeat(1000)}]})
 put('assistant/message',{turn:2,message:{content:[{type:'tool-call',id:'export-call',name:'rp_card_export_begin',arguments:'{}'}]}})
 put('tool/result',{turn:2,message:{role:'tool',source:{callId:'export-call'},content:[{type:'text',text:'EXPORT RAW'.repeat(1000)}]}})
 if(variant==='mixed-story')put('user/message',{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'after-story',storySeq:story.seq},content:[]})
 if(variant!=='unfinished')put('turn/end',{turn:2,reason:{kind:variant==='failed'?'error':'completed'}},false)
 if(variant==='other-branch')t.surface.nodes=t.surface.nodes.filter(seq=>seq<phase.seq)
 const before=JSON.stringify(t.events),count=t.events.length,surface=[...t.surface.nodes]
 const retired=retireCompletedTaskContexts(t,3)
 assert.equal(retired>0,variant==='export',variant)
 assert.equal(JSON.stringify(t.events.slice(0,count)),before,'audit remains exact')
 assert.ok(t.surface.nodes.includes(story.seq),'story never removed')
 if(variant==='export'){
  assert.ok(!t.surface.nodes.includes(phase.seq));assert.doesNotMatch(JSON.stringify(t.surface.nodes.map(seq=>t.events[seq])),/EXPORT SOURCE|EXPORT RAW/)
  const receipt=t.events.at(-1);assert.equal(receipt.data.source.form,'management-receipt');assert.equal(receipt.data.source.schemaVersion,1)
  assert.deepEqual(receipt.sourceEventSeqs,surface.filter(seq=>seq>=phase.seq))
  assert.equal(retireCompletedTaskContexts(t,4),0,'ordinary continuations do not rewrite cache prefix again')
 }else assert.deepEqual(t.surface.nodes,surface)
}
console.log('task context retirement: PASS')
// A verified import prelude can retire without touching the opening in its turn.
for(const variant of ['active','failed-import','failed-turn','current','foreign-anchor','unpaired','story-before-finalize','other-branch']){
 const t={id:variant,events:[],surface:{nodes:[]},append(type,data,options={}){
  const e={seq:this.events.length,type,data:structuredClone(data),...options};this.events.push(e)
  if(options.surfaceOp==='append')this.surface.nodes.push(e.seq)
  if(options.surfaceOp?.op==='replace'){const a=this.surface.nodes.indexOf(options.surfaceOp.start),b=this.surface.nodes.indexOf(options.surfaceOp.end);assert.ok(a>=0&&b>=a);this.surface.nodes.splice(a,b-a+1,e.seq)}return e
 }}
 const put=(type,data,visible=true)=>t.append(type,data,visible?{surfaceOp:'append'}:{})
 put('turn/start',{turn:1},false)
 const notes=put('user/message',{source:{kind:'plugin',plugin:'roleplay-context',form:'director-notes'},content:[]})
 const player=put('user/message',{source:{kind:'user'},content:[{type:'text',text:'import this card'}]})
 const begin=put('assistant/message',{turn:1,message:{content:[{type:'tool-call',id:'begin',name:'rp_card_import_begin',arguments:'{}'}]}})
 put('tool/result',{message:{source:{callId:'begin'},content:[{type:'text',text:'IMPORT MATERIAL'.repeat(1000)}]}})
 if(variant==='foreign-anchor')put('user/message',{source:{kind:'plugin',plugin:'roleplay-context',form:'state'},content:[]})
 if(variant==='story-before-finalize')put('user/message',{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'story'},content:[]})
 put('assistant/message',{turn:1,message:{content:[{type:'tool-call',id:'final',name:'rp_card_import_finalize',arguments:'{}'}]}})
 if(variant!=='unpaired')put('tool/result',{message:{source:{callId:'final'},content:[{type:'tool-result',toolCallId:'final',content:[{type:'text',text:JSON.stringify({ok:variant!=='failed-import',status:true,activatedAt:1000,normalizedSha256:'a'.repeat(64),importId:'card',coverage:1})}]}]}})
 const storyPhase=put('user/message',{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'story'},content:[]})
 const opening=put('assistant/message',{turn:1,message:{content:[{type:'text',text:'AUTHOR ORIGINAL OPENING'}]}})
 put('user/message',{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'after-story',storySeq:opening.seq},content:[]})
 put('turn/end',{turn:1,reason:{kind:variant==='failed-turn'?'error':'completed'}},false)
 if(variant==='other-branch')t.surface.nodes=t.surface.nodes.filter(seq=>seq<begin.seq||seq>=storyPhase.seq)
 const raw=JSON.stringify(t.events),count=t.events.length,before=[...t.surface.nodes]
 assert.equal(retireCompletedTaskContexts(t,variant==='current'?1:2)>0,variant==='active',variant)
 assert.equal(JSON.stringify(t.events.slice(0,count)),raw)
 assert.ok([notes,player,storyPhase,opening].every(e=>t.surface.nodes.includes(e.seq)))
 if(variant==='active'){assert.ok(!t.surface.nodes.includes(begin.seq));assert.equal(t.events.at(-1).data.source.jobKind,'card-import');assert.equal(retireCompletedTaskContexts(t,3),0)}
 else assert.deepEqual(t.surface.nodes,before)
}
