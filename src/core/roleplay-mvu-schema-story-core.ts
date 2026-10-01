/** Actual closing-work owner and read-only history for schema story turns.
 * Source descriptors and stored terminal plans never mint this private lease. */
import {recordSha256,sha256,textOf} from './roleplay-data.js'
import {canonicalAssistantForTurn} from './roleplay-context.js'
import {openingIntentKey} from './roleplay-opening-selection.js'
import {mvuInitializationEventKey,mvuInitializationHeadKey} from './roleplay-mvu-initialization.js'
import {mvuStateCurrentHeadKey} from './roleplay-mvu-state.js'
import {readInputCompletion} from './roleplay-input-completion.js'
import {inputSnapshotReferenceCurrent} from './roleplay-preparation.js'
import {createRoleplayMvuSchemaJournal} from './roleplay-mvu-schema-journal.js'
import {createRoleplayMvuSchemaReplay} from './roleplay-mvu-schema-replay.js'
import {createRoleplayMvuSchemaStory} from './roleplay-mvu-schema-story.js'
import {validateMvuSchemaOpeningIntent,validateMvuSchemaOpeningEvent,validateMvuSchemaOpeningHead,
  verifyMvuSchemaOpeningFacts} from './roleplay-mvu-schema-opening-types.js'
import {sealMvuSchemaStoryFact,validateMvuSchemaNumericalSnapshot,validateMvuSchemaStoryEvent,
  validateMvuSchemaStorySettlement,mvuSchemaStoryHead,mvuSchemaStoryEventKey,mvuSchemaStorySettlementKey,
  MVU_SCHEMA_STORY_PHASES,isMvuSchemaGenesisHead} from './roleplay-mvu-schema-story-types.js'
import {validateMvuSchemaPlayerEvent,readMvuSchemaPlayerCompletedFacts,mvuSchemaPlayerEventKey,
  mvuSchemaPlayerHead,mvuSchemaPlayerOperationKey} from './roleplay-mvu-schema-player-types.js'
import {validateMvuSchemaFrozenPrefix} from './roleplay-mvu-schema-derived-types.js'
import {readMvuSchemaInheritedStoryFacts,verifyMvuSchemaInheritedOpeningFacts}
  from './roleplay-mvu-schema-prefix-facts.js'
