import {installSchemaTestDependencies} from './mvu-schema-test-dependencies-fixture.mts'
import {installMvuNativeDataTestDependencies} from './mvu-native-data-test-dependencies-fixture.mts'
import type {SettingToolDependencies,SettingArguments} from '../lib/core/roleplay-panel-routes-types.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import {createRequire,registerHooks} from 'node:module'
import {pathToFileURL} from 'node:url'
import type { ForkGroup, WorldlineDependencies } from '../lib/core/roleplay-worldline-types.js'
import type { CompletionDependencies, CompletionState } from '../lib/core/roleplay-completion-types.js'
import type { ContextEvent, ContextSession } from '../lib/core/roleplay-context.js'
import type { BranchRoutesDependencies } from '../lib/core/roleplay-branch-routes-types.js'

const removeNativeDependencies=await installMvuNativeDataTestDependencies(),
  removeDependencies=installSchemaTestDependencies()
const testRequire=createRequire(new URL('../build-tools/package.json',import.meta.url))
const taskLlmDependency=registerHooks({resolve(specifier,context,next) {
  if(specifier==='@deepseek-ai/dsh-agent-loop'
    &&context.parentURL===new URL('../lib/core/roleplay-input-cold-row-facts.js',import.meta.url).href)
    return {url:new URL('../development/agent-loop/lib/input-admission.js',import.meta.url).href,shortCircuit:true}
  if(specifier==='@deepseek-ai/dsh-llm'&&context.parentURL===new URL('../lib/core/roleplay-task-tools.js',import.meta.url).href)
    return {url:pathToFileURL(testRequire.resolve(specifier)).href,shortCircuit:true}
  return next(specifier,context)
}})
try {
const [{registerSettingTool,savePanelSetting},{createTavernTasks},{createRoleplayService},
  {recordSha256,sha256,textOf},{importActiveKey},{isSettingManagementCall},{createConversationCatalog},
  {createRoleplayCompletion},{canonicalAssistantForTurn,surfaceEntries,surfaceEvents,eventsOf,isCompletedTurnEnd},
  {createRoleplayWorldlines},{registerBranchRoutes},{registerSideChat}]=await Promise.all([
  import('../lib/core/roleplay-panel-routes.js'),import('../lib/core/tavern-tasks.js'),
  import('../lib/core/roleplay-service.js'),import('../lib/core/roleplay-data.js'),
  import('../lib/core/roleplay-import.js'),import('../lib/core/tavern-task-context.js'),
  import('../lib/core/tavern-conversations.js'),import('../lib/core/roleplay-completion.js'),
  import('../lib/core/roleplay-context.js'),import('../lib/core/roleplay-worldlines.js'),
  import('../lib/core/roleplay-branch-routes.js'),import('../lib/core/roleplay-side-chat.js'),
])

const flush=()=>new Promise(resolve=>setImmediate(resolve))
test('branch activity preserves recovered anchors, descendant tombstones and ordinary messages',()=>{
  const events:ContextEvent[]=Array.from({length:64},(_,seq)=>({seq,type:'assistant/message',
    data:{turn:seq+1,message:{id:`story-${seq}`,content:[{type:'text',text:'Story reply'}]}}}))
  const root:ContextSession={id:'activity-root',events,surface:{nodes:events.map(event=>event.seq)}}
  const child:ContextSession={...root,id:'activity-child',header:{parentSession:root.id}}
  const sessions=new Map([[root.id,root],[child.id,child]]),records=new Map<string,any>()
  const branch={get:(key:string)=>records.get(key),entries:()=>records.entries()}
  const api=createRoleplayWorldlines({ctx:{sessions},T:{branch},safeId:String,
    keyOf:(id:string,key:string)=>`${id}__${key}`,sha256,eventsOf,
    surfaceEvents:(session:ContextSession)=>session.events,cloneBranchRecord:structuredClone} as unknown as WorldlineDependencies)
  assert.equal(api.storyBranchIsActive(child),true)
  const group={groupId:'activity',rootSessionId:root.id,anchor:{sourceSessionId:root.id},members:[
    {sessionId:root.id,assistantMessageId:'story-7',ordinal:1,deleted:false},
    {sessionId:child.id,assistantMessageId:'story-7',ordinal:2,deleted:false},
  ]}
  records.set(api.forkGroupKey(group.groupId),group)
  assert.equal(api.storyBranchIsActive(child),true,'an interrupted missing child pointer still recovers its group')
  group.members[1]!.deleted=true
  assert.deepEqual(api.deletedBranchMessageIdsFor(child),['story-7'],'a recovered ancestor pointer retains the child tombstone')
  assert.equal(api.storyBranchIsActive(child),false)
  records.set(`${root.id}__fork-anchor-${sha256('story-7').slice(0,24)}`,{groupId:group.groupId})
  group.members[0]!.deleted=true
  assert.equal(api.storyBranchIsActive(root),false,'durable direct anchors retain deletion even after all members are tombstoned')
})

function fixture({via='event',tool='rp_source_search',invalid='',retry=false}={}) {
  const events:ContextEvent[]=[
    {seq:0,type:'turn/start',data:{turn:1}},
    {seq:1,type:'user/message',data:{id:'player',source:{kind:'user',rpcId:'request'},content:[{type:'text',text:'Check the card'}]}},
    {seq:2,type:'user/message',data:{id:'phase',source:{kind: 'roleplay-tasks',form:'phase',stage:invalid==='internal'?'after-story':'story'},content:[]}},
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
// Exercise the real opening ledger with a completed Native turn while Core's
// domain/ACK settlement is independently pending. The proof reader's grammar
// belongs to Core; these assertions cover fork publication and recovery.
type ProgramOpeningSettlement=ReturnType<NonNullable<WorldlineDependencies['readProgramOpeningSettlement']>>
function openingForkFixture(protocol:'program'|'legacy'|'undefined'='program') {
  const operationId='opening-operation',messageId=`opening-regenerate-${operationId}`,groupId='opening-group'
  const events:ContextEvent[]=[
    {seq:0,type:'turn/start',data:{turn:1}},
    {seq:1,type:'assistant/message',data:{turn:1,message:{id:messageId,source:{kind:'model'},
      content:[{type:'text',text:'A generated opening.'}]}}},
    {seq:2,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}},
  ]
  const session:ContextSession={id:'opening-child',events,surface:{nodes:[1]}}
  const records=new Map<string,any>(),writes:{key:string;kind:'put'|'delete'}[]=[]
  const controls={proof:null as ProgramOpeningSettlement,onFlush:async()=>{},
    failTail:null as 'anchor'|'delete'|null}
  const branch={get:(key:string)=>records.get(key),entries:()=>records.entries(),
    put:async(key:string,value:unknown)=>{
      if(controls.failTail==='anchor'&&key.includes('__fork-anchor-')) {
        controls.failTail=null;throw Error('opening anchor write unavailable')
      }
      records.set(key,structuredClone(value));writes.push({key,kind:'put'})
    },delete:async(key:string)=>{
      if(controls.failTail==='delete') {controls.failTail=null;throw Error('opening pending cleanup unavailable')}
      records.delete(key);writes.push({key,kind:'delete'})
    }}
  const deps={ctx:{},T:{branch},safeId:String,keyOf:(id:string,key:string)=>`${id}__${key}`,
    sha256,textOf,eventsOf,surfaceEvents,isCompletedTurnEnd,cloneBranchRecord:structuredClone,canonicalAssistantForTurn,
    flushEdits:async()=>{await controls.onFlush()},
    ...protocol==='legacy'?{}:{readProgramOpeningSettlement:(owner:ContextSession,operation:string,message:string)=>{
      assert.equal(owner,session);assert.equal(operation,operationId);assert.equal(message,messageId)
      return protocol==='undefined'?undefined:controls.proof
    }},
  } as unknown as WorldlineDependencies
  const reopen=()=>createRoleplayWorldlines(deps),api=reopen(),groupKey=api.forkGroupKey(groupId)
  const pendingKey=api.forkPendingKey(session.id,groupId)
  const anchors=()=>[...records.entries()].filter(([key])=>key.startsWith(session.id+'__fork-anchor-'))
    .map(([,value])=>value)
  records.set(groupKey,{groupId,rootSessionId:'root',anchor:{sourceSessionId:'root',sourceAssistantMessageId:'old',
    openingOnly:true},members:[{sessionId:session.id,ordinal:2,operationId,pending:true,deleted:false,
    kind:'opening-regenerate',createdAt:1}]})
  records.set(pendingKey,{groupId,ordinal:2,operationId})
  const proof={messageId,seq:1,turn:1}
  const member=()=>records.get(groupKey).members[0]
  const groupWrites=()=>writes.filter(row=>row.key===groupKey).length
  return {api,reopen,session,events,records,controls,groupKey,pendingKey,anchors,proof,member,groupWrites,writes}
}
{
  const h=openingForkFixture()
  await h.api.reconcileNativeFork(h.session)
  assert.equal(h.member().pending,true,'a completed turn cannot publish a recognized, unclosed program opening')
  assert.equal(h.groupWrites(),0);assert.equal(h.anchors().length,0);assert.equal(h.records.has(h.pendingKey),true)
  h.controls.proof=h.proof
  await h.api.reconcileNativeFork(h.session)
  assert.equal(h.member().pending,false);assert.equal(h.member().assistantMessageId,h.proof.messageId)
  assert.equal(h.member().assistantSeq,h.proof.seq);assert.equal(h.records.has(h.pendingKey),false)
  assert.equal(h.anchors().length,1);assert.equal(h.anchors()[0].groupId,h.records.get(h.groupKey).groupId)
  await h.reopen().reconcileNativeFork(h.session)
  assert.equal(h.groupWrites(),1,'completed navigation is idempotent after reopening')
}
for(const protocol of ['legacy','undefined'] as const) {
  const h=openingForkFixture(protocol)
  await h.api.reconcileNativeFork(h.session)
  assert.equal(h.member().pending,false,`${protocol}: completed legacy opening retains its existing contract`)
  assert.equal(h.member().assistantMessageId,h.proof.messageId);assert.equal(h.records.has(h.pendingKey),false)
}
for(const change of ['proof-null','proof-undefined','proof-message','proof-seq','proof-turn',
  'member-deleted','member-removed','member-failed','pending-operation','pending-ordinal','pending-deleted',
  'pending-group','candidate-seq','turn-failed']) {
  const h=openingForkFixture();h.controls.proof=h.proof
  h.controls.onFlush=async()=>{
    if(change==='proof-null')h.controls.proof=null
    if(change==='proof-undefined')h.controls.proof=undefined
    if(change==='proof-message')h.controls.proof={...h.proof,messageId:'another-output'}
    if(change==='proof-seq')h.controls.proof={...h.proof,seq:3}
    if(change==='proof-turn')h.controls.proof={...h.proof,turn:2}
    if(change==='member-deleted')h.member().deleted=true
    if(change==='member-removed')h.records.get(h.groupKey).members=[]
    if(change==='member-failed')h.member().failed=true
    if(change==='pending-operation')h.records.get(h.pendingKey).operationId='another-operation'
    if(change==='pending-ordinal') {h.records.get(h.pendingKey).ordinal=3;h.member().ordinal=3}
    if(change==='pending-deleted')h.records.delete(h.pendingKey)
    if(change==='pending-group') {
      const redirected={...structuredClone(h.records.get(h.groupKey)),groupId:'another-valid-opening-group'}
      h.records.set(h.api.forkGroupKey(redirected.groupId),redirected)
      h.records.get(h.pendingKey).groupId=redirected.groupId
    }
    if(change==='candidate-seq')h.events[1]!.seq=3
    if(change==='turn-failed')h.events[2]!.data!.reason={kind:'error'}
  }
  await h.api.reconcileNativeFork(h.session)
  assert.equal(h.groupWrites(),0,`${change}: an awaited flush cannot authorize stale navigation`)
  assert.equal(h.writes.length,0,`${change}: neither the original nor a redirected group can publish stale output`)
  assert.equal(h.anchors().length,0);assert.equal(h.records.has(h.pendingKey),change!=='pending-deleted')
}
{
  const h=openingForkFixture();h.controls.proof=h.proof
  let admitLock!:()=>void,releaseLock!:()=>void,flushed!:()=>void
  const admitted=new Promise<void>(resolve=>{admitLock=resolve}),gate=new Promise<void>(resolve=>{releaseLock=resolve})
  const afterFlush=new Promise<void>(resolve=>{flushed=resolve})
  const held=h.api.withForkMutationLock(h.api.forkAnchorLockKey(h.records.get(h.groupKey).anchor),async()=>{
    admitLock();await gate
  })
  await admitted
  h.controls.onFlush=async()=>{flushed()}
  const running=h.api.reconcileNativeFork(h.session)
  await afterFlush;h.controls.proof=null;releaseLock();await held;await running
  assert.equal(h.groupWrites(),0,'lock waiting cannot preserve a proof that its owner has revoked')
  assert.equal(h.anchors().length,0);assert.equal(h.records.has(h.pendingKey),true)
}
for(const failedTail of ['anchor','delete'] as const)for(const conflict of ['none','message','seq']) {
  const h=openingForkFixture();h.controls.proof=h.proof;h.controls.failTail=failedTail
  await assert.rejects(h.api.reconcileNativeFork(h.session),/opening (anchor write|pending cleanup) unavailable/)
  assert.equal(h.member().pending,false);assert.equal(h.groupWrites(),1);assert.equal(h.records.has(h.pendingKey),true)
  if(conflict==='message')h.member().assistantMessageId='another-completed-output'
  if(conflict==='seq')h.member().assistantSeq=3
  await h.reopen().reconcileNativeFork(h.session)
  assert.equal(h.groupWrites(),1,'tail recovery must preserve the committed group')
  assert.equal(h.records.has(h.pendingKey),conflict!=='none','only the same proven output can finish the tail')
  assert.equal(h.member().assistantMessageId,conflict==='message'?'another-completed-output':h.proof.messageId)
  assert.equal(h.member().assistantSeq,conflict==='seq'?3:h.proof.seq)
  if(conflict==='none')assert.equal(h.anchors()[0].groupId,h.records.get(h.groupKey).groupId)
}
await test('opening reply pager skips failed and pending empty members without changing durable recovery history',async()=>{
  const groupId='opening-reply-pager',playerVariantId=`${groupId}:player:1`
  const originalMessageId='card-opening-copy',generatedMessageId='opening-regenerate-operation-9'
  const original:ContextSession={id:'opening-copy',events:[
    {seq:0,type:'turn/start',data:{turn:1}},
    {seq:1,type:'assistant/message',data:{turn:1,message:{id:originalMessageId,
      content:[{type:'text',text:'The copied card opening.'}]}}},
  ],surface:{nodes:[1]}}
  const generated:ContextSession={id:'opening-generated-9',events:[
    {seq:0,type:'turn/start',data:{turn:1}},
    {seq:1,type:'assistant/message',data:{turn:1,message:{id:generatedMessageId,source:{kind:'model'},
      content:[{type:'text',text:'The completed generated opening.'}]}}},
    {seq:2,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}},
  ],surface:{nodes:[1]}}
  const sessions=new Map([[original.id,original],[generated.id,generated]])
  const records=new Map<string,unknown>()
  const branch={get:(key:string)=>records.get(key),entries:()=>records.entries(),
    put:async(key:string,value:unknown)=>{records.set(key,structuredClone(value))},
    delete:async(key:string)=>{records.delete(key)}}
  const api=createRoleplayWorldlines({ctx:{sessions:{get:(id:string)=>sessions.get(id)}},T:{branch},
    safeId:String,keyOf:(id:string,key:string)=>`${id}__${key}`,sha256,textOf,eventsOf,surfaceEvents,
    isCompletedTurnEnd,cloneBranchRecord:structuredClone,canonicalAssistantForTurn} as unknown as WorldlineDependencies)
  const reservation=(ordinal:number)=>({operationId:`operation-${ordinal}`,sessionId:`opening-generated-${ordinal}`,
    ordinal,kind:'opening-regenerate',promptText:'',userMessageId:null,userSeq:null,playerVariantId,
    playerOrdinal:1,playerTextRevision:1,playerAppliedRevision:0,assistantMessageId:null,assistantSeq:null,
    createdAt:ordinal,deleted:false,pending:true})
  // R24 retained seven failed opening reservations between the original copy
  // and its first completed generation. They remain available for recovery.
  const failedMembers=Array.from({length:7},(_,index)=>{
    const ordinal=index+2
    return {...reservation(ordinal),pending:false,failed:true,failureReason:'生成未完成',failedAt:ordinal+100}
  })
  const group:ForkGroup={schemaVersion:2,groupId,rootSessionId:original.id,
    anchor:{sourceSessionId:original.id,sourceAssistantMessageId:originalMessageId,sourceAssistantSeq:1,
      sourceAssistantTurn:1,sourceTurn:1,previousTurnEndSeq:null,promptText:'',openingOnly:true},
    members:[{sessionId:original.id,ordinal:1,kind:'original',promptText:'',userMessageId:null,userSeq:null,
      playerVariantId,playerOrdinal:1,assistantMessageId:originalMessageId,assistantSeq:1,
      createdAt:1,deleted:false,pending:false},...failedMembers,
      {...reservation(9),pending:false,assistantMessageId:generatedMessageId,assistantSeq:1,completedAt:109},
      reservation(10)],
    playerVariants:{[playerVariantId]:{text:'',revision:1,updatedAt:1}},createdAt:1,updatedAt:110}
  const groupKey=api.forkGroupKey(groupId)
  records.set(groupKey,group)
  records.set(api.forkPendingKey('opening-generated-10',groupId),{groupId,ordinal:10,operationId:'operation-10'})
  const before=JSON.stringify([...records.entries()])
  const expectedMembers=[
    {sessionId:original.id,ordinal:1,sourceOrdinal:1,kind:'original',pending:false},
    {sessionId:generated.id,ordinal:2,sourceOrdinal:9,kind:'opening-regenerate',pending:false},
  ]
  const generatedProjection=await api.nativeBranchGroupsFor(generated)
  assert.deepEqual(generatedProjection[generatedMessageId],{groupId,currentOrdinal:2,total:2,members:expectedMembers},
    'previous reply points directly to the original copy across the seven failed empty reservations')
  const originalProjection=await api.nativeBranchGroupsFor(original)
  assert.deepEqual(originalProjection[originalMessageId],{groupId,currentOrdinal:1,total:2,members:expectedMembers},
    'next reply points directly to the completed generation with its durable source ordinal')
  assert.equal(JSON.stringify([...records.entries()]),before,'paging leaves every durable group and recovery pointer unchanged')
  const retained=records.get(groupKey) as ForkGroup
  assert.equal(retained.members.length,10)
  assert.deepEqual(retained.members.filter(member=>member.failed),failedMembers,'all seven failed recovery members remain intact')
  assert.equal(retained.members[9]!.pending,true)
  assert.equal(retained.members[9]!.assistantMessageId,null)

  const recoveryMembers=structuredClone(retained.members.filter(member=>member.failed||member.pending))
  const pendingKey=api.forkPendingKey('opening-generated-10',groupId),pendingRecord=structuredClone(records.get(pendingKey))
  const nativeHistory=structuredClone({original:original.events,generated:generated.events})
  // Normal Native completion persists this pointer. The ledger fallback above
  // covers paging; the retained pointer also anchors a deleted reply's retry.
  records.set(`${generated.id}__fork-anchor-${sha256(generatedMessageId).slice(0,24)}`,{groupId})
  let branchRoute!:{fetch(request:Request):Promise<Response>}
  registerBranchRoutes({...api,T:{branch},cloneBranchRecord:structuredClone,
    resolveRoleplaySession:async(id:string)=>sessions.get(id),
    ctx:{effect:(work:()=>unknown)=>work(),connection:{fetch:{register:(route:typeof branchRoute)=>{branchRoute=route}}}},
  } as unknown as BranchRoutesDependencies)
  const deleteRequest=()=>branchRoute.fetch(new Request('https://fixture.test/api/roleplay/branch',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'delete',sessionId:generated.id,messageId:generatedMessageId}),
  }))
  const deleted=await deleteRequest(),deletedBody=await deleted.json()
  assert.equal(deleted.status,200)
  assert.equal(deletedBody.nextSessionId,original.id,'delete selects a completed reply across the failed empty members')
  assert.equal(deletedBody.remaining,1,'empty failed and pending members are not remaining browsable replies')
  const afterDelete=JSON.stringify(records.get(groupKey))
  const replayed=await deleteRequest(),replayedBody=await replayed.json()
  assert.equal(replayed.status,200)
  assert.equal(replayedBody.alreadyDeleted,true)
  assert.equal(replayedBody.nextSessionId,original.id)
  assert.equal(replayedBody.remaining,1)
  assert.equal(JSON.stringify(records.get(groupKey)),afterDelete,'delete retry preserves the committed tombstone')
  const deletedGroup=records.get(groupKey) as ForkGroup
  assert.deepEqual(deletedGroup.members.filter(member=>member.failed||member.pending),recoveryMembers,
    'delete and retry preserve all failed and pending recovery members')
  assert.deepEqual(records.get(pendingKey),pendingRecord)
  assert.deepEqual(deletedGroup.members.filter(member=>member.deleted).map(member=>member.sessionId),[generated.id])
  assert.equal(deletedGroup.members.find(member=>member.sessionId===generated.id)!.assistantMessageId,generatedMessageId)
  assert.deepEqual({original:original.events,generated:generated.events},nativeHistory,'branch deletion retains both Native bodies')
})
await test('worldline terminal transitions release prepared inheritance resources',async()=>{
  for(const transition of ['abort','operation-status','create-worldline','expired-create','expired-register'] as const) {
    const expired=transition.startsWith('expired-')
    const action=transition==='expired-create'?'create-worldline':transition==='expired-register'?'register':transition
    const parentId='release-parent',childId='release-child',operationId=`release-${transition}`
    const resources=new Map<string,unknown>([[childId,{prepared:'owned DATA'}],['another-child',{prepared:'other DATA'}]])
    const parent={id:parentId,events:[{seq:0,type:'turn/end',data:{turn:1}}]}
    const parentBefore=JSON.stringify(parent)
    const operation={schemaVersion:1,operationId,kind:'player-edit',promptText:'A different choice',
      anchor:{sourceSessionId:parentId,sourceTurn:2,previousTurnEndSeq:0,expectedSeedLength:1},
      state:action==='operation-status'?'failed':'prepared',createdAt:Date.now(),expiresAt:expired?1:Date.now()+60_000,
      ...(transition==='create-worldline'?{}:{reservedChildSessionId:childId})}
    const records=new Map<string,unknown>([[`fork-op-${operationId}`,operation]])
    const branch={get:(key:string)=>records.get(key),
      put:async(key:string,value:unknown)=>{records.set(key,structuredClone(value))},
      update:async(key:string,work:(value:unknown)=>unknown)=>{
        const next=work(records.get(key));records.set(key,structuredClone(next));return structuredClone(next)
      },delete:async(key:string)=>{records.delete(key)}}
    const catalog=createConversationCatalog({read:()=>null,write:async()=>{}})
    if(transition!=='create-worldline')await catalog.reserve({sourceSessionId:parentId,childSessionId:childId,
      operationId,kind:'player-edit',sourceHash:'f'.repeat(64)})
    let route!:{fetch(request:Request):Promise<Response>}
    registerBranchRoutes({T:{branch},cloneBranchRecord:structuredClone,
      forkOperationKey:(id:string)=>`fork-op-${id}`,
      withForkMutationLock:async(_key:string,work:()=>Promise<unknown>)=>work(),
      resolveRoleplaySession:async(id:string)=>id===parentId?parent:id===childId?{id:childId}:null,
      assertStoryBranchActive:()=>{},
      prepareWorldlineInheritance:async()=>{resources.set(childId,{prepared:'reserved DATA'})},
      releaseWorldlineInheritance:(id:string)=>{resources.delete(id)},
      ctx:{effect:(work:()=>unknown)=>work(),get:()=>catalog,
        sessions:{get:(id:string)=>id===parentId?parent:undefined},
        connection:{fetch:{register:(registered:typeof route)=>{route=registered}}},
        sessionController:{resolveAgent:async(id:string)=>id===parentId
          ?{agent:{session:parent,status:'idle'}}:{error:{code:'session/not-found'}},
          forkPrepared:async(_input:unknown,reserve:(value:unknown)=>Promise<void>)=>{
            await reserve({sourceSessionId:parentId,childSessionId:childId,seedLength:1})
            throw Error('Native fork publication failed')
          }}},
    } as unknown as BranchRoutesDependencies)
    const response=await route.fetch(new Request('https://fixture.test/api/roleplay/branch',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,operationId,
        childSessionId:childId,requestId:'release-request',promptText:'A different choice'}),
    }))
    const body=await response.json()
    if(expired)assert.match(body.error,/过期|失效/)
    else if(action==='create-worldline')assert.match(body.error,/Native fork publication failed/)
    else assert.equal(response.status,200)
    assert.equal((records.get(`fork-op-${operationId}`) as typeof operation).state,expired?'prepared':action==='abort'?'aborted':'failed')
    assert.equal(resources.has(childId),false,`${transition} releases its prepared inheritance DATA`)
    assert.equal(resources.has('another-child'),true,'another live reservation remains owned')
    assert.equal(catalog.snapshot().worldlines[childId]?.status,expired?'reserved':'failed')
    assert.equal(JSON.stringify(parent),parentBefore,'terminal cleanup leaves the parent Native history intact')
  }
})
console.log('management-fork-completion=ok (event/idle, story isolation, invalid replies, retry, opening closure and tail recovery)')

