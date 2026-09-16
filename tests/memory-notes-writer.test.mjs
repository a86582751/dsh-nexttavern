import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createDirectorNotesWriter } from '../src/memory/memory-notes-writer.js'

const legacy = JSON.parse(readFileSync(new URL('./fixtures/memory-notes-writer-legacy-v1.json', import.meta.url), 'utf8'))
const flush = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture() {
  const session = structuredClone(legacy.session), writes = [], requests = []
  const state = { head: structuredClone(legacy.initialHead), active: true, openTurn: null, roleplay: true,
    summarize: async () => structuredClone(legacy.response), beforeWrite: async () => {} }
  const engine = {
    memoryHead: () => state.head,
    async memoryUpdate(id, patch) {
      assert.equal(id, session.id)
      await state.beforeWrite(patch)
      writes.push(structuredClone(patch))
      state.head = { ...state.head, ...structuredClone(patch) }
    },
  }
  const writer = createDirectorNotesWriter({ config: { notesBatchChars: 10000 }, getEngine: () => engine,
    branchSettings: () => null, assertBranchActive: () => { if (!state.active) throw new Error('inactive branch') },
    isRoleplaySession: () => state.roleplay, inspectCompactionState: () => ({ openTurn: state.openTurn }),
    summarizeDetailed: async input => { requests.push(input); return state.summarize(input) },
  })
  return { writer, session, state, writes, requests }
}
function normalize(value) {
  const ids = new Map()
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (key === 'generationId' || key === 'sourceGeneration') {
      if (!ids.has(item)) ids.set(item, `generation-${ids.size + 1}`)
      return ids.get(item)
    }
    return item
  }))
}
const oldNow = Date.now
try {
  Date.now = () => 1000
  {
    const h = fixture(), signal = new AbortController().signal
    assert.equal(legacy.schemaVersion, 1)
    const result = await h.writer.refreshDirectorNotes(h.session, undefined, signal, 'command-fixture', legacy.refresh)
    assert.deepEqual(result, legacy.result)
    assert.deepEqual(normalize(h.writes), legacy.writes, 'old schema, checkpoint text, source hashes, cadence and decorated evidence')
    const requests = h.requests.map(({session,signal,...request}) => ({ ...request, sessionId: session.id, signalForwarded: Boolean(signal) }))
    assert.deepEqual(requests, legacy.requests, 'batch prompt inputs match the old writer')
    assert.equal(h.writer.pending(h.session.id), undefined)
    assert.equal(h.writer.busy.has(h.session.id), false)
    assert.equal((await h.writer.refreshDirectorNotes(h.session)).reason, 'up-to-date')
    assert.equal(h.requests.length, 1, 'restoring the current checkpoint needs no summary request')
    await h.writer.refreshDirectorNotes(h.session, undefined, signal, undefined, { ...legacy.refresh, force: true })
    assert.equal(h.requests.length, 2, 'explicit rebuild reprocesses the current checkpoint')
    assert.equal(h.requests[1].appendDelta, false)
    assert.equal(h.requests[1].previousSummary, '')
  }
  {
    const h = fixture()
    h.session.surface.nodes = []
    assert.equal((await h.writer.refreshDirectorNotes(h.session)).reason, 'no-completed-story')
    assert.equal(h.requests.length, 0)
    await h.writer.saveDirectorNotes(h.session, 'Manual empty history')
    assert.equal(h.state.head.directorNotes.throughSeq, -1)
    assert.equal(h.state.head.notesCadence.throughSeq, -1)
  }
  {
    const h = fixture(), result = deferred()
    h.state.summarize = () => result.promise
    const job = h.writer.refreshDirectorNotes(h.session)
    assert.ok(h.writer.pending(h.session.id))
    await assert.rejects(h.writer.refreshDirectorNotes(h.session), /正在进行中/)
    await h.writer.saveDirectorNotes(h.session, 'User edited')
    result.resolve(legacy.response)
    await assert.rejects(job, /用户修改/)
    assert.equal(h.state.head.directorNotes.text, 'User edited')
    assert.equal(h.writes.length, 1)
    assert.equal(h.writer.busy.has(h.session.id), false)
  }
  for (const change of ['source', 'branch']) {
    const h = fixture(), result = deferred()
    h.state.summarize = () => result.promise
    const job = h.writer.refreshDirectorNotes(h.session)
    if (change === 'source') h.session.surface.nodes = [1, 2]
    else h.state.active = false
    result.resolve(legacy.response)
    await assert.rejects(job, /剧情已变更|inactive branch/)
    assert.equal(h.writes.length, 0)
  }
  {
    const h = fixture(), writeGate = deferred()
    h.state.beforeWrite = () => writeGate.promise
    const manual = h.writer.saveDirectorNotes(h.session, 'Manual before queued task')
    await flush()
    const controller = new AbortController(), aborted = new Error('cancelled in write queue')
    const job = h.writer.refreshDirectorNotes(h.session, undefined, controller.signal)
    await flush()
    controller.abort(aborted)
    writeGate.resolve()
    await manual
    await assert.rejects(job, error => error === aborted)
    assert.equal(h.writes.length, 1, 'cancelled queued writer must not commit')
    assert.equal(h.writer.pending(h.session.id), undefined)
  }
  {
    const h = fixture()
    for (const seq of [2, 6]) h.session.events[seq].data.message.content[0].text = 's'.repeat(12000)
    let attempts = 0
    h.state.summarize = async () => { if (++attempts === 2) throw new Error('second batch failed'); return legacy.response }
    await assert.rejects(h.writer.refreshDirectorNotes(h.session), /second batch failed/)
    assert.equal(h.writes.length, 1)
    assert.equal(h.state.head.directorNotes.sourceEntryCount, 2)
    const prefix = h.state.head.directorNotes.text
    h.state.summarize = async () => legacy.response
    assert.equal((await h.writer.refreshDirectorNotes(h.session)).batches, 1)
    assert.equal(h.requests.length, 3, 'resume only the remaining batch')
    assert.ok(h.state.head.directorNotes.text.startsWith(prefix))
    assert.equal(h.state.head.directorNotes.projectionMode, 'append-delta')
  }
  {
    const h = fixture()
    h.state.openTurn = 1
    await assert.rejects(h.writer.refreshDirectorNotes(h.session), /空闲/)
    assert.equal(h.requests.length, 0)
    h.state.openTurn = null
    let attempts = 0
    h.state.beforeWrite = async () => { if (++attempts === 1) throw new Error('disk failed') }
    await assert.rejects(h.writer.saveDirectorNotes(h.session, 'failed'), /disk failed/)
    await h.writer.saveDirectorNotes(h.session, 'recovered')
    assert.equal(h.state.head.directorNotes.text, 'recovered', 'a failed serialized write must not poison the queue')
  }
  {
    const h = fixture(), events = [], nodes = []
    for (let turn = 1; turn <= 1000; turn++) {
      const add = (type, data) => { const seq = events.length; events.push({ seq, type, data }); return seq }
      add('turn/start', { turn })
      nodes.push(add('user/message', { source: { kind: 'user' }, content: [{ type: 'text', text: 'U' }] }))
      nodes.push(add('assistant/message', { turn, message: { content: [{ type: 'text', text: 'A' }] } }))
      add('turn/end', { turn, reason: { kind: 'completed' } })
    }
    h.session.events = events
    h.session.surface.nodes = nodes
    let evidenceReads = 0
    h.state.summarize = async input => ({ text: `${legacy.response.text}\n${'x'.repeat(12000)}`, deltas: [{
      get evidenceSeq() { evidenceReads++; return input.sourceSeqs.at(-1) }, summary: 'A fact', status: 'established',
    }], conflicts: [] })
    await h.writer.refreshDirectorNotes(h.session, undefined, undefined, undefined, { automatic: true, background: true })
    assert.ok(evidenceReads < 30, 'evidence lookup uses one index instead of scanning story rows for every delta')
    assert.ok(h.writes.every(patch => patch.deltas.at(-1).sourceKey && patch.deltas.at(-1).turnId))
    console.log(`notes-writer provenance: 2000 rows, ${evidenceReads} evidence reads across ${h.requests.length} batches`)
  }
  console.log('notes-writer: legacy checkpoints, no-op restore, generation/source guards, cancelled queue, partial resume and failed-write recovery passed')
} finally { Date.now = oldNow }
