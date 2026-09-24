// Generated from runtime/alpha3/compat/ui-workspace/src/client/tree.ts; edit the TypeScript source.
/**
 * Derives the workspace browser tree from caller-projected Workspace and
 * Session order. Unassigned Sessions trail under Ungrouped; only the selected
 * blank Session remains visible.
 */
import {} from '@deepseek-ai/dsh-api-session-controller/client';
import { assertNever } from '@deepseek-ai/dsh-util-values';
import { workspaceTitleOf } from '@deepseek-ai/dsh-util-workspace-path';
/** Group key for Sessions outside every Workspace. */
export const UNGROUPED_KEY = '';
/**
 * Resolve the Workspace browser group that owns one Session.
 * @param workspaces - authoritative Workspace membership.
 * @param sessionId - Session whose browser group is required.
 * @returns owning Workspace id, or {@link UNGROUPED_KEY} when no Workspace accounts for it.
 */
export function owningGroupKey(workspaces, sessionId) {
    return workspaces.find(workspace => workspace.sessionIds.includes(sessionId))
        ?.workspaceId ?? UNGROUPED_KEY;
}
function mainSessionId(list) {
    return Object.values(list.byId)
        .find(session => (session.retainedBy.mainView ?? 0) > 0)?.id;
}
/**
 * Directory display label: basename of the path (both separators accepted).
 * Ungrouped-bucket fallback for surfaces without a workspace title.
 * @param cwd - directory path, or undefined for the ungrouped bucket.
 * @returns basename, the raw cwd when it has no basename, or an empty ungrouped marker.
 */
export function workspaceLabel(cwd) {
    if (cwd === undefined || cwd === '')
        return '';
    const base = workspaceTitleOf(cwd);
    return base !== '' ? base : cwd;
}
/**
 * Project known account members by current Session recency.
 * @param sessionIds - authoritative account membership.
 * @param summaries - current Session summaries; members without a summary are omitted until it arrives.
 * @returns known members newest first, with Session identity as the deterministic tie-break.
 */
export function orderByRecency(sessionIds, summaries) {
    return sessionIds.flatMap((id) => {
        const summary = summaries[id];
        if (summary === undefined)
            return [];
        return [{ id, rank: summary.updatedAt }];
    })
        .sort((a, b) => {
        if (a.rank !== b.rank)
            return b.rank - a.rank;
        return a.id < b.id ? -1 : 1;
    })
        .map(member => member.id);
}
/**
 * Reconcile a browser-local manual order with current account membership.
 * New ordinary forks precede their sources without changing saved entries' relative order.
 * @param memberIds - authoritative account membership.
 * @param savedOrder - previously saved browser-local order.
 * @param summaries - current Session metadata; unknown new members wait for their summaries.
 * @param rowState - global pin and archive membership; only account members can supplement the order.
 * @returns saved relative positions plus missing members ordered by pin, fork source, recency, and archive status.
 */
export function reconcileManualOrder(memberIds, savedOrder, summaries, rowState) {
    const members = new Map(memberIds.map(id => [id, id]));
    const included = new Set();
    const ordered = [];
    for (const key of savedOrder ?? []) {
        const id = members.get(key);
        if (id === undefined || included.has(key))
            continue;
        ordered.push(id);
        included.add(key);
    }
    const archived = new Set(rowState?.archivedSessionIds);
    const pins = [];
    for (const sessionId of rowState?.pinnedSessionIds ?? []) {
        const id = members.get(sessionId);
        if (id === undefined || included.has(id) || archived.has(id) || summaries[id] === undefined)
            continue;
        pins.push(id);
        included.add(id);
    }
    const ordinary = [];
    const archives = [];
    for (const id of orderByRecency([...members.values()].filter(id => !included.has(id)), summaries)) {
        if (archived.has(id))
            archives.push(id);
        else
            ordinary.push(id);
    }
    const result = [...pins, ...ordered, ...ordinary, ...archives];
    const pending = new Set(ordinary);
    const placeFork = (id) => {
        if (!pending.delete(id))
            return;
        const parentId = summaries[id]?.parentId;
        if (parentId === undefined || parentId === id || !result.includes(parentId))
            return;
        placeFork(parentId);
        result.splice(result.indexOf(id), 1);
        result.splice(result.indexOf(parentId), 0, id);
    };
    for (const id of [...ordinary].reverse())
        placeFork(id);
    return result;
}
/**
 * Keep the selected provisional New Session ahead of either base order.
 * @param order - recency or reconciled manual order.
 * @param currentBlank - selected blank Session in this account, when present.
 * @returns a copy with the selected blank first and no duplicate slot.
 */
