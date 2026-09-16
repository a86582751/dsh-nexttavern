import assert from 'node:assert/strict'
import { normalizeCatalog, resolvePricing, createPriceCatalog, createExchangeRates, convertUsageCurrency } from '../src/core/tavern-pricing.js'
import { registerTelemetryRoutes } from '../src/core/roleplay-telemetry-routes.js'
const feed={deepseek:{name:'DeepSeek',models:{'deepseek-v4-flash':{id:'deepseek-v4-flash',name:'Flash',modalities:{output:['text']},cost:{input:.14,output:.28,cache_read:.0028}}}},relay:{models:{'deepseek-v4-flash':{modalities:{output:['text']},cost:{input:9,output:9}}}},test:{models:{tiered:{modalities:{output:['text']},cost:{input:1,output:2,cache_read:.1,cache_write:.2,tiers:[{tier:{type:'context',size:200000},input:2,output:4,cache_read:.2,cache_write:.4}]}}}}}
const catalog=normalizeCatalog(feed)
const call={provider:'deepseek-official',model:'deepseek-v4-flash',usage:{inputTokens:100,outputTokens:20,cacheReadTokens:900,cacheWriteTokens:0,totalTokens:1020}}
const config={currency:'USD',defaultMode:'auto',defaultMultiplier:2,rates:[]}
assert.ok(Math.abs(resolvePricing(call,config,catalog).cost-.00004424)<1e-12)
assert.equal(resolvePricing({...call,provider:'custom-relay'},config,catalog).cost,null,'unknown route must not guess among provider prices')
const selected={...config,rates:[{provider:'custom-relay',model:call.model,mode:'auto',catalogKey:'deepseek/deepseek-v4-flash',multiplier:.5,input:999}]}
assert.ok(Math.abs(resolvePricing({...call,provider:'custom-relay'},selected,catalog).cost-.00001106)<1e-12,'auto ignores client manual fields')
assert.equal(resolvePricing({...call,usage:{...call.usage,cacheWriteTokens:10}},config,catalog).cost,null)
const exactTotal={...call,usage:{...call.usage,cacheWriteTokens:null}}
assert.equal(resolvePricing(exactTotal,config,catalog).cost,resolvePricing(call,config,catalog).cost,'exact total proves omitted write bucket is zero')
const manual={currency:'USD',rates:[{provider:call.provider,model:call.model,mode:'manual',input:1,output:2,cacheRead:0,cacheWrite:0}]}
assert.ok(Math.abs(resolvePricing(call,manual,catalog).cost-.00014)<1e-12)
assert.equal(resolvePricing(call,{...config,defaultMultiplier:0},catalog).cost,0)
const tier={provider:'test',model:'tiered',usage:{inputTokens:210000,outputTokens:100,cacheReadTokens:0,cacheWriteTokens:0,totalTokens:210100}}
assert.equal(resolvePricing(tier,{...config,defaultMultiplier:1},catalog).cost,.4204)
assert.equal(resolvePricing({...tier,usage:{...tier.usage,totalTokens:null,cacheReadTokens:null}},config,catalog).cost,null)
assert.equal(resolvePricing({...tier,usage:{...tier.usage,totalTokens:null}},config,catalog).cost,null,'tiered prices need exact provider total evidence')
class Table extends Map {async put(k,v){this.set(k,structuredClone(v))}}
const table=new Table();let hits=0
const cache=createPriceCatalog({table,fetcher:async()=>{hits++;return new Response(JSON.stringify(feed))}})
await cache.sync();await cache.sync();assert.equal(hits,1)
assert.equal(cache.state().entries.length,3)
const offline=createPriceCatalog({table,fetcher:async()=>{throw new Error('offline')}})
await offline.sync(true);assert.equal(offline.state().entries.length,3);assert.ok(offline.state().error)
const invalid=createPriceCatalog({table:new Table(),fetcher:async()=>new Response('x'.repeat(100),{headers:{'content-length':'999999999'}})})
await invalid.sync();assert.equal(invalid.state().entries.length,0);assert.ok(invalid.state().error)
console.log('tavern-pricing=ok (provider identity, tiers, multipliers, manual, missing rates, cache, offline, limits)')
let clock=1_800_000_000_000,fxHits=0
const fxTable=new Table(),fxFeed={result:'success',base_code:'USD',time_last_update_unix:clock/1000,time_next_update_unix:clock/1000+86400,rates:{USD:1,CNY:7,EUR:.9,JPY:140,HKD:7.8}}
const fx=createExchangeRates({table:fxTable,now:()=>clock,fetcher:async()=>{fxHits++;return new Response(JSON.stringify(fxFeed))}})
await fx.sync();await fx.sync();assert.equal(fxHits,1,'daily cache avoids duplicate requests')
const stats={currency:'USD',totals:{cost:2,knownCost:2,calls:3},models:[{cost:null,knownCost:1}],providers:[{provider:'test',cost:null,knownCost:1}],timeline:[{cost:0,knownCost:0}]}
const cny=convertUsageCurrency(stats,'CNY',fx.state(),clock)
assert.equal(cny.totals.cost,14);assert.equal(cny.totals.calls,3);assert.equal(cny.models[0].cost,null);assert.equal(cny.models[0].knownCost,7);assert.equal(cny.timeline[0].cost,0);assert.equal(stats.totals.cost,2)
assert.equal(cny.providers[0].knownCost,7);assert.equal(cny.providers[0].cost,null);assert.equal(stats.providers[0].knownCost,1)
assert.equal(convertUsageCurrency(cny,'USD',fx.state(),clock).totals.cost,2)
assert.equal(convertUsageCurrency(stats,'CNY',{},clock).totals.cost,null)
assert.equal(convertUsageCurrency(stats,'USD',{},clock).totals.cost,2)
clock+=86400001
const fxOffline=createExchangeRates({table:fxTable,now:()=>clock,fetcher:async()=>{throw new Error('secret request details')}})
await fxOffline.sync();assert.equal(fxOffline.status().stale,true);assert.equal(fxOffline.state().rates.CNY,7);assert.ok(!fxOffline.status().error.includes('secret'))
await fxOffline.sync();assert.equal(fxHits,1)
const badFx=createExchangeRates({table:new Table(),now:()=>clock,fetcher:async()=>new Response(JSON.stringify({...fxFeed,rates:{USD:1,CNY:-1}}))})
await badFx.sync();assert.equal(badFx.status().rateAt,null);assert.ok(badFx.status().error)
console.log('exchange-rate=ok (daily refresh, conversion, missing quotes, offline cache, provenance)')

