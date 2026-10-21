import assert from 'node:assert/strict'
import {test} from 'node:test'
import {assertMemoryAgreement, queryMemoryAgreements} from '../lib/memory/memory-agreements.js'
import type {MemoryAgreement} from '../src/memory/memory-agreements.ts'
import {apply} from '../lib/memory/roleplay-memory-engine.js'
import type {MemoryContext, MemorySession, RoleplayMemoryHost} from '../src/memory/roleplay-memory-engine.ts'

function agreement(fields: Partial<MemoryAgreement> = {}): MemoryAgreement {
  return {schemaVersion:1, participants:['阿岚', '小禾'], subject:'归还借来的书',
    conditions:['先找到缺失的书页'], time:null, place:null, ...fields}
}
function delta(evidenceSeq: number, value: MemoryAgreement, status: 'established' | 'uncertain' = 'established') {
  return {schemaVersion:1, agreement:value, summary:'关于借书的约定', status, evidenceSeq,
    sourceKey:`${evidenceSeq}:original-source-key`, sessionId:'original-owner', sourceGeneration:'original-notes-generation'}
}

test('agreement admission retains complete elements and explicitly unknown fields', () => {
  const value = agreement({time:'明天下午', place:'旧图书馆门口'})
  assert.doesNotThrow(() => assertMemoryAgreement(value))
  assert.doesNotThrow(() => assertMemoryAgreement(agreement({participants:[], conditions:[]})))
  assert.doesNotThrow(() => assertMemoryAgreement({...value, authorDetail:'保留未知字段'}))
  for (const invalid of [null, {...value, schemaVersion:2}, {...value, subject:'  '},
    {...value, participants:'阿岚'}, {...value, conditions:[42]}, {...value, time:undefined}, {...value, place:{}}]) {
    assert.throws(() => assertMemoryAgreement(invalid), /人物约定格式无效/)
  }
  const row = delta(2, agreement({participants:[], conditions:[]}), 'uncertain')
  const result = queryMemoryAgreements('current-branch', [row])
  assert.deepEqual(result.entries, [{agreement:row.agreement, summary:row.summary, status:'uncertain', evidenceSeq:2,
    sourceKey:row.sourceKey, sessionId:'original-owner', sourceGeneration:'original-notes-generation'}])
  assert.equal(result.entries[0]!.agreement.time, null)
  assert.equal(result.entries[0]!.agreement.place, null)
})

test('agreement search matches every element and summary, then applies source bound and result limit', () => {
  const first = delta(2, agreement({time:'明天下午', place:'旧图书馆门口'}))
  const second = {...delta(8, agreement({subject:'说明借书缘由'}), 'uncertain'), summary:'另有一封未拆的信'}
  const third = delta(12, agreement({subject:'一起修补书页'}))
  const old = {evidenceSeq:6, summary:'阿岚答应归还借书', status:'established'}
  const future = {...delta(10, agreement()), agreement:{...agreement(), schemaVersion:2}}
  const rows = [third, old, first, second, future]
  for (const query of ['阿岚', '归还', '缺失', '明天下午', '图书馆', '未拆的信']) {
    assert.ok(queryMemoryAgreements('current-branch', rows, {query}).entries.length, query)
  }
  const combined = queryMemoryAgreements('current-branch', rows, {query:'阿岚 图书馆 明天', beforeSeq:8, limit:1})
  assert.equal(combined.totalEntries, 3)
  assert.equal(combined.matchedEntries, 1)
  assert.deepEqual(combined.entries.map(item => item.evidenceSeq), [2])
  assert.deepEqual(queryMemoryAgreements('current-branch', rows, {beforeSeq:12, limit:1})
    .entries.map(item => item.evidenceSeq), [8])
  assert.deepEqual(queryMemoryAgreements('current-branch', rows, {limit:2})
    .entries.map(item => item.evidenceSeq), [8, 12])
  assert.deepEqual(queryMemoryAgreements('current-branch', rows, {query:'没有出现的地点'}).entries, [])
})

test('old notes remain available to ordinary history without becoming inferred agreements', async () => {
  const rows = [{evidenceSeq:2, summary:'旧笔记提到了一个约定', status:'established', sourceKey:'2:old'}]
  const before = structuredClone(rows)
  const result = queryMemoryAgreements('current-branch', rows, {query:'约定'})
  assert.equal(result.totalEntries, 0)
  assert.deepEqual(result.entries, [])
  assert.match(result.note, /普通剧情历史检索/)
  assert.match(result.note, /不会自动回填/)
  assert.deepEqual(rows, before)
  const fixture = await memoryFixture(rows)
  try {
    const ordinary = fixture.service.history(fixture.session, {query:'缺失'}) as {entries:{seq:number; text:string}[]}
    assert.equal(ordinary.entries[0]!.text, fixture.original)
    const prose = fixture.service.historyRead(fixture.session, {seq:2}) as {text:string}
    assert.equal(prose.text, fixture.original)
  } finally {fixture.close()}
})

