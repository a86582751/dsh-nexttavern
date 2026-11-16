/** Reduces one accepted numerical publication into its ordinary scope bases.
 * The numerical owner validates descriptors and supplies immutable final DATA. */
import type {AuthorChatNamespaceV3,AuthorChatNamespaceRootV3,AuthorChatRefV1,AuthorChatScopeBasesV1}
  from './roleplay-author-chat-state-types.js'
import type {MvuJsonValue} from './tavern-mvu-initvar.js'
import type {MessageEditOrdinaryReplacementV3} from 'dsh-nexttavern-session-format'
import type {SessionHistoryCut} from './session-history.js'

export interface AcceptedMessageOrdinaryEditV3 {
  readonly seq:number
  readonly ref:AuthorChatRefV1
  readonly replacement:MessageEditOrdinaryReplacementV3
}
interface OrdinaryNativeEvent {
  readonly seq:number
  readonly type:string
  readonly data:unknown
}
/** Index only actual catalog-accepted events. Immutable cuts retain the same
 * event identity, so a cold fold scans once and subsequent reads consume tails. */
export function createMessageEditOrdinaryReader(deps:{
  session(id:string):object|undefined
  cut(session:object):SessionHistoryCut<OrdinaryNativeEvent>
  hash(event:OrdinaryNativeEvent):string
  useProof(proof:{current():boolean;onInvalidated(notify:()=>void):()=>void}):void
}) {
  interface Index {
    readonly owner:object
    through:number
    readonly edits:AcceptedMessageOrdinaryEditV3[]
    readonly versions:Map<number,{seq:number;basis:string|undefined}[]>
    readonly references:Map<string,{edit:AcceptedMessageOrdinaryEditV3;event:OrdinaryNativeEvent}>
    readonly listeners:Set<()=>void>
  }
  const indexes=new WeakMap<object,Index>()
  function read(session:object) {
    const cut=deps.cut(session)
    let index=indexes.get(session)
    if(!index||index.owner!==cut.owner||index.through>cut.length) {
      index={owner:cut.owner,through:0,edits:[],versions:new Map(),references:new Map(),listeners:new Set()}
      indexes.set(session,index)
    }
    for(const event of cut.range(index.through)) {
      index.through=event.seq+1
      if(event.type!=='roleplay/message-edit')continue
      const data=event.data as {schemaVersion?:number;targetSeq:number;bodyChanged?:boolean;
        operation?:{expectedMessageVersionSha256:string};patch?:{ordinary?:MessageEditOrdinaryReplacementV3}}
      const versions=index.versions.get(data.targetSeq)??[]
      versions.push({seq:event.seq,basis:data.schemaVersion===3&&data.bodyChanged===false
        ?versions.at(-1)?.basis??data.operation?.expectedMessageVersionSha256:undefined})
      index.versions.set(data.targetSeq,versions)
      const replacement=data.schemaVersion===3?data.patch?.ordinary:undefined
      if(!replacement)continue
      const ref={key:`native-message-edit:${replacement.namespace.sessionId}:${event.seq}`,sha256:deps.hash(event)},
        edit=Object.freeze({seq:event.seq,ref,replacement})
      index.edits.push(edit);index.references.set(ref.key,{edit,event})
      for(const listener of index.listeners)listener()
      index.listeners.clear()
    }
    return {index,cut}
  }
  function at(session:object,through:number,from=0):readonly AcceptedMessageOrdinaryEditV3[] {
    const {index,cut}=read(session)
    if(through>cut.length)throw Error('AUTHOR_CHAT_NATIVE_CUT_UNAVAILABLE')
    const boundary=(seq:number)=>{
      let low=0,high=index.edits.length
      while(low<high){const mid=(low+high)>>>1;if(index.edits[mid]!.seq<seq)low=mid+1;else high=mid}
      return low
    }
    return index.edits.slice(boundary(from),boundary(through))
  }
  function resolve(namespace:AuthorChatNamespaceV3,ref:AuthorChatRefV1):AcceptedMessageOrdinaryEditV3|undefined {
    const session=deps.session(namespace.sessionId)
    if(!session)return
    const {index}=read(session),found=index.references.get(ref.key)
    if(!found||found.edit.ref.sha256!==ref.sha256)return
    // Resolving an immutable ref never subscribes a fork to the parent's tail.
    deps.useProof({current:()=>deps.session(namespace.sessionId)===session
      &&deps.cut(session).at(found.edit.seq)===found.event,onInvalidated:()=>()=>{}})
    return found.edit
  }
  function useCurrent(namespace:AuthorChatNamespaceV3) {
    const session=deps.session(namespace.sessionId)
    if(!session)throw Error('AUTHOR_CHAT_NATIVE_SESSION_UNAVAILABLE')
    const {index}=read(session),count=index.edits.length
    deps.useProof({current:()=>deps.session(namespace.sessionId)===session&&read(session).index===index
      &&index.edits.length===count,onInvalidated(notify){index.listeners.add(notify);return ()=>index.listeners.delete(notify)}})
  }
  function bodyVersion(session:object,targetSeq:number,cut:number):string|undefined {
    const versions=read(session).index.versions.get(targetSeq)
    if(!versions)return
    let low=0,high=versions.length
    while(low<high){const mid=(low+high)>>>1;if(versions[mid]!.seq<cut)low=mid+1;else high=mid}
    return low?versions[low-1]!.basis:undefined
  }
  return {at,resolve,useCurrent,bodyVersion}
}

