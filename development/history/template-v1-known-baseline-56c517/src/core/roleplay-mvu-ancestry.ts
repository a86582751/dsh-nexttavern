/** Read-only Native ancestry. Header and inheritance facts come from exact
 * Session observations, never a domain descriptor or an activated ancestor Agent. */
import type {MvuLineageSession} from './roleplay-mvu-lineage.js'

interface Observation extends Disposable {
  header: {id:string;parentSession?:unknown;isSeeded?:unknown}
  inheritedEventCount:number
  events:readonly {seq:number;type:string}[]
}
interface ValidatedAncestrySession extends MvuLineageSession {
  header:{id:string;parentSession?:unknown;isSeeded?:unknown}
  inheritedEventCount:number
}
export interface MvuRetainedNativeObservationV1 extends ValidatedAncestrySession {
  snapshotEvents():readonly {readonly seq:number;readonly type:string;readonly data?:unknown}[]
}
/** A real retained carrier attribution, not proof of a status writer or ACK. */
export interface MvuRetainedSourceOwnerFactsV1 {
  readonly schemaVersion:1
  readonly encoding:'native-retained-source-owner-association-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceOwnerSessionId:string
  readonly sourceSeqs:readonly number[]
  readonly edges:readonly {readonly childSessionId:string;readonly parentSessionId:string;
    readonly inheritedEventCount:number;readonly prefixSha256:string}[]
  assertCurrent():void
}
interface CapturedAncestryV1 {
  readonly session:MvuLineageSession
  readonly headerSha256:string
  readonly inheritedEventCount:number
  readonly inheritedPrefixSha256:string
  readonly edges:MvuRetainedSourceOwnerFactsV1['edges']
}
export function createRoleplayMvuAncestry(deps:{
  live(id:string):MvuLineageSession | undefined
  observe(id:string,options:{projectionMode:'none';signal?:AbortSignal}):Promise<Observation>
  /** Raw events from the actual live Session. Kept separately from projected
   * story bodies and supplied only by Core's installed Native format owner. */
  events?(session:MvuLineageSession):readonly {readonly seq:number;readonly type:string;readonly data?:unknown}[]
  nativePrefixSha256?(events:readonly unknown[]):string
}) {
  const headers=new Map<string,ValidatedAncestrySession>()
  const retained=new Map<string,MvuRetainedNativeObservationV1>()
  const jobs=new WeakMap<object,Promise<void>>()
  let captures=new WeakMap<object,CapturedAncestryV1>()
  const actualLookup=deps.live,actualEvents=deps.events,actualHash=deps.nativePrefixSha256
  let disposed=false
  function valid(value:MvuLineageSession):value is ValidatedAncestrySession {
    return value.header?.id===value.id&&Number.isSafeInteger(value.inheritedEventCount)&&Number(value.inheritedEventCount)>=0
      &&(value.header.parentSession===undefined?value.inheritedEventCount===0:
        typeof value.header.parentSession==='string'&&value.header.isSeeded===true)
  }
  async function capture(session:MvuLineageSession,signal?:AbortSignal) {
    const chain=new Map<string,ValidatedAncestrySession>()
    const observations=new Map<string,MvuRetainedNativeObservationV1>()
    const edges:MvuRetainedSourceOwnerFactsV1['edges'][number][]=[]
    const capturedId=session.id,capturedBirth=session.inheritedEventCount,
      capturedHeaderSha256=actualHash?.([session.header])
    const original=deps.events?.(session)
    if(original&&(original.length>131_072||original.some((event,index)=>event.seq!==index)
      ||Buffer.byteLength(JSON.stringify(original),'utf8')>67_108_864))throw Error('DERIVED_ANCESTRY_BUDGET')
    // Shared bytes are retained once. When a descendant cut lies inside its
    // parent's inherited seed, that parent's own birth needs a longer prefix
    // from the real observation, never invented from the short descendant.
    const pinned=original&&deps.nativePrefixSha256?structuredClone(original):undefined
    const freeze=(value:unknown):void=>{if(value&&typeof value==='object') {
      for(const item of Object.values(value))freeze(item);Object.freeze(value)
    }}
    if(pinned) {
      freeze(pinned)
    }
    let comparison=pinned,totalEvents=pinned?.length??0,
      totalBytes=pinned?Buffer.byteLength(JSON.stringify(pinned),'utf8'):0
    let current=session
    while(true) {
      signal?.throwIfAborted()
      if(disposed||chain.size>=32||chain.has(current.id)||!valid(current))throw Error('DERIVED_ANCESTRY_UNPROVEN')
      chain.set(current.id,{id:current.id,header:Object.freeze(structuredClone(current.header)),
        inheritedEventCount:current.inheritedEventCount})
      const parent=current.header.parentSession
      if(parent===undefined)break
      // A cold observation owns only a pinned read. It must never resolve an
      // Agent or reuse a proof's claimed seed boundary as a native fact.
      using observation=await deps.observe(parent as string,{projectionMode:'none',signal})
      if(observation.header.id!==parent||observation.events.length<current.inheritedEventCount
        ||!Number.isSafeInteger(observation.inheritedEventCount)
        ||observation.inheritedEventCount<0||observation.inheritedEventCount>observation.events.length
        ||observation.events.some((event,index)=>event.seq!==index))throw Error('DERIVED_ANCESTRY_UNPROVEN')
      if(pinned) {
        const cut=current.inheritedEventCount
        if(!comparison||cut>comparison.length||deps.nativePrefixSha256!(observation.events.slice(0,cut))
          !==deps.nativePrefixSha256!(comparison.slice(0,cut)))throw Error('DERIVED_ANCESTRY_PREFIX_CHANGED')
        edges.push(Object.freeze({childSessionId:current.id,parentSessionId:parent as string,
          inheritedEventCount:cut,prefixSha256:deps.nativePrefixSha256!(comparison.slice(0,cut))}))
        const length=Math.max(cut,observation.inheritedEventCount),rawTail=observation.events.slice(cut,length)
        totalEvents+=rawTail.length
        totalBytes+=Buffer.byteLength(JSON.stringify(rawTail),'utf8')
        if(length>131_072||totalEvents>131_072||totalBytes>67_108_864)throw Error('DERIVED_ANCESTRY_BUDGET')
        const tail=structuredClone(rawTail)
        freeze(tail)
        const events=Object.freeze([...comparison.slice(0,cut),...tail]),header=Object.freeze(structuredClone(observation.header))
        observations.set(parent as string,Object.freeze({id:observation.header.id,header,
          inheritedEventCount:observation.inheritedEventCount,snapshotEvents:()=>events}))
        comparison=events
      }
      current={id:observation.header.id,header:structuredClone(observation.header),
        inheritedEventCount:observation.inheritedEventCount}
    }
    if(disposed)throw Error('DERIVED_ANCESTRY_UNPROVEN')
    if(pinned&&deps.nativePrefixSha256!(deps.events!(session).slice(0,pinned.length))
      !==deps.nativePrefixSha256!(pinned))throw Error('DERIVED_ANCESTRY_PREFIX_CHANGED')
    for(const [id,header] of chain)headers.set(id,Object.freeze(header))
    for(const [id,observation] of observations) {
      const previous=retained.get(id)
      if(!previous||previous.snapshotEvents().length<=observation.snapshotEvents().length)retained.set(id,observation)
    }
    if(pinned&&actualHash&&typeof capturedHeaderSha256==='string'&&valid(session)
      &&session.id===capturedId&&session.inheritedEventCount===capturedBirth
      &&actualHash([session.header])===capturedHeaderSha256)captures.set(session,Object.freeze({session,
        headerSha256:capturedHeaderSha256,inheritedEventCount:session.inheritedEventCount,
        inheritedPrefixSha256:actualHash(pinned.slice(0,session.inheritedEventCount)),edges:Object.freeze(edges)}))
  }
  async function ready(session:MvuLineageSession,signal?:AbortSignal) {
    if(disposed)throw Error('DERIVED_ANCESTRY_UNPROVEN')
    let job=jobs.get(session)
    if(!job) {
      job=capture(session,signal)
      jobs.set(session,job)
      job.catch(()=>{if(jobs.get(session)===job)jobs.delete(session)})
    }
    await job
    if(disposed)throw Error('DERIVED_ANCESTRY_UNPROVEN')
    signal?.throwIfAborted()
  }
  function retainedSourceOwnerCatalog(session:MvuLineageSession,sourceSeqs:readonly number[])
    :readonly MvuRetainedSourceOwnerFactsV1[] {
    const saved=captures.get(session),sid=session.id
    if(!saved||!actualHash||!actualEvents||sourceSeqs.length!==2
      ||sourceSeqs.some(seq=>!Number.isSafeInteger(seq)||seq<0||Object.is(seq,-0)))return Object.freeze([])
    const selected:MvuRetainedSourceOwnerFactsV1['edges'][number][]=[],seqs=Object.freeze([...sourceSeqs])
    const candidates:{ownerId:string;edges:MvuRetainedSourceOwnerFactsV1['edges']}[]=[]
    let childId=sid
    for(const edge of saved.edges) {
      if(edge.childSessionId!==childId)throw Error('DERIVED_ANCESTRY_OWNER_CHANGED')
      if(seqs.some(seq=>seq>=edge.inheritedEventCount))break
      selected.push(edge)
      childId=edge.parentSessionId
      candidates.push({ownerId:childId,edges:Object.freeze([...selected])})
    }
    const assertCurrent=()=>{
      if(disposed||deps.live!==actualLookup||deps.events!==actualEvents||deps.nativePrefixSha256!==actualHash
        ||actualLookup(sid)!==session||captures.get(session)!==saved||session.id!==sid||!valid(session)
        ||session.inheritedEventCount!==saved.inheritedEventCount||actualHash([session.header])!==saved.headerSha256) {
        throw Error('DERIVED_ANCESTRY_OWNER_CHANGED')
      }
      const events=actualEvents(session)
      if(events.length<saved.inheritedEventCount||events.slice(0,saved.inheritedEventCount).some((event,index)=>event.seq!==index)
        ||actualHash(events.slice(0,saved.inheritedEventCount))!==saved.inheritedPrefixSha256) {
        throw Error('DERIVED_ANCESTRY_PREFIX_CHANGED')
      }
    }
    assertCurrent()
    return Object.freeze(candidates.map(candidate=>Object.freeze({schemaVersion:1 as const,
      encoding:'native-retained-source-owner-association-v1' as const,authority:'consumer-data-only' as const,
      sessionId:sid,sourceOwnerSessionId:candidate.ownerId,sourceSeqs:seqs,edges:candidate.edges,assertCurrent})))
  }
  function retainedSourceOwnerFacts(session:MvuLineageSession,ownerId:string,sourceSeqs:readonly number[]) {
    return retainedSourceOwnerCatalog(session,sourceSeqs).find(fact=>fact.sourceOwnerSessionId===ownerId)
  }
  return {ready,retainedSourceOwnerFacts,retainedSourceOwnerCatalog,
    readSession:(id:string)=>disposed?undefined:deps.live(id)??headers.get(id),
    readNativeObservation:(id:string):MvuRetainedNativeObservationV1|undefined=>{
      if(disposed)return undefined
      const live=deps.live(id)
      if(live&&valid(live)&&deps.events)return {id:live.id,header:live.header,
        inheritedEventCount:live.inheritedEventCount,snapshotEvents:()=>deps.events!(live)}
      return retained.get(id)
    },
    dispose:()=>{disposed=true;headers.clear();retained.clear();captures=new WeakMap()}}
}
