/** Hot material data belongs to one existing Core input binding. Persisted
 * records can explain a request; they cannot recreate this owner after resume. */
import {nativeInputSha256,projectNativeMaterialTextOutputsV1} from 'dsh-nexttavern-native-agent-loop'
import type {NativeInputAdmissionCheckV2,NativeInputRef,NativePreparationReceiptV1,
  NativeRequestMaterialOwnerV2,NativeRequestMaterialPrepareInputV1,NativeRequestMaterialInputV1,
  NativeRequestMaterialTransformV1,NativeRequestMaterialTransformV2,
  NativeMaterialSelectedBaseV1,NativeRequestMaterialPrepareDecisionV1,
  NativeMaterialCandidateBasisV1,NativeMaterialCandidatePreviewV1,NativeMaterialTextDraftV1,
  NativeMaterialTextSurfaceV1,NativeMaterialTextOutputV1,NativeMaterialFinalTextProjectionV1}
  from 'dsh-nexttavern-native-agent-loop'
import type {Session,UserMessage} from 'dsh-nexttavern-native-session'
import type {InputPreparationCurrency,InputPreparationTable,RoleplayInputStep,
  OwnedNonNumericalInputBranchRowFactV1,RoleplayInputSourceDataWindowV1} from './roleplay-input-preparation.js'
import type {PhaseACandidate,PhaseACheckpointOptions} from './roleplay-preparation-types.js'
import type {ContextMessage} from './roleplay-context.js'
import {recordSha256,keyOf} from './roleplay-data.js'
import type {TavernRenderedAuthorMaterialV1} from './roleplay-tavern-prompt-types.js'

/** One preparation budget covers lock waits, deterministic workers and record
 * publication. Nested work cannot renew it by starting another evaluator. */
export const ROLEPLAY_INPUT_MATERIAL_LIMITS_V1=Object.freeze({deadlineMs:15_000})

/** Only the original pre-step binder can stage these process-local callbacks.
 * Their snapshots are candidates until commit; they confer no dispatch right. */
export interface RoleplayPhaseAStageV1 {
  rebuild(step:RoleplayInputStep):Promise<void>
  current():PhaseACandidate
  messages():readonly ContextMessage[]
  checkpoint(options?:PhaseACheckpointOptions):Promise<void>
  commit():Promise<void>
}

