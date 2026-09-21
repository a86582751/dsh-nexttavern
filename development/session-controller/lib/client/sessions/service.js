// Generated from runtime/alpha3/compat/session-controller/src/client/sessions/service.ts; edit the TypeScript source.
import { SessionSeq } from '@deepseek-ai/dsh-session/types';
import { workspaceTitleOf } from '@deepseek-ai/dsh-util-workspace-path';
import { SESSION_SEARCH_RESULT_LIMIT } from '../../types.js';
import { createSnapshotStore, notifySubscribers, } from '@deepseek-ai/dsh-client-store';
import { createScope, scopeIdentityOf, scopeOf as scopeTagOf } from '../scope.js';
import { SessionManager } from './manager.js';
/** Structured session-create failure. */
export class SessionCreateError extends Error {
    rpcError;
    requestedSessionId;
    name = 'SessionCreateError';
    /**
     * @param rpcError - Host business or folded transport error.
     * @param requestedSessionId - caller-preallocated id used for later stream/list reconciliation.
     */
    constructor(rpcError, requestedSessionId) {
        super(`session create failed: ${rpcError.code}: ${rpcError.message}`);
        this.rpcError = rpcError;
        this.requestedSessionId = requestedSessionId;
    }
}
/** Structured session-fork failure. */
export class SessionForkError extends Error {
    rpcError;
    sourceSessionId;
    name = 'SessionForkError';
    /**
     * @param rpcError - Host business or folded transport error.
     * @param sourceSessionId - the session the fork was cut from.
     */
    constructor(rpcError, sourceSessionId) {
        super(`session fork failed: ${rpcError.code}: ${rpcError.message}`);
        this.rpcError = rpcError;
        this.sourceSessionId = sourceSessionId;
    }
}
// Scope primitives live in ../scope.ts (the client mirror of host
// dsh-scope, keyed by Agent identity); re-exported here so existing
// consumers keep their import site.
export { scopeOf } from '../scope.js';
/**
 * Display title projection: durable title, project directory basename, then
 * the raw id.
 */
function displayTitleOf(title, cwd, id) {
    if (title !== undefined)
        return title;
    if (cwd !== undefined && cwd !== '') {
        const base = workspaceTitleOf(cwd);
        if (base !== '')
            return base;
    }
    return id;
}
/**
 * Increment a trailing fork number while preserving its half-width or
 * full-width parentheses; an unnumbered title starts with ` (1)`.
 * @param title - source session's durable title.
 * @returns the title assigned to the fork child.
 */
