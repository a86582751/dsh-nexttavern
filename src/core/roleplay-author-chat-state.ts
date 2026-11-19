/** Canonical ordinary chat namespace owner. Core retains Source's FIFO. */
import {recordSha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {projectAuthorVariableWritesV1,applyAuthorVariableProjectionV1,
  replaceAuthorVariableEffectV1 as replaceEffect,applyAuthorVariableWritesV1 as applyWrites,
  freezeAuthorVariableDataV1 as freeze}
  from './roleplay-author-variable-effects.js'
import type {AuthorVariableEffectV1 as Effect,AuthorVariableKeyStateV1 as KeyState,
  AuthorVariableKeyChangeV1 as KeyChange,AuthorVariableKeyResultV1 as KeyResult,
  AuthorVariableContributionV1} from './roleplay-author-variable-effects.js'
import type {AuthorChatRefV1,AuthorChatTableV1,AuthorChatNamespaceV3,AuthorChatNamespaceRootV3,AuthorChatCaptureV3,
  OrdinaryAuthorChatUpdateV3,OrdinaryAuthorChatOwnerV3,AuthorChatCommitV3,
  OrdinaryAuthorChatReceiptV3,AuthorChatForkBaseV3,AuthorChatForkOwnerV3,
  OrdinaryAuthorChatBatchUpdateV3,OrdinaryAuthorChatBatchOwnerV3,
  OrdinaryAuthorChatBatchCommitV3,OrdinaryAuthorChatBatchReceiptV3,
  AcceptedAuthorChatContributionV3,AcceptedAuthorChatWriteV3,AcceptedAuthorChatCommitV3,
  AcceptedAuthorChatReceiptV3,AuthorChatRevisionV1,AuthorChatNativeRootsV3,AuthorChatNativeCutV3,AuthorChatScopeBasesV1}
  from './roleplay-author-chat-state-types.js'

interface OrdinaryKeyEvent extends OrdinaryAuthorChatUpdateV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-chat-key-event-v3'
  readonly revision:number
  readonly inputSha256:string
  readonly sha256:string
}
interface ContributionEvent extends AcceptedAuthorChatContributionV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-chat-key-event-v3'
  readonly kind:'accepted-contribution'
  readonly inputSha256:string
  readonly sha256:string
}
interface OrdinaryBatchEvent extends OrdinaryAuthorChatBatchUpdateV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-chat-key-event-v3'
  readonly kind:'ordinary-batch'
  readonly writes:readonly AcceptedAuthorChatWriteV3[]
  readonly inputSha256:string
  readonly sha256:string
}
type KeyEvent=OrdinaryKeyEvent|ContributionEvent|OrdinaryBatchEvent
interface Publication {
  readonly schemaVersion:3
  readonly encoding:'native-author-chat-publication-v3'
  readonly namespace:AuthorChatNamespaceV3
  readonly event:AuthorChatRefV1
  readonly previous:AuthorChatRefV1|null
  readonly base:AuthorChatRefV1|null
  readonly results:readonly KeyResult[]
  readonly sha256:string
}
interface ForkRecord {
  readonly schemaVersion:3
  readonly encoding:'native-author-chat-fork-base-record-v3'
  readonly seed:AuthorChatForkBaseV3
  readonly prepared:AuthorChatRefV1
  readonly sha256:string
}
type Stored=KeyEvent|Publication|ForkRecord
type Contribution=AuthorVariableContributionV1<AcceptedAuthorChatContributionV3['source']>
interface OperationReceipt {ref:AuthorChatRefV1;publication:Publication}
interface Index {
  root:AuthorChatNamespaceRootV3
  keys:Map<string,KeyState>
  operations:Map<string,OperationReceipt>
  contributions:Map<string,Contribution>
  nextPosition:number
}
const isContribution=(event:KeyEvent):event is ContributionEvent=>'kind' in event&&event.kind==='accepted-contribution'
const isBatch=(event:KeyEvent):event is OrdinaryBatchEvent=>'kind' in event&&event.kind==='ordinary-batch'
interface OwnedRowFactV3 {
  readonly table:'branch'
  readonly key:string
  readonly value:Readonly<Record<string,unknown>>
  readonly sha256:string
  readonly family:'ordinary-chat'
}
interface PublicationClosureV3 {
  readonly ref:AuthorChatRefV1
  readonly publication:Publication
  readonly previous:PublicationClosureV3|null
}
function fail(code:string):never {throw Error(code)}
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const sameRef=(left:AuthorChatRefV1|null,right:AuthorChatRefV1|null)=>left===right
  ||!!left&&!!right&&left.key===right.key&&left.sha256===right.sha256
const address=(namespace:AuthorChatNamespaceV3)=>recordSha256(namespace)
const forkBaseKey=(namespace:AuthorChatNamespaceV3,namespaceSha256:string)=>
  `${namespace.sessionId}__author-chat-fork-base-v3_${namespaceSha256}`
export const authorChatEventKeyV3=(namespace:AuthorChatNamespaceV3,operationId:string)=>
  `${namespace.sessionId}__author-chat-key-event-v3_${recordSha256({namespace,operationId})}`
export const authorChatContributionIdV3=(namespace:AuthorChatNamespaceV3,inputId:string)=>
  recordSha256({namespace,inputId})

