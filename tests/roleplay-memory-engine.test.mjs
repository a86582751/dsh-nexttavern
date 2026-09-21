import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { apply, directorNotesForBranch, durableCompactionArchives, filterMemoryRecordForBranch, queryStoryHistory, readStoryHistory, selectedStoryHistory, memoryNotesCadence } from '../lib/memory/roleplay-memory-engine.js'
import { legacyCadenceSlots, storyCadenceSlots } from '../lib/memory/roleplay-memory-engine.js'

{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/memory-history-legacy-v1.json',import.meta.url),'utf8'))
 assert.equal(fixture.schemaVersion,1)
 for(const sample of fixture.cases) {
  const before=structuredClone(sample)
  const {session,record}=sample
  assert.deepEqual(selectedStoryHistory(session),sample.rows,`${sample.name}: pre-TS canonical rows`)
  for(const {options,result} of sample.reads)assert.deepEqual(readStoryHistory(session,options),result)
  for(const {options,result} of sample.queries)assert.deepEqual(queryStoryHistory(session,options),result)
  assert.deepEqual(storyCadenceSlots(sample.rows),sample.slots)
  assert.deepEqual(legacyCadenceSlots(sample.rows,record),sample.legacySlots)
  assert.deepEqual(memoryNotesCadence(session,record),sample.cadence)
  assert.deepEqual(directorNotesForBranch(record,session),sample.notes)
  assert.deepEqual(sample,before,'history and records remain read-only')
 }
 const sample=fixture.cases[0]
 const checkpoints=Array.from({length:150000},()=>({sourceKeys:[]}))
 checkpoints.push(sample.record.directorCheckpoints[0],sample.record.directorCheckpoints[1])
 const record={directorCheckpoints:checkpoints}
 assert.deepEqual(legacyCadenceSlots(sample.rows,record),sample.legacySlots,'large legacy checkpoint sets do not overflow argument limits')
 assert.deepEqual(directorNotesForBranch(record,sample.session),sample.notes,'equal-length valid prefixes preserve the first checkpoint')
 const current={text:'Current edited notes',sourceKeys:sample.record.directorCheckpoints[0].sourceKeys}
 assert.equal(directorNotesForBranch({...record,directorNotes:current},sample.session).text,current.text,'valid current notes remain authoritative')
 console.log('memory-history migration: legacy rows/query/cadence, unchanged records, 150000 checkpoints and stable prefix selection passed')
}

const text = (value) => [{ type: 'text', text: value }]
{
 const session=makeSession('stream-heavy-history',completedStoryEvents(),[1,2,3,6,7])
 const expected=selectedStoryHistory(session)
 let chunkTypeReads=0
 const chunkCount=20000
 for(let i=0;i<chunkCount;i++)session.events.push(Object.freeze({seq:session.events.length,
  get type(){chunkTypeReads++;return 'assistant/chunk'},data:Object.freeze({})}))
 const started=performance.now()
 assert.deepEqual(selectedStoryHistory(session),expected,'token traffic cannot change selected canonical story')
 console.log(`story-stream-scan: ${Math.round(performance.now()-started)}ms, chunkTypeReads=${chunkTypeReads}`)
 assert.ok(chunkTypeReads<=chunkCount*2,'one history pass should exclude token chunks from repeated story evidence scans')
}
{
 const session=makeSession('tool-history',completedStoryEvents(),[1,2,3,6,7])
 const result=session.append('tool/result',{message:{source:{callId:'lore-1'},content:text('档案原件：第三次泵冲后方可开门。')}},{surfaceOp:'append'})
 const other=session.append('tool/result',{message:{source:{callId:'discarded'},content:text('OTHER_WORLDLINE_RESULT')}})
 const checkpoint=session.append('user/message',{source:{kind:'plugin',plugin:'roleplay-context-window'},content:text('窗口回执')},
  {surfaceOp:{op:'replace',startSeq:result.seq,endSeq:result.seq},sourceEventSeqs:[result.seq]})
 checkpoint.sourceEventSeqs=[result.seq]
 assert.equal(queryStoryHistory(session,{query:'第三次泵冲'}).matchedEntries,0,'plot-only default never imports tool material into memory')
 const found=queryStoryHistory(session,{scope:'tools',query:'第三次泵冲'})
 assert.equal(found.entries.length,1,'main agent can recover archived tool evidence explicitly')
 assert.equal(found.entries[0].seq,result.seq)
 assert.equal(found.entries[0].role,'tool')
 assert.match(readStoryHistory(session,{scope:'tools',seq:result.seq}).text,/第三次泵冲/)
 assert.throws(()=>readStoryHistory(session,{scope:'tools',seq:other.seq}),/当前选中分支/)
 session.surface.nodes=session.surface.nodes.filter(seq=>seq!==checkpoint.seq)
 assert.equal(queryStoryHistory(session,{scope:'tools',query:'第三次泵冲'}).matchedEntries,0,'discarded archive cannot leak into selected history')
}

{
 const session=makeSession('canonical-cadence',completedStoryEvents(),[1,2,3,6,7])
 assert.equal(memoryNotesCadence(session).completedTurns,2)
 assert.equal(memoryNotesCadence(session).due,false)
 for(let i=0;i<4;i++)session.append('assistant/message',{turn:2,message:{id:`reroll-${i}`,content:text(`第二回合版本 ${i}`)}},
   {surfaceOp:{op:'replace',startSeq:session.surface.nodes.at(-1),endSeq:session.surface.nodes.at(-1)}})
 assert.equal(memoryNotesCadence(session).completedTurns,2,'regeneration replaces one canonical turn; four retries are not four new turns')
 assert.equal(memoryNotesCadence(session).due,false)
 session.append('turn/start',{turn:99})
 session.append('user/message',{id:'u3',source:{kind:'user'},content:text('继续前进。')},{surfaceOp:'append'})
 session.append('assistant/message',{turn:99,message:{id:'a3',content:text('第三回合前进。')}},{surfaceOp:'append'})
 session.append('turn/end',{turn:99,reason:{kind:'completed'}})
 assert.equal(memoryNotesCadence(session).completedTurns,3,'physical turn number and model request count do not define cadence')
 assert.equal(memoryNotesCadence(session).due,true)
 const entries=selectedStoryHistory(session)
 const record={directorNotes:{validated:true,text:'已核验笔记',sourceKeys:entries.map(e=>`${e.seq}:${createHash('sha256').update(`${e.role}\n${e.text}`).digest('hex')}`)}}
 assert.equal(memoryNotesCadence(session,record).pendingTurns,0)
 assert.equal(memoryNotesCadence(session,record).due,false)
 const body=entries.at(-1)
 session.append('assistant/message',{turn:99,message:{id:'a3-edited',content:text('第三回合改为等待。')}},{surfaceOp:{op:'replace',startSeq:body.seq,endSeq:body.seq}})
 assert.equal(memoryNotesCadence(session,record).completedTurns,3)
 assert.equal(memoryNotesCadence(session,record).rebuildRequired,true,'editing summarized canon invalidates notes without adding a turn')
 assert.equal(memoryNotesCadence(session,record).due,false,'an invalidated same-slot version does not bypass the three-new-slot cadence')
 const sibling={...session,id:'sibling',surface:{nodes:session.surface.nodes.slice(0,3)}}
 assert.equal(memoryNotesCadence(sibling).completedTurns,1,'sibling future and retries are outside the selected canon')
}
{
 const session=makeSession('manual-empty-cadence',[],[])
 const h=makeHarness({session});await apply(h.ctx,{})
 await h.services.get('compaction').saveDirectorNotes(session,'手动空历史笔记')
 assert.equal(h.heads.get(session.id).notesCadence.throughSeq,-1,'manual empty notes persist the explicit empty cadence boundary')
}
{
 const session=makeSession('immutable-history-cache',completedStoryEvents(),[1,2,3,6,7])
 let scans=0
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
 session.events.forEach(freeze)
 session.events=Object.freeze(session.events.map(event=>Object.freeze({...event,get type(){scans++;return event.type}})))
 const first=selectedStoryHistory(session)
 assert.ok(first.length>0)
 scans=0
 const repeat=selectedStoryHistory(session)
 assert.equal(scans,0,'same immutable log and selected surface must reuse validated story projection')
 repeat[0].text='caller mutation'
 assert.deepEqual(selectedStoryHistory(session),first,'callers cannot corrupt cached story evidence')
 session.surface.nodes=session.surface.nodes.filter(seq=>seq!==first[0].seq)
 assert.ok(!selectedStoryHistory(session).some(e=>e.seq===first[0].seq),'surface replacement invalidates cache')
 const previousScans=scans
 session.events=Object.freeze([...session.events,{seq:session.events.length,type:'checkpoint',data:{}}])
 selectedStoryHistory(session)
 assert.ok(scans>previousScans,'new immutable snapshot invalidates cache')
 const sibling={...session,id:'other-worldline'}
 assert.ok(selectedStoryHistory(sibling).every(e=>e.id.startsWith('other-worldline:')),'cache does not cross branch identity')
 const mutable=makeSession('shallow-frozen-history',completedStoryEvents(),[1,2,3,6,7])
 mutable.events=Object.freeze(mutable.events.map(event=>Object.freeze({...event})))
 const old=selectedStoryHistory(mutable).find(e=>e.role==='assistant')
 mutable.events[old.seq].data.message.content[0].text='edited nested evidence'
 assert.equal(selectedStoryHistory(mutable).find(e=>e.seq===old.seq).text,'edited nested evidence','shallow frozen arrays do not authorize caching mutable evidence')
}
{
 const session=makeSession('checkpoint-selected',completedStoryEvents(),[1,2,3,6,7])
 const entries=selectedStoryHistory(session)
 const keys=entries.map(e=>`${e.seq}:${createHash('sha256').update(`${e.role}\n${e.text}`).digest('hex')}`)
 const good={schemaVersion:1,validated:true,text:'完整前缀笔记',sourceKeys:keys}
 const shorter={...good,text:'较早笔记',sourceKeys:keys.slice(0,2)}
 const future={...good,text:'已丢弃的未来',sourceKeys:[...keys,'999:future']}
 const wrong={...good,text:'其他世界线',sourceKeys:keys.map((k,i)=>i===0?'1:wrong':k)}
 const record={directorNotes:future,directorCheckpoints:[shorter,good,wrong,future]}
 assert.equal(directorNotesForBranch(record,session)?.text,good.text,'fork restores the longest exact content checkpoint without regenerating notes')
 assert.equal(directorNotesForBranch(record,session)?.pendingEntries,0)
 assert.equal(directorNotesForBranch({directorNotes:{...good,manual:true,text:'手动修改'},directorCheckpoints:[good]},session)?.text,'手动修改')
 assert.equal(directorNotesForBranch({directorNotes:future,directorCheckpoints:[{...good,validated:false},wrong]},session),null)
}

