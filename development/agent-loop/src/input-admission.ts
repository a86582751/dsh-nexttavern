/** Native inbox identity and conservative append-only ownership interpretation. */
import {createHash} from 'node:crypto'
import type {Agent, InboxTarget} from '@deepseek-ai/dsh-agent'
import type {NativeInputLinkV1, NativeInputRef, NativePreparationReceiptV1, SessionEvent, UserMessage} from '@deepseek-ai/dsh-session'
export type {NativeInputLinkV1, NativeInputRef, NativePreparationReceiptV1} from '@deepseek-ai/dsh-session'

export const INPUT_ADMISSION_ABORT_REASON = 'native-input-admission-before-message'
export interface NativeInputProposal {
  readonly target: InboxTarget
  readonly revision: number
  readonly stateSha256: string
  readonly messages: readonly UserMessage[]
  readonly refs: readonly NativeInputRef[]
}
export interface NativeInputClaim {
  readonly proposal: NativeInputProposal
  readonly turn: number
  /** Claim-time observation, not a requirement that later pending input stops arriving. */
  readonly revision: number
  readonly refs: readonly NativeInputRef[]
  readonly messages: readonly UserMessage[]
  readonly spliceSeqs: readonly number[]
  readonly resumed: boolean
  /** Actual start that links a zero-insertion v2 resume; minted only by native. */
  readonly linkStartSeq?: number
}
export interface NativeClosedInputReason {
  readonly kind: string
  readonly cancelKind?: string
  readonly hookReasonSha256?: string
  readonly preAdmission?: true
}
export type NativeInputOwnership =
  | {status: 'pending'; ref: NativeInputRef; target: InboxTarget; index: number}
  | {status: 'claimed-before-admission'; ref: NativeInputRef; turn: number; claimSeq: number; closedReason: NativeClosedInputReason}
  | {status: 'admitted'; ref: NativeInputRef; userSeq: number; turn?: number}
  | {status: 'cancelled'; ref: NativeInputRef; cancelSeq: number; closedReason?: NativeClosedInputReason}
  | {status: 'unknown'; ref: NativeInputRef; code: string; closedReason?: NativeClosedInputReason}
export interface NativeInputBlocked {
  /** Owner saves cancellation/unknown Preparation state before admit settles.
   * A pre-turn keepInbox stop has no durable native cancellation boundary;
   * this notice and the live wake latch must never be claimed as cold proof. */
  readonly code: string
  readonly stage: 'proposal' | 'claim' | 'final'
  readonly refs: readonly NativeInputRef[]
  readonly partialClaim?: Pick<NativeInputClaim, 'turn' | 'refs' | 'spliceSeqs' | 'resumed'>
}
export interface NativeExistingInputWork {
  /** Opaque owner-provided durable Preparation identity; never input text. */
  readonly preparation: unknown
  readonly refs: readonly NativeInputRef[]
}
export interface NativeInputAdmissionHook {
  readonly schemaVersion?: 1
  /** Core persists Preparation and checks exact signal/cause before settling.
   * No same-Agent idle wait, lookup, imported Source lock or provider work here. */
  admit(proposal: NativeInputProposal, signal: AbortSignal, existing?: NativeExistingInputWork): Promise<
    | {kind: 'blocked'; code: string}
    | {kind: 'allow'; identity: unknown}
    | {kind: 'resume'; identity: unknown; refs: readonly NativeInputRef[]}
  >
  /** Synchronous owner identity/readiness assertion. Every gated claim and
   * empty inbox continuation checks before assembly, after preparation and
   * immediately before provider dispatch.
   * Always validate current Source/head/Preparation and the original work,
   * even with empty messages; internal context must not replace that work. */
  check(input: {proposal: NativeInputProposal; claim: NativeInputClaim; identity: unknown;
    messages: readonly UserMessage[]; continuation?: true}): {kind: 'allow'} | {kind: 'blocked'; code: string}
  /** Notification after driver release; owner handles any async recovery/errors. */
  onBlocked?(notice: NativeInputBlocked): void
}
/** Native structural/durable association; neither readiness nor a Core stop receipt.
 * Cold reconstruction proves stored events, not an earlier flush/callback ack.
 * The owner must separately match its persisted checkpoint association and stop
 * state. Missing/unknown owner acknowledgement remains blocked. */
