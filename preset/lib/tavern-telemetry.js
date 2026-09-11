import { createHash, randomUUID } from 'node:crypto'
import { withTavernLock, taskFailureDetails, FAILURE_LABELS } from './tavern-tasks.js'
import { resolvePricing, convertUsageCurrency } from './tavern-pricing.js'

const PREFIX='tavern_usage__', LOG='tavern_log__', PRICE='tavern_prices', META='tavern_usage_session__'
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const n=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null
const fields=['inputTokens','outputTokens','cacheReadTokens','cacheWriteTokens']
const usageOf=u=>u&&typeof u==='object'?Object.fromEntries([...fields,'totalTokens'].map(k=>[k,n(u[k])])):null
const events=s=>s?.events??s?.log??[]
const safeId=v=>typeof v==='string'?v.replace(/[\x00-\x1f]/g,'').slice(0,300):null
const reasonText=r=>{const f=taskFailureDetails(r);return [f.category!=='unknown'?f.label:null,f.code,f.status?`HTTP ${f.status}`:null].filter(Boolean).join(' · ')||'原因未提供'}
const publicError=value=>value?String(value).split(' · ').filter(part=>Object.values(FAILURE_LABELS).includes(part)||/^HTTP [1-5]\d{2}$/.test(part)||/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(part)).join(' · ')||'原因未提供':null
const publicFallback=j=>{
  if(!j.fallback)return null
  const route=r=>({provider:safeId(r?.provider),model:safeId(r?.model),...(r?.reasoningEffort?{reasoningEffort:safeId(r.reasoningEffort)}:{})})
  const f=j.fallback,category=Object.hasOwn(FAILURE_LABELS,f.failure?.category)?f.failure.category:'unknown'
  return {from:route(f.from),to:route(f.to??j.actualRoute),at:n(f.at),reason:['timeout','failed','runtime-restart'].includes(f.reason)?f.reason:'unknown',
    failure:{category,label:FAILURE_LABELS[category],code:taskFailureDetails({code:f.failure?.code}).code,status:n(f.failure?.status)}}
}
const outcome=r=>r?.kind==='error'?'failed':r?.kind==='aborted'?'cancelled':r?.kind==='max-tokens'?'truncated':'completed'
function presetOf(s){let p=s?.header?.agentPreset;for(const e of events(s))if(e.type==='agent-preset/selected')p=e.data?.agentPreset??p;return p}

/** Fold raw attempts, never the selected story surface. Seeded parent events
 * only establish lifecycle state; they never create a second charge. */
