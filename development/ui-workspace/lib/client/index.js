// Generated from runtime/alpha3/compat/ui-workspace/src/client/index.ts; edit the TypeScript source.
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { menuOpenStateFactory, } from "./contract/slots.js";
import { createWorkspaceShortcutControls, installWorkspaceShortcuts } from "./shortcuts.js";
import { UiWorkspaceService } from "./navigation.js";
import { createWorkspaceViewStore } from "./stores.js";
import { WorkspaceBrowser } from "./rows/WorkspaceBrowser.js";
import { ArchiveSessionMenuItem, ArchiveSessionRowButton, SessionArchiveConfirmDialog } from "./session-actions/ArchiveSession.js";
import { derive } from "./session-actions/derived.js";
import { ForkSessionMenuItem } from "./session-actions/ForkSession.js";
import { PinSessionMenuItem, PinSessionRowButton } from "./session-actions/PinSession.js";
import { RenameSessionMenuItem, SessionRenameDialog } from "./session-actions/RenameSession.js";
import { RowActionToast } from "./session-actions/RowActionToast.js";
import { WorkspacePicker } from "./WorkspacePicker.js";
import { en, zh } from "./locales.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'workspace';
/**
 * Required services (cordis fiber inject). The target slots are declared by
 * the ui-sidebar / ui-conversation applies, whose activation order relative
 * to this one is NOT constrained: dsh.client.inject edges are informational
 * (loading/prefetch metadata, never apply sequencing) and neither owner
 * provides a waitable service. apply therefore depends on each slot
 * declaration through `slots.inject()` instead of assuming order.
 */
