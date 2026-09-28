// P0 server prototype: the same Node host that assembles an Agent request can
// evaluate author EJS/schema without a browser or exposing Node objects.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads'
import {newQuickJSWASMModuleFromVariant} from '../build-tools/node_modules/quickjs-emscripten-core/dist/index.mjs'
import variant from '../build-tools/node_modules/@jitl/quickjs-wasmfile-release-sync/dist/index.mjs'

const MAX_SOURCE = 16_384
const MAX_INPUT = 65_536
const MAX_OUTPUT = 65_536
const VM_MEMORY = 16 * 1024 * 1024
const VM_DEADLINE_MS = 250
const PARENT_DEADLINE_MS = 1_500

function compileEjs(template) {
  let cursor = 0
  const parts = []
  for (const match of template.matchAll(/<%([=-]?)([\s\S]*?)%>/g)) {
    parts.push(`output += ${JSON.stringify(template.slice(cursor, match.index))};`)
    parts.push(match[1] ? `output += String((${match[2]}));` : match[2])
    cursor = match.index + match[0].length
  }
  parts.push(`output += ${JSON.stringify(template.slice(cursor))};`)
  return parts.join('\n')
}

function scriptFor(task) {
  const snapshot = JSON.stringify(task.snapshot)
  const prelude = `
    'use strict';
    const snapshot = ${snapshot};
    const getvar = key => Object.hasOwn(snapshot.variables, key) ? snapshot.variables[key] : null;
    const getwi = key => Object.hasOwn(snapshot.worldbook, key) ? snapshot.worldbook[key] : null;
  `
  if (task.kind === 'ejs') {
    return `(() => {${prelude} let output = ''; ${compileEjs(task.source)} return {text: output};})()`
  }
  return `(() => {${prelude} const proposal = (${task.source}); return {proposal};})()`
}

async function runInWorker(task) {
  const quickjs = await newQuickJSWASMModuleFromVariant(variant)
  const runtime = quickjs.newRuntime()
  const deadline = Date.now() + VM_DEADLINE_MS
  runtime.setMemoryLimit(VM_MEMORY)
  runtime.setMaxStackSize(512 * 1024)
  runtime.setInterruptHandler(() => Date.now() >= deadline)
  const context = runtime.newContext()
  const activations = []
  try {
    const bridge = context.newFunction('activateWI', keyHandle => {
      const key = context.dump(keyHandle)
      if (typeof key !== 'string' || !Object.hasOwn(task.snapshot.worldbook, key)) return context.false
      if (!activations.includes(key)) activations.push(key)
      return context.true
    })
    context.setProp(context.global, 'activateWI', bridge)
    bridge.dispose()
    const guestResult = context.evalCode(scriptFor(task))
    const value = context.unwrapResult(guestResult).consume(context.dump)
    return {...value, activations}
  } finally {
    context.dispose()
    runtime.dispose()
  }
}