// Coordinator seam: loss after Native/bootstrap/model publication reuses that
// exact reserved child and frozen Source. Actual Native/Source behavior lives
// in roleplay-core-input-fork.test.mts, rather than being simulated here.
await test('clean branch owner retains frozen preparation across lost acknowledgements and refuses stale callers',async()=>{
  function fixture(failure='') {
    const parentId='clean-owner-parent',childId='clean-owner-child',records=new Map<string,any>(),sessions=new Map<string,any>()
    const parent={id:parentId,header:{cwd:'.'},events:[
      {seq:0,type:'turn/start',data:{turn:1}},
      {seq:1,type:'assistant/message',data:{turn:1,message:{id:'opening',source:{kind:'programmatic'}}}},
      {seq:2,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}},
      {seq:3,type:'agent/inbox/spliced',data:{target:'next-turn',inserted:[{id:'failed-input'}]}},
      {seq:4,type:'turn/start',data:{turn:2}},
      {seq:5,type:'turn/end',data:{turn:2,reason:{kind:'aborted'}}},
    ]}
    sessions.set(parentId,parent)
    const branch={get:(key:string)=>records.get(key),
      put:async(key:string,value:unknown)=>{records.set(key,structuredClone(value))},
      update:async(key:string,work:(value:unknown)=>unknown)=>{
        const value=work(records.get(key));records.set(key,structuredClone(value));return structuredClone(value)
      },delete:async(key:string)=>{records.delete(key)}}
    const diagnostic={schemaVersion:1,revision:'d'.repeat(64),preparationId:'failed-preparation',receiptGeneration:1,
      attemptGeneration:1,refs:[],status:'unknown',sourceKind:'story',stop:{status:'unknown',code:'REQUEST_MATERIAL_ROLE_POSITION_UNSUPPORTED'}}
    records.set(parentId+'__native-input-v2-work-original',diagnostic)
    const models=new Map<string,any>([[parentId,{provider:'fixture',model:'current-compatible',reasoningEffort:'high'}]]),
      controls={source:'current author DATA',sourceRevision:'source-1',current:true,flush:true,
        sourceWait:Promise.resolve(),sourceStarted:()=>{}},
      calls={native:0,bootstrap:0,model:0},frozen=new Map<string,string>(),applied=new Map<string,string>()
    let fail=failure
    const catalog=createConversationCatalog({read:()=>null,write:async()=>{}})
    let route:any
    const api=registerBranchRoutes({T:{branch},cloneBranchRecord:structuredClone,
      forkOperationKey:(id:string)=>'fork-op-'+id,withForkMutationLock:async(_key:string,work:()=>unknown)=>work(),
      resolveRoleplaySession:async(id:string)=>sessions.get(id)??null,assertStoryBranchActive:()=>{},
      readInputRecoveryDiagnostic:()=>structuredClone(diagnostic),readMainModelSelection:(session:{id:string})=>models.get(session.id),
      captureCleanBranchSource:()=>{const revision=controls.sourceRevision;return {revision,assertCurrent(){
        if(revision!==controls.sourceRevision)throw Error('SOURCE_CHANGED')
      }}},sourceInheritance:{assertPreparedParentCurrent(){}},
      prepareWorldlineInheritance:async(_operation:any,reservation:any)=>{
        controls.sourceStarted()
        await controls.sourceWait;frozen.set(reservation.childSessionId,controls.source)
        return {kind:'prepared-data',disposition:'created'}
      },releaseWorldlineInheritance:(id:string)=>{frozen.delete(id)},
      bootstrapChildBranch:async(operation:any,child:any)=>{
        assert.equal(operation.kind,'prepare-clean-branch');assert.equal(operation.anchor.sourceUserSeq,undefined)
        assert.equal(operation.groupId,undefined)
        if(!applied.has(child.id)){calls.bootstrap++;applied.set(child.id,frozen.get(child.id)!)}
        if(fail==='bootstrap'){fail='';throw Error('bootstrap acknowledgement lost')}
      },
      ctx:{effect:(work:()=>unknown)=>work(),get:()=>catalog,
        connection:{fetch:{register:(registered:any)=>{route=registered}}},
        sessions:{get:(id:string)=>sessions.get(id),flush:async()=>controls.flush},
        sessionController:{resolveAgent:async(id:string)=>sessions.has(id)
          ?{agent:{session:sessions.get(id),status:'idle'}}:{error:{code:'session/not-found'}},
          forkPrepared:async(input:any,reserve:(value:any)=>Promise<void>)=>{
            assert.equal(input.atSeq,2,'the last aborted end at seq 5 is never a clean boundary')
            calls.native++;await reserve({sourceSessionId:parentId,childSessionId:childId,seedLength:4})
            sessions.set(childId,{id:childId,header:{parentSession:parentId},inheritedEventCount:4,events:[]})
            models.set(childId,{provider:'fixture',model:'old-seed-model'})
            if(fail==='native'){fail='';throw Error('Native creation acknowledgement lost')}
            return {sessionId:childId}
          },selectModelForSession:async(input:any)=>{
            calls.model++;const {sessionId,...model}=input;models.set(sessionId,model)
            if(fail==='model'){fail='';throw Error('model acknowledgement lost')}
          }}},
    } as unknown as BranchRoutesDependencies)
    return {api,route,parentId,childId,parent,records,sessions,diagnostic,models,controls,calls,catalog,applied,
      guard:()=>{if(!controls.current)throw Error('side caller revoked')}}
  }
  for(const failure of ['native','bootstrap','model','flush']) {
    const f=fixture(failure),before=recordSha256(f.records.get(f.parentId+'__native-input-v2-work-original'))
    const inspected=await f.api.inspectCleanBranch(f.parentId)
    assert.equal(f.records.size,1,'inspection creates no operation or recovery permission')
    const request={sessionId:f.parentId,operationId:inspected.operationId,expectedRevision:inspected.revision}
    if(failure==='flush')f.controls.flush=false
    const failedResponse=await f.route.fetch(new Request('https://fixture.test/api/roleplay/branch',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'prepare-clean-branch',...request}),
    }))
    const failedBody=await failedResponse.json()
    assert.equal(failedResponse.status,500,'unknown publication and flush failures remain retryable server errors')
    assert.match(failedBody.error,/acknowledgement lost|FLUSH_FAILED/,'the original transport/IO evidence is retained')
    const pending=await f.api.cleanBranchStatus(f.parentId,request.operationId)
    assert.equal(pending.childSessionId,f.childId);assert.equal(pending.status,'prepared')
    assert.notEqual(f.catalog.snapshot().worldlines[f.childId]!.status,'ready')
    f.controls.source='later author DATA';f.controls.sourceRevision='source-2';f.controls.flush=true
    f.models.set(f.parentId,{provider:'fixture',model:'later-player-selection'})
    const ready=await f.api.prepareCleanBranch(request,f.guard)
    assert.equal(ready.status,'ready');assert.equal(ready.childSessionId,f.childId)
    assert.equal(f.calls.native,1);assert.equal(f.calls.bootstrap,1);assert.equal(f.calls.model,1)
    assert.equal(f.applied.get(f.childId),'current author DATA','resumption never re-captures later parent DATA')
    assert.equal(f.models.get(f.childId).model,'current-compatible','resumption uses the reserved player model')
    assert.equal(f.catalog.selectionOf(f.parentId).activeSessionId,f.parentId)
    assert.equal(recordSha256(f.records.get(f.parentId+'__native-input-v2-work-original')),before)
    assert.equal((f.records.get('fork-op-'+request.operationId)).schemaVersion,2)
    assert.equal((f.records.get('fork-op-'+request.operationId)).groupId,undefined)
    assert.equal((await f.api.prepareCleanBranch(request,f.guard)).childSessionId,f.childId)
    assert.equal(f.calls.native,1,'a lost final response cannot allocate a second child')
  }
  {
    const f=fixture()
    await f.catalog.activate('unrelated-private-conversation')
    const inspected=await f.api.inspectCleanBranch(f.parentId),
      request={sessionId:f.parentId,operationId:inspected.operationId,expectedRevision:inspected.revision}
    const ready=await f.api.prepareCleanBranch(request,f.guard,{includeConversations:false})
    assert.equal(ready.status,'ready');assert.equal(ready.childSessionId,f.childId)
    assert.equal(ready.requiresPlayerInput,true)
    assert.equal(Object.hasOwn(ready,'conversations'),false)
    assert.ok(!JSON.stringify(ready).includes('unrelated-private-conversation'))
    const status=await f.api.cleanBranchStatus(f.parentId,request.operationId,{includeConversations:false})
    assert.deepEqual(status,ready)
    const ui=await f.api.cleanBranchStatus(f.parentId,request.operationId)
    assert.ok(ui.conversations.conversations['unrelated-private-conversation'],
      'the ordinary UI still receives its full catalog')
  }
  {
    const f=fixture(),inspected=await f.api.inspectCleanBranch(f.parentId)
    f.diagnostic.revision='e'.repeat(64)
    await assert.rejects(f.api.prepareCleanBranch({sessionId:f.parentId,operationId:inspected.operationId,
      expectedRevision:inspected.revision},f.guard),/DIAGNOSIS_CHANGED/)
    assert.equal(f.calls.native,0);assert.equal(f.records.size,1)
  }
  {
    const f=fixture(),entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>(),
      inspected=await f.api.inspectCleanBranch(f.parentId)
    f.controls.sourceStarted=()=>entered.resolve();f.controls.sourceWait=release.promise
    const work=f.api.prepareCleanBranch({sessionId:f.parentId,operationId:inspected.operationId,
      expectedRevision:inspected.revision},f.guard)
    const rejected=assert.rejects(work,/side caller revoked/)
    await entered.promise;f.controls.current=false;release.resolve();await rejected
    assert.equal(f.sessions.has(f.childId),false);assert.equal(f.catalog.snapshot().worldlines[f.childId],undefined)
  }
  {
    const f=fixture('native'),inspected=await f.api.inspectCleanBranch(f.parentId),
      request={sessionId:f.parentId,operationId:inspected.operationId,expectedRevision:inspected.revision}
    await assert.rejects(f.api.prepareCleanBranch(request,f.guard),/acknowledgement lost/)
    f.sessions.delete(f.childId)
    await assert.rejects(f.api.prepareCleanBranch(request,f.guard),/创建已失效/)
    assert.equal((await f.api.cleanBranchStatus(f.parentId,request.operationId)).status,'failed')
    assert.equal(f.calls.native,1,'a vanished reserved child is never silently recreated')
  }
})

