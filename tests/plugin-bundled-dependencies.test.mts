/** Real npm/pnpm packaging, with tiny metadata fixtures; never installs Harness. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {after, test} from 'node:test'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'

const pnpm = process.env.NEXTTAVERN_PNPM_CLI
const npm = process.env.NEXTTAVERN_NPM_CLI
if (!pnpm || !npm || !path.isAbsolute(pnpm) || !path.isAbsolute(npm)) {
  throw Error('Set NEXTTAVERN_PNPM_CLI and NEXTTAVERN_NPM_CLI to existing absolute JavaScript CLI paths')
}
const temp = createTestDirectory('bundled-dependencies-')
after(() => cleanupTestDirectory(temp))
const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const {parse: parseYaml} = require('yaml')
const write = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), {recursive: true})
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}
const pkg = (root: string, name: string, version: string, other: object = {}, code = 'export const owner = "fixture"') => {
  write(path.join(root, 'package.json'), {name, version, type: 'module', main: 'index.js', ...other})
  write(path.join(root, 'index.js'), code)
}
const userConfig = path.join(temp, 'empty.npmrc')
write(userConfig, '')
const environment = {...process.env, npm_config_userconfig: userConfig, npm_config_update_notifier: 'false',
  npm_config_cache: path.join(temp, 'npm-cache'), pnpm_config_pm_on_fail: 'ignore', CI: 'true'}
const cli = (entry: string, args: string[], cwd: string) => execFileSync(process.execPath, [entry, ...args],
  {cwd, env: environment, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe']})
const pack = (root: string, target: string) => {
  fs.mkdirSync(target, {recursive: true})
  const output = JSON.parse(cli(npm!, ['pack', '--json', '--offline', '--ignore-scripts', '--pack-destination', target], root))
  return {file: path.join(target, output[0].filename), members: output[0].files.map((item: any) => item.path) as string[]}
}
function setup(name: string) {
  const root = path.join(temp, name)
  const profile = path.join(root, 'profile')
  const host = path.join(root, 'host-peer')
  const original = path.join(root, 'user-anydoc')
  pkg(host, 'fixture-host-peer', '1.0.0', {}, 'export const singleton = {}')
  pkg(original, 'dsh-plugin-anydoc', '1.0.0', {}, 'export const owner = "user-original"')
  write(path.join(profile, 'package.json'), {name: 'fixture-profile', private: true, type: 'module',
    dependencies: {'fixture-host-peer': 'file:../host-peer', 'dsh-plugin-anydoc': 'file:../user-anydoc'}})
  const run = (...args: string[]) => cli(pnpm!, ['--config.offline=true', '--config.ignore-scripts=true', '--reporter=append-only',
    '--store-dir', path.join(root, 'store'), '--config.manage-package-manager-versions=false',
    '--config.auto-install-peers=false', '--config.strict-peer-dependencies=true',
    '--config.registry=http://127.0.0.1:9', ...args], profile)
  return {root, profile, run}
}
function product(root: string, version: string, kind: 'bundled' | 'relative-file') {
  const source = path.join(root, 'source-' + version)
  const member = kind === 'bundled' ? 'node_modules/dsh-nexttavern-anydoc' : 'vendor/anydoc'
  pkg(path.join(source, member), 'dsh-nexttavern-anydoc', version, {peerDependencies: {'fixture-host-peer': '1.0.0'}},
    `export {singleton} from 'fixture-host-peer'; export const owner = ${JSON.stringify(version)}`)
  pkg(source, 'dsh-nexttavern', version, {
    dependencies: {'dsh-nexttavern-anydoc': kind === 'bundled' ? version : 'file:vendor/anydoc'},
    ...(kind === 'bundled' ? {bundleDependencies: ['dsh-nexttavern-anydoc']} : {}),
  }, 'export {singleton, owner} from "dsh-nexttavern-anydoc"')
  return pack(source, path.join(root, 'tarballs'))
}
const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

test('a published tarball cannot treat relative file dependencies as bundled directories', () => {
  const fixture = setup('relative-file')
  const artifact = product(fixture.root, '0.0.0-fixture.1', 'relative-file')
  assert.throws(() => fixture.run('add', artifact.file), (error: any) => {
    assert.match(error.stdout.toString(), /ERR_PNPM_LINKED_PKG_DIR_NOT_FOUND/)
    assert.ok(error.stdout.toString().includes(path.join(fixture.profile, 'vendor', 'anydoc')))
    return true
  })
})

test('bundled private plugins survive unrelated installs, reinstalls, explicit downgrade and root removal', () => {
  const fixture = setup('bundled')
  const v1 = product(fixture.root, '0.0.0-fixture.1', 'bundled')
  const v2 = product(fixture.root, '0.0.0-fixture.2', 'bundled')
  assert.ok(v1.members.includes('node_modules/dsh-nexttavern-anydoc/index.js'))
  fixture.run('add', v1.file)
  // Each observation runs in a new process so module caches cannot conceal
  // a dependency overwrite or a changed package-manager resolution.
  write(path.join(fixture.profile, 'observe.mjs'), [
    'import {createRequire} from "node:module";',
    'import {pathToFileURL} from "node:url";',
    'import fs from "node:fs";',
    'const require = createRequire(import.meta.url);',
    'const root = require.resolve("dsh-nexttavern");',
    'const owned = createRequire(root).resolve("dsh-nexttavern-anydoc");',
    'const load = file => import(pathToFileURL(file).href);',
    'const [product, peer, original] = await Promise.all([load(root), load(require.resolve("fixture-host-peer")),',
    '  load(require.resolve("dsh-plugin-anydoc"))]);',
    'console.log(JSON.stringify({root, owned, rootReal: fs.realpathSync(root), ownedReal: fs.realpathSync(owned),',
    '  owner: product.owner, original: original.owner, peerShared: product.singleton === peer.singleton,',
    '  peerPath: createRequire(owned).resolve("fixture-host-peer"), hostPath: require.resolve("fixture-host-peer")}));',
  ].join('\n'))
  const observe = () => {
    const result = JSON.parse(cli(path.join(fixture.profile, 'observe.mjs'), [], fixture.profile))
    assert.equal(result.peerShared, true)
    assert.equal(result.peerPath, result.hostPath)
    assert.equal(result.original, 'user-original')
    const directory = path.dirname(result.ownedReal)
    return {...result, files: Object.fromEntries(['index.js', 'package.json'].map(file => [file, hash(path.join(directory, file))]))}
  }
  const baseline = observe()
  assert.equal(baseline.owner, '0.0.0-fixture.1')
  const skin = path.join(fixture.root, 'skin')
  pkg(skin, 'fixture-unrelated-skin', '1.0.0')
  const skin1 = pack(skin, path.join(fixture.root, 'tarballs'))
  fixture.run('add', skin1.file)
  assert.deepEqual(observe(), baseline)
  pkg(skin, 'fixture-unrelated-skin', '2.0.0')
  const skin2 = pack(skin, path.join(fixture.root, 'tarballs'))
  fixture.run('add', skin2.file)
  assert.deepEqual(observe(), baseline)
  fixture.run('install', '--force')
  assert.deepEqual(observe(), baseline, 'even a forced package-manager relink preserves the bundled implementation')
  fixture.run('add', v2.file)
  const upgraded = observe()
  assert.equal(upgraded.owner, '0.0.0-fixture.2')
  assert.notDeepEqual(upgraded.files, baseline.files)
  fixture.run('add', v1.file)
  assert.deepEqual(observe(), baseline, 'explicit downgrade recovers the exact previous payload and resolution')
  fixture.run('remove', 'dsh-nexttavern')
  const restored = JSON.parse(fs.readFileSync(path.join(fixture.profile, 'package.json'), 'utf8'))
  assert.equal(restored.dependencies['dsh-nexttavern'], undefined)
  assert.equal(restored.dependencies['dsh-plugin-anydoc'], 'file:../user-anydoc')
  assert.ok(fs.existsSync(path.join(fixture.profile, 'node_modules/dsh-plugin-anydoc/index.js')))
})

test('external fixed-package references survive pnpm relinking without reverting to a registry package', () => {
  const fixture = setup('fixed-directory')
  const stable = path.join(fixture.root, 'fixed-packages', 'dsh-nexttavern-anydoc')
  pkg(stable, 'dsh-nexttavern-anydoc', '0.0.0-fixture.1', {peerDependencies: {'fixture-host-peer': '1.0.0'}},
    'export {singleton} from "fixture-host-peer"; export const owner = "fixed-compatibility"')
  const profileFile = path.join(fixture.profile, 'package.json')
  const metadata = JSON.parse(fs.readFileSync(profileFile, 'utf8'))
  const specification = 'file:../fixed-packages/dsh-nexttavern-anydoc'
  metadata.dependencies['dsh-nexttavern-anydoc'] = specification
  write(profileFile, metadata)
  fixture.run('install', '--no-frozen-lockfile')
  const sourceHashes = Object.fromEntries(['package.json', 'index.js'].map(file => [file, hash(path.join(stable, file))]))
  write(path.join(fixture.profile, 'fixed-observe.mjs'), [
    'import {createRequire} from "node:module";',
    'import {pathToFileURL} from "node:url";',
    'import fs from "node:fs";',
    'const require = createRequire(import.meta.url);',
    'const entry = require.resolve("dsh-nexttavern-anydoc");',
    'const host = require.resolve("fixture-host-peer");',
    'const childHost = createRequire(entry).resolve("fixture-host-peer");',
    'const plugin = await import(pathToFileURL(entry).href);',
    'const peer = await import(pathToFileURL(host).href);',
    'console.log(JSON.stringify({entry: fs.realpathSync(entry), host, childHost,',
    '  owner: plugin.owner, samePeer: plugin.singleton === peer.singleton}));',
  ].join('\n'))
  const observe = () => {
    const result = JSON.parse(cli(path.join(fixture.profile, 'fixed-observe.mjs'), [], fixture.profile))
    assert.equal(result.owner, 'fixed-compatibility')
    assert.equal(result.samePeer, true)
    assert.equal(result.host, result.childHost)
    const installedHashes = Object.fromEntries(['package.json', 'index.js'].map(file =>
      [file, hash(path.join(path.dirname(result.entry), file))]))
    assert.deepEqual(installedHashes, sourceHashes)
    assert.deepEqual(Object.fromEntries(Object.keys(sourceHashes).map(file => [file, hash(path.join(stable, file))])), sourceHashes)
    assert.equal(JSON.parse(fs.readFileSync(profileFile, 'utf8')).dependencies['dsh-nexttavern-anydoc'], specification)
    const lock = parseYaml(fs.readFileSync(path.join(fixture.profile, 'pnpm-lock.yaml'), 'utf8'))
    const binding = lock.importers['.'].dependencies['dsh-nexttavern-anydoc']
    assert.equal(binding.specifier, specification)
    assert.ok(binding.version.startsWith(specification))
    const lockedPackages = Object.entries(lock.packages).filter(([name]) => name.startsWith('dsh-nexttavern-anydoc@'))
    assert.equal(lockedPackages.length, 1)
    const resolution = (lockedPackages[0]![1] as any).resolution
    assert.equal(resolution.type, 'directory')
    assert.equal(resolution.directory, '../fixed-packages/dsh-nexttavern-anydoc')
    assert.equal(resolution.tarball, undefined, 'no registry tarball replaces the protected directory')
    return result
  }
  const baseline = observe()
  const skin = path.join(fixture.root, 'unrelated')
  pkg(skin, 'fixture-unrelated-skin', '1.0.0')
  fixture.run('add', pack(skin, path.join(fixture.root, 'tarballs')).file)
  assert.deepEqual(observe(), baseline)
  pkg(skin, 'fixture-unrelated-skin', '2.0.0')
  fixture.run('add', pack(skin, path.join(fixture.root, 'tarballs')).file)
  fixture.run('install', '--force')
  assert.deepEqual(observe(), baseline)
})
