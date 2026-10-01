/** The only schema execution owner. Persisted descriptors are facts; only this
 * factory's private WeakMap can associate replay with current publication. */
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaData} from './tavern-mvu-schema-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {createRoleplayMvuSchemaJournal,freezeSchemaJournalData,sealSchemaJournalRecord,
  validateSchemaSourceCut,validateSchemaAnchor} from './roleplay-mvu-schema-journal.js'
import type {Session,SessionEvent} from '@deepseek-ai/dsh-session'
import type {mvuSchemaMarkers} from 'dsh-nexttavern-session-format/mvu-schema-marker'
import type {MvuSchemaCompiler,MvuSchemaRunner,MvuSchemaCompilationInput,MvuSchemaProgram,
  MvuSchemaRealmLoadFrame,MvuSchemaTraceRequestedStep,MvuSchemaTraceStepRecord,
  MvuSchemaTraceEvaluation,MvuSchemaGuestOutput,MvuSchemaTraceInput} from './tavern-mvu-schema-types.js'
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
  authorInput:MvuSchemaCompilationInput
  realmEpoch:string
  loadFrame:MvuSchemaRealmLoadFrame
  requestedStep:MvuSchemaTraceRequestedStep
  sourceNativeCut:SourceNativeCutFacts
  inheritedCut:SchemaJournalFrozenCut|null
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
  authorInput:MvuSchemaCompilationInput
  frozen:SchemaJournalFrozenCut
  events:readonly SessionEvent[]
}
export interface SchemaReplayDeps {
  table:SchemaJournalTable
  compiler:MvuSchemaCompiler
  runner:MvuSchemaRunner
  markers:typeof mvuSchemaMarkers
  /** Trusted Core producer reads actual Source/Native records and admits the
   * original load lifecycle; selectors never carry program/source authority. */
  captureOwned(selector:SchemaExecutionSelector):SchemaOwnedScope|Promise<SchemaOwnedScope>
  checkOwned(scope:SchemaOwnedScope,boundary:SchemaBoundary):boolean
  /** Core alone knows whether its private lease already owns the Source lock.
   * No caller-controlled flag can skip acquisition or grant reentrancy. */
  withSourceBoundary<T>(scope:SchemaOwnedScope,action:()=>Promise<T>):Promise<T>
  flush(session:Session):Promise<boolean>
  /** Supplies a producer-verified frozen Source/Domain/Native cut. Historical
   * reads must not consult a parent's later active pointer or numerical head. */
  captureHistoricalCut(selector:HistoricalCutSelector,signal?:AbortSignal):Promise<HistoricalCutFacts>
}
export interface SchemaExecutionAssociation {
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
export interface SchemaPublicationBinding {
  association:SchemaExecutionAssociation
  output:MvuSchemaGuestOutput
}
export type SchemaExecutionResult=
  | {kind:'completed';output:MvuSchemaGuestOutput;association:SchemaExecutionAssociation;evidence:object}
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
function compilationInput(program:MvuSchemaProgram):MvuSchemaCompilationInput {
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
function fullRecords(program:MvuSchemaProgram,input:MvuSchemaTraceInput,evaluation:MvuSchemaTraceEvaluation,
  runner:MvuSchemaRunner):MvuSchemaTraceStepRecord[] {
  const value=cloneSchemaData(evaluation,MVU_SCHEMA_BOUNDS.inputBytes+MVU_SCHEMA_BOUNDS.outputBytes+131072,
    {nodes:MVU_SCHEMA_BOUNDS.evaluationNodes,depth:MVU_SCHEMA_BOUNDS.evaluationDepth})
  exact(value,['schemaVersion','encoding','programSha256','runner','input','inputSha256','records','evaluationSha256'])
  const {evaluationSha256,...body}=value
  if(value.schemaVersion!==1||value.encoding!=='native-mvu-author-schema-trace-evaluation-v1'
    ||value.programSha256!==program.programSha256||!same(value.runner,runner.identity)||!same(value.input,input)
    ||value.inputSha256!==recordSha256(input)||evaluationSha256!==recordSha256(body))fail('SCHEMA_REPLAY_MISMATCH')
  const frames=[...input.prefix,input.requestedStep]
  if(!Array.isArray(value.records)||value.records.length!==frames.length)fail('SCHEMA_REPLAY_MISMATCH')
  let previous=recordSha256({programSha256:program.programSha256,realmEpoch:input.realmEpoch,loadFrame:input.loadFrame})
  return value.records.map((record,index)=>{
    exact(record,['eventId','ordinal','previousStepSha256','output','frameSha256','stepSha256'])
    const {frameSha256,...header}=record,frame=frames[index]!.frame
    const step={...header,frame},{stepSha256,...content}=step
    if(frameSha256!==recordSha256(frame)||step.eventId!==frames[index]!.eventId||step.ordinal!==index+1
      ||step.previousStepSha256!==previous||stepSha256!==recordSha256(content)
      ||index<input.prefix.length&&!same(step,input.prefix[index]))fail('SCHEMA_REPLAY_MISMATCH')
    previous=stepSha256
    return freezeSchemaJournalData(step)
  })
}
export function createRoleplayMvuSchemaReplay(deps:SchemaReplayDeps) {
  const journal=createRoleplayMvuSchemaJournal({table:deps.table,markers:deps.markers})
  const active=new Map<string,{owner?:object;abort:AbortController}>()
  const ownerGenerations=new WeakMap<object,number>()
  const invalidatedOwners=new WeakSet<object>()
  const evidence=new WeakMap<object,{scope:SchemaOwnedScope;association:SchemaExecutionAssociation;
    output:MvuSchemaGuestOutput;generation:number;ownerGeneration:number}>()
  // These entries prove a frozen historical cut only. No evidence token or
  // publication owner is stored, and each waiter repeats its actual producer
  // capture after the shared compiler/guest work has returned.
  const historicalCache=new Map<string,{frozen:SchemaJournalFrozenCut;bytes:number}>()
  const historicalFlights=new Map<string,{abort:AbortController;waiters:number;
    promise:Promise<SchemaJournalFrozenCut>}>()
  let historicalCacheBytes=0
  let disposed=false,generation=0
  const ownerGeneration=(owner:object)=>ownerGenerations.get(owner)??0
  async function replayHistory(ready:SchemaJournalReady,program:MvuSchemaProgram,signal:AbortSignal):Promise<void> {
    const steps=ready.steps.map(item=>item.step),last=steps.at(-1)
    if(!last)fail('SCHEMA_REALM_HISTORY_UNPROVEN')
    const input:MvuSchemaTraceInput={schemaVersion:1,encoding:'native-mvu-author-schema-trace-input-v1',
      realmEpoch:ready.epoch.realmEpoch,loadFrame:ready.epoch.loadFrame,prefix:steps.slice(0,-1),
      requestedStep:{eventId:last.eventId,frame:last.frame}}
    const result=await deps.runner.evaluateTrace(program,input,signal)
    signal.throwIfAborted()
    if(disposed)fail('SCHEMA_REPLAY_DISPOSED')
    if(result.kind!=='evaluated-trace'||!same(fullRecords(program,input,result.evaluation,deps.runner),steps)) {
      fail('SCHEMA_REPLAY_MISMATCH')
    }
  }
  async function execute(input:SchemaExecutionSelector):Promise<SchemaExecutionResult> {
    let selector:SchemaExecutionSelector
    try {selector=selectorData(input)}catch(error) {return {kind:'blocked',code:codeOf(error)}}
    if(disposed||active.has(selector.sessionId))return {kind:'blocked',code:disposed?'SCHEMA_REPLAY_DISPOSED':'SCHEMA_REPLAY_BUSY',anchor:selector}
    const job={abort:new AbortController()} as {owner?:object;abort:AbortController}
    active.set(selector.sessionId,job)
    let scope:SchemaOwnedScope|undefined,dispatchRef:SchemaJournalRef|undefined,epochWritten=false,pairFlushed=false
    let dispatchMarker:SchemaNativeMarkerRef|null=null,completionMarker:SchemaNativeMarkerRef|null=null
    const admittedGeneration=generation
    let admittedOwnerGeneration=0
    function check(stage:SchemaBoundaryStage):void {
      if(!scope||disposed||generation!==admittedGeneration||job.abort.signal.aborted||scope.signal.aborted||invalidatedOwners.has(scope.owner)
        ||ownerGeneration(scope.owner)!==admittedOwnerGeneration
        ||!deps.checkOwned(scope,{stage,dispatchMarker,completionMarker}))fail('SCHEMA_PERMISSION_REVOKED')
    }
    try {
      scope=await deps.captureOwned(selector)
      if(!scope||!scope.owner||!scope.incarnation||typeof scope.owner!=='object'||typeof scope.incarnation!=='object') {
        fail('SCHEMA_OWNER_UNPROVEN')
      }
      job.owner=scope.owner;admittedOwnerGeneration=ownerGeneration(scope.owner)
      // Snapshot data independently of private native objects. No caller can
      // mutate author/frame inputs while the compiler or worker is awaiting.
      scope={...scope,signal:AbortSignal.any([scope.signal,job.abort.signal]),
        authorInput:freezeSchemaJournalData(scope.authorInput),loadFrame:freezeSchemaJournalData(scope.loadFrame),
        requestedStep:freezeSchemaJournalData(scope.requestedStep),sourceNativeCut:validateSchemaSourceCut(scope.sourceNativeCut),
        inheritedCut:scope.inheritedCut===null?null:freezeSchemaJournalData(scope.inheritedCut)}
      check('captured')
      if(scope.session.id!==selector.sessionId||scope.sourceNativeCut.sessionId!==selector.sessionId
        ||scope.sourceNativeCut.ownerSessionId!==selector.sessionId||!hash(scope.realmEpoch)
        ||!same(scope.sourceNativeCut.anchor,selector.anchor)
        ||scope.sourceNativeCut.nativeCut!==scope.session.snapshotEvents().length
        ||scope.sourceNativeCut.nativePrefixSha256!==recordSha256(scope.session.snapshotEvents())
        ||scope.requestedStep.frame.sourceNativeCutSha256!==recordSha256(scope.sourceNativeCut)
        ||scope.requestedStep.frame.ownerSessionId!==selector.sessionId
        ||scope.sourceNativeCut.materialSha256!==recordSha256(scope.requestedStep.frame.material))fail('SCHEMA_SOURCE_CUT_INVALID')
      const original=journal.capture(selector.sessionId,scope.realmEpoch,scope.session.snapshotEvents(),scope.inheritedCut)
      if(original.kind==='blocked')fail(original.code)
      if(original.kind==='ready'&&original.steps.some(step=>step.dispatch.batchId===selector.batchId)) {
        fail('SCHEMA_BATCH_ALREADY_EXECUTED')
      }
      const compiled=await deps.compiler.compile(scope.authorInput,scope.signal)
      check('compiled')
      if(compiled.kind!=='compiled')fail('SCHEMA_COMPILATION_REFUSED')
      const program=compiled.program
      if(!same(compilationInput(program),scope.authorInput))fail('SCHEMA_AUTHOR_SOURCE_MISMATCH')
      const verified=await deps.compiler.verifyProgram(program,scope.signal)
      check('program-verified')
      if(!verified)fail('SCHEMA_PROGRAM_UNPROVEN')
      const epoch:SchemaEpochRecord=original.kind==='ready'?original.epoch:sealSchemaJournalRecord({
        schemaVersion:1 as const,encoding:'native-mvu-schema-epoch-v1' as const,sessionId:selector.sessionId,
        realmEpoch:scope.realmEpoch,program,runner:deps.runner.identity,loadFrame:scope.loadFrame,
        loadAnchorSha256:recordSha256({programSha256:program.programSha256,realmEpoch:scope.realmEpoch,loadFrame:scope.loadFrame})})
      if(!same(epoch.program,program)||!same(epoch.loadFrame,scope.loadFrame))fail('SCHEMA_AUTHOR_SOURCE_MISMATCH')
      if(!same(epoch.runner,deps.runner.identity))fail('SCHEMA_IMPLEMENTATION_CHANGED')
      if(original.kind==='ready') {await replayHistory(original,program,scope.signal);check('history-verified')}
      const prefix=original.kind==='ready'?original.steps.map(item=>item.step):[]
      const trace:MvuSchemaTraceInput={schemaVersion:1,encoding:'native-mvu-author-schema-trace-input-v1',realmEpoch:scope.realmEpoch,
        loadFrame:epoch.loadFrame,prefix,requestedStep:scope.requestedStep}
      // Check aggregate trace size before dispatch. Prefix is never truncated
      // to fit limits because doing so would silently change retained closures.
      cloneSchemaData(trace,MVU_SCHEMA_BOUNDS.inputBytes)
      if(prefix.length>=MVU_SCHEMA_BOUNDS.traceSteps)fail('SCHEMA_TRACE_LIMIT')
      let epochRef:SchemaJournalRef
      epochRef=await deps.withSourceBoundary(scope,async()=>{
        check('history-verified')
        const result=await journal.put(epoch);epochWritten=true;check('epoch-written');return result
      })
      check('epoch-written')
      const dispatch:SchemaDispatchRecord=sealSchemaJournalRecord({schemaVersion:1 as const,
        encoding:'native-mvu-schema-dispatch-v1' as const,sessionId:selector.sessionId,realmEpoch:scope.realmEpoch,
        batchId:selector.batchId,ordinal:prefix.length+1,epoch:epochRef,
        previousTailSha256:original.kind==='ready'?original.tailSha256:epoch.loadAnchorSha256,
        requestedStep:scope.requestedStep,sourceNativeCut:scope.sourceNativeCut})
      dispatchRef=await deps.withSourceBoundary(scope,async()=>{
        check('epoch-written')
        const result=await journal.put(dispatch);check('dispatch-written');return result
      })
      check('dispatch-written')
      await deps.withSourceBoundary(scope,async()=>{
        check('dispatch-written')
        const event=deps.markers.appendDispatch(scope!.session,{schemaVersion:1,encoding:'native-mvu-schema-dispatch-marker-v1',
          sessionId:selector.sessionId,realmEpoch:scope!.realmEpoch,batchId:selector.batchId,programSha256:program.programSha256,
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
      const completion:SchemaCompletionRecord=sealSchemaJournalRecord({schemaVersion:1 as const,
        encoding:'native-mvu-schema-completion-v1' as const,sessionId:selector.sessionId,realmEpoch:scope.realmEpoch,
        batchId:selector.batchId,dispatch:dispatchRef,dispatchMarker:dispatchMarker!,runner:deps.runner.identity,
        step:{...completedReceipt,frameSha256:recordSha256(completedFrame)}})
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
        if(ready.kind!=='ready'||ready.tailSha256!==step.stepSha256)fail(ready.kind==='blocked'?ready.code:'SCHEMA_REALM_HISTORY_UNPROVEN')
        const association:SchemaExecutionAssociation=freezeSchemaJournalData({schemaVersion:1,
          encoding:'native-mvu-schema-execution-association-v1',sessionId:selector.sessionId,realmEpoch:scope!.realmEpoch,
          batchId:selector.batchId,anchor:selector.anchor,sourceNativeCutSha256:recordSha256(scope!.sourceNativeCut),
          programSha256:program.programSha256,dispatch:dispatchRef!,completion:completionRef,
          dispatchMarker:dispatchMarker!,completionMarker:completionMarker!,tailSha256:step.stepSha256,
          frontierSha256:ready.frontierSha256,outputSha256:recordSha256(step.output)})
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
        const unavailable:SchemaUnavailableRecord=sealSchemaJournalRecord({schemaVersion:1 as const,
          encoding:'native-mvu-schema-unavailable-v1' as const,sessionId:selector.sessionId,realmEpoch:scope.realmEpoch,
          batchId:selector.batchId,dispatch:dispatchRef??null,sourceNativeCut:scope.sourceNativeCut,code})
        try {await deps.withSourceBoundary(scope,()=>journal.put(unavailable))}catch {code='SCHEMA_UNAVAILABLE_WRITE_UNKNOWN'}
        return {kind:'unavailable',code,anchor:selector,...(dispatchRef?{dispatch:dispatchRef}:{})}
      }
      return {kind:'blocked',code,anchor:selector,...(dispatchRef?{dispatch:dispatchRef}:{})}
    } finally {if(active.get(selector.sessionId)===job)active.delete(selector.sessionId)}
  }
  async function verifyHistorical(selector:HistoricalCutSelector,signal?:AbortSignal):Promise<SchemaHistoricalVerification> {
    try {
      if(disposed)fail('SCHEMA_REPLAY_DISPOSED')
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
      if(!same(ready.epoch.runner,deps.runner.identity))fail('SCHEMA_IMPLEMENTATION_CHANGED')
      const keyFor=(captured:HistoricalCutFacts)=>recordSha256({generation,selector:value,
        authorInput:captured.authorInput,frozen:captured.frozen,
        events:captured.events.slice(0,value.nativeCut),compiler:deps.compiler.identity,runner:deps.runner.identity})
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
            const compiled=await deps.compiler.compile(freezeSchemaJournalData(facts.authorInput),abort.signal)
            check()
            if(compiled.kind!=='compiled'||!same(compiled.program,ready.epoch.program))fail('SCHEMA_AUTHOR_SOURCE_MISMATCH')
            const verified=await deps.compiler.verifyProgram(compiled.program,abort.signal)
            check();if(!verified)fail('SCHEMA_PROGRAM_UNPROVEN')
            await replayHistory(ready,compiled.program,abort.signal);check()
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
      return ready.kind==='ready'&&ready.frontierSha256===pin.association.frontierSha256
        &&ready.tailSha256===pin.association.tailSha256
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
