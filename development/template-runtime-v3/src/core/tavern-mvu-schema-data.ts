/** Author execution envelopes have a different budget from numerical values.
 * Descriptor validation happens before hashing, serialization or worker transfer;
 * a valid hash is data integrity and does not prove historical execution. */
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {recordSha256,stableJson} from './roleplay-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'

const forbidden=new Set(['__proto__','constructor','prototype'])
const own=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key)
function fail(code:string):never {throw Error(code)}
const object=(value:unknown):value is MvuJsonObject=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const executionCloneBounds=Object.freeze({bytes:16_777_216,
  nodes:MVU_SCHEMA_BOUNDS.evaluationNodes,depth:MVU_SCHEMA_BOUNDS.evaluationDepth,
  arrayLength:MVU_SCHEMA_BOUNDS.arrayLength})
const sourceMaterialBounds=Object.freeze({bytes:67_108_864,nodes:524_288,depth:96,
  arrayLength:MVU_SCHEMA_BOUNDS.arrayLength})
// Browser3 descriptors carry complete preorder AST tables. Their metadata
// capacity is independent of Source material and ABI4 numerical envelopes.
const descriptorCloneBounds=Object.freeze({...sourceMaterialBounds,nodes:1_048_576,arrayLength:131_072})
interface SchemaRecordBounds {nodes:number;depth:number;arrayLength?:number}
interface SchemaCloneMaximum {bytes:number;nodes:number;depth:number;arrayLength:number}

function cloneBudget(maxBytes:number,recordBounds:SchemaRecordBounds|undefined,
  maximum:SchemaCloneMaximum) {
  const depth=recordBounds?.depth??64,nodes=recordBounds?.nodes??64000,
    arrayLength=recordBounds?.arrayLength??MVU_SCHEMA_BOUNDS.arrayLength
  if(!Number.isSafeInteger(depth)||depth<1||depth>maximum.depth
    ||!Number.isSafeInteger(nodes)||nodes<1||nodes>maximum.nodes
    ||!Number.isSafeInteger(arrayLength)||arrayLength<1||arrayLength>maximum.arrayLength
    ||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>maximum.bytes)fail('SCHEMA_DATA_LIMIT')
  return {depth,nodes,arrayLength}
}

