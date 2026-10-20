/** Classification binds beside the current Source. Applying it never reimports
 * author text, replays an opening or mutates author/editor tables. */
import {materializeNativeCardConversionV1,validateNativeCardClassificationV1} from './native-card-conversion.js'
import type {NativeCardClassificationV1,NativeCardConversionSnapshotV1} from './native-card-conversion.js'
import {nextTavernExecutionAuthorData} from './nexttavern-card.js'
import type {NextTavernCardDocument} from './nexttavern-card.js'

export interface NativeCardAdvancedBindingV1 {
  schemaVersion:1
  encoding:'nexttavern-card-classification-binding-v1'
  sourceSha256:string
  classification:NativeCardClassificationV1
  resourceId?:string
}
export interface NativeCardConversionForkSeedV1 {
  schemaVersion:1
  encoding:'nexttavern-card-conversion-fork-seed-v1'
  parentSessionId:string
  binding:NativeCardAdvancedBindingV1
}
export interface NativeCardAdvancedCharacterV1 {
  id:string
  name:string
  aliases?:string[]
  content:string
}
export interface NativeCardAdvancedReadV1 {
  state:'ready'|'unconverted'|'stale'
  sourceSha256:string
  nativeAuthoring:boolean
  document?:NextTavernCardDocument
  classification?:NativeCardClassificationV1
  characters:NativeCardAdvancedCharacterV1[]
  /** Missing dynamic personas do not disable the safe static characters above. */
  staticReady:boolean
  reason?:string
  resourceId?:string
}
export interface NativeCardAdvancedCaptureV1 {
  snapshot:NativeCardConversionSnapshotV1
  nativeAuthoring:boolean
}
export interface NativeCardAdvancedDependenciesV1 {
  branch:{get(key:string):unknown;put(key:string,value:unknown):unknown|PromiseLike<unknown>}
  capture(sessionId:string):NativeCardAdvancedCaptureV1
  withSourceLock<T>(sessionId:string,work:()=>Promise<T>):Promise<T>
}
export interface NativeCardAdvancedApplyV1 {
  sourceSha256:string
  /** The conversion driver already validated this model-output boundary. */
  classification:NativeCardClassificationV1
  resourceId?:string
}

export const nativeCardAdvancedKeyV1=(sessionId:string)=>`${sessionId}__native-card-classification-v1`
const object=(value:unknown):value is Record<string,unknown>=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)
type ResolvedClassification={state:'ready';classification:NativeCardClassificationV1;resourceId?:string}
  |{state:'unconverted'|'stale';reason:string}

