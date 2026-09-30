/** Produces input transitions from actual native calls and the existing importer.
 * It does not own the input ledger, import transaction or a recovery driver. */
import {recordSha256} from './roleplay-data.js'
import {extname} from 'node:path'
import type {CardImportDependencies,ImportSession,ImportExec,ImportRecord,ImportTransaction,ImportPointer,ImportArguments} from './roleplay-import-types.js'
import type {ChatCardNativeContext,ChatCardProof,ChatCardSourceResult} from './roleplay-chat-card-source.js'
import type {CardWorkflowJob} from './roleplay-card-workflow-types.js'
import type {InputObservation,InputTransitionProof,RoleplayInputBinding,RoleplayInputTransitionLease,
  createRoleplayInputPreparation} from './roleplay-input-preparation.js'

interface TransitionAdapterDeps {
  owner():Pick<ReturnType<typeof createRoleplayInputPreparation>,'transitionForJob' | 'transitionForRequest'> | undefined
  binding(agent:object):RoleplayInputBinding | undefined
  nativeContext(session:ImportSession,exec:ImportExec):ChatCardNativeContext
  chatProof(session:ImportSession,requestId:string):ChatCardProof
  job(id:string):CardWorkflowJob | undefined
  pointer(sessionId:string):unknown
  observe(session:ImportSession):InputObservation
  row(table:string,key:string):unknown
  callOwnsInput(session:ImportSession,callId:string):boolean
}
function fail(code:string):never {throw new Error(code)}
const same = (a:unknown,b:unknown) => recordSha256(a) === recordSha256(b)
const activationProof = (record:ImportRecord,transaction:ImportTransaction) => ({importId:record.importId,
  transactionId:transaction.transactionId,oldPointerSha256:recordSha256(transaction.activePointerPrev ?? null),
  writeDigests:Object.fromEntries(transaction.writes.map(write => [`${write.tableName}:${write.key}`,write.nextSha256]))})

