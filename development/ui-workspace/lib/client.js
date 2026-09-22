window.__ModuleLoader__.load({ id: "dsh-nexttavern-ui-workspace", factory: function (require) { var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key5 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key5) && key5 !== except)
        __defProp(to, key5, { get: () => from[key5], enumerable: !(desc = __getOwnPropDesc(from, key5)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_dsh_client_store3 = require("@deepseek-ai/dsh-client-store");

// contract/slots.ts
var menuOpenStateFactory = (_standard, state) => () => state;

// navigation.ts
var import_cordis = require("@deepseek-ai/cordis");
var import_dsh_client_store2 = require("@deepseek-ai/dsh-client-store");

// locales.ts
var zh = {
  "defaultWorkspace.failed": "\u65E0\u6CD5\u521B\u5EFA\u9ED8\u8BA4\u5DE5\u4F5C\u533A\uFF0C\u8BF7\u901A\u8FC7\u201C\u9009\u62E9\u5DE5\u4F5C\u533A\u201D\u9009\u62E9\u6587\u4EF6\u5939",
  "defaultWorkspace.title": "\u9ED8\u8BA4\u5DE5\u4F5C\u533A",
  "group.ungrouped": "\u672A\u5206\u7EC4",
  "session.new": "\u65B0\u4F1A\u8BDD",
  "section.workspaces": "\u5DE5\u4F5C\u533A",
  "section.sessions": "\u4F1A\u8BDD",
  "viewOptions.label": "\u89C6\u56FE\u9009\u9879",
  "groupBy.label": "\u5206\u7EC4\u65B9\u5F0F",
  "groupBy.workspace": "\u6309\u5DE5\u4F5C\u533A",
  "groupBy.workspaceTree": "\u6309\u5DE5\u4F5C\u533A\u6811",
  "groupBy.flat": "\u5355\u5217\u8868",
  "orderBy.label": "\u6392\u5E8F\u65B9\u5F0F",
  "orderBy.manual": "\u624B\u52A8\u6392\u5E8F",
  "orderBy.updated": "\u6700\u8FD1\u66F4\u65B0",
  "filterBy.label": "\u7B5B\u9009\u4F1A\u8BDD",
  "viewOptions.showArchived": "\u663E\u793A\u5DF2\u5F52\u6863",
  "viewOptions.onlyArchived": "\u4EC5\u663E\u793A\u5DF2\u5F52\u6863",
  "sessions.expand": "\u5C55\u5F00\u5176\u4F59 {n} \u4E2A\u4F1A\u8BDD",
  "sessions.collapse": "\u6536\u8D77",
  "empty.none": "\u6682\u65E0\u4F1A\u8BDD",
  "empty.noMatches": "\u65E0\u5339\u914D\u7ED3\u679C",
  "workspace.add": "\u6DFB\u52A0\u5DE5\u4F5C\u533A",
  "search.sessions.aria": "\u641C\u7D22\u4F1A\u8BDD",
  "search.placeholder": "\u641C\u7D22\u4F1A\u8BDD\u540D\u79F0",
  "search.clear": "\u6E05\u9664\u641C\u7D22",
  "search.results.aria": "\u641C\u7D22\u7ED3\u679C",
  "search.pending": "\u6B63\u5728\u641C\u7D22\u4F1A\u8BDD\u5386\u53F2\u2026",
  "search.noMatches": "\u65E0\u5339\u914D\u4F1A\u8BDD",
  "search.hasMore": "\u4EC5\u663E\u793A\u524D {n} \u6761\u7ED3\u679C\uFF0C\u8BF7\u7F29\u5C0F\u641C\u7D22\u8303\u56F4\u3002",
  "menu.addWorkspace": "\u6DFB\u52A0\u5DE5\u4F5C\u533A\u2026",
  "picker.loading": "\u6B63\u5728\u52A0\u8F7D\u5DE5\u4F5C\u533A\u2026",
  "conflict.named": "\u5DF2\u5B58\u5728\u540D\u4E3A\u201C{name}\u201D\u7684\u5DE5\u4F5C\u533A\u3002",
  "folderError.title": "\u65E0\u6CD5\u6253\u5F00\u6587\u4EF6\u5939",
  "folderError.retry": "\u91CD\u65B0\u9009\u62E9",
  "rename": "\u91CD\u547D\u540D",
  "rename.workspace.title": "\u91CD\u547D\u540D\u5DE5\u4F5C\u533A",
  "rename.session.title": "\u91CD\u547D\u540D\u4F1A\u8BDD",
  "field.workspaceName": "\u5DE5\u4F5C\u533A\u540D\u79F0",
  "field.sessionName": "\u4F1A\u8BDD\u540D\u79F0",
  "delete.workspace": "\u5220\u9664\u5DE5\u4F5C\u533A",
  "delete.desc": "\u5C06\u628A\u201C{name}\u201D\u4ECE\u5DE5\u4F5C\u533A\u5217\u8868\u4E2D\u79FB\u9664\u3002\u6587\u4EF6\u5939\u4E0E\u4F1A\u8BDD\u8BB0\u5F55\u4F1A\u4FDD\u7559\uFF0C\u5176\u4F1A\u8BDD\u5C06\u663E\u793A\u5728\u201C\u672A\u5206\u7EC4\u201D\u4E0B\u3002",
  "delete.pending": "\u6B63\u5728\u5220\u9664\u5DE5\u4F5C\u533A\u2026",
  "menu.fork": "\u5206\u53C9\u4F1A\u8BDD",
  "menu.archiveSession": "\u5F52\u6863\u4F1A\u8BDD",
  "menu.unarchiveSession": "\u53D6\u6D88\u5F52\u6863",
  "menu.pinSession": "\u7F6E\u9876\u4F1A\u8BDD",
  "menu.unpinSession": "\u53D6\u6D88\u7F6E\u9876",
  "row.archived": "\u5DF2\u5F52\u6863",
  "row.pinned": "\u5DF2\u7F6E\u9876",
  "toast.archivedNotOpenable": "\u5DF2\u5F52\u6863\u5BF9\u8BDD\u6682\u65F6\u65E0\u6CD5\u67E5\u770B\uFF0C\u8BF7\u53D6\u6D88\u5F52\u6863\u540E\u67E5\u770B",
  "toast.archived": "\u4F1A\u8BDD\u5DF2\u5F52\u6863\uFF0C\u53EF",
  "toast.stoppedAndArchived": "\u5DF2\u505C\u6B62\u5E76\u5F52\u6863\uFF0C\u53EF",
  "archive.confirm.title": "\u505C\u6B62\u5E76\u5F52\u6863\u6B64\u4F1A\u8BDD\uFF1F",
  "archive.confirm.desc": "\u201C{title}\u201D\u4ECD\u6709\u6B63\u5728\u8FDB\u884C\u7684\u5DE5\u4F5C\u3002\u5F52\u6863\u4F1A\u5148\u505C\u6B62\u8FD9\u4E9B\u5DE5\u4F5C\uFF1B\u4E4B\u540E\u53EF\u5728\u4FA7\u680F\u201C\u663E\u793A\u5DF2\u5F52\u6863\u201D\u4E2D\u6062\u590D\u4F1A\u8BDD\uFF0C\u88AB\u505C\u6B62\u7684\u5DE5\u4F5C\u4E0D\u4F1A\u81EA\u52A8\u7EE7\u7EED\u3002",
  "archive.confirm.activity": "\u5C06\u88AB\u505C\u6B62\u7684\u5DE5\u4F5C",
  "archive.confirm.turn": "\u8FDB\u884C\u4E2D\u7684\u56DE\u5408",
  "archive.confirm.subagents.one": "{n} \u4E2A\u8FD0\u884C\u4E2D\u7684\u5B50\u4EE3\u7406\uFF1A{names}",
  "archive.confirm.subagents.other": "{n} \u4E2A\u8FD0\u884C\u4E2D\u7684\u5B50\u4EE3\u7406\uFF1A{names}",
  "archive.confirm.jobs.one": "{n} \u4E2A\u540E\u53F0\u4EFB\u52A1\uFF1A{names}",
  "archive.confirm.jobs.other": "{n} \u4E2A\u540E\u53F0\u4EFB\u52A1\uFF1A{names}",
  "archive.confirm.schedules.one": "{n} \u6761\u5B9A\u65F6\u63D0\u9192\uFF1A{names}",
  "archive.confirm.schedules.other": "{n} \u6761\u5B9A\u65F6\u63D0\u9192\uFF1A{names}",
  "archive.confirm.other.one": "{n} \u9879\u5176\u4ED6\u5DE5\u4F5C\uFF08{kind}\uFF09",
  "archive.confirm.other.other": "{n} \u9879\u5176\u4ED6\u5DE5\u4F5C\uFF08{kind}\uFF09",
  "archive.confirm.listSeparator": "\u3001",
  "archive.confirm.action": "\u505C\u6B62\u5E76\u5F52\u6863",
  "archive.confirm.pending": "\u6B63\u5728\u505C\u6B62\u5E76\u5F52\u6863\u2026",
  "toast.archivedUndo": "\u64A4\u9500",
  "toast.archivedOr": "\u6216",
  "toast.archivedFilter": "\u7B5B\u9009\u5DF2\u5F52\u6863\u4F1A\u8BDD",
  "toast.pinFailed": "\u7F6E\u9876\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
  "toast.unpinFailed": "\u53D6\u6D88\u7F6E\u9876\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
  "toast.createFailed": "\u65B0\u5EFA\u4F1A\u8BDD\u5931\u8D25\uFF1A{message}",
  "sessions.count.one": "{n} \u4E2A\u4F1A\u8BDD",
  "sessions.count.other": "{n} \u4E2A\u4F1A\u8BDD",
  "actions.workspace.aria": "\u5DE5\u4F5C\u533A\u201C{name}\u201D\u7684\u64CD\u4F5C",
  "actions.session.aria": "\u4F1A\u8BDD\u201C{name}\u201D\u7684\u64CD\u4F5C",
  "actions.archive": "\u5F52\u6863\u4F1A\u8BDD",
  "actions.unarchive": "\u53D6\u6D88\u5F52\u6863",
  "actions.pin": "\u7F6E\u9876\u4F1A\u8BDD",
  "actions.unpin": "\u53D6\u6D88\u7F6E\u9876",
  "actions.newSession": "\u65B0\u4F1A\u8BDD",
  "actions.newSession.aria": "\u5728\u201C{name}\u201D\u4E2D\u65B0\u5EFA\u4F1A\u8BDD",
  "status.running": "\u8FDB\u884C\u4E2D",
  "status.subagentsRunning.one": "{n} \u4E2A\u5B50\u4EE3\u7406\u8FD0\u884C\u4E2D",
  "status.subagentsRunning.other": "{n} \u4E2A\u5B50\u4EE3\u7406\u8FD0\u884C\u4E2D",
  "status.idle": "\u7A7A\u95F2",
  "status.waitingApproval": "\u7B49\u5F85\u5BA1\u6279",
  "status.planReview": "\u8BA1\u5212\u5F85\u5BA1",
  "status.waitingAnswer": "\u7B49\u5F85\u56DE\u7B54",
  "status.compact.approval": "\u5F85\u5BA1\u6279",
  "status.compact.planReview": "\u8BA1\u5212\u5F85\u5BA1",
  "status.compact.answer": "\u5F85\u56DE\u7B54",
  "status.completed": "\u5DF2\u5B8C\u6210",
  "schedule.active": "\u6709\u6D3B\u52A8\u5B9A\u65F6\u4EFB\u52A1",
  "hover.created": "\u521B\u5EFA\u4E8E {time}",
  "hover.copied": "\u5DF2\u590D\u5236",
  "date.ymd": "{y}\u5E74{m}\u6708{d}\u65E5",
  "time.now": "\u521A\u521A",
  "time.minutes": "{n}\u5206\u949F",
  "time.hours": "{n}\u5C0F\u65F6",
  "time.days": "{n}\u5929",
  "time.months": "{n}\u4E2A\u6708",
  "time.years": "{n}\u5E74",
  "time.ago": "{t}\u524D"
};
var en = {
  "defaultWorkspace.failed": "Unable to create default workspace. Use Choose workspace to select a folder.",
  "defaultWorkspace.title": "Default workspace",
  "group.ungrouped": "Ungrouped",
  "session.new": "New Session",
  "section.workspaces": "Workspaces",
  "section.sessions": "Sessions",
  "viewOptions.label": "View options",
  "groupBy.label": "Group by",
  "groupBy.workspace": "WorkSpace",
  "groupBy.workspaceTree": "Workspace Tree",
  "groupBy.flat": "In one list",
  "orderBy.label": "Order by",
  "orderBy.manual": "Manual",
  "orderBy.updated": "Last updated",
  "filterBy.label": "Filter sessions",
  "viewOptions.showArchived": "Show archived",
  "viewOptions.onlyArchived": "Archived only",
  "sessions.expand": "Show {n} more sessions",
  "sessions.collapse": "Show less",
  "empty.none": "No sessions yet",
  "empty.noMatches": "No matches",
  "workspace.add": "Add workspace",
  "search.sessions.aria": "Search sessions",
  "search.placeholder": "Search session names",
  "search.clear": "Clear search",
  "search.results.aria": "Search results",
  "search.pending": "Searching session history\u2026",
  "search.noMatches": "No matching sessions",
  "search.hasMore": "Showing the first {n} results. Narrow your search.",
  "menu.addWorkspace": "Add workspace\u2026",
  "picker.loading": "Loading workspaces\u2026",
  "conflict.named": "A workspace named \u201C{name}\u201D already exists.",
  "folderError.title": "Couldn\u2019t open folder",
  "folderError.retry": "Choose again",
  "rename": "Rename",
  "rename.workspace.title": "Rename workspace",
  "rename.session.title": "Rename session",
  "field.workspaceName": "Workspace name",
  "field.sessionName": "Session name",
  "delete.workspace": "Delete workspace",
  "delete.desc": "This removes \u201C{name}\u201D from the workspace list. The folder and session logs will be kept. Its sessions will appear under Ungrouped.",
  "delete.pending": "Deleting workspace\u2026",
  "menu.fork": "Fork session",
  "menu.archiveSession": "Archive session",
  "menu.unarchiveSession": "Unarchive session",
  "menu.pinSession": "Pin session",
  "menu.unpinSession": "Unpin session",
  "row.archived": "Archived",
  "row.pinned": "Pinned",
  "toast.archivedNotOpenable": "Archived sessions cannot be opened. Unarchive it to view.",
  "toast.archived": "Session archived. You can ",
  "toast.stoppedAndArchived": "Session stopped and archived. You can ",
  "archive.confirm.title": "Stop and archive this session?",
  "archive.confirm.desc": "\u201C{title}\u201D still has work in progress. Archiving stops it first; you can restore the session later from \u201CShow archived\u201D in the sidebar, and the stopped work will not resume on its own.",
  "archive.confirm.activity": "Work that will be stopped",
  "archive.confirm.turn": "The turn in progress",
  "archive.confirm.subagents.one": "{n} running subagent: {names}",
  "archive.confirm.subagents.other": "{n} running subagents: {names}",
  "archive.confirm.jobs.one": "{n} background job: {names}",
  "archive.confirm.jobs.other": "{n} background jobs: {names}",
  "archive.confirm.schedules.one": "{n} scheduled reminder: {names}",
  "archive.confirm.schedules.other": "{n} scheduled reminders: {names}",
  "archive.confirm.other.one": "{n} other item of work ({kind})",
  "archive.confirm.other.other": "{n} other items of work ({kind})",
  "archive.confirm.listSeparator": ", ",
  "archive.confirm.action": "Stop and archive",
  "archive.confirm.pending": "Stopping and archiving\u2026",
  "toast.archivedUndo": "undo",
  "toast.archivedOr": " or ",
  "toast.archivedFilter": "filter archived sessions",
  "toast.pinFailed": "Pin failed. Try again later.",
  "toast.unpinFailed": "Unpin failed. Try again later.",
  "toast.createFailed": "New session failed: {message}",
  "sessions.count.one": "{n} session",
  "sessions.count.other": "{n} sessions",
  "actions.workspace.aria": "Workspace actions for {name}",
  "actions.session.aria": "Session actions for {name}",
  "actions.archive": "Archive",
  "actions.unarchive": "Unarchive",
  "actions.pin": "Pin",
  "actions.unpin": "Unpin",
  "actions.newSession": "New session",
  "actions.newSession.aria": "New session in {name}",
  "status.running": "Running",
  "status.subagentsRunning.one": "{n} subagent running",
  "status.subagentsRunning.other": "{n} subagents running",
  "status.idle": "Idle",
  "status.waitingApproval": "Waiting for approval",
  "status.planReview": "Plan awaiting review",
  "status.waitingAnswer": "Waiting for answer",
  "status.compact.approval": "Approval",
  "status.compact.planReview": "Plan review",
  "status.compact.answer": "Answer",
  "status.completed": "Completed",
  "schedule.active": "Has active scheduled task",
  "hover.created": "Created {time}",
  "hover.copied": "Copied",
  "date.ymd": "{y}-{m}-{d}",
  "time.now": "now",
  "time.minutes": "{n}min",
  "time.hours": "{n}h",
  "time.days": "{n}d",
  "time.months": "{n}mo",
  "time.years": "{n}y",
  "time.ago": "{t} ago"
};

// stores.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-util-values/lib/index.js
function assertNever(value, context) {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-util-workspace-path/lib/index.js
function isWindowsStylePath(value) {
  return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
}
function abbreviateHomePath(path, home) {
  if (home === void 0 || home === "") return path;
  if (isWindowsStylePath(path) || isWindowsStylePath(home)) return path;
  const root = home.replace(/\/+$/, "");
  if (root === "" || root === "/") return path;
  if (path.replace(/\/+$/, "") === root) return "~";
  if (path.startsWith(`${root}/`)) return `~${path.slice(root.length)}`;
  return path;
}
function workspaceTitleOf(path) {
  const trimmed = path.replace(/[/\\]+$/, "");
  const separator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return trimmed.slice(separator + 1);
}

// tree.ts
var UNGROUPED_KEY = "";
function owningGroupKey(workspaces, sessionId) {
  return workspaces.find((workspace) => workspace.sessionIds.includes(sessionId))?.workspaceId ?? UNGROUPED_KEY;
}
function mainSessionId(list) {
  return Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
}
function workspaceLabel(cwd) {
  if (cwd === void 0 || cwd === "") return "";
  const base = workspaceTitleOf(cwd);
  return base !== "" ? base : cwd;
}
function orderByRecency(sessionIds, summaries) {
  return sessionIds.flatMap((id) => {
    const summary = summaries[id];
    if (summary === void 0) return [];
    return [{ id, rank: summary.updatedAt }];
  }).sort((a, b) => {
    if (a.rank !== b.rank) return b.rank - a.rank;
    return a.id < b.id ? -1 : 1;
  }).map((member) => member.id);
}
function reconcileManualOrder(memberIds, savedOrder, summaries, rowState) {
  const members = new Map(memberIds.map((id) => [id, id]));
  const included = /* @__PURE__ */ new Set();
  const ordered = [];
  for (const key5 of savedOrder ?? []) {
    const id = members.get(key5);
    if (id === void 0 || included.has(key5)) continue;
    ordered.push(id);
    included.add(key5);
  }
  const archived = new Set(rowState?.archivedSessionIds);
  const pins = [];
  for (const sessionId of rowState?.pinnedSessionIds ?? []) {
    const id = members.get(sessionId);
    if (id === void 0 || included.has(id) || archived.has(id) || summaries[id] === void 0) continue;
    pins.push(id);
    included.add(id);
  }
  const ordinary = [];
  const archives = [];
  for (const id of orderByRecency([...members.values()].filter((id2) => !included.has(id2)), summaries)) {
    if (archived.has(id)) archives.push(id);
    else ordinary.push(id);
  }
  const result = [...pins, ...ordered, ...ordinary, ...archives];
  const pending = new Set(ordinary);
  const placeFork = (id) => {
    if (!pending.delete(id)) return;
    const parentId = summaries[id]?.parentId;
    if (parentId === void 0 || parentId === id || !result.includes(parentId)) return;
    placeFork(parentId);
    result.splice(result.indexOf(id), 1);
    result.splice(result.indexOf(parentId), 0, id);
  };
  for (const id of [...ordinary].reverse()) placeFork(id);
  return result;
}
function pinCurrentBlank(order, currentBlank) {
  if (currentBlank === void 0) return [...order];
  return [currentBlank, ...order.filter((id) => id !== currentBlank)];
}
function sessionVisible(session, current, archived, archivedFilter) {
  if (session.origin === "subagent") return false;
  if (session.blank && session.id !== current) return false;
  switch (archivedFilter) {
    case "default":
      return !archived.has(session.id);
    case "show":
      return true;
    case "only":
      return archived.has(session.id);
    /* v8 ignore next 2 -- closed-union backstop; only reached if the filter is forged */
    default:
      return assertNever(archivedFilter);
  }
}
function sectionMembers(members, pinned, archived) {
  const placeholders = [];
  const leading = [];
  const rest = [];
  for (const member of members) {
    if (member.blank) placeholders.push(member);
    else if (!archived.has(member.id) && pinned.has(member.id)) leading.push(member);
    else rest.push(member);
  }
  return [...placeholders, ...leading, ...rest];
}
function sessionTitle(session) {
  return session.blank ? "" : session.displayTitle;
}
function hasActiveSchedule(session) {
  return (session.projectionValues?.schedule?.length ?? 0) > 0;
}
function buildGroup(key5, workspaceId, cwd, createdAt, label, members) {
  return { key: key5, workspaceId, cwd, createdAt, label, sessions: [...members] };
}
function orderedUngrouped(members, stored, summaries) {
  const byId = new Map(members.map((session) => [session.id, session]));
  const ids = stored === void 0 ? orderByRecency(members.map((session) => session.id), summaries) : reconcileManualOrder(members.map((session) => session.id), stored, summaries);
  return ids.flatMap((id) => {
    const session = byId.get(id);
    return session === void 0 ? [] : [session];
  });
}
function groupByWorkspace(list, workspaces, archived, archivedFilter, ungroupedOrder) {
  const current = mainSessionId(list);
  const groups = [];
  const accounted = /* @__PURE__ */ new Set();
  for (const workspace of workspaces) {
    const members = [];
    for (const id of workspace.sessionIds) {
      const summary = list.byId[id];
      if (summary === void 0) continue;
      accounted.add(id);
      if (!sessionVisible(summary, current, archived, archivedFilter)) continue;
      members.push(summary);
    }
    groups.push(buildGroup(
      workspace.workspaceId,
      workspace.workspaceId,
      workspace.path,
      Date.parse(workspace.createdAt),
      workspace.title,
      members
    ));
  }
  const stray = list.ids.map((id) => list.byId[id]).filter((s) => s !== void 0 && !accounted.has(s.id) && sessionVisible(s, current, archived, archivedFilter));
  if (stray.length > 0) {
    groups.push(buildGroup(
      UNGROUPED_KEY,
      void 0,
      void 0,
      void 0,
      "",
      orderedUngrouped(stray, ungroupedOrder, list.byId)
    ));
  }
  return groups;
}
function visiblePendingKind(kind) {
  switch (kind) {
    case "approval":
    case "plan-review":
    case "question":
      return kind;
    default:
      return void 0;
  }
}
function runningChildCount(list, parentId, statuses) {
  return list.projectionsBySession[parentId]?.values.subagentCatalog?.reduce(
    (count, child) => count + ((statuses.get(child.id)?.running ?? list.byId[child.id]?.running) === true ? 1 : 0),
    0
  ) ?? 0;
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
    hasActiveSchedule: hasActiveSchedule(s),
    pinned: !archived.has(s.id) && pinned.has(s.id),
    archived: archived.has(s.id),
    updatedAt: s.updatedAt,
    ...pendingInteraction === void 0 ? {} : { pendingInteraction }
  };
}
function deriveGroups(list, workspaces, rowState, statuses, view) {
  const archived = new Set(rowState.archivedSessionIds);
  const pinned = new Set(rowState.pinnedSessionIds);
  const expandedGroups = new Set(view.expandedGroups);
  const current = mainSessionId(list);
  const currentGroup = current === void 0 ? void 0 : owningGroupKey(workspaces, current);
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
      sessions: expanded ? sectionMembers(g.sessions, pinned, archived).map((session) => sessionNode(session, list, statuses, pinned, archived)) : []
    });
  }
  return groups;
}
function sessionMemberIds(list) {
  return visibleSessionIds(list, [], "show");
}
function visibleSessionIds(list, archivedSessionIds, archivedFilter) {
  const archived = new Set(archivedSessionIds);
  const current = mainSessionId(list);
  return list.ids.filter((id) => {
    const s = list.byId[id];
    return s !== void 0 && sessionVisible(s, current, archived, archivedFilter);
  });
}
function deriveFlat(list, sessionIds, rowState, statuses) {
  const archived = new Set(rowState.archivedSessionIds);
  const pinned = new Set(rowState.pinnedSessionIds);
  const current = mainSessionId(list);
  const members = sessionIds.flatMap((id) => {
    const session = list.byId[id];
    return session !== void 0 && sessionVisible(session, current, archived, rowState.archivedFilter) ? [session] : [];
  });
  return sectionMembers(members, pinned, archived).map((session) => sessionNode(session, list, statuses, pinned, archived));
}
function deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, content, limit) {
  const q = query.trim().toLowerCase();
  if (q === "") return { items: [], hasMore: false };
  const archived = new Set(archivedSessionIds);
  const current = mainSessionId(list);
  const workspaceBySession = /* @__PURE__ */ new Map();
  for (const workspace of workspaces) {
    for (const sessionId of workspace.sessionIds) {
      if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace.title);
    }
  }
  const labelOf = (summary) => workspaceBySession.get(summary.id) ?? workspaceLabel(summary.cwd);
  const contentBySession = /* @__PURE__ */ new Map();
  for (const item of content.items) {
    if (!contentBySession.has(item.sessionId)) contentBySession.set(item.sessionId, item);
  }
  const local = [];
  for (const id of list.ids) {
    const summary = list.byId[id];
    if (summary === void 0 || summary.blank || !sessionVisible(summary, current, archived, archivedFilter)) continue;
    if (sessionTitle(summary).toLowerCase().includes(q) || labelOf(summary).toLowerCase().includes(q)) {
      local.push(summary);
    }
  }
  const localById = new Map(local.map((summary) => [summary.id, summary]));
  const orderedLocal = orderByRecency(local.map((summary) => summary.id), list.byId).map((id) => localById.get(id));
  const ordered = [];
  const included = /* @__PURE__ */ new Set();
  const include = (summary) => {
    if (included.has(summary.id)) return;
    included.add(summary.id);
    ordered.push(summary);
  };
  for (const summary of orderedLocal) include(summary);
  for (const item of content.items) {
    const summary = list.byId[item.sessionId];
    if (summary !== void 0 && !summary.blank && sessionVisible(summary, current, archived, archivedFilter)) include(summary);
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
        ...pendingInteraction === void 0 ? {} : { pendingInteraction },
        completed: status?.completionUnread === true,
        hasActiveSchedule: hasActiveSchedule(summary),
        archived: archived.has(summary.id),
        ...match === void 0 ? {} : { snippet: match.snippet }
      };
    }),
    hasMore: content.hasMore || ordered.length > limit
  };
}
function folderPath(path) {
  const windows = /^[A-Za-z]:[/\\]/.test(path) || path.startsWith("\\\\");
  return (windows ? path.replaceAll("\\", "/") : path).replace(/\/+$/, "");
}
function owningParentFolder(path, parents) {
  const child = folderPath(path);
  let owner5;
  let length = -1;
  for (const parent of parents) {
    const root = folderPath(parent);
    if (root.length > length && child !== root && child.startsWith(`${root}/`)) {
      owner5 = parent;
      length = root.length;
    }
  }
  return owner5;
}

