/** Owns the schema opening transaction only. Root owns guest execution,
 * maintenance/Source leases and actual Native/author-source evidence. */
import {recordSha256,sha256} from './roleplay-data.js'
import {openingIntentKey} from './roleplay-opening-selection.js'
import {mvuInitializationEventKey,mvuInitializationHeadKey} from './roleplay-mvu-initialization.js'
import {freezeMvuSchemaOpeningData,validateMvuSchemaOpeningPreparation,validateMvuSchemaOpeningPlan,
  validateMvuSchemaOpeningIntent,validateMvuSchemaNativeOpening,mvuSchemaOpeningIdentity,
  mvuSchemaOpeningEvent,mvuSchemaOpeningHead,verifyMvuSchemaOpeningFacts,schemaOpeningCode}
  from './roleplay-mvu-schema-opening-types.js'
import type {OpeningSource} from './roleplay-opening-selection.js'
import type {SchemaOpeningDeps,SchemaOpeningRequest,SchemaOpeningExecutionLive,SchemaOpeningReadiness,
  SchemaOpeningSelectResult,OpeningIntentV5,MvuSchemaOpeningEventV2,MvuSchemaOpeningHeadV2,SchemaOpeningTable,
  SchemaOpeningPublicationBoundary} from './roleplay-mvu-schema-opening-types.js'

export type {SchemaOpeningDeps,SchemaOpeningExecutionLive,SchemaOpeningReadiness,OpeningIntentV5}
  from './roleplay-mvu-schema-opening-types.js'
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const codeOf=(error:unknown)=>schemaOpeningCode(error instanceof Error?error.message:undefined)
function fail(code:string):never {throw Error(code)}
const project=(intent:OpeningIntentV5,code:string):OpeningIntentV5=>
  freezeMvuSchemaOpeningData({...intent,status:'blocked' as const,initializationCode:schemaOpeningCode(code)})

