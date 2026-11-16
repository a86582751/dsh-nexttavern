/** Read-only proof of completed Guest pairs that have no fully consumed
 * numerical publication. A verified tail remains unpublished: this module
 * owns no execution lease, scope state, head, reconciliation or owner ACK. */
import {recordSha256,textOf} from './roleplay-data.js'
import {canonicalAssistantForTurn} from './roleplay-context.js'
import {inputCompletionKey} from './roleplay-input-completion.js'
import {readMvuSchemaUnpublishedStoryPlanFacts,readMvuSchemaStoryStartFacts} from './roleplay-mvu-schema-prefix-facts.js'
import {validateMvuSchemaStoryStart,mvuSchemaStoryStartKey} from './roleplay-mvu-schema-story-start.js'
import type {MvuSchemaStoryStartV1} from './roleplay-mvu-schema-story-start.js'
import {schemaEpochExecution,schemaEpochAuthorIdentity,isSchemaBrowserFacts}
  from './roleplay-mvu-schema-journal.js'
import {schemaOriginalProgramSha256} from './roleplay-mvu-schema-source.js'
import {schemaExecutionProgramSha256} from './roleplay-mvu-schema-replay.js'
import {sealMvuSchemaStoryFact,validateMvuSchemaNumericalSnapshot,validateMvuSchemaStoryPlan,
  mvuSchemaStoryPhaseInput,mvuSchemaStoryEvent,mvuSchemaStoryEventKey,
  mvuSchemaStorySettlement,mvuSchemaStorySettlementKey,validateMvuSchemaStoryEvent,
  validateMvuSchemaStorySettlement,mvuSchemaStorySelector,mvuSchemaStoryVariables,mvuSchemaStoryExecutionId} from './roleplay-mvu-schema-story-types.js'
import {validateMvuSchemaPlayerPlan,readMvuSchemaPlayerPlanFacts,mvuSchemaPlayerPlanKey,
  mvuSchemaPlayerPhaseInput,mvuSchemaPlayerEvent,mvuSchemaPlayerEventKey,
  mvuSchemaPlayerSettlement,mvuSchemaPlayerSettlementKey,mvuSchemaPlayerCompletionKey,
  validateMvuSchemaPlayerEvent,validateMvuSchemaPlayerSettlement,validateMvuSchemaPlayerCompletion,
  mvuSchemaPlayerPhases} from './roleplay-mvu-schema-player-types.js'