export interface NativeDurableInputWorkReceiptV1 {
  readonly schemaVersion: 1
  readonly sessionId: string
  readonly workSha256: string
  readonly preparation: NativePreparationReceiptV1
  readonly refs: readonly NativeInputRef[]
  readonly actualTurn: number
  readonly startSeq: number
  readonly firstStepStartSeq: number
  readonly claimSpliceSeqs: readonly number[]
}
export interface NativeDurableInputWorkSelector {
  readonly preparation: NativePreparationReceiptV1
  readonly refs: readonly NativeInputRef[]
}
export type NativeDurableInputWorkLookup =
  | {status: 'recoverable' | 'admitted' | 'cancelled'; receipt: NativeDurableInputWorkReceiptV1;
      closedReason: NativeClosedInputReason}
  | {status: 'unknown'; code: string}
export interface NativeExistingInputWorkV2 extends NativeDurableInputWorkSelector {
  /** Selector only: native rechecks the actual latest start and full history. */
  readonly receipt: NativeDurableInputWorkReceiptV1
}
export interface NativeInputAdmissionCheckV2 {
  readonly proposal: NativeInputProposal
  readonly claim: NativeInputClaim
  readonly identity: unknown
  readonly preparation: NativePreparationReceiptV1
  readonly receipt?: NativeDurableInputWorkReceiptV1
  readonly messages: readonly UserMessage[]
  readonly continuation?: true
  /** Hot, owner-nominated internal claims under the unchanged original work.
   * This is not another durable checkpoint or a cold recovery permission. */
  readonly supplement?: NativeInputSupplementV1
}
export interface NativeOwnedContinuationControlV1 {
  steerOwnedContinuation(message:UserMessage,scope:{parent:NativeDurableInputWorkReceiptV1;ownerToken:object}):
    | {kind:'inserted';ref:NativeInputRef}
    | {kind:'blocked';code:string;insertedRef?:NativeInputRef}
}
export interface NativeInputSupplementClaimV1 {
  readonly claim:NativeInputClaim
  readonly ownerTokens:readonly object[]
}
export interface NativeInputSupplementV1 {
  readonly parent:NativeDurableInputWorkReceiptV1
  readonly turn:number
  readonly step:number
  readonly proposal:NativeInputProposal
  readonly claims:readonly NativeInputSupplementClaimV1[]
}
export interface NativeInputSupplementProposalV1 {
  readonly parent:NativeDurableInputWorkReceiptV1
  readonly turn:number
  readonly step:number
  readonly proposal:NativeInputProposal
  readonly nominations:readonly {ref:NativeInputRef;ownerToken:object}[]
}
/** Actual closed original work, minted only after this successful Native
 * flush. Stored history alone cannot recreate this hot acknowledgement. */
export interface NativeCompletedInputWorkReceiptV1 {
  readonly schemaVersion: 1
  readonly checkpoint: NativeDurableInputWorkReceiptV1
  readonly turnEndSeq: number
  readonly turnEndSha256: string
  readonly admittedUsers: readonly {ref: NativeInputRef; userSeq: number}[]
  readonly flushed: true
}
export type NativeCompletedInputWorkAcknowledgementV1 = {
  readonly kind: 'settled'
  readonly receiptSha256: string
  readonly ownerReceiptSha256: string
} | {readonly kind: 'blocked' | 'unknown'; readonly receiptSha256: string; readonly code: string}
export type NativeInputCompletionLookupV1 = {readonly status: 'none'}
  | {readonly status: 'pending' | 'settled' | 'blocked' | 'unknown';
      readonly checkpoint: NativeDurableInputWorkReceiptV1;
      readonly receipt?: NativeCompletedInputWorkReceiptV1;
      readonly code?: string; readonly ownerReceiptSha256?: string}
