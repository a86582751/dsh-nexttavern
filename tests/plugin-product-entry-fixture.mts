/** Real alpha.6 Include and product entry; tiny providers, never a Harness install. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const load = (name: string) => import(pathToFileURL(require.resolve(name)).href)
const {Context} = await load('@deepseek-ai/cordis')
const {default: Loader} = await load('@deepseek-ai/cordis-plugin-loader')
const {ClientModuleRegistry} = await load('@deepseek-ai/dsh-client-modules')
const api = await load('@deepseek-ai/dsh-app-boot')

export function causedBy(expected: string) {
  const visit = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false
    return error.message.includes(expected) || visit(error.cause)
      || (error instanceof AggregateError && error.errors.some(visit))
  }
  return visit
}

export async function nativeCase(title: string, testUrl: string) {
  if (process.execArgv.includes('--expose-internals')) return false
  const env = {...process.env}
  delete env.NODE_TEST_CONTEXT
  const {stdout} = await promisify(execFile)(process.execPath, [
    '--expose-internals', '--test', '--test-reporter=tap', '--test-name-pattern=^' + title,
    fileURLToPath(testUrl),
  ], {env, timeout: 25000, maxBuffer: 1024 * 1024})
  assert.match(stdout, /^# pass 1$/m)
  return true
}

interface FixtureOptions {
  disabled?: boolean; fail?: boolean; slowRelease?: boolean; failingAddon?: boolean; missingOwned?: boolean
  prepareProvider?: (productRoot: string, profileRoot: string) => Promise<{
    original: string; replacement: string; config: object; initialize(ctx: any): Promise<void>
  }>
}

export async function fixture(options: FixtureOptions = {}) {
  const root = createTestDirectory('product-entry-')
  try {return await prepareFixture(root, options)}
  catch (error) {
    if (fs.existsSync(root)) cleanupTestDirectory(root)
    throw error
  }
}

async function prepareFixture(root: string, options: FixtureOptions) {
  const home = path.join(root, 'home'), dir = path.join(home, 'profiles/web')
  const installAnchor = path.join(root, 'installation/package.json')
  const write = (file: string, value: unknown) => {
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)+'\n')
  }
  const productDir = path.join(dir, 'node_modules/dsh-nexttavern')
  write(path.join(productDir, 'package.json'), {name: 'dsh-nexttavern', version: '0.0.0-fixture',
    type: 'module', exports: {'.': './lib/operations/nexttavern-entry.mjs',
      './entry-policy': './lib/operations/nexttavern-entry-policy.mjs'},
    dsh: {bundle: {patch: './patch.json'}}})
  const modules = [
    ['nexttavern-entry', new URL('../lib/operations/nexttavern-entry.mjs', import.meta.url)],
    ['nexttavern-entry-policy', new URL('../lib/operations/nexttavern-entry-policy.mjs', import.meta.url)],
    ['nexttavern-profile-plan', new URL('../lib/operations/nexttavern-profile-plan.mjs', import.meta.url)],
    ['nexttavern-lifecycle', new URL('../lib/operations/nexttavern-lifecycle.mjs', import.meta.url)],
  ] as const
  for (const [name, source] of modules) {
    write(path.join(productDir, 'lib/operations', name+'.mjs'),
      fs.readFileSync(source, 'utf8'))
  }
  // Reuse one actual peer graph. Do not install/copy a Harness into a test fixture.
  const peers = path.join(productDir, 'node_modules/@deepseek-ai')
  fs.mkdirSync(path.dirname(peers), {recursive:true})
  fs.symlinkSync(path.resolve(fileURLToPath(new URL('../build-tools/node_modules/@deepseek-ai', import.meta.url))),
    peers, process.platform === 'win32' ? 'junction' : 'dir')
  fs.symlinkSync(path.resolve(fileURLToPath(new URL('../build-tools/node_modules/@deepseek-ai', import.meta.url))),
    path.join(dir,'node_modules/@deepseek-ai'), process.platform === 'win32' ? 'junction' : 'dir')
  const policy = await import(pathToFileURL(path.join(productDir, 'lib/operations/nexttavern-entry-policy.mjs')).href)
  const custom = await options.prepareProvider?.(productDir, dir)
  const active = new Map<string, string>()
  const changes: string[] = []
  const releaseEntered = Promise.withResolvers<void>()
  const releaseGate = Promise.withResolvers<void>()
  const ownedReady = Promise.withResolvers<void>()
  const packages: string[] = []
  if (custom) packages.push(fileURLToPath(custom.original))
  function provider(name: string, owner: string) {
    const pkg = path.join(owner === 'owned' && !options.missingOwned ? productDir : dir, 'node_modules', name)
    const host = path.join(pkg, 'index.mjs')
    const client = path.join(pkg, 'client.js')
    const metadata = path.join(pkg, 'package.json')
    write(metadata, {name, type: 'module', version: '0.0.0-fixture',
      exports: {'.': './index.mjs', './client': './client.js'},
      dsh: {client: {platform: 'web', inject: []}}})
    write(host, `export default function(ctx,config) {
      if (${JSON.stringify(owner)} === 'owned' && (ctx.productProbe.fail || config.value === 'reject')) throw Error('owned provider failed');
      ctx.effect(() => ctx.productProbe.acquire(${JSON.stringify(owner)}, config));
      ctx.provide(config.service, {owner:${JSON.stringify(owner)}, value:config.value});
    }`)
    write(client, `window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory:()=>({})});`)
    packages.push(metadata, host, client)
    return pathToFileURL(host).href
  }
  const original = custom?.original ?? provider('fixture-official-provider', 'official')
  if (!custom) provider('fixture-owned-provider', 'owned')
  const replacement = custom?.replacement ?? 'fixture-owned-provider'
  const addon = path.join(productDir, 'failing-addon.mjs')
  write(addon, 'export default async function(ctx) {await ctx.productProbe.ownedReady; throw Error("addon failed") }')
  write(installAnchor, {private: true})
  const manifest = path.join(dir, 'package.json')
  write(manifest, {private: true, dsh: {profile: {bundles: ['fixture-base','dsh-nexttavern']}}})
  write(path.join(dir, 'node_modules/fixture-base/package.json'), {name: 'fixture-base',
    dsh: {bundle: {patch: './patch.json'}}})
  write(path.join(dir, 'node_modules/fixture-base/patch.json'), [{insert: [
    {id: 'meter', name: original, disabled: options.disabled ?? false,
      config: custom?.config ?? {service: 'entryProbe', value: 'original'}},
  ]}])
  write(path.join(productDir, 'patch.json'), [
    {id: 'meter', name: original, disabled: {__jsExpr: policy.providerDisabledExpression}},
    {insert: [{id: 'nexttavern', name: pathToFileURL(path.join(productDir, 'lib/operations/nexttavern-entry.mjs')).href,
      config: {providers: [{id: 'meter', original, replacement}],
        addons: options.failingAddon ? [{id:'addon',name:pathToFileURL(addon).href}] : []}}]},
  ])
  const patchPath = path.join(dir, 'cordis.patch.yml')
  write(patchPath, [])
  const configFile = path.join(dir, 'cordis.json')
  write(configFile, [])
  const context = {name: 'web', dir, home, installAnchor, cwd: root, patchPath,
    startedBundles: ['fixture-base','dsh-nexttavern'], overlays: [], telemetryDisabledEnv: undefined}
  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(dir+path.sep).href
  ctx.provide('profileContext', context)
  ctx.provide('productProbe', {fail: options.fail, ownedReady: ownedReady.promise,
    acquire(owner: string, config: {service: string}) {
    assert.equal(active.has(config.service), false, 'duplicate provider')
    active.set(config.service, owner)
    changes.push('start:'+owner)
    if (owner === 'owned') ownedReady.resolve()
    return async () => {
      if (owner === 'owned' && options.slowRelease) {
        releaseEntered.resolve()
        await releaseGate.promise
      }
      active.delete(config.service)
      changes.push('stop:'+owner)
    }
  }})
  const before = packages.map(file => fs.readFileSync(file,'utf8'))
  const close = async () => {
    releaseGate.resolve()
    try {
      await ctx.get('loader')?.root.stop()
      await ctx.fiber.dispose()
      assert.equal(active.size, 0)
      assert.deepEqual(packages.map(file=>fs.readFileSync(file,'utf8')), before)
    } finally {cleanupTestDirectory(root)}
  }
  try {
    await ctx.plugin(Loader)
    await custom?.initialize(ctx)
    ctx.provide('webServer', {register: () => () => {}})
    await api.mountRootInclude(ctx, configFile, api.readProfilePatches('fixture', context))
    await ctx.plugin(ClientModuleRegistry)
    return {ctx, active, changes, original, before, releaseEntered, releaseGate,
      graph: () => ctx.clientModules.graph().entries.map((entry: {id: string}) => entry.id),
      async update(patches: unknown[], selected = true) {
        write(manifest, {private: true, dsh: {profile: {bundles: ['fixture-base', ...(selected ? ['dsh-nexttavern'] : [])]}}})
        write(patchPath, patches)
        await api.reconcileProfilePatches(ctx, api.readProfilePatches('fixture', context))
      }, close}
  } catch (error) {await close(); throw error}
}
