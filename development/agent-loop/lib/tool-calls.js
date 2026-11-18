// Generated from runtime/alpha3/compat/agent-loop/src/tool-calls.ts; edit the TypeScript source.
import { ToolBatchExecutionError } from '@deepseek-ai/dsh-tools';
export async function executeToolCalls(ctx, agent, turn, step, calls, signal, toolSet, acceptContext) {
    const maxParallelToolCalls = ctx.agentLoop.config.maxParallelToolCalls.get();
    try {
        const result = await ctx.tools.execute({
            agent, log: { turn, step }, calls, signal, toolSet, maxParallelToolCalls,
        });
        for (const context of result.additionalContexts)
            acceptContext(context);
        return { concluded: result.concluded };
    }
    catch (error) {
        if (!(error instanceof ToolBatchExecutionError))
            throw error;
        for (const context of error.partial.additionalContexts)
            acceptContext(context);
        throw error.cause;
    }
}
