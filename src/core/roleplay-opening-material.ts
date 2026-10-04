/** One private no-player opening material owner. Persistent data explains a
 * request; only actual Native registration/phase and Root callbacks permit it. */
import {nativeInputSha256} from '@deepseek-ai/dsh-agent-loop'
import type {NativeOpeningIdentityV1,NativeOpeningOwnerIdentityV1,NativeOpeningMaterialOwnerV1,
  NativeOpeningMaterialPrepareInputV1,NativeOpeningMaterialInputV1,NativeOpeningMaterialCheckV1,
  NativeOpeningClosingInputV1,NativeOpeningClosingAcknowledgementV1,NativeRequestMaterialPrepareDecisionV1,
  NativeRequestMaterialTransformV1,NativeOpeningEventRefV1} from '@deepseek-ai/dsh-agent-loop'
import type {Session} from '@deepseek-ai/dsh-session'
import {recordSha256,keyOf,sha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {ROLEPLAY_INPUT_MATERIAL_LIMITS_V1} from './roleplay-input-material.js'
import type {RoleplayInputMaterialBuildV1,RoleplayInputMaterialBuildResultV1} from './roleplay-input-material.js'

export interface RoleplayOpeningMaterialDataRefV1 {readonly key:string;readonly sha256:string}
export interface RoleplayOpeningMaterialScopeV1 {
  readonly session:Session
  readonly owner:NativeOpeningOwnerIdentityV1
  readonly turn:number
  readonly step:number
  readonly signal:AbortSignal
  /** One monotonic async preparation/write budget, inherited by inner work.
   * It ceases to constrain provider retries/closing after preparation settles. */
  readonly deadlineAt:number
  readonly outputRows:readonly {readonly table:string;readonly key:string}[]
  /** Live owner/step/budget only; InputState owns captured DATA currency. */
  assertOwnerFactsCurrent():void
}
export interface RoleplayOpeningMaterialDependenciesV1 {
  readonly sectionNames:readonly string[]
  prepareOpening(input:NativeOpeningMaterialPrepareInputV1,scope:RoleplayOpeningMaterialScopeV1)
    :Promise<RoleplayInputMaterialBuildResultV1>
}
export interface RoleplayOpeningMaterialRecordV1 extends Record<string,unknown> {
  readonly schemaVersion:1
  readonly encoding:'core-program-opening-material-record-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly identity:NativeOpeningIdentityV1
  readonly seedRef:RoleplayOpeningMaterialDataRefV1
  readonly inputRef:RoleplayOpeningMaterialDataRefV1
  readonly nativeOwner:NativeOpeningOwnerIdentityV1
  readonly turn:number
  readonly step:number
  readonly kind:'snapshot'|'plan'
  readonly payload:Readonly<Record<string,unknown>>
}
export interface RoleplayOpeningMaterialOwnedRowV1 {
  readonly key:string
  readonly sha256:string
  readonly value:RoleplayOpeningMaterialRecordV1
}
export type RoleplayOpeningMaterialCurrentInputV1=NativeOpeningMaterialPrepareInputV1|NativeOpeningMaterialInputV1
  |NativeOpeningMaterialCheckV1|NativeOpeningClosingInputV1
export interface RoleplayOpeningMaterialOwnerContextV1 {
  readonly session:Session
  readonly identity:NativeOpeningIdentityV1
  readonly seedRef:RoleplayOpeningMaterialDataRefV1
  readonly inputRef:RoleplayOpeningMaterialDataRefV1
  /** Actual T.branch Domain containing seed/input and material persistent rows. */
  readonly table:{get(key:string):unknown;put(key:string,value:Record<string,unknown>):Promise<unknown>}
  /** Actual owner FIFO. Do not call stop/dispose from its own queued action. */
  enqueue<T>(operation:()=>Promise<T>):Promise<T>
  /** Actual factory/Agent/Session identity. InputState owns the DATA audit. */
  assertOwnerFactsCurrent(input:RoleplayOpeningMaterialCurrentInputV1):void
  /** Native already checks original registration/phase on each side. Root
   * separately guards Source/intent/basis, including cold closing facts. */
  check(input:NativeOpeningMaterialCheckV1):{readonly kind:'allow'}|{readonly kind:'blocked';readonly code:string}
  /** Original Native object is preserved. Core cancellation is the separate
   * combined signal. Await this original operation outside the material FIFO. */
  closing(input:NativeOpeningClosingInputV1,signal:AbortSignal):Promise<NativeOpeningClosingAcknowledgementV1>
}
interface ReadyV1 {
  readonly initial:NativeOpeningMaterialPrepareInputV1
  readonly scope:RoleplayOpeningMaterialScopeV1
  readonly checks:Pick<RoleplayInputMaterialBuildV1,'assertCurrent'|'assertSelected'|'release'>
  readonly material:Pick<NativeRequestMaterialTransformV1,'requiredSections'|'sections'|'insertions'|'anchoredInsertions'>
  readonly materialSha256:string
  readonly snapshot:RoleplayOpeningMaterialDataRefV1
  readonly plan:RoleplayOpeningMaterialDataRefV1
  readonly captureSha256:string
  readonly records:{readonly snapshot:unknown;readonly plan:unknown}
  routeSha256?:string
  transformed?:{readonly decisionSha256:string;readonly firstAttempt:boolean;readonly attempt:number;
    materialRef?:NativeOpeningEventRefV1}
}
interface ActiveStepV1 {
  readonly key:string
  readonly initial:NativeOpeningMaterialPrepareInputV1
  result?:NativeRequestMaterialPrepareDecisionV1
  pending?:Promise<NativeRequestMaterialPrepareDecisionV1>
}
const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const id=(value:unknown,maximum=256):value is string=>typeof value==='string'&&value.length>0
  &&value.length<=maximum&&/^[a-zA-Z0-9_-]+$/.test(value)
function fail(code:string):never {throw Error(code)}
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'OPENING_MATERIAL_PREPARATION_REFUSED'
function data<T>(value:T,bytes=16_777_216):T {
  const detached=cloneRoleplayTavernLoreDataV1(value,bytes,{nodes:131072,depth:66}),pending:unknown[]=[detached]
  while(pending.length) {
    const current=pending.pop()
    if(current&&typeof current==='object') {
      for(const child of Object.values(current))pending.push(child)
      Object.freeze(current)
    }
  }
  return detached
}
const same=(a:unknown,b:unknown)=>nativeInputSha256(a)===nativeInputSha256(b)
function ref(value:RoleplayOpeningMaterialDataRefV1):void {
  if(!id(value.key,512)||!hash(value.sha256))fail('OPENING_MATERIAL_INPUT_REF_INVALID')
}
export function roleplayOpeningMaterialKeysV1(sessionId:string,seedRef:RoleplayOpeningMaterialDataRefV1,
  turn:number,step:number):{snapshot:string;plan:string} {
  if(!id(sessionId,64)||!positive(turn)||!positive(step))fail('OPENING_MATERIAL_POSITION_INVALID')
  ref(seedRef)
  const digest=recordSha256({encoding:'core-program-opening-material-key-v1',seedRef,turn,step}),
    prefix=keyOf(sessionId,'program-opening-material-'+digest)
  return {snapshot:prefix+'-snapshot',plan:prefix+'-plan'}
}

/** Call only from Root's original real registration closure. No serialized
 * record, selected clone, readiness flag or lookup creates this hot owner. */
export function createRoleplayOpeningMaterialOwnerV1(deps:RoleplayOpeningMaterialDependenciesV1,
  owner:RoleplayOpeningMaterialOwnerContextV1) {
  if(typeof deps.prepareOpening!=='function'||typeof owner.assertOwnerFactsCurrent!=='function'||typeof owner.check!=='function'
    ||typeof owner.closing!=='function'||typeof owner.enqueue!=='function'
    ||typeof owner.table.get!=='function'||typeof owner.table.put!=='function') {
    fail('OPENING_MATERIAL_OWNER_CALLBACK_REQUIRED')
  }
  const session=owner.session,identity=data(owner.identity),seedRef=data(owner.seedRef),inputRef=data(owner.inputRef),
    get=owner.table.get.bind(owner.table),put=owner.table.put.bind(owner.table),enqueue=owner.enqueue.bind(owner),
    assertOwnerFacts=owner.assertOwnerFactsCurrent.bind(owner),checkOwner=owner.check.bind(owner),closeOwner=owner.closing.bind(owner),
    prepareOpening=deps.prepareOpening.bind(deps),sectionNames=data([...deps.sectionNames],65_536)
  ref(seedRef);ref(inputRef)
  if(!id(String(session.id),64)||identity.kind!=='programmatic-opening'||identity.sessionId!==String(session.id)
    ||!id(identity.operationId)||!id(identity.messageId)||!hash(identity.instructionSha256)
    ||typeof identity.instruction!=='string'||sha256(identity.instruction)!==identity.instructionSha256
    ||!same(identity.intentRef,seedRef))fail('OPENING_MATERIAL_IDENTITY_INVALID')
  const disposal=new AbortController(),controllers=new Set<AbortController>(),operations=new Set<Promise<unknown>>(),
    ready=new Map<string,ReadyV1>(),registeredRows=new Map<string,RoleplayOpeningMaterialOwnedRowV1>()
  let active:ActiveStepV1|undefined,revoked=false
  function clearReady():void {
    for(const row of ready.values())row.checks.release()
    ready.clear()
  }
  function alive():void {
    if(revoked||disposal.signal.aborted)fail('OPENING_MATERIAL_OWNER_REVOKED')
  }
  function prepareIdentity(input:NativeOpeningMaterialPrepareInputV1|NativeOpeningMaterialInputV1):void {
    if(input.schemaVersion!==1||!positive(input.turn)||!positive(input.step)
      ||input.noPlayer.kind!=='no-player'||input.noPlayer.selectedUserMessageIds.length
      ||input.selected.messages.some(message=>message.origin==='pending-decision'))fail('OPENING_MATERIAL_NO_PLAYER_REQUIRED')
    input.signal.throwIfAborted()
    alive();assertOwnerFacts(input)
  }
  function samePreparation(input:NativeOpeningMaterialPrepareInputV1,initial:NativeOpeningMaterialPrepareInputV1):void {
    if(input.turn!==initial.turn||input.step!==initial.step||input.signal!==initial.signal
      ||!same(input.owner,initial.owner)||input.assemblySha256!==initial.assemblySha256
      ||input.selected!==initial.selected||!same(input.selected,initial.selected))fail('OPENING_MATERIAL_PREPARATION_CHANGED')
  }
  function current(row:ReadyV1,additional?:()=>void):void {
    alive();row.checks.assertCurrent()
    if(get(row.snapshot.key)!==row.records.snapshot||get(row.plan.key)!==row.records.plan) {
      fail('OPENING_MATERIAL_RECORD_CHANGED')
    }
    additional?.()
  }
  function track<T>(operation:Promise<T>):Promise<T> {
    operations.add(operation)
    const settled=()=>{operations.delete(operation)}
    void operation.then(settled,settled)
    return operation
  }
  function registerExact(row:RoleplayOpeningMaterialOwnedRowV1,actual:unknown):boolean {
    if(recordSha256(actual)!==row.sha256)return false
    const previous=registeredRows.get(row.key)
    if(previous&&previous.sha256!==row.sha256)fail('OPENING_MATERIAL_REGISTERED_ROW_CHANGED')
    registeredRows.set(row.key,row)
    return true
  }
  async function writeRow(row:RoleplayOpeningMaterialOwnedRowV1):Promise<unknown> {
    const existing=get(row.key)
    if(existing!==undefined&&existing!==null) {
      if(!registerExact(row,existing))fail('OPENING_MATERIAL_RECORD_CONFLICT')
      return existing
    }
    try {await put(row.key,row.value)}catch(error) {
      // A thrown writer may have committed. Register only actual exact bytes
      // for diagnostic/basis accounting; never turn the error into LiveReady.
      registerExact(row,get(row.key));throw error
    }
    const readback=get(row.key)
    if(!registerExact(row,readback))fail('OPENING_MATERIAL_WRITE_UNCONFIRMED')
    return readback
  }
  const requestMaterial:NativeOpeningMaterialOwnerV1={schemaVersion:1,sectionNames,
    prepare(input) {
      try {
        prepareIdentity(input)
        if(active&&input.turn===active.initial.turn&&input.step===active.initial.step) {
          samePreparation(input,active.initial)
          const row=ready.get(active.key)
          if(row)current(row,()=>row.checks.assertSelected(input.selected,true))
          // A settled refusal is cached as a refusal, never rebuilt by retries.
          if(active.pending)return active.pending
          if(active.result)return Promise.resolve(active.result)
          fail('OPENING_MATERIAL_PREPARATION_MISSING')
        }
        if(active&&(input.turn!==active.initial.turn||input.step<=active.initial.step||active.pending)) {
          fail('OPENING_MATERIAL_STEP_CHANGED')
        }
      }catch(error){return Promise.resolve({kind:'blocked',code:codeOf(error)})}
      clearReady()
      const keys=roleplayOpeningMaterialKeysV1(String(session.id),seedRef,input.turn,input.step),
        step:ActiveStepV1={key:keys.snapshot,initial:input},controller=new AbortController(),
        deadlineAt=performance.now()+ROLEPLAY_INPUT_MATERIAL_LIMITS_V1.deadlineMs
      active=step;controllers.add(controller)
      let preparing=true
      const signal=AbortSignal.any([input.signal,disposal.signal,controller.signal]),
        timer=setTimeout(()=>controller.abort(Error('OPENING_MATERIAL_PREPARATION_DEADLINE')),
          Math.max(0,deadlineAt-performance.now()))
      const assertScopeCurrent=()=>{
          signal.throwIfAborted()
          if(preparing&&performance.now()>=deadlineAt) {
            controller.abort(Error('OPENING_MATERIAL_PREPARATION_DEADLINE'));signal.throwIfAborted()
          }
          if(active!==step)fail('OPENING_MATERIAL_STEP_REPLACED')
          alive();assertOwnerFacts(input)
      }
      const scope:RoleplayOpeningMaterialScopeV1=Object.freeze({session,owner:input.owner,
        turn:input.turn,step:input.step,signal,deadlineAt,
        outputRows:Object.freeze([keys.snapshot,keys.plan].map(key=>Object.freeze({table:'branch',key}))),
        assertOwnerFactsCurrent:assertScopeCurrent})
      const operation=(async():Promise<NativeRequestMaterialPrepareDecisionV1>=>{
        let releaseBuild:(()=>void)|undefined
        try {
          const built=await prepareOpening(input,scope)
          if(built.kind==='prepared-data') {
            releaseBuild=built.release.bind(built)
          }
          scope.assertOwnerFactsCurrent()
          if(built.kind==='refused')return {kind:'blocked',code:built.code}
          if(built.kind!=='prepared-data')return {kind:'blocked',code:'OPENING_MATERIAL_OUTSIDE_DECLARED_DOMAIN'}
          const checks={assertCurrent:built.assertCurrent.bind(built),assertSelected:built.assertSelected.bind(built),
            release:built.release.bind(built)}
          checks.assertSelected(input.selected,true)
          const material=data({requiredSections:built.requiredSections,sections:built.sections,insertions:built.insertions,
            ...built.anchoredInsertions?{anchoredInsertions:built.anchoredInsertions}:{}},4_194_304),
            materialSha256=nativeInputSha256(material),basis={schemaVersion:1 as const,
              encoding:'core-program-opening-material-record-v1' as const,authority:'consumer-data-only' as const,
              sessionId:String(session.id),identity,seedRef,inputRef,nativeOwner:input.owner,turn:input.turn,step:input.step},
            snapshot=data({...basis,kind:'snapshot' as const,payload:built.snapshot}) as RoleplayOpeningMaterialRecordV1,
            plan=data({...basis,kind:'plan' as const,payload:{promptPlan:built.plan,nativeTransform:material,
              nativeTransformSha256:materialSha256}},4_194_304) as RoleplayOpeningMaterialRecordV1,
            snapshotRow=data({key:keys.snapshot,sha256:recordSha256(snapshot),value:snapshot}),
            planRow=data({key:keys.plan,sha256:recordSha256(plan),value:plan})
          const records:{snapshot?:unknown;plan?:unknown}={}
          await enqueue(async()=>{
            checks.assertCurrent()
            for(const [kind,row] of [['snapshot',snapshotRow],['plan',planRow]] as const) {
              records[kind]=await writeRow(row)
              // The stored immutable record is confirmed before the owner
              // checkpoint. A revoked opening can retain data but not Ready.
              checks.assertCurrent()
            }
          })
          const row:ReadyV1={initial:input,scope,checks,material,materialSha256,
            records:{snapshot:records.snapshot,plan:records.plan},
            snapshot:{key:snapshotRow.key,sha256:snapshotRow.sha256},plan:{key:planRow.key,sha256:planRow.sha256},
            captureSha256:recordSha256({schemaVersion:1,encoding:'core-program-opening-material-capture-v1',
              identity,seedRef,inputRef,nativeOwner:input.owner,turn:input.turn,step:input.step,
              snapshot:{key:snapshotRow.key,sha256:snapshotRow.sha256},plan:{key:planRow.key,sha256:planRow.sha256},
              nativeSelectedSha256:input.selected.sha256,assemblySha256:input.assemblySha256})}
          current(row);ready.set(step.key,row);releaseBuild=undefined
          return {kind:'prepared'}
        }catch(error) {
          releaseBuild?.()
          ready.get(step.key)?.checks.release()
          ready.delete(step.key)
          return {kind:'blocked',code:codeOf(error)}
        }finally {
          // Provider attempts/closing do not inherit an already spent prepare
          // timeout; original Native signal/current/disposal still constrain them.
          preparing=false;clearTimeout(timer);controllers.delete(controller)
        }
      })()
      step.pending=operation
      const settled=(result:NativeRequestMaterialPrepareDecisionV1)=>{
        step.result=result;step.pending=undefined
      }
      void operation.then(settled,()=>{step.pending=undefined})
      return track(operation)
    },
    transform(input) {
      try {
        prepareIdentity(input)
        const step=active,row=step&&ready.get(step.key)
        if(!row||input.turn!==row.scope.turn||input.step!==row.scope.step||input.signal!==row.initial.signal
          ||!same(input.owner,row.initial.owner)||input.assemblySha256!==row.initial.assemblySha256
          ||!positive(input.attempt))fail('OPENING_MATERIAL_PREPARATION_MISSING_OR_CHANGED')
        current(row,()=>row.checks.assertSelected(input.selected,input.firstAttempt))
        const route=nativeInputSha256(input.preparedRoute)
        if(row.routeSha256!==undefined&&row.routeSha256!==route)fail('OPENING_MATERIAL_ROUTE_CHANGED')
        if(row.transformed&&input.attempt<=row.transformed.attempt)fail('OPENING_MATERIAL_ATTEMPT_REUSED')
        row.routeSha256=route
        const decision:NativeRequestMaterialTransformV1={kind:'transform',schemaVersion:1,
          encoding:'native-request-material-owner-transform-v1',snapshot:row.snapshot,plan:row.plan,
          captureSha256:row.captureSha256,expectedAssemblySha256:input.assemblySha256,
          expectedSelectedBaseSha256:input.selected.sha256,requiredSections:row.material.requiredSections,
          sections:row.material.sections,insertions:row.material.insertions,
          ...row.material.anchoredInsertions?{anchoredInsertions:row.material.anchoredInsertions}:{}}
        row.transformed={decisionSha256:nativeInputSha256(decision),firstAttempt:input.firstAttempt,attempt:input.attempt}
        return decision
      }catch(error){return {kind:'blocked',code:codeOf(error)}}
    },
    check(input) {
      try {
        alive()
        const actual=checkOwner(input)
        if(actual.kind!=='allow')return actual
        if('identity' in input) {
          if(!same(input.identity,identity))fail('OPENING_MATERIAL_IDENTITY_CHANGED')
          input.signal.throwIfAborted()
          return {kind:'allow'}
        }
        const step=active,row=step&&ready.get(step.key)
        if(!row||!same(input.owner,row.initial.owner))fail('OPENING_MATERIAL_PREPARATION_MISSING')
        if(input.phase==='prepared-precheckpoint') {
          current(row,()=>{
            if(input.assemblySha256!==row.initial.assemblySha256)fail('OPENING_MATERIAL_ASSEMBLY_CHANGED')
            row.checks.assertSelected(input.selected,true)
          })
          return {kind:'allow'}
        }
        const transformed=row.transformed
        if(!transformed||nativeInputSha256(input.decision)!==transformed.decisionSha256)fail('OPENING_MATERIAL_PLAN_CHANGED')
        current(row,()=>row.checks.assertSelected(input.selected,transformed.firstAttempt))
        // Native first checks the committed checkpoint before appending its
        // material event, then repeats this phase with the exact event ref.
        // Once observed, that ref is mandatory for every later check below.
        if(input.materialRef) {
          if(transformed.materialRef&&!same(transformed.materialRef,input.materialRef))fail('OPENING_MATERIAL_NATIVE_REF_CHANGED')
          if(!transformed.materialRef) {
            const event=session.snapshotEvents()[input.materialRef.seq]
            if(event?.type!=='request/material'||nativeInputSha256(event)!==input.materialRef.sha256
              ||event.data.turn!==row.scope.turn||event.data.step!==row.scope.step
              ||!same(event.data.snapshot,row.snapshot)||!same(event.data.plan,row.plan)) {
              fail('OPENING_MATERIAL_NATIVE_RECORD_UNPROVEN')
            }
          }
          transformed.materialRef=input.materialRef
        }else if(transformed.materialRef)fail('OPENING_MATERIAL_NATIVE_REF_MISSING')
        return {kind:'allow'}
      }catch(error){return {kind:'blocked',code:codeOf(error)}}
    },
    closing(input) {
      const signal=AbortSignal.any([input.signal,disposal.signal])
      const operation=(async():Promise<NativeOpeningClosingAcknowledgementV1>=>{
        try {
          signal.throwIfAborted();alive();assertOwnerFacts(input)
          if(!same(input.owner.identity,identity)||!same(input.receipt.identity,identity)) {
            fail('OPENING_MATERIAL_CLOSING_IDENTITY_CHANGED')
          }
          // Closing may await Domain/Source writes. It is deliberately outside
          // material enqueue and never waits for its own Native driver to idle.
          const acknowledged=await closeOwner(input,signal)
          if(signal.aborted||revoked)return {kind:'unknown',receiptSha256:input.receipt.receiptSha256,
            code:'OPENING_MATERIAL_CLOSING_REVOKED'}
          // Root's successful publisher may move Source/head. Native separately
          // verifies the immutable completed span before writing its own ACK.
          return acknowledged
        }catch(error) {
          return {kind:signal.aborted?'unknown':'blocked',receiptSha256:input.receipt.receiptSha256,code:codeOf(error)}
        }
      })()
      return track(operation)
    },
  }
  function revoke():void {
    revoked=true;clearReady();disposal.abort(Error('OPENING_MATERIAL_OWNER_REVOKED'))
    for(const controller of controllers)controller.abort(Error('OPENING_MATERIAL_OWNER_REVOKED'))
  }
  async function stop():Promise<void> {
    revoke()
    // Outside the owner FIFO: preparation/closing may already hold or await a
    // queued writer. Abort does not race or detach those actual operations.
    await Promise.allSettled([...operations])
  }
  return {requestMaterial,
    ownedRows():readonly RoleplayOpeningMaterialOwnedRowV1[] {return Object.freeze([...registeredRows.values()])},
    revoke,stop,dispose:stop}
}
