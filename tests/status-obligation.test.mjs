import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { apply } from '../lib/core/roleplay-core.js'

// Exercise the registered runtime hooks, tools and HTTP projection. No Phase-A
// snapshot is supplied: status must survive missing preparation and restarts.
class Table extends Map {
  writes = []
  fail = null
  async put(key, value) {
    if (this.fail?.(key, value)) throw new Error('injected storage failure')
    const copy = structuredClone(value)
    this.set(key, copy)
    this.writes.push({ key, value: copy })
  }
  async update(key, fn) { await this.put(key, fn(structuredClone(this.get(key)))); return this.get(key) }
  async delete(key) { return super.delete(key) }
}
const text = value => [{ type: 'text', text: value }]
const html = '<style>.author-status{color:plum}</style><section class="author-status">位置：庭院</section>'
const spec = { text: '保留作者布局，按本轮正文更新位置', templateHtml: html }
const panel = { title: '本轮状态', html, fields: [{ label: '位置', value: '庭院' }] }
const drain = async () => { await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve)) }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

async function bench({ tables = new Map(), result = () => panel, otherResult = () => { throw new Error('unavailable memory worker') } } = {}) {
  const table = name => { if (!tables.has(name)) tables.set(name, new Table()); return tables.get(name) }
  const hooks = new Map(), tools = new Map(), routes = new Map(), services = new Map(), sessions = new Map(), sections = new Map()
  const cleanups = [], calls = []
  const ctx = {
    storageDomain: { async open() { return { table, close() {} } } },
    sessions: { get: id => sessions.get(id) },
    sessionController: { async resolveAgent(id) { return { agent: { session: sessions.get(id), status: 'idle' } } } },
    subagents: { async start(name, request) {
      assert.equal(name, 'spawn')
      assert.equal(request.agentOptions.provider, 'fixture-worker')
      assert.equal(request.agentOptions.model, 'fixture-worker')
      const payload = JSON.parse(request.prompt[0].text)
      if(payload.tasks) {
        const results=[],failures=[]
        await Promise.all(payload.tasks.map(async task=>{
          const native={system:task.system,user:task.user,request:structuredClone({...request,signal:undefined})}
          calls.push(native)
          try {results.push({taskId:task.taskId,generation:task.generation,value:await (task.system.includes('状态栏渲染生成器')?result(native):otherResult(native))})}
          catch(error){failures.push({taskId:task.taskId,generation:task.generation,failure:{message:error.message}})}
        }))
        return {id:`native-${calls.length}`,result:Promise.resolve({stopReason:'completed',structured:{results,failures}}),async dispose(){}}
      }
      const native = { system: payload.system, user: payload.user, request: structuredClone({ ...request, signal: undefined }) }
      calls.push(native)
      const value = await (payload.system.includes('状态栏渲染生成器') ? result(native) : otherResult(native))
      return { id: `native-${calls.length}`, result: Promise.resolve({ stopReason: 'completed', structured: value, output: [{ type: 'text', text: JSON.stringify(value) }] }), async dispose() {} }
    } },
    tokenMeter: { measure() { return { nodes: [] } } },
    agentDefaultModel: { currentSelection() { return { provider: 'fixture-main', model: 'fixture-main' } } },
    systemPrompt: { variable() { return () => {} }, section(section) { sections.set(section.name,section); return () => {} } },
    tools: { register(tool) { tools.set(tool.name, tool); return () => {} } },
    commands: { register() { return () => {} } },
    connection: { fetch: { register(route) { routes.set(route.path, route); return () => {} } } },
    logger: { info() {}, warn() {} }, fs: {},
    effect(fn) { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup) },
    on(name, fn) { if (!hooks.has(name)) hooks.set(name, []); hooks.get(name).push(fn); return () => {} },
    provide(name, value) { services.set(name, value) }, get: name => services.get(name),
  }
  // The owned session-format addon provides this service in production; the
  // loaded view supplies the same contract so edit recovery can run.
  ctx.nexttavernMessageEdits = {
    append: (session, targetSeq, identity, message) => session.append('roleplay/message-edit', { schemaVersion: 1, targetSeq, ...identity, text: message }),
    latest: (events, targetSeq) => events.filter(event => event?.type === 'roleplay/message-edit').findLast(event => event.data?.targetSeq === targetSeq) ?? null,
    current: (_session, events) => [...new Map(events.filter(event => event?.type === 'roleplay/message-edit')
      .map(event => [event.data.targetSeq, event])).values()],
  }
  await apply(ctx, { statusRetryMs: 60_000, workerProvider: 'fixture-worker', workerModel: 'fixture-worker' })
  const session = { id: 'status-fixture', header: { agentPreset: 'roleplay' }, events: [], surface: { nodes: [] }, seq: 0 }
  sessions.set(session.id, session)
  const append = (type, data, surfaceOp) => {
    const event = { seq: session.seq++, type, data, surfaceOp }
    session.events.push(event)
    if (surfaceOp === 'append') session.surface.nodes.push(event.seq)
    return event
  }
  const begin = (turn = 1) => {
    append('turn/start', { turn })
    append('user/message', { id: `u${turn}`, source: { kind: 'user' }, content: text(`走入庭院 ${turn}`) }, 'append')
  }
  const finish = (turn = 1, kind = 'completed') => {
    append('assistant/message', { turn, message: { id: `a${turn}`, content: text(`庭院剧情 ${turn}`) } }, 'append')
    return append('turn/end', { turn, reason: { kind } })
  }
  const emit = async (name, ...args) => { for (const fn of hooks.get(name) ?? []) await fn(...args); await drain() }
  const state = async () => {
    const response = await routes.get('/api/roleplay/state').fetch(new Request(`https://fixture.test/api/roleplay/state?sessionId=${session.id}`))
    assert.equal(response.status, 200)
    return response.json()
  }
  const dispose = () => cleanups.reverse().forEach(fn => fn())
  await table('status').put(`${session.id}__spec`, spec)
  return { table, tables, sessions, session, append, begin, finish, emit, state, dispose, tools, routes, calls, sections,
    current: () => table('status').get(`${session.id}__panel`),
    generations: () => [...table('status').values()].filter(v => v.trigger?.kind === 'turn-end'),
  }
}

