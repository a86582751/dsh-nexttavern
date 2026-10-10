/** Process-local proof of a bounded immutable JSON clone. These private tags
 * and validator-local successes contain no Source, Native or owner authority. */
import {cloneSchemaDescriptorData,cloneSchemaDescriptorEnvelopeV4} from './tavern-mvu-schema-data.js'

const ownedImmutableClones=new WeakSet<object>()
export function freezeImmutableDescriptorData<T>(input:T,maxBytes:number,
  bounds?:{nodes:number;depth:number}):T {
  // Always traverse and charge the whole new envelope, including repeated
  // tagged child references. A prior clone's budget cannot pay for a new parent.
  const value=cloneSchemaDescriptorData(input,maxBytes,bounds)
  return freezeOwnedClone(value)
}

/** Full v4 author material belongs to the DATA owner. Non-material descriptor
 * fields keep the caller's existing byte, node and depth budget. */
export function freezeImmutableSchemaDescriptorDataV4<T>(input:T,maxBytes:number,
  bounds?:{nodes:number;depth:number}):T {
  const value=cloneSchemaDescriptorEnvelopeV4(input,maxBytes,bounds)
  return freezeOwnedClone(value,true)
}

function freezeOwnedClone<T>(value:T,sourceMaterials=false):T {
  const objects:object[]=[]
  function freeze(data:unknown):void {
    if(data&&typeof data==='object') {
      // This private clone output contains only fresh metadata and DATA-owner
      // deeply frozen material. External Object.freeze never reaches this path
      // without first being detached by the selected bounded clone.
      if(sourceMaterials&&Object.isFrozen(data))return
      for(const child of Object.values(data))freeze(child)
      Object.freeze(data)
      objects.push(data)
    }
  }
  freeze(value)
  // Tag only after clone, aggregate budgets and the entire deep freeze finish.
  // Neither external Object.freeze nor a partially completed tree can mint it.
  for(const object of objects)ownedImmutableClones.add(object)
  return value
}

/** One instance belongs to one concrete pure validator. A generic clone tag is
 * eligibility only: full validation must succeed before that instance remembers
 * any input. The returned function exposes no cache setter, registry or keys. */
export function createImmutableDescriptorValidator<T extends object>(
  validate:(input:T)=>T):(input:T)=>T {
  const successes=new WeakMap<object,T>()
  return (input:T):T=>{
    const object=input!==null&&typeof input==='object'?input:undefined
    if(object&&ownedImmutableClones.has(object)) {
      const existing=successes.get(object)
      if(existing!==undefined)return existing
    }
    // Failure is never cached. Each concrete validator still performs its own
    // smaller subtree budgets and every shape/hash/correlation on this cold path.
    const result=validate(input)
    if(result!==null&&typeof result==='object'&&ownedImmutableClones.has(result)) {
      if(object&&ownedImmutableClones.has(object))successes.set(object,result)
      successes.set(result,result)
    }
    return result
  }
}
