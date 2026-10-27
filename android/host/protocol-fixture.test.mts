import test from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {setTimeout as delay} from 'node:timers/promises'
import {createProtocolFixture,FIXTURE_REPLY,PACED_STREAM_MARKER,PROTOCOL_FIXTURE_ID,
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
