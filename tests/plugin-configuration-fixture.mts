/** Real alpha.7 profile editor and Settings forms; no installed Harness or user home. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const load = (name: string) => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href)
const {boot, initProfile, readProfilePatches} = await load('dsh-app-boot')
const {default: ConfigEditor} = await load('dsh-config-editor')
const {default: Settings} = await load('dsh-settings')
const {default: Llm} = await load('dsh-llm')
const {default: Sessions} = await load('dsh-session')

export async function configurationFixture(plugin: object, config: object, prepare?: (ctx: any) => void) {
  const home = createTestDirectory('plugin-configuration-')
  const dir = path.join(home, 'profiles/web')
  const bundle = path.join(dir, 'node_modules/configuration-fixture')
  const save = (file: string, data: unknown) => {
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, JSON.stringify(data) + '\n')
  }
  let ctx: any
  try {
    initProfile(dir, ['configuration-fixture'])
    save(path.join(home, 'package.json'), {name: 'configuration-fixture-host', private: true})
    save(path.join(bundle, 'package.json'), {name: 'configuration-fixture', version: '0.0.0',
      dsh: {bundle: {patch: './patch.json'}}})
    save(path.join(bundle, 'patch.json'), [{insert: [
      {id: 'config-editor', name: 'cordis:fixture-editor'},
      {id: 'settings', name: 'cordis:fixture-settings'},
      {id: 'llm', name: 'cordis:fixture-llm'},
      {id: 'sessions', name: 'cordis:fixture-sessions'},
      {id: 'llm-pi-ai', name: 'cordis:fixture-plugin', config},
    ]}])
    save(path.join(dir, 'cordis.yml'), [])
    const profile = {name: 'web', startedBundles: ['configuration-fixture'], dir,
      patchPath: path.join(dir, 'cordis.patch.yml'), installAnchor: path.join(home, 'package.json'),
      cwd: home, home, overlays: [], telemetryDisabledEnv: undefined}
    ctx = await boot('web', path.join(dir, 'cordis.yml'), readProfilePatches('web', profile), (host: any) => {
      host.provide('profileContext', profile)
      host.provide('appReady', {onReady: (listener: () => void) => {listener(); return () => {}}})
      Object.assign(host.loader.builtins, {'fixture-editor': ConfigEditor, 'fixture-settings': Settings,
        'fixture-llm': Llm, 'fixture-sessions': Sessions, 'fixture-plugin': plugin})
      if (prepare) host.plugin({inject: ['llm'], apply: prepare})
    })
    return {ctx, home, profile, async close() {
      try {await ctx.fiber.dispose()} finally {cleanupTestDirectory(home)}
    }}
  } catch (error) {
    try {await ctx?.fiber.dispose()} finally {cleanupTestDirectory(home)}
    throw error
  }
}
