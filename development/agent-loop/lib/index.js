// Generated from runtime/alpha3/compat/agent-loop/src/index.ts; edit the TypeScript source.
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { Context, Service } from '@deepseek-ai/cordis';
import { randomUUID } from 'node:crypto';
import z from '@deepseek-ai/schemastery';
import { z as zod } from 'zod';
import { brandString } from '@deepseek-ai/dsh-brand';
import { errorChain, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { interruptedTurnClosers, SessionLogOffset, SessionPreparation, SessionSeq } from '@deepseek-ai/dsh-session';
import { SessionPersistenceNotFoundError } from '@deepseek-ai/dsh-session-persistence';
import { ReactLoopAgent, nativeInputAdmissionCapability } from './agent.js';
import { inboxProjectionDefinition } from './inbox.js';
import { DEFAULT_MAX_PARALLEL_TOOL_CALLS } from './constants.js';
/** Fiber states that cannot own or serve a new lifecycle. */
// Cordis 4.0.4 declares FiberState as an ambient const enum and exports no
// runtime value. Keep its pinned lifecycle codes explicit in this JS output.
const INACTIVE_STATES = new Set([5, 4, 3]);
const turnBoundaryProjectionSchema = zod.object({
    openTurnStartSeq: zod.number().int().nonnegative().transform(SessionSeq).nullable(),
    lastStepStartSeq: zod.number().int().nonnegative().transform(SessionSeq).nullable(),
    lastStepBoundary: zod.object({
        kind: zod.union([zod.literal('start'), zod.literal('end')]),
        seq: zod.number().int().nonnegative().transform(SessionSeq),
    }).nullable(),
    lastTurn: zod.number().int().nonnegative(),
});
/** Host projection of agent turn and step boundaries. */
export const turnBoundaryProjectionDefinition = {
    key: 'turnBoundary',
    stateVersion: 2,
    stateSchema: turnBoundaryProjectionSchema,
    init: () => ({
        openTurnStartSeq: null,
        lastStepStartSeq: null,
        lastStepBoundary: null,
        lastTurn: 0,
    }),
    apply: (state, event) => {
        switch (event.type) {
            case 'turn/start':
                return {
                    ...state,
                    openTurnStartSeq: event.seq,
                    lastTurn: event.data.turn,
                };
            case 'turn/end':
                return {
                    ...state,
                    openTurnStartSeq: null,
                };
            case 'step/start':
                return {
                    ...state,
                    lastStepStartSeq: event.seq,
                    lastStepBoundary: { kind: 'start', seq: event.seq },
                };
            case 'step/end':
                return {
                    ...state,
                    lastStepBoundary: { kind: 'end', seq: event.seq },
                };
            default:
                return state;
        }
    },
};
/** Factory-level ownership: live agent teardowns plus config startup work. */
class FactoryOwnership {
    fiber;
    accepting = true;
    teardown = new AbortController();
    inactive = Promise.withResolvers();
    liveAgents = new Set();
    startupTasks = new Set();
    constructor(fiber) {
        this.fiber = fiber;
    }
    /** Aborts (reason: `agent loop is not active` error) when factory teardown begins. */
    get signal() {
        return this.teardown.signal;
    }
    isActive() {
        return this.accepting && !INACTIVE_STATES.has(this.fiber.state);
    }
    /** Track one live agent's shared teardown until it has run. */
    track(dispose) {
        this.liveAgents.add(dispose);
        return () => { this.liveAgents.delete(dispose); };
    }
    /** Join config startup work that begins before an agent exists. */
    trackStartup(job) {
        this.startupTasks.add(job);
        const forget = () => { this.startupTasks.delete(job); };
        void job.then(forget, forget);
    }
    /** Join one public create/resume continuation; factory dispose awaits its settlement. */
    trackWrapper(job) {
        this.trackStartup(job.then(() => undefined, () => undefined));
    }
    /** Resolve `task`, or stop waiting when factory teardown begins. */
    async waitWhileActive(job) {
        await Promise.race([job, this.inactive.promise]);
    }
    async dispose() {
        this.accepting = false;
        this.teardown.abort(new Error('agent loop is not active'));
        this.inactive.resolve();
        await Promise.all([
            ...[...this.liveAgents].map(dispose => dispose()),
            ...this.startupTasks,
        ]);
    }
}
/** Await `operation`, or throw the signal's reason as soon as it aborts. */
async function raceAbort(operation, signal, id) {
    const toAbortError = () => signal.reason instanceof Error
        ? signal.reason
        : new Error(`agent "${id}" creation aborted`, { cause: signal.reason });
    if (signal.aborted)
        throw toAbortError();
    const aborted = Promise.withResolvers();
    const listener = () => { aborted.reject(toAbortError()); };
    signal.addEventListener('abort', listener, { once: true });
    try {
        return await Promise.race([Promise.resolve(operation), aborted.promise]);
    }
    finally {
        signal.removeEventListener('abort', listener);
    }
}
/** Start an abortable operation and release a value that arrives after cancellation. */
async function raceAbortCall(operation, signal, id, releaseAbandoned) {
    if (signal.aborted) {
        throw signal.reason instanceof Error
            ? signal.reason
            : new Error(`agent "${id}" creation aborted`, { cause: signal.reason });
    }
    const pending = Promise.resolve().then(operation);
    try {
        return await raceAbort(pending, signal, id);
    }
    catch (error) {
        // oxlint-disable-next-line typescript/no-unnecessary-condition -- the signal can abort while the operation is awaited.
        if (signal.aborted && releaseAbandoned !== undefined) {
            void pending.then(releaseAbandoned, () => undefined);
        }
        throw error;
    }
}
/** Reject an output-token cap that cannot be represented exactly on the request wire. */
function assertAgentOptions(options) {
    if (options.maxTokens !== undefined
        && (!Number.isSafeInteger(options.maxTokens) || options.maxTokens <= 0)) {
        throw new TypeError('agent maxTokens must be a positive safe integer');
    }
}
export { DEFAULT_MAX_PARALLEL_TOOL_CALLS };
export { nativeInputAdmissionCapability } from './agent.js';
/**
 * Context key a launcher sets before any Loader entry mounts
 * (`ctx.provide(CONFIGURED_AGENT_IDENTITIES_KEY, identities)`) to fix
 * configured agents' session identities without a config key, so an overlay
 * repointing the row's model route cannot drop them.
 */
export const CONFIGURED_AGENT_IDENTITIES_KEY = 'configuredAgentIdentities';
/**
 * Apply launcher-owned identities over the configured agents, replacing both
 * identity keys for every entry the launcher named so a config-supplied
 * identity can never survive alongside a launcher-supplied one.
 * @param agents - the configured agent entries.
 * @param identities - launcher identities keyed by configured agent `id`, or `undefined`.
 * @returns the entries with launcher-owned identities applied.
 */
function applyLauncherIdentities(agents, identities) {
    if (identities === undefined)
        return agents;
    return agents.map((agent) => {
        const identity = identities[agent.id];
        if (identity === undefined)
            return agent;
        const { sessionId: _sessionId, resumeSessionId: _resumeSessionId, ...rest } = agent;
        return identity.resume
            ? { ...rest, resumeSessionId: identity.id }
            : { ...rest, sessionId: identity.id };
    });
}
/** Reject self-contained identity conflicts before any configured agent starts. */
function validateConfiguredAgents(agents) {
    const exactIdentities = new Map();
    for (const { id, sessionId, resumeSessionId } of agents) {
        const hasResumeId = resumeSessionId !== undefined && resumeSessionId !== '';
        if (sessionId !== undefined && hasResumeId) {
            throw new Error(`agent "${id}": sessionId and resumeSessionId are mutually exclusive`);
        }
        const exactIdentity = hasResumeId ? resumeSessionId : sessionId;
        if (exactIdentity === undefined)
            continue;
        const firstId = exactIdentities.get(exactIdentity);
        if (firstId !== undefined) {
            throw new Error(`agents "${firstId}" and "${id}" use duplicate exact session identity "${exactIdentity}"`);
        }
        exactIdentities.set(exactIdentity, id);
    }
}
/** Concrete agent factory and driver service. */
export class AgentLoop extends Service {
    static inject = ['agents', 'sessions', 'llm', 'tools', 'systemPrompt', 'sessionProjections'];
    /** Runtime schema for declarative agents. */
    static Config = z.object({
        maxParallelToolCalls: z.number().step(1).min(1).default(DEFAULT_MAX_PARALLEL_TOOL_CALLS).volatile(),
        agents: z.array(z.object({
            id: z.string().required(),
            sessionId: z.string().min(1),
            provider: z.string(),
            model: z.string(),
            reasoningEffort: z.string().min(1),
            maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
            cwd: z.string(),
            resumeSessionId: z.string(),
        })).default([]),
    });
    /** Validated configuration owned by the agent-loop service. */
    config;
    ownership;
    /** Plain holder prevents Cordis from re-tracing the factory's dependency context through a caller shadow. */
    runtime;
    constructor(ctx, config) {
        super(ctx, 'agentLoop');
        this.config = {
            agents: applyLauncherIdentities(config.agents, ctx.get(CONFIGURED_AGENT_IDENTITIES_KEY)),
            maxParallelToolCalls: config.maxParallelToolCalls,
        };
        validateConfiguredAgents(this.config.agents);
        // Register only after every config validation above has passed, so a
        // rejected constructor leaves no projection unit behind.
        ctx.sessionProjections.register(turnBoundaryProjectionDefinition);
        ctx.sessionProjections.register(inboxProjectionDefinition);
        this.ownership = new FactoryOwnership(ctx.fiber);
        this.runtime = { ctx, admissionAgents: new WeakSet() };
        ctx.effect(() => () => this.ownership.dispose(), 'agentLoop.transactions()');
        ctx.effect(() => ctx.agents.setFactory(this), 'agentLoop.setFactory()');
        ctx.systemPrompt.variable('provider', context => context.agent?.options.provider);
        ctx.systemPrompt.variable('model', context => context.agent?.options.model);
        ctx.systemPrompt.variable('cwd', context => context.agent?.session.header.cwd);
        for (const { id, sessionId, cwd, resumeSessionId, ...options } of this.config.agents) {
            const meta = cwd === undefined ? {} : { cwd };
            if (resumeSessionId === undefined || resumeSessionId === '') {
                const configuredId = sessionId ?? brandString(`${id}-session-${randomUUID()}`);
                const persistence = sessionId === undefined ? undefined : ctx.get('sessionPersistence');
                if (persistence === undefined) {
                    const startup = this.create(configuredId, options, meta).then(() => undefined, (error) => {
                        this.reportConfiguredStartupFailure(id, 'restore', configuredId, error);
                    });
                    this.ownership.trackStartup(startup);
                }
                else {
                    const startup = this.restoreOrCreateConfigured(ctx, persistence, configuredId, options, meta).catch((error) => {
                        this.reportConfiguredStartupFailure(id, 'restore', configuredId, error);
                    });
                    this.ownership.trackStartup(startup);
                }
                continue;
            }
            ctx.effect(() => {
                const fiber = ctx.inject(['sessionPersistence'], (childCtx) => {
                    void this.resumeWith(ctx, childCtx.sessionPersistence, {
                        resumeSessionId,
                        agentOptions: options,
                    }).catch((error) => {
                        this.reportConfiguredStartupFailure(id, 'resume', resumeSessionId, error);
                    });
                });
                return fiber.dispose;
            }, `agentLoop.resume(${id})`);
        }
    }
    /** Runtime consumer entry: this factory must still own the exact published
     * Agent in its original registry. Return that Agent, never a service wrapper. */
    getInputAdmissionAgent(agent) {
        const actual = nativeInputAdmissionCapability(agent);
        if (!actual || !this.ownership.isActive() || !(actual instanceof ReactLoopAgent)
            || !this.runtime.admissionAgents.has(actual)
            || this.runtime.ctx.agents.get(actual.id) !== actual)
            return undefined;
        return actual;
    }
    /** Report a contained declarative-start failure to identity-bound consumers. */
    reportConfiguredStartupFailure(configId, action, sessionId, error) {
        if (!this.ownership.isActive())
            return;
        this.ctx.logger.warn(`agent "${configId}": config-driven ${action} of "${sessionId}" failed: ${errorChain(error)}`);
        const args = ['agent-loop/config-start-failed', { sessionId, error }];
        for (const callback of this.ctx.events.dispatch('emit', args)) {
            try {
                const returned = callback(...args);
                void Promise.resolve(returned).catch((listenerError) => {
                    this.ctx.logger.warn(`agent "${configId}": config-start-failed listener rejected: ${errorChain(listenerError)}`);
                });
            }
            catch (listenerError) {
                this.ctx.logger.warn(`agent "${configId}": config-start-failed listener threw: ${errorChain(listenerError)}`);
            }
        }
    }
    /** Restore a materialized exact config identity on remount, or create it on first use. */
    async restoreOrCreateConfigured(ownerCtx, persistence, sessionId, agentOptions, meta) {
        await this.waitForDrainingConfiguredIdentity(ownerCtx, sessionId);
        if (!this.ownership.isActive())
            return;
        try {
            await this.resumeWith(ownerCtx, persistence, { resumeSessionId: sessionId, agentOptions });
            return;
        }
        catch (error) {
            if (!this.ownership.isActive())
                return;
            // Only a genuinely absent stored session falls back to first creation;
            // corruption, ownership conflicts, and backend failures stay loud.
            if (!(error instanceof SessionPersistenceNotFoundError))
                throw error;
        }
        await this.create(sessionId, agentOptions, meta);
    }
    /** Wait for a draining same-id lifecycle to finish registry teardown. */
    async waitForDrainingConfiguredIdentity(ownerCtx, sessionId) {
        // Only an id still occupying a registry needs waiting for; a live healthy
        // occupant is a collision the create/resume below will surface itself.
        if (ownerCtx.agents.get(sessionId) === undefined && ownerCtx.sessions.get(sessionId) === undefined)
            return;
        const released = Promise.withResolvers();
        const checkReleased = () => {
            if (ownerCtx.agents.get(sessionId) === undefined && ownerCtx.sessions.get(sessionId) === undefined) {
                released.resolve();
            }
        };
        const disposeAgentListener = ownerCtx.on('agent/disposed', () => { checkReleased(); });
        const disposeSessionListener = ownerCtx.on('session/disposed', checkReleased);
        try {
            checkReleased();
            await this.ownership.waitWhileActive(released.promise);
        }
        finally {
            disposeAgentListener();
            disposeSessionListener();
        }
    }
    /**
     * Construct the driver, scope, and one memoized reverse teardown for a new
     * agent. The teardown is registered with the factory and the owner fiber
     * BEFORE publication, so a mid-setup unload rolls everything back; `signal`
     * fuses caller cancellation with lifecycle teardown for setup awaits.
     */
    prepare(ownerCtx, id, options, session, callerSignal, handle, parentAgent) {
        assertAgentOptions(options);
        ownerCtx.fiber.assertActive();
        // Every caller reaches prepare() synchronously from a service method
        // whose Cordis dispatch already requires the live factory fiber, or
        // re-checks ownership itself after its awaits (resume's load barrier).
        /* v8 ignore next -- unreachable backstop, see above */
        if (!this.ownership.isActive())
            throw new Error('agent loop is not active');
        if (callerSignal?.aborted) {
            throw callerSignal.reason instanceof Error
                ? callerSignal.reason
                : new Error(`agent "${id}" creation aborted`, { cause: callerSignal.reason });
        }
        const loopCtx = this.runtime.ctx;
        // Deactivation fuses three owners, each with its own reason: the caller's
        // cancellation signal, the owner fiber's unload, and factory teardown.
        // It is registered BEFORE any resource exists, over mutable slots, so an
        // unload arriving while the scope is still minting finds a working
        // disposer instead of a leak.
        const abort = new AbortController();
        const onCallerAbort = () => {
            abort.abort(callerSignal?.reason instanceof Error
                ? callerSignal.reason
                : new Error(`agent "${id}" creation aborted`, { cause: callerSignal?.reason }));
        };
        const onFactoryTeardown = () => { abort.abort(this.ownership.signal.reason); };
        callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
        this.ownership.signal.addEventListener('abort', onFactoryTeardown, { once: true });
        let machine;
        let detachSession;
        let detachAgent;
        let disposing;
        let publication;
        const machineReady = Promise.withResolvers();
        // Reverse teardown, memoized so every racing owner awaits one quiescence:
        // stop the machine, drain and close the session's write path, leave the
        // registries, unwind the scope, release bookkeeping.
        const dispose = (ownerTriggered = false) => (disposing ??= (async () => {
            abort.abort(new Error(`agent "${id}" lifecycle disposed`));
            callerSignal?.removeEventListener('abort', onCallerAbort);
            this.ownership.signal.removeEventListener('abort', onFactoryTeardown);
            // Teardown failures are collected, never swallowed: registry, scope,
            // and ownership cleanup always run to quiescence, then the memoized
            // disposal rejects with what failed so every racing owner observes it.
            const failures = [];
            try {
                // Creation listeners retain the session and scope through their awaits.
                if (publication !== undefined)
                    await publication.promise;
                // Disposal IS a disposed-cause cancel followed by quiescence. New work
                // sent after this point is the sender's bug — the registries are about
                // to drop the agent, so nothing should still hold it.
                /* v8 ignore next -- Cordis effect teardown waits for synchronous setup before observing the machine slot. */
                if (machine === undefined)
                    await machineReady.promise;
                /* v8 ignore next -- setup failure untracks this disposer before resolving without a machine. */
                if (machine !== undefined) {
                    this.runtime.admissionAgents.delete(machine);
                    machine.cancel({ kind: 'disposed' });
                    await machine.whenIdle();
                    await machine.scope.dispose();
                }
            }
            catch (error) {
                failures.push(error);
            }
            // The loop above committed its closing events synchronously into the
            // session; handle close drains them durably before releasing the write
            // path. The close drain can be the first operation that surfaces a
            // durability failure, so its error is retained, not logged away.
            try {
                await handle?.close();
            }
            catch (error) {
                failures.push(error);
            }
            try {
                detachAgent?.();
                detachSession?.();
            }
            finally {
                untrack();
                if (!ownerTriggered)
                    await unfollowOwner();
            }
            if (failures.length === 1)
                throw failures[0];
            if (failures.length > 1) {
                throw new AggregateError(failures, `agent "${id}" disposal failed`);
            }
        })());
        const untrack = this.ownership.track(dispose);
        let unfollowOwner;
        try {
            unfollowOwner = ownerCtx.effect(function* () {
                machine = new ReactLoopAgent(loopCtx, id, options, session);
                machineReady.resolve();
                yield machine.scope.rawDispose;
                yield () => {
                    // Owner disposal owns the same quiescence boundary. Its teardown skips
                    // unregistering this already-running owner effect from inside itself.
                    if (disposing !== undefined)
                        return;
                    abort.abort(new Error(`agent "${id}" setup aborted: owner disposed during setup`));
                    return dispose(true);
                };
            }, `agentLoop.lifecycle(${id})`);
            /* v8 ignore start -- ctx.effect throws only on an inactive fiber, which assertActive() above already rejected */
        }
        catch (error) {
            machineReady.resolve();
            untrack();
            callerSignal?.removeEventListener('abort', onCallerAbort);
            this.ownership.signal.removeEventListener('abort', onFactoryTeardown);
            throw error;
        }
        /* v8 ignore stop */
        const assertLive = () => {
            if (!abort.signal.aborted)
                return;
            // Every fused abort source carries an Error reason: onCallerAbort and
            // raceAbort wrap non-Error caller reasons, and the factory/lifecycle
            // owners abort with constructed Errors.
            /* v8 ignore next -- unreachable String() arm, see above */
            throw abort.signal.reason instanceof Error ? abort.signal.reason : new Error(String(abort.signal.reason));
        };
        try {
            /* v8 ignore next -- a synchronous effect exhausts the generator before returning */
            if (machine === undefined)
                throw new Error(`agent "${id}" lifecycle did not construct its driver`);
            const agent = machine;
            assertLive();
            return {
                agent,
                signal: abort.signal,
                publish: async (source) => {
                    publication = Promise.withResolvers();
                    try {
                        assertLive();
                        detachSession = agent.ctx.sessions.enter(session);
                        // The mounted backend routes announced live events into the active
                        // write handle by session id; the loop only owns the handle itself.
                        detachAgent = loopCtx.agents.enter(agent, parentAgent);
                        // Creation listeners may register admission. The actual registry
                        // owns this instance before announce; rollback removes the brand.
                        this.runtime.admissionAgents.add(agent);
                        agent.ctx.sessions.announce(session);
                        assertLive();
                        await loopCtx.agents.announce(agent, source, abort.signal);
                        assertLive();
                        return { agent, dispose };
                    }
                    finally {
                        publication.resolve();
                        publication = undefined;
                    }
                },
                dispose,
            };
        }
        catch (error) {
            machineReady.resolve();
            // Rollback swallows a disposal rejection: the setup failure is primary.
            void dispose().catch(() => { });
            throw error;
        }
    }
    /**
     * Create an agent and session under one caller-supplied identity, owned by
     * the accessing fiber. Constructor-driven config calls mint a fresh combined
     * id before entering this boundary. When a persistence backend is mounted,
     * the session's durable identity and any seed are stored before publication.
     * @param id - shared agent/session identity.
     * @param options - concrete loop options.
     * @param meta - optional fresh-session workspace metadata.
     * @returns the published running agent.
     */
    async create(id, options = {}, meta = {}) {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const preparation = __addDisposableResource(env_1, SessionPreparation.create(this.runtime.ctx.sessions.prepare(id, { meta })), false);
            const stored = await this.createStoredSession(preparation.session);
            let prepared;
            try {
                prepared = this.prepare(this.ctx, id, options, preparation.session, undefined, stored?.handle);
            }
            catch (error) {
                await stored?.handle.close().catch(() => { });
                throw error;
            }
            return (await this.initializeAgent(prepared, async () => {
                await this.appendUnstoredSuffix(stored, preparation.session);
                return await prepared.publish('startup');
            })).agent;
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    }
    /**
     * Take a fresh session's write ownership when persistence is mounted.
     * Nothing is appended here: the constructor seed (which never re-emits
     * through `session/event`) is stored by `appendUnstoredSuffix` at the
     * publication commit point, so a failed or cancelled validation or setup
     * closes an unmaterialized handle and leaves no stored residue — the same
     * id can be created again.
     * @param session - the unpublished session to store.
     * @param signal - optional cancellation forwarded to the backend create.
     * @returns the owned handle and stored cursor, or `undefined` without a backend.
     */
    async createStoredSession(session, signal) {
        const persistence = this.runtime.ctx.get('sessionPersistence');
        if (persistence === undefined)
            return undefined;
        const handle = await persistence.create(session.header, {
            inheritedEventCount: session.inheritedEventCount,
            ...signal === undefined ? {} : { signal },
        });
        return { handle, storedCount: 0 };
    }
    /**
     * Durably store the session events appended since the last stored cursor.
     * Pre-publication appends (constructor seed markers, setup-window events
     * such as delegation policy records) never re-emit through `session/event`,
     * so publication must flush them through the handle before live events
     * start routing into it.
     * @param stored - the session's owned handle and stored cursor, if any.
     * @param session - the unpublished session whose suffix is stored.
     */
    async appendUnstoredSuffix(stored, session) {
        if (stored === undefined)
            return;
        // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
        const suffix = session.snapshotEvents(SessionLogOffset(stored.storedCount));
        if (suffix.length > 0)
            await stored.handle.append(suffix);
        // Advance by what was stored, not to `session.seq`: an event appended
        // during the await must stay unstored for the next flush.
        stored.storedCount += suffix.length;
    }
    /**
     * Create an owned agent on a caller-supplied session id.
     * @param ownerCtx - caller context that structurally owns the lifecycle.
     * @param options - identities, optional live parent, session seed/metadata, loop options, setup, and cancellation.
     * @returns the published handle.
     */
    async createAgent(ownerCtx, options) {
        const preparation = SessionPreparation.create(this.runtime.ctx.sessions.prepare(options.sessionId, {
            ...options.seed === undefined ? {} : { seed: options.seed },
            ...options.meta === undefined ? {} : { meta: options.meta },
            ...options.inheritedEventCount === undefined ? {} : { inheritedEventCount: options.inheritedEventCount },
        }));
        const published = (async () => {
            let stored;
            try {
                // raceAbortCall normalizes a pre-aborted or mid-create abort and
                // closes a handle that finishes creating after abandonment.
                stored = options.signal === undefined
                    ? await this.createStoredSession(preparation.session)
                    : await raceAbortCall(() => this.createStoredSession(preparation.session, options.signal), options.signal, options.sessionId, (abandoned) => { void abandoned?.handle.close().catch(() => { }); });
            }
            catch (error) {
                preparation[Symbol.dispose]();
                throw error;
            }
            return this.setupAndPublish(ownerCtx, options.sessionId, preparation, options.agentOptions ?? {}, options.setup, options.signal, 'startup', stored, options.parentAgent);
        })();
        this.ownership.trackWrapper(published);
        return published;
    }
    /** Prepare one Agent around an acquired Session, run setup, and publish it. */
    async setupAndPublish(ownerCtx, id, preparation, agentOptions, setup, signal, source, stored, parentAgent) {
        const env_2 = { stack: [], error: void 0, hasError: false };
        try {
            const ownedPreparation = __addDisposableResource(env_2, preparation, false);
            const session = ownedPreparation.session;
            let prepared;
            try {
                prepared = this.prepare(ownerCtx, id, agentOptions, session, signal, stored?.handle, parentAgent);
            }
            catch (error) {
                await stored?.handle.close().catch(() => { });
                throw error;
            }
            return await this.initializeAgent(prepared, async () => {
                const setupCommit = await raceAbort(setup?.(prepared.agent.ctx, prepared.agent), prepared.signal, id);
                setupCommit?.commit();
                await this.appendUnstoredSuffix(stored, session);
                return await prepared.publish(source);
            });
        }
        catch (e_2) {
            env_2.error = e_2;
            env_2.hasError = true;
        }
        finally {
            __disposeResources(env_2);
        }
    }
    async initializeAgent(prepared, initialize) {
        try {
            return await prepared.agent.runMaintenance(async () => {
                try {
                    return await initialize();
                }
                catch (error) {
                    // Teardown owns inbox cleanup and may already have removed its projection.
                    prepared.agent.cancel({ kind: 'disposed' }, { keepInbox: true });
                    throw error;
                }
            });
        }
        catch (error) {
            // Rollback swallows a disposal rejection (a failing final handle close):
            // the setup failure is the primary error the caller must see.
            await prepared.dispose().catch(() => { });
            throw error;
        }
    }
    /**
     * Resume an owned agent from the configured persistence service.
     * @param ownerCtx - caller context that owns load, setup, and the live lifecycle.
     * @param options - persisted identity, optional live parent, loop options, setup, and cancellation.
     * @returns the published handle.
     */
    async resume(ownerCtx, options) {
        const persistence = this.runtime.ctx.get('sessionPersistence');
        if (persistence === undefined) {
            throw new Error('cannot resume: session persistence is not configured (load a dsh-session-persistence backend)');
        }
        return this.resumeWith(ownerCtx, persistence, options);
    }
    /** Resume through an explicit persistence handle used by the deferred config path. */
    resumeWith(ownerCtx, persistence, options) {
        const id = options.resumeSessionId;
        const published = (async () => {
            // The open and read may outlive their owner: race them against caller
            // cancellation, owner-fiber unload, and factory teardown so a
            // never-settling backend cannot pin the identity.
            const ownerAbort = new AbortController();
            const unfollowOwner = ownerCtx.effect(() => () => {
                ownerAbort.abort(new Error(`agent "${id}" setup aborted: owner disposed during setup`));
            }, `agentLoop.resume-load(${id})`);
            const fused = AbortSignal.any([
                ...options.signal === undefined ? [] : [options.signal],
                ownerAbort.signal,
                this.ownership.signal,
            ]);
            let handle;
            let stored;
            let preparation;
            try {
                try {
                    // Taking write ownership FIRST excludes a concurrent resume of the
                    // same id (in this process, a live agent's handle holds the claim).
                    handle = await raceAbortCall(() => persistence.open(id, 'write', { signal: fused }), fused, id, (abandoned) => { void abandoned.close(); });
                    // Semantic crash repair is the agent layer's job: persistence hands
                    // back the physically valid log; an interrupted final turn receives
                    // synthetic closers (missing tool errors, step/end, turn/end) that
                    // are appended through the same handle as an ordinary batch.
                    const coldRead = await handle.read(0, undefined, { signal: fused });
                    fused.throwIfAborted();
                    const persisted = coldRead.events;
                    const closers = interruptedTurnClosers(persisted);
                    if (closers.length > 0)
                        await handle.append(closers);
                    preparation = SessionPreparation.create(this.runtime.ctx.sessions.prepare(id, {
                        seed: [...persisted, ...closers],
                        meta: structuredClone(handle.header),
                        inheritedEventCount: handle.inheritedEventCount,
                        eventState: coldRead.eventState,
                    }));
                    stored = { handle, storedCount: persisted.length + closers.length };
                    await this.appendUnstoredSuffix(stored, preparation.session);
                }
                finally {
                    await unfollowOwner();
                }
                ownerCtx.fiber.assertActive();
                if (!this.ownership.isActive())
                    throw new Error('agent loop is not active');
                const owned = stored;
                handle = undefined; // ownership passes to setupAndPublish/prepare
                return await this.setupAndPublish(ownerCtx, id, preparation, options.agentOptions ?? {}, options.setup, options.signal, 'resume', owned, options.parentAgent);
            }
            finally {
                preparation?.[Symbol.dispose]();
                await handle?.close().catch(() => { });
            }
        })();
        this.ownership.trackWrapper(published);
        return published;
    }
}
export default AgentLoop;
