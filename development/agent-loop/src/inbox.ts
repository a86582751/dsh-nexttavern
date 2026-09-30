/**
 * Driver-owned durable agent inbox projection and command facade.
 *
 * @module @deepseek-ai/dsh-agent-loop/inbox
 */

import type { MessageId } from '@deepseek-ai/dsh-llm'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import type { Session, SessionEventMap, UserMessage } from '@deepseek-ai/dsh-session'
import type {
  AgentEventDispatch,
  Inbox as InboxContract,
  InboxState,
  InboxTarget,
  InboxWireState,
} from '@deepseek-ai/dsh-agent'
import { z } from 'zod'
import {deepFreeze} from '@deepseek-ai/dsh-util-values'
import {inspectNativeInboxHistory, nativeInputLink, nativeInputSha256} from './input-admission.js'
import type {NativeDurableInputWorkLookup, NativeDurableInputWorkReceiptV1, NativeDurableInputWorkSelector,
  NativeInputClaim, NativeInputOwnership, NativeInputProposal, NativeInputRef} from './input-admission.js'

/** Process-local exact proof minted before the next native turn boundary. */
export interface NativeInputResumeProof {
  readonly proposal: NativeInputProposal
  readonly refs: readonly NativeInputRef[]
  readonly messages: readonly UserMessage[]
  readonly observedSeq: number
  readonly durable?: NativeDurableInputWorkReceiptV1
}

/** Wire validation for pending agent input reconstructed from durable inbox splices. */
export const inboxProjectionSchema = z.object({
  'next-turn': z.array(z.custom<UserMessage>()).readonly(),
  'next-step': z.array(z.custom<UserMessage>()).readonly(),
}).readonly()

/** Standard fold that reconstructs pending input and rejects invalid durable splice history. */
export const inboxProjectionDefinition = {
  key: 'inbox',
  stateSchema: inboxProjectionSchema,
  init: (): InboxState => ({ 'next-turn': [], 'next-step': [] }),
  apply(state: InboxState, event) {
    if (event.type !== 'agent/inbox/spliced') return state
    const splice = event.data
    try {
      const inbox = state[splice.target]
      const removedCount = splice.removedCount ?? 0
      if (!Number.isSafeInteger(splice.start) || splice.start < 0 || splice.start > inbox.length
        || !Number.isSafeInteger(removedCount) || removedCount < 0
        || splice.start + removedCount > inbox.length) {
        throw new Error('invalid inbox splice')
      }
      const next = inbox.toSpliced(splice.start, removedCount, ...splice.inserted)
      const ids = new Set<string>()
      for (const message of splice.target === 'next-turn'
        ? [...next, ...state['next-step']]
        : [...state['next-turn'], ...next]) {
        if (ids.has(message.id)) throw new Error(`message "${message.id}" is already pending`)
        ids.add(message.id)
      }
      return splice.target === 'next-turn'
        ? { 'next-turn': next, 'next-step': state['next-step'] }
        : { 'next-turn': state['next-turn'], 'next-step': next }
    } catch (error: unknown) {
      throw new Error(`invalid persisted inbox splice at session seq ${event.seq}`, { cause: error })
    }
  },
  wire: {
    // The wire value is the fold state itself: every pending message already
    // round-trips the session log as lossless JSON. Only the static type
    // narrows to the JSON-safe projection table entry.
    viewSchema: inboxProjectionSchema as unknown as z.ZodType<InboxWireState>,
    view: (state: InboxState) => state as unknown as InboxWireState,
  },
  stateVersion: 1,
} satisfies ProjectionDefinition<'inbox', InboxState>

/**
 * Driver-owned durable Inbox implementation used by ReactLoopAgent and focused
 * provider tests.
 * @param projections - registry with the standard Inbox projection registered by AgentLoop.
 * @param session - session whose durable events store pending input.
 * @param dispatch - agent-scoped notifications for Inbox lifecycle events.
 */
export class ReactLoopInbox implements InboxContract {
  private readonly proposals = new WeakSet<NativeInputProposal>()
  private readonly resumeProofs = new WeakSet<NativeInputResumeProof>()
  private readonly claims = new WeakSet<NativeInputClaim>()
  constructor(
    private readonly projections: SessionProjectionRegistry,
    private readonly session: Session,
    private readonly dispatch: AgentEventDispatch,
  ) {}