await test('current-input recovery diagnostics retain unique work identity and detached refs',async()=>{
  const {createRoleplayInputPreparation,ROLEPLAY_INPUT_NAMESPACE}=
    await import('../lib/core/roleplay-input-preparation.js')
  const sid='diagnostic-owner',rows=new Map<string,any>(),prefix=sid+'__native-input-v2-'
  const work=(preparationId:string)=>{
    const refs=[{sessionId:sid,insertSeq:5,index:0,messageId:'input-'+preparationId,messageSha256:'a'.repeat(64)}]
    const identity={schemaVersion:2,namespace:ROLEPLAY_INPUT_NAMESPACE,sessionId:sid,branchId:sid,
      preparationId,receiptGeneration:1,refs},credentialSha256=recordSha256(identity)
    return {...identity,credentialSha256,preparation:{schemaVersion:1,namespace:ROLEPLAY_INPUT_NAMESPACE,
      preparationKeySha256:recordSha256({sessionId:sid,preparationId}),credentialSha256},
      attemptGeneration:1,status:'unknown',source:{kind:'story',sourceSha256:'b'.repeat(64)},
      stop:{status:'unknown',code:'TEMPLATE_GUEST_ERROR'}}
  }
  for(let index=0;index<50;index++)rows.set(prefix+'work-history-'+index,work('old-'+index))
  const current=work('current')
  rows.set(prefix+'work-current',current)
  const owner=createRoleplayInputPreparation({table:{get:key=>rows.get(key),entries:()=>rows.entries(),
    put:async()=>{throw Error('diagnostics must not write')}},observe:()=>{throw Error('diagnostics must not observe Source')}})
  assert.equal(owner.readRecoveryDiagnostic(sid),null)
  rows.set(prefix+'current',{preparationId:current.preparationId,credentialSha256:current.credentialSha256})
  const result=owner.readRecoveryDiagnostic(sid)!
  assert.equal(result.preparationId,current.preparationId)
  assert.equal(result.revision,recordSha256(current))
  assert.deepEqual(result.stop,{status:'unknown',code:'TEMPLATE_GUEST_ERROR'})
  ;(result.refs[0] as any).messageId='changed detached diagnostic'
  assert.equal(current.refs[0]!.messageId,'input-current')
  assert.equal(owner.readRecoveryDiagnostic(sid)!.refs[0]!.messageId,'input-current')
  rows.set(prefix+'work-duplicate',structuredClone(current))
  assert.throws(()=>owner.readRecoveryDiagnostic(sid),/INPUT_RECOVERY_CURRENT_UNKNOWN/)
  rows.delete(prefix+'work-duplicate')
  rows.set(prefix+'current',{preparationId:'missing',credentialSha256:current.credentialSha256})
  assert.throws(()=>owner.readRecoveryDiagnostic(sid),/INPUT_RECOVERY_CURRENT_UNKNOWN/)
})

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
let barrier=Promise.resolve(),releaseBarrier:(()=>void)|undefined,enteredImportLock:(()=>void)|undefined
let evidenceBarrier=Promise.resolve()
const dep={ctx:{effect:(f:Function)=>f(),tools:{register:(t:any)=>tools.set(t.name,t)},on:(_name:string,f:Function)=>hooks.push(f),systemPrompt:{section:(s:any)=>prompts.push(s)},get(){return null}},
  T,recordVersionsFor:versions,RULE_TEXT_FIELDS:['core','plot','narrative','reply','style'],svc:service,
  withImportLock:async(_sid:string,_id:unknown,work:Function)=>{enteredImportLock?.();await barrier;return work()},sessionOf:async()=>s,resolveRoleplaySession:async(id:string)=>id===s.id?s:null,storyBranchIsActive:(target:{id:string})=>target.id===selected,
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

// The independent Native side Session resolves the active story through the
// persistent conversation binding, then writes through the same panel owner.
const sideSessions=new Map<string,any>()
let sideRoute:any
const side=registerSideChat({
  ctx:{effect:(work:Function)=>work(),connection:{fetch:{register:(route:any)=>{sideRoute=route}}},
    sessions:{get:(id:string)=>sideSessions.get(id),flush:async()=>true},
    sessionController:{
      create:async({sessionId,cwd}:{sessionId:string;cwd:string})=>{
        sideSessions.set(sessionId,{id:sessionId,header:{cwd},append(){}})
        return {sessionId}
      },
      resolveAgent:async(id:string)=>({agent:{session:sideSessions.get(id)}}),
      cancel:async()=>({accepted:true}),selectModelForSession:async()=>({}),
    },
    get:(name:string)=>name==='tavernConversations'?catalog:
      name==='permissionPresets'?{set(){}}:null},
  branch:T.branch,resolveRoleplaySession:async(id:string)=>id===s.id?s:null,
} as any)
const ensureSide=await sideRoute.fetch(new Request('http://localhost/api/roleplay/side-chat',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({sessionId:'s',action:'ensure',expectedRevision:0}),
}))
assert.equal(ensureSide.status,200)
const sideId=String((await ensureSide.json()).sideSessionId)
assert.equal((await side.storyOf(sideId))?.id,'s')
const sideAgent={session:sideSessions.get(sideId),options:{}}
registerSettingTool({...dep,sessionOf:async(exec:any)=>{
  if(!exec.agent?.session||!side.ownerOf(exec.agent.session.id))return s
  const story=await side.storyOf(exec.agent?.session?.id)
  if(!story)throw Error('侧聊失去主对话绑定')
  return story
},assertCallerCurrent(exec){
  if(exec.agent?.session?.id!==sideId)return
  if(!side.ownerOf(sideId))throw Error('side caller reset')
  side.assertToolAccess(sideId,'rp_setting',{action:'append'})
}} as SettingToolDependencies)
const sideTool=tools.get('rp_setting')
const sideRead=await sideTool.execute({action:'read',target:'core'},{agent:sideAgent})
const sideBefore=String(T.rules.get('s__spec')!.core)
const sideWrite=await sideTool.execute({action:'append',target:'core',text:'侧聊明确新增的测试设定。',
  expected_branch_id:'s',expected_revision:sideRead.revision,reason:'测试侧聊修改主对话设定'},
  {agent:sideAgent})
