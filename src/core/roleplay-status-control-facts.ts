/** Status display/control data associated with actual Native prose. Neither
 * self SHA nor a completed JSON flag is a Native writer ACK or execution right. */
import {types} from 'node:util'
import {nativeInputSha256} from '@deepseek-ai/dsh-agent-loop'
import type {SessionMessageProjection} from '@deepseek-ai/dsh-session'
import {eventsOf,canonicalAssistantForTurn} from './roleplay-context.js'
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import type {StatusSession,StatusSource,StatusEvent,StatusTable} from './roleplay-status-types.js'
import type {MvuRetainedSourceOwnerFactsV1} from './roleplay-mvu-ancestry.js'

type Data=Readonly<Record<string,unknown>>
export interface StatusControlRowFactV1 {
  readonly table:'status'
  readonly key:string
  readonly kind:'status-turn'|'status-panel'
  readonly family:'status-control'
  readonly evidenceKind:'native-associated-typed-local-data'
  readonly value:Data
  readonly sha256:string
  readonly boundFields:{readonly carrierSessionId:string;readonly sourceOwnerSessionId:string;
    readonly turn:number;readonly assistantSeq:number;readonly sourceSeqs:readonly number[];readonly sourceHash:string;
    readonly triggerId:string;readonly eventSha256:string;readonly inheritedEventCount:number;readonly inherited:boolean}
  /** These typed local bytes have no full-row Native publication/writer ACK. */
  readonly unboundControlFields:readonly string[]
  readonly retainedSourceOwnerEdges?:MvuRetainedSourceOwnerFactsV1['edges']
}
export interface StatusControlFactsReadV1 {
  readonly rows:readonly StatusControlRowFactV1[]
  readonly evidence:Data
  assertCurrent():void
}
export interface StatusControlFactsDependenciesV1 {
  readonly table:Pick<StatusTable,'get'|'entries'>
  readonly sessionForRowFacts:((id:string)=>StatusSession|null|undefined)|undefined
  readonly projectionsForRowFacts:(()=>readonly SessionMessageProjection[])|undefined
  /** The real status owner's existing source association, never a query DTO. */
  readonly statusSource:(session:StatusSession,event:StatusEvent)=>StatusSource|null
  /** Owner disposal/dependency identity only; never a Source/live scope check. */
  readonly assertOwnerAvailable:()=>void
  readonly retainedSourceOwnerFacts:((session:StatusSession,ownerId:string,sourceSeqs:readonly number[])
    =>MvuRetainedSourceOwnerFactsV1|undefined)|undefined
  readonly retainedSourceOwnerCatalog:((session:StatusSession,sourceSeqs:readonly number[])
    =>readonly MvuRetainedSourceOwnerFactsV1[])|undefined
}
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value)
const integer=(value:unknown,min=0):value is number=>typeof value==='number'&&Number.isSafeInteger(value)
  &&value>=min&&!Object.is(value,-0)
const text=(value:unknown,max=2_097_152):value is string=>typeof value==='string'&&Buffer.byteLength(value,'utf8')<=max
const display=(value:unknown)=>value===null||typeof value==='boolean'||text(value)||typeof value==='number'&&Number.isFinite(value)
  &&Math.abs(value)<=Number.MAX_SAFE_INTEGER&&!Object.is(value,-0)
