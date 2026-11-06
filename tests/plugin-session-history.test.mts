/** Actual alpha.6 Session and observations; no Harness or model calls. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {after,test} from 'node:test'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createSessionHistory, ensureSessionHistory, sessionEvents, sessionHistoryCut, sessionNativePrefixSha256} from '../lib/core/session-history.js'
import {recordSha256} from '../lib/core/roleplay-data.js'
import {foldSessionCalls} from '../lib/core/tavern-telemetry-fold.js'
import {createTelemetry} from '../lib/core/tavern-telemetry.js'
import {controllerFixture} from './plugin-fork-controller-fixture.mts'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const encoderDirectory=createTestDirectory('session-history-native-encoder-')
after(()=>cleanupTestDirectory(encoderDirectory))
const encoderBuild=await require('esbuild').build({entryPoints:[fileURLToPath(new URL(
  '../development/agent-loop/src/input-admission.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false})
const encoderFile=path.join(encoderDirectory,'input-admission.mjs')
fs.writeFileSync(encoderFile,encoderBuild.outputFiles[0].contents)
const {nativeInputCanonical,nativeInputSha256}=await import(pathToFileURL(encoderFile).href) as
  typeof import('../development/agent-loop/src/input-admission.ts')
function assertNativePrefixes(session:object) {
  const cut=sessionHistoryCut<any>(session),events=cut.materialize()
  for(let index=0;index<=cut.length;index++)
    assert.equal(cut.nativeInputPrefixSha256(index),nativeInputSha256(events.slice(0,index)))
  assert.equal(cut.nativeInputPrefixSha256(),nativeInputSha256(events))
}
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
  function mount(read = observe, feed = true, nativeInput = true) {
    const history = createSessionHistory({get: id => ctx.sessions.get(id), observe: read,
      ...(nativeInput?{nativeInputCanonical}:{})})
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
    assert.throws(() => sessionHistoryCut(session), /未就绪/)
    const pending = h.ready(session)
    await captured.promise
    session.append('turn/end', {turn: 1, reason: {kind: 'completed'}})
    release.resolve(); await pending
    const first = sessionEvents<any>(session)
    const firstView = sessionHistoryCut<any>(session)
    assert.equal(firstView, sessionHistoryCut(session))
    assert.equal(firstView.source, 'native')
    assert.equal(firstView.materialize(), first)
    assert.equal(Array.isArray(firstView), false)
    assert.equal(first.length, session.seq)
    assert.ok(Object.isFrozen(first))
    assert.equal(sessionEvents(session), first)
    const firstCuts = Array.from({length: first.length + 1}, (_, cut) => cut)
    assert.deepEqual([...sessionNativePrefixSha256(first, firstCuts)!],
      firstCuts.map(cut => [cut, recordSha256(first.slice(0, cut))]))
    for (const cut of firstCuts) assert.equal(firstView.prefixSha256(cut), recordSha256(first.slice(0, cut)))
    assertNativePrefixes(session)
    for (let turn = 2; turn <= 102; turn++) {
      session.append('turn/start', {turn})
      session.append('turn/end', {turn, reason: {kind: 'completed'}})
    }
    const last = sessionEvents<any>(session)
    const lastView = sessionHistoryCut<any>(session)
    const historicalView=sessionHistoryCut<any>(session,first.length)
    assert.equal(historicalView.owner,firstView.owner)
    assert.equal(historicalView.source,'native')
    assert.deepEqual(historicalView.materialize(),first,'a requested fork cut cannot widen to the live prefix')
    assert.equal(historicalView.at(first.length),undefined)
    assert.equal(historicalView.nativeInputPrefixSha256(),nativeInputSha256(first))
    assert.equal(lastView.owner, firstView.owner)
    assert.equal(firstView.length, first.length)
    assert.equal(firstView.at(first.length), undefined)
    assert.equal(firstView.prefixSha256(last.length), undefined)
    assert.equal(firstView.nativeInputPrefixSha256(last.length),undefined)
    assert.equal(firstView.nativeInputPrefixSha256(),nativeInputSha256(first))
    assert.deepEqual([...firstView.range()], first)
    assert.throws(() => [...firstView.range(0, last.length)], RangeError)
    const tail: unknown[] = []
    lastView.forEachRange(first.length, last.length, (event, seq) => {
      assert.equal(event.seq, seq)
      tail.push(event)
    })
    assert.deepEqual(tail, last.slice(first.length))
    h.accept(session, last.at(-1))
    const lastCuts = Array.from({length: last.length + 1}, (_, cut) => cut)
    assert.deepEqual([...sessionNativePrefixSha256(last, lastCuts)!],
      lastCuts.map(cut => [cut, recordSha256(last.slice(0, cut))]))
    for (const cut of lastCuts) assert.equal(lastView.prefixSha256(cut), recordSha256(last.slice(0, cut)))
    assertNativePrefixes(session)
    assert.equal(sessionNativePrefixSha256(first, [last.length]), undefined,
      'a prior cut cannot supply a future Native identity')
    assert.equal(sessionNativePrefixSha256(Object.freeze([...last]), [last.length]), undefined,
      'detached DATA is not an owner snapshot')
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
    assertNativePrefixes(second.session)
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
    assertNativePrefixes(session)
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
    const parentView = sessionHistoryCut<any>(source.session)
    const {session, detach} = f.enter('child', cut)
    await h.ready(session)
    assert.equal(session.inheritedEventCount, cut.length)
    const childView = sessionHistoryCut<any>(session)
    assert.notEqual(childView.owner, parentView.owner)
    assert.equal(childView.prefixSha256(cut.length), parentView.prefixSha256(cut.length))
    assert.equal(childView.nativeInputPrefixSha256(cut.length),parentView.nativeInputPrefixSha256(cut.length))
    assertNativePrefixes(session)
    assert.deepEqual(sessionEvents<any>(session).slice(0, cut.length), cut)
    assert.equal(sessionNativePrefixSha256(sessionEvents(session), [cut.length])?.get(cut.length),
      sessionNativePrefixSha256(cut, [cut.length])?.get(cut.length), 'fork uses its exact inherited cut')
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
  const h = createSessionHistory({get: id => f.ctx.sessions.get(id), nativeInputCanonical, observe: async (id, options) => {
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
    const firstView = sessionHistoryCut(first.agent.session)
    assert.equal(sessionEvents(first.agent.session).length, first.agent.session.seq)
    await f.stopController()
    assert.throws(() => sessionEvents(first.agent.session), /未就绪/)
    assert.throws(() => sessionHistoryCut(first.agent.session), /未就绪/)
    assert.equal(firstView.materialize().length, firstView.length, 'released cuts retain DATA only')
    delay = false
    await f.startController()
    const second = await f.ctx.sessionController.resolveAgent('gated-agent')
    assert.ok(second.agent, second.error?.message)
    assert.notEqual(second.agent.session, first.agent.session)
    assert.notEqual(sessionHistoryCut(second.agent.session).owner, firstView.owner)
    assert.equal(sessionEvents(second.agent.session).length, second.agent.session.seq)
    assertNativePrefixes(second.agent.session)
  } finally {h.dispose(); await f.close()}
})

test('loaded cuts explicitly snapshot plain arrays without Native prefix authority', () => {
  const events = [{seq: 0, type: 'loaded', data: '汉字 😀'}]
  const cut = sessionHistoryCut<typeof events[number]>({events})
  events.push({seq: 1, type: 'loaded', data: 'tail'})
  assert.equal(cut.source, 'loaded')
  assert.equal(cut.length, 1)
  assert.equal(cut.at(1), undefined)
  assert.equal(cut.prefixSha256(1), recordSha256(events.slice(0, 1)))
  assert.equal(cut.prefixSha256(0), recordSha256([]))
  assert.equal(sessionNativePrefixSha256(cut.materialize(), [1]), undefined)
  assert.equal(cut.nativeInputPrefixSha256(),undefined)
  assert.deepEqual([...cut.range()], events.slice(0, 1))
})

test('a configured mount adds exact Native prefixes to an existing owner without changing prior cuts',async()=>{
  const f=await fixture()
  try {
    const plain=f.mount(undefined,true,false),{session}=f.enter('late-encoder')
    session.append('turn/start',{turn:1});await plain.ready(session)
    const original=sessionHistoryCut(session)
    assert.equal(original.nativeInputPrefixSha256(),undefined)
    const configured=f.mount();await configured.ready(session)
    assertNativePrefixes(session)
    const upgraded=sessionHistoryCut(session)
    assert.equal(upgraded.owner,original.owner)
    configured.dispose()
    session.append('turn/end',{turn:1,reason:{kind:'completed'}})
    assertNativePrefixes(session)
    assert.equal(original.nativeInputPrefixSha256(),undefined)
    assert.equal(upgraded.nativeInputPrefixSha256(session.seq),undefined)
    assert.equal(f.reads,1)
  }finally {await f.close()}
})

test('the exported Native encoder preserves undefined members and sparse-array byte semantics',()=>{
  const value={z:undefined,a:[undefined,,{汉字:'😀',optional:undefined}]}
  assert.equal(nativeInputCanonical(value),'{"a":[undefined,,{"optional":undefined,"汉字":"😀"}],"z":undefined}')
  assert.notEqual(nativeInputSha256(value),recordSha256(value))
  assert.equal(sessionHistoryCut({events:[{seq:0,type:'raw',data:value}]}).nativeInputPrefixSha256(),undefined)
})