// stores.ts
var FLAT_SESSION_ORDER_KEY = "__flat_session_order__";
function copySessionOrders(orders) {
  return Object.fromEntries(Object.entries(orders).map(([key5, order]) => [key5, [...order]]));
}
function createWorkspaceViewStore() {
  return (0, import_dsh_client_store.defineStore)({
    init: () => ({
      groupBy: "workspace",
      orderBy: "updated",
      groupExpansion: {},
      sessionOrderByAccount: {},
      archivedFilter: "default"
    }),
    persist: "dsh.workspace.view.v5",
    actions: {
      setGroupBy: (d, mode) => {
        d.groupBy = mode;
      },
      setOrderBy: (d, mode, initialOrders) => {
        if (mode === d.orderBy) return;
        d.sessionOrderByAccount = mode === "manual" ? copySessionOrders(initialOrders) : {};
        d.orderBy = mode;
      },
      setGroupExpanded: (d, key5, expanded) => {
        d.groupExpansion[key5] = expanded;
      },
      retainAccountKeys: (d, workspaceKeys) => {
        const retained = new Set(workspaceKeys);
        d.groupExpansion = Object.fromEntries(
          Object.entries(d.groupExpansion).filter(([key5]) => retained.has(key5))
        );
        d.sessionOrderByAccount = Object.fromEntries(
          Object.entries(d.sessionOrderByAccount).filter(([key5]) => retained.has(key5))
        );
        delete d.sessionUpdatedAtByAccount;
      },
      syncSessionOrders: (d, orders) => {
        if (d.orderBy !== "manual") return;
        Object.assign(d.sessionOrderByAccount, copySessionOrders(orders));
      },
      setSessionOrder: (d, accountKey, order, initialOrders) => {
        if (d.orderBy === "updated") d.sessionOrderByAccount = copySessionOrders(initialOrders);
        else Object.assign(d.sessionOrderByAccount, copySessionOrders(initialOrders));
        d.orderBy = "manual";
        d.sessionOrderByAccount[accountKey] = [...order];
      },
      pinSessionOrder: (d, sessionId, accountKeys, source) => {
        const selected = new Set(accountKeys);
        d.sessionOrderByAccount = Object.fromEntries(Object.entries(source.members).map(([key5, members]) => {
          const order = reconcileManualOrder(members, d.sessionOrderByAccount[key5], source.summaries, source.rowState);
          return [key5, selected.has(key5) ? [sessionId, ...order.filter((id) => id !== sessionId)] : order];
        }));
      },
      setArchivedFilter: (d, filter) => {
        d.archivedFilter = filter;
      }
    }
  });
}

// pin-order.ts
function pinOrderSource(workspaces, list, rowState) {
  const accounted = new Set(workspaces.flatMap((workspace) => workspace.sessionIds));
  return {
    members: Object.fromEntries([
      ...workspaces.map((workspace) => [workspace.workspaceId, workspace.sessionIds]),
      [UNGROUPED_KEY, list.ids.filter((id) => list.byId[id] !== void 0 && !accounted.has(id))],
      [FLAT_SESSION_ORDER_KEY, sessionMemberIds(list)]
    ]),
    summaries: list.byId,
    rowState
  };
}
function pinOrderAccounts(workspaces, sessionId) {
  return [owningGroupKey(workspaces, sessionId), FLAT_SESSION_ORDER_KEY];
}

// navigation.ts
var DirectoryBrowseError = class extends Error {
  /** @param rpcError - Host directory business failure. */
  constructor(rpcError) {
    super(`directory browse failed: ${rpcError.code}: ${rpcError.message}`);
    this.rpcError = rpcError;
  }
  name = "DirectoryBrowseError";
};
var UiWorkspaceService = class extends import_cordis.Service {
  /**
   * @param ctx - Client root Context.
   * @param directoryPicker - the directory-picking Remote namespace.
   * @param workspaces - pure Workspace Controller.
   * @param sessions - pure Session Controller.
   * @param view - the browser's viewing-store write set (one instance shared with its registration).
   * @param notify - show one notice through the Workspace notice channel.
   */
  constructor(ctx, directoryPicker, workspaces, sessions, view, notify) {
    super(ctx, "uiWorkspace");
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
        this.mainReference = void 0;
        reference?.release();
      };
    }, "ui-workspace: Workspace navigation policy");
  }
  connecting = /* @__PURE__ */ new Map();
  lifetime = new AbortController();
  selection = (0, import_dsh_client_store2.createSnapshotStore)(
    {},
    { persist: { name: "dsh.sessions.current" } }
  );
  mainReference;
  async connectWorkspace(workspaceId) {
    const workspace = this.workspaces.list.getSnapshot().items.find((item) => item.workspaceId === workspaceId);
    if (workspace === void 0) {
      throw new Error(`uiWorkspace.connectWorkspace: unknown workspace ${workspaceId}`);
    }
    const inflight = this.connecting.get(workspaceId);
    if (inflight !== void 0) return inflight;
    const attempt = this.reuseOrCreateBlank(workspace).finally(() => {
      this.connecting.delete(workspaceId);
    });
    this.connecting.set(workspaceId, attempt);
    return attempt;
  }
  reuseOrCreateBlank(workspace) {
    const archived = this.workspaces.list.getSnapshot().archivedSessionIds;
    const sessions = this.sessions.list.getSnapshot();
    for (const id of sessions.ids) {
      const summary = sessions.byId[id];
      if (summary === void 0 || !summary.blank || summary.cwd !== workspace.path || !workspace.sessionIds.includes(id) || archived.includes(id)) continue;
      return this.reuseBlank(workspace.workspaceId, id);
    }
    return this.sessions.create({ workspaceId: workspace.workspaceId });
  }
  async reuseBlank(workspaceId, sessionId) {
    try {
      return await this.sessions.create({ workspaceId, sessionId });
    } catch (error) {
      if (sessionCreateErrorOf(error)?.rpcError.code !== "session/writer-held") throw error;
      return this.sessions.create({ workspaceId });
    }
  }
  openSession(target) {
    this.replaceMain(target, this.lifetime.signal, "reveal");
  }
  async openWorkspace(workspaceId, beforeOpen) {
    const navigation = AbortSignal.any([this.ctx.layout.beginNavigation(), this.lifetime.signal]);
    let sessionId;
    try {
      sessionId = await this.connectWorkspace(workspaceId);
    } catch (error) {
      if (!navigation.aborted) this.notify({ kind: "createFailed", message: creationFailureMessage(error) });
      throw error;
    }
    if (navigation.aborted) return;
    this.replaceMain(sessionId, navigation, "reveal", beforeOpen);
  }
  async forkSession(sessionId) {
    await this.sessions.fork({ sessionId, increaseTitle: true });
  }
  startSession(workspaceId) {
    const workspace = this.workspaces.list.getSnapshot();
    const sessions = this.sessions.list.getSnapshot();
    const current = this.mainReference?.sessionId;
    const currentWorkspaceId = current === void 0 ? void 0 : workspace.items.find((item) => item.sessionIds.includes(current))?.workspaceId;
    const recent = workspace.phase === "ready" && sessions.phase === "ready" ? recentWorkspace(workspace.items, sessions.byId) : void 0;
    const target = workspaceId ?? currentWorkspaceId ?? recent;
    if (target === void 0) {
      this.clearMain();
      return;
    }
    void this.openWorkspace(target).catch(
      (reason) => {
        console.warn("new session failed:", reason);
      }
    );
  }
  async archiveSession(sessionId, options = {}) {
    await this.workspaces.archiveSession(sessionId, options);
    if (this.mainReference?.sessionId === sessionId) this.clearMain();
  }
  async unarchiveSession(sessionId) {
    await this.workspaces.unarchiveSession(sessionId);
  }
  async pinSession(sessionId) {
    await this.workspaces.pinSession(sessionId);
    const { items, pinnedSessionIds, archivedSessionIds } = this.workspaces.list.getSnapshot();
    this.view.pinSessionOrder(
      sessionId,
      pinOrderAccounts(items, sessionId),
      pinOrderSource(items, this.sessions.list.getSnapshot(), { pinnedSessionIds, archivedSessionIds })
    );
  }
  async unpinSession(sessionId) {
    await this.workspaces.unpinSession(sessionId);
  }
  async pickDirectory() {
    const result = await this.directoryPicker.pick();
    if (!result.ok) throw new Error(`directory picker failed: ${result.error.message}`);
    return result.value;
  }
  async listDirectory(path, signal) {
    const result = await this.directoryPicker.list(path, signal);
    if (!result.ok) throw new DirectoryBrowseError(result.error);
    return result.value;
  }
  async createDirectory(path, name) {
    const result = await this.directoryPicker.createDirectory(path, name);
    if (!result.ok) throw new DirectoryBrowseError(result.error);
    return result.value;
  }
  watchNavigation() {
    let initial = "waiting";
    const reconcile = () => {
      if (this.lifetime.signal.aborted) return;
      if (this.clearArchivedCurrent()) return;
      if (initial !== "waiting") return;
      const workspace = this.workspaces.list.getSnapshot();
      const sessions = this.sessions.list.getSnapshot();
      if (workspace.phase !== "ready" || sessions.phase !== "ready") return;
      if (this.mainReference !== void 0) {
        initial = "done";
        return;
      }
      initial = "connecting";
      void this.restoreSelection(workspace, sessions).then(
        () => {
          initial = "done";
        },
        (reason) => {
          if (this.lifetime.signal.aborted) return;
          initial = "waiting";
          console.warn("initial Session restoration failed:", reason);
        }
      );
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
    if (saved.subagentAddress !== void 0) {
      this.replaceMain(saved.subagentAddress, this.lifetime.signal, "preserve");
      return;
    }
    const summary = saved.sessionId === void 0 ? void 0 : sessions.byId[saved.sessionId];
    const workspace = summary === void 0 ? void 0 : workspaces.items.find((item) => item.sessionIds.includes(summary.id));
    if (summary !== void 0 && (!summary.blank || workspace === void 0)) {
      this.replaceMain(summary.id, this.lifetime.signal, "preserve");
      return;
    }
    const navigation = AbortSignal.any([this.ctx.layout.beginNavigation(), this.lifetime.signal]);
    let sessionId;
    if (summary !== void 0 && workspace !== void 0 && summary.cwd === workspace.path && !workspaces.archivedSessionIds.includes(summary.id)) {
      sessionId = await this.reuseBlank(workspace.workspaceId, summary.id);
    }
    let target = workspace?.workspaceId ?? recentWorkspace(workspaces.items, sessions.byId);
    if (target === void 0 && workspaces.items.length === 0 && sessions.ids.length === 0) {
      const prepared = await this.initializeDefaultWorkspace(navigation);
      if (navigation.aborted) return;
      target = prepared?.workspaceId;
    }
    if (sessionId === void 0 && target !== void 0) sessionId = await this.connectWorkspace(target);
    if (sessionId !== void 0 && !navigation.aborted) {
      this.replaceMain(sessionId, navigation, "preserve");
    }
  }
  async initializeDefaultWorkspace(signal) {
    const language = this.ctx.locale.getSnapshot().active.toLowerCase().split("-")[0];
    const title = (language === "zh" ? zh : en)["defaultWorkspace.title"];
    try {
      return await this.workspaces.initializeDefault({
        directoryName: language === "zh" || language === "en" ? title : "default-workspace",
        title
      }, signal);
    } catch (_error) {
      if (!signal.aborted) this.notify({ kind: "defaultWorkspaceFailed" });
      return void 0;
    }
  }
  /** @returns true when an archived current selection was cleared. */
  clearArchivedCurrent() {
    const current = this.mainReference?.sessionId;
    if (current === void 0 || !this.workspaces.list.getSnapshot().archivedSessionIds.includes(current)) return false;
    this.clearMain();
    return true;
  }
  clearMain() {
    const previous = this.mainReference;
    this.mainReference = void 0;
    this.selection.set({});
    previous?.release();
    this.ctx.layout.selectPanel(null);
  }
  replaceMain(target, signal, panel, beforeOpen) {
    signal.throwIfAborted();
    const reference = this.sessions.retain(target, { source: "mainView" });
    try {
      signal.throwIfAborted();
      beforeOpen?.(reference.sessionId);
      if (signal.aborted) {
        reference.release();
        return;
      }
      const subagentAddress = typeof target === "string" ? this.sessions.subagentAddress(reference.sessionId) : target;
      this.selection.set({
        sessionId: reference.sessionId,
        ...subagentAddress === void 0 ? {} : { subagentAddress }
      });
    } catch (error) {
      reference.release();
      throw error;
    }
    const previous = this.mainReference;
    this.mainReference = reference;
    previous?.release();
    if (panel === "reveal") this.ctx.layout.selectPanel(null);
  }
};
function sessionCreateErrorOf(error) {
  return error instanceof Error && error.name === "SessionCreateError" ? error : void 0;
}
function creationFailureMessage(error) {
  const refused = sessionCreateErrorOf(error);
  if (refused !== void 0) return `${refused.rpcError.code}: ${refused.rpcError.message}`;
  return error instanceof Error ? error.message : String(error);
}
function recentWorkspace(workspaces, sessions) {
  let selected;
  let selectedTime = Number.NEGATIVE_INFINITY;
  for (const workspace of workspaces) {
    let latest = Number.NEGATIVE_INFINITY;
    for (const sessionId of workspace.sessionIds) {
      const session = sessions[sessionId];
      if (session !== void 0) latest = Math.max(latest, session.updatedAt);
    }
    if (latest === Number.NEGATIVE_INFINITY) latest = Date.parse(workspace.createdAt);
    if (selected === void 0 || latest > selectedTime) {
      selected = workspace.workspaceId;
      selectedTime = latest;
    }
  }
  return selected;
}

