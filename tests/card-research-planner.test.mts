import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createResearchPlanner} from '../lib/core/card-research-planner.js'

const sha=(value:string)=>createHash('sha256').update(value).digest('hex')
const sourceId='a'.repeat(64)
const variantSourceId='b'.repeat(64)
const pieces=Array.from({length:10},(_,index)=>`第${index+1}章 证据段${index}：`+`可核验原文${index}。`.repeat(80))
let cursor=0
const segments=pieces.map((piece,id)=>{const start=cursor;cursor+=piece.length;return {id,start,end:cursor,chapter:`第${id+1}章`}})
const originalText=pieces.join('')
const original={schemaVersion:1 as const,kind:'adaptation-source' as const,owner:'owner-a',id:sourceId,name:'fixture.txt',rawSha256:sha(originalText),textSha256:sha(originalText),encoding:'utf-8',bytes:Buffer.byteLength(originalText),text:originalText,segments}
const sources=new Map<string,typeof original>()
for(const owner of ['owner-a','owner-b','owner-c','owner-d','owner-f'])sources.set(`${owner}:${sourceId}`,{...original,owner})
const variantText=originalText.replaceAll('可核验','已核验')
sources.set(`owner-e:${variantSourceId}`,{...original,owner:'owner-e',id:variantSourceId,text:variantText,textSha256:sha(variantText)})
const database=new Map<string,unknown>()
let fail:(key:string,value:unknown)=>boolean=()=>false
const table={get:(key:string)=>database.get(key),put:async(key:string,value:unknown)=>{if(fail(key,value))throw Error('controlled persistence failure');database.set(key,structuredClone(value))}}
const planner=createResearchPlanner(table,(owner,id)=>{const source=sources.get(`${owner}:${id}`);if(!source)throw Error('missing source');return source})
const revision=(owner:string)=>planner.view(owner,sourceId)!.revision
const quote=(segment:number)=>{const part=segments[segment]!,start=part.start;return {segment,start,quote:originalText.slice(start,start+12)}}
const evidence=(segment:number)=>({certainty:'verified-original',citations:[quote(segment)],storyOccursAt:'原著时间线待精读',readerRevealedAt:`第${segment+1}章`,characterKnowledge:'必须在当前世界线获得对应见闻后才可知'})

// One native query call owns one atomic receipt transaction, even if it
// searches several relation terms. A branch with no visible unacknowledged
// evidence must be able to retrieve the same locations again.
{
 const db=new Map<string,unknown>();let valid=true,invalidate=false,writes=0
 const p=createResearchPlanner({get:key=>db.get(key),put:async(key,value)=>{writes++;db.set(key,structuredClone(value));if(invalidate){invalidate=false;valid=false}}},()=>original)
 const owner='batch-owner'
 await p.offer(owner,sourceId,0);await p.select(owner,sourceId,0,'coarse','林舟')
 const frontier=await p.prepareQueries(owner,sourceId,'fp',[],'hybrid'),generation=await p.reserve(owner,sourceId,'queryBatches')
 const rows=[0,1].map(segment=>({segment,start:segments[segment]!.start,end:segments[segment]!.start+100,text:originalText.slice(segments[segment]!.start,segments[segment]!.start+100)}))
 const batch=[{rows:[rows[0]!],query:frontier[0]!.query,fingerprint:'fp',mode:'hybrid' as const,frontierId:frontier[0]!.id},{rows:[rows[1]!],query:'其他关系',fingerprint:'fp',mode:'hybrid' as const}]
 const before=JSON.stringify([...db]),writeCount=writes
 await assert.rejects(p.recordBatch(owner,sourceId,generation,[batch[0]!,{...batch[1]!,rows:[{...rows[1]!,text:'INVALID_ORIGINAL'}]}]),/范围|哈希/)
 assert.equal(writes,writeCount);assert.equal(JSON.stringify([...db]),before,'second query validation leaves first query uncommitted')
 invalidate=true
 await assert.rejects(p.recordBatch(owner,sourceId,generation,batch,()=>valid),/已撤回/)
 assert.equal(JSON.stringify([...db]),before,'selection changing during persistence rolls back the complete batch')
 valid=true
 const count=writes,recorded=await p.recordBatch(owner,sourceId,generation,batch,()=>valid)
 assert.equal(writes,count+1,'multiple queries use one plan write')
 const visible=new Set(recorded.flat().map(packet=>packet.id))
 const present=await p.prepareQueries(owner,sourceId,'fp',[],'hybrid',visible)
 assert.ok(!present.some(item=>item.query===frontier[0]!.query),'current visible evidence avoids duplicate queries')
 const absent=await p.prepareQueries(owner,sourceId,'fp',[],'hybrid',new Set())
 assert.ok(absent.some(item=>item.query===frontier[0]!.query),'a new branch can recover unacknowledged evidence absent from its context')
}

