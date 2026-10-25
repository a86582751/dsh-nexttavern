/** Author execution envelopes have a different budget from numerical values.
 * Descriptor validation happens before hashing, serialization or worker transfer;
 * a valid hash is data integrity and does not prove historical execution. */
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {recordSha256} from './roleplay-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'
import type {MvuSchemaProgram,MvuSchemaImplementationIdentity,MvuSchemaLibraryIdentity,
  MvuSchemaAuthorScript,MvuSchemaSourceBinding} from './tavern-mvu-schema-types.js'

const forbidden=new Set(['__proto__','constructor','prototype'])
const own=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key)
function fail(code:string):never {throw Error(code)}
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
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
    return encoding==='native-mvu-author-schema-phase-input-v4'
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
  materials?:SchemaMaterialClone,summary?:SchemaCloneSummary,maxArrayLength:number=MVU_SCHEMA_BOUNDS.arrayLength):MvuJsonValue {
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
  const serializedBytes=Buffer.byteLength(JSON.stringify(result),'utf8')
  if(serializedBytes>maxBytes)fail('SCHEMA_DATA_BYTE_LIMIT')
  if(summary){summary.bytes=serializedBytes;summary.nodes=nodes}
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
  const summary={bytes:0,nodes:0}
  const value=clone(input,sourceMaterialBounds.bytes,sourceMaterialBounds.depth,sourceMaterialBounds.nodes,
    undefined,summary)
  if(!object(value))fail('SCHEMA_ROOT_OBJECT_REQUIRED')
  const data=Object.freeze({...summary,value,sha256:recordSha256(value)})
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
  maximum:SchemaCloneMaximum):SchemaMaterialEnvelopeV4<T> {
  const limits=cloneBudget(maxBytes,recordBounds,maximum)
  const dictionary=new Map<string,SchemaMaterialDataV4>(),identities=new WeakMap<object,string>()
  let bytes=0,nodes=0
  const data=clone(input,maxBytes,limits.depth,limits.nodes,{replace:raw=>{
    const existing=raw&&typeof raw==='object'?identities.get(raw):undefined
    if(existing)return existing
    const material=captureSchemaMaterialV4(raw)
    if(!dictionary.has(material.sha256)) {
      bytes+=material.bytes;nodes+=material.nodes
      if(bytes>sourceMaterialBounds.bytes)fail('SCHEMA_DATA_BYTE_LIMIT')
      if(nodes>sourceMaterialBounds.nodes)fail('SCHEMA_DATA_NODE_LIMIT')
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
  recordBounds?:SchemaRecordBounds):T {
  if(input.schemaVersion!==1||input.encoding!=='native-mvu-private-material-envelope-v4') {
    fail('SCHEMA_MATERIAL_ENVELOPE_VERSION')
  }
  const limits=cloneBudget(maxBytes,recordBounds,executionCloneBounds)
  const data=clone(input.data,maxBytes,limits.depth,limits.nodes,undefined,undefined,limits.arrayLength) as T
  const materials=new Map<string,MvuJsonValue>()
  let bytes=0,nodes=0
  for(const row of input.materials) {
    const material=captureSchemaMaterialV4(row.value)
    if(row.sha256!==material.sha256)fail('SCHEMA_MATERIAL_REFERENCE_MISMATCH')
    if(materials.has(row.sha256))continue
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

function exact(value:object,keys:readonly string[]):void {
  const present=Object.keys(value)
  if(present.length!==keys.length||present.some(key=>!keys.includes(key)))fail('SCHEMA_RECORD_SHAPE')
}
function text(value:unknown,max:number):value is string {
  return typeof value==='string'&&value.length>0&&Buffer.byteLength(value,'utf8')<=max
}
function implementation(value:unknown,compiler=false):asserts value is MvuSchemaImplementationIdentity {
  if(!object(value))fail('SCHEMA_IMPLEMENTATION_INVALID')
  exact(value,compiler?['id','version','implementationSha256','typescriptVersion']:['id','version','implementationSha256'])
  if(typeof value.id!=='string'||!/^[A-Za-z0-9._-]{1,128}$/.test(value.id)
    ||typeof value.version!=='number'||!Number.isSafeInteger(value.version)||value.version<1
    ||!hash(value.implementationSha256)||compiler&&value.typescriptVersion!=='5.9.3')fail('SCHEMA_IMPLEMENTATION_INVALID')
}
function library(value:unknown):asserts value is unknown & MvuSchemaLibraryIdentity {
  if(!object(value))fail('SCHEMA_LIBRARY_INVALID')
  exact(value,['kind','packageName','version','bundleSha256','globalName'])
  if(!['zod','lodash'].includes(String(value.kind))||!text(value.packageName,256)||!text(value.version,128)
    ||!hash(value.bundleSha256)||typeof value.globalName!=='string'||!/^[A-Za-z_$][\w$]{0,127}$/.test(value.globalName)
    ||forbidden.has(value.globalName))fail('SCHEMA_LIBRARY_INVALID')
}
function source(value:unknown):asserts value is unknown & MvuSchemaSourceBinding {
  if(!object(value))fail('SCHEMA_SOURCE_INVALID')
  exact(value,['ownerSessionId','importId','sourceSha256','importRecordSha256','sourceSnapshotSha256','material','materialSha256'])
  if(!text(value.ownerSessionId,256)||!text(value.importId,256)||!hash(value.sourceSha256)
    ||!hash(value.importRecordSha256)||!hash(value.sourceSnapshotSha256)||!hash(value.materialSha256)
    ||!object(value.material)||recordSha256(value.material)!==value.materialSha256)fail('SCHEMA_SOURCE_INVALID')
}
function script(value:unknown,libraries:readonly MvuSchemaLibraryIdentity[],bridge:MvuSchemaImplementationIdentity,
  compiled:boolean):asserts value is unknown & MvuSchemaAuthorScript {
  if(!object(value))fail('SCHEMA_SCRIPT_INVALID')
  exact(value,['identity','pointer','enabled','source','sourceSha256','imports',
    ...(compiled?['javascript','javascriptSha256']:[])])
  if(!text(value.identity,256)||typeof value.pointer!=='string'||Buffer.byteLength(value.pointer,'utf8')>4096
    ||value.pointer!==''&&!value.pointer.startsWith('/')||typeof value.enabled!=='boolean'
    ||typeof value.source!=='string'||Buffer.byteLength(value.source,'utf8')>MVU_SCHEMA_BOUNDS.sourceBytes
    ||!hash(value.sourceSha256)||schemaTextSha256(value.source)!==value.sourceSha256
    ||!Array.isArray(value.imports)||value.imports.length>128)fail('SCHEMA_SCRIPT_INVALID')
  const specifiers=new Set<string>()
  for(const binding of value.imports) {
    if(!object(binding))fail('SCHEMA_IMPORT_INVALID')
    exact(binding,['specifier','kind','implementationSha256'])
    if(!text(binding.specifier,4096)||!['zod','lodash','schema-bridge'].includes(String(binding.kind))
      ||!hash(binding.implementationSha256)||specifiers.has(binding.specifier))fail('SCHEMA_IMPORT_INVALID')
    specifiers.add(binding.specifier)
    const expected=binding.kind==='schema-bridge'?bridge.implementationSha256
      :libraries.find(item=>item.kind===binding.kind)?.bundleSha256
    if(!expected||binding.implementationSha256!==expected)fail('SCHEMA_IMPORT_CLOSURE')
  }
  if(compiled&&(typeof value.javascript!=='string'||!hash(value.javascriptSha256)
    ||schemaTextSha256(value.javascript)!==value.javascriptSha256))fail('SCHEMA_COMPILED_SCRIPT_INVALID')
}

/** Exact metadata validation, kept separate from the compiler's actual replay. */
export function validateSchemaProgram(input:unknown):MvuSchemaProgram {
  const value=cloneSchemaData(input,MVU_SCHEMA_BOUNDS.programBytes)
  if(!object(value))fail('SCHEMA_PROGRAM_INVALID')
  exact(value,['schemaVersion','encoding','compiler','source','scripts','libraries','bridge','programSha256'])
  if(value.schemaVersion!==1||value.encoding!=='native-mvu-author-schema-program-v1'||!hash(value.programSha256)) {
    fail('SCHEMA_PROGRAM_INVALID')
  }
  implementation(value.compiler,true);implementation(value.bridge);source(value.source)
  if(!Array.isArray(value.libraries)||value.libraries.length>2)fail('SCHEMA_LIBRARY_INVALID')
  const kinds=new Set<string>(),globals=new Set<string>()
  const validatedLibraries:MvuSchemaLibraryIdentity[]=[]
  for(const item of value.libraries) {
    library(item)
    if(kinds.has(item.kind)||globals.has(item.globalName))fail('SCHEMA_LIBRARY_DUPLICATE')
    kinds.add(item.kind);globals.add(item.globalName)
    validatedLibraries.push(item)
  }
  if(!Array.isArray(value.scripts)||!value.scripts.length||value.scripts.length>MVU_SCHEMA_BOUNDS.scripts)fail('SCHEMA_SCRIPT_LIMIT')
  const identities=new Set<string>()
  let sourceBytes=0
  for(const item of value.scripts) {
    script(item,validatedLibraries,value.bridge,true)
    if(identities.has(item.identity))fail('SCHEMA_SCRIPT_DUPLICATE')
    identities.add(item.identity)
    sourceBytes+=Buffer.byteLength(item.source,'utf8')
    if(sourceBytes>MVU_SCHEMA_BOUNDS.sourceBytes)fail('SCHEMA_SOURCE_LIMIT')
  }
  const {programSha256,...descriptor}=value
  if(recordSha256(descriptor)!==programSha256)fail('SCHEMA_PROGRAM_HASH')
  return value as unknown as MvuSchemaProgram
}
