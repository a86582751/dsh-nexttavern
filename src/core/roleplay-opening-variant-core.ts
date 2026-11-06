/** Native maintenance owns each opening-pack transaction. Reader bindings
 * locate captured DATA, while this owner grants Source and execution access. */
import {recordSha256,sha256} from './roleplay-data.js'
import {createRoleplayOpeningVariants,openingVariantId} from './roleplay-opening-variants.js'
import type {OpeningVariantOperationV1,OpeningVariantTransactionContext,OpeningVariantMutationResult,OpeningVariantBankReadContext,
  OpeningVariantActivationHandoff}
  from './roleplay-opening-variants.js'
import {createMvuNumericalPublicationOwner} from './roleplay-mvu-numerical-publication.js'
import {evaluateOpeningVariantContinuation} from './roleplay-opening-variant-continuation.js'
import {createOpeningVariantContinuationReader,openingVariantActivationPacketKey,openingVariantActivationSeedKey,
  openingVariantActivationEventKey,validateOpeningVariantActivationPacket,validateOpeningVariantActivationSeed}
  from './roleplay-opening-variant-activation.js'
import type {OpeningVariantActivationPacketV1,OpeningVariantActivationSeedV1}
  from './roleplay-opening-variant-activation.js'
import {createOpeningVariantDataReader,openingVariantArchiveKey} from './roleplay-opening-variant-activation.js'
import {validateOpeningVariantSet,validateOpeningVariantReplacementPlan,openingVariantReplacementSelector}
  from './roleplay-opening-variant-types.js'
import type {OpeningVariantMessageV1,OpeningVariantMutationRequestV1,OpeningVariantReplacementPlanV1,
  OpeningVariantReplacementPhaseV1,OpeningVariantSetV1} from './roleplay-opening-variant-types.js'
import {createRoleplayMvuSchemaJournal,schemaEpochExecution,isAuthorHostJournalReadyV5,
  schemaJournalFrontierSha256,schemaJournalServerTailSha256,schemaJournalHostFrontierSha256}
  from './roleplay-mvu-schema-journal.js'
import type {SchemaJournalReady,SchemaJournalLiveReady,SchemaJournalRef,SourceNativeCutFacts}
  from './roleplay-mvu-schema-journal.js'
import {createRoleplayMvuSchemaReplay} from './roleplay-mvu-schema-replay.js'
import type {SchemaOwnedScope,SchemaReplayDeps,SchemaBoundary,SchemaExecutionResult,SchemaExecutionAssociation}
  from './roleplay-mvu-schema-replay.js'
import {schemaEmptyPhaseInput,schemaTraceRequestedStep} from './roleplay-mvu-schema-executor-types.js'
import type {OwnedMvuSchemaExecutor,SchemaExecutorIdentityTuple,SchemaTraceStepRecord}
  from './roleplay-mvu-schema-executor-types.js'
import {schemaPhaseErrorPolicyForProgramV4} from './tavern-mvu-schema-program-v4.js'
import {schemaOriginalReplayCompilationInput} from './roleplay-mvu-schema-source.js'
import type {createRoleplayMvuSchemaSource} from './roleplay-mvu-schema-source.js'
import {sealMvuSchemaStoryFact} from './roleplay-mvu-schema-story-types.js'
import {validateMvuSchemaNumericalSnapshot} from './roleplay-mvu-schema-story-types.js'
import type {createRoleplayMvuSchemaStoryCore} from './roleplay-mvu-schema-story-core.js'
import type {ProtectedAuthorHostRuntimeV5} from './roleplay-author-host-assets.js'
import type {AuthorHostIdentityV5} from './roleplay-author-host-types-v5.js'
import type {RoleplayInputStateOwner} from './roleplay-input-state.js'
import type {RoleplayMvuScopeStoreV2} from './roleplay-mvu-scope-store-v2.js'
import type {OpeningCatalog} from './roleplay-opening-selection.js'
import type {AuthorOpeningVariantCaptureV1} from './roleplay-opening-variant-types.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {Session,SessionEvent} from 'dsh-nexttavern-native-session'
import type {NativeInputAdmissionAgentV2} from 'dsh-nexttavern-native-agent-loop'
import type {mvuSchemaMarkers} from 'dsh-nexttavern-session-format/mvu-schema-marker'
import type {MvuNativeOpeningReceipt} from './roleplay-mvu-initialization.js'
import {mvuStateCurrentHeadKey} from './roleplay-mvu-state.js'
import type {MvuSchemaOpeningActivationHeadV1} from './roleplay-mvu-schema-story-types.js'

interface Table {get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>;
  entries(prefix?:string,include?:(key:string,value:unknown)=>boolean):Iterable<[string,unknown]>}
