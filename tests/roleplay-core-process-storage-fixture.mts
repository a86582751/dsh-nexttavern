/** Official JSON storage in a small locked-peer test graph. No Harness boot,
 * profile mutation, replacement backend, or persisted Native authority lives here. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {lstat, mkdir, readFile, readdir, realpath, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

export interface StorageJsonPin {
  schemaVersion: 1
  encoding: 'official-json-storage-fixture-pin-v1'
  name: '@deepseek-ai/dsh-storage-json'
  version: '0.1.7-rc.2'
  sourcePackageRoot: string
  files: readonly {path: string; sha256: string; bytes: number}[]
  descriptorSha256: string
}
export interface ProcessFixtureCloseReport {
  state: 'open' | 'closing' | 'closed' | 'failed'
  flushedSessions: {sessionId: string; flushed: boolean}[]
  contextClosed: boolean
  domainClosed?: boolean
  backendClosed?: boolean
}
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex')
const equalPath = (left: string, right: string) => process.platform === 'win32'
  ? left.toLowerCase() === right.toLowerCase() : left === right

/** Only a direct child of the actual orchestrator test-temp scope is accepted.
 * A quality run can nest its scope under the fixed D root. This module and
 * child processes never delete a scope owned by their orchestrator. */
export async function processFixtureDataRoot(input: string): Promise<string> {
  assert.ok(path.isAbsolute(input), 'process dataRoot must be a real absolute path')
  const fixedRoot = await realpath(fileURLToPath(new URL('../../../artifacts/test-temp/', import.meta.url)))
  const configuredRoot = process.env.DSH_TEST_TMPDIR
  if(configuredRoot)assert.ok(path.isAbsolute(configuredRoot),'orchestrator test-temp scope must be absolute')
  const root = configuredRoot?await realpath(configuredRoot):fixedRoot
  const relativeRoot = path.relative(fixedRoot,root)
  assert.ok(!path.isAbsolute(relativeRoot)&&relativeRoot!=='..'&&!relativeRoot.startsWith('..'+path.sep),
    'orchestrator test-temp scope must remain under the fixed repository root')
  const actual = await realpath(input)
  assert.equal((await lstat(input)).isSymbolicLink(), false, 'dataRoot must not be a junction')
  assert.equal(equalPath(path.dirname(actual), root), true, 'dataRoot must be an owned direct test-temp scope')
  assert.match(path.basename(actual), /^roleplay-core-process-[a-zA-Z0-9_-]+$/)
  if (process.platform === 'win32') assert.match(path.parse(actual).root, /^d:\\$/i)
  return actual
}

/** Copy only the installed official adapter metadata/lib, binding its peer
 * imports to the fixture's existing graph. Never modify or execute the Harness. */
