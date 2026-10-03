// Test-only synthetic ESM host. Never pass downloaded helpers or private card scripts here.
import {createHash} from 'node:crypto'
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads'
import {newQuickJSWASMModuleFromVariant} from '../build-tools/node_modules/quickjs-emscripten-core/dist/index.mjs'
import variant from '../build-tools/node_modules/@jitl/quickjs-wasmfile-release-sync/dist/index.mjs'

const LIMITS = Object.freeze({sourceChars: 16_384, modules: 8, logEntries: 32,
  memoryBytes: 16 * 1024 * 1024, vmMs: 250, parentMs: 1_500})
const digest = source => createHash('sha256').update(source).digest('hex')
const fail = reason => ({ok: false, reason})

async function runAttempt(input) {
  const quickjs = await newQuickJSWASMModuleFromVariant(variant)
  const runtime = quickjs.newRuntime()
  runtime.setMemoryLimit(LIMITS.memoryBytes)
  runtime.setMaxStackSize(512 * 1024)
  const deadline = Date.now() + LIMITS.vmMs
  runtime.setInterruptHandler(() => Date.now() >= deadline)
  const context = runtime.newContext()
  const log = []
  const record = (kind, value) => {
    if (log.length >= LIMITS.logEntries) throw Error('log-limit')
    log.push({kind, value})
  }
  try {
    runtime.setModuleLoader(name => {
      record('import', name)
      const module = input.modules[name]
      if (!module || digest(module.source) !== module.sha256) throw Error('module-denied')
      return module.source
    }, (_base, name) => name)
    for (const [name, implementation] of Object.entries({
      initialize: value => record('initialize', context.dump(value)),
      writeState: value => record('write', context.dump(value)),
    })) {
      const handle = context.newFunction(name, implementation)
      context.setProp(context.global, name, handle)
      handle.dispose()
    }
    const code = `import {dialect} from ${JSON.stringify(input.candidate)}; globalThis.__result = dialect;`
    const result = context.evalCode(code, 'synthetic-entry.mjs', {type: 'module'})
    context.unwrapResult(result).dispose()
    const exported = context.getProp(context.global, '__result')
    const dialect = context.dump(exported)
    exported.dispose()
    return {ok: true, dialect, log}
  } catch (error) {
    return {ok: false, reason: /interrupted/i.test(String(error)) ? 'vm-timeout'
      : /memory|allocation/i.test(String(error)) ? 'memory-limit'
      : /log-limit/.test(String(error)) ? 'log-limit' : 'module-failure', log}
  } finally {
    context.dispose()
    runtime.dispose()
  }
}

if (!isMainThread) {
  runAttempt(workerData).then(value => parentPort.postMessage(value),
    () => parentPort.postMessage(fail('worker-error')))
}

async function isolatedAttempt(input) {
  const worker = new Worker(new URL(import.meta.url), {workerData: input,
    resourceLimits: {maxOldGenerationSizeMb: 64, stackSizeMb: 2}})
  try {
    return await new Promise(resolve => {
      let settled = false
      const finish = value => {if (settled) return; settled = true; clearTimeout(timer); resolve(value)}
      const timer = setTimeout(() => finish(fail('hard-timeout')), LIMITS.parentMs)
      worker.once('message', finish)
      worker.once('error', () => finish(fail('worker-error')))
      worker.once('exit', () => setImmediate(() => finish(fail('worker-exit'))))
    })
  } finally {await worker.terminate()}
}

export async function probeSyntheticLoad({candidates, modules}) {
  if (!Array.isArray(candidates) || !candidates.length || candidates.length > LIMITS.modules ||
      !modules || typeof modules !== 'object' || Array.isArray(modules)) return fail('invalid-input')
  const entries = Object.entries(modules)
  if (entries.length > LIMITS.modules || entries.some(([name, module]) =>
    !/^synthetic:[a-z0-9-]+$/.test(name) || typeof module?.source !== 'string' ||
    module.source.length > LIMITS.sourceChars || !/^[a-f0-9]{64}$/.test(module.sha256))) return fail('input-limit')
  if (candidates.some(name => typeof name !== 'string' || !/^synthetic:[a-z0-9-]+$/.test(name)))
    return fail('module-denied')
  const attempts = []
  for (const candidate of candidates) {
    const result = await isolatedAttempt({candidate, modules})
    attempts.push({candidate, ...result})
    if (result.ok) return {ok: true, winner: candidate, dialect: result.dialect, attempts}
    if (['hard-timeout', 'vm-timeout', 'memory-limit', 'log-limit', 'worker-error'].includes(result.reason))
      return {ok: false, reason: result.reason, attempts}
  }
  return {ok: false, reason: 'no-candidate-loaded', attempts}
}

export const SYNTHETIC_LOADER_LIMITS = LIMITS
export const syntheticModuleHash = digest
