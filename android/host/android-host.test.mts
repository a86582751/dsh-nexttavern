/** Mock contexts exercise the real pinned app-boot audit, never start a Host. */
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { PassThrough } from 'node:stream'
import { existsSync } from 'node:fs'
import { createRequire, registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { AndroidHostContext } from './android-host.mts'

const maintenanceTools = new URL('../../runtime/alpha3/build-tools/package.json', import.meta.url)
const require = createRequire(existsSync(maintenanceTools) ? maintenanceTools : new URL('../../build-tools/package.json', import.meta.url))
const appBoot = pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')).href
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === '@deepseek-ai/dsh-app-boot' ? appBoot : specifier, context)
} })
const { apply, PROTOCOL } = await import('./android-host.mts')
hooks.deregister()

const tick = () => new Promise<void>(resolve => setImmediate(resolve))

type RecordLine = { protocol: string; generation: string; pid: number; event: string; [key: string]: unknown }

async function fixture(run: (f: {
  ctx: AndroidHostContext; input: PassThrough; records: RecordLine[];
  loader: ReturnType<typeof Promise.withResolvers<void>>;
  product: ReturnType<typeof Promise.withResolvers<void>>;
  disposal: ReturnType<typeof Promise.withResolvers<void>>;
  cleanups: (() => void)[]; consoleLines: unknown[][];
  disposeCalls(): number; authCalls(): number;
}) => Promise<void>): Promise<void> {
  const input = new PassThrough()
  const stdin = Object.getOwnPropertyDescriptor(process, 'stdin')!
  const generation = process.env.NEXTTAVERN_GENERATION
  const records: RecordLine[] = []
  const consoleLines: unknown[][] = []
  const originalWrite = process.stdout.write.bind(process.stdout)
  const output = mock.method(process.stdout, 'write', ((chunk: unknown, ...args: unknown[]) => {
    if (typeof chunk === 'string' && chunk.startsWith('{"protocol":"nexttavern-mobile-v1"')) {
      records.push(JSON.parse(chunk)); return true
    }
    return (originalWrite as (...args: unknown[]) => boolean)(chunk, ...args)
  }) as typeof process.stdout.write)
  const logs = ['log', 'warn', 'error'].map(method => mock.method(console, method as 'log', (...args: unknown[]) => {
    consoleLines.push(args)
  }))
  const loader = Promise.withResolvers<void>()
  const product = Promise.withResolvers<void>()
  const disposal = Promise.withResolvers<void>()
  const cleanups: (() => void)[] = []
  let disposeCalls = 0
  let authCalls = 0
  const root = {
    loader: { entries: () => [] },
    fiber: { dispose: async () => {
      disposeCalls++
      for (const cleanup of cleanups) cleanup()
      await disposal.promise
    } },
  } as unknown as Context
  const ctx: AndroidHostContext = {
    root,
    webServer: { port: 41327 },
    connection: { authenticatedUrl(baseUrl) { authCalls++; return `${baseUrl}/?token=private-test-token` } },
    get(name: 'loader' | 'tavernConversations') {
      return name === 'loader' ? { await: () => loader.promise } : { ready: product.promise, stopOwnedWork: async () => {} }
    },
    effect(work) { cleanups.push(work()) },
  } as AndroidHostContext
  Object.defineProperty(process, 'stdin', { configurable: true, value: input })
  process.env.NEXTTAVERN_GENERATION = 'current-generation'
  try {
    await run({ ctx, input, records, loader, product, disposal, cleanups, consoleLines,
      disposeCalls: () => disposeCalls, authCalls: () => authCalls })
  } finally {
    for (const cleanup of cleanups) cleanup()
    disposal.resolve()
    input.destroy()
    Object.defineProperty(process, 'stdin', stdin)
    if (generation === undefined) delete process.env.NEXTTAVERN_GENERATION
    else process.env.NEXTTAVERN_GENERATION = generation
    output.mock.restore()
    for (const log of logs) log.mock.restore()
  }
}

test('activation is nonblocking; READY waits for actual product readiness and uses official auth privately', async () => fixture(async f => {
  assert.equal(apply(f.ctx), undefined)
  assert.equal(f.records.length, 0)
  f.loader.resolve()
  await tick()
  assert.equal(f.records.length, 0)
  assert.equal(f.authCalls(), 0)
  f.product.resolve()
  await tick()
  assert.deepEqual(f.records, [{ protocol: PROTOCOL, generation: 'current-generation', pid: process.pid,
    event: 'READY', url: 'http://127.0.0.1:41327/?token=private-test-token', hostVersion: '0.1.7-rc.2' }])
  assert.equal(f.consoleLines.length, 0)
}))

