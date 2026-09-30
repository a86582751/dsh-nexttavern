// Generated from runtime/alpha3/compat/agent-loop/src/agent.ts; edit the TypeScript source.
/**
 * Default Agent driver over queued turns and step-boundary input. Every request
 * is derived from the session log.
 * @module dsh-agent-loop/agent
 */
import { agentEvents, assembleContextFor } from '@deepseek-ai/dsh-agent';
import { LlmError, createAssistantMessage, createDeveloperMessage, errorChain, freezeMessage, markAgentLoopRequest, } from '@deepseek-ai/dsh-llm';
import { assertNever, deepFreeze } from '@deepseek-ai/dsh-util-values';
import { brandString } from '@deepseek-ai/dsh-brand';
import { inspectProgrammaticCommit, programmaticTurnIdentity } from './programmatic-commit.js';
import { createScope } from '@deepseek-ai/dsh-scope';
import { canonicalHeader, headerEquals } from '@deepseek-ai/dsh-session';
import { joinContextSections, renderContextSections, renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ReactLoopInbox } from './inbox.js';
import { randomUUID } from 'node:crypto';
import { INPUT_ADMISSION_ABORT_REASON, nativeInputLink, nativeInputSha256, nativeInputWorkSha256, nativePreparationReceipt, inspectNativeInboxHistory, nativeInputStopAcknowledgement } from './input-admission.js';
import { nativeCompletedInputReceipt, nativeCompletedInputAcknowledgement } from './input-completion.js';
import { RuntimeContextProjection } from './runtime-context.js';
import { AssistantStreamAttempt } from './assistant-stream.js';
import { SystemPromptProjection } from './runtime-context.js';
import { executeToolCalls } from './tool-calls.js';
const nativeAdmissionAgents = new WeakSet();
/** Actual constructor identity, not a caller-supplied capability/verified flag. */
export function nativeInputAdmissionCapability(agent) {
    return agent instanceof ReactLoopAgent && nativeAdmissionAgents.has(agent) ? agent : undefined;
}
/** Remove adapter-derived values before plugins propose the next request config. */
function requestProposal(header) {
    if (header.adapterDefaults === undefined)
        return header.config;
    const proposal = { ...header.config };
    if (header.adapterDefaults.reasoningEffort === true)
        delete proposal.reasoningEffort;
    if (header.adapterDefaults.maxTokens === true)
        delete proposal.maxTokens;
    return proposal;
}
/**
 * Read the cause `cancel()` passed when aborting a loop-owned signal, copying
 * only the fields `turn/end` records. The live reason stays the caller's
 * object, and Node's fetch assigns a `stack` onto it that `Session.append`
 * would either log or reject as data JSON cannot hold.
 * @param signal - a turn or maintenance signal this loop owns.
 * @returns the copied cause, or undefined while the signal is still live.
 */
