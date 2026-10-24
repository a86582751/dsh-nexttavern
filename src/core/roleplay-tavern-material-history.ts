/** Read the exact Core records bound by real Native material events once.
 * These historical facts grant no new step, claim, Source or dispatch rights. */
import {nativeInputSha256,verifyNativeRequestMaterialHistoryV1,
  validateNativeOpeningInvocationV1,validateNativeOpeningRequestAttemptV1} from '@deepseek-ai/dsh-agent-loop'
import type {NativeRequestMaterialEventV1} from '@deepseek-ai/dsh-agent-loop'
import type {Session,SessionEvent,SessionMessageProjection,SessionSeq} from '@deepseek-ai/dsh-session'
import type {createRoleplayInputStateOwner,RoleplayInputStateRead} from './roleplay-input-state.js'
import {recordSha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import type {TavernSourceMaterialPublicationV1} from './roleplay-tavern-source-inheritance-types.js'
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
  readonly inputState?:Pick<ReturnType<typeof createRoleplayInputStateOwner>,'captureHistoricalFacts'>
  readonly session?:Session
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
  deps:Pick<TavernMaterialHistoryDependenciesV1,'sessionId'|'inputState'>,events:readonly SessionEvent[]):string {
  const compute=()=>nativeInputSha256(events)
  return deps.inputState?.captureHistoricalFacts(deps.sessionId,`tavern-native-prefix:${events.length}`,compute).data??compute()
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
  return deps.inputState?.captureHistoricalFacts(deps.sessionId,`tavern-opening-invocation:${event.seq}`,compute).data??compute()
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
    if(invocation.prefix.eventCount!==seq||tavernMaterialNativePrefixSha256V1(deps,events.slice(0,seq))!==invocation.prefix.sha256)
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
  events:readonly SessionEvent[]) {
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
    plan as RoleplayOpeningMaterialRecordV1,events,budget)
  else for(const field of ['currency','preparation','originalInputRefs']) {
    if(recordSha256(snapshot[field])!==recordSha256(plan[field]))fail('INPUT_MATERIAL_HISTORY_CORE_BINDING_CHANGED')
  }
  return {event,snapshot,plan}
}
const coreOwner=(key:string)=>/^([a-zA-Z0-9_-]{1,128})__(?:tavern-prompt-v1-|program-opening-material-)/.exec(key)?.[1]
const ownsCoreKey=(key:string,sid:string)=>key.startsWith(`${sid}__tavern-prompt-v1-`)
  ||key.startsWith(`${sid}__program-opening-material-`)
