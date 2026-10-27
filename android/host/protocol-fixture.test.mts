import test from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {setTimeout as delay} from 'node:timers/promises'
import {createProtocolFixture,FIXTURE_REPLY,PACED_STREAM_MARKER,PROTOCOL_FIXTURE_ID} from './protocol-fixture.mts'

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
