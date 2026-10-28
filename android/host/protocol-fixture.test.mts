import test from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {setTimeout as delay} from 'node:timers/promises'
import {createProtocolFixture,FIXTURE_REPLY,FIXTURE_MAINTENANCE_ACK,PACED_STREAM_MARKER,PROTOCOL_FIXTURE_ID,
  EMBEDDING_FIXTURE_ID,EMBEDDING_FIXTURE_MODEL,EMBEDDING_FIXTURE_DIMENSIONS,
  EMBEDDING_STORY_SENTENCE,EMBEDDING_DISTRACTOR_SENTENCE,EMBEDDING_QUERY} from './protocol-fixture.mts'

test('local fixture offers models and real streamed/nonstreamed OpenAI protocol without retaining prompt contents',async()=>{
  const {server,requests}=createProtocolFixture()
  server.listen(0,'127.0.0.1'); await once(server,'listening')
  const address=server.address()
  assert.ok(address && typeof address !== 'string')
  const base='http://127.0.0.1:'+address.port
  try {
    const catalog=await (await fetch(base+'/v1/models')).json()
    assert.equal(catalog.data[0].id,'nexttavern-fixture')
    for(const stream of [false,true]) {
      const reply=await fetch(base+'/v1/chat/completions',{method:'POST',body:JSON.stringify({model:'nexttavern-fixture',messages:[{role:'user',content:'test-only'}],stream})})
      assert.equal(reply.status,200)
      if(stream) {
        assert.match(reply.headers.get('content-type') ?? '',/event-stream/)
        const text=await reply.text()
        assert.match(text,/"finish_reason":"stop"/)
        assert.match(text,/data: \[DONE\]/)
      } else assert.match((await reply.json()).choices[0].message.content,/不是真实模型/)
    }
    assert.deepEqual(requests.map(record=>({stream:record.streamRequested,deltas:record.contentDeltas,
      completed:record.completed,aborted:record.aborted,paced:record.paced})),[
      {stream:false,deltas:0,completed:true,aborted:false,paced:false},
      {stream:true,deltas:1,completed:true,aborted:false,paced:false},
    ])
  } finally {server.close(); await once(server,'close')}
})

test('fixed synthetic marker emits multiple paced content deltas and only prompt/key/model-free counters',async()=>{
  const events:unknown[]=[]
  const fixture=createProtocolFixture({pacedDelayMs:5,onRequestEvent:record=>events.push(record)})
  const {server,requests}=fixture
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address();assert.ok(address&&typeof address!=='string')
  try {
    const response=await fetch('http://127.0.0.1:'+address.port+'/v1/chat/completions',{
      method:'POST',headers:{authorization:'Bearer test-credential-never-log'},
      body:JSON.stringify({model:'private-model-never-log',stream:true,
        messages:[{role:'user',content:PACED_STREAM_MARKER+' prompt-never-log'}]}),
    })
    const text=await response.text()
    const chunks=text.split('\n').filter(line=>line.startsWith('data: {')).map(line=>JSON.parse(line.slice(6)))
    const content=chunks.flatMap(chunk=>chunk.choices.map((choice:{delta?:{content?:string}})=>choice.delta?.content??'')).filter(Boolean)
    assert.ok(content.length>1)
    assert.equal(content.join(''),FIXTURE_REPLY)
    assert.match(text,/data: \[DONE\]/)
    assert.equal(requests[0].fixture,PROTOCOL_FIXTURE_ID)
    assert.equal(requests[0].contentDeltas,content.length)
    assert.equal(requests[0].completed,true)
    assert.equal(requests[0].aborted,false)
    assert.equal(fixture.pendingTimers,0)
    assert.doesNotMatch(JSON.stringify({requests,events}),/prompt-never-log|test-credential-never-log|private-model-never-log|authorization|messages/)
    assert.equal((events as {event:string}[]).filter(event=>event.event==='completed').length,1)
    // An old marker in history must not pace every later ordinary turn.
    const ordinary=await fetch('http://127.0.0.1:'+address.port+'/v1/chat/completions',{
      method:'POST',body:JSON.stringify({model:'nexttavern-fixture',stream:true,messages:[
        {role:'user',content:PACED_STREAM_MARKER},{role:'user',content:'ordinary-follow-up'},
      ]}),
    })
    await ordinary.text()
    assert.equal(requests[1].paced,false)
    assert.equal(requests[1].contentDeltas,1)
  } finally {server.closeAllConnections();server.close();await once(server,'close')}
})