// rows/WorkspaceBrowser.tsx
var import_react4 = require("react");

// ../../../../build-tools/node_modules/clsx/dist/clsx.mjs
function r(e) {
  var t, f, n = "";
  if ("string" == typeof e || "number" == typeof e) n += e;
  else if ("object" == typeof e) if (Array.isArray(e)) {
    var o = e.length;
    for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
  } else for (f in e) e[f] && (n && (n += " "), n += f);
  return n;
}
function clsx() {
  for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
  return n;
}
var clsx_default = clsx;

// rows/WorkspaceBrowser.tsx
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// rows/Rows.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// rows/Rows.module.css
var owner = "dsh-nexttavern-ui-workspace";
var key = "dsh-nexttavern-ui-workspace/runtime/alpha3/compat/ui-workspace/src/client/rows/Rows.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner;
  style.dataset.pluginCss = key;
  style.textContent = '._7IYKda_projectRow,._7IYKda_sessionRow{padding:0 8px;cursor:pointer;user-select:none;color:var(--dsw-alias-label-primary);border-radius:8px;align-items:center;gap:6px;padding-inline-start:calc(8px + var(--dsh-workspace-indent,0px));display:flex}._7IYKda_projectRow:hover,._7IYKda_sessionRow:hover,._7IYKda_sessionRow._7IYKda_selected{background:var(--dsw-alias-interactive-bg-hover)}._7IYKda_searchResultRow{box-sizing:border-box;cursor:pointer;text-align:left;width:100%;min-height:48px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:8px;flex-direction:column;align-items:stretch;padding:4px 8px;display:flex}._7IYKda_searchResultRow:hover,._7IYKda_searchResultRow._7IYKda_selected{background:var(--dsw-alias-interactive-bg-hover)}._7IYKda_searchResultHeading{align-items:center;min-width:0;display:flex}._7IYKda_searchResultTitle{text-overflow:ellipsis;white-space:nowrap;flex:0 auto;min-width:0;margin-left:4px;font-size:14px;line-height:20px;overflow:hidden}._7IYKda_searchResultMeta{align-items:center;gap:6px;min-width:0;margin-left:20px;display:flex}._7IYKda_searchResultWorkspace,._7IYKda_searchResultSnippet{text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:17px;overflow:hidden}._7IYKda_searchResultWorkspace{max-width:40%;color:var(--dsw-alias-label-tertiary);flex:none}._7IYKda_searchResultSnippet{min-width:0;color:var(--dsw-alias-label-secondary);flex:1}._7IYKda_projectRow{box-sizing:border-box;align-items:center;height:34px}._7IYKda_projectRow ._7IYKda_rowActions{height:20px}._7IYKda_sessionRow{gap:0;height:32px}._7IYKda_sessionRow ._7IYKda_title{margin:0 6px 0 4px}._7IYKda_flatSessionRowWithoutStatus ._7IYKda_title{margin-left:0}._7IYKda_slot{width:16px;height:20px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;display:inline-flex}._7IYKda_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}._7IYKda_folderActive{color:var(--dsw-alias-state-business-primary)}._7IYKda_projectRow ._7IYKda_chevron{display:none}._7IYKda_projectRow:hover ._7IYKda_chevron{display:inline-flex}._7IYKda_projectRow:hover ._7IYKda_folder{display:none}._7IYKda_arrow{transition:transform .15s var(--ds-ease-in-out)}._7IYKda_arrowOpen{transform:rotate(90deg)}._7IYKda_projectText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}._7IYKda_title{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;line-height:20px;overflow:hidden}._7IYKda_renameInput{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-button-elevated-fill);min-width:0;color:inherit;border-radius:4px;outline:none;padding:0 2px;font-size:14px;line-height:20px}._7IYKda_sessionRow ._7IYKda_title{flex:1}._7IYKda_sessionRow ._7IYKda_title[data-scrolled]{mask-image:linear-gradient(90deg,#0000,#000 12px)}._7IYKda_sessionRow ._7IYKda_title[data-clipped]{mask-image:linear-gradient(270deg,#0000,#000 12px)}._7IYKda_sessionRow ._7IYKda_title[data-scrolled][data-clipped]{mask-image:linear-gradient(90deg,#0000,#000 12px calc(100% - 12px),#0000)}._7IYKda_meta{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;overflow:hidden}._7IYKda_time{color:var(--dsw-alias-label-caption);flex:none;font-size:10px;line-height:16px}._7IYKda_scheduleIndicator{width:16px;height:20px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;margin-right:6px;display:inline-flex}._7IYKda_searchScheduleIndicator{margin-left:4px;margin-right:0}._7IYKda_pinIndicator{width:16px;height:20px;color:var(--dsw-alias-label-caption);flex:none;justify-content:center;align-items:center;margin-left:6px;display:inline-flex}._7IYKda_sessionRow._7IYKda_archived ._7IYKda_title,._7IYKda_sessionRow._7IYKda_archived ._7IYKda_time,._7IYKda_searchResultRow._7IYKda_archived ._7IYKda_searchResultTitle,._7IYKda_searchResultRow._7IYKda_archived ._7IYKda_searchResultWorkspace,._7IYKda_searchResultRow._7IYKda_archived ._7IYKda_searchResultSnippet{color:var(--dsw-alias-label-caption)}._7IYKda_dot{flex:none}._7IYKda_rowActions{flex:none;align-items:center;gap:10px;display:none}._7IYKda_projectRow:hover ._7IYKda_rowActions,._7IYKda_sessionRow:hover ._7IYKda_rowActions,._7IYKda_searchResultRow:hover ._7IYKda_rowActions,._7IYKda_projectRow._7IYKda_menuOpen ._7IYKda_rowActions,._7IYKda_sessionRow._7IYKda_menuOpen ._7IYKda_rowActions{display:inline-flex}._7IYKda_searchResultHeading ._7IYKda_rowActions{margin-left:auto}._7IYKda_sessionRow:hover ._7IYKda_time,._7IYKda_sessionRow._7IYKda_menuOpen ._7IYKda_time,._7IYKda_sessionRow:hover ._7IYKda_pinIndicator,._7IYKda_sessionRow._7IYKda_menuOpen ._7IYKda_pinIndicator{display:none}@media (hover:hover){._7IYKda_sessionRow:hover ._7IYKda_title,._7IYKda_sessionRow._7IYKda_menuOpen ._7IYKda_title{text-overflow:clip}}._7IYKda_projectRow._7IYKda_menuOpen,._7IYKda_sessionRow._7IYKda_menuOpen{background:var(--dsw-alias-interactive-bg-hover)}._7IYKda_sessionRow._7IYKda_dropBefore,._7IYKda_sessionRow._7IYKda_dropAfter{position:relative}._7IYKda_sessionRow._7IYKda_dropBefore:before,._7IYKda_sessionRow._7IYKda_dropAfter:after{content:"";z-index:1;background:linear-gradient(55deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat, linear-gradient(125deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat, linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute;left:0;right:4px}._7IYKda_sessionRow._7IYKda_dropBefore:before{top:-7px}._7IYKda_sessionRow._7IYKda_dropAfter:after{bottom:-7px}._7IYKda_hoverContent{flex-direction:column;gap:8px;display:flex}._7IYKda_hoverTitle{color:#fff;overflow-wrap:break-word;font-size:14px;line-height:20px}._7IYKda_hoverPath{color:#cfd3d6;word-break:break-all;font-size:12px;line-height:16px}._7IYKda_hoverTime{color:#cfd3d6;font-size:12px;line-height:16px}._7IYKda_hoverStatus{color:#adb2b8;align-items:center;gap:8px;font-size:12px;line-height:20px;display:flex}._7IYKda_hoverArchived svg{flex-shrink:0;margin:0 -4px}._7IYKda_iconButton{cursor:pointer;width:16px;height:16px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:4px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}._7IYKda_iconButton:hover{color:var(--dsw-alias-label-primary)}._7IYKda_chevron{color:var(--dsw-alias-label-caption)}@media (prefers-reduced-motion:reduce){._7IYKda_arrow{transition:none;animation:none}}';
  document.head.appendChild(style);
}
var Rows_default = { "archived": "_7IYKda_archived", "arrow": "_7IYKda_arrow", "arrowOpen": "_7IYKda_arrowOpen", "chevron": "_7IYKda_chevron", "dot": "_7IYKda_dot", "dropAfter": "_7IYKda_dropAfter", "dropBefore": "_7IYKda_dropBefore", "flatSessionRowWithoutStatus": "_7IYKda_flatSessionRowWithoutStatus", "folder": "_7IYKda_folder", "folderActive": "_7IYKda_folderActive", "hoverArchived": "_7IYKda_hoverArchived", "hoverContent": "_7IYKda_hoverContent", "hoverPath": "_7IYKda_hoverPath", "hoverStatus": "_7IYKda_hoverStatus", "hoverTime": "_7IYKda_hoverTime", "hoverTitle": "_7IYKda_hoverTitle", "iconButton": "_7IYKda_iconButton", "menuOpen": "_7IYKda_menuOpen", "meta": "_7IYKda_meta", "pinIndicator": "_7IYKda_pinIndicator", "projectRow": "_7IYKda_projectRow", "projectText": "_7IYKda_projectText", "renameInput": "_7IYKda_renameInput", "rowActions": "_7IYKda_rowActions", "scheduleIndicator": "_7IYKda_scheduleIndicator", "searchResultHeading": "_7IYKda_searchResultHeading", "searchResultMeta": "_7IYKda_searchResultMeta", "searchResultRow": "_7IYKda_searchResultRow", "searchResultSnippet": "_7IYKda_searchResultSnippet", "searchResultTitle": "_7IYKda_searchResultTitle", "searchResultWorkspace": "_7IYKda_searchResultWorkspace", "searchScheduleIndicator": "_7IYKda_searchScheduleIndicator", "selected": "_7IYKda_selected", "sessionRow": "_7IYKda_sessionRow", "slot": "_7IYKda_slot", "time": "_7IYKda_time", "title": "_7IYKda_title", "visuallyHidden": "_7IYKda_visuallyHidden" };

