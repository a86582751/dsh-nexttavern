import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { createMemoryScheduler } from '../lib/memory/memory-scheduler.js'

const flush = () => new Promise(resolve => setImmediate(resolve))
const advance = async ms => { mock.timers.tick(ms); await flush() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture(config = {}) {
  const session = { id: 'scheduler-session' }, agent = { session, version: 1 }
  const notes = [], compactions = [], warnings = [], notesBusy = new Set(), busy = new Set()
  const state = { due: true, roleplay: true, above: true, note: async () => 'saved', compact: async () => 'compacted' }
  const scheduler = createMemoryScheduler({
    config: { autoNotes: true, autoRetryBaseMs: 1000, autoRetryMaxMs: 2500, ...config },
    isRoleplaySession: () => state.roleplay, notesDue: () => state.due,
    notesBusy, busy, aboveThreshold: () => state.above,
    requestNotes: async (session, agent, signal) => { notes.push({ session, agent, signal }); return state.note(signal) },
    requestCompaction: async (session, agent, signal, force) => { compactions.push({ session, agent, signal, force }); return state.compact(signal) },
    warn: message => warnings.push(message),
  })
  return { scheduler, session, agent, notes, compactions, warnings, notesBusy, busy, state }
}
mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 })
try {
  {
    const h = fixture({ autoNotes: false })
    assert.equal(await h.scheduler.organizeAutomatically(h.agent), null)
    h.state.due = false
    h.notesBusy.add(h.session.id)
    assert.equal(await h.scheduler.organizeAutomatically(h.agent, { checkpoint: true }), null)
    h.notesBusy.clear()
    assert.equal(await h.scheduler.organizeAutomatically(h.agent, { checkpoint: true }), 'saved')
    assert.equal(h.notes.length, 1, 'explicit checkpoint bypasses automatic cadence but respects busy writes')
    h.state.roleplay = false
    assert.equal(await h.scheduler.organizeAutomatically(h.agent, { checkpoint: true }), null)
    assert.equal(await h.scheduler.compactAutomatically(h.agent, 'context-overflow'), null)
    assert.equal(await h.scheduler.organizeAutomatically(), null)
    h.scheduler.dispose()
  }
  {
    const h = fixture(), first = deferred()
    h.state.note = () => first.promise
    h.scheduler.scheduleNotes(h.agent)
    h.scheduler.scheduleNotes(h.agent)
    assert.equal(h.notes.length, 0)
    await advance(1)
    assert.equal(h.notes.length, 1, 'coalesce queued status/event triggers')
    const pending = h.scheduler.pendingNotes(h.session.id)
    assert.ok(pending)
    const latestAgent = { session: h.session, version: 2 }
    h.scheduler.scheduleNotes(latestAgent)
    h.scheduler.scheduleNotes(latestAgent)
    h.state.note = async () => 'newer saved'
    first.resolve('first saved')
    assert.equal(await pending, 'first saved')
    assert.equal(h.scheduler.pendingNotes(h.session.id), undefined, 'pending promise includes scheduler cleanup')
    await advance(1)
    assert.equal(h.notes.length, 2, 'one rerun for coalesced arrivals during the active request')
    assert.equal(h.notes[1].agent, latestAgent)
    h.scheduler.dispose()
  }
  {
    const h = fixture()
    h.state.note = async () => { throw new Error('provider failed') }
    assert.equal(await h.scheduler.organizeAutomatically(h.agent), null)
    assert.match(h.warnings[0], /provider failed/)
    assert.equal(await h.scheduler.organizeAutomatically(h.agent), null)
    assert.equal(h.notes.length, 1)
    await advance(100000)
    assert.equal(h.notes.length, 1, 'failure alone never creates a retry timer')
    await h.scheduler.organizeAutomatically(h.agent)
    assert.equal(h.notes.length, 2)
    await h.scheduler.organizeAutomatically(h.agent, { checkpoint: true })
    assert.equal(h.notes.length, 3, 'explicit checkpoint can bypass backoff')
    h.scheduler.dispose()
  }
  {
    const h = fixture()
    h.state.note = async () => { throw new Error('retry later') }
    await h.scheduler.organizeAutomatically(h.agent)
    for (const delay of [1000, 2000, 2500]) {
      const count = h.notes.length
      await advance(delay - 1)
      await h.scheduler.organizeAutomatically(h.agent)
      assert.equal(h.notes.length, count)
      await advance(1)
      await h.scheduler.organizeAutomatically(h.agent)
      assert.equal(h.notes.length, count + 1, 'backoff doubles and caps at configured maximum')
    }
    h.scheduler.dispose()
  }
  {
    const h = fixture(), active = deferred()
    h.state.note = () => active.promise
    const job = h.scheduler.organizeAutomatically(h.agent)
    h.scheduler.scheduleNotes(h.agent)
    h.scheduler.dispose()
    assert.equal(h.notes[0].signal.aborted, true)
    active.resolve('late result')
    await job
    await advance(100000)
    assert.equal(h.notes.length, 1, 'dispose cancels reruns even when a task resolves late')
    h.scheduler.scheduleNotes(h.agent)
    assert.equal(await h.scheduler.organizeAutomatically(h.agent, { checkpoint: true }), null)
    await h.scheduler.compactAutomatically(h.agent, 'context-overflow')
    assert.equal(h.compactions.length, 0, 'disposed scheduler cannot start compaction')
  }
  {
    const h = fixture()
    h.scheduler.scheduleNotes(h.agent)
    h.scheduler.dispose()
    await advance(100000)
    assert.equal(h.notes.length, 0, 'dispose clears a queued timer')
  }
  {
    const h = fixture(), failure = new Error('compaction failed')
    h.state.above = false
    assert.equal(await h.scheduler.compactAutomatically(h.agent), null)
    h.busy.add(h.session.id)
    assert.equal(await h.scheduler.compactAutomatically(h.agent, 'context-overflow'), null)
    h.busy.clear()
    assert.equal(await h.scheduler.compactAutomatically(h.agent, 'context-overflow'), 'compacted')
    assert.equal(h.compactions[0].force, true)
    h.state.above = true
    h.state.compact = async () => { throw failure }
    await assert.rejects(h.scheduler.compactAutomatically(h.agent), error => error === failure)
    assert.equal(await h.scheduler.compactAutomatically(h.agent, 'context-overflow'), null, 'overflow retains failure backoff')
    await advance(1000)
    const controller = new AbortController()
    controller.abort(failure)
    await assert.rejects(h.scheduler.compactAutomatically(h.agent, 'pressure', controller.signal), error => error === failure)
    h.state.compact = async () => 'recovered'
    assert.equal(await h.scheduler.compactAutomatically(h.agent), 'recovered', 'cancelled work does not add failure backoff')
    h.scheduler.dispose()
  }
  console.log('memory-scheduler: cadence, coalescing, cleanup barrier, capped backoff, no paid auto-retry, cancellation and disposal passed')
} finally {
  mock.timers.reset()
}