export function pinCurrentBlank(order, currentBlank) {
    if (currentBlank === undefined)
        return [...order];
    return [currentBlank, ...order.filter(id => id !== currentBlank)];
}
/**
 * Ordinary sessions are visible; among blank sessions, only the current one
 * is visible. Subagent children use their parent header catalog; archived
 * sessions follow the archived filter, while their accounting slots remain
 * either way so unarchiving restores position.
 */
function sessionVisible(session, current, archived, archivedFilter) {
    if (session.origin === 'subagent')
        return false;
    if (session.blank && session.id !== current)
        return false;
    switch (archivedFilter) {
        case 'default':
            return !archived.has(session.id);
        case 'show':
            return true;
        case 'only':
            return archived.has(session.id);
        /* v8 ignore next 2 -- closed-union backstop; only reached if the filter is forged */
        default:
            return assertNever(archivedFilter);
    }
}
/**
 * Keep the visible New Session placeholder first, then partition pinned and
 * ordinary rows without changing either partition's caller order.
 */
function sectionMembers(members, pinned, archived) {
    const placeholders = [];
    const leading = [];
    const rest = [];
    for (const member of members) {
        if (member.blank)
            placeholders.push(member);
        else if (!archived.has(member.id) && pinned.has(member.id))
            leading.push(member);
        else
            rest.push(member);
    }
    return [...placeholders, ...leading, ...rest];
}
/**
 * A blank session is the selected Workspace's provisional New Session row;
 * its canonical title never enters search (blank rows are query-excluded)
 * and the renderer localizes its display label.
 */
function sessionTitle(session) {
    return session.blank ? '' : session.displayTitle;
}
/** Build one group without projecting session lineage into presentation. */
function buildGroup(key, workspaceId, cwd, createdAt, label, members) {
    return { key, workspaceId, cwd, createdAt, label, sessions: [...members] };
}
/** Apply a stored Ungrouped order and append newly loose Sessions by recency. */
function orderedUngrouped(members, stored, summaries) {
    const byId = new Map(members.map(session => [session.id, session]));
    const ids = stored === undefined
        ? orderByRecency(members.map(session => session.id), summaries)
        : reconcileManualOrder(members.map(session => session.id), stored, summaries);
    return ids.flatMap((id) => {
        const session = byId.get(id);
        /* v8 ignore next -- ids are projected exclusively from the members used to build byId. */
        return session === undefined ? [] : [session];
    });
}
/**
 * Group Sessions by Workspace: one group per caller-ordered entity, with
 * members resolved from caller-ordered sessionIds. Sessions outside every
 * Workspace trail in the browser-local Ungrouped order, which falls back to
 * recency before that order is initialized.
 */
