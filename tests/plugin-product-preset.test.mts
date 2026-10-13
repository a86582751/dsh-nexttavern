/** Actual declaration rows mounted through the product's native Loader subtree. */
import assert from 'node:assert/strict'
import {test} from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {fixture, nativeCase, causedBy} from './plugin-product-entry-fixture.mts'
import {roleplayPresetEntry} from '../development/presets/lib/index.js'
import type {PatchOptions} from '@deepseek-ai/cordis-plugin-include'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const load = (name: string) => import(pathToFileURL(require.resolve('@deepseek-ai/'+name)).href)
const {default: SessionStore} = await load('dsh-session')
const {default: Projections} = await load('dsh-session-projection')
const {default: TypertRegistry} = await load('dsh-typert-registry')
const {default: SystemPrompt} = await load('dsh-system-prompt')
const {createScope} = await load('dsh-scope')
const {default: PresetRegistry, livePresetMounts, standingMountFor} = await load('dsh-agent-preset-registry')
const {default: AgentPreset} = await load('dsh-agent-preset')
const {entryListSchema} = await load('cordis-plugin-include')
const yaml = createRequire(require.resolve('@deepseek-ai/cordis-plugin-include'))('js-yaml')

interface CorePatchProbe {
  deadline?: number
  received: Record<string, unknown>[]
  original?: Record<string, unknown>
  presetFile?: string
  before?: Buffer
}