export interface NativeInputAdmissionHookV2 {
  readonly schemaVersion: 2
  admit(proposal: NativeInputProposal, signal: AbortSignal, existing?: NativeExistingInputWorkV2): Promise<
    | {kind: 'blocked'; code: string}
    | {kind: 'allow'; identity: unknown; preparation: NativePreparationReceiptV1;
        ownedContinuations?: true; completedWorkRequired?: true}
    | {kind: 'resume'; identity: unknown; preparation: NativePreparationReceiptV1;
        refs: readonly NativeInputRef[]; ownedContinuations?: true; completedWorkRequired?: true}
  >
  /** Checks Source/head/Preparation/stop independently of native structural proof. */
  check(input: NativeInputAdmissionCheckV2): {kind: 'allow'} | {kind: 'blocked'; code: string}
  /** Called after actual first step/start and successful native flush, before
   * request preparation. Save the association and exact cancellation state;
   * never await this Agent's idle or interpret this receipt as readiness. */
  checkpoint(receipt: NativeDurableInputWorkReceiptV1, signal: AbortSignal): Promise<{kind: 'allow'} | {kind: 'blocked'; code: string}>
  /** Optional pair. The private control only inserts into the already-running
   * owner's next step; it never clears a stop latch or wakes a driver. */
  onContinuationControl?(control:NativeOwnedContinuationControlV1):void
  recognizeSupplement?(input:NativeInputSupplementProposalV1):{kind:'allow'} | {kind:'blocked';code:string}
  /** Awaited after the unique completed turn/end and actual flush, before
   * the next turn or idle. Never wait Agent idle. Keep awaiting this actual
   * operation after cancellation: irreversible writes may still settle. */
  completedWork?(receipt: NativeCompletedInputWorkReceiptV1, signal: AbortSignal):
    Promise<NativeCompletedInputWorkAcknowledgementV1>
  /** Invoked synchronously by external cancel, including idle/disposal. Revoke
   * owner readiness before the first await, then persist the terminal stop.
   * Match the original work and cancellation generation even when admit or
   * checkpoint is still pending. Never await this Agent's idle or its stop
   * barrier here: this callback owns the acknowledgement they await.
   * An acknowledgement is the owner's assertion, not native durable proof. */
  onStop?(notice: NativeInputStopNoticeV1): Promise<NativeInputStopAcknowledgementV1>
  onBlocked?(notice: NativeInputBlocked): void
}
export interface NativeInputStopNoticeV1 {
  readonly schemaVersion: 1
  readonly sessionId: string
  readonly stopSequence: number
  readonly stopNonce: string
  readonly cause: {readonly kind: 'user' | 'parent' | 'disposed' | 'hook'; readonly hookReasonSha256?: string}
  readonly keepInbox: boolean
  readonly phase: 'idle' | 'maintenance' | 'running'
  /** Original owned and pending inbox refs, captured before cancellation. */
  readonly refs: readonly NativeInputRef[]
  readonly refsCode?: 'INPUT_OWNERSHIP_UNKNOWN'
  readonly preparation?: NativePreparationReceiptV1
  /** Actual native checkpoint association; never Core readiness/stop proof.
   * During resume this can identify the prior checkpoint until the new one
   * occurs; it must not be interpreted as the resumed turn's checkpoint. */
  readonly receipt?: NativeDurableInputWorkReceiptV1
}
export type NativeInputStopAcknowledgementV1 = {
  readonly schemaVersion: 1
  readonly stopSequence: number
  readonly stopNonce: string
} & ({readonly kind: 'acknowledged'} | {readonly kind: 'unknown'; readonly code: string})
/** Hot cancellation status only. Cold recovery must read the owner's persisted
 * stop, not a previous process's notice, native association or callback. */
export type NativeInputStopLookupV1 = {readonly status: 'none'}
  | {readonly status: 'pending' | 'acknowledged'; readonly notice: NativeInputStopNoticeV1}
  | {readonly status: 'unknown'; readonly notice: NativeInputStopNoticeV1; readonly code: string}
export interface NativeInputStopCapabilityV1 {
  readonly nativeInputStopVersion: 1
  lookupInputStop(): NativeInputStopLookupV1
  /** Waits all cancellation generations observed while waiting; never waits
   * this Agent's driver. A never-settling owner ACK remains pending. */
  whenInputStopSettled(): Promise<NativeInputStopLookupV1>
}
export interface NativeInputAdmissionCapabilityV2 {
  readonly nativeInputAdmissionVersion: 2
  registerInputAdmission(hook: NativeInputAdmissionHookV2): () => void
  lookupInputOwnership(ref: NativeInputRef): NativeInputOwnership
  /** Refolds actual events. A hot query is not an I/O barrier or Core readiness.
   * Even recoverable requires the owner's exact persisted checkpoint/credential,
   * current Source/head/token and stop checks before a recovery can be allowed. */
  lookupDurableInputWork(selector: NativeDurableInputWorkSelector): NativeDurableInputWorkLookup
  /** Diagnostic only; neither a Source receipt nor replay permission. */
  lookupInputCompletion(): NativeInputCompletionLookupV1
  wakePending(): NativeInputWakeResult
  wakeExistingWork(work: NativeExistingInputWorkV2): NativeInputWakeResult
}
/** Actual native Agent, returned unchanged by its owning AgentLoop service. */
export interface NativeInputAdmissionAgentV2 extends Agent, NativeInputAdmissionCapabilityV2, NativeInputStopCapabilityV1 {}
export type NativeInputWakeResult = {kind: 'started' | 'latched' | 'running' | 'empty' | 'disposed' | 'blocked'}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}
export const nativeInputSha256 = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex')
export const nativeInputWorkSha256 = (sessionId: string, preparation: NativePreparationReceiptV1,
  refs: readonly NativeInputRef[]): string => nativeInputSha256({schemaVersion: 1,
  encoding: 'native-input-work-v1', sessionId, preparation, refs})