export interface RoleplayInputMaterialScopeV1 {
  readonly session:Session
  readonly stepToken:RoleplayInputStep
  readonly generationOwner?:object
  readonly sourceData?:RoleplayInputSourceDataWindowV1
  readonly currency:InputPreparationCurrency
  readonly preparation:NativePreparationReceiptV1
  readonly originalInputRefs:readonly NativeInputRef[]
  readonly turn:number
  readonly step:number
  readonly signal:AbortSignal
  readonly outputRows?:readonly {readonly table:string;readonly key:string}[]
  readonly phaseA?:RoleplayPhaseAStageV1
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
export interface RoleplayMaterialPreparationJournalRefV1 {readonly key:string;readonly sha256:string}
export interface RoleplayMaterialPreparationJournalV1 {
  read(operationId:string):Readonly<Record<string,unknown>>|undefined
  append(operationId:string,payload:Readonly<Record<string,unknown>>,
    beforeWrite?:(row:{readonly key:string;readonly value:object})=>()=>void):Promise<RoleplayMaterialPreparationJournalRefV1>
}
export interface RoleplayMaterialPreparationJournalRecordV1 extends Readonly<Record<string,unknown>> {
  readonly schemaVersion:1
  readonly encoding:'core-material-preparation-journal-v1'
  readonly authority:'consumer-data-only'
  readonly owner:Readonly<Record<string,unknown>>
  readonly operationId:string
  readonly payload:Readonly<Record<string,unknown>>
}
export interface RoleplayMaterialFinalizationV1 {
  readonly snapshot?:Readonly<Record<string,unknown>>
  readonly plan?:Readonly<Record<string,unknown>>
}
export interface RoleplayInputMaterialBasisV1 {
  /** Only the live input owner retains these actual rendered outputs. They
   * are neither serialized as authority nor reconstructed from audit rows. */
  readonly renderedAuthorMaterial?:TavernRenderedAuthorMaterialV1
  readonly requiredSections:NativeRequestMaterialTransformV1['requiredSections']
  readonly sections:NativeRequestMaterialTransformV1['sections']
  readonly insertions:NativeRequestMaterialTransformV1['insertions']
  readonly anchoredInsertions?:NativeRequestMaterialTransformV1['anchoredInsertions']
  readonly messageTextProjections?:NativeRequestMaterialTransformV2['messageTextProjections']
  readonly messageProjection?:NativeRequestMaterialTransformV1['messageProjection']
  readonly story?:NativeRequestMaterialTransformV1['story']
  readonly responseHooks?:NonNullable<NativeRequestMaterialOwnerV2['story']>
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
export interface RoleplayInputMaterialBuildV1 extends RoleplayInputMaterialBasisV1 {
  readonly kind:'prepared-data'
  /** The original producer owns detached, immutable explanatory DATA. Its
   * accepted Source may appear more than once in this derived capture; this
   * publisher does not charge those owned subtrees to another input budget. */
  readonly snapshot:Readonly<Record<string,unknown>>
  readonly plan:Readonly<Record<string,unknown>>
  /** Runs once for the final candidate, after Phase A commits. The material
   * writer supplies durable DATA journaling, never Source write permission. */
  finalize?(journal:RoleplayMaterialPreparationJournalV1):Promise<RoleplayMaterialFinalizationV1|void>
}
export interface RoleplayInputMaterialDraftV1 extends RoleplayInputMaterialBasisV1 {
  readonly kind:'text-draft'
  /** Native supplies actual assembled text, before final refs/IDs and pricing.
   * This live continuation cannot be reconstructed from a saved draft. */
  finishRequestText(surface:NativeMaterialTextSurfaceV1):Promise<{
    readonly snapshot:RoleplayInputMaterialBuildV1['snapshot']
    readonly plan:RoleplayInputMaterialBuildV1['plan']
    readonly textOutputs:readonly NativeMaterialTextOutputV1[]
    readonly finalize?:RoleplayInputMaterialBuildV1['finalize']
  }>
}
export type RoleplayInputMaterialBuildResultV1=RoleplayInputMaterialBuildV1
  |RoleplayInputMaterialDraftV1
  |{readonly kind:'source-data-successor'}
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
  readonly renderedAuthorMaterial?:TavernRenderedAuthorMaterialV1
  readonly material:Pick<NativeRequestMaterialTransformV1,
    'requiredSections'|'sections'|'insertions'|'anchoredInsertions'|'messageProjection'|'story'>
    &{readonly messageTextProjections?:NativeRequestMaterialTransformV2['messageTextProjections']}
    &{readonly finalTextProjection?:NativeMaterialFinalTextProjectionV1}
  readonly responseHooks?:RoleplayInputMaterialBuildV1['responseHooks']
  readonly materialSha256:string
  readonly snapshot:{key:string;sha256:string}
  readonly plan:{key:string;sha256:string}
  readonly captureSha256:string
  readonly records:{readonly snapshot:unknown;readonly plan:unknown}
  routeSha256?:string
  transformed?:{decisionSha256:string;decision?:NativeRequestMaterialTransformV1|NativeRequestMaterialTransformV2;
    materialRef?:{seq:number;sha256:string}}
}
interface MaterialCandidate {
  readonly kind:'material-candidate'
  readonly initial:NativeRequestMaterialPrepareInputV1
  readonly scope:RoleplayInputMaterialScopeV1
  readonly checks:Ready['checks']
  readonly material:Ready['material']
  readonly renderedAuthorMaterial?:TavernRenderedAuthorMaterialV1
  readonly responseHooks?:RoleplayInputMaterialBuildV1['responseHooks']
  readonly materialSha256:string
  readonly snapshot:MaterialRecordV1
  readonly plan:MaterialRecordV1
  readonly refs:Pick<Ready,'snapshot'|'plan'>
  readonly captureSha256:string
  readonly routeSha256?:string
  readonly finalize?:RoleplayInputMaterialBuildV1['finalize']
}
interface MaterialTextDraft {
  readonly kind:'material-text-draft'
  readonly native:NativeMaterialTextDraftV1['structure']
  finish(surface:NativeMaterialTextSurfaceV1):Promise<MaterialCandidate>
}
function candidateTransform(row:MaterialCandidate):NativeRequestMaterialTransformV1|NativeRequestMaterialTransformV2 {
  return {kind:'transform',...row.material.messageTextProjections?{
    schemaVersion:2 as const,encoding:'native-request-material-owner-transform-v2' as const,
    messageTextProjections:row.material.messageTextProjections}:{
    schemaVersion:1 as const,encoding:'native-request-material-owner-transform-v1' as const},
    ...row.refs,captureSha256:row.captureSha256,expectedAssemblySha256:row.initial.assemblySha256,
    expectedSelectedBaseSha256:row.initial.selected.sha256,requiredSections:row.material.requiredSections,
    sections:row.material.sections,insertions:row.material.insertions,
    ...row.material.finalTextProjection?{finalTextProjection:row.material.finalTextProjection}:{},
    ...row.material.anchoredInsertions?{anchoredInsertions:row.material.anchoredInsertions}:{},
    ...row.material.messageProjection?{messageProjection:row.material.messageProjection}:{},
    ...row.material.story?{story:row.material.story}:{}}
}
function checkpointForPreview(candidate:PhaseACandidate,basis:NativeMaterialCandidateBasisV1,
  preview:NativeMaterialCandidatePreviewV1):{options?:PhaseACheckpointOptions}|undefined {
  const measurement=preview.measurement
  if(!measurement||measurement.capacity.status==='unknown'||measurement.capacity.excess<=0)
    return candidate.needsCheckpoint?{}:undefined
  if(!candidate.windowEnabled)fail('INPUT_REQUEST_CONTEXT_WINDOW_DISABLED')
  const storyRefs=new Map(candidate.storyMessages.map(row=>[row.id,row.eventSeq])),
    costs=new Map(preview.messageCosts.map(row=>[row.id,row]))
  let storyTokens=0
  for(const row of basis.selected.messages) {
    if(row.eventSeq===null||storyRefs.get(row.id)!==row.eventSeq)continue
    const cost=costs.get(row.id)
    if(!cost||cost.eventSeq!==row.eventSeq)fail('INPUT_REQUEST_STORY_COST_UNKNOWN')
    storyTokens+=cost.tokens
  }
  const requiredTokens=measurement.estimate.inputTokens-storyTokens,
    available=measurement.capacity.availableInput
  if(requiredTokens>available)fail('INPUT_REQUEST_REQUIRED_CONTEXT_EXCEEDS_CAPACITY')
  return {options:{fullRequestAllowance:Math.max(0,available-requiredTokens),messageCosts:preview.messageCosts}}
}
function fail(code:string):never {throw Error(code)}
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'INPUT_MATERIAL_PREPARATION_REFUSED'
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}