// Suggestions remain structured for decision reuse, never in fallback status HTML.
{
  const options=[{label:'沿路前进',heart:true}]
  const b=await bench({result:()=>({fields:[{label:'位置',value:'庭院'}],options})})
  try {
    await b.table('status').put(`${b.session.id}__spec`,{text:'显示当前位置'})
    b.begin();await b.emit('session/event',b.session,b.finish())
    assert.match(b.current().panel.html,/庭院/)
    assert.doesNotMatch(b.current().panel.html,/沿路前进|下一步/)
    assert.equal(b.current().panel.options[0].label,options[0].label)
    assert.equal(b.calls.length,1,'display separation adds no generation call')
    assert.ok(b.calls[0].system.includes('行动建议只在独立决策卡展示'))
  } finally {b.dispose()}
}

// Imported Markdown layout/CSS assets are restored by code before publication.
{
  const css='.author-grid{display:grid;gap:10px}'
  const template='## Status\nRules stay in the card.\n```html\n<section class="author-grid">⟦位置⟧</section>\n```\n```css\n'+css+'\n```'
  const submitted='<section class="author-grid">庭院</section>'
  const b=await bench({result:()=>({html:submitted,fields:[{label:'位置',value:'庭院'}]})})
  try {
    await b.table('status').put(`${b.session.id}__spec`,{text:template,templateHtml:template})
    b.begin();await b.emit('session/event',b.session,b.finish())
    assert.equal(b.current().panel.html,'<style>'+css+'</style>'+submitted,'static CSS comes from the imported snapshot even when the model only returns settled HTML')
    assert.equal(b.current().panel.templateHtml,template,'stored source fences remain byte-identical')
    assert.equal(b.calls.length,1,'asset restoration must not retry or invoke a model')
    assert.equal(b.generations().at(-1).state,'completed')
  } finally {b.dispose()}
}

// An old author action area may be empty without failing the template contract.
{
  const template='<section class="facts"><p>⟦位置⟧</p><div class="rp-status__acts"><span class="actsTitle">可以试试</span><ol><li>⟦行动A⟧</li></ol></div></section>'
  const submitted=template.replace('⟦位置⟧','庭院').replace('可以试试','').replace('⟦行动A⟧','')
  const b=await bench({result:()=>({html:submitted,fields:[{label:'位置',value:'庭院'}],options:[{label:'沿路前进'}]})})
  try {
    await b.table('status').put(`${b.session.id}__spec`,{text:'旧卡要求状态栏输出行动建议',templateHtml:template})
    b.begin();await b.emit('session/event',b.session,b.finish())
    assert.equal(b.current().panel.html,submitted)
    assert.equal(b.current().panel.templateHtml,template,'preserve imported author source')
    assert.equal(b.calls.length,1,'empty action content requires no validation retry')
    assert.ok(b.calls[0].system.includes('保留原有结构与属性但清空该区标题和内容'))
  } finally {b.dispose()}
}

// Delimiter/quote normalization is allowed; changing static style or removing
// the author hook remains a validation failure with a useful field path.
for(const [replacement,valid] of [['--v:{{好感}}',true],['--v:62',true],['color:red',false],['--v:62;color:red',false]]) {
  const template='<section class="meter"><i style="--v:⟦好感⟧"></i></section>'
  const submitted=`<section class='meter'><i style='${replacement}'></i></section>`
  const b=await bench({result:()=>({html:submitted,fields:[{label:'好感',value:'62'}]})})
  try {
    await b.table('status').put(`${b.session.id}__spec`,{text:'好感',templateHtml:template})
    b.begin();await b.emit('session/event',b.session,b.finish())
    if(valid)assert.equal(b.current()?.panel.html,submitted)
    else {
      assert.equal(b.current(),undefined)
      const pending=[...b.table('branch').values()].find(value=>value?.kind==='status')
      assert.equal(pending.failure.schemaVersion,1)
      assert.equal(pending.failure.code,'STATUS_TEMPLATE_MISMATCH')
      assert.equal(pending.failure.issues[0].path,'html.attributes[1].style')
      const read=await b.tools.get('rp_task_read').execute({id:pending.id},{agent:{session:b.session}})
      assert.deepEqual(read.failure,pending.failure)
      assert.equal(read.remainingValidationAttempts,2)
      for(let i=0;i<2;i++)await assert.rejects(b.tools.get('rp_task_submit').execute({id:pending.id,generation:pending.generation,result:{html:submitted}},{agent:{session:b.session}}),/html.attributes\[1\].style/)
      const diagnostic=await b.tools.get('rp_diagnose').execute({},{agent:{session:b.session}})
      const failed=diagnostic.jobs.find(job=>job.id===pending.id)
      assert.equal(failed.status,'failed');assert.equal(failed.errorCode,'STATUS_TEMPLATE_MISMATCH')
      assert.equal(failed.validationFailures,3);assert.ok(failed.failedAt);assert.equal(failed.completedAt,null)
      assert.deepEqual(failed.failure,pending.failure)
      const response=await b.routes.get('/api/roleplay/jobs').fetch(new Request(`https://fixture/api/roleplay/jobs?sessionId=${b.session.id}`))
      const api=(await response.json()).jobs.find(job=>job.id===pending.id)
      assert.deepEqual(api.failure,failed.failure);assert.ok(api.failedAt)
      assert.ok(!JSON.stringify(failed).includes(submitted),'diagnostic must not include author HTML')
    }
  } finally {b.dispose()}
}