export function foldSessionCalls(session) {
  const out=[], seed=session.header?.seedLength??0
  let current=null, route={}, phase='narrative'
  const finish=(time,status,error)=>{if(!current)return;if(time!=null){current.completedAt=time;current.durationMs=Math.max(0,time-current.startedAt)}if(status)current.status=status;if(error)current.error=error}
  for(const e of events(session)) {
    const d=e.data??{}
    if(e.type==='compaction/summary'&&d.usage&&!d.nativeTask&&e.seq>=seed)out.push({schemaVersion:1,id:hash([session.id,'compaction',d.compactionId??e.seq]),sessionId:session.id,ownerSessionId:session.id,kind:'compaction',provider:d.provider??null,model:d.model??null,status:'completed',startedAt:e.time,completedAt:e.time,durationMs:null,firstTokenMs:null,usage:usageOf(d.usage),source:{kind:'compaction-summary',sessionId:session.id,startSeq:e.seq,evidenceSeq:e.seq}})
    if(e.type==='request/header'){route=d.header?.config??route;if(current){current.provider=route.provider??null;current.model=route.model??null}}
    if(e.type==='user/message')phase=d.source?.plugin==='roleplay-tasks'?(d.source.jobKind??d.source.stage??'maintenance'):'narrative'
    if(e.type==='step/start'||e.type==='llm/retry-started') {
      if(current?.status==='running')finish(e.time,'unknown')
      current={schemaVersion:1,id:hash([session.id,e.seq]),sessionId:session.id,ownerSessionId:session.id,
        provider:route.provider??null,model:route.model??null,kind:phase,status:'running',startedAt:e.time,completedAt:null,durationMs:null,firstTokenMs:null,usage:null,
        source:{kind:'session-attempt',sessionId:session.id,startSeq:e.seq,turn:d.turn,step:d.step,evidenceSeq:e.seq}}
      if(e.seq>=seed)out.push(current)
    }
    if(!current)continue
    current.source.evidenceSeq=e.seq
    if(e.type==='tool/call'&&['rp_task_read','rp_task_submit'].includes(d.name)) {
      try { const args=typeof d.arguments==='string'?JSON.parse(d.arguments):d.arguments
        if(typeof args?.id==='string'&&/^[a-f0-9]{64}$/.test(args.id))current.source.taskIds=[...new Set([...(current.source.taskIds??[]),args.id])]
      }catch{}
    }
    if(e.type==='assistant/chunk') {
      if(['text-delta','reasoning-delta','tool-call-delta'].includes(d.chunk?.type)&&current.firstTokenMs===null)current.firstTokenMs=Math.max(0,e.time-current.startedAt)
      if(d.chunk?.type==='usage')current.usage=usageOf(d.chunk.usage)
      if(d.chunk?.type==='finish')finish(e.time,outcome(d.chunk.reason),['error','aborted'].includes(d.chunk.reason?.kind)?reasonText(d.chunk.reason):null)
    }
    if(e.type==='assistant/message') {
      if(d.usage)current.usage=usageOf(d.usage)
      const actual=d.message?.source
      if(actual?.provider)current.provider=actual.provider
      if(actual?.model)current.model=actual.model
      finish(e.time,['failed','cancelled','truncated'].includes(current.status)?current.status:d.interrupted?'truncated':'completed')
    }
    if(e.type==='llm/retry')finish(e.time,'failed',reasonText(d.failure))
    if(e.type==='step/end'){if(current.status==='running')finish(e.time,'unknown');current=null}
    if(e.type==='turn/end'){if(current.status==='running')finish(e.time,outcome(d.reason),d.reason?.kind==='error'?reasonText(d.reason):null);current=null}
  }
  return out
}