interface SchemaCloneSummary {bytes:number;nodes:number}
interface SchemaMaterialCloneSummary extends SchemaCloneSummary {sha256:string}
interface SchemaMaterialClone {
  replace(value:unknown):MvuJsonValue
}
type DataDescriptors=Record<string,PropertyDescriptor>
const codeSourceEncoding=new Set(['native-mvu-author-compilation-input-v2','native-mvu-author-schema-program-v2'])
function sourceSlot(descriptors:DataDescriptors,key:string):boolean {
  const encoding=descriptors.encoding?.value
  return key==='source'&&typeof encoding==='string'&&codeSourceEncoding.has(encoding)
}
function materialSlot(descriptors:DataDescriptors,source:boolean):boolean {
  if(source)return true
  if(descriptors.encoding?.value==='native-mvu-schema-story-source-frame-v1')return true
  if(descriptors.schemaVersion?.value===4&&descriptors.ownerSessionId&&descriptors.sourceNativeCutSha256
    &&descriptors.values&&descriptors.context)return true
  const input=descriptors.input?.value
  if(input&&typeof input==='object'&&!types.isProxy(input)) {
    const encoding=Object.getOwnPropertyDescriptor(input,'encoding')?.value
    return (encoding==='native-mvu-author-schema-phase-input-v4'
      ||encoding==='native-mvu-author-schema-phase-input-v4-scope-ref-v2')
      &&descriptors.ownerSessionId!==undefined&&descriptors.sourceNativeCutSha256!==undefined
  }
  return false
}
const authorDataSlots=new Set(['values','context','variables','commands','operations'])
function authorDataSlot(key:string):boolean {
  // These namespaces contain author state and update payloads throughout the
  // snapshot/plan/event family, not just phase inputs. Their own encoding-like
  // fields remain ordinary JSON and cannot become Source material references.
  return authorDataSlots.has(key)
}
function clone(input:unknown,maxBytes:number,maxDepth:number,maxNodes:number,
  materials?:SchemaMaterialClone,summary?:SchemaMaterialCloneSummary,maxArrayLength:number=MVU_SCHEMA_BOUNDS.arrayLength):MvuJsonValue {
  const ancestors=new Set<object>()
  let nodes=0,bytes=0
  const count=(value:string)=>{
    bytes+=Buffer.byteLength(value,'utf8')
    if(bytes>maxBytes)fail('SCHEMA_DATA_BYTE_LIMIT')
  }
  function visit(value:unknown,depth:number,source=false,sourceData=true):MvuJsonValue {
    if(++nodes>maxNodes)fail('SCHEMA_DATA_NODE_LIMIT')
    if(depth>maxDepth)fail('SCHEMA_DATA_DEPTH_LIMIT')
    if(value===null||typeof value==='boolean')return value
    if(typeof value==='string'){count(value);return value}
    if(typeof value==='number') {
      if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)fail('SCHEMA_NUMBER_LIMIT')
      return Object.is(value,-0)?0:value
    }
    if(typeof value!=='object')fail('SCHEMA_NON_JSON_VALUE')
    // A Proxy can execute even getPrototypeOf/ownKeys. Refuse before any trap.
    if(types.isProxy(value))fail('SCHEMA_PROXY_VALUE')
    if(ancestors.has(value))fail('SCHEMA_CYCLIC_VALUE')
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value)
    if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)fail('SCHEMA_OBJECT_PROTOTYPE')
    // Count keys before allocating one descriptor object per key. Proxy traps
    // have already been excluded, and a giant flat object cannot amplify here.
    if(Object.getOwnPropertyNames(value).length>maxNodes-nodes+1)fail('SCHEMA_DATA_NODE_LIMIT')
    if(Object.getOwnPropertySymbols(value).length)fail('SCHEMA_NON_JSON_VALUE')
    const descriptors=Object.getOwnPropertyDescriptors(value),keys=Object.keys(descriptors)
    if(keys.length>maxNodes-nodes+1)fail('SCHEMA_DATA_NODE_LIMIT')
    ancestors.add(value)
    let result:MvuJsonValue
    if(array) {
      const length:unknown=descriptors.length?.value
      if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0||length>maxArrayLength) {
        fail('SCHEMA_ARRAY_LIMIT')
      }
      if(keys.some(key=>key!=='length'&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=length)))fail('SCHEMA_ARRAY_PROPERTY')
      result=[]
      for(let index=0;index<length;index++) {
        const descriptor=descriptors[String(index)]
        if(!descriptor||!own(descriptor,'value')||!descriptor.enumerable)fail('SCHEMA_NON_JSON_VALUE')
        result.push(visit(descriptor.value,depth+1,false,sourceData))
      }
    } else {
      result={}
      const hasMaterial=sourceData&&materials!==undefined&&materialSlot(descriptors,source)
      for(const key of keys) {
        count(key)
        if(forbidden.has(key))fail('SCHEMA_PROTOTYPE_KEY')
        const descriptor=descriptors[key]!
        if(!own(descriptor,'value')||!descriptor.enumerable)fail('SCHEMA_NON_JSON_VALUE')
        result[key]=hasMaterial&&key==='material'?materials!.replace(descriptor.value)
          :visit(descriptor.value,depth+1,sourceData&&materials!==undefined&&sourceSlot(descriptors,key),
            sourceData&&(materials===undefined||!authorDataSlot(key)))
      }
    }
    ancestors.delete(value)
    return result
  }
  const result=visit(input,0)
  // Source capture needs both its exact JSON budget and stable record hash.
  // Ordering changes no JSON byte count; reuse the full canonical encoding
  // for those two facts instead of serializing the Source a second time.
  const serialized=summary?stableJson(result)!:JSON.stringify(result)
  const serializedBytes=Buffer.byteLength(serialized,'utf8')
  if(serializedBytes>maxBytes)fail('SCHEMA_DATA_BYTE_LIMIT')
  if(summary) {
    summary.bytes=serializedBytes;summary.nodes=nodes
    summary.sha256=createHash('sha256').update(serialized,'utf8').digest('hex')
  }
  return result
}

