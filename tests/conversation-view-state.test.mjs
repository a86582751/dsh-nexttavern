import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRoleplayActions } from '../lib/ui/session-actions.js'
import { resolveConversationExecution } from '../lib/ui/conversation-projection.js'
import { createConversationPresentation } from '../lib/ui/conversation-presentation.js'
const source=['../lib/ui/client.js','../lib/ui/conversation-presentation.js'].map(file=>fs.readFileSync(new URL(file,import.meta.url),'utf8')).join('\n')
const defaults={resolveActiveSessionId:()=>null,isRoleplaySession:()=>false,
  wakeSessionForState:async()=>true,invalidateState:()=>{},acceptConversations:()=>{},loadConversations:async()=>{},toast:()=>{},
  sessionsService:{},wait:async()=>{}}
for(const target of [undefined,null,{view:'chat'},{draft:17,view:'chat'},{draft:'保留目标分支未发送草稿',view:'chat'}]){
  const saved=new Map([['dsh.conversation.source',JSON.stringify({draft:'不要复制源草稿',view:'roleplay-reader',viewRequest:{view:'chat'}})]])
  if(target!==undefined)saved.set('dsh.conversation.target',JSON.stringify(target))
  let opened=false
  const actions=createRoleplayActions({...defaults,
    storage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)},
    resolveActiveSessionId:()=> 'target', isRoleplaySession:()=>true,
    fetch:async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.action,'select-worldline');assert.equal(body.sessionId,'target');return {ok:true,text:async()=>'{"ok":true}'}},
    acceptConversations:()=>{},
    sessionsService:{open(id){
      const value=JSON.parse(saved.get(`dsh.conversation.${id}`))
      // Native alpha.3 SessionInputShell.setDraft calls text.replace directly.
      assert.equal(typeof value.draft,'string','view transfer must initialize the native conversation draft before opening a fresh branch')
      value.draft.replace(/placeholder/g,'')
      opened=true
    }},
  })
  await actions.openSessionPreservingView('target','source')
  assert.ok(opened)
  const value=JSON.parse(saved.get('dsh.conversation.target'))
  assert.equal(value.draft,typeof target?.draft==='string'?target.draft:'')
  assert.equal(value.view,'roleplay-reader')
  assert.equal(value.viewRequest,null)
}
console.log('conversation-view-state=ok (new/partial store, target draft preserved, source draft excluded)')

// Bootstrap can run before the session catalog knows the active id. The
// incomplete records previously written by view transfer still need repair.
{
  const saved=new Map([['dsh.conversation.target',JSON.stringify({view:'roleplay-reader',viewRequest:null})]])
  createRoleplayActions({...defaults,
    storage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),
      get length(){return saved.size},key:index=>[...saved.keys()][index]},
    resolveActiveSessionId:()=>null,isRoleplaySession:()=>false,sessionsService:{},
  })
  assert.equal(JSON.parse(saved.get('dsh.conversation.target')).draft,'','startup repair must not depend on an already loaded active-session catalog')
}

// Draft/view remain local to the browser, but a refreshed worldline always
// follows the server's durable active selection rather than tab storage.
{
  const catalog = { schemaVersion:1, worldlines:{oldTab:{conversationId:'root',status:'ready'},serverCurrent:{conversationId:'root',status:'ready'}}, conversations:{root:{activeSessionId:'serverCurrent'}} }
  const staleSessionStorage = { activeSessionIdByConversation:{root:'oldTab'} }
  assert.equal(resolveConversationExecution('root',catalog,staleSessionStorage),'serverCurrent','refresh ignores a stale tab-private worldline choice')
  assert.doesNotMatch(source,/sessionStorage|dsh\.tavern\.worldline-selection/,'worldline selection is not persisted in browser storage')
  assert.match(source,/browserProps\.open\(active\)/,'catalog readiness reconciles a stale native current session to the server selection')
}

