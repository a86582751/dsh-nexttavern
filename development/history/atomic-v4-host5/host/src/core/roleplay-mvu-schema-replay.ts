/** The only schema execution owner. Persisted descriptors are facts; only this
 * factory's private WeakMap can associate replay with current publication. */
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaData,cloneSchemaEnvelopeV4} from './tavern-mvu-schema-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {schemaTraceRequestedStep} from './roleplay-mvu-schema-executor-types.js'
import {validateSchemaTraceInputV2,validateSchemaGuestOutputV2,validateSchemaEvaluationInputV2}
  from './tavern-mvu-schema-runner-v2.js'
import {validateSchemaTraceInputV3,validateSchemaGuestOutputV3,validateSchemaEvaluationInputV3}
  from './tavern-mvu-schema-runner-v3.js'
import {validateSchemaTraceInputV4,validateSchemaGuestOutputForProgramV4,validateSchemaEvaluationInputV4}
  from './tavern-mvu-schema-runner-v4.js'
import {validateSchemaProgramV4} from './tavern-mvu-schema-program-v4.js'
import {createRoleplayMvuSchemaJournal,freezeSchemaJournalData,sealSchemaJournalRecord,
  validateSchemaSourceCut,validateSchemaAnchor,schemaEpochExecution,
  schemaJournalServerTailSha256,schemaJournalHostFrontierSha256} from './roleplay-mvu-schema-journal.js'
import type {CombinedAuthorCompiler,CombinedCompilationInput,CombinedAuthorProgram}
  from './tavern-author-combined-types.mjs'
import {combinedCompilationInputForProgram} from './tavern-author-combined-data.mjs'
import type {AuthorHostIdentityV5,AuthorServerExecutorV4,AuthorHostAssociationV5}
  from './roleplay-author-host-types-v5.js'
import type {Session,SessionEvent} from '@deepseek-ai/dsh-session'
import type {mvuSchemaMarkers} from 'dsh-nexttavern-session-format/mvu-schema-marker'
import type {SchemaTraceRunner,SchemaRealmLoadFrame,SchemaTraceRequestedStep,SchemaTraceStepRecord,
  SchemaTraceEvaluation,SchemaGuestOutput,SchemaTraceInput,SchemaEvaluationInput,SchemaAuthorProgram,
  SchemaAuthorCompilationInput,SchemaCompiler} from './roleplay-mvu-schema-executor-types.js'
import type {SchemaExecutionAnchor,SourceNativeCutFacts,SchemaJournalTable,SchemaJournalFrozenCut,
  SchemaJournalReady,SchemaEpochRecord,SchemaDispatchRecord,SchemaCompletionRecord,SchemaUnavailableRecord,
  SchemaJournalRef,SchemaNativeMarkerRef} from './roleplay-mvu-schema-journal.js'

export type {SchemaExecutionAnchor,SourceNativeCutFacts} from './roleplay-mvu-schema-journal.js'
export interface SchemaExecutionSelector {sessionId:string;batchId:string;anchor:SchemaExecutionAnchor}
export interface SchemaOwnedScope {
  owner:object
  incarnation:object
  session:Session
  signal:AbortSignal
  authorInput:SchemaAuthorCompilationInput|CombinedCompilationInput
  realmEpoch:string
  loadFrame:SchemaRealmLoadFrame
  requestedStep:SchemaTraceRequestedStep
  sourceNativeCut:SourceNativeCutFacts
  inheritedCut:SchemaJournalFrozenCut|null
}
/** Initialization has no server frames until the single Combined compile
 * produces its actual partition. All other executions arrive with frames. */
export type SchemaCapturedScope=SchemaOwnedScope|
  (Omit<SchemaOwnedScope,'authorInput'|'loadFrame'|'requestedStep'>&{
    authorInput:CombinedCompilationInput;loadFrame?:undefined;requestedStep?:undefined
  })
export interface SchemaHostInitializationFrames {
  loadFrame:import('./tavern-mvu-schema-types-v4.js').MvuSchemaRealmLoadFrameV4
  requestedStep:import('./tavern-mvu-schema-types-v4.js').MvuSchemaTraceRequestedStepV4
}
export type SchemaBoundaryStage='captured'|'compiled'|'program-verified'|'history-verified'|'epoch-written'
  |'dispatch-written'|'dispatch-appended'|'dispatch-flushed'|'guest-completed'|'completion-written'
  |'completion-appended'|'completion-flushed'|'mint'|'returned'|'publication'