const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
/** Copy only plain data descriptors: no getter can change owner identity between checks. */
const exactData = (value: unknown, fields: readonly string[]): Record<string, unknown> | undefined => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return undefined
  const keys = Reflect.ownKeys(value)
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key))) return undefined
  const result: Record<string, unknown> = {}
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return undefined
    result[field] = descriptor.value
  }
  return result
}
/** Accept only exact plain-data acknowledgements for the captured generation. */
export function nativeInputStopAcknowledgement(value: unknown, notice: NativeInputStopNoticeV1): NativeInputStopLookupV1 {
  try {
    const kind = value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'kind')?.value : undefined
    const row = exactData(value, ['schemaVersion', 'stopSequence', 'stopNonce', 'kind', ...(kind === 'unknown' ? ['code'] : [])])
    if (row?.['schemaVersion'] === 1 && row['stopSequence'] === notice.stopSequence && row['stopNonce'] === notice.stopNonce) {
      if (kind === 'acknowledged' && !notice.refsCode) return Object.freeze({status: 'acknowledged', notice})
      if (kind === 'unknown' && typeof row['code'] === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(row['code'])) {
        return Object.freeze({status: 'unknown', notice, code: row['code']})
      }
    }
  } catch { /* Invalid owner data cannot unlock native input. */ }
  return Object.freeze({status: 'unknown', notice, code: notice.refsCode ?? 'INPUT_STOP_ACK_INVALID'})
}
export function nativePreparationReceipt(value: unknown): NativePreparationReceiptV1 | undefined {
  try {
    const row = exactData(value, ['schemaVersion', 'namespace', 'preparationKeySha256', 'credentialSha256'])
    if (!row || row['schemaVersion'] !== 1 || typeof row['namespace'] !== 'string'
      || !/^[\x21-\x7e]{1,64}$/.test(row['namespace']) || !sha(row['preparationKeySha256']) || !sha(row['credentialSha256'])) return undefined
    return Object.freeze({schemaVersion: 1, namespace: row['namespace'],
      preparationKeySha256: row['preparationKeySha256'], credentialSha256: row['credentialSha256']})
  } catch {return undefined}
}
const linkRefs = (value: unknown, sessionId: string): readonly NativeInputRef[] | undefined => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64 || Reflect.ownKeys(value).length !== value.length + 1) return undefined
  const refs: NativeInputRef[] = []
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    const row = descriptor && Object.hasOwn(descriptor, 'value')
      ? exactData(descriptor.value, ['sessionId', 'insertSeq', 'messageId', 'messageSha256']) : undefined
    if (!row || row['sessionId'] !== sessionId || !count(row['insertSeq']) || typeof row['messageId'] !== 'string'
      || !row['messageId'].length || /[\u0000-\u001f\u007f-\u009f]/.test(row['messageId']) || !sha(row['messageSha256'])) return undefined
    refs.push(Object.freeze({sessionId, insertSeq: row['insertSeq'], messageId: row['messageId'], messageSha256: row['messageSha256']}))
  }
  if (new Set(refs.map(ref => ref.messageId)).size !== refs.length) return undefined
  return Object.freeze(refs)
}
/** Known v1 only. Unknown/malformed metadata stays in ordinary Session history. */
export function nativeInputLink(value: unknown, sessionId: string): NativeInputLinkV1 | undefined {
  try {
    const mode = value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'mode')?.value : undefined
    const fields = ['schemaVersion', 'encoding', 'preparation', 'refs', 'workSha256', 'mode',
      mode === 'claim' ? 'proposal' : 'previousStartSeq']
    const row = exactData(value, fields)
    if (!row || row['schemaVersion'] !== 1 || row['encoding'] !== 'native-input-link-v1' || !sha(row['workSha256'])) return undefined
    const preparation = nativePreparationReceipt(row['preparation']), refs = linkRefs(row['refs'], sessionId)
    if (!preparation || !refs || row['workSha256'] !== nativeInputWorkSha256(sessionId, preparation, refs)) return undefined
    let marker: NativeInputLinkV1
    if (row['mode'] === 'claim') {
      const proposal = exactData(row['proposal'], ['target', 'revision', 'stateSha256'])
      if (!proposal || !['next-turn', 'next-step'].includes(proposal['target'] as string)
        || !count(proposal['revision']) || !sha(proposal['stateSha256'])) return undefined
      marker = {schemaVersion: 1, encoding: 'native-input-link-v1', preparation, refs, workSha256: row['workSha256'], mode: 'claim',
        proposal: Object.freeze({target: proposal['target'] as InboxTarget, revision: proposal['revision'], stateSha256: proposal['stateSha256']})}
    } else if (row['mode'] === 'resume' && count(row['previousStartSeq'])) {
      marker = {schemaVersion: 1, encoding: 'native-input-link-v1', preparation, refs,
        workSha256: row['workSha256'], mode: 'resume', previousStartSeq: row['previousStartSeq']}
    } else return undefined
    if (Buffer.byteLength(JSON.stringify(marker), 'utf8') > 32768) return undefined
    return Object.freeze(marker)
  } catch {return undefined}
}
const refKey = (ref: NativeInputRef) => `${ref.insertSeq}:${ref.messageId}:${ref.messageSha256}`
const validRef = (ref: NativeInputRef): boolean => ref != null && typeof ref.sessionId === 'string'
  && typeof ref.messageId === 'string' && Number.isSafeInteger(ref.insertSeq) && ref.insertSeq >= 0
  && typeof ref.messageSha256 === 'string' && /^[a-f0-9]{64}$/.test(ref.messageSha256)
