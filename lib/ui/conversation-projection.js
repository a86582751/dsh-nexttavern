// Generated from runtime/alpha3/src/ui/conversation-projection.ts; edit the TypeScript source.
const copy = (value) => {
    if (typeof structuredClone === 'function')
        return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
};
const catalogRoot = (id, catalog) => {
    const record = catalog?.schemaVersion === 1 && typeof id === 'string' ? catalog.worldlines?.[id] : undefined;
    return record && typeof record.conversationId === 'string' ? record.conversationId : id;
};
const validCatalog = (catalog) => !!(catalog?.schemaVersion === 1 && catalog.worldlines && catalog.conversations);
/** Project native Session summaries into one row per known worldline root. */
export function projectConversationList(nativeState, catalog) {
    // Native context timelines can be megabytes. Share read-only nested values.
    const result = { ...nativeState };
    if (!validCatalog(catalog) || !Array.isArray(nativeState?.ids) || !nativeState?.byId || typeof nativeState.byId !== 'object')
        return result;
    const ids = nativeState.ids;
    const present = new Set(ids);
    const roots = new Map();
    const missing = new Set();
    for (const id of ids) {
        const root = catalogRoot(id, catalog);
        if (root !== id && !present.has(root)) {
            missing.add(root);
            continue;
        }
        const members = roots.get(root) ?? [];
        members.push(id);
        roots.set(root, members);
    }
    const projectedIds = [];
    const projectedById = {};
    for (const id of ids) {
        if (catalogRoot(id, catalog) !== id)
            continue;
        const summary = nativeState.byId[id];
        if (!summary)
            continue;
        let updatedAt = Number(summary.updatedAt) || 0;
        let running = false;
        for (const member of roots.get(id) ?? [id]) {
            const item = nativeState.byId[member];
            if (!item)
                continue;
            const time = Number(item.updatedAt);
            if (Number.isFinite(time))
                updatedAt = Math.max(updatedAt, time);
            if (item.running === true)
                running = true;
        }
        projectedIds.push(id);
        const parentSessionId = summary.parentSessionId ? catalogRoot(summary.parentSessionId, catalog) : summary.parentSessionId;
        projectedById[id] = summary.updatedAt === updatedAt && summary.running === running && summary.parentSessionId === parentSessionId
            ? summary : { ...summary, updatedAt, running, ...(parentSessionId !== summary.parentSessionId ? { parentSessionId } : {}) };
    }
    return { ...result, ids: projectedIds, byId: projectedById, current: catalogRoot(nativeState.current, catalog), missingConversationIds: [...missing] };
}
/** Project workspace membership without mutating the native snapshot. */
export function projectConversationWorkspaces(nativeSnapshot, catalog) {
    // A workspace carries every session id in it, so cloning the whole snapshot on
    // each native update is the same cost projectConversationList already dropped:
    // share the read-only nested values and rebuild only the membership arrays that
    // actually differ.
    const result = { ...(nativeSnapshot ?? {}) };
    if (!validCatalog(catalog) || !Array.isArray(nativeSnapshot?.items))
        return result;
    const assignedRoots = new Set();
    const items = nativeSnapshot.items.map(item => {
        const source = Array.isArray(item?.sessionIds) ? item.sessionIds : [];
        const sessionIds = [];
        for (const id of source) {
            if (catalogRoot(id, catalog) !== id || assignedRoots.has(id))
                continue;
            sessionIds.push(id);
            assignedRoots.add(id);
        }
        const unchanged = sessionIds.length === source.length && sessionIds.every((value, index) => value === source[index]);
        return unchanged ? item : { ...item, sessionIds };
    });
    const sourceArchived = nativeSnapshot.archivedSessionIds ?? [];
    const archived = [];
    for (const id of sourceArchived)
        if (catalogRoot(id, catalog) === id)
            archived.push(id);
    const archivedUnchanged = archived.length === sourceArchived.length && archived.every((value, index) => value === sourceArchived[index]);
    return { ...result, items, ...(archivedUnchanged ? {} : { archivedSessionIds: archived }) };
}
// Native search opens a Session. Only its selected worldline may supply the snippet.
export function projectConversationSearch(result, catalog) {
    if (!validCatalog(catalog))
        return copy(result ?? {});
    const seen = new Set(), items = [];
    for (const item of result?.items ?? []) {
        const root = catalogRoot(item.sessionId, catalog), active = resolveConversationExecution(root, catalog);
        if (active !== item.sessionId || seen.has(root))
            continue;
        seen.add(root);
        items.push(root === item.sessionId ? copy(item) : { ...copy(item), sessionId: root, executionSessionId: item.sessionId });
    }
    return { ...copy(result ?? {}), items };
}
const usableExecution = (root, candidate, catalog) => {
    if (candidate === root)
        return root;
    const record = candidate === undefined ? undefined : catalog.worldlines?.[candidate];
    return record?.conversationId === root && record.status === 'ready' ? candidate : null;
};
export function resolveConversationExecution(root, catalog) {
    if (!validCatalog(catalog) || typeof root !== 'string')
        return root;
    return usableExecution(root, catalog.conversations[root]?.activeSessionId, catalog) ?? root;
}
