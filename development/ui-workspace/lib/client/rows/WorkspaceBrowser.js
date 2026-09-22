// Generated from runtime/alpha3/compat/ui-workspace/src/client/rows/WorkspaceBrowser.tsx; edit the TypeScript source.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The workspace/session browsing region filling the sidebar shell's
 * `sidebar.workspaces` hole: section header (title + view options + add
 * workspace), search, the grouped tree or flat list, and the workspace
 * dialogs. Wide state renders the full browser; rail state renders the two
 * region icons (search / add workspace) as 36px controls on the shell's shared
 * rail entry path, each requesting expansion through the owner share. Adding
 * is the header button's one action, so it raises the directory flow with no
 * menu in between; the flow and its error dialog live in WorkspacePicker
 * (same package — direct composition, no slot between them). A Session row's
 * "..." menu and hover buttons are the `sidebar.workspaces.session.menu.item`
 * and `sidebar.workspaces.session.row.action` lists rendered through this
 * entry's `renderSlot`; the actions in them, this package's own included,
 * are slot entries with their own behavior, so this component threads no
 * action callbacks and hosts no action surface.
 */
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Button, IconArchiveCheckOutlineRegular, IconArchiveOutlineRegular, IconChevronsUpDownOutlineRegular, IconClockOutlineRegular, IconCloseFillRegular, IconFlatListOutlineRegular, IconFolderCloseRegular, IconProjectAddOutlineRegular, IconSearchOutlineRegular, IconSlidersTwoOutlineRegular, IconWorkspaceTreeOutlineRegular, Menu, Modal, Tooltip, } from '@deepseek-ai/dsh-client-ui-primitives';
import { deriveFlat, deriveGroups, deriveSearchResults, orderByRecency, owningGroupKey, owningParentFolder, pinCurrentBlank, reconcileManualOrder, sessionMemberIds, UNGROUPED_KEY, } from "../tree.js";
import { ProjectRowItem, SearchResultItem, SessionNodeItem } from "./Rows.js";
import { AnimatedRows } from "./AnimatedRows.js";
import { FLAT_SESSION_ORDER_KEY } from "../stores.js";
import { WorkspacePickFlow } from "../WorkspacePicker.js";
import css from './WorkspaceBrowser.module.css';
/**
 * Column slide length (--ds-transition-duration-slow): rail-search focus waits it out —
 * focus() forces a synchronous layout and would jank the slide.
 */
const EXPAND_SLIDE_MS = 300;
/** Pause between the latest keystroke and a Host content-search request. */
const SEARCH_DEBOUNCE_MS = 250;
/** `session.search` wire bound, measured in JavaScript UTF-16 code units. */
const SEARCH_QUERY_MAX_CODE_UNITS = 500;
/** Idle Session rows visible per Workspace before the local overflow control. */
const COLLAPSED_SESSION_LIMIT = 5;
/** Keep provisional and running rows outside the idle-session quota, including parents with running children. */
function collapsedSessionRows(sessions, limit = COLLAPSED_SESSION_LIMIT) {
    let idleCount = 0;
    const rows = sessions.filter((session) => {
        if (session.blank || session.running || session.runningSubagentCount > 0)
            return true;
        if (idleCount >= limit)
            return false;
        idleCount += 1;
        return true;
    });
    return { rows, hiddenCount: sessions.length - rows.length };
}
/** Keep controlled input and RPC payload inside the session.search wire contract. */
function sanitizeSearchQuery(value) {
    const withoutNul = value.replaceAll('\0', '');
    if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS)
        return withoutNul;
    let end = SEARCH_QUERY_MAX_CODE_UNITS;
    const last = withoutNul.charCodeAt(end - 1);
    const next = withoutNul.charCodeAt(end);
    if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF)
        end--;
    return withoutNul.slice(0, end);
}
/**
 * Accept the native drag at document level while a row drag is active: row
 * hover still owns the insertion marker, and releasing outside the list must
 * not be rendered as a rejected drop before dragend commits that last marker.
 */