/** The caller supplies the actual accepted Native edit reference. The DATA
 * remains in that event, and shares the numerical reset/fence semantics. */
export function applyMessageEditOrdinaryScopePublication(previous:AuthorChatScopeBasesV1,
  editRef:AuthorChatRefV1,replacement:MessageEditOrdinaryReplacementV3):AuthorChatScopeBasesV1 {
  return applyNumericalOrdinaryScopePublication(previous,editRef,{...replacement,kind:'replace'},replacement.variables)
}

export interface NumericalOrdinaryScopePublicationV1 {
  readonly namespace:AuthorChatNamespaceV3
  readonly previous:AuthorChatRefV1|null
  readonly fenceRoot:AuthorChatNamespaceRootV3
  readonly kind:'replace'|'keys'
  readonly keys?:readonly string[]
}

export interface NumericalOrdinaryPublicationV1 {
  readonly schemaVersion:1
  readonly scopes:readonly NumericalOrdinaryScopePublicationV1[]
}

export interface NumericalOrdinaryKeyIndexV1 {
  set(key:string,value:NonNullable<ReturnType<AuthorChatScopeBasesV1['keys']['get']>>):void
  view():AuthorChatScopeBasesV1['keys']
}

export function applyNumericalOrdinaryScopePublication(previous:AuthorChatScopeBasesV1,
  eventRef:AuthorChatRefV1,scope:NumericalOrdinaryScopePublicationV1,
  finalVariables:Readonly<Record<string,MvuJsonValue>>,keyIndex?:NumericalOrdinaryKeyIndexV1):AuthorChatScopeBasesV1 {
  if(scope.kind==='replace') {
    return {ref:eventRef,reset:{ref:eventRef,fenceRoot:scope.fenceRoot,variables:finalVariables},keys:new Map()}
  }
  if(!scope.keys?.length)return previous
  // The numerical owner supplies its current index and immutable versioned
  // view. Standalone reductions copy only their current key-base map.
  const fallback=keyIndex?undefined:new Map(previous.keys)
  const index:NumericalOrdinaryKeyIndexV1=keyIndex??{
    set:(key,value)=>{fallback!.set(key,value)},view:()=>fallback!,
  }
  for(const key of scope.keys) {
    const exists=Object.hasOwn(finalVariables,key)
    index.set(key,{ref:eventRef,fenceRoot:scope.fenceRoot,exists,value:exists?finalVariables[key]!:null})
  }
  return {ref:eventRef,reset:previous.reset,keys:index.view()}
}