// Legacy diagnostic projection derives a known code without rewriting history.
{
  const b=await bench()
  try {
    const legacy={schemaVersion:1,id:'legacy-status',sessionId:b.session.id,kind:'status',status:'failed',
      error:'状态结果没有保留作者模板',validationFailures:3,createdAt:100,updatedAt:200,execution:'inline',actualRoute:{provider:'fixture',model:'main'}}
    await b.table('branch').put('tavern_job__legacy-status',legacy)
    const diagnostic=await b.tools.get('rp_diagnose').execute({},{agent:{session:b.session}})
    assert.equal(diagnostic.jobs[0].errorCode,'STATUS_TEMPLATE_MISMATCH')
    assert.equal(diagnostic.jobs[0].failedAt,new Date(200).toISOString())
    assert.equal(diagnostic.jobs[0].execution,'inline')
    assert.deepEqual(diagnostic.jobs[0].requested,{...legacy.actualRoute,reasoningEffort:null})
    assert.deepEqual(b.table('branch').get('tavern_job__legacy-status'),legacy)
  } finally {b.dispose()}
}

// Filled style slots are dynamic values, not changes to the author layout.
for (const slot of ['{{好感}}','⟦好感⟧']) {
  const template=`<style>.meter{height:4px}</style><section class="meter"><i style="--v:${slot}"></i><span>${slot}</span></section>`
  const filled=template.replaceAll(slot,'62')
  const b=await bench({result:()=>({html:filled,fields:[{label:'好感',value:'62'}]})})
  try {
    await b.table('status').put(`${b.session.id}__spec`,{text:'好感 {{好感}}',templateHtml:template})
    const section=b.sections.get('roleplay:rules').text({agent:{session:b.session}})
    b.begin(); await b.emit('session/event',b.session,b.finish())
    assert.equal(b.current()?.panel.html,filled,'filled dynamic inline style must be accepted')
    assert.ok(!section.includes('{{好感}}'),'registered system section must protect author slots')
    assert.equal(b.current().panel.templateHtml,template,'stored author source stays byte-identical')
    assert.equal(b.calls.length,1,'valid status requires no fallback call')
  } finally {b.dispose()}
}

// Native explicit clones carry the same proven story prefix, but storage rows
// must acquire the child's ownership before the selected-state reader uses them.
for (const legacyReady of [false, true]) {
  const b=await bench()
  try {
    await b.table('cards').put(`${b.session.id}__npc`,{name:'管理员',content:'值守庭院'})
    b.begin(); await b.emit('session/event',b.session,b.finish())
    const parentRecord=structuredClone(b.current()), count=b.calls.length
    // Alpha.7 states the inherited prefix length on the session itself; only the
    // parent identity stays in the header.
    const child={...b.session,id:`status-clone-${legacyReady}`,inheritedEventCount:b.session.seq,header:{agentPreset:'roleplay',parentSession:b.session.id},events:structuredClone(b.session.events),surface:structuredClone(b.session.surface)}
    b.sessions.set(child.id,child)
    if(legacyReady) {
      await b.table('branch').put(`${child.id}__meta`,{inheritanceState:'ready',inheritedFrom:b.session.id,inheritedAtSeedLength:b.session.seq})
      await b.table('status').put(`${child.id}__spec`,spec)
      await b.table('status').put(`${child.id}__panel`,parentRecord)
      await b.table('cards').put(`${child.id}__npc`,b.table('cards').get(`${b.session.id}__npc`))
    }
      const response=await b.routes.get('/api/roleplay/state').fetch(new Request(`https://fixture.test/api/roleplay/state?sessionId=${child.id}`))
      const state=await response.json()
      assert.equal(state.statusPanel?.sessionId,child.id,'cloned status must be visible under child ownership')
    assert.deepEqual(state.statusPanel.panel,parentRecord.panel)
    assert.deepEqual(b.current(),parentRecord,'parent state is immutable')
    assert.equal(b.calls.length,count,'state inheritance does not regenerate status')
    const add=(type,data,surfaceOp)=>{const e={seq:child.seq++,type,data,surfaceOp};child.events.push(e);if(surfaceOp==='append')child.surface.nodes.push(e.seq);return e}
    add('turn/start',{turn:2})
    add('user/message',{id:'clone-user-2',source:{kind:'user'},content:text('查看门锁')},'append')
    add('assistant/message',{turn:2,message:{id:'clone-answer-2',content:text('门锁完好')}},'append')
    await b.emit('session/event',child,add('turn/end',{turn:2,reason:{kind:'completed'}}))
    const request=b.calls.at(-1).user
    const context=JSON.parse(request.match(/当前分支状态依据、已提交前置状态及待结算剧情：[\s\S]*?<rp-content:[a-f0-9]{36,64}>\n([^\n]+)/)[1])
    assert.deepEqual(context.previousStatus,parentRecord.panel,'next child turn reuses the inherited checkpoint')
    assert.deepEqual(context.selectedStorySinceStatus.map(e=>e.text),['查看门锁','门锁完好'],'no full-history replay after cloning')
  } finally {b.dispose()}
}

