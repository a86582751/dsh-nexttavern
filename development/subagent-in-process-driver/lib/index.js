// Generated from runtime/alpha3/compat/subagent-in-process-driver/src/index.ts; edit the TypeScript source.
/**
 * Shared driver for in-process ONE-SHOT subagent providers. The agent factory's
 * creation transaction owns unpublished setup and rollback; after publication
 * the returned AgentHandle is the one quiescent lifecycle owner held by the
 * provider's caller.
 *
 * Continuable children never come through here: the continuation manager
 * composes and drives them directly, so this driver owns exactly one turn with
 * one result.
 *
 * @module @deepseek-ai/dsh-subagent-in-process-driver
 */
import { randomUUID } from 'node:crypto';
import { brandString } from '@deepseek-ai/dsh-brand';
import { foldConsumedWork } from '@deepseek-ai/dsh-agent';
import { SessionLogOffset } from '@deepseek-ai/dsh-session';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { nativeInputAdmissionCapability } from '@deepseek-ai/dsh-agent-loop';
import { appendDelegatedPolicyOverrides, applyChildComposition, assertSubagentMaxDepth, captureDelegatedPolicyOverrides, childSessionMeta, finalAssistantOutput, resolveChildAgentOptions, resolveChildDepth, composeOwnedAuthorDialogActivationV1, driveOwnedAuthorDialogActivationV1, } from '@deepseek-ai/dsh-subagent';
import { attachStructuredRuntime, } from "./structured.js";
import { composeOwnedRubyTaskActivationV1 } from "./ruby-task-child.js";
export { STRUCTURED_OUTPUT_TOOL, STRUCTURED_OUTPUT_INSTRUCTION, } from "./structured.js";
/** Map a session turn outcome to the subagent seam's terminal vocabulary. */
function toStopReason(reason) {
    switch (reason?.kind) {
        case 'completed':
            return 'completed';
        case 'max-tokens':
            return 'max-tokens';
        case 'aborted':
            return 'aborted';
        // A pre-step rejection discarded the claimed prompt: the task was
        // declined, and the caller must not read the run as done.
        case 'blocked':
            return 'refusal';
        case 'error':
        case 'interrupted':
        default:
            return 'error';
    }
}
/** Error used when cancellation wins before the child publication boundary. */
function prePublicationAbort() {
    return new Error('subagent request was aborted before child publication');
}
/** Append one one-shot descriptor inside the child's initial turn before its first request. */
function attachDescriptorAppend(childCtx, descriptor) {
    let appended = false;
    childCtx.on('agent/pre-step', async ({ agent }, next) => {
        const decision = await next();
        if (!appended && decision.kind === 'enter') {
            appended = true;
            agent.session.append('subagent/descriptor', descriptor);
        }
        return decision;
    });
}
/**
 * Establish and drive one in-process one-shot child. Fulfillment means the agent
 * is already published in the registry and transfers its turn, cancellation,
 * and disposal work through the returned run. Rejection means the agent
 * factory's unpublished creation transaction reached quiescence without
 * publishing a child. Every start appends its resolved descriptor inside the
 * child's initial turn.
 * @param request - the trusted typed start request, including its required signal.
 * @param options - the optional fork seed.
 * @returns a published holder-owned run.
 */