function useNativeDragAcceptance(active) {
    useEffect(() => {
        if (!active)
            return;
        const acceptDrag = (event) => {
            event.preventDefault();
            if (event.dataTransfer !== null)
                event.dataTransfer.dropEffect = 'move';
        };
        const acceptDrop = (event) => { event.preventDefault(); };
        document.addEventListener('dragover', acceptDrag);
        document.addEventListener('drop', acceptDrop);
        return () => {
            document.removeEventListener('dragover', acceptDrag);
            document.removeEventListener('drop', acceptDrop);
        };
    }, [active]);
}
/** Grouping, ordering, and archived-filter menu; own open state so it resets with the wide chrome. */
function ViewOptionsMenu({ groupBy, orderBy, archivedFilter, onGroupPick, onOrderPick, onArchivedFilterPick, t }) {
    const [open, setOpen] = useState(false);
    return (_jsx(Menu, { open: open, onClose: () => { setOpen(false); }, items: [
            { type: 'label', id: 'group-by', text: t('groupBy.label') },
            { id: 'workspace', label: t('groupBy.workspace'), icon: _jsx(IconFolderCloseRegular, {}) },
            { id: 'workspace-tree', label: t('groupBy.workspaceTree'), icon: _jsx(IconWorkspaceTreeOutlineRegular, {}) },
            { id: 'flat', label: t('groupBy.flat'), icon: _jsx(IconFlatListOutlineRegular, {}) },
            { type: 'separator', id: 'order-by-separator' },
            { type: 'label', id: 'order-by', text: t('orderBy.label') },
            { id: 'manual', label: t('orderBy.manual'), icon: _jsx(IconChevronsUpDownOutlineRegular, {}) },
            { id: 'updated', label: t('orderBy.updated'), icon: _jsx(IconClockOutlineRegular, {}) },
            { type: 'separator', id: 'archived-filter-separator' },
            { type: 'label', id: 'filter-by', text: t('filterBy.label') },
            { id: 'show-archived', label: t('viewOptions.showArchived'), icon: _jsx(IconArchiveOutlineRegular, {}) },
            { id: 'only-archived', label: t('viewOptions.onlyArchived'), icon: _jsx(IconArchiveCheckOutlineRegular, {}) },
        ], selectedIds: [
            groupBy,
            orderBy,
            ...archivedFilter === 'show' ? ['show-archived'] : [],
            ...archivedFilter === 'only' ? ['only-archived'] : [],
        ], onSelect: (id) => {
            if (id === 'workspace' || id === 'workspace-tree' || id === 'flat')
                onGroupPick(id);
            else if (id === 'manual' || id === 'updated')
                onOrderPick(id);
            // The two archived items are mutually exclusive; re-picking the
            // selected one returns to the default hide-archived view.
            else if (id === 'show-archived')
                onArchivedFilterPick(archivedFilter === 'show' ? 'default' : 'show');
            else if (id === 'only-archived')
                onArchivedFilterPick(archivedFilter === 'only' ? 'default' : 'only');
            setOpen(false);
        }, align: "end", dense: true, listClassName: css.viewOptionsMenu, 
        // Portal: the section header clips overflow, so an in-place list would
        // be cut off at the header's bounds.
        portal: true, anchor: (_jsx(Tooltip, { label: t('viewOptions.label'), side: "bottom", delayMs: 500, children: _jsx("button", { type: "button", className: clsx(css.iconButton, css.wide), "aria-label": t('viewOptions.label'), onClick: () => { setOpen(v => !v); }, children: _jsx(IconSlidersTwoOutlineRegular, {}) }) })) }));
}
/** Apply a visible drop to the complete account without removing hidden members. */
function sessionDragOrder(order, rows, drag, over) {
    const source = rows.find(row => row.id === drag.sessionId);
    const target = rows.find(row => row.id === over.id);
    if (source === undefined || target === undefined || source.blank
        || source.pinned !== drag.pinned || target.pinned !== drag.pinned
        || source.id === target.id || !order.includes(source.id))
        return;
    const section = rows.filter(row => row.pinned === drag.pinned);
    const sourceIndex = section.findIndex(row => row.id === source.id);
    const withoutSource = section.filter(row => row.id !== source.id);
    const insertAt = withoutSource.findIndex(row => row.id === target.id) + (over.half === 'after' ? 1 : 0);
    if (insertAt === sourceIndex)
        return;
    const next = order.filter(id => id !== source.id);
    const targetIndex = next.indexOf(target.id);
    if (targetIndex === -1)
        return;
    next.splice(targetIndex + (over.half === 'after' ? 1 : 0), 0, source.id);
    return pinCurrentBlank(next, rows.find(row => row.blank)?.id);
}
/** Resolve an insertion side across the Workspace header, descendants, and Sessions. */
function workspaceGroupHalf(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}
/** The scrolling session tree; unmounting drops the sessions subscription and local row limits. */
function SessionTree({ list, useSessionStatus, startSession, open, workspaces, ungroupedSessionIds, rowState, workspaceReady, animationResetKey, usePanelInfo, onRenameRequest, onDeleteRequest, onSessionRenameRequest, renderSlot, insertWorkspaceBefore, nestWorkspaces, groupExpansion, setGroupExpanded, setSessionOrder, home, t, revealSessionId, onSessionRevealed, }) {
    const panelActive = usePanelInfo(info => info.activePanelId !== null);
    const statuses = useSessionStatus(s => s);
    const current = panelActive
        ? undefined
        : Object.values(list.byId).find(session => (session.retainedBy.mainView ?? 0) > 0)?.id;
    const revealGroup = revealSessionId === undefined || !workspaceReady
        ? undefined
        : owningGroupKey(workspaces, revealSessionId);
    const [sessionLimits, setSessionLimits] = useState({});
    // Transient drag marker state; the selected mode owns the resulting order.
    const [drag, setDrag] = useState(null);
    const sessionDropCommitted = useRef(false);
    const [workspaceDrag, setWorkspaceDrag] = useState(null);
    const workspaceDropCommitted = useRef(false);
    const nativeDragActive = drag !== null || workspaceDrag !== null;
    useNativeDragAcceptance(nativeDragActive);
    const currentGroup = current === undefined || !workspaceReady
        ? undefined
        : owningGroupKey(workspaces, current);
    useEffect(() => {
        if (current === undefined || currentGroup === undefined || Object.hasOwn(groupExpansion, currentGroup))
            return;
        setGroupExpanded(currentGroup, true);
    }, [current, currentGroup, setGroupExpanded, groupExpansion]);
    const parents = useMemo(() => {
        if (!nestWorkspaces)
            return new Map();
        const keysByPath = new Map(workspaces.map(workspace => [workspace.path, workspace.workspaceId]));
        const paths = [...keysByPath.keys()];
        return new Map(workspaces.map((workspace) => {
            const path = owningParentFolder(workspace.path, paths);
            return [workspace.workspaceId, path === undefined ? undefined : keysByPath.get(path)];
        }));
    }, [nestWorkspaces, workspaces]);
    const currentAncestors = useMemo(() => {
        const keys = new Set();
        for (let key = currentGroup === undefined ? undefined : parents.get(currentGroup); key !== undefined; key = parents.get(key)) {
            keys.add(key);
        }
        return keys;
    }, [currentGroup, parents]);
    const expandedGroups = useMemo(() => {
        const ancestorKeys = new Set(parents.values());
        return [...workspaces.map(workspace => workspace.workspaceId), UNGROUPED_KEY]
            .filter(key => groupExpansion[key] ?? ancestorKeys.has(key));
    }, [groupExpansion, parents, workspaces]);
    const groups = useMemo(() => deriveGroups(list, workspaces, rowState, statuses, {
        expandedGroups,
        ungroupedOrder: ungroupedSessionIds,
    }), [list, workspaces, rowState, statuses, expandedGroups, ungroupedSessionIds]);
    useEffect(() => {
        for (let key = revealGroup; key !== undefined; key = parents.get(key)) {
            if (groupExpansion[key] === false || (key === revealGroup && groupExpansion[key] !== true)) {
                setGroupExpanded(key, true);
            }
        }
    }, [groupExpansion, parents, revealGroup, setGroupExpanded]);
    useEffect(() => {
        if (revealSessionId === undefined || revealGroup === undefined)
            return;
        const group = groups.find(candidate => candidate.key === revealGroup);
        if (group === undefined || !group.expanded || !group.sessions.some(row => row.id === revealSessionId))
            return;
        if (collapsedSessionRows(group.sessions).rows.some(row => row.id === revealSessionId))
            return;
        setSessionLimits(limits => limits[revealGroup] === Infinity ? limits : { ...limits, [revealGroup]: Infinity });
    }, [groups, revealGroup, revealSessionId]);
    const now = Date.now();
    const commitSessionDrag = (activeDrag, over) => {
        if (sessionDropCommitted.current)
            return;
        sessionDropCommitted.current = true;
        setDrag(null);
        const group = groups.find(candidate => candidate.key === activeDrag.accountKey);
        if (group === undefined)
            return;
        if (over.id === activeDrag.sessionId)
            return;
        const accountSessionIds = activeDrag.accountKey === UNGROUPED_KEY
            ? ungroupedSessionIds
            : workspaces.find(workspace => workspace.workspaceId === activeDrag.accountKey)?.sessionIds;
        if (accountSessionIds === undefined)
            return;
        const renderedSessions = collapsedSessionRows(group.sessions, sessionLimits[group.key]).rows;
        const nextOrder = sessionDragOrder(accountSessionIds, renderedSessions, activeDrag, over);
        if (nextOrder !== undefined)
            setSessionOrder(activeDrag.accountKey, nextOrder);
    };
    const commitWorkspaceDrag = (activeDrag, over) => {
        if (workspaceDropCommitted.current)
            return;
        workspaceDropCommitted.current = true;
        setWorkspaceDrag(null);
        const owner = parents.get(activeDrag.workspaceId);
        const siblings = workspaces.filter(workspace => parents.get(workspace.workspaceId) === owner);
        const rowIndex = siblings.findIndex(workspace => workspace.workspaceId === over.id);
        if (rowIndex === -1)
            return;
        const anchor = over.half === 'before' ? over.id : siblings[rowIndex + 1]?.workspaceId;
        if (anchor === activeDrag.workspaceId)
            return;
        const sourceIndex = siblings.findIndex(workspace => workspace.workspaceId === activeDrag.workspaceId);
        const anchorIndex = anchor === undefined
            ? siblings.length
            : siblings.findIndex(workspace => workspace.workspaceId === anchor);
        if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1))
            return;
        insertWorkspaceBefore(activeDrag.workspaceId, anchor).catch((reason) => {
            console.warn('workspace reorder rejected:', reason);
        });
    };
    const childrenByParent = useMemo(() => {
        const children = new Map();
        for (const group of groups) {
            const parent = parents.get(group.key);
            const siblings = children.get(parent);
            if (siblings === undefined)
                children.set(parent, [group]);
            else
                siblings.push(group);
        }
        return children;
    }, [groups, parents]);
    const rootGroups = childrenByParent.get(undefined) ?? [];
    const workspaceDropAtListStart = rootGroups[0]?.workspaceId !== undefined
        && workspaceDrag?.over?.id === rootGroups[0].workspaceId
        && workspaceDrag.over.half === 'before';
    const rowKeys = groups.length === 0 ? ['empty'] : [];
    const renderGroup = (group, depth) => {
        const workspaceId = group.workspaceId;
        const children = childrenByParent.get(group.key) ?? [];
        const compatibleDrag = workspaceDrag !== null && parents.get(workspaceDrag.workspaceId) === parents.get(group.key);
        const collapsed = collapsedSessionRows(group.sessions);
        const visible = collapsedSessionRows(group.sessions, sessionLimits[group.key]);
        const sessionsExpanded = visible.hiddenCount === 0;
        rowKeys.push(`workspace:${group.key}`);
        const childRows = group.expanded ? children.map(child => renderGroup(child, depth + 1)) : [];
        const sessions = visible.rows;
        for (const node of sessions)
            rowKeys.push(`session:${node.id}`);
        if (collapsed.hiddenCount > 0)
            rowKeys.push(`overflow:${group.key}`);
        const workspaceMarker = workspaceId !== undefined && workspaceDrag?.over?.id === workspaceId
            ? workspaceDrag.over.half
            : null;
        const workspaceDragProps = workspaceId === undefined ? undefined : {
            start: () => {
                workspaceDropCommitted.current = false;
                setWorkspaceDrag({ workspaceId, over: null });
            },
            end: () => {
                if (workspaceDrag?.over !== null && workspaceDrag?.over !== undefined) {
                    commitWorkspaceDrag(workspaceDrag, workspaceDrag.over);
                }
                else {
                    setWorkspaceDrag(null);
                }
                workspaceDropCommitted.current = false;
            },
        };
        const hoverWorkspace = workspaceId === undefined || !compatibleDrag
            ? undefined
            : (half) => {
                setWorkspaceDrag(active => active === null
                    ? active
                    : { ...active, over: { id: workspaceId, half } });
            };
        const dropWorkspace = workspaceId === undefined || !compatibleDrag
            ? undefined
            : (half) => {
                commitWorkspaceDrag(workspaceDrag, { id: workspaceId, half });
            };
        return (
        // Group section: header, descendant Workspaces, and own Session rows. The
        // inter-group breathing room is the section's own margin
        // (WorkspaceBrowser.module.css).
        _jsxs("div", { style: { '--dsh-workspace-indent': `${depth * 12}px` }, className: clsx(css.groupSection, workspaceMarker === 'before' && css.workspaceDropBefore, workspaceMarker === 'after' && css.workspaceDropAfter), onDragOver: workspaceDrag === null
                ? undefined
                : (e) => {
                    e.preventDefault();
                    if (hoverWorkspace === undefined && parents.get(group.key) !== undefined)
                        return;
                    e.stopPropagation();
                    if (hoverWorkspace === undefined) {
                        e.dataTransfer.dropEffect = 'none';
                        if (workspaceDrag.over !== null)
                            setWorkspaceDrag({ ...workspaceDrag, over: null });
                    }
                    else {
                        e.dataTransfer.dropEffect = 'move';
                        hoverWorkspace(workspaceGroupHalf(e));
                    }
                }, onDrop: workspaceDrag === null
                ? undefined
                : (e) => {
                    e.preventDefault();
                    if (dropWorkspace === undefined && parents.get(group.key) !== undefined)
                        return;
                    e.stopPropagation();
                    if (dropWorkspace === undefined) {
                        workspaceDropCommitted.current = true;
                        setWorkspaceDrag(null);
                    }
                    else {
                        dropWorkspace(workspaceGroupHalf(e));
                    }
                }, children: [_jsx(ProjectRowItem, { group: group, containsCurrentDescendant: currentAncestors.has(group.key), home: home, t: t, onToggle: () => {
                        if (group.expanded) {
                            setSessionLimits(limits => ({ ...limits, [group.key]: COLLAPSED_SESSION_LIMIT }));
                        }
                        setGroupExpanded(group.key, !group.expanded);
                    }, onCreate: () => {
                        if (group.workspaceId !== undefined) {
                            setGroupExpanded(group.key, true);
                            startSession(group.workspaceId);
                        }
                    }, drag: workspaceDragProps, actions: group.workspaceId === undefined
                        ? undefined
                        : {
                            rename: () => {
                                /* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
                                if (group.workspaceId !== undefined)
                                    onRenameRequest(group.workspaceId, group.label);
                            },
                            delete: () => {
                                /* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
                                if (group.workspaceId !== undefined)
                                    onDeleteRequest(group.workspaceId, group.label);
                            },
                        } }), childRows.length > 0 && (_jsx("div", { role: "group", children: childRows })), sessions.map((node) => {
                    // Session drag never leaves its browser-local account, and pinned
                    // rows reorder only within their leading pinned block.
                    const sameGroupDrag = drag !== null && drag.accountKey === group.key;
                    const compatibleTarget = sameGroupDrag && drag.pinned === node.pinned;
                    const normalizeHalf = (half) => node.blank ? 'after' : half;
                    const dragProps = {
                        start: () => {
                            sessionDropCommitted.current = false;
                            setDrag({ accountKey: group.key, sessionId: node.id, pinned: node.pinned, over: null });
                        },
                        active: compatibleTarget,
                        marker: sameGroupDrag && drag.over?.id === node.id ? drag.over.half : null,
                        hover: (half) => {
                            /* v8 ignore next -- narrowing guard: Rows gates hover on `active`, which is false while the drag state is null. */
                            setDrag(d => (d === null ? d : {
                                ...d, over: { id: node.id, half: normalizeHalf(half) },
                            }));
                        },
                        drop: (half) => {
                            /* v8 ignore next -- narrowing guard: Rows gates drop on `active`, which is false while the drag state is null. */
                            if (drag === null)
                                return;
                            commitSessionDrag(drag, { id: node.id, half: normalizeHalf(half) });
                        },
                        end: () => {
                            if (drag?.over !== null && drag?.over !== undefined)
                                commitSessionDrag(drag, drag.over);
                            else
                                setDrag(null);
                            sessionDropCommitted.current = false;
                        },
                    };
                    return (_jsx(SessionNodeItem, { node: node, currentId: current, now: now, onOpen: open, onRenameRequest: onSessionRenameRequest, renderSlot: renderSlot, onReveal: node.id === revealSessionId && group.key === revealGroup
                            ? () => { onSessionRevealed(node.id); }
                            : undefined, drag: dragProps, t: t }, node.id));
                }), collapsed.hiddenCount > 0 && (_jsx("button", { type: "button", className: css.sessionOverflowButton, "data-row-key": `overflow:${group.key}`, "aria-expanded": sessionsExpanded, onClick: () => {
                        setSessionLimits(limits => ({
                            ...limits,
                            [group.key]: sessionsExpanded
                                ? COLLAPSED_SESSION_LIMIT
                                : visible.hiddenCount <= COLLAPSED_SESSION_LIMIT
                                    ? Infinity
                                    : (limits[group.key] ?? COLLAPSED_SESSION_LIMIT) + COLLAPSED_SESSION_LIMIT,
                        }));
                    }, children: sessionsExpanded
                        ? t('sessions.collapse')
                        : t('sessions.expand', { n: visible.hiddenCount }) }))] }, group.key));
    };
    const groupRows = rootGroups.map(group => renderGroup(group, 0));
    return (_jsxs("div", { className: clsx(css.treeBody, css.wide), children: [workspaceDropAtListStart && _jsx("span", { className: css.listTopDropIndicator, "aria-hidden": "true" }), _jsxs(AnimatedRows, { className: clsx(css.list, workspaceDropAtListStart && css.listTopDropActive), label: t('section.sessions'), rowKeys: rowKeys, ready: list.phase === 'ready' && workspaceReady && !nativeDragActive, resetKey: JSON.stringify([animationResetKey, sessionLimits]), children: [groups.length === 0 && (_jsx("div", { className: css.empty, "data-row-key": "empty", children: t('empty.none') })), groupRows] }), _jsx("span", { className: css.fade })] }));
}
/** The flat "In one list" body: every session is one draggable top-level row. */
function FlatList({ list, sessionIds, rowState, useSessionStatus, open, onSessionRenameRequest, renderSlot, usePanelInfo, setSessionOrder, workspaceReady, animationResetKey, revealSessionId, onSessionRevealed, t, }) {
    const panelActive = usePanelInfo(info => info.activePanelId !== null);
    const statuses = useSessionStatus(s => s);
    const rows = useMemo(() => deriveFlat(list, sessionIds, rowState, statuses), [list, sessionIds, rowState, statuses]);
    const [drag, setDrag] = useState(null);
    const dropCommitted = useRef(false);
    useNativeDragAcceptance(drag !== null);
    const currentId = panelActive
        ? undefined
        : Object.values(list.byId).find(session => (session.retainedBy.mainView ?? 0) > 0)?.id;
    const commitDrag = (activeDrag, over) => {
        if (dropCommitted.current)
            return;
        dropCommitted.current = true;
        setDrag(null);
        const nextOrder = sessionDragOrder(sessionIds, rows, activeDrag, over);
        if (nextOrder !== undefined)
            setSessionOrder(FLAT_SESSION_ORDER_KEY, nextOrder);
    };
    const now = Date.now();
    return (_jsxs("div", { className: clsx(css.treeBody, css.wide), children: [_jsxs(AnimatedRows, { className: clsx(css.list, css.flatList), label: t('section.sessions'), rowKeys: rows.length === 0 ? ['empty'] : rows.map(row => `session:${row.id}`), ready: list.phase === 'ready' && workspaceReady && drag === null, resetKey: animationResetKey, children: [rows.length === 0 && (_jsx("div", { className: css.empty, "data-row-key": "empty", children: t('empty.none') })), rows.map((node) => {
                        const active = drag !== null && drag.pinned === node.pinned;
                        const normalizeHalf = (half) => node.blank ? 'after' : half;
                        return (_jsx(SessionNodeItem, { node: node, currentId: currentId, now: now, onOpen: open, onRenameRequest: onSessionRenameRequest, renderSlot: renderSlot, onReveal: node.id === revealSessionId
                                ? () => { onSessionRevealed(node.id); }
                                : undefined, flat: true, drag: {
                                start: () => {
                                    dropCommitted.current = false;
                                    setDrag({ accountKey: FLAT_SESSION_ORDER_KEY, sessionId: node.id, pinned: node.pinned, over: null });
                                },
                                active,
                                marker: active && drag.over?.id === node.id ? drag.over.half : null,
                                hover: (half) => {
                                    setDrag(current => current === null ? current : {
                                        ...current, over: { id: node.id, half: normalizeHalf(half) },
                                    });
                                },
                                drop: (half) => {
                                    if (drag !== null)
                                        commitDrag(drag, { id: node.id, half: normalizeHalf(half) });
                                },
                                end: () => {
                                    if (drag?.over !== null && drag?.over !== undefined)
                                        commitDrag(drag, drag.over);
                                    else
                                        setDrag(null);
                                    dropCommitted.current = false;
                                },
                            }, t: t }, node.id));
                    })] }), _jsx("span", { className: css.fade })] }));
}
/** Flat search body: local metadata matches plus the current Host result page. */
function SearchResults({ useSessions, useSessionStatus, open, onUnarchive, workspaces, archivedSessionIds, archivedFilter, query, remote, resultLimit, usePanelInfo, t, }) {
    const panelActive = usePanelInfo(info => info.activePanelId !== null);
    const list = useSessions(s => s);
    const statuses = useSessionStatus(s => s);
    const currentRemote = remote.query === query
        ? remote
        : { query, status: 'loading', items: [], hasMore: false };
    const results = useMemo(() => deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, currentRemote, resultLimit), [list, workspaces, query, archivedSessionIds, archivedFilter, statuses, currentRemote, resultLimit]);
    const pending = currentRemote.status === 'loading';
    const currentId = panelActive
        ? undefined
        : Object.values(list.byId).find(session => (session.retainedBy.mainView ?? 0) > 0)?.id;
    return (_jsxs("div", { className: clsx(css.treeBody, css.wide), children: [_jsxs("div", { className: css.list, children: [_jsx("div", { className: css.searchTree, role: "tree", "aria-label": t('search.results.aria'), children: results.items.map(result => (_jsx(SearchResultItem, { result: result, currentId: currentId, onOpen: open, onUnarchive: onUnarchive, t: t }, result.id))) }), pending && (
                    /* Two skeleton rows on an empty list, one when local matches already
                       show and only the content hits are outstanding. */
                    _jsx("div", { role: "status", "aria-label": t('search.pending'), children: (results.items.length === 0 ? [0, 1] : [0]).map(i => (_jsxs("div", { className: css.skeletonRow, "aria-hidden": "true", children: [_jsx("span", { className: css.skeletonDot }), _jsxs("span", { className: css.skeletonBars, children: [_jsx("span", { className: css.skeletonBar }), _jsx("span", { className: clsx(css.skeletonBar, css.skeletonBarWide) })] })] }, i))) })), !pending && results.items.length === 0 && (_jsx("div", { className: css.empty, children: t('search.noMatches') })), results.hasMore && (_jsx("div", { className: css.searchStatus, children: t('search.hasMore', { n: resultLimit }) }))] }), _jsx("span", { className: css.fade })] }));
}
/**
 * Render the browsing region.
 * @param props - composed slot props (shell owner share + store + injected actions).
 * @returns the region element tree.
 */