if (!isMainThread) {
  runInWorker(workerData).then(value => {
    if (!value || typeof value !== 'object' || JSON.stringify(value).length > MAX_OUTPUT) {
      parentPort.postMessage({ok: false, reason: 'output-limit'})
      return
    }
    parentPort.postMessage({ok: true, value})
  }, error => {
    parentPort.postMessage({ok: false, reason: String(error?.message ?? error).slice(0, 256)})
  })
} else {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/tavern-compat-contract-v1.json', import.meta.url), 'utf8'))
  const digest = value => createHash('sha256').update(value).digest('hex')
  const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
      : JSON.stringify(value)
  assert.equal(fixture.schemaVersion, 1)
  assert.equal(fixture.hashPolicy.schemaVersion, 1)
  const {packageSha256, ...packageBody} = fixture.cardPackage
  assert.equal(fixture.cardPackage.sourceSha256, digest(fixture.sourceUtf8))
  assert.equal(packageSha256, digest(canonical(packageBody)))
  assert.equal(fixture.cardPackage.greetings[0].sourceSha256, digest(fixture.cardPackage.greetings[0].text))
  assert.equal(fixture.stateSnapshot.packageSha256, packageSha256)
  assert.equal(fixture.stateSnapshot.valueSha256, digest(canonical(fixture.stateSnapshot.scopes)))
  assert.equal(fixture.promptPlan.items[0].contentSha256, digest(fixture.cardPackage.lore[0].content))
  const promptPreimage = Object.fromEntries(fixture.hashPolicy.promptPreimageFields
    .map(field => [field, fixture.promptPlan[field]]))
  assert.equal(fixture.promptPlan.inputSha256, digest(canonical(promptPreimage)))
  assert.equal(fixture.frameMessage.packageSha256, packageSha256)
  assert.equal(fixture.statePatch.expectedRevision, fixture.stateSnapshot.revision)
  assert.equal(fixture.frameMessage.worldlineId, fixture.stateSnapshot.worldlineId)

  async function evaluate(task) {
    if (!['ejs', 'schema'].includes(task.kind) || typeof task.source !== 'string'
      || task.source.length > MAX_SOURCE || JSON.stringify(task.snapshot).length > MAX_INPUT) {
      return {ok: false, reason: 'input-limit'}
    }
    const worker = new Worker(new URL(import.meta.url), {workerData: task,
      resourceLimits: {maxOldGenerationSizeMb: 64, stackSizeMb: 2}})
    try {
      const response = await new Promise(resolve => {
        let settled = false
        const finish = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value) }
        const timer = setTimeout(() => finish({ok: false, reason: 'hard-timeout'}), PARENT_DEADLINE_MS)
        worker.once('message', finish)
        worker.once('error', error => finish({ok: false, reason: String(error.message).slice(0, 256)}))
        worker.once('exit', () => setImmediate(() => finish({ok: false, reason: 'worker-exit'})))
      })
      if (!response.ok) return response
      const output = JSON.stringify(response.value)
      if (output.length > MAX_OUTPUT) return {ok: false, reason: 'output-limit'}
      return response
    } finally { await worker.terminate() }
  }

  const snapshot = {variables: fixture.stateSnapshot.scopes.chat,
    worldbook: {camp: fixture.cardPackage.greetings[0].text}}
  const assembly = {sections: [{name: 'identity', text: 'native'}]}
  const rendered = await evaluate({kind: 'ejs', source: '<%= getvar("hp") %> <% activateWI("camp") %><%= getwi("camp") %>', snapshot})
  assert.deepEqual(rendered, {ok: true, value: {text: '7 A quiet camp.', activations: ['camp']}})
  assembly.sections.push({name: 'tavern:prototype', text: rendered.value.text})
  assert.equal(assembly.sections[1].text, '7 A quiet camp.')
  assert.equal(typeof window, 'undefined', 'server assembly must not depend on a browser')

  const schema = await evaluate({kind: 'schema', source: '({valid: typeof getvar("hp") === "number", derived: getvar("hp") + 1})', snapshot})
  assert.deepEqual(schema, {ok: true, value: {proposal: {valid: true, derived: 8}, activations: []}})
  const globals = await evaluate({kind: 'schema', source: '({process: typeof process, require: typeof require, fetch: typeof fetch, WebSocket: typeof WebSocket})', snapshot})
  assert.deepEqual(globals.value.proposal, {process: 'undefined', require: 'undefined', fetch: 'undefined', WebSocket: 'undefined'})
  const escape = await evaluate({kind: 'schema', source: 'process.env', snapshot})
  assert.equal(escape.ok, false)
  const forged = await evaluate({kind: 'ejs',
    source: '<% JSON.stringify = () => "forged"; try { activations.push("camp") } catch {} %>safe', snapshot})
  assert.deepEqual(forged, {ok: true, value: {text: 'safe', activations: []}},
    'guest code cannot forge the host-owned activation log or result envelope')
  const loop = await evaluate({kind: 'ejs', source: '<% while (true) {} %>', snapshot})
  assert.equal(loop.ok, false, 'an infinite template must stop before assembly continues')
  const memory = await evaluate({kind: 'ejs',
    source: '<% new ArrayBuffer(20 * 1024 * 1024) %>ok', snapshot})
  assert.equal(memory.ok, false, 'VM memory exhaustion must reject the template')
  assert.notEqual(memory.reason, 'hard-timeout', 'the VM budget should reject allocation before the parent deadline')
  const output = await evaluate({kind: 'ejs', source: '<%= "x".repeat(100000) %>', snapshot})
  assert.deepEqual(output, {ok: false, reason: 'output-limit'})
  assert.deepEqual(await evaluate({kind: 'ejs', source: 'x'.repeat(MAX_SOURCE + 1), snapshot}),
    {ok: false, reason: 'input-limit'})
  console.log('tavern server isolation prototype=ok (EJS, schema, no Node globals, hard stop, budgets)')
}
