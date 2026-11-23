/** Mock contexts exercise the real pinned app-boot audit, never start a Host. */
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { PassThrough } from 'node:stream'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile, symlink, link, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
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
const { apply, PROTOCOL, runWorkspaceCommand } = await import('./android-host.mts')
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
    tools: { register(definition) { assert.equal(definition.name, 'workspace_command') } },
    workingDirectory: { async ensure() { return process.cwd() } },
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
    event: 'READY', url: 'http://127.0.0.1:41327/?token=private-test-token', hostVersion: '0.2.2-rc.5' }])
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

test('workspace commands read bounded scope without shell, links or private paths', {
  skip: process.platform !== 'linux' && process.platform !== 'android' && 'fd anchors require Linux/Android',
}, async () => {
  const area = await mkdtemp(path.join(tmpdir(), 'nexttavern-command-'))
  const root = path.join(area, 'workspace'), selected = path.join(root, 'selected')
  const work = (args: Parameters<typeof runWorkspaceCommand>[2], cwd = selected, signal = new AbortController().signal) =>
    runWorkspaceCommand(root, cwd, args, signal)
  try {
    await mkdir(selected, {recursive: true})
    await mkdir(path.join(selected, 'nested'))
    await mkdir(path.join(root, 'sibling'))
    await writeFile(path.join(root, 'sibling', 'other.txt'), 'needle')
    await writeFile(path.join(area, 'hidden-outside.txt'), 'outside needle')
    await writeFile(path.join(selected, 'file.txt'), 'line 1\nneedle\nneedle suffix\n')
    await writeFile(path.join(selected, 'nested', 'document.txt'), 'real needle')
    await writeFile(path.join(selected, '.settings'), 'hidden needle')
    await writeFile(path.join(selected, 'binary.dat'), 'needle\0')
    await symlink(path.join(root, 'sibling'), path.join(selected, 'symlink-dir'))
    await symlink(path.join(area, 'hidden-outside.txt'), path.join(selected, 'symlink-file'))
    await link(path.join(area, 'hidden-outside.txt'), path.join(selected, 'hardlink.txt'))
    assert.deepEqual(await work({operation: 'pwd'}), {directory: 'selected', entries: [], truncated: false})
    const names = (result: Awaited<ReturnType<typeof work>>) => result.entries.map(entry => entry.path).sort()
    assert.deepEqual(names(await work({operation:'list'})), ['binary.dat','file.txt','hardlink.txt','nested'])
    assert.deepEqual(names(await work({operation:'find',query:'document'})), ['nested/document.txt'])
    const found = await work({operation:'search',query:'needle'})
    assert.deepEqual(found.entries.sort((a,b)=>a.path.localeCompare(b.path)), [
      {path:'file.txt',kind:'file',lines:[2,3]}, {path:'nested/document.txt',kind:'file',lines:[1]},
    ])
    assert.equal(found.truncated, false)
    assert.deepEqual(names(await work({operation:'list',path:'nested'})), ['document.txt'])
    for (const unsafe of ['../sibling','/etc','nested/..','.settings','symlink-dir']) {
      await assert.rejects(work({operation:'list',path:unsafe}), /relative path|unavailable/)
    }
    await assert.rejects(work({operation:'list'},area), /relative path/)
    await assert.rejects(work({operation:'list'},path.join(selected,'symlink-dir')), /unavailable/)
    await assert.rejects(work({operation:'search',query:''}), /non-empty/)
    await assert.rejects(work({operation:'echo' as 'pwd'}), /Unsupported/)
    const cancelled = new AbortController()
    cancelled.abort(new Error('caller cancelled'))
    await assert.rejects(work({operation:'list'}, selected, cancelled.signal), /caller cancelled/)
    for (let i = 0; i < 105; i++) await writeFile(path.join(selected, 'bounded-' + i), '')
    const capped = await work({operation:'list'})
    assert.equal(capped.entries.length, 100)
    assert.equal(capped.truncated, true)
  } finally { await rm(area, {recursive: true, force: true}) }
})
