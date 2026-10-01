import assert from 'node:assert/strict'
import { apply as applyCore } from '../lib/core/roleplay-core.js'
import { apply as applyMemory, memoryNotesCadence } from '../lib/memory/roleplay-memory-engine.js'

class Table extends Map {
  async put(key, value) { this.set(key, structuredClone(value)) }
  async update(key, fn) { const value = fn(structuredClone(this.get(key))); await this.put(key, value); return value }
}

const tables = new Map()
const table = name => {
  if (!tables.has(name)) tables.set(name, new Table())
  return tables.get(name)
}
const hooks = new Map(), routes = new Map(), services = new Map(), cleanup = []
const session = { id: 'memory-policy-fixture', header: { agentPreset: 'roleplay' }, events: [], surface: { nodes: [] }, seq: 0 }
const text = value => [{ type: 'text', text: value }]
session.append = (type, data, options = {}) => {
  const event = { seq: session.seq++, type, data: structuredClone(data), surfaceOp: options.surfaceOp, time: Date.now() }
  session.events.push(event)
  if (options.surfaceOp === 'append') session.surface.nodes.push(event.seq)
  return event
}
const agent = { session, status: 'idle', options: { provider: 'fixture', model: 'main', reasoningEffort: 'high' }, steer() {} }
const starts = []
let rejectChild=false
const summary = [
  '## 1. 用户锁定的剧情事实\n无', '## 2. 主角与用户边界\n无', '## 3. 角色簿\n无', '## 4. 关系图\n无',
  '## 5. 世界规则\n无', '## 6. 时间线与剧情账本\n已记录 (seq:2)', '## 7. 当前场景快照\n无', '## 8. 核心矛盾、伏笔、未解决问题\n无',
].join('\n')
const ctx = {
  storageDomain: { async open() { return { table, close() {} } } },
  sessions: { get: id => id === session.id ? session : null, flush: async () => {} },
  sessionController: { async resolveAgent(id) { return id === session.id ? { agent } : null } },
  llm: {
    listProviders: () => [{ id: 'fixture' }],
    async listModels() { return [{ id: 'main', name: 'Main' }, { id: 'global-memory', name: 'Global' }, { id: 'session-memory', name: 'Session' }] },
    async resolveModelInfo(provider, id) { return { provider, id, reasoning: { efforts: [{ id: 'low' }, { id: 'high' }], defaultEffort: 'high' } } },
  },
  subagents: { async start(_kind, request) {
    starts.push(structuredClone(request.agentOptions))
    if(rejectChild)throw Object.assign(new Error('provider busy'),{code:'OVERLOADED'})
    return { id: `memory-child-${starts.length}`, result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: JSON.stringify({ text: summary, deltas: [], conflicts: [] }) }] }), async dispose() {} }
  } },
  tokenMeter: { measure() { return { nodes: [], surfaceTokens: 0, totalTokens: 0 } }, estimateMessage() { return 1 } },
  agentDefaultModel: { currentSelection: () => agent.options },
  systemPrompt: { variable() { return () => {} }, section() { return () => {} } },
  tools: { guard() { return () => {} }, register() { return () => {} } },
  commands: { register() { return () => {} } },
  connection: { fetch: { register(route) { routes.set(route.path, route); return () => {} } } },
  fs: {}, logger: { info() {}, warn() {} },
  effect(fn) { const dispose = fn(); if (typeof dispose === 'function') cleanup.push(dispose) },
  on(name, fn) { if (!hooks.has(name)) hooks.set(name, []); hooks.get(name).push(fn); return () => {} },
  inject(names, fn) { if (names.includes('commands')) fn({ commands: this.commands }) },
  provide(name, value) { services.set(name, value) }, get(name) { return services.get(name) },
}

await applyCore(ctx, { workerProvider: 'wrong-core', workerModel: 'wrong-core-model' })
await applyMemory(ctx, { workerProvider: 'wrong-memory', workerModel: 'wrong-memory-model', autoNotesEveryTurns: 1 })