export function createNativeCardAdvancedV1(deps:NativeCardAdvancedDependenciesV1) {
  // InputState owns snapshot invalidation. Reusing its immutable snapshot also
  // reuses this imported-data boundary check, rather than revalidating on every
  // status/UI/cluster read or rehashing the complete author document here.
  const imported=new WeakMap<NativeCardConversionSnapshotV1,ResolvedClassification>()
  const bindings=new WeakMap<NativeCardConversionSnapshotV1,WeakMap<object,ResolvedClassification>>()
  const views=new WeakMap<NativeCardConversionSnapshotV1,{
    resolved:Extract<ResolvedClassification,{state:'ready'}>|undefined
    nativeAuthoring:boolean
    value:NativeCardAdvancedReadV1
  }>()
  function cacheBinding(snapshot:NativeCardConversionSnapshotV1,raw:object,value:ResolvedClassification) {
    let cache=bindings.get(snapshot)
    if(!cache){cache=new WeakMap();bindings.set(snapshot,cache)}
    cache.set(raw,value)
  }
  function resolve(snapshot:NativeCardConversionSnapshotV1,raw:unknown,embedded:boolean):ResolvedClassification {
    if(!object(raw)||raw.schemaVersion!==1
      ||raw.encoding!==(embedded?'nexttavern-classification-v1':'nexttavern-card-classification-binding-v1')) {
      return {state:'unconverted',reason:'角色卡分类记录无效，需要重新转换'}
    }
    if(raw.sourceSha256!==snapshot.sourceSha256)return {state:'stale',reason:'作者设定已变化，需要重新转换'}
    try {
      // Uploaded source directories are never trusted: the validator resolves
      // their assignments against the current program-owned source units, and
      // materialization regenerates every pointer from those actual units.
      const proposal=embedded?{characters:raw.characters,assignments:raw.assignments}:raw.classification
      const classification=validateNativeCardClassificationV1(snapshot,proposal)
      return {state:'ready',classification,...!embedded&&typeof raw.resourceId==='string'?{resourceId:raw.resourceId}:{}}
    }catch(error) {
      return {state:'unconverted',reason:error instanceof Error?error.message:'角色卡分类记录无效，需要重新转换'}
    }
  }
  function embedded(snapshot:NativeCardConversionSnapshotV1):ResolvedClassification {
    let result=imported.get(snapshot)
    if(!result) {
      result=resolve(snapshot,snapshot.document.data.compatibility?.classification,true)
      imported.set(snapshot,result)
    }
    return result
  }
  function ready(captured:NativeCardAdvancedCaptureV1,resolved?:Extract<ResolvedClassification,{state:'ready'}>):NativeCardAdvancedReadV1 {
    const {snapshot,nativeAuthoring}=captured,classification=resolved?.classification
    const prior=views.get(snapshot)
    if(prior&&prior.resolved===resolved&&prior.nativeAuthoring===nativeAuthoring)return prior.value
    const sourceDocument=classification?materializeNativeCardConversionV1(snapshot,classification):snapshot.document
    // This is an advanced-context view, never the portable execution document.
    // Joined author rules have one execution owner, so their dynamic fields
    // cannot be separated for advanced use. Independently rendered examples
    // and admitted lore may still supply rules in the actual request.
    const rules={...sourceDocument.data.rules}
    const authorRules=nextTavernExecutionAuthorData(snapshot.document.data).rules
    let dynamicRules=false
    for(const field of ['core','plot','narrative','reply','style'] as const) {
      if(authorRules[field]?.includes('<%'))dynamicRules=true
      if(rules[field]?.includes('<%'))delete rules[field]
    }
    const document={...sourceDocument,data:{...sourceDocument.data,rules}}
    const dynamic=new Set<string>()
    if(classification) {
      const atomic=new Set(snapshot.units.filter(unit=>unit.kind==='author'&&unit.atomic).map(unit=>unit.id))
      for(const span of classification.assignments)if(span.target==='character'&&atomic.has(span.sourceId)) {
        dynamic.add(span.characterId!)
      }
    }
    const characters:NativeCardAdvancedCharacterV1[]=[]
    let expected=0
    for(const [index,row] of document.data.cards.entries()) {
      if(row.kind==='user'||row.enabled===false)continue
      expected++
      const id=typeof row.characterId==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(row.characterId)
        ?row.characterId:`native-character-${index+1}`
      if(!row.content.trim()||row.content.includes('<%')||dynamic.has(id))continue
      characters.push({id,name:row.name??document.data.name,content:row.content,
        ...row.aliases?{aliases:[...row.aliases]}:{}})
    }
    const staticReady=characters.length===expected
    const value:NativeCardAdvancedReadV1={state:'ready',sourceSha256:snapshot.sourceSha256,nativeAuthoring,document,
      ...classification?{classification}:{},characters,staticReady,
      ...!staticReady||dynamicRules?{reason:[
        ...!staticReady?['部分人物需要本轮已渲染的人设或缺少可用正文。']:[],
        ...dynamicRules?['部分动态规则暂不用于角色协作；普通剧情仍按原卡执行。']:[],
      ].join('')}:{},
      ...resolved?.resourceId?{resourceId:resolved.resourceId}:{}}
    views.set(snapshot,{resolved,nativeAuthoring,value})
    return value
  }
  function read(sessionId:string):NativeCardAdvancedReadV1 {
    const captured=deps.capture(sessionId),{snapshot,nativeAuthoring}=captured
    const raw=deps.branch.get(nativeCardAdvancedKeyV1(sessionId))
    let binding:ResolvedClassification|undefined
    if(raw!==undefined&&raw!==null) {
      binding=object(raw)?bindings.get(snapshot)?.get(raw):undefined
      if(!binding) {
        binding=resolve(snapshot,raw,false)
        if(object(raw))cacheBinding(snapshot,raw,binding)
      }
      if(binding.state==='ready')return ready(captured,binding)
    }
    if(nativeAuthoring&&snapshot.document.spec_version==='1.0')return ready(captured)
    if(snapshot.document.spec_version==='1.1') {
      const imported=embedded(snapshot)
      if(imported.state==='ready')return ready(captured,imported)
      binding??=imported
    }
    const reason=binding&&binding.state!=='ready'?binding.reason:undefined
    return {state:binding?.state??'unconverted',sourceSha256:snapshot.sourceSha256,nativeAuthoring,
      characters:[],staticReady:false,reason:reason??'需要转换为 NextTavern 原生结构才能启用高级功能'}
  }
  async function apply(sessionId:string,input:NativeCardAdvancedApplyV1):Promise<NativeCardAdvancedReadV1> {
    return deps.withSourceLock(sessionId,async()=>{
      const captured=deps.capture(sessionId)
      if(captured.snapshot.sourceSha256!==input.sourceSha256)throw Error('角色卡来源已变化，转换结果已保留，请基于当前设定重新转换')
      const classification:NativeCardClassificationV1=structuredClone({
        characters:input.classification.characters,assignments:input.classification.assignments,
      })
      const binding:NativeCardAdvancedBindingV1={schemaVersion:1,encoding:'nexttavern-card-classification-binding-v1',
        sourceSha256:input.sourceSha256,classification,
        ...input.resourceId?{resourceId:input.resourceId}:{}}
      await deps.branch.put(nativeCardAdvancedKeyV1(sessionId),binding)
      const resolved:Extract<ResolvedClassification,{state:'ready'}>={state:'ready',classification,
        ...input.resourceId?{resourceId:input.resourceId}:{}}
      const stored=deps.branch.get(nativeCardAdvancedKeyV1(sessionId))
      if(object(stored))cacheBinding(captured.snapshot,stored,resolved)
      return ready(captured,resolved)
    })
  }
  function captureForkSeed(parentSessionId:string):NativeCardConversionForkSeedV1|undefined {
    const current=read(parentSessionId)
    if(current.state!=='ready'||!current.classification)return undefined
    return {schemaVersion:1,encoding:'nexttavern-card-conversion-fork-seed-v1',parentSessionId,
      binding:{schemaVersion:1,encoding:'nexttavern-card-classification-binding-v1',sourceSha256:current.sourceSha256,
        classification:structuredClone(current.classification),...current.resourceId?{resourceId:current.resourceId}:{}}}
  }
  /** The inheritance owner calls this before ready while holding the child
   * Source FIFO. Its frozen prepared seed is authoritative, never parent latest. */
  async function applyForkSeed(childSessionId:string,seed:NativeCardConversionForkSeedV1):Promise<void> {
    await deps.branch.put(nativeCardAdvancedKeyV1(childSessionId),structuredClone(seed.binding))
  }
  return {read,apply,captureForkSeed,applyForkSeed}
}