// rows/Rows.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function displayTitle(node, t) {
  return node.blank ? t("session.new") : node.title;
}
var MIN_TITLE_REVEAL_PX = 8;
var TITLE_MARQUEE_PX_PER_MS = 0.03;
function placeTitle(title, left, range) {
  if (typeof title.scrollTo === "function") title.scrollTo({ left, behavior: "instant" });
  else title.scrollLeft = left;
  if (left > 0) title.dataset.scrolled = "";
  else delete title.dataset.scrolled;
  if (left < range) title.dataset.clipped = "";
  else delete title.dataset.clipped;
}
function restTitle(title) {
  if (typeof title.scrollTo === "function") title.scrollTo({ left: 0, behavior: "instant" });
  else title.scrollLeft = 0;
  delete title.dataset.scrolled;
  delete title.dataset.clipped;
}
function useTitleMarquee(title) {
  const frame = (0, import_react.useRef)(0);
  (0, import_react.useEffect)(() => () => {
    cancelAnimationFrame(frame.current);
  }, []);
  return (0, import_react.useMemo)(() => ({
    enter: () => {
      if (title.current === null) return;
      const element = title.current;
      const range = element.scrollWidth - element.clientWidth;
      if (range <= MIN_TITLE_REVEAL_PX) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        placeTitle(element, range, range);
        return;
      }
      cancelAnimationFrame(frame.current);
      let previous;
      let position = 0;
      const step = (now) => {
        position += previous === void 0 ? 0 : (now - previous) * TITLE_MARQUEE_PX_PER_MS;
        previous = now;
        placeTitle(element, Math.min(position, range), range);
        if (position < range) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    leave: () => {
      cancelAnimationFrame(frame.current);
      if (title.current === null) return;
      restTitle(title.current);
    }
  }), [title]);
}
function timeLabel(updatedAt, now, t) {
  const { unit, n } = (0, import_dsh_client_ui_primitives.relativeTime)(updatedAt, now);
  return unit === "now" ? t("time.now") : t(`time.${unit}`, { n });
}
function hoverTimeLabel(updatedAt, now, t) {
  const { unit, n } = (0, import_dsh_client_ui_primitives.relativeTime)(updatedAt, now);
  return unit === "now" ? t("time.now") : t("time.ago", { t: t(`time.${unit}`, { n }) });
}
function createdLabel(createdAt, t) {
  const d = new Date(createdAt);
  const pad2 = (v) => String(v).padStart(2, "0");
  const date = t("date.ymd", { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
  return t("hover.created", { time: `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` });
}
function WorkspaceHoverContent({ label, cwd, createdAt, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Rows_default.hoverContent, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Rows_default.hoverTitle, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Rows_default.hoverPath, children: cwd }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Rows_default.hoverTime, children: createdLabel(createdAt, t) })
  ] });
}
function rowHalf(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}
function ProjectRowItem({ group, containsCurrentDescendant = false, onToggle, onCreate, actions, drag, home, t }) {
  const row = group;
  const label = row.workspaceId === void 0 ? t("group.ungrouped") : row.label;
  const active = containsCurrentDescendant || group.expanded && group.containsCurrent;
  const [menuOpen, setMenuOpen] = (0, import_react.useState)(false);
  const workspaceMenuItems = [
    { id: "rename", label: t("rename"), icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconEditOutlineRegular, {}) },
    { id: "delete", label: t("delete.workspace"), icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconTrashOutlineRegular, {}), danger: true }
  ];
  const ownRow = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: clsx_default(Rows_default.projectRow, menuOpen && Rows_default.menuOpen),
      "data-row-key": `workspace:${group.key}`,
      role: "treeitem",
      "aria-expanded": row.expanded,
      onClick: onToggle,
      draggable: drag !== void 0,
      onDragStart: drag === void 0 ? void 0 : (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", row.key);
        drag.start();
      },
      onDragEnd: drag?.end,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: clsx_default(Rows_default.slot, Rows_default.folder, active && Rows_default.folderActive), children: row.expanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconFolderOpenRegular, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconFolderCloseRegular, {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: clsx_default(Rows_default.slot, Rows_default.chevron), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconTriangleRightFillRegular, { className: clsx_default(Rows_default.arrow, row.expanded && Rows_default.arrowOpen) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Rows_default.projectText, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Rows_default.title, children: label }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Rows_default.rowActions, children: [
          actions !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Menu,
            {
              open: menuOpen,
              onClose: () => {
                setMenuOpen(false);
              },
              items: workspaceMenuItems,
              onSelect: (id) => {
                setMenuOpen(false);
                if (id !== "rename" && id !== "delete") return;
                if (id === "rename") actions.rename();
                else actions.delete();
              },
              portal: true,
              closeOnPointerLeave: true,
              anchor: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  type: "button",
                  className: Rows_default.iconButton,
                  "aria-label": t("actions.workspace.aria", { name: label }),
                  onClick: (e) => {
                    e.stopPropagation();
                    setMenuOpen((v) => !v);
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tooltip, { label: t("actions.newSession"), side: "bottom", align: "end", delayMs: 500, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: Rows_default.iconButton,
              "aria-label": t("actions.newSession.aria", { name: label }),
              onClick: (e) => {
                e.stopPropagation();
                onCreate();
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconNewChatOutlineRegular, {})
            }
          ) })
        ] })
      ]
    }
  );
  if (row.createdAt === void 0) return ownRow;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_dsh_client_ui_primitives.HoverCard,
    {
      anchor: ownRow,
      content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        WorkspaceHoverContent,
        {
          label: row.label,
          cwd: row.cwd === void 0 ? void 0 : abbreviateHomePath(row.cwd, home),
          createdAt: row.createdAt,
          t
        }
      ),
      openDelayMs: 800,
      disabled: menuOpen,
      copyText: row.cwd,
      copyLabel: t("copy"),
      copiedLabel: t("hover.copied")
    }
  );
}
function assertNever2(value) {
  throw new Error(`unknown pending interaction: ${String(value)}`);
}
function sessionStatuses(node, t) {
  const subagents = node.runningSubagentCount === 0 ? void 0 : {
    state: "ongoing",
    label: t(
      node.runningSubagentCount === 1 ? "status.subagentsRunning.one" : "status.subagentsRunning.other",
      { n: node.runningSubagentCount }
    )
  };
  let pending;
  switch (node.pendingInteraction) {
    case "approval":
      pending = {
        state: "warning",
        label: t("status.waitingApproval"),
        trailingLabel: t("status.compact.approval")
      };
      break;
    case "plan-review":
      pending = {
        state: "warning",
        label: t("status.planReview"),
        trailingLabel: t("status.compact.planReview")
      };
      break;
    case "question":
      pending = {
        state: "warning",
        label: t("status.waitingAnswer"),
        trailingLabel: t("status.compact.answer")
      };
      break;
    case void 0:
      break;
    /* v8 ignore next -- closed PendingInteractionStatus union */
    default:
      return assertNever2(node.pendingInteraction);
  }
  if (pending !== void 0) return subagents === void 0 ? [pending] : [pending, subagents];
  if (node.running) {
    const primary = { state: "ongoing", label: t("status.running") };
    return subagents === void 0 ? [primary] : [primary, subagents];
  }
  if (subagents !== void 0) return [subagents];
  if (node.completed) return [{ state: "done", label: t("status.completed") }];
  return [{ state: "idle", label: t("status.idle") }];
}
function SessionStatusDots({ statuses }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.StateDot, { state: statuses[0].state }),
    statuses.map((status) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Rows_default.visuallyHidden, children: status.label }, status.label))
  ] });
}
function ActiveScheduleIndicator({ t, search = false }) {
  const label = t("schedule.active");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "span",
    {
      className: clsx_default(Rows_default.scheduleIndicator, search && Rows_default.searchScheduleIndicator),
      role: "img",
      "aria-label": label,
      title: label,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconAlarmClockOutlineRegular, {})
    }
  );
}
function PinnedIndicator({ t }) {
  const label = t("row.pinned");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Rows_default.pinIndicator, role: "img", "aria-label": label, title: label, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconPinFillRegular, { size: 14 }) });
}
function SessionHoverContent({ node, now, t }) {
  const statuses = sessionStatuses(node, t).filter((status) => !(node.archived && (status.state === "done" || status.state === "idle")));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Rows_default.hoverContent, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Rows_default.hoverTitle, children: displayTitle(node, t) }),
    !node.blank && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Rows_default.hoverTime, children: hoverTimeLabel(node.updatedAt, now, t) }),
    statuses.map((status) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Rows_default.hoverStatus, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.StateDot, { state: status.state }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: status.label })
    ] }, status.label)),
    node.archived && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: clsx_default(Rows_default.hoverStatus, Rows_default.hoverArchived), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 14 }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("row.archived") })
    ] })
  ] });
}
function SearchResultItem({ result, currentId, onOpen, onUnarchive, t }) {
  const selected = result.id === currentId;
  const statuses = sessionStatuses(result, t);
  const primaryStatus = statuses[0];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: clsx_default(Rows_default.searchResultRow, selected && Rows_default.selected, result.archived && Rows_default.archived),
      role: "treeitem",
      "aria-selected": selected,
      "aria-description": result.archived ? t("toast.archivedNotOpenable") : void 0,
      onClick: () => {
        onOpen(result.id);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Rows_default.searchResultHeading, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Rows_default.slot, children: !result.archived && primaryStatus.state !== "idle" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionStatusDots, { statuses }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Rows_default.searchResultTitle, children: result.title }),
          result.hasActiveSchedule && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActiveScheduleIndicator, { t, search: true }),
          result.archived && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Rows_default.rowActions, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tooltip, { label: t("actions.unarchive"), side: "bottom", align: "end", delayMs: 500, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: Rows_default.iconButton,
              "aria-label": t("menu.unarchiveSession"),
              onClick: (e) => {
                e.stopPropagation();
                onUnarchive(result.id);
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconUnarchiveOutlineRegular, { size: 14 })
            }
          ) }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Rows_default.searchResultMeta, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Rows_default.searchResultWorkspace, children: result.workspace || t("group.ungrouped") }),
          result.snippet !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Rows_default.searchResultSnippet, children: result.snippet })
        ] })
      ]
    }
  );
}
function SessionNodeItem({
  node,
  currentId,
  now,
  onOpen,
  onRenameRequest,
  renderSlot,
  onReveal,
  drag,
  flat = false,
  t
}) {
  const row = node;
  const title = displayTitle(node, t);
  const selected = node.id === currentId;
  const statuses = sessionStatuses(node, t);
  const primaryStatus = statuses[0];
  const showStatus = primaryStatus.state !== "idle";
  const draggable = drag !== void 0 && !row.blank && !row.archived;
  const [menuOpen, setMenuOpen] = (0, import_react.useState)(false);
  const menuOpenState = (0, import_react.useMemo)(() => [menuOpen, setMenuOpen], [menuOpen]);
  const rowRef = (0, import_react.useRef)(null);
  const titleRef = (0, import_react.useRef)(null);
  const marquee = useTitleMarquee(titleRef);
  (0, import_react.useEffect)(() => {
    if (onReveal === void 0) return;
    rowRef.current?.scrollIntoView({ block: "nearest" });
    onReveal();
  }, [onReveal]);
  const ownRow = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      ref: rowRef,
      "data-row-key": `session:${node.id}`,
      className: clsx_default(
        Rows_default.sessionRow,
        selected && Rows_default.selected,
        menuOpen && Rows_default.menuOpen,
        row.archived && Rows_default.archived,
        flat && !showStatus && Rows_default.flatSessionRowWithoutStatus,
        drag?.marker === "before" && Rows_default.dropBefore,
        drag?.marker === "after" && Rows_default.dropAfter
      ),
      role: "treeitem",
      "aria-selected": selected,
      "aria-description": row.archived ? t("toast.archivedNotOpenable") : void 0,
      onClick: () => {
        onOpen(node.id);
      },
      onPointerEnter: marquee.enter,
      onPointerLeave: marquee.leave,
      draggable,
      onDragStart: !draggable ? void 0 : (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", node.id);
        drag.start();
      },
      onDragEnd: !draggable ? void 0 : drag.end,
      onDragOver: drag === void 0 ? void 0 : (e) => {
        if (!drag.active) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        drag.hover(rowHalf(e));
      },
      onDrop: drag === void 0 ? void 0 : (e) => {
        if (!drag.active) return;
        e.preventDefault();
        drag.drop(rowHalf(e));
      },
      children: [
        (!flat || showStatus) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Rows_default.slot, children: !row.archived && showStatus && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionStatusDots, { statuses }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            ref: titleRef,
            className: Rows_default.title,
            onDoubleClick: row.blank ? void 0 : (e) => {
              e.stopPropagation();
              onRenameRequest(node.id, row.title);
            },
            children: title
          }
        ),
        row.hasActiveSchedule && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActiveScheduleIndicator, { t }),
        !row.blank && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            className: Rows_default.time,
            "aria-hidden": primaryStatus.trailingLabel === void 0 ? void 0 : true,
            children: primaryStatus.trailingLabel ?? timeLabel(row.updatedAt, now, t)
          }
        ),
        row.pinned && !row.archived && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PinnedIndicator, { t }),
        !row.blank && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Rows_default.rowActions, onClick: (e) => {
          e.stopPropagation();
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Menu,
            {
              open: menuOpen,
              onClose: () => {
                setMenuOpen(false);
              },
              portal: true,
              closeOnPointerLeave: true,
              anchor: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  type: "button",
                  className: Rows_default.iconButton,
                  "aria-label": t("actions.session.aria", { name: title }),
                  onClick: () => {
                    setMenuOpen((v) => !v);
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
                }
              ),
              children: renderSlot(
                "sidebar.workspaces.session.menu.item",
                { sessionId: node.id, displayTitle: row.title },
                { hookContext: menuOpenState }
              )
            }
          ),
          renderSlot("sidebar.workspaces.session.row.action", { sessionId: node.id, displayTitle: row.title })
        ] })
      ]
    }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_dsh_client_ui_primitives.HoverCard,
    {
      anchor: ownRow,
      content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionHoverContent, { node, now, t }),
      openDelayMs: 800,
      disabled: menuOpen || drag?.active === true,
      copyText: row.blank ? void 0 : row.title,
      copyLabel: t("copy"),
      copiedLabel: t("hover.copied")
    }
  );
}

// rows/AnimatedRows.tsx
var import_react2 = require("react");

// rows/AnimatedRows.module.css
var owner2 = "dsh-nexttavern-ui-workspace";
var key2 = "dsh-nexttavern-ui-workspace/runtime/alpha3/compat/ui-workspace/src/client/rows/AnimatedRows.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key2)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner2;
  style.dataset.pluginCss = key2;
  style.textContent = ".rSjY6G_exits{contain:strict;pointer-events:none;position:absolute;inset:0;overflow:clip}";
  document.head.appendChild(style);
}
var AnimatedRows_default = { "exits": "rSjY6G_exits" };

// rows/AnimatedRows.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var ROW_FADE_MS = 100;
var ROW_GLIDE_MS = 200;
function sameRows(previous, next) {
  return previous.rowKeys.length === next.rowKeys.length && previous.rowKeys.every((key5, index) => key5 === next.rowKeys[index]);
}
function intersects(row, viewport) {
  return row.bottom > viewport.top && row.top < viewport.bottom && row.right > viewport.left && row.left < viewport.right;
}
var AnimatedRows = class extends import_react2.Component {
  armed = false;
  list = (0, import_react2.createRef)();
  overlay = (0, import_react2.createRef)();
  movements = /* @__PURE__ */ new Map();
  exits = /* @__PURE__ */ new Map();
  getSnapshotBeforeUpdate(previous) {
    const list = this.list.current;
    if (!this.armed || sameRows(previous, this.props) || previous.resetKey !== this.props.resetKey || !previous.ready || !this.props.ready || list === null || typeof list.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    const viewport = list.getBoundingClientRect();
    const positions = this.readPositions();
    const nextKeys = new Set(this.props.rowKeys);
    const removed = /* @__PURE__ */ new Map();
    for (const [key5, row] of positions) {
      if (nextKeys.has(key5) || !intersects(row.rect, viewport)) continue;
      const clone = row.element.cloneNode(true);
      clone.removeAttribute("data-row-key");
      clone.inert = true;
      clone.style.setProperty(
        "--dsh-workspace-indent",
        getComputedStyle(row.element).getPropertyValue("--dsh-workspace-indent")
      );
      removed.set(key5, { ...row, element: clone });
    }
    return { positions, removed };
  }
  componentDidUpdate(previous, _state, snapshot) {
    if (snapshot === null) {
      if (!sameRows(previous, this.props) || previous.resetKey !== this.props.resetKey || previous.ready !== this.props.ready) this.clear();
      return;
    }
    this.cancelMovements();
    const list = this.list.current;
    const overlay = this.overlay.current;
    const viewport = list.getBoundingClientRect();
    const origin = overlay.getBoundingClientRect();
    const positions = this.readPositions();
    for (const [key5, row] of positions) {
      this.removeExit(key5);
      const previousRow = snapshot.positions.get(key5);
      if (!intersects(row.rect, viewport) && (previousRow === void 0 || !intersects(previousRow.rect, viewport))) continue;
      if (previousRow === void 0) {
        this.move(row.element, [{ opacity: 0 }, { opacity: 1 }], ROW_FADE_MS);
        continue;
      }
      const dx = previousRow.rect.left - row.rect.left;
      const dy = previousRow.rect.top - row.rect.top;
      if (dx === 0 && dy === 0 && previousRow.opacity === 1) continue;
      this.move(row.element, [
        { transform: `translate(${String(dx)}px, ${String(dy)}px)`, opacity: previousRow.opacity },
        { transform: "translate(0, 0)", opacity: 1 }
      ], ROW_GLIDE_MS);
    }
    for (const [key5, row] of snapshot.removed) {
      const { element } = row;
      this.removeExit(key5);
      Object.assign(element.style, {
        position: "absolute",
        margin: "0",
        transform: "none",
        boxSizing: "border-box",
        left: `${String(row.rect.left - origin.left)}px`,
        top: `${String(row.rect.top - origin.top)}px`,
        width: `${String(row.rect.width)}px`,
        height: `${String(row.rect.height)}px`
      });
      overlay.append(element);
      const animation = element.animate([{ opacity: row.opacity }, { opacity: 0 }], {
        duration: ROW_FADE_MS,
        easing: "ease-out",
        fill: "forwards"
      });
      this.exits.set(key5, { element, animation });
      animation.onfinish = () => {
        this.removeExit(key5);
      };
    }
  }
  componentWillUnmount() {
    this.clear();
  }
  readPositions() {
    const list = this.list.current;
    const rows = list.querySelectorAll("[data-row-key]");
    return new Map(Array.from(rows, (element) => [element.dataset.rowKey, {
      element,
      rect: element.getBoundingClientRect(),
      opacity: this.movements.has(element) ? Number(getComputedStyle(element).opacity) : 1
    }]));
  }
  move(element, keyframes, duration) {
    const animation = element.animate(keyframes, { duration, easing: "ease-out" });
    this.movements.set(element, animation);
    animation.onfinish = () => {
      this.movements.delete(element);
      animation.cancel();
    };
  }
  cancelMovements() {
    for (const animation of this.movements.values()) {
      animation.onfinish = null;
      animation.cancel();
    }
    this.movements.clear();
  }
  removeExit(key5) {
    const exit = this.exits.get(key5);
    if (exit === void 0) return;
    exit.animation.onfinish = null;
    exit.animation.cancel();
    exit.element.remove();
    this.exits.delete(key5);
  }
  clear() {
    this.cancelMovements();
    for (const key5 of this.exits.keys()) this.removeExit(key5);
  }
  render() {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          ref: this.list,
          className: this.props.className,
          role: "tree",
          "aria-label": this.props.label,
          onPointerDownCapture: () => {
            this.armed = true;
          },
          onKeyDownCapture: () => {
            this.armed = true;
          },
          children: this.props.children
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { ref: this.overlay, className: AnimatedRows_default.exits, "aria-hidden": "true" })
    ] });
  }
};

// WorkspacePicker.tsx
var import_react3 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// WorkspacePicker.module.css
var owner3 = "dsh-nexttavern-ui-workspace";
var key3 = "dsh-nexttavern-ui-workspace/runtime/alpha3/compat/ui-workspace/src/client/WorkspacePicker.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key3)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner3;
  style.dataset.pluginCss = key3;
  style.textContent = ".FGIj8W_modalAction{min-width:72px}.FGIj8W_modalError,.FGIj8W_menuStatus{margin-top:8px;font-size:12px;line-height:18px}.FGIj8W_modalError{color:var(--dsw-alias-state-error-primary)}.FGIj8W_menuStatus{color:var(--dsw-alias-label-secondary)}";
  document.head.appendChild(style);
}
var WorkspacePicker_default = { "menuStatus": "FGIj8W_menuStatus", "modalAction": "FGIj8W_modalAction", "modalError": "FGIj8W_modalError" };

// WorkspacePicker.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var ADD_WORKSPACE = "::add-workspace";
function WorkspacePickFlow({
  t,
  open,
  anchorRef,
  useWorkspaces,
  createWorkspace,
  useDirectoryFlow,
  renderDirectoryFlow,
  onPick,
  onClose,
  addOnly = false,
  side = "bottom",
  selectedId
}) {
  const workspaceSnapshot = useWorkspaces((state) => state);
  const workspaces = workspaceSnapshot.items;
  const getAnchorRect = (0, import_react3.useCallback)(
    () => anchorRef?.current?.getBoundingClientRect() ?? null,
    [anchorRef]
  );
  const [errorOpen, setErrorOpen] = (0, import_react3.useState)(false);
  const [modalError, setModalError] = (0, import_react3.useState)(null);
  const [flowOpen, setFlowOpen] = (0, import_react3.useState)(false);
  const [pickingFolder, setPickingFolder] = (0, import_react3.useState)(false);
  const flowBusy = flowOpen || pickingFolder;
  const flowAvailable = useDirectoryFlow((occupied) => occupied);
  (0, import_react3.useEffect)(() => {
    if (flowOpen && !flowAvailable) setFlowOpen(false);
  }, [flowOpen, flowAvailable]);
  const addEntries = flowAvailable ? [{ id: ADD_WORKSPACE, label: t("menu.addWorkspace"), icon: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.IconPlusOutlineRegular, { size: 16 }), disabled: flowBusy }] : [];
  const pinAdd = !addOnly && workspaces.length > 0;
  const items = pinAdd ? workspaces.map((workspace) => ({
    id: workspace.workspaceId,
    label: workspace.title,
    icon: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.IconFolderCloseRegular, { size: 16 }),
    disabled: flowBusy
  })) : addEntries;
  const menuIsEmpty = items.length === 0;
  const closeModal = () => {
    setErrorOpen(false);
    setModalError(null);
  };
  const adoptDirectory = (path) => createWorkspace({ path }).then((workspace) => {
    setFlowOpen(false);
    onPick(workspace.workspaceId);
  }).catch((reason) => {
    setModalError(reason instanceof Error ? reason.message : String(reason));
    setFlowOpen(false);
    setErrorOpen(true);
  });
  const openDirectoryFlow = (0, import_react3.useCallback)(() => {
    onClose();
    setErrorOpen(false);
    setModalError(null);
    setFlowOpen(true);
  }, [onClose]);
  const listSettled = addOnly || workspaceSnapshot.phase === "ready";
  const addIsTheOnlyEntry = !pinAdd && listSettled && addEntries.length === 1;
  (0, import_react3.useEffect)(() => {
    if (open && addIsTheOnlyEntry && !flowBusy) openDirectoryFlow();
  }, [open, addIsTheOnlyEntry, flowBusy, openDirectoryFlow]);
  const flowOwner = {
    open: flowOpen,
    busy: pickingFolder,
    onPicked: (path) => {
      setPickingFolder(true);
      void adoptDirectory(path).finally(() => {
        setPickingFolder(false);
      });
    },
    onCancel: () => {
      setFlowOpen(false);
    },
    onError: (message) => {
      setFlowOpen(false);
      setModalError(message);
      setErrorOpen(true);
    }
  };
  const handleSelect = (id) => {
    if (id === ADD_WORKSPACE) {
      openDirectoryFlow();
      return;
    }
    onPick(id);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_dsh_client_ui_primitives2.Menu,
      {
        open: open && !addIsTheOnlyEntry && !menuIsEmpty,
        anchor: null,
        items,
        ...pinAdd ? { footer: addEntries } : {},
        selectedId,
        onSelect: handleSelect,
        onClose,
        side,
        portal: true,
        getAnchorRect
      }
    ),
    open && !addIsTheOnlyEntry && !menuIsEmpty && workspaceSnapshot.phase === "pending" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: WorkspacePicker_default.menuStatus, role: "status", children: t("picker.loading") }),
    renderDirectoryFlow(flowOwner),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_dsh_client_ui_primitives2.Modal,
      {
        open: errorOpen,
        onClose: closeModal,
        closeLabel: t("close"),
        title: t("folderError.title"),
        footer: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", className: WorkspacePicker_default.modalAction, onClick: closeModal, children: t("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "primary", className: WorkspacePicker_default.modalAction, disabled: !flowAvailable, onClick: openDirectoryFlow, children: t("folderError.retry") })
        ] }),
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: WorkspacePicker_default.modalError, role: "alert", children: modalError })
      }
    )
  ] });
}
function WorkspacePicker({
  open,
  anchorRef,
  useWorkspaces,
  selectedId,
  onPick,
  onClose,
  createWorkspace,
  useDirectoryFlow,
  renderSlot,
  t
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    WorkspacePickFlow,
    {
      t,
      open,
      anchorRef,
      useWorkspaces,
      createWorkspace,
      useDirectoryFlow,
      renderDirectoryFlow: (owner5) => renderSlot("conversation.hero.workspace.directoryFlow", owner5),
      selectedId,
      onPick,
      onClose
    }
  );
}