// Real novel run: the model copied a correct quote but guessed its absolute
// character offset repeatedly. Locate verbatim evidence inside served packets.
{
 const db=new Map<string,unknown>(),p=createResearchPlanner({get:key=>db.get(key),put:async(key,value)=>{db.set(key,structuredClone(value))}},()=>original)
 await p.offer('quote-owner',sourceId,0)
 await p.select('quote-owner',sourceId,0,'coarse','方鸿渐')
 await p.read('quote-owner',sourceId,0,0,256)
 const save=(citations:unknown[])=>p.save('quote-owner',sourceId,p.view('quote-owner',sourceId)!.revision,{category:'world',statement:'有原文依据的世界背景',certainty:'verified-original',citations})
 await save([{segment:0,start:25,quote:quote(0).quote}])
 assert.equal(p.entries('quote-owner',sourceId)[0]!.citations[0]!.start,0,'wrong model offset is resolved by exact quote, not arithmetic reasoning')
 await save([{segment:0,quote:quote(0).quote}])
 assert.equal(p.entries('quote-owner',sourceId).length,1,'resolved positions preserve stable fact identity')
 await assert.rejects(save([{segment:0,quote:'可核验原文0。'}]),/多处|不唯一/)
 const repeated='可核验原文0。',at=originalText.indexOf(repeated)
 await save([{segment:0,start:at,quote:repeated}])
 assert(p.entries('quote-owner',sourceId).some(fact=>fact.citations[0]!.start===at),'a correct start disambiguates repeated verbatim evidence')
 await assert.rejects(save([{...quote(0),sha256:'f'.repeat(64)}]),/哈希不匹配/)
 await assert.rejects(save([{segment:1,quote:quote(1).quote}]),/未返回|未.*阅读|回读/)
 await assert.rejects(save([{segment:0,quote:'没有出现过的原文句子'}]),/未返回|未.*阅读|回读/)
 await assert.rejects(save([{segment:0,quote:'五字短句'}]),/至少.*6/)
 const nested=(extra:Record<string,unknown>)=>p.save('quote-owner',sourceId,p.view('quote-owner',sourceId)!.revision,{category:'event',statement:'因果与关系证据检查',...evidence(0),...extra})
 const beforeInvalidNested=JSON.stringify([...db])
 await assert.rejects(nested({chain:{actions:[{summary:'未提供此行动的引用'}]}}),/chain\.actions\[0\]\.citations.*1–6/)
 await assert.rejects(nested({edges:[{from:'甲',relation:'认识',to:'乙'}]}),/edges\[0\]\.citations.*1–6/)
 assert.equal(JSON.stringify([...db]),beforeInvalidNested,'nested validation errors identify the missing field without writing facts or checkpoints')
}