/** Clones aliases independently. The generic signature retains the envelope's
 * declared type; callers must still validate its required fields and hashes. */
export function cloneSchemaData<T>(input:T,maxBytes:number,recordBounds?:SchemaRecordBounds):T {
  const {depth,nodes,arrayLength}=cloneBudget(maxBytes,recordBounds,executionCloneBounds)
  return clone(input,maxBytes,depth,nodes,undefined,undefined,arrayLength) as T
}
/** Persisted host descriptors aggregate multiple execution records. Their fixed
 * ceiling does not enlarge execution envelopes; every repeated child occurrence
 * is still traversed and charged by the same clone implementation. */
export function cloneSchemaDescriptorData<T>(input:T,maxBytes:number,recordBounds?:SchemaRecordBounds):T {
  const {depth,nodes,arrayLength}=cloneBudget(maxBytes,recordBounds,descriptorCloneBounds)
  return clone(input,maxBytes,depth,nodes,undefined,undefined,arrayLength) as T
}

export interface SchemaMaterialEnvelopeV4<T> {
  schemaVersion:1
  encoding:'native-mvu-private-material-envelope-v4'
  data:T
  materials:readonly {sha256:string;value:MvuJsonValue}[]
}
export interface SchemaMaterialDataV4 extends SchemaCloneSummary {
  readonly sha256:string
  readonly value:MvuJsonObject
}
/** A live realm keeps only these compact facts, never historical frames or
 * Source values. The cold sequence owner fills a fresh sink while parsing. */
export interface SchemaMaterialBudgetV4 extends SchemaCloneSummary {readonly hashes:Set<string>}
export type SchemaMaterialBudgetDeltaV4=Pick<SchemaMaterialDataV4,'sha256'|'bytes'|'nodes'>
export function createSchemaMaterialBudgetV4():SchemaMaterialBudgetV4 {
  return {hashes:new Set<string>(),bytes:0,nodes:0}
}
/** The requested frame's codec already owns immutable material and its exact
 * summary. Check a candidate without changing the accepted realm's budget. */
export function schemaMaterialBudgetDeltaV4(budget:SchemaMaterialBudgetV4,material:unknown):SchemaMaterialBudgetDeltaV4|undefined {
  const owned=captureSchemaMaterialV4(material)
  if(budget.hashes.has(owned.sha256))return undefined
  if(budget.bytes+owned.bytes>sourceMaterialBounds.bytes)fail('SCHEMA_DATA_BYTE_LIMIT')
  if(budget.nodes+owned.nodes>sourceMaterialBounds.nodes)fail('SCHEMA_DATA_NODE_LIMIT')
  return {sha256:owned.sha256,bytes:owned.bytes,nodes:owned.nodes}
}
// Only DATA parsed and deeply frozen by this owner can bypass another JSON
// traversal. Neither this cache nor a material SHA grants Source/Native authority.
const ownedMaterialsV4=new WeakMap<object,SchemaMaterialDataV4>()
function freezeDataV4(input:unknown,seen=new Set<object>()):void {
  if(!input||typeof input!=='object'||seen.has(input))return
  seen.add(input)
  for(const child of Object.values(input))freezeDataV4(child,seen)
  Object.freeze(input)
}
/** The actual Source producer uses this same bounded immutable DATA result as
 * later envelopes. Capturing material does not establish Source permission. */