export async function copyStorageJsonPackage(installed: string): Promise<StorageJsonPin> {
  const source = await realpath(fileURLToPath(new URL(
    '../../../../dsh-public-access/artifacts/auth-native/harness/node_modules/@deepseek-ai/dsh-storage-json/', import.meta.url)))
  const metadataBytes = await readFile(path.join(source, 'package.json'))
  const metadata = JSON.parse(metadataBytes.toString('utf8'))
  assert.equal(metadata.name, '@deepseek-ai/dsh-storage-json')
  assert.equal(metadata.version, '0.1.7-rc.2')
  const captured: {path: string; bytes: Buffer}[] = [{path: 'package.json', bytes: metadataBytes}]
  async function collect(relative: string) {
    for (const entry of (await readdir(path.join(source, relative), {withFileTypes: true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      assert.equal(entry.isSymbolicLink(), false, 'official JSON package lib must not link another package')
      const child = `${relative}/${entry.name}`
      if (entry.isDirectory()) await collect(child)
      else {
        assert.equal(entry.isFile(), true)
        captured.push({path: child, bytes: await readFile(path.join(source, child))})
      }
    }
  }
  await collect('lib')
  assert.ok(captured.length <= 200 && captured.reduce((sum,file)=>sum+file.bytes.length,0) <= 4_000_000)
  for (const file of captured) {
    const target = path.join(installed, file.path)
    await mkdir(path.dirname(target), {recursive: true})
    await writeFile(target, file.bytes)
    assert.equal(hash(await readFile(target)), hash(file.bytes), 'copied adapter must retain exact package bytes')
    assert.equal(hash(await readFile(path.join(source, file.path))), hash(file.bytes), 'readonly dependency changed during pinning')
  }
  const files = captured.map(file=>Object.freeze({path:file.path,sha256:hash(file.bytes),bytes:file.bytes.length}))
  const descriptor = {schemaVersion:1 as const,encoding:'official-json-storage-fixture-pin-v1' as const,
    name:'@deepseek-ai/dsh-storage-json' as const,version:'0.1.7-rc.2' as const,sourcePackageRoot:source,files}
  return Object.freeze({...descriptor,files:Object.freeze(files),descriptorSha256:hash(JSON.stringify(descriptor))})
}

interface PackageGraph {
  require: Pick<NodeRequire, 'resolve'>
  load(name: string): Promise<any>
  storageJsonPin?: StorageJsonPin
}
/** All plugin code is loaded through the same graph that created Context and
 * Native Agents. Equal version strings alone do not prove peer identity. */
export async function installProcessStorage(ctx: any, graph: PackageGraph, dataRoot: string) {
  assert.ok(graph.storageJsonPin, 'real process storage requires its exact official adapter pin')
  const cordisFile = await realpath(graph.require.resolve('@deepseek-ai/cordis'))
  const storageFile = await realpath(graph.require.resolve('@deepseek-ai/dsh-storage'))
  const moduleUrls: Record<string,string> = {cordis:pathToFileURL(cordisFile).href,storage:pathToFileURL(storageFile).href}
  for (const name of ['dsh-storage', 'dsh-storage-domain', 'dsh-storage-json']) {
    const entry = graph.require.resolve(`@deepseek-ai/${name}`)
    const peers = createRequire(entry)
    assert.equal(equalPath(await realpath(peers.resolve('@deepseek-ai/cordis')), cordisFile), true,
      `${name} must share the fixture Cordis instance`)
    if (name !== 'dsh-storage') assert.equal(equalPath(await realpath(peers.resolve('@deepseek-ai/dsh-storage')),storageFile),true)
    moduleUrls[name] = pathToFileURL(await realpath(entry)).href
  }
  const [Cordis, Storage, Json, Domain] = await Promise.all([
    graph.load('@deepseek-ai/cordis'), graph.load('@deepseek-ai/dsh-storage'),
    graph.load('@deepseek-ai/dsh-storage-json'), graph.load('@deepseek-ai/dsh-storage-domain'),
  ])
  assert.ok(ctx instanceof Cordis.Context, 'storage and caller must share the actual Context constructor')
  await ctx.plugin(Storage.default)
  await ctx.plugin(Json, {root:path.join(dataRoot,'storages')})
  await ctx.plugin(Domain, {backend:'json'})
  const facility = ctx.get('storageDomain'), backend = ctx.storage.backend.get('json')
  assert.ok(facility instanceof Domain.DomainFacility)
  assert.ok(backend instanceof Json.JsonStorageBackend)
  return {
    moduleUrls:Object.freeze(moduleUrls),
    table(name: string) {
      const domain = facility.get('roleplay')
      assert.equal(domain?.constructor.name, 'DomainImpl', 'Core must have opened the real roleplay domain')
      const table = domain.table(name)
      assert.equal(table instanceof Map, false, 'a Map cannot stand in for production storage')
      return table
    },
    closed() {return {domainClosed:facility.get('roleplay')===undefined,backendClosed:backend.closed===true}},
  }
}
