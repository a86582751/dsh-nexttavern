/** Read the exact Core records bound by real Native material events once.
 * These historical facts grant no new step, claim, Source or dispatch rights. */
import {nativeInputSha256,verifyNativeRequestMaterialHistoryV1,verifyNativeSessionRequestMaterialHistoryV1,
  validateNativeOpeningInvocationV1,validateNativeOpeningRequestAttemptV1} from 'dsh-nexttavern-native-agent-loop'
import type {NativeRequestMaterialEventV1,NativeRequestMaterialTransformV1} from 'dsh-nexttavern-native-agent-loop'
import type {Session,SessionEvent,SessionMessageProjection,SessionSeq} from 'dsh-nexttavern-native-session'
import type {createRoleplayInputStateOwner,RoleplayInputStateRead} from './roleplay-input-state.js'
import type {SessionHistoryCut} from './session-history.js'
import {createHash,type Hash} from 'node:crypto'
import {recordSha256,stableJson} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import type {TavernSourceMaterialPublicationV1} from './roleplay-tavern-source-inheritance-types.js'
import type {CommunityExecutionRecord} from './community-preset-execution.js'
import type {TavernNativeFinalLoreTextV1} from './roleplay-tavern-layout.js'
import {roleplayOpeningMaterialKeysV1} from './roleplay-opening-material.js'
import type {RoleplayOpeningMaterialRecordV1,RoleplayOpeningMaterialDataRefV1} from './roleplay-opening-material.js'
import {programOpeningInputKeyV1,validateProgramOpeningSeedV1,
  validateProgramOpeningInputV1} from './roleplay-program-opening-records.js'

export interface TavernMaterialHistoryDependenciesV1 {
  readonly sessionId:string
  readonly events:()=>readonly SessionEvent[]
  readonly projections:()=>readonly SessionMessageProjection[]
  readonly table:{get(key:string):unknown}
  readonly assertOwnerCurrent:()=>void
  readonly inputState?:Pick<ReturnType<typeof createRoleplayInputStateOwner>,'captureClosedHistoricalFacts'|'nativeHistory'>
  readonly session?:Session
  readonly nativeCut?:SessionHistoryCut<SessionEvent>
}
export interface TavernBoundPlayerCoreMaterialRowV1 extends Readonly<Record<string,unknown>> {
  readonly schemaVersion:1
  readonly encoding:'core-input-material-record-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly branchId:string
  readonly kind:'snapshot'|'plan'
  readonly turn:number
  readonly step:number
  readonly currency:Readonly<Record<string,unknown>>
  readonly payload:Readonly<Record<string,unknown>>
}
/** Opening records preserve their own Native identity/seed/input contract.
 * No old player currency, branch preparation or admission is synthesized. */
export type TavernBoundCoreMaterialRowV1=TavernBoundPlayerCoreMaterialRowV1|RoleplayOpeningMaterialRecordV1
function fail(code:string):never {throw Error(code)}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
interface MaterialReadBudgetV1 {
  bytes:number
  rows:Map<string,TavernBoundCoreMaterialRowV1>
  inputs:Map<string,{readonly sha256:string;readonly value:unknown;readonly bytes:number}>
  decodedInputs?:ReadonlyMap<string,{readonly sha256:string;readonly value:unknown;readonly bytes:number}>
  invocations:Map<number,ReturnType<typeof validateNativeOpeningInvocationV1>>
  openingInputs:Map<string,OpeningInputPairV1>
}
interface OpeningInputPairV1 {
  readonly seed:ReturnType<typeof validateProgramOpeningSeedV1>
  readonly input:ReturnType<typeof validateProgramOpeningInputV1>
}
const budgetV1=(shared?:MaterialReadBudgetV1):MaterialReadBudgetV1=>({bytes:0,rows:new Map(),inputs:new Map(),
  ...(shared?{decodedInputs:shared.inputs}:{}),invocations:shared?.invocations??new Map(),
  openingInputs:shared?.openingInputs??new Map()})
const projectionIdentities=new WeakMap<SessionMessageProjection,number>()
let nextProjectionIdentity=0
/** Purpose identity only: definition replacement cannot reuse an older
 * interpretation even when this cut has no model-visible projection yet. */
export function tavernMaterialProjectionIdentityV1(projections:readonly SessionMessageProjection[]):string {
  return projections.map(projection=>{
    let id=projectionIdentities.get(projection)
    if(id===undefined){id=++nextProjectionIdentity;projectionIdentities.set(projection,id)}
    return id
  }).join(',')
}
/** Exact canonical array digest at one actual Native cut. This retains the
 * existing SHA encoding; append creates a new cut rather than a hash chain. */
export function tavernMaterialNativePrefixSha256V1(
  deps:Pick<TavernMaterialHistoryDependenciesV1,'nativeCut'>,events:readonly SessionEvent[],cut=events.length):string {
  // Only the accepted Native owner can reuse its exact input canonical stream.
  // Detached/loaded views keep the original Native encoder, including undefined.
  return deps.nativeCut?.nativeInputPrefixSha256(cut)??nativeInputSha256(cut===events.length?events:events.slice(0,cut))
}
type MaterialEvents=readonly SessionEvent[]|SessionHistoryCut<SessionEvent>
const materialEventArray=(events:MaterialEvents):readonly SessionEvent[]=>
  'materialize' in events?events.materialize():events