export function captureSchemaMaterialV4(input:unknown):Readonly<SchemaMaterialDataV4> {
  const owned=input&&typeof input==='object'?ownedMaterialsV4.get(input):undefined
  if(owned)return owned
  const summary={bytes:0,nodes:0,sha256:''}
  const value=clone(input,sourceMaterialBounds.bytes,sourceMaterialBounds.depth,sourceMaterialBounds.nodes,
    undefined,summary)
  if(!object(value))fail('SCHEMA_ROOT_OBJECT_REQUIRED')
  const data=Object.freeze({...summary,value})
  freezeDataV4(value)
  if(value&&typeof value==='object')ownedMaterialsV4.set(value,data)
  return data
}
/** Code/numerical metadata keeps its original budget. Full author DATA has
 * the existing host descriptor budget and is charged once per material SHA. */
export function packSchemaEnvelopeV4<T>(input:T,maxBytes:number,
  recordBounds?:SchemaRecordBounds):SchemaMaterialEnvelopeV4<T> {
  return packMaterialEnvelopeV4(input,maxBytes,recordBounds,executionCloneBounds)
}
function packMaterialEnvelopeV4<T>(input:T,maxBytes:number,
  recordBounds:SchemaRecordBounds|undefined,
  maximum:SchemaCloneMaximum,captured?:WeakMap<object,SchemaMaterialDataV4>,
  canonical?:Map<string,SchemaMaterialDataV4>,aggregate?:SchemaCloneSummary,
  materialHashes?:Set<string>):SchemaMaterialEnvelopeV4<T> {
  const limits=cloneBudget(maxBytes,recordBounds,maximum)
  const dictionary=new Map<string,SchemaMaterialDataV4>(),identities=new WeakMap<object,string>()
  let bytes=0,nodes=0
  const data=clone(input,maxBytes,limits.depth,limits.nodes,{replace:raw=>{
    const existing=raw&&typeof raw==='object'?identities.get(raw):undefined
    if(existing)return existing
    let material=raw&&typeof raw==='object'?captured?.get(raw):undefined
    if(!material) {
      const fresh=captureSchemaMaterialV4(raw)
      material=canonical?.get(fresh.sha256)
      if(!material) {
        material=fresh
        if(aggregate) {
          aggregate.bytes+=material.bytes;aggregate.nodes+=material.nodes
          if(aggregate.bytes>sourceMaterialBounds.bytes)fail('SCHEMA_DATA_BYTE_LIMIT')
          if(aggregate.nodes>sourceMaterialBounds.nodes)fail('SCHEMA_DATA_NODE_LIMIT')
        }
        canonical?.set(material.sha256,material)
        materialHashes?.add(material.sha256)
      }
      if(raw&&typeof raw==='object')captured?.set(raw,material)
    }
    if(!dictionary.has(material.sha256)) {
      if(!aggregate) {
        bytes+=material.bytes;nodes+=material.nodes
        if(bytes>sourceMaterialBounds.bytes)fail('SCHEMA_DATA_BYTE_LIMIT')
        if(nodes>sourceMaterialBounds.nodes)fail('SCHEMA_DATA_NODE_LIMIT')
      }
      dictionary.set(material.sha256,material)
    }
    if(raw&&typeof raw==='object')identities.set(raw,material.sha256)
    return material.sha256
  }},undefined,limits.arrayLength) as T
  return {schemaVersion:1,encoding:'native-mvu-private-material-envelope-v4',data,
    materials:[...dictionary.values()].map(({sha256,value})=>({sha256,value}))}
}
function restoreMaterialsV4<T>(data:T,materials:ReadonlyMap<string,MvuJsonValue>):T {
  function restore(input:unknown,source=false,sourceData=true):void {
    if(!input||typeof input!=='object')return
    if(Array.isArray(input)){for(const child of input)restore(child,false,sourceData);return}
    const descriptors=Object.getOwnPropertyDescriptors(input),record=input as Record<string,unknown>
    const hasMaterial=sourceData&&materialSlot(descriptors,source)
    for(const [key,descriptor] of Object.entries(descriptors)) {
      if(hasMaterial&&key==='material') {
        const material=typeof descriptor.value==='string'?materials.get(descriptor.value):undefined
        if(material===undefined)fail('SCHEMA_MATERIAL_REFERENCE_MISSING')
        record[key]=material
      }else restore(descriptor.value,sourceData&&sourceSlot(descriptors,key),sourceData&&!authorDataSlot(key))
    }
  }
  restore(data)
  return data
}
/** Decodes the private transport before the usual logical contract checks.
 * Persisted records and all logical hashes still contain their full material. */
