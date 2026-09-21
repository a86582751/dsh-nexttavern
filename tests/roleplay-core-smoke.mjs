import assert from 'node:assert/strict'
import { createRoleplayInheritance } from '../lib/core/roleplay-inheritance.js'
import { createRoleplayService } from '../lib/core/roleplay-service.js'
import { mock } from 'node:test'
import { createHash } from 'node:crypto'
import { directorNotesForBranch, legacyCadenceSlots, memoryNotesCadence, selectedStoryHistory } from '../lib/memory/roleplay-memory-engine.js'
import { apply, recentWindowSince, readRoleplayActivity } from '../lib/core/roleplay-core.js'
import { recordSha256 } from '../lib/core/roleplay-data.js'
import { createConversationCatalog } from '../lib/core/tavern-conversations.js'

class Table extends Map {
  async put(key, value) { this.set(key, structuredClone(value)) }
  async delete(key) { return super.delete(key) }
  async update(key, fn) {
    if (!this.has(key)) throw new Error('missing-key')
    const next = fn(structuredClone(this.get(key)))
    this.set(key, structuredClone(next))
    return structuredClone(next)
  }
}

const tables = new Map()
const table = (name) => {
  if (!tables.has(name)) tables.set(name, new Table())
  return tables.get(name)
}
const domain = { table, close() {} }
table('rolls').set('legacy-session__log', [{ spec: '1d6', rolls: [4], total: 4, atSeq: 2 }])
const routes = new Map()
const tools = new Map()
const commands = new Map()
const services = new Map()
const sessions = new Map()
const persistedSessions = new Map()
const sessionEventObservers = []
const nexttavernMessageEdits = {
  append(session, targetSeq, identity, textValue) {
    return session.append('roleplay/message-edit', {
      schemaVersion: 1, targetSeq, ...identity, text: textValue,
    }, {surfaceOp: 'append'})
  },
  latest(events, targetSeq) {
    return [...events].reverse().find((event) =>
      event.type === 'roleplay/message-edit' && event.data?.targetSeq === targetSeq) ?? null
  },
  current(session, events) {
    const history = Array.isArray(session) ? session : events ?? session.events
    return history.filter((event) => event.type === 'roleplay/message-edit')
  },
}
const ctx = {
  storageDomain: { async open(options) {
    for (const [name, definition] of Object.entries(options?.tables ?? {})) {
      const current = table(name)
      for (const [key, value] of current.entries()) {
        current.set(key, structuredClone(definition.valueSchema.parse(structuredClone(value))))
      }
    }
    return domain
  } },
  sessions: { get(id) { return sessions.get(id) }, async flush() { return true } },
  nexttavernMessageEdits,
  sessionController: {
    async resolveAgent(id) {
      const session = sessions.get(id) ?? persistedSessions.get(id)
      if (!session) return { error: Object.assign(new Error('session not found'),{code:'session/not-found'}) }
      sessions.set(id, session)
      return { agent: { session } }
    },
  },
  llm: { async *stream() {} },
  tokenMeter: { measure() { return { nodes: [] } } },
  agentDefaultModel: { currentSelection() { return { provider: 'test', model: 'test' } } },
  systemPrompt: { variable() { return () => {} }, section() { return () => {} } },
  tools: { register(value) { tools.set(value.name, value); return () => {} } },
  commands: { register(value) { commands.set(value.name, value); return () => {} } },
  connection: { fetch: { register(value) { routes.set(value.path, value); return () => {} } } },
  logger: { info() {}, warn() {} },
  fs: {}, subagents: {},
  effect(fn) { return fn() },
  on(name, callback) { if (name === 'session/event') sessionEventObservers.push(callback); return () => {} },
  provide(name, value) { services.set(name, value) },
  get(name) { return services.get(name) },
}

const text = (value) => [{ type: 'text', text: value }]
const enableAppend = (session) => {
  session.surface.contentGeneration ??= 0
  session.append = (type, data, opts = {}) => {
    const event = {
      type, seq: session.events.length, time: Date.now(), data: structuredClone(data),
      surfaceOp: structuredClone(opts.surfaceOp), sourceEventSeqs: [...(opts.sourceEventSeqs ?? [])],
    }
    const op = opts.surfaceOp
    if (op && typeof op === 'object' && op.op === 'replace') {
      const start = session.surface.nodes.indexOf(op.startSeq)
      const end = session.surface.nodes.indexOf(op.endSeq)
      assert(start >= 0 && end >= start, 'invalid mock surface replacement')
      session.surface.nodes.splice(start, end - start + 1, event.seq)
    } else if (type === 'roleplay/message-edit') {
      session.surface.contentGeneration++
    } else {
      session.surface.nodes.push(event.seq)
    }
    session.events.push(event)
    session.seq = session.events.length
    return event
  }
  session.deriveEventMessage = (event) => {
    const edit = nexttavernMessageEdits.latest(session.events, event.seq)
    const message = event.type === 'assistant/message' ? event.data?.message : event.data
    if (!edit || !message || typeof message !== 'object') return message
    return {...message, content: text(edit.data.text)}
  }
  return session
}
const rootEvents = [
  { type: 'turn/start', seq: 0, data: { turn: 1 } },
  { type: 'user/message', seq: 1, data: { id: 'u1', content: text('原始玩家消息'), source: { kind: 'user' } }, surfaceOp: 'append' },
  { type: 'assistant/message', seq: 2, data: { turn: 1, message: { id: 'a1', content: text('原始回复') } }, surfaceOp: 'append' },
  { type: 'turn/end', seq: 3, data: { turn: 1, reason: { kind: 'completed' } } },
]
const root = enableAppend({ id: 'session-root', header: { agentPreset: 'roleplay' }, events: rootEvents, seq: 4, surface: { nodes: [1, 2] } })
const child = enableAppend({ id: 'session-child', header: { agentPreset: 'roleplay' }, events: [], seq: 0, surface: { nodes: [] } })
sessions.set(root.id, root)
sessions.set(child.id, child)
persistedSessions.set(root.id, root)
persistedSessions.set(child.id, child)

// A provider failure may leave a user message with no assistant response. The
// recovery branch must still prepare and register instead of reporting a dead
// archive.
const failedRoot = enableAppend({
  id: 'session-failed-root', header: { agentPreset: 'roleplay' },
  events: [
    { type: 'turn/start', seq: 0, data: { turn: 1 } },
    { type: 'user/message', seq: 1, data: { id: 'fu1', content: text('失败后重试'), source: { kind: 'user' } }, surfaceOp: 'append' },
    { type: 'turn/end', seq: 2, data: { turn: 1, reason: { kind: 'error', error: { message: 'upstream unavailable' } } } },
  ], seq: 3, surface: { nodes: [1] },
})
const failedChild = enableAppend({ id: 'session-failed-child', header: { agentPreset: 'roleplay' }, events: [], seq: 0, surface: { nodes: [] } })
sessions.set(failedRoot.id, failedRoot)
sessions.set(failedChild.id, failedChild)
persistedSessions.set(failedRoot.id, failedRoot)
persistedSessions.set(failedChild.id, failedChild)

// The hard-window projection is branch/surface scoped and never reads the
// immutable sibling log directly.  A boundary excludes earlier story entries
// while retaining the suffix in chronological order.
const windowFixture = enableAppend({
  id: 'session-window-fixture', header: { agentPreset: 'roleplay' }, seq: 7,
  events: [
    { type: 'turn/start', seq: 0, data: { turn: 1 } },
    { type: 'user/message', seq: 1, data: { id: 'wf-u1', content: text('old story'), source: { kind: 'user' } } },
    { type: 'assistant/message', seq: 2, data: { turn: 1, message: { id: 'wf-a1', content: text('old reply') } } },
    { type: 'turn/end', seq: 3, data: { turn: 1, reason: { kind: 'completed' } } },
    { type: 'turn/start', seq: 4, data: { turn: 2 } },
    { type: 'user/message', seq: 5, data: { id: 'wf-u2', content: text('new story'), source: { kind: 'user' } } },
    { type: 'assistant/message', seq: 6, data: { turn: 2, message: { id: 'wf-a2', content: text('new reply') } } },
  ],
  surface: { nodes: [1, 2, 5, 6] },
})
assert.match(recentWindowSince(windowFixture, 3, 1000), /new story[\s\S]*new reply/)
assert.doesNotMatch(recentWindowSince(windowFixture, 3, 1000), /old story|old reply/)

await apply(ctx, {})

{
 const session=enableAppend({id:'state-route-contract',header:{agentPreset:'roleplay'},events:[],seq:0,surface:{nodes:[]}})
 sessions.set(session.id,session)
 const request=(path,id=session.id)=>routes.get(path).fetch(new Request(`https://fixture.test${path}?sessionId=${encodeURIComponent(id)}`))
 for(const path of ['/api/roleplay/state','/api/roleplay/activity']){
  for(const id of ['missing-state-session','not-roleplay']){
   if(id==='not-roleplay')sessions.set(id,{id,header:{agentPreset:'other'},events:[],surface:{nodes:[]}})
   const response=await request(path,id)
   assert.equal(response.status,404);assert.match(response.headers.get('content-type'),/application\/json/);assert.equal((await response.json()).ok,false)
  }
 }
 const first=await request('/api/roleplay/state');assert.equal(first.status,200)
 table('cards').set(`${session.id}__sparse`,{})
 table('worldbook').set(`${session.id}__legacy`,{id:'legacy',name:'kept'})
 table('cards').set('foreign-state__card',{id:'foreign',content:'FOREIGN'})
 const pointer={importId:'unavailable',sourceRecordSessionId:'original-owner',extension:'keep'}
 table('branch').set(`${session.id}__import-active`,pointer)
 const snapshot=await (await request('/api/roleplay/state')).json()
 assert.deepEqual(snapshot.cardImport,pointer,'missing original import retains its source marker')
 assert.deepEqual(snapshot.recordVersions.cards,{sparse:recordSha256({})})
 assert.deepEqual(snapshot.recordVersions.worldbook,{legacy:recordSha256({id:'legacy',name:'kept'})})
 assert.deepEqual(snapshot.surfaceNodes,[]);assert.equal(snapshot.cards.length,1)
 table('cards').get('foreign-state__card').content='foreign edit'
 assert.deepEqual((await (await request('/api/roleplay/state')).json()).recordVersions,snapshot.recordVersions)
 const sourceKey='original-owner__import-unavailable'
 table('branch').set(sourceKey,{importId:'unavailable',schemaVersion:999})
 const corrupt=await request('/api/roleplay/state')
 assert.equal(corrupt.status,500);assert.match(corrupt.headers.get('content-type'),/application\/json/);assert.equal((await corrupt.json()).ok,false)
 table('branch').delete(sourceKey)
 const cards=table('cards'),entries=cards.entries
 try{
  cards.entries=()=>{throw Error('fixture state read failed')}
  const response=await request('/api/roleplay/state')
  assert.equal(response.status,500);assert.match((await response.json()).error,/fixture state read failed/)
 }finally{cards.entries=entries}
 const preparation={schemaVersion:1,sessionId:session.id,turn:1,status:'preparing',createdAt:50,messages:[{id:'queued',role:'user',source:{kind:'user'},content:text('queued input')}]}
 table('branch').set(`${session.id}__task-preparation`,preparation)
 session.events.push({seq:0,type:'turn/start',time:100,data:{turn:1}});session.seq=1
 const activity=await (await request('/api/roleplay/activity')).json()
 const expected=readRoleplayActivity(session,preparation,[],activity.observedAt)
 assert.deepEqual(activity,{ok:true,...expected},'activity route uses the same projection and deferred input as the runtime')
 assert.equal(activity.pendingPlayer.messageId,'queued')
}