function actionHarness(handler, options={}) {
  const calls=[],events=[],waits=[]
  let time=1000
  const binding={session:{getSnapshot:()=>({running:!!options.running}),
    projections:{faceOf:()=>({getSnapshot:()=>({selected:{provider:'p',model:'m',reasoningEffort:'high'}})})},
    beginSubmission:body=>{events.push(['begin',body]);return {requestId:'request',abandon:()=>events.push(['abandon'])}},
    prompt:async(...args)=>{events.push(['prompt',...args]);return options.prompt?options.prompt():{ok:true,value:{}}}}}
  const controller=createRoleplayActions({...defaults,
    resolveActiveSessionId:()=> 'source',isRoleplaySession:()=>true,
    now:()=>time,wait:async ms=>{waits.push(ms);time+=ms},
    storage:{length:0,key:()=>null,getItem:()=>null,setItem:()=>{}},
    sessionsService:{binding:()=>binding,refresh:async()=>events.push(['refresh']),open:id=>events.push(['open',id])},
    remoteSession:{selectModel:async data=>{events.push(['model',data]);return {ok:true,value:{}}}},
    wakeSessionForState:async id=>{events.push(['wake',id]);return true},
    invalidateState:id=>events.push(['invalidate',id]),loadConversations:async()=>events.push(['catalog']),
    acceptConversations:data=>events.push(['accept',data]),
    fetch:async(url,init)=>{
      const body=JSON.parse(init.body);calls.push(body)
      const result=await handler(body,calls,url)
      if(result instanceof Error)throw result
      const status=result?.http??200
      const raw=result?.raw??JSON.stringify(result??{ok:true})
      return {ok:status>=200&&status<300,status,text:async()=>raw,json:async()=>JSON.parse(raw)}
    }})
  return {controller,calls,events,waits}
}
const registration={operationId:'operation',childSessionId:'child',requestId:'request',promptText:'story'}
{
  const h=actionHarness((body,calls)=>calls.length===1?{http:404,raw:'Not mounted'}:{ok:true})
  await h.controller.branchRequest({action:'register',...registration})
  assert.equal(h.calls.length,2)
  assert.deepEqual(h.calls[0],h.calls[1],'route retry repeats the exact idempotent request')
  assert.deepEqual(h.waits,[220])
  assert.deepEqual(h.events,[['wake','child'],['wake','child']])
}
for(const status of [404,409]) {
  const h=actionHarness(()=>({http:status,ok:false,error:'durable failure'}))
  await assert.rejects(h.controller.registerBranchOperation(registration),error=>error.status===status&&error.payload.error==='durable failure')
  assert.equal(h.calls.length,1,'JSON business errors must not retry')
}
for(const recovered of [true,false]) {
  const h=actionHarness(body=>body.action==='register'?Error('lost response'):{ok:true,status:'pending',registered:recovered})
  if(recovered)assert.equal((await h.controller.registerBranchOperation(registration)).recovered,true)
  else await assert.rejects(h.controller.registerBranchOperation(registration),error=>error.operationStateUnknown===true)
  assert.equal(h.calls.filter(b=>b.action==='register').length,5)
  for(const body of h.calls.slice(0,5))assert.deepEqual(body,{action:'register',...registration})
  assert.equal(h.calls.at(-1).action,'operation-status')
}
{
  const h=actionHarness((body,calls)=>calls.length<3?Error('temporary'):({ok:true,status:'completed'}))
  assert.equal((await h.controller.waitForBranchOperation('operation')).status,'completed')
  assert.deepEqual(h.waits,[900,900])
  const grace=actionHarness(()=>({ok:true,status:'pending',registered:true,requestAccepted:false}))
  await assert.rejects(grace.controller.waitForBranchOperation('operation',10000,{requireRequestAdmission:true,admissionGraceMs:1800}),error=>error.safeToAbort===true)
  const unknown=actionHarness(()=>({ok:true,status:'pending'}))
  await assert.rejects(unknown.controller.waitForBranchOperation('operation',1800),error=>!error.safeToAbort&&/超时/.test(error.message))
}
function branchReply(body) {
  if(body.action==='prepare')return {ok:true,operationId:'operation',promptText:'original'}
  if(body.action==='create-worldline')return {ok:true,childSessionId:'child'}
  if(body.action==='operation-status')return {ok:true,status:'completed'}
  return {ok:true}
}
{
  const h=actionHarness(branchReply)
  assert.equal(await h.controller.forkAndPrompt({sourceSessionId:'source',messageId:'message',kind:'player-edit',editedText:' edited '}),'child')
  const register=h.calls.find(b=>b.action==='register')
  assert.deepEqual(register,{action:'register',...registration,promptText:'edited'})
  const prompt=h.events.find(e=>e[0]==='prompt')
  assert.deepEqual(prompt,['prompt',[{type:'text',text:'edited'}],'queue',undefined,'request'])
  assert.equal(h.calls.some(b=>b.action==='abort'),false)
  assert.equal(h.events.some(e=>e[0]==='abandon'),false)
  assert.deepEqual(h.events.filter(e=>e[0]==='open'),[['open','child']])
}
for(const response of ['lost','rejected']) {
  const h=actionHarness(branchReply,{prompt:async()=>{if(response==='lost')throw Error('transport');return {ok:false,error:{code:'DENIED',message:'rejected'}}}})
  if(response==='lost')assert.equal(await h.controller.forkAndPrompt({sourceSessionId:'source',kind:'regenerate'}),'child')
  else await assert.rejects(h.controller.forkAndPrompt({sourceSessionId:'source',kind:'regenerate'}),/DENIED/)
  assert.equal(h.calls.some(b=>b.action==='abort'),response==='rejected','transport loss alone cannot abort a committed prompt')
}
{
  let aborted=false
  const h=actionHarness(body=>{
    if(body.action==='operation-status')return aborted?{ok:true,status:'completed'}:{ok:true,status:'pending',registered:true,requestAccepted:false}
    if(body.action==='abort'){aborted=true;return {ok:true,alreadyAccepted:true}}
    return branchReply(body)
  },{prompt:async()=>{throw Error('transport')}})
  assert.equal(await h.controller.forkAndPrompt({sourceSessionId:'source',kind:'regenerate'}),'child')
  assert.equal(aborted,true)
  assert.equal(h.events.some(e=>e[0]==='abandon'),false,'acceptance racing with abort preserves the native submission')
}
{
  const h=actionHarness(body=>body.action==='register'?Error('offline'):body.action==='operation-status'?{ok:true,status:'pending',registered:false}:branchReply(body))
  await assert.rejects(h.controller.forkAndPrompt({sourceSessionId:'source',kind:'regenerate'}),error=>error.operationStateUnknown===true)
  assert.equal(h.calls.some(b=>b.action==='abort'),false,'unknown registration must preserve the worldline')
  assert.deepEqual(h.events.filter(e=>e[0]==='open'),[['open','source']])
}
{
  const h=actionHarness(branchReply)
  assert.equal(await h.controller.forkWithoutUserTurn({sourceSessionId:'source',messageId:'message'}),'child')
  assert.equal(h.events.some(e=>e[0]==='prompt'||e[0]==='begin'),false,'deleting a turn does not generate a new prompt')
  assert.equal(h.calls.find(b=>b.action==='register').promptText,'')
  const active=actionHarness(branchReply,{running:true})
  await assert.rejects(active.controller.forkAndPrompt({sourceSessionId:'source',kind:'regenerate'}),/当前一轮/)
  assert.equal(active.calls.some(b=>b.action==='create-worldline'),false)
}
for(const changed of [true,false]) {
  const h=actionHarness((body,calls)=>({ok:true,job:{id:changed&&calls.length>1?'other':'job',state:calls.length===1?'running':'completed'}}))
  if(changed)await assert.rejects(h.controller.runMaintenance('source','compact'),/状态已变化/)
  else assert.equal((await h.controller.runMaintenance('source','compact')).state,'completed')
  assert.equal(h.events.some(e=>e[0]==='invalidate'),!changed)
}
console.log('conversation-actions=ok (idempotent registration, admission recovery, abort race, draft transfer, maintenance)')

