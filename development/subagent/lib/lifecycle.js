// Generated from runtime/alpha3/compat/subagent/src/lifecycle.ts; edit the TypeScript source.
/** Lifecycle publication for the Native one-shot provider. */
import { randomUUID } from 'node:crypto';
import { SubagentRunId } from "./types.js";
/**
 * Build the contained lifecycle emitter this seam publishes every edge through.
 * Every listener is independently contained: a synchronous throw or a rejected
 * returned promise is logged without starving peer listeners, changing the run,
 * or — for provider removal, which fires from a disposer — breaking teardown.
 * @param ctx - the service's own context, owning dispatch and the logger.
 * @param carrier - resolve the scoped dispatch carrier for one delegating parent.
 * @returns the emitter both observers and the provider registry publish through.
 */
export function createLifecycleEmitter(ctx, carrier) {
    return (name, info, parent) => {
        const dispatchArgs = [carrier(parent), name, info];
        for (const callback of ctx.events.dispatch('emit', dispatchArgs)) {
            try {
                const returned = callback(info);
                void Promise.resolve(returned).catch((error) => {
                    ctx.logger.warn(`subagent: ${name} listener rejected: ${renderThrown(error)}`);
                });
            }
            catch (error) {
                ctx.logger.warn(`subagent: ${name} listener threw: ${renderThrown(error)}`);
            }
        }
    };
}
/**
 * Emit the start/end lifecycle pair for one accepted one-shot run.
 * @param emit - the contained lifecycle emitter.
 * @param provider - the provider that established the run.
 * @param parent - the delegating parent keying scoped dispatch.
 * @param run - the published run whose settlement closes the pair.
 * @returns the same run, unchanged.
 */
export function observeRun(emit, provider, parent, run) {
    const identity = {
        runId: SubagentRunId(randomUUID()),
        provider,
        parentSessionId: parent.id,
        id: run.id,
        local: run.localAgent !== undefined,
    };
    // Attach the terminal observer before dispatching start. Promise reactions
    // still run after this synchronous start emission, preserving start → end.
    void run.result.then((result) => {
        emit('subagent/end', {
            ...identity,
            stopReason: result.stopReason,
            // Omit the field when no output exists, matching continuable epochs.
            ...result.output.length === 0 ? {} : { lastAssistantMessage: result.output },
        }, parent);
    }, () => {
        emit('subagent/end', { ...identity, stopReason: 'error' }, parent);
    });
    emit('subagent/start', identity, parent);
    return run;
}
function renderThrown(value) {
    try {
        return value instanceof Error ? `${value.name}: ${value.message}` : String(value);
    }
    catch {
        return '<unrenderable thrown value>';
    }
}
