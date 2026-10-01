/** Actual alpha.6 Session and observations; no Harness or model calls. */
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {createSessionHistory, ensureSessionHistory, sessionEvents} from '../lib/core/session-history.js'
import {foldSessionCalls} from '../lib/core/tavern-telemetry-fold.js'
import {createTelemetry} from '../lib/core/tavern-telemetry.js'
import {controllerFixture} from './plugin-fork-controller-fixture.mts'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const load = (name: string) => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href)
const {Context} = await load('cordis')
const {default: Sessions} = await load('dsh-session')
const {default: Query} = await load('dsh-session-query')
const {default: Persistence} = await load('dsh-session-persistence-jsonl')
const {default: Projections} = await load('dsh-session-projection')
class PointQuery extends Query {
  async searchSessions() {throw Error('Outside this test')}
  async searchEvents() {throw Error('Outside this test')}
}
const deferred = () => Promise.withResolvers<void>()

async function fixture() {
  const directory = createTestDirectory('session-history-')
  const ctx = new Context()
  const mounts: any[] = []
  let reads = 0, releases = 0
  try {
    await ctx.plugin(Sessions)
    await ctx.plugin(Projections)
    await ctx.plugin(Persistence, {root: directory, compression: 'none'})
    await ctx.plugin(PointQuery)
  } catch (error) {await ctx.fiber.dispose(); cleanupTestDirectory(directory); throw error}
  const observe = async (id: string, options: any) => {
    reads++
    const observation = await ctx.sessionQuery.observeSession(id, options)
    return {
      source: observation.source, header: observation.header, cursor: observation.cursor,
      inheritedEventCount: observation.inheritedEventCount,
      get events() {return observation.events},
      [Symbol.dispose]() {releases++; observation[Symbol.dispose]()},
    }
  }
  function mount(read = observe, feed = true) {
    const history = createSessionHistory({get: id => ctx.sessions.get(id), observe: read})
    const offFeed = feed ? ctx.on('session/event', history.accept, {global: true, prepend: true}) : () => {}
    const offDispose = ctx.on('session/disposed', history.disposeSession, {global: true})
    const mounted = {...history, dispose() {offFeed(); offDispose(); history.dispose()}}
    mounts.push(mounted)
    return mounted
  }
  function enter(id: string, seed?: readonly any[]) {
    const session = ctx.sessions.prepare(id, {meta: {cwd: directory, agentPreset: 'roleplay',
      ...(seed ? {isSeeded: true, parentSession: 'parent'} : {})},
      ...(seed ? {seed: [...seed], inheritedEventCount: seed.length} : {})})
    const detach = ctx.sessions.enter(session)
    ctx.sessions.announce(session)
    return {session, detach}
  }
  return {ctx, mount, enter, observe, get reads() {return reads}, get releases() {return releases},
    async close() {for (const mount of mounts) mount.dispose(); await ctx.fiber.dispose(); cleanupTestDirectory(directory)},
  }
}

test('native live baseline merges append during observation and freezes only requested cuts', async () => {
  const f = await fixture()
  try {
    const captured = deferred(), release = deferred()
    const h = f.mount(async (id, options) => {
      const cut = await f.observe(id, options)
      captured.resolve(); await release.promise
      return cut
    })
    const {session} = f.enter('live-cut')
    session.append('turn/start', {turn: 1})
    assert.equal(session.events, undefined)
    assert.throws(() => sessionEvents(session), /未就绪/)
    const pending = h.ready(session)
    await captured.promise
    session.append('turn/end', {turn: 1, reason: {kind: 'completed'}})
    release.resolve(); await pending
    const first = sessionEvents<any>(session)
    assert.equal(first.length, session.seq)
    assert.ok(Object.isFrozen(first))
    assert.equal(sessionEvents(session), first)
    for (let turn = 2; turn <= 102; turn++) {
      session.append('turn/start', {turn})
      session.append('turn/end', {turn, reason: {kind: 'completed'}})
    }
    const last = sessionEvents<any>(session)
    assert.equal(last.length, session.seq)
    assert.equal(first.length + 202, last.length)
    assert.equal(f.reads, 1, 'feed must not re-observe on each append')
    assert.equal(f.releases, 1)
    assert.notEqual(last, first)
  } finally {await f.close()}
})

