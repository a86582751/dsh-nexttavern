/** Root Native acceptance coordinates existing auxiliary material and ordinary
 * contribution owners. Markers are the recovery authority, never a dispatch. */
import {SessionSeq} from 'dsh-nexttavern-native-session'
import type {Session,SessionEvent} from 'dsh-nexttavern-native-session'
import {appendAuthorGenerationEffects,AUTHOR_GENERATION_EFFECTS_EVENT} from 'dsh-nexttavern-session-format'
import type {AuthorGenerationEffectsAcceptedV1,AuthorGenerationEffectsRefV1,
  AuthorGenerationEffectsReceiptV1,AuthorGenerationTerminalV1} from 'dsh-nexttavern-session-format'
import {nativeInputSha256,inspectNativeAuthorGenerationTerminalV1} from 'dsh-nexttavern-native-agent-loop'
import {readAcceptedPreparationPlanRecord} from './community-preset-settlement.js'
import type {createCommunityPresetVariables} from './community-preset-variables.js'
import type {AuthorDialogCheckpointV1,HostSession} from './roleplay-task-host-types.js'
import type {AuthorDialogPromptV1} from './roleplay-author-dialog.js'
import type {StoredTask} from './tavern-task-types.js'
import {recordSha256} from './roleplay-data.js'

export interface AuthorGenerationEffectsDependenciesV1 {
  readonly variables:ReturnType<typeof createCommunityPresetVariables>
  readonly branch:{get(key:string):unknown}
  readonly tasks:Pick<ReturnType<typeof import('./roleplay-task-host.js').createRoleplayTaskHost>,'recordAuthorGenerationEffects'>
  readonly sessions:{get(id:string):Session|undefined;flush(session:Session):Promise<boolean>}
  readonly sessionQuery:{observeSession(id:string,options:{projectionMode:'none';signal?:AbortSignal}):Promise<Disposable&{
    readonly events:readonly SessionEvent[]}>}
  withSourceLock<T>(sid:string,work:()=>Promise<T>,signal:AbortSignal):Promise<T>
  readonly registry:{assertBaseCurrent(sid:string,snapshot:unknown,plan:unknown):void}
}
type EffectsEvent=SessionEvent<typeof AUTHOR_GENERATION_EFFECTS_EVENT>
interface Acceptance {
  readonly event:EffectsEvent&{readonly data:AuthorGenerationEffectsAcceptedV1}
  readonly ref:AuthorGenerationEffectsRefV1
  settledRef?:AuthorGenerationEffectsRefV1
  terminalRef?:AuthorGenerationEffectsRefV1
  inspectedJob?:StoredTask
}
interface RootIndex {
  cursor:number
  needsFlush:boolean
  readonly accepted:Map<string,Acceptance>
  readonly bySeq:Map<number,Acceptance>
  readonly pending:Set<Acceptance>
  readonly unterminated:Set<Acceptance>
}
const operationKey=(identity:AuthorGenerationEffectsAcceptedV1['identity'])=>JSON.stringify([identity.taskId,identity.generation])
const eventRef=(event:SessionEvent):AuthorGenerationEffectsRefV1=>({seq:Number(event.seq),sha256:nativeInputSha256(event)})
function fail(code:string):never {throw Error(code)}