{
 const fixture=enableAppend({id:'branch-index-scope',header:{agentPreset:'roleplay'},events:structuredClone(rootEvents),seq:4,surface:{nodes:[1,2]}})
 sessions.set(fixture.id,fixture)
 const unrelated=[]
 for(let i=0;i<100;i++){
  const key=`fork-group-unrelated-perf-${i}`
  unrelated.push(key)
  table('branch').set(key,{schemaVersion:2,groupId:key,rootSessionId:`unrelated-${i}`,
   anchor:{promptText:'unrelated'},members:[{sessionId:`unrelated-${i}`,ordinal:1,assistantMessageId:`reply-${i}`}],playerVariants:{}})
 }
 const originalClone=globalThis.structuredClone
 let unrelatedCopies=0
 globalThis.structuredClone=(value,...args)=>{
  if(String(value?.groupId??'').startsWith('fork-group-unrelated-perf-'))unrelatedCopies++
  return originalClone(value,...args)
 }
 try{
  const response=await routes.get('/api/roleplay/state').fetch(new Request(`https://fixture.test/api/roleplay/state?sessionId=${fixture.id}`))
  assert.equal(response.status,200)
  const state=await response.json()
  assert.equal(state.assistantActionAnchorsByTurn['1'].messageId,'a1','current story anchors survive scoped indexing')
  assert.equal(unrelatedCopies,0,'state reads must not hydrate unrelated conversation branch groups')
 }finally{
  globalThis.structuredClone=originalClone
  for(const key of unrelated)table('branch').delete(key)
  sessions.delete(fixture.id)
 }
}

// Chunk notifications must not materialize or scan the complete event log.
// Real long sessions contain hundreds of thousands of token events.
const streamingSession = { id: 'stream-no-history', get events() { throw new Error('stream event scanned history') } }
for (const type of ['assistant/chunk', 'step/start', 'step/end', 'user/message']) {
  for (const observe of sessionEventObservers) observe(streamingSession, { type, seq: 200000, data: {} })
}
assert.deepEqual(table('rolls').get('legacy-session__log'), {
  schemaVersion: 1,
  entries: [{ spec: '1d6', rolls: [4], total: 4, atSeq: 2 }],
  updatedAt: 0,
})
await table('cards').put('session-root__user', { id: 'user', name: '测试玩家', content: '完整人设', locked: true })
await table('worldbook').put('session-root__world', { id: 'world', name: '世界', content: '完整世界书', locked: true })

const callRoute = async (path, body) => {
  const handler = routes.get(path)
  assert(handler, `missing route ${path}`)
  const response = await handler.fetch(new Request(`https://example.test${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }))
  return { status: response.status, body: await response.json() }
}

const prepared = await callRoute('/api/roleplay/branch', {
  action: 'prepare', sessionId: root.id, messageId: 'a1', kind: 'regenerate',
})
assert.equal(prepared.status, 200)
assert.equal(prepared.body.promptText, '原始玩家消息')
assert.equal(prepared.body.previousTurnEndSeq, null)

// A historical maintenance failure has a committed story even though the
// official failed turn-tail has no closing messageId. Recover its own anchor.
{
 const s=enableAppend({id:'historical-maintenance-error',header:{agentPreset:'roleplay'},events:[
  {seq:0,type:'turn/start',data:{turn:4}},
  {seq:1,type:'user/message',data:{id:'u-old',source:{kind:'user'},content:text('打开档案')}},
  {seq:2,type:'assistant/message',data:{turn:4,message:{id:'old-canon',content:text('档案已打开')}}},
  {seq:3,type:'user/message',data:{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'after-story',storySeq:2,turn:4},content:text('维护')}},
  {seq:4,type:'assistant/message',data:{turn:4,message:{id:'old-maintenance',content:text('记忆结果')}}},
  {seq:5,type:'turn/end',data:{turn:4,reason:{kind:'error'}}},
  {seq:6,type:'turn/start',data:{turn:5}},
  {seq:7,type:'user/message',data:{id:'u-next',source:{kind:'user'},content:text('继续等待')}},
  {seq:8,type:'assistant/message',data:{turn:5,message:{id:'new-canon',content:text('继续等待的结果')}}},
  {seq:9,type:'turn/end',data:{turn:5,reason:{kind:'completed'}}},
 ],seq:10,surface:{nodes:[1,2,3,4,7,8]}})
 sessions.set(s.id,s)
 const state=await (await routes.get('/api/roleplay/state').fetch(new Request('https://fixture.test/api/roleplay/state?sessionId='+s.id))).json()
 assert.deepEqual(state.assistantActionAnchorsByTurn?.['4'],{seq:2,messageId:'old-canon'})
 assert.equal(state.failedTurnRecoveryByTurn?.['4'],undefined,'committed prose uses its real anchor, not empty-turn recovery')
 const retry=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:s.id,messageId:state.assistantActionAnchorsByTurn['4'].messageId,kind:'regenerate'})
 assert.equal(retry.status,200)
 assert.equal(retry.body.promptText,'打开档案','old error cannot replay the later player input')
 for(const kind of ['regenerate','player-edit']){
  const fromPlayer=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:s.id,userSeq:1,kind})
  assert.equal(fromPlayer.status,200,'player anchor must select prose before the maintenance reply: '+kind)
  assert.equal(fromPlayer.body.promptText,'打开档案')
 }
 const invalid=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:s.id,messageId:'old-maintenance',kind:'regenerate'})
 assert.equal(invalid.status,400,'maintenance output is not a story branch target')
}

const failedPrepared = await callRoute('/api/roleplay/branch', {
  action: 'prepare', sessionId: failedRoot.id, userSeq: 1, kind: 'player-edit',
})
assert.equal(failedPrepared.status, 200)
assert.equal(failedPrepared.body.recoveryOnly, true)
assert.equal(failedPrepared.body.promptText, '失败后重试')
const failedRegistered = await callRoute('/api/roleplay/branch', {
  action: 'register', operationId: failedPrepared.body.operationId,
  childSessionId: failedChild.id, requestId: 'req-failed-1', promptText: '修正后的失败轮次',
})
assert.equal(failedRegistered.status, 200, JSON.stringify(failedRegistered.body))
assert.equal(failedRegistered.body.total, 2, 'first recovery keeps the proven failed source as version one')
assert.equal(failedRegistered.body.playerTotal, 2, 'player-edit recovery creates a distinct edited player variant')
const failedRecoveryGroup = table('branch').get(`fork-group-${failedRegistered.body.groupId}`)
assert.equal(failedRecoveryGroup.members.length, 2)
const failedOriginal = failedRecoveryGroup.members.find(member => member.kind === 'original')
const failedEdited = failedRecoveryGroup.members.find(member => member.operationId === failedPrepared.body.operationId)
assert.equal(failedOriginal.sessionId, failedRoot.id)
assert.equal(failedOriginal.promptText, '失败后重试')
assert.equal(failedRecoveryGroup.playerVariants[failedOriginal.playerVariantId].text, '失败后重试')
assert.notEqual(failedOriginal.playerVariantId, failedEdited.playerVariantId)
assert.equal(failedRecoveryGroup.playerVariants[failedEdited.playerVariantId].text, '修正后的失败轮次')
const failedRegenerate = await callRoute('/api/roleplay/branch', {
  action: 'prepare', sessionId: failedRoot.id, userSeq: 1, kind: 'regenerate',
})
assert.equal(failedRegenerate.status, 200)
assert.equal(failedRegenerate.body.recoveryOnly, true)

// A restarted Host can find an old recovery group that recorded only the
// child.  The next valid recovery restores the source without renumbering it.
{
 const legacyGroupId = 'g-recovery-legacy-source'
 const legacySource = enableAppend({
  id: 'legacy-recovery-source', header: { agentPreset: 'roleplay' },
  events: [
   { type: 'turn/start', seq: 0, data: { turn: 1 } },
   { type: 'user/message', seq: 1, data: { id: 'legacy-user', content: text('旧失败原文'), source: { kind: 'user' } }, surfaceOp: 'append' },
   { type: 'turn/end', seq: 2, data: { turn: 1, reason: { kind: 'error' } } },
  ], seq: 3, surface: { nodes: [1] },
 })
 const legacyChild = enableAppend({ id: 'legacy-recovery-child', header: { agentPreset: 'roleplay' }, events: [], seq: 0, surface: { nodes: [] } })
 sessions.set(legacySource.id, legacySource); sessions.set(legacyChild.id, legacyChild)
 await table('branch').put(`fork-group-${legacyGroupId}`, {
  schemaVersion: 2, groupId: legacyGroupId, rootSessionId: legacySource.id,
  anchor: { sourceSessionId: legacySource.id, sourceUserMessageId: 'legacy-user', sourceUserSeq: 1, sourceTurn: 1, previousTurnEndSeq: null, expectedSeedLength: 0, promptText: '旧失败原文', recoveryOnly: true },
  members: [{ sessionId: 'legacy-old-child', operationId: 'legacy-old-operation', ordinal: 1, kind: 'regenerate', promptText: '旧失败原文', playerVariantId: `${legacyGroupId}:player:1`, playerOrdinal: 1, deleted: false, pending: false, failed: true }],
  playerVariants: { [`${legacyGroupId}:player:1`]: { text: '旧失败原文', revision: 1 } },
 })
 const legacyPrepared = await callRoute('/api/roleplay/branch', { action: 'prepare', sessionId: legacySource.id, userSeq: 1, kind: 'regenerate' })
 // Force the deterministic recovery group to model a persisted historical record.
 const legacyOperation = table('branch').get(`fork-op-${legacyPrepared.body.operationId}`)
 legacyOperation.groupId = legacyGroupId
 await table('branch').put(`fork-op-${legacyPrepared.body.operationId}`, legacyOperation)
 // The recovery registry chooses its deterministic group; provide it under that key too.
 const deterministic = `g-recovery-${createHash('sha256').update(`${legacySource.id}\0${1}`).digest('hex').slice(0, 32)}`
 await table('branch').put(`fork-group-${deterministic}`, { ...table('branch').get(`fork-group-${legacyGroupId}`), groupId: deterministic })
 await table('branch').delete(`fork-group-${legacyGroupId}`)
 const legacyState = await (await routes.get('/api/roleplay/state').fetch(new Request(`https://local.test/api/roleplay/state?sessionId=${legacySource.id}`))).json()
 assert.equal(legacyState.failedTurnRecoveryByTurn?.['1'], 1)
 assert.equal(table('branch').get(`fork-group-${deterministic}`).members.find(member => member.kind === 'original').ordinal, 0, 'state read repairs a uniquely proven historical recovery source')
 const legacyRegistered = await callRoute('/api/roleplay/branch', { action: 'register', operationId: legacyPrepared.body.operationId, childSessionId: legacyChild.id, requestId: 'legacy-recovery-request', promptText: '旧失败原文' })
 assert.equal(legacyRegistered.status, 200, JSON.stringify(legacyRegistered.body))
 const repaired = table('branch').get(`fork-group-${legacyRegistered.body.groupId}`)
 assert.equal(repaired.members.find(member => member.operationId === 'legacy-old-operation').ordinal, 1, 'legacy child ordinal is preserved')
 assert.equal(repaired.members.find(member => member.kind === 'original').ordinal, 0, 'repaired source is inserted before legacy children without renumbering')
 sessions.delete(legacySource.id); sessions.delete(legacyChild.id)
}

// A failed model may have emitted a partial assistant. It is not a completed
// story anchor, but the same failed turn must retain retry and worldline paging.
{
 const failed=enableAppend({id:'failed-partial-worldline',header:{agentPreset:'roleplay'},events:[
  {seq:0,type:'turn/start',data:{turn:7}},
  {seq:1,type:'user/message',data:{id:'failed-player',content:text('编辑后的失败输入'),source:{kind:'user',rpcId:'failed-rpc'}},surfaceOp:'append'},
  {seq:2,type:'assistant/message',data:{turn:7,step:1,interrupted:true,message:{id:'partial-output',content:text('尚未完成')}},surfaceOp:'append'},
  {seq:3,type:'turn/end',data:{turn:7,reason:{kind:'error',error:{message:'transport closed'}}}},
 ],seq:4,surface:{nodes:[1,2]}})
 sessions.set(failed.id,failed)
await table('branch').put('fork-group-failed-pager',{schemaVersion:2,groupId:'failed-pager',members:[
  {sessionId:root.id,ordinal:1,assistantMessageId:'a1',deleted:false,playerVariantId:'failed-pager:player:1',playerOrdinal:1},
  {sessionId:failed.id,ordinal:2,kind:'player-edit-send',requestId:'failed-rpc',failed:true,deleted:true,pending:false,assistantMessageId:null,playerVariantId:'failed-pager:player:2',playerOrdinal:2,failureReason:'turn 7 未以 completed 正常结束'},
],playerVariants:{'failed-pager:player:1':{text:'原玩家输入',revision:1},'failed-pager:player:2':{text:'编辑后的失败输入',revision:1}}})
 const response=await routes.get('/api/roleplay/state').fetch(new Request('https://local.test/api/roleplay/state?sessionId='+failed.id))
 const state=await response.json()
 assert.equal(state.failedTurnRecoveryByTurn?.['7'],1,'partial assistant does not hide failed-turn recovery')
assert.equal(state.failedTurnBranchGroupByTurn?.['7']?.currentOrdinal,1)
assert.equal(state.failedTurnBranchGroupByTurn?.['7']?.total,1,'a failed edited player variant starts with its own 1/1 recovery pager')
assert.equal(state.failedTurnBranchGroupByTurn?.['7']?.members[0]?.sessionId,failed.id)
 const retry=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:failed.id,userSeq:1,kind:'regenerate'})
 assert.equal(retry.status,200,JSON.stringify(retry.body))
 assert.equal(retry.body.recoveryOnly,true,'partial failure replays its player input in a clean worldline')
 failed.header={...failed.header,parentSession:root.id,seedLength:1}
 const legacy=table('branch').get('fork-group-failed-pager')
 Object.assign(legacy.members[1],{requestId:'old-transport-id',pending:true,failed:false,deleted:false})
 await table('branch').put('fork-group-failed-pager',legacy)
 const legacyState=await (await routes.get('/api/roleplay/state').fetch(new Request('https://local.test/api/roleplay/state?sessionId='+failed.id))).json()
assert.equal(legacyState.failedTurnBranchGroupByTurn?.['7']?.total,1,'first post-seed failed edited input keeps only its own pager despite an old transport ID')
 const recoveredChild=enableAppend({id:'recovered-legacy-pending',header:{agentPreset:'roleplay',parentSession:failed.id,seedLength:0},events:[],seq:0,surface:{nodes:[]}})
 sessions.set(recoveredChild.id,recoveredChild)
 const registeredRetry=await callRoute('/api/roleplay/branch',{action:'register',operationId:retry.body.operationId,childSessionId:recoveredChild.id,requestId:'new-retry-rpc',promptText:'编辑后的失败输入'})
 assert.equal(registeredRetry.status,200,JSON.stringify(registeredRetry.body))
 assert.equal(registeredRetry.body.groupId,'failed-pager','retry preserves existing alternate worldlines')
 assert.equal(registeredRetry.body.total,3,'a failed child already in the group is never copied as a new original member')
 const editedRecoveredChild=enableAppend({id:'recovered-legacy-edit',header:{agentPreset:'roleplay',parentSession:failed.id,seedLength:0},events:[],seq:0,surface:{nodes:[]}})
 sessions.set(editedRecoveredChild.id,editedRecoveredChild)
 const editRetry=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:failed.id,userSeq:1,kind:'player-edit'})
 assert.equal(editRetry.status,200,JSON.stringify(editRetry.body))
 const registeredEditRetry=await callRoute('/api/roleplay/branch',{action:'register',operationId:editRetry.body.operationId,childSessionId:editedRecoveredChild.id,requestId:'new-edit-rpc',promptText:'改写后的失败输入'})
 assert.equal(registeredEditRetry.status,200,JSON.stringify(registeredEditRetry.body))
 assert.equal(registeredEditRetry.body.groupId,'failed-pager','player-edit from an existing failed child remains in its recovery group')
 const editedRecoveryGroup=table('branch').get('fork-group-failed-pager')
 const sourceRecoveryMember=editedRecoveryGroup.members.find(member=>member.sessionId===failed.id)
 const editRecoveryMember=editedRecoveryGroup.members.find(member=>member.operationId===editRetry.body.operationId)
 assert.equal(editedRecoveryGroup.playerVariants[sourceRecoveryMember.playerVariantId].text,'编辑后的失败输入')
 assert.equal(editedRecoveryGroup.playerVariants[editRecoveryMember.playerVariantId].text,'改写后的失败输入')
 const secondRecoveredChild=enableAppend({id:'recovered-legacy-pending-2',header:{agentPreset:'roleplay',parentSession:failed.id,seedLength:0},events:[],seq:0,surface:{nodes:[]}})
 sessions.set(secondRecoveredChild.id,secondRecoveredChild)
 const retryAgain=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:failed.id,userSeq:1,kind:'regenerate'})
 assert.equal(retryAgain.status,200,JSON.stringify(retryAgain.body))
 const registeredRetryAgain=await callRoute('/api/roleplay/branch',{action:'register',operationId:retryAgain.body.operationId,childSessionId:secondRecoveredChild.id,requestId:'new-retry-rpc-2',promptText:'编辑后的失败输入'})
 assert.equal(registeredRetryAgain.status,200,JSON.stringify(registeredRetryAgain.body))
 const repeatedSourceGroup=table('branch').get('fork-group-failed-pager')
 assert.equal(registeredRetryAgain.body.total,5,'each retry adds only its new child')
 assert.equal(repeatedSourceGroup.members.filter(member=>member.sessionId===failed.id).length,1,'the same failed source has exactly one membership across repeated regeneration')
 sessions.delete(recoveredChild.id)
 sessions.delete(editedRecoveredChild.id)
 sessions.delete(secondRecoveredChild.id)
 await table('branch').delete('fork-group-failed-pager')
 sessions.delete(failed.id)
}

