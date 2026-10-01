/** Product config planning against published alpha.6 composition; never starts Harness. */
import assert from 'node:assert/strict'
import {test} from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {captureNextTavernProfilePlan} from '../lib/operations/nexttavern-profile-plan.mjs'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const api = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')).href)
const product = 'dsh-nexttavern'
const provider = {id: 'meter', module: 'official-meter'}

function fixture() {
  const root = createTestDirectory('product-profile-plan-')
  const home = path.join(root, 'home'), dir = path.join(home, 'profiles/web')
  const installAnchor = path.join(root, 'install/package.json')
  const files = new Set<string>()
  function write(file: string, value: unknown) {
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, JSON.stringify(value)+'\n')
    files.add(file)
  }
  function bundle(name: string, patches: unknown[], installation = false) {
    const pkg = path.join(installation ? path.dirname(installAnchor) : dir, 'node_modules', name)
    write(path.join(pkg, 'package.json'), {name, version: '0.0.0-fixture', dsh: {bundle: {patch: './patch.json'}}})
    const file = path.join(pkg, 'patch.json')
    write(file, patches)
    return file
  }
  write(installAnchor, {private: true})
  const profileManifest = path.join(dir, 'package.json')
  write(profileManifest, {private: true, dsh: {profile: {bundles: ['fixture-base', product]}}})
  const base = [{insert: [{id: 'group', name: 'official-group', group: true, disabled: false, config: [
    {id: 'meter', name: 'official-meter', disabled: true, config: {from: 'base'}},
  ]}, {id: 'untouched', name: 'other-plugin', config: {keep: 7}}]}]
  const baseFile = bundle('fixture-base', base, true)
  bundle('fixture-base', [{insert: [{id: 'wrong-copy', name: 'wrong'}]}])
  const productFile = bundle(product, [{id: 'meter', disabled: {__jsExpr: 'owned(ctx)'}},
    {insert: [{id: 'product', name: product}]}])
  const patchPath = path.join(dir, 'cordis.patch.yml')
  write(patchPath, [{id: 'meter', config: {from: 'profile'}}])
  write(path.join(home, 'cordis.patch.yml'), [{id: 'meter', config: {from: 'home'}}])
  const context = {name: 'web', dir, home, installAnchor, patchPath, cwd: root,
    startedBundles: ['fixture-base', product], telemetryDisabledEnv: undefined,
    overlays: [{id: 'meter', config: {from: 'launch'}}] as any[]}
  return {context, baseFile, productFile, profileManifest, base, write,
    bytes: () => [...files].map(file => [file, fs.readFileSync(file,'utf8')]),
    close: () => cleanupTestDirectory(root)}
}

test('product-free baseline retains lower disabled and every higher config layer without writes', () => {
  const f = fixture()
  try {
    const before = f.bytes()
    const plan = captureNextTavernProfilePlan(f.context, api)
    assert.equal(plan.selected, true)
    const intent = plan.provider(provider)!
    assert.deepEqual(intent.path, ['group','meter'])
    assert.equal(intent.row.disabled, true, 'product expression must not erase original disabled')
    assert.deepEqual(intent.row.config, {from:'launch'})
    assert.deepEqual(intent.ancestors.map(row=>row.id), ['group'])
    assert.equal(plan.rows.find(row=>row.id==='group')!.config[0].disabled.__jsExpr, 'owned(ctx)')
    assert.ok(!plan.originalRows.some(row=>row.id==='product' || row.id==='wrong-copy'))
    assert.deepEqual(plan.originalRows.find(row=>row.id==='untouched')!.config, {keep:7})
    assert.deepEqual(f.bytes(),before)
  } finally {f.close()}
})

test('disabled parents and user expressions remain native-evaluator inputs', () => {
  const f = fixture()
  try {
    f.context.overlays.push({id:'group',disabled:true}, {id:'meter',disabled:{__jsExpr:'userChoice(ctx)'}})
    const plan = captureNextTavernProfilePlan(f.context,api)
    const intent = plan.provider(provider)!
    assert.equal(intent.ancestors[0]!.disabled,true)
    assert.deepEqual(intent.row.disabled,{__jsExpr:'userChoice(ctx)'})
    // A user expression equal to a product expression is still a user layer.
    f.context.overlays.push({id:'meter',disabled:{__jsExpr:'owned(ctx)'}})
    const copied = captureNextTavernProfilePlan(f.context,api)
    assert.deepEqual(copied.provider(provider)!.row.disabled,{__jsExpr:'owned(ctx)'})
    f.context.overlays.push({id:'meter',disabled:false})
    assert.equal(captureNextTavernProfilePlan(f.context,api).provider(provider)!.row.disabled,false)
  } finally {f.close()}
})

test('one captured generation is immutable and does not silently adopt later files', () => {
  const f = fixture()
  try {
    const first = captureNextTavernProfilePlan(f.context,api)
    assert.throws(()=>{first.provider(provider)!.row.config.from='corrupt'},TypeError)
    assert.throws(()=>{first.originalPatches.push({})},TypeError)
    f.context.overlays[0].config.from='later-launch'
    f.base[0]!.insert[0]!.config[0]!.disabled=false
    f.write(f.baseFile,f.base)
    const second = captureNextTavernProfilePlan(f.context,api)
    assert.notEqual(first.version,second.version)
    assert.equal(first.provider(provider)!.row.disabled,true)
    assert.equal(first.provider(provider)!.row.config.from,'launch')
    assert.equal(second.provider(provider)!.row.disabled,false)
    assert.equal(second.provider(provider)!.row.config.from,'later-launch')
    assert.throws(()=>second.assertVersion(first.version),/composition changed/)
    second.assertVersion(second.version)
    assert.equal(captureNextTavernProfilePlan(f.context,api).version,second.version)
  } finally {f.close()}
})

test('ownership guards reject substituted and ambiguous providers and tolerate absent optional rows', () => {
  const f = fixture()
  try {
    const plan = captureNextTavernProfilePlan(f.context,api)
    assert.equal(plan.provider({id:'not-installed',module:'optional'}),undefined)
    assert.throws(()=>plan.provider({id:'meter',module:'different-module'}),/belongs to official-meter/)
    f.context.overlays.push({insert:[{id:'meter',name:'other-meter'}]})
    const duplicate = captureNextTavernProfilePlan(f.context,api)
    assert.throws(()=>duplicate.provider(provider),/Ambiguous profile row/)
  } finally {f.close()}
})

test('a deselected product leaves native rows unchanged and malformed config fails before activation', () => {
  const f = fixture()
  try {
    f.write(f.profileManifest,{private:true,dsh:{profile:{bundles:['fixture-base']}}})
    const plan = captureNextTavernProfilePlan(f.context,api)
    assert.equal(plan.selected,false)
    assert.deepEqual(plan.rows,plan.originalRows)
    assert.equal(plan.provider(provider)!.row.disabled,true)
    fs.writeFileSync(f.context.patchPath,'not a patch list')
    assert.throws(()=>captureNextTavernProfilePlan(f.context,api),/top-level YAML array/)
    assert.equal(fs.readFileSync(f.context.patchPath,'utf8'),'not a patch list')
  } finally {f.close()}
})