export function createRoleplayImportInputTransition(deps:TransitionAdapterDeps):NonNullable<CardImportDependencies['inputTransition']> {
  const legacyRecords=new Map<string,RoleplayInputTransitionLease>()
  const starts = new WeakMap<ImportExec,{lease:RoleplayInputTransitionLease;proof?:InputTransitionProof;
    binding:RoleplayInputBinding;duplicate?:InputTransitionProof}>()
  function begin(session:ImportSession,exec:ImportExec,args:ImportArguments) {
    const binding = exec.agent ? deps.binding(exec.agent) : undefined
    if (!binding) return undefined
    const step=binding.currentStep(),current=binding.current()
    if (!step || !current) fail('INPUT_STEP_PROOF_MISSING')
    const actual=deps.nativeContext(session,exec)
    const message=actual.intent.originalMessage as {id?:unknown}
    const original=binding.originalMessages(step).filter(row => row.id === message.id)
    const refs=current.refs.filter(ref => ref.messageId === message.id)
    if (original.length!==1 || refs.length!==1 || !same(original[0],actual.intent.originalMessage)) fail('INPUT_PLAYER_REF_UNPROVEN')
    const existing=binding.existingTransition()
    const lease=existing?.lease ?? binding.beginTransition(step,{callId:actual.call.id,playerRef:refs[0]!})
    const state={binding,lease,...(existing?.proof?{duplicate:existing.proof}:{})} as NonNullable<ReturnType<typeof starts.get>>
    starts.set(exec,state)
    async function reserveProof(proof:InputTransitionProof) {
      if (state.duplicate) {
        const before=state.duplicate
        if (before.requestId!==proof.requestId || before.rawSourceSha256!==proof.rawSourceSha256
          || before.sourceProofSha256!==proof.sourceProofSha256 || before.channel!==proof.channel
          || !same(before.playerRef,proof.playerRef)) fail('INPUT_SECOND_TRANSITION_REJECTED')
        state.proof=before
        return
      }
      await lease.reserve(proof)
      state.proof=proof
    }
    return {
      async reserve(source:ChatCardSourceResult) {
        const proof=deps.chatProof(session,source.requestId)
        if (proof.intent.messageId!==message.id || proof.intent.turn!==actual.turn
          || proof.intent.seq!==actual.intent.seq) fail('INPUT_CHAT_PROOF_UNPROVEN')
        await reserveProof({callId:actual.call.id,playerRef:refs[0]!,channel:'chat-attachment',
          sourceProofSha256:proof.proofSha256,requestId:proof.requestId,
          sourceSha256:state.duplicate?.sourceSha256 ?? step!.currency.source.sourceSha256,
          rawSourceSha256:proof.file.attachmentId.slice(7)})
      },
      async reserveWorkspace(source:{sourceFile:string;sourceBytes:number;sourceMtimeMs:number;extension:string;rawSha256:string}) {
        const requestId=typeof args.request_id==='string' ? args.request_id : state.duplicate?.requestId
          ?? `native-workspace-${recordSha256({callId:actual.call.id,ref:refs[0],rawSha256:source.rawSha256})}`
        await reserveProof({callId:actual.call.id,playerRef:refs[0]!,channel:'workspace',
          sourceProofSha256:recordSha256({schemaVersion:1,encoding:'actual-workspace-import-source-v1',
            sourceFileSha256:recordSha256(source.sourceFile),bytes:source.sourceBytes,
            mtimeMs:source.sourceMtimeMs,extension:source.extension,rawSha256:source.rawSha256}),
          requestId,sourceSha256:step!.currency.source.sourceSha256,rawSourceSha256:source.rawSha256})
        return requestId
      },
    }
  }
  async function bindJob(session:ImportSession,exec:ImportExec,job:{id:string;generation:string}) {
    const state=starts.get(exec)
    if (!state) return
    const actual=deps.job(job.id),proof=state.proof
    if (!actual || !proof || actual.sessionId!==session.id || actual.generation!==job.generation
      || actual.source.sha256!==proof.rawSourceSha256 || actual.clientRequestId!==proof.requestId
      || !actual.toolCallIds?.includes(exec.callId!)) fail('INPUT_IMPORT_JOB_UNPROVEN')
    await state.lease.bindJob({jobId:actual.id,jobGeneration:actual.generation,
      requestId:proof.requestId,rawSourceSha256:actual.source.sha256})
    if (actual.execution!=='deterministic') await state.lease.delegateLegacy(proof)
  }
  async function bindLegacyRecord(session:ImportSession,exec:ImportExec,record:ImportRecord) {
    if (record.mode!=='merge') return
    const state=starts.get(exec)
    if (!state) return
    const proof=state.proof
    if (!proof || proof.channel!=='workspace' || record.mode!=='merge' || record.sessionId!==session.id
      || record.rawSha256!==proof.rawSourceSha256) fail('INPUT_LEGACY_RECORD_UNPROVEN')
    const sourceProofSha256=recordSha256({schemaVersion:1,encoding:'actual-workspace-import-source-v1',
      sourceFileSha256:recordSha256(record.sourceFile),bytes:record.sourceBytes,
      mtimeMs:record.sourceMtimeMs,extension:extname(record.sourceFile).toLowerCase(),rawSha256:record.rawSha256})
    if (sourceProofSha256!==proof.sourceProofSha256) fail('INPUT_LEGACY_RECORD_UNPROVEN')
    await state.lease.delegateLegacy(proof)
    legacyRecords.set(`${session.id}:${record.importId}`,state.lease)
  }
  async function leaseFor(session:ImportSession,record:ImportRecord) {
    if (!record.workflowId || !record.workflowGeneration) return legacyRecords.get(`${session.id}:${record.importId}`)
    const actual=deps.job(record.workflowId)
    if (!actual || actual.generation!==record.workflowGeneration || actual.source.sha256!==record.rawSha256) fail('INPUT_IMPORT_JOB_UNPROVEN')
    let lease=deps.owner()?.transitionForJob(record.sessionId,actual.id,actual.generation)
    if (!lease && actual.clientRequestId) {
      lease=deps.owner()?.transitionForRequest(record.sessionId,actual.clientRequestId,actual.source.sha256)
      if (lease) await lease.bindJob({jobId:actual.id,jobGeneration:actual.generation,
        requestId:actual.clientRequestId,rawSourceSha256:actual.source.sha256})
    }
    if (!lease && actual.toolCallIds?.some(call => deps.callOwnsInput(session,call))) fail('INPUT_IMPORT_BINDING_UNKNOWN')
    return lease
  }
  async function prepareActivation(session:ImportSession,record:ImportRecord,transaction:ImportTransaction) {
    const lease=await leaseFor(session,record)
    if (lease) await lease.prepareActivation(activationProof(record,transaction))
  }
  function checkActivation(session:ImportSession,record:ImportRecord) {
    if (!record.workflowId || !record.workflowGeneration) {
      legacyRecords.get(`${session.id}:${record.importId}`)?.checkActivation()
      return
    }
    const lease=deps.owner()?.transitionForJob(record.sessionId,record.workflowId,record.workflowGeneration)
    if (lease) lease.checkActivation()
    else {
      const job=deps.job(record.workflowId)
      if (job?.toolCallIds?.some(call => deps.callOwnsInput(session,call))) fail('INPUT_IMPORT_BINDING_UNKNOWN')
    }
  }
  async function commitActivation(session:ImportSession,record:ImportRecord,pointer:ImportPointer,transaction?:ImportTransaction) {
    const lease=await leaseFor(session,record)
    if (!lease) return {kind:'acknowledged' as const}
    if (lease.isLegacy()) {lease.checkActivation();return {kind:'acknowledged' as const}}
    const proof=transaction ? activationProof(record,transaction) : lease.getActivationProof(),activation=record.activation
    if (!proof || !activation || record.status!=='active' || !same(deps.pointer(session.id),pointer)
      || activation.transactionId!==proof.transactionId || pointer.transactionId!==activation.transactionId
      || !same(Object.fromEntries(activation.writeDigests.map(write => [`${write.tableName}:${write.key}`,write.sha256])),proof.writeDigests)
      || activation.writeDigests.some(write => recordSha256(deps.row(write.tableName,write.key))!==write.sha256)) {
      return {kind:'unknown' as const,code:'INPUT_ACTIVATION_UNPROVEN'}
    }
    return lease.commit({...proof,sourceSha256:deps.observe(session).sourceSha256})
  }
  async function sourceRejected(_session:ImportSession,exec:ImportExec,code='IMPORT_SOURCE_REJECTED') {
    const state=starts.get(exec)
    if (state) await state.lease.rejectSource(code)
  }
  return {begin,bindJob,bindLegacyRecord,prepareActivation,checkActivation,commitActivation,sourceRejected}
}
