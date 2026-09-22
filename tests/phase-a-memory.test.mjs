import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { apply } from '../lib/core/roleplay-core.js'
import {ownedPackages} from './plugin-owned-packages-fixture.mts'

const formatFixture = await ownedPackages(['session-format'])
process.once('exit', () => formatFixture.close())
const {appendMessageEdit, latestMessageEdit, currentMessageEdits} = await formatFixture.load('dsh-nexttavern-session-format')

const text = value => [{ type: 'text', text: value }]
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return {promise, resolve} }
const tick = () => new Promise(r => setTimeout(r, 280))
class Table extends Map {
  async put(key,value) { this.set(key, structuredClone(value)) }
  async update(key,fn) { await this.put(key,fn(this.get(key))); return this.get(key) }
}
async function harness(memoryResult, config = {}) {
  const tables = new Map(), hooks = new Map(), services = new Map(), cleanup = [], calls = [], toolHandlers = new Map(), sections = new Map(), routes = new Map()
  const table = n => { if (!tables.has(n)) tables.set(n,new Table()); return tables.get(n) }
  const session = {id:'phase-a-fixture',header:{agentPreset:'roleplay'},events:[],surface:{nodes:[]},seq:0}
  const ctx = {
    nexttavernMessageEdits: {append: appendMessageEdit, latest: latestMessageEdit, current: currentMessageEdits},
    storageDomain:{async open(){return {table,close(){}}}},
    sessions:{get:id=>id===session.id?session:null}, sessionController:{},
    tools:{register(tool){if(tool?.name&&tool?.execute)toolHandlers.set(tool.name,tool.execute);return ()=>{}}}, commands:{register(){return ()=>{}}},
    systemPrompt:{variable(){return ()=>{}},section(spec){sections.set(spec.name,spec);return ()=>{}}},
    connection:{fetch:{register(route){routes.set(route.path,route);return ()=>{}}}},tokenMeter:{measure(){return {nodes:[]}}},
    agentDefaultModel:{currentSelection(){return {provider:'test',model:'test'}}},
    logger:{info(){},warn(){}},fs:{},
    subagents:{
      async start(name, request) {
        assert.equal(name, 'spawn')
        const payload = JSON.parse(request.prompt[0].text)
        const workerRequest = { system: payload.system, user: payload.user, format: payload.format }
        calls.push(workerRequest)
        const result = workerRequest.system.includes('记忆提取器') ? await memoryResult(workerRequest) : {}
        return {
          id: `fixture-worker-${calls.length}`,
          result: Promise.resolve({ stopReason: 'completed', structured: result, output: [{ type: 'text', text: JSON.stringify(result) }] }),
          async dispose() {},
        }
      },
    },
    effect(fn){const c=fn();if(typeof c==='function')cleanup.push(c)},
    on(n,fn){if(!hooks.has(n))hooks.set(n,[]);hooks.get(n).push(fn);return ()=>{}},
    provide(n,s){services.set(n,s)},get:n=>services.get(n),
  }
  await apply(ctx,{workerProvider:'fixture-worker',workerModel:'worker',phaseAForegroundMs:1,memoryWorkerTimeoutMs:2000,sceneWorkerTimeoutMs:2000,...config})
  const append=(type,data,surfaceOp)=>{const e={seq:session.seq++,type,data,surfaceOp};session.events.push(e);if(surfaceOp==='append')session.surface.nodes.push(e.seq);else if(surfaceOp?.op==='replace'){const start=session.surface.nodes.indexOf(surfaceOp.startSeq),end=session.surface.nodes.indexOf(surfaceOp.endSeq);assert.ok(start>=0&&end>=start,'fixture replacement range is visible and contiguous');session.surface.nodes.splice(start,end-start+1,e.seq)}return e}
  session.append=(type,data,options={})=>{const event=append(type,data,options.surfaceOp);event.sourceEventSeqs=options.sourceEventSeqs;return event}
  const begin=turn=>{append('turn/start',{turn});return append('user/message',{id:`u${turn}`,source:{kind:'user'},content:text(`选中行动${turn}`)},'append')}
  const prepare=async(turn,messages,signal)=>{
    let nextCalls=0
    const payload={agent:{session,options:{provider:'test',model:'test'}},turn,step:1,signal,messages:messages??[{id:`u${turn}`,role:'user',source:{kind:'user'},content:text(`选中行动${turn}`)}]}
    const f=hooks.get('agent/pre-step')[0]
    const value=await f(payload,async()=>{nextCalls++;return {kind:'enter',messages:payload.messages}})
    assert.equal(nextCalls,1)
    return value.messages
  }
  const completePendingTasks = async value => {
    const exec = { agent: { session, options: { provider: 'test', model: 'test' } } }
    for (const [key, job] of table('branch').entries()) {
      if (!String(key).startsWith('tavern_job__') || job.sessionId !== session.id || job.status === 'completed') continue
      await toolHandlers.get('rp_task_read')({ id: job.id, offset: 0, maxChars: 32000 }, exec)
      await toolHandlers.get('rp_task_submit')({ id: job.id, generation: job.generation, result: value }, exec)
    }
  }
  return {session,table,services,begin,append,prepare,completePendingTasks,calls,tools:toolHandlers,sections,routes,dispose:()=>cleanup.reverse().forEach(f=>f())}
}
const hidden=messages=>messages.filter(m=>m.source?.kind==='roleplay-context')
const hiddenText=messages=>hidden(messages).map(m=>m.content[0].text).join('\n')
const anchor=(messages,form)=>messages.find(m=>m.source?.kind==='roleplay-context'&&m.source.form===form)