const registered = await callRoute('/api/roleplay/branch', {
  action: 'register', operationId: prepared.body.operationId,
  childSessionId: child.id, requestId: 'req-regen-1', promptText: '原始玩家消息',
})
assert.equal(registered.status, 200, JSON.stringify(registered.body))
assert.equal(registered.body.total, 2)
assert.equal(table('cards').get('session-child__user').content, '完整人设')
assert.equal(table('worldbook').get('session-child__world').content, '完整世界书')
const pendingOperation = await callRoute('/api/roleplay/branch', {
  action: 'operation-status', operationId: prepared.body.operationId,
})
assert.equal(pendingOperation.body.status, 'pending')
assert.equal(pendingOperation.body.registered, true)
assert.equal(pendingOperation.body.requestAccepted, false)

child.events.push(
  { type: 'turn/start', seq: 0, data: { turn: 1 } },
  { type: 'user/message', seq: 1, data: { id: 'u2', content: text('原始玩家消息'), source: { kind: 'user', rpcId: 'req-regen-1' } }, surfaceOp: 'append' },
  { type: 'assistant/message', seq: 2, data: { turn: 1, message: { id: 'a2', content: text('新分支回复') } }, surfaceOp: 'append' },
  { type: 'turn/end', seq: 3, data: { turn: 1, reason: { kind: 'completed' } } },
)
child.seq = 4
child.surface.nodes = [1, 2]

const stateRoute = routes.get('/api/roleplay/state')
// Reader can be the first view restored after a Host restart. In that case the
// Session exists durably but is absent from the live registry; the route must
// resume it through sessionController rather than returning a permanent 404.
sessions.delete(child.id)
const stateResponse = await stateRoute.fetch(new Request('https://example.test/api/roleplay/state?sessionId=session-child'))
const state = await stateResponse.json()
assert.equal(sessions.get(child.id), child)
assert.equal(state.ok, true)
assert.equal(state.branchGroupsByMessageId.a2.currentOrdinal, 2)
assert.equal(state.branchGroupsByMessageId.a2.total, 2)
assert.deepEqual(state.branchGroupsByMessageId.a2.members.map((member) => member.sessionId), ['session-root', 'session-child'])
assert.equal(state.userActionsBySeq['1'].group.currentOrdinal, 1)
assert.equal(state.userActionsBySeq['1'].group.total, 1)
const completedOperation = await callRoute('/api/roleplay/branch', {
  action: 'operation-status', operationId: prepared.body.operationId,
})
assert.equal(completedOperation.body.status, 'completed')
assert.equal(completedOperation.body.requestAccepted, true)

// Saving a player edit is a surface replacement, not a new branch.  Every
// loaded assistant version receives the edit immediately; cold siblings keep
// only canonical ledger metadata and reconcile lazily when activated.
sessions.delete(root.id)
const savedUser = await callRoute('/api/roleplay/branch', {
  action: 'replace-message', sessionId: child.id, role: 'user', seq: 1, text: '原地修改后的玩家消息',
})
assert.equal(savedUser.status, 200)
assert.equal(savedUser.body.changed, 1)
assert.equal(savedUser.body.matched, 1)
assert.equal(root.events[root.surface.nodes[0]].data.content[0].text, '原始玩家消息')
assert.equal(child.deriveEventMessage(child.events[child.surface.nodes[0]]).content[0].text, '原地修改后的玩家消息')
assert.equal(child.events[child.surface.nodes[0]].data.id, 'u2')
assert.deepEqual(child.events[child.surface.nodes[0]].data.source, { kind: 'user', rpcId: 'req-regen-1' })
assert.equal(child.surface.nodes[1], 2, 'saving the player message must retain the following Agent surface')
sessions.set(root.id, root)
const coldRootStateResponse = await stateRoute.fetch(new Request('https://example.test/api/roleplay/state?sessionId=session-root'))
assert.equal(coldRootStateResponse.status, 200)
assert.equal(root.deriveEventMessage(root.events[root.surface.nodes[0]]).content[0].text, '原地修改后的玩家消息')
assert.equal(root.events[root.surface.nodes[0]].data.id, 'u1')
assert.notEqual(root.events[root.surface.nodes[0]].data.id, child.events[child.surface.nodes[0]].data.id)
const editedChildStateResponse = await stateRoute.fetch(new Request('https://example.test/api/roleplay/state?sessionId=session-child'))
const editedChildState = await editedChildStateResponse.json()
assert.equal(editedChildState.userActionsBySeq['1'].assistantMessageId, 'a2', 'the append-origin UI seq must remain actionable')
assert.equal(editedChildState.userActionsBySeq[String(child.surface.nodes[0])].assistantMessageId, 'a2')
const replayedUserSave = await callRoute('/api/roleplay/branch', {
  action: 'replace-message', sessionId: child.id, role: 'user', seq: 1, text: '原地修改后的玩家消息',
})
assert.equal(replayedUserSave.status, 200)
assert.equal(replayedUserSave.body.changed, 0)
assert.equal(replayedUserSave.body.matched, 2)
assert.equal(replayedUserSave.body.replayed, true)

