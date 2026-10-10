/** Owns explicit schema replacements in the real Agent maintenance reservation.
 * Durable facts can confirm a completed operation; they never mint this lease. */
import {recordSha256} from './roleplay-data.js'
import {schemaPhaseErrorPolicyForProgramV4} from './tavern-mvu-schema-program-v4.js'
import {mvuStateCurrentHeadKey} from './roleplay-mvu-state.js'
import {createRoleplayMvuSchemaJournal,freezeSchemaJournalData,schemaEpochExecution,isAuthorHostJournalReadyV5,
  schemaJournalServerTailSha256,schemaJournalHostFrontierSha256} from './roleplay-mvu-schema-journal.js'
import {createRoleplayMvuSchemaReplay,schemaExecutionServerTailSha256,schemaExecutionHostFrontierSha256}
  from './roleplay-mvu-schema-replay.js'
import {schemaTraceRequestedStep} from './roleplay-mvu-schema-executor-types.js'
import {schemaOriginalReplayCompilationInput} from './roleplay-mvu-schema-source.js'
import type {ProtectedAuthorHostRuntimeV5} from './roleplay-author-host-assets.js'
import type {AuthorHostIdentityV5} from './roleplay-author-host-types-v5.js'
import type {SchemaReplayDeps} from './roleplay-mvu-schema-replay.js'
import {createRoleplayMvuSchemaPlayer} from './roleplay-mvu-schema-player.js'
import {readMvuSchemaPlayerRequest,makeMvuSchemaPlayerOperation,validateMvuSchemaPlayerOperation,
  verifyMvuSchemaPlayerMarker,mvuSchemaPlayerOperationKey,mvuSchemaPlayerCompletionKey,mvuSchemaPlayerPlanKey,
  mvuSchemaPlayerRefusalKey,mvuSchemaPlayerEventKey,mvuSchemaPlayerSettlementKey,
  makeMvuSchemaPlayerCompletion,
  makeMvuSchemaPlayerRefusal,validateMvuSchemaPlayerRefusal,readMvuSchemaPlayerCompletedFacts,
  MVU_SCHEMA_PLAYER_PHASES}
  from './roleplay-mvu-schema-player-types.js'
import type {MvuSchemaPlayerOperationV1,MvuSchemaPlayerPlanV1,MvuSchemaPlayerPublicationBoundary,
  MvuSchemaPlayerLive,MvuSchemaPlayerEventV1,MvuSchemaPlayerLedger}
  from './roleplay-mvu-schema-player-types.js'
import type {Session} from '@deepseek-ai/dsh-session'
import type {NativeInputAdmissionAgentV2} from '@deepseek-ai/dsh-agent-loop'
import type {mvuPlayerMarkers} from 'dsh-nexttavern-session-format/mvu-player-marker'
import type {mvuSchemaMarkers} from 'dsh-nexttavern-session-format/mvu-schema-marker'
import type {OwnedMvuSchemaExecutor,SchemaExecutorIdentityTuple,SchemaAuthorProgram} from './roleplay-mvu-schema-executor-types.js'
import type {CombinedAuthorProgram} from './tavern-author-combined-types.mjs'
import {schemaScopeReadFactsEqual} from './roleplay-mvu-schema-scope-facts.js'
import type {createRoleplayMvuSchemaStoryCore} from './roleplay-mvu-schema-story-core.js'
import type {createRoleplayMvuSchemaSource} from './roleplay-mvu-schema-source.js'
import type {SchemaOwnedScope,SchemaBoundary,SchemaExecutionAssociation}
  from './roleplay-mvu-schema-replay.js'
import type {MvuPlayerEditRequest,MvuPlayerEditResponse,MvuStateObservation} from './roleplay-mvu-player-types.js'
import type {RoleplayInputStateOwner} from './roleplay-input-state.js'