  /** Prompts awaiting individual turns. */
  get nextTurn(): readonly UserMessage[] {
    return this.current()['next-turn']
  }

  /** Input awaiting the next step boundary. */
  get nextStep(): readonly UserMessage[] {
    return this.current()['next-step']
  }

  /** Whether either pending-message list contains work. */
  get hasPending(): boolean {
    const state = this.current()
    return state['next-turn'].length > 0 || state['next-step'].length > 0
  }

  /** Durably cancel all pending input, clearing next-step before next-turn. */
  clear(): void {
    this.splice('next-step', 0, this.nextStep.length, [])
    this.splice('next-turn', 0, this.nextTurn.length, [])
  }

  /**
   * Remove and return the complete batch proposed for one step.
   * @param target - whether this boundary also consumes one queued turn.
   * @param turn - turn that will own the claimed batch.
   * @returns next-step input followed by the queued turn, when requested.
   */
  claim(target: InboxTarget, turn: number): UserMessage[] {
    const claimed = this.mutate('next-step', 0, this.nextStep.length, [], false)
    if (target === 'next-turn') claimed.push(...this.mutate('next-turn', 0, 1, [], false))
    for (const message of claimed) this.dispatch.emit('agent/inbox/claimed', { message, turn })
    return claimed
  }

  /** Mint an exact proposal without consuming or assembling any input. */
  propose(target: InboxTarget): NativeInputProposal {
    const state = this.current(), history = this.history()
    const entries = [...history.pending['next-step'], ...(target === 'next-turn' ? history.pending['next-turn'].slice(0, 1) : [])]
    const messages = [...state['next-step'], ...(target === 'next-turn' ? state['next-turn'].slice(0, 1) : [])]
    if (nativeInputSha256(entries.map(entry => entry.message)) !== nativeInputSha256(messages)
      || entries.some(entry => history.ownership(entry.ref).status !== 'pending')) throw Error('native input ownership is unknown')
    const proposal = deepFreeze({target, revision: history.revision, stateSha256: nativeInputSha256(state),
      messages: structuredClone(messages), refs: entries.map(entry => structuredClone(entry.ref))})
    this.proposals.add(proposal)
    return proposal
  }

  matches(proposal: NativeInputProposal): boolean {
    return this.proposals.has(proposal) && proposal.revision === this.history().revision
      && proposal.stateSha256 === nativeInputSha256(this.current())
  }

  /** Exact consumption is checked between the two durable splices as well. */
  claimExact(proposal: NativeInputProposal, turn: number):
    | {kind: 'claimed'; claim: NativeInputClaim}
    | {kind: 'blocked'; claim: NativeInputClaim} {
    const removed: UserMessage[] = [], spliceSeqs: number[] = []
    const receipt = (): NativeInputClaim => {
      const claim = deepFreeze({proposal, turn, revision: spliceSeqs.at(-1) ?? proposal.revision,
        refs: proposal.refs.slice(0, removed.length), messages: structuredClone(removed), spliceSeqs: [...spliceSeqs], resumed: false})
      this.claims.add(claim)
      return claim
    }
    if (!this.matches(proposal)) return {kind: 'blocked', claim: receipt()}
    let expected = structuredClone(this.current()) as {'next-turn': UserMessage[]; 'next-step': UserMessage[]}
    const take = (target: InboxTarget, count: number) => {
      expected = {...expected, [target]: expected[target].slice(count)}
      removed.push(...this.mutate(target, 0, count, [], false, seq => spliceSeqs.push(seq)))
      return nativeInputSha256(this.current()) === nativeInputSha256(expected)
        && this.history().revision === (spliceSeqs.at(-1) ?? proposal.revision)
    }
    if (!take('next-step', proposal.messages.length - (proposal.target === 'next-turn' && expected['next-turn'].length ? 1 : 0))) {
      return {kind: 'blocked', claim: receipt()}
    }
    if (proposal.target === 'next-turn' && expected['next-turn'].length && !take('next-turn', 1)) {
      return {kind: 'blocked', claim: receipt()}
    }
    const claim = receipt()
    for (const message of claim.messages) this.dispatch.emit('agent/inbox/claimed', {message, turn})
    return {kind: 'claimed', claim}
  }

  matchesClaim(claim: NativeInputClaim): boolean {
    return this.claims.has(claim) && this.history().ownsClaim(claim)
  }

