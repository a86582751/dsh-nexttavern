// P0 prototype against a real native Controller/Agent prompt assembly.
// The author evaluator and its snapshots remain test-only; no card code enters
// the product hook until its source and branch contracts are implemented.
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {controllerFixture} from './plugin-fork-controller-fixture.mts'
import {evaluateTavernPrototype} from './tavern-compat-server-evaluator.mjs'

test('bounded author EJS reaches real Agent assembly and fails closed per branch', async () => {
  const fixture = await controllerFixture({includeRuntimeContext: true})
  try {
    const source = await fixture.stage('tavern-compat-source')
    const resolved = await fixture.ctx.sessionController.resolveAgent(source.id)
    assert.ok(resolved.agent, resolved.error?.message)
    const fork = await fixture.stageFrom('tavern-compat-fork', resolved.agent.session)
    const forkResolved = await fixture.ctx.sessionController.resolveAgent(fork.id)
    assert.ok(forkResolved.agent, forkResolved.error?.message)

    const snapshots = new Map([
      [source.id, {variables: {hp: 7}, worldbook: {camp: 'Source camp.'}}],
      [fork.id, {variables: {hp: 9}, worldbook: {camp: 'Fork camp.'}}],
    ])
    const templates = new Map([
      [source.id, '<%= getvar("hp") %> <% activateWI("camp") %><%= getwi("camp") %>'],
      [fork.id, '<%= getvar("hp") %> <% activateWI("camp") %><%= getwi("camp") %>'],
    ])
    const observed: string[] = []
    let requestCalls = 0
    fixture.ctx.on('agent/request', async (_payload: unknown, next: () => Promise<unknown>) => {
      requestCalls++
      return next()
    }, {global: true})
    fixture.ctx.on('system-prompt/assemble', async (_draft: unknown, context: {agent?: {session?: {id: string}}}, next: () => Promise<any>) => {
      const assembly = await next()
      const branchId = context.agent?.session?.id
      observed.push(String(branchId))
      const snapshot = snapshots.get(branchId)
      if (!snapshot) throw Error(`missing branch snapshot: ${branchId}`)
      const result = await evaluateTavernPrototype({kind: 'ejs', source: templates.get(branchId), snapshot})
      if (!result.ok) throw Error(`author template rejected: ${result.reason}`)
      assert.deepEqual(result.value.activations, ['camp'])
      // This preset has a complete persona section. Native dynamic contexts
      // survive that override and are delivered as sourced user-role input.
      return {...assembly, contexts: [...assembly.contexts, {name: 'tavern:prototype', text: result.value.text}]}
    }, {global: true})

    const main = await fixture.requestSelection(resolved.agent)
    assert.deepEqual(observed, [source.id])
    assert.equal(main.prompt, 'Cold probe fixture-default/before')
    assert.deepEqual(main.assembly.contexts.find((item: {name: string}) => item.name === 'tavern:prototype'),
      {name: 'tavern:prototype', text: '7 Source camp.'})
    const branched = await fixture.requestSelection(forkResolved.agent)
    assert.deepEqual(branched.assembly.contexts.find((item: {name: string}) => item.name === 'tavern:prototype'),
      {name: 'tavern:prototype', text: '9 Fork camp.'})

    const before = forkResolved.agent.session.snapshotEvents()
    const requestsBeforeFailure = requestCalls
    templates.set(fork.id, '<% while (true) {} %>')
    await assert.rejects(fixture.requestSelection(forkResolved.agent), /author template rejected/)
    assert.equal(requestCalls, requestsBeforeFailure,
      'a rejected assembly cannot reach the native agent/request waterfall')
    assert.deepEqual(forkResolved.agent.session.snapshotEvents(), before,
      'failed assembly must not write branch state or start a model request')
    assert.deepEqual((await fixture.requestSelection(resolved.agent)).assembly.contexts
      .find((item: {name: string}) => item.name === 'tavern:prototype'),
      {name: 'tavern:prototype', text: '7 Source camp.'},
      'a failed fork assembly cannot contaminate its source branch')
  } finally { await fixture.close() }
})