function verifyMaterials(deps:TavernMaterialHistoryDependenciesV1,events:MaterialEvents,
  projections:readonly SessionMessageProjection[],materials:readonly NativeRequestMaterialEventV1[]):void {
  if(deps.session&&deps.nativeCut?.source==='native') {
    verifyNativeSessionRequestMaterialHistoryV1({session:deps.session,endExclusive:events.length,projections,
      materials:materials.map(event=>({seq:Number(event.seq),expectedHeaderSha256:event.data.header.sha256}))})
    return
  }
  verifyNativeRequestMaterialHistoryV1({events:materialEventArray(events),projections,session:deps.session,
    materials:materials.map(materialEvent=>({materialEvent,expectedHeaderSha256:materialEvent.data.header.sha256}))})
}
const sameNative=(left:unknown,right:unknown)=>nativeInputSha256(left)===nativeInputSha256(right)
const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
function exact(value:unknown,keys:readonly string[]):asserts value is Record<string,unknown> {
  if(!object(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))
    fail('INPUT_MATERIAL_HISTORY_OPENING_SCHEMA_INVALID')
}
function openingDataRef(value:unknown):asserts value is RoleplayOpeningMaterialDataRefV1 {
  exact(value,['key','sha256'])
  if(typeof value['key']!=='string'||!hash(value['sha256']))fail('INPUT_MATERIAL_HISTORY_OPENING_REF_INVALID')
}
function rememberReference(references:Map<string,string>,ref:{key:string;sha256:string}):void {
  const previous=references.get(ref.key)
  if(previous&&previous!==ref.sha256)fail('INPUT_MATERIAL_HISTORY_CORE_REF_CONFLICT')
  references.set(ref.key,ref.sha256)
}
function charge(budget:MaterialReadBudgetV1,value:unknown):number {
  const bytes=Buffer.byteLength(JSON.stringify(value),'utf8')
  budget.bytes+=bytes
  if(budget.bytes>67_108_864)fail('INPUT_MATERIAL_HISTORY_CORE_BUDGET')
  return bytes
}
function readOpeningInput(deps:Pick<TavernMaterialHistoryDependenciesV1,'table'>,
  ref:RoleplayOpeningMaterialDataRefV1,budget:MaterialReadBudgetV1):unknown {
  const raw=deps.table.get(ref.key)
  if(recordSha256(raw)!==ref.sha256)fail('INPUT_MATERIAL_HISTORY_OPENING_INPUT_CHANGED')
  const previous=budget.inputs.get(ref.key)
  if(previous) {
    if(previous.sha256!==ref.sha256)fail('INPUT_MATERIAL_HISTORY_CORE_REF_CONFLICT')
    return previous.value
  }
  if(budget.inputs.size>=8192)fail('INPUT_MATERIAL_HISTORY_CORE_BUDGET')
  const decoded=budget.decodedInputs?.get(ref.key)
  if(decoded) {
    if(decoded.sha256!==ref.sha256)fail('INPUT_MATERIAL_HISTORY_CORE_REF_CONFLICT')
    budget.bytes+=decoded.bytes
    if(budget.bytes>67_108_864)fail('INPUT_MATERIAL_HISTORY_CORE_BUDGET')
    budget.inputs.set(ref.key,decoded)
    return decoded.value
  }
  const value=freeze(cloneRoleplayTavernLoreDataV1(raw,16_777_216,{nodes:131072,depth:66}))
  const bytes=charge(budget,value)
  budget.inputs.set(ref.key,{sha256:ref.sha256,value,bytes})
  return value
}
function assertOpeningInputsCurrent(deps:Pick<TavernMaterialHistoryDependenciesV1,'table'>,
  budget:MaterialReadBudgetV1):void {
  // Timed producers define coreRefs as snapshot/plan refs. Preserve that
  // catalog, while separately guarding all exact immutable seed/input rows.
  for(const [key,ref] of budget.inputs)if(recordSha256(deps.table.get(key))!==ref.sha256)
    fail('INPUT_MATERIAL_HISTORY_OPENING_INPUT_CHANGED')
}
function decodeOpeningInvocation(deps:TavernMaterialHistoryDependenciesV1,event:SessionEvent<'opening/invocation'>) {
  const compute=()=>validateNativeOpeningInvocationV1(event.data)
  return deps.inputState?.captureClosedHistoricalFacts(deps.sessionId,`tavern-opening-invocation:${event.seq}`,compute).data??compute()
}
function openingInvocation(deps:TavernMaterialHistoryDependenciesV1,row:RoleplayOpeningMaterialRecordV1,events:readonly SessionEvent[],
  event:NativeRequestMaterialEventV1,budget:MaterialReadBudgetV1) {
  exact(row.nativeOwner,['kind','identity','invocationRef'])
  exact(row.nativeOwner.invocationRef,['seq','sha256'])
  const ref=row.nativeOwner.invocationRef,seq=ref.seq,actual=events[seq]
  if(!Number.isSafeInteger(seq)||seq<0||seq>=event.seq||!hash(ref.sha256)
    ||actual?.type!=='opening/invocation'||Number(actual.seq)!==seq||nativeInputSha256(actual)!==ref.sha256)
    fail('INPUT_MATERIAL_HISTORY_OPENING_INVOCATION_UNPROVEN')
  let invocation=budget.invocations.get(seq)
  if(!invocation) {
    invocation=decodeOpeningInvocation(deps,actual)
    if(invocation.prefix.eventCount!==seq||tavernMaterialNativePrefixSha256V1(deps,events,seq)!==invocation.prefix.sha256)
      fail('INPUT_MATERIAL_HISTORY_OPENING_INVOCATION_PREFIX_CHANGED')
    // A historical cut may end before completion. The complete capture's
    // invocation catalog checks later ambiguity separately from this prefix.
    budget.invocations.set(seq,invocation)
  }
  if(row.nativeOwner.kind!=='programmatic-opening'||!sameNative(row.identity,invocation.identity)
    ||!sameNative(row.nativeOwner.identity,invocation.identity)||invocation.identity.sessionId!==row.sessionId
    ||invocation.expectedTurn!==row.turn||!sameNative(invocation.identity.intentRef,row.seedRef))
    fail('INPUT_MATERIAL_HISTORY_OPENING_IDENTITY_CHANGED')
  return {invocation,seq}
}
function openingPublicationPrefix(deps:TavernMaterialHistoryDependenciesV1,row:RoleplayOpeningMaterialRecordV1,events:readonly SessionEvent[],
  event:NativeRequestMaterialEventV1,budget:MaterialReadBudgetV1):void {
  const {seq}=openingInvocation(deps,row,events,event,budget),prefix=events.slice(seq+1,Number(event.seq)+1),
    starts=prefix.filter(value=>value.type==='turn/start'),
    stepStarts=prefix.filter(value=>value.type==='step/start'),stepEnds=prefix.filter(value=>value.type==='step/end')
  if(starts.length!==1||starts[0]!.data.turn!==row.turn||Object.keys(starts[0]!.data).length!==1
    ||prefix.some(value=>value.type==='turn/end'||value.type==='user/message'||value.type==='opening/invocation'
      ||value.type==='opening/generated-receipt'||value.type==='opening/closing-ack')
    ||row.step>256||stepStarts.length!==row.step||stepEnds.length!==row.step-1)
    fail('INPUT_MATERIAL_HISTORY_OPENING_STEP_UNPROVEN')
  for(let index=0;index<stepStarts.length;index++) {
    const start=stepStarts[index]!,end=stepEnds[index]
    if(start.data.turn!==row.turn||start.data.step!==index+1||start.seq<=starts[0]!.seq
      ||index>0&&start.seq<=stepEnds[index-1]!.seq
      ||end&&(end.data.turn!==row.turn||end.data.step!==index+1||end.seq<=start.seq))
      fail('INPUT_MATERIAL_HISTORY_OPENING_STEP_UNPROVEN')
  }
  let requestCount=0
  for(let stepIndex=0;stepIndex<stepStarts.length;stepIndex++) {
    const step=stepIndex+1,start=stepStarts[stepIndex]!,end=stepEnds[stepIndex],
      local=events.slice(Number(start.seq)+1,end?Number(end.seq):Number(event.seq)+1),
      attempts=local.filter(value=>value.type==='opening/request-attempt'),
      materials=local.filter(value=>value.type==='request/material')
    if(!attempts.length||attempts.length!==materials.length||!end&&materials.at(-1)!==event)
      fail('INPUT_MATERIAL_HISTORY_OPENING_ATTEMPT_UNPROVEN')
    let assemblySha256:string|undefined
    for(let index=0;index<attempts.length;index++) {
      if(++requestCount>256)fail('INPUT_MATERIAL_HISTORY_OPENING_ATTEMPT_LIMIT')
      const attemptEvent=attempts[index]!,
        attempt=validateNativeOpeningRequestAttemptV1(attemptEvent.data),material=materials[index]!
      if(attempt.turn!==row.turn||attempt.step!==step||attempt.attempt!==index+1
        ||!sameNative(attempt.invocationRef,row.nativeOwner.invocationRef)||attemptEvent.seq>=material.seq
        ||index>0&&attemptEvent.seq<=materials[index-1]!.seq
        ||material.data.turn!==row.turn||material.data.step!==step
        ||assemblySha256!==undefined&&attempt.assemblySha256!==assemblySha256)
        fail('INPUT_MATERIAL_HISTORY_OPENING_ATTEMPT_CHANGED')
      assemblySha256=attempt.assemblySha256
    }
  }
}
function verifyOpeningRows(deps:TavernMaterialHistoryDependenciesV1,
  event:NativeRequestMaterialEventV1,snapshot:RoleplayOpeningMaterialRecordV1,plan:RoleplayOpeningMaterialRecordV1,
  events:readonly SessionEvent[],budget:MaterialReadBudgetV1):void {
  for(const field of ['identity','seedRef','inputRef','nativeOwner'] as const) {
    if(!sameNative(snapshot[field],plan[field]))fail('INPUT_MATERIAL_HISTORY_OPENING_BINDING_CHANGED')
  }
  openingDataRef(snapshot.seedRef);openingDataRef(snapshot.inputRef)
  const keys=roleplayOpeningMaterialKeysV1(snapshot.sessionId,snapshot.seedRef,snapshot.turn,snapshot.step)
  if(event.data.snapshot.key!==keys.snapshot||event.data.plan.key!==keys.plan)
    fail('INPUT_MATERIAL_HISTORY_OPENING_KEY_CHANGED')
  const rawSeed=readOpeningInput(deps,snapshot.seedRef,budget),
    pairKey=JSON.stringify([snapshot.seedRef.key,snapshot.seedRef.sha256,snapshot.inputRef.key,snapshot.inputRef.sha256])
  let pair=budget.openingInputs.get(pairKey)
  if(!pair) {
    const seed=validateProgramOpeningSeedV1(rawSeed),
      input=validateProgramOpeningInputV1(readOpeningInput(deps,snapshot.inputRef,budget),seed)
    pair={seed,input};budget.openingInputs.set(pairKey,pair)
  }else {
    // Every publication still reads both exact references. Only their pure
    // parsing is shared within this budget, never Native/current checks.
    readOpeningInput(deps,snapshot.inputRef,budget)
  }
  const {seed,input}=pair
  if(seed.production!=='generated-opening'||seed.sessionId!==snapshot.sessionId
    ||snapshot.inputRef.key!==programOpeningInputKeyV1(seed.sessionId,seed.operationId)
    ||seed.operationId!==snapshot.identity.operationId||seed.requestedMessageId!==snapshot.identity.messageId
    ||seed.instructionSha256!==snapshot.identity.instructionSha256||input.instruction!==snapshot.identity.instruction
    ||!sameNative(input.seedRef,snapshot.seedRef))fail('INPUT_MATERIAL_HISTORY_OPENING_INPUT_IDENTITY_CHANGED')
  exact(plan.payload,['promptPlan','nativeTransform','nativeTransformSha256'])
  if(!object(plan.payload.promptPlan)||!object(plan.payload.nativeTransform)
    ||nativeInputSha256(plan.payload.nativeTransform)!==plan.payload.nativeTransformSha256)
    fail('INPUT_MATERIAL_HISTORY_OPENING_TRANSFORM_CHANGED')
  openingPublicationPrefix(deps,snapshot,events,event,budget)
}
function readPublication(deps:TavernMaterialHistoryDependenciesV1,
  event:NativeRequestMaterialEventV1,ownerSessionId:string,references:Map<string,string>,budget:MaterialReadBudgetV1,
  events:MaterialEvents) {
  const opening=event.data.snapshot.key.startsWith(`${ownerSessionId}__program-opening-material-`),
    prefix=opening?`${ownerSessionId}__program-opening-material-`:`${ownerSessionId}__tavern-prompt-v1-`
  const read=(ref:{key:string;sha256:string},kind:'snapshot'|'plan')=>{
    if(!ref.key.startsWith(prefix))fail('INPUT_MATERIAL_HISTORY_CORE_OWNER_UNPROVEN')
    const raw=deps.table.get(ref.key)
    if(recordSha256(raw)!==ref.sha256)fail('INPUT_MATERIAL_HISTORY_CORE_ROW_CHANGED')
    // Native binds this published derived record by its full digest. Source
    // budgets belong to its producer, not to the repeated explanatory layout.
    const priorRow=budget.rows.get(ref.key),row=priorRow??raw
    if(!object(row)||row.schemaVersion!==1||row.authority!=='consumer-data-only'||row.sessionId!==ownerSessionId
      ||row.kind!==kind||row.turn!==event.data.turn||row.step!==event.data.step
      ||!object(row.payload))
      fail('INPUT_MATERIAL_HISTORY_CORE_SCHEMA_INVALID')
    if(opening) {
      exact(row,['schemaVersion','encoding','authority','sessionId','identity','seedRef',
        'inputRef','nativeOwner','turn','step','kind','payload'])
      if(row.encoding!=='core-program-opening-material-record-v1'||!positive(row.turn)||!positive(row.step)
        ||!object(row.identity)||!object(row.nativeOwner)||!object(row.seedRef)||!object(row.inputRef))
        fail('INPUT_MATERIAL_HISTORY_OPENING_SCHEMA_INVALID')
    }else if(row.encoding!=='core-input-material-record-v1'||row.branchId!==ownerSessionId
      ||!object(row.currency)||row.currency.schemaVersion!==2)fail('INPUT_MATERIAL_HISTORY_CORE_SCHEMA_INVALID')
    rememberReference(references,ref)
    const result=row as unknown as TavernBoundCoreMaterialRowV1
    if(!priorRow)budget.rows.set(ref.key,result)
    return result
  }
  const snapshot=read(event.data.snapshot,'snapshot'),plan=read(event.data.plan,'plan')
  if(opening)verifyOpeningRows(deps,event,snapshot as RoleplayOpeningMaterialRecordV1,
    plan as RoleplayOpeningMaterialRecordV1,materialEventArray(events),budget)
  else for(const field of ['currency','preparation','originalInputRefs']) {
    if(recordSha256(snapshot[field])!==recordSha256(plan[field]))fail('INPUT_MATERIAL_HISTORY_CORE_BINDING_CHANGED')
  }
  return {event,snapshot,plan}
}
const coreOwner=(key:string)=>/^([a-zA-Z0-9_-]{1,128})__(?:tavern-prompt-v1-|program-opening-material-)/.exec(key)?.[1]
const ownsCoreKey=(key:string,sid:string)=>key.startsWith(`${sid}__tavern-prompt-v1-`)
  ||key.startsWith(`${sid}__program-opening-material-`)