// The coarse relation runner keeps an owner-private, durable frontier. A batch validates every
// citation before either record is written, adds source-cited edges, and derives the next query
// without treating candidates or a relationship label as a verified fact by itself.
{
  await planner.offer('owner-f',sourceId,5)
  await planner.select('owner-f',sourceId,revision('owner-f'),'coarse','林舟','离城之前')
  const ownerFKey=[...database.keys()].find(key=>key.startsWith('adaptation-research-')&&!key.startsWith('adaptation-research-base-')&&key.includes(sha('owner-f')))! as string
  const legacy=structuredClone(database.get(ownerFKey) as Record<string,unknown>);legacy.schemaVersion=1;delete legacy.frontier;database.set(ownerFKey,legacy)
  assert.equal(planner.load('owner-f',sourceId)!.schemaVersion,2,'v1 plans load with an empty v2 frontier before their next write')
  assert(planner.view('owner-f',sourceId)!.frontier.pending>=3,'target/opening/coverage seeds create a bounded private frontier')
  const packet=await planner.read('owner-f',sourceId,0,0,256),before=planner.view('owner-f',sourceId)!
  const relation={category:'relation',statement:'林舟与山盟的关系有原著依据',...evidence(0),edges:[{from:'林舟',relation:'隶属',to:'山盟',citations:[quote(0)]}]}
  const rule={category:'rule',statement:'守约是可核验的规则',...evidence(0)}
  const appended=await planner.append('owner-f',sourceId,before.revision,[relation,rule],packet.researchDelivery.packetIds)
  assert.deepEqual(appended.researchCheckpoint.packetIds,packet.researchDelivery.packetIds,'only an actual current-generation delivery can be acknowledged after the verified batch commits')
  assert(planner.load('owner-f',sourceId)!.packets.some(item=>item.id===packet.researchDelivery.packetIds[0]&&item.acknowledged),'whole-packet acknowledgement is durable and owner-local')
  const after=planner.view('owner-f',sourceId)!
  assert.equal(after.revision,before.revision+1,'one batch changes the plan CAS exactly once')
  const baseStorageKey=[...database.keys()].find(key=>key.startsWith('adaptation-research-base-'))! as string
  assert.equal((database.get(baseStorageKey) as {revision:number}).revision,1,'one batch changes the shared base revision exactly once')
  assert(planner.load('owner-f',sourceId)!.frontier.some(item=>item.source==='relation'&&item.query.includes('林舟 隶属 山盟')),'only a cited edge creates a recursive relation frontier entry')
  const count=planner.entries('owner-f',sourceId).length,revisionBeforeBad=after.revision
  const invalidBatch=[{category:'world',statement:'应当整体失败的条目',...evidence(0)},{category:'faction',statement:'坏引用不应部分写入',...evidence(0),citations:[{segment:1,quote:quote(1).quote}]}]
  await assert.rejects(planner.append('owner-f',sourceId,after.revision,invalidBatch),/未由本计划实际查询|回读/)
  assert.equal(planner.entries('owner-f',sourceId).length,count,'a bad batch citation leaves every shared fact untouched')
  assert.equal(planner.view('owner-f',sourceId)!.revision,revisionBeforeBad,'a bad batch citation leaves the owner CAS untouched')
  const next=await planner.prepareQueries('owner-f',sourceId,'keyword',[],'keyword'),generation=await planner.reserve('owner-f',sourceId,'queryBatches')
  await planner.recordPacket('owner-f',sourceId,generation,[{segment:0,start:packet.start,end:packet.end,text:packet.text}],next[0]!.query,'keyword',12,next[0]!.id,[{segment:0,start:packet.start,end:packet.end,score:0.8}])
  const queried=planner.load('owner-f',sourceId)!.frontier.find(item=>item.id===next[0]!.id)!
  assert.equal(queried.state,'queried')
  assert.equal(queried.candidateRanges.length,1,'candidate coordinates are retained separately from text actually returned to the model')
  await assert.rejects(planner.append('owner-f',sourceId,revision('owner-f'),[{...rule,id:'f'.repeat(64)}]),/不带 id/)
  await assert.rejects(planner.append('owner-f',sourceId,revision('owner-f'),[rule],['f'.repeat(64)]),/当前研究 generation 已真正交付/)
}

await planner.offer('owner-a',sourceId,1)
await assert.rejects(planner.select('owner-a',sourceId,0,'coarse',''),/重点主角/)
await planner.select('owner-a',sourceId,revision('owner-a'),'coarse','纳兰嫣然','第 1 章')

// One partial packet is evidence for that packet only. It cannot pass a whole-book gate.
const partial=await planner.read('owner-a',sourceId,0,0,256)
assert.equal(partial.scope,'局部原文，不标为整段已读')
await assert.rejects(planner.finish('owner-a',sourceId,'fingerprint-a'),/缺项/)

for(const segment of segments.slice(1))await planner.read('owner-a',sourceId,segment.id,0,256)
const save=async(value:Record<string,unknown>)=>planner.save('owner-a',sourceId,revision('owner-a'),value)
const world={category:'world',statement:'世界规则的可核验条目',...evidence(7)}
await save(world)
const firstShared=planner.entries('owner-a',sourceId).find(entry=>entry.statement===world.statement)!
const totalBeforeRepeat=planner.view('owner-a',sourceId)!.totalEntries
await save(world)
assert.equal(planner.view('owner-a',sourceId)!.totalEntries,totalBeforeRepeat,'same original fact uses a stable shared id instead of duplicating')
assert.equal(planner.entries('owner-a',sourceId).find(entry=>entry.statement===world.statement)!.id,firstShared.id)

