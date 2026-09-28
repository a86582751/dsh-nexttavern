// P0 test-only sandbox: a bounded QuickJS Worker for author templates and schema proposals.
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
}

export async function evaluateTavernPrototype(task) {
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