type Entry = {ref: NativeInputRef; message: UserMessage; claimSeq?: number; claimIndex?: number; turn?: number;
  cancelledSeq?: number; userSeq?: number; userTurn?: number; conflict?: boolean; inherited?: boolean}
type LinkedTurn = {turn: number; startSeq: number; present: boolean; marker?: NativeInputLinkV1;
  previousActualStartSeq?: number; proposalMatches: boolean; firstStepStartSeq?: number;
  lastStep: number; openStep?: number; badStep?: true}
type LinkProof = {receipt: NativeDurableInputWorkReceiptV1; entries: readonly Entry[]}
export interface NativeInboxHistory {
  readonly revision: number
  readonly pending: Readonly<Record<InboxTarget, readonly {ref: NativeInputRef; message: UserMessage}[]>>
  ownership(ref: NativeInputRef): NativeInputOwnership
  resume(refs: readonly NativeInputRef[]): {messages: readonly UserMessage[]; turn: number} | undefined
  ownsClaim(claim: NativeInputClaim): boolean
  durableWork(selector: NativeDurableInputWorkSelector): NativeDurableInputWorkLookup
  linkReceipt(startSeq: number): NativeDurableInputWorkReceiptV1 | undefined
  resumeLinked(receipt: NativeDurableInputWorkReceiptV1): {messages: readonly UserMessage[]; turn: number} | undefined
}

/** No live claimed notification, Core record or missing event is proof of ownership.
 * The actual inherited prefix has no child transfer proof in this event format;
 * its refs remain unknown even when their ids/bodies match a Core credential.
 * Callers must supply the actual boundary, including explicit zero for a root. */
