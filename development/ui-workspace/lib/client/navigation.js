// Generated from runtime/alpha3/compat/ui-workspace/src/client/navigation.ts; edit the TypeScript source.
/** Workspace archive and directory UI capability. */
import { Service } from '@deepseek-ai/cordis';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { pinOrderAccounts, pinOrderSource } from "./pin-order.js";
/** Structured directory failure exposed to directory UI consumers. */
export class DirectoryBrowseError extends Error {
    rpcError;
    name = 'DirectoryBrowseError';
    /** @param rpcError - Host directory business failure. */
    constructor(rpcError) {
        super(`directory browse failed: ${rpcError.code}: ${rpcError.message}`);
        this.rpcError = rpcError;
    }
}
/** Implements Workspace archive and directory UI operations. */
class UiWorkspaceService extends Service {
    directoryPicker;
    workspaces;
    sessions;
    view;
    notify;
    connecting = new Map();
    lifetime = new AbortController();
    selection = createSnapshotStore({}, { persist: { name: 'dsh.sessions.current' } });
    mainReference;
    /**
     * @param ctx - Client root Context.
     * @param directoryPicker - the directory-picking Remote namespace.
     * @param workspaces - pure Workspace Controller.
     * @param sessions - pure Session Controller.
     * @param view - the browser's viewing-store write set (one instance shared with its registration).
     * @param notify - show one notice through the Workspace notice channel.
     */
    constructor(ctx, directoryPicker, workspaces, sessions, view, notify) {
        super(ctx, 'uiWorkspace');
        this.directoryPicker = directoryPicker;
        this.workspaces = workspaces;
        this.sessions = sessions;
        this.view = view;
        this.notify = notify;
        ctx.effect(() => {
            const stop = this.watchNavigation();
            return () => {
                stop();
                this.lifetime.abort();
                const reference = this.mainReference;
                this.mainReference = undefined;
                reference?.release();
            };
        }, 'ui-workspace: Workspace navigation policy');
    }
    async connectWorkspace(workspaceId) {
        const workspace = this.workspaces.list.getSnapshot().items
            .find(item => item.workspaceId === workspaceId);
        if (workspace === undefined) {
            throw new Error(`uiWorkspace.connectWorkspace: unknown workspace ${workspaceId}`);
        }
        const inflight = this.connecting.get(workspaceId);
        if (inflight !== undefined)
            return inflight;
        const attempt = this.reuseOrCreateBlank(workspace)
            .finally(() => { this.connecting.delete(workspaceId); });
        this.connecting.set(workspaceId, attempt);
        return attempt;
    }
    reuseOrCreateBlank(workspace) {
        const archived = this.workspaces.list.getSnapshot().archivedSessionIds;
        const sessions = this.sessions.list.getSnapshot();
        for (const id of sessions.ids) {
            const summary = sessions.byId[id];
            if (summary === undefined || !summary.blank || summary.cwd !== workspace.path
                || !workspace.sessionIds.includes(id) || archived.includes(id))
                continue;
            return this.reuseBlank(workspace.workspaceId, id);
        }
        return this.sessions.create({ workspaceId: workspace.workspaceId });
    }
    async reuseBlank(workspaceId, sessionId) {
        try {
            return await this.sessions.create({ workspaceId, sessionId });
        }
        catch (error) {
            if (sessionCreateErrorOf(error)?.rpcError.code !== 'session/writer-held')
                throw error;
            return this.sessions.create({ workspaceId });
        }
    }
    openSession(target) {
        this.replaceMain(target, this.lifetime.signal, 'reveal');
    }
    async openWorkspace(workspaceId, beforeOpen) {
        const navigation = AbortSignal.any([this.ctx.layout.beginNavigation(), this.lifetime.signal]);
        let sessionId;
        try {
            sessionId = await this.connectWorkspace(workspaceId);
        }
        catch (error) {
            // Reported here, not in connectWorkspace: startup restoration calls that
            // directly and stays console-only.
            if (!navigation.aborted)
                this.notify({ kind: 'createFailed', message: creationFailureMessage(error) });
            throw error;
        }
        if (navigation.aborted)
            return;
        this.replaceMain(sessionId, navigation, 'reveal', beforeOpen);
    }
    async forkSession(sessionId) {
        await this.sessions.fork({ sessionId, increaseTitle: true });
    }
    startSession(workspaceId) {
        const workspace = this.workspaces.list.getSnapshot();
        const sessions = this.sessions.list.getSnapshot();
        const current = this.mainReference?.sessionId;
        const currentWorkspaceId = current === undefined
            ? undefined
            : workspace.items.find(item => item.sessionIds.includes(current))?.workspaceId;
        const recent = workspace.phase === 'ready' && sessions.phase === 'ready'
            ? recentWorkspace(workspace.items, sessions.byId)
            : undefined;
        const target = workspaceId ?? currentWorkspaceId ?? recent;
        if (target === undefined) {
            this.clearMain();
            return;
        }
        void this.openWorkspace(target).catch((reason) => { console.warn('new session failed:', reason); });
    }
    async archiveSession(sessionId, options = {}) {
        await this.workspaces.archiveSession(sessionId, options);
        if (this.mainReference?.sessionId === sessionId)
            this.clearMain();
    }
    async unarchiveSession(sessionId) {
        await this.workspaces.unarchiveSession(sessionId);
    }
    async pinSession(sessionId) {
        await this.workspaces.pinSession(sessionId);
        const { items, pinnedSessionIds, archivedSessionIds } = this.workspaces.list.getSnapshot();
        this.view.pinSessionOrder(sessionId, pinOrderAccounts(items, sessionId), pinOrderSource(items, this.sessions.list.getSnapshot(), { pinnedSessionIds, archivedSessionIds }));
    }
    async unpinSession(sessionId) {
        await this.workspaces.unpinSession(sessionId);
    }
    async pickDirectory() {
        const result = await this.directoryPicker.pick();
        if (!result.ok)
            throw new Error(`directory picker failed: ${result.error.message}`);
        return result.value;
    }
    async listDirectory(path, signal) {
        const result = await this.directoryPicker.list(path, signal);
        if (!result.ok)
            throw new DirectoryBrowseError(result.error);
        return result.value;
    }
    async createDirectory(path, name) {
        const result = await this.directoryPicker.createDirectory(path, name);
        if (!result.ok)
            throw new DirectoryBrowseError(result.error);
        return result.value;
    }
    watchNavigation() {
        let initial = 'waiting';
        const reconcile = () => {
            if (this.lifetime.signal.aborted)
                return;
            if (this.clearArchivedCurrent())
                return;
            if (initial !== 'waiting')
                return;
            const workspace = this.workspaces.list.getSnapshot();
            const sessions = this.sessions.list.getSnapshot();
            if (workspace.phase !== 'ready' || sessions.phase !== 'ready')
                return;
            if (this.mainReference !== undefined) {
                initial = 'done';
                return;
            }
            initial = 'connecting';
            void this.restoreSelection(workspace, sessions).then(() => { initial = 'done'; }, (reason) => {
                if (this.lifetime.signal.aborted)
                    return;
                initial = 'waiting';
                console.warn('initial Session restoration failed:', reason);
            });
        };
        const disposeWorkspaces = this.workspaces.list.subscribe(reconcile);
        const disposeSessions = this.sessions.list.subscribe(reconcile);
        reconcile();
        return () => {
            this.lifetime.abort();
            disposeSessions();
            disposeWorkspaces();
        };
    }
    async restoreSelection(workspaces, sessions) {
        const saved = this.selection.getSnapshot();
        if (saved.subagentAddress !== undefined) {
            this.replaceMain(saved.subagentAddress, this.lifetime.signal, 'preserve');
            return;
        }
        const summary = saved.sessionId === undefined ? undefined : sessions.byId[saved.sessionId];
        const workspace = summary === undefined ? undefined
            : workspaces.items.find(item => item.sessionIds.includes(summary.id));
        if (summary !== undefined && (!summary.blank || workspace === undefined)) {
            this.replaceMain(summary.id, this.lifetime.signal, 'preserve');
            return;
        }
        const navigation = AbortSignal.any([this.ctx.layout.beginNavigation(), this.lifetime.signal]);
        let sessionId;
        if (summary !== undefined && workspace !== undefined && summary.cwd === workspace.path
            && !workspaces.archivedSessionIds.includes(summary.id)) {
            sessionId = await this.reuseBlank(workspace.workspaceId, summary.id);
        }
        let target = workspace?.workspaceId ?? recentWorkspace(workspaces.items, sessions.byId);
        if (target === undefined && workspaces.items.length === 0 && sessions.ids.length === 0) {
            const prepared = await this.initializeDefaultWorkspace(navigation);
            if (navigation.aborted)
                return;
            target = prepared?.workspaceId;
        }
        if (sessionId === undefined && target !== undefined)
            sessionId = await this.connectWorkspace(target);
        if (sessionId !== undefined && !navigation.aborted) {
            this.replaceMain(sessionId, navigation, 'preserve');
        }
    }
    async initializeDefaultWorkspace(signal) {
        try {
            return await this.workspaces.initializeDefault(signal);
        }
        catch (_error) {
            if (!signal.aborted)
                this.notify({ kind: 'defaultWorkspaceFailed' });
            return undefined;
        }
    }
    /** @returns true when an archived current selection was cleared. */
    clearArchivedCurrent() {
        const current = this.mainReference?.sessionId;
        if (current === undefined
            || !this.workspaces.list.getSnapshot().archivedSessionIds.includes(current))
            return false;
        this.clearMain();
        return true;
    }
    clearMain() {
        const previous = this.mainReference;
        this.mainReference = undefined;
        this.selection.set({});
        previous?.release();
        this.ctx.layout.selectPanel(null);
    }
    replaceMain(target, signal, panel, beforeOpen) {
        signal.throwIfAborted();
        const reference = this.sessions.retain(target, { source: 'mainView' });
        try {
            signal.throwIfAborted();
            beforeOpen?.(reference.sessionId);
            if (signal.aborted) {
                reference.release();
                return;
            }
            const subagentAddress = typeof target === 'string'
                ? this.sessions.subagentAddress(reference.sessionId)
                : target;
            this.selection.set({
                sessionId: reference.sessionId,
                ...(subagentAddress === undefined ? {} : { subagentAddress }),
            });
        }
        catch (error) {
            reference.release();
            throw error;
        }
        const previous = this.mainReference;
        this.mainReference = reference;
        previous?.release();
        if (panel === 'reveal')
            this.ctx.layout.selectPanel(null);
    }
}
/**
 * `error` as the Session Controller's creation failure, or undefined when it
 * is not one. Client plugin bundles do not share error-class identity, so the
 * name decides.
 */
function sessionCreateErrorOf(error) {
    return error instanceof Error && error.name === 'SessionCreateError' ? error : undefined;
}
/**
 * The words a failed Session creation is reported in: a Host refusal keeps its
 * stable code and message; any other failure keeps its own message.
 */
function creationFailureMessage(error) {
    const refused = sessionCreateErrorOf(error);
    if (refused !== undefined)
        return `${refused.rpcError.code}: ${refused.rpcError.message}`;
    return error instanceof Error ? error.message : String(error);
}
/** Stable tie-breaking follows Host Workspace order. */
function recentWorkspace(workspaces, sessions) {
    let selected;
    let selectedTime = Number.NEGATIVE_INFINITY;
    for (const workspace of workspaces) {
        let latest = Number.NEGATIVE_INFINITY;
        for (const sessionId of workspace.sessionIds) {
            const session = sessions[sessionId];
            if (session !== undefined)
                latest = Math.max(latest, session.updatedAt);
        }
        if (latest === Number.NEGATIVE_INFINITY)
            latest = Date.parse(workspace.createdAt);
        if (selected === undefined || latest > selectedTime) {
            selected = workspace.workspaceId;
            selectedTime = latest;
        }
    }
    return selected;
}
export { UiWorkspaceService };