function groupByWorkspace(list, workspaces, archived, archivedFilter, ungroupedOrder) {
    const current = mainSessionId(list);
    const groups = [];
    const accounted = new Set();
    for (const workspace of workspaces) {
        const members = [];
        for (const id of workspace.sessionIds) {
            const summary = list.byId[id];
            if (summary === undefined)
                continue; // account may lead the list pull; the row appears when the summary lands
            accounted.add(id);
            if (!sessionVisible(summary, current, archived, archivedFilter))
                continue;
            members.push(summary);
        }
        // The archived-only view lists archives, not the Workspace inventory, so
        // a Workspace without archived Sessions contributes no group.
        if (archivedFilter === 'only' && members.length === 0)
            continue;
        groups.push(buildGroup(workspace.workspaceId, workspace.workspaceId, workspace.path, Date.parse(workspace.createdAt), workspace.title, members));
    }
    const stray = list.ids
        .map(id => list.byId[id])
        .filter((s) => s !== undefined && !accounted.has(s.id) && sessionVisible(s, current, archived, archivedFilter));
    if (stray.length > 0) {
        groups.push(buildGroup(UNGROUPED_KEY, undefined, undefined, undefined, '', orderedUngrouped(stray, ungroupedOrder, list.byId)));
    }
    return groups;
}
/** Keep navigation presentation independent from domain-owned interaction objects. */
function visiblePendingKind(kind) {
    switch (kind) {
        case 'approval':
        case 'plan-review':
        case 'question':
            return kind;
        default:
            return undefined;
    }
}
function runningChildCount(list, parentId, statuses) {
    return list.projectionsBySession[parentId]?.values.subagentCatalog?.reduce((count, child) => count + ((statuses.get(child.id)?.running ?? list.byId[child.id]?.running) === true ? 1 : 0), 0) ?? 0;
}
function sessionNode(s, list, statuses, pinned, archived) {
    const status = statuses.get(s.id);
    const pendingInteraction = visiblePendingKind(status?.pendingInteraction?.kind);
    return {
        id: s.id,
        title: sessionTitle(s),
        blank: s.blank,
        running: status?.running ?? s.running,
        runningSubagentCount: runningChildCount(list, s.id, statuses),
        completed: status?.completionUnread === true,
        pinned: !archived.has(s.id) && pinned.has(s.id),
        archived: archived.has(s.id),
        updatedAt: s.updatedAt,
        ...(pendingInteraction === undefined ? {} : { pendingInteraction }),
    };
}
/**
 * Derive the workspace browser groups with every session as a top-level row.
 *
 * Every group shows, except that the archived-only filter drops groups
 * without visible members; sessions populate under expanded groups with
 * pinned rows leading in the selected local order. Blank sessions are
 * excluded except for the selected provisional New Session row; archived
 * sessions keep their slots and appear per the archived filter. Content
 * search lives outside this derivation (see {@link deriveSearchResults}).
 * @param list - sessions list snapshot (`mainView` retention feeds containsCurrent).
 * @param workspaces - real Workspaces in Host group order with caller-projected Session order.
 * @param rowState - registry-global pin and archive sets plus the archived filter.
 * @param statuses - unified UI status by Session.
 * @param view - local expansion arrays.
 * @returns group sections in render order.
 */
export function deriveGroups(list, workspaces, rowState, statuses, view) {
    const archived = new Set(rowState.archivedSessionIds);
    const pinned = new Set(rowState.pinnedSessionIds);
    const expandedGroups = new Set(view.expandedGroups);
    const current = mainSessionId(list);
    const currentGroup = current === undefined
        ? undefined
        : owningGroupKey(workspaces, current);
    const groups = [];
    for (const g of groupByWorkspace(list, workspaces, archived, rowState.archivedFilter, view.ungroupedOrder)) {
        const expanded = expandedGroups.has(g.key);
        groups.push({
            key: g.key,
            workspaceId: g.workspaceId,
            cwd: g.cwd,
            createdAt: g.createdAt,
            label: g.label,
            sessionCount: g.sessions.length,
            expanded,
            containsCurrent: g.key === currentGroup,
            sessions: expanded
                ? sectionMembers(g.sessions, pinned, archived)
                    .map(session => sessionNode(session, list, statuses, pinned, archived))
                : [],
        });
    }
    return groups;
}
/**
 * Select complete flat-list membership, independently of archive visibility.
 * @param list - sessions list snapshot.
 * @returns known ordinary Session ids, including archives and only the current blank.
 */
export function sessionMemberIds(list) {
    return visibleSessionIds(list, [], 'show');
}
/**
 * Select visible flat-list members without deriving row presentation or ordering.
 * @param list - sessions list snapshot.
 * @param archivedSessionIds - registry-global archive set.
 * @param archivedFilter - archived-row visibility choice.
 * @returns known visible Session ids in list order, including ordinary forks and only the current blank.
 */
export function visibleSessionIds(list, archivedSessionIds, archivedFilter) {
    const archived = new Set(archivedSessionIds);
    const current = mainSessionId(list);
    return list.ids.filter((id) => {
        const s = list.byId[id];
        return s !== undefined && sessionVisible(s, current, archived, archivedFilter);
    });
}
/**
 * Derive flat rows from the browser's complete ordered Session ids, with
 * pinned rows fronted ahead of the supplied order.
 * @param list - sessions list snapshot used to select the ids.
 * @param sessionIds - complete account members in the selected order, including hidden archives.
 * @param rowState - registry-global pin and archive sets plus the archived filter.
 * @param statuses - unified UI status by Session.
 * @returns flat rows in sectioned order with current status indicators.
 */