interface MaterialEventIndex {
  length:number
  materials:SessionEvent<'request/material'>[]
  openings:SessionEvent<'opening/invocation'>[]
}
const materialEventIndexes=new WeakMap<object,MaterialEventIndex>()
function materialEvents(deps:Pick<TavernMaterialHistoryDependenciesV1,'nativeCut'>,events:MaterialEvents) {
  const cut=deps.nativeCut
  if(!cut||cut.source!=='native')return {
    materials:materialEventArray(events).filter((event):event is SessionEvent<'request/material'>=>event.type==='request/material'),
    openings:materialEventArray(events).filter((event):event is SessionEvent<'opening/invocation'>=>event.type==='opening/invocation')}
  let index=materialEventIndexes.get(cut.owner)
  if(!index){index={length:0,materials:[],openings:[]};materialEventIndexes.set(cut.owner,index)}
  if(index.length<cut.length) {
    cut.forEachRange(index.length,cut.length,event=>{
      if(event.type==='request/material')index!.materials.push(event)
      else if(event.type==='opening/invocation')index!.openings.push(event)
    })
    index.length=cut.length
  }
  function prefix<E extends {readonly seq:number}>(rows:readonly E[]):readonly E[] {
    let start=0,end=rows.length
    while(start<end){const middle=(start+end)>>>1;if(rows[middle]!.seq<events.length)start=middle+1;else end=middle}
    return start===rows.length?rows:rows.slice(0,start)
  }
  return {materials:prefix(index.materials),openings:prefix(index.openings)}
}
interface PublicationFacts {
  readonly publication:ReturnType<typeof readPublication>
  readonly references:readonly (readonly [string,string])[]
  readonly rows:readonly {readonly key:string;readonly value:TavernBoundCoreMaterialRowV1}[]
  readonly inputs:readonly {readonly key:string;readonly value:unknown;readonly sha256:string;readonly bytes:number}[]
}
function capturePublication(deps:TavernMaterialHistoryDependenciesV1,event:NativeRequestMaterialEventV1,owner:string,
  references:Map<string,string>,budget:MaterialReadBudgetV1,events:MaterialEvents,
  projections:readonly SessionMessageProjection[],reads:RoleplayInputStateRead<PublicationFacts>[]) {
  if(!deps.inputState)return readPublication(deps,event,owner,references,budget,events)
  const read=deps.inputState.captureClosedHistoricalFacts(deps.sessionId,
    `tavern-material-publication:${tavernMaterialProjectionIdentityV1(projections)}:${owner}:${event.seq}`,()=>{
      verifyMaterials(deps,events,projections,[event])
      // Publication facts retain only their used inputs, while pure decoding
      // stays shared across the same complete catalog as before segmentation.
      const local=budgetV1(budget),refs=new Map<string,string>(),publication=readPublication(deps,event,owner,refs,local,events)
      return Object.freeze({publication:Object.freeze(publication),references:Object.freeze([...refs]),
        rows:Object.freeze([...local.rows].map(([key,row])=>Object.freeze({key,value:row}))),
        inputs:Object.freeze([...local.inputs].map(([key,input])=>Object.freeze({key,...input})))})
    })
  reads.push(read)
  const facts=read.data
  for(const [key,sha256] of facts.references)rememberReference(references,{key,sha256})
  // Published derived rows already passed their producer's input limits.
  // Historical captures reuse them without charging growing metadata as new input.
  for(const row of facts.rows)if(!budget.rows.has(row.key)){
    budget.rows.set(row.key,row.value)
  }
  for(const input of facts.inputs){
    const previous=budget.inputs.get(input.key)
    if(previous&&previous.sha256!==input.sha256)fail('INPUT_MATERIAL_HISTORY_CORE_REF_CONFLICT')
    if(!previous){
      budget.inputs.set(input.key,{sha256:input.sha256,value:input.value,bytes:input.bytes});budget.bytes+=input.bytes
    }
  }
  if(budget.bytes>67_108_864)fail('INPUT_MATERIAL_HISTORY_CORE_BUDGET')
  return facts.publication
}
/** One exact published request, selected by its actual Native event. A Story
 * maintenance consumer does not need a catalog of every historical request. */