for(const tool of ['rp_card_export_begin','rp_diagnose','rp_preset','rp_card_draft_check']) {
  const session=makeSession('export-management',[
    event('turn/start',{turn:1}),
    event('user/message',{source:{kind:'user'},content:text('导出最新角色设定为 Markdown')},'append'),
    event('tool/call',{turn:1,name:tool}),
    event('assistant/message',{turn:1,message:{content:text('导出完成：设定.md')}},'append'),
    event('turn/end',{turn:1,reason:{kind:'completed'}}),
  ],[1,3])
  assert.equal(selectedStoryHistory(session).length,0,'export instructions and artifact receipts must not become plot memory')
  assert.equal(memoryNotesCadence(session,undefined,1).due,false,'management cannot trigger background notes even at a one-turn cadence')
}

{
  const session=makeSession('after-story-committed',[
    event('turn/start',{turn:1}),
    event('user/message',{id:'u1',source:{kind:'user'},content:text('我推开温室的门。')},'append'),
    event('assistant/message',{turn:1,message:{id:'story',content:text('铜灯熄灭后，温室门缓缓打开。')}},'append'),
    event('user/message',{id:'after-story',source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'after-story',storySeq:2,turn:1},content:text('正文已经落盘。')},'append'),
    event('assistant/message',{turn:1,message:{id:'internal',content:text('内部维护结果，不能进入剧情记忆。')}},'append'),
    event('turn/end',{turn:1,reason:{kind:'aborted'}}),
  ],[1,2,3,4])
  assert.deepEqual(selectedStoryHistory(session).map(entry=>entry.seq),[1,2],
    'a visible after-story proof preserves the committed user/story pair when later internal maintenance aborts')
}

{
  const session=makeSession('ordinary-aborted-not-story',[
    event('turn/start',{turn:1}),
    event('user/message',{id:'u1',source:{kind:'user'},content:text('这次失败输入不能进入记忆。')},'append'),
    event('assistant/message',{turn:1,message:{id:'partial',content:text('这段未完成正文必须排除。')}},'append'),
    event('turn/end',{turn:1,reason:{kind:'aborted'}}),
  ],[1,2])
  assert.deepEqual(selectedStoryHistory(session),[],'ordinary aborted prose has no durable story proof')
}

{
  const session=makeSession('after-story-overrides-earlier-tool-commentary',[
    event('turn/start',{turn:1}),
    event('user/message',{id:'u1',source:{kind:'user'},content:text('我推开温室的门。')},'append'),
    event('assistant/message',{turn:1,message:{id:'tool-commentary',content:text('我先检查铜灯。')}},'append'),
    event('tool/result',{turn:1,content:text('工具输出不属于剧情。')},'append'),
    event('assistant/message',{turn:1,message:{id:'story',content:text('铜灯熄灭后，温室门缓缓打开。')}},'append'),
    event('user/message',{id:'after-story',source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'after-story',storySeq:4,turn:1},content:text('正文已经落盘。')},'append'),
    event('assistant/message',{turn:1,message:{id:'internal',content:text('内部维护结果。')}},'append'),
    event('turn/end',{turn:1,reason:{kind:'completed'}}),
  ],[1,2,3,4,5,6])
  assert.deepEqual(selectedStoryHistory(session).map(entry=>entry.seq),[1,4],
    'after-story proof selects only its exact body, never earlier assistant/tool commentary in the completed turn')
}

function event(type, data, surfaceOp) {
  return { type, data, ...(surfaceOp === undefined ? {} : { surfaceOp }) }
}

function makeSession(id, sourceEvents, surfaceIndexes, header = {}) {
  const events = sourceEvents.map((item, seq) => ({ ...item, seq, time: seq + 1 }))
  const nodes = surfaceIndexes.map(Number)
  return {
    id,
    header: { id, agentPreset: 'roleplay', ...header },
    events,
    get seq() { return this.events.length },
    surface: { nodes },
    requestHeader() { return { config: { provider: 'test-provider', model: 'test-model' } } },
    append(type, data, options) {
      const seq = this.events.length
      const appended = {
        type, data: structuredClone(data), seq, time: Date.now(),
        ...(options?.surfaceOp === undefined ? {} : { surfaceOp: structuredClone(options.surfaceOp) }),
        ...(options?.sourceEventSeqs === undefined ? {} : { sourceEventSeqs: [...options.sourceEventSeqs] }),
      }
      this.events.push(appended)
      if (options?.surfaceOp === 'append') nodes.push(seq)
      else if (options?.surfaceOp?.op === 'replace') {
        const start = nodes.indexOf(options.surfaceOp.startSeq)
        const end = nodes.indexOf(options.surfaceOp.endSeq)
        assert.ok(start >= 0 && end >= start, 'fake session received an invalid replacement')
        nodes.splice(start, end - start + 1, seq)
      }
      return appended
    },
  }
}

function completedStoryEvents({ cardText = 'SECRET_CARD', oldBranchText = 'UNSELECTED_BRANCH' } = {}) {
  return [
    event('turn/start', { turn: 1 }),
    event('user/message', { id: 'u1', role: 'user', content: text('玩家走进雨夜车站'), source: { kind: 'user' } }, 'append'),
    event('user/message', { id: 'ctx1', role: 'user', content: text(cardText), source: { kind: 'plugin', plugin: 'roleplay-context' } }, 'append'),
    event('assistant/message', { turn: 1, message: { id: 'a1', role: 'assistant', content: text('她收起伞，报出只有两人知道的暗号。') } }, 'append'),
    event('turn/end', { turn: 1, reason: { kind: 'completed' } }),
    event('turn/start', { turn: 2 }),
    event('user/message', { id: 'u2', role: 'user', content: text('玩家决定跟随她'), source: { kind: 'user' } }, 'append'),
    event('assistant/message', { turn: 2, message: { id: 'a2', role: 'assistant', content: text('两人穿过检票口，旧怀表在午夜响了一声。') } }, 'append'),
    event('turn/end', { turn: 2, reason: { kind: 'completed' } }),
    // Durable audit log from a discarded branch: deliberately absent from surface.
    event('user/message', { id: 'discarded', role: 'user', content: text(oldBranchText), source: { kind: 'user' } }, 'append'),
  ]
}

