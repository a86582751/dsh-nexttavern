// Author JS is card data that the reader re-runs for every committed paragraph.
// A card that registered a page-wide listener used to keep it forever, so the
// leak grew by one duplicate handler per run and every later event fanned out
// into all of them. These assertions pin the two properties that stop that:
// registration lands on the reader root, and teardown always unhooks it.
import assert from 'node:assert/strict'

function fakeTarget() {
  const registered = []
  return {
    registered,
    addEventListener(type, handler, options) { registered.push({type, handler, options}) },
    removeEventListener(type, handler) {
      const index = registered.findIndex(entry => entry.type === type && entry.handler === handler)
      if (index >= 0) registered.splice(index, 1)
    },
  }
}

const pageDocument = fakeTarget()
const pageWindow = fakeTarget()
globalThis.document = pageDocument
globalThis.window = pageWindow

const {createAuthorRuntime} = await import('../src/reader-view.js')

const settle = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// A document-level listener from a card that returns no cleanup of its own.
{
  const root = fakeTarget()
  const runtime = createAuthorRuntime(root, () => {})
  runtime.run("document.addEventListener('selectionchange', function(){})")
  assert.equal(root.registered.length, 1, 'card registration must land on the reader root')
  assert.equal(root.registered[0].type, 'selectionchange')
  assert.equal(pageDocument.registered.length, 0, 'card must not touch the real document')
  runtime.teardown()
  assert.equal(root.registered.length, 0, 'teardown must unhook what the card registered')
}

{
  const root = fakeTarget()
  const runtime = createAuthorRuntime(root, () => {})
  runtime.run("window.addEventListener('mouseup', function(){}); this.addEventListener('click', function(){})")
  assert.equal(root.registered.length, 2, 'window and `this` registrations must land on the root')
  assert.equal(pageWindow.registered.length, 0, 'card must not touch the real window')
  runtime.teardown()
  assert.equal(root.registered.length, 0)
}

// Re-running the effect must not multiply handlers. This is the regression:
// without teardown the count grew once per committed paragraph.
{
  const root = fakeTarget()
  const source = "document.addEventListener('selectionchange', function(){})"
  for (let run = 0; run < 5; run += 1) {
    const runtime = createAuthorRuntime(root, () => {})
    runtime.run(source)
    runtime.teardown()
  }
  assert.equal(root.registered.length, 0, 'repeated runs must not accumulate handlers')

  const leaked = fakeTarget()
  for (let run = 0; run < 5; run += 1) createAuthorRuntime(leaked, () => {}).run(source)
  assert.equal(leaked.registered.length, 5, 'the pre-fix shape is what accumulated the handlers')
}

// The documented contract still holds: the card gets `root` and `fill`, and a
// cleanup function it returns is still honoured.
{
  const root = fakeTarget()
  const filled = []
  const runtime = createAuthorRuntime(root, (text) => filled.push(text))
  runtime.run('root.datasetCard = 1; fill("draft")')
  assert.equal(root.datasetCard, 1, 'the card must still receive the reader root')
  assert.deepEqual(filled, ['draft'], 'the card must still receive the fill callback')

  const cleanup = runtime.run('root.cleaned = 0; return function(){ root.cleaned += 10 }')
  assert.equal(typeof cleanup, 'function', 'a returned cleanup must still be handed back to the caller')
  cleanup()
  assert.equal(root.cleaned, 10, 'the returned cleanup must still be callable')
}

// Timers a card starts must not outlive the reader.
{
  const root = fakeTarget()
  const runtime = createAuthorRuntime(root, () => {})
  runtime.run('root.ticks = 0; setInterval(function(){ root.ticks += 1 }, 5)')
  await settle(40)
  const during = root.ticks
  assert.ok(during > 0, 'the card timer must actually run')
  runtime.teardown()
  await settle(40)
  assert.equal(root.ticks, during, 'teardown must clear the card timers')
}

// A card that throws must not leave the runtime unusable or leak the error.
{
  const root = fakeTarget()
  const runtime = createAuthorRuntime(root, () => {})
  assert.throws(() => runtime.run('throw new Error("card bug")'), /card bug/)
  runtime.teardown()
  assert.equal(root.registered.length, 0)
}

console.log('reader-author-js=ok')
