/** Explicit player replacements own a Native maintenance reservation and one
 * Source-lock lease. Persisted operation facts can confirm an old result but
 * never create a replacement lease or authorize automatic cold publication. */
import {recordSha256} from './roleplay-data.js'
import {mvuStateSettlementKey} from './roleplay-mvu-state.js'
import {readMvuPlayerRequest,readMvuPlayerOperation,readMvuPlayerOperationFacts,cloneMvuPlayerData,
  mvuPlayerOperationKey,mvuPlayerCompletionKey,mvuPlayerRefusalKey,mvuPlayerIntentFor,verifyMvuPlayerMarker}
  from './roleplay-mvu-player-facts.js'
import type {MvuPlayerOperation,MvuPlayerOperationCompletion,MvuPlayerOperationRefusal,MvuPlayerFactTable}
  from './roleplay-mvu-player-facts.js'
import type {Session} from '@deepseek-ai/dsh-session'
import type {NativeInputAdmissionAgentV2,NativeInputStopNoticeV1} from '@deepseek-ai/dsh-agent-loop'
import type {mvuPlayerMarkers} from 'dsh-nexttavern-session-format/mvu-player-marker'
import type {createRoleplayMvuState,MvuStatePermissionPhase,MvuNumericalSnapshot} from './roleplay-mvu-state.js'
import type {MvuPlayerStateIntent,MvuPlayerStatePublisherSettlement} from './roleplay-mvu-player-records.js'
import type {MvuStateObservation,MvuPlayerEditResponse,MvuPlayerEditRequest} from './roleplay-mvu-player-types.js'