export const inject = [
    'slots', 'sessions', 'workspaces', 'locale', 'remote', 'remote.directoryPicker', 'layout', 'shortcuts',
];
/**
 * Register the browser and picker once their slot declarations are on the
 * ledger. Inject factories return plain callbacks; data reads use the
 * framework's global hooks.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    const sessions = ctx.get('sessions');
    const workspaces = ctx.get('workspaces');
    // One viewing-store instance, created here as ui-layout does for its layout
    // store: the browser declares the handle, and the UiWorkspace service writes
    // view order through the same instance the renderer hands the browser.
    const viewHandle = createWorkspaceViewStore();
    const viewInstance = viewHandle.create();
    const viewStore = { ...viewHandle, create: () => viewInstance };
    const rowToast = createSnapshotStore(null);
    let toastSeq = 0;
    const notify = (toast) => { rowToast.set({ ...toast, seq: ++toastSeq }); };
    const uiWorkspace = new UiWorkspaceService(ctx, ctx.remote.directoryPicker, workspaces, sessions, viewInstance.actions, notify);
    ctx.slots.provideRoot({ hooks: { workspaces: workspaces.list } });
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-workspace: dictionaries');
    const shortcutControls = createWorkspaceShortcutControls();
    const searchSessions = async (query, signal) => {
        const result = await sessions.search(query, signal);
        if (!result.ok)
            throw new Error(result.error.message);
        return result.value;
    };
    // Stable per-surface occupancy sources (the renderer's hook cache keys by
    // source identity): true while the surface's directory-flow hole is filled.
    const flowSource = (hole) => ({
        getSnapshot: () => ctx.slots.entries(hole).length > 0,
        subscribe: listener => ctx.slots.subscribe(hole, listener),
    });
    const browserFlowSource = flowSource('sidebar.workspaces.directoryFlow');
    const presentationSource = flowSource('sidebar.workspaces.presentation');
    const hostInfo = {
        getSnapshot: () => ctx.remote.$host,
        subscribe: listener => ctx.on('connection/reset', listener),
    };
    const pickerFlowSource = flowSource('conversation.hero.workspace.directoryFlow');
    const openSession = (sessionId) => {
        uiWorkspace.openSession(sessionId);
    };
    // Registry-global sets as Sets, rebuilt only when the Workspace snapshot changes.
    const pinnedSet = derive(workspaces.list, snapshot => new Set(snapshot.pinnedSessionIds));
    const archivedSet = derive(workspaces.list, snapshot => new Set(snapshot.archivedSessionIds));
    // Plugin-private facts the row actions and their overlay surfaces share:
    // the pending rename request and the notice on display. Each business
    // writes through its own injected callback and the surface reads through
    // its bound hook.
    const renameRequest = derive(shortcutControls.state, state => state.renameTarget);
    const archiveRequest = createSnapshotStore(null);
    const requestSessionRename = shortcutControls.rename;
    const unarchiveSession = (sessionId) => {
        uiWorkspace.unarchiveSession(sessionId).catch((reason) => {
            console.warn('session unarchive rejected:', reason);
        });
    };
    const renameSession = async (sessionId, title) => {
        const result = await sessions.using(sessionId, { source: 'workspaceOperation' }, reference => reference.binding.session.rename(title));
        if (!result.ok)
            throw new Error(result.error.message);
    };
    const pinInjected = () => ({
        hooks: { pinned: pinnedSet, archived: archivedSet },
        // Pin failures surface as a notice: nothing else on the surface moves, so
        // a silent failure would read as a dead action.
        pinSession: (sessionId) => {
            uiWorkspace.pinSession(sessionId).catch(() => { notify({ kind: 'pinFailed' }); });
        },
        unpinSession: (sessionId) => {
            uiWorkspace.unpinSession(sessionId).catch(() => { notify({ kind: 'unpinFailed' }); });
        },
    });
    const archiveInjected = () => ({
        hooks: { archived: archivedSet },
        // Archive preserves the log and the account position, so a quiet Session
        // needs no confirmation; the notice offers undo and the archived filter.
        // The Host's refusal for running work is the one case that asks first:
        // the confirmation names that work and offers to stop it.
        archiveSession: (sessionId) => {
            uiWorkspace.archiveSession(sessionId).then(() => {
                notify({ kind: 'archived', sessionId });
            }).catch((reason) => {
                const activity = activeSessionRefusal(reason);
                if (activity === undefined) {
                    console.warn('session archive rejected:', reason);
                    return;
                }
                const displayTitle = sessions.list.getSnapshot().byId[sessionId]?.displayTitle ?? sessionId;
                archiveRequest.set({ sessionId, displayTitle, activity });
            });
        },
        unarchiveSession,
    });
    installWorkspaceShortcuts(ctx, uiWorkspace, shortcutControls, archiveInjected().archiveSession);
    const archiveConfirmInjected = () => ({
        hooks: { archiveRequest },
        settleSessionArchive: () => { archiveRequest.set(null); },
        stopAndArchiveSession: async (sessionId) => {
            await uiWorkspace.archiveSession(sessionId, { stopActivity: true });
            notify({ kind: 'stoppedAndArchived', sessionId });
        },
    });
    const forkInjected = () => ({
        forkSession: (sessionId) => {
            uiWorkspace.forkSession(sessionId).catch(() => {
                // Fork or child-title failure leaves the list as it was.
            });
        },
    });
    const renameInjected = () => ({ requestSessionRename });
    const renameDialogInjected = () => ({
        hooks: { renameRequest },
        settleSessionRename: shortcutControls.closeRename,
        renameSession,
    });
    const rowToastInjected = () => ({
        hooks: { toast: rowToast },
        dismissToast: () => { rowToast.set(null); },
        undoArchive: unarchiveSession,
        showArchived: () => { viewInstance.actions.setArchivedFilter('show'); },
    });
    const browserInjected = () => ({
        // Explicit group actions keep their target; unscoped New Session inherits
        // the current Session Workspace before the recent-Workspace fallback.
        startSession: (workspaceId) => { uiWorkspace.startSession(workspaceId); },
        open: openSession,
        searchSessions,
        searchResultLimit: sessions.searchResultLimit,
        requestSessionRename,
        notifyArchivedNotOpenable: () => { notify({ kind: 'archivedNotOpenable' }); },
        renameWorkspace: async (workspaceId, title) => { await workspaces.rename(workspaceId, title); },
        deleteWorkspace: async (workspaceId) => { await workspaces.delete(workspaceId); },
        insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
            await workspaces.insertBefore(workspaceId, beforeWorkspaceId);
        },
        unarchiveSession: async (sessionId) => { await uiWorkspace.unarchiveSession(sessionId); },
        createWorkspace: input => workspaces.create(input),
        requestSearch: shortcutControls.search,
        requestAddWorkspace: shortcutControls.add,
        closeAddWorkspace: shortcutControls.closeAdd,
        setDirectoryBusy: shortcutControls.directoryBusy,
        dismissForkError: shortcutControls.dismissForkError,
        hooks: {
            directoryFlow: browserFlowSource,
            hostInfo,
            presentation: presentationSource,
            workspaceShortcuts: shortcutControls.state,
            shortcuts: ctx.shortcuts.catalog,
        },
    });
    const pickerInjected = () => ({
        createWorkspace: input => workspaces.create(input),
        hooks: { directoryFlow: pickerFlowSource },
    });
    // Each registration declares its owned children in the same call; slot
    // injection follows both the owner and declaration HMR lifetimes.
    ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register({
        name: 'sidebar.workspaces',
        children: {
            'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' },
            'sidebar.workspaces.before': { kind: 'list', scope: 'root' },
            'sidebar.workspaces.header.action': { kind: 'list', scope: 'root' },
            'sidebar.workspaces.presentation': { kind: 'single', scope: 'root' },
            // Every row entry reads the menu's open state through a hook bound
            // from the row's render occurrence (the owner passes the state pair
            // as hookContext).
            'sidebar.workspaces.session.menu.item': {
                kind: 'list', scope: 'root', inject: { hooks: { menuOpenState: menuOpenStateFactory, shortcuts: ctx.shortcuts.catalog } },
            },
            'sidebar.workspaces.session.row.action': { kind: 'list', scope: 'root' },
            'sidebar.session.row.leading': { kind: 'list', scope: 'root' },
            'sidebar.session.row.hover': { kind: 'list', scope: 'root' },
        },
        store: viewStore,
        inject: browserInjected,
        locale: NS,
    }, WorkspaceBrowser));
    // The shipped row actions take the same route as a plugin's: `slots.inject`
    // waits for the browser registration above to declare each list, and the
    // entries leave with it. Orders step by 100 so a plugin entry can land
    // between them.
    ctx.slots.inject('sidebar.workspaces.session.menu.item', function* () {
        yield ctx.slots.register({ name: 'sidebar.workspaces.session.menu.item', id: 'pin', order: 100, locale: NS, inject: pinInjected }, PinSessionMenuItem);
        yield ctx.slots.register({ name: 'sidebar.workspaces.session.menu.item', id: 'rename', order: 200, locale: NS, inject: renameInjected }, RenameSessionMenuItem);
        yield ctx.slots.register({ name: 'sidebar.workspaces.session.menu.item', id: 'fork', order: 300, locale: NS, inject: forkInjected }, ForkSessionMenuItem);
        yield ctx.slots.register({ name: 'sidebar.workspaces.session.menu.item', id: 'archive', order: 400, locale: NS, inject: archiveInjected }, ArchiveSessionMenuItem);
    });
    ctx.slots.inject('sidebar.workspaces.session.row.action', function* () {
        yield ctx.slots.register({ name: 'sidebar.workspaces.session.row.action', id: 'archive', order: 100, locale: NS, inject: archiveInjected }, ArchiveSessionRowButton);
        yield ctx.slots.register({ name: 'sidebar.workspaces.session.row.action', id: 'pin', order: 200, locale: NS, inject: pinInjected }, PinSessionRowButton);
    });
    // The surfaces the actions raise live in the frame-wide layer: they must
    // outlive the row menu the action sat in.
    ctx.slots.inject('shell.overlay', function* () {
        yield ctx.slots.register({
            name: 'shell.overlay', id: 'workspace.session-rename', locale: NS, inject: renameDialogInjected,
        }, SessionRenameDialog);
        yield ctx.slots.register({
            name: 'shell.overlay', id: 'workspace.session-archive', locale: NS, inject: archiveConfirmInjected,
        }, SessionArchiveConfirmDialog);
        // The toast shares the browser's viewing store: it reads the archived
        // filter to drop the archived notice's filter action once rows are visible.
        yield ctx.slots.register({
            name: 'shell.overlay', id: 'workspace.row-toast', locale: NS, store: viewStore, inject: rowToastInjected,
        }, RowActionToast);
    });
    ctx.slots.inject('conversation.hero.workspace', () => ctx.slots.register({
        name: 'conversation.hero.workspace',
        children: { 'conversation.hero.workspace.directoryFlow': { kind: 'single', scope: 'root' } },
        inject: pickerInjected,
        locale: NS,
    }, WorkspacePicker));
}
/**
 * The activity a Host `workspace/session-active` refusal reported, or nothing
 * for any other failure. The class identity check goes by name: client plugin
 * bundles do not share error-class identity.
 */
function activeSessionRefusal(reason) {
    if (!(reason instanceof Error) || reason.name !== 'WorkspaceArchiveError')
        return undefined;
    const { rpcError } = reason;
    return rpcError.code === 'workspace/session-active' ? rpcError.details.activity : undefined;
}