export function unpackSchemaEnvelopeV4<T>(input:SchemaMaterialEnvelopeV4<T>,maxBytes:number,
  recordBounds?:SchemaRecordBounds,identity?:Map<string,MvuJsonValue>):T {
  if(input.schemaVersion!==1||input.encoding!=='native-mvu-private-material-envelope-v4') {
    fail('SCHEMA_MATERIAL_ENVELOPE_VERSION')
  }
  const limits=cloneBudget(maxBytes,recordBounds,executionCloneBounds)
  const data=clone(input.data,maxBytes,limits.depth,limits.nodes,undefined,undefined,limits.arrayLength) as T
  const materials=identity??new Map<string,MvuJsonValue>()
  let bytes=0,nodes=0
  for(const row of input.materials) {
    if(materials.has(row.sha256))continue
    const material=captureSchemaMaterialV4(row.value)
    if(row.sha256!==material.sha256)fail('SCHEMA_MATERIAL_REFERENCE_MISMATCH')
    bytes+=material.bytes;nodes+=material.nodes
    if(bytes>sourceMaterialBounds.bytes)fail('SCHEMA_DATA_BYTE_LIMIT')
    if(nodes>sourceMaterialBounds.nodes)fail('SCHEMA_DATA_NODE_LIMIT')
    materials.set(row.sha256,material.value)
  }
  return restoreMaterialsV4(data,materials)
}
/** Local consumers use the same DATA owner without a second transport parse. */
export function cloneSchemaEnvelopeV4<T>(input:T,maxBytes:number,
  recordBounds?:SchemaRecordBounds):T {
  const packed=packSchemaEnvelopeV4(input,maxBytes,recordBounds)
  return restoreMaterialsV4(packed.data,new Map(packed.materials.map(row=>[row.sha256,row.value])))
}
/** One synchronous trace parser owns this cloner. It cannot outlive that
 * parse or be reused across a mutable caller boundary. Repeated full Source
 * objects are captured once; each frame keeps its own existing DATA budget. */
export function schemaEnvelopeSequenceClonerV4(budget?:SchemaMaterialBudgetV4) {
  return envelopeSequenceClonerV4(executionCloneBounds,budget)
}
/** A Journal cut owns one descriptor material dictionary across its records.
 * Metadata is bounded per row; unique Source bytes/nodes retain the original
 * whole-cut 64 MiB/524288 budget and same-SHA object sharing. */
export function schemaDescriptorEnvelopeSequenceClonerV4() {
  return envelopeSequenceClonerV4(descriptorCloneBounds)
}
function envelopeSequenceClonerV4(maximum:SchemaCloneMaximum,budget?:SchemaMaterialBudgetV4) {
  const captured=new WeakMap<object,SchemaMaterialDataV4>(),canonical=new Map<string,SchemaMaterialDataV4>()
  const aggregate=budget??{bytes:0,nodes:0}
  return <T>(input:T,maxBytes:number,recordBounds?:SchemaRecordBounds):T=>{
    const packed=packMaterialEnvelopeV4(input,maxBytes,recordBounds,maximum,captured,canonical,aggregate,budget?.hashes)
    return restoreMaterialsV4(packed.data,new Map(packed.materials.map(row=>[row.sha256,row.value])))
  }
}
/** One live Worker transport owns this sender and its receiver's material
 * dictionary. Full Source bytes cross that channel once per actual SHA; later
 * frames carry references to those already owned bytes, never identity claims
 * inferred from a Native cut, Source version or abbreviated history digest. */
