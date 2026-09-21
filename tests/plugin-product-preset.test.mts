/** Actual preset roster mounted through the product's Loader subtree. */
import assert from 'node:assert/strict'
import {test} from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {fixture, nativeCase, causedBy} from './plugin-product-entry-fixture.mts'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const load = (name: string) => import(pathToFileURL(require.resolve('@deepseek-ai/'+name)).href)
const {default: SessionStore} = await load('dsh-session')
const {default: Projections} = await load('dsh-session-projection')
const {default: TypertRegistry} = await load('dsh-typert-registry')
const {default: SystemPrompt} = await load('dsh-system-prompt')
const {createScope} = await load('dsh-scope')
const {livePresetMounts, standingMountFor} = await load('dsh-agent-presets')

function presetFixture(conflict = false, aliasTrust?: 'user' | 'system', pathProbe?: Record<string, any>) {
  return fixture({prepareProvider: async (productRoot, profileRoot) => {
    const save = (file: string, value: string) => {
      fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value)
    }
    const pkg = path.join(productRoot,'node_modules/dsh-nexttavern-presets')
    save(path.join(pkg,'package.json'), fs.readFileSync(new URL('../development/presets/package.json',import.meta.url),'utf8'))
    save(path.join(pkg,'lib/index.js'), fs.readFileSync(new URL('../development/presets/lib/index.js',import.meta.url),'utf8'))
    save(path.join(pkg,'lib/composition.js'), fs.readFileSync(new URL('../development/presets/lib/composition.js',import.meta.url),'utf8'))
    const catalog = path.join(productRoot,'preset/catalog/roleplay')
    save(path.join(catalog,'agent.cordis.yml'), fs.readFileSync(new URL('../preset/catalog/roleplay/agent.cordis.yml',import.meta.url),'utf8'))
    save(path.join(catalog,'preset.yml'), fs.readFileSync(new URL('../preset/catalog/roleplay/preset.yml',import.meta.url),'utf8'))
    // Keep the real include adapter but use a tiny model-facing composition.
    // Full roleplay business is reserved for the sole installed Harness.
    const composition = JSON.stringify([{id:'persona',name:'@deepseek-ai/dsh-persona',config:{
      prefix:'Product preset probe',complete:true,includeRuntimeContext:false,
    }}])
    let presetBody=composition
    if (pathProbe) {
      const fullPreset=fs.readFileSync(new URL('../preset/agent.cordis.yml',import.meta.url),'utf8').replace(/\r\n/g,'\n')
      const row=(id: string)=>{
        const start=fullPreset.indexOf('- id: '+id+'\n')
        assert.ok(start>=0,'canonical preset row: '+id)
        const end=fullPreset.indexOf('\n- id: ',start+1)
        return fullPreset.slice(start,end<0?undefined:end)
      }
      // Keep the actual YAML expressions and office package name. These tiny
      // observers test Loader path resolution, not skill discovery or DOCX I/O.
      presetBody=row('skill-filesystem').replace('@deepseek-ai/dsh-skill-filesystem','nexttavern-skill-probe')
        +'\n'+row('dsh-office')
      for (const [name,body] of [
        ['nexttavern-skill-probe',"ctx.emit('nexttavern/preset-path', {skills:config.customSkillDirs[0]})"],
        ['@huiliyi37/dsh-office',"ctx.emit('nexttavern/preset-path', {office:config.enable.docx})"],
      ]) {
        const folder=path.join(productRoot,'node_modules',name)
        save(path.join(folder,'package.json'),JSON.stringify({name,type:'module',main:'index.js'}))
        save(path.join(folder,'index.js'),`export function apply(ctx, config) { ${body} }`)
      }
      save(path.join(productRoot,'preset/skills/path-probe/SKILL.md'),'# Bundled skill path probe')
    }
    save(path.join(productRoot,'preset/agent.cordis.yml'),presetBody)
    const userRoot=path.join(path.dirname(path.dirname(profileRoot)),'.agent-presets')
    save(path.join(userRoot,'custom/agent.cordis.yml'),composition)
    if(conflict) save(path.join(userRoot,'roleplay/agent.cordis.yml'),composition)
    const roots = [{path:userRoot,trust:'user'}]
    if (aliasTrust) {
      const alias = path.join(profileRoot,'catalog-alias')
      fs.symlinkSync(path.dirname(catalog),alias,'junction')
      roots.unshift({path:alias,trust:aliasTrust})
    }
    return {original:pathToFileURL(require.resolve('@deepseek-ai/dsh-agent-presets')).href,
      replacement:'dsh-nexttavern-presets', config:{default:'custom',roots,
        includeShippedRoot:true,includeUserRoot:false},
      async initialize(ctx) {
        if(pathProbe)ctx.on('nexttavern/preset-path',(value: object)=>Object.assign(pathProbe,value))
        await ctx.plugin(SessionStore)
        await ctx.plugin(Projections)
        await ctx.plugin(TypertRegistry)
        await ctx.plugin(SystemPrompt,{includeHarnessIdentity:false,includeRuntimeContext:false,persona:''})
      },
    }
  }})
}