assert.equal(sideWrite.ok,true)
assert.equal(T.rules.get('s__spec')!.core,sideBefore+'\n侧聊明确新增的测试设定。')
assert.equal((await sideTool.execute({action:'read',target:'core'},{agent})).text,
  sideBefore+'\n侧聊明确新增的测试设定。','主对话读取同一份已提交设定')
for(const revoked of ['permission','reset']) {
  const observed=await sideTool.execute({action:'read',target:'core'},{agent:sideAgent}),
    original=structuredClone(T.rules.get('s__spec'))
  let releaseQueued!:()=>void,entered!:()=>void
  const waiting=new Promise<void>(resolve=>{entered=resolve})
  barrier=new Promise<void>(resolve=>{releaseQueued=resolve})
  enteredImportLock=entered
  const queued=sideTool.execute({action:'append',target:'core',text:'must not land after revocation',
    expected_branch_id:'s',expected_revision:observed.revision,reason:'queued caller revocation'},
    {agent:sideAgent})
  const rejected=assert.rejects(queued,revoked==='permission'?/只读权限/:/side caller reset/)
  await waiting
  const response=await sideRoute.fetch(new Request('http://localhost/api/roleplay/side-chat',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:'s',
      ...(revoked==='permission'?{action:'configure',permissionPreset:'read-only'}:{action:'reset'})})}))
  assert.equal(response.status,200)
  releaseQueued();await rejected
  assert.deepEqual(T.rules.get('s__spec'),original,'queued revoked side caller cannot change main settings')
  enteredImportLock=undefined;barrier=Promise.resolve()
  if(revoked==='permission') {
    const configured=await sideRoute.fetch(new Request('http://localhost/api/roleplay/side-chat',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:'s',
        action:'configure',permissionPreset:'workspace-write'})}))
    assert.equal(configured.status,200)
  }
}
console.log('side-setting=ok (independent Session binding -> active story -> panel owner write -> main read)')

