/** Actual closing-work owner and read-only history for schema story turns.
 * Source descriptors and stored terminal plans never mint this private lease. */
import {recordSha256,sha256,textOf} from './roleplay-data.js'
import {schemaPhaseErrorPolicyForProgramV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuDiscardedCommandObservation} from './roleplay-mvu-player-types.js'
import {canonicalAssistantForTurn,surfaceEntries} from './roleplay-context.js'
import type {ContextSession,ContextEvent} from './roleplay-context.js'
import {openingIntentKey} from './roleplay-opening-selection.js'
import {mvuInitializationEventKey,mvuInitializationHeadKey} from './roleplay-mvu-initialization.js'
import {mvuStateCurrentHeadKey} from './roleplay-mvu-state.js'
import {readInputCompletion} from './roleplay-input-completion.js'
import {inputSnapshotReferenceCurrent} from './roleplay-preparation.js'
import {createRoleplayMvuSchemaJournal,freezeSchemaJournalData,schemaJournalFrontierSha256,schemaEpochExecution,schemaEpochAuthorIdentity,
  isAuthorHostJournalReadyV5,schemaJournalServerTailSha256,schemaJournalHostFrontierSha256} from './roleplay-mvu-schema-journal.js'
import {createRoleplayMvuSchemaReplay,schemaExecutionHostFrontierSha256} from './roleplay-mvu-schema-replay.js'
import {schemaOriginalSnapshot,schemaOriginalCompilationInput,schemaOriginalServerScripts,
  schemaOriginalProgramSha256,schemaOriginalReplayCompilationInput} from './roleplay-mvu-schema-source.js'
import {schemaTraceRequestedStep} from './roleplay-mvu-schema-executor-types.js'
import {createRoleplayMvuSchemaStory} from './roleplay-mvu-schema-story.js'
import {createRoleplayMvuSchemaPrefixInputs} from './roleplay-mvu-schema-frozen-prefix-input.js'
import type {MvuSchemaPrefixInputClosureV1} from './roleplay-mvu-schema-frozen-prefix-input.js'
import {validateMvuSchemaOpeningIntent,validateMvuSchemaOpeningEvent,validateMvuSchemaOpeningHead,
  verifyMvuSchemaOpeningFacts,mvuSchemaOpeningHead} from './roleplay-mvu-schema-opening-types.js'
import type {FrozenMvuOpeningInitializationV3} from './roleplay-mvu-schema-opening-types.js'
import {sealMvuSchemaStoryFact,validateMvuSchemaNumericalSnapshot,validateMvuSchemaStoryEvent,
  validateMvuSchemaStorySettlement,mvuSchemaStoryHead,mvuSchemaStoryEventKey,mvuSchemaStorySettlementKey,
  MVU_SCHEMA_STORY_PHASES,isMvuSchemaGenesisHead} from './roleplay-mvu-schema-story-types.js'
import {validateMvuSchemaStoryPlan,validateMvuSchemaStoryRevisionDescriptor,validateMvuSchemaStoryRevisionEvent,
  mvuSchemaStoryRevisionDescriptorKey,mvuSchemaStoryRevisionPlanKey,mvuSchemaStoryRevisionEventKey,
  mvuSchemaStoryRevisionEvent,mvuSchemaStoryRevisionHead,mvuSchemaStoryPhaseInput,mvuSchemaStoryReducerBridge,
  deriveMvuSchemaStoryRevisionSelectors,deriveMvuSchemaStoryRevisionSelectorsV2,
  mvuSchemaStoryRevisionCompletionKey,validateMvuSchemaStoryRevisionCompletion,
  validateMvuSchemaStoryRevisionBasis,mvuSchemaStoryRevisionBasisKey,
  parseMvuSchemaStoryCandidateV2} from './roleplay-mvu-schema-story-types.js'
import {validateMvuSchemaPlayerEvent,joinMvuSchemaPlayerCompletedEvent,mvuSchemaPlayerEventKey,
  mvuSchemaPlayerHead,mvuSchemaPlayerOperationKey,mvuSchemaPlayerCompletionKey,
  MVU_SCHEMA_PLAYER_PHASES,mvuSchemaPlayerPhaseInput,mvuSchemaPlayerReducerBridge,
  deriveMvuSchemaPlayerRevisionSelectors,validateMvuSchemaPlayerRevisionPlan,
  mvuSchemaPlayerRevisionEventId,mvuSchemaPlayerRevisionEvent,validateMvuSchemaPlayerRevisionEvent,
  mvuSchemaPlayerRevisionHead} from './roleplay-mvu-schema-player-types.js'
import {validateMvuSchemaFrozenPrefix,validateMvuSchemaDerivedBasis,sealMvuSchemaInheritanceFact}
  from './roleplay-mvu-schema-derived-types.js'
import {buildSchemaScopeReadFrame,schemaScopeSource,schemaScopeConfiguration,
  schemaScopeOwner,schemaScopePublished,schemaScopeMessageKey,schemaScopeVisibleMessages,
  schemaScopeReadFactsEqual,schemaScopeEmpty,schemaScopeReowner} from './roleplay-mvu-schema-scope-facts.js'
