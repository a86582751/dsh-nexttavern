// Generated from runtime/alpha3/compat/subagent/src/index.ts; edit the TypeScript source.
import { scopeTarget } from '@deepseek-ai/dsh-scope';
import SubagentHost, { SUBAGENT_DESCRIPTOR_VERSION, } from '@deepseek-ai/dsh-subagent';
import { TYPERT } from '@deepseek-ai/dsh-subagent/typert';
import { assertObjectJsonSchema } from '@deepseek-ai/dsh-tools';
import { establishCatalogChild } from "./catalog.js";
import { assertSubagentMaxDepth } from "./depth.js";
import { SubagentError } from "./error.js";
import { createLifecycleEmitter, observeRun } from "./lifecycle.js";
import { readOwnedAuthorDialogActivationV1 } from "./author-dialog-activation.js";
import { readOwnedRubyTaskActivationV1 } from "./owned-ruby-task.js";
export { readOwnedRubyTaskActivationV1 } from "./owned-ruby-task.js";
export { composeOwnedAuthorDialogActivationV1, driveOwnedAuthorDialogActivationV1 } from "./author-dialog-activation.js";
export * from "./out-of-process.js";
export { AssistantOutputFold, finalAssistantOutput } from "./assistant-output.js";
export { SubagentRunId } from "./types.js";
export { SubagentError } from "./error.js";
export { settleRun } from "./run-settlement.js";
export { assertSubagentMaxDepth, delegationDepthOf } from "./depth.js";
export { appendDelegatedPolicyOverrides, applyChildComposition, captureDelegatedPolicyOverrides, childSessionMeta, parentAgentOptionsForDelegation, resolveChildAgentOptions, resolveChildDepth, SubagentDepthError, } from "./child-agent.js";
/** Keep the host activation manager and its remotes. Native author and Ruby
 * work add a one-shot operation on the same provider registration. */
export class SubagentRuntime extends SubagentHost {
    emitOwnedLifecycle;
    ownedRuns = new Map();
    constructor(ctx, config) {
        super(ctx, config);
        this.emitOwnedLifecycle = createLifecycleEmitter(this.ctx, parent => scopeTarget(this, parent));
        // The owned package is mounted by file URL, outside Typert package-name discovery.
        ctx.inject(['typert'], ({ typert }) => { typert.register(TYPERT); });
    }
    /**
     * Establish a published child on the named provider. Capability and semantic
     * checks run before delegation. Provider ownership lasts until its promise
     * fulfills; a rejection therefore has no run for the caller to dispose and
     * emits no run lifecycle events. Post-publication turn and infrastructure
     * failures settle through the returned run.
     * A catalog append failure disposes the run and handles its result rejection;
     * the caller receives the catalog error even if disposal also fails.
     * @param name - the provider to use.
     * @param request - child label, prompt, parent, signal, and optional capabilities.
     * @returns the published holder-owned run.
     */
    async start(name, request) {
        if (this.ctx.get('agents')?.get(request.parent.id) !== request.parent) {
            throw new SubagentError('The parent agent is no longer active', 'UNAUTHORIZED');
        }
        const provider = this.getProvider(name);
        if (!provider || !('startOwned' in provider) || typeof provider.startOwned !== 'function') {
            throw new SubagentError('No owned one-shot provider: ' + name, 'UNSUPPORTED_CAPABILITY');
        }
        const ownedProvider = provider;
        this.assertOwnedCapabilities(ownedProvider, request);
        assertSubagentMaxDepth(request.maxDepth);
        if (request.outputSchema !== undefined)
            assertObjectJsonSchema(request.outputSchema);
        const activation = request.activation === undefined ? undefined : readOwnedAuthorDialogActivationV1(request.activation);
        if ((activation === undefined) !== (request.authorOwner === undefined))
            throw Error('author generation requires its separate live owner');
        const rubyActivation = request.rubyActivation === undefined ? undefined : readOwnedRubyTaskActivationV1(request.rubyActivation);
        if ((rubyActivation === undefined) !== (request.rubyOwner === undefined))
            throw Error('owned Ruby task requires separate activation and live owner');
        if (rubyActivation !== undefined && (activation !== undefined || request.prompt.length !== 0
            || request.persona !== undefined || request.outputSchema !== undefined))
            throw Error('owned Ruby task cannot add another activation, user input, persona or structured output');
        if (activation !== undefined && (request.prompt.length !== 0 || request.persona !== undefined || request.outputSchema !== undefined))
            throw Error('owned author dialogue activation cannot add user input, persona or structured output');
        const descriptor = {
            version: SUBAGENT_DESCRIPTOR_VERSION,
            mode: 'one-shot',
            provider: name,
            ...request.label !== undefined ? { label: request.label } : {},
        };
        const resolved = { ...request, descriptor, activation, rubyActivation };
        const run = await ownedProvider.startOwned(resolved);
        const child = run.localAgent?.session;
        if (child !== undefined) {
            try {
                establishCatalogChild(request.parent.session, child.header, { mode: 'one-shot',
                    ...request.label === undefined ? {} : { label: request.label }, });
            }
            catch (error) {
                // No caller receives this run; the catalog error owns the failed start.
                void run.result.catch(() => undefined);
                try {
                    await run.dispose();
                }
                catch (cleanupError) {
                    this.ctx.logger.warn(`subagent: disposal after catalog append failure also failed: ${String(cleanupError)}`);
                }
                throw error;
            }
        }
        this.ownedRuns.set(run.id, run);
        const forget = () => {
            if (this.ownedRuns.get(run.id) === run)
                this.ownedRuns.delete(run.id);
        };
        void run.result.then(forget, forget);
        return observeRun(this.emitOwnedLifecycle, name, request.parent, run);
    }
    interrupt(childSessionId, authority) {
        // The inherited RPC authorizes this user on the target first. Native jobs
        // use their own holder, so the host activation manager cannot find them.
        const owned = authority.kind === 'user' ? this.ownedRuns.get(childSessionId)?.localAgent : undefined;
        if (owned) {
            owned.cancel({ kind: 'user' }, { keepInbox: true });
            return;
        }
        super.interrupt(childSessionId, authority);
    }
    /** Reject the first requested capability that the provider lacks. */
    assertOwnedCapabilities(provider, request) {
        const needs = [
            { when: request.agentOptions !== undefined, cap: 'agentOptions' },
            { when: request.outputSchema !== undefined, cap: 'outputSchema' },
            { when: request.maxDepth !== undefined, cap: 'depthLimit' },
            { when: request.toolFilter !== undefined, cap: 'toolFilter' },
            { when: request.persona !== undefined, cap: 'persona' },
            { when: request.isolatedSystem !== undefined, cap: 'isolatedSystem' },
            { when: request.activation !== undefined, cap: 'ownedAuthorDialog' },
            { when: request.rubyActivation !== undefined, cap: 'ownedRubyTask' },
        ];
        for (const { when, cap } of needs) {
            if (when && !provider.capabilities[cap]) {
                throw new SubagentError(`subagent provider "${provider.name}" does not support the "${cap}" capability`, 'UNSUPPORTED_CAPABILITY');
            }
        }
    }
}
export default SubagentRuntime;
