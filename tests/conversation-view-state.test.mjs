import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRoleplayActions } from '../src/session-actions.js'
import { resolveConversationExecution } from '../src/conversation-projection.js'
const source=fs.readFileSync(new URL('../src/client.js',import.meta.url),'utf8')
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