export function roleplayMaterialPreparationJournalKeyV1(snapshotKey:string,operationId:string):string {
  if(typeof operationId!=='string'||!operationId.length)fail('MATERIAL_PREPARATION_JOURNAL_OPERATION_INVALID')
  return `${snapshotKey}-journal-${recordSha256(operationId)}`
}
/** Project the existing material envelope's owner fields. Envelope validity
 * remains with the live writer or the actual Native-bound cold reader. */
export function roleplayMaterialPreparationJournalOwnerV1(basis:Readonly<Record<string,unknown>>):Readonly<Record<string,unknown>> {
  const common={sessionId:basis['sessionId'],turn:basis['turn'],step:basis['step']}
  if(basis['encoding']==='core-input-material-record-v1')return {kind:'input',...common,
    branchId:basis['branchId'],preparation:basis['preparation'],currency:basis['currency'],
    originalInputRefs:basis['originalInputRefs']}
  if(basis['encoding']==='core-program-opening-material-record-v1')return {kind:'opening',...common,
    identity:basis['identity'],seedRef:basis['seedRef'],inputRef:basis['inputRef'],nativeOwner:basis['nativeOwner']}
  return fail('MATERIAL_PREPARATION_JOURNAL_OWNER_INVALID')
}
/** The caller supplies the actual material scope/Native identity. This checks
 * only explanatory DATA association and cannot restore an execution owner. */
export function readRoleplayMaterialPreparationJournalRowV1(value:unknown,expected:{
  readonly key:string;readonly snapshotKey:string;readonly owner:Readonly<Record<string,unknown>>
}):RoleplayMaterialPreparationJournalRecordV1 {
  const row=value as RoleplayMaterialPreparationJournalRecordV1|undefined
  if(!row||row.schemaVersion!==1||row.encoding!=='core-material-preparation-journal-v1'
    ||row.authority!=='consumer-data-only'||Object.keys(row).length!==6
    ||typeof row.operationId!=='string'||!row.operationId.length
    ||!row.payload||typeof row.payload!=='object'||Array.isArray(row.payload)
    ||recordSha256(row.owner)!==recordSha256(expected.owner)
    ||expected.key!==roleplayMaterialPreparationJournalKeyV1(expected.snapshotKey,row.operationId)) {
    fail('MATERIAL_PREPARATION_JOURNAL_INVALID')
  }
  return row
}
/** Shared persistence contract for the two real material writers. Only their
 * live, source-free lifecycle guard admits reads and append confirmations. */
