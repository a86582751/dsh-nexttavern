import { createHash, randomUUID } from 'node:crypto'
import type { TaskContextSession, TaskEvent } from './tavern-task-context.js'
import { adaptationToolResult } from '../memory/memory-provenance.js'
import { readCardSource } from './tavern-card.js'

/** A delivered, checked MD is the checkpoint for research/authoring, before card import begins. */
export function retireDeliveredDraft(session:TaskContextSession,currentTurn:number) {
  if(!session.append)return 0
  const events=session.events??session.log??[],lookup=new Map(events.map(e=>[e.seq,e]))
  const calls=new Map<string,{name:string;seq:number}>(),ended=new Set<number>()
  const drafts:{start:number;end:number;turn:number;path:string;sha256:string}[]=[]
  let start:number|null=null,turn=-1
  for(const e of events){
    if(e.type==='turn/start')turn=Number(e.data?.turn)
    if(e.type==='turn/end'&&e.data?.reason?.kind==='completed')ended.add(turn)
    if(e.type==='assistant/message')for(const b of e.data?.message?.content??[])if(b.type==='tool-call'&&b.id&&b.name)calls.set(b.id,{name:b.name,seq:e.seq})
    if(e.type==='tool/call'&&typeof e.data?.callId==='string'&&!calls.has(e.data.callId))calls.set(e.data.callId,{name:String(e.data.name),seq:e.seq})
    if(e.type!=='tool/result')continue
    const call=calls.get(e.data?.message?.source?.callId??''),decoded=adaptationToolResult(e.data?.message)
    if(!call||!decoded||decoded.failed)continue
    let proof:Record<string,unknown>
    try{proof=JSON.parse(decoded.text)}catch{continue}
    if(!proof||typeof proof!=='object')continue
    if((call.name==='rp_source_begin'&&typeof proof.sourceId==='string')||(call.name==='rp_card_draft_check'&&proof.ok===true&&proof.mode==='authoring'))start??=call.seq
    if(call.name==='rp_source_close'&&proof.ok===true)start=null
    if(call.name==='rp_card_import_begin'&&proof.ok===true)start=null
    if(call.name==='rp_card_draft_check'&&start!==null&&proof.ok===true&&proof.schemaVersion===1
      &&typeof proof.sourcePath==='string'&&/^[a-f0-9]{64}$/.test(String(proof.sha256))
      &&(proof.statusRendering as {renderable?:boolean}|undefined)?.renderable===true&&Array.isArray(proof.errors)&&!proof.errors.length){
      drafts.push({start,end:call.seq-1,turn,path:proof.sourcePath,sha256:String(proof.sha256)})
    }
  }
  let retired=0
  for(const draft of drafts.reverse()){
    if(draft.turn===currentTurn||!ended.has(draft.turn))continue
    const nodes=[...(session.surface?.nodes??[])],groups:number[][]=[];let group:number[]=[]
    const flush=()=>{if(group.length)groups.push(group);group=[]}
    for(const seq of nodes){
      const e=lookup.get(seq),source=e?.data?.source
      const owned=e&&seq>=draft.start&&seq<=draft.end&&(e.type==='assistant/message'||e.type==='tool/result'
        ||e.type==='user/message'&&source?.kind==='plugin'&&['roleplay-tasks','roleplay-context'].includes(source.plugin??''))
      if(owned)group.push(seq);else flush()
    }
    flush();if(!groups.length)continue
    try{const source=readCardSource(session.header?.cwd??'',draft.path)
      if(createHash('sha256').update(source.bytes.toString('utf8')).digest('hex')!==draft.sha256)continue
    }catch{continue}
    for(const selected of groups){const first=selected[0]!,last=selected.at(-1)!
      session.append('user/message',{id:randomUUID(),role:'user',source:{schemaVersion:1,kind:'plugin',plugin:'roleplay-tasks',form:'management-receipt',jobKind:'card-authoring',sessionId:session.id,sourceTurn:draft.turn,sourcePath:draft.path,sha256:draft.sha256,sourceSha256:createHash('sha256').update(JSON.stringify(selected.map(seq=>lookup.get(seq)))).digest('hex')},
        content:[{type:'text',text:`写卡阶段已交付并通过草稿检查：${draft.path}（SHA-256 ${draft.sha256}）。玩家确认的要求与最终交付消息保留；研究/写卡过程在历史 seq ${first}–${last} 可追溯。导入请直接读取该文件；原著与阅读笔记仍可按需查询，文件通过检查不代表已激活。`}]},
        {surfaceOp:{op:'replace',startSeq:first,endSeq:last},sourceEventSeqs:selected});retired+=selected.length
    }
  }
  return retired
}