interface HistoryService {
  history(session: MemorySession, options?: Record<string, unknown>): unknown
  historyRead(session: MemorySession, options?: Record<string, unknown>): unknown
}
async function memoryFixture(deltas: Record<string, unknown>[], retrieval?: RoleplayMemoryHost['retrieval']) {
  const original = '阿岚对小禾说：找到缺失的书页后，我会把书还给你。'
  const session: MemorySession = {id:'current-branch', header:{agentPreset:'roleplay'},
    events:[
      {seq:0, type:'turn/start', data:{turn:1}},
      {seq:1, type:'user/message', data:{source:{kind:'user'}, content:[{type:'text', text:'问起借书的事。'}]}},
      {seq:2, type:'assistant/message', data:{turn:1, message:{content:[{type:'text', text:original}]}}},
      {seq:3, type:'turn/end', data:{turn:1, reason:{kind:'completed'}}},
    ], surface:{nodes:[1, 2]}, append:() => assert.fail('History queries must not write Native events')}
  const cleanups: (() => void)[] = []
  let service: HistoryService | undefined
  const head = {deltas}
  const engine: RoleplayMemoryHost = {memoryHead:() => head, retrieval,
    memoryUpdate:() => assert.fail('History queries must not write memory'),
    nativeTask:async () => assert.fail('History queries must not request a model')}
  const ctx: MemoryContext = {get:() => engine, tokenMeter:{measure:() => ({nodes:[], totalTokens:0})}, sessions:{},
    provide(name, value) {assert.equal(name, 'compaction'); service = value as HistoryService},
    effect(work) {cleanups.push(work())}, on() {}, inject() {}}
  await apply(ctx, {auto:false, autoNotes:false})
  assert.ok(service)
  return {session, original, head, service, close:() => cleanups.forEach(cleanup => cleanup())}
}

test('compaction agreement consumer preserves original source and reads its prose through existing history', async () => {
  const row = delta(2, agreement())
  const fixture = await memoryFixture([row])
  try {
    const result = fixture.service.history(fixture.session, {kind:'agreements', query:'小禾 书页'}) as
      ReturnType<typeof queryMemoryAgreements>
    assert.equal(result.sessionId, 'current-branch')
    assert.equal(result.entries[0]!.sessionId, 'original-owner')
    assert.equal(result.entries[0]!.sourceKey, row.sourceKey)
    const prose = fixture.service.historyRead(fixture.session,
      {seq:result.entries[0]!.evidenceSeq, kind:'agreements'}) as {seq:number; text:string}
    assert.equal(prose.seq, row.evidenceSeq)
    assert.equal(prose.text, fixture.original)
    const ordinary = fixture.service.history(fixture.session, {query:'缺失'}) as {entries:{seq:number; text:string}[]}
    assert.equal(ordinary.entries[0]!.text, fixture.original)
    fixture.head.deltas = []
    assert.deepEqual((fixture.service.history(fixture.session, {kind:'agreements'}) as
      ReturnType<typeof queryMemoryAgreements>).entries, [])
  } finally {fixture.close()}
})

test('ordinary configured retrieval and read retain their existing calls when agreements are available', async () => {
  const calls: {action:string; options:Record<string, unknown> | undefined}[] = []
  const searched = {ordinary:'configured-search'}, read = {ordinary:'original-prose'}
  const fixture = await memoryFixture([delta(2, agreement())], {
    async search(_session, options) {calls.push({action:'search', options}); return searched},
    read(_session, options) {calls.push({action:'read', options}); return read},
  })
  try {
    assert.deepEqual(await fixture.service.history(fixture.session, {query:'约定', scope:'story'}), searched)
    assert.deepEqual(fixture.service.historyRead(fixture.session, {seq:2, kind:'agreements'}), read)
    assert.equal((fixture.service.history(fixture.session, {kind:'agreements'}) as
      ReturnType<typeof queryMemoryAgreements>).entries.length, 1)
    assert.deepEqual(calls, [
      {action:'search', options:{query:'约定', scope:'story'}},
      {action:'read', options:{seq:2, kind:'agreements'}},
    ])
  } finally {fixture.close()}
})