  lookupOwnership(ref: NativeInputRef): NativeInputOwnership {return this.history().ownership(ref)}
  lookupDurableWork(selector: NativeDurableInputWorkSelector): NativeDurableInputWorkLookup {
    return deepFreeze(structuredClone(this.history().durableWork(selector)))
  }
  linkReceipt(startSeq: number): NativeDurableInputWorkReceiptV1 | undefined {
    const receipt = this.history().linkReceipt(startSeq)
    return receipt && deepFreeze(structuredClone(receipt))
  }
  canResumeLinked(receipt: NativeDurableInputWorkReceiptV1): boolean {
    return this.history().resumeLinked(receipt) !== undefined
  }

  /** Native history supplies the original body; a caller supplies only identities. */
  prepareResume(proposal: NativeInputProposal, refs: readonly NativeInputRef[],
    durable?: NativeDurableInputWorkReceiptV1): NativeInputResumeProof | undefined {
    if (!this.matches(proposal)) return undefined
    if (durable && nativeInputSha256(durable.refs) !== nativeInputSha256(refs)) return undefined
    const work = durable ? this.history().resumeLinked(durable) : this.history().resume(refs)
    if (!work) return undefined
    const proof = deepFreeze({proposal, refs: structuredClone(refs), messages: work.messages,
      observedSeq: this.session.snapshotEvents().at(-1)?.seq ?? -1, ...(durable ? {durable: structuredClone(durable)} : {})})
    this.resumeProofs.add(proof)
    return proof
  }

  resumeClaim(proof: NativeInputResumeProof, turn: number): NativeInputClaim | undefined {
    if (!this.resumeProofs.has(proof) || !this.matches(proof.proposal)) return undefined
    const later = this.session.snapshotEvents().filter(event => event.seq > proof.observedSeq)
    const boundary = later[0]
    if (later.length !== 1 || !boundary || boundary.type !== 'turn/start' || boundary.data.turn !== turn) return undefined
    if (proof.durable) {
      const marker = nativeInputLink(boundary.data.nativeInputLink, this.session.id)
      if (marker?.mode !== 'resume' || marker.previousStartSeq !== proof.durable.startSeq
        || marker.workSha256 !== proof.durable.workSha256
        || nativeInputSha256(marker.preparation) !== nativeInputSha256(proof.durable.preparation)
        || nativeInputSha256(marker.refs) !== nativeInputSha256(proof.refs)) return undefined
    }
    this.resumeProofs.delete(proof)
    const claim = deepFreeze({proposal: proof.proposal, turn, revision: proof.proposal.revision, refs: proof.refs, messages: proof.messages,
      spliceSeqs: [], resumed: true, ...(proof.durable ? {linkStartSeq: boundary.seq} : {})})
    this.claims.add(claim)
    return claim
  }

  canResume(refs: readonly NativeInputRef[]): boolean {return this.history().resume(refs) !== undefined}

  private history() {
    // Session exposes the actual inherited seed length. Parent input never
    // acquires child ownership merely by folding it under the current id.
    const boundary = this.session.inheritedEventCount
    const inheritedBoundary = Number.isSafeInteger(boundary) && boundary >= 0 ? boundary
      : this.session.header.parentSession !== undefined ? Number.NaN : 0
    return inspectNativeInboxHistory(this.session.id, this.session.snapshotEvents(), inheritedBoundary)
  }

  /**
   * Append one message to a pending list.
   * @param target - pending list to extend.
   * @param message - message to append.
   */
  append(target: InboxTarget, message: UserMessage): void {
    this.splice(target, this.current()[target].length, 0, [message])
  }

  /** Internal owner control: observe the actual insertion before live inbox
   * notifications. Does not wake a driver or change cancellation state. */
  insertTrackedNextStep(message: UserMessage, observe: (ref: NativeInputRef) => void): void {
    this.mutate('next-step', Infinity, 0, [message], false, undefined, (seq, inserted) => {
      const actual = inserted[0]
      if (!actual || inserted.length !== 1) throw Error('native continuation insertion is unknown')
      observe(Object.freeze({sessionId: this.session.id, insertSeq: seq,
        messageId: actual.id, messageSha256: nativeInputSha256(actual)}))
    })
  }

