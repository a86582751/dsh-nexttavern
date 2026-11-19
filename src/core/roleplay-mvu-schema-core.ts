/** Actual schema-opening execution and publication owner. Persisted records
 * describe an attempt; they cannot recreate this private Native/Source lease. */
import {recordSha256} from './roleplay-data.js'
import {pinnedCSchemaImportBindingsV4,pinnedNativeStateLoaderImportBindingsV4,
  deriveOwnedStateLoaderIdentityV4,schemaPhaseErrorPolicyForProgramV4,schemaExecutionViewV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuExecutableProgramV4} from './tavern-mvu-owned-state-types-v1.mjs'
import type {MvuOwnedStateCandidateCompilerV1} from './tavern-mvu-owned-state-types-v1.mjs'
import {validateSchemaGuestOutputForProgramV4} from './tavern-mvu-schema-runner-v4.js'
import {openingIntentKey} from './roleplay-opening-selection.js'
import type {OpeningSelectionDeps} from './roleplay-opening-selection.js'
import {mvuInitializationEventKey,mvuInitializationHeadKey} from './roleplay-mvu-initialization.js'
import {compileSchemaMvuInitData} from './tavern-mvu-initvar.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import {createRoleplayMvuSchemaAssetOwner} from './roleplay-mvu-schema-assets.js'
import {createRoleplayAuthorHostAssetOwner} from './roleplay-author-host-assets.js'
import type {ProtectedAuthorHostRuntimeV5} from './roleplay-author-host-assets.js'
import {createRoleplayMvuSchemaJournal,freezeSchemaJournalData,freezeSchemaJournalCut,schemaEpochExecution,schemaEpochAuthorIdentity,
  schemaNativeCutSha256,
  schemaJournalServerTailSha256,schemaJournalHostFrontierSha256,
  schemaEpochKey,schemaDispatchKey,schemaCompletionKey,schemaUnavailableKey,schemaJournalKey} from './roleplay-mvu-schema-journal.js'
import {schemaExecutionProgramSha256,schemaExecutionServerTailSha256,
  schemaExecutionHostFrontierSha256} from './roleplay-mvu-schema-replay.js'
import type {createRoleplayMvuSchemaReplay} from './roleplay-mvu-schema-replay.js'
import {deriveAuthorHostOpeningExecutionV6,sealMvuSchemaOpeningFact,validateMvuSchemaOpeningPreparation,
  validateMvuSchemaOpeningPlan,validateMvuSchemaOpeningIntent,openingInitializationCut,
  mvuSchemaOpeningEvent,mvuSchemaOpeningHead,validateMvuSchemaOpeningEvent,freezeMvuSchemaOpeningData}
  from './roleplay-mvu-schema-opening-types.js'
import {verifyMvuSchemaInheritedOpeningFacts} from './roleplay-mvu-schema-prefix-facts.js'
import type {Session,SessionEvent} from 'dsh-nexttavern-native-session'
import type {NativeInputAdmissionAgentV2,NativeProgrammaticOpeningAgentV1,NativeOpeningClosingInputV1}
  from 'dsh-nexttavern-native-agent-loop'
import {nativeInputAdmissionCapability,nativeInputSha256} from 'dsh-nexttavern-native-agent-loop'
import type {mvuSchemaMarkers} from 'dsh-nexttavern-session-format/mvu-schema-marker'
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
import type {MvuSchemaRealmLoadFrameV4} from './tavern-mvu-schema-types-v4.js'
import {hasTavernPromptMacroSyntaxV1} from './tavern-prompt-transform-execution.mjs'
import {projectRoleplayMvuMacrosV1} from './roleplay-mvu-macros.js'
import type {MvuScopeReadFrameV1,MvuScopeVariablesV1} from './tavern-mvu-scope-read-types.js'
import type {TavernTemplateScopeBindingV1} from './tavern-template-types.mjs'
import {combinedCompilationInputForProgram} from './tavern-author-combined-data.mjs'
import {createAuthorScriptResourceReaderV1} from './roleplay-author-script-resources.js'
import type {SchemaJournalTable,SchemaJournalRecord,SourceNativeCutFacts,SchemaJournalReady,SchemaJournalRecordOwner,
  SchemaJournalLiveDependencies}
  from './roleplay-mvu-schema-journal.js'
import type {SessionHistoryReader} from './session-history.js'
import type {RoleplayMvuScopeStoreV2} from './roleplay-mvu-scope-store-v2.js'
import type {MvuSchemaOpeningPreparation,SchemaOpeningRequest,SchemaOpeningExecutionLive,
  OpeningIntentV5,MvuSchemaOpeningEventV2,MvuSchemaOpeningHeadV2,SchemaOpeningPublicationBoundary,
  SchemaOpeningBirth,SchemaOpeningNative,SchemaOpeningRootFacts}
  from './roleplay-mvu-schema-opening-types.js'
import type {SchemaGuestOutput} from './roleplay-mvu-schema-executor-types.js'
import {mvuSchemaOpeningPhaseSelector} from './roleplay-mvu-schema-opening-types.js'
import {executeRoleplayMvuBrowserHook} from './roleplay-mvu-browser-hook.js'
import type {MvuBrowserHookFact} from './roleplay-mvu-browser-hook.js'
import type {PrepareAuthorNativeMvuHook,AuthorNativeMvuHookRequest,AuthorNativeMvuOpeningTargetV1}
  from './author-native-mvu-hook-types.js'
import {createAuthorNativeMvuHookGraph} from './author-native-mvu-hook-graph.js'
import {mvuSchemaStoryVariables,mvuSchemaStoryVariableParts} from './roleplay-mvu-schema-story-types.js'
import type {Mvu196HookStage,Mvu196UpdateInputV1} from './tavern-mvu-update-protocol-v1.js'
import {verifyMvuSchemaOpeningExecution,verifyMvuSchemaOpeningInitialization}
  from './roleplay-mvu-schema-opening-execution.js'

export interface GeneratedOpeningActual {
  readonly token:object
  readonly session:Session
  readonly agent:NativeProgrammaticOpeningAgentV1
  readonly signal:AbortSignal
  /** Program's hot lifecycle survives individual material step cancellation. */
  assertCurrent():void
}
export interface GeneratedOpeningHandle {
  readonly preparation:MvuSchemaOpeningPreparation
  readonly initialization:AuthorHostAssociationV5
  readonly values:Extract<SchemaGuestOutput,{kind:'accepted'}>['values']
  readonly context:Extract<SchemaGuestOutput,{kind:'accepted'}>['context']
  readonly frontier:GeneratedOpeningInitialization['frontier']
  readonly browser?:GeneratedOpeningInitialization['browser']
  readonly ownedRows:readonly {readonly table:'status';readonly key:string;readonly value:Readonly<Record<string,unknown>>}[]
}
export interface GeneratedOpeningSource {
  readonly token:object
  readonly input:Omit<MvuSchemaOpeningPreparation,'birth'|'preparationSha256'>
}
export interface GeneratedOpeningInitialization {
  readonly execution:AuthorHostAssociationV5
  readonly values:MvuJsonObject
  readonly context:MvuJsonObject
  readonly frontier:SchemaOpeningExecutionLive['plan']['frontier']
  readonly browser?:SchemaOpeningExecutionLive['plan']['browser']
}
type AcceptedOpeningExecution=Pick<SchemaOpeningExecutionLive,'plan'|'association'|'output'>

