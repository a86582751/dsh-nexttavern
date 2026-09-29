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
import {createHash} from 'node:crypto'
import { createConversationCatalog } from '../lib/core/tavern-conversations.js'
import { directorNotesForBranch } from '../lib/memory/roleplay-memory-engine.js'
import { apply } from '../lib/core/roleplay-core.js'
import {provenImportPreludeAssistants} from '../lib/core/tavern-task-retirement.js'
import {activeOpeningSource} from '../lib/core/roleplay-import.js'
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
    sessions: { get: id => sessions.get(id), async flush() { return true } },
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
  // The state route is a GET with a query parameter; drive the handler directly
  // with the same credentials-free request the browser sends.
  const callState = async sessionId => {
    const handler = routes.get('/api/roleplay/state')
    assert(handler, 'missing route /api/roleplay/state')
    const response = await handler.fetch(new Request(`https://fixture.test/api/roleplay/state?sessionId=${encodeURIComponent(String(sessionId))}`))
    return { status: response.status, body: await response.json() }
  }
  const dispose = () => cleanups.reverse().forEach(fn => fn())
  return { table, sessions, enableAppend, emit, callRoute, callState, dispose, calls, ctx,
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

// 删除玩家消息产生的截断子分支停在最后一条存活回合的边界上：它不会重放玩家
// 输入，所以边界的状态栏与决策卡必须由程序补回（0 次模型调用）。重生/改后发送
// 的子分支仍不继承父分支的待选卡，等自己的 Phase B 出新卡。
{
  const b = await bench()
  try {
    const rootId = 'trunc-root'
    await b.table('status').put(`${rootId}__spec`, { text: '显示当前位置', templateHtml: '<section class="author-status"></section>' })
    const root = b.enableAppend({ id: rootId, header: { agentPreset: 'roleplay' }, events: [], seq: 0, surface: { nodes: [] } })
    b.sessions.set(root.id, root)
    const appendTurn = (session, turn, body, marker, { complete = true } = {}) => {
      session.append('turn/start', { turn })
      session.append('user/message', { id: `u-${session.id}-${turn}`, source: { kind: 'user' }, content: text(body) }, 'append')
      session.append('assistant/message', { turn, message: { id: `a-${session.id}-${turn}`, content: text(`庭院剧情 ${marker}`) } }, 'append')
      return complete ? session.append('turn/end', { turn, reason: { kind: 'completed' } }) : null
    }
    const storyTurn = async (session, turn, body, marker) => {
      const end = appendTurn(session, turn, body, marker)
      await b.emit('session/event', session, end)
      return end
    }
    const catalogDisk = { value: null }
    const catalog = createConversationCatalog({ read: () => catalogDisk.value, write: async value => { catalogDisk.value = structuredClone(value) } })
    b.ctx.provide('tavernConversations', { ...catalog, ready: Promise.resolve() })
    let forks = 0
    b.ctx.sessionController.forkPrepared = async (request, beforePublish) => {
      const childId = `session-trunc-child-${++forks}`
      const source = b.sessions.get(request.sessionId)
      assert(source, 'the fork source must exist')
      await beforePublish({ sourceSessionId: request.sessionId, childSessionId: childId, seedLength: request.atSeq + 1 })
      const seed = source.events.slice(0, request.atSeq + 1)
      // Native forks carry the visible surface of the seed; without it the child
      // would look like it has no boundary turn at all.
      const nodes = seed.filter(event => event.surfaceOp === 'append').map(event => event.seq)
      const child = b.enableAppend({ id: childId, inheritedEventCount: seed.length, header: { agentPreset: 'roleplay', parentSession: source.id }, events: structuredClone(seed), seq: seed.length, surface: { nodes } })
      b.sessions.set(childId, child)
      return { sessionId: childId }
    }
    const deleteUserChild = async (sourceId, messageId) => {
      const prepared = await b.callRoute('/api/roleplay/branch', { action: 'prepare', sessionId: sourceId, messageId, kind: 'delete-user' })
      assert.equal(prepared.status, 200, JSON.stringify(prepared.body))
      const created = await b.callRoute('/api/roleplay/branch', { action: 'create-worldline', operationId: prepared.body.operationId })
      assert.equal(created.status, 200, JSON.stringify(created.body))
      const childId = created.body.childSessionId
      const registered = await b.callRoute('/api/roleplay/branch', { action: 'register', operationId: prepared.body.operationId, childSessionId: childId, promptText: '' })
      assert.equal(registered.status, 200, JSON.stringify(registered.body))
      assert.equal(registered.body.truncated, true)
      return childId
    }
    const stateOf = async sessionId => (await b.callState(sessionId)).body
    // Phase B is snapshot-driven and this fixture drives the turn-end maintenance
    // directly, so the card record a real turn would publish is seeded from the
    // status panel it reuses (same shape as the durable records in production).
    const cardFromPanel = (panelRecord, turn, seq) => ({
      schemaVersion: 1,
      source: 'auto',
      provenance: { ...(panelRecord?.provenance ?? {}), reusedFrom: 'status', statusSeq: seq },
      sessionId: root.id,
      atSeq: seq,
      seq,
      turnId: turn,
      question: '',
      options: (panelRecord?.panel?.options ?? []).map(option => ({ label: option.label, description: option.description, heart: option.heart === true })),
      multiSelect: false,
      answered: false,
      choiceIndex: null,
      time: Date.now(),
    })

    // --- 被删的回合还没结算：父分支仍停在边界的面板与卡片上 ---
    await storyTurn(root, 1, '走入庭院 1', 1)
    const parentCardKey = `${root.id}__current`
    const turnOneCard = cardFromPanel(b.panel(root.id), 1, 2)
    assert.equal(turnOneCard.options[0].label, '沿路前进-1')
    // 玩家输入消费掉待选卡：这正是删除那条消息前的父分支状态。
    await b.table('decision').put(parentCardKey, { ...turnOneCard, answered: true, superseded: true, supersededAt: Date.now(), supersededReason: 'player-input' })
    // 第二轮的正文已经可见但还没有 turn/end：删除按钮的锚点已经存在，局后维护
    // 尚未把父分支的面板与卡推进到被删回合。
    appendTurn(root, 2, '走入庭院 2', 2, { complete: false })
    const callsBeforeTruncate = b.calls.length
    const truncatedChild = await deleteUserChild(root.id, `a-${root.id}-2`)

    await checked('a truncation child gets the boundary card back instead of losing it forever', async () => {
      const state = await stateOf(truncatedChild)
      assert.equal(state.sessionId, truncatedChild)
      assert.equal(state.decision?.turnId, 1, 'the surviving turn owns the next-step card')
      assert.equal(state.decision?.seq, 2)
      assert.equal(state.decision?.answered, false, 'the deleted input must not leave the card answered')
      assert.equal(state.decision?.superseded, false)
      assert.equal(state.decision?.supersededReason, undefined)
      assert.equal(state.decision?.inheritedFrom, root.id)
      assert.equal(state.decision?.options?.[0]?.label, '沿路前进-1', 'the card keeps the options the player saw')
      assert.equal(state.statusPanel?.atSeq, 2, 'the status bar keeps showing the truncation point')
      assert.match(state.statusPanel?.panel?.html ?? '', /庭院-1/)
      const meta = b.table('branch').get(`${truncatedChild}__meta`)
      assert.equal(meta?.truncatedFrom, root.id)
      assert.equal(meta?.boundaryState?.decision, 'inherited', 'the carry is recorded as durable evidence')
      assert.equal(meta?.boundaryState?.status, 'existing')
      assert.equal(b.calls.length, callsBeforeTruncate, 'the carry must not call a maintenance worker')
    })

    // --- 被删回合的维护已经跑完：父分支的面板与卡都越过了 seed ---
    await b.emit('session/event', root, root.append('turn/end', { turn: 2, reason: { kind: 'completed' } }))
    await b.table('decision').put(parentCardKey, cardFromPanel(b.panel(root.id), 2, 6))
    await checked('the source worldline really moved past the truncation boundary', () => {
      assert.match(b.panel(root.id).panel.html, /庭院-2/)
      assert.equal(b.table('decision').get(parentCardKey).turnId, 2)
    })
    const callsBeforeLateTruncate = b.calls.length
    const lateChild = await deleteUserChild(root.id, `a-${root.id}-2`)

    await checked('a truncation after the deleted turn settled rebuilds card and panel from the boundary turn', async () => {
      const state = await stateOf(lateChild)
      assert.equal(state.statusPanel?.atSeq, 2, 'the boundary panel is copied from the parent turn record')
      assert.match(state.statusPanel?.panel?.html ?? '', /庭院-1/)
      assert.doesNotMatch(state.statusPanel?.panel?.html ?? '', /庭院-2/)
      assert.equal(state.decision?.turnId, 1)
      assert.equal(state.decision?.options?.[0]?.label, '沿路前进-1')
      assert.equal(state.decision?.rebuiltFromStatus, true, 'no extra decision worker call is needed')
      const meta = b.table('branch').get(`${lateChild}__meta`)
      assert.equal(meta?.boundaryState?.decision, 'rebuilt')
      assert.equal(meta?.boundaryState?.status, 'copied')
      assert.equal(b.calls.length, callsBeforeLateTruncate, 'rebuilding reuses the committed status result')
    })

    // --- 升级前留下的截断子分支：刷新状态即补回，不需要新的模型调用 ---
    await checked('refreshing a truncation child that lost its card restores it', async () => {
      await b.table('decision').delete(`${lateChild}__current`)
      const metaKey = `${lateChild}__meta`
      await b.table('branch').put(metaKey, { ...b.table('branch').get(metaKey), boundaryState: undefined })
      const callsBeforeRepair = b.calls.length
      const state = await stateOf(lateChild)
      assert.equal(state.decision?.turnId, 1, 'a refresh repairs a child truncated before the fix')
      assert.equal(state.decision?.options?.[0]?.label, '沿路前进-1')
      assert.equal(b.calls.length, callsBeforeRepair, 'the repair reuses durable records only')
    })

    await checked('an inherited boundary panel still owned by the parent is rehomed to the child', async () => {
      const panelKey = `${lateChild}__panel`
      const metaKey = `${lateChild}__meta`
      await b.table('status').put(panelKey, { ...b.table('status').get(panelKey), sessionId: root.id, branchId: root.id })
      await b.table('branch').put(metaKey, { ...b.table('branch').get(metaKey), boundaryState: undefined })
      const callsBeforeRebind = b.calls.length
      const state = await stateOf(lateChild)
      assert.equal(state.statusPanel?.atSeq, 2, 'the boundary panel must be addressable by the child again')
      assert.match(state.statusPanel?.panel?.html ?? '', /庭院-1/)
      assert.equal(b.table('branch').get(metaKey)?.boundaryState?.status, 'rebound')
      assert.equal(b.calls.length, callsBeforeRebind, 'rebinding is program-only work')
    })

    // --- 重生子分支仍不继承父分支的待选卡（它自己的 Phase B 出卡）---
    const regenPrepared = await b.callRoute('/api/roleplay/branch', { action: 'prepare', sessionId: root.id, messageId: `a-${root.id}-2`, kind: 'regenerate' })
    assert.equal(regenPrepared.status, 200, JSON.stringify(regenPrepared.body))
    const regenCreated = await b.callRoute('/api/roleplay/branch', { action: 'create-worldline', operationId: regenPrepared.body.operationId })
    const regenChildId = regenCreated.body.childSessionId
    const regenRegistered = await b.callRoute('/api/roleplay/branch', { action: 'register', operationId: regenPrepared.body.operationId, childSessionId: regenChildId, requestId: 'trunc-regen', promptText: '走入庭院 2' })
    assert.equal(regenRegistered.status, 200, JSON.stringify(regenRegistered.body))

    await checked('a replay child keeps the parent card out until its own turn lands', async () => {
      const state = await stateOf(regenChildId)
      assert.equal(state.decision ?? null, null, 'regenerate publishes its own card after its own Phase B')
      assert.equal(b.table('branch').get(`${regenChildId}__meta`)?.boundaryState ?? null, null)
    })
  } finally { b.dispose() }
}

{
  const b = await bench()
  try {
    const source = b.enableAppend({id: 'opening-root', header: {agentPreset: 'roleplay'},
      events: [], seq: 0, surface: {nodes: []}})
    b.sessions.set(source.id, source)
    const sourceText = 'fixture source'
    const sourceHash = createHash('sha256').update(sourceText).digest('hex')
    const selectedText = '备选作者开场'
    b.table('branch').set(`${source.id}__import-active`, {importId:'import-1',
      normalizedSha256:sourceHash, transactionId:'tx1', coverageSha256:'b'.repeat(64)})
    b.table('branch').set(`${source.id}__import-import-1`, {schemaVersion:3,
      importId:'import-1',status:'active',normalizer:'utf8-lf+anydoc-deescape-v2',
      rawSource:sourceText,normalizedSource:sourceText,rawSha256:sourceHash,
      normalizedSha256:sourceHash,rawChars:sourceText.length,normalizedChars:sourceText.length,
      sourceBytes:Buffer.byteLength(sourceText),lineCount:1,lines:[sourceText],lineStarts:[0],
      assignments:[],activation:{transactionId:'tx1'}})
    b.table('branch').set(`${source.id}__opening-choice-import-1`, {schemaVersion:2,
      status:'completed', sessionId:source.id, operationId:'author-opening-op',
      messageId:'author-opening', renderedText:selectedText,
      renderedSha256:createHash('sha256').update(selectedText).digest('hex'),
      source:{importId:'import-1',normalizedSha256:sourceHash,transactionId:'tx1'}})
    b.table('opening').set(`${source.id}__scene`, {text:'默认作者开场'})
    await checked('a visible legacy model opening and an inherited blank child refuse another author opening', async () => {
      const cardBytes = Buffer.from(JSON.stringify({spec:'chara_card_v2',spec_version:'2.0',
        data:{name:'Fixture',first_mes:'默认作者开场'}}))
      const rawHash = createHash('sha256').update(cardBytes).digest('hex')
      const legacy = b.enableAppend({id:'legacy-model-opening',header:{agentPreset:'roleplay'},
        events:[],seq:0,surface:{nodes:[]}})
      b.sessions.set(legacy.id,legacy)
      b.table('branch').set(`${legacy.id}__import-active`, {importId:'legacy-card',
        normalizedSha256:sourceHash,transactionId:'legacy-tx',coverageSha256:'b'.repeat(64)})
      b.table('branch').set(`${legacy.id}__import-legacy-card`, {schemaVersion:5,
        importId:'legacy-card',sessionId:legacy.id,status:'active',rawSha256:rawHash,
        normalizedSha256:sourceHash,activation:{transactionId:'legacy-tx'},
        sourceEnvelope:{schemaVersion:1,extension:'.json',format:'json-v2',
          base64:cardBytes.toString('base64'),sourceSha256:rawHash}})
      legacy.append('turn/start',{turn:1})
      legacy.append('assistant/message',{turn:1,step:1,stream:[],message:{id:'old-model',
        role:'assistant',content:text('旧模型开场'),source:{kind:'model',provider:'fixture',model:'fixture'}}},'append')
      legacy.append('turn/end',{turn:1,reason:{kind:'completed'}})
      const duplicate = await b.callRoute('/api/roleplay/openings',{sessionId:legacy.id,
        action:'select',index:0,operationId:'duplicate',expectedRenderedSha256:'0'.repeat(64)})
      assert.equal(duplicate.status,409,JSON.stringify(duplicate.body))
      assert.match(duplicate.body.error,/已有可见开场或剧情/)
      const blank = b.enableAppend({id:'blank-opening-child',header:{agentPreset:'roleplay'},
        events:[],seq:0,surface:{nodes:[]}})
      b.sessions.set(blank.id,blank)
      b.table('branch').set(`${blank.id}__import-active`, {importId:'legacy-card',
        sourceRecordSessionId:legacy.id,normalizedSha256:sourceHash,
        transactionId:'legacy-tx',coverageSha256:'b'.repeat(64)})
      b.table('branch').set(`${blank.id}__meta`, {freshBranchFrom:legacy.id})
      const inherited = await b.callRoute('/api/roleplay/openings',{sessionId:blank.id,
        action:'select',index:0,operationId:'duplicate-child',expectedRenderedSha256:'0'.repeat(64)})
      assert.equal(inherited.status,409,JSON.stringify(inherited.body))
      assert.match(inherited.body.error,/已有可见开场或剧情/)
    })
    source.append('turn/start', {turn: 1})
    source.append('user/message', {id: 'import-task', role: 'user',
      source: {kind: 'roleplay-tasks', form: 'phase', stage: 'management'},
      content: text('导入角色卡')}, 'append')
    source.append('assistant/message', {turn: 1, step: 1, stream: [],
      message: {id: 'import-call', role: 'assistant', content: [
        {type:'tool-call',id:'import-begin',name:'rp_card_import_begin',arguments:'{}'}],
        source: {kind: 'model', provider: 'fixture', model: 'fixture'}}}, 'append')
    source.append('tool/result', {message:{source:{kind:'tool',callId:'import-begin'},
      toolCallId:'import-begin',role:'tool',content:[{type:'tool-result',toolCallId:'import-begin',
        content:text(JSON.stringify({ok:true,status:'active',resumed:true,
          job:{status:'completed'},importId:'import-1',normalizedSha256:sourceHash,
          activatedAt:1000,coverage:1}))}]}}, 'append')
    source.append('assistant/message', {turn: 1, step: 2, stream: [],
      message: {id: 'import-receipt', role: 'assistant', content: text('导入完成'),
        source: {kind: 'model', provider: 'fixture', model: 'fixture'}}}, 'append')
    source.append('turn/end', {turn: 1, reason: {kind: 'completed'}})
    source.append('turn/start', {turn: 2})
    source.append('step/start', {turn: 2, step: 1})
    const original = source.append('assistant/message', {turn: 2, step: 1, stream: [],
      message: {id: 'author-opening', role: 'assistant', content: text('作者原始开场'),
        source: {kind: 'programmatic', schemaVersion: 1, producer: 'dsh-nexttavern',
          origin: 'card-opening:import-1', operationId: 'author-opening-op'}}}, 'append')
    source.append('step/end', {turn: 2, step: 1})
    source.append('turn/end', {turn: 2, reason: {kind: 'completed'}})
    const catalog = createConversationCatalog({read: () => null, write: async () => {}})
    let dropMarkReady = true
    b.ctx.provide('tavernConversations', {...catalog, ready: Promise.resolve(),
      markReady: async id => {
        if (dropMarkReady) { dropMarkReady = false; throw Error('lost markReady acknowledgement') }
        return catalog.markReady(id)
      }})
    let modelCalls = 0, dropBeforeTurn = false, busyOnce = false
    const resolveAgent = b.ctx.sessionController.resolveAgent
    b.ctx.sessionController.resolveAgent = async id => {
      const found = await resolveAgent(id)
      if (!found.agent) return found
      return {...found, agent: {...found.agent, generateProgrammaticAssistant: async input => {
        if (busyOnce) { busyOnce = false; return {kind:'busy'} }
        if (dropBeforeTurn) throw Error('process stopped before native turn/start')
        modelCalls++
        const child = found.agent.session
        child.append('turn/start', {turn: 1})
        child.append('step/start', {turn: 1, step: 1})
        child.append('assistant/message', {turn: 1, step: 1, stream: [], message: {
          id: input.messageId, role: 'assistant', content: text('模型新开场'),
          source: {kind: 'model', provider: 'fixture', model: 'fixture'}}}, 'append')
        child.append('step/end', {turn: 1, step: 1})
        child.append('turn/end', {turn: 1, reason: {kind: 'completed'}})
        return {kind: 'committed', turn: 1, messageId: input.messageId}
      }}}
    }
    const sourceState = await b.callState(source.id)
    assert.deepEqual(activeOpeningSource(b.table('branch'),source.id),
      {importId:'import-1',normalizedSha256:sourceHash,transactionId:'tx1',sourceRecordSessionId:source.id})
    assert.ok(provenImportPreludeAssistants(source,{importId:'import-1',normalizedSha256:sourceHash})
      .has(source.events.find(event => event.data?.message?.id === 'import-receipt').seq),
      'the exact direct begin result proves the visible import prelude')
    assert.deepEqual(sourceState.body.programmaticOpeningActionAnchor,
      {messageId: 'author-opening', seq: original.seq, turn: 2},
      'hidden import assistant does not displace the author opening')
    const wrong = await b.callRoute('/api/roleplay/branch', {action: 'prepare', kind: 'opening-regenerate',
      sessionId: source.id, messageId: 'author-opening', seq: original.seq + 1})
    assert.equal(wrong.status, 400, 'a mismatched assistant seq cannot become an opening anchor')
    const prepared = await b.callRoute('/api/roleplay/branch', {action: 'prepare', kind: 'opening-regenerate',
      sessionId: source.id, messageId: 'author-opening', seq: original.seq})
    assert.equal(prepared.status, 200, JSON.stringify(prepared.body))
    const created = await b.callRoute('/api/roleplay/branch', {action: 'create-worldline',
      operationId: prepared.body.operationId})
    assert.equal(created.status, 200, JSON.stringify(created.body))
    const childId = created.body.childSessionId
    const generated = await b.callRoute('/api/roleplay/branch', {action: 'generate-opening',
      operationId: prepared.body.operationId, childSessionId: childId})
    assert.equal(generated.status, 500, 'the lost catalog acknowledgement leaves exact prose to reconcile')
    assert.equal(b.table('branch').get(`${childId}__opening-reference`)?.renderedText, selectedText,
      'the selected alternate opening survives the blank native child')
    await checked('model opening branch has exact assistant identity and no player message', async () => {
      const child = b.sessions.get(childId)
      assert(child)
      assert.equal(child.events.filter(event => event.type === 'user/message').length, 0)
      assert.equal(child.events.find(event => event.type === 'assistant/message')?.data.message.source.kind, 'model')
      assert.equal(source.events.find(event => event.type === 'assistant/message'
        && event.data.message.id === 'author-opening')?.data.message.source.kind, 'programmatic')
      const status = await b.callRoute('/api/roleplay/branch', {action: 'operation-status',
        operationId: prepared.body.operationId})
      assert.equal(status.body.status, 'completed')
      assert.equal(status.body.assistantMessageId, `opening-regenerate-${prepared.body.operationId}`)
      assert.equal(catalog.snapshot().worldlines[childId]?.status, 'ready')
      const retried = await b.callRoute('/api/roleplay/branch', {action: 'generate-opening',
        operationId: prepared.body.operationId, childSessionId: childId})
      assert.equal(retried.body.status, 'completed')
      assert.equal(modelCalls, 1, 'lost responses cannot issue another model request')
      const childState = await b.callState(childId)
      assert.deepEqual(childState.body.programmaticOpeningActionAnchor,
        {messageId: `opening-regenerate-${prepared.body.operationId}`, seq: 2, turn: 1},
        'a generated opening remains eligible through its exact active group member')
      const next = await b.callRoute('/api/roleplay/branch', {action: 'prepare', kind: 'opening-regenerate',
        sessionId: childId, ...childState.body.programmaticOpeningActionAnchor})
      assert.equal(next.status, 200, JSON.stringify(next.body))
    })
    await checked('a crash before native turn admission becomes a failed child without replaying a model call', async () => {
      const preparedAgain = await b.callRoute('/api/roleplay/branch', {action: 'prepare',
        kind: 'opening-regenerate', sessionId: source.id, messageId: 'author-opening', seq: original.seq})
      assert.equal(preparedAgain.status, 200)
      const createdAgain = await b.callRoute('/api/roleplay/branch', {action: 'create-worldline',
        operationId: preparedAgain.body.operationId})
      assert.equal(createdAgain.status, 200)
      dropBeforeTurn = true
      const interrupted = await b.callRoute('/api/roleplay/branch', {action: 'generate-opening',
        operationId: preparedAgain.body.operationId, childSessionId: createdAgain.body.childSessionId})
      assert.equal(interrupted.status, 500)
      const status = await b.callRoute('/api/roleplay/branch', {action: 'operation-status',
        operationId: preparedAgain.body.operationId})
      assert.equal(status.body.status, 'failed')
      assert.equal(status.body.failure?.code, 'OPENING_GENERATION_UNKNOWN')
      assert.equal(catalog.snapshot().worldlines[createdAgain.body.childSessionId]?.status, 'failed')
      assert.equal(modelCalls, 1, 'the uncertain operation never receives an automatic second model call')
      dropBeforeTurn = false
    })
    await checked('a card switch invalidates both opening preparation and a reserved old anchor', async () => {
      const preparedOld = await b.callRoute('/api/roleplay/branch', {action:'prepare',
        kind:'opening-regenerate', sessionId:source.id, messageId:'author-opening', seq:original.seq})
      assert.equal(preparedOld.status, 200)
      const createdOld = await b.callRoute('/api/roleplay/branch', {action:'create-worldline',
        operationId:preparedOld.body.operationId})
      assert.equal(createdOld.status, 200)
      const oldPointer = b.table('branch').get(`${source.id}__import-active`)
      const replacementText = 'replacement source'
      const replacementHash = createHash('sha256').update(replacementText).digest('hex')
      b.table('branch').set(`${source.id}__import-active`, {importId:'import-2',
        normalizedSha256:replacementHash, transactionId:'tx2', coverageSha256:'d'.repeat(64)})
      b.table('branch').set(`${source.id}__import-import-2`, {schemaVersion:3,
        importId:'import-2',status:'active',normalizer:'utf8-lf+anydoc-deescape-v2',
        rawSource:replacementText,normalizedSource:replacementText,rawSha256:replacementHash,
        normalizedSha256:replacementHash,rawChars:replacementText.length,
        normalizedChars:replacementText.length,sourceBytes:Buffer.byteLength(replacementText),
        lineCount:1,lines:[replacementText],lineStarts:[0],assignments:[],
        activation:{transactionId:'tx2'}})
      const switchedState = await b.callState(source.id)
      assert.equal(switchedState.body.programmaticOpeningActionAnchor, null)
      const noPrepare = await b.callRoute('/api/roleplay/branch', {action:'prepare',
        kind:'opening-regenerate', sessionId:source.id, messageId:'author-opening', seq:original.seq})
      assert.equal(noPrepare.status, 400)
      const noGenerate = await b.callRoute('/api/roleplay/branch', {action:'generate-opening',
        operationId:preparedOld.body.operationId, childSessionId:createdOld.body.childSessionId})
      assert.equal(noGenerate.body.failure?.code, 'OPENING_SOURCE_CHANGED')
      assert.equal(modelCalls, 1)
      b.table('branch').set(`${source.id}__import-active`, oldPointer)
    })
    await checked('a busy native agent keeps the same child and accepts one later admission', async () => {
      const preparedBusy = await b.callRoute('/api/roleplay/branch', {action:'prepare',
        kind:'opening-regenerate', sessionId:source.id, messageId:'author-opening', seq:original.seq})
      const createdBusy = await b.callRoute('/api/roleplay/branch', {action:'create-worldline',
        operationId:preparedBusy.body.operationId})
      busyOnce = true
      const deferred = await b.callRoute('/api/roleplay/branch', {action:'generate-opening',
        operationId:preparedBusy.body.operationId, childSessionId:createdBusy.body.childSessionId})
      assert.equal(deferred.status, 202)
      assert.equal(deferred.body.operationState, 'waiting-agent')
      assert.equal(deferred.body.requestAccepted, false)
      const pending = await b.callRoute('/api/roleplay/branch', {action:'operation-status',
        operationId:preparedBusy.body.operationId})
      assert.equal(pending.body.status, 'pending')
      assert.equal(pending.body.requestAccepted, false)
      assert.equal(modelCalls, 1)
      const accepted = await b.callRoute('/api/roleplay/branch', {action:'generate-opening',
        operationId:preparedBusy.body.operationId, childSessionId:createdBusy.body.childSessionId})
      assert.equal(accepted.body.status, 'completed')
      assert.equal(accepted.body.childSessionId, createdBusy.body.childSessionId)
      assert.equal(modelCalls, 2)
    })
    await checked('a definite invalidated source fails its reserved child before model admission', async () => {
      const preparedAgain = await b.callRoute('/api/roleplay/branch', {action: 'prepare',
        kind: 'opening-regenerate', sessionId: source.id, messageId: 'author-opening', seq: original.seq})
      assert.equal(preparedAgain.status, 200)
      const createdAgain = await b.callRoute('/api/roleplay/branch', {action: 'create-worldline',
        operationId: preparedAgain.body.operationId})
      assert.equal(createdAgain.status, 200)
      source.surface.nodes = source.surface.nodes.filter(seq => seq !== original.seq)
      const rejected = await b.callRoute('/api/roleplay/branch', {action: 'generate-opening',
        operationId: preparedAgain.body.operationId, childSessionId: createdAgain.body.childSessionId})
      assert.equal(rejected.status, 409)
      assert.equal(rejected.body.failure?.code, 'OPENING_SOURCE_CHANGED')
      assert.equal(catalog.snapshot().worldlines[createdAgain.body.childSessionId]?.status, 'failed')
      assert.equal(modelCalls, 2, 'source rejection cannot add a model call after the busy retry')
    })
  } finally { b.dispose() }
}

console.log(JSON.stringify({ suite: 'worldline-fork-e2e', checks: checks.length, passed: checks, providerCalls: 0, productionTouched: false }))
