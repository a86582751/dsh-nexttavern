/** Immutable scope objects are execution inputs, never another numerical head.
 * Source/publication owners call this store inside their existing boundary. */
import {createMvuScopeValueV2,createMvuScopeBaseV2,createMvuScopeDeltaV2,createMvuScopeReadRefV2,
  scopeObjectRefV2,createMvuScopeViewResolverV2,validateMvuScopeReadRefV2,validateMvuScopeObjectV2}
  from './tavern-mvu-scope-view-v2.js'
import type {MvuScopeObjectRefV2,MvuScopeObjectV2,MvuScopeReadObjectV2,MvuScopeReadRefV2,
  MvuScopeScriptRefV2,MvuScopeMessageRefV2,MvuScopeChangeV2} from './tavern-mvu-scope-view-v2.js'
import {validateSchemaScopeProgramViewV2} from './tavern-mvu-schema-runner-v4.js'
import type {MvuExecutableProgramV4} from './tavern-mvu-owned-state-types-v1.mjs'
import type {MvuScopeSourceIdentityV1,MvuScopeVariablesV1,MvuScopedScriptV1,MvuScopeReadMessageV2,
  MvuVariableScope} from './tavern-mvu-scope-read-types.js'
import type {RoleplayInputStateOwner} from './roleplay-input-state.js'

interface ScopeTable {
  get(key:string):unknown
  put(key:string,value:unknown):Promise<unknown>
}
type ScopeName='chat'|'character'|'global'
interface ScopeBinding {ownerSessionId:string;sourceNativeCutSha256:string;sourceSnapshotSha256:string;realmEpoch:string}
interface ScopeReadData {
  reference:MvuScopeReadRefV2
  programSha256:string
  source:MvuScopeSourceIdentityV1
  scripts:readonly Pick<MvuScopedScriptV1,'scriptId'|'pointer'|'sourceSha256'>[]
  realmEpoch:string
}
type ScopeFact=ReturnType<RoleplayInputStateOwner['captureClosedData']>&{data:ScopeReadData}
export interface MvuScopePublicationInputV2 {
  source:MvuScopeSourceIdentityV1
  scopes:Readonly<Record<ScopeName,MvuScopeVariablesV1>>
  scripts:readonly MvuScopedScriptV1[]
  messages:readonly MvuScopeReadMessageV2[]
}
export type MvuScopePublicationChangeV2=
  | {kind:'scope';scope:ScopeName;value:MvuScopeVariablesV1}
  | {kind:'script-upsert';script:MvuScopedScriptV1}
  | {kind:'script-delete';scriptId:string}
  | {kind:'message-splice';index:number;deleteCount:number;messages:readonly MvuScopeReadMessageV2[]}
const objectKey=(sid:string,sha256:string)=>`${sid}__mvu-scope-object-v2-${sha256}`
const refKey=(ref:MvuScopeObjectRefV2)=>JSON.stringify([ref.ownerSessionId,ref.key,ref.sha256])
const sameSource=(a:MvuScopeSourceIdentityV1,b:MvuScopeSourceIdentityV1)=>a.sessionId===b.sessionId
  &&a.sourceRecordSessionId===b.sourceRecordSessionId&&a.importId===b.importId&&a.rawSha256===b.rawSha256
  &&a.sourceSnapshotSha256===b.sourceSnapshotSha256
function fail(code:string):never {throw Error(code)}
export interface RoleplayMvuScopeReaderV2 {
  readScopeReferences(program:MvuExecutableProgramV4,reference:MvuScopeReadRefV2,binding:ScopeBinding,load:boolean):void
  readObject(ref:MvuScopeObjectRefV2):unknown
  dispose():void
}

