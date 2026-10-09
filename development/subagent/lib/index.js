// Generated from runtime/alpha3/compat/subagent/src/index.ts; edit the TypeScript source.
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { scopeTarget } from '@deepseek-ai/dsh-scope';
import { assertObjectJsonSchema } from '@deepseek-ai/dsh-tools';
import { canonicalClientTimeZone } from '@deepseek-ai/dsh-util-time';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { rejectPrompt, validateControlRequest, } from "./control.js";
import { SubagentError } from "./error.js";
import { assertSubagentMaxDepth } from "./depth.js";
import { createActivationObserver, createLifecycleEmitter, observeRun } from "./lifecycle.js";
import SubagentContinuationManager from "./continuation.js";
import { listChildren as listSubagentChildren, listDescendants as listSubagentDescendants } from "./list-children.js";
import { installSubagentArchiveAdmission } from "./archive-admission.js";
import { snapshotSubagentDescriptor } from "./descriptor.js";
import { readOwnedAuthorDialogActivationV1 } from "./author-dialog-activation.js";
import { readOwnedRubyTaskActivationV1 } from "./owned-ruby-task.js";
export { readOwnedRubyTaskActivationV1 } from "./owned-ruby-task.js";
export { composeOwnedAuthorDialogActivationV1, driveOwnedAuthorDialogActivationV1 } from "./author-dialog-activation.js";
import { subagentIdentityProjectionDefinition, subagentTimingProjectionDefinition } from "./projection.js";
import { establishCatalogChild, subagentCatalogProjectionDefinition } from "./catalog.js";
import { deliverSubagentPrompt } from "./internal.js";
export * from "./out-of-process.js";
export { AssistantOutputFold, finalAssistantOutput } from "./assistant-output.js";
export { SubagentRunId } from "./types.js";
export { foldSubagentDescriptor, snapshotSubagentDescriptor, SUBAGENT_DESCRIPTOR_VERSION, SUBAGENT_RUBY_TASK_DESCRIPTOR_VERSION, } from "./descriptor.js";
export { SubagentError } from "./error.js";
export { settleRun } from "./run-settlement.js";
export { assertSubagentMaxDepth, delegationDepthOf } from "./depth.js";
export { appendDelegatedPolicyOverrides, applyChildComposition, captureDelegatedPolicyOverrides, childSessionMeta, parentAgentOptionsForDelegation, resolveChildAgentOptions, resolveChildDepth, SubagentDepthError, } from "./child-agent.js";
/** Named provider registry with one-shot runs, durable discovery, and continuable-child operations. */
let SubagentRuntime = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _prompt_decorators;
    let _interruptByParent_decorators;
    return class SubagentRuntime extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _prompt_decorators = [Remote('prompt')];
            _interruptByParent_decorators = [Remote('interruptByParent')];
            __esDecorate(this, null, _prompt_decorators, { kind: "method", name: "prompt", static: false, private: false, access: { has: obj => "prompt" in obj, get: obj => obj.prompt }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _interruptByParent_decorators, { kind: "method", name: "interruptByParent", static: false, private: false, access: { has: obj => "interruptByParent" in obj, get: obj => obj.interruptByParent }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        config = __runInitializers(this, _instanceExtraInitializers);
        static Config = z.object({
            maxDepth: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(1).volatile(),
            maxActiveSubagents: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(8).volatile(),
        });
        providers = new Map();
        continuations;
        /**
         * The contained lifecycle-edge publisher. Built here because scoped dispatch
         * keys its carrier by this exact service instance, whose own context filter
         * composes into the carrier.
         */
        emitLifecycle;
        constructor(ctx, config) {
            super(ctx, 'subagents');
            this.config = config;
            this.emitLifecycle = createLifecycleEmitter(this.ctx, parent => scopeTarget(this, parent));
            ctx.inject(['agents'], (childCtx) => {
                const manager = new SubagentContinuationManager(childCtx, {
                    prepareContinuable: (name, request) => this.prepareContinuable(name, request),
                    observeActivation: (provider, childId, parent) => this.observeActivation(provider, childId, parent),
                }, () => this.config.maxActiveSubagents.get());
                this.continuations = manager;
                childCtx.effect(() => () => {
                    /* v8 ignore else -- one injected binding owns the slot until its fiber disposes. */
                    if (this.continuations === manager)
                        this.continuations = undefined;
                }, 'subagents.continuationBinding()');
            });
            ctx.inject(['sessionProjections'], (projectionCtx) => {
                const projections = projectionCtx.sessionProjections;
                projections.register(subagentCatalogProjectionDefinition);
                projections.register(subagentTimingProjectionDefinition);
                projections.register(subagentIdentityProjectionDefinition);
            });
            // Archive admission: this runtime is the owner that knows which live
            // children descend from a Session and how a parent stops them.
            ctx.inject(['agents'], (agentsCtx) => { installSubagentArchiveAdmission(agentsCtx); });
        }
        /**
         * Resolve a delegation tool's depth policy against the current user setting.
         * @param configured - Explicit tool limit, or provider-managed for external delegation.
         * @returns The numeric limit, or undefined when the provider owns depth enforcement.
         */
        resolveMaxDepth(configured) {
            if (configured === 'provider-managed')
                return undefined;
            if (configured !== undefined)
                return configured;
            const depth = this.config.maxDepth.get();
            assertSubagentMaxDepth(depth);
            return depth;
        }
        /**
         * Establish one durable continuable child and deliver its initial prompt.
         * Resolves when the child's inbox accepts that prompt, without waiting for the
         * turn to start or for the message to reach the Session log; any earlier
         * failure rejects with no ids and rolls back the child entirely.
         * @param spec - provider, delegation request, and caller cancellation.
         * @returns the durable child id and the accepted prompt's message id.
         * @throws when continuation services are unavailable or materialization fails.
         */
        async startContinuable(spec) {
            return this.requireContinuations().startContinuable(spec);
        }
        /**
         * Steer one model-authored message to the sender's direct parent or direct
         * continuable child. A running target admits it at the nearest step boundary;
         * an idle target starts a turn, and an absent direct child cold-resumes from
         * persistence. The service derives durable sender attribution from the exact
         * live sender. Caller cancellation stops only pre-acceptance work.
         * @param sender - exact live Agent authorizing and originating the message.
         * @param targetId - durable direct-parent or direct-child session id.
         * @param content - model-authored content to deliver.
         * @param options - caller cancellation before inbox acceptance.
         * @returns the accepted message's inbox id.
         * @throws when continuation services are unavailable, adjacency is rejected,
         *   or the message was not admitted.
         */
        async sendMessage(sender, targetId, content, options) {
            return this.requireContinuations().sendMessage(sender, targetId, content, options);
        }
        /**
         * Deliver one host-protocol message to a direct continuable child.
         * Symbol-keyed so host adapters can preserve their own source descriptors without
         * widening the public Service Definition or impersonating an Agent sender.
         * @param parent - exact live direct parent authorizing delivery.
         * @param childId - durable direct-child session id.
         * @param content - host-authored content to deliver.
         * @param source - durable host-protocol source descriptor.
         * @param signal - caller cancellation before inbox acceptance.
         * @param delivery - Queue as a distinct turn or Steer at the nearest step.
         * @returns the accepted message's inbox id.
         */
        [deliverSubagentPrompt](parent, childId, content, source, signal, delivery) {
            return delivery === 'steer'
                ? this.requireContinuations().steerPrompt(parent, childId, content, source, signal)
                : this.requireContinuations().queuePrompt(parent, childId, content, source, signal);
        }
        /**
         * Interrupt one live continuable child's current turn under a human parent
         * address or an exact live ancestor Agent. Fire-and-return: the cancel
         * signal is issued before this returns, but the target may keep running
         * until it observes the signal. Unclaimed pending inbox work, the Activation,
         * and published descendants are preserved; claimed work is not requeued.
         * Once the interrupted driver is idle, a waking send resumes the parked FIFO
         * queue. An absent target — including a one-shot or unknown id —
         * is an accepted no-op, as is a manager-less composition, which cannot own a
         * live Activation.
         * @param targetSessionId - the durable child session id to interrupt.
         * @param authority - the human parent address or exact live ancestor Agent.
         * @throws {SubagentError} `UNAUTHORIZED` when the authority does not own the
         *   live target.
         */
        interrupt(targetSessionId, authority) {
            this.continuations?.interrupt(targetSessionId, authority);
        }
        /**
         * Close continuable admission below exact live parent Agents, stop only their
         * visible descendant Activations synchronously, then await admitted scoped
         * materializations and release those forests child-first. The scoped cutoff
         * lasts until each exact parent leaves the registry; unrelated parent trees
         * remain live.
         * @param parents - exact host-owned parent Agents entering teardown.
         * @returns once every retained descendant Activation released its `AgentHandle`.
         * @throws an aggregate error after all branches settle when any failed.
         */
        async drainContinuableDescendants(parents) {
            const manager = this.continuations;
            // Absent continuation services means nothing was ever materialized.
            if (manager === undefined)
                return;
            await manager.drainDescendants(parents);
        }
        /**
         * Release selected resident continuable direct children of one exact live
         * parent. Other children of the same parent remain admitted and resident.
         * Absent targets and a manager-less composition are accepted no-ops.
         * @param parent - exact live direct parent authorizing the selected release.
         * @param childIds - durable direct-child ids to release when resident.
         * @returns once every selected Activation released its `AgentHandle`.
         * @throws {SubagentError} `UNAUTHORIZED` when a resident target belongs to a
         *   different parent or the supplied parent identity is stale.
         */
        async drainContinuableChildren(parent, childIds) {
            const manager = this.continuations;
            if (manager === undefined)
                return;
            await manager.drainChildren(parent, childIds);
        }
        /**
         * Read the parent's durable direct-child catalog without loading or resuming an Agent.
         * The service owns and releases the live-preferred Session observation.
         * @param parentSessionId - parent whose direct children are requested.
         * @param signal - cancellation forwarded to the Session query.
         * @returns catalog children in parent event order.
         * @throws {@link SubagentError} when query or catalog projection is unavailable.
         * @throws SessionQueryError when the parent cannot be read or the query is cancelled.
         */
        listChildren(parentSessionId, signal) {
            return listSubagentChildren(this.ctx, parentSessionId, signal);
        }
        /**
         * Recursively list reachable parent catalogs in stable pre-order, preserving
         * each catalog's event order. Each row carries its catalog parent and depth;
         * one-shot and unknown-mode children remain traversal nodes. Unknown modes
         * produce unsupported diagnostics. Unreadable child catalogs produce corrupt
         * or unavailable diagnostics and stop only that branch. Root read failures,
         * missing services or projections, and cancellation reject the whole listing.
         * Each catalog is observed once and released before the next read. No Agent
         * is loaded or resumed; Sessions absent from reachable catalogs are omitted.
         * @param rootSessionId - session whose catalog starts descendant discovery.
         * @param signal - cancellation forwarded to and checked around each catalog read.
         * @returns children and branch diagnostics in parent-catalog pre-order.
         * @throws {@link SubagentError} when listing dependencies are unavailable or the caller cancels.
         * @throws SessionQueryError when the root catalog cannot be read.
         */
        listDescendants(rootSessionId, signal) {
            return listSubagentDescendants(this.ctx, rootSessionId, signal);
        }
        /**
         * Deliver one browser-authored message to a continuable child through the
         * exact live direct parent, retaining the caller-minted request identity and
         * validated browser zone on the accepted message. Success identifies the
         * message the child's inbox accepted; later execution is independent of this
         * call. Queue delivery targets a later turn; steer delivery targets the
         * nearest step and retains the Agent loop's best-effort fallback semantics.
         * Image parts are admitted and persisted through the attachment store
         * before delivery, and the child's model must accept image input.
         * Cold resume at capacity rejects with `subagent/delivery-unavailable`.
         * @param request - durable address, delivery, minted identity, content, and optional browser zone.
         * @param signal - carrier cancellation, owning the call until inbox acceptance.
         * @returns the accepted message's inbox identity.
         * @throws {RemoteError} `gateway/bad-request`, `subagent/attachment-invalid`,
         *   `subagent/invalid-time-zone`, `subagent/parent-unavailable`,
         *   `subagent/not-resumable`, `subagent/unauthorized`,
         *   `subagent/delivery-unavailable`, `gateway/cancelled`, or `gateway/internal`.
         */
        async prompt(request, signal) {
            const { parentSessionId, childSessionId, clientTimeZone, delivery } = request;
            validateControlRequest('subagent.prompt', request);
            const canonicalTimeZone = clientTimeZone === undefined
                ? undefined
                : canonicalClientTimeZone(clientTimeZone);
            if (clientTimeZone !== undefined && canonicalTimeZone === undefined) {
                throw new RemoteError('subagent/invalid-time-zone', 'clientTimeZone must be UTC or a valid IANA Area/Location name', { value: clientTimeZone });
            }
            const parent = this.ctx.get('agents')?.get(parentSessionId);
            if (parent === undefined) {
                throw new RemoteError('subagent/parent-unavailable', `parent session "${parentSessionId}" is not live`, { parentSessionId });
            }
            const source = {
                kind: 'user',
                rpcId: request.requestId,
                ...(canonicalTimeZone === undefined ? {} : { clientTimeZone: canonicalTimeZone }),
            };
            try {
                // Admission precedes delivery: image parts become durable references
                // here, so the child inbox only ever accepts Host-persisted attachments.
                let content;
                if (request.content.every((part) => part.type === 'text')) {
                    content = request.content.map(part => ({ type: 'text', text: part.text }));
                }
                else {
                    const attachments = this.ctx.get('attachments');
                    if (attachments === undefined)
                        throw new Error('subagent image prompt requires an attachment store');
                    content = await attachments.admitPromptContent(request.content);
                }
                return {
                    messageId: await this[deliverSubagentPrompt](parent, childSessionId, content, source, signal, delivery),
                };
            }
            catch (error) {
                return rejectPrompt(error, childSessionId, signal);
            }
        }
        /**
         * Remote face of {@link interrupt} under one durable parent address. No
         * catalog, history, persistence, or parent Agent lookup runs: the core
         * primitive alone authorizes the address against the live Activation, which
         * is what keeps a live child interruptible while its parent Agent is offline.
         * Absent, idle, and already-completed targets are accepted no-ops there.
         * @param childSessionId - durable child session id to interrupt.
         * @param parentSessionId - durable direct parent whose authority is claimed.
         * @param mode - required continuable-address discriminator.
         * @returns acknowledgement that the cancel signal was admitted, not that the target is quiescent.
         * @throws {RemoteError} `gateway/bad-request` for an empty id,
         *   `subagent/unauthorized` when the address does not own the live target,
         *   otherwise `gateway/internal`.
         */
        interruptByParent(childSessionId, parentSessionId, mode) {
            validateControlRequest('subagent.interrupt', { childSessionId, parentSessionId, mode });
            try {
                this.interrupt(childSessionId, { kind: 'user', parentSessionId });
            }
            catch (error) {
                if (error instanceof SubagentError && error.code === 'UNAUTHORIZED') {
                    throw new RemoteError('subagent/unauthorized', 'subagent does not belong to this parent', { childSessionId }, { cause: error });
                }
                throw new RemoteError('gateway/internal', 'subagent interrupt failed', {}, { cause: error });
            }
            return { accepted: true };
        }
        /**
         * Register a provider under its name. Registration is effect-scoped and HMR
         * safe; removing a provider blocks new starts but does not revoke runs that
         * were already returned to their holders.
         * @param provider - the trusted provider implementation.
         * @returns the exact Cordis effect disposer.
         */
        registerProvider(provider) {
            const name = provider.name;
            // oxlint-disable-next-line typescript/no-misused-promises -- synchronous disposer
            return this.ctx.effect(function* () {
                if (this.providers.has(name)) {
                    throw new SubagentError(`a subagent provider named "${name}" is already registered`, 'DUPLICATE_PROVIDER');
                }
                this.providers.set(name, provider);
                yield () => {
                    this.providers.delete(name);
                    this.emitLifecycle('subagent/provider-removed', name);
                };
                // A throwing added-listener unwinds the yielded rollback, matching the
                // repository's fail-loud registration semantics.
                this.ctx.emit('subagent/provider-added', provider);
            }.bind(this), 'subagents.registerProvider()');
        }
        /**
         * Look up a provider by name.
         * @param name - the provider name.
         * @returns the provider, or undefined when absent.
         */
        getProvider(name) {
            return this.providers.get(name);
        }
        /**
         * List registered provider names in insertion order.
         * @returns the registered names.
         */
        list() {
            return [...this.providers.keys()];
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
            const provider = this.expectProvider(name);
            this.assertCapabilities(provider, request);
            assertSubagentMaxDepth(request.maxDepth);
            if (request.outputSchema !== undefined)
                assertObjectJsonSchema(request.outputSchema);
            const activation = request.activation === undefined ? undefined : readOwnedAuthorDialogActivationV1(request.activation);
            const rubyActivation = request.rubyActivation === undefined ? undefined : readOwnedRubyTaskActivationV1(request.rubyActivation);
            if ((rubyActivation === undefined) !== (request.rubyOwner === undefined))
                throw Error('owned Ruby task requires separate activation and live owner');
            if (rubyActivation !== undefined && (activation !== undefined || request.prompt.length !== 0
                || request.persona !== undefined || request.outputSchema !== undefined))
                throw Error('owned Ruby task cannot add another activation, user input, persona or structured output');
            if (activation !== undefined && (request.prompt.length !== 0 || request.persona !== undefined || request.outputSchema !== undefined))
                throw Error('owned author dialogue activation cannot add user input, persona or structured output');
            const descriptor = snapshotSubagentDescriptor({
                mode: 'one-shot',
                provider: name,
                ...request.label !== undefined ? { label: request.label } : {},
                ...activation !== undefined ? { activation } : {},
                ...rubyActivation !== undefined ? { rubyActivation } : {},
            });
            const resolved = { ...request, descriptor,
                ...rubyActivation !== undefined ? { rubyActivation } : {}, };
            const run = await provider.start(resolved);
            const child = run.localAgent?.session;
            if (child !== undefined) {
                try {
                    establishCatalogChild(request.parent.session, child.header, descriptor);
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
            return observeRun(this.emitLifecycle, name, request.parent, run);
        }
        /**
         * Resolve one provider's detached continuable-creation contribution. Method
         * presence on the provider IS the capability, so a provider without it is
         * rejected before the manager reserves any child resources.
         */
        async prepareContinuable(name, request) {
            const provider = this.expectProvider(name);
            if (provider.prepareContinuable === undefined) {
                throw new SubagentError(`subagent provider "${provider.name}" does not support continuable children `
                    + '(no prepareContinuable capability)', 'UNSUPPORTED_CAPABILITY');
            }
            return provider.prepareContinuable(request);
        }
        /** Look up a provider for dispatch or fail loud. */
        expectProvider(name) {
            const provider = this.providers.get(name);
            if (provider === undefined) {
                throw new SubagentError(`no subagent provider registered for "${name}"`, 'NO_PROVIDER');
            }
            return provider;
        }
        /** Resolve the optional continuable-subagent manager or fail loud. */
        requireContinuations() {
            if (this.continuations === undefined) {
                throw new SubagentError('continuable subagents require the agents service', 'CONTINUATION_UNAVAILABLE');
            }
            return this.continuations;
        }
        /**
         * Build the lifecycle observer for one continuable Activation's residency
         * epoch, so the manager publishes its edges without owning event dispatch.
         */
        observeActivation(provider, childId, parent) {
            return createActivationObserver(this.emitLifecycle, provider, childId, parent);
        }
        /** Reject the first requested capability that the provider lacks. */
        assertCapabilities(provider, request) {
            const needs = [
                { when: request.agentOptions !== undefined, cap: 'agentOptions' },
                { when: request.outputSchema !== undefined, cap: 'outputSchema' },
                { when: request.maxDepth !== undefined, cap: 'depthLimit' },
                { when: request.toolFilter !== undefined, cap: 'toolFilter' },
                { when: request.persona !== undefined, cap: 'persona' },
                { when: request.activation !== undefined, cap: 'ownedAuthorDialog' },
                { when: request.rubyActivation !== undefined, cap: 'ownedRubyTask' },
            ];
            for (const { when, cap } of needs) {
                if (when && !provider.capabilities[cap]) {
                    throw new SubagentError(`subagent provider "${provider.name}" does not support the "${cap}" capability`, 'UNSUPPORTED_CAPABILITY');
                }
            }
        }
    };
})();
export { SubagentRuntime };
export default SubagentRuntime;
