/** Owns a single schema story transaction. Root supplies the actual closing
 * lease and execution owner; no Agent, model or maintenance dispatch lives here. */
import {recordSha256} from './roleplay-data.js'
import {mvuStateCurrentHeadKey} from './roleplay-mvu-state.js'
import {createMvuNumericalPublicationOwner,mvuNumericalPublicationMatches} from './roleplay-mvu-numerical-publication.js'
import {validateSchemaEvaluationInputV4} from './tavern-mvu-schema-runner-v4.js'
import {validateMvuScopeReadFrameV1} from './tavern-mvu-scope-read.js'
import {validateMvuScopeReadRefV2} from './tavern-mvu-scope-view-v2.js'
import type {MvuScopeReadRefV2} from './tavern-mvu-scope-view-v2.js'
import {schemaScopeReadFactsEqual} from './roleplay-mvu-schema-scope-facts.js'
import {mvuSchemaMaintenanceTaskCandidate} from './roleplay-mvu-schema-maintenance-types.js'
import type {MvuSchemaMaintenanceCandidateSourceV1} from './roleplay-mvu-schema-maintenance-types.js'
import {freezeMvuSchemaStoryData,sealMvuSchemaStoryFact,validateMvuSchemaStoryPlan,parseMvuSchemaStoryCandidateV2,
  validateMvuSchemaNumericalSnapshot,validateMvuSchemaStoryEvent,validateMvuSchemaStorySettlement,
  deriveMvuSchemaStorySelectors,mvuSchemaStoryPhaseInput,mvuSchemaStoryReducerBridge,mvuSchemaStoryEvent,
  mvuSchemaStoryHead,mvuSchemaStorySettlement,mvuSchemaStoryEventKey,mvuSchemaStorySettlementKey,
  MVU_SCHEMA_STORY_PHASES,schemaStoryCode,schemaScopeReadRefFactsEqualV2} from './roleplay-mvu-schema-story-types.js'
import {parseMvuSchemaStoryCandidateData,mvuSchemaStoryCommandInfos,mvuSchemaStoryVariables,mvuSchemaStoryVariableParts,
  mvuSchemaStoryReconcileInput} from './roleplay-mvu-schema-story-types.js'
import type {AuthorNativeMvuHookRequest} from './author-native-mvu-hook-types.js'
import type {MvuSchemaStoryBrowserExecutionV1,MvuSchemaStoryBrowserHookFact} from './roleplay-mvu-schema-story-types.js'
import type {InputCompletionScope} from './roleplay-input-completion.js'
import type {SchemaStorySourceFrame} from './roleplay-mvu-schema-source.js'
import type {SourceNativeCutFacts} from './roleplay-mvu-schema-replay.js'
import type {SchemaJournalRef} from './roleplay-mvu-schema-journal.js'
import type {MvuSchemaStoryDeps,MvuSchemaStoryCanonical,MvuSchemaNumericalSnapshotV2,MvuSchemaStoryPlan,
  MvuSchemaStoryPlanV5,MvuSchemaStoryPlanV6,MvuSchemaStoryPlanV10,MvuSchemaStoryPlanV12,
  MvuSchemaStoryPhaseFact,MvuSchemaStoryReducerBridge,MvuSchemaStoryLive,MvuSchemaStoryPublication,
  MvuSchemaStoryPublicationBoundary,MvuSchemaStoryEventV2,MvuSchemaStorySettlementV2}
  from './roleplay-mvu-schema-story-types.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {MvuSchemaPhaseErrorPolicyV4} from './tavern-mvu-schema-types-v4.js'

export type {MvuSchemaStoryDeps,MvuSchemaStoryPlan,
  MvuSchemaStoryPlanV5,MvuSchemaStoryPlanV6,MvuSchemaStoryPlanV10,MvuSchemaStoryPlanV12,
  MvuSchemaNumericalSnapshotV2,MvuSchemaStorySettlementV2}
  from './roleplay-mvu-schema-story-types.js'
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const codeOf=(error:unknown)=>schemaStoryCode(error instanceof Error?error.message:undefined)
function fail(code:string):never {throw Error(code)}