for(const invalid of ['edited-prefix','outside-seed']) {
  const b=await bench()
  try {
    b.begin();await b.emit('session/event',b.session,b.finish())
    const child={...b.session,id:`status-clone-${invalid}`,inheritedEventCount:invalid==='outside-seed'?2:b.session.seq,header:{agentPreset:'roleplay',parentSession:b.session.id},events:structuredClone(b.session.events),surface:structuredClone(b.session.surface)}
    if(invalid==='edited-prefix')child.events[1].data.content=text('修改过的行动')
    b.sessions.set(child.id,child)
    const response=await b.routes.get('/api/roleplay/state').fetch(new Request(`https://fixture.test/api/roleplay/state?sessionId=${child.id}`))
    assert.equal((await response.json()).statusPanel,null,'unproven or post-fork state cannot be inherited')
  }finally{b.dispose()}
}

// Editing can invalidate the current panel without changing earlier completed
// status checkpoints. Recover accumulated state instead of resetting to the
// initial author template on the next ordinary action.
for (const removeCheckpoints of [false, true]) {
  const b = await bench({ result: () => ({ ...panel, fields: [{label:'供能',value:'3/3'}] }) })
  try {
    b.begin(); await b.emit('session/event', b.session, b.finish())
    if (removeCheckpoints) b.table('status').clear()
    else await b.table('status').put(`${b.session.id}__panel`, { ...b.current(), stale: true })
    b.begin(2); await b.emit('session/event', b.session, b.finish(2))
    const request = b.calls.at(-1).user
    const context = JSON.parse(request.match(/当前分支状态依据、已提交前置状态及待结算剧情：[\s\S]*?<rp-content:[a-f0-9]{36,64}>\n([^\n]+)/)[1])
    if (!removeCheckpoints) {
      assert.equal(context.previousStatus?.fields?.[0]?.value, '3/3', 'an invalidated current pointer must recover the earlier durable status checkpoint')
      assert.equal(context.previousStatusSource.assistantSeq, 2)
    } else {
      assert.ok(context.selectedStorySinceStatus?.some(entry => entry.text === '庭院剧情 1'), 'without a valid prior status, reconstruct from selected story evidence rather than initial values')
    }
    assert.match(b.current().provenance.storyContextHash, /^[a-f0-9]{64}$/)
  } finally { b.dispose() }
}

// A checkpoint whose own turn is unchanged is still stale when an earlier
// selected action was edited. The cumulative history hash must reject it.
{
  const b = await bench()
  try {
    b.begin(); await b.emit('session/event', b.session, b.finish())
    b.begin(2); await b.emit('session/event', b.session, b.finish(2))
    b.session.events[1].data.content = text('旧行动已改为留在门外')
    b.begin(3); await b.emit('session/event', b.session, b.finish(3))
    const request=b.calls.at(-1).user
    const context=JSON.parse(request.match(/当前分支状态依据、已提交前置状态及待结算剧情：[\s\S]*?<rp-content:[a-f0-9]{36,64}>\n([^\n]+)/)[1])
    assert.equal(context.previousStatus,null,'an unchanged later turn cannot validate accumulated state from edited earlier history')
    assert.equal(context.selectedStorySinceStatus[0].text,'旧行动已改为留在门外')
  } finally { b.dispose() }
}

// Older checkpoints can be recovered only across the same branch's original
// append-only prefix. A later replacement is never evidence for that prefix.
{
  const b=await bench({result:()=>({...panel,fields:[{label:'熔丝',value:'0'}]})})
  try {
    b.begin(); await b.emit('session/event',b.session,b.finish())
    for(const [key,value] of b.table('status')) {
      if(value.result?.provenance) delete value.result.provenance.historyHash
      if(value.provenance) delete value.provenance.historyHash
    }
    await b.table('status').put(`${b.session.id}__panel`,{...b.current(),stale:true})
    b.begin(2); await b.emit('session/event',b.session,b.finish(2))
    const request=b.calls.at(-1).user
    const context=JSON.parse(request.match(/当前分支状态依据、已提交前置状态及待结算剧情：[\s\S]*?<rp-content:[a-f0-9]{36,64}>\n([^\n]+)/)[1])
    assert.equal(context.previousStatus?.fields?.[0]?.value,'0','same-branch unchanged legacy prefix must retain known cumulative inventory')
    assert.equal(context.previousStatusSource.validation,'original-append-prefix')
    assert.equal(b.current().provenance.previousStatusSource.validation,'original-append-prefix')
    for(const value of b.table('status').values()) {
      if(value.result?.provenance) delete value.result.provenance.historyHash
      if(value.provenance) delete value.provenance.historyHash
    }
    const replacement=b.append('user/message',{id:'u1',source:{kind:'user'},content:text('早期行动改为不使用熔丝')},{op:'replace',start:1,end:1})
    b.session.surface.nodes=b.session.surface.nodes.map(seq=>seq===1?replacement.seq:seq)
    b.begin(3); await b.emit('session/event',b.session,b.finish(3))
    const changed=JSON.parse(b.calls.at(-1).user.match(/当前分支状态依据、已提交前置状态及待结算剧情：[\s\S]*?<rp-content:[a-f0-9]{36,64}>\n([^\n]+)/)[1])
    assert.equal(changed.previousStatus,null,'legacy checkpoint cannot survive a replacement in its cumulative prefix')
  } finally {b.dispose()}
}

