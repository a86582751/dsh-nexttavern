// Generated from runtime/alpha3/src/ui/author-native-mvu-trial.ts; edit the TypeScript source.
import { AUTHOR_NATIVE_MVU_HOOK_EVENTS } from '../core/author-native-mvu-hook-types.js';
/** Serialized into each author realm. Each invocation retains its own graph,
 * including objects detached by an earlier callback in this same event. */
export function createAuthorNativeMvuTrialEvents(createGraph, listeners, dispatch, hookEvents = AUTHOR_NATIVE_MVU_HOOK_EVENTS) {
    const stages = Object.keys(hookEvents).filter(stage => stage !== 'initialized' && stage !== 'before-message-update');
    return {
        interests: () => {
            const registered = new Set(listeners().map(row => row.event));
            return stages.filter(stage => registered.has(hookEvents[stage]));
        },
        async invoke(stage, wire) {
            const graph = createGraph(), roots = graph.materialize(wire), args = roots[2];
            await dispatch(hookEvents[stage], args);
            return graph.capture(roots);
        },
    };
}
/** The live computation belongs to Core. UI delivers only the captured mutable
 * events and releases that same handle, including after a failed callback. */
export async function runAuthorNativeMvuTrial(input) {
    const { transport, hooks, signal, trialId } = input;
    const check = () => {
        signal.throwIfAborted();
        if (!transport.current())
            throw Error('AUTHOR_NATIVE_MVU_TRIAL_REVOKED');
    };
    try {
        check();
        let output = await transport.begin({ trialId, message: input.message, oldData: input.oldData, interests: hooks.interests });
        for (;;) {
            check();
            if (output.kind !== 'accepted')
                throw Error(output.diagnostics[0]?.code ?? 'AUTHOR_NATIVE_MVU_TRIAL_FAILED');
            const update = output.update;
            if (update?.kind === 'complete')
                return { ...output.context, stat_data: output.values };
            if (update?.kind !== 'yield')
                throw Error('AUTHOR_NATIVE_MVU_TRIAL_OUTPUT_INVALID');
            const graph = await hooks.invoke(update.stage, update.graph);
            check();
            output = await transport.advance(trialId, { updateId: update.updateId, yieldOrdinal: update.yieldOrdinal,
                graph, interests: hooks.interests });
        }
    }
    finally {
        // Release uses the original handle even when its browser binding expired.
        // It grants no further computation or callback after revocation.
        await transport.close(trialId);
    }
}