export function deriveFlat(list, sessionIds, rowState, statuses) {
    const archived = new Set(rowState.archivedSessionIds);
    const pinned = new Set(rowState.pinnedSessionIds);
    const current = mainSessionId(list);
    const members = sessionIds.flatMap((id) => {
        const session = list.byId[id];
        return session !== undefined && sessionVisible(session, current, archived, rowState.archivedFilter)
            ? [session]
            : [];
    });
    return sectionMembers(members, pinned, archived)
        .map(session => sessionNode(session, list, statuses, pinned, archived));
}
/**
 * Merge immediate title/Workspace substring matches with ranked Host content
 * matches. Local rows lead newest-first, content-only rows retain backend
 * order, and duplicate sessions receive the backend snippet in place.
 * @param list - session metadata authority.
 * @param workspaces - Workspace membership and display labels.
 * @param query - caller text; surrounding whitespace is ignored.
 * @param archivedSessionIds - registry-global archive set (members match per the archived filter).
 * @param archivedFilter - archived-row visibility choice; search follows it.
 * @param statuses - unified UI status by Session.
 * @param content - ranked Host content-search page.
 * @param limit - protocol-owned maximum merged row count.
 * @returns bounded deduplicated flat rows and a refine-query hint bit.
 */
export function deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, content, limit) {
    const q = query.trim().toLowerCase();
    if (q === '')
        return { items: [], hasMore: false };
    const archived = new Set(archivedSessionIds);
    const current = mainSessionId(list);
    const workspaceBySession = new Map();
    for (const workspace of workspaces) {
        for (const sessionId of workspace.sessionIds) {
            if (!workspaceBySession.has(sessionId))
                workspaceBySession.set(sessionId, workspace.title);
        }
    }
    const labelOf = (summary) => workspaceBySession.get(summary.id) ?? workspaceLabel(summary.cwd);
    const contentBySession = new Map();
    for (const item of content.items) {
        if (!contentBySession.has(item.sessionId))
            contentBySession.set(item.sessionId, item);
    }
    const local = [];
    for (const id of list.ids) {
        const summary = list.byId[id];
        // Blank placeholders never match a query (their canonical title displays
        // localized, so matching it would tie search to one language).
        if (summary === undefined || summary.blank || !sessionVisible(summary, current, archived, archivedFilter))
            continue;
        if (sessionTitle(summary).toLowerCase().includes(q)
            || labelOf(summary).toLowerCase().includes(q)) {
            local.push(summary);
        }
    }
    const localById = new Map(local.map(summary => [summary.id, summary]));
    const orderedLocal = orderByRecency(local.map(summary => summary.id), list.byId)
        .map(id => localById.get(id));
    const ordered = [];
    const included = new Set();
    const include = (summary) => {
        if (included.has(summary.id))
            return;
        included.add(summary.id);
        ordered.push(summary);
    };
    for (const summary of orderedLocal)
        include(summary);
    for (const item of content.items) {
        const summary = list.byId[item.sessionId];
        if (summary !== undefined && !summary.blank && sessionVisible(summary, current, archived, archivedFilter))
            include(summary);
    }
    return {
        items: ordered.slice(0, limit).map((summary) => {
            const match = contentBySession.get(summary.id);
            const status = statuses.get(summary.id);
            const pendingInteraction = visiblePendingKind(status?.pendingInteraction?.kind);
            return {
                id: summary.id,
                title: sessionTitle(summary),
                workspace: labelOf(summary),
                running: status?.running ?? summary.running,
                runningSubagentCount: runningChildCount(list, summary.id, statuses),
                ...(pendingInteraction === undefined
                    ? {}
                    : { pendingInteraction }),
                completed: status?.completionUnread === true,
                archived: archived.has(summary.id),
                ...match === undefined ? {} : { snippet: match.snippet },
            };
        }),
        hasMore: content.hasMore || ordered.length > limit,
    };
}
/** Normalize separators for comparison without interpreting POSIX backslashes as separators. */
function folderPath(path) {
    const windows = /^[A-Za-z]:[/\\]/.test(path) || path.startsWith('\\\\');
    return (windows ? path.replaceAll('\\', '/') : path).replace(/\/+$/, '');
}
/**
 * Find the nearest registered ancestor, excluding the Workspace directory itself.
 * Paths use Host spelling; matching is case-sensitive, like Workspace identity.
 * @param path - Workspace directory.
 * @param parents - registered Workspace directory paths.
 * @returns the owning parent path, or undefined when no parent contains the Workspace.
 */
export function owningParentFolder(path, parents) {
    const child = folderPath(path);
    let owner;
    let length = -1;
    for (const parent of parents) {
        const root = folderPath(parent);
        if (root.length > length && child !== root && child.startsWith(`${root}/`)) {
            owner = parent;
            length = root.length;
        }
    }
    return owner;
}
