/** Factory-private row DATA and synchronous observations of static opening rows.
 * This module owns short-lived data/resource state, never current permissions. */
import {types} from 'node:util'
import {recordSha256} from './roleplay-data.js'

type Table='branch'|'status'
interface Address {readonly table:Table;readonly key:string;readonly sha256:string|null}
/** Inert data minted only by a strict probe, not namespace or Native currency. */
export interface ProgramOpeningStaticNamespaceRowV1 {
  readonly value:Readonly<Record<string,unknown>>
  readonly sha256:string
  readonly cloneBudget:Readonly<{bytes:number;nodes:number;maxDepth:number}>
}
export interface ProgramOpeningRowFactsSeedV1 {
  readonly sessionId:string
  /** Addresses and expected bytes come only from the original factory capture. */
  readonly rows:readonly Address[]
  /** Actual Session/factory/table bindings. No readiness predicate is retained. */
  assertBindings():void
}
interface Observation extends Address {
  readonly exists:boolean
  readonly value:unknown
  readonly cloneBudget?:Readonly<{bytes:number;nodes:number;maxDepth:number}>
  readonly namespaceRow?:ProgramOpeningStaticNamespaceRowV1
  readonly comparisonPlan?:StrictComparisonPlan
}
type StrictComparisonScalar=null|string|boolean|number
type StrictComparisonPlan=
  |StrictComparisonScalar
  |{readonly kind:'array';readonly keyCount:number;readonly length:number;
    readonly elements:readonly StrictComparisonPlan[]}
  |{readonly kind:'object';readonly keyCount:number;
    readonly fields:Readonly<Record<string,StrictComparisonPlan>>}
interface Budget {bytes:number;nodes:number}
interface Frame {
  readonly seed:ProgramOpeningRowFactsSeedV1
  readonly rows:Map<string,Observation>
  readonly hashes:WeakMap<object,string>
  poisoned:boolean
  invalidated:boolean
  closing:boolean
}
const MAX_ROWS=64,MAX_BYTES=16_777_216,MAX_NODES=131_072,MAX_DEPTH=66
// This relation recognizes only the inert namespace DTOs made by our strict
// probe. It holds no actual raw, Session, callback or current-use permission.
const namespaceComparisonPlans=new WeakMap<ProgramOpeningStaticNamespaceRowV1,StrictComparisonPlan>()
class UnsupportedRow extends Error {}
function unsupported():never {throw new UnsupportedRow()}
function address(table:Table,key:string){return table+':'+key}
/** Descriptor-only admission precedes any serialization. In particular, no
 * clone normalizes undefined/-0, invokes accessors or trusts caller freezing. */
function rowData(raw:unknown,budget:Budget,detachCanonical:boolean,statistics?:{maxDepth:number}):unknown {
  if(raw===undefined)unsupported()
  const ancestors=new Set<object>()
  const charge=(bytes:number)=>{budget.bytes+=bytes;if(budget.bytes>MAX_BYTES)unsupported()}
  const quoted=(text:string)=>{
    if(Buffer.byteLength(text,'utf8')>MAX_BYTES-budget.bytes)unsupported()
    charge(Buffer.byteLength(JSON.stringify(text),'utf8'))
  }
  function visit(value:unknown,depth:number):unknown {
    if(++budget.nodes>MAX_NODES||depth>MAX_DEPTH)unsupported()
    if(statistics&&depth>statistics.maxDepth)statistics.maxDepth=depth
    if(value===undefined) {
      if(detachCanonical)unsupported()
      charge(4);return undefined
    }
    if(value===null){charge(4);return value}
    if(typeof value==='string'){quoted(value);return value}
    if(typeof value==='boolean'){charge(value?4:5);return value}
    if(typeof value==='number') {
      if(!Number.isFinite(value)||detachCanonical&&Object.is(value,-0)
        ||Math.abs(value)>Number.MAX_SAFE_INTEGER)unsupported()
      charge(Buffer.byteLength(JSON.stringify(value),'utf8'));return value
    }
    if(!value||typeof value!=='object'||types.isProxy(value)||ancestors.has(value))unsupported()
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value)
    if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)unsupported()
    const keys=Reflect.ownKeys(value)
    if(keys.length>MAX_NODES-budget.nodes+1||keys.some(key=>typeof key!=='string'))unsupported()
    const descriptors=Object.getOwnPropertyDescriptors(value)
    ancestors.add(value);charge(2)
    let copy:unknown
    if(array) {
      const lengthDescriptor=descriptors.length,length=lengthDescriptor?.value
      if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||typeof length!=='number'
        ||!Number.isSafeInteger(length)||length<0||length>MAX_NODES||keys.length!==length+1)unsupported()
      const values:unknown[]|undefined=detachCanonical?[]:undefined
      for(let index=0;index<length;index++) {
        const descriptor=descriptors[String(index)]
        if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)unsupported()
        if(index)charge(1)
        const child=visit(descriptor.value,depth+1)
        values?.push(child)
      }
      copy=values
    }else {
      const values:Record<string,unknown>|undefined=detachCanonical?Object.create(prototype):undefined
      let fields=0
      for(const key of keys as string[]) {
        const descriptor=descriptors[key]!
        if(!Object.hasOwn(descriptor,'value')||!descriptor.enumerable
          ||['__proto__','prototype','constructor'].includes(key))unsupported()
        // The original lore copier validates descriptors, then omits undefined
        // object members without charging their key/value bytes or child node.
        // Strict frame eligibility instead visits/refuses that original spelling.
        if(!detachCanonical&&descriptor.value===undefined)continue
        if(fields++)charge(1)
        quoted(key);charge(1)
        const child=visit(descriptor.value,depth+1)
        if(values)Object.defineProperty(values,key,{value:child,enumerable:true,writable:false,configurable:false})
      }
      copy=values
    }
    ancestors.delete(value)
    return detachCanonical?Object.freeze(copy):undefined
  }
  return visit(raw,0)
}
/** Bounded shape admission before raw hashing. No object is cloned, hashed or
 * normalized; accessors/Proxies/hidden/symbol/custom-prototype data are refused.
 * Undefined and -0 spelling remain for each record's parser/Native grammar to
 * decide: legal opaque author data must not acquire a blanket new prohibition. */
