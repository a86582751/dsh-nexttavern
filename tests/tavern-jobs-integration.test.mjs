import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import {testTempRoot as tmpdir} from '../tools/test-temp.mjs'
import { join } from 'node:path'
import { apply } from '../preset/lib/roleplay-core.js'
import { createTavernLibrary } from '../src/core/tavern-library.js'
import { pngCrc } from '../src/core/tavern-card.js'

class Table extends Map {
  async put(key, value) { this.set(key, structuredClone(value)) }
  async update(key, update) { const value = update(structuredClone(this.get(key))); await this.put(key, value); return value }
}

const workspace = mkdtempSync(join(tmpdir(), 'dsh-tavern-jobs-'))
try {
  const tables = new Map(), hooks = new Map(), tools = new Map(), routes = new Map(), services = new Map(), cleanup = []
  const table = name => { if (!tables.has(name)) tables.set(name, new Table()); return tables.get(name) }
  const story = [
    { seq: 11, role: 'user', text: '我把三只蓝瓶放到温室门前。' },
    { seq: 12, role: 'assistant', text: '“等月落再开门。”阿明递来七枚银叶。' },
    { seq: 13, role: 'user', text: '我等到铜灯熄灭。' },
    { seq: 14, role: 'assistant', text: '温室铜钥匙终于转动，雨水渗进靴子。' },
  ]
  const text = value => [{ type: 'text', text: value }]
  const session = { id: 'jobs-integration', header: { agentPreset: 'roleplay', cwd: workspace }, events: [], surface: { nodes: [] }, seq: 0 }
  session.append = (type, data, options = {}) => {
    const event = { seq: session.seq++, type, data: structuredClone(data), surfaceOp: options.surfaceOp, time: Date.now() }
    session.events.push(event)
    if (options.surfaceOp === 'append') session.surface.nodes.push(event.seq)
    return event
  }
  // This is deliberately visible in the raw session but absent from compaction
  // evidence: export must use the selected, compacted story only.
  session.append('user/message', { id: 'management', role: 'user', source: { kind: 'plugin', plugin: 'roleplay-tasks', form: 'phase', stage: 'management' }, content: text('不要把这条管理指令写进小说。') }, { surfaceOp: 'append' })
  const inbox = []
  const agent = { session, status: 'idle', options: { provider: 'fixture', model: 'main', reasoningEffort: 'high' }, steer: message => inbox.push(message) }
  let spawns = 0, direct = 0
  const ctx = {
    storageDomain: { async open() { return { table, close() {} } } }, sessions: { get: id => id === session.id ? session : null },
    sessionController: { async resolveAgent(id) { return id===session.id?{ agent }:{error:'not found'} } },
    llm: { async *stream() { direct++; throw new Error('direct stream is forbidden') }, listProviders: () => [], async listModels() { return [] } },
    subagents: { async start() { spawns++; throw new Error('all-main must not spawn') } }, tokenMeter: { measure() { return { nodes: [] } } },
    agentDefaultModel: { currentSelection: () => agent.options }, systemPrompt: { variable: () => () => {}, section: () => () => {} },
    tools: { register(tool) { tools.set(tool.name, tool); return () => {} } }, commands: { register() { return () => {} } },
    connection: { fetch: { register(route) { routes.set(route.path, route); return () => {} } } }, fs: {}, logger: { info() {}, warn() {} },
    effect(fn) { const dispose = fn(); if (typeof dispose === 'function') cleanup.push(dispose) },
    on(name, fn) { if (!hooks.has(name)) hooks.set(name, []); hooks.get(name).push(fn); return () => {} },
    provide(name, value) { services.set(name, value) },
    get(name) { return name === 'compaction' ? { storyEvidence: target => target === session ? structuredClone(story) : [] } : services.get(name) },
  }
  await apply(ctx, {})
  const request = async (method, path, body) => {
    const response = await routes.get(path.split('?')[0]).fetch(new Request(`https://fixture.test${path}`, body === undefined ? { method } : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
    return { response, body: await response.json() }
  }
  const signal = new AbortController().signal
  for(const path of ['jobs','resources','resource','download'])assert.equal((await request('GET',`/api/roleplay/${path}?sessionId=missing`)).response.status,404)
  assert.equal((await request('POST','/api/roleplay/jobs',{sessionId:'missing',kind:'novel-export'})).response.status,404)
  for(const body of [{action:'invalid'},{kind:'invalid'},{action:'retry'},{action:'cancel'}])assert.equal((await request('POST','/api/roleplay/jobs',{sessionId:session.id,...body})).response.status,400)
  const resolveAgent=ctx.sessionController.resolveAgent
  ctx.sessionController.resolveAgent=async()=>({})
  assert.equal((await request('POST','/api/roleplay/jobs',{sessionId:session.id,kind:'novel-export'})).response.status,409)
  ctx.sessionController.resolveAgent=resolveAgent
  // Telemetry routes are backed by real native stream attempts and validated
  // session ownership, independent of export workflow completion.
  for await(const _chunk of hooks.get('llm/stream')[0]({sessionId:session.id,provider:'fixture',model:'main'},async function*(){yield {type:'usage',usage:{inputTokens:12,outputTokens:3,cacheReadTokens:8,cacheWriteTokens:0}};yield {type:'finish',reason:{kind:'stop'}}})){}
  const measured=await request('GET',`/api/roleplay/usage?sessionId=${session.id}&scope=all&from=0&to=${Date.now()+1}`)
  assert.equal(measured.body.totals.calls,1)
  assert.equal(measured.body.totals.cost,null)
  const priced=await request('POST','/api/roleplay/prices',{sessionId:session.id,expectedRevision:0,settings:{currency:'USD',rates:[{provider:'fixture',model:'main',input:1,output:2,cacheRead:.1}]}})
  assert.equal(priced.body.prices.revision,1)
  const missingRevision=await request('POST','/api/roleplay/prices',{sessionId:session.id,settings:{currency:'USD',rates:[]}})
  assert.equal(missingRevision.response.status,409,'price updates require an explicit revision')
  const fxNow=Date.now()
  await table('branch').put('tavern_exchange_rates',{schemaVersion:1,rates:{USD:1,CNY:7},rateAt:fxNow,fetchedAt:fxNow,nextUpdateAt:fxNow+86400000})
  await table('branch').put('tavern_price_catalog',{schemaVersion:1,source:'fixture',currency:'USD',unit:'per-million-tokens',fetchedAt:fxNow,entries:[
    {key:'fixture/selected',name:'Selected old',provider:'fixture',model:'selected',providerName:'Fixture',releaseDate:null,rates:{input:1,output:1,cacheRead:null,cacheWrite:null},tiers:[],unsupportedTiers:false},
    {key:'fixture/match-one',name:'Matching entry one',provider:'fixture',model:'match-one',providerName:'Fixture',releaseDate:null,rates:{input:2,output:2,cacheRead:null,cacheWrite:null},tiers:[],unsupportedTiers:false},
    {key:'fixture/selected',name:'Selected new',provider:'fixture',model:'selected',providerName:'Fixture',releaseDate:null,rates:{input:3,output:3,cacheRead:null,cacheWrite:null},tiers:[],unsupportedTiers:false},
    {key:'fixture/match-two',name:'Matching entry two',provider:'fixture',model:'match-two',providerName:'Fixture',releaseDate:null,rates:{input:4,output:4,cacheRead:null,cacheWrite:null},tiers:[],unsupportedTiers:false},
  ]})
  const catalog=await request('GET',`/api/roleplay/price-catalog?sessionId=${session.id}&q=matching&keys=${encodeURIComponent(JSON.stringify(['fixture/selected']))}`)
  assert.deepEqual(catalog.body.entries.map(entry=>[entry.key,entry.name]),[
    ['fixture/selected','Selected new'],['fixture/match-one','Matching entry one'],['fixture/match-two','Matching entry two'],
  ],'selected entries precede matches while duplicate keys retain their first position and last value')
  const invalidCatalogKeys=[
    '{}',
    JSON.stringify(Array.from({length:501},(_,i)=>`fixture/${i}`)),
    JSON.stringify(['fixture/ok',7]),
    JSON.stringify(['x'.repeat(801)]),
  ]
  for(const keys of invalidCatalogKeys){
    const invalid=await request('GET',`/api/roleplay/price-catalog?sessionId=${session.id}&keys=${encodeURIComponent(keys)}`)
    assert.equal(invalid.response.status,400,'invalid price-catalog key selection is rejected')
  }
  const savedCatalog=table('branch').get('tavern_price_catalog')
  await table('branch').put('tavern_price_catalog',{...savedCatalog,entries:Array.from({length:105},(_,i)=>({...savedCatalog.entries[0],key:`fixture/${i}`,name:`Match ${i}`}))})
  const limited=await request('GET',`/api/roleplay/price-catalog?sessionId=${session.id}&q=match&keys=${encodeURIComponent(JSON.stringify(['fixture/104']))}`)
  assert.deepEqual(limited.body.entries.map(entry=>entry.key),['fixture/104',...Array.from({length:100},(_,i)=>`fixture/${i}`)],'selected entries beyond the 100-match limit remain first')
  await table('branch').put('tavern_price_catalog',savedCatalog)
  const usdStats=await request('GET',`/api/roleplay/usage?sessionId=${session.id}&currency=USD&from=0&to=${Date.now()+1}`)
  const cnyStats=await request('GET',`/api/roleplay/usage?sessionId=${session.id}&currency=CNY&from=0&to=${Date.now()+1}`)
  assert.ok(Math.abs(cnyStats.body.totals.cost-usdStats.body.totals.cost*7)<1e-12)
  assert.equal(cnyStats.body.currency,'CNY');assert.equal(cnyStats.body.fx.rate,7)
  const requestRows=await request('GET',`/api/roleplay/usage-requests?sessionId=${session.id}&currency=CNY&from=0&to=${Date.now()+1}&limit=1`)
  assert.equal(requestRows.body.total,1);assert.equal(requestRows.body.rows.length,1)
  assert.equal(requestRows.body.rows[0].provider,'fixture');assert.equal(requestRows.body.rows[0].usage.inputTokens,12)
  assert.equal(requestRows.body.rows[0].cost,cnyStats.body.totals.cost)
  assert.equal((await request('GET','/api/roleplay/usage-requests?sessionId=not-roleplay')).response.status,404)
  assert.equal((await request('GET',`/api/roleplay/prices?sessionId=${session.id}`)).body.prices.currency,'USD','display conversion must not rewrite saved prices')
  assert.equal((await request('GET',`/api/roleplay/usage?sessionId=${session.id}&currency=invalid`)).response.status,400)
  assert.equal((await request('POST','/api/roleplay/exchange-rate',{sessionId:'invalid',action:'sync'})).response.status,404)
  const conflict=await request('POST','/api/roleplay/prices',{sessionId:session.id,expectedRevision:0,settings:{currency:'USD',rates:[]}})
  assert.equal(conflict.response.status,409)
  assert.equal((await request('GET',`/api/roleplay/logs?sessionId=${session.id}&from=0&to=${Date.now()+1}`)).body.rows.length,1)
  assert.equal((await request('GET','/api/roleplay/usage?sessionId=not-a-roleplay-session')).response.status,404)
  const unauthorizedTelemetry=[
    ['GET','/api/roleplay/exchange-rate?sessionId=not-roleplay'],
    ['POST','/api/roleplay/exchange-rate',{sessionId:'not-roleplay',action:'sync'}],
    ['GET','/api/roleplay/price-catalog?sessionId=not-roleplay'],
    ['POST','/api/roleplay/price-catalog',{sessionId:'not-roleplay',action:'sync'}],
    ['GET','/api/roleplay/usage?sessionId=not-roleplay'],
    ['GET','/api/roleplay/usage-requests?sessionId=not-roleplay'],
    ['GET','/api/roleplay/logs?sessionId=not-roleplay'],
    ['GET','/api/roleplay/prices?sessionId=not-roleplay'],
    ['POST','/api/roleplay/prices',{sessionId:'not-roleplay',expectedRevision:0,settings:{currency:'USD',rates:[]}}],
  ]
  for(const [method,path,body] of unauthorizedTelemetry){
    const result=await request(method,path,body)
    assert.equal(result.response.status,404,`unauthorized ${method} telemetry route must return 404`)
  }
  const pre = hooks.get('agent/pre-step')[0]
  const runPre = async step => pre({ agent, turn: 1, step, messages: inbox.splice(0), signal }, async () => ({ kind: 'enter', messages: [] }))
  const task = () => [...table('branch').values()].find(value => value?.kind === 'novel-export' && value.execution === 'inline' && value.status === 'queued')
  const submit = async value => {
    const job = task(); assert.ok(job, 'expected one all-main pending task')
    const material = await tools.get('rp_task_read').execute({ id: job.id }, { agent, signal })
    assert.equal(material.nextOffset, null)
    const input = JSON.parse(material.text)
    await tools.get('rp_task_submit').execute({ id: job.id, generation: job.generation, result: value(input) }, { agent, signal })
    return input
  }

  // Explicit all-main overrides the legacy worker default and must never call
  // spawn or ctx.llm.stream.
  const model = await request('POST', '/api/roleplay/models', { sessionId: session.id, scope: 'session', settings: { allMain: true, routes: {} } })
  assert.equal(model.body.effective.allMain, true)
  const started = await request('POST', '/api/roleplay/jobs', { sessionId: session.id, kind: 'novel-export' })
  assert.equal(started.response.status, 202)
  assert.equal(started.body.job.execution, 'inline')
  const jobId = started.body.job.id

  await runPre(1)
  const plan = await submit(input => {
    assert.equal(input.kind, undefined)
    assert.match(input.user, /三只蓝瓶/)
    assert.doesNotMatch(input.user, /不要把这条管理指令/)
    const payload = JSON.parse(input.user)
    return { title: '月下温室', chapters: [{ title: '第一章', chunk_ids: payload.chunks.map(chunk => chunk.id) }] }
  })
  assert.match(plan.system, /组织章节/)
  await runPre(2)
  const edit = await submit(input => {
    const payload = JSON.parse(input.user)
    assert.match(input.user, /三只蓝瓶/)
    assert.match(input.user, /雨水渗进靴子/)
    assert.doesNotMatch(input.user, /不要把这条管理指令/)
    return { paragraphs: payload.units.map(unit => ({ source_ids: [unit.id] })) }
  })
  assert.match(edit.system, /小说段落/)
  await runPre(3)
  const listed = await request('GET', `/api/roleplay/jobs?sessionId=${session.id}`)
  const completed = listed.body.jobs.find(job => job.id === jobId)
  assert.equal(listed.body.jobs.filter(job=>job.parentJobId===jobId).length,2,'chapter planning and paragraph organization suffice; deterministic coverage adds no model review')
  assert.equal(completed.status, 'completed')
  assert.ok(completed.resourceId)
  const detail = await request('GET', `/api/roleplay/resource?sessionId=${session.id}&resourceId=${completed.resourceId}`)
  assert.match(detail.body.text, /三只蓝瓶/)
  assert.match(detail.body.text, /七枚银叶/)
  assert.match(detail.body.text, /雨水渗进靴子/)
  assert.doesNotMatch(detail.body.text, /不要把这条管理指令/)
  const download = await routes.get('/api/roleplay/download').fetch(new Request(`https://fixture.test/api/roleplay/download?sessionId=${session.id}&resourceId=${completed.resourceId}`))
  assert.match(download.headers.get('content-type'),/text\/markdown/)
  assert.match(download.headers.get('content-disposition'),/filename\*=UTF-8''/)
  assert.equal(download.headers.get('cache-control'),'private, no-store')
  assert.equal(download.headers.get('x-content-type-options'),'nosniff')
  assert.ok(download.headers.get('etag'))
  assert.equal(await download.text(), detail.body.text)
  const resources=await request('GET',`/api/roleplay/resources?sessionId=${session.id}`)
  assert.ok(resources.body.resources.some(r=>r.id===completed.resourceId));assert.ok(Array.isArray(resources.body.pending))
  for(const path of ['resource','download'])assert.equal((await request('GET',`/api/roleplay/${path}?sessionId=${session.id}&resourceId=missing`)).response.status,404)

  // A cancelled generation cannot be resurrected by a late submit; retry gets
  // a fresh generation and retains no late result from the cancelled attempt.
  const again = await request('POST', '/api/roleplay/jobs', { sessionId: session.id, kind: 'novel-export' })
  assert.notEqual(again.body.job.id, jobId)
  await runPre(5)
  const late = task()
  assert.ok(late)
  await request('POST', '/api/roleplay/jobs', { sessionId: session.id, action: 'cancel', jobId: again.body.job.id })
  await assert.rejects(tools.get('rp_task_submit').execute({ id: late.id, generation: late.generation, result: { title: 'late', chapters: [] } }, { agent, signal }), /取消|失效/)
  const cancelled = (await request('GET', `/api/roleplay/jobs?sessionId=${session.id}`)).body.jobs.find(job => job.id === again.body.job.id)
  assert.equal(cancelled.status, 'cancelled')
  await request('POST', '/api/roleplay/jobs', { sessionId: session.id, action: 'retry', jobId: again.body.job.id })
  await runPre(6)
  const retried = task()
  assert.ok(retried)
  assert.notEqual(retried.id, late.id)
  const branch=table('branch'),selection={execution:'inline',main:agent.options,actualRoute:agent.options}
  const card=(id,status='completed',sessionId=session.id)=>({schemaVersion:1,id,kind:'card-export',sessionId,generation:'original',status,selection,source:{sourceFile:null,sha256:'fixture'},createdAt:1,execution:'inline',actualRoute:agent.options})
  const putCard=record=>branch.set('tavern_cardjob__'+record.id,record)
  const child=(id,parentId,status='completed',createdAt=1)=>({schemaVersion:1,id,kind:'status',sessionId:session.id,generation:'child-original',status,source:{workflowId:parentId},createdAt,execution:'spawn',main:agent.options,actualRoute:{provider:'fixture',model:id},input:{private:'not in public job'}})
  const putChild=record=>branch.set('tavern_job__'+record.id,record)
  putCard(card('finished-card'))
  const beforeCompleted=structuredClone(branch.get('tavern_cardjob__finished-card'))
  for(const action of ['cancel','retry']){
    const result=await request('POST','/api/roleplay/jobs',{sessionId:session.id,action,jobId:'finished-card'})
    assert.equal(result.response.status,200);assert.equal(result.body.job.status,'completed')
    assert.deepEqual(branch.get('tavern_cardjob__finished-card'),beforeCompleted)
  }
  putCard(card('retry-card','failed'))
  putChild(child('old-card-child','retry-card','queued'))
  branch.set('import-receipt-fixture',{workflowId:'retry-card',workflowGeneration:'original',untouched:true})
  const cancelledCard=await request('POST','/api/roleplay/jobs',{sessionId:session.id,action:'cancel',jobId:'retry-card'})
  assert.equal(cancelledCard.body.job.status,'cancelled')
  const cancelledGeneration=branch.get('tavern_cardjob__retry-card').generation
  assert.notEqual(cancelledGeneration,'original')
  assert.equal(branch.get('tavern_job__old-card-child').status,'cancelled')
  await assert.rejects(tools.get('rp_task_submit').execute({id:'old-card-child',generation:'child-original',result:{}},{agent,signal}),/取消|失效/)
  const resumedCard=await request('POST','/api/roleplay/jobs',{sessionId:session.id,action:'retry',jobId:'retry-card'})
  assert.equal(resumedCard.body.job.status,'queued')
  const resumedGeneration=branch.get('tavern_cardjob__retry-card').generation
  assert.notEqual(resumedGeneration,cancelledGeneration)
  assert.equal(branch.get('import-receipt-fixture').workflowGeneration,resumedGeneration)
  assert.equal(branch.get('import-receipt-fixture').untouched,true)

  putCard(card('projection'))
  for(const record of [child('older','projection','completed',1),child('tie-first','projection','completed',100),child('tie-second','projection','completed',100)])putChild(record)
  putCard(card('foreign-card','completed','foreign'))
  const entries=branch.entries.bind(branch)
  let scans=0
  branch.entries=()=>{scans++;return entries()}
  const readJobs=()=>request('GET',`/api/roleplay/jobs?sessionId=${session.id}`)
  const projection=await readJobs(),initialScans=scans
  assert.equal(projection.body.jobs.find(j=>j.id==='projection').actualRoute.model,'tie-first')
  assert.equal(projection.body.jobs.find(j=>j.id==='projection').execution,'spawn')
  assert.equal(projection.body.jobs.find(j=>j.id==='tie-first').parentJobId,'projection')
  assert.ok(!projection.body.jobs.some(j=>j.id==='foreign-card'))
  assert.ok(!JSON.stringify(projection.body.jobs).includes('not in public job'))
  for(let i=0;i<250;i++){putCard(card('parent-'+i));putChild(child('latest-'+i,'parent-'+i))}
  scans=0
  const larger=await readJobs()
  assert.equal(scans,initialScans,'whole-table scan count must not grow with the number of parent jobs')
  assert.equal(larger.body.jobs.find(j=>j.id==='parent-249').actualRoute.model,'latest-249')
  branch.entries=entries

  const foreignWorkspace=mkdtempSync(join(workspace,'foreign-'))
  const foreignSession={id:'foreign',header:{agentPreset:'roleplay',cwd:foreignWorkspace}}
  const foreignLibrary=createTavernLibrary({workspace:foreignWorkspace,table:branch})
  const foreignResource=await foreignLibrary.archive({name:'foreign.md',type:'text/markdown',bytes:Buffer.from('foreign resource'),source:{sessionId:'foreign'}})
  const getSession=ctx.sessions.get
  ctx.sessions.get=id=>id==='foreign'?foreignSession:getSession(id)
  for(const path of ['resource','download']){
    assert.equal((await request('GET',`/api/roleplay/${path}?sessionId=${session.id}&resourceId=${foreignResource.id}`)).response.status,404)
  }
  const foreignRead=await request('GET',`/api/roleplay/resource?sessionId=foreign&resourceId=${foreignResource.id}`)
  assert.equal(foreignRead.response.status,200);assert.equal(foreignRead.body.text,'foreign resource')
  ctx.sessions.get=getSession
  const localLibrary=createTavernLibrary({workspace,table:branch})
  const chunk=(type,data=Buffer.alloc(0))=>{
    const header=Buffer.alloc(4),body=Buffer.concat([Buffer.from(type),data]),crc=Buffer.alloc(4)
    header.writeUInt32BE(data.length);crc.writeUInt32BE(pngCrc(body));return Buffer.concat([header,body,crc])
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=6
  const payload={spec:'chara_card_v2',spec_version:'2.0',data:{name:'Route PNG',description:'Complete card text'}}
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',Buffer.from([0])),chunk('tEXt',Buffer.from('chara\0'+Buffer.from(JSON.stringify(payload)).toString('base64'))),chunk('IEND')])
  const pngResource=await localLibrary.archive({name:'card.png',type:'image/png',bytes:png,source:{sessionId:session.id}})
  const pngRead=await request('GET',`/api/roleplay/resource?sessionId=${session.id}&resourceId=${pngResource.id}`)
  assert.equal(pngRead.response.status,200);assert.deepEqual(JSON.parse(pngRead.body.text),payload.data)
  const pngDownload=await routes.get('/api/roleplay/download').fetch(new Request(`https://fixture.test/api/roleplay/download?sessionId=${session.id}&resourceId=${pngResource.id}`))
  assert.equal(pngDownload.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await pngDownload.arrayBuffer()),png)
  assert.equal(spawns, 0); assert.equal(direct, 0)
  cleanup.reverse().forEach(dispose => dispose())
  console.log('tavern-jobs-integration=ok (all-main jobs, compacted story, native task handoff, archive download)')
} finally {
  rmSync(workspace, { recursive: true, force: true })
}
