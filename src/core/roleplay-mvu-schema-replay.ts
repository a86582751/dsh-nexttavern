/** The only schema execution owner. Persisted descriptors are facts; only this
 * factory's private WeakMap can associate replay with current publication. */
import {recordSha256} from './roleplay-data.js'
import type {SessionHistoryReader} from './session-history.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {schemaTraceRequestedStep} from './roleplay-mvu-schema-executor-types.js'
import {createRoleplayMvuSchemaJournal,freezeSchemaJournalData,sealSchemaJournalRecord,schemaNativeCutSha256,
  validateSchemaAnchor,schemaEpochExecution,schemaEpochAuthorIdentity,
  schemaJournalServerTailSha256,schemaJournalHostFrontierSha256} from './roleplay-mvu-schema-journal.js'
import type {CombinedAuthorCompiler,CombinedCompilationInput,CombinedAuthorProgram}
  from './tavern-author-combined-types.mjs'
import type {AuthorHostIdentityV5,AuthorServerExecutorV4,AuthorHostAssociationV5}
  from './roleplay-author-host-types-v5.js'
import type {MvuSchemaManualRunV4,MvuSchemaNextRunResultV4,MvuSchemaOwnedPrefixV4,MvuSchemaTraceInputV4}
  from './tavern-mvu-schema-types-v4.js'
import type {Session,SessionEvent} from 'dsh-nexttavern-native-session'
import type {mvuSchemaMarkers} from 'dsh-nexttavern-session-format/mvu-schema-marker'
import type {SchemaTraceRunner,SchemaRealmLoadFrame,SchemaTraceRequestedStep,SchemaTraceStepRecord,
  SchemaGuestOutput,SchemaTraceInput,SchemaTraceRunResult,SchemaEvaluationInput,SchemaAuthorProgram,
  SchemaAuthorCompilationInput,SchemaCompiler} from './roleplay-mvu-schema-executor-types.js'
import type {SchemaExecutionAnchor,SourceNativeCutFacts,SchemaJournalTable,SchemaJournalFrozenCut,
  SchemaJournalReady,SchemaJournalCapture,SchemaEpochRecord,SchemaDispatchRecord,SchemaCompletionRecord,SchemaUnavailableRecord,
  SchemaJournalRef,SchemaNativeMarkerRef,SchemaJournalRecordOwner} from './roleplay-mvu-schema-journal.js'
import type {SchemaExecutionBaseline} from './roleplay-mvu-schema-journal.js'
import type {SchemaJournalLiveReady,SchemaJournalLiveCapture,SchemaJournalScopeReferences,
  CaptureSchemaJournalScopeObjects} from './roleplay-mvu-schema-journal.js'
import type {MvuScopeObjectRefV2} from './tavern-mvu-scope-view-v2.js'

type JournalRead=SchemaJournalReady|SchemaJournalLiveReady
type JournalCapture=SchemaJournalCapture|SchemaJournalLiveCapture
const journalSteps=(ready:JournalRead)=>'materialize' in ready?[...ready.steps.range()]:ready.steps

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
  /** Process-only association retained non-enumerably by the actual producer. */
  readonly inheritedReady?:SchemaJournalReady
  /** The actual producer reads its own Session/Domain and joins checked
   * inherited DATA to new local rows. It carries no publication capability,
   * and remains non-enumerable across Core/Host wrappers and out of Guest RPC. */
  readonly captureJournal?:()=>JournalCapture
  /** Current Core producers hand off this exact synchronous Native/Domain
   * fold. Legacy producers leave it to their own Replay implementation. */
  journalCut?:JournalCapture
  /** A previous completed phase of this same Core owner supplies immutable
   * compiler DATA. The live owner and Source checks still admit each phase. */
  compiledProgram?:SchemaAuthorProgram|CombinedAuthorProgram
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
  /** The Core producer already parsed the actual journal and Native cut. */
  ready:SchemaJournalReady
  /** Existing read-only DTO consumers retain this alias of ready.frozen. */
  frozen:SchemaJournalFrozenCut
  events:readonly SessionEvent[]
}
/** A current Core read owns these immutable facts and their exact Domain
 * dependencies. Each waiter borrows independently; shared guest work retains
 * only DATA and cannot transfer one waiter's read lifecycle to another. */
