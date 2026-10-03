/** Hot material data belongs to one existing Core input binding. Persisted
 * records can explain a request; they cannot recreate this owner after resume. */
import {nativeInputSha256} from '@deepseek-ai/dsh-agent-loop'
import type {NativeInputAdmissionCheckV2,NativeInputRef,NativePreparationReceiptV1,
  NativeRequestMaterialOwnerV1,NativeRequestMaterialPrepareInputV1,NativeRequestMaterialInputV1,
  NativeRequestMaterialTransformV1,NativeMaterialSelectedBaseV1,NativeRequestMaterialPrepareDecisionV1} from '@deepseek-ai/dsh-agent-loop'
import type {Session} from '@deepseek-ai/dsh-session'
import type {InputPreparationCurrency,InputPreparationTable,RoleplayInputStep,
  OwnedNonNumericalInputBranchRowFactV1} from './roleplay-input-preparation.js'
import {recordSha256,keyOf} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'

/** One preparation budget covers lock waits, deterministic workers and record
 * publication. Nested work cannot renew it by starting another evaluator. */
export const ROLEPLAY_INPUT_MATERIAL_LIMITS_V1=Object.freeze({deadlineMs:15_000})

export interface RoleplayInputMaterialScopeV1 {
  readonly session:Session
  readonly stepToken:RoleplayInputStep
  readonly currency:InputPreparationCurrency
  readonly preparation:NativePreparationReceiptV1
  readonly originalInputRefs:readonly NativeInputRef[]
  readonly turn:number
  readonly step:number
  readonly signal:AbortSignal
  /** Checks the original binder's live Work, exact opaque step and Native
   * admission. No caller-supplied hash or flag can establish those facts. */
  assertCurrent():void
  /** Source-free facts of the original binder, actual whole Work/current/stop
   * and exact step/Native-input association. Read-only; never readiness. The
   * InputState checks its captured Source dependencies independently. */
  assertOwnerFactsCurrent():void
}
export type RoleplayInputMaterialScopeInputV1=NativeRequestMaterialPrepareInputV1|NativeRequestMaterialInputV1
  |{admission:NativeInputAdmissionCheckV2}
export interface RoleplayInputMaterialBuildV1 {
  readonly kind:'prepared-data'
  readonly snapshot:Readonly<Record<string,unknown>>
  readonly plan:Readonly<Record<string,unknown>>
  readonly requiredSections:NativeRequestMaterialTransformV1['requiredSections']
  readonly sections:NativeRequestMaterialTransformV1['sections']
  readonly insertions:NativeRequestMaterialTransformV1['insertions']
  readonly anchoredInsertions?:NativeRequestMaterialTransformV1['anchoredInsertions']
  /** Actual input owner and captured Source/state/settings/scope currency.
   * Native owns the changing request cut; the runtime admits template workers. */
  assertCurrent():void
  /** Compares actual selected message versions to the captured semantic scan.
   * It must explicitly distinguish first request from its own Native retries. */
  assertSelected(selected:NativeMaterialSelectedBaseV1,firstAttempt:boolean):void
  /** Release the process-local input capture after this step stops or yields
   * to its successor. Persistent snapshot/plan records remain audit data. */
  release():void
}
export type RoleplayInputMaterialBuildResultV1=RoleplayInputMaterialBuildV1
  |{readonly kind:'outside-declared-domain';readonly reason:string}
  |{readonly kind:'refused';readonly code:string}
export interface RoleplayInputMaterialDependenciesV1 {
  readonly sectionNames:readonly string[]
  prepare(input:NativeRequestMaterialPrepareInputV1,scope:RoleplayInputMaterialScopeV1)
    :Promise<RoleplayInputMaterialBuildResultV1>
}
interface MaterialRecordV1 extends Record<string,unknown> {
  schemaVersion:1
  encoding:'core-input-material-record-v1'
  authority:'consumer-data-only'
  sessionId:string
  branchId:string
  preparation:NativePreparationReceiptV1
  currency:InputPreparationCurrency
  originalInputRefs:readonly NativeInputRef[]
  turn:number
  step:number
  kind:'snapshot'|'plan'
  payload:Readonly<Record<string,unknown>>
}
interface Ready {
  readonly token:RoleplayInputStep
  readonly initial:NativeRequestMaterialPrepareInputV1
  readonly scope:RoleplayInputMaterialScopeV1
  readonly checks:Pick<RoleplayInputMaterialBuildV1,'assertCurrent'|'assertSelected'|'release'>
  readonly material:Pick<NativeRequestMaterialTransformV1,'requiredSections'|'sections'|'insertions'|'anchoredInsertions'>
  readonly materialSha256:string
  readonly snapshot:{key:string;sha256:string}
  readonly plan:{key:string;sha256:string}
  readonly captureSha256:string
  readonly records:{readonly snapshot:unknown;readonly plan:unknown}
  routeSha256?:string
  transformed?:{decisionSha256:string;materialRef?:{seq:number;sha256:string}}
}
function fail(code:string):never {throw Error(code)}
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'INPUT_MATERIAL_PREPARATION_REFUSED'
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}

