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
export function createRoleplayMvuAncestry(deps:{
  live(id:string):MvuLineageSession | undefined
  observe(id:string,options:{projectionMode:'none';signal?:AbortSignal}):Promise<Observation>
}) {
  const headers=new Map<string,ValidatedAncestrySession>()
  const jobs=new WeakMap<object,Promise<void>>()
  let disposed=false
  function valid(value:MvuLineageSession):value is ValidatedAncestrySession {
    return value.header?.id===value.id&&Number.isSafeInteger(value.inheritedEventCount)&&Number(value.inheritedEventCount)>=0
      &&(value.header.parentSession===undefined?value.inheritedEventCount===0:
        typeof value.header.parentSession==='string'&&value.header.isSeeded===true)
  }
  async function capture(session:MvuLineageSession,signal?:AbortSignal) {
    const chain=new Map<string,ValidatedAncestrySession>()
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
      current={id:observation.header.id,header:structuredClone(observation.header),
        inheritedEventCount:observation.inheritedEventCount}
    }
    if(disposed)throw Error('DERIVED_ANCESTRY_UNPROVEN')
    for(const [id,header] of chain)headers.set(id,Object.freeze(header))
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
  return {ready,readSession:(id:string)=>disposed?undefined:deps.live(id)??headers.get(id),
    dispose:()=>{disposed=true;headers.clear()}}
}
