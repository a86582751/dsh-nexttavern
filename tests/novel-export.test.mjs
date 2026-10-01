import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {taskHash,InlinePending} from '../lib/core/tavern-tasks.js'
import {createNovelExports,novelUnits,validateNovelChunk} from '../lib/core/novel-export.js'
const entries=[{seq:1,role:'user',text:'我拿起三只蓝瓶。'}, {seq:2,role:'assistant',text:'“等到月落再开门。”她递来七枚银叶。\n\n只有铜灯熄灭，温室铜钥匙才能转动。'}]
const units=novelUnits(entries)
assert.equal(units.length,3)
const materialized=validateNovelChunk(units,{paragraphs:units.map(unit=>({source_ids:[unit.id]}))})
assert.deepEqual(materialized.paragraphs.map(p=>p.text),units.map(u=>u.text),'source references materialize original prose without model transcription')
assert.throws(()=>validateNovelChunk(units,{paragraphs:[{source_ids:units.map(u=>u.id),text:'她递来银叶。'}]}),/对白|条件|细节/)
assert.throws(()=>validateNovelChunk(units,{paragraphs:[{source_ids:[units[0].id],text:units[0].text}]}),/遗漏/)
const details=novelUnits([{seq:7,role:'assistant',text:'阿明左臂受伤，雨水渗进靴子。'}])
assert.throws(()=>validateNovelChunk(details,{paragraphs:[{source_ids:[details[0].id],text:'阿明受伤。'}]}),/遗漏/)
class Table extends Map{async put(k,v){this.set(k,structuredClone(v))}}
const table=new Table(), session={id:'novel-session'}
let history=entries,archives=0,fail=true
const exporter=createNovelExports({table,history:()=>history,
  request:async spec=>{
    const input=JSON.parse(spec.user)
    if(input.phase==='plan')return spec.validate({title:'月下温室',chapters:[{title:'铜灯',chunk_ids:input.chunks.map(c=>c.id)}]})
    if(input.phase==='edit'){if(fail)throw new Error('truncated');return spec.validate({paragraphs:input.units.map(u=>({source_ids:[u.id],text:u.text}))})}
    for(const field of ['approved','checked_source_ids','issues'])assert.ok(spec.system.includes(field),`model must receive review field ${field} without reading server code`)
    return spec.validate({approved:true,checked_source_ids:input.units.map(u=>u.id),issues:[]})
  },archive:async(s,j,text)=>{archives++;assert.match(text,/三只蓝瓶/);assert.match(text,/七枚银叶/);assert.match(text,/只有铜灯熄灭/);return {id:'resource',path:'verified.md'}}})
const job=await exporter.begin(session,{execution:'inline'})
await exporter.drive(session,job.id,{})
assert.equal(exporter.get(session,job.id).status,'failed');assert.equal(archives,0)
fail=false;await exporter.retry(session,job.id);await exporter.drive(session,job.id,{})
assert.equal(exporter.get(session,job.id).status,'completed');assert.equal(archives,1)
await exporter.drive(session,job.id,{});assert.equal(archives,1)
const added=await exporter.begin(session,{execution:'inline'})
history=[...entries,{seq:3,role:'assistant',text:'新增剧情不混入冻结稿。'}]
await exporter.drive(session,added.id,{})
assert.equal(exporter.get(session,added.id).source.entries.length,2)
const stale=await exporter.begin(session,{execution:'inline'})
history=history.filter(e=>e.seq!==2)
await exporter.drive(session,stale.id,{})
assert.equal(exporter.get(session,stale.id).status,'stale')
await exporter.refresh(session)
assert.equal(exporter.get(session,job.id).status,'stale','completed frozen export is marked outdated after its source is deleted')

