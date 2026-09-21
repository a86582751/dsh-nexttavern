/** Real product Loader + owned storage/controller/meter, without a Harness install. */
import assert from 'node:assert/strict'
import {test} from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {fixture, nativeCase, causedBy} from './plugin-product-entry-fixture.mts'
import {prepareControllerHost} from './plugin-fork-controller-fixture.mts'

const require=createRequire(new URL('../build-tools/package.json',import.meta.url))
const upstream=(name: string)=>pathToFileURL(require.resolve('@deepseek-ai/'+name)).href
// Explicit artifacts let the public projector retarget each package location.
const packageSources=[
  new URL('../development/session-format/package.json',import.meta.url),
  new URL('../development/session-persistence-jsonl/package.json',import.meta.url),
  new URL('../development/session-controller/package.json',import.meta.url),
  new URL('../development/token-meter/package.json',import.meta.url),
]

async function sessionsFixture(formatMode: 'delayed' | 'failed' | 'missing' | 'disabled' = 'delayed',
  restoredNative?: Set<string>) {
  const entered=Promise.withResolvers<void>()
  const release=Promise.withResolvers<void>()
  const published: string[]=[]
  let host: any
  let directory=''
  let Format: any
  const pending=fixture({prepareProvider:async (product,profile)=>{
    const modules=path.join(product,'node_modules')
    for(const metadataUrl of packageSources) {
      const source=path.dirname(fileURLToPath(metadataUrl))
      const metadata=JSON.parse(fs.readFileSync(metadataUrl,'utf8'))
      const target=path.join(modules,metadata.name)
      fs.mkdirSync(target,{recursive:true})
      fs.copyFileSync(path.join(source,'package.json'),path.join(target,'package.json'))
      fs.cpSync(path.join(source,'lib'),path.join(target,'lib'),{recursive:true})
    }
    for(const peer of ['zod','mime-types','koffi']) {
      fs.symlinkSync(fileURLToPath(new URL('../build-tools/node_modules/'+peer,import.meta.url)),path.join(modules,peer),'junction')
    }
    const load=createRequire(path.join(product,'package.json'))
    // Preload real modules, then hold only the format activation. Providers
    // must remain inactive until Cordis sees their required edit service.
    Format=await import(pathToFileURL(load.resolve('dsh-nexttavern-session-format')).href)
    await import(pathToFileURL(load.resolve('dsh-nexttavern-session-controller')).href)
    await import(pathToFileURL(load.resolve('dsh-nexttavern-session-persistence-jsonl')).href)
    const delayed=path.join(product,'delayed-format.mjs')
    fs.writeFileSync(delayed, `import * as Format from 'dsh-nexttavern-session-format';
      export const inject=['sessions'];
      export async function apply(ctx) {
        ctx.productSessionProbe.enter(); await ctx.productSessionProbe.wait;
        if (${formatMode==='failed'}) throw Error('format activation failed');
        await ctx.plugin(Format);
      }`)
    directory=path.join(profile,'session-fixture')
    return {id:'session-persistence-jsonl',original:upstream('dsh-session-persistence-jsonl'),
      replacement:'dsh-nexttavern-session-persistence-jsonl',config:{root:path.join(directory,'logs'),compression:'none'},
      additional:[
        {id:'session-controller',original:upstream('dsh-api-session-controller'),replacement:'dsh-nexttavern-session-controller',config:{nativeOpen:false}},
        {id:'token-meter',original:upstream('dsh-token-meter'),replacement:'dsh-nexttavern-token-meter',config:{}},
      ],
      addons:formatMode==='missing'?[]:[{id:'nexttavern-message-edits',name:pathToFileURL(delayed).href,
        disabled:formatMode==='disabled'}],
      async initialize(ctx) {
        host=ctx
        await prepareControllerHost(ctx,{directory,deferPersistence:true})
        ctx.provide('productSessionProbe',{enter:()=>entered.resolve(),wait:release.promise})
        ctx.on('internal/service',(name: string,value: unknown)=>{
          if(value&&['nexttavernMessageEdits','sessionPersistence','sessionController'].includes(name))published.push(name)
          if(value&&name==='sessionController'&&typeof (value as any).forkPrepared!=='function')restoredNative?.add(name)
          if(value&&name==='sessionPersistence'&&(value as any).name!=='nexttavern-session-persistence-jsonl')restoredNative?.add(name)
        })
      },
    }
  }})
  // A failed initial import must reject rather than leave this test waiting on
  // an addon which will never run; always release our own gate on failure.
  try {
    if(formatMode==='missing'||formatMode==='disabled') {
      await pending
      throw Error('missing edit interpreter was accepted')
    }
    await Promise.race([entered.promise,pending.then(()=>{throw Error('format gate was bypassed')})])
    await new Promise<void>(resolve=>setImmediate(resolve))
    assert.equal(host.get('sessionPersistence'),undefined)
    assert.equal(host.get('sessionController'),undefined)
    release.resolve()
    return {...await pending,Format,directory,published}
  } catch(error) {
    release.resolve()
    const started=await pending.catch(()=>undefined)
    if(started)await started.close()
    throw error
  }
}

