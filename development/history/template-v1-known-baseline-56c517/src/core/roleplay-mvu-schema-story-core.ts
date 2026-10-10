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
import {createRoleplayMvuSchemaJournal,schemaJournalFrontierSha256,schemaEpochExecution,schemaEpochAuthorIdentity,
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
import {validateMvuSchemaPlayerEvent,readMvuSchemaPlayerCompletedFacts,mvuSchemaPlayerEventKey,
  mvuSchemaPlayerHead,mvuSchemaPlayerOperationKey,mvuSchemaPlayerCompletionKey} from './roleplay-mvu-schema-player-types.js'
import {validateMvuSchemaFrozenPrefix,validateMvuSchemaDerivedBasis} from './roleplay-mvu-schema-derived-types.js'
import {buildSchemaScopeReadFrame,schemaScopeSource,schemaScopeInitialChat,schemaScopeConfiguration,
  schemaScopeOwner,schemaScopePublished,schemaScopeMessageKey,schemaScopeVisibleMessages,
  schemaScopeReadFactsEqual,schemaScopeEmpty,schemaScopeReowner} from './roleplay-mvu-schema-scope-facts.js'
import type {BrowserSnapshotV1,BrowserChatMessageSnapshotV1} from './tavern-author-browser-types.mjs'
import type {BrowserSnapshotV2,BrowserRuntimeArtifactV2} from './tavern-author-browser-types-v2.mjs'
import {deriveAuthorChatBindingV1} from './roleplay-author-chat-state.js'
import type {CanonicalAuthorChatStateV1} from './roleplay-author-chat-state.js'
import {produceAuthorPromptScopeFrameV1} from './roleplay-author-prompt-capture.js'
import type {AuthorPromptPreparationFactsV1} from './roleplay-author-prompt-capture.js'
import type {AuthorBrowserPreparationFactsV2} from './roleplay-author-browser-generation-types.js'
import type {PromptProgramV1,PromptCaptureV1,PromptCapturedMessageV1} from './tavern-author-prompt-types.mjs'
import type {MvuScopeVariablesV1,MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import {readMvuSchemaInheritedStoryFacts,verifyMvuSchemaInheritedOpeningFacts}
  from './roleplay-mvu-schema-prefix-facts.js'
import {verifyMvuSchemaUnpublishedTail} from './roleplay-mvu-schema-history-tail.js'
import type {Session,SessionEvent} from '@deepseek-ai/dsh-session'
import type {NativeInputAdmissionAgentV2} from '@deepseek-ai/dsh-agent-loop'
import type {OwnedMvuSchemaExecutor,SchemaExecutorIdentityTuple} from './roleplay-mvu-schema-executor-types.js'
import type {ProtectedAuthorHostRuntimeV5} from './roleplay-author-host-assets.js'
import type {AuthorHostIdentityV5} from './roleplay-author-host-types-v5.js'
import type {SchemaReplayDeps} from './roleplay-mvu-schema-replay.js'
import type {mvuSchemaMarkers} from 'dsh-nexttavern-session-format/mvu-schema-marker'
import type {InputCompletionScope} from './roleplay-input-completion.js'
import type {InputClosingView,InputObservation} from './roleplay-input-preparation.js'
import type {CompletedStoryBody} from './roleplay-mvu-story.js'
import type {createRoleplayMvuSchemaSource,SchemaFrozenOriginal,SchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import type {SchemaJournalReady,SourceNativeCutFacts} from './roleplay-mvu-schema-journal.js'
import type {SchemaOwnedScope,SchemaBoundary,SchemaExecutionSelector,SchemaExecutionAssociation,
  HistoricalCutSelector} from './roleplay-mvu-schema-replay.js'
import type {MvuSchemaNumericalSnapshotV2,MvuSchemaStoryPlan,MvuSchemaStoryPhase,
  MvuSchemaStoryLive,MvuSchemaStoryPublicationBoundary} from './roleplay-mvu-schema-story-types.js'
import type {MvuSchemaDerivedGenesis,MvuSchemaFrozenPrefixV1,MvuSchemaPrefixSeed}
  from './roleplay-mvu-schema-derived-types.js'
import type {SchemaJournalFrozenCut} from './roleplay-mvu-schema-journal.js'
import type {WorldlineMessageEdits} from './roleplay-worldline-types.js'
import type {MvuInheritedMessageEditProtocol} from './roleplay-mvu-prefix-facts.js'
import type {MvuEditInvalidation} from './roleplay-mvu-edit-facts.js'
import {acceptedMvuDisplayUpdate,formatMvuDisplayUpdates} from './roleplay-mvu-display-facts.js'
import type {MvuAcceptedDisplayUpdate} from './roleplay-mvu-display-facts.js'
import type {RoleplayInputStateOwner,RoleplayInputStateRead} from './roleplay-input-state.js'
import type {ReaderDisplayScopes} from './roleplay-reader-display.js'
import type {TavernTemplateScopeBindingV1} from './tavern-template-types.mjs'

interface Table {get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>;entries():Iterable<[string,unknown]>}
export interface MvuSchemaStoryCoreDeps {
  inputState:RoleplayInputStateOwner
  authorChat?:Pick<CanonicalAuthorChatStateV1,'capture'>
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
  verifyOpening(intent:ReturnType<typeof validateMvuSchemaOpeningIntent>):boolean
  verifyNative(scope:InputCompletionScope):boolean
  verifyConsumedScope(scope:InputCompletionScope):boolean
  readCanonical(sid:string,turn:number):CompletedStoryBody|undefined
  readConsumedCanonical(sid:string,seq:number,turn:number,throughSeq:number):CompletedStoryBody|undefined
  awaitOwnedCompletion(sid:string,turn:number):Promise<void>
  manualPendingCode?(sid:string):string|undefined
  manualEditBlockCode?(sid:string):string|undefined
  derivedRequired?(sid:string):boolean
  readDerivedGenesis?(sid:string,currentSource?:boolean):MvuSchemaDerivedGenesis|undefined
  readEditInvalidation?(sid:string):MvuEditInvalidation
  projectPrefix:WorldlineMessageEdits['projectPrefix']
  editProtocol:MvuInheritedMessageEditProtocol
}
interface History {
  original:SchemaFrozenOriginal
  ready:SchemaJournalReady
  snapshot:MvuSchemaNumericalSnapshotV2
  consumed:Map<string,string>
  digest:string
  initial:MvuSchemaNumericalSnapshotV2
  seed:MvuSchemaPrefixSeed
  inheritedCut:SchemaJournalFrozenCut|null
  eventKeys:string[]
  readScopes?:ScopeFacts
  displayUpdates?:readonly MvuAcceptedDisplayUpdate[]
  commandDiagnostics:readonly MvuDiscardedCommandObservation[]
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
  token:object;inSource:boolean;baseline:Map<string,string>;associations:SchemaExecutionAssociation[]
  scope?:SchemaOwnedScope;lastLive?:MvuSchemaStoryLive;publication?:MvuSchemaStoryPublicationBoundary
  readScopes?:ScopeFacts
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const openingPhaseCount=(plan:FrozenMvuOpeningInitializationV3)=>plan.schemaVersion===8?plan.phases.length:1
function fail(code:string):never {throw Error(code)}
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'SCHEMA_STORY_UNPROVEN'

export function createRoleplayMvuSchemaStoryCore(deps:MvuSchemaStoryCoreDeps) {
  const prefixInputs=createRoleplayMvuSchemaPrefixInputs({branch:deps.branch,status:deps.status})
  const journal=createRoleplayMvuSchemaJournal({table:prefixInputs.status as never,markers:deps.markers})
  const views=new Map<string,View>(),owners=new Map<string,Owner>(),scopes=new WeakMap<object,Owner>()
  const sourceLeases=new Map<string,Owner>()
  let disposed=false
  // Only the synchronous capture's edit-invalidation reader may see this
  // already verified opening basis. It is DATA, never a live execution lease.
  let capturingEditBasis:{sid:string;basis:History['editBasis']}|undefined
  const drivers=new Map<string,ReturnType<typeof createRoleplayMvuSchemaReplay>>()
  // Source alone returns the branded Original5. Retain that object across
  // immutable derived/history DATA reads; a DTO is never promoted in place.
  const sourceOriginals=new Map<string,SchemaFrozenOriginal>()
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
    cut:SourceNativeCutFacts,events:readonly SessionEvent[]):MvuScopeReadFrameV1 {
    if(cut.nativeCut>events.length||cut.sessionId!==current.sessionId
      ||cut.sourceSnapshotSha256!==current.snapshotSha256||cut.materialSha256!==current.materialSha256
      ||cut.nativePrefixSha256!==recordSha256(events.slice(0,cut.nativeCut)))fail('SCHEMA_SCOPE_CUT_UNPROVEN')
    const source=schemaScopeSource(current.snapshot),prefix=events.slice(0,cut.nativeCut)
    const snapshot=schemaOriginalSnapshot(original)
    if(source.importId!==snapshot.source.importId||source.rawSha256!==snapshot.source.rawSha256
      ||source.sourceRecordSessionId!==snapshot.source.sourceRecordSessionId)fail('SCHEMA_SCOPE_SOURCE_UNPROVEN')
    return buildSchemaScopeReadFrame(source,recordSha256(cut),schemaOriginalServerScripts(original),facts.chat,
      schemaScopeVisibleMessages(prefix,deps.projectPrefix,source,seq=>scopeOwnerForSeq(facts,seq),facts.messages))
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
    return {chat:schemaScopeInitialChat(original.preparation,material,
      ready.steps[0]!.dispatch.sourceNativeCut),messages,
      owners:[{sessionId:seed.intent.sessionId,fromSeq:0,throughSeq:null}],
      updateChat:schemaScopeConfiguration(snapshot,material).updateChat}
  }
  function scopesForDerived(genesis:MvuSchemaDerivedGenesis,events:readonly SessionEvent[]):ScopeFacts|undefined {
    if(genesis.original.preparation.schemaVersion<3)return undefined
    const basis=validateMvuSchemaDerivedBasis(prefixInputs.branch.get(genesis.basisKey) as never)
    if(basis.basisSha256!==genesis.basisSha256||basis.prepared.childSessionId!==genesis.sessionId) {
      fail('SCHEMA_SCOPE_PREFIX_UNPROVEN')
    }
    const prefix=basis.prepared.prefix,cached=scopePrefixes.get(prefix.prefixSha256)
    if(!cached||cached.nativePrefixSha256!==prefix.journal.nativePrefixSha256
      ||recordSha256(events.slice(0,genesis.inheritedCut.nativeCut))!==cached.nativePrefixSha256) {
      fail('SCHEMA_SCOPE_PREFIX_UNPROVEN')
    }
    const cut=genesis.inheritedCut.nativeCut
    // Normal Native input claims extend the child's own log without changing
    // its published state identity. Parent tails cannot extend into that child.
    const ancestors=cached.facts.owners.filter(range=>range.fromSeq<cut).map(range=>({...range,
      throughSeq:range.throughSeq===null?cut:Math.min(range.throughSeq,cut)}))
    return {...cached.facts,messages:new Map(cached.facts.messages),owners:[...ancestors,
      {sessionId:genesis.sessionId,fromSeq:cut,throughSeq:null}]}
  }
  function displayForDerived(genesis:MvuSchemaDerivedGenesis,events:readonly SessionEvent[])
    :readonly MvuAcceptedDisplayUpdate[] {
    try {
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
  function eventRows(sid:string,nativeCut:number) {
    const rows=[...prefixInputs.status.entries()].filter(([key])=>key.startsWith(`${sid}__mvu-state-schema-story-event-`)
      ||key.startsWith(`${sid}__mvu-state-schema-player-event-`))
      .map(([key,row])=>({key,event:key.startsWith(`${sid}__mvu-state-schema-player-event-`)
        ?validateMvuSchemaPlayerEvent(row as never):validateMvuSchemaStoryEvent(row as never)}))
      .filter(item=>item.event.frontier.nativeCut<=nativeCut)
      .sort((a,b)=>a.event.phases[0]!.association.dispatchMarker.seq-b.event.phases[0]!.association.dispatchMarker.seq)
    return rows
  }
  function consume(sid:string,inheritedEventCount:number,events:readonly SessionEvent[],ready:SchemaJournalReady,
    initial:MvuSchemaNumericalSnapshotV2,ordinal:number,frozen=false,scopeSeed?:ScopeFacts,original?:SchemaFrozenOriginal,
    readOnlyTail=false,includeDisplay=false,displaySeed?:readonly MvuAcceptedDisplayUpdate[]) {
    const inventory=eventRows(sid,events.length),root=initial.root,consumed=new Map<string,string>()
    const rows:typeof inventory=[],partial:typeof inventory=[]
    for(const row of inventory) {
      const event=row.event,closed=event.encoding==='native-mvu-schema-player-event-v1'
        ?prefixInputs.branch.get(mvuSchemaPlayerCompletionKey(sid,event.plan.operation.operationId))!==undefined
        :readInputCompletion(prefixInputs.branch,sid,event.plan.scope.currency.preparationId)?.status==='settled'
      if(readOnlyTail&&!closed)partial.push(row)
      else {
        if(partial.length)fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN')
        rows.push(row)
      }
    }
    let state=initial
    let chat=scopeSeed?.chat
    const messageStates=scopeSeed?new Map(scopeSeed.messages):undefined
    const displayUpdates=includeDisplay?[] as MvuAcceptedDisplayUpdate[]:undefined
    for(const event of events)if(event.type==='roleplay/mvu-manual-edit'
      &&event.seq>=inheritedEventCount&&event.data.sessionId===sid) {
      const operation=prefixInputs.branch.get(mvuSchemaPlayerOperationKey(sid,event.data.operationId))
      if(operation===undefined)fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
      if(frozen&&!readOnlyTail) {
        const facts=readMvuSchemaPlayerCompletedFacts(prefixInputs.branch,prefixInputs.status,operation as never,events)
        if(facts.event.frontier.nativeCut>events.length||!rows.some(row=>same(row.event,facts.event))) {
          fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
        }
      }
    }
    for(const {key,event} of rows) {
      const plan=event.plan,base='operation' in plan?plan.operation.base:plan.base
      if(original&&!deps.source.verifyFrozenFrame(original,plan.currentFrame))fail('SCHEMA_HISTORICAL_SOURCE_UNPROVEN')
      const eventKey=event.encoding==='native-mvu-schema-player-event-v1'
        ?mvuSchemaPlayerEventKey(sid,event.eventId):mvuSchemaStoryEventKey(sid,event.eventId)
      if(key!==eventKey||!same(base.root,root)
        ||!same(base,snapshot({...state,sourceSha256:base.sourceSha256})))fail('SCHEMA_STORY_BASE_CHAIN_INVALID')
      let closure:unknown
      if(event.encoding==='native-mvu-schema-player-event-v1') {
        const facts=readMvuSchemaPlayerCompletedFacts(prefixInputs.branch,prefixInputs.status,event.plan.operation,events)
        if(!same(facts.event,event))fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
        closure={operation:facts.operation,plan:facts.plan,event,settlement:facts.settlement,completion:facts.completion}
      } else if(frozen) {
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
        closure={terminal:facts.terminal,event,settlement:facts.settlement}
      } else {
        const plan=event.plan,scope=plan.scope
        const terminal=readInputCompletion(prefixInputs.branch,sid,scope.currency.preparationId)
        const settlement=validateMvuSchemaStorySettlement(prefixInputs.status.get(mvuSchemaStorySettlementKey(sid,plan.planSha256)) as never,event)
        if(!terminal||terminal.status!=='settled'||terminal.plan.kind!=='schema-numerical'
          ||!same(terminal.scope,scope)||!same(terminal.plan.plan,plan)||!same(terminal.settlement,settlement)
          ||!deps.verifyConsumedScope(scope)||!deps.verifyNative(scope)
          ||!inputSnapshotReferenceCurrent(prefixInputs.branch,sid,scope.currency))fail('SCHEMA_STORY_TERMINAL_UNRESOLVED')
        const canonical=deps.readConsumedCanonical(sid,plan.canonical.seq,scope.receipt.checkpoint.actualTurn,scope.receipt.turnEndSeq)
        if(!canonical||!same(plan.canonical,{...canonical,narrativeSha256:sha256(canonical.narrative)}))fail('SCHEMA_STORY_CANONICAL_UNPROVEN')
        closure={terminal,event,settlement}
      }
      for(const phase of event.phases) {
        const actualAssociation=associationAt(sid,events,ready,ordinal),step=ready.steps[ordinal++]!,association=phase.association
        if(!step||!same(step.dispatchRef,association.dispatch)||!same(step.completionRef,association.completion)
          ||!same(actualAssociation,association)
          ||!same(step.dispatchMarker,association.dispatchMarker)||!same(step.completionMarker,association.completionMarker)
          ||step.dispatch.batchId!==association.batchId||!same(step.dispatch.sourceNativeCut.anchor,association.anchor)
          ||recordSha256(step.dispatch.sourceNativeCut)!==association.sourceNativeCutSha256
          ||!same(step.step.frame.input,phase.input)||!same(step.step.output,phase.output)
          ||!same(step.step.frame.material,plan.currentFrame.material)
          ||step.dispatch.sourceNativeCut.sourceSnapshotSha256!==plan.currentFrame.snapshotSha256
          ||step.dispatch.sourceNativeCut.materialSha256!==plan.currentFrame.materialSha256)fail('SCHEMA_STORY_JOURNAL_UNPROVEN')
        if(step.step.frame.input.schemaVersion===3||step.step.frame.input.schemaVersion===4) {
          if(!scopeSeed||!chat||!messageStates||!original)fail('SCHEMA_SCOPE_HISTORY_UNPROVEN')
          const expected=scopeFrameAt({...scopeSeed,chat,messages:messageStates},original,plan.currentFrame,
            step.dispatch.sourceNativeCut,events)
          if(!same(step.step.frame.input.scopeReadFrame,expected))fail('SCHEMA_SCOPE_HISTORY_UNPROVEN')
        }
      }
      const head=event.encoding==='native-mvu-schema-player-event-v1'?mvuSchemaPlayerHead(event):mvuSchemaStoryHead(event)
      state=snapshot({schemaVersion:2,encoding:'native-mvu-schema-state-snapshot-v2',sessionId:sid,
        sourceSha256:base.sourceSha256,root,currentHead:head,revision:head.revision,headSha256:recordSha256(head),
        values:event.values,valuesSha256:event.valuesSha256,context:event.context,schemaFrontier:event.frontier})
      if(scopeSeed&&messageStates&&event.outcome!=='refused') {
        const source=schemaScopeSource(plan.currentFrame.snapshot)
        const manual=event.encoding==='native-mvu-schema-player-event-v1'
        const stateRef={kind:manual?'manual' as const:'story' as const,ownerSessionId:sid,
          recordKey:key,recordSha256:recordSha256(event),valuesSha256:event.valuesSha256,revision:state.revision}
        if(manual||scopeSeed.updateChat)chat=schemaScopePublished(schemaScopeOwner(source,'chat'),stateRef,event.values,event.context)
        if(event.encoding==='native-mvu-schema-story-event-v2') {
          const canonical=event.plan.canonical
          const variables=schemaScopePublished(schemaScopeOwner(source,'message',canonical.messageId,sid),stateRef,event.values,event.context)
          messageStates.set(schemaScopeMessageKey(sid,canonical.seq,canonical.messageId,canonical.versionSha256),variables)
        }
      }
      consumed.set(plan.planSha256,recordSha256(closure))
      if(displayUpdates&&event.encoding==='native-mvu-schema-story-event-v2'
        &&event.outcome==='accepted'&&event.plan.candidate.kind==='parsed') {
        const item=acceptedMvuDisplayUpdate(sid,event.plan.canonical,event.plan.candidate.protocol)
        if(item)displayUpdates.push(item)
      }
    }
    if(!readOnlyTail&&(ordinal!==ready.steps.length||!same(state.schemaFrontier,frontier(ready)))) {
      fail('SCHEMA_STORY_HISTORY_UNSETTLED')
    }
    if(readOnlyTail&&partial.length&&ordinal===ready.steps.length)fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN')
    const readScopes=scopeSeed&&chat&&messageStates?{...scopeSeed,chat,messages:messageStates}:undefined
    return {state,consumed,eventKeys:rows.map(row=>row.key),readScopes,ordinal,
      displayUpdates:displayUpdates?formatMvuDisplayUpdates([...(displaySeed??[]),...displayUpdates]):undefined}
  }
  function readyFor(sid:string,realmEpoch:string,events:readonly SessionEvent[],
    inheritedCut:SchemaJournalFrozenCut|null,historical=false):SchemaJournalReady {
    // Without inherited rows the preliminary inventory has no merge conflicts.
    // Keep the other path's raw inherited future-row conflict checks intact.
    if(!historical&&inheritedCut===null) {
      const ready=journal.capture(sid,realmEpoch,events)
      if(ready.kind!=='ready')fail(ready.code)
      return ready
    }
    const rows=new Map(inheritedCut?.records.map(row=>[row.key,row])??[])
    if(inheritedCut)journal.validateFrozen(inheritedCut,events.slice(0,inheritedCut.nativeCut))
    for(const row of journal.inventory(sid)) {
      const previous=rows.get(row.key)
      if(previous&&!same(previous,row))fail('SCHEMA_JOURNAL_WRITE_CONFLICT')
      rows.set(row.key,row)
    }
    const ready=historical?journal.captureFrozen(sid,realmEpoch,events,[...rows.values()]):journal.capture(sid,realmEpoch,events,inheritedCut)
    if(ready.kind!=='ready')fail(ready.code)
    return ready
  }
  function derivedOriginal(original:SchemaFrozenOriginal,ready:SchemaJournalReady,
    events:readonly SessionEvent[]):SchemaFrozenOriginal {
    if(original.schemaVersion!==5)return original
    const retained=sourceOriginals.get(original.originalSha256)
    if(retained)return retained
    const initialization=ready.steps.find(step=>step.dispatch.sessionId===original.sessionId
      &&step.dispatch.batchId===original.preparation.selector.batchId)
    if(!initialization)fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN')
    const cut=events.slice(0,initialization.completionMarker.seq+1)
    const opening=journal.captureFrozen(original.sessionId,original.realmEpoch,cut,ready.frozen.records)
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
    captureBasis=false):History {
    const sid=session.id,events=all(session).slice(0,nativeCut),sourceSha256=deps.sourceSha256(sid)
    const manualBlock=deps.manualPendingCode?.(sid)
    if(manualBlock&&!historical)fail(manualBlock)
    let original:SchemaFrozenOriginal,initial:MvuSchemaNumericalSnapshotV2,seed:MvuSchemaPrefixSeed
    let scopeSeed:ScopeFacts|undefined
    let displaySeed:readonly MvuAcceptedDisplayUpdate[]|undefined
    let ready:SchemaJournalReady,inheritedCut:SchemaJournalFrozenCut|null=null,ordinal=1
    if(deps.derivedRequired?.(sid)||session.inheritedEventCount||session.header.parentSession) {
      const genesis=deps.readDerivedGenesis?.(sid)
      if(!genesis||genesis.inheritedCut.nativeCut!==session.inheritedEventCount)fail('SCHEMA_DERIVED_GENESIS_UNPROVEN')
      original=genesis.original;inheritedCut=genesis.inheritedCut
      ready=readyFor(sid,original.realmEpoch,events,inheritedCut,historical)
      const inherited=journal.captureFrozen(inheritedCut.sessionId,original.realmEpoch,
        events.slice(0,inheritedCut.nativeCut),inheritedCut.records)
      if(inherited.kind!=='ready')fail(inherited.code)
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
      if(!deps.verifyOpening(intent))fail('SCHEMA_OPENING_RECORD_INVALID')
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
    if(edited&&edited.kind!=='clear')fail(edited.code)
    const result=consume(sid,session.inheritedEventCount,events,ready,initial,ordinal,historical,scopeSeed,original,
      false,includeDisplay,displaySeed)
    let state=result.state
    const actualHead=prefixInputs.status.get(mvuStateCurrentHeadKey(sid))
    if(!historical&&(isMvuSchemaGenesisHead(state.currentHead)?actualHead!==undefined:!same(actualHead,state.currentHead))) {
      fail('SCHEMA_STORY_HEAD_UNPROVEN')
    }
    state=snapshot({...state,sourceSha256})
    const scopeDigest=result.readScopes?{readScopes:{...result.readScopes,messages:[...result.readScopes.messages]}}:{}
    const commandDiagnostics:MvuDiscardedCommandObservation[]=ready.steps.flatMap(step=>{
      const output=step.step.output
      if(!('schemaVersion' in output)||output.schemaVersion!==4||output.kind!=='accepted'
        ||output.errorPolicy!=='registered-command-policy-v1')return []
      return output.discarded.map(row=>({source:step.dispatch.sourceNativeCut.anchor.kind==='opening'
        ?'opening' as const:'story' as const,nativeSeq:step.completionMarker.seq,
        commandIndex:row.commandIndex,code:row.code,...'pointer' in row?{pointer:row.pointer}:{}}))
    })
    return {original,ready,snapshot:state,consumed:result.consumed,initial,seed,inheritedCut,eventKeys:result.eventKeys,
      readScopes:result.readScopes,
      displayUpdates:result.displayUpdates,commandDiagnostics,editBasis,
      digest:recordSha256({original,epoch:ready.epoch,steps:ready.steps,frontierSha256:schemaJournalHostFrontierSha256(ready),
        state,consumed:[...result.consumed],...scopeDigest})}
  }
  function verifyForkPrefix(input:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
    genesis?:MvuSchemaDerivedGenesis):boolean {
    try {
      const prefix=validateMvuSchemaFrozenPrefix(input),sid=prefix.sessionId
      if(events.length!==prefix.journal.nativeCut||!deps.source.originalFactsCurrent(prefix.original))return false
      const ready=journal.validateFrozenReady(prefix.journal,events)
      if(ready.frozen.sessionId!==sid||ready.frozen.realmEpoch!==prefix.original.realmEpoch)return false
      let initial:MvuSchemaNumericalSnapshotV2,ordinal=1
      let scopeSeed:ScopeFacts|undefined
      let displaySeed:readonly MvuAcceptedDisplayUpdate[]|undefined
      if(prefix.seed.kind==='opening') {
        const seed=prefix.seed
        if(!same(prefixInputs.branch.get(openingIntentKey(sid,seed.intent.source.importId)),seed.intent)
          ||!same(prefixInputs.status.get(mvuInitializationEventKey(sid,seed.event.eventId)),seed.event)
          ||!same(prefixInputs.status.get(mvuInitializationHeadKey(sid)),seed.head)
          ||!verifyMvuSchemaInheritedOpeningFacts({intent:seed.intent,event:seed.event,head:seed.head,events},
            {projectPrefix:deps.projectPrefix}))return false
        const original=deps.source.readFrozenOriginal(seed.intent.preparation,ready,events)
        if(!same(original,prefix.original))return false
        ordinal=openingPhaseCount(seed.event.plan)
        initial=initialForOpening(seed,prefix.sourceSha256,original,ready,events)
        scopeSeed=scopesForOpening(seed,original,ready,events)
      }else {
        if(!genesis||genesis.sessionId!==sid||genesis.basisKey!==prefix.seed.basisKey
          ||genesis.basisSha256!==prefix.seed.basisSha256||!same(genesis.original,prefix.original)
          ||genesis.inheritedCut.nativeCut!==prefix.inheritedEventCount)return false
        const prior=journal.validateFrozenReady(genesis.inheritedCut,events.slice(0,prefix.inheritedEventCount))
        ordinal=prior.steps.length
        initial=snapshot({...genesis.snapshot,sourceSha256:prefix.sourceSha256})
        scopeSeed=scopesForDerived(genesis,events)
        displaySeed=displayForDerived(genesis,events)
      }
      if(!same(initial,prefix.initial))return false
      const result=consume(sid,prefix.inheritedEventCount,events,ready,initial,ordinal,true,scopeSeed,prefix.original,
        false,true,displaySeed)
      const state=snapshot({...result.state,sourceSha256:prefix.sourceSha256})
      if(!same(state,prefix.snapshot)||!same(result.eventKeys,prefix.eventKeys)
        ||!same([...result.consumed].map(([planSha256,closureSha256])=>({planSha256,closureSha256})),prefix.consumed))return false
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
          ||!result.consumed.has(terminal.plan.plan.planSha256))return false
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
      return true
    }catch {return false}
  }
  const prefixInputBinding=(prefix:MvuSchemaFrozenPrefixV1)=>({sessionId:prefix.sessionId,
    inheritedEventCount:prefix.inheritedEventCount,nativeCut:prefix.journal.nativeCut,
    nativePrefixSha256:prefix.journal.nativePrefixSha256,sourceSha256:prefix.sourceSha256,
    prefixSha256:prefix.prefixSha256})
  function captureFrozenForkPrefix(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
    genesis?:MvuSchemaDerivedGenesis) {
    const captured=prefixInputs.capture(prefixInputBinding(prefix),()=>verifyForkPrefix(prefix,events,genesis))
    if(!captured.result)fail('SCHEMA_DERIVED_HISTORY_UNPROVEN')
    return {closure:captured.closure,assertCurrent:captured.assertCurrent}
  }
  function verifyFrozenForkPrefix(prefix:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
    genesis:MvuSchemaDerivedGenesis|undefined,closure:MvuSchemaPrefixInputClosureV1):boolean {
    try {return prefixInputs.verify(closure,prefixInputBinding(prefix),()=>verifyForkPrefix(prefix,events,genesis))}
    catch {return false}
  }
  async function captureForkPrefix(sid:string,nativeCut:number):Promise<MvuSchemaFrozenPrefixV1> {
    const session=deps.session(sid)
    if(!session||!currentSession(session)||!Number.isSafeInteger(nativeCut)||nativeCut<1
      ||nativeCut>all(session).length)fail('SCHEMA_DERIVED_PARENT_UNPROVEN')
    const history=factual(session,nativeCut,true)
    const {driver:replay}=await engine(history.ready)
    const verified=await replay.verifyHistorical({sessionId:sid,realmEpoch:history.original.realmEpoch,nativeCut})
    if(verified.kind!=='verified')fail(verified.code)
    if(!currentSession(session)||factual(session,nativeCut,true).digest!==history.digest) {
      fail('SCHEMA_DERIVED_HISTORY_UNPROVEN')
    }
    const body={schemaVersion:1 as const,encoding:'native-mvu-schema-frozen-prefix-v1' as const,sessionId:sid,
      inheritedEventCount:session.inheritedEventCount,sourceSha256:history.snapshot.sourceSha256,
      original:history.original,seed:history.seed,initial:history.initial,journal:history.ready.frozen,
      eventKeys:history.eventKeys,snapshot:history.snapshot,
      consumed:[...history.consumed].map(([planSha256,closureSha256])=>({planSha256,closureSha256}))}
    const prefix=validateMvuSchemaFrozenPrefix(sealMvuSchemaStoryFact(body,'prefixSha256'))
    const initial=history.seed.kind==='derived'?deps.readDerivedGenesis?.(sid):undefined
    if(!verifyForkPrefix(prefix,all(session).slice(0,nativeCut),initial)) {
      fail('SCHEMA_DERIVED_HISTORY_UNPROVEN')
    }
    return prefix
  }
  function readDataCurrent(view:SchemaReadData):boolean {
    return !disposed&&deps.session(view.session.id)===view.session&&deps.agent(view.session)===view.agent
  }
  function viewCurrent(view:View):boolean {return view.read.current()&&readDataCurrent(view)}
  function historicalSourceSha256(sid:string,ready:SchemaJournalReady,ordinal:number):string {
    const first=ready.steps[ordinal]
    if(!first)fail('SCHEMA_HISTORICAL_TAIL_UNPROVEN')
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
  async function captureHistoricalCut(selector:HistoricalCutSelector) {
    const session=deps.session(selector.sessionId)
    if(!session||!currentSession(session)||!Number.isSafeInteger(selector.nativeCut)
      ||selector.nativeCut<1||selector.nativeCut>all(session).length)fail('SCHEMA_SESSION_INACTIVE')
    // Select the pinned original realm explicitly. A read-only cut must not
    // borrow today's active pointer, current numerical head or later material.
    const prefix=all(session).slice(0,selector.nativeCut)
    const sid=session.id,derivedRequired=deps.derivedRequired?.(sid)||session.inheritedEventCount||session.header.parentSession
    const derived=derivedRequired?deps.readDerivedGenesis?.(sid,false):undefined
    let original:SchemaFrozenOriginal,ready:SchemaJournalReady,ordinal=1,initial:MvuSchemaNumericalSnapshotV2|undefined
    let scopeSeed:ScopeFacts|undefined
    if(derivedRequired) {
      if(!derived||derived.original.realmEpoch!==selector.realmEpoch)fail('SCHEMA_DERIVED_GENESIS_UNPROVEN')
      original=derived.original
      if(!deps.source.originalFactsCurrent(original)||derived.inheritedCut.nativeCut!==session.inheritedEventCount) {
        fail('SCHEMA_DERIVED_GENESIS_UNPROVEN')
      }
      ready=readyFor(sid,selector.realmEpoch,prefix,derived.inheritedCut,true)
      original=derivedOriginal(original,ready,prefix)
      ordinal=journal.validateFrozenReady(derived.inheritedCut,prefix.slice(0,derived.inheritedCut.nativeCut)).steps.length
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
      const folded=consume(sid,session.inheritedEventCount,prefix,ready,initial,ordinal,true,scopeSeed,original,true)
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
    // Re-admit protected bytes for every waiter, including a cache hit.
    await protectedFor(ready)
    return {authorInput:schemaOriginalReplayCompilationInput(original),ready,frozen:ready.frozen,events:all(session)}
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
      &&!key.startsWith(`${sid}__mvu-schema-completion-`)&&!key.startsWith(`${sid}__mvu-schema-unavailable-`)))
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
      const owner=scopes.get(scope.owner),session=owner?.view.session as Session|undefined
      if(!owner||!session||!ownerCurrent(owner)||scope.incarnation!==owner.view.agent||scope.session!==session
        ||scope.signal.aborted||!owner.scope||!same(scope.requestedStep,owner.scope.requestedStep))return false
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
        markers:deps.markers,captureHistoricalCut,flush:deps.flush,captureOwned:selector=>{
          const owner=owners.get(selector.sessionId)
          if(!owner?.scope||owner.driver!==driver||!owner.inSource||!ownerCurrent(owner)
            ||owner.scope.requestedStep.eventId!==selector.batchId)fail('SCHEMA_OWNER_UNPROVEN')
          return owner.scope
        },checkOwned,withSourceBoundary:(scope,action)=>{
          const owner=scopes.get(scope.owner);if(!owner)fail('SCHEMA_OWNER_UNPROVEN');return withLease(owner,action)
        }}
      driver='host' in runtime?runtime.host.createReplay(bindings):createRoleplayMvuSchemaReplay({...bindings,
        executorVersion:runtime.executorVersion,compiler:runtime.compiler,runner:runtime.runner})
      drivers.set(runtime.implementationKey,driver)
    }
    return {runtime,driver}
  }
  async function preflight(sid:string,signal?:AbortSignal):Promise<void> {
    signal?.throwIfAborted()
    const existing=views.get(sid)
    if(existing&&viewCurrent(existing))return
    if(existing)deps.inputState.invalidateSession(sid)
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
    const {history}=read.data
    const {driver:replay}=await engine(history.ready)
    const verified=await replay.verifyHistorical({sessionId:sid,realmEpoch:history.original.realmEpoch,
      nativeCut:history.ready.frozen.nativeCut},signal)
    signal?.throwIfAborted()
    if(verified.kind!=='verified')fail(verified.code)
    // A captured DATA slot becomes readable only after actual historical
    // replay succeeds and all captured dependencies still belong to this owner.
    const view:View={...read.data,read}
    if(!viewCurrent(view))fail('SCHEMA_HISTORICAL_FACTS_CHANGED')
    views.set(sid,view)
    deps.inputState.schemaPublished(sid)
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
  function readSchemaObservation(sid:string):{snapshot:MvuSchemaNumericalSnapshotV2;
    displayUpdates:readonly MvuAcceptedDisplayUpdate[];
    commandDiagnostics?:readonly MvuDiscardedCommandObservation[]}|undefined {
    const view=views.get(sid),history=view&&viewCurrent(view)?view.history:undefined
    return history?{snapshot:structuredClone(history.snapshot),displayUpdates:history.displayUpdates??[],
      ...history.commandDiagnostics.length?{commandDiagnostics:history.commandDiagnostics}:{}}:undefined
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
        seq=>scopeOwnerForSeq(facts,seq),facts.messages))
    const data=Object.freeze({schemaVersion:1 as const,encoding:'native-mvu-prompt-scope-read-data-v1' as const,
      authority:'consumer-data-only' as const,basis,frame,readDataSha256:recordSha256({basis,frame})})
    // A later own pending input or interrupted provider attempt does not change
    // these already captured variable reads. Native's material owner validates
    // their selected message versions and its evolving request cut separately.
    const current=()=>viewCurrent(view)
    if(!current())return undefined
    let authorPrompt:AuthorPromptPreparationFactsV1|undefined,authorBrowser:AuthorBrowserPreparationFactsV2|undefined
    const ready=view.history.ready
    if(isAuthorHostJournalReadyV5(ready)&&(ready.epoch.program.schemaVersion===4||ready.epoch.program.schemaVersion===5)) {
      const browser=ready.epoch.program.browserProgram,
        binding=browser?.schemaVersion===2?deriveAuthorChatBindingV1(sid,browser):null,
        authorChat=binding&&deps.authorChat?deps.authorChat.capture(binding):null,
        opening=captureAuthorOpening(view,frame,events)
      // The completed schema opening already proves its original Native copy.
      // An edited projected version is excluded by the consumer's version join.
      const program=ready.epoch.program.promptProgram
      if(program)authorPrompt={program,opening,
        scopes:produceAuthorPromptScopeFrameV1(frame,program),...authorChat?{authorChat}:{}}
      if(browser?.schemaVersion===2) {
        const context=view.frame.material.openingContext as {user:string;user_gender?:string}
        authorBrowser={program:browser,opening,scopes:produceAuthorPromptScopeFrameV1(frame,browser),
          basis:{materialSha256:view.frame.materialSha256,numericalSnapshotSha256:view.history.snapshot.stateSnapshotSha256},
          numerical:browserNumericalSnapshot(view,events.length),
          persona:{name:context.user,...context.user_gender!==undefined?{gender:context.user_gender}:{},avatar:null},authorChat}
      }
    }
    return {data,current,...authorPrompt?{authorPrompt}:{},...authorBrowser?{authorBrowser}:{}}
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
    return runtime.prompt.execute(program,capture,signal)
  }
  function captureManualBasis(sid:string) {
    const view=views.get(sid)
    if(!view||!viewCurrent(view))fail('SCHEMA_PLAYER_BASE_UNPROVEN')
    return {session:view.session,agent:view.agent,original:view.history.original,
      ready:view.history.ready,base:view.history.snapshot,frame:view.frame,inheritedCut:view.history.inheritedCut,
      scopeReadFrame:(cut:SourceNativeCutFacts)=>{
        if(!view.history.readScopes||!scopeFactsCurrent(view.history.readScopes)
          ||!currentSession(view.session)||deps.agent(view.session)!==view.agent
          ||!deps.source.frameCurrent(view.history.original,view.frame))fail('SCHEMA_SCOPE_BASIS_UNPROVEN')
        // The maintenance owner invokes this synchronous reader under its
        // Source lease after verifying its exact numerical row baseline.
        return scopeFrameAt(view.history.readScopes,view.history.original,view.frame,cut,all(view.session))
      }}
  }
  async function captureBrowserFacts(sid:string) {
    await preflight(sid)
    const view=views.get(sid)
    if(!view||!viewCurrent(view))fail('SCHEMA_BROWSER_FACTS_UNPROVEN')
    const ready=view.history.ready
    if(!isAuthorHostJournalReadyV5(ready)||!ready.epoch.program.browserProgram)return undefined
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
      const message=projected.projectedMessageAt(entry.seq)??raw,ownerSessionId=scopeOwnerForSeq(facts,entry.seq)
      if(!message||message.id!==entry.messageId)fail('SCHEMA_SCOPE_MESSAGE_UNPROVEN')
      const messageVersionSha256=recordSha256(message),owner=schemaScopeOwner(source,'message',entry.messageId,ownerSessionId)
      const key=schemaScopeMessageKey(ownerSessionId,entry.seq,entry.messageId,messageVersionSha256)
      const variables=schemaScopeReowner(facts.messages.get(key)??schemaScopeEmpty(owner),owner)
      const identity={position,ownerSessionId,nativeSeq:entry.seq,messageId:entry.messageId,messageVersionSha256,
        selectedVariant:messageVersionSha256}
      messages.push({...identity,role:entry.kind,text:textOf(message.content)})
      return {...identity,isSystem:false as const,variables}
    })
    const scopeFrame=buildSchemaScopeReadFrame(source,recordSha256(basis),program.scripts.map(row=>row.descriptor),
      facts.chat,scoped)
    const data:Omit<BrowserSnapshotV1,'generation'|'readRevision'>={schemaVersion:1,encoding:'native-author-browser-snapshot-v1',
      basis,scopeFrame,messages,numerical:browserNumericalSnapshot(view,events.length)}
    // Attachment stability outlives this DATA's numerical/Native cut. Each
    // subsequent capture refreshes the view; writes keep their actual owner.
    const current=()=>{
      try {
        runtime.host.checkCurrent()
        return currentSession(session)&&deps.agent(session)===agent&&agent.session===session
          &&recordSha256(agent.lookupInputStop())===stopSha256&&deps.source.frameCurrent(original,frame)
      }catch {return false}
    }
    if(!current())fail('SCHEMA_BROWSER_FACTS_CHANGED')
    if(program.schemaVersion===1)return {program,artifact:runtime.browser.artifact as import('./tavern-author-browser-types.mjs').BrowserRuntimeArtifactV1,
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
    const authorBinding=deriveAuthorChatBindingV1(sid,program)
    const dataV2:Omit<BrowserSnapshotV2,'generation'|'readRevision'>={...data,
      schemaVersion:2,encoding:'native-author-browser-snapshot-v2',messages:capturedMessages,
      persona:{name:context.user,...context.user_gender!==undefined?{gender:context.user_gender}:{},avatar:null},
      authorChat:authorBinding&&deps.authorChat?deps.authorChat.capture(authorBinding):null}
    return {program,artifact:runtime.browser.artifact as BrowserRuntimeArtifactV2,data:dataV2,current}
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
        const genesis=deps.readDerivedGenesis?.(sid,false)
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
        const ready=journal.capture(session.id,plan.realmEpoch,events,owner.inheritedCut)
        if(ready.kind!=='ready')fail(ready.code)
        let capturedInput=input
        if(input.schemaVersion===3||input.schemaVersion===4) {
          if((plan.schemaVersion!==4&&plan.schemaVersion!==5&&plan.schemaVersion!==6)||input.schemaVersion!==plan.executorVersion
            ||!owner.readScopes||!schemaScopeReadFactsEqual(input.scopeReadFrame,plan.scopeReadFrame)) {
            fail('SCHEMA_SCOPE_BASIS_UNPROVEN')
          }
          const expected=scopeFrameAt(owner.readScopes,owner.original,owner.frame,cut,events)
          if(!schemaScopeReadFactsEqual(expected,plan.scopeReadFrame))fail('SCHEMA_SCOPE_BASIS_UNPROVEN')
          capturedInput={...input,scopeReadFrame:expected}
        }
        owner.scope={owner:owner.token,incarnation:owner.view.agent,session,
          signal:AbortSignal.any([owner.view.signal,owner.abort.signal]),authorInput:schemaOriginalReplayCompilationInput(owner.original),
          realmEpoch:plan.realmEpoch,loadFrame:schemaEpochExecution(ready.epoch).loadFrame,inheritedCut:owner.inheritedCut,sourceNativeCut:cut,
          requestedStep:schemaTraceRequestedStep(selector.batchId,{ownerSessionId:session.id,
            sourceNativeCutSha256:recordSha256(cut),material:owner.frame.material},capturedInput)}
        const {driver:replay}=await engine(ready)
        if(owner.driver!==replay)fail('SCHEMA_IMPLEMENTATION_CHANGED')
        const result=await replay.execute(selector)
        if(result.kind==='completed') {
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
      const ready=journal.capture(owner.view.session.id,boundary.plan.realmEpoch,all(owner.view.session as Session),owner.inheritedCut)
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
      const plan=transaction.makePlan(scope,canonical,base,frame,history.original.realmEpoch,schemaOriginalProgramSha256(history.original),
        initialCut,events[scope.receipt.turnEndSeq]!.time,executorVersion,scopeReadFrame,
        isAuthorHostJournalReadyV5(ready)?{epoch:ready.epochRef,
          serverProgramSha256:ready.epoch.program.serverProgram!.programSha256,
          ...(schemaPhaseErrorPolicyForProgramV4(ready.epoch.program.serverProgram!)==='registered-command-policy-v1'
            ?{errorPolicy:'registered-command-policy-v1' as const}:{})}:undefined)
      if(owners.has(sid))fail('SCHEMA_STORY_OWNER_EXISTS')
      const baseline=new Map([...prefixInputs.status.entries()].filter(([key])=>key.startsWith(`${sid}__mvu-`)
        &&!key.startsWith(`${sid}__mvu-schema-`)).map(([key,value])=>[key,recordSha256(value)]))
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
        readScopes:history.readScopes,inheritedCut:history.inheritedCut,abort:new AbortController(),
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
  return {preflight,observation,readSnapshot,readSchemaObservation,captureReaderDisplayScopes,capturePromptScopes,executePrompt,captureBrowserFacts,
    readEditBasis,captureManualBasis,captureHistoricalCut,
    captureForkPrefix,verifyForkPrefix,captureFrozenForkPrefix,verifyFrozenForkPrefix,
    prepareCompletion,releaseClosing,verifyConsumed,
    publishCompletion:(scope:InputCompletionScope,plan:MvuSchemaStoryPlan,closing?:object)=>closing
      ?transaction.publish(scope,plan,closing):Promise.resolve({kind:'blocked' as const,code:'SCHEMA_OWNER_UNPROVEN'}),
    verifySettlement:transaction.verifySettlement,
    invalidateSession(sid:string):void {
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
