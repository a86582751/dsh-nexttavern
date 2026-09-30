// Card JavaScript must never run with the page's DOM, globals or fill callback.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'

let touched = 0
const root = {ownerDocument: {defaultView: globalThis}}
const {createAuthorRuntime} = await import('../lib/ui/reader-view.js')
const {createAuthorFrame} = await import('../lib/ui/author-runtime.js')
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

// Exercise the host side of the same MessageChannel controller ReaderView uses.
// Browser CSP and opaque-origin behavior are checked separately in Chromium.
const require = createRequire(import.meta.url)
const {resolveJsdom} = require('../lib/operations/tool-resolution.mjs')
const {JSDOM} = require(resolveJsdom())
const frameDom = new JSDOM('<!doctype html><iframe id="guard"></iframe>', {url:'http://127.0.0.1/'})
const priorWindow = globalThis.window
globalThis.window = frameDom.window
try {
  const guard = frameDom.window.document.querySelector('#guard')
  const fills = [], layouts = [], failures = []
  let fillResolve
  const filled = new Promise(resolve => {fillResolve = resolve})
  let childPort
  guard.contentWindow.postMessage = (_data, _target, ports) => {if (ports?.[0]) childPort = ports[0]}
  const controller = createAuthorFrame(guard, {
    source:'fill("draft")', css:'', baseCss:'', current:()=>true,
    fill:text=>{fills.push(text);fillResolve()}, layout:value=>layouts.push(value), failed:reason=>failures.push(reason),
  })
  const nonce = guard.srcdoc.match(/[0-9a-f]{32}/)?.[0]
  assert.ok(nonce)
  assert.match(guard.srcdoc, /frame-src 'none'/)
  const message = (source, data) => frameDom.window.dispatchEvent(new frameDom.window.MessageEvent('message', {
    source, data:{v:1,nonce,...data}, origin:'http://127.0.0.1',
  }))
  message(frameDom.window, {type:'ready'})
  assert.equal(childPort, undefined, 'a forged ready message cannot acquire the bridge')
  message(guard.contentWindow, {type:'ready'})
  assert.ok(childPort)
  const renders = []
  const rendered = new Promise(resolve => {childPort.onmessage = event => {renders.push(event.data);resolve()}})
  controller.update([{key:'n:1',kind:'narrator',text:'story',html:'<p>story</p>'}])
  childPort.postMessage({v:1,nonce,revision:0,requestId:1,type:'bound'})
  await Promise.race([rendered,new Promise((_,reject)=>setTimeout(()=>reject(new Error('frame render timed out')),1000))])
  assert.equal(renders.length,1)
  assert.equal(renders[0].revision,1)
  childPort.postMessage({v:1,nonce,revision:0,requestId:2,type:'fill',text:'stale'})
  childPort.postMessage({v:1,nonce,revision:1,requestId:3,type:'fill',text:'draft'})
  childPort.postMessage({v:1,nonce,revision:1,requestId:3,type:'fill',text:'replay'})
  childPort.postMessage({v:1,nonce,revision:1,requestId:4,type:'layout',height:80,rows:[28]})
  await Promise.race([filled,new Promise((_,reject)=>setTimeout(()=>reject(new Error('frame fill timed out')),1000))])
  await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(fills,['draft'], 'stale and replayed fill requests are ignored')
  assert.equal(layouts[0].height,80)
  const queuedFilled = new Promise(resolve => {fillResolve = resolve})
  // MessagePort delivery is asynchronous: this valid render-1 action is
  // already queued when the host synchronously advances to render 2.
  childPort.postMessage({v:1,nonce,revision:1,requestId:5,type:'fill',text:'queued draft'})
  controller.update([{key:'n:1',kind:'narrator',text:'new story',html:'<p>new story</p>'}])
  await Promise.race([queuedFilled,new Promise((_,reject)=>setTimeout(()=>reject(new Error('queued frame fill lost')),1000))])
  childPort.postMessage({v:1,nonce,revision:1,requestId:5,type:'fill',text:'queued replay'})
  childPort.postMessage({v:1,nonce,revision:1,requestId:6,type:'layout',height:900,rows:[800]})
  childPort.postMessage({v:1,nonce,revision:0,requestId:7,type:'fill',text:'unrendered'})
  childPort.postMessage({v:1,nonce,revision:3,requestId:8,type:'fill',text:'future'})
  childPort.postMessage({v:1,nonce,revision:1.5,requestId:9,type:'fill',text:'fractional'})
  childPort.postMessage({v:1,nonce,revision:1,requestId:10,type:'bound'})
  await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(fills,['draft','queued draft'])
  assert.deepEqual(layouts,[{height:80,rows:[28]}], 'old-render layouts cannot position the new action rows')
  assert.equal(renders.length,2,'an already bound controller cannot bind or rerender twice')
  message(guard.contentWindow, {type:'child-load',count:2})
  assert.deepEqual(failures,['作者脚本离开隔离文档'])
  assert.equal(guard.hasAttribute('srcdoc'),false)
  controller.dispose()
  childPort.postMessage({v:1,nonce,revision:2,requestId:11,type:'fill',text:'disposed'})
  await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(fills,['draft','queued draft'])
  childPort.close()
} finally {
  globalThis.window = priorWindow
  frameDom.window.close()
}
const errorDom = new JSDOM('<!doctype html><iframe id="guard"></iframe>', {url:'http://127.0.0.1/'})
globalThis.window = errorDom.window
let errorController, errorPort
try {
  const guard = errorDom.window.document.querySelector('#guard')
  guard.contentWindow.postMessage = (_data,_target,ports) => {if(ports?.[0]) errorPort = ports[0]}
  let failedResolve, renderedResolve, current = true
  const failed = new Promise(resolve=>{failedResolve=resolve})
  const rendered = new Promise(resolve=>{renderedResolve=resolve})
  const failures = []
  errorController = createAuthorFrame(guard, {source:'throw Error("queued author error")',css:'',baseCss:'',
    current:()=>current,fill:()=>assert.fail('error fixture cannot fill'),layout:()=>{},
    failed:reason=>{failures.push(reason);failedResolve()}})
  const nonce = guard.srcdoc.match(/[0-9a-f]{32}/)?.[0]
  const NativeMessageChannel = globalThis.MessageChannel
  let errorHostPort
  try {
    // Capture the controller's actual native port, without replacing its
    // onmessage handler or synchronously pretending a message was delivered.
    globalThis.MessageChannel = class {
      constructor() {
        const pair = new NativeMessageChannel()
        errorHostPort = pair.port1
        return pair
      }
    }
    errorDom.window.dispatchEvent(new errorDom.window.MessageEvent('message', {
      source:guard.contentWindow,data:{v:1,nonce,type:'ready'},origin:'http://127.0.0.1',
    }))
  } finally {globalThis.MessageChannel = NativeMessageChannel}
  assert.ok(errorPort)
  assert.ok(errorHostPort)
  errorPort.onmessage = ()=>renderedResolve()
  errorController.update([{key:'n:1',kind:'narrator',text:'story',html:'<p>story</p>'}])
  errorPort.postMessage({v:1,nonce,revision:0,requestId:1,type:'bound'})
  await Promise.race([rendered,new Promise((_,reject)=>setTimeout(()=>reject(new Error('error fixture render timed out')),1000))])
  current=false
  // Registered after the real controller handler: this barrier resolves only
  // after the obsolete message was processed while current() was still false.
  const obsoleteDelivered = new Promise(resolve=>{
    const afterController = event=>{
      if(event.data?.nonce!==nonce || event.data?.requestId!==2) return
      errorHostPort.removeEventListener('message',afterController)
      resolve()
    }
    errorHostPort.addEventListener('message',afterController)
  })
  errorPort.postMessage({v:1,nonce,revision:1,requestId:2,type:'error',message:'obsolete session'})
  await Promise.race([obsoleteDelivered,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('obsolete frame message delivery timed out')),1000))])
  assert.deepEqual(failures,[],'an obsolete session cannot report through its old bridge')
  current=true
  errorPort.postMessage({v:1,nonce,revision:1,requestId:3,type:'error',message:'queued author error'})
  errorController.update([{key:'n:1',kind:'narrator',text:'new story',html:'<p>new story</p>'}])
  await Promise.race([failed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('queued frame error lost')),1000))])
  assert.deepEqual(failures,['作者脚本异常：queued author error'])
  assert.equal(guard.hasAttribute('srcdoc'),false)
} finally {
  errorController?.dispose();errorPort?.close()
  globalThis.window=priorWindow
  errorDom.window.close()
}
console.log('reader-author-frame=ok (source fence, revision, replay, navigation fallback)')
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
