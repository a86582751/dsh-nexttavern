import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {registerAdaptationTools} from '../src/core/card-adaptation-tools.js'
import {createTestDirectory,cleanupTestDirectory} from '../tools/test-temp.mjs'

const temp=createTestDirectory('coarse-integration-')
try {
  fs.writeFileSync(path.join(temp,'original.txt'),'第一章 世界规则\n林舟出生于北城。北城属于山盟。山盟必须守约。林舟为了家人离城，守约行动最终救回家人。\n'+'林舟'.repeat(6000))
  const db=new Map(),tools=new Map(),disposers:(()=>void)[]=[]
  const table={get:k=>db.get(k),put:async(k,v)=>{db.set(k,structuredClone(v))},delete:async k=>db.delete(k)}
  const session={id:'new-author',header:{cwd:temp,agentPreset:'roleplay'},events:[] as any[]}
  let askCount=0,selectedMode:'coarse'|'close-reading'='coarse',answerGate:Promise<void>|undefined,stamp=0,provider=false,modelRevision=0,fp='1'.repeat(64),checked=false,denseHits=false
  let statusGate:Promise<void>|undefined,statusEntered:(()=>void)|undefined
  const api=registerAdaptationTools({ctx:{effect:f=>{const d=f();if(typeof d==='function')disposers.push(d)},tools:{register:t=>tools.set(t.name,t)}},table,sessionOf:async()=>session,active:()=>true,selectionStamp:()=>String(stamp),
    askReadingMode:async()=>{askCount++;await answerGate;return {mode:selectedMode,protagonist:'林舟',openingPoint:'离城之前'}},
    retrieval:{adaptationModels:async()=>({revision:modelRevision,providers:provider?[{id:'embed',ready:true,kind:'local'}]:[],activeProviderId:provider?'embed':null}),adaptationCurrent:revision=>revision===modelRevision,
      rebuildConfirmation:async()=>({status:'awaiting-rebuild-confirmation',confirmationId:'configure-model'}),
      adaptation:async(_s,_id,action)=>{if(action==='status'){statusEntered?.();await statusGate;return {progress:{sources:1,covered:1,vectors:1,pending:0,running:0,failed:0,unknown:0,stale:false,fingerprint:fp}}}return action==='query'?(checked=true,denseHits?Array.from({length:5},(_,i)=>({id:'0',offset:i*2100,score:1-i/100})): [{id:'0',offset:0,score:1}]):{}},
    } as any})
  const invoke=async(name,args,exec={})=>{const result=await tools.get(name).execute(args,exec);assert.deepEqual(result,JSON.parse(JSON.stringify(result)),'tool receipts must be native lossless JSON');return result}
  const researchSchema=(tools.get('rp_source_research') as any).parameters
  const entrySchema=researchSchema.properties.entry
  const appendedEntrySchema=researchSchema.properties.entries.items
  assert.deepEqual(entrySchema.properties.category.enum,['world','rule','faction','relation','event','character'])
  assert.deepEqual(entrySchema.properties.certainty.enum,['verified-original','unknown'])
  assert.deepEqual(appendedEntrySchema.properties.certainty.enum,['verified-original'])
  assert.deepEqual(entrySchema.properties.topic.enum,['identity','motive','relations','affiliation','limits','turning-point','opening'])
  assert.deepEqual(entrySchema.properties.chain.properties.actions.items.required,['summary','citations'])
  assert.deepEqual(entrySchema.properties.edges.items.required,['from','relation','to','citations'])
  assert.equal('id' in appendedEntrySchema.properties,false,'append schema rejects ids; only unknown save may edit an existing id')
  assert(appendedEntrySchema.required.includes('citations')&&appendedEntrySchema.required.includes('storyOccursAt')&&appendedEntrySchema.required.includes('characterKnowledge'),'append schema exposes complete verified fact requirements')
  assert.equal(entrySchema.properties.citations.items.properties.quote.minLength,6)
  assert.equal(entrySchema.properties.citations.items.properties.quote.maxLength,500)
  assert.match(entrySchema.description,/unknown.*id.*verified-original.*append/)
  const missingModel=await invoke('rp_source_begin',{source_path:'original.txt'})
  assert.equal(missingModel.code,'ADAPTATION_COARSE_MODEL_REQUIRED')
  assert.equal(askCount,1);assert.equal((await api.view(session as any)).research!.mode,null,'a rejected coarse choice leaves the source and choice-required plan intact')
  provider=true
  const begun=await invoke('rp_source_begin',{source_path:'original.txt'}),id=begun.sourceId
  assert.equal(askCount,2);assert.equal(begun.research.mode,'coarse');assert.equal(begun.read,0)
  session.events.push({seq:0,type:'tool/call',data:{name:'rp_source_begin',callId:'begin',turn:1}},{seq:1,type:'tool/result',data:{message:{source:{kind:'tool',callId:'begin'},content:[{type:'tool-result',toolCallId:'begin',content:[{type:'text',text:JSON.stringify(begun)}]}]}}})
  const chosenAskCount=askCount
  await invoke('rp_source_begin',{source_path:'original.txt'});assert.equal(askCount,chosenAskCount,'same chosen plan does not ask twice')
  const mapBefore=await invoke('rp_source_research',{source_id:id,action:'character-map',entity:'林舟',aliases:['阿舟']})
  assert(mapBefore.characterMap.occurrences>1&&mapBefore.characterMap.intervals.every(interval=>!('text' in interval)),'character maps expose paged coordinates and read samples, never novel text or alias facts')
  await assert.rejects(api.beforeWrite({}),/粗颗粒度研究尚未完成/)
  await assert.rejects(invoke('rp_source_finish',{source_id:id}),/缺项/)
  provider=false
  await assert.rejects(invoke('rp_source_research',{source_id:id,action:'query',mode:'hybrid',queries:['林舟']}),/必须配置.*小说语义模型/)
  provider=true
  let releaseWait!:()=>void;statusGate=new Promise(resolve=>{releaseWait=resolve})
  const waitEntered=new Promise<void>(resolve=>{statusEntered=resolve}),abort=new AbortController(),waiting=invoke('rp_source_research',{source_id:id,action:'query',mode:'hybrid'},{signal:abort.signal})
  await waitEntered;abort.abort();await assert.rejects(waiting,{name:'AbortError'});releaseWait();statusGate=undefined;statusEntered=undefined
  let releaseChanged!:()=>void;statusGate=new Promise(resolve=>{releaseChanged=resolve})
  const changedEntered=new Promise<void>(resolve=>{statusEntered=resolve}),changing=invoke('rp_source_research',{source_id:id,action:'query',mode:'hybrid'})
  await changedEntered;modelRevision++;releaseChanged();await assert.rejects(changing,/等待期间小说或模型配置已变化/);statusGate=undefined;statusEntered=undefined
  const evidence:any[]=[]
  const queried=await invoke('rp_source_research',{source_id:id,action:'query',mode:'hybrid',queries:['林舟','林舟']},{deferContext:message=>{evidence.push(message)}})
  assert.equal(queried.results.length,1,'the first tool query is one seed round')
  assert.equal(queried.round.queryCount,1)
  assert.equal(queried.researchDelivery.packetIds.length,queried.delivered.packetCount,'only actually surfaced packet text receives a delivery receipt')
  assert(queried.packets.every(packet=>typeof packet.packetId==='string'&&!('text' in packet)),'native deferred delivery keeps original text out of the spill-pruned tool receipt')
  assert(evidence.length>0&&evidence.every(message=>message.source.form==='coarse-research-evidence'&&message.source.packetIds.length),'each native evidence context has source identity and only its actually delivered packet IDs')
  assert.equal(queried.research.budget.queryBatches,1)
  const beforeRace=(await invoke('rp_source_research',{source_id:id,action:'status'})).research
  await assert.rejects(invoke('rp_source_research',{source_id:id,action:'query',mode:'hybrid'},{deferContext:()=>{stamp++}}),/交付原文期间对话或原著已变化/)
  assert.equal((await invoke('rp_source_research',{source_id:id,action:'status'})).research.frontier.queried,beforeRace.frontier.queried,'a changed selection during deferred evidence never persists receipts or marks a frontier queried')
  stamp=0
  denseHits=true
  const dense=await invoke('rp_source_research',{source_id:id,action:'query',mode:'hybrid',context_chars:4000,hits_per_query:10},{deferContext:message=>{evidence.push(message)}})
  assert(dense.packets.length>1&&dense.packets.every(packet=>packet.end-packet.start<=4000),'a dense overlapping semantic cluster is split into delivery-sized packets by the program')
  assert.equal(dense.delivered.deferredPacketCount,0,'split dense packets remain actual deliveries instead of permanent deferred locators')
  denseHits=false
  const beforeKeywordBudget=dense.research.budget.queryBatches
  const keywordSupplement=await invoke('rp_source_research',{source_id:id,action:'query',mode:'keyword',queries:['林舟']})
  assert(keywordSupplement.results.every(result=>result.mode==='keyword'),'a ready semantic index permits an explicit keyword supplement')
  assert.equal(keywordSupplement.research.budget.queryBatches,beforeKeywordBudget+1,'keyword supplementation remains a separately budgeted query batch')
  const packet=await invoke('rp_source_research',{source_id:id,action:'read',segment:0,max_chars:1000})
  assert.equal(api.load(session.id,id).state.reads.length,0,'coarse packet is not full-read certification')
  const citation={segment:0,quote:packet.text.slice(0,12)}
  const base={statement:'北城属于山盟，人物由离城行动引发后续事件。',certainty:'verified-original',citations:[citation],storyOccursAt:'开篇',readerRevealedAt:'第一章',characterKnowledge:'仅亲历者知道'}
  const state=await invoke('rp_source_research',{source_id:id,action:'status'})
  const entries=[...['world','rule','faction','relation','event'].map(category=>({...base,category,...(category==='event'?{chain:{cause:'家人遇险',preconditions:'离开北城',actions:[{summary:'守约行动',citations:[citation]}],people:'林舟',result:'家人获救',reveal:'原文开篇，亲历者知情'},edges:[{from:'林舟',relation:'守约于',to:'山盟',citations:[citation]}]}:{})})),...['identity','motive','relations','affiliation','limits','turning-point','opening'].map(topic=>({...base,category:'character',entity:'林舟',topic}))]
  const appended=await invoke('rp_source_research',{source_id:id,action:'append',expected_revision:state.research.revision,entries:entries.slice(0,8),source_packet_ids:packet.researchDelivery.packetIds})
  assert.deepEqual(appended.researchCheckpoint.packetIds,packet.researchDelivery.packetIds,'a committed verified append returns a top-level checkpoint only for explicitly confirmed packets')
  const mapAfter=await invoke('rp_source_research',{source_id:id,action:'character-map',entity:'林舟'})
  assert(mapAfter.characterMap.intervals.some(interval=>interval.acknowledgedChars>0),'the longitudinal map distinguishes committed whole-packet notes from mere locator hits')
  const appendedRest=await invoke('rp_source_research',{source_id:id,action:'append',expected_revision:appended.research.revision,entries:entries.slice(8)})
  assert.equal(appendedRest.research.revision,state.research.revision+2,'bounded atomic appends avoid parallel per-fact CAS conflicts')
  await assert.rejects(invoke('rp_source_finish',{source_id:id}),/主角纵向证据/,'one early quote labelled with every topic cannot finish a recurring protagonist')
  const trace=await invoke('rp_source_research',{source_id:id,action:'character-map',entity:'林舟'})
  const stagePackets=[]
  for(const stage of trace.characterMap.stages.filter(stage=>!stage.covered)){
    const read=stage.sample.read
    stagePackets.push(await invoke('rp_source_research',{source_id:id,action:'read',segment:read.segment,offset:read.offset,max_chars:read.maxChars}))
  }
  const afterTrace=await invoke('rp_source_research',{source_id:id,action:'status'})
  await invoke('rp_source_research',{source_id:id,action:'append',expected_revision:afterTrace.research.revision,entries:stagePackets.map((p,index)=>({...base,statement:`主角阶段 ${index+1} 的变化有对应原文。`,category:'character',entity:'林舟',topic:'turning-point',citations:[{segment:p.segment,start:p.start,quote:p.text.slice(0,12)}]})),source_packet_ids:stagePackets.flatMap(p=>p.researchDelivery.packetIds)})
  const finished=await invoke('rp_source_finish',{source_id:id})
  assert.equal(finished.status,'finished');assert.equal(finished.readingMode,'coarse');assert.equal(finished.research.coverage.ready,true)
  assert.equal(finished.read,0);assert.equal(finished.reviewed,0,'never fakes intensive notebooks')
  assert.notEqual(api.load(session.id,id).state.status,'finished','intensive state remains incomplete')
  await api.beforeWrite({});assert.equal((await api.readForRepair(session as any,'available',{source_id:id})).ok,true)
  const page=await api.view(session as any,id,0,'北城','coarse')
  assert(page.researchNotes!.total>=12);assert(page.researchNotes!.entries.every(e=>e.citations[0].quote===citation.quote&&e.citations[0].start===packet.start))
  assert.equal((await api.view(session as any,id)).notes.length,0)
  fp='2'.repeat(64)
  await assert.rejects(api.beforeWrite({}),/完成的研究记录/)
  await assert.rejects(invoke('rp_source_finish',{source_id:id}),/语义查缺补漏/)
  await invoke('rp_source_search',{source_id:id,query:'林舟',mode:'hybrid'});assert(checked)
  await invoke('rp_source_finish',{source_id:id});await api.beforeWrite({})
  let releaseStatus!:()=>void;statusGate=new Promise(resolve=>{releaseStatus=resolve})
  const entered=new Promise<void>(resolve=>{statusEntered=resolve})
  const checking=api.beforeWrite({});await entered;stamp++;releaseStatus()
  await assert.rejects(checking,/写卡检查期间对话、原著或研究计划已变化/)
  statusGate=undefined;statusEntered=undefined
  fp='3'.repeat(64);await assert.rejects(api.beforeWrite({}),/完成的研究记录/)
  provider=false
  await assert.rejects(invoke('rp_source_finish',{source_id:id}),/粗颗粒度完成必须有可用小说语义模型/)
  await invoke('rp_source_close',{mode:'authoring'})
  // A newly bound source asks; switching A→B→A during the pending human answer
  // changes the catalog stamp and cannot apply a stale choice.
  session.id='another-author';session.events=[]
  let resolveAnswer!:()=>void;answerGate=new Promise(resolve=>{resolveAnswer=resolve})
  const pending=invoke('rp_source_begin',{source_path:'original.txt'})
  for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve))
  stamp++;resolveAnswer()
  await assert.rejects(pending,/回答期间对话或原著已变化/)
  assert.equal((await api.view(session as any)).research!.mode,null)
  answerGate=undefined;selectedMode='close-reading'
  const intensive=await invoke('rp_source_begin',{source_path:'original.txt'})
  assert.equal(intensive.research.mode,'close-reading')
  const count=askCount;await invoke('rp_source_status',{source_id:id});assert.equal(askCount,count,'status cannot begin or switch research')
  for(const d of disposers)d()
  console.log('coarse research integration: mode choice, evidence gate, current model, UI views and cancellation passed')
} finally {cleanupTestDirectory(temp)}
