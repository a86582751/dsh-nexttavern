/** Cleanup records come from one normalized operation and its actual basis.
 * They never infer deletion from schema output or manufacture RFC pointers for
 * selector keys: a legal legacy selector can exceed the RFC path budget. */
import {recordSha256} from './roleplay-data.js'
import {MVU_UPDATE_BOUNDS as B} from './roleplay-mvu-update.js'
import {reduceMvuUpdateOperationsV2} from './roleplay-mvu-update-v2.js'
import {cloneSchemaData,cloneSchemaValues} from './tavern-mvu-schema-data.js'
import type {MvuUpdateOperationV2} from './roleplay-mvu-update-v2.js'
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'

export type MvuSchemaCleanupEffectV2=
  | {kind:'replace-root'}
  | {kind:'remove-member';parent:readonly string[];collection:'object';key:string}
  | {kind:'remove-member';parent:readonly string[];collection:'array';index:number}
  | null
export type MvuSchemaReducedOperationV2=
  | {kind:'prepared';values:MvuJsonObject;cleanupEffect:MvuSchemaCleanupEffectV2}
  | {kind:'rejected';code:string;pointer?:string}

const knownRejectionCodes=new Set([
  'OPERATION_SHAPE','OPERATION_UNSUPPORTED','OPERATION_KIND_UNSUPPORTED','OPERATION_KIND_MISMATCH',
  'LEGACY_COMMAND_SHAPE','LEGACY_COMMAND_UNSUPPORTED','LEGACY_ARGUMENT_COUNT','LEGACY_PATH_FORMAT',
  'PATH_BYTE_LIMIT','PATH_DEPTH_LIMIT','POINTER_FORMAT','POINTER_DEPTH_LIMIT','POINTER_ESCAPE',
  'PROTOTYPE_KEY','PATCH_ARRAY_REQUIRED','OPERATION_LIMIT','ARRAY_LIMIT','ARRAY_PROPERTY','ARRAY_INDEX',
  'PATH_MISSING','ROOT_REMOVE_UNSUPPORTED','ROOT_OBJECT_REQUIRED','MOVE_INTO_DESCENDANT','TEST_FAILED',
  'DATA_NODE_LIMIT','DATA_DEPTH_LIMIT','DATA_BYTE_LIMIT','NUMBER_LIMIT','NON_JSON_VALUE','CYCLIC_VALUE',
  'OBJECT_PROTOTYPE','ADD_TARGET_NOT_NUMBER','ADD_DELTA_NOT_NUMBER','INSERT_TARGET_NOT_COLLECTION',
  'MERGE_VALUE_NOT_OBJECT','MERGE_TYPE_UNSUPPORTED','OBJECT_KEY_TYPE','OBJECT_INDEX_UNSUPPORTED',
  'DELETE_TARGET_MISSING','DELETE_TARGET_NOT_COLLECTION',
])
export const isKnownSchemaUpdateRejectionV2=(code:unknown):code is string=>
  typeof code==='string'&&knownRejectionCodes.has(code)
const object=(value:unknown):value is MvuJsonObject=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const forbidden=new Set(['__proto__','constructor','prototype'])
function fail():never {throw Error('SCHEMA_UPDATE_INPUT_INVALID')}
function exact(value:object,fields:readonly string[]):void {
  const names=Object.keys(value)
  if(names.length!==fields.length||names.some(name=>!fields.includes(name)))fail()
}
function pathParts(raw:unknown):string[] {
  if(!Array.isArray(raw)||raw.length>B.pathDepth||raw.some(key=>typeof key!=='string'||forbidden.has(key)))fail()
  if(Buffer.byteLength(raw.join('.'),'utf8')>B.pathBytes)fail()
  return raw as string[]
}
function pointer(raw:unknown):string[] {
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>B.pathBytes||raw!==''&&!raw.startsWith('/'))fail()
  if(raw==='')return []
  const parts=raw.slice(1).split('/')
  if(parts.length>B.pathDepth)fail()
  const decoded=parts.map(key=>{
    if(/~(?:[^01]|$)/.test(key))fail()
    return key.replace(/~1/g,'/').replace(/~0/g,'~')
  })
  return pathParts(decoded)
}
function valueData(raw:unknown):void {
  cloneSchemaData(raw,B.dataBytes,{depth:B.dataDepth,nodes:B.nodes})
}

/** Shape-only validation must not apply operations to the initial basis.
 * A missing path is a completed reducer refusal at its actual command phase. */