export function createRoleplayMvuScopeStoreV2(deps:{table:ScopeTable;inputState:RoleplayInputStateOwner}) {
  let disposed=false
  const readers=new Set<RoleplayMvuScopeReaderV2>()
  const bindingsOwners=new Set<ReturnType<typeof bindings>>()
  function readObject(ref:MvuScopeObjectRefV2,table:Pick<ScopeTable,'get'>=deps.table):unknown {
    if(disposed)fail('SCOPE_VIEW_STORE_DISPOSED')
    if(ref.key!==objectKey(ref.ownerSessionId,ref.sha256))fail('SCOPE_VIEW_OBJECT_ADDRESS_MISMATCH')
    return table.get(ref.key)
  }
  async function writeObject(ownerSessionId:string,object:MvuScopeObjectV2,check:()=>void):Promise<MvuScopeObjectRefV2> {
    check()
    // The codec's own immutable object retains its already-computed complete
    // DATA hash. Key derivation does not hash the same object a second time.
    const sha256=scopeObjectRefV2(ownerSessionId,'scope-object-key',object).sha256,
      key=objectKey(ownerSessionId,sha256),wanted=scopeObjectRefV2(ownerSessionId,key,object)
    const exact=(actual:unknown)=>{
      return actual!==undefined&&scopeObjectRefV2(ownerSessionId,key,actual as MvuScopeObjectV2).sha256===sha256
    }
    const prior=readObject(wanted)
    if(prior!==undefined) {
      if(!exact(prior))fail('SCOPE_VIEW_OBJECT_WRITE_CONFLICT')
      check();return wanted
    }
    try {await deps.table.put(key,object)}catch { /* A lost ACK is settled by exact actual readback. */ }
    check()
    if(!exact(readObject(wanted)))fail('SCOPE_VIEW_OBJECT_WRITE_UNKNOWN')
    return wanted
  }
  function reader(table:Pick<ScopeTable,'get'>=deps.table):RoleplayMvuScopeReaderV2 {
    let closed=false
    let resolver=createMvuScopeViewResolverV2({read:ref=>readObject(ref,table)}),dirty=false
    const facts=new Map<string,ScopeFact>()
    let previous:ScopeFact|undefined
    function readScopeReferences(program:MvuExecutableProgramV4,reference:MvuScopeReadRefV2,
      binding:ScopeBinding,load:boolean):void {
      if(closed||disposed)fail('SCOPE_VIEW_STORE_DISPOSED')
      reference=validateMvuScopeReadRefV2(reference)
      if(reference.sourceNativeCutSha256!==binding.sourceNativeCutSha256)fail('SCHEMA_SCOPE_BINDING_MISMATCH')
      if(dirty) {
        for(const fact of facts.values())fact.dispose()
        facts.clear();previous=undefined
        resolver=createMvuScopeViewResolverV2({read:ref=>readObject(ref,table)});dirty=false
      }
      const known=facts.get(reference.viewSha256)
      if(known) {
        const data=known.use() as ScopeReadData
        if(data.programSha256!==program.programSha256||data.realmEpoch!==binding.realmEpoch
          ||data.source.sourceSnapshotSha256!==binding.sourceSnapshotSha256)fail('SCHEMA_SCOPE_BINDING_MISMATCH')
        // This finite metadata belongs to the old exact view, rather than the
        // resolver's later mutable current position during historical reads.
        validateSchemaScopeProgramViewV2(program,{source:data.source},data.scripts,binding,load)
        return
      }
      const fact=deps.inputState.captureClosedData(binding.ownerSessionId,()=>{
        previous?.use()
        const resolved=resolver.resolve(reference)
        if(resolved.realmEpoch!==binding.realmEpoch
          ||resolved.view.source.sourceSnapshotSha256!==binding.sourceSnapshotSha256)fail('SCHEMA_SCOPE_BINDING_MISMATCH')
        validateSchemaScopeProgramViewV2(program,resolved.view,resolved.scripts(),binding,load)
        const source=Object.freeze({...resolved.view.source}),
          scripts=Object.freeze([...resolved.scripts()].map(({scriptId,pointer,sourceSha256})=>
            Object.freeze({scriptId,pointer,sourceSha256})))
        return Object.freeze({reference,programSha256:program.programSha256,source,scripts,realmEpoch:resolved.realmEpoch})
      }) as ScopeFact
      fact.onInvalidated(()=>{dirty=true})
      facts.set(reference.viewSha256,fact);previous=fact
      fact.use()
    }
    const result={readScopeReferences,readObject:(ref:MvuScopeObjectRefV2)=>readObject(ref,table),
      dispose(){
        if(closed)return
        closed=true
        for(const fact of facts.values())fact.dispose()
        facts.clear();previous=undefined;readers.delete(result)
      }}
    readers.add(result)
    return result
  }
  /** Frozen/export selection walks original phase order once. A fresh closed
   * resolver records every required object, even if a live reader knows it. */
  function captureScopeObjects(references:Iterable<MvuScopeReadRefV2>,table:Pick<ScopeTable,'get'>=deps.table)
    :readonly MvuScopeReadObjectV2[] {
    const objects=new Map<string,MvuScopeReadObjectV2>(),pending:MvuScopeObjectRefV2[]=[]
    for(const reference of references) {
      pending.push(reference.baseRef,reference.tailRef)
    }
    while(pending.length) {
      const reference=pending.pop()!,key=refKey(reference)
      if(objects.has(key))continue
      const raw=readObject(reference,table)
      if(raw===undefined)fail('SCOPE_VIEW_OBJECT_MISSING')
      const object=validateMvuScopeObjectV2(raw)
      if(scopeObjectRefV2(reference.ownerSessionId,reference.key,object).sha256!==reference.sha256) {
        fail('SCOPE_VIEW_OBJECT_HASH_MISMATCH')
      }
      objects.set(key,Object.freeze({ref:reference,object}))
      if(object.encoding==='native-mvu-scope-base-v2') {
        pending.push(...Object.values(object.scopes),...object.scripts.map(item=>item.valueRef),
          ...object.messages.map(item=>item.valueRef))
      }else if(object.encoding==='native-mvu-scope-delta-v2') {
        pending.push(object.baseRef,object.previousRef)
        for(const change of object.changes) {
          if(change.kind==='scope')pending.push(change.valueRef)
          else if(change.kind==='script-upsert')pending.push(change.script.valueRef)
          else if(change.kind==='message-splice')for(const message of change.messages)pending.push(message.valueRef)
        }
      }
    }
    return Object.freeze([...objects.values()])
  }
  function bindings(table:Pick<ScopeTable,'get'>=deps.table):{
    readScopeReferences:RoleplayMvuScopeReaderV2['readScopeReferences']
    captureScopeObjects(references:Iterable<MvuScopeReadRefV2>):readonly MvuScopeReadObjectV2[]
    readObject(ref:MvuScopeObjectRefV2):unknown
    releaseSession(sessionId:string):void
    dispose():void
  } {
    const byBase=new Map<string,{sessionId:string;reader:RoleplayMvuScopeReaderV2}>()
    const result={readScopeReferences(program:MvuExecutableProgramV4,reference:MvuScopeReadRefV2,
      binding:ScopeBinding,load:boolean) {
      const key=refKey(reference.baseRef)
      let entry=byBase.get(key)
      if(!entry)byBase.set(key,entry={sessionId:binding.ownerSessionId,reader:reader(table)})
      entry.reader.readScopeReferences(program,reference,binding,load)
    },captureScopeObjects:(references:Iterable<MvuScopeReadRefV2>)=>captureScopeObjects(references,table),
    readObject:(ref:MvuScopeObjectRefV2)=>readObject(ref,table),
    releaseSession(sessionId:string) {
      for(const [key,entry] of byBase)if(entry.sessionId===sessionId) {entry.reader.dispose();byBase.delete(key)}
    },dispose(){for(const entry of byBase.values())entry.reader.dispose();byBase.clear();bindingsOwners.delete(result)}}
    bindingsOwners.add(result)
    return result
  }
  function publisher(input:{ownerSessionId:string;realmEpoch:string;check():void}) {
    let baseRef:MvuScopeObjectRefV2|undefined,tailRef:MvuScopeObjectRefV2|undefined,
      source:MvuScopeSourceIdentityV1|undefined,closed=false
    const resolver=createMvuScopeViewResolverV2({read:ref=>readObject(ref)})
    const current=()=>{if(closed||disposed)fail('SCOPE_VIEW_STORE_DISPOSED');input.check()}
    function resume(reference:MvuScopeReadRefV2) {
      current()
      if(baseRef)fail('SCOPE_VIEW_BASE_ALREADY_CREATED')
      reference=validateMvuScopeReadRefV2(reference)
      const resolved=resolver.resolve(reference)
      if(resolved.realmEpoch!==input.realmEpoch||resolved.view.source.sessionId!==input.ownerSessionId) {
        fail('SCHEMA_SCOPE_BINDING_MISMATCH')
      }
      current()
      baseRef=reference.baseRef;tailRef=reference.tailRef;source=resolved.view.source
      return resolved
    }
    async function valueRef(nextSource:MvuScopeSourceIdentityV1,scope:MvuVariableScope,identity:string,
      ownerSessionId:string,value:MvuScopeVariablesV1):Promise<MvuScopeObjectRefV2> {
      return writeObject(input.ownerSessionId,createMvuScopeValueV2({binding:{source:nextSource,scope,identity,ownerSessionId,
        stateOwner:scope==='message'?ownerSessionId:null},value}),current)
    }
    async function script(nextSource:MvuScopeSourceIdentityV1,item:MvuScopedScriptV1):Promise<MvuScopeScriptRefV2> {
      const {variables,...metadata}=item
      return {...metadata,valueRef:await valueRef(nextSource,'script',item.scriptId,nextSource.sessionId,variables)}
    }
    async function message(nextSource:MvuScopeSourceIdentityV1,item:MvuScopeReadMessageV2):Promise<MvuScopeMessageRefV2> {
      const {variables,...metadata}=item
      return {...metadata,valueRef:await valueRef(nextSource,'message',item.messageId,item.ownerSessionId,variables)}
    }
    async function initialize(initial:MvuScopePublicationInputV2,cutSha256:string):Promise<MvuScopeReadRefV2> {
      current()
      if(baseRef)fail('SCOPE_VIEW_BASE_ALREADY_CREATED')
      const scopes={} as Record<ScopeName,MvuScopeObjectRefV2>
      for(const name of ['chat','character','global'] as const) {
        scopes[name]=await valueRef(initial.source,name,name,initial.source.sessionId,initial.scopes[name])
      }
      const scripts:MvuScopeScriptRefV2[]=[],messages:MvuScopeMessageRefV2[]=[]
      for(const item of initial.scripts)scripts.push(await script(initial.source,item))
      for(const item of initial.messages)messages.push(await message(initial.source,item))
      const object=createMvuScopeBaseV2({realmEpoch:input.realmEpoch,source:initial.source,scopes,scripts,messages}),
        reference=await writeObject(input.ownerSessionId,object,current),
        readRef=createMvuScopeReadRefV2({baseRef:reference,tailRef:reference,sourceNativeCutSha256:cutSha256})
      resolver.resolve(readRef);current()
      baseRef=reference;tailRef=reference;source=initial.source
      return readRef
    }
    async function advance(nextSource:MvuScopeSourceIdentityV1,changes:readonly MvuScopePublicationChangeV2[],
      cutSha256:string):Promise<MvuScopeReadRefV2> {
      current()
      if(!baseRef||!tailRef||!source)fail('SCOPE_VIEW_BASE_REQUIRED')
      if(!changes.length&&sameSource(source,nextSource)) {
        return createMvuScopeReadRefV2({baseRef,tailRef,sourceNativeCutSha256:cutSha256})
      }
      const encoded:MvuScopeChangeV2[]=[]
      for(const change of changes) {
        if(change.kind==='scope')encoded.push({kind:'scope',scope:change.scope,
          valueRef:await valueRef(nextSource,change.scope,change.scope,nextSource.sessionId,change.value)})
        else if(change.kind==='script-upsert')encoded.push({kind:change.kind,script:await script(nextSource,change.script)})
        else if(change.kind==='script-delete')encoded.push(change)
        else {
          const messages:MvuScopeMessageRefV2[]=[]
          for(const item of change.messages)messages.push(await message(nextSource,item))
          encoded.push({kind:change.kind,index:change.index,deleteCount:change.deleteCount,messages})
        }
      }
      const object=createMvuScopeDeltaV2({baseRef,previousRef:tailRef,sourceBinding:nextSource,changes:encoded}),
        next=await writeObject(input.ownerSessionId,object,current),
        reference=createMvuScopeReadRefV2({baseRef,tailRef:next,sourceNativeCutSha256:cutSha256})
      resolver.resolve(reference);current()
      tailRef=next;source=nextSource
      return reference
    }
    return {initialize,resume,advance,dispose(){closed=true;source=undefined;baseRef=undefined;tailRef=undefined}}
  }
  return {readObject,writeObject,reader,bindings,captureScopeObjects,publisher,
    releaseSession(sessionId:string){for(const own of bindingsOwners)own.releaseSession(sessionId)},
    dispose(){
      if(disposed)return
      for(const own of [...bindingsOwners])own.dispose()
      for(const own of [...readers])own.dispose()
      disposed=true
    }}
}
export type RoleplayMvuScopeStoreV2=ReturnType<typeof createRoleplayMvuScopeStoreV2>
