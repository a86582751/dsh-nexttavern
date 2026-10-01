/** Small generated-package fixtures sharing the locked host peers; never a Harness install. */
import {cp, lstat, mkdir, readFile, readdir, realpath, symlink} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {fileURLToPath, pathToFileURL} from 'node:url'
import path from 'node:path'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'
import {copyStorageJsonPackage, type StorageJsonPin} from './roleplay-core-process-storage-fixture.mts'

export async function ownedPackages(units: readonly string[], extraPeers: readonly string[] = [],
  options: {localSession?: boolean; storageJson?: boolean; physicalPeers?: readonly string[]} = {}) {
  if (options.storageJson && !options.localSession) throw Error('Official JSON fixture needs the isolated locked peer scope')
  const directory = createTestDirectory('owned-compat-packages-')
  const modules = path.join(directory, 'node_modules')
  const peers = fileURLToPath(new URL('../build-tools/node_modules/', import.meta.url))
  const hostRequire = createRequire(new URL('../build-tools/package.json', import.meta.url))
  const physicalPeerPins: {name:string;version:string;packageSha256:string;physical:true}[] = []
  // Public development sources use the manifest's development/ package layout;
  // maintenance sources retain compat/. Neither layout is a Harness installation.
  const packageRoot = existsSync(new URL('../compat/', import.meta.url)) ? '../compat/' : '../development/'
  try {
    let storageJsonPin: StorageJsonPin | undefined
    await mkdir(modules)
    for (const unit of units) {
      if (!/^[a-z]+(?:-[a-z]+)*$/.test(unit)) throw Error('Invalid owned package unit')
      const source = fileURLToPath(new URL(`${packageRoot}${unit}/`, import.meta.url))
      const metadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'))
      if (metadata.name !== `dsh-nexttavern-${unit}`) throw Error('Owned package identity differs')
      const installed = path.join(modules, metadata.name)
      await mkdir(installed)
      await cp(path.join(source, 'package.json'), path.join(installed, 'package.json'))
      await cp(path.join(source, 'lib'), path.join(installed, 'lib'), {recursive: true})
    }
    if (options.localSession) {
      const scope = path.join(modules, '@deepseek-ai')
      const lockedScope = path.join(peers, '@deepseek-ai')
      await mkdir(scope)
      for (const name of await readdir(lockedScope)) {
        if (options.storageJson && name === 'dsh-storage-json') continue
        if (name === 'dsh-session' || name === 'dsh-session-persistence') continue
        await symlink(path.join(lockedScope, name), path.join(scope, name), 'junction')
      }
      if (options.storageJson) storageJsonPin = await copyStorageJsonPackage(path.join(scope, 'dsh-storage-json'))
      const localSession = fileURLToPath(new URL(`${packageRoot}session/`, import.meta.url))
      for (const [name, source] of [
        ['dsh-session', localSession],
        ['dsh-session-persistence', path.join(lockedScope, 'dsh-session-persistence')],
      ]) {
        const installed = path.join(scope, name)
        await mkdir(installed)
        await cp(path.join(source, 'package.json'), path.join(installed, 'package.json'))
        await cp(path.join(source, 'lib'), path.join(installed, 'lib'), {recursive: true})
      }
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
      if (!info.isDirectory() || info.isSymbolicLink() || await realpath(source) !== path.resolve(source)) {
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