await save({category:'rule',statement:'规则条目',...evidence(8)})
await save({category:'faction',statement:'势力条目',...evidence(9)})
await save({category:'relation',statement:'关系条目',...evidence(0)})
await save({category:'event',statement:'因果事件条目',...evidence(1),chain:{cause:'原著起因',preconditions:'原著前置条件',actions:[{summary:'原著阶段行动',citations:[quote(1)]}],people:'原著相关人物',result:'原著结果',reveal:'第 2 章读者得知，角色需满足见闻条件'}})
for(const [index,topic] of ['identity','motive','relations','affiliation','limits','turning-point','opening'].entries())await save({category:'character',statement:`纳兰嫣然专题 ${topic}`,...evidence(index),entity:'纳兰嫣然',topic})

// A supplied shared id cannot overwrite a shared fact. Unknowns are regenerated in the
// private namespace and remain available only to this card's plan.
const beforePrivate=planner.entries('owner-a',sourceId).find(entry=>entry.id===firstShared.id)!.statement
await planner.save('owner-a',sourceId,revision('owner-a'),{id:firstShared.id,category:'world',certainty:'unknown',statement:'只属于 A 卡的待核实改编问题',storyOccursAt:'未知',readerRevealedAt:'未知',characterKnowledge:'未知'})
const privateEntry=planner.entries('owner-a',sourceId).find(entry=>entry.statement==='只属于 A 卡的待核实改编问题')!
assert.notEqual(privateEntry.id,firstShared.id,'a supplied shared id cannot overwrite or shadow a shared original fact')
assert.equal(planner.entries('owner-a',sourceId).find(entry=>entry.id===firstShared.id)!.statement,beforePrivate)

assert.equal(planner.assess('owner-a',sourceId).ready,true,'all required records are still bounded citations, not a full-reading claim')
const finished=await planner.finish('owner-a',sourceId,'fingerprint-a')
assert.equal(finished.status,'finished')
const finishedRevision=finished.revision
assert.equal((await planner.finish('owner-a',sourceId,'fingerprint-a'))!.revision,finishedRevision,'same fingerprint finish is idempotent')
assert.equal((await planner.finish('owner-a',sourceId,'fingerprint-b'))!.revision,finishedRevision+1,'a new verified index fingerprint can reconfirm a finished plan')
await assert.rejects(planner.control('owner-a',sourceId,revision('owner-a'),'pause'),/已完成研究/)

// Shared facts are visible to another card with the same raw original, but its target and
// private unknowns remain local and cannot make that card pass its own protagonist gate.
await planner.offer('owner-b',sourceId,2)
await planner.select('owner-b',sourceId,revision('owner-b'),'coarse','萧炎','第 1 章')
assert.equal(planner.view('owner-b',sourceId)!.target.protagonist,'萧炎')
assert(planner.entries('owner-b',sourceId).some(entry=>entry.id===firstShared.id),'same raw original reuses the shared fact base')
assert(!planner.entries('owner-b',sourceId).some(entry=>entry.statement==='只属于 A 卡的待核实改编问题'),'owner-local unknowns do not leak through the shared base')
await assert.rejects(planner.save('owner-b',sourceId,revision('owner-b'),{category:'world',statement:'模型印象不能成为原著事实',...evidence(0)}),/引用未由本计划实际查询/)
await assert.rejects(planner.finish('owner-b',sourceId,'fingerprint-b'),/主角专题/)

// Same raw bytes can have a deliberately different decoding/text hash. Its coordinates must
// create an isolated base rather than inheriting citations from the first decoding.
await planner.offer('owner-e',variantSourceId,2)
await planner.select('owner-e',variantSourceId,planner.view('owner-e',variantSourceId)!.revision,'coarse','测试主角','第 1 章')
await planner.read('owner-e',variantSourceId,0,0,256)
const variantPart=sources.get(`owner-e:${variantSourceId}`)!.segments[0]!,variantQuote={segment:0,start:variantPart.start,quote:variantText.slice(variantPart.start,variantPart.start+12)}
await planner.save('owner-e',variantSourceId,planner.view('owner-e',variantSourceId)!.revision,{category:'world',statement:'不同解码的独立世界事实',certainty:'verified-original',citations:[variantQuote],storyOccursAt:'未知',readerRevealedAt:'第 1 章',characterKnowledge:'未知'})
assert.equal(planner.entries('owner-e',variantSourceId).length,1,'a different decoded text hash cannot reuse incompatible source coordinates')