// rows/WorkspaceBrowser.module.css
var owner4 = "dsh-nexttavern-ui-workspace";
var key4 = "dsh-nexttavern-ui-workspace/runtime/alpha3/compat/ui-workspace/src/client/rows/WorkspaceBrowser.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key4)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner4;
  style.dataset.pluginCss = key4;
  style.textContent = '.OgyUtW_root{--dsh-session-list-edge-inset:var(--dsh-sidebar-inline-padding);--dsh-session-list-scrollbar-width:5px;--dsh-session-list-scrollbar-offset:2px;box-sizing:border-box;min-height:0;padding-right:var(--dsh-session-list-edge-inset);flex-direction:column;flex:1;display:flex}.OgyUtW_root.OgyUtW_rail{padding-right:0}.OgyUtW_iconButton{corner-shape:round;cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.OgyUtW_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.OgyUtW_viewOptionsMenu{min-width:200px}.OgyUtW_sectionHeader{box-sizing:border-box;height:36px;color:var(--dsw-alias-label-tertiary);border-radius:12px;flex:none;justify-content:flex-end;align-items:center;gap:4px;margin-bottom:4px;padding-left:4px;display:flex;overflow:hidden}.OgyUtW_root:not(.OgyUtW_rail) .OgyUtW_sectionHeader{margin-top:2px;margin-right:-4px}.OgyUtW_sectionLabel{white-space:nowrap;opacity:1;visibility:visible;min-width:0;max-width:45%;transition:max-width .18s var(--ds-ease-in-out), margin-right .18s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out), transform .18s var(--ds-ease-in-out), visibility 0s linear;flex:none;line-height:20px;overflow:hidden}.OgyUtW_sectionLabelHidden{opacity:0;visibility:hidden;max-width:0;margin-right:-4px;transition-delay:0s,0s,0s,0s,.18s;transform:translate(-4px)}.OgyUtW_searchSlot{box-sizing:border-box;min-width:0;max-width:28px;transition:max-width .18s var(--ds-ease-in-out), padding-left .18s var(--ds-ease-in-out);flex:1;align-items:center;margin-left:auto;padding-left:0;display:flex}.OgyUtW_searchSlotExpanded{max-width:100%;padding-left:0}.OgyUtW_headerActions{opacity:1;visibility:visible;max-width:60px;transition:max-width .18s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out), transform .18s var(--ds-ease-in-out), visibility 0s linear;flex:none;align-items:center;gap:4px;display:flex;overflow:hidden}.OgyUtW_headerActionsHidden{opacity:0;visibility:hidden;pointer-events:none;max-width:0;transition-delay:0s,0s,0s,.18s;transform:translate(4px)}.OgyUtW_search{box-sizing:border-box;corner-shape:round;cursor:text;width:100%;height:28px;color:var(--dsw-alias-label-secondary);transition:width .18s var(--ds-ease-in-out), padding .18s var(--ds-ease-in-out), border-color .18s var(--ds-ease-in-out), background-color .18s var(--ds-ease-in-out);background:0 0;border:none;border-radius:50%;flex:none;align-items:center;gap:0;margin:0;padding:0;display:flex;overflow:hidden}.OgyUtW_searchExpanded{border:.5px solid var(--dsw-alias-border-l4);width:calc(100% + 4px);height:30px;color:var(--dsw-alias-label-caption);background:0 0;border-radius:10px;margin-inline:-2px;padding:0 4px 0 0}.OgyUtW_searchButton{corner-shape:round;cursor:pointer;width:28px;height:28px;color:inherit;background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.OgyUtW_searchExpanded .OgyUtW_searchButton{width:28px;height:30px}.OgyUtW_searchButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.OgyUtW_searchExpanded .OgyUtW_searchButton:hover{background:0 0}.OgyUtW_searchInput{opacity:0;pointer-events:none;width:0;min-width:0;color:var(--dsw-alias-label-primary);transition:opacity .12s var(--ds-ease-in-out);background:0 0;border:none;outline:none;flex:1;font-size:13px;line-height:18px}.OgyUtW_searchExpanded .OgyUtW_searchInput{opacity:1;pointer-events:auto;margin-left:-2px}.OgyUtW_searchInput::placeholder{color:var(--dsw-alias-label-tertiary)}.OgyUtW_clearButton{corner-shape:round;cursor:pointer;width:24px;height:24px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.OgyUtW_clearButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.OgyUtW_rail .OgyUtW_sectionHeader{justify-content:flex-start;gap:0;margin-bottom:12px;padding-left:0}.OgyUtW_rail .OgyUtW_headerActions{max-width:none}.OgyUtW_rail .OgyUtW_iconButton{width:36px;height:36px;color:var(--dsw-alias-label-primary);border-radius:12px}.OgyUtW_rail .OgyUtW_search{background:0 0;border-color:#0000;border-radius:12px;gap:0;width:36px;height:36px;margin:0 0 12px;padding:0}.OgyUtW_rail .OgyUtW_searchButton{width:36px;height:36px;color:var(--dsw-alias-label-primary);border-radius:12px}.OgyUtW_rail .OgyUtW_searchButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.OgyUtW_listArea{min-height:0;margin-left:-4px;margin-right:calc(-1 * var(--dsh-session-list-edge-inset));flex-direction:column;flex:1;padding-left:4px;display:flex;overflow:visible}.OgyUtW_rail .OgyUtW_listArea{margin-left:0;margin-right:0;padding-left:0}.OgyUtW_treeBody{flex-direction:column;flex:1;min-height:0;display:flex;position:relative}.OgyUtW_fade{left:0;right:var(--dsh-session-list-edge-inset);background:linear-gradient(to bottom, transparent, var(--dsw-specific-sidebar-fill));pointer-events:none;height:24px;position:absolute;bottom:0}[data-platform=darwin] .OgyUtW_fade{display:none}.OgyUtW_wide{animation:OgyUtW_wide-in .2s var(--ds-ease-in-out)}@keyframes OgyUtW_wide-in{0%{opacity:0}}.OgyUtW_list{min-height:0;margin-left:-4px;margin-right:var(--dsh-session-list-scrollbar-offset);padding-left:4px;padding-right:calc(var(--dsh-session-list-edge-inset) - var(--dsh-session-list-scrollbar-width) - var(--dsh-session-list-scrollbar-offset));scrollbar-gutter:stable;flex:1;padding-bottom:16px;overflow-y:auto}.OgyUtW_flatList>*+*,.OgyUtW_searchTree>[role=treeitem]+[role=treeitem],.OgyUtW_groupSection>*+*{margin-top:2px}.OgyUtW_searchStatus{color:var(--dsw-alias-label-tertiary);padding:10px 12px;font-size:12px;line-height:18px}.OgyUtW_skeletonRow{box-sizing:border-box;align-items:flex-start;gap:8px;min-height:48px;padding:6px 8px 7px;display:flex}.OgyUtW_skeletonDot{corner-shape:round;border-radius:50%;flex:none;width:16px;height:16px}.OgyUtW_skeletonBars{flex-direction:column;flex:1;gap:6px;min-width:0;display:flex}.OgyUtW_skeletonDot,.OgyUtW_skeletonBar{background:var(--dsw-alias-bg-skeleton);animation:2s cubic-bezier(.36,0,.64,1) infinite OgyUtW_search-skeleton}.OgyUtW_skeletonBar{border-radius:4px;width:65%;height:16px}.OgyUtW_skeletonBarWide{width:90%;height:13px}@keyframes OgyUtW_search-skeleton{0%{opacity:1}40%{opacity:.6}80%,to{opacity:1}}.OgyUtW_groupSection{position:relative}.OgyUtW_groupSection+.OgyUtW_groupSection{margin-top:4px}.OgyUtW_listTopDropIndicator,.OgyUtW_workspaceDropBefore:before,.OgyUtW_workspaceDropAfter:after{content:"";z-index:1;background:linear-gradient(55deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat, linear-gradient(125deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat, linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute;left:0;right:0}.OgyUtW_listTopDropIndicator{top:-8px;left:0;right:var(--dsh-session-list-edge-inset)}.OgyUtW_listTopDropActive>.OgyUtW_workspaceDropBefore:first-child:before{display:none}.OgyUtW_workspaceDropBefore:before{top:-8px}.OgyUtW_workspaceDropAfter:after{bottom:-8px}.OgyUtW_sessionOverflowButton{width:100%;height:28px;padding:0 12px 0 calc(28px + var(--dsh-workspace-indent,0px));cursor:pointer;text-align:left;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:8px;font-size:12px}.OgyUtW_groupSection>.OgyUtW_sessionOverflowButton{margin-top:0}.OgyUtW_sessionOverflowButton:hover{color:var(--dsw-alias-label-secondary);background:0 0}.OgyUtW_empty{color:var(--dsw-alias-label-tertiary);padding:16px 12px;font-size:13px}.OgyUtW_renameInput{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);width:100%;height:44px;color:var(--dsw-alias-label-primary);background:0 0;border-radius:22px;outline:none;padding:7px 14px;font-size:14px;font-weight:400;line-height:22px}.OgyUtW_renameInput:disabled{color:var(--dsw-alias-label-dimmed)}.OgyUtW_renameError{color:var(--dsw-alias-state-error-primary);margin-top:8px;font-size:12px;line-height:18px}.OgyUtW_deleteAction:not(:disabled){color:var(--dsw-alias-state-error-primary)}.OgyUtW_deleteStatus{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.OgyUtW_archiveActivity{color:var(--dsw-alias-label-primary);margin:0 0 8px;padding-left:18px;font-size:13px;line-height:20px}.OgyUtW_archiveActivity li{overflow-wrap:anywhere}@media (prefers-reduced-motion:reduce){.OgyUtW_wide,.OgyUtW_skeletonDot,.OgyUtW_skeletonBar{animation:none}.OgyUtW_search,.OgyUtW_sectionLabel,.OgyUtW_searchSlot,.OgyUtW_searchInput,.OgyUtW_headerActions{transition:none}}';
  document.head.appendChild(style);
}
var WorkspaceBrowser_default = { "archiveActivity": "OgyUtW_archiveActivity", "clearButton": "OgyUtW_clearButton", "deleteAction": "OgyUtW_deleteAction", "deleteStatus": "OgyUtW_deleteStatus", "empty": "OgyUtW_empty", "fade": "OgyUtW_fade", "flatList": "OgyUtW_flatList", "groupSection": "OgyUtW_groupSection", "headerActions": "OgyUtW_headerActions", "headerActionsHidden": "OgyUtW_headerActionsHidden", "iconButton": "OgyUtW_iconButton", "list": "OgyUtW_list", "listArea": "OgyUtW_listArea", "listTopDropActive": "OgyUtW_listTopDropActive", "listTopDropIndicator": "OgyUtW_listTopDropIndicator", "rail": "OgyUtW_rail", "renameError": "OgyUtW_renameError", "renameInput": "OgyUtW_renameInput", "root": "OgyUtW_root", "search": "OgyUtW_search", "search-skeleton": "OgyUtW_search-skeleton", "searchButton": "OgyUtW_searchButton", "searchExpanded": "OgyUtW_searchExpanded", "searchInput": "OgyUtW_searchInput", "searchSlot": "OgyUtW_searchSlot", "searchSlotExpanded": "OgyUtW_searchSlotExpanded", "searchStatus": "OgyUtW_searchStatus", "searchTree": "OgyUtW_searchTree", "sectionHeader": "OgyUtW_sectionHeader", "sectionLabel": "OgyUtW_sectionLabel", "sectionLabelHidden": "OgyUtW_sectionLabelHidden", "sessionOverflowButton": "OgyUtW_sessionOverflowButton", "skeletonBar": "OgyUtW_skeletonBar", "skeletonBars": "OgyUtW_skeletonBars", "skeletonBarWide": "OgyUtW_skeletonBarWide", "skeletonDot": "OgyUtW_skeletonDot", "skeletonRow": "OgyUtW_skeletonRow", "treeBody": "OgyUtW_treeBody", "viewOptionsMenu": "OgyUtW_viewOptionsMenu", "wide": "OgyUtW_wide", "wide-in": "OgyUtW_wide-in", "workspaceDropAfter": "OgyUtW_workspaceDropAfter", "workspaceDropBefore": "OgyUtW_workspaceDropBefore" };