export function validateSchemaUpdateCommandsV2(raw:unknown):MvuUpdateOperationV2[] {
  const commands=cloneSchemaData(raw,B.dataBytes,{depth:B.dataDepth+4,nodes:B.nodes})
  if(!Array.isArray(commands)||commands.length>B.operations)fail()
  for(const wrapper of commands) {
    if(!object(wrapper))fail()
    if(wrapper.kind==='jsonpatch') {
      exact(wrapper,['kind','operation'])
      const op=wrapper.operation
      if(!object(op)||typeof op.op!=='string'||!['test','replace','add','remove','copy','move'].includes(op.op))fail()
      exact(op,op.op==='copy'||op.op==='move'?['op','path','from']:
        op.op==='remove'?['op','path']:['op','path','value'])
      pointer(op.path)
      if(op.op==='copy'||op.op==='move')pointer(op.from)
      else if(op.op!=='remove')valueData(op.value)
    } else if(wrapper.kind==='legacy') {
      exact(wrapper,['kind','command'])
      const command=wrapper.command
      if(!object(command)||!['set','add','insert','delete'].includes(command.type as string))fail()
      exact(command,command.type==='add'?['type','path','delta']:['type','path','args'])
      pathParts(command.path)
      if(command.type==='add')valueData(command.delta)
      else {
        if(!Array.isArray(command.args)||command.args.length>B.arrayLength
          ||command.type!=='delete'&&!command.args.length)fail()
        for(const argument of command.args)valueData(argument)
      }
    } else fail()
  }
  return commands as MvuUpdateOperationV2[]
}
function arrayIndex(key:string,length:number):number {
  if(!/^(0|[1-9]\d*)$/.test(key))fail()
  const index=Number(key)
  if(!Number.isSafeInteger(index)||index>=length)fail()
  return index
}
function read(root:MvuJsonObject,path:readonly string[]):MvuJsonValue {
  let current:MvuJsonValue=root
  for(const key of path) {
    if(Array.isArray(current))current=current[arrayIndex(key,current.length)]!
    else if(object(current)&&Object.hasOwn(current,key))current=current[key]!
    else fail()
  }
  return current
}
function memberEffect(before:MvuJsonObject,path:readonly string[]):MvuSchemaCleanupEffectV2 {
  if(!path.length)fail()
  const parent=path.slice(0,-1),container=read(before,parent),key=path.at(-1)!
  if(Array.isArray(container))return {kind:'remove-member',parent,collection:'array',index:arrayIndex(key,container.length)}
  if(!object(container)||!Object.hasOwn(container,key))fail()
  return {kind:'remove-member',parent,collection:'object',key}
}
function cleanupEffect(before:MvuJsonObject,operation:MvuUpdateOperationV2):MvuSchemaCleanupEffectV2 {
  if(operation.kind==='jsonpatch') {
    const op=operation.operation
    if(op.op==='remove')return memberEffect(before,pointer(op.path))
    if(op.op==='move'&&op.from!==op.path)return memberEffect(before,pointer(op.from))
    return null
  }
  const command=operation.command
  if(command.type==='set'&&!command.path.length)return {kind:'replace-root'}
  if(command.type!=='delete')return null
  if(!command.args.length)return memberEffect(before,command.path)
  const container=read(before,command.path),selector=command.args[0]!
  if(Array.isArray(container)) {
    const selected=typeof selector==='number'?selector:
      container.findIndex(item=>recordSha256(item)===recordSha256(selector))
    // The reducer checks the fractional value before JS splice truncates it.
    if(selected<0||selected>=container.length)fail()
    return {kind:'remove-member',parent:[...command.path],collection:'array',index:Math.trunc(selected)}
  }
  if(!object(container)||typeof selector!=='string'||!Object.hasOwn(container,selector))fail()
  return {kind:'remove-member',parent:[...command.path],collection:'object',key:selector}
}

export function reduceSchemaUpdateOperationV2(before:MvuJsonObject,operation:MvuUpdateOperationV2):MvuSchemaReducedOperationV2 {
  const basis=cloneSchemaValues(before)
  const reduced=reduceMvuUpdateOperationsV2(basis,[operation])
  if(reduced.kind==='rejected') {
    if(!isKnownSchemaUpdateRejectionV2(reduced.code))throw Error('SCHEMA_UPDATE_INPUT_UNKNOWN')
    return {kind:'rejected',code:reduced.code,...(reduced.pointer!==undefined?{pointer:reduced.pointer}:{})}
  }
  const normalized=reduced.operations[0]
  if(!normalized||reduced.operations.length!==1)fail()
  return {kind:'prepared',values:cloneSchemaValues(reduced.values),cleanupEffect:cleanupEffect(basis,normalized)}
}

export function mergeSchemaUpdateValuesV2(before:MvuJsonObject,reduced:MvuJsonObject,
  parsed:MvuJsonObject,effect:MvuSchemaCleanupEffectV2):MvuJsonObject {
  const original=cloneSchemaValues(before),next=cloneSchemaValues(reduced),validated=cloneSchemaValues(parsed)
  const cleanup=cloneSchemaData(effect,B.dataBytes,{depth:B.pathDepth+2,nodes:B.nodes})
  let merged=original
  if(cleanup?.kind==='replace-root') {
    exact(cleanup,['kind']);merged=next
  } else if(cleanup!==null) {
    if(cleanup.kind!=='remove-member')fail()
    exact(cleanup,cleanup.collection==='object'?['kind','parent','collection','key']:['kind','parent','collection','index'])
    const parent=pathParts(cleanup.parent)
    const topRoot=parent[0]??(cleanup.collection==='object'?cleanup.key:undefined)
    if(typeof topRoot!=='string')fail()
    if(cleanup.collection==='object') {
      if(typeof cleanup.key!=='string'||forbidden.has(cleanup.key))fail()
    } else if(cleanup.collection!=='array'||!Number.isSafeInteger(cleanup.index)||cleanup.index<0)fail()
    // An own top-level field from schema is authoritative, including defaults.
    // Cleanup only affects inherited basis, once, before the shallow overlay.
    if(!Object.hasOwn(validated,topRoot)) {
      const container=read(merged,parent)
      if(cleanup.collection==='object') {
        if(!object(container)||!Object.hasOwn(container,cleanup.key))fail()
        delete container[cleanup.key]
      } else {
        if(!Array.isArray(container)||cleanup.index>=container.length)fail()
        container.splice(cleanup.index,1)
      }
    }
  }
  for(const name of Object.keys(validated))merged[name]=validated[name]!
  return cloneSchemaValues(merged)
}
