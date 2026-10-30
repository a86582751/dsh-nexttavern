/** Actual Phase B/C + decision owners; deterministic pending work, no model calls. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'
import type { CompletionDependencies, CompletionState } from '../src/core/roleplay-completion-types.js'
import type { ContextSession } from '../src/core/roleplay-context.js'
import type { DecisionDependencies } from '../src/core/roleplay-decision-types.js'
import {registerRoleplayOwnedWork,pendingRoleplayOwnedWork,stopRoleplayOwnedWork} from '../src/core/roleplay-owned-work.ts'

// Exercise these changed maintained owners directly. Their unchanged relative
// dependencies remain the canonical generated modules; never write generated JS.
const sources = new URL('../src/core/', import.meta.url).href
const generated = new URL('../lib/core/', import.meta.url)
const dependencies = registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.startsWith(sources) && specifier.startsWith('./') && specifier.endsWith('.js')) {
    return nextResolve(new URL(specifier, generated).href, context)
  }
  return nextResolve(specifier, context)
} })
const [{ createRoleplayCompletion }, { createRoleplayDecision }] = await Promise.all([
  import('../src/core/roleplay-completion.ts'), import('../src/core/roleplay-decision.ts'),
])
dependencies.deregister()

const tick = () => new Promise<void>(resolve => setImmediate(resolve))
class Table extends Map<string, Record<string, unknown>> {
  async put(key: string, value: Record<string, unknown>) { this.set(key, structuredClone(value)) }
  async update(key: string, work: (value: Record<string, unknown> | undefined) => Record<string, unknown>) {
    await this.put(key, work(this.get(key)))
  }
}
function phaseFixture() {
  const session: ContextSession = { id: 'background-stop', events: [
    { seq: 0, type: 'turn/start', data: { turn: 1 } },
    { seq: 1, type: 'user/message', surfaceOp: 'append', data: { id: 'player', content: [{ type: 'text', text: 'player' }] } },
    { seq: 2, type: 'assistant/message', surfaceOp: 'append', data: { turn: 1, message: { content: [{ type: 'text', text: 'story' }] } } },
    { seq: 3, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
  ], surface: { nodes: [1, 2] } }
  const snapshot = { branchId: session.id, turnId: 1, userText: 'player', userMessageId: 'player' }
  const state: CompletionState = { snapshots: new Map([[1, snapshot]]), snapshot, pendingTurn: 1,
    pendingScenes: new Map(), pendingScene: null, phaseBStarted: new Set(), phaseBRetryTimers: new Map(),
    phaseBAttempts: new Map(), regenerateAnchor: null }
  const tables = { branch: new Table(), memory: new Table(), scene: new Table() }
  const deps = {
    T: tables, storyBranchIsActive: () => true, cloneBranchRecord: structuredClone,
    reconcileNativeFork: async () => {},
    ctx: { get: () => null, sessions: { get: () => session }, logger: { warn() {} }, on() {} },
    resolveRoute: () => ({ session }), memoryForContext: () => null, publishTurnDecision: async () => {},
    llmJson: async () => null, LEDGER_WORKER_SYSTEM: 'ledger', CONTINUITY_WORKER_SYSTEM: 'continuity', cfg: {},
    contextWindowFor: () => null, contextWindowKey: (id: string) => id,
    svc: { recordVersion: async () => {} }, sessions: new Map([[session.id, state]]),
    failPendingNativeFork: async () => {}, isRoleplaySession: () => true,
    queueStatusObligation() {}, statusRunStartSeq: new Map(), recoverStatusObligations() {},
  } as unknown as CompletionDependencies
  return { session, snapshot, state, tables, deps, event: session.events[2]! }
}

test('completion close waits for its original pre-commit promise, not only commitChain', async () => {
  const f = phaseFixture(), reconcile = Promise.withResolvers<void>()
  let workers = 0
  f.deps.reconcileNativeFork = () => reconcile.promise
  f.deps.llmJson = async () => { workers++; return null }
  const owner = createRoleplayCompletion(f.deps)
  const work = owner.runPhaseBC(f.session, f.event, f.state, f.snapshot)
  const result = Promise.allSettled([work])
  await tick()
  assert.equal(owner.pending(), 1)
  assert.equal(f.state.commitChain, undefined)
  let closed = false
  const stop = owner.close()
  assert.equal(owner.close(), stop)
  void stop.then(() => { closed = true })
  await tick()
  assert.equal(closed, false)
  reconcile.resolve()
  await stop
  assert.equal((await result)[0]!.status, 'rejected')
  assert.equal(workers, 0, 'interrupted reconciliation must not admit new model work')
  assert.equal(owner.pending(), 0)
  assert.equal(f.state.snapshots.size, 1, 'durable recovery input must not be claimed committed')
  await assert.rejects(owner.runPhaseBC(f.session, f.event, f.state, f.snapshot), /ROLEPLAY_COMPLETION_STOPPED/)
})

test('completion close cancels both actual workers and waits for their cleanup; no shutdown retry is scheduled', async () => {
  const f = phaseFixture(), cleanup = Promise.withResolvers<void>()
  let aborted = 0
  f.deps.llmJson = async (_ctx, _route, options) => new Promise((_resolve, reject) => {
    options.signal!.addEventListener('abort', () => {
      aborted++
      void cleanup.promise.then(() => reject(options.signal!.reason))
    }, { once: true })
  })
  const owner = createRoleplayCompletion(f.deps)
  const work = owner.runPhaseBC(f.session, f.event, f.state, f.snapshot)
  await tick()
  const stop = owner.close()
  assert.equal(aborted, 2)
  let closed = false
  void stop.then(() => { closed = true })
  await tick()
  assert.equal(closed, false)
  cleanup.resolve()
  await Promise.all([work, stop])
  assert.equal(owner.pending(), 0)
  assert.equal(f.state.phaseBRetryTimers.size, 0)
  assert.equal(f.state.snapshots.size, 1)
  assert.equal(f.tables.branch.get('background-stop__phaseb-1')!.state, 'retry')
  assert.equal(f.tables.memory.size, 0)
})

test('completion close clears an already scheduled retry without deleting its recovery snapshot', async () => {
  const f = phaseFixture(), owner = createRoleplayCompletion(f.deps)
  await owner.runPhaseBC(f.session, f.event, f.state, f.snapshot)
  assert.equal(f.state.phaseBRetryTimers.size, 1)
  assert.equal(owner.pending(), 1)
  await owner.close()
  assert.equal(owner.pending(), 0)
  assert.equal(f.state.phaseBRetryTimers.size, 0)
  assert.equal(f.state.snapshots.size, 1)
  assert.equal(f.tables.branch.get('background-stop__phaseb-1')!.state, 'retry')
})

test('decision close owns detached work through its actual settlement and fences late publication', async () => {
  const cleanup = Promise.withResolvers<void>(), writes: unknown[] = []
  const route = { provider: 'fixture', model: 'fixture' }
  let workerSignal: AbortSignal | undefined
  const session = { id: 'decision-stop', events: [], surface: { nodes: [] } }
  const event = { seq: 2, type: 'assistant/message', data: { turn: 1 } }
  const snapshot = { branchId: session.id, turnId: 1, userMessageId: 'player', userText: 'player', baseRevision: 0 }
  const deps = {
    T: { decision: { get: () => undefined, put: async (_key: string, value: unknown) => { writes.push(value) } },
      status: { get: () => undefined }, scene: { get: () => undefined } },
    withDecisionMutationLock: async (_id: string, work: () => Promise<unknown>) => work(),
    normalizeDecisionRecord: () => null, taskStory: () => [{ seq: 1, text: 'player' }],
    isStale: () => false, isLatestVisibleTurn: () => true, statusSource: () => ({ sourceSeqs: [1, 2] }),
    modelPolicy: { resolve: () => ({ actualRoute: route, main: route, execution: 'spawn' }) },
    selectedStatusRecord: () => null, sameModelRoute: () => false, normalizeStatusRecord: () => null,
    normalizeStatusOption: (value: unknown) => value, buildDecisionContext: async () => ({ context: {}, dependencies: [] }),
    memoryForContext: () => null, ctx: { get: () => null }, resolveRoute: () => ({ session }),
    llmJson: async (_ctx: unknown, _route: unknown, request: { signal: AbortSignal }) => {
      workerSignal = request.signal
      await cleanup.promise
      return { options: [{ label: 'late choice' }] }
    }, DECISION_SYSTEM: 'fixture', cfg: {}, DEFAULT_CONFIG: { decisionWorkerTimeoutMs: 1000 },
  } as unknown as DecisionDependencies
  const owner = createRoleplayDecision(deps)
  const job = owner.publishTurnDecision(session, event, snapshot, 'body')
  assert.equal(owner.publishTurnDecision(session, event, snapshot, 'body'), job)
  await tick()
  assert.equal(owner.pending(), 1)
  const stop = owner.close()
  assert.equal(owner.close(), stop)
  assert.equal(workerSignal!.aborted, true)
  let closed = false
  void stop.then(() => { closed = true })
  await tick()
  assert.equal(closed, false, 'abort notification is not worker settlement')
  cleanup.resolve()
  await Promise.all([job, stop])
  assert.equal(owner.pending(), 0)
  assert.deepEqual(writes, [])
  const late = owner.publishTurnDecision(session, { ...event, seq: 3 }, snapshot, 'body')
  await assert.rejects(late, /ROLEPLAY_DECISION_STOPPED/)
  await late.admission
  assert.equal(owner.pending(), 0)
})

test('pre-root barrier waits for registered standing owners before provider teardown and closes admission', async () => {
  const root = {}, phase = Promise.withResolvers<void>(), decision = Promise.withResolvers<void>()
  const order: string[] = []
  const releasePhase = registerRoleplayOwnedWork(root, {
    pending: () => 1,
    close() { order.push('phase-cancel'); return phase.promise },
  })
  const releaseDecision = registerRoleplayOwnedWork(root, {
    pending: () => 1,
    close() { order.push('decision-cancel'); return decision.promise },
  })
  assert.equal(pendingRoleplayOwnedWork(root), 2)
  // Product Host and preset have separate physical module copies. A distinct
  // ESM instance must still see the same real owner references for this root.
  const hostCopy = await import(new URL('../src/core/roleplay-owned-work.ts?host-copy', import.meta.url).href)
  assert.equal(hostCopy.pendingRoleplayOwnedWork(root), 2)
  const stop = hostCopy.stopRoleplayOwnedWork(root)
  assert.equal(stopRoleplayOwnedWork(root), stop)
  const rootStop = stop.then(() => { order.push('root-provider-dispose') })
  assert.deepEqual(order, ['phase-cancel', 'decision-cancel'])
  assert.throws(() => registerRoleplayOwnedWork(root, {
    pending: () => 0,
    close: async () => {},
  }), /ROLEPLAY_OWNED_WORK_STOPPED/)
  phase.resolve()
  await tick()
  assert.deepEqual(order, ['phase-cancel', 'decision-cancel'])
  decision.resolve()
  await rootStop
  assert.deepEqual(order, ['phase-cancel', 'decision-cancel', 'root-provider-dispose'])
  releasePhase()
  releaseDecision()
  assert.equal(pendingRoleplayOwnedWork(root), 0)
})
