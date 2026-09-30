// Generated from runtime/alpha3/compat/agent-loop/src/inbox.ts; edit the TypeScript source.
/**
 * Driver-owned durable agent inbox projection and command facade.
 *
 * @module @deepseek-ai/dsh-agent-loop/inbox
 */
import { z } from 'zod';
import { deepFreeze } from '@deepseek-ai/dsh-util-values';
import { inspectNativeInboxHistory, nativeInputSha256 } from './input-admission.js';
/** Wire validation for pending agent input reconstructed from durable inbox splices. */
export const inboxProjectionSchema = z.object({
    'next-turn': z.array(z.custom()).readonly(),
    'next-step': z.array(z.custom()).readonly(),
}).readonly();
/** Standard fold that reconstructs pending input and rejects invalid durable splice history. */
export const inboxProjectionDefinition = {
    key: 'inbox',
    stateSchema: inboxProjectionSchema,
    init: () => ({ 'next-turn': [], 'next-step': [] }),
    apply(state, event) {
        if (event.type !== 'agent/inbox/spliced')
            return state;
        const splice = event.data;
        try {
            const inbox = state[splice.target];
            const removedCount = splice.removedCount ?? 0;
            if (!Number.isSafeInteger(splice.start) || splice.start < 0 || splice.start > inbox.length
                || !Number.isSafeInteger(removedCount) || removedCount < 0
                || splice.start + removedCount > inbox.length) {
                throw new Error('invalid inbox splice');
            }
            const next = inbox.toSpliced(splice.start, removedCount, ...splice.inserted);
            const ids = new Set();
            for (const message of splice.target === 'next-turn'
                ? [...next, ...state['next-step']]
                : [...state['next-turn'], ...next]) {
                if (ids.has(message.id))
                    throw new Error(`message "${message.id}" is already pending`);
                ids.add(message.id);
            }
            return splice.target === 'next-turn'
                ? { 'next-turn': next, 'next-step': state['next-step'] }
                : { 'next-turn': state['next-turn'], 'next-step': next };
        }
        catch (error) {
            throw new Error(`invalid persisted inbox splice at session seq ${event.seq}`, { cause: error });
        }
    },
    wire: {
        // The wire value is the fold state itself: every pending message already
        // round-trips the session log as lossless JSON. Only the static type
        // narrows to the JSON-safe projection table entry.
        viewSchema: inboxProjectionSchema,
        view: (state) => state,
    },
    stateVersion: 1,
};
/**
 * Driver-owned durable Inbox implementation used by ReactLoopAgent and focused
 * provider tests.
 * @param projections - registry with the standard Inbox projection registered by AgentLoop.
 * @param session - session whose durable events store pending input.
 * @param dispatch - agent-scoped notifications for Inbox lifecycle events.
 */