interface Dependencies {
  branch:Table;status:Table;inputState:RoleplayInputStateOwner;scopeStore?:RoleplayMvuScopeStoreV2
  story:ReturnType<typeof createRoleplayMvuSchemaStoryCore>
  source:ReturnType<typeof createRoleplayMvuSchemaSource>
  session(sid:string):Session|undefined
  agent(session:Session):NativeInputAdmissionAgentV2|undefined
  active(session:Session):boolean
  catalog(sid:string):OpeningCatalog
  sourceSha256(sid:string):string
  protectedRuntime(tuple?:SchemaExecutorIdentityTuple,host?:AuthorHostIdentityV5)
    :Promise<OwnedMvuSchemaExecutor|ProtectedAuthorHostRuntimeV5>
  withSourceLock<T>(sid:string,work:()=>Promise<T>):Promise<T>
  flush(session:Session):Promise<boolean>
  markers:typeof mvuSchemaMarkers
  activatePrepared?(handoff:OpeningVariantActivationHandoff,authorizeParent:()=>Promise<void>):Promise<{sessionId:string}>
  modelSelection?(sid:string):OpeningVariantActivationPacketV1['model']
  readInheritedOpeningVariantFact?(sid:string,key:string):unknown
}
type Basis=ReturnType<Dependencies['story']['captureOpeningVariantBasis']>
type Permission={kind:'reader';capture:AuthorOpeningVariantCaptureV1;signal?:AbortSignal}
  |{kind:'retry';signal?:AbortSignal}
type JournalRead=SchemaJournalReady|SchemaJournalLiveReady
interface Owner {
  token:object;session:Session;agent:NativeInputAdmissionAgentV2;basis:Basis
  request:OpeningVariantMutationRequestV1;operation?:OpeningVariantOperationV1
  signal:AbortSignal;stopSha256:string;clockEpochMs:number;inSource:boolean
  permission:Permission;plan?:OpeningVariantReplacementPlanV1;scope?:SchemaOwnedScope
  driver?:ReturnType<typeof createRoleplayMvuSchemaReplay>
  runtime?:OwnedMvuSchemaExecutor|ProtectedAuthorHostRuntimeV5
  live?:Extract<SchemaExecutionResult,{kind:'completed'}>
  recovered?:OpeningVariantReplacementPhaseV1
  context?:OpeningVariantBankReadContext
  donor?:Promise<{ref:SchemaJournalRef;ready:SchemaJournalReady;prefix:readonly SchemaTraceStepRecord[];
    scopeObjects:ReadonlySet<string>}>
}
const same=(left:unknown,right:unknown)=>left===right||recordSha256(left)===recordSha256(right)
const scopeObjectKey=(ref:{ownerSessionId:string;key:string;sha256:string})=>
  JSON.stringify([ref.ownerSessionId,ref.key,ref.sha256])
function fail(code:string):never {throw Error(code)}
const packContext=(pack:MvuJsonObject)=>{
  const {stat_data:_values,schema:_schema,...context}=pack
  return context
}

