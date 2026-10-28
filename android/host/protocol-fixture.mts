/** Local Android QA only: an OpenAI protocol fixture, not an actual model. */
import {createServer} from 'node:http'
import {pathToFileURL} from 'node:url'

export const PROTOCOL_FIXTURE_ID='nexttavern-local-openai-v1'
export const PACED_STREAM_MARKER='NEXTTAVERN_QA_PACED_STREAM'
export const FIXTURE_REPLY='【本地协议测试，不是真实模型】酒馆的灯亮着。欢迎回来，我们的对话已经继续。'
export const EMBEDDING_FIXTURE_ID='nexttavern-local-embedding-v1'
export const EMBEDDING_FIXTURE_MODEL='nexttavern-embedding-fixture'
export const EMBEDDING_FIXTURE_DIMENSIONS=4
export const EMBEDDING_STORY_SENTENCE='旅人把蓝色书签夹进了旧账本。'
export const EMBEDDING_DISTRACTOR_SENTENCE='窗边的铜铃在晚风中轻响。'
export const EMBEDDING_QUERY='NEXTTAVERN_QA_BLUE_BOOKMARK'
const pacedParts=['【本地协议测试，不是真实模型】','酒馆的','灯亮着。','欢迎','回来，','我们的','对话已经','继续。']
interface ChatMessage {role?:string;content?:unknown;tool_calls?:{id?:string;function?:{name?:string;arguments?:string}}[];tool_call_id?:string}
interface ChatBody {model?:string;messages?:ChatMessage[];stream?:boolean;tools?:{type?:string;function?:{name?:string;parameters?:{required?:string[]}}}[];
  input?:unknown;dimensions?:number;encoding_format?:string}
const maintenancePrefix='当前是系统维护阶段，尚不能生成或续写剧情。'
const taskMarker='\n待办：\n'
const sharedMarker='\n资料引用：currentContextRef 指当前请求已有的同名上下文，不必重读；sharedContextRef 指以下公共资料，分别应用各任务规则。\n'
const messageText=(message:ChatMessage|undefined):string=>typeof message?.content==='string'?message.content
  :Array.isArray(message?.content)?message.content.filter(part=>part?.type==='text'&&typeof part.text==='string').map(part=>part.text).join(''):''
type RejectionReason='unsupported-tool-surface'|'malformed-envelope'|'unsupported-task-contract'|'unsupported-worker'|'incomplete-tool-receipt'
export interface FixtureRejection {
  schemaVersion:1
  fixture:typeof PROTOCOL_FIXTURE_ID
  reason:RejectionReason
  offeredTools:('rp_task_submit'|'rp_task_read'|'run_code')[]
  taskKinds:('schema-maintenance'|'status'|'decision'|'memory'|'other')[]
  taskStages:('schema-maintenance-v1'|'background-notes'|'compaction'|'other')[]
}
class FixtureRejected extends Error {
  readonly record:FixtureRejection
  constructor(record:FixtureRejection){super('Unsupported or malformed local fixture maintenance request');this.record=record}
}
/** Deliberately not a general model: only this fixture's plain-card status story.
 * Consume current offered identities; never retain prompt data or manufacture jobs. */