test('product preset roster retains defaults and mounts one shared roleplay composition', async t => {
  if(await nativeCase(t.name,import.meta.url))return
  const f=await presetFixture()
  const a=createScope(f.ctx,{}),b=createScope(f.ctx,{})
  try {
    const roster=await f.ctx.agentPresets.list()
    for(const id of ['standard','minimal','custom','roleplay']) assert.ok(roster.some(p=>p.id===id),id)
    assert.equal(f.ctx.agentPresets.defaultId,'custom')
    const roleplay=roster.find(p=>p.id==='roleplay')!
    assert.equal(roleplay.trust,'system')
    assert.equal(roleplay.name,'NextTavern')
    assert.equal(roleplay.broken,undefined)
    await Promise.all([f.ctx.agentPresets.mount(a.ctx,'roleplay'),f.ctx.agentPresets.mount(b.ctx,'roleplay')])
    assert.ok(standingMountFor(a.ctx))
    assert.ok(standingMountFor(b.ctx))
    assert.equal(standingMountFor(a.ctx)?.fiber,standingMountFor(b.ctx)?.fiber)
    assert.equal(livePresetMounts(f.ctx.fiber).filter(m=>m.presetId==='roleplay').length,1)
    const rosterExport=await f.ctx.agentPresets.remoteExportList()
    assert.ok(rosterExport)
    await f.update([{id:'nexttavern',disabled:true}])
    assert.equal(livePresetMounts(f.ctx.fiber).length,0,'owned standing mounts released')
    assert.equal((await f.ctx.agentPresets.list()).some(p=>p.id==='roleplay'),false)
    assert.equal(f.ctx.agentPresets.defaultId,'custom')
    await f.update([])
    assert.equal((await f.ctx.agentPresets.resolve('roleplay')).trust,'system')
  } finally {await a.dispose();await b.dispose();await f.close()}
})

test('product preset refuses to shadow an existing user roleplay composition', async t => {
  if(await nativeCase(t.name,import.meta.url))return
  await assert.rejects(presetFixture(true),causedBy('cannot shadow existing roleplay preset'))
})

test('product preset rejects a writable alias of its own catalog', async t => {
  if(await nativeCase(t.name,import.meta.url))return
  await assert.rejects(presetFixture(false,'user'),causedBy('cannot use a writable root'))
})

test('a system catalog alias keeps official removal read-only and user presets writable', async t => {
  if(await nativeCase(t.name,import.meta.url))return
  const f=await presetFixture(false,'system')
  try {
    const roleplay=await f.ctx.agentPresets.resolve('roleplay')
    const before=fs.readFileSync(roleplay.path,'utf8')
    assert.equal(roleplay.trust,'system')
    await assert.rejects(f.ctx.agentPresets.remove('roleplay'),/cannot be written/)
    assert.equal(fs.readFileSync(roleplay.path,'utf8'),before)
    await f.ctx.agentPresets.remove('custom')
    assert.equal((await f.ctx.agentPresets.list()).some(p=>p.id==='custom'),false)
  } finally {await f.close()}
})