export function assertProgramOpeningRowDataDescriptorsV1(raw:unknown):void {
  try {rowData(raw,{bytes:0,nodes:0},false)}catch(error) {
    if(error instanceof UnsupportedRow)throw Error('PROGRAM_OPENING_ROW_DATA_UNSAFE')
    throw error
  }
}
/** Both inputs are this module's strict detached data. Prototype and ordinary
 * writable/configurable flags are not persistent bytes; hidden fields are. */
function sameCanonicalData(left:unknown,right:unknown):boolean {
  if(Object.is(left,right))return true
  if(!left||!right||typeof left!=='object'||typeof right!=='object'
    ||Array.isArray(left)!==Array.isArray(right))return false
  const keys=Object.keys(left),other=Object.keys(right)
  return keys.length===other.length&&keys.every(key=>Object.hasOwn(right,key)
    &&sameCanonicalData((left as Record<string,unknown>)[key],(right as Record<string,unknown>)[key]))
}
/** Call only for this module's successful strict rowData output. The plan owns
 * no raw references or authority and lives with that bounded Observation; it
 * precomputes only the immutable expected side of every future full comparison. */
function compileStrictComparisonPlan(value:unknown):StrictComparisonPlan {
  if(value===null||typeof value!=='object') {
    return value as StrictComparisonScalar
  }
  if(Array.isArray(value)) {
    const length=value.length,elements:StrictComparisonPlan[]=[]
    for(let index=0;index<length;index++)elements.push(compileStrictComparisonPlan(value[index]))
    return Object.freeze({kind:'array',keyCount:length+1,length,elements:Object.freeze(elements)})
  }
  const keys=Object.keys(value),fields:Record<string,StrictComparisonPlan>=Object.create(null)
  for(const key of keys)fields[key]=compileStrictComparisonPlan((value as Record<string,unknown>)[key])
  return Object.freeze({kind:'object',keyCount:keys.length,fields:Object.freeze(fields)})
}
/** Only compares freshly read raw data with a private strict comparison plan.
 * Its independent bounds never partially charge the real detachment budget.
 * Object identity/freeze cannot replace inspecting every actual descriptor. */