export function schemaEnvelopeWireSenderV4() {
  const captured=new WeakMap<object,SchemaMaterialDataV4>(),canonical=new Map<string,SchemaMaterialDataV4>()
  const aggregate={bytes:0,nodes:0}
  const sent=new Set<string>()
  return <T>(input:T,maxBytes:number,recordBounds?:SchemaRecordBounds):SchemaMaterialEnvelopeV4<T>=>{
    const packed=packMaterialEnvelopeV4(input,maxBytes,recordBounds,executionCloneBounds,captured,canonical,aggregate)
    const materials=packed.materials.filter(row=>!sent.has(row.sha256))
    for(const row of materials)sent.add(row.sha256)
    return {...packed,materials}
  }
}
/** Split only explicitly sequence-owned fields before cloning metadata. Each
 * returned field still needs its own DATA parser; no aggregate history budget
 * is substituted for the per-frame execution contract. Accessors and proxies
 * retain the ordinary JSON boundary without invoking authored properties. */
export function splitSchemaEnvelopeV4(input:unknown,fields:readonly string[],maxBytes:number,
  recordBounds?:SchemaRecordBounds):{header:Record<string,unknown>;fields:Record<string,unknown>} {
  if(!input||typeof input!=='object'||Array.isArray(input)||types.isProxy(input))fail('SCHEMA_DATA_INVALID')
  const descriptors=Object.getOwnPropertyDescriptors(input),values:Record<string,unknown>={}
  for(const key of fields) {
    const descriptor=descriptors[key]
    if(!descriptor||!own(descriptor,'value'))fail('SCHEMA_DATA_INVALID')
    values[key]=descriptor.value
    descriptors[key]={...descriptor,value:null}
  }
  return {header:cloneSchemaEnvelopeV4(Object.create(Object.getPrototypeOf(input),descriptors),maxBytes,recordBounds),
    fields:values}
}
/** The historical sequence itself has no frame-sized item-count limit. Its
 * elements remain independently bounded and parsed by their execution owner. */
export function schemaSequenceItemsV4(input:unknown):readonly unknown[] {
  if(!Array.isArray(input)||types.isProxy(input))fail('SCHEMA_DATA_INVALID')
  const descriptors=Object.getOwnPropertyDescriptors(input) as Record<string,PropertyDescriptor>
  const length=descriptors.length!.value as number
  if(Reflect.ownKeys(descriptors).length!==length+1)fail('SCHEMA_DATA_INVALID')
  const result:unknown[]=[]
  for(let index=0;index<length;index++) {
    const descriptor=descriptors[String(index)]
    if(!descriptor||!own(descriptor,'value'))fail('SCHEMA_DATA_INVALID')
    result.push(descriptor.value)
  }
  return result
}
/** Host descriptors keep their existing metadata depth while using the same
 * full Source owner as the v4 execution transport. */
export function cloneSchemaDescriptorEnvelopeV4<T>(input:T,maxBytes:number,
  recordBounds?:SchemaRecordBounds):T {
  const packed=packMaterialEnvelopeV4(input,maxBytes,recordBounds,descriptorCloneBounds)
  return restoreMaterialsV4(packed.data,new Map(packed.materials.map(row=>[row.sha256,row.value])))
}
export function cloneSchemaValues(input:unknown):MvuJsonObject {
  const value=clone(input,MVU_SCHEMA_BOUNDS.valuesBytes,MVU_SCHEMA_BOUNDS.dataDepth,MVU_SCHEMA_BOUNDS.dataNodes)
  if(!object(value))fail('SCHEMA_ROOT_OBJECT_REQUIRED')
  return value
}
export function schemaTextSha256(text:string):string {
  if(typeof text!=='string')fail('SCHEMA_TEXT_REQUIRED')
  return createHash('sha256').update(text,'utf8').digest('hex')
}