import type {BrowserSnapshotV1,BrowserChatMessageSnapshotV1} from './tavern-author-browser-types.mjs'
import type {BrowserSnapshotV2,BrowserRuntimeArtifactV2} from './tavern-author-browser-types-v2.mjs'
import type {BrowserSnapshotV3,BrowserRuntimeArtifactV3,BrowserProgramV3} from './tavern-author-browser-types-v3.mjs'
import type {NativeBrowserCharacterV1} from './roleplay-native-persona-types.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import {deriveAuthorChatBindingV1,deriveAuthorChatBindingV2} from './roleplay-author-chat-state.js'
import type {CanonicalAuthorChatStateV1} from './roleplay-author-chat-state.js'
import {produceAuthorPromptScopeFrameV1} from './roleplay-author-prompt-capture.js'
import type {AuthorPromptPreparationFactsV1} from './roleplay-author-prompt-capture.js'
import type {AuthorBrowserPreparationFactsV2,AuthorBrowserPreparationFactsV3} from './roleplay-author-browser-generation-types.js'
import type {PromptProgramV1,PromptCaptureV1,PromptCapturedMessageV1} from './tavern-author-prompt-types.mjs'
import type {MvuScopeVariablesV1,MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {MvuSchemaRealmLoadFrameV3} from './tavern-mvu-schema-types-v3.js'
import type {MvuSchemaRealmLoadFrameV4} from './tavern-mvu-schema-types-v4.js'
import {readMvuSchemaInheritedStoryFacts,verifyMvuSchemaInheritedOpeningFacts}
  from './roleplay-mvu-schema-prefix-facts.js'
import {verifyMvuSchemaUnpublishedTail} from './roleplay-mvu-schema-history-tail.js'
import type {Session,SessionEvent} from '@deepseek-ai/dsh-session'
import type {NativeInputAdmissionAgentV2} from '@deepseek-ai/dsh-agent-loop'
import type {OwnedMvuSchemaExecutor,SchemaExecutorIdentityTuple,SchemaAuthorProgram} from './roleplay-mvu-schema-executor-types.js'
import type {CombinedAuthorProgram,CombinedPlanRowV4} from './tavern-author-combined-types.mjs'
import type {ProtectedAuthorHostRuntimeV5} from './roleplay-author-host-assets.js'
import type {AuthorHostIdentityV5} from './roleplay-author-host-types-v5.js'
import type {SchemaReplayDeps} from './roleplay-mvu-schema-replay.js'
import type {mvuSchemaMarkers} from 'dsh-nexttavern-session-format/mvu-schema-marker'
import type {InputCompletionScope} from './roleplay-input-completion.js'
import type {InputPreparationCurrency} from './roleplay-input-preparation.js'
import type {MvuSchemaMaintenanceCandidateSourceV1} from './roleplay-mvu-schema-maintenance-types.js'
import {validateSchemaTaskEditIntentV1,validateSchemaTaskEditBindingV1,
  schemaTaskEditActiveKey,schemaTaskEditBindingKey} from './roleplay-mvu-schema-task-edit-types.js'
import type {SchemaTaskArtifactV1,SchemaTaskRevisionSelectionV1,SchemaTaskEditIntentV1,SchemaTaskEditBindingV1}
  from './roleplay-mvu-schema-task-edit-types.js'
import type {InputClosingView,InputObservation} from './roleplay-input-preparation.js'
import type {CompletedStoryBody} from './roleplay-mvu-story.js'
import type {createRoleplayMvuSchemaSource,SchemaFrozenOriginal,SchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import type {SchemaJournalReady,SourceNativeCutFacts} from './roleplay-mvu-schema-journal.js'
import type {SchemaOwnedScope,SchemaBoundary,SchemaExecutionSelector,SchemaExecutionAssociation,
  HistoricalCutSelector,HistoricalCutFacts,SchemaOwnedHistoricalCut} from './roleplay-mvu-schema-replay.js'
import type {MvuSchemaNumericalSnapshotV2,MvuSchemaStoryPlan,MvuSchemaStoryPlanV10,MvuSchemaStoryPhase,
  MvuSchemaStoryLive,MvuSchemaStoryPublicationBoundary} from './roleplay-mvu-schema-story-types.js'
import type {MvuSchemaStoryRevisionDescriptorV1,MvuSchemaStoryRevisionPlanV1,MvuSchemaStoryRevisionEventV1,
  MvuSchemaStoryRevisionDescriptorV2,MvuSchemaStoryRevisionPlanV2,MvuSchemaStoryRevisionEventV2,
  MvuSchemaStoryRevisionDescriptorV3,MvuSchemaStoryRevisionCompletionV3,MvuSchemaStoryRevisionDescriptorV4,
  MvuSchemaStoryRevisionPlanV3,MvuSchemaStoryRevisionCompletionV4,
  MvuSchemaStoryRevisionDescriptor,MvuSchemaStoryRevisionPlan,MvuSchemaStoryRevisionEvent,
  MvuSchemaStoryRevisionCompletionV2,MvuSchemaStoryPhaseFact,MvuSchemaStoryReducerBridge} from './roleplay-mvu-schema-story-types.js'
import type {MvuSchemaPlayerEventV1,MvuSchemaPlayerRevisionPlanV1,MvuSchemaPlayerRevisionEventV1,
  MvuSchemaPlayerPhaseFact} from './roleplay-mvu-schema-player-types.js'
import type {MvuSchemaDerivedGenesis,MvuSchemaFrozenPrefixV1,MvuSchemaPrefixSeed}
  from './roleplay-mvu-schema-derived-types.js'
import type {MvuSchemaForkCapture,createRoleplayMvuSchemaDerived} from './roleplay-mvu-schema-derived.js'
import type {SchemaJournalFrozenCut} from './roleplay-mvu-schema-journal.js'
import type {WorldlineMessageEdits} from './roleplay-worldline-types.js'
import type {MvuInheritedMessageEditProtocol} from './roleplay-mvu-prefix-facts.js'
import type {MvuEditInvalidation} from './roleplay-mvu-edit-facts.js'
import {acceptedMvuDisplayUpdate,formatMvuDisplayUpdates} from './roleplay-mvu-display-facts.js'
import type {MvuAcceptedDisplayUpdate} from './roleplay-mvu-display-facts.js'
import type {RoleplayInputStateOwner,RoleplayInputStateRead} from './roleplay-input-state.js'
import type {ReaderDisplayScopes} from './roleplay-reader-display.js'
import type {TavernTemplateScopeBindingV1} from './tavern-template-types.mjs'
import type {ReaderRegexDocumentReadFactsV1,ReaderRegexDocumentSnapshotV1} from './reader-regex-document-types.mjs'
import type {AuthorBrowserCapturedFacts} from './roleplay-author-browser.js'

interface Table {get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>;entries():Iterable<[string,unknown]>}
export interface MvuSchemaStoryCoreDeps {
  inputState:RoleplayInputStateOwner
  authorChat?:Pick<CanonicalAuthorChatStateV1,'capture'|'captureWithCurrencyV2'>
  branch:Table
  status:Table
  source:ReturnType<typeof createRoleplayMvuSchemaSource>
  activePointer(sid:string):unknown
  session(sid:string):Session|undefined
  agent(session:Session):NativeInputAdmissionAgentV2|undefined
  active(session:Session):boolean
  sourceSha256(sid:string):string
  /** The actual closing owner verifies current before returning this view. */
  closingView(lease:object,scope:InputCompletionScope):InputClosingView|undefined
  protectedRuntime(tuple?:SchemaExecutorIdentityTuple,host?:AuthorHostIdentityV5):Promise<OwnedMvuSchemaExecutor|ProtectedAuthorHostRuntimeV5>
  withSourceLock<T>(sid:string,action:()=>Promise<T>):Promise<T>
  flush(session:Session):Promise<boolean>
  markers:typeof mvuSchemaMarkers
  verifyNative(scope:InputCompletionScope):boolean
  verifyConsumedScope(scope:InputCompletionScope):boolean
  readCanonical(sid:string,turn:number):CompletedStoryBody|undefined
  readConsumedCanonical(sid:string,seq:number,turn:number,throughSeq:number):CompletedStoryBody|undefined
  awaitOwnedCompletion(sid:string,turn:number):Promise<void>
  maintenanceCompletion?(scope:InputCompletionScope,canonical:import('./roleplay-mvu-schema-story-types.js').MvuSchemaStoryCanonical,
    signal:AbortSignal):Promise<MvuSchemaMaintenanceCandidateSourceV1|undefined>
  manualPendingCode?(sid:string):string|undefined
  captureManualLedger?(sid:string):import('./roleplay-mvu-schema-player-types.js').MvuSchemaPlayerLedger|undefined
  manualEditBlockCode?(sid:string):string|undefined
  derivedRequired?(sid:string):boolean
  readDerivedGenesis?(sid:string):MvuSchemaDerivedGenesis|undefined
  captureRevisionPrefix?(sid:string,nativeCut:number):MvuSchemaForkCapture
  recoverRevisionPrefix?:ReturnType<typeof createRoleplayMvuSchemaDerived>['recoverRevisionPrefix']
  readEditInvalidation?(sid:string):MvuEditInvalidation
  currentEdits(session:Session):readonly SessionEvent[]
  recoverTaskEdit?(session:Session):Promise<number|undefined>
  projectPrefix:WorldlineMessageEdits['projectPrefix']
  editProtocol:MvuInheritedMessageEditProtocol
}
interface History {
  original:SchemaFrozenOriginal
  ready:SchemaJournalReady
  snapshot:MvuSchemaNumericalSnapshotV2
  consumed:Map<string,string>
  initial:MvuSchemaNumericalSnapshotV2
  seed:MvuSchemaPrefixSeed
  inheritedCut:SchemaJournalFrozenCut|null
  readonly inheritedReady?:SchemaJournalReady
  eventKeys:string[]
  lastTaskResultCanonicalSeq?:number
  taskArtifacts:ReadonlyMap<number,SchemaTaskArtifactV1>
  readScopes?:ScopeFacts
  displayUpdates?:readonly MvuAcceptedDisplayUpdate[]
  commandDiagnostics:readonly MvuDiscardedCommandObservation[]
  resolvedEdits:ReadonlySet<number>
  editBasis:{root:MvuSchemaNumericalSnapshotV2['root'];editFloorSeq:number}
}
interface ScopeFacts {
  chat:MvuScopeVariablesV1
  messages:ReadonlyMap<string,MvuScopeVariablesV1>
  // null is this Session's own tail. Only its actual selected Native prefix
  // is read; an ancestor's range is always closed at the inheritance cut.
  owners:readonly {sessionId:string;fromSeq:number;throughSeq:number|null}[]
  updateChat:boolean
}
interface SchemaReadData {
  session:Session;agent:NativeInputAdmissionAgentV2|undefined;history:History;frame:SchemaStorySourceFrame
}
interface View extends SchemaReadData {read:RoleplayInputStateRead<SchemaReadData>}
interface Owner {
  lease:object;view:InputClosingView;original:SchemaFrozenOriginal;frame:SchemaStorySourceFrame
  base:MvuSchemaNumericalSnapshotV2;plan:MvuSchemaStoryPlan;abort:AbortController
  driver:ReturnType<typeof createRoleplayMvuSchemaReplay>
  inheritedCut:SchemaJournalFrozenCut|null
  inheritedReady?:SchemaJournalReady
  token:object;inSource:boolean;baseline:Map<string,string>;associations:SchemaExecutionAssociation[]
  scope?:SchemaOwnedScope;lastLive?:MvuSchemaStoryLive;publication?:MvuSchemaStoryPublicationBoundary
  compiledProgram?:SchemaAuthorProgram|CombinedAuthorProgram
  readScopes?:ScopeFacts
}
interface RevisionOwner {
  session:Session;agent:NativeInputAdmissionAgentV2;signal:AbortSignal;inSource:boolean
  original:SchemaFrozenOriginal;frame:SchemaStorySourceFrame;basis:History
  descriptor:MvuSchemaStoryRevisionDescriptor;plan:RevisionPlan
  driver:ReturnType<typeof createRoleplayMvuSchemaReplay>;token:object
  scope?:SchemaOwnedScope;associations:SchemaExecutionAssociation[];lastLive?:MvuSchemaStoryLive
  compiledProgram?:SchemaAuthorProgram|CombinedAuthorProgram
  projection?:ReturnType<WorldlineMessageEdits['projectPrefix']>
}
type SuffixDescriptor=MvuSchemaStoryRevisionDescriptorV2|MvuSchemaStoryRevisionDescriptorV3|MvuSchemaStoryRevisionDescriptorV4
type SuffixPlan=MvuSchemaStoryRevisionPlanV2|MvuSchemaStoryRevisionPlanV3|MvuSchemaPlayerRevisionPlanV1
type SuffixEvent=MvuSchemaStoryRevisionEventV2|MvuSchemaPlayerRevisionEventV1
type RevisionPlan=MvuSchemaStoryRevisionPlan|MvuSchemaPlayerRevisionPlanV1
type RevisionEvent=MvuSchemaStoryRevisionEvent|MvuSchemaPlayerRevisionEventV1
type OriginalStoryEvent=ReturnType<typeof validateMvuSchemaStoryEvent>
type OriginalEvent=OriginalStoryEvent|MvuSchemaPlayerEventV1
type HistoricalEvent=OriginalEvent|RevisionEvent
type TaskArtifactSourceFact={plan:MvuSchemaStoryPlanV10|MvuSchemaStoryRevisionPlanV3}
const isManualRevision=(event:HistoricalEvent):event is MvuSchemaPlayerRevisionEventV1=>
  event.encoding==='native-mvu-schema-player-revision-event-v1'
const isSuffixEvent=(event:HistoricalEvent):event is SuffixEvent=>
  event.encoding==='native-mvu-schema-story-revision-event-v2'||isManualRevision(event)
const isManualEvent=(event:HistoricalEvent):event is MvuSchemaPlayerEventV1|MvuSchemaPlayerRevisionEventV1=>
  event.encoding==='native-mvu-schema-player-event-v1'||isManualRevision(event)
function suffixOriginals(descriptor:SuffixDescriptor):MvuSchemaStoryRevisionDescriptorV3['originals'] {
  return descriptor.schemaVersion===3||descriptor.schemaVersion===4?descriptor.originals:descriptor.originals.map(event=>({kind:'story' as const,event}))
}
function readRevisionEvent(input:RevisionEvent):RevisionEvent {
  return input.encoding==='native-mvu-schema-player-revision-event-v1'
    ?validateMvuSchemaPlayerRevisionEvent(input):validateMvuSchemaStoryRevisionEvent(input)
}
function suffixHead(event:SuffixEvent) {
  return isManualRevision(event)?mvuSchemaPlayerRevisionHead(event):mvuSchemaStoryRevisionHead(event)
}
function manualChatAtBase(chat:MvuScopeVariablesV1,base:MvuSchemaNumericalSnapshotV2):boolean {
  return chat.kind==='available'&&chat.provenance.kind==='published-state'
    &&chat.provenance.state.kind==='manual'&&chat.provenance.state.revision===base.revision
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const openingPhaseCount=(plan:FrozenMvuOpeningInitializationV3)=>plan.schemaVersion===8?plan.phases.length:1
function fail(code:string):never {throw Error(code)}
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'SCHEMA_STORY_UNPROVEN'

export function createRoleplayMvuSchemaStoryCore(deps:MvuSchemaStoryCoreDeps) {
  const prefixInputs=createRoleplayMvuSchemaPrefixInputs({branch:deps.branch,status:deps.status})
  const journal=createRoleplayMvuSchemaJournal({table:prefixInputs.status as never,markers:deps.markers,
    recordOwner:deps.inputState.schemaJournal})
  const views=new Map<string,View>(),owners=new Map<string,Owner>(),scopes=new WeakMap<object,Owner>()
  const sourceLeases=new Map<string,Owner>()
  const revisionOwners=new Map<string,RevisionOwner>(),revisionScopes=new WeakMap<object,RevisionOwner>()
  let disposed=false
  // Only the synchronous capture's edit-invalidation reader may see this
  // already verified opening basis. It is DATA, never a live execution lease.
  let capturingEditBasis:{sid:string;basis:History['editBasis']}|undefined
  const drivers=new Map<string,ReturnType<typeof createRoleplayMvuSchemaReplay>>()
  // Source alone returns the branded Original5. Retain that object across
  // immutable derived/history DATA reads; a DTO is never promoted in place.
  const sourceOriginals=new Map<string,SchemaFrozenOriginal>()
  // A genuine recovery result carries its already checked prefix projections.
  // Retained genesis DATA must outlive eviction from the bounded lookup tables;
  // a copied ready DTO cannot acquire this process-local association.
  const recoveredPrefixes=new WeakMap<SchemaJournalReady,{original:SchemaFrozenOriginal;
    scopes:ScopeFacts|undefined;displayUpdates:readonly MvuAcceptedDisplayUpdate[];resolvedEdits:ReadonlySet<number>;
    lastTaskResultCanonicalSeq?:number;taskArtifacts:ReadonlyMap<number,SchemaTaskArtifactV1>}>()
  // This cache contains results of the same fully verified frozen-prefix fold.
  // Derivation revalidates its immutable rows before looking up the result; a
  // cache entry cannot bypass Native lineage, Source checks or mint a lease.
  const scopePrefixes=new Map<string,{nativePrefixSha256:string;facts:ScopeFacts}>()
  // Primitive accepted-display facts only; a cache miss cannot affect state,
  // fork or recovery. Registration follows the original complete prefix fold.
  const displayPrefixes=new Map<string,{ownerSessionId:string;nativePrefixSha256:string;
    updates:readonly MvuAcceptedDisplayUpdate[]}>()
  const all=(session:Session)=>session.snapshotEvents()
  const currentSession=(session:Session)=>!disposed&&deps.session(session.id)===session&&deps.active(session)
  const frontier=(ready:SchemaJournalReady)=>({nativeCut:ready.steps.at(-1)!.completionMarker.seq+1,
    tailSha256:schemaJournalServerTailSha256(ready),frontierSha256:schemaJournalHostFrontierSha256(ready)})
  function snapshot(body:Omit<MvuSchemaNumericalSnapshotV2,'stateSnapshotSha256'>) {
    const {stateSnapshotSha256:_prior,...content}=body as MvuSchemaNumericalSnapshotV2
    return validateMvuSchemaNumericalSnapshot(sealMvuSchemaStoryFact(content,'stateSnapshotSha256'))
  }
  function scopeOwnerForSeq(facts:ScopeFacts,seq:number):string {
    const owner=[...facts.owners].reverse().find(range=>seq>=range.fromSeq
      &&(range.throughSeq===null||seq<range.throughSeq))
    if(!owner)fail('SCHEMA_SCOPE_MESSAGE_OWNER_UNPROVEN')
    return owner.sessionId
  }
  function scopeFactsCurrent(facts:ScopeFacts):boolean {
    for(const variables of [facts.chat,...facts.messages.values()])if(variables.kind==='available'
      &&variables.provenance.kind==='published-state') {
      const ref=variables.provenance.state
      if(recordSha256(prefixInputs.status.get(ref.recordKey))!==ref.recordSha256)return false
    }
    return true
  }
  function scopeFrameAt(facts:ScopeFacts,original:SchemaFrozenOriginal,current:SchemaStorySourceFrame,
    cut:SourceNativeCutFacts,events:readonly SessionEvent[],logicalCut=cut.nativeCut,
    projection?:ReturnType<WorldlineMessageEdits['projectPrefix']>):MvuScopeReadFrameV1 {
    if(cut.nativeCut>events.length||cut.sessionId!==current.sessionId
      ||cut.sourceSnapshotSha256!==current.snapshotSha256||cut.materialSha256!==current.materialSha256) {
      fail('SCHEMA_SCOPE_CUT_UNPROVEN')
    }
    // Live callers construct this cut from their actual Native snapshot;
    // historical callers consume Journal's proved prefix (or proveCut).
    // Scope projection consumes that same prefix without hashing it again.
    const source=schemaScopeSource(current.snapshot),prefix=events.slice(0,logicalCut)
    const project=projection?()=>({...projection,nodes:projection.nodes.filter(seq=>seq<logicalCut)}):deps.projectPrefix
    const snapshot=schemaOriginalSnapshot(original)
    if(source.importId!==snapshot.source.importId||source.rawSha256!==snapshot.source.rawSha256
      ||source.sourceRecordSessionId!==snapshot.source.sourceRecordSessionId)fail('SCHEMA_SCOPE_SOURCE_UNPROVEN')
    return buildSchemaScopeReadFrame(source,recordSha256(cut),schemaOriginalServerScripts(original),facts.chat,
      schemaScopeVisibleMessages(prefix,project,source,seq=>scopeOwnerForSeq(facts,seq),facts.messages))
  }
  function scopesForOpening(seed:Extract<MvuSchemaPrefixSeed,{kind:'opening'}>,original:SchemaFrozenOriginal,
    ready:SchemaJournalReady,events:readonly SessionEvent[]):ScopeFacts|undefined {
    if(original.preparation.schemaVersion<3)return undefined
    const snapshot=schemaOriginalSnapshot(original),material=schemaOriginalCompilationInput(original).source.material
    const source=schemaScopeSource(snapshot),opening=seed.event,seq=opening.native.assistantSeq
    const raw=events[seq]
    if(raw?.type!=='assistant/message'||raw.data.message.id!==opening.native.messageId)fail('SCHEMA_SCOPE_OPENING_UNPROVEN')
    const versionSha256=recordSha256(raw.data.message),owner=schemaScopeOwner(source,'message',opening.native.messageId,seed.intent.sessionId)
    const final=ready.steps[openingPhaseCount(opening.plan)-1]!,output=final.step.output
    if(output.kind!=='accepted')fail('SCHEMA_SCOPE_OPENING_UNPROVEN')
    const stateRef={kind:'opening' as const,ownerSessionId:seed.intent.sessionId,
      recordKey:mvuInitializationEventKey(seed.intent.sessionId,opening.eventId),recordSha256:recordSha256(opening),
      valuesSha256:opening.valuesSha256,revision:1}
    const values=schemaScopePublished(owner,stateRef,opening.plan.values,output.context)
    const messages=new Map([[schemaScopeMessageKey(seed.intent.sessionId,seq,opening.native.messageId,versionSha256),values]])
    // Original recovery already bound this checked epoch to the preparation.
    // Its executed chat baseline survives changes to fresh initialization.
    const load=schemaEpochExecution(ready.epoch).loadFrame as MvuSchemaRealmLoadFrameV3|MvuSchemaRealmLoadFrameV4
    return {chat:load.scopeReadFrame.scopes.chat,messages,
      owners:[{sessionId:seed.intent.sessionId,fromSeq:0,throughSeq:null}],
      updateChat:schemaScopeConfiguration(snapshot,material).updateChat}
  }
  function scopesForDerived(genesis:MvuSchemaDerivedGenesis,events:readonly SessionEvent[]):ScopeFacts|undefined {
    if(genesis.original.preparation.schemaVersion<3)return undefined
    const recovered=genesis.inheritedReady&&recoveredPrefixes.get(genesis.inheritedReady)
    let facts:ScopeFacts
    if(recovered) {
      if(!recovered.scopes)fail('SCHEMA_SCOPE_PREFIX_UNPROVEN')
      facts=recovered.scopes
    }else {
      const basis=validateMvuSchemaDerivedBasis(prefixInputs.branch.get(genesis.basisKey) as never)
      if(basis.basisSha256!==genesis.basisSha256||basis.prepared.childSessionId!==genesis.sessionId) {
        fail('SCHEMA_SCOPE_PREFIX_UNPROVEN')
      }
      const prefix=basis.prepared.prefix,cached=scopePrefixes.get(prefix.prefixSha256)
      if(!cached||cached.nativePrefixSha256!==prefix.journal.nativePrefixSha256
        ||recordSha256(events.slice(0,genesis.inheritedCut.nativeCut))!==cached.nativePrefixSha256) {
        fail('SCHEMA_SCOPE_PREFIX_UNPROVEN')
      }
      facts=cached.facts
    }
    const cut=genesis.inheritedCut.nativeCut
    // Normal Native input claims extend the child's own log without changing
    // its published state identity. Parent tails cannot extend into that child.
    const ancestors=facts.owners.filter(range=>range.fromSeq<cut).map(range=>({...range,
      throughSeq:range.throughSeq===null?cut:Math.min(range.throughSeq,cut)}))
    return {...facts,messages:new Map(facts.messages),owners:[...ancestors,
      {sessionId:genesis.sessionId,fromSeq:cut,throughSeq:null}]}
  }
  function displayForDerived(genesis:MvuSchemaDerivedGenesis,events:readonly SessionEvent[])
    :readonly MvuAcceptedDisplayUpdate[] {
    try {
      const recovered=genesis.inheritedReady&&recoveredPrefixes.get(genesis.inheritedReady)
      if(recovered)return recovered.displayUpdates.filter(item=>item.canonical.seq<genesis.inheritedCut.nativeCut)
      const basis=validateMvuSchemaDerivedBasis(prefixInputs.branch.get(genesis.basisKey) as never)
      if(basis.basisSha256!==genesis.basisSha256||basis.prepared.childSessionId!==genesis.sessionId)return []
      const prefix=basis.prepared.prefix,cached=displayPrefixes.get(prefix.prefixSha256)
      const cut=genesis.inheritedCut.nativeCut
      if(!cached||prefix.journal.nativeCut!==cut||cached.ownerSessionId!==prefix.sessionId
        ||cached.nativePrefixSha256!==prefix.journal.nativePrefixSha256
        ||cached.nativePrefixSha256!==genesis.inheritedCut.nativePrefixSha256
        ||recordSha256(events.slice(0,cut))!==cached.nativePrefixSha256)return []
      return cached.updates.filter(item=>item.canonical.seq<cut)
    }catch {return []}
  }
  function clearDisplayPrefixes(sid:string):void {
    for(const [key,entry] of displayPrefixes)if(entry.ownerSessionId===sid)displayPrefixes.delete(key)
  }
  function associationAt(sid:string,events:readonly SessionEvent[],ready:SchemaJournalReady,index:number):SchemaExecutionAssociation {
    const step=ready.steps[index]
    if(!step)fail('SCHEMA_STORY_JOURNAL_UNPROVEN')
    const cut=step.completionMarker.seq+1
    if(ready.frozen.sessionId!==sid||ready.frozen.nativeCut!==events.length||cut>events.length) {
      fail('SCHEMA_STORY_JOURNAL_UNPROVEN')
    }
    // The enclosing factual read already verified every journal row against
    // this actual Native prefix. Derive its earlier phase frontier from those
    // immutable steps; re-cloning all frames per phase adds no authority.
    const frontierSha256=schemaJournalFrontierSha256(ready.epochRef,ready.steps.slice(0,index+1))
    if(isAuthorHostJournalReadyV5(ready))return {schemaVersion:5,encoding:'native-author-host-association-v5',
      sessionId:step.dispatch.sessionId,realmEpoch:ready.epoch.realmEpoch,batchId:step.dispatch.batchId,
      anchor:step.dispatch.sourceNativeCut.anchor,sourceNativeCutSha256:recordSha256(step.dispatch.sourceNativeCut),
      combinedProgramSha256:ready.epoch.program.combinedProgramSha256,
      serverProgramSha256:ready.epoch.program.serverProgram!.programSha256,epoch:ready.epochRef,
      dispatch:step.dispatchRef,completion:step.completionRef,dispatchMarker:step.dispatchMarker,
      completionMarker:step.completionMarker,serverTailSha256:step.step.stepSha256,
      hostFrontierSha256:frontierSha256,outputSha256:recordSha256(step.step.output)}
    return {schemaVersion:1,encoding:'native-mvu-schema-execution-association-v1',sessionId:step.dispatch.sessionId,
      realmEpoch:ready.epoch.realmEpoch,batchId:step.dispatch.batchId,anchor:step.dispatch.sourceNativeCut.anchor,
      sourceNativeCutSha256:recordSha256(step.dispatch.sourceNativeCut),programSha256:schemaEpochAuthorIdentity(ready.epoch).programSha256,
      dispatch:step.dispatchRef,completion:step.completionRef,dispatchMarker:step.dispatchMarker,
      completionMarker:step.completionMarker,tailSha256:step.step.stepSha256,frontierSha256,
      outputSha256:recordSha256(step.step.output)}
  }
  function eventRows(sid:string,nativeCut:number,
    ledger?:import('./roleplay-mvu-schema-player-types.js').MvuSchemaPlayerLedger) {
    const prefix=`${sid}__mvu-state-schema-`
    const rows=[...prefixInputs.status.entries(prefix)]
      .filter(([key])=>key.startsWith(`${sid}__mvu-state-schema-story-event-`)
        ||key.startsWith(`${sid}__mvu-state-schema-player-event-`)
        ||key.startsWith(`${sid}__mvu-state-schema-revision-event-`))
      .map(([key,row])=>{
        if(key.startsWith(`${sid}__mvu-state-schema-revision-event-`))
          return {key,event:readRevisionEvent(row as RevisionEvent)}
        if(!key.startsWith(`${sid}__mvu-state-schema-player-event-`))
          return {key,event:validateMvuSchemaStoryEvent(row as never)}
        if(!ledger)return {key,event:validateMvuSchemaPlayerEvent(row as never)}
        // The nested InputState ledger read owns these exact Domain rows and
        // their completion join. This synchronous fold consumes its result.
        const playerFacts=ledger.completedByEventKey.get(key)
        if(!playerFacts)fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
        return {key,event:playerFacts.event,playerFacts}
      })
      .filter(item=>item.event.frontier.nativeCut<=nativeCut)
      .sort((a,b)=>a.event.phases[0]!.association.dispatchMarker.seq-b.event.phases[0]!.association.dispatchMarker.seq)
    return rows
  }
  function closedStoryFacts(sid:string,inheritedEventCount:number,events:readonly SessionEvent[],
    event:ReturnType<typeof validateMvuSchemaStoryEvent>,frozen:boolean) {
    if(frozen) {
      const facts=readMvuSchemaInheritedStoryFacts({ownerSessionId:sid,ownerInheritedEventCount:inheritedEventCount,
        events,event},{branch:prefixInputs.branch,status:prefixInputs.status,editProtocol:deps.editProtocol,
        readProjectedCanonical:(prefix,turn)=>{
          const surface=deps.projectPrefix(prefix as never)
          const body=canonicalAssistantForTurn({id:'schema-inherited-prefix',events:prefix as never,
            surface:{nodes:surface.nodes},deriveEventMessage:entry=>surface.projectedMessageAt(entry.seq)},turn)
          const message=body?.data?.message
          return body&&message&&typeof message.id==='string'?{seq:body.seq,messageId:message.id,
            versionSha256:recordSha256(message),narrative:textOf(message.content)}:undefined
        }})
      return {terminal:facts.terminal,event,settlement:facts.settlement}
    }
    const plan=event.plan,scope=plan.scope
    const terminal=readInputCompletion(prefixInputs.branch,sid,scope.currency.preparationId)
    const settlement=validateMvuSchemaStorySettlement(prefixInputs.status.get(mvuSchemaStorySettlementKey(sid,plan.planSha256)) as never,event)
    if(!terminal||terminal.status!=='settled'||terminal.plan.kind!=='schema-numerical'
      ||!same(terminal.scope,scope)||!same(terminal.plan.plan,plan)||!same(terminal.settlement,settlement)
      ||!deps.verifyConsumedScope(scope)||!deps.verifyNative(scope)
      ||!inputSnapshotReferenceCurrent(prefixInputs.branch,sid,scope.currency))fail('SCHEMA_STORY_TERMINAL_UNRESOLVED')
    const canonical=deps.readConsumedCanonical(sid,plan.canonical.seq,scope.receipt.checkpoint.actualTurn,scope.receipt.turnEndSeq)
    if(!canonical||!same(plan.canonical,{...canonical,narrativeSha256:sha256(canonical.narrative)}))fail('SCHEMA_STORY_CANONICAL_UNPROVEN')
    return {terminal,event,settlement}
  }
  type RevisionBases=ReadonlyMap<string,{descriptor:SuffixDescriptor;
    prefix:MvuSchemaFrozenPrefixV1;ready:SchemaJournalReady}>
  function prepareRevisionBases(ownerSid:string,events:readonly SessionEvent[],
    table:Pick<Table,'get'>=prefixInputs.status,subjectSid=ownerSid):RevisionBases {
    const bases=new Map<string,{descriptor:SuffixDescriptor;
      prefix:MvuSchemaFrozenPrefixV1;ready:SchemaJournalReady}>()
    // Native rewind leaves one suffix at this level. Its baseline already
    // folds any retained earlier revision, so recovering older bases here
    // would reconstruct the same history again.
    for(let index=events.length-1;index>=0;index--) {
      const marker=events[index]!
      if(marker.type!==deps.markers.revisionEventType||marker.data.sessionId!==ownerSid)continue
      const descriptor=validateMvuSchemaStoryRevisionDescriptor(table.get(marker.data.descriptor.key) as MvuSchemaStoryRevisionDescriptor)
      if(descriptor.schemaVersion===1||descriptor.sessionId!==ownerSid)continue
      const basis=validateMvuSchemaStoryRevisionBasis(table.get(descriptor.basis.record.key) as never)
      if(recordSha256(descriptor)!==marker.data.descriptor.sha256
        ||recordSha256(basis)!==descriptor.basis.record.sha256||basis.sessionId!==descriptor.sessionId
        ||basis.prefix.prefixSha256!==descriptor.basis.prefixSha256
        ||basis.prefix.snapshot.stateSnapshotSha256!==descriptor.basis.stateSnapshotSha256
        ||basis.prefix.journal.nativeCut!==descriptor.basis.nativeCut
        ||!same(basis.historyBasis,descriptor.basis.historyBasis)
        ||!same(basis.closedRevision,descriptor.basis.closedRevision))fail('SCHEMA_REVISION_BASE_UNPROVEN')
      const recovered=deps.recoverRevisionPrefix?.({subjectSessionId:subjectSid,
        events:events.slice(0,basis.prefix.journal.nativeCut),...basis})
      if(!recovered)fail('SCHEMA_REVISION_BASE_UNPROVEN')
      bases.set(marker.data.descriptor.sha256,{descriptor,...recovered})
      break
    }
    return bases
  }
  function revisionClosureV2(event:SuffixEvent,events:readonly SessionEvent[],
    ready:SchemaJournalReady,bases:RevisionBases,owners:ScopeFacts['owners']) {
    const ref=event.plan.revision.descriptor,selected=bases.get(ref.sha256)
    if(!selected)fail('SCHEMA_REVISION_BASE_UNPROVEN')
    const descriptor=validateMvuSchemaStoryRevisionDescriptor(prefixInputs.status.get(ref.key) as SuffixDescriptor)
    const completion=validateMvuSchemaStoryRevisionCompletion(prefixInputs.status.get(
      mvuSchemaStoryRevisionCompletionKey(event.sessionId,ref.sha256)) as MvuSchemaStoryRevisionCompletionV2|MvuSchemaStoryRevisionCompletionV3|MvuSchemaStoryRevisionCompletionV4)
    const marker=ready.frozen.schemaVersion===2&&ready.frozen.revisions.find(row=>
      row.descriptor.key===ref.key&&row.descriptor.sha256===ref.sha256)
    if(completion.schemaVersion!==descriptor.schemaVersion||!same(descriptor,selected.descriptor)||!same(completion.descriptor,ref)
      ||completion.sessionId!==event.sessionId||completion.events.length!==descriptor.originals.length
      ||!marker||marker.editSeq!==descriptor.edits.at(-1)!.seq
      ||marker.completionSeq!==descriptor.completionSeq)fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
    const projection=deps.projectPrefix(events.slice(0,descriptor.edits.at(-1)!.seq+1) as never)
    for(const edit of descriptor.edits) {
      const raw=events[edit.seq],target=events[edit.targetSeq]
      const expectedRole='role' in edit?edit.role:'assistant'
      if(raw?.type!=='roleplay/message-edit'||recordSha256(raw)!==edit.sha256||raw.data.targetSeq!==edit.targetSeq
        ||raw.data.role!==expectedRole||(expectedRole==='assistant'
          ?target?.type!=='assistant/message'||target.data.message.id!==edit.messageId
          :target?.type!=='user/message'||target.data.id!==edit.messageId))fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
    }
    const originalEntries=suffixOriginals(descriptor)
    const originals=originalEntries.map(entry=>{
      const originalRef=entry.event,raw=prefixInputs.status.get(originalRef.key)
      const originalEvent=entry.kind==='manual'?validateMvuSchemaPlayerEvent(raw as MvuSchemaPlayerEventV1)
        :validateMvuSchemaStoryEvent(raw as OriginalStoryEvent)
      if(recordSha256(originalEvent)!==originalRef.sha256)fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
      const owner=originalEvent.sessionId,range=owners.find(row=>row.sessionId===owner)
      if(!range)fail('SCHEMA_SCOPE_MESSAGE_OWNER_UNPROVEN')
      if(originalEvent.encoding==='native-mvu-schema-player-event-v1') {
        return joinMvuSchemaPlayerCompletedEvent(prefixInputs.branch,prefixInputs.status,originalEvent,
          events.slice(0,originalEvent.frontier.nativeCut))
      }
      return closedStoryFacts(owner,range.fromSeq,events.slice(0,originalEvent.frontier.nativeCut),originalEvent,true)
    })
    let base=selected.prefix.snapshot
    const revised=completion.events.map((eventRef,index)=>{
      const item=readRevisionEvent(prefixInputs.status.get(eventRef.key) as RevisionEvent)
      const original=originals[index]!.event
      if(!isSuffixEvent(item)||recordSha256(item)!==eventRef.sha256
        ||eventRef.key!==mvuSchemaStoryRevisionEventKey(item.sessionId,item.eventId)
        ||!same(item.plan.revision.descriptor,ref)||item.plan.revision.index!==index
        ||item.plan.revision.publicationRevision!==descriptor.publicationRevision+index
        ||item.plan.logicalNativeCut!==original.plan.initialCut.nativeCut
        ||!same(item.plan.base,base)||item.sessionId!==descriptor.sessionId
        ||item.sourceSha256!==descriptor.sourceSha256)fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
      if(isManualRevision(item)) {
        if(original.encoding!=='native-mvu-schema-player-event-v1'
          ||!same(item.plan.original,originalEntries[index]!.event)
          ||!same(item.plan.operation,original.plan.operation)||!same(item.plan.marker,original.plan.marker)
          ||item.plan.clockEpochMs!==original.plan.clockEpochMs)fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
      }else {
        if(original.encoding==='native-mvu-schema-player-event-v1'||item.outcome==='refused')
          fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
        const target=events[original.plan.canonical.seq]
        if(target?.type!=='assistant/message')fail('SCHEMA_REVISION_CANONICAL_UNPROVEN')
        const message=projection.projectedMessageAt(target.seq)??target.data.message
        const canonical={seq:target.seq,messageId:original.plan.canonical.messageId,versionSha256:recordSha256(message),
          narrative:textOf(message.content),narrativeSha256:sha256(textOf(message.content))}
        if(!same(item.plan.scope,original.plan.scope)||!same(item.plan.canonical,canonical))
          fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
        if(item.plan.schemaVersion===11) {
          if(descriptor.schemaVersion!==4)fail('SCHEMA_TASK_EDIT_INTENT_UNPROVEN')
          const selected=descriptor.taskEdits.find(row=>row.index===index)?.selection
          if(!selected||!same(selected,item.plan.taskEdit))fail('SCHEMA_TASK_EDIT_INTENT_UNPROVEN')
          const intent=validateSchemaTaskEditIntentV1(prefixInputs.status.get(selected.intent.key) as SchemaTaskEditIntentV1),
            binding=validateSchemaTaskEditBindingV1(prefixInputs.status.get(selected.binding.key) as SchemaTaskEditBindingV1),
            operation=intent.artifacts.find(row=>row.canonicalSeq===canonical.seq),edit=events[binding.edit.seq]
          if(recordSha256(intent)!==selected.intent.sha256||recordSha256(binding)!==selected.binding.sha256
            ||!same(binding.intent,selected.intent)||binding.sessionId!==descriptor.sessionId
            ||!operation||!same(operation.artifact,{canonicalSeq:selected.canonicalSeq,
              originEventRef:selected.originEventRef,sourceEventRef:selected.sourceEventRef,effectiveKind:selected.effectiveKind})
            ||operation.mode!==selected.mode
            ||binding.edit.seq!==intent.basis.nativeCut||edit?.type!=='roleplay/message-edit'
            ||recordSha256(edit)!==binding.edit.sha256||edit.data.text!==intent.target.text
            ||edit.data.targetSeq!==intent.target.seq||edit.data.role!==intent.target.role
            ||!descriptor.edits.some(row=>row.seq===edit.seq&&row.sha256===binding.edit.sha256)
            ||!same(selected.originEventRef,originalEntries[index]!.event))fail('SCHEMA_TASK_EDIT_INTENT_UNPROVEN')
          const sourceRaw=prefixInputs.status.get(selected.sourceEventRef.key) as HistoricalEvent
          const sourceEvent=sourceRaw?.encoding==='native-mvu-schema-story-event-v2'
            ?validateMvuSchemaStoryEvent(sourceRaw):validateMvuSchemaStoryRevisionEvent(sourceRaw as MvuSchemaStoryRevisionEvent)
          if(recordSha256(sourceEvent)!==selected.sourceEventRef.sha256||sourceEvent.frontier.nativeCut>intent.basis.nativeCut
            ||sourceEvent.outcome==='refused'||sourceEvent.plan.canonical.seq!==selected.canonicalSeq
            ||selected.mode==='retain'&&!same(item.plan.candidate,sourceEvent.plan.candidate)
            ||(sourceEvent.plan.schemaVersion===10?!same(selected.originEventRef,selected.sourceEventRef)
              ||sourceEvent.plan.maintenance.kind!=='task-result'
              :sourceEvent.plan.schemaVersion!==11||!same(sourceEvent.plan.taskEdit.originEventRef,selected.originEventRef)))
            fail('SCHEMA_TASK_EDIT_ARTIFACT_UNPROVEN')
          const sourcePlan=sourceEvent.plan,kind=sourcePlan.schemaVersion===11&&sourcePlan.taskEdit.mode==='clear'?'cleared'
            :sourcePlan.schemaVersion===11&&sourcePlan.taskEdit.mode==='retain'?sourcePlan.taskEdit.effectiveKind
            :sourcePlan.candidate.kind==='parsed'?'patch':'unchanged'
          if(selected.effectiveKind!==kind)fail('SCHEMA_TASK_EDIT_ARTIFACT_UNPROVEN')
          for(const phase of sourceEvent.phases)if(recordSha256(events[phase.association.dispatchMarker.seq])!==phase.association.dispatchMarker.sha256
            ||recordSha256(events[phase.association.completionMarker.seq])!==phase.association.completionMarker.sha256)
            fail('SCHEMA_TASK_EDIT_ARTIFACT_UNPROVEN')
        }else if(original.outcome!=='refused'&&original.plan.schemaVersion===10&&original.plan.maintenance.kind==='task-result') {
          fail('SCHEMA_MAINTENANCE_REVISION_REQUIRED')
        }
      }
      const head=suffixHead(item)
      base=snapshot({schemaVersion:2,encoding:'native-mvu-schema-state-snapshot-v2',sessionId:item.sessionId,
        sourceSha256:item.sourceSha256,root:item.plan.execution.root,currentHead:head,revision:head.revision,
        headSha256:recordSha256(head),values:item.values,valuesSha256:item.valuesSha256,
        context:item.context,schemaFrontier:item.frontier})
      return item
    })
    if(!same(revised[event.plan.revision.index],event))fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
    return {descriptor,completion,originals,events:revised,projection}
  }
  function consume(sid:string,inheritedEventCount:number,events:readonly SessionEvent[],ready:SchemaJournalReady,
    initial:MvuSchemaNumericalSnapshotV2,ordinal:number,frozen=false,scopeSeed?:ScopeFacts,original?:SchemaFrozenOriginal,
    readOnlyTail=false,includeDisplay=false,displaySeed?:readonly MvuAcceptedDisplayUpdate[],
    ledger?:import('./roleplay-mvu-schema-player-types.js').MvuSchemaPlayerLedger,
    reconcileOriginalPlanSha256?:string|ReadonlySet<string>,
    revisionBases:RevisionBases=new Map(),resolvedSeed?:ReadonlySet<number>,lastTaskResultSeed?:number,
    artifactSeed?:ReadonlyMap<number,SchemaTaskArtifactV1>) {
    type ConsumedEventRow=ReturnType<typeof eventRows>[number]&{
      playerFacts?:ReturnType<typeof joinMvuSchemaPlayerCompletedEvent>}
    const reset=[...revisionBases.values()].at(-1)
    const restored=reset&&recoveredPrefixes.get(reset.ready)
    if(reset&&!restored)fail('SCHEMA_REVISION_BASE_UNPROVEN')
    if(reset) {
      // Keep the frozen prefix's original seed/initial intact. Only this
      // numerical fold moves to the explicit revision baseline.
      prefixInputs.status.get(reset.descriptor.basis.record.key)
      ordinal=reset.ready.steps.length
      if(restored!.scopes)scopeSeed={...restored!.scopes,owners:scopeSeed?.owners??restored!.scopes.owners}
    }
    const inventory:ConsumedEventRow[]=eventRows(sid,events.length,ledger)
      .filter(row=>!reset||row.event.frontier.nativeCut>reset.prefix.journal.nativeCut)
    let root=reset?.prefix.snapshot.root??initial.root
    const consumed=new Map<string,string>(reset?.prefix.consumed.map(row=>[row.planSha256,row.closureSha256]))
    // A frozen prefix indexes every consumed closure, including an original
    // Story whose immutable terminal remains required after revision rewind.
    const eventKeys:string[]=[...reset?.prefix.eventKeys??[]]
    let lastTaskResultCanonicalSeq=restored?.lastTaskResultCanonicalSeq??lastTaskResultSeed
    const taskArtifacts=new Map(restored?.taskArtifacts??artifactSeed)
    const effectiveBatches=new Set(ready.steps.map(step=>step.dispatch.batchId))
    const resolvedEdits=new Set<number>(reset?restored?.resolvedEdits:resolvedSeed)
    const supersededBatches=frozen&&ready.frozen.schemaVersion===2
      ?new Set(ready.frozen.revisions.flatMap(revision=>revision.superseded.map(pair=>pair.batchId))):undefined
    const closedStories=new Map<string,ReturnType<typeof closedStoryFacts>>()
    const revisionClosures=new Map<string,ReturnType<typeof revisionClosureV2>>()
    const revisionClosure=(event:SuffixEvent)=>{
      const id=event.plan.revision.descriptor.sha256
      let closure=revisionClosures.get(id)
      if(!closure) {
        if(!scopeSeed)fail('SCHEMA_SCOPE_HISTORY_UNPROVEN')
        closure=revisionClosureV2(event,events,ready,revisionBases,scopeSeed.owners)
        revisionClosures.set(id,closure)
      }
      return closure
    }
    const closedStory=(event:ReturnType<typeof validateMvuSchemaStoryEvent>)=>{
      let facts=closedStories.get(event.plan.planSha256)
      if(!facts) {
        // A revised Story retains its immutable completion closure. Prove that
        // closure at its own completed prefix; the revision's edited canonical
        // remains bound to the full current prefix below.
        // Only the last-Story edit owner may recover its original closure
        // before a malformed saved edit has produced any revision marker.
        // Ordinary historical/fork readers still consume the full prefix.
        const closureEvents=supersededBatches?.has(event.phases[0]!.association.batchId)
          ||event.plan.planSha256===reconcileOriginalPlanSha256
          ||typeof reconcileOriginalPlanSha256!=='string'&&reconcileOriginalPlanSha256?.has(event.plan.planSha256)
          ?events.slice(0,event.frontier.nativeCut):events
        facts=closedStoryFacts(sid,inheritedEventCount,closureEvents,event,frozen)
        closedStories.set(event.plan.planSha256,facts)
      }
      return facts
    }
    const rows:typeof inventory=[],partial:typeof inventory=[]
    for(const row of inventory) {
      const event=row.event
      if(event.encoding==='native-mvu-schema-story-event-v2'&&event.plan.schemaVersion===10
        &&event.outcome!=='refused'&&event.plan.maintenance.kind==='task-result') {
        lastTaskResultCanonicalSeq=Math.max(lastTaskResultCanonicalSeq??-1,event.plan.canonical.seq)
      }
      if(!effectiveBatches.has(event.phases[0]!.association.batchId)) {
        if(event.encoding==='native-mvu-schema-story-event-v2') {
          consumed.set(event.plan.planSha256,recordSha256(closedStory(event)))
          eventKeys.push(row.key)
        }
        continue
      }
      if(readOnlyTail) {
        const closed=event.encoding==='native-mvu-schema-story-revision-event-v1'||isSuffixEvent(event)?true:
          event.encoding==='native-mvu-schema-player-event-v1'
          ?prefixInputs.branch.get(mvuSchemaPlayerCompletionKey(sid,event.plan.operation.operationId))!==undefined
          :readInputCompletion(prefixInputs.branch,sid,event.plan.scope.currency.preparationId)?.status==='settled'
        if(!closed) {partial.push(row);continue}
      }
      if(partial.length)fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN')
      rows.push(row)
    }
    let state=reset?.prefix.snapshot??initial
    let chat=scopeSeed?.chat
    const messageStates=scopeSeed?new Map(scopeSeed.messages):undefined
    const displayUpdates=includeDisplay?[] as MvuAcceptedDisplayUpdate[]:undefined
    const playerFacts=(row:ConsumedEventRow)=>{
      if(row.event.encoding!=='native-mvu-schema-player-event-v1')fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
      // Keep the parsed event and its closure only in this synchronous fold.
      // Future cuts and partial tails were filtered before any closure join.
      return row.playerFacts??=joinMvuSchemaPlayerCompletedEvent(prefixInputs.branch,prefixInputs.status,row.event,events)
    }
    for(const event of events)if(event.type==='roleplay/mvu-manual-edit'
      &&event.seq>=Math.max(inheritedEventCount,reset?.prefix.journal.nativeCut??0)&&event.data.sessionId===sid) {
      const operation=prefixInputs.branch.get(mvuSchemaPlayerOperationKey(sid,event.data.operationId))
      if(operation===undefined)fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
      if(frozen&&!readOnlyTail) {
        const row=inventory.find(row=>row.event.encoding==='native-mvu-schema-player-event-v1'
          &&row.event.plan.operation.operationId===event.data.operationId)
        if(!row)fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
        playerFacts(row)
      }
    }
    for(const row of rows) {
      const {key,event}=row
      const plan=event.plan,base='operation' in plan&&plan.schemaVersion!==9?plan.operation.base:plan.base
      // Accepted plans retain their parsed frame DATA and journal/closure bindings.
      // Current Source belongs to captureFrame; do not rebuild each historical Source.
      const eventKey=event.encoding==='native-mvu-schema-player-event-v1'
        ?mvuSchemaPlayerEventKey(sid,event.eventId):event.encoding==='native-mvu-schema-story-revision-event-v1'||isSuffixEvent(event)
          ?mvuSchemaStoryRevisionEventKey(sid,event.eventId):mvuSchemaStoryEventKey(sid,event.eventId)
      if(key!==eventKey||!same(base.root,root)
        ||!same(base,snapshot({...state,sourceSha256:base.sourceSha256})))fail('SCHEMA_STORY_BASE_CHAIN_INVALID')
      let closure:unknown
      if(event.encoding==='native-mvu-schema-player-event-v1') {
        const facts=playerFacts(row)
        closure={operation:facts.operation,plan:facts.plan,event,settlement:facts.settlement,completion:facts.completion}
      } else if(isSuffixEvent(event)) {
        closure=revisionClosure(event)
        for(const edit of (closure as ReturnType<typeof revisionClosureV2>).descriptor.edits)
          if(isManualRevision(event)?edit.targetSeq<event.plan.logicalNativeCut:edit.targetSeq<=event.plan.canonical.seq)
            resolvedEdits.add(edit.seq)
      } else if(event.encoding==='native-mvu-schema-story-revision-event-v1') {
        const ref=event.plan.revision.descriptor
        const descriptor=validateMvuSchemaStoryRevisionDescriptor(prefixInputs.status.get(ref.key) as never)
        const marker=ready.frozen.schemaVersion===2&&ready.frozen.revisions.find(revision=>
          revision.descriptor.key===ref.key&&revision.descriptor.sha256===ref.sha256)
        const edit=events[descriptor.edit.seq],target=events[descriptor.edit.targetSeq]
        const originalEvent=validateMvuSchemaStoryEvent(prefixInputs.status.get(descriptor.original.key) as never)
        if(!marker||recordSha256(descriptor)!==ref.sha256||recordSha256(originalEvent)!==descriptor.original.sha256
          ||marker.editSeq!==descriptor.edit.seq||marker.completionSeq!==descriptor.completionSeq
          ||edit?.type!=='roleplay/message-edit'||recordSha256(edit)!==descriptor.edit.sha256
          ||edit.data.targetSeq!==descriptor.edit.targetSeq||target?.type!=='assistant/message'
          ||originalEvent.plan.canonical.seq!==descriptor.edit.targetSeq
          ||!same(event.plan.scope,originalEvent.plan.scope)||!same(event.plan.base,originalEvent.plan.base)
          ||descriptor.baseStateSnapshotSha256!==base.stateSnapshotSha256
          ||descriptor.sourceSha256!==base.sourceSha256
          ||descriptor.publicationRevision!==event.plan.revision.publicationRevision
          ||event.plan.initialCut.nativeCut!==marker.marker.seq+1)fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
        const message=deps.editProtocol.editMessageText(target.data.message,edit.data)
        const canonical={seq:target.seq,messageId:message.id,versionSha256:recordSha256(message),
          narrative:textOf(message.content),narrativeSha256:sha256(textOf(message.content))}
        if(!same(event.plan.canonical,canonical))fail('SCHEMA_REVISION_CANONICAL_UNPROVEN')
        closure={original:closedStory(originalEvent),descriptor,event}
        if(event.outcome!=='refused')resolvedEdits.add(descriptor.edit.seq)
      } else {
        closure=closedStory(event)
      }
      for(const phase of event.phases) {
        const actualAssociation=associationAt(sid,events,ready,ordinal),step=ready.steps[ordinal++]!,association=phase.association
        if(!step||!same(step.dispatchRef,association.dispatch)||!same(step.completionRef,association.completion)
          ||!same(actualAssociation,association)
          ||!same(step.dispatchMarker,association.dispatchMarker)||!same(step.completionMarker,association.completionMarker)
          ||step.dispatch.batchId!==association.batchId||!same(step.dispatch.sourceNativeCut.anchor,association.anchor)
          ||recordSha256(step.dispatch.sourceNativeCut)!==association.sourceNativeCutSha256
          ||!same(step.step.frame.input,phase.input)||!same(step.step.output,phase.output)
          // Plan parsing checks the frozen frame; Journal's dispatch parser
          // joins its exact material and snapshot hashes to this Native cut.
          ||step.dispatch.sourceNativeCut.sourceSnapshotSha256!==plan.currentFrame.snapshotSha256
          ||step.dispatch.sourceNativeCut.materialSha256!==plan.currentFrame.materialSha256)fail('SCHEMA_STORY_JOURNAL_UNPROVEN')
        if(step.step.frame.input.schemaVersion===3||step.step.frame.input.schemaVersion===4) {
          if(!scopeSeed||!chat||!messageStates||!original)fail('SCHEMA_SCOPE_HISTORY_UNPROVEN')
          const revised=isSuffixEvent(event)?revisionClosure(event):undefined
          const expected=scopeFrameAt({...scopeSeed,chat,messages:messageStates},original,plan.currentFrame,
            step.dispatch.sourceNativeCut,events,plan.schemaVersion===8||plan.schemaVersion===9||plan.schemaVersion===11?plan.logicalNativeCut:undefined,
            revised?.projection)
          if(!same(step.step.frame.input.scopeReadFrame,expected))fail('SCHEMA_SCOPE_HISTORY_UNPROVEN')
        }
      }
      let head:MvuSchemaNumericalSnapshotV2['currentHead']
      if(isManualRevision(event))head=mvuSchemaPlayerRevisionHead(event)
      else if(event.encoding==='native-mvu-schema-player-event-v1')head=mvuSchemaPlayerHead(event)
      else if(event.encoding==='native-mvu-schema-story-revision-event-v1'
        ||event.encoding==='native-mvu-schema-story-revision-event-v2') {
        head=event.outcome==='refused'?event.plan.base.currentHead:mvuSchemaStoryRevisionHead(event)
      }else head=mvuSchemaStoryHead(event)
      if(isSuffixEvent(event))root=event.plan.execution.root
      state=snapshot({schemaVersion:2,encoding:'native-mvu-schema-state-snapshot-v2',sessionId:sid,
        sourceSha256:base.sourceSha256,root,currentHead:head,revision:head.revision,headSha256:recordSha256(head),
        values:event.values,valuesSha256:event.valuesSha256,context:event.context,schemaFrontier:event.frontier})
      if(scopeSeed&&messageStates&&(event.outcome!=='refused'
        ||isManualRevision(event)&&manualChatAtBase(chat!,event.plan.base))) {
        const source=schemaScopeSource(plan.currentFrame.snapshot)
        const manual=isManualEvent(event)
        const stateRef={kind:manual?'manual' as const:'story' as const,ownerSessionId:sid,
          recordKey:key,recordSha256:recordSha256(event),valuesSha256:event.valuesSha256,revision:state.revision}
        if(manual||scopeSeed.updateChat)chat=schemaScopePublished(schemaScopeOwner(source,'chat'),stateRef,event.values,event.context)
        if(!isManualEvent(event)) {
          const canonical=event.plan.canonical
          const messageOwner=scopeOwnerForSeq(scopeSeed,canonical.seq)
          const variables=schemaScopePublished(schemaScopeOwner(source,'message',canonical.messageId,sid),stateRef,event.values,event.context)
          messageStates.set(schemaScopeMessageKey(messageOwner,canonical.seq,canonical.messageId,canonical.versionSha256),variables)
        }
      }
      consumed.set(plan.planSha256,recordSha256(closure))
      eventKeys.push(key)
      if(!isManualEvent(event)&&event.outcome!=='refused') {
        const p=event.plan,ref={key,sha256:recordSha256(event)}
        if(p.schemaVersion===10&&p.maintenance.kind==='task-result') {
          taskArtifacts.set(p.canonical.seq,{canonicalSeq:p.canonical.seq,originEventRef:ref,sourceEventRef:ref,
            effectiveKind:p.candidate.kind==='parsed'?'patch':'unchanged'})
        }else if(p.schemaVersion===11) {
          taskArtifacts.set(p.canonical.seq,{canonicalSeq:p.canonical.seq,originEventRef:p.taskEdit.originEventRef,sourceEventRef:ref,
            effectiveKind:p.taskEdit.mode==='clear'?'cleared':p.taskEdit.mode==='retain'
              ?p.taskEdit.effectiveKind:p.candidate.kind==='parsed'?'patch':'unchanged'})
        }
      }
      if(displayUpdates&&!isManualEvent(event)
        &&event.outcome!=='refused'&&event.plan.candidate.kind==='parsed') {
        const item=acceptedMvuDisplayUpdate(sid,event.plan.canonical,event.plan.candidate.protocol)
        if(item)displayUpdates.push(item)
      }
    }
    if(!readOnlyTail&&(ordinal!==ready.steps.length||!same(state.schemaFrontier,frontier(ready)))) {
      fail('SCHEMA_STORY_HISTORY_UNSETTLED')
    }
    if(readOnlyTail&&partial.length&&ordinal===ready.steps.length)fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN')
    const readScopes=scopeSeed&&chat&&messageStates?{...scopeSeed,chat,messages:messageStates}:undefined
    return {state,consumed,eventKeys,readScopes,ordinal,resolvedEdits,lastTaskResultCanonicalSeq,taskArtifacts,
      displayUpdates:displayUpdates?formatMvuDisplayUpdates([...(restored?.displayUpdates??displaySeed??[]),...displayUpdates]):undefined}
  }
  function readyFor(sid:string,realmEpoch:string,events:readonly SessionEvent[],
    inherited:SchemaJournalReady|null,historical=false):SchemaJournalReady {
    // Derived recovery already owns inherited DATA. Journal reads the actual
    // local rows and joins both sets to this current/historical Native cut.
    const ready=journal.captureChecked(sid,realmEpoch,events,inherited,historical)
    if(ready.kind!=='ready')fail(ready.code)
    return ready
  }
  function derivedOriginal(original:SchemaFrozenOriginal,ready:SchemaJournalReady,
    events:readonly SessionEvent[]):SchemaFrozenOriginal {
    if(original.schemaVersion!==5)return original
    const recovered=recoveredPrefixes.get(ready)
    if(recovered)return recovered.original
    const retained=sourceOriginals.get(original.originalSha256)
    if(retained)return retained
    const initialization=ready.steps.find(step=>step.dispatch.sessionId===original.sessionId
      &&step.dispatch.batchId===original.preparation.selector.batchId)
    if(!initialization)fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN')
    const cut=events.slice(0,initialization.completionMarker.seq+1)
    const opening=journal.recutChecked(original.sessionId,original.realmEpoch,cut,ready)
    if(opening.kind!=='ready')fail(opening.code)
    const captured=deps.source.readFrozenOriginal(original.preparation,opening,cut)
    if(!same(captured,original))fail('SCHEMA_ORIGINAL_PROGRAM_UNPROVEN')
    sourceOriginals.set(original.originalSha256,captured)
    return captured
  }
  function initialForOpening(seed:Extract<MvuSchemaPrefixSeed,{kind:'opening'}>,sourceSha256:string,
    original:SchemaFrozenOriginal,ready:SchemaJournalReady,events:readonly SessionEvent[]) {
    const {event:opening,head:head,intent}=seed,sid=intent.sessionId,index=openingPhaseCount(opening.plan)-1
    const final=ready.steps[index]!
    if(!verifyMvuSchemaOpeningFacts(intent,opening,head)||final.step.output.kind!=='accepted'
      ||!same(final.step.output.values,opening.plan.values)
      ||!same(associationAt(sid,events,ready,index),opening.plan.execution))fail('SCHEMA_OPENING_JOURNAL_UNPROVEN')
    const root={openingEventId:opening.eventId,openingEventSha256:opening.eventSha256,openingHeadSha256:recordSha256(head),
      openingPlanSha256:opening.plan.planSha256,realmEpoch:original.realmEpoch,programSha256:schemaOriginalProgramSha256(original)}
    return snapshot({schemaVersion:2,encoding:'native-mvu-schema-state-snapshot-v2',sessionId:sid,sourceSha256,
      root,currentHead:head,revision:1,headSha256:recordSha256(head),values:opening.plan.values,valuesSha256:opening.valuesSha256,
      context:final.step.output.context,schemaFrontier:{nativeCut:final.completionMarker.seq+1,
        tailSha256:final.step.stepSha256,frontierSha256:schemaExecutionHostFrontierSha256(opening.plan.execution)}})
  }
  function factual(session:Session,nativeCut=all(session).length,historical=false,includeDisplay=false,
    captureBasis=false,reconcileOriginalPlanSha256?:string|ReadonlySet<string>,revisionBases?:RevisionBases):History {
    const sid=session.id,events=all(session).slice(0,nativeCut),sourceSha256=deps.sourceSha256(sid)
    revisionBases??=prepareRevisionBases(sid,events)
    const ledger=historical?undefined:deps.captureManualLedger?.(sid)
    const manualBlock=historical?undefined:ledger?ledger.code:deps.manualPendingCode?.(sid)
    if(manualBlock&&!historical)fail(manualBlock)
    let original:SchemaFrozenOriginal,initial:MvuSchemaNumericalSnapshotV2,seed:MvuSchemaPrefixSeed
    let scopeSeed:ScopeFacts|undefined
    let displaySeed:readonly MvuAcceptedDisplayUpdate[]|undefined
    let ready:SchemaJournalReady,inheritedCut:SchemaJournalFrozenCut|null=null,ordinal=1
    let inheritedReady:SchemaJournalReady|undefined
    if(deps.derivedRequired?.(sid)||session.inheritedEventCount||session.header.parentSession) {
      const genesis=deps.readDerivedGenesis?.(sid)
      if(!genesis||genesis.inheritedCut.nativeCut!==session.inheritedEventCount)fail('SCHEMA_DERIVED_GENESIS_UNPROVEN')
      original=genesis.original
      const inherited=genesis.inheritedReady??journal.validateFrozenReady(genesis.inheritedCut,
        events.slice(0,genesis.inheritedCut.nativeCut))
      inheritedReady=inherited;inheritedCut=genesis.inheritedCut
      ready=readyFor(sid,original.realmEpoch,events,inherited,historical)
      original=derivedOriginal(original,inherited,events.slice(0,inheritedCut.nativeCut))
      ordinal=inherited.steps.length
      initial=snapshot({...genesis.snapshot,sourceSha256})
      seed={kind:'derived',basisKey:genesis.basisKey,basisSha256:genesis.basisSha256}
      scopeSeed=scopesForDerived(genesis,events)
      if(includeDisplay)displaySeed=displayForDerived(genesis,events)
    }else {
      const pointer=deps.activePointer(sid) as {importId?:string}|undefined
      if(!pointer?.importId)fail('SCHEMA_STORY_ROOT_REQUIRED')
      const intent=validateMvuSchemaOpeningIntent(prefixInputs.branch.get(openingIntentKey(sid,pointer.importId)) as never)
      if(intent.status!=='completed'||!intent.initialization)fail('SCHEMA_OPENING_NOT_COMPLETED')
      const storedHead=prefixInputs.status.get(mvuInitializationHeadKey(sid))
      if(storedHead===undefined)fail('HEAD_MISSING')
      const head=validateMvuSchemaOpeningHead(storedHead as never)
      const opening=validateMvuSchemaOpeningEvent(prefixInputs.status.get(mvuInitializationEventKey(sid,head.eventId)) as never)
      if(!verifyMvuSchemaInheritedOpeningFacts({intent,event:opening,head,events},
        {projectPrefix:deps.projectPrefix}))fail('SCHEMA_OPENING_RECORD_INVALID')
      if(historical) {
        // Frozen caller/history selection retains its existing merge, full
        // validation and failure contract; it is not owned current capture.
        ready=readyFor(sid,intent.preparation.realmEpoch,events,null,true)
        original=deps.source.readFrozenOriginal(intent.preparation,ready,events)
      }else {
        const captured=deps.source.captureCurrentOriginal(intent.preparation,{sessionId:sid,table:prefixInputs.status,events})
        ready=captured.ready;original=captured.original
      }
      if(original.schemaVersion===5)sourceOriginals.set(original.originalSha256,original)
      seed={kind:'opening',intent,event:opening,head}
      ordinal=openingPhaseCount(opening.plan)
      initial=initialForOpening(seed,sourceSha256,original,ready,events)
      scopeSeed=scopesForOpening(seed,original,ready,events)
    }
    const editBasis={root:initial.root,editFloorSeq:seed.kind==='opening'
      ?seed.event.native.turnEndSeq+1:inheritedCut!.nativeCut}
    const priorBasis=capturingEditBasis
    let edited:MvuEditInvalidation|false|undefined
    try {
      if(captureBasis)capturingEditBasis={sid,basis:editBasis}
      edited=!historical&&deps.readEditInvalidation?.(sid)
    }finally {capturingEditBasis=priorBasis}
    if(edited&&edited.kind==='unknown')fail(edited.code)
    const result=consume(sid,session.inheritedEventCount,events,ready,initial,ordinal,historical,scopeSeed,original,
      false,includeDisplay,displaySeed,ledger,reconcileOriginalPlanSha256,revisionBases,
      inheritedReady?recoveredPrefixes.get(inheritedReady)?.resolvedEdits:undefined,
      inheritedReady?recoveredPrefixes.get(inheritedReady)?.lastTaskResultCanonicalSeq:undefined,
      inheritedReady?recoveredPrefixes.get(inheritedReady)?.taskArtifacts:undefined)
    if(edited&&edited.kind==='invalidated'&&deps.currentEdits(session)
      .some(edit=>edit.seq>=editBasis.editFloorSeq&&!result.resolvedEdits.has(edit.seq)))fail(edited.code)
    let state=result.state
    if(!historical) {
      const actualHead=prefixInputs.status.get(mvuStateCurrentHeadKey(sid))
      if(isMvuSchemaGenesisHead(state.currentHead)?actualHead!==undefined:!same(actualHead,state.currentHead)) {
        fail('SCHEMA_STORY_HEAD_UNPROVEN')
      }
    }
    state=snapshot({...state,sourceSha256})
    const commandDiagnostics:MvuDiscardedCommandObservation[]=ready.steps.flatMap(step=>{
      const output=step.step.output
      if(!('schemaVersion' in output)||output.schemaVersion!==4||output.kind!=='accepted'
        ||output.errorPolicy!=='registered-command-policy-v1')return []
      return output.discarded.map(row=>({source:step.dispatch.sourceNativeCut.anchor.kind==='opening'
        ?'opening' as const:'story' as const,nativeSeq:step.completionMarker.seq,
        commandIndex:row.commandIndex,code:row.code,...'pointer' in row?{pointer:row.pointer}:{}}))
    })
    const history={original,ready,snapshot:state,consumed:result.consumed,initial,seed,inheritedCut,eventKeys:result.eventKeys,
      readScopes:result.readScopes,
      lastTaskResultCanonicalSeq:result.lastTaskResultCanonicalSeq,
      taskArtifacts:result.taskArtifacts,
      displayUpdates:result.displayUpdates,commandDiagnostics,resolvedEdits:result.resolvedEdits,editBasis}
    if(inheritedReady)Object.defineProperty(history,'inheritedReady',{value:inheritedReady})
    return history
  }
  function foldForkPrefix(input:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
    genesis?:MvuSchemaDerivedGenesis,recut=false,revisionBases:RevisionBases=new Map())
    :{prefix:MvuSchemaFrozenPrefixV1;ready:SchemaJournalReady}|undefined {
    try {
      let prefix=validateMvuSchemaFrozenPrefix(input)
      const sid=prefix.sessionId
      if(recut?events.length>prefix.journal.nativeCut||events.length<=prefix.inheritedEventCount
        :events.length!==prefix.journal.nativeCut)return undefined
      // The old journal is a DATA container, not a claim that the descendant
      // retains its later Native cut. Fold its rows against the actual cut.
      const revisions=recut&&prefix.seed.kind==='opening'&&prefix.journal.schemaVersion===2
        ?new Map(prefix.journal.revisions.map(revision=>[revision.descriptor.key,revision.descriptor.value] as const)):undefined
      const selected=recut&&prefix.seed.kind==='opening'
        ?journal.captureFrozen(sid,prefix.original.realmEpoch,events,prefix.journal.records,ref=>revisions?.get(ref.key)):undefined
      if(selected&&selected.kind!=='ready')return undefined
      let ready:SchemaJournalReady,checkedOriginal:SchemaFrozenOriginal
      let initial:MvuSchemaNumericalSnapshotV2,ordinal=1
      let scopeSeed:ScopeFacts|undefined
      let displaySeed:readonly MvuAcceptedDisplayUpdate[]|undefined
      let resolvedSeed:ReadonlySet<number>|undefined
      let lastTaskResultSeed:number|undefined
      if(prefix.seed.kind==='opening') {
        const seed=prefix.seed
        if(!same(prefixInputs.branch.get(openingIntentKey(sid,seed.intent.source.importId)),seed.intent)
          ||!same(prefixInputs.status.get(mvuInitializationEventKey(sid,seed.event.eventId)),seed.event)
          ||!same(prefixInputs.status.get(mvuInitializationHeadKey(sid)),seed.head)
          ||!verifyMvuSchemaInheritedOpeningFacts({intent:seed.intent,event:seed.event,head:seed.head,events},
            {projectPrefix:deps.projectPrefix}))return undefined
        const recovered=selected?.kind==='ready'
          ?{ready:selected,original:deps.source.readFrozenOriginal(seed.intent.preparation,selected,events)}
          :deps.source.recoverFrozenOriginal(seed.intent.preparation,prefix.journal,events)
        ready=recovered.ready
        const original=recovered.original
        checkedOriginal=original
        if(ready.frozen.sessionId!==sid||ready.frozen.realmEpoch!==prefix.original.realmEpoch)return undefined
        if(!same(original,prefix.original))return undefined
        ordinal=openingPhaseCount(seed.event.plan)
        initial=initialForOpening(seed,prefix.sourceSha256,original,ready,events)
        scopeSeed=scopesForOpening(seed,original,ready,events)
      }else {
        if(!genesis||genesis.sessionId!==sid||genesis.basisKey!==prefix.seed.basisKey
          ||genesis.basisSha256!==prefix.seed.basisSha256||!same(genesis.original,prefix.original)
          ||genesis.inheritedCut.nativeCut!==prefix.inheritedEventCount)return undefined
        const prior=genesis.inheritedReady??journal.validateFrozenReady(genesis.inheritedCut,
          events.slice(0,prefix.inheritedEventCount))
        ready=journal.recoverFrozenReady(prefix.journal,events,prior,recut)
        if(ready.frozen.sessionId!==sid||ready.frozen.realmEpoch!==prefix.original.realmEpoch)return undefined
        resolvedSeed=recoveredPrefixes.get(prior)?.resolvedEdits
        lastTaskResultSeed=recoveredPrefixes.get(prior)?.lastTaskResultCanonicalSeq
        checkedOriginal=derivedOriginal(genesis.original,prior,events.slice(0,prefix.inheritedEventCount))
        ordinal=prior.steps.length
        initial=snapshot({...genesis.snapshot,sourceSha256:prefix.sourceSha256})
        scopeSeed=scopesForDerived(genesis,events)
        displaySeed=displayForDerived(genesis,events)
      }
      if(!deps.source.originalFactsCurrent(checkedOriginal)||!same(initial,prefix.initial))return undefined
      const result=consume(sid,prefix.inheritedEventCount,events,ready,initial,ordinal,true,scopeSeed,checkedOriginal,
        false,true,displaySeed,undefined,undefined,revisionBases,resolvedSeed,lastTaskResultSeed,
        prefix.seed.kind==='derived'&&genesis?.inheritedReady?recoveredPrefixes.get(genesis.inheritedReady)?.taskArtifacts:undefined)
      const state=snapshot({...result.state,sourceSha256:prefix.sourceSha256})
      if(recut) {
        const {prefixSha256:_oldHash,...body}=prefix
        prefix=sealMvuSchemaInheritanceFact({...body,original:checkedOriginal,journal:ready.frozen,snapshot:state,
          eventKeys:result.eventKeys,
          consumed:[...result.consumed].map(([planSha256,closureSha256])=>({planSha256,closureSha256}))},'prefixSha256')
      }else if(!same(state,prefix.snapshot)||!same(result.eventKeys,prefix.eventKeys)
        ||!same([...result.consumed].map(([planSha256,closureSha256])=>({planSha256,closureSha256})),prefix.consumed))return undefined
      // A completed Native story without its settled numerical result is not a
      // forkable baseline, even when author dispatch has not started yet.
      for(const [key,row] of prefixInputs.branch.entries())if(key.startsWith(`${sid}__native-input-v2-work-`)) {
        const work=row as {source?:{kind?:string;headRef?:{kind?:string}};checkpoint?:{actualTurn?:number};
          preparationId?:string;terminalRequired?:boolean}
        if(work.source?.kind!=='story'||work.source.headRef?.kind!=='schema-head'||!work.checkpoint)continue
        const completed=events.find(event=>event.type==='turn/end'&&event.data.turn===work.checkpoint!.actualTurn
          &&event.data.reason.kind==='completed')
        if(!completed||completed.seq<prefix.inheritedEventCount)continue
        const terminal=work.preparationId&&readInputCompletion(prefixInputs.branch,sid,work.preparationId)
        if(work.terminalRequired!==true||!terminal||terminal.status!=='settled'||terminal.plan.kind!=='schema-numerical'
          ||!result.consumed.has(terminal.plan.plan.planSha256))return undefined
      }
      if(result.readScopes) {
        scopePrefixes.delete(prefix.prefixSha256)
        scopePrefixes.set(prefix.prefixSha256,{nativePrefixSha256:prefix.journal.nativePrefixSha256,facts:result.readScopes})
        if(scopePrefixes.size>64)scopePrefixes.delete(scopePrefixes.keys().next().value!)
      }
      // All Native, frozen Source, journal, terminal and closure checks above
      // must finish before a prefix becomes a source of inherited display data.
      displayPrefixes.delete(prefix.prefixSha256)
      displayPrefixes.set(prefix.prefixSha256,{ownerSessionId:sid,
        nativePrefixSha256:prefix.journal.nativePrefixSha256,updates:result.displayUpdates??[]})
      if(displayPrefixes.size>64)displayPrefixes.delete(displayPrefixes.keys().next().value!)
      if(checkedOriginal.schemaVersion===5)sourceOriginals.set(checkedOriginal.originalSha256,checkedOriginal)
      recoveredPrefixes.set(ready,{original:checkedOriginal,scopes:result.readScopes,
        displayUpdates:result.displayUpdates??[],resolvedEdits:result.resolvedEdits,
        lastTaskResultCanonicalSeq:result.lastTaskResultCanonicalSeq,taskArtifacts:result.taskArtifacts})
      return {prefix,ready}
    }catch {return undefined}
  }
  function recoverForkPrefix(input:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
    genesis?:MvuSchemaDerivedGenesis,revisionBases=prepareRevisionBases(input.sessionId,events)):SchemaJournalReady|undefined {
    return foldForkPrefix(input,events,genesis,false,revisionBases)?.ready
  }
  function verifyForkPrefix(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
    genesis?:MvuSchemaDerivedGenesis):boolean {
    return recoverForkPrefix(prefix,events,genesis)!==undefined
  }
  const prefixInputBinding=(prefix:MvuSchemaFrozenPrefixV1)=>({sessionId:prefix.sessionId,
    inheritedEventCount:prefix.inheritedEventCount,nativeCut:prefix.journal.nativeCut,
    nativePrefixSha256:prefix.journal.nativePrefixSha256,sourceSha256:prefix.sourceSha256,
    prefixSha256:prefix.prefixSha256})
  function captureFrozenForkPrefix(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
    genesis?:MvuSchemaDerivedGenesis) {
    const revisionBases=prepareRevisionBases(prefix.sessionId,events)
    const captured=prefixInputs.capture(prefixInputBinding(prefix),()=>recoverForkPrefix(prefix,events,genesis,revisionBases))
    if(!captured.result)fail('SCHEMA_DERIVED_HISTORY_UNPROVEN')
    return {closure:captured.closure,assertCurrent:captured.assertCurrent,ready:captured.result}
  }
  function captureAncestorForkPrefix(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
    genesis:MvuSchemaDerivedGenesis|undefined,closure:MvuSchemaPrefixInputClosureV1,subjectSessionId=prefix.sessionId) {
    const inputs=prefixInputs.prepareClosed(closure,prefixInputBinding(prefix))
    const revisionBases=prepareRevisionBases(prefix.sessionId,events,inputs.status,subjectSessionId)
    const captured=prefixInputs.derive(closure,prefixInputBinding(prefix),()=>{
      const selected=foldForkPrefix(prefix,events,genesis,true,revisionBases)
      if(!selected)fail('SCHEMA_DERIVED_HISTORY_UNPROVEN')
      return selected
    },selected=>prefixInputBinding(selected.prefix))
    const ready=captured.result.ready
    const browserProgram=isAuthorHostJournalReadyV5(ready)&&ready.epoch.program.browserProgram?.schemaVersion===3
      ?{program:ready.epoch.program.browserProgram,epochRef:ready.epochRef}:undefined
    return {prefix:captured.result.prefix,ready,closure:captured.closure,assertCurrent:captured.assertCurrent,browserProgram}
  }
  function recoverFrozenForkPrefix(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
    genesis:MvuSchemaDerivedGenesis|undefined,closure:MvuSchemaPrefixInputClosureV1,
    subjectSessionId=prefix.sessionId):SchemaJournalReady|undefined {
    try {
      const inputs=prefixInputs.prepareClosed(closure,prefixInputBinding(prefix))
      const revisionBases=prepareRevisionBases(prefix.sessionId,events,inputs.status,subjectSessionId)
      return inputs.read(()=>recoverForkPrefix(prefix,events,genesis,revisionBases))
    }
    catch {return undefined}
  }
  function verifyFrozenForkPrefix(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
    genesis:MvuSchemaDerivedGenesis|undefined,closure:MvuSchemaPrefixInputClosureV1,subjectSessionId=prefix.sessionId):boolean {
    return recoverFrozenForkPrefix(prefix,events,genesis,closure,subjectSessionId)!==undefined
  }
  function captureForkPrefix(sid:string,nativeCut:number,revisionBases?:RevisionBases):MvuSchemaForkCapture {
    const session=deps.session(sid)
    if(!session||!currentSession(session)||!Number.isSafeInteger(nativeCut)||nativeCut<1
      ||nativeCut>all(session).length)fail('SCHEMA_DERIVED_PARENT_UNPROVEN')
    // The durable closure is validated once by derived.prepare under its Source lock.
    const history=factual(session,nativeCut,true,false,false,undefined,revisionBases)
    const body={schemaVersion:1 as const,encoding:'native-mvu-schema-frozen-prefix-v1' as const,sessionId:sid,
      inheritedEventCount:session.inheritedEventCount,sourceSha256:history.snapshot.sourceSha256,
      original:history.original,seed:history.seed,initial:history.initial,journal:history.ready.frozen,
      eventKeys:history.eventKeys,snapshot:history.snapshot,
      consumed:[...history.consumed].map(([planSha256,closureSha256])=>({planSha256,closureSha256}))}
    const prefix=sealMvuSchemaInheritanceFact(body,'prefixSha256')
    const ready=history.ready
    recoveredPrefixes.set(ready,{original:history.original,scopes:history.readScopes,
      displayUpdates:history.displayUpdates??[],resolvedEdits:history.resolvedEdits,
      lastTaskResultCanonicalSeq:history.lastTaskResultCanonicalSeq,taskArtifacts:history.taskArtifacts})
    if(isAuthorHostJournalReadyV5(ready)&&ready.epoch.program.browserProgram?.schemaVersion===3) {
      return {prefix,ready,browserProgram:{program:ready.epoch.program.browserProgram,epochRef:ready.epochRef}}
    }
    return {prefix,ready}
  }
  function captureRevisionForkPrefix(sid:string,nativeCut:number):MvuSchemaForkCapture {
    const session=deps.session(sid)
    if(!session)fail('SCHEMA_SESSION_INACTIVE')
    const revisionBases=prepareRevisionBases(sid,all(session).slice(0,nativeCut))
    const captured=prefixInputs.captureComputed(sid,()=>captureForkPrefix(sid,nativeCut,revisionBases),
      result=>prefixInputBinding(result.prefix))
    return {...captured.result,closure:captured.closure}
  }
  function readDataCurrent(view:SchemaReadData):boolean {
    return !disposed&&deps.session(view.session.id)===view.session&&deps.agent(view.session)===view.agent
  }
  function viewCurrent(view:View):boolean {return view.read.current()&&readDataCurrent(view)}
  function historicalSourceSha256(sid:string,ready:SchemaJournalReady,ordinal:number):string {
    const first=ready.steps[ordinal]
    if(!first)fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN')
    if(ready.frozen.schemaVersion===2)for(const revision of ready.frozen.revisions) {
      const descriptor=validateMvuSchemaStoryRevisionDescriptor(revision.descriptor.value as MvuSchemaStoryRevisionDescriptor)
      if(descriptor.schemaVersion!==1) {
        const plan=prefixInputs.status.get(mvuSchemaStoryRevisionPlanKey(sid,
          recordSha256({descriptor:{key:revision.descriptor.key,sha256:revision.descriptor.sha256},index:0}))) as
          SuffixPlan|undefined
        if(plan?.selectors[0]?.batchId===first.dispatch.batchId)return plan.execution.sourceSha256
        continue
      }
      const plan=prefixInputs.status.get(mvuSchemaStoryRevisionPlanKey(sid,revision.descriptor.sha256)) as
        MvuSchemaStoryRevisionPlanV1|undefined
      if(plan?.selectors[0]?.batchId===first.dispatch.batchId)return plan.base.sourceSha256
    }
    const matches:string[]=[]
    for(const [key,row] of prefixInputs.branch.entries()) {
      if(!key.startsWith(`${sid}__native-input-v2-terminal-`)&&!key.startsWith(`${sid}__mvu-schema-player-plan-`))continue
      const plan=(key.startsWith(`${sid}__native-input-v2-terminal-`)
        ?(row as {plan?:{kind?:string;plan?:unknown}})?.plan?.plan:row) as MvuSchemaStoryPlan|undefined
      if(plan?.realmEpoch!==ready.epoch.realmEpoch||plan.selectors?.[0]?.batchId!==first.dispatch.batchId)continue
      const base='operation' in plan?(plan as unknown as {operation:{base:MvuSchemaNumericalSnapshotV2}}).operation.base:plan.base
      if(!base||base.sessionId!==sid||!/^[a-f0-9]{64}$/.test(base.sourceSha256))fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN')
      matches.push(base.sourceSha256)
    }
    if(matches.length!==1)fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN')
    return matches[0]!
  }
  function historicalCutData(selector:HistoricalCutSelector,session=deps.session(selector.sessionId))
    :{facts:HistoricalCutFacts;originalSha256:string} {
    if(!session||!currentSession(session)||!Number.isSafeInteger(selector.nativeCut)
      ||selector.nativeCut<1||selector.nativeCut>all(session).length)fail('SCHEMA_SESSION_INACTIVE')
    // Select the pinned original realm explicitly. A read-only cut must not
    // borrow today's active pointer, current numerical head or later material.
    const prefix=all(session).slice(0,selector.nativeCut)
    const revisionBases=prepareRevisionBases(session.id,prefix)
    const sid=session.id,derivedRequired=deps.derivedRequired?.(sid)||session.inheritedEventCount||session.header.parentSession
    const derived=derivedRequired?deps.readDerivedGenesis?.(sid):undefined
    let original:SchemaFrozenOriginal,ready:SchemaJournalReady,ordinal=1,initial:MvuSchemaNumericalSnapshotV2|undefined
    let scopeSeed:ScopeFacts|undefined
    if(derivedRequired) {
      if(!derived||derived.original.realmEpoch!==selector.realmEpoch)fail('SCHEMA_DERIVED_GENESIS_UNPROVEN')
      if(derived.inheritedCut.nativeCut!==session.inheritedEventCount)fail('SCHEMA_DERIVED_GENESIS_UNPROVEN')
      const inherited=derived.inheritedReady??journal.validateFrozenReady(derived.inheritedCut,
        prefix.slice(0,derived.inheritedCut.nativeCut))
      original=derivedOriginal(derived.original,inherited,prefix.slice(0,derived.inheritedCut.nativeCut))
      if(!deps.source.originalFactsCurrent(original))fail('SCHEMA_DERIVED_GENESIS_UNPROVEN')
      ready=readyFor(sid,selector.realmEpoch,prefix,inherited,true)
      ordinal=inherited.steps.length
      initial=derived.snapshot
      scopeSeed=scopesForDerived(derived,prefix)
    }else {
      const matches=[...prefixInputs.branch.entries()].filter(([key,row])=>key.startsWith(`${sid}__opening-choice-`)
        &&(row as {schemaVersion?:number}).schemaVersion===5
        &&(row as ReturnType<typeof validateMvuSchemaOpeningIntent>).preparation?.realmEpoch===selector.realmEpoch)
      if(matches.length!==1)fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN')
      const intent=validateMvuSchemaOpeningIntent(matches[0]![1] as never)
      if(intent.status!=='completed'||!intent.initializationReceipt)fail('SCHEMA_OPENING_RECORD_INVALID')
      const captured=deps.source.captureCurrentOriginal(intent.preparation,
        {sessionId:sid,table:prefixInputs.status,events:prefix},true)
      ready=captured.ready
      original=captured.original
      if(original.schemaVersion===5)sourceOriginals.set(original.originalSha256,original)
      const opening=validateMvuSchemaOpeningEvent(prefixInputs.status.get(
        mvuInitializationEventKey(sid,intent.initializationReceipt.eventId)) as never)
      const head=mvuSchemaOpeningHead(opening),seed={kind:'opening' as const,intent,event:opening,head}
      if(!verifyMvuSchemaInheritedOpeningFacts({intent,event:opening,head,events:prefix},
        {projectPrefix:deps.projectPrefix}))fail('SCHEMA_OPENING_RECORD_INVALID')
      ordinal=openingPhaseCount(opening.plan)
      scopeSeed=scopesForOpening(seed,original,ready,prefix)
      // There is no numerical currency to borrow when no later author phase
      // exists. Otherwise its immutable durable plan supplies that wrapper;
      // the full base and Native work are independently proved below.
      if(ready.steps.length>ordinal)initial=initialForOpening(seed,historicalSourceSha256(sid,ready,ordinal),original,ready,prefix)
      else if(eventRows(sid,prefix.length).length)fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN')
    }
    if(initial) {
      const folded=consume(sid,session.inheritedEventCount,prefix,ready,initial,ordinal,true,scopeSeed,original,true,
        false,undefined,undefined,undefined,revisionBases,
        derived?.inheritedReady?recoveredPrefixes.get(derived.inheritedReady)?.resolvedEdits:undefined,
        derived?.inheritedReady?recoveredPrefixes.get(derived.inheritedReady)?.lastTaskResultCanonicalSeq:undefined,
        derived?.inheritedReady?recoveredPrefixes.get(derived.inheritedReady)?.taskArtifacts:undefined)
      verifyMvuSchemaUnpublishedTail({sessionId:sid,inheritedEventCount:session.inheritedEventCount,
        events:prefix,ready,ordinal:folded.ordinal,snapshot:folded.state,original},{
        branch:prefixInputs.branch,status:prefixInputs.status,projectPrefix:deps.projectPrefix,editProtocol:deps.editProtocol,
        verifyFrozenFrame:deps.source.verifyFrozenFrame,associationAt:index=>associationAt(sid,prefix,ready,index),
        scopeFrameAt:(frame,cut)=>{
          if(!folded.readScopes)fail('SCHEMA_SCOPE_HISTORY_UNPROVEN')
          return scopeFrameAt(folded.readScopes,original,frame,cut,prefix)
        },
      })
    }
    return historicalCutFacts(original,ready,session)
  }
  function historicalCutFacts(original:SchemaFrozenOriginal,ready:SchemaJournalReady,session:Session)
    :{facts:HistoricalCutFacts;originalSha256:string} {
    return Object.freeze({facts:Object.freeze({authorInput:schemaOriginalReplayCompilationInput(original),
      ...original.schemaVersion===5
        &&(original.preparation.compilation.schemaVersion===6||original.preparation.compilation.schemaVersion===7)
        ?{compilationResources:deps.source.captureOriginalCompilationResources(original)}:{},
      ready,frozen:ready.frozen,events:all(session)}),originalSha256:original.originalSha256})
  }
  async function captureHistoricalCut(selector:HistoricalCutSelector) {
    const session=deps.session(selector.sessionId),{facts}=historicalCutData(selector,session)
    // Re-admit protected bytes for every waiter, including a cache hit.
    await protectedFor(facts.ready)
    return {...facts,events:all(session!)}
  }
  async function borrowHistoricalCut(selector:HistoricalCutSelector,signal?:AbortSignal):Promise<SchemaOwnedHistoricalCut> {
    signal?.throwIfAborted()
    const read=deps.inputState.borrowHistorical(selector.sessionId,()=>{
      const captured=deps.inputState.reuseSchema<SchemaReadData>(selector.sessionId,({history})=>
        history.original.realmEpoch===selector.realmEpoch&&history.ready.frozen.nativeCut===selector.nativeCut)
      // preflight has already folded this exact cut into its owned History.
      // Replay still verifies it; rebuilding the same Source and numerical fold
      // here only repeats that owner's work before the replay cache is consulted.
      return captured?historicalCutFacts(captured.data.history.original,captured.data.history.ready,
        captured.data.session):historicalCutData(selector)
    })
    try {
      await protectedFor(read.data.facts.ready)
      signal?.throwIfAborted()
      const current=()=>!disposed&&!signal?.aborted&&read.current()
      if(!current())fail('SCHEMA_HISTORICAL_FACTS_CHANGED')
      return Object.freeze({...read.data.facts,originalSha256:read.data.originalSha256,current,release:read.release})
    }catch(error) {read.release();throw error}
  }
  function rowsCurrent(owner:Owner):boolean {
    const sid=owner.view.session.id,boundary=owner.publication,proposed=new Map<string,unknown>()
    if(boundary) {
      proposed.set(mvuSchemaStoryEventKey(sid,boundary.event.eventId),boundary.event)
      if(boundary.event.outcome==='accepted')proposed.set(mvuStateCurrentHeadKey(sid),boundary.head)
      proposed.set(mvuSchemaStorySettlementKey(sid,boundary.plan.planSha256),boundary.settlement)
    }
    const actual=new Map([...prefixInputs.status.entries()].filter(([key])=>key.startsWith(`${sid}__mvu-`)
      &&!key.startsWith(`${sid}__mvu-schema-epoch-`)&&!key.startsWith(`${sid}__mvu-schema-dispatch-`)
      &&!key.startsWith(`${sid}__mvu-schema-completion-`)&&!key.startsWith(`${sid}__mvu-schema-unavailable-`)
      &&!key.startsWith(`${sid}__mvu-state-schema-task-edit-intent-`)
      &&!key.startsWith(`${sid}__mvu-state-schema-task-edit-binding-`)))
    for(const [key,hash] of owner.baseline) {
      if(proposed.has(key)&&same(actual.get(key),proposed.get(key)))continue
      if(recordSha256(actual.get(key))!==hash)return false
    }
    for(const [key,row] of actual)if(!owner.baseline.has(key)&&(!proposed.has(key)||!same(row,proposed.get(key))))return false
    return true
  }
  function ownerCurrent(owner:Owner):boolean {
    const sid=owner.view.session.id,view=deps.closingView(owner.lease,owner.plan.scope)
    if(!view||disposed||owner.abort.signal.aborted||owners.get(sid)!==owner
      ||view.agent!==owner.view.agent||view.session!==owner.view.session||!currentSession(owner.view.session as Session)
      ||deps.agent(owner.view.session as Session)!==view.agent
      ||deps.sourceSha256(sid)!==owner.plan.scope.currency.source.sourceSha256
      ||!deps.source.frameCurrent(owner.original,owner.frame)||!rowsCurrent(owner)
      ||owner.readScopes&&!scopeFactsCurrent(owner.readScopes))return false
    const body=deps.readCanonical(sid,owner.plan.scope.receipt.checkpoint.actualTurn)
    return !!body&&same(owner.plan.canonical,{...body,narrativeSha256:sha256(body.narrative)})
  }
  function checkOwned(scope:SchemaOwnedScope,boundary:SchemaBoundary):boolean {
    try {
      const revision=revisionScopes.get(scope.owner)
      if(revision)return checkRevisionOwned(revision,scope,boundary)
      const owner=scopes.get(scope.owner),session=owner?.view.session as Session|undefined
      if(!owner||!session||!ownerCurrent(owner)||scope.incarnation!==owner.view.agent||scope.session!==session
        ||scope.signal.aborted||!owner.scope
        ||(scope.requestedStep!==owner.scope.requestedStep&&!same(scope.requestedStep,owner.scope.requestedStep)))return false
      const events=all(session),initial=owner.plan.initialCut,cut=scope.sourceNativeCut.nativeCut
      // Replay proves each new full cut once. This same Native incarnation has
      // an immutable prefix, so later callbacks bind the cut and check its tail.
      if(!same(scope.sourceNativeCut,owner.scope.sourceNativeCut)
        ||cut!==initial.nativeCut+2*owner.associations.length)return false
      for(const association of owner.associations)for(const ref of [association.dispatchMarker,association.completionMarker]) {
        if(recordSha256(events[ref.seq])!==ref.sha256)return false
      }
      for(const [index,ref] of [boundary.dispatchMarker,boundary.completionMarker].entries()) {
        if(ref&&(ref.seq!==cut+index||recordSha256(events[ref.seq])!==ref.sha256))return false
      }
      const count=boundary.completionMarker?2:boundary.dispatchMarker?1:0
      if(events.length!==cut+count)return false
      return boundary.stage==='returned'||owner.inSource&&sourceLeases.get(session.id)===owner
    } catch {return false}
  }
  async function withLease<T>(owner:Owner,action:()=>Promise<T>):Promise<T> {
    if(!ownerCurrent(owner))fail('SCHEMA_STORY_PERMISSION_REVOKED')
    const sid=owner.view.session.id
    if(owner.inSource&&sourceLeases.get(sid)===owner)return action()
    return deps.withSourceLock(sid,async()=>{
      if(!ownerCurrent(owner))fail('SCHEMA_STORY_PERMISSION_REVOKED')
      owner.inSource=true;sourceLeases.set(sid,owner)
      try {return await action()}finally {owner.inSource=false;if(sourceLeases.get(sid)===owner)sourceLeases.delete(sid)}
    })
  }
  function identityTuple(ready:SchemaJournalReady):SchemaExecutorIdentityTuple {
    if(isAuthorHostJournalReadyV5(ready))return ready.epoch.server.executor
    const {program,runner}=schemaEpochExecution(ready.epoch)
    return {compiler:program.compiler,bridge:program.bridge,libraries:program.libraries,runner}
  }
  async function protectedFor(ready:SchemaJournalReady):Promise<OwnedMvuSchemaExecutor|ProtectedAuthorHostRuntimeV5> {
    const tuple=identityTuple(ready),host=isAuthorHostJournalReadyV5(ready)?ready.epoch.host:undefined
    const runtime=await deps.protectedRuntime(tuple,host)
    if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
    if(runtime.executorVersion!==(host?4:ready.epoch.schemaVersion)
      ||(host?!('host' in runtime)||!same(runtime.host.identity,host)
        ||runtime.implementationKey!==recordSha256(host):runtime.implementationKey!==recordSha256(tuple))
      ||!same(tuple,{compiler:runtime.compiler.identity,bridge:runtime.bridge,libraries:runtime.libraries,
        runner:runtime.runner.identity,...(host?{stateLoader:runtime.stateLoader}:{})})) {
      fail('SCHEMA_IMPLEMENTATION_CHANGED')
    }
    return runtime
  }
  async function engine(ready:SchemaJournalReady) {
    const runtime=await protectedFor(ready)
    let driver=drivers.get(runtime.implementationKey)
    if(!driver) {
      const bindings:Omit<SchemaReplayDeps,'compiler'|'runner'|'executorVersion'|'hostV5'>={table:prefixInputs.status as never,
        recordOwner:deps.inputState.schemaJournal,
        markers:deps.markers,captureHistoricalCut,borrowHistoricalCut,flush:deps.flush,captureOwned:selector=>{
          const revision=revisionOwners.get(selector.sessionId)
          if(revision) {
            if(!revision.scope||revision.driver!==driver||!revision.inSource||!revisionCurrent(revision)
              ||revision.scope.requestedStep.eventId!==selector.batchId)fail('SCHEMA_REVISION_OWNER_UNPROVEN')
            return revision.scope
          }
          const owner=owners.get(selector.sessionId)
          if(!owner?.scope||owner.driver!==driver||!owner.inSource||!ownerCurrent(owner)
            ||owner.scope.requestedStep.eventId!==selector.batchId)fail('SCHEMA_OWNER_UNPROVEN')
          return owner.scope
        },checkOwned,withSourceBoundary:(scope,action)=>{
          const revision=revisionScopes.get(scope.owner)
          if(revision) {
            if(!revision.inSource||!revisionCurrent(revision))fail('SCHEMA_REVISION_PERMISSION_REVOKED')
            return action()
          }
          const owner=scopes.get(scope.owner);if(!owner)fail('SCHEMA_OWNER_UNPROVEN');return withLease(owner,action)
        }}
      driver='host' in runtime?runtime.host.createReplay(bindings):createRoleplayMvuSchemaReplay({...bindings,
        executorVersion:runtime.executorVersion,compiler:runtime.compiler,runner:runtime.runner})
      drivers.set(runtime.implementationKey,driver)
    }
    return {runtime,driver}
  }
  function revisionCurrent(owner:RevisionOwner):boolean {
    return !disposed&&!owner.signal.aborted&&revisionOwners.get(owner.session.id)===owner
      &&currentSession(owner.session)&&deps.agent(owner.session)===owner.agent
      &&deps.source.frameCurrent(owner.original,owner.frame)
  }
  function checkRevisionOwned(owner:RevisionOwner,scope:SchemaOwnedScope,boundary:SchemaBoundary):boolean {
    if(!revisionCurrent(owner)||!owner.inSource||scope.signal.aborted||scope.session!==owner.session
      ||scope.incarnation!==owner.agent||!owner.scope
      ||scope.requestedStep!==owner.scope.requestedStep&&!same(scope.requestedStep,owner.scope.requestedStep))return false
    const events=all(owner.session),cut=scope.sourceNativeCut.nativeCut
    for(const [index,ref] of [boundary.dispatchMarker,boundary.completionMarker].entries()) {
      if(ref&&(ref.seq!==cut+index||recordSha256(events[ref.seq])!==ref.sha256))return false
    }
    return events.length===cut+(boundary.completionMarker?2:boundary.dispatchMarker?1:0)
  }
  async function putRevisionFact(key:string,value:unknown,prior?:unknown):Promise<void> {
    const actual=prefixInputs.status.get(key)
    if(same(actual,value))return
    if(!same(actual,prior))fail('SCHEMA_REVISION_WRITE_CONFLICT')
    try {await prefixInputs.status.put(key,value)}catch { /* Exact readback owns a lost acknowledgement. */ }
    if(!same(prefixInputs.status.get(key),value))fail('SCHEMA_REVISION_WRITE_UNKNOWN')
  }
  function beforeStoryRevision(session:Session,history:History,event:ReturnType<typeof validateMvuSchemaStoryEvent>):History {
    const events=all(session).slice(0,event.plan.initialCut.nativeCut)
    const ready=journal.recutChecked(session.id,event.plan.realmEpoch,events,history.ready)
    if(ready.kind!=='ready')fail(ready.code)
    let ordinal:number,projections:{scopes:ScopeFacts|undefined;displayUpdates:readonly MvuAcceptedDisplayUpdate[]|undefined}
    if(history.seed.kind==='opening') {
      ordinal=openingPhaseCount(history.seed.event.plan)
      projections={scopes:scopesForOpening(history.seed,history.original,ready,events),displayUpdates:undefined}
    }else {
      const genesis=deps.readDerivedGenesis?.(session.id)
      if(!genesis||!history.inheritedReady||genesis.inheritedCut.schemaVersion!==1)
        fail('SCHEMA_REVISION_DERIVED_UNSUPPORTED')
      ordinal=history.inheritedReady.steps.length
      projections={scopes:scopesForDerived(genesis,events),displayUpdates:displayForDerived(genesis,events)}
    }
    const folded=consume(session.id,session.inheritedEventCount,events,ready,history.initial,
      ordinal,true,projections.scopes,history.original,false,true,projections.displayUpdates)
    const state=snapshot({...folded.state,sourceSha256:event.plan.base.sourceSha256})
    if(!same(state,event.plan.base))fail('SCHEMA_REVISION_BASE_UNPROVEN')
    const basis={...history,ready,snapshot:state,consumed:folded.consumed,eventKeys:folded.eventKeys,
      readScopes:folded.readScopes,displayUpdates:folded.displayUpdates,resolvedEdits:folded.resolvedEdits,
      lastTaskResultCanonicalSeq:folded.lastTaskResultCanonicalSeq,taskArtifacts:folded.taskArtifacts}
    if(history.inheritedReady)Object.defineProperty(basis,'inheritedReady',{value:history.inheritedReady})
    return basis
  }
  function revisionPlanEventId(plan:RevisionPlan):string {
    if(plan.schemaVersion===9)return mvuSchemaPlayerRevisionEventId(plan)
    return recordSha256({encoding:plan.schemaVersion===8||plan.schemaVersion===11?'native-mvu-schema-story-revision-event-identity-v2'
      :'native-mvu-schema-story-revision-event-identity-v1',planSha256:plan.planSha256})
  }
  function recoverRevision(owner:RevisionOwner):RevisionEvent {
    const plan=owner.plan,events=all(owner.session)
    const ready=journal.captureChecked(owner.session.id,plan.realmEpoch,events,owner.basis.inheritedReady??null)
    if(ready.kind!=='ready')fail('SCHEMA_REVISION_EXECUTION_UNKNOWN')
    const phases:(MvuSchemaStoryPhaseFact|MvuSchemaPlayerPhaseFact)[]=[]
    const phaseNames=plan.schemaVersion===9?MVU_SCHEMA_PLAYER_PHASES:MVU_SCHEMA_STORY_PHASES
    let reducer:MvuSchemaStoryReducerBridge|null=null
    for(const [index,selector] of plan.selectors.entries()) {
      const ordinal=ready.steps.findIndex(step=>step.dispatch.batchId===selector.batchId),step=ready.steps[ordinal]
      // An incomplete attempt retains its original anchor. Recovery consumes
      // completed Journal output; it never executes the remaining selectors.
      if(!step)fail('SCHEMA_REVISION_EXECUTION_UNKNOWN')
      phases.push(freezeSchemaJournalData({phase:phaseNames[index]!,input:step.step.frame.input,
        association:associationAt(owner.session.id,events,ready,ordinal),output:step.step.output}))
      if(step.step.output.kind==='refused')break
      if(plan.schemaVersion===9) {
        if(step.step.output.commands.length)break
        if(index===1&&mvuSchemaPlayerReducerBridge(phases[1] as MvuSchemaPlayerPhaseFact).result.kind==='rejected')break
      }else if(index===0) {
        reducer=mvuSchemaStoryReducerBridge(phases[0] as MvuSchemaStoryPhaseFact)
        if(reducer.result.kind==='rejected')break
      }
    }
    return plan.schemaVersion===9
      ?validateMvuSchemaPlayerRevisionEvent(mvuSchemaPlayerRevisionEvent(plan,phases as MvuSchemaPlayerPhaseFact[]))
      :validateMvuSchemaStoryRevisionEvent(mvuSchemaStoryRevisionEvent(plan as never,
        phases as MvuSchemaStoryPhaseFact[],reducer) as MvuSchemaStoryRevisionEvent)
  }
  async function executeRevision(owner:RevisionOwner):Promise<RevisionEvent> {
    const phases:(MvuSchemaStoryPhaseFact|MvuSchemaPlayerPhaseFact)[]=[],plan=owner.plan
    const phaseNames=plan.schemaVersion===9?MVU_SCHEMA_PLAYER_PHASES:MVU_SCHEMA_STORY_PHASES
    let reducer:MvuSchemaStoryReducerBridge|null=null
    for(const [index,phase] of phaseNames.entries()) {
      const selector=plan.selectors[index]!,events=all(owner.session)
      const captureJournal=()=>journal.captureChecked(owner.session.id,plan.realmEpoch,all(owner.session),
        owner.basis.inheritedReady??null)
      const ready=captureJournal()
      if(ready.kind!=='ready')fail(ready.code)
      // Journal owns the exact Native cut captured synchronously above.
      const cut:SourceNativeCutFacts={...plan.initialCut,nativeCut:ready.frozen.nativeCut,
        nativePrefixSha256:ready.frozen.nativePrefixSha256,anchor:selector.anchor}
      const frame=scopeFrameAt(owner.basis.readScopes!,owner.original,owner.frame,cut,events,
        plan.schemaVersion===8||plan.schemaVersion===9||plan.schemaVersion===11?plan.logicalNativeCut:undefined,owner.projection)
      const input=plan.schemaVersion===9?mvuSchemaPlayerPhaseInput(plan,index,phases as MvuSchemaPlayerPhaseFact[],frame)
        :mvuSchemaStoryPhaseInput(plan,index,phases as MvuSchemaStoryPhaseFact[],reducer,frame)
      const requestedStep=schemaTraceRequestedStep(selector.batchId,
        {ownerSessionId:owner.session.id,sourceNativeCutSha256:recordSha256(cut),material:owner.frame.material},input)
      owner.scope={owner:owner.token,incarnation:owner.agent,session:owner.session,signal:owner.signal,
        authorInput:schemaOriginalReplayCompilationInput(owner.original),realmEpoch:plan.realmEpoch,
        loadFrame:schemaEpochExecution(ready.epoch).loadFrame,inheritedCut:owner.basis.inheritedCut,journalCut:ready,
        sourceNativeCut:freezeSchemaJournalData(cut),requestedStep,
        compiledProgram:owner.compiledProgram,
        ...owner.original.schemaVersion===5
          &&(owner.original.preparation.compilation.schemaVersion===6||owner.original.preparation.compilation.schemaVersion===7)
          &&!owner.compiledProgram
          ?{compilationResources:deps.source.captureOriginalCompilationResources(owner.original)}:{}}
      Object.defineProperty(owner.scope,'captureJournal',{value:captureJournal})
      if(owner.basis.inheritedReady)Object.defineProperty(owner.scope,'inheritedReady',{value:owner.basis.inheritedReady})
      const result=await owner.driver.execute(selector)
      if(result.kind!=='completed')fail(result.code)
      owner.lastLive=result;owner.compiledProgram=result.compiledProgram
      owner.associations.push(result.association)
      phases.push(freezeSchemaJournalData({phase,input,association:result.association,output:result.output}))
      if(result.output.kind==='refused')break
      if(plan.schemaVersion===9) {
        if(result.output.commands.length)break
        if(index===1&&mvuSchemaPlayerReducerBridge(phases[1] as MvuSchemaPlayerPhaseFact).result.kind==='rejected')break
      }else if(index===0) {
        reducer=mvuSchemaStoryReducerBridge(phases[0] as MvuSchemaStoryPhaseFact)
        if(reducer.result.kind==='rejected')break
      }
    }
    const last=owner.lastLive!
    owner.associations.pop()
    let verified:boolean
    try {verified=owner.driver.checkEvidence(last.evidence,{association:last.association,output:last.output})}
    finally {owner.associations.push(last.association)}
    if(!verified)fail('SCHEMA_REVISION_EXECUTION_UNPROVEN')
    return plan.schemaVersion===9
      ?validateMvuSchemaPlayerRevisionEvent(mvuSchemaPlayerRevisionEvent(plan,phases as MvuSchemaPlayerPhaseFact[]))
      :validateMvuSchemaStoryRevisionEvent(mvuSchemaStoryRevisionEvent(plan as never,
        phases as MvuSchemaStoryPhaseFact[],reducer) as MvuSchemaStoryRevisionEvent)
  }
  /** Only this owner interprets durable edit resolution. Native owns its
   * maintenance reservation and marker rewind; old completion facts stay intact. */
  async function reconcileAcceptedEdit(sid:string,requestedSeq?:number):Promise<void> {
    if(await reconcileStorySuffix(sid,requestedSeq))return
    await reconcileAcceptedEditV1(sid,requestedSeq)
  }
  function revisionResultBasis(history:History,event:SuffixEvent):History {
    const head=suffixHead(event),state=snapshot({schemaVersion:2,
      encoding:'native-mvu-schema-state-snapshot-v2',sessionId:event.sessionId,sourceSha256:event.sourceSha256,
      root:event.plan.execution.root,currentHead:head,revision:head.revision,headSha256:recordSha256(head),
      values:event.values,valuesSha256:event.valuesSha256,context:event.context,schemaFrontier:event.frontier})
    const facts=history.readScopes!
    if(isManualRevision(event)) {
      const stateRef={kind:'manual' as const,ownerSessionId:event.sessionId,
        recordKey:mvuSchemaStoryRevisionEventKey(event.sessionId,event.eventId),recordSha256:recordSha256(event),
        valuesSha256:event.valuesSha256,revision:state.revision}
      // A completed refusal preserves DATA. Rebind only a current manual chat;
      // an older chat must not shadow a later Story's message state in Browser.
      const readScopes=event.outcome==='refused'&&!manualChatAtBase(facts.chat,event.plan.base)?facts:{...facts,
        chat:schemaScopePublished(schemaScopeOwner(schemaScopeSource(event.plan.currentFrame.snapshot),'chat'),
          stateRef,event.values,event.context)}
      const next={...history,snapshot:state,readScopes}
      if(history.inheritedReady)Object.defineProperty(next,'inheritedReady',{value:history.inheritedReady})
      return next
    }
    const source=schemaScopeSource(event.plan.currentFrame.snapshot),canonical=event.plan.canonical
    const messageOwner=scopeOwnerForSeq(facts,canonical.seq)
    const stateRef={kind:'story' as const,ownerSessionId:event.sessionId,
      recordKey:mvuSchemaStoryRevisionEventKey(event.sessionId,event.eventId),recordSha256:recordSha256(event),
      valuesSha256:event.valuesSha256,revision:state.revision}
    const messages=new Map(facts.messages)
    messages.set(schemaScopeMessageKey(messageOwner,canonical.seq,canonical.messageId,canonical.versionSha256),
      schemaScopePublished(schemaScopeOwner(source,'message',canonical.messageId,event.sessionId),stateRef,event.values,event.context))
    const next={...history,snapshot:state,readScopes:{...facts,messages,chat:facts.updateChat
      ?schemaScopePublished(schemaScopeOwner(source,'chat'),stateRef,event.values,event.context):facts.chat}}
    if(history.inheritedReady)Object.defineProperty(next,'inheritedReady',{value:history.inheritedReady})
    return next
  }
  /** One maintenance reservation owns the whole deterministic Story suffix.
   * Original scopes describe history; only this current Native owner executes. */
  function savedSuffixRefusal(descriptor:SuffixDescriptor,ref:{key:string;sha256:string}) {
    for(let index=0;index<descriptor.originals.length;index++) {
      const raw=prefixInputs.status.get(mvuSchemaStoryRevisionPlanKey(descriptor.sessionId,recordSha256({descriptor:ref,index})))
      if(raw===undefined)continue
      const supplied=raw as SuffixPlan
      const plan=supplied.schemaVersion===9?validateMvuSchemaPlayerRevisionPlan(supplied):validateMvuSchemaStoryPlan(supplied)
      const key=mvuSchemaStoryRevisionEventKey(descriptor.sessionId,revisionPlanEventId(plan))
      const saved=prefixInputs.status.get(key)
      if(saved===undefined)continue
      const event=readRevisionEvent(saved as RevisionEvent)
      if(event.encoding==='native-mvu-schema-story-revision-event-v2'&&event.outcome==='refused')return {key,event}
    }
    return undefined
  }
  async function reconcileStorySuffix(sid:string,requestedSeq?:number):Promise<boolean> {
    const session=deps.session(sid)
    if(!session||!currentSession(session))return false
    // Ancestor edits are already closed by the inherited seed. A new child
    // edit remains local even when its target belongs to that inherited prefix.
    const events=all(session),current=deps.currentEdits(session).filter(edit=>edit.seq>=session.inheritedEventCount)
    if(requestedSeq!==undefined&&!current.some(row=>row.seq===requestedSeq))return false
    const invalidation=deps.readEditInvalidation?.(sid)
    if(invalidation?.kind!=='invalidated')return false
    const taskPointer=prefixInputs.branch.get(schemaTaskEditActiveKey(sid)) as {key:string;sha256:string}|undefined
    const taskIntent=taskPointer?validateSchemaTaskEditIntentV1(prefixInputs.status.get(taskPointer.key) as SchemaTaskEditIntentV1):undefined
    if(taskIntent&&recordSha256(taskIntent)!==taskPointer!.sha256)fail('SCHEMA_TASK_EDIT_INTENT_UNPROVEN')
    const taskBinding=taskIntent?validateSchemaTaskEditBindingV1(prefixInputs.status.get(
      schemaTaskEditBindingKey(sid,taskIntent.operationId)) as SchemaTaskEditBindingV1):undefined
    const taskRevision=!!taskIntent
    const edits=current.filter((row):row is Extract<SessionEvent,{type:'roleplay/message-edit'}>=>
      row.type==='roleplay/message-edit'&&(row.data.role==='assistant'||taskRevision&&row.data.role==='user')).map(row=>{
      const target=events[row.data.targetSeq]
      if(target?.type!=='assistant/message'&&target?.type!=='user/message')fail('SCHEMA_REVISION_TARGET_UNPROVEN')
      const originalMessage=target.type==='assistant/message'?target.data.message:target.data
      const message=deps.editProtocol.editMessageText(originalMessage,row.data),narrative=textOf(message.content)
      return {seq:row.seq,sha256:recordSha256(row),targetSeq:target.seq,messageId:message.id,
        messageVersionSha256:recordSha256(message),narrativeSha256:sha256(narrative),
        ...(taskRevision?{role:row.data.role}: {})}
    }).sort((a,b)=>a.seq-b.seq)
    if(!edits.length)return false
    const descriptorKey=mvuSchemaStoryRevisionDescriptorKey(sid,recordSha256({
      encoding:'native-mvu-schema-story-revision-request-v2',edits}))
    const saved=prefixInputs.status.get(descriptorKey)
    const stored=saved===undefined?undefined:validateMvuSchemaStoryRevisionDescriptor(saved as SuffixDescriptor)
    if(stored) {
      if(savedSuffixRefusal(stored,{key:descriptorKey,sha256:recordSha256(stored)})) {
        if(requestedSeq===undefined)fail(invalidation.code)
        return true
      }
      const completed=prefixInputs.status.get(mvuSchemaStoryRevisionCompletionKey(sid,recordSha256(stored)))
      if(completed!==undefined) {
        const closure=validateMvuSchemaStoryRevisionCompletion(completed as MvuSchemaStoryRevisionCompletionV2|MvuSchemaStoryRevisionCompletionV3|MvuSchemaStoryRevisionCompletionV4)
        const last=closure.events.at(-1)!,event=readRevisionEvent(prefixInputs.status.get(last.key) as RevisionEvent)
        if(!isSuffixEvent(event)||recordSha256(event)!==last.sha256)fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
        const head=prefixInputs.status.get(mvuStateCurrentHeadKey(sid)) as {revision?:number}|undefined
        if(same(head,suffixHead(event))
          ||Number(head?.revision)>event.plan.revision.publicationRevision)return true
      }
    }
    const markers=events.filter((row):row is Extract<SessionEvent,{type:typeof deps.markers.revisionEventType}>=>
      row.type===deps.markers.revisionEventType)
    const marker=stored&&markers.find(row=>row.data.descriptor.key===descriptorKey)
    let resolved=new Set<number>()
    let refused:{priorCut:number;descriptor:SuffixDescriptor;
      result:NonNullable<ReturnType<typeof savedSuffixRefusal>>}|undefined
    for(const row of markers) {
      const descriptor=validateMvuSchemaStoryRevisionDescriptor(prefixInputs.status.get(row.data.descriptor.key) as MvuSchemaStoryRevisionDescriptor)
      if(descriptor.schemaVersion===1)continue
      const raw=prefixInputs.status.get(mvuSchemaStoryRevisionCompletionKey(sid,row.data.descriptor.sha256))
      if(raw!==undefined) {
        validateMvuSchemaStoryRevisionCompletion(raw as MvuSchemaStoryRevisionCompletionV2|MvuSchemaStoryRevisionCompletionV3|MvuSchemaStoryRevisionCompletionV4)
        refused=undefined
        resolved=new Set(descriptor.edits.filter(edit=>edits.some(actual=>actual.seq===edit.seq&&actual.sha256===edit.sha256)).map(edit=>edit.seq))
      }else if(descriptor.sessionId===sid) {
        const result=savedSuffixRefusal(descriptor,{key:row.data.descriptor.key,sha256:row.data.descriptor.sha256})
        refused=result?{priorCut:refused?.priorCut??row.seq,descriptor,result}:undefined
      }
    }
    // A newer malformed save has no descriptor, but a prior known refusal
    // still owns the denial. A GET may repair saved work, never start it.
    if(saved===undefined&&requestedSeq===undefined) {
      if(refused)fail(invalidation.code)
      return false
    }
    let unresolved=edits.filter(edit=>!resolved.has(edit.seq))
    if(!stored&&!unresolved.length)return true
    // A known refusal never publishes its partial suffix. A corrected save
    // starts from the complete chain that preceded that failed rewind.
    const priorCut=marker?.seq??refused?.priorCut??Math.min(...unresolved.map(edit=>edit.seq))
    const priorEvents=events.slice(0,priorCut),native=deps.markers.readEffectiveHistory(priorEvents)
    const ownerIds=new Set<string>([sid])
    for(const row of priorEvents)if(row.type===deps.markers.dispatchEventType)ownerIds.add(row.data.sessionId)
    const allRows=[...ownerIds].flatMap(owner=>eventRows(owner,priorCut))
    const originalPlans=new Set(allRows.filter(row=>row.event.encoding==='native-mvu-schema-story-event-v2')
      .map(row=>row.event.plan.planSha256))
    const prior=factual(session,priorCut,true,true,false,originalPlans)
    if(!isAuthorHostJournalReadyV5(prior.ready))return false
    const priorReady=prior.ready
    unresolved=edits.filter(edit=>!prior.resolvedEdits.has(edit.seq))
    const batches=new Set([...native.epochs.values()].flatMap(epoch=>epoch.pairs.map(pair=>pair.dispatch.data.batchId)))
    const activeRows=allRows.filter(row=>batches.has(row.event.phases[0]!.association.batchId))
      .sort((a,b)=>a.event.phases[0]!.association.dispatchMarker.seq-b.event.phases[0]!.association.dispatchMarker.seq)
    const earliest=Math.min(...unresolved.map(edit=>edit.targetSeq))
    const first=activeRows.findIndex(row=>!isManualEvent(row.event)
      &&row.event.plan.canonical.seq>=earliest)
    if(!stored&&first<0)return true
    const originalFor=(row:ReturnType<typeof eventRows>[number]):MvuSchemaStoryRevisionDescriptorV3['originals'][number]=>{
      const item=row.event
      if(item.encoding==='native-mvu-schema-player-event-v1'||item.encoding==='native-mvu-schema-story-event-v2')
        return {kind:item.encoding==='native-mvu-schema-player-event-v1'?'manual':'story',
          event:{key:row.key,sha256:recordSha256(item)}}
      const descriptor=validateMvuSchemaStoryRevisionDescriptor(prefixInputs.status.get(item.plan.revision.descriptor.key) as MvuSchemaStoryRevisionDescriptor)
      return descriptor.schemaVersion===1?{kind:'story',event:descriptor.original}
        :suffixOriginals(descriptor)[item.plan.schemaVersion===8||item.plan.schemaVersion===9||item.plan.schemaVersion===11?item.plan.revision.index:0]!
    }
    const entries=stored?suffixOriginals(stored):activeRows.slice(first).map(originalFor)
    const originals=entries.map(entry=>{
      const ref=entry.event,raw=prefixInputs.status.get(ref.key)
      const event=entry.kind==='manual'?validateMvuSchemaPlayerEvent(raw as MvuSchemaPlayerEventV1)
        :validateMvuSchemaStoryEvent(raw as OriginalStoryEvent)
      if(recordSha256(event)!==ref.sha256)fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
      if(event.encoding==='native-mvu-schema-player-event-v1') {
        joinMvuSchemaPlayerCompletedEvent(prefixInputs.branch,prefixInputs.status,event,events.slice(0,event.frontier.nativeCut))
      }
      return event
    })
    const firstOriginal=originals[0]
    const taskEdits:MvuSchemaStoryRevisionDescriptorV4['taskEdits']=stored?.schemaVersion===4?stored.taskEdits:
      originals.flatMap((event,index)=>{
        if(event.encoding!=='native-mvu-schema-story-event-v2'||event.plan.schemaVersion!==10
          ||event.outcome==='refused'||event.plan.maintenance.kind!=='task-result')return []
        const selected=taskIntent?.artifacts.find(row=>row.canonicalSeq===event.plan.canonical.seq)
        if(!selected||!taskBinding)fail('SCHEMA_MAINTENANCE_REVISION_REQUIRED')
        if(taskBinding.edit.seq!==taskIntent!.basis.nativeCut||taskBinding.edit.sha256!==recordSha256(events[taskBinding.edit.seq])
          ||taskBinding.intent.key!==taskPointer!.key||taskBinding.intent.sha256!==taskPointer!.sha256)
          fail('SCHEMA_TASK_EDIT_BINDING_UNPROVEN')
        return [{index,selection:{...selected.artifact,mode:selected.mode,
          intent:{key:taskPointer!.key,sha256:taskPointer!.sha256},
          binding:{key:schemaTaskEditBindingKey(sid,taskIntent!.operationId),sha256:recordSha256(taskBinding)}}}]
      })
    if(!firstOriginal||firstOriginal.encoding==='native-mvu-schema-player-event-v1'
      ||!stored&&!taskEdits.length&&!unresolved.some(edit=>edit.targetSeq===firstOriginal.plan.canonical.seq))return true
    const projection=deps.projectPrefix(events.slice(0,edits.at(-1)!.seq+1) as never)
    const canonical=originals.map(original=>{
      if(original.encoding==='native-mvu-schema-player-event-v1')return null
      const target=events[original.plan.canonical.seq]
      if(target?.type!=='assistant/message')fail('SCHEMA_REVISION_TARGET_UNPROVEN')
      const message=projection.projectedMessageAt(target.seq)??target.data.message,narrative=textOf(message.content)
      return {seq:target.seq,messageId:original.plan.canonical.messageId,versionSha256:recordSha256(message),narrative,narrativeSha256:sha256(narrative)}
    })
    // Recovery consumes the saved candidate before preflight, including its
    // historical parser policy. A new edit inherits its original Story policy.
    const storedRef=stored?{key:descriptorKey,sha256:recordSha256(stored)}:undefined
    const savedPlans=originals.map((_original,index):SuffixPlan|undefined=>{
      const raw=storedRef&&prefixInputs.status.get(mvuSchemaStoryRevisionPlanKey(sid,
        recordSha256({descriptor:storedRef,index})))
      if(!raw)return
      const plan=raw as SuffixPlan
      return plan.schemaVersion===9?validateMvuSchemaPlayerRevisionPlan(plan):validateMvuSchemaStoryPlan(plan)
    })
    const candidates=canonical.map((body,index)=>{
      if(!body)return null
      const saved=savedPlans[index],original=originals[index]!.plan
      if(saved?.schemaVersion===8||saved?.schemaVersion===11)return saved.candidate
      const selected=taskEdits.find(row=>row.index===index)?.selection
      const policy='parserPolicy' in original?original.parserPolicy:undefined
      return selected?.mode==='retain'?(prefixInputs.status.get(selected.sourceEventRef.key) as TaskArtifactSourceFact).plan.candidate:selected?.mode==='clear'
        ?parseMvuSchemaStoryCandidateV2('',policy):parseMvuSchemaStoryCandidateV2(body.narrative,policy)
    })
    if(candidates.some(candidate=>candidate?.kind==='rejected'))return true
    let captured:MvuSchemaForkCapture,basisRecord:ReturnType<typeof validateMvuSchemaStoryRevisionBasis>
    if(stored) {
      basisRecord=validateMvuSchemaStoryRevisionBasis(prefixInputs.status.get(stored.basis.record.key) as never)
      const recovered=deps.recoverRevisionPrefix?.({subjectSessionId:sid,
        events:events.slice(0,basisRecord.prefix.journal.nativeCut),...basisRecord})
      if(!recovered)fail('SCHEMA_REVISION_BASE_UNPROVEN')
      captured=recovered
    }else {
      const previous=activeRows[first-1]?.event
      const previousRevision=previous&&isSuffixEvent(previous)?previous:undefined
      const firstBase=firstOriginal.plan.base,head=firstBase.currentHead
      // Opening values finish before its visible Native message is appended.
      // That publication is part of a readable baseline, unlike later Story
      // work whose numerical result we are about to replace.
      const opening=head.encoding==='mvu-schema-opening-head-v2'
        ?prior.seed.kind==='opening'&&same(prior.seed.head,head)?prior.seed.event:
          validateMvuSchemaOpeningEvent(prefixInputs.status.get(mvuInitializationEventKey(firstBase.sessionId,head.eventId)) as never)
        :undefined
      const cut=previousRevision?.frontier.nativeCut??Math.max(firstBase.schemaFrontier.nativeCut,
        opening?opening.native.turnEndSeq+1:0)
      const selected=deps.captureRevisionPrefix?.(sid,cut)
      if(!selected?.ready||!selected.closure)fail('SCHEMA_REVISION_BASE_UNPROVEN')
      captured=selected
      const previousCompletionKey=previousRevision?mvuSchemaStoryRevisionCompletionKey(
        previousRevision.sessionId,previousRevision.plan.revision.descriptor.sha256):undefined
      basisRecord=validateMvuSchemaStoryRevisionBasis(sealMvuSchemaStoryFact({schemaVersion:1 as const,
        encoding:'native-mvu-schema-revision-basis-v1' as const,sessionId:sid,
        historyBasis:selected.historical?.historyBasis??null,
        closedRevision:previousCompletionKey?{key:previousCompletionKey,
          sha256:recordSha256(prefixInputs.status.get(previousCompletionKey))}:null,
        prefix:selected.prefix,closure:selected.closure},'basisSha256'))
    }
    const basisRef={key:mvuSchemaStoryRevisionBasisKey(sid,basisRecord.basisSha256),sha256:recordSha256(basisRecord)}
    const tail=activeRows.at(-1),lastRevision=tail&&isSuffixEvent(tail.event)
      ||tail?.event.encoding==='native-mvu-schema-story-revision-event-v1'?tail:undefined
    const mixed=stored?.schemaVersion===3||entries.some(entry=>entry.kind==='manual')
    const descriptorBase={sessionId:sid,edits,
      basis:{record:basisRef,nativeCut:captured.prefix.journal.nativeCut,historyBasis:basisRecord.historyBasis,
        closedRevision:basisRecord.closedRevision,prefixSha256:captured.prefix.prefixSha256,
        stateSnapshotSha256:captured.prefix.snapshot.stateSnapshotSha256}}
    const descriptorTail={
      previous:refused?{key:refused.result.key,sha256:recordSha256(refused.result.event)}
        :lastRevision?{key:lastRevision.key,sha256:recordSha256(lastRevision.event)}:null,
      completionSeq:captured.prefix.snapshot.schemaFrontier.nativeCut-1,
      publicationRevision:Math.max(prior.snapshot.revision,refused
        ?refused.descriptor.publicationRevision+refused.descriptor.originals.length-1:0)+1,
      sourceSha256:deps.sourceSha256(sid)}
    const next=stored??(taskEdits.length
      ?validateMvuSchemaStoryRevisionDescriptor(sealMvuSchemaStoryFact({schemaVersion:4 as const,
        encoding:'native-mvu-schema-story-revision-descriptor-v4' as const,...descriptorBase,
        edits:edits as MvuSchemaStoryRevisionDescriptorV4['edits'],originals:entries,taskEdits,...descriptorTail},'descriptorSha256')):mixed
      ?validateMvuSchemaStoryRevisionDescriptor(sealMvuSchemaStoryFact({schemaVersion:3 as const,
        encoding:'native-mvu-schema-story-revision-descriptor-v3' as const,...descriptorBase,
        originals:entries,...descriptorTail},'descriptorSha256'))
      :validateMvuSchemaStoryRevisionDescriptor(sealMvuSchemaStoryFact({schemaVersion:2 as const,
        encoding:'native-mvu-schema-story-revision-descriptor-v2' as const,...descriptorBase,
        originals:entries.map(entry=>entry.event),...descriptorTail},'descriptorSha256')))
    const ref={key:descriptorKey,sha256:recordSha256(next)},agent=deps.agent(session)
    const restored=captured.ready&&recoveredPrefixes.get(captured.ready)
    if(!agent||!captured.ready||!restored?.scopes||!prior.readScopes)fail('SCHEMA_REVISION_OWNER_UNPROVEN')
    const basis:History={...prior,ready:captured.ready,snapshot:captured.prefix.snapshot,
      consumed:new Map(captured.prefix.consumed.map(row=>[row.planSha256,row.closureSha256])),
      eventKeys:[...captured.prefix.eventKeys],readScopes:{...restored.scopes,owners:prior.readScopes.owners},
      resolvedEdits:restored.resolvedEdits}
    if(prior.inheritedReady)Object.defineProperty(basis,'inheritedReady',{value:prior.inheritedReady})
    await agent.runMaintenance(async signal=>deps.withSourceLock(sid,async()=>{
      signal.throwIfAborted()
      if(!currentSession(session)||deps.agent(session)!==agent)fail('SCHEMA_REVISION_PERMISSION_REVOKED')
      const headKey=mvuStateCurrentHeadKey(sid),materializedHead=prefixInputs.status.get(headKey)
      await putRevisionFact(basisRef.key,basisRecord)
      await putRevisionFact(descriptorKey,next)
      let actualMarker=all(session).find(row=>row.type===deps.markers.revisionEventType&&row.data.descriptor.key===ref.key)
      if(!actualMarker) {
        actualMarker=deps.markers.appendRevision(session,{schemaVersion:1,encoding:'native-mvu-schema-revision-marker-v1',
          sessionId:sid,realmEpoch:prior.original.realmEpoch,descriptor:ref,editSeq:edits.at(-1)!.seq,
          completionSeq:next.completionSeq,observedNativeSeq:all(session).length-1})
        if(!await deps.flush(session))fail('SCHEMA_REVISION_FLUSH_UNKNOWN')
      }
      const frame=deps.source.captureFrame(prior.original,sid),{driver}=await engine(basis.ready)
      const priorDispatches=new Set<string>()
      for(const row of all(session)) {
        if(row.type===deps.markers.dispatchEventType&&row.seq>actualMarker!.seq&&row.data.sessionId===sid) {
          priorDispatches.add(row.data.batchId)
        }
      }
      let owner:RevisionOwner|undefined
      const completedRefs:{key:string;sha256:string}[]=[]
      try {
        for(const [index,original] of originals.entries()) {
          const planKey=mvuSchemaStoryRevisionPlanKey(sid,recordSha256({descriptor:ref,index}))
          let plan:SuffixPlan
          if(savedPlans[index])plan=savedPlans[index]!
          else {
            const selectors=original.encoding==='native-mvu-schema-player-event-v1'
              ?deriveMvuSchemaPlayerRevisionSelectors(original.plan.operation,entries[index]!.event,ref,index,sid)
              :deriveMvuSchemaStoryRevisionSelectorsV2(original.plan.scope,canonical[index]!,prior.original.realmEpoch,ref,index,sid)
            const nativeEvents=all(session)
            if(selectors.some(selector=>priorDispatches.has(selector.batchId)))fail('SCHEMA_REVISION_EXECUTION_UNKNOWN')
            const cut:SourceNativeCutFacts={...original.plan.initialCut,sessionId:sid,ownerSessionId:sid,
              nativeCut:nativeEvents.length,nativePrefixSha256:recordSha256(nativeEvents),
              sourceSnapshotSha256:frame.snapshotSha256,materialSha256:frame.materialSha256,anchor:selectors[0]!.anchor}
            const base=owner?.basis.snapshot??basis.snapshot,execution={sessionId:sid,sourceSha256:next.sourceSha256,root:prior.initial.root}
            const revision={descriptor:ref,index,publicationRevision:next.publicationRevision+index}
            const scopeReadFrame=scopeFrameAt(owner?.basis.readScopes??basis.readScopes!,prior.original,frame,cut,nativeEvents,
              original.plan.initialCut.nativeCut,projection)
            if(original.encoding==='native-mvu-schema-player-event-v1') {
              const {planSha256:_oldPlayer,...originalPlayerPlan}=original.plan
              plan=validateMvuSchemaPlayerRevisionPlan(sealMvuSchemaStoryFact({...originalPlayerPlan,
                schemaVersion:9 as const,encoding:'native-mvu-schema-player-revision-plan-v1' as const,
                original:entries[index]!.event,base,currentFrame:frame,initialCut:cut,selectors,executorVersion:4 as const,
                randomSeed:recordSha256({operation:original.plan.operation,original:entries[index]!.event,revision:ref,index}),
                epoch:priorReady.epochRef,serverProgramSha256:priorReady.epoch.program.serverProgram!.programSha256,
                scopeReadFrame,logicalNativeCut:original.plan.initialCut.nativeCut,execution,revision},'planSha256'))
            }else {
              const {planSha256:_old,maintenance:_maintenance,...originalPlan}=
                original.plan as typeof original.plan&{maintenance?:MvuSchemaMaintenanceCandidateSourceV1}
              const taskEdit=next.schemaVersion===4?next.taskEdits.find(item=>item.index===index)?.selection:undefined
              plan=validateMvuSchemaStoryPlan(sealMvuSchemaStoryFact({...originalPlan,
                ...(taskEdit?{schemaVersion:11 as const,encoding:'native-mvu-schema-story-revision-plan-v3' as const,taskEdit}
                  :{schemaVersion:8 as const,encoding:'native-mvu-schema-story-revision-plan-v2' as const}),canonical:canonical[index]!,
                candidate:candidates[index]!,executorVersion:4 as const,
                base,currentFrame:frame,initialCut:cut,selectors,
                randomSeed:recordSha256({scope:original.plan.scope,canonical:canonical[index]!,revision:ref,index}),
                epoch:priorReady.epochRef,serverProgramSha256:priorReady.epoch.program.serverProgram!.programSha256,
                logicalNativeCut:original.plan.initialCut.nativeCut,
                scopeReadFrame,execution,revision},'planSha256'))
            }
            await putRevisionFact(planKey,plan)
          }
          if(!owner) {
            owner={session,agent,signal,inSource:true,original:prior.original,frame,basis,
              descriptor:next,plan,driver,token:Object.freeze({}),associations:[],projection}
            revisionOwners.set(sid,owner);revisionScopes.set(owner.token,owner)
          }else {
            // Manual phases share a live run within one item. A later item
            // must restore from its own accumulated Journal, including Story
            // phases that did not advance that earlier manual run.
            driver.invalidateOwner(owner.token)
            revisionScopes.delete(owner.token)
            owner.token=Object.freeze({})
            owner.plan=plan;owner.scope=undefined;owner.associations=[];owner.lastLive=undefined
            revisionScopes.set(owner.token,owner)
          }
          const eventKey=mvuSchemaStoryRevisionEventKey(sid,revisionPlanEventId(plan)),savedEvent=prefixInputs.status.get(eventKey)
          // A completed predecessor does not make this Story's undispatched work unknown.
          const recoverOnly=plan.selectors.some(selector=>priorDispatches.has(selector.batchId))
          const event=savedEvent?readRevisionEvent(savedEvent as RevisionEvent)
            :recoverOnly?recoverRevision(owner):await executeRevision(owner)
          if(!isSuffixEvent(event))fail('SCHEMA_REVISION_HISTORY_UNPROVEN')
          // As with the original Player publisher, evidence survives closing
          // the parked manual VM; its cleanup precedes durable publication.
          if(plan.schemaVersion===9)await driver.closeOwner(owner.token)
          await putRevisionFact(eventKey,event)
          if(!isManualRevision(event)&&event.outcome==='refused') {deps.inputState.invalidateSession(sid);return}
          completedRefs.push({key:eventKey,sha256:recordSha256(event)})
          owner.basis=revisionResultBasis(owner.basis,event)
        }
        const completion=validateMvuSchemaStoryRevisionCompletion(sealMvuSchemaStoryFact({
          ...(next.schemaVersion===4?{schemaVersion:4 as const,encoding:'native-mvu-schema-story-revision-completion-v4' as const}
            :next.schemaVersion===3?{schemaVersion:3 as const,encoding:'native-mvu-schema-story-revision-completion-v3' as const}
            :{schemaVersion:2 as const,encoding:'native-mvu-schema-story-revision-completion-v2' as const}),sessionId:sid,descriptor:ref,
          events:completedRefs},'completionSha256'))
        await putRevisionFact(mvuSchemaStoryRevisionCompletionKey(sid,ref.sha256),completion)
        const head=owner!.basis.snapshot.currentHead
        if(priorDispatches.size) {
          const verified=await driver.verifyHistorical({sessionId:sid,realmEpoch:prior.original.realmEpoch,
            nativeCut:owner!.basis.snapshot.schemaFrontier.nativeCut},signal)
          if(verified.kind!=='verified')fail(verified.code)
          const history=factual(session,undefined,true,true)
          if(!same(history.snapshot.currentHead,head))fail('SCHEMA_REVISION_PUBLICATION_UNPROVEN')
        }
        await putRevisionFact(headKey,head,materializedHead)
        deps.inputState.invalidateSession(sid)
        const read=captureSchemaRead(sid)
        if(!same(read.data.history.snapshot.currentHead,head))fail('SCHEMA_REVISION_PUBLICATION_UNPROVEN')
        publishSchemaRead(read)
      }finally {
        if(owner) {
          owner.inSource=false;revisionOwners.delete(sid);revisionScopes.delete(owner.token)
          driver.invalidateOwner(owner.token)
          await driver.closeOwner(owner.token)
        }
      }
    }))
    return true
  }
  async function reconcileAcceptedEditV1(sid:string,requestedSeq?:number):Promise<void> {
    const session=deps.session(sid)
    if(!session||!currentSession(session))return
    const current=deps.currentEdits(session)
    const edit=requestedSeq===undefined?current.reduce<SessionEvent|undefined>((latest,event)=>
      !latest||event.seq>latest.seq?event:latest,undefined):current.find(event=>event.seq===requestedSeq)
    if(edit?.type!=='roleplay/message-edit'||edit.data.role!=='assistant')return
    // Existing V1 derived roots retain their already checked parent prefix.
    // Creating children across a revision requires a separate inheritance
    // contract; this edit owner does not extend that persisted wire.
    if(session.inheritedEventCount||session.header.parentSession) {
      const genesis=deps.readDerivedGenesis?.(sid)
      if(!genesis||genesis.inheritedCut.schemaVersion!==1)return
    }
    // The existing edit owner owns denial durability. An unresolved write must
    // remain blocked and cannot start a different author execution on a GET.
    const invalidation=deps.readEditInvalidation?.(sid)
    // The edit owner already located the earliest edited target. An opening
    // or inherited-prefix edit keeps its denial; replaying a later Story
    // cannot repair the numerical seed that precedes the Story edit floor.
    if(invalidation?.kind!=='invalidated'||invalidation.fromSeq<invalidation.editFloorSeq)return
    const descriptorKey=mvuSchemaStoryRevisionDescriptorKey(sid,recordSha256(edit))
    const stored=prefixInputs.status.get(descriptorKey)
    const descriptor=stored===undefined?undefined:validateMvuSchemaStoryRevisionDescriptor(stored as never)
    // Only an accepted mutation may start work; GET recovers durable revision artifacts.
    if(!descriptor&&requestedSeq===undefined)return
    let savedPlan:MvuSchemaStoryRevisionPlanV1|undefined
    if(descriptor) {
      const planKey=mvuSchemaStoryRevisionPlanKey(sid,recordSha256(descriptor))
      const planRaw=prefixInputs.status.get(planKey)
      if(planRaw) {
        const plan=validateMvuSchemaStoryPlan(planRaw as MvuSchemaStoryRevisionPlanV1)
        savedPlan=plan
        const eventRaw=prefixInputs.status.get(mvuSchemaStoryRevisionEventKey(sid,revisionPlanEventId(plan)))
        if(eventRaw) {
          const event=validateMvuSchemaStoryRevisionEvent(eventRaw as never),head=prefixInputs.status.get(mvuStateCurrentHeadKey(sid))
          if(event.outcome==='refused')return
          if(same(head,mvuSchemaStoryRevisionHead(event))
            ||Number((head as {revision?:number})?.revision)>descriptor.publicationRevision)return
        }
      }
    }
    const rows=eventRows(sid,edit.seq),last=rows.at(-1)?.event
    const originalEvent=descriptor?validateMvuSchemaStoryEvent(prefixInputs.status.get(descriptor.original.key) as never):
      last?.encoding==='native-mvu-schema-story-revision-event-v1'
        ?validateMvuSchemaStoryEvent(prefixInputs.status.get(validateMvuSchemaStoryRevisionDescriptor(
          prefixInputs.status.get(last.plan.revision.descriptor.key) as never).original.key) as never):last
    // Earlier Story suffixes and subsequent manual operations have no local
    // rewind contract. Their accepted edits retain the existing durable denial.
    if(!originalEvent||originalEvent.encoding!=='native-mvu-schema-story-event-v2'
      ||originalEvent.plan.canonical.seq!==edit.data.targetSeq||originalEvent.outcome==='refused'
      ||last?.encoding==='native-mvu-schema-player-event-v1')return
    const target=all(session)[edit.data.targetSeq]
    if(originalEvent.plan.schemaVersion===10&&originalEvent.plan.maintenance.kind==='task-result')
      fail('SCHEMA_MAINTENANCE_REVISION_REQUIRED')
    if(target?.type!=='assistant/message')fail('SCHEMA_REVISION_TARGET_UNPROVEN')
    const message=deps.editProtocol.editMessageText(target.data.message,edit.data)
    const canonical={seq:target.seq,messageId:message.id,versionSha256:recordSha256(message),
      narrative:textOf(message.content),narrativeSha256:sha256(textOf(message.content))}
    const parserPolicy=savedPlan?savedPlan.parserPolicy:
      'parserPolicy' in originalEvent.plan?originalEvent.plan.parserPolicy:undefined
    const candidate=savedPlan?.candidate??parseMvuSchemaStoryCandidateV2(canonical.narrative,parserPolicy)
    // A rejected text remains saved and denied. It cannot produce an event,
    // so do not spend a Native rewind or any author phase on it.
    if(candidate.kind==='rejected')return
    const priorHistory=factual(session,edit.seq,true,true,false,originalEvent.plan.planSha256)
    if(current.some(event=>event.seq!==edit.seq&&event.seq>=priorHistory.editBasis.editFloorSeq
      &&!priorHistory.resolvedEdits.has(event.seq)))return
    const priorReady=priorHistory.ready
    if(!isAuthorHostJournalReadyV5(priorReady))return
    const originalRef={key:mvuSchemaStoryEventKey(sid,originalEvent.eventId),sha256:recordSha256(originalEvent)}
    closedStoryFacts(sid,session.inheritedEventCount,all(session),originalEvent,false)
    const basis=beforeStoryRevision(session,priorHistory,originalEvent)
    const sourceSha256=deps.sourceSha256(sid)
    if(sourceSha256!==originalEvent.sourceSha256)fail('SCHEMA_REVISION_SOURCE_CHANGED')
    const previous=last?.encoding==='native-mvu-schema-story-revision-event-v1'
      ?{key:mvuSchemaStoryRevisionEventKey(sid,last.eventId),sha256:recordSha256(last)}:null
    const next=descriptor??validateMvuSchemaStoryRevisionDescriptor(sealMvuSchemaStoryFact({schemaVersion:1 as const,
      encoding:'native-mvu-schema-story-revision-descriptor-v1' as const,sessionId:sid,
      edit:{seq:edit.seq,sha256:recordSha256(edit),targetSeq:target.seq,messageId:message.id,
        messageVersionSha256:canonical.versionSha256,narrativeSha256:canonical.narrativeSha256},
      original:originalRef,previous,baseStateSnapshotSha256:basis.snapshot.stateSnapshotSha256,
      completionSeq:basis.ready.steps.at(-1)!.completionMarker.seq,
      publicationRevision:Math.max(priorHistory.snapshot.revision,
        last?.encoding==='native-mvu-schema-story-revision-event-v1'?last.plan.revision.publicationRevision:0)+1,
      sourceSha256},'descriptorSha256'))
    const ref={key:descriptorKey,sha256:recordSha256(next)},agent=deps.agent(session)
    if(!agent)fail('SCHEMA_REVISION_OWNER_UNPROVEN')
    await agent.runMaintenance(async signal=>deps.withSourceLock(sid,async()=>{
      signal.throwIfAborted()
      if(!currentSession(session)||deps.agent(session)!==agent)fail('SCHEMA_REVISION_PERMISSION_REVOKED')
      // A completed predecessor may not have published its logical head.
      // This Source/Native owner replaces the actual materialized row by CAS.
      const headKey=mvuStateCurrentHeadKey(sid),materializedHead=prefixInputs.status.get(headKey)
      await putRevisionFact(descriptorKey,next)
      let marker=all(session).find(event=>event.type===deps.markers.revisionEventType&&event.data.descriptor.key===ref.key)
      if(!marker) {
        marker=deps.markers.appendRevision(session,{schemaVersion:1,encoding:'native-mvu-schema-revision-marker-v1',
          sessionId:sid,realmEpoch:originalEvent.plan.realmEpoch,descriptor:ref,editSeq:edit.seq,
          completionSeq:next.completionSeq,observedNativeSeq:all(session).length-1})
        if(!await deps.flush(session))fail('SCHEMA_REVISION_FLUSH_UNKNOWN')
      }
      const frame=deps.source.captureFrame(basis.original,sid),planKey=mvuSchemaStoryRevisionPlanKey(sid,ref.sha256)
      const planRaw=prefixInputs.status.get(planKey)
      let plan:MvuSchemaStoryRevisionPlanV1
      if(planRaw)plan=validateMvuSchemaStoryPlan(planRaw as MvuSchemaStoryRevisionPlanV1)
      else {
        const events=all(session),selectors=deriveMvuSchemaStoryRevisionSelectors(originalEvent.plan.scope,canonical,
          originalEvent.plan.realmEpoch,ref)
        const initialCut:SourceNativeCutFacts={...originalEvent.plan.initialCut,nativeCut:events.length,
          nativePrefixSha256:recordSha256(events),sourceSnapshotSha256:frame.snapshotSha256,
          materialSha256:frame.materialSha256,anchor:selectors[0]!.anchor}
        const {planSha256:_oldPlanHash,maintenance:_maintenance,...originalPlan}=
          originalEvent.plan as typeof originalEvent.plan&{maintenance?:MvuSchemaMaintenanceCandidateSourceV1}
        plan=validateMvuSchemaStoryPlan(sealMvuSchemaStoryFact({...originalPlan,
          schemaVersion:7 as const,encoding:'native-mvu-schema-story-revision-plan-v1' as const,
          canonical,candidate,base:basis.snapshot,currentFrame:frame,initialCut,selectors,
          randomSeed:recordSha256({scope:originalEvent.plan.scope,canonical,revision:ref}),
          executorVersion:4 as const,epoch:priorHistory.ready.epochRef,
          serverProgramSha256:priorReady.epoch.program.serverProgram!.programSha256,
          scopeReadFrame:scopeFrameAt(basis.readScopes!,basis.original,frame,initialCut,events),
          revision:{descriptor:ref,publicationRevision:next.publicationRevision}},'planSha256'))
        await putRevisionFact(planKey,plan)
      }
      const eventKey=mvuSchemaStoryRevisionEventKey(sid,revisionPlanEventId(plan)),completed=prefixInputs.status.get(eventKey)
      const {driver}=await engine(basis.ready)
      const owner:RevisionOwner={session,agent,signal,inSource:true,original:basis.original,frame,basis,
        descriptor:next,plan,driver,token:Object.freeze({}),associations:[]}
      revisionOwners.set(sid,owner);revisionScopes.set(owner.token,owner)
      try {
        let event:MvuSchemaStoryRevisionEvent,recovered=false
        if(completed) {
          event=validateMvuSchemaStoryRevisionEvent(completed as never)
          recovered=true
        }
        else {
          recovered=all(session).some(entry=>entry.type===deps.markers.dispatchEventType
            &&plan.selectors.some(selector=>selector.batchId===entry.data.batchId))
          event=(recovered?recoverRevision(owner):await executeRevision(owner)) as MvuSchemaStoryRevisionEvent
          await putRevisionFact(eventKey,event)
        }
        if(recovered) {
          // Persisted DATA carries no live execution evidence. Its actual
          // historical tail must be verified before this owner repairs a head.
          const verified=await driver.verifyHistorical({sessionId:sid,realmEpoch:plan.realmEpoch,
            nativeCut:event.frontier.nativeCut},owner.signal)
          if(verified.kind!=='verified')fail(verified.code)
          if(event.outcome!=='refused') {
            const history=factual(session,undefined,true,true)
            if(!same(history.snapshot.currentHead,mvuSchemaStoryRevisionHead(event)))fail('SCHEMA_REVISION_PUBLICATION_UNPROVEN')
          }
        }
        // A completed refusal settles its real journal tail, while its edit
        // stays denied. It publishes neither numerical values nor a new head.
        if(event.outcome==='refused') {
          deps.inputState.invalidateSession(sid)
          return
        }
        const head=mvuSchemaStoryRevisionHead(event)
        await putRevisionFact(headKey,head,materializedHead)
        deps.inputState.invalidateSession(sid)
        const read=captureSchemaRead(sid)
        if(!same(read.data.history.snapshot.currentHead,head))fail('SCHEMA_REVISION_PUBLICATION_UNPROVEN')
        publishSchemaRead(read)
      }finally {
        owner.inSource=false;revisionOwners.delete(sid);driver.invalidateOwner(owner.token)
      }
    }))
  }
  function captureSchemaRead(sid:string):RoleplayInputStateRead<SchemaReadData> {
    // captureSchema replaces its own stale read. Refreshing this consumer
    // cannot revoke another current operation, such as Ruby's Source capture.
    const session=deps.session(sid)
    if(!session||!currentSession(session))fail('SCHEMA_SESSION_INACTIVE')
    const capture=()=>deps.inputState.captureSchema(sid,()=>{
      const history=factual(session,undefined,false,true,true)
      return {session,agent:deps.agent(session),history,frame:deps.source.captureFrame(history.original,sid)}
    })
    let read=capture()
    if(!readDataCurrent(read.data)) {
      deps.inputState.invalidateSession(sid)
      read=capture()
    }
    return read
  }
  function publishSchemaRead(read:RoleplayInputStateRead<SchemaReadData>):void {
    const view:View={...read.data,read},sid=view.session.id
    if(!viewCurrent(view))fail('SCHEMA_HISTORICAL_FACTS_CHANGED')
    views.set(sid,view)
    deps.inputState.schemaPublished(sid)
  }
  /** Called synchronously by Player inside its live Source publication. The
   * callback joins this actual Store/Native read to its existing Replay proof;
   * no posted snapshot or completed terminal alone can publish a view. */
  function adoptPublishedPlayer(sid:string,accepts:(ready:SchemaJournalReady)=>boolean):void {
    const read=captureSchemaRead(sid)
    if(!accepts(read.data.history.ready))fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
    publishSchemaRead(read)
  }
  async function preflight(sid:string,signal?:AbortSignal):Promise<void> {
    signal?.throwIfAborted()
    const session=deps.session(sid),recoveredEdit=session?await deps.recoverTaskEdit?.(session):undefined
    const existing=views.get(sid)
    if(existing&&viewCurrent(existing))return
    await reconcileAcceptedEdit(sid,recoveredEdit)
    signal?.throwIfAborted()
    const revised=views.get(sid)
    if(revised&&viewCurrent(revised))return
    const read=captureSchemaRead(sid)
    // Capture consumes the accepted Store/Native history; publication checks
    // that its dependencies still belong to this owner without executing it again.
    publishSchemaRead(read)
  }
  function observation(sid:string):InputObservation|undefined {
    const view=views.get(sid)
    return view&&viewCurrent(view)?{kind:'story',sourceSha256:view.history.snapshot.sourceSha256,
      headRef:{kind:'schema-head',sha256:view.history.snapshot.stateSnapshotSha256}}:undefined
  }
  function readSnapshot(sid:string):MvuSchemaNumericalSnapshotV2|undefined {
    const view=views.get(sid)
    return view&&viewCurrent(view)?structuredClone(view.history.snapshot):undefined
  }
  function supportsMaintenance(sid:string):boolean {
    const view=views.get(sid)
    return !!view&&viewCurrent(view)&&isAuthorHostJournalReadyV5(view.history.ready)
  }
  async function checkTextEdit(sid:string,targetSeq:number):Promise<void> {
    await preflight(sid)
    const history=views.get(sid)?.history,last=history?.lastTaskResultCanonicalSeq
    if(last!==undefined&&targetSeq<=last)fail('SCHEMA_MAINTENANCE_REVISION_REQUIRED')
  }
  async function taskEditFacts(sid:string,targetSeq:number) {
    await preflight(sid)
    const view=views.get(sid)
    if(!view||!viewCurrent(view))fail('SCHEMA_TASK_EDIT_BASIS_UNAVAILABLE')
    return {artifacts:[...view.history.taskArtifacts].filter(([seq])=>seq>=targetSeq).map(([,artifact])=>artifact),
      sourceSha256:view.history.snapshot.sourceSha256,headSha256:view.history.snapshot.headSha256,nativeCut:view.session.seq}
  }
  function taskArtifact(sid:string,canonicalSeq:number) {
    const artifact=views.get(sid)?.history.taskArtifacts.get(canonicalSeq)
    if(!artifact)return
    const candidate=(prefixInputs.status.get(artifact.sourceEventRef.key) as TaskArtifactSourceFact).plan.candidate
    return {sha256:artifact.sourceEventRef.sha256,kind:artifact.effectiveKind,
      operationCount:candidate.kind==='parsed'?candidate.operations.length:0}
  }
  const taskEditResolved=(sid:string,editSeq:number)=>views.get(sid)?.history.resolvedEdits.has(editSeq)===true
  /** Phase A already validated and sealed this complete numerical snapshot.
   * Proposal context reuses it; the closing owner still proves current history
   * before granting any numerical publication permission. */
  function captureMaintenanceBase(sid:string,currency:InputPreparationCurrency) {
    if(currency.source.kind!=='story'||currency.source.headRef?.kind!=='schema-head'
      ||!currency.snapshot||!inputSnapshotReferenceCurrent(prefixInputs.branch,sid,currency))return undefined
    const row=prefixInputs.branch.get(currency.snapshot.key) as {numericalState:MvuSchemaNumericalSnapshotV2}
    return {base:row.numericalState,parserPolicy:'analysis-alias-rfc6902-members-v1' as const}
  }
  function readSchemaObservation(sid:string):{snapshot:MvuSchemaNumericalSnapshotV2;
    displayUpdates:readonly MvuAcceptedDisplayUpdate[];
    lastTaskResultCanonicalSeq?:number;
    unavailableExternalAddons?:readonly Extract<CombinedPlanRowV4,{disposition:'external-addon-unavailable'}>[];
    commandDiagnostics?:readonly MvuDiscardedCommandObservation[]}|undefined {
    const view=views.get(sid),history=view&&viewCurrent(view)?view.history:undefined
    if(!history)return undefined
    const epoch=history.ready.epoch,program=epoch.schemaVersion===5?epoch.program:undefined
    const unavailableExternalAddons=program?.schemaVersion===7
      ?program.executionPlan.scripts.filter(row=>row.disposition==='external-addon-unavailable'):undefined
    return {snapshot:structuredClone(history.snapshot),displayUpdates:history.displayUpdates??[],
      ...history.lastTaskResultCanonicalSeq!==undefined?{lastTaskResultCanonicalSeq:history.lastTaskResultCanonicalSeq}:{},
      ...history.commandDiagnostics.length?{commandDiagnostics:history.commandDiagnostics}:{},
      ...unavailableExternalAddons?.length?{unavailableExternalAddons}:{}}
  }
  /** Read existing completed scope facts for a frozen prompt. This creates no
   * schema execution cut, selector, closing lease, write or Native permission.
   * The caller separately owns Source and the actual in-flight Native step. */
  function captureAuthorOpening(view:View,frame:MvuScopeReadFrameV1,events:readonly SessionEvent[])
    :AuthorPromptPreparationFactsV1['opening'] {
    const identity=view.history.original.preparation.identity,
      anchor=frame.messages.find(row=>row.messageId===identity.messageId),event=anchor?events[anchor.nativeSeq]:undefined
    if(event?.type!=='assistant/message'||event.data.message.id!==identity.messageId)
      fail('PROMPT_PROGRAM_OPENING_ANCHOR_UNAVAILABLE')
    const originalMessageVersionSha256=recordSha256(event.data.message),
      candidates=deps.source.readOriginalOpeningCandidates(view.history.original),
      selected=candidates.findIndex(row=>row.index===identity.index)
    const copiedCandidates=selected>=0&&sha256(textOf(event.data.message.content))===identity.renderedSha256
      ?{source:'native-author-copy-opening-candidates-v1' as const,
        swipes:candidates.map(row=>row.renderedText),swipe_id:selected}:null
    return {messageId:identity.messageId,originalMessageVersionSha256,copiedCandidates}
  }
  /** Reader needs two current variable scopes, not a reconstructed prompt or
   * a second history admission. The existing read owns every consumed row. */
  function captureReaderDisplayScopes(sid:string):ReaderDisplayScopes|undefined {
    const view=views.get(sid)
    if(!view)return
    if(disposed||!view.read.current()||deps.session(sid)!==view.session
      ||deps.agent(view.session)!==view.agent)return
    const source=schemaScopeSource(view.frame.snapshot),facts=view.history.readScopes,
      ready=view.history.ready,bindings:TavernTemplateScopeBindingV1[]=[]
    const browser=isAuthorHostJournalReadyV5(ready)?ready.epoch.program.browserProgram:undefined,
      binding=browser?.schemaVersion===2?deriveAuthorChatBindingV1(sid,browser):null,
      authorChat=binding&&deps.authorChat?deps.authorChat.capture(binding):null
    const available=(scope:'chat'|'global',variables:MvuScopeVariablesV1)=>{
      if(variables.kind!=='available')return
      const overlay=scope==='chat'&&authorChat?.exists?authorChat:null,
        values=overlay?{...variables.variables,[overlay.binding.key]:overlay.value}:variables.variables,
        versionSha256=overlay?recordSha256({mvu:variables.provenance,authorChat:overlay.captureSha256})
          :recordSha256(variables.provenance)
      bindings.push({scope,ownerId:`${sid}:prompt-scope:${scope}`,versionSha256,
        values,valuesSha256:recordSha256(values)})
    }
    if(facts) {
      available('chat',schemaScopeReowner(facts.chat,schemaScopeOwner(source,'chat')))
      available('global',schemaScopeEmpty(schemaScopeOwner(source,'global')))
    }
    return {source,bindings,versionSha256:recordSha256({source,state:view.history.snapshot.stateSnapshotSha256,
      scopes:bindings.map(({scope,ownerId,versionSha256,valuesSha256})=>({scope,ownerId,versionSha256,valuesSha256}))}),
      displayUpdates:view.history.displayUpdates??[]}
  }
  function capturePromptScopes(sid:string) {
    const view=views.get(sid),facts=view?.history.readScopes
    if(!view||!facts||!viewCurrent(view))return undefined
    const events=all(view.session),source=schemaScopeSource(view.frame.snapshot)
    const basis=Object.freeze({schemaVersion:1 as const,encoding:'native-mvu-prompt-scope-read-basis-v1' as const,
      authority:'consumer-data-only' as const,sessionId:sid,sourceSnapshotSha256:view.frame.snapshotSha256,
      materialSha256:view.frame.materialSha256,numericalSnapshotSha256:view.history.snapshot.stateSnapshotSha256,
      nativeCut:events.length,nativePrefixSha256:recordSha256(events)})
    const frame=buildSchemaScopeReadFrame(source,recordSha256(basis),schemaOriginalServerScripts(view.history.original),
      facts.chat,schemaScopeVisibleMessages(events,deps.projectPrefix,source,
        seq=>scopeOwnerForSeq(facts,seq),facts.messages,'canonical-chat'))
    const data=Object.freeze({schemaVersion:1 as const,encoding:'native-mvu-prompt-scope-read-data-v1' as const,
      authority:'consumer-data-only' as const,basis,frame,readDataSha256:recordSha256({basis,frame})})
    // A later own pending input or interrupted provider attempt does not change
    // these already captured variable reads. Native's material owner validates
    // their selected message versions and its evolving request cut separately.
    let declared:ReturnType<typeof captureDeclaredChatKeys>=[]
    const current=()=>viewCurrent(view)&&declared.every(row=>row.capture.current())
    if(!current())return undefined
    const ready=view.history.ready,combined=isAuthorHostJournalReadyV5(ready)?ready.epoch.program:undefined,
      browser=combined?.browserProgram,program=combined&&'promptProgram' in combined?combined.promptProgram:undefined
    if(!program&&browser?.schemaVersion!==2&&browser?.schemaVersion!==3)return {data,current}
    // The admitted program owns its Prompt partition across Combined versions.
    // Prompt and Browser share this capture of the same original Native opening.
    const opening=captureAuthorOpening(view,frame,events),
      binding=browser?.schemaVersion===2?deriveAuthorChatBindingV1(sid,browser):null,
      authorChat=binding&&deps.authorChat?deps.authorChat.capture(binding):null
    let authorPrompt:AuthorPromptPreparationFactsV1|undefined,authorBrowser:AuthorBrowserPreparationFactsV2|undefined
    if(program)authorPrompt={program,opening,
      scopes:produceAuthorPromptScopeFrameV1(frame,program),...authorChat?{authorChat}:{}}
    if(browser?.schemaVersion===2) {
      const context=view.frame.material.openingContext as {user:string;user_gender?:string}
      authorBrowser={program:browser,opening,scopes:produceAuthorPromptScopeFrameV1(frame,browser),
        basis:{materialSha256:view.frame.materialSha256,numericalSnapshotSha256:view.history.snapshot.stateSnapshotSha256},
        numerical:browserNumericalSnapshot(view,events.length),
        persona:{name:context.user,...context.user_gender!==undefined?{gender:context.user_gender}:{},avatar:null},authorChat}
    }
    let authorBrowserV3:AuthorBrowserPreparationFactsV3|undefined
    if(browser?.schemaVersion===3) {
      declared=captureDeclaredChatKeys(sid,browser)
      const context=view.frame.material.openingContext as {user:string;user_gender?:string}
      authorBrowserV3={program:browser,opening,
        scopes:produceAuthorPromptScopeFrameV1(frame,browser),
        basis:{materialSha256:view.frame.materialSha256,numericalSnapshotSha256:view.history.snapshot.stateSnapshotSha256},
        numerical:browserNumericalSnapshot(view,events.length),
        persona:{name:context.user,...context.user_gender!==undefined?{gender:context.user_gender}:{},avatar:null},
        authorChats:declared.map(row=>({declarationId:row.declarationId,capture:row.capture.data}))}
    }
    return {data,current,...authorPrompt?{authorPrompt}:{},...authorBrowser?{authorBrowser}:{},
      ...authorBrowserV3?{authorBrowserV3}:{}}
  }
  function captureDeclaredChatKeys(sid:string,program:BrowserProgramV3) {
    return program.declarations.map(declaration=>{
      if(!deps.authorChat)fail('AUTHOR_CHAT_STATE_UNAVAILABLE')
      return {declarationId:declaration.declarationId,
        capture:deps.authorChat.captureWithCurrencyV2(deriveAuthorChatBindingV2(sid,program,declaration))}
    })
  }
  function browserNumericalSnapshot(view:View,nativeCut:number):BrowserSnapshotV2['numerical'] {
    const snapshot=view.history.snapshot,sid=view.session.id,
      editBlockCode=(deps.manualEditBlockCode??deps.manualPendingCode)?.(sid)
    return {kind:'schema-ready',values:snapshot.values,expected:{sourceSha256:snapshot.sourceSha256,
      root:snapshot.root,revision:snapshot.revision,headSha256:snapshot.headSha256,
      valuesSha256:snapshot.valuesSha256,stateSnapshotSha256:snapshot.stateSnapshotSha256,observedNativeSeq:nativeCut-1},
      canEdit:!editBlockCode,...editBlockCode?{editBlockCode}:{}}
  }
  /** The completed history already admitted this exact Host generation.
   * The material owner holds Source/currentness and validates the await. */
  async function executePrompt(sid:string,program:PromptProgramV1,capture:PromptCaptureV1,signal?:AbortSignal) {
    const view=views.get(sid)
    if(!view)fail('AUTHOR_PROMPT_HISTORY_UNAVAILABLE')
    const {runtime}=await engine(view.history.ready)
    if(!('host' in runtime))fail('AUTHOR_PROMPT_RUNTIME_UNAVAILABLE')
    const prompt=runtime.prompt,result=await prompt.execute(program,capture,signal)
    if(result.kind!=='refused'||result.diagnostics[0]?.code!=='PROMPT_PROGRAM_NOT_COMPILED')return result
    // A fresh historical owner has lost its live compilation admission. This
    // refusal precedes dispatch; compilation restores admission without callbacks.
    if(!await prompt.compiler.verifyProgram(program,signal))return result
    return prompt.execute(program,capture,signal)
  }
  function captureManualBasis(sid:string) {
    const view=views.get(sid)
    if(!view||!viewCurrent(view))fail('SCHEMA_PLAYER_BASE_UNPROVEN')
    const basis={session:view.session,agent:view.agent,original:view.history.original,
      ready:view.history.ready,base:view.history.snapshot,frame:view.frame,inheritedCut:view.history.inheritedCut,
      scopeReadFrame:(cut:SourceNativeCutFacts)=>{
        if(!view.history.readScopes||!scopeFactsCurrent(view.history.readScopes)
          ||!currentSession(view.session)||deps.agent(view.session)!==view.agent
          ||!deps.source.frameCurrent(view.history.original,view.frame))fail('SCHEMA_SCOPE_BASIS_UNPROVEN')
        // The maintenance owner invokes this synchronous reader under its
        // Source lease after verifying its exact numerical row baseline.
        return scopeFrameAt(view.history.readScopes,view.history.original,view.frame,cut,all(view.session))
      }}
    if(view.history.inheritedReady)Object.defineProperty(basis,'inheritedReady',{value:view.history.inheritedReady})
    return basis as typeof basis&{readonly inheritedReady?:SchemaJournalReady}
  }
  function captureAuthorReadFacts(sid:string,readerDocument:true):Promise<ReaderRegexDocumentReadFactsV1|undefined>
  function captureAuthorReadFacts(sid:string,readerDocument?:false):Promise<AuthorBrowserCapturedFacts|undefined>
  async function captureAuthorReadFacts(sid:string,readerDocument=false):
    Promise<AuthorBrowserCapturedFacts|ReaderRegexDocumentReadFactsV1|undefined> {
    await preflight(sid)
    const view=views.get(sid)
    if(!view||!viewCurrent(view))fail('SCHEMA_BROWSER_FACTS_UNPROVEN')
    const ready=view.history.ready
    if(!isAuthorHostJournalReadyV5(ready))return undefined
    if(!readerDocument&&!ready.epoch.program.browserProgram)return undefined
    const program=ready.epoch.program.browserProgram,{runtime}=await engine(ready)
    if(!('host' in runtime)||!viewCurrent(view))fail('SCHEMA_BROWSER_FACTS_CHANGED')
    const facts=view.history.readScopes
    if(!facts||!view.agent)fail('SCHEMA_BROWSER_FACTS_UNPROVEN')
    const session=view.session,agent=view.agent,original=view.history.original,frame=view.frame
    const stopSha256=recordSha256(agent.lookupInputStop()),events=all(session),snapshot=view.history.snapshot
    const source=schemaScopeSource(frame.snapshot)
    const basis={sessionId:sid,sourceSnapshotSha256:frame.snapshotSha256,materialSha256:frame.materialSha256,
      numericalSnapshotSha256:snapshot.stateSnapshotSha256,nativeCut:events.length,nativePrefixSha256:recordSha256(events)}
    // Project the selected complete Native prefix once for both Browser text
    // and scope messages. Reader pagination and maintenance prose do not enter.
    const projected=deps.projectPrefix(events as never)
    const selected={id:sid,events,surface:{nodes:projected.nodes},
      deriveEventMessage:(entry:ContextEvent)=>projected.projectedMessageAt(entry.seq)} as ContextSession
    const messages:BrowserChatMessageSnapshotV1[]=[]
    const scoped=surfaceEntries(selected).map((entry,position)=>{
      const event=events[entry.seq]
      const raw=event?.type==='assistant/message'?event.data.message:event?.type==='user/message'?event.data:undefined
      const message=projected.projectedMessageAt(entry.seq)??raw,nativeOwner=scopeOwnerForSeq(facts,entry.seq)
      if(!message||message.id!==entry.messageId)fail('SCHEMA_SCOPE_MESSAGE_UNPROVEN')
      const messageVersionSha256=recordSha256(message)
      const key=schemaScopeMessageKey(nativeOwner,entry.seq,entry.messageId,messageVersionSha256)
      const publication=facts.messages.get(key)
      const ownerSessionId=publication?.kind==='available'?publication.provenance.owner.sessionId:nativeOwner
      const owner=schemaScopeOwner(source,'message',entry.messageId,ownerSessionId)
      const variables=schemaScopeReowner(publication??schemaScopeEmpty(owner),owner)
      const identity={position,ownerSessionId,nativeSeq:entry.seq,messageId:entry.messageId,messageVersionSha256,
        selectedVariant:messageVersionSha256}
      messages.push({...identity,role:entry.kind,text:textOf(message.content)})
      return {...identity,isSystem:false as const,variables}
    })
    const descriptors=program?program.scripts.map(row=>row.descriptor):schemaOriginalCompilationInput(original).scripts
    const scopeFrame=buildSchemaScopeReadFrame(source,recordSha256(basis),descriptors,
      facts.chat,scoped)
    const data:Omit<BrowserSnapshotV1,'generation'|'readRevision'>={schemaVersion:1,encoding:'native-author-browser-snapshot-v1',
      basis,scopeFrame,messages,numerical:browserNumericalSnapshot(view,events.length)}
    // Attachment stability outlives this DATA's numerical/Native cut. Each
    // subsequent capture refreshes the view; writes keep their actual owner.
    const ownerCurrent=()=>{
      try {
        runtime.host.checkCurrent()
        return currentSession(session)&&deps.agent(session)===agent&&agent.session===session
          &&recordSha256(agent.lookupInputStop())===stopSha256
      }catch {return false}
    }
    const current=()=>ownerCurrent()&&deps.source.frameCurrent(original,frame)
    if(!current())fail('SCHEMA_BROWSER_FACTS_CHANGED')
    if(!readerDocument&&program?.schemaVersion===1)return {program,artifact:runtime.browser.artifact as import('./tavern-author-browser-types.mjs').BrowserRuntimeArtifactV1,
      data,current}
    const opening=captureAuthorOpening(view,scopeFrame,events)
    // Match the generation capture's opening-zero author history. Native
    // import dialogue remains in its own scope frame, outside this projection.
    const start=messages.findIndex(message=>message.messageId===opening.messageId)
    const capturedMessages:PromptCapturedMessageV1[]=messages.slice(start).map((message,index)=>({index,
      messageId:message.messageId,ownerSessionId:message.ownerSessionId,nativeSeq:message.nativeSeq,
      messageVersionSha256:message.messageVersionSha256,role:message.role,message:message.text,
      variables:scoped[start+index]!.variables,
      variants:message.messageId===opening.messageId&&message.messageVersionSha256===opening.originalMessageVersionSha256
        ?opening.copiedCandidates:null}))
    const context=frame.material.openingContext as {user:string;user_gender?:string}
    // This is the currently selected import's decoded Native DATA, already
    // captured in the Source frame. An unrelated author table row cannot
    // become getContext().characters[characterId] by lexical sort order.
    const card=frame.material.card as MvuJsonObject,native=card.data as MvuJsonObject
    const character:NativeBrowserCharacterV1={sourceId:frame.snapshot.source.importId,
      name:String(native.name),...typeof native.avatar==='string'?{avatar:native.avatar}:{}}
    if(readerDocument) {
      const readerData:Omit<ReaderRegexDocumentSnapshotV1,'generation'|'readRevision'>={...data,
        schemaVersion:1,encoding:'reader-regex-document-snapshot-v1',messages:capturedMessages,
        persona:{name:context.user,...context.user_gender!==undefined?{gender:context.user_gender}:{},avatar:null},
        character,authorChats:[]}
      return {kind:'reader-regex-document-facts',data:readerData,current} satisfies ReaderRegexDocumentReadFactsV1
    }
    if(!program)return undefined
    if(program.schemaVersion===3) {
      const owned=captureDeclaredChatKeys(sid,program)
      const dataV3:Omit<BrowserSnapshotV3,'generation'|'readRevision'>={...data,
        schemaVersion:3,encoding:'native-author-browser-snapshot-v3',messages:capturedMessages,
        persona:{name:context.user,...context.user_gender!==undefined?{gender:context.user_gender}:{},avatar:null},character,
        authorChats:owned.map(row=>({declarationId:row.declarationId,capture:row.capture.data}))}
      return {program,artifact:runtime.browser.artifact as BrowserRuntimeArtifactV3,data:dataV3,
        sourceCurrent:()=>ownerCurrent()&&deps.source.frameIdentityCurrent(frame),
        current:()=>current()&&owned.every(row=>row.capture.current()),
        ...(program.requiredCapabilities.includes('owned-script-source-resources')
          ?{resources:deps.source.captureScriptResources(frame)}:{})}
    }
    if(program.schemaVersion===2) {
      const authorBinding=deriveAuthorChatBindingV1(sid,program)
      const dataV2:Omit<BrowserSnapshotV2,'generation'|'readRevision'>={...data,
        schemaVersion:2,encoding:'native-author-browser-snapshot-v2',messages:capturedMessages,
        persona:{name:context.user,...context.user_gender!==undefined?{gender:context.user_gender}:{},avatar:null},
        authorChat:authorBinding&&deps.authorChat?deps.authorChat.capture(authorBinding):null,character}
      return {program,artifact:runtime.browser.artifact as BrowserRuntimeArtifactV2,data:dataV2,current,
        ...(program.requiredCapabilities.includes('owned-script-source-resources')
          ?{resources:deps.source.captureScriptResources(frame)}:{})}
    }
  }
  async function captureBrowserFacts(sid:string) {
    return captureAuthorReadFacts(sid)
  }
  async function captureReaderDocumentFacts(sid:string):Promise<ReaderRegexDocumentReadFactsV1|undefined> {
    return captureAuthorReadFacts(sid,true)
  }
  /** A denial basis survives later projection/head changes. This selects only
   * immutable original Native/author facts and never exposes numerical values. */
  function readEditBasis(sid:string) {
    try {
      if(capturingEditBasis?.sid===sid)return capturingEditBasis.basis
      const view=views.get(sid)
      if(view&&viewCurrent(view))return view.history.editBasis
      const session=deps.session(sid)
      if(!session)return undefined
      if(deps.derivedRequired?.(sid)) {
        const genesis=deps.readDerivedGenesis?.(sid)
        return genesis?{root:genesis.snapshot.root,editFloorSeq:genesis.inheritedCut.nativeCut}:undefined
      }
      const raw=prefixInputs.status.get(mvuInitializationHeadKey(sid))
      if(!raw)return undefined
      const head=validateMvuSchemaOpeningHead(raw as never)
      const event=validateMvuSchemaOpeningEvent(prefixInputs.status.get(mvuInitializationEventKey(sid,head.eventId)) as never)
      const intent=validateMvuSchemaOpeningIntent(prefixInputs.branch.get(openingIntentKey(sid,event.plan.identity.source.importId)) as never)
      const events=all(session),native=event.native
      if(native.turnEndSeq>=events.length||!verifyMvuSchemaInheritedOpeningFacts({intent,event,head,
        events:events.slice(0,native.turnEndSeq+1)},{projectPrefix:deps.projectPrefix}))return undefined
      const cut=intent.initialization!.execution.completionMarker.seq+1
      const {original}=deps.source.captureCurrentOriginal(intent.preparation,{sessionId:sid,table:prefixInputs.status,
        events:events.slice(0,cut)},true)
      return {root:{openingEventId:event.eventId,openingEventSha256:event.eventSha256,
        openingHeadSha256:recordSha256(head),openingPlanSha256:event.plan.planSha256,
        realmEpoch:original.realmEpoch,programSha256:schemaOriginalProgramSha256(original)},editFloorSeq:native.turnEndSeq+1}
    }catch {return undefined}
  }
  function ownerFor(closing:object,plan:MvuSchemaStoryPlan):Owner|undefined {
    const owner=owners.get(plan.base.sessionId)
    return owner&&owner.lease===closing&&same(owner.plan,plan)?owner:undefined
  }
  const transaction=createRoleplayMvuSchemaStory({table:prefixInputs.status,
    readReady:(_scope,plan)=>{
      const owner=owners.get(plan.base.sessionId)
      return owner&&same(owner.plan,plan)
        ?{kind:'ready',snapshot:owner.base}:{kind:'blocked',code:'SCHEMA_STORY_BASE_CHANGED'}
    },closingCurrent:(closing,scope,plan)=>{
      const owner=ownerFor(closing,plan)
      return !!owner&&same(scope,plan.scope)&&ownerCurrent(owner)
    },executePhase:async(plan,phase,input,closing)=>{
      const owner=ownerFor(closing,plan)
      if(!owner)return {kind:'blocked',code:'SCHEMA_STORY_PERMISSION_REVOKED'}
      return withLease(owner,async()=>{
        const index=MVU_SCHEMA_STORY_PHASES.indexOf(phase),selector=plan.selectors[index]!
        if(index!==owner.associations.length)fail('SCHEMA_STORY_PHASE_ORDER')
        const session=owner.view.session as Session,events=all(session),cut:SourceNativeCutFacts={...plan.initialCut,
          nativeCut:events.length,nativePrefixSha256:recordSha256(events),anchor:selector.anchor}
        const captureJournal=()=>owner.inheritedReady
          ?journal.captureChecked(session.id,plan.realmEpoch,all(session),owner.inheritedReady)
          :journal.capture(session.id,plan.realmEpoch,all(session),owner.inheritedCut)
        const ready=captureJournal()
        if(ready.kind!=='ready')fail(ready.code)
        let capturedInput=input
        if(input.schemaVersion===3||input.schemaVersion===4) {
          if((plan.schemaVersion!==4&&plan.schemaVersion!==5&&plan.schemaVersion!==6&&plan.schemaVersion!==10)||input.schemaVersion!==plan.executorVersion
            ||!owner.readScopes||!schemaScopeReadFactsEqual(input.scopeReadFrame,plan.scopeReadFrame)) {
            fail('SCHEMA_SCOPE_BASIS_UNPROVEN')
          }
          const expected=scopeFrameAt(owner.readScopes,owner.original,owner.frame,cut,events)
          if(!schemaScopeReadFactsEqual(expected,plan.scopeReadFrame))fail('SCHEMA_SCOPE_BASIS_UNPROVEN')
          capturedInput=Object.freeze({...input,scopeReadFrame:freezeSchemaJournalData(expected)})
        }
        const requestedStep=schemaTraceRequestedStep(selector.batchId,
          {ownerSessionId:session.id,sourceNativeCutSha256:recordSha256(cut),material:owner.frame.material},capturedInput)
        Object.freeze(requestedStep.frame)
        Object.freeze(requestedStep)
        owner.scope={owner:owner.token,incarnation:owner.view.agent,session,
          signal:AbortSignal.any([owner.view.signal,owner.abort.signal]),authorInput:schemaOriginalReplayCompilationInput(owner.original),
          realmEpoch:plan.realmEpoch,loadFrame:schemaEpochExecution(ready.epoch).loadFrame,inheritedCut:owner.inheritedCut,
          sourceNativeCut:freezeSchemaJournalData(cut),requestedStep,journalCut:ready,compiledProgram:owner.compiledProgram,
          ...owner.original.schemaVersion===5
            &&(owner.original.preparation.compilation.schemaVersion===6||owner.original.preparation.compilation.schemaVersion===7)
            &&!owner.compiledProgram
            ?{compilationResources:deps.source.captureOriginalCompilationResources(owner.original)}:{}}
        // Replay may be a separate Host5 bundle. The actual Node producer owns
        // this capture; its checked DATA never becomes a cross-bundle token.
        if(owner.inheritedReady)Object.defineProperty(owner.scope,'inheritedReady',{value:owner.inheritedReady})
        Object.defineProperty(owner.scope,'captureJournal',{value:captureJournal})
        const {driver:replay}=await engine(ready)
        if(owner.driver!==replay)fail('SCHEMA_IMPLEMENTATION_CHANGED')
        const result=await replay.execute(selector)
        if(result.kind==='completed') {
          owner.compiledProgram=result.compiledProgram
          if(input.schemaVersion===3||input.schemaVersion===4)result.capturedInput=capturedInput
          owner.lastLive=result;owner.associations.push(result.association)
        }
        return result
      })
    },withPublicationBoundary:async(closing,lastLive,action)=>{
      const owner=[...owners.values()].find(value=>value.lease===closing&&value.lastLive===lastLive)
      if(!owner)fail('SCHEMA_OWNER_UNPROVEN')
      return withLease(owner,action)
    },checkPublication:(closing,lastLive,boundary)=>{
      const owner=ownerFor(closing,boundary.plan)
      if(!owner||owner.lastLive!==lastLive||!owner.inSource||sourceLeases.get(owner.view.session.id)!==owner)return false
      owner.publication=boundary
      if(!ownerCurrent(owner)||!same(boundary.event.phases.map(phase=>phase.association),owner.associations))return false
      const ready=owner.inheritedReady
        ?journal.captureChecked(owner.view.session.id,boundary.plan.realmEpoch,
          all(owner.view.session as Session),owner.inheritedReady)
        :journal.capture(owner.view.session.id,boundary.plan.realmEpoch,
          all(owner.view.session as Session),owner.inheritedCut)
      if(ready.kind!=='ready'||!same(frontier(ready),boundary.event.frontier))return false
      for(const [index,phase] of boundary.event.phases.entries()) {
        const step=ready.steps.at(index-boundary.event.phases.length)!
        if(!step||!same(step.step.output,phase.output)||!same(step.step.frame.input,phase.input)
          ||!same(step.dispatchRef,phase.association.dispatch)||!same(step.completionRef,phase.association.completion))return false
      }
      // Only the final token still represents the current frontier. Earlier
      // tokens are intentionally stale and are covered by the full pinned chain.
      owner.associations.pop()
      try {return owner.driver.checkEvidence(lastLive.evidence,{association:lastLive.association,output:lastLive.output})}
      finally {owner.associations.push(lastLive.association)}
    }})
  async function prepareCompletion(scope:InputCompletionScope,closing?:object) {
    if(!closing)fail('SCHEMA_OWNER_UNPROVEN')
    const view=deps.closingView(closing,scope),sid=scope.receipt.checkpoint.sessionId
    if(!view||!deps.verifyNative(scope))fail('SCHEMA_OWNER_UNPROVEN')
    await deps.awaitOwnedCompletion(sid,scope.receipt.checkpoint.actualTurn)
    const completedBody=deps.readCanonical(sid,scope.receipt.checkpoint.actualTurn)
    const maintenance=completedBody&&await deps.maintenanceCompletion?.(scope,
      {...completedBody,narrativeSha256:sha256(completedBody.narrative)},view.signal)
    if(!view.current())fail('SCHEMA_STORY_PERMISSION_REVOKED')
    const session=view.session as Session,basis=deps.inputState.captureClosing(sid,()=>{
      const body=deps.readCanonical(sid,scope.receipt.checkpoint.actualTurn)
      const row=scope.currency.snapshot&&prefixInputs.branch.get(scope.currency.snapshot.key) as
        {numericalState?:MvuSchemaNumericalSnapshotV2}|undefined
      const base=row?.numericalState
      if(!body||!base||!inputSnapshotReferenceCurrent(prefixInputs.branch,sid,scope.currency)) {
        fail('SCHEMA_STORY_BASIS_CHANGED')
      }
      const history=factual(session),frame=deps.source.captureFrame(history.original,sid)
      const canonical={...body,narrativeSha256:sha256(body.narrative)}
      if(!same(base,history.snapshot)||deps.sourceSha256(sid)!==scope.currency.source.sourceSha256) {
        fail('SCHEMA_STORY_BASIS_CHANGED')
      }
      const phase=prefixInputs.branch.get(`${sid}__phaseb-${scope.receipt.checkpoint.actualTurn}`) as
        {state?:string;assistantSeq?:number}|undefined
      if(phase?.state!=='completed'||phase.assistantSeq!==body.seq)fail('INPUT_TERMINAL_PHASE_BC_UNRESOLVED')
      const selectorsAnchor={kind:'story' as const,preparationId:scope.currency.preparationId,
        attemptGeneration:scope.currency.attemptGeneration,receiptGeneration:scope.currency.receiptGeneration,
        turn:scope.receipt.checkpoint.actualTurn,canonicalSeq:body.seq,messageId:body.messageId,
        messageVersionSha256:body.versionSha256}
      const events=all(session),initialCut:SourceNativeCutFacts={schemaVersion:1,sessionId:sid,ownerSessionId:sid,
        nativeCut:events.length,nativePrefixSha256:recordSha256(events),sourceSnapshotSha256:frame.snapshotSha256,
        materialSha256:frame.materialSha256,stopGeneration:scope.stopGeneration,anchor:selectorsAnchor}
      const scopeReadFrame=history.ready.epoch.schemaVersion>=3&&history.readScopes
        ?scopeFrameAt(history.readScopes,history.original,frame,initialCut,events):undefined
      const ready=history.ready,executorVersion=isAuthorHostJournalReadyV5(ready)?4:ready.epoch.schemaVersion
      const errorPolicy=isAuthorHostJournalReadyV5(ready)
        ?schemaPhaseErrorPolicyForProgramV4(ready.epoch.program.serverProgram!):undefined
      const plan=transaction.makePlan(scope,canonical,base,frame,history.original.realmEpoch,schemaOriginalProgramSha256(history.original),
        initialCut,events[scope.receipt.turnEndSeq]!.time,executorVersion,scopeReadFrame,
        isAuthorHostJournalReadyV5(ready)?{epoch:ready.epochRef,
          serverProgramSha256:ready.epoch.program.serverProgram!.programSha256,
          ...(errorPolicy&&errorPolicy!=='atomic-refusal'?{errorPolicy}:{})}:undefined,maintenance)
      if(owners.has(sid))fail('SCHEMA_STORY_OWNER_EXISTS')
      const baseline=new Map([...prefixInputs.status.entries()].filter(([key])=>key.startsWith(`${sid}__mvu-`)
        &&!key.startsWith(`${sid}__mvu-schema-`)
        &&!key.startsWith(`${sid}__mvu-state-schema-task-edit-intent-`)
        &&!key.startsWith(`${sid}__mvu-state-schema-task-edit-binding-`)).map(([key,value])=>[key,recordSha256(value)]))
      return {history,frame,base,plan,baseline,events}
    })
    try {
      const {history,frame,base,plan,baseline,events}=basis.data
      const {driver}=await engine(history.ready)
      const currentEvents=all(session)
      // Native snapshots contain deeply frozen events and only grow by append.
      // The same cut and tail retain this prefix; edits append a new event.
      // Domain/Source changes are checked by the captured dependencies, so an
      // await boundary does not need to fold and hash all historical facts again.
      if(!view.current()||!basis.current()||currentEvents.length!==events.length
        ||currentEvents.at(-1)!==events.at(-1))fail('SCHEMA_STORY_BASIS_CHANGED')
      if(owners.has(sid))fail('SCHEMA_STORY_OWNER_EXISTS')
      const owner:Owner={lease:closing,view,original:history.original,frame,base,plan,driver,
        readScopes:history.readScopes,inheritedCut:history.inheritedCut,inheritedReady:history.inheritedReady,
        abort:new AbortController(),
        token:Object.freeze({}),inSource:false,baseline,associations:[]}
      owners.set(sid,owner);scopes.set(owner.token,owner)
      return plan
    }finally {basis.release()}
  }
  function releaseClosing(lease:object):void {
    for(const [sid,owner] of owners)if(owner.lease===lease) {
      owner.abort.abort()
      for(const driver of drivers.values())driver.invalidateOwner(owner.token)
      owners.delete(sid);views.delete(sid);deps.inputState.invalidateSession(sid)
    }
  }
  function verifyConsumed(scope:InputCompletionScope,plan:MvuSchemaStoryPlan,settlement:unknown):boolean {
    const view=views.get(plan.base.sessionId)
    if(!view||!viewCurrent(view)||!transaction.verifyConsumed(scope,plan,settlement))return false
    try {
      const terminal=readInputCompletion(prefixInputs.branch,plan.base.sessionId,scope.currency.preparationId)
      const event=prefixInputs.status.get((settlement as {event:{key:string}}).event.key)
      return view.history.consumed.get(plan.planSha256)===recordSha256({terminal,event,settlement})
    } catch {return false}
  }
  return {preflight,adoptPublishedPlayer,observation,readSnapshot,readSchemaObservation,supportsMaintenance,captureMaintenanceBase,checkTextEdit,
    taskEditFacts,taskArtifact,taskEditResolved,
    captureReaderDisplayScopes,capturePromptScopes,executePrompt,captureBrowserFacts,captureReaderDocumentFacts,
    readEditBasis,captureManualBasis,captureHistoricalCut,borrowHistoricalCut,
    captureForkPrefix,captureRevisionForkPrefix,recoverForkPrefix,verifyForkPrefix,captureFrozenForkPrefix,captureAncestorForkPrefix,
    recoverFrozenForkPrefix,verifyFrozenForkPrefix,
    prepareCompletion,releaseClosing,verifyConsumed,
    reconcileAcceptedEdit,
    publishCompletion:(scope:InputCompletionScope,plan:MvuSchemaStoryPlan,closing?:object)=>closing
      ?transaction.publish(scope,plan,closing):Promise.resolve({kind:'blocked' as const,code:'SCHEMA_OWNER_UNPROVEN'}),
    verifySettlement:transaction.verifySettlement,
    invalidateSession(sid:string):void {
      const revision=revisionOwners.get(sid)
      if(revision)revision.driver.invalidateOwner(revision.token)
      const owner=owners.get(sid);if(owner)releaseClosing(owner.lease);views.delete(sid)
      deps.inputState.invalidateSession(sid)
      clearDisplayPrefixes(sid)
    },
    invalidateAgent(agent:object):void {
      const affected=new Set<string>()
      for(const [sid,owner] of owners)if(owner.view.agent===agent)affected.add(sid)
      for(const [sid,view] of views)if(view.agent===agent)affected.add(sid)
      for(const owner of owners.values())if(owner.view.agent===agent)releaseClosing(owner.lease)
      for(const [sid,view] of views)if(view.agent===agent)views.delete(sid)
      for(const sid of affected){deps.inputState.invalidateSession(sid);clearDisplayPrefixes(sid)}
    },
    dispose():void {
      disposed=true
      for(const owner of owners.values())releaseClosing(owner.lease)
      views.clear()
      scopePrefixes.clear()
      displayPrefixes.clear()
      for(const driver of drivers.values())driver.dispose()
      drivers.clear()
      sourceOriginals.clear()
    },
  }
}