export function createRoleplayMaterialPreparationJournalV1(options:{
  readonly snapshotKey:string
  readonly owner:Readonly<Record<string,unknown>>
  readonly table:Pick<InputPreparationTable,'get'|'put'>
  enqueue<T>(operation:()=>Promise<T>):Promise<T>
  assertOwnerFactsCurrent():void
  register(row:{readonly key:string;readonly value:RoleplayMaterialPreparationJournalRecordV1;
    readonly sha256:string},phase:'writing'|'written'):void
}) {
  const binding=freeze(structuredClone(options.owner)),refs=new Map<string,RoleplayMaterialPreparationJournalRefV1>()
  const inspect=(operationId:string)=>{
    options.assertOwnerFactsCurrent()
    const key=roleplayMaterialPreparationJournalKeyV1(options.snapshotKey,operationId),value=options.table.get(key)
    if(value===undefined||value===null)return undefined
    const row=readRoleplayMaterialPreparationJournalRowV1(value,{key,snapshotKey:options.snapshotKey,owner:binding}),
      ref=Object.freeze({key,sha256:recordSha256(row)})
    options.register({...ref,value:row},'writing');options.register({...ref,value:row},'written')
    options.assertOwnerFactsCurrent();refs.set(key,ref)
    return {row,ref}
  }
  const journal:RoleplayMaterialPreparationJournalV1={
    read(operationId){return inspect(operationId)?.row.payload},
    append(operationId,payload,beforeWrite) {
      return options.enqueue(async()=>{
        const existing=inspect(operationId),key=roleplayMaterialPreparationJournalKeyV1(options.snapshotKey,operationId),
          value=freeze({schemaVersion:1 as const,encoding:'core-material-preparation-journal-v1' as const,
            authority:'consumer-data-only' as const,owner:binding,operationId,payload:structuredClone(payload)}),
          ref=Object.freeze({key,sha256:recordSha256(value)})
        if(existing) {
          if(existing.ref.sha256!==ref.sha256)fail('MATERIAL_PREPARATION_JOURNAL_CONFLICT')
          return existing.ref
        }
        options.register({...ref,value},'writing')
        let failure:{error:unknown}|undefined
        const release=beforeWrite?.({key,value})
        try {await options.table.put(key,value)}catch(error){failure={error}}finally {release?.()}
        // A lost put ACK can be confirmed from the same durable operation.
        // No canonical consumer may run until this exact pending append ACKs.
        if(recordSha256(options.table.get(key))!==ref.sha256) {
          if(failure)throw failure.error
          fail('MATERIAL_PREPARATION_JOURNAL_WRITE_UNCONFIRMED')
        }
        options.register({...ref,value},'written');options.assertOwnerFactsCurrent();refs.set(key,ref)
        return ref
      })
    },
  }
  return {journal,references:()=>Object.freeze([...refs.values()])}
}

/** This factory is invoked only inside the original Core bind closure. The
 * scope callback refuses before revealing a reconstructed or foreign step. */