test('canonical preset paths survive a relocated product and an official user copy', async t => {
  if(await nativeCase(t.name,import.meta.url))return
  const observed: Record<string, any>={}
  const f=await presetFixture(false,undefined,observed)
  const scope=createScope(f.ctx,{})
  try {
    const original=await f.ctx.agentPresets.resolve('roleplay')
    const expected=path.resolve(path.dirname(original.path),'../../skills')
    await f.ctx.agentPresets.copy('roleplay','portable-copy','Portable copy')
    await f.ctx.agentPresets.mount(scope.ctx,'portable-copy')
    assert.equal(path.resolve(observed.skills),expected)
    assert.ok(fs.existsSync(path.join(observed.skills,'path-probe/SKILL.md')))
    assert.equal(observed.office,true,'office resolves from the product dependency tree')
  } finally {await scope.dispose();await f.close()}
})

test('official preset copy keeps the package-addressed roleplay composition mountable', async t => {
  if(await nativeCase(t.name,import.meta.url))return
  const f=await presetFixture()
  const copyScope=createScope(f.ctx,{})
  try {
    await f.ctx.agentPresets.copy('roleplay','my-tavern','My Tavern')
    const copy=await f.ctx.agentPresets.resolve('my-tavern')
    assert.equal(copy.trust,'user')
    assert.equal(copy.name,'My Tavern')
    assert.equal(copy.broken,undefined)
    await f.ctx.agentPresets.mount(copyScope.ctx,'my-tavern')
    assert.equal(standingMountFor(copyScope.ctx)?.presetId,'my-tavern')
    const before=fs.readFileSync(copy.path,'utf8')
    await f.update([],false)
    assert.equal(fs.readFileSync(copy.path,'utf8'),before,'uninstall preserves user copies')
    assert.equal(livePresetMounts(f.ctx.fiber).length,0)
    assert.equal(f.ctx.agentPresets.defaultId,'custom')
  } finally {await copyScope.dispose();await f.close()}
})

test('native Agent setup joins the product preset before publication and normal creation works after disable', async t => {
  if(await nativeCase(t.name,import.meta.url))return
  const f=await presetFixture()
  const {default: Tools}=await load('dsh-tools')
  const {default: Llm}=await load('dsh-llm')
  const {default: Agents,assembleContextFor}=await load('dsh-agent')
  const {default: Loop}=await load('dsh-agent-loop')
  const {renderPrompt}=await load('dsh-system-prompt')
  try {
    await f.ctx.plugin(Tools)
    await f.ctx.plugin(Llm)
    await f.ctx.plugin(Agents)
    await f.ctx.plugin(Loop,{agents:[]})
    const observed: string[]=[]
    f.ctx.on('agent/created',({agent}: any)=>{
      observed.push(standingMountFor(agent.ctx)?.presetId ?? 'missing')
    })
    const roleplay=await f.ctx.agents.create({sessionId:'entry-roleplay',meta:{agentPreset:'roleplay'},
      setup:async (scope: any)=>{await f.ctx.agentPresets.mount(scope,'roleplay')}})
    assert.deepEqual(observed,['roleplay'])
    const prompt=await f.ctx.systemPrompt.assemble(assembleContextFor(roleplay.agent))
    assert.match(renderPrompt(prompt),/Product preset probe/)
    await roleplay.dispose()
    await f.update([{id:'nexttavern',disabled:true}])
    const normal=await f.ctx.agents.create({sessionId:'entry-normal',meta:{agentPreset:'custom'},
      setup:async (scope: any)=>{await f.ctx.agentPresets.mount(scope)}})
    assert.deepEqual(observed,['roleplay','custom'])
    await normal.dispose()
  } finally {await f.close()}
})