/** A successfully activated card closes the explicit research workflow. Unlike
 * in-progress read retirement, this can release failed and mixed tool attempts:
 * the authoritative card has committed and the entire raw audit remains. */
export function retireFinishedAdaptation(session:TaskContextSession,currentTurn:number,activeImport?:{importId:string;normalizedSha256:string}) {
  if(!session.append)return 0
  const events=session.events??session.log??[],lookup=new Map(events.map(e=>[e.seq,e]))
  const calls=new Map<string,{name:string;seq:number}>(),ended=new Set<number>()
  const spans:{start:number;end:number;turn:number;sourceId:string;importId:string;normalizedSha256:string}[]=[]
  let turn=-1,researchStart:number|null=null,sourceId='',finished=false,importId:string|null=null,importHash:string|null=null
  for(const event of events){
    if(event.type==='turn/start')turn=Number(event.data?.turn)
    if(event.type==='turn/end'){if(event.data?.reason?.kind==='completed')ended.add(turn);continue}
    if(event.type==='assistant/message')for(const block of event.data?.message?.content??[]){
      if(block.type==='tool-call'&&block.id&&block.name)calls.set(block.id,{name:block.name,seq:event.seq})
    }
    if(event.type==='tool/call'){
      const id=event.data?.callId??event.data?.id
      if(typeof id==='string'&&!calls.has(id))calls.set(id,{name:String(event.data?.name),seq:event.seq})
    }
    if(event.type!=='tool/result')continue
    const id=event.data?.message?.source?.callId,call=id?calls.get(id):undefined
    if(!call||!['rp_source_begin','rp_source_library','rp_source_finish','rp_source_close','rp_card_import_begin','rp_card_import_finalize'].includes(call.name))continue
    const decoded=adaptationToolResult(event.data?.message)
    if(!decoded||decoded.failed)continue
    let proof:Record<string,unknown>|undefined
    try{const value:unknown=JSON.parse(decoded.text);if(value&&typeof value==='object')proof=value as Record<string,unknown>}catch{}
    if(!proof)continue
    if(['rp_source_begin','rp_source_library'].includes(call.name)&&typeof proof.sourceId==='string'&&(call.name==='rp_source_begin'||proof.attached===true)){
      researchStart=researchStart??call.seq;sourceId=proof.sourceId;finished=false;importId=null;importHash=null;continue
    }
    const coarse=proof.research as {schemaVersion?:number;status?:string;mode?:string;coverage?:{ready?:boolean}}|undefined
    if(call.name==='rp_source_finish'&&proof.ok===true&&proof.sourceId===sourceId&&proof.status==='finished'
      &&Number.isSafeInteger(proof.segments)&&Number(proof.segments)>0
      &&((proof.reviewed===proof.segments&&proof.read===proof.segments)
        ||(proof.readingMode==='coarse'&&[1,2].includes(Number(coarse?.schemaVersion))&&coarse?.mode==='coarse'&&coarse.status==='finished'&&coarse.coverage?.ready===true))){finished=true;continue}
    if(call.name==='rp_source_close'&&proof.ok===true&&['authoring','roleplay'].includes(String(proof.mode))){researchStart=null;finished=false;importId=null;importHash=null;continue}
    if(call.name==='rp_card_import_begin'&&proof.ok===true){
      importId=finished&&typeof proof.importId==='string'?proof.importId:null
      importHash=importId&&/^[a-f0-9]{64}$/.test(String(proof.normalizedSha256))?String(proof.normalizedSha256):null
      continue
    }
    if(call.name==='rp_card_import_finalize'&&researchStart!==null&&finished&&importId&&importHash&&proof.importId===importId
      &&proof.normalizedSha256===importHash&&proof.ok===true&&proof.coverage===1
      &&typeof proof.activatedAt==='number'&&Number.isFinite(proof.activatedAt)&&proof.activatedAt>0
      &&typeof proof.importId==='string'&&/^[a-f0-9]{64}$/.test(String(proof.normalizedSha256))){
      spans.push({start:researchStart,sourceId,end:event.seq,turn,importId:proof.importId,normalizedSha256:importHash});researchStart=null
    }
  }
  let retired=0
  for(const span of spans){
    if(span.turn===currentTurn){
      // The native pre-step supplies the active table pointer only after the
      // import transaction committed. Research no longer serves the opening.
      if(activeImport?.importId!==span.importId||activeImport.normalizedSha256!==span.normalizedSha256||!session.surface?.nodes?.includes(span.end))continue
    }else if(!ended.has(span.turn))continue
    // Work only on the visible branch projection. Separate ranges around
    // player input or unrelated nodes rather than swallowing their contents.
    const nodes=[...(session.surface?.nodes??[])],groups:number[][]=[];let group:number[]=[]
    const flush=()=>{if(group.length)groups.push(group);group=[]}
    for(const seq of nodes){
      const event=lookup.get(seq),source=event?.data?.source
      const owned=event&&seq>=span.start&&seq<=span.end&&(event.type==='assistant/message'||event.type==='tool/result'
        ||event.type==='user/message'&&source?.kind==='plugin'&&['roleplay-tasks','roleplay-context'].includes(source.plugin??''))
      if(owned)group.push(seq);else flush()
    }
    flush()
    for(const selected of groups){
      const start=selected[0]!,end=selected.at(-1)!
      session.append('user/message',{id:randomUUID(),role:'user',source:{schemaVersion:1,kind:'plugin',plugin:'roleplay-tasks',form:'management-receipt',
        sessionId:session.id,jobKind:'card-adaptation',sourceId:span.sourceId,importId:span.importId,start,end,
        sourceSha256:createHash('sha256').update(JSON.stringify(selected.map(seq=>lookup.get(seq)))).digest('hex')},
        content:[{type:'text',text:`原著研究已结束，角色卡已完整激活，当前设定由酒馆栏目提供。研究材料与旧工具尝试保留于历史 seq ${start}–${end}；需要核对原著时按 sourceId ${span.sourceId} 查询阅读笔记或原文。研究过程不是扮演正史。`}]},
        {surfaceOp:{op:'replace',startSeq:start,endSeq:end},sourceEventSeqs:selected})
      retired+=selected.length
    }
  }
  return retired
}

