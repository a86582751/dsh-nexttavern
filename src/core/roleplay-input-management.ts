/** Read-only confirmation of the import that replaced an original numerical
 * input's story Source. No activation retry or numerical event is written. */
import {extname} from 'node:path'
import {recordSha256} from './roleplay-data.js'
import {importCoverage,assertImportRecordIntegrity} from './roleplay-import-record.js'
import {validateChatCardProof} from './roleplay-chat-card-source.js'
import type {InputCompletionScope} from './roleplay-input-completion.js'
import type {InputTransitionState} from './roleplay-input-preparation.js'
import type {ImportRecord,ImportPointer} from './roleplay-import-types.js'
import type {CardWorkflowJob} from './roleplay-card-workflow-types.js'
import type {ChatCardProof} from './roleplay-chat-card-source.js'

export interface InputManagementDependencies {
  job(id:string):CardWorkflowJob|undefined
  imported(sessionId:string,importId:string):ImportRecord|undefined
  pointer(sessionId:string):ImportPointer|undefined
  row(table:string,key:string):unknown
  sourceSha256(sessionId:string):string
  chatProof(sessionId:string,requestId:string):ChatCardProof|undefined
  chatSourceCurrent(sessionId:string,requestId:string):boolean
  callMatches(sessionId:string,callId:string,turn:number):boolean
  callRejected(sessionId:string,callId:string,turn:number):boolean
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
function transition(scope:InputCompletionScope):InputTransitionState {
  const row=scope.transition as unknown as InputTransitionState|undefined
  if(!row||!['committed','source-rejected','legacy-delegated'].includes(row.status)
    ||row.from.kind!=='story'||!row.from.headRef
    ||row.reservation.preparationId!==scope.currency.preparationId
    ||!scope.receipt.checkpoint.refs.some(ref=>same(ref,row.reservation.proof.playerRef))) {
    throw new Error('INPUT_MANAGEMENT_TRANSITION_UNCLOSED')
  }
  if(row.status==='committed'&&(!row.job||!row.activation||!row.activationProof||!row.to||scope.currency.source.kind!=='management')
    ||row.status==='source-rejected'&&(row.job||row.activation||row.activationProof||scope.currency.source.kind!=='management')
    ||row.status==='legacy-delegated'&&((!row.job&&!row.legacyRecord)||!!row.job&&!!row.legacyRecord
      ||row.activation||row.activationProof||scope.currency.source.kind!=='legacy')) {
    throw new Error('INPUT_MANAGEMENT_TRANSITION_UNCLOSED')
  }
  return row
}
export function prepareInputManagementReceipt(scope:InputCompletionScope):Record<string,unknown> {
  const row=transition(scope),proof=row.reservation.proof
  const originalWork={preparationId:scope.currency.preparationId,credentialSha256:scope.currency.credentialSha256,
    receiptGeneration:scope.currency.receiptGeneration}
  const nativeCompletedReceiptSha256=recordSha256(scope.receipt)
  if(row.status==='source-rejected') {
    const body={schemaVersion:1,disposition:'management-source-rejected',numericalEffect:'none',originalWork,
      nativeCompletedReceiptSha256,reservationId:row.reservation.reservationId,actualBeginCallId:proof.callId,
      playerRef:proof.playerRef,originalSourceSha256:row.from.sourceSha256,
      rejectionCode:scope.currency.source.kind==='management'?scope.currency.source.reason:''}
    return {...body,receiptSha256:recordSha256(body)}
  }
  if(row.status==='legacy-delegated') {
    // A durable handoff to the existing semantic importer is not activation.
    // The importer retains its task identity and its own failure/recovery path.
    const body={schemaVersion:1,disposition:'management-semantic-delegated',numericalEffect:'none',originalWork,
      nativeCompletedReceiptSha256,reservationId:row.reservation.reservationId,actualBeginCallId:proof.callId,
      playerRef:proof.playerRef,sourceProofSha256:proof.sourceProofSha256,
      ...(row.job?{job:row.job}:{legacyRecord:row.legacyRecord}),
      semanticSourceSha256:scope.currency.source.sourceSha256}
    return {...body,receiptSha256:recordSha256(body)}
  }
  const activation=row.activation!,job=row.job!
  const body={schemaVersion:1,disposition:'management-transition',numericalEffect:'none',
    originalWork,nativeCompletedReceiptSha256,
    transition:{reservationId:row.reservation.reservationId,actualBeginCallId:proof.callId,playerRef:proof.playerRef,
      sourceProofSha256:proof.sourceProofSha256,jobId:job.jobId,jobGeneration:job.jobGeneration,
      importId:activation.importId,transactionId:activation.transactionId,
      activationProofSha256:recordSha256(row.activationProof),activatedSourceSha256:activation.sourceSha256}}
  return {...body,receiptSha256:recordSha256(body)}
}
export function verifyInputManagementReceipt(deps:InputManagementDependencies,scope:InputCompletionScope,
  descriptor:Record<string,unknown>):boolean {
  try {
    const row=transition(scope),proof=row.reservation.proof,activation=row.activation!,prepared=row.activationProof!,ownedJob=row.job!
    const sid=scope.receipt.checkpoint.sessionId
    if(!same(descriptor,prepareInputManagementReceipt(scope))
      ||!deps.callMatches(sid,proof.callId,scope.receipt.checkpoint.actualTurn))return false
    if(row.status==='source-rejected')return scope.currency.source.kind==='management'
      &&/^[A-Z][A-Z0-9_]{0,63}$/.test(scope.currency.source.reason)
      &&scope.currency.source.sourceSha256===row.from.sourceSha256&&proof.sourceSha256===row.from.sourceSha256
      &&deps.sourceSha256(sid)===row.from.sourceSha256&&deps.callRejected(sid,proof.callId,scope.receipt.checkpoint.actualTurn)
    if(row.status==='legacy-delegated') {
      if(row.legacyRecord) {
        const merge=row.legacyRecord,record=deps.imported(sid,merge.importId)
        if(!record||merge.schemaVersion!==1||merge.kind!=='semantic-merge-source'||record.mode!=='merge'
          ||record.sessionId!==sid||record.importId!==merge.importId||record.normalizedSha256!==merge.normalizedSha256
          ||record.rawSha256!==proof.rawSourceSha256||!['staging','committing','recovery-required','active'].includes(record.status)
          ||proof.channel!=='workspace')return false
        assertImportRecordIntegrity(record)
        return proof.sourceProofSha256===recordSha256({schemaVersion:1,encoding:'actual-workspace-import-source-v1',
          sourceFileSha256:recordSha256(record.sourceFile),bytes:record.sourceBytes,mtimeMs:record.sourceMtimeMs,
          extension:extname(record.sourceFile).toLowerCase(),rawSha256:record.rawSha256})
      }
      const job=deps.job(ownedJob.jobId)
      return !!job&&job.sessionId===sid&&job.kind==='card-import'&&job.execution!=='deterministic'
        &&!['cancelled','stale'].includes(job.status)&&job.generation===ownedJob.jobGeneration
        &&job.clientRequestId===proof.requestId&&job.source.sha256===proof.rawSourceSha256
        &&ownedJob.rawSourceSha256===proof.rawSourceSha256&&ownedJob.requestId===proof.requestId
        &&!!job.toolCallIds?.includes(proof.callId)
    }
    if(!same(prepared,{importId:activation.importId,transactionId:activation.transactionId,
        oldPointerSha256:activation.oldPointerSha256,writeDigests:activation.writeDigests})
      ||proof.sourceSha256!==row.from.sourceSha256||row.to!.sourceSha256!==activation.sourceSha256
      ||scope.currency.source.sourceSha256!==activation.sourceSha256)return false
    const job=deps.job(ownedJob.jobId),record=deps.imported(sid,activation.importId),pointer=deps.pointer(sid)
    if(!job||!record||!pointer||job.sessionId!==sid||job.kind!=='card-import'||job.execution!=='deterministic'
      ||['cancelled','stale'].includes(job.status)||job.generation!==ownedJob.jobGeneration
      ||job.clientRequestId!==proof.requestId||!job.toolCallIds?.includes(proof.callId)
      ||job.source.sha256!==proof.rawSourceSha256||ownedJob.rawSourceSha256!==proof.rawSourceSha256
      ||ownedJob.requestId!==proof.requestId||record.sessionId!==sid||record.status!=='active'
      ||record.workflowId!==job.id||record.workflowGeneration!==job.generation||record.rawSha256!==proof.rawSourceSha256
      ||pointer.importId!==record.importId||pointer.sourceRecordSessionId&&pointer.sourceRecordSessionId!==sid
      ||pointer.transactionId!==activation.transactionId||record.activation?.transactionId!==activation.transactionId
      ||pointer.normalizedSha256!==record.normalizedSha256||pointer.coverageSha256!==recordSha256(importCoverage(record)))return false
    assertImportRecordIntegrity(record)
    const writes=record.activation.writeDigests,keys=writes.map(write=>`${write.tableName}:${write.key}`)
    if(new Set(keys).size!==keys.length||!same(Object.fromEntries(writes.map((write,index)=>[keys[index],write.sha256])),prepared.writeDigests)
      ||writes.some(write=>!['cards','worldbook','rules','status','opening'].includes(write.tableName)
        ||!write.key.startsWith(`${sid}__`)||recordSha256(deps.row(write.tableName,write.key))!==write.sha256))return false
    if(proof.channel==='chat-attachment') {
      const chat=validateChatCardProof(deps.chatProof(sid,proof.requestId))
      if(chat.sessionId!==sid||chat.proofSha256!==proof.sourceProofSha256||chat.intent.messageId!==proof.playerRef.messageId
        ||chat.intent.turn!==scope.receipt.checkpoint.actualTurn||chat.intent.messageSha256!==proof.playerRef.messageSha256
        ||chat.file.attachmentId.slice(7)!==record.rawSha256||!deps.chatSourceCurrent(sid,proof.requestId))return false
    } else if(proof.channel==='workspace') {
      const actual=recordSha256({schemaVersion:1,encoding:'actual-workspace-import-source-v1',
        sourceFileSha256:recordSha256(record.sourceFile),bytes:record.sourceBytes,mtimeMs:record.sourceMtimeMs,
        extension:extname(record.sourceFile).toLowerCase(),rawSha256:record.rawSha256})
      if(actual!==proof.sourceProofSha256)return false
    } else return false
    return deps.sourceSha256(sid)===activation.sourceSha256
  } catch {return false}
}