// A legacy ST Core projection includes constant lore. Author edits must start
// from scenario alone before the shared panel marks Core independently owned.
const {decodeTavernCard,projectTavernCardCompact}=await import('../lib/core/tavern-card.js')
const {spanText,INDEPENDENT_AUTHOR_CORE_V1}=await import('../lib/core/roleplay-import-record.js')
const legacyDocument={spec:'chara_card_v2',spec_version:'2.0',data:{name:'Self authored Core edit',
  description:'SELF_CHARACTER_DESCRIPTION',scenario:'SELF_AUTHOR_SCENARIO',first_mes:'SELF_OPENING',
  character_book:{entries:[{content:'SELF_CONSTANT_LORE',constant:true,enabled:true,keys:[]}]}}}
const legacyBytes=Buffer.from(JSON.stringify(legacyDocument),'utf8')
const legacyDecoded=decodeTavernCard(legacyBytes,'.json'),legacyProjection=projectTavernCardCompact(legacyDecoded)
const legacyText=legacyProjection.text,legacyLines=legacyText.split('\n')
if(legacyText.endsWith('\n'))legacyLines.pop()
const legacyRecord={schemaVersion:5,normalizer:'tavern-fields-v2',importId:'self-legacy-core',sessionId:'ancestor',
  rawSource:legacyBytes.toString('utf8'),normalizedSource:legacyText,lineCount:legacyLines.length,
  assignments:legacyProjection.assignments,sourceEnvelope:{schemaVersion:1,extension:'.json',
    format:legacyDecoded.format,base64:legacyBytes.toString('base64'),sourceSha256:sha256(legacyBytes)}} as any