/** Retire only complete, pure research call/result groups older than a durable note checkpoint.
 * Mixed native tool groups, user input, story and pending results are never consumed.
 * Failed reads retire only after a later durable checkpoint for the same source. */
export interface AdaptationProgress {sourceId:string;segments:number;read:number;reviewed:number;nextSegment:number|null;indexPolicy:string;status:string;requiresReregister?:boolean}
/** A coarse batch is released only after all of its actual evidence packets
 * were explicitly acknowledged by a later successful durable note write.
 * The visible native call/result chain supplies provenance, never model prose. */
export function retireCoarseResearchReads(session:TaskContextSession,owner:string) {
  if(!session.append)return 0
  const events=session.events??session.log??[],bySeq=new Map(events.map(e=>[e.seq,e])),nodes=[...(session.surface?.nodes??[])]
  type Envelope={schemaVersion:1;owner:string;sourceId:string;textSha256:string;generation:string;packetIds:string[];revision?:number}
  const envelope=(value:unknown):Envelope|null=>{
    if(!value||typeof value!=='object')return null
    const v=value as Envelope
    return v.schemaVersion===1&&v.owner===owner&&typeof v.sourceId==='string'&&!!v.sourceId
      &&/^[a-f0-9]{64}$/.test(v.textSha256)&&typeof v.generation==='string'&&!!v.generation
      &&Array.isArray(v.packetIds)&&v.packetIds.length>0&&v.packetIds.every(p=>typeof p==='string'&&p.length>0)
      ?v:null
  }
  const identity=(v:Envelope)=>JSON.stringify([v.owner,v.sourceId,v.textSha256,v.generation])
  const calls=new Map<string,{action:string;sourceId:string}>(),confirmed=new Map<string,Map<string,number>>()
  const deliveries=new Map<number,Envelope>()
  for(const seq of nodes){
    const e=bySeq.get(seq);if(!e)continue
    if(e.type==='assistant/message')for(const b of e.data?.message?.content??[]){
      if(b.type!=='tool-call'||b.name!=='rp_source_research'||!b.id)continue
      try{const args=typeof b.arguments==='string'?JSON.parse(b.arguments):b.arguments
        if(typeof args?.action==='string'&&typeof args?.source_id==='string')calls.set(b.id,{action:args.action,sourceId:args.source_id})
      }catch{}
    }
    if(e.type!=='tool/result')continue
    const call=calls.get(e.data?.message?.source?.callId??''),decoded=adaptationToolResult(e.data?.message)
    if(!call||!decoded||decoded.failed)continue
    let proof:Record<string,unknown>
    try{proof=JSON.parse(decoded.text)}catch{continue}
    if(!proof||typeof proof!=='object'||proof.sourceId!==call.sourceId)continue
    if(['query','read'].includes(call.action)){
      const v=envelope(proof.researchDelivery)
      if(v&&v.sourceId===call.sourceId)deliveries.set(seq,v)
    }
    if(['save','append'].includes(call.action)){
      const v=envelope(proof.researchCheckpoint)
      if(!v||v.sourceId!==call.sourceId||!Number.isSafeInteger(v.revision)||Number(v.revision)<0)continue
      const key=identity(v),packets=confirmed.get(key)??new Map<string,number>()
      for(const id of v.packetIds)packets.set(id,Math.max(seq,packets.get(id)??-1))
      confirmed.set(key,packets)
    }
  }
  let retired=0
  for(let i=0;i<nodes.length;i++){
    const e=bySeq.get(nodes[i]!)
    if(e?.type!=='assistant/message')continue
    const blocks=(e.data?.message?.content??[]).filter(b=>b.type!=='reasoning'&&!(b.type==='text'&&!String(b.text??'').trim()))
    if(!blocks.length||blocks.some(b=>b.type!=='tool-call'||b.name!=='rp_source_research'||!b.id||!['query','read'].includes(calls.get(b.id)?.action??'')))continue
    const pending=new Set(blocks.map(b=>b.id!));if(pending.size!==blocks.length)continue
    const selected=[e.seq];let j=i+1
    for(;j<nodes.length&&pending.size;j++){
      const result=bySeq.get(nodes[j]!),id=result?.data?.message?.source?.callId,v=result?deliveries.get(result.seq):null
      if(result?.type!=='tool/result'||!id||!pending.has(id)||!v)break
      const saved=confirmed.get(identity(v))
      if(!saved||v.packetIds.some(packet=>(saved.get(packet)??-1)<=result.seq))break
      selected.push(result.seq);pending.delete(id)
    }
    if(pending.size)continue
    const start=selected[0]!,end=selected.at(-1)!
    session.append('user/message',{id:randomUUID(),role:'user',source:{schemaVersion:1,kind:'plugin',plugin:'roleplay-tasks',form:'adaptation-receipt',owner:session.id,researchOwner:owner,
      sourceSha256:createHash('sha256').update(JSON.stringify(selected.map(seq=>bySeq.get(seq)))).digest('hex')},
      content:[{type:'text',text:`这批粗颗粒度原文已整理到阅读笔记，长工具结果移出请求，原始证据保留于历史 seq ${start}–${end}。用 rp_source_research(entries) 查笔记；确需重新核实时才定向 read。继续下一批关系检索，勿重复注入已读原文；原著事实不是当前世界线剧情。`}]},
      {surfaceOp:{op:'replace',startSeq:start,endSeq:end},sourceEventSeqs:selected})
    retired+=selected.length;i=j-1
  }
  // Large batches use the native deferred-context channel so generic tool
  // result pruning cannot silently discard original evidence. Its provenance
  // must still trace to a successful visible tool delivery before this node.
  for(const seq of nodes){
    const e=bySeq.get(seq),source=e?.data?.source
    if(e?.type!=='user/message'||source?.kind!=='plugin'||source.plugin!=='roleplay-tasks'||source.form!=='coarse-research-evidence')continue
    const v=envelope(source);if(!v)continue
    const saved=confirmed.get(identity(v))
    if(!saved||v.packetIds.some(id=>(saved.get(id)??-1)<=seq))continue
    const published=new Set([...deliveries].filter(([at,d])=>at<seq&&identity(d)===identity(v)).flatMap(([,d])=>d.packetIds))
    if(v.packetIds.some(id=>!published.has(id)))continue
    session.append('user/message',{id:randomUUID(),role:'user',source:{schemaVersion:1,kind:'plugin',plugin:'roleplay-tasks',form:'adaptation-receipt',owner:session.id,researchOwner:owner,
      sourceSha256:createHash('sha256').update(JSON.stringify(e)).digest('hex')},
      content:[{type:'text',text:`这批原文已确认整理到粗颗粒度阅读笔记。证据原文保留于历史 seq ${seq}；需要细节时按 sourceId ${v.sourceId} 查询 entries 或定向 read，不把原著当作当前剧情。`}]},
      {surfaceOp:{op:'replace',startSeq:seq,endSeq:seq},sourceEventSeqs:[seq]})
    retired++
  }
  return retired
}

