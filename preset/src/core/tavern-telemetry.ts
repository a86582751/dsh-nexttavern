import { createHash, randomUUID } from 'node:crypto'
import { withTavernLock, taskFailureDetails, FAILURE_LABELS } from './tavern-tasks.js'
import { TELEMETRY_USAGE_FIELDS as fields, nonNegativeFinite as n, normalizeUsage as usageOf, safeTelemetryId as safeId, failureText as reasonText, telemetryOutcome as outcome } from './tavern-telemetry-normalize.js'
import { foldSessionCalls } from './tavern-telemetry-fold.js'
import { aggregateUsage } from './tavern-telemetry-aggregate.js'
import { queryUsageRequests } from './tavern-telemetry-query.js'
export { foldSessionCalls, aggregateUsage, queryUsageRequests }
export { timeRange } from './tavern-telemetry-time-range.js'

import type { TelemetryCallRecord, TelemetryUsage } from './tavern-telemetry-normalize.js'
import type { TelemetryEvent, TelemetryChunk } from './tavern-telemetry-fold.js'
import type { EmbeddingCall } from '../memory/memory-retrieval-types.js'

// Alpha.3 adapter shapes, not declarations of the incompatible GA session format.
interface SessionHeader {
  cwd?: string
  id?: string | null
  seedLength?: unknown
  agentPreset?: string
  origin?: string
  parentSession?: string
}
interface RuntimeSession {
  id: string
  header?: SessionHeader
  events?: readonly TelemetryEvent[]
  log?: readonly TelemetryEvent[]
}
interface SessionView extends Omit<RuntimeSession, 'id'> { id: string | null }
interface TelemetryTable {
  get(key: string): unknown
  put(key: string, value: unknown): unknown | Promise<unknown>
  entries(): Iterable<[string, unknown]>
}
interface TelemetryRoute { provider?: unknown; model?: unknown; reasoningEffort?: unknown }
interface TelemetryJob {
  id: string
  sessionId?: string
  branchId?: string
  childSessionId?: string
  childSessionIds?: string[]
  kind: string
  status: string
  createdAt: number
  startedAt?: number | null
  completedAt?: number | null
  generation?: string
  input?: { character?: { name?: string; id?: string } }
  actualRoute?: TelemetryRoute
  error?: unknown
  progress?: unknown
  fallback?: {
    from?: TelemetryRoute; to?: TelemetryRoute; at?: unknown; reason?: string
    failure?: { category?: string; code?: unknown; status?: unknown }
  }
}
interface TelemetryOptions {
  table: TelemetryTable
  sessions: { get(id: string): RuntimeSession | null | undefined; list?(): RuntimeSession[] }
  query?: {
    listSessions?(): { header?: SessionHeader }[] | Promise<{ header?: SessionHeader }[]>
    readSession?(id: string): Promise<{ session: SessionHeader; events: TelemetryEvent[] }>
  }
  jobs?(): unknown[]
}
const objectRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
function isTelemetryJob(value: unknown): value is TelemetryJob {
  if (!objectRecord(value) || !['id', 'kind', 'status'].every(key => typeof value[key] === 'string') ||
      typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return false
  if (['sessionId', 'branchId', 'childSessionId', 'generation'].some(key => value[key] !== undefined && typeof value[key] !== 'string') ||
      ['startedAt', 'completedAt'].some(key => value[key] != null && (typeof value[key] !== 'number' || !Number.isFinite(value[key])))) return false
  if (value.childSessionIds !== undefined && (!Array.isArray(value.childSessionIds) || !value.childSessionIds.every(id => typeof id === 'string'))) return false
  if (value.input !== undefined) {
    if (!objectRecord(value.input)) return false
    const character = value.input.character
    if (character !== undefined && (!objectRecord(character) || ['name', 'id'].some(key => character[key] !== undefined && typeof character[key] !== 'string'))) return false
  }
  if (value.actualRoute !== undefined && !objectRecord(value.actualRoute)) return false
  if (value.fallback !== undefined) {
    const fallback = value.fallback
    if (!objectRecord(fallback) || ['from', 'to', 'failure'].some(key => fallback[key] !== undefined && !objectRecord(fallback[key])) ||
        (fallback.reason !== undefined && typeof fallback.reason !== 'string')) return false
    if (objectRecord(fallback.failure) && fallback.failure.category !== undefined && typeof fallback.failure.category !== 'string') return false
  }
  return true
}
interface Coverage {
  scanning: boolean
  scannedSessions: number
  totalSessions: number
  failedSessions: number
  persistenceFailures?: number
  unattributedCalls?: number
  corpusAvailable?: boolean
  historical?: string
  live?: string
}
type StoredCall = TelemetryCallRecord & { superseded?: boolean }
interface LogRecord {
  schemaVersion: number
  id: string
  sessionId: string | null | undefined
  ownerSessionId: string | null | undefined
  kind: string
  label: string
  status: string
  provider?: unknown
  model?: unknown
  startedAt: number
  completedAt: number | null
  durationMs: number | null
  error?: unknown
  source: object
  usage?: TelemetryUsage | null
  usageSource?: { kind: string; callIds: string[]; sharedCalls: number; missingUsageCalls: number }
  usageNote?: string
  progress?: unknown
  fallback?: ReturnType<typeof publicFallback>
}
interface SessionLabel { sessionId: string; ownerSessionId: string | null; label?: string }
interface StoredRows { tavern_usage__: StoredCall; tavern_log__: LogRecord; tavern_usage_session__: SessionLabel }
const rateFields = ['input', 'output', 'cacheRead', 'cacheWrite'] as const
interface PriceRate extends Partial<Record<typeof rateFields[number], number | null>> {
  provider?: string; model?: string; mode?: string; multiplier?: number | null; catalogKey?: string | null
}
interface PriceInput { currency: string; rates: PriceRate[]; defaultMode?: string; defaultMultiplier?: number; autoSync?: boolean }
interface PriceState extends PriceInput { revision: number; schemaVersion: number; defaultMode: string; defaultMultiplier: number; autoSync: boolean }
interface ObserveOptions { sessionId?: string; provider?: unknown; model?: unknown; purpose?: string; signal?: AbortSignal }

const PREFIX='tavern_usage__', LOG='tavern_log__', PRICE='tavern_prices', META='tavern_usage_session__'
const hash=(v: unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
// Alpha.3 adapter: upstream c291e796 deprecates synchronous history readers.
// Migrate telemetry to committed-event projections; see docs/migration-ga.md.
const events=(s: Pick<RuntimeSession, 'events' | 'log'> | null | undefined): readonly TelemetryEvent[]=>s?.events??s?.log??[]
const publicFallback=(j: TelemetryJob)=>{
  if(!j.fallback)return null
  const route=(r: TelemetryRoute | null | undefined)=>({provider:safeId(r?.provider),model:safeId(r?.model),...(r?.reasoningEffort?{reasoningEffort:safeId(r.reasoningEffort)}:{})})
  const f=j.fallback,category=Object.hasOwn(FAILURE_LABELS,f.failure?.category??'')?f.failure!.category as keyof typeof FAILURE_LABELS:'unknown'
  return {from:route(f.from),to:route(f.to??j.actualRoute),at:n(f.at),reason:['timeout','failed','runtime-restart'].includes(f.reason!)?f.reason:'unknown',
    failure:{category,label:FAILURE_LABELS[category],code:taskFailureDetails({code:f.failure?.code}).code,status:n(f.failure?.status)}}
}
function presetOf(s: SessionView){let p=s?.header?.agentPreset;for(const e of events(s))if(e.type==='agent-preset/selected')p=e.data?.agentPreset??p;return p}

/** No prompts, tool arguments, output text, headers or credentials are stored. */
export function createTelemetry({table,sessions,query,jobs:readJobs=()=>[]}: TelemetryOptions) {
  const jobs=()=>readJobs().filter(isTelemetryJob)
  let syncPromise: Promise<Coverage> | null=null,persistenceFailures=0,lastSyncAt=0,coverage: Coverage={scanning:false,scannedSessions:0,totalSessions:0,failedSessions:0};const scanned=new Map<string, number>(), known=new Map<string | null | undefined, SessionHeader | undefined>(), active=new Set<string>(), coldRead=new Set<string>(), persisted=new Map<string, string>()
  // Existing schema rows are selected by namespace; migration does not filter or rewrite legacy records.
  const values=<K extends keyof StoredRows>(prefix: K): StoredRows[K][]=>[...table.entries()].filter(([k])=>k.startsWith(prefix)).map(([,v])=>v as StoredRows[K])
  const records=()=>values(PREFIX).filter(v=>!v.superseded)
  const meta=(s: SessionView)=>known.set(s.id,s.header)
  const owner=(s: SessionView): string | null=>{let h=s.header,seen=new Set();while(h?.origin==='subagent'&&h.parentSession&&!seen.has(h.id)){seen.add(h.id);h=known.get(h.parentSession)??sessions.get(h.parentSession)?.header??{id:h.parentSession};}return h?.id??s.id}
  function eligible(s: SessionView){if(presetOf(s)==='roleplay')return true;const id=owner(s);return (known.get(id)??(id?sessions.get(id)?.header:undefined))?.agentPreset==='roleplay'}
  async function writeChanged(key: string,value: unknown){const snapshot=JSON.stringify(value);if(persisted.get(key)===snapshot)return;await table.put(key,value);persisted.set(key,snapshot)}
  async function put(call: StoredCall){await writeChanged(PREFIX+call.id,call)}
  async function ingestUnlocked(s: RuntimeSession) {
    meta(s);if(!eligible(s))return
    const ownerSessionId=owner(s), relatedJobIds=jobs().filter(j=>j?.childSessionId===s.id&&(j.sessionId??j.branchId)===ownerSessionId&&j.id).map(j=>j.id), fingerprint=events(s).length
    if(relatedJobIds.length)for(const stream of records().filter(r=>r.sessionId===s.id&&r.source.kind==='stream')){
      const jobIds=[...new Set([...(stream.source.jobIds??[]),...(stream.source.jobId?[stream.source.jobId]:[]),...relatedJobIds])]
      if(jobIds.length!==stream.source.jobIds?.length||jobIds.some((id,i)=>id!==stream.source.jobIds?.[i]))await put({...stream,source:{...stream.source,jobIds}})
    }
    if(scanned.get(s.id)===fingerprint)return
    const streams=records().filter(r=>r.sessionId===s.id&&r.source.kind==='stream'&&!r.source.purpose)
    // Reuse the fold unless append-only history advanced while persistence yielded.
    let attempts=foldSessionCalls(s)
    for(const call of attempts){
      call.ownerSessionId=ownerSessionId
      const actual=streams.find(r=>r.source.startSeq===call.source.startSeq&&r.startedAt>=call.startedAt&&r.startedAt<=(call.completedAt??Infinity))
      if(actual){
        if(!active.has(actual.id))await put({...actual,status:call.status,completedAt:call.completedAt,durationMs:call.durationMs,firstTokenMs:call.firstTokenMs??actual.firstTokenMs,usage:call.usage??actual.usage,error:call.error??actual.error,provider:call.provider??actual.provider,model:call.model??actual.model,source:{...actual.source,evidenceSeq:call.source.evidenceSeq,taskIds:call.source.taskIds??actual.source.taskIds}})
        if(table.get(PREFIX+call.id))await put({...call,superseded:true});continue
      }
      await put(call)
    }
    if(events(s).length!==fingerprint)attempts=foldSessionCalls(s)
    const seed=Number(s.header?.seedLength??0), toolStarts=new Map<unknown, TelemetryEvent>()
    for(const e of events(s)){
      if (typeof e.time !== 'number' || !Number.isFinite(e.time)) continue
      if(e.seq<seed)continue
      if(e.type==='tool/call')toolStarts.set(e.data?.callId,e)
      if(!['tool/result','turn/end','compaction/end','assistant/message'].includes(e.type))continue
      const d=e.data??{},block=d.message?.content?.find(b=>b.type==='tool-result'),start=toolStarts.get(d.callId??d.message?.source?.callId??block?.toolCallId),bad=Boolean(d.error)||block?.isError===true||d.isError===true||d.result?.isError===true||d.reason?.kind==='error'
      const attempt=attempts.findLast(c=>c.source.turn===d.turn&&(!d.step||c.source.step===d.step))
      if(e.type==='assistant/message'&&(attempt?.kind!=='narrative'||!d.message?.content?.some(b=>b.type==='text')||d.message?.content?.some(b=>b.type==='tool-call')))continue
      const row: LogRecord={schemaVersion:1,id:hash([s.id,e.seq,'operation']),sessionId:s.id,ownerSessionId,kind:e.type==='tool/result'?'tool':e.type==='compaction/end'?'memory':e.type==='assistant/message'?'narrative':'turn',
        label:e.type==='tool/result'?`工具 · ${safeId(start?.data?.name??d.name)??'未知工具'}`:e.type==='compaction/end'?'记忆整理':e.type==='assistant/message'?'正文生成完毕':'轮次结束',
        status:bad?'failed':'completed',provider:attempt?.provider??null,model:attempt?.model??null,startedAt:start?.time??e.time,completedAt:e.time,durationMs:start?.time!==undefined?Math.max(0,e.time-start.time):null,
        error:bad?reasonText(d.error??d.reason??d):null,source:{kind:'session-event',sessionId:s.id,seq:e.seq}}
      await writeChanged(LOG+row.id,row)
    }
    const title=events(s).findLast(e=>e.type==='session/title')?.data?.title
    await table.put(META+hash(s.id),{schemaVersion:1,sessionId:s.id,ownerSessionId,label:safeId(title)??`会话 ${s.id.slice(-8)}`,source:{kind:'session-header'},updatedAt:Date.now()})
    scanned.set(s.id,fingerprint)
  }
  const ingest=(s: RuntimeSession)=>withTavernLock(table,`usage-ingest-${s.id}`,()=>ingestUnlocked(s))
  async function sync(){if(syncPromise)return syncPromise;coverage={...coverage,scanning:true,scannedSessions:0,failedSessions:0};syncPromise=(async()=>{
    const live=sessions.list?.()??[],failures: string[]=[];for(const s of live)meta(s)
    let corpus: {header?: SessionHeader}[]=[];try{corpus=await query?.listSessions?.()??[]}catch{failures.push('corpus')}
    for(const r of corpus)if(r.header)known.set(r.header.id,r.header)
    const ids=new Set([...live.map(s=>s.id),...corpus.map(r=>r.header?.id).filter((id): id is string=>Boolean(id))])
    coverage.totalSessions=ids.size
    for(const id of ids){try{let s=sessions.get(id);if(!s){if(coldRead.has(id))continue;const snapshot=await query!.readSession!(id);s={id,header:snapshot.session,events:snapshot.events};await ingest(s);coldRead.add(id)}else await ingest(s)}catch{failures.push(id)}finally{coverage.scannedSessions++}}
    coverage={...coverage,scanning:false,failedSessions:failures.length,persistenceFailures,unattributedCalls:records().filter(r=>r.ownerSessionId===null).length,corpusAvailable:Boolean(query),historical:'session-event-evidence',live:'native-llm-stream'}
    lastSyncAt=Date.now();return {...coverage}
  })();try{return await syncPromise}finally{syncPromise=null}}
  function refresh(){if(!syncPromise&&Date.now()-lastSyncAt>10000)void sync().catch(()=>{coverage={...coverage,scanning:false,failedSessions:coverage.failedSessions+1}});return {...coverage,persistenceFailures}}
  async function recordEmbedding(call: EmbeddingCall): Promise<StoredCall> {
    if (!call || call.schemaVersion !== 1 || !safeId(call.id) || !safeId(call.provider) || !safeId(call.model) || !safeId(call.workspaceId) || !['index', 'query', 'test'].includes(call.purpose) || !['completed', 'failed', 'unknown'].includes(call.status) || !Number.isFinite(call.startedAt) || !Number.isFinite(call.completedAt) || call.completedAt < call.startedAt || (call.ownerSessionId !== null && !safeId(call.ownerSessionId))) throw new Error('embedding telemetry call invalid')
    const id=safeId(call.id)!,key=PREFIX+id,existing=table.get(key) as StoredCall|null|undefined,provider=safeId(call.provider)!,model=safeId(call.model)!,workspaceId=safeId(call.workspaceId)!
    const providerUsage=Object.fromEntries(Object.entries(call.providerUsage??{}).filter(([key,value])=>safeId(key)&&n(value)!==null).map(([key,value])=>[safeId(key)!,n(value)!]))
    const usage: TelemetryUsage={inputTokens:n(call.inputTokens),outputTokens:null,cacheReadTokens:null,cacheWriteTokens:null,totalTokens:n(call.totalTokens)}
    const identity=[call.ownerSessionId,workspaceId,provider,model,call.purpose].join('\u0000')
    if(existing){
      const existingIdentity=[existing.ownerSessionId,existing.source.workspaceId,existing.provider,existing.model,existing.source.purpose].join('\u0000')
      if(existing.source.kind!=='embedding'||existingIdentity!==identity)throw new Error('embedding telemetry identity changed')
      if(existing.status!=='unknown'&&call.status==='unknown')throw new Error('embedding telemetry terminal rollback')
      if(existing.status!=='unknown'&&call.status!==existing.status)throw new Error('embedding telemetry terminal status changed')
      const mergedUsage: TelemetryUsage={inputTokens:null,outputTokens:null,cacheReadTokens:null,cacheWriteTokens:null,totalTokens:null,...(existing.usage??{})}
      for(const field of ['inputTokens','totalTokens'] as const)if(mergedUsage[field]===null&&usage[field]!==null)mergedUsage[field]=usage[field]
      const mergedProviderUsage={...(existing.providerUsage??{}),...providerUsage}
      const changed=JSON.stringify(mergedUsage)!==JSON.stringify(existing.usage??null)||JSON.stringify(mergedProviderUsage)!==JSON.stringify(existing.providerUsage??{})
      if(existing.status==='unknown'&&call.status!=='unknown'){
        const row={...existing,status:call.status,completedAt:call.completedAt,durationMs:call.completedAt-existing.startedAt,usage:mergedUsage,providerUsage:mergedProviderUsage}
        await put(row);return row
      }
      if(changed){const row={...existing,usage:mergedUsage,providerUsage:mergedProviderUsage};await put(row);return row}
      return existing
    }
    const row: StoredCall={schemaVersion:1,id,sessionId:call.ownerSessionId,ownerSessionId:call.ownerSessionId,provider,model,kind:'embedding',status:call.status,startedAt:call.startedAt,completedAt:call.completedAt,durationMs:call.completedAt-call.startedAt,firstTokenMs:null,usage,providerUsage,source:{kind:'embedding',sessionId:call.ownerSessionId,workspaceId,purpose:call.purpose,invocationId:safeId(call.requestId)??id,routeEvidence:'embedding-worker'}}
    await put(row);return row
  }
  async function* observe<C extends TelemetryChunk>(options: ObserveOptions,next: () => AsyncIterable<C>): AsyncGenerator<C>{
    const liveSession=options.sessionId?sessions.get(options.sessionId):undefined,s: SessionView=liveSession??{id:options.sessionId??null,header:{id:options.sessionId??null},events:[]}
    if(s.id)meta(s)
    if(liveSession&&!eligible(s)){yield* next();return}
    const boundary=events(s).findLast(e=>e.type==='step/start'||e.type==='llm/retry-started')
    const startedAt=Date.now(),id=randomUUID(), job=jobs().find(j=>j.childSessionId===s.id)
    const message=events(s).findLast(e=>e.type==='user/message')?.data,phase=message?.source?.plugin==='roleplay-tasks'?(message.source.jobKind??message.source.stage??'management'):'narrative'
    let call: StoredCall={schemaVersion:1,id,sessionId:s.id,ownerSessionId:liveSession?owner(s):null,provider:safeId(options.provider),model:safeId(options.model),kind:job?.kind??options.purpose??(s.header?.origin==='subagent'?'subagent':phase),status:'running',startedAt,completedAt:null,durationMs:null,firstTokenMs:null,usage:null,
      source:{kind:'stream',invocationId:id,sessionId:s.id,startSeq:boundary?.seq??null,purpose:options.purpose??null,jobId:job?.id??null,routeEvidence:'request-options'}}
    const persist=async()=>{try{await put(call)}catch{persistenceFailures++}}
    active.add(id);await persist()
    try {for await(const chunk of next()){
      if(chunk.type==='usage'){call.usage=usageOf(chunk.usage);await persist()}
      if(['text-delta','reasoning-delta','tool-call-delta'].includes(chunk.type)&&call.firstTokenMs===null)call.firstTokenMs=Date.now()-startedAt
      if(chunk.type==='finish'){call.status=outcome(chunk.reason);if(['error','aborted'].includes(chunk.reason?.kind!))call.error=reasonText(chunk.reason)}
      yield chunk
    }}catch(error){call.status='failed';call.error=reasonText(error);throw error}
    finally{if(call.status==='running')call.status=options.signal?.aborted?'cancelled':'unknown';call.completedAt=Date.now();call.durationMs=call.completedAt-startedAt;await persist();active.delete(id);if(s.id)scanned.delete(s.id)}
  }
  const jobKey=(ownerSessionId: string | null | undefined,childSessionId: string | null | undefined)=>`${ownerSessionId??''}\u0000${childSessionId??''}`
  const sharedJobIndex=(allJobs: TelemetryJob[])=>{const index=new Map<string, string[]>();for(const j of allJobs){if(!(j.sessionId??j.branchId)||!j.id)continue;for(const childId of new Set([j.childSessionId,...(j.childSessionIds??[])].filter(Boolean))){const key=jobKey(j.sessionId??j.branchId,childId);if(!index.has(key))index.set(key,[]);index.get(key)!.push(j.id)}}return index}
  function calls(allJobs=jobs()){const index=sharedJobIndex(allJobs);return records().map(r=>{const jobIds=index.get(jobKey(r.ownerSessionId,r.sessionId))??[],value=jobIds.length?{...r,source:{...r.source,jobIds:[...new Set([...(r.source.jobIds??[]),...jobIds])]}}:r;return value.status==='running'&&!active.has(value.id)&&value.source.kind==='stream'?{...value,status:'interrupted'}:value})}
  const prices=(): PriceState=>{const saved=table.get(PRICE) as Partial<PriceState> | null | undefined;return {revision:0,currency:'USD',rates:[],defaultMode:saved?'manual':'auto',defaultMultiplier:1,autoSync:false,...saved,schemaVersion:2}}
  async function savePrices(rawValue: unknown,revision: number | undefined){const value=rawValue as PriceInput;return withTavernLock(table,PRICE,async()=>{
    if(prices().revision!==revision)throw new Error('单价已更新，请刷新后保存')
    if(!['USD','CNY','EUR','JPY','HKD'].includes(value?.currency)||!Array.isArray(value.rates)||value.rates.length>500)throw new Error('单价设置无效')
    const defaultMode=value.defaultMode??prices().defaultMode,defaultMultiplier=value.defaultMultiplier??prices().defaultMultiplier,autoSync=value.autoSync??prices().autoSync
    if(!['auto','manual'].includes(defaultMode)||n(defaultMultiplier)===null||defaultMultiplier>1e6||typeof autoSync!=='boolean')throw new Error('定价模式或倍率无效')
    const seen=new Set<string>(),rates=value.rates.map(r=>{const provider=safeId(r.provider),model=safeId(r.model),key=JSON.stringify([provider,model]);if(!provider||!model||seen.has(key))throw new Error('模型单价重复或无效');seen.add(key)
      const mode=r.mode??'manual';if(!['auto','manual'].includes(mode)||r.multiplier!=null&&(n(r.multiplier)===null||r.multiplier>1e6)||r.catalogKey!=null&&(typeof r.catalogKey!=='string'||r.catalogKey.length>800||/[\x00-\x1f]/.test(r.catalogKey)))throw new Error('模型定价模式或倍率无效')
      const out: PriceRate={provider,model,mode,multiplier:r.multiplier??null,catalogKey:r.catalogKey??null};for(const f of rateFields){if(r[f]!=null&&(n(r[f])===null||r[f]>1e9))throw new Error('单价须为非负数字');out[f]=r[f]??null}return out})
    if(value.currency!=='USD'&&(defaultMode==='auto'||rates.some(r=>r.mode==='auto')))throw new Error('自动定价单位为 USD，请选择 USD 或全部使用手动定价')
    const result={schemaVersion:2,revision:revision+1,currency:value.currency,defaultMode,defaultMultiplier,autoSync,rates,source:{kind:'player-prices'},updatedAt:Date.now()};await table.put(PRICE,result);return result
  })}
  function logs(){const allJobs=jobs(),jobIndex=sharedJobIndex(allJobs),actualCalls=calls(allJobs),list: LogRecord[]=actualCalls.map(c=>({...c,label:c.kind==='narrative'?'正文生成':c.kind==='session-title'?'会话标题生成':'模型调用'}))
    const jobUsage=(j: TelemetryJob)=>{
      const linked=actualCalls.filter(c=>c.ownerSessionId===(j.sessionId??j.branchId)&&(c.sessionId===j.childSessionId||c.source.jobId===j.id||c.source.jobIds?.includes(j.id)||c.source.taskIds?.includes(j.id)))
      const known=linked.filter((c): c is typeof c & {usage: TelemetryUsage}=>Boolean(c.usage)),sharedCalls=linked.filter(c=>(jobIndex.get(jobKey(c.ownerSessionId,c.sessionId))?.length??0)>1||(c.source.taskIds?.length??0)>1).length
      const usage=known.length?Object.fromEntries([...fields,'totalTokens' as const].map(k=>{const values=known.map(c=>n(c.usage[k])).filter(v=>v!==null);return [k,values.length?values.reduce((a,b)=>a+b,0):null]})) as TelemetryUsage:null
      const missingUsageCalls=linked.filter(c=>!c.usage).length
      return {usage,usageSource:{kind:'linked-calls',callIds:linked.map(c=>c.id),sharedCalls,missingUsageCalls},
        usageNote:!linked.length?'暂无可关联的模型调用':`${linked.length} 次关联调用${sharedCalls?'，含共享步骤，不作独立计费':''}${missingUsageCalls?`；${missingUsageCalls} 次未返回用量`:''}`}
    }
    for(const j of allJobs){const usage=jobUsage(j),baseLabel=({character:'角色推演 · '+(j.input?.character?.name??j.input?.character?.id??''),memory:'记忆与场景整理',status:'状态栏生成',decision:'决策建议','card-import':'读取角色卡','card-export':'导出角色卡','novel-export':'小说整理'} as Record<string, string>)[j.kind]??'辅助任务';list.push({schemaVersion:1,id:`job-${j.id}`,sessionId:j.sessionId??j.branchId,ownerSessionId:j.sessionId??j.branchId,kind:j.kind,label:usage.usageSource.sharedCalls?`共享步骤 · ${baseLabel}`:baseLabel,status:j.status,provider:j.actualRoute?.provider,model:j.actualRoute?.model,startedAt:j.startedAt??j.createdAt,completedAt:j.completedAt??null,durationMs:j.completedAt?j.completedAt-(j.startedAt??j.createdAt):null,error:j.error?'任务失败，请重试或查看关联模型调用':null,progress:j.progress,fallback:publicFallback(j),source:{kind:'task',jobId:j.id,generation:j.generation},...usage})}
    return [...list,...values(LOG)].sort((a,b)=>(b.startedAt??0)-(a.startedAt??0))
  }
  return {observe,sync,refresh,ingest,recordEmbedding,calls,logs,prices,savePrices,sessionList:()=>values(META).filter(r=>r.sessionId===r.ownerSessionId).map(r=>({id:r.sessionId,label:r.label??`会话 ${r.sessionId.slice(-8)}`}))}
}
