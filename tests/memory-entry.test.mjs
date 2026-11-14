import {after as afterNativeDependencies} from 'node:test'
import {installOwnedNativeTestDependencies} from './plugin-owned-packages-fixture.mts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const removeOwnedNativeDependencies=await installOwnedNativeTestDependencies(['session'])
afterNativeDependencies(removeOwnedNativeDependencies)
const memory=await import('../lib/memory/roleplay-memory-engine.js')
const legacy = JSON.parse(readFileSync(new URL('./fixtures/memory-notes-writer-legacy-v1.json', import.meta.url), 'utf8'))
function fixture(config = {}) {
  const session = structuredClone(legacy.session)
  session.header = { agentPreset: 'roleplay' }
  session.append = (type, data, options) => {
    const event = { seq: session.events.length, type, data: structuredClone(data), ...structuredClone(options ?? {}) }
    session.events.push(event)
    if (options?.surfaceOp?.op === 'replace') {
      const start = session.surface.nodes.indexOf(options.surfaceOp.startSeq), end = session.surface.nodes.indexOf(options.surfaceOp.endSeq)
      assert.ok(start >= 0 && end >= start)
      session.surface.nodes.splice(start, end - start + 1, event.seq)
    }
    return event
  }
  const state = { head: structuredClone(legacy.initialHead), calls: [], writes: [], maintenance: 0, flushes: 0 }
  const hooks = new Map(), commands = new Map(), services = new Map(), cleanup = []
  const engine = {
    memoryHead: () => state.head,
    async memoryUpdate(id, patch) { assert.equal(id, session.id); state.writes.push(structuredClone(patch)); state.head = { ...state.head, ...structuredClone(patch) } },
    settings: () => ({}),
    ownsMemoryPreparation: true,
    async nativeTask(spec) {
      state.calls.push(spec)
      spec.onResult?.({ actualRoute: { provider: 'fixture', model: 'fixture' } })
      return spec.validate(spec.background ? legacy.response : legacy.response.text)
    },
  }
  const agent = { session, async runMaintenance(work) { state.maintenance++; return work(new AbortController().signal) } }
  const ctx = {
    get: () => engine, provide: (name, value) => services.set(name, value),
    tokenMeter: { measure: () => ({ nodes: session.surface.nodes.map(seq => ({ seq, tokens: 30, heuristicTokens: 30 })), totalTokens: 300 }), estimateMessage: () => 1 },
    sessions: { async flush() { state.flushes++ } },
    effect(work) { cleanup.push(work()) },
    on(name, handler) { hooks.set(name, handler) },
    inject(names, work) { assert.deepEqual(names, ['commands']); work({ commands: { register(command) { commands.set(command.name, command) } } }) },
    logger: { info() {}, warn() {} },
  }
  const ready = memory.apply(ctx, { auto: false, autoNotes: false, ...config })
  const invoke = (rawInput, suppliedAgent = agent) => commands.get('memory').handler({ agent: suppliedAgent, rawInput, commandId: 'command', signal: new AbortController().signal })
  return { ready, ctx, engine, agent, session, state, hooks, services, invoke, dispose: () => cleanup.forEach(fn => fn()) }
}

