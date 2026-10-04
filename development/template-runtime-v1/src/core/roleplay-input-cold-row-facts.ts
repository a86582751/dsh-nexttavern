/** Source-free, read-only interpretation of actual Core input control rows.
 * This catalog grants no writer, claim, readiness, execution or stop ACK. */
import {types as nodeTypes} from 'node:util'
import {inspectNativeInboxHistory,nativeInputSha256} from '@deepseek-ai/dsh-agent-loop'
import type {NativeDurableInputWorkReceiptV1,NativeInputRef,NativePreparationReceiptV1} from '@deepseek-ai/dsh-agent-loop'
import type {Session,SessionEvent} from '@deepseek-ai/dsh-session'
import type {captureRoleplayTavernMaterialHistoryV1} from './roleplay-tavern-material-history.js'
import {recordSha256} from './roleplay-data.js'

type Row=Record<string,unknown>
export interface ColdInputMaterialHistoryV1 {
  readonly publications:ReturnType<typeof captureRoleplayTavernMaterialHistoryV1>['publications']
  assertCurrent():void
}
export interface ColdNonNumericalInputBranchRowFactV1 {
  readonly schemaVersion:1
  readonly evidenceKind:'native-associated-typed-local-data'
  readonly family:'input'
  readonly table:'branch'
  readonly key:string
  readonly value:Readonly<Row>
  readonly sha256:string
  readonly kind:'input-work'|'input-current'|'input-stop'
  readonly evidenceGrade:'native-and-published-material-association'|'native-identity-associated-control-metadata'
    |'associated-control-metadata'
  readonly nativeBoundFields:readonly string[]
  readonly materialBoundFields:readonly string[]
  readonly unboundControlFields:readonly string[]
  readonly associatedWorkKeys:readonly string[]
  readonly nativeAssociation:'latest-native-closed-turn'|'historical-closed-turn'
  readonly executionAuthority:'none'
  readonly stopAcknowledgementEvidence:'not-checked'
}
export interface ColdInputRowFactsDependenciesV1 {
  readonly table:{get(key:string):unknown;entries():Iterable<[string,unknown]>}
  readonly namespace:string
  readonly prefix:(sid:string)=>string
  readonly workKey:(sid:string,refs:readonly NativeInputRef[])=>string
  readonly currentKey:(sid:string)=>string
  readonly digest:(value:unknown)=>string
  readonly isWork:(value:unknown,sid:string)=>boolean
  readonly currencyOfStored:(value:Row)=>unknown
  readonly nonNumericalSource:(value:Row)=>boolean
  readonly sessionForRowFacts:(sid:string)=>Session|undefined
  readonly readColdMaterialHistory:(session:Session)=>ColdInputMaterialHistoryV1
  /** The actual process's writer owns these rows. Historical association
   * cannot reinterpret a new work that has not claimed a Native turn yet. */
  readonly ownedRowKeys?:ReadonlySet<string>
  readonly assertNotDisposed:()=>void
}
function fail(code:string):never {throw Error(code)}
const sha=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value)
const integer=(value:unknown,min=0):value is number=>typeof value==='number'&&Number.isSafeInteger(value)
  &&!Object.is(value,-0)&&value>=min
const text=(value:unknown,max=1024):value is string=>typeof value==='string'&&value.length>0&&value.length<=max
const code=(value:unknown):boolean=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(value)
const row=(value:unknown):value is Row=>!!value&&typeof value==='object'&&!Array.isArray(value)
function exact(value:unknown,required:readonly string[],optional:readonly string[]=[]):asserts value is Row {
  if(!row(value)||required.some(key=>!Object.hasOwn(value,key))
    ||Object.keys(value).some(key=>!required.includes(key)&&!optional.includes(key)))fail('INPUT_COLD_ROW_SCHEMA_INVALID')
}
/** Read descriptors before hashing. JSON's omission of undefined/accessors and
 * array properties must never turn a changed row into the same factual row. */