function makeHarness({ session, memory = {}, settings = {}, baseTokens = 100, tokenBySeq = {}, failMemoryUpdate = false, finishReason = { kind: 'stop' } }) {
  const services = new Map()
  const handlers = new Map()
  const requests = []
  const heads = new Map([[session.id, structuredClone(memory)]])
  const roleplay = {
    memoryHead: (id) => heads.get(id) ?? null,
    memoryUpdate: async (id, patch) => {
      if (failMemoryUpdate) throw new Error('simulated ledger outage')
      const next = { ...(heads.get(id) ?? {}), ...structuredClone(patch) }
      heads.set(id, next)
      return next
    },
    settings: () => settings,
    lockedFacts: () => { throw new Error('memory engine must not read card/worldbook locked facts') },
  }
  services.set('roleplay', roleplay)

  const tokenMeter = {
    measure(target) {
      const nodes = target.surface.nodes.map((seq) => {
        const value = tokenBySeq[seq] ?? 30
        return { seq, tokens: value, heuristicTokens: value }
      })
      return {
        nodes,
        surfaceTokens: nodes.reduce((sum, item) => sum + item.tokens, 0),
        totalTokens: baseTokens + nodes.reduce((sum, item) => sum + item.tokens, 0),
      }
    },
    estimateMessage() { return 12 },
  }
  const summaryText = [
      '## 1. 用户锁定的剧情事实', 'USER_LOCK（无）',
      '## 2. 主角与用户边界', '无',
      '## 3. 角色簿', '无',
      '## 4. 关系图', '无',
      '## 5. 世界规则', '无',
      '## 6. 时间线与剧情账本', '雨夜车站事件 (seq:1-3)',
      '## 7. 当前场景快照', '无',
      '## 8. 核心矛盾、伏笔、未解决问题', '无',
    ].join('\n')
  let nativeTaskHandler = async () => {
    if (finishReason?.kind === 'max-tokens') throw new Error('摘要达到输出上限')
    if (finishReason?.kind === 'error') throw new Error(finishReason.failure?.message ?? '原生任务失败')
    return summaryText
  }
  const nativeTask = async (options) => {
    requests.push({
      session: { id: options.session.id }, system: options.system, user: options.user,
      kind: options.kind, format: options.format, timeoutMs: options.timeoutMs,
      background:options.background, taskStage:options.taskStage, maxTokens:options.maxTokens,
      signal: options.signal, hasValidate: typeof options.validate === 'function', nativeTask: true,
    })
    options.signal?.throwIfAborted?.()
    let timer = null
    let removeAbort = null
    const abort = options.signal && new Promise((_, reject) => {
      const rejectAbort = () => reject(options.signal.reason ?? new Error('任务已取消'))
      options.signal.addEventListener('abort', rejectAbort, { once: true })
      removeAbort = () => options.signal.removeEventListener('abort', rejectAbort)
    })
    const timeout = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 && new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('原生任务超时')), options.timeoutMs)
    })
    try {
      const raw = await Promise.race([nativeTaskHandler(options), abort, timeout].filter(Boolean))
      const value = options.background && typeof raw==='string'?{text:raw,deltas:[],conflicts:[]}:raw
      options.signal?.throwIfAborted?.()
      const validated = options.validate ? options.validate(value) : value
      await options.onResult?.({actualRoute:{provider:'actual-provider',model:'actual-model',reasoningEffort:'medium'}})
      return validated
    } finally {
      if (timer) clearTimeout(timer)
      removeAbort?.()
    }
  }
  roleplay.nativeTask = nativeTask
  const ctx = {
    tokenMeter,
    sessions: { flush: async () => { ctx.flushed = true } },
    agentDefaultModel: { currentSelection: () => ({ provider: 'fallback', model: 'fallback' }) },
    logger: { info() {}, warn() {} },
    get(name) { return services.get(name) },
    provide(name, value) { services.set(name, value) },
    on(name, fn) { handlers.set(name, fn); return () => handlers.delete(name) },
    inject(names, fn) {
      if (names.includes('commands')) fn({ commands: { register() {} } })
    },
  }
  return {
    ctx, services, handlers, requests, heads, roleplay, summaryText,
    setNativeTaskHandler(handler) { nativeTaskHandler = handler },
  }
}

const defaultConfig = {
  targetContextTokens: 180,
  archiveTokens: 60,
  hysteresisTokens: 0,
  maxSummaryTokens: 4096,
  auto: false,
  autoNotesEveryTurns: 1,
}

async function testForkLedgerProjectionIsFailClosed() {
  const session = makeSession('child', [], [], { parentSession: 'parent', seedLength: 10 })
  const arrays = ['archives', 'archiveDigests', 'deltas', 'pendingConfirmations', 'lockedFacts', 'styleNotes', 'userPrefs']
  const record = {
    summary: 'PARENT_FUTURE_SUMMARY',
    summarySessionId: 'parent',
    surfaceCheckpointSeq: 99,
    lastCompactedSeq: 99,
  }
  for (const key of arrays) {
    record[key] = [
      { id: `${key}-seed`, sessionId: 'parent', atSeq: 3 },
      { id: `${key}-future`, sessionId: 'parent', atSeq: 99 },
      { id: `${key}-child`, sessionId: 'child', atSeq: 20 },
      { id: `${key}-conflict`, sessionId: 'parent', branchId: 'child', atSeq: 20 },
      { id: `${key}-unknown`, note: 'no provenance' },
      { id: `${key}-null`, sessionId: 'parent', atSeq: null },
      `${key}-malformed`,
    ]
  }

  const projected = filterMemoryRecordForBranch(record, session)
  assert.equal(projected.summary, '', 'an unproven copied parent summary must not cross a fork')
  assert.equal(projected.surfaceCheckpointSeq, null)
  assert.equal(projected.lastCompactedSeq, -1)
  for (const key of arrays) {
    assert.deepEqual(
      projected[key].map((item) => item.id),
      [`${key}-seed`, `${key}-child`],
      `${key} must retain only the inherited prefix and child-owned entries`,
    )
  }

  const inherited = filterMemoryRecordForBranch({
    summary: 'INHERITED_SAFE_SUMMARY',
    inheritedFrom: 'parent',
    inheritedAtSeedLength: 10,
    surfaceCheckpointSeq: null,
    lastCompactedSeq: -1,
  }, session)
  assert.equal(inherited.summary, 'INHERITED_SAFE_SUMMARY', 'fork copier provenance permits a lazy checkpoint fallback')

  const childOwned = filterMemoryRecordForBranch({
    summary: 'CHILD_SUMMARY',
    summarySessionId: 'child',
    summaryAtSeq: 20,
  }, session)
  assert.equal(childOwned.summary, 'CHILD_SUMMARY')
  assert.equal(childOwned.surfaceCheckpointSeq, 20)

  const safeBySeq = filterMemoryRecordForBranch({
    summary: 'PARENT_PRE_FORK_SUMMARY',
    summarySessionId: 'parent',
    summaryAtSeq: 4,
  }, session)
  assert.equal(safeBySeq.summary, 'PARENT_PRE_FORK_SUMMARY')
  assert.equal(safeBySeq.surfaceCheckpointSeq, 4)

  const visible = filterMemoryRecordForBranch({
    summary: 'STALE_LEDGER_SUMMARY',
    summarySessionId: 'parent',
    summaryAtSeq: 99,
  }, session, { text: 'VISIBLE_CHECKPOINT', seq: 4 })
  assert.equal(visible.summary, 'VISIBLE_CHECKPOINT', 'surface checkpoint is authoritative over a stale ledger')
  assert.equal(visible.surfaceCheckpointSeq, 4)

  const malformed = makeSession('malformed-child', [], [], { parentSession: 'parent', seedLength: 'not-a-number' })
  const malformedProjection = filterMemoryRecordForBranch({
    summary: 'SHOULD_NOT_LEAK',
    inheritedFrom: 'parent',
    inheritedAtSeedLength: 0,
    summaryAtSeq: 0,
    deltas: [{ id: 'unknown', atSeq: 0 }],
  }, malformed)
  assert.equal(malformedProjection.summary, '', 'malformed fork boundaries fail closed')
  assert.deepEqual(malformedProjection.deltas, [])

  const nullProvenance = filterMemoryRecordForBranch({
    summary: 'NULL_IS_NOT_SEQ_ZERO',
    summarySessionId: 'parent',
    surfaceCheckpointSeq: null,
    lastCompactedSeq: null,
  }, session)
  assert.equal(nullProvenance.summary, '', 'null sequence fields must not coerce to inherited seq zero')

  const headOwnerIsNotSummaryOwner = filterMemoryRecordForBranch({
    summary: 'PHASE_B_MUST_NOT_BLESS_STALE_SUMMARY',
    sessionId: 'child',
    summaryAtSeq: 99,
  }, session)
  assert.equal(headOwnerIsNotSummaryOwner.summary, '', 'generic head ownership cannot prove summary ownership')

  const conflictingSummaryOwners = filterMemoryRecordForBranch({
    summary: 'CONFLICTING_OWNER_ALIASES',
    summarySessionId: 'parent',
    summaryBranchId: 'child',
    summaryAtSeq: 99,
  }, session)
  assert.equal(conflictingSummaryOwners.summary, '', 'conflicting summary owner aliases fail closed')
}

async function testDurableArchivesRequireVisibleCheckpoint() {
  const source = [
    event('compaction/start', { compactionId: 'c-hidden' }),
    event('compaction/summary', {
      compactionId: 'c-hidden',
      shadowedRange: { start: 0, end: 0 },
      shadowedSeqs: [0],
    }),
    event('user/message', {
      role: 'user',
      content: text('<compacted-summary>HIDDEN</compacted-summary>'),
      source: { kind: 'plugin', plugin: 'compact', compactionId: 'c-hidden' },
    }, { op: 'replace', start: 0, end: 1 }),
    event('compaction/end', { compactionId: 'c-hidden' }),
  ]
  const hidden = makeSession('archive-hidden', source, [0, 1, 3])
  assert.deepEqual(durableCompactionArchives(hidden), [], 'log-only compaction from a discarded surface is not durable')

  const visible = makeSession('archive-visible', source, [2])
  const archives = durableCompactionArchives(visible)
  assert.equal(archives.length, 1)
  assert.equal(archives[0].compactionId, 'c-hidden')
}