export function captureRoleplayTavernMaterialPublicationV1(deps:TavernMaterialHistoryDependenciesV1,
  ref:TavernSourceMaterialPublicationV1) {
  deps.assertOwnerCurrent()
  const nativeCut=deps.nativeCut??(deps.session?deps.inputState?.nativeHistory?.cut?.<SessionEvent>(deps.session):undefined)
  if(nativeCut)deps={...deps,nativeCut}
  const events=deps.events(),event=events[ref.nativeSeq]
  if(ref.ownerSessionId!==deps.sessionId||event?.type!=='request/material'
    ||nativeInputSha256(event)!==ref.nativeEventSha256||nativeInputSha256(event.data)!==ref.nativeRecordSha256
    ||!sameNative(event.data.snapshot,ref.snapshotRef)||!sameNative(event.data.plan,ref.planRef)) {
    fail('INPUT_MATERIAL_HISTORY_CORE_REF_CONFLICT')
  }
  const reads:RoleplayInputStateRead<PublicationFacts>[]=[],references=new Map<string,string>()
  const publication=capturePublication(deps,event,ref.ownerSessionId,references,budgetV1(),events,[...deps.projections()],reads)
  deps.assertOwnerCurrent()
  return publication
}
/** Consume only rendered contributions from this exact publication. Original
 * author partitions can include deliberately suppressed legacy lore; selected
 * messages and their history projections are not author-contribution inputs. */