function copyData(value:unknown,budget={nodes:0,bytes:0},depth=0):unknown {
  if(++budget.nodes>131072||depth>66)fail('INPUT_COLD_ROW_BUDGET')
  if(value===null||typeof value==='boolean')return value
  if(typeof value==='string') {
    budget.bytes+=Buffer.byteLength(value,'utf8')
    if(budget.bytes>16_777_216)fail('INPUT_COLD_ROW_BUDGET')
    return value
  }
  if(typeof value==='number'&&Number.isFinite(value)&&!Object.is(value,-0))return value
  if(!value||typeof value!=='object'||nodeTypes.isProxy(value))fail('INPUT_COLD_ROW_NOT_JSON_DATA')
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value)
  if(!array&&prototype!==Object.prototype&&prototype!==null)fail('INPUT_COLD_ROW_NOT_JSON_DATA')
  if(array&&prototype!==Array.prototype)fail('INPUT_COLD_ROW_NOT_JSON_DATA')
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value)
  if(keys.some(key=>typeof key!=='string'))fail('INPUT_COLD_ROW_NOT_JSON_DATA')
  const result:Row|unknown[]=array?[]:{}
  if(array) {
    const length=descriptors.length
    if(!length||!('value' in length)||!integer(length.value)||length.value>131072
      ||keys.length!==length.value+1)fail('INPUT_COLD_ROW_NOT_JSON_DATA')
    for(let index=0;index<length.value;index++) {
      const descriptor=descriptors[String(index)]
      if(!descriptor||!('value' in descriptor)||!descriptor.enumerable)fail('INPUT_COLD_ROW_NOT_JSON_DATA')
      ;(result as unknown[]).push(copyData(descriptor.value,budget,depth+1))
    }
  }else for(const key of keys as string[]) {
    const descriptor=descriptors[key]!
    if(!('value' in descriptor)||!descriptor.enumerable)fail('INPUT_COLD_ROW_NOT_JSON_DATA')
    Object.defineProperty(result,key,{value:copyData(descriptor.value,budget,depth+1),enumerable:true})
  }
  return Object.freeze(result)
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
function refs(value:unknown,sid:string):asserts value is readonly NativeInputRef[] {
  if(!Array.isArray(value)||!value.length||value.length>4096)fail('INPUT_COLD_REFS_INVALID')
  const identities=new Set<string>(),messageIds=new Set<string>()
  for(const ref of value) {
    exact(ref,['sessionId','insertSeq','messageId','messageSha256'])
    if(ref.sessionId!==sid||!integer(ref.insertSeq)||!text(ref.messageId,4096)||!sha(ref.messageSha256))
      fail('INPUT_COLD_REFS_INVALID')
    const identity=nativeInputSha256(ref)
    if(identities.has(identity)||messageIds.has(ref.messageId))fail('INPUT_COLD_REFS_INVALID')
    identities.add(identity);messageIds.add(ref.messageId)
  }
}
function preparation(value:unknown):asserts value is NativePreparationReceiptV1 {
  exact(value,['schemaVersion','namespace','preparationKeySha256','credentialSha256'])
  if(value.schemaVersion!==1||!text(value.namespace,128)||!sha(value.preparationKeySha256)
    ||!sha(value.credentialSha256))fail('INPUT_COLD_PREPARATION_INVALID')
}
function receipt(value:unknown,sid:string):asserts value is NativeDurableInputWorkReceiptV1 {
  exact(value,['schemaVersion','sessionId','workSha256','preparation','refs','actualTurn',
    'startSeq','firstStepStartSeq','claimSpliceSeqs'])
  preparation(value.preparation);refs(value.refs,sid)
  if(value.schemaVersion!==1||value.sessionId!==sid||!sha(value.workSha256)||!integer(value.actualTurn,1)
    ||!integer(value.startSeq)||!integer(value.firstStepStartSeq)||value.firstStepStartSeq<=value.startSeq) {
    fail('INPUT_COLD_CHECKPOINT_INVALID')
  }
  const startSeq=value.startSeq,firstStepStartSeq=value.firstStepStartSeq
  if(!Array.isArray(value.claimSpliceSeqs)||!value.claimSpliceSeqs.length
    ||value.claimSpliceSeqs.some(seq=>!integer(seq)||seq<=startSeq||seq>=firstStepStartSeq)
    ||new Set(value.claimSpliceSeqs).size!==value.claimSpliceSeqs.length)fail('INPUT_COLD_CHECKPOINT_INVALID')
}
function source(value:unknown,deps:ColdInputRowFactsDependenciesV1):void {
  if(!row(value)||!deps.nonNumericalSource(value))fail('INPUT_COLD_SOURCE_NOT_NONNUMERICAL')
  if(value.kind==='story') {
    exact(value,['kind','sourceSha256','absenceScopeRef'])
    exact(value.absenceScopeRef,['kind','sha256'])
  }else {
    exact(value,['kind','sourceSha256','reason'])
    if(!text(value.reason,4096))fail('INPUT_COLD_SOURCE_NOT_NONNUMERICAL')
  }
}
function notice(value:unknown,sid:string):void {
  exact(value,['schemaVersion','sessionId','stopSequence','stopNonce','cause','keepInbox','phase','refs'],
    ['preparation','receipt'])
  refs(value.refs,sid);exact(value.cause,['kind'],['hookReasonSha256'])
  if(value.schemaVersion!==1||value.sessionId!==sid||!integer(value.stopSequence,1)||!id(value.stopNonce)
    ||typeof value.keepInbox!=='boolean'||!['idle','maintenance','running'].includes(String(value.phase))
    ||!['user','parent','disposed','hook'].includes(String(value.cause.kind))
    ||value.cause.hookReasonSha256!==undefined&&(!sha(value.cause.hookReasonSha256)||value.cause.kind!=='hook'))
    fail('INPUT_COLD_STOP_INVALID')
  if(value.preparation!==undefined)preparation(value.preparation)
  if(value.receipt!==undefined)receipt(value.receipt,sid)
}
function stop(value:unknown,sid:string):void {
  exact(value,['status'],['notice','code'])
  if(!['terminal','unknown'].includes(String(value.status))||value.code!==undefined&&!code(value.code))
    fail('INPUT_COLD_STOP_INVALID')
  if(value.notice!==undefined)notice(value.notice,sid)
}
function work(value:Row,sid:string,deps:ColdInputRowFactsDependenciesV1):void {
  exact(value,['schemaVersion','namespace','sessionId','branchId','preparationId','receiptGeneration','refs',
    'credentialSha256','preparation','status','source','attemptGeneration','checkpoint'],['attempt','stop'])
  refs(value.refs,sid);preparation(value.preparation);receipt(value.checkpoint,sid);source(value.source,deps)
  if(!deps.isWork(value,sid)||!id(value.preparationId)||!integer(value.attemptGeneration)
    ||!['active','stopped','unknown'].includes(String(value.status)))fail('INPUT_COLD_WORK_INVALID')
  if(value.attempt!==undefined) {
    exact(value.attempt,['turn','step','prepared'],['legacyPreparationId','snapshot'])
    if(!integer(value.attempt.turn,1)||!integer(value.attempt.step,1)||typeof value.attempt.prepared!=='boolean'
      ||value.attempt.legacyPreparationId!==undefined&&!id(value.attempt.legacyPreparationId))fail('INPUT_COLD_ATTEMPT_INVALID')
    if(value.attempt.snapshot!==undefined) {
      exact(value.attempt.snapshot,['key','sha256'])
      if(!text(value.attempt.snapshot.key,1024)||!sha(value.attempt.snapshot.sha256))fail('INPUT_COLD_ATTEMPT_INVALID')
    }
  }
  if(value.stop!==undefined)stop(value.stop,sid)
}
function callGuard(owner:object,fn:()=>void):void {
  if(Reflect.apply(fn,owner,[])!==undefined)fail('INPUT_COLD_ASYNC_GUARD_FORBIDDEN')
}
/** Only factory-owned actual Session lookup and Native material capture enter
 * here. A caller's event array, prefix or JSON proof cannot select a frame. */