test('one cancelled waiter does not cancel another waiter or leak the observation', async () => {
  const f = await fixture()
  try {
    const captured = deferred(), release = deferred(), cancel = new AbortController()
    const h = f.mount(async (id, options) => {
      const cut = await f.observe(id, options)
      captured.resolve(); await release.promise
      return cut
    })
    const {session} = f.enter('cancel-one')
    const abandoned = h.ready(session, cancel.signal)
    const kept = h.ready(session)
    await captured.promise
    cancel.abort(Error('one waiter cancelled'))
    await assert.rejects(abandoned, /one waiter cancelled/)
    release.resolve(); await kept
    assert.equal(sessionEvents(session).length, session.seq)
    assert.equal(f.reads, 1)
    assert.equal(f.releases, 1)
  } finally {await f.close()}
})

test('standing mounts retain ready and initializing history until the last holder leaves', async () => {
  const f = await fixture()
  try {
    const captured = deferred(), release = deferred()
    const a = f.mount(async (id, options) => {
      const cut = await f.observe(id, options)
      captured.resolve(); await release.promise
      return cut
    }), b = f.mount()
    const {session} = f.enter('two-mounts')
    const first = a.ready(session), second = b.ready(session)
    await captured.promise
    a.dispose()
    await assert.rejects(first, /历史插件已停止/)
    release.resolve(); await second
    session.append('turn/start', {turn: 1})
    const c = f.mount()
    await c.ready(session)
    b.dispose()
    session.append('turn/end', {turn: 1, reason: {kind: 'completed'}})
    assert.equal(sessionEvents(session).length, session.seq)
    assert.equal(f.reads, 1, 'handoff keeps the original observation baseline')
    assert.equal(f.releases, 1)
    c.dispose()
    assert.throws(() => sessionEvents(session), /未就绪/)
  } finally {await f.close()}
})

test('detaching during initialization releases a late lease and a reused ID has a fresh ledger', async () => {
  const f = await fixture()
  try {
    const captured = deferred(), release = deferred()
    let delayed = true
    const h = f.mount(async (id, options) => {
      const cut = await f.observe(id, options)
      if (delayed) {captured.resolve(); await release.promise}
      return cut
    })
    const first = f.enter('reused')
    first.session.append('turn/start', {turn: 10})
    const pending = h.ready(first.session)
    await captured.promise
    first.detach()
    await assert.rejects(pending, /已释放/)
    delayed = false
    const second = f.enter('reused')
    release.resolve()
    await h.ready(second.session)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(f.releases, 2)
    assert.throws(() => sessionEvents(first.session), /未就绪/)
    assert.equal(sessionEvents(second.session).length, second.session.seq)
    assert.ok(!sessionEvents<any>(second.session).some(e => e.data?.turn === 10))
  } finally {await f.close()}
})

test('missing or conflicting native feed fails closed and a new observation repairs the baseline', async () => {
  const f = await fixture()
  try {
    const h = f.mount(undefined, false)
    const {session} = f.enter('feed-gap')
    await h.ready(session)
    session.append('turn/start', {turn: 1})
    const end = session.append('turn/end', {turn: 1, reason: {kind: 'completed'}})
    h.accept(session, end)
    assert.throws(() => sessionEvents(session), /缺口或冲突/)
    await h.ready(session)
    assert.equal(sessionEvents(session).length, session.seq)
    h.accept(session, end)
    assert.equal(sessionEvents(session).length, session.seq)
    h.accept(session, {...end})
    assert.throws(() => sessionEvents(session), /缺口或冲突/)
    assert.equal(f.reads, 2)
  } finally {await f.close()}
})