export function createRoleplayMvuSchemaOpening(deps:SchemaOpeningDeps) {
  const active=new Set<string>()
  const intentKey=(intent:OpeningIntentV5)=>openingIntentKey(intent.sessionId,intent.source.importId)
  function stored(sessionId:string,importId:string):OpeningIntentV5|undefined {
    const value=freezeRead(deps.branch,openingIntentKey(sessionId,importId))
    if(value===undefined)return
    if((value as {schemaVersion?:unknown}).schemaVersion!==5)fail('SCHEMA_OPENING_IDENTITY_CONFLICT')
    return validateMvuSchemaOpeningIntent(value as OpeningIntentV5)
  }
  const exactIntent=(intent:OpeningIntentV5)=>same(stored(intent.sessionId,intent.source.importId),intent)
  function sourceCurrent(intent:OpeningIntentV5):boolean {
    try {return deps.sourceCurrent(intent.preparation)===true}catch {return false}
  }
  /** Mutable intent transitions use exact prior readback, immutable event/head
   * writes only accept absence or the same fact. Lost ACK never repeats guest. */
  async function putExact(table:SchemaOpeningTable,key:string,next:unknown,prior?:unknown):Promise<void> {
    const value=freezeMvuSchemaOpeningData(next),actual=freezeRead(table,key)
    if(!same(actual,prior)&&!same(actual,value))fail('SCHEMA_OPENING_IDENTITY_CONFLICT')
    if(!same(actual,value))try {await table.put(key,value)}catch { /* Resolve a lost acknowledgement by exact readback only. */ }
    if(!same(freezeRead(table,key),value))fail('SCHEMA_OPENING_WRITE_UNKNOWN')
  }
  function freezeRead(table:SchemaOpeningTable,key:string):unknown {
    const value=table.get(key)
    return value===undefined?undefined:freezeMvuSchemaOpeningData(value)
  }
  async function transition(prior:OpeningIntentV5,next:OpeningIntentV5):Promise<OpeningIntentV5> {
    const value=validateMvuSchemaOpeningIntent(next)
    return deps.withLock(`opening-choice:${prior.sessionId}`,async()=>{
      if(!exactIntent(prior))fail('SCHEMA_OPENING_IDENTITY_CONFLICT')
      await putExact(deps.branch,intentKey(prior),value,prior)
      return stored(prior.sessionId,prior.source.importId)!
    })
  }
  /** Publication already owns Root's real non-reentrant Source boundary.
   * Keep this private and call it only inside publish; reacquiring withLock
   * here would wait on the same Source lease and deadlock actual Core. */
  async function transitionExactUnscoped(prior:OpeningIntentV5,next:OpeningIntentV5):Promise<OpeningIntentV5> {
    const value=validateMvuSchemaOpeningIntent(next)
    if(!exactIntent(prior))fail('SCHEMA_OPENING_IDENTITY_CONFLICT')
    await putExact(deps.branch,intentKey(prior),value,prior)
    return stored(prior.sessionId,prior.source.importId)!
  }
  function readIntent(source:OpeningSource):OpeningIntentV5|null {
    const intent=stored(source.sessionId,source.importId)
    if(!intent||!same(intent.source,source))return null
    if(!sourceCurrent(intent))return project(intent,'SOURCE_CHANGED')
    // The synchronous facade cannot run historical QuickJS verification. A
    // completed JSON row is never presented here as execution authority.
    return project(intent,intent.status==='completed'?'SCHEMA_HISTORY_UNVERIFIED':
      intent.initializationCode??'SCHEMA_OPENING_INCOMPLETE')
  }
  async function readVerified(source:OpeningSource):Promise<SchemaOpeningReadiness> {
    let intent:OpeningIntentV5|undefined
    try {
      intent=stored(source.sessionId,source.importId)
      if(!intent)return {kind:'blocked',code:'SCHEMA_OPENING_INTENT_MISSING'}
      if(!same(intent.source,source))return {kind:'blocked',code:'SOURCE_CHANGED',intent:project(intent,'SOURCE_CHANGED')}
      if(intent.status!=='completed')return {kind:'blocked',code:intent.initializationCode??'SCHEMA_OPENING_INCOMPLETE',
        intent:project(intent,intent.initializationCode??'SCHEMA_OPENING_INCOMPLETE')}
      if(!sourceCurrent(intent))fail('SOURCE_CHANGED')
      const plan=intent.initialization!,id=mvuSchemaOpeningEvent(plan,intent.nativeReceipt!).eventId
      const eventKey=mvuInitializationEventKey(intent.sessionId,id),headKey=mvuInitializationHeadKey(intent.sessionId)
      const event=freezeRead(deps.status,eventKey) as MvuSchemaOpeningEventV2|undefined
      const head=freezeRead(deps.status,headKey) as MvuSchemaOpeningHeadV2|undefined
      if(!event)fail('EVENT_MISSING')
      if(!head)fail('HEAD_MISSING')
      if(!verifyMvuSchemaOpeningFacts(intent,event,head))fail('SCHEMA_OPENING_RECORD_INVALID')
      const native=deps.readNativeOpening(intent)
      if(native.kind!=='ready'||!same(native.receipt,intent.nativeReceipt))fail(native.kind==='blocked'?schemaOpeningCode(native.code):'NATIVE_NOT_COMMITTED')
      const verified=await deps.verifyHistorical(intent,event,head)
      // Re-read all three durable rows and actual Source/native facts after
      // the async historical replay. No missing head/event is repaired here.
      if(!exactIntent(intent)||!same(freezeRead(deps.status,eventKey),event)||!same(freezeRead(deps.status,headKey),head)) {
        fail('SCHEMA_OPENING_IDENTITY_CONFLICT')
      }
      if(!sourceCurrent(intent))fail('SOURCE_CHANGED')
      const currentNative=deps.readNativeOpening(intent)
      if(currentNative.kind!=='ready'||!same(currentNative.receipt,intent.nativeReceipt))fail('NATIVE_NOT_COMMITTED')
      if(verified.kind!=='verified')fail(schemaOpeningCode(verified.code))
      return {kind:'ready',intent,event,head}
    } catch(error) {
      const code=codeOf(error)
      return {kind:'blocked',code,...(intent?{intent:project(intent,code)}:{})}
    }
  }
  async function existing(intent:OpeningIntentV5):Promise<SchemaOpeningSelectResult> {
    if(intent.status==='completed') {
      const ready=await readVerified(intent.source)
      return ready.kind==='ready'?ready.intent:{status:'busy',intent:ready.intent??project(intent,ready.code)}
    }
    return {status:'busy',intent:project(intent,intent.initializationCode??'SCHEMA_OPENING_INCOMPLETE')}
  }
  function livePlan(live:SchemaOpeningExecutionLive,intent:OpeningIntentV5) {
    const plan=validateMvuSchemaOpeningPlan(live.plan)
    if(live.kind!=='prepared'||!live.evidence||typeof live.evidence!=='object'||live.output.kind!=='accepted'
      ||!same(plan.execution,live.association)||plan.execution.outputSha256!==recordSha256(live.output)
      ||!same(plan.values,live.output.values)||!same(plan.identity,intent.preparation.identity))fail('SCHEMA_OPENING_EXECUTION_INVALID')
    // The plan must freeze precisely the producer's persisted inputs, not a
    // later current Source or a different initialization/basis descriptor.
    for(const key of ['authorSourceSha256','sourceSnapshot','initSource','freshNativeBasisProof'] as const) {
      if(!same(plan[key],intent.preparation[key]))fail('SCHEMA_OPENING_EXECUTION_INVALID')
    }
    return plan
  }
  async function publish(live:SchemaOpeningExecutionLive,intent:OpeningIntentV5):Promise<OpeningIntentV5> {
    const event=mvuSchemaOpeningEvent(intent.initialization!,intent.nativeReceipt!),head=mvuSchemaOpeningHead(event)
    const eventKey=mvuInitializationEventKey(intent.sessionId,event.eventId),headKey=mvuInitializationHeadKey(intent.sessionId)
    return deps.withPublicationBoundary(live,async()=>{
      let current=intent
      function check(stage:SchemaOpeningPublicationBoundary['stage']) {
        if(!exactIntent(current)||!sourceCurrent(current))fail('SOURCE_CHANGED')
        const native=deps.readNativeOpening(current)
        if(native.kind!=='ready'||!same(native.receipt,current.nativeReceipt))fail('NATIVE_NOT_COMMITTED')
        if(!deps.checkPublication(live,{intent:current,event,head,stage}))fail('SCHEMA_PUBLICATION_UNPROVEN')
      }
      check('before-event')
      await putExact(deps.status,eventKey,event)
      check('after-event')
      if(!same(freezeRead(deps.status,eventKey),event))fail('SCHEMA_OPENING_WRITE_UNKNOWN')
      check('before-head')
      await putExact(deps.status,headKey,head)
      check('after-head')
      if(!same(freezeRead(deps.status,eventKey),event)||!same(freezeRead(deps.status,headKey),head))fail('SCHEMA_OPENING_WRITE_UNKNOWN')
      const {initializationCode:_code,rejectionCode:_rejection,...retained}=current
      current=await transitionExactUnscoped(current,{...retained,status:'completed',revision:current.revision+1,
        initializationReceipt:{eventId:event.eventId,eventSha256:event.eventSha256,planSha256:head.planSha256,
          valuesSha256:head.valuesSha256,headSha256:recordSha256(head),headRevision:1}})
      check('completed')
      if(!verifyMvuSchemaOpeningFacts(current,event,head)||!same(freezeRead(deps.status,eventKey),event)
        ||!same(freezeRead(deps.status,headKey),head))fail('SCHEMA_OPENING_IDENTITY_CONFLICT')
      return current
    })
  }
  async function select(supplied:SchemaOpeningRequest):Promise<SchemaOpeningSelectResult> {
    const request=freezeMvuSchemaOpeningData(supplied),identity=request.identity
    if(!same(request.catalog.source,identity.source)||request.candidate.index!==identity.index
      ||request.candidate.sourcePointer!==identity.sourcePointer||request.candidate.sourceSha256!==identity.sourceSha256
      ||request.renderedText!==request.candidate.renderedText||sha256(request.renderedText)!==identity.renderedSha256) {
      fail('SCHEMA_OPENING_IDENTITY_CONFLICT')
    }
    const prior=stored(identity.sessionId,identity.source.importId)
    if(prior) {
      if(!same(mvuSchemaOpeningIdentity(prior),identity))fail('SCHEMA_OPENING_IDENTITY_CONFLICT')
      return existing(prior)
    }
    // Pure preparation may perform durable lookup/capture, but cannot spend
    // guest or Native dispatch side effects before the preparing readback.
    const prepared=await deps.prepare(request)
    if(prepared.kind!=='prepared')fail(schemaOpeningCode(prepared.code))
    const preparation=validateMvuSchemaOpeningPreparation(prepared.preparation)
    if(!same(preparation.identity,identity))fail('SCHEMA_OPENING_IDENTITY_CONFLICT')
    const candidate:OpeningIntentV5=validateMvuSchemaOpeningIntent({...identity,schemaVersion:5,mode:'schema',status:'preparing',
      renderedText:request.renderedText,revision:1,textRetained:true,preparation})
    const admitted=await deps.withLock(`opening-choice:${identity.sessionId}`,async()=>{
      const previous=stored(identity.sessionId,identity.source.importId)
      if(previous) {
        if(!same(mvuSchemaOpeningIdentity(previous),identity))fail('SCHEMA_OPENING_IDENTITY_CONFLICT')
        return {hot:false,intent:previous}
      }
      if(active.has(identity.sessionId))fail('SCHEMA_OPENING_BUSY')
      if(!sourceCurrent(candidate))fail('SOURCE_CHANGED')
      await putExact(deps.branch,intentKey(candidate),candidate)
      if(!sourceCurrent(candidate))return {hot:false,intent:candidate}
      active.add(identity.sessionId)
      return {hot:true,intent:candidate}
    })
    if(!admitted.hot)return existing(admitted.intent)
    let intent=admitted.intent,live:SchemaOpeningExecutionLive|undefined
    try {
      const execution=await deps.executeInitialization(intent.preparation)
      if(execution.kind!=='prepared') {
        intent=await transition(intent,{...intent,status:execution.kind==='unavailable'?'unknown':'blocked',
          revision:intent.revision+1,initializationCode:schemaOpeningCode(execution.code)})
        return {status:'busy',intent}
      }
      live=execution
      const plan=livePlan(live,intent)
      if(!sourceCurrent(intent))fail('SOURCE_CHANGED')
      intent=await transition(intent,{...intent,status:'pending',revision:intent.revision+1,initialization:plan})
      if(!sourceCurrent(intent)||!exactIntent(intent))fail('SOURCE_CHANGED')
      // Root has released its execution maintenance reservation. The Native
      // append owns its own reservation. Reacquire the actual Source lease and
      // prove the sole schema pair/private live owner before spending opening
      // side effects; a later publication refusal would be too late.
      const appended=await deps.withPublicationBoundary(live,async()=>{
        if(!exactIntent(intent)||!sourceCurrent(intent))fail('SOURCE_CHANGED')
        if(!deps.checkBeforeOpening(live!,intent))fail('SCHEMA_OPENING_PREAPPEND_UNPROVEN')
        try {return await deps.appendOpening({sessionId:intent.sessionId,operationId:intent.operationId,
          messageId:intent.messageId,source:intent.source,text:intent.renderedText})}
        catch {return {kind:'unknown' as const}}
      })
      if(!exactIntent(intent)||!sourceCurrent(intent))fail('SOURCE_CHANGED')
      let turn:number|undefined
      if(appended.kind==='committed'&&appended.messageId===intent.messageId)turn=appended.turn
      else {
        // One exact lookup may recover an append ACK. It never authorizes
        // another append, guest dispatch, or a cold transaction repair.
        const found=await deps.lookupNativeOpening(intent)
        if(!exactIntent(intent)||!sourceCurrent(intent))fail('SOURCE_CHANGED')
        if(found.status==='committed')turn=found.turn
      }
      if(!Number.isSafeInteger(turn)||Number(turn)<1) {
        intent=await transition(intent,{...intent,status:'unknown',revision:intent.revision+1,
          initializationCode:'NATIVE_NOT_COMMITTED'})
        return {status:'busy',intent}
      }
      intent=await transition(intent,{...intent,status:'native-committed',revision:intent.revision+1,committedTurn:turn!})
      const native=deps.readNativeOpening(intent)
      if(native.kind!=='ready')fail(schemaOpeningCode(native.code))
      validateMvuSchemaNativeOpening(native.receipt,intent)
      intent=await transition(intent,{...intent,nativeReceipt:native.receipt,revision:intent.revision+1})
      intent=await publish(live,intent)
      if(!exactIntent(intent)||!sourceCurrent(intent))fail('SOURCE_CHANGED')
      return intent
    } catch(error) {
      // Keep the durable original phase/epoch/batch. A response projection is
      // not a replacement intent and never opens a retry permission.
      return {status:'busy',intent:project(intent,codeOf(error))}
    } finally {
      active.delete(identity.sessionId)
      if(live)deps.releaseExecution(live)
    }
  }
  return {select,readIntent,readVerified}
}