const editedAssistant = await callRoute('/api/roleplay/branch', {
  action: 'replace-message', sessionId: child.id, role: 'assistant', messageId: 'a2', text: '人工修订后的回复',
})
assert.equal(editedAssistant.status, 200)
assert.equal(child.deriveEventMessage(child.events[child.surface.nodes[1]]).content[0].text, '人工修订后的回复')

// A later descendant inherits this reply without becoming a direct member of
// its group. Canonical player text must reconcile onto that cold projection;
// editing the inherited player message patches the current surface and direct
// siblings, while inherited Agent text is deliberately read-only until the
// user switches to its owning branch Session.
const descendant = enableAppend({
  id: 'session-descendant',
  header: { agentPreset: 'roleplay', parentSession: child.id, seedLength: 4 },
  events: structuredClone(child.events.slice(0, 4)),
  seq: 4,
  surface: { nodes: [1, 2] },
})
sessions.set(descendant.id, descendant)
const descendantStateResponse = await stateRoute.fetch(new Request('https://example.test/api/roleplay/state?sessionId=session-descendant'))
const descendantState = await descendantStateResponse.json()
assert.equal(descendant.deriveEventMessage(descendant.events[descendant.surface.nodes[0]]).content[0].text, '原地修改后的玩家消息')
assert.deepEqual(descendantState.inheritedAssistantMessageIds, ['a2'])
const descendantUserSeq = descendant.surface.nodes[0]
const descendantSave = await callRoute('/api/roleplay/branch', {
  action: 'replace-message', sessionId: descendant.id, role: 'user', seq: descendantUserSeq,
  text: '继承分支再次修改的玩家消息',
})
assert.equal(descendantSave.status, 200)
assert.equal(descendant.deriveEventMessage(descendant.events[descendant.surface.nodes[0]]).content[0].text, '继承分支再次修改的玩家消息')
assert.equal(root.deriveEventMessage(root.events[root.surface.nodes[0]]).content[0].text, '继承分支再次修改的玩家消息')
assert.equal(child.deriveEventMessage(child.events[child.surface.nodes[0]]).content[0].text, '继承分支再次修改的玩家消息')
const childMemberBeforeInheritedEdit = [...table('branch').values()]
  .find((value) => value?.groupId && value?.members?.some((member) => member.sessionId === child.id))?.members
  .find((member) => member.sessionId === child.id)
const inheritedAssistantEdit = await callRoute('/api/roleplay/branch', {
  action: 'replace-message', sessionId: descendant.id, role: 'assistant', messageId: 'a2', text: '不应静默分叉的历史编辑',
})
assert.equal(inheritedAssistantEdit.status, 500)
const childMemberAfterInheritedEdit = [...table('branch').values()]
  .find((value) => value?.groupId && value?.members?.some((member) => member.sessionId === child.id))?.members
  .find((member) => member.sessionId === child.id)
if (childMemberBeforeInheritedEdit && childMemberAfterInheritedEdit) {
  assert.equal(childMemberAfterInheritedEdit.assistantSeq, childMemberBeforeInheritedEdit.assistantSeq)
}

const deleted = await callRoute('/api/roleplay/branch', {
  action: 'delete', sessionId: child.id, messageId: 'a2',
})
assert.equal(deleted.status, 200)
assert.equal(deleted.body.remaining, 1)
assert.equal(deleted.body.nextSessionId, root.id)
const replayedDelete = await callRoute('/api/roleplay/branch', {
  action: 'delete', sessionId: child.id, messageId: 'a2',
})
assert.equal(replayedDelete.status, 200)
assert.equal(replayedDelete.body.alreadyDeleted, true)
assert.equal(replayedDelete.body.nextSessionId, root.id)
const deletedStateResponse = await stateRoute.fetch(new Request('https://example.test/api/roleplay/state?sessionId=session-child'))
const deletedState = await deletedStateResponse.json()
assert.deepEqual(deletedState.deletedBranchMessageIds, ['a2'])

// A later-turn native fork must cut at the previous turn/end and inherit only
// memory facts at or before the child's seedLength.
const laterEvents = [
  { type: 'turn/start', seq: 0, data: { turn: 1 } },
  { type: 'user/message', seq: 1, data: { id: 'lu1', content: text('第一轮'), source: { kind: 'user' } }, surfaceOp: 'append' },
  { type: 'assistant/message', seq: 2, data: { turn: 1, message: { id: 'la1', content: text('第一轮回复') } }, surfaceOp: 'append' },
  { type: 'turn/end', seq: 3, data: { turn: 1, reason: { kind: 'completed' } } },
  { type: 'turn/start', seq: 4, data: { turn: 2 } },
  { type: 'user/message', seq: 5, data: { id: 'lu2', content: text('第二轮'), source: { kind: 'user' } }, surfaceOp: 'append' },
  { type: 'assistant/message', seq: 6, data: { turn: 2, message: { id: 'la2', content: text('第二轮回复') } }, surfaceOp: 'append' },
  { type: 'turn/end', seq: 7, data: { turn: 2, reason: { kind: 'completed' } } },
]
const later = enableAppend({ id: 'session-later', header: { agentPreset: 'roleplay' }, events: laterEvents, seq: 8, surface: { nodes: [1, 2, 5, 6] } })
const laterChild = enableAppend({ id: 'session-later-child', header: { agentPreset: 'roleplay', parentSession: later.id, seedLength: 4 }, events: [], seq: 0, surface: { nodes: [] } })
sessions.set(later.id, later)
sessions.set(laterChild.id, laterChild)
await table('cards').put('session-later__user', { id: 'user', name: '玩家', content: '设定' })
await table('memory').put('session-later__head', {
  summary: '分叉点之前的摘要', version: 3,
  deltas: [{ atSeq: 2, summary: '保留' }, { atSeq: 6, summary: '不得泄漏' }],
  pendingConfirmations: [{ evidenceSeq: 2, claim: '保留' }, { evidenceSeq: 6, claim: '不得泄漏' }],
  archives: [],
})
const laterPrepared = await callRoute('/api/roleplay/branch', {
  action: 'prepare', sessionId: later.id, messageId: 'la2', kind: 'edit',
})
assert.equal(laterPrepared.body.previousTurnEndSeq, 3)
const laterRegistered = await callRoute('/api/roleplay/branch', {
  action: 'register', operationId: laterPrepared.body.operationId,
  childSessionId: laterChild.id, requestId: 'req-edit-2', promptText: '修改后的第二轮',
})
assert.equal(laterRegistered.status, 200)
assert.equal(laterRegistered.body.playerTotal, 2)
assert.deepEqual(table('memory').get('session-later-child__head').deltas.map((item) => item.summary), ['保留'])
assert.deepEqual(table('memory').get('session-later-child__head').pendingConfirmations.map((item) => item.claim), ['保留'])
laterChild.events = [
  ...structuredClone(later.events.slice(0, 4)),
  { type: 'turn/start', seq: 4, data: { turn: 2 } },
  { type: 'user/message', seq: 5, data: { id: 'lu2-edited', content: text('修改后的第二轮'), source: { kind: 'user', rpcId: 'req-edit-2' } }, surfaceOp: 'append' },
  { type: 'assistant/message', seq: 6, data: { turn: 2, message: { id: 'la2-edited', content: text('修改消息产生的回复') } }, surfaceOp: 'append' },
  { type: 'turn/end', seq: 7, data: { turn: 2, reason: { kind: 'completed' } } },
]
laterChild.seq = 8
laterChild.surface.nodes = [1, 2, 5, 6]
const playerEditStateResponse = await stateRoute.fetch(new Request('https://example.test/api/roleplay/state?sessionId=session-later-child'))
const playerEditState = await playerEditStateResponse.json()
assert.equal(playerEditState.userActionsBySeq['5'].group.currentOrdinal, 2)
assert.equal(playerEditState.userActionsBySeq['5'].group.total, 2)
assert.equal(playerEditState.branchGroupsByMessageId['la2-edited'].currentOrdinal, 1)
assert.equal(playerEditState.branchGroupsByMessageId['la2-edited'].total, 1,'a new player variant begins its own assistant pager')
const originalPlayerStateResponse = await stateRoute.fetch(new Request('https://example.test/api/roleplay/state?sessionId=session-later'))
const originalPlayerState = await originalPlayerStateResponse.json()
assert.equal(originalPlayerState.branchGroupsByMessageId['la2'].total, 1,'the older player variant retains its own assistant reply')

const regenAfterPlayerEdit = await callRoute('/api/roleplay/branch', {
  action: 'prepare', sessionId: laterChild.id, messageId: 'la2-edited', kind: 'regenerate',
})
const laterRegen = enableAppend({
  id: 'session-later-regen',
  header: { agentPreset: 'roleplay', parentSession: laterChild.id, seedLength: 4 },
  events: structuredClone(laterChild.events.slice(0, 4)), seq: 4, surface: { nodes: [1, 2] },
})
sessions.set(laterRegen.id, laterRegen)
const regenRegistered = await callRoute('/api/roleplay/branch', {
  action: 'register', operationId: regenAfterPlayerEdit.body.operationId,
  childSessionId: laterRegen.id, requestId: 'req-regen-after-edit', promptText: '修改后的第二轮',
})
assert.equal(regenRegistered.body.playerTotal, 2)
assert.equal(regenRegistered.body.total, 3)
laterRegen.events.push(
  { type: 'turn/start', seq: 4, data: { turn: 2 } },
  { type: 'user/message', seq: 5, data: { id: 'lu2-regen', content: text('修改后的第二轮'), source: { kind: 'user', rpcId: 'req-regen-after-edit' } }, surfaceOp: 'append' },
  { type: 'assistant/message', seq: 6, data: { turn: 2, message: { id: 'la2-regen', content: text('同一玩家消息的重生回复') } }, surfaceOp: 'append' },
  { type: 'turn/end', seq: 7, data: { turn: 2, reason: { kind: 'completed' } } },
)
laterRegen.seq = 8
laterRegen.surface.nodes = [1, 2, 5, 6]
const regenStateResponse = await stateRoute.fetch(new Request('https://example.test/api/roleplay/state?sessionId=session-later-regen'))
const regenState = await regenStateResponse.json()
assert.equal(regenState.userActionsBySeq['5'].group.currentOrdinal, 2)
assert.equal(regenState.userActionsBySeq['5'].group.total, 2)
assert.equal(regenState.branchGroupsByMessageId['la2-regen'].currentOrdinal, 2)
assert.equal(regenState.branchGroupsByMessageId['la2-regen'].total, 2)

const truncatedChild = enableAppend({
  id: 'session-truncated-child',
  header: { agentPreset: 'roleplay', parentSession: later.id, seedLength: 4 },
  events: [], seq: 0, surface: { nodes: [] },
})
sessions.set(truncatedChild.id, truncatedChild)
const truncatePrepared = await callRoute('/api/roleplay/branch', {
  action: 'prepare', sessionId: later.id, messageId: 'la2', kind: 'delete-user',
})
const truncateRegistered = await callRoute('/api/roleplay/branch', {
  action: 'register', operationId: truncatePrepared.body.operationId,
  childSessionId: truncatedChild.id, promptText: '',
})
assert.equal(truncateRegistered.status, 200)
assert.equal(truncateRegistered.body.truncated, true)
const truncateStatus = await callRoute('/api/roleplay/branch', {
  action: 'operation-status', operationId: truncatePrepared.body.operationId,
})
assert.equal(truncateStatus.body.status, 'completed')
assert.equal(truncateStatus.body.registered, true)