import type {SessionEvent} from 'dsh-nexttavern-native-session'
import type {SchemaJournalReady,SchemaJournalLiveReady,SchemaJournalStepFacts,SourceNativeCutFacts} from './roleplay-mvu-schema-journal.js'
import type {SchemaFrozenOriginal,SchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import type {SchemaExecutionAssociation,SchemaExecutionSelector} from './roleplay-mvu-schema-replay.js'
import type {MvuSchemaNumericalSnapshotV2,MvuSchemaStoryPlanV13,MvuSchemaStoryPhaseFact,
  MvuSchemaStoryBrowserExecutionV1,MvuSchemaStoryBrowserHookFact} from './roleplay-mvu-schema-story-types.js'
import type {MvuSchemaPlayerPlanV1,MvuSchemaPlayerPhaseFact} from './roleplay-mvu-schema-player-types.js'
import type {MvuSchemaUnpublishedStoryPlanFacts} from './roleplay-mvu-schema-prefix-facts.js'
import type {WorldlineMessageEdits} from './roleplay-worldline-types.js'
import type {MvuInheritedMessageEditProtocol} from './roleplay-mvu-prefix-facts.js'
import type {MvuScopeReadRefV2} from './tavern-mvu-scope-view-v2.js'

export interface MvuSchemaUnpublishedTailRequest {
  sessionId:string
  inheritedEventCount:number
  events:readonly SessionEvent[]
  ready:SchemaJournalReady|SchemaJournalLiveReady
  /** First journal step not already consumed by Root's publication fold. */
  ordinal:number
  snapshot:MvuSchemaNumericalSnapshotV2
  original:SchemaFrozenOriginal
}
export interface MvuSchemaUnpublishedTailDeps {
  branch:{get(key:string):unknown;entries():Iterable<[string,unknown]>}
  status:{get(key:string):unknown}
  projectPrefix:WorldlineMessageEdits['projectPrefix']
  editProtocol:MvuInheritedMessageEditProtocol
  /** Core rebuilds this frame from the actual immutable Import, never today's
   * active pointer or current numerical head. Hash equality is insufficient. */
  verifyFrozenFrame(original:SchemaFrozenOriginal,frame:SchemaStorySourceFrame):boolean
  /** Reference-protocol plans retain only a scope reference; Core resolves it
   * against the same proven fold chronologically. */
  verifyScopeRef(reference:MvuScopeReadRefV2,frame:SchemaStorySourceFrame,cut:SourceNativeCutFacts,logicalCut?:number):void
  associationAt(index:number):SchemaExecutionAssociation
  /** Root's unique live owner already selected this execution. Stored plan
   * facts below still prove its immutable DATA and historical provenance. */
  activeStory?:MvuSchemaStoryPlanV13|MvuSchemaStoryStartV1
}
type Candidate={kind:'story';plan:MvuSchemaStoryPlanV13;key:string}
  |{kind:'start';plan:MvuSchemaStoryStartV1;key:string}
  |{kind:'player';plan:MvuSchemaPlayerPlanV1;key:string}
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const integer=(value:unknown,min=0):value is number=>typeof value==='number'&&Number.isSafeInteger(value)
  &&value>=min&&!Object.is(value,-0)
function fail():never {throw Error('SCHEMA_HISTORICAL_TAIL_UNPROVEN')}
/** Candidate discovery only reads own data fields. Full bounded validators
 * run after the realm filter; unrelated valid realms are not revalidated. */
function own(input:unknown,key:string):unknown {
  if(!input||typeof input!=='object'||Array.isArray(input))return undefined
  const field=Object.getOwnPropertyDescriptor(input,key)
  if(!field)return undefined
  if(!('value' in field)||!field.enumerable)fail()
  return field.value
}
function baseOf(candidate:Candidate) {
  return candidate.kind==='player'?candidate.plan.operation.base:candidate.plan.base
}
function candidatePlans(request:MvuSchemaUnpublishedTailRequest,deps:MvuSchemaUnpublishedTailDeps,
  first:SchemaJournalStepFacts):Candidate[] {
  if(deps.activeStory) {
    const plan=deps.activeStory,sid=request.sessionId
    return ['startSha256' in plan?{kind:'start',plan,
      key:mvuSchemaStoryStartKey(sid,plan.work.currency.preparationId,plan.canonical.seq)}
      :{kind:'story',plan,key:inputCompletionKey(sid,plan.scope.currency.preparationId)}]
  }
  const sid=request.sessionId,realm=request.ready.epoch.realmEpoch,result:Candidate[]=[]
  const terminalPrefix=`${sid}__native-input-v2-terminal-`,playerPrefix=`${sid}__mvu-schema-player-plan-`,
    startPrefix=`${sid}__mvu-schema-maintenance-start-`
  for(const [key,row] of deps.branch.entries()) {
    let kind:Candidate['kind'],raw:unknown
    if(key.startsWith(terminalPrefix)) {
      const wrapper=own(row,'plan')
      if(own(wrapper,'kind')!=='schema-numerical')continue
      kind='story';raw=own(wrapper,'plan')
    }else if(key.startsWith(playerPrefix)) {kind='player';raw=row}
    else if(key.startsWith(startPrefix)) {kind='start';raw=row}
    else continue
    const rowRealm=own(raw,'realmEpoch')
    if(typeof rowRealm!=='string')fail()
    if(rowRealm!==realm)continue
    const initialCut=own(raw,'initialCut'),nativeCut=own(initialCut,'nativeCut')
    // A later durable plan cannot contaminate an earlier frozen Native view.
    // Its bytes are intentionally not validated using this selected prefix.
    if(integer(nativeCut)&&nativeCut>request.events.length)continue
    const candidate:Candidate=kind==='story'?{kind,plan:validateMvuSchemaStoryPlan(raw as MvuSchemaStoryPlanV13),key}
      :kind==='start'?{kind,plan:validateMvuSchemaStoryStart(raw as MvuSchemaStoryStartV1),key}
        :{kind,plan:validateMvuSchemaPlayerPlan(raw as MvuSchemaPlayerPlanV1),key}
    const {plan}=candidate,expected=candidate.kind==='story'?inputCompletionKey(sid,candidate.plan.scope.currency.preparationId)
      :candidate.kind==='start'?mvuSchemaStoryStartKey(sid,candidate.plan.work.currency.preparationId,candidate.plan.canonical.seq)
        :mvuSchemaPlayerPlanKey(sid,candidate.plan.operation.operationId)
    if(key!==expected||baseOf(candidate).sessionId!==sid)fail()
    // Earlier completed plans are Root's responsibility. Any same-realm plan
    // touching or following this Native tail competes for its single owner.
    if(plan.initialCut.nativeCut>=first.dispatchMarker.seq
      ||plan.selectors.some(selector=>selector.batchId===first.dispatch.batchId))result.push(candidate)
  }
  return result.filter(candidate=>candidate.kind!=='start'||!result.some(other=>other.kind==='story'
    &&other.plan.executionStart?.key===candidate.key&&other.plan.executionStart.sha256===candidate.plan.startSha256))
}
function proveCut(request:MvuSchemaUnpublishedTailRequest,cutInput:SourceNativeCutFacts,
  initial:SourceNativeCutFacts,frame:SchemaStorySourceFrame,selector:SchemaExecutionSelector,seq:number) {
  // The Journal owner already joined this source cut to the actual Native
  // prefix. This reader binds that checked result to the selected execution.
  const cut=cutInput
  if(cut.sessionId!==request.sessionId||cut.ownerSessionId!==request.sessionId||cut.nativeCut!==seq
    ||seq<request.inheritedEventCount||seq>request.events.length
    ||cut.sourceSnapshotSha256!==frame.snapshotSha256||cut.materialSha256!==frame.materialSha256
    ||cut.stopGeneration!==initial.stopGeneration||!same(cut.anchor,selector.anchor))fail()
}
function provePair(request:MvuSchemaUnpublishedTailRequest,deps:MvuSchemaUnpublishedTailDeps,
  candidate:Candidate,index:number,step:SchemaJournalStepFacts):SchemaExecutionAssociation {
  const plan=candidate.plan,selector=candidate.kind!=='player'
    ?mvuSchemaStorySelector(candidate.plan,index):plan.selectors[index]
  if(!selector)fail()
  // Journal already owns row grammar, receipt hashes, Native markers and the
  // linked server chain. This reader binds that accepted pair to its plan.
  proveCut(request,step.dispatch.sourceNativeCut,plan.initialCut,plan.currentFrame,selector,step.dispatchMarker.seq)
  if(index===0&&(!same(step.dispatch.sourceNativeCut,plan.initialCut)
    ||step.step.previousStepSha256!==request.snapshot.schemaFrontier.tailSha256))fail()
  const association=deps.associationAt(request.ordinal+index)
  if(association.schemaVersion!==5||!same(association.epoch,plan.epoch)
    ||association.serverProgramSha256!==plan.serverProgramSha256
    ||association.sessionId!==request.sessionId||association.realmEpoch!==plan.realmEpoch
    ||association.batchId!==selector.batchId||schemaExecutionProgramSha256(association)!==plan.programSha256
    ||!same(association.anchor,selector.anchor))fail()
  return association
}
function storyPublication(candidate:Extract<Candidate,{kind:'story'}>,facts:MvuSchemaUnpublishedStoryPlanFacts,
  phases:readonly MvuSchemaStoryPhaseFact[],
  deps:MvuSchemaUnpublishedTailDeps,selectedCut:number,browser?:MvuSchemaStoryBrowserExecutionV1):void {
  const plan=candidate.plan,sid=plan.base.sessionId
  const eventId=recordSha256({encoding:'native-mvu-schema-story-event-identity-v2',planSha256:plan.planSha256})
  const rawEvent=deps.status.get(mvuSchemaStoryEventKey(sid,eventId))
  const rawSettlement=deps.status.get(mvuSchemaStorySettlementKey(sid,plan.planSha256))
  const embedded=facts.terminal.settlement
  if(rawEvent===undefined&&rawSettlement===undefined&&embedded===undefined){
    const last=phases.at(-1)?.output
    if(last&&(last.kind==='refused'||'update' in last&&last.update?.kind==='complete'))
      validateMvuSchemaStoryEvent(mvuSchemaStoryEvent(plan,phases,browser))
    return
  }
  if(rawEvent===undefined)fail()
  const event=validateMvuSchemaStoryEvent(rawEvent as never)
  if(!same(event.plan,plan))fail()
  const settlement=mvuSchemaStorySettlement(event)
  if(rawSettlement!==undefined&&!same(validateMvuSchemaStorySettlement(rawSettlement as never,event),settlement))fail()
  if(embedded!==undefined&&!same(validateMvuSchemaStorySettlement(embedded as never,event),settlement))fail()
  // A later legal closure does not change what was completed at this Native
  // selector. Never compare its additional phases to this earlier tail.
  if(event.frontier.nativeCut>selectedCut)return
  // A partial accepted prefix is not a final event. Existing descriptors may
  // be absent, but a settlement/ACK cannot float without its actual event.
  const expected=validateMvuSchemaStoryEvent(mvuSchemaStoryEvent(plan,phases,browser,event.ordinaryScopes))
  if(!same(event,expected))fail()
  if(embedded!==undefined) {
    if(rawSettlement===undefined)fail()
  }
}
function playerPublication(candidate:Extract<Candidate,{kind:'player'}>,phases:readonly MvuSchemaPlayerPhaseFact[],
  deps:MvuSchemaUnpublishedTailDeps,selectedCut:number):void {
  const plan=candidate.plan,sid=plan.operation.sessionId,opid=plan.operation.operationId
  const eventId=recordSha256({encoding:'native-mvu-schema-player-event-identity-v1',planSha256:plan.planSha256})
  const rawEvent=deps.status.get(mvuSchemaPlayerEventKey(sid,eventId))
  const rawSettlement=deps.status.get(mvuSchemaPlayerSettlementKey(sid,plan.planSha256))
  const rawCompletion=deps.branch.get(mvuSchemaPlayerCompletionKey(sid,opid))
  if(rawEvent===undefined&&rawSettlement===undefined&&rawCompletion===undefined)return
  if(rawEvent===undefined)fail()
  const event=validateMvuSchemaPlayerEvent(rawEvent as never)
  if(!same(event.plan,plan))fail()
  const settlement=mvuSchemaPlayerSettlement(event)
  if(rawSettlement!==undefined&&!same(validateMvuSchemaPlayerSettlement(rawSettlement as never,event),settlement))fail()
  if(rawCompletion!==undefined) {
    if(rawSettlement===undefined)fail()
    validateMvuSchemaPlayerCompletion(rawCompletion as never,plan,settlement)
  }
  if(event.frontier.nativeCut>selectedCut)return
  const expected=validateMvuSchemaPlayerEvent(mvuSchemaPlayerEvent(plan,phases))
  if(!same(event,expected))fail()
}

/** The journal already joined these entries and their immutable Browser pairs.
 * Consume that order directly, retaining the published numerical basis. */
function verifyDynamicStoryTail(request:MvuSchemaUnpublishedTailRequest,deps:MvuSchemaUnpublishedTailDeps,
  candidate:Extract<Candidate,{kind:'story'|'start'}>,facts?:MvuSchemaUnpublishedStoryPlanFacts) {
  const {plan}=candidate,entries=request.ready.entries??request.ready.steps,
    first=request.ready.steps.at(request.ordinal)!,phases:MvuSchemaStoryPhaseFact[]=[],hooks:MvuSchemaStoryBrowserHookFact[]=[]
  let low=0,high=entries.length
  while(low<high){const middle=(low+high)>>>1
    if(entries.at(middle)!.dispatchMarker.seq<first.dispatchMarker.seq)low=middle+1;else high=middle}
  let nextCut=plan.initialCut.nativeCut,resumeHook:MvuSchemaStoryBrowserHookFact|undefined,
    finalizedMessage=plan.canonical.narrative,yieldOrdinal=0
  const browser=():MvuSchemaStoryBrowserExecutionV1|undefined=>hooks.length
    ?{schemaVersion:1,hooks,finalizedMessage}:undefined
  for(let entryIndex=low;entryIndex<entries.length;entryIndex++){
    const entry=entries.at(entryIndex)!
    if(entry.dispatchMarker.seq<nextCut)fail()
    if(isSchemaBrowserFacts(entry)){
      const requestData=entry.dispatch.request,result=entry.completion.result,previous=phases.at(-1)?.output
      if(!previous||previous.kind!=='accepted'||!('update' in previous)||!previous.update
        ||requestData.planSha256!==mvuSchemaStoryExecutionId(plan)||requestData.sessionId!==request.sessionId
        ||requestData.stage!==result.stage||resumeHook
        ||!same(requestData.target,{kind:'message',ownerSessionId:plan.base.sessionId,nativeSeq:plan.canonical.seq,
          messageId:plan.canonical.messageId,messageVersionSha256:plan.canonical.versionSha256}))fail()
      const {readVariables:_readVariables,...payload}=requestData.payload
      if(previous.update.kind==='yield'){
        if(requestData.stage!==previous.update.stage||requestData.yieldOrdinal!==previous.update.yieldOrdinal
          ||!same(payload,{graph:previous.update.graph})||!('graph' in result.output)||!result.output.graph)fail()
      }else if(previous.update.kind==='complete'){
        if(requestData.stage!=='before-message-update'||requestData.yieldOrdinal!==undefined
          ||!same(payload,{context:{variables:mvuSchemaStoryVariables(previous.values,previous.context),
            message_content:plan.canonical.narrative}})||result.stage!=='before-message-update')fail()
        finalizedMessage=result.output.context.message_content
      }else fail()
      // The existing journal join already proved each incremental Native prefix.
      proveCut(request,entry.dispatch.sourceNativeCut,plan.initialCut,plan.currentFrame,plan.selectors[0]!,entry.dispatchMarker.seq)
      const frontierSha256=request.ready.entryFrontierAt?.(entryIndex+1)
      if(!frontierSha256)fail()
      const hook:MvuSchemaStoryBrowserHookFact={schemaVersion:1,request:requestData,result,journal:entry,
        frontier:{nativeCut:entry.completionMarker.seq+1,tailSha256:entry.dispatch.previousTailSha256,frontierSha256}}
      hooks.push(hook);resumeHook=hook
    }else{
      const index=phases.length,prior=phases.at(-1)?.output
      if(prior&&(prior.kind==='refused'||!('update' in prior)||!prior.update||prior.update.kind==='complete'))fail()
      const association=provePair(request,deps,candidate,index,entry),actual=entry.step.frame.input
      if(actual.encoding!=='native-mvu-author-schema-phase-input-v4-scope-ref-v2'||!actual.update)fail()
      deps.verifyScopeRef(actual.scopeReadRef,plan.currentFrame,entry.dispatch.sourceNativeCut)
      const input=mvuSchemaStoryPhaseInput(plan,index,phases,undefined,actual.scopeReadRef,undefined,
        actual.update.interests,resumeHook,
        actual.update.encoding==='native-mvu-196-update-start-v1'?actual.update.macros:undefined)
      if(!same(input,actual))fail()
      phases.push({phase:'update-core',input,association,output:entry.step.output});resumeHook=undefined
      const output=entry.step.output
      if(output.kind==='accepted'){
        if(!('update' in output)||!output.update||output.update.updateId!==mvuSchemaStoryExecutionId(plan))fail()
        if(output.update.kind!=='complete'&&output.update.yieldOrdinal!==yieldOrdinal++)fail()
        if(output.update.kind==='native-commands-ready'&&candidate.kind==='story') {
          const basis=candidate.plan.maintenance?.basis
          if(!basis||!same(basis.prepared.phase,association)
            ||basis.candidateKind!==(output.update.commands.length?'parsed':'no-update'))fail()
        }
      }
    }
    nextCut=entry.completionMarker.seq+1
  }
  if(phases.length!==request.ready.steps.length-request.ordinal)fail()
  if(candidate.kind==='story')storyPublication(candidate,facts!,phases,deps,request.events.length,browser())
  return {candidate,execution:{phases,hooks,finalizedMessage}}
}

export function verifyMvuSchemaUnpublishedTail(request:MvuSchemaUnpublishedTailRequest,
  deps:MvuSchemaUnpublishedTailDeps):ReturnType<typeof verifyDynamicStoryTail>|undefined {
  try {
    const {sessionId:sid,events,ready,ordinal,original}=request
    if(!integer(ordinal)||ordinal>ready.steps.length)fail()
    const snapshot=validateMvuSchemaNumericalSnapshot(request.snapshot)
    if(snapshot.sessionId!==sid)fail()
    if(ordinal===ready.steps.length)return
    const first=ready.steps.at(ordinal)!,candidates=candidatePlans(request,deps,first)
    if(candidates.length!==1)fail()
    const candidate=candidates[0]!,plan=candidate.plan,base=baseOf(candidate),version=plan.executorVersion,
      execution=schemaEpochExecution(ready.epoch)
    const authorIdentity=schemaEpochAuthorIdentity(ready.epoch)
    const {stateSnapshotSha256:_old,...basis}=snapshot
    const comparable=validateMvuSchemaNumericalSnapshot(sealMvuSchemaStoryFact(
      {...basis,sourceSha256:base.sourceSha256},'stateSnapshotSha256'))
    if(!same(base,comparable)||plan.initialCut.nativeCut!==first.dispatchMarker.seq
      ||plan.realmEpoch!==original.realmEpoch||plan.programSha256!==schemaOriginalProgramSha256(original)
      ||plan.realmEpoch!==ready.epoch.realmEpoch||plan.programSha256!==authorIdentity.programSha256
      ||ready.epoch.schemaVersion!==5||execution.program.compiler.version!==version
      ||execution.program.bridge.version!==version||execution.runner.version!==version
      ||!deps.verifyFrozenFrame(original,plan.currentFrame))fail()
    if(!same(plan.epoch,ready.epochRef)
      ||plan.serverProgramSha256!==execution.program.programSha256
      ||plan.serverProgramSha256!==original.serverProgramSha256
      ||!same(original.preparation.host,ready.epoch.host))fail()
    proveCut(request,plan.initialCut,plan.initialCut,plan.currentFrame,plan.selectors[0]!,first.dispatchMarker.seq)
    const factDeps={branch:deps.branch,status:deps.status,editProtocol:deps.editProtocol,
        readProjectedCanonical:(prefix:readonly import('./roleplay-mvu-prefix-facts.js').MvuInheritedPrefixEvent[],turn:number)=>{
          const surface=deps.projectPrefix(prefix as never)
          const body=canonicalAssistantForTurn({id:sid,events:prefix as never,surface:{nodes:surface.nodes},
            deriveEventMessage:entry=>surface.projectedMessageAt(entry.seq)},turn)
          const message=body?.data?.message
          return body&&message&&typeof message.id==='string'?{seq:body.seq,messageId:message.id,
            versionSha256:recordSha256(message),narrative:textOf(message.content)}:undefined
        }}
    let storyFacts:MvuSchemaUnpublishedStoryPlanFacts|undefined
    if(candidate.kind==='story') {
      storyFacts=readMvuSchemaUnpublishedStoryPlanFacts({ownerSessionId:sid,
        ownerInheritedEventCount:request.inheritedEventCount,events,plan:candidate.plan},factDeps)
    }else if(candidate.kind==='start') {
      readMvuSchemaStoryStartFacts(candidate.plan,{ownerSessionId:sid,
        ownerInheritedEventCount:request.inheritedEventCount,events},factDeps)
    }else {
      const facts=readMvuSchemaPlayerPlanFacts(deps.branch,deps.status,candidate.plan.operation,events)
      if(!same(facts.plan,candidate.plan)||facts.marker.seq<request.inheritedEventCount)fail()
    }
    if(candidate.kind!=='player'){
      return verifyDynamicStoryTail(request,deps,candidate,storyFacts)
    }
    const remaining=ready.steps.length-ordinal
    if(remaining>plan.selectors.length)fail()
    const playerPhases:MvuSchemaPlayerPhaseFact[]=[]
    let terminated=false
    for(let index=0;index<remaining;index++) {
      const step=ready.steps.at(ordinal+index)!
      if(terminated)fail()
      const association=provePair(request,deps,candidate,index,step)
      const requested=step.step.frame.input
      const reference=requested.scopeReadRef
      if(reference)deps.verifyScopeRef(reference,plan.currentFrame,step.dispatch.sourceNativeCut)
      const input=mvuSchemaPlayerPhaseInput(candidate.plan,index,playerPhases,undefined,reference)
      if(!same(input,step.step.frame.input))fail()
      const phase:MvuSchemaPlayerPhaseFact={phase:mvuSchemaPlayerPhases(candidate.plan.operation.request)[index]!,input,
        association,output:step.step.output}
      playerPhases.push(phase)
      terminated=phase.output.kind==='refused'
    }
    playerPublication(candidate,playerPhases,deps,events.length)
    // Success deliberately returns no snapshot, head, scopes or writable
    // evidence. The caller retains the previously published numerical state.
  }catch {return fail()}
}