async function testPlotOnlyAndDurableContract() {
  const events = completedStoryEvents()
  // Exclude the discarded seq 9 from current surface.
  const session = makeSession('root', events, [1, 2, 3, 6, 7])
  const h = makeHarness({
    session,
    memory: { summary: 'OLD_STORY', lockedFacts: [{ text: 'USER_LOCK' }], archives: [] },
    tokenBySeq: { 1: 35, 2: 50, 3: 45, 6: 35, 7: 45 },
  })
  await apply(h.ctx, defaultConfig)
  const engine = h.services.get('compaction')
  const agent = { session, options: {}, runMaintenance: (task) => task(new AbortController().signal) }
  const result = await engine.compactNow(agent, new AbortController().signal, 'command-1')
  assert.ok(result)
  assert.equal(h.requests.length, 1, 'one durable compaction must make exactly one LLM call')
  const prompt = h.requests[0].user
  assert.match(prompt, /OLD_STORY/)
  assert.match(prompt, /玩家走进雨夜车站/)
  assert.match(prompt, /USER_LOCK/)
  assert.doesNotMatch(prompt, /SECRET_CARD/)
  assert.doesNotMatch(prompt, /UNSELECTED_BRANCH/)
  assert.equal(h.requests[0].session.id, 'root')
  assert.equal(h.requests[0].kind, 'memory')
  assert.equal(h.requests[0].nativeTask, true)
  assert.equal(h.requests[0].format, 'text')
  assert.equal(h.requests[0].hasValidate, true)

  const summaryEvent = session.events.find((item) => item.type === 'compaction/summary')
  assert.equal(summaryEvent.data.provider,'actual-provider','compaction attributes the completed native task, not legacy worker configuration')
  assert.equal(summaryEvent.data.model,'actual-model')
  assert.equal(summaryEvent.data.nativeTask, true)
  assert.deepEqual(summaryEvent.data.rawOutput, summaryEvent.data.summary)
  assert.equal(summaryEvent.data.usage, undefined)
  const checkpoint = session.events[summaryEvent.seq + 1]
  assert.equal(checkpoint.type, 'user/message')
  assert.equal(checkpoint.data.source.plugin, 'compact')
  assert.equal(session.events.at(-1).type, 'compaction/end')
  assert.equal(h.ctx.flushed, true)
  assert.equal(h.heads.get('root').archives.at(-1).sessionId, 'root')
}

async function testForkIgnoresCopiedFutureSummary() {
  const session = makeSession(
    'child',
    completedStoryEvents({ cardText: 'CHILD_CONTEXT', oldBranchText: 'SIBLING_ONLY' }),
    [1, 2, 3, 6, 7],
    { parentSession: 'parent', seedLength: 5 },
  )
  const h = makeHarness({
    session,
    memory: { summary: 'PARENT_FUTURE_LEAK', lockedFacts: [], archives: [{ atSeq: 99 }] },
    tokenBySeq: { 1: 35, 2: 40, 3: 45, 6: 35, 7: 45 },
  })
  await apply(h.ctx, defaultConfig)
  const agent = { session, options: {}, runMaintenance: (task) => task(new AbortController().signal) }
  await h.services.get('compaction').compactNow(agent, new AbortController().signal)
  const prompt = h.requests[0].user
  assert.doesNotMatch(prompt, /PARENT_FUTURE_LEAK/)
  assert.doesNotMatch(prompt, /SIBLING_ONLY/)
}

async function testVisibleCheckpointRecoversFromLedgerFailure() {
  const events = completedStoryEvents()
  events.push(event('turn/start', { turn: 3 }))
  events.push(event('user/message', { id: 'u3', role: 'user', content: text('当前仍未完成的一轮'), source: { kind: 'user' } }, 'append'))
  const session = makeSession('recover', events, [1, 2, 3, 6, 7, 11])
  const h = makeHarness({
    session,
    memory: { summary: 'STALE_LEDGER', lockedFacts: [], archives: [] },
    failMemoryUpdate: true,
    tokenBySeq: { 1: 35, 2: 40, 3: 45, 6: 35, 7: 45, 11: 30 },
  })
  await apply(h.ctx, { ...defaultConfig, targetContextTokens: 100, archiveTokens: 60 })
  const agent = { session, options: {} }
  await h.services.get('compaction').compactIfNeeded(agent, 'pressure', new AbortController().signal)
  assert.equal(h.heads.get('recover').summary, 'STALE_LEDGER')
  await h.services.get('compaction').compactIfNeeded(agent, 'pressure', new AbortController().signal)
  const recoveryPrompt = h.requests[1].user
  assert.match(recoveryPrompt, /雨夜车站事件/)
  assert.doesNotMatch(recoveryPrompt, /STALE_LEDGER/)
}

async function testDurableLockRejectsOverlap() {
  const events = completedStoryEvents().slice(0, 9)
  events.push(event('compaction/start', { compactionId: 'orphan', turn: null }))
  const session = makeSession('locked', events, [1, 2, 3, 6, 7])
  const h = makeHarness({ session, memory: {}, tokenBySeq: { 1: 35, 2: 30, 3: 45, 6: 35, 7: 45 } })
  await apply(h.ctx, defaultConfig)
  const agent = { session, options: {}, runMaintenance: (task) => task(new AbortController().signal) }
  await assert.rejects(
    h.services.get('compaction').compactNow(agent, new AbortController().signal),
    /未闭合的记忆整理事务/,
  )
  assert.equal(h.requests.length, 0)
  assert.equal(session.events.filter((item) => item.type === 'compaction/start').length, 1)
}

async function testSummaryFailureClosesTransactionWithoutMutation() {
  const session = makeSession('truncated', completedStoryEvents(), [1, 2, 3, 6, 7])
  const originalSurface = [...session.surface.nodes]
  const h = makeHarness({
    session,
    memory: {},
    tokenBySeq: { 1: 35, 2: 30, 3: 45, 6: 35, 7: 45 },
    finishReason: { kind: 'max-tokens' },
  })
  await apply(h.ctx, defaultConfig)
  const agent = { session, options: {}, runMaintenance: (task) => task(new AbortController().signal) }
  await assert.rejects(
    h.services.get('compaction').compactNow(agent, new AbortController().signal),
    /达到输出上限/,
  )
  assert.deepEqual(session.surface.nodes, originalSurface)
  assert.equal(session.events.filter((item) => item.type === 'compaction/start').length, 1)
  const ends = session.events.filter((item) => item.type === 'compaction/end')
  assert.equal(ends.length, 1)
  assert.match(ends[0].data.error, /达到输出上限/)
  assert.equal(session.events.some((item) => item.type === 'compaction/summary'), false)
}

async function testPressureUsesWholeRequestButSummarizesPlot() {
  const events = [
    event('turn/start', { turn: 1 }),
    event('user/message', { id: 'u1', role: 'user', content: text('第一幕'), source: { kind: 'user' } }, 'append'),
    event('user/message', { id: 'ctx', role: 'user', content: text('VERY_LARGE_WORLDBOOK'), source: { kind: 'plugin', plugin: 'roleplay-context' } }, 'append'),
    event('assistant/message', { turn: 1, message: { id: 'a1', role: 'assistant', content: text('第一幕结束') } }, 'append'),
    event('turn/end', { turn: 1, reason: { kind: 'completed' } }),
    event('turn/start', { turn: 2 }),
    event('user/message', { id: 'u2', role: 'user', content: text('继续'), source: { kind: 'user' } }, 'append'),
  ]
  const session = makeSession('pressure', events, [1, 2, 3, 6])
  const h = makeHarness({
    session,
    memory: {},
    baseTokens: 150,
    tokenBySeq: { 1: 15, 2: 20, 3: 15, 6: 10 },
  })
  await apply(h.ctx, { ...defaultConfig, auto: false, targetContextTokens: 180, archiveTokens: 40 })
  const agent = { session, options: {} }
  const result = await h.services.get('compaction').compactIfNeeded(agent, 'pressure', new AbortController().signal)
  assert.ok(result, 'full request pressure should trigger plot compaction')
  assert.equal(session.events.find((item) => item.type === 'compaction/start').data.turn, 2)
  assert.doesNotMatch(h.requests[0].user, /VERY_LARGE_WORLDBOOK/)
}

async function testOnlyCanonicalAssistantClosingIsSummarized() {
  const events = [
    event('turn/start', { turn: 1 }),
    event('user/message', { id: 'u1', role: 'user', content: text('请继续剧情'), source: { kind: 'user' } }, 'append'),
    event('assistant/message', { turn: 1, message: { id: 'a-tool', role: 'assistant', content: text('我先检查一下工具。') } }, 'append'),
    event('tool/result', { turn: 1, content: text('TOOL_OUTPUT') }, 'append'),
    event('assistant/message', { turn: 1, message: { id: 'a-final', role: 'assistant', content: text('真正的小说正文在这里。') } }, 'append'),
    event('turn/end', { turn: 1, reason: { kind: 'completed' } }),
    event('turn/start', { turn: 2 }),
    event('user/message', { id: 'u2', role: 'user', content: text('下一步'), source: { kind: 'user' } }, 'append'),
  ]
  const session = makeSession('canonical', events, [1, 2, 3, 4, 7])
  const h = makeHarness({
    session,
    memory: {},
    baseTokens: 180,
    tokenBySeq: { 1: 25, 2: 25, 3: 25, 4: 35, 7: 20 },
  })
  await apply(h.ctx, { ...defaultConfig, targetContextTokens: 120, archiveTokens: 40 })
  const agent = { session, options: {} }
  await h.services.get('compaction').compactIfNeeded(agent, 'pressure', new AbortController().signal)
  const prompt = h.requests[0].user
  assert.match(prompt, /真正的小说正文在这里/)
  assert.doesNotMatch(prompt, /我先检查一下工具/)
  assert.doesNotMatch(prompt, /TOOL_OUTPUT/)
}