// Exact OpenWebUI-style contract: Save replaces the current player surface
// without creating a player variant. Regenerating that unchanged player turn
// then creates assistant 2/2 while the player pager remains 1/1.
const saveRoot = enableAppend({
  id: 'session-save-root', header: { agentPreset: 'roleplay' }, seq: 4,
  events: [
    { type: 'turn/start', seq: 0, data: { turn: 1 } },
    { type: 'user/message', seq: 1, data: { id: 'save-u1', content: text('无名客笑了一下'), source: { kind: 'user' } }, surfaceOp: 'append' },
    { type: 'assistant/message', seq: 2, data: { turn: 1, message: { id: 'save-a1', content: text('原回复') } }, surfaceOp: 'append' },
    { type: 'turn/end', seq: 3, data: { turn: 1, reason: { kind: 'completed' } } },
  ],
  surface: { nodes: [1, 2] },
})
const saveRegen = enableAppend({
  id: 'session-save-regen',
  // First-turn alternatives are created as fresh blank Sessions; later turns
  // use the native parentSession/seedLength fork contract.
  header: { agentPreset: 'roleplay' },
  events: [{seq:0,type:'sandbox/mode',data:{}},{seq:1,type:'approval/policy',data:{}}], seq: 2, surface: { nodes: [] },
})
sessions.set(saveRoot.id, saveRoot)
sessions.set(saveRegen.id, saveRegen)
const saveOnly = await callRoute('/api/roleplay/branch', {
  action: 'replace-message', sessionId: saveRoot.id, role: 'user', seq: 1, text: '无名客很生气',
})
assert.equal(saveOnly.status, 200)
assert.equal(saveOnly.body.changed, 1)
assert.equal(saveRoot.events[saveRoot.surface.nodes[0]].data.id, 'save-u1')
assert.equal(saveRoot.events[saveRoot.surface.nodes[1]].data.message.id, 'save-a1')
const saveOnlyStateResponse = await stateRoute.fetch(new Request('https://example.test/api/roleplay/state?sessionId=session-save-root'))
const saveOnlyState = await saveOnlyStateResponse.json()
assert.equal(saveOnlyState.userActionsBySeq['1'].assistantMessageId, 'save-a1')
const regenAfterSave = await callRoute('/api/roleplay/branch', {
  action: 'prepare', sessionId: saveRoot.id, messageId: 'save-a1', kind: 'regenerate',
})
assert.equal(regenAfterSave.body.promptText, '无名客很生气')
const registeredAfterSave = await callRoute('/api/roleplay/branch', {
  action: 'register', operationId: regenAfterSave.body.operationId,
  childSessionId: saveRegen.id, requestId: 'req-regen-after-save', promptText: '无名客很生气',
})
assert.equal(registeredAfterSave.body.playerTotal, 1)
assert.equal(registeredAfterSave.body.total, 2)
saveRegen.events = [
  { type: 'turn/start', seq: 0, data: { turn: 1 } },
  { type: 'user/message', seq: 1, data: { id: 'save-u2', content: text('无名客很生气'), source: { kind: 'user', rpcId: 'req-regen-after-save' } }, surfaceOp: 'append' },
  { type: 'assistant/message', seq: 2, data: { turn: 1, message: { id: 'save-a2', content: text('重生回复') } }, surfaceOp: 'append' },
  { type: 'turn/end', seq: 3, data: { turn: 1, reason: { kind: 'completed' } } },
]
saveRegen.seq = 4
saveRegen.surface.nodes = [1, 2]
const savedRegenStateResponse = await stateRoute.fetch(new Request('https://example.test/api/roleplay/state?sessionId=session-save-regen'))
const savedRegenState = await savedRegenStateResponse.json()
assert.equal(savedRegenState.userActionsBySeq['1'].group.currentOrdinal, 1)
assert.equal(savedRegenState.userActionsBySeq['1'].group.total, 1)
assert.equal(savedRegenState.branchGroupsByMessageId['save-a2'].currentOrdinal, 2)
assert.equal(savedRegenState.branchGroupsByMessageId['save-a2'].total, 2)

// A surface edit and fork registration must share the canonical anchor lock.
// Pause the edit before its ledger commit: a second lock in an extracted
// module would let registration overwrite the player's new canonical text.
{
  const prepared = await callRoute('/api/roleplay/branch', {
    action: 'prepare', sessionId: saveRoot.id, messageId: 'save-a1', kind: 'regenerate',
  })
  assert.equal(prepared.status, 200)
  const pendingChild = enableAppend({
    id: 'save-concurrent-child', header: { agentPreset: 'roleplay' },
    events: [], seq: 0, surface: { nodes: [] },
  })
  sessions.set(pendingChild.id, pendingChild)
  const branches = table('branch')
  const originalPut = branches.put
  let releaseCommit, enteredCommit
  const commitGate = new Promise(resolve => { releaseCommit = resolve })
  const entered = new Promise(resolve => { enteredCommit = resolve })
  let paused = false
  branches.put = async function (key, value) {
    if (!paused && key.startsWith('fork-group-') && value.rootSessionId === saveRoot.id) {
      paused = true
      enteredCommit()
      await commitGate
    }
    return originalPut.call(this, key, value)
  }
  let editing, registering
  try {
    editing = callRoute('/api/roleplay/branch', {
      action: 'replace-message', sessionId: saveRoot.id, role: 'user', seq: 1,
      text: '并发编辑后的玩家消息',
    })
    // Race against completion too, so a broken fixture fails instead of hanging.
    await Promise.race([entered, editing.then(() => { throw Error('edit did not reach ledger commit') })])
    let registered = false
    registering = callRoute('/api/roleplay/branch', {
      action: 'register', operationId: prepared.body.operationId,
      childSessionId: pendingChild.id, requestId: 'concurrent-register',
      promptText: prepared.body.promptText,
    }).then(result => { registered = true; return result })
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(registered, false, 'registration waits for the surface edit commit')
    releaseCommit()
    assert.equal((await editing).status, 200)
    const staleRegistration = await registering
    assert.equal(staleRegistration.status, 500)
    assert.match(staleRegistration.body.error, /玩家消息已在其他分支修改/)
    const group = [...branches.entries()].find(([key, value]) =>
      key.startsWith('fork-group-') && value.rootSessionId === saveRoot.id)[1]
    assert.equal(Object.values(group.playerVariants)[0].text, '并发编辑后的玩家消息')
    assert.equal(group.members.some(member => member.sessionId === pendingChild.id), false)
  } finally {
    releaseCommit()
    await Promise.allSettled([editing, registering])
    branches.put = originalPut
  }
}