// Native branch deletion preserves the surface. A late worker must respect
// the durable tombstone even though its old text/seq hashes still match.
{
  const pending = deferred()
  const b = await bench({ result: () => pending.promise })
  try {
    b.begin(); const end = b.finish()
    await b.table('branch').put('fork-group-delete-race', {
      schemaVersion: 2, groupId: 'delete-race',
      anchor: { sourceSessionId: b.session.id, sourceAssistantMessageId: 'a1' },
      members: [
        { sessionId: 'surviving-sibling', assistantMessageId: 'other', ordinal: 1, deleted: false },
        { sessionId: b.session.id, assistantMessageId: 'a1', ordinal: 2, deleted: false },
      ],
    })
    const hash = createHash('sha256').update('a1').digest('hex').slice(0, 24)
    await b.table('branch').put(`${b.session.id}__fork-anchor-${hash}`, { groupId: 'delete-race' })
    await b.emit('session/event', b.session, end)
    assert.equal(b.calls.length, 1)
    const audit = JSON.stringify(b.session.events)
    const response = await b.routes.get('/api/roleplay/branch').fetch(new Request('https://fixture.test/api/roleplay/branch', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete', sessionId: b.session.id, messageId: 'a1' }),
    }))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).nextSessionId, 'surviving-sibling')
    pending.resolve(panel)
    await drain()
    assert.equal(JSON.stringify(b.session.events), audit, 'delete retains the authoritative audit')
    assert.equal(b.current(), undefined, 'late status result must not publish into a deleted branch whose surface was retained')
  } finally { pending.resolve(panel); b.dispose() }
}

// Missing model tool call and missing Phase-A snapshot still produce a durable
// result; duplicate session/event and idle delivery converge without extra LLM.
{
  const b = await bench()
  try {
    b.begin(); const end = b.finish()
    await b.emit('session/event', b.session, end)
    assert.ok(b.current(), 'a completed turn without rp_status_set must generate status without a Phase-A snapshot')
    assert.equal(b.current().panel.html, html)
    assert.equal(b.current().schemaVersion, 1)
    assert.equal(b.current().sessionId, b.session.id)
    assert.equal(b.current().branchId, b.session.id)
    assert.match(b.current().provenance.sourceHash, /^[a-f0-9]{64}$/)
    assert.deepEqual(b.current().provenance.sourceSeqs, [1, 2])
    const before = b.calls.length
    await b.emit('session/event', b.session, end)
    await b.emit('agent/status', { agent: { session: b.session }, status: 'idle' })
    assert.equal(b.calls.length, before, 'duplicate triggers must not regenerate')
    assert.equal(b.generations().length, 1)
    assert.equal(b.generations()[0].state, 'completed')
    assert.equal(b.generations()[0].schemaVersion, 1)
    assert.equal(b.generations()[0].source.branchId, b.session.id)
    assert.equal(b.generations()[0].source.assistantSeq, 2)
    assert.equal(b.generations()[0].publicationState, 'published')
    assert.equal((await b.state()).statusGeneration.trigger.id, b.current().provenance.triggerId)
  } finally { b.dispose() }
}

// State accounting rules can live in imported worldbook/card/rule modules,
// not just the HTML/status spec. Preserve the complete selected-branch rules.
{
  const b = await bench()
  try {
    await b.table('status').put(`${b.session.id}__spec`, {text:html,templateHtml:html})
    await b.table('cards').put(`${b.session.id}__user`, {content:'FULL_AUTHOR_TEXT',sources:[{original:'AUDIT_ONLY_DUPLICATE'}]})
    b.begin(); await b.emit('session/event', b.session, b.finish())
    const prompt=b.calls[0].user
    assert.equal(prompt.split(html).length-1,1,'identical status text/template is sent once')
    assert.ok(prompt.includes('FULL_AUTHOR_TEXT'),'legacy persona conditions are retained until explicitly classified')
    assert.ok(!prompt.includes('AUDIT_ONLY_DUPLICATE'),'archival provenance is fenced in storage, not duplicated into generation')
    assert.match(b.current().provenance.fixedContextHash,/^[a-f0-9]{64}$/)
  } finally { b.dispose() }
}
{
  const b = await bench()
  try {
    const longRule = `取料完成：疲劳14，信任23。${'固定世界规则。'.repeat(2000)}不得把未选择的后续路线当成已发生。`
    await b.table('worldbook').put(`${b.session.id}__route`, { content: longRule, alwaysOn:true })
    await b.table('worldbook').put(`${b.session.id}__passive`, {id:'passive',name:'遥远国家',keywords:['遥远国家'],content:'UNQUERIED_PASSIVE_LORE'})
    await b.table('worldbook').put(`${b.session.id}__courtyard`, {id:'courtyard',name:'庭院',keywords:['庭院'],content:'COURTYARD_ACCOUNTING_FACT'})
    await b.table('cards').put(`${b.session.id}__user`, { content: '钥匙使用后仍保留一把' })
    await b.table('rules').put(`${b.session.id}__spec`, { narrative: [{content:'只结算正文实际完成的行为'}] })
    await b.table('worldbook').put('sibling__route', { content: 'SIBLING_SECRET_RULE' })
    b.begin(); await b.emit('session/event', b.session, b.finish())
    const prompt = JSON.stringify(b.calls[0])
    assert.ok(prompt.includes(longRule), 'status worker must receive complete fixed worldbook rules, including long tails')
    assert.ok(prompt.includes('钥匙使用后仍保留一把'))
    assert.ok(!prompt.includes('只结算正文实际完成的行为'),'creative method is not a status extraction input')
    assert.ok(prompt.includes('走入庭院 1'), 'status worker must receive selected user action as source evidence')
    assert.ok(!prompt.includes('SIBLING_SECRET_RULE'))
    assert.ok(!prompt.includes('UNQUERIED_PASSIVE_LORE'),'status worker cannot copy the passive database wholesale')
    assert.ok(prompt.includes('COURTYARD_ACCOUNTING_FACT'),'status worker queries facts relevant to the committed action')
    assert.match(b.current().provenance.fixedContextHash, /^[a-f0-9]{64}$/)
  } finally { b.dispose() }
}

