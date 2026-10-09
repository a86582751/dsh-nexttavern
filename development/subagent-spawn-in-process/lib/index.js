// Generated from runtime/alpha3/compat/subagent-spawn-in-process/src/index.ts; edit the TypeScript source.
/**
 * The in-process SPAWN subagent backend: registers a {@link SubagentProvider} on
 * `ctx.subagents` that runs each child as a fresh child {@link Agent} on the same cordis
 * context (its own session, own system prompt, zero parent context). The cheapest transport,
 * reusing the agent factory's quiescent teardown.
 * @module @deepseek-ai/dsh-subagent-spawn-in-process
 */
import z from '@deepseek-ai/schemastery';
import { startInProcessRun } from '@deepseek-ai/dsh-subagent-in-process-driver';
export const name = 'subagent-spawn-in-process';
// `tools` is deliberately not injected: the child factory already provides it during setup,
// and adding it here would unnecessarily change this provider's apply timing.
export const inject = ['subagents'];
export const Config = z.object({
    providerName: z.string().default('spawn'),
});
/**
 * The spawn provider. Supports every start-time capability: `depthLimit` (it
 * constructs the child, so it can enforce a recursion cap), `outputSchema`
 * (the scoped structured runtime), `agentOptions` (merged over the parent
 * route), and `toolFilter`/`persona` (scoped `restrict()` and a scoped
 * shadowing persona section, applied in the child's creation window).
 */
class SpawnInProcessProvider {
    name;
    capabilities = {
        agentOptions: true,
        outputSchema: true,
        depthLimit: true,
        toolFilter: true,
        persona: true,
        ownedAuthorDialog: true,
        ownedRubyTask: true,
    };
    // Context contract: a spawned child starts fresh — it never sees the parent conversation.
    inheritsParentContext = false;
    constructor(name) {
        this.name = name;
    }
    start(request) {
        // Fresh child: no seed. The shared driver mints ids, stamps cwd/lineage/
        // depth, drives the one-shot (including the structured capture when the
        // request carries an outputSchema), and maps the result.
        return startInProcessRun(request, { rubyOwner: request.rubyOwner });
    }
    prepareContinuable() {
        // A spawned child starts fresh, so it contributes no seed; the continuation
        // manager owns every later operation on it.
        return Promise.resolve({});
    }
}
export function apply(ctx, config) {
    ctx.subagents.registerProvider(new SpawnInProcessProvider(config.providerName));
}