// Native fork retains metadata between turn/end and next turn/start.
const metadataRoot = enableAppend({ id: 'session-metadata-root', header: { agentPreset: 'roleplay' }, events: [
  { seq: 0, type: 'turn/start', data: { turn: 1 } },
  { seq: 1, type: 'user/message', data: { id: 'meta-u1', content: text('first'), source: { kind: 'user' } }, surfaceOp: 'append' },
  { seq: 2, type: 'assistant/message', data: { turn: 1, message: { id: 'meta-a1', content: text('first answer') } }, surfaceOp: 'append' },
  { seq: 3, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
  { seq: 4, type: 'session/end-seed', data: {} },
  { seq: 5, type: 'agent/inbox/spliced', data: { target: 'next-turn', start: 0, inserted: [] } },
  { seq: 6, type: 'turn/start', data: { turn: 2 } },
  { seq: 7, type: 'user/message', data: { id: 'meta-u2', content: text('metadata prompt'), source: { kind: 'user' } }, surfaceOp: 'append' },
  { seq: 8, type: 'assistant/message', data: { turn: 2, message: { id: 'meta-a2', content: text('metadata answer') } }, surfaceOp: 'append' },
  { seq: 9, type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } },
], seq: 10, surface: { nodes: [1, 2, 7, 8] } })
sessions.set(metadataRoot.id, metadataRoot)
const metadataChild = enableAppend({ id: 'session-metadata-child', header: { agentPreset: 'roleplay', parentSession: metadataRoot.id, seedLength: 6 }, events: structuredClone(metadataRoot.events.slice(0, 6)), seq: 6, surface: { nodes: [1, 2] } })
sessions.set(metadataChild.id, metadataChild)
const metadataPrepare = await callRoute('/api/roleplay/branch', { action: 'prepare', sessionId: metadataRoot.id, messageId: 'meta-a2', kind: 'regenerate' })
const metadataRegister = await callRoute('/api/roleplay/branch', { action: 'register', operationId: metadataPrepare.body.operationId, childSessionId: metadataChild.id, requestId: 'meta-request', promptText: 'metadata prompt' })
assert.equal(metadataRegister.status, 200, JSON.stringify(metadataRegister.body))
const badPrepare = await callRoute('/api/roleplay/branch', { action: 'prepare', sessionId: metadataRoot.id, messageId: 'meta-a2', kind: 'regenerate' })
const badChild = enableAppend({ id: 'session-bad-seed', header: { agentPreset: 'roleplay', parentSession: metadataRoot.id, seedLength: 4 }, events: [], seq: 0, surface: { nodes: [] } })
sessions.set(badChild.id, badChild)
const badRegister = await callRoute('/api/roleplay/branch', { action: 'register', operationId: badPrepare.body.operationId, childSessionId: badChild.id, requestId: 'bad-request', promptText: 'metadata prompt' })
assert.equal(badRegister.status, 500, 'async registration error must return JSON instead of escaping HTTP bridge')
assert.match(badRegister.body.error, /seed/)
await table('status').put('session-metadata-root__panel', { panel: { title: 'current' }, atSeq: 8 })
await callRoute('/api/roleplay/branch', { action: 'replace-message', sessionId: metadataRoot.id, role: 'assistant', messageId: 'meta-a2', text: 'edited metadata answer' })
assert.equal(table('status').get('session-metadata-root__panel').stale, true)
// An append can succeed before derived-state invalidation fails. Retrying the
// same edit must finish that commit without appending another text revision.
{
  const memory = table('memory')
  const memoryKey = `${metadataRoot.id}__head`
  await memory.put(memoryKey, {
    version: 1,
    deltas: [{ sessionId: metadataRoot.id, atSeq: 1 }, { sessionId: metadataRoot.id, atSeq: metadataRoot.seq }],
  })
  const originalUpdate = memory.update
  let injected = false
  memory.update = async function (key, update) {
    if (key === memoryKey && !injected) {
      injected = true
      throw Error('fixture interrupted edit invalidation')
    }
    return originalUpdate.call(this, key, update)
  }
  const request = {
    action: 'replace-message', sessionId: metadataRoot.id,
    role: 'assistant', messageId: 'meta-a2', text: 'recoverable edited answer',
  }
  try {
    const failed = await callRoute('/api/roleplay/branch', request)
    assert.equal(failed.status, 500)
    assert.match(failed.body.error, /fixture interrupted edit invalidation/)
    const afterAppend = metadataRoot.events.length
    assert.equal((await callRoute('/api/roleplay/branch', request)).status, 200)
    assert.equal(metadataRoot.events.length, afterAppend, 'retry reuses the committed text revision')
    assert.deepEqual(memory.get(memoryKey).deltas, [{ sessionId: metadataRoot.id, atSeq: 1 }])
    const version = memory.get(memoryKey).version
    assert.equal((await callRoute('/api/roleplay/branch', request)).status, 200)
    assert.equal(memory.get(memoryKey).version, version, 'committed receipt prevents repeated invalidation')
  } finally {
    memory.update = originalUpdate
  }
}
{
  let catalogDisk=null
  const catalog=createConversationCatalog({read:()=>catalogDisk,write:async v=>{catalogDisk=structuredClone(v)}})
  services.set('tavernConversations',{...catalog,ready:Promise.resolve()})
  const worldRoot=enableAppend({id:'world-root',header:{agentPreset:'roleplay',cwd:'/fiction'},seq:8,surface:{nodes:[1,2,5,6]},events:[
    {seq:0,type:'turn/start',data:{turn:1}},
    {seq:1,type:'user/message',surfaceOp:'append',data:{id:'world-u1',source:{kind:'user'},content:text('first')}},
    {seq:2,type:'assistant/message',surfaceOp:'append',data:{turn:1,message:{id:'world-a1',content:text('first story')}}},
    {seq:3,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}},
    {seq:4,type:'turn/start',data:{turn:2}},
    {seq:5,type:'user/message',surfaceOp:'append',data:{id:'world-u2',source:{kind:'user'},content:text('second')}},
    {seq:6,type:'assistant/message',surfaceOp:'append',data:{turn:2,message:{id:'world-a2',content:text('second story')}}},
    {seq:7,type:'turn/end',data:{turn:2,reason:{kind:'completed'}}},
  ]})
  sessions.set(worldRoot.id,worldRoot)
  const prefixKeys=[`1:${createHash('sha256').update('user\nfirst').digest('hex')}`,`2:${createHash('sha256').update('assistant\nfirst story').digest('hex')}`]
  const prefixNotes={schemaVersion:1,validated:true,text:'verified first turn',sourceKeys:prefixKeys,sourceSeqs:[1,2],throughSeq:2}
  const futureNotes={...prefixNotes,text:'future second turn',sourceKeys:[...prefixKeys,'6:'+'f'.repeat(64)],sourceSeqs:[1,2,6],throughSeq:6}
  await table('memory').put('world-root__head',{directorNotes:futureNotes,directorCheckpoints:[prefixNotes,futureNotes],
    notesCadence:{schemaVersion:1,branchId:'world-root',slots:[{turn:1,anchorSeq:1},{turn:2,anchorSeq:5}]}})
  await table('worldbook').put('world-root__lore',{id:'lore',name:'lore',content:'original worldline facts'})
  let worldForkCalls=0
  ctx.sessionController.forkPrepared=async(request,beforePublish)=>{
    worldForkCalls++
    const childId='world-internal'
    await beforePublish({sourceSessionId:request.sessionId,childSessionId:childId,seedLength:4})
    assert.equal(catalogDisk.worldlines[childId].conversationId,worldRoot.id,'book ownership commits before native publication')
    const child=enableAppend({id:childId,header:{agentPreset:'roleplay',parentSession:worldRoot.id,seedLength:4,cwd:'/fiction'},events:structuredClone(worldRoot.events.slice(0,4)),seq:4,surface:{nodes:[1,2]}})
    sessions.set(childId,child);return {sessionId:childId}
  }
  const preparation=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:worldRoot.id,messageId:'world-a2',kind:'regenerate'})
  assert.equal((await callRoute('/api/roleplay/branch',{action:'operation-status',operationId:preparation.body.operationId})).body.status,'prepared')
  const created=await callRoute('/api/roleplay/branch',{action:'create-worldline',operationId:preparation.body.operationId})
  assert.equal(created.status,200,JSON.stringify(created.body))
  assert.equal(created.body.childSessionId,'world-internal')
  const reservedSnapshot=structuredClone(catalogDisk)
  const replayedCreate=await callRoute('/api/roleplay/branch',{action:'create-worldline',operationId:preparation.body.operationId})
  assert.equal(replayedCreate.body.childSessionId,created.body.childSessionId);assert.equal(worldForkCalls,1)
  assert.deepEqual(catalogDisk,reservedSnapshot,'create replay must not reserve or publish another child')
  assert.equal((await callRoute('/api/roleplay/branch',{action:'register',operationId:preparation.body.operationId,childSessionId:'world-internal',promptText:'second'})).status,400)
  assert.equal((await callRoute('/api/roleplay/branch',{action:'register',operationId:preparation.body.operationId,childSessionId:'world-internal',requestId:'world-request',promptText:'changed'})).status,409)
  const registered=await callRoute('/api/roleplay/branch',{action:'register',operationId:preparation.body.operationId,childSessionId:'world-internal',requestId:'world-request',promptText:'second'})
  assert.equal(registered.status,200,JSON.stringify(registered.body))
  assert.equal(catalog.snapshot().conversations['world-root'].activeSessionId,'world-root','registration does not select before admission')
  assert.equal((await callRoute('/api/roleplay/branch',{action:'select-worldline',sessionId:'world-internal'})).status,200)
  assert.equal(table('worldbook').get('world-internal__lore').content,'original worldline facts')
  assert.equal(table('memory').get('world-internal__head').directorCheckpoints.length,1,'only checkpoints entirely inside native seed are inherited')
  assert.deepEqual(table('memory').get('world-internal__head').notesCadence.slots,[{turn:1,anchorSeq:1},{turn:2,anchorSeq:5}], 'fork retains the rewritten target slot but no later cadence metadata')
  assert.equal(directorNotesForBranch(table('memory').get('world-internal__head'),sessions.get('world-internal'))?.text,'verified first turn','real bootstrap reuses exact saved director prefix')
  await table('worldbook').put('world-internal__lore',{id:'lore',name:'lore',content:'child facts'})
  assert.equal(table('worldbook').get('world-root__lore').content,'original worldline facts','catalog identity does not collapse worldbook storage')
  const selected=await callRoute('/api/roleplay/branch',{action:'select-worldline',sessionId:worldRoot.id})
  assert.equal(selected.status,200)
  assert.equal(catalog.snapshot().conversations['world-root'].activeSessionId,worldRoot.id)
  await callRoute('/api/roleplay/branch',{action:'register',operationId:preparation.body.operationId,childSessionId:'world-internal',requestId:'world-request',promptText:'second'})
  assert.equal(catalog.snapshot().conversations['world-root'].activeSessionId,worldRoot.id,'register replay cannot steal selection')
  await callRoute('/api/roleplay/branch',{action:'select-worldline',sessionId:'world-internal'})
  const aborted=await callRoute('/api/roleplay/branch',{action:'abort',operationId:preparation.body.operationId})
  assert.equal(aborted.body.ok,true)
  assert.equal(catalog.snapshot().worldlines['world-internal'].status,'failed')
  assert.equal(catalog.snapshot().conversations['world-root'].activeSessionId,worldRoot.id)
  const abortedSnapshot=structuredClone(catalogDisk)
  assert.equal((await callRoute('/api/roleplay/branch',{action:'abort',operationId:preparation.body.operationId})).body.alreadyAborted,true)
  assert.deepEqual(catalogDisk,abortedSnapshot)
  assert.equal((await callRoute('/api/roleplay/branch',{action:'operation-status',operationId:preparation.body.operationId})).body.status,'failed')
  let failedId=0
  ctx.sessionController.forkPrepared=async(request,beforePublish)=>{
    const childId='world-register-failure'
    await beforePublish({sourceSessionId:request.sessionId,childSessionId:childId,seedLength:4})
    sessions.set(childId,enableAppend({id:childId,header:{agentPreset:'roleplay',parentSession:worldRoot.id,seedLength:2},events:structuredClone(worldRoot.events.slice(0,2)),seq:2,surface:{nodes:[1]}}))
    return {sessionId:childId}
  }
  const badPrep=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:worldRoot.id,messageId:'world-a2',kind:'regenerate'})
  assert.equal((await callRoute('/api/roleplay/branch',{action:'create-worldline',operationId:badPrep.body.operationId})).status,200)
  const badRegistration=await callRoute('/api/roleplay/branch',{action:'register',operationId:badPrep.body.operationId,childSessionId:'world-register-failure',requestId:'bad-registration',promptText:'second'})
  assert.equal(badRegistration.status,500)
  assert.equal(catalog.snapshot().worldlines['world-register-failure'].status,'failed','failed registration converges operation and catalog')
  assert.equal((await callRoute('/api/roleplay/branch',{action:'operation-status',operationId:badPrep.body.operationId})).body.status,'failed')
  ctx.sessionController.forkPrepared=async(request,beforePublish)=>{
    await beforePublish({sourceSessionId:request.sessionId,childSessionId:`world-failed-${++failedId}`,seedLength:4})
    throw new Error('native creation rejected')
  }
  for(let attempt=0;attempt<2;attempt++){
    const prep=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:worldRoot.id,messageId:'world-a2',kind:'regenerate'})
    const failed=await callRoute('/api/roleplay/branch',{action:'create-worldline',operationId:prep.body.operationId})
    assert.equal(failed.status,500)
    assert.equal(catalog.snapshot().worldlines[`world-failed-${failedId}`].status,'failed')
    const retry=await callRoute('/api/roleplay/branch',{action:'create-worldline',operationId:prep.body.operationId})
    assert.match(retry.body.error,/失效/,'failed operation must request new admission instead of waiting forever')
  }
  const firstRoot=enableAppend({id:'world-first-root',header:{agentPreset:'roleplay',cwd:'D:/fiction-fixture'},seq:4,surface:{nodes:[1,2]},events:[
    {seq:0,type:'turn/start',data:{turn:1}},
    {seq:1,type:'user/message',surfaceOp:'append',data:{id:'first-u',source:{kind:'user'},content:text('first prompt')}},
    {seq:2,type:'assistant/message',surfaceOp:'append',data:{turn:1,message:{id:'first-a',content:text('first answer')}}},
    {seq:3,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}},
  ]})
  sessions.set(firstRoot.id,firstRoot)
  const firstPrep=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:firstRoot.id,messageId:'first-a',kind:'regenerate'})
  assert.equal(firstPrep.body.previousTurnEndSeq,null)
  let createCalls=0
  ctx.sessionController.create=async options=>{
    createCalls++
    assert.match(options.sessionId,/^session-/);assert.equal(options.cwd,firstRoot.header.cwd);assert.equal(options.agentPreset,'roleplay')
    const operation=table('branch').get('fork-op-'+firstPrep.body.operationId)
    assert.equal(operation.reservedChildSessionId,options.sessionId);assert.equal(operation.presentation.seedLength,0)
    assert.equal(catalogDisk.worldlines[options.sessionId].status,'reserved','reservation commits before fresh session creation')
    sessions.set(options.sessionId,enableAppend({id:options.sessionId,header:{agentPreset:'roleplay',cwd:options.cwd},seq:0,surface:{nodes:[]},events:[]}))
    return {sessionId:options.sessionId}
  }
  const firstCreated=await callRoute('/api/roleplay/branch',{action:'create-worldline',operationId:firstPrep.body.operationId})
  assert.equal(firstCreated.status,200)
  assert.equal((await callRoute('/api/roleplay/branch',{action:'create-worldline',operationId:firstPrep.body.operationId})).body.childSessionId,firstCreated.body.childSessionId)
  assert.equal(createCalls,1)
  const firstRegistered=await callRoute('/api/roleplay/branch',{action:'register',operationId:firstPrep.body.operationId,childSessionId:firstCreated.body.childSessionId,requestId:'accepted-first',promptText:'first prompt'})
  assert.equal(firstRegistered.status,200,JSON.stringify(firstRegistered.body))
  const acceptedChild=sessions.get(firstCreated.body.childSessionId)
  acceptedChild.append('turn/start',{turn:1},{})
  acceptedChild.append('user/message',{id:'accepted-u',source:{kind:'user',rpcId:'accepted-first'},content:text('first prompt')},{surfaceOp:'append'})
  const operationKey='fork-op-'+firstPrep.body.operationId,groupKey='fork-group-'+firstRegistered.body.groupId
  const beforeAccepted={operation:structuredClone(table('branch').get(operationKey)),group:structuredClone(table('branch').get(groupKey)),catalog:structuredClone(catalogDisk)}
  const acceptedAbort=await callRoute('/api/roleplay/branch',{action:'abort',operationId:firstPrep.body.operationId})
  assert.equal(acceptedAbort.body.alreadyAccepted,true);assert.equal(acceptedAbort.body.aborted,false)
  assert.deepEqual(table('branch').get(operationKey),beforeAccepted.operation)
  assert.deepEqual(table('branch').get(groupKey),beforeAccepted.group)
  assert.deepEqual(catalogDisk,beforeAccepted.catalog)
  const preparedOnly=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:worldRoot.id,messageId:'world-a2',kind:'regenerate'})
  await table('branch').update('fork-op-'+preparedOnly.body.operationId,value=>({...value,state:'registering'}))
  assert.equal((await callRoute('/api/roleplay/branch',{action:'operation-status',operationId:preparedOnly.body.operationId})).body.status,'pending')
  assert.equal((await callRoute('/api/roleplay/branch',{action:'unknown'})).status,400)
  assert.equal((await callRoute('/api/roleplay/branch',{action:'select-worldline',sessionId:'missing'})).status,404)
  services.delete('tavernConversations')
  assert.equal((await callRoute('/api/roleplay/branch',{action:'select-worldline',sessionId:worldRoot.id})).status,404)
  services.set('tavernConversations',{...catalog,ready:Promise.resolve()})
}
{
  // A player edit forks before the edited player message. Its already-counted
  // story slot must survive as cadence metadata without carrying old prose.
  services.set('compaction',{legacyCadenceSlotsFor:(session,record)=>legacyCadenceSlots(selectedStoryHistory(session),record)})
  const parent=enableAppend({id:'cadence-parent',header:{agentPreset:'roleplay'},seq:12,surface:{nodes:[1,2,5,6,9,10]},events:[
    {seq:0,type:'turn/start',data:{turn:1}},{seq:1,type:'user/message',surfaceOp:'append',data:{id:'cu1',source:{kind:'user'},content:text('第一槽')}},{seq:2,type:'assistant/message',surfaceOp:'append',data:{turn:1,message:{id:'ca1',content:text('第一槽正文')}}},{seq:3,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}},
    {seq:4,type:'turn/start',data:{turn:2}},{seq:5,type:'user/message',surfaceOp:'append',data:{id:'cu2',source:{kind:'user'},content:text('第二槽')}},{seq:6,type:'assistant/message',surfaceOp:'append',data:{turn:2,message:{id:'ca2',content:text('第二槽正文')}}},{seq:7,type:'turn/end',data:{turn:2,reason:{kind:'completed'}}},
    {seq:8,type:'turn/start',data:{turn:3}},{seq:9,type:'user/message',surfaceOp:'append',data:{id:'cu3',source:{kind:'user'},content:text('第三槽原输入')}},{seq:10,type:'assistant/message',surfaceOp:'append',data:{turn:3,message:{id:'ca3',content:text('第三槽旧正文')}}},{seq:11,type:'turn/end',data:{turn:3,reason:{kind:'completed'}}},
  ]})
  sessions.set(parent.id,parent)
  await table('memory').put('cadence-parent__head',{schemaVersion:1,version:1,deltas:[],lockedFacts:[],
    directorNotes:{schemaVersion:1,validated:true,text:'LEGACY_PARENT_NOTES_MUST_NOT_COPY',sourceKeys:[1,2,5,6,9,10].map(seq=>`${seq}:${'a'.repeat(64)}`)}})
  ctx.sessionController.forkPrepared=async(request,beforePublish)=>{
    const childId='cadence-player-edit'
    await beforePublish({sourceSessionId:request.sessionId,childSessionId:childId,seedLength:8})
    sessions.set(childId,enableAppend({id:childId,header:{agentPreset:'roleplay',parentSession:parent.id,seedLength:8},events:structuredClone(parent.events.slice(0,8)),seq:8,surface:{nodes:[1,2,5,6]}}))
    return {sessionId:childId}
  }
  const prepared=await callRoute('/api/roleplay/branch',{action:'prepare',sessionId:parent.id,messageId:'ca3',kind:'player-edit'})
  assert.equal((await callRoute('/api/roleplay/branch',{action:'create-worldline',operationId:prepared.body.operationId})).status,200)
  assert.equal((await callRoute('/api/roleplay/branch',{action:'register',operationId:prepared.body.operationId,childSessionId:'cadence-player-edit',requestId:'cadence-edit',promptText:'第三槽新输入'})).status,200)
  const child=sessions.get('cadence-player-edit')
  child.append('turn/start',{turn:3},{})
  child.append('user/message',{id:'cu3-edit',source:{kind:'user'},content:text('第三槽新输入')},{surfaceOp:'append'})
  child.append('assistant/message',{turn:3,message:{id:'ca3-edit',content:text('第三槽新正文')}},{surfaceOp:'append'})
  child.append('turn/end',{turn:3,reason:{kind:'completed'}},{})
  const head=table('memory').get('cadence-player-edit__head')
  assert.deepEqual(head.notesCadence.slots.map(slot=>slot.turn),[1,2,3], 'legacy parent notes derive a safe target-slot watermark without inheriting notes')
  assert.equal(head.directorNotes,null,'legacy note text beyond the seed never enters the edited child')
  assert.equal(memoryNotesCadence(child,head).pendingTurns,0)
  const appendTurn=turn=>{child.append('turn/start',{turn},{});child.append('user/message',{id:`cu${turn}`,source:{kind:'user'},content:text(`第${turn}槽`)},{surfaceOp:'append'});child.append('assistant/message',{turn,message:{id:`ca${turn}`,content:text(`第${turn}槽正文`)}},{surfaceOp:'append'});child.append('turn/end',{turn,reason:{kind:'completed'}},{})}
  appendTurn(4);assert.equal(memoryNotesCadence(child,head).due,false)
  appendTurn(5);assert.equal(memoryNotesCadence(child,head).due,false)
  appendTurn(6);assert.equal(memoryNotesCadence(child,head).due,true)
}
{
  // Exercise the actual state route with many player variants, including a
  // pending sibling, a deleted sibling and a cold completed representative.
  const sessionId = 'many-player-variants'
  const variantCount = 2000
  const currentVariant = 731
  const largeSession = enableAppend({ id: sessionId, header: { agentPreset: 'roleplay' }, seq: 4,
    events: [
      { seq: 0, type: 'turn/start', data: { turn: 1 } },
      { seq: 1, type: 'user/message', data: { id: 'many-u', source: { kind: 'user' }, content: text('shared prompt') } },
      { seq: 2, type: 'assistant/message', data: { turn: 1, message: { id: 'many-a', content: text('current reply') } } },
      { seq: 3, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ], surface: { nodes: [1, 2] } })
  sessions.set(sessionId, largeSession)
  const groupId = 'many-variants'
  const members = []
  const playerVariants = {}
  for (let index = variantCount; index >= 1; index--) {
    const playerVariantId = `many-player-${index}`
    playerVariants[playerVariantId] = { text: 'shared prompt', revision: 1, updatedAt: 1 }
    for (let sibling = 0; sibling < 4; sibling++) {
      const isCurrent = index === currentVariant && sibling === 0
      members.push({ sessionId: isCurrent ? sessionId : `cold-${index}-${sibling}`,
        ordinal: members.length + 1, kind: 'regenerate', playerVariantId, playerOrdinal: index,
        playerTextRevision: 1, playerAppliedRevision: 1, promptText: 'shared prompt',
        userMessageId: isCurrent ? 'many-u' : `cold-u-${index}-${sibling}`, userSeq: 1,
        assistantMessageId: isCurrent ? 'many-a' : sibling === 3 ? null : `cold-a-${index}-${sibling}`,
        assistantSeq: sibling === 3 ? null : 2, createdAt: 1,
        pending: sibling === 3, deleted: sibling === 1 })
    }
  }
  await table('branch').put(`fork-group-${groupId}`, { schemaVersion: 2, groupId, rootSessionId: sessionId,
    anchor: { sourceSessionId: sessionId, sourceAssistantMessageId: 'many-a', sourceUserMessageId: 'many-u',
      sourceUserSeq: 1, sourceTurn: 1, previousTurnEndSeq: null, promptText: 'shared prompt' },
    members, playerVariants, createdAt: 1, updatedAt: 1 })
  const loadedBefore = sessions.size
  const response = await stateRoute.fetch(new Request(`https://fixture.test/api/roleplay/state?sessionId=${sessionId}`))
  assert.equal(response.status, 200)
  const state = await response.json()
  const players = state.userActionsBySeq['1'].group
  assert.equal(players.total, variantCount)
  assert.equal(players.currentOrdinal, currentVariant)
  assert.equal(players.members[currentVariant - 1].sessionId, sessionId)
  assert.equal(players.members[0].sessionId, 'cold-1-2', 'prefer the last completed live member over pending/deleted siblings')
  assert.equal(players.members.at(-1).sessionId, `cold-${variantCount}-2`)
  assert.deepEqual(players.members.map(member => member.sourceOrdinal), Array.from({ length: variantCount }, (_, i) => i + 1))
  assert.equal(state.branchGroupsByMessageId['many-a'].total, 3)
  assert.equal(sessions.size, loadedBefore, 'projecting variants must not load cold sibling sessions')
  assert.equal(largeSession.events.length, 4, 'an already synchronized player variant needs no replacement')
}
// Drive the inherited storage transaction directly, while the tests above
// exercise its actual native fork/state callers.
function inheritanceFixture(seedLength=5) {
 const writes=[],states=new Map(),rows=Object.fromEntries(['branch','cards','worldbook','rules','opening','memory','status','scene','rolls'].map(name=>{
  const table=new Table(),put=table.put.bind(table)
  table.put=async(key,value)=>{await put(key,value);writes.push({table:name,key,value:structuredClone(value)})}
  return [name,table]
 }))
 const child={id:'inherit-child',header:{parentSession:'inherit-parent',seedLength},events:[],surface:{nodes:[]}}
 const deps={T:rows,ensureState(id){if(!states.has(id))states.set(id,{branchReady:false,branchPreparing:null});return states.get(id)},
  cloneBranchRecord:structuredClone,clusterLoreVisible:()=>true,contextWindowKey:id=>`${id}__context-window`,cloneContextWindow:structuredClone,
  ctx:{get:()=>undefined,sessions:{get:()=>undefined},logger:{warn(){}}},statusSource:()=>null,
  statusFixedContext:()=>({cards:[],worldbook:[],rules:null})}
 return {child,rows,writes,states,api:createRoleplayInheritance(deps)}
}
{
 const {api,child,rows}=inheritanceFixture()
 rows.branch.set('inherit-parent__settings',{contextWindowTokens:3000,autoNotesEveryTurns:50,continuityTailTokens:1000})
 rows.branch.set(`${child.id}__settings`,{autoNotesEveryTurns:3,continuityTailTokens:null})
 await api.ensureBranch(child)
 assert.equal(rows.branch.get(`${child.id}__settings`).autoNotesEveryTurns,3,'first turn preserves a fresh fork setting already saved by the player')
 assert.equal(rows.branch.get(`${child.id}__settings`).contextWindowTokens,3000,'unspecified fields still inherit')
 assert.equal(rows.branch.get(`${child.id}__settings`).continuityTailTokens,null,'explicit global-inheritance choice survives')
}
{
 const h=inheritanceFixture(),{rows,child}=h
 rows.branch.set(`${child.id}__meta`,{inheritanceState:'copying',inheritedFrom:'inherit-parent',inheritedAtSeedLength:5})
 rows.cards.set('inherit-parent__npc',{id:'npc',content:'complete author text'})
 rows.worldbook.set('inherit-parent__world',{id:'world',content:'author lore'})
 const put=rows.worldbook.put.bind(rows.worldbook)
 let rejectCopy,started
 const entered=new Promise(resolve=>{started=resolve}),gate=new Promise((_resolve,reject)=>{rejectCopy=reject})
 rows.worldbook.put=async(key,value)=>{if(key.startsWith(child.id)){started();await gate}return put(key,value)}
 const first=h.api.ensureBranch(child),second=h.api.ensureBranch(child)
 const checked=assert.rejects(Promise.all([first,second]),/fixture interrupted inheritance/)
 await entered
 assert.equal(h.writes.filter(w=>w.table==='cards').length,1,'concurrent callers share one inheritance pass')
 assert.equal(rows.branch.get(`${child.id}__meta`).inheritanceState,'copying','provisional meta cannot become ready before all copies')
 rejectCopy(new Error('fixture interrupted inheritance'))
 await checked
 assert.deepEqual((await Promise.allSettled([first,second])).map(r=>r.status),['rejected','rejected'])
 assert.deepEqual(h.states.get(child.id),{branchReady:false,branchPreparing:null})
 rows.worldbook.put=put
 await h.api.ensureBranch(child)
 assert.equal(rows.worldbook.get(`${child.id}__world`).content,'author lore')
 assert.equal(h.writes.at(-1).key,`${child.id}__meta`)
 assert.equal(h.writes.at(-1).value.inheritanceState,'ready')
 const count=h.writes.length
 h.states.get(child.id).branchReady=false
 rows.cards.set('inherit-parent__npc',{id:'npc',content:'later parent edit'})
 await h.api.ensureBranch(child)
 assert.equal(h.writes.length,count,'a cold exact ready marker skips repeat copies')
 assert.equal(rows.cards.get(`${child.id}__npc`).content,'complete author text')
}
for(const startSeq of [2,5]) {
 const h=inheritanceFixture(),{rows,child}=h,p='inherit-parent',c=child.id
 rows.branch.set(`${c}__meta`,{inheritanceState:'ready',inheritedFrom:p,inheritedAtSeedLength:4})
 rows.branch.set(`${p}__context-window`,{windowNumber:3,windowId:'parent-window',startSeq,throughSeq:8})
 rows.branch.set(`${p}__settings`,{contextWindowTokens:2000})
 rows.branch.set(`${p}__import-active`,{importId:'root-card'})
 for(const name of ['cards','worldbook','rules','opening'])rows[name].set(`${p}__spec`,{text:`full ${name}`})
 const memory=Object.fromEntries(['archives','archiveDigests','deltas','pendingConfirmations','lockedFacts','styleNotes','userPrefs'].map(field=>[field,[{atSeq:4,text:'before'},{atSeq:5,text:'at-boundary'},{atSeq:6,text:'after'}]]))
 const note={validated:true,sourceKeys:[`4:${'a'.repeat(64)}`],text:'first exact checkpoint'}
 rows.memory.set(`${p}__head`,{...memory,summary:'unproven parent summary',directorNotes:note,directorCheckpoints:[{...note,text:'duplicate loses'},{validated:true,sourceKeys:[`5:${'b'.repeat(64)}`],text:'future'}],notesCadence:{schemaVersion:1,slots:[{turn:1,anchorSeq:4},{turn:2,anchorSeq:5}]}})
 rows.scene.set(`${p}__current`,{atSeq:5,place:'future'})
 rows.status.set(`${p}__spec`,{text:'author status'})
 rows.status.set(`${p}__panel`,{atSeq:5,sessionId:p,panel:{rawText:'future'}})
 rows.rolls.set(`${p}__log`,[{atSeq:4,total:1},{atSeq:5,total:2},{atSeq:6,total:3}])
 await h.api.ensureBranch(child)
 const inherited=rows.memory.get(`${c}__head`)
 for(const field of Object.keys(memory))assert.deepEqual(inherited[field],memory[field].slice(0,1),field)
 assert.equal(inherited.summary,'')
 assert.deepEqual(inherited.directorCheckpoints,[note],'checkpoint deduplication preserves first proven version')
 assert.deepEqual(inherited.notesCadence.slots,[{turn:1,anchorSeq:4}])
 assert.equal(rows.scene.get(`${c}__current`),undefined)
 assert.equal(rows.status.get(`${c}__panel`),undefined)
 assert.equal(rows.status.get(`${c}__spec`).text,'author status')
 assert.deepEqual(rows.rolls.get(`${c}__log`).entries,[{atSeq:4,total:1}])
 assert.equal(rows.branch.get(`${c}__import-active`).sourceRecordSessionId,p)
 const window=rows.branch.get(`${c}__context-window`)
 assert.equal(window.startSeq,startSeq>=5?-1:startSeq)
 assert.equal(window.windowNumber,startSeq>=5?1:3)
 assert.equal(window.throughSeq,4)
 assert.equal(rows.branch.get(`${c}__meta`).inheritedAtSeedLength,5,'wrong seed ready marker must replay')
 const grandchild={...child,id:`${c}-grandchild`,header:{parentSession:c,seedLength:5}}
 await h.api.ensureBranch(grandchild)
 assert.equal(rows.branch.get(`${grandchild.id}__import-active`).sourceRecordSessionId,p,'grandchild retains the original import record owner')
}
// The shared service must preserve commit barriers and immutable table writes.
{
 const rows=Object.fromEntries(['branch','memory','scene','status','rules','opening','decision','cards','worldbook'].map(name=>[name,new Table()]))
 const warnings=[],registered=new Map(),runtime={commitChain:Promise.resolve()},nativeTask=async()=>({done:true})
 const svc=createRoleplayService({T:rows,nativeTask,storyBranchIsActive:()=>true,ensureState:()=>runtime,
  ctx:{logger:{warn:message=>warnings.push(message)},sessions:{get:id=>registered.get(id)}},
  lockedFactsOf:()=>[],cloneBranchRecord:structuredClone,memorySettingsPolicy:()=>({effective:{archiveTokens:12000}}),
  normalizeDecisionRecord:record=>record??null,contextWindowKey:id=>`${id}__context-window`,cloneContextWindow:structuredClone,
  normalizeStatusOption:option=>({...option,label:String(option.label??option.text??''),description:String(option.description??''),heart:option.heart===true})})
 assert.deepEqual(Object.keys(svc).sort(),['nativeTask','ownsMemoryPreparation','isStoryBranchActive','awaitCommitted','surfaceText','lockedFacts','memoryHead','memoryUpdate','sceneCurrent','branchLineage','settings','setSettings','versions','recordVersion','statusSpec','setStatusSpec','rulesOf','setRules','opening','setOpening','userInfo','setUserInfo','decision','contextWindow','askDecision'].sort())
 assert.equal(svc.nativeTask,nativeTask)
 assert.equal(svc.ownsMemoryPreparation,true)
 assert.equal(svc.surfaceText('missing',[1]),'')
 let resolveCommit
 runtime.commitChain=new Promise(resolve=>{resolveCommit=resolve})
 mock.timers.enable({apis:['setTimeout']})
 try {
  const bounded=svc.awaitCommitted('owner',25)
  mock.timers.tick(25)
  assert.deepEqual(await bounded,{completed:false,timedOut:true})
  let unboundedDone=false
  const waits=[0,-1,Infinity,'invalid'].map(limit=>svc.awaitCommitted('owner',limit))
  const unbounded=Promise.all(waits).then(value=>{unboundedDone=true;return value})
  await Promise.resolve();await Promise.resolve()
  assert.equal(unboundedDone,false,'timeout must leave the original commit pending')
  resolveCommit()
  assert.ok((await unbounded).every(result=>result.completed&&!result.timedOut))
  runtime.commitChain=Promise.reject(new Error('fixture old commit failure'))
  assert.deepEqual(await svc.awaitCommitted('owner'),{completed:true,timedOut:false})
  assert.ok(warnings.some(message=>message.includes('fixture old commit failure')))
 } finally {resolveCommit();mock.timers.reset()}
 const put=rows.memory.put.bind(rows.memory),update=rows.memory.update.bind(rows.memory)
 rows.memory.put=async()=>{throw Error('fixture initial put failure')}
 await assert.rejects(svc.memoryUpdate('owner',{summary:'uncommitted'}),/initial put/)
 assert.equal(svc.memoryHead('owner'),null)
 rows.memory.put=put
 const seed={schemaVersion:1,deltas:[],lockedFacts:[],version:1,extension:{preserve:true}}
 await put('owner__head',seed)
 rows.memory.update=async(key,work)=>{work(rows.memory.get(key));throw Error('fixture update failure')}
 await assert.rejects(svc.memoryUpdate('owner',{summary:'uncommitted'}),/update failure/)
 assert.deepEqual(svc.memoryHead('owner'),seed)
 rows.memory.update=update
 const patch={summary:'saved',directorNotes:{text:'full notes'},schemaVersion:999}
 await svc.memoryUpdate('owner',patch)
 patch.directorNotes.text='mutated caller'
 assert.equal(svc.memoryHead('owner').directorNotes.text,'full notes')
 assert.equal(svc.memoryHead('owner').version,2)
 assert.equal(svc.memoryHead('owner').schemaVersion,1)
 rows.branch.set('owner__versions',{extra:'kept',anchors:{'1':{extra:'anchor',entries:[{turn:3,seq:9}]},'2':{extra:'sparse'}}})
 await svc.recordVersion('owner',1,2,6)
 await svc.recordVersion('owner',1,999,9)
 await svc.recordVersion('owner',2,4,12)
 const versions=svc.versions('owner')
 assert.equal(versions.extra,'kept')
 assert.equal(versions.anchors['1'].extra,'anchor')
 assert.deepEqual(versions.anchors['1'].entries,[{turn:2,seq:6},{turn:3,seq:9}])
 assert.deepEqual(versions.anchors['2'],{extra:'sparse',entries:[{turn:4,seq:12}]})
 rows.branch.set('owner__context-window',{windowId:'window',tailSeqs:[1,2]})
 svc.contextWindow('owner').tailSeqs.push(3)
 assert.deepEqual(rows.branch.get('owner__context-window').tailSeqs,[1,2])
 assert.equal((await svc.setRules('owner',{core:'full rules',schemaVersion:8},2)).schemaVersion,1)
 assert.equal((await svc.setStatusSpec('owner','status',null)).updatedAtSeq,undefined)
 assert.equal((await svc.setOpening('owner','opening',3)).updatedAtSeq,3)
 await svc.setSettings('owner',{custom:1});await svc.setSettings('owner',{other:2})
 assert.equal(rows.branch.get('owner__settings').custom,1)
 const question=await svc.askDecision('owner',{source:'test',header:'h'.repeat(70),options:[{text:'',description:'ignored'},...Array.from({length:6},()=>({text:'q'.repeat(80),description:'d'.repeat(140),custom:'retained'}))]})
 assert.equal(question.options.length,4);assert.equal(question.header.length,60)
 assert.equal(question.options[0].label.length,60);assert.equal(question.options[0].description.length,120)
 assert.equal(question.options[0].custom,'retained');assert.equal(question.answered,false)
 for(let i=0;i<70;i++)registered.set(String(i),{id:String(i),header:{parentSession:String(i+1),seedLength:i}})
 assert.equal(svc.branchLineage(registered.get('0')).length,64)
 registered.delete('3')
 assert.deepEqual(svc.branchLineage(registered.get('0')).map(entry=>entry.sessionId),['0','1','2'])
}
console.log('roleplay-core native branch and shared service smoke: ok')