/** This factory is invoked only inside the original Core bind closure. The
 * scope callback refuses before revealing a reconstructed or foreign step. */
export function createRoleplayInputMaterialOwnerV1(deps:RoleplayInputMaterialDependenciesV1,owner:{
  table:InputPreparationTable
  /** Synchronously proves the original binder's full Source, exact live step
   * and Native admission, then returns only its internal scope DTO without an
   * await, writer or callback. Use it immediately; after any await assert again. */
  scope(input:RoleplayInputMaterialScopeInputV1):RoleplayInputMaterialScopeV1
  enqueue<T>(operation:()=>Promise<T>):Promise<T>
  /** Writer-only explanatory registration. This callback uses the binder's
   * source-free identity checker; it never calls scope/current or grants LiveReady. */
  registerNonNumericalBranchRow?(input:RoleplayInputMaterialScopeInputV1,scope:RoleplayInputMaterialScopeV1,
    row:OwnedNonNumericalInputBranchRowFactV1&{
      readonly kind:'input-material-snapshot'|'input-material-plan'
    }):void
}) {
  const disposal=new AbortController()
  const controllers=new Set<AbortController>()
  const preparations=new Set<Promise<unknown>>()
  let ready:Ready|undefined
  const outside=new WeakSet<RoleplayInputStep>()
  function clearReady():void {
    const previous=ready
    ready=undefined
    previous?.checks.release()
  }
  function current(row:Ready):void {
    if(disposal.signal.aborted)fail('INPUT_MATERIAL_OWNER_DISPOSED')
    row.checks.assertCurrent()
    // Domain keeps these stored DATA objects immutable. A replaced record is
    // a different observation; its full hash was checked once after writing.
    if(owner.table.get(row.snapshot.key)!==row.records.snapshot
      ||owner.table.get(row.plan.key)!==row.records.plan)fail('INPUT_MATERIAL_RECORD_CHANGED')
  }
  const requestMaterial:NativeRequestMaterialOwnerV1={schemaVersion:1,sectionNames:deps.sectionNames,
    prepare(input) {
      const controller=new AbortController()
      const began=performance.now()
      let preparing=true
      const timer=setTimeout(()=>controller.abort(Error('INPUT_MATERIAL_PREPARATION_DEADLINE')),
        ROLEPLAY_INPUT_MATERIAL_LIMITS_V1.deadlineMs)
      controllers.add(controller)
      const operation=(async():Promise<NativeRequestMaterialPrepareDecisionV1>=>{
      let releaseBuild:(()=>void)|undefined
      try {
        const original=owner.scope(input)
        if(disposal.signal.aborted)fail('INPUT_MATERIAL_OWNER_DISPOSED')
        if(original.stepToken.kind!=='story') {
          outside.add(original.stepToken);clearReady()
          return {kind:'unchanged'}
        }
        if(ready?.token===original.stepToken) {
          current(ready)
          if(nativeInputSha256(input.selected)!==nativeInputSha256(ready.initial.selected)
            ||input.assemblySha256!==ready.initial.assemblySha256)fail('INPUT_MATERIAL_PREPARATION_CHANGED')
          return {kind:'prepared'}
        }
        clearReady()
        const signal=AbortSignal.any([original.signal,disposal.signal,controller.signal])
        const assertBudgetAndSignal=()=>{
          signal.throwIfAborted()
          if(preparing&&performance.now()-began>=ROLEPLAY_INPUT_MATERIAL_LIMITS_V1.deadlineMs) {
            controller.abort(Error('INPUT_MATERIAL_PREPARATION_DEADLINE'));signal.throwIfAborted()
          }
        }
        const scope:RoleplayInputMaterialScopeV1={...original,signal,assertCurrent(){
          assertBudgetAndSignal()
          // The scope proves the live input binder. Package byte verification
          // belongs to the outer material checkpoint, not every scope read.
          original.assertCurrent()
        },assertOwnerFactsCurrent(){
          // Facts obey the same combined cancellation and monotonic budget.
          // They cannot publish ready or bypass the Native/material gate.
          assertBudgetAndSignal()
          original.assertOwnerFactsCurrent()
        }}
        const data=await deps.prepare(input,scope)
        if(data.kind==='prepared-data')releaseBuild=data.release.bind(data)
        scope.signal.throwIfAborted();scope.assertOwnerFactsCurrent()
        if(data.kind==='refused')return {kind:'blocked',code:data.code}
        if(data.kind==='outside-declared-domain') {
          outside.add(scope.stepToken);return {kind:'unchanged'}
        }
        const checks={assertCurrent:data.assertCurrent.bind(data),assertSelected:data.assertSelected.bind(data),
          release:data.release.bind(data)}
        checks.assertCurrent();checks.assertSelected(input.selected,true)
        // The recorded plan and the live transform must use the same detached,
        // frozen values. A producer's later array mutation cannot alter wire
        // content while the persisted explanatory record remains unchanged.
        const material=freeze(cloneRoleplayTavernLoreDataV1({requiredSections:data.requiredSections,
          sections:data.sections,insertions:data.insertions,
          ...data.anchoredInsertions?{anchoredInsertions:data.anchoredInsertions}:{}},
          4_194_304,{nodes:131072,depth:66}))
        const materialSha256=nativeInputSha256(material)
        const basis={schemaVersion:1 as const,encoding:'core-input-material-record-v1' as const,
          authority:'consumer-data-only' as const,sessionId:scope.session.id,branchId:scope.session.id,
          preparation:scope.preparation,currency:scope.currency,originalInputRefs:scope.originalInputRefs,
          turn:scope.turn,step:scope.step}
        const snapshot=freeze(cloneRoleplayTavernLoreDataV1({...basis,kind:'snapshot',payload:data.snapshot},16_777_216,
          {nodes:131072,depth:66}) as unknown as MaterialRecordV1)
        const plan=freeze(cloneRoleplayTavernLoreDataV1({...basis,kind:'plan',payload:{promptPlan:data.plan,
          nativeTransform:material,nativeTransformSha256:materialSha256}},4_194_304,
          {nodes:131072,depth:66}) as unknown as MaterialRecordV1)
        const prefix=keyOf(scope.session.id,`tavern-prompt-v1-${scope.currency.preparationId}-${scope.currency.attemptGeneration}-${scope.step}`)
        const refs={snapshot:{key:prefix+'-snapshot',sha256:recordSha256(snapshot)},
          plan:{key:prefix+'-plan',sha256:recordSha256(plan)}}
        const records:{snapshot?:unknown;plan?:unknown}={}
        await owner.enqueue(async()=>{
          checks.assertCurrent()
          for(const [kind,record] of [['snapshot',snapshot],['plan',plan]] as const) {
            const ref=refs[kind],old=owner.table.get(ref.key)
            if(old!==undefined&&old!==null&&recordSha256(old)!==ref.sha256)fail('INPUT_MATERIAL_RECORD_CONFLICT')
            const fact={key:ref.key,value:record,sha256:ref.sha256,
              kind:kind==='snapshot'?'input-material-snapshot' as const:'input-material-plan' as const}
            // Only this original writer registers the explanatory output. A
            // thrown put leaves writing data and never becomes Ready.
            owner.registerNonNumericalBranchRow?.(input,scope,{...fact,phase:'writing'})
            if(old===undefined||old===null)await owner.table.put(ref.key,record)
            const readback=owner.table.get(ref.key)
            if(recordSha256(readback)!==ref.sha256)fail('INPUT_MATERIAL_WRITE_UNCONFIRMED')
            records[kind]=readback
            owner.registerNonNumericalBranchRow?.(input,scope,{...fact,phase:'written'})
            // Readback precedes the cheap owner checkpoint. Both rows must
            // complete before any Ready object can reach Native.
            checks.assertCurrent()
          }
        })
        checks.assertCurrent()
        const row:Ready={token:scope.stepToken,scope,initial:input,checks,material,materialSha256,...refs,
          records:{snapshot:records.snapshot,plan:records.plan},
          captureSha256:recordSha256({schemaVersion:1,encoding:'core-input-material-capture-v1',
            ...refs,nativeSelectedSha256:input.selected.sha256,assemblySha256:input.assemblySha256})}
        current(row);ready=row;releaseBuild=undefined
        return {kind:'prepared'}
      }catch(error) {releaseBuild?.();return {kind:'blocked' as const,code:codeOf(error)}}
      })()
      preparations.add(operation)
      const settled=()=>{preparing=false;clearTimeout(timer);controllers.delete(controller);preparations.delete(operation)}
      void operation.then(settled,settled)
      return operation
    },
    transform(input) {
      try {
        const scope=owner.scope(input)
        if(outside.has(scope.stepToken))return {kind:'unchanged'}
        const row=ready
        if(!row||row.token!==scope.stepToken)fail('INPUT_MATERIAL_PREPARATION_MISSING')
        current(row)
        if(input.turn!==scope.turn||input.step!==scope.step||input.signal!==row.initial.signal
          ||input.assemblySha256!==row.initial.assemblySha256)fail('INPUT_MATERIAL_STEP_CHANGED')
        row.checks.assertSelected(input.selected,input.firstAttempt)
        const route=nativeInputSha256(input.preparedRoute)
        if(row.routeSha256!==undefined&&row.routeSha256!==route)fail('INPUT_MATERIAL_ROUTE_CHANGED')
        row.routeSha256=route
        const decision:NativeRequestMaterialTransformV1={kind:'transform',schemaVersion:1,
          encoding:'native-request-material-owner-transform-v1',snapshot:row.snapshot,plan:row.plan,
          captureSha256:row.captureSha256,expectedAssemblySha256:input.assemblySha256,
          expectedSelectedBaseSha256:input.selected.sha256,requiredSections:row.material.requiredSections,
          sections:row.material.sections,insertions:row.material.insertions,
          ...row.material.anchoredInsertions?{anchoredInsertions:row.material.anchoredInsertions}:{}}
        row.transformed={decisionSha256:nativeInputSha256(decision)}
        return decision
      }catch(error) {return {kind:'blocked',code:codeOf(error)}}
    },
    check(input) {
      try {
        const scope=owner.scope(input),row=ready
        if(!row||row.token!==scope.stepToken||!row.transformed
          ||nativeInputSha256(input.decision)!==row.transformed.decisionSha256)fail('INPUT_MATERIAL_PLAN_CHANGED')
        current(row)
        if(!input.selected)fail('INPUT_MATERIAL_NATIVE_SELECTED_MISSING')
        row.checks.assertSelected(input.selected,input.selected.messages.some(message=>message.origin==='pending-decision'))
        if(input.materialRef) {
          const previous=row.transformed.materialRef
          if(previous&&nativeInputSha256(previous)!==nativeInputSha256(input.materialRef))fail('INPUT_MATERIAL_NATIVE_REF_CHANGED')
          const event=scope.session.snapshotEvents().find(item=>Number(item.seq)===input.materialRef!.seq)
          if(event?.type!=='request/material'||nativeInputSha256(event)!==input.materialRef.sha256
            ||event.data.turn!==scope.turn||event.data.step!==scope.step
            ||nativeInputSha256(event.data.snapshot)!==nativeInputSha256(row.snapshot)
            ||nativeInputSha256(event.data.plan)!==nativeInputSha256(row.plan))fail('INPUT_MATERIAL_NATIVE_RECORD_UNPROVEN')
          row.transformed.materialRef=input.materialRef
        }else if(row.transformed.materialRef)fail('INPUT_MATERIAL_NATIVE_REF_MISSING')
        return {kind:'allow'}
      }catch(error) {return {kind:'blocked',code:codeOf(error)}}
    },
  }
  function revoke():void {
    clearReady()
    for(const controller of controllers)controller.abort('Core material preparation revoked')
  }
  return {requestMaterial,
    async stop():Promise<void> {
      revoke()
      // This wait stays outside the input record FIFO. Preparation may itself
      // own a queued write; waiting from that FIFO would deadlock its cleanup.
      await Promise.allSettled([...preparations])
    },
    dispose(){disposal.abort('Core material owner disposed');revoke()},
  }
}