export function inspectNativeInboxHistory(
  sessionId: string, events: readonly SessionEvent[], inheritedBoundary = Number.NaN,
): NativeInboxHistory {
  const queues: Record<InboxTarget, Entry[]> = {'next-turn': [], 'next-step': []}
  const entries = new Map<string, Entry>(), turns = new Map<number, NativeClosedInputReason>()
  const turnStarts = new Map<number, number>(), turnsWithUsers = new Set<number>()
  const linkedTurns = new Map<number, LinkedTurn>()
  let openTurn: number | undefined, revision = -1
  let invalid = !Number.isSafeInteger(inheritedBoundary) || inheritedBoundary < 0 || inheritedBoundary > events.length
  for (const event of events) {
    if (event.type === 'turn/start') {
      if (openTurn !== undefined || turns.has(event.data.turn)) invalid = true
      openTurn = event.data.turn
      const previousActualStartSeq = [...turnStarts.values()].at(-1)
      turnStarts.set(event.data.turn, event.seq)
      const marker = nativeInputLink(event.data.nativeInputLink, sessionId)
      const target = marker?.mode === 'claim' ? marker.proposal.target : 'next-turn'
      const offered = [...queues['next-step'], ...(target === 'next-turn' ? queues['next-turn'].slice(0, 1) : [])]
      const state = {'next-turn': queues['next-turn'].map(entry => entry.message), 'next-step': queues['next-step'].map(entry => entry.message)}
      linkedTurns.set(event.seq, {turn: event.data.turn, startSeq: event.seq,
        previousActualStartSeq, lastStep: 0,
        present: Object.hasOwn(event.data, 'nativeInputLink'), marker,
        proposalMatches: marker?.mode === 'claim' && marker.proposal.revision === revision
          && marker.proposal.stateSha256 === nativeInputSha256(state)
          && nativeInputSha256(marker.refs) === nativeInputSha256(offered.map(entry => entry.ref))})
    } else if (event.type === 'step/start' || event.type === 'step/end') {
      const startSeq = turnStarts.get(event.data.turn), linked = startSeq === undefined ? undefined : linkedTurns.get(startSeq)
      if (linked) {
        if (openTurn !== event.data.turn) linked.badStep = true
        if (event.type === 'step/start') {
          if (linked.openStep !== undefined || event.data.step !== linked.lastStep + 1) linked.badStep = true
          linked.openStep = event.data.step
          if (event.data.step === 1) {
            if (linked.firstStepStartSeq !== undefined) linked.badStep = true
            else linked.firstStepStartSeq = event.seq
          }
        } else {
          if (linked.openStep !== event.data.step) linked.badStep = true
          linked.openStep = undefined
          linked.lastStep = event.data.step
        }
      }
    } else if (event.type === 'turn/end') {
      if (openTurn !== event.data.turn || turns.has(event.data.turn)) invalid = true
      const startSeq = turnStarts.get(event.data.turn), linked = startSeq === undefined ? undefined : linkedTurns.get(startSeq)
      if (linked?.openStep !== undefined) linked.badStep = true
      const reason = event.data.reason
      turns.set(event.data.turn, {kind: reason.kind,
        ...(reason.kind === 'aborted' ? {cancelKind: reason.reason.kind,
          ...(reason.reason.kind === 'hook' ? {hookReasonSha256: nativeInputSha256(reason.reason.reason),
            ...(reason.reason.reason === INPUT_ADMISSION_ABORT_REASON ? {preAdmission: true as const} : {})} : {})} : {})})
      openTurn = undefined
    } else if (event.type === 'agent/inbox/spliced') {
      revision = event.seq
      const splice = event.data, queue = queues[splice.target], count = splice.removedCount ?? 0
      if (!queue || !Number.isSafeInteger(splice.start) || splice.start < 0 || splice.start > queue.length
        || !Number.isSafeInteger(count) || count < 0 || splice.start + count > queue.length) {invalid = true; continue}
      for (const [index, entry] of queue.slice(splice.start, splice.start + count).entries()) {
        if (splice.outcome === 'canceled') entry.cancelledSeq = event.seq
        else {entry.claimSeq = event.seq; entry.claimIndex = index; entry.turn = openTurn}
      }
      const inserted = splice.inserted.map(message => {
        const ref = {sessionId, insertSeq: event.seq, messageId: message.id, messageSha256: nativeInputSha256(message)}
        const entry: Entry = {ref, message, inherited: event.seq < inheritedBoundary}
        if (entries.has(refKey(ref))) invalid = true
        entries.set(refKey(ref), entry)
        return entry
      })
      queue.splice(splice.start, count, ...inserted)
      const ids = [...queues['next-turn'], ...queues['next-step']].map(entry => entry.message.id)
      if (new Set(ids).size !== ids.length) invalid = true
    } else if (event.type === 'user/message') {
      if (openTurn !== undefined) turnsWithUsers.add(openTurn)
      const sameId = [...entries.values()].filter(entry => entry.ref.messageId === event.data.id)
      const fingerprint = nativeInputSha256(event.data)
      for (const entry of sameId) if (entry.ref.messageSha256 !== fingerprint) entry.conflict = true
      const matching = sameId.filter(entry => entry.ref.messageSha256 === fingerprint)
      if (matching.length > 1) for (const entry of matching) entry.conflict = true
      if (matching.length === 1) {
        const entry = matching[0]
        if (!entry) {invalid = true; continue}
        if (entry.userSeq !== undefined || entry.cancelledSeq !== undefined || entry.claimSeq === undefined) entry.conflict = true
        entry.userSeq = event.seq; entry.userTurn = openTurn
      }
    }
  }
  const sameRefs = (left: readonly NativeInputRef[], right: readonly NativeInputRef[]) => nativeInputSha256(left) === nativeInputSha256(right)
  const proofAt = (startSeq: number, requireStep = true): LinkProof | undefined => {
    const linked = linkedTurns.get(startSeq), marker = linked?.marker
    if (invalid || !linked || !marker) return undefined
    // Walk actual previous starts rather than recurse on caller metadata. This
    // fold is temporary history interpretation, not a second driver queue.
    let current = linked
    const visited = new Set<number>()
    while (true) {
      const currentMarker = current.marker
      if (!currentMarker || current.startSeq < inheritedBoundary || visited.has(current.startSeq) || current.badStep
        || (current !== linked || requireStep) && current.firstStepStartSeq === undefined) return undefined
      visited.add(current.startSeq)
      if (currentMarker.mode === 'claim') break
      if (currentMarker.previousStartSeq >= current.startSeq
        || current.previousActualStartSeq !== currentMarker.previousStartSeq) return undefined
      const previous = linkedTurns.get(currentMarker.previousStartSeq), previousMarker = previous?.marker
      if (!previous || !previousMarker || previousMarker.workSha256 !== currentMarker.workSha256
        || !sameRefs(previousMarker.refs, currentMarker.refs)
        || nativeInputSha256(previousMarker.preparation) !== nativeInputSha256(currentMarker.preparation)
        || !turns.get(previous.turn)?.preAdmission || turnsWithUsers.has(previous.turn)) return undefined
      current = previous
    }
    if (!current.proposalMatches || current.firstStepStartSeq === undefined) return undefined
    const original = [...entries.values()].filter(entry => entry.turn === current.turn
      && entry.claimSeq !== undefined && entry.claimSeq > current.startSeq && entry.claimSeq < current.firstStepStartSeq!)
      .sort((left, right) => left.claimSeq! - right.claimSeq! || left.claimIndex! - right.claimIndex!)
    if (!sameRefs(original.map(entry => entry.ref), marker.refs)) return undefined
    if (original.length !== marker.refs.length || original.some(entry => entry.inherited || entry.conflict
      || entry.cancelledSeq !== undefined || entry.claimSeq === undefined || entry.claimSeq < inheritedBoundary)) return undefined
    const firstStepStartSeq = linked.firstStepStartSeq ?? -1
    return {entries: original, receipt: {schemaVersion: 1, sessionId, workSha256: marker.workSha256,
      preparation: marker.preparation, refs: marker.refs, actualTurn: linked.turn, startSeq,
      firstStepStartSeq, claimSpliceSeqs: [...new Set(original.map(entry => entry.claimSeq!))]}}
  }
  const durableWork = (selector: NativeDurableInputWorkSelector): NativeDurableInputWorkLookup => {
    let preparation: NativePreparationReceiptV1 | undefined, refs: readonly NativeInputRef[] | undefined
    try {preparation = nativePreparationReceipt(selector?.preparation); refs = linkRefs(selector?.refs, sessionId)} catch {}
    if (!preparation || !refs) return {status: 'unknown', code: 'INPUT_LINK_SELECTOR_INVALID'}
    const workSha256 = nativeInputWorkSha256(sessionId, preparation, refs)
    const latest = [...turnStarts.values()].at(-1), proof = latest === undefined ? undefined : proofAt(latest)
    if (!proof || proof.receipt.workSha256 !== workSha256 || !sameRefs(proof.receipt.refs, refs)) {
      return {status: 'unknown', code: 'INPUT_LINK_HISTORY_UNKNOWN'}
    }
    const closedReason = turns.get(proof.receipt.actualTurn)
    if (!closedReason || openTurn !== undefined) return {status: 'unknown', code: 'INPUT_LINK_OPEN_TURN'}
    if (turnsWithUsers.has(proof.receipt.actualTurn)) {
      if (!proof.entries.every(entry => entry.userTurn === proof.receipt.actualTurn && entry.userSeq !== undefined)) {
        return {status: 'unknown', code: 'INPUT_LINK_OTHER_ADMISSION'}
      }
      return {status: 'admitted', receipt: proof.receipt, closedReason}
    }
    if (closedReason.kind === 'aborted' && ['user', 'parent', 'disposed'].includes(closedReason.cancelKind ?? '')) {
      return {status: 'cancelled', receipt: proof.receipt, closedReason}
    }
    if (!closedReason.preAdmission) return {status: 'unknown', code: 'INPUT_LINK_CLOSE_NOT_PROVEN'}
    return {status: 'recoverable', receipt: proof.receipt, closedReason}
  }
  const ownership = (ref: NativeInputRef): NativeInputOwnership => {
    if (!validRef(ref)) return {status: 'unknown', ref, code: 'INPUT_REF_INVALID'}
    const entry = entries.get(refKey(ref))
    if (ref.sessionId !== sessionId || !entry || invalid || entry.conflict) return {status: 'unknown', ref, code: 'INPUT_HISTORY_UNKNOWN'}
    if (entry.inherited || entry.claimSeq !== undefined && entry.claimSeq < inheritedBoundary) {
      return {status: 'unknown', ref, code: 'INPUT_INHERITED_OWNERSHIP_UNPROVEN'}
    }
    const entryStart = entry.turn === undefined ? undefined : turnStarts.get(entry.turn)
    const linked = entryStart === undefined ? undefined : linkedTurns.get(entryStart)
    if (linked?.present && !linked.marker) return {status: 'unknown', ref, code: 'INPUT_LINK_METADATA_UNKNOWN'}
    if (entry.userSeq !== undefined) return {status: 'admitted', ref, userSeq: entry.userSeq, turn: entry.userTurn}
    if (entry.cancelledSeq !== undefined) return {status: 'cancelled', ref, cancelSeq: entry.cancelledSeq}
    for (const target of ['next-turn', 'next-step'] as const) {
      const index = queues[target].indexOf(entry)
      if (index >= 0) return {status: 'pending', ref, target, index}
    }
    const closedReason = entry.turn === undefined ? undefined : turns.get(entry.turn)
    if (!closedReason) return {status: 'unknown', ref, code: 'INPUT_OPEN_OR_UNATTRIBUTED_TURN'}
    if (closedReason.kind === 'aborted' && ['user', 'parent', 'disposed'].includes(closedReason.cancelKind ?? '')) {
      return {status: 'cancelled', ref, cancelSeq: entry.claimSeq!, closedReason}
    }
    if (entry.turn !== undefined && turnsWithUsers.has(entry.turn)) {
      return {status: 'unknown', ref, code: 'INPUT_TURN_HAS_OTHER_ADMISSION', closedReason}
    }
    // A zero-insertion resumed turn leaves no new inbox claim linkage. Once
    // another turn exists, an old gate reason cannot attest that later work
    // stopped safely. Core durable ownership is outside this history format.
    if (entry.claimSeq !== undefined && [...turnStarts.values()].some(seq => seq > entry.claimSeq!)) {
      return {status: 'unknown', ref, code: 'INPUT_LATER_TURN_NOT_BOUND', closedReason}
    }
    if (closedReason.preAdmission && entry.turn !== undefined && entry.claimSeq !== undefined) {
      return {status: 'claimed-before-admission', ref, turn: entry.turn, claimSeq: entry.claimSeq, closedReason}
    }
    return {status: 'unknown', ref, code: 'INPUT_CLOSED_WITHOUT_ADMISSION_PROOF', closedReason}
  }
  return {revision, pending: queues, ownership, durableWork, linkReceipt(startSeq) {
    if ([...turnStarts.values()].at(-1) !== startSeq) return undefined
    return proofAt(startSeq)?.receipt
  }, resumeLinked(receipt) {
    const lookup = durableWork(receipt)
    if (lookup.status !== 'recoverable' || nativeInputSha256(lookup.receipt) !== nativeInputSha256(receipt)) return undefined
    const proof = proofAt(receipt.startSeq)
    return proof && {turn: receipt.actualTurn, messages: proof.entries.map(entry => structuredClone(entry.message))}
  }, ownsClaim(claim) {
    if (invalid || !claim.refs.length || claim.refs.length !== claim.messages.length
      || [...turnStarts.keys()].at(-1) !== claim.turn) return false
    if (claim.resumed && claim.linkStartSeq !== undefined) {
      const proof = proofAt(claim.linkStartSeq, false)
      if (!proof || proof.receipt.actualTurn !== claim.turn || !sameRefs(proof.receipt.refs, claim.refs)) return false
    }
    return claim.refs.every((ref, index) => {
      if (!validRef(ref) || ref.sessionId !== sessionId) return false
      const entry = entries.get(refKey(ref))
      if (!entry || entry.inherited || entry.conflict || entry.cancelledSeq !== undefined || entry.claimSeq === undefined
        || entry.claimSeq < inheritedBoundary
        || nativeInputSha256(claim.messages[index]) !== entry.ref.messageSha256) return false
      if (!claim.resumed) return entry.turn === claim.turn && claim.spliceSeqs.includes(entry.claimSeq)
      return entry.turn !== undefined && turns.get(entry.turn)?.preAdmission === true && !turnsWithUsers.has(entry.turn)
    })
  }, resume(refs) {
    if (!Array.isArray(refs) || !refs.length || refs.some(ref => !validRef(ref))
      || new Set(refs.map(refKey)).size !== refs.length || new Set(refs.map(ref => ref.messageId)).size !== refs.length) return undefined
    const claims = refs.map(ownership)
    if (claims.some(claim => claim.status !== 'claimed-before-admission')) return undefined
    const turnsOwned = claims.map(claim => claim.status === 'claimed-before-admission' ? claim.turn : undefined)
    if (new Set(turnsOwned).size !== 1) return undefined
    // Resume the complete original claimed work, never a convenient subset.
    const turn = turnsOwned[0]!
    const original = [...entries.values()].filter(entry => entry.turn === turn)
      .sort((left, right) => left.claimSeq! - right.claimSeq! || left.claimIndex! - right.claimIndex!)
    if (original.length !== refs.length || original.some((entry, index) => refKey(entry.ref) !== refKey(refs[index]))) return undefined
    return {turn, messages: original.map(entry => structuredClone(entry.message))}
  }}
}