interface Table {get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>;entries():Iterable<[string,unknown]>}
interface Dependencies {
  inputState:RoleplayInputStateOwner
  branch:Table;status:Table
  story:ReturnType<typeof createRoleplayMvuSchemaStoryCore>
  source:ReturnType<typeof createRoleplayMvuSchemaSource>
  session(sid:string):Session|undefined
  agent(session:Session):NativeInputAdmissionAgentV2|undefined
  active(session:Session):boolean
  sourceSha256(sid:string):string
  protectedRuntime(tuple?:SchemaExecutorIdentityTuple,host?:AuthorHostIdentityV5):Promise<OwnedMvuSchemaExecutor|ProtectedAuthorHostRuntimeV5>
  withSourceLock<T>(sid:string,action:()=>Promise<T>):Promise<T>
  flush(session:Session):Promise<boolean>
  markers:typeof mvuSchemaMarkers
  playerMarkers:typeof mvuPlayerMarkers
  observe(sid:string):Promise<MvuStateObservation>
}
type Basis=ReturnType<Dependencies['story']['captureManualBasis']>
interface Reservation {
  session:Session;agent:NativeInputAdmissionAgentV2;abort:AbortController
  attachmentCurrent?:()=>boolean
  signal?:AbortSignal;inSource:boolean;stopSha256:string
  released:Promise<void>;release():void;owner?:Owner
}
interface Owner {
  reservation:Reservation;basis:Basis;operation:MvuSchemaPlayerOperationV1;plan:MvuSchemaPlayerPlanV1
  token:object;baseline:Map<string,string>;associations:SchemaExecutionAssociation[]
  scope?:SchemaOwnedScope;lastLive?:MvuSchemaPlayerLive;publication?:MvuSchemaPlayerPublicationBoundary
  compiledProgram?:SchemaAuthorProgram|CombinedAuthorProgram
  driver?:ReturnType<typeof createRoleplayMvuSchemaReplay>
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'MVU_PLAYER_WRITE_UNKNOWN'
function fail(code:string):never {throw Error(code)}

export function createRoleplayMvuSchemaPlayerCore(deps:Dependencies) {
  const reservations=new Map<string,Reservation>(),tokens=new WeakMap<object,Owner>()
  const journal=createRoleplayMvuSchemaJournal({table:deps.status as never,markers:deps.markers,
    recordOwner:deps.inputState.schemaJournal})
  let disposed=false
  const drivers=new Map<string,ReturnType<typeof createRoleplayMvuSchemaReplay>>()
  const events=(session:Session)=>session.snapshotEvents()
  const current=(session:Session)=>!disposed&&deps.active(session)&&deps.session(session.id)===session
  const markerFor=(operation:MvuSchemaPlayerOperationV1,session:Session)=>events(session).find(event=>
    event.type===deps.playerMarkers.eventType&&event.data.sessionId===session.id
      &&event.data.operationId===operation.operationId)
  function completed(operation:MvuSchemaPlayerOperationV1,session:Session) {
    return readMvuSchemaPlayerCompletedFacts(deps.branch,deps.status,operation,events(session))
  }
  function pendingCode(sid:string):string|undefined {
    return captureLedger(sid).code
  }
  function captureLedger(sid:string):MvuSchemaPlayerLedger {
    if(!deps.session(sid))return {code:'MVU_PLAYER_SESSION_INACTIVE',completedByEventKey:new Map()}
    try {return deps.inputState.capturePlayerLedger(sid,()=>readPlayerLedger(sid)).data}
    catch {return {code:'SCHEMA_PLAYER_PENDING',completedByEventKey:new Map()}}
  }
  /** Only the persistent ledger validation is retained. Agent status, inbox,
   * stop/completion identities and maintenance reservations remain live checks
   * in busy/ownerCurrent; this DATA cannot recreate a maintenance lease. */
  function readPlayerLedger(sid:string):MvuSchemaPlayerLedger {
    const completedByEventKey=new Map<string,ReturnType<typeof completed>>()
    try {
      const session=deps.session(sid)
      if(!session)return {code:'MVU_PLAYER_SESSION_INACTIVE',completedByEventKey}
      const prefix=`${sid}__mvu-schema-player-`,rows=[...deps.branch.entries()].filter(([key])=>key.startsWith(prefix))
      if(rows.length>4096)return {code:'SCHEMA_PLAYER_HISTORY_UNPROVEN',completedByEventKey}
      const operations=rows.filter(([key])=>key.startsWith(`${prefix}operation-`))
      const publishedKeys=new Set<string>()
      for(const [key,row] of operations) {
        const operation=validateMvuSchemaPlayerOperation(row as MvuSchemaPlayerOperationV1)
        if(key!==mvuSchemaPlayerOperationKey(sid,operation.operationId)||operation.sessionId!==sid)fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
        const refusal=deps.branch.get(mvuSchemaPlayerRefusalKey(sid,operation.operationId))
        if(refusal!==undefined) {
          validateMvuSchemaPlayerRefusal(refusal as never,operation)
          if(markerFor(operation,session)||deps.branch.get(mvuSchemaPlayerCompletionKey(sid,operation.operationId))!==undefined
            ||deps.branch.get(mvuSchemaPlayerPlanKey(sid,operation.operationId))!==undefined) {
            fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
          }
        } else {
          const facts=completed(operation,session)
          const eventKey=mvuSchemaPlayerEventKey(sid,facts.event.eventId)
          publishedKeys.add(eventKey);completedByEventKey.set(eventKey,facts)
          publishedKeys.add(mvuSchemaPlayerSettlementKey(sid,facts.plan.planSha256))
        }
      }
      for(const [key] of rows)if(!operations.some(([,row]:any)=>
        [mvuSchemaPlayerOperationKey(sid,row.operationId),mvuSchemaPlayerCompletionKey(sid,row.operationId),mvuSchemaPlayerPlanKey(sid,row.operationId),
          mvuSchemaPlayerRefusalKey(sid,row.operationId)].includes(key)))fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
      for(const [key] of deps.status.entries())if(key.startsWith(`${sid}__mvu-state-schema-player-`)
        &&!publishedKeys.has(key))fail('SCHEMA_PLAYER_HISTORY_UNPROVEN')
      return {completedByEventKey}
    } catch {return {code:'SCHEMA_PLAYER_PENDING',completedByEventKey:new Map()}}
  }
  function busy(sid:string):string|undefined {
    const session=deps.session(sid)
    if(!session||disposed||deps.session(sid)!==session||!deps.inputState.currentSession(sid))return 'MVU_PLAYER_SESSION_INACTIVE'
    const agent=deps.agent(session)
    if(!agent||agent.session!==session||typeof agent.runMaintenance!=='function')return 'READ_OR_PERMISSION_UNKNOWN'
    if(reservations.has(sid)||agent.status!=='idle'||agent.inbox.nextTurn.length||agent.inbox.nextStep.length) {
      return 'MVU_PLAYER_BUSY'
    }
    const completion=agent.lookupInputCompletion(),stop=agent.lookupInputStop()
    if(!['none','settled'].includes(completion.status)||!['none','acknowledged'].includes(stop.status))return 'MVU_PLAYER_BUSY'
    return pendingCode(sid)
  }
  function stateRows(sid:string) {
    return [...deps.status.entries()].filter(([key])=>key.startsWith(`${sid}__mvu-`)
      &&!key.startsWith(`${sid}__mvu-schema-`))
  }
  function rowsCurrent(owner:Owner):boolean {
    const sid=owner.reservation.session.id
    const proposed=new Map(owner.publication?.confirmedRows.map(row=>[row.key,row.value]))
    const actual=new Map(stateRows(sid))
    // Confirmed rows must remain present with their actual readback identity.
    // Iterating only actual rows would miss deletion of a newly published row.
    for(const [key,value] of proposed)if(actual.get(key)!==value)return false
    for(const [key,hash] of owner.baseline) {
      if(proposed.has(key))continue
      if(recordSha256(actual.get(key))!==hash)return false
    }
    // Rows introduced by another writer revoke the live reservation. Cold
    // ledger reads retain their full integrity checks.
    for(const [key] of actual)if(!owner.baseline.has(key)&&!proposed.has(key))return false
    return true
  }
  function ownerCurrent(owner:Owner):boolean {
    try {
      const reservation=owner.reservation,sid=reservation.session.id
      if(reservations.get(sid)!==reservation||reservation.owner!==owner||!reservation.inSource
        ||reservation.abort.signal.aborted||!reservation.signal||reservation.signal.aborted
        ||!current(reservation.session)||deps.agent(reservation.session)!==reservation.agent
        ||reservation.attachmentCurrent&&!reservation.attachmentCurrent()
        ||recordSha256(reservation.agent.lookupInputStop())!==reservation.stopSha256
        ||deps.sourceSha256(sid)!==owner.operation.base.sourceSha256
        ||!deps.source.frameCurrent(owner.basis.original,owner.basis.frame)||!rowsCurrent(owner)
        ||!same(deps.branch.get(mvuSchemaPlayerOperationKey(sid,owner.operation.operationId)),owner.operation))return false
      const marker=markerFor(owner.operation,reservation.session)
      if(!marker)return false
      verifyMvuSchemaPlayerMarker(owner.operation,marker,events(reservation.session))
      if((owner.plan.schemaVersion===3||owner.plan.schemaVersion===4||owner.plan.schemaVersion===5)&&!schemaScopeReadFactsEqual(owner.plan.scopeReadFrame,
        owner.basis.scopeReadFrame(owner.plan.initialCut)))return false
      if(owner.publication&&events(reservation.session).length!==owner.publication.event.frontier.nativeCut)return false
      return same(owner.plan.marker,{seq:marker.seq,sha256:recordSha256(marker)})
    } catch {return false}
  }
  function checkOwned(scope:SchemaOwnedScope,boundary:SchemaBoundary):boolean {
    try {
      const owner=tokens.get(scope.owner),session=owner?.reservation.session
      if(!owner||!session||!ownerCurrent(owner)||scope.session!==session||scope.incarnation!==owner.reservation.agent
        ||scope.signal.aborted||!owner.scope)return false
      // Current Replay retains these immutable phase facts. Legacy Host
      // factories clone them; admit that descriptor once under this same owner.
      const admitting=scope!==owner.scope
      if(admitting&&(boundary.stage!=='captured'
        ||(scope.requestedStep!==owner.scope.requestedStep&&!same(scope.requestedStep,owner.scope.requestedStep))
        ||!same(scope.sourceNativeCut,owner.scope.sourceNativeCut)))return false
      const actual=events(session),initial=owner.plan.initialCut,cut=scope.sourceNativeCut.nativeCut
      // Replay verifies a newly captured full cut once. The same Native log's
      // frozen prefix stays fixed while its actual marker tail is checked below.
      if(cut!==initial.nativeCut+2*owner.associations.length)return false
      for(const association of owner.associations)for(const ref of [association.dispatchMarker,association.completionMarker]) {
        if(recordSha256(actual[ref.seq])!==ref.sha256)return false
      }
      for(const [index,ref] of [boundary.dispatchMarker,boundary.completionMarker].entries()) {
        if(ref&&(ref.seq!==cut+index||recordSha256(actual[ref.seq])!==ref.sha256))return false
      }
      if(actual.length!==cut+(boundary.completionMarker?2:boundary.dispatchMarker?1:0))return false
      if(admitting)owner.scope=scope
      return true
    } catch {return false}
  }
  async function engine(basis:Basis) {
    const ready=basis.ready,{program,runner}=schemaEpochExecution(ready.epoch)
    const tuple=isAuthorHostJournalReadyV5(ready)?ready.epoch.server.executor:
      {compiler:program.compiler,bridge:program.bridge,libraries:program.libraries,runner}
    const host=isAuthorHostJournalReadyV5(ready)?ready.epoch.host:undefined
    const runtime=await deps.protectedRuntime(tuple,host)
    if(disposed)fail('SCHEMA_RUNTIME_DISPOSED')
    if(host&&(!('host' in runtime)||runtime.executorVersion!==4||!same(runtime.host.identity,host)
      ||runtime.implementationKey!==recordSha256(host)||!same(tuple,{compiler:runtime.compiler.identity,
        bridge:runtime.bridge,libraries:runtime.libraries,runner:runtime.runner.identity,stateLoader:runtime.stateLoader}))) {
      fail('SCHEMA_IMPLEMENTATION_CHANGED')
    }
    let driver=drivers.get(runtime.implementationKey)
    if(!driver) {
      const bindings:Omit<SchemaReplayDeps,'compiler'|'runner'|'executorVersion'|'hostV5'>={table:deps.status as never,
      recordOwner:deps.inputState.schemaJournal,
      markers:deps.markers,captureHistoricalCut:deps.story.captureHistoricalCut,
      borrowHistoricalCut:deps.story.borrowHistoricalCut,flush:deps.flush,
      captureOwned:selector=>{
        const owner=reservations.get(selector.sessionId)?.owner
        if(!owner?.scope||!ownerCurrent(owner)||owner.scope.requestedStep.eventId!==selector.batchId)fail('SCHEMA_OWNER_UNPROVEN')
        return owner.scope
      },checkOwned,withSourceBoundary:(scope,action)=>{
        const owner=tokens.get(scope.owner)
        if(!owner||!ownerCurrent(owner))fail('SCHEMA_PLAYER_PERMISSION_REVOKED')
        // The real maintenance callback already holds the one Source lock.
        return action()
      }}
      driver='host' in runtime?runtime.host.createReplay(bindings):createRoleplayMvuSchemaReplay({...bindings,
        compiler:runtime.compiler,runner:runtime.runner,executorVersion:runtime.executorVersion})
      drivers.set(runtime.implementationKey,driver)
    }
    return driver
  }
  const transaction=createRoleplayMvuSchemaPlayer({table:deps.status,
    readOwnedPlan:(token,supplied)=>{
      const owner=tokens.get(token)
      return owner?.plan===supplied?owner.plan:undefined
    },
    readReady:plan=>{
      const owner=reservations.get(plan.operation.sessionId)?.owner
      return owner&&owner.plan.planSha256===plan.planSha256
        ?{kind:'ready',snapshot:owner.operation.base}:{kind:'blocked',code:'SCHEMA_PLAYER_BASE_CHANGED'}
    },ownerCurrent:(token,plan)=>{
      const owner=tokens.get(token)
      return !!owner&&owner.plan.planSha256===plan.planSha256&&ownerCurrent(owner)
    },executePhase:async(plan,phase,input,token)=>{
      const owner=tokens.get(token)
      if(!owner||!ownerCurrent(owner))return {kind:'blocked',code:'SCHEMA_PLAYER_PERMISSION_REVOKED'}
      const index=MVU_SCHEMA_PLAYER_PHASES.indexOf(phase)
      if(index!==owner.associations.length)fail('SCHEMA_PLAYER_PHASE_ORDER')
      const selector=plan.selectors[index]!,session=owner.reservation.session,actual=events(session)
      const cut=freezeSchemaJournalData({...plan.initialCut,nativeCut:actual.length,
        nativePrefixSha256:recordSha256(actual),anchor:selector.anchor})
      const captureJournal=()=>owner.basis.inheritedReady
        ?journal.captureChecked(session.id,plan.realmEpoch,events(session),owner.basis.inheritedReady)
        :journal.capture(session.id,plan.realmEpoch,events(session),owner.basis.inheritedCut)
      const ready=captureJournal()
      if(ready.kind!=='ready')fail(ready.code)
      const executorVersion=isAuthorHostJournalReadyV5(ready)?4:ready.epoch.schemaVersion
      if(executorVersion!==(plan.schemaVersion===1?1:plan.executorVersion))fail('SCHEMA_EXECUTOR_VERSION_MISMATCH')
      let capturedInput=input
      if(input.schemaVersion===3||input.schemaVersion===4) {
        if((plan.schemaVersion!==3&&plan.schemaVersion!==4&&plan.schemaVersion!==5)
          ||plan.executorVersion!==input.schemaVersion)fail('SCHEMA_SCOPE_BASIS_UNPROVEN')
        const expected=owner.basis.scopeReadFrame(cut)
        if(!schemaScopeReadFactsEqual(expected,plan.scopeReadFrame))fail('SCHEMA_SCOPE_BASIS_UNPROVEN')
        capturedInput=Object.freeze({...input,scopeReadFrame:freezeSchemaJournalData(expected)})
      }
      // Source/Journal already own the large immutable material and Original.
      // Capture only this phase's new input and wrappers before compiler awaits.
      const requestedStep=schemaTraceRequestedStep(selector.batchId,
        {ownerSessionId:session.id,sourceNativeCutSha256:recordSha256(cut),material:owner.basis.frame.material},capturedInput)
      Object.freeze(requestedStep.frame)
      Object.freeze(requestedStep)
      owner.scope={owner:owner.token,incarnation:owner.reservation.agent,session,
        signal:AbortSignal.any([owner.reservation.signal!,owner.reservation.abort.signal]),
        authorInput:schemaOriginalReplayCompilationInput(owner.basis.original),realmEpoch:plan.realmEpoch,
        loadFrame:schemaEpochExecution(ready.epoch).loadFrame,
        inheritedCut:owner.basis.inheritedCut,sourceNativeCut:cut,requestedStep,journalCut:ready,compiledProgram:owner.compiledProgram,
        ...owner.basis.original.schemaVersion===5&&owner.basis.original.preparation.compilation.schemaVersion===6&&!owner.compiledProgram
          ?{compilationResources:deps.source.captureOriginalCompilationResources(owner.basis.original)}:{}}
      if(owner.basis.inheritedReady)Object.defineProperty(owner.scope,'inheritedReady',{value:owner.basis.inheritedReady})
      Object.defineProperty(owner.scope,'captureJournal',{value:captureJournal})
      const replay=await engine(owner.basis)
      owner.driver=replay
      const result=await replay.execute(selector)
      if(result.kind==='completed') {
        owner.compiledProgram=result.compiledProgram
        if(input.schemaVersion===3||input.schemaVersion===4)result.capturedInput=capturedInput
        owner.lastLive=result;owner.associations.push(result.association)
      }
      return result
    },withPublicationBoundary:async(token,lastLive,action)=>{
      const owner=tokens.get(token)
      if(!owner||owner.lastLive!==lastLive||!ownerCurrent(owner))fail('SCHEMA_OWNER_UNPROVEN')
      // A live manual VM may park between durable phases. Its original
      // cleanup and actual Worker termination precede every player write.
      await owner.driver?.closeOwner?.(owner.token)
      if(!ownerCurrent(owner))fail('SCHEMA_PLAYER_PERMISSION_REVOKED')
      return action()
    },checkPublication:(token,lastLive,boundary)=>{
      const owner=tokens.get(token)
      // The transaction consumes this private owner's constructed frozen plan.
      // Its SHA identifies DATA; the reservation and execution evidence grant use.
      if(!owner||owner.lastLive!==lastLive||owner.plan.planSha256!==boundary.plan.planSha256)return false
      const admitted=owner.publication
      if(admitted) {
        // Publishing player rows does not change the completed schema journal.
        // Across each write await only the live owner and actual rows can change.
        if(admitted.plan!==boundary.plan||admitted.event!==boundary.event
          ||admitted.head!==boundary.head||admitted.settlement!==boundary.settlement)return false
        owner.publication=boundary
        return ownerCurrent(owner)
      }
      owner.publication=boundary
      if(!ownerCurrent(owner)||!same(boundary.event.phases.map(phase=>phase.association),owner.associations))return false
      const ready=owner.basis.inheritedReady
        ?journal.captureChecked(owner.reservation.session.id,boundary.plan.realmEpoch,
          events(owner.reservation.session),owner.basis.inheritedReady)
        :journal.capture(owner.reservation.session.id,boundary.plan.realmEpoch,
          events(owner.reservation.session),owner.basis.inheritedCut)
      if(ready.kind!=='ready'||!same(boundary.event.frontier,{nativeCut:ready.steps.at(-1)!.completionMarker.seq+1,
        tailSha256:schemaJournalServerTailSha256(ready),frontierSha256:schemaJournalHostFrontierSha256(ready)}))return false
      for(const [index,phase] of boundary.event.phases.entries()) {
        const step=ready.steps.at(index-boundary.event.phases.length)
        if(!step||!same(step.step.output,phase.output)||!same(step.step.frame.input,phase.input)
          ||!same(step.dispatchRef,phase.association.dispatch)||!same(step.completionRef,phase.association.completion))return false
      }
      owner.associations.pop()
      try {return !!owner.driver?.checkEvidence(lastLive.evidence,{association:lastLive.association,output:lastLive.output})}
      finally {owner.associations.push(lastLive.association)}
    }})
  async function putExact(key:string,value:unknown) {
    const old=deps.branch.get(key)
    if(old!==undefined&&!same(old,value))fail('SCHEMA_PLAYER_OPERATION_CONFLICT')
    if(old===undefined)try {await deps.branch.put(key,value)}catch { /* Resolve a lost ACK only through exact readback. */ }
    if(!same(deps.branch.get(key),value))fail('MVU_PLAYER_WRITE_UNKNOWN')
  }
  async function response(request:MvuPlayerEditRequest,outcome:'updated'|'no-update'|'refused'|'unknown',
    replayed:boolean,code?:string,event?:MvuSchemaPlayerEventV1):Promise<MvuPlayerEditResponse> {
    const last=event?.phases.at(-1)?.output
    const refusalCode=last?.kind==='refused'?last.diagnostics[0]?.code:event?.commandRefusal?.code
      ??(event?.reducer?.result.kind==='rejected'?event.reducer.result.code:undefined)
    return {ok:!code,numericalState:await deps.observe(request.sessionId),operation:{operationId:request.operationId,
      payloadSha256:recordSha256(request),outcome,replayed,...(refusalCode?{refusalCode}:{})},...(code?{code,error:code}:{})}
  }
  const outcomeFor=(event:MvuSchemaPlayerEventV1)=>event.outcome==='accepted'?'updated' as const:event.outcome
  async function confirmStored(request:MvuPlayerEditRequest,session:Session,old:unknown):Promise<MvuPlayerEditResponse> {
    const sid=request.sessionId,operation=validateMvuSchemaPlayerOperation(old as MvuSchemaPlayerOperationV1)
    if(!same(operation.request,request))return response(request,'unknown',false,'MVU_PLAYER_OPERATION_CONFLICT')
    const refusal=deps.branch.get(mvuSchemaPlayerRefusalKey(sid,request.operationId))
    if(refusal!==undefined) {
      const fact=validateMvuSchemaPlayerRefusal(refusal as never,operation)
      if(markerFor(operation,session))fail('SCHEMA_PLAYER_PENDING')
      return response(request,'refused',true,fact.code)
    }
    // Confirmation reads the exact completed facts. It cannot resume phases,
    // write a reservation or repair a missing head after a cold start.
    const facts=completed(operation,session)
    await deps.story.preflight(sid)
    return response(request,outcomeFor(facts.event),true,undefined,facts.event)
  }
  async function confirm(input:unknown):Promise<MvuPlayerEditResponse> {
    let request:MvuPlayerEditRequest
    try {request=readMvuSchemaPlayerRequest(input)}catch(error) {
      const original=codeOf(error),code=original==='SCHEMA_PLAYER_RECORD_INVALID'?'MVU_PLAYER_DATA_INVALID':original
      return {ok:false,code,error:code}
    }
    const sid=request.sessionId,session=deps.session(sid),old=deps.branch.get(mvuSchemaPlayerOperationKey(sid,request.operationId))
    if(!session||!current(session))return response(request,'unknown',false,'MVU_PLAYER_SESSION_INACTIVE')
    if(old===undefined)return response(request,'unknown',false,'SCHEMA_PLAYER_PENDING')
    try {return await confirmStored(request,session,old)}catch(error) {
      const code=old&&markerFor(old as MvuSchemaPlayerOperationV1,session)?'MVU_PLAYER_WRITE_UNKNOWN':codeOf(error)
      return response(request,'unknown',true,code)
    }
  }
  async function submit(input:unknown,attachmentCurrent?:()=>boolean):Promise<MvuPlayerEditResponse> {
    let request:MvuPlayerEditRequest
    try {request=readMvuSchemaPlayerRequest(input)}catch(error){
      const original=codeOf(error),code=original==='SCHEMA_PLAYER_RECORD_INVALID'?'MVU_PLAYER_DATA_INVALID':original
      return {ok:false,code,error:code}
    }
    const sid=request.sessionId,session=deps.session(sid),opKey=mvuSchemaPlayerOperationKey(sid,request.operationId)
    if(!session||!current(session))return response(request,'unknown',false,'MVU_PLAYER_SESSION_INACTIVE')
    const old=deps.branch.get(opKey)
    let refusedBeforeAdmission=false
    try {
      if(old!==undefined) {
        return await confirmStored(request,session,old)
      }
      const block=busy(sid)
      if(block)return response(request,block==='MVU_PLAYER_BUSY'?'refused':'unknown',false,block)
      await deps.story.preflight(sid)
      // Read-only verification can await the worker. Recheck before the
      // synchronous reservation so two HTTP callers cannot replace a lease.
      const afterPreflight=busy(sid)
      if(afterPreflight)return response(request,afterPreflight==='MVU_PLAYER_BUSY'?'refused':'unknown',false,afterPreflight)
      if(attachmentCurrent&&!attachmentCurrent())return response(request,'refused',false,'SCHEMA_PLAYER_PERMISSION_REVOKED')
      const agent=deps.agent(session)!,done=Promise.withResolvers<void>()
      const reservation:Reservation={session,agent,abort:new AbortController(),inSource:false,
        stopSha256:recordSha256(agent.lookupInputStop()),attachmentCurrent,released:done.promise,release:()=>done.resolve()}
      reservations.set(sid,reservation)
      let operation:MvuSchemaPlayerOperationV1|undefined
      let completedEvent:MvuSchemaPlayerEventV1
      try {
        const result=await agent.runMaintenance(async signal=>{
          reservation.signal=signal
          return deps.withSourceLock(sid,async()=>{
            reservation.inSource=true
            try {
              signal.throwIfAborted()
              if(!current(session)||deps.agent(session)!==agent||reservation.abort.signal.aborted)fail('SCHEMA_PLAYER_PERMISSION_REVOKED')
              if(reservation.attachmentCurrent&&!reservation.attachmentCurrent()) {
                refusedBeforeAdmission=true
                fail('SCHEMA_PLAYER_PERMISSION_REVOKED')
              }
              const basis=deps.story.captureManualBasis(sid)
              const expected=request.expected,base=basis.base
              if(expected.sourceSha256!==base.sourceSha256||!same(expected.root,base.root)
                ||expected.revision!==base.revision||expected.headSha256!==base.headSha256
                ||expected.valuesSha256!==base.valuesSha256||expected.stateSnapshotSha256!==base.stateSnapshotSha256) {
                refusedBeforeAdmission=true
                fail('MVU_PLAYER_STALE_BASE')
              }
              operation=makeMvuSchemaPlayerOperation(request,basis.base)
              if(events(session).at(-1)?.seq!==request.expected.observedNativeSeq) {
                refusedBeforeAdmission=true
                fail('MVU_PLAYER_STALE_NATIVE')
              }
              await putExact(opKey,operation)
              signal.throwIfAborted()
              if(deps.sourceSha256(sid)!==operation.base.sourceSha256)fail('SOURCE_CHANGED')
              if(reservation.attachmentCurrent&&!reservation.attachmentCurrent())fail('SCHEMA_PLAYER_PERMISSION_REVOKED')
              const marker=deps.playerMarkers.append(session,{schemaVersion:1,encoding:'native-mvu-player-edit-marker-v1',
                sessionId:sid,operationId:request.operationId,requestSha256:operation.requestSha256,
                operationSha256:operation.operationSha256,sourceSha256:operation.base.sourceSha256,
                rootSha256:recordSha256(operation.base.root),baseSnapshotSha256:operation.base.stateSnapshotSha256,
                replacementValuesSha256:recordSha256(request.values),observedNativeSeq:request.expected.observedNativeSeq})
              if(!await deps.flush(session))fail('MVU_PLAYER_WRITE_UNKNOWN')
              signal.throwIfAborted()
              const actual=events(session),frame=basis.frame,initialCut={schemaVersion:1 as const,sessionId:sid,
                ownerSessionId:sid,nativeCut:actual.length,nativePrefixSha256:recordSha256(actual),
                sourceSnapshotSha256:frame.snapshotSha256,materialSha256:frame.materialSha256,
                stopGeneration:'notice' in agent.lookupInputStop()?(agent.lookupInputStop() as {notice:{stopSequence:number}}).notice.stopSequence:0,
                anchor:{kind:'manual' as const,operationId:request.operationId,requestSha256:operation.requestSha256,
                  observedNativeSeq:request.expected.observedNativeSeq}}
              const ready=basis.ready,executorVersion=isAuthorHostJournalReadyV5(ready)?4:ready.epoch.schemaVersion
              const plan=transaction.makePlan(operation,{seq:marker.seq,sha256:recordSha256(marker)},frame,initialCut,
                marker.time,executorVersion,executorVersion>=3?basis.scopeReadFrame(initialCut):undefined,
                isAuthorHostJournalReadyV5(ready)?{epoch:ready.epochRef,
                  serverProgramSha256:ready.epoch.program.serverProgram!.programSha256,
                  ...(schemaPhaseErrorPolicyForProgramV4(ready.epoch.program.serverProgram!)==='registered-command-policy-v1'
                    ?{errorPolicy:'registered-command-policy-v1' as const}:{})}:undefined)
              await putExact(mvuSchemaPlayerPlanKey(sid,operation.operationId),plan)
              const owner:Owner={reservation,basis,operation,plan,token:Object.freeze({}),
                baseline:new Map(stateRows(sid).map(([key,row])=>[key,recordSha256(row)])),associations:[]}
              reservation.owner=owner;tokens.set(owner.token,owner)
              const published=await transaction.publish(plan,owner.token)
              if(published.kind!=='acknowledged')fail(published.code)
              if(!ownerCurrent(owner))fail('SCHEMA_PLAYER_PERMISSION_REVOKED')
              const event=owner.publication!.event
              await putExact(mvuSchemaPlayerCompletionKey(sid,operation.operationId),makeMvuSchemaPlayerCompletion(plan,published.settlement))
              if(!ownerCurrent(owner))fail('SCHEMA_PLAYER_PERMISSION_REVOKED')
              // The final live run already proved this complete Guest prefix.
              // Join the newly read durable view before releasing that proof;
              // a cold confirmation still uses Story's historical preflight.
              deps.story.adoptPublishedPlayer(sid,ready=>{
                const last=owner.lastLive
                if(!last||ready.frozen.sessionId!==sid||ready.epoch.realmEpoch!==plan.realmEpoch
                  ||!same(ready.epochRef,owner.basis.ready.epochRef)
                  ||ready.frozen.nativeCut!==events(session).length
                  ||ready.frozen.nativeCut!==last.association.completionMarker.seq+1
                  ||schemaJournalServerTailSha256(ready)!==schemaExecutionServerTailSha256(last.association)
                  ||schemaJournalHostFrontierSha256(ready)!==schemaExecutionHostFrontierSha256(last.association))return false
                // checkOwned expects the preceding phases while it checks the
                // final completion. Restore the full list for later cleanup.
                owner.associations.pop()
                let verified:boolean
                try {verified=!!owner.driver?.checkEvidence(last.evidence,{association:last.association,output:last.output})}
                finally {owner.associations.push(last.association)}
                return verified&&ownerCurrent(owner)
              })
              return {event}
            } catch(error) {
              if(operation&&!markerFor(operation,session)&&same(deps.branch.get(opKey),operation)) {
                try {await putExact(mvuSchemaPlayerRefusalKey(sid,operation.operationId),
                  makeMvuSchemaPlayerRefusal(operation,codeOf(error)))}catch { /* Keep the operation pending if refusal is unconfirmed. */ }
              }
              throw error
            } finally {reservation.inSource=false}
          })
        })
        completedEvent=result.event
      } finally {
        reservation.abort.abort()
        if(reservation.owner)reservation.owner.driver?.invalidateOwner(reservation.owner.token)
        try {await reservation.owner?.driver?.closeOwner?.(reservation.owner.token)}
        finally {
          if(reservations.get(sid)===reservation)reservations.delete(sid)
          reservation.release()
        }
      }
      return response(request,outcomeFor(completedEvent),false,undefined,completedEvent)
    } catch(error){
      const stored=deps.branch.get(opKey) as MvuSchemaPlayerOperationV1|undefined
      const marker=stored&&markerFor(stored,session),code=marker?'MVU_PLAYER_WRITE_UNKNOWN':codeOf(error)
      if(stored===undefined&&refusedBeforeAdmission)return response(request,'refused',false,code)
      if(stored&&!marker) {
        try {
          const operation=validateMvuSchemaPlayerOperation(stored),refusal=deps.branch.get(mvuSchemaPlayerRefusalKey(sid,request.operationId))
          if(same(operation.request,request)&&refusal!==undefined) {
            const fact=validateMvuSchemaPlayerRefusal(refusal as never,operation)
            return response(request,'refused',old!==undefined,fact.code)
          }
        }catch { /* An unproven refusal keeps the operation unknown. */ }
      }
      return response(request,'unknown',old!==undefined,code)
    }
  }
  async function awaitMutationBarrier(session:{id:string},signal:AbortSignal) {
    while(reservations.has(session.id)) {
      signal.throwIfAborted()
      const reservation=reservations.get(session.id)!
      await Promise.race([reservation.released,new Promise<never>((_resolve,reject)=>{
        const abort=()=>reject(signal.reason??Error('SCHEMA_PLAYER_CANCELLED'))
        signal.addEventListener('abort',abort,{once:true})
        reservation.released.finally(()=>signal.removeEventListener('abort',abort))
        if(signal.aborted)abort()
      })])
    }
    signal.throwIfAborted()
  }
  function invalidateSession(sid:string) {
    const reservation=reservations.get(sid)
    reservation?.abort.abort()
    if(reservation?.owner)reservation.owner.driver?.invalidateOwner(reservation.owner.token)
  }
  return {submit,confirm,pendingCode,captureLedger,editBlockCode:busy,awaitMutationBarrier,
    mutationBlockCode:(session:{id:string})=>reservations.has(session.id)?'MVU_PLAYER_BUSY':undefined,
    invalidateSession,invalidateAgent:(agent:object)=>{
      for(const [sid,reservation] of reservations)if(reservation.agent===agent)invalidateSession(sid)
    },dispose:()=>{
      disposed=true
      for(const sid of reservations.keys())invalidateSession(sid)
      for(const driver of drivers.values())driver.dispose()
    }}
}