export function readColdNonNumericalInputBranchRowFactsV1(session:Session,deps:ColdInputRowFactsDependenciesV1)
  :readonly ColdNonNumericalInputBranchRowFactV1[] {
  deps.assertNotDisposed()
  const sid=session.id,snapshotEvents=session.snapshotEvents,header=session.header,
    headerSha=nativeInputSha256(header),birth=Number(session.inheritedEventCount),seq=Number(session.seq),
    tableGet=deps.table.get,tableEntries=deps.table.entries
  if(!id(sid)||deps.sessionForRowFacts(sid)!==session||!integer(birth)||!integer(seq))fail('INPUT_COLD_SESSION_INVALID')
  const actualEvents=Reflect.apply(snapshotEvents,session,[]) as readonly SessionEvent[]
  if(!Array.isArray(actualEvents)||actualEvents.length!==seq||birth>seq
    ||actualEvents.some((event,index)=>Number(event.seq)!==index||Object.is(event.seq,-0)))fail('INPUT_COLD_HISTORY_INVALID')
  const events=Object.freeze([...actualEvents]),historySha=nativeInputSha256(events)
  const native=inspectNativeInboxHistory(sid,events,birth),nativePrefix=deps.prefix(sid)
  const captureRows=()=>{
    const values=new Map<string,Readonly<Row>>(),budget={nodes:0,bytes:0}
    for(const entry of Reflect.apply(tableEntries,deps.table,[]) as Iterable<[string,unknown]>) {
      if(!entry||typeof entry!=='object'||nodeTypes.isProxy(entry)||!Array.isArray(entry))fail('INPUT_COLD_TABLE_INVALID')
      const descriptors=Object.getOwnPropertyDescriptors(entry),keys=Reflect.ownKeys(entry),
        length=Object.getOwnPropertyDescriptor(entry,'length'),left=descriptors['0'],right=descriptors['1']
      if(keys.length!==3||!length||!('value' in length)||length.value!==2
        ||!left||!right||!('value' in left)||!('value' in right)||!left.enumerable||!right.enumerable
        ||typeof left.value!=='string')fail('INPUT_COLD_TABLE_INVALID')
      const key=left.value as string,value=right.value
      if(!key.startsWith(nativePrefix))continue
      if(deps.ownedRowKeys?.has(key))continue
      if(values.has(key)||values.size>=8192)fail('INPUT_COLD_TABLE_INVALID')
      const detached=copyData(value,budget)
      if(!row(detached))fail('INPUT_COLD_ROW_SCHEMA_INVALID')
      const got=copyData(Reflect.apply(tableGet,deps.table,[key]))
      if(!same(detached,got))fail('INPUT_COLD_TABLE_GET_ENTRIES_CHANGED')
      values.set(key,detached)
    }
    return values
  }
  const captured=captureRows(),history=deps.readColdMaterialHistory(session)
  if(!history||typeof history!=='object'||nodeTypes.isProxy(history))fail('INPUT_COLD_MATERIAL_CATALOG_INVALID')
  const historyDescriptors=Object.getOwnPropertyDescriptors(history),
    guardDescriptor=historyDescriptors.assertCurrent,publicationsDescriptor=historyDescriptors.publications
  if(!guardDescriptor||!('value' in guardDescriptor)||typeof guardDescriptor.value!=='function'
    ||nodeTypes.isProxy(guardDescriptor.value)||!publicationsDescriptor||!('value' in publicationsDescriptor)
    ||!Array.isArray(publicationsDescriptor.value)||nodeTypes.isProxy(publicationsDescriptor.value)
    ||publicationsDescriptor.value.length>4096)
    fail('INPUT_COLD_MATERIAL_CATALOG_INVALID')
  const guard=guardDescriptor.value as ()=>void,publications=publicationsDescriptor.value as ColdInputMaterialHistoryV1['publications']
  callGuard(history,guard)
  const assertNativeFrame=()=>{
    deps.assertNotDisposed()
    if(session.id!==sid||deps.sessionForRowFacts(sid)!==session||session.snapshotEvents!==snapshotEvents
      ||session.header!==header||nativeInputSha256(session.header)!==headerSha
      ||Number(session.inheritedEventCount)!==birth||Number(session.seq)!==seq
      ||deps.table.get!==tableGet||deps.table.entries!==tableEntries)
      fail('INPUT_COLD_OWNER_CHANGED')
    const currentDescriptors=Object.getOwnPropertyDescriptors(history)
    if(!currentDescriptors.assertCurrent||!('value' in currentDescriptors.assertCurrent)
      ||currentDescriptors.assertCurrent.value!==guard||!currentDescriptors.publications
      ||!('value' in currentDescriptors.publications)||currentDescriptors.publications.value!==publications)
      fail('INPUT_COLD_MATERIAL_CATALOG_CHANGED')
    const current=Reflect.apply(snapshotEvents,session,[]) as readonly SessionEvent[]
    if(current.length!==events.length||nativeInputSha256(current)!==historySha)fail('INPUT_COLD_HISTORY_CHANGED')
  }
  const assertCurrent=()=>{
    assertNativeFrame()
    callGuard(history,guard)
    const now=captureRows()
    if(now.size!==captured.size||[...captured].some(([key,value])=>!now.has(key)||!same(value,now.get(key))))
      fail('INPUT_COLD_ROWS_CHANGED')
    // Table/capture guards run before this final actual Native observation.
    // A synchronous read callback cannot hide an append or owner replacement.
    assertNativeFrame()
  }
  assertCurrent()
  const ends=new Map<number,number>(),starts=new Map<number,number>(),prefixes=new Map<number,ReturnType<typeof inspectNativeInboxHistory>>()
  for(const [index,event] of events.entries()) {
    if(event.type==='turn/start')starts.set(event.data.turn,index)
    if(event.type==='turn/end')ends.set(event.data.turn,index+1)
  }
  const lastStart=[...starts.values()].at(-1),verified=new Map<string,{value:Readonly<Row>;
    receipt:NativeDurableInputWorkReceiptV1;association:ColdNonNumericalInputBranchRowFactV1['nativeAssociation'];materialFields:readonly string[]}>()
  const result:ColdNonNumericalInputBranchRowFactV1[]=[]
  const make=(key:string,value:Readonly<Row>,kind:ColdNonNumericalInputBranchRowFactV1['kind'],workKeys:readonly string[],
    association:ColdNonNumericalInputBranchRowFactV1['nativeAssociation'],nativeFields:readonly string[],
    materialFields:readonly string[],controlFields:readonly string[])=>Object.freeze({schemaVersion:1 as const,
    evidenceKind:'native-associated-typed-local-data' as const,family:'input' as const,table:'branch' as const,
    key,value,sha256:recordSha256(value),kind,evidenceGrade:kind==='input-work'
      ?materialFields.length?'native-and-published-material-association' as const
        :'native-identity-associated-control-metadata' as const:'associated-control-metadata' as const,
    nativeBoundFields:Object.freeze([...nativeFields]),materialBoundFields:Object.freeze([...materialFields]),
    unboundControlFields:Object.freeze([...controlFields]),associatedWorkKeys:Object.freeze([...workKeys]),nativeAssociation:association,
    executionAuthority:'none' as const,stopAcknowledgementEvidence:'not-checked' as const})
  for(const [key,value] of captured) {
    if(!key.startsWith(`${nativePrefix}work-`))continue
    work(value,sid,deps)
    const originalRefs=value.refs as readonly NativeInputRef[],checkpoint=value.checkpoint as NativeDurableInputWorkReceiptV1
    if(key!==deps.workKey(sid,originalRefs)||checkpoint.startSeq<birth||starts.get(checkpoint.actualTurn)!==checkpoint.startSeq
      ||!same(checkpoint.preparation,value.preparation)||!same(checkpoint.refs,originalRefs))fail('INPUT_COLD_WORK_ADDRESS_INVALID')
    const end=ends.get(checkpoint.actualTurn)
    if(end===undefined||end<=checkpoint.firstStepStartSeq)fail('INPUT_COLD_CLOSED_TURN_UNPROVEN')
    let folded=prefixes.get(end)
    if(!folded) {
      if(prefixes.size>=256)fail('INPUT_COLD_TURN_BUDGET')
      folded=end===events.length?native:inspectNativeInboxHistory(sid,events.slice(0,end),birth)
      prefixes.set(end,folded)
    }
    const lookup=folded.durableWork({preparation:value.preparation as NativePreparationReceiptV1,refs:originalRefs})
    if(lookup.status==='unknown'||!same(lookup.receipt,checkpoint)
      ||originalRefs.some(ref=>native.ownership(ref).status==='unknown'||native.ownership(ref).status==='pending'))
      fail('INPUT_COLD_NATIVE_ASSOCIATION_UNPROVEN')
    const materialFields:string[]=[]
    if((value.source as Row).kind==='story') {
      const currency=deps.currencyOfStored(value as Row)
      const matchingPublications=publications.filter(publication=>{
        const snapshot=publication.snapshot,plan=publication.plan,event=publication.event
        if(snapshot.encoding!=='core-input-material-record-v1'||plan.encoding!=='core-input-material-record-v1')return false
        if(event.type!=='request/material'||Number(event.seq)<birth||snapshot.sessionId!==sid||snapshot.branchId!==sid
          ||plan.sessionId!==sid||plan.branchId!==sid||snapshot.turn!==checkpoint.actualTurn
          ||plan.turn!==checkpoint.actualTurn)return false
        return same(snapshot.currency,currency)&&same(plan.currency,currency)
          &&same(snapshot.preparation,value.preparation)&&same(plan.preparation,value.preparation)
          &&same(snapshot.originalInputRefs,originalRefs)&&same(plan.originalInputRefs,originalRefs)
      })
      if(!matchingPublications.length)fail('INPUT_COLD_SOURCE_PUBLICATION_UNPROVEN')
      // Material capture already checks real request reconstruction. Pin both
      // actual rows and the actual event again; never accept a copied catalog.
      for(const publication of matchingPublications) {
        const event=publication.event
        if(event.type!=='request/material'||!same(events[Number(event.seq)],event)
          ||recordSha256(Reflect.apply(tableGet,deps.table,[event.data.snapshot.key]))!==event.data.snapshot.sha256
          ||recordSha256(Reflect.apply(tableGet,deps.table,[event.data.plan.key]))!==event.data.plan.sha256
          ||recordSha256(publication.snapshot)!==event.data.snapshot.sha256
          ||recordSha256(publication.plan)!==event.data.plan.sha256)fail('INPUT_COLD_MATERIAL_CHANGED')
      }
      materialFields.push('source','attemptGeneration',...((value.attempt as Row|undefined)?.snapshot?['attempt.snapshot']:[]))
    }
    const association=checkpoint.startSeq===lastStart?'latest-native-closed-turn' as const:'historical-closed-turn' as const
    verified.set(key,{value,receipt:checkpoint,association,materialFields})
    result.push(make(key,value,'input-work',[key],association,
      ['schemaVersion','namespace','sessionId','branchId','preparationId','receiptGeneration','refs','credentialSha256',
        'preparation','checkpoint'],materialFields,
      ['status','attempt.turn','attempt.step','attempt.prepared','attempt.legacyPreparationId','stop',
        ...((value.source as Row).kind!=='story'?['source','attemptGeneration','attempt.snapshot']:[])]))
  }
  const matching=(noticeValue:Row)=>[...verified].filter(([,item])=>{
    const workRefs=item.value.refs as readonly NativeInputRef[]
    return (noticeValue.refs as readonly NativeInputRef[]).some(ref=>workRefs.some(own=>same(ref,own)))
  })
  const verifyNoticeAssociation=(noticeValue:Row)=>{
    const matches=matching(noticeValue)
    if(!matches.length||(noticeValue.refs as readonly NativeInputRef[]).some(ref=>!matches.some(([,item])=>
      (item.value.refs as readonly NativeInputRef[]).some(own=>same(ref,own)))))fail('INPUT_COLD_STOP_WORK_UNPROVEN')
    if(noticeValue.preparation!==undefined&&!matches.some(([,item])=>same(item.value.preparation,noticeValue.preparation))
      ||noticeValue.receipt!==undefined&&!matches.some(([,item])=>same(item.receipt,noticeValue.receipt)))
      fail('INPUT_COLD_STOP_CHECKPOINT_UNPROVEN')
    return matches
  }
  for(const [key,item] of verified) {
    const workStop=item.value.stop as Row|undefined
    if(workStop?.notice!==undefined) {
      const associated=verifyNoticeAssociation(workStop.notice as Row)
      if(!associated.some(([associatedKey])=>associatedKey===key))fail('INPUT_COLD_WORK_STOP_UNPROVEN')
    }
  }
  for(const [key,value] of captured) {
    if(verified.has(key))continue
    if(key===deps.currentKey(sid)) {
      exact(value,['schemaVersion','preparationId','credentialSha256'])
      if(value.schemaVersion!==2||!id(value.preparationId)||!sha(value.credentialSha256))fail('INPUT_COLD_CURRENT_INVALID')
      const matches=[...verified].filter(([,item])=>item.value.preparationId===value.preparationId
        &&item.value.credentialSha256===value.credentialSha256)
      if(matches.length!==1)fail('INPUT_COLD_CURRENT_WORK_UNPROVEN')
      result.push(make(key,value,'input-current',[matches[0]![0]],matches[0]![1].association,[],[],
        ['schemaVersion','preparationId','credentialSha256']))
    }else if(key.startsWith(`${nativePrefix}stop-`)) {
      exact(value,['schemaVersion','namespace','sessionId','refs','notice','status'])
      refs(value.refs,sid);notice(value.notice,sid)
      const noticeValue=value.notice as Row
      if(value.schemaVersion!==2||value.namespace!==deps.namespace||value.sessionId!==sid
        ||!['terminal','unknown'].includes(String(value.status))||!same(value.refs,noticeValue.refs)
        ||key!==`${nativePrefix}stop-${deps.digest({stopNonce:noticeValue.stopNonce,stopSequence:noticeValue.stopSequence})}`)
        fail('INPUT_COLD_STOP_ADDRESS_INVALID')
      const matches=verifyNoticeAssociation(noticeValue)
      result.push(make(key,value,'input-stop',matches.map(([workKey])=>workKey),
        matches.every(([,item])=>item.association==='latest-native-closed-turn')
          ?'latest-native-closed-turn':'historical-closed-turn',[],[],Object.keys(value)))
    }else fail('INPUT_COLD_UNKNOWN_ROW')
  }
  assertCurrent()
  return Object.freeze(result)
}
