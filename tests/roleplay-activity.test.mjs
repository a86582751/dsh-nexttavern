import assert from 'node:assert/strict'
import {readRoleplayActivity} from '../preset/lib/roleplay-core.js'
import {fetchRoleplayText, startActivityPolling, backgroundNotesPresentation} from '../src/client.js'
{
 const a={sessionId:'a',observedAt:10000,backgroundJobs:[{kind:'memory',status:'running',createdAt:2000}]}
 assert.equal(backgroundNotesPresentation(a,'a',12000).seconds,10)
 assert.match(backgroundNotesPresentation(a,'a',12000).label,/整理笔记/)
 assert.equal(backgroundNotesPresentation(a,'b',12000),null,'banner never borrows another worldline')
 assert.equal(backgroundNotesPresentation({...a,backgroundJobs:[]},'a'),null,'completed background work removes the banner')
 assert.equal(backgroundNotesPresentation({...a,backgroundJobs:[{kind:'status',status:'running'}]},'a'),null)
 assert.equal(backgroundNotesPresentation(a,'a',30000).stale,true,'stale polling must not assert normal ongoing work')
 assert.equal(backgroundNotesPresentation(a,'a',30000).seconds,8)
}
{
 let eligible=false,tick,reads=0,received=0
 const stop=startActivityPolling({eligible:()=>eligible,read:async()=>{reads++;return 1},receive:()=>received++,schedule:fn=>{tick=fn;return 1},cancel:()=>{}})
 await tick();assert.equal(reads,0)
 eligible=true
 await tick();assert.equal(reads,1,'late-arriving native session metadata starts polling without changing session id')
 assert.equal(received,1)
 stop();await tick();assert.equal(reads,1,'unmounted views stop polling')
}
{
 const saved=globalThis.fetch;let signal
 try {
  globalThis.fetch=async(_url,options)=>{signal=options.signal;return {text:()=>new Promise(()=>{})}}
  await assert.rejects(fetchRoleplayText('/stalled-body',10),/超时/)
  assert.equal(signal.aborted,true,'timeout cancels the response body as well as headers')
  globalThis.fetch=async()=>({ok:true,status:200,text:async()=>'{"ok":true}'})
  assert.equal((await fetchRoleplayText('/retry',100)).raw,'{"ok":true}','a subsequent poll can recover')
 }finally{globalThis.fetch=saved}
}
{
 let tick,finish,reads=0,cancelled
 const received=[]
 const stop=startActivityPolling({eligible:()=>true,
  read:()=>{reads++;if(reads===1)throw Error('transient');return new Promise(resolve=>{finish=resolve})},
  receive:value=>received.push(value),schedule:fn=>{tick=fn;return 42},cancel:timer=>{cancelled=timer}})
 const pending=tick()
 await tick()
 assert.equal(reads,2,'failed reads release busy; pending retries do not overlap')
 stop();finish('late');await pending
 assert.equal(cancelled,42)
 assert.deepEqual(received,[],'unmounted polling cannot publish a late response')
 await tick();assert.equal(reads,2)
}
const player={id:'player',role:'user',source:{kind:'user'},content:[{type:'text',text:'走进庭院'}]}
const session={id:'a',events:[{seq:0,type:'turn/start',time:1000,data:{turn:1}}],surface:{nodes:[]}}
const preparation={sessionId:'a',turn:1,status:'preparing',createdAt:1000,messages:[player]}
let state=readRoleplayActivity(session,preparation,[],2000)
assert.equal(state.stage,'prepare');assert.equal(state.elapsedMs,1000);assert.equal(state.pendingPlayer.text,'走进庭院')
assert.equal(session.events.length,1,'UI echo must not append player text to model memory before preparation')
assert.equal(readRoleplayActivity({...session,id:'b'},preparation,[],2000).pendingPlayer,null)
session.events.push({seq:1,type:'user/message',surfaceOp:'append',time:2100,data:player});session.surface.nodes.push(1)
assert.equal(readRoleplayActivity(session,preparation,[],2200).pendingPlayer,null,'native player node replaces the UI echo')
session.events.push({seq:2,type:'user/message',time:2300,data:{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'story'}}})
assert.equal(readRoleplayActivity(session,{...preparation,status:'completed'},[],2400).stage,'story')
session.events.push({seq:3,type:'user/message',time:2500,data:{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'after-story'}}})
assert.equal(readRoleplayActivity(session,{...preparation,status:'completed'},[{sessionId:'a',kind:'memory',status:'queued',createdAt:2500}],2600).stage,'memory')
session.events.push({seq:4,type:'turn/end',time:3000,data:{turn:1,reason:{kind:'completed'}}})
assert.equal(readRoleplayActivity(session,{...preparation,status:'completed'},[],4000).running,false)
assert.equal(readRoleplayActivity(session,{...preparation,status:'completed'},[],4000).elapsedMs,2000)
const background={sessionId:'a',kind:'memory',execution:'spawn',background:true,status:'running',createdAt:3100}
state=readRoleplayActivity(session,null,[background],9000)
assert.equal(state.running,false,'quiet notes must not reopen a completed foreground turn')
assert.equal(state.stage,'done')
assert.equal(state.elapsedMs,2000,'foreground elapsed time stops at native turn/end')
assert.equal(state.backgroundJobs.length,1,'background work stays observable separately')
assert.equal(state.jobs.length,0)
assert.equal(readRoleplayActivity(session,null,[{...background,status:'queued'}],9000).stage,'done','queued background notes do not pause the player')
const next={...session,events:[...session.events,{seq:5,type:'turn/start',time:5000,data:{turn:2}},{seq:6,type:'user/message',data:{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'story'}}}]}
state=readRoleplayActivity(next,null,[background,{...background,sessionId:'other'}],6000)
assert.equal(state.stage,'story')
assert.equal(state.backgroundJobs.length,1,'prior-turn notes remain visible without leaking another session')
assert.equal(readRoleplayActivity(session,null,[{...background,background:false}],9000).running,true,'foreground spawned work still counts as waiting')
const streaming={id:'stream',surface:{nodes:[]},events:[
 {seq:0,type:'turn/start',time:100,data:{turn:3}},
 {seq:1,type:'step/start',data:{turn:3,step:4}},
 {seq:2,type:'user/message',data:{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'story'}}},
]}
state=readRoleplayActivity(streaming,null,[],200)
assert.equal(state.storyStep,4,'step/start precedes pre-step story admission')
assert.equal(state.phaseSeq,2)
assert.equal(readRoleplayActivity(streaming,{sessionId:'stream',turn:3,status:'preparing'},[],200).stage,'story','committed phase outranks stale preparation metadata')
streaming.events.push({seq:3,type:'user/message',data:{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'after-story'}}},{seq:4,type:'step/start',data:{turn:3,step:5}})
assert.equal(readRoleplayActivity(streaming,null,[],300).storyStep,null,'maintenance steps never receive a story streaming identity')
assert.equal(readRoleplayActivity({id:'none',events:[{seq:0,type:'turn/start',data:{turn:1}},{seq:1,type:'step/start',data:{step:1}}]},null).storyStep,null,'unproven default story label is insufficient for stream admission')
let oldReads=0
const old=Array.from({length:10000},(_,seq)=>({seq,get type(){oldReads++;return 'assistant/chunk'},data:{}}))
const longSession={id:'long',surface:{nodes:[]},events:[...old,{seq:10000,type:'turn/start',time:100,data:{turn:5}},{seq:10001,type:'step/start',data:{turn:5,step:1}}]}
readRoleplayActivity(longSession,null,[],200)
assert.equal(oldReads,0,'live activity must not rescan prior-turn chunk history')
readRoleplayActivity(longSession,{sessionId:'long',turn:5,status:'preparing',messages:[player]},[],200)
assert.equal(oldReads,0,'preparation echo must not scan old audit chunks either')
longSession.events.push({seq:10002,type:'turn/end',data:{turn:5,reason:{kind:'completed'}}})
readRoleplayActivity(longSession,null,[],200)
oldReads=0
readRoleplayActivity(longSession,null,[],300)
assert.equal(oldReads,0,'idle legacy fallback reuses its exact audit/surface projection')
{
  let chunkReads = 0
  const chunks = Array.from({ length: 20000 }, (_, index) => ({
    seq: index + 3, get type() { chunkReads++; return 'assistant/chunk' }, data: {},
  }))
  const current = { id: 'large-current', surface: { nodes: [] }, events: [
    { seq: 0, type: 'turn/start', time: 100, data: { turn: 2 } },
    { seq: 1, type: 'step/start', data: { turn: 2, step: 3 } },
    { seq: 2, type: 'user/message', data: { source: { plugin: 'roleplay-tasks', form: 'phase', stage: 'story' } } },
    ...chunks,
  ] }
  const activity = readRoleplayActivity(current, null, [], 200)
  assert.equal(activity.stage, 'story')
  assert.equal(activity.storyStep, 3)
  assert.equal(activity.phaseSeq, 2)
  assert.ok(chunkReads <= chunks.length * 2, 'activity polling must not repeatedly scan a large current-turn chunk tail')
  const storySeq = current.events.length
  current.events.push({ seq: storySeq, type: 'assistant/message', data: { turn: 2, message: { id: 'large-story', content: [{ type: 'text', text: 'finished story' }] } } })
  current.surface.nodes.push(storySeq)
  current.events.push({ seq: storySeq + 1, type: 'user/message', data: { source: { kind: 'plugin', plugin: 'roleplay-tasks', form: 'phase', stage: 'after-story', storySeq } } })
  assert.equal(readRoleplayActivity(current, null).storySeq, storySeq, 'latest durable story proof remains visible during maintenance')
  current.events.push({ seq: storySeq + 2, type: 'turn/start', data: { turn: 3 } })
  assert.equal(readRoleplayActivity(current, null).storySeq, null, 'a new turn never inherits the prior story proof')
}
console.log('roleplay-activity=ok (deferred user echo, native dedupe, branch isolation, truthful stage/elapsed)')