for (let turn = 1; turn <= 4; turn++) {
  session.append('turn/start', { turn })
  session.append('user/message', { id: `user-${turn}`, role: 'user', source: { kind: 'user' }, content: text(`推进 ${turn}`) }, { surfaceOp: 'append' })
  session.append('assistant/message', { turn, message: { id: `assistant-${turn}`, role: 'assistant', content: text(`结果 ${turn}`) } }, { surfaceOp: 'append' })
  session.append('turn/end', { turn, reason: { kind: 'completed' } })
}

const save = async (scope, settings) => {
  const response = await routes.get('/api/roleplay/models').fetch(new Request('https://fixture.test/api/roleplay/models', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: session.id, scope, settings }),
  }))
  assert.equal(response.status, 200)
}
const runBackground = async () => {
  const before = starts.length
  const cadence = memoryNotesCadence(session, services.get('roleplay').memoryHead(session.id), 1)
  await services.get('compaction').organizeIfNeeded(agent)
  assert.equal(starts.length, before + 1, `real background notes path must dispatch one native child: ${JSON.stringify(cadence)}`)
  return starts.at(-1)
}
const appendCompletedTurn = turn => {
  session.append('turn/start', { turn })
  session.append('user/message', { id: `user-${turn}`, role: 'user', source: { kind: 'user' }, content: text(`推进 ${turn}`) }, { surfaceOp: 'append' })
  session.append('assistant/message', { turn, message: { id: `assistant-${turn}`, role: 'assistant', content: text(`结果 ${turn}`) } }, { surfaceOp: 'append' })
  session.append('turn/end', { turn, reason: { kind: 'completed' } })
}

await save('global', { allMain: false, routes: { memory: { provider: 'fixture', model: 'global-memory', reasoningEffort: 'low' } } })
assert.deepEqual(await runBackground(), { provider: 'fixture', model: 'global-memory', reasoningEffort: 'low', maxTokens: 16384, tavernTaskId: starts.at(-1).tavernTaskId })

appendCompletedTurn(5)
await save('session', { allMain: false, routes: { memory: { provider: 'fixture', model: 'session-memory', reasoningEffort: 'low' } } })
assert.equal((await runBackground()).model, 'session-memory', 'session policy overrides global policy')

appendCompletedTurn(6)
await save('session', null)
assert.equal((await runBackground()).model, 'global-memory', 'clearing session policy restores global memory route')

appendCompletedTurn(7)
await save('global', { allMain: true, routes: { memory: { provider: 'fixture', model: 'wrong-saved-route', reasoningEffort: 'low' } } })
const allMain = await runBackground()
assert.equal(allMain.model, 'main', 'allMain ignores stale memory routes for actual background child')
assert.equal(allMain.reasoningEffort, 'high', 'allMain preserves the current main reasoning effort')

appendCompletedTurn(8)
rejectChild=true
await services.get('compaction').organizeIfNeeded(agent)
const failedStarts=starts.length
const failedJob=[...table('branch').values()].findLast(value=>value?.kind==='memory'&&value.background)
const failedGeneration=failedJob.generation
const realNow=Date.now
try {
  Date.now=()=>realNow()+24*60*60*1000
  await services.get('compaction').organizeIfNeeded(agent)
  assert.equal(starts.length,failedStarts,'same frozen failed notes must not automatically create another paid call after backoff')
  assert.equal(table('branch').get(`tavern_job__${failedJob.id}`).generation,failedGeneration,'failed attempt evidence is retained')
  rejectChild=false
  appendCompletedTurn(9)
  Date.now=()=>realNow()+48*60*60*1000
  await runBackground()
} finally {Date.now=realNow}

const jobs = [...table('branch').values()].filter(value => value?.kind === 'memory' && value?.background)
assert.ok(jobs.every(job => job.execution === 'spawn'), 'background memory remains the native-spawn execution exception')
assert.ok(jobs.every(job => job.actualRoute.model !== 'wrong-memory-model' && job.actualRoute.model !== 'wrong-core-model'))
cleanup.reverse().forEach(dispose => dispose())
console.log('memory-model-policy=ok (real background notes honor global/session/allMain policy routes)')