{
  const b=await bench()
  try {
    await b.table('rules').put(`${b.session.id}__spec`,{core:'电荷上限为100，油瓶使用后消耗一瓶。',plot:'FUTURE_ROUTE_TEXT',style:'STYLE_EXAMPLE_TEXT',beautyCss:'.NOVEL_BEAUTY{color:red}',reply:'REPLY_METHOD_TEXT'})
    await b.table('cards').put(`${b.session.id}__npc`,{content:'UNRELATED_BIOGRAPHY\n\n钥匙使用后仍保留一把。'})
    b.begin(); await b.emit('session/event',b.session,b.finish())
    const prompt=b.calls[0].user
    for(const value of ['FUTURE_ROUTE_TEXT','STYLE_EXAMPLE_TEXT','NOVEL_BEAUTY','REPLY_METHOD_TEXT'])assert.ok(!prompt.includes(value),value)
    assert.ok(prompt.includes('电荷上限为100，油瓶使用后消耗一瓶。'))
    assert.ok(prompt.includes('钥匙使用后仍保留一把。'))
    assert.equal(prompt.split('庭院剧情 1').length-1,1,'current story is sent exactly once')
    assert.ok(!prompt.includes('selectedHistoryHash'),'internal validation hashes stay out of model input')
  } finally {b.dispose()}
}

// Editing fixed rules while generation is in flight must fence its old result;
// retry re-reads rules and records their hash before publishing.
{
  const pending = deferred()
  let ready = false
  const b = await bench({ result: () => ready ? panel : pending.promise })
  try {
    await b.table('worldbook').put(`${b.session.id}__route`, { content: 'old rule' })
    b.begin(); const end = b.finish()
    await b.emit('session/event', b.session, end)
    await b.table('worldbook').put(`${b.session.id}__route`, { content: 'new rule' })
    pending.resolve(panel); await drain()
    assert.equal(b.current(), undefined, 'old rule snapshot cannot publish after a rule edit')
    ready = true
    await b.emit('session/event', b.session, end)
    assert.ok(b.current())
    const hash = b.current().provenance.fixedContextHash
    await b.table('worldbook').put(`${b.session.id}__route`, { content: 'newest rule' })
    await b.emit('session/event', b.session, end)
    assert.notEqual(b.current().provenance.fixedContextHash, hash, 'completed result must refresh when fixed rules change')
  } finally { pending.resolve(panel); await drain(); b.dispose() }
}

// Restored legacy durable inputs remain readable after tool retirement.
{
  const b = await bench()
  try {
    await b.table('branch').put(`tavern_policy__${b.session.id}`, {schemaVersion:1,revision:1,allMain:true,routes:{}})
    b.begin()
    assert.equal(b.tools.has('rp_status_set'),false)
    await b.table('status').put(b.session.id+'__input-1', {
      schemaVersion:1,sessionId:b.session.id,branchId:b.session.id,turnId:1,userSeq:1,
      userHash:createHash('sha256').update('走入庭院 1').digest('hex'),panel,
      provenance:{actualRoute:{provider:'fixture-main',model:'fixture-main'},execution:'inline',inputKind:'tool'}
    })
    await b.emit('session/event', b.session, b.finish())
    assert.equal(b.current().panel.html, html)
    assert.equal(b.current().provenance.inputKind, 'tool')
    assert.equal(b.calls.length, 0)
    assert.equal(b.generations().length, 1)
  } finally { b.dispose() }
}

// An actual prepared turn can publish status while Phase B remains pending.
// Release the blocked workers only after the assertion, so this tests ordering
// rather than merely checking that a status-related function exists.
{
  const memory = deferred()
  const b = await bench({ otherResult: request =>
    /正史记录员|连续性检查员/.test(request.system) ? memory.promise : {} })
  try {
    b.begin()
    const messages = [{ id: 'u1', role: 'user', source: { kind: 'user' }, content: text('走入庭院 1') }]
    await b.emit('agent/pre-step', { agent: { session: b.session }, messages, turn: 1, step: 1 }, async () => ({ kind: 'enter', messages }))
    await b.emit('session/event', b.session, b.finish())
    assert.ok(b.calls.some(request => request.system.includes('正史记录员')), 'prepared fixture must actually start Phase B')
    assert.equal(b.table('branch').get(`${b.session.id}__phaseb-1`).state, 'running')
    assert.equal(b.current().panel.html, html, 'status publishes before memory workers resolve')
    memory.resolve({ deltas: [], conflicts: [] }); await drain()
    assert.equal(b.table('branch').get(`${b.session.id}__phaseb-1`).state, 'completed')
  } finally { memory.resolve({}); await drain(); b.dispose() }
}

// Static author styling is program-owned: omission or model edits do not
// justify another model request when the dynamic HTML structure is intact.
for (const returnedHtml of [html.replace('plum','black'),html.replace(/<style>[\s\S]*?<\/style>/,'')])
{
  const b = await bench({ result: () => ({ ...panel, html: returnedHtml }) })
  try {
    b.begin(); await b.emit('session/event', b.session, b.finish())
    assert.equal(b.current()?.panel.html, html,'program restores exact author stylesheet')
    assert.equal(b.calls.length, 1, 'static CSS repair does not invoke a model')
    assert.equal(b.generations()[0].state,'completed')
  } finally { b.dispose() }
}

