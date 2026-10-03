/** Pure reads of sealed input. Hash checks cannot grant a Source/Native lease;
 * Core must prove the referenced state and cut before admitting this frame. */
import {types} from 'node:util'
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaData} from './tavern-mvu-schema-data.js'
import {MVU_SCOPE_READ_LIMITS as limits} from './tavern-mvu-scope-read-types.js'
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-json-types-v3.js'
import type {MvuScopeReadFrameV1,MvuScopeReaderV1,MvuScopeVariablesV1,
  MvuScopeSourceIdentityV1,MvuVariableScope,MvuVariableReadOption} from './tavern-mvu-scope-read-types.js'

export const MVU_SCOPE_READ_ERRORS=Object.freeze({
  frame:'SCOPE_READ_FRAME_INVALID',hash:'SCOPE_READ_HASH_MISMATCH',owner:'SCOPE_READ_OWNER_MISMATCH',
  state:'SCOPE_READ_STATE_INVALID',request:'SCOPE_READ_REQUEST_INVALID',script:'SCOPE_READ_SCRIPT_UNAVAILABLE',
  index:'SCOPE_READ_MESSAGE_INDEX_OUT_OF_RANGE',path:'SCOPE_READ_PATH_INVALID',
})
export class MvuScopeReadError extends Error {
  constructor(readonly code:string) {super(code);this.name='MvuScopeReadError'}
}
function fail(code:string):never {throw new MvuScopeReadError(code)}
const forbidden=new Set(['__proto__','constructor','prototype'])
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const text=(value:unknown,max=256)=>typeof value==='string'&&value.length>0&&Buffer.byteLength(value,'utf8')<=max
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const own=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key)
function exact(value:unknown,keys:readonly string[],code:string=MVU_SCOPE_READ_ERRORS.frame):void {
  if(!object(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key)))fail(code)
}
function freeze<T>(value:T):T {
  if(value!==null&&typeof value==='object') {
    for(const child of Object.values(value))freeze(child)
    Object.freeze(value)
  }
  return value
}
function clone<T>(value:T):T {
  try {return cloneSchemaData(value,limits.frameBytes,{nodes:limits.valueNodes,depth:limits.valueDepth})}
  catch(error) {
    const code=error instanceof Error&&/^SCHEMA_[A-Z_]+$/.test(error.message)?error.message:'SCOPE_READ_FRAME_INVALID'
    return fail(code)
  }
}
function variables(value:MvuScopeVariablesV1,source:MvuScopeSourceIdentityV1,
  scope:MvuVariableScope,identity:string,ownerSessionId=source.sessionId,stateOwner?:string):void {
  if(!object(value))fail(MVU_SCOPE_READ_ERRORS.state)
  if(value.kind==='unavailable') {
    exact(value,['kind','code'])
    if(!['SCOPE_SOURCE_UNAVAILABLE','MESSAGE_STATE_UNAVAILABLE'].includes(value.code))fail(MVU_SCOPE_READ_ERRORS.state)
    return
  }
  exact(value,['kind','variables','variablesSha256','provenance'])
  if(value.kind!=='available'||!object(value.variables)||!hash(value.variablesSha256)
    ||recordSha256(value.variables)!==value.variablesSha256)fail(MVU_SCOPE_READ_ERRORS.hash)
  const provenance=value.provenance
  if(!object(provenance))fail(MVU_SCOPE_READ_ERRORS.state)
  const owner=provenance.owner
  exact(owner,['namespace','sessionId','sourceRecordSessionId','importId','scope','identity'])
  if(owner.namespace!=='session-source'||owner.sessionId!==ownerSessionId
    ||owner.sourceRecordSessionId!==source.sourceRecordSessionId||owner.importId!==source.importId
    ||owner.scope!==scope||owner.identity!==identity) {
    fail(MVU_SCOPE_READ_ERRORS.owner)
  }
  if(provenance.kind==='initialized-empty') {
    exact(provenance,['kind','owner','revision'])
    if(provenance.revision!==0||Object.keys(value.variables).length!==0)fail(MVU_SCOPE_READ_ERRORS.state)
  } else if(provenance.kind==='initialization-baseline') {
    exact(provenance,['kind','owner','initialization'])
    const initial=provenance.initialization
    exact(initial,['ownerSessionId','operationId','preparationSha256','initSourceSha256','sourceSnapshotSha256',
      'freshBasisProofSha256','initialSourceNativeCutSha256','policySha256','configurationSha256','baselineSha256','valuesSha256'])
    if(scope!=='chat'||!text(initial.ownerSessionId)||!text(initial.operationId)
      ||Object.entries(initial).some(([key,field])=>!['ownerSessionId','operationId'].includes(key)&&!hash(field))
      ||!object(value.variables.stat_data)||recordSha256(value.variables.stat_data)!==initial.valuesSha256) {
      fail(MVU_SCOPE_READ_ERRORS.state)
    }
  } else if(provenance.kind==='published-state') {
    exact(provenance,['kind','owner','state'])
    const state=provenance.state
    exact(state,['kind','ownerSessionId','recordKey','recordSha256','snapshotSha256','valuesSha256','revision'])
    if(!['opening','story','manual','inherited'].includes(state.kind)||!text(state.ownerSessionId)
      ||stateOwner!==undefined&&state.ownerSessionId!==stateOwner
      ||!text(state.recordKey,4096)||!hash(state.recordSha256)||!hash(state.snapshotSha256)||!hash(state.valuesSha256)
      ||!Number.isSafeInteger(state.revision)||state.revision<1||!object(value.variables.stat_data)
      ||recordSha256(value.variables.stat_data)!==state.valuesSha256)fail(MVU_SCOPE_READ_ERRORS.state)
  } else fail(MVU_SCOPE_READ_ERRORS.state)
}