function fail(code='STATUS_CONTROL_ROW_UNPROVEN'):never {throw Error(code)}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
function exact(value:unknown,required:readonly string[],optional:readonly string[]=[]):asserts value is Record<string,unknown> {
  if(!object(value)||required.some(key=>!Object.hasOwn(value,key))
    ||Object.keys(value).some(key=>!required.includes(key)&&!optional.includes(key)))fail('STATUS_CONTROL_SCHEMA_INVALID')
}
function sameData(actual:unknown,expected:unknown):boolean {
  if(Object.is(actual,expected))return true
  if(!actual||!expected||typeof actual!=='object'||typeof expected!=='object'
    ||types.isProxy(actual)||types.isProxy(expected)||Array.isArray(actual)!==Array.isArray(expected))return false
  if(Array.isArray(actual)?Object.getPrototypeOf(actual)!==Array.prototype
    :![Object.prototype,null].includes(Object.getPrototypeOf(actual)))return false
  const a=Object.getOwnPropertyDescriptors(actual),b=Object.getOwnPropertyDescriptors(expected),
    left=Reflect.ownKeys(actual),right=Reflect.ownKeys(expected)
  return left.length===right.length&&left.every(key=>typeof key==='string'&&right.includes(key))&&right.every(key=>{
    if(typeof key!=='string')return false
    const x=a[key],y=b[key]
    return !!x&&!!y&&Object.hasOwn(x,'value')&&Object.hasOwn(y,'value')&&x.enumerable===y.enumerable
      &&sameData(x.value,y.value)
  })
}
function strictData(raw:unknown,budget?:{bytes:number;nodes:number}):unknown {
  const value=cloneRoleplayTavernLoreDataV1(raw,16_777_216,{nodes:131072,depth:66},budget)
  if(!sameData(raw,value))fail('STATUS_CONTROL_ROW_SPELLING_INVALID')
  return freeze(value)
}
function source(raw:unknown,prior=false):Data {
  exact(raw,['branchId','turnId','assistantSeq','sourceSeqs','sourceHash'],prior?['historyHash','validation']:[])
  if(!id(raw['branchId'])||!integer(raw['turnId'],1)||!integer(raw['assistantSeq'])||!hash(raw['sourceHash'])
    ||!Array.isArray(raw['sourceSeqs'])||raw['sourceSeqs'].length!==2
    ||!raw['sourceSeqs'].every(value=>integer(value))||raw['sourceSeqs'][1]!==raw['assistantSeq']
    ||Number(raw['sourceSeqs'][0])>=Number(raw['assistantSeq']))fail('STATUS_CONTROL_SOURCE_INVALID')
  if(prior&&(!hash(raw['historyHash'])||!['history-hash','original-append-prefix'].includes(String(raw['validation'])))) {
    fail('STATUS_CONTROL_SOURCE_INVALID')
  }
  return raw
}
function route(raw:unknown):void {
  exact(raw,['provider','model'],['reasoningEffort'])
  if(!text(raw['provider'],512)||!raw['provider']||!text(raw['model'],512)||!raw['model']
    ||Object.hasOwn(raw,'reasoningEffort')&&!text(raw['reasoningEffort'],128))fail('STATUS_CONTROL_ROUTE_INVALID')
}
function selection(raw:unknown):void {
  exact(raw,['execution','main','actualRoute'],['policyRevision'])
  if(!['inline','spawn'].includes(String(raw['execution'])))fail('STATUS_CONTROL_ROUTE_INVALID')
  route(raw['main']);route(raw['actualRoute'])
  if(Object.hasOwn(raw,'policyRevision')) {
    exact(raw['policyRevision'],['global','session'])
    if(!integer(raw['policyRevision']['global'])||!integer(raw['policyRevision']['session']))fail('STATUS_CONTROL_ROUTE_INVALID')
  }
}
function panel(raw:unknown):Data {
  exact(raw,['title','html','fields','options','rawText'],['name','text','content','templateHtml'])
  if(!text(raw['title'])||!text(raw['html'])||!text(raw['rawText'])
    ||!Array.isArray(raw['fields'])||raw['fields'].length>4096
    ||!Array.isArray(raw['options'])||raw['options'].length>4)fail('STATUS_CONTROL_PANEL_INVALID')
  for(const key of ['name','text','content','templateHtml'])if(Object.hasOwn(raw,key)&&!display(raw[key])) {
    fail('STATUS_CONTROL_PANEL_INVALID')
  }
  for(const field of raw['fields']) {
    exact(field,['emoji','label','value'],['icon','name','title','key','reason','text','content','description','detail'])
    if(!text(field['emoji'])||!text(field['label'])||!text(field['value']))fail('STATUS_CONTROL_PANEL_INVALID')
    for(const [key,value] of Object.entries(field))if(!['emoji','label','value'].includes(key)&&!display(value)) {
      fail('STATUS_CONTROL_PANEL_INVALID')
    }
  }
  for(const option of raw['options']) {
    exact(option,['label','description','heart'],['text','value','reason','content','name','title','detail','desc'])
    if(!text(option['label'])||!text(option['description'])||typeof option['heart']!=='boolean') {
      fail('STATUS_CONTROL_PANEL_INVALID')
    }
    for(const [key,value] of Object.entries(option))if(!['label','description','heart'].includes(key)&&!display(value)) {
      fail('STATUS_CONTROL_PANEL_INVALID')
    }
  }
  return raw
}
function basis(raw:unknown):Data {
  exact(raw,['selectedHistoryHash','previousStatus','previousStatusSource'])
  if(!hash(raw['selectedHistoryHash'])||((raw['previousStatus']===null)!==(raw['previousStatusSource']===null))) {
    fail('STATUS_CONTROL_BASIS_INVALID')
  }
  if(raw['previousStatus']!==null){panel(raw['previousStatus']);source(raw['previousStatusSource'],true)}
  return raw
}
function provenance(raw:unknown):Data {
  exact(raw,['triggerId','sourceSeqs','sourceHash','specHash','fixedContextHash','storyContextHash','historyHash',
    'previousStatusSource','inputKind','templateKind','toolInputSeq'],['taskId','generation','actualRoute','execution'])
  for(const key of ['triggerId','sourceHash','specHash','fixedContextHash','storyContextHash','historyHash']) {
    if(!hash(raw[key]))fail('STATUS_CONTROL_PROVENANCE_INVALID')
  }
  if(!Array.isArray(raw['sourceSeqs'])||raw['sourceSeqs'].length!==2||!raw['sourceSeqs'].every(value=>integer(value))
    ||!['tool','worker'].includes(String(raw['inputKind']))||!['author','damaged','missing'].includes(String(raw['templateKind']))
    ||raw['toolInputSeq']!==null&&!integer(raw['toolInputSeq']))fail('STATUS_CONTROL_PROVENANCE_INVALID')
  if(raw['previousStatusSource']!==null)source(raw['previousStatusSource'],true)
  for(const key of ['taskId','generation'])if(Object.hasOwn(raw,key)&&(!text(raw[key],512)||!raw[key])) {
    fail('STATUS_CONTROL_PROVENANCE_INVALID')
  }
  if(Object.hasOwn(raw,'actualRoute'))route(raw['actualRoute'])
  if(Object.hasOwn(raw,'execution')&&!['inline','spawn'].includes(String(raw['execution']))) {
    fail('STATUS_CONTROL_PROVENANCE_INVALID')
  }
  return raw
}
function result(raw:unknown,standalone:boolean):Data {
  exact(raw,['schemaVersion','sessionId','branchId','atSeq','turnId','time','panel','provenance'],
    standalone?['stale','invalidatedFromSeq','invalidatedAt']:[])
  if(raw['schemaVersion']!==1||!id(raw['sessionId'])||raw['branchId']!==raw['sessionId']
    ||!integer(raw['atSeq'])||!integer(raw['turnId'],1)||!integer(raw['time']))fail('STATUS_CONTROL_RESULT_INVALID')
  panel(raw['panel']);provenance(raw['provenance'])
  if(Object.hasOwn(raw,'stale')&&typeof raw['stale']!=='boolean')fail('STATUS_CONTROL_RESULT_INVALID')
  if(Object.hasOwn(raw,'invalidatedFromSeq')&&raw['invalidatedFromSeq']!==null&&!integer(raw['invalidatedFromSeq'])) {
    fail('STATUS_CONTROL_RESULT_INVALID')
  }
  if(Object.hasOwn(raw,'invalidatedAt')&&!integer(raw['invalidatedAt']))fail('STATUS_CONTROL_RESULT_INVALID')
  return raw
}
function obligation(raw:unknown,sid:string):Data {
  exact(raw,['schemaVersion','sessionId','branchId','trigger','source','state','attempt','updatedAt','error'],
    ['specHash','fixedContextHash','storyContextHash','inputBasis','selection','generationKey','startedAt','result',
      'publicationState','publicationError'])
  if(raw['schemaVersion']!==1||raw['sessionId']!==sid||raw['branchId']!==sid||!integer(raw['attempt'],1)
    ||!integer(raw['updatedAt'])||!['running','completed','waiting-main','retry','stale'].includes(String(raw['state']))
    ||raw['error']!==null&&!text(raw['error'],8192))fail('STATUS_CONTROL_OBLIGATION_INVALID')
  exact(raw['trigger'],['kind','id','via'])
  if(raw['trigger']['kind']!=='turn-end'||!hash(raw['trigger']['id'])||!text(raw['trigger']['via'],512)) {
    fail('STATUS_CONTROL_OBLIGATION_INVALID')
  }
  source(raw['source'])
  const completeBasis=['specHash','fixedContextHash','storyContextHash','inputBasis','selection','generationKey','startedAt']
  if(['running','completed','waiting-main'].includes(String(raw['state']))&&completeBasis.some(key=>!Object.hasOwn(raw,key))) {
    fail('STATUS_CONTROL_OBLIGATION_INVALID')
  }
  for(const key of ['specHash','fixedContextHash','storyContextHash'])if(Object.hasOwn(raw,key)&&!hash(raw[key]))fail()
  if(Object.hasOwn(raw,'inputBasis'))basis(raw['inputBasis'])
  if(Object.hasOwn(raw,'selection'))selection(raw['selection'])
  if(Object.hasOwn(raw,'generationKey')&&raw['generationKey']!==null&&!text(raw['generationKey'],512))fail()
  if(Object.hasOwn(raw,'startedAt')&&!integer(raw['startedAt']))fail()
  if(Object.hasOwn(raw,'publicationState')
    &&!['pending','published','superseded','retry'].includes(String(raw['publicationState'])))fail()
  if(Object.hasOwn(raw,'publicationError')&&raw['publicationError']!==null&&!text(raw['publicationError'],8192))fail()
  if(raw['state']==='completed')result(raw['result'],false)
  else if(Object.hasOwn(raw,'result')&&raw['result']!==null)fail('STATUS_CONTROL_RESULT_INVALID')
  return raw
}
function projectionPin(definition:SessionMessageProjection) {
  if(!object(definition)||types.isProxy(definition)
    ||![Object.prototype,null].includes(Object.getPrototypeOf(definition)))fail('STATUS_CONTROL_PROJECTIONS_CHANGED')
  const descriptors=Object.getOwnPropertyDescriptors(definition)
  if(Reflect.ownKeys(definition).length!==2||!descriptors['type']?.enumerable||!descriptors['project']?.enumerable
    ||!Object.hasOwn(descriptors['type']!,'value')||!Object.hasOwn(descriptors['project']!,'value')
    ||typeof descriptors['type']!.value!=='string'||typeof descriptors['project']!.value!=='function') {
    fail('STATUS_CONTROL_PROJECTIONS_CHANGED')
  }
  return {definition,type:descriptors['type']!.value,project:descriptors['project']!.value}
}
export function createRoleplayStatusControlFactsV1(deps:StatusControlFactsDependenciesV1) {
  const table=deps.table,get=table.get,entries=table.entries,lookup=deps.sessionForRowFacts,
    projections=deps.projectionsForRowFacts,statusSource=deps.statusSource,assertOwnerAvailable=deps.assertOwnerAvailable,
    retainedSourceOwnerFacts=deps.retainedSourceOwnerFacts,retainedSourceOwnerCatalog=deps.retainedSourceOwnerCatalog
  function readOwnedStatusControlFacts(session:StatusSession):StatusControlFactsReadV1 {
    if(!lookup||!projections)fail('STATUS_CONTROL_ACTUAL_READERS_REQUIRED')
    const sid=session.id
    const assertIdentity=()=>{
      assertOwnerAvailable()
      if(deps.table!==table||table.get!==get||table.entries!==entries||deps.sessionForRowFacts!==lookup
        ||deps.projectionsForRowFacts!==projections||deps.statusSource!==statusSource||deps.assertOwnerAvailable!==assertOwnerAvailable
        ||deps.retainedSourceOwnerFacts!==retainedSourceOwnerFacts||deps.retainedSourceOwnerCatalog!==retainedSourceOwnerCatalog
        ||lookup(sid)!==session||session.id!==sid||!id(sid))fail('STATUS_CONTROL_OWNER_CHANGED')
    }
    assertIdentity()
    const events=eventsOf(session),rawCursor=session.seq,rawInherited=session.inheritedEventCount,parent=session.header?.parentSession,
      headerSha256=nativeInputSha256(session.header),historySha256=nativeInputSha256(events),
      surface=session.surface,deriveEventMessage=session.deriveEventMessage,pins=[...projections()].map(projectionPin)
    if(!integer(rawCursor)||events.length!==rawCursor||!integer(rawInherited)||rawInherited>rawCursor
      ||!session.header||(session.header.id!==undefined&&session.header.id!==sid)
      ||(parent===undefined||parent===null?rawInherited!==0:!id(parent)||parent===sid)
      ||events.some((event,index)=>!integer(event.seq)||event.seq!==index))fail('STATUS_CONTROL_HISTORY_UNAVAILABLE')
    const cursor=rawCursor,inherited=rawInherited
    function surfaceData():Data {
      const actual=session.surface
      if(actual!==surface||session.deriveEventMessage!==deriveEventMessage||typeof deriveEventMessage!=='function'
        ||!actual||!Array.isArray(actual.nodes)||!integer(actual.contentGeneration)
        ||actual.nodes.some(seq=>!integer(seq)||seq>=cursor))fail('STATUS_CONTROL_SURFACE_CHANGED')
      // Native's surface object owns private fold state. Hash only its public
      // immutable read contract, never serialize the manager or its methods.
      return {nodes:[...actual.nodes],contentGeneration:actual.contentGeneration}
    }
    const surfaceSha256=nativeInputSha256(surfaceData())
    function namespace():Map<string,{value:unknown;sha256:string}> {
      const rows=new Map<string,{value:unknown;sha256:string}>(),budget={bytes:0,nodes:0}
      for(const [key,raw] of entries.call(table)) {
        if(typeof key!=='string'||!key.startsWith(sid+'__'))continue
        if(rows.size>=16_384||rows.has(key))fail('STATUS_CONTROL_NAMESPACE_LIMIT_OR_DUPLICATE')
        const value=strictData(raw,budget),actual=get.call(table,key)
        if(!sameData(actual,value)||recordSha256(actual)!==recordSha256(value))fail('STATUS_CONTROL_NAMESPACE_CHANGED')
        rows.set(key,{value,sha256:recordSha256(value)})
      }
      return rows
    }
    const rows=namespace(),associations=new Map<number,{event:StatusEvent;source:StatusSource}>(),facts:StatusControlRowFactV1[]=[],
      origins=new Map<string,MvuRetainedSourceOwnerFactsV1>()
    function associate(raw:Data):StatusSource {
      const seq=Number(raw['assistantSeq']),event=events[seq],owner=String(raw['branchId'])
      let retainedCut=inherited
      if(!event||event.seq!==seq||event.type!=='assistant/message')fail('STATUS_CONTROL_NATIVE_SOURCE_UNPROVEN')
      const selected=canonicalAssistantForTurn(session,raw['turnId'])
      if(!selected||selected.seq!==seq)fail('STATUS_CONTROL_NATIVE_SOURCE_UNPROVEN')
      const actual=associations.get(seq)?.source??statusSource(session,selected)
      if(!actual||actual.branchId!==sid||actual.turnId!==raw['turnId']||actual.assistantSeq!==seq||actual.sourceHash!==raw['sourceHash']
        ||recordSha256(actual.sourceSeqs)!==recordSha256(raw['sourceSeqs']))fail('STATUS_CONTROL_NATIVE_SOURCE_UNPROVEN')
      if(owner!==sid) {
        const sourceSeqs=raw['sourceSeqs'] as readonly number[]
        if(seq>=inherited||!sourceSeqs.every(value=>value<inherited))fail('STATUS_CONTROL_INHERITED_OWNER_UNPROVEN')
        if(owner!==parent) {
          const address=owner+':'+recordSha256(sourceSeqs),origin=origins.get(address)
            ??retainedSourceOwnerFacts?.(session,owner,sourceSeqs)
          if(!origin||origin.sessionId!==sid||origin.sourceOwnerSessionId!==owner
            ||recordSha256(origin.sourceSeqs)!==recordSha256(sourceSeqs))fail('STATUS_CONTROL_INHERITED_OWNER_UNPROVEN')
          if(origin.assertCurrent()!==undefined)fail('STATUS_CONTROL_ASYNC_GUARD_FORBIDDEN')
          origins.set(address,origin)
          retainedCut=Math.min(inherited,...origin.edges.map(edge=>edge.inheritedEventCount))
        }
      }
      if(seq<inherited&&!events.some(item=>item.type==='turn/end'&&Number(item.data?.turn)===raw['turnId']
        &&item.seq>seq&&item.seq<retainedCut))fail('STATUS_CONTROL_INHERITED_CUT_UNPROVEN')
      associations.set(seq,{event:selected,source:actual})
      return actual
    }
    function prior(raw:unknown):void {if(raw!==null)associate(source(raw,true))}
    function bindResult(value:Data,rawSource:Data,triggerId:string):void {
      const proof=value['provenance'] as Data,origin=rawSource['branchId']
      if(value['atSeq']!==rawSource['assistantSeq']||value['turnId']!==rawSource['turnId']
        ||value['sessionId']!==sid&&value['sessionId']!==origin||proof['triggerId']!==triggerId
        ||proof['sourceHash']!==rawSource['sourceHash']||recordSha256(proof['sourceSeqs'])!==recordSha256(rawSource['sourceSeqs'])) {
        fail('STATUS_CONTROL_RESULT_SOURCE_UNPROVEN')
      }
      prior(proof['previousStatusSource'])
      if(proof['toolInputSeq']!==null&&Number(proof['toolInputSeq'])>=events.length)fail('STATUS_CONTROL_RESULT_SOURCE_UNPROVEN')
    }
    for(const [key,row] of rows) {
      const suffix=key.slice(sid.length+2)
      if(suffix==='spec')continue
      if(!object(row.value))fail('STATUS_CONTROL_SCHEMA_INVALID')
      let value:Data,rawSource:Data,triggerId:string,kind:StatusControlRowFactV1['kind'],unbound:string[]
      if(suffix==='panel') {
        value=result(row.value,true)
        if(value['sessionId']!==sid||value['branchId']!==sid)fail('STATUS_CONTROL_RESULT_SOURCE_UNPROVEN')
        const proof=value['provenance'] as Data,seq=Number(value['atSeq']),turn=Number(value['turnId']),
          currentId=sha256(`${sid}:${turn}:${seq}:${proof['sourceHash']}`),
          parentId=parent?sha256(`${parent}:${turn}:${seq}:${proof['sourceHash']}`):undefined,
          directOwner=proof['triggerId']===currentId?sid:proof['triggerId']===parentId?parent:undefined
        let owner=directOwner
        if(!owner) {
          const sourceSeqs=proof['sourceSeqs'] as readonly number[],catalog=retainedSourceOwnerCatalog?.(session,sourceSeqs),
            origin=catalog?.find(fact=>proof['triggerId']===sha256(`${fact.sourceOwnerSessionId}:${turn}:${seq}:${proof['sourceHash']}`))
          if(origin) {
            if(origin.sessionId!==sid||recordSha256(origin.sourceSeqs)!==recordSha256(sourceSeqs)) {
              fail('STATUS_CONTROL_INHERITED_OWNER_UNPROVEN')
            }
            if(origin.assertCurrent()!==undefined)fail('STATUS_CONTROL_ASYNC_GUARD_FORBIDDEN')
            owner=origin.sourceOwnerSessionId
            origins.set(owner+':'+recordSha256(sourceSeqs),origin)
          }
        }
        if(!owner)fail('STATUS_CONTROL_INHERITED_OWNER_UNPROVEN')
        rawSource=source({branchId:owner,turnId:turn,assistantSeq:seq,sourceSeqs:proof['sourceSeqs'],sourceHash:proof['sourceHash']})
        triggerId=String(proof['triggerId']);associate(rawSource);bindResult(value,rawSource,triggerId)
        kind='status-panel';unbound=['time','panel','provenance.specHash','provenance.fixedContextHash',
          'provenance.storyContextHash','provenance.historyHash','provenance.previousStatusSource.historyHash',
          'provenance.previousStatusSource.validation','provenance.taskId','provenance.generation',
          'provenance.actualRoute','provenance.execution','provenance.inputKind','provenance.templateKind',
          'provenance.toolInputSeq','stale','invalidatedFromSeq','invalidatedAt']
      }else {
        const address=/^turn-([1-9][0-9]*)-(0|[1-9][0-9]*)$/.exec(suffix)
        if(!address)fail('STATUS_CONTROL_UNKNOWN_STATUS_KEY')
        value=obligation(row.value,sid);rawSource=source(value['source'])
        if(Number(address[1])!==rawSource['turnId']||Number(address[2])!==rawSource['assistantSeq'])fail('STATUS_CONTROL_KEY_INVALID')
        associate(rawSource)
        triggerId=sha256(`${rawSource['branchId']}:${rawSource['turnId']}:${rawSource['assistantSeq']}:${rawSource['sourceHash']}`)
        if((value['trigger'] as Data)['id']!==triggerId)fail('STATUS_CONTROL_TRIGGER_UNPROVEN')
        if(Object.hasOwn(value,'inputBasis'))prior((value['inputBasis'] as Data)['previousStatusSource'])
        if(value['result']!==undefined&&value['result']!==null) {
          const output=value['result'] as Data,proof=output['provenance'] as Data
          bindResult(output,rawSource,triggerId)
          for(const field of ['specHash','fixedContextHash','storyContextHash'])if(proof[field]!==value[field])fail()
          if(proof['historyHash']!==(value['inputBasis'] as Data)['selectedHistoryHash'])fail('STATUS_CONTROL_BASIS_INVALID')
          if(recordSha256(proof['previousStatusSource'])
            !==recordSha256((value['inputBasis'] as Data)['previousStatusSource']))fail('STATUS_CONTROL_BASIS_INVALID')
        }
        kind='status-turn';unbound=['trigger.via','specHash','fixedContextHash','storyContextHash','inputBasis',
          'selection','generationKey','state','attempt','startedAt','updatedAt','error','publicationState','publicationError',
          'result.time','result.panel','result.provenance.historyHash','result.provenance.previousStatusSource.historyHash',
          'result.provenance.previousStatusSource.validation','result.provenance.taskId','result.provenance.generation',
          'result.provenance.actualRoute','result.provenance.execution','result.provenance.inputKind',
          'result.provenance.templateKind','result.provenance.toolInputSeq']
      }
      facts.push({table:'status',key,kind,family:'status-control',evidenceKind:'native-associated-typed-local-data',
        value,sha256:row.sha256,boundFields:{carrierSessionId:sid,sourceOwnerSessionId:String(rawSource['branchId']),
          turn:Number(rawSource['turnId']),assistantSeq:Number(rawSource['assistantSeq']),
          sourceSeqs:rawSource['sourceSeqs'] as readonly number[],sourceHash:String(rawSource['sourceHash']),triggerId,
          eventSha256:nativeInputSha256(events[Number(rawSource['assistantSeq'])]),inheritedEventCount:inherited,
          inherited:Number(rawSource['assistantSeq'])<inherited},unboundControlFields:unbound,
        ...origins.has(String(rawSource['branchId'])+':'+recordSha256(rawSource['sourceSeqs']))?{
          retainedSourceOwnerEdges:origins.get(String(rawSource['branchId'])+':'+recordSha256(rawSource['sourceSeqs']))!.edges}:{} })
    }
    const assertNativeFrame=()=>{
      assertIdentity()
      const currentEvents=eventsOf(session),currentProjections=projections()
      if(session.seq!==cursor||session.inheritedEventCount!==inherited||nativeInputSha256(session.header)!==headerSha256
        ||nativeInputSha256(surfaceData())!==surfaceSha256||currentEvents.length!==events.length
        ||nativeInputSha256(currentEvents)!==historySha256||currentProjections.length!==pins.length
        ||currentProjections.some((definition,index)=>{
          const pin=projectionPin(definition),expected=pins[index]!
          return pin.definition!==expected.definition||pin.type!==expected.type||pin.project!==expected.project
        }))fail('STATUS_CONTROL_HISTORY_CHANGED')
    }
    const assertCurrent=()=>{
      assertNativeFrame()
      for(const association of associations.values()) {
        const selected=canonicalAssistantForTurn(session,association.source.turnId)
        if(!selected||selected.seq!==association.event.seq||recordSha256(statusSource(session,selected))
          !==recordSha256(association.source))fail('STATUS_CONTROL_NATIVE_SOURCE_CHANGED')
      }
      for(const origin of origins.values())if(origin.assertCurrent()!==undefined)fail('STATUS_CONTROL_ASYNC_GUARD_FORBIDDEN')
      const current=namespace()
      if(current.size!==rows.size||[...rows].some(([key,row])=>{
        const actual=current.get(key)
        return !actual||actual.sha256!==row.sha256||!sameData(actual.value,row.value)
      }))fail('STATUS_CONTROL_NAMESPACE_CHANGED')
      // Namespace readers are synchronous calls into storage. Recheck the
      // actual Native frame after them so a read-side append cannot pass.
      assertNativeFrame()
      assertIdentity()
    }
    assertCurrent()
    return {rows:freeze(facts.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0)),
      evidence:freeze({schemaVersion:1,encoding:'native-associated-status-control-row-facts-v1',authority:'consumer-data-only',
        sessionId:sid,historySha256,historyLength:events.length,inheritedEventCount:inherited,
        rowRefs:facts.map(({key,sha256,kind,evidenceKind})=>({key,sha256,kind,evidenceKind}))}),assertCurrent}
  }
  return {readOwnedStatusControlFacts}
}
