/** Small generated-package fixtures sharing the locked host peers; never a Harness install. */
import {cp, lstat, mkdir, readFile, readdir, symlink} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {fileURLToPath, pathToFileURL} from 'node:url'
import path from 'node:path'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'
import {copyStorageJsonPackage, type StorageJsonPin} from './roleplay-core-process-storage-fixture.mts'

// Public development sources use the manifest's development/ package layout;
// maintenance sources retain compat/. Neither layout is a Harness installation.
const packageRoot = existsSync(new URL('../development/', import.meta.url)) ? '../development/' : '../development/'

/** Mount maintained packages at their real names, including their Native peers.
 * Official Host packages stay available under their own names for shared ABI. */
async function copyMaintainedPackage(directory: string, unit: string): Promise<string> {
  if (!/^[a-z]+(?:-[a-z]+)*$/.test(unit)) throw Error('Invalid owned package unit')
  const source = fileURLToPath(new URL(`${packageRoot}${unit}/`, import.meta.url))
  const metadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'))
  if (metadata.name !== `dsh-nexttavern-${unit}` && metadata.name !== `dsh-nexttavern-native-${unit}`) {
    throw Error('Owned package identity differs')
  }
  const installed = path.join(directory, 'node_modules', metadata.name)
  if (existsSync(installed)) return metadata.name
  await mkdir(installed)
  await cp(path.join(source, 'package.json'), path.join(installed, 'package.json'))
  await cp(path.join(source, 'lib'), path.join(installed, 'lib'), {recursive: true})
  for (const name of Object.keys({...metadata.dependencies, ...metadata.peerDependencies})) {
    if (!name.startsWith('dsh-nexttavern-native-')) continue
    const directoryName = name.slice('dsh-nexttavern-'.length)
    const peerUnit = existsSync(new URL(`${packageRoot}${directoryName}/package.json`, import.meta.url))
      ? directoryName : directoryName.slice('native-'.length)
    await copyMaintainedPackage(directory, peerUnit)
  }
  return metadata.name
}

export async function ownedPackages(units: readonly string[], extraPeers: readonly string[] = [],
  options: {localSession?: boolean; storageJson?: boolean | 'maintained'; physicalPeers?: readonly string[]} = {}) {
  if (options.storageJson && !options.localSession) throw Error('Selected JSON fixture needs the isolated locked peer scope')
  const directory = createTestDirectory('owned-compat-packages-')
  const modules = path.join(directory, 'node_modules')
  const peers = fileURLToPath(new URL('../build-tools/node_modules/', import.meta.url))
  const hostRequire = createRequire(new URL('../build-tools/package.json', import.meta.url))
  const physicalPeerPins: {name:string;version:string;packageSha256:string;physical:true}[] = []
  try {
    let storageJsonPin: StorageJsonPin | undefined
    await mkdir(modules)
    for (const unit of units) await copyMaintainedPackage(directory, unit)
    if (options.localSession) {
      const scope = path.join(modules, '@deepseek-ai')
      const lockedScope = path.join(peers, '@deepseek-ai')
      await mkdir(scope)
      for (const name of await readdir(lockedScope)) {
        if (options.storageJson === true && name === 'dsh-storage-json') continue
        await symlink(path.join(lockedScope, name), path.join(scope, name), 'junction')
      }
      if (options.storageJson) storageJsonPin = await copyStorageJsonPackage(options.storageJson === 'maintained'
        ? path.join(modules, 'dsh-nexttavern-native-storage-json') : path.join(scope, 'dsh-storage-json'),
        options.storageJson === 'maintained' ? 'maintained' : 'installed')
      await copyMaintainedPackage(directory, 'session')
    } else {
      await symlink(path.join(peers, '@deepseek-ai'), path.join(modules, '@deepseek-ai'), 'junction')
    }
    await symlink(path.dirname(hostRequire.resolve('zod/package.json')), path.join(modules, 'zod'), 'junction')
    // Browser client factories require their real host peers immediately. Keep
    // this opt-in graph physical and lock-bound so NODE_PATH cannot conceal a
    // missing dependency; existing fixtures retain their shared-peer behavior.
    const physicalNames = new Set<string>()
    const lock = options.physicalPeers?.length
      ? JSON.parse(await readFile(new URL('../build-tools/package-lock.json', import.meta.url), 'utf8')) : undefined
    async function copyPhysicalPeer(name:string) {
      if (physicalNames.has(name)) return
      if (!/^(?:@[a-z0-9-]+\/)?[a-z][a-z0-9-]*$/.test(name)) throw Error('Invalid physical fixture peer')
      if (name.startsWith('@deepseek-ai/') || name === 'zod' || extraPeers.includes(name)) {
        throw Error('Physical host peer overlaps the existing owned graph')
      }
      const source = path.join(peers, name)
      const info = await lstat(source)
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw Error(`Physical fixture peer is not an ordinary locked directory: ${name}`)
      }
      const bytes = await readFile(path.join(source, 'package.json'))
      const metadata = JSON.parse(bytes.toString('utf8'))
      if (metadata.name !== name || metadata.version !== lock.packages[`node_modules/${name}`]?.version) {
        throw Error(`Physical fixture peer differs from its package lock: ${name}`)
      }
      physicalNames.add(name)
      await cp(source, path.join(modules, name), {recursive:true, errorOnExist:true, force:false})
      physicalPeerPins.push({name, version:metadata.version,
        packageSha256:createHash('sha256').update(bytes).digest('hex'), physical:true})
      for (const dependency of Object.keys(metadata.dependencies ?? {}).sort()) await copyPhysicalPeer(dependency)
    }
    for (const name of options.physicalPeers ?? []) await copyPhysicalPeer(name)
    for (const name of extraPeers) {
      if (!/^[a-z][a-z0-9-]*$/.test(name)) throw Error('Invalid extra fixture peer')
      await symlink(path.join(peers, name), path.join(modules, name), 'junction')
    }
    const require = createRequire(path.join(directory, 'package.json'))
    return {
      directory, require, storageJsonPin, physicalPeerPins:Object.freeze(physicalPeerPins),
      load: (name: string) => import(pathToFileURL(require.resolve(name)).href),
      close: () => cleanupTestDirectory(directory),
    }
  } catch (error) {
    cleanupTestDirectory(directory)
    throw error
  }
}

/** Add the real private peer without replacing any official Host package. */
export async function mountMaintainedPeer(
  packages: Awaited<ReturnType<typeof ownedPackages>>, name: string,
): Promise<void> {
  await copyMaintainedPackage(packages.directory, name)
}