export function timeRange(query={},now=Date.now()) {
  const from=query.from==null?now-86400000:Number(query.from),to=query.to==null?now:Number(query.to)
  if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<=from||to>now+86400000)throw new Error('时间范围无效')
  return {from,to}
}
const empty=()=>({calls:0,successes:0,failures:0,inputTokens:0,outputTokens:0,cacheReadTokens:0,cacheWriteTokens:0,unknownUsage:0,unknownFields:Object.fromEntries(fields.map(k=>[k,0])),knownCost:0,pricedCalls:0,unpricedCalls:0,cost:null,costComplete:true,durationMs:0,timedCalls:0,cacheRateCalls:0,cacheRateIncompleteCalls:0,cacheRateInputTokens:0,cacheRateHitTokens:0,cacheHitRate:null,speedCalls:0,speedOutputTokens:0,generationMs:0,tokensPerSecond:null})
function add(total,call,prices,catalog){total.calls++;if(call.status==='completed')total.successes++;if(['failed','cancelled','truncated'].includes(call.status))total.failures++
  if(!call.usage)total.unknownUsage++
  for(const f of fields){if(n(call.usage?.[f])===null)total.unknownFields[f]++;else total[f]+=call.usage[f]}
  const cost=resolvePricing(call,prices,catalog).cost;if(cost===null)total.unpricedCalls++;else total.knownCost+=cost
  total.pricedCalls=total.calls-total.unpricedCalls;total.costComplete=total.unpricedCalls===0
  total.cost=total.unpricedCalls?null:total.knownCost
  if(n(call.durationMs)!==null){total.durationMs+=call.durationMs;total.timedCalls++}
  // Pair numerator and denominator from the same requests. Unknown cache
  // fields do not silently count as misses or corrupt the known hit ratio.
  const u=call.usage,read=n(u?.cacheReadTokens),fresh=n(u?.inputTokens),write=n(u?.cacheWriteTokens),output=n(u?.outputTokens),exact=n(u?.totalTokens)
  const prompt=exact!==null&&output!==null&&exact>=output?exact-output:fresh!==null&&read!==null&&write!==null?fresh+read+write:null
  if(read!==null&&prompt!==null&&read<=prompt){total.cacheRateCalls++;total.cacheRateHitTokens+=read;total.cacheRateInputTokens+=prompt}else total.cacheRateIncompleteCalls++
  total.cacheHitRate=total.cacheRateInputTokens>0?total.cacheRateHitTokens/total.cacheRateInputTokens:null
  // Use actual output and streaming duration together; neither missing TTFT
  // nor a still-running attempt is a measured generation speed.
  const duration=n(call.durationMs),first=n(call.firstTokenMs)
  if(call.status!=='running'&&output!==null&&duration!==null&&first!==null&&duration>first){total.speedCalls++;total.speedOutputTokens+=output;total.generationMs+=duration-first}
  total.tokensPerSecond=total.generationMs>0?total.speedOutputTokens/(total.generationMs/1000):null
}
export function aggregateUsage(calls,query,prices={rates:[],currency:'USD'},catalog=[]) {
  const range=timeRange(query),to=range.to,from=range.from===0?calls.reduce((first,c)=>Number.isFinite(c.startedAt)&&c.startedAt>=0?Math.min(first,c.startedAt):first,to-1):range.from, totals=empty(),models=new Map(),providers=new Map(),timeline=new Map()
  const bucketMs=Math.max(60000,Math.ceil((to-from)/72/60000)*60000)
  for(const call of calls){if(call.startedAt<from||call.startedAt>=to||query.targetSessionId&&call.ownerSessionId!==query.targetSessionId||query.provider&&call.provider!==query.provider||query.model&&call.model!==query.model)continue
    add(totals,call,prices,catalog)
    const key=JSON.stringify([call.provider,call.model]);if(!models.has(key))models.set(key,{provider:call.provider,model:call.model,...empty()});add(models.get(key),call,prices,catalog)
    if(!providers.has(call.provider))providers.set(call.provider,{provider:call.provider,...empty()});add(providers.get(call.provider),call,prices,catalog)
    const at=from+Math.floor((call.startedAt-from)/bucketMs)*bucketMs;if(!timeline.has(at))timeline.set(at,{at,...empty()});add(timeline.get(at),call,prices,catalog)
  }
  return {schemaVersion:1,from,to,currency:prices.currency??'USD',unit:'per-million-tokens',totals,models:[...models.values()].sort((a,b)=>b.calls-a.calls),providers:[...providers.values()].sort((a,b)=>b.calls-a.calls),timeline:[...timeline.values()].sort((a,b)=>a.at-b.at)}
}

/** A paged projection of real calls, not workflow/task completion records. */
export function queryUsageRequests(calls,query={},prices={rates:[],currency:'USD'},catalog=[],quote={},sessionList=[]){
  const {from,to}=timeRange(query),offset=Math.max(0,Math.min(1e7,Math.floor(Number(query.offset)||0))),limit=Math.max(1,Math.min(100,Math.floor(Number(query.limit)||50)))
  const selected=calls.filter(r=>r.ownerSessionId!==null&&r.startedAt>=from&&r.startedAt<to&&(!query.targetSessionId||r.ownerSessionId===query.targetSessionId)&&(!query.provider||r.provider===query.provider)&&(!query.model||r.model===query.model)).sort((a,b)=>b.startedAt-a.startedAt||String(a.id).localeCompare(String(b.id)))
  let display={currency:prices.currency??'USD',totals:{cost:0,knownCost:0},models:[],timeline:[],fx:null}
  if(query.currency)display=convertUsageCurrency(display,query.currency,quote)
  const rate=display.fx?display.fx.rate:1,labels=new Map(sessionList.map(s=>[s.id,s.label]))
  const rows=selected.slice(offset,offset+limit).map(r=>{
    const pricing=resolvePricing(r,prices,catalog),duration=n(r.durationMs),first=n(r.firstTokenMs),output=n(r.usage?.outputTokens)
    return {id:r.id,sessionId:r.sessionId,ownerSessionId:r.ownerSessionId,sessionLabel:labels.get(r.ownerSessionId)??`会话 ${String(r.ownerSessionId??r.sessionId).slice(-8)}`,kind:r.kind,provider:r.provider,model:r.model,status:r.status,startedAt:r.startedAt,durationMs:duration,firstTokenMs:first,
      tokensPerSecond:r.status!=='running'&&output!==null&&duration!==null&&first!==null&&duration>first?output/((duration-first)/1000):null,
      usage:usageOf(r.usage),cost:pricing.cost===null||rate===null?null:pricing.cost*rate,pricingStatus:rate===null?'missing-exchange-rate':pricing.status,error:publicError(r.error)}
  })
  return {schemaVersion:1,rows,total:selected.length,offset,limit,currency:display.currency,fx:display.fx}
}

