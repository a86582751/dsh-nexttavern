/** Product entry lifecycle against actual alpha.6 libraries. */
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {fixture, nativeCase, causedBy} from './plugin-product-entry-fixture.mts'

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
