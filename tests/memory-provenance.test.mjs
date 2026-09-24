import assert from 'node:assert/strict'
import {branchScope,belongsToBranch,durableSeq,provenanceSeqOf,scopedLedgerItems,textOf,lastSeqOf,estimateTokens,adaptationIsActive,adaptationTurns} from '../lib/memory/memory-provenance.js'
// Alpha.7 stores the fork-inherited prefix length on the session
// (native `inheritedEventCount`); the header keeps only the parent identity.
const fork={id:'child',header:{parentSession:'root'},inheritedEventCount:5,events:[{seq:3},{seq:9}]}
assert.deepEqual(branchScope(fork),{isFork:true,seedLength:5})
assert.deepEqual(branchScope({id:'root',header:{}}),{isFork:false,seedLength:null})
assert.equal(durableSeq(4),4);assert.equal(durableSeq(-1),null);assert.equal(durableSeq(1.2),null)
assert.equal(provenanceSeqOf({range:{end:4}}),4);assert.equal(provenanceSeqOf({updatedAt:Date.now()}),null)
assert.equal(belongsToBranch({sessionId:'child',seq:99},fork),true)
assert.equal(belongsToBranch({sessionId:'other',seq:4},fork),true)
assert.equal(belongsToBranch({sessionId:'other',seq:5},fork),false)
assert.equal(belongsToBranch({sessionId:'child',ownerSessionId:'other',seq:1},fork),true,'inherited evidence remains bounded despite conflicting owner aliases')
assert.deepEqual(scopedLedgerItems([{sessionId:'other',seq:4},{sessionId:'other',seq:5},{sessionId:'child',seq:99}],fork),[{sessionId:'other',seq:4},{sessionId:'child',seq:99}])
assert.equal(textOf([{type:'text',text:'a'},{type:'tool',text:'secret'},{type:'text',text:'b'}]),'a\nb')
assert.equal(textOf(null),'');assert.equal(lastSeqOf(fork),9);assert.equal(estimateTokens('12345'),2)
const nativeResult=(id,body,isError=false)=>({source:{kind:'tool',callId:id},isError,content:[{type:'tool-result',toolCallId:id,isError,content:[{type:'text',text:JSON.stringify(body)}]}]})
const statusOnly=[{type:'turn/start',data:{turn:1}},{type:'tool/call',data:{turn:1,name:'rp_source_status',callId:'status'}},{type:'tool/result',data:{message:nativeResult('status',{sources:[]})}},{type:'turn/start',data:{turn:2}}]
assert.equal(adaptationIsActive(statusOnly),false,'read-only source status cannot open research mode')
assert.deepEqual([...adaptationTurns(statusOnly)],[1],'only the consultation turn is excluded from story; the following turn stays ordinary')
const failedBegin=[{type:'turn/start',data:{turn:1}},{type:'tool/call',data:{turn:1,name:'rp_source_begin',callId:'begin'}},{type:'tool/result',data:{message:nativeResult('begin',{ok:false},false)}},{type:'turn/start',data:{turn:2}}]
assert.equal(adaptationIsActive(failedBegin),false,'a failed source begin cannot open research mode')
const adaptation=[{type:'turn/start',data:{turn:1}},{type:'tool/call',data:{turn:1,name:'rp_source_begin',callId:'begin'}},{type:'tool/result',data:{message:nativeResult('begin',{sourceId:'a'.repeat(64)})}},{type:'turn/start',data:{turn:2}}]
assert.equal(adaptationIsActive(adaptation),true,'a successful source begin explicitly opens research mode')
assert.deepEqual([...adaptationTurns(adaptation)],[1,2])
adaptation.push({type:'tool/call',data:{turn:2,name:'rp_source_close',callId:'close'}},{type:'tool/result',data:{message:nativeResult('close',{ok:true,mode:'authoring'})}},{type:'turn/start',data:{turn:3}})
assert.equal(adaptationIsActive(adaptation),false,'explicit authoring exit closes research mode')
assert(!adaptationTurns(adaptation).has(3),'research materials cannot enter the following original-card turn')
console.log('memory-provenance=ok (fork seed, provenance, ownership, text, token and adaptation boundaries)')
