import type { AdaptationSource } from './card-adaptation.js'

export interface CharacterRange {start:number;end:number}
/** Coordinates only: a lexical occurrence is neither a verified identity nor a
 * read passage. The caller supplies receipts from its current research owner. */
export function characterOccurrenceMap(source:Pick<AdaptationSource,'text'|'segments'>,terms:string[],options:{cursor?:number;limit?:number;contextChars?:number;samples?:number;delivered?:CharacterRange[];acknowledged?:CharacterRange[];evidence?:CharacterRange[]}={}) {
  const bounded=(v:number,min:number,max:number,name:string)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error(`${name} 必须在 ${min}–${max} 内`);return v}
  if(!Array.isArray(terms)||!terms.length||terms.length>16||terms.some(t=>typeof t!=='string'||!t.trim()||t.length>100))throw Error('人物定位需要 1–16 个不超过 100 字符的姓名/候选别名')
  const names=[...new Set(terms.map(t=>t.trim()))],cursor=bounded(options.cursor??0,0,20000,'cursor'),limit=bounded(options.limit??20,1,50,'limit')
  const contextChars=bounded(options.contextChars??1000,256,4000,'contextChars'),samples=bounded(options.samples??10,2,30,'samples')
  const found:{start:number;end:number;term:string}[]=[],cap=20000
  let truncated=false
  for(const term of names){
    let offset=source.text.indexOf(term)
    while(offset>=0){
      if(found.length===cap){truncated=true;break}
      found.push({start:offset,end:offset+term.length,term})
      offset=source.text.indexOf(term,offset+1)
    }
    if(truncated)break
  }
  found.sort((a,b)=>a.start-b.start||a.end-b.end)
  const union=(ranges:CharacterRange[])=>{
    const result:CharacterRange[]=[]
    for(const r of ranges.filter(r=>Number.isSafeInteger(r.start)&&Number.isSafeInteger(r.end)&&r.start>=0&&r.end<=source.text.length&&r.end>r.start).sort((a,b)=>a.start-b.start)){
      const last=result.at(-1)
      if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else result.push({start:r.start,end:r.end})
    }
    return result
  }
  const delivered=union(options.delivered??[]),acknowledged=union(options.acknowledged??[])
  const covered=(range:CharacterRange,ranges:CharacterRange[])=>{
    let total=0
    for(const r of ranges){if(r.start>=range.end)break;if(r.end>range.start)total+=Math.max(0,Math.min(r.end,range.end)-Math.max(r.start,range.start))}
    return total
  }
  const segmentAt=(position:number)=>{
    let lo=0,hi=source.segments.length-1
    while(lo<=hi){const mid=(lo+hi)>>>1,seg=source.segments[mid]!;if(position<seg.start)hi=mid-1;else if(position>=seg.end)lo=mid+1;else return seg}
    return undefined
  }
  const window=(hit:CharacterRange)=>{
    let start=Math.max(0,hit.start-Math.floor((contextChars-(hit.end-hit.start))/2)),end=Math.min(source.text.length,start+contextChars)
    start=Math.max(0,end-contextChars)
    return {start,end}
  }
  const groups:{start:number;end:number;occurrences:number;terms:Set<string>}[]=[]
  for(const hit of found){const w=window(hit),last=groups.at(-1)
    if(last&&w.start<=last.end){last.end=Math.max(last.end,w.end);last.occurrences++;last.terms.add(hit.term)}
    else groups.push({...w,occurrences:1,terms:new Set([hit.term])})
  }
  const describe=(r:CharacterRange)=>({start:r.start,end:r.end,chapterStart:segmentAt(r.start)?.chapter??'',chapterEnd:segmentAt(Math.max(r.start,r.end-1))?.chapter??'',
    deliveredChars:covered(r,delivered),acknowledgedChars:covered(r,acknowledged),totalChars:r.end-r.start})
  // Samples span the whole located distribution, including its first/last
  // appearance. Dense runs are subdivided by position, not popularity score.
  const chosen=new Map<number,typeof found[number]>()
  if(found.length){
    chosen.set(found[0]!.start,found[0]!);chosen.set(found.at(-1)!.start,found.at(-1)!)
    for(let bin=0;bin<samples;bin++){
      const left=source.text.length*bin/samples,right=source.text.length*(bin+1)/samples,mid=(left+right)/2
      let best:typeof found[number]|undefined
      for(const hit of found)if(hit.start>=left&&hit.start<right&&(!best||Math.abs(hit.start-mid)<Math.abs(best.start-mid)))best=hit
      if(best)chosen.set(best.start,best)
    }
  }
  const sampleFor=(hit:typeof found[number])=>{
    const r=window(hit),seg=segmentAt(hit.start),start=seg?Math.max(seg.start,r.start):r.start
    return {...describe(r),matchedTerm:hit.term,...(seg?{read:{segment:seg.id,offset:start-seg.start,maxChars:Math.max(256,Math.min(contextChars,seg.end-start))}}:{})}
  }
  const sampleRanges=[...chosen.values()].sort((a,b)=>a.start-b.start).map(sampleFor)
  // Derive coverage from original fact citations, not tool calls or topic names.
  // Empty thirds impose no invented life stages on a briefly appearing person.
  const evidence=union(options.evidence??[]),firstAt=found[0]?.start??0,span=Math.max(1,(found.at(-1)?.end??0)-firstAt)
  const stages=Array.from({length:3},(_,id)=>{
    const hits=found.filter(hit=>Math.min(2,Math.floor((hit.start-firstAt)*3/span))===id)
    if(!hits.length)return null
    return {id,label:['较早出现','中段出现','较晚出现'][id]!,occurrences:hits.length,
      covered:hits.some(hit=>covered(window(hit),evidence)>0),sample:sampleFor(hits[Math.floor(hits.length/2)]!)}
  }).filter((stage):stage is NonNullable<typeof stage>=>stage!==null)
  const intervals=groups.slice(cursor,cursor+limit).map((r,index)=>({...describe(r),index:cursor+index,occurrences:r.occurrences,terms:[...r.terms]}))
  return {terms:names,matching:'literal-case-sensitive' as const,occurrences:found.length,intervalCount:groups.length,truncated,scannedCompletely:!truncated,
    intervals,nextCursor:cursor+intervals.length<groups.length?cursor+intervals.length:null,samples:sampleRanges,stages,
    instruction:'这是姓名/候选别名的原文分布，不是已读证明或人物身份认证。按 samples/intervals 分阶段 read，再保存目标、认知、关系、能力的变化及促因/行动/后果和来源；缺失转折继续关键词/语义查证。代词、化名、转述可能漏检，文本位置不等于事件发生时间。delivered 只表示交付，acknowledged 才表示已确认整理笔记；不得宣称已通读人物全部经历。'+(truncated?' 命中超过安全上限，分布不完整，请缩小定位词；不能据此判断后期没有出现。':'')}
}