test('disconnect cancels the owned pacing timer, records abort once, and never emits a later delta or completion',async()=>{
  const events:{event:string}[]=[]
  const observedAbort=new AbortController()
  const fixture=createProtocolFixture({pacedDelayMs:100,onRequestEvent:record=>{
    events.push(record);if(record.event==='aborted')observedAbort.abort()
  }})
  const {server,requests}=fixture
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address();assert.ok(address&&typeof address!=='string')
  try {
    const response=await fetch('http://127.0.0.1:'+address.port+'/v1/chat/completions',{
      method:'POST',body:JSON.stringify({model:'nexttavern-fixture',stream:true,
        messages:[{role:'user',content:[{type:'text',text:PACED_STREAM_MARKER}]}]}),
    })
    const reader=response.body!.getReader(),decoder=new TextDecoder()
    let partial=''
    while(!partial.includes('本地协议测试')) {
      const chunk=await reader.read();assert.equal(chunk.done,false)
      partial+=decoder.decode(chunk.value,{stream:true})
    }
    assert.equal(fixture.pendingTimers,1)
    await reader.cancel()
    if(!observedAbort.signal.aborted)await once(observedAbort.signal,'abort',{signal:AbortSignal.timeout(2000)})
    const emitted=requests[0].contentDeltas
    assert.ok(emitted>0)
    assert.equal(fixture.pendingTimers,0)
    await delay(200)
    assert.equal(requests[0].contentDeltas,emitted)
    assert.equal(requests[0].completed,false)
    assert.equal(requests[0].aborted,true)
    assert.equal(events.filter(record=>record.event==='aborted').length,1)
    assert.equal(events.filter(record=>record.event==='completed').length,0)
  } finally {server.closeAllConnections();server.close();await once(server,'close')}
})

test('online embedding fixture serves distinct fixed synthetic vectors with isolated text/key-free counters',async()=>{
  const events:unknown[]=[]
  const {server,requests,embeddingRequests}=createProtocolFixture({onEmbeddingEvent:record=>events.push(record)})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address();assert.ok(address&&typeof address!=='string')
  const base='http://127.0.0.1:'+address.port
  const embed=(input:unknown,dimensions?:number)=>fetch(base+'/v1/embeddings',{
    method:'POST',headers:{'content-type':'application/json',authorization:'Bearer embedding-key-never-log'},
    body:JSON.stringify({model:EMBEDDING_FIXTURE_MODEL,input,dimensions,encoding_format:'float'}),
  })
  try {
    const catalog=await (await fetch(base+'/v1/models')).json()
    assert.ok(catalog.data.some((row:{id:string})=>row.id===EMBEDDING_FIXTURE_MODEL))
    const response=await embed([EMBEDDING_STORY_SENTENCE,EMBEDDING_DISTRACTOR_SENTENCE,'private-text-never-log'],4)
    assert.equal(response.status,200)
    const body=await response.json()
    assert.equal(body.model,EMBEDDING_FIXTURE_MODEL)
    assert.deepEqual(body.data.map((row:{index:number;embedding:number[]})=>({index:row.index,embedding:row.embedding})),[
      {index:0,embedding:[3,0,0,0]},{index:1,embedding:[0,4,0,0]},{index:2,embedding:[0,0,2,0]},
    ])
    assert.deepEqual(body.usage,{prompt_tokens:24,total_tokens:24}) // Fixed synthetic usage, not measured billing.
    const query=await embed(EMBEDDING_QUERY)
    assert.equal(query.status,200)
    assert.deepEqual((await query.json()).data[0].embedding,body.data[0].embedding)
    const wrongDimensions=await embed([EMBEDDING_STORY_SENTENCE],8)
    assert.equal(wrongDimensions.status,400);await wrongDimensions.json()
    assert.equal(requests.length,0,'embedding traffic cannot affect chat request ordinals or stream counters')
    assert.deepEqual(embeddingRequests.map(row=>({request:row.request,inputCount:row.inputCount,
      dimensions:row.dimensions,completed:row.completed,aborted:row.aborted})),[
      {request:1,inputCount:3,dimensions:EMBEDDING_FIXTURE_DIMENSIONS,completed:true,aborted:false},
      {request:2,inputCount:1,dimensions:EMBEDDING_FIXTURE_DIMENSIONS,completed:true,aborted:false},
    ])
    assert.ok(embeddingRequests.every(row=>row.fixture===EMBEDDING_FIXTURE_ID))
    assert.equal((events as {event:string}[]).filter(row=>row.event==='completed').length,2)
    const counters=JSON.stringify({embeddingRequests,events})
    for(const privateValue of ['embedding-key-never-log','private-text-never-log',EMBEDDING_STORY_SENTENCE,
      EMBEDDING_DISTRACTOR_SENTENCE,EMBEDDING_QUERY,EMBEDDING_FIXTURE_MODEL,'authorization'])assert.ok(!counters.includes(privateValue))
  }finally{server.closeAllConnections();server.close();await once(server,'close')}
})