test('inherited native events remain readable but never create a second telemetry charge', async () => {
  const f = await fixture()
  try {
    const h = f.mount()
    const source = f.enter('parent')
    source.session.append('turn/start', {turn: 1})
    source.session.append('step/start', {turn: 1, step: 1})
    source.session.append('step/end', {turn: 1, step: 1})
    source.session.append('turn/end', {turn: 1, reason: {kind: 'completed'}})
    await h.ready(source.session)
    const cut = sessionEvents<any>(source.session)
    const {session, detach} = f.enter('child', cut)
    await h.ready(session)
    assert.equal(session.inheritedEventCount, cut.length)
    assert.deepEqual(sessionEvents<any>(session).slice(0, cut.length), cut)
    assert.equal(foldSessionCalls(session).length, 0)
    session.append('turn/start', {turn: 2})
    session.append('step/start', {turn: 2, step: 1})
    session.append('step/end', {turn: 2, step: 1})
    session.append('turn/end', {turn: 2, reason: {kind: 'completed'}})
    assert.equal(foldSessionCalls(session).length, 1)
    assert.ok(foldSessionCalls(session)[0].source.startSeq >= cut.length)
    const handle = await f.ctx.sessionPersistence.create(session.header, {inheritedEventCount: session.inheritedEventCount})
    try {await handle.append(sessionEvents(session)); await handle.flush()} finally {await handle.close()}
    detach()
    using restored = await f.ctx.sessionQuery.observeSession(session.id, {projectionMode: 'none'})
    assert.equal(restored.inheritedEventCount, cut.length)
    assert.equal(restored.events.length, session.seq)
    class Table extends Map {async put(key: string, value: unknown) {this.set(key, value)}}
    const telemetry = createTelemetry({table: new Table(), sessions: {get: () => undefined}, query: {
      listSessions: async () => [{header: session.header}],
      observeSession: (id, options) => f.ctx.sessionQuery.observeSession(id, options),
    }})
    await telemetry.sync()
    assert.equal(telemetry.calls().length, 1, 'cold corpus inheritedEventCount is outside the header too')
  } finally {await f.close()}
})

test('native Agent cold activation waits for history and Controller restart rebuilds the instance', async () => {
  const f = await controllerFixture()
  const captured = deferred(), release = deferred()
  let delay = true
  const h = createSessionHistory({get: id => f.ctx.sessions.get(id), observe: async (id, options) => {
    const cut = await f.ctx.sessionQuery.observeSession(id, options)
    if (delay) {captured.resolve(); await release.promise}
    return cut
  }})
  f.ctx.on('session/event', h.accept, {global: true, prepend: true})
  f.ctx.on('session/disposed', h.disposeSession, {global: true})
  f.ctx.on('agent/created', async ({agent, signal}: any) => {
    await h.ready(agent.session, signal)
    return undefined
  }, {global: true, prepend: true})
  try {
    await f.stage('gated-agent')
    let settled = false
    const creating = f.ctx.sessionController.resolveAgent('gated-agent').then((result: any) => {settled = true; return result})
    await captured.promise
    assert.equal(settled, false, 'resolve cannot publish a ready Agent before observation')
    release.resolve()
    const first = await creating
    assert.ok(first.agent, first.error?.message)
    await ensureSessionHistory(first.agent.session)
    assert.equal(sessionEvents(first.agent.session).length, first.agent.session.seq)
    await f.stopController()
    assert.throws(() => sessionEvents(first.agent.session), /未就绪/)
    delay = false
    await f.startController()
    const second = await f.ctx.sessionController.resolveAgent('gated-agent')
    assert.ok(second.agent, second.error?.message)
    assert.notEqual(second.agent.session, first.agent.session)
    assert.equal(sessionEvents(second.agent.session).length, second.agent.session.seq)
  } finally {h.dispose(); await f.close()}
})