test('product readiness rejection emits only safe startup failure, never READY or token-bearing logs', async () => fixture(async f => {
  apply(f.ctx)
  f.loader.resolve()
  await tick()
  f.product.reject(new Error('failure http://127.0.0.1/?token=private-test-token'))
  await tick()
  assert.equal(f.records.length, 1)
  assert.equal(f.records[0]!.event, 'ERROR')
  assert.equal(f.records[0]!.code, 'HOST_STARTUP_FAILED')
  assert.equal(f.authCalls(), 0)
  assert.equal(JSON.stringify(f.records).includes('private-test-token'), false)
  assert.equal(f.consoleLines.length, 0)
}))

test('missing product service cannot be replaced by a clean Host audit', async () => fixture(async f => {
  f.ctx.get = ((name: string) => name === 'loader' ? { await: () => f.loader.promise } : undefined) as AndroidHostContext['get']
  apply(f.ctx)
  f.loader.resolve()
  await tick()
  assert.equal(f.records[0]!.event, 'ERROR')
  assert.equal(f.authCalls(), 0)
}))

test('only current-generation stop disposes once and STOPPED follows awaited cleanup', async () => fixture(async f => {
  apply(f.ctx)
  for (const message of [
    '{invalid',
    JSON.stringify({ protocol: PROTOCOL, generation: 'old-generation', command: 'stop' }),
    JSON.stringify({ protocol: 'other', generation: 'current-generation', command: 'stop' }),
  ]) f.input.write(message + '\n')
  await tick()
  assert.equal(f.disposeCalls(), 0)
  const stop = JSON.stringify({ protocol: PROTOCOL, generation: 'current-generation', command: 'stop' })
  f.input.write(stop + '\n' + stop + '\n')
  await tick()
  assert.equal(f.disposeCalls(), 1)
  assert.equal(f.records.length, 0)
  assert.equal(f.input.listenerCount('data'), 0)
  f.disposal.resolve()
  await tick()
  assert.deepEqual(f.records, [{ protocol: PROTOCOL, generation: 'current-generation', pid: process.pid,
    event: 'STOPPED', completion: 'interrupted', drained: false }])
  f.loader.resolve()
  f.product.resolve()
  await tick()
  assert.equal(f.records.length, 1)
}))

test('plugin disposal removes stdin listener and suppresses late READY', async () => fixture(async f => {
  apply(f.ctx)
  for (const cleanup of f.cleanups) cleanup()
  assert.equal(f.input.listenerCount('data'), 0)
  f.loader.resolve()
  f.product.resolve()
  await tick()
  assert.equal(f.records.length, 0)
}))

test('a rejected root cleanup cannot produce STOPPED', async () => fixture(async f => {
  apply(f.ctx)
  f.input.write(JSON.stringify({ protocol: PROTOCOL, generation: 'current-generation', command: 'stop' }) + '\n')
  f.disposal.reject(new Error('failure token=private-test-token'))
  await tick()
  assert.equal(f.records.length, 1)
  assert.equal(f.records[0]!.event, 'ERROR')
  assert.equal(f.records[0]!.phase, 'stop')
  assert.equal(JSON.stringify(f.records).includes('private-test-token'), false)
  assert.equal(f.consoleLines.length, 0)
}))

test('product-owned work settles before any root storage-provider teardown', async () => fixture(async f => {
  const stopped = Promise.withResolvers<void>()
  const originalGet = f.ctx.get.bind(f.ctx)
  f.ctx.get = ((name: string) => name === 'tavernConversations'
    ? { ready: f.product.promise, stopOwnedWork: () => stopped.promise }
    : originalGet(name as 'loader')) as AndroidHostContext['get']
  apply(f.ctx)
  f.input.write(JSON.stringify({ protocol: PROTOCOL, generation: 'current-generation', command: 'stop' }) + '\n')
  await tick()
  assert.equal(f.disposeCalls(), 0)
  stopped.resolve()
  await tick()
  assert.equal(f.disposeCalls(), 1)
  assert.equal(f.records.length, 0)
  f.disposal.resolve()
  await tick()
  assert.equal(f.records[0]!.event, 'STOPPED')
}))