const fixtureOptions=[{label:'继续与旅人交谈',heart:false},{label:'询问旅人正在阅读的书',heart:false},{label:'静静观察酒馆',heart:false}]
const maintenanceTask=()=>({id:'current-task-private',generation:'current-generation-private',kind:'status',
  completeSource:true,input:{format:'json',system:'你是角色扮演工作台的状态栏渲染生成器。',
    user:'<rp-content:abc>\n'+JSON.stringify({previousStatus:null,selectedStorySinceStatus:[{role:'assistant',text:FIXTURE_REPLY}]})+'\n</rp-content:abc>'}})
const maintenanceMessage=(tasks:unknown[]= [maintenanceTask()])=>({role:'user',
  content:'当前是系统维护阶段，尚不能生成或续写剧情。\n待办：\n'+JSON.stringify(tasks)})
const maintenanceTools=[{type:'function',function:{name:'rp_task_submit',parameters:{type:'object',
  required:['id','generation','result'],properties:{id:{type:'string'},generation:{type:'string'},result:{}}}}}]

test('plain-card fixture submits real current identities over both protocols and stops after actual completed tool receipts',async()=>{
  const {server,requests}=createProtocolFixture({pacedDelayMs:1})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address();assert.ok(address&&typeof address!=='string')
  const post=(body:unknown)=>fetch('http://127.0.0.1:'+address.port+'/v1/chat/completions',{method:'POST',body:JSON.stringify(body)})
  try {
    let previousId=''
    for(const stream of [false,true]) {
      const messages=[{role:'user',content:PACED_STREAM_MARKER},maintenanceMessage()]
      const response=await post({stream,tools:maintenanceTools,messages})
      assert.equal(response.status,200)
      const raw=await response.text()
      const packets=stream?raw.split('\n').filter(line=>line.startsWith('data: {')).map(line=>JSON.parse(line.slice(6))):[]
      const calls=stream?packets.flatMap(packet=>packet.choices.flatMap((choice:any)=>choice.delta?.tool_calls??[]))
        :JSON.parse(raw).choices[0].message.tool_calls
      assert.equal(calls.length,1)
      assert.notEqual(calls[0].id,previousId)
      previousId=calls[0].id
      assert.equal(calls[0].function.name,'rp_task_submit')
      assert.deepEqual(JSON.parse(calls[0].function.arguments),{id:maintenanceTask().id,generation:maintenanceTask().generation,
        result:{title:'酒馆',fields:[{label:'位置',value:'酒馆'}],options:fixtureOptions}})
      assert.match(raw,/"finish_reason":"tool_calls"/)
      assert.equal(requests.at(-1)!.paced,false)
      assert.equal(requests.at(-1)!.contentDeltas,0)
      const followup=await post({stream,tools:maintenanceTools,messages:[...messages,
        {role:'assistant',content:null,tool_calls:calls},
        {role:'tool',tool_call_id:calls[0].id,content:JSON.stringify({ok:true,status:'completed',resultStored:true})}]})
      const ended=await followup.text()
      assert.equal(followup.status,200)
      assert.match(ended,/"finish_reason":"stop"/)
      assert.doesNotMatch(ended,/rp_task_submit|酒馆的灯亮着/)
      const ack=stream?ended.split('\n').filter(line=>line.startsWith('data: {')).map(line=>JSON.parse(line.slice(6)))
        .flatMap(packet=>packet.choices.map((choice:any)=>choice.delta?.content??'')).join('')
        :JSON.parse(ended).choices[0].message.content
      assert.equal(ack,FIXTURE_MAINTENANCE_ACK)
      assert.equal(requests.at(-1)!.contentDeltas,stream?1:0)
      assert.equal(requests.at(-1)!.toolcallCount,0)
      assert.equal(requests.at(-1)!.mode,'maintenance-complete')
    }
    const changed=maintenanceTask();changed.generation='new-generation-private'
    const next=await (await post({tools:maintenanceTools,messages:[maintenanceMessage([changed])]})).json()
    assert.equal(JSON.parse(next.choices[0].message.tool_calls[0].function.arguments).generation,changed.generation)
    assert.notEqual(next.choices[0].message.tool_calls[0].id,previousId)
    const prior={title:'保留',fields:[{label:'位置',value:'酒馆'},{label:'物品',value:'蓝色书签'}],rawText:'已确认状态'}
    const status=maintenanceTask()
    status.input.user=status.input.user.replace('"previousStatus":null','"previousStatus":'+JSON.stringify(prior))
    const decision={...maintenanceTask(),id:'decision-private',kind:'decision',input:{format:'json',
      system:'你是角色扮演工作台的轮末建议生成器。',user:FIXTURE_REPLY}}
    const semanticTools=[{type:'function',function:{name:'rp_task_submit',parameters:{required:['kind','result']}}}]
    const semantic=await (await post({tools:semanticTools,messages:[maintenanceMessage([status,decision])]})).json()
    const submitted=semantic.choices[0].message.tool_calls.map((call:any)=>JSON.parse(call.function.arguments))
    assert.deepEqual(submitted,[{kind:'status',result:prior},{kind:'decision',result:{options:fixtureOptions}}])
    status.input.user=status.input.user.replace(JSON.stringify(prior),JSON.stringify({...prior,html:{currentContextRef:'status'}}))
    const compact=await (await post({tools:semanticTools,messages:[maintenanceMessage([status])]})).json()
    assert.deepEqual(JSON.parse(compact.choices[0].message.tool_calls[0].function.arguments),{kind:'status',result:prior})
    assert.doesNotMatch(JSON.stringify(requests),/current-task-private|generation-private|继续交谈|schemaVersion.*variableCandidate/)
  } finally {server.closeAllConnections();server.close();await once(server,'close')}
})

