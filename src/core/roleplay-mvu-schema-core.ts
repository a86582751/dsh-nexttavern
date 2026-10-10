/** Actual schema-opening execution and publication owner. Persisted records
 * describe an attempt; they cannot recreate this private Native/Source lease. */
import {recordSha256} from './roleplay-data.js'
import {pinnedCSchemaImportBindingsV1,pinnedCSchemaImportBindingsV2} from './tavern-mvu-schema-import-policy.js'
import {pinnedCSchemaImportBindingsV4,pinnedNativeStateLoaderImportBindingsV4,validateSchemaProgramV4,
  deriveOwnedStateLoaderIdentityV4,schemaPhaseErrorPolicyForProgramV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaProgramV4} from './tavern-mvu-schema-program-v4.js'
import {validateSchemaGuestOutputForProgramV4} from './tavern-mvu-schema-runner-v4.js'
import {openingIntentKey} from './roleplay-opening-selection.js'
import type {OpeningSelectionDeps} from './roleplay-opening-selection.js'
import {mvuInitializationEventKey,mvuInitializationHeadKey} from './roleplay-mvu-initialization.js'
import {compileSchemaMvuInitData} from './tavern-mvu-initvar.js'
import {createRoleplayMvuSchemaAssetOwner} from './roleplay-mvu-schema-assets.js'
import {createRoleplayAuthorHostAssetOwner} from './roleplay-author-host-assets.js'
import type {ProtectedAuthorHostRuntimeV5} from './roleplay-author-host-assets.js'
import {createRoleplayMvuSchemaJournal,freezeSchemaJournalData,schemaEpochExecution,schemaEpochAuthorIdentity,
  schemaJournalServerTailSha256,schemaJournalHostFrontierSha256} from './roleplay-mvu-schema-journal.js'
import {createRoleplayMvuSchemaReplay,schemaExecutionProgramSha256,schemaExecutionServerTailSha256,
  schemaExecutionHostFrontierSha256} from './roleplay-mvu-schema-replay.js'
import {deriveAuthorHostOpeningExecutionV5,deriveAuthorHostOpeningExecutionV6,sealMvuSchemaOpeningFact,validateMvuSchemaOpeningPreparation,
  validateMvuSchemaOpeningPlan,validateMvuSchemaOpeningIntent,verifyMvuSchemaOpeningFacts}
  from './roleplay-mvu-schema-opening-types.js'
import type {Session,SessionEvent} from '@deepseek-ai/dsh-session'
import type {NativeInputAdmissionAgentV2} from '@deepseek-ai/dsh-agent-loop'
import type {mvuSchemaMarkers} from 'dsh-nexttavern-session-format/mvu-schema-marker'
import {schemaEmptyPhaseInput,schemaTraceRequestedStep,schemaRealmLoadFrame} from './roleplay-mvu-schema-executor-types.js'
import {buildSchemaScopeReadFrame,schemaScopeSource,schemaScopeInitialChat,schemaScopeVisibleMessages}
  from './roleplay-mvu-schema-scope-facts.js'
import type {WorldlineMessageEdits} from './roleplay-worldline-types.js'
import type {OwnedMvuSchemaExecutor,SchemaExecutorIdentityTuple,SchemaAuthorCompilationInput,SchemaAuthorProgram}
  from './roleplay-mvu-schema-executor-types.js'
import type {createRoleplayMvuSource,MvuSchemaAuthorSource} from './roleplay-mvu-source.js'
import type {MvuNativeOpeningReceipt,MvuOpeningIdentity} from './roleplay-mvu-initialization.js'
import type {SchemaCapturedScope,SchemaHostInitializationFrames,SchemaBoundary,HistoricalCutSelector,SchemaExecutionSelector,
  SchemaReplayDeps}
  from './roleplay-mvu-schema-replay.js'
import type {AuthorHostIdentityV5,AuthorServerExecutorV4,AuthorHostAssociationV5} from './roleplay-author-host-types-v5.js'
import type {CombinedAuthorProgram} from './tavern-author-combined-types.mjs'
import type {MvuSchemaGuestOutputV4,MvuSchemaRealmLoadFrameV4} from './tavern-mvu-schema-types-v4.js'
import {combinedCompilationInputForProgram} from './tavern-author-combined-data.mjs'
import type {SchemaJournalTable,SourceNativeCutFacts,SchemaJournalReady,SchemaJournalRecordOwner}
  from './roleplay-mvu-schema-journal.js'
import {captureSchemaCompilationResourcesV6} from './roleplay-mvu-schema-source.js'
import type {MvuSchemaOpeningPreparation,SchemaOpeningRequest,SchemaOpeningExecutionLive,
  OpeningIntentV5,MvuSchemaOpeningEventV2,MvuSchemaOpeningHeadV2,SchemaOpeningPublicationBoundary}
  from './roleplay-mvu-schema-opening-types.js'