// High-frequency assembly is deterministic. Even an explicit auxiliary model
// must not run scene/recall inference before the main author can write.
{
 const h=await harness(()=>{throw new Error('unexpected pre-story model call')})
 try {
  const notes='已核验导演笔记：铜钥匙还在玩家手中。'
  h.services.set('compaction',{prepareForTurn:async()=>({status:'ready'}),directorNotes:()=>({text:notes,generationId:'notes-1',sourceSeqs:[3]})})
  h.begin(1)
  const messages=await h.prepare(1)
  assert.equal(h.calls.length,0,'program reads notes directly: zero pre-story auxiliary model calls')
  assert.match(hiddenText(messages),/铜钥匙还在玩家手中/)
  assert.doesNotMatch(hiddenText(messages),/记忆·本轮召回|召回来源|准备降级|尚未完成/)
  assert.ok(!messages.some(m=>m.source?.kind==='roleplay-tasks'&&m.source.stage==='prepare'))
  assert.equal([...h.table('branch').values()].filter(j=>j.kind==='memory'&&j.input).length,0)
 } finally {h.dispose()}
}
// Worldbook content is read only after the author explicitly uses the tool.
{
 const h=await harness(()=>{throw new Error('no recall worker')})
 try {
  await h.table('worldbook').put(`${h.session.id}__archive`,{id:'archive',name:'选中行动1',keywords:['选中行动1','档案馆'],content:'LORE_ONLY_ON_DEMAND：登记消耗一币。'})
  await h.table('worldbook').put('other-worldline__secret',{id:'secret',name:'档案馆',keywords:['档案馆'],content:'OTHER_BRANCH_LORE'})
  h.begin(1)
  const messages=await h.prepare(1)
  assert.doesNotMatch(hiddenText(messages),/LORE_ONLY_ON_DEMAND|世界书·本轮查询结果|OTHER_BRANCH_LORE/)
  const result=await h.tools.get('rp_worldbook_search')({query:'档案馆'},{agent:{session:h.session,options:{provider:'test',model:'test'}}})
  assert.equal(result.ok,true)
  assert.match(result.text,/LORE_ONLY_ON_DEMAND/)
  assert.doesNotMatch(result.text,/OTHER_BRANCH_LORE/)
  assert.equal(h.calls.length,0,'explicit deterministic lookup adds no auxiliary LLM inference')
 } finally {h.dispose()}
}
// A real checkpoint barrier can wait; it is not a per-turn model recall task.
{
 const gate=deferred(),h=await harness(()=>{throw new Error('no recall worker')})
 try {
  let saved=false,settled=false
  h.services.set('compaction',{async prepareForTurn(){await gate.promise;saved=true;return {status:'ready'}},directorNotes:()=>saved?{text:'CHECKPOINT_SAVED'}:null})
  h.begin(1)
  const pending=h.prepare(1).then(result=>{settled=true;return result})
  await tick()
  assert.equal(settled,false)
  assert.equal(h.calls.length,0)
  gate.resolve()
  assert.match(hiddenText(await pending),/CHECKPOINT_SAVED/)
 } finally {gate.resolve();h.dispose()}
}
// Raw player input and complete note text remain intact, not model summaries.
{
 const h=await harness(()=>{throw new Error('no recall worker')})
 try {
  const full='完整笔记与条件细节。'.repeat(3000)
  h.services.set('compaction',{directorNotes:()=>({text:full})})
  h.begin(1)
  const messages=await h.prepare(1)
  assert.ok(hiddenText(messages).includes(full))
  assert.ok(messages.some(m=>m.id==='u1'&&m.content[0].text==='选中行动1'))
  assert.equal(h.calls.length,0)
 } finally {h.dispose()}
}
// Stable versions keep their full backing anchor; superseded versions leave
// the request surface, while their durable audit events remain intact.
{
 const h=await harness(()=>{throw new Error('no recall worker')})
 try {
  const originalNotes='ANCHOR_DIRECTOR_NOTES {{user}}/{{user_gender}}'
  let notes=originalNotes
  await h.table('memory').put(`${h.session.id}__head`,{styleNotes:[{heading:'STYLE_MEMORY',text:'STYLE_MEMORY_TEXT'}],userPrefs:[{heading:'PREF_MEMORY',text:'PREF_MEMORY_TEXT'}]})
  h.services.set('compaction',{directorNotes:()=>({text:notes,generationId:'notes-anchor',sourceKeys:['1:a'],sourceSeqs:[1]})})
  const agent={session:h.session,options:{provider:'test',model:'test'}}
  assert.doesNotMatch(await h.sections.get('roleplay:rules').text({agent}),/STYLE_MEMORY_TEXT|PREF_MEMORY_TEXT/,'memory records stay out of the fixed system prefix')
  h.begin(1)
  const first=await h.prepare(1)
  assert.equal(anchor(first,'director-notes').source.mode,'full')
  assert.match(anchor(first,'director-notes').content[0].text,/ANCHOR_DIRECTOR_NOTES 用户\//)
  assert.doesNotMatch(anchor(first,'director-notes').content[0].text,/\{\{user/)
  assert.match(anchor(first,'state').content[0].text,/STYLE_MEMORY_TEXT|PREF_MEMORY_TEXT/)
  for(const message of first)h.append('user/message',{id:message.id,role:message.role,source:message.source,content:message.content},'append')
  h.append('assistant/message',{turn:1,message:{id:'a1',content:text('第一轮正文')}},'append')
  h.append('turn/end',{turn:1,reason:{kind:'completed'}})
  h.begin(2)
  const before=[...h.session.surface.nodes]
  const second=await h.prepare(2)
  assert.deepEqual(h.session.surface.nodes,before,'Phase A does not replace old anchors before adding new context')
  assert.equal(anchor(second,'director-notes').source.mode,'reference')
  assert.match(anchor(second,'director-notes').content[0].text,new RegExp(first.find(m=>m.source?.form==='director-notes').source.notesHash))
  assert.equal(anchor(second,'state').source.mode,'reference')
  for(const message of second)h.append('user/message',{id:message.id,role:message.role,source:message.source,content:message.content},'append')
  notes='ANCHOR_DIRECTOR_NOTES_CHANGED'
  h.begin(3)
  const changed=await h.prepare(3)
  assert.equal(anchor(changed,'director-notes').source.mode,'full','a new note version appends its complete current anchor')
  assert.match(anchor(changed,'director-notes').content[0].text,/ANCHOR_DIRECTOR_NOTES_CHANGED/)
  for(const message of changed)h.append('user/message',{id:message.id,role:message.role,source:message.source,content:message.content},'append')
  notes=originalNotes
  h.begin(4)
  const restored=await h.prepare(4)
  assert.equal(anchor(restored,'director-notes').source.mode,'full','returning to a retired version restores its full text instead of referencing missing evidence')
  assert.match(anchor(restored,'director-notes').content[0].text,new RegExp(anchor(first,'director-notes').source.notesHash))
  notes=''
  h.begin(5)
  const empty=await h.prepare(5)
  assert.equal(anchor(empty,'director-notes').source.mode,'full')
  assert.match(anchor(empty,'director-notes').content[0].text,/没有可用导演笔记|均已失效/)
  const firstFull=h.session.events.find(event=>event.data?.source?.kind==='roleplay-context'&&event.data.source.form==='director-notes'&&event.data.source.mode==='full')
  h.session.surface.nodes=h.session.surface.nodes.filter(seq=>seq!==firstFull.seq)
  notes=originalNotes
  h.begin(6)
  const afterWindow=await h.prepare(6)
  assert.equal(anchor(afterWindow,'director-notes').source.mode,'full','a retained reference cannot outlive the full anchor it names')
 } finally {h.dispose()}
}
// A parent branch's visible full anchor is never eligible for a child branch.
{
 const h=await harness(()=>{throw new Error('no recall worker')})
 try {
  const notes='BRANCH_LOCAL_NOTES'
  h.services.set('compaction',{directorNotes:()=>({text:notes,generationId:'branch-notes',sourceKeys:['1:a'],sourceSeqs:[1]})})
  h.append('user/message',{id:'parent-anchor',role:'user',source:{kind: 'roleplay-context',form:'director-notes',schemaVersion:1,branchId:'parent-branch',notesHash:'parent-hash',mode:'full'},content:text('[导演笔记锚点·完整版本 parent-hash]\nBRANCH_LOCAL_NOTES')},'append')
  h.begin(1)
  const messages=await h.prepare(1)
  assert.equal(anchor(messages,'director-notes').source.mode,'full')
  assert.notEqual(anchor(messages,'director-notes').source.notesHash,'parent-hash')
 } finally {h.dispose()}
}
// The real checkpoint path replaces the anchors that introduce its first
// evicted player input. Inline maintenance must not displace selected prose
// when choosing the continuity tail.
{
 const h=await harness(()=>{throw new Error('no recall worker')})
 try {
  await h.table('branch').put(`${h.session.id}__settings`,{contextWindowTokens:1000,continuityTailTokens:2005})
  await h.table('branch').put('other-branch__settings',{contextWindowTokens:999999,continuityTailTokens:999999})
  h.services.set('compaction',{prepareForTurn:async()=>({status:'ready'}),directorNotes:()=>({text:'WINDOW_NOTES',generationId:'window-notes',sourceKeys:['1:a'],sourceSeqs:[1]}),ensureWindowCheckpoint:async()=>({status:'ready',branchId:h.session.id,generationId:'checkpoint',sourceKeys:[],sourceSeqs:[]})})
  const notes=h.append('user/message',{id:'old-notes',role:'user',source:{kind: 'roleplay-context',form:'director-notes',branchId:h.session.id,mode:'full'},content:text('OLD_WINDOW_NOTES')},'append')
  const state=h.append('user/message',{id:'old-state',role:'user',source:{kind: 'roleplay-context',form:'state',branchId:h.session.id,mode:'full'},content:text('OLD_WINDOW_STATE')},'append')
  h.append('turn/start',{turn:1})
  const oldUser=h.append('user/message',{id:'old-user',role:'user',source:{kind:'user'},content:text('OLD_PLAYER')},'append')
  const oldStory=h.append('assistant/message',{turn:1,message:{id:'old-story',content:text('S'.repeat(5000))}},'append')
  h.append('user/message',{id:'after-story',role:'user',source:{kind: 'roleplay-tasks',form:'phase',stage:'after-story',storySeq:oldStory.seq,turn:1},content:[]},'append')
  h.append('assistant/message',{turn:1,message:{id:'maintenance',content:text('M'.repeat(8000))}},'append')
  h.append('turn/end',{turn:1,reason:{kind:'completed'}})
  h.begin(2)
  await h.prepare(2)
  const checkpoint=h.session.events.find(event=>event.data?.source?.kind==='roleplay-context-window')
  assert.ok(checkpoint,'story pressure creates a real window checkpoint')
  assert.equal(checkpoint.surfaceOp.startSeq,notes.seq,'replacement starts at the first old-window anchor')
  assert.deepEqual(checkpoint.sourceEventSeqs.slice(0,2),[notes.seq,state.seq],'replacement provenance includes both old anchors')
  assert.ok(h.session.surface.nodes.includes(oldStory.seq),'maintenance output does not evict the selected prose tail')
  assert.ok(!h.session.surface.nodes.includes(notes.seq)&&!h.session.surface.nodes.includes(state.seq)&&!h.session.surface.nodes.includes(oldUser.seq),'old anchors and their first player input leave the hard window together')
 } finally {h.dispose()}
}
console.log('phase-a-memory=ok (zero model preparation, full direct notes, opt-in main-agent lore tools, checkpoint barrier)')

for (const mutate of [false,true]) {
 const h=await harness(()=>{}, {contextWindowEnabled:true,contextWindowTokens:1000,continuityTailTokens:1000})
 try {
  h.begin(1)
  const old=h.append('assistant/message',{turn:1,message:{id:'old-story',content:text('旧窗口完整正文。'.repeat(1000))}},'append')
  h.append('turn/end',{turn:1,reason:{kind:'completed'}})
  h.begin(2)
  h.append('assistant/message',{turn:2,message:{id:'tail-story',content:text('最新连续正文。'.repeat(1000))}},'append')
  h.append('turn/end',{turn:2,reason:{kind:'completed'}})
  let saved=false
  h.services.set('compaction',{
   directorNotes:()=>({text:saved?'NEW_CHECKPOINT_NOTES':'OLD_CHECKPOINT_NOTES'}),
   async ensureWindowCheckpoint(){saved=true;if(mutate)old.data.message.content=text('等待期间改写的正史');return {status:'ready',branchId:h.session.id,generationId:'saved',sourceKeys:['proof'],sourceSeqs:[old.seq]}}
  })
  h.begin(3)
  if(mutate) {
   await assert.rejects(h.prepare(3),/来源|窗口/)
   assert.equal(h.session.events.filter(e=>e.data?.source?.kind==='roleplay-context-window').length,0)
  } else {
   const messages=await h.prepare(3)
   const checkpoint=h.session.events.find(e=>e.data?.source?.kind==='roleplay-context-window')
   assert.equal(checkpoint.data.source.checkpointGeneration,'saved')
   assert.equal(checkpoint.data.source.schemaVersion,1)
   assert.match(hiddenText(messages),/NEW_CHECKPOINT_NOTES/)
   assert.doesNotMatch(hiddenText(messages),/OLD_CHECKPOINT_NOTES/)
  }
 } finally {h.dispose()}
}

// A cancelled or deleted branch cannot publish a late checkpoint. A storage
// failure preserves the append-only receipt but does not admit unprepared prose.
for (const failure of ['cancel','deleted','initial-write','window-write']) {
 const h=await harness(()=>{}, {contextWindowEnabled:true,contextWindowTokens:1000,continuityTailTokens:1000})
 const entered=deferred(),gate=deferred(),controller=new AbortController()
 try {
  const windowKey=`${h.session.id}__context-window`,branch=h.table('branch')
  const originalWindow={windowNumber:1,windowId:'original-window',previousWindowId:null,branchId:h.session.id,startSeq:-1,throughSeq:-1,rolloverCount:0}
  if(failure!=='initial-write')await branch.put(windowKey,originalWindow)
  for(const turn of [1,2]) {
   h.begin(turn)
   h.append('assistant/message',{turn,message:{id:`story-${turn}`,content:text('完整剧情正文。'.repeat(1000))}},'append')
   h.append('turn/end',{turn,reason:{kind:'completed'}})
  }
  h.services.set('compaction',{
   directorNotes:()=>({text:'VERIFIED_NOTES'}),
   async ensureWindowCheckpoint(){entered.resolve();await gate.promise;return {status:'ready',branchId:h.session.id,sourceKeys:[],sourceSeqs:[]}}
  })
  const put=branch.put.bind(branch)
  let failWrite=failure.endsWith('write')
  branch.put=async(key,value)=>{
   if(key===windowKey&&failWrite){failWrite=false;throw new Error('fixture window write failed')}
   return put(key,value)
  }
  h.begin(3)
  const pending=assert.rejects(h.prepare(3,undefined,controller.signal),failure==='cancel'?/fixture cancel/:failure==='deleted'?/分支已删除/:/fixture window write failed/)
  if(failure!=='initial-write') {
   await entered.promise
   if(failure==='cancel')controller.abort(new Error('fixture cancel'))
   if(failure==='deleted') {
    await branch.put(`fork-group-fixture-deleted`,{schemaVersion:2,groupId:'fixture-deleted',members:[{sessionId:h.session.id,assistantMessageId:'story-2',ordinal:1,deleted:true,playerVariantId:'player-1',playerOrdinal:1}],playerVariants:{'player-1':{text:'selected',revision:1}}})
    const hash=createHash('sha256').update('story-2').digest('hex').slice(0,24)
    await branch.put(`${h.session.id}__fork-anchor-${hash}`,{groupId:'fixture-deleted'})
   }
  }
  gate.resolve()
  await pending
  const receipts=h.session.events.filter(e=>e.data?.source?.kind==='roleplay-context-window')
  assert.equal(receipts.length,failure==='window-write'?1:0,`${failure}: only a failed post-append write leaves a durable receipt`)
  assert.deepEqual(branch.get(windowKey),failure==='initial-write'?undefined:originalWindow)
  assert.equal(branch.get(`${h.session.id}__task-preparation`).status,'preparing','failed preparation cannot admit prose')
  assert.equal(branch.get(`${h.session.id}__task-snapshot-3`),undefined)
  if(failure.endsWith('write')) {
   const messages=await h.prepare(3)
   assert.ok(messages.some(m=>m.source?.stage==='story'),'storage recovery can admit the original player turn')
   assert.equal(branch.get(`${h.session.id}__task-preparation`).status,'completed')
   if(failure==='window-write') {
    assert.deepEqual(h.session.events[receipts[0].seq],receipts[0],'retry never rewrites an already appended receipt')
    assert.equal(branch.get(windowKey).windowId,'original-window','a receipt alone does not imply a committed rollover')
    assert.equal(branch.get(`${h.session.id}__task-snapshot-3`).contextWindow.rollover,false)
   } else assert.equal(branch.get(windowKey).windowNumber,2)
  }
 } finally {gate.resolve();h.dispose()}
}

for(const failure of ['source-changed','cancel','ordinary']) {
 const h=await harness(()=>{}),controller=new AbortController()
 try {
  const error=Object.assign(new Error(`fixture prepare ${failure}`),{code:failure==='source-changed'?'ROLEPLAY_SOURCE_CHANGED':'FIXTURE'})
  h.services.set('compaction',{async prepareForTurn(){if(failure==='cancel')controller.abort(error);throw error}})
  h.begin(1)
  if(failure==='ordinary')assert.ok((await h.prepare(1,undefined,controller.signal)).some(m=>m.source?.stage==='story'))
  else {
   await assert.rejects(h.prepare(1,undefined,controller.signal),e=>e===error)
   assert.equal(h.table('branch').get(`${h.session.id}__task-snapshot-1`),undefined)
  }
 } finally {h.dispose()}
}

// Exercise the actual settings route and service callers, including historical
// invalid overrides and unsupported global records.
{
 const h=await harness(()=>{})
 try {
  const branch=h.table('branch'),fields=['contextWindowTokens','continuityTailTokens','autoNotesEveryTurns','targetContextTokens','archiveTokens']
  h.services.set('compaction',{settingsDefaults:()=>({autoNotesEveryTurns:4,targetContextTokens:6000,archiveTokens:7000})})
  await branch.put('memory-settings-global',{schemaVersion:1,settings:{contextWindowTokens:5000,continuityTailTokens:2000,autoNotesEveryTurns:6,targetContextTokens:8000,archiveTokens:9000,ignored:12}})
  await branch.put(`${h.session.id}__settings`,{contextWindowTokens:4500,continuityTailTokens:0,autoNotesEveryTurns:-1,targetContextTokens:'invalid',archiveTokens:11000,ignored:20})
  const response=await h.routes.get('/api/roleplay/memory-settings').fetch(new Request(`https://fixture.test/api/roleplay/memory-settings?sessionId=${h.session.id}`))
  assert.equal(response.status,200)
  const body=await response.json()
  assert.deepEqual(fields.map(f=>body.effective[f]),[4500,2000,6,8000,11000])
  assert.equal(body.global.settings.ignored,undefined)
  assert.equal(body.session.settings.ignored,undefined)
  assert.equal(h.services.get('roleplay').settings('other-session').contextWindowTokens,5000)
  await branch.put('memory-settings-global',{schemaVersion:2,settings:{}})
  const unsupported=await h.routes.get('/api/roleplay/memory-settings').fetch(new Request(`https://fixture.test/api/roleplay/memory-settings?sessionId=${h.session.id}`))
  assert.equal(unsupported.status,400)
  assert.match((await unsupported.json()).error,/不支持.*版本/)
 } finally {h.dispose()}
}

// An upgrade must not resume obsolete scene/recall jobs left by the old loop.
{
 const h=await harness(()=>{throw new Error('obsolete task must not run')})
 try {
  const job={schemaVersion:1,id:'legacy-recall',sessionId:h.session.id,branchId:h.session.id,
   generation:'old',kind:'memory',execution:'inline',status:'queued',source:{},input:{system:'你是记忆提取器。',format:'json'}}
  await h.table('branch').put('tavern_job__legacy-recall',job)
  h.begin(1)
  await h.prepare(1)
  assert.equal(h.table('branch').get('tavern_job__legacy-recall').status,'cancelled')
  assert.equal(h.calls.length,0)
 } finally {h.dispose()}
}
