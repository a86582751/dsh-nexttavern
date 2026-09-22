// Generated from runtime/alpha3/compat/ui-workspace/src/client/pin-order.ts; edit the TypeScript source.
import { FLAT_SESSION_ORDER_KEY } from "./stores.js";
import { owningGroupKey, sessionMemberIds, UNGROUPED_KEY } from "./tree.js";
/**
 * Every account's complete membership: each Workspace, Ungrouped, and the flat list.
 * @param workspaces - current Host Workspaces.
 * @param list - current Session list snapshot.
 * @param rowState - registry-global pin and archive sets.
 * @returns the order source for one pin write.
 */
export function pinOrderSource(workspaces, list, rowState) {
    const accounted = new Set(workspaces.flatMap(workspace => workspace.sessionIds));
    return {
        members: Object.fromEntries([
            ...workspaces.map(workspace => [workspace.workspaceId, workspace.sessionIds]),
            [UNGROUPED_KEY, list.ids.filter(id => list.byId[id] !== undefined && !accounted.has(id))],
            [FLAT_SESSION_ORDER_KEY, sessionMemberIds(list)],
        ]),
        summaries: list.byId,
        rowState,
    };
}
/**
 * The accounts a pinned Session leads: its group (or Ungrouped) and the flat list.
 * @param workspaces - current Host Workspaces.
 * @param sessionId - the Session being pinned.
 * @returns the account keys `pinSessionOrder` fronts.
 */
export function pinOrderAccounts(workspaces, sessionId) {
    return [owningGroupKey(workspaces, sessionId), FLAT_SESSION_ORDER_KEY];
}
