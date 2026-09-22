/** Product entry lifecycle against actual alpha.7 libraries. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {test} from 'node:test'
import {fixture, nativeCase, causedBy} from './plugin-product-entry-fixture.mts'

test('root inventory admission is read-only while the official profile lock is held',async t=>{
  if(await nativeCase(t.name,import.meta.url))return
  const f=await fixture({inventory:'valid'})
  try {
    const require=createRequire(new URL('../build-tools/package.json',import.meta.url))
    const {withFileLock}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-atomic-write')).href)
    await withFileLock(f.profileManifest,async()=>{
      await f.update([{id:'meter',config:{service:'entryProbe',value:'locked-update'}}])
      assert.equal(f.ctx.get('entryProbe').value,'locked-update')
      const manifest=JSON.parse(fs.readFileSync(f.profileManifest,'utf8'))
      assert.equal(manifest.dependencies,undefined,'admission does not prepare profile references inside reload')
    })
  } finally {await f.close()}
})

test('root rejects mismatched inventories and restores native after a corrupted hot update',async t=>{
  if(await nativeCase(t.name,import.meta.url))return
  await assert.rejects(fixture({inventory:'mismatch'}),causedBy('inventory does not match'))
  const f=await fixture({inventory:'valid'})
  try {
    const inventory=path.join(f.productDir,'nexttavern.dependencies.json')
    const accepted=fs.readFileSync(inventory)
    fs.writeFileSync(inventory,JSON.stringify({schemaVersion:1,productVersion:'wrong-version',packages:[]}))
    await assert.rejects(f.update([{id:'meter',config:{service:'entryProbe',value:'must-not-load'}}]),
      causedBy('inventory does not match'))
    assert.equal(f.active.get('entryProbe'),'official')
    assert.equal(f.ctx.get('entryProbe').value,'original')
    assert.equal(f.attempts.some(attempt=>attempt.owner==='owned'&&attempt.value==='must-not-load'),false)
    fs.writeFileSync(inventory,accepted)
    await f.update([{id:'meter',config:{service:'entryProbe',value:'recovered'}}])
    assert.equal(f.ctx.get('entryProbe').value,'recovered')
  } finally {await f.close()}
})

test('product host routes share one browser source and drain before provider restoration', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const f = await fixture({hostMode:'active'})
  try {
    assert.deepEqual(f.graph().sort(), ['dsh-nexttavern','fixture-owned-provider'])
    assert.equal(f.active.get('hostRoutes'),'host')
    await f.update([{id:'nexttavern',disabled:true}])
    assert.equal(f.active.has('hostRoutes'),false)
    assert.deepEqual(f.graph(),['fixture-official-provider'])
    assert.deepEqual(f.changes,['start:owned','start:host','stop:host','stop:owned','start:official'])
    await f.update([])
    assert.equal(f.active.get('hostRoutes'),'host')
    assert.deepEqual(f.graph().sort(),['dsh-nexttavern','fixture-owned-provider'])
  } finally {await f.close()}
})

for(const hostMode of ['failed','pending'] as const) {
  test(`product refuses ${hostMode} host routes and releases its providers`, async t => {
    if (await nativeCase(t.name, import.meta.url)) return
    await assert.rejects(fixture({hostMode}),causedBy(hostMode==='failed'
      ? 'host registration failed' : 'host routes are not active'))
  })
}

test('an active addon tree with a pending nested dependency cannot complete takeover', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  await assert.rejects(fixture({pendingNestedAddon:true}),causedBy('enabled entry is not active'))
})

test('product waits for native async services awakened by its replacement provider', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const f = await fixture({lateNativeDependency:true})
  try {
    assert.equal(f.ctx.get('lateConsumer').ready,true)
    assert.equal(f.ctx.get('entryProbe').owner,'owned')
    await f.update([{id:'nexttavern',disabled:true}])
    assert.equal(f.ctx.get('lateConsumer'),undefined)
    assert.equal(f.ctx.get('entryProbe').owner,'official')
  } finally {await f.close()}
})

test('product entry mounts real child entries and restores original provider on disable', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const f = await fixture()
  try {
    assert.equal(f.active.get('entryProbe'), 'owned')
    assert.deepEqual(f.graph(), ['fixture-owned-provider'])
    assert.deepEqual(f.ctx.get('entryProbe'), {owner:'owned',value:'original'})
    await f.update([{id:'nexttavern',disabled:true}])
    assert.equal(f.active.get('entryProbe'), 'official')
    assert.deepEqual(f.graph(), ['fixture-official-provider'])
    await f.update([])
    assert.equal(f.active.get('entryProbe'), 'owned')
    assert.deepEqual(f.graph(), ['fixture-owned-provider'])
    assert.deepEqual(f.changes, ['start:owned','stop:owned','start:official','stop:official','start:owned'])
  } finally {await f.close()}
})

test('product entry respects an original disabled provider across disable and uninstall', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const f = await fixture({disabled:true})
  try {
    assert.equal(f.active.size, 0)
    assert.deepEqual(f.graph(), [])
    await f.update([{id:'nexttavern',disabled:true}])
    assert.equal(f.active.size, 0)
    await f.update([], false)
    assert.equal(f.active.size, 0)
  } finally {await f.close()}
})

test('product removal drains owned children before Include restarts originals', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const f = await fixture()
  try {
    await f.update([], false)
    assert.equal(f.active.get('entryProbe'), 'official')
    assert.deepEqual(f.graph(), ['fixture-official-provider'])
    assert.deepEqual(f.changes, ['start:owned','stop:owned','start:official'])
  } finally {await f.close()}
})

test('product reconfiguration preserves native config through replacement', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const f = await fixture()
  try {
    await f.update([{id:'meter',config:{service:'entryProbe',value:'updated'}}])
    assert.deepEqual(f.ctx.get('entryProbe'), {owner:'owned',value:'updated'})
    await f.update([{id:'meter',config:{service:'entryProbe',value:'updated'}},{id:'nexttavern',disabled:true}])
    assert.deepEqual(f.ctx.get('entryProbe'), {owner:'official',value:'updated'})
  } finally {await f.close()}
})

test('product activation failure releases resources and fails startup explicitly', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  await assert.rejects(fixture({fail:true}), causedBy('owned provider failed'))
})

test('failed product reconfiguration restores native and permits a later valid update', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const f = await fixture()
  try {
    await assert.rejects(f.update([{id:'meter',config:{service:'entryProbe',value:'reject'}}]), causedBy('owned provider failed'))
    assert.equal(f.active.get('entryProbe'), 'official')
    assert.deepEqual(f.ctx.get('entryProbe'), {owner:'official',value:'original'},
      'failed proposal must not become the native fallback configuration')
    assert.deepEqual(f.graph(), ['fixture-official-provider'])
    await f.update([{id:'meter',config:{service:'entryProbe',value:'recovered'}}])
    assert.deepEqual(f.ctx.get('entryProbe'), {owner:'owned',value:'recovered'})
    assert.deepEqual(f.graph(), ['fixture-owned-provider'])
  } finally {await f.close()}
})

test('addon failure after provider startup leaves no owned resource', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  await assert.rejects(fixture({failingAddon:true}), causedBy('addon failed'))
})

test('failed generations retry once, preserve accepted config, and respect a later disable', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const f = await fixture()
  const failedAttempts = () => f.attempts.filter(attempt => attempt.owner === 'owned' && attempt.value === 'reject').length
  const rejected = (revision: number) => [{id:'meter',config:{service:'entryProbe',value:'reject',revision}}]
  try {
    await assert.rejects(f.update(rejected(1)), causedBy('owned provider failed'))
    assert.equal(failedAttempts(), 1)
    await f.update(rejected(1))
    assert.equal(failedAttempts(), 1, 'unchanged failed generation must not retry')
    await assert.rejects(f.update(rejected(2)), causedBy('owned provider failed'))
    assert.equal(failedAttempts(), 2, 'new generation gets one attempt')
    assert.deepEqual(f.ctx.get('entryProbe'), {owner:'official',value:'original'})
    await f.update([...rejected(3), {id:'nexttavern',disabled:true}])
    assert.equal(failedAttempts(), 2, 'disabled product must not retry')
    assert.deepEqual(f.graph(), ['fixture-official-provider'])
    await f.update([{id:'meter',config:{service:'entryProbe',value:'recovered'}}])
    assert.deepEqual(f.ctx.get('entryProbe'), {owner:'owned',value:'recovered'})
    assert.equal(f.attempts.filter(attempt => attempt.owner === 'owned' && attempt.value === 'recovered').length, 1)
  } finally {await f.close()}
})

test('uninstall waits for the owned disposer before starting the original provider', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const f = await fixture({slowRelease:true})
  try {
    const removal = f.update([], false)
    await f.releaseEntered.promise
    assert.equal(f.active.get('entryProbe'), 'owned')
    assert.equal(f.changes.includes('start:official'), false)
    f.releaseGate.resolve()
    await removal
    assert.equal(f.active.get('entryProbe'), 'official')
    assert.deepEqual(f.graph(), ['fixture-official-provider'])
  } finally {await f.close()}
})

test('overlapping profile generations reject stale work and recover without dual providers', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  const f = await fixture()
  try {
    const first = f.update([{id:'meter',config:{service:'entryProbe',value:'first'}}])
    const second = f.update([{id:'meter',config:{service:'entryProbe',value:'second'}}])
    const outcomes = await Promise.allSettled([first,second])
    assert.ok(outcomes.some(outcome=>outcome.status === 'rejected'), 'stale generation must not be accepted')
    await f.update([{id:'meter',config:{service:'entryProbe',value:'confirmed'}}])
    assert.deepEqual(f.ctx.get('entryProbe'), {owner:'owned',value:'confirmed'})
    assert.equal(f.active.size, 1)
  } finally {await f.close()}
})

test('a missing private dependency never falls back to the users same-name package', async t => {
  if (await nativeCase(t.name, import.meta.url)) return
  await assert.rejects(fixture({missingOwned:true}), causedBy('resolved outside its product bundle'))
})