export function collectRoleplayTavernPublishedAuthorMaterialV1(
  publication:ReturnType<typeof captureRoleplayTavernMaterialPublicationV1>,deps:TavernMaterialHistoryDependenciesV1) {
  if(isTavernHistoryTextOnlyMaterialV1(publication)) {
    const inherited=publication.snapshot.payload.authorMaterial as TavernSourceMaterialPublicationV1|undefined
    if(!inherited||inherited.nativeSeq>=publication.event.seq)fail('SCHEMA_MAINTENANCE_AUTHOR_MATERIAL_UNAVAILABLE')
    publication=captureRoleplayTavernMaterialPublicationV1(deps,inherited)
    if(isTavernHistoryTextOnlyMaterialV1(publication))fail('SCHEMA_MAINTENANCE_AUTHOR_MATERIAL_UNAVAILABLE')
  }
  const transform=publication.plan.payload.nativeTransform as Pick<NativeRequestMaterialTransformV1,
    'sections'|'insertions'|'anchoredInsertions'>|undefined,
    prompt=publication.plan.payload.promptPlan as {finalLore?:readonly TavernNativeFinalLoreTextV1[];
      community?:CommunityExecutionRecord}|undefined,
    audit=publication.snapshot.payload.injectionAudit as {consumers?:readonly {
      consumer:'scan'|'chat';results:readonly {registrationSha256:string;accepted:boolean}[]
    }[]}|undefined
  if(!transform?.sections||!prompt?.finalLore)fail('SCHEMA_MAINTENANCE_MATERIAL_UNSUPPORTED')
  const sections=new Set(['roleplay:cards','roleplay:rules','roleplay:examples','roleplay:community-preset']),
    authorGroups=transform.sections.filter(section=>sections.has(section.name))
      .map(section=>({id:section.name,text:section.replacementText})),
    authoredRefs=new Set<string>(),loreMarkers=new Set(['worldInfoBefore','worldInfoAfter'])
  // The producer's prompt catalog omits chatHistory and generated Advice or
  // history wrappers. An arbitrary community-* insertion is not enough.
  for(const row of prompt.community?.prompts??[]) {
    // Import identifies these two marker names exactly; their pure lore is
    // already supplied by finalLore. Card/example markers remain authored DATA.
    if(row.role!=='system'&&!loreMarkers.has(row.identifier))authoredRefs.add('community-'+row.identifier)
  }
  for(const cut of audit?.consumers??[])if(cut.consumer==='chat') {
    for(const row of cut.results)if(row.accepted)authoredRefs.add('inject-'+row.registrationSha256)
  }
  for(const row of [...transform.insertions,...(transform.anchoredInsertions??[])]) {
    if(authoredRefs.has(row.contributionRef))authorGroups.push({id:row.contributionRef,text:row.renderedText})
  }
  return {authorGroups,finalLore:prompt.finalLore}
}

/** Native-only text projections belong to the common publication history, but
 * they did not execute author programs, evaluate lore or advance its timing. */