function matchesStrictData(raw:unknown,expected:StrictComparisonPlan):boolean {
  let nodes=0
  const ancestors=new Set<object>()
  function visit(value:unknown,plan:StrictComparisonPlan,depth:number):boolean {
    if(++nodes>MAX_NODES||depth>MAX_DEPTH||value===undefined)return false
    if(value===null||typeof value==='string'||typeof value==='boolean')return Object.is(value,plan)
    if(typeof value==='number') {
      return Number.isFinite(value)&&!Object.is(value,-0)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER
        &&Object.is(value,plan)
    }
    if(!value||typeof value!=='object'||types.isProxy(value)||ancestors.has(value)
      ||!plan||typeof plan!=='object')return false
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value)
    if(array!==(plan.kind==='array')
      ||(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null))return false
    const keys=Reflect.ownKeys(value)
    if(keys.length!==plan.keyCount||keys.length>MAX_NODES-nodes+1
      ||keys.some(key=>typeof key!=='string'))return false
    const descriptors=Object.getOwnPropertyDescriptors(value)
    ancestors.add(value)
    try {
      if(plan.kind==='array') {
        const lengthDescriptor=descriptors.length,length=lengthDescriptor?.value
        if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||typeof length!=='number'
          ||!Number.isSafeInteger(length)||length<0||length>MAX_NODES
          ||length!==plan.length||keys.length!==length+1)return false
        for(let index=0;index<length;index++) {
          const descriptor=descriptors[String(index)]
          if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable
            ||!visit(descriptor.value,plan.elements[index]!,depth+1))return false
        }
      }else {
        for(const key of keys as string[]) {
          const descriptor=descriptors[key]!
          if(!Object.hasOwn(plan.fields,key)||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable
            ||['__proto__','prototype','constructor'].includes(key)
            ||!visit(descriptor.value,plan.fields[key]!,depth+1))return false
        }
      }
      return true
    }finally {
      // Noncyclic aliases must be visited independently for every occurrence.
      ancestors.delete(value)
    }
  }
  return visit(raw,expected,0)
}
/** Reuse our immutable expected-side plan at each namespace comparison point.
 * Foreign structural DTOs remain on the caller's original comparison route;
 * recognizing this DATA never establishes an active frame or current owner. */
export function matchesProgramOpeningNamespaceDataV1(raw:unknown,row:ProgramOpeningStaticNamespaceRowV1)
  :boolean|undefined {
  const plan=namespaceComparisonPlans.get(row)
  return plan===undefined?undefined:matchesStrictData(raw,plan)
}
function probe(read:(table:Table,key:string)=>unknown,row:Address,budget:Budget,cached?:Observation):Observation {
  const raw=read(row.table,row.key)
  if(raw===undefined)return Object.freeze({...row,exists:false,value:undefined,sha256:null})
  try {
    const stats=cached?.cloneBudget
    if(cached?.exists&&cached.sha256===row.sha256&&stats&&stats.maxDepth<=MAX_DEPTH
      &&stats.bytes<=MAX_BYTES-budget.bytes&&stats.nodes<=MAX_NODES-budget.nodes
      &&cached.comparisonPlan!==undefined&&matchesStrictData(raw,cached.comparisonPlan)) {
      // Equal strict data has the exact original monotonic clone charges.
      // Current seed SHA, bindings and closing still decide frame eligibility.
      budget.bytes+=stats.bytes;budget.nodes+=stats.nodes
      return cached
    }
    // Strict detachment already admits every descriptor before fields/hash.
    // Successful canonical probes need no separate traversal of the same raw.
    // A miss uses this same first raw value, preserving read/error precedence.
    const beforeBytes=budget.bytes,beforeNodes=budget.nodes,statistics={maxDepth:0},
      value=rowData(raw,budget,true,statistics),sha256=recordSha256(value),
      cloneBudget=Object.freeze({bytes:budget.bytes-beforeBytes,nodes:budget.nodes-beforeNodes,
        maxDepth:statistics.maxDepth}),
      namespaceRow=value!==null&&typeof value==='object'&&!Array.isArray(value)?Object.freeze({
        value:value as Readonly<Record<string,unknown>>,sha256,
        cloneBudget}):undefined,
      comparisonPlan=compileStrictComparisonPlan(value)
    if(namespaceRow)namespaceComparisonPlans.set(namespaceRow,comparisonPlan)
    return Object.freeze({...row,exists:true,value,sha256,cloneBudget,
      comparisonPlan,...namespaceRow?{namespaceRow}:{}})
  }catch(error) {
    if(error instanceof UnsupportedRow) {
      // Preserve the original unsafe-data error before fallback/close spelling
      // errors, even when the callback would perform no subsequent row reads.
      assertProgramOpeningRowDataDescriptorsV1(raw)
    }
    throw error
  }
}