export function validateMvuScopeReadFrameV1(input:unknown):MvuScopeReadFrameV1 {
  const frame=clone(input) as MvuScopeReadFrameV1
  exact(frame,['schemaVersion','encoding','source','sourceNativeCutSha256','viewKind','scopes','scripts','messages','frameSha256'])
  if(frame.schemaVersion!==1||frame.encoding!=='native-mvu-scope-read-frame-v1'||frame.viewKind!=='script'
    ||!hash(frame.sourceNativeCutSha256)||!hash(frame.frameSha256))fail(MVU_SCOPE_READ_ERRORS.frame)
  const source=frame.source
  exact(source,['sessionId','sourceRecordSessionId','importId','rawSha256','sourceSnapshotSha256'])
  if(!text(source.sessionId)||!text(source.sourceRecordSessionId)||!text(source.importId)
    ||!hash(source.rawSha256)||!hash(source.sourceSnapshotSha256))fail(MVU_SCOPE_READ_ERRORS.frame)
  exact(frame.scopes,['chat','character','global'])
  for(const scope of ['chat','character','global'] as const)variables(frame.scopes[scope],source,scope,scope)
  if(!Array.isArray(frame.scripts)||frame.scripts.length>limits.scripts
    ||!Array.isArray(frame.messages)||frame.messages.length>limits.messages)fail(MVU_SCOPE_READ_ERRORS.frame)
  const scriptIds=new Set<string>(),pointers=new Set<string>()
  for(const script of frame.scripts) {
    exact(script,['scriptId','pointer','sourceSha256','variables'])
    if(!text(script.scriptId)||typeof script.pointer!=='string'||Buffer.byteLength(script.pointer,'utf8')>4096
      ||script.pointer!==''&&!script.pointer.startsWith('/')||!hash(script.sourceSha256)
      ||scriptIds.has(script.scriptId)||pointers.has(script.pointer))fail(MVU_SCOPE_READ_ERRORS.frame)
    scriptIds.add(script.scriptId);pointers.add(script.pointer)
    variables(script.variables,source,'script',script.scriptId)
  }
  const nativeMessages=new Set<string>()
  for(const [position,message] of frame.messages.entries()) {
    exact(message,['position','ownerSessionId','nativeSeq','messageId','messageVersionSha256','selectedVariant','isSystem','variables'])
    if(message.position!==position||!text(message.ownerSessionId)||!Number.isSafeInteger(message.nativeSeq)
      ||message.nativeSeq<0||!text(message.messageId)||nativeMessages.has(JSON.stringify([message.ownerSessionId,message.nativeSeq]))
      ||!hash(message.messageVersionSha256)||!text(message.selectedVariant)||typeof message.isSystem!=='boolean') {
      fail(MVU_SCOPE_READ_ERRORS.frame)
    }
    nativeMessages.add(JSON.stringify([message.ownerSessionId,message.nativeSeq]))
    variables(message.variables,source,'message',message.messageId,message.ownerSessionId,message.ownerSessionId)
  }
  const {frameSha256,...body}=frame
  if(recordSha256(body)!==frameSha256)fail(MVU_SCOPE_READ_ERRORS.hash)
  return freeze(frame)
}

/** Validate requests without evaluating accessors or invoking Proxy traps.
 * Undefined option fields follow the host defaults; persisted frames remain JSON. */