export function WorkspaceBrowser(props) {
    const occupied = props.usePresentation(value => value);
    return occupied ? props.renderSlot('sidebar.workspaces.presentation', {
        browserProps: props,
        renderDefault: overrides => createElement(WorkspaceBrowserContent, { ...props, ...overrides }),
    }) : createElement(WorkspaceBrowserContent, props);
}
function WorkspaceBrowserContent({ wide, usePanelInfo, expandSidebar, useSessions, useSessionStatus, useWorkspaces, useStore, actions, startSession, open, requestSessionRename, notifyArchivedNotOpenable, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, unarchiveSession, createWorkspace, searchSessions, searchResultLimit, useDirectoryFlow, useHostInfo, renderSlot, t, }) {
    const home = useHostInfo(info => info.home);
    // Ordering remains live while the rail or search replaces the list body.
    const list = useSessions(state => state);
    const workspaces = useWorkspaces(state => state.items);
    const workspacePhase = useWorkspaces(state => state.phase);
    const workspaceStreamState = useWorkspaces(state => state.state);
    const archivedSessionIds = useWorkspaces(state => state.archivedSessionIds);
    const pinnedSessionIds = useWorkspaces(state => state.pinnedSessionIds);
    // Live occupancy of this surface's directory-flow hole (the same source the
    // flow reads): a composition without a picking affordance can add nothing.
    const directoryFlowAvailable = useDirectoryFlow(occupied => occupied);
    const groupBy = useStore(s => s.groupBy);
    const orderBy = useStore(s => s.orderBy);
    // Persisted view blobs written before the archived filter existed rehydrate
    // without the field; they read as the default hide-archived view.
    const archivedFilter = useStore(s => s.archivedFilter ?? 'default');
    const groupExpansion = useStore(s => s.groupExpansion);
    const sessionOrderByAccount = useStore(s => s.sessionOrderByAccount);
    // Archived sessions are not openable: the row stays visible under the
    // filter but a click explains instead of navigating.
    const guardedOpen = (sessionId) => {
        if (archivedSessionIds.includes(sessionId)) {
            notifyArchivedNotOpenable();
            return;
        }
        open(sessionId);
    };
    const workspaceReady = workspacePhase === 'ready' && workspaceStreamState !== 'loading';
    const mainSessionId = Object.values(list.byId)
        .find(session => (session.retainedBy.mainView ?? 0) > 0)?.id;
    const currentBlank = mainSessionId !== undefined && list.byId[mainSessionId]?.blank === true
        ? mainSessionId
        : undefined;
    const ungroupedMemberIds = useMemo(() => {
        const accounted = new Set(workspaces.flatMap(workspace => workspace.sessionIds));
        return list.ids.filter(id => list.byId[id] !== undefined && !accounted.has(id));
    }, [list, workspaces]);
    const orderState = useMemo(() => ({ pinnedSessionIds, archivedSessionIds }), [archivedSessionIds, pinnedSessionIds]);
    const rowState = useMemo(() => ({ ...orderState, archivedFilter }), [orderState, archivedFilter]);
    const flatMemberIds = useMemo(() => sessionMemberIds(list), [list]);
    const orderedWorkspaces = useMemo(() => workspaces.map((workspace) => {
        const memberIds = workspace.sessionIds;
        const baseOrder = orderBy === 'updated'
            ? orderByRecency(memberIds, list.byId)
            : reconcileManualOrder(memberIds, sessionOrderByAccount[workspace.workspaceId], list.byId, orderState);
        return {
            ...workspace,
            sessionIds: pinCurrentBlank(baseOrder, currentBlank !== undefined && memberIds.includes(currentBlank) ? currentBlank : undefined),
        };
    }), [currentBlank, list.byId, orderBy, orderState, sessionOrderByAccount, workspaces]);
    const orderedUngroupedSessionIds = useMemo(() => {
        const baseOrder = orderBy === 'updated'
            ? orderByRecency(ungroupedMemberIds, list.byId)
            : reconcileManualOrder(ungroupedMemberIds, sessionOrderByAccount[UNGROUPED_KEY], list.byId, orderState);
        return pinCurrentBlank(baseOrder, currentBlank !== undefined && ungroupedMemberIds.includes(currentBlank) ? currentBlank : undefined);
    }, [currentBlank, list.byId, orderBy, orderState, sessionOrderByAccount, ungroupedMemberIds]);
    const orderedFlatSessionIds = useMemo(() => {
        const baseOrder = orderBy === 'updated'
            ? orderByRecency(flatMemberIds, list.byId)
            : reconcileManualOrder(flatMemberIds, sessionOrderByAccount[FLAT_SESSION_ORDER_KEY], list.byId, orderState);
        return pinCurrentBlank(baseOrder, currentBlank !== undefined && flatMemberIds.includes(currentBlank) ? currentBlank : undefined);
    }, [currentBlank, flatMemberIds, list.byId, orderBy, orderState, sessionOrderByAccount]);
    const activeSessionOrders = useMemo(() => Object.fromEntries([
        ...orderedWorkspaces.map(workspace => [workspace.workspaceId, workspace.sessionIds]),
        [UNGROUPED_KEY, orderedUngroupedSessionIds],
        [FLAT_SESSION_ORDER_KEY, orderedFlatSessionIds],
    ]), [orderedFlatSessionIds, orderedUngroupedSessionIds, orderedWorkspaces]);
    useEffect(() => {
        if (workspacePhase !== 'ready')
            return;
        actions.retainAccountKeys([
            UNGROUPED_KEY,
            FLAT_SESSION_ORDER_KEY,
            ...workspaces.map(workspace => workspace.workspaceId),
        ]);
    }, [actions.retainAccountKeys, workspacePhase, workspaces]);
    useEffect(() => {
        if (list.phase !== 'ready' || workspaceReady || orderBy !== 'manual' || currentBlank === undefined)
            return;
        // A first prompt can end blank pinning before the Workspace baseline arrives.
        // Preserve saved members until that baseline can establish departures.
        const changed = {};
        for (const [key, ids] of Object.entries(activeSessionOrders)) {
            if (key !== FLAT_SESSION_ORDER_KEY && workspacePhase !== 'ready')
                continue;
            const saved = sessionOrderByAccount[key] ?? [];
            if (ids[0] !== currentBlank || saved[0] === currentBlank)
                continue;
            changed[key] = [currentBlank, ...saved.filter(id => id !== currentBlank)];
        }
        if (Object.keys(changed).length > 0)
            actions.syncSessionOrders(changed);
    }, [
        actions.syncSessionOrders,
        activeSessionOrders,
        currentBlank,
        list.phase,
        orderBy,
        sessionOrderByAccount,
        workspacePhase,
        workspaceReady,
    ]);
    useEffect(() => {
        if (list.phase !== 'ready' || !workspaceReady || orderBy !== 'manual' || currentBlank === undefined)
            return;
        const moved = Object.entries(activeSessionOrders).some(([key, ids]) => ids[0] === currentBlank && sessionOrderByAccount[key]?.[0] !== currentBlank);
        if (moved)
            actions.syncSessionOrders(activeSessionOrders);
    }, [
        actions.syncSessionOrders,
        activeSessionOrders,
        currentBlank,
        list.phase,
        orderBy,
        sessionOrderByAccount,
        workspaceReady,
    ]);
    const saveSessionOrder = (accountKey, order) => {
        actions.setSessionOrder(accountKey, order, activeSessionOrders);
    };
    // The query outlives the tree and the input (both wide-only) so collapsing
    // does not silently drop an in-progress filter.
    const [query, setQuery] = useState('');
    const [searchExpanded, setSearchExpanded] = useState(false);
    const [revealSessionId, setRevealSessionId] = useState(undefined);
    const normalizedQuery = sanitizeSearchQuery(query).trim();
    const [remoteSearch, setRemoteSearch] = useState({
        query: '',
        status: 'idle',
        items: [],
        hasMore: false,
    });
    const searchRoot = useRef(null);
    const searchInput = useRef(null);
    // Section-header ＋ opens the picker menu (same popover in wide and rail
    // states; the menu anchors on this button).
    const [wsPickerOpen, setWsPickerOpen] = useState(false);
    const wsPlusRef = useRef(null);
    const composingRef = useRef(false);
    const openSearchResult = (sessionId) => {
        if (archivedSessionIds.includes(sessionId)) {
            notifyArchivedNotOpenable();
            return;
        }
        setRevealSessionId(sessionId);
        setQuery('');
        setSearchExpanded(false);
        open(sessionId);
    };
    const acknowledgeSessionReveal = (sessionId) => {
        setRevealSessionId(current => current === sessionId ? undefined : current);
    };
    useEffect(() => {
        if (normalizedQuery !== '')
            setRevealSessionId(undefined);
    }, [normalizedQuery]);
    // Rail search = expand + land in the search box: the flag arms before the
    // expand request; once the shell flips wide the input mounts and takes focus.
    const [searchOnExpand, setSearchOnExpand] = useState(false);
    useEffect(() => {
        if (wide && searchOnExpand) {
            const timer = window.setTimeout(() => {
                searchInput.current?.focus({ preventScroll: true });
                setSearchOnExpand(false);
            }, EXPAND_SLIDE_MS);
            return () => { window.clearTimeout(timer); };
        }
    }, [wide, searchOnExpand]);
    useEffect(() => {
        if (!wide || !searchExpanded || searchOnExpand)
            return;
        searchInput.current?.focus({ preventScroll: true });
    }, [wide, searchExpanded, searchOnExpand]);
    // Outside-click dismissal stays off while the rail gesture is in flight
    // (searchOnExpand): the rail click flips the shell wide and mounts this
    // listener during its own dispatch, then keeps bubbling to document with
    // the now-unmounted rail button as its target — outside searchRoot, so the
    // listener would dismiss the search that click just opened.
    useEffect(() => {
        if (!wide || !searchExpanded || searchOnExpand)
            return;
        const onClick = (event) => {
            if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true)
                return;
            searchInput.current?.blur();
            if (normalizedQuery !== '')
                return;
            setSearchExpanded(false);
        };
        document.addEventListener('click', onClick);
        return () => { document.removeEventListener('click', onClick); };
    }, [normalizedQuery, wide, searchExpanded, searchOnExpand]);
    useEffect(() => {
        if (normalizedQuery === '') {
            setRemoteSearch({ query: '', status: 'idle', items: [], hasMore: false });
            return;
        }
        const controller = new AbortController();
        setRemoteSearch({
            query: normalizedQuery,
            status: 'loading',
            items: [],
            hasMore: false,
        });
        const timer = window.setTimeout(() => {
            searchSessions(normalizedQuery, controller.signal).then((result) => {
                if (controller.signal.aborted)
                    return;
                setRemoteSearch({
                    query: normalizedQuery,
                    status: 'ready',
                    items: result.items,
                    hasMore: result.hasMore,
                });
            }).catch(() => {
                if (controller.signal.aborted)
                    return;
                setRemoteSearch({
                    query: normalizedQuery,
                    status: 'error',
                    items: [],
                    hasMore: false,
                });
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [normalizedQuery, searchSessions]);
    // Rename dialog (browser-owned so it outlives row unmounts during collapse).
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameDraft, setRenameDraft] = useState('');
    const [renaming, setRenaming] = useState(false);
    const [renameError, setRenameError] = useState(null);
    const renameTrimmed = renameDraft.trim();
    const renameDuplicate = renameTarget !== null && renameTrimmed !== '' && renameTrimmed !== renameTarget.currentTitle
        && workspaces.some(w => w.title === renameTrimmed);
    const renameBlocked = renaming || renameTrimmed === ''
        || renameTarget === null || renameTrimmed === renameTarget.currentTitle || renameDuplicate;
    const closeRename = () => {
        if (renaming)
            return;
        setRenameTarget(null);
        setRenameError(null);
    };
    const confirmRename = () => {
        if (renameBlocked)
            return;
        setRenaming(true);
        setRenameError(null);
        renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
            setRenaming(false);
            setRenameTarget(null);
        }).catch((reason) => {
            setRenaming(false);
            setRenameError(reason instanceof Error ? reason.message : String(reason));
        });
    };
    // The search results' restore button; the row actions own the rest of the
    // Session verbs as slot entries.
    const onSessionUnarchive = (sessionId) => {
        unarchiveSession(sessionId).catch((reason) => {
            console.warn('session unarchive rejected:', reason);
        });
    };
    // Delete dialog is separate from the row so a successful removal can
    // unmount that row without tearing down the in-flight confirmation state.
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteCommittedId, setDeleteCommittedId] = useState(null);
    const [deleteError, setDeleteError] = useState(null);
    useEffect(() => {
        if (deleteCommittedId === null
            || workspaces.some(workspace => workspace.workspaceId === deleteCommittedId))
            return;
        setDeleting(false);
        setDeleteCommittedId(null);
        setDeleteTarget(null);
    }, [deleteCommittedId, workspaces]);
    const closeDelete = () => {
        if (deleting)
            return;
        setDeleteTarget(null);
        setDeleteError(null);
    };
    const confirmDelete = () => {
        /* v8 ignore next -- the Modal is absent without a target and its button is disabled while deleting. */
        if (deleting || deleteTarget === null)
            return;
        setDeleting(true);
        setDeleteCommittedId(null);
        setDeleteError(null);
        deleteWorkspace(deleteTarget.workspaceId).then(() => {
            // Keep the confirmation pending until this component has rendered the
            // committed list projection without the deleted id. Closing earlier
            // exposes one stale React frame to the next Create Workspace gesture.
            setDeleteCommittedId(deleteTarget.workspaceId);
        }).catch((reason) => {
            setDeleting(false);
            setDeleteError(reason instanceof Error ? reason.message : String(reason));
        });
    };
    return (_jsxs("div", { className: clsx(css.root, !wide && css.rail), children: [renderSlot('sidebar.workspaces.before', { wide }), _jsxs("div", { className: css.sectionHeader, children: [wide && (_jsx("span", { className: clsx(css.sectionLabel, css.wide, searchExpanded && css.sectionLabelHidden), children: groupBy === 'flat' ? t('section.sessions') : t('section.workspaces') })), renderSlot('sidebar.workspaces.header.action', { wide }), wide && (_jsx("div", { className: clsx(css.searchSlot, searchExpanded && css.searchSlotExpanded), children: _jsxs("div", { ref: searchRoot, className: clsx(css.search, searchExpanded && css.searchExpanded), onClick: () => {
                                setWsPickerOpen(false);
                                setSearchExpanded(true);
                                searchInput.current?.focus();
                            }, children: [_jsx(Tooltip, { label: t('search'), side: "bottom", delayMs: 500, disabled: searchExpanded, children: _jsx("button", { type: "button", className: css.searchButton, "aria-label": t('search.sessions.aria'), "aria-expanded": searchExpanded, onClick: () => {
                                            setWsPickerOpen(false);
                                            setSearchExpanded(true);
                                        }, children: _jsx(IconSearchOutlineRegular, { size: searchExpanded ? 11 : 14 }) }) }), _jsx("input", { ref: searchInput, className: css.searchInput, type: "text", placeholder: t('search.placeholder'), maxLength: SEARCH_QUERY_MAX_CODE_UNITS, value: query, tabIndex: searchExpanded ? 0 : -1, onChange: (e) => { setQuery(sanitizeSearchQuery(e.target.value)); }, onKeyDown: (e) => {
                                        if (e.key !== 'Escape')
                                            return;
                                        setQuery('');
                                        setSearchExpanded(false);
                                    } }), searchExpanded && (_jsx("button", { type: "button", className: css.clearButton, "aria-label": t('search.clear'), onClick: (e) => {
                                        e.stopPropagation();
                                        setQuery('');
                                        setSearchExpanded(false);
                                    }, children: _jsx(IconCloseFillRegular, {}) }))] }) })), _jsxs("div", { className: clsx(css.headerActions, wide && searchExpanded && css.headerActionsHidden), children: [wide && (_jsx(ViewOptionsMenu, { groupBy: groupBy, orderBy: orderBy, archivedFilter: archivedFilter, onGroupPick: actions.setGroupBy, onOrderPick: (mode) => { actions.setOrderBy(mode, activeSessionOrders); }, onArchivedFilterPick: actions.setArchivedFilter, t: t })), directoryFlowAvailable && (_jsx(Tooltip, { label: t('workspace.add'), side: "bottom", delayMs: 500, children: _jsx("button", { ref: wsPlusRef, type: "button", className: css.iconButton, "aria-label": t('workspace.add'), onClick: () => {
                                        setWsPickerOpen(v => !v);
                                    }, children: _jsx(IconProjectAddOutlineRegular, { size: wide ? 16 : 18 }) }) }))] }), _jsx(WorkspacePickFlow, { t: t, open: wsPickerOpen, anchorRef: wsPlusRef, useWorkspaces: useWorkspaces, createWorkspace: createWorkspace, useDirectoryFlow: useDirectoryFlow, renderDirectoryFlow: owner => renderSlot('sidebar.workspaces.directoryFlow', owner), addOnly: true, side: "right", onPick: (workspaceId) => {
                            setWsPickerOpen(false);
                            startSession(workspaceId);
                        }, onClose: () => { setWsPickerOpen(false); } })] }), !wide && _jsx("div", { className: css.search, children: _jsx(Tooltip, { label: t('search'), children: _jsx("button", { type: "button", className: css.searchButton, "aria-label": t('search.sessions.aria'), onClick: () => {
                            setSearchExpanded(true);
                            setSearchOnExpand(true);
                            expandSidebar();
                        }, children: _jsx(IconSearchOutlineRegular, { size: 18 }) }) }) }), _jsx("div", { className: css.listArea, children: wide && (normalizedQuery !== ''
                    ? (_jsx(SearchResults, { usePanelInfo: usePanelInfo, useSessions: useSessions, useSessionStatus: useSessionStatus, open: openSearchResult, onUnarchive: onSessionUnarchive, workspaces: workspaces, archivedSessionIds: archivedSessionIds, archivedFilter: archivedFilter, query: normalizedQuery, remote: remoteSearch, resultLimit: searchResultLimit, t: t }))
                    : groupBy === 'flat'
                        ? (_jsx(FlatList, { usePanelInfo: usePanelInfo, list: list, sessionIds: orderedFlatSessionIds, rowState: rowState, workspaceReady: workspaceReady, animationResetKey: `${groupBy}/${orderBy}/${archivedFilter}`, useSessionStatus: useSessionStatus, open: guardedOpen, onSessionRenameRequest: requestSessionRename, renderSlot: renderSlot, setSessionOrder: saveSessionOrder, revealSessionId: revealSessionId, onSessionRevealed: acknowledgeSessionReveal, t: t }))
                        : (_jsx(SessionTree, { usePanelInfo: usePanelInfo, list: list, useSessionStatus: useSessionStatus, onSessionRenameRequest: requestSessionRename, renderSlot: renderSlot, workspaces: orderedWorkspaces, ungroupedSessionIds: orderedUngroupedSessionIds, workspaceReady: workspaceReady, nestWorkspaces: groupBy === 'workspace-tree', animationResetKey: `${groupBy}/${orderBy}/${archivedFilter}`, groupExpansion: groupExpansion, setGroupExpanded: actions.setGroupExpanded, setSessionOrder: saveSessionOrder, rowState: rowState, startSession: startSession, open: guardedOpen, insertWorkspaceBefore: insertWorkspaceBefore, revealSessionId: revealSessionId, onSessionRevealed: acknowledgeSessionReveal, home: home, t: t, onRenameRequest: (workspaceId, currentTitle) => {
                                setRenameTarget({ workspaceId, currentTitle });
                                setRenameDraft(currentTitle);
                                setRenameError(null);
                            }, onDeleteRequest: (workspaceId, title) => {
                                setDeleteTarget({ workspaceId, title });
                                setDeleteError(null);
                            } }))) }), _jsxs(Modal, { open: renameTarget !== null, onClose: closeRename, closeLabel: t('close'), title: t('rename.workspace.title'), footer: (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: renaming, onClick: closeRename, children: t('cancel') }), _jsx(Button, { variant: "primary", disabled: renameBlocked, onClick: confirmRename, children: t('rename') })] })), children: [_jsx("input", { className: css.renameInput, value: renameDraft, "aria-label": t('field.workspaceName'), autoFocus: true, disabled: renaming, onFocus: (e) => { e.target.select(); }, onChange: (e) => { setRenameDraft(e.target.value); setRenameError(null); }, onCompositionStart: () => { composingRef.current = true; }, onCompositionEnd: () => { composingRef.current = false; }, onKeyDown: (e) => {
                            if (e.key === 'Enter' && !composingRef.current) {
                                e.preventDefault();
                                confirmRename();
                            }
                        } }), renameDuplicate && (_jsx("div", { className: css.renameError, role: "alert", children: t('conflict.named', { name: renameTrimmed }) })), renameError !== null && _jsx("div", { className: css.renameError, role: "alert", children: renameError })] }), _jsxs(Modal, { open: deleteTarget !== null, onClose: closeDelete, closeLabel: t('close'), title: t('delete.workspace'), ...deleteTarget === null
                    ? {}
                    : { description: t('delete.desc', { name: deleteTarget.title }) }, footer: (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: deleting, onClick: closeDelete, children: t('cancel') }), _jsx(Button, { variant: "outline", className: css.deleteAction, disabled: deleting, onClick: confirmDelete, children: t('delete.workspace') })] })), children: [deleting && _jsx("div", { className: css.deleteStatus, role: "status", children: t('delete.pending') }), deleteError !== null && _jsx("div", { className: css.renameError, role: "alert", children: deleteError })] })] }));
}