test('product storage and Controller wait for edit interpretation, restore cold prose, and return to native on disable', async t=>{
  if(await nativeCase(t.name,import.meta.url))return
  const f=await sessionsFixture()
  try {
    assert.equal(f.published[0],'nexttavernMessageEdits')
    assert.ok(f.published.includes('sessionPersistence'))
    assert.ok(f.published.includes('sessionController'))
    assert.equal(typeof f.ctx.sessionController.forkPrepared,'function')
    const handle=await f.ctx.agents.create({sessionId:'product-story',meta:{cwd:f.directory,agentPreset:'probe'},
      setup:async (scope: any)=>{await f.ctx.agentPresets.mount(scope,'probe')}})
    const session=handle.agent.session
    session.append('turn/start',{turn:1})
    const message=session.append('user/message',{id:'player',role:'user',content:[{type:'text',text:'Original prompt'}],
      source:{kind:'user'}},{surfaceOp:'append'})
    f.Format.appendMessageEdit(session,message.seq,{role:'user',messageId:'player'},'Edited prompt')
    session.append('turn/end',{turn:1,reason:{kind:'completed'}})
    await f.ctx.sessions.flush(session)
    await handle.dispose()
    {
      using observation=await f.ctx.sessionQuery.observeSession('product-story')
      assert.equal(observation.events.filter((event: any)=>event.type==='roleplay/message-edit').length,1)
    }
    const restored=await f.ctx.sessionController.resolveAgent('product-story')
    assert.ok(restored.agent,restored.error?.message)
    assert.equal(restored.agent.session.deriveEventMessage(restored.agent.session.eventAt(message.seq)).content[0].text,'Edited prompt')
    const before=fs.readFileSync(f.ctx.sessionPersistence.locate(restored.agent.session.header).path)
    const pendingMessage=restored.agent.session.append('user/message',{id:'pending-player',role:'user',
      content:[{type:'text',text:'Persist during disable'}],source:{kind:'user'}},{surfaceOp:'append'})
    await f.update([{id:'nexttavern',disabled:true}])
    assert.equal(f.ctx.get('nexttavernMessageEdits'),undefined)
    assert.equal(f.ctx.agents.get('product-story'),undefined,'owned Controller retires its restored Agent')
    assert.equal(f.ctx.sessionController.forkPrepared,undefined)
    const after=fs.readFileSync(f.ctx.sessionPersistence.locate(restored.agent.session.header).path)
    assert.deepEqual(after.subarray(0,before.length),before,'shutdown preserves the accepted log prefix')
    const normal=await f.ctx.agents.create({sessionId:'native-story',meta:{cwd:f.directory,agentPreset:'probe'},
      setup:async (scope: any)=>{await f.ctx.agentPresets.mount(scope,'probe')}})
    await normal.dispose()
    await f.update([])
    const reopened=await f.ctx.sessionController.resolveAgent('product-story')
    assert.ok(reopened.agent,reopened.error?.message)
    assert.equal(reopened.agent.session.deriveEventMessage(reopened.agent.session.eventAt(message.seq)).content[0].text,'Edited prompt')
    assert.equal(reopened.agent.session.eventAt(pendingMessage.seq).data.content[0].text,'Persist during disable')
  } finally {await f.close()}
})

test('failed edit activation releases waiting product providers without hanging shutdown', {timeout:10000}, async t=>{
  if(await nativeCase(t.name,import.meta.url))return
  await assert.rejects(sessionsFixture('failed'),causedBy('format activation failed'))
})

for(const mode of ['missing','disabled'] as const) {
  test(`product refuses a ${mode} edit addon and restores native providers`, {timeout:10000}, async t=>{
    if(await nativeCase(t.name,import.meta.url))return
    const native=new Set<string>()
    await assert.rejects(sessionsFixture(mode,native),causedBy('enabled entry is not active'))
    assert.ok(native.has('sessionPersistence'),'native storage restored before cleanup')
    assert.ok(native.has('sessionController'),'native Controller restored before cleanup')
  })
}