/** No prompts, tool arguments, output text, headers or credentials are stored. */
export function createTelemetry({table,sessions,query,jobs=()=>[]}) {
  let syncPromise=null,persistenceFailures=0,lastSyncAt=0,coverage={scanning:false,scannedSessions:0,totalSessions:0,failedSessions:0};const scanned=new Map(), known=new Map(), active=new Set(), coldRead=new Set(), persisted=new Map()
  const values=prefix=>[...table.entries()].filter(([k])=>k.startsWith(prefix)).map(([,v])=>v)
  const records=()=>values(PREFIX).filter(v=>!v.superseded)
  const meta=s=>known.set(s.id,s.header)
  const owner=s=>{let h=s.header,seen=new Set();while(h?.origin==='subagent'&&h.parentSession&&!seen.has(h.id)){seen.add(h.id);h=known.get(h.parentSession)??sessions.get(h.parentSession)?.header??{id:h.parentSession};}return h?.id??s.id}
  function eligible(s){if(presetOf(s)==='roleplay')return true;const id=owner(s);return (known.get(id)??sessions.get(id)?.header)?.agentPreset==='roleplay'}
  async function writeChanged(key,value){const snapshot=JSON.stringify(value);if(persisted.get(key)===snapshot)return;await table.put(key,value);persisted.set(key,snapshot)}
  async function put(call){await writeChanged(PREFIX+call.id,call)}
  async function ingestUnlocked(s) {
    meta(s);if(!eligible(s))return
    const ownerSessionId=owner(s), relatedJobIds=jobs().filter(j=>j?.childSessionId===s.id&&(j.sessionId??j.branchId)===ownerSessionId&&j.id).map(j=>j.id), fingerprint=events(s).length
    if(relatedJobIds.length)for(const stream of records().filter(r=>r.sessionId===s.id&&r.source.kind==='stream')){
      const jobIds=[...new Set([...(stream.source.jobIds??[]),...(stream.source.jobId?[stream.source.jobId]:[]),...relatedJobIds])]
      if(jobIds.length!==stream.source.jobIds?.length||jobIds.some((id,i)=>id!==stream.source.jobIds[i]))await put({...stream,source:{...stream.source,jobIds}})
    }
    if(scanned.get(s.id)===fingerprint)return
    const streams=records().filter(r=>r.sessionId===s.id&&r.source.kind==='stream'&&!r.source.purpose)
    for(const call of foldSessionCalls(s)){
      call.ownerSessionId=ownerSessionId
      const actual=streams.find(r=>r.source.startSeq===call.source.startSeq&&r.startedAt>=call.startedAt&&r.startedAt<=(call.completedAt??Infinity))
      if(actual){
        if(!active.has(actual.id))await put({...actual,status:call.status,completedAt:call.completedAt,durationMs:call.durationMs,firstTokenMs:call.firstTokenMs??actual.firstTokenMs,usage:call.usage??actual.usage,error:call.error??actual.error,provider:call.provider??actual.provider,model:call.model??actual.model,source:{...actual.source,evidenceSeq:call.source.evidenceSeq,taskIds:call.source.taskIds??actual.source.taskIds}})
        if(table.get(PREFIX+call.id))await put({...call,superseded:true});continue
      }
      await put(call)
    }
    const seed=s.header?.seedLength??0, toolStarts=new Map(),attempts=foldSessionCalls(s)
    for(const e of events(s)){
      if(e.seq<seed)continue
      if(e.type==='tool/call')toolStarts.set(e.data?.callId,e)
      if(!['tool/result','turn/end','compaction/end','assistant/message'].includes(e.type))continue
      const d=e.data??{},block=d.message?.content?.find(b=>b.type==='tool-result'),start=toolStarts.get(d.callId??d.message?.source?.callId??block?.toolCallId),bad=Boolean(d.error)||block?.isError===true||d.isError===true||d.result?.isError===true||d.reason?.kind==='error'
      const attempt=attempts.findLast(c=>c.source.turn===d.turn&&(!d.step||c.source.step===d.step))
      if(e.type==='assistant/message'&&(attempt?.kind!=='narrative'||!d.message?.content?.some(b=>b.type==='text')||d.message.content.some(b=>b.type==='tool-call')))continue
      const row={schemaVersion:1,id:hash([s.id,e.seq,'operation']),sessionId:s.id,ownerSessionId,kind:e.type==='tool/result'?'tool':e.type==='compaction/end'?'memory':e.type==='assistant/message'?'narrative':'turn',
        label:e.type==='tool/result'?`工具 · ${safeId(start?.data?.name??d.name)??'未知工具'}`:e.type==='compaction/end'?'记忆整理':e.type==='assistant/message'?'正文生成完毕':'轮次结束',
        status:bad?'failed':'completed',provider:attempt?.provider??null,model:attempt?.model??null,startedAt:start?.time??e.time,completedAt:e.time,durationMs:start?Math.max(0,e.time-start.time):null,
        error:bad?reasonText(d.error??d.reason??d):null,source:{kind:'session-event',sessionId:s.id,seq:e.seq}}
      await writeChanged(LOG+row.id,row)
    }
    const title=events(s).findLast(e=>e.type==='session/title')?.data?.title
    await table.put(META+hash(s.id),{schemaVersion:1,sessionId:s.id,ownerSessionId,label:safeId(title)??`会话 ${s.id.slice(-8)}`,source:{kind:'session-header'},updatedAt:Date.now()})
    scanned.set(s.id,fingerprint)
  }
  const ingest=s=>withTavernLock(table,`usage-ingest-${s.id}`,()=>ingestUnlocked(s))
  async function sync(){if(syncPromise)return syncPromise;coverage={...coverage,scanning:true,scannedSessions:0,failedSessions:0};syncPromise=(async()=>{
    const live=sessions.list?.()??[],failures=[];for(const s of live)meta(s)
    let corpus=[];try{corpus=await query?.listSessions?.()??[]}catch{failures.push('corpus')}
    for(const r of corpus)if(r.header)known.set(r.header.id,r.header)
    const ids=new Set([...live.map(s=>s.id),...corpus.map(r=>r.header?.id).filter(Boolean)])
    coverage.totalSessions=ids.size
    for(const id of ids){try{let s=sessions.get(id);if(!s){if(coldRead.has(id))continue;const snapshot=await query.readSession(id);s={id,header:snapshot.session,events:snapshot.events};await ingest(s);coldRead.add(id)}else await ingest(s)}catch{failures.push(id)}finally{coverage.scannedSessions++}}
    coverage={...coverage,scanning:false,failedSessions:failures.length,persistenceFailures,unattributedCalls:records().filter(r=>r.ownerSessionId===null).length,corpusAvailable:Boolean(query),historical:'session-event-evidence',live:'native-llm-stream'}
    lastSyncAt=Date.now();return {...coverage}
  })();try{return await syncPromise}finally{syncPromise=null}}
  function refresh(){if(!syncPromise&&Date.now()-lastSyncAt>10000)void sync().catch(()=>{coverage={...coverage,scanning:false,failedSessions:coverage.failedSessions+1}});return {...coverage,persistenceFailures}}
  async function* observe(options,next){
    const liveSession=sessions.get(options.sessionId),s=liveSession??{id:options.sessionId??null,header:{id:options.sessionId??null},events:[]}
    if(s.id)meta(s)
    if(liveSession&&!eligible(s)){yield* next();return}
    const boundary=[...events(s)].reverse().find(e=>e.type==='step/start'||e.type==='llm/retry-started')
    const startedAt=Date.now(),id=randomUUID(), job=jobs().find(j=>j.childSessionId===s.id)
    const message=[...events(s)].reverse().find(e=>e.type==='user/message')?.data,phase=message?.source?.plugin==='roleplay-tasks'?(message.source.jobKind??message.source.stage??'management'):'narrative'
    let call={schemaVersion:1,id,sessionId:s.id,ownerSessionId:liveSession?owner(s):null,provider:safeId(options.provider),model:safeId(options.model),kind:job?.kind??options.purpose??(s.header?.origin==='subagent'?'subagent':phase),status:'running',startedAt,completedAt:null,durationMs:null,firstTokenMs:null,usage:null,
      source:{kind:'stream',invocationId:id,sessionId:s.id,startSeq:boundary?.seq??null,purpose:options.purpose??null,jobId:job?.id??null,routeEvidence:'request-options'}}
    const persist=async()=>{try{await put(call)}catch{persistenceFailures++}}
    active.add(id);await persist()
    try {for await(const chunk of next()){
      if(chunk.type==='usage'){call.usage=usageOf(chunk.usage);await persist()}
      if(['text-delta','reasoning-delta','tool-call-delta'].includes(chunk.type)&&call.firstTokenMs===null)call.firstTokenMs=Date.now()-startedAt
      if(chunk.type==='finish'){call.status=outcome(chunk.reason);if(['error','aborted'].includes(chunk.reason?.kind))call.error=reasonText(chunk.reason)}
      yield chunk
    }}catch(error){call.status='failed';call.error=reasonText(error);throw error}
    finally{if(call.status==='running')call.status=options.signal?.aborted?'cancelled':'unknown';call.completedAt=Date.now();call.durationMs=call.completedAt-startedAt;await persist();active.delete(id);if(s.id)scanned.delete(s.id)}
  }
  const jobKey=(ownerSessionId,childSessionId)=>`${ownerSessionId??''}\u0000${childSessionId??''}`
  const sharedJobIndex=allJobs=>{const index=new Map();for(const j of allJobs){if(!(j.sessionId??j.branchId)||!j.id)continue;for(const childId of new Set([j.childSessionId,...(j.childSessionIds??[])].filter(Boolean))){const key=jobKey(j.sessionId??j.branchId,childId);if(!index.has(key))index.set(key,[]);index.get(key).push(j.id)}}return index}
  function calls(allJobs=jobs()){const index=sharedJobIndex(allJobs);return records().map(r=>{const jobIds=index.get(jobKey(r.ownerSessionId,r.sessionId))??[],value=jobIds.length?{...r,source:{...r.source,jobIds:[...new Set([...(r.source.jobIds??[]),...jobIds])]}}:r;return value.status==='running'&&!active.has(value.id)&&value.source.kind==='stream'?{...value,status:'interrupted'}:value})}
  const prices=()=>{const saved=table.get(PRICE);return {revision:0,currency:'USD',rates:[],defaultMode:saved?'manual':'auto',defaultMultiplier:1,autoSync:false,...saved,schemaVersion:2}}
  async function savePrices(value,revision){return withTavernLock(table,PRICE,async()=>{
    if(prices().revision!==revision)throw new Error('单价已更新，请刷新后保存')
    if(!['USD','CNY','EUR','JPY','HKD'].includes(value?.currency)||!Array.isArray(value.rates)||value.rates.length>500)throw new Error('单价设置无效')
    const defaultMode=value.defaultMode??prices().defaultMode,defaultMultiplier=value.defaultMultiplier??prices().defaultMultiplier,autoSync=value.autoSync??prices().autoSync
    if(!['auto','manual'].includes(defaultMode)||n(defaultMultiplier)===null||defaultMultiplier>1e6||typeof autoSync!=='boolean')throw new Error('定价模式或倍率无效')
    const seen=new Set(),rates=value.rates.map(r=>{const provider=safeId(r.provider),model=safeId(r.model),key=JSON.stringify([provider,model]);if(!provider||!model||seen.has(key))throw new Error('模型单价重复或无效');seen.add(key)
      const mode=r.mode??'manual';if(!['auto','manual'].includes(mode)||r.multiplier!=null&&(n(r.multiplier)===null||r.multiplier>1e6)||r.catalogKey!=null&&(typeof r.catalogKey!=='string'||r.catalogKey.length>800||/[\x00-\x1f]/.test(r.catalogKey)))throw new Error('模型定价模式或倍率无效')
      const out={provider,model,mode,multiplier:r.multiplier??null,catalogKey:r.catalogKey??null};for(const f of ['input','output','cacheRead','cacheWrite']){if(r[f]!=null&&(n(r[f])===null||r[f]>1e9))throw new Error('单价须为非负数字');out[f]=r[f]??null}return out})
    if(value.currency!=='USD'&&(defaultMode==='auto'||rates.some(r=>r.mode==='auto')))throw new Error('自动定价单位为 USD，请选择 USD 或全部使用手动定价')
    const result={schemaVersion:2,revision:revision+1,currency:value.currency,defaultMode,defaultMultiplier,autoSync,rates,source:{kind:'player-prices'},updatedAt:Date.now()};await table.put(PRICE,result);return result
  })}
  function logs(){const allJobs=jobs(),jobIndex=sharedJobIndex(allJobs),actualCalls=calls(allJobs),list=actualCalls.map(c=>({...c,label:c.kind==='narrative'?'正文生成':c.kind==='session-title'?'会话标题生成':'模型调用'}))
    const jobUsage=j=>{
      const linked=actualCalls.filter(c=>c.ownerSessionId===(j.sessionId??j.branchId)&&(c.sessionId===j.childSessionId||c.source.jobId===j.id||c.source.jobIds?.includes(j.id)||c.source.taskIds?.includes(j.id)))
      const known=linked.filter(c=>c.usage),sharedCalls=linked.filter(c=>(jobIndex.get(jobKey(c.ownerSessionId,c.sessionId))?.length??0)>1||(c.source.taskIds?.length??0)>1).length
      const usage=known.length?Object.fromEntries([...fields,'totalTokens'].map(k=>{const values=known.map(c=>n(c.usage[k])).filter(v=>v!==null);return [k,values.length?values.reduce((a,b)=>a+b,0):null]})):null
      const missingUsageCalls=linked.filter(c=>!c.usage).length
      return {usage,usageSource:{kind:'linked-calls',callIds:linked.map(c=>c.id),sharedCalls,missingUsageCalls},
        usageNote:!linked.length?'暂无可关联的模型调用':`${linked.length} 次关联调用${sharedCalls?'，含共享步骤，不作独立计费':''}${missingUsageCalls?`；${missingUsageCalls} 次未返回用量`:''}`}
    }
    for(const j of allJobs){const usage=jobUsage(j),baseLabel={character:'角色推演 · '+(j.input?.character?.name??j.input?.character?.id??''),memory:'记忆与场景整理',status:'状态栏生成',decision:'决策建议','card-import':'读取角色卡','card-export':'导出角色卡','novel-export':'小说整理'}[j.kind]??'辅助任务';list.push({schemaVersion:1,id:`job-${j.id}`,sessionId:j.sessionId??j.branchId,ownerSessionId:j.sessionId??j.branchId,kind:j.kind,label:usage.usageSource.sharedCalls?`共享步骤 · ${baseLabel}`:baseLabel,status:j.status,provider:j.actualRoute?.provider,model:j.actualRoute?.model,startedAt:j.startedAt??j.createdAt,completedAt:j.completedAt??null,durationMs:j.completedAt?j.completedAt-(j.startedAt??j.createdAt):null,error:j.error?'任务失败，请重试或查看关联模型调用':null,progress:j.progress,fallback:publicFallback(j),source:{kind:'task',jobId:j.id,generation:j.generation},...usage})}
    return [...list,...values(LOG)].sort((a,b)=>(b.startedAt??0)-(a.startedAt??0))
  }
  return {observe,sync,refresh,ingest,calls,logs,prices,savePrices,sessionList:()=>values(META).filter(r=>r.sessionId===r.ownerSessionId).map(r=>({id:r.sessionId,label:r.label??`会话 ${r.sessionId.slice(-8)}`}))}
}
