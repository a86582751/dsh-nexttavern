/** Small generated-package fixtures sharing the locked host peers; never a Harness install. */
import {cp, mkdir, readFile, symlink} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {fileURLToPath, pathToFileURL} from 'node:url'
import path from 'node:path'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'

export async function ownedPackages(units: readonly string[], extraPeers: readonly string[] = []) {
  const directory = createTestDirectory('owned-compat-packages-')
  const modules = path.join(directory, 'node_modules')
  const peers = fileURLToPath(new URL('../build-tools/node_modules/', import.meta.url))
  const hostRequire = createRequire(new URL('../build-tools/package.json', import.meta.url))
  // Public development sources use the manifest's development/ package layout;
  // maintenance sources retain compat/. Neither layout is a Harness installation.
  const packageRoot = existsSync(new URL('../compat/', import.meta.url)) ? '../compat/' : '../development/'
  try {
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
    await symlink(path.join(peers, '@deepseek-ai'), path.join(modules, '@deepseek-ai'), 'junction')
    await symlink(path.dirname(hostRequire.resolve('zod/package.json')), path.join(modules, 'zod'), 'junction')
    for (const name of extraPeers) {
      if (!/^[a-z][a-z0-9-]*$/.test(name)) throw Error('Invalid extra fixture peer')
      await symlink(path.join(peers, name), path.join(modules, name), 'junction')
    }
    const require = createRequire(path.join(directory, 'package.json'))
    return {
      directory, require,
      load: (name: string) => import(pathToFileURL(require.resolve(name)).href),
      close: () => cleanupTestDirectory(directory),
    }
  } catch (error) {
    cleanupTestDirectory(directory)
    throw error
  }
}