{
 const first=deferred(),second=deferred()
 const b=await bench({result:r=>r.user.includes('庭院剧情 2')?second.promise:first.promise})
 try {
  b.begin(1);await b.emit('session/event',b.session,b.finish(1))
  b.begin(2);await b.emit('session/event',b.session,b.finish(2))
  first.resolve(panel);await drain()
  second.resolve(panel);await drain()
  assert.equal(b.current()?.turnId,2,'older status completing first cannot invalidate the newer frozen input basis')
  await b.emit('agent/status',{agent:{session:b.session},status:'idle'})
  assert.equal(b.calls.length,2,'recovery must reuse completed status despite a newer available historical baseline')
 } finally {first.resolve(panel);second.resolve(panel);b.dispose()}
}

// A failed durable result write must not leak a panel. Retry commits one result.
{
  const b = await bench()
  try {
    b.begin(); const end = b.finish()
    b.table('status').fail = (_key, value) => value.state === 'completed'
    await b.emit('session/event', b.session, end)
    assert.equal(b.current(), undefined)
    assert.equal(b.generations()[0].state, 'retry')
    b.table('status').fail = null
    await b.emit('session/event', b.session, end)
    const writes = b.table('status').writes
    assert.ok(writes.findIndex(write => write.value.state === 'completed') < writes.findIndex(write => write.key.endsWith('__panel')))
    assert.equal(b.current().panel.html, html)
  } finally { b.dispose() }
}
// Cold-reader recovery backfills only the latest visible legacy turn, without
// launching one paid worker for every old chapter in an existing session.
{
 const b=await bench()
 try {
  b.begin(1);b.finish(1);b.begin(2)
  await b.state();await drain()
  assert.equal(b.calls.length,0,'opening the panel during a new story must not start a separate historical status settlement')
  await b.emit('session/event',b.session,b.finish(2))
  assert.equal(b.calls.length,1,'the latest completed story settles the unprocessed selected prefix once')
  assert.equal(b.current().turnId,2)
 } finally {b.dispose()}
}
{
  const b = await bench()
  try {
    b.begin(1); b.finish(1); b.begin(2); b.finish(2)
    await b.state(); await drain()
    assert.equal(b.current().turnId, 2)
    assert.equal(b.calls.length, 1)
  } finally { b.dispose() }
}

// A fields-only worker may not silently replace an intact author's template
// with fallback CSS. Failure remains retryable, and success clears the error.
{
  let valid = false
  const b = await bench({ result: () => valid ? panel : { fields: panel.fields } })
  try {
    b.begin(); const end = b.finish()
    await b.emit('session/event', b.session, end)
    assert.equal(b.current(), undefined)
    assert.equal(b.generations()[0].state, 'waiting-main')
    const pending = [...b.table('branch').values()].find(value => value?.kind === 'status' && value.status === 'queued')
    assert.ok(pending, 'failed dedicated worker must leave a readable native task')
    const source = await b.tools.get('rp_task_read').execute({ id: pending.id, offset: 0, maxChars: 100000 }, { agent: { session: b.session } })
    assert.equal(source.id, pending.id, 'main-loop fixture reads the queued native task by its durable id')
    assert.equal(source.generation, pending.generation)
    await b.tools.get('rp_task_submit').execute({ id: pending.id, generation: pending.generation, result: panel }, { agent: { session: b.session } })
    await b.emit('agent/status', { agent: { session: b.session }, status: 'idle' })
    assert.equal(b.current().panel.html, html)
    assert.equal(b.calls.length, 1, 'main-loop recovery must not spawn the main model again')
    valid = true
    await b.emit('session/event', b.session, end)
    assert.equal(b.current().panel.html, html)
    assert.equal(b.generations()[0].state, 'completed')
    assert.equal(b.generations()[0].error, null)
    assert.equal(b.generations()[0].attempt, 2)
  } finally { b.dispose() }
}

// Commit a result before publishing the current-panel pointer. Retry a failed
// pointer write (including restart) from that result, without another worker.
{
  const b = await bench()
  let restored
  try {
    b.begin(); const end = b.finish()
    b.table('status').fail = key => key.endsWith('__panel')
    await b.emit('session/event', b.session, end)
    assert.equal(b.current(), undefined)
    assert.equal(b.generations()[0].state, 'completed')
    assert.equal(b.generations()[0].result.panel.html, html)
    b.table('status').fail = null
    b.dispose()
    restored = await bench({ tables: b.tables })
    Object.assign(restored.session, structuredClone(b.session))
    await restored.emit('agent/status', { agent: { session: restored.session }, status: 'idle' })
    assert.equal(restored.current().panel.html, html)
    assert.equal(restored.calls.length, 0, 'restart reuses the committed result')
  } finally { if (restored) restored.dispose(); else b.dispose() }
}

// Changing the selected surface while the worker is in flight fences both
// the durable result and its publication. Audit history remains untouched.
{
  const gate = deferred()
  const b = await bench({ result: () => gate.promise })
  try {
    b.begin(); const end = b.finish()
    await b.emit('session/event', b.session, end)
    const audit = structuredClone(b.session.events)
    b.session.surface.nodes = [1]
    gate.resolve(panel); await drain()
    assert.equal(b.current(), undefined)
    assert.equal(b.generations()[0].state, 'stale')
    assert.deepEqual(b.session.events, audit)
  } finally { b.dispose() }
}