interface Table extends MvuPlayerFactTable {put(key:string,value:object):Promise<unknown>}
export interface MvuPlayerDeps {
  branch:Table
  status:MvuPlayerFactTable
  state():ReturnType<typeof createRoleplayMvuState>
  session(sid:string):Session|undefined
  agent(session:Session):NativeInputAdmissionAgentV2|undefined
  active(session:Session):boolean
  sourceSha256(sid:string):string|undefined
  withSourceLock<T>(sid:string,work:()=>Promise<T>):Promise<T>
  flush(session:Session):Promise<boolean>
  markers:typeof mvuPlayerMarkers
}
interface Lease {
  session:Session
  agent:NativeInputAdmissionAgentV2
  token:object
  request:MvuPlayerEditRequest
  stopSha256:string
  signal?:AbortSignal
  inSourceLock:boolean
  markerFlushed:boolean
  revoked:boolean
  intent?:MvuPlayerStateIntent
  released:Promise<void>
  release():void
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'MVU_PLAYER_WRITE_UNKNOWN'
export function createRoleplayMvuPlayer(deps:MvuPlayerDeps) {
  const leases=new Map<string,Lease>(),tokens=new WeakMap<object,Lease>()
  const events=(session:Session)=>session.snapshotEvents()
  const markerFor=(operation:MvuPlayerOperation,session:Session)=>events(session).find(event=>
    event.type===deps.markers.eventType&&event.data.operationId===operation.operationId&&event.data.sessionId===session.id)
  const fullFacts=(operation:MvuPlayerOperation,session:Session)=>{
    const marker=markerFor(operation,session)
    if(!marker)throw Error('MVU_PLAYER_MARKER_UNPROVEN')
    return readMvuPlayerOperationFacts({branch:deps.branch,status:deps.status,events:events(session),sessionId:session.id,
      sourceSha256:operation.base.sourceSha256,marker,verifySettlementFacts:deps.state().verifyConsumedManualSettlementFacts})
  }
  function refused(operation:MvuPlayerOperation,session:Session):boolean {
    const raw=deps.branch.get(mvuPlayerRefusalKey(session.id,operation.operationId))
    if(!raw)return false
    const record=cloneMvuPlayerData(raw) as MvuPlayerOperationRefusal
    const {refusalSha256,...body}=record
    return Object.keys(record).sort().join(',')==='code,encoding,operationId,operationSha256,refusalSha256,schemaVersion,sessionId'
      &&record.schemaVersion===1&&record.encoding==='native-mvu-player-operation-refused-v1'
      &&record.sessionId===session.id&&record.operationId===operation.operationId
      &&record.operationSha256===operation.operationSha256&&/^[A-Z0-9_]+$/.test(record.code)
      &&refusalSha256===recordSha256(body)&&!markerFor(operation,session)
      &&![...deps.status.entries()].some(([,row]:any)=>row?.intent?.operation?.key===mvuPlayerOperationKey(session.id,operation.operationId))
  }
  function manualGate(sid:string,allowedIntent?:MvuPlayerStateIntent):string|undefined {
    try {
      const session=deps.session(sid)
      if(!session)return 'MVU_PLAYER_SESSION_INACTIVE'
      const prefix=`${sid}__mvu-player-`,rows=[...deps.branch.entries()].filter(([key])=>key.startsWith(prefix))
      if(rows.length>4096)return 'OWNED_PARTIAL_OR_ORPHAN'
      const operations=rows.filter(([key])=>key.startsWith(`${prefix}operation-`))
      for(const [key,raw] of operations) {
        const op=readMvuPlayerOperation(raw)
        if(op.sessionId!==sid||key!==mvuPlayerOperationKey(sid,op.operationId))return 'OWNED_PARTIAL_OR_ORPHAN'
        const lease=leases.get(sid)
        if(allowedIntent&&lease?.intent&&same(allowedIntent,lease.intent)&&checkManualPermission(lease.token,allowedIntent,'before-write')
          &&allowedIntent.operation.key===key&&allowedIntent.operation.sha256===op.operationSha256)continue
        if(deps.branch.get(mvuPlayerRefusalKey(sid,op.operationId))) {
          if(!refused(op,session)||deps.branch.get(mvuPlayerCompletionKey(sid,op.operationId)))return 'OWNED_PARTIAL_OR_ORPHAN'
          continue
        }
        try {fullFacts(op,session)} catch {return 'MVU_PLAYER_PENDING'}
      }
      for(const [key] of rows.filter(([key])=>!key.startsWith(`${prefix}operation-`))) {
        const match=key.match(new RegExp(`^${sid}__mvu-player-(?:complete|refused)-([a-zA-Z0-9_-]+)$`))
        if(!match||!operations.some(([opKey])=>opKey===mvuPlayerOperationKey(sid,match[1]!)))return 'OWNED_PARTIAL_OR_ORPHAN'
      }
      for(const event of events(session)) {
        if(event.type!==deps.markers.eventType||event.data.sessionId!==sid)continue
        if(!operations.some(([key])=>key===mvuPlayerOperationKey(sid,event.data.operationId)))return 'OWNED_PARTIAL_OR_ORPHAN'
      }
    } catch {return 'READ_OR_PERMISSION_UNKNOWN'}
  }
  function busy(session:Session):string|undefined {
    try {
      if(!deps.active(session)||deps.session(session.id)!==session)return 'MVU_PLAYER_SESSION_INACTIVE'
      const agent=deps.agent(session)
      if(!agent||agent.session!==session||typeof agent.runMaintenance!=='function')return 'READ_OR_PERMISSION_UNKNOWN'
      if(leases.has(session.id)||agent.status!=='idle'||agent.inbox.nextTurn.length||agent.inbox.nextStep.length)return 'MVU_PLAYER_BUSY'
      const completion=agent.lookupInputCompletion(),stop=agent.lookupInputStop()
      if(!['none','settled'].includes(completion.status)||!['none','acknowledged'].includes(stop.status))return 'MVU_PLAYER_BUSY'
    } catch {return 'READ_OR_PERMISSION_UNKNOWN'}
  }
  function observe(sid:string):MvuStateObservation {
    const session=deps.session(sid),observedNativeSeq=session?.snapshotEvents().at(-1)?.seq??-1
    const basis={schemaVersion:1 as const,sessionId:sid,observedNativeSeq}
    if(!session)return {...basis,kind:'unknown',code:'MVU_PLAYER_SESSION_INACTIVE',canEdit:false}
    try {
      const actual=deps.state().readNumericalAuthority(sid)
      if(actual.kind!=='ready')return {...basis,kind:'blocked',code:actual.code,canEdit:false}
      const editBlockCode=busy(session)
      return {...basis,kind:'ready',snapshot:actual.snapshot,canEdit:!editBlockCode,...(editBlockCode?{editBlockCode}:{})}
    } catch {return {...basis,kind:'unknown',code:'READ_OR_PERMISSION_UNKNOWN',canEdit:false}}
  }
  function verifyStoredManualIntent(intent:MvuPlayerStateIntent):boolean {
    try {
      const session=deps.session(intent.sessionId)
      if(!session)return false
      const operation=readMvuPlayerOperation(deps.branch.get(intent.operation.key)),marker=markerFor(operation,session)
      if(!marker||intent.operation.key!==mvuPlayerOperationKey(intent.sessionId,intent.operationId))return false
      verifyMvuPlayerMarker(operation,marker,events(session))
      return same(mvuPlayerIntentFor(operation,marker),intent)
    } catch {return false}
  }
  function checkManualPermission(token:object,intent:MvuPlayerStateIntent,_phase:MvuStatePermissionPhase):boolean {
    try {
      const lease=tokens.get(token)
      if(!lease||leases.get(intent.sessionId)!==lease||lease.revoked||!lease.inSourceLock||!lease.markerFlushed
        ||!lease.signal||lease.signal.aborted||!lease.intent||!same(intent,lease.intent)
        ||deps.session(intent.sessionId)!==lease.session||deps.agent(lease.session)!==lease.agent
        ||!deps.active(lease.session)||deps.sourceSha256(intent.sessionId)!==intent.sourceSha256
        ||recordSha256(lease.agent.lookupInputStop())!==lease.stopSha256)return false
      if(!verifyStoredManualIntent(intent))return false
      // Inbox insertion may be latched behind maintenance. No turn, edit or
      // competing log mutation may appear after this operation's marker.
      return events(lease.session).slice(intent.marker.seq+1).every(event=>event.type==='agent/inbox/spliced'
        &&(event.data.removedCount??0)===0&&Array.isArray(event.data.inserted)&&event.data.inserted.length>0)
    } catch {return false}
  }
  async function putExact(key:string,value:object):Promise<void> {
    const raw=deps.branch.get(key),existing=raw===undefined?undefined:cloneMvuPlayerData(raw)
    if(existing&&!same(existing,value))throw Error('MVU_PLAYER_OPERATION_CONFLICT')
    if(!existing) {
      try {await deps.branch.put(key,value)} catch { /* Exact readback distinguishes a lost write ACK from absence. */ }
    }
    const actual=deps.branch.get(key)
    if(actual===undefined||!same(cloneMvuPlayerData(actual),value))throw Error('MVU_PLAYER_WRITE_UNKNOWN')
  }
  function completionFor(op:MvuPlayerOperation,intent:MvuPlayerStateIntent,settlement:MvuPlayerStatePublisherSettlement) {
    const body={schemaVersion:1 as const,encoding:'native-mvu-player-operation-complete-v1' as const,
      sessionId:op.sessionId,operationId:op.operationId,operation:intent.operation,marker:intent.marker,
      intentSha256:intent.intentSha256,settlement:{key:mvuStateSettlementKey(op.sessionId,intent.intentSha256),sha256:recordSha256(settlement)},
      outcome:settlement.outcome}
    return {...body,completionSha256:recordSha256(body)} satisfies MvuPlayerOperationCompletion
  }
  function response(request:MvuPlayerEditRequest,outcome:'updated'|'no-update'|'unknown',replayed:boolean,code?:string):MvuPlayerEditResponse {
    return {ok:!code,numericalState:observe(request.sessionId),operation:{operationId:request.operationId,
      payloadSha256:recordSha256(request),outcome,replayed},...(code?{code,error:code}:{})}
  }
  function currentBase(request:MvuPlayerEditRequest):MvuNumericalSnapshot {
    const actual=deps.state().readNumericalAuthority(request.sessionId),e=request.expected
    if(actual.kind!=='ready')throw Error(actual.code)
    const base=actual.snapshot
    if(base.sourceSha256!==e.sourceSha256||!same(base.root,e.root)||base.revision!==e.revision
      ||base.headSha256!==e.headSha256||base.valuesSha256!==e.valuesSha256||base.stateSnapshotSha256!==e.stateSnapshotSha256) {
      throw Error('MVU_PLAYER_STALE_BASE')
    }
    return base
  }
  async function submit(input:unknown):Promise<MvuPlayerEditResponse> {
    let request:MvuPlayerEditRequest
    try {request=readMvuPlayerRequest(input)} catch(error) {const code=codeOf(error);return {ok:false,code,error:code}}
    const session=deps.session(request.sessionId)
    if(!session)return response(request,'unknown',false,'MVU_PLAYER_SESSION_INACTIVE')
    const opKey=mvuPlayerOperationKey(session.id,request.operationId),old=deps.branch.get(opKey)
    let previous:MvuPlayerOperation|undefined
    try {
      if(old) {
        previous=readMvuPlayerOperation(old)
        if(!same(previous.request,request))return response(request,'unknown',false,'MVU_PLAYER_OPERATION_CONFLICT')
        if(refused(previous,session)) {
          const refusal=deps.branch.get(mvuPlayerRefusalKey(session.id,request.operationId)) as MvuPlayerOperationRefusal
          return response(request,'unknown',true,refusal.code)
        }
        try {return response(request,fullFacts(previous,session).settlement.outcome,true)} catch { /* Explicit retry may only confirm complete old facts. */ }
      }
      const block=busy(session)
      if(block)return response(request,'unknown',false,block)
      if(!previous&&manualGate(session.id))return response(request,'unknown',false,manualGate(session.id))
      const agent=deps.agent(session)!
      const done=Promise.withResolvers<void>()
      const token={},lease:Lease={session,agent,token,request,stopSha256:recordSha256(agent.lookupInputStop()),
        inSourceLock:false,markerFlushed:false,revoked:false,released:done.promise,release:()=>done.resolve()}
      leases.set(session.id,lease);tokens.set(token,lease)
      try {
        // runMaintenance synchronously rejects both running and another
        // maintenance owner; status='idle' is only a UI observation.
        return await agent.runMaintenance(async signal=>{
          lease.signal=signal
          return deps.withSourceLock(session.id,async()=>{
            lease.inSourceLock=true
            let op=previous,marker=op&&markerFor(op,session)
            try {
              signal.throwIfAborted()
              if(!deps.active(session)||deps.session(session.id)!==session||deps.agent(session)!==agent)throw Error('MVU_PLAYER_SESSION_INACTIVE')
              if(op) {
                if(!marker)throw Error('MVU_PLAYER_PENDING')
                verifyMvuPlayerMarker(op,marker,events(session))
                if(!await deps.flush(session))throw Error('MVU_PLAYER_WRITE_UNKNOWN')
                signal.throwIfAborted()
                const intent=mvuPlayerIntentFor(op,marker),settlement=deps.status.get(mvuStateSettlementKey(session.id,intent.intentSha256))
                if(!deps.state().verifyConsumedManualSettlementFacts({intent,base:op.base,replacement:intent.replacement,settlement})) {
                  throw Error('MVU_PLAYER_PENDING')
                }
                await putExact(mvuPlayerCompletionKey(session.id,op.operationId),completionFor(op,intent,settlement as MvuPlayerStatePublisherSettlement))
                fullFacts(op,session)
                return response(request,(settlement as MvuPlayerStatePublisherSettlement).outcome,true)
              }
              const base=currentBase(request)
              if(events(session).at(-1)?.seq!==request.expected.observedNativeSeq)throw Error('MVU_PLAYER_STALE_NATIVE')
              const body={schemaVersion:1 as const,encoding:'native-mvu-player-operation-v1' as const,sessionId:session.id,
                operationId:request.operationId,request,requestSha256:recordSha256(request),base}
              op={...body,operationSha256:recordSha256(body)}
              await putExact(opKey,op)
              signal.throwIfAborted()
              if(deps.sourceSha256(session.id)!==base.sourceSha256)throw Error('SOURCE_CHANGED')
              marker=deps.markers.append(session,{schemaVersion:1,encoding:'native-mvu-player-edit-marker-v1',
                sessionId:session.id,operationId:request.operationId,requestSha256:op.requestSha256,
                operationSha256:op.operationSha256,sourceSha256:base.sourceSha256,rootSha256:recordSha256(base.root),
                baseSnapshotSha256:base.stateSnapshotSha256,replacementValuesSha256:recordSha256(request.values),
                observedNativeSeq:request.expected.observedNativeSeq})
              if(!await deps.flush(session))throw Error('MVU_PLAYER_WRITE_UNKNOWN')
              lease.markerFlushed=true;lease.intent=mvuPlayerIntentFor(op,marker)
              if(!checkManualPermission(token,lease.intent,'before-write'))throw Error('MVU_PLAYER_WRITE_UNKNOWN')
              const published=await deps.state().publishManual({token,intent:lease.intent,base,replacement:lease.intent.replacement})
              if(published.kind!=='acknowledged')throw Error('MVU_PLAYER_WRITE_UNKNOWN')
              await putExact(mvuPlayerCompletionKey(session.id,op.operationId),completionFor(op,lease.intent,published.settlement))
              if(!checkManualPermission(token,lease.intent,'after-settlement'))throw Error('MVU_PLAYER_WRITE_UNKNOWN')
              fullFacts(op,session)
              return response(request,published.settlement.outcome,false)
            } catch(error) {
              const code=codeOf(error)
              // A positively observed pre-marker refusal leaves no numerical
              // mutation. Preserve it; never erase an ambiguous/partial write.
              let ownsStoredOperation=false
              if(op)try {ownsStoredOperation=same(readMvuPlayerOperation(deps.branch.get(opKey)),op)} catch { /* No owned durable descriptor. */ }
              if(op&&ownsStoredOperation&&!markerFor(op,session)) {
                const body={schemaVersion:1 as const,encoding:'native-mvu-player-operation-refused-v1' as const,
                  sessionId:session.id,operationId:op.operationId,operationSha256:op.operationSha256,code}
                try {await putExact(mvuPlayerRefusalKey(session.id,op.operationId),{...body,refusalSha256:recordSha256(body)})} catch { /* Fail closed through pending operation. */ }
              }
              return response(request,'unknown',!!previous,marker?'MVU_PLAYER_WRITE_UNKNOWN':code)
            } finally {lease.inSourceLock=false}
          })
        })
      } finally {lease.revoked=true;leases.delete(session.id);lease.release()}
    } catch(error) {return response(request,'unknown',!!previous,codeOf(error))}
  }
  async function awaitMutationBarrier(session:{id:string},signal:AbortSignal):Promise<void> {
    while(leases.has(session.id)) {
      signal.throwIfAborted()
      const lease=leases.get(session.id)!
      await new Promise<void>((resolve,reject)=>{
        const abort=()=>reject(signal.reason??Error('MVU_PLAYER_CANCELLED'))
        signal.addEventListener('abort',abort,{once:true})
        lease.released.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort))
        if(signal.aborted)abort()
      })
    }
    signal.throwIfAborted()
  }
  function onMutationStop(session:{id:string},_notice:NativeInputStopNoticeV1) {
    const lease=leases.get(session.id)
    if(lease)lease.revoked=true
  }
  return {observe,submit,manualGate,verifyStoredManualIntent,checkManualPermission,awaitMutationBarrier,
    // Only a live reservation is waitable. Durable numerical refusals remain
    // part of Source.observe and may allow a normal management explanation.
    mutationBlockCode:(session:{id:string})=>leases.has(session.id)?'MVU_PLAYER_BUSY':undefined,onMutationStop}
}
