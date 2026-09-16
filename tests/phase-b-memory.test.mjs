import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { createRoleplayCompletion } from '../src/core/roleplay-completion.js'
import { InlinePending } from '../src/core/tavern-tasks.js'

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
const flush=()=>new Promise(resolve=>setImmediate(resolve))
class Table extends Map {
  async put(key,value){this.set(key,structuredClone(value))}
  async update(key,work){await this.put(key,work(this.get(key)))}
}
function fixture({turns=1,background=false}={}) {
  const session={id:'completion-fixture',events:[],surface:{nodes:[]}},hooks=new Map(),workers=[],rebuilds=[],failed=[],status=[]
  const T={branch:new Table(),scene:new Table(),memory:new Table()}
  T.branch.set(`${session.id}__context-window`,{windowNumber:1,windowId:'window-1',startSeq:-1,throughSeq:-1,storyTokens:0})
  const st={snapshots:new Map(),snapshot:null,pendingTurn:null,pendingScenes:new Map(),pendingScene:null,phaseBStarted:new Set(),phaseBRetryTimers:new Map(),phaseBAttempts:new Map(),commitChain:Promise.resolve(),regenerateAnchor:null}
  const events=[]
  const append=(type,data)=>{const event={seq:session.events.length,type,data,surfaceOp:'append'};session.events.push(event);if(type==='user/message'||type==='assistant/message')session.surface.nodes.push(event.seq);return event}
  for(let turn=1;turn<=turns;turn++) {
    append('turn/start',{turn})
    append('user/message',{id:`u${turn}`,source:{kind:'user'},content:[{type:'text',text:`player-${turn}`}]})
    const event=append('assistant/message',{turn,message:{id:`a${turn}`,content:[{type:'text',text:`story-${turn}`}]}})
    append('turn/end',{turn,reason:{kind:'completed'}})
    events.push(event)
    const snapshot={branchId:session.id,turnId:turn,userText:`player-${turn}`,userMessageId:`u${turn}`}
    st.snapshots.set(turn,snapshot)
    st.snapshot=snapshot;st.pendingTurn=turn
  }
  let active=true
  const compaction={backgroundMemory:background,rebuildDirectorNotes({session:owner}){
    rebuilds.push({owner:owner.id,states:events.map(event=>T.branch.get(`${session.id}__phaseb-${event.data.turn}`)?.state)})
    return Promise.reject(new Error('fixture rebuild failed'))
  }}
  const deps={T,storyBranchIsActive:()=>active,cloneBranchRecord:structuredClone,reconcileNativeFork:async()=>{},
    ctx:{get:()=>compaction,sessions:{get:()=>session},logger:{warn(){}},on(name,handler){hooks.set(name,handler)}},
    resolveRoute:session=>({session}),memoryForContext:()=>T.memory.get(`${session.id}__head`),publishTurnDecision:async()=>{},
    llmJson(_ctx,_route,options){const gate=deferred();workers.push({options,...gate});return gate.promise},
    LEDGER_WORKER_SYSTEM:'ledger',CONTINUITY_WORKER_SYSTEM:'continuity',cfg:{},
    contextWindowKey:id=>`${id}__context-window`,contextWindowFor:()=>T.branch.get(`${session.id}__context-window`),
    svc:{recordVersion:async()=>{}},sessions:new Map([[session.id,st]]),failPendingNativeFork:async(_session,reason)=>failed.push(reason),
    isRoleplaySession:()=>true,queueStatusObligation:(_session,event)=>status.push(event.seq),statusRunStartSeq:new Map(),
    recoverStatusObligations:(_session,via)=>status.push(via)}
  const api=createRoleplayCompletion(deps)
  const run=(index=0,signal)=>api.runPhaseBC(session,events[index],st,st.snapshots.get(index+1),signal)
  const settle=(index=0,severity='low')=>{
    workers[index*2].resolve({deltas:[{summary:`delta-${index+1}`,evidenceSeq:events[index]?.seq??events[0].seq}]})
    workers[index*2+1].resolve({conflicts:[{claim:`claim-${index+1}`,severity}]})
  }
  return {session,T,st,events,workers,rebuilds,failed,status,hooks,deps,api,run,settle,deactivate:()=>{active=false}}
}

// Later workers can finish first, but their writes must wait for earlier turns.
{
  const h=fixture({turns:2}),first=h.run(0)
  await flush()
  const second=h.run(1)
  await flush()
  assert.equal(h.workers.length,4)
  h.settle(1)
  await flush()
  assert.equal(h.T.memory.size,0,'later completed workers wait for the previous commit')
  h.settle(0,'high')
  await Promise.all([first,second])
  assert.deepEqual(h.T.memory.get(`${h.session.id}__head`).deltas.map(d=>d.summary),['delta-1','delta-2'])
  assert.equal(h.T.branch.get(`${h.session.id}__meta`).lastTurn,2)
  assert.equal(h.T.branch.get(`${h.session.id}__context-window`).throughSeq,h.events[1].seq)
  assert.equal(h.T.branch.get(`${h.session.id}__context-window`).storyTokens,14,'window accounting includes both visible player/body pairs')
  for(const turn of [1,2])assert.equal(h.T.branch.get(`${h.session.id}__phaseb-${turn}`).state,'completed')
  assert.deepEqual(h.rebuilds,[{owner:h.session.id,states:['completed','running']}],'conflict rebuild starts only after its own durable commit')
  assert.equal(h.st.snapshots.size,0)
}