interface PublicationFacts {
  readonly publication:ReturnType<typeof readPublication>
  readonly references:readonly (readonly [string,string])[]
  readonly rows:readonly {readonly key:string;readonly value:TavernBoundCoreMaterialRowV1}[]
  readonly inputs:readonly {readonly key:string;readonly value:unknown;readonly sha256:string;readonly bytes:number}[]
}
function capturePublication(deps:TavernMaterialHistoryDependenciesV1,event:NativeRequestMaterialEventV1,owner:string,
  references:Map<string,string>,budget:MaterialReadBudgetV1,events:readonly SessionEvent[],
  projections:readonly SessionMessageProjection[],reads:RoleplayInputStateRead<PublicationFacts>[]) {
  if(!deps.inputState)return readPublication(deps,event,owner,references,budget,events)
  const read=deps.inputState.captureHistoricalFacts(deps.sessionId,
    `tavern-material-publication:${tavernMaterialProjectionIdentityV1(projections)}:${owner}:${event.seq}`,()=>{
      verifyNativeRequestMaterialHistoryV1({events,projections,session:deps.session,materials:[{
        materialEvent:event,expectedHeaderSha256:event.data.header.sha256}]})
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
function assertOpeningCatalog(deps:TavernMaterialHistoryDependenciesV1,
  publications:readonly ReturnType<typeof readPublication>[],events:readonly SessionEvent[]):void {
  const openings=publications.filter(({snapshot})=>snapshot.encoding==='core-program-opening-material-record-v1')
  if(!openings.length)return
  const invocations=new Map<number,ReturnType<typeof validateNativeOpeningInvocationV1>>(),
    operations=new Map<string,number>(),messages=new Map<string,number>()
  for(const event of events)if(event.type==='opening/invocation'){
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
function captureMaterialHistory(deps:TavernMaterialHistoryDependenciesV1,completePrefix:boolean) {
  deps.assertOwnerCurrent()
  const events=deps.events(),prefixLength=events.length,prefixSha256=tavernMaterialNativePrefixSha256V1(deps,events),
    projections=[...deps.projections()],references=new Map<string,string>(),budget=budgetV1(),
    publications:{event:NativeRequestMaterialEventV1;snapshot:TavernBoundCoreMaterialRowV1;plan:TavernBoundCoreMaterialRowV1}[]=[],
    selected:{event:NativeRequestMaterialEventV1;owner:string}[]=[],reads:RoleplayInputStateRead<PublicationFacts>[]=[]
  for(const raw of events) {
    if(raw.type!=='request/material')continue
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
  if(!deps.inputState)verifyNativeRequestMaterialHistoryV1({events,projections,session:deps.session,
    materials:selected.map(({event})=>({materialEvent:event,expectedHeaderSha256:event.data.header.sha256}))})
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
  return {events:deps.inputState&&deps.session?Object.freeze([...events]):freeze([...events]),
    publications:Object.freeze(publications.map(row=>Object.freeze(row))),assertCurrent,evidence:freeze({schemaVersion:1,
    encoding:'native-bound-Core-material-history-v1',authority:'consumer-data-only',sessionId:deps.sessionId,
    prefixLength,prefixSha256,coreRefs:[...references].map(([key,sha256])=>({key,sha256}))})}
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
  return freeze(history.publications.map(({event,snapshot})=>({ownerSessionId:snapshot.sessionId,
    nativeSeq:Number(event.seq),nativeEventSha256:nativeInputSha256(event),
    snapshotRef:event.data.snapshot,planRef:event.data.plan,nativeRecordSha256:nativeInputSha256(event.data)})))
}
export function captureRoleplayTavernInheritedMaterialHistoryV1(deps:TavernMaterialHistoryDependenciesV1&{
  readonly inheritedEventCount:number;readonly publications:readonly TavernSourceMaterialPublicationV1[]}) {
  deps.assertOwnerCurrent()
  const actualEvents=deps.events(),cut=deps.inheritedEventCount,projections=[...deps.projections()],
    references=new Map<string,string>(),budget=budgetV1(),
    publications:ReturnType<typeof readPublication>[]=[],seen=new Set<number>(),
    selected:{event:NativeRequestMaterialEventV1;owner:string}[]=[],reads:RoleplayInputStateRead<PublicationFacts>[]=[]
  if(!Number.isSafeInteger(cut)||cut<0||cut>actualEvents.length||deps.publications.length>4096)
    fail('INPUT_MATERIAL_HISTORY_INHERITED_CUT_INVALID')
  const events=actualEvents.slice(0,cut),prefixSha256=tavernMaterialNativePrefixSha256V1(deps,events)
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
  if(!deps.inputState)verifyNativeRequestMaterialHistoryV1({events,projections,session:deps.session,
    materials:selected.map(({event})=>({materialEvent:event,expectedHeaderSha256:event.data.header.sha256}))})
  for(const {event,owner} of selected)publications.push(capturePublication(deps,event,owner,references,budget,events,projections,reads))
  assertOpeningCatalog(deps,publications,events)
  for(const event of events)if(event.type==='request/material') {
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
    publications:Object.freeze(publications.map(row=>Object.freeze(row))),assertCurrent,evidence:freeze({schemaVersion:1,
    encoding:'native-inherited-Core-material-history-v1',authority:'consumer-data-only',sessionId:deps.sessionId,
    prefixLength:cut,prefixSha256,coreRefs:[...references].map(([key,sha256])=>({key,sha256}))})}
}
