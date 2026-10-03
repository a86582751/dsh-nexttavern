/** Real npm/pnpm packaging, with tiny metadata fixtures; never installs Harness. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {after, test} from 'node:test'
import {fileURLToPath} from 'node:url'
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
function setup(name: string, protectedProfile = false) {
  const root = path.join(temp, name)
  const profile = path.join(root, protectedProfile ? 'home/profiles/web' : 'profile')
  const host = path.join(root, 'host-peer')
  const original = path.join(root, 'user-anydoc')
  pkg(host, '@deepseek-ai/fixture-host-peer', '1.0.0', {}, 'export const singleton = {}')
  pkg(original, 'dsh-plugin-anydoc', '1.0.0', {}, 'export const owner = "user-original"')
  write(path.join(profile, 'package.json'), {name: 'fixture-profile', private: true, type: 'module',
    dependencies: {'@deepseek-ai/fixture-host-peer': 'file:' + path.relative(profile, host).replaceAll('\\', '/'),
      'dsh-plugin-anydoc': 'file:' + path.relative(profile, original).replaceAll('\\', '/'),
      // Reuse the installed host helper and its own peer tree; do not construct
      // another framework installation in this small package fixture.
      ...(protectedProfile ? {'@deepseek-ai/dsh-atomic-write': 'link:' + path.relative(profile,
        path.dirname(require.resolve('@deepseek-ai/dsh-atomic-write/package.json'))).replaceAll('\\', '/')} : {}),
    }})
  const run = (...args: string[]) => cli(pnpm!, ['--config.offline=true', '--config.ignore-scripts=true', '--reporter=append-only',
    '--store-dir', path.join(root, 'store'), '--config.manage-package-manager-versions=false',
    '--config.auto-install-peers=false', '--config.strict-peer-dependencies=true',
    '--config.registry=http://127.0.0.1:9', ...args], profile)
  return {root, profile, run}
}
function product(root: string, version: string, kind: 'bundled' | 'relative-file', bootstrap = false) {
  const source = path.join(root, 'source-' + version)
  const member = kind === 'bundled' ? 'node_modules/dsh-nexttavern-anydoc' : 'vendor/anydoc'
  pkg(path.join(source, member), 'dsh-nexttavern-anydoc', version, {peerDependencies: {'@deepseek-ai/fixture-host-peer': '1.0.0'}},
    `export {singleton} from '@deepseek-ai/fixture-host-peer'; export const owner = ${JSON.stringify(version)}`)
  pkg(source, 'dsh-nexttavern', version, {
    dependencies: {'dsh-nexttavern-anydoc': kind === 'bundled' ? version : 'file:vendor/anydoc'},
    ...(kind === 'bundled' ? {bundleDependencies: ['dsh-nexttavern-anydoc']} : {}),
    // The host package manager this fixture reuses states its own version; a
    // stale pin here fails the strict peer check instead of exercising bootstrap.
    ...(bootstrap ? {peerDependencies: {'@deepseek-ai/dsh-atomic-write':
      JSON.parse(fs.readFileSync(require.resolve('@deepseek-ai/dsh-atomic-write/package.json'), 'utf8')).version}} : {}),
  }, 'export {singleton, owner} from "dsh-nexttavern-anydoc"')
  if (bootstrap) {
    require('esbuild').buildSync({
      entryPoints: [fileURLToPath(new URL('../src/operations/bundled-package-bootstrap.mts', import.meta.url))],
      outfile: path.join(source, 'bootstrap.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
      external: ['@deepseek-ai/dsh-atomic-write'],
    })
    write(path.join(source, 'nexttavern.dependencies.json'), {schemaVersion: 1, productVersion: version, packages: [{
      name: 'dsh-nexttavern-anydoc', version,
      files: ['package.json', 'index.js'].map(file => ({path: file, sha256: hash(path.join(source, member, file))})),
    }]})
    write(path.join(source, 'index.js'), [
      'import {bootstrapBundledPackages} from "./bootstrap.mjs";',
      'import {fileURLToPath} from "node:url";',
      'export function bootstrap(options) {return bootstrapBundledPackages({...options,',
      'productRoot:fileURLToPath(new URL(".", import.meta.url))})}',
    ].join('\n'))
  }
  return pack(source, path.join(root, 'tarballs'))
}

test('prebuilt SDK runtime imports survive a fresh pnpm profile with no build approvals', () => {
  const root = path.join(temp, 'sdk-build-policy')
  const metadata = JSON.parse(fs.readFileSync(new URL('../product/package.json', import.meta.url), 'utf8'))
  const profile = path.join(root, 'profile')
  const source = path.join(root, 'source')
  const tarballs = path.join(root, 'tarballs')
  const proto = path.join(root, 'sdk', 'protobufjs')
  const leaf = path.join(root, 'sdk', 'leaf')
  const genai = path.join(root, 'sdk', 'genai')
  const ordinary = path.join(root, 'sdk', 'ordinary')
  const protoVersion = metadata.dependencies.protobufjs ?? '7.6.6'
  pkg(leaf, 'fixture-protobuf-runtime', '1.0.0', {}, 'export const encode = value => Buffer.from(value).toString("hex")')
  const leafArchive = pack(leaf, tarballs).file
  pkg(proto, 'protobufjs', protoVersion, {scripts: {postinstall: 'node postinstall.cjs'},
    dependencies: {'fixture-protobuf-runtime': 'file:' + leafArchive}}, 'export {encode} from "fixture-protobuf-runtime"')
  write(path.join(proto, 'postinstall.cjs'), 'throw Error("prebuilt SDK must not execute install scripts")')
  const protoArchive = pack(proto, tarballs).file
  pkg(genai, '@google/genai', metadata.dependencies['@google/genai'], {
    scripts: {preinstall: 'node preinstall.cjs'}, dependencies: {protobufjs: 'file:' + protoArchive},
  }, 'export {encode} from "protobufjs"')
  write(path.join(genai, 'preinstall.cjs'), 'throw Error("prebuilt SDK must not execute install scripts")')
  const genaiArchive = pack(genai, tarballs).file
  pkg(ordinary, 'fixture-ordinary-sdk', '1.0.0', {}, 'export const label = "ordinary"')
  const ordinaryArchive = pack(ordinary, tarballs).file
  const ownedBundles=JSON.parse(fs.readFileSync(new URL('../development/pi-ai/package.json',import.meta.url),'utf8')).bundleDependencies??[]
  const owned=path.join(source,'node_modules/dsh-nexttavern-pi-ai')
  pkg(owned, 'dsh-nexttavern-pi-ai', '1.0.0',
    {dependencies: {'@google/genai': metadata.dependencies['@google/genai']},bundleDependencies:ownedBundles.filter((name:string)=>name==='@google/genai')},
    'export {encode} from "@google/genai"')
  // Existing owned SDKs have their direct library, but not the hoisted closure.
  fs.cpSync(genai, path.join(source, 'node_modules/dsh-nexttavern-pi-ai/node_modules/@google/genai'), {recursive: true})
  const sdkBundles = ['@google/genai', 'protobufjs'].filter(name => metadata.bundleDependencies.includes(name))
  for (const name of sdkBundles) {
    fs.cpSync(name === 'protobufjs' ? proto : genai, path.join(source, 'node_modules', name), {recursive: true})
  }
  fs.cpSync(leaf,path.join(source,'node_modules/fixture-protobuf-runtime'),{recursive:true})
  if(ownedBundles.includes('@google/genai')){
    fs.cpSync(proto,path.join(owned,'node_modules/protobufjs'),{recursive:true})
    fs.cpSync(leaf,path.join(owned,'node_modules/fixture-protobuf-runtime'),{recursive:true})
  }
  pkg(source, 'dsh-nexttavern', '1.0.0', {
    dependencies: {'dsh-nexttavern-pi-ai': '1.0.0', '@google/genai': 'file:' + genaiArchive,
      ...(metadata.dependencies.protobufjs ? {protobufjs: 'file:' + protoArchive} : {}),
      'fixture-ordinary-sdk': 'file:' + ordinaryArchive},
    bundleDependencies: ['dsh-nexttavern-pi-ai', ...sdkBundles],
  }, 'export {encode} from "dsh-nexttavern-pi-ai"; export {label} from "fixture-ordinary-sdk"')
  write(path.join(profile, 'package.json'), {private: true, type: 'module'})
  write(path.join(profile, 'pnpm-workspace.yaml'), 'packages: ["."]\nautoInstallPeers: false\nfailOnIgnoredBuilds: true\nallowBuilds: {}\n')
  const packed = pack(source, tarballs)
  assert(packed.members.includes('node_modules/fixture-protobuf-runtime/index.js'),
    'npm pack must retain the undeclared sibling dependency of a bundled SDK')
  cli(pnpm!, ['add', packed.file, '--offline', '--reporter=append-only',
    '--store-dir', path.join(root, 'store')], profile)
  const checked = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', [
    'import path from "node:path"; import {createRequire} from "node:module"; import {pathToFileURL} from "node:url";',
    'const require = createRequire(path.join(process.cwd(), "package.json"));',
    'const entry = require.resolve("dsh-nexttavern");',
    'const {encode, label} = await import(pathToFileURL(entry).href);',
    'const sdkRequire = createRequire(require.resolve("dsh-nexttavern-pi-ai", {paths:[path.dirname(entry)]}));',
    'const sdk = sdkRequire.resolve("@google/genai");',
    'const protobuf = createRequire(sdk).resolve("protobufjs");',
    'const rootSdk = createRequire(path.join(path.dirname(entry), "package.json")).resolve("@google/genai");',
    'const rootLeaf = createRequire(createRequire(rootSdk).resolve("protobufjs")).resolve("fixture-protobuf-runtime");',
    'console.log(JSON.stringify({value:encode("ok"),label,protobuf,rootLeaf}));',
  ].join('\n')], {cwd: profile, env: environment, encoding: 'utf8', timeout: 20000}))
  assert.equal(checked.value, '6f6b')
  assert.equal(checked.label, 'ordinary', 'ordinary runtime dependencies remain functional')
  assert(checked.protobuf.startsWith(profile + path.sep), 'SDK resolution cannot borrow the source tree or an ancestor install')
  assert(checked.rootLeaf.startsWith(profile+path.sep),'the root SDK closure must travel in the npm tarball')
  const pinned=path.join(root,'fixed-owned-sdk')
  fs.cpSync(path.join(profile,'node_modules/dsh-nexttavern/node_modules/dsh-nexttavern-pi-ai'),pinned,{recursive:true})
  cli(pnpm!,['add','dsh-nexttavern-pi-ai@file:'+pinned,'--offline','--reporter=append-only',
    '--store-dir',path.join(root,'store')],profile)
  cli(pnpm!,['install','--offline','--frozen-lockfile','--reporter=append-only',
    '--store-dir',path.join(root,'store')],profile)
  const relinked=execFileSync(process.execPath,['--input-type=module','-e',
    'import {encode} from "dsh-nexttavern-pi-ai"; console.log(encode("relinked"))'],
    {cwd:profile,env:environment,encoding:'utf8',timeout:20000}).trim()
  assert.equal(relinked,Buffer.from('relinked').toString('hex'))
})
const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

test('prebuilt koffi stays scriptless when its protected package is relinked',()=>{
  const root=path.join(temp,'native-build-policy')
  const profile=path.join(root,'profile')
  const source=path.join(root,'product')
  const native=path.join(root,'koffi')
  const meta=JSON.parse(fs.readFileSync(new URL('../development/session-persistence-jsonl/package.json',import.meta.url),'utf8'))
  pkg(native,'koffi',meta.dependencies.koffi,{scripts:{install:'node install.cjs'}},'export const nativeReady=true')
  write(path.join(native,'install.cjs'),'throw Error("prebuilt native library must not run its installer")')
  const owned=path.join(source,'node_modules/dsh-nexttavern-session-persistence-jsonl')
  pkg(owned,'dsh-nexttavern-session-persistence-jsonl','1.0.0',{
    dependencies:{koffi:meta.dependencies.koffi},bundleDependencies:meta.bundleDependencies??[],
  },'export {nativeReady} from "koffi"')
  fs.cpSync(native,path.join(owned,'node_modules/koffi'),{recursive:true})
  pkg(source,'dsh-nexttavern','1.0.0',{
    dependencies:{'dsh-nexttavern-session-persistence-jsonl':'1.0.0'},bundleDependencies:['dsh-nexttavern-session-persistence-jsonl'],
  })
  write(path.join(profile,'package.json'),{private:true,type:'module'})
  write(path.join(profile,'pnpm-workspace.yaml'),'packages: ["."]\nautoInstallPeers: false\nfailOnIgnoredBuilds: true\nallowBuilds: {}\n')
  const run=(spec:string)=>cli(pnpm!,['add',spec,'--offline','--reporter=append-only',
    '--store-dir',path.join(root,'store')],profile)
  run(pack(source,path.join(root,'tarballs')).file)
  const pinned=path.join(root,'fixed-native')
  fs.cpSync(path.join(profile,'node_modules/dsh-nexttavern/node_modules/dsh-nexttavern-session-persistence-jsonl'),pinned,{recursive:true})
  run('dsh-nexttavern-session-persistence-jsonl@file:'+pinned)
  cli(pnpm!,['install','--offline','--frozen-lockfile','--reporter=append-only',
    '--store-dir',path.join(root,'store')],profile)
  assert.equal(execFileSync(process.execPath,['--input-type=module','-e',
    'import {nativeReady} from "dsh-nexttavern-session-persistence-jsonl"; console.log(nativeReady)'],
    {cwd:profile,env:environment,encoding:'utf8',timeout:20000}).trim(),'true')
})

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
    'const [product, peer, original] = await Promise.all([load(root), load(require.resolve("@deepseek-ai/fixture-host-peer")),',
    '  load(require.resolve("dsh-plugin-anydoc"))]);',
    'console.log(JSON.stringify({root, owned, rootReal: fs.realpathSync(root), ownedReal: fs.realpathSync(owned),',
    '  owner: product.owner, original: original.owner, peerShared: product.singleton === peer.singleton,',
    '  peerPath: createRequire(owned).resolve("@deepseek-ai/fixture-host-peer"), hostPath: require.resolve("@deepseek-ai/fixture-host-peer")}));',
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
  pkg(stable, 'dsh-nexttavern-anydoc', '0.0.0-fixture.1', {peerDependencies: {'@deepseek-ai/fixture-host-peer': '1.0.0'}},
    'export {singleton} from "@deepseek-ai/fixture-host-peer"; export const owner = "fixed-compatibility"')
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
    'const host = require.resolve("@deepseek-ai/fixture-host-peer");',
    'const childHost = createRequire(entry).resolve("@deepseek-ai/fixture-host-peer");',
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

test('installed bundle bootstrap prepares durable pins without relinking the running graph', () => {
  const fixture = setup('bootstrap', true)
  const home = path.join(fixture.root, 'home')
  const v1 = product(fixture.root, '0.0.0-fixture.1', 'bundled', true)
  const v2 = product(fixture.root, '0.0.0-fixture.2', 'bundled', true)
  fixture.run('add', v1.file)
  const originalFile = path.join(fixture.profile, 'node_modules/dsh-plugin-anydoc/index.js')
  const originalHash = hash(originalFile)
  const lockFile = path.join(fixture.profile, 'pnpm-lock.yaml')
  const beforeLock = hash(lockFile)
  const bootstrapScript = path.join(fixture.profile, 'bootstrap.mjs')
  write(bootstrapScript, [
    'import {createRequire} from "node:module";',
    'import {pathToFileURL} from "node:url";',
    'import {bootstrap} from "dsh-nexttavern";',
    'const require = createRequire(import.meta.url);',
    'const peer = await import(pathToFileURL(require.resolve("@deepseek-ai/fixture-host-peer")).href);',
    'const result = await bootstrap(JSON.parse(process.argv[2]));',
    // Import compatibility code only after inventory, pins and peer checks.
    'const {owner, singleton} = await import(pathToFileURL(result.modules[0].entry).href);',
    'console.log(JSON.stringify({result, owner, root: require.resolve("dsh-nexttavern"), samePeer: singleton === peer.singleton}));',
  ].join('\n'))
  let counter = 0
  const bootstrap = () => JSON.parse(cli(bootstrapScript, [JSON.stringify({
    home, profile: 'web', hostAnchor: path.join(fixture.profile, 'package.json'),
    backup: path.join(fixture.root, 'backups', String(counter++)),
  })], fixture.profile))
  const installedRoot = path.dirname(createRequire(path.join(fixture.profile, 'package.json')).resolve('dsh-nexttavern'))
  const ownedRoot = path.join(installedRoot, 'node_modules/dsh-nexttavern-anydoc')
  const ownedEntry = path.join(ownedRoot, 'index.js')
  const originalEntry = fs.readFileSync(ownedEntry)
  const manifestFile = path.join(fixture.profile, 'package.json')
  const originalManifest = hash(manifestFile)
  const installedManifest = path.join(installedRoot, 'package.json')
  const originalProductManifest = fs.readFileSync(installedManifest)
  const inventoryFile = path.join(installedRoot, 'nexttavern.dependencies.json')
  const originalInventory = fs.readFileSync(inventoryFile)
  const unversionedProduct = JSON.parse(originalProductManifest.toString())
  const unversionedInventory = JSON.parse(originalInventory.toString())
  delete unversionedProduct.version
  delete unversionedInventory.productVersion
  write(installedManifest, unversionedProduct)
  write(inventoryFile, unversionedInventory)
  assert.throws(bootstrap, (error: any) => /inventory does not match/.test(String(error.stderr)))
  fs.writeFileSync(installedManifest, originalProductManifest)
  fs.writeFileSync(inventoryFile, originalInventory)
  const incompleteProduct = JSON.parse(originalProductManifest.toString())
  incompleteProduct.dependencies['dsh-nexttavern-unlisted'] = '1.0.0'
  write(installedManifest, incompleteProduct)
  assert.throws(bootstrap, (error: any) => /inventory is incomplete/.test(String(error.stderr)))
  assert.equal(hash(manifestFile), originalManifest)
  fs.writeFileSync(installedManifest, originalProductManifest)
  fs.writeFileSync(ownedEntry, 'throw Error("must never execute before verification")')
  assert.throws(bootstrap, (error: any) => /Protected package hash differs/.test(String(error.stderr)))
  assert.equal(hash(manifestFile), originalManifest)
  fs.writeFileSync(ownedEntry, originalEntry)
  const duplicatePeer = path.join(ownedRoot, 'node_modules/@deepseek-ai/fixture-host-peer')
  pkg(duplicatePeer, '@deepseek-ai/fixture-host-peer', '1.0.0')
  // A second copy inside the owned package is an extra file the inventory never
  // admitted, so the inventory gate rejects it before peer identity is compared.
  assert.throws(bootstrap, (error: any) => /Protected package file inventory differs/.test(String(error.stderr)))
  for (const file of ['package.json', 'index.js']) fs.unlinkSync(path.join(duplicatePeer, file))
  fs.rmdirSync(duplicatePeer)
  fs.rmdirSync(path.dirname(duplicatePeer))
  assert.equal(hash(manifestFile), originalManifest)
  // A third-party ordinary dependency must travel with the product, so declaring
  // one as a shared peer is rejected before any resolution.
  const thirdParty = path.join(ownedRoot, 'node_modules/fixture-host-peer')
  pkg(thirdParty, 'fixture-host-peer', '1.0.0')
  const ownedManifestFile = path.join(ownedRoot, 'package.json')
  const ownedManifest = JSON.parse(fs.readFileSync(ownedManifestFile, 'utf8'))
  write(ownedManifestFile, {...ownedManifest, peerDependencies: {
    ...ownedManifest.peerDependencies, 'fixture-host-peer': '1.0.0'}})
  write(path.join(installedRoot, 'nexttavern.dependencies.json'), {
    ...JSON.parse(originalInventory.toString()),
    packages: (JSON.parse(originalInventory.toString()).packages as {name: string; files: {path: string; sha256: string}[]}[])
      .map(row => row.name !== 'dsh-nexttavern-anydoc' ? row : {...row,
        files: [
          ...row.files.filter(file => file.path !== 'package.json'),
          {path: 'package.json', sha256: hash(ownedManifestFile)},
          ...['package.json', 'index.js'].map(file => ({path: `node_modules/fixture-host-peer/${file}`,
            sha256: hash(path.join(thirdParty, file))})),
        ].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)}),
  })
  assert.throws(bootstrap, (error: any) => /Third-party peer is not a host service/.test(String(error.stderr)))
  fs.writeFileSync(path.join(installedRoot, 'nexttavern.dependencies.json'), originalInventory)
  write(ownedManifestFile, ownedManifest)
  fs.rmSync(thirdParty, {recursive: true})
  assert.equal(hash(manifestFile), originalManifest)
  const profileLock = manifestFile + '.lock'
  fs.writeFileSync(profileLock, String(process.pid) + '\n', {flag: 'wx'})
  assert.throws(bootstrap, (error: any) => /timed out waiting for the writer lock/.test(String(error.stderr)))
  assert.equal(fs.readFileSync(profileLock, 'utf8'), String(process.pid) + '\n', 'a busy official lock is never removed')
  fs.unlinkSync(profileLock)
  assert.equal(hash(manifestFile), originalManifest)
  const first = bootstrap()
  assert.equal(first.owner, '0.0.0-fixture.1')
  assert.equal(first.samePeer, true)
  assert.equal(first.result.runtimeSource, 'product-bundle')
  assert.equal(first.result.profileGraph, 'relink-pending')
  assert.equal(hash(lockFile), beforeLock, 'bootstrap must not rewrite the running package-manager graph')
  const protectedFile = path.join(fixture.profile, 'node_modules/dsh-nexttavern-anydoc/package.json')
  assert.equal(fs.existsSync(protectedFile), false, 'the private bundled implementation works before profile relink')
  const pin1 = first.result.prepared.receipt.packages[0]
  assert.equal(bootstrap().result.prepared.transaction, null)

  const skin = path.join(fixture.root, 'skin')
  pkg(skin, 'fixture-unrelated-skin', '1.0.0')
  fixture.run('add', pack(skin, path.join(fixture.root, 'tarballs')).file)
  assert.equal(JSON.parse(fs.readFileSync(protectedFile, 'utf8')).version, '0.0.0-fixture.1')
  const afterSkin = bootstrap()
  assert.equal(afterSkin.samePeer, true)
  assert.equal(afterSkin.owner, first.owner)
  // A peer-context hash may change pnpm's physical root path. The dependency
  // must still belong to the current root bundle and contain the same bytes.
  assert.equal(afterSkin.result.modules[0].entry,
    path.join(path.dirname(afterSkin.root), 'node_modules/dsh-nexttavern-anydoc/index.js'))
  assert.equal(hash(afterSkin.result.modules[0].entry), createHash('sha256').update(originalEntry).digest('hex'))
  assert.equal(afterSkin.result.prepared.transaction, null)

  fixture.run('add', v2.file)
  const upgradeLock = hash(lockFile)
  const second = bootstrap()
  assert.equal(second.owner, '0.0.0-fixture.2', 'root must use its own new bundle despite the older profile pin')
  assert.equal(second.samePeer, true)
  assert.equal(hash(lockFile), upgradeLock)
  assert.equal(JSON.parse(fs.readFileSync(protectedFile, 'utf8')).version, '0.0.0-fixture.1')
  assert.equal(second.result.prepared.receipt.packages[0].version, '0.0.0-fixture.2')
  assert.ok(fs.existsSync(path.join(home, pin1.directory, 'index.js')), 'old generation remains recoverable')

  fixture.run('install', '--force', '--no-frozen-lockfile')
  assert.equal(JSON.parse(fs.readFileSync(protectedFile, 'utf8')).version, '0.0.0-fixture.2')
  assert.equal(bootstrap().owner, second.owner)
  assert.equal(hash(originalFile), originalHash)
  fixture.run('remove', 'dsh-nexttavern')
  assert.equal(JSON.parse(fs.readFileSync(protectedFile, 'utf8')).dsh?.bundle, undefined,
    'retained library pins have no autonomous activation layer')
  assert.equal(hash(originalFile), originalHash)
})
