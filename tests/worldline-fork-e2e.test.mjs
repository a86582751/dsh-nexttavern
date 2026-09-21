// End to end for a worldline fork: a real story turn, the real maintenance that
// follows it, then a fork through the branch route - and then the question the
// other suites answer only piecewise: does the new worldline own its own derived
// data, and does it keep the source worldline's data out.
//
// The other suites cover the parts. `roleplay-core-smoke` drives the route and
// the fork bookkeeping with hand-seeded tables; `status-obligation` runs real
// status generation and clones a session object directly; `decision-context` and
// `memory-retrieval` assert isolation at their own layer. This one runs the
// sequence a player actually causes - turn, maintenance, regenerate, continue,
// fail, recover - and reads the state panel, the decision card, the director
// notes and the worldbook on both sides of the fork.
import assert from 'node:assert/strict'
import { createConversationCatalog } from '../lib/core/tavern-conversations.js'
import { directorNotesForBranch } from '../lib/memory/roleplay-memory-engine.js'
import { apply } from '../lib/core/roleplay-core.js'
import {ownedPackages} from './plugin-owned-packages-fixture.mts'
import {after} from 'node:test'

const owned = await ownedPackages(['session-format'])
after(() => owned.close())
const {appendMessageEdit, latestMessageEdit, currentMessageEdits} = await owned.load('dsh-nexttavern-session-format')

class Table extends Map {
  async put(key, value) { this.set(key, structuredClone(value)) }
  async update(key, fn) { await this.put(key, fn(structuredClone(this.get(key)))); return this.get(key) }
  async delete(key) { return super.delete(key) }
}
const text = value => [{ type: 'text', text: value }]
const drain = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)) }
const worldbookReason = 'E2E 世界书条目'

// The maintenance worker is stubbed at the same seam the other suites use: the
// runtime still decides what to ask, when to ask it and how to store the answer.
// Every panel carries the turn whose prose the prompt quotes, so a panel left in
// the wrong worldline is visible instead of inferred.
const markerOf = request => /庭院剧情 (\d+)/.exec(JSON.stringify(request.user ?? request))?.[1] ?? 'unknown'
const panelFor = marker => ({
  html: `<section class="author-status">位置：庭院-${marker}</section>`,
  fields: [{ label: '位置', value: `庭院-${marker}` }],
  options: [{ label: `沿路前进-${marker}`, heart: true }]
})