// Failure after writing memory retries from the same origin without duplicates.
{
  mock.timers.enable({apis:['setTimeout']})
  const h=fixture(),key=`${h.session.id}__phaseb-1`,put=h.T.branch.put.bind(h.T.branch)
  let fail=true
  h.T.branch.put=async(k,value)=>{if(k===key&&value.state==='completed'&&fail){fail=false;throw new Error('fixture commit failed')}return put(k,value)}
  try {
    const pending=h.run();await flush();h.settle();await pending
    assert.equal(h.T.branch.get(key).state,'retry')
    assert.equal(h.st.snapshots.size,1)
    assert.equal(h.st.phaseBAttempts.get(1),1)
    assert.equal(h.st.phaseBRetryTimers.size,1)
    mock.timers.tick(2000)
    await flush()
    assert.equal(h.workers.length,4)
    h.workers[2].resolve({deltas:[{summary:'must-not-duplicate'}]})
    h.workers[3].resolve({conflicts:[{claim:'must-not-duplicate'}]})
    await h.st.commitChain
    const memory=h.T.memory.get(`${h.session.id}__head`)
    assert.deepEqual(memory.deltas.map(d=>d.summary),['delta-1'])
    assert.deepEqual(memory.pendingConfirmations.map(d=>d.claim),['claim-1'])
    assert.equal(h.T.branch.get(key).state,'completed')
    assert.equal(h.st.snapshots.size,0)
    assert.equal(h.st.phaseBAttempts.size,0)
    assert.equal(h.st.phaseBRetryTimers.size,0)
  } finally {mock.timers.reset()}
}

// Inline admission preserves snapshots; re-entering completes the same turn.
{
  const h=fixture(),key=`${h.session.id}__phaseb-1`,pending=h.run()
  await flush()
  h.workers[0].reject(new InlinePending('ledger-job'))
  h.workers[1].resolve({conflicts:[]})
  await pending
  assert.equal(h.T.branch.get(key).state,'waiting-main')
  assert.equal(h.st.snapshots.size,1)
  assert.equal(h.st.phaseBRetryTimers.size,0)
  const retry=h.run();await flush()
  h.workers[2].resolve({deltas:[]});h.workers[3].resolve({conflicts:[]})
  await retry
  assert.equal(h.T.branch.get(key).state,'completed')
}

for(const failure of ['shadow-user','shadow-assistant','deleted','cancel']) {
  const h=fixture(),controller=new AbortController(),pending=h.run(0,controller.signal)
  await flush()
  if(failure==='shadow-user')h.session.surface.nodes=h.session.surface.nodes.filter(seq=>seq!==1)
  if(failure==='shadow-assistant')h.session.surface.nodes=h.session.surface.nodes.filter(seq=>seq!==2)
  if(failure==='deleted')h.deactivate()
  if(failure==='cancel') {
    controller.abort(new Error('fixture abort'))
    for(const worker of h.workers)worker.reject(controller.signal.reason)
  } else h.settle(0,'high')
  await pending
  assert.equal(h.T.memory.size,0,`${failure}: late result cannot write memory`)
  assert.equal(h.T.scene.size,0)
  assert.equal(h.T.branch.get(`${h.session.id}__meta`),undefined)
  assert.equal(h.T.branch.get(`${h.session.id}__context-window`).throughSeq,-1)
  assert.notEqual(h.T.branch.get(`${h.session.id}__phaseb-1`).state,'completed')
  assert.equal(h.st.snapshots.size,1)
  assert.equal(h.st.phaseBRetryTimers.size,0)
  assert.equal(h.rebuilds.length,0)
}

// Completion feeds deduplicate the running work, then the durable receipt.
{
  const h=fixture(),end=h.session.events.at(-1),onEvent=h.hooks.get('session/event')
  onEvent(h.session,{type:'assistant/content',seq:99,data:{}})
  assert.equal(h.status.length,0)
  onEvent(h.session,end);onEvent(h.session,end)
  await flush();assert.equal(h.workers.length,2)
  h.settle();await h.st.commitChain
  onEvent(h.session,end);await flush();assert.equal(h.workers.length,2)
  const status=h.hooks.get('agent/status')
  status({agent:{session:h.session},status:'running'})
  assert.equal(h.deps.statusRunStartSeq.get(h.session.id),h.session.events.length-1)
  status({agent:{session:h.session},status:'idle'})
  assert.ok(h.status.includes('agent/idle'))
  assert.equal(h.deps.statusRunStartSeq.size,0)
}
for(const missing of ['failed','canonical']) {
  const h=fixture(),end=h.session.events.at(-1)
  if(missing==='failed')end.data.reason.kind='error'
  else h.session.surface.nodes=h.session.surface.nodes.filter(seq=>seq!==2)
  h.hooks.get('session/event')(h.session,end)
  await flush()
  assert.equal(h.st.snapshots.size,0)
  assert.equal(h.workers.length,0)
  assert.equal(h.failed.length,1)
}
{
  const h=fixture({background:true})
  await h.run()
  assert.equal(h.workers.length,0)
  assert.equal(h.T.memory.size,0)
  assert.equal(h.T.branch.get(`${h.session.id}__phaseb-1`).memoryMode,'background-notes')
  assert.equal(h.rebuilds.length,0)
}
console.log('phase-b-memory=ok (serial commits, durable retry, inline recovery, stale fences, completion hooks)')