import type {Session,SessionEvent} from '@deepseek-ai/dsh-session'
import type {NativeInputAdmissionAgentV2} from '@deepseek-ai/dsh-agent-loop'
import type {MvuSchemaRuntime} from 'dsh-nexttavern-mvu-schema-runtime'
import type {mvuSchemaMarkers} from 'dsh-nexttavern-session-format/mvu-schema-marker'
import type {InputCompletionScope} from './roleplay-input-completion.js'
import type {InputClosingView,InputObservation} from './roleplay-input-preparation.js'
import type {CompletedStoryBody} from './roleplay-mvu-story.js'
import type {createRoleplayMvuSchemaSource,SchemaFrozenOriginal,SchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import type {SchemaJournalReady,SourceNativeCutFacts} from './roleplay-mvu-schema-journal.js'
import type {SchemaOwnedScope,SchemaBoundary,SchemaExecutionSelector,SchemaExecutionAssociation,
  HistoricalCutSelector} from './roleplay-mvu-schema-replay.js'
import type {MvuSchemaNumericalSnapshotV2,MvuSchemaStoryPlanV2,MvuSchemaStoryPhase,
  MvuSchemaStoryLive,MvuSchemaStoryPublicationBoundary} from './roleplay-mvu-schema-story-types.js'
import type {MvuSchemaEvaluationInput} from './tavern-mvu-schema-types.js'
import type {MvuSchemaDerivedGenesis,MvuSchemaFrozenPrefixV1,MvuSchemaPrefixSeed}
  from './roleplay-mvu-schema-derived-types.js'
import type {SchemaJournalFrozenCut} from './roleplay-mvu-schema-journal.js'
import type {WorldlineMessageEdits} from './roleplay-worldline-types.js'
import type {MvuInheritedMessageEditProtocol} from './roleplay-mvu-prefix-facts.js'
import type {MvuEditInvalidation} from './roleplay-mvu-edit-facts.js'

interface Table {get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>;entries():Iterable<[string,unknown]>}
export interface MvuSchemaStoryCoreDeps {
  branch:Table
  status:Table
  source:ReturnType<typeof createRoleplayMvuSchemaSource>
  activePointer(sid:string):unknown
  session(sid:string):Session|undefined
  agent(session:Session):NativeInputAdmissionAgentV2|undefined
  active(session:Session):boolean
  sourceSha256(sid:string):string
  closingView(lease:object,scope:InputCompletionScope):InputClosingView|undefined
  protectedRuntime():Promise<MvuSchemaRuntime>
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
}
interface View {session:Session;agent:NativeInputAdmissionAgentV2|undefined;history:History;frame:SchemaStorySourceFrame}
interface Owner {
  lease:object;view:InputClosingView;original:SchemaFrozenOriginal;frame:SchemaStorySourceFrame
  base:MvuSchemaNumericalSnapshotV2;plan:MvuSchemaStoryPlanV2;abort:AbortController
  inheritedCut:SchemaJournalFrozenCut|null
  token:object;inSource:boolean;baseline:Map<string,string>;associations:SchemaExecutionAssociation[]
  scope?:SchemaOwnedScope;lastLive?:MvuSchemaStoryLive;publication?:MvuSchemaStoryPublicationBoundary
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
function fail(code:string):never {throw Error(code)}
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'SCHEMA_STORY_UNPROVEN'

export function createRoleplayMvuSchemaStoryCore(deps:MvuSchemaStoryCoreDeps) {
  const journal=createRoleplayMvuSchemaJournal({table:deps.status as never,markers:deps.markers})
  const views=new Map<string,View>(),owners=new Map<string,Owner>(),scopes=new WeakMap<object,Owner>()
  const sourceLeases=new Map<string,Owner>()
  let disposed=false,driver:ReturnType<typeof createRoleplayMvuSchemaReplay>|undefined
  const all=(session:Session)=>session.snapshotEvents()
  const currentSession=(session:Session)=>!disposed&&deps.session(session.id)===session&&deps.active(session)
  const frontier=(ready:SchemaJournalReady)=>({nativeCut:ready.steps.at(-1)!.completionMarker.seq+1,
    tailSha256:ready.tailSha256,frontierSha256:ready.frontierSha256})
  function snapshot(body:Omit<MvuSchemaNumericalSnapshotV2,'stateSnapshotSha256'>) {
    const {stateSnapshotSha256:_prior,...content}=body as MvuSchemaNumericalSnapshotV2
    return validateMvuSchemaNumericalSnapshot(sealMvuSchemaStoryFact(content,'stateSnapshotSha256'))
  }
  function associationAt(sid:string,events:readonly SessionEvent[],ready:SchemaJournalReady,index:number):SchemaExecutionAssociation {
    const step=ready.steps[index]
    if(!step)fail('SCHEMA_STORY_JOURNAL_UNPROVEN')
    const cut=step.completionMarker.seq+1
    const selected=journal.captureFrozen(sid,ready.epoch.realmEpoch,events.slice(0,cut),ready.frozen.records)
    if(selected.kind!=='ready')fail(selected.code)
    return {schemaVersion:1,encoding:'native-mvu-schema-execution-association-v1',sessionId:step.dispatch.sessionId,
      realmEpoch:ready.epoch.realmEpoch,batchId:step.dispatch.batchId,anchor:step.dispatch.sourceNativeCut.anchor,
      sourceNativeCutSha256:recordSha256(step.dispatch.sourceNativeCut),programSha256:ready.epoch.program.programSha256,
      dispatch:step.dispatchRef,completion:step.completionRef,dispatchMarker:step.dispatchMarker,
      completionMarker:step.completionMarker,tailSha256:step.step.stepSha256,frontierSha256:selected.frontierSha256,
      outputSha256:recordSha256(step.step.output)}
  }
  function eventRows(sid:string,nativeCut:number) {
    const rows=[...deps.status.entries()].filter(([key])=>key.startsWith(`${sid}__mvu-state-schema-story-event-`)
      ||key.startsWith(`${sid}__mvu-state-schema-player-event-`))
      .map(([key,row])=>({key,event:key.startsWith(`${sid}__mvu-state-schema-player-event-`)
        ?validateMvuSchemaPlayerEvent(row as never):validateMvuSchemaStoryEvent(row as never)}))
      .filter(item=>item.event.frontier.nativeCut<=nativeCut)
      .sort((a,b)=>a.event.phases[0]!.association.dispatchMarker.seq-b.event.phases[0]!.association.dispatchMarker.seq)
    return rows
  }
  function consume(sid:string,inheritedEventCount:number,events:readonly SessionEvent[],ready:SchemaJournalReady,
    initial:MvuSchemaNumericalSnapshotV2,ordinal:number,frozen=false) {
    const rows=eventRows(sid,events.length),root=initial.root,consumed=new Map<string,string>()
    let state=initial
    for(const event of events)if(event.type==='roleplay/mvu-manual-edit'
      &&event.seq>=inheritedEventCount&&event.data.sessionId===sid) {
      const operation=deps.branch.get(mvuSchemaPlayerOperationKey(sid,event.data.operationId))
      if(operation===undefined)fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
      if(frozen) {
        const facts=readMvuSchemaPlayerCompletedFacts(deps.branch,deps.status,operation as never,events)
        if(facts.event.frontier.nativeCut>events.length||!rows.some(row=>same(row.event,facts.event))) {
          fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
        }
      }
    }
    for(const {key,event} of rows) {
      const plan=event.plan,base='operation' in plan?plan.operation.base:plan.base
      const eventKey=event.encoding==='native-mvu-schema-player-event-v1'
        ?mvuSchemaPlayerEventKey(sid,event.eventId):mvuSchemaStoryEventKey(sid,event.eventId)
      if(key!==eventKey||!same(base.root,root)
        ||!same(base,snapshot({...state,sourceSha256:base.sourceSha256})))fail('SCHEMA_STORY_BASE_CHAIN_INVALID')
      let closure:unknown
      if(event.encoding==='native-mvu-schema-player-event-v1') {
        const facts=readMvuSchemaPlayerCompletedFacts(deps.branch,deps.status,event.plan.operation,events)
        if(!same(facts.event,event))fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
        closure={operation:facts.operation,plan:facts.plan,event,settlement:facts.settlement,completion:facts.completion}
      } else if(frozen) {
        const facts=readMvuSchemaInheritedStoryFacts({ownerSessionId:sid,ownerInheritedEventCount:inheritedEventCount,
          events,event},{branch:deps.branch,status:deps.status,editProtocol:deps.editProtocol,
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
        const terminal=readInputCompletion(deps.branch,sid,scope.currency.preparationId)
        const settlement=validateMvuSchemaStorySettlement(deps.status.get(mvuSchemaStorySettlementKey(sid,plan.planSha256)) as never,event)
        if(!terminal||terminal.status!=='settled'||terminal.plan.kind!=='schema-numerical'
          ||!same(terminal.scope,scope)||!same(terminal.plan.plan,plan)||!same(terminal.settlement,settlement)
          ||!deps.verifyConsumedScope(scope)||!deps.verifyNative(scope)
          ||!inputSnapshotReferenceCurrent(deps.branch,sid,scope.currency))fail('SCHEMA_STORY_TERMINAL_UNRESOLVED')
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
      }
      const head=event.encoding==='native-mvu-schema-player-event-v1'?mvuSchemaPlayerHead(event):mvuSchemaStoryHead(event)
      state=snapshot({schemaVersion:2,encoding:'native-mvu-schema-state-snapshot-v2',sessionId:sid,
        sourceSha256:base.sourceSha256,root,currentHead:head,revision:head.revision,headSha256:recordSha256(head),
        values:event.values,valuesSha256:event.valuesSha256,context:event.context,schemaFrontier:event.frontier})
      consumed.set(plan.planSha256,recordSha256(closure))
    }
    if(ordinal!==ready.steps.length||!same(state.schemaFrontier,frontier(ready)))fail('SCHEMA_STORY_HISTORY_UNSETTLED')
    return {state,consumed,eventKeys:rows.map(row=>row.key)}
  }
  function readyFor(sid:string,realmEpoch:string,events:readonly SessionEvent[],
    inheritedCut:SchemaJournalFrozenCut|null,historical=false):SchemaJournalReady {
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
  function initialForOpening(seed:Extract<MvuSchemaPrefixSeed,{kind:'opening'}>,sourceSha256:string,
    original:SchemaFrozenOriginal,ready:SchemaJournalReady,events:readonly SessionEvent[]) {
    const {event:opening,head:head,intent}=seed,sid=intent.sessionId,first=ready.steps[0]!
    if(!verifyMvuSchemaOpeningFacts(intent,opening,head)||first.step.output.kind!=='accepted'
      ||!same(first.step.output.values,opening.plan.values)
      ||!same(associationAt(sid,events,ready,0),opening.plan.execution))fail('SCHEMA_OPENING_JOURNAL_UNPROVEN')
    const root={openingEventId:opening.eventId,openingEventSha256:opening.eventSha256,openingHeadSha256:recordSha256(head),
      openingPlanSha256:opening.plan.planSha256,realmEpoch:original.realmEpoch,programSha256:original.programSha256}
    return snapshot({schemaVersion:2,encoding:'native-mvu-schema-state-snapshot-v2',sessionId:sid,sourceSha256,
      root,currentHead:head,revision:1,headSha256:recordSha256(head),values:opening.plan.values,valuesSha256:opening.valuesSha256,
      context:first.step.output.context,schemaFrontier:{nativeCut:first.completionMarker.seq+1,
        tailSha256:first.step.stepSha256,frontierSha256:opening.plan.execution.frontierSha256}})
  }
  function factual(session:Session,nativeCut=all(session).length,historical=false):History {
    const sid=session.id,events=all(session).slice(0,nativeCut),sourceSha256=deps.sourceSha256(sid)
    const manualBlock=deps.manualPendingCode?.(sid)
    if(manualBlock&&!historical)fail(manualBlock)
    let original:SchemaFrozenOriginal,initial:MvuSchemaNumericalSnapshotV2,seed:MvuSchemaPrefixSeed
    let ready:SchemaJournalReady,inheritedCut:SchemaJournalFrozenCut|null=null,ordinal=1
    if(deps.derivedRequired?.(sid)||session.inheritedEventCount||session.header.parentSession) {
      const genesis=deps.readDerivedGenesis?.(sid)
      if(!genesis||genesis.inheritedCut.nativeCut!==session.inheritedEventCount)fail('SCHEMA_DERIVED_GENESIS_UNPROVEN')
      original=genesis.original;inheritedCut=genesis.inheritedCut
      ready=readyFor(sid,original.realmEpoch,events,inheritedCut,historical)
      const inherited=journal.captureFrozen(inheritedCut.sessionId,original.realmEpoch,
        events.slice(0,inheritedCut.nativeCut),inheritedCut.records)
      if(inherited.kind!=='ready')fail(inherited.code)
      ordinal=inherited.steps.length
      initial=snapshot({...genesis.snapshot,sourceSha256})
      seed={kind:'derived',basisKey:genesis.basisKey,basisSha256:genesis.basisSha256}
    }else {
      const pointer=deps.activePointer(sid) as {importId?:string}|undefined
      if(!pointer?.importId)fail('SCHEMA_STORY_ROOT_REQUIRED')
      const intent=validateMvuSchemaOpeningIntent(deps.branch.get(openingIntentKey(sid,pointer.importId)) as never)
      if(intent.status!=='completed'||!intent.initialization)fail('SCHEMA_OPENING_NOT_COMPLETED')
      const storedHead=deps.status.get(mvuInitializationHeadKey(sid))
      if(storedHead===undefined)fail('HEAD_MISSING')
      const head=validateMvuSchemaOpeningHead(storedHead as never)
      const opening=validateMvuSchemaOpeningEvent(deps.status.get(mvuInitializationEventKey(sid,head.eventId)) as never)
      if(!deps.verifyOpening(intent))fail('SCHEMA_OPENING_RECORD_INVALID')
      ready=readyFor(sid,intent.preparation.realmEpoch,events,null,historical)
      original=deps.source.readFrozenOriginal(intent.preparation,ready,events)
      seed={kind:'opening',intent,event:opening,head}
      initial=initialForOpening(seed,sourceSha256,original,ready,events)
    }
    const edited=!historical&&deps.readEditInvalidation?.(sid)
    if(edited&&edited.kind!=='clear')fail(edited.code)
    const result=consume(sid,session.inheritedEventCount,events,ready,initial,ordinal,historical)
    let state=result.state
    const actualHead=deps.status.get(mvuStateCurrentHeadKey(sid))
    if(!historical&&(isMvuSchemaGenesisHead(state.currentHead)?actualHead!==undefined:!same(actualHead,state.currentHead))) {
      fail('SCHEMA_STORY_HEAD_UNPROVEN')
    }
    state=snapshot({...state,sourceSha256})
    return {original,ready,snapshot:state,consumed:result.consumed,initial,seed,inheritedCut,eventKeys:result.eventKeys,
      digest:recordSha256({original,epoch:ready.epoch,steps:ready.steps,frontierSha256:ready.frontierSha256,
        state,consumed:[...result.consumed]})}
  }
  function verifyForkPrefix(input:MvuSchemaFrozenPrefixV1,events:readonly SessionEvent[],
    genesis?:MvuSchemaDerivedGenesis):boolean {
    try {
      const prefix=validateMvuSchemaFrozenPrefix(input),sid=prefix.sessionId
      if(events.length!==prefix.journal.nativeCut||!deps.source.originalFactsCurrent(prefix.original))return false
      const frozen=journal.validateFrozen(prefix.journal,events)
      const ready=journal.captureFrozen(sid,prefix.original.realmEpoch,events,frozen.records)
      if(ready.kind!=='ready')return false
      let initial:MvuSchemaNumericalSnapshotV2,ordinal=1
      if(prefix.seed.kind==='opening') {
        const seed=prefix.seed
        if(!same(deps.branch.get(openingIntentKey(sid,seed.intent.source.importId)),seed.intent)
          ||!same(deps.status.get(mvuInitializationEventKey(sid,seed.event.eventId)),seed.event)
          ||!same(deps.status.get(mvuInitializationHeadKey(sid)),seed.head)
          ||!verifyMvuSchemaInheritedOpeningFacts({intent:seed.intent,event:seed.event,head:seed.head,events},
            {projectPrefix:deps.projectPrefix}))return false
        const original=deps.source.readFrozenOriginal(seed.intent.preparation,ready,events)
        if(!same(original,prefix.original))return false
        initial=initialForOpening(seed,prefix.sourceSha256,original,ready,events)
      }else {
        if(!genesis||genesis.sessionId!==sid||genesis.basisKey!==prefix.seed.basisKey
          ||genesis.basisSha256!==prefix.seed.basisSha256||!same(genesis.original,prefix.original)
          ||genesis.inheritedCut.nativeCut!==prefix.inheritedEventCount)return false
        const inherited=journal.validateFrozen(genesis.inheritedCut,events.slice(0,prefix.inheritedEventCount))
        const prior=journal.captureFrozen(inherited.sessionId,inherited.realmEpoch,
          events.slice(0,prefix.inheritedEventCount),inherited.records)
        if(prior.kind!=='ready')return false
        ordinal=prior.steps.length
        initial=snapshot({...genesis.snapshot,sourceSha256:prefix.sourceSha256})
      }
      if(!same(initial,prefix.initial))return false
      const result=consume(sid,prefix.inheritedEventCount,events,ready,initial,ordinal,true)
      const state=snapshot({...result.state,sourceSha256:prefix.sourceSha256})
      if(!same(state,prefix.snapshot)||!same(result.eventKeys,prefix.eventKeys)
        ||!same([...result.consumed].map(([planSha256,closureSha256])=>({planSha256,closureSha256})),prefix.consumed))return false
      // A completed Native story without its settled numerical result is not a
      // forkable baseline, even when author dispatch has not started yet.
      for(const [key,row] of deps.branch.entries())if(key.startsWith(`${sid}__native-input-v2-work-`)) {
        const work=row as {source?:{kind?:string;headRef?:{kind?:string}};checkpoint?:{actualTurn?:number};
          preparationId?:string;terminalRequired?:boolean}
        if(work.source?.kind!=='story'||work.source.headRef?.kind!=='schema-head'||!work.checkpoint)continue
        const completed=events.find(event=>event.type==='turn/end'&&event.data.turn===work.checkpoint!.actualTurn
          &&event.data.reason.kind==='completed')
        if(!completed||completed.seq<prefix.inheritedEventCount)continue
        const terminal=work.preparationId&&readInputCompletion(deps.branch,sid,work.preparationId)
        if(work.terminalRequired!==true||!terminal||terminal.status!=='settled'||terminal.plan.kind!=='schema-numerical'
          ||!result.consumed.has(terminal.plan.plan.planSha256))return false
      }
      return true
    }catch {return false}
  }
  async function captureForkPrefix(sid:string,nativeCut:number):Promise<MvuSchemaFrozenPrefixV1> {
    const session=deps.session(sid)
    if(!session||!currentSession(session)||!Number.isSafeInteger(nativeCut)||nativeCut<1
      ||nativeCut>all(session).length)fail('SCHEMA_DERIVED_PARENT_UNPROVEN')
    const history=factual(session,nativeCut,true)
    const {driver:replay}=await engine()
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
  function viewCurrent(view:View):boolean {
    try {
      if(!currentSession(view.session)||deps.agent(view.session)!==view.agent
        ||!deps.source.frameCurrent(view.history.original,view.frame))return false
      return factual(view.session).digest===view.history.digest
    } catch {return false}
  }
  async function captureHistoricalCut(selector:HistoricalCutSelector) {
    const session=deps.session(selector.sessionId)
    if(!session||!currentSession(session))fail('SCHEMA_SESSION_INACTIVE')
    // Select the pinned original realm explicitly. A read-only cut must not
    // borrow today's active pointer, current numerical head or later material.
    const prefix=all(session).slice(0,selector.nativeCut)
    const derived=deps.derivedRequired?.(session.id)?deps.readDerivedGenesis?.(session.id):undefined
    if(deps.derivedRequired?.(session.id)) {
      if(!derived||derived.original.realmEpoch!==selector.realmEpoch)fail('SCHEMA_DERIVED_GENESIS_UNPROVEN')
      const ready=readyFor(session.id,selector.realmEpoch,prefix,derived.inheritedCut,true)
      await deps.protectedRuntime()
      return {authorInput:derived.original.authorInput,frozen:ready.frozen,events:all(session)}
    }
    const matches=[...deps.branch.entries()].filter(([key,row])=>key.startsWith(`${session.id}__opening-choice-`)
      &&(row as {schemaVersion?:number}).schemaVersion===5
      &&(row as ReturnType<typeof validateMvuSchemaOpeningIntent>).preparation?.realmEpoch===selector.realmEpoch)
    if(matches.length!==1)fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN')
    const intent=validateMvuSchemaOpeningIntent(matches[0]![1] as never)
    if(intent.status!=='completed'||!deps.verifyOpening(intent))fail('SCHEMA_OPENING_RECORD_INVALID')
    const ready=journal.captureFrozen(session.id,selector.realmEpoch,prefix,journal.inventory(session.id))
    if(ready.kind!=='ready')fail(ready.code)
    const original=deps.source.readFrozenOriginal(intent.preparation,ready,prefix)
    // Re-admit protected bytes for every waiter, including a cache hit.
    await deps.protectedRuntime()
    return {authorInput:original.authorInput,frozen:ready.frozen,events:all(session)}
  }
  function rowsCurrent(owner:Owner):boolean {
    const sid=owner.view.session.id,boundary=owner.publication,proposed=new Map<string,unknown>()
    if(boundary) {
      proposed.set(mvuSchemaStoryEventKey(sid,boundary.event.eventId),boundary.event)
      if(boundary.event.outcome==='accepted')proposed.set(mvuStateCurrentHeadKey(sid),boundary.head)
      proposed.set(mvuSchemaStorySettlementKey(sid,boundary.plan.planSha256),boundary.settlement)
    }
    const actual=new Map([...deps.status.entries()].filter(([key])=>key.startsWith(`${sid}__mvu-`)
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
    if(!view||!view.current()||disposed||owner.abort.signal.aborted||owners.get(sid)!==owner
      ||view.agent!==owner.view.agent||view.session!==owner.view.session||!currentSession(owner.view.session as Session)
      ||deps.agent(owner.view.session as Session)!==view.agent
      ||deps.sourceSha256(sid)!==owner.plan.scope.currency.source.sourceSha256
      ||!deps.source.frameCurrent(owner.original,owner.frame)||!rowsCurrent(owner))return false
    const body=deps.readCanonical(sid,owner.plan.scope.receipt.checkpoint.actualTurn)
    return !!body&&same(owner.plan.canonical,{...body,narrativeSha256:sha256(body.narrative)})
  }
  function checkOwned(scope:SchemaOwnedScope,boundary:SchemaBoundary):boolean {
    try {
      const owner=scopes.get(scope.owner),session=owner?.view.session as Session|undefined
      if(!owner||!session||!ownerCurrent(owner)||scope.incarnation!==owner.view.agent||scope.session!==session
        ||scope.signal.aborted||!owner.scope||!same(scope.requestedStep,owner.scope.requestedStep))return false
      const events=all(session),initial=owner.plan.initialCut,cut=scope.sourceNativeCut.nativeCut
      if(recordSha256(events.slice(0,initial.nativeCut))!==initial.nativePrefixSha256
        ||cut!==initial.nativeCut+2*owner.associations.length
        ||recordSha256(events.slice(0,cut))!==scope.sourceNativeCut.nativePrefixSha256)return false
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
  async function engine() {
    const runtime=await deps.protectedRuntime()
    if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
    driver??=createRoleplayMvuSchemaReplay({table:deps.status as never,compiler:runtime.compiler,runner:runtime.runner,
      markers:deps.markers,captureHistoricalCut,flush:deps.flush,captureOwned:selector=>{
        const owner=owners.get(selector.sessionId)
        if(!owner?.scope||!owner.inSource||!ownerCurrent(owner)
          ||owner.scope.requestedStep.eventId!==selector.batchId)fail('SCHEMA_OWNER_UNPROVEN')
        return owner.scope
      },checkOwned,withSourceBoundary:(scope,action)=>{
        const owner=scopes.get(scope.owner);if(!owner)fail('SCHEMA_OWNER_UNPROVEN');return withLease(owner,action)
      }})
    return {runtime,driver}
  }
  async function preflight(sid:string,signal?:AbortSignal):Promise<void> {
    signal?.throwIfAborted()
    const session=deps.session(sid)
    if(!session||!currentSession(session))fail('SCHEMA_SESSION_INACTIVE')
    const agent=deps.agent(session),history=factual(session),frame=deps.source.captureFrame(history.original,sid)
    const {driver:replay}=await engine()
    const verified=await replay.verifyHistorical({sessionId:sid,realmEpoch:history.original.realmEpoch,
      nativeCut:history.ready.frozen.nativeCut},signal)
    signal?.throwIfAborted()
    if(verified.kind!=='verified')fail(verified.code)
    const view={session,agent,history,frame}
    if(!viewCurrent(view))fail('SCHEMA_HISTORICAL_FACTS_CHANGED')
    views.set(sid,view)
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
  function captureManualBasis(sid:string) {
    const view=views.get(sid)
    if(!view||!viewCurrent(view))fail('SCHEMA_PLAYER_BASE_UNPROVEN')
    return {session:view.session,agent:view.agent,original:view.history.original,
      ready:view.history.ready,base:view.history.snapshot,frame:view.frame,inheritedCut:view.history.inheritedCut}
  }
  /** A denial basis survives later projection/head changes. This selects only
   * immutable original Native/author facts and never exposes numerical values. */
  function readEditBasis(sid:string) {
    try {
      const session=deps.session(sid)
      if(!session)return undefined
      if(deps.derivedRequired?.(sid)) {
        const genesis=deps.readDerivedGenesis?.(sid,false)
        return genesis?{root:genesis.snapshot.root,editFloorSeq:genesis.inheritedCut.nativeCut}:undefined
      }
      const raw=deps.status.get(mvuInitializationHeadKey(sid))
      if(!raw)return undefined
      const head=validateMvuSchemaOpeningHead(raw as never)
      const event=validateMvuSchemaOpeningEvent(deps.status.get(mvuInitializationEventKey(sid,head.eventId)) as never)
      const intent=validateMvuSchemaOpeningIntent(deps.branch.get(openingIntentKey(sid,event.plan.identity.source.importId)) as never)
      const events=all(session),native=event.native
      if(native.turnEndSeq>=events.length||!verifyMvuSchemaInheritedOpeningFacts({intent,event,head,
        events:events.slice(0,native.turnEndSeq+1)},{projectPrefix:deps.projectPrefix}))return undefined
      const cut=intent.initialization!.execution.completionMarker.seq+1
      const ready=journal.captureFrozen(sid,intent.preparation.realmEpoch,events.slice(0,cut),journal.inventory(sid))
      if(ready.kind!=='ready')return undefined
      const original=deps.source.readFrozenOriginal(intent.preparation,ready,events.slice(0,cut))
      return {root:{openingEventId:event.eventId,openingEventSha256:event.eventSha256,
        openingHeadSha256:recordSha256(head),openingPlanSha256:event.plan.planSha256,
        realmEpoch:original.realmEpoch,programSha256:original.programSha256},editFloorSeq:native.turnEndSeq+1}
    }catch {return undefined}
  }
  function ownerFor(closing:object,plan:MvuSchemaStoryPlanV2):Owner|undefined {
    const owner=owners.get(plan.base.sessionId)
    return owner&&owner.lease===closing&&same(owner.plan,plan)?owner:undefined
  }
  const transaction=createRoleplayMvuSchemaStory({table:deps.status,
    readReady:(_scope,plan)=>{
      const owner=owners.get(plan.base.sessionId)
      return owner&&same(owner.plan,plan)&&ownerCurrent(owner)
        ?{kind:'ready',snapshot:owner.base}:{kind:'blocked',code:'SCHEMA_STORY_BASE_CHANGED'}
    },closingCurrent:(closing,scope,plan)=>{
      const owner=ownerFor(closing,plan)
      return !!owner&&same(scope,plan.scope)&&ownerCurrent(owner)
    },executePhase:async(plan,phase,input,closing)=>{
      const owner=ownerFor(closing,plan)
      if(!owner||!ownerCurrent(owner))return {kind:'blocked',code:'SCHEMA_STORY_PERMISSION_REVOKED'}
      return withLease(owner,async()=>{
        const index=MVU_SCHEMA_STORY_PHASES.indexOf(phase),selector=plan.selectors[index]!
        if(index!==owner.associations.length)fail('SCHEMA_STORY_PHASE_ORDER')
        const session=owner.view.session as Session,events=all(session),cut:SourceNativeCutFacts={...plan.initialCut,
          nativeCut:events.length,nativePrefixSha256:recordSha256(events),anchor:selector.anchor}
        const ready=journal.capture(session.id,plan.realmEpoch,events,owner.inheritedCut)
        if(ready.kind!=='ready')fail(ready.code)
        owner.scope={owner:owner.token,incarnation:owner.view.agent,session,
          signal:AbortSignal.any([owner.view.signal,owner.abort.signal]),authorInput:owner.original.authorInput,
          realmEpoch:plan.realmEpoch,loadFrame:ready.epoch.loadFrame,inheritedCut:owner.inheritedCut,sourceNativeCut:cut,
          requestedStep:{eventId:selector.batchId,frame:{ownerSessionId:session.id,
            sourceNativeCutSha256:recordSha256(cut),material:owner.frame.material,input}}}
        const {driver:replay}=await engine(),result=await replay.execute(selector)
        if(result.kind==='completed') {owner.lastLive=result;owner.associations.push(result.association)}
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
      try {return !!driver?.checkEvidence(lastLive.evidence,{association:lastLive.association,output:lastLive.output})}
      finally {owner.associations.push(lastLive.association)}
    }})
  async function prepareCompletion(scope:InputCompletionScope,closing?:object) {
    if(!closing)fail('SCHEMA_OWNER_UNPROVEN')
    const view=deps.closingView(closing,scope),sid=scope.receipt.checkpoint.sessionId
    if(!view||!view.current()||!deps.verifyNative(scope))fail('SCHEMA_OWNER_UNPROVEN')
    await deps.awaitOwnedCompletion(sid,scope.receipt.checkpoint.actualTurn)
    if(!view.current())fail('SCHEMA_STORY_PERMISSION_REVOKED')
    const session=view.session as Session,body=deps.readCanonical(sid,scope.receipt.checkpoint.actualTurn)
    const row=scope.currency.snapshot&&deps.branch.get(scope.currency.snapshot.key) as {numericalState?:MvuSchemaNumericalSnapshotV2}|undefined
    const base=row?.numericalState
    if(!body||!base||!inputSnapshotReferenceCurrent(deps.branch,sid,scope.currency))fail('SCHEMA_STORY_BASIS_CHANGED')
    const history=factual(session),frame=deps.source.captureFrame(history.original,sid),canonical={...body,narrativeSha256:sha256(body.narrative)}
    if(!same(base,history.snapshot)||deps.sourceSha256(sid)!==scope.currency.source.sourceSha256)fail('SCHEMA_STORY_BASIS_CHANGED')
    const phase=deps.branch.get(`${sid}__phaseb-${scope.receipt.checkpoint.actualTurn}`) as {state?:string;assistantSeq?:number}|undefined
    if(phase?.state!=='completed'||phase.assistantSeq!==body.seq)fail('INPUT_TERMINAL_PHASE_BC_UNRESOLVED')
    const selectorsAnchor={kind:'story' as const,preparationId:scope.currency.preparationId,
      attemptGeneration:scope.currency.attemptGeneration,receiptGeneration:scope.currency.receiptGeneration,
      turn:scope.receipt.checkpoint.actualTurn,canonicalSeq:body.seq,messageId:body.messageId,messageVersionSha256:body.versionSha256}
    const events=all(session),initialCut:SourceNativeCutFacts={schemaVersion:1,sessionId:sid,ownerSessionId:sid,
      nativeCut:events.length,nativePrefixSha256:recordSha256(events),sourceSnapshotSha256:frame.snapshotSha256,
      materialSha256:frame.materialSha256,stopGeneration:scope.stopGeneration,anchor:selectorsAnchor}
    const plan=transaction.makePlan(scope,canonical,base,frame,history.original.realmEpoch,history.original.programSha256,
      initialCut,events[scope.receipt.turnEndSeq]!.time)
    if(owners.has(sid))fail('SCHEMA_STORY_OWNER_EXISTS')
    const baseline=new Map([...deps.status.entries()].filter(([key])=>key.startsWith(`${sid}__mvu-`)
      &&!key.startsWith(`${sid}__mvu-schema-`)).map(([key,value])=>[key,recordSha256(value)]))
    // Existing complete story facts remain immutable during this publication.
    for(const [key,value] of deps.status.entries())if(key.startsWith(`${sid}__mvu-state-schema-story-`))baseline.set(key,recordSha256(value))
    const owner:Owner={lease:closing,view,original:history.original,frame,base,plan,inheritedCut:history.inheritedCut,abort:new AbortController(),
      token:Object.freeze({}),inSource:false,baseline,associations:[]}
    owners.set(sid,owner);scopes.set(owner.token,owner)
    return plan
  }
  function releaseClosing(lease:object):void {
    for(const [sid,owner] of owners)if(owner.lease===lease) {
      owner.abort.abort();driver?.invalidateOwner(owner.token);owners.delete(sid);views.delete(sid)
    }
  }
  function verifyConsumed(scope:InputCompletionScope,plan:MvuSchemaStoryPlanV2,settlement:unknown):boolean {
    const view=views.get(plan.base.sessionId)
    if(!view||!viewCurrent(view)||!transaction.verifyConsumed(scope,plan,settlement))return false
    try {
      const terminal=readInputCompletion(deps.branch,plan.base.sessionId,scope.currency.preparationId)
      const event=deps.status.get((settlement as {event:{key:string}}).event.key)
      return view.history.consumed.get(plan.planSha256)===recordSha256({terminal,event,settlement})
    } catch {return false}
  }
  return {preflight,observation,readSnapshot,readEditBasis,captureManualBasis,captureHistoricalCut,captureForkPrefix,verifyForkPrefix,
    prepareCompletion,releaseClosing,verifyConsumed,
    publishCompletion:(scope:InputCompletionScope,plan:MvuSchemaStoryPlanV2,closing?:object)=>closing
      ?transaction.publish(scope,plan,closing):Promise.resolve({kind:'blocked' as const,code:'SCHEMA_OWNER_UNPROVEN'}),
    verifySettlement:transaction.verifySettlement,
    invalidateSession(sid:string):void {
      const owner=owners.get(sid);if(owner)releaseClosing(owner.lease);views.delete(sid)
    },
    invalidateAgent(agent:object):void {
      for(const owner of owners.values())if(owner.view.agent===agent)releaseClosing(owner.lease)
      for(const [sid,view] of views)if(view.agent===agent)views.delete(sid)
    },
    dispose():void {disposed=true;for(const owner of owners.values())releaseClosing(owner.lease);views.clear();driver?.dispose()},
  }
}