interface ReadTable {get(key:string):unknown;entries():Iterable<[string,unknown]>}
export interface MvuSchemaCoreDeps {
  branch:ReadTable
  status:SchemaJournalTable
  recordOwner?:SchemaJournalRecordOwner
  source:ReturnType<typeof createRoleplayMvuSource>
  session(sid:string):Session|undefined
  agent(session:Session):NativeInputAdmissionAgentV2|undefined
  resolveAgent(sid:string):Promise<NativeInputAdmissionAgentV2|undefined>
  active(session:Session):boolean
  withSourceLock<T>(sid:string,action:()=>Promise<T>):Promise<T>
  flush(session:Session):Promise<boolean>
  markers:typeof mvuSchemaMarkers
  projectPrefix:WorldlineMessageEdits['projectPrefix']
  nativeRead(identity:MvuOpeningIdentity,turn:number):{status:'committed';receipt:MvuNativeOpeningReceipt}|{status:'unknown'}
}
interface OwnedOpening {
  token:object
  preparation:MvuSchemaOpeningPreparation
  author:MvuSchemaAuthorSource
  session:Session
  agent:NativeInputAdmissionAgentV2
  stopSha256:string
  abort:AbortController
  inSource:boolean
  scope?:SchemaCapturedScope
  selector?:SchemaExecutionSelector
  initialData?:Extract<ReturnType<typeof compileSchemaMvuInitData>,{kind:'parsed'}>
  compiledProgram?:SchemaAuthorProgram|CombinedAuthorProgram
  replay?:ReturnType<typeof createRoleplayMvuSchemaReplay>
  live?:SchemaOpeningExecutionLive
  revoked:boolean
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'SCHEMA_OPENING_EXECUTION_UNKNOWN'
function fail(code:string):never {throw Error(code)}
function hasAuthorHost(runtime:OwnedMvuSchemaExecutor|ProtectedAuthorHostRuntimeV5):runtime is ProtectedAuthorHostRuntimeV5 {
  return 'host' in runtime
}

export function createRoleplayMvuSchemaCore(deps:MvuSchemaCoreDeps) {
  const assets=createRoleplayMvuSchemaAssetOwner()
  const authorAssets=createRoleplayAuthorHostAssetOwner({serverAssets:assets})
  const owners=new Map<string,OwnedOpening>(),scopes=new WeakMap<object,OwnedOpening>()
  const liveOwners=new WeakMap<object,OwnedOpening>(),sourceLeases=new Map<string,OwnedOpening>()
  let disposed=false
  const replays=new Map<string,ReturnType<typeof createRoleplayMvuSchemaReplay>>()
  const sourceCurrent=(preparation:MvuSchemaOpeningPreparation)=>!disposed
    &&deps.source.schemaOpeningSourceCurrent(preparation)
  const events=(session:Session)=>session.snapshotEvents()
  function retained(preparation:MvuSchemaOpeningPreparation):OpeningIntentV5 {
    const raw=deps.branch.get(openingIntentKey(preparation.identity.sessionId,preparation.identity.source.importId))
    const intent=validateMvuSchemaOpeningIntent(raw as OpeningIntentV5)
    if(!same(intent.preparation,preparation))fail('SCHEMA_OPENING_PREPARATION_CHANGED')
    return intent
  }
  function authorFor(preparation:MvuSchemaOpeningPreparation):MvuSchemaAuthorSource {
    if(!sourceCurrent(preparation))fail('SCHEMA_SOURCE_CHANGED')
    const found=deps.source.readAuthorSource(preparation.identity.sessionId,preparation.identity.index)
    if(found.kind!=='author-source'||found.source.authorSourceSha256!==preparation.authorSourceSha256
      ||!same(found.source.snapshot,preparation.sourceSnapshot))fail('SCHEMA_SOURCE_CHANGED')
    return found.source
  }
  function inputFor(author:MvuSchemaAuthorSource,runtime:OwnedMvuSchemaExecutor):SchemaAuthorCompilationInput {
    // Fresh compilation binds fixed C aliases to its own versioned bridge.
    // Historical paths use epoch.program imports; unknown/computed imports
    // still receive the compiler's explicit refusal.
    const bindings=runtime.libraries.map(library=>({specifier:library.kind,kind:library.kind,
      implementationSha256:library.bundleSha256}))
    const historicalCBindings=runtime.executorVersion===3?pinnedCSchemaImportBindingsV2(runtime.bridge)
      :runtime.executorVersion===2?pinnedCSchemaImportBindingsV1(runtime.bridge):[]
    const cBindings=runtime.executorVersion===4?pinnedCSchemaImportBindingsV4(runtime.bridge):historicalCBindings
    const nativeBindings=runtime.executorVersion===4?pinnedNativeStateLoaderImportBindingsV4(runtime.bridge):[]
    const imports=[...bindings,...cBindings,...nativeBindings,{
      specifier:'schema-bridge',kind:'schema-bridge' as const,
      implementationSha256:runtime.bridge.implementationSha256,
    }]
    const source={
        ownerSessionId:author.snapshot.source.sessionId,
        importId:author.snapshot.source.importId,sourceSha256:author.snapshot.source.rawSha256,
        importRecordSha256:author.snapshot.importRecordSha256,sourceSnapshotSha256:author.snapshot.snapshotSha256,
        material:author.material,materialSha256:author.materialSha256,
      }
    const scripts=author.scripts.map(script=>({...script,imports:[...imports]}))
    if(runtime.executorVersion===4) {
      const stateLoader=deriveOwnedStateLoaderIdentityV4(runtime.bridge)
      if(!runtime.stateLoader||!same(runtime.stateLoader,stateLoader))fail('SCHEMA_RUNTIME_STATE_LOADER_CHANGED')
      return {schemaVersion:2,encoding:'native-mvu-author-compilation-input-v2',source,scripts,
        libraries:runtime.libraries,bridge:runtime.bridge,stateLoader,executionPlan:null}
    }
    // This branch contains only original dependency kinds. Keeping a separate
    // map prevents a v4 mapper binding from widening the old compilation wire.
    return {schemaVersion:1,source,libraries:runtime.libraries,bridge:runtime.bridge,
      scripts:author.scripts.map(script=>({...script,imports:[...bindings,...historicalCBindings,
        {specifier:'schema-bridge',kind:'schema-bridge' as const,implementationSha256:runtime.bridge.implementationSha256}]}))}
  }
  function numericalRowsAllowed(owner:Pick<OwnedOpening,'session'|'preparation'>,
    boundary?:SchemaOpeningPublicationBoundary):boolean {
    const sid=owner.session.id,proposedEvent=boundary?.event,proposedHead=boundary?.head
    for(const [key,row] of deps.status.entries()) {
      if(!key.startsWith(`${sid}__mvu-`))continue
      if(proposedEvent&&key===mvuInitializationEventKey(sid,proposedEvent.eventId)&&same(row,proposedEvent))continue
      if(proposedHead&&key===mvuInitializationHeadKey(sid)&&same(row,proposedHead))continue
      const fact=row as {sessionId?:unknown;realmEpoch?:unknown}
      if(!key.startsWith(`${sid}__mvu-schema-`)||fact?.sessionId!==sid
        ||fact.realmEpoch!==owner.preparation.realmEpoch)return false
    }
    return true
  }
  function originalBasis(owner:Pick<OwnedOpening,'session'|'preparation'>):boolean {
    const proof=owner.preparation.freshNativeBasisProof,session=owner.session,all=events(session)
    return deps.active(session)&&deps.session(session.id)===session&&session.inheritedEventCount===0
      &&!session.header.parentSession&&recordSha256(deps.branch.get(proof.branch.metaKey))===proof.branch.metaSha256
      &&all.every((event,index)=>event.seq===index)
      &&same(proof.numerical,{headKey:mvuInitializationHeadKey(session.id),headExists:false,
        eventMembershipSha256:recordSha256([]),eventCount:0,opaqueStateExists:false})
      &&recordSha256(all.slice(0,proof.native.observedThroughSeq+1))===proof.native.historyVersionSha256
  }
  function ownerCurrent(owner:OwnedOpening):boolean {
    return !disposed&&!owner.revoked&&!owner.abort.signal.aborted&&owners.get(owner.session.id)===owner
      &&deps.session(owner.session.id)===owner.session&&deps.agent(owner.session)===owner.agent
      &&owner.agent.session===owner.session&&sourceCurrent(owner.preparation)&&originalBasis(owner)
      &&recordSha256(owner.agent.lookupInputStop())===owner.stopSha256
  }
  function markerAt(all:readonly SessionEvent[],ref:{seq:number;sha256:string}|null):boolean {
    return ref!==null&&!!all[ref.seq]&&recordSha256(all[ref.seq])===ref.sha256
  }
  function checkOwned(scope:SchemaCapturedScope,boundary:SchemaBoundary):boolean {
    try {
      const owner=scopes.get(scope.owner)
      if(!owner||!ownerCurrent(owner)||scope.incarnation!==owner.agent||scope.session!==owner.session
        ||scope.signal.aborted||!same(scope.sourceNativeCut.anchor,owner.preparation.selector.anchor))return false
      const phaseIndex=owner.preparation.schemaVersion===6
        ?owner.preparation.phaseSelectors.findIndex(item=>same(item.selector,owner.selector)):0
      if(phaseIndex<0||scope.sourceNativeCut.nativeCut!==owner.preparation.freshNativeBasisProof.native.observedThroughSeq+1
        +phaseIndex*2)return false
      const all=events(owner.session),cut=scope.sourceNativeCut.nativeCut
      if(boundary.dispatchMarker&&(boundary.dispatchMarker.seq!==cut||!markerAt(all,boundary.dispatchMarker)))return false
      if(boundary.completionMarker&&(boundary.completionMarker.seq!==cut+1||!markerAt(all,boundary.completionMarker)))return false
      if(boundary.stage==='publication') {
        if(!owner.inSource||sourceLeases.get(owner.session.id)!==owner)return false
        const intent=retained(owner.preparation)
        if(!intent.initialization||!['native-committed','completed'].includes(intent.status)||intent.committedTurn===undefined)return false
        const native=deps.nativeRead(intent.initialization.identity,intent.committedTurn)
        if(native.status!=='committed'||native.receipt.turnStartSeq!==cut+2||all.length!==native.receipt.turnEndSeq+1)return false
        // Native reader proves the original operation/message and exact closed
        // programmatic step. Its start immediately follows the final phase pair.
        return !!boundary.dispatchMarker&&!!boundary.completionMarker
      }
      const count=boundary.completionMarker?2:boundary.dispatchMarker?1:0
      return all.length===cut+count&&numericalRowsAllowed(owner)
        &&(boundary.stage==='returned'||owner.inSource&&sourceLeases.get(owner.session.id)===owner)
    } catch {return false}
  }
  async function withLease<T>(owner:OwnedOpening,action:()=>Promise<T>):Promise<T> {
    if(!ownerCurrent(owner))fail('SCHEMA_PERMISSION_REVOKED')
    // Only this private owner knows the currently held Source lease. A
    // persisted descriptor or caller flag cannot skip the real lock.
    if(sourceLeases.get(owner.session.id)===owner&&owner.inSource)return action()
    return deps.withSourceLock(owner.session.id,async()=>{
      if(!ownerCurrent(owner))fail('SCHEMA_PERMISSION_REVOKED')
      owner.inSource=true;sourceLeases.set(owner.session.id,owner)
      try {return await action()}
      finally {owner.inSource=false;if(sourceLeases.get(owner.session.id)===owner)sourceLeases.delete(owner.session.id)}
    })
  }
  function captureOwned(selector:SchemaExecutionSelector):SchemaCapturedScope {
    const owner=owners.get(selector.sessionId)
    if(!owner?.scope||!owner.inSource||!same(owner.selector??owner.preparation.selector,selector)||!ownerCurrent(owner)) {
      fail('SCHEMA_OWNER_UNPROVEN')
    }
    // Initialization constructs new DATA; this producer captures it before
    // the compiler awaits. Story/player producers reuse their Source snapshots.
    const scope=owner.scope,journal=createRoleplayMvuSchemaJournal({table:deps.status,markers:deps.markers,
      recordOwner:deps.recordOwner})
    const inheritedReady=scope.inheritedReady,inheritedCut=inheritedReady?scope.inheritedCut:
      scope.inheritedCut===null?null:freezeSchemaJournalData(scope.inheritedCut)
    // Capture the detached legacy cut once before closing over it. Checked
    // producer DATA already owns its immutable cut; neither path keeps a live
    // alias to an unparsed caller's mutable inherited record.
    const captureJournal=scope.captureJournal??(()=>inheritedReady
      ?journal.captureChecked(owner.session.id,scope.realmEpoch,events(owner.session),inheritedReady)
      :journal.capture(owner.session.id,scope.realmEpoch,events(owner.session),inheritedCut))
    const journalCut=captureJournal()
    if(journalCut.kind==='blocked')fail(journalCut.code)
    // The current producer folds this exact Native cut once. Replay consumes
    // its DATA under the existing private owner and Source lease.
    const data={sourceNativeCut:freezeSchemaJournalData(scope.sourceNativeCut),
      inheritedCut,journalCut,
      compiledProgram:owner.compiledProgram,
      ...scope.authorInput.schemaVersion===6&&!owner.compiledProgram
        ?{compilationResources:captureSchemaCompilationResourcesV6(owner.author)}:{}}
    const captured:SchemaCapturedScope=scope.loadFrame===undefined?{...scope,...data,
      authorInput:freezeSchemaJournalData(scope.authorInput),loadFrame:undefined,requestedStep:undefined}:
      {...scope,...data,authorInput:freezeSchemaJournalData(scope.authorInput),loadFrame:freezeSchemaJournalData(scope.loadFrame),
        requestedStep:freezeSchemaJournalData(scope.requestedStep)}
    // These process-only associations belong to the actual producer. A spread
    // copies JSON DATA, so preserve them explicitly without putting them in it.
    if(scope.inheritedReady)Object.defineProperty(captured,'inheritedReady',{value:scope.inheritedReady})
    Object.defineProperty(captured,'captureJournal',{value:captureJournal})
    owner.scope=captured
    return captured
  }
  function completeHostFrames(scope:SchemaCapturedScope,program:CombinedAuthorProgram):SchemaHostInitializationFrames {
    const owner=scopes.get(scope.owner),server=program.serverProgram
    if(!owner?.initialData||![5,6].includes(owner.preparation.schemaVersion)||owner.scope?.loadFrame!==undefined
      ||!server||!owner.inSource||sourceLeases.get(owner.session.id)!==owner)fail('SCHEMA_OWNER_UNPROVEN')
    const preparation=owner.preparation,parsed=owner.initialData,cut=scope.sourceNativeCut
    const binding={ownerSessionId:owner.session.id,sourceNativeCutSha256:recordSha256(cut),material:owner.author.material}
    const readSource=schemaScopeSource(preparation.sourceSnapshot)
    const readFrame=buildSchemaScopeReadFrame(readSource,binding.sourceNativeCutSha256,server.scripts,
      schemaScopeInitialChat(preparation,owner.author.material,cut),
      schemaScopeVisibleMessages(events(owner.session),deps.projectPrefix,readSource,()=>owner.session.id,new Map()))
    const frames:SchemaHostInitializationFrames={loadFrame:{schemaVersion:4,...binding,values:parsed.values,
      context:parsed.context,clockEpochMs:preparation.clockEpochMs,randomSeed:preparation.randomSeed,scopeReadFrame:readFrame},
      requestedStep:{eventId:preparation.selector.batchId,frame:{...binding,input:{schemaVersion:4,
        encoding:'native-mvu-author-schema-phase-input-v4',commandsEncoding:'native-mvu-update-operations-v2',
        errorPolicy:schemaPhaseErrorPolicyForProgramV4(server),phase:'initialization',base:null,
        values:parsed.values,commands:[],context:parsed.context,
        clockEpochMs:preparation.clockEpochMs,randomSeed:preparation.randomSeed,scopeReadFrame:readFrame}}}}
    // Publication retains this same private owner and its actual completed frames.
    const capturedFrames=freezeSchemaJournalData(frames)
    owner.scope={...scope,...capturedFrames}
    if(scope.inheritedReady)Object.defineProperty(owner.scope,'inheritedReady',{value:scope.inheritedReady})
    if(scope.captureJournal)Object.defineProperty(owner.scope,'captureJournal',{value:scope.captureJournal})
    return capturedFrames
  }
  async function captureHistoricalCut(selector:HistoricalCutSelector) {
    const session=deps.session(selector.sessionId)
    if(!session||!deps.active(session))fail('SCHEMA_SESSION_INACTIVE')
    const raw=[...deps.branch.entries()].find(([key,value])=>key.startsWith(`${session.id}__opening-choice-`)
      &&(value as OpeningIntentV5)?.schemaVersion===5&&(value as OpeningIntentV5).preparation?.realmEpoch===selector.realmEpoch)?.[1]
    const intent=validateMvuSchemaOpeningIntent(raw as OpeningIntentV5),plan=intent.initialization
    if(intent.status!=='completed'||!plan||selector.nativeCut!==plan.execution.completionMarker.seq+1)fail('SCHEMA_OPENING_NOT_COMPLETED')
    const author=authorFor(intent.preparation),all=events(session)
    const journal=createRoleplayMvuSchemaJournal({table:deps.status,markers:deps.markers,recordOwner:deps.recordOwner})
    const cut=journal.capture(session.id,selector.realmEpoch,all.slice(0,selector.nativeCut))
    if(cut.kind!=='ready')fail(cut.code)
    const program=schemaEpochExecution(cut.epoch).program
    const completeSource=cut.epoch.schemaVersion===5?cut.epoch.program.original.source:program.source
    if(!same(completeSource.material,author.material))fail('SCHEMA_ORIGINAL_SOURCE_CHANGED')
    if(cut.epoch.schemaVersion===5) {
      return {authorInput:combinedCompilationInputForProgram(cut.epoch.program),
        ...cut.epoch.program.schemaVersion===6
          ?{compilationResources:captureSchemaCompilationResourcesV6(author)}:{},
        ready:cut,frozen:cut.frozen,events:all}
    }
    let authorInput:SchemaAuthorCompilationInput
    if(program.schemaVersion===2) {
      const actual=validateSchemaProgramV4(program)
      authorInput={schemaVersion:2,encoding:'native-mvu-author-compilation-input-v2',
        source:actual.source,libraries:actual.libraries,bridge:actual.bridge,stateLoader:actual.stateLoader,
        executionPlan:actual.executionPlan,
        scripts:actual.scripts.map(({javascript:_js,javascriptSha256:_hash,...script})=>script)}
    }else authorInput={schemaVersion:1,source:program.source,libraries:program.libraries,bridge:program.bridge,
      scripts:program.scripts.map(({javascript:_js,javascriptSha256:_hash,...script})=>script)}
    return {authorInput,ready:cut,frozen:cut.frozen,events:all}
  }
  async function engine(preparation:MvuSchemaOpeningPreparation,tuple?:SchemaExecutorIdentityTuple) {
    if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
    if(!deps.markers)fail('SCHEMA_NATIVE_MARKER_UNAVAILABLE')
    const runtime:OwnedMvuSchemaExecutor|ProtectedAuthorHostRuntimeV5=preparation.schemaVersion===5||preparation.schemaVersion===6?tuple
      ?await authorAssets.getForVerifiedHost(preparation.host,tuple as AuthorServerExecutorV4)
      :await authorAssets.getDefault():tuple?await assets.getForVerifiedEpoch(tuple):preparation.schemaVersion!==1
        ?await assets.getForVerifiedEpoch(preparation.executor):await assets.getHistoricalV1()
    if((preparation.schemaVersion===5||preparation.schemaVersion===6)&&(!hasAuthorHost(runtime)||!same(runtime.host.identity,preparation.host))) {
      fail('AUTHOR_HOST_IMPLEMENTATION_CHANGED')
    }
    if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
    let replay=replays.get(runtime.implementationKey)
    if(!replay) {
      const bindings:Omit<SchemaReplayDeps,'compiler'|'runner'|'executorVersion'|'hostV5'>={
        table:deps.status,recordOwner:deps.recordOwner,markers:deps.markers,
        captureOwned,checkOwned,completeHostFrames,withSourceBoundary:(scope,action)=>{
        const owner=scopes.get(scope.owner);if(!owner)fail('SCHEMA_OWNER_UNPROVEN');return withLease(owner,action)
      },flush:deps.flush,captureHistoricalCut}
      replay=hasAuthorHost(runtime)?runtime.host.createReplay(bindings):createRoleplayMvuSchemaReplay({...bindings,
        compiler:runtime.compiler,runner:runtime.runner,executorVersion:runtime.executorVersion})
      replays.set(runtime.implementationKey,replay)
    }
    return {runtime,replay}
  }
  async function prepare(request:SchemaOpeningRequest) {
    try {
      const captured=deps.source.readSchemaOpeningSource(request)
      if(captured.kind!=='schema-opening-source')fail(captured.kind==='unsupported'
        ?captured.diagnostics[0]?.code??'SCHEMA_SOURCE_INVALID':'SCHEMA_SOURCE_ABSENT')
      const parsed=compileSchemaMvuInitData(captured.source.initSource)
      if(parsed.kind!=='parsed')fail(parsed.diagnostics[0]?.code??'SCHEMA_INITIAL_DATA_INVALID')
      const runtime=await authorAssets.getDefault(),source=captured.source
      const original=inputFor(source.authorSource,runtime)
      if(original.schemaVersion!==2)fail('AUTHOR_HOST_SERVER_ABI_UNSUPPORTED')
      const execution=source.initSource.schemaVersion===2
        ?deriveAuthorHostOpeningExecutionV6(request.identity,runtime.host.identity)
        :deriveAuthorHostOpeningExecutionV5(request.identity,runtime.host.identity)
      const version=source.initSource.schemaVersion===2
        ?{schemaVersion:6 as const,encoding:'native-author-opening-preparation-v6' as const}
        :{schemaVersion:5 as const,encoding:'native-author-opening-preparation-v5' as const}
      const preparation=validateMvuSchemaOpeningPreparation(sealMvuSchemaOpeningFact({...version,host:runtime.host.identity,
        compilation:runtime.browser.runtime.version===3
          ?{schemaVersion:6,encoding:'native-author-combined-compilation-input-v6',original,
            sourceRecordSessionId:source.authorSource.snapshot.source.sourceRecordSessionId}
          :runtime.browser.runtime.version===2
          ?{schemaVersion:5,encoding:'native-author-combined-compilation-input-v5',original,
            sourceRecordSessionId:source.authorSource.snapshot.source.sourceRecordSessionId}
          :{schemaVersion:4,encoding:'native-author-combined-compilation-input-v4',original,
            sourceRecordSessionId:source.authorSource.snapshot.source.sourceRecordSessionId},identity:request.identity,
        authorSourceSha256:source.authorSource.authorSourceSha256,sourceSnapshot:source.authorSource.snapshot,
        initSource:source.initSource,freshNativeBasisProof:source.freshNativeBasisProof,...execution,
        clockEpochMs:Date.now(),randomSeed:execution.realmEpoch},'preparationSha256') as MvuSchemaOpeningPreparation)
      return {kind:'prepared' as const,preparation}
    } catch(error) {return {kind:'blocked' as const,code:codeOf(error)}}
  }
  async function executeInitialization(preparationInput:MvuSchemaOpeningPreparation) {
    let owner:OwnedOpening|undefined,live:SchemaOpeningExecutionLive|undefined
    try {
      const preparation=validateMvuSchemaOpeningPreparation(preparationInput),sid=preparation.identity.sessionId
      if(retained(preparation).status!=='preparing'||owners.has(sid))fail('SCHEMA_OPENING_PREPARATION_CHANGED')
      // Agent resolution and its maintenance reservation happen outside the
      // selection lock. Programmatic opening later takes its own reservation.
      const agent=await deps.resolveAgent(sid),session=deps.session(sid)
      if(!agent||!session||agent.session!==session||deps.agent(session)!==agent||!deps.active(session))fail('SCHEMA_OWNER_UNPROVEN')
      const stop=agent.lookupInputStop()
      if(agent.status!=='idle'||agent.inbox.nextStep.length||agent.inbox.nextTurn.length
        ||!['none','settled'].includes(agent.lookupInputCompletion().status)
        ||!['none','acknowledged'].includes(stop.status))fail('SCHEMA_NATIVE_BUSY')
      owner={token:Object.freeze({}),preparation,author:authorFor(preparation),session,agent,
        stopSha256:recordSha256(stop),abort:new AbortController(),inSource:false,revoked:false}
      owners.set(sid,owner);scopes.set(owner.token,owner)
      const admitted=owner
      return await agent.runMaintenance(signal=>withLease(admitted,async()=>{
        if(retained(preparation).status!=='preparing')fail('SCHEMA_OPENING_PREPARATION_CHANGED')
        const all=events(session),cut=preparation.freshNativeBasisProof.native.observedThroughSeq+1
        if(all.length!==cut||!originalBasis(admitted)||!numericalRowsAllowed(admitted))fail('SCHEMA_FRESH_BASIS_CHANGED')
        const {runtime,replay:driver}=await engine(preparation),parsed=compileSchemaMvuInitData(preparation.initSource)
        if(parsed.kind!=='parsed')fail('SCHEMA_INITIAL_DATA_INVALID')
        const sourceNativeCut:SourceNativeCutFacts={schemaVersion:1,sessionId:sid,ownerSessionId:sid,nativeCut:cut,
          nativePrefixSha256:recordSha256(all),sourceSnapshotSha256:preparation.sourceSnapshot.snapshotSha256,
          materialSha256:admitted.author.materialSha256,stopGeneration:'notice' in stop?stop.notice.stopSequence:0,
          anchor:preparation.selector.anchor}
        const binding={ownerSessionId:sid,sourceNativeCutSha256:recordSha256(sourceNativeCut),material:admitted.author.material}
        const capturedScope={owner:admitted.token,incarnation:agent,session,
          signal:AbortSignal.any([signal,admitted.abort.signal]),realmEpoch:preparation.realmEpoch,
          inheritedCut:null,sourceNativeCut}
        if(preparation.schemaVersion===5||preparation.schemaVersion===6) {
          admitted.initialData=parsed
          admitted.scope={...capturedScope,authorInput:preparation.compilation}
        }else {
          const authorInput=inputFor(admitted.author,runtime),readSource=schemaScopeSource(preparation.sourceSnapshot)
          const scopeReadFrame=runtime.executorVersion>=3?buildSchemaScopeReadFrame(readSource,binding.sourceNativeCutSha256,
            authorInput.scripts,schemaScopeInitialChat(preparation,admitted.author.material,sourceNativeCut),
            schemaScopeVisibleMessages(all,deps.projectPrefix,readSource,()=>sid,new Map())):undefined
          admitted.scope={...capturedScope,authorInput,
            loadFrame:schemaRealmLoadFrame(runtime.executorVersion,binding,parsed.values,parsed.context,
              preparation.clockEpochMs,preparation.randomSeed,scopeReadFrame),
            requestedStep:schemaTraceRequestedStep(preparation.selector.batchId,binding,schemaEmptyPhaseInput(runtime.executorVersion,
              'initialization',null,parsed.values,parsed.context,preparation.clockEpochMs,preparation.randomSeed,scopeReadFrame))}
        }
        admitted.replay=driver
        admitted.selector=preparation.selector
        let result=await driver.execute(preparation.selector)
        if(result.kind!=='completed')return {kind:result.kind,code:result.code}
        admitted.compiledProgram=result.compiledProgram
        if(result.output.kind!=='accepted')return {kind:'blocked' as const,code:'SCHEMA_INITIALIZATION_REFUSED'}
        const phases:{phase:'initialization'|'command-parsed'|'commands-parsed'|'update-ended';execution:AuthorHostAssociationV5}[]=[]
        if(preparation.schemaVersion===6) {
          if(!hasAuthorHost(runtime)||result.association.schemaVersion!==5||!parsed.openingUpdate)fail('SCHEMA_INITIAL_DATA_INVALID')
          phases.push({phase:'initialization',execution:result.association})
          const base=result.output.values
          const firstReady=createRoleplayMvuSchemaJournal({table:deps.status,markers:deps.markers,recordOwner:deps.recordOwner})
            .capture(sid,preparation.realmEpoch,events(session))
          if(firstReady.kind!=='ready')fail('SCHEMA_JOURNAL_UNPROVEN')
          const serverProgram=schemaEpochExecution(firstReady.epoch).program as MvuSchemaProgramV4
          const serverScripts=serverProgram.scripts
          for(const selected of preparation.phaseSelectors.slice(1)) {
            if(result.kind!=='completed'||result.output.kind!=='accepted')fail('SCHEMA_OPENING_UPDATE_REFUSED')
            const previousScope:SchemaCapturedScope=admitted.scope!
            if(!previousScope.loadFrame)fail('SCHEMA_OWNER_UNPROVEN')
            const currentEvents=events(session)
            const currentCut:SourceNativeCutFacts={...sourceNativeCut,nativeCut:currentEvents.length,
              nativePrefixSha256:recordSha256(currentEvents),anchor:selected.selector.anchor}
            const currentBinding={ownerSessionId:sid,sourceNativeCutSha256:recordSha256(currentCut),material:admitted.author.material}
            const readSource=schemaScopeSource(preparation.sourceSnapshot)
            const load=previousScope.loadFrame as MvuSchemaRealmLoadFrameV4
            const readFrame=buildSchemaScopeReadFrame(readSource,currentBinding.sourceNativeCutSha256,serverScripts,
              load.scopeReadFrame.scopes.chat,
              schemaScopeVisibleMessages(currentEvents,deps.projectPrefix,readSource,()=>sid,new Map()))
            const previousOutput=result.output as Extract<MvuSchemaGuestOutputV4,{kind:'accepted'}>
            const commands=selected.phase==='command-parsed'?parsed.openingUpdate.operations:previousOutput.commands
            admitted.selector=selected.selector
            admitted.scope={...previousScope,sourceNativeCut:currentCut,requestedStep:{eventId:selected.selector.batchId,
              frame:{...currentBinding,input:{schemaVersion:4,encoding:'native-mvu-author-schema-phase-input-v4',
                commandsEncoding:'native-mvu-update-operations-v2',
                errorPolicy:schemaPhaseErrorPolicyForProgramV4(serverProgram),phase:selected.phase,
                base,values:result.output.values,commands,context:result.output.context,
                clockEpochMs:preparation.clockEpochMs,randomSeed:preparation.randomSeed,scopeReadFrame:readFrame}}}}
            if(previousScope.inheritedReady)Object.defineProperty(admitted.scope,'inheritedReady',{value:previousScope.inheritedReady})
            if(previousScope.captureJournal)Object.defineProperty(admitted.scope,'captureJournal',{value:previousScope.captureJournal})
            result=await driver.execute(selected.selector)
            if(result.kind!=='completed')return {kind:result.kind,code:result.code}
            admitted.compiledProgram=result.compiledProgram
            if(result.output.kind!=='accepted')return {kind:'blocked' as const,code:'SCHEMA_OPENING_UPDATE_REFUSED'}
            if(result.association.schemaVersion!==5)fail('SCHEMA_JOURNAL_UNPROVEN')
            phases.push({phase:selected.phase,execution:result.association})
          }
        }
        if(runtime.executorVersion===4) {
          // Use the actual completed epoch. A returned count or fulfilled import
          // cannot independently authorize a state-only opening publication.
          const journal=createRoleplayMvuSchemaJournal({table:deps.status,markers:deps.markers,recordOwner:deps.recordOwner})
          const ready=journal.capture(sid,preparation.realmEpoch,events(session))
          const actual=ready.kind==='ready'?ready.steps.at(-1):undefined
          const execution=ready.kind==='ready'?schemaEpochExecution(ready.epoch):undefined
          if(ready.kind!=='ready'||execution?.program.schemaVersion!==2||!actual
            ||actual.step.frame.input.schemaVersion!==4
            ||schemaEpochAuthorIdentity(ready.epoch).programSha256!==schemaExecutionProgramSha256(result.association)
            ||!same(actual.step.output,result.output))fail('SCHEMA_JOURNAL_UNPROVEN')
          validateSchemaGuestOutputForProgramV4(result.output,execution.program,actual.step.frame.input)
        }
        const version=preparation.schemaVersion===6&&hasAuthorHost(runtime)?{schemaVersion:8 as const,
          encoding:'mvu-programmatic-opening-plan-v8' as const,host:preparation.host,server:runtime.host.server,phases}
          :preparation.schemaVersion===5&&hasAuthorHost(runtime)?{schemaVersion:7 as const,
          encoding:'mvu-programmatic-opening-plan-v7' as const,host:preparation.host,server:runtime.host.server}
          :preparation.schemaVersion===4?{schemaVersion:6 as const,encoding:'mvu-programmatic-opening-plan-v6' as const,
          executor:preparation.executor}:preparation.schemaVersion===3?{schemaVersion:5 as const,encoding:'mvu-programmatic-opening-plan-v5' as const,
          executor:preparation.executor}:preparation.schemaVersion===2?{schemaVersion:4 as const,encoding:'mvu-programmatic-opening-plan-v4' as const,
          executor:preparation.executor}:{schemaVersion:3 as const,encoding:'mvu-programmatic-opening-plan-v3' as const}
        const body={...version,
          identity:preparation.identity,selectedSwipeIdentity:preparation.initSource.selectedSwipeIdentity,
          authorSourceSha256:preparation.authorSourceSha256,sourceSnapshot:preparation.sourceSnapshot,
          initSource:preparation.initSource,initialValuesSha256:parsed.valuesSha256,
          freshNativeBasisProof:preparation.freshNativeBasisProof,execution:result.association,
          values:result.output.values,valuesSha256:recordSha256(result.output.values)}
        const plan=validateMvuSchemaOpeningPlan(sealMvuSchemaOpeningFact(body,'planSha256'))
        live={kind:'prepared',plan,evidence:result.evidence,association:result.association,output:result.output}
        admitted.live=live
        liveOwners.set(live,admitted)
        return live
      }))
    } catch(error) {return {kind:'unavailable' as const,code:codeOf(error)}}
    finally {if(owner&&!live)releaseOwner(owner)}
  }
  function releaseOwner(owner:OwnedOpening):void {
    delete owner.live
    owner.revoked=true;owner.abort.abort();owner.replay?.invalidateOwner(owner.token)
    if(owners.get(owner.session.id)===owner)owners.delete(owner.session.id)
  }
  function releaseExecution(live:SchemaOpeningExecutionLive):void {
    const owner=liveOwners.get(live);if(owner)releaseOwner(owner);liveOwners.delete(live)
  }
  function checkBeforeOpening(live:SchemaOpeningExecutionLive,intent:OpeningIntentV5):boolean {
    try {
      const owner=liveOwners.get(live),scope=owner?.scope
      if(!owner||!scope||!owner.inSource||sourceLeases.get(owner.session.id)!==owner||!ownerCurrent(owner)
        ||intent.status!=='pending'||!same(retained(owner.preparation),intent)||!same(intent.initialization,live.plan)
        ||!same(live.association,live.plan.execution)||live.output.kind!=='accepted'
        ||!same(live.plan.values,live.output.values)||live.plan.initialValuesSha256!==compileInitialValuesSha(owner.preparation)
        ||owner.agent.status!=='idle'||owner.agent.inbox.nextStep.length||owner.agent.inbox.nextTurn.length
        ||!['none','settled'].includes(owner.agent.lookupInputCompletion().status))return false
      // The retained private execution and its exact Native pair must still be
      // the whole tail. This check runs inside Source immediately before the
      // programmatic SDK takes its own maintenance reservation; no nested one.
      if(!checkOwned(scope,{stage:'returned',dispatchMarker:live.association.dispatchMarker,
        completionMarker:live.association.completionMarker}))return false
      const journal=createRoleplayMvuSchemaJournal({table:deps.status,markers:deps.markers,recordOwner:deps.recordOwner})
      const ready=journal.capture(owner.session.id,owner.preparation.realmEpoch,events(owner.session))
      return ready.kind==='ready'&&readyAssociation(ready,live.plan,owner.initialData)
        &&recordSha256(live.output)===live.association.outputSha256
    } catch {return false}
  }
  function openingAgent(request:Parameters<OpeningSelectionDeps['appendOpening']>[0]) {
    const owner=owners.get(request.sessionId),live=owner?.live
    if(!owner||!live)fail('SCHEMA_OWNER_UNPROVEN')
    const intent=retained(owner.preparation)
    if(request.operationId!==intent.operationId||request.messageId!==intent.messageId
      ||request.text!==intent.renderedText||!same(request.source,intent.source)||!checkBeforeOpening(live,intent)) {
      fail('SCHEMA_OPENING_PREAPPEND_UNPROVEN')
    }
    // Core uses this actual incarnation synchronously. Resolving the session
    // again after the guard could select a replacement Agent across an await.
    return owner.agent
  }
  function checkPublication(live:SchemaOpeningExecutionLive,boundary:SchemaOpeningPublicationBoundary):boolean {
    try {
      const owner=liveOwners.get(live)
      if(!owner||!owner.inSource||!ownerCurrent(owner)||live.output.kind!=='accepted'
        ||!same(boundary.intent.initialization,live.plan)||!same(retained(owner.preparation),boundary.intent)
        ||live.plan.initialValuesSha256!==compileInitialValuesSha(owner.preparation)
        ||!same(live.plan.values,live.output.values)||!numericalRowsAllowed(owner,boundary))return false
      return !!owner.replay?.checkEvidence(live.evidence,{association:live.association,output:live.output})
    } catch {return false}
  }
  function compileInitialValuesSha(preparation:MvuSchemaOpeningPreparation):string {
    const parsed=compileSchemaMvuInitData(preparation.initSource)
    if(parsed.kind!=='parsed')fail('SCHEMA_INITIAL_DATA_INVALID')
    return parsed.valuesSha256
  }
  async function withPublicationBoundary<T>(live:SchemaOpeningExecutionLive,action:()=>Promise<T>):Promise<T> {
    const owner=liveOwners.get(live);if(!owner)fail('SCHEMA_OWNER_UNPROVEN')
    return withLease(owner,action)
  }
  function readyAssociation(ready:SchemaJournalReady,plan:SchemaOpeningExecutionLive['plan'],
    initial?:OwnedOpening['initialData']):boolean {
    const facts=ready.steps.at(-1),association=plan.execution
    const execution=schemaEpochExecution(ready.epoch)
    if(execution.program.schemaVersion===2) {
      if(!facts||facts.step.frame.input.schemaVersion!==4)return false
      validateSchemaGuestOutputForProgramV4(facts.step.output,execution.program,facts.step.frame.input)
    }
    if(association.schemaVersion===5&&(ready.epoch.schemaVersion!==5
      ||!same(ready.epochRef,association.epoch)||execution.program.programSha256!==association.serverProgramSha256))return false
    if(plan.schemaVersion===8) {
      if(ready.steps.length!==4||!initial?.openingUpdate)return false
      const first=ready.steps[0]!,base=first.step.output.kind==='accepted'?first.step.output.values:null
      for(const [index,phase] of plan.phases.entries()) {
        const step=ready.steps[index]!,input=step.step.frame.input,actual=phase.execution
        const previous=ready.steps[index-1]?.step.output
        if(input.schemaVersion!==4||input.phase!==phase.phase||step.step.output.kind!=='accepted'
          ||!same(step.dispatchRef,actual.dispatch)||!same(step.completionRef,actual.completion)
          ||!same(step.dispatchMarker,actual.dispatchMarker)||!same(step.completionMarker,actual.completionMarker)
          ||step.dispatch.batchId!==actual.batchId||step.step.eventId!==actual.batchId
          ||recordSha256(step.dispatch.sourceNativeCut)!==actual.sourceNativeCutSha256
          ||step.dispatch.sourceNativeCut.sourceSnapshotSha256!==plan.sourceSnapshot.snapshotSha256
          ||step.dispatch.sourceNativeCut.materialSha256!==execution.program.source.materialSha256
          ||!same(step.step.frame.material,execution.program.source.material)
          ||!same(step.dispatch.sourceNativeCut.anchor,actual.anchor)||recordSha256(step.step.output)!==actual.outputSha256
          ||input.clockEpochMs!==first.step.frame.input.clockEpochMs||input.randomSeed!==first.step.frame.input.randomSeed)return false
        if(index===0) {
          if(input.base!==null||input.commands.length||!same(input.values,initial.values)||!same(input.context,initial.context)
            ||step.dispatch.sourceNativeCut.nativeCut!==plan.freshNativeBasisProof.native.observedThroughSeq+1
            ||step.dispatch.sourceNativeCut.nativePrefixSha256!==plan.freshNativeBasisProof.native.historyVersionSha256)return false
        }else if(!previous||previous.kind!=='accepted'||!same(input.base,base)||!same(input.values,previous.values)
          ||!same(input.context,previous.context)||!same(input.commands,index===1?initial.openingUpdate.operations:previous.commands))return false
      }
      return !!facts&&facts.step.output.kind==='accepted'&&same(facts.step.output.values,plan.values)
        &&schemaEpochAuthorIdentity(ready.epoch).programSha256===schemaExecutionProgramSha256(association)
        &&schemaJournalHostFrontierSha256(ready)===schemaExecutionHostFrontierSha256(association)
        &&schemaJournalServerTailSha256(ready)===schemaExecutionServerTailSha256(association)
    }
    return ready.steps.length===1&&!!facts&&same(facts.dispatchRef,association.dispatch)
      &&same(facts.completionRef,association.completion)&&same(facts.dispatchMarker,association.dispatchMarker)
      &&same(facts.completionMarker,association.completionMarker)&&facts.dispatch.batchId===association.batchId
      &&facts.step.eventId===association.batchId&&facts.step.frame.input.phase==='initialization'
      &&recordSha256(facts.dispatch.sourceNativeCut)===association.sourceNativeCutSha256
      &&facts.dispatch.sourceNativeCut.nativeCut===plan.freshNativeBasisProof.native.observedThroughSeq+1
      &&facts.dispatch.sourceNativeCut.nativePrefixSha256===plan.freshNativeBasisProof.native.historyVersionSha256
      &&facts.dispatch.sourceNativeCut.sourceSnapshotSha256===plan.sourceSnapshot.snapshotSha256
      &&facts.dispatch.sourceNativeCut.materialSha256===execution.program.source.materialSha256
      &&same(facts.dispatch.sourceNativeCut.anchor,association.anchor)
      &&schemaEpochAuthorIdentity(ready.epoch).programSha256===schemaExecutionProgramSha256(association)
      &&schemaJournalHostFrontierSha256(ready)===schemaExecutionHostFrontierSha256(association)
      &&schemaJournalServerTailSha256(ready)===schemaExecutionServerTailSha256(association)
      &&recordSha256(facts.step.output)===association.outputSha256
      &&facts.step.output.kind==='accepted'&&same(facts.step.output.values,plan.values)
      &&recordSha256(facts.step.frame.input.values)===plan.initialValuesSha256
  }
  async function verifyHistorical(intent:OpeningIntentV5,event:MvuSchemaOpeningEventV2,head:MvuSchemaOpeningHeadV2) {
    try {
      if(!verifyMvuSchemaOpeningFacts(intent,event,head)||!sourceCurrent(intent.preparation))fail('SCHEMA_OPENING_RECORD_INVALID')
      const session=deps.session(intent.sessionId),plan=intent.initialization!
      if(!session||!deps.active(session))fail('SCHEMA_SESSION_INACTIVE')
      const incarnation=deps.agent(session),stopSha256=recordSha256(incarnation?.lookupInputStop())
      if(!originalBasis({session,preparation:intent.preparation})
        ||!numericalRowsAllowed({session,preparation:intent.preparation},{intent,event,head,stage:'completed'})) {
        fail('SCHEMA_FRESH_BASIS_CHANGED')
      }
      const before=recordSha256({events:events(session),intent:retained(intent.preparation),event,head})
      const author=authorFor(intent.preparation),parsed=compileSchemaMvuInitData(plan.initSource)
      if(parsed.kind!=='parsed'||parsed.valuesSha256!==plan.initialValuesSha256)fail('SCHEMA_INITIAL_DATA_INVALID')
      const journal=createRoleplayMvuSchemaJournal({table:deps.status,markers:deps.markers,recordOwner:deps.recordOwner})
      const cut=plan.execution.completionMarker.seq+1,ready=journal.capture(session.id,plan.execution.realmEpoch,events(session).slice(0,cut))
      if(ready.kind!=='ready'||!readyAssociation(ready,plan,parsed))fail('SCHEMA_JOURNAL_UNPROVEN')
      const {program,runner,loadFrame:load}=schemaEpochExecution(ready.epoch)
      const tuple=ready.epoch.schemaVersion===5?ready.epoch.server.executor
        :{compiler:program.compiler,bridge:program.bridge,libraries:program.libraries,runner}
      const {replay:driver}=await engine(intent.preparation,tuple)
      const frame=ready.steps[0]!.step.frame
      const loadCut=plan.schemaVersion===8?plan.phases[0].execution.sourceNativeCutSha256:plan.execution.sourceNativeCutSha256
      if(!same(program.source.material,author.material)||!same(load.values,parsed.values)
        ||!same(load.context,parsed.context)||!same(frame.input.values,parsed.values)||!same(frame.input.context,parsed.context)
        ||!same(load.material,author.material)||!same(frame.material,author.material)
        ||load.ownerSessionId!==session.id||frame.ownerSessionId!==session.id
        ||load.sourceNativeCutSha256!==loadCut
        ||frame.sourceNativeCutSha256!==loadCut
        ||load.clockEpochMs!==intent.preparation.clockEpochMs||load.randomSeed!==intent.preparation.randomSeed
        ||frame.input.clockEpochMs!==intent.preparation.clockEpochMs||frame.input.randomSeed!==intent.preparation.randomSeed)fail('SCHEMA_LOAD_SOURCE_MISMATCH')
      const verified=await driver.verifyHistorical({sessionId:session.id,realmEpoch:plan.execution.realmEpoch,nativeCut:cut})
      const actualNative=deps.nativeRead(plan.identity,intent.committedTurn!)
      if(verified.kind!=='verified')return verified
      if(disposed||deps.session(session.id)!==session||!sourceCurrent(intent.preparation)
        ||deps.agent(session)!==incarnation||recordSha256(incarnation?.lookupInputStop())!==stopSha256
        ||before!==recordSha256({events:events(session),intent:retained(intent.preparation),event,head})
        ||!originalBasis({session,preparation:intent.preparation})
        ||!numericalRowsAllowed({session,preparation:intent.preparation},{intent,event,head,stage:'completed'})
        ||actualNative.status!=='committed'||!same(actualNative.receipt,event.native))fail('SCHEMA_HISTORICAL_FACTS_CHANGED')
      // Historical execution grants a read view only. It never restores a hot
      // owner, writes a head, completes an intent or dispatches another event.
      return {kind:'verified' as const}
    } catch(error) {return {kind:'blocked' as const,code:codeOf(error)}}
  }
  return {prepare,executeInitialization,releaseExecution,withPublicationBoundary,checkBeforeOpening,openingAgent,
    checkPublication,sourceCurrent,verifyHistorical,
    /** Shared protected runtime lifecycle for the actual closing-work owner.
     * Access to compiler/runner objects does not grant a publication lease. */
    protectedRuntime:async(tuple?:SchemaExecutorIdentityTuple,host?:AuthorHostIdentityV5):
      Promise<OwnedMvuSchemaExecutor|ProtectedAuthorHostRuntimeV5>=>{
      if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
      if(host) {
        if(!tuple)fail('AUTHOR_HOST_SERVER_IDENTITY_UNAVAILABLE')
        return authorAssets.getForVerifiedHost(host,tuple as AuthorServerExecutorV4)
      }
      return tuple?assets.getForVerifiedEpoch(tuple):assets.getHistoricalV1()
    },
    invalidateAgent(agent:object):void {for(const owner of owners.values())if(owner.agent===agent)releaseOwner(owner)},
    invalidateSession(sid:string):void {const owner=owners.get(sid);if(owner)releaseOwner(owner)},
    async dispose():Promise<void> {
      disposed=true
      for(const owner of owners.values())releaseOwner(owner)
      for(const replay of replays.values())replay.dispose()
      await authorAssets.dispose()
      await assets.dispose()
    },
  }
}