export interface SchemaOwnedHistoricalCut extends HistoricalCutFacts {
  originalSha256:string
  current():boolean
  release():void
}
export interface SchemaReplayDeps {
  table:SchemaJournalTable
  recordOwner?:SchemaJournalRecordOwner
  nativeHistory?:SessionHistoryReader
  scopeReferences?:{readObject(ref:MvuScopeObjectRefV2):unknown;
    readScopeReferences:SchemaJournalScopeReferences;captureScopeObjects:CaptureSchemaJournalScopeObjects}
  resolveExecutionBaseline?:(ref:SchemaJournalRef,sessionId:string)=>SchemaExecutionBaseline
  compiler:SchemaCompiler
  runner:SchemaTraceRunner
  executorVersion:4
  /** Set only by the admitted Host5 package factory. The v4 compiler and
   * runner still own their actual guest ABI; Host5 owns complete association. */
  hostV5?:{identity:AuthorHostIdentityV5;compiler:CombinedAuthorCompiler;server:AuthorServerExecutorV4}
  markers:typeof mvuSchemaMarkers
  /** Trusted Core producer owns immutable author/frame/cut DATA and admits
   * the actual Source/Native lifecycle. Replay retains those snapshots;
   * selectors never carry program/source authority. */
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
  /** Old immutable Host factories keep the DTO callback above. Only a Replay
   * implementation that consumes and releases this read requests a borrow. */
  borrowHistoricalCut?(selector:HistoricalCutSelector,signal?:AbortSignal):Promise<SchemaOwnedHistoricalCut>
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
    capturedInput?:SchemaEvaluationInput;compiledProgram?:SchemaAuthorProgram|CombinedAuthorProgram}
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
  if('encoding' in program&&program.encoding==='native-mvu-owned-state-program-v1')fail('SCHEMA_COMBINED_ORIGINAL_REQUIRED')
  return {schemaVersion:2,encoding:'native-mvu-author-compilation-input-v2',source:program.source,
    libraries:program.libraries,bridge:program.bridge,stateLoader:program.stateLoader,
    executionPlan:expected?.executionPlan===null?null:program.executionPlan,
    scripts:program.scripts.map(({javascript:_javascript,javascriptSha256:_hash,...script})=>script)}
}
function selectorData(input:SchemaExecutionSelector):SchemaExecutionSelector {
  const value=freezeSchemaJournalData(input)
  exact(value,['sessionId','batchId','anchor'])
  if(!id(value.sessionId)||!id(value.batchId))fail('SCHEMA_SELECTOR_INVALID')
  validateSchemaAnchor(value.anchor)
  return value
}
export function createRoleplayMvuSchemaReplay(deps:SchemaReplayDeps) {
  const executorVersion=deps.executorVersion
  const host=deps.hostV5
  // This closure belongs to Core's actual Native owner. Importing another
  // bundle's history registry would silently lose the original snapshot facts.
  const nativeEvents=(session:Session)=>deps.nativeHistory?.events<SessionEvent>(session)??session.snapshotEvents()
  // The existing captureOwned producer supplies genuine Journal results.
  // Associate only this execution's exact input with that result; a reader
  // closure crosses bundles without sharing private module registries.
  const ownedPrefixes=new WeakMap<MvuSchemaTraceInputV4,MvuSchemaOwnedPrefixV4>()
  const runner=deps.scopeReferences&&deps.runner.bindScopeReferencesV2
    ?deps.runner.bindScopeReferencesV2(deps.scopeReferences.readObject):deps.runner
  const baselineRunners=new WeakMap<SchemaExecutionBaseline,typeof runner>()
  function executionRunner(baseline?:SchemaExecutionBaseline):typeof runner {
    if(!baseline?.scopeObjects.length||!deps.runner.bindScopeReferencesV2)return runner
    const prior=baselineRunners.get(baseline)
    if(prior)return prior
    const address=(ref:MvuScopeObjectRefV2)=>JSON.stringify([ref.ownerSessionId,ref.key,ref.sha256]),
      objects=new Map(baseline.scopeObjects.map(item=>[address(item.ref),item.object])),
      bound=deps.runner.bindScopeReferencesV2(ref=>objects.get(address(ref))??deps.scopeReferences?.readObject(ref))
    baselineRunners.set(baseline,bound)
    return bound
  }
  function checkExecutor(epoch?:SchemaEpochRecord):void {
    if(deps.runner.identity.version!==executorVersion
      ||deps.compiler.identity.version!==executorVersion)fail('SCHEMA_IMPLEMENTATION_CHANGED')
    if(host) {
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
  function traceInput(epoch:SchemaEpochRecord,prefix:readonly SchemaTraceStepRecord[],
    requestedStep:SchemaTraceRequestedStep):SchemaTraceInput {
    checkExecutor(epoch)
    const references=epoch.encoding==='native-mvu-schema-epoch-v5-scope-ref-v2'
    const trace={schemaVersion:executorVersion,encoding:references?'native-mvu-author-schema-trace-input-v4-scope-ref-v2'
      :'native-mvu-author-schema-trace-input-v4',
      realmEpoch:epoch.realmEpoch,loadFrame:schemaEpochExecution(epoch).loadFrame,prefix,requestedStep} as SchemaTraceInput
    // Journal/Source supply owned facts. The runner validates the constructed
    // trace once at its execution boundary, including the exact guest ABI.
    return trace
  }
  const journal=createRoleplayMvuSchemaJournal({table:deps.table,markers:deps.markers,resolveExecutionBaseline:deps.resolveExecutionBaseline,
    recordOwner:deps.recordOwner,nativeHistory:deps.nativeHistory,
    readScopeReferences:deps.scopeReferences?.readScopeReferences,captureScopeObjects:deps.scopeReferences?.captureScopeObjects})
  const active=new Map<string,{owner?:object;abort:AbortController}>()
  const ownerGenerations=new WeakMap<object,number>()
  const invalidatedOwners=new WeakSet<object>()
  const evidence=new WeakMap<object,{scope:SchemaOwnedScope;association:SchemaExecutionAssociation;
    output:SchemaGuestOutput;generation:number;ownerGeneration:number}>()
  const manualRuns=new Map<object,{run:MvuSchemaManualRunV4;incarnation:object;realmEpoch:string;
    programSha256:string;material:object;confirmedTailSha256:string}>()
  const manualClosures=new WeakMap<object,Promise<void>>()
  // These entries prove a frozen historical cut only. No publication owner
  // is stored. Each waiter confirms its own producer read after shared guest
  // work; legacy DTO producers retain their second capture.
  const historicalCache=new Map<string,{frozen:SchemaJournalFrozenCut;bytes:number}>()
  const historicalFlights=new Map<string,{abort:AbortController;waiters:number;
    promise:Promise<SchemaJournalFrozenCut>}>()
  let historicalCacheBytes=0
  let disposed=false,generation=0
  const ownerGeneration=(owner:object)=>ownerGenerations.get(owner)??0
  function closeOwner(owner:object):Promise<void> {
    const prior=manualClosures.get(owner)
    if(prior)return prior
    const live=manualRuns.get(owner)
    if(!live)return Promise.resolve()
    // Remove the executable resource before awaiting cleanup. Evidence keeps
    // its separate durable joins and can still authorize final publication.
    manualRuns.delete(owner)
    const closing=live.run.close()
    manualClosures.set(owner,closing)
    return closing
  }
  async function compileAuthor(input:SchemaOwnedScope['authorInput'],signal:AbortSignal) {
    if(host) {
      if(input.schemaVersion!==8)
        fail('SCHEMA_REPLAY_VERSION_MISMATCH')
      return host.compiler.compile(input,signal)
    }
    if(input.schemaVersion===8)
      fail('SCHEMA_REPLAY_VERSION_MISMATCH')
    return deps.compiler.compile(input,signal)
  }
  async function replayHistory(ready:SchemaJournalReady,program:SchemaAuthorProgram,signal:AbortSignal):Promise<void> {
    const steps=[...ready.executionBaseline?.materialize()??[],...ready.steps.map(item=>item.step)],last=steps.at(-1)
    if(!last)fail('SCHEMA_REALM_HISTORY_UNPROVEN')
    const input=traceInput(ready.epoch,steps.slice(0,-1),
      schemaTraceRequestedStep(last.eventId,last.frame,last.frame.input))
    // Historical execution consumes the exported physical closure, never a
    // live ancestor table. Each bound runner retains its own immutable reader.
    const address=(ref:MvuScopeObjectRefV2)=>JSON.stringify([ref.ownerSessionId,ref.key,ref.sha256])
    const objects=[...ready.executionBaseline?.scopeObjects??[],...'scopeObjects' in ready.frozen?ready.frozen.scopeObjects:[]],
      byAddress=new Map(objects.map(item=>[address(item.ref),item.object]))
    const historical=objects.length&&deps.runner.bindScopeReferencesV2
      ?deps.runner.bindScopeReferencesV2(ref=>byAddress.get(address(ref))):deps.runner
    const result=await historical.evaluateTrace(program,input,signal)
    signal.throwIfAborted()
    if(disposed)fail('SCHEMA_REPLAY_DISPOSED')
    if(result.kind!=='evaluated-trace')fail(result.diagnostics[0]?.code??'SCHEMA_EXECUTION_UNAVAILABLE')
    const actual=result.evaluation.records
    if(actual.length!==steps.length||actual.some((step,index)=>step.eventId!==steps[index]!.eventId
      ||step.stepSha256!==steps[index]!.stepSha256)) {
      fail('SCHEMA_REPLAY_MISMATCH')
    }
  }
  /** The private producer selects requestedStep's phase. Raw external-pack
   * replacement uses this same journaled transition and publication evidence,
   * with its existing realm load and complete prior execution frontier. */
  async function execute(input:SchemaExecutionSelector):Promise<SchemaExecutionResult> {
    let selector:SchemaExecutionSelector
    try {selector=selectorData(input)}catch(error) {return {kind:'blocked',code:codeOf(error)}}
    if(disposed||active.has(selector.sessionId))return {kind:'blocked',code:disposed?'SCHEMA_REPLAY_DISPOSED':'SCHEMA_REPLAY_BUSY',anchor:selector}
    const job={abort:new AbortController()} as {owner?:object;abort:AbortController}
    active.set(selector.sessionId,job)
    let captured:SchemaCapturedScope|undefined,scope:SchemaOwnedScope|undefined
    let ownedTrace:MvuSchemaTraceInputV4|undefined
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
      {
        // The runner owns the complete guest ABI parse. Replay binds these
        // Core-supplied facts to this publication owner before any execution.
        const frame=stepFrame.input.scopeReadFrame
        if(!frame) {
          if(stepFrame.input.schemaVersion!==4
            ||stepFrame.input.scopeReadRef.sourceNativeCutSha256!==stepFrame.sourceNativeCutSha256) {
            fail('SCHEMA_SCOPE_BINDING_INVALID')
          }
          return
        }
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
      // The Core producer owns immutable DATA separately from Native objects.
      // Only this invocation's cancellation signal changes in the wrapper.
      const inheritedReady=captured.inheritedReady,captureJournal=captured.captureJournal
      captured={...captured,signal:AbortSignal.any([captured.signal,job.abort.signal])}
      if(inheritedReady)Object.defineProperty(captured,'inheritedReady',{value:inheritedReady})
      if(captureJournal)Object.defineProperty(captured,'captureJournal',{value:captureJournal})
      if(captured.loadFrame!==undefined) {
        scope=captured
      }else if(!host||captured.authorInput.schemaVersion!==8
        ||!deps.completeHostFrames)fail('SCHEMA_OWNER_UNPROVEN')
      check('captured')
      const capturedCut=deps.nativeHistory?.cut?.<SessionEvent>(captured.session),
        capturedEvents=capturedCut?undefined:nativeEvents(captured.session),capturedLength=capturedCut?.length??capturedEvents!.length
      if(captured.session.id!==selector.sessionId||captured.sourceNativeCut.sessionId!==selector.sessionId
        ||captured.sourceNativeCut.ownerSessionId!==selector.sessionId||!hash(captured.realmEpoch)
        ||!same(captured.sourceNativeCut.anchor,selector.anchor)
        ||captured.sourceNativeCut.nativeCut!==capturedLength
        ||captured.sourceNativeCut.nativePrefixSha256!==(capturedCut?capturedCut.prefixSha256(capturedLength)
          :schemaNativeCutSha256(capturedEvents!,capturedLength,deps.nativeHistory?.prefixes)))fail('SCHEMA_SOURCE_CUT_INVALID')
      if(scope)checkFrames(scope)
      const original=captured.journalCut??captured.captureJournal?.()??journal.capture(selector.sessionId,captured.realmEpoch,
        capturedCut?capturedCut.materialize():capturedEvents!,captured.inheritedCut)
      if(original.kind==='blocked')fail(original.code)
      if(original.kind==='ready')checkExecutor(original.epoch)
      const currentRunner=executionRunner(original.kind==='ready'?original.executionBaseline:undefined),
        ownedNext=currentRunner.bindOwnedNext?.(input=>ownedPrefixes.get(input))
      if(original.kind==='ready'&&(original.ownedPrefixV4?.().hasEvent(selector.batchId)
        ??journalSteps(original).some(step=>step.dispatch.batchId===selector.batchId))) {
        fail('SCHEMA_BATCH_ALREADY_EXECUTED')
      }
      const compiled=captured.compiledProgram?{kind:'compiled' as const,program:captured.compiledProgram}:
        await compileAuthor(captured.authorInput,captured.signal)
      check('compiled')
      if(compiled.kind!=='compiled')fail('SCHEMA_COMPILATION_REFUSED')
      const completeProgram=compiled.program
      combined=completeProgram.schemaVersion===8?completeProgram:null
      const program:SchemaAuthorProgram=combined?combined.serverProgram!:completeProgram as SchemaAuthorProgram
      // Compilation can retain browser-only DATA. Numerical initialization
      // needs a real server result and creates no fake epoch or Native marker.
      if(!program)fail('AUTHOR_HOST_BROWSER_ONLY_INITIALIZATION_UNSUPPORTED')
      if(program.compiler.version!==executorVersion||program.bridge.version!==executorVersion)fail('SCHEMA_IMPLEMENTATION_CHANGED')
      if(!combined) {
        if(captured.authorInput.schemaVersion===8
          ||!same(compilationInput(program,captured.authorInput),captured.authorInput))fail('SCHEMA_AUTHOR_SOURCE_MISMATCH')
      }
      if(!scope) {
        const frames=deps.completeHostFrames!(captured,combined!)
        scope={...captured,...frames}
        if(captured.inheritedReady)Object.defineProperty(scope,'inheritedReady',{value:captured.inheritedReady})
        if(captured.captureJournal)Object.defineProperty(scope,'captureJournal',{value:captured.captureJournal})
        checkFrames(scope)
      }
      // Core retains a completed phase's immutable compiler DATA within the
      // same operation. Cold historical verification still recompiles its DTO.
      const epoch:SchemaEpochRecord=original.kind==='ready'?original.epoch:host&&combined?sealSchemaJournalRecord({
        schemaVersion:5 as const,encoding:runner.scopeInputProtocols?.includes('scope-ref-v2')
          ?'native-mvu-schema-epoch-v5-scope-ref-v2' as const:'native-mvu-schema-epoch-v5' as const,
        sessionId:selector.sessionId,realmEpoch:scope.realmEpoch,host:host.identity,program:combined,
        server:{executor:host.server,loadFrame:scope.loadFrame as import('./tavern-mvu-schema-types-v4.js').MvuSchemaRealmLoadFrameV4,
          loadAnchorSha256:recordSha256({programSha256:program.programSha256,realmEpoch:scope.realmEpoch,loadFrame:scope.loadFrame})}}):
        sealSchemaJournalRecord({
        schemaVersion:executorVersion,encoding:'native-mvu-schema-epoch-v4' as const,
        sessionId:selector.sessionId,
        realmEpoch:scope.realmEpoch,program,runner:deps.runner.identity,loadFrame:scope.loadFrame,
        loadAnchorSha256:recordSha256({programSha256:program.programSha256,realmEpoch:scope.realmEpoch,loadFrame:scope.loadFrame})}) as SchemaEpochRecord
      const execution=schemaEpochExecution(epoch)
      const requestedInput=scope.requestedStep.frame.input
      if(requestedInput.schemaVersion===4&&requestedInput.scopeReadRef) {
        if(epoch.encoding!=='native-mvu-schema-epoch-v5-scope-ref-v2'||!deps.scopeReferences) {
          fail('SCHEMA_SCOPE_REFERENCE_UNPROVEN')
        }
        deps.scopeReferences.readScopeReferences(program as import('./tavern-mvu-owned-state-types-v1.mjs').MvuExecutableProgramV4,
          requestedInput.scopeReadRef,{realmEpoch:scope.realmEpoch,ownerSessionId:scope.session.id,
            sourceNativeCutSha256:recordSha256(scope.sourceNativeCut),
            sourceSnapshotSha256:scope.sourceNativeCut.sourceSnapshotSha256},false)
      }
      // Fresh epochs retain the owned compiler result and the current frames;
      // persisted epochs must still match this invocation's actual inputs.
      // An exact Journal-owned load frame already carries its parsed anchor.
      // Independent producer frames retain the full body correlation below.
      if(original.kind==='ready'&&(schemaEpochAuthorIdentity(epoch).programSha256
        !==(combined?.combinedProgramSha256??program.programSha256)
        ||scope.loadFrame!==execution.loadFrame
          &&execution.loadAnchorSha256!==recordSha256({programSha256:program.programSha256,
            realmEpoch:scope.realmEpoch,loadFrame:scope.loadFrame}))) {
        fail('SCHEMA_AUTHOR_SOURCE_MISMATCH')
      }
      if(!same(execution.runner,deps.runner.identity))fail('SCHEMA_IMPLEMENTATION_CHANGED')
      // evaluateTrace below replays and compares every historical output before
      // evaluating the new step. A separate prefix-only replay repeats that work.
      const ownedPrefix=ownedNext&&selector.anchor.kind!=='manual'&&original.kind==='ready'
        ?original.ownedPrefixV4?.():undefined
      const prefix=ownedPrefix?[]:original.kind==='ready'
        ?[...original.executionBaseline?.materialize()??[],...journalSteps(original).map(item=>item.step)]:[]
      const localLength=original.kind==='ready'?original.steps.length:0
      const trace=traceInput(epoch,prefix,scope.requestedStep)
      if(ownedPrefix) {
        // Only ABI4 captured results expose this function. The placeholder
        // array stays private to the bound evaluator, which materializes the
        // actual history before cold parsing or a mismatched continuation.
        ownedTrace=trace as MvuSchemaTraceInputV4
        ownedPrefixes.set(ownedTrace,ownedPrefix)
      }
      let epochRef:SchemaJournalRef
      epochRef=await deps.withSourceBoundary(scope,async()=>{
        check('history-verified')
        // The captured journal already owns an existing immutable epoch and
        // its reference. Only initialization creates and confirms a new row.
        const result=original.kind==='ready'?original.epochRef:await journal.putProduced(epoch)
        epochWritten=true;check('epoch-written');return result
      })
      check('epoch-written')
      const dispatch:SchemaDispatchRecord=sealSchemaJournalRecord({schemaVersion:host?5:executorVersion,
        encoding:host?epoch.encoding==='native-mvu-schema-epoch-v5-scope-ref-v2'
            ?'native-mvu-schema-dispatch-v5-scope-ref-v2' as const:'native-mvu-schema-dispatch-v5' as const
            :'native-mvu-schema-dispatch-v4' as const,
        sessionId:selector.sessionId,realmEpoch:scope.realmEpoch,
        batchId:selector.batchId,ordinal:localLength+1,epoch:epochRef,
        previousTailSha256:original.kind==='ready'?schemaJournalServerTailSha256(original):execution.loadAnchorSha256,
        requestedStep:scope.requestedStep,sourceNativeCut:scope.sourceNativeCut,
        ...combined?{combinedProgramSha256:combined.combinedProgramSha256,serverProgramSha256:program.programSha256}:{}}) as SchemaDispatchRecord
      dispatchRef=await deps.withSourceBoundary(scope,async()=>{
        check('epoch-written')
        const result=await journal.putProduced(dispatch);check('dispatch-written');return result
      })
      check('dispatch-written')
      await deps.withSourceBoundary(scope,async()=>{
        check('dispatch-written')
        const event=deps.markers.appendDispatch(scope!.session,{schemaVersion:1,encoding:'native-mvu-schema-dispatch-marker-v1',
          sessionId:selector.sessionId,realmEpoch:scope!.realmEpoch,batchId:selector.batchId,
          programSha256:combined?.combinedProgramSha256??program.programSha256,
          sourceSha256:program.source.sourceSha256,previousTailSha256:dispatch.previousTailSha256,
          dispatchRecordSha256:dispatch.recordSha256,loadDescriptorSha256:localLength?null:epoch.recordSha256,
          observedNativeSeq:scope!.session.seq-1})
        dispatchMarker={seq:event.seq,sha256:recordSha256(event)};check('dispatch-appended')
      })
      check('dispatch-appended')
      const dispatchFlushed=await deps.flush(scope.session)
      check('dispatch-flushed')
      if(!dispatchFlushed)fail('SCHEMA_DISPATCH_FLUSH_UNKNOWN')
      let evaluated:SchemaTraceRunResult|MvuSchemaNextRunResultV4
      if(selector.anchor.kind==='manual'&&currentRunner.openManualRun) {
        const live=manualRuns.get(scope.owner)
        if(live) {
          if(trace.schemaVersion!==4||scope.requestedStep.frame.input.schemaVersion!==4
            ||live.incarnation!==scope.incarnation||live.realmEpoch!==scope.realmEpoch
            ||live.programSha256!==program.programSha256||live.material!==scope.requestedStep.frame.material
            ||live.confirmedTailSha256!==dispatch.previousTailSha256)fail('SCHEMA_MANUAL_RUN_CHANGED')
          const requested=scope.requestedStep
          evaluated=await live.run.advance({eventId:requested.eventId,frame:{
            ownerSessionId:requested.frame.ownerSessionId,
            sourceNativeCutSha256:requested.frame.sourceNativeCutSha256,
            input:scope.requestedStep.frame.input}},scope.signal)
        } else {
          const opened=await currentRunner.openManualRun(program,trace,scope.signal)
          if(opened.kind==='opened-manual-run') {
            manualRuns.set(scope.owner,{run:opened.run,incarnation:scope.incarnation,
              realmEpoch:scope.realmEpoch,programSha256:program.programSha256,
              material:scope.requestedStep.frame.material,confirmedTailSha256:dispatch.previousTailSha256})
            evaluated={kind:'evaluated-next',record:opened.record}
          } else evaluated=opened
        }
      } else {
        if(ownedTrace)evaluated=await ownedNext!.evaluateNext(program,trace,scope.signal)
        else if(currentRunner.evaluateNext)evaluated=await currentRunner.evaluateNext(program,trace,scope.signal)
        else evaluated=await currentRunner.evaluateTrace(program,trace,scope.signal)
      }
      check('guest-completed')
      if(evaluated.kind!=='evaluated-next'&&evaluated.kind!=='evaluated-trace') {
        fail(evaluated.diagnostics[0]?.code??'SCHEMA_EXECUTION_UNAVAILABLE')
      }
      // The admitted runner already produced this exact compact receipt and
      // frame hash. Completion stores the receipt; dispatch owns the frame.
      const step=evaluated.kind==='evaluated-next'?evaluated.record:evaluated.evaluation.records.at(-1)!
      const completion:SchemaCompletionRecord=sealSchemaJournalRecord({schemaVersion:host?5:executorVersion,
        encoding:host?epoch.encoding==='native-mvu-schema-epoch-v5-scope-ref-v2'
            ?'native-mvu-schema-completion-v5-scope-ref-v2' as const:'native-mvu-schema-completion-v5' as const
            :'native-mvu-schema-completion-v4' as const,
        sessionId:selector.sessionId,realmEpoch:scope.realmEpoch,
        batchId:selector.batchId,dispatch:dispatchRef,dispatchMarker:dispatchMarker!,runner:deps.runner.identity,
        step,
        ...combined?{combinedProgramSha256:combined.combinedProgramSha256,serverProgramSha256:program.programSha256}:{}}) as SchemaCompletionRecord
      const completionRef=await deps.withSourceBoundary(scope,async()=>{
        check('guest-completed');const result=await journal.putProduced(completion);check('completion-written');return result
      })
      check('completion-written')
      await deps.withSourceBoundary(scope,async()=>{
        check('completion-written')
        const event=deps.markers.appendCompletion(scope!.session,{schemaVersion:1,encoding:'native-mvu-schema-completion-marker-v1',
          sessionId:selector.sessionId,realmEpoch:scope!.realmEpoch,batchId:selector.batchId,dispatchSeq:dispatchMarker!.seq,
          dispatchRecordSha256:dispatch.recordSha256,completionRecordSha256:completion.recordSha256,
          completedTailSha256:step.stepSha256,observedNativeSeq:scope!.session.seq-1})
        completionMarker={seq:event.seq,sha256:recordSha256(event)};check('completion-appended')
      })
      check('completion-appended')
      const completedFlushed=await deps.flush(scope.session)
      check('completion-flushed')
      if(!completedFlushed)fail('SCHEMA_COMPLETION_FLUSH_UNKNOWN')
      pairFlushed=true
      const result=await deps.withSourceBoundary(scope,async():Promise<SchemaExecutionResult>=>{
        check('mint')
        const ready=scope!.captureJournal?.()??journal.capture(selector.sessionId,scope!.realmEpoch,
          nativeEvents(scope!.session),scope!.inheritedCut,false,
          original.kind==='ready'?original.executionBaseline:undefined)
        if(ready.kind!=='ready'||schemaJournalServerTailSha256(ready)!==step.stepSha256) {
          fail(ready.kind==='blocked'?ready.code:'SCHEMA_REALM_HISTORY_UNPROVEN')
        }
        const live=manualRuns.get(scope!.owner)
        if(live)live.confirmedTailSha256=step.stepSha256
        // The actual committed Journal owns immutable output. Publication and
        // returned DATA share that fact rather than exposing the runner's copy.
        const output=ready.steps.at(-1)!.step.output
        const common={sessionId:selector.sessionId,realmEpoch:scope!.realmEpoch,batchId:selector.batchId,
          anchor:selector.anchor,sourceNativeCutSha256:recordSha256(scope!.sourceNativeCut),
          dispatch:dispatchRef!,completion:completionRef,dispatchMarker:dispatchMarker!,completionMarker:completionMarker!,
          outputSha256:recordSha256(output)}
        const association:SchemaExecutionAssociation=combined?freezeSchemaJournalData({...common,schemaVersion:5,
          encoding:'native-author-host-association-v5',combinedProgramSha256:combined.combinedProgramSha256,
          serverProgramSha256:program.programSha256,epoch:epochRef,serverTailSha256:step.stepSha256,
          hostFrontierSha256:schemaJournalHostFrontierSha256(ready)}):freezeSchemaJournalData({...common,schemaVersion:1,
          encoding:'native-mvu-schema-execution-association-v1',programSha256:program.programSha256,
          tailSha256:step.stepSha256,frontierSha256:schemaJournalHostFrontierSha256(ready)})
        const token=Object.freeze({})
        evidence.set(token,{scope:scope!,association,output,generation:admittedGeneration,ownerGeneration:admittedOwnerGeneration})
        return {kind:'completed',output,association,evidence:token,compiledProgram:epoch.program}
      })
      // The Source lock has been released. Recheck current ownership/cut after
      // await without pretending this return boundary still holds that lock;
      // publication must independently reacquire it and check private evidence.
      check('returned')
      return result
    } catch(error) {
      let code=codeOf(error)
      const owner=scope?.owner??captured?.owner
      if(owner)try {await closeOwner(owner)}catch(cleanupError) {code=codeOf(cleanupError)}
      if(scope&&(dispatchRef||epochWritten)&&!pairFlushed) {
        const unavailable:SchemaUnavailableRecord=sealSchemaJournalRecord({schemaVersion:host?5:executorVersion,
          encoding:host?(scope.journalCut?.kind==='ready'
              &&scope.journalCut.epoch.encoding==='native-mvu-schema-epoch-v5-scope-ref-v2'
              ||!scope.inheritedCut&&runner.scopeInputProtocols?.includes('scope-ref-v2'))
              ?'native-mvu-schema-unavailable-v5-scope-ref-v2' as const:'native-mvu-schema-unavailable-v5' as const
              :'native-mvu-schema-unavailable-v4' as const,
          sessionId:selector.sessionId,realmEpoch:scope.realmEpoch,
          batchId:selector.batchId,dispatch:dispatchRef??null,sourceNativeCut:scope.sourceNativeCut,code,
          ...combined?{combinedProgramSha256:combined.combinedProgramSha256}:{}}) as SchemaUnavailableRecord
        try {await deps.withSourceBoundary(scope,()=>journal.putProduced(unavailable))}catch {code='SCHEMA_UNAVAILABLE_WRITE_UNKNOWN'}
        return {kind:'unavailable',code,anchor:selector,...(dispatchRef?{dispatch:dispatchRef}:{})}
      }
      return {kind:'blocked',code,anchor:selector,...(dispatchRef?{dispatch:dispatchRef}:{})}
    } finally {
      if(ownedTrace)ownedPrefixes.delete(ownedTrace)
      if(active.get(selector.sessionId)===job)active.delete(selector.sessionId)
    }
  }
  async function verifyHistorical(selector:HistoricalCutSelector,signal?:AbortSignal):Promise<SchemaHistoricalVerification> {
    let borrowed:SchemaOwnedHistoricalCut|undefined
    try {
      if(disposed)fail('SCHEMA_REPLAY_DISPOSED')
      checkExecutor()
      const value=freezeSchemaJournalData(selector)
      exact(value,['sessionId','realmEpoch','nativeCut'])
      if(!id(value.sessionId)||!hash(value.realmEpoch)||!Number.isSafeInteger(value.nativeCut)||value.nativeCut<0)fail('SCHEMA_SELECTOR_INVALID')
      signal?.throwIfAborted()
      const facts=deps.borrowHistoricalCut
        ?borrowed=await deps.borrowHistoricalCut(value,signal)
        :await deps.captureHistoricalCut(value,signal)
      signal?.throwIfAborted();if(disposed)fail('SCHEMA_REPLAY_DISPOSED')
      const ready=facts.ready
      if(ready.frozen.sessionId!==value.sessionId||ready.frozen.realmEpoch!==value.realmEpoch
        ||ready.frozen.nativeCut!==value.nativeCut)fail('SCHEMA_FROZEN_CUT_INVALID')
      const frozen=ready.frozen
      checkExecutor(ready.epoch)
      if(!same(schemaEpochExecution(ready.epoch).runner,deps.runner.identity))fail('SCHEMA_IMPLEMENTATION_CHANGED')
      const keyFor=(captured:HistoricalCutFacts)=>recordSha256(borrowed?{generation,selector:value,
        originalSha256:borrowed.originalSha256,epoch:captured.ready.epochRef,
        serverTailSha256:schemaJournalServerTailSha256(captured.ready),
        hostFrontierSha256:schemaJournalHostFrontierSha256(captured.ready),
        nativeCut:captured.ready.frozen.nativeCut,nativePrefixSha256:captured.ready.frozen.nativePrefixSha256,
        compiler:host?.compiler.identity??deps.compiler.identity,host:host?.identity,runner:deps.runner.identity}:
        {generation,selector:value,
        authorInput:captured.authorInput,frozen:captured.ready.frozen,
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
            const compiled=await compileAuthor(borrowed?facts.authorInput:freezeSchemaJournalData(facts.authorInput),
              abort.signal)
            check()
            if(compiled.kind!=='compiled')fail('SCHEMA_AUTHOR_SOURCE_MISMATCH')
            const reproduced='combinedProgramSha256' in compiled.program
              ?compiled.program.combinedProgramSha256:compiled.program.programSha256
            if(reproduced!==schemaEpochAuthorIdentity(ready.epoch).programSha256)fail('SCHEMA_AUTHOR_SOURCE_MISMATCH')
            // The current compiler already reproduced the exact persisted
            // program above. Keep one real historical execution, not a second
            // compilation of that same newly produced result.
            const program=compiled.program.schemaVersion===8
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
      if(borrowed) {
        if(!borrowed.current())fail('SCHEMA_HISTORICAL_FACTS_CHANGED')
      }else {
        const currentFacts=await deps.captureHistoricalCut(value,signal)
        signal?.throwIfAborted();if(disposed)fail('SCHEMA_REPLAY_DISPOSED')
        if(keyFor(currentFacts)!==key)fail('SCHEMA_HISTORICAL_FACTS_CHANGED')
      }
      return {kind:'verified',frozen:result}
    } catch(error) {return {kind:'blocked',code:codeOf(error)}}
    finally {borrowed?.release()}
  }
  function checkEvidence(token:object,input:SchemaPublicationBinding):boolean {
    try {
      const pin=evidence.get(token)
      if(!pin||disposed||pin.generation!==generation||pin.ownerGeneration!==ownerGeneration(pin.scope.owner)
        ||pin.scope.signal.aborted||!same(freezeSchemaJournalData(input),{association:pin.association,output:pin.output})
        ||!deps.checkOwned(pin.scope,{stage:'publication',dispatchMarker:pin.association.dispatchMarker,
          completionMarker:pin.association.completionMarker}))return false
      const ready=pin.scope.captureJournal?.()??journal.capture(pin.scope.session.id,pin.scope.realmEpoch,
        nativeEvents(pin.scope.session),pin.scope.inheritedCut)
      return ready.kind==='ready'&&schemaJournalHostFrontierSha256(ready)===schemaExecutionHostFrontierSha256(pin.association)
        &&schemaJournalServerTailSha256(ready)===schemaExecutionServerTailSha256(pin.association)
    } catch {return false}
  }
  return {execute,verifyHistorical,checkEvidence,closeOwner,
    invalidateOwner(owner:object):void {
      invalidatedOwners.add(owner)
      ownerGenerations.set(owner,ownerGeneration(owner)+1)
      for(const job of active.values())if(job.owner===owner)job.abort.abort()
      void closeOwner(owner).catch(()=>undefined)
    },
    dispose():void {
      if(disposed)return
      disposed=true;generation++
      for(const job of active.values())job.abort.abort()
      for(const owner of manualRuns.keys())void closeOwner(owner).catch(()=>undefined)
      for(const flight of historicalFlights.values())flight.abort.abort()
      historicalFlights.clear();historicalCache.clear();historicalCacheBytes=0
      journal.dispose()
    },
  }
}
