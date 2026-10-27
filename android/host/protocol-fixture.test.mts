import test from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {createProtocolFixture} from './protocol-fixture.mts'

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
    assert.deepEqual(requests,[{model:'nexttavern-fixture',messages:1,streamed:false},{model:'nexttavern-fixture',messages:1,streamed:true}])
  } finally {server.close(); await once(server,'close')}
})