export interface SchemaBoundary {
  stage:SchemaBoundaryStage
  dispatchMarker:SchemaNativeMarkerRef|null
  completionMarker:SchemaNativeMarkerRef|null
}
export interface HistoricalCutSelector {sessionId:string;realmEpoch:string;nativeCut:number}
export interface HistoricalCutFacts {
  authorInput:SchemaAuthorCompilationInput|CombinedCompilationInput
  frozen:SchemaJournalFrozenCut
  events:readonly SessionEvent[]
}
export interface SchemaReplayDeps {
  table:SchemaJournalTable
  compiler:SchemaCompiler
  runner:SchemaTraceRunner
  /** Omission exists only for legacy v1 adapter tests. Core selects explicitly
   * from the epoch's exact compiler/bridge/libraries/runner implementation. */
  executorVersion?:1|2|3|4
  /** Set only by the admitted Host5 package factory. The v4 compiler and
   * runner still own their actual guest ABI; Host5 owns complete association. */
  hostV5?:{identity:AuthorHostIdentityV5;compiler:CombinedAuthorCompiler;server:AuthorServerExecutorV4}
  markers:typeof mvuSchemaMarkers
  /** Trusted Core producer reads actual Source/Native records and admits the
   * original load lifecycle; selectors never carry program/source authority. */
  captureOwned(selector:SchemaExecutionSelector):SchemaCapturedScope|Promise<SchemaCapturedScope>
  checkOwned(scope:SchemaCapturedScope,boundary:SchemaBoundary):boolean
  /** Synchronous Core callback uses its private initialization owner and the
   * captured cut. It can provide frames, never replace scope authority. */
  completeHostFrames?(scope:SchemaCapturedScope,program:CombinedAuthorProgram):SchemaHostInitializationFrames
  /** Core alone knows whether its private lease already owns the Source lock.
   * No caller-controlled flag can skip acquisition or grant reentrancy. */
  withSourceBoundary<T>(scope:SchemaOwnedScope,action:()=>Promise<T>):Promise<T>
  flush(session:Session):Promise<boolean>
  /** Supplies a producer-verified frozen Source/Domain/Native cut. Historical
   * reads must not consult a parent's later active pointer or numerical head. */
  captureHistoricalCut(selector:HistoricalCutSelector,signal?:AbortSignal):Promise<HistoricalCutFacts>
}
export interface LegacySchemaExecutionAssociation {
  schemaVersion:1
  encoding:'native-mvu-schema-execution-association-v1'
  sessionId:string
  realmEpoch:string
  batchId:string
  anchor:SchemaExecutionAnchor
  sourceNativeCutSha256:string
  programSha256:string
  dispatch:SchemaJournalRef
  completion:SchemaJournalRef
  dispatchMarker:SchemaNativeMarkerRef
  completionMarker:SchemaNativeMarkerRef
  tailSha256:string
  frontierSha256:string
  outputSha256:string
}
export type SchemaExecutionAssociation=LegacySchemaExecutionAssociation|AuthorHostAssociationV5
export const schemaExecutionProgramSha256=(association:SchemaExecutionAssociation)=>
  association.schemaVersion===5?association.combinedProgramSha256:association.programSha256
export const schemaExecutionServerTailSha256=(association:SchemaExecutionAssociation)=>
  association.schemaVersion===5?association.serverTailSha256:association.tailSha256
export const schemaExecutionHostFrontierSha256=(association:SchemaExecutionAssociation)=>
  association.schemaVersion===5?association.hostFrontierSha256:association.frontierSha256
export interface SchemaPublicationBinding {
  association:SchemaExecutionAssociation
  output:SchemaGuestOutput
}
export type SchemaExecutionResult=
  | {kind:'completed';output:SchemaGuestOutput;association:SchemaExecutionAssociation;evidence:object;
    capturedInput?:SchemaEvaluationInput}
  | {kind:'blocked'|'unavailable';code:string;anchor?:SchemaExecutionSelector;dispatch?:SchemaJournalRef}
export type SchemaHistoricalVerification={kind:'verified';frozen:SchemaJournalFrozenCut}
  | {kind:'blocked';code:string}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const id=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'SCHEMA_EXECUTION_UNAVAILABLE'