// Checkpointed exports must survive a process rebuild without repeating chunks
// that were already independently reviewed.
{
  const table=new Table(), session={id:'novel-resume-three-chunks'}
  const block=(number)=>`〈第${number}剧情块〉${'甲'.repeat(11_700)}。`
  const original=[
    {seq:101,role:'assistant',text:block('一')},
    {seq:102,role:'assistant',text:block('二')},
    {seq:103,role:'assistant',text:block('三')},
  ]
  let source=original, failSecond=true, archiveText=''
  const calls=[]
  const request=async spec=>{
    const input=JSON.parse(spec.user)
    calls.push({phase:input.phase,seqs:(input.units??[]).map(unit=>unit.seq)})
    if(input.phase==='plan')return spec.validate({title:'三段续稿',chapters:input.chunks.map((chunk,index)=>({title:`第${index+1}章`,chunk_ids:[chunk.id]}))})
    if(input.phase==='edit') {
      if(failSecond&&input.units[0].seq===102)throw new Error('second chunk interrupted')
      return spec.validate({paragraphs:input.units.map(unit=>({source_ids:[unit.id],text:unit.text}))})
    }
    return spec.validate({approved:true,checked_source_ids:input.units.map(unit=>unit.id),issues:[]})
  }
  const make=()=>createNovelExports({table,history:()=>source,request,archive:async(_session,_job,markdown)=>{
    archiveText=markdown;return {id:'resumed-resource',path:'resumed.md'}
  }})
  const first=make(), job=await first.begin(session,{execution:'inline'})
  assert.equal(first.get(session,job.id).chunks.length,3,'three ~12K entries form three independent durable chunks')
  await first.drive(session,job.id,{})
  assert.equal(first.get(session,job.id).status,'failed')
  assert.deepEqual(calls.filter(call=>call.phase==='edit').map(call=>call.seqs[0]),[101,102])
  assert.deepEqual(calls.filter(call=>call.phase==='review').map(call=>call.seqs[0]),[])

  // New exporter instance simulates the runtime restart. Retry continues from
  // the persisted verified first chunk and never asks it to edit/review again.
  const before=calls.length
  const resumed=make()
  failSecond=false
  await resumed.retry(session,job.id)
  await resumed.drive(session,job.id,{})
  assert.equal(resumed.get(session,job.id).status,'completed')
  const continuation=calls.slice(before)
  assert.deepEqual(continuation.filter(call=>call.phase==='edit').map(call=>call.seqs[0]),[102,103])
  assert.deepEqual(continuation.filter(call=>call.phase==='review').map(call=>call.seqs[0]),[])
  for(const number of ['一','二','三'])assert.equal(archiveText.split(`〈第${number}剧情块〉`).length-1,1,`source block ${number} appears exactly once in final order-preserving Markdown`)
  assert.ok(archiveText.indexOf('〈第一剧情块〉')<archiveText.indexOf('〈第二剧情块〉')&&archiveText.indexOf('〈第二剧情块〉')<archiveText.indexOf('〈第三剧情块〉'))

  // The source is frozen at begin: later appended plot cannot leak in.
  const frozen=await resumed.begin(session,{execution:'inline'})
  source=[...original,{seq:104,role:'assistant',text:'〈追加剧情〉不得混入冻结导出。'}]
  await resumed.drive(session,frozen.id,{})
  assert.equal(resumed.get(session,frozen.id).status,'completed')
  assert.doesNotMatch(archiveText,/追加剧情/)

  // Editing one of a new job's frozen source records makes that job stale.
  const stale=await resumed.begin(session,{execution:'inline'})
  source=source.map(entry=>entry.seq===102?{...entry,text:'〈第二剧情块已编辑〉'}:entry)
  await resumed.drive(session,stale.id,{})
  assert.equal(resumed.get(session,stale.id).status,'stale')
}
// Produced by the pre-TypeScript exporter, interrupted after chunk validation.
const legacy=JSON.parse(readFileSync(new URL('./fixtures/novel-export-legacy-v1.json',import.meta.url),'utf8'))
{
  assert.deepEqual(novelUnits(legacy.history),legacy.job.chunks.flatMap(chunk=>chunk.units),'unit IDs, offsets and JSON-encoded hashes match the old runtime')
  assert.equal(taskHash(legacy.job.source),legacy.job.sourceHash,'source hash remains stable across migration')
  for(const chunk of legacy.job.chunks)assert.equal(taskHash(chunk.units),legacy.job.results[chunk.id].sourceHash)
  const table=new Table(),session={id:legacy.job.sessionId};let calls=0,archives=0
  table.set(`tavern_novel__${legacy.job.id}`,structuredClone(legacy.job))
  const api=createNovelExports({table,history:()=>structuredClone(legacy.history),
    request:async()=>{calls++;throw new Error('verified legacy work must not request a model')},
    archive:async(_session,_job,markdown)=>{archives++;assert.equal(markdown,legacy.expectedMarkdown);return {id:'legacy-result',path:'legacy.md'}}})
  const read=api.get(session,legacy.job.id);read.source.entries[0].text='external mutation'
  assert.deepEqual(table.get(`tavern_novel__${legacy.job.id}`),legacy.job,'snapshots retain copy ownership')
  const retried=await api.retry(session,legacy.job.id)
  assert.notEqual(retried.generation,legacy.job.generation)
  assert.deepEqual(retried.results,legacy.job.results)
  assert.equal((await api.drive(session,legacy.job.id,{})).status,'completed')
  assert.equal(calls,0);assert.equal(archives,1)
}
{
  for(const mutate of [
    job=>{job.schemaVersion=2},job=>{job.source.entries=null},job=>{job.chunks[0].units=[]},
    job=>{job.results['chunk-0'].draft.paragraphs[0].text=null},job=>{job.plan.chapters[0].chunk_ids=null},
    job=>{job.plan.chapters[0].chunk_ids=[]},job=>{job.plan.chapters[0].chunk_ids=['chunk-0','chunk-0']},
    job=>{job.plan.chapters[0].chunk_ids=['unknown']},job=>{job.chunks.push(structuredClone(job.chunks[0]))},
  ]){
    const job=structuredClone(legacy.job);mutate(job)
    const table=new Table(),session={id:job.sessionId},key=`tavern_novel__${job.id}`
    table.set(key,job)
    const before=structuredClone(job)
    const api=createNovelExports({table,history:()=>legacy.history,request:async()=>assert.fail('no request'),archive:async()=>assert.fail('no archive')})
    assert.throws(()=>api.get(session,job.id),/记录损坏|来源覆盖/)
    await assert.rejects(api.cancel(session,job.id),/记录损坏|来源覆盖/)
    assert.deepEqual(table.get(key),before,'invalid records are reported without overwriting recovery evidence')
  }
  for(const input of [null,{paragraphs:[null]},{paragraphs:[{source_ids:[1]}]},{paragraphs:[{source_ids:'not-an-array'}]}])assert.throws(()=>validateNovelChunk(units,input))
}
{
  const table=new Table(),job=structuredClone(legacy.job),session={id:job.sessionId}
  job.results['chunk-0'].draft.paragraphs[0].text='A summary with missing source clauses.'
  table.set(`tavern_novel__${job.id}`,job)
  const api=createNovelExports({table,history:()=>legacy.history,request:async()=>assert.fail('no request'),archive:async()=>assert.fail('invalid saved prose cannot be archived')})
  assert.equal((await api.drive(session,job.id,{})).status,'failed')
  assert.match(api.get(session,job.id).error,/遗漏|来源/)
}
{
  const table=new Table(),session={id:'novel-cancel-in-flight'}
  let release,entered,requests=0,archives=0
  const admitted=new Promise(resolve=>{entered=resolve})
  const pending=new Promise(resolve=>{release=resolve})
  const api=createNovelExports({table,history:()=>entries,request:async spec=>{
    requests++;entered();await pending
    const input=JSON.parse(spec.user)
    return spec.validate({title:'Cancelled',chapters:[{title:'Chapter',chunk_ids:input.chunks.map(chunk=>chunk.id)}]})
  },archive:async()=>{archives++;return {id:'wrong',path:'wrong.md'}}})
  const job=await api.begin(session,{execution:'spawn'})
  const first=api.drive(session,job.id,{})
  await admitted
  const second=api.drive(session,job.id,{})
  const cancelled=await api.cancel(session,job.id);release()
  assert.notEqual(cancelled.generation,job.generation)
  assert.equal((await first).status,'cancelled');assert.equal((await second).status,'cancelled')
  assert.equal(requests,1);assert.equal(archives,0)
  assert.equal(api.get(session,job.id).plan,undefined,'late plan cannot publish across the generation fence')
}
{
  const table=new Table(),session={id:'novel-inline-admission'}
  const api=createNovelExports({table,history:()=>entries,request:async()=>{throw new InlinePending('inline')},archive:async()=>assert.fail('no archive')})
  const job=await api.begin(session,{execution:'inline'})
  await assert.rejects(api.drive(session,job.id,{}),error=>error.code==='TAVERN_INLINE_PENDING')
  assert.equal(api.get(session,job.id).status,'waiting-main')
  assert.equal(api.get(session,job.id).error,null)
}
console.log('novel-export=ok (coverage, legacy hashes/checkpoints, typed decoding, frozen cutoff, cancellation, inline admission)')
