// Independent models.dev consumer; product behavior references CC Switch (MIT).
// Sources, revisions and license attribution: docs/tavern-pricing.md.
import { createHash } from 'node:crypto'
const KEY='tavern_price_catalog',URL='https://models.dev/api.json',TTL=6*60*60*1000,MAX_BYTES=16*1024*1024
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null
const text=v=>typeof v==='string'?v.replace(/[\x00-\x1f]/g,'').slice(0,400):null
const rateFields=['input','output','cacheRead','cacheWrite']
const rates=c=>({input:number(c?.input),output:number(c?.output),cacheRead:number(c?.cache_read),cacheWrite:number(c?.cache_write)})
export function normalizeCatalog(data){
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('目录格式无效')
  const result=[]
  for(const [provider,p] of Object.entries(data))for(const [model,m] of Object.entries(p?.models??{})){
    if(!provider||!model||provider.length>200||model.length>400||/[\x00-\x1f]/.test(provider+model))continue
    if(m?.status==='deprecated'||!m?.modalities?.output?.includes('text')||m.modalities.output.some(v=>['audio','image','video'].includes(v))||!m.cost)continue
    const base=rates(m.cost);if(base.input===null&&base.output===null)continue
    const tiers=Array.isArray(m.cost.tiers)?m.cost.tiers.filter(t=>t?.tier?.type==='context'&&number(t.tier.size)!==null).map(t=>({threshold:t.tier.size,...rates(t)})).sort((a,b)=>a.threshold-b.threshold):[]
    result.push({key:`${provider}/${model}`,provider,model,name:text(m.name)??model,providerName:text(p.name)??provider,releaseDate:text(m.release_date),rates:base,tiers,unsupportedTiers:Array.isArray(m.cost.tiers)&&m.cost.tiers.some(t=>t?.tier?.type!=='context')})
    if(result.length>30000)throw new Error('目录条目超过限制')
  }
  if(!result.length)throw new Error('目录没有有效文本模型定价')
  return result
}
export function createPriceCatalog({table,fetcher=fetch,now=Date.now}){
  let pending=null
  const state=()=>({...table.get(KEY)??{schemaVersion:1,source:URL,entries:[],fetchedAt:null},syncing:Boolean(pending)})
  async function sync(force=false){if(pending)return pending;const previous=state();if(!force&&previous.fetchedAt&&now()-previous.fetchedAt<TTL)return previous
    pending=(async()=>{try{
      const response=await fetcher(URL,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{accept:'application/json'}})
      if(!response.ok)throw new Error('目录请求失败')
      if(Number(response.headers.get('content-length'))>MAX_BYTES)throw new Error('目录过大')
      const reader=response.body.getReader(),parts=[];let size=0
      try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw new Error('目录过大');parts.push(Buffer.from(value))}}finally{await reader.cancel().catch(()=>{})}
      const bytes=Buffer.concat(parts),entries=normalizeCatalog(JSON.parse(bytes.toString('utf8')))
      const record={schemaVersion:1,source:URL,currency:'USD',unit:'per-million-tokens',fetchedAt:now(),attemptedAt:now(),sha256:createHash('sha256').update(bytes).digest('hex'),entries,error:null}
      await table.put(KEY,record)
    }catch{const {syncing,...prior}=previous;await table.put(KEY,{...prior,schemaVersion:1,attemptedAt:now(),error:'同步失败（网络或目录数据异常）；已保留上次成功的价格。'})}
    return state()})()
    try{return await pending}finally{pending=null}
  }
  const status=()=>{const s=state();return {source:URL,currency:'USD',unit:'per-million-tokens',fetchedAt:s.fetchedAt,attemptedAt:s.attemptedAt,sha256:s.sha256,stale:!s.fetchedAt||now()-s.fetchedAt>=TTL,syncing:s.syncing,count:s.entries.length,error:s.error??null}}
  const refresh=()=>{const s=state();if(!pending&&(!s.attemptedAt||now()-s.attemptedAt>=TTL))void sync().catch(()=>{});return status()}
  return {state,status,sync,refresh}
}
const indexes=new WeakMap()
function index(entries){if(!indexes.has(entries))indexes.set(entries,new Map(entries.map(e=>[e.key,e])));return indexes.get(entries)}
export function automaticKey(provider,model){return `${provider==='deepseek-official'?'deepseek':provider}/${model}`}
function buckets(usage){const b={input:number(usage?.inputTokens),output:number(usage?.outputTokens),cacheRead:number(usage?.cacheReadTokens),cacheWrite:number(usage?.cacheWriteTokens)},total=number(usage?.totalTokens),missing=rateFields.filter(k=>b[k]===null)
  if(total!==null&&missing.length){const known=rateFields.reduce((sum,k)=>sum+(b[k]??0),0),remaining=total-known;if(remaining>=0&&(missing.length===1||remaining===0))for(const k of missing)b[k]=missing.length===1?remaining:0}
  return b
}
export function resolvePricing(call,settings={},entries=[]){
  const row=settings.rates?.find(r=>r.provider===call.provider&&r.model===call.model),mode=row?(row.mode??'manual'):(settings.defaultMode??'manual')
  const absent=reason=>({cost:null,baseCost:null,mode,status:reason,currency:settings.currency??'USD'})
  let chosen,entry=null,multiplier=1
  if(mode==='auto'){
    if(settings.currency&&settings.currency!=='USD')return absent('currency-mismatch')
    entry=index(entries).get(row?.catalogKey||automaticKey(call.provider,call.model));if(!entry)return absent('missing-catalog')
    if(entry.unsupportedTiers)return absent('unsupported-tier')
    chosen={...entry.rates};multiplier=row?.multiplier??settings.defaultMultiplier??1
    if(number(multiplier)===null)return absent('invalid-multiplier')
  }else {if(!row)return absent('missing-manual');chosen=row}
  if(mode==='auto'&&multiplier===0)return {cost:0,baseCost:null,mode,status:'zero-multiplier',multiplier,catalogKey:entry.key,currency:'USD'}
  if(!call.usage)return absent('missing-usage')
  const b=buckets(call.usage)
  if(entry?.tiers.length){
    const exact=number(call.usage.totalTokens),output=number(call.usage.outputTokens)
    const context=exact!==null&&output!==null&&exact>=output?exact-output:null
    if(context===null)return absent('unknown-context-tier')
    const tier=entry.tiers.findLast(t=>context>=t.threshold)
    if(tier)chosen={...chosen,...Object.fromEntries(rateFields.map(k=>[k,tier[k]??chosen[k]]))}
  }
  let baseCost=0
  for(const key of rateFields){const amount=b[key],rate=number(chosen[key]);if(rate===0||amount===0)continue;if(amount===null)return absent('missing-usage');if(rate===null)return absent(`missing-${key}-rate`);baseCost+=amount*rate/1e6}
  return {cost:baseCost*multiplier,baseCost,mode,multiplier,catalogKey:entry?.key??null,rates:Object.fromEntries(rateFields.map(k=>[k,number(chosen[k])])),currency:settings.currency??'USD',status:'priced'}
}