export function createRoleplayMvuSchemaStory(deps:MvuSchemaStoryDeps) {
  const publicationOwner=createMvuNumericalPublicationOwner(deps.table)
  // A partial attempt is never retried in this owner. Remounts are gated by
  // Root's exact pending terminal ledger and journal, not this process-local set.
  const attempted=new Set<string>()
  function makePlan(scope:InputCompletionScope,canonical:MvuSchemaStoryCanonical,base:MvuSchemaNumericalSnapshotV2,
    currentFrame:SchemaStorySourceFrame,realmEpoch:string,programSha256:string,initialCut:SourceNativeCutFacts,
    clockEpochMs:number,executorVersion:4,scopeReadFrame:undefined,
    hostEpoch:{epoch:SchemaJournalRef;serverProgramSha256:string;errorPolicy?:Exclude<MvuSchemaPhaseErrorPolicyV4,'atomic-refusal'>},
    maintenance:MvuSchemaMaintenanceCandidateSourceV1|undefined,scopeReadRef:MvuScopeReadRefV2):MvuSchemaStoryPlanV12
  function makePlan(scope:InputCompletionScope,canonical:MvuSchemaStoryCanonical,base:MvuSchemaNumericalSnapshotV2,
    currentFrame:SchemaStorySourceFrame,realmEpoch:string,programSha256:string,initialCut:SourceNativeCutFacts,
    clockEpochMs?:number,executorVersion?:4,scopeReadFrame?:MvuScopeReadFrameV1):MvuSchemaStoryPlanV5
  function makePlan(scope:InputCompletionScope,canonical:MvuSchemaStoryCanonical,base:MvuSchemaNumericalSnapshotV2,
    currentFrame:SchemaStorySourceFrame,realmEpoch:string,programSha256:string,initialCut:SourceNativeCutFacts,
    clockEpochMs:number,executorVersion:4,scopeReadFrame:MvuScopeReadFrameV1|undefined,
    hostEpoch:{epoch:SchemaJournalRef;serverProgramSha256:string;errorPolicy?:Exclude<MvuSchemaPhaseErrorPolicyV4,'atomic-refusal'>}|undefined,
    maintenance?:MvuSchemaMaintenanceCandidateSourceV1,scopeReadRef?:MvuScopeReadRefV2):
    MvuSchemaStoryPlanV5|MvuSchemaStoryPlanV6|MvuSchemaStoryPlanV10|MvuSchemaStoryPlanV12
  function makePlan(scope:InputCompletionScope,canonical:MvuSchemaStoryCanonical,base:MvuSchemaNumericalSnapshotV2,
    currentFrame:SchemaStorySourceFrame,realmEpoch:string,programSha256:string,initialCut:SourceNativeCutFacts,
    clockEpochMs=0,executorVersion:4=4,scopeReadFrame?:MvuScopeReadFrameV1,
    hostEpoch?:{epoch:SchemaJournalRef;serverProgramSha256:string;errorPolicy?:Exclude<MvuSchemaPhaseErrorPolicyV4,'atomic-refusal'>},
    maintenance?:MvuSchemaMaintenanceCandidateSourceV1,scopeReadRef?:MvuScopeReadRefV2):
    MvuSchemaStoryPlanV5|MvuSchemaStoryPlanV6|MvuSchemaStoryPlanV10|MvuSchemaStoryPlanV12 {
    const input=freezeMvuSchemaStoryData({scope,canonical,base,currentFrame,realmEpoch,programSha256,initialCut,clockEpochMs})
    scope=input.scope;canonical=input.canonical;base=input.base;currentFrame=input.currentFrame
    realmEpoch=input.realmEpoch;programSha256=input.programSha256;initialCut=input.initialCut;clockEpochMs=input.clockEpochMs
    if(scopeReadRef&&!hostEpoch)fail('SCHEMA_SCOPE_REFERENCE_HOST_REQUIRED')
    if(scopeReadRef&&scopeReadFrame)fail('SCHEMA_SCOPE_REFERENCE_PLAN_CONFLICT')
    if(!scopeReadFrame&&!scopeReadRef)fail('SCHEMA_SCOPE_READ_REQUIRED')
    if(maintenance&&!hostEpoch)fail('SCHEMA_MAINTENANCE_HOST_REQUIRED')
    const suffix={currentFrame,realmEpoch,programSha256,initialCut,clockEpochMs,randomSeed:recordSha256({scope,canonical}),
      selectors:deriveMvuSchemaStorySelectors(scope,canonical,realmEpoch),
      ...parseMvuSchemaStoryCandidateData(canonical.narrative,hostEpoch?'analysis-alias-rfc6902-members-v1':undefined)}
    const body=scopeReadRef?freezeMvuSchemaStoryData({schemaVersion:12 as const,
      encoding:'native-mvu-schema-story-plan-v12-scope-ref-v2' as const,executorVersion,
      scope,canonical,base:validateMvuSchemaNumericalSnapshot(base),epoch:hostEpoch!.epoch,
      serverProgramSha256:hostEpoch!.serverProgramSha256,parserPolicy:'analysis-alias-rfc6902-members-v1' as const,
      ...(hostEpoch!.errorPolicy?{errorPolicy:hostEpoch!.errorPolicy}:{}),
      ...suffix,candidate:maintenance?.kind==='task-result'?mvuSchemaMaintenanceTaskCandidate(maintenance.result):suffix.candidate,
      ...maintenance?{maintenance}:{},scopeReadRef:validateMvuScopeReadRefV2(scopeReadRef)}):
      freezeMvuSchemaStoryData({
        ...(hostEpoch?{...(maintenance?{schemaVersion:10 as const,encoding:'native-mvu-schema-story-plan-v10' as const,
          maintenance}:{schemaVersion:6 as const,encoding:'native-mvu-schema-story-plan-v6' as const}),
          epoch:hostEpoch.epoch,serverProgramSha256:hostEpoch.serverProgramSha256,
          parserPolicy:'analysis-alias-rfc6902-members-v1' as const,
          ...(hostEpoch.errorPolicy?{errorPolicy:hostEpoch.errorPolicy}:{})}:
          {schemaVersion:5 as const,encoding:'native-mvu-schema-story-plan-v5' as const}),
        executorVersion,scope,canonical,base:validateMvuSchemaNumericalSnapshot(base),
        scopeReadFrame:validateMvuScopeReadFrameV1(scopeReadFrame),...suffix,
        candidate:maintenance?.kind==='task-result'?mvuSchemaMaintenanceTaskCandidate(maintenance.result):suffix.candidate})
    return validateMvuSchemaStoryPlan(sealMvuSchemaStoryFact(body,'planSha256'))
  }
  function read(key:string):unknown {
    const value=deps.table.get(key)
    return value===undefined?undefined:freezeMvuSchemaStoryData(value)
  }
  /** Immutable event/settlement rows accept absence or the exact fact. The
   * shared numerical publication owner retains the complete mutable row CAS. */
  async function putExact(key:string,next:unknown,prior?:unknown):Promise<void> {
    const value=freezeMvuSchemaStoryData(next),actual=read(key)
    if(!same(actual,prior)&&!same(actual,value))fail('SCHEMA_STORY_IDENTITY_CONFLICT')
    if(!same(actual,value))try {await deps.table.put(key,value)}catch { /* A lost ACK can only be resolved by exact readback. */ }
    if(!same(read(key),value))fail('SCHEMA_STORY_WRITE_UNKNOWN')
  }
  function checkClosing(closing:object,scope:InputCompletionScope,plan:MvuSchemaStoryPlan) {
    if(!deps.closingCurrent(closing,scope,plan))fail('SCHEMA_STORY_PERMISSION_REVOKED')
  }
  function checkBase(scope:InputCompletionScope,plan:MvuSchemaStoryPlan) {
    const ready=deps.readReady(scope,plan)
    if(ready.kind!=='ready')fail(schemaStoryCode(ready.code))
    if(!same(validateMvuSchemaNumericalSnapshot(ready.snapshot),plan.base))fail('SCHEMA_STORY_BASE_CHANGED')
  }
  function storedFacts(plan:MvuSchemaStoryPlan,settlement:unknown):
    {event:MvuSchemaStoryEventV2;settlement:MvuSchemaStorySettlementV2}|undefined {
    try {
      const supplied=freezeMvuSchemaStoryData(settlement) as MvuSchemaStorySettlementV2
      const expectedEventId=recordSha256({encoding:'native-mvu-schema-story-event-identity-v2',planSha256:plan.planSha256})
      if(supplied.event.key!==mvuSchemaStoryEventKey(plan.base.sessionId,expectedEventId))return
      const event=validateMvuSchemaStoryEvent(read(supplied.event.key) as MvuSchemaStoryEventV2)
      const actual=validateMvuSchemaStorySettlement(supplied,event)
      if(!same(event.plan,plan)||!same(read(mvuSchemaStorySettlementKey(plan.base.sessionId,plan.planSha256)),actual))return
      return {event,settlement:actual}
    } catch {return}
  }
  function verifyConsumed(scope:InputCompletionScope,suppliedPlan:MvuSchemaStoryPlan,settlement:unknown):boolean {
    try {
      const plan=validateMvuSchemaStoryPlan(suppliedPlan)
      return same(scope,plan.scope)&&!!storedFacts(plan,settlement)
    } catch {return false}
  }
  function verifySettlement(scope:InputCompletionScope,suppliedPlan:MvuSchemaStoryPlan,settlement:unknown):boolean {
    try {
      const plan=validateMvuSchemaStoryPlan(suppliedPlan),facts=storedFacts(plan,settlement)
      if(!same(scope,plan.scope)||!facts)return false
      const actualHead=publicationOwner.read(plan.base.sessionId).raw
      // An opening-only baseline has no current-head row. Refused/no-update
      // keep that absence; successful updates use the single shared head key.
      return mvuNumericalPublicationMatches(actualHead,facts.settlement.result.head)
    } catch {return false}
  }
  async function publish(scope:InputCompletionScope,suppliedPlan:MvuSchemaStoryPlan,closing:object):Promise<MvuSchemaStoryPublication> {
    let spent=false,plan:MvuSchemaStoryPlan
    try {
      plan=validateMvuSchemaStoryPlan(suppliedPlan)
      if(!same(scope,plan.scope))fail('SCHEMA_STORY_SCOPE_CHANGED')
      checkClosing(closing,scope,plan)
      if(attempted.has(plan.planSha256))fail('SCHEMA_STORY_ALREADY_ATTEMPTED')
      if(read(mvuSchemaStorySettlementKey(plan.base.sessionId,plan.planSha256))!==undefined)fail('SCHEMA_STORY_ALREADY_ATTEMPTED')
      const eventId=recordSha256({encoding:'native-mvu-schema-story-event-identity-v2',planSha256:plan.planSha256})
      if(read(mvuSchemaStoryEventKey(plan.base.sessionId,eventId))!==undefined)fail('SCHEMA_STORY_ALREADY_ATTEMPTED')
      checkBase(scope,plan)
      const publication=publicationOwner.read(plan.base.sessionId)
      if(!mvuNumericalPublicationMatches(publication.raw,plan.base.currentHead))fail('SCHEMA_STORY_BASE_CHANGED')
      if(plan.candidate.kind==='rejected')fail('SCHEMA_STORY_CANDIDATE_REJECTED')
      attempted.add(plan.planSha256)
      const phases:MvuSchemaStoryPhaseFact[]=[]
      const hooks:MvuSchemaStoryBrowserHookFact[]=[]
      let reconcile:MvuSchemaStoryPhaseFact|undefined,finalizedMessage=plan.canonical.narrative
      const browser=():MvuSchemaStoryBrowserExecutionV1|undefined=>hooks.length
        ?{schemaVersion:1,hooks,...reconcile?{reconcile}:{},finalizedMessage}:undefined
      const target={kind:'message' as const,ownerSessionId:plan.base.sessionId,nativeSeq:plan.canonical.seq,
        messageId:plan.canonical.messageId,messageVersionSha256:plan.canonical.versionSha256}
      const hook=async(request:AuthorNativeMvuHookRequest)=>{
        if(!deps.executeHook)return undefined
        checkClosing(closing,scope,plan);checkBase(scope,plan)
        const previousSpent=spent
        spent=true
        const result=await deps.executeHook(plan,request,closing)
        checkClosing(closing,scope,plan);checkBase(scope,plan)
        if(result)hooks.push(result)
        else spent=previousSpent
        return result
      }
      if(deps.executeHook) {
        // Unsupported structured operations are rejected only if a matching
        // COMMAND callback exists; preparation sends no Browser challenge.
        let commands:ReturnType<typeof mvuSchemaStoryCommandInfos>=[]
        try {commands=mvuSchemaStoryCommandInfos(plan)}catch { /* The Core preparation checks matching registrations before rejecting. */ }
        await hook({sessionId:plan.base.sessionId,planSha256:plan.planSha256,target,stage:'command-parsed',
          payload:{variables:mvuSchemaStoryVariables(plan.base.values,plan.base.context),commands,
            message_content:plan.canonical.narrative}})
      }
      let reducer:MvuSchemaStoryReducerBridge|null=null,lastLive:MvuSchemaStoryLive|undefined
      for(const [index,phase] of MVU_SCHEMA_STORY_PHASES.entries()) {
        checkClosing(closing,scope,plan);checkBase(scope,plan)
        if(index===2&&phases[1]?.output.kind==='accepted') {
          const previous=phases[1].output,ended=await hook({sessionId:plan.base.sessionId,planSha256:plan.planSha256,target,
            stage:'update-ended',payload:{variables:mvuSchemaStoryVariables(previous.values,previous.context),
              variables_before_update:mvuSchemaStoryVariables(plan.base.values,plan.base.context)}})
          if(ended?.result.stage==='update-ended'
            &&!same(mvuSchemaStoryVariableParts(ended.result.output.variables).values,previous.values)) {
            if(!deps.executeReconcile)fail('SCHEMA_STORY_RECONCILE_UNAVAILABLE')
            spent=true
            const reconciliation=await deps.executeReconcile(plan,mvuSchemaStoryReconcileInput(plan,phases[1],ended),closing)
            checkClosing(closing,scope,plan)
            if(reconciliation.kind!=='completed')fail('SCHEMA_STORY_RECONCILE_FAILED')
            reconcile=freezeMvuSchemaStoryData({phase:'hook-reconcile',input:reconciliation.capturedInput!,
              association:reconciliation.association,output:reconciliation.output})
            lastLive=reconciliation
            if(reconciliation.output.kind==='refused')break
          }
        }
        const input=mvuSchemaStoryPhaseInput(plan,index,phases,reducer,undefined,undefined,browser())
        // Spending is recorded before await: a cancellation/throw after actual
        // dispatch must keep the original anchor and never become a refusal.
        spent=true
        const result=await deps.executePhase(plan,phase,input,closing)
        checkClosing(closing,scope,plan)
        if(result.kind!=='completed')return {kind:'unknown',code:schemaStoryCode(result.code)}
        if(!result.evidence||typeof result.evidence!=='object')fail('SCHEMA_STORY_EXECUTION_UNPROVEN')
        let capturedInput=input
        if(plan.schemaVersion===12) {
          if(!result.capturedInput)fail('SCHEMA_STORY_EXECUTION_UNPROVEN')
          const actual=validateSchemaEvaluationInputV4(result.capturedInput)
          if(actual.encoding!=='native-mvu-author-schema-phase-input-v4-scope-ref-v2'
            ||!schemaScopeReadRefFactsEqualV2(actual.scopeReadRef,plan.scopeReadRef)
            ||actual.scopeReadRef.sourceNativeCutSha256!==result.association.sourceNativeCutSha256
            ||!same(actual,mvuSchemaStoryPhaseInput(plan,index,phases,reducer,undefined,actual.scopeReadRef,browser()))) {
            fail('SCHEMA_STORY_EXECUTION_UNPROVEN')
          }
          capturedInput=actual
        } else {
          if(!result.capturedInput)fail('SCHEMA_STORY_EXECUTION_UNPROVEN')
          const actual=validateSchemaEvaluationInputV4(result.capturedInput)
          if(actual.encoding!=='native-mvu-author-schema-phase-input-v4')fail('SCHEMA_STORY_EXECUTION_UNPROVEN')
          if(!schemaScopeReadFactsEqual(actual.scopeReadFrame,plan.scopeReadFrame)
            ||actual.scopeReadFrame.sourceNativeCutSha256!==result.association.sourceNativeCutSha256
            ||!same(actual,mvuSchemaStoryPhaseInput(plan,index,phases,reducer,actual.scopeReadFrame,undefined,browser()))) {
            fail('SCHEMA_STORY_EXECUTION_UNPROVEN')
          }
          capturedInput=actual
        }
        // The private evidence is kept only in this invocation. Durable phase
        // facts contain its association/output, never the evidence object.
        lastLive=result
        phases.push(freezeMvuSchemaStoryData({phase,input:capturedInput,association:result.association,output:result.output}))
        if(result.output.kind==='refused')break
        if(index===0) {
          reducer=mvuSchemaStoryReducerBridge(phases[0]!)
          if(reducer.result.kind==='rejected')break
        }
      }
      if(!lastLive)fail('SCHEMA_STORY_EXECUTION_UNPROVEN')
      if(phases.length===3&&lastLive.output.kind==='accepted') {
        const output=lastLive.output,before=await hook({sessionId:plan.base.sessionId,planSha256:plan.planSha256,target,
          stage:'before-message-update',payload:{context:{variables:mvuSchemaStoryVariables(output.values,output.context),
            message_content:plan.canonical.narrative}}})
        if(before?.result.stage==='before-message-update')finalizedMessage=before.result.output.context.message_content
      }
      const event=validateMvuSchemaStoryEvent(mvuSchemaStoryEvent(plan,phases,reducer,browser()))
      const head=mvuSchemaStoryHead(event),settlement=mvuSchemaStorySettlement(event)
      const eventKey=mvuSchemaStoryEventKey(event.sessionId,event.eventId)
      const headKey=mvuStateCurrentHeadKey(event.sessionId)
      const settlementKey=mvuSchemaStorySettlementKey(event.sessionId,plan.planSha256)
      return await deps.withPublicationBoundary(closing,lastLive,async()=>{
        function check(stage:MvuSchemaStoryPublicationBoundary['stage']) {
          checkClosing(closing,scope,plan)
          if(!deps.checkPublication(closing,lastLive!,{plan,event,head,settlement,stage}))fail('SCHEMA_STORY_PUBLICATION_UNPROVEN')
        }
        check('before-event')
        await putExact(eventKey,event)
        check('after-event')
        if(!same(read(eventKey),event))fail('SCHEMA_STORY_WRITE_UNKNOWN')
        if(event.outcome==='accepted') {
          check('before-head')
          const advanced=await publicationOwner.advanceLeaf(publication,head)
          if(advanced.kind==='conflict')fail('SCHEMA_STORY_BASE_CHANGED')
          if(advanced.kind!=='acknowledged')fail('SCHEMA_STORY_WRITE_UNKNOWN')
          check('after-head')
          if(!mvuNumericalPublicationMatches(deps.table.get(headKey),head)||!same(read(eventKey),event))fail('SCHEMA_STORY_WRITE_UNKNOWN')
        }
        check('before-settlement')
        await putExact(settlementKey,settlement)
        check('after-settlement')
        if(!verifySettlement(scope,plan,settlement))fail('SCHEMA_STORY_SETTLEMENT_UNCONFIRMED')
        return {kind:'acknowledged',settlement}
      })
    } catch(error) {
      return {kind:spent?'unknown':'blocked',code:codeOf(error)}
    }
  }
  return {makePlan,publish,verifySettlement,verifyConsumed}
}