// The idle compatibility path drains every completed turn, even with no live
// snapshots, and faster newer workers cannot be overwritten by older results.
{
  const first = deferred()
  const b = await bench({ result: request => JSON.parse(request.user.match(/当前分支状态依据、已提交前置状态及待结算剧情：[\s\S]*?<rp-content:[a-f0-9]{36,64}>\n([^\n]+)/)[1]).selectedStorySinceStatus.at(-1).text === '庭院剧情 1' ? first.promise : panel })
  try {
    await b.emit('agent/status', { agent: { session: b.session }, status: 'running' })
    b.begin(1); b.finish(1); b.begin(2); b.finish(2)
    await b.emit('agent/status', { agent: { session: b.session }, status: 'idle' })
    assert.equal(b.current().turnId, 2)
    first.resolve(panel); await drain()
    assert.equal(b.current().turnId, 2)
    assert.equal(b.generations().filter(v => v.state === 'completed').length, 2)
  } finally { b.dispose() }
}

// Explicit defaults are permitted only without a usable author template.
for (const templateHtml of ['', '<style>broken CSS']) {
  const b = await bench({ result: () => ({ fields: panel.fields }) })
  try {
    await b.table('status').put(`${b.session.id}__spec`, { text: '显示位置', templateHtml })
    b.begin(); await b.emit('session/event', b.session, b.finish())
    assert.match(b.current().panel.html, /庭院/)
    assert.equal(b.current().provenance.templateKind, templateHtml ? 'damaged' : 'missing')
  } finally { b.dispose() }
}

// Scene inputs must be at or before the status source turn. Later scene
// commits cannot leak backwards when queued workers run in a different order.
for (const sceneSeq of [1, 99]) {
  const b = await bench()
  try {
    b.begin(); const end = b.finish()
    await b.table('scene').put(`${b.session.id}__current`, { place: 'SCENE_EVIDENCE', updatedAtSeq: sceneSeq, sessionId: b.session.id })
    await b.emit('session/event', b.session, end)
    const prompt = b.calls.find(request => request.system.includes('状态栏渲染生成器')).user
    assert.equal(prompt.includes('SCENE_EVIDENCE'), sceneSeq === 1)
  } finally { b.dispose() }
}

// Reads must fence already-published records after a selected user is removed,
// not just reject workers which happened to be in flight during the mutation.
{
  const b = await bench()
  try {
    b.begin(); await b.emit('session/event', b.session, b.finish())
    assert.ok(b.current())
    b.session.surface.nodes = [2]
    const state = await b.state()
    assert.equal(state.statusPanel, null)
    assert.equal(state.statusGeneration.state, 'stale')
  } finally { b.dispose() }
}

// Maintenance shares the transaction, and cannot report success because an
// earlier result with the same trigger id still exists after publication fails.
{
  let title = 'before'
  const b = await bench({ result: () => ({ ...panel, title }) })
  const maintenance = async action => (await b.routes.get('/api/roleplay/maintenance').fetch(new Request('https://fixture.test/api/roleplay/maintenance', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: b.session.id, action }),
  }))).json()
  try {
    b.begin(); await b.emit('session/event', b.session, b.finish())
    title = 'after'
    b.table('status').fail = key => key.endsWith('__panel')
    await maintenance('status-rebuild'); await drain()
    assert.equal((await maintenance('status')).job.state, 'failed')
    assert.equal(b.current().panel.title, 'before')
    b.table('status').fail = null
    await b.emit('agent/status', { agent: { session: b.session }, status: 'idle' })
    assert.equal(b.current().panel.title, 'after')
    assert.equal(b.calls.length, 2, 'publication retry reuses the maintenance result')
  } finally { b.dispose() }
}

{
  const b = await bench()
  try {
    b.begin(); await b.emit('session/event', b.session, b.finish(1, 'error'))
    await b.emit('agent/status', { agent: { session: b.session }, status: 'idle' })
    assert.equal(b.current(), undefined)
    assert.equal(b.calls.length, 0)
  } finally { b.dispose() }
}
console.log('status-obligation=ok (native hooks, tool input, author template, retries, restart, branch fence, publication order)')

// Each later completed turn must replace the prior superseded decision. The
// first turn alone cannot detect an update callback that keeps answered cards.
{
  const b = await bench({ otherResult: () => ({}) })
  try {
    await b.table('branch').put(`tavern_policy__${b.session.id}`, {schemaVersion:1,revision:1,allMain:false,routes:{decision:{provider:'fixture-main',model:'fixture-main'}}})
    for (const turn of [1, 2]) {
      await b.emit('agent/status', { agent: { session: b.session }, status: 'running' })
      b.begin(turn)
      const messages = [{ id: `u${turn}`, role: 'user', source: { kind: 'user' }, content: text(`走入庭院 ${turn}`) }]
      await b.emit('agent/pre-step', { agent: { session: b.session }, messages, turn, step: 1 }, async () => ({ kind: 'enter', messages }))
      const user=b.session.events.findLast(e=>e.type==='user/message')
      await b.table('status').put(b.session.id+'__input-'+turn, {schemaVersion:1,sessionId:b.session.id,branchId:b.session.id,turnId:turn,userSeq:user.seq,userHash:createHash('sha256').update(user.data.message?.content?.[0]?.text??user.data.content?.[0]?.text??'').digest('hex'),panel:{...panel,options:[{label:'行动 '+turn}]},provenance:{actualRoute:{provider:'fixture-main',model:'fixture-main'},execution:'inline',inputKind:'tool'}})
      await b.emit('session/event', b.session, b.finish(turn))
      const decision = b.table('decision').get(`${b.session.id}__current`)
      assert.equal(decision.turnId, turn, 'a superseded earlier decision must not block a new turn')
      assert.equal(decision.answered, false)
      assert.equal(decision.options[0].label, `行动 ${turn}`)
    }
  } finally { b.dispose() }
}
console.log('decision-turn-publication=ok (later turn replaces superseded decision)')