const FX_KEY='tavern_exchange_rates',FX_URL='https://open.er-api.com/v6/latest/USD',FX_SOURCE='https://www.exchangerate-api.com',DAY=86400000
/** Daily public quotes; no account credentials, player data or arbitrary fetch URL. */
export function createExchangeRates({table,fetcher=fetch,now=Date.now}){
  let pending=null
  const state=()=>({...table.get(FX_KEY)??{schemaVersion:1,rates:{},rateAt:null,fetchedAt:null},syncing:Boolean(pending)})
  const status=()=>{const s=state();return {source:'ExchangeRate-API',sourceUrl:FX_SOURCE,rateAt:s.rateAt,fetchedAt:s.fetchedAt,nextUpdateAt:s.nextUpdateAt??null,stale:!s.rateAt||now()-s.rateAt>=2*DAY||now()>=(s.nextUpdateAt??0),syncing:s.syncing,error:s.error??null}}
  async function sync(force=false){
    if(pending)return pending
    const previous=state(),time=now()
    // Failed requests back off for an hour; manual refresh is still available.
    if(!force&&(previous.error&&time-(previous.attemptedAt??0)<3600000||previous.fetchedAt&&time<Math.min(previous.nextUpdateAt??0,previous.fetchedAt+DAY)))return state()
    pending=(async()=>{try{
      const response=await fetcher(FX_URL,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{accept:'application/json'}})
      if(!response.ok||Number(response.headers.get('content-length'))>1024*1024)throw new Error('invalid response')
      const reader=response.body.getReader(),parts=[];let size=0
      try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024)throw new Error('oversize');parts.push(Buffer.from(value))}}finally{await reader.cancel().catch(()=>{})}
      const bytes=Buffer.concat(parts),data=JSON.parse(bytes.toString('utf8')),rateAt=data.time_last_update_unix*1000,nextUpdateAt=data.time_next_update_unix*1000
      if(data.result!=='success'||data.base_code!=='USD'||data.rates?.USD!==1||!(number(data.rates?.CNY)>0)||!Number.isFinite(rateAt)||rateAt<=0||rateAt>now()+300000||!Number.isFinite(nextUpdateAt)||nextUpdateAt<=rateAt)throw new Error('invalid quote')
      const rates=Object.fromEntries(['USD','CNY','EUR','JPY','HKD'].filter(k=>number(data.rates[k])>0).map(k=>[k,data.rates[k]]))
      await table.put(FX_KEY,{schemaVersion:1,source:FX_URL,sourceUrl:FX_SOURCE,base:'USD',rates,rateAt,nextUpdateAt,fetchedAt:now(),attemptedAt:now(),sha256:createHash('sha256').update(bytes).digest('hex'),error:null})
    }catch{const {syncing,...prior}=previous;await table.put(FX_KEY,{...prior,schemaVersion:1,attemptedAt:now(),error:'汇率更新失败，继续使用上次成功的汇率；没有缓存时成本显示 N/A。'})}})()
    try{await pending}finally{pending=null}
    return state()
  }
  const refresh=()=>{void sync().catch(()=>{});return status()}
  return {state,status,sync,refresh}
}
/** Display conversion never mutates saved rates or the underlying usage ledger. */
export function convertUsageCurrency(stats,target,quote,now=Date.now()){
  if(!['USD','CNY'].includes(target))throw new Error('展示币种必须为 USD 或 CNY')
  const source=stats.currency??'USD',from=quote.rates?.[source],to=quote.rates?.[target],rate=source===target?1:number(from)>0&&number(to)>0?to/from:null
  const convert=row=>({...row,cost:row.cost===null||rate===null?null:row.cost*rate,knownCost:rate===null?null:row.knownCost*rate})
  return {...stats,currency:target,sourceCurrency:source,totals:convert(stats.totals),models:stats.models.map(convert),providers:(stats.providers??[]).map(convert),timeline:stats.timeline.map(convert),fx:source===target?null:{source:'ExchangeRate-API',sourceUrl:FX_SOURCE,rate,rateAt:quote.rateAt??null,fetchedAt:quote.fetchedAt??null,stale:!quote.rateAt||now-quote.rateAt>=2*DAY||now>=(quote.nextUpdateAt??0),syncing:Boolean(quote.syncing),error:quote.error??null}}
}