// CAS, pause and generation checks reject late packets rather than publishing them after a mode change.
await planner.offer('owner-c',sourceId,3)
await planner.select('owner-c',sourceId,revision('owner-c'),'coarse','测试主角','第 1 章')
const generation=await planner.reserve('owner-c',sourceId,'queryBatches')
const paused=await planner.control('owner-c',sourceId,revision('owner-c'),'pause')
await assert.rejects(planner.recordPacket('owner-c',sourceId,generation,[], '测试查询','keyword',10),/旧结果/)
await assert.rejects(planner.finish('owner-c',sourceId,'fingerprint-c'),/暂停/)
await planner.control('owner-c',sourceId,paused.revision,'resume')
await assert.rejects(planner.recordPacket('owner-c',sourceId,generation,[], '测试查询','keyword',10),/旧结果/)
await assert.rejects(planner.control('owner-c',sourceId,paused.revision,'budget',{maxQueryBatches:1,maxReadPackets:1}),/已变化/)
const currentGeneration=await planner.reserve('owner-c',sourceId,'queryBatches')
const exact={segment:2,start:segments[2]!.start,end:segments[2]!.start+128,text:originalText.slice(segments[2]!.start,segments[2]!.start+128)}
await planner.recordPacket('owner-c',sourceId,currentGeneration,[exact],' 世界  规则 ','keyword',11)
const recordedQuery=planner.load('owner-c',sourceId)!.queries.at(-1)!
assert.deepEqual(recordedQuery.ranges,[{segment:exact.segment,start:exact.start,end:exact.end,sha256:sha(exact.text)}],'query ledger retains the exact returned source range, not a model claim')
await planner.recordPacket('owner-c',sourceId,currentGeneration,[],'同一问题','semantic-fingerprint',12,undefined,[],'semantic')
await planner.recordPacket('owner-c',sourceId,currentGeneration,[],'同一问题','semantic-fingerprint',13,undefined,[],'hybrid')
assert.equal(planner.load('owner-c',sourceId)!.queries.filter(query=>query.query==='同一问题'&&query.fingerprint==='semantic-fingerprint').length,2,'same question remains separately auditable for semantic and hybrid retrieval modes')

// A failed shared-base write restores the private plan revision and does not expose the new fact.
await planner.offer('owner-d',sourceId,4)
await planner.select('owner-d',sourceId,revision('owner-d'),'coarse','测试主角','第 1 章')
await planner.read('owner-d',sourceId,2,0,256)
const beforeFailure=planner.view('owner-d',sourceId)!
let failOnce=true
fail=(key)=>{if(failOnce&&key.startsWith('adaptation-research-base-')){failOnce=false;return true}return false}
await assert.rejects(planner.save('owner-d',sourceId,revision('owner-d'),{category:'world',statement:'失败时不能泄漏的共享事实',...evidence(2)}),/controlled persistence failure/)
fail=()=>false
assert.equal(planner.view('owner-d',sourceId)!.revision,beforeFailure.revision,'failed base publication rolls back the owner CAS marker')
assert(!planner.entries('owner-d',sourceId).some(entry=>entry.statement==='失败时不能泄漏的共享事实'),'failed publication leaves no partial original fact')

// Corrupt durable records are rejected before they can certify any research state.
const planStorageKey=[...database.keys()].find(key=>key.startsWith('adaptation-research-')&&!key.startsWith('adaptation-research-base-')&&key.includes(sha('owner-c')))!
const savedPlan=structuredClone(database.get(planStorageKey) as Record<string,unknown>)
;(database.get(planStorageKey) as Record<string,any>).budget.maxReadPackets=0
assert.throws(()=>planner.load('owner-c',sourceId),/预算记录损坏|最大阅读包/)
database.set(planStorageKey,savedPlan)
;(database.get(planStorageKey) as Record<string,any>).owner='other-owner'
assert.throws(()=>planner.load('owner-c',sourceId),/归属与当前原著不匹配/)
database.set(planStorageKey,savedPlan)

console.log('card-research-planner=ok (shared facts, private targets, atomic append, frontier, CAS, durability, partial-reading boundaries)')