test('unsupported or malformed maintenance fails explicitly without story prose, credentials, or fake completion',async()=>{
  const rejected:unknown[]=[]
  const {server,requests}=createProtocolFixture({onRejected:record=>rejected.push(record)})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address();assert.ok(address&&typeof address!=='string')
  try {
    const task=maintenanceTask()
    const cases=[
      {messages:[maintenanceMessage()],tools:[]},
      {messages:[maintenanceMessage([{...task,kind:'schema-maintenance'}])]},
      {messages:[maintenanceMessage([{...task,completeSource:false}])]},
      {messages:[maintenanceMessage([{...task,generation:''}])]},
      {messages:[maintenanceMessage([{...task,input:{...task.input,user:'unrecognized story'}}])]},
      {messages:[{role:'user',content:'当前是系统维护阶段，尚不能生成或续写剧情。\n待办：\n{broken-private'}]},
      {messages:[{role:'user',content:JSON.stringify({taskId:'private-background',format:'text',taskStage:'background-notes'})}]},
      {messages:[maintenanceMessage(),{role:'assistant',tool_calls:[{id:'call_1',function:{name:'rp_task_submit'}}]},
        {role:'tool',tool_call_id:'call_1',content:JSON.stringify({ok:false,error:'private error'})}]},
      {messages:[maintenanceMessage()],tools:[{type:'function',function:{name:'private-unknown-tool'}},
        {type:'function',function:{name:'run_code'}}]},
    ]
    for(const candidate of cases) {
      const response:Response=await fetch('http://127.0.0.1:'+address.port+'/v1/chat/completions',{
        method:'POST',body:JSON.stringify({stream:true,tools:maintenanceTools,...candidate})})
      assert.equal(response.status,422)
      const raw=await response.text()
      assert.match(raw,/Unsupported or malformed/)
      assert.doesNotMatch(raw,/private|酒馆的灯亮着|tool_calls|completed/)
    }
    assert.equal(requests.length,0)
    assert.equal(rejected.length,cases.length)
    assert.doesNotMatch(JSON.stringify(rejected),/private|current-task|generation|unrecognized story|broken/)
    assert.deepEqual((rejected[0] as any).taskKinds,['status'])
    assert.equal((rejected[0] as any).reason,'unsupported-tool-surface')
    assert.deepEqual((rejected[1] as any).taskKinds,['schema-maintenance'])
    assert.deepEqual((rejected.at(-1) as any).offeredTools,['run_code'])
  } finally {server.closeAllConnections();server.close();await once(server,'close')}
})

