import assert from 'node:assert/strict'
import {boundedRegexMatch,boundedSTRegexReplace,ST_REGEX_LIMITS,worldbookRegex} from '../lib/core/bounded-regex.js'
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
assert.deepEqual(await boundedSTRegexReplace({pattern:'(hello) (world)',flags:'g',replacement:'$2 $1'},'hello world'),
  {ok:true,text:'world hello',matches:1})
assert.deepEqual(await boundedSTRegexReplace({pattern:'(b)',flags:'',replacement:'$`:$&:$\u0027:$10'},'abc'),
  {ok:true,text:'aa:b:c:b0c',matches:1})
assert.deepEqual(await boundedSTRegexReplace({pattern:'[',flags:'g',replacement:'x'},'hello'),
  {ok:false,reason:'invalid-rule',limit:null,observed:null,
    diagnostic:{schemaVersion:1,reason:'invalid-rule',limit:null,observed:null,allowed:null}})
assert.deepEqual(await boundedSTRegexReplace({pattern:'x',flags:'g',replacement:'y'},'x'.repeat(ST_REGEX_LIMITS.inputChars+1)),
  {ok:false,reason:'limit',limit:'inputChars',observed:ST_REGEX_LIMITS.inputChars+1,
    diagnostic:{schemaVersion:1,reason:'limit',limit:'inputChars',
      observed:ST_REGEX_LIMITS.inputChars+1,allowed:ST_REGEX_LIMITS.inputChars}})
const expanded=await boundedSTRegexReplace({pattern:'(x+)',flags:'',replacement:'$1$1'},'x'.repeat(1_100_000))
assert.equal(expanded.ok,false)
assert.equal(expanded.limit,'outputChars')
const contextExpansion=await boundedSTRegexReplace({pattern:'x',flags:'',replacement:'$\u0027'.repeat(10)},
  'x'+'y'.repeat(1_000_000))
assert.equal(contextExpansion.ok,false)
assert.equal(contextExpansion.limit,'outputChars')
const matchOverflow=await boundedSTRegexReplace({pattern:'x',flags:'g',replacement:'y'},'x'.repeat(ST_REGEX_LIMITS.matches+1))
assert.equal(matchOverflow.ok,false)
assert.equal(matchOverflow.limit,'matches')
const zeroWidth=await boundedSTRegexReplace({pattern:'',flags:'gu',replacement:'|'},'😀')
assert.deepEqual(zeroWidth,{ok:true,text:'|😀|',matches:2})
const hostileReplace=await boundedSTRegexReplace({pattern:'(a+)+$',flags:'',replacement:'x'},'a'.repeat(20000)+'!')
assert.equal(hostileReplace.reason,'timeout')
assert.equal(hostileReplace.limit,'deadlineMs')
assert.equal((await boundedSTRegexReplace({pattern:'a',flags:'',replacement:'b'},'a')).ok,true)
console.log('bounded-regex=ok (worker deadline, input/pattern budget, responsive host, retry)')
