import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readlink, rm, writeFile, cp, symlink } from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'

const repo = path.resolve(import.meta.dirname, '../..')
test('first launch and APK replacement preserve user profile and relink only app packages', async () => {
  const base = path.join(repo, 'artifacts/test-temp')
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(path.join(base, 'android-launch-'))
  try {
    const home = path.join(root, 'home')
    const workspace = path.join(root, 'private workspace')
    await mkdir(workspace, {recursive:true})
    const libraries=path.join(repo,existsSync(path.join(repo,'runtime/alpha3/build-tools/package.json'))
      ? 'runtime/alpha3/build-tools/node_modules' : 'build-tools/node_modules')
    const yaml=createRequire(path.join(libraries,'../package.json'))('yaml') as {parse(text:string):unknown}
    const launch = async (version: string) => {
      const code = path.join(root, version)
      await mkdir(path.join(code, 'profile-template'), { recursive: true })
      await mkdir(path.join(code, 'node_modules/@deepseek-ai/dsh/lib'), { recursive: true })
      await mkdir(path.join(code, 'node_modules/dsh-nexttavern'), { recursive: true })
      await writeFile(path.join(code,'node_modules/dsh-nexttavern/package.json'),JSON.stringify({name:'dsh-nexttavern',dependencies:{yaml:'2.8.1'}}))
      await mkdir(path.join(code,'node_modules/dsh-nexttavern/node_modules'),{recursive:true})
      const parser=path.join(code,'node_modules/dsh-nexttavern/node_modules/yaml')
      if(!existsSync(parser))await symlink(path.join(libraries,'yaml'),parser,'junction')
      await cp(path.join(repo, 'android/host/host-launch.mts'), path.join(code, 'host-launch.mts'))
      for (const name of ['package.json', 'cordis.yml', 'cordis.patch.yml', 'pnpm-workspace.yaml']) {
        await writeFile(path.join(code, 'profile-template', name), name === 'package.json' ? JSON.stringify({dependencies:{'dsh-nexttavern':'file:/cloud/product'}}) : '[]\n')
      }
      await writeFile(path.join(code, 'profile-packages.json'), '["dsh-nexttavern"]')
      await writeFile(path.join(code,'profile-provision.json'),JSON.stringify({schemaVersion:1,sourceProfileRoot:'/cloud/profile',packages:[{name:'dsh-nexttavern',sourcePath:'/cloud/product',codePath:'node_modules/dsh-nexttavern'}]}))
      await writeFile(path.join(code, 'node_modules/@deepseek-ai/dsh/package.json'), '{"type":"module"}')
      await writeFile(path.join(code, 'node_modules/@deepseek-ai/dsh/lib/bin.js'), `
export async function runCli() {
  console.log(JSON.stringify({argv:process.argv.slice(2), cache:process.env.NARB_DISABLE_NATIVE_CACHE}))
}
if (import.meta.main) await runCli()
`)
      const result = spawnSync(process.execPath, [path.join(code, 'host-launch.mts')], {
        cwd:workspace,
        env: { ...process.env, DSH_HOME: home, NEXTTAVERN_GENERATION: version }, encoding: 'utf8',
      })
      assert.equal(result.status, 0, result.stderr)
      const output = JSON.parse(result.stdout)
      assert.deepEqual(output.argv, ['web', '--patch', path.join(home, 'android-host.patch.yml'), '--host', '127.0.0.1', '--port', '0', '--no-open'])
      assert.equal(output.cache, '1')
      assert.equal(await readlink(path.join(home, 'profiles/web/node_modules/dsh-nexttavern')), path.join(code, 'node_modules/dsh-nexttavern'))
      const pkg=JSON.parse(await readFile(path.join(home,'profiles/web/package.json'),'utf8'))
      assert.equal(pkg.dependencies['dsh-nexttavern'],'file:'+path.join(code,'node_modules/dsh-nexttavern'))
      const overlay=await readFile(path.join(home,'android-host.patch.yml'),'utf8')
      assert.ok(overlay.includes('- id: workspace-controller\n  config:\n    documentsDirectory: '+JSON.stringify(workspace)+'\n'),
        'first, repeated and upgraded launches use the native-managed cwd for the official first-use Workspace policy')
    }
    await launch('v1')
    const patch = path.join(home, 'profiles/web/cordis.patch.yml')
    const initial=await readFile(patch,'utf8')
    assert.deepEqual(yaml.parse(initial),[{id:'agent-preset-registry',config:{default:'roleplay'}}])
    const userPatch='# user settings\n- id: retained-user-row\n  config:\n    value: !!js ctx.example\n- id: agent-preset-registry\n  config:\n    default: roleplay\n    selectedDefault: standard\n'
    await writeFile(patch, userPatch)
    await launch('v1')
    await launch('v2')
    assert.equal(await readFile(patch, 'utf8'), userPatch)
    const overlay = await readFile(path.join(home, 'android-host.patch.yml'), 'utf8')
    assert.match(overlay, /printUrl: false/)
    assert.match(overlay, /v2\/android-host.mjs/)
    assert.doesNotMatch(overlay, /agent-preset-registry|selectedDefault/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