interface ReadTable {get(key:string):unknown;entries():Iterable<[string,unknown]>}
interface OpeningStatusTable extends Omit<SchemaJournalTable,'put'> {
  put(key:string,value:SchemaJournalRecord|MvuSchemaOpeningEventV2|MvuSchemaOpeningHeadV2):Promise<unknown>
}
export interface MvuSchemaCoreDeps {
  branch:ReadTable
  status:OpeningStatusTable
  recordOwner?:SchemaJournalRecordOwner
  nativeHistory?:SessionHistoryReader
  live?:SchemaJournalLiveDependencies
  scopeStore?:RoleplayMvuScopeStoreV2
  includeCardStyle?(sid:string):boolean
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
  readProgramOpeningRoot?(sessionId:string,selection?:{realmEpoch?:string;importId?:string}):SchemaOpeningRootFacts|undefined
  awaitBrowserSource?(sid:string,programSha256:string,signal:AbortSignal):Promise<void>
  prepareHook?:PrepareAuthorNativeMvuHook
  readHookInterests?(sid:string):readonly Mvu196HookStage[]
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
  generated?:GeneratedOpeningActual
  generatedHandle?:GeneratedOpeningHandle
  generatedClosing?:NativeOpeningClosingInputV1
  initialization?:{association:AuthorHostAssociationV5;output:Extract<SchemaGuestOutput,{kind:'accepted'}>}
  initialized?:{values:MvuJsonObject;context:MvuJsonObject;frontier:GeneratedOpeningInitialization['frontier']}
  hooks:MvuBrowserHookFact[]
  journalKeys:Set<string>
  phaseAssociations:AuthorHostAssociationV5[]
  workerEvidence?:object
  recoveredUpdate?:AcceptedOpeningExecution
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'SCHEMA_OPENING_EXECUTION_UNKNOWN'
function fail(code:string):never {throw Error(code)}

export function createRoleplayMvuSchemaCore(deps:MvuSchemaCoreDeps) {
  const journal=createRoleplayMvuSchemaJournal({table:deps.status,markers:deps.markers,
    recordOwner:deps.recordOwner,nativeHistory:deps.nativeHistory,live:deps.live})
  const assets=createRoleplayMvuSchemaAssetOwner()
  const authorAssets=createRoleplayAuthorHostAssetOwner({serverAssets:assets})
  const owners=new Map<string,OwnedOpening>(),scopes=new WeakMap<object,OwnedOpening>()
  const liveOwners=new WeakMap<object,OwnedOpening>(),sourceLeases=new Map<string,OwnedOpening>()
  const generatedSources=new WeakMap<object,{identity:MvuOpeningIdentity;author:MvuSchemaAuthorSource;
    input:Omit<MvuSchemaOpeningPreparation,'birth'|'preparationSha256'>}>()
  const generatedOwners=new WeakMap<GeneratedOpeningHandle,OwnedOpening>()
  let disposed=false
  const replays=new Map<string,ReturnType<typeof createRoleplayMvuSchemaReplay>>()
  const trialPrograms=new WeakMap<MvuSchemaAuthorSource,Promise<{
    readonly program:MvuExecutableProgramV4|null;readonly runtime:OwnedMvuSchemaExecutor}>>()
  const browserPrograms=new WeakMap<MvuSchemaAuthorSource,Promise<{
    compiled:CombinedAuthorProgram;resources?:ReturnType<typeof createAuthorScriptResourceReaderV1>}>>()
  const sourceCurrent=(preparation:MvuSchemaOpeningPreparation)=>!disposed
    &&deps.source.schemaOpeningSourceCurrent(preparation)
  const events=(session:Session)=>deps.nativeHistory?.events<SessionEvent>(session)??session.snapshotEvents()
  function selectedOpening(preparation:Pick<MvuSchemaOpeningPreparation,'initSource'>):string {
    return preparation.initSource.swipes.find(swipe=>swipe.identity===preparation.initSource.selectedSwipeIdentity)!.renderedOpening
  }
  function openingMacros(owner:OwnedOpening,message:string,read:MvuScopeReadFrameV1) {
    if(!hasTavernPromptMacroSyntaxV1(message))return
    const captured=deps.source.openingMacroInput(owner.author),preparation=owner.preparation
    if(!captured||!deps.includeCardStyle)fail('SCHEMA_MACRO_CONTEXT_UNAVAILABLE')
    const binding=(scope:TavernTemplateScopeBindingV1['scope'],variables:MvuScopeVariablesV1):TavernTemplateScopeBindingV1|null=>{
      if(variables.kind!=='available')return null
      const owner=variables.provenance.owner
      return {scope,ownerId:`${owner.sessionId}:${owner.importId}:${owner.scope}:${owner.identity}`,
        versionSha256:recordSha256(variables.provenance),values:variables.variables,valuesSha256:variables.variablesSha256}
    },chat=binding('chat',read.scopes.chat),card=binding('card',read.scopes.character),global=binding('global',read.scopes.global),
      scopes=[chat,card,global].filter((value):value is TavernTemplateScopeBindingV1=>value!==null)
    return projectRoleplayMvuMacrosV1(message,{...captured,includeCardStyle:deps.includeCardStyle(owner.session.id),
      inputText:null,scopes,messageVariables:null,clockEpochMs:preparation.clockEpochMs,randomSeed:preparation.randomSeed,
      variableScopes:{chat,character:card,global,message:null,preset:null},outlets:[],declaredOutlets:[]})
  }
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
    const bindings=runtime.libraries.filter(library=>library.kind!=='mvu-196').map(library=>({
      specifier:library.kind as 'zod'|'lodash',kind:library.kind as 'zod'|'lodash',
      implementationSha256:library.bundleSha256}))
    const cBindings=pinnedCSchemaImportBindingsV4(runtime.bridge)
    const nativeBindings=pinnedNativeStateLoaderImportBindingsV4(runtime.bridge)
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
    const stateLoader=deriveOwnedStateLoaderIdentityV4(runtime.bridge)
    if(!runtime.stateLoader||!same(runtime.stateLoader,stateLoader))fail('SCHEMA_RUNTIME_STATE_LOADER_CHANGED')
    return {schemaVersion:2,encoding:'native-mvu-author-compilation-input-v2',source,scripts,
      libraries:runtime.libraries,bridge:runtime.bridge,stateLoader,executionPlan:null}
  }
  async function prepareTrialSource(author:MvuSchemaAuthorSource,signal:AbortSignal) {
    if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
    signal.throwIfAborted()
    let pending=trialPrograms.get(author)
    if(!pending) {
      pending=(async()=>{
        const runtime=await assets.getDefaultForNewRealm(4)
        if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
        const compiler=runtime.compiler as MvuOwnedStateCandidateCompilerV1,
          result=await compiler.partitionCandidates(inputFor(author,runtime),signal)
        if(result.kind!=='partitioned')fail(result.diagnostics[0]?.code??'SCHEMA_TRIAL_SOURCE_UNAVAILABLE')
        return {program:result.serverProgram,runtime}
      })()
      trialPrograms.set(author,pending)
      void pending.catch(()=>{if(trialPrograms.get(author)===pending)trialPrograms.delete(author)})
    }
    const prepared=await pending
    signal.throwIfAborted()
    if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
    return prepared
  }
  function authorCompilation(author:MvuSchemaAuthorSource,runtime:ProtectedAuthorHostRuntimeV5) {
    const original=inputFor(author,runtime)
    if(original.schemaVersion!==2)fail('AUTHOR_HOST_SERVER_ABI_UNSUPPORTED')
    return {schemaVersion:8 as const,encoding:'native-author-combined-compilation-input-v8' as const,original,
      sourceRecordSessionId:author.snapshot.source.sourceRecordSessionId,
      nativeLayout:{realms:original.scripts.map((_,ordinal)=>({realmId:`helper-${ordinal}`,groupId:'author-helper',
        originalOrdinals:[ordinal]})),numericalProfile:'native-mvu-state-v1' as const}}
  }
  async function prepareBrowserSource(sid:string,index:number) {
    const captured=deps.source.readAuthorSource(sid,index)
    if(captured.kind!=='author-source')return undefined
    const author=captured.source
    let pending=browserPrograms.get(author)
    if(!pending) {
      pending=(async()=>{
        const runtime=await authorAssets.getDefault(),compiled=await runtime.host.compiler.compile(authorCompilation(author,runtime))
        if(compiled.kind!=='compiled')fail(compiled.diagnostics[0]?.code??'AUTHOR_BROWSER_SOURCE_UNAVAILABLE')
        const program=compiled.program,rows=program.executionPlan.scripts,
          resources=program.nativeProgram?createAuthorScriptResourceReaderV1({material:author.material,snapshot:author.snapshot,
            snapshotSha256:author.snapshot.snapshotSha256},
            rows.filter(row=>row.disposition==='native'||row.disposition==='disabled-source-retained'),rows):undefined
        return {compiled:program,resources}
      })()
      browserPrograms.set(author,pending)
      void pending.catch(()=>{if(browserPrograms.get(author)===pending)browserPrograms.delete(author)})
    }
    const {compiled,resources}=await pending,program=compiled.nativeProgram
    if(!program?.scripts.some(script=>script.enabled))return undefined
    const current=()=>!disposed&&deps.source.authorSourceCurrent(author)
    if(!current())fail('SCHEMA_SOURCE_CHANGED')
    return {author,program,resources,current}
  }
  function numericalRowsAllowed(owner:Pick<OwnedOpening,'session'|'preparation'|'journalKeys'>,
    boundary?:Pick<SchemaOpeningPublicationBoundary,'event'|'head'>):boolean {
    const sid=owner.session.id,preparation=owner.preparation,proposedEvent=boundary?.event,proposedHead=boundary?.head,
      ownKeys=new Set([...owner.journalKeys,schemaEpochKey(sid,preparation.realmEpoch),...preparation.phaseSelectors.flatMap(({selector})=>[
        schemaDispatchKey(sid,preparation.realmEpoch,selector.batchId),
        schemaCompletionKey(sid,preparation.realmEpoch,selector.batchId),
        schemaUnavailableKey(sid,preparation.realmEpoch,selector.batchId)])])
    for(const [key,row] of deps.status.entries(`${sid}__mvu-`)) {
      if(!key.startsWith(`${sid}__mvu-`))continue
      if(proposedEvent&&key===mvuInitializationEventKey(sid,proposedEvent.eventId)&&same(row,proposedEvent))continue
      if(proposedHead&&key===mvuInitializationHeadKey(sid)&&same(row,proposedHead))continue
      const fact=row as {sessionId?:unknown;realmEpoch?:unknown}
      if(!ownKeys.has(key)||fact?.sessionId!==sid
        ||fact.realmEpoch!==owner.preparation.realmEpoch)return false
    }
    return true
  }
  function originalBasis(owner:Pick<OwnedOpening,'session'|'preparation'>):boolean {
    const birth=owner.preparation.birth,session=owner.session,all=events(session)
    if(birth.kind==='generated') {
      const invocation=all[birth.owner.invocationRef.seq]
      return deps.active(session)&&deps.session(session.id)===session
        &&invocation?.type==='opening/invocation'&&nativeInputSha256(invocation)===birth.owner.invocationRef.sha256
        &&same(invocation.data.identity,birth.owner.identity)&&invocation.data.expectedTurn===birth.turn
    }
    const proof=birth.freshNativeBasisProof
    return deps.active(session)&&deps.session(session.id)===session&&session.inheritedEventCount===0
      &&(session.header.parentSession??null)===proof.branch.parentSessionId
      &&recordSha256(deps.branch.get(proof.branch.metaKey))===proof.branch.metaSha256
      &&all.every((event,index)=>event.seq===index)
      &&same(proof.numerical,{headKey:mvuInitializationHeadKey(session.id),headExists:false,
        eventMembershipSha256:recordSha256([]),eventCount:0,opaqueStateExists:false})
      &&recordSha256(all.slice(0,proof.native.observedThroughSeq+1))===proof.native.historyVersionSha256
  }
  function ownerCurrent(owner:OwnedOpening):boolean {
    if(owner.generated) {
      try {owner.generated.assertCurrent()}catch{return false}
    }
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
      if(!owner.selector||!same(scope.sourceNativeCut.anchor,owner.selector.anchor))return false
      if(same(owner.selector,owner.preparation.selector)
        &&scope.sourceNativeCut.nativeCut!==openingInitializationCut(owner.preparation).nativeCut)return false
      const all=events(owner.session),cut=scope.sourceNativeCut.nativeCut
      if(boundary.dispatchMarker&&(boundary.dispatchMarker.seq!==cut||!markerAt(all,boundary.dispatchMarker)))return false
      if(boundary.completionMarker&&(boundary.completionMarker.seq!==cut+1||!markerAt(all,boundary.completionMarker)))return false
      if(boundary.stage==='publication') {
        if(!owner.inSource||sourceLeases.get(owner.session.id)!==owner)return false
        if(owner.generated) {
          const closing=owner.generatedClosing,plan=owner.live?.plan??owner.recoveredUpdate?.plan
          return !!closing&&!!boundary.dispatchMarker&&!!boundary.completionMarker
            &&!!plan&&all.length===plan.frontier.nativeCut
            &&same(closing.owner,owner.preparation.birth.kind==='generated'?owner.preparation.birth.owner:null)
        }
        const intent=retained(owner.preparation)
        if(!intent.initialization||!['native-committed','completed'].includes(intent.status)||intent.committedTurn===undefined)return false
        const native=deps.nativeRead(intent.initialization.identity,intent.committedTurn)
        if(native.status!=='committed'||native.receipt.turnStartSeq!==intent.initialization.frontier.nativeCut
          ||all.length!==native.receipt.turnEndSeq+1)return false
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
    const scope=owner.scope
    const inheritedCut=scope.inheritedReady?scope.inheritedCut:
      scope.inheritedCut===null?null:freezeSchemaJournalCut(scope.inheritedCut)
    // Capture the detached legacy cut once before closing over it. Checked
    // producer DATA already owns its immutable cut; neither path keeps a live
    // alias to an unparsed caller's mutable inherited record.
    const inheritedReady=scope.inheritedReady??(inheritedCut&&!scope.captureJournal
      ?journal.validateFrozenReady(inheritedCut,events(owner.session).slice(0,inheritedCut.nativeCut)):undefined)
    const captureJournal=scope.captureJournal??(()=>deps.live
      ?journal.captureLive(owner.session.id,scope.realmEpoch,{inherited:inheritedReady??null})
      :journal.captureChecked(owner.session.id,scope.realmEpoch,events(owner.session),inheritedReady??null))
    const journalCut=captureJournal()
    if(journalCut.kind==='blocked')fail(journalCut.code)
    // The current producer folds this exact Native cut once. Replay consumes
    // its DATA under the existing private owner and Source lease.
    const data={sourceNativeCut:freezeSchemaJournalData(scope.sourceNativeCut),liveRun:true as const,
      inheritedCut,journalCut,
      compiledProgram:owner.compiledProgram}
    const captured:SchemaCapturedScope=scope.loadFrame===undefined?{...scope,...data,
      authorInput:freezeSchemaJournalData(scope.authorInput),loadFrame:undefined,requestedStep:undefined}:
      {...scope,...data,authorInput:freezeSchemaJournalData(scope.authorInput),loadFrame:freezeSchemaJournalData(scope.loadFrame),
        requestedStep:freezeSchemaJournalData(scope.requestedStep)}
    // These process-only associations belong to the actual producer. A spread
    // copies JSON DATA, so preserve them explicitly without putting them in it.
    if(inheritedReady)Object.defineProperty(captured,'inheritedReady',{value:inheritedReady})
    Object.defineProperty(captured,'captureJournal',{value:captureJournal})
    owner.scope=captured
    return captured
  }
  function completeHostFrames(scope:SchemaCapturedScope,program:CombinedAuthorProgram):SchemaHostInitializationFrames {
    const owner=scopes.get(scope.owner),server=program.serverProgram
    if(!owner?.initialData||owner.scope?.loadFrame!==undefined
      ||!server||!owner.inSource||sourceLeases.get(owner.session.id)!==owner)fail('SCHEMA_OWNER_UNPROVEN')
    const preparation=owner.preparation,parsed=owner.initialData,cut=scope.sourceNativeCut
    const binding={ownerSessionId:owner.session.id,sourceNativeCutSha256:recordSha256(cut),material:owner.author.material}
    const readSource=schemaScopeSource(preparation.sourceSnapshot)
    const readFrame=buildSchemaScopeReadFrame(readSource,binding.sourceNativeCutSha256,schemaExecutionViewV4(server).scripts,
      schemaScopeInitialChat(preparation,owner.author.material,cut,readSource,parsed),
      schemaScopeVisibleMessages(events(owner.session),deps.projectPrefix,readSource,()=>owner.session.id,new Map()))
    const frames:SchemaHostInitializationFrames={loadFrame:{schemaVersion:4,...binding,values:parsed.values,
      context:parsed.context,clockEpochMs:preparation.clockEpochMs,randomSeed:preparation.randomSeed,scopeReadFrame:readFrame},
      requestedStep:{eventId:preparation.selector.batchId,frame:{...binding,input:{schemaVersion:4,
        encoding:'native-mvu-author-schema-phase-input-v4',
        errorPolicy:schemaPhaseErrorPolicyForProgramV4(server),phase:'initialization',base:null,
        values:parsed.values,context:parsed.context,
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
    const generated=deps.readProgramOpeningRoot?.(session.id,{realmEpoch:selector.realmEpoch}),copy=generated?undefined:
      [...deps.branch.entries()].find(([key,value])=>key.startsWith(`${session.id}__opening-choice-`)
        &&(value as OpeningIntentV5)?.schemaVersion===5&&(value as OpeningIntentV5).preparation?.realmEpoch===selector.realmEpoch)?.[1],
      intent=copy?validateMvuSchemaOpeningIntent(copy as OpeningIntentV5):undefined,
      preparation=generated?.preparation??intent?.preparation,plan=generated?.plan??intent?.initialization
    if(!preparation||!plan||!generated&&intent?.status!=='completed'
      ||selector.nativeCut!==plan.frontier.nativeCut)fail('SCHEMA_OPENING_NOT_COMPLETED')
    const all=events(session)
    const cut=journal.capture(session.id,selector.realmEpoch,all.slice(0,selector.nativeCut),null,true)
    if(cut.kind!=='ready')fail(cut.code)
    if(cut.epoch.schemaVersion!==5)fail('AUTHOR_HOST_IMPLEMENTATION_CHANGED')
    if(!same(combinedCompilationInputForProgram(cut.epoch.program),preparation.compilation)) {
      fail('SCHEMA_ORIGINAL_SOURCE_CHANGED')
    }
    return {authorInput:combinedCompilationInputForProgram(cut.epoch.program),
      ready:cut,frozen:cut.frozen,events:all}
  }
  async function engine(preparation:MvuSchemaOpeningPreparation,tuple?:SchemaExecutorIdentityTuple) {
    if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
    if(!deps.markers)fail('SCHEMA_NATIVE_MARKER_UNAVAILABLE')
    const runtime=tuple?await authorAssets.getForVerifiedHost(preparation.host,tuple as AuthorServerExecutorV4)
      :await authorAssets.getDefault()
    if(!same(runtime.host.identity,preparation.host))fail('AUTHOR_HOST_IMPLEMENTATION_CHANGED')
    if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
    let replay=replays.get(runtime.implementationKey)
    if(!replay) {
      const bindings:Omit<SchemaReplayDeps,'compiler'|'runner'|'executorVersion'|'hostV5'>={
        table:deps.status,recordOwner:deps.recordOwner,nativeHistory:deps.nativeHistory,markers:deps.markers,
        captureOwned,checkOwned,completeHostFrames,withSourceBoundary:(scope,action)=>{
        const owner=scopes.get(scope.owner);if(!owner)fail('SCHEMA_OWNER_UNPROVEN');return withLease(owner,action)
      },flush:deps.flush,captureHistoricalCut}
      replay=runtime.host.createReplay(bindings)
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
      const browser=await prepareBrowserSource(request.identity.sessionId,request.identity.index)
      if(browser) {
        if(!deps.awaitBrowserSource)fail('BROWSER_GENERATION_READER_REQUIRED')
        await deps.awaitBrowserSource(request.identity.sessionId,browser.program.programSha256,new AbortController().signal)
      }
      const runtime=await authorAssets.getDefault(),source=captured.source
      const compilation=authorCompilation(source.authorSource,runtime)
      const execution=deriveAuthorHostOpeningExecutionV6(request.identity,runtime.host.identity)
      // Only new Sources use the default Host's current DATA tag. Recovery
      // retains its recorded input and frozen Host; compiler identity stays V1.
      const preparation=validateMvuSchemaOpeningPreparation(sealMvuSchemaOpeningFact({schemaVersion:7 as const,
        encoding:'native-author-opening-preparation-v7' as const,host:runtime.host.identity,
        compilation,
        identity:request.identity,
        authorSourceSha256:source.authorSource.authorSourceSha256,sourceSnapshot:source.authorSource.snapshot,
        initSource:source.initSource,birth:{kind:'copy',freshNativeBasisProof:source.freshNativeBasisProof},...execution,
        clockEpochMs:Date.now(),randomSeed:execution.realmEpoch},'preparationSha256') as MvuSchemaOpeningPreparation)
      return {kind:'prepared' as const,preparation}
    } catch(error) {return {kind:'blocked' as const,code:codeOf(error)}}
  }
  async function prepareGeneratedSource(request:Pick<MvuOpeningIdentity,'sessionId'|'operationId'|'messageId'>,index:number,
    expected?:GeneratedOpeningSource['input']):Promise<GeneratedOpeningSource|undefined> {
    const captured=deps.source.readSchemaOpeningData(request.sessionId,index)
    if(captured.kind==='absent')return
    if(captured.kind!=='schema-opening-data')fail(captured.diagnostics[0]?.code??'SCHEMA_SOURCE_INVALID')
    const {authorSource:author,initSource}=captured,selected=author.snapshot.selected,
      identity:MvuOpeningIdentity={...request,index,source:author.snapshot.source,sourcePointer:selected.pointer,
        sourceSha256:selected.sourceSha256,renderedSha256:selected.renderedSha256},runtime=await authorAssets.getDefault(),
      original=inputFor(author,runtime),execution=deriveAuthorHostOpeningExecutionV6(identity,runtime.host.identity)
    if(original.schemaVersion!==2)fail('AUTHOR_HOST_SERVER_ABI_UNSUPPORTED')
    const input:Omit<MvuSchemaOpeningPreparation,'birth'|'preparationSha256'>={schemaVersion:7,
        encoding:'native-author-opening-preparation-v7',host:runtime.host.identity,identity,
        authorSourceSha256:author.authorSourceSha256,sourceSnapshot:author.snapshot,initSource,...execution,
        compilation:{schemaVersion:8,encoding:'native-author-combined-compilation-input-v8',original,
          sourceRecordSessionId:author.snapshot.source.sourceRecordSessionId,
          nativeLayout:{realms:original.scripts.map((_,ordinal)=>({realmId:`helper-${ordinal}`,groupId:'author-helper',
            originalOrdinals:[ordinal]})),numericalProfile:'native-mvu-state-v1'}},
        clockEpochMs:expected?.clockEpochMs??Date.now(),randomSeed:expected?.randomSeed??execution.realmEpoch},
      source:GeneratedOpeningSource=Object.freeze({token:Object.freeze({}),input:freezeMvuSchemaOpeningData(input)})
    if(expected&&!same(expected,source.input))fail('SCHEMA_SOURCE_CHANGED')
    generatedSources.set(source.token,{identity,author,input:source.input})
    return source
  }
  async function beginGeneratedOpening(actual:GeneratedOpeningActual,source:GeneratedOpeningSource,
    birth:Extract<SchemaOpeningBirth,{kind:'generated'}>,accepted?:GeneratedOpeningInitialization):Promise<GeneratedOpeningHandle> {
    const captured=generatedSources.get(source.token),session=actual.session,sid=session.id,
      agent=deps.agent(session)
    actual.signal.throwIfAborted();actual.assertCurrent()
    if(!captured||captured.identity.sessionId!==sid||owners.has(sid)||!agent
      ||agent!==nativeInputAdmissionCapability(actual.agent)
      ||deps.session(sid)!==session||!deps.active(session))fail('SCHEMA_OWNER_UNPROVEN')
    if(!accepted) {
      const browser=await prepareBrowserSource(sid,captured.identity.index)
      if(browser) {
        if(!deps.awaitBrowserSource)fail('BROWSER_GENERATION_READER_REQUIRED')
        await deps.awaitBrowserSource(sid,browser.program.programSha256,actual.signal)
        actual.assertCurrent();actual.signal.throwIfAborted()
        if(deps.session(sid)!==session||deps.agent(session)!==agent||owners.has(sid))fail('SCHEMA_OWNER_UNPROVEN')
      }
    }
    const preparation=validateMvuSchemaOpeningPreparation(sealMvuSchemaOpeningFact({...captured.input,birth},'preparationSha256')),
      owner:OwnedOpening={token:Object.freeze({}),session,agent,preparation,author:captured.author,generated:actual,
        stopSha256:recordSha256(agent.lookupInputStop()),abort:new AbortController(),inSource:false,revoked:false,
        hooks:[],journalKeys:new Set(),phaseAssociations:[]}
    owners.set(sid,owner);scopes.set(owner.token,owner)
    try {
      if(accepted)await withLease(owner,()=>restoreGeneratedInitialization(owner,actual.signal,accepted))
      else {
        await withLease(owner,()=>initializeOwned(owner,actual.signal))
        await initializeBrowser(owner,actual.signal)
      }
      const initialization=owner.initialization!,initialized=owner.initialized!
      let browser=accepted?.browser
      if(!accepted&&owner.hooks.length)browser={schemaVersion:1,hooks:[...owner.hooks],finalizedMessage:''}
      const handle:GeneratedOpeningHandle=Object.freeze({preparation,initialization:initialization.association,
        values:initialized.values,context:initialized.context,frontier:initialized.frontier,
        ...browser?{browser}:{},
        ownedRows:ownedJournalRows(owner)})
      owner.generatedHandle=handle;generatedOwners.set(handle,owner)
      return handle
    }catch(error){await releaseOwner(owner);throw error}
  }
  async function finishGeneratedOpening(handle:GeneratedOpeningHandle,actualClosing:NativeOpeningClosingInputV1,
    native:Extract<SchemaOpeningNative,{kind:'generated'}>):Promise<Omit<SchemaOpeningRootFacts,'intent'>> {
    const owner=generatedOwners.get(handle)
    if(!owner||!owner.generated||owner.generatedHandle!==handle||!same(native.receipt,actualClosing.receipt)
      ||!same(actualClosing.owner,handle.preparation.birth.kind==='generated'?handle.preparation.birth.owner:null)) {
      fail('SCHEMA_OWNER_UNPROVEN')
    }
    actualClosing.signal.throwIfAborted();owner.generatedClosing=actualClosing
    const recovered=owner.recoveredUpdate,live=recovered?undefined:
      owner.live??await finishOwned(owner,native.canonical.narrative,actualClosing.signal),completed=live??recovered!
    return withLease(owner,async()=>{
      if(completed.plan.updateMessage!==native.canonical.narrative)fail('SCHEMA_OPENING_UPDATE_CHANGED')
      const event=validateMvuSchemaOpeningEvent(mvuSchemaOpeningEvent(completed.plan,native)),head=mvuSchemaOpeningHead(event),
        eventKey=mvuInitializationEventKey(owner.session.id,event.eventId),headKey=mvuInitializationHeadKey(owner.session.id)
      for(const [key,value] of [[eventKey,event],[headKey,head]] as const) {
        actualClosing.signal.throwIfAborted()
        const current=live?owner.workerEvidence===live.evidence&&!!owner.scope
          &&checkOwned(owner.scope,{stage:'publication',dispatchMarker:live.association.dispatchMarker,
            completionMarker:live.association.completionMarker}):
          recoveredOpeningCurrent(owner,completed)
        if(!ownerCurrent(owner)||!current
          ||!numericalRowsAllowed(owner,{event,head}))fail('SCHEMA_PERMISSION_REVOKED')
        const prior=deps.status.get(key)
        if(prior!==undefined&&!same(prior,value))fail('SCHEMA_OPENING_PUBLICATION_CONFLICT')
        if(prior===undefined) {
          try {await deps.status.put(key,value)}catch(error){if(!same(deps.status.get(key),value))throw error}
        }
        if(!same(deps.status.get(key),value))fail('SCHEMA_OPENING_PUBLICATION_UNCONFIRMED')
      }
      return {preparation:handle.preparation,plan:completed.plan,native,event,head}
    })
  }
  async function releaseGeneratedOpening(handle:GeneratedOpeningHandle):Promise<void> {
    const owner=generatedOwners.get(handle)
    if(owner)await releaseOwner(owner)
  }
  function recoveredOpeningCurrent(owner:OwnedOpening,completed:AcceptedOpeningExecution):boolean {
    return owner.recoveredUpdate===completed&&!!owner.scope
      &&checkOwned(owner.scope,{stage:'publication',dispatchMarker:completed.association.dispatchMarker,
        completionMarker:completed.association.completionMarker})
  }
  function openingAssociation(ready:SchemaJournalReady,index=ready.steps.length-1):AuthorHostAssociationV5 {
    const last=ready.steps[index]
    if(!last||ready.epoch.schemaVersion!==5)fail('SCHEMA_JOURNAL_UNPROVEN')
    return freezeSchemaJournalData({schemaVersion:5,encoding:'native-author-host-association-v5',
      sessionId:ready.epoch.sessionId,realmEpoch:ready.epoch.realmEpoch,batchId:last.dispatch.batchId,
      anchor:last.dispatch.sourceNativeCut.anchor,sourceNativeCutSha256:recordSha256(last.dispatch.sourceNativeCut),
      combinedProgramSha256:schemaEpochAuthorIdentity(ready.epoch).programSha256,
      serverProgramSha256:schemaEpochExecution(ready.epoch).program.programSha256,
      epoch:ready.epochRef,dispatch:last.dispatchRef,completion:last.completionRef,
      dispatchMarker:last.dispatchMarker,completionMarker:last.completionMarker,
      serverTailSha256:last.step.stepSha256,hostFrontierSha256:ready.frontierAt!(index+1),
      outputSha256:recordSha256(last.step.output)})
  }
  async function restoreGeneratedInitialization(owner:OwnedOpening,signal:AbortSignal,
    accepted:GeneratedOpeningInitialization):Promise<void> {
    const {preparation,session,agent}=owner,all=events(session),cut=openingInitializationCut(preparation),
      initial=journal.capture(session.id,preparation.realmEpoch,all.slice(0,accepted.frontier.nativeCut),null,true),
      parsed=compileSchemaMvuInitData(preparation.initSource)
    if(initial.kind!=='ready'||initial.epoch.schemaVersion!==5||initial.steps.length!==1||parsed.kind!=='parsed') {
      fail('SCHEMA_JOURNAL_UNPROVEN')
    }
    const first=initial.steps[0]!,input=first.step.frame.input,association=accepted.execution,
      output=first.step.output,load=initial.epoch.server.loadFrame
    if(output.kind!=='accepted'||input.schemaVersion!==4||input.phase!=='initialization'||input.base!==null
      ||!same(combinedCompilationInputForProgram(initial.epoch.program),preparation.compilation)
      ||!same(first.dispatch.sourceNativeCut.anchor,preparation.selector.anchor)
      ||first.dispatch.sourceNativeCut.nativeCut!==cut.nativeCut
      ||first.dispatch.sourceNativeCut.nativePrefixSha256!==cut.nativePrefixSha256
      ||!same(input.values,parsed.values)||!same(input.context,parsed.context)
      ||!verifyMvuSchemaOpeningInitialization(initial,preparation,accepted)
      ||!same(openingAssociation(initial,0),association)
      ||!same(load.material,owner.author.material)||!same(first.step.frame.material,load.material)
      ||!same(load.values,parsed.values)||!same(load.context,parsed.context)||load.ownerSessionId!==session.id
      ||load.sourceNativeCutSha256!==association.sourceNativeCutSha256
      ||first.step.frame.sourceNativeCutSha256!==load.sourceNativeCutSha256
      ||input.clockEpochMs!==preparation.clockEpochMs||input.randomSeed!==preparation.randomSeed
      ||load.clockEpochMs!==input.clockEpochMs||load.randomSeed!==input.randomSeed)fail('SCHEMA_JOURNAL_UNPROVEN')
    const {replay}=await engine(preparation,initial.epoch.server.executor)
    signal.throwIfAborted()
    if(!ownerCurrent(owner))fail('SCHEMA_PERMISSION_REVOKED')
    owner.initialData=parsed;owner.initialization={association,output};owner.compiledProgram=initial.epoch.program
    owner.initialized={values:accepted.values,context:accepted.context,frontier:accepted.frontier}
    owner.hooks.push(...accepted.browser?.hooks??[]);owner.phaseAssociations.push(association)
    for(const entry of initial.entries??initial.steps) {
      owner.journalKeys.add(entry.dispatchRef.key);owner.journalKeys.add(entry.completionRef.key)
    }
    owner.replay=replay;owner.selector=preparation.selector
    owner.scope={owner:owner.token,incarnation:agent,session,signal:AbortSignal.any([signal,owner.abort.signal]),
      realmEpoch:preparation.realmEpoch,inheritedCut:null,sourceNativeCut:first.dispatch.sourceNativeCut,
      authorInput:preparation.compilation,loadFrame:load,
      requestedStep:{eventId:first.step.eventId,frame:first.step.frame}}
    const ready=openingJournal(owner)
    if(ready.kind!=='ready'||ready.steps.length<1)fail('SCHEMA_JOURNAL_UNPROVEN')
    if(ready.steps.length>1) {
      const last=ready.steps.at(-1)!,output=last.step.output,input=ready.steps[1]!.step.frame.input
      if(output.kind!=='accepted'||input.schemaVersion!==4||input.phase!=='update-core'
        ||output.update?.kind!=='complete'||input.update?.encoding!=='native-mvu-196-update-start-v1') {
        fail('SCHEMA_JOURNAL_UNPROVEN')
      }
      owner.phaseAssociations=ready.steps.map((_,index)=>openingAssociation(ready,index))
      const allEntries=ready.entries??ready.steps
      for(const entry of allEntries) {
        owner.journalKeys.add(entry.dispatchRef.key);owner.journalKeys.add(entry.completionRef.key)
      }
      const browserEntries=allEntries.filter(entry=>'request' in entry.dispatch)
      const acceptedHooks=owner.hooks.length
      for(let index=acceptedHooks;index<browserEntries.length;index++) {
        const pair=browserEntries[index]!
        if(!('request' in pair.dispatch)||!('result' in pair.completion))fail('SCHEMA_JOURNAL_UNPROVEN')
        const entryIndex=allEntries.indexOf(pair)
        owner.hooks.push({schemaVersion:1,request:pair.dispatch.request,result:pair.completion.result,
          journal:pair as import('./roleplay-mvu-schema-journal.js').SchemaJournalBrowserFacts,
          frontier:{nativeCut:pair.completionMarker.seq+1,tailSha256:pair.dispatch.previousTailSha256,
            frontierSha256:ready.entryFrontierAt!(entryIndex+1)}})
      }
      const before=owner.hooks.find(hook=>hook.result.stage==='before-message-update'),
        final=before?.result.stage==='before-message-update'
          ?{...mvuSchemaStoryVariableParts(before.result.output.context.variables),finalizedMessage:before.result.output.context.message_content}
          :{values:output.values,context:output.context,finalizedMessage:input.update.message},
        association=openingAssociation(ready),plan=openingPlan(owner,association,output,input.update.message,ready,final)
      if(!readyAssociation(ready,plan,parsed))fail('SCHEMA_JOURNAL_UNPROVEN')
      owner.recoveredUpdate={association,output,plan};owner.selector=mvuSchemaOpeningPhaseSelector(preparation,ready.steps.length-1)
      owner.scope={...owner.scope,sourceNativeCut:last.dispatch.sourceNativeCut,
        requestedStep:{eventId:last.step.eventId,frame:last.step.frame}}
    }
  }
  async function initializeOwned(owner:OwnedOpening,signal:AbortSignal):Promise<void> {
    const {preparation,session,agent}=owner,sid=session.id,stop=agent.lookupInputStop(),all=events(session),
      cut=openingInitializationCut(preparation)
    if(all.length!==cut.nativeCut||schemaNativeCutSha256(all,all.length,deps.nativeHistory?.prefixes)!==cut.nativePrefixSha256
      ||!originalBasis(owner)||!numericalRowsAllowed(owner))fail('SCHEMA_FRESH_BASIS_CHANGED')
    const preparedBrowser=browserPrograms.get(owner.author)
    if(preparedBrowser) {
      const {compiled}=await preparedBrowser
      if(!same(combinedCompilationInputForProgram(compiled),preparation.compilation))fail('SCHEMA_SOURCE_CHANGED')
      owner.compiledProgram=compiled
    }
    const {replay:driver}=await engine(preparation),parsed=compileSchemaMvuInitData(preparation.initSource)
    if(parsed.kind!=='parsed')fail('SCHEMA_INITIAL_DATA_INVALID')
    owner.initialData=parsed
    const sourceNativeCut:SourceNativeCutFacts={schemaVersion:1,sessionId:sid,ownerSessionId:sid,...cut,
      sourceSnapshotSha256:preparation.sourceSnapshot.snapshotSha256,materialSha256:owner.author.materialSha256,
      stopGeneration:'notice' in stop?stop.notice.stopSequence:0,anchor:preparation.selector.anchor}
    owner.scope={owner:owner.token,incarnation:agent,session,signal:AbortSignal.any([signal,owner.abort.signal]),
      realmEpoch:preparation.realmEpoch,inheritedCut:null,sourceNativeCut,authorInput:preparation.compilation}
    owner.replay=driver;owner.selector=preparation.selector
    const result=await driver.execute(preparation.selector)
    if(result.kind!=='completed')fail(result.code)
    owner.compiledProgram=result.compiledProgram
    if(result.output.kind!=='accepted')fail('SCHEMA_INITIALIZATION_REFUSED')
    if(result.association.schemaVersion!==5)fail('SCHEMA_JOURNAL_UNPROVEN')
    owner.initialization={association:result.association,output:result.output}
    owner.phaseAssociations.push(result.association)
  }
  function openingJournalRead(owner:OwnedOpening) {
    return owner.scope?.captureJournal?.()??(deps.live
      ?journal.captureLive(owner.session.id,owner.preparation.realmEpoch)
      :journal.capture(owner.session.id,owner.preparation.realmEpoch,events(owner.session)))
  }
  function openingJournal(owner:OwnedOpening) {
    const ready=openingJournalRead(owner)
    // Full row exports and persisted opening proofs consume the complete cut.
    // Driver and hook captures retain the journal owner's live frontier.
    return ready.kind==='ready'&&'materialize' in ready?ready.materialize():ready
  }
  function ownedJournalRows(owner:OwnedOpening):GeneratedOpeningHandle['ownedRows'] {
    const ready=openingJournal(owner)
    if(ready.kind!=='ready')fail(ready.code)
    const refs=[ready.epochRef,...(ready.entries??ready.steps).flatMap(step=>[step.dispatchRef,step.completionRef])]
    return refs.map(ref=>{
      const value=deps.status.get(ref.key)
      if(!value||typeof value!=='object'||(value as {recordSha256?:unknown}).recordSha256!==ref.sha256)fail('SCHEMA_JOURNAL_UNPROVEN')
      return {table:'status' as const,key:ref.key,value:value as Readonly<Record<string,unknown>>}
    })
  }
  function openingTarget(owner:OwnedOpening):AuthorNativeMvuOpeningTargetV1 {
    const {identity,initSource}=owner.preparation
    return {kind:'opening',ownerSessionId:owner.session.id,operationId:identity.operationId,messageId:identity.messageId,
      selectedSwipeIdentity:initSource.selectedSwipeIdentity,swipeIndex:identity.index}
  }
  function journalFrontier(ready:SchemaJournalReady):GeneratedOpeningInitialization['frontier'] {
    const last=(ready.entries??ready.steps).at(-1)
    if(!last)fail('SCHEMA_JOURNAL_UNPROVEN')
    return {nativeCut:last.completionMarker.seq+1,tailSha256:schemaJournalServerTailSha256(ready),
      frontierSha256:schemaJournalHostFrontierSha256(ready)}
  }
  async function executeOpeningHook(owner:OwnedOpening,request:AuthorNativeMvuHookRequest,signal:AbortSignal) {
    if(!deps.prepareHook)return undefined
    const ready=openingJournalRead(owner)
    if(ready.kind!=='ready')fail('SCHEMA_JOURNAL_UNPROVEN')
    const cut=owner.scope!.sourceNativeCut
    let acceptedVariables:ReturnType<typeof mvuSchemaStoryVariableParts>|undefined
    const result=await executeRoleplayMvuBrowserHook(request,{
      session:owner.session,realmEpoch:owner.preparation.realmEpoch,
      programSha256:schemaEpochAuthorIdentity(ready.epoch).programSha256,
      signal:AbortSignal.any([signal,owner.abort.signal]),prepareHook:deps.prepareHook,
      check:(code='SCHEMA_PERMISSION_REVOKED')=>{if(!ownerCurrent(owner))fail(code)},
      withSourceBoundary:action=>withLease(owner,action),journal,
      captureReady:()=>openingJournalRead(owner),nativeEvents:()=>events(owner.session),
      sourceNativeCut:actual=>({...cut,nativeCut:actual.length,
        nativePrefixSha256:schemaNativeCutSha256(actual as readonly SessionEvent[],actual.length,deps.nativeHistory?.prefixes)}),
      flush:()=>deps.flush(owner.session),markers:deps.markers,
      admitRecord:record=>{owner.journalKeys.add(schemaJournalKey(record))},
      onCompletion:completed=>{
        if(completed.stage==='before-message-update')acceptedVariables=mvuSchemaStoryVariableParts(completed.output.context.variables)
        if(completed.stage==='initialized') {
          const roots=createAuthorNativeMvuHookGraph().materialize(completed.output.graph)
          acceptedVariables=mvuSchemaStoryVariableParts(roots[0] as MvuJsonObject)
        }
      },
    })
    if(result)owner.hooks.push(result)
    return result?{fact:result,variables:acceptedVariables}:undefined
  }
  async function initializeBrowser(owner:OwnedOpening,signal:AbortSignal):Promise<void> {
    const initialization=owner.initialization
    if(!initialization)fail('SCHEMA_OPENING_SCOPE_UNPROVEN')
    const {output}=initialization,graph=createAuthorNativeMvuHookGraph(),
      target=openingTarget(owner),variables=mvuSchemaStoryVariables(output.values,output.context),
      result=await executeOpeningHook(owner,{sessionId:owner.session.id,planSha256:owner.preparation.preparationSha256,
        target,stage:'initialized',payload:{graph:graph.capture([variables,target.swipeIndex])}},signal)
    const accepted=result?.fact.result.stage==='initialized'
      ?result.variables!
      :{values:output.values,context:output.context},ready=openingJournal(owner)
    if(ready.kind!=='ready')fail('SCHEMA_JOURNAL_UNPROVEN')
    owner.initialized={...accepted,frontier:journalFrontier(ready)}
  }
  async function finishOwned(owner:OwnedOpening,message:string,signal:AbortSignal):Promise<SchemaOpeningExecutionLive> {
    const {preparation,session}=owner,sid=session.id,initialization=owner.initialization,previousScope=owner.scope,
      parsed=owner.initialData,driver=owner.replay,initialized=owner.initialized
    if(!initialization||!previousScope?.loadFrame||!parsed||!driver||!initialized)fail('SCHEMA_OPENING_SCOPE_UNPROVEN')
    const firstReady=openingJournal(owner)
    if(firstReady.kind!=='ready')fail('SCHEMA_JOURNAL_UNPROVEN')
    const serverProgram=schemaEpochExecution(firstReady.epoch).program as MvuExecutableProgramV4,
      serverScripts=schemaExecutionViewV4(serverProgram).scripts,load=previousScope.loadFrame,
      readSource=schemaScopeSource(preparation.sourceSnapshot),updateId=preparation.phaseSelectors[1].selector.batchId,
      interests=()=>deps.readHookInterests?.(sid)??[],base=initialized.values
    if(!load.scopeReadFrame)fail('SCHEMA_OPENING_SCOPE_UNPROVEN')
    let values=initialized.values,context=initialized.context,update:Mvu196UpdateInputV1|undefined
    let result!:Extract<Awaited<ReturnType<typeof driver.execute>>,{kind:'completed'}>
    for(;;) {
      result=await withLease(owner,async()=>{
        const selector=mvuSchemaOpeningPhaseSelector(preparation,owner.phaseAssociations.length),currentEvents=events(session),
          currentCut:SourceNativeCutFacts={...previousScope.sourceNativeCut,nativeCut:currentEvents.length,
            nativePrefixSha256:schemaNativeCutSha256(currentEvents,currentEvents.length,deps.nativeHistory?.prefixes),anchor:selector.anchor},
          currentBinding={ownerSessionId:sid,sourceNativeCutSha256:recordSha256(currentCut),material:load.material},
          readFrame=buildSchemaScopeReadFrame(readSource,currentBinding.sourceNativeCutSha256,serverScripts,
            load.scopeReadFrame!.scopes.chat,
            schemaScopeVisibleMessages(currentEvents,deps.projectPrefix,readSource,()=>sid,new Map()))
        if(!update) {
          const macros=openingMacros(owner,message,readFrame)
          update={schemaVersion:1,encoding:'native-mvu-196-update-start-v1',updateId,message,interests:interests(),
            ...macros?{macros}:{}}
        }else update={...update,interests:interests()}
        owner.selector=selector
        for(const key of [schemaDispatchKey(sid,preparation.realmEpoch,selector.batchId),
          schemaCompletionKey(sid,preparation.realmEpoch,selector.batchId),schemaUnavailableKey(sid,preparation.realmEpoch,selector.batchId)])
          owner.journalKeys.add(key)
        owner.scope={...previousScope,signal:AbortSignal.any([signal,owner.abort.signal]),sourceNativeCut:currentCut,
          requestedStep:{eventId:selector.batchId,frame:{...currentBinding,input:{schemaVersion:4,
            encoding:'native-mvu-author-schema-phase-input-v4',errorPolicy:schemaPhaseErrorPolicyForProgramV4(serverProgram),
            phase:'update-core',base,values,context,update,
            clockEpochMs:preparation.clockEpochMs,randomSeed:preparation.randomSeed,scopeReadFrame:readFrame}}}}
        if(previousScope.inheritedReady)Object.defineProperty(owner.scope,'inheritedReady',{value:previousScope.inheritedReady})
        if(previousScope.captureJournal)Object.defineProperty(owner.scope,'captureJournal',{value:previousScope.captureJournal})
        const completed=await driver.execute(selector)
        if(completed.kind!=='completed')fail(completed.code)
        owner.compiledProgram=completed.compiledProgram
        if(completed.output.kind!=='accepted')fail('SCHEMA_OPENING_UPDATE_REFUSED')
        if(completed.association.schemaVersion!==5)fail('SCHEMA_JOURNAL_UNPROVEN')
        owner.phaseAssociations.push(completed.association)
        return completed
      })
      if(result.output.kind!=='accepted'||!result.output.update)fail('SCHEMA_JOURNAL_UNPROVEN')
      values=result.output.values;context=result.output.context
      const progress=result.output.update
      if(progress.kind==='complete')break
      if(progress.kind!=='yield')fail('SCHEMA_OPENING_UPDATE_REFUSED')
      const hook=await executeOpeningHook(owner,{sessionId:sid,planSha256:preparation.preparationSha256,
        target:openingTarget(owner),stage:progress.stage,yieldOrdinal:progress.yieldOrdinal,payload:{graph:progress.graph}},signal)
      update={schemaVersion:1,encoding:'native-mvu-196-update-resume-v1',updateId,yieldOrdinal:progress.yieldOrdinal,
        graph:hook&&'graph' in hook.fact.result.output?hook.fact.result.output.graph!:progress.graph,
        ...hook?.fact.result.contextWrites?{contextWrites:hook.fact.result.contextWrites}:{},interests:interests()}
    }
    const finalOutput=result.output
    await withLease(owner,async()=>{
      if(!owner.scope||!checkOwned(owner.scope,{stage:'returned',dispatchMarker:result.association.dispatchMarker,
        completionMarker:result.association.completionMarker}))
        fail('SCHEMA_OPENING_EXECUTION_UNPROVEN')
      owner.workerEvidence=result.evidence
    })
    const before=await executeOpeningHook(owner,{sessionId:sid,planSha256:preparation.preparationSha256,
      target:openingTarget(owner),stage:'before-message-update',
      payload:{context:{variables:mvuSchemaStoryVariables(values,context),message_content:message}}},signal)
    let finalizedMessage=message
    if(before?.fact.result.stage==='before-message-update') {
      const accepted=before.variables!
      values=accepted.values;context=accepted.context;finalizedMessage=before.fact.result.output.context.message_content
    }
    // The parked run is closed before either producer may acknowledge success.
    await driver.closeOwner(owner.token)
    return withLease(owner,async()=>{
      const ready=openingJournal(owner),actual=ready.kind==='ready'?ready.steps.at(-1):undefined,
        execution=ready.kind==='ready'?schemaEpochExecution(ready.epoch):undefined
      if(ready.kind!=='ready'||!execution||!actual||actual.step.frame.input.schemaVersion!==4
        ||schemaEpochAuthorIdentity(ready.epoch).programSha256!==schemaExecutionProgramSha256(result.association)
        ||!same(actual.step.output,finalOutput))fail('SCHEMA_JOURNAL_UNPROVEN')
      validateSchemaGuestOutputForProgramV4(finalOutput,execution.program as MvuExecutableProgramV4,actual.step.frame.input)
      const plan=openingPlan(owner,owner.phaseAssociations.at(-1)!,finalOutput,message,ready,{values,context,finalizedMessage})
      const live:SchemaOpeningExecutionLive={kind:'prepared',plan,evidence:result.evidence,
        association:result.association,output:result.output}
      owner.live=live;liveOwners.set(live,owner)
      return live
    })
  }
  function openingPlan(owner:OwnedOpening,association:AuthorHostAssociationV5,
    output:Extract<SchemaGuestOutput,{kind:'accepted'}>,message:string,ready:SchemaJournalReady,
    final={values:output.values,context:output.context,finalizedMessage:message}) {
    const {preparation,initialization,initialData:parsed}=owner
    if(!initialization||!parsed||ready.epoch.schemaVersion!==5)fail('SCHEMA_JOURNAL_UNPROVEN')
    const plan=validateMvuSchemaOpeningPlan(sealMvuSchemaOpeningFact({schemaVersion:10 as const,
      encoding:'mvu-programmatic-opening-plan-v10' as const,host:preparation.host,server:ready.epoch.server.executor,
      phases:owner.phaseAssociations.map((execution,index)=>({phase:index===0?'initialization' as const:'update-core' as const,execution})),
      identity:preparation.identity,selectedSwipeIdentity:preparation.initSource.selectedSwipeIdentity,
      preparationSha256:preparation.preparationSha256,
      authorSourceSha256:preparation.authorSourceSha256,sourceSnapshot:preparation.sourceSnapshot,
      initSource:preparation.initSource,initialValuesSha256:parsed.valuesSha256,birth:preparation.birth,
      updateMessage:message,execution:association,values:final.values,context:final.context,frontier:journalFrontier(ready),
      ...owner.hooks.length?{browser:{schemaVersion:1 as const,hooks:owner.hooks,finalizedMessage:final.finalizedMessage}}:{},
      valuesSha256:recordSha256(final.values)},'planSha256'))
    return plan
  }
  async function executeInitialization(preparationInput:MvuSchemaOpeningPreparation) {
    let owner:OwnedOpening|undefined,live:SchemaOpeningExecutionLive|undefined
    try {
      const preparation=validateMvuSchemaOpeningPreparation(preparationInput),sid=preparation.identity.sessionId
      if(preparation.birth.kind!=='copy'||retained(preparation).status!=='preparing'||owners.has(sid)) {
        fail('SCHEMA_OPENING_PREPARATION_CHANGED')
      }
      const agent=await deps.resolveAgent(sid),session=deps.session(sid)
      if(!agent||!session||agent.session!==session||deps.agent(session)!==agent||!deps.active(session))fail('SCHEMA_OWNER_UNPROVEN')
      const stop=agent.lookupInputStop()
      if(agent.status!=='idle'||agent.inbox.nextStep.length||agent.inbox.nextTurn.length
        ||!['none','settled'].includes(agent.lookupInputCompletion().status)
        ||!['none','acknowledged'].includes(stop.status))fail('SCHEMA_NATIVE_BUSY')
      owner={token:Object.freeze({}),preparation,author:authorFor(preparation),session,agent,
        stopSha256:recordSha256(stop),abort:new AbortController(),inSource:false,revoked:false,
        hooks:[],journalKeys:new Set(),phaseAssociations:[]}
      owners.set(sid,owner);scopes.set(owner.token,owner)
      const admitted=owner
      live=await agent.runMaintenance(async signal=>{
        await withLease(admitted,async()=>{
          if(retained(preparation).status!=='preparing')fail('SCHEMA_OPENING_PREPARATION_CHANGED')
          await initializeOwned(admitted,signal)
        })
        await initializeBrowser(admitted,signal)
        return finishOwned(admitted,selectedOpening(preparation),signal)
      })
      return live
    }catch(error){return {kind:'unavailable' as const,code:codeOf(error)}}
    finally {if(owner&&!live)await releaseOwner(owner)}
  }
  async function releaseOwner(owner:OwnedOpening):Promise<void> {
    owner.revoked=true;owner.abort.abort()
    try {await owner.replay?.closeOwner(owner.token)}
    finally {
      delete owner.live
      if(owner.generatedHandle)generatedOwners.delete(owner.generatedHandle)
      if(owners.get(owner.session.id)===owner) {
        owners.delete(owner.session.id)
        journal.releaseSession(owner.session.id)
      }
    }
  }
  async function releaseExecution(live:SchemaOpeningExecutionLive):Promise<void> {
    const owner=liveOwners.get(live)
    try {if(owner)await releaseOwner(owner)}finally{liveOwners.delete(live)}
  }
  function checkBeforeOpening(live:SchemaOpeningExecutionLive,intent:OpeningIntentV5):boolean {
    try {
      const owner=liveOwners.get(live),scope=owner?.scope
      if(!owner||!scope||!owner.inSource||sourceLeases.get(owner.session.id)!==owner||!ownerCurrent(owner)
        ||intent.status!=='pending'||!same(retained(owner.preparation),intent)||!same(intent.initialization,live.plan)
        ||!same(live.association,live.plan.execution)||live.output.kind!=='accepted'
        ||live.plan.initialValuesSha256!==owner.initialData?.valuesSha256
        ||owner.agent.status!=='idle'||owner.agent.inbox.nextStep.length||owner.agent.inbox.nextTurn.length
        ||!['none','settled'].includes(owner.agent.lookupInputCompletion().status))return false
      // The retained private execution and its exact Native pair must still be
      // the whole tail. This check runs inside Source immediately before the
      // programmatic SDK takes its own maintenance reservation; no nested one.
      if(owner.workerEvidence!==live.evidence||events(owner.session).length!==live.plan.frontier.nativeCut)return false
      return numericalRowsAllowed(owner)&&recordSha256(live.output)===live.association.outputSha256
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
        ||live.plan.initialValuesSha256!==owner.initialData?.valuesSha256
        ||!numericalRowsAllowed(owner,boundary))return false
      return owner.workerEvidence===live.evidence&&!!owner.scope
        &&checkOwned(owner.scope,{stage:'publication',dispatchMarker:live.association.dispatchMarker,
          completionMarker:live.association.completionMarker})
    } catch {return false}
  }
  async function withPublicationBoundary<T>(live:SchemaOpeningExecutionLive,action:()=>Promise<T>):Promise<T> {
    const owner=liveOwners.get(live);if(!owner)fail('SCHEMA_OWNER_UNPROVEN')
    return withLease(owner,action)
  }
  function readyAssociation(ready:SchemaJournalReady,plan:SchemaOpeningExecutionLive['plan'],
    initial:NonNullable<OwnedOpening['initialData']>):boolean {
    const first=ready.steps[0]?.step.frame.input
    return !!first&&same(first.values,initial.values)&&same(first.context,initial.context)
      &&verifyMvuSchemaOpeningExecution(ready,plan)
  }
  async function verifyHistorical(intent:OpeningIntentV5,event:MvuSchemaOpeningEventV2,head:MvuSchemaOpeningHeadV2) {
    try {
      const session=deps.session(intent.sessionId),plan=intent.initialization!
      if(!session||!deps.active(session))fail('SCHEMA_SESSION_INACTIVE')
      if(intent.status!=='completed')fail('SCHEMA_OPENING_NOT_COMPLETED')
      if(!verifyMvuSchemaInheritedOpeningFacts({intent:{...intent,status:'completed'},preparation:intent.preparation,
        plan,native:event.native,event,head,events:events(session)},
        {projectPrefix:deps.projectPrefix})||!sourceCurrent(intent.preparation))fail('SCHEMA_OPENING_RECORD_INVALID')
      const incarnation=deps.agent(session),stopSha256=recordSha256(incarnation?.lookupInputStop())
      // The journal and closed Native span prove the completed opening at its own
      // cut. Later Story metadata and MVU rows do not restore a fresh-session
      // prerequisite or grant another initialization/publication permission.
      const before=recordSha256({events:events(session),intent:retained(intent.preparation),event,head})
      const author=authorFor(intent.preparation),parsed=compileSchemaMvuInitData(plan.initSource)
      if(parsed.kind!=='parsed'||parsed.valuesSha256!==plan.initialValuesSha256)fail('SCHEMA_INITIAL_DATA_INVALID')
      const cut=plan.frontier.nativeCut
      const ready=journal.capture(session.id,plan.execution.realmEpoch,events(session).slice(0,cut),null,true)
      if(ready.kind!=='ready'||!readyAssociation(ready,plan,parsed))fail('SCHEMA_JOURNAL_UNPROVEN')
      const {program,loadFrame:load}=schemaEpochExecution(ready.epoch)
      if(ready.epoch.schemaVersion!==5)fail('AUTHOR_HOST_IMPLEMENTATION_CHANGED')
      const tuple=ready.epoch.server.executor
      const {replay:driver}=await engine(intent.preparation,tuple)
      const frame=ready.steps[0]!.step.frame
      const loadCut=plan.phases[0].execution.sourceNativeCutSha256
      if(!same(program.source.material,author.material)||!same(load.values,parsed.values)
        ||!same(load.context,parsed.context)||!same(frame.input.values,parsed.values)||!same(frame.input.context,parsed.context)
        ||!same(load.material,author.material)||!same(frame.material,author.material)
        ||load.ownerSessionId!==session.id||frame.ownerSessionId!==session.id
        ||load.sourceNativeCutSha256!==loadCut
        ||frame.sourceNativeCutSha256!==loadCut
        ||load.clockEpochMs!==intent.preparation.clockEpochMs||load.randomSeed!==intent.preparation.randomSeed
        ||frame.input.clockEpochMs!==intent.preparation.clockEpochMs||frame.input.randomSeed!==intent.preparation.randomSeed)fail('SCHEMA_LOAD_SOURCE_MISMATCH')
      const verified=await driver.verifyHistorical({sessionId:session.id,realmEpoch:plan.execution.realmEpoch,nativeCut:cut})
      if(verified.kind!=='verified')return verified
      if(disposed||deps.session(session.id)!==session||!deps.active(session)||!sourceCurrent(intent.preparation)
        ||deps.agent(session)!==incarnation||recordSha256(incarnation?.lookupInputStop())!==stopSha256
        ||before!==recordSha256({events:events(session),intent:retained(intent.preparation),event,head}))fail('SCHEMA_HISTORICAL_FACTS_CHANGED')
      // Historical execution grants a read view only. It never restores a hot
      // owner, writes a head, completes an intent or dispatches another event.
      return {kind:'verified' as const}
    } catch(error) {return {kind:'blocked' as const,code:codeOf(error)}}
  }
  return {prepare,prepareTrialSource,prepareBrowserSource,executeInitialization,releaseExecution,withPublicationBoundary,checkBeforeOpening,openingAgent,
    prepareGeneratedSource,beginGeneratedOpening,finishGeneratedOpening,releaseGeneratedOpening,
    checkPublication,sourceCurrent,verifyHistorical,templateEjsRuntime:authorAssets.getEjs,
    templateEjsCurrent:authorAssets.currentEjs,templateEjsCheckCurrentSync:authorAssets.checkEjsCurrentSync,
    /** Shared protected runtime lifecycle for the actual closing-work owner.
     * Access to compiler/runner objects does not grant a publication lease. */
    protectedRuntime:async(tuple?:SchemaExecutorIdentityTuple,host?:AuthorHostIdentityV5):
      Promise<OwnedMvuSchemaExecutor|ProtectedAuthorHostRuntimeV5>=>{
      if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
      if(host) {
        if(!tuple)fail('AUTHOR_HOST_SERVER_IDENTITY_UNAVAILABLE')
        return authorAssets.getForVerifiedHost(host,tuple as AuthorServerExecutorV4)
      }
      if(!tuple)fail('SCHEMA_EXECUTOR_IDENTITY_UNAVAILABLE')
      return assets.getForVerifiedEpoch(tuple)
    },
    invalidateAgent(agent:object):void {
      for(const owner of owners.values())if(owner.agent===agent)void releaseOwner(owner).catch(()=>{})
    },
    invalidateSession(sid:string):void {
      const owner=owners.get(sid)
      if(owner)void releaseOwner(owner).catch(()=>{})
      else journal.releaseSession(sid)
    },
    async dispose():Promise<void> {
      disposed=true
      await Promise.allSettled([...owners.values()].map(releaseOwner))
      for(const replay of replays.values())replay.dispose()
      journal.dispose()
      await authorAssets.dispose()
      await assets.dispose()
    },
  }
}