async function testAbortedTurnIsNotAnArchiveBoundary() {
  const events = [
    event('turn/start', { turn: 1 }),
    event('user/message', { id: 'u1', role: 'user', content: text('玩家输入仍应保留'), source: { kind: 'user' } }, 'append'),
    event('assistant/message', { turn: 1, message: { id: 'a1', role: 'assistant', content: text('ABORTED_FRAGMENT') } }, 'append'),
    event('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } }),
  ]
  const session = makeSession('aborted', events, [1, 2])
  const originalSurface = [...session.surface.nodes]
  const h = makeHarness({
    session,
    memory: {},
    baseTokens: 500,
    tokenBySeq: { 1: 100, 2: 100 },
  })
  await apply(h.ctx, { ...defaultConfig, targetContextTokens: 120, archiveTokens: 40 })
  const agent = { session, options: {}, runMaintenance: (task) => task(new AbortController().signal) }
  const result = await h.services.get('compaction').compactNow(agent, new AbortController().signal)
  assert.equal(result, null, 'an aborted turn must not be treated as a complete archive unit')
  assert.equal(h.requests.length, 0)
  assert.deepEqual(session.surface.nodes, originalSurface)
}

async function testMeterFailureIsNotAnEmptyRange() {
  const session = makeSession('meter-error', completedStoryEvents(), [1, 2, 3, 6, 7])
  const h = makeHarness({ session })
  h.ctx.tokenMeter.measure = () => { throw new Error('assistant/message has no matching step/start event') }
  await apply(h.ctx, defaultConfig)
  await assert.rejects(h.services.get('compaction').compactNow({ session }), /无法计量当前分支上下文.*matching step/)
  assert.equal(h.requests.length, 0)
}

async function testDirectorNotesDoNotNeedCompactionOrAlterSurface() {
  const session = makeSession('notes', completedStoryEvents(), [1, 2, 3, 6, 7])
  const original = [...session.surface.nodes]
  const originalLength = session.events.length
  const h = makeHarness({ session })
  h.ctx.tokenMeter.measure = () => { throw new Error('notes do not depend on metering') }
  await apply(h.ctx, defaultConfig)
  const result = await h.services.get('compaction').organizeNow({ session })
  assert.equal(result.changed, true)
  assert.equal(result.entries, 4)
  assert.deepEqual(session.surface.nodes, original)
  assert.equal(session.events.length, originalLength)
  assert.doesNotMatch(h.requests[0].user, /SECRET_CARD|UNSELECTED_BRANCH/)
  assert.ok(directorNotesForBranch(h.heads.get(session.id), session)?.text)
  const repeated = await h.services.get('compaction').organizeNow({ session })
  assert.equal(repeated.changed, false)
  assert.equal(h.requests.length, 1)
  session.append('user/message', { ...session.events[1].data, content: text('玩家改变了过去的行动') }, { surfaceOp: { op: 'replace', startSeq: 1, endSeq: 1 }, sourceEventSeqs: [1] })
  assert.equal(directorNotesForBranch(h.heads.get(session.id), session), null)
  await h.services.get('compaction').organizeNow({ session })
  assert.equal(h.requests.length, 2)
  assert.match(h.requests[1].user, /玩家改变了过去的行动/)
  assert.doesNotMatch(h.requests[1].user, /玩家走进雨夜车站/)
}

async function testDirectorNotesAppendOnlyNewEvidence() {
  const session = makeSession('notes-delta', completedStoryEvents(), [1, 2, 3, 6, 7])
  const h = makeHarness({ session })
  await apply(h.ctx, defaultConfig)
  const svc = h.services.get('compaction')
  await svc.organizeNow({ session })
  const original = structuredClone(h.heads.get(session.id).directorNotes)
  session.append('turn/start', { turn: 3 })
  session.append('user/message', { source: { kind: 'user' }, content: text('核对剩余两枚铜币。') }, { surfaceOp: 'append' })
  const body = session.append('assistant/message', { turn: 3, message: { id: 'new-body', content: text('两枚铜币仍在口袋里，先前第三枚已经支付车费。') } }, { surfaceOp: 'append' })
  session.append('turn/end', { turn: 3, reason: { kind: 'completed' } })
  h.heads.get(session.id).lockedFacts = [{ text: '新锁定：不能丢弃铜钥匙', sessionId: session.id, atSeq: body.seq }]
  h.setNativeTaskHandler(() => { throw new Error('delta provider failed') })
  await assert.rejects(svc.organizeNow({ session }), /delta provider failed/)
  assert.deepEqual(h.heads.get(session.id).directorNotes, original, 'failed delta cannot overwrite the verified prefix')
  h.setNativeTaskHandler(() => h.summaryText.replace('雨夜车站事件 (seq:1-3)', '更正：当前两枚铜币；第三枚已支付车费。'))
  await svc.organizeNow({ session })
  const notes = h.heads.get(session.id).directorNotes
  assert.ok(notes.text.startsWith(original.text), 'existing verified notes are preserved byte-for-byte by the backend')
  assert.match(notes.text, /当前两枚铜币/)
  assert.match(notes.text, /新锁定：不能丢弃铜钥匙/, 'the backend preserves newly locked facts even when the delta does not repeat them')
  assert.equal(notes.projectionMode, 'append-delta')
  assert.deepEqual(notes.updateSourceKeys, notes.sourceKeys.slice(original.sourceKeys.length))
  assert.equal(notes.updateSourceKeys.length, 2)
  assert.match(h.requests[1].system, /仅输出本次新增或更正/)
  assert.doesNotMatch(h.requests[1].user, /做增量合并/)
  const before = h.requests.length
  await svc.organizeNow({ session })
  assert.equal(h.requests.length, before, 'committed deltas are not appended twice')
}

async function testHistoryOnlyExpandsSelectedCompaction() {
  const session = makeSession('history', completedStoryEvents(), [1, 2, 3, 6, 7])
  session.append('compaction/start', { compactionId: 'c1', turn: null })
  session.append('compaction/summary', { compactionId: 'c1', shadowedSeqs: [1, 2, 3], shadowedRange: { start: 1, end: 3 } })
  session.append('user/message', { id: 'summary', role: 'user', content: text('SUMMARY_NOT_PLOT'), source: { kind: 'plugin', plugin: 'compact', compactionId: 'c1' } },
    { surfaceOp: { op: 'replace', startSeq: 1, endSeq: 3 }, sourceEventSeqs: [1, 2, 3] })
  session.append('compaction/end', { compactionId: 'c1', turn: null })
  session.append('assistant/message', { ...session.events[7].data, message: { ...session.events[7].data.message, content: text('修改后，怀表没有响。') } },
    { surfaceOp: { op: 'replace', startSeq: 7, endSeq: 7 }, sourceEventSeqs: [7] })
  const history = selectedStoryHistory(session)
  assert.equal(history.length, 4)
  assert.match(history.map((entry) => entry.text).join('\n'), /雨夜车站/)
  assert.doesNotMatch(history.map((entry) => entry.text).join('\n'), /SECRET_CARD|UNSELECTED_BRANCH|SUMMARY_NOT_PLOT|午夜响了一声/)
  const found = queryStoryHistory(session, { query: '怀表' })
  assert.equal(found.entries.length, 1)
  assert.match(found.entries[0].text, /没有响/)
  const firstPage = queryStoryHistory(session, { limit: 2 })
  const older = queryStoryHistory(session, { limit: 2, beforeSeq: firstPage.nextBeforeSeq })
  assert.deepEqual([...older.entries, ...firstPage.entries].map((entry) => entry.seq), history.map((entry) => entry.seq))
  assert.equal(readStoryHistory(session, { seq: history[0].seq }).text, history[0].text)
  assert.throws(() => readStoryHistory(session, { seq: 7 }), /不属于当前选中分支/)
}

async function testAutomaticNotesPersistWithoutBlockingOrMutatingPlot() {
  const session = makeSession('auto-notes', completedStoryEvents(), [1, 2, 3, 6, 7])
  const h = makeHarness({ session })
  await apply(h.ctx, defaultConfig)
  const eventsBefore = session.events.length
  const surfaceBefore = [...session.surface.nodes]
  assert.equal(h.handlers.get('session/event')(session, session.events[8]), undefined)
  await new Promise((resolve) => setTimeout(resolve, 10))
  await h.services.get('compaction').organizeIfNeeded({ session })
  assert.ok(h.heads.get(session.id).directorNotes.text)
  assert.equal(h.requests.length, 1)
  assert.equal(session.events.length, eventsBefore)
  assert.deepEqual(session.surface.nodes, surfaceBefore)
  assert.equal(h.heads.get(session.id).directorCheckpoints.length, 1)
}

async function testAutomaticFailuresBackOff() {
  const session = makeSession('auto-backoff', completedStoryEvents(), [1, 2, 3, 6, 7])
  const h = makeHarness({ session, finishReason: { kind: 'error', failure: { message: 'provider unavailable' } } })
  await apply(h.ctx, defaultConfig)
  const svc = h.services.get('compaction')
  await svc.organizeIfNeeded({ session })
  await svc.organizeIfNeeded({ session })
  assert.equal(h.requests.length, 1, 'retrying an idle event must not repeat a failing provider call')
  session.append('turn/start', { turn: 3 })
  await assert.rejects(svc.compactIfNeeded({ session }, 'context-overflow'), /provider unavailable/)
  assert.equal(await svc.compactIfNeeded({ session }, 'context-overflow'), null)
  assert.equal(h.requests.length, 2, 'failed automatic compaction must also back off')
  assert.deepEqual(session.surface.nodes, [1, 2, 3, 6, 7])
}

async function testCompactionReusesOnlyExactValidatedPrefix() {
  const session = makeSession('cached-prefix', completedStoryEvents().slice(0, 5), [1, 2, 3])
  const h = makeHarness({ session })
  await apply(h.ctx, defaultConfig)
  const svc = h.services.get('compaction')
  await svc.organizeNow({ session })
  for (const item of completedStoryEvents().slice(5, 9)) session.append(item.type, item.data, { surfaceOp: item.surfaceOp })
  const result = await svc.compactNow({ session })
  assert.ok(result)
  assert.equal(h.requests.length, 1, 'exact verified notes avoid another summarization call')
  const record = session.events.find((entry) => entry.type === 'compaction/summary')
  assert.equal(record.data.nativeTask, undefined, 'reused result must not claim a new model request')
  assert.equal(record.data.provider, 'unknown', 'reused legacy notes must not be attributed to the currently selected model')
  assert.equal(record.data.model, 'unknown')
  assert.equal(record.data.usage, undefined)
  assert.equal(selectedStoryHistory(session).length, 4, 'archive must retain complete queryable raw plot')

  const later = makeSession('future-notes', completedStoryEvents(), [1, 2, 3, 6, 7])
  const h2 = makeHarness({ session: later })
  await apply(h2.ctx, defaultConfig)
  await h2.services.get('compaction').organizeNow({ session: later })
  await h2.services.get('compaction').compactNow({ session: later })
  assert.equal(h2.requests.length, 2, 'notes containing newer plot cannot replace an earlier prefix')
}

async function testManualNotesWinOverBackgroundWriter() {
  const session = makeSession('manual-wins', completedStoryEvents(), [1, 2, 3, 6, 7])
  const h = makeHarness({ session })
  let release
  const pause = new Promise((resolve) => { release = resolve })
  h.setNativeTaskHandler(async () => {
    await pause
    return h.summaryText
  })
  await apply(h.ctx, defaultConfig)
  const svc = h.services.get('compaction')
  const background = svc.organizeIfNeeded({ session })
  await Promise.resolve()
  await svc.saveDirectorNotes(session, 'USER_EDITED_DIRECTOR_NOTES')
  release()
  await background
  assert.equal(h.heads.get(session.id).directorNotes.text, 'USER_EDITED_DIRECTOR_NOTES')
  assert.equal(h.heads.get(session.id).directorNotes.manual, true)
}

async function testAutomaticTimeoutIsActuallyBounded() {
  const session = makeSession('timeout-bounded', completedStoryEvents(), [1, 2, 3, 6, 7])
  session.append('turn/start', { turn: 3 })
  const h = makeHarness({ session })
  h.setNativeTaskHandler(() => new Promise(() => {}))
  await apply(h.ctx, { ...defaultConfig, autoTimeoutMs: 1000 })
  const started = Date.now()
  await assert.rejects(h.services.get('compaction').compactIfNeeded({ session }, 'context-overflow'), /超时/)
  assert.ok(Date.now() - started < 2500, 'uncooperative stream must not hold the pre-step indefinitely')
  assert.deepEqual(session.surface.nodes, [1, 2, 3, 6, 7])
  assert.equal(session.events.at(-1).type, 'compaction/end')
  assert.ok(session.events.at(-1).data.error)
}

async function testPrepareUsesOnlyVerifiedNotesWithoutWaitingForBackground() {
  const session = makeSession('prepare-branch', completedStoryEvents(), [1, 2, 3, 6, 7])
  const h = makeHarness({ session })
  let release, started
  const pause = new Promise(resolve => { release = resolve })
  const entered = new Promise(resolve => { started = resolve })
  let first = true
  h.setNativeTaskHandler(async () => {
    if (first) { first = false; started(); await pause }
    return h.summaryText
  })
  await apply(h.ctx, defaultConfig)
  const svc = h.services.get('compaction')
  const old = svc.organizeIfNeeded({session})
  await entered
  const replacement = session.append('assistant/message', { turn: 2,
    message:{id:'a2-new',role:'assistant',content:text('当前选中四号分支，留在车站，没有穿过检票口。')} },
    {surfaceOp:{op:'replace',startSeq:7,endSeq:7}})
  let settled = false
  const prepare = svc.prepareForTurn({session}).then(value=>{settled=true;return value})
  const result = await Promise.race([prepare,new Promise((_,reject)=>setTimeout(()=>reject(new Error('preparation waited on background notes')),100))])
  assert.equal(settled,true,'current branch preparation is independent of the live background job')
  assert.equal(svc.directorNotes(session),null,'stale notes are never exposed while waiting for a rebuild')
  release(); await old
  await svc.organizeNow({session})
  assert.equal(result.status,'ready')
  const notes = svc.directorNotes(session)
  assert.equal(notes.schemaVersion,1)
  assert.equal(notes.branchId,session.id)
  assert.ok(notes.generationId)
  assert.ok(notes.sourceSeqs.includes(replacement.seq))
  assert.ok(!notes.sourceSeqs.includes(7),'discarded sibling output must not own current notes')
  assert.equal(notes.pendingEntries,0)
  const repeatCount = h.requests.length
  await svc.prepareForTurn({session})
  assert.equal(h.requests.length,repeatCount,'verified current notes are reused without another model request')
  h.heads.set(session.id, { ...h.heads.get(session.id), summary:'OLD_SIBLING_SUMMARY',
    deltas:[{atSeq:7,summary:'OLD_SIBLING_FACT'},{atSeq:replacement.seq,summary:'SELECTED_FACT'}] })
  const projected = svc.memoryProjection(session)
  assert.equal(projected.summary,'','a non-visible old summary cannot be used as current branch recall input')
  assert.deepEqual(projected.deltas.map(item=>item.summary),['SELECTED_FACT'])
}

async function testPostCompactionPreparationMatrix() {
  for (const operation of ['next-turn','regenerate','delete','edit-save','edit-send']) {
    const session = makeSession(`matrix-${operation}`, completedStoryEvents(), [1,2,3,6,7])
    session.append('compaction/start',{compactionId:'selected-checkpoint',turn:null})
    session.append('compaction/summary',{compactionId:'selected-checkpoint',shadowedSeqs:[1,2,3],shadowedRange:{start:1,end:3}})
    session.append('user/message',{id:'checkpoint',content:text('VERIFIED_PREFIX'),source:{kind:'plugin',plugin:'compact',compactionId:'selected-checkpoint'}},
      {surfaceOp:{op:'replace',startSeq:1,endSeq:3},sourceEventSeqs:[1,2,3]})
    session.append('compaction/end',{compactionId:'selected-checkpoint',turn:null})
    const h=makeHarness({session})
    await apply(h.ctx,defaultConfig)
    const svc=h.services.get('compaction')
    await svc.organizeNow({session})
    const auditBefore=structuredClone(session.events)
    if(operation==='regenerate') session.append('assistant/message',{turn:2,message:{id:'variant4',content:text('四号版本留在车站')}},
      {surfaceOp:{op:'replace',startSeq:7,endSeq:7},sourceEventSeqs:[7]})
    if(operation==='delete') session.append('user/message',{id:'deleted-range',content:[],source:{kind:'plugin',plugin:'test-branch-tombstone'}},
      {surfaceOp:{op:'replace',startSeq:6,endSeq:7},sourceEventSeqs:[6,7]})
    if(operation==='edit-save'||operation==='edit-send') session.append('user/message',{id:'edited-user',content:text('玩家改为留在原地'),source:{kind:'user'}},
      {surfaceOp:{op:'replace',startSeq:6,endSeq:operation==='edit-send'?7:6},sourceEventSeqs:operation==='edit-send'?[6,7]:[6]})
    if(operation==='edit-send') session.append('assistant/message',{turn:2,message:{id:'edited-result',content:text('两人留在车站')}},{surfaceOp:'append'})
    session.append('turn/start',{turn:3})
    session.append('user/message',{id:'u3',source:{kind:'user'},content:text('继续当前选择')} ,{surfaceOp:'append'})
    await svc.prepareForTurn({session})
    const beforeAutomatic=h.requests.length
    await svc.organizeIfNeeded({session})
    if(['regenerate','delete','edit-save','edit-send'].includes(operation)) {
      assert.equal(h.requests.length,beforeAutomatic,`${operation}: rewriting an existing story slot does not start automatic notes`)
    }
    if(!svc.directorNotes(session)) {
      session.append('assistant/message',{turn:3,message:{id:`manual-${operation}`,content:text('手动整理前的当前分支正文')}},{surfaceOp:'append'})
      session.append('turn/end',{turn:3,reason:{kind:'completed'}})
      await svc.rebuildDirectorNotes({session})
    }
    const notes=svc.directorNotes(session)
    assert.ok(notes,`${operation}: selected-branch notes must be ready`)
    assert.equal(notes.pendingEntries,0)
    assert.deepEqual(notes.sourceSeqs,selectedStoryHistory(session).map(entry=>entry.seq),`${operation}: exact selected source evidence`)
    assert.deepEqual(session.events.slice(0,auditBefore.length),auditBefore,'audit prefix remains append-only')
    if(['regenerate','delete','edit-send'].includes(operation)) assert.ok(!notes.sourceSeqs.includes(7),`${operation}: discarded 3/3 output cannot own 4/4 notes`)
  }
}

await testPostCompactionPreparationMatrix()
{
  const session=makeSession('import-management',[
    event('turn/start',{turn:1}),
    event('user/message',{id:'import-user',source:{kind:'user'},content:text('导入这张角色卡，保留设置；这是管理操作，不是剧情')},'append'),
    event('tool/call',{turn:1,name:'rp_card_import_begin',callId:'import-call'}),
    event('assistant/message',{turn:1,message:{id:'opening',content:text('开场：雨夜车站，守夜人点亮灯。')}},'append'),
    event('turn/end',{turn:1,reason:{kind:'completed'}}),
  ],[1,3])
  assert.deepEqual(selectedStoryHistory(session).map(entry=>entry.seq),[3],
    'native import management input must not become plot memory; preserve its actual opening')
  const h=makeHarness({session})
  await apply(h.ctx,defaultConfig)
  await h.services.get('compaction').organizeNow({session})
  assert.doesNotMatch(h.requests[0].user,/导入这张角色卡/)
  assert.match(h.requests[0].user,/雨夜车站/)
}
async function testDeletedBranchRejectsLateMemoryWorkers() {
  for (const method of ['organizeNow', 'compactNow']) {
    const session = makeSession(`deleted-${method}`, completedStoryEvents(), [1,2,3,6,7])
    const h = makeHarness({session})
    let active = true, release, started
    const entered = new Promise(resolve => { started = resolve })
    const pending = new Promise(resolve => { release = resolve })
    h.services.get('roleplay').isStoryBranchActive = () => active
    h.setNativeTaskHandler(async () => { started(); await pending; return h.summaryText })
    await apply(h.ctx, defaultConfig)
    const surface = [...session.surface.nodes]
    const job = h.services.get('compaction')[method]({session})
    const rejection = assert.rejects(job, /分支已删除/)
    await entered
    active = false
    release()
    await rejection
    assert.deepEqual(session.surface.nodes, surface, 'deleted branch must not accept a late compaction replacement')
    assert.equal(h.heads.get(session.id)?.directorNotes, undefined, 'deleted branch must not accept a late notes checkpoint')
  }
}
async function testAfterStoryProofFeedsDirectorNotesAfterMaintenanceAbort() {
  const session=makeSession('after-story-notes',[
    event('turn/start',{turn:1}),
    event('user/message',{id:'u1',source:{kind:'user'},content:text('我推开温室的门。')},'append'),
    event('assistant/message',{turn:1,message:{id:'story',content:text('铜灯熄灭后，温室门缓缓打开。')}},'append'),
    event('user/message',{id:'after-story',source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'after-story',storySeq:2,turn:1},content:text('正文已经落盘。')},'append'),
    event('assistant/message',{turn:1,message:{id:'internal',content:text('内部维护失败信息。')}},'append'),
    event('turn/end',{turn:1,reason:{kind:'aborted'}}),
  ],[1,2,3,4])
  const h=makeHarness({session})
  await apply(h.ctx,defaultConfig)
  await h.services.get('compaction').organizeNow({session})
  assert.match(h.requests[0].user,/温室门缓缓打开/)
  assert.doesNotMatch(h.requests[0].user,/内部维护失败信息/)
  assert.deepEqual(h.heads.get(session.id).directorNotes.sourceSeqs,[1,2])
}
async function testNotesFinishBeforeTurnEnd() {
 const session=makeSession('notes-before-end',[
  event('turn/start',{turn:1}),
  event('user/message',{id:'u',source:{kind:'user'},content:text('推开温室门。')},'append'),
  event('assistant/message',{turn:1,message:{id:'body',content:text('温室门打开，铜灯熄灭。')}},'append'),
  event('user/message',{source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'after-story',storySeq:2,turn:1},content:text('维护阶段。')},'append'),
 ],[1,2,3])
 const h=makeHarness({session});await apply(h.ctx,defaultConfig)
 await h.services.get('compaction').finishTurn({session})
 await h.services.get('compaction').organizeIfNeeded({session})
 assert.deepEqual(h.heads.get(session.id).directorNotes.sourceSeqs,[1,2])
 const count=h.requests.length
 await h.services.get('compaction').finishTurn({session})
 assert.equal(h.requests.length,count,'completed notes do not create another maintenance model request')
}
async function testThreeCanonicalTurnsRunAcrossForegroundTurns() {
 const session=makeSession('three-canonical-turns',completedStoryEvents(),[1,2,3,6,7])
 const h=makeHarness({session,settings:{autoNotesEveryTurns:3}});await apply(h.ctx,{...defaultConfig,autoNotesEveryTurns:1})
 const svc=h.services.get('compaction')
 await svc.finishTurn({session});await svc.organizeIfNeeded({session})
 assert.equal(h.requests.length,0,'two canonical turns do not start a memory model')
 const appendTurn=(turn,label)=>{
   session.append('turn/start',{turn})
   session.append('user/message',{id:`u${turn}`,source:{kind:'user'},content:text(label)},{surfaceOp:'append'})
   const body=session.append('assistant/message',{turn,message:{id:`a${turn}`,content:text(`${label}的结果`)}},{surfaceOp:'append'})
   session.append('turn/end',{turn,reason:{kind:'completed'}})
   return body
 }
 const third=appendTurn(9,'第三次推进')
 const firstEvidence=selectedStoryHistory(session).find(entry=>entry.role==='assistant')
 let release,started
 const pause=new Promise(resolve=>{release=resolve}),entered=new Promise(resolve=>{started=resolve})
 h.setNativeTaskHandler(async()=>{started();await pause;return {text:h.summaryText,
   deltas:[{evidenceSeq:firstEvidence.seq,summary:'第一回合的事实',status:'established'}],
   conflicts:[{evidenceSeq:third.seq,claim:'新记录',canon:'旧记录',severity:'medium'}]}})
 const background=svc.organizeIfNeeded({session});await entered
 assert.equal(h.requests[0].background,true)
 assert.equal(h.requests[0].taskStage,'background-notes')
 assert.equal(h.requests[0].maxTokens,4096,'notes must pass its configured cap to the native child')
 assert.equal(h.requests[0].timeoutMs,300000)
 const fourth=appendTurn(15,'第四次推进')
 try {
   const parent=new AbortController()
   const prepared=await Promise.race([svc.prepareForTurn({session},parent.signal),
     new Promise((_,reject)=>setTimeout(()=>reject(new Error('foreground blocked on background memory')),100))])
   assert.equal(prepared.status,'ready')
   parent.abort()
   assert.equal(h.requests[0].signal.aborted,false,'next foreground turn cancellation does not cancel the prior independent task')
 } finally {release()}
 await background
 const notes=svc.directorNotes(session)
 assert.ok(notes)
 const head=h.heads.get(session.id)
 assert.equal(head.deltas.length,1,'one background result commits ledger and notes together')
 assert.equal(head.pendingConfirmations.length,1,'continuity evidence is retained without a separate per-turn model call')
 assert.equal(head.deltas[0].sourceGeneration,notes.generationId)
 assert.equal(head.deltas[0].schemaVersion,1)
 assert.ok(head.deltas[0].sourceKey.startsWith(`${firstEvidence.seq}:`))
 assert.equal(head.deltas[0].atSeq,firstEvidence.seq,'fork provenance follows each fact, not the end of the three-turn batch')
 assert.equal(head.deltas[0].turnId,firstEvidence.turn)
 assert.ok(!notes.sourceSeqs.includes(fourth.seq),'running snapshot does not claim later plot')
 assert.equal(head.notesCadence.schemaVersion,1,'automatic notes persist a versioned cadence watermark')
 assert.deepEqual(head.notesCadence.slots.map(slot=>slot.turn),[1,2,9], 'watermark records canonical story slots, not text hashes')
 assert.equal(memoryNotesCadence(session,h.heads.get(session.id)).pendingTurns,1)
 await svc.organizeIfNeeded({session})
 assert.equal(h.requests.length,1,'newer plot is coalesced until three more canonical turns')
 session.append('assistant/message',{turn:15,message:{id:'a15-reroll',content:text('第四回合重生成')}},
   {surfaceOp:{op:'replace',startSeq:fourth.seq,endSeq:fourth.seq}})
 await svc.organizeIfNeeded({session})
 assert.equal(h.requests.length,1,'regenerating the unsummarized fourth turn does not trigger a new batch')
}
async function testBackgroundRejectsInventedEvidenceBeforeCommit() {
 const session=makeSession('background-bad-evidence',completedStoryEvents(),[1,2,3,6,7])
 const h=makeHarness({session});await apply(h.ctx,defaultConfig)
 h.setNativeTaskHandler(()=>({text:h.summaryText,deltas:[{evidenceSeq:9999,summary:'不存在的来源',status:'established'}],conflicts:[]}))
 await h.services.get('compaction').organizeIfNeeded({session})
 assert.equal(h.heads.get(session.id)?.directorNotes,undefined)
 assert.equal(h.heads.get(session.id)?.deltas?.length??0,0)
}
async function testWindowEvictionRequiresAllCanonicalEvidence() {
 const session=makeSession('eviction-gate',completedStoryEvents(),[1,2,3,6,7])
 const h=makeHarness({session});await apply(h.ctx,{...defaultConfig,autoNotesEveryTurns:3})
 const svc=h.services.get('compaction')
 assert.equal(typeof svc.ensureWindowCheckpoint,'function','window eviction has a strict persistence barrier')
 assert.equal(await svc.organizeIfNeeded({session}),null,'routine two-turn window is below cadence')
 const before=structuredClone(session.events)
 const result=await svc.ensureWindowCheckpoint({session})
 assert.equal(result.status,'ready')
 assert.deepEqual(result.sourceSeqs,selectedStoryHistory(session).map(e=>e.seq),'even one unsummarized canonical turn must be covered before eviction')
 assert.equal(h.requests.length,1)
 assert.equal(h.requests[0].background,true)
 assert.deepEqual(session.events,before,'persistence gate does not itself cut the window')
 await svc.ensureWindowCheckpoint({session})
 assert.equal(h.requests.length,1,'already saved source does not trigger another model review')
 const changed=session.append('assistant/message',{turn:2,message:{id:'changed',content:text('第二回合改写了结果')}},{surfaceOp:{op:'replace',startSeq:7,endSeq:7}})
 h.setNativeTaskHandler(()=>{throw new Error('provider unavailable')})
 await assert.rejects(svc.ensureWindowCheckpoint({session}),/检查点|未保存/)
 assert.ok(session.surface.nodes.includes(changed.seq),'failed save cannot evict the edited body')
 assert.equal(svc.directorNotes(session),null,'the old source checkpoint is no longer eligible')
}
async function testOwnedHardWindowSkipsAutomaticCompaction() {
 const session=makeSession('owned-window',completedStoryEvents(),[1,2,3,6,7])
 const h=makeHarness({session,baseTokens:999999})
 h.roleplay.ownsMemoryPreparation=true
 await apply(h.ctx,{...defaultConfig,auto:true,autoNotes:false})
 await h.services.get('compaction').prepareForTurn({session})
 assert.equal(h.requests.length,0,'hard-window owner does not run a competing pressure summary before story')
 assert.equal(session.events.some(e=>e.type==='compaction/start'),false)
}
async function testEvictionFinishesTailAfterRunningSnapshot() {
 const session=makeSession('eviction-running',completedStoryEvents(),[1,2,3,6,7])
 const h=makeHarness({session});await apply(h.ctx,{...defaultConfig,autoNotesEveryTurns:2})
 let started,release
 const began=new Promise(resolve=>{started=resolve}),hold=new Promise(resolve=>{release=resolve})
 let calls=0
 h.setNativeTaskHandler(async()=>{if(++calls===1){started();await hold}return h.summaryText})
 const svc=h.services.get('compaction'),background=svc.organizeIfNeeded({session})
 await began
 session.append('turn/start',{turn:3})
 session.append('user/message',{source:{kind:'user'},content:text('第三次行动')},{surfaceOp:'append'})
 session.append('assistant/message',{turn:3,message:{content:text('第三次行动的结果')}},{surfaceOp:'append'})
 session.append('turn/end',{turn:3,reason:{kind:'completed'}})
 const gate=svc.ensureWindowCheckpoint({session})
 release();await background
 const proof=await gate
 assert.equal(calls,2,'finish the frozen prefix, then save only the newly completed tail')
 assert.deepEqual(proof.sourceSeqs,selectedStoryHistory(session).map(e=>e.seq))
}
async function testResumeCompactionInsideOpenTurn(){
 const session=makeSession('resume-open-turn',completedStoryEvents(),[1,2,3,6,7])
 session.append('turn/start',{turn:3})
 const h=makeHarness({session});await apply(h.ctx,defaultConfig)
 const result=await h.services.get('compaction').resumeTask({session,runMaintenance(){throw new Error('must stay in the main loop')}},undefined,'compaction')
 assert.ok(result,'an inline compaction checkpoint resumes inside its existing turn')
 assert.equal(session.events.findLast(e=>e.type==='compaction/start').data.turn,3)
 assert.equal(session.events.findLast(e=>e.type==='compaction/end').data.error,undefined)
}
await testResumeCompactionInsideOpenTurn()
await testThreeCanonicalTurnsRunAcrossForegroundTurns()
await testBackgroundRejectsInventedEvidenceBeforeCommit()
await testWindowEvictionRequiresAllCanonicalEvidence()
await testOwnedHardWindowSkipsAutomaticCompaction()
await testEvictionFinishesTailAfterRunningSnapshot()
await testDirectorNotesAppendOnlyNewEvidence()
await testNotesFinishBeforeTurnEnd()
await testDeletedBranchRejectsLateMemoryWorkers()
await testAfterStoryProofFeedsDirectorNotesAfterMaintenanceAbort()
await testPrepareUsesOnlyVerifiedNotesWithoutWaitingForBackground()
await testForkLedgerProjectionIsFailClosed()
await testDurableArchivesRequireVisibleCheckpoint()
await testPlotOnlyAndDurableContract()
await testForkIgnoresCopiedFutureSummary()
await testVisibleCheckpointRecoversFromLedgerFailure()
await testDurableLockRejectsOverlap()
await testSummaryFailureClosesTransactionWithoutMutation()
await testPressureUsesWholeRequestButSummarizesPlot()
await testOnlyCanonicalAssistantClosingIsSummarized()
await testAbortedTurnIsNotAnArchiveBoundary()
await testMeterFailureIsNotAnEmptyRange()
await testDirectorNotesDoNotNeedCompactionOrAlterSurface()
await testHistoryOnlyExpandsSelectedCompaction()
await testAutomaticNotesPersistWithoutBlockingOrMutatingPlot()
await testAutomaticFailuresBackOff()
await testCompactionReusesOnlyExactValidatedPrefix()
await testManualNotesWinOverBackgroundWriter()
await testAutomaticTimeoutIsActuallyBounded()
{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/memory-compaction-legacy-v1.json',import.meta.url),'utf8'))
 assert.equal(fixture.schemaVersion,1)
 const normalize=value=>{
  const ids=new Map()
  return JSON.parse(JSON.stringify(value,(_,item)=>{
   if(typeof item==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(item)) {
    if(!ids.has(item))ids.set(item,`generated-${ids.size+1}`)
    return ids.get(item)
   }
   return item
  }))
 }
 const now=Date.now
 try {
  Date.now=()=>1000
  for(const sample of fixture.cases) {
   const session=makeSession(`legacy-compaction-${sample.manual}`,completedStoryEvents(),[1,2,3,6,7])
   if(!sample.manual)session.append('turn/start',{turn:3})
   const h=makeHarness({session}),measure=h.ctx.tokenMeter.measure
   let nodeReads=0
   h.ctx.tokenMeter.measure=target=>{const measured=measure(target);return {...measured,get nodes(){nodeReads++;return measured.nodes}}}
   await apply(h.ctx,defaultConfig)
   const before=session.events.length
   const result=sample.manual?await h.services.get('compaction').compactNow({session},undefined,'fixture-command')
    :await h.services.get('compaction').compactIfNeeded({session},'context-overflow')
   // Preserve the historical golden file; only normalize expected wire fields.
   // Production does not translate alpha.3 archives during this breaking upgrade.
   const expected=structuredClone(sample.expected)
   for(const event of expected.events) {
    const op=event.surfaceOp
    if(op?.op==='replace')event.surfaceOp={op:'replace',startSeq:op.start,endSeq:op.end}
   }
   assert.deepEqual(normalize({result,events:session.events.slice(before),surface:session.surface.nodes,head:h.heads.get(session.id),requests:h.requests,flushed:Boolean(h.ctx.flushed)}),expected,
    'compaction request, provenance and ledger mirror survive the alpha.6 surface field rename')
   assert.equal(sample.nodeReads,4,'old selection recalculates the story surface for pressure')
   assert.equal(nodeReads,2,'typed selection reuses its existing surface projection')
  }
 } finally {Date.now=now}
 console.log('memory-compaction migration: legacy manual/automatic transactions match; one surface projection per selection')
}
console.log('roleplay-memory-engine tests: ok')