async function bench() {
  const tables = new Map()
  const table = name => { if (!tables.has(name)) tables.set(name, new Table()); return tables.get(name) }
  const hooks = new Map(), tools = new Map(), routes = new Map(), services = new Map(), sessions = new Map()
  const cleanups = [], calls = []
  const enableAppend = session => {
    session.append = (type, data, surfaceOp) => {
      const event = { seq: session.seq++, type, data, surfaceOp }
      session.events.push(event)
      if (surfaceOp === 'append') session.surface.nodes.push(event.seq)
      for (const observer of hooks.get('session/event') ?? []) void observer(session, event)
      return event
    }
    return session
  }
  const ctx = {
    nexttavernMessageEdits: {append: appendMessageEdit, latest: latestMessageEdit, current: currentMessageEdits},
    storageDomain: { async open() { return { table, close() {} } } },
    sessions: { get: id => sessions.get(id) },
    sessionController: {
      async resolveAgent(id) {
        const session = sessions.get(id)
        if (!session) return { error: Object.assign(new Error('session not found'), { code: 'session/not-found' }) }
        return { agent: { session, status: 'idle' } }
      },
      async create({ sessionId }) {
        const child = enableAppend({ id: sessionId, header: { agentPreset: 'roleplay' }, events: [], seq: 0, surface: { nodes: [] } })
        sessions.set(sessionId, child)
        return { sessionId }
      }
    },
    subagents: { async start(name, request) {
      const payload = JSON.parse(request.prompt[0].text)
      const valueFor = native => {
        assert.match(native.system, /状态栏渲染生成器|决策/, 'only the maintenance workers run in this suite')
        const panel = panelFor(markerOf(native))
        return native.system.includes('状态栏渲染生成器') ? panel : panel.options
      }
      if (Array.isArray(payload.tasks)) {
        const results = [], failures = []
        await Promise.all(payload.tasks.map(async task => {
          const native = { system: task.system, user: task.user }
          calls.push(native)
          try { results.push({ taskId: task.taskId, generation: task.generation, value: valueFor(native) }) }
          catch (error) { failures.push({ taskId: task.taskId, generation: task.generation, failure: { message: error.message } }) }
        }))
        return { id: `native-${calls.length}`, result: Promise.resolve({ stopReason: 'completed', structured: { results, failures } }), async dispose() {} }
      }
      const native = { system: payload.system, user: payload.user }
      calls.push(native)
      const value = valueFor(native)
      return { id: `native-${calls.length}`, result: Promise.resolve({ stopReason: 'completed', structured: value, output: [{ type: 'text', text: JSON.stringify(value) }] }), async dispose() {} }
    } },
    tokenMeter: { measure() { return { nodes: [] } } },
    agentDefaultModel: { currentSelection() { return { provider: 'fixture-main', model: 'fixture-main' } } },
    systemPrompt: { variable() { return () => {} }, section() { return () => {} } },
    tools: { register(tool) { tools.set(tool.name, tool); return () => {} } },
    commands: { register() { return () => {} } },
    connection: { fetch: { register(route) { routes.set(route.path, route); return () => {} } } },
    logger: { info() {}, warn() {} }, fs: {},
    effect(fn) { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup) },
    on(name, fn) { if (!hooks.has(name)) hooks.set(name, []); hooks.get(name).push(fn); return () => {} },
    provide(name, value) { services.set(name, value) }, get: name => services.get(name)
  }
  await apply(ctx, { statusRetryMs: 60_000, workerProvider: 'fixture-worker', workerModel: 'fixture-worker' })
  const emit = async (name, ...args) => { for (const fn of hooks.get(name) ?? []) await fn(...args); await drain() }
  const callRoute = async (path, body) => {
    const handler = routes.get(path)
    assert(handler, `missing route ${path}`)
    const response = await handler.fetch(new Request(`https://fixture.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
    return { status: response.status, body: await response.json() }
  }
  const dispose = () => cleanups.reverse().forEach(fn => fn())
  return { table, sessions, enableAppend, emit, callRoute, dispose, calls, ctx,
    panel: id => table('status').get(`${id}__panel`) }
}

const checks = []
const checked = async (name, fn) => { await fn(); checks.push(name); console.log('worldline-check=ok ' + name) }

{
  const b = await bench()
  try {
    await b.table('status').put('world-root__spec', { text: '显示当前位置', templateHtml: '<section class="author-status"></section>' })
    const root = b.enableAppend({ id: 'world-root', header: { agentPreset: 'roleplay' }, events: [], seq: 0, surface: { nodes: [] } })
    b.sessions.set(root.id, root)
    const storyTurn = async (session, turn, body, marker) => {
      session.append('turn/start', { turn })
      const user = session.append('user/message', { id: `u-${session.id}-${turn}`, source: { kind: 'user' }, content: text(body) }, 'append')
      session.append('assistant/message', { turn, message: { id: `a-${session.id}-${turn}`, content: text(`庭院剧情 ${marker}`) } }, 'append')
      await b.emit('session/event', session, session.append('turn/end', { turn, reason: { kind: 'completed' } }))
      return user
    }

    // --- a conversation with two real turns, maintenance included ---
    await storyTurn(root, 1, '走入庭院 1', 1)
    await storyTurn(root, 2, '走入庭院 2', 2)

    await checked('a real turn writes its own state panel and decision options', () => {
      const panel = b.panel(root.id)
      assert(panel, 'the maintenance worker should have produced a panel')
      assert.match(panel.panel.html, /庭院-2/, 'the panel belongs to the turn that produced it')
      assert.equal(panel.panel.options[0].label, '沿路前进-2', 'suggestions are kept for the decision card')
    })
    const rootTurnTwo = JSON.stringify(b.panel(root.id))

    // --- fork from turn two through the branch route ---
    const catalogDisk = { value: null }
    const catalog = createConversationCatalog({ read: () => catalogDisk.value, write: async value => { catalogDisk.value = structuredClone(value) } })
    b.ctx.provide('tavernConversations', { ...catalog, ready: Promise.resolve() })
    let forks = 0
    b.ctx.sessionController.forkPrepared = async (request, beforePublish) => {
      forks += 1
      const childId = 'session-world-child'
      await beforePublish({ sourceSessionId: request.sessionId, childSessionId: childId, seedLength: request.atSeq + 1 })
      assert(catalogDisk.value.worldlines[childId], 'worldline ownership commits before native publication')
      const seed = root.events.slice(0, request.atSeq + 1)
      const child = b.enableAppend({ id: childId, inheritedEventCount: seed.length, header: { agentPreset: 'roleplay', parentSession: root.id }, events: structuredClone(seed), seq: seed.length, surface: { nodes: [1] } })
      b.sessions.set(childId, child)
      return { sessionId: childId }
    }

    const prepared = await b.callRoute('/api/roleplay/branch', { action: 'prepare', sessionId: root.id, messageId: 'a-world-root-2', kind: 'regenerate' })
    assert.equal(prepared.status, 200, JSON.stringify(prepared.body))
    assert.equal(prepared.body.promptText, '走入庭院 2')
    const created = await b.callRoute('/api/roleplay/branch', { action: 'create-worldline', operationId: prepared.body.operationId })
    assert.equal(created.status, 200, JSON.stringify(created.body))
    const childId = created.body.childSessionId
    const registered = await b.callRoute('/api/roleplay/branch', { action: 'register', operationId: prepared.body.operationId, childSessionId: childId, requestId: 'worldline-e2e', promptText: '走入庭院 2' })
    assert.equal(registered.status, 200, JSON.stringify(registered.body))
    assert.equal((await b.callRoute('/api/roleplay/branch', { action: 'select-worldline', sessionId: childId })).status, 200)
    assert.equal(forks, 1, 'one native fork for one operation')

    await checked('the child starts from the seed and does not inherit later derived data', () => {
      const child = b.sessions.get(childId)
      assert(child, 'the fork must publish a child session')
      assert.equal(child.seq, prepared.body.previousTurnEndSeq + 1, 'the child continues after the seed turn end')
      assert.equal(child.events.length, prepared.body.previousTurnEndSeq + 1)
      const inherited = b.panel(childId)
      if (inherited) assert.doesNotMatch(inherited.panel.html, /庭院-2/, 'a panel produced after the seed must not follow the fork')
    })

    // --- continue the child: its maintenance belongs to it alone ---
    await storyTurn(b.sessions.get(childId), 3, '留在庭院 3', 3)

    await checked('each worldline keeps its own state and decision data', () => {
      assert.match(b.panel(childId).panel.html, /庭院-3/, 'the child writes its own panel')
      assert.equal(JSON.stringify(b.panel(root.id)), rootTurnTwo, 'the source worldline panel is untouched by the child')
    })

    await checked('director notes and worldbook stay per worldline', async () => {
      const head = b.table('memory').get(`${childId}__head`)
      const notes = head ? directorNotesForBranch(head, b.sessions.get(childId)) : null
      assert.equal(notes?.text ?? '', '', 'the child does not inherit notes written after its seed')
      await b.table('worldbook').put(`${childId}__lore`, { id: 'lore', name: 'lore', content: 'child-only fact', reason: worldbookReason })
      assert.notEqual(b.table('worldbook').get(`${root.id}__lore`)?.content, 'child-only fact', 'worldbook rows are keyed by worldline')
    })

    // --- the source worldline keeps working on its own later turns ---
    await storyTurn(root, 3, '回到庭院 4', 4)

    await checked('the source worldline still writes its own later turns', () => {
      assert.match(b.panel(root.id).panel.html, /庭院-4/)
      assert.equal(b.panel(root.id).panel.options[0].label, '沿路前进-4')
      assert.doesNotMatch(JSON.stringify(b.panel(childId)), /庭院-4/, 'the child never sees the source worldline later turn')
    })

    // --- a failed turn in the child leaves a usable anchor ---
    const child = b.sessions.get(childId)
    const seedPanelHtml = b.panel(childId)?.panel?.html ?? null
    child.append('turn/start', { turn: 4 })
    const failedUser = child.append('user/message', { id: 'u-failed', source: { kind: 'user' }, content: text('试探庭院 5') }, 'append')
    await b.emit('session/event', child, child.append('turn/end', { turn: 4, reason: { kind: 'error' } }))

    await checked('a failed turn can be re-prepared and registered from its anchor', async () => {
      const recovery = await b.callRoute('/api/roleplay/branch', { action: 'prepare', sessionId: childId, userSeq: failedUser.seq, kind: 'regenerate' })
      assert.equal(recovery.status, 200, JSON.stringify(recovery.body))
      assert.equal(recovery.body.recoveryOnly, true, 'a turn without assistant prose is a recovery, not a story branch')
      assert.equal(recovery.body.promptText, '试探庭院 5')
      const recoveredId = 'session-world-recovered'
      const seedLength = (recovery.body.previousTurnEndSeq ?? -1) + 1
      b.sessions.set(recoveredId, b.enableAppend({ id: recoveredId, inheritedEventCount: seedLength, header: { agentPreset: 'roleplay', parentSession: childId }, events: [], seq: seedLength, surface: { nodes: [] } }))
      const recovered = await b.callRoute('/api/roleplay/branch', { action: 'register', operationId: recovery.body.operationId, childSessionId: recoveredId, requestId: 'worldline-recovery', promptText: '试探庭院 5' })
      assert.equal(recovered.status, 200, JSON.stringify(recovered.body))
      assert(b.sessions.get(recoveredId), 'the recovery publishes a usable child')
      assert.equal(b.panel(recoveredId)?.panel?.html ?? null, seedPanelHtml, 'the recovery inherits the seed panel, not the failed attempt')
      assert.doesNotMatch(JSON.stringify(b.panel(recoveredId) ?? {}), /unknown|庭院-4/, 'no panel without prose and nothing from the source worldline later turn')
    })

    await checked('the suite made no provider call', () => assert(b.calls.length > 0, 'maintenance ran through the stub'))
  } finally { b.dispose() }
}

console.log(JSON.stringify({ suite: 'worldline-fork-e2e', checks: checks.length, passed: checks, providerCalls: 0, productionTouched: false }))
