import assert from 'node:assert/strict'
import {retrieveWorldbook} from '../lib/core/roleplay-core.js'
import {renderWorldbookEntry} from '../lib/core/roleplay-author-context.js'
import {estimateTokens} from '../lib/core/roleplay-data.js'
const T={worldbook:new Map([
  ['a__kingdom',{id:'kingdom',name:'静海王国',keywords:['静海王国'],content:'煤灰覆盖下层街区。贵族各自为政。'}],
  ['a__pinned',{id:'pinned',name:'旧常驻',alwaysOn:true,content:'旧常驻必须经过核心设定兼容层，不能绕过查询。'}],
  ['a__disabled',{id:'disabled',name:'静海王国',enabled:false,content:'不可见'}],
  ['b__other',{id:'other',name:'静海王国',content:'另一分支'}]
])}
assert.equal((await retrieveWorldbook(T,'a','她走近了',null,6000,'旧剧情提到静海王国','旧记忆提到静海王国')).entries.length,0,'old story and notes cannot passively keep activating lore')
const hit=await retrieveWorldbook(T,'a','静海王国',null,6000)
assert.deepEqual(hit.entries.map(e=>e.id),['kingdom']);assert.match(hit.text,/贵族各自为政/)
assert.equal((await retrieveWorldbook(T,'a','',null,6000)).text,'','alwaysOn does not make the passive database self-inject')
assert.ok(!hit.text.includes('另一分支'));assert.ok(!hit.text.includes('不可见'))
{
 const worldbook=new Map([
  ['a__secondary',{id:'secondary',name:'Secondary',keywords:['GATE'],content:'SELECTIVE',tavern:{selective:true,secondaryKeys:['key']},priority:3}],
  ['a__case',{id:'case',keywords:['GATE'],content:'CASE',tavern:{caseSensitive:true},priority:2}],
  ['a__regex',{id:'regex',keywords:['/^gate$/i'],content:'REGEX',tavern:{useRegex:true},priority:1}],
  ['a__alias',{id:'alias',aliases:['gate'],content:'ALIAS',priority:0}],
 ])
 const query=async text=>retrieveWorldbook({worldbook},'a',text,null,6000)
 assert.deepEqual((await query('gate')).entries.map(e=>e.id),['alias'],'anchored regex sees the complete query including scene separators')
 worldbook.get('a__regex').keywords=['/gate/i']
 assert.deepEqual((await query('gate')).entries.map(e=>e.id),['regex','alias'])
 assert.deepEqual((await query('GATE key')).entries.map(e=>e.id),['secondary','case','regex','alias'])
 const required=estimateTokens(renderWorldbookEntry(worldbook.get('a__secondary')))
 assert.deepEqual((await retrieveWorldbook({worldbook:new Map([['a__secondary',worldbook.get('a__secondary')]])},'a','GATE key',null,required-1)).entries,[])
 const exact=await retrieveWorldbook({worldbook:new Map([['a__secondary',worldbook.get('a__secondary')]])},'a','GATE key',null,required)
 assert.equal(exact.usedTokens,required);assert.equal(exact.entries.length,1)
 worldbook.get('a__secondary').tokenBudget=6001
 assert.ok(!(await query('GATE key')).entries.some(e=>e.id==='secondary'),'author budget is a floor, not a cap on actual text cost')
 worldbook.get('a__regex').keywords=Array(129).fill('/gate/i')
 const limited=await query('gate')
 assert.equal(limited.regexStatus,'limit');assert.deepEqual(limited.entries.map(e=>e.id),['alias'],'regex failure cannot select unmatched regex lore')
}
console.log('worldbook-passive=ok (scope, selective/case/regex matching, budgets, ordering and regex limit fallback)')