function presetFixture(conflict = false, pathProbe?: Record<string, unknown>, coreProbe?: CorePatchProbe) {
  return fixture({prepareAddons: async productRoot => {
    const save = (file: string, value: string) => {
      fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, value)
    }
    const pkg = path.join(productRoot, 'node_modules/dsh-nexttavern-presets')
    for (const file of ['package.json', 'lib/index.js', 'lib/composition.js']) {
      save(path.join(pkg, file), fs.readFileSync(new URL('../development/presets/'+file, import.meta.url), 'utf8'))
    }
    const fullPreset = fs.readFileSync(new URL('../preset/agent.cordis.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    const personaStart = fullPreset.indexOf('- id: persona\n')
    const personaEnd = fullPreset.indexOf('\n- id: ', personaStart+1)
    assert.ok(personaStart >= 0 && personaEnd > personaStart)
    let presetBody = fullPreset.slice(personaStart, personaEnd)
    const declaration = structuredClone(roleplayPresetEntry)
    if (coreProbe) {
      // Build only this adapter into the disposable fixture. Canonical mirrors
      // remain owned by the repository's normal module generation step.
      const {transform} = require('esbuild')
      const compiled = await transform(fs.readFileSync(new URL('../development/presets/src/composition.ts', import.meta.url), 'utf8'), {
        loader: 'ts', format: 'esm', target: 'node24',
      })
      save(path.join(pkg, 'lib/composition.js'), compiled.code)
      const rows = yaml.load(fullPreset, {schema: entryListSchema}) as any[]
      const roleplay = rows.find(row => row.id === 'roleplay')
      const core = roleplay.config.find((row: any) => row.id === 'roleplay-core')
      coreProbe.original = structuredClone(core.config)
      // Keep the actual core row and isolation group. A tiny child records the
      // received config; the real core request hook is covered by tavern-loop.
      presetBody = yaml.dump([{...roleplay, config: [core]}], {schema: entryListSchema})
      save(path.join(productRoot, 'preset/lib/core/roleplay-core.js'),
        "export function apply(ctx, config) { ctx.emit('nexttavern/core-config', structuredClone(config)); }")
      const composition = declaration.config.plugins[0] as {
        id: string; name: string; config?: {patches: PatchOptions[]}
      }
      composition.config = {patches: coreProbe.deadline === undefined ? [] : [{
        id: 'roleplay-core', name: core.name,
        // Include replaces config wholesale. Restate the shipped explicit
        // values so widening one deadline cannot shorten the other workers.
        config: {...core.config, firstResponseTimeoutMs: coreProbe.deadline},
      }]}
    }
    if (pathProbe) {
      const fullPreset = fs.readFileSync(new URL('../preset/agent.cordis.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
      const row = (id: string) => {
        const start = fullPreset.indexOf('- id: '+id+'\n')
        assert.ok(start >= 0, 'canonical preset row: '+id)
        const end = fullPreset.indexOf('\n- id: ', start+1)
        return fullPreset.slice(start, end < 0 ? undefined : end)
      }
      // Real resource expressions and owned reader identity; actual document
      // conversion remains covered by the anydoc contract and Harness acceptance.
      presetBody = row('skill-filesystem').replace('@deepseek-ai/dsh-skill-filesystem', 'nexttavern-skill-probe')
        +'\n'+row('anydoc')
      for (const [name, body] of [
        ['nexttavern-skill-probe', "ctx.emit('nexttavern/preset-path', {skills:config.customSkillDirs[0]})"],
        ['dsh-nexttavern-anydoc', "ctx.emit('nexttavern/preset-path', {reader:'dsh-nexttavern-anydoc'})"],
      ]) {
        const folder = path.join(productRoot, 'node_modules', name!)
        save(path.join(folder, 'package.json'), JSON.stringify({name, type: 'module', main: 'index.js'}))
        save(path.join(folder, 'index.js'), `export function apply(ctx, config) { ${body} }`)
      }
      save(path.join(productRoot, 'preset/skills/path-probe/SKILL.md'), '# Bundled skill path probe')
    }
    save(path.join(productRoot, 'preset/agent.cordis.yml'), presetBody)
    if (coreProbe) {
      coreProbe.presetFile = path.join(productRoot, 'preset/agent.cordis.yml')
      coreProbe.before = fs.readFileSync(coreProbe.presetFile)
    }
    return {rows: [declaration], peers: {'@deepseek-ai/dsh-agent-preset': '0.1.7-rc.2'},
      async initialize(ctx: any) {
        if (pathProbe) ctx.on('nexttavern/preset-path', (value: object) => Object.assign(pathProbe, value))
        if (coreProbe) ctx.on('nexttavern/core-config', (value: Record<string, unknown>) => coreProbe.received.push(value))
        await ctx.plugin(SessionStore)
        await ctx.plugin(Projections)
        await ctx.plugin(TypertRegistry)
        await ctx.plugin(SystemPrompt, {includeHarnessIdentity: false, includeRuntimeContext: false, persona: ''})
        // rc.2 retired the mode-selection switch; a profile patch that still carries
        // the field must keep mounting, and the saved default governs new sessions.
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
    assert.equal(roster.modeSelectionEnabled, undefined, 'the retired selection switch is no longer published')
    assert.equal(roster.presets.find((p: any) => p.id === 'custom')?.isDefault, true)
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

test('declaration resource paths and owned document reader resolve from a relocated product', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const observed: Record<string, any> = {}, f = await presetFixture(false, observed)
  const scope = createScope(f.ctx, {})
  try {
    const roleplay = await f.ctx.agentPresets.resolve('roleplay')
    assert.equal(roleplay.broken, undefined)
    await f.ctx.agentPresets.mount(scope.ctx, 'roleplay')
    assert.ok(fs.existsSync(path.join(observed.skills, 'path-probe/SKILL.md')))
    assert.equal(observed.reader, 'dsh-nexttavern-anydoc')
  } finally { await scope.dispose(); await f.close() }
})

test('nested composition patches preserve core configuration and the installed preset', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  for (const deadline of [undefined, 600000]) {
    const observed: CorePatchProbe = {deadline, received: []}
    const f = await presetFixture(false, undefined, observed)
    const scope = createScope(f.ctx, {})
    try {
      const preset = await f.ctx.agentPresets.resolve('roleplay')
      assert.equal(preset.broken, undefined)
      await f.ctx.agentPresets.mount(scope.ctx, 'roleplay')
      const expected = deadline === undefined ? observed.original : {...observed.original, firstResponseTimeoutMs: deadline}
      assert.deepEqual(observed.received, [expected], 'nested composition patches must reach the actual included core row')
      assert.equal(observed.received[0]!.sceneWorkerTimeoutMs, 60000)
      assert.equal(observed.received[0]!.memoryWorkerTimeoutMs, 60000)
      assert.equal(observed.received[0]!.phaseATimeoutMs, 90000)
      assert.equal(observed.received[0]!.phaseBTimeoutMs, 120000)
      assert.deepEqual(fs.readFileSync(observed.presetFile!), observed.before, 'mounting patches must not write the owned preset')
    } finally {
      try {
        await scope.dispose()
        assert.deepEqual(fs.readFileSync(observed.presetFile!), observed.before, 'disposal must not persist patched config')
      } finally { await f.close() }
    }
  }
})
