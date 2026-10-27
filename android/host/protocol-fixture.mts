/** Local Android QA only: an OpenAI protocol fixture, not an actual model. */
import {createServer} from 'node:http'
import {pathToFileURL} from 'node:url'

export const PROTOCOL_FIXTURE_ID='nexttavern-local-openai-v1'
export const PACED_STREAM_MARKER='NEXTTAVERN_QA_PACED_STREAM'
export const FIXTURE_REPLY='【本地协议测试，不是真实模型】酒馆的灯亮着。欢迎回来，我们的对话已经继续。'
const pacedParts=['【本地协议测试，不是真实模型】','酒馆的','灯亮着。','欢迎','回来，','我们的','对话已经','继续。']
export interface FixtureRequestCounter {
  schemaVersion:1
  fixture:typeof PROTOCOL_FIXTURE_ID
  request:number
  streamRequested:boolean
  paced:boolean
  contentDeltas:number
  completed:boolean
  aborted:boolean
}
interface FixtureOptions {
  /** Only a unit-test clock budget; CLI keeps the fixed five-second pacing. */
  pacedDelayMs?:number
  onRequestEvent?(record:FixtureRequestCounter&{event:'accepted'|'content-delta'|'completed'|'aborted'}):void
}
export function createProtocolFixture(options:FixtureOptions={}) {
  const requests:FixtureRequestCounter[]=[]
  const timers=new Set<ReturnType<typeof setTimeout>>()
  const pacedDelayMs=options.pacedDelayMs??5000
  const server = createServer(async (request,response) => {
    if(request.method === 'GET' && request.url === '/v1/models') {
      response.writeHead(200,{'content-type':'application/json'})
      response.end(JSON.stringify({object:'list',data:[{id:'nexttavern-fixture',object:'model',owned_by:'local-test'}]}))
      return
    }
    if(request.method !== 'POST' || request.url !== '/v1/chat/completions') {
      response.writeHead(404); response.end(); return
    }
    let body: {model?:string;messages?:{role?:string;content?:unknown}[];stream?:boolean}
    try {
      const chunks:Buffer[] = []
      for await(const chunk of request) chunks.push(Buffer.from(chunk))
      body = JSON.parse(Buffer.concat(chunks).toString())
    } catch {
      if(!response.destroyed) {response.writeHead(400);response.end()}
      return
    }
    if(!body || !Array.isArray(body.messages)) {response.writeHead(400);response.end();return}
    const latestUser=body.messages.findLast(message=>message?.role==='user')
    const marked=typeof latestUser?.content==='string' ? latestUser.content.includes(PACED_STREAM_MARKER)
      :Array.isArray(latestUser?.content)&&latestUser.content.some(part=>part?.type==='text'
        &&typeof part.text==='string'&&part.text.includes(PACED_STREAM_MARKER))
    const counter:FixtureRequestCounter={schemaVersion:1,fixture:PROTOCOL_FIXTURE_ID,request:requests.length+1,
      streamRequested:body.stream===true,paced:body.stream===true&&marked,contentDeltas:0,completed:false,aborted:false}
    requests.push(counter)
    const report=(event:'accepted'|'content-delta'|'completed'|'aborted')=>options.onRequestEvent?.({...counter,event})
    let timer:ReturnType<typeof setTimeout>|undefined
    const clearDelay=()=>{
      if(timer===undefined)return
      clearTimeout(timer);timers.delete(timer);timer=undefined
    }
    response.once('finish',()=>{
      clearDelay()
      if(!counter.aborted) {counter.completed=true;report('completed')}
    })
    const disconnected=()=>{
      clearDelay()
      if(!counter.completed&&!counter.aborted) {counter.aborted=true;report('aborted')}
    }
    response.once('close',disconnected)
    response.once('error',disconnected)
    report('accepted')
    if(response.destroyed) {disconnected();return}
    const id='chatcmpl-local-'+requests.length, model=body.model, created=Math.floor(Date.now()/1000)
    const usage={prompt_tokens:16,completion_tokens:24,total_tokens:40}
    if(counter.streamRequested) {
      response.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'})
      const emit=(choices:unknown[],extra={})=>response.write('data: '+JSON.stringify({id,model,created,object:'chat.completion.chunk',choices,...extra})+'\n\n')
      emit([{index:0,delta:{role:'assistant'},finish_reason:null}])
      const parts=counter.paced?pacedParts:[FIXTURE_REPLY]
      let position=0
      const next=()=>{
        if(response.destroyed||counter.aborted)return
        emit([{index:0,delta:{content:parts[position++]},finish_reason:null}])
        counter.contentDeltas++;report('content-delta')
        if(position<parts.length) {
          timer=setTimeout(()=>{
            timers.delete(timer!);timer=undefined;next()
          },pacedDelayMs)
          timers.add(timer)
        } else {
          emit([{index:0,delta:{},finish_reason:'stop'}])
          emit([],{usage});response.end('data: [DONE]\n\n')
        }
      }
      next()
    } else {
      response.writeHead(200,{'content-type':'application/json'})
      response.end(JSON.stringify({id,model,created,object:'chat.completion',choices:[{index:0,message:{role:'assistant',content:FIXTURE_REPLY},finish_reason:'stop'}],usage}))
    }
  })
  return {server,requests,get pendingTimers(){return timers.size}}
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port=Number(process.argv[2] ?? 18765)
  const {server}=createProtocolFixture({onRequestEvent:record=>
    console.log(JSON.stringify({kind:'local-protocol-fixture-request',...record}))})
  server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({kind:'local-protocol-fixture',fixture:PROTOCOL_FIXTURE_ID,port})))
  for(const signal of ['SIGINT','SIGTERM'] as const) process.once(signal,()=>{
    server.close();server.closeAllConnections() // Owned fixture only; closes active pacing timers through response.close.
  })
}