test('scheduled synthetic memory keeps actual source seqs, previous notes and locked facts without inventing completed actions',async()=>{
  const {server,requests}=createProtocolFixture()
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address();assert.ok(address&&typeof address!=='string')
  try {
    for(const append of [false,true]) {
      const system='你是角色扮演工作台的记忆整理员。'+(append?'本任务只记录本批新增剧情事实':'完整八段 Markdown 笔记')
      const user='整理\n\n## 既有剧情记忆\nprevious-private-preserve\n\n## 本次新增剧情原文\n'
        +'[用户 · turn:5 · seq:21]\n想离开酒馆。\n\n[叙事者 · turn:5 · seq:23]\n'+FIXTURE_REPLY
        +'\n\n## 用户显式锁定的剧情事实（逐字保留）\nlocked-private-preserve'
      const response:Response=await fetch('http://127.0.0.1:'+address.port+'/v1/chat/completions',{
        method:'POST',body:JSON.stringify({messages:[{role:'user',content:JSON.stringify({taskId:'task-private-memory',
          generation:'generation-private-memory',system,user,format:'json',taskStage:'background-notes'})}]})})
      assert.equal(response.status,200)
      const value=JSON.parse((await response.json()).choices[0].message.content)
      assert.deepEqual(value.deltas.map((row:any)=>row.evidenceSeq),[21,23])
      assert.equal(value.deltas[0].status,'uncertain')
      assert.match(value.deltas[0].summary,/并非已发生剧情/)
      assert.equal(value.deltas[1].status,'established')
      assert.match(value.deltas[1].summary,/酒馆的灯亮着/)
      assert.deepEqual(value.conflicts,[])
      if(append)assert.equal(value.text,undefined)
      else {
        for(let section=1;section<=8;section++)assert.match(value.text,new RegExp('(?:^|\\n)'+section+'\\. '))
        assert.match(value.text,/previous-private-preserve/)
        assert.match(value.text,/locked-private-preserve/)
      }
      assert.equal(requests.at(-1)!.mode,'background-memory')
      assert.equal(requests.at(-1)!.paced,false)
    }
    assert.doesNotMatch(JSON.stringify(requests),/private|想离开|灯亮/)
  } finally {server.closeAllConnections();server.close();await once(server,'close')}
})