export function retireAdaptationReads(session:TaskContextSession,notes:{sourceId:string;segment:number;seq:number;progress?:AdaptationProgress}[]) {
  if(!session.append||!notes.length)return 0
  const events=session.events??session.log??[],lookup=new Map(events.map(e=>[e.seq,e])),nodes=[...(session.surface?.nodes??[])]
  const researchCalls=new Set<string>()
  for(const e of events)if(e.type==='assistant/message')for(const block of e.data?.message?.content??[])if(block.type==='tool-call'&&/^rp_source_/.test(block.name??'')&&block.id)researchCalls.add(block.id)
  const successful=(e:TaskEvent)=>{const result=adaptationToolResult(e.data?.message);return result!==null&&!result.failed}
  const checkpoint=Math.max(-1,...notes.map(n=>n.seq),...events.filter(e=>e.type==='tool/result'&&researchCalls.has(e.data?.message?.source?.callId??'')&&successful(e)).map(e=>e.seq))
  const progress=[...new Map(notes.flatMap(n=>n.progress?[[n.sourceId,n.progress] as const]:[])).values()]
  const resume=progress.length?`程序核对的当前阅读进度：${JSON.stringify(progress)}。按当前改编 sourceId 选择进度；requiresReregister=true 的旧资料须先用原文件 begin 重新登记，不能沿用其已读标记。其他资料的 nextSegment 是下一批需要读取并保存笔记的编号。indexPolicy=running 仅表示已请求后台索引，不代表编码完成；不要重复提交 index 或轮询等待，先继续 read/note。读完后、需要语义查询时再检查一次索引进度。`:'按已保存笔记继续当前研究任务；索引在后台运行时不要反复提交或轮询等待。'
  let retired=0
  for(let i=0;i<nodes.length;i++){
    const event=lookup.get(nodes[i]!)
    if(!event||event.seq>=checkpoint||event.type!=='assistant/message')continue
    // Native providers may attach hidden reasoning and an empty trailing text block to pure calls.
    // These are not story content; preserve them in append-only history while retiring the group.
    const blocks=(event.data?.message?.content??[]).filter(b=>b.type!=='reasoning'&&!(b.type==='text'&&!String(b.text??'').trim()))
    if(!blocks.length||blocks.some(b=>b.type!=='tool-call'||!/^rp_source_(read|search|notes|note|status|index)$/.test(b.name??'')||!b.id))continue
    // Status/index acknowledgements can use the latest progress receipt, but retrieved
    // facts must survive until a subsequent durable note for that source saves them.
    // A pre-existing note must not erase an explicit reread during later fact checking.
    let groupCheckpoint=checkpoint
    for(const block of blocks){
      if(!/^rp_source_(read|search|notes)$/.test(block.name??''))continue
      try{
        const args=(typeof block.arguments==='string'?JSON.parse(block.arguments):block.arguments) as {source_id?:string;segment?:number}
        const saved=notes.filter(n=>n.sourceId===args?.source_id&&(block.name!=='rp_source_read'||n.segment===args?.segment))
        groupCheckpoint=Math.min(groupCheckpoint,Math.max(-1,...saved.map(n=>n.seq)))
      }catch{groupCheckpoint=-1}
    }
    if(event.seq>=groupCheckpoint)continue
    const pending=new Set(blocks.map(b=>b.id!)),selected=[event.seq]
    let j=i+1
    for(;j<nodes.length&&pending.size;j++){
      const result=lookup.get(nodes[j]!),message=result?.data?.message,callId=message?.source?.callId
      if(!result||result.seq>=groupCheckpoint||result.type!=='tool/result'||!callId||!pending.has(callId))break
      if(!successful(result)){
        const block=blocks.find(b=>b.id===callId),decoded=adaptationToolResult(message)
        if(!decoded?.failed||!/^rp_source_(read|search|notes)$/.test(block?.name??''))break
        // The group checkpoint above requires the same source (and segment
        // for reads). An unrelated successful tool cannot settle this failure.
      }
      pending.delete(callId);selected.push(result.seq)
    }
    if(pending.size)continue
    const start=selected[0]!,end=selected.at(-1)!
    session.append('user/message',{id:randomUUID(),role:'user',source:{schemaVersion:1,kind:'plugin',plugin:'roleplay-tasks',form:'adaptation-receipt',owner:session.id,checkpointSeq:groupCheckpoint,
      sourceSha256:createHash('sha256').update(JSON.stringify(selected.map(seq=>lookup.get(seq)))).digest('hex')},
      content:[{type:'text',text:`改编研究资料已保存笔记。原始工具记录保留于 seq ${start}–${end}；需要细节才调用 rp_source_notes / rp_source_read。${resume}原著与改编设想均不是已发生的扮演剧情。`}]},
      {surfaceOp:{op:'replace',startSeq:start,endSeq:end},sourceEventSeqs:selected})
    retired+=selected.length;i=j-1
  }
  // Keep adjacent receipts bounded too; their nested sourceEventSeqs retain the full append-only audit chain.
  const current=session.events??session.log??[],bySeq=new Map(current.map(e=>[e.seq,e])),visible=[...(session.surface?.nodes??[])]
  for(let i=0;i<visible.length;i++){
    const group:number[]=[]
    while(i<visible.length){const e=bySeq.get(visible[i]!),source=e?.data?.source
      if(e?.type!=='user/message'||source?.form!=='adaptation-receipt'||source.owner!==session.id)break
      group.push(e.seq);i++
    }
    if(group.length<2)continue
    const start=group[0]!,end=group.at(-1)!
    session.append('user/message',{id:randomUUID(),role:'user',source:{schemaVersion:1,kind:'plugin',plugin:'roleplay-tasks',form:'adaptation-receipt',owner:session.id,checkpointSeq:checkpoint,
      sourceSha256:createHash('sha256').update(JSON.stringify(group.map(seq=>bySeq.get(seq)))).digest('hex')},
      content:[{type:'text',text:`先前小说阅读已保存独立研究笔记，原始调用和回执均保留在追加历史中。${resume}需要细节才用 rp_source_notes 或 rp_source_read/search；这些资料不是扮演正史。`}]},
      {surfaceOp:{op:'replace',startSeq:start,endSeq:end},sourceEventSeqs:group})
  }
  return retired
}