export function createRoleplayOpeningVariantCore(deps:Dependencies) {
  const permissions=new WeakMap<object,Permission>(),owners=new Map<string,Owner>(),tokens=new WeakMap<object,Owner>(),
    drivers=new Map<string,ReturnType<typeof createRoleplayMvuSchemaReplay>>(),
    publication=createMvuNumericalPublicationOwner(deps.status),scopeBindings=deps.scopeStore?.bindings(deps.status),
    setDigests=new WeakMap<OpeningVariantSetV1,string>()
  const readData=createOpeningVariantDataReader(key=>deps.branch.get(key),deps.readInheritedOpeningVariantFact),
    readers=new Map<string,ReturnType<typeof createOpeningVariantContinuationReader>>()
  function readerFor(sid:string) {
    let reader=readers.get(sid)
    if(!reader){reader=createOpeningVariantContinuationReader(key=>readData(sid,key));readers.set(sid,reader)}
    return reader
  }
  const journal=createRoleplayMvuSchemaJournal({table:deps.status as never,markers:deps.markers,
    recordOwner:deps.inputState.schemaJournal,nativeHistory:deps.inputState.nativeHistory,
    readScopeReferences:scopeBindings?.readScopeReferences,captureScopeObjects:scopeBindings?.captureScopeObjects,
    resolveExecutionBaseline:(ref,sid)=>readerFor(sid).resolve(ref),
    live:{session:deps.session,observeDomainChanges:deps.inputState.observeDomainChanges,
      captureClosedData:deps.inputState.captureClosedData,readDataInventory:deps.inputState.readDataInventory}})
  let disposed=false
  const releaseLifetime=deps.inputState.observeSessionRelease(sid=>{
    const owner=owners.get(sid)
    if(owner)owner.driver?.invalidateOwner(owner.token)
    journal.releaseSession(sid);scopeBindings?.releaseSession(sid);readers.delete(sid)
  })
  const events=(session:Session)=>deps.inputState.nativeHistory?.events<SessionEvent>(session)??session.snapshotEvents()
  function readSet(sid:string,ref:SchemaJournalRef) {
    const set=validateOpeningVariantSet(readData(sid,ref.key) as OpeningVariantSetV1)
    let digest=setDigests.get(set)
    if(!digest){digest=recordSha256(set);setDigests.set(set,digest)}
    if(digest!==ref.sha256)fail('OPENING_VARIANT_SET_UNPROVEN')
    return set
  }
  function check(owner:Owner):void {
    owner.signal.throwIfAborted()
    if(disposed||!owner.inSource||owners.get(owner.session.id)!==owner||!deps.active(owner.session)
      ||deps.session(owner.session.id)!==owner.session||deps.agent(owner.session)!==owner.agent
      ||recordSha256(owner.agent.lookupInputStop())!==owner.stopSha256
      ||owner.permission.kind==='reader'&&!owner.permission.capture.sourceCurrent())fail('OPENING_VARIANT_PERMISSION_REVOKED')
    owner.basis.current()
  }
  function captureJournal(owner:Owner) {
    return journal.captureLive(owner.session.id,owner.basis.original.realmEpoch,
      {inherited:owner.basis.inheritedReady??null,executionBaseline:owner.basis.ready.executionBaseline})
  }
  function checkOwned(scope:SchemaOwnedScope,boundary:SchemaBoundary):boolean {
    try {
      const owner=tokens.get(scope.owner)
      if(!owner||!owner.scope||!owner.plan||scope.session!==owner.session
        ||scope.incarnation!==owner.agent||scope.signal.aborted)return false
      // Replay wraps only this invocation's signal before its first check.
      // Adopt that wrapper once while retaining the captured phase identity.
      const admitting=owner.scope!==scope
      if(admitting&&(boundary.stage!=='captured'||scope.requestedStep!==owner.scope.requestedStep
        ||scope.sourceNativeCut!==owner.scope.sourceNativeCut))return false
      check(owner)
      const native=events(owner.session),cut=owner.plan.initialCut.nativeCut
      for(const [index,ref] of [boundary.dispatchMarker,boundary.completionMarker].entries())
        if(ref&&(ref.seq!==cut+index||recordSha256(native[ref.seq])!==ref.sha256))return false
      if(native.length!==cut+(boundary.completionMarker?2:boundary.dispatchMarker?1:0))return false
      if(admitting)owner.scope=scope
      return true
    }catch {return false}
  }
  async function runtime(owner:Owner) {
    if(owner.runtime)return owner.runtime
    const ready=owner.basis.ready,{program,runner}=schemaEpochExecution(ready.epoch),
      tuple=isAuthorHostJournalReadyV5(ready)?ready.epoch.server.executor:
        {compiler:program.compiler,bridge:program.bridge,libraries:program.libraries,runner},
      host=isAuthorHostJournalReadyV5(ready)?ready.epoch.host:undefined,
      selected=await deps.protectedRuntime(tuple,host)
    check(owner)
    if(selected.executorVersion!==4||host&&(!('host' in selected)||!same(selected.host.identity,host)))
      fail('SCHEMA_IMPLEMENTATION_CHANGED')
    owner.runtime=selected
    return selected
  }
  async function driver(owner:Owner) {
    const selected=await runtime(owner)
    let replay=drivers.get(selected.implementationKey)
    if(!replay) {
      const bindings:Omit<SchemaReplayDeps,'compiler'|'runner'|'executorVersion'|'hostV5'>={
        table:deps.status as never,recordOwner:deps.inputState.schemaJournal,nativeHistory:deps.inputState.nativeHistory,
        scopeReferences:scopeBindings,markers:deps.markers,flush:deps.flush,
        resolveExecutionBaseline:(ref,sid)=>readerFor(sid).resolve(ref),
        captureHistoricalCut:deps.story.captureHistoricalCut,borrowHistoricalCut:deps.story.borrowHistoricalCut,
        captureOwned:selector=>{
          const actual=owners.get(selector.sessionId)
          if(!actual?.scope||actual.scope.requestedStep.eventId!==selector.batchId)fail('OPENING_VARIANT_OWNER_UNPROVEN')
          check(actual)
          return actual.scope
        },checkOwned,withSourceBoundary:(scope,work)=>{
          const actual=tokens.get(scope.owner)
          if(!actual)fail('OPENING_VARIANT_OWNER_UNPROVEN')
          check(actual)
          return work()
        }}
      replay='host' in selected?selected.host.createReplay(bindings):createRoleplayMvuSchemaReplay({
        ...bindings,compiler:selected.compiler,runner:selected.runner,executorVersion:4})
      drivers.set(selected.implementationKey,replay)
    }
    owner.driver=replay
    return replay
  }
  function sourceCut(owner:Owner,requestSha256:string):SourceNativeCutFacts {
    check(owner)
    const native=events(owner.session),frame=owner.basis.frame,history=deps.inputState.nativeHistory,
      cut=history?.cut?.<SessionEvent>(owner.session),stop=owner.agent.lookupInputStop()
    if(native.length!==owner.basis.nativeCut)fail('OPENING_VARIANT_NATIVE_CHANGED')
    return {schemaVersion:1,sessionId:owner.session.id,ownerSessionId:owner.session.id,nativeCut:native.length,
      nativePrefixSha256:cut?.prefixSha256(native.length)??recordSha256(native),
      sourceSnapshotSha256:frame.snapshotSha256,materialSha256:frame.materialSha256,
      stopGeneration:'notice' in stop?stop.notice.stopSequence:0,
      anchor:{kind:'manual',operationId:owner.request.operationId,requestSha256,observedNativeSeq:native.length-1}}
  }
  async function phaseInput(owner:Owner,pack:MvuJsonObject,requestSha256:string,seed:string) {
    const cut=sourceCut(owner,requestSha256),ref=owner.basis.scopeReadRef?await owner.basis.scopeReadRef(cut):undefined
    check(owner)
    const input=schemaEmptyPhaseInput(4,'external-pack-replacement',owner.basis.base.values,
      pack.stat_data as MvuJsonObject,packContext(pack),owner.clockEpochMs,seed,
      ref?undefined:owner.basis.scopeReadFrame(cut),
      schemaPhaseErrorPolicyForProgramV4(schemaEpochExecution(owner.basis.ready.epoch).program),ref)
    return {cut,input}
  }
  async function putDonor(owner:Owner) {
    const ready='materialize' in owner.basis.ready?owner.basis.ready.materialize():owner.basis.ready,
      prefix=[...ready.executionBaseline?.materialize()??[],...ready.steps.map(row=>row.step)],
      objects=new Map([...ready.executionBaseline?.scopeObjects??[],...('scopeObjects' in ready.frozen?ready.frozen.scopeObjects:[])]
        .map(row=>[scopeObjectKey(row.ref),row])),scopeObjects=[...objects.values()],
      body={schemaVersion:1 as const,encoding:'native-opening-variant-donor-v1' as const,
        sessionId:owner.session.id,nativeCut:owner.basis.nativeCut,original:owner.basis.original,
        snapshot:owner.basis.base,epoch:ready.epoch,prefix,scopeObjects,
        material:owner.basis.frame.material},
      fact=sealMvuSchemaStoryFact(body,'donorSha256'),
      ref={key:`${owner.session.id}__opening-variant-donor-${fact.donorSha256}`,sha256:recordSha256(fact)}
    check(owner)
    const old=deps.branch.get(ref.key)
    if(old!==undefined&&!same(old,fact))fail('OPENING_VARIANT_DONOR_CONFLICT')
    if(old===undefined)try {await deps.branch.put(ref.key,fact)}catch { /* Exact readback resolves an acknowledgement loss. */ }
    check(owner)
    if(!same(deps.branch.get(ref.key),fact))fail('OPENING_VARIANT_DONOR_WRITE_UNKNOWN')
    return {ref,ready,prefix,scopeObjects:new Set(objects.keys())}
  }
  function boundRunner(owner:Owner,ready:SchemaJournalReady,selected:OwnedMvuSchemaExecutor) {
    const objects=[...ready.executionBaseline?.scopeObjects??[],...('scopeObjects' in ready.frozen?ready.frozen.scopeObjects:[])],
      byAddress=new Map(objects.map(row=>[scopeObjectKey(row.ref),row.object]))
    return selected.runner.bindScopeReferencesV2?.(ref=>byAddress.get(scopeObjectKey(ref))??scopeBindings?.readObject(ref))??selected.runner
  }
  async function prepareCandidate(owner:Owner,index:number,pack:MvuJsonObject,requestSha256:string) {
    const donor=await(owner.donor??=putDonor(owner)),selected=await runtime(owner),
      {cut,input}=await phaseInput(owner,pack,requestSha256,recordSha256({operationId:owner.request.operationId,index})),
      requestedStep=schemaTraceRequestedStep('opening-candidate-'+recordSha256({requestSha256,index}),
        {ownerSessionId:owner.session.id,sourceNativeCutSha256:recordSha256(cut),material:owner.basis.frame.material},input),
      execution=schemaEpochExecution(donor.ready.epoch)
    const fact=await evaluateOpeningVariantContinuation({donorRef:donor.ref,
      donor:{realmEpoch:donor.ready.epoch.realmEpoch,loadFrame:execution.loadFrame,completedPrefix:donor.prefix},
      requestedStep,program:execution.program,runner:boundRunner(owner,donor.ready,selected),
      scopeObjects:input.scopeReadRef?scopeBindings!.captureScopeObjects([input.scopeReadRef]).filter(row=>
        !donor.scopeObjects.has(scopeObjectKey(row.ref))):[]},owner.signal)
    check(owner)
    if(fact.record.output.kind!=='accepted')fail('OPENING_VARIANT_CANDIDATE_REFUSED')
    return fact
  }
  async function makePlan(owner:Owner,setRef:SchemaJournalRef,activeVariantId:string,pack:MvuJsonObject,requestSha256:string) {
    const {cut,input}=await phaseInput(owner,pack,requestSha256,recordSha256({operationId:owner.request.operationId,activeVariantId})),
      ready=owner.basis.ready
    return validateOpeningVariantReplacementPlan(sealMvuSchemaStoryFact({schemaVersion:1 as const,
      encoding:'native-opening-variant-replacement-plan-v1' as const,sessionId:owner.session.id,
      operationId:owner.request.operationId,requestSha256,base:owner.basis.base,currentFrame:owner.basis.frame,
      initialCut:cut,realmEpoch:owner.basis.original.realmEpoch,programSha256:owner.basis.base.root.programSha256,
      epoch:ready.epochRef,serverProgramSha256:schemaEpochExecution(ready.epoch).program.programSha256,
      setRef,activeVariantId,message:readContext(owner).message,input},'planSha256'))
  }
  function association(ready:JournalRead,index:number):SchemaExecutionAssociation {
    const step='materialize' in ready?ready.steps.at(index)!:ready.steps[index]!,epoch=ready.epoch,
      frontier='materialize' in ready?ready.frontierAt(index+1):ready.frontierAt?.(index+1)??schemaJournalFrontierSha256(ready.epochRef,
        ready.steps.slice(0,index+1),ready.executionBaseline?.ref),
      common={sessionId:step.dispatch.sessionId,realmEpoch:epoch.realmEpoch,batchId:step.dispatch.batchId,
        anchor:step.dispatch.sourceNativeCut.anchor,sourceNativeCutSha256:recordSha256(step.dispatch.sourceNativeCut),
        dispatch:step.dispatchRef,completion:step.completionRef,dispatchMarker:step.dispatchMarker,
        completionMarker:step.completionMarker,outputSha256:recordSha256(step.step.output)}
    return epoch.schemaVersion===5?{...common,schemaVersion:5,encoding:'native-author-host-association-v5',
      combinedProgramSha256:epoch.program.combinedProgramSha256,serverProgramSha256:epoch.program.serverProgram!.programSha256,
      epoch:ready.epochRef,serverTailSha256:step.step.stepSha256,hostFrontierSha256:frontier}:
      {...common,schemaVersion:1,encoding:'native-mvu-schema-execution-association-v1',programSha256:epoch.program.programSha256,
        tailSha256:step.step.stepSha256,frontierSha256:frontier}
  }
  async function recoverPhase(owner:Owner,plan:OpeningVariantReplacementPlanV1,ready:JournalRead,index:number) {
    const full='materialize' in ready?ready.materialize():ready,step=full.steps[index]!,
      execution=schemaEpochExecution(full.epoch),prefix=[...full.executionBaseline?.materialize()??[],...full.steps.slice(0,index).map(row=>row.step)],
      selected=await runtime(owner),runner=boundRunner(owner,full,selected),
      trace={schemaVersion:4 as const,realmEpoch:full.epoch.realmEpoch,loadFrame:execution.loadFrame,prefix,
        requestedStep:{eventId:step.step.eventId,frame:step.step.frame}},
      input=execution.loadFrame.scopeReadRef||step.step.frame.input.scopeReadRef
        ?{...trace,encoding:'native-mvu-author-schema-trace-input-v4-scope-ref-v2' as const}
        :{...trace,encoding:'native-mvu-author-schema-trace-input-v4' as const,
          loadFrame:execution.loadFrame as Extract<typeof execution.loadFrame,{encoding?:never}>}
    // Journal owns the effective execution tail. Native cold restoration can
    // append its seed boundary after this already completed phase.
    if(index!==full.steps.length-1
      ||!same(step.step.frame.input,plan.input)||!same(step.dispatch.sourceNativeCut,plan.initialCut)
      ||step.step.output.kind!=='accepted')fail('OPENING_VARIANT_RECOVERY_UNPROVEN')
    const result=await runner.evaluateTrace(execution.program,input,owner.signal)
    check(owner)
    if(result.kind!=='evaluated-trace'||result.evaluation.records.at(-1)?.stepSha256!==step.step.stepSha256)
      fail('OPENING_VARIANT_RECOVERY_UNPROVEN')
    return owner.recovered={phase:'external-pack-replacement',input:plan.input,association:association(full,index),output:step.step.output}
  }
  async function executeActive(owner:Owner,plan:OpeningVariantReplacementPlanV1) {
    check(owner);owner.plan=plan
    const selector=openingVariantReplacementSelector(plan),ready=captureJournal(owner)
    if(ready.kind!=='ready')fail(ready.code)
    const rows=[...ready.steps.range()],
      index=rows.findIndex(row=>row.dispatch.batchId===selector.batchId)
    if(index>=0)return recoverPhase(owner,plan,ready,index)
    const expected=owner.operation?(owner.operation.publicationAbsent?undefined:owner.operation.rawPublication):owner.basis.publication.raw
    if(!same(deps.status.get(owner.basis.publication.key),expected)
      ||events(owner.session).length!==plan.initialCut.nativeCut)fail('OPENING_VARIANT_BASIS_CHANGED')
    const replay=await driver(owner),scope:SchemaOwnedScope={owner:owner.token,incarnation:owner.agent,
      session:owner.session,signal:owner.signal,authorInput:schemaOriginalReplayCompilationInput(owner.basis.original),
      realmEpoch:plan.realmEpoch,loadFrame:schemaEpochExecution(ready.epoch).loadFrame,inheritedCut:owner.basis.inheritedCut,
      sourceNativeCut:plan.initialCut,requestedStep:schemaTraceRequestedStep(selector.batchId,
        {ownerSessionId:owner.session.id,sourceNativeCutSha256:recordSha256(plan.initialCut),material:owner.basis.frame.material},plan.input),
      journalCut:ready,compiledProgram:isAuthorHostJournalReadyV5(ready)?ready.epoch.program:schemaEpochExecution(ready.epoch).program}
    if(owner.basis.inheritedReady)Object.defineProperty(scope,'inheritedReady',{value:owner.basis.inheritedReady})
    Object.defineProperty(scope,'captureJournal',{value:()=>captureJournal(owner)})
    owner.scope=scope
    const result=await replay.execute(selector)
    check(owner)
    if(result.kind!=='completed')fail(result.code)
    if(result.output.kind!=='accepted')fail('OPENING_VARIANT_REPLACEMENT_REFUSED')
    owner.live=result
    return {phase:'external-pack-replacement' as const,input:plan.input,association:result.association,output:result.output}
  }
  async function withPublication<T>(owner:Owner,phase:OpeningVariantReplacementPhaseV1,work:()=>Promise<T>) {
    check(owner)
    if(owner.recovered!==phase) {
      const live=owner.live
      await owner.driver?.closeOwner(owner.token)
      check(owner)
      if(!live||!same(live.association,phase.association)||!owner.driver?.checkEvidence(live.evidence,
        {association:live.association,output:live.output}))fail('OPENING_VARIANT_PUBLICATION_UNPROVEN')
    }
    return work()
  }
  function readContext(owner:Owner) {
    if(owner.context)return owner.context
    const sid=owner.session.id,catalog=deps.catalog(sid),source=catalog.source,identity=owner.basis.original.preparation.identity,
      capture=owner.permission.kind==='reader'?owner.permission.capture:undefined,
      row=capture?.snapshot.messages[0],message:OpeningVariantMessageV1=owner.operation?.message??owner.basis.openingMessage??{
        ownerSessionId:row!.ownerSessionId,nativeSeq:capture!.openingMessage.seq,
        messageId:row!.messageId,messageVersionSha256:row!.messageVersionSha256}
    if(source.importId!==identity.source.importId||message.messageId!==(owner.basis.openingMessage?.messageId??identity.messageId))
      fail('OPENING_VARIANT_OPENING_UNPROVEN')
    const selected=owner.basis.publication.openingVariants,
      currentSet=selected?readSet(sid,selected.setRef):undefined,
      candidates=catalog.candidates.map((candidate,index)=>({index,renderedText:candidate.renderedText,
        renderedSha256:sha256(candidate.renderedText)})),
      activeIndex=selected?currentSet!.entries.find(row=>row.id===selected.activeVariantId)!.index
        :catalog.candidates.findIndex(candidate=>candidate.index===identity.index),
      currentPacks=candidates.map(candidate=>currentSet?.entries.find(row=>row.index===candidate.index)?.pack??
        (candidate.index===activeIndex?{...owner.basis.base.context,schema:'没有用别管这个',stat_data:owner.basis.base.values}:null)),
      activeCandidate=candidates.find(row=>row.index===activeIndex)!
    return owner.context={sid,source,message,candidates,base:owner.basis.base,publication:owner.basis.publication,
      activeVariantId:selected?.activeVariantId??openingVariantId(source,message,activeIndex,activeCandidate.renderedSha256),
      currentSet,currentPacks}
  }
  async function retainActivation(table:Table,key:string,value:unknown,current:()=>void) {
    current()
    const prior=table.get(key)
    if(prior!==undefined&&!same(prior,value))fail('OPENING_VARIANT_ACTIVATION_FACT_CHANGED')
    if(prior===undefined)try {await table.put(key,value)}catch { /* Confirm this immutable address after an ACK loss. */ }
    current()
    if(!same(table.get(key),value))fail('OPENING_VARIANT_ACTIVATION_WRITE_UNKNOWN')
  }
  async function prepareActivation(owner:Owner,operation:OpeningVariantOperationV1,set:OpeningVariantSetV1) {
    check(owner)
    const entry=set.entries.find(row=>row.id===operation.activeVariantId),
      candidate=entry&&readContext(owner).candidates.find(row=>row.index===entry.index)
    if(!entry?.continuation||!entry.pack||!candidate)fail('OPENING_VARIANT_NOT_INITIALIZED')
    const {donor,continuation}=readerFor(owner.session.id).capture(entry.continuation),output=continuation.record.output
    if(donor.original.originalSha256!==owner.basis.original.originalSha256||output.kind!=='accepted'
      ||!same(output.values,entry.pack.stat_data)||!same(output.context,packContext(entry.pack))
      ||candidate.renderedSha256!==entry.renderedSha256)fail('OPENING_VARIANT_CONTINUATION_UNPROVEN')
    if(!deps.modelSelection)fail('OPENING_VARIANT_MODEL_OWNER_UNAVAILABLE')
    const packet=validateOpeningVariantActivationPacket(sealMvuSchemaStoryFact({schemaVersion:1 as const,
      encoding:'native-opening-variant-activation-packet-v1' as const,parentSessionId:owner.session.id,
      operationId:operation.operationId,operationSha256:operation.operationSha256,source:operation.source,
      opening:operation.message,setRef:operation.setRef,activeVariantId:operation.activeVariantId,
      candidateIndex:candidate.index,renderedText:candidate.renderedText,renderedSha256:candidate.renderedSha256,
      continuationRef:entry.continuation,model:deps.modelSelection(owner.session.id)},'packetSha256')),
      key=openingVariantActivationPacketKey(owner.session.id,operation.operationId)
    await retainActivation(deps.branch,key,packet,()=>check(owner))
    return {key,sha256:recordSha256(packet)}
  }
  async function publishActivation(packetRef:SchemaJournalRef,packet:OpeningVariantActivationPacketV1,sid:string,
    native:MvuNativeOpeningReceipt,checkReservation:()=>void):Promise<OpeningVariantActivationSeedV1> {
    const session=deps.session(sid),agent=session&&deps.agent(session)
    if(!session||!agent)fail('OPENING_VARIANT_CHILD_UNAVAILABLE')
    return agent.runMaintenance(async signal=>deps.withSourceLock(sid,async()=>{
      const current=()=>{
        signal.throwIfAborted();checkReservation()
        if(disposed||deps.session(sid)!==session||deps.agent(session)!==agent
          ||session.header.parentSession!==packet.parentSessionId||session.inheritedEventCount!==0)
          fail('OPENING_VARIANT_RESERVATION_CHANGED')
      }
      current()
      const existing=readerFor(sid).readSeed(sid)
      if(existing) {
        if(!same(existing.seed.packetRef,packetRef)||!same(existing.seed.event.native,native))
          fail('OPENING_VARIANT_ACTIVATION_FACT_CHANGED')
        return existing.seed
      }
      const parentReader=readerFor(packet.parentSessionId),graph=parentReader.captureSet(packet.setRef),
        archive=sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-opening-variant-archive-v1' as const,
          sessionId:sid,records:[{ref:packetRef,value:packet},...graph.records]},'archiveSha256')
      await retainActivation(deps.branch,openingVariantArchiveKey(sid),archive,current)
      const {donor,continuation,baseline}=readerFor(sid).capture(packet.continuationRef),output=continuation.record.output
      if(output.kind!=='accepted')fail('OPENING_VARIANT_CONTINUATION_UNPROVEN')
      const original=deps.source.readOpeningVariantOriginal(donor),frame=deps.source.captureFrame(original,sid),
        checkSource=()=>{current();if(!deps.source.frameCurrent(original,frame))fail('OPENING_VARIANT_SOURCE_CHANGED')},
        ready=journal.captureLive(sid,original.realmEpoch,{executionBaseline:baseline})
      if(ready.kind!=='ready')fail(ready.code)
      checkSource()
      const sourceSha256=deps.sourceSha256(sid),frontier={nativeCut:native.turnEndSeq+1,
        tailSha256:schemaJournalServerTailSha256(ready),frontierSha256:schemaJournalHostFrontierSha256(ready)},
        event=sealMvuSchemaStoryFact({schemaVersion:1 as const,encoding:'native-opening-variant-activation-event-v1' as const,
          sessionId:sid,parentSessionId:packet.parentSessionId,operationId:packet.operationId,packetRef,
          continuationRef:packet.continuationRef,sourceSha256,realmEpoch:original.realmEpoch,
          programSha256:donor.snapshot.root.programSha256,
          eventId:recordSha256({sessionId:sid,packetRef,native}),native,values:output.values,
          valuesSha256:recordSha256(output.values),context:output.context,frontier},'eventSha256'),
        head:MvuSchemaOpeningActivationHeadV1={schemaVersion:1,encoding:'native-opening-variant-activation-head-v1',
          sessionId:sid,sourceSha256,revision:1,eventId:event.eventId,eventSha256:event.eventSha256,
          planSha256:packet.packetSha256,valuesSha256:event.valuesSha256},
        {derived:_derived,activation:_activation,...origin}=donor.snapshot.root,
        root={...origin,activation:{schemaVersion:1 as const,encoding:'native-opening-variant-activation-root-v1' as const,
          sessionId:sid,eventId:event.eventId,eventSha256:event.eventSha256,headSha256:recordSha256(head),
          packetSha256:packet.packetSha256}},
        snapshot=validateMvuSchemaNumericalSnapshot(sealMvuSchemaStoryFact({schemaVersion:2 as const,
          encoding:'native-mvu-schema-state-snapshot-v2' as const,sessionId:sid,sourceSha256,root,currentHead:head,
          revision:1,headSha256:recordSha256(head),values:output.values,valuesSha256:event.valuesSha256,
          context:output.context,schemaFrontier:frontier},'stateSnapshotSha256')),
        seed=validateOpeningVariantActivationSeed(sealMvuSchemaStoryFact({schemaVersion:1 as const,
          encoding:'native-opening-variant-activation-seed-v1' as const,sessionId:sid,parentSessionId:packet.parentSessionId,
          operationId:packet.operationId,packetRef,event,head,snapshot},'seedSha256')),
        prior=publication.read(sid)
      await retainActivation(deps.status,openingVariantActivationEventKey(sid),event,checkSource)
      const published=await publication.replaceVariants(prior,{setRef:packet.setRef,activeVariantId:packet.activeVariantId},head)
      if(published.kind!=='acknowledged')fail('OPENING_VARIANT_ACTIVATION_PUBLICATION_'+published.kind.toUpperCase())
      checkSource()
      await retainActivation(deps.branch,openingVariantActivationSeedKey(sid),seed,checkSource)
      return seed
    }))
  }
  const bank=createRoleplayOpeningVariants({branch:deps.branch,status:deps.status,publication,
    ...(deps.activatePrepared?{activatePrepared:async(handoff:OpeningVariantActivationHandoff,authority:object)=>{
      const permission=permissions.get(authority),sid=handoff.operation.sessionId
      if(!permission)fail('OPENING_VARIANT_PERMISSION_REVOKED')
      const authorizeParent=()=>deps.withSourceLock(sid,async()=>{
        const session=deps.session(sid)
        if(disposed||!session||!deps.active(session)||!deps.agent(session)
          ||permission.kind==='reader'&&!permission.capture.sourceCurrent())fail('OPENING_VARIANT_PERMISSION_REVOKED')
        permission.signal?.throwIfAborted()
        const basis=deps.story.captureOpeningVariantBasis(sid,handoff.operation.nativeCut)
        basis.current()
        const expected=handoff.operation.publicationAbsent?undefined:handoff.operation.rawPublication
        if(events(session).length!==handoff.operation.nativeCut
          ||basis.base.stateSnapshotSha256!==handoff.operation.base.stateSnapshotSha256
          ||!same(deps.status.get(handoff.operation.publicationKey),expected))fail('OPENING_VARIANT_BASIS_CHANGED')
      })
      return deps.activatePrepared!(handoff,authorizeParent)
    }}:{}),
    async withTransaction(sid,request,operation,authority,work) {
      const permission=permissions.get(authority),session=deps.session(sid)
      if(!permission||!session||!deps.active(session))fail('OPENING_VARIANT_PERMISSION_REVOKED')
      if(!operation)await deps.story.preflight(sid,permission.signal)
      const agent=deps.agent(session)
      if(!agent)fail('OPENING_VARIANT_SESSION_INACTIVE')
      return agent.runMaintenance(async signal=>deps.withSourceLock(sid,async()=>{
        const basis=deps.story.captureOpeningVariantBasis(sid,operation?.nativeCut),owner:Owner={
          token:Object.freeze({}),session,agent,basis,request,operation,permission,
          signal:permission.signal?AbortSignal.any([signal,permission.signal]):signal,
          stopSha256:recordSha256(agent.lookupInputStop()),clockEpochMs:Date.now(),inSource:true}
        owners.set(sid,owner);tokens.set(owner.token,owner)
        try {
          check(owner)
          if(permission.kind==='reader'&&!operation) {
            const snapshot=permission.capture.snapshot,first=snapshot.messages[0],origin=permission.capture.openingMessage
            if(snapshot.readRevision!==request.readRevision||snapshot.numerical.kind!=='schema-ready'
              ||snapshot.numerical.expected.stateSnapshotSha256!==basis.base.stateSnapshotSha256
              ||!first||first.messageId!==origin.messageId||first.messageVersionSha256!==origin.messageVersionSha256
              ||snapshot.messages.length!==1)fail('OPENING_VARIANT_READ_BASIS_CHANGED')
          }
          const context:OpeningVariantTransactionContext={...readContext(owner),nativeCut:basis.nativeCut,
            check:()=>check(owner),prepareCandidate:(index,pack,sha)=>prepareCandidate(owner,index,pack,sha),
            makePlan:(ref,id,pack,sha)=>makePlan(owner,ref,id,pack,sha),executeActive:plan=>executeActive(owner,plan),
            ...(deps.activatePrepared?{prepareActivation:(operation:OpeningVariantOperationV1,set:OpeningVariantSetV1)=>
              prepareActivation(owner,operation,set)}:{}),
            withPublication:(phase,action)=>withPublication(owner,phase,action),adopt:phase=>{
              check(owner)
              deps.story.adoptPublishedPlayer(sid,ready=>schemaJournalServerTailSha256(ready)
                ===('serverTailSha256' in phase.association?phase.association.serverTailSha256:phase.association.tailSha256)
                &&schemaJournalHostFrontierSha256(ready)
                ===('hostFrontierSha256' in phase.association?phase.association.hostFrontierSha256:phase.association.frontierSha256))
            }}
          return await work(context)
        }finally {
          try {await owner.driver?.closeOwner(owner.token)}finally {
            owner.inSource=false;owners.delete(sid);tokens.delete(owner.token)
          }
        }
      }))
    }})
  async function mutate(capture:AuthorOpeningVariantCaptureV1,request:OpeningVariantMutationRequestV1,signal?:AbortSignal) {
    const authority=Object.freeze({})
    permissions.set(authority,{kind:'reader',capture,signal})
    try {return await bank.mutate(capture.binding.sessionId,request,authority)}finally {permissions.delete(authority)}
  }
  async function retry(sid:string,operationId:string,signal?:AbortSignal):Promise<OpeningVariantMutationResult> {
    const authority=Object.freeze({})
    permissions.set(authority,{kind:'retry',signal})
    try {return await bank.retry(sid,operationId,authority)}finally {permissions.delete(authority)}
  }
  function readPacks(sid:string,initial:{readonly swipes:readonly string[];readonly swipe_id:number},variables:MvuJsonObject) {
    const selected=publication.read(sid).openingVariants
    if(!selected)return {swipes_data:initial.swipes.map((_text,index)=>index===initial.swipe_id
      ?{...variables,schema:'没有用别管这个'}:null),swipe_id:initial.swipe_id}
    const set=readSet(sid,selected.setRef)
    return {swipes_data:initial.swipes.map((_text,index)=>set.entries.find(entry=>entry.index===index)?.pack??null),
      swipe_id:set.entries.find(entry=>entry.id===selected.activeVariantId)!.index}
  }
  function readAddresses(sid:string,message:OpeningVariantMessageV1,selectedIndex:number) {
    const catalog=deps.catalog(sid),selected=publication.read(sid).openingVariants,
      set=selected?readSet(sid,selected.setRef):undefined,
      variant_ids=catalog.candidates.map((candidate,index)=>set?.entries.find(entry=>entry.index===index)?.id
        ??openingVariantId(catalog.source,message,index,sha256(candidate.renderedText)))
    const activeIndex=selected?set!.entries.find(entry=>entry.id===selected.activeVariantId)!.index
      :catalog.candidates.findIndex(candidate=>candidate.index===selectedIndex)
    return {variant_ids,activeVariantId:selected?.activeVariantId??variant_ids[activeIndex]!,swipe_id:activeIndex}
  }
  return {mutate,retry,confirm:bank.confirm,pendingCode:bank.pendingCode,readPacks,readAddresses,publishActivation,
    dispose(){disposed=true;releaseLifetime();for(const replay of drivers.values())replay.dispose();drivers.clear();readers.clear();journal.dispose()}}
}
