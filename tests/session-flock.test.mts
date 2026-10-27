/** Focused real native lock dispatch; no Harness install, session data or model calls. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { open } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { createTestDirectory, cleanupTestDirectory } from '../src/operations/test-temp.mts'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const source = new URL('../compat/session-persistence-jsonl/src/flock.ts', import.meta.url)
const role = process.argv[2] === '--flock-case' ? process.argv[3] : undefined

async function childCase(mode: string): Promise<void> {
  // Resolve the actual locked build dependency without writing a node_modules
  // fixture or changing product APIs solely for test injection.
  const upstream = pathToFileURL(require.resolve('@deepseek-ai/node-addon-system/flock')).href
  const hooks = registerHooks({resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === '@deepseek-ai/node-addon-system/flock' ? upstream : specifier, context)
  }})
  try {
    const { tryLockExclusive } = await import(source.href)
    if (mode.startsWith('android-')) Object.defineProperty(process, 'platform', { value: 'android' })
    if (mode === 'android-missing') {
      delete process.env.NEXTTAVERN_FLOCK_ADDON
      await assert.rejects(tryLockExclusive(-1), /requires NEXTTAVERN_FLOCK_ADDON/)
    } else if (mode === 'android-bad-path') {
      process.env.NEXTTAVERN_FLOCK_ADDON = join(process.cwd(), 'missing-installed-flock.so')
      await assert.rejects(tryLockExclusive(-1), { code: 'ERR_DLOPEN_FAILED' })
    } else if (mode === 'desktop' || mode === 'android-real') {
      const first = await open(join(process.cwd(), 'session.lock'), 'w')
      const second = await open(join(process.cwd(), 'session.lock'), 'w')
      try {
        await tryLockExclusive(first.fd)
        await assert.rejects(tryLockExclusive(second.fd), (error: NodeJS.ErrnoException) => {
          assert.ok(error.code === 'EAGAIN' || error.code === 'EWOULDBLOCK')
          assert.equal(error.syscall, 'flock')
          assert.ok(Number(error.errno) > 0)
          return true
        })
        await first.close()
        await tryLockExclusive(second.fd)
      } finally {await first.close(); await second.close()}
    } else throw new Error(`Unknown flock test case ${mode}`)
    process.stdout.write(JSON.stringify({ mode, passed: true, actualAndroidEvidence: false }) + '\n')
  } finally {hooks.deregister()}
}

async function runCase(mode: string, addon?: string): Promise<void> {
  const directory = createTestDirectory('session-flock-')
  try {
    const env = { ...process.env, NEXTTAVERN_FLOCK_ADDON: addon ?? join(directory, 'unused-android-path.so') }
    const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(import.meta.url), '--flock-case', mode], {
      cwd: directory, env, timeout: 10_000,
    })
    assert.deepEqual(JSON.parse(stdout), { mode, passed: true, actualAndroidEvidence: false })
  } finally {cleanupTestDirectory(directory)}
}

if (role) await childCase(role)
else {
  test('Android dispatch reports a missing supervisor addon path without trying desktop loading', () => runCase('android-missing'))
  test('Android dispatch preserves a real dlopen failure for a bad installed addon path', () => runCase('android-bad-path'))
  test('desktop dispatch ignores Android env and retains real upstream exclusion and close release', {
    skip: process.platform !== 'linux' && process.platform !== 'darwin',
  }, () => runCase('desktop'))
  test('Android callback adapter preserves real native errno and descriptor-close release', {
    skip: process.platform !== 'linux' && process.platform !== 'darwin',
  }, async () => {
    const platform = process.platform
    const manifest = require.resolve(`@deepseek-ai/node-addon-system-${platform}-${process.arch}/package.json`)
    const report = platform === 'linux' ? process.report.getReport() as {header: {glibcVersionRuntime?: string}} : undefined
    const addon = join(dirname(manifest), 'bin', ...(platform === 'linux' ? [report!.header.glibcVersionRuntime ? 'glibc' : 'musl'] : []), 'system.node')
    await runCase('android-real', addon)
  })
}