// rows/WorkspaceBrowser.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var EXPAND_SLIDE_MS = 300;
var SEARCH_DEBOUNCE_MS = 250;
var SEARCH_QUERY_MAX_CODE_UNITS = 500;
var COLLAPSED_SESSION_LIMIT = 5;
function collapsedSessionRows(sessions, limit = COLLAPSED_SESSION_LIMIT) {
  let idleCount = 0;
  const rows = sessions.filter((session) => {
    if (session.blank || session.running || session.runningSubagentCount > 0) return true;
    if (idleCount >= limit) return false;
    idleCount += 1;
    return true;
  });
  return { rows, hiddenCount: sessions.length - rows.length };
}
function sanitizeSearchQuery(value) {
  const withoutNul = value.replaceAll("\0", "");
  if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul;
  let end = SEARCH_QUERY_MAX_CODE_UNITS;
  const last = withoutNul.charCodeAt(end - 1);
  const next = withoutNul.charCodeAt(end);
  if (last >= 55296 && last <= 56319 && next >= 56320 && next <= 57343) end--;
  return withoutNul.slice(0, end);
}
function useNativeDragAcceptance(active) {
  (0, import_react4.useEffect)(() => {
    if (!active) return;
    const acceptDrag = (event) => {
      event.preventDefault();
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "move";
    };
    const acceptDrop = (event) => {
      event.preventDefault();
    };
    document.addEventListener("dragover", acceptDrag);
    document.addEventListener("drop", acceptDrop);
    return () => {
      document.removeEventListener("dragover", acceptDrag);
      document.removeEventListener("drop", acceptDrop);
    };
  }, [active]);
}
function ViewOptionsMenu({ groupBy, orderBy, archivedFilter, onGroupPick, onOrderPick, onArchivedFilterPick, t }) {
  const [open, setOpen] = (0, import_react4.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    import_dsh_client_ui_primitives3.Menu,
    {
      open,
      onClose: () => {
        setOpen(false);
      },
      items: [
        { type: "label", id: "group-by", text: t("groupBy.label") },
        { id: "workspace", label: t("groupBy.workspace"), icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconFolderCloseRegular, {}) },
        { id: "workspace-tree", label: t("groupBy.workspaceTree"), icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconWorkspaceTreeOutlineRegular, {}) },
        { id: "flat", label: t("groupBy.flat"), icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconFlatListOutlineRegular, {}) },
        { type: "separator", id: "order-by-separator" },
        { type: "label", id: "order-by", text: t("orderBy.label") },
        { id: "manual", label: t("orderBy.manual"), icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconChevronsUpDownOutlineRegular, {}) },
        { id: "updated", label: t("orderBy.updated"), icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconClockOutlineRegular, {}) },
        { type: "separator", id: "archived-filter-separator" },
        { type: "label", id: "filter-by", text: t("filterBy.label") },
        { id: "show-archived", label: t("viewOptions.showArchived"), icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconArchiveOutlineRegular, {}) },
        { id: "only-archived", label: t("viewOptions.onlyArchived"), icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconArchiveCheckOutlineRegular, {}) }
      ],
      selectedIds: [
        groupBy,
        orderBy,
        ...archivedFilter === "show" ? ["show-archived"] : [],
        ...archivedFilter === "only" ? ["only-archived"] : []
      ],
      onSelect: (id) => {
        if (id === "workspace" || id === "workspace-tree" || id === "flat") onGroupPick(id);
        else if (id === "manual" || id === "updated") onOrderPick(id);
        else if (id === "show-archived") onArchivedFilterPick(archivedFilter === "show" ? "default" : "show");
        else if (id === "only-archived") onArchivedFilterPick(archivedFilter === "only" ? "default" : "only");
        setOpen(false);
      },
      align: "end",
      dense: true,
      listClassName: WorkspaceBrowser_default.viewOptionsMenu,
      portal: true,
      anchor: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Tooltip, { label: t("viewOptions.label"), side: "bottom", delayMs: 500, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          type: "button",
          className: clsx_default(WorkspaceBrowser_default.iconButton, WorkspaceBrowser_default.wide),
          "aria-label": t("viewOptions.label"),
          onClick: () => {
            setOpen((v) => !v);
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconSlidersTwoOutlineRegular, {})
        }
      ) })
    }
  );
}
function sessionDragOrder(order, rows, drag, over) {
  const source = rows.find((row) => row.id === drag.sessionId);
  const target = rows.find((row) => row.id === over.id);
  if (source === void 0 || target === void 0 || source.blank || source.pinned !== drag.pinned || target.pinned !== drag.pinned || source.id === target.id || !order.includes(source.id)) return;
  const section = rows.filter((row) => row.pinned === drag.pinned);
  const sourceIndex = section.findIndex((row) => row.id === source.id);
  const withoutSource = section.filter((row) => row.id !== source.id);
  const insertAt = withoutSource.findIndex((row) => row.id === target.id) + (over.half === "after" ? 1 : 0);
  if (insertAt === sourceIndex) return;
  const next = order.filter((id) => id !== source.id);
  const targetIndex = next.indexOf(target.id);
  if (targetIndex === -1) return;
  next.splice(targetIndex + (over.half === "after" ? 1 : 0), 0, source.id);
  return pinCurrentBlank(next, rows.find((row) => row.blank)?.id);
}
function workspaceGroupHalf(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}
function SessionTree({
  list,
  useSessionStatus,
  startSession,
  open,
  workspaces,
  ungroupedSessionIds,
  rowState,
  workspaceReady,
  animationResetKey,
  usePanelInfo,
  onRenameRequest,
  onDeleteRequest,
  onSessionRenameRequest,
  renderSlot,
  insertWorkspaceBefore,
  nestWorkspaces,
  groupExpansion,
  setGroupExpanded,
  setSessionOrder,
  home,
  t,
  revealSessionId,
  onSessionRevealed
}) {
  const panelActive = usePanelInfo((info) => info.activePanelId !== null);
  const statuses = useSessionStatus((s) => s);
  const current = panelActive ? void 0 : Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
  const revealGroup = revealSessionId === void 0 || !workspaceReady ? void 0 : owningGroupKey(workspaces, revealSessionId);
  const [sessionLimits, setSessionLimits] = (0, import_react4.useState)({});
  const [drag, setDrag] = (0, import_react4.useState)(null);
  const sessionDropCommitted = (0, import_react4.useRef)(false);
  const [workspaceDrag, setWorkspaceDrag] = (0, import_react4.useState)(null);
  const workspaceDropCommitted = (0, import_react4.useRef)(false);
  const nativeDragActive = drag !== null || workspaceDrag !== null;
  useNativeDragAcceptance(nativeDragActive);
  const currentGroup = current === void 0 || !workspaceReady ? void 0 : owningGroupKey(workspaces, current);
  (0, import_react4.useEffect)(() => {
    if (current === void 0 || currentGroup === void 0 || Object.hasOwn(groupExpansion, currentGroup)) return;
    setGroupExpanded(currentGroup, true);
  }, [current, currentGroup, setGroupExpanded, groupExpansion]);
  const parents = (0, import_react4.useMemo)(() => {
    if (!nestWorkspaces) return /* @__PURE__ */ new Map();
    const keysByPath = new Map(workspaces.map((workspace) => [workspace.path, workspace.workspaceId]));
    const paths = [...keysByPath.keys()];
    return new Map(workspaces.map((workspace) => {
      const path = owningParentFolder(workspace.path, paths);
      return [workspace.workspaceId, path === void 0 ? void 0 : keysByPath.get(path)];
    }));
  }, [nestWorkspaces, workspaces]);
  const currentAncestors = (0, import_react4.useMemo)(() => {
    const keys = /* @__PURE__ */ new Set();
    for (let key5 = currentGroup === void 0 ? void 0 : parents.get(currentGroup); key5 !== void 0; key5 = parents.get(key5)) {
      keys.add(key5);
    }
    return keys;
  }, [currentGroup, parents]);
  const expandedGroups = (0, import_react4.useMemo)(() => {
    const ancestorKeys = new Set(parents.values());
    return [...workspaces.map((workspace) => workspace.workspaceId), UNGROUPED_KEY].filter((key5) => groupExpansion[key5] ?? ancestorKeys.has(key5));
  }, [groupExpansion, parents, workspaces]);
  const groups = (0, import_react4.useMemo)(
    () => deriveGroups(list, workspaces, rowState, statuses, {
      expandedGroups,
      ungroupedOrder: ungroupedSessionIds
    }),
    [list, workspaces, rowState, statuses, expandedGroups, ungroupedSessionIds]
  );
  (0, import_react4.useEffect)(() => {
    for (let key5 = revealGroup; key5 !== void 0; key5 = parents.get(key5)) {
      if (groupExpansion[key5] === false || key5 === revealGroup && groupExpansion[key5] !== true) {
        setGroupExpanded(key5, true);
      }
    }
  }, [groupExpansion, parents, revealGroup, setGroupExpanded]);
  (0, import_react4.useEffect)(() => {
    if (revealSessionId === void 0 || revealGroup === void 0) return;
    const group = groups.find((candidate) => candidate.key === revealGroup);
    if (group === void 0 || !group.expanded || !group.sessions.some((row) => row.id === revealSessionId)) return;
    if (collapsedSessionRows(group.sessions).rows.some((row) => row.id === revealSessionId)) return;
    setSessionLimits((limits) => limits[revealGroup] === Infinity ? limits : { ...limits, [revealGroup]: Infinity });
  }, [groups, revealGroup, revealSessionId]);
  const now = Date.now();
  const commitSessionDrag = (activeDrag, over) => {
    if (sessionDropCommitted.current) return;
    sessionDropCommitted.current = true;
    setDrag(null);
    const group = groups.find((candidate) => candidate.key === activeDrag.accountKey);
    if (group === void 0) return;
    if (over.id === activeDrag.sessionId) return;
    const accountSessionIds = activeDrag.accountKey === UNGROUPED_KEY ? ungroupedSessionIds : workspaces.find((workspace) => workspace.workspaceId === activeDrag.accountKey)?.sessionIds;
    if (accountSessionIds === void 0) return;
    const renderedSessions = collapsedSessionRows(group.sessions, sessionLimits[group.key]).rows;
    const nextOrder = sessionDragOrder(accountSessionIds, renderedSessions, activeDrag, over);
    if (nextOrder !== void 0) setSessionOrder(activeDrag.accountKey, nextOrder);
  };
  const commitWorkspaceDrag = (activeDrag, over) => {
    if (workspaceDropCommitted.current) return;
    workspaceDropCommitted.current = true;
    setWorkspaceDrag(null);
    const owner5 = parents.get(activeDrag.workspaceId);
    const siblings = workspaces.filter((workspace) => parents.get(workspace.workspaceId) === owner5);
    const rowIndex = siblings.findIndex((workspace) => workspace.workspaceId === over.id);
    if (rowIndex === -1) return;
    const anchor = over.half === "before" ? over.id : siblings[rowIndex + 1]?.workspaceId;
    if (anchor === activeDrag.workspaceId) return;
    const sourceIndex = siblings.findIndex((workspace) => workspace.workspaceId === activeDrag.workspaceId);
    const anchorIndex = anchor === void 0 ? siblings.length : siblings.findIndex((workspace) => workspace.workspaceId === anchor);
    if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
    insertWorkspaceBefore(activeDrag.workspaceId, anchor).catch((reason) => {
      console.warn("workspace reorder rejected:", reason);
    });
  };
  const childrenByParent = (0, import_react4.useMemo)(() => {
    const children = /* @__PURE__ */ new Map();
    for (const group of groups) {
      const parent = parents.get(group.key);
      const siblings = children.get(parent);
      if (siblings === void 0) children.set(parent, [group]);
      else siblings.push(group);
    }
    return children;
  }, [groups, parents]);
  const rootGroups = childrenByParent.get(void 0) ?? [];
  const workspaceDropAtListStart = rootGroups[0]?.workspaceId !== void 0 && workspaceDrag?.over?.id === rootGroups[0].workspaceId && workspaceDrag.over.half === "before";
  const rowKeys = groups.length === 0 ? ["empty"] : [];
  const renderGroup = (group, depth) => {
    const workspaceId = group.workspaceId;
    const children = childrenByParent.get(group.key) ?? [];
    const compatibleDrag = workspaceDrag !== null && parents.get(workspaceDrag.workspaceId) === parents.get(group.key);
    const collapsed = collapsedSessionRows(group.sessions);
    const visible = collapsedSessionRows(group.sessions, sessionLimits[group.key]);
    const sessionsExpanded = visible.hiddenCount === 0;
    rowKeys.push(`workspace:${group.key}`);
    const childRows = group.expanded ? children.map((child) => renderGroup(child, depth + 1)) : [];
    const sessions = visible.rows;
    for (const node of sessions) rowKeys.push(`session:${node.id}`);
    if (collapsed.hiddenCount > 0) rowKeys.push(`overflow:${group.key}`);
    const workspaceMarker = workspaceId !== void 0 && workspaceDrag?.over?.id === workspaceId ? workspaceDrag.over.half : null;
    const workspaceDragProps = workspaceId === void 0 ? void 0 : {
      start: () => {
        workspaceDropCommitted.current = false;
        setWorkspaceDrag({ workspaceId, over: null });
      },
      end: () => {
        if (workspaceDrag?.over !== null && workspaceDrag?.over !== void 0) {
          commitWorkspaceDrag(workspaceDrag, workspaceDrag.over);
        } else {
          setWorkspaceDrag(null);
        }
        workspaceDropCommitted.current = false;
      }
    };
    const hoverWorkspace = workspaceId === void 0 || !compatibleDrag ? void 0 : (half) => {
      setWorkspaceDrag((active) => active === null ? active : { ...active, over: { id: workspaceId, half } });
    };
    const dropWorkspace = workspaceId === void 0 || !compatibleDrag ? void 0 : (half) => {
      commitWorkspaceDrag(workspaceDrag, { id: workspaceId, half });
    };
    return (
      // Group section: header, descendant Workspaces, and own Session rows. The
      // inter-group breathing room is the section's own margin
      // (WorkspaceBrowser.module.css).
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          style: { "--dsh-workspace-indent": `${depth * 12}px` },
          className: clsx_default(
            WorkspaceBrowser_default.groupSection,
            workspaceMarker === "before" && WorkspaceBrowser_default.workspaceDropBefore,
            workspaceMarker === "after" && WorkspaceBrowser_default.workspaceDropAfter
          ),
          onDragOver: workspaceDrag === null ? void 0 : (e) => {
            e.preventDefault();
            if (hoverWorkspace === void 0 && parents.get(group.key) !== void 0) return;
            e.stopPropagation();
            if (hoverWorkspace === void 0) {
              e.dataTransfer.dropEffect = "none";
              if (workspaceDrag.over !== null) setWorkspaceDrag({ ...workspaceDrag, over: null });
            } else {
              e.dataTransfer.dropEffect = "move";
              hoverWorkspace(workspaceGroupHalf(e));
            }
          },
          onDrop: workspaceDrag === null ? void 0 : (e) => {
            e.preventDefault();
            if (dropWorkspace === void 0 && parents.get(group.key) !== void 0) return;
            e.stopPropagation();
            if (dropWorkspace === void 0) {
              workspaceDropCommitted.current = true;
              setWorkspaceDrag(null);
            } else {
              dropWorkspace(workspaceGroupHalf(e));
            }
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              ProjectRowItem,
              {
                group,
                containsCurrentDescendant: currentAncestors.has(group.key),
                home,
                t,
                onToggle: () => {
                  if (group.expanded) {
                    setSessionLimits((limits) => ({ ...limits, [group.key]: COLLAPSED_SESSION_LIMIT }));
                  }
                  setGroupExpanded(group.key, !group.expanded);
                },
                onCreate: () => {
                  if (group.workspaceId !== void 0) {
                    setGroupExpanded(group.key, true);
                    startSession(group.workspaceId);
                  }
                },
                drag: workspaceDragProps,
                actions: group.workspaceId === void 0 ? void 0 : {
                  rename: () => {
                    if (group.workspaceId !== void 0) onRenameRequest(group.workspaceId, group.label);
                  },
                  delete: () => {
                    if (group.workspaceId !== void 0) onDeleteRequest(group.workspaceId, group.label);
                  }
                }
              }
            ),
            childRows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { role: "group", children: childRows }),
            sessions.map((node) => {
              const sameGroupDrag = drag !== null && drag.accountKey === group.key;
              const compatibleTarget = sameGroupDrag && drag.pinned === node.pinned;
              const normalizeHalf = (half) => node.blank ? "after" : half;
              const dragProps = {
                start: () => {
                  sessionDropCommitted.current = false;
                  setDrag({ accountKey: group.key, sessionId: node.id, pinned: node.pinned, over: null });
                },
                active: compatibleTarget,
                marker: sameGroupDrag && drag.over?.id === node.id ? drag.over.half : null,
                hover: (half) => {
                  setDrag((d) => d === null ? d : {
                    ...d,
                    over: { id: node.id, half: normalizeHalf(half) }
                  });
                },
                drop: (half) => {
                  if (drag === null) return;
                  commitSessionDrag(drag, { id: node.id, half: normalizeHalf(half) });
                },
                end: () => {
                  if (drag?.over !== null && drag?.over !== void 0) commitSessionDrag(drag, drag.over);
                  else setDrag(null);
                  sessionDropCommitted.current = false;
                }
              };
              return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                SessionNodeItem,
                {
                  node,
                  currentId: current,
                  now,
                  onOpen: open,
                  onRenameRequest: onSessionRenameRequest,
                  renderSlot,
                  onReveal: node.id === revealSessionId && group.key === revealGroup ? () => {
                    onSessionRevealed(node.id);
                  } : void 0,
                  drag: dragProps,
                  t
                },
                node.id
              );
            }),
            collapsed.hiddenCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                className: WorkspaceBrowser_default.sessionOverflowButton,
                "data-row-key": `overflow:${group.key}`,
                "aria-expanded": sessionsExpanded,
                onClick: () => {
                  setSessionLimits((limits) => ({
                    ...limits,
                    [group.key]: sessionsExpanded ? COLLAPSED_SESSION_LIMIT : visible.hiddenCount <= COLLAPSED_SESSION_LIMIT ? Infinity : (limits[group.key] ?? COLLAPSED_SESSION_LIMIT) + COLLAPSED_SESSION_LIMIT
                  }));
                },
                children: sessionsExpanded ? t("sessions.collapse") : t("sessions.expand", { n: visible.hiddenCount })
              }
            )
          ]
        },
        group.key
      )
    );
  };
  const groupRows = rootGroups.map((group) => renderGroup(group, 0));
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: clsx_default(WorkspaceBrowser_default.treeBody, WorkspaceBrowser_default.wide), children: [
    workspaceDropAtListStart && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: WorkspaceBrowser_default.listTopDropIndicator, "aria-hidden": "true" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      AnimatedRows,
      {
        className: clsx_default(WorkspaceBrowser_default.list, workspaceDropAtListStart && WorkspaceBrowser_default.listTopDropActive),
        label: t("section.sessions"),
        rowKeys,
        ready: list.phase === "ready" && workspaceReady && !nativeDragActive,
        resetKey: JSON.stringify([animationResetKey, sessionLimits]),
        children: [
          groups.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: WorkspaceBrowser_default.empty, "data-row-key": "empty", children: t("empty.none") }),
          groupRows
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: WorkspaceBrowser_default.fade })
  ] });
}
function FlatList({
  list,
  sessionIds,
  rowState,
  useSessionStatus,
  open,
  onSessionRenameRequest,
  renderSlot,
  usePanelInfo,
  setSessionOrder,
  workspaceReady,
  animationResetKey,
  revealSessionId,
  onSessionRevealed,
  t
}) {
  const panelActive = usePanelInfo((info) => info.activePanelId !== null);
  const statuses = useSessionStatus((s) => s);
  const rows = (0, import_react4.useMemo)(
    () => deriveFlat(list, sessionIds, rowState, statuses),
    [list, sessionIds, rowState, statuses]
  );
  const [drag, setDrag] = (0, import_react4.useState)(null);
  const dropCommitted = (0, import_react4.useRef)(false);
  useNativeDragAcceptance(drag !== null);
  const currentId = panelActive ? void 0 : Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
  const commitDrag = (activeDrag, over) => {
    if (dropCommitted.current) return;
    dropCommitted.current = true;
    setDrag(null);
    const nextOrder = sessionDragOrder(sessionIds, rows, activeDrag, over);
    if (nextOrder !== void 0) setSessionOrder(FLAT_SESSION_ORDER_KEY, nextOrder);
  };
  const now = Date.now();
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: clsx_default(WorkspaceBrowser_default.treeBody, WorkspaceBrowser_default.wide), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      AnimatedRows,
      {
        className: clsx_default(WorkspaceBrowser_default.list, WorkspaceBrowser_default.flatList),
        label: t("section.sessions"),
        rowKeys: rows.length === 0 ? ["empty"] : rows.map((row) => `session:${row.id}`),
        ready: list.phase === "ready" && workspaceReady && drag === null,
        resetKey: animationResetKey,
        children: [
          rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: WorkspaceBrowser_default.empty, "data-row-key": "empty", children: t("empty.none") }),
          rows.map((node) => {
            const active = drag !== null && drag.pinned === node.pinned;
            const normalizeHalf = (half) => node.blank ? "after" : half;
            return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              SessionNodeItem,
              {
                node,
                currentId,
                now,
                onOpen: open,
                onRenameRequest: onSessionRenameRequest,
                renderSlot,
                onReveal: node.id === revealSessionId ? () => {
                  onSessionRevealed(node.id);
                } : void 0,
                flat: true,
                drag: {
                  start: () => {
                    dropCommitted.current = false;
                    setDrag({ accountKey: FLAT_SESSION_ORDER_KEY, sessionId: node.id, pinned: node.pinned, over: null });
                  },
                  active,
                  marker: active && drag.over?.id === node.id ? drag.over.half : null,
                  hover: (half) => {
                    setDrag((current) => current === null ? current : {
                      ...current,
                      over: { id: node.id, half: normalizeHalf(half) }
                    });
                  },
                  drop: (half) => {
                    if (drag !== null) commitDrag(drag, { id: node.id, half: normalizeHalf(half) });
                  },
                  end: () => {
                    if (drag?.over !== null && drag?.over !== void 0) commitDrag(drag, drag.over);
                    else setDrag(null);
                    dropCommitted.current = false;
                  }
                },
                t
              },
              node.id
            );
          })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: WorkspaceBrowser_default.fade })
  ] });
}
function SearchResults({
  useSessions,
  useSessionStatus,
  open,
  onUnarchive,
  workspaces,
  archivedSessionIds,
  archivedFilter,
  query,
  remote,
  resultLimit,
  usePanelInfo,
  t
}) {
  const panelActive = usePanelInfo((info) => info.activePanelId !== null);
  const list = useSessions((s) => s);
  const statuses = useSessionStatus((s) => s);
  const currentRemote = remote.query === query ? remote : { query, status: "loading", items: [], hasMore: false };
  const results = (0, import_react4.useMemo)(
    () => deriveSearchResults(
      list,
      workspaces,
      query,
      archivedSessionIds,
      archivedFilter,
      statuses,
      currentRemote,
      resultLimit
    ),
    [list, workspaces, query, archivedSessionIds, archivedFilter, statuses, currentRemote, resultLimit]
  );
  const pending = currentRemote.status === "loading";
  const currentId = panelActive ? void 0 : Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: clsx_default(WorkspaceBrowser_default.treeBody, WorkspaceBrowser_default.wide), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: WorkspaceBrowser_default.list, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: WorkspaceBrowser_default.searchTree, role: "tree", "aria-label": t("search.results.aria"), children: results.items.map((result) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        SearchResultItem,
        {
          result,
          currentId,
          onOpen: open,
          onUnarchive,
          t
        },
        result.id
      )) }),
      pending && /* Two skeleton rows on an empty list, one when local matches already
         show and only the content hits are outstanding. */
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { role: "status", "aria-label": t("search.pending"), children: (results.items.length === 0 ? [0, 1] : [0]).map((i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: WorkspaceBrowser_default.skeletonRow, "aria-hidden": "true", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: WorkspaceBrowser_default.skeletonDot }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: WorkspaceBrowser_default.skeletonBars, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: WorkspaceBrowser_default.skeletonBar }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: clsx_default(WorkspaceBrowser_default.skeletonBar, WorkspaceBrowser_default.skeletonBarWide) })
        ] })
      ] }, i)) }),
      !pending && results.items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: WorkspaceBrowser_default.empty, children: t("search.noMatches") }),
      results.hasMore && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: WorkspaceBrowser_default.searchStatus, children: t("search.hasMore", { n: resultLimit }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: WorkspaceBrowser_default.fade })
  ] });
}
function WorkspaceBrowser(props) {
  const occupied = props.usePresentation((value) => value);
  return occupied ? props.renderSlot("sidebar.workspaces.presentation", {
    browserProps: props,
    renderDefault: (overrides) => (0, import_react4.createElement)(WorkspaceBrowserContent, { ...props, ...overrides })
  }) : (0, import_react4.createElement)(WorkspaceBrowserContent, props);
}
function WorkspaceBrowserContent({
  wide,
  usePanelInfo,
  expandSidebar,
  useSessions,
  useSessionStatus,
  useWorkspaces,
  useStore,
  actions,
  startSession,
  open,
  requestSessionRename,
  notifyArchivedNotOpenable,
  renameWorkspace,
  deleteWorkspace,
  insertWorkspaceBefore,
  unarchiveSession,
  createWorkspace,
  searchSessions,
  searchResultLimit,
  useDirectoryFlow,
  useHostInfo,
  renderSlot,
  t
}) {
  const home = useHostInfo((info) => info.home);
  const list = useSessions((state) => state);
  const workspaces = useWorkspaces((state) => state.items);
  const workspacePhase = useWorkspaces((state) => state.phase);
  const workspaceStreamState = useWorkspaces((state) => state.state);
  const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
  const pinnedSessionIds = useWorkspaces((state) => state.pinnedSessionIds);
  const directoryFlowAvailable = useDirectoryFlow((occupied) => occupied);
  const groupBy = useStore((s) => s.groupBy);
  const orderBy = useStore((s) => s.orderBy);
  const archivedFilter = useStore((s) => s.archivedFilter ?? "default");
  const groupExpansion = useStore((s) => s.groupExpansion);
  const sessionOrderByAccount = useStore((s) => s.sessionOrderByAccount);
  const guardedOpen = (sessionId) => {
    if (archivedSessionIds.includes(sessionId)) {
      notifyArchivedNotOpenable();
      return;
    }
    open(sessionId);
  };
  const workspaceReady = workspacePhase === "ready" && workspaceStreamState !== "loading";
  const mainSessionId2 = Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
  const currentBlank = mainSessionId2 !== void 0 && list.byId[mainSessionId2]?.blank === true ? mainSessionId2 : void 0;
  const ungroupedMemberIds = (0, import_react4.useMemo)(() => {
    const accounted = new Set(workspaces.flatMap((workspace) => workspace.sessionIds));
    return list.ids.filter((id) => list.byId[id] !== void 0 && !accounted.has(id));
  }, [list, workspaces]);
  const orderState = (0, import_react4.useMemo)(
    () => ({ pinnedSessionIds, archivedSessionIds }),
    [archivedSessionIds, pinnedSessionIds]
  );
  const rowState = (0, import_react4.useMemo)(
    () => ({ ...orderState, archivedFilter }),
    [orderState, archivedFilter]
  );
  const flatMemberIds = (0, import_react4.useMemo)(() => sessionMemberIds(list), [list]);
  const orderedWorkspaces = (0, import_react4.useMemo)(() => workspaces.map((workspace) => {
    const memberIds = workspace.sessionIds;
    const baseOrder = orderBy === "updated" ? orderByRecency(memberIds, list.byId) : reconcileManualOrder(memberIds, sessionOrderByAccount[workspace.workspaceId], list.byId, orderState);
    return {
      ...workspace,
      sessionIds: pinCurrentBlank(
        baseOrder,
        currentBlank !== void 0 && memberIds.includes(currentBlank) ? currentBlank : void 0
      )
    };
  }), [currentBlank, list.byId, orderBy, orderState, sessionOrderByAccount, workspaces]);
  const orderedUngroupedSessionIds = (0, import_react4.useMemo)(() => {
    const baseOrder = orderBy === "updated" ? orderByRecency(ungroupedMemberIds, list.byId) : reconcileManualOrder(ungroupedMemberIds, sessionOrderByAccount[UNGROUPED_KEY], list.byId, orderState);
    return pinCurrentBlank(
      baseOrder,
      currentBlank !== void 0 && ungroupedMemberIds.includes(currentBlank) ? currentBlank : void 0
    );
  }, [currentBlank, list.byId, orderBy, orderState, sessionOrderByAccount, ungroupedMemberIds]);
  const orderedFlatSessionIds = (0, import_react4.useMemo)(() => {
    const baseOrder = orderBy === "updated" ? orderByRecency(flatMemberIds, list.byId) : reconcileManualOrder(flatMemberIds, sessionOrderByAccount[FLAT_SESSION_ORDER_KEY], list.byId, orderState);
    return pinCurrentBlank(
      baseOrder,
      currentBlank !== void 0 && flatMemberIds.includes(currentBlank) ? currentBlank : void 0
    );
  }, [currentBlank, flatMemberIds, list.byId, orderBy, orderState, sessionOrderByAccount]);
  const activeSessionOrders = (0, import_react4.useMemo)(() => Object.fromEntries([
    ...orderedWorkspaces.map((workspace) => [workspace.workspaceId, workspace.sessionIds]),
    [UNGROUPED_KEY, orderedUngroupedSessionIds],
    [FLAT_SESSION_ORDER_KEY, orderedFlatSessionIds]
  ]), [orderedFlatSessionIds, orderedUngroupedSessionIds, orderedWorkspaces]);
  (0, import_react4.useEffect)(() => {
    if (workspacePhase !== "ready") return;
    actions.retainAccountKeys([
      UNGROUPED_KEY,
      FLAT_SESSION_ORDER_KEY,
      ...workspaces.map((workspace) => workspace.workspaceId)
    ]);
  }, [actions.retainAccountKeys, workspacePhase, workspaces]);
  (0, import_react4.useEffect)(() => {
    if (list.phase !== "ready" || workspaceReady || orderBy !== "manual" || currentBlank === void 0) return;
    const changed = {};
    for (const [key5, ids] of Object.entries(activeSessionOrders)) {
      if (key5 !== FLAT_SESSION_ORDER_KEY && workspacePhase !== "ready") continue;
      const saved = sessionOrderByAccount[key5] ?? [];
      if (ids[0] !== currentBlank || saved[0] === currentBlank) continue;
      changed[key5] = [currentBlank, ...saved.filter((id) => id !== currentBlank)];
    }
    if (Object.keys(changed).length > 0) actions.syncSessionOrders(changed);
  }, [
    actions.syncSessionOrders,
    activeSessionOrders,
    currentBlank,
    list.phase,
    orderBy,
    sessionOrderByAccount,
    workspacePhase,
    workspaceReady
  ]);
  (0, import_react4.useEffect)(() => {
    if (list.phase !== "ready" || !workspaceReady || orderBy !== "manual" || currentBlank === void 0) return;
    const moved = Object.entries(activeSessionOrders).some(([key5, ids]) => ids[0] === currentBlank && sessionOrderByAccount[key5]?.[0] !== currentBlank);
    if (moved) actions.syncSessionOrders(activeSessionOrders);
  }, [
    actions.syncSessionOrders,
    activeSessionOrders,
    currentBlank,
    list.phase,
    orderBy,
    sessionOrderByAccount,
    workspaceReady
  ]);
  const saveSessionOrder = (accountKey, order) => {
    actions.setSessionOrder(accountKey, order, activeSessionOrders);
  };
  const [query, setQuery] = (0, import_react4.useState)("");
  const [searchExpanded, setSearchExpanded] = (0, import_react4.useState)(false);
  const [revealSessionId, setRevealSessionId] = (0, import_react4.useState)(void 0);
  const normalizedQuery = sanitizeSearchQuery(query).trim();
  const [remoteSearch, setRemoteSearch] = (0, import_react4.useState)({
    query: "",
    status: "idle",
    items: [],
    hasMore: false
  });
  const searchRoot = (0, import_react4.useRef)(null);
  const searchInput = (0, import_react4.useRef)(null);
  const [wsPickerOpen, setWsPickerOpen] = (0, import_react4.useState)(false);
  const wsPlusRef = (0, import_react4.useRef)(null);
  const composingRef = (0, import_react4.useRef)(false);
  const openSearchResult = (sessionId) => {
    if (archivedSessionIds.includes(sessionId)) {
      notifyArchivedNotOpenable();
      return;
    }
    setRevealSessionId(sessionId);
    setQuery("");
    setSearchExpanded(false);
    open(sessionId);
  };
  const acknowledgeSessionReveal = (sessionId) => {
    setRevealSessionId((current) => current === sessionId ? void 0 : current);
  };
  (0, import_react4.useEffect)(() => {
    if (normalizedQuery !== "") setRevealSessionId(void 0);
  }, [normalizedQuery]);
  const [searchOnExpand, setSearchOnExpand] = (0, import_react4.useState)(false);
  (0, import_react4.useEffect)(() => {
    if (wide && searchOnExpand) {
      const timer = window.setTimeout(() => {
        searchInput.current?.focus({ preventScroll: true });
        setSearchOnExpand(false);
      }, EXPAND_SLIDE_MS);
      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [wide, searchOnExpand]);
  (0, import_react4.useEffect)(() => {
    if (!wide || !searchExpanded || searchOnExpand) return;
    searchInput.current?.focus({ preventScroll: true });
  }, [wide, searchExpanded, searchOnExpand]);
  (0, import_react4.useEffect)(() => {
    if (!wide || !searchExpanded || searchOnExpand) return;
    const onClick = (event) => {
      if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return;
      searchInput.current?.blur();
      if (normalizedQuery !== "") return;
      setSearchExpanded(false);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, [normalizedQuery, wide, searchExpanded, searchOnExpand]);
  (0, import_react4.useEffect)(() => {
    if (normalizedQuery === "") {
      setRemoteSearch({ query: "", status: "idle", items: [], hasMore: false });
      return;
    }
    const controller = new AbortController();
    setRemoteSearch({
      query: normalizedQuery,
      status: "loading",
      items: [],
      hasMore: false
    });
    const timer = window.setTimeout(() => {
      searchSessions(normalizedQuery, controller.signal).then((result) => {
        if (controller.signal.aborted) return;
        setRemoteSearch({
          query: normalizedQuery,
          status: "ready",
          items: result.items,
          hasMore: result.hasMore
        });
      }).catch(() => {
        if (controller.signal.aborted) return;
        setRemoteSearch({
          query: normalizedQuery,
          status: "error",
          items: [],
          hasMore: false
        });
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, searchSessions]);
  const [renameTarget, setRenameTarget] = (0, import_react4.useState)(null);
  const [renameDraft, setRenameDraft] = (0, import_react4.useState)("");
  const [renaming, setRenaming] = (0, import_react4.useState)(false);
  const [renameError, setRenameError] = (0, import_react4.useState)(null);
  const renameTrimmed = renameDraft.trim();
  const renameDuplicate = renameTarget !== null && renameTrimmed !== "" && renameTrimmed !== renameTarget.currentTitle && workspaces.some((w) => w.title === renameTrimmed);
  const renameBlocked = renaming || renameTrimmed === "" || renameTarget === null || renameTrimmed === renameTarget.currentTitle || renameDuplicate;
  const closeRename = () => {
    if (renaming) return;
    setRenameTarget(null);
    setRenameError(null);
  };
  const confirmRename = () => {
    if (renameBlocked) return;
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
  const onSessionUnarchive = (sessionId) => {
    unarchiveSession(sessionId).catch((reason) => {
      console.warn("session unarchive rejected:", reason);
    });
  };
  const [deleteTarget, setDeleteTarget] = (0, import_react4.useState)(null);
  const [deleting, setDeleting] = (0, import_react4.useState)(false);
  const [deleteCommittedId, setDeleteCommittedId] = (0, import_react4.useState)(null);
  const [deleteError, setDeleteError] = (0, import_react4.useState)(null);
  (0, import_react4.useEffect)(() => {
    if (deleteCommittedId === null || workspaces.some((workspace) => workspace.workspaceId === deleteCommittedId)) return;
    setDeleting(false);
    setDeleteCommittedId(null);
    setDeleteTarget(null);
  }, [deleteCommittedId, workspaces]);
  const closeDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };
  const confirmDelete = () => {
    if (deleting || deleteTarget === null) return;
    setDeleting(true);
    setDeleteCommittedId(null);
    setDeleteError(null);
    deleteWorkspace(deleteTarget.workspaceId).then(() => {
      setDeleteCommittedId(deleteTarget.workspaceId);
    }).catch((reason) => {
      setDeleting(false);
      setDeleteError(reason instanceof Error ? reason.message : String(reason));
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: clsx_default(WorkspaceBrowser_default.root, !wide && WorkspaceBrowser_default.rail), children: [
    renderSlot("sidebar.workspaces.before", { wide }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: WorkspaceBrowser_default.sectionHeader, children: [
      wide && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: clsx_default(WorkspaceBrowser_default.sectionLabel, WorkspaceBrowser_default.wide, searchExpanded && WorkspaceBrowser_default.sectionLabelHidden), children: groupBy === "flat" ? t("section.sessions") : t("section.workspaces") }),
      renderSlot("sidebar.workspaces.header.action", { wide }),
      wide && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: clsx_default(WorkspaceBrowser_default.searchSlot, searchExpanded && WorkspaceBrowser_default.searchSlotExpanded), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          ref: searchRoot,
          className: clsx_default(WorkspaceBrowser_default.search, searchExpanded && WorkspaceBrowser_default.searchExpanded),
          onClick: () => {
            setWsPickerOpen(false);
            setSearchExpanded(true);
            searchInput.current?.focus();
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Tooltip, { label: t("search"), side: "bottom", delayMs: 500, disabled: searchExpanded, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                className: WorkspaceBrowser_default.searchButton,
                "aria-label": t("search.sessions.aria"),
                "aria-expanded": searchExpanded,
                onClick: () => {
                  setWsPickerOpen(false);
                  setSearchExpanded(true);
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconSearchOutlineRegular, { size: searchExpanded ? 11 : 14 })
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "input",
              {
                ref: searchInput,
                className: WorkspaceBrowser_default.searchInput,
                type: "text",
                placeholder: t("search.placeholder"),
                maxLength: SEARCH_QUERY_MAX_CODE_UNITS,
                value: query,
                tabIndex: searchExpanded ? 0 : -1,
                onChange: (e) => {
                  setQuery(sanitizeSearchQuery(e.target.value));
                },
                onKeyDown: (e) => {
                  if (e.key !== "Escape") return;
                  setQuery("");
                  setSearchExpanded(false);
                }
              }
            ),
            searchExpanded && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                className: WorkspaceBrowser_default.clearButton,
                "aria-label": t("search.clear"),
                onClick: (e) => {
                  e.stopPropagation();
                  setQuery("");
                  setSearchExpanded(false);
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconCloseFillRegular, {})
              }
            )
          ]
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: clsx_default(WorkspaceBrowser_default.headerActions, wide && searchExpanded && WorkspaceBrowser_default.headerActionsHidden), children: [
        wide && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          ViewOptionsMenu,
          {
            groupBy,
            orderBy,
            archivedFilter,
            onGroupPick: actions.setGroupBy,
            onOrderPick: (mode) => {
              actions.setOrderBy(mode, activeSessionOrders);
            },
            onArchivedFilterPick: actions.setArchivedFilter,
            t
          }
        ),
        directoryFlowAvailable && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Tooltip, { label: t("workspace.add"), side: "bottom", delayMs: 500, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            ref: wsPlusRef,
            type: "button",
            className: WorkspaceBrowser_default.iconButton,
            "aria-label": t("workspace.add"),
            onClick: () => {
              setWsPickerOpen((v) => !v);
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconProjectAddOutlineRegular, { size: wide ? 16 : 18 })
          }
        ) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        WorkspacePickFlow,
        {
          t,
          open: wsPickerOpen,
          anchorRef: wsPlusRef,
          useWorkspaces,
          createWorkspace,
          useDirectoryFlow,
          renderDirectoryFlow: (owner5) => renderSlot("sidebar.workspaces.directoryFlow", owner5),
          addOnly: true,
          side: "right",
          onPick: (workspaceId) => {
            setWsPickerOpen(false);
            startSession(workspaceId);
          },
          onClose: () => {
            setWsPickerOpen(false);
          }
        }
      )
    ] }),
    !wide && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: WorkspaceBrowser_default.search, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Tooltip, { label: t("search"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        type: "button",
        className: WorkspaceBrowser_default.searchButton,
        "aria-label": t("search.sessions.aria"),
        onClick: () => {
          setSearchExpanded(true);
          setSearchOnExpand(true);
          expandSidebar();
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.IconSearchOutlineRegular, { size: 18 })
      }
    ) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: WorkspaceBrowser_default.listArea, children: wide && (normalizedQuery !== "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      SearchResults,
      {
        usePanelInfo,
        useSessions,
        useSessionStatus,
        open: openSearchResult,
        onUnarchive: onSessionUnarchive,
        workspaces,
        archivedSessionIds,
        archivedFilter,
        query: normalizedQuery,
        remote: remoteSearch,
        resultLimit: searchResultLimit,
        t
      }
    ) : groupBy === "flat" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      FlatList,
      {
        usePanelInfo,
        list,
        sessionIds: orderedFlatSessionIds,
        rowState,
        workspaceReady,
        animationResetKey: `${groupBy}/${orderBy}/${archivedFilter}`,
        useSessionStatus,
        open: guardedOpen,
        onSessionRenameRequest: requestSessionRename,
        renderSlot,
        setSessionOrder: saveSessionOrder,
        revealSessionId,
        onSessionRevealed: acknowledgeSessionReveal,
        t
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      SessionTree,
      {
        usePanelInfo,
        list,
        useSessionStatus,
        onSessionRenameRequest: requestSessionRename,
        renderSlot,
        workspaces: orderedWorkspaces,
        ungroupedSessionIds: orderedUngroupedSessionIds,
        workspaceReady,
        nestWorkspaces: groupBy === "workspace-tree",
        animationResetKey: `${groupBy}/${orderBy}/${archivedFilter}`,
        groupExpansion,
        setGroupExpanded: actions.setGroupExpanded,
        setSessionOrder: saveSessionOrder,
        rowState,
        startSession,
        open: guardedOpen,
        insertWorkspaceBefore,
        revealSessionId,
        onSessionRevealed: acknowledgeSessionReveal,
        home,
        t,
        onRenameRequest: (workspaceId, currentTitle) => {
          setRenameTarget({ workspaceId, currentTitle });
          setRenameDraft(currentTitle);
          setRenameError(null);
        },
        onDeleteRequest: (workspaceId, title) => {
          setDeleteTarget({ workspaceId, title });
          setDeleteError(null);
        }
      }
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      import_dsh_client_ui_primitives3.Modal,
      {
        open: renameTarget !== null,
        onClose: closeRename,
        closeLabel: t("close"),
        title: t("rename.workspace.title"),
        footer: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", disabled: renaming, onClick: closeRename, children: t("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "primary", disabled: renameBlocked, onClick: confirmRename, children: t("rename") })
        ] }),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              className: WorkspaceBrowser_default.renameInput,
              value: renameDraft,
              "aria-label": t("field.workspaceName"),
              autoFocus: true,
              disabled: renaming,
              onFocus: (e) => {
                e.target.select();
              },
              onChange: (e) => {
                setRenameDraft(e.target.value);
                setRenameError(null);
              },
              onCompositionStart: () => {
                composingRef.current = true;
              },
              onCompositionEnd: () => {
                composingRef.current = false;
              },
              onKeyDown: (e) => {
                if (e.key === "Enter" && !composingRef.current) {
                  e.preventDefault();
                  confirmRename();
                }
              }
            }
          ),
          renameDuplicate && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: WorkspaceBrowser_default.renameError, role: "alert", children: t("conflict.named", { name: renameTrimmed }) }),
          renameError !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: WorkspaceBrowser_default.renameError, role: "alert", children: renameError })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      import_dsh_client_ui_primitives3.Modal,
      {
        open: deleteTarget !== null,
        onClose: closeDelete,
        closeLabel: t("close"),
        title: t("delete.workspace"),
        ...deleteTarget === null ? {} : { description: t("delete.desc", { name: deleteTarget.title }) },
        footer: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", disabled: deleting, onClick: closeDelete, children: t("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            import_dsh_client_ui_primitives3.Button,
            {
              variant: "outline",
              className: WorkspaceBrowser_default.deleteAction,
              disabled: deleting,
              onClick: confirmDelete,
              children: t("delete.workspace")
            }
          )
        ] }),
        children: [
          deleting && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: WorkspaceBrowser_default.deleteStatus, role: "status", children: t("delete.pending") }),
          deleteError !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: WorkspaceBrowser_default.renameError, role: "alert", children: deleteError })
        ]
      }
    )
  ] });
}

