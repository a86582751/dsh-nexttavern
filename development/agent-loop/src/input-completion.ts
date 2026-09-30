/** Structural closing proof and exact owner acknowledgement. No Source work,
 * input queue, provider call or cold flush permission belongs to this module. */
import type {Session, SessionEvent} from '@deepseek-ai/dsh-session'
import {inspectNativeInboxHistory, nativeInputSha256} from './input-admission.js'
import type {NativeCompletedInputWorkReceiptV1, NativeDurableInputWorkReceiptV1,
  NativeInputClaim, NativeInputSupplementV1, NativeInputCompletionLookupV1} from './input-admission.js'

export function nativeCompletedInputReceipt(session: Session, checkpoint: NativeDurableInputWorkReceiptV1,
  claim: NativeInputClaim, supplement: NativeInputSupplementV1 | undefined,
  capturedEnd: SessionEvent): NativeCompletedInputWorkReceiptV1 | undefined {
  try {
    const events = session.snapshotEvents(), end = events.find(event => event.seq === capturedEnd.seq)
    if (!end || end.type !== 'turn/end' || end.data.reason.kind !== 'completed'
      || end.data.turn !== checkpoint.actualTurn || nativeInputSha256(end) !== nativeInputSha256(capturedEnd)
      || events.filter(event => event.type === 'turn/end' && event.data.turn === checkpoint.actualTurn).length !== 1
      || events.some(event => event.type === 'turn/start' && event.seq > checkpoint.startSeq)) return undefined
    const history = inspectNativeInboxHistory(session.id, events, session.inheritedEventCount)
    const linked = history.linkReceipt(checkpoint.startSeq)
    if (!linked || nativeInputSha256(linked) !== nativeInputSha256(checkpoint)
      || !history.ownsClaim(claim) || claim.turn !== checkpoint.actualTurn
      || nativeInputSha256(claim.refs) !== nativeInputSha256(checkpoint.refs)
      || supplement && (!history.ownsClaim(supplement.claims.at(-1)!.claim)
        || supplement.claims.some(owned => !history.ownsClaim(owned.claim)))) return undefined
    const admittedUsers: {ref: typeof checkpoint.refs[number]; userSeq: number}[] = []
    for (const ref of checkpoint.refs) {
      const owned = history.ownership(ref)
      if (owned.status !== 'admitted' || owned.turn !== checkpoint.actualTurn
        || owned.userSeq <= checkpoint.firstStepStartSeq || owned.userSeq >= end.seq) return undefined
      admittedUsers.push(Object.freeze({ref, userSeq: owned.userSeq}))
    }
    if (!admittedUsers.length || !claim.messages.some(message => message.source.kind === 'user')) return undefined
    return Object.freeze({schemaVersion: 1, checkpoint, turnEndSeq: end.seq,
      turnEndSha256: nativeInputSha256(end), admittedUsers: Object.freeze(admittedUsers), flushed: true})
  } catch {return undefined}
}

/** Getters, extra fields and a receipt for another closing generation cannot
 * acknowledge the pending terminal operation. This does not inspect Source. */
export function nativeCompletedInputAcknowledgement(value: unknown,
  receipt: NativeCompletedInputWorkReceiptV1): NativeInputCompletionLookupV1 {
  const unknown = (code: string): NativeInputCompletionLookupV1 => Object.freeze({status: 'unknown',
    checkpoint: receipt.checkpoint, receipt, code})
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return unknown('INPUT_COMPLETION_ACK_INVALID')
    const row: Record<string, unknown> = {}
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (typeof key !== 'string' || !descriptor || !Object.hasOwn(descriptor, 'value')) return unknown('INPUT_COMPLETION_ACK_INVALID')
      row[key] = descriptor.value
    }
    const settled = row['kind'] === 'settled'
    const fields = settled ? ['kind', 'receiptSha256', 'ownerReceiptSha256'] : ['kind', 'receiptSha256', 'code']
    if (Object.keys(row).length !== fields.length || fields.some(field => !Object.hasOwn(row, field))
      || row['receiptSha256'] !== nativeInputSha256(receipt)) return unknown('INPUT_COMPLETION_ACK_INVALID')
    if (settled && typeof row['ownerReceiptSha256'] === 'string' && /^[a-f0-9]{64}$/.test(row['ownerReceiptSha256'])) {
      return Object.freeze({status: 'settled', checkpoint: receipt.checkpoint, receipt,
        ownerReceiptSha256: row['ownerReceiptSha256']})
    }
    if (['blocked', 'unknown'].includes(String(row['kind'])) && typeof row['code'] === 'string'
      && /^[A-Z][A-Z0-9_]{0,63}$/.test(row['code'])) {
      return Object.freeze({status: row['kind'] as 'blocked' | 'unknown', checkpoint: receipt.checkpoint, receipt, code: row['code']})
    }
  } catch { /* An uncertain owner result leaves the Native gate closed. */ }
  return unknown('INPUT_COMPLETION_ACK_INVALID')
}
