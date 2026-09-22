/** Actual declaration rows mounted through the product's native Loader subtree. */
import assert from 'node:assert/strict'
import {test} from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {fixture, nativeCase, causedBy} from './plugin-product-entry-fixture.mts'
import {roleplayPresetEntry} from '../development/presets/lib/index.js'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const load = (name: string) => import(pathToFileURL(require.resolve('@deepseek-ai/'+name)).href)
const {default: SessionStore} = await load('dsh-session')
const {default: Projections} = await load('dsh-session-projection')
const {default: TypertRegistry} = await load('dsh-typert-registry')
const {default: SystemPrompt} = await load('dsh-system-prompt')
const {createScope} = await load('dsh-scope')
const {default: PresetRegistry, livePresetMounts, standingMountFor} = await load('dsh-agent-preset-registry')
const {default: AgentPreset} = await load('dsh-agent-preset')

function presetFixture(conflict = false, pathProbe?: Record<string, unknown>) {
  return fixture({prepareAddons: async productRoot => {
    const save = (file: string, value: string) => {
      fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, value)
    }
    const pkg = path.join(productRoot, 'node_modules/dsh-nexttavern-presets')
    for (const file of ['package.json', 'lib/index.js', 'lib/composition.js']) {
      save(path.join(pkg, file), fs.readFileSync(new URL('../development/presets/'+file, import.meta.url), 'utf8'))
    }
    let presetBody = JSON.stringify([{id: 'persona', name: '@deepseek-ai/dsh-persona', config: {
      prefix: 'Product preset probe', complete: true, includeRuntimeContext: false,
    }}])
    if (pathProbe) {
      const fullPreset = fs.readFileSync(new URL('../preset/agent.cordis.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
      const row = (id: string) => {
        const start = fullPreset.indexOf('- id: '+id+'\n')
        assert.ok(start >= 0, 'canonical preset row: '+id)
        const end = fullPreset.indexOf('\n- id: ', start+1)
        return fullPreset.slice(start, end < 0 ? undefined : end)
      }
      // Real resource expressions and office identity; observers inspect paths,
      // while actual tools and DOCX remain part of full Harness acceptance.
      presetBody = row('skill-filesystem').replace('@deepseek-ai/dsh-skill-filesystem', 'nexttavern-skill-probe')
        +'\n'+row('dsh-office')
      for (const [name, body] of [
        ['nexttavern-skill-probe', "ctx.emit('nexttavern/preset-path', {skills:config.customSkillDirs[0]})"],
        ['@huiliyi37/dsh-office', "ctx.emit('nexttavern/preset-path', {office:config.enable.docx})"],
      ]) {
        const folder = path.join(productRoot, 'node_modules', name!)
        save(path.join(folder, 'package.json'), JSON.stringify({name, type: 'module', main: 'index.js'}))
        save(path.join(folder, 'index.js'), `export function apply(ctx, config) { ${body} }`)
      }
      save(path.join(productRoot, 'preset/skills/path-probe/SKILL.md'), '# Bundled skill path probe')
    }
    save(path.join(productRoot, 'preset/agent.cordis.yml'), presetBody)
    return {rows: [roleplayPresetEntry], peers: {'@deepseek-ai/dsh-agent-preset': '0.1.7-alpha.1'},
      async initialize(ctx: any) {
        if (pathProbe) ctx.on('nexttavern/preset-path', (value: object) => Object.assign(pathProbe, value))
        await ctx.plugin(SessionStore)
        await ctx.plugin(Projections)
        await ctx.plugin(TypertRegistry)
        await ctx.plugin(SystemPrompt, {includeHarnessIdentity: false, includeRuntimeContext: false, persona: ''})
        await ctx.plugin(PresetRegistry, {default: 'custom', selectedDefault: 'custom', modeSelectionEnabled: false})
        await ctx.plugin(AgentPreset, {id: 'custom', plugins: []})
        if (conflict) await ctx.plugin(AgentPreset, {id: 'roleplay', name: 'Player preset', plugins: []})
      },
    }
  }})
}

test('ordinary product declaration retains registry policy and live Agents across product disable', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const f = await presetFixture(), a = createScope(f.ctx, {}), b = createScope(f.ctx, {})
  try {
    const roster = await f.ctx.agentPresets.remoteExportList()
    assert.equal(f.ctx.agentPresets.defaultId, 'custom')
    assert.equal(roster.modeSelectionEnabled, false)
    const roleplay = await f.ctx.agentPresets.resolve('roleplay')
    assert.equal((await f.ctx.agentPresets.list()).find((p: any) => p.id === 'roleplay')?.name, 'NextTavern')
    assert.equal(roleplay.broken, undefined)
    await Promise.all([f.ctx.agentPresets.mount(a.ctx, 'roleplay'), f.ctx.agentPresets.mount(b.ctx, 'roleplay')])
    const original = standingMountFor(a.ctx)?.fiber
    assert.ok(original)
    assert.equal(original, standingMountFor(b.ctx)?.fiber)
    assert.equal(livePresetMounts(f.ctx.fiber).filter((m: any) => m.presetId === 'roleplay').length, 1)
    await f.update([{id: 'nexttavern', disabled: true}])
    assert.equal((await f.ctx.agentPresets.list()).some((p: any) => p.id === 'roleplay'), false)
    assert.equal(standingMountFor(a.ctx)?.fiber, original, 'live Agents retain their declared generation')
    assert.equal(f.ctx.agentPresets.defaultId, 'custom')
    await f.update([])
    const c = createScope(f.ctx, {})
    try {
      await f.ctx.agentPresets.mount(c.ctx, 'roleplay')
      assert.notEqual(standingMountFor(c.ctx)?.fiber, original, 'new Agents use the re-enabled declaration')
    } finally { await c.dispose() }
  } finally { await a.dispose(); await b.dispose(); await f.close() }
})

test('product declaration does not shadow a pre-existing player preset identity', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  await assert.rejects(presetFixture(true), causedBy('Duplicate agent preset: roleplay'))
})

test('declaration resource paths and office resolve from a relocated product', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const observed: Record<string, any> = {}, f = await presetFixture(false, observed)
  const scope = createScope(f.ctx, {})
  try {
    const roleplay = await f.ctx.agentPresets.resolve('roleplay')
    assert.equal(roleplay.broken, undefined)
    await f.ctx.agentPresets.mount(scope.ctx, 'roleplay')
    assert.ok(fs.existsSync(path.join(observed.skills, 'path-probe/SKILL.md')))
    assert.equal(observed.office, true)
  } finally { await scope.dispose(); await f.close() }
})