export function createProgramOpeningRowFactsV1(read:(table:Table,key:string)=>unknown) {
  let active:Frame|undefined
  // Only the last fully closed frame's immutable DATA survives. No seed,
  // Session, binding callback, permission or raw mutable object is retained.
  let retained:Map<string,Observation>|undefined
  // Ordinary reads retain only strict detached DATA from an actual requested
  // address. They never enroll rows in a frame or retain raw object identity.
  const ordinary=new Map<string,Observation>()
  function clearData():void {
    retained=undefined
    ordinary.clear()
  }
  function dataAt(table:Table,key:string):Observation|undefined {
    const id=address(table,key)
    return ordinary.get(id)??retained?.get(id)
  }
  function rememberOrdinary(row:Observation):void {
    const id=address(row.table,row.key)
    ordinary.delete(id)
    let rows=retained?.size??0,bytes=0,nodes=0
    for(const observation of retained?.values()??[]) {
      bytes+=observation.cloneBudget?.bytes??0
      nodes+=observation.cloneBudget?.nodes??0
    }
    for(const observation of ordinary.values()) {
      rows++
      bytes+=observation.cloneBudget!.bytes
      nodes+=observation.cloneBudget!.nodes
    }
    const stats=row.cloneBudget!
    // Capacity is retention policy, never a shared admission budget. The
    // closing map stays intact; evict ordinary DATA first, then skip if needed.
    for(const [key,observation] of ordinary) {
      if(rows+1<=MAX_ROWS&&bytes+stats.bytes<=MAX_BYTES&&nodes+stats.nodes<=MAX_NODES)break
      ordinary.delete(key);rows--
      bytes-=observation.cloneBudget!.bytes
      nodes-=observation.cloneBudget!.nodes
    }
    if(rows+1<=MAX_ROWS&&bytes+stats.bytes<=MAX_BYTES&&nodes+stats.nodes<=MAX_NODES)ordinary.set(id,row)
  }
  function reject(code:string):never {
    clearData()
    if(active)active.poisoned=true
    throw Error(code)
  }
  function alive(frame:Frame):void {
    if(active!==frame||frame.poisoned||frame.invalidated)reject('PROGRAM_OPENING_ROW_FACTS_INVALIDATED')
  }
  function assertCanEnter():void {
    if(active)reject('PROGRAM_OPENING_ROW_FACTS_NESTED')
  }
  function assertWriteAllowed():void {
    if(active)reject('PROGRAM_OPENING_ROW_FACTS_WRITE_FORBIDDEN')
  }
  function readAdmittedRaw(table:Table,key:string):unknown {
    try {
      const raw=read(table,key)
      // Official Domain exposes mutable values. Ordinary reads must admit them
      // before callers access fields/hash. Equal private strict DATA can reuse
      // admission only after inspecting every descriptor of this actual raw.
      const cached=dataAt(table,key)
      if(raw!==undefined&&cached?.exists&&cached.comparisonPlan!==undefined
        &&matchesStrictData(raw,cached.comparisonPlan))return raw
      ordinary.delete(address(table,key))
      if(raw!==undefined) {
        try {
          const budget={bytes:0,nodes:0},statistics={maxDepth:0},
            value=rowData(raw,budget,true,statistics),sha256=recordSha256(value),
            cloneBudget=Object.freeze({...budget,maxDepth:statistics.maxDepth})
          rememberOrdinary(Object.freeze({table,key,exists:true,value,sha256,cloneBudget,
            comparisonPlan:compileStrictComparisonPlan(value)}))
        }catch(error) {
          if(!(error instanceof UnsupportedRow))throw error
          // Strict reuse excludes undefined/-0. The original broad admission
          // still decides these spellings on the same raw, without another get.
          assertProgramOpeningRowDataDescriptorsV1(raw)
        }
      }
      // Native grammar must see the original alias, including changes made
      // across later reads. A detached DTO is never returned on this path.
      return raw
    }catch(error) {
      clearData()
      throw error
    }
  }
  function readRow(table:Table,key:string):unknown {
    const frame=active
    if(!frame)return readAdmittedRaw(table,key)
    alive(frame)
    const row=frame.rows.get(address(table,key))
    // No caller-supplied ref or namespace-wide row can enlarge the footprint.
    if(!row)reject('PROGRAM_OPENING_ROW_FACTS_ADDRESS_OUTSIDE')
    return frame.closing?readAdmittedRaw(table,key):row.value
  }
  function digest(value:unknown):string {
    const frame=active
    if(frame) {
      alive(frame)
      if(!frame.closing&&value!==null&&typeof value==='object') {
        const hash=frame.hashes.get(value)
        if(hash!==undefined)return hash
      }
    }
    try {return recordSha256(value)}catch(error){clearData();throw error}
  }
  function digestRow(table:Table,key:string,value:unknown):string {
    // Active-frame identity hashes and original closing behavior stay with
    // digest. An address here never grants access or enlarges a footprint.
    if(active)return digest(value)
    try {
      const cached=dataAt(table,key)
      // Reinspect the actual argument at the original digest point: another
      // read may have mutated its raw alias after descriptor admission.
      if(cached?.exists&&cached.comparisonPlan!==undefined
        &&matchesStrictData(value,cached.comparisonPlan))return cached.sha256!
      return digest(value)
    }catch(error) {
      clearData()
      throw error
    }
  }
  function activeStaticNamespaceRow(sessionId:string,table:Table,key:string):ProgramOpeningStaticNamespaceRowV1|undefined {
    const frame=active
    if(!frame)return
    alive(frame)
    if(frame.closing||frame.seed.sessionId!==sessionId)return
    try {frame.seed.assertBindings();alive(frame)}catch(error){clearData();frame.poisoned=true;throw error}
    // A miss never extends the registered footprint or starts another capture.
    return frame.rows.get(address(table,key))?.namespaceRow
  }
  function withSynchronousRows(seed:ProgramOpeningRowFactsSeedV1|undefined,checks:()=>void):void {
    assertCanEnter()
    try {
      if(typeof checks!=='function')throw Error('PROGRAM_OPENING_ROW_FACTS_CHECKS_REQUIRED')
      let prepared:Map<string,Observation>|undefined
      if(seed&&seed.rows.length<=MAX_ROWS) {
        try {
          const rows=new Map<string,Observation>(),budget={bytes:0,nodes:0},prefix=seed.sessionId+'__'
          for(const row of seed.rows) {
            const key=address(row.table,row.key)
            if(!row.key.startsWith(prefix)||rows.has(key))unsupported()
            const observation=probe(read,row,budget,retained?.get(key))
            if(observation.sha256!==row.sha256)unsupported()
            rows.set(key,observation)
          }
          prepared=rows
        }catch(error) {
          clearData()
          // Before the callback, unsupported spelling/bounds takes the original
          // fresh-read path. An actual I/O exception is never turned into success.
          if(!(error instanceof UnsupportedRow))throw error
        }
      }
      if(!seed||!prepared) {
        retained=undefined
        // This is not an active frame: cold/numeric/generated readers and their
        // original legal calls remain unchanged. Only the void contract applies.
        const result:unknown=checks()
        if(result!==undefined)throw Error('PROGRAM_OPENING_ROW_FACTS_ASYNC_CHECKS')
        return
      }
      seed.assertBindings()
      const frame:Frame={seed,rows:prepared,hashes:new WeakMap(),poisoned:false,invalidated:false,closing:false}
      for(const row of prepared.values())if(row.exists&&row.value!==null&&typeof row.value==='object') {
        frame.hashes.set(row.value,row.sha256!)
      }
      active=frame
      try {
        const result:unknown=checks()
        if(result!==undefined)reject('PROGRAM_OPENING_ROW_FACTS_ASYNC_CHECKS')
        alive(frame);frame.closing=true
        // Check binding before using it, then again after all full actual reads.
        // A failed comparison poisons the frame even if an inner caller catches.
        seed.assertBindings();alive(frame)
        const budget={bytes:0,nodes:0}
        for(const row of prepared.values()) {
          let fresh:Observation
          try {fresh=probe(read,row,budget,retained?.get(address(row.table,row.key)))}catch(error) {
            frame.poisoned=true
            if(error instanceof UnsupportedRow)reject('PROGRAM_OPENING_ROW_FACTS_SPELLING_CHANGED')
            throw error
          }
          if(fresh.exists!==row.exists||fresh.sha256!==row.sha256||!sameCanonicalData(fresh.value,row.value)) {
            reject('PROGRAM_OPENING_ROW_FACTS_CHANGED')
          }
          alive(frame)
        }
        seed.assertBindings();alive(frame)
        // Publish only after the void callback, every closing read/comparison,
        // final binding and poison checks. Copy the map before active cleanup.
        ordinary.clear()
        retained=new Map(prepared)
      }catch(error) {
        frame.poisoned=true
        throw error
      }finally {
        // A retained DTO never opens a frame. The next call independently reads,
        // checks its current seed/bindings and charges its complete own budget.
        if(active===frame)active=undefined
        prepared.clear()
      }
    }catch(error) {
      // Includes early bindings/read errors and failed/nonvoid fallback calls.
      clearData()
      throw error
    }
  }
  function invalidate():void {
    clearData()
    if(active){active.invalidated=true;active.poisoned=true}
  }
  return {read:readRow,digest,digestRow,activeStaticNamespaceRow,assertCanEnter,assertWriteAllowed,withSynchronousRows,invalidate}
}