// Exercise the extracted catalog through the same factory used by apply.
// Timers are deterministic; no real browser, network or polling delay is needed.
{
  const originals = Object.fromEntries(['fetch','window','document','setTimeout','clearTimeout','setInterval','clearInterval'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const originalNow = Date.now
  const timers = new Map(), refs = [], effects = []
  let timerId = 0, now = 20000, fetches = 0, refIndex = 0, effectIndex = 0, snapshot, unsubscribe
  const surface = () => {
    const listeners = new Map()
    return {
      hidden: false, listeners,
      addEventListener(name, listener) { listeners.set(name, listener) },
      removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name) },
    }
  }
  const windowStub = surface(), documentStub = surface()
  const catalog = revision => ({ schemaVersion:1, ok:true, revision, worldlines:{}, conversations:{} })
  let native = { ids:['root'], current:null }
  const React = {
    useCallback: callback => callback,
    useSyncExternalStore(subscribe, getSnapshot) { snapshot = getSnapshot; unsubscribe ??= subscribe(() => {}); return getSnapshot() },
    useRef(value) { const index=refIndex++; return refs[index] ??= { current:value } },
    useEffect(setup, dependencies) {
      const index=effectIndex++, prior=effects[index]
      if (!prior || dependencies.some((value, i) => value !== prior.dependencies[i])) {
        prior?.cleanup?.()
        effects[index] = { dependencies, cleanup:setup() }
      }
    },
    createElement: (type, props, ...children) => ({ type, props, children }),
  }
  try {
    globalThis.window=windowStub; globalThis.document=documentStub
    globalThis.fetch=async () => { fetches++; return { ok:true, json:async()=>catalog(1) } }
    Date.now=()=>now
    globalThis.setTimeout=(run, delay)=>{ const id=++timerId; timers.set(id,{run,delay,interval:false}); return id }
    globalThis.setInterval=(run, delay)=>{ const id=++timerId; timers.set(id,{run,delay,interval:true}); return id }
    globalThis.clearTimeout=globalThis.clearInterval=id=>timers.delete(id)
    const presentation=createConversationPresentation({React,sessionsService:{list:{getSnapshot:()=>native}},toast:()=>{},errorMessage:String})
    await Promise.all([presentation.loadConversations(),presentation.loadConversations()])
    assert.equal(fetches,1,'concurrent catalog reads share the in-flight request')
    presentation.acceptConversations(catalog(4))
    const render=()=>{
      refIndex=0; effectIndex=0
      return presentation.TavernWorkspacePresentation({browserProps:{useSessions:select=>select(native),useWorkspaces:select=>select({}),open:()=>{},forkSession:()=>{},searchSessions:async()=>({})},renderDefault:props=>props})
    }
    const flush=()=>new Promise(resolve=>setImmediate(resolve))
    render(); await flush()
    assert.equal(snapshot().value.revision,4,'a late older response cannot replace a newer accepted catalog')
    const afterInitial=fetches
    for (let i=0;i<3;i++) { now+=100; native={...native,ids:[...native.ids,String(i)]}; render() }
    assert.equal(fetches,afterInitial)
    const trailing=[...timers.entries()].filter(([,timer])=>!timer.interval)
    assert.equal(trailing.length,1,'native list bursts leave exactly one trailing catalog read')
    now=30000; timers.delete(trailing[0][0]); trailing[0][1].run(); await flush()
    assert.equal(fetches,afterInitial+1)
    windowStub.listeners.get('focus')(); await flush()
    assert.equal(fetches,afterInitial+2,'focus reads immediately')
    documentStub.hidden=true; documentStub.listeners.get('visibilitychange')(); await flush()
    assert.equal(fetches,afterInitial+2,'hidden documents do not poll')
    documentStub.hidden=false; documentStub.listeners.get('visibilitychange')(); await flush()
    assert.equal(fetches,afterInitial+3,'becoming visible reads immediately')
    now+=100; native={...native,ids:[...native.ids,'cleanup']}; render()
    for (const effect of effects) effect.cleanup?.()
    unsubscribe()
    assert.equal(timers.size,0,'unmount clears both polling and trailing timers')
    assert.equal(windowStub.listeners.size,0)
    assert.equal(documentStub.listeners.size,0)
  } finally {
    for (const effect of effects) effect.cleanup?.()
    Date.now=originalNow
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor)
      else delete globalThis[key]
    }
  }
  console.log('conversation-catalog=ok (dedup, revision, trailing refresh, focus/visibility, cleanup)')
}