export function createCanonicalAuthorChatStateV1(options:{readonly table:AuthorChatTableV1;readonly roots:AuthorChatNativeRootsV3;
  readonly scopeBases?:{capture(namespace:AuthorChatNamespaceV3):AuthorChatScopeBasesV1;
    resolve(namespace:AuthorChatNamespaceV3,ref:AuthorChatRefV1|null):AuthorChatScopeBasesV1}}) {
  const {table,roots}=options
  const emptyBases:AuthorChatScopeBasesV1={ref:null,reset:null,keys:new Map()}
  const captureBases=(namespace:AuthorChatNamespaceV3)=>options.scopeBases?.capture(namespace)??emptyBases
  function resolveBases(namespace:AuthorChatNamespaceV3,ref:AuthorChatRefV1|null):AuthorChatScopeBasesV1 {
    if(!ref)return emptyBases
    if(!options.scopeBases)fail('AUTHOR_CHAT_SCOPE_UNAVAILABLE')
    return options.scopeBases.resolve(namespace,ref)
  }
  function assertScope(update:{namespace:AuthorChatNamespaceV3;expectedScopeRef?:AuthorChatRefV1|null}) {
    if(!sameRef(captureBases(update.namespace).ref,update.expectedScopeRef??null))fail('AUTHOR_CHAT_SCOPE_CHANGED')
  }
  const parsed=new WeakMap<object,Stored>()
  // Each namespace has one mutable current index. Historical roots build their
  // own lazy index, so later parent commits cannot mutate a frozen child view.
  const liveIndexes=new Map<string,Index>()
  const historicalIndexes=new Map<string,Index>()
  const fencePositions=new WeakMap<AuthorChatNamespaceRootV3,number>()
  const publicationClosures=new Map<string,PublicationClosureV3>()
  const certifiedRoots=new Set<string>()
  const rowFacts=new WeakMap<Stored,OwnedRowFactV3>()
  function read<T extends Stored>(key:string,encoding:T['encoding']):T|undefined {
    const raw=table.get(key)
    if(raw===undefined)return undefined
    if(!raw||typeof raw!=='object')fail('AUTHOR_CHAT_RECORD_INVALID')
    const cached=parsed.get(raw as object)
    if(cached) {
      if(cached.encoding!==encoding)fail('AUTHOR_CHAT_RECORD_INVALID')
      return cached as T
    }
    const value=cloneRoleplayTavernLoreDataV1(raw) as unknown as Stored
    const {sha256,...body}=value
    if(value.schemaVersion!==3||value.encoding!==encoding||sha256!==recordSha256(body))
      fail('AUTHOR_CHAT_RECORD_INVALID')
    const result=freeze(value)
    parsed.set(raw as object,result)
    return result as T
  }
  function referenced<T extends Stored>(ref:AuthorChatRefV1,encoding:T['encoding']):T {
    const value=read<T>(ref.key,encoding)
    if(!value||value.sha256!==ref.sha256)fail('AUTHOR_CHAT_HISTORY_MISSING')
    return value
  }
  async function put(key:string,value:Stored,beforeWrite?:OrdinaryAuthorChatOwnerV3['beforeWrite']) {
    const release=beforeWrite?.({key,value})
    try {await table.put(key,value)}finally {release?.()}
    parsed.set(value,value)
  }
  function captureNamespaceRootV3(namespace:AuthorChatNamespaceV3):AuthorChatNamespaceRootV3 {
    const namespaceSha256=address(namespace),current=roots.currentRoot(namespace,namespaceSha256)
    if(current)return freeze(current)
    const key=forkBaseKey(namespace,namespaceSha256),base=read<ForkRecord>(key,'native-author-chat-fork-base-record-v3')
    return freeze({namespace:cloneRoleplayTavernLoreDataV1(namespace),head:null,
      base:base?{key,sha256:base.sha256}:null})
  }
  function captureNamespaceRootAtNativeCut(namespace:AuthorChatNamespaceV3,cut:AuthorChatNativeCutV3)
    :AuthorChatNamespaceRootV3 {
    const empty=()=>freeze({namespace:cloneRoleplayTavernLoreDataV1(namespace),head:null,base:null})
    if(cut.length===0)return empty()
    let current=namespace
    for(;;) {
      const namespaceSha256=address(current),root=roots.cutRoot(current,namespaceSha256,cut)
      if(root)return freeze(root)
      const base=read<ForkRecord>(forkBaseKey(current,namespaceSha256),'native-author-chat-fork-base-record-v3')
      if(!base)return empty()
      // The marker must belong to this actual carrier prefix. The fixed base
      // supplies ancestry identity only, never its possibly later frozen head.
      current=base.seed.parentRoot.namespace
    }
  }
  function captureForkNamespaceRootAtCut(namespace:AuthorChatNamespaceV3,cut:AuthorChatNativeCutV3)
    :AuthorChatNamespaceRootV3 {
    const namespaceSha256=address(namespace),local=roots.cutRoot(namespace,namespaceSha256,cut)
    if(local)return freeze(local)
    const key=forkBaseKey(namespace,namespaceSha256),base=read<ForkRecord>(key,'native-author-chat-fork-base-record-v3')
    if(!base)return freeze({namespace,head:null,base:null})
    const parent=captureForkNamespaceRootAtCut(base.seed.parentRoot.namespace,cut)
    // A base-only child still owns its committed frozen inheritance. Preserve
    // that relation only when the selected carrier cut contains the exact
    // frozen parent root; an earlier fork cut must resolve its earlier facts.
    return same(parent,base.seed.parentRoot)
      ?freeze({namespace,head:null,base:{key,sha256:base.sha256}}):parent
  }
  function captureNamespaceRootsAtNativeCut(input:{namespaceOwner:AuthorChatNamespaceV3;cut:AuthorChatNativeCutV3;
    inheritedBases:readonly AuthorChatForkBaseV3[]}):readonly AuthorChatNamespaceRootV3[] {
    const {namespaceOwner,cut}=input
    if(cut.length===0)return Object.freeze([])
    const candidates=new Map<string,AuthorChatNamespaceV3>()
    const belongs=(namespace:AuthorChatNamespaceV3)=>namespace.sessionId===namespaceOwner.sessionId
      &&same(namespace.importIncarnation,namespaceOwner.importIncarnation)
    // Only committed Source packets supply base-only addresses. The stored
    // base relation resolves ancestor marker identity at the selected cut;
    // merely appearing in inherited Native history never grants an address.
    for(const seed of input.inheritedBases)if(belongs(seed.childNamespace))
      candidates.set(address(seed.childNamespace),seed.childNamespace)
    for(const marker of roots.markerHeadsAtCut(cut)) {
      const publication=referenced<Publication>(marker.publication,'native-author-chat-publication-v3')
      if(address(publication.namespace)!==marker.namespaceSha256||!same(publication.base,marker.base))
        fail('AUTHOR_CHAT_NATIVE_BINDING_CHANGED')
      if(belongs(publication.namespace))candidates.set(marker.namespaceSha256,publication.namespace)
    }
    return Object.freeze([...candidates.values()].map(namespace=>captureForkNamespaceRootAtCut(namespace,cut))
      .filter(root=>root.head!==null||root.base!==null))
  }
  function project(event:KeyEvent,eventRef:AuthorChatRefV1,current:Index) {
    return projectAuthorVariableWritesV1(current,{
      writes:isContribution(event)||isBatch(event)?event.writes:[{key:event.key,operation:'set',value:event.value}],
      ...isContribution(event)?{contribution:{id:event.contributionId,attemptId:event.attemptId,source:event.source}}:{},
    },eventRef)
  }
  function applyProjection(current:Index,change:ReturnType<typeof project>,receipt:OperationReceipt,eventRef:AuthorChatRefV1) {
    applyAuthorVariableProjectionV1(current,change)
    if(!current.operations.has(eventRef.key))current.operations.set(eventRef.key,receipt)
  }
  function index(root:AuthorChatNamespaceRootV3,historical=false):Index {
    if(historical) {
      const live=liveIndexes.get(address(root.namespace))
      if(live&&same(live.root,root))return live
    }
    const id=historical?recordSha256(root):address(root.namespace)
    const cache=historical?historicalIndexes:liveIndexes
    const previous=cache.get(id)
    if(previous&&same(previous.root,root))return previous
    const pending:OperationReceipt[]=[]
    let cursor=root.head
    while(cursor&&(!previous||!same(cursor,previous.root.head))) {
      const node=referenced<Publication>(cursor,'native-author-chat-publication-v3')
      if(!same(node.namespace,root.namespace)||!same(node.base,root.base))fail('AUTHOR_CHAT_HISTORY_MISSING')
      pending.push({ref:cursor,publication:node})
      cursor=node.previous
    }
    // A historical/backward root must not reuse a later mutable index.
    const reusable=previous&&same(cursor,previous.root.head)&&same(root.base,previous.root.base)
    let result:Index
    if(reusable)result=previous
    else {
      const base=root.base?index(referenced<ForkRecord>(root.base,'native-author-chat-fork-base-record-v3').seed.parentRoot,true):undefined
      result={root,keys:new Map(base?[...base.keys].map(([key,state])=>[key,{effects:state.effects.slice(),current:state.current}]):[]),
        operations:new Map(base?.operations),
        contributions:new Map(base?.contributions),nextPosition:base?.nextPosition??0}
    }
    for(let i=pending.length-1;i>=0;i--) {
      const receipt=pending[i]!,node=receipt.publication,
        event=referenced<KeyEvent>(node.event,'native-author-chat-key-event-v3')
      if(!same(event.namespace,root.namespace))fail('AUTHOR_CHAT_HISTORY_MISSING')
      const change=project(event,node.event,result)
      // Persisted results describe the event's numerical scope basis. Raw
      // indexing retains writes and revisions; readers derive their own basis.
      for(const value of node.results) {
        const key=change.keys.get(value.key)!
        key.current={...key.current,revision:value.revision}
      }
      applyProjection(result,change,receipt,node.event)
    }
    result.root=root
    cache.set(id,result)
    return result
  }
  function fencePosition(root:AuthorChatNamespaceRootV3):number {
    let position=fencePositions.get(root)
    if(position===undefined) {
      position=index(root,true).nextPosition
      fencePositions.set(root,position)
    }
    return position
  }
  function effectiveKey(state:KeyState|undefined,key:string,bases:AuthorChatScopeBasesV1,change?:KeyChange) {
    if(!bases.reset&&!bases.keys.has(key)) {
      const length=(state?.effects.length??0)+(change?(change.insert?1:0)-change.remove:0)
      return {active:length>0,result:change?.current??state?.current??{exists:false,value:null}}
    }
    const reset=bases.reset,keyBase=bases.keys.get(key),
      resetFence=reset?fencePosition(reset.fenceRoot):0,
      keyFence=keyBase?fencePosition(keyBase.fenceRoot):0
    // Full resets clear the key index. A retained key base is therefore a
    // later publication, even when both publications share the same fence.
    const useKey=!!keyBase,
      fence=useKey?keyFence:resetFence,ref=useKey?keyBase!.ref:reset?.ref??null,
      seed=useKey?{exists:keyBase!.exists,value:keyBase!.value}
        :{exists:!!reset&&Object.hasOwn(reset.variables,key),value:reset?.variables[key]??null}
    const effects=state?.effects??[],shift=change?(change.insert?1:0)-change.remove:0,
      length=effects.length+shift,updates=new Map(change?.updates.map(update=>[update.index,update.effect]))
    const at=(i:number):Effect=>{
      if(change&&i>=change.start) {
        if(change.insert&&i===change.start)return change.insert
        const original=i-shift
        return updates.get(original)??effects[original]!
      }
      return effects[i]!
    }
    if(!length||at(length-1).position<fence)return {active:true,result:seed}
    let cache=state?.effective
    if(!cache||!sameRef(cache.ref,ref)||cache.fence!==fence) {
      cache={ref,fence,results:new WeakMap()}
      if(state)state.effective=cache
    }
    let cursor=length-1,value:Effect['result']=seed
    // Reuse the unaffected prefix for this exact field basis. Replacements
    // preserve fixed positions, including newly introduced pre-fence keys.
    while(cursor>=0&&at(cursor).position>=fence) {
      const effect=at(cursor),prior=cache.results.get(effect)
      if(prior) {value=prior;break}
      if(effect.writes.some(write=>write.operation==='set'||write.operation==='delete')) {cursor--;break}
      cursor--
    }
    for(let i=cursor+1;i<length;i++) {
      const effect=at(i)
      value=applyWrites(value,effect.writes);cache.results.set(effect,value)
    }
    return {active:true,result:value}
  }
  function publicationResults(event:KeyEvent,current:Index,change:ReturnType<typeof project>) {
    const bases=resolveBases(event.namespace,event.expectedScopeRef??null)
    return [...change.keys].map(([key,value])=>({...value.current,
      ...effectiveKey(current.keys.get(key),key,bases,value).result}))
  }
  function keyAt(root:AuthorChatNamespaceRootV3,key:string,historical:boolean,
    bases=captureBases(root.namespace)):AuthorChatCaptureV3 {
    const state=index(root,historical).keys.get(key),value=state?.current
    return freeze({schemaVersion:3,authority:'consumer-data-only',namespace:root.namespace,key,root,scopeRef:bases.ref,
      revision:value?.revision??{revision:0,head:null},...effectiveKey(state,key,bases).result})
  }
  const captureKeyAtRootV3=(root:AuthorChatNamespaceRootV3,key:string,scopeRef:AuthorChatRefV1|null=null)=>
    keyAt(root,key,true,resolveBases(root.namespace,scopeRef))
  const captureKeyV3=(namespace:AuthorChatNamespaceV3,key:string)=>keyAt(captureNamespaceRootV3(namespace),key,false)
  function overlayAt(current:Index,bases:AuthorChatScopeBasesV1,changes?:ReadonlyMap<string,KeyChange>):{
    values:Record<string,AuthorChatCaptureV3['value']>;deletedKeys?:readonly string[];replaceOrdinary?:true
  } {
    const values:Record<string,AuthorChatCaptureV3['value']>=Object.create(null)
    const deletedKeys:string[]=[]
    const keys=new Set([...current.keys.keys(),...bases.keys.keys(),...Object.keys(bases.reset?.variables??{})])
    for(const key of keys) {
      // Numerical consumers supply stat_data from their own current target.
      // Ordinary replacement controls only the surrounding context fields.
      if(key==='stat_data')continue
      const state=current.keys.get(key)
      const {active,result:value}=effectiveKey(state,key,bases,changes?.get(key))
      if(!active)continue
      if(value.exists)values[key]=value.value
      else deletedKeys.push(key)
    }
    return {values,...deletedKeys.length?{deletedKeys}:{},...bases.reset?{replaceOrdinary:true}:{}}
  }
  function captureNamespaceV3(namespace:AuthorChatNamespaceV3) {
    return namespaceAt(captureNamespaceRootV3(namespace),captureBases(namespace),false)
  }
  function namespaceAt(root:AuthorChatNamespaceRootV3,bases:AuthorChatScopeBasesV1,historical:boolean) {
    const current=index(root,historical)
    // An accepted empty or deleted message container still exists. A frozen
    // fork of an untouched namespace does not create one merely by having base.
    return freeze({schemaVersion:3 as const,authority:'consumer-data-only' as const,root,scopeRef:bases.ref,
      exists:current.nextPosition>0||bases.reset!==null||bases.keys.size>0,...overlayAt(current,bases)})
  }
  const captureNamespaceAtRootV3=(root:AuthorChatNamespaceRootV3,scopeRef:AuthorChatRefV1|null=null)=>
    namespaceAt(root,resolveBases(root.namespace,scopeRef),true)
  async function commitOrdinaryV3(input:OrdinaryAuthorChatUpdateV3,
    owner:OrdinaryAuthorChatOwnerV3):Promise<AuthorChatCommitV3> {
    const update=freeze(cloneRoleplayTavernLoreDataV1(input))
    if(!owner.ownsNamespace(update.namespace,update.cause))fail('AUTHOR_CHAT_NAMESPACE_UNAVAILABLE')
    const current=async(checkScope=true)=>{
      if(!await owner.isCurrent(update.namespace))fail('AUTHOR_CHAT_OWNER_CHANGED')
      if(checkScope)assertScope(update)
    }
    await current(false)
    const inputSha256=recordSha256(update),key=authorChatEventKeyV3(update.namespace,update.operationId)
    let event=read<OrdinaryKeyEvent>(key,'native-author-chat-key-event-v3')
    const replayed=event!==undefined
    if(event&&event.inputSha256!==inputSha256)fail('AUTHOR_CHAT_OPERATION_CHANGED')
    let root=captureNamespaceRootV3(update.namespace)
    if(event&&index(root).operations.has(key)) {
      const eventRef={key,sha256:event.sha256}
      await roots.flush(update.namespace)
      return {kind:'replayed',event:eventRef,committedRevision:{revision:event.revision,head:eventRef},
        capture:keyAt(root,update.key,false)}
    }
    assertScope(update)
    const before=keyAt(root,update.key,false)
    if(!same(before.revision,update.expected))fail('AUTHOR_CHAT_REVISION_CHANGED')
    if(!event) {
      const body={...update,schemaVersion:3 as const,encoding:'native-author-chat-key-event-v3' as const,
        revision:before.revision.revision+1,inputSha256}
      event=freeze({...body,sha256:recordSha256(body)})
      await current()
      await put(key,event,owner.beforeWrite)
    }
    await current()
    // Re-read after the immutable event await. A pending event has no namespace
    // predecessor yet and may safely join a newer root when its key CAS holds.
    root=captureNamespaceRootV3(update.namespace)
    if(!same(keyAt(root,update.key,false).revision,update.expected))fail('AUTHOR_CHAT_REVISION_CHANGED')
    const eventRef={key,sha256:event.sha256},currentIndex=index(root),change=project(event,eventRef,currentIndex)
    const body={schemaVersion:3 as const,encoding:'native-author-chat-publication-v3' as const,
      namespace:update.namespace,event:eventRef,previous:root.head,base:root.base,
      results:publicationResults(event,currentIndex,change)}
    const node=freeze({...body,sha256:recordSha256(body)})
    const nodeKey=`${update.namespace.sessionId}__author-chat-publication-v3_${node.sha256}`
    if(!read<Publication>(nodeKey,'native-author-chat-publication-v3'))await put(nodeKey,node,owner.beforeWrite)
    await current()
    // Domain outputs are durable before the synchronous Native marker append.
    // The marker's actual carrier position is the publication authority.
    const ref={key:nodeKey,sha256:node.sha256},next=freeze({...root,head:ref})
    roots.publish(next,address(update.namespace),root.head)
    // A synchronous Native observer may already have consumed this marker.
    if(!same(currentIndex.root,next)) {
      applyProjection(currentIndex,change,{ref,publication:node},eventRef)
      currentIndex.root=next
    }
    await roots.flush(update.namespace)
    return {kind:replayed?'replayed':'committed',event:eventRef,
      committedRevision:{revision:event.revision,head:eventRef},capture:captureKeyV3(update.namespace,update.key)}
  }
  function lookupOrdinaryV3(input:OrdinaryAuthorChatUpdateV3):OrdinaryAuthorChatReceiptV3 {
    const inputSha256=recordSha256(input),key=authorChatEventKeyV3(input.namespace,input.operationId)
    const existing=read<OrdinaryKeyEvent>(key,'native-author-chat-key-event-v3')
    if(!existing)return {kind:'unconfirmed',inputSha256}
    if(existing.inputSha256!==inputSha256)fail('AUTHOR_CHAT_OPERATION_CHANGED')
    const event={key,sha256:existing.sha256},root=captureNamespaceRootV3(input.namespace)
    return index(root).operations.has(key)?{kind:'applied',inputSha256,event,
      committedRevision:{revision:existing.revision,head:event},capture:keyAt(root,input.key,false)}
      :{kind:'pending',inputSha256,event}
  }
  async function confirmOrdinary(input:OrdinaryAuthorChatUpdateV3):Promise<OrdinaryAuthorChatReceiptV3> {
    const receipt=lookupOrdinaryV3(input)
    if(receipt.kind==='applied')await roots.flush(input.namespace)
    return receipt
  }
  function readAcceptedContribution(namespace:AuthorChatNamespaceV3,contributionId:string) {
    const contribution=index(captureNamespaceRootV3(namespace)).contributions.get(contributionId)
    return contribution?freeze({attemptId:contribution.attemptId,firstSource:contribution.firstSource,
      hasWrites:contribution.keys.length>0}):undefined
  }
  function captureNamespaceWithoutContribution(namespace:AuthorChatNamespaceV3,contributionId:string) {
    const root=captureNamespaceRootV3(namespace),current=index(root),prior=current.contributions.get(contributionId),
      bases=captureBases(namespace),changes=new Map<string,KeyChange>()
    if(prior)for(const key of prior.keys) {
      const state=current.keys.get(key)!,change=replaceEffect(state,prior.position,contributionId,[])
      changes.set(key,{...change,current:{...state.current,...change.result}})
    }
    return freeze({root,scopeRef:bases.ref,exists:current.nextPosition>0,...overlayAt(current,bases,changes),priorAttemptId:prior?.attemptId??null,
      priorHasWrites:(prior?.keys.length??0)>0})
  }
  function acceptedReceipt(receipt:OperationReceipt,event:AuthorChatRefV1) {
    const node=receipt.publication,root=freeze({namespace:node.namespace,head:receipt.ref,base:node.base})
    return {event,publication:receipt.ref,root}
  }
  function lookupOrdinaryBatchV3(input:OrdinaryAuthorChatBatchUpdateV3):OrdinaryAuthorChatBatchReceiptV3 {
    const inputSha256=recordSha256(input),key=authorChatEventKeyV3(input.namespace,input.operationId),
      event=read<OrdinaryBatchEvent>(key,'native-author-chat-key-event-v3')
    if(!event)return {kind:'unconfirmed',inputSha256}
    if(!isBatch(event)||event.inputSha256!==inputSha256)fail('AUTHOR_CHAT_OPERATION_CHANGED')
    const eventRef={key,sha256:event.sha256},receipt=index(captureNamespaceRootV3(input.namespace)).operations.get(key)
    return receipt?{kind:'applied',inputSha256,...acceptedReceipt(receipt,eventRef)}
      :{kind:'pending',inputSha256,event:eventRef}
  }
  async function confirmOrdinaryBatchV3(input:OrdinaryAuthorChatBatchUpdateV3):Promise<OrdinaryAuthorChatBatchReceiptV3> {
    const receipt=lookupOrdinaryBatchV3(input)
    if(receipt.kind==='applied')await roots.flush(input.namespace)
    return receipt
  }
  async function commitOrdinaryBatchV3(input:OrdinaryAuthorChatBatchUpdateV3,
    owner:OrdinaryAuthorChatBatchOwnerV3):Promise<OrdinaryAuthorChatBatchCommitV3> {
    const update=freeze(cloneRoleplayTavernLoreDataV1(input))
    if(!owner.ownsNamespace(update.namespace,update.cause))fail('AUTHOR_CHAT_NAMESPACE_UNAVAILABLE')
    const current=async(checkScope=true)=>{
      if(!await owner.isCurrent(update.namespace))fail('AUTHOR_CHAT_OWNER_CHANGED')
      if(checkScope)assertScope(update)
    }
    await current(false)
    const key=authorChatEventKeyV3(update.namespace,update.operationId)
    let event=read<OrdinaryBatchEvent>(key,'native-author-chat-key-event-v3')
    const replayed=event!==undefined
    if(event&&(!isBatch(event)||event.inputSha256!==recordSha256(update)))fail('AUTHOR_CHAT_OPERATION_CHANGED')
    const root=captureNamespaceRootV3(update.namespace),currentIndex=index(root),prior=currentIndex.operations.get(key)
    if(prior) {
      await roots.flush(update.namespace)
      return {kind:'replayed',...acceptedReceipt(prior,{key,sha256:event!.sha256})}
    }
    assertScope(update)
    const assertRoot=()=>{
      if(!same(captureNamespaceRootV3(update.namespace),update.expectedRoot))fail('AUTHOR_CHAT_REVISION_CHANGED')
    }
    assertRoot()
    if(!event) {
      const basisValues=owner.basisValues
      if(!basisValues)fail('AUTHOR_CHAT_READ_BASIS_UNAVAILABLE')
      const writes:AcceptedAuthorChatWriteV3[]=[]
      for(const key of new Set([...Object.keys(basisValues),...Object.keys(update.values)])) {
        if(!Object.hasOwn(update.values,key))writes.push({key,operation:'delete'})
        else if(!Object.hasOwn(basisValues,key)||!same(basisValues[key],update.values[key]))
          writes.push({key,operation:'set',value:update.values[key]!})
      }
      if(!writes.length&&(update.namespace.target?.kind!=='message'||currentIndex.nextPosition>0))return {kind:'no-update',root}
      const body={...update,schemaVersion:3 as const,encoding:'native-author-chat-key-event-v3' as const,
        kind:'ordinary-batch' as const,writes,inputSha256:recordSha256(update)}
      event=freeze({...body,sha256:recordSha256(body)})
      await current()
      assertRoot()
      await put(key,event,owner.beforeWrite)
    }
    await current()
    assertRoot()
    const eventRef={key,sha256:event.sha256},change=project(event,eventRef,currentIndex),
      body={schemaVersion:3 as const,encoding:'native-author-chat-publication-v3' as const,
        namespace:update.namespace,event:eventRef,previous:root.head,base:root.base,
        results:publicationResults(event,currentIndex,change)},
      node=freeze({...body,sha256:recordSha256(body)}),
      ref={key:`${update.namespace.sessionId}__author-chat-publication-v3_${node.sha256}`,sha256:node.sha256}
    if(!read<Publication>(ref.key,'native-author-chat-publication-v3'))await put(ref.key,node,owner.beforeWrite)
    await current()
    // Every awaited persistence boundary precedes this final full-root CAS.
    // A pending updater never attaches its old snapshot result to a newer cut.
    assertRoot()
    const next=freeze({...root,head:ref})
    roots.publish(next,address(update.namespace),root.head)
    if(!same(currentIndex.root,next)) {
      applyProjection(currentIndex,change,{ref,publication:node},eventRef)
      currentIndex.root=next
    }
    await roots.flush(update.namespace)
    return {kind:replayed?'replayed':'committed',event:eventRef,publication:ref,root:next}
  }
  function lookupAcceptedContribution(input:AcceptedAuthorChatContributionV3):AcceptedAuthorChatReceiptV3 {
    const inputSha256=recordSha256(input),key=authorChatEventKeyV3(input.namespace,input.operationId),
      event=read<ContributionEvent>(key,'native-author-chat-key-event-v3')
    if(!event)return {kind:'unconfirmed',inputSha256}
    if(event.inputSha256!==inputSha256)fail('AUTHOR_CHAT_OPERATION_CHANGED')
    const eventRef={key,sha256:event.sha256},receipt=index(captureNamespaceRootV3(input.namespace)).operations.get(key)
    return receipt?{kind:'applied',inputSha256,...acceptedReceipt(receipt,eventRef)}
      :{kind:'pending',inputSha256,event:eventRef}
  }
  async function confirmAcceptedContribution(input:AcceptedAuthorChatContributionV3):Promise<AcceptedAuthorChatReceiptV3> {
    const receipt=lookupAcceptedContribution(input)
    if(receipt.kind==='applied')await roots.flush(input.namespace)
    return receipt
  }
  async function replaceAcceptedContribution(input:AcceptedAuthorChatContributionV3,
    owner:OrdinaryAuthorChatOwnerV3):Promise<AcceptedAuthorChatCommitV3> {
    const update=freeze(cloneRoleplayTavernLoreDataV1(input))
    if(!owner.ownsNamespace(update.namespace,update.cause))fail('AUTHOR_CHAT_NAMESPACE_UNAVAILABLE')
    const current=async(checkScope=true)=>{
      if(!await owner.isCurrent(update.namespace))fail('AUTHOR_CHAT_OWNER_CHANGED')
      if(checkScope)assertScope(update)
    }
    await current(false)
    const inputSha256=recordSha256(update),key=authorChatEventKeyV3(update.namespace,update.operationId)
    let event=read<ContributionEvent>(key,'native-author-chat-key-event-v3')
    const replayed=event!==undefined
    if(event&&event.inputSha256!==inputSha256)fail('AUTHOR_CHAT_OPERATION_CHANGED')
    let root=captureNamespaceRootV3(update.namespace),currentIndex=index(root)
    const priorReceipt=currentIndex.operations.get(key)
    if(priorReceipt) {
      await roots.flush(update.namespace)
      return {kind:'replayed',...acceptedReceipt(priorReceipt,{key,sha256:event!.sha256})}
    }
    assertScope(update)
    const assertAttempt=()=>{
      if((currentIndex.contributions.get(update.contributionId)?.attemptId??null)!==update.replacesAttemptId)
        fail('AUTHOR_CHAT_CONTRIBUTION_CHANGED')
    }
    assertAttempt()
    if(!event) {
      const body={...update,schemaVersion:3 as const,encoding:'native-author-chat-key-event-v3' as const,
        kind:'accepted-contribution' as const,inputSha256}
      event=freeze({...body,sha256:recordSha256(body)})
      await current()
      await put(key,event,owner.beforeWrite)
    }
    await current()
    // The intent is fixed before I/O. Retry attaches it to the latest actual
    // publication predecessor while retaining the contribution's first place.
    root=captureNamespaceRootV3(update.namespace);currentIndex=index(root)
    assertAttempt()
    const eventRef={key,sha256:event.sha256},change=project(event,eventRef,currentIndex),
      body={schemaVersion:3 as const,encoding:'native-author-chat-publication-v3' as const,
        namespace:update.namespace,event:eventRef,previous:root.head,base:root.base,
        results:publicationResults(event,currentIndex,change)},
      node=freeze({...body,sha256:recordSha256(body)}),
      ref={key:`${update.namespace.sessionId}__author-chat-publication-v3_${node.sha256}`,sha256:node.sha256}
    if(!read<Publication>(ref.key,'native-author-chat-publication-v3'))await put(ref.key,node,owner.beforeWrite)
    await current()
    const next=freeze({...root,head:ref})
    roots.publish(next,address(update.namespace),root.head)
    if(!same(currentIndex.root,next)) {
      applyProjection(currentIndex,change,{ref,publication:node},eventRef)
      currentIndex.root=next
    }
    await roots.flush(update.namespace)
    return {kind:replayed?'replayed':'committed',event:eventRef,publication:ref,root:next}
  }
  /** Core supplies actual material/live-capture and prepared-Source anchors.
   * These facts explain persisted DATA; they cannot admit a Source writer. */
  function readOwnedRowFactsV3(input:{sessionId:string;roots:readonly AuthorChatNamespaceRootV3[];
    nativePublications?:readonly {readonly namespaceSha256:string;readonly publication:AuthorChatRefV1;
      readonly base:AuthorChatRefV1|null}[];
    pending:readonly {request:OrdinaryAuthorChatUpdateV3|OrdinaryAuthorChatBatchUpdateV3|AcceptedAuthorChatContributionV3;
      root:AuthorChatNamespaceRootV3}[];
    forks:readonly {seed:AuthorChatForkBaseV3;prepared:AuthorChatRefV1}[]}):readonly OwnedRowFactV3[] {
    const facts=new Map<string,OwnedRowFactV3>(),visited=new Set<string>(),collectedPublications=new Set<string>()
    function include(key:string,value:Stored):OwnedRowFactV3 {
      let fact=rowFacts.get(value)
      if(!fact) {
        fact=Object.freeze({table:'branch',key,value:value as unknown as Readonly<Record<string,unknown>>,
          sha256:recordSha256(value),family:'ordinary-chat'})
        rowFacts.set(value,fact)
      }
      facts.set(key,fact)
      return fact
    }
    function exact<T extends Stored>(ref:AuthorChatRefV1,encoding:T['encoding']):T {
      const existing=facts.get(ref.key)
      if(existing) {
        if(existing.value['sha256']!==ref.sha256||existing.value['encoding']!==encoding)fail('AUTHOR_CHAT_HISTORY_MISSING')
        return existing.value as unknown as T
      }
      const value=referenced<T>(ref,encoding)
      include(ref.key,value)
      return value
    }
    function closure(root:AuthorChatNamespaceRootV3):PublicationClosureV3|null {
      const pending:{ref:AuthorChatRefV1;publication:Publication}[]=[]
      let cursor=root.head,previous:PublicationClosureV3|null=null
      while(cursor) {
        const cached=publicationClosures.get(cursor.key)
        if(cached&&cached.ref.sha256===cursor.sha256) {previous=cached;break}
        const publication=exact<Publication>(cursor,'native-author-chat-publication-v3')
        if(cursor.key!==`${root.namespace.sessionId}__author-chat-publication-v3_${publication.sha256}`
          ||!same(publication.namespace,root.namespace)||!same(publication.base,root.base))fail('AUTHOR_CHAT_HISTORY_MISSING')
        const event=exact<KeyEvent>(publication.event,'native-author-chat-key-event-v3')
        if(!same(event.namespace,root.namespace)
          ||publication.event.key!==authorChatEventKeyV3(event.namespace,event.operationId))fail('AUTHOR_CHAT_HISTORY_MISSING')
        pending.push({ref:cursor,publication})
        cursor=publication.previous
      }
      if(previous&&(!same(previous.publication.namespace,root.namespace)||!same(previous.publication.base,root.base))) {
        fail('AUTHOR_CHAT_HISTORY_MISSING')
      }
      for(let i=pending.length-1;i>=0;i--) {
        const row=pending[i]!
        previous=Object.freeze({ref:Object.freeze({...row.ref}),publication:row.publication,previous})
        publicationClosures.set(row.ref.key,previous)
      }
      return previous
    }
    function visitFork(ref:AuthorChatRefV1,namespace:AuthorChatNamespaceV3) {
      const record=exact<ForkRecord>(ref,'native-author-chat-fork-base-record-v3'),{sha256,...body}=record.seed
      if(ref.key!==forkBaseKey(namespace,address(namespace))
        ||sha256!==recordSha256(body)||!same(record.seed.childNamespace,namespace)
        ||!same(namespace.importIncarnation,record.seed.parentRoot.namespace.importIncarnation)
        ||!same(namespace.target??null,record.seed.parentRoot.namespace.target??null)) {
        fail('AUTHOR_CHAT_FORK_BINDING_CHANGED')
      }
      visitRoot(record.seed.parentRoot)
    }
    function visitRoot(root:AuthorChatNamespaceRootV3) {
      const digest=recordSha256(root)
      if(visited.has(digest))return
      visited.add(digest)
      // Foreign ancestry is append-only owner DATA. Its first cold traversal
      // certifies the pinned cut; a later parent head does not change that cut.
      if(root.namespace.sessionId!==input.sessionId&&certifiedRoots.has(digest))return
      if(root.base)visitFork(root.base,root.namespace)
      // Cached closure links avoid replaying old prefixes for every historical
      // root. Complete facts still read each required actual row once per call.
      for(let node=closure(root);node;node=node.previous) {
        if(collectedPublications.has(node.ref.key))break
        collectedPublications.add(node.ref.key)
        const publication=exact<Publication>(node.ref,'native-author-chat-publication-v3')
        exact<KeyEvent>(publication.event,'native-author-chat-key-event-v3')
      }
      certifiedRoots.add(digest)
    }
    for(const root of input.roots)visitRoot(root)
    for(const marker of input.nativePublications??[]) {
      const publication=referenced<Publication>(marker.publication,'native-author-chat-publication-v3')
      if(address(publication.namespace)!==marker.namespaceSha256||!same(publication.base,marker.base))
        fail('AUTHOR_CHAT_NATIVE_BINDING_CHANGED')
      visitRoot({namespace:publication.namespace,head:marker.publication,base:marker.base})
    }
    for(const {seed,prepared} of input.forks) {
      const body={schemaVersion:3 as const,encoding:'native-author-chat-fork-base-record-v3' as const,seed,prepared},
        sha256=recordSha256(body),ref={key:forkBaseKey(seed.childNamespace,address(seed.childNamespace)),sha256},
        existing=read<ForkRecord>(ref.key,'native-author-chat-fork-base-record-v3')
      if(existing?.sha256===sha256) {
        visitFork(ref,seed.childNamespace)
        visitRoot({namespace:seed.childNamespace,head:null,base:ref})
      }
    }
    for(const {request,root} of input.pending) {
      if(!same(request.namespace,root.namespace))fail('AUTHOR_CHAT_BINDING_CHANGED')
      visitRoot(root)
      const key=authorChatEventKeyV3(request.namespace,request.operationId),event=read<KeyEvent>(key,'native-author-chat-key-event-v3')
      if(!event)continue
      const {schemaVersion:_version,encoding:_encoding,inputSha256,sha256,...stored}=event,
        expectedSha256=recordSha256(request)
      let update:OrdinaryAuthorChatUpdateV3|OrdinaryAuthorChatBatchUpdateV3|AcceptedAuthorChatContributionV3
      if(isContribution(event)) {
        const {kind:_kind,...contribution}=stored as Omit<ContributionEvent,'schemaVersion'|'encoding'|'inputSha256'|'sha256'>
        update=contribution
      }else if(isBatch(event)) {
        const {kind:_kind,writes:_writes,...batch}=stored as Omit<OrdinaryBatchEvent,'schemaVersion'|'encoding'|'inputSha256'|'sha256'>
        update=batch
        if(!same(batch.expectedRoot,root))fail('AUTHOR_CHAT_REVISION_CHANGED')
      }else {
        const {revision,...ordinary}=stored as Omit<OrdinaryKeyEvent,'schemaVersion'|'encoding'|'inputSha256'|'sha256'>
        update=ordinary
        if(!('expected' in request)||revision!==request.expected.revision+1)fail('AUTHOR_CHAT_OPERATION_CHANGED')
      }
      if(inputSha256!==expectedSha256||recordSha256(update)!==expectedSha256) {
        fail('AUTHOR_CHAT_OPERATION_CHANGED')
      }
      include(key,event)
      const body={schemaVersion:3 as const,encoding:'native-author-chat-publication-v3' as const,
        namespace:request.namespace,event:{key,sha256},previous:root.head,base:root.base},
        change=project(event,{key,sha256},index(root,true)),
        currentBody={...body,results:publicationResults(event,index(root,true),change)}
      const publicationSha256=recordSha256(currentBody),
        ref={key:`${request.namespace.sessionId}__author-chat-publication-v3_${publicationSha256}`,sha256:publicationSha256}
      if(read<Publication>(ref.key,'native-author-chat-publication-v3'))visitRoot({...root,head:ref})
    }
    return Object.freeze([...facts.values()].filter(fact=>fact.key.startsWith(input.sessionId+'__')))
  }
  function freezeForkBaseV3(input:{parentRoot:AuthorChatNamespaceRootV3;childNamespace:AuthorChatNamespaceV3;
    operationId:string;nativeCutSha256:string}):AuthorChatForkBaseV3 {
    const body={...cloneRoleplayTavernLoreDataV1(input),schemaVersion:3 as const,
      encoding:'native-author-chat-fork-base-v3' as const}
    return freeze({...body,sha256:recordSha256(body)})
  }
  async function applyForkBaseV3(seed:AuthorChatForkBaseV3,prepared:AuthorChatRefV1,
    child:AuthorChatNamespaceV3,owner:AuthorChatForkOwnerV3):Promise<AuthorChatNamespaceRootV3> {
    const {sha256,...body}=seed
    if(sha256!==recordSha256(body)||!same(child,seed.childNamespace)
      ||!same(child.importIncarnation,seed.parentRoot.namespace.importIncarnation)
      ||!same(child.target??null,seed.parentRoot.namespace.target??null))fail('AUTHOR_CHAT_FORK_BINDING_CHANGED')
    if(!await owner.accepts(seed,prepared,child))fail('AUTHOR_CHAT_NAMESPACE_UNAVAILABLE')
    const current=async()=>{if(!await owner.isCurrent(child))fail('AUTHOR_CHAT_OWNER_CHANGED')}
    await current()
    // The prepared ref is retained in the immutable base envelope association.
    const baseBody={schemaVersion:3 as const,encoding:'native-author-chat-fork-base-record-v3' as const,seed,prepared}
    const record=freeze({...baseBody,sha256:recordSha256(baseBody)})
    const baseKey=forkBaseKey(child,address(child))
    const base={key:baseKey,sha256:record.sha256}
    const existing=captureNamespaceRootV3(child)
    if(existing.base) {
      if(!same(existing.base,base))fail('AUTHOR_CHAT_REVISION_CHANGED')
      return existing
    }
    if(existing.head)fail('AUTHOR_CHAT_REVISION_CHANGED')
    const existingRecord=read<ForkRecord>(baseKey,'native-author-chat-fork-base-record-v3')
    if(existingRecord&&existingRecord.sha256!==record.sha256)fail('AUTHOR_CHAT_REVISION_CHANGED')
    if(!existingRecord)await put(baseKey,record)
    await current()
    const root=freeze({namespace:cloneRoleplayTavernLoreDataV1(child),head:null,base})
    return root
  }
  return {captureNamespaceRootV3,captureNamespaceRootAtNativeCut,captureNamespaceRootsAtNativeCut,
    captureKeyV3,captureNamespaceV3,captureKeyAtRootV3,captureNamespaceAtRootV3,
    commitOrdinaryBatchV3,lookupOrdinaryBatchV3,confirmOrdinaryBatchV3,
    commitOrdinaryV3,lookupOrdinaryV3,confirmOrdinary,replaceAcceptedContribution,lookupAcceptedContribution,confirmAcceptedContribution,
    captureNamespaceWithoutContribution,readAcceptedContribution,readOwnedRowFactsV3,
    freezeForkBaseV3,applyForkBaseV3}
}
export type CanonicalAuthorChatStateV1=ReturnType<typeof createCanonicalAuthorChatStateV1>