function abortedCancelCause(signal) {
    if (!signal.aborted)
        return undefined;
    // `cancel()` is the only aborter of the signals this loop owns.
    const cause = signal.reason;
    switch (cause.kind) {
        case 'user':
        case 'parent':
        case 'disposed':
            return { kind: cause.kind };
        case 'hook':
            return { kind: 'hook', reason: cause.reason };
        /* v8 ignore next -- cancel accepts the closed AgentCancelCause union */
        default:
            return assertNever(cause);
    }
}
/** Drives one session through turn and step boundaries. */
export class ReactLoopAgent {
    loopCtx;
    id;
    options;
    session;
    inbox;
    phase;
    activityDone = Promise.resolve();
    /** The agent-scoped registration boundary; the lifecycle owner unwinds it after the driver exits. */
    scope;
    ctx;
    /** Fused dispatcher, built once in the constructor so hot-path dispatches never allocate. */
    dispatch;
    /** Whether this loop instance has appended its initial/resume request anchor. */
    requestHeaderLogged = false;
    /** Surface generation at attachment or the preceding built request. */
    requestSurfaceGeneration;
    runtimeContext;
    /** Process-local revision of assistant frames for this attached Session. */
    assistantStreamRevision = 0;
    assistantAttemptCounter = 0;
    systemPrompt;
    /** Identities fully frozen by this loop; weak references do not retain replaced history. */
    frozenMessages = new WeakSet();
    /** A failed append before the message boundary cannot be assigned a safe retry turn in this live session. */
    uncertainProgrammaticOperations = new Set();
    /** An unclosed append-only turn forbids another driver from writing behind it. */
    programmaticTurnPoisoned = false;
    inputAdmission;
    existingInputWork;
    inputAdmissionBlocked;
    inputWakeStopped = false;
    inputDisposed = false;
    inputOnlyWakeLatched = false;
    inputStopSequence = 0;
    inputStop;
    /** Retain the last owner work across a blocked driver becoming idle. */
    inputStopWork;
    /** Independent terminal gate. An ordinary wake or acknowledged cancellation
     * cannot turn an uncertain post-close Source write into replay permission. */
    inputCompletion;
    get inputCompletionBlocked() {
        return this.inputCompletion !== undefined && this.inputCompletion.result.status !== 'settled';
    }
    constructor(loopCtx, id, options, session) {
        this.loopCtx = loopCtx;
        this.id = id;
        this.options = options;
        this.session = session;
        this.requestSurfaceGeneration = session.surface.contentGeneration;
        this.dispatch = agentEvents(loopCtx, this);
        this.scope = createScope(loopCtx, this);
        this.ctx = this.scope.ctx;
        this.inbox = new ReactLoopInbox(this.ctx.sessionProjections, session, this.dispatch);
        /* v8 ignore next -- the loop registers its own turnBoundary unit, so the key is always present */
        const lastTurn = this.loopCtx.sessionProjections.stateOf(session, 'turnBoundary')?.lastTurn ?? 0;
        this.phase = { kind: 'idle', lastTurn };
        this.runtimeContext = new RuntimeContextProjection(this.ctx, session);
        this.systemPrompt = new SystemPromptProjection(session);
        nativeAdmissionAgents.add(this);
    }
    get nativeInputAdmissionVersion() { return 2; }
    get nativeInputStopVersion() { return 1; }
    get status() {
        return this.phase.kind === 'idle' || this.phase.kind === 'maintenance' ? 'idle' : 'running';
    }
    get programmaticGeneration() {
        return this.phase.kind === 'running' && this.phase.programmatic
            ? { operationId: this.phase.programmatic.operationId } : null;
    }
    /** Commit a phase and publish its externally visible status transition. */
    setPhase(next) {
        const previousStatus = this.status;
        this.phase = next;
        const status = this.status;
        if (status !== previousStatus) {
            this.dispatch.emit('agent/status', { status });
        }
    }
    send(message, target, wakeup) {
        if (wakeup && !this.inputDisposed && (!this.inputStop || this.inputStop.result.status === 'acknowledged')) {
            if (this.inputStop && !this.inputCompletionBlocked)
                this.inputStopWork = undefined;
            this.inputStop = undefined;
            this.inputWakeStopped = false;
            this.inputOnlyWakeLatched = false;
        }
        // Waking input cannot join an aborted activity, so it starts the next turn.
        // Captured before the insertion so a reentrant cancel from a splice observer cannot reclassify it.
        const wakingAfterAbort = wakeup && this.phase.kind !== 'idle' && this.phase.abort.signal.aborted;
        const resolvedTarget = wakingAfterAbort ? 'next-turn' : target;
        this.inbox.splice(resolvedTarget, Infinity, 0, [message]);
        if (wakeup)
            this.wakeDriver(wakingAfterAbort);
    }
    followup(input) {
        this.send(input, 'next-turn', true);
    }
    steer(input) {
        this.send(input, 'next-step', true);
    }
    inject(input) {
        this.send(input, 'next-step', false);
    }
    cancel(cause, options = {}) {
        if (cause.kind === 'disposed') {
            this.inputDisposed = true;
            nativeAdmissionAgents.delete(this);
        }
        if (cause.kind !== 'hook' || cause.reason !== INPUT_ADMISSION_ABORT_REASON)
            this.inputWakeStopped = true;
        try {
            // Install the barrier before invoking user code: reentrant cancellation
            // sees the same generation, while disposal can supersede it safely.
            if (cause.kind !== 'hook' || cause.reason !== INPUT_ADMISSION_ABORT_REASON)
                this.notifyInputStop(cause, options);
        }
        finally {
            try {
                if (this.inputWakeStopped && this.inputOnlyWakeLatched) {
                    if (this.phase.kind !== 'idle')
                        this.phase.wakeRequested = false;
                    this.inputOnlyWakeLatched = false;
                    this.existingInputWork = undefined;
                }
                if (!options.keepInbox) {
                    this.inbox.clear();
                    if (this.phase.kind !== 'idle')
                        this.phase.wakeRequested = false;
                }
            }
            finally {
                if (this.phase.kind !== 'idle')
                    this.phase.abort.abort(cause);
            }
        }
    }
    notifyInputStop(cause, options) {
        const registration = this.inputAdmission;
        const stopOwner = registration?.stopOwner;
        if (!registration || !stopOwner)
            return;
        if (this.inputStop && (cause.kind !== 'disposed' || this.inputStop.notice.cause.kind === 'disposed'))
            return;
        const stopSequence = ++this.inputStopSequence;
        let notice;
        try {
            const selected = this.inputStopWork?.registration === registration ? this.inputStopWork : this.existingInputWork;
            const work = selected ? { refs: selected.refs,
                preparation: nativePreparationReceipt(selected.preparation), receipt: selected.receipt } : undefined;
            const refs = new Map();
            for (const ref of work?.refs ?? [])
                refs.set(nativeInputSha256(ref), ref);
            // A splice observer can cancel after removal but before claimExact
            // returns. Retain nominated refs even during that synchronous boundary.
            for (const entry of registration.nominations?.values() ?? [])
                refs.set(nativeInputSha256(entry.ref), entry.ref);
            let refsCode;
            const history = inspectNativeInboxHistory(this.session.id, this.session.snapshotEvents(), this.session.inheritedEventCount);
            for (const entry of [...history.pending['next-step'], ...history.pending['next-turn']]) {
                if (history.ownership(entry.ref).status !== 'pending')
                    refsCode = 'INPUT_OWNERSHIP_UNKNOWN';
                refs.set(nativeInputSha256(entry.ref), entry.ref);
            }
            notice = deepFreeze({ schemaVersion: 1, sessionId: this.session.id, stopSequence, stopNonce: randomUUID(),
                cause: { kind: cause.kind, ...(cause.kind === 'hook' ? { hookReasonSha256: nativeInputSha256(cause.reason) } : {}) },
                keepInbox: options.keepInbox === true, phase: this.phase.kind, refs: [...refs.values()],
                ...(refsCode ? { refsCode } : {}), ...(work?.preparation ? { preparation: work.preparation } : {}),
                ...(work?.receipt ? { receipt: work.receipt } : {}) });
        }
        catch {
            // Even unreadable history/metadata must notify the owner synchronously.
            // A minimal unknown notice cannot be acknowledged into readiness.
            notice = Object.freeze({ schemaVersion: 1, sessionId: this.session.id, stopSequence,
                stopNonce: `unavailable-${stopSequence}`, cause: Object.freeze({ kind: cause.kind }),
                keepInbox: options.keepInbox === true, phase: this.phase.kind, refs: Object.freeze([]), refsCode: 'INPUT_OWNERSHIP_UNKNOWN' });
        }
        const done = Promise.withResolvers();
        const state = { notice, result: Object.freeze({ status: 'pending', notice }), done: done.promise };
        this.inputStop = state;
        const unknown = (code) => { state.result = Object.freeze({ status: 'unknown', notice, code }); done.resolve(); };
        try {
            // Do not defer invocation into a Promise callback: owner revocation must
            // execute in cancel's synchronous stack, before native clear and abort.
            const acknowledgement = stopOwner(notice);
            void Promise.resolve(acknowledgement).then(value => {
                state.result = nativeInputStopAcknowledgement(value, notice);
                done.resolve();
            }, () => { unknown('INPUT_STOP_ACK_FAILED'); });
        }
        catch {
            unknown('INPUT_STOP_ACK_FAILED');
        }
    }
    lookupInputStop() { return this.inputStop?.result ?? Object.freeze({ status: 'none' }); }
    lookupInputCompletion() {
        return this.inputCompletion?.result ?? Object.freeze({ status: 'none' });
    }
    async whenInputStopSettled() {
        let state;
        do {
            state = this.inputStop;
            await state?.done;
        } while (state !== this.inputStop);
        return this.lookupInputStop();
    }
    /** Consume late owner results without applying them after cancellation. The
     * stop ACK owns quiescence; awaiting this driver's idle here would deadlock. */
    awaitInputOperation(operation, signal, registration) {
        if (!registration.stopOwner)
            return operation;
        return (async () => {
            const cancelled = Promise.withResolvers();
            const onAbort = () => { cancelled.reject(signal.reason); };
            signal.addEventListener('abort', onAbort, { once: true });
            if (signal.aborted)
                onAbort();
            try {
                const result = await Promise.race([operation, cancelled.promise]);
                if (signal.aborted) {
                    await this.whenInputStopSettled();
                    signal.throwIfAborted();
                }
                return result;
            }
            catch (error) {
                if (signal.aborted) {
                    await this.whenInputStopSettled();
                    signal.throwIfAborted();
                }
                throw error;
            }
            finally {
                signal.removeEventListener('abort', onAbort);
            }
        })();
    }
    /** One lifecycle owner; ordinary upstream callers keep the unregistered path. */
    registerInputAdmission(hook) {
        if (this.inputDisposed || this.inputAdmission)
            throw Error('native input admission already owned or disposed');
        if (typeof hook.admit !== 'function' || typeof hook.check !== 'function')
            throw Error('invalid native input admission hook');
        if (hook.schemaVersion !== undefined && hook.schemaVersion !== 1 && hook.schemaVersion !== 2)
            throw Error('unsupported native input admission hook');
        if (hook.schemaVersion === 2 && typeof hook.checkpoint !== 'function')
            throw Error('v2 native input admission needs checkpoint');
        const ownsContinuations = hook.schemaVersion === 2
            && (hook.onContinuationControl !== undefined || hook.recognizeSupplement !== undefined);
        if (ownsContinuations && hook.schemaVersion === 2
            && (typeof hook.onContinuationControl !== 'function' || typeof hook.recognizeSupplement !== 'function')) {
            throw Error('native continuation hooks must be paired');
        }
        const stopOwner = hook.schemaVersion === 2 ? hook.onStop : undefined;
        if (stopOwner !== undefined && typeof stopOwner !== 'function')
            throw Error('invalid native input stop hook');
        if (hook.schemaVersion === 2 && hook.completedWork !== undefined && typeof hook.completedWork !== 'function') {
            throw Error('invalid native completed input hook');
        }
        const registration = { hook, active: true, ...(stopOwner ? { stopOwner: stopOwner.bind(hook) } : {}),
            ...(ownsContinuations ? { nominations: new Map(), usedTokens: new WeakSet() } : {}) };
        this.inputAdmission = registration;
        if (ownsContinuations && hook.schemaVersion === 2) {
            try {
                hook.onContinuationControl({ steerOwnedContinuation: (message, scope) => this.insertOwnedContinuation(registration, message, scope) });
            }
            catch {
                registration.active = false;
                this.inputAdmission = undefined;
                throw Error('native continuation control registration failed');
            }
        }
        return () => {
            registration.active = false;
            registration.nominations?.clear();
            if (this.inputAdmission === registration)
                this.inputAdmission = undefined;
            this.existingInputWork = undefined;
        };
    }
    /** Registration-private authority is hot and bounded to the original actual
     * checkpoint. Ordinary send/steer can wake or clear stops; this control cannot. */
    insertOwnedContinuation(registration, message, scope) {
        const ready = () => {
            const work = this.inputStopWork;
            return !this.inputDisposed && !this.inputStop && !this.inputWakeStopped && !this.inputCompletionBlocked && registration.active
                && this.inputAdmission === registration && this.phase.kind === 'running' && !this.phase.programmatic
                && !this.phase.abort.signal.aborted && this.phase.step >= 1 && work?.registration === registration
                && work.ownedContinuations === true && !!work.receipt && work.receipt.actualTurn === this.phase.turn
                && nativeInputSha256(work.receipt) === nativeInputSha256(scope.parent);
        };
        try {
            if (!registration.nominations || !registration.usedTokens || !ready()
                || message.source?.kind === 'user' || !scope.ownerToken || typeof scope.ownerToken !== 'object') {
                return { kind: 'blocked', code: 'INPUT_CONTINUATION_SCOPE_INVALID' };
            }
            if (registration.usedTokens.has(scope.ownerToken))
                return { kind: 'blocked', code: 'INPUT_CONTINUATION_TOKEN_USED' };
            // A failed or uncertain insert is not permission to replay this token.
            registration.usedTokens.add(scope.ownerToken);
            const parentSha256 = nativeInputSha256(scope.parent), turn = scope.parent.actualTurn;
            let insertedRef;
            try {
                this.inbox.insertTrackedNextStep(message, ref => {
                    insertedRef = ref;
                    registration.nominations.set(nativeInputSha256(ref), { ref, ownerToken: scope.ownerToken,
                        parentSha256, turn, claimed: false });
                });
            }
            catch {
                return { kind: 'blocked', code: 'INPUT_CONTINUATION_INSERT_UNKNOWN', ...(insertedRef ? { insertedRef } : {}) };
            }
            if (!insertedRef || !ready()) {
                return { kind: 'blocked', code: 'INPUT_CONTINUATION_REVOKED', ...(insertedRef ? { insertedRef } : {}) };
            }
            return { kind: 'inserted', ref: insertedRef };
        }
        catch {
            return { kind: 'blocked', code: 'INPUT_CONTINUATION_SCOPE_INVALID' };
        }
    }
    lookupInputOwnership(ref) { return this.inbox.lookupOwnership(ref); }
    lookupDurableInputWork(selector) {
        return this.inbox.lookupDurableWork(selector);
    }
    /** Wake only work already owned by this inbox, never send or insert a message. */
    wakePending() {
        if (this.inputDisposed)
            return { kind: 'disposed' };
        if (this.inputStop || this.inputWakeStopped || this.programmaticTurnPoisoned || this.inputCompletionBlocked)
            return { kind: 'blocked' };
        if (!this.inbox.hasPending)
            return { kind: 'empty' };
        if (this.phase.kind === 'running')
            return { kind: 'running' };
        const latched = this.phase.kind === 'maintenance';
        this.inputOnlyWakeLatched = latched;
        this.wakeDriver();
        return { kind: latched ? 'latched' : 'started' };
    }
    /** Owner credentials supplement native history; no caller body is accepted. */
    wakeExistingWork(work) {
        if (this.inputDisposed)
            return { kind: 'disposed' };
        if (this.inputStop || this.inputWakeStopped || this.inputCompletionBlocked || !this.inputAdmission || work?.preparation == null
            || !Array.isArray(work.refs))
            return { kind: 'blocked' };
        let selected;
        try {
            if (this.inputAdmission.hook.schemaVersion === 2) {
                const preparation = nativePreparationReceipt(work.preparation);
                const receipt = 'receipt' in work ? work.receipt : undefined;
                if (!preparation || !receipt || nativeInputSha256(preparation) !== nativeInputSha256(receipt.preparation)
                    || nativeInputSha256(work.refs) !== nativeInputSha256(receipt.refs) || !this.inbox.canResumeLinked(receipt))
                    return { kind: 'blocked' };
                selected = { preparation, refs: deepFreeze(structuredClone(work.refs)), receipt: deepFreeze(structuredClone(receipt)) };
            }
            else {
                if (!this.inbox.canResume(work.refs))
                    return { kind: 'blocked' };
                selected = { preparation: work.preparation, refs: deepFreeze(structuredClone(work.refs)) };
            }
        }
        catch {
            return { kind: 'blocked' };
        }
        if (this.phase.kind === 'running' || this.existingInputWork)
            return { kind: 'running' };
        this.existingInputWork = selected;
        const latched = this.phase.kind === 'maintenance';
        this.inputOnlyWakeLatched = latched;
        this.wakeDriver();
        return { kind: latched ? 'latched' : 'started' };
    }
    blockInput(registration, code, stage, proposal, partialClaim, refs = partialClaim?.refs ?? proposal.refs) {
        const thinCode = typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'INPUT_ADMISSION_BLOCKED';
        this.inputAdmissionBlocked = { registration, notice: { code: thinCode, stage, refs,
                ...(partialClaim ? { partialClaim: { turn: partialClaim.turn, refs: partialClaim.refs,
                        spliceSeqs: partialClaim.spliceSeqs, resumed: partialClaim.resumed } } : {}) } };
    }
    async admitInput(target) {
        const registration = this.inputAdmission;
        if (!registration || this.phase.kind !== 'running' || this.phase.programmatic)
            return { kind: 'none' };
        const signal = this.phase.abort.signal;
        const existing = this.existingInputWork;
        let proposal;
        try {
            proposal = this.inbox.propose(target);
        }
        catch {
            this.inputAdmissionBlocked = { registration, notice: { code: 'INPUT_OWNERSHIP_UNKNOWN', stage: 'proposal', refs: existing?.refs ?? [] } };
            return { kind: 'blocked' };
        }
        const refused = (code) => {
            this.blockInput(registration, code, 'proposal', proposal, undefined, existing?.refs);
            return { kind: 'blocked' };
        };
        if (!proposal.messages.length && !existing) {
            return target === 'next-step' ? { kind: 'none' } : refused('INPUT_EMPTY');
        }
        const hook = registration.hook;
        this.inputStopWork = { registration, refs: existing?.refs ?? proposal.refs,
            ...(existing?.receipt ? { preparation: existing.receipt.preparation, receipt: existing.receipt } : {}) };
        let decision;
        try {
            if (hook.schemaVersion === 2) {
                let linked;
                if (existing) {
                    const preparation = nativePreparationReceipt(existing.preparation);
                    if (!preparation || !existing.receipt)
                        return refused('INPUT_RESUME_RECEIPT_MISSING');
                    linked = { preparation, refs: existing.refs, receipt: existing.receipt };
                }
                decision = await this.awaitInputOperation(hook.admit(proposal, signal, linked), signal, registration);
            }
            else
                decision = await hook.admit(proposal, signal, existing);
        }
        catch {
            if (this.inputStop)
                await this.whenInputStopSettled();
            signal.throwIfAborted();
            return refused('INPUT_ADMISSION_HOOK_FAILED');
        }
        if (signal.aborted)
            await this.whenInputStopSettled();
        signal.throwIfAborted();
        if (!registration.active || this.inputAdmission !== registration || !this.inbox.matches(proposal))
            return refused('INPUT_PROPOSAL_CHANGED');
        if (!decision || typeof decision !== 'object')
            return refused('INPUT_ADMISSION_DECISION_INVALID');
        if (decision.kind === 'blocked')
            return refused(decision.code);
        if (decision.kind !== 'allow' && decision.kind !== 'resume')
            return refused('INPUT_ADMISSION_DECISION_INVALID');
        if (hook.schemaVersion === 2 && decision.identity === undefined)
            return refused('INPUT_ADMISSION_IDENTITY_MISSING');
        let preparation;
        if (hook.schemaVersion === 2) {
            try {
                preparation = nativePreparationReceipt(Object.getOwnPropertyDescriptor(decision, 'preparation')?.value);
            }
            catch {
                return refused('INPUT_PREPARATION_RECEIPT_INVALID');
            }
        }
        if (hook.schemaVersion === 2 && !preparation)
            return refused('INPUT_PREPARATION_RECEIPT_INVALID');
        const ownedContinuations = hook.schemaVersion === 2 && 'ownedContinuations' in decision
            && decision.ownedContinuations === true ? true : undefined;
        if (ownedContinuations && !registration.nominations)
            return refused('INPUT_CONTINUATION_CONTROL_MISSING');
        const completedWorkRequired = hook.schemaVersion === 2 && 'completedWorkRequired' in decision
            && decision.completedWorkRequired === true ? true : undefined;
        if (completedWorkRequired && (hook.schemaVersion !== 2 || !hook.completedWork || !registration.stopOwner)) {
            return refused('INPUT_COMPLETION_CONTROL_MISSING');
        }
        if (preparation)
            this.inputStopWork = { registration, refs: existing?.refs ?? proposal.refs, preparation,
                ...(existing?.receipt ? { receipt: existing.receipt } : {}) };
        const markerFor = (refs, previousStartSeq) => {
            if (!preparation)
                return undefined;
            return nativeInputLink({ schemaVersion: 1, encoding: 'native-input-link-v1', preparation, refs,
                workSha256: nativeInputWorkSha256(this.session.id, preparation, refs),
                ...(previousStartSeq === undefined ? { mode: 'claim', proposal: { target: proposal.target,
                        revision: proposal.revision, stateSha256: proposal.stateSha256 } } : { mode: 'resume', previousStartSeq }) }, this.session.id);
        };
        if (decision.kind === 'resume') {
            if (!existing || nativeInputSha256(existing.refs) !== nativeInputSha256(decision.refs)
                || preparation && nativeInputSha256(preparation) !== nativeInputSha256(existing.preparation))
                return refused('INPUT_RESUME_NOT_PROVEN');
            if (hook.schemaVersion === 2 ? !existing.receipt || !this.inbox.canResumeLinked(existing.receipt)
                : !this.inbox.canResume(decision.refs))
                return refused('INPUT_RESUME_NOT_PROVEN');
            const resumeProof = this.inbox.prepareResume(proposal, decision.refs, hook.schemaVersion === 2 ? existing.receipt : undefined);
            if (!resumeProof)
                return refused('INPUT_RESUME_NOT_PROVEN');
            const marker = markerFor(decision.refs, existing.receipt?.startSeq);
            if (hook.schemaVersion === 2 && !marker)
                return refused('INPUT_LINK_INVALID_OR_OVERSIZED');
            return { kind: 'admitted', admission: { registration, proposal, identity: decision.identity, resumeProof, preparation, marker,
                    ...(ownedContinuations ? { ownedContinuations } : {}), ...(completedWorkRequired ? { completedWorkRequired } : {}) } };
        }
        if (existing)
            return refused('INPUT_EXISTING_WORK_NOT_SELECTED');
        const marker = markerFor(proposal.refs);
        if (hook.schemaVersion === 2 && !marker)
            return refused('INPUT_LINK_INVALID_OR_OVERSIZED');
        return { kind: 'admitted', admission: { registration, proposal, identity: decision.identity, preparation, marker,
                ...(ownedContinuations ? { ownedContinuations } : {}), ...(completedWorkRequired ? { completedWorkRequired } : {}) } };
    }
    abortInput(admission, code, stage, claim, proposal = admission.proposal) {
        this.blockInput(admission.registration, code, stage, proposal, claim);
        this.cancel({ kind: 'hook', reason: INPUT_ADMISSION_ABORT_REASON }, { keepInbox: true });
        if (this.phase.kind !== 'running')
            throw Error('native input driver reservation lost');
        this.phase.abort.signal.throwIfAborted();
        throw Error('native input abort was not recorded');
    }
    /** Check native receipt and owner readiness before assembly and at both request edges. */
    checkInput(admission, messages) {
        const claim = admission.claim;
        const matches = () => this.inbox.matchesClaim(claim)
            && (admission.supplement?.claims.every(owned => this.inbox.matchesClaim(owned.claim)) ?? true);
        if (this.phase.kind !== 'running')
            this.abortInput(admission, 'INPUT_DRIVER_CHANGED', 'final', claim);
        const signal = this.phase.abort.signal;
        signal.throwIfAborted();
        if (!admission.registration.active || this.inputAdmission !== admission.registration || !matches()) {
            this.abortInput(admission, 'INPUT_FINAL_IDENTITY_CHANGED', 'final', claim);
        }
        let result;
        try {
            const hook = admission.registration.hook;
            const input = { proposal: admission.proposal, claim, identity: admission.identity, messages,
                ...(admission.continuation ? { continuation: true } : {}) };
            if (hook.schemaVersion === 2) {
                if (!admission.preparation)
                    this.abortInput(admission, 'INPUT_PREPARATION_RECEIPT_INVALID', 'final', claim);
                result = hook.check({ ...input, preparation: admission.preparation,
                    ...(admission.receipt ? { receipt: admission.receipt } : {}),
                    ...(admission.supplement ? { supplement: admission.supplement } : {}) });
            }
            else
                result = hook.check(input);
        }
        catch {
            this.abortInput(admission, 'INPUT_FINAL_CHECK_FAILED', 'final', claim);
        }
        if (result.kind !== 'allow')
            this.abortInput(admission, result.code, 'final', claim);
        signal.throwIfAborted();
        if (!admission.registration.active || this.inputAdmission !== admission.registration || !matches()) {
            this.abortInput(admission, 'INPUT_FINAL_IDENTITY_CHANGED', 'final', claim);
        }
    }
    /** Consume the whole actual proposal under the original work. No partial
     * filtering or re-admission can turn unrelated messages into maintenance. */
    claimSupplement(previous, proposal, position) {
        const registration = previous.registration, hook = registration.hook, parent = previous.receipt;
        if (hook.schemaVersion !== 2 || !hook.recognizeSupplement || !parent || parent.actualTurn !== position.turn
            || position.step < 2 || proposal.target !== 'next-step') {
            this.abortInput(previous, 'INPUT_CONTINUATION_SCOPE_INVALID', 'claim');
        }
        const entries = proposal.refs.map(ref => registration.nominations?.get(nativeInputSha256(ref)));
        if (!entries.length || entries.some(entry => !entry || entry.claimed || entry.turn !== position.turn
            || entry.parentSha256 !== nativeInputSha256(parent))) {
            this.abortInput(previous, 'INPUT_CONTINUATION_NOMINATION_UNKNOWN', 'claim', undefined, proposal);
        }
        const nominated = entries;
        let recognized;
        try {
            recognized = hook.recognizeSupplement({ parent, ...position, proposal,
                nominations: nominated.map(entry => ({ ref: entry.ref, ownerToken: entry.ownerToken })) });
        }
        catch {
            this.abortInput(previous, 'INPUT_CONTINUATION_RECOGNITION_FAILED', 'claim');
        }
        if (recognized.kind !== 'allow')
            this.abortInput(previous, recognized.code, 'claim');
        if (this.phase.kind !== 'running')
            this.abortInput(previous, 'INPUT_DRIVER_CHANGED', 'claim');
        this.phase.abort.signal.throwIfAborted();
        if (!registration.active || this.inputAdmission !== registration || !this.inbox.matches(proposal)) {
            this.abortInput(previous, 'INPUT_CONTINUATION_PROPOSAL_CHANGED', 'claim');
        }
        const result = this.inbox.claimExact(proposal, position.turn);
        const retained = new Map((this.inputStopWork?.refs ?? parent.refs).map(ref => [nativeInputSha256(ref), ref]));
        for (const ref of result.claim.refs)
            retained.set(nativeInputSha256(ref), ref);
        this.inputStopWork = { registration, refs: [...retained.values()], preparation: parent.preparation,
            receipt: parent, ownedContinuations: true };
        for (const entry of nominated)
            entry.claimed = true;
        if (result.kind === 'blocked')
            this.abortInput(previous, 'INPUT_CONTINUATION_CLAIM_CHANGED', 'claim', result.claim, proposal);
        const supplement = Object.freeze({ parent, ...position, proposal,
            claims: Object.freeze([...(previous.supplement?.claims ?? []), Object.freeze({ claim: result.claim,
                    ownerTokens: Object.freeze(nominated.map(entry => entry.ownerToken)) })]) });
        return { admission: { ...previous, continuation: true, supplement }, messages: [...result.claim.messages] };
    }
    /** Only this native writer mints the live receipt after its real checkpoint.
     * Core persists its association outside any native inbox/import lease. */
    async checkpointInput(admission, stepStartSeq, messages) {
        const hook = admission.registration.hook;
        if (hook.schemaVersion !== 2 || admission.startSeq === undefined)
            return;
        if (this.phase.kind !== 'running')
            this.abortInput(admission, 'INPUT_DRIVER_CHANGED', 'final', admission.claim);
        const signal = this.phase.abort.signal;
        this.checkInput(admission, messages);
        let flushed;
        try {
            flushed = await this.awaitInputOperation(this.ctx.sessions.flush(this.session), signal, admission.registration);
        }
        catch {
            if (this.inputStop)
                await this.whenInputStopSettled();
            signal.throwIfAborted();
            this.abortInput(admission, 'INPUT_LINK_FLUSH_FAILED', 'final', admission.claim);
        }
        if (signal.aborted)
            await this.whenInputStopSettled();
        signal.throwIfAborted();
        if (!flushed)
            this.abortInput(admission, 'INPUT_LINK_FLUSH_FAILED', 'final', admission.claim);
        this.checkInput(admission, messages);
        const receipt = this.inbox.linkReceipt(admission.startSeq);
        if (!receipt || receipt.firstStepStartSeq !== stepStartSeq || receipt.actualTurn !== this.phase.turn
            || receipt.workSha256 !== admission.marker?.workSha256
            || nativeInputSha256(receipt.preparation) !== nativeInputSha256(admission.preparation)) {
            this.abortInput(admission, 'INPUT_LINK_CHANGED', 'final', admission.claim);
        }
        let outcome;
        this.inputStopWork = { registration: admission.registration, refs: receipt.refs, preparation: receipt.preparation, receipt,
            ...(admission.ownedContinuations ? { ownedContinuations: true } : {}) };
        try {
            outcome = await this.awaitInputOperation(hook.checkpoint(receipt, signal), signal, admission.registration);
        }
        catch {
            if (this.inputStop)
                await this.whenInputStopSettled();
            signal.throwIfAborted();
            this.abortInput(admission, 'INPUT_CHECKPOINT_FAILED', 'final', admission.claim);
        }
        if (signal.aborted)
            await this.whenInputStopSettled();
        signal.throwIfAborted();
        if (outcome?.kind !== 'allow')
            this.abortInput(admission, outcome?.code ?? 'INPUT_CHECKPOINT_BLOCKED', 'final', admission.claim);
        admission.receipt = receipt;
        this.checkInput(admission, messages);
    }
    runMaintenance(job) {
        if (this.phase.kind !== 'idle')
            throw new Error(`agent "${this.id}" already has active work`);
        const done = Promise.withResolvers();
        const maintenance = {
            kind: 'maintenance',
            abort: new AbortController(),
            lastTurn: this.phase.lastTurn,
            wakeRequested: false,
        };
        this.setPhase(maintenance);
        this.activityDone = done.promise;
        return (async () => {
            try {
                return await job(maintenance.abort.signal);
            }
            finally {
                if (this.inputStop)
                    await this.whenInputStopSettled();
                this.setPhase({ kind: 'idle', lastTurn: maintenance.lastTurn });
                const cause = abortedCancelCause(maintenance.abort.signal);
                if (!this.programmaticTurnPoisoned && cause?.kind !== 'disposed'
                    && maintenance.wakeRequested && (this.inbox.hasPending || this.existingInputWork))
                    this.wakeDriver();
                done.resolve();
            }
        })();
    }
    /**
     * Append one complete assistant turn without entering the request pipeline.
     * The operation identity is in the first turn record as well as the message,
     * so a cold retry can recognize a failure before the message existed. Flush
     * still owns durability; a partial turn is never continued by a second writer.
     */
    async commitProgrammaticAssistant(input) {
        if (this.phase.kind !== 'idle' || this.programmaticTurnPoisoned || this.inputCompletionBlocked)
            return { kind: 'busy' };
        const identity = programmaticTurnIdentity(input);
        return this.runMaintenance(async () => {
            // Include inherited history: the operation may have committed before a
            // resume, or the flush acknowledgement may have been lost.
            const inspection = inspectProgrammaticCommit(this.session.snapshotEvents(), input, identity);
            if (inspection.kind === 'unknown')
                return inspection;
            if (inspection.kind === 'complete') {
                try {
                    if (!await this.ctx.sessions.flush(this.session)) {
                        return { kind: 'unknown', reason: 'no durable session listener confirmed the flush' };
                    }
                    return { kind: 'committed', turn: inspection.turn, messageId: input.messageId };
                }
                catch {
                    return { kind: 'unknown', reason: 'session flush did not confirm durability' };
                }
            }
            if (this.uncertainProgrammaticOperations.has(input.operationId)) {
                return { kind: 'unknown', reason: 'earlier append stopped before its message boundary' };
            }
            if (this.loopCtx.sessionProjections.stateOf(this.session, 'turnBoundary')?.openTurnStartSeq != null) {
                return { kind: 'unknown', reason: 'session already has an open turn', code: 'PROGRAMMATIC_OPEN_TURN' };
            }
            // Assistant-only transcripts are readable, but a later system prompt
            // cannot acquire their protected head. Refuse a new turn before writing
            // behind that history; exact committed retries above remain read-only.
            const surfaceHead = this.session.surface.nodes[0];
            if (surfaceHead !== undefined && this.session.eventAt(surfaceHead)?.type !== 'system/message') {
                return { kind: 'unknown', reason: 'session surface has no protected system prompt head',
                    code: 'PROGRAMMATIC_MISSING_SYSTEM_HEAD' };
            }
            const phase = this.phase;
            if (phase.kind !== 'maintenance')
                return { kind: 'unknown', reason: 'maintenance reservation was lost' };
            const turn = phase.lastTurn + 1;
            const step = 1;
            const message = freezeMessage({
                id: brandString(input.messageId),
                role: 'assistant',
                content: [{ type: 'text', text: input.text }],
                source: input.source,
            });
            try {
                this.session.append('turn/start', { turn, programmatic: identity });
                phase.lastTurn = turn;
                this.session.append('step/start', { turn, step });
                // The first surface node must already own the system slot when the
                // next real request is admitted. An empty native head records no
                // prompt and invokes no assembly hooks; ordinary prompt reconciliation
                // can replace it or append an in-history update without moving story.
                if (surfaceHead === undefined) {
                    for (const { message, intent } of this.systemPrompt.project('', { inHistory: false, startsSeries: true })) {
                        this.session.append('system/message', { turn, step, message }, intent);
                    }
                }
                this.session.append('assistant/message', { turn, step, message, stream: [] }, { surfaceOp: 'append' });
                this.session.append('step/end', { turn, step });
                this.session.append('turn/end', { turn, reason: { kind: 'completed' } });
            }
            catch {
                if (this.session.snapshotEvents().some(event => event.type === 'turn/start'
                    && event.data.programmatic?.operationId === input.operationId)) {
                    // An append acknowledgement can fail after the first event was accepted.
                    // Keep the next turn number ahead of that durable ownership boundary.
                    phase.lastTurn = Math.max(phase.lastTurn, turn);
                    this.uncertainProgrammaticOperations.add(input.operationId);
                }
                this.closePartialProgrammaticTurn(turn, step);
                return { kind: 'unknown', reason: 'append stopped before a complete turn was confirmed' };
            }
            try {
                if (!await this.ctx.sessions.flush(this.session)) {
                    return { kind: 'unknown', reason: 'no durable session listener confirmed the flush' };
                }
                return { kind: 'committed', turn, messageId: input.messageId };
            }
            catch {
                return { kind: 'unknown', reason: 'session flush did not confirm durability' };
            }
        });
    }
    /** Confirm an exact operation under the same reservation as its writer; never append on lookup. */
    async lookupProgrammaticAssistantCommit(input) {
        if (this.phase.kind !== 'idle' || this.programmaticTurnPoisoned)
            return { status: 'unknown' };
        const identity = programmaticTurnIdentity(input);
        return this.runMaintenance(async () => {
            const inspection = inspectProgrammaticCommit(this.session.snapshotEvents(), input, identity);
            if (inspection.kind === 'unknown')
                return { status: 'unknown', ...(inspection.code ? { code: inspection.code } : {}) };
            if (inspection.kind === 'absent' && this.uncertainProgrammaticOperations.has(input.operationId)) {
                return { status: 'unknown' };
            }
            if (this.loopCtx.sessionProjections.stateOf(this.session, 'turnBoundary')?.openTurnStartSeq != null) {
                return { status: 'unknown', code: 'PROGRAMMATIC_OPEN_TURN' };
            }
            try {
                if (!await this.ctx.sessions.flush(this.session))
                    return { status: 'unknown' };
                return inspection.kind === 'complete' ? { status: 'committed', turn: inspection.turn } : { status: 'absent' };
            }
            catch {
                return { status: 'unknown' };
            }
        });
    }
    /** Run one model turn from the assembled system prompt without creating a user message. */
    async generateProgrammaticAssistant(input) {
        const valid = (value) => typeof value === 'string' && value.length > 0
            && value.length <= 256 && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
        if (!input || !valid(input.operationId) || !valid(input.messageId)
            || typeof input.instruction !== 'string' || !input.instruction.trim()
            || new TextEncoder().encode(input.instruction).length > 65_536) {
            throw new Error('invalid programmatic generation identity or instruction');
        }
        if (this.phase.kind !== 'idle' || this.programmaticTurnPoisoned || this.inputCompletionBlocked || this.inbox.hasPending)
            return { kind: 'busy' };
        const events = this.session.snapshotEvents();
        const matching = events.filter((event) => event.type === 'assistant/message' && event.data.message.id === input.messageId);
        if (matching.length > 0) {
            if (matching.length !== 1 || matching[0].data.message.source.kind !== 'model') {
                return { kind: 'unknown', reason: 'generation identity belongs to a different message' };
            }
            const turn = matching[0].data.turn;
            if (!events.some(event => event.type === 'turn/end' && event.data.turn === turn
                && event.data.reason.kind === 'completed'))
                return { kind: 'unknown', reason: 'generation turn is incomplete' };
            if (!await this.ctx.sessions.flush(this.session))
                return { kind: 'unknown', reason: 'generation flush is not durable' };
            return { kind: 'committed', turn, messageId: input.messageId };
        }
        if (events.some(event => event.type === 'turn/start' && !events.some(end => end.type === 'turn/end' && end.data.turn === event.data.turn))) {
            return { kind: 'unknown', reason: 'session contains an open turn' };
        }
        const driver = Promise.withResolvers();
        this.activityDone = driver.promise;
        this.setPhase({ kind: 'running', abort: new AbortController(), turn: this.phase.lastTurn,
            step: 0, wakeRequested: false, programmatic: input });
        this.loopCtx.agents.withInitiator(this, () => this.kick()).then(driver.resolve, driver.reject);
        // This operation owns only its opening turn. A queued player follow-up may
        // start a new driver immediately after it, without delaying this receipt.
        await driver.promise;
        const settled = this.session.snapshotEvents();
        const generated = settled.find((event) => event.type === 'assistant/message' && event.data.message.id === input.messageId);
        const turn = generated?.data.turn;
        if (generated && settled.some(event => event.type === 'turn/end' && event.data.turn === turn
            && event.data.reason.kind === 'completed') && await this.ctx.sessions.flush(this.session)) {
            return { kind: 'committed', turn: turn, messageId: input.messageId };
        }
        return { kind: 'unknown', reason: 'generation did not complete durably' };
    }
    /** Close only boundaries that this append opened; an unconfirmable closure poisons future writes. */
    closePartialProgrammaticTurn(turn, step) {
        try {
            const events = this.session.snapshotEvents();
            const turnStarted = events.some(event => event.type === 'turn/start' && event.data.turn === turn);
            if (!turnStarted)
                return;
            const stepStarted = events.some(event => event.type === 'step/start'
                && event.data.turn === turn && event.data.step === step);
            const stepEnded = events.some(event => event.type === 'step/end'
                && event.data.turn === turn && event.data.step === step);
            const messageExists = events.some(event => event.type === 'assistant/message'
                && event.data.turn === turn && event.data.step === step);
            if (stepStarted && !stepEnded)
                this.session.append('step/end', { turn, step });
            const stepClosed = this.session.snapshotEvents().some(event => event.type === 'step/end'
                && event.data.turn === turn && event.data.step === step);
            if (!events.some(event => event.type === 'turn/end' && event.data.turn === turn)) {
                this.session.append('turn/end', {
                    turn,
                    reason: messageExists && stepClosed
                        ? { kind: 'completed' }
                        : { kind: 'error', error: { code: 'UNKNOWN', message: 'programmatic assistant append failed' } },
                });
            }
            if (!this.session.snapshotEvents().some(event => event.type === 'turn/end' && event.data.turn === turn)) {
                this.programmaticTurnPoisoned = true;
            }
        }
        catch {
            this.programmaticTurnPoisoned = true;
        }
    }
    /**
     * Start one driver, or latch its wake behind maintenance or an aborted
     * activity. A wake sent while idle always opens its turn boundary, even
     * when its message was cleared; only a latched replay is suppressed when
     * the queue no longer holds the wake.
     * @param wakeAfterAbort - the {@link send} classification, captured before
     *   the inbox insertion so a reentrant cancel cannot reclassify it.
     */
    wakeDriver(wakeAfterAbort = false) {
        if (this.programmaticTurnPoisoned || this.inputDisposed || this.inputStop
            || this.inputCompletionBlocked || this.inputAdmission?.stopOwner && this.inputWakeStopped)
            return;
        if (this.phase.kind !== 'idle') {
            // Maintenance and aborted drivers cannot deliver the wake: latch it for
            // replay at convergence. Live drivers claim queued work themselves;
            // disposal never latches, so teardown waits on no model turn.
            const reason = abortedCancelCause(this.phase.abort.signal);
            if (reason?.kind !== 'disposed' && (this.phase.kind === 'maintenance' || wakeAfterAbort
                || (this.phase.kind === 'running' && this.phase.programmatic !== undefined))) {
                this.phase.wakeRequested = true;
            }
            return;
        }
        const driver = Promise.withResolvers();
        this.activityDone = driver.promise;
        this.setPhase({
            kind: 'running',
            abort: new AbortController(),
            turn: this.phase.lastTurn,
            step: 0,
            wakeRequested: false,
        });
        this.loopCtx.agents.withInitiator(this, () => this.kick()).then(driver.resolve, driver.reject);
    }
    async whenIdle() {
        let activity;
        do {
            await (activity = this.activityDone);
            if (this.inputStop)
                await this.whenInputStopSettled();
        } while (activity !== this.activityDone);
    }
    /** Report one failure at its live boundary, then preserve it for driver containment. */
    throwError(error) {
        const turn = this.phase.kind === 'running' ? this.phase.turn : this.phase.lastTurn;
        const step = this.phase.kind === 'running' ? this.phase.step : 0;
        this.dispatch.emit('agent/error', { turn, step, error });
        throw error;
    }
    async kick() {
        try {
            while (await this.turn()) { }
        }
        catch (_error) {
            // Reported failures and cancellation are contained at the driver boundary.
        }
        finally {
            if (this.inputStop)
                await this.whenInputStopSettled();
            /* v8 ignore next -- kick owns a running phase until this driver boundary */
            if (this.phase.kind === 'running') {
                const { turn, wakeRequested } = this.phase;
                const blocked = this.inputAdmissionBlocked;
                // Only a blocked owner work needs its association after driver release.
                // A completed work must not be included in an unrelated idle stop.
                if (!blocked && !this.inputCompletionBlocked)
                    this.inputStopWork = undefined;
                this.inputAdmissionBlocked = undefined;
                this.existingInputWork = undefined;
                this.inputOnlyWakeLatched = false;
                if (!this.inputCompletionBlocked)
                    this.inputAdmission?.nominations?.clear();
                this.setPhase({ kind: 'idle', lastTurn: turn });
                if (blocked) {
                    // Notify only after reservation release; never await owner recovery.
                    if (blocked.registration.active && !this.inputDisposed) {
                        try {
                            blocked.registration.hook.onBlocked?.(blocked.notice);
                        }
                        catch { /* notification cannot restart input */ }
                    }
                }
                else if (wakeRequested && this.inbox.hasPending)
                    this.wakeDriver();
            }
        }
    }
    async preStep(target, position, offered, previousAdmission) {
        /* v8 ignore next -- private callers establish the running phase before proposing a step */
        if (this.phase.kind !== 'running')
            throw new Error(`agent "${this.id}": pre-step outside running phase`);
        // A readable old assistant-only transcript cannot acquire a later system
        // head. Refuse before claim, leaving the original input durably pending.
        this.systemPrompt.assertCanProject();
        const signal = this.phase.abort.signal;
        const registration = this.inputAdmission;
        if (previousAdmission && (!previousAdmission.registration.active || registration !== previousAdmission.registration)) {
            this.abortInput(previousAdmission, 'INPUT_HOOK_CHANGED', 'claim', previousAdmission.claim);
        }
        let admission = offered;
        let supplementalMessages;
        if (!admission && registration && !this.phase.programmatic) {
            if (previousAdmission?.ownedContinuations && previousAdmission.receipt && target === 'next-step') {
                let proposal;
                try {
                    proposal = this.inbox.propose(target);
                }
                catch {
                    this.abortInput(previousAdmission, 'INPUT_OWNERSHIP_UNKNOWN', 'claim');
                }
                if (proposal.messages.length) {
                    const owned = this.claimSupplement(previousAdmission, proposal, position);
                    admission = owned.admission;
                    supplementalMessages = owned.messages;
                }
                else
                    admission = { ...previousAdmission, continuation: true };
            }
            else if (previousAdmission?.completedWorkRequired && target === 'next-step') {
                let proposal;
                try {
                    proposal = this.inbox.propose(target);
                }
                catch {
                    this.abortInput(previousAdmission, 'INPUT_OWNERSHIP_UNKNOWN', 'claim');
                }
                if (proposal.messages.length) {
                    // A terminal owner cannot be replaced by re-admitting a different
                    // work. Only its paired nominated continuation can join this turn.
                    this.abortInput(previousAdmission, 'INPUT_COMPLETION_OWNER_CHANGED', 'claim', previousAdmission.claim, proposal);
                }
                admission = { ...previousAdmission, continuation: true };
            }
            else {
                const result = await this.admitInput(target);
                if (result.kind === 'blocked')
                    return { kind: 'reject' };
                if (result.kind === 'admitted')
                    admission = result.admission;
            }
            if (!admission) {
                // A tool result can require another request with no new queued input.
                // Preserve its work identity rather than claiming or admitting again.
                if (!previousAdmission?.claim || previousAdmission.claim.turn !== position.turn) {
                    const proposal = this.inbox.propose(target);
                    this.blockInput(registration, 'INPUT_CONTINUATION_WITHOUT_IDENTITY', 'claim', proposal);
                    this.cancel({ kind: 'hook', reason: INPUT_ADMISSION_ABORT_REASON }, { keepInbox: true });
                    signal.throwIfAborted();
                    return { kind: 'reject' };
                }
                admission = { ...previousAdmission, continuation: true };
            }
        }
        let claimed;
        if (admission) {
            signal.throwIfAborted();
            if (!admission.registration.active || this.inputAdmission !== admission.registration)
                this.abortInput(admission, 'INPUT_HOOK_CHANGED', 'claim');
            if (admission.continuation) {
                claimed = supplementalMessages ?? [];
            }
            else if (admission.resumeProof) {
                const claim = this.inbox.resumeClaim(admission.resumeProof, position.turn);
                if (!claim)
                    this.abortInput(admission, 'INPUT_RESUME_CHANGED', 'claim');
                admission.claim = claim;
                this.existingInputWork = undefined;
                claimed = [...claim.messages];
            }
            else {
                const result = this.inbox.claimExact(admission.proposal, position.turn);
                if (result.kind === 'blocked')
                    this.abortInput(admission, 'INPUT_PROPOSAL_CHANGED', 'claim', result.claim);
                admission.claim = result.claim;
                claimed = [...result.claim.messages];
            }
            const claim = admission.claim;
            if (!claim || !this.inbox.matchesClaim(claim))
                this.abortInput(admission, 'INPUT_CLAIM_CHANGED', 'claim', claim);
            // Claimed notifications run synchronously and can invalidate Source/head.
            // Do not start assembly or owner preparation under that stale identity.
            this.checkInput(admission, claimed);
        }
        else
            claimed = this.inbox.claim(target, position.turn);
        const assembled = await this.loopCtx.systemPrompt.assemble(assembleContextFor(this, signal));
        const generation = position.step === 1 ? this.phase.programmatic : undefined;
        const assembly = generation ? { ...assembled, tools: [], sections: [...assembled.sections,
                { name: 'programmatic:opening-regenerate', text: generation.instruction, interpolate: false }] } : assembled;
        signal.throwIfAborted();
        const sections = renderContextSections(assembly);
        const context = this.runtimeContext.project(joinContextSections(sections), sections);
        const decision = await this.dispatch.waterfall('agent/pre-step', { messages: claimed, ...position, signal }, () => Promise.resolve({
            kind: 'enter',
            messages: context === undefined ? claimed : [...claimed, context],
        }));
        signal.throwIfAborted();
        if (decision.kind === 'reject')
            return decision;
        if (!generation)
            return { ...decision, assembly, ...(admission ? { admission } : {}) };
        if (decision.messages.some(message => message.source.kind === 'user')) {
            throw new Error('programmatic generation cannot admit a player message');
        }
        const systemSections = decision.systemSections ?? [];
        const contextSections = decision.messages.map(message => message.content
            .filter(block => block.type === 'text').map(block => block.text).join('')).filter(Boolean);
        const effectiveAssembly = { ...assembly, sections: [...assembly.sections,
                ...[...systemSections, ...contextSections].map((content, index) => ({
                    name: `programmatic:context:${index}`, text: content, interpolate: false,
                }))] };
        return { ...decision, messages: [], assembly: effectiveAssembly };
    }
    /** Whether the assembled tool schemas differ from the logged request header's. */
    toolsChanged(tools) {
        const baseline = this.session.requestHeader();
        if (baseline === undefined)
            return false;
        return !headerEquals(baseline, canonicalHeader({ ...baseline, tools: [...tools] }));
    }
    /** Await the actual flush and publisher, including a cancelled in-flight
     * write. Racing abort here would release the driver before Source settles. */
    async completeInputWork(admission, end, signal) {
        const state = this.inputCompletion, checkpoint = admission.receipt;
        if (!state || !checkpoint || state.registration !== admission.registration)
            return false;
        const fail = (code) => {
            state.result = Object.freeze({ ...state.result, status: 'unknown', code });
            // Notify the original owner after driver release, with its own refs.
            // This notice reports failure; it never unlocks the terminal gate.
            this.blockInput(admission.registration, code, 'final', admission.proposal, admission.claim);
            return false;
        };
        const live = () => !signal.aborted && !this.inputStop && !this.inputDisposed
            && admission.registration.active && this.inputAdmission === admission.registration
            && this.inputCompletion === state;
        if (state.result.status !== 'pending')
            return false;
        if (!live()) {
            if (this.inputStop)
                await this.whenInputStopSettled();
            return fail('INPUT_COMPLETION_REVOKED');
        }
        try {
            const flushed = await this.ctx.sessions.flush(this.session);
            if (!live()) {
                if (this.inputStop)
                    await this.whenInputStopSettled();
                return fail('INPUT_COMPLETION_REVOKED');
            }
            if (!flushed)
                return fail('INPUT_COMPLETION_FLUSH_FAILED');
            const receipt = admission.claim
                ? nativeCompletedInputReceipt(this.session, checkpoint, admission.claim, admission.supplement, end) : undefined;
            const hook = admission.registration.hook;
            if (!receipt || hook.schemaVersion !== 2 || !hook.completedWork)
                return fail('INPUT_COMPLETION_PROOF_INVALID');
            state.result = Object.freeze({ status: 'pending', checkpoint, receipt });
            // Never use awaitInputOperation: the owner token is synchronously revoked
            // by onStop, but a commit already issued may still become durable.
            const acknowledgement = await hook.completedWork(receipt, signal);
            const checked = nativeCompletedInputAcknowledgement(acknowledgement, receipt);
            if (!live()) {
                if (this.inputStop)
                    await this.whenInputStopSettled();
                return fail('INPUT_COMPLETION_REVOKED');
            }
            const current = nativeCompletedInputReceipt(this.session, checkpoint, admission.claim, admission.supplement, end);
            if (!current || nativeInputSha256(current) !== nativeInputSha256(receipt))
                return fail('INPUT_COMPLETION_PROOF_CHANGED');
            // The callback may have moved Source/head. Rechecking the old input
            // currency here would incorrectly reject its own successful commit.
            if (checked.status === 'none')
                return fail('INPUT_COMPLETION_ACK_INVALID');
            state.result = checked;
            if (checked.status !== 'settled') {
                this.blockInput(admission.registration, checked.code ?? 'INPUT_COMPLETION_BLOCKED', 'final', admission.proposal, admission.claim);
                return false;
            }
            admission.registration.nominations?.clear();
            return true;
        }
        catch {
            if (this.inputStop)
                await this.whenInputStopSettled();
            return fail(signal.aborted ? 'INPUT_COMPLETION_REVOKED' : 'INPUT_COMPLETION_OPERATION_FAILED');
        }
    }
    /** Open one turn before claiming its first proposed step. */
    async turn() {
        if (this.phase.kind !== 'running') {
            this.throwError(new Error(`agent "${this.id}": turn without driver reservation`));
        }
        const phase = this.phase;
        const { signal } = phase.abort;
        if (this.inputCompletionBlocked)
            return false;
        signal.throwIfAborted();
        const requiresAdmission = this.inputAdmission !== undefined && !phase.programmatic;
        const initial = requiresAdmission ? await this.admitInput('next-turn') : undefined;
        if (requiresAdmission && initial?.kind !== 'admitted')
            return false;
        const initialAdmission = initial?.kind === 'admitted' ? initial.admission : undefined;
        const requiresCompletion = initialAdmission?.completedWorkRequired === true;
        signal.throwIfAborted();
        if (initialAdmission && (!initialAdmission.registration.active || this.inputAdmission !== initialAdmission.registration
            || !this.inbox.matches(initialAdmission.proposal))) {
            this.blockInput(initialAdmission.registration, 'INPUT_PROPOSAL_CHANGED', 'proposal', initialAdmission.proposal);
            return false;
        }
        const turn = phase.turn + 1;
        try {
            const start = this.session.append('turn/start', { turn,
                ...(initialAdmission?.marker ? { nativeInputLink: initialAdmission.marker } : {}) });
            if (initialAdmission?.marker)
                initialAdmission.startSeq = start.seq;
        }
        catch (error) {
            this.throwError(error);
        }
        phase.turn = turn;
        let turnEnds = null;
        let target = 'next-turn';
        let currentAdmission = initialAdmission;
        let capturedEnd;
        try {
            while (true) {
                signal.throwIfAborted();
                const step = phase.step + 1;
                const decision = await this.preStep(target, { turn, step }, step === 1 ? initialAdmission : undefined, currentAdmission);
                if (decision.kind === 'reject') {
                    turnEnds = { kind: 'blocked' };
                    return false;
                }
                currentAdmission = decision.admission;
                if (turnEnds && decision.messages.length === 0)
                    break;
                // A removed waking message or an enter decision rewritten to empty
                // still owns the initial turn boundary, but it spends no model call.
                if (phase.step === 0 && decision.messages.length === 0 && !phase.programmatic) {
                    turnEnds = { kind: 'completed' };
                    return false;
                }
                signal.throwIfAborted();
                const stepStart = this.session.append('step/start', { turn, step });
                phase.step = step;
                try {
                    if (step === 1 && decision.admission)
                        await this.checkpointInput(decision.admission, stepStart.seq, decision.messages);
                    // max-tokens is sticky: once any step hits the ceiling, later steps
                    // that complete normally must not downgrade the turn outcome.
                    const stepEnd = await this.step(decision);
                    // max-tokens stays sticky: a later completed step must not
                    // downgrade the turn outcome.
                    if (turnEnds === null || turnEnds.kind !== 'max-tokens')
                        turnEnds = stepEnd;
                }
                finally {
                    this.session.append('step/end', { turn, step });
                }
                signal.throwIfAborted();
                if (turnEnds && this.inbox.nextStep.length === 0) {
                    await this.dispatch.serial('agent/turn-stopping', { turn, signal });
                    signal.throwIfAborted();
                }
                if (turnEnds && this.inbox.nextStep.length === 0)
                    break;
                target = 'next-step';
            }
            // Source/base currency remains immutable through all maintenance. After
            // the closing publisher moves it, only its terminal receipt is checked.
            if (requiresCompletion && currentAdmission)
                this.checkInput(currentAdmission, []);
        }
        catch (error) {
            // A cause is present exactly while the signal is aborted.
            const cause = abortedCancelCause(signal);
            if (cause !== undefined) {
                turnEnds = { kind: 'aborted', reason: cause };
                throw error;
            }
            // Every failure is structured: an `LlmError` keeps its facts, anything
            // else flattens to `errorChain` text under the `UNKNOWN` code.
            turnEnds = {
                kind: 'error',
                error: error instanceof LlmError
                    ? error.failure
                    : { message: errorChain(error), code: 'UNKNOWN' },
            };
            this.throwError(error);
        }
        finally {
            if (requiresCompletion && currentAdmission?.receipt) {
                this.inputCompletion = { registration: currentAdmission.registration,
                    result: Object.freeze({ status: turnEnds?.kind === 'completed' ? 'pending' : 'blocked',
                        checkpoint: currentAdmission.receipt,
                        ...(turnEnds?.kind === 'completed' ? {} : { code: 'INPUT_COMPLETION_TURN_NOT_COMPLETED' }) }) };
                if (turnEnds?.kind !== 'completed')
                    this.blockInput(currentAdmission.registration, 'INPUT_COMPLETION_TURN_NOT_COMPLETED', 'final', currentAdmission.proposal, currentAdmission.claim);
            }
            else {
                if (requiresCompletion) {
                    // No first checkpoint cannot be repaired by replaying a new turn.
                    this.programmaticTurnPoisoned = true;
                }
                currentAdmission?.registration.nominations?.clear();
            }
            try {
                // oxlint-disable-next-line typescript/no-non-null-assertion -- every exit assigns a turn ending
                capturedEnd = this.session.append('turn/end', { turn, reason: turnEnds });
            }
            catch (error) {
                if (this.inputCompletionBlocked && this.inputCompletion)
                    this.inputCompletion.result = Object.freeze({
                        status: 'unknown', checkpoint: this.inputCompletion.result.checkpoint, code: 'INPUT_COMPLETION_END_UNKNOWN'
                    });
                if (requiresCompletion && currentAdmission)
                    this.blockInput(currentAdmission.registration, 'INPUT_COMPLETION_END_UNKNOWN', 'final', currentAdmission.proposal, currentAdmission.claim);
                this.throwError(error);
            }
        }
        // Outside the turn's try/finally: a failed terminal operation must never
        // append a second end or relabel the already-completed turn as aborted.
        if (requiresCompletion && currentAdmission
            && !await this.completeInputWork(currentAdmission, capturedEnd, signal))
            return false;
        if (phase.programmatic || !this.inbox.hasPending)
            return false;
        phase.abort = new AbortController();
        // A fresh controller makes a latch set on the old one stale: the live driver claims the queue itself.
        phase.wakeRequested = false;
        phase.step = 0;
        return true;
    }
    async step(decision) {
        /* v8 ignore next -- private callers establish the running phase before executing a step */
        if (this.phase.kind !== 'running')
            throw new Error(`agent "${this.id}": step outside running phase`);
        const { turn, step, abort: { signal } } = this.phase;
        signal.throwIfAborted();
        const { assembly } = decision;
        const renderedPrompt = renderPrompt(assembly);
        let firstAttempt = true;
        while (true) {
            const { config, preparedCall } = await this.prepareRequest(turn, step, signal);
            // Adapter preparation can await arbitrary work. Recheck before every
            // system/user/header commit and provider stream, including retries.
            const admission = decision.admission;
            if (admission)
                this.checkInput(admission, decision.messages);
            const startsRequestSeries = firstAttempt && decision.startsRequestSeries === true;
            const commits = this.systemPrompt.project(renderedPrompt, {
                inHistory: preparedCall?.systemPromptUpdate === 'in-history',
                startsSeries: startsRequestSeries
                    || this.requestSurfaceGeneration !== this.session.surface.contentGeneration
                    || (preparedCall?.toolUpdate === undefined && this.toolsChanged(assembly.tools)),
            });
            for (const { message, intent } of commits) {
                this.session.append('system/message', { turn, step, message }, intent);
            }
            if (firstAttempt) {
                for (const message of decision.messages) {
                    this.session.append('user/message', message, { surfaceOp: 'append' });
                }
            }
            firstAttempt = false;
            const request = this.buildRequest(config, preparedCall, assembly.tools, { turn, step }, startsRequestSeries, signal);
            // Session append notifications can synchronously invalidate Source or
            // readiness. The already-written input is admitted, never replayable.
            if (admission)
                this.checkInput(admission, decision.messages);
            const live = new AssistantStreamAttempt(this.session.id, ++this.assistantAttemptCounter, () => ++this.assistantStreamRevision, turn, step, (frame) => { this.dispatch.emit('agent/assistant-stream', { frame }); });
            let started = false;
            try {
                if (admission)
                    signal.throwIfAborted();
                const stream = preparedCall?.stream(request) ?? this.loopCtx.llm.stream(request);
                signal.throwIfAborted();
                live.start();
                started = true;
                for await (const chunk of stream) {
                    signal.throwIfAborted();
                    live.push(chunk);
                }
                signal.throwIfAborted();
            }
            catch (error) {
                if (!started)
                    throw error;
                try {
                    if (signal.aborted) {
                        const content = live.interruptedBlocks();
                        if (content.length > 0) {
                            live.settle('assistant/message', () => this.session.append('assistant/message', {
                                turn,
                                step,
                                message: createAssistantMessage({
                                    content,
                                    source: {
                                        provider: request.provider,
                                        model: request.model,
                                        ...live.replayState === undefined ? {} : { replayState: live.replayState },
                                    },
                                }),
                                interrupted: true,
                                ...live.usage === undefined ? {} : { usage: live.usage },
                                stream: live.stream,
                            }, { surfaceOp: 'append' }).seq);
                        }
                        else {
                            live.settle('assistant/attempt', () => this.session.append('assistant/attempt', { turn, step, stream: live.stream }).seq);
                        }
                    }
                    else {
                        live.settle('assistant/attempt', () => this.session.append('assistant/attempt', { turn, step, stream: live.stream }).seq);
                    }
                }
                catch (settlementError) {
                    throw new AggregateError([error, settlementError], 'Assistant stream failed and its durable settlement was rejected', { cause: error });
                }
                throw error;
            }
            try {
                const finish = live.finish;
                if (finish.kind === 'error' || finish.kind === 'aborted') {
                    live.settle('assistant/attempt', () => this.session.append('assistant/attempt', { turn, step, stream: live.stream }).seq);
                    const action = await this.dispatch.waterfall('agent/request-error', {
                        turn,
                        step,
                        provider: request.provider,
                        failure: finish.failure,
                        retryPolicy: preparedCall?.retryPolicy,
                        signal,
                    }, () => Promise.resolve(undefined));
                    signal.throwIfAborted();
                    if (action?.kind !== 'retry') {
                        throw new LlmError(finish.failure.message, finish.failure.code, finish.failure);
                    }
                    continue;
                }
                const createdMessage = createAssistantMessage({
                    content: live.blocks(),
                    source: {
                        provider: request.provider,
                        model: request.model,
                        ...live.replayState !== undefined ? { replayState: live.replayState } : {},
                    },
                });
                const message = this.phase.programmatic && step === 1
                    ? freezeMessage({ ...createdMessage, id: brandString(this.phase.programmatic.messageId) })
                    : createdMessage;
                live.settle('assistant/message', () => this.session.append('assistant/message', {
                    turn,
                    step,
                    message,
                    ...live.usage === undefined ? {} : { usage: live.usage },
                    stream: live.stream,
                }, { surfaceOp: 'append' }).seq);
                if (finish.kind === 'max-tokens')
                    return { kind: 'max-tokens' };
                const toolCalls = message.content.filter(block => block.type === 'tool-call');
                if (toolCalls.length === 0)
                    return { kind: 'completed' };
                const { concluded } = await executeToolCalls(this.loopCtx, turn, step, toolCalls, signal, context => this.inbox.splice('next-step', this.inbox.nextStep.length, 0, [context]));
                return concluded ? { kind: 'completed' } : null;
            }
            catch (error) {
                if (!live.ended)
                    live.abandon();
                throw error;
            }
        }
    }
    /** Resolve request config and bind its adapter before admitting model-visible input. */
    async prepareRequest(turn, step, signal) {
        const { session } = this;
        // A loop instance starts from its declared route, restoring only an explicit
        // effort owned by that exact model. Later steps re-resolve marked defaults.
        const persistedHeader = session.requestHeader();
        const persistedConfig = persistedHeader?.config;
        const route = { provider: this.options.provider ?? '', model: this.options.model ?? '' };
        const persistedReasoningEffort = persistedConfig?.provider === route.provider
            && persistedConfig.model === route.model
            && persistedHeader?.adapterDefaults?.reasoningEffort !== true
            ? persistedConfig.reasoningEffort
            : undefined;
        const reasoningEffort = this.options.reasoningEffort ?? persistedReasoningEffort;
        const maxTokens = this.options.maxTokens;
        const seedConfig = deepFreeze(structuredClone(this.requestHeaderLogged
            // oxlint-disable-next-line typescript/no-non-null-assertion -- the instance logged the header it now folds
            ? requestProposal(persistedHeader)
            : {
                ...route,
                ...reasoningEffort === undefined ? {} : { reasoningEffort },
                ...maxTokens === undefined ? {} : { maxTokens },
            }));
        const proposedConfig = await this.dispatch.waterfall('agent/request', { turn, step, signal }, () => Promise.resolve(seedConfig));
        signal.throwIfAborted();
        if (!proposedConfig.provider || !proposedConfig.model) {
            throw new Error(`agent "${this.id}" has no provider/model: set AgentOptions.provider and AgentOptions.model or supply both via the agent/request waterfall`);
        }
        let config;
        let preparedCall;
        try {
            preparedCall = await this.loopCtx.llm.prepareCall(proposedConfig, signal);
            config = preparedCall.config;
        }
        catch (error) {
            // Middleware may serve an unregistered route; terminal dispatch still requires an adapter.
            if (!(error instanceof LlmError) || error.code !== 'NO_ADAPTER')
                throw error;
            config = proposedConfig;
        }
        signal.throwIfAborted();
        return { config, ...preparedCall === undefined ? {} : { preparedCall } };
    }
    /** Log the resolved envelope and derive a frozen request from the admitted surface. */
    buildRequest(config, preparedCall, tools, position, startsRequestSeries, signal) {
        const { session } = this;
        const surfaceGeneration = session.surface.contentGeneration;
        const header = canonicalHeader({
            config,
            ...preparedCall === undefined ? {} : { adapterDefaults: preparedCall.adapterDefaults },
            ...tools.length > 0 ? { tools } : {},
        });
        const baseline = this.session.requestHeader();
        const startsSeries = startsRequestSeries
            || this.requestSurfaceGeneration !== surfaceGeneration;
        let headerSeq;
        if (!this.requestHeaderLogged) {
            // Compaction during the first resumed pre-step must still mark a new series.
            headerSeq = this.session.append('request/header', {
                header,
                reason: baseline === undefined ? 'initial' : 'resume',
                ...startsSeries ? { startsSeries: true } : {},
            }).seq;
            this.requestHeaderLogged = true;
        }
        else if (baseline === undefined || !headerEquals(baseline, header)) {
            headerSeq = this.session.append('request/header', {
                header,
                reason: 'change',
                ...startsSeries ? { startsSeries: true } : {},
            }).seq;
        }
        else if (startsSeries) {
            this.session.append('request/header', { header, reason: 'series' });
        }
        if (baseline !== undefined && headerSeq !== undefined) {
            const previousNames = new Set(baseline.tools?.map(tool => tool.name));
            const currentNames = new Set(tools.map(tool => tool.name));
            const additions = tools.filter(tool => !previousNames.has(tool.name))
                .map(tool => ({ type: 'tool-addition', toolName: tool.name }));
            const removals = (baseline.tools ?? []).filter(tool => !currentNames.has(tool.name))
                .map(tool => ({ type: 'tool-removal', toolName: tool.name }));
            if (additions.length > 0 || removals.length > 0) {
                session.append('developer/message', {
                    ...position,
                    message: createDeveloperMessage({ source: { kind: 'tool-registry' }, content: [...additions, ...removals] }),
                    ...additions.length > 0 ? { headerSeq } : {},
                }, { surfaceOp: 'append' });
            }
        }
        this.requestSurfaceGeneration = surfaceGeneration;
        const contextWindow = preparedCall?.context?.contextWindow;
        const systemPromptUpdate = preparedCall?.systemPromptUpdate;
        const requestContext = {
            provider: config.provider,
            model: config.model,
            ...contextWindow === undefined ? {} : { contextWindow },
            ...systemPromptUpdate === undefined ? {} : { systemPromptUpdate },
        };
        const previousContext = session.requestContext();
        if (previousContext?.provider !== requestContext.provider
            || previousContext.model !== requestContext.model
            || previousContext.contextWindow !== requestContext.contextWindow
            || previousContext.systemPromptUpdate !== requestContext.systemPromptUpdate) {
            session.append('request/context', requestContext);
        }
        signal.throwIfAborted();
        // canonicalHeader is shallow; append logs a detached snapshot, not these local values.
        deepFreeze(header);
        const boundaryMessages = session.deriveMessages();
        for (const message of boundaryMessages) {
            if (this.frozenMessages.has(message))
                continue;
            deepFreeze(message);
            this.frozenMessages.add(message);
        }
        Object.freeze(boundaryMessages);
        const request = markAgentLoopRequest(Object.freeze({
            ...header.config,
            messages: boundaryMessages,
            toolHistory: session.toolHistory(),
            ...header.tools !== undefined ? { tools: header.tools } : {},
            sessionId: this.session.id,
            signal,
        }));
        return request;
    }
}