function fail(code:string):never {throw Error(code)}
function exact(value:object,keys:readonly string[]) {
  if(!same(Object.keys(value).sort(),[...keys].sort()))fail('SCHEMA_REPLAY_SHAPE')
}
function compilationInput(program:SchemaAuthorProgram,expected?:SchemaAuthorCompilationInput):SchemaAuthorCompilationInput {
  if(program.schemaVersion===2) {
    const value=validateSchemaProgramV4(program)
    return {schemaVersion:2,encoding:'native-mvu-author-compilation-input-v2',source:value.source,
      libraries:value.libraries,bridge:value.bridge,stateLoader:value.stateLoader,
      executionPlan:expected?.schemaVersion===2&&expected.executionPlan===null?null:value.executionPlan,
      scripts:value.scripts.map(({javascript:_javascript,javascriptSha256:_hash,...script})=>script)}
  }
  return {schemaVersion:1,source:program.source,libraries:program.libraries,bridge:program.bridge,
    scripts:program.scripts.map(({javascript:_javascript,javascriptSha256:_hash,...script})=>script)}
}
function selectorData(input:SchemaExecutionSelector):SchemaExecutionSelector {
  const value=freezeSchemaJournalData(input)
  exact(value,['sessionId','batchId','anchor'])
  if(!id(value.sessionId)||!id(value.batchId))fail('SCHEMA_SELECTOR_INVALID')
  validateSchemaAnchor(value.anchor)
  return value
}
function fullRecords(program:SchemaAuthorProgram,input:SchemaTraceInput,evaluation:SchemaTraceEvaluation,
  runner:SchemaTraceRunner):SchemaTraceStepRecord[] {
  const value=(evaluation.schemaVersion===4?cloneSchemaEnvelopeV4:cloneSchemaData)(evaluation,
    MVU_SCHEMA_BOUNDS.inputBytes+MVU_SCHEMA_BOUNDS.outputBytes+131072,
    {nodes:MVU_SCHEMA_BOUNDS.evaluationNodes,depth:MVU_SCHEMA_BOUNDS.evaluationDepth})
  exact(value,['schemaVersion','encoding','programSha256','runner','input','inputSha256','records','evaluationSha256'])
  const {evaluationSha256,...body}=value
  if(value.schemaVersion!==input.schemaVersion||value.encoding!==`native-mvu-author-schema-trace-evaluation-v${input.schemaVersion}`
    ||value.programSha256!==program.programSha256||!same(value.runner,runner.identity)||!same(value.input,input)
    ||value.inputSha256!==recordSha256(input)||evaluationSha256!==recordSha256(body))fail('SCHEMA_REPLAY_MISMATCH')
  const frames=[...input.prefix,input.requestedStep]
  if(!Array.isArray(value.records)||value.records.length!==frames.length)fail('SCHEMA_REPLAY_MISMATCH')
  let previous=recordSha256({programSha256:program.programSha256,realmEpoch:input.realmEpoch,loadFrame:input.loadFrame})
  const actualProgram=input.schemaVersion===4?validateSchemaProgramV4(program):null
  return value.records.map((record,index)=>{
    exact(record,['eventId','ordinal','previousStepSha256','output','frameSha256','stepSha256'])
    const {frameSha256,...header}=record,frame=frames[index]!.frame
    const step={...header,frame} as SchemaTraceStepRecord
    const {stepSha256,...content}=step
    if(input.schemaVersion===2)validateSchemaGuestOutputV2(step.output,validateSchemaEvaluationInputV2(frame.input))
    if(input.schemaVersion===3)validateSchemaGuestOutputV3(step.output,validateSchemaEvaluationInputV3(frame.input))
    if(input.schemaVersion===4)validateSchemaGuestOutputForProgramV4(step.output,actualProgram!,
      validateSchemaEvaluationInputV4(frame.input))
    if(frameSha256!==recordSha256(frame)||step.eventId!==frames[index]!.eventId||step.ordinal!==index+1
      ||step.previousStepSha256!==previous||stepSha256!==recordSha256(content)
      ||index<input.prefix.length&&!same(step,input.prefix[index]))fail('SCHEMA_REPLAY_MISMATCH')
    previous=stepSha256
    return freezeSchemaJournalData(step)
  })
}
export function createRoleplayMvuSchemaReplay(deps:SchemaReplayDeps) {
  const executorVersion=deps.executorVersion??1
  const host=deps.hostV5
  function checkExecutor(epoch?:SchemaEpochRecord):void {
    if(![1,2,3,4].includes(executorVersion)||deps.runner.identity.version!==executorVersion
      ||deps.compiler.identity.version!==executorVersion)fail('SCHEMA_IMPLEMENTATION_CHANGED')
    if(host) {
      if(executorVersion!==4)fail('SCHEMA_IMPLEMENTATION_CHANGED')
      if(epoch&&(epoch.schemaVersion!==5||!same(epoch.host,host.identity)
        ||!same(epoch.server.executor,host.server)||!same(epoch.program.compiler,host.compiler.identity))) {
        fail('SCHEMA_IMPLEMENTATION_CHANGED')
      }
    }else if(epoch) {
      if(epoch.schemaVersion===5||epoch.schemaVersion!==executorVersion
        ||epoch.program.compiler.version!==executorVersion||epoch.program.bridge.version!==executorVersion
        ||!same(epoch.runner,deps.runner.identity))fail('SCHEMA_IMPLEMENTATION_CHANGED')
    }
  }
  function traceInput(program:SchemaAuthorProgram,epoch:SchemaEpochRecord,prefix:readonly SchemaTraceStepRecord[],
    requestedStep:SchemaTraceRequestedStep):SchemaTraceInput {
    checkExecutor(epoch)
    const trace={schemaVersion:executorVersion,encoding:`native-mvu-author-schema-trace-input-v${executorVersion}`,
      realmEpoch:epoch.realmEpoch,loadFrame:schemaEpochExecution(epoch).loadFrame,prefix,requestedStep} as SchemaTraceInput
    if(executorVersion===4)validateSchemaTraceInputV4(validateSchemaProgramV4(program),trace)
    else if(executorVersion===3) {
      if(program.schemaVersion!==1)fail('SCHEMA_REPLAY_VERSION_MISMATCH')
      validateSchemaTraceInputV3(program,trace)
    }else if(executorVersion===2) {
      if(program.schemaVersion!==1)fail('SCHEMA_REPLAY_VERSION_MISMATCH')
      validateSchemaTraceInputV2(program,trace)
    }
    else if(schemaEpochExecution(epoch).loadFrame.schemaVersion!==1||requestedStep.frame.input.schemaVersion!==1
      ||prefix.some(step=>step.frame.input.schemaVersion!==1))fail('SCHEMA_REPLAY_VERSION_MISMATCH')
    return trace
  }
  const journal=createRoleplayMvuSchemaJournal({table:deps.table,markers:deps.markers})
  const active=new Map<string,{owner?:object;abort:AbortController}>()
  const ownerGenerations=new WeakMap<object,number>()
  const invalidatedOwners=new WeakSet<object>()
  const evidence=new WeakMap<object,{scope:SchemaOwnedScope;association:SchemaExecutionAssociation;
    output:SchemaGuestOutput;generation:number;ownerGeneration:number}>()
  // These entries prove a frozen historical cut only. No evidence token or
  // publication owner is stored, and each waiter repeats its actual producer
  // capture after the shared compiler/guest work has returned.
  const historicalCache=new Map<string,{frozen:SchemaJournalFrozenCut;bytes:number}>()
  const historicalFlights=new Map<string,{abort:AbortController;waiters:number;
    promise:Promise<SchemaJournalFrozenCut>}>()
  let historicalCacheBytes=0
  let disposed=false,generation=0
  const ownerGeneration=(owner:object)=>ownerGenerations.get(owner)??0
  async function compileAuthor(input:SchemaOwnedScope['authorInput'],signal:AbortSignal) {
    if(host) {
      if(input.schemaVersion!==3&&input.schemaVersion!==4&&input.schemaVersion!==5)fail('SCHEMA_REPLAY_VERSION_MISMATCH')
      return host.compiler.compile(input,signal)
    }
    if(input.schemaVersion===3||input.schemaVersion===4||input.schemaVersion===5)fail('SCHEMA_REPLAY_VERSION_MISMATCH')
    return deps.compiler.compile(input,signal)
  }
  async function replayHistory(ready:SchemaJournalReady,program:SchemaAuthorProgram,signal:AbortSignal):Promise<void> {
    const steps=ready.steps.map(item=>item.step),last=steps.at(-1)
    if(!last)fail('SCHEMA_REALM_HISTORY_UNPROVEN')
    const input=traceInput(program,ready.epoch,steps.slice(0,-1),
      schemaTraceRequestedStep(last.eventId,last.frame,last.frame.input))
    const result=await deps.runner.evaluateTrace(program,input,signal)
    signal.throwIfAborted()
    if(disposed)fail('SCHEMA_REPLAY_DISPOSED')
    if(result.kind!=='evaluated-trace')fail(result.diagnostics[0]?.code??'SCHEMA_EXECUTION_UNAVAILABLE')
    if(!same(fullRecords(program,input,result.evaluation,deps.runner),steps)) {
      fail('SCHEMA_REPLAY_MISMATCH')
    }
  }
  async function execute(input:SchemaExecutionSelector):Promise<SchemaExecutionResult> {
    let selector:SchemaExecutionSelector
    try {selector=selectorData(input)}catch(error) {return {kind:'blocked',code:codeOf(error)}}
    if(disposed||active.has(selector.sessionId))return {kind:'blocked',code:disposed?'SCHEMA_REPLAY_DISPOSED':'SCHEMA_REPLAY_BUSY',anchor:selector}
    const job={abort:new AbortController()} as {owner?:object;abort:AbortController}
    active.set(selector.sessionId,job)
    let captured:SchemaCapturedScope|undefined,scope:SchemaOwnedScope|undefined
    let dispatchRef:SchemaJournalRef|undefined,epochWritten=false,pairFlushed=false
    let combined:CombinedAuthorProgram|null=null
    let dispatchMarker:SchemaNativeMarkerRef|null=null,completionMarker:SchemaNativeMarkerRef|null=null
    const admittedGeneration=generation
    let admittedOwnerGeneration=0
    function check(stage:SchemaBoundaryStage):void {
      const current=scope??captured
      if(!current||disposed||generation!==admittedGeneration||job.abort.signal.aborted||current.signal.aborted
        ||invalidatedOwners.has(current.owner)||ownerGeneration(current.owner)!==admittedOwnerGeneration
        ||!deps.checkOwned(current,{stage,dispatchMarker,completionMarker}))fail('SCHEMA_PERMISSION_REVOKED')
    }
    function checkFrames(current:SchemaOwnedScope):void {
      if(current.loadFrame.schemaVersion!==executorVersion||current.requestedStep.frame.input.schemaVersion!==executorVersion) {
        fail('SCHEMA_REPLAY_VERSION_MISMATCH')
      }
      const stepFrame=current.requestedStep.frame
      if(stepFrame.sourceNativeCutSha256!==recordSha256(current.sourceNativeCut)
        ||stepFrame.ownerSessionId!==selector.sessionId
        ||current.sourceNativeCut.materialSha256!==recordSha256(stepFrame.material))fail('SCHEMA_SOURCE_CUT_INVALID')
      if(executorVersion===3||executorVersion===4) {
        const frame=(executorVersion===4?validateSchemaEvaluationInputV4(stepFrame.input)
          :validateSchemaEvaluationInputV3(stepFrame.input)).scopeReadFrame
        // A child reads its controlled current Source cut, not an ancestor's authority.
        if(frame.source.sessionId!==selector.sessionId
          ||frame.sourceNativeCutSha256!==stepFrame.sourceNativeCutSha256
          ||frame.source.sourceSnapshotSha256!==current.sourceNativeCut.sourceSnapshotSha256) {
          fail('SCHEMA_SCOPE_BINDING_INVALID')
        }
      }
    }
    try {
      checkExecutor()
      captured=await deps.captureOwned(selector)
      if(!captured||!captured.owner||!captured.incarnation||typeof captured.owner!=='object'||typeof captured.incarnation!=='object') {
        fail('SCHEMA_OWNER_UNPROVEN')
      }
      job.owner=captured.owner;admittedOwnerGeneration=ownerGeneration(captured.owner)
      // Snapshot data independently of private native objects. No caller can
      // mutate author/frame inputs while the compiler or worker is awaiting.
      const capturedBase={signal:AbortSignal.any([captured.signal,job.abort.signal]),
        sourceNativeCut:validateSchemaSourceCut(captured.sourceNativeCut),
        inheritedCut:captured.inheritedCut===null?null:freezeSchemaJournalData(captured.inheritedCut)}
      captured=captured.loadFrame===undefined?{...captured,...capturedBase,
        authorInput:freezeSchemaJournalData(captured.authorInput),loadFrame:undefined,requestedStep:undefined}:
        {...captured,...capturedBase,authorInput:freezeSchemaJournalData(captured.authorInput),
          loadFrame:freezeSchemaJournalData(captured.loadFrame),requestedStep:freezeSchemaJournalData(captured.requestedStep)}
      if(captured.loadFrame!==undefined) {
        scope=captured
      }else if(!host||(captured.authorInput.schemaVersion!==3&&captured.authorInput.schemaVersion!==4&&captured.authorInput.schemaVersion!==5)
        ||!deps.completeHostFrames)fail('SCHEMA_OWNER_UNPROVEN')
      check('captured')
      if(captured.session.id!==selector.sessionId||captured.sourceNativeCut.sessionId!==selector.sessionId
        ||captured.sourceNativeCut.ownerSessionId!==selector.sessionId||!hash(captured.realmEpoch)
        ||!same(captured.sourceNativeCut.anchor,selector.anchor)
        ||captured.sourceNativeCut.nativeCut!==captured.session.snapshotEvents().length
        ||captured.sourceNativeCut.nativePrefixSha256!==recordSha256(captured.session.snapshotEvents()))fail('SCHEMA_SOURCE_CUT_INVALID')
      if(scope)checkFrames(scope)
      const original=journal.capture(selector.sessionId,captured.realmEpoch,captured.session.snapshotEvents(),captured.inheritedCut)
      if(original.kind==='blocked')fail(original.code)
      if(original.kind==='ready')checkExecutor(original.epoch)
      if(original.kind==='ready'&&original.steps.some(step=>step.dispatch.batchId===selector.batchId)) {
        fail('SCHEMA_BATCH_ALREADY_EXECUTED')
      }
      const compiled=await compileAuthor(captured.authorInput,captured.signal)
      check('compiled')
      if(compiled.kind!=='compiled')fail('SCHEMA_COMPILATION_REFUSED')
      const completeProgram=compiled.program
      combined=completeProgram.schemaVersion===3||completeProgram.schemaVersion===4||completeProgram.schemaVersion===5?completeProgram:null
      const program:SchemaAuthorProgram=combined?combined.serverProgram!:completeProgram as SchemaAuthorProgram
      // Compilation can retain browser-only DATA. Numerical initialization
      // needs a real server result and creates no fake epoch or Native marker.
      if(!program)fail('AUTHOR_HOST_BROWSER_ONLY_INITIALIZATION_UNSUPPORTED')
      if(program.compiler.version!==executorVersion||program.bridge.version!==executorVersion)fail('SCHEMA_IMPLEMENTATION_CHANGED')
      if(combined) {
        if(!same(combinedCompilationInputForProgram(combined),captured.authorInput))fail('SCHEMA_AUTHOR_SOURCE_MISMATCH')
      }else {
        if(captured.authorInput.schemaVersion===3||captured.authorInput.schemaVersion===4||captured.authorInput.schemaVersion===5
          ||!same(compilationInput(program,captured.authorInput),captured.authorInput))fail('SCHEMA_AUTHOR_SOURCE_MISMATCH')
      }
      if(!scope) {
        const frames=deps.completeHostFrames!(captured,combined!)
        scope={...captured,loadFrame:freezeSchemaJournalData(frames.loadFrame),
          requestedStep:freezeSchemaJournalData(frames.requestedStep)}
        checkFrames(scope)
      }
      // This program came from the current owned compiler, not a stored DTO.
      // Historical verification separately recompiles frozen persisted programs.
      const epoch:SchemaEpochRecord=original.kind==='ready'?original.epoch:host&&combined?sealSchemaJournalRecord({
        schemaVersion:5 as const,encoding:'native-mvu-schema-epoch-v5' as const,
        sessionId:selector.sessionId,realmEpoch:scope.realmEpoch,host:host.identity,program:combined,
        server:{executor:host.server,loadFrame:scope.loadFrame as import('./tavern-mvu-schema-types-v4.js').MvuSchemaRealmLoadFrameV4,
          loadAnchorSha256:recordSha256({programSha256:program.programSha256,realmEpoch:scope.realmEpoch,loadFrame:scope.loadFrame})}}):
        sealSchemaJournalRecord({
        schemaVersion:executorVersion,encoding:executorVersion===1?'native-mvu-schema-epoch-v1' as const
          :executorVersion===2?'native-mvu-schema-epoch-v2' as const:executorVersion===3?'native-mvu-schema-epoch-v3' as const
          :'native-mvu-schema-epoch-v4' as const,
        sessionId:selector.sessionId,
        realmEpoch:scope.realmEpoch,program,runner:deps.runner.identity,loadFrame:scope.loadFrame,
        loadAnchorSha256:recordSha256({programSha256:program.programSha256,realmEpoch:scope.realmEpoch,loadFrame:scope.loadFrame})}) as SchemaEpochRecord
      const execution=schemaEpochExecution(epoch)
      if(!same(epoch.program,combined??program)||!same(execution.loadFrame,scope.loadFrame))fail('SCHEMA_AUTHOR_SOURCE_MISMATCH')
      if(!same(execution.runner,deps.runner.identity))fail('SCHEMA_IMPLEMENTATION_CHANGED')
      // evaluateTrace below replays and compares every historical output before
      // evaluating the new step. A separate prefix-only replay repeats that work.
      const prefix=original.kind==='ready'?original.steps.map(item=>item.step):[]
      const trace=traceInput(program,epoch,prefix,scope.requestedStep)
      // traceInput already validated the full logical trace and its DATA envelope.
      // Retained closures are never truncated to fit the transport budget.
      if(executorVersion===1)cloneSchemaData(trace,MVU_SCHEMA_BOUNDS.inputBytes)
      if(prefix.length>=MVU_SCHEMA_BOUNDS.traceSteps)fail('SCHEMA_TRACE_LIMIT')
      let epochRef:SchemaJournalRef
      epochRef=await deps.withSourceBoundary(scope,async()=>{
        check('history-verified')
        const result=await journal.put(epoch);epochWritten=true;check('epoch-written');return result
      })
      check('epoch-written')
      const dispatch:SchemaDispatchRecord=sealSchemaJournalRecord({schemaVersion:host?5:executorVersion,
        encoding:executorVersion===1?'native-mvu-schema-dispatch-v1' as const
          :executorVersion===2?'native-mvu-schema-dispatch-v2' as const:executorVersion===3?'native-mvu-schema-dispatch-v3' as const
          :host?'native-mvu-schema-dispatch-v5' as const:'native-mvu-schema-dispatch-v4' as const,
        sessionId:selector.sessionId,realmEpoch:scope.realmEpoch,
        batchId:selector.batchId,ordinal:prefix.length+1,epoch:epochRef,
        previousTailSha256:original.kind==='ready'?schemaJournalServerTailSha256(original):execution.loadAnchorSha256,
        requestedStep:scope.requestedStep,sourceNativeCut:scope.sourceNativeCut,
        ...combined?{combinedProgramSha256:combined.combinedProgramSha256,serverProgramSha256:program.programSha256}:{}}) as SchemaDispatchRecord
      dispatchRef=await deps.withSourceBoundary(scope,async()=>{
        check('epoch-written')
        const result=await journal.put(dispatch);check('dispatch-written');return result
      })
      check('dispatch-written')
      await deps.withSourceBoundary(scope,async()=>{
        check('dispatch-written')
        const event=deps.markers.appendDispatch(scope!.session,{schemaVersion:1,encoding:'native-mvu-schema-dispatch-marker-v1',
          sessionId:selector.sessionId,realmEpoch:scope!.realmEpoch,batchId:selector.batchId,
          programSha256:combined?.combinedProgramSha256??program.programSha256,
          sourceSha256:program.source.sourceSha256,previousTailSha256:dispatch.previousTailSha256,
          dispatchRecordSha256:dispatch.recordSha256,loadDescriptorSha256:prefix.length?null:epoch.recordSha256,
          observedNativeSeq:scope!.session.snapshotEvents().length-1})
        dispatchMarker={seq:event.seq,sha256:recordSha256(event)};check('dispatch-appended')
      })
      check('dispatch-appended')
      const dispatchFlushed=await deps.flush(scope.session)
      check('dispatch-flushed')
      if(!dispatchFlushed)fail('SCHEMA_DISPATCH_FLUSH_UNKNOWN')
      const evaluated=await deps.runner.evaluateTrace(program,trace,scope.signal)
      check('guest-completed')
      if(evaluated.kind!=='evaluated-trace')fail(evaluated.diagnostics[0]?.code??'SCHEMA_EXECUTION_UNAVAILABLE')
      const steps=fullRecords(program,trace,evaluated.evaluation,deps.runner),step=steps.at(-1)!
      const {frame:completedFrame,...completedReceipt}=step
      const completion:SchemaCompletionRecord=sealSchemaJournalRecord({schemaVersion:host?5:executorVersion,
        encoding:executorVersion===1?'native-mvu-schema-completion-v1' as const
          :executorVersion===2?'native-mvu-schema-completion-v2' as const:executorVersion===3?'native-mvu-schema-completion-v3' as const
          :host?'native-mvu-schema-completion-v5' as const:'native-mvu-schema-completion-v4' as const,
        sessionId:selector.sessionId,realmEpoch:scope.realmEpoch,
        batchId:selector.batchId,dispatch:dispatchRef,dispatchMarker:dispatchMarker!,runner:deps.runner.identity,
        step:{...completedReceipt,frameSha256:recordSha256(completedFrame)},
        ...combined?{combinedProgramSha256:combined.combinedProgramSha256,serverProgramSha256:program.programSha256}:{}}) as SchemaCompletionRecord
      const completionRef=await deps.withSourceBoundary(scope,async()=>{
        check('guest-completed');const result=await journal.put(completion);check('completion-written');return result
      })
      check('completion-written')
      await deps.withSourceBoundary(scope,async()=>{
        check('completion-written')
        const event=deps.markers.appendCompletion(scope!.session,{schemaVersion:1,encoding:'native-mvu-schema-completion-marker-v1',
          sessionId:selector.sessionId,realmEpoch:scope!.realmEpoch,batchId:selector.batchId,dispatchSeq:dispatchMarker!.seq,
          dispatchRecordSha256:dispatch.recordSha256,completionRecordSha256:completion.recordSha256,
          completedTailSha256:step.stepSha256,observedNativeSeq:scope!.session.snapshotEvents().length-1})
        completionMarker={seq:event.seq,sha256:recordSha256(event)};check('completion-appended')
      })
      check('completion-appended')
      const completedFlushed=await deps.flush(scope.session)
      check('completion-flushed')
      if(!completedFlushed)fail('SCHEMA_COMPLETION_FLUSH_UNKNOWN')
      pairFlushed=true
      const result=await deps.withSourceBoundary(scope,async():Promise<SchemaExecutionResult>=>{
        check('mint')
        const ready=journal.capture(selector.sessionId,scope!.realmEpoch,scope!.session.snapshotEvents(),scope!.inheritedCut)
        if(ready.kind!=='ready'||schemaJournalServerTailSha256(ready)!==step.stepSha256) {
          fail(ready.kind==='blocked'?ready.code:'SCHEMA_REALM_HISTORY_UNPROVEN')
        }
        const common={sessionId:selector.sessionId,realmEpoch:scope!.realmEpoch,batchId:selector.batchId,
          anchor:selector.anchor,sourceNativeCutSha256:recordSha256(scope!.sourceNativeCut),
          dispatch:dispatchRef!,completion:completionRef,dispatchMarker:dispatchMarker!,completionMarker:completionMarker!,
          outputSha256:recordSha256(step.output)}
        const association:SchemaExecutionAssociation=combined?freezeSchemaJournalData({...common,schemaVersion:5,
          encoding:'native-author-host-association-v5',combinedProgramSha256:combined.combinedProgramSha256,
          serverProgramSha256:program.programSha256,epoch:epochRef,serverTailSha256:step.stepSha256,
          hostFrontierSha256:schemaJournalHostFrontierSha256(ready)}):freezeSchemaJournalData({...common,schemaVersion:1,
          encoding:'native-mvu-schema-execution-association-v1',programSha256:program.programSha256,
          tailSha256:step.stepSha256,frontierSha256:schemaJournalHostFrontierSha256(ready)})
        const token=Object.freeze({})
        evidence.set(token,{scope:scope!,association,output:step.output,generation:admittedGeneration,ownerGeneration:admittedOwnerGeneration})
        return {kind:'completed',output:step.output,association,evidence:token}
      })
      // The Source lock has been released. Recheck current ownership/cut after
      // await without pretending this return boundary still holds that lock;
      // publication must independently reacquire it and check private evidence.
      check('returned')
      return result
    } catch(error) {
      let code=codeOf(error)
      if(scope&&(dispatchRef||epochWritten)&&!pairFlushed) {
        const unavailable:SchemaUnavailableRecord=sealSchemaJournalRecord({schemaVersion:host?5:executorVersion,
          encoding:executorVersion===1?'native-mvu-schema-unavailable-v1' as const
            :executorVersion===2?'native-mvu-schema-unavailable-v2' as const:executorVersion===3?'native-mvu-schema-unavailable-v3' as const
            :host?'native-mvu-schema-unavailable-v5' as const:'native-mvu-schema-unavailable-v4' as const,
          sessionId:selector.sessionId,realmEpoch:scope.realmEpoch,
          batchId:selector.batchId,dispatch:dispatchRef??null,sourceNativeCut:scope.sourceNativeCut,code,
          ...combined?{combinedProgramSha256:combined.combinedProgramSha256}:{}}) as SchemaUnavailableRecord
        try {await deps.withSourceBoundary(scope,()=>journal.put(unavailable))}catch {code='SCHEMA_UNAVAILABLE_WRITE_UNKNOWN'}
        return {kind:'unavailable',code,anchor:selector,...(dispatchRef?{dispatch:dispatchRef}:{})}
      }
      return {kind:'blocked',code,anchor:selector,...(dispatchRef?{dispatch:dispatchRef}:{})}
    } finally {if(active.get(selector.sessionId)===job)active.delete(selector.sessionId)}
  }
  async function verifyHistorical(selector:HistoricalCutSelector,signal?:AbortSignal):Promise<SchemaHistoricalVerification> {
    try {
      if(disposed)fail('SCHEMA_REPLAY_DISPOSED')
      checkExecutor()
      const value=freezeSchemaJournalData(selector)
      exact(value,['sessionId','realmEpoch','nativeCut'])
      if(!id(value.sessionId)||!hash(value.realmEpoch)||!Number.isSafeInteger(value.nativeCut)||value.nativeCut<0)fail('SCHEMA_SELECTOR_INVALID')
      signal?.throwIfAborted()
      const facts=await deps.captureHistoricalCut(value,signal)
      signal?.throwIfAborted();if(disposed)fail('SCHEMA_REPLAY_DISPOSED')
      if(facts.frozen.sessionId!==value.sessionId||facts.frozen.realmEpoch!==value.realmEpoch
        ||facts.frozen.nativeCut!==value.nativeCut)fail('SCHEMA_FROZEN_CUT_INVALID')
      const events=facts.events.slice(0,value.nativeCut),frozen=journal.validateFrozen(facts.frozen,events)
      const ready=journal.captureFrozen(value.sessionId,value.realmEpoch,events,frozen.records)
      if(ready.kind!=='ready')fail(ready.code)
      checkExecutor(ready.epoch)
      if(!same(schemaEpochExecution(ready.epoch).runner,deps.runner.identity))fail('SCHEMA_IMPLEMENTATION_CHANGED')
      const keyFor=(captured:HistoricalCutFacts)=>recordSha256({generation,selector:value,
        authorInput:captured.authorInput,frozen:captured.frozen,
        events:captured.events.slice(0,value.nativeCut),compiler:host?.compiler.identity??deps.compiler.identity,
        host:host?.identity,runner:deps.runner.identity})
      const key=keyFor(facts),cached=historicalCache.get(key)
      let result:SchemaJournalFrozenCut
      if(cached) {
        // Refresh insertion order for the bounded process-local read cache.
        historicalCache.delete(key);historicalCache.set(key,cached);result=cached.frozen
      } else {
        let flight=historicalFlights.get(key)
        if(!flight) {
          const abort=new AbortController(),admittedGeneration=generation
          const created={abort,waiters:0,promise:undefined as unknown as Promise<SchemaJournalFrozenCut>}
          const check=()=>{abort.signal.throwIfAborted();if(disposed||generation!==admittedGeneration)fail('SCHEMA_REPLAY_DISPOSED')}
          created.promise=(async()=>{
            const compiled=await compileAuthor(freezeSchemaJournalData(facts.authorInput),abort.signal)
            check()
            if(compiled.kind!=='compiled'||!same(compiled.program,ready.epoch.program))fail('SCHEMA_AUTHOR_SOURCE_MISMATCH')
            // The current compiler already reproduced the exact persisted
            // program above. Keep one real historical execution, not a second
            // compilation of that same newly produced result.
            const program=compiled.program.schemaVersion===3||compiled.program.schemaVersion===4||compiled.program.schemaVersion===5
              ?compiled.program.serverProgram:compiled.program
            if(!program)fail('SCHEMA_HOST_SERVER_PROGRAM_REQUIRED')
            await replayHistory(ready,program,abort.signal);check()
            const bytes=Buffer.byteLength(JSON.stringify(frozen),'utf8')
            // Large valid cuts remain readable; they simply do not occupy this
            // optional cache. Failed/aborted work never becomes a success entry.
            if(bytes<=16*1024*1024) {
              while(historicalCache.size&&(historicalCache.size>=4||historicalCacheBytes+bytes>32*1024*1024)) {
                const oldest=historicalCache.keys().next().value!
                historicalCacheBytes-=historicalCache.get(oldest)!.bytes;historicalCache.delete(oldest)
              }
              historicalCache.set(key,{frozen,bytes});historicalCacheBytes+=bytes
            }
            return frozen
          })().finally(()=>{if(historicalFlights.get(key)===created)historicalFlights.delete(key)})
          // A waiter can cancel before a worker finishes. Keep rejection
          // observed even when there are no remaining caller promises.
          void created.promise.catch(()=>{})
          historicalFlights.set(key,created);flight=created
        }
        flight.waiters++
        try {
          result=await new Promise<SchemaJournalFrozenCut>((resolve,reject)=>{
            const canceled=()=>reject(signal?.reason??Error('SCHEMA_HISTORICAL_CANCELLED'))
            signal?.addEventListener('abort',canceled,{once:true})
            if(signal?.aborted)canceled()
            flight!.promise.then(resolve,reject).finally(()=>signal?.removeEventListener('abort',canceled))
          })
        } finally {
          flight.waiters--
          if(!flight.waiters&&historicalFlights.get(key)===flight) {
            historicalFlights.delete(key);flight.abort.abort()
          }
        }
      }
      signal?.throwIfAborted();if(disposed)fail('SCHEMA_REPLAY_DISPOSED')
      const currentFacts=await deps.captureHistoricalCut(value,signal)
      signal?.throwIfAborted();if(disposed)fail('SCHEMA_REPLAY_DISPOSED')
      if(keyFor(currentFacts)!==key)fail('SCHEMA_HISTORICAL_FACTS_CHANGED')
      return {kind:'verified',frozen:result}
    } catch(error) {return {kind:'blocked',code:codeOf(error)}}
  }
  function checkEvidence(token:object,input:SchemaPublicationBinding):boolean {
    try {
      const pin=evidence.get(token)
      if(!pin||disposed||pin.generation!==generation||pin.ownerGeneration!==ownerGeneration(pin.scope.owner)
        ||pin.scope.signal.aborted||!same(freezeSchemaJournalData(input),{association:pin.association,output:pin.output})
        ||!deps.checkOwned(pin.scope,{stage:'publication',dispatchMarker:pin.association.dispatchMarker,
          completionMarker:pin.association.completionMarker}))return false
      const ready=journal.capture(pin.scope.session.id,pin.scope.realmEpoch,pin.scope.session.snapshotEvents(),pin.scope.inheritedCut)
      return ready.kind==='ready'&&schemaJournalHostFrontierSha256(ready)===schemaExecutionHostFrontierSha256(pin.association)
        &&schemaJournalServerTailSha256(ready)===schemaExecutionServerTailSha256(pin.association)
    } catch {return false}
  }
  return {execute,verifyHistorical,checkEvidence,
    invalidateOwner(owner:object):void {
      invalidatedOwners.add(owner)
      ownerGenerations.set(owner,ownerGeneration(owner)+1)
      for(const job of active.values())if(job.owner===owner)job.abort.abort()
    },
    dispose():void {
      if(disposed)return
      disposed=true;generation++
      for(const job of active.values())job.abort.abort()
      for(const flight of historicalFlights.values())flight.abort.abort()
      historicalFlights.clear();historicalCache.clear();historicalCacheBytes=0
    },
  }
}
