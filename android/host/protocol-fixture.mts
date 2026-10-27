/** Local Android QA only: an OpenAI protocol fixture, not an actual model. */
import {createServer} from 'node:http'
import {pathToFileURL} from 'node:url'

export function createProtocolFixture() {
  const requests: {model:string; messages:number; streamed:boolean}[] = []
  const server = createServer(async (request,response) => {
    if(request.method === 'GET' && request.url === '/v1/models') {
      response.writeHead(200,{'content-type':'application/json'})
      response.end(JSON.stringify({object:'list',data:[{id:'nexttavern-fixture',object:'model',owned_by:'local-test'}]}))
      return
    }
    if(request.method !== 'POST' || request.url !== '/v1/chat/completions') {
      response.writeHead(404); response.end(); return
    }
    let body: {model?:string;messages?:unknown[];stream?:boolean}
    try {
      const chunks:Buffer[] = []
      for await(const chunk of request) chunks.push(Buffer.from(chunk))
      body = JSON.parse(Buffer.concat(chunks).toString())
    } catch {response.writeHead(400); response.end(); return}
    requests.push({model:body.model ?? '',messages:body.messages?.length ?? 0,streamed:body.stream === true})
    const id='chatcmpl-local-'+requests.length, model=body.model, created=Math.floor(Date.now()/1000)
    const content='【本地协议测试，不是真实模型】酒馆的灯亮着。欢迎回来，我们的对话已经继续。'
    const usage={prompt_tokens:16,completion_tokens:24,total_tokens:40}
    if(body.stream) {
      response.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'})
      const emit=(choices:unknown[],extra={})=>response.write('data: '+JSON.stringify({id,model,created,object:'chat.completion.chunk',choices,...extra})+'\n\n')
      emit([{index:0,delta:{role:'assistant'},finish_reason:null}])
      emit([{index:0,delta:{content},finish_reason:null}])
      emit([{index:0,delta:{},finish_reason:'stop'}])
      emit([],{usage}); response.end('data: [DONE]\n\n')
    } else {
      response.writeHead(200,{'content-type':'application/json'})
      response.end(JSON.stringify({id,model,created,object:'chat.completion',choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}],usage}))
    }
  })
  return {server,requests}
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port=Number(process.argv[2] ?? 18765)
  const {server}=createProtocolFixture()
  server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({kind:'local-protocol-fixture',port})))
  for(const signal of ['SIGINT','SIGTERM'] as const) process.once(signal,()=>server.close())
}