export function isTavernHistoryTextOnlyMaterialV1(publication:ReturnType<typeof readPublication>):boolean {
  return publication.snapshot.payload.encoding==='native-settled-story-text-capture-v1'
}
function assertOpeningCatalog(deps:TavernMaterialHistoryDependenciesV1,
  publications:readonly ReturnType<typeof readPublication>[],events:readonly SessionEvent[]):void {
  const openings=publications.filter(({snapshot})=>snapshot.encoding==='core-program-opening-material-record-v1')
  if(!openings.length)return
  const invocations=new Map<number,ReturnType<typeof validateNativeOpeningInvocationV1>>(),
    operations=new Map<string,number>(),messages=new Map<string,number>()
  for(const event of materialEvents(deps,events).openings){
    const invocation=decodeOpeningInvocation(deps,event)
    invocations.set(Number(event.seq),invocation)
    const {operationId,messageId}=invocation.identity
    operations.set(operationId,(operations.get(operationId)??0)+1)
    messages.set(messageId,(messages.get(messageId)??0)+1)
  }
  // A later invocation may make an old publication ambiguous. That is a new
  // catalog fact, so a cached old publication never silences this comparison.
  for(const {snapshot} of openings){
    const row=snapshot as RoleplayOpeningMaterialRecordV1,invocation=invocations.get(row.nativeOwner.invocationRef.seq)
    if(!invocation||operations.get(invocation.identity.operationId)!==1||messages.get(invocation.identity.messageId)!==1)
      fail('INPUT_MATERIAL_HISTORY_OPENING_INVOCATION_AMBIGUOUS')
  }
}
function assertPrefixCurrent(deps:TavernMaterialHistoryDependenciesV1,events:readonly SessionEvent[],sha256:string,
  code:string):void {
  if(deps.inputState&&deps.session){
    // The actual Session owns this immutable contiguous prefix. Its current
    // surface getter keeps used projection definitions live across reuse.
    deps.session.surface.contentGeneration
    if(Number(deps.session.seq)<events.length||events.length>0
      &&deps.session.eventAt((events.length-1) as SessionSeq)!==events.at(-1))fail(code)
    return
  }
  const current=deps.events()
  if(current.length<events.length||nativeInputSha256(current.slice(0,events.length))!==sha256)fail(code)
}
type MaterialPublication=ReturnType<typeof readPublication>
export interface TavernMaterialPublicationSequenceV1 {
  readonly owner:object
  readonly length:number
  at(index:number):MaterialPublication|undefined
  range(start?:number,end?:number):IterableIterator<MaterialPublication>
  current():boolean
  assertCurrent():void
}
function publicationSequence(owner:object,rows:readonly MaterialPublication[],length:number,assertCurrent:()=>void)
  :TavernMaterialPublicationSequenceV1 {
  return Object.freeze({owner,length,
    at(index:number){return Number.isSafeInteger(index)&&index>=0&&index<length?rows[index]:undefined},
    *range(start=0,end=length){
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>length)
        throw RangeError('Material publication range is outside this cut')
      for(let index=start;index<end;index++)yield rows[index]!
    },
    current(){try{assertCurrent();return true}catch{return false}},assertCurrent})
}
interface NativeMaterialCatalog {
  readonly owner:object
  readonly purpose:string
  readonly publications:MaterialPublication[]
  readonly references:Map<string,string>
  readonly referenceRows:{key:string;sha256:string}[]
  readonly referenceDigest:Hash
  readonly budget:MaterialReadBudgetV1
  readonly operations:Map<string,number>
  readonly messages:Map<string,number>
  readonly publishedOperations:Set<string>
  readonly publishedMessages:Set<string>
  materials:number
  openings:number
  nativeLength:number
  read?:RoleplayInputStateRead<unknown>
}
const nativeMaterialCatalogs=new WeakMap<object,WeakMap<object,WeakMap<object,Map<string,NativeMaterialCatalog>>>>()
let nextMaterialCatalog=0
function captureNativeMaterialHistory(deps:TavernMaterialHistoryDependenciesV1,completePrefix:boolean,
  cut:SessionHistoryCut<SessionEvent>,projections:readonly SessionMessageProjection[]) {
  const inputState=deps.inputState!,projectionIdentity=tavernMaterialProjectionIdentityV1(projections)
  let inputs=nativeMaterialCatalogs.get(cut.owner)
  if(!inputs){inputs=new WeakMap();nativeMaterialCatalogs.set(cut.owner,inputs)}
  let tables=inputs.get(inputState)
  if(!tables){tables=new WeakMap();inputs.set(inputState,tables)}
  let catalogs=tables.get(deps.table)
  if(!catalogs){catalogs=new Map();tables.set(deps.table,catalogs)}
  const key=`${deps.sessionId}:${completePrefix?'all':'own'}:${projectionIdentity}`
  let catalog=catalogs.get(key)
  // Domain invalidation propagates into the aggregate closed read eagerly.
  // Its current() consumes that result in O(1), without replaying old children.
  if(catalog&&(catalog.nativeLength>cut.length||!catalog.read?.current()))catalog=undefined
  if(!catalog){
    catalog={owner:Object.freeze({}),purpose:`tavern-material-catalog:${++nextMaterialCatalog}`,
      publications:[],references:new Map(),referenceRows:[],referenceDigest:createHash('sha256').update('['),
      budget:budgetV1(),operations:new Map(),messages:new Map(),
      publishedOperations:new Set(),publishedMessages:new Set(),materials:0,openings:0,nativeLength:0}
    catalogs.set(key,catalog)
  }
  const actual=catalog,index=materialEvents(deps,cut),previous=actual.read,
    changed=!previous||index.materials.length!==actual.materials||index.openings.length!==actual.openings
  if(changed)try{
    actual.read=inputState.captureClosedHistoricalFacts(deps.sessionId,
      `${actual.purpose}:${index.materials.length}:${index.openings.length}`,()=>{
        // This dependency retains the exact previously consumed Domain rows.
        // Native appends add only their new publication facts to the closure.
        previous?.assertCurrent()
        let hasOpeningPublication=actual.publishedOperations.size>0
        for(let position=actual.materials;!hasOpeningPublication&&position<index.materials.length;position++){
          const event=index.materials[position]!,owner=coreOwner(event.data.snapshot.key)
          hasOpeningPublication=!!owner&&(completePrefix||owner===deps.sessionId)
            &&event.data.snapshot.key.startsWith(`${owner}__program-opening-material-`)
        }
        // Unreferenced opening events did not belong to the old catalog's
        // grammar. Interpret them only once an actual opening publication uses it.
        const openingStart=actual.publishedOperations.size?actual.openings:0
        for(let position=openingStart;hasOpeningPublication&&position<index.openings.length;position++){
          const invocation=decodeOpeningInvocation(deps,index.openings[position]!),{operationId,messageId}=invocation.identity,
            operationCount=(actual.operations.get(operationId)??0)+1,messageCount=(actual.messages.get(messageId)??0)+1
          actual.operations.set(operationId,operationCount);actual.messages.set(messageId,messageCount)
          if(operationCount!==1&&actual.publishedOperations.has(operationId)
            ||messageCount!==1&&actual.publishedMessages.has(messageId))
            fail('INPUT_MATERIAL_HISTORY_OPENING_INVOCATION_AMBIGUOUS')
        }
        for(let position=actual.materials;position<index.materials.length;position++){
          const event=index.materials[position]! as NativeRequestMaterialEventV1,
            owner=completePrefix?coreOwner(event.data.snapshot.key):deps.sessionId,
            planOwner=completePrefix?coreOwner(event.data.plan.key):deps.sessionId,
            ownsSnapshot=completePrefix?!!owner:ownsCoreKey(event.data.snapshot.key,deps.sessionId),
            ownsPlan=completePrefix?!!planOwner:ownsCoreKey(event.data.plan.key,deps.sessionId)
          if(ownsSnapshot!==ownsPlan||owner!==planOwner)fail('INPUT_MATERIAL_HISTORY_CORE_OWNER_UNPROVEN')
          if(!ownsPlan)continue
          if(actual.publications.length>=4096)fail('INPUT_MATERIAL_HISTORY_LIMIT')
          const references=new Map<string,string>(),reads:RoleplayInputStateRead<PublicationFacts>[]=[],
            publication=capturePublication(deps,event,owner!,references,actual.budget,cut,projections,reads)
          for(const [refKey,sha256] of references){
            if(!actual.references.has(refKey)){
              const ref={key:refKey,sha256}
              if(actual.referenceRows.length)actual.referenceDigest.update(',')
              actual.referenceDigest.update(stableJson(ref)!, 'utf8');actual.referenceRows.push(ref)
            }
            rememberReference(actual.references,{key:refKey,sha256})
          }
          if(publication.snapshot.encoding==='core-program-opening-material-record-v1'){
            const row=publication.snapshot as RoleplayOpeningMaterialRecordV1,invocation=actual.budget.invocations.get(row.nativeOwner.invocationRef.seq)
              ??decodeOpeningInvocation(deps,cut.at(row.nativeOwner.invocationRef.seq)! as SessionEvent<'opening/invocation'>),
              {operationId,messageId}=invocation.identity
            if(actual.operations.get(operationId)!==1||actual.messages.get(messageId)!==1)
              fail('INPUT_MATERIAL_HISTORY_OPENING_INVOCATION_AMBIGUOUS')
            actual.publishedOperations.add(operationId);actual.publishedMessages.add(messageId)
          }
          actual.publications.push(publication)
        }
        return null
      })
    actual.materials=index.materials.length;actual.openings=index.openings.length
  }catch(error){catalogs.delete(key);throw error}
  actual.nativeLength=cut.length
  const read=actual.read!,length=actual.publications.length,referenceCount=actual.referenceRows.length,
    prefixSha256=cut.nativeInputPrefixSha256()??nativeInputSha256(cut.materialize()),
    assertCurrent=()=>{
      deps.assertOwnerCurrent()
      const current=deps.inputState!.nativeHistory?.cut?.<SessionEvent>(deps.session!),definitions=deps.projections()
      if(current&&(current.owner!==cut.owner||current.length<cut.length)
        ||!current&&(Number(deps.session!.seq)<cut.length||cut.length>0
          &&deps.session!.eventAt((cut.length-1) as SessionSeq)!==cut.at(cut.length-1))
        ||definitions.length!==projections.length
        ||definitions.some((definition,position)=>definition!==projections[position]))fail('INPUT_MATERIAL_HISTORY_CHANGED')
      read.assertCurrent()
    },sequence=publicationSequence(actual.owner,actual.publications,length,assertCurrent)
  let publications:readonly MaterialPublication[]|undefined,coreRefs:readonly {key:string;sha256:string}[]|undefined
  const evidence=Object.freeze({schemaVersion:1,encoding:'native-bound-Core-material-history-v1',
    authority:'consumer-data-only',sessionId:deps.sessionId,prefixLength:cut.length,prefixSha256,
    get coreRefs(){return coreRefs??=freeze(actual.referenceRows.slice(0,referenceCount).map(ref=>({...ref})))}})
  read.assertCurrent()
  const evidenceSummary=Object.freeze({schemaVersion:1,encoding:evidence.encoding,authority:evidence.authority,
    sessionId:deps.sessionId,prefixLength:cut.length,prefixSha256,coreRefsCount:referenceCount,
    coreRefsSha256:actual.referenceDigest.copy().update(']').digest('hex')})
  return {get events(){return cut.materialize()},nativeCut:cut,publicationSequence:sequence,evidenceSummary,
    get publications(){return publications??=Object.freeze(actual.publications.slice(0,length))},assertCurrent,evidence}
}
function captureMaterialHistory(deps:TavernMaterialHistoryDependenciesV1,completePrefix:boolean) {
  deps.assertOwnerCurrent()
  const nativeCut=deps.nativeCut??(deps.session?deps.inputState?.nativeHistory?.cut?.<SessionEvent>(deps.session):undefined)
  if(nativeCut)deps={...deps,nativeCut}
  if(nativeCut?.source==='native'&&deps.inputState&&deps.session)
    return captureNativeMaterialHistory(deps,completePrefix,nativeCut,[...deps.projections()])
  const events=deps.events(),prefixLength=events.length,
    prefixSha256=tavernMaterialNativePrefixSha256V1(deps,events),
    projections=[...deps.projections()],references=new Map<string,string>(),budget=budgetV1(),
    publications:{event:NativeRequestMaterialEventV1;snapshot:TavernBoundCoreMaterialRowV1;plan:TavernBoundCoreMaterialRowV1}[]=[],
    selected:{event:NativeRequestMaterialEventV1;owner:string}[]=[],reads:RoleplayInputStateRead<PublicationFacts>[]=[]
  for(const raw of materialEvents(deps,events).materials) {
    const event=raw as NativeRequestMaterialEventV1,
      owner=completePrefix?coreOwner(event.data.snapshot.key):deps.sessionId,
      planOwner=completePrefix?coreOwner(event.data.plan.key):deps.sessionId,
      ownsSnapshot=completePrefix?!!owner:ownsCoreKey(event.data.snapshot.key,deps.sessionId),
      ownsPlan=completePrefix?!!planOwner:ownsCoreKey(event.data.plan.key,deps.sessionId)
    if(ownsSnapshot!==ownsPlan)fail('INPUT_MATERIAL_HISTORY_CORE_OWNER_UNPROVEN')
    if(!ownsPlan)continue
    if(owner!==planOwner)fail('INPUT_MATERIAL_HISTORY_CORE_OWNER_UNPROVEN')
    if(selected.length>=4096)fail('INPUT_MATERIAL_HISTORY_LIMIT')
    selected.push({event,owner:owner!})
  }
  if(!deps.inputState)verifyMaterials(deps,events,projections,selected.map(({event})=>event))
  for(const {event,owner} of selected)publications.push(capturePublication(deps,event,owner,references,budget,events,projections,reads))
  assertOpeningCatalog(deps,publications,events)
  const assertCurrent=()=>{
    deps.assertOwnerCurrent()
    const actualProjections=deps.projections()
    // Own Native appends may extend this prefix during retry. Native's real
    // selected capability checks those additions; old bytes stay immutable.
    assertPrefixCurrent(deps,events,prefixSha256,'INPUT_MATERIAL_HISTORY_CHANGED')
    if(actualProjections.length!==projections.length||actualProjections.some((item,index)=>item!==projections[index]))
      fail('INPUT_MATERIAL_HISTORY_CHANGED')
    if(deps.inputState)for(const read of reads)read.assertCurrent()
    else {
      for(const [key,sha256] of references)if(recordSha256(deps.table.get(key))!==sha256)
        fail('INPUT_MATERIAL_HISTORY_CORE_ROW_CHANGED')
      assertOpeningInputsCurrent(deps,budget)
    }
  }
  const coreRefs=[...references].map(([key,sha256])=>({key,sha256}))
  return {events:nativeCut?events:deps.inputState&&deps.session?Object.freeze([...events]):freeze([...events]),
    ...(nativeCut?{nativeCut}:{}),
    publications:Object.freeze(publications.map(row=>Object.freeze(row))),
    publicationSequence:publicationSequence(Object.freeze({}),publications,publications.length,assertCurrent),assertCurrent,
    evidenceSummary:freeze({schemaVersion:1,encoding:'native-bound-Core-material-history-v1',authority:'consumer-data-only',
      sessionId:deps.sessionId,prefixLength,prefixSha256,coreRefsCount:coreRefs.length,coreRefsSha256:recordSha256(coreRefs)}),evidence:freeze({schemaVersion:1,
    encoding:'native-bound-Core-material-history-v1',authority:'consumer-data-only',sessionId:deps.sessionId,
    prefixLength,prefixSha256,coreRefs})}
}
export const captureRoleplayTavernMaterialHistoryV1=(deps:TavernMaterialHistoryDependenciesV1)=>
  captureMaterialHistory(deps,false)