function request(input:unknown):Record<string,unknown> {
  if(input===null||typeof input!=='object'||types.isProxy(input)||Array.isArray(input))fail(MVU_SCOPE_READ_ERRORS.request)
  const prototype=Object.getPrototypeOf(input)
  if(prototype!==Object.prototype&&prototype!==null||Object.getOwnPropertySymbols(input).length)fail(MVU_SCOPE_READ_ERRORS.request)
  const names=Object.getOwnPropertyNames(input)
  if(names.length>3)fail(MVU_SCOPE_READ_ERRORS.request)
  const descriptors=Object.getOwnPropertyDescriptors(input),result:Record<string,unknown>={}
  for(const key of names) {
    const descriptor=descriptors[key]!
    if(forbidden.has(key)||!own(descriptor,'value')||!descriptor.enumerable)fail(MVU_SCOPE_READ_ERRORS.request)
    result[key]=descriptor.value
  }
  return result
}
function available(table:MvuScopeVariablesV1):MvuJsonObject {
  if(table.kind==='unavailable')fail(table.code)
  return freeze(clone(table.variables))
}
export function createMvuScopeReaderV1(input:unknown,currentScriptId:string):MvuScopeReaderV1 {
  const frame=validateMvuScopeReadFrameV1(input)
  const script=frame.scripts.find(item=>item.scriptId===currentScriptId)
  if(!script)fail(MVU_SCOPE_READ_ERRORS.script)
  function getVariables(option?:MvuVariableReadOption):MvuJsonObject|undefined {
    const selected:Record<string,unknown>=option===undefined?{type:'chat'}:request(option)
    if(selected.type===undefined) {
      if(Object.keys(selected).some(key=>key!=='type'))fail(MVU_SCOPE_READ_ERRORS.request)
      return undefined
    }
    if(typeof selected.type==='string'&&['chat','character','global'].includes(selected.type)) {
      exact(selected,['type'],MVU_SCOPE_READ_ERRORS.request)
      return available(frame.scopes[selected.type as 'chat'|'character'|'global'])
    }
    if(selected.type==='script') {
      if(Object.keys(selected).some(key=>!['type','script_id'].includes(key))
        ||selected.script_id!==undefined&&selected.script_id!==currentScriptId)fail(MVU_SCOPE_READ_ERRORS.request)
      return available(script!.variables)
    }
    if(selected.type!=='message'||Object.keys(selected).some(key=>!['type','message_id'].includes(key))) {
      fail(MVU_SCOPE_READ_ERRORS.request)
    }
    const id=selected.message_id
    if(id===undefined||id==='latest') {
      const message=frame.messages.findLast(item=>!item.isSystem)
      if(!message)fail('MESSAGE_STATE_UNAVAILABLE')
      return available(message.variables)
    }
    if(typeof id!=='number'||!Number.isSafeInteger(id))fail(MVU_SCOPE_READ_ERRORS.request)
    const position=id<0?frame.messages.length+id:id
    if(position<0||position>=frame.messages.length)fail(MVU_SCOPE_READ_ERRORS.index)
    return available(frame.messages[position]!.variables)
  }
  function getAllVariables():MvuJsonObject {
    // This frame grants only a script view. Message iframe precedence needs its
    // own owner and cannot be inferred from a caller-supplied message index.
    return freeze(Object.assign({},available(frame.scopes.global),available(frame.scopes.character),
      available(script!.variables),available(frame.scopes.chat)))
  }
  return Object.freeze({getVariables,getAllVariables})
}

/** Safe own-property equivalent of the supported lodash dot/bracket path
 * syntax. A literal top-level key wins before parsing, as in lodash.get. */
function pathParts(path:string):string[] {
  if(Buffer.byteLength(path,'utf8')>4096)fail(MVU_SCOPE_READ_ERRORS.path)
  const parts:string[]=[]
  if(path.startsWith('.'))parts.push('')
  const pattern=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g
  path.replace(pattern,(match,numeric:string|undefined,quote:string|undefined,quoted:string|undefined)=>{
    parts.push(quote?quoted!.replace(/\\(\\)?/g,'$1'):numeric??match)
    return match
  })
  if(parts.length>limits.valueDepth||parts.some(part=>forbidden.has(part)))fail(MVU_SCOPE_READ_ERRORS.path)
  return parts
}
export interface MvuVariableReadOptionsV1 {category?:'stat'|'display'|'delta';default_value?:MvuJsonValue}
export function readMvuVariable(data:unknown,path:string,options:MvuVariableReadOptionsV1={}):MvuJsonValue|undefined {
  if(typeof path!=='string')fail(MVU_SCOPE_READ_ERRORS.path)
  const selected=request(options)
  if(Object.keys(selected).some(key=>!['category','default_value'].includes(key)))fail(MVU_SCOPE_READ_ERRORS.request)
  const category=selected.category===undefined?'stat':selected.category
  if(typeof category!=='string'||!['stat','display','delta'].includes(category))fail(MVU_SCOPE_READ_ERRORS.request)
  const copied=clone(data)
  if(!object(copied))fail(MVU_SCOPE_READ_ERRORS.request)
  const root=copied[`${category}_data`]
  const parts=pathParts(path)
  let value:unknown=root
  if(object(root)&&own(root,path)&&!forbidden.has(path))value=root[path]
  else {
    if(!parts.length)value=undefined
    for(const part of parts) {
      if(value===null||typeof value!=='object'||!own(value,part)){value=undefined;break}
      value=(value as Record<string,unknown>)[part]
    }
  }
  if(value===undefined)value=selected.default_value===undefined?undefined:clone(selected.default_value)
  if(Array.isArray(value)&&value.length===2&&typeof value[1]==='string')value=value[0]
  return value===undefined?undefined:freeze(value as MvuJsonValue)
}