// session-actions/ArchiveSession.tsx
var import_react5 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime5 = require("react/jsx-runtime");
function ArchiveSessionMenuItem({
  sessionId,
  useArchived,
  useMenuOpenState,
  archiveSession,
  unarchiveSession,
  t
}) {
  const [, setMenuOpen] = useMenuOpenState();
  const archived = useArchived((set) => set.has(sessionId));
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    import_dsh_client_ui_primitives4.MenuItemButton,
    {
      icon: archived ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives4.IconUnarchiveOutlineRegular, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives4.IconArchiveOutlineRegular, { size: 14 }),
      onSelect: () => {
        setMenuOpen(false);
        (archived ? unarchiveSession : archiveSession)(sessionId);
      },
      children: t(archived ? "menu.unarchiveSession" : "menu.archiveSession")
    }
  );
}
function ArchiveSessionRowButton({
  sessionId,
  useArchived,
  archiveSession,
  unarchiveSession,
  t
}) {
  const archived = useArchived((set) => set.has(sessionId));
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives4.Tooltip, { label: t(archived ? "actions.unarchive" : "actions.archive"), side: "bottom", align: "end", delayMs: 500, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "button",
    {
      type: "button",
      className: Rows_default.iconButton,
      "aria-label": t(archived ? "menu.unarchiveSession" : "menu.archiveSession"),
      onClick: () => {
        (archived ? unarchiveSession : archiveSession)(sessionId);
      },
      children: archived ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives4.IconUnarchiveOutlineRegular, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives4.IconArchiveOutlineRegular, { size: 14 })
    }
  ) });
}
function SessionArchiveConfirmDialog({
  useArchiveRequest,
  settleSessionArchive,
  stopAndArchiveSession,
  t
}) {
  const request = useArchiveRequest((pending) => pending);
  if (request === null) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    ArchiveConfirmForm,
    {
      request,
      stopAndArchiveSession,
      onSettle: settleSessionArchive,
      t
    },
    request.sessionId
  );
}
function ArchiveConfirmForm({ request, stopAndArchiveSession, onSettle, t }) {
  const [archiving, setArchiving] = (0, import_react5.useState)(false);
  const [error, setError] = (0, import_react5.useState)(null);
  const close = () => {
    if (archiving) return;
    onSettle();
  };
  const confirm = () => {
    setArchiving(true);
    setError(null);
    stopAndArchiveSession(request.sessionId).then(() => {
      setArchiving(false);
      onSettle();
    }).catch((reason) => {
      setArchiving(false);
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    import_dsh_client_ui_primitives4.Modal,
    {
      open: true,
      onClose: close,
      closeLabel: t("close"),
      title: t("archive.confirm.title"),
      description: t("archive.confirm.desc", { title: request.displayTitle }),
      footer: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "outline", disabled: archiving, onClick: close, children: t("cancel") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          import_dsh_client_ui_primitives4.Button,
          {
            variant: "outline",
            className: WorkspaceBrowser_default.deleteAction,
            disabled: archiving,
            onClick: confirm,
            children: t("archive.confirm.action")
          }
        )
      ] }),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ul", { className: WorkspaceBrowser_default.archiveActivity, "aria-label": t("archive.confirm.activity"), children: request.activity.map((entry, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("li", { children: activityLine(entry, t) }, `${entry.kind}-${String(index)}`)) }),
        archiving && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: WorkspaceBrowser_default.deleteStatus, role: "status", children: t("archive.confirm.pending") }),
        error !== null && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: WorkspaceBrowser_default.renameError, role: "alert", children: error })
      ]
    }
  );
}
function activityLine(entry, t) {
  const items = entry.items ?? [];
  const n = items.length;
  const names = items.map((item) => item.label ?? item.id).join(t("archive.confirm.listSeparator"));
  const plural = n === 1 ? "one" : "other";
  switch (entry.kind) {
    case "turn":
      return t("archive.confirm.turn");
    case "subagent":
      return t(`archive.confirm.subagents.${plural}`, { n, names });
    case "job":
      return t(`archive.confirm.jobs.${plural}`, { n, names });
    case "schedule":
      return t(`archive.confirm.schedules.${plural}`, { n, names });
    default:
      return t(`archive.confirm.other.${plural}`, { kind: entry.kind, n });
  }
}