/** Complete factual catalog at a real cut. This is used by Source freeze;
 * current request injection consumers always use the separate own catalog. */
export const captureRoleplayTavernMaterialPrefixV1=(deps:TavernMaterialHistoryDependenciesV1)=>
  captureMaterialHistory(deps,true)
/** Data rows at a Native cut, still over the actual Session's retained bytes.
 * Child inheritance does not restore a parent's live injection registry. */
export function tavernMaterialPublicationRefsV1(history:ReturnType<typeof captureRoleplayTavernMaterialHistoryV1>)
  :readonly TavernSourceMaterialPublicationV1[] {
  return freeze(history.publications.map(tavernMaterialPublicationRefV1))
}
export function tavernMaterialPublicationRefV1({event,snapshot}:ReturnType<typeof readPublication>)
  :TavernSourceMaterialPublicationV1 {
  return {ownerSessionId:snapshot.sessionId,nativeSeq:Number(event.seq),nativeEventSha256:nativeInputSha256(event),
    snapshotRef:event.data.snapshot,planRef:event.data.plan,nativeRecordSha256:nativeInputSha256(event.data)}
}
type InheritedMaterialDependencies=TavernMaterialHistoryDependenciesV1&{
  readonly inheritedEventCount:number;readonly publications:readonly TavernSourceMaterialPublicationV1[]}