  /**
   * Prepend one message to a pending list.
   * @param target - pending list to extend.
   * @param message - message to prepend.
   */
  prepend(target: InboxTarget, message: UserMessage): void {
    this.splice(target, 0, 0, [message])
  }

  /**
   * Replace one pending message in place.
   * @param messageId - identity of the pending message to replace.
   * @param newMessage - replacement message.
   * @returns whether the message was still pending.
   */
  replace(messageId: MessageId, newMessage: UserMessage): boolean {
    const location = this.locate(messageId)
    if (location === undefined) return false
    this.splice(location.target, location.index, 1, [newMessage])
    return true
  }

  /**
   * Remove one pending message.
   * @param messageId - identity of the pending message to remove.
   * @returns whether the message was still pending.
   */
  remove(messageId: MessageId): boolean {
    const location = this.locate(messageId)
    if (location === undefined) return false
    this.splice(location.target, location.index, 1, [])
    return true
  }

  /**
   * Apply standard splice semantics and durably record the normalized result.
   * @param target - pending list to mutate.
   * @param start - splice position.
   * @param deleteCount - maximum number of messages to remove.
   * @param inserted - messages to insert at the resolved position.
   * @returns messages removed by the splice.
   */
  splice(
    target: InboxTarget,
    start: number,
    deleteCount: number,
    inserted: UserMessage[],
  ): UserMessage[] {
    return this.mutate(target, start, deleteCount, inserted, true)
  }

  /** Locate one pending identity across both owned lists. */
  private locate(messageId: MessageId): { target: InboxTarget; index: number } | undefined {
    const state = this.current()
    for (const target of ['next-turn', 'next-step'] as const) {
      const index = state[target].findIndex(message => message.id === messageId)
      if (index >= 0) return { target, index }
    }
    return undefined
  }

  /** Read the current durable projection state. */
  private current(): InboxState {
    const state = this.projections.stateOf(this.session, 'inbox')
    if (state === undefined) {
      throw new Error(
        `agent "${this.session.id}" cannot read inbox state: its projection registration is not active`,
      )
    }
    return state
  }

  /** Commit one normalized mutation and publish its live events. */
  private mutate(
    target: InboxTarget,
    start: number,
    deleteCount: number,
    inserted: UserMessage[],
    discardRemoved: boolean,
    recordSeq?: (seq: number) => void,
    recordInserted?: (seq: number, messages: readonly UserMessage[]) => void,
  ): UserMessage[] {
    const state = this.current()
    const inbox = state[target]
    const truncatedStart = Math.trunc(start)
    const offset = Number.isNaN(truncatedStart) ? 0 : truncatedStart
    const actualStart = offset < 0
      ? Math.max(inbox.length + offset, 0)
      : Math.min(offset, inbox.length)
    const truncatedDeleteCount = Math.trunc(deleteCount)
    const actualDeleteCount = Math.min(
      Math.max(Number.isNaN(truncatedDeleteCount) ? 0 : truncatedDeleteCount, 0),
      inbox.length - actualStart,
    )
    if (actualDeleteCount === 0 && inserted.length === 0) return []
    const candidate = inbox.toSpliced(actualStart, actualDeleteCount, ...inserted)
    const ids = new Set<string>()
    for (const message of target === 'next-turn'
      ? [...candidate, ...state['next-step']]
      : [...state['next-turn'], ...candidate]) {
      if (ids.has(message.id)) throw new Error(`message "${message.id}" is already pending`)
      ids.add(message.id)
    }
    const outcome = discardRemoved && actualDeleteCount > 0 ? 'canceled' as const : undefined
    const splice: SessionEventMap['agent/inbox/spliced'] = {
      target,
      start: actualStart,
      ...(actualDeleteCount === 0 ? {} : { removedCount: actualDeleteCount }),
      inserted,
      ...(outcome === undefined ? {} : { outcome }),
    }
    const removed = inbox.slice(actualStart, actualStart + actualDeleteCount)
    const event = this.session.append('agent/inbox/spliced', splice)
    recordSeq?.(event.seq)
    recordInserted?.(event.seq, event.data.inserted)
    if (discardRemoved) {
      for (const message of removed) this.dispatch.emit('agent/inbox/discarded', { message })
    }
    for (const message of event.data.inserted) {
      this.dispatch.emit('agent/inbox/inserted', { message })
    }
    return removed
  }
}
