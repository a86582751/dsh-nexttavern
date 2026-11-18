// Card JavaScript must never run with the page's DOM, globals or fill callback.
import assert from 'node:assert/strict'
import {after} from 'node:test'
import {installSchemaTestDependencies} from './mvu-schema-test-dependencies-fixture.mts'

after(installSchemaTestDependencies())

let touched = 0
const root = {ownerDocument: {defaultView: globalThis}}
const {createAuthorRuntime} = await import('../lib/ui/reader-view.js')
const runtime = createAuthorRuntime(root, () => { touched++ })
for (const source of [
  'root.ownerDocument.defaultView.touched = true',
  'globalThis.touched = true',
  'fill("draft")',
  'setInterval(() => {}, 1)',
  'eval("globalThis.touched = true")',
  'root.constructor.constructor("return globalThis")()',
]) {
  assert.throws(() => runtime.run(source), /只能在隔离阅读视图执行/)
}
assert.equal(touched, 0)
assert.equal(globalThis.touched, undefined)
assert.equal(runtime.run('   '), null)
runtime.teardown()
runtime.teardown()
console.log('reader-author-js=host-entry-closed')

// The same controller used by ReaderView rejects results from an obsolete session/rule scope.
const {createReaderBeautyCache} = await import('../lib/ui/reader-beauty.js')
const deferredBeauty = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return {promise, resolve, reject}
}
const finishBeauty = () => new Promise(resolve => setImmediate(resolve))
const requests = [], rules = [{match: 'story', replace: 'styled'}]
let notifications = 0
const beauty = createReaderBeautyCache({
  renderAsync: text => { const deferred = deferredBeauty(); requests.push({text, ...deferred}); return deferred.promise },
  renderSync: text => 'fallback:' + text,
})
beauty.selectScope('old-session')
const cancelOld = beauty.run('old-session', ['story'], rules, () => { notifications++ })
beauty.selectScope('new-session')
beauty.run('new-session', ['story'], rules, () => { notifications++ })
requests[1].resolve('new-render'); await finishBeauty()
requests[0].resolve('old-render'); await finishBeauty()
assert.equal(beauty.htmlFor('story'), 'new-render', 'scope change fences an old result even before its cleanup')
assert.equal(notifications, 1)
cancelOld()
beauty.selectScope('new-session')
beauty.run('new-session', ['story'], rules, () => { notifications++ })
await finishBeauty()
assert.equal(requests.length, 2, 'same-scope committed text reuses cached rendering')
const cancelled = beauty.run('new-session', ['cancelled', 'must-not-run'], rules, () => { notifications++ })
cancelled(); requests[2].resolve('late-cancelled'); await finishBeauty()
assert.equal(beauty.htmlFor('cancelled'), 'fallback:cancelled')
assert.equal(requests.length, 3, 'cancellation stops the remaining work')
beauty.run('new-session', ['broken'], rules, () => { notifications++ })
requests[3].reject(new Error('regex failed')); await finishBeauty()
assert.equal(beauty.htmlFor('broken'), 'fallback:broken')
assert.equal(beauty.failed(['broken']), true)
beauty.selectScope('changed-rules')
assert.equal(beauty.failed(['broken']), false)
const bounded = createReaderBeautyCache({renderAsync: async raw => 'cached:' + raw, renderSync: raw => 'fallback:' + raw})
bounded.selectScope('bounded')
bounded.run('bounded', Array.from({length: 501}, (_, index) => String(index)), rules, () => {})
await finishBeauty()
assert.equal(bounded.htmlFor('0'), 'fallback:0', 'cache retains at most the latest 500 committed texts')
assert.equal(bounded.htmlFor('1'), 'cached:1')
assert.equal(bounded.htmlFor('500'), 'cached:500')
console.log('reader-beauty=ok (scope fence, cancellation, cache reuse, fallback and FIFO cap)')