export class ReactLoopInbox {
    projections;
    session;
    dispatch;
    proposals = new WeakSet();
    resumeProofs = new WeakSet();
    claims = new WeakSet();
    constructor(projections, session, dispatch) {
        this.projections = projections;
        this.session = session;
        this.dispatch = dispatch;
    }
    /** Prompts awaiting individual turns. */
    get nextTurn() {
        return this.current()['next-turn'];
    }
    /** Input awaiting the next step boundary. */
    get nextStep() {
        return this.current()['next-step'];
    }
    /** Whether either pending-message list contains work. */
    get hasPending() {
        const state = this.current();
        return state['next-turn'].length > 0 || state['next-step'].length > 0;
    }
    /** Durably cancel all pending input, clearing next-step before next-turn. */
    clear() {
        this.splice('next-step', 0, this.nextStep.length, []);
        this.splice('next-turn', 0, this.nextTurn.length, []);
    }
    /**
     * Remove and return the complete batch proposed for one step.
     * @param target - whether this boundary also consumes one queued turn.
     * @param turn - turn that will own the claimed batch.
     * @returns next-step input followed by the queued turn, when requested.
     */
    claim(target, turn) {
        const claimed = this.mutate('next-step', 0, this.nextStep.length, [], false);
        if (target === 'next-turn')
            claimed.push(...this.mutate('next-turn', 0, 1, [], false));
        for (const message of claimed)
            this.dispatch.emit('agent/inbox/claimed', { message, turn });
        return claimed;
    }
    /** Mint an exact proposal without consuming or assembling any input. */
    propose(target) {
        const state = this.current(), history = this.history();
        const entries = [...history.pending['next-step'], ...(target === 'next-turn' ? history.pending['next-turn'].slice(0, 1) : [])];
        const messages = [...state['next-step'], ...(target === 'next-turn' ? state['next-turn'].slice(0, 1) : [])];
        if (nativeInputSha256(entries.map(entry => entry.message)) !== nativeInputSha256(messages)
            || entries.some(entry => history.ownership(entry.ref).status !== 'pending'))
            throw Error('native input ownership is unknown');
        const proposal = deepFreeze({ target, revision: history.revision, stateSha256: nativeInputSha256(state),
            messages: structuredClone(messages), refs: entries.map(entry => structuredClone(entry.ref)) });
        this.proposals.add(proposal);
        return proposal;
    }
    matches(proposal) {
        return this.proposals.has(proposal) && proposal.revision === this.history().revision
            && proposal.stateSha256 === nativeInputSha256(this.current());
    }
    /** Exact consumption is checked between the two durable splices as well. */
    claimExact(proposal, turn) {
        const removed = [], spliceSeqs = [];
        const receipt = () => {
            const claim = deepFreeze({ proposal, turn, revision: spliceSeqs.at(-1) ?? proposal.revision,
                refs: proposal.refs.slice(0, removed.length), messages: structuredClone(removed), spliceSeqs: [...spliceSeqs], resumed: false });
            this.claims.add(claim);
            return claim;
        };
        if (!this.matches(proposal))
            return { kind: 'blocked', claim: receipt() };
        let expected = structuredClone(this.current());
        const take = (target, count) => {
            expected = { ...expected, [target]: expected[target].slice(count) };
            removed.push(...this.mutate(target, 0, count, [], false, seq => spliceSeqs.push(seq)));
            return nativeInputSha256(this.current()) === nativeInputSha256(expected)
                && this.history().revision === (spliceSeqs.at(-1) ?? proposal.revision);
        };
        if (!take('next-step', proposal.messages.length - (proposal.target === 'next-turn' && expected['next-turn'].length ? 1 : 0))) {
            return { kind: 'blocked', claim: receipt() };
        }
        if (proposal.target === 'next-turn' && expected['next-turn'].length && !take('next-turn', 1)) {
            return { kind: 'blocked', claim: receipt() };
        }
        const claim = receipt();
        for (const message of claim.messages)
            this.dispatch.emit('agent/inbox/claimed', { message, turn });
        return { kind: 'claimed', claim };
    }
    matchesClaim(claim) {
        return this.claims.has(claim) && this.history().ownsClaim(claim);
    }
    lookupOwnership(ref) { return this.history().ownership(ref); }
    /** Native history supplies the original body; a caller supplies only identities. */
    prepareResume(proposal, refs) {
        if (!this.matches(proposal))
            return undefined;
        const work = this.history().resume(refs);
        if (!work)
            return undefined;
        const proof = deepFreeze({ proposal, refs: structuredClone(refs), messages: work.messages,
            observedSeq: this.session.snapshotEvents().at(-1)?.seq ?? -1 });
        this.resumeProofs.add(proof);
        return proof;
    }
    resumeClaim(proof, turn) {
        if (!this.resumeProofs.has(proof) || !this.matches(proof.proposal))
            return undefined;
        const later = this.session.snapshotEvents().filter(event => event.seq > proof.observedSeq);
        const boundary = later[0];
        if (later.length !== 1 || !boundary || boundary.type !== 'turn/start' || boundary.data.turn !== turn)
            return undefined;
        this.resumeProofs.delete(proof);
        const claim = deepFreeze({ proposal: proof.proposal, turn, revision: proof.proposal.revision, refs: proof.refs, messages: proof.messages,
            spliceSeqs: [], resumed: true });
        this.claims.add(claim);
        return claim;
    }
    canResume(refs) { return this.history().resume(refs) !== undefined; }
    history() {
        // Session exposes the actual inherited seed length. Parent input never
        // acquires child ownership merely by folding it under the current id.
        const boundary = this.session.inheritedEventCount;
        const inheritedBoundary = Number.isSafeInteger(boundary) && boundary >= 0 ? boundary
            : this.session.header.parentSession !== undefined ? Number.NaN : 0;
        return inspectNativeInboxHistory(this.session.id, this.session.snapshotEvents(), inheritedBoundary);
    }
    /**
     * Append one message to a pending list.
     * @param target - pending list to extend.
     * @param message - message to append.
     */
    append(target, message) {
        this.splice(target, this.current()[target].length, 0, [message]);
    }
    /**
     * Prepend one message to a pending list.
     * @param target - pending list to extend.
     * @param message - message to prepend.
     */
    prepend(target, message) {
        this.splice(target, 0, 0, [message]);
    }
    /**
     * Replace one pending message in place.
     * @param messageId - identity of the pending message to replace.
     * @param newMessage - replacement message.
     * @returns whether the message was still pending.
     */
    replace(messageId, newMessage) {
        const location = this.locate(messageId);
        if (location === undefined)
            return false;
        this.splice(location.target, location.index, 1, [newMessage]);
        return true;
    }
    /**
     * Remove one pending message.
     * @param messageId - identity of the pending message to remove.
     * @returns whether the message was still pending.
     */
    remove(messageId) {
        const location = this.locate(messageId);
        if (location === undefined)
            return false;
        this.splice(location.target, location.index, 1, []);
        return true;
    }
    /**
     * Apply standard splice semantics and durably record the normalized result.
     * @param target - pending list to mutate.
     * @param start - splice position.
     * @param deleteCount - maximum number of messages to remove.
     * @param inserted - messages to insert at the resolved position.
     * @returns messages removed by the splice.
     */
    splice(target, start, deleteCount, inserted) {
        return this.mutate(target, start, deleteCount, inserted, true);
    }
    /** Locate one pending identity across both owned lists. */
    locate(messageId) {
        const state = this.current();
        for (const target of ['next-turn', 'next-step']) {
            const index = state[target].findIndex(message => message.id === messageId);
            if (index >= 0)
                return { target, index };
        }
        return undefined;
    }
    /** Read the current durable projection state. */
    current() {
        const state = this.projections.stateOf(this.session, 'inbox');
        if (state === undefined) {
            throw new Error(`agent "${this.session.id}" cannot read inbox state: its projection registration is not active`);
        }
        return state;
    }
    /** Commit one normalized mutation and publish its live events. */
    mutate(target, start, deleteCount, inserted, discardRemoved, recordSeq) {
        const state = this.current();
        const inbox = state[target];
        const truncatedStart = Math.trunc(start);
        const offset = Number.isNaN(truncatedStart) ? 0 : truncatedStart;
        const actualStart = offset < 0
            ? Math.max(inbox.length + offset, 0)
            : Math.min(offset, inbox.length);
        const truncatedDeleteCount = Math.trunc(deleteCount);
        const actualDeleteCount = Math.min(Math.max(Number.isNaN(truncatedDeleteCount) ? 0 : truncatedDeleteCount, 0), inbox.length - actualStart);
        if (actualDeleteCount === 0 && inserted.length === 0)
            return [];
        const candidate = inbox.toSpliced(actualStart, actualDeleteCount, ...inserted);
        const ids = new Set();
        for (const message of target === 'next-turn'
            ? [...candidate, ...state['next-step']]
            : [...state['next-turn'], ...candidate]) {
            if (ids.has(message.id))
                throw new Error(`message "${message.id}" is already pending`);
            ids.add(message.id);
        }
        const outcome = discardRemoved && actualDeleteCount > 0 ? 'canceled' : undefined;
        const splice = {
            target,
            start: actualStart,
            ...(actualDeleteCount === 0 ? {} : { removedCount: actualDeleteCount }),
            inserted,
            ...(outcome === undefined ? {} : { outcome }),
        };
        const removed = inbox.slice(actualStart, actualStart + actualDeleteCount);
        const event = this.session.append('agent/inbox/spliced', splice);
        recordSeq?.(event.seq);
        if (discardRemoved) {
            for (const message of removed)
                this.dispatch.emit('agent/inbox/discarded', { message });
        }
        for (const message of event.data.inserted) {
            this.dispatch.emit('agent/inbox/inserted', { message });
        }
        return removed;
    }
}