function fixturePlan(body:ChatBody,requestNumber:number):{mode:'story'|'maintenance'|'maintenance-complete'|'background-memory';content?:string;calls?:{id:string;type:'function';function:{name:string;arguments:string}}[]} {
  const messages=body.messages!,latest=messages.at(-1),text=messageText(latest)
  const rejection:FixtureRejection={schemaVersion:1,fixture:PROTOCOL_FIXTURE_ID,reason:'malformed-envelope',
    offeredTools:(['rp_task_submit','rp_task_read','run_code'] as const).filter(name=>body.tools?.some(tool=>tool.function?.name===name)),
    taskKinds:[],taskStages:[]}
  const fixtureFailure=(reason:RejectionReason='malformed-envelope'):never=>{throw new FixtureRejected({...rejection,reason})}
  if(latest?.role==='tool') {
    const assistant=messages.findLast(message=>message.role==='assistant'&&!!message.tool_calls?.length)
    const calls=assistant?.tool_calls??[]
    if(calls.some(call=>call.function?.name==='rp_task_submit')) {
      if(calls.some(call=>call.function?.name!=='rp_task_submit'))return fixtureFailure('incomplete-tool-receipt')
      const receipts=messages.slice(messages.indexOf(assistant!)+1)
      if(calls.some(call=>!receipts.some(receipt=>{
        if(receipt.role!=='tool'||receipt.tool_call_id!==call.id)return false
        try {const value=JSON.parse(messageText(receipt));return value.ok===true&&value.status==='completed'&&value.resultStored===true}catch{return false}
      })))return fixtureFailure('incomplete-tool-receipt')
      return {mode:'maintenance-complete'}
    }
  }
  if(latest?.role!=='user'||!text.startsWith(maintenancePrefix)) {
    // Spawned workers return JSON content; only synthetic background notes are supported.
    if(latest?.role==='user') {
      let envelope:Record<string,unknown>|undefined
      try {envelope=JSON.parse(text)} catch {}
      if(envelope&&(envelope.taskId||envelope.outputContract)) {
        rejection.taskKinds=[envelope.taskStage==='background-notes'?'memory':'other']
        rejection.taskStages=[envelope.taskStage==='background-notes'?'background-notes':'other']
        if(envelope.taskStage!=='background-notes'||envelope.format!=='json'||typeof envelope.system!=='string'
          ||!envelope.system.startsWith('你是角色扮演工作台的记忆整理员。')||typeof envelope.user!=='string')return fixtureFailure('unsupported-worker')
        const user=envelope.user,sourceMarker='\n\n## 本次新增剧情原文\n',lockedMarker='\n\n## 用户显式锁定的剧情事实',
          sourceStart=user.indexOf(sourceMarker),lockedStart=user.indexOf(lockedMarker)
        if(sourceStart<0||lockedStart<sourceStart)return fixtureFailure('unsupported-worker')
        const source=user.slice(sourceStart+sourceMarker.length,lockedStart),
          matches=[...source.matchAll(/\[(用户|叙事者) · turn:(?:\d+|null) · seq:(\d+)\]\n/g)]
        if(!matches.length||matches[0]!.index!==0)return fixtureFailure('unsupported-worker')
        const deltas=matches.map((match,index)=>{
          const original=source.slice(match.index!+match[0].length,matches[index+1]?.index??source.length).trim()
          const narrator=match[1]==='叙事者'
          if(!original||(narrator&&original!==FIXTURE_REPLY&&original!==
            '旅人把蓝色书签放在桌上：“欢迎回来，这是本地合成测试的开场。”'))return fixtureFailure('unsupported-worker')
          return {evidenceSeq:Number(match[2]),summary:(narrator?'剧情原文：':'玩家输入（并非已发生剧情）：')+original,
            status:narrator?'established':'uncertain'}
        })
        const append=envelope.system.includes('本任务只记录本批新增剧情事实')
        if(append)return {mode:'background-memory',content:JSON.stringify({deltas,conflicts:[]})}
        if(!envelope.system.includes('完整八段 Markdown 笔记'))return fixtureFailure('unsupported-worker')
        const priorStart=user.indexOf('\n\n## 既有剧情记忆\n'),lockedBody=user.indexOf('\n',lockedStart+2)
        if(priorStart<0||lockedBody<0)return fixtureFailure('unsupported-worker')
        const previous=user.slice(priorStart+'\n\n## 既有剧情记忆\n'.length,sourceStart),locked=user.slice(lockedBody+1),
          notes=['1. 用户锁定的剧情事实',locked==='（无）'?'无':locked,
            '2. 主角与用户边界','玩家原始输入逐条保留在第六节，不视为已发生事实。',
            '3. 角色簿','仅保留原文信息，见第六节。','4. 关系图','无新增已确认关系。',
            '5. 世界规则','无新增已确认规则。','6. 时间线与剧情账本',
            previous==='（首次整理）'?'':previous,...deltas.map(row=>row.summary+' (seq:'+row.evidenceSeq+')'),
            '7. 当前场景快照','酒馆；其余状态不从未执行的玩家输入推断。','8. 待确认事项','玩家输入尚未由正文确认的内容，见第六节。'].join('\n')
        return {mode:'background-memory',content:JSON.stringify({text:notes,deltas,conflicts:[]})}
      }
    }
    return {mode:'story'}
  }
  const submit=body.tools?.find(tool=>tool.type==='function'&&tool.function?.name==='rp_task_submit')?.function
  const start=text.indexOf(taskMarker);if(start<0)return fixtureFailure()
  const tail=text.slice(start+taskMarker.length),split=tail.indexOf(sharedMarker)
  let tasks:unknown
  try {
    tasks=JSON.parse(split<0?tail:tail.slice(0,split))
    if(split>=0&&!Array.isArray(JSON.parse(tail.slice(split+sharedMarker.length))))return fixtureFailure()
  }catch{return fixtureFailure()}
  if(!Array.isArray(tasks)||!tasks.length)return fixtureFailure()
  rejection.taskKinds=[...new Set(tasks.map(task=>
    (['schema-maintenance','status','decision','memory'] as const).find(kind=>kind===task?.kind)??'other'))]
  rejection.taskStages=[...new Set(tasks.map(task=>
    (['schema-maintenance-v1','background-notes','compaction'] as const).find(stage=>stage===task?.input?.taskStage)??'other'))]
  const semantic=submit?.parameters?.required?.includes('kind')===true
  if(!submit?.parameters?.required?.includes('result')||(!semantic&&
    (!submit.parameters.required.includes('id')||!submit.parameters.required.includes('generation'))))return fixtureFailure('unsupported-tool-surface')
  const identities=new Set<string>()
  const kinds=new Set<string>()
  const options=[{label:'继续与旅人交谈',heart:false},{label:'询问旅人正在阅读的书',heart:false},{label:'静静观察酒馆',heart:false}]
  const calls=tasks.map((task,index)=>{
    if(!['status','decision'].includes(task?.kind)||task.completeSource!==true||typeof task.id!=='string'||!task.id
      ||typeof task.generation!=='string'||!task.generation||identities.has(task.id)||(semantic&&kinds.has(task.kind))
      ||task.input?.format!=='json'||typeof task.input.system!=='string'||typeof task.input.user!=='string'
      ||!task.input.user.includes(FIXTURE_REPLY))return fixtureFailure('unsupported-task-contract')
    identities.add(task.id);kinds.add(task.kind)
    let result:unknown
    if(task.kind==='status') {
      if(!task.input.system.startsWith('你是角色扮演工作台的状态栏渲染生成器。')
        ||task.input.user.includes('作者原始状态栏模板'))return fixtureFailure('unsupported-task-contract')
      // The program freezes this JSON context inside its own author-data fence.
      // Other author templates or stories need a different explicit fixture.
      let context:Record<string,any>|undefined
      for(const match of task.input.user.matchAll(/<rp-content:([a-f0-9]+)>\n([\s\S]*?)\n<\/rp-content:\1>/g)) {
        try {const value=JSON.parse(match[2]);if(value&&Object.hasOwn(value,'previousStatus')&&Array.isArray(value.selectedStorySinceStatus))context=value}catch {}
      }
      if(!context||context.selectedStorySinceStatus.findLast((entry:any)=>entry.role==='assistant')?.text!==FIXTURE_REPLY)
        return fixtureFailure('unsupported-task-contract')
      // A no-change story keeps the entire existing status, not just selected fields.
      result=context.previousStatus??{title:'酒馆',fields:[{label:'位置',value:'酒馆'}],options}
      if(context.previousStatus?.html&&typeof context.previousStatus.html==='object') {
        // Only the generated plain-card HTML is expendable: the owner regenerates
        // it from preserved fields. Never interpret a context reference as state.
        const {html,...preserved}=context.previousStatus
        result=preserved
      }
      if(JSON.stringify(result).includes('"currentContextRef"')||JSON.stringify(result).includes('"sharedContextRef"'))
        return fixtureFailure('unsupported-task-contract')
    } else {
      if(!task.input.system.startsWith('你是角色扮演工作台的轮末建议生成器。'))return fixtureFailure('unsupported-task-contract')
      result={options}
    }
    const args=semantic?{kind:task.kind,result}:{id:task.id,generation:task.generation,result}
    return {id:'call_local_maintenance_'+requestNumber+'_'+index,type:'function' as const,
      function:{name:'rp_task_submit',arguments:JSON.stringify(args)}}
  })
  return {mode:'maintenance',calls}
}
export interface FixtureRequestCounter {
  schemaVersion:1
  fixture:typeof PROTOCOL_FIXTURE_ID
  request:number
  streamRequested:boolean
  mode:'story'|'maintenance'|'maintenance-complete'|'background-memory'
  toolcallCount:number
  paced:boolean
  contentDeltas:number
  completed:boolean
  aborted:boolean
}
export interface EmbeddingFixtureCounter {
  schemaVersion:1
  fixture:typeof EMBEDDING_FIXTURE_ID
  request:number
  inputCount:number
  dimensions:typeof EMBEDDING_FIXTURE_DIMENSIONS
  completed:boolean
  aborted:boolean
}
interface FixtureOptions {
  /** Only a unit-test clock budget; CLI keeps the fixed five-second pacing. */
  pacedDelayMs?:number
  onRejected?(record:FixtureRejection):void
  onRequestEvent?(record:FixtureRequestCounter&{event:'accepted'|'content-delta'|'completed'|'aborted'}):void
  onEmbeddingEvent?(record:EmbeddingFixtureCounter&{event:'accepted'|'completed'|'aborted'}):void
}
export function createProtocolFixture(options:FixtureOptions={}) {
  const requests:FixtureRequestCounter[]=[]
  const embeddingRequests:EmbeddingFixtureCounter[]=[]
  const timers=new Set<ReturnType<typeof setTimeout>>()
  const pacedDelayMs=options.pacedDelayMs??5000
  const server = createServer(async (request,response) => {
    if(request.method === 'GET' && request.url === '/v1/models') {
      response.writeHead(200,{'content-type':'application/json'})
      response.end(JSON.stringify({object:'list',data:[{id:'nexttavern-fixture',object:'model',owned_by:'local-test'},
        {id:EMBEDDING_FIXTURE_MODEL,object:'model',owned_by:'local-test'}]}))
      return
    }
    if(request.method !== 'POST' || !['/v1/chat/completions','/v1/embeddings'].includes(request.url??'')) {
      response.writeHead(404); response.end(); return
    }
    let body:ChatBody
    try {
      const chunks:Buffer[] = []
      for await(const chunk of request) chunks.push(Buffer.from(chunk))
      body = JSON.parse(Buffer.concat(chunks).toString())
    } catch {
      if(!response.destroyed) {response.writeHead(400);response.end()}
      return
    }
    if(request.url==='/v1/embeddings') {
      const inputs=typeof body?.input==='string'?[body.input]:body?.input
      if(body?.model!==EMBEDDING_FIXTURE_MODEL||!Array.isArray(inputs)||!inputs.length
        ||inputs.some(text=>typeof text!=='string')
        ||(body.dimensions!==undefined&&body.dimensions!==EMBEDDING_FIXTURE_DIMENSIONS)
        ||(body.encoding_format!==undefined&&body.encoding_format!=='float')) {
        response.writeHead(400,{'content-type':'application/json'})
        response.end(JSON.stringify({error:{message:'Use the fixed local embedding model, text input and four float dimensions.'}}));return
      }
      const counter:EmbeddingFixtureCounter={schemaVersion:1,fixture:EMBEDDING_FIXTURE_ID,
        request:embeddingRequests.length+1,inputCount:inputs.length,dimensions:EMBEDDING_FIXTURE_DIMENSIONS,
        completed:false,aborted:false}
      embeddingRequests.push(counter)
      const report=(event:'accepted'|'completed'|'aborted')=>options.onEmbeddingEvent?.({...counter,event})
      response.once('finish',()=>{if(!counter.aborted){counter.completed=true;report('completed')}})
      const disconnected=()=>{if(!counter.completed&&!counter.aborted){counter.aborted=true;report('aborted')}}
      response.once('close',disconnected);response.once('error',disconnected)
      report('accepted')
      if(response.destroyed){disconnected();return}
      // Exact synthetic marker groups, not a semantic model or quality benchmark.
      // Non-unit vectors exercise the real consumer's existing normalization.
      const vector=(text:string)=>text.includes('蓝色书签')||text.includes(EMBEDDING_QUERY)?[3,0,0,0]
        :text.includes('铜铃')||text.includes('NEXTTAVERN_QA_BRASS_BELL')?[0,4,0,0]:[0,0,2,0]
      response.writeHead(200,{'content-type':'application/json'})
      response.end(JSON.stringify({object:'list',model:EMBEDDING_FIXTURE_MODEL,
        data:inputs.map((text:string,index:number)=>({object:'embedding',index,embedding:vector(text)})),
        usage:{prompt_tokens:inputs.length*8,total_tokens:inputs.length*8}}))
      return
    }
    if(!body || !Array.isArray(body.messages)) {response.writeHead(400);response.end();return}
    let plan:ReturnType<typeof fixturePlan>
    try {plan=fixturePlan(body,requests.length+1)} catch(error) {
      if(error instanceof FixtureRejected)options.onRejected?.(error.record)
      response.writeHead(422,{'content-type':'application/json'})
      response.end(JSON.stringify({error:{message:'Unsupported or malformed local fixture maintenance request'}}));return
    }
    const latestUser=body.messages.findLast(message=>message?.role==='user')
    const marked=typeof latestUser?.content==='string' ? latestUser.content.includes(PACED_STREAM_MARKER)
      :Array.isArray(latestUser?.content)&&latestUser.content.some(part=>part?.type==='text'
        &&typeof part.text==='string'&&part.text.includes(PACED_STREAM_MARKER))
    const counter:FixtureRequestCounter={schemaVersion:1,fixture:PROTOCOL_FIXTURE_ID,request:requests.length+1,
      streamRequested:body.stream===true,mode:plan.mode,toolcallCount:plan.calls?.length??0,paced:plan.mode==='story'&&body.stream===true&&marked,contentDeltas:0,completed:false,aborted:false}
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
      if(plan.mode!=='story'&&plan.mode!=='background-memory') {
        if(plan.calls)emit([{index:0,delta:{tool_calls:plan.calls.map((call,index)=>({index,...call}))},finish_reason:null}])
        emit([{index:0,delta:{},finish_reason:plan.calls?'tool_calls':'stop'}])
        emit([],{usage});response.end('data: [DONE]\n\n');return
      }
      const parts=counter.paced?pacedParts:[plan.content??FIXTURE_REPLY]
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
      response.end(JSON.stringify({id,model,created,object:'chat.completion',choices:[{index:0,message:{role:'assistant',content:plan.content??(plan.mode==='story'?FIXTURE_REPLY:null),...plan.calls?{tool_calls:plan.calls}:{}},finish_reason:plan.calls?'tool_calls':'stop'}],usage}))
    }
  })
  return {server,requests,embeddingRequests,get pendingTimers(){return timers.size}}
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port=Number(process.argv[2] ?? 18765)
  const {server}=createProtocolFixture({onRejected:record=>
    console.log(JSON.stringify({kind:'local-protocol-fixture-rejected',...record})),
    onRequestEvent:record=>
    console.log(JSON.stringify({kind:'local-protocol-fixture-request',...record})),
    onEmbeddingEvent:record=>console.log(JSON.stringify({kind:'local-embedding-fixture-request',...record}))})
  server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({kind:'local-protocol-fixture',fixture:PROTOCOL_FIXTURE_ID,port})))
  for(const signal of ['SIGINT','SIGTERM'] as const) process.once(signal,()=>{
    server.close();server.closeAllConnections() // Owned fixture only; closes active pacing timers through response.close.
  })
}