export async function startInProcessRun(request, options) {
    assertSubagentMaxDepth(request.maxDepth);
    if (request.signal.aborted)
        throw prePublicationAbort();
    const parent = request.parent;
    const childDepth = resolveChildDepth(parent, request.maxDepth);
    const childId = brandString(randomUUID());
    const seed = options.seed;
    if (request.activation !== undefined && seed !== undefined)
        throw Error('owned author dialogue cannot inherit history');
    const rubyActivation = request.rubyActivation, rubyOwner = options.rubyOwner;
    if (rubyActivation !== undefined && seed !== undefined)
        throw Error('owned Ruby task cannot inherit history');
    if (rubyActivation !== undefined && rubyOwner === undefined)
        throw Error('owned Ruby task live owner unavailable');
    const activationBoundary = SessionLogOffset(seed?.length ?? 0);
    // Capture before the first await: a later parent switch belongs to the
    // parent's future.
    const inherited = captureDelegatedPolicyOverrides(parent);
    let structured;
    let rubyChild;
    const setup = (childCtx, child) => {
        appendDelegatedPolicyOverrides(child.session, inherited);
        applyChildComposition(childCtx, parent, {
            persona: request.persona,
            toolFilter: rubyActivation !== undefined ? { allow: [] } : request.toolFilter,
        });
        if (request.activation !== undefined)
            composeOwnedAuthorDialogActivationV1(childCtx, request.activation);
        if (rubyActivation !== undefined) {
            const native = nativeInputAdmissionCapability(child);
            if (!native)
                throw Error('owned Ruby task Native input capability unavailable');
            rubyChild = composeOwnedRubyTaskActivationV1(childCtx, native, rubyActivation, rubyOwner);
        }
        if (request.outputSchema !== undefined) {
            structured = attachStructuredRuntime(childCtx, request.outputSchema);
        }
        attachDescriptorAppend(childCtx, request.descriptor);
    };
    const handle = await parent.ctx.agents.create({
        sessionId: childId,
        parentAgent: parent,
        meta: childSessionMeta(parent, childDepth, seed !== undefined),
        ...seed !== undefined ? { seed } : {},
        ...seed === undefined ? {} : { inheritedEventCount: activationBoundary },
        agentOptions: resolveChildAgentOptions(parent, request.agentOptions, childDepth),
        signal: request.signal,
        setup,
    });
    return drivePublishedRun(handle, request.signal, request.prompt, childId, activationBoundary, structured, request.activation, rubyChild);
}
/**
 * Wrap a published child in the single run lifecycle that owns signal handoff,
 * one turn, result settlement, and quiescent disposal.
 */
function drivePublishedRun(handle, signal, prompt, childId, boundary, structured, activation, rubyChild) {
    const child = handle.agent;
    const flags = { cancelled: false };
    const onAbort = () => {
        flags.cancelled = true;
        child.cancel({ kind: 'parent' });
    };
    signal.addEventListener('abort', onAbort, { once: true });
    // Agent creation detaches its creation-only listener before returning. The
    // post-registration check closes that handoff without treating an already
    // published child as a failed start.
    if (signal.aborted)
        onAbort();
    const result = (async () => {
        try {
            if (!flags.cancelled) {
                if (rubyChild !== undefined) {
                    child.followup(rubyChild.userMessage);
                    await child.whenIdle();
                }
                else if (activation !== undefined) {
                    await driveOwnedAuthorDialogActivationV1(child, activation);
                }
                else {
                    child.followup(createUserMessage({ content: prompt, source: { kind: 'user' } }));
                    await child.whenIdle();
                }
            }
            return readResult(child, boundary, flags.cancelled, structured ? { captured: structured.captured() } : undefined);
        }
        finally {
            signal.removeEventListener('abort', onAbort);
        }
    })();
    return {
        id: childId,
        localAgent: child,
        result,
        async dispose() {
            signal.removeEventListener('abort', onAbort);
            flags.cancelled = true;
            const settlements = await Promise.allSettled([handle.dispose(), result]);
            const disposal = settlements[0];
            // The result channel owns run faults; disposal reports only failure to
            // release the published handle after both operations settle.
            if (disposal.status === 'rejected')
                throw disposal.reason;
        },
    };
}
/** Read one settled child's result from events after its activation boundary. */
function readResult(child, boundary, cancelled, structured) {
    // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
    const own = child.session.snapshotEvents(boundary);
    // `droppedUnrun` is deliberately unread: a one-shot prompt is claimed by its
    // awaited first turn almost immediately, and the owner's own teardown is the
    // `cancelled` flag below. A cancellation with no accounting turn resolves
    // `error` through `toStopReason(undefined)`, which never overstates success.
    const lastEnd = foldConsumedWork(own).end;
    // The seam's canonical selection rule; a partial answer survives cancel and truncation.
    const output = finalAssistantOutput(own) ?? [];
    const recorded = toStopReason(lastEnd?.data.reason);
    // Disposal can tear the owner down before the loop records its ordinary
    // `aborted` end, yielding `disposed` instead.
    const stopReason = cancelled && recorded !== 'completed' ? 'aborted' : recorded;
    if (structured !== undefined) {
        if (structured.captured !== undefined) {
            return { output, structured: structured.captured.value, stopReason };
        }
        if (stopReason === 'completed')
            return { output, stopReason: cancelled ? 'aborted' : 'error' };
    }
    return { output, stopReason };
}
