// Generated from runtime/alpha3/compat/session-controller/src/commands.ts; edit the TypeScript source.
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
/** Session commands whose activation policy is explicit at each Remote method. */
import { modelAvailable } from './catalog.js';
import { randomUUID } from 'node:crypto';
import { brandString } from '@deepseek-ai/dsh-brand';
import { AttachmentError } from '@deepseek-ai/dsh-attachment';
import { ReasoningEffortId, assistantStreamChunks, createUserMessage, freezeMessage, } from '@deepseek-ai/dsh-llm';
import { buildForkSeed } from '@deepseek-ai/dsh-session/fork';
import { SessionLogOffset, SessionSeq } from '@deepseek-ai/dsh-session';
import { SessionQueryError } from '@deepseek-ai/dsh-session-query';
import { SessionTitleInvalidError } from '@deepseek-ai/dsh-session-title';
import { canonicalClientTimeZone } from '@deepseek-ai/dsh-util-time';
import { assertNever } from '@deepseek-ai/dsh-util-values';
import { RemoteError, remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol';
import { ApiSessionAgentController, ApiSessionCwdConflict, ApiSessionNotFound, ApiSessionPresetConflict, ApiSessionSubagentOwnership, apiSessionSubagentOwnershipError, hasApiSessionSubagentOwner, inspectApiSession, } from './agent.js';
function hasPromptContent(content) {
    return content.some(part => part.type !== 'text' || part.text.trim().length > 0);
}
/**
 * Resolve the omitted-`atSeq` default to the latest completed-turn prefix,
 * including standalone events before the next turn begins.
 */
function latestCompletedPrefixBoundary(events) {
    const lastTurnEnd = events.findLast(event => event.type === 'turn/end');
    if (lastTurnEnd === undefined)
        return undefined;
    let boundary = lastTurnEnd.seq;
    for (const next of events.slice(boundary + 1)) {
        if (next.type === 'turn/start' || (next.type === 'user/message' && next.surfaceOp === 'append')
            || next.type === 'agent/inbox/spliced')
            break;
        boundary = next.seq;
    }
    return boundary;
}
/** Implements Session business commands delegated by the Session Controller Remote service. */
export class SessionCommandController {
    ctx;
    agents;
    defaultCwd;
    /**
     * @param ctx - Host context carrying Agent, model, attachment, title, and Workspace services.
     * @param agents - sole owner of create, resume, and Session-local model selection.
     * @param defaultCwd - project directory used when create names neither a Workspace nor a cwd.
     */
    constructor(ctx, agents, defaultCwd) {
        this.ctx = ctx;
        this.agents = agents;
        this.defaultCwd = defaultCwd;
    }
    /**
     * Create or idempotently adopt one ordinary Session.
     * @param request - requested identity, location, and Agent preset.
     * @returns the Session identity and resolved preset when configured.
     */
    async create(request) {
        if (request.workspaceId !== undefined && request.cwd !== undefined) {
            throw new RemoteError('gateway/bad-request', 'session.create accepts workspaceId or cwd, not both', {});
        }
        const sessionId = request.sessionId ?? brandString(`session-${randomUUID()}`);
        let workspace;
        if (request.workspaceId !== undefined) {
            workspace = this.ctx.workspaceRegistry.get(request.workspaceId);
            if (workspace === undefined) {
                throw new RemoteError('workspace/not-found', `workspace "${request.workspaceId}" not found`, {
                    workspaceId: request.workspaceId,
                });
            }
        }
        const cwd = workspace?.path ?? request.cwd ?? this.defaultCwd;
        let adopted;
        try {
            adopted = await this.agents.ensureSession(sessionId, cwd, request.sessionId !== undefined, request.agentPreset);
        }
        catch (error) {
            this.rejectCreation(sessionId, error);
        }
        if (workspace !== undefined) {
            try {
                await workspace.attachSession(sessionId);
            }
            catch (error) {
                throw new RemoteError('session/workspace-attach-failed', `session "${sessionId}" was created but could not attach to workspace "${workspace.id}": ${String(error)}`, { sessionId, workspaceId: workspace.id });
            }
        }
        const agentPreset = this.agents.presetForSession(adopted.session);
        return { sessionId, ...(agentPreset === undefined ? {} : { agentPreset }) };
    }
    /**
     * Validate and install one Session-local model selection; save the default in the background.
     * @param request - Session identity and requested model selection.
     * @returns the normalized selection installed for the Session, without waiting for default persistence.
     */
    async selectModel(request) {
        const agent = await this.resolveAgent(request.sessionId);
        return this.agents.serializeImageAdmission(agent, async () => {
            try {
                await this.requireModel(request);
                const resolved = await this.ctx.llm.resolveCallConfig({
                    provider: request.provider,
                    model: request.model,
                    ...(request.reasoningEffort === undefined
                        ? {}
                        : { reasoningEffort: ReasoningEffortId(request.reasoningEffort) }),
                });
                const selected = {
                    provider: resolved.provider,
                    model: resolved.model,
                    ...(resolved.reasoningEffort === undefined
                        ? {}
                        : { reasoningEffort: resolved.reasoningEffort }),
                };
                this.agents.selectForNextRequest(agent, selected);
                void this.ctx.agentDefaultModel.saveSelection(selected).catch((error) => {
                    this.ctx.logger.warn(`session-controller: model selection changed for the Session but the default was not saved: ${String(error)}`);
                });
                return { selected: { ...selected } };
            }
            catch (error) {
                if (remoteErrorOf(error) !== undefined)
                    throw error;
                throw new RemoteError('session/model-unavailable', error instanceof Error ? error.message : String(error), { provider: request.provider, model: request.model });
            }
        });
    }
    /**
     * Normalize and append a user-owned Session title.
     * @param request - Session identity and proposed title.
     * @returns the accepted title and durable event sequence.
     */
    async rename(request) {
        const agent = await this.resolveAgent(request.sessionId);
        const titles = this.ctx.get('sessionTitle');
        if (titles === undefined) {
            throw new RemoteError('gateway/internal', 'renaming is unavailable: this deployment mounts no session-title service', {});
        }
        try {
            const accepted = titles.rename(agent.session, request.title);
            return { title: accepted.title, seq: accepted.eventSeq };
        }
        catch (error) {
            if (error instanceof SessionTitleInvalidError) {
                throw new RemoteError('session/title-invalid', error.message, { sessionId: request.sessionId });
            }
            throw new RemoteError('gateway/internal', `failed to rename session "${request.sessionId}": ${String(error)}`, {});
        }
    }
    /**
     * Create a new ordinary Session from an exact event prefix. An explicit
     * `atSeq` is the inclusive cut; an omitted value selects the latest
     * completed-turn prefix. An open cut receives synthetic fork closers.
     * @param request - source Session and optional exact event boundary.
     * @returns the new Session identity.
     */
    async fork(request, beforePublish) {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            let atSeq;
            try {
                atSeq = request.atSeq === undefined ? undefined : SessionSeq(request.atSeq);
            }
            catch {
                throw new RemoteError('gateway/bad-request', 'atSeq must be a non-negative safe integer', {});
            }
            let observed;
            try {
                observed = await this.ctx.sessionQuery.observeSession(request.sessionId);
            }
            catch (error) {
                if (error instanceof SessionQueryError
                    && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND') {
                    throw new RemoteError('session/not-found', `session "${request.sessionId}" not found`, {
                        sessionId: request.sessionId,
                    });
                }
                throw new RemoteError('gateway/internal', `fork source unavailable for session "${request.sessionId}": ${String(error)}`, {});
            }
            const source = __addDisposableResource(env_1, observed, false);
            const boundary = atSeq ?? latestCompletedPrefixBoundary(source.events);
            if (boundary === undefined || source.events[boundary]?.seq !== boundary) {
                throw new RemoteError('session/fork-unavailable', request.atSeq === undefined
                    ? `session "${request.sessionId}" has no completed turn to fork from`
                    : `event ${String(request.atSeq)} does not exist in session "${request.sessionId}" (last seq: ${String(source.events.at(-1)?.seq ?? 'none')})`, { sessionId: request.sessionId });
            }
            let cut = SessionLogOffset(boundary + 1);
            // Roleplay's prepared fork includes late edit/ownership metadata before
            // the next turn. Ordinary Remote fork retains the official boundary.
            if (beforePublish && source.events[boundary]?.type === 'turn/end') {
                while (cut < source.events.length && source.events[cut]?.type !== 'turn/start')
                    cut = SessionLogOffset(cut + 1);
            }
            // End-seed and any open-turn closers belong to the child, so lineage uses
            // the inherited cut rather than the total number of generated seed rows.
            const seed = buildForkSeed(source.events, SessionSeq(cut - 1));
            let workspace;
            try {
                workspace = await this.forkWorkspace(source.header);
            }
            catch (error) {
                throw new RemoteError('gateway/internal', `failed to resolve fork workspace for session "${request.sessionId}": ${String(error)}`, {});
            }
            const childId = brandString(`session-${randomUUID()}`);
            const composition = await this.agents.composeAgent(this.agents.presetForObservation(source));
            // Rejection leaves no child allocation. The caller owns reconciliation if
            // later creation or workspace attachment fails after durable reservation.
            await beforePublish?.({ sourceSessionId: source.header.id, childSessionId: childId, seedLength: cut });
            try {
                const { provider, model } = this.ctx.agentDefaultModel.currentSelection();
                await this.ctx.agents.create({
                    sessionId: childId,
                    seed,
                    inheritedEventCount: cut,
                    meta: {
                        ...(source.header.cwd === undefined ? {} : { cwd: source.header.cwd }),
                        parentSession: source.header.id,
                        isSeeded: true,
                        ...(composition.agentPreset === undefined
                            ? {}
                            : { agentPreset: composition.agentPreset }),
                    },
                    agentOptions: { provider, model },
                    setup: composition.setup,
                });
            }
            catch (error) {
                throw new RemoteError('gateway/internal', `failed to fork session "${request.sessionId}": ${String(error)}`, {});
            }
            if (workspace !== undefined) {
                try {
                    await workspace.attachSession(childId);
                }
                catch (error) {
                    throw new RemoteError('session/workspace-attach-failed', `session "${childId}" was forked but could not attach to workspace "${workspace.id}": ${String(error)}`, { sessionId: childId, workspaceId: workspace.id });
                }
            }
            return { sessionId: childId };
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
     * Reject empty content, then admit one prompt after Agent and attachment validation.
     * @param request - Session identity, prompt content, source metadata, and delivery mode.
     * @returns acknowledgement that the Agent accepted the prompt.
     */
    async prompt(request) {
        if (!hasPromptContent(request.content)) {
            throw new RemoteError('gateway/bad-request', 'prompt content must include non-whitespace text or an attachment', {});
        }
        const clientTimeZone = request.clientTimeZone === undefined
            ? undefined
            : canonicalClientTimeZone(request.clientTimeZone);
        if (request.clientTimeZone !== undefined && clientTimeZone === undefined) {
            throw new RemoteError('session/invalid-time-zone', 'clientTimeZone must be UTC or a valid IANA Area/Location name', { value: request.clientTimeZone });
        }
        const agent = await this.resolveAgent(request.sessionId);
        if (hasPromptRequest(agent, request.requestId))
            return { accepted: true };
        const source = {
            kind: 'user',
            rpcId: request.requestId,
            ...(clientTimeZone === undefined ? {} : { clientTimeZone }),
        };
        const hasImage = request.content.some(part => part.type === 'image');
        const admit = async () => {
            try {
                const env_2 = { stack: [], error: void 0, hasError: false };
                try {
                    if (hasImage) {
                        const current = this.agents.selectionFor(agent).current;
                        const model = await this.ctx.llm.resolveModelInfo(current.provider, current.model);
                        if (model.inputModalities !== undefined && !model.inputModalities.includes('image')) {
                            throw new RemoteError('session/attachment-invalid', `Model "${current.model}" does not support image input.`, { reason: 'MODEL_DOES_NOT_SUPPORT_IMAGES' });
                        }
                    }
                    const admission = resolvePromptFileReceipts(request.content, receiptId => this.ctx.fileUploads.resolve(agent, receiptId));
                    const content = await this.ctx.attachments.admitPromptContent(admission.content);
                    const message = createUserMessage({ content, source });
                    if (this.ctx.agents.get(agent.id) !== agent) {
                        throw new RemoteError('session/not-found', `session "${agent.id}" was disposed during prompt admission`, { sessionId: agent.id });
                    }
                    const binding = __addDisposableResource(env_2, this.ctx.fileUploads.bindPrompt(agent, admission.receiptIds, request.requestId), false);
                    if (request.mode === 'steer')
                        agent.steer(message);
                    else
                        agent.followup(message);
                    binding.commit();
                }
                catch (e_2) {
                    env_2.error = e_2;
                    env_2.hasError = true;
                }
                finally {
                    __disposeResources(env_2);
                }
            }
            catch (error) {
                if (remoteErrorOf(error) !== undefined)
                    throw error;
                if (error instanceof AttachmentError) {
                    throw new RemoteError('session/attachment-invalid', error.message, { reason: error.code });
                }
                throw new RemoteError('session/agent-busy', 'prompt rejected', { reason: String(error) });
            }
            return { accepted: true };
        };
        return hasImage ? this.agents.serializeImageAdmission(agent, admit) : admit();
    }
    async requireModel(selection) {
        if (!await modelAvailable(this.ctx, selection)) {
            throw new RemoteError('session/model-unavailable', 'Select an available model before sending a message.', { provider: selection.provider, model: selection.model });
        }
    }
    /**
     * Read one durable image after proving the Session log references it.
     * @param request - Session and attachment identities used for authorization.
     * @returns the durable attachment reference and base64-encoded bytes.
     */
    async attachment(request) {
        let source;
        try {
            source = await this.readSessionState(request.sessionId);
        }
        catch (error) {
            if (error instanceof ApiSessionNotFound) {
                throw new RemoteError('session/not-found', error.message, { sessionId: request.sessionId });
            }
            throw new RemoteError('gateway/internal', `attachment authorization unavailable for session "${request.sessionId}": ${String(error)}`, {});
        }
        const ref = referencedImage(source.events, String(request.attachmentId));
        if (ref === undefined) {
            throw new RemoteError('session/attachment-invalid', 'Image is not referenced by this session.', { reason: 'ATTACHMENT_NOT_REFERENCED' });
        }
        try {
            const stored = await this.ctx.attachments.readImage(ref);
            return {
                attachment: stored.ref,
                data: Buffer.from(stored.data).toString('base64'),
            };
        }
        catch (error) {
            if (error instanceof AttachmentError) {
                throw new RemoteError('session/attachment-invalid', error.message, { reason: error.code });
            }
            throw new RemoteError('gateway/internal', 'Unable to read image attachment.', {});
        }
    }
    /**
     * Mutate one pending Inbox occurrence, restoring an ordinary cold Agent when needed.
     * @param request - Session, queue item, and requested mutation.
     * @returns acknowledgement that the queue mutation was applied.
     */
    async updateQueue(request) {
        if (request.action.kind === 'edit') {
            // oxlint-disable-next-line typescript/no-unnecessary-condition -- Remote callers can submit untyped JSON.
            if (request.action.content.some(block => block.type !== 'text')) {
                throw new RemoteError('session/attachment-invalid', 'queue edits accept text content only', { reason: 'QUEUE_EDIT_NON_TEXT' });
            }
            if (!hasPromptContent(request.action.content)) {
                throw new RemoteError('gateway/bad-request', 'queue edit content must include non-whitespace text', {});
            }
        }
        let agent = this.ctx.agents.get(request.sessionId);
        if (agent === undefined) {
            const found = await this.agents.resolveAgent(request.sessionId);
            if ('error' in found) {
                if (found.error.code !== 'session/not-found')
                    throw found.error;
                throw new RemoteError('session/queue-item-not-found', 'queued item is no longer pending', { itemId: request.itemId });
            }
            agent = found.agent;
        }
        if (hasApiSessionSubagentOwner(this.ctx, agent.session, agent)) {
            const identity = this.ctx.sessionProjections
                .snapshot(agent.session, ['subagent'])
                .values.subagent;
            if (identity?.mode !== 'continuable'
                || !agent.session.isOwnSeq(identity.seq)) {
                throw apiSessionSubagentOwnershipError(request.sessionId);
            }
        }
        const nextTurn = agent.inbox.nextTurn.find(message => message.id === request.itemId);
        const nextStep = agent.inbox.nextStep.find(message => message.id === request.itemId);
        const located = nextTurn === undefined
            ? nextStep === undefined ? undefined : { target: 'next-step', message: nextStep }
            : { target: 'next-turn', message: nextTurn };
        if (located === undefined) {
            throw new RemoteError('session/queue-item-not-found', 'queued item is no longer pending', { itemId: request.itemId });
        }
        const { target, message } = located;
        if (request.action.kind === 'steer' && (target !== 'next-turn' || agent.status !== 'running')) {
            throw new RemoteError('session/steer-unavailable', 'current turn no longer accepts steering', { itemId: request.itemId });
        }
        switch (request.action.kind) {
            case 'edit':
                agent.inbox.replace(request.itemId, freezeMessage({
                    ...message,
                    content: [...request.action.content],
                }));
                break;
            case 'remove': {
                agent.inbox.remove(request.itemId);
                const source = message.source;
                if (source.kind === 'user' && 'rpcId' in source) {
                    this.ctx.fileUploads.retirePrompt(agent, source.rpcId);
                }
                break;
            }
            case 'steer':
                agent.inbox.remove(request.itemId);
                agent.steer(message);
                break;
            /* v8 ignore next 2 -- closed-union exhaustiveness guard */
            default:
                assertNever(request.action, 'queue action');
        }
        return { accepted: true };
    }
    /**
     * Cancel one live ordinary Agent while retaining pending inbox work.
     * @param request - Session whose active Agent turn is cancelled.
     * @returns acknowledgement that cancellation was requested.
     */
    cancel(request) {
        const agent = this.ctx.agents.get(request.sessionId);
        if (agent === undefined) {
            throw new RemoteError('session/not-found', `session "${request.sessionId}" not found (not attached)`, { sessionId: request.sessionId });
        }
        if (hasApiSessionSubagentOwner(this.ctx, agent.session, agent)) {
            throw apiSessionSubagentOwnershipError(request.sessionId);
        }
        agent.cancel({ kind: 'user' }, { keepInbox: true });
        return { accepted: true };
    }
    async resolveAgent(sessionId) {
        const found = await this.agents.resolveAgent(sessionId);
        if ('error' in found)
            throw found.error;
        return found.agent;
    }
    rejectCreation(sessionId, error) {
        if (remoteErrorOf(error) !== undefined)
            throw error;
        if (error instanceof Error && error.name === 'SessionAlreadyOwnedError') {
            throw new RemoteError('session/writer-held', error.message, { sessionId });
        }
        if (error instanceof ApiSessionPresetConflict) {
            throw new RemoteError('agent-preset/conflict', error.message, {
                sessionId: error.sessionId,
                requestedPreset: error.requestedPreset,
                ...(error.existingPreset === undefined ? {} : { existingPreset: error.existingPreset }),
            });
        }
        if (error instanceof ApiSessionCwdConflict) {
            throw new RemoteError('session/conflict', error.message, {
                sessionId: error.sessionId,
                requestedCwd: error.requestedCwd,
                ...(error.existingCwd === undefined ? {} : { existingCwd: error.existingCwd }),
            });
        }
        if (error instanceof ApiSessionSubagentOwnership) {
            throw apiSessionSubagentOwnershipError(error.sessionId);
        }
        throw new RemoteError('gateway/internal', `failed to create session "${sessionId}": ${String(error)}`, {});
    }
    async readSessionState(sessionId) {
        const attached = this.ctx.sessions.get(sessionId);
        if (attached !== undefined) {
            // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
            return { id: attached.id, header: attached.header, events: attached.snapshotEvents() };
        }
        const inspected = await inspectApiSession(this.ctx, sessionId);
        return { id: inspected.meta.id, header: inspected.meta, events: inspected.events };
    }
    async forkWorkspace(source) {
        const workspaces = this.ctx.workspaceRegistry.list();
        const direct = workspaces.find(workspace => workspace.sessionIds.includes(source.id));
        if (direct !== undefined || source.origin !== 'subagent')
            return direct;
        const lineage = await this.ctx.sessionQuery.traceSession(source.id);
        for (const ancestor of lineage.ancestors) {
            const workspace = workspaces.find(candidate => candidate.sessionIds.includes(ancestor.header.id));
            if (workspace !== undefined)
                return workspace;
        }
        return undefined;
    }
}
function resolvePromptFileReceipts(content, stagedFile) {
    const receiptIds = new Set();
    const resolved = content.map((part) => {
        if (part.type !== 'file')
            return part;
        const attachment = stagedFile(part.receiptId);
        if (attachment === undefined) {
            throw new RemoteError('session/attachment-invalid', 'File was not uploaded for this session.', { reason: 'FILE_NOT_STAGED' });
        }
        receiptIds.add(part.receiptId);
        return { type: 'file', attachment };
    });
    return { content: resolved, receiptIds: [...receiptIds] };
}
function hasPromptRequest(agent, requestId) {
    const matches = (message) => {
        const source = message.source;
        return source.kind === 'user' && 'rpcId' in source && source.rpcId === requestId;
    };
    if (agent.inbox.nextTurn.some(matches) || agent.inbox.nextStep.some(matches))
        return true;
    // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
    return agent.session.snapshotEvents().some((event) => {
        if (event.type !== 'user/message')
            return false;
        const source = event.data.source;
        return source.kind === 'user' && 'rpcId' in source && source.rpcId === requestId;
    });
}
function imageBlockIn(content, match) {
    if (!Array.isArray(content))
        return undefined;
    for (const value of content) {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            continue;
        const block = value;
        if (block.type === 'image' && typeof block.attachment === 'object' && block.attachment !== null) {
            const ref = block.attachment;
            if (match(ref))
                return ref;
        }
    }
    return undefined;
}
/** Read only first-party declared content fields; unknown event payloads stay opaque. */
function imageInEvent(event, match) {
    const data = event.data;
    // First-party event payloads can be present without their producer plugin mounted.
    const type = event.type;
    switch (type) {
        case 'user/message':
        case 'tool/ptc-dispatch':
            return imageBlockIn(data.content, match);
        case 'system/message':
        case 'developer/message':
        case 'tool/result':
        case 'team/message/queued':
            return imageBlockIn(data.message?.content, match);
        case 'agent/inbox/spliced': {
            const messages = data.inserted;
            if (!Array.isArray(messages))
                return undefined;
            for (const message of messages) {
                if (typeof message !== 'object' || message === null || Array.isArray(message))
                    continue;
                const found = imageBlockIn(message.content, match);
                if (found !== undefined)
                    return found;
            }
            return undefined;
        }
        case 'compaction/summary':
            return imageBlockIn(data.summary, match) ?? imageBlockIn(data.rawOutput, match);
        case 'assistant/message': {
            const found = imageBlockIn(data.message?.content, match);
            if (found !== undefined)
                return found;
            break;
        }
        case 'assistant/attempt': break;
        default: return undefined;
    }
    const assistant = event;
    for (const chunk of assistantStreamChunks(assistant.data.stream, 'block-end')) {
        const found = imageBlockIn([chunk.block], match);
        if (found !== undefined)
            return found;
    }
    return undefined;
}
function referencedImage(events, attachmentId) {
    for (const event of events) {
        const found = imageInEvent(event, ref => String(ref.attachmentId) === attachmentId);
        if (found !== undefined)
            return found;
    }
    return undefined;
}