function increasedForkTitle(title) {
    const ascii = /^(.*?)\((\d+)\)$/u.exec(title);
    if (ascii?.[1] !== undefined && ascii[2] !== undefined) {
        return `${ascii[1]}(${BigInt(ascii[2]) + 1n})`;
    }
    const fullWidth = /^(.*?)（(\d+)）$/u.exec(title);
    if (fullWidth?.[1] !== undefined && fullWidth[2] !== undefined) {
        return `${fullWidth[1]}（${BigInt(fullWidth[2]) + 1n}）`;
    }
    return `${title} (1)`;
}
/** Source labels are dictionary keys, including names also present on Object.prototype. */
function freezeRetainedBy(counts) {
    Object.setPrototypeOf(counts, null);
    return Object.freeze(counts);
}
const EMPTY_RETAIN_INFO = Object.freeze({ referenceCount: 0, retainedBy: freezeRetainedBy({}) });
/** A cancelled waiter releases only its own reference, not the shared opening. */
async function waitForOpen(opening, signal) {
    if (signal === undefined)
        return opening;
    const aborted = Promise.withResolvers();
    const onAbort = () => { aborted.reject(signal.reason); };
    signal.addEventListener('abort', onAbort, { once: true });
    try {
        if (signal.aborted)
            onAbort();
        await Promise.race([opening, aborted.promise]);
    }
    finally {
        signal.removeEventListener('abort', onAbort);
    }
}
class ClientSessionReference {
    sessionId;
    record;
    releaseReference;
    released = new AbortController();
    readiness = Promise.withResolvers();
    ready = this.readiness.promise;
    constructor(sessionId, record, releaseReference) {
        this.sessionId = sessionId;
        this.record = record;
        this.releaseReference = releaseReference;
        void this.ready.catch(() => { });
    }
    get binding() {
        if (this.record === undefined || !this.record.live)
            throw new Error(`Session reference "${this.sessionId}" is released`);
        return this.record.binding;
    }
    attachOpening(opening, signal) {
        const waitSignal = signal === undefined
            ? this.released.signal
            : AbortSignal.any([this.released.signal, signal]);
        void waitForOpen(opening, waitSignal).then(() => {
            try {
                waitSignal.throwIfAborted();
                this.readiness.resolve(this.binding);
            }
            catch (error) {
                this.readiness.reject(error);
            }
        }, (error) => { this.readiness.reject(error); });
    }
    release() {
        const reason = new Error(`Session reference "${this.sessionId}" is released`);
        const release = this.releaseReference;
        this.released.abort(reason);
        this.readiness.reject(reason);
        this.record = undefined;
        this.releaseReference = undefined;
        release?.();
    }
    [Symbol.dispose]() {
        this.release();
    }
}
/** Host catalog and local reference allocator; view selection remains outside the Controller. */
export class ClientSessions {
    rootCtx;
    /**
     * The wire schema's own result bound, re-exposed for presentation plugins as
     * injected data. Not per-connection state: the `session.search` response
     * schema caps `items` at this constant, so every transport (fixture included)
     * reports the same number.
     */
    searchResultLimit = SESSION_SEARCH_RESULT_LIMIT;
    /** Catalog metadata and local reference-source projection. */
    list;
    /** The object-layer instance cluster and frame dispatch entry. */
    manager;
    scopes = new Map();
    /** Stable per-id sources retained for the Client root lifetime, including across generation replacement. */
    retainObservers = new Map();
    scopeDrops = new Set();
    closed = false;
    /**
     * @param ctx - client root context (scope fibers mount under it).
     * @param remote - generated Remote namespaces shared with every Session.
     */
    constructor(rootCtx, remote) {
        this.rootCtx = rootCtx;
        this.manager = new SessionManager(remote);
        this.list = createSnapshotStore({
            ids: [], byId: {}, phase: 'pending', subagentsByParent: {}, jobsBySession: {},
        });
        const disposeManagerProjection = this.manager.subscribe(() => { this.projectList(); });
        rootCtx.effect(() => async () => {
            this.closed = true;
            disposeManagerProjection();
            const scopes = [...this.scopes];
            this.scopes.clear();
            for (const [, record] of scopes) {
                record.live = false;
                record.session.unbindScope();
            }
            const managerDisposal = this.manager.dispose();
            for (const [id, record] of scopes) {
                this.startScopeDrop(id, record);
                this.publishRetention(id);
            }
            await this.drainScopeDrops();
            await managerDisposal;
        }, 'session-controller.client.sessions');
        rootCtx.reflect.provide('sessions', this, undefined);
    }
    retain(target, options) {
        const { source, signal } = options;
        signal?.throwIfAborted();
        if (this.closed)
            throw new Error('Session Controller is disposed');
        const id = this.manager.resolveTarget(target);
        const reference = this.retainScope(id, source);
        try {
            reference.attachOpening(this.manager.get(id).open(), signal);
            return reference;
        }
        catch (error) {
            reference.release();
            throw error;
        }
    }
    async using(target, options, operation) {
        const reference = this.retain(target, options);
        try {
            await reference.ready;
            return await operation(reference);
        }
        finally {
            reference.release();
        }
    }
    retainInfo(id) {
        let observer = this.retainObservers.get(id);
        if (observer === undefined) {
            const listeners = new Set();
            observer = {
                listeners,
                published: this.retentionSnapshot(id),
                source: {
                    getSnapshot: () => this.retentionSnapshot(id),
                    subscribe: (listener) => {
                        listeners.add(listener);
                        return () => { listeners.delete(listener); };
                    },
                },
            };
            this.retainObservers.set(id, observer);
        }
        return observer.source;
    }
    /**
     * Resolve an already discovered direct-parent address without opening it.
     * Feature plugins use this to avoid Agent-bound RPCs in persisted child views.
     * @param id - possible addressed child id.
     * @returns The retained address, when present.
     */
    subagentAddress(id) {
        return this.manager.subagentAddress(id);
    }
    /**
     * Inform the Session Controller whether a catalog menu is consuming membership updates.
     * @param parentSessionId - selected parent.
     * @param open - menu state.
     */
    setSubagentCatalogOpen(parentSessionId, open) {
        this.manager.setSubagentCatalogOpen(parentSessionId, open);
    }
    /**
     * Refresh one direct-child catalog.
     * @param parentSessionId - catalog owner.
     */
    refreshSubagents(parentSessionId) {
        return this.manager.refreshSubagents(parentSessionId);
    }
    /**
     * Refresh the real Session baseline, reusing an in-flight pull.
     * @returns completion of the current or newly started baseline pull.
     */
    refresh() {
        return this.manager.refreshList();
    }
    /**
     * Search the Host's visible message-content index. Results stay
     * request-local; the list snapshot remains the metadata authority.
     * @param query - non-blank literal phrase.
     * @param signal - cancellation for a superseded search.
     * @returns bounded results or a business/transport error.
     */
    search(query, signal) {
        return this.manager.search(query, signal);
    }
    /**
     * Apply one Session Controller live-control frame.
     * @param frame - baseline or live control replacement.
     */
    handleControlFrame(frame) {
        this.manager.handleControlFrame(frame);
    }
    /**
     * Apply one remotely forwarded Session-list addition.
     * @param summary - current Host summary for the added Session.
     */
    handleSessionAdded(summary) {
        this.manager.handleSessionAdded(summary);
    }
    /**
     * Apply one remotely forwarded Session removal.
     * @param sessionId - removed Session identity.
     */
    handleSessionRemoved(sessionId) {
        this.manager.handleSessionRemoved(sessionId);
    }
    /**
     * Apply one remotely forwarded running-state change.
     * @param args - Session identity and current Agent running state.
     */
    handleSessionStatus(...args) {
        this.manager.handleSessionStatus(...args);
    }
    /**
     * Apply one remotely forwarded list-activity change.
     * @param args - Session identity and durable activity timestamp.
     */
    handleSessionActivity(...args) {
        this.manager.handleSessionActivity(...args);
    }
    /**
     * Apply one remotely forwarded Agent failure.
     * @param args - Session identity and caller-visible failure description.
     */
    handleSessionError(...args) {
        this.manager.handleSessionError(...args);
    }
    /** Rebuild the Session baseline and every opened window after connection. */
    handleConnected() {
        this.manager.handleConnected();
    }
    /**
     * Create a Host Session and publish its catalog row before resolving.
     * Callers retain the returned identity before borrowing its binding.
     * @param opts - target workspace or directory and an optional preallocated id.
     * @returns the new session id.
     * @throws {SessionCreateError} with the requested id.
     */
    async create(opts = {}) {
        const result = await this.manager.create(opts);
        if (!result.ok)
            throw new SessionCreateError(result.error, opts.sessionId);
        this.projectList();
        return result.value.sessionId;
    }
    /**
     * Fork a Session from a completed-turn prefix of the source and publish
     * the child in the catalog before resolving.
     * @param opts - source session id, the optional event seq anchoring the
     *   cut (the boundary is the first turn/end at or after it; an in-log
     *   anchor in an open turn is unavailable rather than clipped backward),
     *   and whether to increment an inherited durable title before resolving.
     *   A fractional anchor floors to a real event seq: the frozen nodes of an
     *   interrupted turn carry flow-ordering seqs between two events, and the
     *   wire takes integers only.
     * @returns the child session id.
     * @throws {SessionForkError} with the source id.
     * @throws {Error} when a requested child-title rename fails after creation.
     */
    async fork(opts) {
        const sourceTitle = opts.increaseTitle
            ? this.list.getSnapshot().byId[opts.sessionId]?.title
            : undefined;
        const result = await this.manager.fork({
            sessionId: opts.sessionId,
            // Flooring lands inside the anchor's own turn (every turn opens with a
            // turn/start), so the host's first-turn/end-at-or-after cut still ends
            // on that turn — never clipped back to the previous one.
            ...(opts.atSeq === undefined ? {} : { atSeq: SessionSeq(Math.floor(opts.atSeq)) }),
        });
        if (!result.ok)
            throw new SessionForkError(result.error, opts.sessionId);
        this.projectList();
        const childId = result.value.sessionId;
        if (sourceTitle !== undefined) {
            const reference = this.retain(childId, { source: 'controllerOperation' });
            try {
                await reference.ready;
                const renamed = await reference.binding.session.rename(increasedForkTitle(sourceTitle));
                if (!renamed.ok)
                    throw new Error(`fork child rename failed: ${renamed.error.code}: ${renamed.error.message}`);
            }
            finally {
                reference.release();
            }
        }
        return childId;
    }
    /**
     * Borrow an already-retained Agent-scoped Context.
     * @param id - session id (the agent identity — 1:1 same axis).
     * @returns the scoped Context, or undefined without a retained generation.
     */
    scope(id) {
        return this.scopes.get(id)?.ctx;
    }
    /**
     * Retain a validated Gateway identity synchronously, without history or catalog I/O.
     * @param id - Host-projected Session identity, possibly not yet catalogued.
     * @returns a Gateway-source reference owned by the invocation.
     */
    retainAgentScope(id) {
        if (this.closed)
            throw new Error('Session Controller is disposed');
        return this.retainScope(id, 'gateway');
    }
    /**
     * Read the Agent scope tag off a context. Service-method boundary: fetch
     * bundles must reach scope resolution through ctx.sessions — a cross-bundle
     * value import of the standalone helper would inline a second module
     * instance whose private tag Symbol never matches.
     * @param ctx - any client context.
     * @returns the session id, or undefined on root contexts.
     */
    scopeOf(ctx) {
        return scopeTagOf(ctx);
    }
    /**
     * Resolve the business Session behind an Agent-scoped context — the one
     * hop every scoped consumer (event listeners, per-session controllers)
     * takes from ctx-space into object-space (the client mirror of host
     * `agent.session`). Same service-method boundary as
     * {@link ClientSessions.scopeOf}.
     * @param ctx - an Agent-scoped context.
     * @returns the matching live Session, or undefined for an untagged or ended generation.
     */
    sessionOf(ctx) {
        const id = scopeTagOf(ctx);
        if (id === undefined)
            return undefined;
        const record = this.scopes.get(id);
        return record !== undefined && scopeIdentityOf(record.ctx) === scopeIdentityOf(ctx)
            ? record.binding.session
            : undefined;
    }
    /**
     * Borrow an already-retained binding without extending its lifetime.
     * @param id - Session identity.
     * @returns the live binding, or undefined without a retained generation.
     */
    binding(id) {
        return this.scopes.get(id)?.binding;
    }
    retainScope(id, source) {
        const record = this.scopes.get(id) ?? this.materializeScope(id);
        const previous = record.retention;
        record.retention = Object.freeze({
            referenceCount: previous.referenceCount + 1,
            retainedBy: freezeRetainedBy({ ...previous.retainedBy, [source]: (previous.retainedBy[source] ?? 0) + 1 }),
        });
        const reference = new ClientSessionReference(id, record, () => {
            if (!record.live)
                return;
            const count = record.retention.referenceCount - 1;
            const { [source]: sourceCount = 0, ...otherSources } = record.retention.retainedBy;
            const retainedBy = sourceCount > 1 ? { ...otherSources, [source]: sourceCount - 1 } : otherSources;
            record.retention = count === 0
                ? EMPTY_RETAIN_INFO
                : Object.freeze({ referenceCount: count, retainedBy: freezeRetainedBy(retainedBy) });
            if (count === 0)
                this.retireScope(id, record);
            else
                this.publishRetention(id);
        });
        if (this.list.getSnapshot().byId[id] === undefined)
            this.projectList();
        this.publishRetention(id);
        return reference;
    }
    retentionSnapshot(id) {
        return this.scopes.get(id)?.retention ?? EMPTY_RETAIN_INFO;
    }
    publishRetention(id) {
        const state = this.list.getSnapshot();
        const row = state.byId[id];
        const retainedBy = this.retentionSnapshot(id).retainedBy;
        if (row !== undefined && row.retainedBy !== retainedBy) {
            this.list.set({ ...state, byId: { ...state.byId, [id]: { ...row, retainedBy } } });
        }
        const observer = this.retainObservers.get(id);
        const snapshot = this.retentionSnapshot(id);
        if (observer === undefined || observer.published === snapshot)
            return;
        observer.published = snapshot;
        notifySubscribers(observer.listeners, '[session-controller] reference sources');
    }
    retireScope(id, record, disposeFiber = true) {
        if (!record.live)
            return;
        record.live = false;
        if (this.scopes.get(id) === record)
            this.scopes.delete(id);
        record.session.unbindScope();
        const sessionDisposal = this.manager.drop(id, record.session);
        this.projectList();
        this.publishRetention(id);
        this.startScopeDrop(id, record, disposeFiber, sessionDisposal);
    }
    /** Materialize one scope after its caller establishes that the id may be addressed. */
    materializeScope(id) {
        const { fiber, ctx } = createScope(this.rootCtx, id);
        const session = this.manager.get(id);
        // The Session owns its scoped dispatch point (host Agent.loopCtx mirror);
        // mint and bind are one step so a live scope record implies a bound actx.
        session.bindScope(ctx);
        const binding = { sessionId: id, session, eventSource: session.eventSource, ctx };
        const record = {
            fiber,
            ctx,
            binding,
            session,
            retention: EMPTY_RETAIN_INFO,
            live: true,
        };
        this.scopes.set(id, record);
        ctx.effect(() => () => { this.retireScope(id, record, false); }, 'session-controller: exact generation');
        return record;
    }
    /** Project the manager's list snapshot into the store (title derivation is display-only). */
    projectList() {
        const previousById = this.list.getSnapshot().byId;
        const { items, phase, subagentsByParent, jobsBySession, } = this.manager.getListSnapshot();
        const ids = [];
        const byId = {};
        for (const entry of items) {
            ids.push(entry.sessionId);
            byId[entry.sessionId] = {
                id: entry.sessionId,
                displayTitle: displayTitleOf(entry.title, entry.cwd, entry.sessionId),
                running: entry.running,
                retainedBy: this.retentionSnapshot(entry.sessionId).retainedBy,
                blank: entry.blank,
                updatedAt: entry.updatedAt,
                ...(entry.projectionValues === undefined
                    ? {}
                    : { projectionValues: entry.projectionValues }),
                ...(entry.title !== undefined ? { title: entry.title } : {}),
                ...(entry.cwd !== undefined ? { cwd: entry.cwd } : {}),
                ...(entry.parentSessionId !== undefined ? { parentId: entry.parentSessionId } : {}),
                ...(entry.origin !== undefined ? { origin: entry.origin } : {}),
            };
        }
        for (const [parentId, catalog] of Object.entries(subagentsByParent)) {
            for (const child of catalog.entries) {
                if (child.kind !== 'child')
                    continue;
                const childId = child.id;
                const summary = byId[childId];
                const projectionValues = summary?.projectionValues ?? this.manager.projectionValues(childId);
                const projectedTitle = projectionValues?.title;
                const title = typeof projectedTitle === 'string' && projectedTitle !== '' ? projectedTitle : undefined;
                const displayTitle = title ?? child.label ?? childId;
                if (summary === undefined) {
                    byId[childId] = {
                        id: childId, displayTitle, parentId: parentId,
                        origin: 'subagent', running: child.activity === 'running', blank: false, updatedAt: 0,
                        retainedBy: this.retentionSnapshot(childId).retainedBy,
                        ...(projectionValues === undefined ? {} : { projectionValues }),
                        ...(title === undefined ? {} : { title }),
                    };
                }
                else if (summary.displayTitle !== displayTitle || summary.projectionValues !== projectionValues) {
                    byId[childId] = {
                        ...summary,
                        displayTitle,
                        ...(projectionValues === undefined ? {} : { projectionValues }),
                    };
                }
            }
        }
        for (const [id, record] of this.scopes) {
            if (byId[id] !== undefined)
                continue;
            const previous = previousById[id];
            const snapshot = record.session.getSnapshot();
            const address = this.manager.subagentAddress(id);
            byId[id] = {
                ...(previous ?? { id, displayTitle: id, updatedAt: 0 }),
                running: snapshot.running,
                retainedBy: record.retention.retainedBy,
                blank: snapshot.blank,
                ...(address === undefined ? {} : { parentId: address.parentSessionId, origin: 'subagent' }),
            };
        }
        this.list.set({ ids, byId, phase, subagentsByParent, jobsBySession });
    }
    startScopeDrop(id, record, disposeFiber = true, sessionDisposal = this.manager.drop(id, record.session)) {
        const drop = this.dropScope(record, disposeFiber, sessionDisposal);
        this.scopeDrops.add(drop);
        void drop.then(() => { this.scopeDrops.delete(drop); }, () => { this.scopeDrops.delete(drop); });
    }
    async drainScopeDrops() {
        while (this.scopeDrops.size > 0) {
            await Promise.allSettled([...this.scopeDrops]);
        }
    }
    /** Await the already-withdrawn Session and scoped cleanup to quiescence. */
    async dropScope(record, disposeFiber, sessionDisposal) {
        await Promise.allSettled([sessionDisposal, ...disposeFiber ? [record.fiber.dispose()] : []]);
    }
}
