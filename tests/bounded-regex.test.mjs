import assert from 'node:assert/strict'
import {boundedRegexMatch,worldbookRegex} from '../lib/core/bounded-regex.js'
assert.deepEqual((await boundedRegexMatch([worldbookRegex('/LIGHT/i')],'lighthouse')).matches,[true])
assert.deepEqual((await boundedRegexMatch([{pattern:'[',flags:''}],'text')).matches,[false])
assert.equal((await boundedRegexMatch([{pattern:'x'.repeat(513),flags:''}],'x')).reason,'limit')
let heartbeat=false
const started=Date.now(), timer=setTimeout(()=>{heartbeat=true},20)
const hostile=await boundedRegexMatch([{pattern:'(a+)+$',flags:''}],'a'.repeat(20000)+'!',{timeoutMs:80})
clearTimeout(timer)
assert.equal(hostile.reason,'timeout')
assert.equal(heartbeat,true,'the host event loop must remain responsive during catastrophic backtracking')
assert.ok(Date.now()-started<2000,'termination must be bounded')
assert.deepEqual((await boundedRegexMatch([worldbookRegex('tower')],'TOWER')).matches,[true],'a timed-out worker must not poison later matching')
console.log('bounded-regex=ok (worker deadline, input/pattern budget, responsive host, retry)')