assert.deepEqual(Object.keys(memory).sort(), ['apply', 'directorNotesForBranch', 'durableCompactionArchives', 'filterMemoryRecordForBranch', 'inject', 'legacyCadenceSlots', 'memoryNotesCadence', 'name', 'queryStoryHistory', 'readStoryHistory', 'selectedStoryHistory', 'storyCadenceSlots'].sort())
assert.equal(memory.name, 'roleplay-memory-engine')
assert.deepEqual(memory.inject, ['sessions', 'llm', 'tokenMeter', 'agentDefaultModel'])
{
  const h = fixture()
  await h.ready
  try {
    assert.equal((await h.invoke('view')).kind, 'success')
    assert.match((await h.invoke('view')).text, /记忆账本版本 2/)
    assert.equal((await h.invoke('lock Added fact')).kind, 'success')
    assert.deepEqual(h.state.head.lockedFacts.at(-1), { text: 'Added fact', atSeq: 7, sessionId: h.session.id, lockedBy: 'user' })
    assert.equal((await h.invoke('unlock 1')).text, '已解锁：Added fact')
    assert.equal((await h.invoke('unlock 99')).kind, 'error')
    assert.equal((await h.invoke('lock')).kind, 'error')
    assert.equal(JSON.parse((await h.invoke('history')).text).totalEntries, 4)
    assert.equal((await h.invoke('unrecognized')).kind, 'error')
    assert.equal(h.state.calls.length, 0, 'read/lock/unlock commands do not call models')
    assert.equal((await h.invoke('organize')).kind, 'success')
    assert.equal(h.state.maintenance, 1)
    assert.equal(h.state.calls.length, 1)
    assert.equal((await h.invoke('organize')).kind, 'success')
    assert.equal(h.state.calls.length, 1, 'unchanged notes do not request another summary')
    assert.equal((await h.invoke('compact')).kind, 'success')
    assert.equal(h.state.flushes, 1)
    h.session.header.agentPreset = 'standard'
    assert.match((await h.invoke('view')).text, /不是角色扮演会话/)
  } finally { h.dispose() }
}
{
  const h = fixture()
  await h.ready
  try {
    const controller = new AbortController(), failure = new Error('checkpoint caller cancelled')
    controller.abort(failure)
    await assert.rejects(h.services.get('compaction').ensureWindowCheckpoint(h.agent, controller.signal), error => error === failure)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(h.state.calls.length, 0, 'cancelled checkpoint caller must not start a background summary')
  } finally { h.dispose() }
}
{
  const h = fixture({ auto: true, autoNotes: true })
  await h.ready
  try {
    assert.deepEqual([...h.hooks.keys()].sort(), ['agent/pre-step', 'agent/status', 'session/event'])
    let next = 0
    assert.equal(await h.hooks.get('agent/pre-step')({ agent: h.agent, step: 1, messages: [{ role: 'user', source: { kind: 'user' } }] }, () => ++next), 1)
    assert.equal(h.state.calls.length, 0, 'core-owned preparation bypasses automatic compaction')
    h.hooks.get('session/event')(h.session, { type: 'turn/end', data: { reason: { kind: 'aborted' } } })
    h.hooks.get('agent/status')({ status: 'running', agent: h.agent })
    assert.equal(h.state.calls.length, 0)
    const svc = h.services.get('compaction')
    assert.equal(await svc.compactIfNeeded(h.agent, new AbortController().signal), null, 'legacy two-argument compaction overload remains valid')
  } finally { h.dispose() }
}
{
  const h = fixture()
  await h.ready
  try {
    const count = 10001
    h.session.header.agentPreset = 'standard'
    h.session.events = Array.from({ length: count }, (_, seq) => ({ seq, type: 'assistant/chunk', data: {} }))
    assert.match((await h.invoke('unrecognized')).text, /不是角色扮演会话/, 'the header classifies a history with no preset selection')
    h.session.events[count - 1] = { seq: count - 1, type: 'agent-preset/selected', data: { agentPreset: 'roleplay' } }
    assert.match((await h.invoke('unrecognized')).text, /用法/)
    h.session.events.push({ seq: count, type: 'agent-preset/selected', data: { agentPreset: '' } })
    assert.match((await h.invoke('unrecognized')).text, /用法/, 'an empty selection preserves the last truthy preset')
    h.session.events.push({ seq: count + 1, type: 'agent-preset/selected', data: { agentPreset: 'standard' } })
    assert.match((await h.invoke('unrecognized')).text, /不是角色扮演会话/, 'the latest selected preset supersedes earlier roleplay history')
    h.session.events.push({ seq: count + 2, type: 'agent-preset/selected', data: { agentPreset: 'roleplay' } })
    // Alpha.7 keeps the inherited prefix length on the session itself, so the
    // classification boundary follows `inheritedEventCount`.
    h.session.inheritedEventCount = 1
    h.session.events[0] = { seq: 0, type: 'subagent/descriptor', data: {} }
    assert.match((await h.invoke('unrecognized')).text, /用法/, 'inherited descriptors do not classify a child as a task session')
    h.session.events[1] = { seq: 1, type: 'subagent/descriptor', data: {} }
    assert.match((await h.invoke('unrecognized')).text, /不是角色扮演会话/)
    assert.equal(h.state.calls.length, 0, 'classification and command guidance never request a model')
  } finally { h.dispose() }
}
console.log('memory entry: export/command compatibility, hooks, legacy overload, pre-cancelled checkpoint guard and history/preset/task classification passed')