export function createRoleplayInputMaterialOwnerV1(deps:RoleplayInputMaterialDependenciesV1,owner:{
  table:InputPreparationTable
  /** Proves the original binder's live step and Native admission. InputState
   * separately owns captured Source and input DATA. */
  scope(input:RoleplayInputMaterialScopeInputV1,candidate?:boolean):RoleplayInputMaterialScopeV1
  enqueue<T>(operation:()=>Promise<T>):Promise<T>
  /** Writer-only explanatory registration. This callback uses the binder's
   * source-free identity checker; it never calls scope/current or grants LiveReady. */
  registerNonNumericalBranchRow?(input:RoleplayInputMaterialScopeInputV1,scope:RoleplayInputMaterialScopeV1,
    row:OwnedNonNumericalInputBranchRowFactV1&{
      readonly kind:'input-material-snapshot'|'input-material-plan'|'input-material-journal'
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
  const requestMaterial:NativeRequestMaterialOwnerV2={schemaVersion:1,sectionNames:deps.sectionNames,
    story:{schemaVersion:2,
      normalizeText:text=>ready?.responseHooks?.normalizeText?.(text)??text,
      recoverText:blocks=>ready?.responseHooks?.recoverText?.(blocks),
      createTextTransform:()=>ready?.responseHooks?.createTextTransform?.()??{push:text=>text,finish:()=>''},
      async finalizeText(input) {
        const hooks=ready?.responseHooks
        return hooks?.schemaVersion===2?hooks.finalizeText(input):undefined
      }},
    prepare(input) {
      const controller=new AbortController()
      let began=performance.now(),spent=0,preparing=true,running=true
      const expire=()=>controller.abort(Error('INPUT_MATERIAL_PREPARATION_DEADLINE'))
      let timer=setTimeout(expire,ROLEPLAY_INPUT_MATERIAL_LIMITS_V1.deadlineMs)
      const pauseBudget=()=>{spent+=performance.now()-began;running=false;clearTimeout(timer)}
      const resumeBudget=()=>{
        began=performance.now();running=true
        timer=setTimeout(expire,Math.max(0,ROLEPLAY_INPUT_MATERIAL_LIMITS_V1.deadlineMs-spent))
      }
      controllers.add(controller)
      const operation=(async():Promise<NativeRequestMaterialPrepareDecisionV1>=>{
      let releaseBuild:(()=>void)|undefined
      try {
        const original=owner.scope(input,true)
        if(disposal.signal.aborted)fail('INPUT_MATERIAL_OWNER_DISPOSED')
        if(ready?.token===original.stepToken) {
          current(ready)
          if(nativeInputSha256(input.selected)!==nativeInputSha256(ready.initial.selected)
            ||input.assemblySha256!==ready.initial.assemblySha256)fail('INPUT_MATERIAL_PREPARATION_CHANGED')
          return {kind:'prepared'}
        }
        clearReady()
        const signal=AbortSignal.any([input.signal,disposal.signal,controller.signal])
        const assertBudgetAndSignal=()=>{
          signal.throwIfAborted()
          if(preparing&&spent+(running?performance.now()-began:0)>=ROLEPLAY_INPUT_MATERIAL_LIMITS_V1.deadlineMs) {
            controller.abort(Error('INPUT_MATERIAL_PREPARATION_DEADLINE'));signal.throwIfAborted()
          }
        }
        const sourceDataSuccessor=Symbol('source-data-successor')
        const planCandidate=async(original:RoleplayInputMaterialScopeV1)=>{
        const prefix=keyOf(original.session.id,
          `tavern-prompt-v1-${original.currency.preparationId}-${original.currency.attemptGeneration}-${original.step}`)
        const scope:RoleplayInputMaterialScopeV1={...original,signal:AbortSignal.any([original.signal,signal]),
          outputRows:[...original.outputRows??[],{table:'branch',key:prefix+'-snapshot'},{table:'branch',key:prefix+'-plan'}],
          assertCurrent(){
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
        const construct=async(initial:NativeRequestMaterialPrepareInputV1,
          preparedRoute?:NativeMaterialCandidateBasisV1['preparedRoute']):Promise<MaterialCandidate
          |MaterialTextDraft|Exclude<RoleplayInputMaterialBuildResultV1,RoleplayInputMaterialBuildV1
            |RoleplayInputMaterialDraftV1|{readonly kind:'source-data-successor'}>>=>{
        const data=await deps.prepare(initial,scope)
        // The trusted owner has already replaced this opaque step and Phase A.
        // No checkpoint of the retired scope can follow this result.
        if(data.kind==='source-data-successor')throw sourceDataSuccessor
        if(data.kind==='prepared-data'||data.kind==='text-draft')releaseBuild=data.release.bind(data)
        scope.signal.throwIfAborted();scope.assertOwnerFactsCurrent()
        if(data.kind!=='prepared-data'&&data.kind!=='text-draft')return data
        const checks={assertCurrent:data.assertCurrent.bind(data),assertSelected:data.assertSelected.bind(data),
          release:data.release.bind(data)}
        checks.assertSelected(initial.selected,true)
        // The recorded plan and the live transform must use the same detached,
        // frozen values. A producer's later array mutation cannot alter wire
        // content while the persisted explanatory record remains unchanged.
        // Layout owns the valid wire data; this publisher only detaches the
        // transform so its record and live request retain the same values.
        const structure=freeze(structuredClone({requiredSections:data.requiredSections,
          sections:data.sections,insertions:data.insertions,
          ...data.anchoredInsertions?{anchoredInsertions:data.anchoredInsertions}:{},
          ...data.messageTextProjections?{messageTextProjections:data.messageTextProjections}:{},
          ...data.messageProjection?{messageProjection:data.messageProjection}:{},...data.story?{story:data.story}:{}}))
        const basis={schemaVersion:1 as const,encoding:'core-input-material-record-v1' as const,
          authority:'consumer-data-only' as const,sessionId:scope.session.id,branchId:scope.session.id,
          preparation:scope.preparation,currency:scope.phaseA?.current().reference
            ?{...scope.currency,snapshot:scope.phaseA.current().reference}:scope.currency,
          originalInputRefs:scope.originalInputRefs,
          turn:scope.turn,step:scope.step}
        const seal=(payload:Pick<RoleplayInputMaterialBuildV1,'snapshot'|'plan'|'finalize'>,
          finalTextProjection?:NativeMaterialFinalTextProjectionV1):MaterialCandidate=>{
        const material=Object.freeze({...structure,...finalTextProjection?{finalTextProjection}:{}}),
          materialSha256=nativeInputSha256(material)
        const snapshot=Object.freeze({...basis,kind:'snapshot',payload:payload.snapshot}) as MaterialRecordV1
        const plan=Object.freeze({...basis,kind:'plan',payload:Object.freeze({promptPlan:payload.plan,
          nativeTransform:material,nativeTransformSha256:materialSha256})}) as MaterialRecordV1
        const refs={snapshot:{key:prefix+'-snapshot',sha256:recordSha256(snapshot)},
          plan:{key:prefix+'-plan',sha256:recordSha256(plan)}}
        return {kind:'material-candidate',initial,scope,checks,material,responseHooks:data.responseHooks,
          ...payload.finalize?{finalize:payload.finalize}:{},
          ...data.renderedAuthorMaterial?{renderedAuthorMaterial:data.renderedAuthorMaterial}:{},
          materialSha256,snapshot,plan,refs,
          ...(preparedRoute?{routeSha256:nativeInputSha256(preparedRoute)}:{}),
          captureSha256:recordSha256({schemaVersion:1,encoding:'core-input-material-capture-v1',
            ...refs,nativeSelectedSha256:initial.selected.sha256,assemblySha256:initial.assemblySha256})}
        }
        if(data.kind==='prepared-data')return seal({...data,...data.finalize?{finalize:data.finalize.bind(data)}:{}})
        return {kind:'material-text-draft',native:{...structure,
          ...structure.messageTextProjections?{schemaVersion:2 as const,
            encoding:'native-request-material-owner-transform-v2' as const,
            messageTextProjections:structure.messageTextProjections}:{schemaVersion:1 as const,
            encoding:'native-request-material-owner-transform-v1' as const},
          expectedAssemblySha256:initial.assemblySha256,expectedSelectedBaseSha256:initial.selected.sha256},
          async finish(surface) {
            checks.assertCurrent()
            const output=await data.finishRequestText(surface)
            checks.assertCurrent()
            // Native's producer compares actual slots once. Share its sparse
            // immutable result with this plan and Native's final seal.
            return seal(output,projectNativeMaterialTextOutputsV1(surface,output.textOutputs))
          }}
        }
        let chosen:Exclude<Awaited<ReturnType<typeof construct>>,MaterialTextDraft>|undefined
        if(scope.phaseA&&input.candidate) {
          let selectedBasis:NativeMaterialCandidateBasisV1|undefined
          const preview=async()=>input.candidate!.preview(scope.phaseA!.messages() as readonly UserMessage[],async basis=>{
            selectedBasis=basis
            const built=await construct({...input,selected:basis.selected,
              selectedCaptureV2:basis.selectedCaptureV2,finalAssembly:basis.finalAssembly,
              assemblySha256:basis.assemblySha256},basis.preparedRoute)
            if(built.kind==='material-text-draft')return {kind:'text-draft' as const,structure:built.native,
              async finalize(surface:NativeMaterialTextSurfaceV1) {
                const finalized=await built.finish(surface)
                chosen=finalized
                return {...finalized.refs,captureSha256:finalized.captureSha256,
                  ...finalized.material.finalTextProjection?{finalTextProjection:finalized.material.finalTextProjection}:{}}
              }}
            chosen=built
            if(chosen.kind==='refused')fail(chosen.code)
            return chosen.kind==='outside-declared-domain'?{kind:'unchanged' as const}:candidateTransform(chosen)
          })
          const first=await preview()
          assertBudgetAndSignal()
          const checkpoint=checkpointForPreview(scope.phaseA.current(),selectedBasis!,first)
          if(checkpoint) {
            // The existing notes-save owner keeps its own signal/deadline.
            // Releasing the old DATA baseline makes its writes visible to the
            // next capture without replaying author generation callbacks.
            releaseBuild?.();releaseBuild=undefined
            pauseBudget()
            await scope.phaseA.checkpoint(checkpoint.options)
            resumeBudget();assertBudgetAndSignal()
            const final=await preview()
            if(final.measurement?.capacity.status==='known'&&final.measurement.capacity.excess>0)
              fail('INPUT_REQUEST_CONTEXT_TOO_LARGE_AFTER_CHECKPOINT')
          }
          await scope.phaseA.commit()
        }else {
          if(scope.phaseA) {
            if(scope.phaseA.current().needsCheckpoint) {
              pauseBudget();await scope.phaseA.checkpoint();resumeBudget();assertBudgetAndSignal()
            }
            await scope.phaseA.commit()
          }
          const built=await construct(input)
          if(built.kind==='material-text-draft')fail('INPUT_MATERIAL_FINAL_TEXT_CANDIDATE_REQUIRED')
          chosen=built
        }
        if(!chosen)fail('INPUT_MATERIAL_PREPARATION_MISSING')
        return {chosen,scope}
        }
        let planning:Awaited<ReturnType<typeof planCandidate>>
        let nextScope=original
        for(;;) {
          try {planning=await planCandidate(nextScope);break}
          catch(error) {
            if(error!==sourceDataSuccessor)throw error
            releaseBuild?.();releaseBuild=undefined
            assertBudgetAndSignal()
            // Same Native invocation and monotonic budget, with fresh Phase A
            // and selected basis supplied only by the original input owner.
            nextScope=owner.scope(input,true)
          }
        }
        const scope=planning.scope
        let chosen=planning.chosen
        if(chosen.kind==='refused')return {kind:'blocked',code:chosen.code}
        if(chosen.kind==='outside-declared-domain') {
          outside.add(scope.stepToken);return {kind:'unchanged'}
        }
        const publishedScope=owner.scope(input)
        if(chosen.finalize) {
          const persistence=createRoleplayMaterialPreparationJournalV1({snapshotKey:chosen.refs.snapshot.key,
            owner:roleplayMaterialPreparationJournalOwnerV1(chosen.snapshot),
            table:owner.table,enqueue:owner.enqueue,
            assertOwnerFactsCurrent(){assertBudgetAndSignal();publishedScope.assertOwnerFactsCurrent()},
            register(row,phase){owner.registerNonNumericalBranchRow?.(input,publishedScope,
              {...row,kind:'input-material-journal',phase})}})
          const additions=await chosen.finalize(persistence.journal),journalRefs=persistence.references()
          assertBudgetAndSignal();publishedScope.assertOwnerFactsCurrent()
          if(journalRefs.length||Object.keys(additions?.snapshot??{}).length||Object.keys(additions?.plan??{}).length) {
            const snapshot=Object.freeze({...chosen.snapshot,payload:Object.freeze({...chosen.snapshot.payload,
              ...additions?.snapshot,...journalRefs.length?{materialPreparationJournalRefs:journalRefs}:{}})}),
              plan=Object.freeze({...chosen.plan,payload:Object.freeze({...chosen.plan.payload,
                promptPlan:Object.freeze({...chosen.plan.payload['promptPlan'] as Readonly<Record<string,unknown>>,
                  ...additions?.plan})})}),
              refs={snapshot:{key:chosen.refs.snapshot.key,sha256:recordSha256(snapshot)},
                plan:{key:chosen.refs.plan.key,sha256:recordSha256(plan)}},
              changed=refs.snapshot.sha256!==chosen.refs.snapshot.sha256||refs.plan.sha256!==chosen.refs.plan.sha256
            chosen={...chosen,snapshot,plan,refs,captureSha256:recordSha256({schemaVersion:1,
              encoding:'core-input-material-capture-v1',...refs,nativeSelectedSha256:chosen.initial.selected.sha256,
              assemblySha256:chosen.initial.assemblySha256})}
            if(changed&&scope.phaseA&&input.candidate) {
              // Finalized DATA refs affect Native material identities. Refresh
              // only Native planning; the selected guest build stays intact.
              const finalized=chosen
              const preview=await input.candidate.preview(scope.phaseA.messages() as readonly UserMessage[],async basis=>{
                if(basis.selected.sha256!==finalized.initial.selected.sha256
                  ||basis.assemblySha256!==finalized.initial.assemblySha256
                  ||nativeInputSha256(basis.preparedRoute)!==finalized.routeSha256)fail('INPUT_MATERIAL_FINALIZED_BASIS_CHANGED')
                return candidateTransform(finalized)
              })
              if(preview.measurement?.capacity.status==='known'&&preview.measurement.capacity.excess>0) {
                fail('INPUT_REQUEST_CONTEXT_TOO_LARGE_AFTER_FINALIZATION')
              }
            }
          }
        }
        const {checks,material,materialSha256,snapshot,plan,refs,captureSha256}=chosen
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
            owner.registerNonNumericalBranchRow?.(input,publishedScope,{...fact,phase:'writing'})
            if(old===undefined||old===null)await owner.table.put(ref.key,record)
            const readback=owner.table.get(ref.key)
            if(recordSha256(readback)!==ref.sha256)fail('INPUT_MATERIAL_WRITE_UNCONFIRMED')
            records[kind]=readback
            owner.registerNonNumericalBranchRow?.(input,publishedScope,{...fact,phase:'written'})
            // Readback precedes the cheap owner checkpoint. Both rows must
            // complete before any Ready object can reach Native.
            checks.assertCurrent()
          }
        })
        const row:Ready={token:scope.stepToken,scope:publishedScope,initial:chosen.initial,checks,material,materialSha256,...refs,
          responseHooks:chosen.responseHooks,
          ...chosen.renderedAuthorMaterial?{renderedAuthorMaterial:chosen.renderedAuthorMaterial}:{},
          records:{snapshot:records.snapshot,plan:records.plan},
          captureSha256,...chosen.routeSha256?{routeSha256:chosen.routeSha256,
            transformed:{decisionSha256:nativeInputSha256(candidateTransform(chosen))}}:{}}
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
        const decision:NativeRequestMaterialTransformV1|NativeRequestMaterialTransformV2={kind:'transform',
          ...row.material.messageTextProjections?{schemaVersion:2 as const,
            encoding:'native-request-material-owner-transform-v2' as const,
            messageTextProjections:row.material.messageTextProjections}:{schemaVersion:1 as const,
            encoding:'native-request-material-owner-transform-v1' as const},snapshot:row.snapshot,plan:row.plan,
          captureSha256:row.captureSha256,expectedAssemblySha256:input.assemblySha256,
          expectedSelectedBaseSha256:input.selected.sha256,requiredSections:row.material.requiredSections,
          sections:row.material.sections,insertions:row.material.insertions,
          ...row.material.finalTextProjection?{finalTextProjection:row.material.finalTextProjection}:{},
          ...row.material.anchoredInsertions?{anchoredInsertions:row.material.anchoredInsertions}:{},
          ...row.material.messageProjection?{messageProjection:row.material.messageProjection}:{},
          ...row.material.story?{story:row.material.story}:{}}
        row.transformed={decisionSha256:nativeInputSha256(decision)}
        return decision
      }catch(error) {return {kind:'blocked',code:codeOf(error)}}
    },
    check(input) {
      try {
        const scope=owner.scope(input),row=ready
        if(!row||row.token!==scope.stepToken||!row.transformed)fail('INPUT_MATERIAL_PLAN_CHANGED')
        // Native's decoder owns this deeply frozen plan. Later observer checks
        // still test Source currency, without rehashing the same decoded DATA.
        if(row.transformed.decision!==input.decision) {
          if(nativeInputSha256(input.decision)!==row.transformed.decisionSha256)fail('INPUT_MATERIAL_PLAN_CHANGED')
          row.transformed.decision=input.decision
        }
        current(row)
        if(!input.selected)fail('INPUT_MATERIAL_NATIVE_SELECTED_MISSING')
        row.checks.assertSelected(input.selected,input.selected.messages.some(message=>message.origin==='pending-decision'))
        if(input.materialRef) {
          const previous=row.transformed.materialRef
          if(previous&&nativeInputSha256(previous)!==nativeInputSha256(input.materialRef))fail('INPUT_MATERIAL_NATIVE_REF_CHANGED')
          if(!previous) {
            const event=scope.session.snapshotEvents().find(item=>Number(item.seq)===input.materialRef!.seq)
            if(event?.type!=='request/material'||nativeInputSha256(event)!==input.materialRef.sha256
              ||event.data.turn!==scope.turn||event.data.step!==scope.step
              ||nativeInputSha256(event.data.snapshot)!==nativeInputSha256(row.snapshot)
              ||nativeInputSha256(event.data.plan)!==nativeInputSha256(row.plan))fail('INPUT_MATERIAL_NATIVE_RECORD_UNPROVEN')
          }
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
    /** Tools run after this step's dispatch and before the binder selects its
     * successor. Require its actual opaque token and committed material; an
     * earlier turn's retained row or a preparation without dispatch is absent. */
    withCurrent<T>(step:RoleplayInputStep,read:(material:TavernRenderedAuthorMaterialV1)=>T):T|undefined {
      const row=ready
      if(!row||row.token!==step||!row.transformed?.materialRef||!row.renderedAuthorMaterial)return undefined
      current(row)
      return read(row.renderedAuthorMaterial)
    },
    /** The actual Session publisher supplies step/end. Normal completion does
     * not abort its signal, so retire its hot read at that existing boundary. */
    releaseStep(turn:number,step:number):void {
      if(ready?.scope.turn===turn&&ready.scope.step===step)clearReady()
    },
    async stop():Promise<void> {
      revoke()
      // This wait stays outside the input record FIFO. Preparation may itself
      // own a queued write; waiting from that FIFO would deadlock its cleanup.
      await Promise.allSettled([...preparations])
    },
    dispose(){disposal.abort('Core material owner disposed');revoke()},
  }
}