function captureInheritedMaterialHistory(deps:InheritedMaterialDependencies) {
  deps.assertOwnerCurrent()
  const nativeCut=deps.nativeCut??(deps.session?deps.inputState?.nativeHistory?.cut?.<SessionEvent>(deps.session):undefined)
  if(nativeCut)deps={...deps,nativeCut}
  const actualEvents=deps.events(),cut=deps.inheritedEventCount,projections=[...deps.projections()],
    references=new Map<string,string>(),budget=budgetV1(),
    publications:ReturnType<typeof readPublication>[]=[],seen=new Set<number>(),
    selected:{event:NativeRequestMaterialEventV1;owner:string}[]=[],reads:RoleplayInputStateRead<PublicationFacts>[]=[]
  if(!Number.isSafeInteger(cut)||cut<0||cut>actualEvents.length||deps.publications.length>4096)
    fail('INPUT_MATERIAL_HISTORY_INHERITED_CUT_INVALID')
  const events=actualEvents.slice(0,cut),prefixSha256=tavernMaterialNativePrefixSha256V1(deps,actualEvents,cut)
  let previousNativeSeq=-1
  for(const original of deps.publications) {
    const ref=cloneRoleplayTavernLoreDataV1(original,8192)
    if(!Number.isSafeInteger(ref.nativeSeq)||ref.nativeSeq<=previousNativeSeq||ref.nativeSeq>=cut||seen.has(ref.nativeSeq)
      ||typeof ref.ownerSessionId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(ref.ownerSessionId)
      ||ref.ownerSessionId===deps.sessionId)fail('INPUT_MATERIAL_HISTORY_INHERITED_REF_INVALID')
    seen.add(ref.nativeSeq)
    previousNativeSeq=ref.nativeSeq
    const event=events[ref.nativeSeq]
    if(event?.type!=='request/material'||nativeInputSha256(event)!==ref.nativeEventSha256
      ||nativeInputSha256(event.data)!==ref.nativeRecordSha256
      ||recordSha256(event.data.snapshot)!==recordSha256(ref.snapshotRef)
      ||recordSha256(event.data.plan)!==recordSha256(ref.planRef))fail('INPUT_MATERIAL_HISTORY_INHERITED_REF_CHANGED')
    selected.push({event,owner:ref.ownerSessionId})
  }
  if(!deps.inputState)verifyMaterials(deps,events,projections,selected.map(({event})=>event))
  for(const {event,owner} of selected)publications.push(capturePublication(deps,event,owner,references,budget,events,projections,reads))
  assertOpeningCatalog(deps,publications,events)
  for(const event of materialEvents(deps,events).materials) {
    const sourceOwner=coreOwner(event.data.snapshot.key),planOwner=coreOwner(event.data.plan.key)
    if(!!sourceOwner!==!!planOwner||sourceOwner!==planOwner||sourceOwner&&!seen.has(Number(event.seq)))
      fail('INPUT_MATERIAL_HISTORY_INHERITED_CATALOG_INCOMPLETE')
  }
  const assertCurrent=()=>{
    deps.assertOwnerCurrent()
    const currentProjections=deps.projections()
    assertPrefixCurrent(deps,events,prefixSha256,'INPUT_MATERIAL_HISTORY_INHERITED_CHANGED')
    if(currentProjections.length!==projections.length||currentProjections.some((value,index)=>value!==projections[index]))
      fail('INPUT_MATERIAL_HISTORY_INHERITED_CHANGED')
    if(deps.inputState)for(const read of reads)read.assertCurrent()
    else {
      for(const [key,sha256] of references)if(recordSha256(deps.table.get(key))!==sha256)
        fail('INPUT_MATERIAL_HISTORY_CORE_ROW_CHANGED')
      assertOpeningInputsCurrent(deps,budget)
    }
  }
  return {events:deps.inputState&&deps.session?Object.freeze(events):freeze(events),
    publications:Object.freeze(publications.map(row=>Object.freeze(row))),
    publicationSequence:publicationSequence(Object.freeze({}),publications,publications.length,assertCurrent),assertCurrent,evidence:freeze({schemaVersion:1,
    encoding:'native-inherited-Core-material-history-v1',authority:'consumer-data-only',sessionId:deps.sessionId,
    prefixLength:cut,prefixSha256,coreRefs:[...references].map(([key,sha256])=>({key,sha256}))})}
}
const immutableInheritedCatalogs=new WeakSet<object>()
const inheritedCatalogReads=new WeakMap<object,WeakMap<object,{
  readonly nativeOwner:object;readonly table:object;readonly key:string;readonly purpose:string
  readonly read:RoleplayInputStateRead<ReturnType<typeof captureInheritedMaterialHistory>>
}>>()
function immutableInheritedCatalog(refs:readonly TavernSourceMaterialPublicationV1[]):boolean {
  if(immutableInheritedCatalogs.has(refs))return true
  // Caller-owned mutable descriptors retain the ordinary validating path.
  // Only the complete immutable ref DATA can address a retained closed fact.
  if(!Object.isFrozen(refs)||refs.some(ref=>!Object.isFrozen(ref)
    ||!Object.isFrozen(ref.snapshotRef)||!Object.isFrozen(ref.planRef)))return false
  immutableInheritedCatalogs.add(refs);return true
}
export function captureRoleplayTavernInheritedMaterialHistoryV1(deps:InheritedMaterialDependencies) {
  deps.assertOwnerCurrent()
  const cut=deps.nativeCut??(deps.session?deps.inputState?.nativeHistory?.cut?.<SessionEvent>(deps.session):undefined)
  if(!deps.inputState||!deps.session||cut?.source!=='native'||!immutableInheritedCatalog(deps.publications))
    return captureInheritedMaterialHistory(deps)
  const inputState=deps.inputState,projections=[...deps.projections()],
    key=`${deps.sessionId}:${deps.inheritedEventCount}:${tavernMaterialProjectionIdentityV1(projections)}`
  let catalogs=inheritedCatalogReads.get(inputState)
  if(!catalogs){catalogs=new WeakMap();inheritedCatalogReads.set(inputState,catalogs)}
  let retained=catalogs.get(deps.publications)
  if(!retained||retained.nativeOwner!==cut.owner||retained.table!==deps.table||retained.key!==key||!retained.read.current()){
    const purpose=`tavern-inherited-material-catalog:${++nextMaterialCatalog}`,
      read=inputState.captureClosedHistoricalFacts(deps.sessionId,purpose,()=>captureInheritedMaterialHistory({...deps,nativeCut:cut}))
    retained={nativeOwner:cut.owner,table:deps.table,key,purpose,read};catalogs.set(deps.publications,retained)
  }
  const read=retained.read,history=read.data,assertCurrent=()=>{
    deps.assertOwnerCurrent()
    const current=inputState.nativeHistory?.cut?.<SessionEvent>(deps.session!),definitions=deps.projections()
    if(current&&(current.owner!==cut.owner||current.length<deps.inheritedEventCount)
      ||!current&&(Number(deps.session!.seq)<deps.inheritedEventCount||deps.inheritedEventCount>0
        &&deps.session!.eventAt((deps.inheritedEventCount-1) as SessionSeq)!==cut.at(deps.inheritedEventCount-1))
      ||definitions.length!==projections.length||definitions.some((definition,index)=>definition!==projections[index]))
      fail('INPUT_MATERIAL_HISTORY_INHERITED_CHANGED')
    read.assertCurrent()
  }
  read.assertCurrent()
  return {events:history.events,publications:history.publications,evidence:history.evidence,assertCurrent,
    publicationSequence:publicationSequence(history.publicationSequence.owner,history.publications,history.publications.length,assertCurrent)}
}