// session-actions/derived.ts
function derive(source, project) {
  let seen;
  let value;
  return {
    getSnapshot: () => {
      const snapshot = source.getSnapshot();
      if (value === void 0 || snapshot !== seen) {
        seen = snapshot;
        value = project(snapshot);
      }
      return value;
    },
    subscribe: (listener) => source.subscribe(listener)
  };
}

// session-actions/ForkSession.tsx
var import_dsh_client_ui_primitives5 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime6 = require("react/jsx-runtime");
function ForkSessionMenuItem({ sessionId, useMenuOpenState, forkSession, t }) {
  const [, setMenuOpen] = useMenuOpenState();
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    import_dsh_client_ui_primitives5.MenuItemButton,
    {
      icon: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives5.IconBranchOutlineRegular, {}),
      onSelect: () => {
        setMenuOpen(false);
        forkSession(sessionId);
      },
      children: t("menu.fork")
    }
  );
}

// session-actions/PinSession.tsx
var import_dsh_client_ui_primitives6 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime7 = require("react/jsx-runtime");
function usePinState({ sessionId, usePinned, useArchived }) {
  return {
    pinned: usePinned((pinned) => pinned.has(sessionId)),
    archived: useArchived((archived) => archived.has(sessionId))
  };
}
function PinSessionMenuItem(props) {
  const { sessionId, useMenuOpenState, pinSession, unpinSession, t } = props;
  const [, setMenuOpen] = useMenuOpenState();
  const { pinned, archived } = usePinState(props);
  if (archived) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    import_dsh_client_ui_primitives6.MenuItemButton,
    {
      icon: pinned ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.IconPinFillRegular, {}) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.IconPinOutlineRegular, {}),
      onSelect: () => {
        setMenuOpen(false);
        (pinned ? unpinSession : pinSession)(sessionId);
      },
      children: t(pinned ? "menu.unpinSession" : "menu.pinSession")
    }
  );
}
function PinSessionRowButton(props) {
  const { sessionId, pinSession, unpinSession, t } = props;
  const { pinned, archived } = usePinState(props);
  if (archived) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Tooltip, { label: t(pinned ? "actions.unpin" : "actions.pin"), side: "bottom", align: "end", delayMs: 500, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "button",
    {
      type: "button",
      className: Rows_default.iconButton,
      "aria-label": t(pinned ? "menu.unpinSession" : "menu.pinSession"),
      onClick: () => {
        (pinned ? unpinSession : pinSession)(sessionId);
      },
      children: pinned ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.IconPinFillRegular, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.IconPinOutlineRegular, { size: 14 })
    }
  ) });
}

// session-actions/RenameSession.tsx
var import_react6 = require("react");
var import_dsh_client_ui_primitives7 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime8 = require("react/jsx-runtime");
function RenameSessionMenuItem({
  sessionId,
  displayTitle: displayTitle2,
  useMenuOpenState,
  requestSessionRename,
  t
}) {
  const [, setMenuOpen] = useMenuOpenState();
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    import_dsh_client_ui_primitives7.MenuItemButton,
    {
      icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives7.IconEditOutlineRegular, {}),
      onSelect: () => {
        setMenuOpen(false);
        requestSessionRename(sessionId, displayTitle2);
      },
      children: t("rename")
    }
  );
}
function SessionRenameDialog({ useRenameRequest, settleSessionRename, renameSession, t }) {
  const request = useRenameRequest((pending) => pending);
  if (request === null) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    RenameForm,
    {
      request,
      renameSession,
      onSettle: settleSessionRename,
      t
    },
    request.sessionId
  );
}
function RenameForm({ request, renameSession, onSettle, t }) {
  const [draft, setDraft] = (0, import_react6.useState)(request.currentTitle);
  const [renaming, setRenaming] = (0, import_react6.useState)(false);
  const [error, setError] = (0, import_react6.useState)(null);
  const composingRef = (0, import_react6.useRef)(false);
  const trimmed = draft.trim();
  const blocked = renaming || trimmed === "";
  const close = () => {
    if (renaming) return;
    onSettle();
  };
  const confirm = () => {
    if (blocked) return;
    setRenaming(true);
    setError(null);
    renameSession(request.sessionId, trimmed).then(() => {
      setRenaming(false);
      onSettle();
    }).catch((reason) => {
      setRenaming(false);
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    import_dsh_client_ui_primitives7.Modal,
    {
      open: true,
      onClose: close,
      closeLabel: t("close"),
      title: t("rename.session.title"),
      footer: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives7.Button, { variant: "outline", disabled: renaming, onClick: close, children: t("cancel") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_dsh_client_ui_primitives7.Button, { variant: "primary", disabled: blocked, onClick: confirm, children: t("rename") })
      ] }),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "input",
          {
            className: WorkspaceBrowser_default.renameInput,
            value: draft,
            "aria-label": t("field.sessionName"),
            autoFocus: true,
            disabled: renaming,
            onFocus: (e) => {
              e.target.select();
            },
            onChange: (e) => {
              setDraft(e.target.value);
              setError(null);
            },
            onCompositionStart: () => {
              composingRef.current = true;
            },
            onCompositionEnd: () => {
              composingRef.current = false;
            },
            onKeyDown: (e) => {
              if (e.key === "Enter" && !composingRef.current) {
                e.preventDefault();
                confirm();
              }
            }
          }
        ),
        error !== null && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: WorkspaceBrowser_default.renameError, role: "alert", children: error })
      ]
    }
  );
}

// session-actions/RowActionToast.tsx
var import_dsh_client_ui_primitives8 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime9 = require("react/jsx-runtime");
var LONG_TOAST_HOLD_MS = 6e3;
function RowActionToast({ useToast, dismissToast, undoArchive, showArchived, t }) {
  const toast = useToast((current) => current);
  if (toast === null) return null;
  if (toast.kind === "archived" || toast.kind === "stoppedAndArchived") {
    const { sessionId } = toast;
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_dsh_client_ui_primitives8.Toast,
      {
        text: t(toast.kind === "archived" ? "toast.archived" : "toast.stoppedAndArchived"),
        tone: "success",
        holdMs: LONG_TOAST_HOLD_MS,
        actions: [
          { label: t("toast.archivedUndo"), onClick: () => {
            dismissToast();
            undoArchive(sessionId);
          } },
          { prefix: t("toast.archivedOr"), label: t("toast.archivedFilter"), onClick: () => {
            dismissToast();
            showArchived();
          } }
        ],
        onDone: dismissToast
      },
      `toast-${String(toast.seq)}`
    );
  }
  if (toast.kind === "createFailed") {
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_dsh_client_ui_primitives8.Toast,
      {
        text: t("toast.createFailed", { message: toast.message }),
        icon: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_dsh_client_ui_primitives8.IconWarningOutlineRegular, {}),
        holdMs: LONG_TOAST_HOLD_MS,
        onDone: dismissToast
      },
      `toast-${String(toast.seq)}`
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    import_dsh_client_ui_primitives8.Toast,
    {
      text: plainNoticeText(toast, t),
      icon: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_dsh_client_ui_primitives8.IconWarningOutlineRegular, {}),
      onDone: dismissToast
    },
    `toast-${String(toast.seq)}`
  );
}
function plainNoticeText(toast, t) {
  switch (toast.kind) {
    case "pinFailed":
      return t("toast.pinFailed");
    case "unpinFailed":
      return t("toast.unpinFailed");
    case "defaultWorkspaceFailed":
      return t("defaultWorkspace.failed");
    case "archivedNotOpenable":
      return t("toast.archivedNotOpenable");
    /* v8 ignore next 2 -- closed-union backstop; only reached if a notice kind is forged */
    default:
      return assertNever(toast);
  }
}

// index.ts
var NS = "workspace";
var inject = [
  "slots",
  "sessions",
  "workspaces",
  "locale",
  "remote",
  "remote.directoryPicker",
  "layout"
];
function apply(ctx) {
  const sessions = ctx.get("sessions");
  const workspaces = ctx.get("workspaces");
  const viewHandle = createWorkspaceViewStore();
  const viewInstance = viewHandle.create();
  const viewStore = { ...viewHandle, create: () => viewInstance };
  const rowToast = (0, import_dsh_client_store3.createSnapshotStore)(null);
  let toastSeq = 0;
  const notify = (toast) => {
    rowToast.set({ ...toast, seq: ++toastSeq });
  };
  const uiWorkspace = new UiWorkspaceService(
    ctx,
    ctx.remote.directoryPicker,
    workspaces,
    sessions,
    viewInstance.actions,
    notify
  );
  ctx.slots.provideRoot({ hooks: { workspaces: workspaces.list } });
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-workspace: dictionaries");
  const searchSessions = async (query, signal) => {
    const result = await sessions.search(query, signal);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const flowSource = (hole) => ({
    getSnapshot: () => ctx.slots.entries(hole).length > 0,
    subscribe: (listener) => ctx.slots.subscribe(hole, listener)
  });
  const browserFlowSource = flowSource("sidebar.workspaces.directoryFlow");
  const presentationSource = flowSource("sidebar.workspaces.presentation");
  const hostInfo = {
    getSnapshot: () => ctx.remote.$host,
    subscribe: (listener) => ctx.on("connection/reset", listener)
  };
  const pickerFlowSource = flowSource("conversation.hero.workspace.directoryFlow");
  const openSession = (sessionId) => {
    uiWorkspace.openSession(sessionId);
  };
  const pinnedSet = derive(workspaces.list, (snapshot) => new Set(snapshot.pinnedSessionIds));
  const archivedSet = derive(workspaces.list, (snapshot) => new Set(snapshot.archivedSessionIds));
  const renameRequest = (0, import_dsh_client_store3.createSnapshotStore)(null);
  const archiveRequest = (0, import_dsh_client_store3.createSnapshotStore)(null);
  const requestSessionRename = (sessionId, currentTitle) => {
    renameRequest.set({ sessionId, currentTitle });
  };
  const unarchiveSession = (sessionId) => {
    uiWorkspace.unarchiveSession(sessionId).catch((reason) => {
      console.warn("session unarchive rejected:", reason);
    });
  };
  const renameSession = async (sessionId, title) => {
    const result = await sessions.using(
      sessionId,
      { source: "workspaceOperation" },
      (reference) => reference.binding.session.rename(title)
    );
    if (!result.ok) throw new Error(result.error.message);
  };
  const pinInjected = () => ({
    hooks: { pinned: pinnedSet, archived: archivedSet },
    // Pin failures surface as a notice: nothing else on the surface moves, so
    // a silent failure would read as a dead action.
    pinSession: (sessionId) => {
      uiWorkspace.pinSession(sessionId).catch(() => {
        notify({ kind: "pinFailed" });
      });
    },
    unpinSession: (sessionId) => {
      uiWorkspace.unpinSession(sessionId).catch(() => {
        notify({ kind: "unpinFailed" });
      });
    }
  });
  const archiveInjected = () => ({
    hooks: { archived: archivedSet },
    // Archive preserves the log and the account position, so a quiet Session
    // needs no confirmation; the notice offers undo and the archived filter.
    // The Host's refusal for running work is the one case that asks first:
    // the confirmation names that work and offers to stop it.
    archiveSession: (sessionId) => {
      uiWorkspace.archiveSession(sessionId).then(() => {
        notify({ kind: "archived", sessionId });
      }).catch((reason) => {
        const activity = activeSessionRefusal(reason);
        if (activity === void 0) {
          console.warn("session archive rejected:", reason);
          return;
        }
        const displayTitle2 = sessions.list.getSnapshot().byId[sessionId]?.displayTitle ?? sessionId;
        archiveRequest.set({ sessionId, displayTitle: displayTitle2, activity });
      });
    },
    unarchiveSession
  });
  const archiveConfirmInjected = () => ({
    hooks: { archiveRequest },
    settleSessionArchive: () => {
      archiveRequest.set(null);
    },
    stopAndArchiveSession: async (sessionId) => {
      await uiWorkspace.archiveSession(sessionId, { stopActivity: true });
      notify({ kind: "stoppedAndArchived", sessionId });
    }
  });
  const forkInjected = () => ({
    forkSession: (sessionId) => {
      uiWorkspace.forkSession(sessionId).catch(() => {
      });
    }
  });
  const renameInjected = () => ({ requestSessionRename });
  const renameDialogInjected = () => ({
    hooks: { renameRequest },
    settleSessionRename: () => {
      renameRequest.set(null);
    },
    renameSession
  });
  const rowToastInjected = () => ({
    hooks: { toast: rowToast },
    dismissToast: () => {
      rowToast.set(null);
    },
    undoArchive: unarchiveSession,
    showArchived: () => {
      viewInstance.actions.setArchivedFilter("show");
    }
  });
  const browserInjected = () => ({
    // Explicit group actions keep their target; unscoped New Session inherits
    // the current Session Workspace before the recent-Workspace fallback.
    startSession: (workspaceId) => {
      uiWorkspace.startSession(workspaceId);
    },
    open: openSession,
    searchSessions,
    searchResultLimit: sessions.searchResultLimit,
    requestSessionRename,
    notifyArchivedNotOpenable: () => {
      notify({ kind: "archivedNotOpenable" });
    },
    renameWorkspace: async (workspaceId, title) => {
      await workspaces.rename(workspaceId, title);
    },
    deleteWorkspace: async (workspaceId) => {
      await workspaces.delete(workspaceId);
    },
    insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
      await workspaces.insertBefore(workspaceId, beforeWorkspaceId);
    },
    unarchiveSession: async (sessionId) => {
      await uiWorkspace.unarchiveSession(sessionId);
    },
    createWorkspace: (input) => workspaces.create(input),
    hooks: { directoryFlow: browserFlowSource, hostInfo, presentation: presentationSource }
  });
  const pickerInjected = () => ({
    createWorkspace: (input) => workspaces.create(input),
    hooks: { directoryFlow: pickerFlowSource }
  });
  ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register(
    {
      name: "sidebar.workspaces",
      children: {
        "sidebar.workspaces.directoryFlow": { kind: "single", scope: "root" },
        "sidebar.workspaces.before": { kind: "list", scope: "root" },
        "sidebar.workspaces.header.action": { kind: "list", scope: "root" },
        "sidebar.workspaces.presentation": { kind: "single", scope: "root" },
        // Every row entry reads the menu's open state through a hook bound
        // from the row's render occurrence (the owner passes the state pair
        // as hookContext).
        "sidebar.workspaces.session.menu.item": {
          kind: "list",
          scope: "root",
          inject: { hooks: { menuOpenState: menuOpenStateFactory } }
        },
        "sidebar.workspaces.session.row.action": { kind: "list", scope: "root" }
      },
      store: viewStore,
      inject: browserInjected,
      locale: NS
    },
    WorkspaceBrowser
  ));
  ctx.slots.inject("sidebar.workspaces.session.menu.item", function* () {
    yield ctx.slots.register({ name: "sidebar.workspaces.session.menu.item", id: "pin", order: 100, locale: NS, inject: pinInjected }, PinSessionMenuItem);
    yield ctx.slots.register({ name: "sidebar.workspaces.session.menu.item", id: "rename", order: 200, locale: NS, inject: renameInjected }, RenameSessionMenuItem);
    yield ctx.slots.register({ name: "sidebar.workspaces.session.menu.item", id: "fork", order: 300, locale: NS, inject: forkInjected }, ForkSessionMenuItem);
    yield ctx.slots.register({ name: "sidebar.workspaces.session.menu.item", id: "archive", order: 400, locale: NS, inject: archiveInjected }, ArchiveSessionMenuItem);
  });
  ctx.slots.inject("sidebar.workspaces.session.row.action", function* () {
    yield ctx.slots.register({ name: "sidebar.workspaces.session.row.action", id: "archive", order: 100, locale: NS, inject: archiveInjected }, ArchiveSessionRowButton);
    yield ctx.slots.register({ name: "sidebar.workspaces.session.row.action", id: "pin", order: 200, locale: NS, inject: pinInjected }, PinSessionRowButton);
  });
  ctx.slots.inject("shell.overlay", function* () {
    yield ctx.slots.register({
      name: "shell.overlay",
      id: "workspace.session-rename",
      locale: NS,
      inject: renameDialogInjected
    }, SessionRenameDialog);
    yield ctx.slots.register({
      name: "shell.overlay",
      id: "workspace.session-archive",
      locale: NS,
      inject: archiveConfirmInjected
    }, SessionArchiveConfirmDialog);
    yield ctx.slots.register({
      name: "shell.overlay",
      id: "workspace.row-toast",
      locale: NS,
      inject: rowToastInjected
    }, RowActionToast);
  });
  ctx.slots.inject("conversation.hero.workspace", () => ctx.slots.register(
    {
      name: "conversation.hero.workspace",
      children: { "conversation.hero.workspace.directoryFlow": { kind: "single", scope: "root" } },
      inject: pickerInjected,
      locale: NS
    },
    WorkspacePicker
  ));
}
function activeSessionRefusal(reason) {
  if (!(reason instanceof Error) || reason.name !== "WorkspaceArchiveError") return void 0;
  const { rpcError } = reason;
  return rpcError.code === "workspace/session-active" ? rpcError.details.activity : void 0;
}
return module.exports; } });