const legacyCore=spanText(legacyRecord,legacyRecord.assignments.filter((row:any)=>row.target==='core-setting')
  .flatMap((row:any)=>row.sourceSpans))
assert.ok(legacyCore.includes('SELF_CONSTANT_LORE'),'fixture exercises the old mixed Core')
await T.branch.put('ancestor__import-self-legacy-core',legacyRecord)
await T.branch.put(importActiveKey('s'),{importId:legacyRecord.importId,sourceRecordSessionId:'ancestor'})
for(const action of ['append','patch','repair'] as const) {
  await T.rules.put('s__spec',{schemaVersion:1,core:legacyCore,style:'SELF_STYLE_KEEP',importId:legacyRecord.importId})
  const observed=await read('core')
  assert.ok(observed.text.includes('SELF_AUTHOR_SCENARIO'))
  assert.ok(!observed.text.includes('SELF_CONSTANT_LORE'),'read exposes the same author text that edits consume')
  assert.equal(observed.revision,recordSha256(T.rules.get('s__spec')),'CAS binds the real mixed rules record')
  if(action==='repair') {
    const index=spawned.length
    const pendingRepair=await edit('repair','core',{instruction:'追加玩家明确指定的Core说明',basis:'player'})
    await until(()=>spawned.length===index+1)
    assert.ok(!JSON.stringify(spawned[index]!.spec.prompt).includes('SELF_CONSTANT_LORE'))
    complete(index,{outcome:'append',text:'SELF_AUTHOR_ADDITION',reason:'玩家明确指定'})
    await until(()=>job(pendingRepair.jobId).status==='completed')
  } else if(action==='append')await edit('append','core',{text:'SELF_AUTHOR_ADDITION'})
  else await edit('patch','core',{changes:[{find:'SELF_AUTHOR_SCENARIO',replace:'SELF_AUTHOR_CHANGED_SCENARIO'}]})
  const saved=T.rules.get('s__spec')!
  assert.deepEqual(saved.coreOwnership,INDEPENDENT_AUTHOR_CORE_V1)
  assert.ok(!String(saved.core).includes('SELF_CONSTANT_LORE'),'old constant lore is never frozen into independent Core')
  assert.ok(String(saved.core).includes(action==='patch'?'SELF_AUTHOR_CHANGED_SCENARIO':'SELF_AUTHOR_ADDITION'))
  assert.equal(saved.style,'SELF_STYLE_KEEP')
  assert.deepEqual(T.branch.get('ancestor__import-self-legacy-core'),legacyRecord,'the source archive stays intact')
}
console.log('author-core-setting=ok (legacy ST scenario + constant lore; read/append/patch/repair; actual-row CAS; inherited archive)')

}
}finally {taskLlmDependency.deregister();removeDependencies();removeNativeDependencies()}