export function createRoleplayAuthorGenerationEffectsV1(deps:AuthorGenerationEffectsDependenciesV1) {
  const indexes=new WeakMap<Session,RootIndex>(),gates=new Map<string,Promise<unknown>>()
  async function gate<T>(sid:string,work:()=>Promise<T>):Promise<T> {
    const previous=gates.get(sid)??Promise.resolve(),next=previous.catch(()=>{}).then(work)
    gates.set(sid,next)
    try{return await next}finally{if(gates.get(sid)===next)gates.delete(sid)}
  }
  function index(session:Session):RootIndex {
    let found=indexes.get(session)
    if(!found){found={cursor:0,needsFlush:false,accepted:new Map(),bySeq:new Map(),pending:new Set(),unterminated:new Set()};indexes.set(session,found)}
    const end=Number(session.seq)
    for(;found.cursor<end;found.cursor++) {
      const event=session.eventAt(SessionSeq(found.cursor))
      if(event?.type!==AUTHOR_GENERATION_EFFECTS_EVENT||event.data.rootSessionId!==session.id)continue
      const marker=event.data
      if(marker.kind==='accepted') {
        const key=operationKey(marker.identity)
        if(found.accepted.has(key))fail('AUTHOR_GENERATION_EFFECTS_ACCEPTANCE_DUPLICATED')
        const accepted:Acceptance={event:event as Acceptance['event'],ref:eventRef(event)}
        found.accepted.set(key,accepted);found.bySeq.set(Number(event.seq),accepted)
        found.pending.add(accepted);found.unterminated.add(accepted)
      }else {
        const accepted=found.bySeq.get(marker.acceptedRef.seq)
        if(!accepted||accepted.ref.sha256!==marker.acceptedRef.sha256)fail('AUTHOR_GENERATION_EFFECTS_ACCEPTANCE_MISSING')
        if(marker.kind==='settled') {
          accepted.settledRef=eventRef(event);found.pending.delete(accepted)
        }else {
          if(nativeInputSha256(marker.terminal.identity)!==nativeInputSha256(accepted.event.data.identity))
            fail('AUTHOR_GENERATION_EFFECTS_TERMINAL_CHANGED')
          accepted.terminalRef=eventRef(event);found.unterminated.delete(accepted)
        }
      }
    }
    return found
  }
  function root(sid:string):Session {return deps.sessions.get(sid)??fail('AUTHOR_GENERATION_EFFECTS_ROOT_INACTIVE')}
  async function flush(session:Session):Promise<void> {
    if(!await deps.sessions.flush(session))fail('AUTHOR_GENERATION_EFFECTS_FLUSH_UNKNOWN')
    const state=indexes.get(session)
    if(state)state.needsFlush=false
  }
  function append(session:Session,marker:Parameters<typeof appendAuthorGenerationEffects>[1]) {
    index(session).needsFlush=true
    return appendAuthorGenerationEffects(session,marker)
  }
  function stored(accepted:Acceptance) {
    const marker=accepted.event.data,job=deps.branch.get('tavern_job__'+marker.identity.taskId) as StoredTask|undefined,
      prompt=job?.input?.authorDialog as AuthorDialogPromptV1|undefined
    if(job?.sessionId!==marker.rootSessionId||job.generation!==marker.identity.generation
      ||prompt?.promptSha256!==marker.identity.planSha256)fail('AUTHOR_GENERATION_EFFECTS_JOB_CHANGED')
    return {job,prompt}
  }
  async function recordJob(accepted:Acceptance,terminalRef?:AuthorGenerationEffectsRefV1):Promise<void> {
    const {job}=stored(accepted),
      progress={acceptedRef:accepted.ref,...accepted.settledRef?{settledRef:accepted.settledRef}:{}}
    await deps.tasks.recordAuthorGenerationEffects(root(accepted.event.data.rootSessionId) as unknown as HostSession,
      job.id,job.generation!,progress,terminalRef)
  }
  function material(accepted:Acceptance) {
    const marker=accepted.event.data,snapshot=deps.branch.get(marker.snapshotRef.key),plan=deps.branch.get(marker.planRef.key),
      preparation=readAcceptedPreparationPlanRecord(plan,marker.planRef.sha256)
    if(recordSha256(snapshot)!==marker.snapshotRef.sha256||!preparation)
      fail('AUTHOR_GENERATION_EFFECTS_MATERIAL_CHANGED')
    return {snapshot,plan,preparation}
  }
  async function finish(session:Session,accepted:Acceptance,signal:AbortSignal,commitOriginal?:()=>Promise<void>) {
    if(accepted.settledRef){await flush(session);await recordJob(accepted);return}
    signal.throwIfAborted()
    if(commitOriginal)await commitOriginal()
    else if(accepted.event.data.effects==='source') {
      const {preparation}=material(accepted),sid=String(session.id)
      // The durable marker already accepted this material. Its contribution
      // owner checks the current Source under its write lock, including retire.
      await deps.variables.commitPreparation({...preparation,acceptedMaterialRef:accepted.event.data.planRef},
        {current:()=>!signal.aborted&&deps.sessions.get(sid)===session})
    }
    signal.throwIfAborted()
    if(deps.sessions.get(String(session.id))!==session)fail('AUTHOR_GENERATION_EFFECTS_ROOT_CHANGED')
    const event=append(session,{schemaVersion:1,encoding:'native-author-generation-effects-v1',
      kind:'settled',rootSessionId:String(session.id),acceptedRef:accepted.ref})
    await flush(session)
    accepted.settledRef=eventRef(event)
    index(session);await recordJob(accepted)
  }
  async function publishTerminal(session:Session,accepted:Acceptance,proof:AuthorGenerationTerminalV1) {
    if(accepted.terminalRef){await flush(session);return accepted.terminalRef}
    if(nativeInputSha256(proof.identity)!==nativeInputSha256(accepted.event.data.identity)
      ||proof.turn!==accepted.event.data.checkpoint.turn)fail('AUTHOR_GENERATION_EFFECTS_TERMINAL_CHANGED')
    const event=append(session,{schemaVersion:1,encoding:'native-author-generation-effects-v1',
      kind:'terminal',rootSessionId:String(session.id),acceptedRef:accepted.ref,terminal:proof})
    await flush(session)
    accepted.terminalRef=eventRef(event);index(session);await recordJob(accepted,accepted.terminalRef)
    return accepted.terminalRef
  }
  async function recoverPending(session:Session,signal:AbortSignal) {
    const state=index(session)
    if(state.needsFlush)await flush(session)
    for(const accepted of state.pending)await finish(session,accepted,signal)
    for(const accepted of state.unterminated) {
      signal.throwIfAborted()
      const {job}=stored(accepted)
      let proof=job.authorNativeTerminal
      if(!proof) {
        // The actual TaskHost publishes a new job object before its terminal
        // callback. An unchanged unknown job cannot justify rereading its cold
        // child on every unrelated Main preparation.
        if(accepted.inspectedJob===job)continue
        using observation=await deps.sessionQuery.observeSession(accepted.event.data.identity.childSessionId,{projectionMode:'none',signal})
        proof=inspectNativeAuthorGenerationTerminalV1(accepted.event.data.identity,observation.events)
        accepted.inspectedJob=job
      }
      if(proof)await publishTerminal(session,accepted,proof)
    }
  }
  async function accept(prompt:AuthorDialogPromptV1,checkpoint:AuthorDialogCheckpointV1,
    commitOriginal:()=>Promise<void>,current:()=>boolean=checkpoint.current,signal:AbortSignal=checkpoint.signal,
    onAccepted?:()=>void)
    :Promise<AuthorGenerationEffectsReceiptV1> {
    const sid=checkpoint.identity.rootSessionId
    return gate(sid,async()=>{
      const session=root(sid)
      let accepted=index(session).accepted.get(operationKey(checkpoint.identity))
      if(!accepted) {
        await recoverPending(session,signal)
        const snapshot=deps.branch.get(prompt.material.snapshot.key),plan=deps.branch.get(prompt.material.plan.key),
          effects=(plan as {payload?:{promptPlan?:{effects?:'source'|'readonly'}}}|undefined)?.payload?.promptPlan?.effects
        if(effects!=='source'&&effects!=='readonly')fail('AUTHOR_GENERATION_EFFECTS_POLICY_MISSING')
        await deps.withSourceLock(sid,async()=>{
          signal.throwIfAborted()
          if(!current()||!checkpoint.current()||deps.sessions.get(sid)!==session)fail('AUTHOR_GENERATION_EFFECTS_OWNER_CHANGED')
          if(checkpoint.identity.planSha256!==prompt.promptSha256||checkpoint.identity.operationId!==prompt.operationId)
            fail('AUTHOR_GENERATION_EFFECTS_PLAN_CHANGED')
          if(effects==='source')deps.registry.assertBaseCurrent(sid,snapshot,plan)
          append(session,{schemaVersion:1,encoding:'native-author-generation-effects-v1',
            kind:'accepted',rootSessionId:sid,identity:checkpoint.identity,
            checkpoint:{headerRef:checkpoint.headerRef,materialRef:checkpoint.materialRef,turn:checkpoint.turn,step:checkpoint.step},
            snapshotRef:prompt.material.snapshot,planRef:prompt.material.plan,effects})
          await flush(session)
          accepted=index(session).accepted.get(operationKey(checkpoint.identity))!
        },signal)
      }else await flush(session)
      // Durable acceptance freezes the material. Its own contribution writes
      // may now advance the ordinary roots captured during preparation.
      onAccepted?.()
      await checkpoint.recordEffects?.({acceptedRef:accepted!.ref,...accepted!.settledRef?{settledRef:accepted!.settledRef}:{}})
      await recordJob(accepted!)
      await finish(session,accepted!,signal,commitOriginal)
      const receipt={acceptedRef:accepted!.ref,settledRef:accepted!.settledRef!}
      await checkpoint.recordEffects?.(receipt)
      return receipt
    })
  }
  async function settle(sid:string,signal:AbortSignal):Promise<void> {
    return gate(sid,()=>recoverPending(root(sid),signal))
  }
  async function terminal(proof:AuthorGenerationTerminalV1,signal:AbortSignal) {
    const sid=proof.identity.rootSessionId
    return gate(sid,async()=>{
      signal.throwIfAborted()
      const session=root(sid),accepted=index(session).accepted.get(operationKey(proof.identity))
      return accepted?publishTerminal(session,accepted,proof):undefined
    })
  }
  return {accept,settle,terminal}
}