// Route scheduling and filters use deterministic services; no external network.
const routes=new Map(),events=[]
let autoSync=false
const ledger=[
  {id:'a',ownerSessionId:'current',sessionId:'current',provider:'p',model:'m',kind:'narrative',status:'completed',startedAt:100,usage:{inputTokens:1},source:{}},
  {id:'b',ownerSessionId:'other',sessionId:'other',provider:'p',model:'m',kind:'narrative',status:'completed',startedAt:200,usage:{inputTokens:1},source:{}},
  {id:'c',ownerSessionId:'current',sessionId:'current',provider:'p',model:'different',kind:'status',status:'failed',startedAt:300,usage:null,source:{}},
  {id:'hidden',ownerSessionId:null,sessionId:null,provider:'p',model:'m',kind:'narrative',status:'completed',startedAt:150,usage:{inputTokens:1},source:{}},
]
registerTelemetryRoutes({
  ctx:{effect:fn=>fn(),connection:{fetch:{register:route=>routes.set(route.path,route)}}},
  resolveRoleplaySession:async id=>id==='current'?{id}:null,
  priceCatalog:{state:()=>({entries:[]}),status:()=>({count:0}),refresh:()=>events.push('catalog-refresh'),sync:async force=>{events.push(['catalog-sync',force])}},
  exchangeRates:{state:()=>({rates:{USD:1,CNY:7}}),status:()=>({rateAt:100}),refresh:()=>events.push('fx-refresh'),sync:async force=>{events.push(['fx-sync',force])}},
  telemetry:{prices:()=>({currency:'USD',rates:[],autoSync}),refresh:()=>({}),calls:()=>ledger,logs:()=>ledger,sessionList:()=>[]},
})
async function route(path,query='',body){
  const request=new Request(`https://fixture.test/api/roleplay/${path}?sessionId=current&${query}`,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
  const response=await routes.get(`/api/roleplay/${path}`).fetch(request)
  return {status:response.status,...await response.json()}
}
await route('exchange-rate');assert.deepEqual(events.splice(0),['fx-refresh'])
await route('exchange-rate','',{sessionId:'current',action:'sync'});assert.deepEqual(events.splice(0),[['fx-sync',true]])
assert.equal((await route('exchange-rate','',{sessionId:'current',action:'invalid'})).status,400)
await route('price-catalog');assert.deepEqual(events.splice(0),[])
autoSync=true
await route('price-catalog');assert.deepEqual(events.splice(0),['catalog-refresh'])
await route('price-catalog','',{sessionId:'current',action:'sync'});assert.deepEqual(events.splice(0),[['catalog-sync',true]])
assert.equal((await route('price-catalog','',{sessionId:'current',action:'invalid'})).status,400)
await route('prices');assert.deepEqual(events.splice(0),['catalog-refresh'])
autoSync=false
for(const path of ['usage','usage-requests']){
  const total=result=>path==='usage'?result.totals.calls:result.total
  assert.equal(total(await route(path,'from=0&to=400')),2)
  assert.equal(total(await route(path,'from=0&to=400&scope=all')),3)
  assert.equal(total(await route(path,'from=0&to=400&targetSessionId=other')),1)
  assert.equal(total(await route(path,'from=100&to=200&scope=all&provider=p&model=m')),1)
  assert.equal(total(await route(path,'from=0&to=400&provider=absent')),0)
  assert.equal(total(await route(path,'from=0&to=400&model=absent')),0)
  await route(path,'currency=USD');assert.deepEqual(events.splice(0),[])
  await route(path,'currency=CNY');assert.deepEqual(events.splice(0),['fx-refresh'])
  assert.equal((await route(path,'currency=invalid')).status,400)
  assert.deepEqual(events.splice(0),[])
}
const logs=await route('logs','from=0&to=400&scope=all&status=completed&kind=narrative&model=m&offset=-10&limit=1')
assert.equal(logs.total,2);assert.equal(logs.offset,0);assert.equal(logs.limit,1);assert.deepEqual(logs.rows.map(r=>r.id),['a'])
const clamped=await route('logs','from=0&to=400&offset=999999999&limit=999')
assert.equal(clamped.total,2);assert.equal(clamped.offset,1e7);assert.equal(clamped.limit,100);assert.deepEqual(clamped.rows,[])
console.log('telemetry-routes=ok (refresh/sync, currency, ownership, filters, pagination)')
